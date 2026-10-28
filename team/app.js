/* The screen draws what the server sends and nothing else. Every number
   arrives already computed; the only arithmetic here is how full a beaker is. */

const $ = (s, r = document) => r.querySelector(s);
const app = $("#app");
const KEY = "hub.key";
const store = {
  get: () => { try { return localStorage.getItem(KEY) || ""; } catch { return ""; } },
  set: (v) => { try { v ? localStorage.setItem(KEY, v) : localStorage.removeItem(KEY); } catch {} },
};
const motion = !matchMedia("(prefers-reduced-motion: reduce)").matches;
let D = null, firstPaint = true;

const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const int = (n) => Math.round(Number(n) || 0).toLocaleString("en-IN");
const rupees = (n) => "₹" + int(n);
const WD = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"], MO = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const day = (d) => { const t = new Date(d + "T00:00:00Z"); return `${WD[t.getUTCDay()]} ${t.getUTCDate()} ${MO[t.getUTCMonth()]}`; };
const ICON = { Founder: "🎯", WhatsApp: "💬", Practicals: "🧪", "Fashion accelerator": "👗", "Social media": "📸", "Creative communication": "🎨" };
const iconOf = (title) => ICON[title] || "🎯";

/* On chemistrylabs.in/team the page is static and the hub runs on Cloudflare. */
const API = /(^|\.)chemistrylabs\.in$/.test(location.hostname) ? "https://team-hub.manavjoshi01.workers.dev" : "";
async function api(path, body) {
  const r = await fetch(API + path, { method: body ? "POST" : "GET", headers: { "content-type": "application/json", "x-key": store.get() },
    body: body ? JSON.stringify(body) : undefined });
  const j = await r.json().catch(() => ({}));
  if (r.status === 401 && path !== "/api/login") { store.set(""); login(); throw new Error("signed out"); }
  if (!r.ok) throw new Error(j.error || "Something went wrong.");
  return j;
}

/* ── sign in ── */
function login(msg = "") {
  app.innerHTML = `<div class="wall"></div><div class="screen"><form class="login" id="login">
    <h1 class="lockup"><span>chemistry</span><span>labs<i>.</i></span></h1>
    <p>Sign in with your CRM account.</p>
    <label class="f"><span>Handle</span><input name="handle" autocomplete="username" autocapitalize="none" required></label>
    <label class="f"><span>Password</span><input name="pw" type="password" autocomplete="current-password" required></label>
    <p class="err">${esc(msg)}</p><button class="btn green" type="submit">Sign in</button></form></div>`;
  $("#login").onsubmit = async (e) => {
    e.preventDefault();
    const f = new FormData(e.target);
    try { const { key } = await api("/api/login", { handle: f.get("handle"), pw: f.get("pw") }); store.set(key); firstPaint = true; load(); }
    catch (err) { login(err.message); }
  };
}

/* ── tiles ─────────────────────────────────────────────────────────────── */

/* The beaker. Solid green is what's done or paid for, the hatched band above
   it is what the invites out will probably add, the dashed line is the
   target, and the notch on the left is where today's pace says it should be. */
function beaker({ open, icon, label, value, money, sub, done, likely = 0, target, idle, pct }) {
  const forecast = done + likely;
  /* The target sits at 68% of the glass, so the line never crosses the label
     at the top; a number past its target keeps rising, up to 82%. */
  const top = Math.max(target || 0, 1), scale = target ? 68 : pct ? 75 : 60;
  const ref = pct ? 100 : target ? top : Math.max(forecast, 1);
  const pc = (v) => `${Math.min(82, (v / ref) * scale).toFixed(1)}%`;
  const m = D.month;
  const won = target && done >= target;
  return `<button class="tile w2 h2 beaker ${won ? "won" : ""} ${idle ? "idle" : ""}" data-open="${open}">
    <div class="liquid"><div class="ghost" style="--ghost:${idle ? "0%" : pc(forecast)}"></div><div class="fill" style="--fill:${idle ? "0%" : pc(done)}"></div></div>
    ${target ? `<i class="goal" style="--at:${pc(target)}"><span>${money ? rupees(target) : int(target)}</span></i><i class="pace" style="--pace:${pc((target * m.elapsed) / m.days)}"></i>` : ""}
    <span class="t-label"><em>${icon}</em>${esc(label)}</span>
    <span class="spacer"></span>
    <span class="t-big ${money ? "money" : ""}"><span ${value != null ? `data-count="${value}" data-fmt="${money ? "money" : "int"}"` : ""}>${value == null ? "—" : money ? rupees(value) : int(value)}</span>${pct && value != null ? "%" : ""}</span>
    <span class="t-sub">${sub}</span></button>`;
}

function verdictOf(c, money) {
  const f = money ? rupees(c.forecast) : int(c.forecast);
  if (!c.target) return `heading for ${f}`;
  const gap = Math.round(c.forecast - c.target);
  return gap >= 0 ? `of ${money ? rupees(c.target) : int(c.target)} · on target` : `of ${money ? rupees(c.target) : int(c.target)} · ${money ? rupees(-gap) : int(-gap)} short`;
}

const peopleTile = () => {
  const c = D.chase.people;
  return beaker({ open: "people", icon: "👥", label: "People in rooms", value: c.done, done: c.done + c.booked, likely: c.likely, target: c.target, sub: verdictOf(c) });
};
const revenueTile = () => {
  const c = D.chase.revenue;
  return beaker({ open: "revenue", icon: "💰", label: "Revenue", money: true, value: c.done, done: c.done, likely: c.likely, target: c.target, sub: verdictOf(c, true) });
};

function mineTile() {
  const m = D.mine; if (!m) return "";
  const icon = iconOf(D.me.title);
  if (m.value == null) return beaker({ open: "mine", icon, label: m.label, value: null, done: 0, idle: true, sub: esc(m.empty || "") });
  if (m.unit === "steps") return `<button class="tile w2 h2" data-open="mine"><span class="t-label"><em>${icon}</em>${esc(m.label)}</span><span class="spacer"></span>
    <span style="align-self:center">${ring(m.value, m.target, `${m.value}/${m.target}`, true)}</span><span class="spacer"></span>
    <span class="t-sub">${m.empty ? esc(m.empty) : `${m.target - m.value} to go`}</span></button>`;
  if (m.unit === "%") return beaker({ open: "mine", icon, label: m.label, value: m.value, pct: true, done: m.value, target: m.target,
    sub: esc(m.breakdown?.[0] || "") });
  return beaker({ open: "mine", icon, label: m.label, value: m.value, done: m.value, likely: Math.max(0, (m.forecast ?? m.value) - m.value),
    target: m.target, sub: m.target ? `of ${int(m.target)}` : m.money != null ? `${rupees(m.money)} from your work` : esc(m.breakdown?.[0] || "") });
}

function ring(value, of, text, big = false, on = false, badge = false) {
  const r = 26, c = 2 * Math.PI * r, k = of ? Math.min(1, value / of) : 0;
  return `<span class="ring ${on ? "on" : ""}" ${big ? 'style="width:calc(var(--u) * 1.05);height:calc(var(--u) * 1.05);font-size:21px"' : ""}>
    <svg viewBox="0 0 60 60"><circle class="bg" cx="30" cy="30" r="${r}"/><circle class="fg" cx="30" cy="30" r="${r}" stroke-dasharray="${c.toFixed(1)}" stroke-dashoffset="${(c * (1 - k)).toFixed(1)}"/></svg>
    ${esc(text)}${badge ? '<i class="badge"></i>' : ""}</span>`;
}

function alarmTile() {
  const w = D.warning;
  if (!w) return `<button class="tile w4 alarm calm" data-open="next"><span>✨</span><p>Nothing is slipping. Every room is on course.</p></button>`;
  return `<button class="tile w4 alarm" data-open="next"><i class="dot live"></i><p>${esc(w.text)}</p></button>`;
}

function teamTile() {
  const t = (D.team || []).slice(0, 8), wide = t.length > 4;
  return `<button class="tile ${wide ? "w4" : "w2"} h2 cluster" data-open="team" aria-label="Team" ${wide ? 'style="grid-template-columns:repeat(4,1fr)"' : ""}>${t.map((p) => {
    const ahead = ["ahead", "on track", "done"].includes(p.status), bad = ["behind", "stuck"].includes(p.status);
    const initials = p.name.split(/\s*\+\s*/).map((x) => x[0]).join("");
    return `<span class="person ${p.value == null ? "dim" : ""}">${ring(p.value || 0, p.target, initials, false, ahead, bad)}<small>${esc(p.name)}</small></span>`;
  }).join("")}</button>`;
}

function projectsTile() {
  const ps = D.projects || [];
  const live = ps.filter((p) => p.status === "live").length, waiting = ps.filter((p) => p.status === "proposed").length;
  const stuck = ps.filter((p) => p.risk === "stuck").length;
  return `<button class="tile w2 h2" data-open="projects"><span class="t-label"><em>🗂️</em>Projects</span><span class="spacer"></span>
    <span class="t-big">${live}</span><span class="t-sub">live${stuck ? ` · ${stuck} stuck` : ""}</span>
    ${waiting ? `<span class="badge-txt" style="margin-top:8px">${waiting} waiting for you</span>` : ""}
    <div class="pips">${ps.flatMap((p) => p.steps.map((s) => `<i class="${s.done ? "d" : s.late ? "l" : ""}"></i>`)).slice(0, 24).join("")}</div></button>`;
}

function stepsTile(wide) {
  const s = D.steps, late = s.filter((x) => x.late).length;
  const note = late ? `<span style="color:#f5a59c">${late} late</span>` : s.length ? esc(s[0].title) : wide ? "nothing waiting" : "steps";
  return `<button class="tile ${wide ? "w2" : ""}" data-open="steps"><span class="t-label"><em>✅</em>${wide ? "Your steps" : ""}</span><span class="spacer"></span>
    <span class="date-chip" style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${s.length}${wide ? `<small>${note}</small>` : ""}</span>
    ${!wide && late ? `<span class="t-sub" style="color:#f5a59c">${late} late</span>` : ""}</button>`;
}

function roomTile() {
  const r = D.coming.find((c) => c.type === "room");
  if (!r) return `<button class="tile w2" data-open="coming"><span class="t-label"><em>🗓️</em>Next room</span><span class="spacer"></span><span class="t-sub">Nothing on the calendar</span></button>`;
  const [wd, dd] = r.day.split(" ");
  return `<button class="tile w2" data-open="coming"><span class="t-label"><em>🗓️</em>${esc(r.kind === "practical" ? r.name : r.city || r.name)}</span><span class="spacer"></span>
    <span class="date-chip">${esc(dd)}<small>${esc(wd)} · ${r.sold}/${r.chairs}</small></span>
    <div class="pips">${Array.from({ length: Math.min(r.chairs, 24) }, (_, i) => `<i class="${i < r.sold ? "s" : ""}"></i>`).join("")}</div></button>`;
}

function comingTile(wide) {
  const next = D.coming.find((c) => c.type === "line") || D.coming[0];
  return `<button class="tile ${wide ? "w4" : "w2 h2"}" data-open="coming"><span class="t-label"><em>✨</em>Coming up</span><span class="spacer"></span>
    ${next ? `<span style="font-weight:600;font-size:18px;letter-spacing:-0.02em;position:relative">${esc(next.name)}</span><span class="t-sub">${esc(next.day)}${D.coming.length > 1 ? ` · ${D.coming.length - 1} more` : ""}</span>`
      : `<span class="t-sub">Add something to look forward to</span>`}</button>`;
}

function jobTile() {
  const j = D.jobs || [];
  if (!j.length) return "";
  const blanks = j.filter((x) => x.blank).length, auto = j.filter((x) => x.check === "auto").length;
  return `<button class="tile w2 h2" data-open="jobs"><span class="t-label"><em>📋</em>Your job</span><span class="spacer"></span>
    <span class="t-big">${j.length}</span><span class="t-sub">${auto} check themselves${blanks ? ` · ${blanks} for Manav to set` : ""}</span></button>`;
}

/* The calendar tile: the next 14 days as small vials, each filling as its
   post moves from planned to posted. A posting slot with nothing in it is
   drawn dashed: it stays empty until there's a real post for it. */
const cap = (s) => String(s || "").charAt(0).toUpperCase() + String(s || "").slice(1);
const days = (n) => (n >= 28 ? "28+" : n);
function calTile(strip) {
  const c = D.cal; if (!c) return "";
  const st = c.state, warn = st.planned < 14 || st.ready < 7 || st.waiting;
  const cells = c.days.map((d) => {
    const k = d.stage < 0 ? 0 : (d.stage + 1) / 5, gap = d.slot && d.stage < 0;
    return `<button class="vial ${gap ? "gap" : ""} ${d.stage === 4 ? "done" : ""}" data-day="${d.day}" aria-label="${esc(d.label)}${d.slot ? ", slot " + d.slot : ""}${d.count ? ", " + d.count + " post" + (d.count > 1 ? "s" : "") : gap ? ", empty slot" : ""}">
      <i class="v-fill" style="--k:${k}"></i>${d.slot ? '<i class="v-slot"></i>' : ""}<b>${d.date}</b>${strip ? "" : `<small>${d.dow}</small>`}${d.count > 1 ? `<em>${d.count}</em>` : ""}</button>`;
  }).join("");
  return `<div class="tile w4 ${strip ? "strip" : "h2"} cal"><span class="t-label"><em>🗓️</em>Calendar
    <span class="cal-sum ${warn ? "warn" : ""}">${days(st.planned)}d planned · ${days(st.ready)}d ready${st.waiting ? ` · ${st.waiting} waiting` : ""}</span></span>
    <div class="vials">${cells}</div></div>`;
}

const STAGE_WHO = { "dev+keshika": "Dev + Keshika", editor: "the editor", asiya: "Asiya" };
function postCard(p) {
  const S = D.cal.stages, next = S[p.stage + 1];
  const nextWho = !next ? "" : next.owner === "shooter"
    ? (p.shooter === "pro" ? "the photo-video person" : p.shooter ? cap(p.shooter) : "whoever's in the room")
    : STAGE_WHO[next.owner] || cap(next.owner);
  return `<div class="post" data-post="${p.id}">
    <div class="post-h"><span class="chip">${esc(cap(p.format))}</span>${p.time ? `<span class="t-sub">${esc(p.time)}</span>` : ""}</div>
    <p class="post-idea">${esc(p.idea || "Untitled")}</p>
    <div class="stepper">${S.map((s, i) => `<span class="${i <= p.stage ? "on" : ""} ${i === p.stage ? "now" : ""}"><i></i><small>${esc(s.label)}</small></span>`).join("")}</div>
    ${next ? `<div class="post-act"><button class="btn green small" data-act="advance">${esc(next.act)}</button>${p.stage === 2 ? `<button class="btn ghost small" data-act="reject">Needs changes</button>` : `<span class="t-sub">${esc(cap(nextWho))}'s turn</span>`}</div>` : `<p class="t-sub" style="margin:10px 0 0">Posted ✓</p>`}
    ${p.backs ? `<p class="t-sub" style="margin:8px 0 0">Sent back ${p.backs === 1 ? "once" : p.backs + " times"}</p>` : ""}
    <div class="post-links">${p.link ? `<a class="btn ghost small" href="${esc(p.link)}" target="_blank" rel="noopener">📁 Open in Drive</a>` : `<input class="drive" placeholder="Paste the Drive link" aria-label="Drive link for this post">`}
      <button class="linkish" data-act="${p.stage > 0 ? "back" : "remove"}">${p.stage > 0 ? "Undo last stage" : "Remove"}</button></div></div>`;
}

function crmTile() {
  const c = D.crm; if (!c) return "";
  /* Opens the CRM already signed in: the CRM takes the same token from #key=. */
  const href = `${c.url}/#key=${encodeURIComponent(store.get())}`;
  return `<a class="tile w2" href="${esc(href)}" target="_blank" rel="noopener" style="text-decoration:none;color:inherit"><span class="t-label"><em>📇</em>CRM</span><span class="spacer"></span>
    <span style="font-weight:600;font-size:18px;letter-spacing:-0.02em">Open the CRM ↗</span><span class="t-sub">${c.admin ? "Admin" : "Your CRM access"}</span></a>`;
}

const addTile = () => `<button class="tile round add" data-open="add" aria-label="Add">+</button>`;

/* ── the home screen ───────────────────────────────────────────────────── */
function draw() {
  const d = D, owner = d.me.owner;
  const calJobs = (d.jobs || []).every((j) => j.needs === "calendar");
  const tiles = owner
    ? [peopleTile(), revenueTile(), alarmTile(), calTile(true), teamTile(), projectsTile(), roomTile(), stepsTile(true), crmTile(), comingTile(false), addTile()]
    : d.cal
      ? [peopleTile(), mineTile(), alarmTile(), calTile(false), stepsTile(true), roomTile(), crmTile(), calJobs ? "" : jobTile(), comingTile(calJobs), addTile()]
      : [peopleTile(), mineTile(), alarmTile(), stepsTile(true), roomTile(), crmTile(), jobTile(), comingTile(!d.jobs?.length), addTile()];
  app.innerHTML = `<div class="wall"></div><div class="screen">
    <header class="top"><h1 class="lockup"><span>chemistry</span><span>labs<i>.</i></span></h1>
      <div class="hello">${esc(d.month.name)}<b>${esc(d.me.name)}</b></div></header>
    ${d.sample ? `<p class="sample">Test copy of the CRM, frozen at ${esc(day(d.today))}. Not today's numbers.</p>` : ""}
    <main class="grid">${tiles.join("")}</main></div>`;
  app.querySelectorAll("[data-open]").forEach((t) => t.addEventListener("click", () => open(t.dataset.open, t)));
  app.querySelectorAll("[data-day]").forEach((v) => v.addEventListener("click", () => open("day", v, v.dataset.day)));
  if (firstPaint) { firstPaint = false; animate(); }
}

/* Motion only ever starts inside an animation frame, so a browser that never
   paints one shows the finished screen, never a half-built one. */
function animate() {
  if (!motion) return;
  const tiles = [...app.querySelectorAll(".tile")], liquids = [...app.querySelectorAll(".liquid")];
  requestAnimationFrame(() => {
    document.documentElement.classList.add("motion");
    tiles.forEach((t, i) => { t.style.setProperty("--i", i); t.classList.add("pre"); });
    liquids.forEach((l) => l.classList.add("pre"));
    requestAnimationFrame(() => {
      void app.offsetWidth;
      tiles.forEach((t) => { t.classList.add("in"); t.classList.remove("pre"); });
      liquids.forEach((l) => { l.classList.add("go"); l.classList.remove("pre"); });
      app.querySelectorAll("[data-count]").forEach(countUp);
      setTimeout(() => tiles.forEach((t) => t.classList.remove("in")), 1400);
    });
  });
}

function countUp(el) {
  const to = Number(el.dataset.count) || 0, money = el.dataset.fmt === "money";
  if (!to) return;
  const t0 = performance.now(), dur = 1100;
  const step = (t) => { const k = Math.min(1, (t - t0) / dur), v = to * (1 - Math.pow(1 - k, 3)); el.textContent = money ? rupees(v) : int(v); if (k < 1) requestAnimationFrame(step); };
  requestAnimationFrame(step);
}

/* ── the page a tile opens into: icon, title, properties, folds ── */
const prop = (k, v, cls = "") => `<div class="prop"><dt>${k}</dt><dd class="${cls}">${v}</dd></div>`;
const fold = (q, a) => `<details class="fold"><summary>${esc(q)}</summary><p>${a}</p></details>`;
const rows = (items, empty) => items.length ? `<ul class="rows">${items.join("")}</ul>` : `<p class="t-sub" style="padding:8px 0">${esc(empty)}</p>`;
const nextRow = (n) => `<li>${n.late ? '<i class="dot live"></i>' : '<i class="dot" style="background:var(--steel)"></i>'}<span class="txt">${esc(n.text)}</span></li>`;
const goodBad = (c) => (c.target ? (c.forecast >= c.target ? "good" : "bad") : "");

function goalForm(kind, c, money) {
  if (!D.me.owner) return "";
  return `<form class="inline" data-goal="${kind}" style="margin:6px 0 4px"><input inputmode="numeric" placeholder="${c.target ? (money ? rupees(c.target) : int(c.target)) : money ? "₹ target" : "Target"}" aria-label="${esc(D.month.name)} target" required>
    <button class="btn small">${c.target ? "Change" : "Set"} target</button></form>`;
}

const PAGES = {
  people() {
    const c = D.chase.people, r = c.rate, m = D.month;
    return `<div class="icon">👥</div><h2>People in rooms</h2><dl class="props">
      ${prop("🗓️ Month", esc(m.name))}
      ${prop("✔︎ In rooms so far", int(c.done))}
      ${prop("🎟 Booked ahead", int(c.booked))}
      ${prop("〰 Likely from invites", c.likely ? "~" + int(c.likely) : "0")}
      ${prop("➜ Heading for", int(c.forecast), goodBad(c))}
      ${prop("◎ Target", c.target ? int(c.target) : "Not set")}
      ${c.target ? prop("⏱ Today's pace", int((c.target * m.elapsed) / m.days)) : ""}
      ${r ? prop("↺ Invites that pay", `${Math.round(r.pay * 100)}% of ${r.n}`) : ""}</dl>
      ${goalForm("people", c)}
      ${c.ahead.length ? `<p class="block-h">Rooms still ahead this month</p>${rows(c.ahead.map((a) => `<li><span class="txt">${esc(a.name)}<span class="meta ${a.need ? "bad" : ""}">${a.need ? `needs ${a.need} more invites by ${esc(a.safeBy)}` : "on course to fill"}</span></span><span class="num-r">${a.expected}/${a.chairs}<small>${a.sold} paid</small></span></li>`), "")}` : ""}
      ${fold("How this is counted", `Who came, for rooms where the door was marked; who paid, for rooms where it wasn't${c.unmarked ? ` (${c.unmarked} this month)` : ""}. Then everyone already paid for rooms still ahead, plus the invites out times the share of invites that have paid over the last 120 days${r ? ` (${Math.round(r.pay * 100)}% of ${r.n})` : ""}, never more than the chairs left.`)}`;
  },
  revenue() {
    const c = D.chase.revenue;
    return `<div class="icon">💰</div><h2>Revenue</h2><dl class="props">
      ${prop("✔︎ In so far", rupees(c.done))}
      ${prop("🎟 From seats", rupees(c.crm))}
      ${prop("＋ From elsewhere", rupees(c.other))}
      ${prop("〰 Likely from invites", c.likely ? "~" + rupees(c.likely) : "₹0")}
      ${prop("➜ Heading for", rupees(c.forecast), goodBad(c))}
      ${prop("◎ Target", c.target ? rupees(c.target) : "Not set")}</dl>
      ${goalForm("revenue", c, true)}
      ${fold("How this is counted", "Seats paid this month, by the day the money came in, at each room's own price. Comped seats are never money. Plus anything added with + as money in. Hosting income is never part of it. Only you can see this.")}`;
  },
  next() {
    const list = D.me.owner ? D.next || [] : [D.warning, ...(D.mine?.steps || [])].filter(Boolean);
    return `<div class="icon">🔴</div><h2>Do next</h2>${rows(list.map(nextRow), "Nothing is slipping.")}
      ${fold("Where these come from", "Each one is worked out from the CRM: chairs sold, invites out, and how fast invites have turned into payments before. If the data can't back a step, it isn't shown.")}`;
  },
  mine() {
    const m = D.mine;
    return `<div class="icon">${iconOf(D.me.title)}</div><h2>${esc(m.label)}</h2><dl class="props">
      ${m.value != null ? prop("✔︎ This month", int(m.value) + (m.unit === "%" ? "%" : m.unit ? " " + esc(m.unit) : "")) : prop("Status", esc(m.empty || "Waiting"))}
      ${m.target ? prop("◎ Target", int(m.target)) : ""}
      ${m.forecast != null && m.value != null ? prop("➜ Heading for", int(m.forecast)) : ""}
      ${m.money != null ? prop("💰 From your work", rupees(m.money)) : ""}
      ${m.plan ? prop("🧪 " + esc(m.plan.label), `${m.plan.value} of ${m.plan.of}`, m.plan.value >= m.plan.of ? "good" : "bad") : ""}
      ${(m.breakdown || []).map((b) => prop("·", esc(b))).join("")}</dl>
      ${m.note ? `<p class="t-sub" style="font-size:14.5px">${esc(m.note)}</p>` : ""}
      <p class="block-h">What moves it next</p>${rows((m.steps || []).map(nextRow), "Nothing the data says needs doing right now.")}`;
  },
  jobs() {
    return `<div class="icon">📋</div><h2>Your job</h2>${rows(D.jobs.map((j) => `<li><span class="chip">${j.check === "auto" ? "auto" : "tick"}</span><span class="txt">${esc(j.label)}<span class="meta ${j.status && !j.status.ok ? "bad" : ""}">${j.status ? (j.status.ok ? "✓ " : "") + esc(j.status.value) : j.blank ? "Manav sets this: " + esc(j.blank.toLowerCase()) : j.needs === "instagram" ? "Checks itself once Instagram is connected" : "You tick this one"}</span></span></li>`), "")}`;
  },
  team() {
    return `<div class="icon">🧑‍🤝‍🧑</div><h2>Team</h2>${rows((D.team || []).map((t) => `<li><span class="txt"><b style="font-weight:600">${esc(t.name)}</b> <span class="chip ${esc(t.status.replace(/\s+/g, "-"))}">${esc(t.status)}</span>
      <span class="meta">${esc(t.title)} · ${esc(t.label || "")}${t.account ? "" : " · no CRM account yet"}</span></span>
      <span class="num-r">${t.value != null ? int(t.value) + (t.target ? `<small>of ${int(t.target)}</small>` : "") : "—"}${t.money != null ? `<small>${rupees(t.money)}</small>` : ""}</span></li>`), "No one yet.")}`;
  },
  projects() {
    const ps = D.projects || [];
    return `<div class="icon">🗂️</div><h2>Projects</h2>${rows(ps.map((p) => `<li style="align-items:flex-start"><span class="txt">
      <b style="font-weight:600">${esc(p.title)}</b> <span class="chip ${esc(p.risk.replace(/\s+/g, "-"))}">${esc(p.risk)}</span>
      <span class="meta">${p.done} of ${p.total} steps${p.next ? ` · next: ${esc(p.next.title)} (${esc(p.next.owner)})` : ""}</span>
      <div class="pips">${p.steps.map((s) => `<i class="${s.done ? "d" : s.late ? "l" : ""}"></i>`).join("")}</div>
      <details class="fold" style="border:0;padding:8px 0 0"><summary>Steps</summary>${rows(p.steps.map((s) => `<li><span class="txt">${s.done ? "<s>" : ""}${esc(s.title)}${s.done ? "</s>" : ""}<span class="meta ${s.late ? "bad" : ""}">${esc(s.owner)} · ${s.due ? (s.late ? "was due " : "by ") + day(s.due) : "no date yet"}</span></span></li>`), "")}</details>
      ${p.status === "proposed" ? `<div class="acts"><button class="btn small green" data-decide="approve" data-id="${p.id}">Approve</button><button class="btn small ghost" data-decide="kill" data-id="${p.id}">Kill</button></div>` : ""}
      </span></li>`), "No projects yet. Start one with +.")}
      ${D.waiting ? `<p class="t-sub" style="margin-top:14px">${D.waiting === 1 ? "One message is" : D.waiting + " messages are"} waiting to go to the team. Nothing is sent until you say go.</p>` : ""}`;
  },
  steps() {
    return `<div class="icon">✅</div><h2>Your steps</h2>${rows(D.steps.map((s) => `<li data-step="${s.id}">
      <button class="tick" aria-label="Mark done: ${esc(s.title)}"><svg viewBox="0 0 16 16"><path d="M3 8.5l3.2 3L13 4.8"/></svg></button>
      <span class="txt">${esc(s.title)}<span class="meta ${s.late ? "bad" : ""}">${esc(s.project)} · ${s.due ? (s.late ? "was due " : "by ") + day(s.due) : "no date yet"}</span></span></li>`), "Nothing waiting on you.")}`;
  },
  coming() {
    return `<div class="icon">✨</div><h2>Coming up</h2>${rows(D.coming.map((c) => `<li><span class="txt">${esc(c.name)}${c.kind === "practical" ? ' <span class="chip">practical</span>' : ""}
      <span class="meta">${esc(c.day)}${c.city ? " · " + esc(c.city) : ""}</span>
      ${c.type === "room" ? `<div class="pips">${Array.from({ length: Math.min(c.chairs, 30) }, (_, i) => `<i class="${i < c.sold ? "s" : ""}"></i>`).join("")}</div>` : ""}</span>
      ${c.type === "room" ? `<span class="num-r">${c.sold}/${c.chairs}<small>chairs</small></span>` : ""}</li>`), "Nothing yet. Add something with +.")}`;
  },
  day(key) {
    const d = D.cal.days.find((x) => x.day === key) || { label: key, slot: "" };
    const posts = D.cal.posts.filter((p) => p.day === key);
    return `<div class="icon">🗓️</div><h2>${esc(d.label)}</h2><dl class="props">${prop("⏰ Posting slot", d.slot || "None this day")}</dl>
      ${posts.map(postCard).join("")}
      <p class="block-h">Add a post</p>
      <form class="addpost" data-day="${esc(key)}"><div class="chips">${D.cal.formats.map((f, i) => `<button type="button" class="${i === 0 ? "on" : ""}" data-f="${f}">${cap(f)}</button>`).join("")}</div>
        <div class="inline"><input name="idea" placeholder="What's the post?" required><button class="btn small green">Add</button></div><p class="err"></p></form>
      ${d.slot && !posts.length ? `<p class="t-sub">An empty slot stays empty until there's a real post for it.</p>` : ""}`;
  },
  add() { return `<div class="icon">＋</div><h2>Add</h2><div id="addbody"></div>`; },
};

function open(name, from, arg) {
  const scrim = document.createElement("div"), page = document.createElement("div");
  scrim.className = "scrim"; page.className = "page"; page.setAttribute("role", "dialog");
  document.body.append(scrim, page);
  const close = () => { scrim.remove(); page.remove(); document.removeEventListener("keydown", onKey); };
  const onKey = (e) => e.key === "Escape" && close();
  /* A page repaints in place after an action, so moving a post a stage never
     closes what you're looking at. */
  const paint = () => {
    page.innerHTML = `<div class="grab"></div>${PAGES[name](arg)}`;
    wirePage(page, close, paint);
    if (name === "add") addForm(page, close);
  };
  document.addEventListener("keydown", onKey);
  scrim.onclick = close;
  let y0 = null;
  page.addEventListener("touchstart", (e) => { if (page.scrollTop <= 0) y0 = e.touches[0].clientY; }, { passive: true });
  page.addEventListener("touchend", (e) => { if (y0 != null && e.changedTouches[0].clientY - y0 > 90) close(); y0 = null; });
  paint();
  grow(page, from);
}

/* The page grows out of the tile that was tapped, the way a Control Center
   tile opens. */
function grow(page, from) {
  if (!motion || !from) return;
  requestAnimationFrame(() => {
    const a = from.getBoundingClientRect(), b = page.getBoundingClientRect();
    page.style.transition = "none";
    page.style.transform = `translate(${a.left - b.left}px, ${a.top - b.top}px) scale(${a.width / b.width}, ${a.height / b.height})`;
    page.style.borderRadius = "28px";
    requestAnimationFrame(() => { void page.offsetWidth; page.style.transition = "transform .5s var(--ease), border-radius .5s var(--ease)"; page.style.transform = ""; page.style.borderRadius = ""; });
  });
}

async function after(paint) { D = await api("/api/board"); draw(); paint(); }

function wirePage(page, close, paint) {
  page.querySelectorAll("[data-post] [data-act]").forEach((b) => b.onclick = async () => {
    const id = Number(b.closest("[data-post]").dataset.post), action = b.dataset.act;
    if (action === "advance") { b.classList.add("pop"); if (navigator.vibrate) navigator.vibrate(10); }
    try { await api("/api/post", { action, id }); await after(paint); } catch (e) { alert(e.message); }
  });
  page.querySelectorAll("[data-post] .drive").forEach((inp) => {
    const save = async () => {
      const link = inp.value.trim(); if (!link) return;
      try { await api("/api/post", { action: "edit", id: Number(inp.closest("[data-post]").dataset.post), link }); await after(paint); } catch (e) { alert(e.message); }
    };
    inp.addEventListener("change", save);
    inp.addEventListener("paste", () => setTimeout(save, 0));
  });
  page.querySelectorAll("form.addpost").forEach((f) => {
    let format = "reel";
    f.querySelectorAll("[data-f]").forEach((c) => c.onclick = () => { format = c.dataset.f; f.querySelectorAll("[data-f]").forEach((x) => x.classList.toggle("on", x === c)); });
    f.onsubmit = async (e) => {
      e.preventDefault();
      try { await api("/api/post", { action: "add", day: f.dataset.day, format, idea: f.idea.value }); await after(paint); }
      catch (err) { f.querySelector(".err").textContent = err.message; }
    };
  });
  page.querySelectorAll("[data-step] .tick").forEach((b) => b.onclick = async () => {
    const li = b.closest("li");
    b.classList.add("on"); li.classList.add("leaving");
    if (navigator.vibrate) navigator.vibrate(10);
    try { await api("/api/step", { id: Number(li.dataset.step), done: true }); setTimeout(() => { li.remove(); refresh(); }, motion ? 850 : 0); }
    catch (e) { b.classList.remove("on"); li.classList.remove("leaving"); alert(e.message); }
  });
  page.querySelectorAll("[data-decide]").forEach((b) => b.onclick = async () => {
    await api("/api/project/decide", { id: Number(b.dataset.id), verdict: b.dataset.decide }); close(); refresh();
  });
  page.querySelectorAll("[data-goal]").forEach((f) => f.onsubmit = async (e) => {
    e.preventDefault();
    const value = Number(String(f.querySelector("input").value).replace(/[^\d.]/g, ""));
    if (!(value > 0)) return;
    await api("/api/target", { month: D.month.month, key: f.dataset.goal, value }); close(); firstPaint = true; refresh();
  });
}

/* ── + : one line in. Money the CRM can't see, something to look forward
   to, or a new project. ── */
function addForm(page, close) {
  const kinds = [["money", "💰 Money in"], ["ahead", "✨ Coming up"], ["project", "🗂️ New project"]];
  let kind = "money";
  const people = [...new Set((D.team || []).map((t) => t.handle).concat(D.me.handle))];
  const stepRow = () => `<div class="steprow"><input name="st" placeholder="What"><select name="so">${people.map((h) => `<option value="${esc(h)}" ${h === D.me.handle ? "selected" : ""}>${esc(h)}</option>`).join("")}</select><input name="sd" type="date" aria-label="By when"></div>`;
  const F = {
    money: `<label class="f"><span>How much</span><input name="amount" inputmode="numeric" placeholder="₹ 15,000" required></label>
      <label class="f"><span>From what</span><input name="text" placeholder="Catalyst fee from Divyam"></label>
      <label class="f"><span>When it came in</span><input name="day" type="date" value="${D.today}"></label>`,
    ahead: `<label class="f"><span>What's coming</span><input name="text" placeholder="Diwali party on the terrace" required></label>
      <label class="f"><span>When</span><input name="day" type="date" value="${D.today}"></label>`,
    project: `<label class="f"><span>Project</span><input name="title" placeholder="Practicals in Surat" required></label>
      <label class="f"><span>Done looks like</span><input name="test" placeholder="First Surat practical runs with 12 people"></label>
      <label class="f"><span>Ends</span><input name="ends" type="date"></label>
      <p class="block-h" style="margin-top:4px">Steps, one owner each</p><div id="rows"></div>
      <button type="button" class="btn small ghost" id="more">+ Step</button>
      ${D.me.owner ? "" : `<p class="t-sub" style="margin-top:12px">It goes live once Manav says yes.</p>`}`,
  };
  const body = $("#addbody", page);
  const paint = () => {
    body.innerHTML = `<div class="chips">${kinds.map(([k, l]) => `<button type="button" class="${k === kind ? "on" : ""}" data-k="${k}">${l}</button>`).join("")}</div>
      <form id="addf">${F[kind]}<p class="err" id="adderr"></p><button class="btn green" type="submit">Add</button></form>`;
    body.querySelectorAll("[data-k]").forEach((c) => c.onclick = () => { kind = c.dataset.k; paint(); });
    if (kind === "project") { const r = $("#rows", body); r.innerHTML = stepRow(); $("#more", body).onclick = () => r.insertAdjacentHTML("beforeend", stepRow()); }
    $("#addf", body).onsubmit = async (e) => {
      e.preventDefault();
      const f = new FormData(e.target);
      const b = { kind, text: f.get("text"), amount: Number(String(f.get("amount") || "").replace(/[^\d.]/g, "")), day: f.get("day"), title: f.get("title"), test: f.get("test"), ends: f.get("ends") };
      if (kind === "project") { const t = f.getAll("st"), o = f.getAll("so"), dd = f.getAll("sd"); b.steps = t.map((x, i) => ({ title: x, owner: o[i], due: dd[i] })).filter((s) => s.title.trim()); }
      try { await api("/api/add", b); close(); refresh(); } catch (err) { $("#adderr", body).textContent = err.message; }
    };
  };
  paint();
}

async function refresh() { try { D = await api("/api/board"); draw(); } catch (e) { if (e.message !== "signed out") console.error(e); } }
function load() {
  if (!store.get()) return login();
  app.innerHTML = `<div class="wall"></div>`;
  refresh();
}
load();
