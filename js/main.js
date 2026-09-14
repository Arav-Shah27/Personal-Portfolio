/* ==========================================================================
   Page behavior: nav, hero parallax, reveals, logos, email
   ========================================================================== */
(function () {
  'use strict';

  var root = document.documentElement;
  var reduceMotion = window.matchMedia &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------- logos: fall back to the monogram when a file is missing ---- */
  Array.prototype.forEach.call(document.querySelectorAll('.logo img'), function (img) {
    function missing() { img.classList.add('is-missing'); }
    img.addEventListener('error', missing);
    if (img.complete && img.naturalWidth === 0) missing();
  });

  /* ---------- reveal on scroll ------------------------------------------- */
  /* The stagger lives here rather than in a CSS transition-delay, because a
     delay on the element would also slow down its hover transitions later. */
  var revealables = document.querySelectorAll('.reveal');
  function revealAll() {
    Array.prototype.forEach.call(revealables, function (el) { el.classList.add('is-in'); });
  }
  if (reduceMotion || !('IntersectionObserver' in window)) {
    revealAll();
  } else {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        var el = entry.target;
        var step = parseFloat(el.style.getPropertyValue('--d')) || 0;
        window.setTimeout(function () { el.classList.add('is-in'); }, step * 120);
        io.unobserve(el);
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.12 });
    Array.prototype.forEach.call(revealables, function (el) { io.observe(el); });
  }

  /* ---------- nav + hero, driven by one throttled scroll handler ---------- */
  var nav = document.getElementById('nav');
  var links = Array.prototype.slice.call(nav.querySelectorAll('.nav-links a'));
  var sections = links.map(function (a) { return document.getElementById(a.getAttribute('data-section')); });

  var heroImg = document.querySelector('.hero-img');
  var heroContent = document.querySelector('.hero-content');
  var scrollHint = document.querySelector('.scroll-hint');

  var lastY = window.scrollY;
  var ticking = false;

  function update() {
    ticking = false;
    var y = window.scrollY;
    var vh = window.innerHeight;

    nav.classList.toggle('is-scrolled', y > 24);

    /* tuck the nav away while reading downward, bring it back on the way up */
    if (Math.abs(y - lastY) > 6) {
      var goingDown = y > lastY;
      nav.classList.toggle('is-hidden', goingDown && y > vh * 0.6 && !nav.contains(document.activeElement));
      lastY = y;
    }

    var probe = y + vh * 0.4, active = 0;
    sections.forEach(function (s, i) { if (s && s.offsetTop <= probe) active = i; });
    if (vh + y >= root.scrollHeight - 2) active = sections.length - 1;
    links.forEach(function (a, i) { a.classList.toggle('is-active', i === active); });

    /* the painting drifts slower than the page and the name eases back into
       it, which is where the sense of depth comes from */
    if (!reduceMotion && y < vh * 1.25) {
      heroImg.style.transform = 'translate3d(0,' + (y * 0.38).toFixed(1) + 'px,0)';
      var p = Math.min(1, y / (vh * 0.75));
      heroContent.style.transform = 'translate3d(0,' + (y * 0.14).toFixed(1) + 'px,0)';
      heroContent.style.opacity = (1 - p * 0.92).toFixed(3);
      scrollHint.style.opacity = Math.max(0, 1 - y / 160).toFixed(3);
    }
  }

  function requestUpdate() {
    if (!ticking) { ticking = true; window.requestAnimationFrame(update); }
  }
  window.addEventListener('scroll', requestUpdate, { passive: true });
  window.addEventListener('resize', requestUpdate);
  nav.addEventListener('focusin', function () { nav.classList.remove('is-hidden'); });
  update();

  /* ---------- project cards: light follows the pointer ------------------- */
  Array.prototype.forEach.call(document.querySelectorAll('.project'), function (card) {
    card.addEventListener('pointermove', function (e) {
      var r = card.getBoundingClientRect();
      card.style.setProperty('--mx', (e.clientX - r.left) + 'px');
      card.style.setProperty('--my', (e.clientY - r.top) + 'px');
    });
  });

  /* ---------- toast + copy email ----------------------------------------- */
  var toast = document.getElementById('toast');
  var toastTimer = null;
  function showToast(message) {
    toast.textContent = message;
    toast.classList.add('is-shown');
    window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(function () { toast.classList.remove('is-shown'); }, 2000);
  }

  Array.prototype.forEach.call(document.querySelectorAll('.copy-email'), function (button) {
    button.addEventListener('click', function () {
      var email = button.getAttribute('data-email');
      if (navigator.clipboard && window.isSecureContext) {
        navigator.clipboard.writeText(email).then(
          function () { showToast('copied ' + email); },
          function () { window.location.href = 'mailto:' + email; }
        );
      } else {
        window.location.href = 'mailto:' + email;
      }
    });
  });
})();
