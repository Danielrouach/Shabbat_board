'use strict';
(function () {
  var API = '/datapanel/api';
  var nf = new Intl.NumberFormat('he-IL');
  var state = { range: 'day', loading: false };
  function byId(id) { return document.getElementById(id); }
  function txt(id, value) { byId(id).textContent = value == null ? '—' : String(value); }
  function num(value) { return nf.format(Number(value) || 0); }
  function elem(tag, className, value) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (value != null) node.textContent = value;
    return node;
  }
  function localDate(ms, opts) {
    try { return new Date(ms).toLocaleString('he-IL', Object.assign({ timeZone: 'Asia/Jerusalem' }, opts)); }
    catch (_) { return new Date(ms).toLocaleString('he-IL'); }
  }
  async function request(path, options) {
    var result = await fetch(API + path, Object.assign({ credentials: 'same-origin', cache: 'no-store' }, options || {}));
    var data;
    try { data = await result.json(); } catch (_) { data = {}; }
    return { status: result.status, ok: result.ok, data: data };
  }
  function showLogin(message) {
    byId('loginView').hidden = false;
    byId('dashboardView').hidden = true;
    txt('loginError', message || '');
  }
  function showDashboard() {
    byId('loginView').hidden = true;
    byId('dashboardView').hidden = false;
    txt('loginError', '');
    byId('password').value = '';
  }
  function renderBars(id, data, labelFn) {
    var root = byId(id);
    root.replaceChildren();
    if (!data || !data.length) {
      root.appendChild(elem('p', 'empty', 'עדיין אין נתונים בטווח שנבחר.'));
      return;
    }
    var max = Math.max.apply(null, data.map(function (r) { return Number(r.views) || 0; })) || 1;
    data.slice(0, 6).forEach(function (row) {
      var item = elem('div', 'bar-item');
      var copy = elem('div', 'bar-copy');
      var label = elem('span', '', labelFn(row));
      label.title = label.textContent;
      copy.appendChild(label);
      copy.appendChild(elem('strong', '', num(row.views)));
      var track = elem('div', 'bar-track');
      var fill = elem('div', 'bar-fill');
      fill.style.width = Math.max(2, 100 * (Number(row.views) || 0) / max) + '%';
      track.appendChild(fill);
      item.appendChild(copy);
      item.appendChild(track);
      root.appendChild(item);
    });
  }
  function renderTrend(data) {
    var area = byId('chart');
    area.replaceChildren();
    var interval = Number(data.interval) || 3600000;
    var count = data.range === 'day' ? 24 : data.range === 'week' ? 7 : 30;
    var end = Math.floor(data.now / interval) * interval;
    var first = end - (count - 1) * interval;
    var counts = new Map((data.trend || []).map(function (r) { return [Number(r.bucket), Number(r.views) || 0]; }));
    var values = [];
    for (var i = 0; i < count; i++) values.push({ at: first + i * interval, views: counts.get(first + i * interval) || 0 });
    var max = Math.max(1, ...values.map(function (item) { return item.views; }));
    values.forEach(function (item, i) {
      var wrap = elem('div', 'chart-bar-wrap');
      var isHour = data.range === 'day';
      wrap.title = localDate(item.at, isHour ?
        { day: 'numeric', month: 'numeric', hour: '2-digit', minute: '2-digit' } :
        { day: 'numeric', month: 'long' }) + ': ' + num(item.views) + ' צפיות';
      var bar = elem('div', 'chart-bar');
      bar.style.height = (item.views ? Math.max(4, 100 * item.views / max) : 1) + '%';
      wrap.appendChild(bar);
      if (i === 0 || i === values.length - 1 || i % (isHour ? 5 : data.range === 'week' ? 2 : 6) === 0) {
        var label = elem('span', 'chart-label', localDate(item.at, isHour ? { hour: '2-digit' } : { day: 'numeric', month: 'numeric' }));
        wrap.appendChild(label);
      }
      area.appendChild(wrap);
    });
    txt('trendLabel', data.range === 'day' ? '24 השעות האחרונות' : data.range === 'week' ? '7 הימים האחרונים' : '30 הימים האחרונים');
  }
  function renderRecent(rows) {
    var root = byId('recentRows');
    root.replaceChildren();
    if (!rows || !rows.length) {
      var tr = document.createElement('tr');
      var td = elem('td', 'empty', 'לא נרשמו כניסות בטווח שנבחר.');
      td.colSpan = 7;
      tr.appendChild(td);
      root.appendChild(tr);
      return;
    }
    rows.forEach(function (v) {
      var tr = document.createElement('tr');
      function cell(value, cls) { tr.appendChild(elem('td', cls || '', value)); }
      cell(localDate(v.last_seen, { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }));
      var pageCell = elem('td');
      var pill = elem('span', 'page-pill ' + v.screen, v.screen === 'elevator' ? 'מעלית' : 'לוח שבת');
      pill.title = v.path || '';
      pageCell.appendChild(pill);
      pageCell.appendChild(elem('span', 'muted', ' ' + (v.path || '')));
      tr.appendChild(pageCell);
      cell((v.visitor_id || '').slice(0, 8), 'mono');
      cell(v.ip || 'נמחקה', 'mono');
      cell([v.city, v.country].filter(Boolean).join(' · ') || 'לא זמין');
      cell([v.device, v.browser, v.os].filter(Boolean).join(' / ') || 'לא ידוע');
      cell(v.referrer || 'כניסה ישירה');
      root.appendChild(tr);
    });
  }
  function render(data) {
    showDashboard();
    txt('lastUpdated', 'עדכון אחרון: ' + localDate(data.now, { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
    txt('activeNumber', num(data.active));
    txt('viewNumber', num(data.totals.views));
    txt('uniqueNumber', num(data.totals.visitors));
    var counts = { board: 0, elevator: 0 };
    (data.screenViews || []).forEach(function (x) { counts[x.screen] = Number(x.views) || 0; });
    var current = { board: 0, elevator: 0 };
    (data.activeScreens || []).forEach(function (x) { current[x.screen] = Number(x.total) || 0; });
    txt('boardViews', num(counts.board));
    txt('elevatorViews', num(counts.elevator));
    txt('activeBreakdown', 'כעת: לוח ' + num(current.board) + ' · מעלית ' + num(current.elevator));
    txt('boardLegend', num(counts.board));
    txt('elevatorLegend', num(counts.elevator));
    txt('donutTotal', num(counts.board + counts.elevator));
    var percent = counts.board + counts.elevator ? 100 * counts.board / (counts.board + counts.elevator) : 50;
    byId('donut').style.background = (counts.board + counts.elevator) ? 'conic-gradient(#d7b36a 0% ' + percent + '%, #54ad9d ' + percent + '% 100%)' : '#35495b';
    renderTrend(data);
    renderBars('pagesList', data.pages, function (r) { return (r.screen === 'elevator' ? 'מעלית · ' : 'לוח · ') + r.path; });
    renderBars('devicesList', data.devices, function (r) { return r.name || 'אחר'; });
    renderBars('browsersList', data.browsers, function (r) { return r.name || 'אחר'; });
    renderRecent(data.recent);
    txt('errorStatus', '');
  }
  async function refresh() {
    if (state.loading) return;
    state.loading = true;
    byId('refreshBtn').disabled = true;
    try {
      var result = await request('/stats?range=' + encodeURIComponent(state.range));
      if (result.status === 401) showLogin();
      else if (!result.ok) {
        if (byId('dashboardView').hidden) showLogin(result.data.error || 'לא ניתן לטעון נתונים.');
        else txt('errorStatus', result.data.error || 'תקלה זמנית בקריאת הנתונים.');
      } else render(result.data);
    } catch (_) {
      if (byId('dashboardView').hidden) showLogin('לא ניתן להתחבר לשרת הסטטיסטיקה.');
      else txt('errorStatus', 'תקלה בחיבור. הנתונים יוצגו ברענון הבא.');
    } finally {
      state.loading = false;
      byId('refreshBtn').disabled = false;
    }
  }
  byId('loginForm').addEventListener('submit', async function (event) {
    event.preventDefault();
    var password = byId('password').value;
    byId('loginBtn').disabled = true;
    txt('loginError', '');
    try {
      var result = await request('/login', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: password })
      });
      if (!result.ok) txt('loginError', result.data.error || 'ההתחברות נכשלה.');
      else await refresh();
    } catch (_) { txt('loginError', 'לא ניתן להתחבר לשרת.'); }
    finally { byId('loginBtn').disabled = false; }
  });
  byId('logoutBtn').addEventListener('click', async function () {
    try { await request('/logout', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' }); } catch (_) {}
    showLogin('התנתקת מהמערכת.');
  });
  byId('refreshBtn').addEventListener('click', refresh);
  byId('range').addEventListener('change', function () { state.range = byId('range').value; refresh(); });
  document.addEventListener('visibilitychange', function () { if (!document.hidden && !byId('dashboardView').hidden) refresh(); });
  setInterval(function () { if (!document.hidden && !byId('dashboardView').hidden) refresh(); }, 20000);
  refresh();
})();