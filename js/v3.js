(function () {
  'use strict';
  var calm = matchMedia('(prefers-reduced-motion: reduce)').matches, fine = matchMedia('(pointer:fine)').matches;
  var clamp = function (v, a, b) { return Math.max(a, Math.min(b, v)); };
  var ease = function (t) { return 1 - Math.pow(1 - t, 3); };

  /* ── Sound: quiet, and only after a first touch ───────── */
  var audio = null, touched = false;
  function wake() { touched = true; if (!audio) { try { audio = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) {} } if (audio && audio.state === 'suspended') audio.resume(); }
  addEventListener('pointerdown', wake, { passive: true });
  function tick(freq, vol, dur) {
    if (!touched || !audio || calm) return;
    try {
      var o = audio.createOscillator(), g = audio.createGain(), t = audio.currentTime;
      o.type = 'triangle'; o.frequency.setValueAtTime(freq, t); o.frequency.exponentialRampToValueAtTime(freq * 0.55, t + dur);
      g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(g); g.connect(audio.destination); o.start(t); o.stop(t + dur);
    } catch (e) {}
  }
  function thud() { tick(150, 0.2, 0.16); setTimeout(function () { tick(90, 0.12, 0.12); }, 18); }

  /* ── Arrivals ─────────────────────────────────────────── */
  var io = 'IntersectionObserver' in window ? new IntersectionObserver(function (es) {
    es.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add('on'); io.unobserve(e.target); } });
  }, { rootMargin: '0px 0px -8% 0px' }) : null;
  document.querySelectorAll('[data-up],.float').forEach(function (el) { if (io && !calm) io.observe(el); else el.classList.add('on'); });


  /* ── Buttons click ───────────────────────────────────── */
  document.querySelectorAll('.btn').forEach(function (b) {
    b.addEventListener('pointerdown', function () { tick(520, 0.05, 0.07); });
  });

  /* ── Asking for an invite lands a stamp first ────────── */
  var STAMP = document.getElementById('stamp-tpl');
  document.querySelectorAll('[data-stamp]').forEach(function (a) {
    a.addEventListener('click', function (e) {
      if (calm || !STAMP || e.metaKey || e.ctrlKey || e.shiftKey) return;
      e.preventDefault();
      var s = document.createElement('div');
      s.className = 'clickstamp'; s.innerHTML = STAMP.innerHTML;
      s.style.left = (e.clientX || innerWidth / 2) + 'px'; s.style.top = (e.clientY || innerHeight / 2) + 'px';
      document.body.appendChild(s); thud();
      if (navigator.vibrate) navigator.vibrate(18);
      var href = a.getAttribute('href');
      setTimeout(function () { location.href = href; }, 430);
    });
  });

  /* ── The cursor says what it will do ─────────────────── */
  var sunny = document.querySelector('.sunny');
  if (sunny && fine && !calm) {
    var sx = -100, sy = -100, tx = -100, ty = -100;
    addEventListener('pointermove', function (e) {
      tx = e.clientX; ty = e.clientY;
      var t = e.target, d = t.closest && t.closest('[data-drag]'), l = t.closest && t.closest('a,button,summary,label,.tube');
      sunny.classList.toggle('big', !!d); sunny.classList.toggle('link', !d && !!l);
      sunny.textContent = d ? d.getAttribute('data-drag') : '';
    }, { passive: true });
    (function follow() {
      sx += (tx - sx) * 0.26; sy += (ty - sy) * 0.26;
      sunny.style.transform = 'translate3d(' + sx.toFixed(1) + 'px,' + sy.toFixed(1) + 'px,0)';
      requestAnimationFrame(follow);
    })();
  }

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
          if (a.vy > 3 && now - lastTick > 70) { tick(170 + Math.random() * 60, 0.05, 0.08); lastTick = now; }
          a.vy = -Math.abs(a.vy) * 0.42; a.vx *= 0.9; a.va = a.va * 0.7 + a.vx * 0.004;
        }
        /* it flies home on its own after a moment */
        if (now > a.home) a.loose = false;
      } else {
        a.vx = (a.vx + (a.sx - a.x) * 0.05) * 0.82; a.vy = (a.vy + (a.sy - a.y) * 0.05) * 0.82;
        a.va = (a.va + (a.rest - a.a) * 0.05) * 0.8;
        a.x += a.vx; a.y += a.vy; a.a += a.va;
        if (!a.landed && Math.abs(a.y - a.sy) < 10) { a.landed = true; if (now - lastTick > 60) { tick(240, 0.05, 0.08); lastTick = now; } }
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
          if (now - lastTick > 70) { spark(a.x + ux * a.r * 0.8, a.y + uy * a.r * 0.8); tick(320 + Math.random() * 300, 0.07, 0.07); lastTick = now; }
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
          document.querySelectorAll('.hint').forEach(function (h) { h.classList.add('gone'); });
          tick(420, 0.04, 0.05); kick();
        });
        b.el.addEventListener('pointermove', function (e) {
          if (!b.held) return;
          var r = hero.getBoundingClientRect(); b.hx = e.clientX - r.left; b.hy = e.clientY - r.top;
          if (Math.abs(e.clientX - sx0) + Math.abs(e.clientY - sy0) > 6) moved = true;
        });
        var drop = function (e) {
          if (!b.held) return;
          b.held = false; b.loose = true; b.home = performance.now() + 2200; b.el.classList.remove('held');
          if (!moved && e.type !== 'pointercancel') { b.vy = -15 - Math.random() * 4; b.vx = (Math.random() - 0.5) * 12; b.va = (Math.random() - 0.5) * 0.2; tick(620, 0.06, 0.09); if (navigator.vibrate) navigator.vibrate(8); }
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
    var left = els.length, began = false, go = function () { if (began) return; began = true; start(); };
    var one = function () { if (--left <= 0) go(); else if (began) { measure(); kick(); } };
    setTimeout(go, 2500);
    els.forEach(function (p) { if (p.complete && p.naturalWidth) one(); else { p.addEventListener('load', one); p.addEventListener('error', one); } });
  }

  /* ── The hooks: each card's object wakes when its card arrives ── */
  var hookCards = document.querySelectorAll('.hooked'), bike = document.querySelector('.ride');
  /* The scooter works like a pull-back toy: one loop moves it, so nothing jumps between pull, launch and return */
  var bx = 0, bv = 0, bTarget = 0, bMode = 'rest', bForce = 0, bRaf = 0, bLast = 0, bStart = 0;
  function bPaint() {
    var tilt = 0;
    if (bMode === 'pull') tilt = clamp(-bx * 0.008, 0, 1.6);
    if (bMode === 'launch') tilt = -bForce * 7 * Math.exp(-(bx - bStart) / 340);
    bike.style.transform = 'translate3d(' + bx.toFixed(1) + 'px,0,0) rotate(' + tilt.toFixed(2) + 'deg)';
  }
  function bStep(t) {
    var dt = bLast ? Math.min((t - bLast) / 16.67, 2.4) : 1; bLast = t;
    if (bMode === 'pull') { bx += (bTarget - bx) * (1 - Math.pow(0.68, dt)); }
    else if (bMode === 'launch') {
      var scale = innerWidth / 1280; bv += (0.5 + bForce * 2.5) * scale * dt; bx += bv * dt;
      if (bx > innerWidth * 1.15) { bx = -innerWidth * 1.05; bv = 0; bMode = 'return'; }
    } else if (bMode === 'return') {
      var k = 0.016, d = 2 * Math.sqrt(k); bv += (-k * bx - d * bv) * dt; bx += bv * dt;
      if (Math.abs(bx) < 0.3 && Math.abs(bv) < 0.04) { bx = 0; bv = 0; bMode = 'rest'; }
    }
    if (bMode === 'rest') { bike.style.transform = ''; bRaf = 0; bLast = 0; return; }
    bPaint(); bRaf = requestAnimationFrame(bStep);
  }
  function bRun() { if (!bRaf) { bLast = 0; bRaf = requestAnimationFrame(bStep); } }
  function rideIn() {
    if (!bike || calm) return;
    bx = -innerWidth * 1.05; bv = 0; bMode = 'return'; bPaint(); bRun();
  }
  if ('IntersectionObserver' in window) {
    var hookIO = new IntersectionObserver(function (es) { es.forEach(function (e) {
      if (e.intersectionRatio >= 0.55 && !e.target.classList.contains('live')) { e.target.classList.add('live'); if (e.target.querySelector('.ride')) rideIn(); }
      else if (e.intersectionRatio < 0.1) e.target.classList.remove('live');
    }); }, { threshold: [0, 0.1, 0.55] });
    hookCards.forEach(function (c) { hookIO.observe(c); });
  } else hookCards.forEach(function (c) { c.classList.add('live'); });
  if (bike) {
    var bHeld = false, bSx = 0, bTickAt = 0, maxPull = function () { return Math.min(280, innerWidth * 0.42); };
    bike.addEventListener('dragstart', function (e) { e.preventDefault(); });
    bike.addEventListener('pointerdown', function (e) {
      if (calm) return;
      bHeld = true; bSx = e.clientX + (-bx > 0 && bMode === 'pull' ? -bx : 0); bTarget = bx; bv = 0; bMode = 'pull'; bTickAt = 0; bike.style.cursor = 'grabbing'; bRun();
      try { bike.setPointerCapture(e.pointerId); } catch (x) {}
    });
    bike.addEventListener('pointermove', function (e) {
      if (!bHeld) return;
      var p = clamp(bSx - e.clientX, 0, maxPull()); bTarget = -p;
      if (p - bTickAt > 26) { bTickAt = p; tick(170 + p * 0.9, 0.025, 0.03); }
    });
    var bRelease = function () {
      if (!bHeld) return; bHeld = false; bike.style.cursor = '';
      var p = -bTarget;
      if (p < 12) { bv = 0; bMode = 'return'; bRun(); return; }
      bForce = clamp(p / maxPull(), 0.3, 1); bStart = bx; bv = 0; bMode = 'launch'; bRun();
      tick(120, 0.07, 0.16); setTimeout(function () { tick(190, 0.05, 0.2); }, 90);
    };
    bike.addEventListener('pointerup', bRelease); bike.addEventListener('pointercancel', bRelease);
  }

  /* Build Club: try to swallow the moon. It comes back. */
  document.querySelectorAll('.feast__moon').forEach(function (moon) {
    var bites = [], bitten = 0;
    var setBites = function () { var m = bites.join(','); moon.style.webkitMaskImage = m; moon.style.maskImage = m; };
    moon.addEventListener('click', function (e) {
      var r = moon.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top, R = r.width * 0.13;
      if (++bitten > 8) {
        bitten = 0; bites = []; setBites(); moon.classList.remove('back'); void moon.offsetWidth; moon.classList.add('back');
        tick(300, 0.05, 0.1); return;
      }
      [[0, 0, 1], [-0.8, 0.5, 0.75], [0.8, 0.5, 0.75], [0, 1, 0.7]].forEach(function (b) {
        var rad = R * b[2]; bites.push('radial-gradient(circle at ' + (x + b[0] * R).toFixed(1) + 'px ' + (y + b[1] * R).toFixed(1) + 'px, transparent ' + rad.toFixed(1) + 'px, #000 ' + (rad + 1).toFixed(1) + 'px)');
      });
      setBites(); tick(190 + Math.random() * 60, 0.08, 0.06); setTimeout(function () { tick(140, 0.06, 0.05); }, 70);
    });
  });

  /* Reactions: popcorn pops, the glove punches, the dice roll, the ball lights the room */
  function restart(el, k, ms) { el.classList.remove(k); void el.offsetWidth; el.classList.add(k); setTimeout(function () { el.classList.remove(k); }, ms); }
  document.querySelectorAll('[data-fx]').forEach(function (f) {
    var img = f.querySelector('img');
    f.addEventListener('click', function () {
      var fx = f.dataset.fx, card = f.closest('.xcard');
      if (fx === 'pop') {
        for (var i = 0; i < 14; i++) (function (i) { setTimeout(function () {
          var k = document.createElement('img'); k.className = 'kern'; k.src = '/img/things/kernel.webp'; k.alt = '';
          k.style.setProperty('--dx', (Math.random() * 180 - 90).toFixed(0) + 'px'); k.style.setProperty('--up', (-50 - Math.random() * 110).toFixed(0) + 'px'); k.style.setProperty('--rot', (Math.random() * 360 - 180).toFixed(0) + 'deg');
          f.appendChild(k); tick(700 + Math.random() * 500, 0.05, 0.03); setTimeout(function () { k.remove(); }, 950);
        }, i * 42); })(i);
      } else if (fx === 'punch') {
        restart(img, 'is-punch', 450); setTimeout(function () { thud(); if (card) restart(card, 'jolt', 300); }, 170);
      } else if (fx === 'roll') {
        restart(img, 'is-roll', 900); [0, 110, 240, 390, 560, 700].forEach(function (d) { setTimeout(function () { tick(420 + Math.random() * 300, 0.06, 0.04); }, d); });
      } else if (fx === 'party') {
        restart(img, 'is-spin', 3600); if (card) restart(card, 'party', 3600); [0, 160, 320, 480].forEach(function (d, n) { setTimeout(function () { tick(520 + n * 130, 0.05, 0.14); }, d); });
      }
    });
  });

  /* Tap an object and it answers */
  document.querySelectorAll('[data-tap]').forEach(function (el) {
    el.addEventListener('click', function () {
      var k = el.dataset.tap; el.classList.remove(k); void el.offsetWidth; el.classList.add(k);
      (k === 'is-ring' ? [0, 110, 220, 330, 440] : [0]).forEach(function (d) { setTimeout(function () { tick(k === 'is-ring' ? 1350 : 520, 0.04, 0.07); }, d); });
      setTimeout(function () { el.classList.remove(k); }, 700);
    });
  });

  /* Venture Catalyst: tap the cooker and it whistles. The ask: the phone rings. */
  var rotary = document.querySelector('.ask__env');
  document.querySelectorAll('.steam').forEach(function (cooker) { cooker.addEventListener('click', function () {
    cooker.classList.remove('blow'); void cooker.offsetWidth; cooker.classList.add('blow');
    tick(1750, 0.03, 0.5); setTimeout(function () { cooker.classList.remove('blow'); }, 1000);
  }); });
  if (rotary) rotary.addEventListener('click', function () { [0, 130, 420, 550].forEach(function (d) { setTimeout(function () { tick(1250, 0.035, 0.1); }, d); }); });

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
    var count = Math.floor(clamp(p / 0.86, 0, 1) * whyWords.length);
    whyWords.forEach(function (w, i) { w.classList.toggle('on', i < count); });
    if (whyLine) whyLine.classList.toggle('on', p > 0.72);
    drops.forEach(function (d, i) {
      var a = 0.04 + i * 0.1, t = clamp((p - a) / 0.14, 0, 1), y = -260 + t * t * 430, s = 1 - t * 0.62;
      d.style.opacity = t <= 0 || t >= 1 ? 0 : 1;
      d.style.transform = 'translate(-50%,' + y.toFixed(1) + '%) rotate(' + ((i % 2 ? 1 : -1) * (60 * t + 10)).toFixed(1) + 'deg) scale(' + s.toFixed(3) + ')';
    });
    if (level) level.style.transform = 'translateY(' + (100 * (1 - clamp((p - 0.1) / 0.72, 0, 1))).toFixed(1) + '%)';
    if (whyStamp) {
      var landed = p > 0.9;
      if (landed && !whyStamp.classList.contains('on')) { whyStamp.classList.add('on'); thud(); if (navigator.vibrate) navigator.vibrate(18); }
      if (!landed) whyStamp.classList.remove('on');
    }
  }

  /* ── The room: prints dealt by scroll, and you can move them ── */
  var table = document.querySelector('.table'), prints = [], tableShown = calm ? 1 : 0, tableZ = 10;
  function loadPrints() { document.querySelectorAll('img[data-src]').forEach(function (i) { i.src = i.getAttribute('data-src'); i.removeAttribute('data-src'); }); }
  if (document.readyState === 'complete') setTimeout(loadPrints, 300); else addEventListener('load', function () { setTimeout(loadPrints, 300); });
  function layoutTable() {
    if (!table) return;
    var W = innerWidth, H = innerHeight, n = prints.length;
    prints.forEach(function (p) {
      var el = p.el, w = el.offsetWidth, h = el.offsetHeight, start = p.i / n * 0.84, t = clamp((tableShown - start) / 0.18, 0, 1), e = ease(t);
      var fx = p.from === 0 ? -w * 1.4 : p.from === 1 ? W + w * 0.4 : p.tx * W - w / 2, fy = p.from === 2 ? H + h * 0.4 : H * 0.2 + p.i * 30;
      var x = fx + (p.tx * W - w / 2 - fx) * e + p.dx, y = fy + (p.ty * H - h / 2 - fy) * e + p.dy, r = p.rot + p.spin * (1 - e);
      if (t > 0.98 && !p.seen) { p.seen = true; tick(210, 0.035, 0.07); }
      if (t < 0.5) p.seen = false;
      el.style.transform = 'translate3d(' + x.toFixed(1) + 'px,' + y.toFixed(1) + 'px,0) rotate(' + r.toFixed(2) + 'deg)';
      el.style.visibility = t <= 0 ? 'hidden' : 'visible';
    });
  }
  if (table) {
    var small = innerWidth < 760;
    if (small) table.querySelectorAll('.print[data-desk]').forEach(function (e) { e.remove(); });
    prints = [].slice.call(table.querySelectorAll('.print')).map(function (el, i) {
      var p = { el: el, i: i, dx: 0, dy: 0, vx: 0, vy: 0, held: false, spin: (i % 2 ? 1 : -1) * (24 + i * 5), rot: parseFloat(el.dataset.r) || 0, tx: parseFloat(small ? el.dataset.mx : el.dataset.x), ty: parseFloat(small ? el.dataset.my : el.dataset.y), from: i % 3, seen: false };
      el.addEventListener('dragstart', function (e) { e.preventDefault(); });
      var sx0, sy0, ox, oy, lx, ly;
      el.addEventListener('pointerdown', function (e) { p.held = true; sx0 = e.clientX; sy0 = e.clientY; ox = p.dx; oy = p.dy; lx = e.clientX; ly = e.clientY; el.classList.add('held'); el.style.zIndex = ++tableZ; try { el.setPointerCapture(e.pointerId); } catch (x) {} tick(420, 0.04, 0.06); });
      el.addEventListener('pointermove', function (e) { if (!p.held) return; p.dx = ox + e.clientX - sx0; p.dy = oy + e.clientY - sy0; p.vx = e.clientX - lx; p.vy = e.clientY - ly; lx = e.clientX; ly = e.clientY; layoutTable(); });
      var up = function () {
        if (!p.held) return; p.held = false; el.classList.remove('held'); tick(240, 0.05, 0.08);
        (function coast() { if (p.held || Math.abs(p.vx) + Math.abs(p.vy) < 0.2) return; p.dx += p.vx; p.dy += p.vy; p.vx *= 0.9; p.vy *= 0.9; layoutTable(); requestAnimationFrame(coast); })();
      };
      el.addEventListener('pointerup', up); el.addEventListener('pointercancel', up);
      return p;
    });
  }

  /* ── Tabs and cards go to a slide's real place, even when it is pinned ── */
  function realTop(el) { var i = xcards.indexOf(el); return natural(i) - (parseFloat(getComputedStyle(el).top) || 0); }
  function goTo(t) { scrollTo({ top: xcards.indexOf(t) >= 0 ? realTop(t) : t.getBoundingClientRect().top + scrollY - 12, behavior: calm ? 'auto' : 'smooth' }); }
  tabLinks.forEach(function (a, i) {
    var href = a.getAttribute('href');
    a.addEventListener('pointerenter', function () { tick(520 + i * 90, 0.03, 0.05); });
    a.addEventListener('click', function (e) {
      if (e.metaKey || e.ctrlKey || e.shiftKey) return;
      var hash = href.indexOf('#'), same = hash === 0 || (hash > 0 && href.slice(0, hash) === location.pathname);
      if (same) { var t = document.querySelector(href.slice(hash)); if (t) { e.preventDefault(); tick(460, 0.05, 0.06); goTo(t); } return; }
      if (calm) return;
      e.preventDefault(); tick(300, 0.06, 0.12);
      var r = a.getBoundingClientRect(), w = document.createElement('div'); w.className = 'wipe';
      w.style.background = getComputedStyle(a).getPropertyValue('--c'); w.style.setProperty('--x', (r.left + r.width / 2) + 'px'); w.style.setProperty('--y', r.top + 'px');
      document.body.appendChild(w); setTimeout(function () { location.href = href; }, 380);
    });
  });
  addEventListener('pageshow', function () { document.querySelectorAll('.wipe').forEach(function (w) { w.remove(); }); });
  addEventListener('load', function () { if (location.hash.length > 1) { var t = document.querySelector(location.hash); if (t && xcards.indexOf(t) >= 0) scrollTo(0, realTop(t)); } });

  /* The floating logo takes the colour that reads on whatever is under it */
  addEventListener('load', function () { logoTone(); setTimeout(logoTone, 400); }); addEventListener('pageshow', function () { logoTone(); });
  var flo = document.querySelector('.flogo'), toneAt = 0;
  function logoTone() {
    if (!flo) return;
    var r = flo.getBoundingClientRect(), under = document.elementsFromPoint(r.left + r.width / 2, r.top + r.height / 2), el = null;
    for (var i = 0; i < under.length; i++) { if (!flo.contains(under[i])) { el = under[i]; break; } }
    flo.toggleAttribute('data-primary', !!(el && el.closest('.hero')));
    var pr = el && el.closest('.print'), ph = pr && pr.querySelector('img'), pq = ph && ph.getBoundingClientRect(), fx = r.left + r.width / 2, fy = r.top + r.height / 2;
    if (pq && fx > pq.left && fx < pq.right && fy > pq.top && fy < pq.bottom) { flo.dataset.tone = 'dark'; return; }
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
    if (table) {
      var r = table.getBoundingClientRect(), tp = clamp(-r.top / (r.height - innerHeight), 0, 1);
      tableShown += (tp - tableShown) * 0.2; layoutTable();
      if (Math.abs(tp - tableShown) > 0.001) schedule();
    }
    layoutDeck(); layoutWhy(); logoTone();
  }
  function schedule() { if (!raf) raf = requestAnimationFrame(frame); }
  addEventListener('scroll', function () { schedule(); if (sunny) { sunny.classList.remove('big'); sunny.textContent = ''; } }, { passive: true }); addEventListener('resize', schedule); schedule();
  if (!fine) document.querySelectorAll('.hint').forEach(function (h) { h.textContent = 'Tap on an object.'; });

  /* ── Dates come from the same files the forms read ───── */
  var IST = 5.5 * 36e5;
  function nice(iso, opts) { return new Date(iso + 'T06:00:00Z').toLocaleDateString('en-GB', Object.assign({ timeZone: 'Asia/Kolkata' }, opts)).replace(',', ''); }
  var NAMES = { content: 'Founder Content', gtm: 'GTM', capital: 'Raising Capital', app: 'Vibe Coding an App' }, FC = '/practicals/founder-content/';
  try {
    var now = new Date(Date.now() + IST), day = now.getUTCDay(), first = day === 0 && now.getUTCHours() < 10 ? 0 : (7 - day) % 7 || 7, today = now.toISOString().slice(0, 10);
    var CITY = window.SMBC_CITY, PR = window.CHEM_PRACTICALS || [];
    var sundaysFrom = function (n) { var o = []; for (var w = 0; w < n; w++) o.push(new Date(now.getTime() + (first + w * 7) * 864e5).toISOString().slice(0, 10)); return o; };
    var citiesOn = function (d) { return ((CITY.cities ? CITY.cities(d) : [CITY.at(d)]) || []).filter(Boolean); };
    var clubs = CITY ? sundaysFrom(4).map(function (d) { return { d: d, name: citiesOn(d).join(' & '), href: '/build-club/#apply' }; }).filter(function (x) { return x.name; }) : [];
    var nameOf = function (p) { return NAMES[p.id] || p.name; }, hrefOf = function (p) { return p.id === 'content' ? FC + '#apply' : (p.href || '/practicals/'); };
    var pracs = PR.filter(function (p) { return p.date && p.date >= today; }).sort(function (a, b) { return a.date < b.date ? -1 : 1; }).map(function (p) { return { d: p.date, name: nameOf(p), href: hrefOf(p) }; });
    var soonCities = ['Mumbai', 'Surat', 'Jaipur'].filter(function (n) { return !clubs.some(function (x) { return x.name.indexOf(n) >= 0; }); });
    var pill = function (x) { var a = document.createElement('a'); a.className = 'dpill'; a.href = x.href; a.innerHTML = '<b></b><em></em>'; a.querySelector('b').textContent = x.name; a.querySelector('em').textContent = nice(x.d, { weekday: 'short', day: 'numeric', month: 'short' }); return a; };
    document.querySelectorAll('[data-pills]').forEach(function (box) {
      var kind = box.dataset.pills, list = kind === 'club' ? clubs.slice(0, 3) : clubs.slice(0, 2).concat(pracs.slice(0, 1)).sort(function (a, b) { return a.d < b.d ? -1 : 1; });
      if (!list.length && !soonCities.length) { box.remove(); return; }
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
      var COL = { club: ['var(--sun)', 'var(--ink)'], practical: ['var(--pink)', 'var(--ink)'], vc: ['var(--copper)', 'var(--paper)'], re: ['var(--sky)', 'var(--ink)'] };
      var POS = [[1, 1], [1, 2], [2, 2], [7, 2], [8, 2], [1, 3], [2, 3], [7, 3], [8, 3], [1, 4], [2, 4], [3, 4], [4, 4], [5, 4], [6, 4], [7, 4], [8, 4]];
      var els = [];
      sundaysFrom(13).forEach(function (d) { var cs = citiesOn(d); if (cs.length) els.push({ d: d, kind: 'club', s: SYM[cs[0]] || cs[0].slice(0, 2), name: 'Build Club', sub: cs.join(' & ') + ', 10 AM', href: '/build-club/#apply', first: cs[0] }); });
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
      var re = cell({ kind: 're', s: 'Re', name: 'Reactions', sub: 'Invite only', href: '/#reactions', top: '' }, els.length, cal);
      re.classList.add('el--re'); re.style.setProperty('--dc', 8); re.style.setProperty('--dr', 1);
      var soon = document.querySelector('[data-soon]');
      if (soon) {
        ['content', 'gtm', 'capital', 'app'].forEach(function (id, i) {
          var p = PR.filter(function (q) { return q.id === id; })[0];
          if (p && p.date) return;
          cell({ kind: 'practical', s: SYM[id], name: NAMES[id], sub: 'Announcing soon', href: '/practicals/#' + id }, els.length + i, soon);
        });
        soonCities.forEach(function (n, i) { cell({ kind: 'club', s: SYM[n], name: 'Build Club', sub: n + ', coming soon', href: '/build-club/' }, els.length + 6 + i, soon); });
      }
      document.querySelectorAll('[data-filter]').forEach(function (b) {
        b.addEventListener('click', function () {
          document.querySelectorAll('[data-filter]').forEach(function (x) { x.setAttribute('aria-pressed', String(x === b)); });
          tick(480, 0.04, 0.06);
          document.querySelectorAll('.el').forEach(function (e) { e.classList.toggle('dim', b.dataset.filter !== 'all' && e.dataset.kind !== b.dataset.filter && e.dataset.kind !== 're'); });
        });
      });
    }
    if (window.requestAnimationFrame) requestAnimationFrame(function () { if (typeof measure === 'function' && hero) { measure(); kick(); } });
  } catch (e) { /* the page still reads without the dates */ }
  /* a choice and a tick make a small noise too */
  document.querySelectorAll('.pick input,.check input').forEach(function (i) { i.addEventListener('change', function () { tick(i.type === 'checkbox' ? 660 : 500, 0.05, 0.07); }); });
})();
