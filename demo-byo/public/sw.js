/**
 * Ultimatum/OpenU5 asset service worker.
 *
 * Ultimatum publishes an extracted game-data generation by changing one small
 * control pointer only after every staged asset has been verified. Existing
 * OpenU5 visitors keep working through the legacy u5-assets-v1 fallback.
 */
const LEGACY_CACHE = "u5-assets-v1";
const CONTROL_CACHE = "ultimatum-install-control-v1";
const POINTER_PATH = "/__ultimatum/games/ultima5/active-install.json";
const GENERATION_CACHE = /^ultimatum-u5-install-generation-[a-zA-Z0-9-]{8,80}$/;
const ASSETS_PREFIX = "/assets/";

async function activeAssetCacheName() {
  try {
    if (await caches.has(CONTROL_CACHE)) {
      const control = await caches.open(CONTROL_CACHE);
      const response = await control.match(POINTER_PATH);
      if (response) {
        const pointer = await response.clone().json();
        const name = pointer && typeof pointer.cacheName === "string" ? pointer.cacheName : "";
        if ((name === LEGACY_CACHE || GENERATION_CACHE.test(name)) && (await caches.has(name))) {
          return name;
        }
      }
    }
  } catch {
    // A malformed/unreadable pointer must never make a working legacy install unusable.
  }
  return (await caches.has(LEGACY_CACHE)) ? LEGACY_CACHE : null;
}

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin || !url.pathname.startsWith(ASSETS_PREFIX)) return;
  event.respondWith(
    activeAssetCacheName()
      .then((name) => (name ? caches.open(name).then((cache) => cache.match(url.pathname)) : undefined))
      .then((hit) => hit ?? fetch(event.request)),
  );
});
