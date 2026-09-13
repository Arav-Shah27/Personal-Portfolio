/* ==========================================================
   Arav Shah — portfolio
   ========================================================== */
(function () {
  'use strict';

  var SVGNS = 'http://www.w3.org/2000/svg';

  document.documentElement.classList.add('js');

  /* ---------- small deterministic PRNG so the path looks
       identical on every load, but still organic ---------- */
  function Rng(seed) { this.s = seed >>> 0; }
  Rng.prototype.next = function () {
    this.s = (1103515245 * this.s + 12345) & 0x7fffffff;
    return this.s / 0x7fffffff;
  };
  Rng.prototype.range = function (a, b) { return a + (b - a) * this.next(); };

  /* ==========================================================
     1. THE STONE PATH
     A serpentine line running right -> left -> right down the
     whole page, with irregular watercolor slabs laid along it.
     ========================================================== */

  var svg = document.getElementById('stonePath');
  var hero = document.getElementById('home');

  /* closed Catmull-Rom through the points -> smooth organic blob */
  function blobPath(pts) {
    var n = pts.length, d = 'M' + pts[0][0].toFixed(1) + ' ' + pts[0][1].toFixed(1);
    for (var i = 0; i < n; i++) {
      var p0 = pts[(i - 1 + n) % n], p1 = pts[i],
          p2 = pts[(i + 1) % n],     p3 = pts[(i + 2) % n];
      var c1x = p1[0] + (p2[0] - p0[0]) / 6, c1y = p1[1] + (p2[1] - p0[1]) / 6;
      var c2x = p2[0] - (p3[0] - p1[0]) / 6, c2y = p2[1] - (p3[1] - p1[1]) / 6;
      d += ' C' + c1x.toFixed(1) + ' ' + c1y.toFixed(1) +
           ',' + c2x.toFixed(1) + ' ' + c2y.toFixed(1) +
           ',' + p2[0].toFixed(1) + ' ' + p2[1].toFixed(1);
    }
    return d + ' Z';
  }

  function stoneOutline(rng, cx, cy, rx, ry, rot) {
    var pts = [], steps = 13, cos = Math.cos(rot), sin = Math.sin(rot);
    for (var i = 0; i < steps; i++) {
      var a = (i / steps) * Math.PI * 2;
      /* flatten the top and bottom so slabs read as slabs, not pebbles */
      var flat = 1 - 0.16 * Math.abs(Math.sin(a));
      var x = Math.cos(a) * rx * rng.range(0.74, 1.26);
      var y = Math.sin(a) * ry * rng.range(0.70, 1.30) * flat;
      pts.push([cx + x * cos - y * sin, cy + x * sin + y * cos]);
    }
    return blobPath(pts);
  }

  function el(name, attrs) {
    var e = document.createElementNS(SVGNS, name);
    for (var k in attrs) if (attrs.hasOwnProperty(k)) e.setAttribute(k, attrs[k]);
    return e;
  }

  var lastW = -1, lastH = -1;

  function drawPath(force) {
    if (!svg || !hero) return;

    var W = document.documentElement.clientWidth;
    var H = Math.max(
      document.body.scrollHeight,
      document.documentElement.scrollHeight
    );

    /* a zero-width viewport (a hidden tab, a collapsed frame) makes every
       card wrap to its minimum and the page balloon; there is nothing worth
       drawing in that state, and the resize handler redraws once it's real */
    if (W < 1) return;

    /* nothing moved -> don't redraw (also stops the ResizeObserver
       from chasing its own tail) */
    if (!force && W === lastW && Math.abs(H - lastH) < 4) return;
    lastW = W; lastH = H;

    while (svg.firstChild) svg.removeChild(svg.firstChild);
    svg.setAttribute('viewBox', '0 0 ' + W + ' ' + H);
    svg.setAttribute('width', W);
    svg.setAttribute('height', H);

    var defs = el('defs');
    defs.innerHTML =
      '<linearGradient id="slab" x1="0" y1="0" x2="0.4" y2="1">' +
        '<stop offset="0%" stop-color="#7e7f81"/>' +
        '<stop offset="45%" stop-color="#65666a"/>' +
        '<stop offset="100%" stop-color="#47484b"/>' +
      '</linearGradient>' +
      '<filter id="stoneBlur" x="-40%" y="-40%" width="180%" height="180%">' +
        '<feGaussianBlur stdDeviation="7"/>' +
      '</filter>' +
      '<filter id="rimBlur" x="-30%" y="-30%" width="160%" height="160%">' +
        '<feGaussianBlur stdDeviation="2.2"/>' +
      '</filter>';
    svg.appendChild(defs);

    /* start just under the painting so the drawn stones read as a
       continuation of the ones in the watercolor */
    var startY = hero.offsetTop + hero.offsetHeight - 10;
    var endY   = H - 40;
    if (endY - startY < 200) return;

    var rng = new Rng(97531);
    var cx  = W / 2;
    var amp = Math.min(W * 0.30, 400);
    var wavelength = Math.max(760, Math.min(1150, H / 7));

    /* stones scale with viewport so they stay in proportion */
    var baseRx = Math.max(52, Math.min(W * 0.085, 118));
    var baseRy = baseRx * 0.36;
    var step   = baseRx * 1.95;

    var g = el('g', {});
    var fadeIn = 260;   /* ramp the first stones up out of the painting */

    for (var y = startY; y < endY; y += step * rng.range(0.86, 1.16)) {
      var t  = (y - startY) / wavelength * Math.PI * 2;
      var x  = cx + Math.sin(t) * amp + rng.range(-16, 16);

      /* tilt each slab along the direction the path is travelling */
      var slope = Math.cos(t) * amp * (Math.PI * 2 / wavelength);
      var rot   = Math.atan(1 / (slope || 1e-6)) * -0.20 + rng.range(-0.10, 0.10);

      var rx = baseRx * rng.range(0.78, 1.22);
      var ry = baseRy * rng.range(0.80, 1.25);

      var op = Math.min(1, (y - startY) / fadeIn);
      op = op * op * (3 - 2 * op);          /* smoothstep */

      var stone = el('g', { opacity: op.toFixed(3) });

      /* damp shadow pooled under the slab */
      stone.appendChild(el('path', {
        d: stoneOutline(new Rng(Math.floor(y) * 31 + 7), x + 4, y + 9, rx * 1.03, ry * 1.05, rot),
        fill: '#25401a', opacity: '0.4', filter: 'url(#stoneBlur)'
      }));

      /* the slab itself */
      stone.appendChild(el('path', {
        d: stoneOutline(new Rng(Math.floor(y) * 31 + 7), x, y, rx, ry, rot),
        fill: 'url(#slab)', stroke: '#1f1e1c',
        'stroke-width': '2.2', 'stroke-linejoin': 'round', 'stroke-opacity': '0.9'
      }));

      /* pigment pooling along the rim, the way the painting's stones dry */
      stone.appendChild(el('path', {
        d: stoneOutline(new Rng(Math.floor(y) * 31 + 7), x, y, rx * 0.99, ry * 0.97, rot),
        fill: 'none', stroke: '#33343a', 'stroke-width': '5', opacity: '0.30',
        filter: 'url(#rimBlur)'
      }));

      /* lighter wash catching the light on the upper face */
      stone.appendChild(el('path', {
        d: stoneOutline(new Rng(Math.floor(y) * 31 + 13), x - rx * 0.13, y - ry * 0.28, rx * 0.62, ry * 0.44, rot),
        fill: '#8b8c8e', opacity: '0.34'
      }));

      /* speckles + a hairline crack, like the painting */
      var sp = rng.range(2, 5) | 0;
      for (var s = 0; s < sp; s++) {
        stone.appendChild(el('circle', {
          cx: (x + rng.range(-rx * 0.6, rx * 0.6)).toFixed(1),
          cy: (y + rng.range(-ry * 0.5, ry * 0.5)).toFixed(1),
          r: rng.range(1.1, 2.4).toFixed(1),
          fill: '#2b2b2c', opacity: rng.range(0.3, 0.6).toFixed(2)
        }));
      }

      /* a tuft of grass tucked against the near edge */
      if (rng.next() > 0.45) {
        var gx = x + rng.range(-rx * 0.8, rx * 0.8), gy = y + ry * rng.range(0.75, 1.05);
        stone.appendChild(el('path', {
          d: 'M' + gx.toFixed(1) + ' ' + gy.toFixed(1) +
             ' q' + rng.range(-3, 3).toFixed(1) + ' -7 ' + rng.range(-6, 6).toFixed(1) + ' -13',
          fill: 'none', stroke: '#1e2f14', 'stroke-width': '1.6', 'stroke-linecap': 'round',
          opacity: '0.75'
        }));
      }

      g.appendChild(stone);
    }

    svg.appendChild(g);
  }

  /* ==========================================================
     2. LOGO SLOTS — reveal the monogram when no PNG is present
     ========================================================== */
  Array.prototype.forEach.call(document.querySelectorAll('.logo-slot img'), function (img) {
    function fail() { img.classList.add('is-missing'); }
    img.addEventListener('error', fail);
    if (img.complete && img.naturalWidth === 0) fail();
  });

  /* ==========================================================
     3. SCROLL REVEAL
     ========================================================== */
  var cards = document.querySelectorAll('.card');
  if ('IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) { e.target.classList.add('is-in'); io.unobserve(e.target); }
      });
    }, { rootMargin: '0px 0px -12% 0px', threshold: 0.08 });
    Array.prototype.forEach.call(cards, function (c) { io.observe(c); });
  } else {
    Array.prototype.forEach.call(cards, function (c) { c.classList.add('is-in'); });
  }

  /* ==========================================================
     4. NAV — highlight the section you're actually in
     ========================================================== */
  var links = Array.prototype.slice.call(document.querySelectorAll('.nav-link'));
  var sections = links.map(function (a) { return document.querySelector(a.getAttribute('href')); });

  function syncNav() {
    var mid = window.scrollY + window.innerHeight * 0.35, best = 0;
    sections.forEach(function (s, i) { if (s && s.offsetTop <= mid) best = i; });
    links.forEach(function (a, i) { a.classList.toggle('is-active', i === best); });
  }

  /* ==========================================================
     5. THE BRAIN
     ========================================================== */
  var THOUGHTS = {
    keys: {
      title: 'Mechanical Keyboards',
      sub: 'building &middot; modding &middot; typing',
      body: [
        'I love mechanical keyboards &mdash; building them and modding them just as much as ' +
        'using them. Lubing stems, filming housings, tuning stabilizers, swapping foam until ' +
        'a board sounds exactly the way I want it to.',
        'I <em>hate</em> clicky switches. Linears are the only way. My current favorite is the ' +
        '<strong>Durock Ice King</strong> linear &mdash; smooth, deep, and completely worth the ' +
        'time it takes to build a board around them.'
      ],
      link: { href: 'https://keyonics.com', label: 'Visit keyonics.com' }
    },
    mind: {
      title: 'Something I&rsquo;ve Been Thinking About',
      sub: 'on people, and the why underneath',
      body: [
        'What is the real why behind whatever it is humans are doing? Are we truly operating out ' +
        'of passion or love, or are we being led by the perception of others around us? Do we ' +
        'really want to be the best for ourselves, or do we want to be the best because we want ' +
        'everyone else to think we are the best? Or maybe, its just not that deep.'
      ]
    },
    music: {
      title: 'Music',
      sub: 'always something playing',
      body: [
        'I love music and I listen to a <em>lot</em> of it &mdash; it is running in the background ' +
        'of almost everything I build.',
        'Favorite bands: <strong>U2</strong>, <strong>Coldplay</strong>, and ' +
        '<strong>The Neighbourhood</strong>. Favorite individual artists: ' +
        '<strong>Tory Lanez</strong>, <strong>Childish Gambino</strong>, and <strong>Sade</strong>.'
      ]
    }
  };

  var panel = document.getElementById('thought');
  var nodes = Array.prototype.slice.call(document.querySelectorAll('.node'));
  var current = null;
  var coarse = window.matchMedia && window.matchMedia('(hover: none)').matches;

  function render(key) {
    if (!panel || current === key) return;
    current = key;
    var t = THOUGHTS[key];
    if (!t) return;

    var html =
      '<h3 class="thought-title">' + t.title + '</h3>' +
      (t.sub ? '<p class="thought-sub">' + t.sub + '</p>' : '') +
      t.body.map(function (p) { return '<p class="thought-text">' + p + '</p>'; }).join('') +
      (t.link
        ? '<a class="thought-link" href="' + t.link.href + '" target="_blank" rel="noopener noreferrer">' +
            t.link.label +
            '<svg viewBox="0 0 24 24" width="13" height="13" aria-hidden="true">' +
              '<path d="M7 17 17 7M9 7h8v8" fill="none" stroke="currentColor" stroke-width="2.2" ' +
              'stroke-linecap="round" stroke-linejoin="round"/></svg>' +
          '</a>'
        : '');

    var inner = panel.querySelector('.thought-inner');
    inner.classList.add('is-swapping');
    window.setTimeout(function () {
      inner.innerHTML = html;
      inner.setAttribute('data-state', key);
      inner.classList.remove('is-swapping');
    }, 160);

    nodes.forEach(function (n) { n.classList.toggle('is-active', n.getAttribute('data-key') === key); });
  }

  nodes.forEach(function (node) {
    var key = node.getAttribute('data-key');
    node.addEventListener('mouseenter', function () { render(key); });
    node.addEventListener('focus', function () { render(key); });

    node.addEventListener('keydown', function (e) {
      /* the SVG <a> activates natively on Enter, and focusing it has already
         shown the description — so only the role=button nodes need handling.
         (An SVGAElement's .href is an SVGAnimatedString, not a URL string.) */
      if (node.tagName.toLowerCase() === 'a') return;
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        render(key);
      }
    });

    /* On touch screens there is no hover, so the first tap on the keyboard
       node shows its description instead of jumping straight to keyonics.com.
       The link inside the panel is then there to follow. */
    node.addEventListener('click', function (e) {
      if (coarse && node.tagName.toLowerCase() === 'a' && current !== key) {
        e.preventDefault();
        render(key);
      } else {
        render(key);
      }
    });
  });

  /* ==========================================================
     5b. PARALLAX
     The ground drifts slower than the content, which reads as depth.
     Two details matter here:
       - the eased value is the *scroll position*, not the wrapped offset.
         Easing a wrapped offset would animate backwards through a whole
         tile every time it crossed the seam.
       - the offset wraps at exactly one tile, so the layer never runs out
         of texture no matter how far down the page you are.
     ========================================================== */
  var bgTile  = document.querySelector('.bg-tile');
  var bgWash  = document.querySelector('.bg-wash');
  var heroArt = document.querySelector('.hero-art-img');
  var reduceMotion = window.matchMedia &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  var smoothY = window.scrollY || window.pageYOffset || 0;
  var rafId = null;

  function paintParallax() {
    if (bgTile) {
      bgTile.style.transform =
        'translate3d(0,' + (-((smoothY * 0.34) % 512)).toFixed(2) + 'px,0)';
    }
    if (bgWash) {
      bgWash.style.transform =
        'translate3d(0,' + (-((smoothY * 0.16) % 907)).toFixed(2) + 'px,0)';
    }
    if (heroArt && smoothY < window.innerHeight * 1.5) {
      /* capped so the drift can never exceed the layer's bleed */
      var d = Math.min(smoothY * 0.18, window.innerHeight * 0.22);
      heroArt.style.transform = 'translate3d(0,' + d.toFixed(2) + 'px,0)';
    }
  }

  function parallaxTick() {
    var target = window.scrollY || window.pageYOffset || 0;
    smoothY += (target - smoothY) * 0.14;
    if (Math.abs(target - smoothY) < 0.25) smoothY = target;
    paintParallax();
    rafId = (smoothY === target) ? null : window.requestAnimationFrame(parallaxTick);
  }

  function nudgeParallax() {
    if (reduceMotion) return;
    if (rafId === null) rafId = window.requestAnimationFrame(parallaxTick);
  }

  /* ==========================================================
     6. WIRING
     ========================================================== */
  function relayout() { drawPath(true); syncNav(); paintParallax(); }

  var ticking = false;
  window.addEventListener('scroll', function () {
    nudgeParallax();
    if (ticking) return;
    ticking = true;
    window.requestAnimationFrame(function () { syncNav(); ticking = false; });
  }, { passive: true });

  var resizeTimer;
  window.addEventListener('resize', function () {
    window.clearTimeout(resizeTimer);
    resizeTimer = window.setTimeout(relayout, 140);
  });

  /* the page grows as fonts and the hero image land, so redraw after each */
  window.addEventListener('load', relayout);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(relayout);
  if ('ResizeObserver' in window) {
    new ResizeObserver(function () { drawPath(); }).observe(document.body);
  }

  relayout();
})();
