/* ==========================================================================
   My Brain: the essay list and the reader
   Essays live in /essays. The list comes from essays/index.json, and each
   essay's text comes from essays/<slug>.md. See essays/README.md.
   ========================================================================== */
(function () {
  'use strict';

  var list = document.getElementById('essay-list');
  var countEl = document.getElementById('essay-count');
  var reader = document.getElementById('reader');
  var backBtn = document.getElementById('reader-back');
  var metaEl = document.getElementById('reader-meta');
  var titleEl = document.getElementById('reader-title');
  var bodyEl = document.getElementById('reader-body');
  if (!list || !reader) return;

  var SLUG = /^[a-z0-9_-]+$/i;
  var baseTitle = document.title;
  var essays = [];
  var current = null;
  var returnFocus = null;
  var hideTimer = null;
  var loadingTimer = null;

  /* Show the progress bar only if the fetch is slow enough to notice. A local
     or cached essay arrives in a few milliseconds, and flashing a loading
     state for that long looks broken rather than responsive. */
  function startLoading() {
    window.clearTimeout(loadingTimer);
    bodyEl.setAttribute('aria-busy', 'true');
    loadingTimer = window.setTimeout(function () { reader.classList.add('is-loading'); }, 120);
  }
  function stopLoading() {
    window.clearTimeout(loadingTimer);
    reader.classList.remove('is-loading');
    bodyEl.setAttribute('aria-busy', 'false');
  }

  /* ---------- load the list ---------------------------------------------- */
  fetch('essays/index.json', { cache: 'no-cache' })
    .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
    .then(function (data) {
      essays = (Array.isArray(data) ? data : []).filter(function (e) {
        return e && typeof e.slug === 'string' && SLUG.test(e.slug);
      });
      renderList();
      syncWithUrl();
    })
    .catch(function () {
      note('Couldn’t load essays/index.json. If you opened index.html directly, run the local server instead (see README).');
    });

  function note(text) {
    list.innerHTML = '';
    var li = document.createElement('li');
    var p = document.createElement('p');
    p.className = 'essay-note label';
    p.textContent = text;
    li.appendChild(p);
    list.appendChild(li);
    countEl.textContent = '';
  }

  function span(className, text) {
    var s = document.createElement('span');
    s.className = className;
    s.textContent = text;
    return s;
  }

  function metaLine(e) {
    return [e.tag, e.date].filter(function (x) { return x && String(x).trim(); }).join(' · ');
  }

  function renderList() {
    if (!essays.length) { note('No essays yet.'); return; }
    var done = essays.filter(function (e) { return (e.title || '').trim(); }).length;
    var drafts = essays.length - done;
    countEl.textContent = done + ' published' + (drafts ? ' · ' + drafts + ' in the works' : '');
    list.innerHTML = '';

    essays.forEach(function (e, i) {
      var li = document.createElement('li');
      var row = document.createElement('button');
      row.type = 'button';
      row.className = 'essay-row';

      var title = (e.title || '').trim();
      if (!title) row.classList.add('is-draft');
      row.appendChild(span('essay-num label', String(i + 1).padStart(2, '0')));
      row.appendChild(span('essay-title' + (title ? '' : ' is-empty'), title || 'Untitled'));
      /* an essay without a title yet is still being written */
      row.appendChild(span('essay-meta label', metaLine(e) || (title ? '' : 'in the works')));
      var arrow = span('essay-arrow label', '→');
      arrow.setAttribute('aria-hidden', 'true');
      row.appendChild(arrow);

      row.setAttribute('data-slug', e.slug);
      row.addEventListener('click', function () { openEssay(e.slug, true, row); });
      li.appendChild(row);
      list.appendChild(li);
    });
  }

  /* ---------- open / close ------------------------------------------------ */
  function openEssay(slug, pushHistory, opener) {
    var e = essays.filter(function (x) { return x.slug === slug; })[0];
    if (!e) return;

    if (pushHistory) history.pushState({ essay: slug }, '', '#brain/' + slug);
    /* remember the row itself rather than document.activeElement: Safari
       doesn't focus a button when it's clicked, so that would just be <body> */
    if (current === null) returnFocus = opener || list.querySelector('[data-slug="' + slug + '"]');
    current = slug;

    var title = (e.title || '').trim();
    metaEl.textContent = metaLine(e);
    titleEl.textContent = title || 'Untitled';
    titleEl.classList.toggle('is-empty', !title);
    var barTitle = document.getElementById('reader-bar-title');
    if (barTitle) barTitle.textContent = title || 'Untitled';
    reader.classList.remove('is-past-title');
    bodyEl.innerHTML = '';
    document.title = (title || 'Untitled') + ' — Arav Shah';
    startLoading();
    showReader();

    fetch('essays/' + slug + '.md', { cache: 'no-cache' })
      .then(function (r) { return r.ok ? r.text() : ''; })
      .then(function (md) {
        if (current !== slug) return;              /* reader has moved on */
        stopLoading();
        md = md.trim();
        if (md) {
          var minutes = Math.max(1, Math.round(md.split(/\s+/).length / 230));
          metaEl.textContent = [metaLine(e), minutes + ' min read'].filter(Boolean).join(' · ');
        }
        bodyEl.innerHTML = md
          ? renderMarkdown(md)
          : '<p class="reader-empty">Nothing written here yet.</p>';
      })
      .catch(function () {
        if (current !== slug) return;
        stopLoading();
        bodyEl.innerHTML = '<p class="reader-empty">Couldn’t load this essay.</p>';
      });
  }

  function showReader() {
    window.clearTimeout(hideTimer);
    reader.hidden = false;
    reader.scrollTop = 0;
    reader.style.setProperty('--read', 0);
    document.documentElement.classList.add('reader-open');
    void reader.offsetWidth;          /* commit the un-hidden state so it fades in */
    reader.classList.add('is-open');
    backBtn.focus({ preventScroll: true });
  }

  function hideReader() {
    if (current === null) return;
    current = null;
    reader.classList.remove('is-open');
    document.documentElement.classList.remove('reader-open');
    document.title = baseTitle;
    stopLoading();
    hideTimer = window.setTimeout(function () { reader.hidden = true; bodyEl.innerHTML = ''; }, 520);
    if (returnFocus && returnFocus.focus) returnFocus.focus({ preventScroll: true });
    else if (reader.contains(document.activeElement)) document.activeElement.blur();
    returnFocus = null;
  }

  /* Closing walks history back when we opened the essay ourselves, so the
     browser's back button and ours always agree. A shared link has nothing
     to go back to, so it just lands you on My Brain. */
  function closeEssay() {
    if (history.state && history.state.essay) {
      history.back();
    } else {
      history.replaceState(null, '', '#brain');
      hideReader();
    }
  }

  function syncWithUrl() {
    var m = /^#brain[/]([a-z0-9_-]+)$/i.exec(location.hash);
    if (m) {
      if (current === m[1]) return;
      if (!history.state) {
        /* arrived from a shared link: put My Brain behind the reader */
        var brain = document.getElementById('brain');
        if (brain) brain.scrollIntoView({ behavior: 'instant', block: 'start' });
      }
      openEssay(m[1], false);
    } else {
      hideReader();
    }
  }

  /* fill the line under the bar as you read */
  var readTick = false;
  reader.addEventListener('scroll', function () {
    if (readTick) return;
    readTick = true;
    window.requestAnimationFrame(function () {
      readTick = false;
      var room = reader.scrollHeight - reader.clientHeight;
      reader.style.setProperty('--read', room > 0 ? Math.min(1, reader.scrollTop / room).toFixed(4) : 0);
      reader.classList.toggle('is-past-title', reader.scrollTop > titleEl.offsetTop + titleEl.offsetHeight - 40);
    });
  }, { passive: true });

  /* up and down arrows move between essays once one has focus */
  list.addEventListener('keydown', function (e) {
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
    var rows = Array.prototype.slice.call(list.querySelectorAll('.essay-row'));
    var i = rows.indexOf(document.activeElement);
    if (i < 0) return;
    e.preventDefault();
    var next = rows[Math.max(0, Math.min(rows.length - 1, i + (e.key === 'ArrowDown' ? 1 : -1)))];
    next.focus();
  });

  /* copy a link straight to the open essay */
  var linkBtn = document.getElementById('reader-link');
  if (linkBtn) linkBtn.addEventListener('click', function () {
    var url = location.href;
    var say = function (m) { if (window.siteToast) window.siteToast(m); };
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(url).then(function () { say('link copied'); }, function () { say(url); });
    } else {
      say(url);
    }
  });

  /* A- / A+ in the reader bar; the choice is remembered for next time */
  var SIZES = [0.92, 1, 1.1, 1.22];
  var sizeAt = 1;
  try {
    var saved = localStorage.getItem('reader-size');
    if (saved !== null && !isNaN(+saved)) sizeAt = Math.max(0, Math.min(SIZES.length - 1, +saved));
  } catch (_) {}
  var sizeButtons = reader.querySelectorAll('[data-size]');
  function applySize() {
    reader.style.setProperty('--reader-scale', SIZES[sizeAt]);
    Array.prototype.forEach.call(sizeButtons, function (b) {
      var d = +b.getAttribute('data-size');
      b.disabled = d < 0 ? sizeAt === 0 : sizeAt === SIZES.length - 1;
    });
  }
  Array.prototype.forEach.call(sizeButtons, function (b) {
    b.addEventListener('click', function () {
      sizeAt = Math.max(0, Math.min(SIZES.length - 1, sizeAt + +b.getAttribute('data-size')));
      try { localStorage.setItem('reader-size', sizeAt); } catch (_) {}
      applySize();
    });
  });
  applySize();

  window.addEventListener('popstate', syncWithUrl);
  backBtn.addEventListener('click', closeEssay);
  var doneBtn = document.getElementById('reader-done');
  if (doneBtn) doneBtn.addEventListener('click', closeEssay);
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && current !== null) closeEssay();
  });
  /* keep keyboard focus inside the reader while it's open */
  document.addEventListener('focusin', function (e) {
    if (current !== null && !reader.contains(e.target)) backBtn.focus({ preventScroll: true });
  });

  /* ---------- a small, safe markdown renderer ----------------------------- */
  /* Supports paragraphs, # / ## / ### headings, **bold**, *italic*, `code`,
     [links](https://...), ![images](path), > quotes, - lists, 1. lists, and
     --- dividers. Text is escaped before any formatting is applied, so an
     essay can never inject HTML or scripts into the page. */
  function escapeHtml(s) {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function safeUrl(u) {
    var scheme = /^([a-z][a-z0-9+.-]*):/i.exec(u);
    if (scheme && !/^(https?|mailto)$/i.test(scheme[1])) return null;
    return u;
  }

  /* typewriter quotes to curly ones (didn't -> didn’t), leaving `code` alone */
  function smartQuotes(text) {
    return text.split(/(`[^`]+`)/).map(function (part, i) {
      if (i % 2) return part;
      return part
        .replace(/(^|[\s(\[\u2014-])'/g, '$1\u2018').replace(/'/g, '\u2019')
        .replace(/(^|[\s(\[\u2014-])"/g, '$1\u201c').replace(/"/g, '\u201d');
    }).join('');
  }

  function inline(text) {
    var s = escapeHtml(smartQuotes(text));

    /* pull code spans out first so nothing inside them gets formatted; the
       placeholder uses a raw "<", which escaped text can never contain */
    var codes = [];
    s = s.replace(/`([^`]+)`/g, function (_, c) { codes.push(c); return '<cs' + (codes.length - 1) + '>'; });

    s = s.replace(/!\[([^\]]*)\]\(([^)\s]+)\)/g, function (m, alt, src) {
      var u = safeUrl(src);
      return u ? '<img src="' + u + '" alt="' + alt + '" loading="lazy">' : m;
    });
    s = s.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, function (m, label, href) {
      var u = safeUrl(href);
      if (!u) return m;
      var external = /^https?:/i.test(u);
      return '<a href="' + u + '"' + (external ? ' target="_blank" rel="noopener noreferrer"' : '') + '>' + label + '</a>';
    });
    s = s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    s = s.replace(/(^|[^*])\*([^*\s][^*]*)\*/g, '$1<em>$2</em>');
    s = s.replace(/(^|[\s(])_([^_\s][^_]*)_/g, '$1<em>$2</em>');

    return s.replace(/<cs(\d+)>/g, function (_, i) { return '<code>' + codes[+i] + '</code>'; });
  }

  function renderMarkdown(src) {
    var out = [], para = [], quote = [], block = null;

    function flushPara() { if (para.length) { out.push('<p>' + inline(para.join(' ')) + '</p>'); para = []; } }
    function flushQuote() { if (quote.length) { out.push('<blockquote><p>' + inline(quote.join(' ')) + '</p></blockquote>'); quote = []; } }
    function flushList() {
      if (!block) return;
      out.push('<' + block.tag + '>' + block.items.map(function (item) {
        return '<li>' + inline(item) + '</li>';
      }).join('') + '</' + block.tag + '>');
      block = null;
    }
    function flushAll() { flushPara(); flushQuote(); flushList(); }
    function addItem(tag, item) {
      flushPara(); flushQuote();
      if (!block || block.tag !== tag) { flushList(); block = { tag: tag, items: [] }; }
      block.items.push(item);
    }

    src.split(/\r?\n/).forEach(function (raw) {
      var line = raw.trim(), m;
      if (!line) { flushAll(); return; }
      if ((m = /^(#{1,3})\s+(.+)$/.exec(line))) {
        flushAll();
        var level = m[1].length === 3 ? 3 : 2;   /* the essay title is the page's h1 */
        out.push('<h' + level + '>' + inline(m[2]) + '</h' + level + '>');
        return;
      }
      if (/^(-{3,}|\*{3,})$/.test(line)) { flushAll(); out.push('<hr>'); return; }
      if ((m = /^>\s?(.*)$/.exec(line))) { flushPara(); flushList(); quote.push(m[1]); return; }
      if ((m = /^[-*]\s+(.+)$/.exec(line))) { addItem('ul', m[1]); return; }
      if ((m = /^\d+[.)]\s+(.+)$/.exec(line))) { addItem('ol', m[1]); return; }
      flushQuote(); flushList();
      para.push(line);
    });
    flushAll();
    return out.join('\n');
  }
})();
