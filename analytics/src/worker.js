import dashboardHtml from './dashboard.html';
import dashboardCss from './dashboard.css';
import dashboardJs from './dashboard-client.js';
import privacyHtml from './privacy.html';

const PREFIX = '/datapanel';
const ACTIVE_MS = 90 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;
const SESSION_MS = 12 * 60 * 60 * 1000;
const te = new TextEncoder();

function response(body, status = 200, type = 'application/json; charset=utf-8', extras = {}) {
  const headers = {
    'Content-Type': type,
    'Cache-Control': 'private, no-store, max-age=0',
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'no-referrer',
    'X-Frame-Options': 'DENY',
    ...extras
  };
  if (type.includes('text/html')) {
    headers['Content-Security-Policy'] = "default-src 'none'; script-src 'self'; style-src 'self'; connect-src 'self'; img-src 'self' data:; base-uri 'none'; form-action 'self'; frame-ancestors 'none'";
  }
  return new Response(body, { status, headers });
}
const json = (data, status = 200, extras = {}) => response(JSON.stringify(data), status, 'application/json; charset=utf-8', extras);

function configOK(env) {
  return !!(env.DB && typeof env.ADMIN_PASSWORD === 'string' && env.ADMIN_PASSWORD.length >= 16 &&
    typeof env.SESSION_SECRET === 'string' && env.SESSION_SECRET.length >= 32);
}
function hexId(value) {
  return typeof value === 'string' && /^[a-f0-9]{32}$/.test(value);
}
function clean(value, length = 80) {
  return String(value || '').replace(/[\x00-\x1F\x7F<>]/g, '').slice(0, length);
}
function getIp(request) {
  // CF-Connecting-IP is supplied by Cloudflare, not by the visitor's JSON.
  return clean(request.headers.get('CF-Connecting-IP') || '', 45);
}
async function hash(value) {
  return new Uint8Array(await crypto.subtle.digest('SHA-256', te.encode(value)));
}
function safeEqual(a, b) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}
function toHex(bytes) {
  return Array.from(bytes).map(n => n.toString(16).padStart(2, '0')).join('');
}
function toBase64Url(bytes) {
  let raw = '';
  for (const b of bytes) raw += String.fromCharCode(b);
  return btoa(raw).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}
function fromBase64Url(value) {
  if (!/^[A-Za-z0-9_-]+$/.test(value)) return null;
  try {
    const raw = atob(value.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - value.length % 4) % 4));
    return Uint8Array.from(raw, ch => ch.charCodeAt(0));
  } catch (_) { return null; }
}
async function hmacKey(secret) {
  return crypto.subtle.importKey('raw', te.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']);
}
async function signSession(env) {
  const payload = toBase64Url(te.encode(JSON.stringify({ exp: Date.now() + SESSION_MS, v: 1 })));
  const signature = await crypto.subtle.sign('HMAC', await hmacKey(env.SESSION_SECRET), te.encode(payload));
  return payload + '.' + toBase64Url(new Uint8Array(signature));
}
async function authenticated(request, env) {
  if (!configOK(env)) return false;
  const match = (request.headers.get('Cookie') || '').match(/(?:^|;\s*)sb_admin_session=([^;]+)/);
  if (!match) return false;
  const parts = match[1].split('.');
  if (parts.length !== 2 || parts[0].length > 250 || parts[1].length > 100) return false;
  const signature = fromBase64Url(parts[1]);
  const payloadBytes = fromBase64Url(parts[0]);
  if (!signature || !payloadBytes) return false;
  const verified = await crypto.subtle.verify('HMAC', await hmacKey(env.SESSION_SECRET), signature, te.encode(parts[0]));
  if (!verified) return false;
  try {
    const payload = JSON.parse(new TextDecoder().decode(payloadBytes));
    return payload.v === 1 && Number.isFinite(payload.exp) && payload.exp > Date.now() && payload.exp <= Date.now() + SESSION_MS;
  } catch (_) { return false; }
}
function sameOrigin(request, url) {
  const origin = request.headers.get('Origin');
  const fetchSite = request.headers.get('Sec-Fetch-Site');
  return (!origin || origin === url.origin) && fetchSite !== 'cross-site';
}
function classify(userAgent) {
  const ua = String(userAgent || '').slice(0, 450);
  const os = /webOS|Web0S|NetCast/i.test(ua) ? 'LG webOS' :
    /Android/i.test(ua) ? 'Android' :
    /iPad|iPhone|iPod/i.test(ua) ? 'iOS' :
    /Windows/i.test(ua) ? 'Windows' :
    /Macintosh|Mac OS X/i.test(ua) ? 'macOS' :
    /Linux/i.test(ua) ? 'Linux' : 'אחר';
  const browser = /Edg\//i.test(ua) ? 'Edge' :
    /SamsungBrowser/i.test(ua) ? 'Samsung Internet' :
    /Firefox|FxiOS/i.test(ua) ? 'Firefox' :
    /CriOS|Chrome/i.test(ua) ? 'Chrome' :
    /Safari/i.test(ua) ? 'Safari' :
    /Web0S|webOS|NetCast/i.test(ua) ? 'דפדפן LG' : 'אחר';
  const device = /TV|webOS|Web0S|NetCast|SMART-TV|BRAVIA|AFT[A-Z0-9]+/i.test(ua) ? 'טלוויזיה' :
    /iPad|Tablet/i.test(ua) || (/Android/i.test(ua) && !/Mobile/i.test(ua)) ? 'טאבלט' :
    /Mobile|iPhone|Android/i.test(ua) ? 'טלפון' : 'מחשב';
  return { os, browser, device };
}

async function collect(request, env, url) {
  if (!sameOrigin(request, url)) return json({ ok: false }, 403);
  if (!/application\/json/i.test(request.headers.get('Content-Type') || '')) return json({ ok: false }, 415);
  if (Number(request.headers.get('Content-Length') || 0) > 2048) return json({ ok: false }, 413);
  const raw = await request.text();
  if (raw.length > 2048) return json({ ok: false }, 413);
  let data;
  try { data = JSON.parse(raw); } catch (_) { return json({ ok: false }, 400); }
  if (!data || !hexId(data.visitorId) || !hexId(data.viewId) || !['board', 'elevator'].includes(data.screen)) {
    return json({ ok: false }, 400);
  }
  const path = clean(data.path, 96);
  if (!/^\/[a-zA-Z0-9/_.-]{0,95}$/.test(path)) return json({ ok: false }, 400);
  const referrer = clean(data.referrer, 120);
  if (referrer && !/^[A-Za-z0-9.-]+$/.test(referrer)) return json({ ok: false }, 400);
  const now = Date.now();
  const user = classify(request.headers.get('User-Agent'));
  const cf = request.cf || {};
  await env.DB.prepare(
    'INSERT INTO visits (id, visitor_id, screen, path, started_at, last_seen, ip, country, city, browser, os, device, referrer) ' +
    'VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) ' +
    'ON CONFLICT(id) DO UPDATE SET last_seen = MAX(visits.last_seen, excluded.last_seen)'
  ).bind(data.viewId, data.visitorId, data.screen, path, now, now, getIp(request),
    clean(cf.country, 4), clean(cf.city, 72), user.browser, user.os, user.device, referrer).run();
  return json({ ok: true });
}
async function login(request, env, url) {
  if (!sameOrigin(request, url)) return json({ error: 'הגישה נדחתה' }, 403);
  if (!/application\/json/i.test(request.headers.get('Content-Type') || '')) return json({ error: 'בקשה לא תקינה' }, 415);
  if (Number(request.headers.get('Content-Length') || 0) > 1024) return json({ error: 'בקשה לא תקינה' }, 413);
  const raw = await request.text();
  if (raw.length > 1024) return json({ error: 'בקשה לא תקינה' }, 413);
  let body;
  try { body = JSON.parse(raw); } catch (_) { return json({ error: 'בקשה לא תקינה' }, 400); }
  const password = body && typeof body.password === 'string' ? body.password : '';
  if (password.length > 200) return json({ error: 'סיסמה שגויה' }, 401);
  const ipHash = toHex(await hash(env.SESSION_SECRET + ':' + getIp(request)));
  const now = Date.now();
  const attempts = await env.DB.prepare('SELECT attempts, window_start FROM login_attempts WHERE ip_hash=?').bind(ipHash).first();
  if (attempts && attempts.attempts >= 5 && now - attempts.window_start < 15 * 60 * 1000) {
    return json({ error: 'יותר מדי ניסיונות. אפשר לנסות שוב בעוד 15 דקות.' }, 429, { 'Retry-After': '900' });
  }
  const valid = safeEqual(await hash(password), await hash(env.ADMIN_PASSWORD));
  if (!valid) {
    const newCount = attempts && now - attempts.window_start < 15 * 60 * 1000 ? Number(attempts.attempts) + 1 : 1;
    const start = attempts && now - attempts.window_start < 15 * 60 * 1000 ? attempts.window_start : now;
    await env.DB.prepare('INSERT INTO login_attempts (ip_hash, window_start, attempts) VALUES (?, ?, ?) ' +
      'ON CONFLICT(ip_hash) DO UPDATE SET window_start=excluded.window_start, attempts=excluded.attempts')
      .bind(ipHash, start, newCount).run();
    return json({ error: 'סיסמה שגויה' }, 401);
  }
  await env.DB.prepare('DELETE FROM login_attempts WHERE ip_hash=?').bind(ipHash).run();
  const token = await signSession(env);
  return json({ ok: true }, 200, {
    'Set-Cookie': 'sb_admin_session=' + token + '; Path=/datapanel; Max-Age=43200; HttpOnly; Secure; SameSite=Strict'
  });
}
async function stats(env, url) {
  const range = url.searchParams.get('range') || 'day';
  if (!['day', 'week', 'month'].includes(range)) return json({ error: 'טווח לא תקין' }, 400);
  const now = Date.now();
  const cutoff = now - ({ day: DAY_MS, week: 7 * DAY_MS, month: 30 * DAY_MS })[range];
  const interval = range === 'day' ? 60 * 60 * 1000 : DAY_MS;
  const activeSince = now - ACTIVE_MS;
  const queries = await Promise.all([
    env.DB.prepare('SELECT COUNT(DISTINCT visitor_id) AS total FROM visits WHERE last_seen >= ?').bind(activeSince).first(),
    env.DB.prepare('SELECT screen, COUNT(DISTINCT visitor_id) AS total FROM visits WHERE last_seen >= ? GROUP BY screen').bind(activeSince).all(),
    env.DB.prepare('SELECT COUNT(*) AS views, COUNT(DISTINCT visitor_id) AS visitors FROM visits WHERE started_at >= ?').bind(cutoff).first(),
    env.DB.prepare('SELECT screen, COUNT(*) AS views FROM visits WHERE started_at >= ? GROUP BY screen').bind(cutoff).all(),
    env.DB.prepare('SELECT (CAST(started_at / ? AS INTEGER) * ?) AS bucket, COUNT(*) AS views FROM visits WHERE started_at >= ? GROUP BY bucket ORDER BY bucket').bind(interval, interval, cutoff).all(),
    env.DB.prepare('SELECT path, screen, COUNT(*) AS views FROM visits WHERE started_at >= ? GROUP BY path, screen ORDER BY views DESC LIMIT 10').bind(cutoff).all(),
    env.DB.prepare('SELECT device AS name, COUNT(*) AS views FROM visits WHERE started_at >= ? GROUP BY device ORDER BY views DESC').bind(cutoff).all(),
    env.DB.prepare('SELECT browser AS name, COUNT(*) AS views FROM visits WHERE started_at >= ? GROUP BY browser ORDER BY views DESC LIMIT 8').bind(cutoff).all(),
    env.DB.prepare('SELECT country AS name, COUNT(*) AS views FROM visits WHERE started_at >= ? GROUP BY country ORDER BY views DESC LIMIT 8').bind(cutoff).all(),
    env.DB.prepare('SELECT visitor_id, screen, path, started_at, last_seen, CASE WHEN started_at < ? THEN NULL ELSE ip END AS ip, country, city, browser, os, device, referrer FROM visits WHERE last_seen >= ? ORDER BY last_seen DESC LIMIT 80').bind(now - 7 * DAY_MS, cutoff).all()
  ]);
  return json({
    ok: true, now, range, activeWindowSeconds: 90,
    active: Number(queries[0]?.total || 0),
    activeScreens: queries[1].results,
    totals: queries[2],
    screenViews: queries[3].results,
    trend: queries[4].results, interval,
    pages: queries[5].results,
    devices: queries[6].results,
    browsers: queries[7].results,
    countries: queries[8].results,
    recent: queries[9].results
  });
}
async function cleanup(env) {
  const now = Date.now();
  await env.DB.batch([
    env.DB.prepare('UPDATE visits SET ip = NULL WHERE ip IS NOT NULL AND started_at < ?').bind(now - 6 * DAY_MS),
    env.DB.prepare('DELETE FROM visits WHERE started_at < ?').bind(now - 89 * DAY_MS),
    env.DB.prepare('DELETE FROM login_attempts WHERE window_start < ?').bind(now - DAY_MS)
  ]);
}
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname.replace(/\/+$/, '') || '/';
    if (!path.startsWith(PREFIX + '/') && path !== PREFIX) return response('Not found', 404, 'text/plain; charset=utf-8');
    if (path === PREFIX || path === PREFIX + '/admin') {
      if (request.method !== 'GET') return json({ error: 'Method not allowed' }, 405);
      return response(dashboardHtml, 200, 'text/html; charset=utf-8');
    }
    if (path === PREFIX + '/app.css' && request.method === 'GET') return response(dashboardCss, 200, 'text/css; charset=utf-8');
    if (path === PREFIX + '/app.js' && request.method === 'GET') return response(dashboardJs, 200, 'text/javascript; charset=utf-8');
    if (path === PREFIX + '/privacy' && request.method === 'GET') return response(privacyHtml, 200, 'text/html; charset=utf-8');
    if (path === PREFIX + '/health' && request.method === 'GET') return json({ ok: configOK(env) });
    if (!configOK(env)) return json({ error: 'Analytics backend is not configured' }, 503);
    try {
      if (path === PREFIX + '/collect' && request.method === 'POST') return await collect(request, env, url);
      if (path === PREFIX + '/api/login' && request.method === 'POST') return await login(request, env, url);
      if (path === PREFIX + '/api/logout' && request.method === 'POST') {
        if (!sameOrigin(request, url)) return json({ error: 'Forbidden' }, 403);
        return json({ ok: true }, 200, { 'Set-Cookie': 'sb_admin_session=; Path=/datapanel; Max-Age=0; HttpOnly; Secure; SameSite=Strict' });
      }
      if (path === PREFIX + '/api/stats' && request.method === 'GET') {
        if (!await authenticated(request, env)) return json({ error: 'נדרשת כניסה' }, 401);
        return await stats(env, url);
      }
      return json({ error: 'Not found' }, 404);
    } catch (error) {
      console.error('analytics request error', error?.name || 'error');
      return json({ error: 'שגיאת שירות. נסה שוב.' }, 503);
    }
  },
  async scheduled(_event, env, ctx) {
    ctx.waitUntil(cleanup(env));
  }
};