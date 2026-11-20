(function () {
  'use strict';
  var calm = matchMedia('(prefers-reduced-motion: reduce)').matches, fine = matchMedia('(pointer:fine)').matches;
  var curtainUp = document.documentElement.classList.contains('curtain-first');
  addEventListener('curtainup', function () { curtainUp = false; });
  function afterCurtain(fn) { if (curtainUp) addEventListener('curtainup', fn, { once: true }); else fn(); }
  var clamp = function (v, a, b) { return Math.max(a, Math.min(b, v)); };
  var ease = function (t) { return 1 - Math.pow(1 - t, 3); };

  /* ── Arrivals ─────────────────────────────────────────── */
  var io = 'IntersectionObserver' in window ? new IntersectionObserver(function (es) {
    es.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add('on'); io.unobserve(e.target); } });
  }, { rootMargin: '0px 0px -8% 0px' }) : null;
  document.querySelectorAll('[data-up],.float').forEach(function (el) { if (io && !calm) io.observe(el); else el.classList.add('on'); });


  /* ── Hero: objects drop into the sentence and can be thrown ── */
  var hero = document.querySelector('.hero'), things = [], world = { w: 0, h: 0, awake: false, on: true };
  function spark(x, y) {
    if (hero.querySelectorAll('.spark').length > 4) return;
    var s = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    s.setAttribute('viewBox', '0 0 48 48'); s.setAttribute('class', 'spark');
    s.innerHTML = '<path d="M24 4v11M24 33v11M4 24h11M33 24h11M10 10l8 8M30 30l8 8M38 10l-8 8M18 30l-8 8"/>';
    s.style.left = x + 'px'; s.style.top = y + 'px'; hero.appendChild(s);
    setTimeout(function () { s.remove(); }, 520);
  }
  function measure() {
    var h = hero.getBoundingClientRect(); world.w = h.width; world.h = h.height;
    var fs = parseFloat(getComputedStyle(hero.querySelector('h1')).fontSize);
    things.forEach(function (b) {
      var r = b.slot.getBoundingClientRect();
      b.sx = r.left - h.left + r.width / 2; b.sy = r.top - h.top + r.height / 2 - fs * 0.02;
      var ratio = (b.el.naturalWidth || 1) / (b.el.naturalHeight || 1), H = fs * b.k;
      b.h = H; b.w = H * ratio;
      b.el.style.width = b.w + 'px'; b.el.style.height = b.h + 'px';
      b.r = Math.max(b.w, b.h) * 0.42;
    });
  }
  function kick() { if (!world.awake && world.on) { world.awake = true; requestAnimationFrame(step); } }
  var lastTick = 0;
  function step(now) {
    if (!world.on) { world.awake = false; return; }
    var busy = 0;
    things.forEach(function (a) {
      if (a.delay > now) { busy++; return; }
      if (a.held) {
        var nx = a.x + (a.hx - a.x) * 0.4, ny = a.y + (a.hy - a.y) * 0.4;
        a.vx = nx - a.x; a.vy = ny - a.y; a.x = nx; a.y = ny; a.va *= 0.85;
      } else if (a.loose) {
        a.vy += 0.42; a.vx *= 0.996; a.vy *= 0.996; a.va *= 0.99;
        a.x += a.vx; a.y += a.vy; a.a += a.va;
        if (a.x < a.r * 0.6) { a.x = a.r * 0.6; a.vx = Math.abs(a.vx) * 0.55; a.va += a.vy * 0.003; }
        if (a.x > world.w - a.r * 0.6) { a.x = world.w - a.r * 0.6; a.vx = -Math.abs(a.vx) * 0.55; a.va -= a.vy * 0.003; }
        if (a.y > world.h - a.h * 0.45) {
          a.y = world.h - a.h * 0.45;
          a.vy = -Math.abs(a.vy) * 0.42; a.vx *= 0.9; a.va = a.va * 0.7 + a.vx * 0.004;
        }
        /* it flies home on its own after a moment */
        if (now > a.home) a.loose = false;
      } else {
        a.vx = (a.vx + (a.sx - a.x) * 0.05) * 0.82; a.vy = (a.vy + (a.sy - a.y) * 0.05) * 0.82;
        a.va = (a.va + (a.rest - a.a) * 0.05) * 0.8;
        a.x += a.vx; a.y += a.vy; a.a += a.va;
        if (!a.landed && Math.abs(a.y - a.sy) < 10) { a.landed = true; }
      }
    });
    for (var i = 0; i < things.length; i++) for (var j = i + 1; j < things.length; j++) {
      var a = things[i], b = things[j];
      if (!(a.loose || a.held || b.loose || b.held)) continue;
      if (a.delay > now || b.delay > now) continue;
      var dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy) || 1, min = (a.r + b.r) * 0.9;
      if (d >= min) continue;
      var ux = dx / d, uy = dy / d, over = (min - d) / 2;
      if (!a.held) { a.x -= ux * over; a.y -= uy * over; }
      if (!b.held) { b.x += ux * over; b.y += uy * over; }
      var rel = (b.vx - a.vx) * ux + (b.vy - a.vy) * uy;
      if (rel < 0) {
        var imp = -rel * 0.86;
        if (!a.held) { a.vx -= ux * imp; a.vy -= uy * imp; a.va -= uy * imp * 0.008; }
        if (!b.held) { b.vx += ux * imp; b.vy += uy * imp; b.va += uy * imp * 0.008; }
        if (-rel > 2.5) {
          /* whatever gets hit comes out of the sentence too */
          [a, b].forEach(function (x) { if (!x.held && !x.loose) { x.loose = true; } x.home = now + 2400; });
          if (now - lastTick > 70) { spark(a.x + ux * a.r * 0.8, a.y + uy * a.r * 0.8); lastTick = now; }
        }
      }
    }
    things.forEach(function (a) {
      if (a.delay > now) return;
      a.el.style.visibility = 'visible';
      a.el.style.transform = 'translate3d(' + (a.x - a.w / 2).toFixed(1) + 'px,' + (a.y - a.h / 2).toFixed(1) + 'px,0) rotate(' + a.a.toFixed(3) + 'rad)';
      if (a.held || a.loose || Math.abs(a.vx) + Math.abs(a.vy) > 0.05 || Math.abs(a.x - a.sx) + Math.abs(a.y - a.sy) > 0.4 || Math.abs(a.a - a.rest) > 0.002) busy++;
    });
    if (busy) requestAnimationFrame(step); else world.awake = false;
  }
  if (hero) {
    var els = [].slice.call(hero.querySelectorAll('.thing'));
    var start = function () {
      var t0 = performance.now();
      things = els.map(function (el, i) {
        var slot = hero.querySelector('[data-slot="' + el.dataset.for + '"]');
        var b = { el: el, slot: slot, k: parseFloat(el.dataset.k) || 1.2, rest: parseFloat(el.dataset.rest) || 0, x: 0, y: -240 - i * 40, vx: 0, vy: 0, a: (i % 2 ? 1 : -1) * 0.5, va: 0, hx: 0, hy: 0, held: false, loose: false, home: 0, landed: false, delay: t0 + 350 + i * 170, sx: 0, sy: 0, w: 0, h: 0, r: 0 };
        el.style.visibility = 'hidden';
        return b;
      });
      measure();
      things.forEach(function (b) { b.x = b.sx; });
      if (calm) { things.forEach(function (b) { b.y = b.sy; b.a = b.rest; b.el.style.visibility = 'visible'; b.el.style.transform = 'translate3d(' + (b.x - b.w / 2) + 'px,' + (b.y - b.h / 2) + 'px,0) rotate(' + b.rest + 'rad)'; }); return; }
      things.forEach(function (b) {
        var moved = false, sx0 = 0, sy0 = 0;
        b.el.addEventListener('dragstart', function (e) { e.preventDefault(); });
        b.el.addEventListener('pointerdown', function (e) {
          var r = hero.getBoundingClientRect(); sx0 = e.clientX; sy0 = e.clientY; moved = false;
          b.held = true; b.hx = e.clientX - r.left; b.hy = e.clientY - r.top; b.el.classList.add('held');
          try { b.el.setPointerCapture(e.pointerId); } catch (x) {}
          kick();
        });
        b.el.addEventListener('pointermove', function (e) {
          if (!b.held) return;
          var r = hero.getBoundingClientRect(); b.hx = e.clientX - r.left; b.hy = e.clientY - r.top;
          if (Math.abs(e.clientX - sx0) + Math.abs(e.clientY - sy0) > 6) moved = true;
        });
        var drop = function (e) {
          if (!b.held) return;
          b.held = false; b.loose = true; b.home = performance.now() + 2200; b.el.classList.remove('held');
          if (!moved && e.type !== 'pointercancel') { b.vy = -15 - Math.random() * 4; b.vx = (Math.random() - 0.5) * 12; b.va = (Math.random() - 0.5) * 0.2; if (navigator.vibrate) navigator.vibrate(8); }
          kick();
        };
        b.el.addEventListener('pointerup', drop); b.el.addEventListener('pointercancel', drop);
      });
      kick();
      addEventListener('resize', function () { measure(); kick(); });
      if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { measure(); kick(); });
      new IntersectionObserver(function (es) { world.on = es[0].isIntersecting; kick(); }).observe(hero);
    };
    /* Start when all four have loaded, or after 2.5 seconds on a slow connection; a late image resizes itself */
    var left = els.length, began = false, go = function () { if (began) return; afterCurtain(function () { if (began) return; began = true; start(); }); };
    var one = function () { if (--left <= 0) go(); else if (began) { measure(); kick(); } };
    setTimeout(go, 2500);
    els.forEach(function (p) { if (p.complete && p.naturalWidth) one(); else { p.addEventListener('load', one); p.addEventListener('error', one); } });
  }

  /* ── The hooks: each card's object wakes when its card arrives ── */
  var hookCards = document.querySelectorAll('.hooked');
  if ('IntersectionObserver' in window) {
    var hookIO = new IntersectionObserver(function (es) { es.forEach(function (e) {
      if (e.intersectionRatio >= 0.55) e.target.classList.add('live');
      else if (e.intersectionRatio < 0.1) e.target.classList.remove('live');
    }); }, { threshold: [0, 0.1, 0.55] });
    hookCards.forEach(function (c) { hookIO.observe(c); });
  } else hookCards.forEach(function (c) { c.classList.add('live'); });

  /* Build Club: try to swallow the moon. It comes back. */
  document.querySelectorAll('.feast__moon').forEach(function (moon) {
    var bites = [], bitten = 0;
    var setBites = function () { var m = bites.join(','); moon.style.webkitMaskImage = m; moon.style.maskImage = m; };
    moon.addEventListener('click', function (e) {
      var r = moon.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top, R = r.width * 0.13;
      if (++bitten > 8) {
        bitten = 0; bites = []; setBites(); moon.classList.remove('back'); void moon.offsetWidth; moon.classList.add('back');
        return;
      }
      [[0, 0, 1], [-0.8, 0.5, 0.75], [0.8, 0.5, 0.75], [0, 1, 0.7]].forEach(function (b) {
        var rad = R * b[2]; bites.push('radial-gradient(circle at ' + (x + b[0] * R).toFixed(1) + 'px ' + (y + b[1] * R).toFixed(1) + 'px, transparent ' + rad.toFixed(1) + 'px, #000 ' + (rad + 1).toFixed(1) + 'px)');
      });
      setBites();
    });
  });

  /* ── The room: you stand inside a sphere of small photographs (20 Nov, second pass) ──
     Each row is a ring that turns at its own pace. Drag anywhere to spin the whole room. Point at a photo and it opens
     whole while its ring slows to a stop; on touch, tap to open and tap again or anywhere else to close.
     ?pipe on the address shows the same wall as the inside of a pipe, for comparison.
     A tile takes its photo the moment it slides into view, from the photos not already on screen (near-identical shots
     count as one), so the same photo is almost never seen twice at once. Rows keep the brand order: whole rooms on top,
     faces in the middle, people building below. */
  (function () {
    var wall = document.querySelector('.wall'); if (!wall) return;
    var room = wall.parentNode, pipe = /[?&]pipe\b/.test(location.search), lens = document.createElement('div'), lin = document.createElement('div'), limg = new Image();
    lens.className = 'lens'; lin.className = 'lens__in'; limg.alt = ''; lin.appendChild(limg); lens.appendChild(lin); room.appendChild(lens);
    wall.classList.add('in3d');
    var G = 4, P = 700, A = .15, T = 90, W = 0, H = 0, HV = .5, spin = 0, sv = 0, dragging = false, ready = false;
    var META = JSON.parse(wall.getAttribute('data-photos') || '{}'), IDS = Object.keys(META), used = {};
    var BIAS = { top: { R: 3, G: 3, F: 1, B: 1, D: .6 }, mid: { F: 3, B: 1.4, R: .7, G: .5, D: .8 }, low: { B: 2.4, D: 2, F: 1, R: .8, G: .5 } };
    function event(id) { return id.slice(0, 2) === 'jp' ? 'jaipur' : { h: 'aug9', g: 'bnb', n: 'nov15' }[id[0]] || 'site'; }
    function src(id) { return '/img/wall/t/' + id + '.webp'; }
    var rows = [].slice.call(wall.children).map(function (row, i, all) {
      [].slice.call(row.firstElementChild.children).forEach(function (im) { im.removeAttribute('data-src'); im.removeAttribute('src'); im.style.visibility = 'hidden'; });
      return { i: i, el: row, track: row.firstElementChild, tiles: [].slice.call(row.firstElementChild.children), lat: i - (all.length - 1) / 2, dir: i % 2 ? 1 : -1,
        sp: 0.018 + 0.012 * ((i * 4) % 7) / 6, x: (i * 137) % 400, s: 1, aim: 1, show: true };
    });
    /* Every tile image loads once the page itself is done, so a tile that changes photo changes at once */
    function feed() { ready = true; IDS.forEach(function (id) { new Image().src = src(id); }); rows.forEach(function (r) { r.tiles.forEach(function (im) { if (im._id && !im.getAttribute('src')) im.src = src(im._id); }); }); }
    function pick(r, k) {
      var n = r.tiles.length, nb = [r.tiles[(k + 1) % n]._id, r.tiles[(k + n - 1) % n]._id].filter(Boolean).map(event);
      var band = r.i < 3 ? 'top' : r.i < 6 ? 'mid' : 'low', best = null, bs = -1, spare = null, ss = 1e9;
      IDS.forEach(function (id) {
        var m = META[id], u = used[m[3]] || 0, sc = BIAS[band][m[1]] * m[2] * (.45 + Math.random()) * (nb.indexOf(event(id)) < 0 ? 1 : .3);
        if (!u) { if (sc > bs) { bs = sc; best = id; } } else if (u - sc / 100 < ss) { ss = u - sc / 100; spare = id; }
      });
      return best || spare;
    }
    function enter(r, k) {
      var im = r.tiles[k], id = pick(r, k), m = META[id]; im._id = id; used[m[3]] = (used[m[3]] || 0) + 1;
      im.setAttribute('data-id', id); im.setAttribute('data-r', m[0]); if (ready) im.src = src(id);
    }
    function leave(im) { if (im._id) used[META[im._id][3]]--; }
    if (document.readyState === 'complete') setTimeout(feed, 200); else addEventListener('load', function () { setTimeout(feed, 200); });

    /* The sphere's radius is half the wall's longer side, and the eye sits at its centre. A tile spans A radians. */
    function size() {
      W = wall.clientWidth; H = wall.clientHeight; P = Math.max(W, H) / 2; A = W < 700 ? .2 : .15; T = P * A - G; HV = Math.atan(W / 2 / P);
      wall.style.perspective = P.toFixed(1) + 'px'; room.style.setProperty('--t', T.toFixed(1) + 'px');
      var vmax = pipe ? H / 2 + T / 2 : Math.atan(H / 2 / P) + A / 2;
      rows.forEach(function (r) {
        r.phi = r.lat * A; r.y = r.lat * P * A; r.rc = P * (pipe ? 1 : Math.cos(r.phi)); r.L = r.tiles.length * P * A;
        r.vis = Math.min(HV + .75 * P * A / r.rc, 1.4); r.edge = pipe ? Math.max(Math.abs(r.y) - T / 2, 0) : P * Math.tan(Math.max(Math.abs(r.phi) - A / 2, 0));
        r.show = (pipe ? Math.abs(r.y) : Math.abs(r.phi)) < vmax; r.el.style.display = r.show ? '' : 'none';
        if (!r.show) r.tiles.forEach(function (im) { if (im._v) { leave(im); im._v = false; im.style.visibility = 'hidden'; } });
      });
    }
    function lay(r) {
      var loop = r.L / r.rc, half = loop / 2, tail = pipe ? 'translate3d(0,' + r.y.toFixed(1) + 'px,' + (-P).toFixed(1) + 'px)' : 'rotateX(' + r.phi.toFixed(4) + 'rad) translateZ(' + (-P).toFixed(1) + 'px)';
      for (var k = 0; k < r.tiles.length; k++) {
        var a = (r.x + k * P * A) / r.rc + spin; a = ((a + half) % loop + loop) % loop - half;
        var im = r.tiles[k], vis = Math.abs(a) < r.vis && r.edge < (H / 2 + 2) * Math.cos(a);
        if (vis !== !!im._v) { if (vis) enter(r, k); else leave(im); im.style.visibility = vis ? '' : 'hidden'; im._v = vis; }
        if (vis) im.style.transform = 'translateZ(' + P.toFixed(1) + 'px) rotateY(' + a.toFixed(4) + 'rad) ' + tail;
      }
    }
    function rowOf(img) { for (var k = 0; k < rows.length; k++) if (rows[k].track === img.parentNode) return rows[k]; }

    var open = null, on = false, last = 0, snap = false, L = { x: 0, y: 0, w: 0, h: 0 };
    function target(img) {
      var rb = room.getBoundingClientRect(), tb = img.getBoundingClientRect(), ar = +img.getAttribute('data-r') || 1;
      var big = Math.min(Math.max(T * 3.6, 230), 420, innerWidth * .78, rb.height * .7), w = ar >= 1 ? big : big * ar, h = ar >= 1 ? big / ar : big;
      var x = tb.left - rb.left + tb.width / 2 - w / 2, y = tb.top - rb.top + tb.height / 2 - h / 2;
      return { x: Math.min(Math.max(x, 8), rb.width - w - 8), y: Math.min(Math.max(y, 8), rb.height - h - 8), w: w, h: h };
    }
    function follow(dt) {
      var g = target(open.img), k = snap ? 1 : 1 - Math.exp(-dt / 70); snap = false;
      L.x += (g.x - L.x) * k; L.y += (g.y - L.y) * k; L.w += (g.w - L.w) * k; L.h += (g.h - L.h) * k;
      lens.style.transform = 'translate3d(' + L.x.toFixed(1) + 'px,' + L.y.toFixed(1) + 'px,0)'; lens.style.width = L.w.toFixed(1) + 'px'; lens.style.height = L.h.toFixed(1) + 'px';
    }
    function show(img) {
      if (open && open.img === img) return;
      var r = rowOf(img), was = open, u = '/img/wall/l/' + img.getAttribute('data-id') + '.webp';
      open = { img: img }; rows.forEach(function (q) { q.aim = q === r ? 0 : 1; });
      lin.style.backgroundImage = 'url("' + (img.currentSrc || img.src) + '")';
      if (limg.getAttribute('src') === u && limg.complete) limg.classList.add('in');
      else { limg.classList.remove('in'); limg.onload = function () { if (limg.getAttribute('src') === u) limg.classList.add('in'); }; limg.src = u; }
      if (!was) { snap = true; follow(16); lens.classList.remove('on'); void lens.offsetWidth; lens.classList.add('on'); room.classList.add('lit'); }
    }
    function hide() { if (!open) return; open = null; rows.forEach(function (q) { q.aim = 1; }); lens.classList.remove('on'); room.classList.remove('lit'); }

    function frame(t) {
      var dt = last ? Math.min(t - last, 48) : 16; last = t;
      if (!dragging) { if (Math.abs(sv) > 1e-6) { spin += sv * dt; sv *= Math.pow(0.995, dt); } else sv = 0; }
      rows.forEach(function (r) {
        if (!r.show) return;
        r.s += (r.aim - r.s) * (1 - Math.exp(-dt / 160));
        if (!calm) r.x = (r.x + r.dir * r.sp * r.s * dt) % r.L;
        lay(r);
      });
      if (open) follow(dt);
      if (on) requestAnimationFrame(frame); else last = 0;
    }

    /* Point, drag, tap */
    var down = false, sx = 0, lx = 0, lt = 0;
    wall.addEventListener('pointerover', function (e) { var img = e.pointerType === 'mouse' && !down && e.target.closest('img'); if (img) show(img); });
    wall.addEventListener('pointerleave', function (e) { if (e.pointerType === 'mouse' && !down) hide(); });
    document.addEventListener('pointerdown', function (e) { if (open && e.pointerType !== 'mouse' && !wall.contains(e.target)) hide(); }, true);
    wall.addEventListener('pointerdown', function (e) { down = true; dragging = false; sv = 0; sx = lx = e.clientX; lt = performance.now(); try { wall.setPointerCapture(e.pointerId); } catch (x) {} });
    wall.addEventListener('pointermove', function (e) {
      if (!down) return;
      if (!dragging && Math.abs(e.clientX - sx) > 6) { dragging = true; wall.classList.add('held'); hide(); }
      if (!dragging) return;
      var d = e.clientX - lx, n = performance.now(); spin -= d / P; sv = -d / P / Math.max(n - lt, 8); lx = e.clientX; lt = n;
    });
    wall.addEventListener('pointerup', function (e) {
      if (!down) return; down = false; wall.classList.remove('held');
      if (dragging) { dragging = false; if (performance.now() - lt > 80) sv = 0; return; }
      if (e.pointerType === 'mouse') return;
      var hit = document.elementFromPoint(e.clientX, e.clientY), img = hit && hit.closest && hit.closest('.wall img');
      if (img && !(open && open.img === img)) show(img); else hide();
    });
    wall.addEventListener('pointercancel', function () { down = false; dragging = false; wall.classList.remove('held'); });

    size(); rows.forEach(lay); addEventListener('resize', size);
    if ('IntersectionObserver' in window) new IntersectionObserver(function (es) { var was = on; on = es[0].isIntersecting; if (on && !was) requestAnimationFrame(frame); if (!on) hide(); }).observe(wall);
    else { on = true; requestAnimationFrame(frame); }
  })();

  /* ── The deck: each card slides up over the last; the one underneath settles back ── */
  var deck = document.querySelector('.deck'), xcards = [].slice.call(document.querySelectorAll('.xcard')), snaps = [], tabLinks = [].slice.call(document.querySelectorAll('.tabs a'));
  function natural(i) { var y = deck.getBoundingClientRect().top + scrollY + 14; for (var k = 0; k < i; k++) y += xcards[k].offsetHeight + 26; return y; }
  function placeSnaps() {
    if (!deck) return;
    var top0 = deck.getBoundingClientRect().top + scrollY;
    if (!snaps.length) xcards.forEach(function () { var s = document.createElement('span'); s.className = 'snap'; deck.appendChild(s); snaps.push(s); });
    xcards.forEach(function (c, i) { var st = parseFloat(getComputedStyle(c).top) || 0; snaps[i].style.top = (natural(i) - st - top0) + 'px'; });
  }
  function layoutDeck() {
    var H = innerHeight;
    xcards.forEach(function (c, i) {
      var next = xcards[i + 1], p = 0;
      if (next) { var r = next.getBoundingClientRect(), st = parseFloat(getComputedStyle(next).top) || 0; p = clamp(1 - (r.top - st) / (H - st), 0, 1); }
      c.style.transform = p > 0 ? 'scale(' + (1 - p * 0.05).toFixed(4) + ')' : '';
      c.style.setProperty('--dim', (p * 0.34).toFixed(3));
    });
    if (!deck) return;
    var cur = '', dr = deck.getBoundingClientRect();
    if (dr.bottom > H * 0.5) xcards.forEach(function (c) { if (c.dataset.tab && c.getBoundingClientRect().top < H * 0.5) cur = c.dataset.tab; });
    if (cur !== hereTab) { hereTab = cur; tabLinks.forEach(function (a) { a.classList.toggle('is-here', a.dataset.tab === cur); }); }
  }
  var hereTab = '';
  if (deck) { placeSnaps(); addEventListener('resize', placeSnaps); addEventListener('load', placeSnaps); }

  /* ── Why: elements go in, the flask fills, the stamp lands ── */
  var why = document.querySelector('.why'), whyWords = [], whyLine = null, level = null, whyStamp = null, drops = [];
  if (why) {
    var text = why.querySelector('.why__text');
    [].slice.call(text.childNodes).forEach(function (node) {
      var isEnd = node.nodeType === 1, frag = document.createDocumentFragment(), holder = frag;
      if (isEnd) { var line = document.createElement('strong'); line.className = 'endline'; frag.appendChild(line); holder = line; whyLine = line; }
      node.textContent.split(/(\s+)/).forEach(function (w) {
        if (!w) return;
        if (/^\s+$/.test(w)) { holder.appendChild(document.createTextNode(' ')); return; }
        var s = document.createElement('span'); s.textContent = w; holder.appendChild(s); whyWords.push(s);
      });
      text.replaceChild(frag, node);
    });
    level = why.querySelector('[data-level]'); whyStamp = why.querySelector('.stamp'); drops = [].slice.call(why.querySelectorAll('.drop'));
  }
  function layoutWhy() {
    if (!why) return;
    var r = why.getBoundingClientRect(), p = clamp(-r.top / (r.height - innerHeight), 0, 1);
    if (whyLine) whyLine.classList.toggle('on', p > 0.72);
    drops.forEach(function (d, i) {
      var a = 0.04 + i * 0.1, t = clamp((p - a) / 0.14, 0, 1), y = -260 + t * t * 430, s = 1 - t * 0.62;
      d.style.opacity = t <= 0 || t >= 1 ? 0 : 1;
      d.style.transform = 'translate(-50%,' + y.toFixed(1) + '%) rotate(' + ((i % 2 ? 1 : -1) * (60 * t + 10)).toFixed(1) + 'deg) scale(' + s.toFixed(3) + ')';
    });
    if (level) level.style.transform = 'translateY(' + (100 * (1 - clamp((p - 0.1) / 0.72, 0, 1))).toFixed(1) + '%)';
    if (whyStamp) {
      var landed = p > 0.9;
      if (landed && !whyStamp.classList.contains('on')) { whyStamp.classList.add('on'); }
      if (!landed) whyStamp.classList.remove('on');
    }
  }

  /* ── Tabs and cards go to a slide's real place, even when it is pinned ── */
  function realTop(el) { var i = xcards.indexOf(el); return natural(i) - (parseFloat(getComputedStyle(el).top) || 0); }
  function goTo(t) { scrollTo({ top: xcards.indexOf(t) >= 0 ? realTop(t) : t.getBoundingClientRect().top + scrollY - 12, behavior: calm ? 'auto' : 'smooth' }); }
  tabLinks.forEach(function (a) {
    var href = a.getAttribute('href');
    a.addEventListener('click', function (e) {
      if (e.metaKey || e.ctrlKey || e.shiftKey) return;
      var hash = href.indexOf('#'), same = hash === 0 || (hash > 0 && href.slice(0, hash) === location.pathname);
      if (same) { var t = document.querySelector(href.slice(hash)); if (t) { e.preventDefault(); goTo(t); } }
    });
  });
  addEventListener('load', function () { if (location.hash.length > 1) { var t = document.querySelector(location.hash); if (t && xcards.indexOf(t) >= 0) scrollTo(0, realTop(t)); } });

  /* The floating logo takes the colour that reads on whatever is under it */
  addEventListener('load', function () { logoTone(); setTimeout(logoTone, 400); }); addEventListener('pageshow', function () { logoTone(); });
  var flo = document.querySelector('.flogo'), toneAt = 0;
  function logoTone() {
    if (!flo) return;
    var r = flo.getBoundingClientRect(), under = document.elementsFromPoint(r.left + r.width / 2, r.top + r.height / 2), el = null;
    for (var i = 0; i < under.length; i++) { if (!flo.contains(under[i])) { el = under[i]; break; } }
    flo.toggleAttribute('data-primary', !!(el && el.closest('.hero')));
    while (el && el !== document.documentElement) {
      var b = getComputedStyle(el).backgroundColor, m = b.match(/[\d.]+/g);
      if (m && (m.length < 4 || +m[3] > 0.5)) {
        var lin = function (v) { v /= 255; return v <= 0.04 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
        flo.dataset.tone = 0.2126 * lin(+m[0]) + 0.7152 * lin(+m[1]) + 0.0722 * lin(+m[2]) > 0.4 ? 'light' : 'dark'; return;
      }
      el = el.parentElement;
    }
    flo.dataset.tone = 'dark';
  }

  /* ── One scroll loop ──────────────────────────────────── */
  var raf = 0;
  function frame() {
    raf = 0;
    layoutDeck(); layoutWhy(); logoTone();
  }
  function schedule() { if (!raf) raf = requestAnimationFrame(frame); }
  addEventListener('scroll', schedule, { passive: true }); addEventListener('resize', schedule); schedule();

  /* ── Dates come from the same files the forms read ───── */
  var IST = 5.5 * 36e5;
  function nice(iso, opts) { return new Date(iso + 'T06:00:00Z').toLocaleDateString('en-GB', Object.assign({ timeZone: 'Asia/Kolkata' }, opts)).replace(',', ''); }
  var NAMES = { content: 'Founder Content', gtm: 'Go-to-market', capital: 'Raising Capital', app: 'Vibe Coding an App' }, FC = '/practicals/founder-content/';
  try {
    var now = new Date(Date.now() + IST), day = now.getUTCDay(), first = day === 0 && now.getUTCHours() < 10 ? 0 : (7 - day) % 7 || 7, today = now.toISOString().slice(0, 10);
    var CITY = window.SMBC_CITY, PR = window.CHEM_PRACTICALS || [];
    var sundaysFrom = function (n) { var o = []; for (var w = 0; w < n; w++) o.push(new Date(now.getTime() + (first + w * 7) * 864e5).toISOString().slice(0, 10)); return o; };
    var citiesOn = function (d) { return ((CITY.cities ? CITY.cities(d) : [CITY.at(d)]) || []).filter(Boolean); };
    var clubs = CITY ? sundaysFrom(4).map(function (d) { return { d: d, name: citiesOn(d).join(' & '), href: '/apply/?to=club&date=' + d }; }).filter(function (x) { return x.name; }) : [];
    var nameOf = function (p) { return NAMES[p.id] || p.name; }, hrefOf = function (p) { return p.id === 'content' ? '/apply/?to=content&date=' + p.date : (p.href || '/practicals/'); };
    var pracs = PR.filter(function (p) { return p.date && p.date >= today; }).sort(function (a, b) { return a.date < b.date ? -1 : 1; }).map(function (p) { return { d: p.date, name: nameOf(p), href: hrefOf(p) }; });
    var soonCities = ['Mumbai', 'Surat', 'Jaipur'].filter(function (n) { return !clubs.some(function (x) { return x.name.indexOf(n) >= 0; }); });
    var pill = function (x) { var a = document.createElement('a'); a.className = 'dpill'; a.href = x.href; a.innerHTML = '<b></b><em></em>'; a.querySelector('b').textContent = x.name; a.querySelector('em').textContent = nice(x.d, { weekday: 'short', day: 'numeric', month: 'short' }); return a; };
    document.querySelectorAll('[data-pills]').forEach(function (box) {
      var kind = box.dataset.pills, list = kind === 'club' ? clubs.slice(0, 3) : kind === 'practical' ? pracs.slice(0, 3) : clubs.slice(0, 2).map(function (x) { return { d: x.d, name: 'Build Club \u00b7 ' + x.name, href: x.href }; }).concat(pracs.slice(0, 1)).sort(function (a, b) { return a.d < b.d ? -1 : 1; });
      if (!list.length && (!soonCities.length || kind === 'practical')) { box.remove(); return; }
      if (box.dataset.lead) { var l = document.createElement('span'); l.className = 'pills__lead'; l.textContent = box.dataset.lead; box.appendChild(l); }
      list.forEach(function (x) { box.appendChild(pill(x)); });
      if (soonCities.length && kind !== 'practical') { var sp = document.createElement('span'); sp.className = 'dpill dpill--soon'; sp.innerHTML = '<b></b><em>Coming soon</em>'; sp.querySelector('b').textContent = soonCities.join(', '); box.appendChild(sp); }
    });
    /* a workshop shows its date when it has one, otherwise "Announcing soon" */
    document.querySelectorAll('[data-work]').forEach(function (el) {
      var p = PR.filter(function (q) { return q.id === el.dataset.work; })[0], em = el.querySelector('em');
      if (p && p.date && p.date >= today) { em.textContent = nice(p.date, { weekday: 'short', day: 'numeric', month: 'short' }); if (p.id === 'content') el.href = FC; }
    });
    /* The calendar is a periodic table. It reads in date order, left to right, top to bottom */
    var cal = document.querySelector('[data-calendar]');
    if (cal && CITY) {
      var SYM = { Ahmedabad: 'Ah', Mumbai: 'Mu', Jaipur: 'Ja', Surat: 'Su', content: 'Fc', gtm: 'Gt', capital: 'Rc', app: 'Vb', pricing: 'Pr', hiring: 'Hi' };
      var COL = { club: ['var(--sun)', 'var(--ink)'], practical: ['var(--pink)', 'var(--ink)'], vc: ['var(--copper)', 'var(--ink)'], re: ['var(--sky)', 'var(--ink)'] };
      var POS = [[1, 1], [1, 2], [2, 2], [7, 2], [8, 2], [1, 3], [2, 3], [7, 3], [8, 3], [1, 4], [2, 4], [3, 4], [4, 4], [5, 4], [6, 4], [7, 4], [8, 4]];
      var els = [];
      sundaysFrom(13).forEach(function (d, w) { var cs = citiesOn(d); if (!cs.length && w < 4 && !CITY.closedAt(d)) { els.push({ d: d, kind: 'club', s: 'Bc', name: 'Build Club', sub: 'City soon, 10 AM', href: '/apply/?to=club&date=' + d }); return; } if (cs.length) els.push({ d: d, kind: 'club', s: SYM[cs[0]] || cs[0].slice(0, 2), name: 'Build Club', sub: cs.join(' & ') + ', 10 AM', href: '/apply/?to=club&date=' + d, first: cs[0] }); });
      PR.forEach(function (p) { if (p.date && p.date >= today) els.push({ d: p.date, kind: 'practical', s: SYM[p.id] || p.name.slice(0, 2), name: nameOf(p), sub: p.city + ', ' + p.time, href: hrefOf(p), first: p.city }); });
      for (var mo = 1; mo <= 3; mo++) { var md = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + mo, 1)).toISOString().slice(0, 10); els.push({ d: md, kind: 'vc', s: 'Vc', name: 'Venture Catalyst', sub: 'First week', href: '/venture-catalyst/', month: true, top: '1\u20137' }); }
      els.sort(function (a, b) { return a.d < b.d ? -1 : a.d > b.d ? 1 : 0; });
      var peek = document.querySelector('.peek'), PHOTO = { Ahmedabad: '/img/rooms/a24.webp', Mumbai: '/img/rooms/m38.webp', Jaipur: '/img/rooms/j21.webp', Surat: '/img/rooms/s7.webp' };
      var cell = function (x, i, box) {
        var a = document.createElement('a'); a.className = 'el'; a.href = x.href; a.dataset.kind = x.kind;
        var c = COL[x.kind]; a.style.setProperty('--c', c[0]); a.style.setProperty('--t', c[1]); a.style.setProperty('--n', i);
        a.innerHTML = '<span class="el__n"></span><span class="el__m"></span><b class="el__s"></b><span class="el__name"></span><span class="el__sub"></span>';
        a.querySelector('.el__n').textContent = x.d && !x.month ? String(+x.d.slice(8)) : x.top || '';
        a.querySelector('.el__m').textContent = x.d ? nice(x.d, { month: 'short' }) : '';
        a.querySelector('.el__s').textContent = x.s; a.querySelector('.el__name').textContent = x.name; a.querySelector('.el__sub').textContent = x.sub;
        if (peek && fine && x.first) {
          a.addEventListener('pointerenter', function () { peek.src = PHOTO[x.first] || PHOTO.Ahmedabad; peek.classList.add('on'); });
          a.addEventListener('pointerleave', function () { peek.classList.remove('on'); });
          a.addEventListener('pointermove', function (e) { peek.style.transform = 'translate3d(' + (e.clientX + 22) + 'px,' + (e.clientY - 90) + 'px,0) rotate(-3deg)'; });
        }
        box.appendChild(a); return a;
      };
      els.forEach(function (x, i) {
        var a = cell(x, i, cal), p = POS[i];
        if (p) { a.style.setProperty('--dc', p[0]); a.style.setProperty('--dr', p[1]); }
        if (i === 0) a.classList.add('el--first');
      });
      POS.slice(els.length).forEach(function (p) { var g = document.createElement('i'); g.className = 'el el--ghost'; g.style.setProperty('--dc', p[0]); g.style.setProperty('--dr', p[1]); cal.appendChild(g); });
      var re = cell({ kind: 're', s: 'Re', name: 'Reactions', sub: 'Members only', href: '/apply/?for=reactions', top: '' }, els.length, cal);
      re.classList.add('el--re'); re.style.setProperty('--dc', 8); re.style.setProperty('--dr', 1);
      var soon = document.querySelector('[data-soon]');
      if (soon) {
        ['content', 'gtm', 'capital', 'app'].forEach(function (id, i) {
          var p = PR.filter(function (q) { return q.id === id; })[0];
          if (p && p.date) return;
          cell({ kind: 'practical', s: SYM[id], name: NAMES[id], sub: 'Announcing soon', href: '/practicals/#' + id }, els.length + i, soon);
        });
        soonCities.forEach(function (n, i) { cell({ kind: 'club', s: SYM[n], name: 'Build Club', sub: n + ', coming soon', href: '/apply/?to=club&date=fluid' }, els.length + 6 + i, soon); });
      }
      document.querySelectorAll('[data-filter]').forEach(function (b) {
        b.addEventListener('click', function () {
          document.querySelectorAll('[data-filter]').forEach(function (x) { x.setAttribute('aria-pressed', String(x === b)); });
          
          document.querySelectorAll('.el').forEach(function (e) { e.classList.toggle('dim', b.dataset.filter !== 'all' && e.dataset.kind !== b.dataset.filter && e.dataset.kind !== 're'); });
        });
      });
    }
    if (window.requestAnimationFrame) requestAnimationFrame(function () { if (typeof measure === 'function' && hero) { measure(); kick(); } });
  } catch (e) { /* the page still reads without the dates */ }

  /* The slot machine: the same one as in the first sentence. Pull the lever and the names land in a new order, and on the third pull the second row is yours. On the page that doesn't exist it keeps landing on 4 0 4, until the third pull pays out */
  document.querySelectorAll('.machine').forEach(function (machine) {
    var reels = [].slice.call(machine.querySelectorAll('.reel')), lever = machine.querySelector('.machine__pull');
    var lost = machine.classList.contains('machine--lost'), lostBox = machine.closest('.lost'), lostSay = lostBox && lostBox.querySelector('[data-lost-say]'), lostLine = lostSay && lostSay.textContent;
    var rows = +machine.dataset.rows, wordRow = rows === 2 ? 0 : 1, spinning = false, pulls = 0, seen = false, inView = false;
    var WORDS = machine.dataset.words.split('|');
    var names = lost ? '4071348529'.split('').map(function (w) { return { word: w }; }) : reels.reduce(function (all, r) { return all.concat([].slice.call(r.querySelectorAll('img'))); }, []).map(function (i) { return { src: i.getAttribute('src'), alt: i.alt, k: i.style.getPropertyValue('--k'), pin: false }; });
    var slots = reels.length * rows;
    /* more names than windows: a random set of them fills the windows each deal */
    function fit(a, keep) { if (a.length <= slots) return a; var pinned = a.filter(function (n) { return n.pin; }), rest = shuffled(a.filter(function (n) { return !n.pin; })); var pick12 = pinned.concat(rest).slice(0, slots); return keep ? pick12 : shuffled(pick12); }
    function pick() { return names[Math.floor(Math.random() * names.length)]; }
    function shuffled(a) { a = a.slice(); for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)), t = a[i]; a[i] = a[j]; a[j] = t; } return a; }
    function deal(byHand, won) {
      if (lost) return reels.reduce(function (d, r, i) { return d.concat([pick(), { word: won ? '7' : WORDS[i] }, pick()]); }, []);
      var landing = fit(names, !(byHand || seen));
      return won ? landing.map(function (n, i) { return i % rows === wordRow ? { word: WORDS[(i - wordRow) / rows] } : n; }) : landing;
    }
    function cell(n, spare) {
      var c = document.createElement('div'); c.className = 'cell';
      if (n.word) { var b = document.createElement('b'); b.textContent = n.word; c.appendChild(b); return c; }
      var i = new Image(); i.src = n.src; i.alt = spare ? '' : n.alt; i.draggable = false; i.style.setProperty('--k', n.k); c.appendChild(i); return c;
    }
    function lay(strip, list) { strip.textContent = ''; list.forEach(function (n) { strip.appendChild(cell(n)); }); }
    function setP(p) { machine.style.setProperty('--p', p.toFixed(3)); machine.style.setProperty('--b', Math.sin(Math.PI * clamp(p, 0, 1)).toFixed(3)); }
    var leverAt = 0, leverRun = 0;
    function moveLever(to, ms, out, done) {
      var from = leverAt, t0 = performance.now(), run = ++leverRun;
      (function step(now) {
        if (run !== leverRun) return;
        var t = clamp((now - t0) / ms, 0, 1);
        leverAt = from + (to - from) * out(t); setP(leverAt);
        if (t < 1) requestAnimationFrame(step); else if (done) done();
      })(t0);
    }
    var inn = function (t) { return t * t; }, recoil = function (t) { return 1 - Math.pow(1 - t, 3) * Math.cos(t * 7); };
    function paid() {
      machine.classList.add('won'); setTimeout(function () { machine.classList.remove('won'); }, 2100);
      if (lostBox) { lostBox.classList.add('won'); lostSay.textContent = 'Jackpot. You win the home page.'; }
    }
    function spin(landing, won) {
      spinning = true; machine.classList.add('running');
      if (lostBox) { lostBox.classList.remove('won'); lostSay.textContent = lostLine; }
      var left = reels.length;
      reels.forEach(function (reel, i) {
        var strip = reel.querySelector('.reel__strip'), now = [].slice.call(strip.children), isLast = i === reels.length - 1, step = reels.length > 3 ? 0.55 : 1, spare = Math.round(8 + i * 5 * step) + (won && isLast ? 6 : 0);
        var top = document.createDocumentFragment();
        landing.slice(i * rows, i * rows + rows).forEach(function (n) { top.appendChild(cell(n)); });
        for (var k = 0; k < spare; k++) top.appendChild(cell(pick(), true));
        strip.insertBefore(top, strip.firstChild);
        var total = rows + spare + now.length, one = 100 / total, from = -(total - rows) * one, ms = 1050 + i * 420 * step + (won && isLast ? 620 : 0);
        reel.classList.add('fast');
        setTimeout(function () { reel.classList.remove('fast'); }, ms * 0.74);
        var a = strip.animate([
          { transform: 'translateY(' + from + '%)', easing: 'cubic-bezier(.4,0,.8,.6)' },
          { transform: 'translateY(' + (from - one * 0.22) + '%)', offset: 0.09, easing: 'cubic-bezier(.3,.62,.3,1)' },
          { transform: 'translateY(' + (one * 0.11) + '%)', offset: 0.93, easing: 'ease-out' },
          { transform: 'translateY(0%)' }
        ], { duration: ms, fill: 'none' });
        a.onfinish = function () {
          while (strip.children.length > rows) strip.removeChild(strip.lastChild);
          
          machine.animate([{ transform: 'translateY(0)' }, { transform: 'translateY(2px)' }, { transform: 'translateY(0)' }], { duration: 120, easing: 'ease-out' });
          if (--left === 0) { spinning = false; machine.classList.remove('running'); if (won) paid(); }
        };
      });
    }
    function pull(byHand) {
      if (spinning) return;
      if (byHand) pulls++;
      var won = lost && byHand && pulls % 3 === 0, landing = deal(byHand, won);
      seen = true;
      if (calm) {
        reels.forEach(function (r, i) { lay(r.querySelector('.reel__strip'), landing.slice(i * rows, i * rows + rows)); });
        if (lostBox) { lostBox.classList.toggle('won', won); lostSay.textContent = won ? 'Jackpot. You win the home page.' : lostLine; }
        return;
      }
      moveLever(1, 150 * (1 - leverAt) + 20, inn, function () {
        spin(landing, won);
        moveLever(0, 620, recoil);
      });
    }
    var start = null;
    lever.addEventListener('pointerdown', function (e) { if (spinning) return; start = { y: e.clientY, h: machine.offsetHeight * 0.42, moved: 0 }; leverRun++; try { lever.setPointerCapture(e.pointerId); } catch (x) {} });
    lever.addEventListener('pointermove', function (e) { if (!start) return; var dy = e.clientY - start.y; start.moved = Math.max(start.moved, Math.abs(dy)); leverAt = clamp(dy / start.h, 0, 1); setP(leverAt); });
    lever.addEventListener('pointerup', function () { if (!start) return; var s = start; start = null; if (s.moved < 8 || leverAt > 0.3) pull(true); else moveLever(0, 380, recoil); });
    lever.addEventListener('pointercancel', function () { start = null; moveLever(0, 300, ease); });
    lever.addEventListener('click', function (e) { if (e.detail === 0) pull(true); });
    if (fine) {
      lever.addEventListener('pointerenter', function () { if (!spinning && !start) moveLever(0.13, 260, ease); });
      lever.addEventListener('pointerleave', function () { if (!spinning && !start) moveLever(0, 320, ease); });
    }
    if (!calm && 'IntersectionObserver' in window) {
      new IntersectionObserver(function (es) {
        if (!es[0].isIntersecting) return;
        machine.querySelectorAll('img').forEach(function (i) { i.loading = 'eager'; });
      }, { rootMargin: '1200px 0px' }).observe(machine);
      if (!lost) { var order = fit(names); reels.forEach(function (r, i) { lay(r.querySelector('.reel__strip'), order.slice(i * rows, i * rows + rows)); }); }
      new IntersectionObserver(function (es) {
        inView = es[0].isIntersecting;
        if (inView && !seen) afterCurtain(function () { setTimeout(function () { if (inView && !seen) pull(false); }, 260); });
      }, { threshold: 0.55 }).observe(machine);
      /* Until someone pulls it, the lever keeps offering itself */
      setInterval(function () { if (inView && (lost ? !(lostBox.classList.contains('won')) : !pulls) && !spinning && !start && leverAt < 0.01 && seen) moveLever(0.2, 240, ease, function () { moveLever(0, 520, recoil); }); }, 3800);
    }
  });
})();

/* Who shows up: tap a block to see who is in it. The big numbers count up once. */
(function () {
  var tm = document.querySelector('.tm'); if (!tm) return;
  var tiles = [].slice.call(tm.querySelectorAll('.tm__t')), li = [].slice.call(document.querySelectorAll('.wall2 li')), more = document.querySelector('.wall2__more'), head = document.getElementById('w1b');
  var CAP = matchMedia('(max-width:640px)').matches ? 18 : 36, k = '', open = false;
  function draw() {
    tm.classList.toggle('picked', !!k);
    tiles.forEach(function (t) { t.setAttribute('aria-pressed', t.getAttribute('data-k') === k); });
    var n = 0, first = null;
    li.forEach(function (l) { var m = !k || l.getAttribute('data-k') === k; if (m) n++; l.hidden = !(m && (open || n <= CAP)); l.classList.remove('lead'); if (!l.hidden && !first) first = l; });
    if (first) first.classList.add('lead');
    more.hidden = open || n <= CAP;
  }
  tiles.forEach(function (t) { t.addEventListener('click', function () {
    var v = t.getAttribute('data-k'); k = k === v ? '' : v; open = false; draw();
    if (k && head.getBoundingClientRect().top > innerHeight * .7) head.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }); });
  more.addEventListener('click', function () { open = true; draw(); });
  draw();
})();
(function () {
  var els = [].slice.call(document.querySelectorAll('[data-count]'));
  if (!els.length || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  els.forEach(function (el) {
    var to = +el.getAttribute('data-count'), t0 = 0; el.textContent = '0';
    function step(t) { if (!t0) t0 = t; var p = Math.min(1, (t - t0) / 1100); el.textContent = Math.round(to * (1 - Math.pow(1 - p, 3))); if (p < 1) requestAnimationFrame(step); }
    setTimeout(function () { requestAnimationFrame(step); }, 900);
    setTimeout(function () { el.textContent = to; }, 3200);   /* a browser that stalls frames still ends on the real number */
  });
})();
