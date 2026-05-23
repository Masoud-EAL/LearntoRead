const CACHE = 'learntoread-v3';

const PRECACHE = [
  './',
  './index.html',
  './game.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  './audio/b.wav',
  './audio/d.wav',
  './audio/f.wav',
  './audio/g.wav',
  './audio/h.wav',
  './audio/k.wav',
  './audio/ks.wav',
  './audio/kw.wav',
  './audio/l.wav',
  './audio/m.wav',
  './audio/n.wav',
  './audio/p.wav',
  './audio/r.wav',
  './audio/s.wav',
  './audio/t.wav',
  './audio/v.wav',
  './audio/w.wav',
  './audio/z.wav',
  './audio/aɪ as in ice.wav',
  './audio/aʊ as in out.wav',
  './audio/dʒ as in jar.wav',
  './audio/e as in bet.wav',
  './audio/eɪ as in bait.wav',
  './audio/iː as in eat.wav',
  './audio/j as in yam.wav',
  './audio/tʃ as in chair.wav',
  './audio/uː as in pool.wav',
  './audio/æ as in bat.wav',
  './audio/ð as in this.wav',
  './audio/ŋ as in sing.wav',
  './audio/ɑː as in hard.wav',
  './audio/ɒ as in pot.wav',
  './audio/ɔɪ as in boil.wav',
  './audio/ɔː as in storm.wav',
  './audio/əʊ as in boat.wav',
  './audio/ɜː as in work.wav',
  './audio/ɪ as in bit.wav',
  './audio/ɪə as in fear.wav',
  './audio/ʃ as in she.wav',
  './audio/ʊ as in book.wav',
  './audio/ʌ as in but.wav',
  './audio/ʒ as in pleasure.wav',
  './audio/θ as in thin.wav',
  './translations/fa.json',
  './translations/vi.json',
  './translations/zh.json',
  './translations/ur.json',
  './translations/km.json',
  './translations/my.json',
  './translations/hi.json',
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE)
      .then(c => c.addAll(PRECACHE))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(k => k !== CACHE).map(k => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  if (new URL(e.request.url).origin !== self.location.origin) return;

  e.respondWith(
    caches.match(e.request).then(cached => {
      if (cached) return cached;
      return fetch(e.request).then(response => {
        if (response.ok) {
          caches.open(CACHE).then(c => c.put(e.request, response.clone()));
        }
        return response;
      });
    })
  );
});
