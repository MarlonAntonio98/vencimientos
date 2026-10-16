'use strict';
(() => {
if (window.top !== window.self) { document.documentElement.classList.add('framed'); return; }

const $ = s => document.querySelector(s);
const main = $('#main'), ov = $('#overlay');
const APP_VERSION = 1;
const CATS = {
  alimentos:{n:'Alimentos', c:'#7BC86C', warn:3, qty:true, locs:['Refri','Congelador','Alacena','Frutero']},
  medicinas:{n:'Medicinas', c:'#E86A7E', warn:30, qty:true, locs:['Botiquín','Baño','Cuarto','Bolso']},
  productos:{n:'Productos', c:'#6AB0E8', warn:30, qty:true, locs:['Baño','Cocina','Lavandería','Tocador']},
  suscripciones:{n:'Suscripciones', c:'#C96AE8', warn:3, repeat:'monthly', price:true},
  servicios:{n:'Servicios y pagos', c:'#E8C24A', warn:5, repeat:'monthly', price:true},
  garantias:{n:'Garantías', c:'#4AC1C9', warn:30},
  otros:{n:'Otros', c:'#8E8E96', warn:7}};
const REPEATS = {none:'No se repite', weekly:'Cada semana', monthly:'Cada mes', yearly:'Cada año'};
const WARNS = [1, 3, 5, 7, 15, 30, 60];
const I = {plus:'<path d="M12 5v14M5 12h14"/>',back:'<path d="m15 6-6 6 6 6"/>',x:'<path d="M6 6l12 12M18 6 6 18"/>',gear:'<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M2 12h3M19 12h3M4.9 19.1 7 17M17 7l2.1-2.1"/>',bell:'<path d="M6 16V11a6 6 0 0 1 12 0v5l2 2H4z"/><path d="M10 21h4"/>',camera:'<path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/>',search:'<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',chev:'<path d="m9 6 6 6-6 6"/>',down:'<path d="M12 4v12M7 11l5 5 5-5M5 20h14"/>',up:'<path d="M12 16V4M7 9l5-5 5 5M5 20h14"/>',check:'<path d="m5 12 5 5 9-10"/>'};
const ic = (n, s = 22) => `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${I[n]}</svg>`;
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const uid = () => Date.now().toString(36) + Array.from(crypto.getRandomValues(new Uint8Array(6)), b => (b % 36).toString(36)).join('');
const NO_SPELL = 'autocomplete="off" autocorrect="off" spellcheck="false"';
const norm = s => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
const pad2 = n => String(n).padStart(2, '0');
const key = d => `${d.getFullYear()}-${pad2(d.getMonth()+1)}-${pad2(d.getDate())}`;
const todayKey = () => key(new Date());
const parse = s => { const [y,m,d] = s.split('-').map(Number); return new Date(y, m-1, d, 12); };
const daysTo = s => Math.round((parse(s) - parse(todayKey())) / 864e5);
const addDays = (s, n) => { const d = parse(s); d.setDate(d.getDate() + n); return key(d); };
const addMonths = (s, n) => { const d = parse(s), day = d.getDate(); d.setDate(1); d.setMonth(d.getMonth() + n); d.setDate(Math.min(day, new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate())); return key(d); };
const nextOf = (s, r) => r === 'weekly' ? addDays(s, 7) : r === 'yearly' ? addMonths(s, 12) : addMonths(s, 1);
const fmtD = s => parse(s).toLocaleDateString('es-SV', {day:'numeric', month:'long', year:'numeric'});
const fmtShort = s => parse(s).toLocaleDateString('es-SV', Object.assign({day:'numeric', month:'short'}, s.slice(0,4) !== todayKey().slice(0,4) ? {year:'numeric'} : {})).replace(/\./g, '');
const money = n => n == null ? '' : '$' + (Math.round(n * 100) / 100).toLocaleString('en-US', {minimumFractionDigits:2, maximumFractionDigits:2});
const num = v => { const n = parseFloat(String(v ?? '').replace(/[$\s]/g, '').replace(',', '.')); return isFinite(n) && n >= 0 ? Math.round(n * 100) / 100 : null; };
const plural = (n, a, b) => `${n} ${n === 1 ? a : b}`;

/* ---------- Almacenamiento ---------- */
const DB = { db:null,
  open(){ return new Promise(res => { try { const r = indexedDB.open('vencimientos', 1);
    r.onupgradeneeded = () => { const d = r.result; d.createObjectStore('items', {keyPath:'id'}); d.createObjectStore('meta', {keyPath:'k'}); };
    r.onsuccess = () => { this.db = r.result; res(true); }; r.onerror = () => res(false); r.onblocked = () => res(false); } catch(e){ res(false); } }); },
  req(s, m, fn){ return new Promise((res, rej) => { try { const t = this.db.transaction(s, m), q = fn(t.objectStore(s)); let out;
    if (q) q.onsuccess = () => { out = q.result; }; t.oncomplete = () => res(out); t.onerror = () => rej(t.error); t.onabort = () => rej(t.error); } catch(e){ rej(e); } }); },
  get(s,k){ return this.req(s,'readonly',o=>o.get(k)); }, all(s){ return this.req(s,'readonly',o=>o.getAll()).then(r=>r||[]); },
  put(s,v){ return this.req(s,'readwrite',o=>o.put(v)); }, del(s,k){ return this.req(s,'readwrite',o=>o.delete(k)); }, clear(s){ return this.req(s,'readwrite',o=>o.clear()); } };

/* ---------- Datos ---------- */
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/, ID_RE = /^[a-z0-9]{6,40}$/, IMG_RE = /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/;
const str = (v, n) => typeof v === 'string' ? v.slice(0, n) : '';
function clean(i){ if (!i || !ID_RE.test(i.id) || !DATE_RE.test(i.date)) return null; const name = str(i.name, 100).trim(); if (!name) return null; const cat = CATS[i.cat] ? i.cat : 'otros';
  return {id:i.id, name, cat, date:i.date, warn:WARNS.includes(+i.warn) ? +i.warn : CATS[cat].warn, repeat:REPEATS[i.repeat] && i.repeat !== 'none' ? i.repeat : null, price:num(i.price), qty:str(i.qty, 30), loc:str(i.loc, 40), note:str(i.note, 500),
    photo:typeof i.photo === 'string' && IMG_RE.test(i.photo) ? i.photo : null, status:['active','used','tossed','cancelled'].includes(i.status) ? i.status : 'active', doneAt:DATE_RE.test(i.doneAt || '') ? i.doneAt : null,
    last:DATE_RE.test(i.last || '') ? i.last : null, created:+i.created || Date.now()}; }
let items = [], view = {name:'home'}, hist = [], filter = 'all', query = '', searchOpen = false, draft = null, installEvt = null, seen = new Set(), notifOn = false;
const active = () => items.filter(i => i.status === 'active');
async function saveItem(i){ await DB.put('items', i); const k = items.findIndex(x => x.id === i.id); k < 0 ? items.push(i) : items[k] = i; }
// las suscripciones se renuevan solas: si su fecha ya pasó, se pasa al siguiente cobro
async function autoRenew(){ for (const i of active()){ if (i.cat !== 'suscripciones' || !i.repeat) continue; let ch = false;
  while (i.date < todayKey()){ i.last = i.date; i.date = nextOf(i.date, i.repeat); ch = true; } if (ch) await saveItem(i); } }
function status(i){ const n = daysTo(i.date);
  if (n < 0) return {k:'bad', g:'late', t:i.repeat ? `Atrasado ${-n === 1 ? '1 día' : -n + ' días'}` : (n === -1 ? 'Venció ayer' : `Venció hace ${-n} días`)};
  if (n === 0) return {k:'bad', g:'today', t:i.repeat ? (i.cat === 'suscripciones' ? 'Se cobra hoy' : 'Se paga hoy') : 'Vence hoy'};
  const word = i.repeat ? (i.cat === 'suscripciones' ? 'Se cobra' : 'Se paga') : 'Vence';
  if (n <= i.warn) return {k:'warn', g:n <= 7 ? 'week' : 'month', t:n === 1 ? `${word} mañana` : `${word} en ${n} días`};
  return {k:'ok', g:n <= 7 ? 'week' : n <= 31 ? 'month' : 'later', t:n <= 31 ? `${word} en ${n} días` : `${word} el ${fmtShort(i.date)}`}; }
const GROUPS = [['late','Vencidos y atrasados'],['today','Hoy'],['week','Esta semana'],['month','Este mes'],['later','Más adelante']];

/* ---------- Superposiciones y botón atrás ---------- */
let ovState = false, pendingBack = false, wantPush = false, pendingCb = null, sheetRes = null;
function toast(m){ const t = $('#toast'); t.textContent = m; t.classList.add('show'); clearTimeout(toast.t); toast.t = setTimeout(() => t.classList.remove('show'), 2600); }
function openOverlay(html, cls){ ov.className = cls; ov.innerHTML = html; ov.hidden = false; document.body.style.overflow = 'hidden'; if (!ovState){ ovState = true; if (pendingBack) wantPush = true; else history.pushState({ov:1}, ''); } }
function hideOverlay(){ ov.hidden = true; ov.innerHTML = ''; ov.className = ''; document.body.style.overflow = ''; }
function closeOverlay(cb){ hideOverlay(); if (ovState){ ovState = false; if (wantPush){ wantPush = false; if (cb) cb(); } else { pendingBack = true; pendingCb = cb || null; history.back(); } } else if (cb) cb(); }
function resolveSheet(v){ const r = sheetRes; sheetRes = null; closeOverlay(() => { if (r) r(v); }); }
function confirmBox(title, text, ok){ return new Promise(res => { sheetRes = v => res(!!v); openOverlay(`<div class="sheet" role="dialog" aria-modal="true"><h2>${esc(title)}</h2><p>${esc(text)}</p><button class="btn btn-danger" data-act="sheetOk">${esc(ok)}</button><button class="btn btn-ghost" data-act="sheetNo">Cancelar</button></div>`, 'dim'); }); }
function go(v){ hist.push(Object.assign({}, view, {y:window.scrollY})); view = v; history.pushState({d:hist.length}, ''); render(); window.scrollTo(0,0); }
function back(){ if (ovState) return resolveSheet(null); if (hist.length) history.back(); }
window.addEventListener('popstate', () => {
  if (pendingBack){ pendingBack = false; if (wantPush){ wantPush = false; history.pushState({ov:1}, ''); } const cb = pendingCb; pendingCb = null; if (cb) cb(); return; }
  if (ovState){ ovState = false; hideOverlay(); const r = sheetRes; sheetRes = null; if (r) r(null); return; }
  if (!hist.length) return; const v = hist.pop(), y = v.y || 0; delete v.y; view = v; draft = null; render(); window.scrollTo(0, y); });

/* ---------- Vistas ---------- */
const attention = () => active().filter(i => daysTo(i.date) <= 0);
const unread = () => attention().filter(i => !seen.has(i.id + ':' + i.date)).length;
function row(i){ const s = status(i), c = CATS[i.cat];
  const sub = [c.n, i.qty, i.loc, i.price != null ? money(i.price) + (i.repeat ? (i.repeat === 'yearly' ? ' al año' : i.repeat === 'weekly' ? ' a la semana' : ' al mes') : '') : ''].filter(Boolean).join(', ');
  return `<button class="item" data-open="${esc(i.id)}"><span class="thumb" data-c="${c.c}">${i.photo ? `<img src="${i.photo}" alt="">` : `<span class="ph">${esc(i.name.charAt(0).toUpperCase())}</span>`}</span><span class="it-main"><span class="it-name">${esc(i.name)}</span><span class="it-meta">${esc(sub)}</span></span><span class="when ${s.k}">${esc(s.t)}</span></button>`; }
function viewHome(){ const n = unread();
  let h = `<header class="bar"><h1 class="title">Vencimientos</h1><div class="bar-actions">${installEvt?'<button class="pill-btn" data-act="install">Instalar</button>':''}<button class="icon-btn" data-act="toggleSearch" aria-label="Buscar">${ic('search')}</button><button class="icon-btn bell" data-act="bell" aria-label="Avisos${n ? `, ${n}` : ''}">${ic('bell')}${n ? `<span class="dot-n">${n > 9 ? '9+' : n}</span>` : ''}</button><button class="icon-btn" data-act="settings" aria-label="Ajustes">${ic('gear')}</button></div></header>`;
  if (searchOpen) h += `<div class="search"><input id="q" type="search" placeholder="Buscar" value="${esc(query)}" aria-label="Buscar" ${NO_SPELL}></div>`;
  const act = active();
  if (!items.length) return h + `<div class="empty"><div class="empty-mark">${ic('plus',30)}</div><h2>Nada por vencer todavía</h2><p>Agrega alimentos, medicinas, productos, suscripciones o pagos, y la app te avisa antes de que venzan.</p><button class="btn btn-primary" data-act="add">Agregar</button></div>` + fab();
  const late = act.filter(i => daysTo(i.date) < 0).length, week = act.filter(i => { const d = daysTo(i.date); return d >= 0 && d <= 7; }).length;
  const subs = act.filter(i => i.cat === 'suscripciones' && i.price != null), perMonth = subs.reduce((s,i) => s + (i.repeat === 'yearly' ? i.price / 12 : i.repeat === 'weekly' ? i.price * 52 / 12 : i.price), 0);
  h += `<div class="summary three"><div class="metric"><span>Vencidos</span><b class="${late ? 'bad-t' : ''}">${late}</b></div><div class="metric"><span>Esta semana</span><b class="${week ? 'warn-t' : ''}">${week}</b></div><div class="metric"><span>Suscripciones</span><b>${subs.length ? money(perMonth) : '—'}</b>${subs.length ? '<small>al mes</small>' : ''}</div></div>`;
  const cats = Object.keys(CATS).filter(k => act.some(i => i.cat === k)), done = items.some(i => i.status !== 'active');
  if (filter !== 'all' && filter !== 'done' && !cats.includes(filter)) filter = 'all';
  h += `<div class="chips"><button class="chip ${filter==='all'?'on':''}" data-filter="all">Todo</button>${cats.map(k => `<button class="chip ${filter===k?'on':''}" data-filter="${k}">${CATS[k].n}</button>`).join('')}${done ? `<button class="chip ${filter==='done'?'on':''}" data-filter="done">Terminados</button>` : ''}</div>`;
  h += `<div id="listWrap">${listHTML()}</div>`;
  return h + fab(); }
function listHTML(){ const q = norm(query.trim()), match = i => !q || norm([i.name, i.loc, i.note, CATS[i.cat].n].join(' ')).includes(q);
  if (filter === 'done'){ const l = items.filter(i => i.status !== 'active' && match(i)).sort((a,b) => (b.doneAt || '').localeCompare(a.doneAt || ''));
    const m = todayKey().slice(0,7), tossed = items.filter(i => i.status === 'tossed' && (i.doneAt || '').startsWith(m)).length;
    return (tossed ? `<p class="note">Este mes tiraste ${plural(tossed, 'cosa vencida', 'cosas vencidas')}.</p>` : '') + (l.length ? `<div class="list">${l.map(i => `<button class="item" data-open="${esc(i.id)}"><span class="thumb" data-c="${CATS[i.cat].c}"><span class="ph">${esc(i.name.charAt(0).toUpperCase())}</span></span><span class="it-main"><span class="it-name">${esc(i.name)}</span><span class="it-meta">${i.status === 'used' ? 'Usado' : i.status === 'tossed' ? 'Se tiró' : 'Cancelado'}${i.doneAt ? ' el ' + fmtShort(i.doneAt) : ''}</span></span></button>`).join('')}</div>` : '<p class="empty-sm">Nada por aquí.</p>'); }
  const l = active().filter(i => (filter === 'all' || i.cat === filter) && match(i)).sort((a,b) => a.date.localeCompare(b.date) || a.name.localeCompare(b.name, 'es'));
  if (!l.length) return '<p class="empty-sm">No hay nada que coincida.</p>';
  return GROUPS.map(([g, n]) => { const gl = l.filter(i => status(i).g === g); return gl.length ? `<h2 class="section">${n}</h2><div class="list">${gl.map(row).join('')}</div>` : ''; }).join(''); }
const fab = () => `<button class="fab" data-act="add" aria-label="Agregar">${ic('plus',28)}</button>`;
function viewDetail(){ const i = items.find(x => x.id === view.id); if (!i){ view = {name:'home'}; return viewHome(); }
  const s = status(i), c = CATS[i.cat], done = i.status !== 'active';
  let h = `<header class="bar"><button class="icon-btn" data-act="back" aria-label="Volver">${ic('back')}</button><h1 class="title title-sm">${esc(c.n)}</h1><button class="pill-btn ghost" data-act="edit">Editar</button></header>`;
  if (i.photo) h += `<img class="hero-photo" src="${i.photo}" alt="">`;
  h += `<h1 class="d-name">${esc(i.name)}</h1>`;
  if (!done) h += `<div class="big-when ${s.k}"><b>${esc(s.t)}</b><span>${fmtD(i.date)}</span></div>`;
  else h += `<p class="price-sub">${i.status === 'used' ? 'Lo marcaste como usado' : i.status === 'tossed' ? 'Lo marcaste como tirado' : 'Lo cancelaste'}${i.doneAt ? ' el ' + fmtD(i.doneAt) : ''}.</p>`;
  const rows = [['Cantidad', i.qty], ['Dónde está', i.loc], ['Precio', i.price != null ? money(i.price) : ''], ['Se repite', i.repeat ? REPEATS[i.repeat] : ''], ['Último cobro', i.last ? fmtD(i.last) : ''], ['Aviso', `${plural(i.warn, 'día', 'días')} antes`]].filter(r => r[1]);
  h += `<div class="box">${rows.map(([k,v]) => `<div class="row"><span>${k}</span><b>${esc(v)}</b></div>`).join('')}</div>`;
  if (i.note) h += `<div class="box"><p class="fine">${esc(i.note)}</p></div>`;
  if (done) h += `<button class="btn btn-secondary" data-act="restore">Volver a la lista</button>`;
  else if (i.repeat){ h += i.cat === 'suscripciones' ? `<button class="btn btn-primary" data-act="paid">Ya se cobró: pasar al siguiente</button><button class="btn btn-secondary" data-act="cancelSub">Cancelé la suscripción</button>` : `<button class="btn btn-primary" data-act="paid">Ya lo pagué: pasar al siguiente</button><button class="btn btn-secondary" data-act="cancelSub">Ya no se paga</button>`; }
  else h += `<div class="two-btn"><button class="btn btn-primary" data-act="used">${i.cat === 'garantias' ? 'Ya no la necesito' : 'Ya lo usé'}</button><button class="btn btn-secondary" data-act="tossed">${i.cat === 'garantias' ? 'Ya venció' : 'Lo tiré'}</button></div>`;
  return h + `<button class="btn btn-danger-text mt" data-act="delete">Eliminar</button>`; }
function photoSlot(){ return `<div class="photo-slot" id="photoSlot">${draft.photo?`<img src="${draft.photo}" alt=""><button type="button" class="photo-x" data-act="rmPhoto" aria-label="Quitar foto">${ic('x',16)}</button>`:`<label class="photo-pick">${ic('camera')}<span>Foto</span><input type="file" accept="image/*" id="f_photo" hidden></label>`}</div>`; }
function viewForm(){ const d = draft, c = CATS[d.cat], edit = items.some(i => i.id === d.id), rep = d.repeat || 'none';
  const quick = c.repeat ? [] : [['+3 días', 3], ['+1 semana', 7], ['+1 mes', 'm1'], ['+6 meses', 'm6'], ['+1 año', 'm12']];
  return `<header class="bar"><button class="icon-btn" data-act="back" aria-label="Cancelar">${ic('x')}</button><h1 class="title title-sm">${edit ? 'Editar' : 'Agregar'}</h1><button class="btn-save" data-act="save">Guardar</button></header>
  <div class="field"><span>Tipo</span><div class="pick">${Object.entries(CATS).map(([k, v]) => `<button type="button" class="pick-chip${d.cat === k ? ' on' : ''}" data-cat="${k}"><i data-c="${v.c}"></i>${v.n}</button>`).join('')}</div></div>
  <label class="field"><span>Nombre</span><input id="f_name" value="${esc(d.name)}" maxlength="100" placeholder="${{alimentos:'Leche', medicinas:'Acetaminofén', productos:'Protector solar', suscripciones:'Netflix', servicios:'Recibo de luz', garantias:'Garantía del teléfono', otros:'Licencia de conducir'}[d.cat]}" ${NO_SPELL}><em class="err" id="e_name"></em></label>
  <label class="field"><span>${c.repeat ? (d.cat === 'suscripciones' ? 'Próximo cobro' : 'Próximo pago') : d.cat === 'garantias' ? 'La garantía vence el' : 'Vence el'}</span><input id="f_date" type="date" value="${d.date || ''}"><em class="err" id="e_date"></em></label>
  ${quick.length ? `<div class="quick-dates">${quick.map(([t, v]) => `<button type="button" class="chip" data-qd="${v}">${t}</button>`).join('')}</div>` : ''}
  ${c.repeat || d.repeat ? `<div class="field"><span>Se repite</span><div class="pick">${Object.entries(REPEATS).map(([k, v]) => `<button type="button" class="pick-chip${rep === k ? ' on' : ''}" data-rep="${k}">${v}</button>`).join('')}</div></div>` : ''}
  ${c.price || d.price != null ? `<label class="field"><span>Precio</span><div class="money"><input id="f_price" type="text" inputmode="decimal" value="${d.price != null ? d.price : ''}" placeholder="0.00" ${NO_SPELL}></div></label>` : ''}
  ${c.qty ? `<label class="field"><span>Cantidad (opcional)</span><input id="f_qty" value="${esc(d.qty)}" maxlength="30" placeholder="${d.cat === 'medicinas' ? '1 caja, 20 pastillas' : '2 unidades, 1 litro'}" ${NO_SPELL}></label>` : ''}
  ${c.locs ? `<label class="field"><span>Dónde está (opcional)</span><input id="f_loc" value="${esc(d.loc)}" maxlength="40" list="locs" ${NO_SPELL}><datalist id="locs">${c.locs.map(l => `<option value="${l}">`).join('')}</datalist></label>` : ''}
  <label class="field"><span>Avisarme</span><select id="f_warn">${WARNS.map(w => `<option value="${w}" ${d.warn === w ? 'selected' : ''}>${plural(w, 'día', 'días')} antes</option>`).join('')}</select></label>
  <label class="field"><span>Nota (opcional)</span><textarea id="f_note" rows="2" maxlength="500" ${NO_SPELL}>${esc(d.note)}</textarea></label>
  <div class="field"><span>Foto (opcional)</span>${photoSlot()}</div>`; }
function viewBell(){ const l = attention().sort((a,b) => a.date.localeCompare(b.date));
  let h = `<header class="bar"><button class="icon-btn" data-act="back" aria-label="Volver">${ic('back')}</button><h1 class="title title-sm">Necesitan atención</h1><span class="spacer"></span></header>`;
  h += l.length ? `<div class="list">${l.map(row).join('')}</div>` : '<p class="hint">Nada vence hoy y no tienes nada vencido.</p>';
  h += `<div class="box notif"><button class="set-row" data-act="toggleNotif" role="switch" aria-checked="${notifOn && window.Notification && Notification.permission === 'granted'}"><span>Avisos en el celular<small>Una notificación cuando algo entra en su aviso o vence, aunque la app esté cerrada</small></span><span class="sw ${notifOn && window.Notification && Notification.permission === 'granted' ? 'on' : ''}"></span></button></div>`;
  l.forEach(i => seen.add(i.id + ':' + i.date)); DB.put('meta', {k:'seen', v:[...seen].slice(-500)}).catch(() => {});
  return h; }
function viewSettings(){ const standalone = window.matchMedia('(display-mode: standalone)').matches;
  return `<header class="bar"><button class="icon-btn" data-act="back" aria-label="Volver">${ic('back')}</button><h1 class="title title-sm">Ajustes</h1><span class="spacer"></span></header>
  <h2 class="section">Instalación</h2><div class="box">${standalone?'<p class="fine">Ya estás usando la app instalada.</p>':installEvt?`<button class="set-row" data-act="install"><span>Instalar Vencimientos en el celular</span><span class="chev">${ic('down',18)}</span></button>`:'<p class="fine">Chrome todavía no ofrece instalarla. Abre la app en Chrome con internet, espera unos segundos y vuelve a entrar aquí.</p>'}</div>
  <h2 class="section">Copia de seguridad</h2><div class="box"><button class="set-row" data-act="exportBk"><span>Descargar copia</span><span class="chev">${ic('down',18)}</span></button><label class="set-row"><span>Restaurar una copia<small>Agrega lo que tenga el archivo</small></span><span class="chev">${ic('up',18)}</span><input type="file" accept="application/json,.json" id="f_import" hidden></label></div>
  <h2 class="section">Privacidad</h2><div class="box"><p class="fine">Todo se guarda solo en este celular. La app no se conecta a internet.</p></div>
  <button class="btn btn-danger-text mt" data-act="wipe">Borrar todo</button><p class="ver">Versión ${APP_VERSION}</p>`; }
function paint(){ document.querySelectorAll('[data-c]').forEach(e => e.style.setProperty('--c', e.dataset.c)); }
function render(){ main.innerHTML = ({home:viewHome, detail:viewDetail, form:viewForm, bell:viewBell, settings:viewSettings}[view.name] || viewHome)(); paint(); }

/* ---------- Acciones ---------- */
function compress(file){ return new Promise((res, rej) => { if (file.size > 40e6) return rej(); const url = URL.createObjectURL(file), img = new Image();
  img.onload = () => { const m = 700, s = Math.min(1, m / Math.max(img.width, img.height)), c = document.createElement('canvas'); c.width = Math.round(img.width*s); c.height = Math.round(img.height*s); c.getContext('2d').drawImage(img, 0, 0, c.width, c.height); URL.revokeObjectURL(url); res(c.toDataURL('image/jpeg', .8)); };
  img.onerror = () => { URL.revokeObjectURL(url); rej(); }; img.src = url; }); }
function newDraft(cat){ return {id:null, name:'', cat, date:'', warn:CATS[cat].warn, repeat:CATS[cat].repeat || null, price:null, qty:'', loc:'', note:'', photo:null}; }
function keepForm(){ if (!draft || view.name !== 'form') return; const g = id => $(id); draft.name = g('#f_name').value; draft.date = g('#f_date').value; draft.warn = +g('#f_warn').value; draft.note = g('#f_note').value;
  if (g('#f_price')) draft.price = num(g('#f_price').value); if (g('#f_qty')) draft.qty = g('#f_qty').value; if (g('#f_loc')) draft.loc = g('#f_loc').value; }
async function finish(i, st){ i.status = st; i.doneAt = todayKey(); await saveItem(i); back(); toast(st === 'used' ? 'Listo, marcado como usado' : st === 'tossed' ? 'Marcado como tirado' : 'Marcado como cancelado'); }
let lastCat = 'alimentos';
const A = {
  add(){ draft = newDraft(filter !== 'all' && filter !== 'done' && CATS[filter] ? filter : lastCat); go({name:'form'}); setTimeout(() => { const n = $('#f_name'); if (n) n.focus(); }, 80); },
  edit(){ const i = items.find(x => x.id === view.id); if (!i) return; draft = Object.assign({}, i); go({name:'form'}); },
  back(){ back(); },
  settings(){ go({name:'settings'}); },
  bell(){ go({name:'bell'}); },
  toggleSearch(){ searchOpen = !searchOpen; if (!searchOpen) query = ''; render(); const q = $('#q'); if (q) q.focus(); },
  rmPhoto(){ draft.photo = null; $('#photoSlot').outerHTML = photoSlot(); },
  async save(){ keepForm(); const d = draft;
    if (!d.name.trim()){ $('#e_name').textContent = 'Escribe un nombre.'; $('#f_name').focus(); return; }
    if (!DATE_RE.test(d.date)){ $('#e_date').textContent = 'Elige la fecha.'; return; }
    const ex = items.find(i => i.id === d.id), rec = clean(Object.assign({}, ex || {}, d, {id:ex ? ex.id : uid(), status:ex ? ex.status : 'active', created:ex ? ex.created : Date.now()}));
    if (!rec) return toast('Revisa los datos.');
    if (rec.cat === 'suscripciones' && rec.repeat) while (rec.date < todayKey()){ rec.last = rec.date; rec.date = nextOf(rec.date, rec.repeat); }
    await saveItem(rec); lastCat = rec.cat; draft = null; back(); toast('Guardado'); },
  async used(){ const i = items.find(x => x.id === view.id); if (i) finish(i, 'used'); },
  async tossed(){ const i = items.find(x => x.id === view.id); if (i) finish(i, 'tossed'); },
  async cancelSub(){ const i = items.find(x => x.id === view.id); if (i) finish(i, 'cancelled'); },
  async paid(){ const i = items.find(x => x.id === view.id); if (!i || !i.repeat) return; i.last = i.date; i.date = nextOf(i.date, i.repeat); if (i.cat !== 'suscripciones') while (daysTo(i.date) < 0) i.date = nextOf(i.date, i.repeat); await saveItem(i); render(); toast(`Siguiente: ${fmtD(i.date)}`); },
  async restore(){ const i = items.find(x => x.id === view.id); if (!i) return; i.status = 'active'; i.doneAt = null; await saveItem(i); render(); toast('Volvió a la lista'); },
  async delete(){ const i = items.find(x => x.id === view.id); if (!i) return; if (!await confirmBox(`¿Eliminar ${i.name}?`, 'Se borra por completo.', 'Eliminar')) return; await DB.del('items', i.id); items = items.filter(x => x.id !== i.id); back(); toast('Eliminado'); },
  sheetOk(){ resolveSheet(true); }, sheetNo(){ resolveSheet(null); },
  async toggleNotif(){
    if (!('Notification' in window)) return toast('Este navegador no permite notificaciones.');
    if (notifOn && Notification.permission === 'granted'){ notifOn = false; await DB.put('meta', {k:'notif', v:false}); try { const r = await navigator.serviceWorker.ready; if (r.periodicSync) await r.periodicSync.unregister('vence-avisos'); } catch(e){} toast('Avisos desactivados'); return render(); }
    let p = Notification.permission; if (p === 'default') p = await Notification.requestPermission(); if (p !== 'granted'){ toast('Sin permiso para notificaciones.'); return render(); }
    notifOn = true; await DB.put('meta', {k:'notif', v:true}); const ok = await setupPeriodic(); toast(ok ? 'Avisos activados' : 'Avisos activados. Funcionan mejor con la app instalada.');
    try { const r = await navigator.serviceWorker.ready; r.active && r.active.postMessage('check'); } catch(e){} render(); },
  async install(){ if (!installEvt) return; const e = installEvt; installEvt = null; try { await e.prompt(); await e.userChoice; } catch(err){} render(); },
  exportBk(){ const url = URL.createObjectURL(new Blob([JSON.stringify({app:'vencimientos', v:1, created:new Date().toISOString(), items})], {type:'application/json'})), a = document.createElement('a'); a.href = url; a.download = `vencimientos-copia-${todayKey()}.json`; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 10000); toast('Copia descargada'); },
  async wipe(){ if (!await confirmBox('¿Borrar todo?', 'Se eliminan todos tus registros de este celular.', 'Borrar todo')) return; await DB.clear('items'); items = []; toast('Todo borrado'); back(); }
};
async function setupPeriodic(){ try { const r = await navigator.serviceWorker.ready; if (!('periodicSync' in r)) return false; const st = await navigator.permissions.query({name:'periodic-background-sync'}).catch(() => ({state:'denied'})); if (st.state !== 'granted') return false; await r.periodicSync.register('vence-avisos', {minInterval:12 * 3600e3}); return true; } catch(e){ return false; } }
async function importBk(file){ let d; try { d = JSON.parse(await file.text()); } catch(e){ return toast('Ese archivo no es una copia válida.'); }
  if (!d || d.app !== 'vencimientos' || !Array.isArray(d.items)) return toast('Ese archivo no es una copia válida.');
  let n = 0; for (const r of d.items){ const i = clean(r); if (!i) continue; await saveItem(i); n++; } render(); toast(`${plural(n, 'registro restaurado', 'registros restaurados')}`); }

/* ---------- Eventos ---------- */
document.addEventListener('click', async e => {
  const t = e.target.closest('[data-act],[data-open],[data-filter],[data-cat],[data-rep],[data-qd]'); if (!t) return; const ds = t.dataset;
  if (ds.open) return go({name:'detail', id:ds.open});
  if (ds.filter){ filter = ds.filter; return render(); }
  if (ds.cat){ keepForm(); const c = CATS[ds.cat], was = CATS[draft.cat]; draft.cat = ds.cat; if (draft.warn === was.warn) draft.warn = c.warn; draft.repeat = c.repeat || (draft.repeat && was.repeat ? null : draft.repeat); if (!c.price && !draft.repeat) draft.price = null; render(); return; }
  if (ds.rep){ keepForm(); draft.repeat = ds.rep === 'none' ? null : ds.rep; render(); return; }
  if (ds.qd){ const base = todayKey(), v = ds.qd, d = v.startsWith('m') ? addMonths(base, +v.slice(1)) : addDays(base, +v); $('#f_date').value = d; $('#e_date').textContent = ''; document.querySelectorAll('[data-qd]').forEach(b => b.classList.toggle('on', b === t)); return; }
  if (ds.act && A[ds.act]) A[ds.act](t);
});
document.addEventListener('input', e => { const t = e.target; if (t.id === 'q'){ query = t.value; const w = $('#listWrap'); if (w){ w.innerHTML = listHTML(); paint(); } } if (t.id === 'f_name') $('#e_name').textContent = ''; if (t.id === 'f_date'){ $('#e_date').textContent = ''; document.querySelectorAll('[data-qd]').forEach(b => b.classList.remove('on')); } });
document.addEventListener('change', async e => { const t = e.target;
  if (t.id === 'f_photo'){ const f = t.files && t.files[0]; if (!f || !draft) return; try { draft.photo = await compress(f); $('#photoSlot').outerHTML = photoSlot(); } catch(err){ toast('No se pudo cargar la foto.'); } }
  if (t.id === 'f_import'){ const f = t.files && t.files[0]; t.value = ''; if (f) importBk(f); } });
document.addEventListener('keydown', e => { if (e.key === 'Escape' && ovState) resolveSheet(null); });
document.addEventListener('contextmenu', e => { if (e.target.closest('img')) e.preventDefault(); });
window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); installEvt = e; if (['home','settings'].includes(view.name)) render(); });
window.addEventListener('appinstalled', () => { installEvt = null; toast('Vencimientos instalada'); render(); });
document.addEventListener('visibilitychange', async () => { if (!document.hidden && items.length){ await autoRenew(); if (['home','bell'].includes(view.name)) render(); } });

/* ---------- Inicio ---------- */
(async () => {
  if ('serviceWorker' in navigator && window.isSecureContext) navigator.serviceWorker.register('sw.js', {scope:'./'}).catch(() => {});
  if (!window.indexedDB || !await DB.open()){ main.innerHTML = '<div class="empty"><h2>No se puede guardar</h2><p>Este navegador no permite guardar datos. Si estás en modo incógnito, abre la app en una pestaña normal.</p></div>'; return; }
  try { items = (await DB.all('items')).map(clean).filter(Boolean); } catch(e){ items = []; }
  try { const s = await DB.get('meta', 'seen'); if (s && Array.isArray(s.v)) seen = new Set(s.v); } catch(e){}
  try { const s = await DB.get('meta', 'notif'); notifOn = !!(s && s.v); if (notifOn && window.Notification && Notification.permission === 'granted') setupPeriodic(); } catch(e){}
  if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});
  await autoRenew(); history.replaceState({root:1}, ''); render();
})();
})();
