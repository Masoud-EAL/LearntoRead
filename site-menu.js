/* site-menu.js: the ☰ menu from the home page, on the other pages too.

   The home page has a menu button in the top right corner. The other pages
   had none, so a learner who found their way around by that button lost it
   the moment they left the home page. This puts the same button in the same
   corner, opening the same list, and lets the phone's Back button close it.

   <script src="site-menu.js" data-theme="dark" defer></script>
   data-theme="dark" gives the button the glass look of the game pages; the
   list itself is the home page's, on every page. */
(function () {
  var me = document.currentScript;
  var dark = me && me.getAttribute('data-theme') === 'dark';

  var ITEMS = [
    ['🔤', 'Alphabet', 'index.html?section=alphabet'],
    ['✏️', 'Trace Letters', 'tracing.html'],
    ['🔊', 'Letter Sounds', 'index.html?section=sounds'],
    ['📖', 'Word Pronunciation 1', 'index.html?section=wp1'],
    ['📗', 'Word Pronunciation 2', 'index.html?section=wp2'],
    ['📝', 'Read Sentences: Beginner', 'index.html?section=sentences'],
    ['📚', 'Read Sentences: Elementary', 'index.html?section=sentences&level=1'],
    ['🗣️', 'Speaking Practice', 'index.html?section=speaking'],
    ['👩‍🏫', 'Teacher Games', 'game.html?mode=teacher'],
    ['🎮', 'One-Player Games', 'game.html?mode=solo'],
    ['ℹ️', 'About', 'about.html']
  ];

  var css = [
    '.sm-btn{position:fixed;top:12px;right:14px;z-index:100;width:48px;height:48px;border-radius:50%;',
    '  display:flex;align-items:center;justify-content:center;font-size:1.7rem;line-height:1;cursor:pointer;',
    '  background:#fff;border:2.5px solid #e8ddd2;color:#7a6f65;box-shadow:0 2px 10px rgba(0,0,0,.12);',
    '  font-family:sans-serif;padding:0;transition:all .15s;}',
    '.sm-btn:hover{border-color:#4a90d9;color:#4a90d9;}',
    '.sm-btn.sm-dark{background:rgba(13,13,26,.82);border:1px solid rgba(255,255,255,.14);color:rgba(255,255,255,.7);',
    '  box-shadow:none;-webkit-backdrop-filter:blur(6px);backdrop-filter:blur(6px);}',
    '.sm-btn.sm-dark:hover{color:#fff;background:rgba(40,40,70,.9);}',
    '.sm-overlay{display:none;position:fixed;inset:0;z-index:300;overflow-y:auto;background:#fdf6ec;padding:0 0 16px;}',
    '.sm-overlay.sm-open{display:block;}',
    '.sm-head{position:sticky;top:0;display:flex;align-items:center;gap:14px;padding:clamp(10px,1.6vh,18px) 20px;',
    '  background:linear-gradient(135deg,#4a90d9,#2baa8a);box-shadow:0 4px 16px rgba(74,144,217,.3);}',
    '.sm-close{width:44px;height:44px;border-radius:50%;border:none;background:rgba(255,255,255,.25);color:#fff;',
    '  font-size:1.5rem;cursor:pointer;display:flex;align-items:center;justify-content:center;flex-shrink:0;}',
    '.sm-head h2{margin:0;font-family:"Fredoka One",cursive;font-size:1.4rem;font-weight:400;color:#fff;line-height:1;}',
    '.sm-list{max-width:560px;margin:0 auto;padding:clamp(10px,1.6vh,20px) 16px 0;display:grid;gap:clamp(6px,1.1vh,12px);}',
    '.sm-item{display:flex;align-items:center;gap:14px;text-decoration:none;background:#fff;color:#2d2a26;',
    '  border:2.5px solid #e8ddd2;border-radius:14px;padding:clamp(9px,1.5vh,18px) 18px;',
    '  font-family:Nunito,sans-serif;font-size:clamp(1rem,2.5vh,1.15rem);font-weight:700;',
    '  box-shadow:0 2px 8px rgba(0,0,0,.07);}',
    '.sm-item:hover{border-color:#4a90d9;}',
    '.sm-icon{font-size:clamp(1.5rem,3.4vh,2rem);line-height:1;width:2.4rem;text-align:center;flex-shrink:0;}'
  ].join('\n');

  function build() {
    var style = document.createElement('style');
    style.textContent = css;
    document.head.appendChild(style);

    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'sm-btn' + (dark ? ' sm-dark' : '');
    btn.setAttribute('aria-label', 'Open menu');
    btn.title = 'Menu';
    btn.textContent = '☰';

    var ov = document.createElement('div');
    ov.className = 'sm-overlay';
    ov.setAttribute('role', 'dialog');
    ov.setAttribute('aria-label', 'Menu');
    var head = document.createElement('div');
    head.className = 'sm-head';
    var close = document.createElement('button');
    close.type = 'button';
    close.className = 'sm-close';
    close.setAttribute('aria-label', 'Close menu');
    close.textContent = '←';
    var h = document.createElement('h2');
    h.textContent = 'Menu';
    head.appendChild(close); head.appendChild(h);
    var list = document.createElement('nav');
    list.className = 'sm-list';
    ITEMS.forEach(function (it) {
      var a = document.createElement('a');
      a.className = 'sm-item';
      a.href = it[2];
      var ic = document.createElement('span');
      ic.className = 'sm-icon'; ic.setAttribute('aria-hidden', 'true'); ic.textContent = it[0];
      a.appendChild(ic);
      a.appendChild(document.createTextNode(it[1]));
      list.appendChild(a);
    });
    ov.appendChild(head); ov.appendChild(list);

    /* On a game start page the button lives in the page's header, so it goes
       away with the header when the game starts in the page. */
    var bar = document.querySelector('body > .gp-bar');
    (bar || document.body).appendChild(btn);
    document.body.appendChild(ov);

    /* Back closes the menu, as it does on the home page: opening it adds one
       history entry, and closing it with the arrow takes that entry off. */
    var entry = false, skip = false;
    function open() {
      ov.classList.add('sm-open');
      document.body.style.overflow = 'hidden';
      try { history.pushState({ smMenu: 1 }, ''); entry = true; } catch (e) {}
    }
    function shut(fromBack) {
      ov.classList.remove('sm-open');
      document.body.style.overflow = '';
      if (!fromBack && entry) {
        entry = false; skip = true;
        try { history.back(); } catch (e) { skip = false; }
      }
    }
    btn.addEventListener('click', open);
    close.addEventListener('click', function () { shut(false); });
    window.addEventListener('popstate', function () {
      if (skip) { skip = false; return; }
      if (entry) { entry = false; shut(true); }
    });
    /* Leaving by a menu link keeps the menu's entry in the history. If this
       page is then loaded afresh rather than restored as it was, the entry
       has no open menu behind it, and Back would seem to do nothing: step
       off it quietly. */
    if (history.state && history.state.smMenu && !ov.classList.contains('sm-open')) {
      skip = true;
      try { history.back(); } catch (e) { skip = false; }
    }
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && ov.classList.contains('sm-open')) shut(false);
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', build);
  else build();
})();
