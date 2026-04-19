/* GymTrack — Service Worker v2
   Strategia: Cache First per assets locali, Network First per Google Fonts
*/

const CACHE = 'gymtrack-v2';
const ASSETS = [
  './',
  './index.html',
  './manifest.json'
];

/* ── Genera icona dumbbell su canvas e restituisce un Response PNG ── */
function makeIconResponse(size){
  const canvas = new OffscreenCanvas(size, size);
  const ctx = canvas.getContext('2d');
  const r = size * 0.13; // corner radius sfondo

  /* Sfondo carbone arrotondato */
  ctx.fillStyle = '#111111';
  ctx.beginPath();
  ctx.moveTo(r, 0);
  ctx.lineTo(size - r, 0);
  ctx.quadraticCurveTo(size, 0, size, r);
  ctx.lineTo(size, size - r);
  ctx.quadraticCurveTo(size, size, size - r, size);
  ctx.lineTo(r, size);
  ctx.quadraticCurveTo(0, size, 0, size - r);
  ctx.lineTo(0, r);
  ctx.quadraticCurveTo(0, 0, r, 0);
  ctx.closePath();
  ctx.fill();

  /* Disegna manubrio SVG scalato */
  const s = size;
  ctx.fillStyle = '#ffffff';
  ctx.strokeStyle = '#ffffff';

  const scale = s / 24;
  ctx.save();
  ctx.scale(scale, scale);

  // Barra centrale
  ctx.beginPath();
  ctx.roundRect(4.5, 11, 15, 2, 1);
  ctx.fill();

  // Dischi interni sx e dx
  ctx.beginPath();
  ctx.roundRect(6, 9, 3, 6, 1.2);
  ctx.fill();
  ctx.beginPath();
  ctx.roundRect(15, 9, 3, 6, 1.2);
  ctx.fill();

  // Estremità sx
  ctx.globalAlpha = 0.85;
  ctx.beginPath();
  ctx.roundRect(1.5, 8.5, 3, 7, 1.2);
  ctx.fill();

  // Estremità dx
  ctx.beginPath();
  ctx.roundRect(19.5, 8.5, 3, 7, 1.2);
  ctx.fill();
  ctx.globalAlpha = 1;

  ctx.restore();

  return canvas.convertToBlob({ type: 'image/png' }).then(blob =>
    new Response(blob, { headers: { 'Content-Type': 'image/png' } })
  );
}

/* ── Install: pre-cache assets + icone generate ── */
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(async c => {
      await c.addAll(ASSETS);
      // Genera e metti in cache le icone PNG via canvas
      const [icon192, icon512] = await Promise.all([
        makeIconResponse(192),
        makeIconResponse(512)
      ]);
      await c.put('./icon-192.png', icon192);
      await c.put('./icon-512.png', icon512);
    })
  );
  self.skipWaiting();
});

/* ── Activate: pulisci vecchie cache ── */
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

/* ── Fetch: Cache First, fallback Network ── */
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);

  /* Google Fonts: Network First con fallback cache */
  if(url.hostname.includes('fonts.googleapis.com') || url.hostname.includes('fonts.gstatic.com')){
    e.respondWith(
      fetch(e.request)
        .then(res => {
          const clone = res.clone();
          caches.open(CACHE).then(c => c.put(e.request, clone));
          return res;
        })
        .catch(() => caches.match(e.request))
    );
    return;
  }

  /* Assets locali: Cache First */
  e.respondWith(
    caches.match(e.request).then(cached => {
      if(cached) return cached;
      return fetch(e.request).then(res => {
        if(res && res.status === 200 && res.type !== 'opaque'){
          const clone = res.clone();
          caches.open(CACHE).then(c => c.put(e.request, clone));
        }
        return res;
      });
    })
  );
});
