// ─────────────────────────────────────────────────────────────────
//  SMART staff app service worker (registered in production only).
//
//  Goal: the home-screen icon opens with the last known shell even on a
//  flaky connection, while every login / Firestore / Storage request
//  still goes straight to the network — attendance data must never be
//  served from a cache.
//
//  · navigation  → network first, cached shell as offline fallback
//  · same-origin static (js/css/img/font) → stale-while-revalidate
//  · anything else (Firebase, gstatic, fonts API) → untouched
// ─────────────────────────────────────────────────────────────────
const VERSION = 'smart-shell-v1';
const SHELL = [
  '/',
  '/index.html',
  '/manifest.webmanifest',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/apple-touch-icon.png',
];
const STATIC_RE = /\.(?:js|mjs|css|png|jpe?g|svg|webp|gif|ico|woff2?|ttf)$/i;

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(VERSION)
      .then((cache) => cache.addAll(SHELL).catch(() => undefined))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // Firebase / fonts: never cached
  if (url.pathname.startsWith('/__/')) return;     // dev/analytics helpers

  // SPA navigations — fresh page when online, cached shell when not.
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((res) => {
          if (res && res.ok) {
            const copy = res.clone();
            caches.open(VERSION).then((cache) => cache.put('/index.html', copy)).catch(() => {});
          }
          return res;
        })
        .catch(() => caches.match('/index.html').then((hit) => hit || caches.match('/'))),
    );
    return;
  }

  if (STATIC_RE.test(url.pathname)) {
    event.respondWith(
      caches.match(req).then((hit) => {
        const network = fetch(req)
          .then((res) => {
            if (res && res.ok) {
              const copy = res.clone();
              caches.open(VERSION).then((cache) => cache.put(req, copy)).catch(() => {});
            }
            return res;
          })
          .catch(() => hit);
        return hit || network;
      }),
    );
  }
});
