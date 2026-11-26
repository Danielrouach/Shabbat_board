/* Small, ES5-compatible and fail-closed: never affects the kiosk display.
 * Uses a same-origin Cloudflare Worker route only when /_analytics/health responds.
 * No Google Analytics, cookies, third-party scripts or query parameters.
 */
(function (w, d) {
  'use strict';
  if (w.SHABBAT_DISABLE_ANALYTICS || !w.XMLHttpRequest) return;
  var prefix = '/_analytics/';
  var path = w.location.pathname || '/';
  var screen = /(?:^|\/)elevator(?:\/|\.html|$)/i.test(path) ? 'elevator' : 'board';
  function randomId() {
    var chars = '0123456789abcdef', s = '', i;
    try {
      if (w.crypto && w.crypto.getRandomValues && w.Uint8Array) {
        var bytes = new w.Uint8Array(16);
        w.crypto.getRandomValues(bytes);
        for (i = 0; i < bytes.length; i++) s += chars.charAt(bytes[i] >> 4) + chars.charAt(bytes[i] & 15);
        return s;
      }
    } catch (e) {}
    for (i = 0; i < 32; i++) s += chars.charAt(Math.floor(Math.random() * 16));
    return s;
  }
  var visitorId;
  try {
    visitorId = w.localStorage.getItem('shabbat_analytics_visitor_v1');
    if (!/^[a-f0-9]{32}$/.test(visitorId || '')) {
      visitorId = randomId();
      w.localStorage.setItem('shabbat_analytics_visitor_v1', visitorId);
    }
  } catch (e) { visitorId = randomId(); }
  var viewId = randomId();
  var referrer = '';
  try {
    if (d.referrer) {
      var link = d.createElement('a');
      link.href = d.referrer;
      referrer = (link.hostname || '').slice(0, 120);
    }
  } catch (ignore) {}
  function isVisible() {
    return !(typeof d.hidden === 'boolean' && d.hidden);
  }
  function report() {
    if (!isVisible()) return;
    try {
      var req = new w.XMLHttpRequest();
      req.open('POST', prefix + 'collect', true);
      req.setRequestHeader('Content-Type', 'application/json');
      req.send(JSON.stringify({
        visitorId: visitorId,
        viewId: viewId,
        screen: screen,
        path: path.slice(0, 96),
        referrer: referrer
      }));
    } catch (ignore) {}
  }
  // Never send a heartbeat if the Cloudflare route has not been activated.
  try {
    var probe = new w.XMLHttpRequest();
    probe.open('GET', prefix + 'health', true);
    probe.onreadystatechange = function () {
      if (probe.readyState !== 4) return;
      if (probe.status !== 200 || !/"ok"\s*:\s*true/.test(probe.responseText || '')) return;
      report();
      w.setInterval(report, 30000);
      if (d.addEventListener) d.addEventListener('visibilitychange', report, false);
      if (w.addEventListener) w.addEventListener('pageshow', report, false);
    };
    probe.send(null);
  } catch (ignore) {}
})(window, document);