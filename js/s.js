/* What people do on chemistrylabs.in. Sends to the collector in ~/chemistry-labs-signal.
   Never reads what anyone types. The one exception is the phone number on an application,
   which the collector turns into a keyed hash and never stores.
   Open any page with ?cl-me=1 to switch this off on your own device, ?cl-me=0 to undo. */
(function () {
  var GA = 'G-L1BGC45RJ5';  // Google Analytics measurement ID
  var CLARITY = 'z8sy9me8i4';  // Microsoft Clarity project ID

  var local = /^(localhost|127\.0\.0\.1)$/.test(location.hostname);
  var URL_E = local ? 'http://localhost:8787/e' : 'https://cl-signal.manavjoshi01.workers.dev/e';
  var ls = {}, ss = {};
  function get(k) { try { return localStorage.getItem(k); } catch (e) { return ls[k] || null; } }
  function put(k, v) { try { localStorage.setItem(k, v); } catch (e) { ls[k] = v; } }
  function sget(k) { try { return sessionStorage.getItem(k); } catch (e) { return ss[k] || null; } }
  function sput(k, v) { try { sessionStorage.setItem(k, v); } catch (e) { ss[k] = v; } }

  var q = new URLSearchParams(location.search);
  if (q.get('cl-me') === '1') put('cl-off', '1');
  if (q.get('cl-me') === '0') put('cl-off', '');
  if (get('cl-off') === '1' || navigator.globalPrivacyControl === true) return;

  function rid() { return Math.random().toString(36).slice(2, 12) + Date.now().toString(36); }
  var beacon = navigator.sendBeacon ? navigator.sendBeacon.bind(navigator) : null;

  /* Who, as a random id. A visit ends after 30 quiet minutes. */
  var vid = get('cl-v'); if (!vid) { vid = rid(); put('cl-v', vid); }
  var now = Date.now(), last = +get('cl-t') || 0, sid = get('cl-s'), fresh = !sid || now - last > 18e5;
  if (fresh) { sid = rid(); put('cl-s', sid); }
  put('cl-t', String(now));
  var pid = rid(), path = location.pathname;

  /* Sending. Batched, and flushed when the page is hidden, because phones never promise an unload. */
  var queue = [], timer = 0;
  function flush() {
    clearTimeout(timer); timer = 0;
    if (!queue.length) return;
    var body = JSON.stringify({ v: vid, s: sid, p: pid, u: path, now: Date.now(), e: queue.splice(0, 60) });
    var sent = false;
    try { if (beacon) sent = beacon(URL_E, new Blob([body], { type: 'text/plain' })); } catch (e) {}
    if (!sent) { try { fetch(URL_E, { method: 'POST', body: body, keepalive: true, mode: 'cors', headers: { 'content-type': 'text/plain' } }).catch(function () {}); } catch (e) {} }
    if (queue.length) flush();
  }
  function send(n, props) {
    queue.push({ n: n, t: Date.now(), d: props || {} });
    put('cl-t', String(Date.now()));
    if (!timer) timer = setTimeout(flush, 4000);
    if (window.gtag && GA_EVENTS[n]) gtag('event', GA_EVENTS[n], GA_SAFE(n, props || {}));
    if (window.clarity && CLARITY_EVENTS[n]) clarity('event', n);
  }
  var GA_EVENTS = { apply: 'generate_lead', form_start: 'form_start', form_try: 'form_try', out: 'outbound_click' };
  var CLARITY_EVENTS = { apply: 1, form_start: 1, form_try: 1, rage: 1, err: 1 };
  function GA_SAFE(n, d) { return n === 'out' ? { host: d.host, label: d.l } : { form: d.f || '' }; }
  window.cl = send;

  /* Where this visit came from. */
  function source() {
    var ua = navigator.userAgent, app = /Instagram/.test(ua) ? 'instagram' : /FBAN|FBAV|FB_IAB/.test(ua) ? 'facebook' : /LinkedInApp/.test(ua) ? 'linkedin' : /Snapchat/.test(ua) ? 'snapchat' : /Twitter/.test(ua) ? 'x' : /WhatsApp/.test(ua) ? 'whatsapp' : '';
    var ref = '', host = '';
    try { if (document.referrer) { ref = new URL(document.referrer); host = ref.hostname.replace(/^www\./, ''); ref = host + ref.pathname; } } catch (e) {}
    if (host === location.hostname.replace(/^www\./, '')) { ref = ''; host = ''; }
    var tag = (q.get('utm_source') || q.get('s') || q.get('ref') || '').toLowerCase();
    tag = { ig: 'instagram', fb: 'facebook', li: 'linkedin', wa: 'whatsapp' }[tag] || tag;
    var src = tag ? tag : app || (function () {
      if (!host) return 'direct';
      var m = [[/instagram/, 'instagram'], [/facebook|fb\.com/, 'facebook'], [/linkedin|lnkd/, 'linkedin'], [/whatsapp|wa\.me/, 'whatsapp'], [/google\./, 'google'], [/bing\.|duckduckgo|yahoo\.|ecosia/, 'other search'], [/chatgpt|openai|perplexity|claude\.ai|gemini/, 'ai assistant'], [/twitter|^t\.co|^x\.com/, 'x'], [/youtube|youtu\.be/, 'youtube'], [/manavjoshi/, 'manavjoshi.com']];
      for (var i = 0; i < m.length; i++) if (m[i][0].test(host)) return m[i][1];
      return host;
    })();
    return { src: src, ref: ref, app: app, med: q.get('utm_medium') || '', camp: q.get('utm_campaign') || '', cont: q.get('utm_content') || '', ad: q.get('gclid') ? 'google' : q.get('fbclid') ? 'meta' : '' };
  }
  var from = source();
  if (fresh || !get('cl-src')) put('cl-src', JSON.stringify(from));
  else if (from.src === 'direct') { try { from = JSON.parse(get('cl-src')) || from; } catch (e) {} }
  else put('cl-src', JSON.stringify(from));
  var first = get('cl-first');
  if (!first) { first = JSON.stringify({ src: from.src, camp: from.camp, cont: from.cont, at: path }); put('cl-first', first); }
  var visits = (+get('cl-n') || 0) + (fresh ? 1 : 0); put('cl-n', String(visits));

  var conn = navigator.connection || {};
  send('pv', {
    title: document.title.slice(0, 80), src: from.src, ref: from.ref, app: from.app, med: from.med, camp: from.camp, cont: from.cont, ad: from.ad,
    first: JSON.parse(first).src, visit: visits, fresh: fresh ? 1 : 0, w: innerWidth, h: innerHeight, dev: innerWidth < 768 ? 'phone' : innerWidth < 1100 ? 'tablet' : 'computer',
    lang: navigator.language, tz: (window.Intl && Intl.DateTimeFormat().resolvedOptions().timeZone) || '', net: conn.effectiveType || '', hash: location.hash.slice(0, 40)
  });

  /* Time really spent: visible, and touched in the last 30 seconds. */
  var active = 0, tick = Date.now(), touched = Date.now(), clicks = 0;
  function count() { var t = Date.now(); if (!document.hidden && t - touched < 3e4) active += t - tick; tick = t; }
  function wake() { count(); touched = Date.now(); }
  ['pointerdown', 'keydown', 'scroll', 'touchmove', 'mousemove'].forEach(function (n) { addEventListener(n, wake, { passive: true, capture: true }); });

  /* How far down. */
  var depth = 0, marks = { 25: 0, 50: 0, 75: 0, 100: 0 };
  function seen() {
    var h = document.documentElement.scrollHeight, y = (scrollY || 0) + innerHeight;
    var pc = h > 0 ? Math.min(100, Math.round(y / h * 100)) : 0;
    if (pc > depth) depth = pc;
    for (var m in marks) if (!marks[m] && pc >= +m) { marks[m] = 1; send('scroll', { pc: +m }); }
  }
  addEventListener('scroll', seen, { passive: true });

  /* Which sections were on screen, and for how long. */
  var dwell = {}, on = new Map(), order = 0;
  function label(el) {
    var by = el.getAttribute('aria-labelledby'), h = by && document.getElementById(by);
    var t = (el.getAttribute('data-cl') || el.getAttribute('aria-label') || (h && (h.innerText || h.textContent)) || (el.tagName === 'FOOTER' ? 'Footer' : el.id) || '').replace(/\s+/g, ' ').trim();
    if (!t) { h = el.querySelector('h1,h2,h3'); t = h ? (h.innerText || h.textContent).replace(/\s+/g, ' ').trim() : el.className.split(' ')[0]; }
    return t.slice(0, 48) || 'section';
  }
  function watch() {
    if (!window.IntersectionObserver) return;
    var io = new IntersectionObserver(function (es) {
      es.forEach(function (e) {
        var name = e.target.__cl;
        var big = e.intersectionRect.height >= Math.min(innerHeight, e.boundingClientRect.height) * 0.5;
        if (big && !on.has(name)) {
          on.set(name, Date.now());
          if (!(name in dwell)) { dwell[name] = 0; send('sec', { s: name, i: e.target.__i }); }
        } else if (!big && on.has(name)) {
          dwell[name] += Date.now() - on.get(name); on.delete(name);
        }
      });
    }, { threshold: [0, .1, .25, .5, .75, 1] });
    document.querySelectorAll('main > section, main > footer, footer.foot, body > section, [data-cl-sec]').forEach(function (el) { el.__cl = label(el); el.__i = order++; io.observe(el); });
  }

  /* Every click and tap. Inside a form only the field's name is kept, so no answer is ever recorded. */
  var HIT = 'a,button,summary,input,select,textarea,label,[role=button],[role=tab],[onclick],[data-cl],[tabindex]';
  var rageEl = null, rageN = 0, rageT = 0;
  function text(el) {
    var alt = el.querySelector && el.querySelector('img[alt]');
    return (el.getAttribute('data-cl') || el.getAttribute('aria-label') || (el.textContent || '').trim() || (alt && alt.alt) || el.getAttribute('title') || '').replace(/\s+/g, ' ').trim().slice(0, 60);
  }
  function classOf(el) { return typeof el.className === 'string' ? el.className.trim().split(/\s+/).slice(0, 2).join('.') : ''; }
  addEventListener('click', function (ev) {
    var t = ev.target; if (!t || !t.closest) return;
    clicks++;
    var el = t.closest(HIT), d = { y: Math.round(((ev.pageY || 0) / Math.max(1, document.documentElement.scrollHeight)) * 100) };
    var form = t.closest('form');
    if (el && form && !(el.matches('button[type=submit],input[type=submit]'))) {
      var ctl = el.tagName === 'LABEL' ? (el.control || el) : el; d.l = '[form field] ' + fname(ctl); d.k = 'field';
    } else if (el) {
      d.l = text(el) || classOf(el) || el.tagName.toLowerCase(); d.k = el.tagName.toLowerCase();
      if (el.tagName === 'A' && el.href) {
        try {
          var u = new URL(el.href, location.href); d.to = u.hostname === location.hostname ? u.pathname + u.hash : u.hostname + u.pathname;
          if (u.hostname !== location.hostname) { d.ext = 1; send('out', { host: u.hostname.replace(/^www\./, ''), l: d.l, to: d.to }); }
        } catch (e) {}
      }
    } else {
      var box = t.closest('[class]'); d.l = (box && classOf(box)) || t.tagName.toLowerCase(); d.k = 'none';
    }
    var sect = t.closest('section'); if (sect && sect.__cl) d.s = sect.__cl;
    send('click', d);
    var n = Date.now();
    if (rageEl === (el || t) && n - rageT < 1000) { if (++rageN === 3) send('rage', { l: d.l }); } else { rageEl = el || t; rageN = 1; }
    rageT = n;
  }, true);

  /* Sliders and other sideways rows. */
  var swiped = new WeakSet();
  addEventListener('scroll', function (ev) {
    var el = ev.target; if (!el || el === document || !el.scrollLeft || swiped.has(el)) return;
    swiped.add(el); send('swipe', { l: el.id || classOf(el) });
  }, { passive: true, capture: true });

  /* Forms. Field names and timing only. */
  var began = {}, lastField = {}, entered = {}, applied = false, tried = 0;
  function fname(el) { return el.type === 'radio' ? el.name : el.id || el.name || el.tagName.toLowerCase(); }
  function fid(el) { var f = el.closest('form'); return f ? (f.id || f.getAttribute('name') || 'form') : ''; }
  addEventListener('focusin', function (ev) {
    var f = fid(ev.target); if (!f || !ev.target.matches('input,select,textarea')) return;
    if (!began[f]) { began[f] = 1; send('form_start', { f: f, first: fname(ev.target) }); }
    lastField[f] = fname(ev.target); entered[fname(ev.target)] = Date.now();
  });
  addEventListener('focusout', function (ev) {
    var f = fid(ev.target); if (!f || !ev.target.matches('input,select,textarea')) return;
    var name = fname(ev.target), t = entered[name] ? Date.now() - entered[name] : 0;
    var el = ev.target, filled = el.type === 'checkbox' || el.type === 'radio' ? el.checked : !!el.value;
    send('field', { f: f, field: name, filled: filled ? 1 : 0, ms: t });
  });
  addEventListener('submit', function (ev) {
    var form = ev.target; var f = form.id || 'form'; tried++;
    send('form_try', { f: f, n: tried });
    setTimeout(function () {
      var bad = [].map.call(form.querySelectorAll('.bad,[aria-invalid=true]'), function (b) { return b.id || b.name || classOf(b); });
      if (bad.length && !applied) send('form_bad', { f: f, bad: bad.slice(0, 12) });
    }, 120);
  }, true);

  /* An application. The page's own send goes out exactly as it did; this only reads it. */
  function receipt(u, data) {
    try {
      if (!applied && /script\.google\.com/.test(String(u)) && data instanceof URLSearchParams && data.get('phone')) {
        applied = true;
        send('apply', { first: JSON.parse(first).src, src: from.src, f: data.get('form') || data.get('step') || '', again: data.get('returning') || '', date: data.get('date') || '', _p: String(data.get('phone')).replace(/\D/g, '') });
        flush();
      }
    } catch (e) {}
  }
  if (beacon) navigator.sendBeacon = function (u, data) { receipt(u, data); return beacon(u, data); };
  var realFetch = window.fetch;
  if (realFetch) window.fetch = function (u, o) { receipt(u, o && o.body); return realFetch.apply(this, arguments); };

  /* Things breaking. */
  addEventListener('error', function (ev) { if (ev.message) send('err', { m: String(ev.message).slice(0, 160), at: String(ev.filename || '').split('/').pop() + ':' + (ev.lineno || 0) }); });
  addEventListener('unhandledrejection', function (ev) { send('err', { m: String(ev.reason && ev.reason.message || ev.reason).slice(0, 160), at: 'promise' }); });
  addEventListener('copy', function () { send('copy', {}); });

  /* Speed, as people actually got it. */
  var lcp = 0, cls = 0, inp = 0;
  function po(type, fn, opts) { try { new PerformanceObserver(function (l) { l.getEntries().forEach(fn); }).observe(Object.assign({ type: type, buffered: true }, opts)); } catch (e) {} }
  po('largest-contentful-paint', function (e) { lcp = e.startTime; });
  po('layout-shift', function (e) { if (!e.hadRecentInput) cls += e.value; });
  po('event', function (e) { if (e.duration > inp) inp = e.duration; }, { durationThreshold: 40 });

  /* Leaving. Sent every time the page is hidden, with running totals; the largest per page is the truth. */
  var perfSent = false;
  function leave() {
    count();
    for (var [name, t] of on) { dwell[name] += Date.now() - t; on.set(name, Date.now()); }
    var left = {}; for (var f in began) left[f] = lastField[f];
    send('end', { ms: active, depth: depth, clicks: clicks, dwell: dwell, left: applied ? {} : left, applied: applied ? 1 : 0 });
    if (!perfSent && (lcp || inp)) {
      perfSent = true;
      var nav = (performance.getEntriesByType('navigation') || [])[0] || {};
      send('perf', { lcp: Math.round(lcp), cls: Math.round(cls * 1000) / 1000, inp: Math.round(inp), ttfb: Math.round(nav.responseStart || 0) });
    }
    flush();
  }
  document.addEventListener('visibilitychange', function () { count(); if (document.hidden) leave(); });
  addEventListener('pagehide', leave);

  /* Outside tools load once the page has finished, so they never slow the first screen. */
  function outside() {
    document.querySelectorAll('form').forEach(function (f) { f.setAttribute('data-clarity-mask', 'true'); });
    if (!/chemistrylabs\.in$/.test(location.hostname)) return;
    if (GA) {
      window.dataLayer = window.dataLayer || []; window.gtag = function () { dataLayer.push(arguments); };
      gtag('js', new Date()); gtag('config', GA, { client_id: vid });
      var g = document.createElement('script'); g.async = true; g.src = 'https://www.googletagmanager.com/gtag/js?id=' + GA; document.head.appendChild(g);
    }
    if (CLARITY) {
      window.clarity = window.clarity || function () { (clarity.q = clarity.q || []).push(arguments); };
      var c = document.createElement('script'); c.async = true; c.src = 'https://www.clarity.ms/tag/' + CLARITY; document.head.appendChild(c);
      clarity('set', 'visitor', vid); clarity('set', 'source', from.src);
    }
  }
  function start() { watch(); seen(); if (document.readyState === 'complete') setTimeout(outside, 1200); else addEventListener('load', function () { setTimeout(outside, 1200); }); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
