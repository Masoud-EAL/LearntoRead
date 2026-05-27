const CACHE = 'learntoread-v9';

// Core files — must all succeed or install fails
const CORE = [
  './',
  './index.html',
  './game.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
];

// Optional files — cached individually; one failure won't block install
const OPTIONAL = [
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
  './audio/a%C9%AA%20as%20in%20ice.wav',
  './audio/a%CA%8A%20as%20in%20out.wav',
  './audio/d%CA%92%20as%20in%20jar.wav',
  './audio/e%20as%20in%20bet.wav',
  './audio/e%C9%AA%20as%20in%20bait.wav',
  './audio/i%CB%90%20as%20in%20eat.wav',
  './audio/j%20as%20in%20yam.wav',
  './audio/t%CA%83%20as%20in%20chair.wav',
  './audio/u%CB%90%20as%20in%20pool.wav',
  './audio/%C3%A6%20as%20in%20bat.wav',
  './audio/%C3%B0%20as%20in%20this.wav',
  './audio/%C5%8B%20as%20in%20sing.wav',
  './audio/%C9%91%CB%90%20as%20in%20hard.wav',
  './audio/%C9%92%20as%20in%20pot.wav',
  './audio/%C9%94%C9%AA%20as%20in%20boil.wav',
  './audio/%C9%94%CB%90%20as%20in%20storm.wav',
  './audio/%C9%99%CA%8A%20as%20in%20boat.wav',
  './audio/%C9%9C%CB%90%20as%20in%20work.wav',
  './audio/%C9%AA%20as%20in%20bit.wav',
  './audio/%C9%AA%C9%99%20as%20in%20fear.wav',
  './audio/%CA%83%20as%20in%20she.wav',
  './audio/%CA%8A%20as%20in%20book.wav',
  './audio/%CA%8C%20as%20in%20but.wav',
  './audio/%CA%92%20as%20in%20pleasure.wav',
  './audio/%CE%B8%20as%20in%20thin.wav',
  './audio/cheer-1st.wav',
  './audio/cheer-2nd.wav',
  './audio/cheer-3rd.wav',
  './translations/fa.json',
  './translations/vi.json',
  './translations/zh.json',
  './translations/ur.json',
  './translations/km.json',
  './translations/my.json',
  './translations/hi.json',
  './translations/ar.json',
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(c =>
      // Core pages must succeed
      c.addAll(CORE).then(() =>
        // Audio + translations: cache each individually, skip on error
        Promise.allSettled(OPTIONAL.map(url => c.add(url)))
      )
    ).then(() => self.skipWaiting())
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
    fetch(e.request).then(response => {
      if (response.ok) {
        caches.open(CACHE).then(c => c.put(e.request, response.clone()));
      }
      return response;
    }).catch(() => caches.match(e.request))
  );
});
