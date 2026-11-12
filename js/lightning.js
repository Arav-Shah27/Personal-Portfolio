/* ==========================================================================
   Lightning, in pixels
   Three small touches built on pixelfx (pixelfx/, MIT), all in the site's
   own storm-gold so they read as part of the page rather than on top of it:

     1. the hero sky: now and then a distant bolt flickers down at the edges
        of the painting and the scene lights up with it. Click the sky and
        one comes down where you clicked.
     2. clicks: a tiny static pop wherever you click.
     3. the footer: a little ball of lightning wanders over the line.

   Effects live in pixelfx/src/fx/lightning/ (sky-bolt and static-pop were
   made for this site). Everything switches off under reduce-motion, and
   nothing draws while it's off screen or the tab is hidden.
   ========================================================================== */

if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) start();

async function start() {
  /* load after the page has settled, so none of this slows the first paint */
  await new Promise((r) => (window.requestIdleCallback ? requestIdleCallback(r, { timeout: 1500 }) : setTimeout(r, 600)));

  const [core, skyBolt, staticPop, ballLightning] = await Promise.all([
    import('../pixelfx/src/core/index.js'),
    import('../pixelfx/src/fx/lightning/sky-bolt.js'),
    import('../pixelfx/src/fx/lightning/static-pop.js'),
    import('../pixelfx/src/fx/lightning/ball-lightning.js'),
  ]);
  const { createFrame, clearFrame, createFx, composite } = core;
  const GOLD = skyBolt.STORM_GOLD;
  const GOLD_SPARKS = ['#ffffff', '#fff3cf', '#f0cf7a', '#a87a2a'];
  const seed = () => (Math.random() * 1e6) | 0;   /* the host picks seeds; effects stay deterministic */

  /* one shared clock: each touch registers a tick and the loop only runs
     while at least one of them has something to draw */
  const ticks = new Set();
  let raf = 0, last = 0;
  function loop(now) {
    const dt = last ? Math.min(0.05, (now - last) / 1000) : 1 / 60;
    last = now;
    for (const fn of [...ticks]) if (fn(dt) === false) ticks.delete(fn);
    raf = ticks.size ? requestAnimationFrame(loop) : 0;
    if (!raf) last = 0;
  }
  function run(fn) {
    ticks.add(fn);
    if (!raf && !document.hidden) raf = requestAnimationFrame(loop);
  }
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden && ticks.size && !raf) raf = requestAnimationFrame(loop);
  });

  /* a canvas holding an art-pixel frame, scaled up crisp by CSS */
  function surface(canvas, w, h) {
    canvas.width = w; canvas.height = h;
    const ctx = canvas.getContext('2d');
    return { canvas, ctx, frame: createFrame(w, h), img: ctx.createImageData(w, h) };
  }
  function paint(s) {
    composite(s.frame, s.img.data, null);
    s.ctx.putImageData(s.img, 0, 0);
  }

  /* the WebGL stage draws the hero's storm now; this is the fallback */
  if (!document.documentElement.classList.contains('has-stage')) heroSky();
  clickPops();
  footerBall();

  /* ---------- 1. the hero sky ------------------------------------------- */
  function heroSky() {
    const hero = document.querySelector('.hero');
    if (!hero) return;
    const narrow = window.matchMedia('(max-width: 700px)').matches;
    const S = narrow ? 2 : 3;                        /* css px per art px */
    const canvas = document.createElement('canvas');
    canvas.className = 'pixel-layer hero-sky';
    canvas.setAttribute('aria-hidden', 'true');
    hero.insertBefore(canvas, hero.querySelector('.hero-content'));

    let s = null, bolts = [], visible = true, timer = 0;
    const size = () => {
      const r = hero.getBoundingClientRect();
      s = surface(canvas, Math.ceil(r.width / S), Math.ceil(r.height / S));
    };
    size();
    window.addEventListener('resize', () => { size(); });

    new IntersectionObserver(([e]) => { visible = e.isIntersecting; }).observe(hero);

    function strike(x, toY, aimed) {
      const H = s.frame.h;
      /* ambient bolts stay in the sky; on a phone that's well above the name */
      const length = toY ?? H * (narrow ? 0.16 + Math.random() * 0.08 : 0.32 + Math.random() * 0.2);
      bolts.push(createFx(skyBolt, {
        x, y: -6, seed: seed(), palette: GOLD, length,
        lean: 0.18, thickness: aimed ? 1.15 : 0.9, light: aimed ? 1 : 0.8,
        aim: aimed ? 0 : null,
      }));
      run(tick);
    }

    function tick(dt) {
      clearFrame(s.frame);
      let flash = 0;
      bolts = bolts.filter((b) => {
        b.update(dt);
        if (b.done()) return false;
        b.draw(s.frame);
        flash = Math.max(flash, skyBolt.flash(b.t));
        return true;
      });
      paint(s);
      hero.style.setProperty('--flash', flash.toFixed(3));
      return bolts.length > 0;
    }

    /* ambient bolts: every 9 to 18 seconds, only at the edges of the
       painting so they never cross the name */
    function schedule(delay) {
      clearTimeout(timer);
      timer = setTimeout(() => {
        if (visible && !document.hidden) {
          const W = s.frame.w, left = Math.random() < 0.5;
          const x = left ? W * (0.05 + Math.random() * 0.17) : W * (0.78 + Math.random() * 0.17);
          strike(x);
        }
        schedule(9000 + Math.random() * 9000);
      }, delay);
    }
    schedule(3500);

    /* click the sky and it strikes there */
    let lastClick = 0;
    hero.addEventListener('click', (e) => {
      if (e.target.closest('a, button, .hero-lede, .hero-name, .hero-hello, .socials, .hero-meta')) return;
      const sel = window.getSelection && window.getSelection();
      if (sel && !sel.isCollapsed) return;
      const now = performance.now();
      if (now - lastClick < 650) return;
      lastClick = now;
      const r = hero.getBoundingClientRect();
      strike((e.clientX - r.left) / S, (e.clientY - r.top) / S + 6, true);
      schedule(12000);                               /* let the sky rest after */
    });
  }

  /* ---------- 2. a static pop on every click ---------------------------- */
  function clickPops() {
    const S = 2, [w, h] = staticPop.meta.size, [ox, oy] = staticPop.meta.origin;
    const pool = [];
    /* click, not pointerdown: on a phone a touch that starts a scroll
       shouldn't spark, and keyboard "clicks" (detail 0) have no position */
    document.addEventListener('click', (e) => {
      if (e.button !== 0 || e.detail === 0) return;
      pop(e.clientX, e.clientY);
    }, { passive: true });
    /* the rest of the page can spark too (a stop on the route lighting up) */
    window.sitePop = pop;

    function pop(cx, cy) {
      let slot = pool.find((p) => !p.fx);
      if (!slot) {
        if (pool.length >= 4) return;
        const canvas = document.createElement('canvas');
        canvas.className = 'pixel-layer pop';
        canvas.setAttribute('aria-hidden', 'true');
        canvas.style.width = w * S + 'px';
        canvas.style.height = h * S + 'px';
        document.body.appendChild(canvas);
        slot = { ...surface(canvas, w, h), fx: null };
        pool.push(slot);
      }
      slot.canvas.style.transform = `translate3d(${cx - ox * S}px, ${cy - oy * S}px, 0)`;
      slot.canvas.style.opacity = '1';
      slot.fx = createFx(staticPop, { x: ox, y: oy, seed: seed(), palette: GOLD, arcs: 3 + ((Math.random() * 2) | 0) });
      const mine = slot.fx;
      run(function tick(dt) {
        if (slot.fx !== mine) return false;          /* reused for a newer click */
        mine.update(dt);
        clearFrame(slot.frame);
        if (mine.done()) {
          slot.canvas.style.opacity = '0';
          slot.fx = null;
          return false;
        }
        mine.draw(slot.frame);
        paint(slot);
        return true;
      });
    }
  }

  /* ---------- 3. ball lightning over the footer line -------------------- */
  function footerBall() {
    const footer = document.querySelector('.footer');
    if (!footer) return;
    const S = 2, [w, h] = ballLightning.meta.size, [ox, oy] = ballLightning.meta.origin;
    const canvas = document.createElement('canvas');
    canvas.className = 'pixel-layer footer-ball';
    canvas.setAttribute('aria-hidden', 'true');
    canvas.style.width = w * S + 'px';
    canvas.style.height = h * S + 'px';
    /* the effect's floor sits exactly on the footer's top border */
    canvas.style.top = -(oy * S) + 'px';
    canvas.style.marginLeft = -(ox * S) + 'px';
    footer.appendChild(canvas);

    const s = surface(canvas, w, h);
    const fx = createFx(ballLightning, { x: ox, y: oy, seed: 9, palette: GOLD, sparks: GOLD_SPARKS, light: 0.8 });
    let visible = false;

    function tick(dt) {
      if (!visible) return false;
      fx.update(dt);
      clearFrame(s.frame);
      fx.draw(s.frame);
      paint(s);
      return true;
    }
    new IntersectionObserver(([e]) => {
      visible = e.isIntersecting;
      if (visible) run(tick);
    }, { rootMargin: '120px 0px' }).observe(footer);
  }
}
