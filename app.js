var KEY = 'hinos-sacramental-v1', data = {}, db = null, loaded = false, pending = false, open = null;
try { data = JSON.parse(localStorage.getItem(KEY) || '{}') } catch (e) { data = {} }
var SLOTS = [['abertura', 'Hino de abertura'], ['sacramental', 'Hino sacramental'], ['intermediario', 'Hino intermediário (opcional)'], ['final', 'Hino final']];
function iso(d) { return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0') }
function parse(s) { var p = s.split('-'); return new Date(+p[0], +p[1] - 1, +p[2]) }
function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c] }) }
var today, nextSun;
/* "Próximo domingo" = hoje, se for domingo; senão, o domingo seguinte.
   Na segunda-feira ele avança para o domingo seguinte e o anterior vai para o histórico. */
function updateDates() {
  today = new Date(); today.setHours(0, 0, 0, 0);
  nextSun = new Date(today); nextSun.setDate(nextSun.getDate() + (7 - nextSun.getDay()) % 7);
}
updateDates();
/* Se a página ficar aberta na virada do dia, atualiza sozinha */
function checkDay() {
  var t = new Date(); t.setHours(0, 0, 0, 0);
  if (+t !== +today) { updateDates(); if (open) pending = true; else render() }
}
setInterval(checkDay, 60000);
document.addEventListener('visibilitychange', checkDay);
/* Gera todos os domingos entre duas datas (inclusive) */
function sundaysBetween(a, b) { var out = [], d = new Date(a); d.setDate(d.getDate() + (7 - d.getDay()) % 7); while (d <= b) { out.push(iso(d)); d.setDate(d.getDate() + 7) } return out }
var backMonths = 6, aheadWeeks = 4, all = [];
function build() {
  var s = new Date(today); s.setMonth(s.getMonth() - backMonths);
  var e = new Date(nextSun); e.setDate(e.getDate() + 7 * aheadWeeks);
  all = sundaysBetween(s, e);
}
function fmt(s, o) { return parse(s).toLocaleDateString('pt-BR', o) }
function persistLocal() { try { localStorage.setItem(KEY, JSON.stringify(data)) } catch (e) { } }
/* Banco online (Supabase). Configure em config.js */
var SB_URL = (window.SUPABASE_URL || '').replace(/\/$/, ''), SB_KEY = window.SUPABASE_KEY || '';
var SB = SB_URL.indexOf('https://') === 0 && SB_URL.indexOf('SEU-PROJETO') < 0 && SB_KEY.indexOf('COLE-AQUI') < 0;
function sb(path, opt) {
  opt = opt || {};
  opt.headers = Object.assign({ apikey: SB_KEY, Authorization: 'Bearer ' + SB_KEY, 'Content-Type': 'application/json' }, opt.headers || {});
  return fetch(SB_URL + '/rest/v1/' + path, opt).then(function (r) {
    if (!r.ok) throw new Error(r.status);
    return r.status === 204 ? null : r.text().then(function (t) { return t ? JSON.parse(t) : null });
  });
}
function saveDay(s, e) {
  if (e) data[s] = e; else delete data[s];
  if (!SB) { persistLocal(); return }
  var req = e ? sb('domingos?on_conflict=dia', { method: 'POST', headers: { Prefer: 'resolution=merge-duplicates,return=minimal' }, body: JSON.stringify({ dia: s, hinos: e, atualizado_em: new Date().toISOString() }) })
    : sb('domingos?dia=eq.' + s, { method: 'DELETE' });
  req.catch(function () { status('Não foi possível salvar online. Tente de novo.') });
}
function status(t) { document.getElementById('st').textContent = t }
function summary(s) {
  var e = data[s] || {}, h = '';
  SLOTS.forEach(function (sl) { var v = e[sl[0]]; if (v && (v.n || v.t)) h += '<div><span class="n">' + esc(v.n || '') + '</span>' + esc(v.t || '') + '</div>' });
  return h || '<div class="empty">Sem hinos registrados</div>';
}
function repeats(s, k, n) {
  if (!n) return ''; var out = [];
  Object.keys(data).forEach(function (o) {
    if (o === s || Math.abs(parse(o) - parse(s)) > 56 * 864e5) return;
    SLOTS.forEach(function (sl) { var v = data[o][sl[0]]; if (v && String(v.n).trim() === String(n).trim()) out.push(fmt(o, { day: 'numeric', month: 'short' })) });
  });
  return out.length ? 'Também cantado em ' + out.filter(function (x, i) { return out.indexOf(x) === i }).join(', ') + '.' : '';
}
function rowHtml(s) {
  var isNext = iso(nextSun) === s, h = '<div class="row' + (isNext ? ' next' : '') + '">';
  h += '<button class="head" data-d="' + s + '" aria-expanded="' + (open === s) + '"><div class="day"><b>' + parse(s).getDate() + '</b><span>' + fmt(s, { month: 'short' }).replace('.', '') + '</span></div><div class="sum">' + (isNext ? '<div class="tag">' + (iso(today) === s ? 'Hoje' : 'Próximo domingo') + '</div>' : '') + summary(s) + '</div></button>';
  if (open === s) {
    var e = data[s] || {};
    h += '<div class="ed">';
    SLOTS.forEach(function (sl) {
      var v = e[sl[0]] || { n: '', t: '' };
      h += '<div class="slot"><label for="n-' + sl[0] + '">' + sl[1] + '</label><div class="pair"><input class="num" id="n-' + sl[0] + '" data-k="' + sl[0] + '" inputmode="numeric" placeholder="Nº" value="' + esc(v.n || '') + '" aria-label="Número do hino"><input class="tit" id="t-' + sl[0] + '" data-k="' + sl[0] + '" placeholder="Título" value="' + esc(v.t || '') + '" aria-label="Título do hino"></div><div class="warn" id="w-' + sl[0] + '">' + repeats(s, sl[0], v.n) + '</div></div>';
    });
    h += '<div class="acts"><button class="b" data-save="' + s + '">Salvar</button><button class="b o" data-clear="' + s + '">Limpar</button></div></div>';
  }
  return h + '</div>';
}
function render() {
  pending = false; build();
  var up = all.filter(function (s) { return parse(s) >= nextSun }), past = all.filter(function (s) { return parse(s) < nextSun }).reverse();
  var h = '<h2>Próximos domingos</h2>' + up.map(rowHtml).join('') + '<button class="b o more" data-more="ahead">Ver mais domingos à frente</button>', cur = '';
  past.forEach(function (s) { var m = fmt(s, { month: 'long', year: 'numeric' }); if (m !== cur) { cur = m; h += '<h2>' + m + '</h2>' } h += rowHtml(s) });
  h += '<button class="b o more" data-more="back">Ver meses anteriores</button>';
  document.getElementById('app').innerHTML = h;
}
function collect(s) {
  var e = {}, any = false;
  SLOTS.forEach(function (sl) { var n = document.getElementById('n-' + sl[0]).value.trim(), t = document.getElementById('t-' + sl[0]).value.trim(); e[sl[0]] = { n: n, t: t }; if (n || t) any = true });
  saveDay(s, any ? e : null);
}
function close() { open = null; render() }
document.getElementById('app').addEventListener('click', function (ev) {
  var t = ev.target.closest('button'); if (!t) return;
  if (t.dataset.more === 'ahead') { aheadWeeks += 8; render() }
  else if (t.dataset.more === 'back') { backMonths += 6; render() }
  else if (t.dataset.d) { open = open === t.dataset.d ? null : t.dataset.d; render(); var f = document.getElementById('n-abertura'); if (open && f) f.focus(); }
  else if (t.dataset.save) { collect(t.dataset.save); close() }
  else if (t.dataset.clear) { saveDay(t.dataset.clear, null); close() }
});
document.getElementById('app').addEventListener('input', function (ev) {
  var i = ev.target; if (!i.classList.contains('num') || !open) return;
  document.getElementById('w-' + i.dataset.k).textContent = repeats(open, i.dataset.k, i.value);
});
function load() {
  sb('domingos?select=dia,hinos').then(function (rows) {
    var next = {}; rows.forEach(function (r) { next[r.dia] = r.hinos });
    data = next; loaded = true;
    status('Histórico compartilhado: todos que abrirem esta página veem os mesmos hinos.');
    if (open) pending = true; else render();
  }).catch(function () { status('Não foi possível carregar o histórico online. Os dados podem estar desatualizados.') });
}
function connect() {
  if (!SB) return;
  status('Carregando histórico compartilhado…');
  load();
  setInterval(function () { if (!open) load() }, 30000);
}
status('Os registros ficam salvos neste navegador.');
render(); connect();