/* ══════════════════════════════════════════════════════════
   WordLink — the one place that says something out loud

   Loaded by index.html, game.html and tracing.html, ahead of anything that
   speaks. It exists because "how does this app talk" was written out
   fourteen times over and the copies drifted apart. Two learner reports came
   out of that drift, and both are answered here.

   "The pronunciation did not play, even though my phone volume was up."
   A phone pauses the speech engine when the page goes into the background,
   which for a learner is a notification, the lock screen, a call, or a look
   at a translation app, and it does not reliably start again. Every word
   after that is accepted and never heard. So the engine is woken before
   anything is said, every time.

   "Australian English is not on this phone."
   Google and Apple ship a default voice set and download the rest on demand,
   so a phone can hold en-US or en-GB and no en-AU at all, or list an
   Australian voice whose data was never downloaded. Asking such a phone for
   en-AU gets silence. Australian English is what this app teaches, so it is
   asked for first, but never having it must not mean having no sound: the
   ladder walks down through British, New Zealand, Irish and American to any
   English the phone does have, and steps down again at runtime if the voice
   it picked turns out to be hollow.
══════════════════════════════════════════════════════════ */

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

/* Australian first, because that is the English being taught, then the
   accents nearest it, then American, then whatever else the phone calls
   English. */
const EN_ORDER = ['en-au', 'en-gb', 'en-nz', 'en-ie', 'en-us'];

/* Android reports en_AU with an underscore, and Chrome reports
   en-AU-x-sfg#female_1. Both used to fail an === 'en-AU' test and fall
   through to the bottom of the ladder, so a phone that DID have the
   Australian voice could still be handed an American one. Compared by prefix
   on a normalised string now. */
function voiceLang(v) {
  return String((v && v.lang) || '').toLowerCase().replace(/_/g, '-');
}
function rungOf(v) {
  const lang = voiceLang(v);
  for (let i = 0; i < EN_ORDER.length; i++) {
    if (lang.indexOf(EN_ORDER[i]) === 0) return i;
  }
  return EN_ORDER.length;
}

/* Every English voice the phone has, best accent first, and within one
   accent the asked-for gender first. The order is the order they are tried
   in, so this is both the preference and the fallback. */
function voiceLadder(gender) {
  const all = window.speechSynthesis ? (window.speechSynthesis.getVoices() || []) : [];
  const english = all.filter(v => voiceLang(v).indexOf('en') === 0);
  return english
    .map((v, i) => ({ v: v, rung: rungOf(v), gender: classifyVoice(v) === gender ? 0 : 1, i: i }))
    .sort((a, b) => (a.rung - b.rung) || (a.gender - b.gender) || (a.i - b.i))
    .map(x => x.v);
}
function pickVoice(gender) {
  return voiceLadder(gender)[0] || null;
}
function onVoiceSelectChange() {
  const sel = document.getElementById('voiceSelect');
  if (sel) {
    selectedVoiceGender = sel.value;
    localStorage.setItem('wl_voice', sel.value);
  }
}
/* Setting lang alone does NOT choose a voice: without a voice the browser
   reads English with whatever the device default is, which on many phones is
   not an English voice at all. Isolated words are where that hurts most.
   With no voice to give, this asks for plain 'en' rather than 'en-AU', since
   an engine holding only American English will honour a bare English request
   and will not honour a locale it has never downloaded. */
function applyVoice(utt) {
  const v = pickVoice(selectedVoiceGender);
  if (v) { utt.voice = v; utt.lang = v.lang; } else { utt.lang = 'en'; }
  utt.pitch = VOICE_PITCH[selectedVoiceGender] || 1.0;
}

/* The voice that has been heard to work on this device, so the ladder is
   walked once a session and not once a word. */
let workingVoice = null;
let noEnglishVoice = false;
let speakToken = 0;

/* True only once every rung has been tried and none of them made a sound.
   It starts false and is cleared for good by the first word that is heard,
   so a phone that works is never told it cannot speak. */
function speechIsSilent() { return noEnglishVoice; }

/* getVoices() is empty until the device has loaded its list, and the list
   arrives after the page does. Speaking into that gap is what sent a bare
   en-AU request to phones that had no Australian voice, so the first word of
   a session waits a moment for the list rather than guessing without it. */
function whenVoicesReady(fn) {
  const s = window.speechSynthesis;
  if (!s || (s.getVoices() || []).length) { fn(); return; }
  let done = false;
  const go = function () { if (done) return; done = true; clearTimeout(timer); fn(); };
  const timer = setTimeout(go, 400);
  try { s.addEventListener('voiceschanged', go, { once: true }); } catch (e) { /* older engine */ }
}

function speakUtterance(utt) {
  const s = window.speechSynthesis;
  if (!s) return;
  // The caller's handlers belong to whichever attempt finally speaks, not to
  // the ones that were tried and found hollow, or a button would stop looking
  // like it is playing while the next rung is still being tried.
  const userEnd = utt.onend || null, userErr = utt.onerror || null;
  utt.onend = null; utt.onerror = null;
  const mine = ++speakToken;

  whenVoicesReady(function () {
    if (mine !== speakToken) return;   // a newer press has taken this over
    const ladder = workingVoice ? [workingVoice] : voiceLadder(selectedVoiceGender);
    attempt(0);

    function attempt(i) {
      if (mine !== speakToken) return;
      const v = ladder[i] || null;
      const say = new SpeechSynthesisUtterance(utt.text);
      say.rate = utt.rate; say.pitch = utt.pitch; say.volume = utt.volume;
      // Past the end of the ladder there is one rung left: no voice at all and
      // a plain English request, which is the most any engine can be asked for.
      if (v) { say.voice = v; say.lang = v.lang; } else { say.lang = 'en'; }

      let moved = false, watchdog = null;
      const heard = function () {
        if (moved) return; moved = true;
        clearTimeout(watchdog);
        workingVoice = v; noEnglishVoice = false;
        if (userEnd) userEnd();
      };
      const hollow = function () {
        if (moved) return; moved = true;
        clearTimeout(watchdog);
        if (i <= ladder.length - 1) { attempt(i + 1); return; }
        // Every rung tried, nothing heard: this phone has no English voice.
        noEnglishVoice = true;
        if (userErr) userErr();
      };
      say.addEventListener('start', function () {
        clearTimeout(watchdog);
        workingVoice = v; noEnglishVoice = false;
      });
      say.addEventListener('end', heard);
      say.addEventListener('error', function (e) {
        // Our own cancel, or a newer press: not a verdict on the voice.
        const why = e && e.error;
        if (why === 'canceled' || why === 'interrupted') return;
        hollow();
      });

      // cancel() first: one voice at a time, and the word just asked for is the
      // one the learner is waiting on. resume() whether or not `paused` is set,
      // because several phones report that wrong, and it costs nothing on an
      // engine that is already running.
      try { s.cancel(); s.resume(); } catch (e) { /* engine not ready */ }
      s.speak(say);

      /* An Australian voice that is listed but was never downloaded takes the
         utterance and says nothing: no error, no start, no end. Nothing but a
         clock can tell us, so one is set, and a page in the background is not
         counted against it. */
      watchdog = setTimeout(function () {
        if (moved || mine !== speakToken) return;
        if (document.visibilityState === 'hidden') return;
        if (s.speaking || s.pending) { clearTimeout(watchdog); return; }
        hollow();
      }, 1500);
    }
  });
}

if (window.speechSynthesis) {
  document.addEventListener('visibilitychange', function () {
    try {
      // On the way out, drop what was being said: resuming a backlog would read
      // out words from a question the learner has already moved past. On the
      // way back, leave the engine running so the next press is heard.
      if (document.visibilityState === 'hidden') window.speechSynthesis.cancel();
      else window.speechSynthesis.resume();
    } catch (e) { /* engine not ready */ }
  });

  /* Asking for the list is what starts it loading, and asking again when the
     browser says it changed is how the good voices replace the first poor
     ones. */
  try {
    window.speechSynthesis.getVoices();
    window.speechSynthesis.onvoiceschanged = function () {
      try { window.speechSynthesis.getVoices(); } catch (e) {}
    };
  } catch (e) {}

  /* A phone will not speak at all until the first utterance comes from a
     touch. A learner practising alone taps Start, so that one is covered, but
     a question in a class arrives from the room rather than from their finger,
     and the first one was lost. An empty utterance on the first touch anywhere
     opens the engine, and costs nothing on a device that did not need it. */
  const openSpeech = function () {
    ['pointerdown', 'touchstart', 'keydown'].forEach(function (ev) {
      document.removeEventListener(ev, openSpeech);
    });
    try { window.speechSynthesis.speak(new SpeechSynthesisUtterance('')); } catch (e) {}
  };
  ['pointerdown', 'touchstart', 'keydown'].forEach(function (ev) {
    document.addEventListener(ev, openSpeech);
  });
}
