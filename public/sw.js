// MY PENS — minimal service worker
// Strategy:
//   - HTML / navigation: network-first, fall back to cached shell
//   - Static assets (icons, manifest, /illustrations, /stitch, /_next/static): cache-first
//   - API requests (/api/*): always go to network, never cache
// Bump CACHE_VERSION whenever shell assets change to force a refresh.

const CACHE_VERSION = "v1";
const STATIC_CACHE = `pens-static-${CACHE_VERSION}`;
const SHELL_CACHE = `pens-shell-${CACHE_VERSION}`;

const SHELL_ASSETS = [
  "/manifest.webmanifest",
  "/icon-192.png",
  "/icon-512.png",
  "/icon-512-maskable.png",
  "/apple-touch-icon.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => cache.addAll(SHELL_ASSETS)).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((k) => k !== STATIC_CACHE && k !== SHELL_CACHE && k.startsWith("pens-"))
          .map((k) => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  );
});

function isStaticAsset(url) {
  return (
    url.pathname.startsWith("/_next/static/") ||
    url.pathname.startsWith("/illustrations/") ||
    url.pathname.startsWith("/stitch/") ||
    url.pathname.startsWith("/uploads/") ||
    url.pathname === "/manifest.webmanifest" ||
    url.pathname === "/favicon.ico" ||
    /\.(png|jpe?g|webp|svg|ico|woff2?|css|js)$/i.test(url.pathname)
  );
}

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  // Never intercept API or auth endpoints — always go to network for fresh data
  if (url.pathname.startsWith("/api/")) return;

  // HTML / navigations → network-first with cached shell fallback
  if (req.mode === "navigate" || req.headers.get("accept")?.includes("text/html")) {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(SHELL_CACHE).then((cache) => cache.put(req, copy)).catch(() => {});
          return res;
        })
        .catch(async () => {
          const cached = await caches.match(req);
          if (cached) return cached;
          const fallback = await caches.match("/");
          return fallback || Response.error();
        })
    );
    return;
  }

  // Static assets → cache-first
  if (isStaticAsset(url)) {
    event.respondWith(
      caches.match(req).then(
        (cached) =>
          cached ||
          fetch(req).then((res) => {
            if (res.ok) {
              const copy = res.clone();
              caches.open(STATIC_CACHE).then((cache) => cache.put(req, copy)).catch(() => {});
            }
            return res;
          }).catch(() => cached || Response.error())
      )
    );
  }
});
