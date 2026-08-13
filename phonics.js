/* ══════════════════════════════════════════════════════════════════════
   phonics.js — the shared decoding data and audio.

   Loaded as a classic script by both index.html and game.html (like
   i18n.js), so the word families, the grapheme→recording maps and the
   voice picking have one home instead of two.

   The recordings in audio/ are the reason this file exists: device
   text-to-speech is unreliable on single short words, and every word in
   both word-pronunciation banks is already mapped to real recorded
   phonemes here.
══════════════════════════════════════════════════════════════════════ */

/* ══════════════════════════════════════════
   PHONEME WAV PLAYBACK
══════════════════════════════════════════ */
const AUDIO_BASE = 'audio/';

// Cache of Audio objects so repeated taps don't stack
const _phonemeCache = {};

function playPhonemeWav(filename, el) {
  if (!filename) return;
  const url = AUDIO_BASE + filename;
  let audio = _phonemeCache[url];
  if (!audio) {
    audio = new Audio(url);
    _phonemeCache[url] = audio;
  }
  audio.currentTime = 0;
  if (el) {
    el.classList.add('playing');
    audio.onended = () => el.classList.remove('playing');
    audio.onerror = () => {
      el.classList.remove('playing');
      // Graceful fallback: try TTS with the IPA label stripped to just the key word
      // e.g. "æ as in bat.wav" → speak "bat"
      const match = filename.match(/as in (\w+)/i);
      if (match) speakRaw(match[1]);
    };
  }
  audio.play().catch(() => {
    if (el) el.classList.remove('playing');
  });
}

/* ══════════════════════════════════════════
   WP1 PHONEME MAP
   All WP1 words are short-vowel CVC/CVCe patterns.
   Returns array of { display, wav } tiles for a given word.
══════════════════════════════════════════ */

// Simple consonant → WAV (for WP1 context)
const CONSONANT_WAV = {
  b:'b.wav', c:'k.wav', d:'d.wav', f:'f.wav', g:'g.wav', h:'h.wav',
  j:'dʒ as in jar.wav', k:'k.wav', l:'l.wav', m:'m.wav', n:'n.wav',
  p:'p.wav', r:'r.wav', s:'s.wav', t:'t.wav', v:'v.wav', w:'w.wav',
  x:'ks.wav', y:'j as in yam.wav', z:'z.wav'
};

// Short vowel → WAV (all WP1 vowels are short)
const SHORT_VOWEL_WAV = {
  a: 'æ as in bat.wav',
  e: 'e as in bet.wav',
  i: 'ɪ as in bit.wav',
  o: 'ɒ as in pot.wav',
  u: 'ʌ as in but.wav'
};

// Per-word overrides for any consonant that needs a non-default sound
const WP1_OVERRIDE = {
  // 'can' → c = k (already default), no overrides needed
  // All WP1 words use standard short-vowel + hard consonant patterns
};

function getWp1Tiles(word) {
  const tiles = [];
  for (let i = 0; i < word.length; i++) {
    const ch = word[i].toLowerCase();
    const wav = WP1_OVERRIDE[word + '_' + i]
      || SHORT_VOWEL_WAV[ch]
      || CONSONANT_WAV[ch]
      || null;
    tiles.push({ display: word[i], wav });
  }
  return tiles;
}

/* ══════════════════════════════════════════
   WP2 PHONEME TILE MAP
   Each word → array of { display, wav, type }
   type: 'beginning' | 'ending' | 'digraph' (controls tile colour)
   Words are grouped into phoneme tiles (digraphs/vowel-teams = one tile).
══════════════════════════════════════════ */
const WP2_TILES = {
  // ── CONSONANT DIGRAPHS ──────────────────
  // sh
  'ship':  [{d:'sh',w:'ʃ as in she.wav',t:'beginning'},{d:'i',w:'ɪ as in bit.wav',t:'beginning'},{d:'p',w:'p.wav',t:'ending'}],
  'shop':  [{d:'sh',w:'ʃ as in she.wav',t:'beginning'},{d:'o',w:'ɒ as in pot.wav',t:'beginning'},{d:'p',w:'p.wav',t:'ending'}],
  'fish':  [{d:'f',w:'f.wav',t:'beginning'},{d:'i',w:'ɪ as in bit.wav',t:'beginning'},{d:'sh',w:'ʃ as in she.wav',t:'ending'}],
  'dish':  [{d:'d',w:'d.wav',t:'beginning'},{d:'i',w:'ɪ as in bit.wav',t:'beginning'},{d:'sh',w:'ʃ as in she.wav',t:'ending'}],
  'shed':  [{d:'sh',w:'ʃ as in she.wav',t:'beginning'},{d:'e',w:'e as in bet.wav',t:'beginning'},{d:'d',w:'d.wav',t:'ending'}],
  'shell': [{d:'sh',w:'ʃ as in she.wav',t:'beginning'},{d:'e',w:'e as in bet.wav',t:'beginning'},{d:'ll',w:'l.wav',t:'ending'}],
  // ch
  'chip':  [{d:'ch',w:'tʃ as in chair.wav',t:'beginning'},{d:'i',w:'ɪ as in bit.wav',t:'beginning'},{d:'p',w:'p.wav',t:'ending'}],
  'chat':  [{d:'ch',w:'tʃ as in chair.wav',t:'beginning'},{d:'a',w:'æ as in bat.wav',t:'beginning'},{d:'t',w:'t.wav',t:'ending'}],
  'much':  [{d:'m',w:'m.wav',t:'beginning'},{d:'u',w:'ʌ as in but.wav',t:'beginning'},{d:'ch',w:'tʃ as in chair.wav',t:'ending'}],
  'rich':  [{d:'r',w:'r.wav',t:'beginning'},{d:'i',w:'ɪ as in bit.wav',t:'beginning'},{d:'ch',w:'tʃ as in chair.wav',t:'ending'}],
  'chop':  [{d:'ch',w:'tʃ as in chair.wav',t:'beginning'},{d:'o',w:'ɒ as in pot.wav',t:'beginning'},{d:'p',w:'p.wav',t:'ending'}],
  'chest': [{d:'ch',w:'tʃ as in chair.wav',t:'beginning'},{d:'e',w:'e as in bet.wav',t:'beginning'},{d:'s',w:'s.wav',t:'ending'},{d:'t',w:'t.wav',t:'ending'}],
  // th (voiced)
  'this':  [{d:'th',w:'ð as in this.wav',t:'beginning'},{d:'i',w:'ɪ as in bit.wav',t:'beginning'},{d:'s',w:'s.wav',t:'ending'}],
  'that':  [{d:'th',w:'ð as in this.wav',t:'beginning'},{d:'a',w:'æ as in bat.wav',t:'beginning'},{d:'t',w:'t.wav',t:'ending'}],
  'these': [{d:'th',w:'ð as in this.wav',t:'beginning'},{d:'e',w:'iː as in eat.wav',t:'beginning'},{d:'s',w:'z.wav',t:'ending'},{d:'e',w:null,t:'ending'}],
  'those': [{d:'th',w:'ð as in this.wav',t:'beginning'},{d:'o',w:'əʊ as in boat.wav',t:'beginning'},{d:'s',w:'z.wav',t:'ending'},{d:'e',w:null,t:'ending'}],
  // th (voiceless)
  'thin':  [{d:'th',w:'θ as in thin.wav',t:'beginning'},{d:'i',w:'ɪ as in bit.wav',t:'beginning'},{d:'n',w:'n.wav',t:'ending'}],
  'think': [{d:'th',w:'θ as in thin.wav',t:'beginning'},{d:'i',w:'ɪ as in bit.wav',t:'beginning'},{d:'n',w:'n.wav',t:'ending'},{d:'k',w:'k.wav',t:'ending'}],
  'bath':  [{d:'b',w:'b.wav',t:'beginning'},{d:'a',w:'æ as in bat.wav',t:'beginning'},{d:'th',w:'θ as in thin.wav',t:'ending'}],
  'teeth': [{d:'t',w:'t.wav',t:'beginning'},{d:'ee',w:'iː as in eat.wav',t:'beginning'},{d:'th',w:'θ as in thin.wav',t:'ending'}],
  // wh
  'when':  [{d:'wh',w:'w.wav',t:'beginning'},{d:'e',w:'e as in bet.wav',t:'beginning'},{d:'n',w:'n.wav',t:'ending'}],
  'what':  [{d:'wh',w:'w.wav',t:'beginning'},{d:'a',w:'ɒ as in pot.wav',t:'beginning'},{d:'t',w:'t.wav',t:'ending'}],
  'why':   [{d:'wh',w:'w.wav',t:'beginning'},{d:'y',w:'aɪ as in ice.wav',t:'ending'}],
  'where': [{d:'wh',w:'w.wav',t:'beginning'},{d:'ere',w:null,tts:'air',t:'ending'}],
  // ph
  'phone': [{d:'ph',w:'f.wav',t:'beginning'},{d:'o',w:'əʊ as in boat.wav',t:'beginning'},{d:'n',w:'n.wav',t:'ending'},{d:'e',w:null,t:'ending'}],
  'photo': [{d:'ph',w:'f.wav',t:'beginning'},{d:'o',w:'əʊ as in boat.wav',t:'beginning'},{d:'t',w:'t.wav',t:'ending'},{d:'o',w:'əʊ as in boat.wav',t:'ending'}],
  'graph': [{d:'g',w:'g.wav',t:'beginning'},{d:'r',w:'r.wav',t:'beginning'},{d:'a',w:'æ as in bat.wav',t:'ending'},{d:'ph',w:'f.wav',t:'ending'}],

  // ── VOWEL PAIRS — LONG SOUNDS ──────────
  // ee
  'see':   [{d:'s',w:'s.wav',t:'beginning'},{d:'ee',w:'iː as in eat.wav',t:'ending'}],
  'bee':   [{d:'b',w:'b.wav',t:'beginning'},{d:'ee',w:'iː as in eat.wav',t:'ending'}],
  'feet':  [{d:'f',w:'f.wav',t:'beginning'},{d:'ee',w:'iː as in eat.wav',t:'beginning'},{d:'t',w:'t.wav',t:'ending'}],
  // ea (long ee sound)
  'eat':   [{d:'ea',w:'iː as in eat.wav',t:'beginning'},{d:'t',w:'t.wav',t:'ending'}],
  'team':  [{d:'t',w:'t.wav',t:'beginning'},{d:'ea',w:'iː as in eat.wav',t:'beginning'},{d:'m',w:'m.wav',t:'ending'}],
  'meat':  [{d:'m',w:'m.wav',t:'beginning'},{d:'ea',w:'iː as in eat.wav',t:'beginning'},{d:'t',w:'t.wav',t:'ending'}],
  'read':  [{d:'r',w:'r.wav',t:'beginning'},{d:'ea',w:'iː as in eat.wav',t:'beginning'},{d:'d',w:'d.wav',t:'ending'}],
  // ai
  'rain':  [{d:'r',w:'r.wav',t:'beginning'},{d:'ai',w:'eɪ as in bait.wav',t:'beginning'},{d:'n',w:'n.wav',t:'ending'}],
  'train': [{d:'t',w:'t.wav',t:'beginning'},{d:'r',w:'r.wav',t:'beginning'},{d:'ai',w:'eɪ as in bait.wav',t:'ending'},{d:'n',w:'n.wav',t:'ending'}],
  'mail':  [{d:'m',w:'m.wav',t:'beginning'},{d:'ai',w:'eɪ as in bait.wav',t:'beginning'},{d:'l',w:'l.wav',t:'ending'}],
  'tail':  [{d:'t',w:'t.wav',t:'beginning'},{d:'ai',w:'eɪ as in bait.wav',t:'beginning'},{d:'l',w:'l.wav',t:'ending'}],
  // ay
  'day':   [{d:'d',w:'d.wav',t:'beginning'},{d:'ay',w:'eɪ as in bait.wav',t:'ending'}],
  'play':  [{d:'p',w:'p.wav',t:'beginning'},{d:'l',w:'l.wav',t:'beginning'},{d:'ay',w:'eɪ as in bait.wav',t:'ending'}],
  'say':   [{d:'s',w:'s.wav',t:'beginning'},{d:'ay',w:'eɪ as in bait.wav',t:'ending'}],
  'way':   [{d:'w',w:'w.wav',t:'beginning'},{d:'ay',w:'eɪ as in bait.wav',t:'ending'}],
  // oa
  'boat':  [{d:'b',w:'b.wav',t:'beginning'},{d:'oa',w:'əʊ as in boat.wav',t:'beginning'},{d:'t',w:'t.wav',t:'ending'}],
  'coat':  [{d:'c',w:'k.wav',t:'beginning'},{d:'oa',w:'əʊ as in boat.wav',t:'beginning'},{d:'t',w:'t.wav',t:'ending'}],
  'road':  [{d:'r',w:'r.wav',t:'beginning'},{d:'oa',w:'əʊ as in boat.wav',t:'beginning'},{d:'d',w:'d.wav',t:'ending'}],
  'soap':  [{d:'s',w:'s.wav',t:'beginning'},{d:'oa',w:'əʊ as in boat.wav',t:'beginning'},{d:'p',w:'p.wav',t:'ending'}],
  // oe
  'toe':   [{d:'t',w:'t.wav',t:'beginning'},{d:'oe',w:'əʊ as in boat.wav',t:'ending'}],
  'goes':  [{d:'g',w:'g.wav',t:'beginning'},{d:'oe',w:'əʊ as in boat.wav',t:'beginning'},{d:'s',w:'z.wav',t:'ending'}],
  'toes':  [{d:'t',w:'t.wav',t:'beginning'},{d:'oe',w:'əʊ as in boat.wav',t:'beginning'},{d:'s',w:'z.wav',t:'ending'}],
  'hoe':   [{d:'h',w:'h.wav',t:'beginning'},{d:'oe',w:'əʊ as in boat.wav',t:'ending'}],
  // ie
  'pie':   [{d:'p',w:'p.wav',t:'beginning'},{d:'ie',w:'aɪ as in ice.wav',t:'ending'}],
  'tie':   [{d:'t',w:'t.wav',t:'beginning'},{d:'ie',w:'aɪ as in ice.wav',t:'ending'}],
  'lie':   [{d:'l',w:'l.wav',t:'beginning'},{d:'ie',w:'aɪ as in ice.wav',t:'ending'}],
  'die':   [{d:'d',w:'d.wav',t:'beginning'},{d:'ie',w:'aɪ as in ice.wav',t:'ending'}],
  // ue
  'blue':  [{d:'b',w:'b.wav',t:'beginning'},{d:'l',w:'l.wav',t:'beginning'},{d:'ue',w:'uː as in pool.wav',t:'ending'}],
  'glue':  [{d:'g',w:'g.wav',t:'beginning'},{d:'l',w:'l.wav',t:'beginning'},{d:'ue',w:'uː as in pool.wav',t:'ending'}],
  'true':  [{d:'t',w:'t.wav',t:'beginning'},{d:'r',w:'r.wav',t:'beginning'},{d:'ue',w:'uː as in pool.wav',t:'ending'}],
  'clue':  [{d:'c',w:'k.wav',t:'beginning'},{d:'l',w:'l.wav',t:'beginning'},{d:'ue',w:'uː as in pool.wav',t:'ending'}],

  // ── VOWEL PAIRS — OTHER SOUNDS ─────────
  // oo (long /uː/)
  'moon':  [{d:'m',w:'m.wav',t:'beginning'},{d:'oo',w:'uː as in pool.wav',t:'beginning'},{d:'n',w:'n.wav',t:'ending'}],
  'food':  [{d:'f',w:'f.wav',t:'beginning'},{d:'oo',w:'uː as in pool.wav',t:'beginning'},{d:'d',w:'d.wav',t:'ending'}],
  'soon':  [{d:'s',w:'s.wav',t:'beginning'},{d:'oo',w:'uː as in pool.wav',t:'beginning'},{d:'n',w:'n.wav',t:'ending'}],
  'pool':  [{d:'p',w:'p.wav',t:'beginning'},{d:'oo',w:'uː as in pool.wav',t:'beginning'},{d:'l',w:'l.wav',t:'ending'}],
  'cool':  [{d:'c',w:'k.wav',t:'beginning'},{d:'oo',w:'uː as in pool.wav',t:'beginning'},{d:'l',w:'l.wav',t:'ending'}],
  'roof':  [{d:'r',w:'r.wav',t:'beginning'},{d:'oo',w:'uː as in pool.wav',t:'beginning'},{d:'f',w:'f.wav',t:'ending'}],
  // oo (short /ʊ/)
  'book':  [{d:'b',w:'b.wav',t:'beginning'},{d:'oo',w:'ʊ as in book.wav',t:'beginning'},{d:'k',w:'k.wav',t:'ending'}],
  'look':  [{d:'l',w:'l.wav',t:'beginning'},{d:'oo',w:'ʊ as in book.wav',t:'beginning'},{d:'k',w:'k.wav',t:'ending'}],
  'cook':  [{d:'c',w:'k.wav',t:'beginning'},{d:'oo',w:'ʊ as in book.wav',t:'beginning'},{d:'k',w:'k.wav',t:'ending'}],
  'foot':  [{d:'f',w:'f.wav',t:'beginning'},{d:'oo',w:'ʊ as in book.wav',t:'beginning'},{d:'t',w:'t.wav',t:'ending'}],
  'good':  [{d:'g',w:'g.wav',t:'beginning'},{d:'oo',w:'ʊ as in book.wav',t:'beginning'},{d:'d',w:'d.wav',t:'ending'}],
  'wood':  [{d:'w',w:'w.wav',t:'beginning'},{d:'oo',w:'ʊ as in book.wav',t:'beginning'},{d:'d',w:'d.wav',t:'ending'}],
  // ou (aʊ sound)
  'out':   [{d:'ou',w:'aʊ as in out.wav',t:'beginning'},{d:'t',w:'t.wav',t:'ending'}],
  'loud':  [{d:'l',w:'l.wav',t:'beginning'},{d:'ou',w:'aʊ as in out.wav',t:'beginning'},{d:'d',w:'d.wav',t:'ending'}],
  'sound': [{d:'s',w:'s.wav',t:'beginning'},{d:'ou',w:'aʊ as in out.wav',t:'beginning'},{d:'n',w:'n.wav',t:'ending'},{d:'d',w:'d.wav',t:'ending'}],
  'found': [{d:'f',w:'f.wav',t:'beginning'},{d:'ou',w:'aʊ as in out.wav',t:'beginning'},{d:'n',w:'n.wav',t:'ending'},{d:'d',w:'d.wav',t:'ending'}],
  'mouth': [{d:'m',w:'m.wav',t:'beginning'},{d:'ou',w:'aʊ as in out.wav',t:'beginning'},{d:'th',w:'θ as in thin.wav',t:'ending'}],
  'count': [{d:'c',w:'k.wav',t:'beginning'},{d:'ou',w:'aʊ as in out.wav',t:'beginning'},{d:'n',w:'n.wav',t:'ending'},{d:'t',w:'t.wav',t:'ending'}],
  // ou — silent l words
  'could': [{d:'c',w:'k.wav',t:'beginning'},{d:'ou',w:'ʊ as in book.wav',t:'beginning'},{d:'l',w:null,t:'ending'},{d:'d',w:'d.wav',t:'ending'}],
  'would': [{d:'w',w:'w.wav',t:'beginning'},{d:'ou',w:'ʊ as in book.wav',t:'beginning'},{d:'l',w:null,t:'ending'},{d:'d',w:'d.wav',t:'ending'}],
  'should':[{d:'sh',w:'ʃ as in she.wav',t:'beginning'},{d:'ou',w:'ʊ as in book.wav',t:'beginning'},{d:'l',w:null,t:'ending'},{d:'d',w:'d.wav',t:'ending'}],
  'your':  [{d:'y',w:'j as in yam.wav',t:'beginning'},{d:'our',w:'ɔː as in storm.wav',t:'ending'}],
  'four':  [{d:'f',w:'f.wav',t:'beginning'},{d:'our',w:'ɔː as in storm.wav',t:'ending'}],
  'pour':  [{d:'p',w:'p.wav',t:'beginning'},{d:'our',w:'ɔː as in storm.wav',t:'ending'}],
  // ow (aʊ)
  'cow':   [{d:'c',w:'k.wav',t:'beginning'},{d:'ow',w:'aʊ as in out.wav',t:'ending'}],
  'now':   [{d:'n',w:'n.wav',t:'beginning'},{d:'ow',w:'aʊ as in out.wav',t:'ending'}],
  // ow (əʊ)
  'snow':  [{d:'s',w:'s.wav',t:'beginning'},{d:'n',w:'n.wav',t:'beginning'},{d:'ow',w:'əʊ as in boat.wav',t:'ending'}],
  'low':   [{d:'l',w:'l.wav',t:'beginning'},{d:'ow',w:'əʊ as in boat.wav',t:'ending'}],
  // oi
  'coin':  [{d:'c',w:'k.wav',t:'beginning'},{d:'oi',w:'ɔɪ as in boil.wav',t:'beginning'},{d:'n',w:'n.wav',t:'ending'}],
  'join':  [{d:'j',w:'dʒ as in jar.wav',t:'beginning'},{d:'oi',w:'ɔɪ as in boil.wav',t:'beginning'},{d:'n',w:'n.wav',t:'ending'}],
  'boil':  [{d:'b',w:'b.wav',t:'beginning'},{d:'oi',w:'ɔɪ as in boil.wav',t:'beginning'},{d:'l',w:'l.wav',t:'ending'}],
  'soil':  [{d:'s',w:'s.wav',t:'beginning'},{d:'oi',w:'ɔɪ as in boil.wav',t:'beginning'},{d:'l',w:'l.wav',t:'ending'}],
  // oy
  'boy':   [{d:'b',w:'b.wav',t:'beginning'},{d:'oy',w:'ɔɪ as in boil.wav',t:'ending'}],
  'toy':   [{d:'t',w:'t.wav',t:'beginning'},{d:'oy',w:'ɔɪ as in boil.wav',t:'ending'}],
  'enjoy': [{d:'e',w:'ɪ as in bit.wav',t:'beginning'},{d:'n',w:'n.wav',t:'beginning'},{d:'j',w:'dʒ as in jar.wav',t:'beginning'},{d:'oy',w:'ɔɪ as in boil.wav',t:'ending'}],
  'annoy': [{d:'a',w:'æ as in bat.wav',t:'beginning'},{d:'nn',w:'n.wav',t:'beginning'},{d:'oy',w:'ɔɪ as in boil.wav',t:'ending'}],
  // au
  // 'or', not 'e' + 'r' — the tiles have to spell the word they are under.
  'author':[{d:'au',w:'ɔː as in storm.wav',t:'beginning'},{d:'th',w:'θ as in thin.wav',t:'beginning'},{d:'or',w:'ɜː as in work.wav',t:'ending'}],
  'August':[{d:'Au',w:'ɔː as in storm.wav',t:'beginning'},{d:'g',w:'g.wav',t:'ending'},{d:'u',w:'ʌ as in but.wav',t:'ending'},{d:'s',w:'s.wav',t:'ending'},{d:'t',w:'t.wav',t:'ending'}],
  'auto':  [{d:'au',w:'ɔː as in storm.wav',t:'beginning'},{d:'t',w:'t.wav',t:'ending'},{d:'o',w:'əʊ as in boat.wav',t:'ending'}],
  'haul':  [{d:'h',w:'h.wav',t:'beginning'},{d:'au',w:'ɔː as in storm.wav',t:'beginning'},{d:'l',w:'l.wav',t:'ending'}],
  // aw
  'saw':   [{d:'s',w:'s.wav',t:'beginning'},{d:'aw',w:'ɔː as in storm.wav',t:'ending'}],
  'law':   [{d:'l',w:'l.wav',t:'beginning'},{d:'aw',w:'ɔː as in storm.wav',t:'ending'}],
  'paw':   [{d:'p',w:'p.wav',t:'beginning'},{d:'aw',w:'ɔː as in storm.wav',t:'ending'}],
  'draw':  [{d:'d',w:'d.wav',t:'beginning'},{d:'r',w:'r.wav',t:'beginning'},{d:'aw',w:'ɔː as in storm.wav',t:'ending'}],

  // ── SILENT E ───────────────────────────
  'cake':  [{d:'c',w:'k.wav',t:'beginning'},{d:'a',w:'eɪ as in bait.wav',t:'beginning'},{d:'k',w:'k.wav',t:'ending'},{d:'e',w:null,t:'ending'}],
  'make':  [{d:'m',w:'m.wav',t:'beginning'},{d:'a',w:'eɪ as in bait.wav',t:'beginning'},{d:'k',w:'k.wav',t:'ending'},{d:'e',w:null,t:'ending'}],
  'take':  [{d:'t',w:'t.wav',t:'beginning'},{d:'a',w:'eɪ as in bait.wav',t:'beginning'},{d:'k',w:'k.wav',t:'ending'},{d:'e',w:null,t:'ending'}],
  'lake':  [{d:'l',w:'l.wav',t:'beginning'},{d:'a',w:'eɪ as in bait.wav',t:'beginning'},{d:'k',w:'k.wav',t:'ending'},{d:'e',w:null,t:'ending'}],
  'late':  [{d:'l',w:'l.wav',t:'beginning'},{d:'a',w:'eɪ as in bait.wav',t:'beginning'},{d:'t',w:'t.wav',t:'ending'},{d:'e',w:null,t:'ending'}],
  'mate':  [{d:'m',w:'m.wav',t:'beginning'},{d:'a',w:'eɪ as in bait.wav',t:'beginning'},{d:'t',w:'t.wav',t:'ending'},{d:'e',w:null,t:'ending'}],
  'gate':  [{d:'g',w:'g.wav',t:'beginning'},{d:'a',w:'eɪ as in bait.wav',t:'beginning'},{d:'t',w:'t.wav',t:'ending'},{d:'e',w:null,t:'ending'}],
  'hate':  [{d:'h',w:'h.wav',t:'beginning'},{d:'a',w:'eɪ as in bait.wav',t:'beginning'},{d:'t',w:'t.wav',t:'ending'},{d:'e',w:null,t:'ending'}],
  'fine':  [{d:'f',w:'f.wav',t:'beginning'},{d:'i',w:'aɪ as in ice.wav',t:'beginning'},{d:'n',w:'n.wav',t:'ending'},{d:'e',w:null,t:'ending'}],
  'line':  [{d:'l',w:'l.wav',t:'beginning'},{d:'i',w:'aɪ as in ice.wav',t:'beginning'},{d:'n',w:'n.wav',t:'ending'},{d:'e',w:null,t:'ending'}],
  'mine':  [{d:'m',w:'m.wav',t:'beginning'},{d:'i',w:'aɪ as in ice.wav',t:'beginning'},{d:'n',w:'n.wav',t:'ending'},{d:'e',w:null,t:'ending'}],
  'nine':  [{d:'n',w:'n.wav',t:'beginning'},{d:'i',w:'aɪ as in ice.wav',t:'beginning'},{d:'n',w:'n.wav',t:'ending'},{d:'e',w:null,t:'ending'}],
  'hope':  [{d:'h',w:'h.wav',t:'beginning'},{d:'o',w:'əʊ as in boat.wav',t:'beginning'},{d:'p',w:'p.wav',t:'ending'},{d:'e',w:null,t:'ending'}],
  'rope':  [{d:'r',w:'r.wav',t:'beginning'},{d:'o',w:'əʊ as in boat.wav',t:'beginning'},{d:'p',w:'p.wav',t:'ending'},{d:'e',w:null,t:'ending'}],
  'cope':  [{d:'c',w:'k.wav',t:'beginning'},{d:'o',w:'əʊ as in boat.wav',t:'beginning'},{d:'p',w:'p.wav',t:'ending'},{d:'e',w:null,t:'ending'}],
  'nope':  [{d:'n',w:'n.wav',t:'beginning'},{d:'o',w:'əʊ as in boat.wav',t:'beginning'},{d:'p',w:'p.wav',t:'ending'},{d:'e',w:null,t:'ending'}],
  'cute':  [{d:'c',w:'k.wav',t:'beginning'},{d:'u',w:'uː as in pool.wav',t:'beginning'},{d:'t',w:'t.wav',t:'ending'},{d:'e',w:null,t:'ending'}],
  'mute':  [{d:'m',w:'m.wav',t:'beginning'},{d:'u',w:'uː as in pool.wav',t:'beginning'},{d:'t',w:'t.wav',t:'ending'},{d:'e',w:null,t:'ending'}],
  'flute': [{d:'f',w:'f.wav',t:'beginning'},{d:'l',w:'l.wav',t:'beginning'},{d:'u',w:'uː as in pool.wav',t:'beginning'},{d:'t',w:'t.wav',t:'ending'},{d:'e',w:null,t:'ending'}],
  'cube':  [{d:'c',w:'k.wav',t:'beginning'},{d:'u',w:'uː as in pool.wav',t:'beginning'},{d:'b',w:'b.wav',t:'ending'},{d:'e',w:null,t:'ending'}],
  'ride':  [{d:'r',w:'r.wav',t:'beginning'},{d:'i',w:'aɪ as in ice.wav',t:'beginning'},{d:'d',w:'d.wav',t:'ending'},{d:'e',w:null,t:'ending'}],
  'side':  [{d:'s',w:'s.wav',t:'beginning'},{d:'i',w:'aɪ as in ice.wav',t:'beginning'},{d:'d',w:'d.wav',t:'ending'},{d:'e',w:null,t:'ending'}],
  'hide':  [{d:'h',w:'h.wav',t:'beginning'},{d:'i',w:'aɪ as in ice.wav',t:'beginning'},{d:'d',w:'d.wav',t:'ending'},{d:'e',w:null,t:'ending'}],
  'wide':  [{d:'w',w:'w.wav',t:'beginning'},{d:'i',w:'aɪ as in ice.wav',t:'beginning'},{d:'d',w:'d.wav',t:'ending'},{d:'e',w:null,t:'ending'}],
  'game':  [{d:'g',w:'g.wav',t:'beginning'},{d:'a',w:'eɪ as in bait.wav',t:'beginning'},{d:'m',w:'m.wav',t:'ending'},{d:'e',w:null,t:'ending'}],
  'name':  [{d:'n',w:'n.wav',t:'beginning'},{d:'a',w:'eɪ as in bait.wav',t:'beginning'},{d:'m',w:'m.wav',t:'ending'},{d:'e',w:null,t:'ending'}],
  'same':  [{d:'s',w:'s.wav',t:'beginning'},{d:'a',w:'eɪ as in bait.wav',t:'beginning'},{d:'m',w:'m.wav',t:'ending'},{d:'e',w:null,t:'ending'}],
  'came':  [{d:'c',w:'k.wav',t:'beginning'},{d:'a',w:'eɪ as in bait.wav',t:'beginning'},{d:'m',w:'m.wav',t:'ending'},{d:'e',w:null,t:'ending'}],
  'more':  [{d:'m',w:'m.wav',t:'beginning'},{d:'or',w:'ɔː as in storm.wav',t:'beginning'},{d:'e',w:null,t:'ending'}],
  'core':  [{d:'c',w:'k.wav',t:'beginning'},{d:'or',w:'ɔː as in storm.wav',t:'beginning'},{d:'e',w:null,t:'ending'}],
  'sore':  [{d:'s',w:'s.wav',t:'beginning'},{d:'or',w:'ɔː as in storm.wav',t:'beginning'},{d:'e',w:null,t:'ending'}],
  'bore':  [{d:'b',w:'b.wav',t:'beginning'},{d:'or',w:'ɔː as in storm.wav',t:'beginning'},{d:'e',w:null,t:'ending'}],
  'slide': [{d:'s',w:'s.wav',t:'beginning'},{d:'l',w:'l.wav',t:'beginning'},{d:'i',w:'aɪ as in ice.wav',t:'ending'},{d:'d',w:'d.wav',t:'ending'},{d:'e',w:null,t:'ending'}],

  // ── BEGINNING BLENDS ───────────────────
  // Blend consonants = 'beginning', vowel and everything after = 'ending'
  // st
  'stop':  [{d:'s',w:'s.wav',t:'beginning'},{d:'t',w:'t.wav',t:'beginning'},{d:'o',w:'ɒ as in pot.wav',t:'ending'},{d:'p',w:'p.wav',t:'ending'}],
  'step':  [{d:'s',w:'s.wav',t:'beginning'},{d:'t',w:'t.wav',t:'beginning'},{d:'e',w:'e as in bet.wav',t:'ending'},{d:'p',w:'p.wav',t:'ending'}],
  'stand': [{d:'s',w:'s.wav',t:'beginning'},{d:'t',w:'t.wav',t:'beginning'},{d:'a',w:'æ as in bat.wav',t:'ending'},{d:'n',w:'n.wav',t:'ending'},{d:'d',w:'d.wav',t:'ending'}],
  'stick': [{d:'s',w:'s.wav',t:'beginning'},{d:'t',w:'t.wav',t:'beginning'},{d:'i',w:'ɪ as in bit.wav',t:'ending'},{d:'ck',w:'k.wav',t:'ending'}],
  // bl
  'black': [{d:'b',w:'b.wav',t:'beginning'},{d:'l',w:'l.wav',t:'beginning'},{d:'a',w:'æ as in bat.wav',t:'ending'},{d:'ck',w:'k.wav',t:'ending'}],
  'block': [{d:'b',w:'b.wav',t:'beginning'},{d:'l',w:'l.wav',t:'beginning'},{d:'o',w:'ɒ as in pot.wav',t:'ending'},{d:'ck',w:'k.wav',t:'ending'}],
  'blow':  [{d:'b',w:'b.wav',t:'beginning'},{d:'l',w:'l.wav',t:'beginning'},{d:'ow',w:'əʊ as in boat.wav',t:'ending'}],
  // tr
  'tree':  [{d:'t',w:'t.wav',t:'beginning'},{d:'r',w:'r.wav',t:'beginning'},{d:'ee',w:'iː as in eat.wav',t:'ending'}],
  'truck': [{d:'t',w:'t.wav',t:'beginning'},{d:'r',w:'r.wav',t:'beginning'},{d:'u',w:'ʌ as in but.wav',t:'ending'},{d:'ck',w:'k.wav',t:'ending'}],
  'trip':  [{d:'t',w:'t.wav',t:'beginning'},{d:'r',w:'r.wav',t:'beginning'},{d:'i',w:'ɪ as in bit.wav',t:'ending'},{d:'p',w:'p.wav',t:'ending'}],
  // dr
  'drop':  [{d:'d',w:'d.wav',t:'beginning'},{d:'r',w:'r.wav',t:'beginning'},{d:'o',w:'ɒ as in pot.wav',t:'ending'},{d:'p',w:'p.wav',t:'ending'}],
  'drum':  [{d:'d',w:'d.wav',t:'beginning'},{d:'r',w:'r.wav',t:'beginning'},{d:'u',w:'ʌ as in but.wav',t:'ending'},{d:'m',w:'m.wav',t:'ending'}],
  'dress': [{d:'d',w:'d.wav',t:'beginning'},{d:'r',w:'r.wav',t:'beginning'},{d:'e',w:'e as in bet.wav',t:'ending'},{d:'ss',w:'s.wav',t:'ending'}],
  'drink': [{d:'d',w:'d.wav',t:'beginning'},{d:'r',w:'r.wav',t:'beginning'},{d:'i',w:'ɪ as in bit.wav',t:'ending'},{d:'n',w:'n.wav',t:'ending'},{d:'k',w:'k.wav',t:'ending'}],
  // cl
  'class': [{d:'c',w:'k.wav',t:'beginning'},{d:'l',w:'l.wav',t:'beginning'},{d:'a',w:'æ as in bat.wav',t:'ending'},{d:'ss',w:'s.wav',t:'ending'}],
  'clap':  [{d:'c',w:'k.wav',t:'beginning'},{d:'l',w:'l.wav',t:'beginning'},{d:'a',w:'æ as in bat.wav',t:'ending'},{d:'p',w:'p.wav',t:'ending'}],
  'clock': [{d:'c',w:'k.wav',t:'beginning'},{d:'l',w:'l.wav',t:'beginning'},{d:'o',w:'ɒ as in pot.wav',t:'ending'},{d:'ck',w:'k.wav',t:'ending'}],
  'clean': [{d:'c',w:'k.wav',t:'beginning'},{d:'l',w:'l.wav',t:'beginning'},{d:'ea',w:'iː as in eat.wav',t:'ending'},{d:'n',w:'n.wav',t:'ending'}],
  // fl
  'flag':  [{d:'f',w:'f.wav',t:'beginning'},{d:'l',w:'l.wav',t:'beginning'},{d:'a',w:'æ as in bat.wav',t:'ending'},{d:'g',w:'g.wav',t:'ending'}],
  'flat':  [{d:'f',w:'f.wav',t:'beginning'},{d:'l',w:'l.wav',t:'beginning'},{d:'a',w:'æ as in bat.wav',t:'ending'},{d:'t',w:'t.wav',t:'ending'}],
  'flip':  [{d:'f',w:'f.wav',t:'beginning'},{d:'l',w:'l.wav',t:'beginning'},{d:'i',w:'ɪ as in bit.wav',t:'ending'},{d:'p',w:'p.wav',t:'ending'}],
  'fly':   [{d:'f',w:'f.wav',t:'beginning'},{d:'l',w:'l.wav',t:'beginning'},{d:'y',w:'aɪ as in ice.wav',t:'ending'}],
  // gr
  'green': [{d:'g',w:'g.wav',t:'beginning'},{d:'r',w:'r.wav',t:'beginning'},{d:'ee',w:'iː as in eat.wav',t:'ending'},{d:'n',w:'n.wav',t:'ending'}],
  'grab':  [{d:'g',w:'g.wav',t:'beginning'},{d:'r',w:'r.wav',t:'beginning'},{d:'a',w:'æ as in bat.wav',t:'ending'},{d:'b',w:'b.wav',t:'ending'}],
  'grow':  [{d:'g',w:'g.wav',t:'beginning'},{d:'r',w:'r.wav',t:'beginning'},{d:'ow',w:'əʊ as in boat.wav',t:'ending'}],
  'great': [{d:'g',w:'g.wav',t:'beginning'},{d:'r',w:'r.wav',t:'beginning'},{d:'ea',w:'eɪ as in bait.wav',t:'ending'},{d:'t',w:'t.wav',t:'ending'}],
  // pl
  'plan':  [{d:'p',w:'p.wav',t:'beginning'},{d:'l',w:'l.wav',t:'beginning'},{d:'a',w:'æ as in bat.wav',t:'ending'},{d:'n',w:'n.wav',t:'ending'}],
  'plant': [{d:'p',w:'p.wav',t:'beginning'},{d:'l',w:'l.wav',t:'beginning'},{d:'a',w:'æ as in bat.wav',t:'ending'},{d:'n',w:'n.wav',t:'ending'},{d:'t',w:'t.wav',t:'ending'}],
  'please':[{d:'p',w:'p.wav',t:'beginning'},{d:'l',w:'l.wav',t:'beginning'},{d:'ea',w:'iː as in eat.wav',t:'ending'},{d:'s',w:'z.wav',t:'ending'},{d:'e',w:null,t:'ending'}],
  // br
  'brown': [{d:'b',w:'b.wav',t:'beginning'},{d:'r',w:'r.wav',t:'beginning'},{d:'ow',w:'aʊ as in out.wav',t:'ending'},{d:'n',w:'n.wav',t:'ending'}],
  'bring': [{d:'b',w:'b.wav',t:'beginning'},{d:'r',w:'r.wav',t:'beginning'},{d:'i',w:'ɪ as in bit.wav',t:'ending'},{d:'ng',w:'ŋ as in sing.wav',t:'ending'}],
  'bread': [{d:'b',w:'b.wav',t:'beginning'},{d:'r',w:'r.wav',t:'beginning'},{d:'ea',w:'e as in bet.wav',t:'ending'},{d:'d',w:'d.wav',t:'ending'}],
  'brush': [{d:'b',w:'b.wav',t:'beginning'},{d:'r',w:'r.wav',t:'beginning'},{d:'u',w:'ʌ as in but.wav',t:'ending'},{d:'sh',w:'ʃ as in she.wav',t:'ending'}],
  // cr
  'crab':  [{d:'c',w:'k.wav',t:'beginning'},{d:'r',w:'r.wav',t:'beginning'},{d:'a',w:'æ as in bat.wav',t:'ending'},{d:'b',w:'b.wav',t:'ending'}],
  'cry':   [{d:'c',w:'k.wav',t:'beginning'},{d:'r',w:'r.wav',t:'beginning'},{d:'y',w:'aɪ as in ice.wav',t:'ending'}],
  'crop':  [{d:'c',w:'k.wav',t:'beginning'},{d:'r',w:'r.wav',t:'beginning'},{d:'o',w:'ɒ as in pot.wav',t:'ending'},{d:'p',w:'p.wav',t:'ending'}],
  'cross': [{d:'c',w:'k.wav',t:'beginning'},{d:'r',w:'r.wav',t:'beginning'},{d:'o',w:'ɒ as in pot.wav',t:'ending'},{d:'ss',w:'s.wav',t:'ending'}],
  // sl
  'slip':  [{d:'s',w:'s.wav',t:'beginning'},{d:'l',w:'l.wav',t:'beginning'},{d:'i',w:'ɪ as in bit.wav',t:'ending'},{d:'p',w:'p.wav',t:'ending'}],
  'slow':  [{d:'s',w:'s.wav',t:'beginning'},{d:'l',w:'l.wav',t:'beginning'},{d:'ow',w:'əʊ as in boat.wav',t:'ending'}],
  'sleep': [{d:'s',w:'s.wav',t:'beginning'},{d:'l',w:'l.wav',t:'beginning'},{d:'ee',w:'iː as in eat.wav',t:'ending'},{d:'p',w:'p.wav',t:'ending'}],
  // sp
  'spin':  [{d:'s',w:'s.wav',t:'beginning'},{d:'p',w:'p.wav',t:'beginning'},{d:'i',w:'ɪ as in bit.wav',t:'ending'},{d:'n',w:'n.wav',t:'ending'}],
  'spot':  [{d:'s',w:'s.wav',t:'beginning'},{d:'p',w:'p.wav',t:'beginning'},{d:'o',w:'ɒ as in pot.wav',t:'ending'},{d:'t',w:'t.wav',t:'ending'}],
  'speak': [{d:'s',w:'s.wav',t:'beginning'},{d:'p',w:'p.wav',t:'beginning'},{d:'ea',w:'iː as in eat.wav',t:'ending'},{d:'k',w:'k.wav',t:'ending'}],
  'spoon': [{d:'s',w:'s.wav',t:'beginning'},{d:'p',w:'p.wav',t:'beginning'},{d:'oo',w:'uː as in pool.wav',t:'ending'},{d:'n',w:'n.wav',t:'ending'}],

  // ── COMMON ENDINGS ─────────────────────
  'back':  [{d:'b',w:'b.wav',t:'beginning'},{d:'a',w:'æ as in bat.wav',t:'beginning'},{d:'ck',w:'k.wav',t:'ending'}],
  'duck':  [{d:'d',w:'d.wav',t:'beginning'},{d:'u',w:'ʌ as in but.wav',t:'beginning'},{d:'ck',w:'k.wav',t:'ending'}],
  'pick':  [{d:'p',w:'p.wav',t:'beginning'},{d:'i',w:'ɪ as in bit.wav',t:'beginning'},{d:'ck',w:'k.wav',t:'ending'}],
  'rock':  [{d:'r',w:'r.wav',t:'beginning'},{d:'o',w:'ɒ as in pot.wav',t:'beginning'},{d:'ck',w:'k.wav',t:'ending'}],
  'ball':  [{d:'b',w:'b.wav',t:'beginning'},{d:'a',w:'ɔː as in storm.wav',t:'beginning'},{d:'ll',w:'l.wav',t:'ending'}],
  'bell':  [{d:'b',w:'b.wav',t:'beginning'},{d:'e',w:'e as in bet.wav',t:'beginning'},{d:'ll',w:'l.wav',t:'ending'}],
  'fill':  [{d:'f',w:'f.wav',t:'beginning'},{d:'i',w:'ɪ as in bit.wav',t:'beginning'},{d:'ll',w:'l.wav',t:'ending'}],
  'doll':  [{d:'d',w:'d.wav',t:'beginning'},{d:'o',w:'ɒ as in pot.wav',t:'beginning'},{d:'ll',w:'l.wav',t:'ending'}],
  'off':   [{d:'o',w:'ɒ as in pot.wav',t:'beginning'},{d:'ff',w:'f.wav',t:'ending'}],
  'puff':  [{d:'p',w:'p.wav',t:'beginning'},{d:'u',w:'ʌ as in but.wav',t:'beginning'},{d:'ff',w:'f.wav',t:'ending'}],
  'cliff': [{d:'c',w:'k.wav',t:'beginning'},{d:'l',w:'l.wav',t:'beginning'},{d:'i',w:'ɪ as in bit.wav',t:'ending'},{d:'ff',w:'f.wav',t:'ending'}],
  'staff': [{d:'s',w:'s.wav',t:'beginning'},{d:'t',w:'t.wav',t:'beginning'},{d:'a',w:'æ as in bat.wav',t:'ending'},{d:'ff',w:'f.wav',t:'ending'}],
  'miss':  [{d:'m',w:'m.wav',t:'beginning'},{d:'i',w:'ɪ as in bit.wav',t:'beginning'},{d:'ss',w:'s.wav',t:'ending'}],
  'pass':  [{d:'p',w:'p.wav',t:'beginning'},{d:'a',w:'æ as in bat.wav',t:'beginning'},{d:'ss',w:'s.wav',t:'ending'}],
  'bus':   [{d:'b',w:'b.wav',t:'beginning'},{d:'u',w:'ʌ as in but.wav',t:'beginning'},{d:'s',w:'s.wav',t:'ending'}],
  'buzz':  [{d:'b',w:'b.wav',t:'beginning'},{d:'u',w:'ʌ as in but.wav',t:'beginning'},{d:'zz',w:'z.wav',t:'ending'}],
  'jazz':  [{d:'j',w:'dʒ as in jar.wav',t:'beginning'},{d:'a',w:'æ as in bat.wav',t:'beginning'},{d:'zz',w:'z.wav',t:'ending'}],
  'fizz':  [{d:'f',w:'f.wav',t:'beginning'},{d:'i',w:'ɪ as in bit.wav',t:'beginning'},{d:'zz',w:'z.wav',t:'ending'}],
  'fuzz':  [{d:'f',w:'f.wav',t:'beginning'},{d:'u',w:'ʌ as in but.wav',t:'beginning'},{d:'zz',w:'z.wav',t:'ending'}],
  'catch': [{d:'c',w:'k.wav',t:'beginning'},{d:'a',w:'æ as in bat.wav',t:'beginning'},{d:'tch',w:'tʃ as in chair.wav',t:'ending'}],
  'match': [{d:'m',w:'m.wav',t:'beginning'},{d:'a',w:'æ as in bat.wav',t:'beginning'},{d:'tch',w:'tʃ as in chair.wav',t:'ending'}],
  'watch': [{d:'w',w:'w.wav',t:'beginning'},{d:'a',w:'ɒ as in pot.wav',t:'beginning'},{d:'tch',w:'tʃ as in chair.wav',t:'ending'}],
  'pitch': [{d:'p',w:'p.wav',t:'beginning'},{d:'i',w:'ɪ as in bit.wav',t:'beginning'},{d:'tch',w:'tʃ as in chair.wav',t:'ending'}],
  'bridge':[{d:'b',w:'b.wav',t:'beginning'},{d:'r',w:'r.wav',t:'beginning'},{d:'i',w:'ɪ as in bit.wav',t:'ending'},{d:'dge',w:'dʒ as in jar.wav',t:'ending'}],
  'edge':  [{d:'e',w:'e as in bet.wav',t:'beginning'},{d:'dge',w:'dʒ as in jar.wav',t:'ending'}],
  'badge': [{d:'b',w:'b.wav',t:'beginning'},{d:'a',w:'æ as in bat.wav',t:'beginning'},{d:'dge',w:'dʒ as in jar.wav',t:'ending'}],
  'judge': [{d:'j',w:'dʒ as in jar.wav',t:'beginning'},{d:'u',w:'ʌ as in but.wav',t:'beginning'},{d:'dge',w:'dʒ as in jar.wav',t:'ending'}],
  // -ed endings
  'jumped':  [{d:'j',w:'dʒ as in jar.wav',t:'beginning'},{d:'u',w:'ʌ as in but.wav',t:'beginning'},{d:'m',w:'m.wav',t:'beginning'},{d:'p',w:'p.wav',t:'beginning'},{d:'ed',w:null,tts:'t',t:'ending'}],
  'played':  [{d:'p',w:'p.wav',t:'beginning'},{d:'l',w:'l.wav',t:'beginning'},{d:'ay',w:'eɪ as in bait.wav',t:'beginning'},{d:'ed',w:null,tts:'d',t:'ending'}],
  'looked':  [{d:'l',w:'l.wav',t:'beginning'},{d:'oo',w:'ʊ as in book.wav',t:'beginning'},{d:'k',w:'k.wav',t:'beginning'},{d:'ed',w:null,tts:'t',t:'ending'}],
  'helped':  [{d:'h',w:'h.wav',t:'beginning'},{d:'e',w:'e as in bet.wav',t:'beginning'},{d:'l',w:'l.wav',t:'beginning'},{d:'p',w:'p.wav',t:'beginning'},{d:'ed',w:null,tts:'t',t:'ending'}],
  // -ing endings: i + ng (two phoneme tiles)
  'going':   [{d:'g',w:'g.wav',t:'beginning'},{d:'o',w:'əʊ as in boat.wav',t:'beginning'},{d:'i',w:'ɪ as in bit.wav',t:'ending'},{d:'ng',w:'ŋ as in sing.wav',t:'ending'}],
  'playing': [{d:'p',w:'p.wav',t:'beginning'},{d:'l',w:'l.wav',t:'beginning'},{d:'ay',w:'eɪ as in bait.wav',t:'beginning'},{d:'i',w:'ɪ as in bit.wav',t:'ending'},{d:'ng',w:'ŋ as in sing.wav',t:'ending'}],
  'looking': [{d:'l',w:'l.wav',t:'beginning'},{d:'oo',w:'ʊ as in book.wav',t:'beginning'},{d:'k',w:'k.wav',t:'beginning'},{d:'i',w:'ɪ as in bit.wav',t:'ending'},{d:'ng',w:'ŋ as in sing.wav',t:'ending'}],
  'eating':  [{d:'ea',w:'iː as in eat.wav',t:'beginning'},{d:'t',w:'t.wav',t:'beginning'},{d:'i',w:'ɪ as in bit.wav',t:'ending'},{d:'ng',w:'ŋ as in sing.wav',t:'ending'}],
  // -tion / -sion / -cian / -ture (suffix = one TTS tile)
  'elephant':   [{d:'e',w:'e as in bet.wav',t:'beginning'},{d:'l',w:'l.wav',t:'beginning'},{d:'e',w:'ɪ as in bit.wav',t:'beginning'},{d:'ph',w:'f.wav',t:'beginning'},{d:'a',w:'æ as in bat.wav',t:'beginning'},{d:'n',w:'n.wav',t:'ending'},{d:'t',w:'t.wav',t:'ending'}],
  'nation':     [{d:'n',w:'n.wav',t:'beginning'},{d:'a',w:'eɪ as in bait.wav',t:'beginning'},{d:'tion',w:null,tts:'shen',t:'ending'}],
  'station':    [{d:'s',w:'s.wav',t:'beginning'},{d:'t',w:'t.wav',t:'beginning'},{d:'a',w:'eɪ as in bait.wav',t:'beginning'},{d:'tion',w:null,tts:'shen',t:'ending'}],
  'action':     [{d:'a',w:'æ as in bat.wav',t:'beginning'},{d:'c',w:'k.wav',t:'beginning'},{d:'tion',w:null,tts:'shen',t:'ending'}],
  'mention':    [{d:'m',w:'m.wav',t:'beginning'},{d:'e',w:'e as in bet.wav',t:'beginning'},{d:'n',w:'n.wav',t:'beginning'},{d:'tion',w:null,tts:'shen',t:'ending'}],
  'motion':     [{d:'m',w:'m.wav',t:'beginning'},{d:'o',w:'əʊ as in boat.wav',t:'beginning'},{d:'tion',w:null,tts:'shen',t:'ending'}],
  'section':    [{d:'s',w:'s.wav',t:'beginning'},{d:'e',w:'e as in bet.wav',t:'beginning'},{d:'c',w:'k.wav',t:'beginning'},{d:'tion',w:null,tts:'shen',t:'ending'}],
  'mission':    [{d:'m',w:'m.wav',t:'beginning'},{d:'i',w:'ɪ as in bit.wav',t:'beginning'},{d:'ssion',w:null,tts:'shen',t:'ending'}],
  'session':    [{d:'s',w:'s.wav',t:'beginning'},{d:'e',w:'e as in bet.wav',t:'beginning'},{d:'ssion',w:null,tts:'shen',t:'ending'}],
  'passion':    [{d:'p',w:'p.wav',t:'beginning'},{d:'a',w:'æ as in bat.wav',t:'beginning'},{d:'ssion',w:null,tts:'shen',t:'ending'}],
  'tension':    [{d:'t',w:'t.wav',t:'beginning'},{d:'e',w:'e as in bet.wav',t:'beginning'},{d:'n',w:'n.wav',t:'beginning'},{d:'sion',w:null,tts:'shen',t:'ending'}],
  'vision':     [{d:'v',w:'v.wav',t:'beginning'},{d:'i',w:'ɪ as in bit.wav',t:'beginning'},{d:'sion',w:null,tts:'zhen',t:'ending'}],
  'division':   [{d:'d',w:'d.wav',t:'beginning'},{d:'i',w:'ɪ as in bit.wav',t:'beginning'},{d:'v',w:'v.wav',t:'beginning'},{d:'i',w:'ɪ as in bit.wav',t:'beginning'},{d:'sion',w:null,tts:'zhen',t:'ending'}],
  'musician':   [{d:'m',w:'m.wav',t:'beginning'},{d:'u',w:'uː as in pool.wav',t:'beginning'},{d:'s',w:'z.wav',t:'beginning'},{d:'i',w:'ɪ as in bit.wav',t:'beginning'},{d:'cian',w:null,tts:'shen',t:'ending'}],
  'magician':   [{d:'m',w:'m.wav',t:'beginning'},{d:'a',w:'æ as in bat.wav',t:'beginning'},{d:'g',w:'dʒ as in jar.wav',t:'beginning'},{d:'i',w:'ɪ as in bit.wav',t:'beginning'},{d:'cian',w:null,tts:'shen',t:'ending'}],
  'technician': [{d:'t',w:'t.wav',t:'beginning'},{d:'e',w:'e as in bet.wav',t:'beginning'},{d:'ch',w:'k.wav',t:'beginning'},{d:'n',w:'n.wav',t:'beginning'},{d:'i',w:'ɪ as in bit.wav',t:'beginning'},{d:'cian',w:null,tts:'shen',t:'ending'}],
  'politician': [{d:'p',w:'p.wav',t:'beginning'},{d:'o',w:'ɒ as in pot.wav',t:'beginning'},{d:'l',w:'l.wav',t:'beginning'},{d:'i',w:'ɪ as in bit.wav',t:'beginning'},{d:'t',w:'t.wav',t:'beginning'},{d:'i',w:'ɪ as in bit.wav',t:'beginning'},{d:'cian',w:null,tts:'shen',t:'ending'}],
  'physician':  [{d:'ph',w:'f.wav',t:'beginning'},{d:'y',w:'ɪ as in bit.wav',t:'beginning'},{d:'s',w:'z.wav',t:'beginning'},{d:'i',w:'ɪ as in bit.wav',t:'beginning'},{d:'cian',w:null,tts:'shen',t:'ending'}],
  'picture':    [{d:'p',w:'p.wav',t:'beginning'},{d:'i',w:'ɪ as in bit.wav',t:'beginning'},{d:'c',w:'k.wav',t:'beginning'},{d:'ture',w:null,tts:'chur',t:'ending'}],
  'nature':     [{d:'n',w:'n.wav',t:'beginning'},{d:'a',w:'eɪ as in bait.wav',t:'beginning'},{d:'ture',w:null,tts:'chur',t:'ending'}],
  'future':     [{d:'f',w:'f.wav',t:'beginning'},{d:'u',w:'uː as in pool.wav',t:'beginning'},{d:'ture',w:null,tts:'chur',t:'ending'}],
  'culture':    [{d:'c',w:'k.wav',t:'beginning'},{d:'u',w:'ʌ as in but.wav',t:'beginning'},{d:'l',w:'l.wav',t:'beginning'},{d:'ture',w:null,tts:'chur',t:'ending'}],
  'mixture':    [{d:'m',w:'m.wav',t:'beginning'},{d:'i',w:'ɪ as in bit.wav',t:'beginning'},{d:'x',w:'ks.wav',t:'beginning'},{d:'ture',w:null,tts:'chur',t:'ending'}],
  'capture':    [{d:'c',w:'k.wav',t:'beginning'},{d:'a',w:'æ as in bat.wav',t:'beginning'},{d:'p',w:'p.wav',t:'beginning'},{d:'ture',w:null,tts:'chur',t:'ending'}],
};
function getWp2Tiles(word) {
  return WP2_TILES[word] || null;
}

/* ══════════════════════════════════════════
   DATA — WORD PRONUNCIATION 1
══════════════════════════════════════════ */
const wp1Families = [
  { ending:'an', words:['man','can','pan','ran','fan','tan','van'] },
  { ending:'at', words:['cat','bat','hat','mat','rat','sat','pat'] },
  { ending:'ap', words:['cap','map','nap','tap','lap','gap'] },
  { ending:'ag', words:['bag','tag','rag','wag','lag'] },
  { ending:'am', words:['ham','jam','ram','dam','yam'] },
  { ending:'et', words:['pet','net','set','bet','met','wet'] },
  { ending:'en', words:['pen','hen','ten','men','den'] },
  { ending:'ig', words:['big','dig','fig','pig','wig'] },
  { ending:'in', words:['pin','bin','fin','tin','win'] },
  { ending:'ip', words:['lip','dip','hip','sip','tip','zip'] },
  { ending:'op', words:['hop','mop','top','pop','cop'] },
  { ending:'ot', words:['hot','pot','dot','lot','not'] },
  { ending:'ug', words:['bug','dug','hug','mug','rug'] },
  { ending:'un', words:['sun','fun','run','bun','gun'] },
];

/* ══════════════════════════════════════════
   DATA — WORD PRONUNCIATION 2
══════════════════════════════════════════ */
const wp2Families = [
  // 1. Consonant digraphs
  { cat:'Consonant pairs  (two letters, one sound)', ending:'sh', focus:['sh'], words:['ship','shop','fish','dish','shed','shell'], mode:'whole', patternHint:'<strong>sh</strong> makes one sound — like a quiet "shh". You can hear it at the start or end of a word.' },
  { cat:'Consonant pairs  (two letters, one sound)', ending:'ch', focus:['ch'], words:['chip','chat','much','rich','chop','chest'], mode:'whole', patternHint:'<strong>ch</strong> makes one sound — like in <em>chip</em>. It can come at the start or end of a word.' },
  { cat:'Consonant pairs  (two letters, one sound)', ending:'th', focus:['th'], words:['this','that','these','those'], mode:'whole', patternHint:'This <strong>th</strong> uses your voice — put your finger on your throat and feel it buzz. Try: <em>this… that…</em>' },
  { cat:'Consonant pairs  (two letters, one sound)', ending:'th', focus:['th'], words:['thin','think','bath','teeth'], mode:'whole', patternHint:'This <strong>th</strong> uses only air — no voice. Put your tongue between your teeth and blow. Try: <em>thin… think…</em>' },
  { cat:'Consonant pairs  (two letters, one sound)', ending:'wh', focus:['wh'], words:['when','what','why','where'], mode:'whole', patternHint:'<strong>wh</strong> usually makes a "w" sound — like in <em>when</em> and <em>what</em>.' },
  { cat:'Consonant pairs  (two letters, one sound)', ending:'ph', focus:['ph'], words:['phone','photo','graph','elephant'], mode:'whole', patternHint:'<strong>ph</strong> makes an "f" sound — like in <em>phone</em>. It comes from Greek words.' },
  // 2a. Long vowel pairs
  { cat:'Vowel pairs — long sounds', ending:'ee', focus:['ee'], words:['see','tree','bee','feet'], mode:'whole', patternHint:'<strong>ee</strong> makes a long "ee" sound — like in <em>see</em>.' },
  { cat:'Vowel pairs — long sounds', ending:'ea', focus:['ea'], words:['eat','team','meat','read'], mode:'whole', patternHint:'<strong>ea</strong> makes a long "ee" sound — like in <em>eat</em>.' },
  { cat:'Vowel pairs — long sounds', ending:'ai', focus:['ai'], words:['rain','train','mail','tail'], mode:'whole', patternHint:'<strong>ai</strong> makes a long "ay" sound — like in <em>rain</em>.' },
  { cat:'Vowel pairs — long sounds', ending:'ay', focus:['ay'], words:['day','play','say','way'], mode:'whole', patternHint:'<strong>ay</strong> makes a long "ay" sound — like in <em>day</em>.' },
  { cat:'Vowel pairs — long sounds', ending:'oa', focus:['oa'], words:['boat','coat','road','soap'], mode:'whole', patternHint:'<strong>oa</strong> makes a long "oh" sound — like in <em>boat</em>.' },
  { cat:'Vowel pairs — long sounds', ending:'oe', focus:['oe'], words:['toe','goes','toes','hoe'], mode:'whole', patternHint:'<strong>oe</strong> makes a long "oh" sound — like in <em>toe</em>.' },
  { cat:'Vowel pairs — long sounds', ending:'ie', focus:['ie'], words:['pie','tie','lie','die'], mode:'whole', patternHint:'<strong>ie</strong> makes a long "eye" sound — like in <em>pie</em>.' },
  { cat:'Vowel pairs — long sounds', ending:'ue', focus:['ue'], words:['blue','glue','true','clue'], mode:'whole', patternHint:'<strong>ue</strong> makes a long "oo" or "you" sound — like in <em>blue</em>.' },
  // 2b. Other vowel pairs
  { cat:'Vowel pairs — other sounds', ending:'oo', focus:['oo'], words:['moon','food','soon','pool','cool','roof'], mode:'whole', patternHint:'<strong>oo</strong> here makes a long sound — like in <em>moon</em>. Say it with a long "oo".' },
  { cat:'Vowel pairs — other sounds', ending:'oo', focus:['oo'], words:['book','look','cook','foot','good','wood'], mode:'whole', patternHint:'<strong>oo</strong> here makes a short sound — like in <em>book</em>. The lips round but the sound is shorter.' },
  { cat:'Vowel pairs — other sounds', ending:'ou', focus:['ou'], words:['out','loud','sound','found','mouth','count'], mode:'whole', patternHint:'<strong>ou</strong> here makes an "ow" sound — like in <em>out</em>.' },
  { cat:'Vowel pairs — other sounds', ending:'ou', focus:['ou'], words:['could','would','should','your','four','pour'], mode:'whole', patternHint:'<strong>ou</strong> here makes different sounds — "ood" in <em>could</em>, "or" in <em>four</em>. Listen carefully to each word.' },
  { cat:'Vowel pairs — other sounds', ending:'ow', focus:['ow'], words:['cow','now','snow','low'], mode:'whole', patternHint:'<strong>ow</strong> can sound like "ow" in <em>cow</em>, or "oh" in <em>snow</em>. Both are common.' },
  { cat:'Vowel pairs — other sounds', ending:'oi', focus:['oi'], words:['coin','join','boil','soil'], mode:'whole', patternHint:'<strong>oi</strong> makes an "oy" sound — like in <em>coin</em>.' },
  { cat:'Vowel pairs — other sounds', ending:'oy', focus:['oy'], words:['boy','toy','enjoy','annoy'], mode:'whole', patternHint:'<strong>oy</strong> makes the same sound as <strong>oi</strong> — like in <em>boy</em>.' },
  { cat:'Vowel pairs — other sounds', ending:'au', focus:['au'], words:['author','August','auto','haul'], mode:'whole', patternHint:'<strong>au</strong> makes an "aw" sound — like in <em>author</em>.' },
  { cat:'Vowel pairs — other sounds', ending:'aw', focus:['aw'], words:['saw','law','paw','draw'], mode:'whole', patternHint:'<strong>aw</strong> makes the same sound as <strong>au</strong> — like in <em>saw</em>.' },
  // 3. Silent e
  { cat:'Silent "e"  (the e at the end changes the vowel sound)', ending:'ake', focus:['e'], words:['cake','make','take','lake'], mode:'whole' },
  { cat:'Silent "e"  (the e at the end changes the vowel sound)', ending:'ate', focus:['e'], words:['late','mate','gate','hate'], mode:'whole' },
  { cat:'Silent "e"  (the e at the end changes the vowel sound)', ending:'ine', focus:['e'], words:['fine','line','mine','nine'], mode:'whole' },
  { cat:'Silent "e"  (the e at the end changes the vowel sound)', ending:'ope', focus:['e'], words:['hope','rope','cope','nope'], mode:'whole' },
  { cat:'Silent "e"  (the e at the end changes the vowel sound)', ending:'ute', focus:['e'], words:['cute','mute','flute'], mode:'whole' },
  { cat:'Silent "e"  (the e at the end changes the vowel sound)', ending:'ide', focus:['e'], words:['ride','side','hide','wide'], mode:'whole' },
  { cat:'Silent "e"  (the e at the end changes the vowel sound)', ending:'ame', focus:['e'], words:['game','name','same','came'], mode:'whole' },
  { cat:'Silent "e"  (the e at the end changes the vowel sound)', ending:'ore', focus:['e'], words:['more','core','sore','bore'], mode:'whole' },
  // 4. Beginning blends — focus = the two blend consonants as separate tiles
  { cat:'Beginning blends  (both sounds heard)', ending:'st', focus:['s','t'], words:['stop','step','stand','stick'], mode:'whole', patternHint:'<strong>st</strong> = s + t. Both sounds are heard. Try slowly: <em>s… t… stop.</em>' },
  { cat:'Beginning blends  (both sounds heard)', ending:'bl', focus:['b','l'], words:['black','blue','block','blow'],  mode:'whole', patternHint:'<strong>bl</strong> = b + l. Try slowly: <em>b… l… black.</em>' },
  { cat:'Beginning blends  (both sounds heard)', ending:'tr', focus:['t','r'], words:['tree','train','truck','trip'],  mode:'whole', patternHint:'<strong>tr</strong> = t + r. Try slowly: <em>t… r… tree.</em>' },
  { cat:'Beginning blends  (both sounds heard)', ending:'dr', focus:['d','r'], words:['drop','drum','dress','drink'], mode:'whole', patternHint:'<strong>dr</strong> = d + r. Try slowly: <em>d… r… drop.</em>' },
  { cat:'Beginning blends  (both sounds heard)', ending:'cl', focus:['c','l'], words:['class','clap','clock','clean'], mode:'whole', patternHint:'<strong>cl</strong> = c + l. Try slowly: <em>c… l… class.</em>' },
  { cat:'Beginning blends  (both sounds heard)', ending:'fl', focus:['f','l'], words:['flag','flat','flip','fly'],    mode:'whole', patternHint:'<strong>fl</strong> = f + l. Try slowly: <em>f… l… flag.</em>' },
  { cat:'Beginning blends  (both sounds heard)', ending:'gr', focus:['g','r'], words:['green','grab','grow','great'], mode:'whole', patternHint:'<strong>gr</strong> = g + r. Try slowly: <em>g… r… green.</em>' },
  { cat:'Beginning blends  (both sounds heard)', ending:'pl', focus:['p','l'], words:['play','plan','plant','please'],mode:'whole', patternHint:'<strong>pl</strong> = p + l. Try slowly: <em>p… l… play.</em>' },
  { cat:'Beginning blends  (both sounds heard)', ending:'br', focus:['b','r'], words:['brown','bring','bread','brush'],mode:'whole', patternHint:'<strong>br</strong> = b + r. Try slowly: <em>b… r… brown.</em>' },
  { cat:'Beginning blends  (both sounds heard)', ending:'cr', focus:['c','r'], words:['crab','cry','crop','cross'],   mode:'whole', patternHint:'<strong>cr</strong> = c + r. Try slowly: <em>c… r… crab.</em>' },
  { cat:'Beginning blends  (both sounds heard)', ending:'sl', focus:['s','l'], words:['slip','slow','sleep','slide'], mode:'whole', patternHint:'<strong>sl</strong> = s + l. Try slowly: <em>s… l… slip.</em>' },
  { cat:'Beginning blends  (both sounds heard)', ending:'sp', focus:['s','p'], words:['spin','spot','speak','spoon'], mode:'whole', patternHint:'<strong>sp</strong> = s + p. Try slowly: <em>s… p… spin.</em>' },
  // 5. Common endings
  { cat:'Common endings', ending:'ck',  focus:['ck'],  words:['back','duck','pick','rock'],      mode:'whole', patternHint:'<strong>ck</strong> makes a "k" sound. The two letters work as one.' },
  { cat:'Common endings', ending:'ll',  focus:['ll'],  words:['ball','bell','fill','doll'],      mode:'whole', patternHint:'<strong>ll</strong> makes a single "l" sound.' },
  { cat:'Common endings', ending:'ff',  focus:['ff'],  words:['off','puff','cliff','staff'],     mode:'whole', patternHint:'<strong>ff</strong> makes a single "f" sound.' },
  { cat:'Common endings', ending:'ss',  focus:['ss'],  words:['miss','pass','dress'],      mode:'whole', patternHint:'<strong>ss</strong> makes a single "s" sound.' },
  { cat:'Common endings', ending:'zz',  focus:['zz'],  words:['buzz','jazz','fizz','fuzz'],      mode:'whole', patternHint:'<strong>zz</strong> makes a single "z" sound.' },
  { cat:'Common endings', ending:'tch', focus:['tch'], words:['catch','match','watch','pitch'],  mode:'whole', patternHint:'<strong>tch</strong> makes a "ch" sound — like in <em>catch</em>. It always comes after a short vowel.' },
  { cat:'Common endings', ending:'dge', focus:['dge'], words:['bridge','edge','badge','judge'],  mode:'whole', patternHint:'<strong>dge</strong> makes a "j" sound — like in <em>bridge</em>. It always comes after a short vowel.' },
  { cat:'Common endings', ending:'ed',  focus:['ed'],  words:['jumped','played','looked','helped'], mode:'whole', patternHint:'<strong>ed</strong> at the end can sound like "d" (played), "t" (looked), or "id" (wanted).' },
  { cat:'Common endings', ending:'ing', focus:['i','ng'], words:['going','playing','looking','eating'], mode:'whole', patternHint:'<strong>ing</strong> is added to verbs to show something is happening now.' },
  // 6. Word endings — sounds like "shun" / "cher"
  { cat:'Word endings  (-tion, -sion, -cian, -ture)', ending:'tion',  focus:['tion'],  words:['nation','station','action','mention','motion','section'], mode:'whole', patternHint:'<strong>tion</strong> sounds like "shun" — like in <em>nation</em>. It is one of the most common word endings in English.' },
  { cat:'Word endings  (-tion, -sion, -cian, -ture)', ending:'sion',  focus:['sion','ssion'],  words:['mission','session','passion','tension','vision','division'], mode:'whole', patternHint:'<strong>sion</strong> can sound like "shun" (mission) or "zhun" (vision). Listen carefully to each word.' },
  { cat:'Word endings  (-tion, -sion, -cian, -ture)', ending:'cian',  focus:['cian'],  words:['musician','magician','technician','politician','physician'], mode:'whole', patternHint:'<strong>cian</strong> sounds like "shun" — like in <em>musician</em>. It usually refers to a person with a skill.' },
  { cat:'Word endings  (-tion, -sion, -cian, -ture)', ending:'ture',  focus:['ture'],  words:['picture','nature','future','culture','mixture','capture'], mode:'whole', patternHint:'<strong>ture</strong> sounds like "cher" — like in <em>picture</em>. Say it as one quick sound: "p-ik-cher".' },
];

/* ══════════════════════════════════════════
   VOICE SELECTION
══════════════════════════════════════════ */
let selectedVoiceGender = 'female';
const VOICE_PITCH = { female: 1.2, male: 0.75 };
const FEMALE_NAMES = /karen|catherine|zira|samantha|victoria|moira|fiona|tessa|kyoko|am[eé]lie|anna|serena|alice|joanna|salli|kimberly|kendra|ivy|aria|jenny|libby|mia|natasha|nicole|nicky|raveena|veena|allison|ava|\bfemale\b/i;
const MALE_NAMES   = /daniel|david|james|tom|liam|george|oliver|nathan|gordon|bruce|rishi|arthur|matthew|mark|russell|wayne|fred|\bmale\b/i;

function classifyVoice(voice) {
  const n = voice.name || '';
  if (FEMALE_NAMES.test(n)) return 'female';
  if (MALE_NAMES.test(n))   return 'male';
  return 'unknown';
}
function getEnglishVoices() {
  const all = window.speechSynthesis ? window.speechSynthesis.getVoices() : [];
  const au = all.filter(v => v.lang === 'en-AU');
  const gb = all.filter(v => v.lang === 'en-GB');
  const en = all.filter(v => v.lang && v.lang.startsWith('en'));
  return au.length ? au : gb.length ? gb : en;
}
function pickVoice(gender) {
  const voices = getEnglishVoices();
  const match = voices.find(v => classifyVoice(v) === gender);
  return match || voices[0] || null;
}
function onVoiceSelectChange() {
  const sel = document.getElementById('voiceSelect');
  if (sel) {
    selectedVoiceGender = sel.value;
    localStorage.setItem('wl_voice', sel.value);
  }
}
function applyVoice(utt) {
  const v = pickVoice(selectedVoiceGender);
  if (v) { utt.voice = v; utt.lang = v.lang; } else { utt.lang = 'en-AU'; }
  utt.pitch = VOICE_PITCH[selectedVoiceGender] || 1.0;
}

/* ══════════════════════════════════════════
   ONE TILE SHAPE FOR BOTH LEVELS
   getWp1Tiles returns {display,wav}; WP2_TILES holds {d,w,t,tts}.
   Callers that only want "how is this word built and how does each part
   sound" should ask here and get {d,w,tts} either way.
   Returns null for a word neither map knows.
══════════════════════════════════════════ */
function phonicsTiles(word) {
  const w = (word || '').toLowerCase();
  const wp2 = WP2_TILES[w];
  if (wp2) return wp2.map(t => ({ d: t.d, w: t.w || null, tts: t.tts || null }));
  // Every WP1 word is a short-vowel CVC, so the letters are the graphemes.
  if (/^[a-z]+$/.test(w) && w.length <= 4) {
    const tiles = getWp1Tiles(w);
    if (tiles.every(t => t.wav)) return tiles.map(t => ({ d: t.display, w: t.wav, tts: null }));
  }
  return null;
}

/* True when the word can be sounded out chunk by chunk.

   A chunk with no recording is not automatically a problem: the e in "cake"
   and the l in "could" are *silent*, so having nothing to play is the right
   answer for them. What matters is a chunk that has a sound but no recording
   — those carry a tts fallback, and only the -ed ending and a couple of
   others do among the words the game uses.

   allowSpoken lets a word through with at most one such chunk, which
   playWordSounds says aloud between the recordings. Without it the whole
   silent-e category and the -ed past tense would be excluded, which is the
   opposite of what a decoding game wants. */
function canSoundOut(word, allowSpoken) {
  const t = phonicsTiles(word);
  if (!t || t.map(x => x.d).join('') !== word) return false;
  const spoken = t.filter(x => !x.w && x.tts).length;
  return allowSpoken ? spoken <= 1 : spoken === 0;
}

/* ══════════════════════════════════════════
   SOUND IT OUT
   Play a word grapheme by grapheme from the recordings, then hand back so
   the caller can say the whole word. Sequencing is on 'ended' rather than
   timers, so a slow device stretches the gaps instead of overlapping.
   speakPart is the caller's text-to-speech, used only for the few tiles
   that have no recording (the -tion/-ture endings).
══════════════════════════════════════════ */
function playWordSounds(word, opts) {
  opts = opts || {};
  const tiles = phonicsTiles(word);
  const done = opts.done || function () {};
  if (!tiles) { done(); return function () {}; }
  const gap = opts.gap === undefined ? 260 : opts.gap;
  let i = 0, cancelled = false, timer = null, audio = null;
  const step = () => {
    if (cancelled) return;
    if (i >= tiles.length) { done(); return; }
    const t = tiles[i++];
    if (!t.w) {
      // No recording for this chunk — say it, then carry on.
      if (opts.speakPart) opts.speakPart(t.tts || t.d);
      timer = setTimeout(step, 700);
      return;
    }
    try {
      audio = new Audio(AUDIO_BASE + t.w);
      audio.onended = audio.onerror = () => { timer = setTimeout(step, gap); };
      audio.play().catch(() => { timer = setTimeout(step, gap); });
    } catch (e) { timer = setTimeout(step, gap); }
  };
  step();
  return function cancel() {
    cancelled = true;
    if (timer) clearTimeout(timer);
    if (audio) { try { audio.pause(); } catch (e) {} }
  };
}
