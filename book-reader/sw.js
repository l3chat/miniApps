// Increment with each application release. Scope is only /book-reader/.
const CACHE = 'polka-shell-v1';
const ASSETS = [
    "./",
    "./index.html",
    "./style.css",
    "./app.js",
    "./storage.js",
    "./books.js",
    "./backup.js",
    "./icon.svg",
    "./manifest.webmanifest",
    "./demo.fb2",
    "./vendor/fflate.js",
    "./vendor/foliate/epub.js",
    "./vendor/foliate/epubcfi.js",
    "./vendor/foliate/fb2.js",
    "./vendor/foliate/fixed-layout.js",
    "./vendor/foliate/mobi.js",
    "./vendor/foliate/overlayer.js",
    "./vendor/foliate/paginator.js",
    "./vendor/foliate/progress.js",
    "./vendor/foliate/search.js",
    "./vendor/foliate/text-walker.js",
    "./vendor/foliate/vendor/fflate.js",
    "./vendor/foliate/vendor/zip.js",
    "./vendor/foliate/view.js"
];
self.addEventListener('install', event => {
    event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(ASSETS)));
});
self.addEventListener('activate', event => {
    event.waitUntil((async () => {
        for (const key of await caches.keys())
            if (key.startsWith('polka-shell-') && key !== CACHE) await caches.delete(key);
        await self.clients.claim();
    })());
});
self.addEventListener('fetch', event => {
    if (event.request.method !== 'GET') return;
    const url = new URL(event.request.url);
    const root = new URL('./', self.location.href);
    if (url.origin !== root.origin || !url.pathname.startsWith(root.pathname)) return;
    event.respondWith((async () => {
        const cached = await caches.match(event.request);
        if (cached) return cached;
        const response = await fetch(event.request);
        return response;
    })());
});
