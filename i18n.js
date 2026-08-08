/* ══════════════════════════════════════════════════════════
   WordLink — shared first-language (L1) gloss support

   Adult pre-level learners often read their own language better
   than English, so every English word we teach can carry a gloss
   underneath it. This file owns loading translations/<lang>.json
   and the right-to-left / font handling that goes with it.

   Used by tracing.html. index.html still carries its own older
   inline copy of this logic (see its `onLangChange` / `tw`);
   migrating it here is safe but deliberately left for later so
   this file can land without touching the main learner app.

   Usage:
     WL_I18N.populateSelect(el);          // fill a <select>
     WL_I18N.setLang('vi');               // load + remember
     WL_I18N.tw('apple');                 // → 'quả táo'  ('' if none)
     WL_I18N.applyTo(el, WL_I18N.tw(w));  // text + dir + lang + font
     WL_I18N.onChange(fn);                // re-render when it loads
══════════════════════════════════════════════════════════ */
(function (global) {
  'use strict';

  var RTL_LANGS = { fa: 1, ur: 1, ar: 1 };

  /* Urdu gets Nastaliq; the rest fall back to the CSS default. */
  var LANG_FONT = {
    ur: "'Noto Nastaliq Urdu','Noto Sans Arabic',sans-serif",
    ar: "'Noto Sans Arabic',sans-serif",
    fa: "'Noto Sans Arabic',sans-serif",
    zh: "'Noto Sans SC',sans-serif",
    km: "'Noto Sans Khmer',sans-serif",
    my: "'Noto Sans Myanmar',sans-serif",
    hi: "'Noto Sans Devanagari',sans-serif",
    th: "'Noto Sans Thai',sans-serif",
    vi: 'sans-serif'
  };

  /* Language names in the language itself — a learner who can't yet
     read "Vietnamese" in English can still find "Tiếng Việt". */
  var LANG_NAMES = {
    vi: 'Tiếng Việt', fa: 'فارسی', ar: 'العربية', zh: '中文',
    hi: 'हिन्दी', ur: 'اردو', km: 'ខ្មែរ', my: 'မြန်မာ', th: 'ภาษาไทย'
  };

  /* localStorage throws in sandboxed iframes (chat previews) and some
     private-browsing modes. Fall back to memory so the app still runs. */
  var store = (function () {
    try {
      localStorage.setItem('__wl_i', '1');
      localStorage.removeItem('__wl_i');
      return {
        get: function (k) { return localStorage.getItem(k); },
        set: function (k, v) { localStorage.setItem(k, v); }
      };
    } catch (e) {
      var mem = {};
      return {
        get: function (k) { return k in mem ? mem[k] : null; },
        set: function (k, v) { mem[k] = v; }
      };
    }
  })();

  var data = null;      // parsed translations/<lang>.json
  var current = '';     // '' = English only
  var listeners = [];

  function emit() {
    for (var i = 0; i < listeners.length; i++) {
      try { listeners[i](); } catch (e) { /* one bad listener shouldn't stop the rest */ }
    }
  }

  /* Loading is best-effort by design: opened straight off the filesystem
     a fetch of a local JSON file is blocked, so glosses simply stay off
     and every English label still works. */
  function setLang(lang) {
    current = lang || '';
    store.set('wl_lang', current);
    if (!current) { data = null; emit(); return Promise.resolve(null); }
    return fetch('./translations/' + current + '.json', { cache: 'no-store' })
      .then(function (r) {
        if (!r.ok) throw new Error('HTTP ' + r.status);
        return r.json();
      })
      .then(function (json) {
        data = json;
        emit();
        return json;
      })
      .catch(function (err) {
        console.warn('Translation load failed:', err);
        data = null;
        emit();
        return null;
      });
  }

  function tw(word) {
    return (data && data.words && data.words[word]) || '';
  }

  function ts(sentence) {
    return (data && data.sentences && data.sentences[sentence]) || '';
  }

  function dir() { return RTL_LANGS[current] ? 'rtl' : 'ltr'; }
  function font() { return LANG_FONT[current] || ''; }

  /* Write a gloss into an element, carrying the script's direction,
     language tag and font with it. Empty text hides the element so a
     missing gloss leaves no dangling blank row. */
  function applyTo(el, text) {
    if (!el) return;
    el.textContent = text || '';
    el.style.display = text ? '' : 'none';
    if (!text) { el.removeAttribute('lang'); el.removeAttribute('dir'); return; }
    var d = dir();
    el.style.direction = d;
    el.setAttribute('lang', current);
    el.setAttribute('dir', d);
    var f = font();
    if (f) el.style.fontFamily = f;
  }

  function populateSelect(sel, includeEnglishOnly) {
    if (!sel) return;
    sel.innerHTML = '';
    if (includeEnglishOnly !== false) {
      var none = document.createElement('option');
      none.value = ''; none.textContent = 'English only';
      sel.appendChild(none);
    }
    Object.keys(LANG_NAMES).forEach(function (code) {
      var o = document.createElement('option');
      o.value = code; o.textContent = LANG_NAMES[code];
      sel.appendChild(o);
    });
    sel.value = current;
  }

  global.WL_I18N = {
    setLang: setLang,
    lang: function () { return current; },
    saved: function () { return store.get('wl_lang') || ''; },
    tw: tw,
    ts: ts,
    dir: dir,
    font: font,
    applyTo: applyTo,
    populateSelect: populateSelect,
    names: LANG_NAMES,
    onChange: function (fn) { if (typeof fn === 'function') listeners.push(fn); }
  };
})(window);
