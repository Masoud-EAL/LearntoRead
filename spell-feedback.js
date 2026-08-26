/* ══════════════════════════════════════════════════════════════════════
   spell-feedback.js — deciding whether a spelling is right, and showing
   the learner where it went wrong.

   Loaded as a classic script by both index.html and game.html (like
   phonics.js and i18n.js), so the two spelling surfaces agree on what
   counts as correct and draw their feedback the same way.

   Two problems live here.

   The first is that the sentence practice used to compare the learner's
   typing to the answer character for character. "I spell my name
   D-A-V-I-D." was only accepted with all four hyphens, both capitals and
   the final full stop — a learner who typed every letter correctly was
   told they were wrong, with nothing to say the problem was punctuation.
   spellMatch() answers with three outcomes instead of two so that a
   right spelling is never called a mistake.

   The second is that a merged inline diff cannot express *where* a word
   went wrong to someone who cannot yet read the diff. alignSpelling()
   and renderSpellSlots() put the answer and the attempt in two rows, one
   column per part of the word, so "where" is carried by position, and
   every part of the answer is a button that plays its own sound.
══════════════════════════════════════════════════════════════════════ */

/* ══════════════════════════════════════════
   NORMALISING WHAT THE LEARNER TYPED
══════════════════════════════════════════ */

/* Phone keyboards produce characters the word banks never contain: a
   curly apostrophe for a straight one, an en dash for a hyphen. None of
   those are spelling mistakes, so they are folded before anything else
   looks at the text. */
const SPELL_DASHES  = /[‐‑‒–—―−­]/g;
const SPELL_SQUOTES = /[‘’‚‛′]/g;
const SPELL_DQUOTES = /[“”„‟″]/g;

/* Everything that is not a letter, a digit or a space. Unicode property
   escapes keep accented letters — a learner writing their own name should
   not have it stripped — with an ASCII-plus-Latin-1 fallback for engines
   that predate them. */
let SPELL_NOT_ALNUM;
try { SPELL_NOT_ALNUM = new RegExp('[^\\p{L}\\p{N}\\s]', 'gu'); }
catch (e) { SPELL_NOT_ALNUM = /[^A-Za-z0-9À-ɏ\s]/g; }

let SPELL_IS_ALNUM;
try { SPELL_IS_ALNUM = new RegExp('[\\p{L}\\p{N}]', 'u'); }
catch (e) { SPELL_IS_ALNUM = /[A-Za-z0-9À-ɏ]/; }

function spellIsAlnum(ch) { return SPELL_IS_ALNUM.test(ch); }

/* The text as written, with the keyboard's substitutes folded back and
   runs of whitespace collapsed. Case and punctuation survive — this is
   what an exact match is measured against. */
function spellTidy(s) {
  s = (s === null || s === undefined) ? '' : String(s);
  if (s.normalize) s = s.normalize('NFC');
  return s.replace(SPELL_DASHES, '-')
          .replace(SPELL_SQUOTES, "'")
          .replace(SPELL_DQUOTES, '"')
          .replace(/\s+/g, ' ')
          .trim();
}

/* The letters and digits, lowercase, with word gaps kept. Two strings
   with the same letter form are the same spelling; they differ only in
   capitals and punctuation. */
function spellLetterForm(s) {
  return spellTidy(s).toLowerCase().replace(SPELL_NOT_ALNUM, '').replace(/\s+/g, ' ').trim();
}

/* The same thing with the word gaps taken out too, for asking whether
   the only difference left is where the spaces fall. */
function spellCore(s) { return spellLetterForm(s).replace(/ /g, ''); }

/* Where the answer breaks between one group of letters and the next,
   counted in letters rather than characters so two strings holding the
   same letters can have their breaks compared.

   A break written as a space is 'hard': the answer says these are two
   words, and running them together is a real mistake. A break written as
   a mark — the hyphens in "D-A-V-I-D", the one in "three-bedroom" — is
   'soft', and the learner may write it as a hyphen, as a space, or as
   nothing at all. That is the whole of the reported bug: spelling a name
   out loud has no one right punctuation, and the app was insisting on
   one. */
function spellBoundaries(s) {
  const hard = new Set(), soft = new Set();
  const t = spellTidy(s);
  let i = 0, n = 0;
  while (i < t.length) {
    if (spellIsAlnum(t.charAt(i))) { n++; i++; continue; }
    let j = i, hasSpace = false;
    while (j < t.length && !spellIsAlnum(t.charAt(j))) { if (t.charAt(j) === ' ') hasSpace = true; j++; }
    if (n > 0 && j < t.length) (hasSpace ? hard : soft).add(n);
    i = j;
  }
  return { hard: hard, soft: soft };
}

/* How many word boundaries the two disagree about. A hard break in the
   answer that the learner did not make counts; so does a break they made
   where the answer has none. A soft break they wrote differently — or
   not at all — is free. Both sides must already hold the same letters. */
function spellGapDiff(answer, typed) {
  const A = spellBoundaries(answer), T = spellBoundaries(typed);
  const anywhere = new Set();
  A.hard.forEach(p => anywhere.add(p));
  A.soft.forEach(p => anywhere.add(p));
  let d = 0;
  A.hard.forEach(p => { if (!T.hard.has(p) && !T.soft.has(p)) d++; });
  T.hard.forEach(p => { if (!anywhere.has(p)) d++; });
  T.soft.forEach(p => { if (!anywhere.has(p)) d++; });
  return d;
}

/* ══════════════════════════════════════════
   IS IT RIGHT?

   'exact'  — written exactly as the answer is written.
   'almost' — every letter and digit correct and in order, but the
              capitals, the punctuation, or at most one word gap differ.
              This counts as correct: the learner advances and scores.
              It is marked rather than forgiven silently, so the marks
              they left out are still something they can see.
   'wrong'  — a letter or digit is different, or more than one word gap
              is missing. Running a whole sentence together is a real
              error; leaving out one space is a slip.

   Contractions are deliberately not folded. "I'm" and "I am" are
   different sentences, and expanding the apostrophe would break the
   possessive that the letter form already handles correctly — both
   "teacher's" and "teachers" reduce to "teachers".

   accepts is an optional list of alternative answers, so a sentence can
   be given genuine alternates as data without this logic changing.
══════════════════════════════════════════ */
function spellMatch(typed, answer, accepts) {
  const t = spellTidy(typed);
  if (!t) return 'wrong';
  const candidates = [answer].concat(accepts || []);

  for (const c of candidates) if (t === spellTidy(c)) return 'exact';

  const tl = spellLetterForm(t);
  for (const c of candidates) if (tl && tl === spellLetterForm(c)) return 'almost';

  const tc = spellCore(t);
  for (const c of candidates) {
    if (tc && tc === spellCore(c) && spellGapDiff(c, t) <= 1) return 'almost';
  }
  return 'wrong';
}

/* ══════════════════════════════════════════
   ALIGNMENT

   One Needleman–Wunsch over a pair of sequences, used for letters inside
   a word and for words inside a sentence. Substitution is a real
   operation here, which the old character diff had no way to express: it
   was built on a longest-common-subsequence, so "cet" for "cat" came out
   as a match, a deletion, an insertion and a match — four marks for one
   mistake, in an order matching nothing the learner did.
══════════════════════════════════════════ */
function spellAlignSeq(A, B, eq) {
  eq = eq || ((a, b) => a === b);
  const m = A.length, n = B.length;
  const dp = [];
  for (let i = 0; i <= m; i++) {
    dp[i] = [];
    for (let j = 0; j <= n; j++) dp[i][j] = i === 0 ? j : j === 0 ? i : 0;
  }
  for (let i = 1; i <= m; i++)
    for (let j = 1; j <= n; j++)
      dp[i][j] = eq(A[i - 1], B[j - 1])
        ? dp[i - 1][j - 1]
        : 1 + Math.min(dp[i - 1][j - 1], dp[i - 1][j], dp[i][j - 1]);

  const ops = [];
  let i = m, j = n;
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && eq(A[i - 1], B[j - 1])) { ops.unshift({ t: 'ok', a: i - 1, b: j - 1 }); i--; j--; }
    else if (i > 0 && j > 0 && dp[i][j] === dp[i - 1][j - 1] + 1) { ops.unshift({ t: 'sub', a: i - 1, b: j - 1 }); i--; j--; }
    else if (j > 0 && (i === 0 || dp[i][j] === dp[i][j - 1] + 1)) { ops.unshift({ t: 'ins', b: j - 1 }); j--; }
    else { ops.unshift({ t: 'del', a: i - 1 }); i--; }
  }
  return ops;
}

/* How a word is built out of parts. phonics.js already maps every word in
   both banks to its graphemes and their recordings, so "sh" in ship is
   one part with one sound rather than two letters with none. Anything the
   map does not know falls back to single letters. */
function spellUnitsForWord(word) {
  const tiles = (typeof phonicsTiles === 'function') ? phonicsTiles(word) : null;
  if (tiles) {
    const joined = tiles.map(t => t.d).join('');
    if (joined.toLowerCase() === word.toLowerCase()) {
      const out = [];
      let p = 0;
      tiles.forEach(t => {
        out.push({ text: word.slice(p, p + t.d.length), sound: { w: t.w || null, tts: t.tts || null } });
        p += t.d.length;
      });
      return out;
    }
  }
  return word.split('').map(ch => ({ text: ch, sound: null }));
}

/* One word, part by part. Insertions carry no answer index, so a running
   count of the answer characters already consumed says which column an
   extra letter fell after. */
function spellAlignChunks(answer, typed, outcome) {
  const a = spellTidy(answer), b = spellTidy(typed);
  const units = spellUnitsForWord(a);
  const owner = [];
  units.forEach((u, k) => { for (let i = 0; i < u.text.length; i++) owner.push(k); });

  const cols = units.map(u => ({
    want: u.text, got: '', state: 'ok', sound: u.sound, clean: true
  }));
  const extras = [];
  let seen = 0;

  spellAlignSeq(a.split(''), b.split(''), (x, y) => x.toLowerCase() === y.toLowerCase())
    .forEach(op => {
      if (op.t === 'ins') {
        const k = seen < owner.length ? owner[seen] : units.length;
        extras.push({ after: k - 1, text: b.charAt(op.b) });
        return;
      }
      const col = cols[owner[op.a]];
      seen++;
      if (!col) return;
      if (op.t === 'del') { col.clean = false; return; }
      col.got += b.charAt(op.b);
      if (op.t === 'sub') col.clean = false;
    });

  cols.forEach(c => {
    if (!c.got) c.state = 'missing';
    else if (!c.clean) c.state = 'wrong';
    else c.state = (c.got === c.want) ? 'ok' : 'punct';
  });

  return { mode: 'chunk', answer: a, typed: b, units: cols, extras: extras, outcome: outcome };
}

/* A sentence where the letters are all there and only the gaps moved.
   Cutting the typing at the answer's own word boundaries shows the
   learner which gap they left out, instead of reporting one wrong word
   and one missing word for a single missing space. */
function spellSliceByWords(answer, typed) {
  const words = spellTidy(answer).split(' ');
  const t = spellTidy(typed);
  const cols = [];
  let i = 0;
  words.forEach((word, k) => {
    const need = spellCore(word).length;
    let got = '', n = 0, gap = false;
    while (i < t.length && !spellIsAlnum(t.charAt(i))) {
      if (t.charAt(i) === ' ') gap = true; else got += t.charAt(i);
      i++;
    }
    while (i < t.length && n < need) {
      const ch = t.charAt(i);
      if (spellIsAlnum(ch)) { got += ch; n++; }
      else if (ch !== ' ') got += ch;
      i++;
    }
    cols.push({ want: word, got: got, sound: null, joinedToPrev: k > 0 && !gap });
  });
  if (i < t.length && cols.length) cols[cols.length - 1].got += t.slice(i).replace(/ /g, '');
  cols.forEach(c => { c.state = (c.got === c.want) ? 'ok' : 'punct'; });
  return cols;
}

/* A sentence, word by word. */
function spellAlignWords(answer, typed, outcome) {
  const a = spellTidy(answer), b = spellTidy(typed);

  if (outcome === 'almost' && spellLetterForm(a) !== spellLetterForm(b) && spellCore(a) === spellCore(b)) {
    return { mode: 'word', answer: a, typed: b, units: spellSliceByWords(a, b), extras: [], outcome: outcome };
  }

  const aw = a ? a.split(' ') : [], bw = b ? b.split(' ') : [];
  const cols = [], extras = [];
  spellAlignSeq(aw, bw, (x, y) => spellCore(x) === spellCore(y)).forEach(op => {
    if (op.t === 'ins') { extras.push({ after: cols.length - 1, text: bw[op.b] }); return; }
    if (op.t === 'del') { cols.push({ want: aw[op.a], got: '', state: 'missing', sound: null }); return; }
    const want = aw[op.a], got = bw[op.b];
    cols.push({
      want: want, got: got, sound: null,
      state: got === want ? 'ok' : spellCore(got) === spellCore(want) ? 'punct' : 'wrong'
    });
  });
  return { mode: 'word', answer: a, typed: b, units: cols, extras: extras, outcome: outcome };
}

/* The answer and the attempt, lined up. mode is chosen from the answer
   itself unless the caller knows better. */
function alignSpelling(answer, typed, opts) {
  opts = opts || {};
  const mode = opts.mode || (/\s/.test(spellTidy(answer)) ? 'word' : 'chunk');
  const outcome = opts.outcome || spellMatch(typed, answer, opts.accepts);
  return mode === 'word'
    ? spellAlignWords(answer, typed, outcome)
    : spellAlignChunks(answer, typed, outcome);
}

/* ══════════════════════════════════════════
   DRAWING IT

   Two rows, one column per part of the answer. Position is what carries
   "where" — a single merged line of coloured letters cannot say it to
   someone who cannot yet read the line.

   No state is told by colour alone. Every column carries a badge shape
   as well: a filled tick for right, a hollow tick for right letters with
   the marks left out, a cross for wrong, a plus for a part that is
   missing altogether. The page supplies the palette; this only supplies
   the classes, because the two pages are deliberately different colours.
══════════════════════════════════════════ */
const SPELL_BADGE = { ok: '✓', punct: '✓', wrong: '✗', missing: '＋', extra: '✗', blank: '' };

function spellEsc(s) {
  return String(s === null || s === undefined ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/* The answer with the parts the learner left out picked out faintly —
   the hyphens they skipped, the capital they wrote small, the full stop
   that never arrived. Only used for the 'almost' state, where every
   letter is already correct. */
function spellMarkHtml(want, got) {
  let out = '', j = 0;
  for (let i = 0; i < want.length; i++) {
    const ch = want.charAt(i);
    if (spellIsAlnum(ch)) {
      while (j < got.length && !spellIsAlnum(got.charAt(j))) j++;
      const g = got.charAt(j);
      out += (g && g !== ch) ? '<span class="sf-mark">' + spellEsc(ch) + '</span>' : spellEsc(ch);
      j++;
    } else {
      if (got.charAt(j) === ch) { out += spellEsc(ch); j++; }
      else out += '<span class="sf-mark">' + spellEsc(ch) + '</span>';
    }
  }
  return out;
}

function spellLabel(u) {
  if (u.state === 'blank') return u.want ? 'part of the word' : 'empty';
  if (u.state === 'ok') return 'correct';
  if (u.state === 'punct') return 'letters correct, marks missing: ' + u.want;
  if (u.state === 'missing') return 'missing: ' + u.want;
  if (u.state === 'extra') return 'extra: ' + u.got;
  return 'wrong — should be ' + u.want;
}

function spellShown(reveal, k) {
  if (reveal === 'all' || reveal === undefined) return true;
  if (reveal === 'none') return false;
  if (Array.isArray(reveal)) return reveal.indexOf(k) !== -1;
  if (reveal && typeof reveal.has === 'function') return reveal.has(k);
  return true;
}

/* opts:
     reveal   'all' (default) | 'none' | array/Set of unit indices to show
     showGot  false to draw only the answer row — the empty shape of the
              word, before the learner has tried
     speak    fn(unit, el) called when a part of the answer is tapped
     tapGot   fn(index) called when a slot in the attempt row is tapped —
              this is how a placed tile is taken back out again */
function renderSpellSlots(container, al, opts) {
  opts = opts || {};
  const showGot = opts.showGot !== false;
  container.innerHTML = '';
  container.className = 'sf-wrap' + (opts.mode === 'word' || al.mode === 'word' ? ' sf-word-mode' : '');
  container.setAttribute('role', 'status');
  container.setAttribute('aria-live', 'polite');

  const row = document.createElement('div');
  row.className = 'sf-rows';

  const addExtras = k => {
    (al.extras || []).forEach(e => {
      if (e.after !== k) return;
      row.appendChild(spellColEl({ want: '', got: e.text, state: 'extra', sound: null }, -1, opts, showGot));
    });
  };

  addExtras(-1);
  al.units.forEach((u, k) => {
    if (u.joinedToPrev) {
      const gap = document.createElement('div');
      gap.className = 'sf-gap';
      gap.innerHTML = '<span class="sf-gap-mark">␣</span>';
      gap.setAttribute('aria-label', 'missing space');
      row.appendChild(gap);
    }
    row.appendChild(spellColEl(u, k, opts, showGot));
    addExtras(k);
  });

  container.appendChild(row);
  return container;
}

function spellColEl(u, k, opts, showGot) {
  const col = document.createElement('div');
  col.className = 'sf-col' + (u.state === 'extra' ? ' sf-col-extra' : '');
  col.setAttribute('data-state', u.state);

  const shown = u.state === 'extra' ? true : spellShown(opts.reveal, k);
  const want = document.createElement(opts.speak && u.state !== 'extra' ? 'button' : 'div');
  want.className = 'sf-slot sf-want' + (shown ? '' : ' sf-hidden');
  if (want.tagName === 'BUTTON') want.type = 'button';
  if (shown) {
    want.innerHTML = u.state === 'punct' ? spellMarkHtml(u.want, u.got) : spellEsc(u.want);
  }
  want.setAttribute('aria-label', shown ? spellLabel(u) : 'hidden');
  if (opts.speak && u.state !== 'extra') {
    want.onclick = () => opts.speak(u, want);
  }
  col.appendChild(want);

  const badge = document.createElement('span');
  badge.className = 'sf-badge';
  badge.setAttribute('aria-hidden', 'true');
  badge.textContent = SPELL_BADGE[u.state] || '';
  if (showGot) col.appendChild(badge);

  if (showGot) {
    const tappable = opts.tapGot && u.state !== 'extra' && k >= 0;
    const got = document.createElement(tappable ? 'button' : 'div');
    got.className = 'sf-slot sf-got' + (tappable ? ' sf-got-tap' : '') + (u.got ? '' : ' sf-got-empty');
    if (tappable) { got.type = 'button'; got.onclick = () => opts.tapGot(k); }
    got.textContent = u.got || '';
    if (tappable) got.setAttribute('aria-label', u.got ? 'take out ' + u.got : 'empty');
    else got.setAttribute('aria-hidden', 'true');
    col.appendChild(got);
  }
  return col;
}
