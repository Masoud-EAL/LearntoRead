/* silent-tip.js: tell iPhone learners how to hear the words.

   With Silent mode on, an iPhone mutes the device voice that reads every
   word in WordLink, and no page can change that. The learner presses 🔊,
   hears nothing, and has no way to know why.

   Safari does not let a page read the silent switch, so the card waits for
   the sign of not hearing: the same button pressed for the same words twice
   within 10 seconds. Then, on an iPhone or iPad only, a small card says so,
   mostly in pictures: 🔕 ➜ 🔔, "Can't hear?".
   It can come back, in a game as much as on the page before it: once a
   visit was too few, because a learner who saw it on the home page and
   left Silent on heard nothing in every game after and was never told
   again. It waits 30 seconds between showings, and once the learner
   closes it with ✕ it does not come back that visit.
   Speech the app starts by itself (a word read out after Next, a question
   arriving in a class game) is not a press and is not counted; matching the
   button as well as the words keeps "Next reads the word, then Hear once"
   from looking like a repeat.

   speech.js calls window.wlSilentTip(text) for every word it speaks; the
   read-aloud buttons on the game and guide pages call it too. The card
   never blocks the page: it sits at the bottom, closes on a tap, and goes
   by itself. */
(function () {
  if (window.wlSilentTip) return;   // game.html also runs inside a game page

  var apple = /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  var KEY = 'wl_silent_tip_closed', AT = 'wl_silent_tip_at';
  /* Ten seconds, not five: a directions sentence takes longer than five to
     say, and a learner who heard nothing often waits about that long before
     trying again. */
  var REPEAT_MS = 10000, TAP_MS = 1000, AGAIN_MS = 30000;
  var lastShown = 0, closedHere = false;
  var lastTap = null;    // { el, t }: the last thing tapped
  var lastPress = null;  // { el, text, t }: the last tap that asked for words

  // A tap on the letter or the label inside a card is a tap on the card: the
  // same list of tappable things the pages give their touch styles to.
  var TAPPABLE = 'button, a, .alpha-card, .tappable, [onclick], [role="button"]';
  document.addEventListener('click', function (e) {
    var t = e.target;
    var el = (t && t.closest && t.closest(TAPPABLE)) || t;
    lastTap = { el: el, t: Date.now() };
  }, true);

  function store(k, v) { try { sessionStorage.setItem(k, v); } catch (e) {} }
  function read(k) { try { return sessionStorage.getItem(k); } catch (e) { return null; } }
  function tooSoon() {
    if (closedHere || read(KEY) === '1') return true;
    var at = Math.max(lastShown, parseInt(read(AT), 10) || 0);
    return Date.now() - at < AGAIN_MS;
  }
  function markShown() {
    lastShown = Date.now();
    store(AT, String(lastShown));
  }
  function markClosed() {
    closedHere = true;
    store(KEY, '1');
  }

  var css = [
    '.wl-silent-tip{position:fixed;left:50%;bottom:calc(84px + env(safe-area-inset-bottom,0px));z-index:9000;',
    '  transform:translate(-50%,16px);opacity:0;transition:opacity .25s,transform .25s;',
    '  display:flex;align-items:center;gap:14px;width:max-content;max-width:calc(100vw - 32px);',
    '  padding:12px 8px 12px 18px;border-radius:20px;background:#1d1b2e;color:#fff;',
    '  box-shadow:0 10px 30px rgba(0,0,0,.35);border:1px solid rgba(255,255,255,.14);',
    '  font-family:Nunito,system-ui,sans-serif;}',
    '.wl-silent-tip.show{opacity:1;transform:translate(-50%,0);}',
    '.wl-silent-tip .wl-st-icons{font-size:1.9rem;line-height:1;white-space:nowrap;}',
    '.wl-silent-tip .wl-st-text{font-size:1rem;font-weight:800;line-height:1.3;}',
    '.wl-silent-tip button{flex-shrink:0;width:44px;height:44px;border-radius:50%;border:none;',
    '  background:rgba(255,255,255,.12);color:#fff;font-size:1.1rem;cursor:pointer;}',
    '@media (prefers-reduced-motion: reduce){.wl-silent-tip{transition:none;}}'
  ].join('\n');

  function show() {
    if (!document.body) return;
    // It can show more than once now: one stylesheet, and one card at a time.
    if (!document.getElementById('wl-silent-tip-css')) {
      var style = document.createElement('style');
      style.id = 'wl-silent-tip-css';
      style.textContent = css;
      document.head.appendChild(style);
    }
    var old = document.querySelector('.wl-silent-tip');
    if (old && old.parentNode) old.parentNode.removeChild(old);

    var card = document.createElement('div');
    card.className = 'wl-silent-tip';
    card.setAttribute('role', 'status');
    var icons = document.createElement('span');
    icons.className = 'wl-st-icons';
    icons.setAttribute('aria-hidden', 'true');
    icons.textContent = '🔕 ➜ 🔔';
    var text = document.createElement('span');
    text.className = 'wl-st-text';
    text.textContent = "Can't hear? Turn off Silent mode.";
    var close = document.createElement('button');
    close.type = 'button';
    close.setAttribute('aria-label', 'Close');
    close.textContent = '✕';
    card.appendChild(icons); card.appendChild(text); card.appendChild(close);
    document.body.appendChild(card);

    var gone = false, timer = null;
    function hide() {
      if (gone) return;
      gone = true; clearTimeout(timer);
      card.classList.remove('show');
      setTimeout(function () { if (card.parentNode) card.parentNode.removeChild(card); }, 300);
    }
    card.addEventListener('click', hide);
    close.addEventListener('click', markClosed);
    requestAnimationFrame(function () { card.classList.add('show'); });
    timer = setTimeout(hide, 8000);
  }

  window.wlSilentTip = function (text) {
    if (!apple || tooSoon()) return;
    var now = Date.now();
    if (!lastTap || now - lastTap.t > TAP_MS) return;   // not from a press
    var press = { el: lastTap.el, text: String(text || ''), t: now };
    var prev = lastPress;
    lastPress = press;
    if (prev && prev.el === press.el && prev.text === press.text && press.t - prev.t <= REPEAT_MS) {
      lastPress = null;   // a third press is a fresh start, not another repeat
      markShown();
      show();
    }
  };
})();
