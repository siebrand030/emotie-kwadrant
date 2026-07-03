/* Emotie Kwadrant — service worker.
   Cache-first app-shell + runtime-cache voor Google Fonts (offline gebruik). */
var VERSION = 'kwadrant-v1';
var SHELL = 'shell-' + VERSION;
var FONTS = 'fonts-' + VERSION;

var SHELL_ASSETS = [
  './',
  './index.html',
  './styles.css',
  './app.js',
  './manifest.webmanifest',
  './icon-180.png',
  './icon-192.png',
  './icon-512.png'
];

self.addEventListener('install', function (event) {
  event.waitUntil(
    caches.open(SHELL).then(function (cache) { return cache.addAll(SHELL_ASSETS); })
      .then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.map(function (k) {
        if (k !== SHELL && k !== FONTS) return caches.delete(k);
      }));
    }).then(function () { return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function (event) {
  var req = event.request;
  if (req.method !== 'GET') return;

  var url = new URL(req.url);

  // Google Fonts: stale-while-revalidate zodat lettertypes offline beschikbaar blijven.
  if (url.origin === 'https://fonts.googleapis.com' || url.origin === 'https://fonts.gstatic.com') {
    event.respondWith(
      caches.open(FONTS).then(function (cache) {
        return cache.match(req).then(function (cached) {
          var network = fetch(req).then(function (res) {
            if (res && (res.ok || res.type === 'opaque')) cache.put(req, res.clone());
            return res;
          }).catch(function () { return cached; });
          return cached || network;
        });
      })
    );
    return;
  }

  // Alleen eigen origin verder afhandelen.
  if (url.origin !== self.location.origin) return;

  // App-shell: cache-first, val terug op index.html voor navigaties (offline).
  event.respondWith(
    caches.match(req).then(function (cached) {
      if (cached) return cached;
      return fetch(req).then(function (res) {
        if (res && res.ok && res.type === 'basic') {
          var copy = res.clone();
          caches.open(SHELL).then(function (cache) { cache.put(req, copy); });
        }
        return res;
      }).catch(function () {
        if (req.mode === 'navigate') return caches.match('./index.html');
      });
    })
  );
});
