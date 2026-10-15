/* Bancada PDF — service worker (cache para uso offline). Gerado no build. */
const V='bancada-f523ebca1f';
const PRE=["assets/app.css","assets/app.js","assets/config.js","assets/fonts/bricolage-grotesque-latin-wght-normal.woff2","assets/fonts/figtree-latin-wght-normal.woff2","assets/icons.js","assets/tools.js","assets/vendor/jszip.min.js","assets/vendor/mammoth.browser.min.js","assets/vendor/pdf-lib.min.js","assets/vendor/pdf.min.js","assets/vendor/pdf.worker.min.js","assinar-pdf.html","comprimir-pdf.html","contato.html","dividir-pdf.html","escrever-no-pdf.html","girar-pdf.html","icons/apple-touch-icon.png","icons/favicon-32.png","icons/icon-192.png","icons/icon-512.png","icons/maskable-512.png","imagem-para-pdf.html","./","juntar-pdf.html","manifest.webmanifest","marca-dagua-pdf.html","numerar-paginas-pdf.html","organizar-pdf.html","pdf-para-imagem.html","pdf-para-texto.html","pdf-para-word.html","privacidade.html","recortar-pdf.html","remover-paginas-pdf.html","sitemap.xml","sobre.html","termos.html","word-para-pdf.html","index.html"];
self.addEventListener('install',e=>{e.waitUntil(caches.open(V).then(c=>c.addAll(PRE)).then(()=>self.skipWaiting()))});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k!==V).map(k=>caches.delete(k)))).then(()=>self.clients.claim()))});
self.addEventListener('fetch',e=>{
  const r=e.request;
  if(r.method!=='GET'||new URL(r.url).origin!==location.origin)return;
  if(r.mode==='navigate'){
    e.respondWith(fetch(r).then(res=>{const cp=res.clone();caches.open(V).then(c=>c.put(r,cp));return res}).catch(()=>caches.match(r,{ignoreSearch:true}).then(m=>m||caches.match('./'))));
    return;
  }
  e.respondWith(caches.match(r).then(m=>m||fetch(r).then(res=>{const cp=res.clone();caches.open(V).then(c=>c.put(r,cp));return res})));
});
