'use strict';
// Cuando cambies cualquier archivo de la app, sube este número para que el celular descargue la versión nueva.
const VERSION = 'vence-v3';
const PREFIX = 'vence-';
const FILES = ['./', 'index.html', 'app.js', 'styles.css', 'manifest.webmanifest', 'icon.svg', 'icon-180.png', 'icon-192.png', 'icon-512.png'];

// Guarda cada archivo por separado: si alguno falla, los demás igual quedan guardados y la app abre sin internet.
self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION).then(c => Promise.all(FILES.map(f =>
    fetch(new Request(f, {cache: 'reload'})).then(r => { if (r.ok) return c.put(f, r); }).catch(() => {})
  ))).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k.startsWith(PREFIX) && k !== VERSION).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

const STATIC = /\.(js|css|png|svg|jpg|jpeg|webp|woff2?|webmanifest|ico)$/i;
async function fromNetwork(req, key){ const r = await fetch(req); if (r && r.ok){ const c = await caches.open(VERSION); c.put(key || req, r.clone()); } return r; }

self.addEventListener('fetch', e => {
  const r = e.request;
  if (r.method !== 'GET') return;
  const url = new URL(r.url);
  if (url.origin !== self.location.origin) return;
  const scope = new URL(self.registration.scope).pathname;
  // La app misma: primero la copia guardada (abre al instante y sin internet).
  if (r.mode === 'navigate'){
    if (url.pathname === scope || url.pathname === scope + 'index.html')
      e.respondWith(caches.match('index.html', {cacheName: VERSION}).then(c => c || fromNetwork(r, 'index.html')).catch(() => caches.match('index.html')));
    return;
  }
  // Datos que cambian (como listas .json): primero internet, y si no hay, la última copia guardada.
  if (/\.json$/i.test(url.pathname)){
    e.respondWith(fromNetwork(r).catch(() => caches.match(r, {ignoreSearch: true})));
    return;
  }
  // Archivos de la app (código, estilos, íconos, fuentes): copia guardada, y si falta, se descarga y se guarda.
  if (STATIC.test(url.pathname)){
    e.respondWith(caches.match(r, {ignoreSearch: true}).then(c => c || fromNetwork(r)));
  }
});

/* ---------- Avisos (sin servidor: revisa los datos guardados en el celular) ---------- */
const idb = () => new Promise((res, rej) => { const r = indexedDB.open('vencimientos'); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
const getAll = (db, s) => new Promise(res => { try { const q = db.transaction(s).objectStore(s).getAll(); q.onsuccess = () => res(q.result || []); q.onerror = () => res([]); } catch(e){ res([]); } });
const getOne = (db, s, k) => new Promise(res => { try { const q = db.transaction(s).objectStore(s).get(k); q.onsuccess = () => res(q.result); q.onerror = () => res(null); } catch(e){ res(null); } });
const putOne = (db, s, v) => new Promise(res => { try { const t = db.transaction(s, 'readwrite'); t.objectStore(s).put(v); t.oncomplete = () => res(); t.onerror = () => res(); } catch(e){ res(); } });
const today = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; };
const daysTo = s => Math.round((new Date(s + 'T12:00') - new Date(today() + 'T12:00')) / 864e5);
async function checkItems(){
  let db; try { db = await idb(); } catch(e){ return; }
  const on = await getOne(db, 'meta', 'notif'); if (!on || !on.v) return;
  const sent = await getOne(db, 'meta', 'notified'), done = new Set((sent && sent.v) || []), items = await getAll(db, 'items');
  for (const i of items){ if (i.status !== 'active' || !i.date) continue; const n = daysTo(i.date), warn = +i.warn || 3;
    let k = null, body = '';
    if (n === 0){ k = `${i.id}:0:${i.date}`; body = i.repeat ? (i.cat === 'suscripciones' ? 'Se cobra hoy.' : 'Se paga hoy.') : 'Vence hoy.'; }
    else if (n > 0 && n <= warn){ k = `${i.id}:w:${i.date}`; body = (i.repeat ? (i.cat === 'suscripciones' ? 'Se cobra' : 'Se paga') : 'Vence') + (n === 1 ? ' mañana.' : ` en ${n} días.`); }
    if (!k || done.has(k)) continue; done.add(k);
    await self.registration.showNotification(i.name, {body, icon:'icon-192.png', badge:'icon-192.png', tag:k}); }
  await putOne(db, 'meta', {k:'notified', v:[...done].slice(-800)}); }
self.addEventListener('periodicsync', e => { if (e.tag === 'vence-avisos') e.waitUntil(checkItems()); });
self.addEventListener('message', e => { if (e.data === 'check') checkItems(); });
self.addEventListener('notificationclick', e => { e.notification.close();
  e.waitUntil(self.clients.matchAll({type:'window', includeUncontrolled:true}).then(l => { const c = l.find(x => x.url.startsWith(self.registration.scope)); return c ? c.focus() : self.clients.openWindow(self.registration.scope); })); });
