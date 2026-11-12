/* ==========================================================================
   Page behavior: nav, reveals, logos, email
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

  var progress = document.querySelector('.progress');

  var lastY = window.scrollY;
  var ticking = false;

  function update() {
    ticking = false;
    var y = window.scrollY;
    var vh = window.innerHeight;

    nav.classList.toggle('is-scrolled', y > 24);

    var room = root.scrollHeight - vh;
    if (progress) progress.style.setProperty('--progress', room > 0 ? Math.min(1, y / room).toFixed(4) : 0);

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
  }

  function requestUpdate() {
    if (!ticking) { ticking = true; window.requestAnimationFrame(update); }
  }
  window.addEventListener('scroll', requestUpdate, { passive: true });
  window.addEventListener('resize', requestUpdate);
  nav.addEventListener('focusin', function () { nav.classList.remove('is-hidden'); });
  update();

  /* ---------- a soft light that follows the mouse over project cards ------ */
  Array.prototype.forEach.call(document.querySelectorAll('.project'), function (card) {
    card.addEventListener('pointermove', function (e) {
      var r = card.getBoundingClientRect();
      card.style.setProperty('--mx', (e.clientX - r.left).toFixed(0) + 'px');
      card.style.setProperty('--my', (e.clientY - r.top).toFixed(0) + 'px');
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
  window.siteToast = showToast;   /* the essay reader uses it too */

  Array.prototype.forEach.call(document.querySelectorAll('.copy-email'), function (button) {
    button.addEventListener('click', function () {
      var email = button.getAttribute('data-email');
      if (navigator.clipboard && window.isSecureContext) {
        navigator.clipboard.writeText(email).then(
          function () {
            showToast('copied ' + email);
            button.classList.add('is-copied');
            window.clearTimeout(button._copiedTimer);
            button._copiedTimer = window.setTimeout(function () { button.classList.remove('is-copied'); }, 1600);
          },
          function () { window.location.href = 'mailto:' + email; }
        );
      } else {
        window.location.href = 'mailto:' + email;
      }
    });
  });
})();
