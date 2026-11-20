/* silent-tip.js: tell iPhone learners how to hear the words.

   With Silent mode on, an iPhone mutes the device voice that reads every
   word in WordLink, and no page can change that. The learner presses 🔊,
   hears nothing, and has no way to know why. So on an iPhone or iPad, the
   first time a play button is pressed in a visit, a small card says so,
   mostly in pictures: 🔕 ➜ 🔔. The page cannot tell whether Silent mode is
   actually on, so the card says "Can't hear?" rather than "you are on
   silent", and it shows once per visit, never on every press.

   speech.js calls window.wlSilentTip() for every word it speaks; the
   read-aloud buttons on the game and guide pages call it too. The card
   never blocks the page: it sits at the bottom, closes on a tap, and goes
   by itself. */
(function () {
  if (window.wlSilentTip) return;   // game.html also runs inside a game page

  var apple = /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  var KEY = 'wl_silent_tip_shown';
  var shownHere = false;

  function alreadyShown() {
    if (shownHere) return true;
    try { return sessionStorage.getItem(KEY) === '1'; } catch (e) { return false; }
  }
  function markShown() {
    shownHere = true;
    try { sessionStorage.setItem(KEY, '1'); } catch (e) {}
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
    var style = document.createElement('style');
    style.textContent = css;
    document.head.appendChild(style);

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
    requestAnimationFrame(function () { card.classList.add('show'); });
    timer = setTimeout(hide, 8000);
  }

  window.wlSilentTip = function () {
    if (!apple || alreadyShown()) return;
    markShown();
    show();
  };
})();
