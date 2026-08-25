/**
 * Service worker de la demo BYO-files: sirve /assets/* desde la cache que
 * llenó el extractor en el navegador (extractor/src/browser.ts). El resto de
 * peticiones pasan a la red. Sin datos del juego en el sitio: la cache la
 * llena el usuario desde SU copia.
 */
const CACHE = "u5-assets-v1";
const ASSETS_PREFIX = "/assets/";

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;
  if (!url.pathname.startsWith(ASSETS_PREFIX)) return;
  event.respondWith(
    caches
      .open(CACHE)
      .then((cache) => cache.match(url.pathname))
      .then((hit) => hit ?? fetch(event.request)),
  );
});
