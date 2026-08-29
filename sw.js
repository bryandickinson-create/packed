/* Packed service worker — offline shell + reliable updates.
   Bump CACHE when the caching strategy itself changes. The app HTML is
   fetched network-first, so content updates land without touching this. */
var CACHE = "packed-cache-v1";
var CORE = ["./", "./index.html", "./manifest.webmanifest",
            "./icon-192.png", "./icon-512.png", "./apple-touch-icon.png"];

self.addEventListener("install", function(e){
  e.waitUntil(
    caches.open(CACHE).then(function(c){ return c.addAll(CORE); })
      .catch(function(){})            // don't fail install if one asset 404s
      .then(function(){ return self.skipWaiting(); })
  );
});

self.addEventListener("activate", function(e){
  e.waitUntil(
    caches.keys().then(function(keys){
      return Promise.all(keys.map(function(k){ if(k !== CACHE) return caches.delete(k); }));
    }).then(function(){ return self.clients.claim(); })
  );
});

self.addEventListener("fetch", function(e){
  var req = e.request;
  if(req.method !== "GET") return;

  var isDoc = req.mode === "navigate" || req.destination === "document";
  if(isDoc){
    // network-first so a new deploy shows up as soon as you're online,
    // falling back to the cached shell when offline.
    e.respondWith(
      fetch(req).then(function(res){
        var copy = res.clone();
        caches.open(CACHE).then(function(c){ c.put("./index.html", copy); });
        return res;
      }).catch(function(){
        return caches.match("./index.html").then(function(r){ return r || caches.match("./"); });
      })
    );
    return;
  }

  // everything else (icons, Google Fonts): stale-while-revalidate
  e.respondWith(
    caches.match(req).then(function(cached){
      var net = fetch(req).then(function(res){
        if(res && (res.ok || res.type === "opaque")){
          var copy = res.clone();
          caches.open(CACHE).then(function(c){ c.put(req, copy); });
        }
        return res;
      }).catch(function(){ return cached; });
      return cached || net;
    })
  );
});
