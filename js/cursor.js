/* ==========================================================================
   The ring cursor
   A shaded gold ring that eases after the pointer, leaves a faint trail of
   gold dust, glows with a slowly turning inscription over anything
   clickable, and tightens when you press.
   ========================================================================== */
(function () {
  'use strict';

  /* only for a real mouse or trackpad, and never for people who asked for
     less motion; everyone else keeps their normal cursor */
  if (!window.matchMedia) return;
  if (!window.matchMedia('(hover: hover) and (pointer: fine)').matches) return;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  var root = document.documentElement;
  var TAU = Math.PI * 2;
  var INTERACTIVE =
    'a[href], button, [role="button"], input, select, textarea, label, summary';

  /* ---------- the inscription: loops of script running around the band --- */
  function inscriptionPath() {
    var R = 13, C = TAU * R, seed = 11;
    function rand() { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; }

    var d = '', s = 1.2;
    while (s < C - 4) {
      var len = Math.min(4.5 + rand() * 6.5, C - 2.5 - s);
      if (len < 2.5) break;
      var loop = 2.05 + rand() * 0.5;           /* one looped stroke every ~2 units */
      var w = TAU / loop;
      var steps = Math.ceil(len * 14);
      for (var k = 0; k <= steps; k++) {
        var u = (k / steps) * len;
        /* sliding back along the band while swinging across it draws loops */
        var along = s + u + 0.5 * Math.cos(w * u);
        var across = (0.95 + 0.35 * Math.sin(u * 1.7 + s)) * Math.sin(w * u);
        var theta = along / R - Math.PI / 2;
        var r = R + across;
        d += (k ? 'L' : 'M') +
          (20 + r * Math.cos(theta)).toFixed(2) + ' ' +
          (20 + r * Math.sin(theta)).toFixed(2);
      }
      s += len + 1.6 + rand() * 1.4;               /* gap between "words" */
    }
    return d;
  }

  /* ---------- the ring: lit from the upper left, like polished metal ------ */
  var RING_SVG =
    '<svg viewBox="0 0 40 40" aria-hidden="true" focusable="false">' +
      '<defs>' +
        '<linearGradient id="ringMetal" x1="5" y1="5" x2="35" y2="35" gradientUnits="userSpaceOnUse">' +
          '<stop offset="0" stop-color="#fff6d6"/>' +
          '<stop offset=".18" stop-color="#f5d680"/>' +
          '<stop offset=".42" stop-color="#d19d36"/>' +
          '<stop offset=".68" stop-color="#6e4b0f"/>' +
          '<stop offset=".88" stop-color="#9f7427"/>' +
          '<stop offset="1" stop-color="#d9b25a"/>' +
        '</linearGradient>' +
        /* shading across the band's width, so it reads as a rounded tube
           rather than a flat stroke: dark at both edges, lit along the crown */
        '<radialGradient id="ringTube" cx="20" cy="20" r="15.5" gradientUnits="userSpaceOnUse">' +
          '<stop offset=".677" stop-color="#241602" stop-opacity=".68"/>' +
          '<stop offset=".77" stop-color="#241602" stop-opacity="0"/>' +
          '<stop offset=".845" stop-color="#fff6d8" stop-opacity=".26"/>' +
          '<stop offset=".925" stop-color="#241602" stop-opacity="0"/>' +
          '<stop offset="1" stop-color="#241602" stop-opacity=".72"/>' +
        '</radialGradient>' +
        '<filter id="ringGlow" x="-40%" y="-40%" width="180%" height="180%">' +
          '<feGaussianBlur stdDeviation=".6" result="b"/>' +
          '<feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>' +
        '</filter>' +
      '</defs>' +
      '<circle cx="20" cy="20" r="13" fill="none" stroke="url(#ringMetal)" stroke-width="5"/>' +
      '<circle cx="20" cy="20" r="13" fill="none" stroke="url(#ringTube)" stroke-width="5"/>' +
      /* specular highlight on the outer crown, and a softer glint inside */
      '<circle cx="20" cy="20" r="13.7" fill="none" stroke="#fffbea" stroke-width="1.1" stroke-linecap="round" stroke-dasharray="8.6 200" transform="rotate(206 20 20)" opacity=".9"/>' +
      '<circle cx="20" cy="20" r="11.3" fill="none" stroke="#fff1c4" stroke-width=".7" stroke-linecap="round" stroke-dasharray="5 200" transform="rotate(30 20 20)" opacity=".5"/>' +
      '<circle cx="20" cy="20" r="15.5" fill="none" stroke="#3a2707" stroke-width=".6" opacity=".55"/>' +
      '<circle cx="20" cy="20" r="10.5" fill="none" stroke="#3a2707" stroke-width=".6" opacity=".45"/>' +
      '<g class="ring-script"><g class="ring-script-spin">' +
        '<path d="' + inscriptionPath() + '" fill="none" stroke="#ffe7a0" stroke-width=".5" ' +
          'stroke-linecap="round" stroke-linejoin="round" filter="url(#ringGlow)"/>' +
      '</g></g>' +
    '</svg>';

  var GHOST_SVG =
    '<svg viewBox="0 0 40 40" aria-hidden="true" focusable="false">' +
      '<circle cx="20" cy="20" r="13" fill="none" stroke="#e0bb62" stroke-width="4"/>' +
    '</svg>';

  /* ---------- build ------------------------------------------------------- */
  var ring = document.createElement('div');
  ring.className = 'ring-cursor';
  ring.innerHTML = '<div class="ring-inner">' + RING_SVG + '</div>';

  /* two faint rings that chase the main one: the soft motion blur */
  var GHOST_OPACITY = [0.14, 0.06];
  var ghosts = GHOST_OPACITY.map(function () {
    var g = document.createElement('div');
    g.className = 'ring-ghost';
    g.innerHTML = GHOST_SVG;
    return g;
  });

  var canvas = document.createElement('canvas');
  canvas.className = 'dust';
  canvas.setAttribute('aria-hidden', 'true');
  var ctx = canvas.getContext('2d');

  document.body.appendChild(canvas);
  ghosts.forEach(function (g) { document.body.appendChild(g); });
  document.body.appendChild(ring);

  var dpr = 1, vw = 0, vh = 0;
  function sizeCanvas() {
    dpr = Math.min(2, window.devicePixelRatio || 1);
    vw = window.innerWidth; vh = window.innerHeight;
    canvas.width = Math.round(vw * dpr);
    canvas.height = Math.round(vh * dpr);
    canvas.style.width = vw + 'px';
    canvas.style.height = vh + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  sizeCanvas();
  window.addEventListener('resize', sizeCanvas);

  /* ---------- state -------------------------------------------------------- */
  var target = { x: 0, y: 0 };
  var pos = { x: 0, y: 0 };
  var trail = [{ x: 0, y: 0 }, { x: 0, y: 0 }];
  var started = false, visible = false, hovering = false, pressed = false;
  var raf = null, lastTime = 0, dustCarry = 0;
  var grains = [];

  var DUST = ['255,241,194', '245,217,139', '232,195,106', '202,160,74'];

  /* Easing that behaves the same at 60Hz and 120Hz: the per-frame factor is
     rescaled by elapsed time, so a ProMotion display doesn't feel twice as
     snappy as a regular monitor. */
  function ease(base, frames) { return 1 - Math.pow(1 - base, frames); }

  function setVisible(v) {
    if (v === visible) return;
    visible = v;
    ring.classList.toggle('is-visible', v);
    syncGhosts();
  }
  function syncGhosts() {
    ghosts.forEach(function (g, i) {
      g.style.opacity = (visible && !hovering && !pressed) ? GHOST_OPACITY[i] : 0;
    });
  }

  /* ---------- dust -------------------------------------------------------- */
  function shed(distance, dx, dy) {
    if (distance < 0.4) return;
    dustCarry += distance / 10;                 /* about one grain per 10px */
    var count = Math.min(3, Math.floor(dustCarry));
    dustCarry = Math.min(dustCarry - count, 1);

    for (var i = 0; i < count; i++) {
      if (grains.length > 90) grains.shift();
      var a = Math.random() * TAU;
      var r = 6 + Math.random() * 6;            /* flakes off the band itself */
      grains.push({
        x: pos.x + Math.cos(a) * r,
        y: pos.y + Math.sin(a) * r,
        vx: Math.cos(a) * (0.05 + Math.random() * 0.12) - dx * 0.035,
        vy: Math.sin(a) * (0.05 + Math.random() * 0.12) - dy * 0.035,
        age: 0,
        life: 650 + Math.random() * 700,
        size: 0.45 + Math.random() * 1.15,
        alpha: 0.16 + Math.random() * 0.28,
        wobble: Math.random() * TAU,
        color: DUST[(Math.random() * DUST.length) | 0]
      });
    }
  }

  function drawDust(dt, frames) {
    ctx.clearRect(0, 0, vw, vh);
    if (!grains.length) return;
    ctx.globalCompositeOperation = 'lighter';

    for (var i = grains.length - 1; i >= 0; i--) {
      var p = grains[i];
      p.age += dt;
      if (p.age >= p.life) { grains.splice(i, 1); continue; }

      p.wobble += 0.05 * frames;
      p.vx *= Math.pow(0.965, frames);
      p.vy = p.vy * Math.pow(0.965, frames) + 0.004 * frames;   /* settles slowly */
      p.x += (p.vx + Math.sin(p.wobble) * 0.05) * frames;
      p.y += p.vy * frames;

      var t = p.age / p.life;
      var fade = t < 0.12 ? t / 0.12 : Math.pow(1 - (t - 0.12) / 0.88, 1.6);
      var a = p.alpha * fade;

      ctx.fillStyle = 'rgba(' + p.color + ',' + (a * 0.2).toFixed(3) + ')';
      ctx.beginPath(); ctx.arc(p.x, p.y, p.size * 3.2, 0, TAU); ctx.fill();
      ctx.fillStyle = 'rgba(' + p.color + ',' + a.toFixed(3) + ')';
      ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, TAU); ctx.fill();
    }
    ctx.globalCompositeOperation = 'source-over';
  }

  /* ---------- the frame loop: only runs while something is moving --------- */
  function frame(now) {
    raf = null;
    var dt = lastTime ? Math.min(64, now - lastTime) : 16.67;
    lastTime = now;
    var frames = dt / 16.667;

    var px = pos.x, py = pos.y;
    var k = ease(0.3, frames);
    pos.x += (target.x - pos.x) * k;
    pos.y += (target.y - pos.y) * k;
    ring.style.transform = 'translate3d(' + pos.x.toFixed(2) + 'px,' + pos.y.toFixed(2) + 'px,0)';

    var settling = Math.abs(target.x - pos.x) + Math.abs(target.y - pos.y) > 0.1;

    var lead = pos;
    for (var i = 0; i < trail.length; i++) {
      var t = trail[i];
      var bx = t.x, by = t.y;
      /* tight enough to read as motion blur, not as a second cursor */
      var kk = ease(0.34 - i * 0.1, frames);
      t.x += (lead.x - t.x) * kk;
      t.y += (lead.y - t.y) * kk;
      ghosts[i].style.transform = 'translate3d(' + t.x.toFixed(2) + 'px,' + t.y.toFixed(2) + 'px,0)';
      if (Math.abs(t.x - bx) + Math.abs(t.y - by) > 0.05) settling = true;
      lead = t;
    }

    var dx = pos.x - px, dy = pos.y - py;
    if (visible) shed(Math.sqrt(dx * dx + dy * dy), dx, dy);
    drawDust(dt, frames);

    if (settling || grains.length) {
      raf = window.requestAnimationFrame(frame);
    } else {
      lastTime = 0;
    }
  }
  function kick() { if (raf === null) raf = window.requestAnimationFrame(frame); }

  /* ---------- input -------------------------------------------------------- */
  document.addEventListener('mousemove', function (e) {
    target.x = e.clientX;
    target.y = e.clientY;
    if (!started) {
      /* hide the system cursor only once ours actually has a position, so
         there's never a moment with no cursor on screen */
      started = true;
      pos.x = target.x; pos.y = target.y;
      trail.forEach(function (t) { t.x = target.x; t.y = target.y; });
      root.classList.add('has-ring');
    }
    setVisible(true);
    kick();
  }, { passive: true });

  document.addEventListener('mouseover', function (e) {
    var el = e.target;
    var over = !!(el && el.closest && el.closest(INTERACTIVE));
    if (over !== hovering) {
      hovering = over;
      ring.classList.toggle('is-hover', over);
      syncGhosts();
    }
  });

  document.addEventListener('mousedown', function () {
    pressed = true; ring.classList.add('is-down'); syncGhosts();
  });
  function release() {
    pressed = false; ring.classList.remove('is-down'); syncGhosts();
  }
  document.addEventListener('mouseup', release);
  window.addEventListener('blur', release);

  root.addEventListener('mouseleave', function () { setVisible(false); });
  root.addEventListener('mouseenter', function () { if (started) setVisible(true); });
})();
