/* The screen draws what the server sends and nothing else. Every number
   arrives already computed; the only arithmetic here is how full a beaker is. */

const $ = (s, r = document) => r.querySelector(s);
const app = $("#app");
const KEY = "hub.key";
const store = {
  get: () => { try { return localStorage.getItem(KEY) || ""; } catch { return ""; } },
  set: (v) => { try { v ? localStorage.setItem(KEY, v) : localStorage.removeItem(KEY); } catch {} },
};
/* A sign-in link from Manav: #key=… signs them in, then leaves the address bar. */
{
  const m = location.hash.match(/key=([^&]+)/);
  if (m) { store.set(decodeURIComponent(m[1])); history.replaceState(null, "", location.pathname); }
}
const motion = !matchMedia("(prefers-reduced-motion: reduce)").matches;
let D = null, firstPaint = true;

const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const int = (n) => Math.round(Number(n) || 0).toLocaleString("en-IN");
const rupees = (n) => "₹" + int(n);

/* REVENUE STAYS HIDDEN UNTIL ASKED FOR, his ruling, 30 Oct 2026: like a bank app,
   every absolute rupee figure shows as ₹ •••• and appears on a tap, then hides
   again after 15 seconds and on every reload. The beaker still fills, because a
   share of the target is not the number. */
const SECRET_MS = 15000;
const secret = (n, mask = "₹ ••••") => `<span class="secret" data-v="${esc(rupees(n))}" data-m="${mask}" role="button" tabindex="0" title="Tap to show or hide">${mask}</span>`;
function revealSecrets() {
  document.querySelectorAll(".secret").forEach((s) => { s.textContent = s.dataset.v; s.classList.add("shown"); });
  clearTimeout(revealSecrets.t);
  revealSecrets.t = setTimeout(() => document.querySelectorAll(".secret")
    .forEach((s) => { s.textContent = s.dataset.m; s.classList.remove("shown"); }), SECRET_MS);
}
/* A tap shows the figures; a tap on a shown figure hides them again at once. */
function hideSecrets() {
  clearTimeout(revealSecrets.t);
  document.querySelectorAll(".secret").forEach((s) => { s.textContent = s.dataset.m; s.classList.remove("shown"); });
}
document.addEventListener("click", (e) => {
  const s = e.target.closest && e.target.closest(".secret");
  if (!s) return;
  e.preventDefault(); e.stopPropagation();
  s.classList.contains("shown") ? hideSecrets() : revealSecrets();
}, true);
const WD = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"], MO = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const day = (d) => { const t = new Date(d + "T00:00:00Z"); return `${WD[t.getUTCDay()]} ${t.getUTCDate()} ${MO[t.getUTCMonth()]}`; };
const ICON = { Founder: "🎯", "CRM and WhatsApp": "💬", Practicals: "🧪", "Venture Catalyst": "🚀", "Fashion accelerator and creative QC": "👗", "Social media and creative ops": "📸", "Creative agency": "🎨" };
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
let givenPw = "", pwOffered = false;
function login(msg = "") {
  app.innerHTML = `<div class="wall"></div><div class="screen"><form class="login" id="login">
    <h1 class="lockup"><span>chemistry</span><span>labs<i>.</i></span></h1>
    <p>Sign in with your username and password.</p>
    <label class="f"><span>Username</span><input name="handle" autocomplete="username" autocapitalize="none" required></label>
    <label class="f"><span>Password</span><input name="pw" type="password" autocomplete="current-password" required></label>
    <p class="err">${esc(msg)}</p><button class="btn green" type="submit">Sign in</button></form></div>`;
  $("#login").onsubmit = async (e) => {
    e.preventDefault();
    const f = new FormData(e.target);
    try { const { key, pw } = await api("/api/login", { handle: f.get("handle"), pw: f.get("pw") }); if (pw) givenPw = f.get("pw"); store.set(key); firstPaint = true; load(); }
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
    ${target ? `<i class="goal" style="--at:${pc(target)}"><span>${money ? secret(target, "₹ •••") : int(target)}</span></i><i class="pace" style="--pace:${pc((target * m.elapsed) / m.days)}"></i>` : ""}
    <span class="t-label"><em>${icon}</em>${esc(label)}</span>
    <span class="spacer"></span>
    <span class="t-big ${money ? "money" : ""}">${money && value != null ? secret(value) : `<span ${value != null ? `data-count="${value}" data-fmt="${Number.isInteger(value) ? "int" : "dec"}"` : ""}>${value == null ? "—" : Number.isInteger(value) ? int(value) : value.toFixed(1)}</span>`}${pct && value != null ? "%" : ""}</span>
    <span class="t-sub">${sub}</span></button>`;
}

function verdictOf(c, money) {
  const f = money ? secret(c.forecast) : int(c.forecast);
  if (!c.target) return `heading for ${f}`;
  const gap = Math.round(c.forecast - c.target);
  const t = money ? secret(c.target) : int(c.target);
  return gap >= 0 ? `of ${t} · on target` : `of ${t} · ${money ? secret(-gap) : int(-gap)} short`;
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
  const m = D.mine; if (!m || m.none) return "";
  const icon = iconOf(D.me.title);
  if (m.value == null) return beaker({ open: "mine", icon, label: m.label, value: null, done: 0, idle: true, sub: esc(m.empty || "") });
  if (m.unit === "steps") return `<button class="tile w2 h2" data-open="mine"><span class="t-label"><em>${icon}</em>${esc(m.label)}</span><span class="spacer"></span>
    <span style="align-self:center">${ring(m.value, m.target, `${m.value}/${m.target}`, true)}</span><span class="spacer"></span>
    <span class="t-sub">${m.empty ? esc(m.empty) : `${m.target - m.value} to go`}</span></button>`;
  if (m.unit === "days" && !m.rooms && m.target) return `<button class="tile w2 h2" data-open="mine"><span class="t-label"><em>${icon}</em>${esc(m.label)}</span><span class="spacer"></span>
    <span style="align-self:center">${ring(m.value, m.target, `${m.value}/${m.target}`, true)}</span><span class="spacer"></span>
    <span class="t-sub">${m.target - m.value ? `${m.target - m.value} slipped this month` : "Nothing slipped this month"}</span></button>`;
  if (m.unit === "days") return beaker({ open: "mine", icon, label: m.label, value: m.value, done: m.value ?? 0, target: m.target,
    sub: m.value == null ? esc(m.empty || "") : m.value >= 3 ? "days to spare · well done" : m.value >= 2 ? "days to spare · on target" : "days to spare · late" });
  if (m.unit === "%") return beaker({ open: "mine", icon, label: m.label, value: m.value, pct: true, done: m.value, target: m.target,
    sub: esc(m.breakdown?.[0] || "") });
  return beaker({ open: "mine", icon, label: m.label, value: m.value, done: m.value, likely: Math.max(0, (m.forecast ?? m.value) - m.value),
    target: m.target, sub: m.target ? `of ${int(m.target)}` : m.money != null ? `${secret(m.money)} from your work` : esc(m.breakdown?.[0] || "") });
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
  const ps = D.me.owner ? D.projects || [] : D.myProjects || [];
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
  if (!r) return `<button class="tile w2" data-open="coming"><span class="t-label"><em>🗓️</em>Next room</span><span class="spacer"></span><span class="t-sub">Add the next room in the CRM</span></button>`;
  const [wd, dd] = r.day.split(" ");
  return `<button class="tile w2" data-open="coming"><span class="t-label"><em>🗓️</em>${esc(r.kind === "practical" ? r.name : r.city || r.name)}</span><span class="spacer"></span>
    <span class="date-chip">${esc(dd)}<small>${esc(wd)} · ${r.sold}/${r.chairs}</small></span>
    <div class="pips">${Array.from({ length: Math.min(r.chairs, 24) }, (_, i) => `<i class="${i < r.sold ? "s" : ""}"></i>`).join("")}</div></button>`;
}

function jobTile() {
  const j = D.jobs || [];
  if (!j.length) return "";
  const ok = j.filter((x) => x.status?.ok).length;
  return `<button class="tile w2 h2" data-open="jobs"><span class="t-label"><em>📋</em>Your job</span><span class="spacer"></span>
    <span class="t-big">${ok}/${j.length}</span><span class="t-sub">on track</span></button>`;
}

/* The calendar tile: the next 14 days as small vials, each filling as its
   post moves from planned to posted. A posting slot with nothing in it is
   drawn dashed: it stays empty until there's a real post for it. */
const cap = (s) => String(s || "").charAt(0).toUpperCase() + String(s || "").slice(1);
const days = (n) => (n >= 28 ? "28+" : n);
function calTile(strip) {
  const c = D.cal; if (!c) return "";
  const st = c.state, warn = st.flagged;
  const cells = c.days.map((d) => {
    const k = d.stage < 0 ? 0 : (d.stage + 1) / 5, gap = d.slot && d.stage < 0;
    return `<button class="vial ${gap ? "gap" : ""} ${d.stage === 4 ? "done" : ""}" data-day="${d.day}" aria-label="${esc(d.label)}${d.slot ? ", slot " + d.slot : ""}${d.count ? ", " + d.count + " post" + (d.count > 1 ? "s" : "") : gap ? ", empty slot" : ""}">
      <i class="v-fill" style="--k:${k}"></i>${d.slot ? '<i class="v-slot"></i>' : ""}<b>${d.date}</b>${strip ? "" : `<small>${d.dow}</small>`}${d.count > 1 ? `<em>${d.count}</em>` : ""}</button>`;
  }).join("");
  return `<div class="tile w4 ${strip ? "strip" : "h2"} cal"><span class="t-label"><em>🗓️</em>Calendar
    <span class="cal-sum ${warn ? "warn" : ""}">${st.filled} of ${st.slots} slots planned · ${st.ready} ready${st.waiting ? ` · ${st.waiting} waiting` : ""}</span>
    ${c.sheet ? `<a href="${esc(c.sheet)}" target="_blank" rel="noopener" style="margin-left:auto;color:inherit">Open the sheet ↗</a>` : ""}</span>
    <div class="vials">${cells}</div></div>`;
}

const STAGE_WHO = { agency: "the agency", creative: "the creative check" };
function postCard(p) {
  const S = D.cal.stages, next = S[p.stage + 1];
  const canCheck = D.me.owner || D.me.qc, atCheck = p.stage === 2;
  const nextWho = !next ? "" : next.owner === "shooter"
    ? (p.shooter === "pro" ? "the photo-video person" : p.shooter ? cap(p.shooter) : "whoever's in the room")
    : STAGE_WHO[next.owner] || cap(next.owner);
  return `<div class="post" data-post="${p.id}">
    <div class="post-h"><span class="chip">${esc(cap(p.format))}</span>${p.time ? `<span class="t-sub">${esc(p.time)}</span>` : ""}</div>
    <p class="post-idea">${esc(p.idea || "Untitled")}</p>
    <div class="stepper">${S.map((s, i) => `<span class="${i <= p.stage ? "on" : ""} ${i === p.stage ? "now" : ""}"><i></i><small>${esc(s.label)}</small></span>`).join("")}</div>
    ${!next ? `<p class="t-sub" style="margin:10px 0 0">Posted ✓</p>` : atCheck && !canCheck ? `<p class="t-sub" style="margin:10px 0 0">Waiting for the creative check</p>` : `<div class="post-act"><button class="btn green small" data-act="advance">${esc(next.act)}</button>${atCheck ? `<button class="btn ghost small" data-act="reject">Needs changes</button>` : `<span class="t-sub">${esc(nextWho === STAGE_WHO.creative ? "Then the creative check" : cap(nextWho) + "'s turn")}</span>`}</div>`}
    ${p.backs ? `<p class="t-sub" style="margin:8px 0 0">Sent back ${p.backs === 1 ? "once" : p.backs + " times"}</p>` : ""}
    <div class="post-links">${p.link ? `<a class="btn ghost small" href="${esc(p.link)}" target="_blank" rel="noopener">📁 Open in Drive</a>` : `<input class="drive" placeholder="Paste the Drive link" aria-label="Drive link for this post">`}
      <button class="linkish" data-act="${p.stage > 0 ? "back" : "remove"}">${p.stage > 0 ? "Undo last stage" : "Remove"}</button></div></div>`;
}

/* Catalyst attendance: tap who came, after each session. */
function attendTile() {
  const a = D.attend; if (!a) return "";
  const last = a.sessions[0];
  return `<button class="tile w2" data-open="attend"><span class="t-label"><em>🚀</em>Catalyst attendance</span><span class="spacer"></span>
    <span style="font-weight:600;font-size:18px;letter-spacing:-0.02em">Tick who came</span><span class="t-sub">${last ? `Last: ${esc(last.label)}, ${last.came.length} of ${last.due.length}` : "No session yet"}</span></button>`;
}

/* Umang's base for the pilot: the founders' numbers and call status, in the sheet the hub reads. */
function contactsTile() {
  const s = D.attend && D.attend.sheet; if (!s) return "";
  return `<a class="tile w2" href="${esc(s)}" target="_blank" rel="noopener" style="color:inherit;text-decoration:none"><span class="t-label"><em>📞</em>Catalyst founders</span><span class="spacer"></span>
    <span style="font-weight:600;font-size:18px;letter-spacing:-0.02em">Contacts</span><span class="t-sub">Open the sheet ↗</span></a>`;
}

/* Manav and Umang only: opens the agreement form. The server sends it only with a valid sign-in,
   so it comes through the API and opens as a page of its own. */
function agreementsTile() {
  if (!D.agreements) return "";
  return `<button class="tile w2" data-agree><span class="t-label"><em>📝</em>Agreements</span><span class="spacer"></span>
    <span style="font-weight:600;font-size:18px;letter-spacing:-0.02em">New agreement</span><span class="t-sub">Opens the form and downloads a PDF</span></button>`;
}

function reactionsTile() {
  if (!D.reactions) return "";
  return `<button class="tile w2" data-rx><span class="t-label"><em>🃏</em>Reactions</span><span class="spacer"></span>
    <span style="font-weight:600;font-size:18px;letter-spacing:-0.02em">Reactions forms</span><span class="t-sub">Make a sign-up page for an event</span></button>`;
}

/* Same way as the agreements: the page comes through the API, signed in, and opens on its own. */
async function openReactions() {
  const w = window.open("", "_blank");
  try {
    const r = await fetch(API + "/api/reactions", { headers: { "x-key": store.get() } });
    if (r.status === 401) { store.set(""); login(); if (w) w.close(); return; }
    if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || "Something went wrong.");
    const url = URL.createObjectURL(new Blob([await r.text()], { type: "text/html" }));
    if (w) w.location.href = url; else location.href = url;
  } catch (e) { if (w) w.close(); alert(e.message || "Could not open the page."); }
}

async function openAgreements() {
  const w = window.open("", "_blank");
  try {
    const r = await fetch(API + "/api/agreements", { headers: { "x-key": store.get() } });
    if (r.status === 401) { store.set(""); login(); if (w) w.close(); return; }
    if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || "Something went wrong.");
    const url = URL.createObjectURL(new Blob([await r.text()], { type: "text/html" }));
    if (w) w.location.href = url; else location.href = url;
  } catch (e) { if (w) w.close(); alert(e.message || "Could not open the form."); }
}

function crmTile() {
  const c = D.crm;
  /* The tile is always the next step: open it, ask for it, or know it's on its way. */
  if (!c && D.crmAsk) return D.crmAsk.asked
    ? `<div class="tile w2"><span class="t-label"><em>📇</em>CRM</span><span class="spacer"></span><span style="font-weight:600;font-size:18px;letter-spacing:-0.02em">Account requested</span><span class="t-sub">Manav is setting it up</span></div>`
    : `<button class="tile w2" data-crm-ask><span class="t-label"><em>📇</em>CRM</span><span class="spacer"></span><span style="font-weight:600;font-size:18px;letter-spacing:-0.02em">Request a CRM account</span><span class="t-sub">To add dates and decide applications</span></button>`;
  if (!c) return "";
  /* Opens the CRM already signed in: the CRM takes the same token from #key=. */
  const href = `${c.url}/#key=${encodeURIComponent(store.get())}`;
  return `<a class="tile w2" href="${esc(href)}" target="_blank" rel="noopener" style="text-decoration:none;color:inherit"><span class="t-label"><em>📇</em>CRM</span><span class="spacer"></span>
    <span style="font-weight:600;font-size:18px;letter-spacing:-0.02em">Open the CRM ↗</span><span class="t-sub">${c.admin ? "Admin" : "Your CRM access"}</span></a>`;
}

/* What people did on the website this week, and the one thing most worth doing about it. */
function websiteTile() {
  const w = D.website; if (!w) return "";
  const top = (w.learnings || [])[0];
  const line = top ? top.text : w.collecting ? `The first reading comes at ${w.firstReading} people. ${int(w.soFar)} so far.` : "Nothing needs attention.";
  return `<button class="tile w4 website" data-open="website" aria-label="Website this week"><span class="t-label"><em>🔭</em>Website this week</span>
    <span class="web-nums"><span><b class="t-mid">${int(w.people)}</b><small>people</small></span><span><b class="t-mid">${int(w.started)}</b><small>started a form</small></span><span><b class="t-mid">${int(w.applied)}</b><small>applied</small></span></span>
    <span class="t-sub web-line${top && top.rank === 1 ? " web-bad" : ""}">${esc(line)}</span></button>`;
}

const addTile = () => `<button class="tile round add" data-open="add" aria-label="New project">+</button>`;

/* ── the home screen ───────────────────────────────────────────────────── */
function draw() {
  const d = D;
  const t = homeTiles(d);
  /* Editing: every tile wiggles and carries a minus, the way a phone's home screen does. */
  const tiles = t.order.map((id) => {
    const h = t.html[id];
    if (!editing || id === "add") return h;
    const at = h.indexOf(">");
    return h.slice(0, at + 1) + `<span class="minus" data-minus="${esc(id)}" role="button" tabindex="0" aria-label="Hide ${esc(TILE_NAMES[id] || "this link")}">−</span>` + h.slice(at + 1);
  });
  app.innerHTML = `<div class="wall"></div><div class="screen${editing ? " editing" : ""}">
    ${editing
      ? `<header class="top edit-top"><button class="btn small ghost" data-homeadd>+ Add</button><span class="t-sub">Drag to move. Tap − to hide.</span><button class="btn small" data-editdone>Done</button></header>`
      : `<header class="top"><h1 class="lockup"><span>chemistry</span><span>labs<i>.</i></span></h1>
      <div class="hello">${esc(d.month.name)}<b>${esc(d.me.name)}</b><span class="hello-acts">${d.me.external ? "" : `<button class="linkish" data-edit-home>Edit home</button><button class="linkish" data-how>How this works</button>`}${d.account ? `<button class="linkish" data-open="password">Change password</button>` : ""}</span></div></header>`}
    ${d.sample ? `<p class="sample">Test copy of the CRM, frozen at ${esc(day(d.today))}. Not today's numbers.</p>` : ""}
    <main class="grid">${tiles.join("")}</main></div>`;
  app.querySelectorAll("[data-open]").forEach((el) => el.addEventListener("click", () => open(el.dataset.open, el)));
  app.querySelectorAll("[data-agree]").forEach((b) => b.addEventListener("click", openAgreements));
  app.querySelectorAll("[data-rx]").forEach((b) => b.addEventListener("click", openReactions));
  app.querySelectorAll("[data-day]").forEach((v) => v.addEventListener("click", () => open("day", v, v.dataset.day)));
  app.querySelectorAll("[data-crm-ask]").forEach((b) => b.addEventListener("click", async () => { try { await api("/api/crm/request", {}); D.crmAsk.asked = true; draw(); } catch (e) { alert(e.message); } }));
  const q = (sel, fn) => { const el = app.querySelector(sel); if (el) el.addEventListener("click", fn); };
  q("[data-edit-home]", enterEdit); q("[data-editdone]", leaveEdit); q("[data-how]", welcome);
  q("[data-homeadd]", (e) => open("homeadd", e.currentTarget));
  wireHome();
  if (firstPaint) { firstPaint = false; animate(); }
  if (!d.me.external && !H().welcomed && !welcomeShown) { welcomeShown = true; welcome(); return; }
  if (d.account?.temp && !pwOffered) { pwOffered = true; open("password", app.querySelector(".hello")); }
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
  const step = (t) => { const k = Math.min(1, (t - t0) / dur), v = to * (1 - Math.pow(1 - k, 3)); el.textContent = money ? rupees(v) : el.dataset.fmt === "dec" ? v.toFixed(1) : int(v); if (k < 1) requestAnimationFrame(step); };
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
  return `<form class="inline" data-goal="${kind}" style="margin:6px 0 4px"><input inputmode="numeric" placeholder="${c.target ? (money ? "New ₹ target" : int(c.target)) : money ? "₹ target" : "Target"}" aria-label="${esc(D.month.name)} target" required>
    <button class="btn small">${c.target ? "Change" : "Set"} target</button></form>`;
}

const PAGES = {
  people() {
    const c = D.chase.people, r = c.rate, m = D.month;
    return `<div class="icon">👥</div><h2>People in rooms</h2><dl class="props">
      ${prop("🗓️ Month", esc(m.name))}
      ${prop("✔︎ In rooms so far", int(c.done))}
      ${c.online ? prop("🚀 Of those, online Catalyst", int(c.online)) : ""}
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
      ${prop("✔︎ In so far", secret(c.done))}
      ${prop("🎟 From seats", secret(c.crm))}
      ${prop("＋ From elsewhere", secret(c.other))}
      ${prop("〰 Likely from invites", c.likely ? "~" + secret(c.likely) : secret(0))}
      ${prop("➜ Heading for", secret(c.forecast), goodBad(c))}
      ${prop("◎ Target", c.target ? secret(c.target) : "Not set")}</dl>
      <p class="t-sub" style="margin:-6px 0 12px">Tap any ₹ •••• to see it, and tap again to hide it. It also hides itself after 15 seconds.</p>
      ${goalForm("revenue", c, true)}
      ${fold("How this is counted", "Seats paid this month, by the day the money came in, at each room's own price. Comped seats are never money. Hosting income is never part of it. Only you can see this.")}`;
  },
  next() {
    const list = D.me.owner ? D.next || [] : [D.warning, ...(D.mine?.steps || [])].filter(Boolean);
    return `<div class="icon">🔴</div><h2>Do next</h2>${rows(list.map(nextRow), "Nothing is slipping.")}
      ${fold("Where these come from", "Each one is worked out from the CRM: chairs sold, invites out, and how fast invites have turned into payments before. If the data can't back a step, it isn't shown.")}`;
  },
  mine() {
    const m = D.mine;
    return `<div class="icon">${iconOf(D.me.title)}</div><h2>${esc(m.label)}</h2><dl class="props">
      ${m.value != null ? prop(m.period || "✔︎ This month", int(m.value) + (m.unit === "%" ? "%" : m.unit ? " " + esc(m.unit) : "")) : prop("Status", esc(m.empty || "Waiting"))}
      ${m.target ? prop("◎ Target", int(m.target)) : ""}
      ${m.forecast != null && m.value != null ? prop("➜ Heading for", int(m.forecast)) : ""}
      ${m.money != null ? prop("💰 From your work", secret(m.money)) : ""}
      ${m.plan ? prop("🧪 " + esc(m.plan.label), `${m.plan.value} of ${m.plan.of}`, m.plan.value >= m.plan.of ? "good" : "bad") : ""}
      ${(m.breakdown || []).map((b) => prop("·", esc(b))).join("")}</dl>
      ${m.note ? `<p class="t-sub" style="font-size:14.5px">${esc(m.note)}</p>` : ""}
      <p class="block-h">What moves it next</p>${rows((m.steps || []).map(nextRow), "You're clear. Nothing needs you right now.")}`;
  },
  jobs() {
    return `<div class="icon">📋</div><h2>Your job</h2>${rows(D.jobs.map((j) => `<li><span class="txt">${esc(j.label)}<span class="meta ${j.status && !j.status.ok ? "bad" : ""}">${j.status ? (j.status.ok ? "✓ " : "") + esc(j.status.value) : "Ask Manav to reconnect Instagram"}</span></span></li>`), "")}`;
  },
  team() {
    const s = D.send;
    const sw = s ? `<p class="block-h" style="margin-top:0">WhatsApp nudges</p>
      <div class="chips" data-send>${[["off", "Off"], ["manav", "Only me"], ["team", "Whole team"]].map(([k, l]) => `<button type="button" class="${s.mode === k ? "on" : ""}" data-mode="${k}">${l}</button>`).join("")}</div>
      <p class="t-sub" style="margin:-8px 0 16px">Meta's approval of the message: ${esc(String(s.template).toLowerCase())}. Nothing sends between 10pm and 8am.</p>` : "";
    const when = (x) => x.due ? (x.late ? "was due " : "by ") + day(x.due) : "no date yet";
    return `<div class="icon">🧑‍🤝‍🧑</div><h2>Team</h2>${sw}${(D.team || []).some((t) => !t.account) ? `<div class="acts" style="margin:0 0 10px"><button class="btn small green" data-links>Copy all sign-in links</button></div><p class="t-sub" data-links-out style="margin:0 0 16px;overflow-wrap:anywhere;white-space:pre-line"></p>` : ""}${rows((D.team || []).map((t) => `<li style="align-items:flex-start"><span class="txt"><b style="font-weight:600">${esc(t.name)}</b> <span class="chip ${esc(t.status.replace(/\s+/g, "-"))}">${esc(t.status)}</span>
      <span class="meta">${esc(t.title)} · ${esc(t.label || "")}</span>
      <details class="fold" style="border:0;padding:8px 0 0"><summary>What's on their dashboard</summary>
        ${t.empty ? `<p>${esc(t.empty)}</p>` : ""}${t.breakdown.map((x) => `<p>${esc(x)}</p>`).join("")}
        ${t.reading.held ? `<p>Alarm held until ${esc(day(t.reading.held))}.</p>` : t.reading.grace != null && t.reading.dark >= t.reading.grace ? `<p class="bad">No reading for ${t.reading.dark} days. ${esc(t.reading.why)} ${esc(t.reading.fallback)}</p>` : t.reading.of ? `<p>Measured on ${t.reading.read} of the last ${t.reading.of} days.</p>` : ""}
        ${t.flags.length ? `<p class="block-h">Warnings</p>${rows(t.flags.map((f) => `<li><span class="txt ${f.late ? "bad" : ""}">${esc(f.text)}</span></li>`), "")}` : ""}
        ${t.steps.length ? `<p class="block-h">Steps</p>${rows(t.steps.map((x) => `<li><span class="txt">${esc(x.title)}<span class="meta ${x.late ? "bad" : ""}">${esc(x.project)} · ${when(x)}</span></span></li>`), "")}` : ""}
        ${t.jobs.length ? `<p class="block-h">Job list</p>${rows(t.jobs.map((j) => `<li><span class="txt">${esc(j.label)}<span class="meta ${j.status && !j.status.ok ? "bad" : ""}">${j.status ? (j.status.ok ? "✓ " : "") + esc(j.status.value) : "Reconnect Instagram"}</span></span></li>`), "")}` : ""}
        <div class="acts" style="margin-top:10px">${t.account ? `<span class="t-sub">Signs in with a username</span>` : `<button class="btn small green" data-link="${esc(t.handle)}">Copy sign-in link</button><button class="linkish" data-link="${esc(t.handle)}" data-fresh="1">New link, old one stops</button>`}</div>
        <p class="t-sub" data-linked="${esc(t.handle)}" style="margin-left:0;overflow-wrap:anywhere"></p>
      </details></span>
      <span class="num-r">${t.value != null ? int(t.value) + (t.unit === "%" ? "%" : "") + (t.target ? `<small>of ${int(t.target)}${t.unit === "%" ? "%" : ""}</small>` : "") : "—"}${t.money != null ? `<small>${secret(t.money)}</small>` : ""}</span></li>`), "No one yet.")}`;
  },
  attend() {
    const a = D.attend;
    return `<div class="icon">🚀</div><h2>Catalyst attendance</h2>
      <form data-session>
        <label class="f"><span>Session day</span><input name="day" type="date" value="${esc(a.today)}" required></label>
        <p class="block-h">Who came</p>
        <div class="chips" data-came>${a.founders.map((n) => `<button type="button" data-name="${esc(n)}">${esc(n)}</button>`).join("") || `<span class="t-sub">Add the founders to the Catalyst sheet.</span>`}</div>
        <button class="btn green" type="submit">Save this session</button></form>
      <p class="block-h">Past sessions</p>
      ${rows(a.sessions.map((s) => `<li><span class="txt">${esc(s.label)}<span class="meta">${s.due.filter((n) => !s.came.includes(n)).length ? "Missed: " + esc(s.due.filter((n) => !s.came.includes(n)).join(", ")) : "Everyone came"}</span></span><span class="num-r">${s.came.length}<small>of ${s.due.length}</small></span><button class="linkish" data-unsession="${esc(s.day)}">Remove</button></li>`), "No session ticked yet.")}
      <p class="t-sub" style="margin-top:14px">The founder list comes from the Catalyst sheet, and updates every hour.</p>
      <p class="t-sub" data-attend-msg style="margin-top:10px"></p>`;
  },
  projects() {
    const ps = D.me.owner ? D.projects || [] : D.myProjects || [];
    return `<div class="icon">🗂️</div><h2>Projects</h2>${rows(ps.map((p) => `<li style="align-items:flex-start"><span class="txt">
      <b style="font-weight:600">${esc(p.title)}</b> <span class="chip ${esc(p.risk.replace(/\s+/g, "-"))}">${esc(p.risk)}</span>
      <span class="meta">${p.done} of ${p.total} steps${p.next ? ` · next: ${esc(p.next.title)} (${esc(p.next.owner)})` : ""}</span>
      <div class="pips">${p.steps.map((s) => `<i class="${s.done ? "d" : s.late ? "l" : ""}"></i>`).join("")}</div>
      <details class="fold" style="border:0;padding:8px 0 0"><summary>Steps</summary>${rows(p.steps.map((s) => `<li><span class="txt">${s.done ? "<s>" : ""}${esc(s.title)}${s.done ? "</s>" : ""}<span class="meta ${s.late ? "bad" : ""}">${esc(s.owner)} · ${s.due ? (s.late ? "was due " : "by ") + day(s.due) : "no date yet"}</span></span></li>`), "")}</details>
      ${p.status === "proposed" ? `<div class="acts"><button class="btn small green" data-decide="approve" data-id="${p.id}">Approve</button><button class="btn small ghost" data-decide="kill" data-id="${p.id}">Kill</button></div>` : ""}
      ${p.status === "paused" ? `<div class="acts"><button class="btn small green" data-decide="approve" data-id="${p.id}">Start it again</button></div>` : ""}
      ${p.status === "live" ? `<form class="inline addstep" data-project="${p.id}" style="margin-top:10px"><input name="t" placeholder="Add a step" aria-label="Add a step to ${esc(p.title)}"><input name="d" type="date" aria-label="By when" style="max-width:150px"><button class="btn small ghost">Add</button></form>` : ""}
      </span></li>`), "No projects yet. Start one with +.")}
      ${D.waiting ? `<p class="t-sub" style="margin-top:14px">${D.waiting === 1 ? "One message is" : D.waiting + " messages are"} waiting to go to the team. Nothing is sent until you say go.</p>` : ""}`;
  },
  steps() {
    return `<div class="icon">✅</div><h2>Your steps</h2>${rows(D.steps.map((s) => `<li data-step="${s.id}">
      <button class="tick" aria-label="Mark done: ${esc(s.title)}"><svg viewBox="0 0 16 16"><path d="M3 8.5l3.2 3L13 4.8"/></svg></button>
      <span class="txt">${esc(s.title)}<span class="meta ${s.late ? "bad" : ""}">${esc(s.project)} · ${s.due ? (s.late ? "was due " : "by ") + day(s.due) : "no date yet"}</span></span></li>`), "Nothing waiting on you.")}
      ${(() => { const o = (D.myProjects || []).flatMap((p) => p.steps.filter((s) => !s.done && s.owner !== D.me.handle).map((s) => ({ ...s, project: p.title })));
        return o.length ? `<p class="block-h">Someone else's turn</p>${rows(o.map((s) => `<li><span class="txt">${esc(s.title)}<span class="meta">${esc(cap(s.owner))} · ${s.due ? "by " + day(s.due) : "no date yet"}</span></span></li>`), "")}` : ""; })()}`;
  },
  coming() {
    return `<div class="icon">🗓️</div><h2>Coming up</h2>${rows(D.coming.map((c) => `<li><span class="txt">${esc(c.name)}${c.kind === "practical" ? ' <span class="chip">practical</span>' : ""}
      <span class="meta">${esc(c.day)}${c.city ? " · " + esc(c.city) : ""}</span>
      ${c.type === "room" ? `<div class="pips">${Array.from({ length: Math.min(c.chairs, 30) }, (_, i) => `<i class="${i < c.sold ? "s" : ""}"></i>`).join("")}</div>` : ""}</span>
      ${c.type === "room" ? `<span class="num-r">${c.sold}/${c.chairs}<small>chairs</small></span>` : ""}</li>`), "Add the next room in the CRM.")}`;
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
  password() {
    const first = D.account?.temp;
    return `<div class="icon">🔑</div><h2>${first ? "You're in. Pick your own password." : "Change password"}</h2>
      ${first ? `<p class="t-sub" style="font-size:14.5px">The one you just used was set for you.</p>` : ""}
      <form data-password>
        <label class="f" ${givenPw ? "hidden" : ""}><span>Current password</span><input name="old" type="password" autocomplete="current-password" value="${esc(givenPw)}" required></label>
        <label class="f"><span>New password</span><input name="pw" type="password" autocomplete="new-password" minlength="6" required></label>
        <p class="err" data-pw-msg></p><button class="btn green" type="submit">Save</button></form>
      ${first ? `<button class="linkish" data-pw-keep style="margin-top:12px">Keep this one for now</button>` : ""}`;
  },
  add() { return `<div class="icon">＋</div><h2>New project</h2><div id="addbody"></div>`; },
  website() {
    const w = D.website || {}, r = w.room || {}, l = w.learnings || [];
    return `<div class="icon">🔭</div><h2>Website</h2>
      <p class="web-from">Last 7 days. ${int(w.people)} people, ${int(w.peoplePrev)} the week before. Read fresh every 30 minutes.</p>
      <h3 class="web-h">What to do</h3>
      ${l.length ? `<ol class="web-todo">${l.map((x) => `<li class="${x.rank === 1 ? "web-bad" : ""}"><b>${esc(x.text)}</b><span>${esc(x.action)}</span></li>`).join("")}</ol>`
        : `<p class="web-from">${w.collecting ? `Nothing to conclude yet. ${int(w.soFar)} people in the last 14 days, and the first reading comes at ${w.firstReading}.` : "Nothing needs attention."}</p>`}
      <h3 class="web-h">From website to room, all time</h3>
      <p class="web-from">${int(r.applied)} applied, ${int(r.invited)} invited, ${int(r.paid)} paid, ${int(r.came)} came.</p>
      <h3 class="web-h">Where people came from</h3>
      ${(w.sources || []).length ? `<ul class="web-src">${w.sources.map((s) => `<li><span>${esc(s.name)}</span><span>${int(s.people)} people, ${int(s.applied)} applied</span></li>`).join("")}</ul>` : `<p class="web-from">Nothing yet.</p>`}
      <h3 class="web-h">Everything else</h3>
      <div class="web-ranges">${[[1, "Today"], [7, "7 days"], [30, "30 days"], [90, "90 days"]].map(([d, t]) => `<button data-report="${d}">${t}</button>`).join("")}</div>
      <p class="web-from" id="webstatus"></p><iframe id="webframe" class="web-frame" title="Full website report" sandbox hidden></iframe>`;
  },
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
    wireHomePage(page, close, paint, name);
    if (name === "add") addForm(page, close);
    page.querySelectorAll("[data-report]").forEach((b) => b.addEventListener("click", async () => {
      const f = $("#webframe", page), st = $("#webstatus", page);
      st.textContent = "Loading…";
      try { const { html } = await api("/api/website?d=" + b.dataset.report); f.srcdoc = html; f.hidden = false; st.textContent = ""; }
      catch (e) { st.textContent = e.message; }
    }));
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
  page.querySelectorAll("[data-send] [data-mode]").forEach((b) => b.onclick = async () => {
    try { await api("/api/send", { mode: b.dataset.mode }); await after(paint); } catch (e) { alert(e.message); }
  });
  page.querySelectorAll("form.addstep").forEach((f) => f.onsubmit = async (e) => {
    e.preventDefault();
    if (!f.t.value.trim()) return;
    try { await api("/api/step/add", { project: Number(f.dataset.project), title: f.t.value, due: f.d.value }); await after(paint); } catch (err) { alert(err.message); }
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
  /* Attendance: chips toggle, the list on save becomes that session's own record. */
  const attendSaved = () => { close(); refresh(); };
  page.querySelectorAll("[data-came] [data-name]").forEach((b) => b.onclick = () => b.classList.toggle("on"));
  const pwForm = page.querySelector("[data-password]");
  if (pwForm) {
    const done = () => { if (D.account) D.account.temp = false; givenPw = ""; close(); };
    pwForm.onsubmit = async (e) => {
      e.preventDefault();
      const f = new FormData(pwForm);
      try { await api("/api/password", { old: f.get("old"), pw: f.get("pw") }); done(); }
      catch (err) { pwForm.querySelector("[data-pw-msg]").textContent = err.message; }
    };
    const keep = page.querySelector("[data-pw-keep]");
    if (keep) keep.onclick = async () => { await api("/api/password", { keep: true }); done(); };
  }
  const sess = page.querySelector("[data-session]");
  if (sess) sess.onsubmit = async (e) => {
    e.preventDefault();
    const msg = page.querySelector("[data-attend-msg]");
    const came = [...page.querySelectorAll("[data-came] .on")].map((b) => b.dataset.name);
    try { await api("/api/session", { day: new FormData(sess).get("day"), came, due: D.attend.founders }); attendSaved(); }
    catch (err) { msg.textContent = err.message; }
  };
  page.querySelectorAll("[data-unsession]").forEach((b) => b.onclick = async () => { await api("/api/session", { day: b.dataset.unsession, remove: true }); attendSaved(); });
  /* Every link at once, one line per person, for him to send one by one. */
  const allLinks = page.querySelector("[data-links]");
  if (allLinks) allLinks.onclick = async () => {
    const out = page.querySelector("[data-links-out]");
    try {
      const lines = [];
      for (const t of D.team.filter((x) => !x.account)) lines.push(`${t.name}: ${(await api("/api/link", { handle: t.handle })).url}`);
      const text = lines.join("\n");
      let copied = false;
      try { await navigator.clipboard.writeText(text); copied = true; } catch {}
      out.textContent = copied ? `Copied ${lines.length} links, one line per person. Send each person only their own.` : text;
    } catch (e) { out.textContent = e.message; }
  };

  /* The sign-in link: copied for him to send. If the browser won't copy, it's shown. */
  page.querySelectorAll("[data-link]").forEach((b) => b.onclick = async () => {
    const out = page.querySelector(`[data-linked="${b.dataset.link}"]`);
    try {
      const r = await api("/api/link", { handle: b.dataset.link, fresh: !!b.dataset.fresh });
      let copied = false;
      try { await navigator.clipboard.writeText(r.url); copied = true; } catch {}
      out.textContent = copied ? `Copied. Send it to ${r.name} yourself. It opens this page signed in, and nothing else.` : r.url;
    } catch (e) { out.textContent = e.message; }
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
  const kind = "project";
  const people = [...new Set((D.team || []).map((t) => t.handle).concat(D.me.handle))];
  const stepRow = () => `<div class="steprow"><input name="st" placeholder="What"><select name="so">${people.map((h) => `<option value="${esc(h)}" ${h === D.me.handle ? "selected" : ""}>${esc(h)}</option>`).join("")}</select><input name="sd" type="date" aria-label="By when"></div>`;
  const F = {
    project: `<label class="f"><span>Project</span><input name="title" placeholder="Practicals in Surat" required></label>
      <label class="f"><span>Done looks like</span><input name="test" placeholder="First Surat practical runs with 12 people"></label>
      <label class="f"><span>Ends</span><input name="ends" type="date"></label>
      <p class="block-h" style="margin-top:4px">Steps, one owner each</p><div id="rows"></div>
      <button type="button" class="btn small ghost" id="more">+ Step</button>
      ${D.me.owner ? "" : `<p class="t-sub" style="margin-top:12px">It goes live once Manav says yes.</p>`}`,
  };
  const body = $("#addbody", page);
  const paint = () => {
    body.innerHTML = `<form id="addf">${F[kind]}<p class="err" id="adderr"></p><button class="btn green" type="submit">Add</button></form>`;
    { const r = $("#rows", body); r.innerHTML = stepRow(); $("#more", body).onclick = () => r.insertAdjacentHTML("beforeend", stepRow()); }
    $("#addf", body).onsubmit = async (e) => {
      e.preventDefault();
      const f = new FormData(e.target);
      const b = { kind, title: f.get("title"), test: f.get("test"), ends: f.get("ends") };
      { const t = f.getAll("st"), o = f.getAll("so"), dd = f.getAll("sd"); b.steps = t.map((x, i) => ({ title: x, owner: o[i], due: dd[i] })).filter((s) => s.title.trim()); }
      try { await api("/api/add", b); close(); refresh(); } catch (err) { $("#adderr", body).textContent = err.message; }
    };
  };
  paint();
}

async function refresh() { try { D = await api("/api/board"); if (D.key) store.set(D.key); draw(); } catch (e) { if (e.message !== "signed out") console.error(e); } }
function load() {
  if (!store.get()) return login();
  /* Anyone signed in here is on the team, so the website stops counting this browser as a visitor. Same origin as chemistrylabs.in. */
  try { localStorage.setItem("cl-off", "1"); } catch {}
  app.innerHTML = `<div class="wall"></div>`;
  refresh();
}
/* ── the quick-access home (15 Nov) ───────────────────────────────────────
   "Exactly like how I use on my iPhone." Tasks and What's on are widgets you
   can act on without opening them. Press and hold any tile to move, hide or add
   things, the way a phone's home screen edits. Links are app icons. Everything
   on it has a date. */
const H = () => D.home || { tasks: [], goals: [], events: [], links: [], kinds: {}, welcomed: true };
const addD = (d, n) => new Date(Date.parse(d + "T00:00:00Z") + n * 864e5).toISOString().slice(0, 10);
const when = (d) => (!d ? "No date yet" : d === D.today ? "Today" : d === addD(D.today, 1) ? "Tomorrow" : d === addD(D.today, -1) ? "Yesterday" : day(d));
const KCOL = { build: "Build Club", practical: "Practical", catalyst: "Catalyst session", reactions: "Reactions", other: "Other" };
const evName = (e) => `${e.title}${e.place ? ", " + e.place : ""}`;
const TICK = `<svg viewBox="0 0 16 16"><path d="M3 8.5l3.2 3L13 4.8"/></svg>`;
let taskFor = "", otherTasks = null, goalDraft = null, goalOpen = false, calMonth = null, calDay = null, editing = false, welcomeShown = false;

/* BUILD CLUB DATES COME FROM THE WEBSITE (16 Nov): "Everyone should see the latest build
   club calendar which is now uploaded on the website." The website's calendar reads one
   file, manavjoshi.com/js/smbc-cities.js, and so does this page, so the two never disagree.
   The CRM only adds how many seats are paid. If the file can't load, the CRM's rooms show. */
function allEvents() {
  const ev = H().events, C = window.SMBC_CITY;
  if (!C || typeof C.cities !== "function") return ev;
  const crm = ev.filter((e) => e.kind === "build");
  const from = addD(D.today, -45), to = addD(D.today, 120), site = [];
  let d = from;
  while (new Date(d + "T00:00:00Z").getUTCDay() !== 0) d = addD(d, 1);
  for (; d <= to; d = addD(d, 7)) {
    const closed = C.closedAt ? C.closedAt(d) : "";
    for (const city of C.cities(d)) {
      const room = crm.find((e) => e.day === d && (e.place || "").toLowerCase() === city.toLowerCase());
      site.push({ day: d, time: "10:00", kind: "build", title: "Build Club", place: city, crm: !!room, sold: room?.sold, chairs: room?.chairs });
    }
    if (closed) site.push({ day: d, kind: "other", title: `No Build Club: ${closed}` });
  }
  if (!site.length) return ev;
  return ev.filter((e) => e.kind !== "build").concat(site)
    .sort((a, b) => a.day.localeCompare(b.day) || String(a.time || "").localeCompare(String(b.time || "")));
}

/* Their own next steps: what they wrote, and what Manav handed them. */
function allTasks(list) {
  return (list || H().tasks).map((t) => ({ ...t, kind: "task" })).sort((a, b) => (a.due || "9999").localeCompare(b.due || "9999") || a.id - b.id);
}

/* SUGGESTED NEXT STEPS (16 Nov): "some tasks you are adding automatically so you can say
   suggested next steps." Anything the hub puts forward on its own is a suggestion: a step
   from a project, what a founder's stage says to do next, and what the person's number
   says to do next. Nothing joins their list until they add it, and anything waved away
   stays away. The tool helps; it never piles work on. */
const keyOf = (t) => { let h = 0; for (const c of t) h = (h * 31 + c.charCodeAt(0)) | 0; return "s" + (h >>> 0).toString(36); };
function suggestions() {
  const muted = new Set(H().muted || []), out = [];
  for (const s of D.steps || []) out.push({ kind: "step", id: s.id, title: s.title, due: s.due || "", from: `Step in ${s.project}`, key: "step:" + s.id });
  const f = H().founders;
  if (f) {
    const act = { call: (n) => `Book a call with ${n}`, talked: (n) => `Get a yes or a no from ${n}`, confirmed: (n) => `Make ${n}'s agreement`, sent: (n) => `Get ${n}'s agreement signed` };
    for (const x of f.list) if (act[x.stage]) { const t = act[x.stage](x.name); out.push({ kind: "sug", title: t, due: D.today, from: "From your founders", key: keyOf(t) }); }
  }
  for (const x of (D.mine?.steps || []).slice(0, 4)) {
    const t = String(x.text || "").trim(); if (!t) continue;
    out.push({ kind: "sug", title: t, due: D.today, from: "From your number", key: keyOf(t) });
  }
  return out.filter((x) => !muted.has(x.key) && !H().tasks.some((t) => !t.done && t.title === x.title));
}
async function mute(key) { (D.home.muted ||= []).push(key); try { await api("/api/home", { mute: key }); } catch (e) { alert(e.message); } }
const goalOf = (t) => (t.goal ? H().goals.find((g) => g.id === t.goal) : null);
const metaOf = (t) => [t.project && `Step in ${t.project}`, goalOf(t) && `Goal: ${goalOf(t).title}`, t.from && `From ${t.from}`].filter(Boolean).join(" · ");

function tasksTile() {
  const open = allTasks().filter((t) => !t.done), sug = suggestions();
  const late = open.filter((t) => t.due && t.due < D.today).length, today = open.filter((t) => t.due === D.today).length;
  const top = open.slice(0, 4), fill = sug.slice(0, Math.max(0, 4 - top.length));
  return `<div class="tile w4 h2 tasks" data-open="tasks" role="button" tabindex="0">
    <span class="t-label"><em>✅</em>Next steps<span class="tk-count">${late ? `<b class="bad">${late} late</b> · ` : ""}${today} today${sug.length ? ` · ${sug.length} suggested` : ""}</span></span>
    <ul class="tk-list">${top.map((t) => `<li class="${t.due < D.today ? "late" : ""}"><button class="tick mini" data-tick="${t.kind}:${t.id}" aria-label="Mark done: ${esc(t.title)}">${TICK}</button>
      <span class="tk-t">${esc(t.title)}<small>${esc(when(t.due))}${t.from ? " · From " + esc(t.from) : ""}</small></span></li>`).join("")}
      ${fill.map((x) => `<li class="sug"><span class="sug-dot" aria-hidden="true"></span><span class="tk-t">${esc(x.title)}<small>Suggested · ${esc(x.from.replace(/^From /, "from "))}</small></span></li>`).join("")}
      ${!top.length && !fill.length ? `<li class="tk-empty">Nothing due. Tap to add your next step, or write down a big goal and get suggested steps for it.</li>` : ""}</ul>
    ${open.length > top.length ? `<span class="t-sub">${open.length - top.length} more</span>` : ""}</div>`;
}

function eventsTile() {
  if (D.me.external) return "";
  const ev = allEvents(), days = [...Array(7)].map((_, i) => addD(D.today, i));
  const next = ev.filter((e) => e.day >= D.today).slice(0, 3);
  return `<button class="tile w4 h2 whats" data-open="events"><span class="t-label"><em>🗓️</em>What's on</span>
    <span class="wk">${days.map((d) => { const t = new Date(d + "T00:00:00Z"), es = ev.filter((e) => e.day === d);
      return `<span class="wd${d === D.today ? " now" : ""}"><small>${WD[t.getUTCDay()]}</small><b>${t.getUTCDate()}</b><i>${es.slice(0, 3).map((e) => `<u class="k-${e.kind}"></u>`).join("")}</i></span>`; }).join("")}</span>
    <span class="up">${next.map((e) => `<span class="up-r"><u class="k-${e.kind}"></u><span>${esc(evName(e))}</span><small>${esc(when(e.day))}${e.time ? " " + esc(e.time) : ""}</small></span>`).join("")
      || `<span class="t-sub">Nothing on the calendar yet. Tap to add the next thing.</span>`}</span></button>`;
}

function foundersTile() {
  const f = H().founders; if (!f) return "";
  const live = f.stages.filter((s) => s.key !== "declined"), n = (k) => f.list.filter((x) => x.stage === k).length;
  const first = live.find((s) => s.next && n(s.key));
  return `<button class="tile w4 founders" data-open="founders"><span class="t-label"><em>🚀</em>Catalyst founders<span class="tk-count">${n("signed")} signed</span></span>
    <span class="fbar">${live.map((s) => n(s.key) ? `<i class="st-${s.key}" style="flex:${n(s.key)}"></i>` : "").join("")}</span>
    <span class="t-sub">${first ? `Next: ${esc(first.next.toLowerCase())}, ${n(first.key)} ${n(first.key) === 1 ? "founder" : "founders"}` : "Every founder has signed or declined."} · ${live.filter((s) => n(s.key)).map((s) => `${n(s.key)} ${s.label.toLowerCase()}`).join(", ")}</span></button>`;
}

const linkTile = (l) => `<a class="tile app" data-tile="link:${esc(l.id)}" href="${esc(l.url)}" target="_blank" rel="noopener"><span class="app-ic">${esc(l.icon || "🔗")}</span><span class="app-l">${esc(l.label)}</span></a>`;

/* Which tiles exist for this person, and the order they start in. Saved layouts win. */
function homeTiles(d) {
  const owner = d.me.owner;
  const base = owner
    ? ["people", "revenue", "alarm", "tasks", "events", "website", "social", "team", "projects", "founders", "room", "steps", "attend", "agreements", "reactions", "crm", "add"]
    : d.me.external ? ["mine", "alarm", "social", "jobs", "steps"]
    : d.cal ? ["people", "mine", "alarm", "tasks", "events", "social", "reactions", "crm", "room", "jobs", "steps", "add"]
    : ["people", "mine", "alarm", "tasks", "founders", "events", "attend", "contacts", "agreements", "reactions", "crm", "room", "jobs", "steps", "add"];
  const make = { people: peopleTile, revenue: revenueTile, mine: mineTile, alarm: alarmTile, website: websiteTile, social: () => calTile(owner),
    team: teamTile, projects: projectsTile, room: roomTile, steps: () => stepsTile(true), attend: attendTile, contacts: contactsTile,
    agreements: agreementsTile, reactions: reactionsTile, crm: crmTile, jobs: jobTile, add: addTile, tasks: d.me.external ? () => "" : tasksTile, events: eventsTile, founders: foundersTile };
  const html = {};
  for (const id of base) {
    let h = ""; try { h = make[id]() || ""; } catch (e) { console.error(id, e); }
    if (h) html[id] = h.replace(/class="tile/, `data-tile="${id}" class="tile`);
  }
  if (!d.me.external) for (const l of H().links) html["link:" + l.id] = linkTile(l);
  const ids = Object.keys(html);
  const saved = H().layout;
  /* Your steps now sit inside Tasks, so a teammate starts without the separate tile. */
  const hidden = new Set(saved ? saved.hidden : owner ? [] : ["steps"]);
  const fresh = ids.filter((x) => x !== "add").concat(html.add ? ["add"] : []);
  const order = saved ? saved.order.filter((x) => html[x]).concat(fresh.filter((x) => !saved.order.includes(x))) : fresh;
  return { html, order: order.filter((x) => !hidden.has(x)), hidden: ids.filter((x) => hidden.has(x)) };
}
const TILE_NAMES = { people: "People in rooms", revenue: "Revenue", mine: "Your number", alarm: "What needs you", website: "Website this week", social: "Social calendar",
  team: "Team", projects: "Projects", room: "Next room", steps: "Your steps", attend: "Catalyst attendance", contacts: "Catalyst contacts sheet",
  agreements: "Contract generator", reactions: "Reactions forms", crm: "CRM", jobs: "Job list", add: "New project", tasks: "Next steps", events: "What's on", founders: "Catalyst founders" };

async function saveLayout(order, hidden) {
  D.home.layout = { order, hidden };
  try { await api("/api/home", { layout: D.home.layout }); } catch (e) { alert(e.message); }
}
async function saveLinks(links) {
  D.home.links = links; draw();
  try { await api("/api/home", { links }); } catch (e) { alert(e.message); }
}

/* ── wiring the home: ticks on the widget, press and hold to edit, drag to move ── */
let swallow = false;
function wireHome() {
  const grid = $(".grid", app); if (!grid) return;
  grid.querySelectorAll("[data-tick]").forEach((b) => b.addEventListener("click", async (e) => {
    e.stopPropagation(); e.preventDefault();
    if (editing) return;
    const [kind, id] = b.dataset.tick.split(":");
    b.classList.add("on"); if (navigator.vibrate) navigator.vibrate(10);
    const li = b.closest("li"); if (li) li.classList.add("going");
    try { await api(kind === "step" ? "/api/step" : "/api/task", { id: Number(id), done: true }); setTimeout(refresh, 380); } catch (err) { alert(err.message); b.classList.remove("on"); }
  }));
  grid.querySelectorAll("[data-tile]").forEach((el) => el.addEventListener("pointerdown", (e) => press(e, el, grid)));
  grid.querySelectorAll("[data-minus]").forEach((b) => b.addEventListener("click", (e) => { e.stopPropagation(); e.preventDefault(); minus(b.dataset.minus); }));
}
/* Clicks that end a press-and-hold, or land on a tile while editing, do nothing. */
app.addEventListener("click", (e) => {
  if (swallow) { swallow = false; e.preventDefault(); e.stopPropagation(); return; }
  if (!editing) return;
  const t = e.target.closest("[data-tile]");
  if (!t || e.target.closest("[data-minus]")) return;
  e.preventDefault(); e.stopPropagation();
  if (t.dataset.tile.startsWith("link:")) open("link", t, t.dataset.tile.slice(5));
}, true);
app.addEventListener("contextmenu", (e) => { if (e.target.closest("[data-tile]")) e.preventDefault(); });
let drag = null;
document.addEventListener("touchmove", (e) => { if (drag?.on) e.preventDefault(); }, { passive: false });

function press(e, el, grid) {
  if (e.button > 0 || e.target.closest("[data-minus]")) return;
  const x0 = e.clientX, y0 = e.clientY, touch = e.pointerType !== "mouse";
  const st = { el, x0, y0, on: false, moved: false, id: e.pointerId };
  drag = st;
  /* Not editing: a long press opens edit mode. Editing: a short hold (touch) or a small move (mouse) picks the tile up. */
  st.timer = setTimeout(() => {
    if (st.moved) return;
    if (!editing) { swallow = true; if (navigator.vibrate) navigator.vibrate(15); enterEdit(); drag = null; return; }
    if (touch) pickUp(st);
  }, editing ? 160 : 520);
  const move = (ev) => {
    if (ev.pointerId !== st.id) return;
    const dx = ev.clientX - x0, dy = ev.clientY - y0;
    if (!st.on) {
      if (Math.hypot(dx, dy) > 8) { st.moved = true; if (editing && !touch) pickUp(st); else if (!st.on) clearTimeout(st.timer); }
      if (!st.on) return;
    }
    follow(st, ev, grid);
  };
  const up = (ev) => {
    if (ev.pointerId !== st.id) return;
    clearTimeout(st.timer);
    removeEventListener("pointermove", move); removeEventListener("pointerup", up); removeEventListener("pointercancel", up);
    if (st.on) drop(st, grid);
    drag = null;
    /* The click that ends a hold or a drag is swallowed; nothing after it is. */
    if (swallow) setTimeout(() => { swallow = false; }, 60);
  };
  addEventListener("pointermove", move); addEventListener("pointerup", up); addEventListener("pointercancel", up);
}
function pickUp(st) {
  st.on = true; swallow = true;
  const r = st.el.getBoundingClientRect();
  st.gx = st.x0 - r.left; st.gy = st.y0 - r.top;
  st.el.classList.add("lifted");
  if (navigator.vibrate) navigator.vibrate(8);
}
function follow(st, ev, grid) {
  const el = st.el;
  const others = [...grid.querySelectorAll("[data-tile]")].filter((x) => x !== el);
  const over = others.find((o) => { const r = o.getBoundingClientRect(); return ev.clientX > r.left && ev.clientX < r.right && ev.clientY > r.top && ev.clientY < r.bottom; });
  if (over && over !== st.last) {
    st.last = over;
    const before = new Map(others.map((o) => [o, o.getBoundingClientRect()]));
    const all = [...grid.querySelectorAll("[data-tile]")];
    if (all.indexOf(el) > all.indexOf(over)) grid.insertBefore(el, over); else grid.insertBefore(el, over.nextSibling);
    /* The others slide to their new places instead of jumping. */
    if (motion) for (const o of others) {
      const a = before.get(o), b = o.getBoundingClientRect();
      if (a.left === b.left && a.top === b.top) continue;
      o.style.transition = "none"; o.style.translate = `${a.left - b.left}px ${a.top - b.top}px`;
      requestAnimationFrame(() => { o.style.transition = ""; o.style.translate = ""; });
    }
  } else if (!over) st.last = null;
  el.style.translate = "0 0";
  const r = el.getBoundingClientRect();
  el.style.translate = `${ev.clientX - st.gx - r.left}px ${ev.clientY - st.gy - r.top}px`;
}
function drop(st, grid) {
  st.el.classList.remove("lifted");
  st.el.style.translate = "";
  const order = [...grid.querySelectorAll("[data-tile]")].map((x) => x.dataset.tile);
  const t = homeTiles(D);
  saveLayout(order.concat(t.hidden.filter((x) => !order.includes(x))).filter((x, i, a) => a.indexOf(x) === i), t.hidden);
}
function enterEdit() { editing = true; draw(); }
function leaveEdit() { editing = false; draw(); }
function minus(id) {
  if (id.startsWith("link:")) {
    const l = H().links.find((x) => "link:" + x.id === id);
    if (l && confirm(`Remove the ${l.label} link?`)) saveLinks(H().links.filter((x) => x !== l));
    return;
  }
  const t = homeTiles(D);
  saveLayout(t.order.filter((x) => x !== id), t.hidden.concat(id));
  draw();
}

/* ── pages ── */
function taskRow(t) {
  const late = t.due && t.due < D.today && !t.done;
  return `<li class="tk-row${t.done ? " done" : ""}" data-task="${t.kind}:${t.id}">
    <button class="tick${t.done ? " on" : ""}" data-done aria-label="${t.done ? "Mark not done" : "Mark done"}: ${esc(t.title)}">${TICK}</button>
    <span class="txt">${t.kind === "task" ? `<span class="tk-title" data-edit tabindex="0">${esc(t.title)}</span>` : esc(t.title)}
      ${metaOf(t) ? `<span class="meta">${esc(metaOf(t))}</span>` : ""}</span>
    ${t.kind === "task" ? `<label class="when${late ? " bad" : ""}">${esc(when(t.due))}<input type="date" value="${esc(t.due)}" data-due aria-label="Change the date"></label>
      <button class="x" data-remove aria-label="Delete: ${esc(t.title)}">×</button>` : `<span class="when${late ? " bad" : ""}">${esc(when(t.due))}</span>`}</li>`;
}
function bucketed(list) {
  const open = list.filter((t) => !t.done), wk = addD(D.today, 6);
  const groups = [
    ["Late", open.filter((t) => t.due && t.due < D.today)],
    ["Today", open.filter((t) => t.due === D.today)],
    ["This week", open.filter((t) => t.due > D.today && t.due <= wk)],
    ["Later", open.filter((t) => t.due > wk)],
    ["Done", list.filter((t) => t.done)],
  ].filter(([, g]) => g.length);
  return groups.map(([h, g]) => `<p class="block-h${h === "Late" ? " bad" : ""}">${h}</p><ul class="rows tk-rows">${g.map(taskRow).join("")}</ul>`).join("")
    || `<p class="t-sub" style="padding:10px 0">Nothing on your list yet. Add the first thing you'll do, with its day.</p>`;
}

Object.assign(PAGES, {
  tasks() {
    const owner = D.me.owner, people = H().people || [];
    const list = taskFor && otherTasks ? allTasks(otherTasks) : allTasks();
    const whose = taskFor ? people.find((p) => p.handle === taskFor)?.name || taskFor : "";
    const g = goalDraft;
    const sug = taskFor ? [] : suggestions();
    return `<div class="icon">✅</div><h2>${whose ? `${esc(whose.split(" ")[0])}'s next steps` : "Next steps"}</h2>
      ${owner && people.length ? `<div class="chips" data-for>${[["", "Mine"], ...people.map((p) => [p.handle, p.name.split(" ")[0]])].map(([h, n]) => `<button type="button" class="${taskFor === h ? "on" : ""}" data-h="${h}">${esc(n)}</button>`).join("")}</div>` : ""}
      <form class="tk-add" data-addtask><input name="t" placeholder="${whose ? `Add a next step for ${esc(whose.split(" ")[0])}` : "Add your next step"}" autocomplete="off" maxlength="160" required>
        <input name="d" type="date" value="${esc(D.today)}" min="${esc(D.today)}" required aria-label="Due date"><button class="btn green small">Add</button></form>
      <p class="err" data-taskerr></p>
      <div class="goalbox${goalOpen ? " open" : ""}">
        <button type="button" class="goal-h" data-goaltoggle><span>🎯</span><b>Break down a big goal</b><small>${goalOpen ? "Close" : "Get suggested next steps, each with a date"}</small></button>
        ${goalOpen ? `<form data-goalform><label class="f"><span>The goal</span><input name="g" value="${esc(g?.title || "")}" placeholder="Run three practicals in December" maxlength="200" required></label>
          <label class="f"><span>Deadline</span><input name="gd" type="date" value="${esc(g?.due || addD(D.today, 21))}" min="${esc(addD(D.today, 1))}" required></label>
          <button class="btn small" ${g?.loading ? "disabled" : ""}>${g?.loading ? "Breaking it down…" : g?.tasks ? "Break it down again" : "Break it down"}</button></form>
          <p class="err">${esc(g?.err || "")}</p>
          ${g?.tasks ? `<p class="block-h">Suggested next steps. Keep, change or drop any of them</p><div data-draft>${g.tasks.map((t, i) => `<div class="draft" data-i="${i}">
            <input value="${esc(t.title)}" data-dt maxlength="160" aria-label="Step ${i + 1}"><input type="date" value="${esc(t.due)}" data-dd min="${esc(D.today)}" max="${esc(g.due)}" aria-label="Date for task ${i + 1}">
            <button type="button" class="x" data-drop aria-label="Drop this one">×</button></div>`).join("")}</div>
            <div class="acts"><button class="btn green" data-keep>Add ${g.tasks.length} ${g.tasks.length === 1 ? "step" : "steps"}</button></div>` : ""}` : ""}
      </div>
      ${sug.length ? `<p class="block-h">Suggested next steps</p><ul class="rows sug-rows">${sug.map((x) => `<li data-sug="${esc(x.key)}">
        <span class="txt">${esc(x.title)}<span class="meta">${esc(x.from)}</span></span>
        ${x.kind === "step" ? `<span class="when${x.due && x.due < D.today ? " bad" : ""}">${esc(when(x.due))}</span><button class="tick" data-stepdone="${x.id}" aria-label="Mark done: ${esc(x.title)}">${TICK}</button>`
          : `<label class="when">${esc(when(x.due))}<input type="date" value="${esc(x.due)}" min="${esc(D.today)}" data-sdue aria-label="Pick its day"></label><button class="btn small" data-take>Add</button><button class="x" data-mute aria-label="Not now">×</button>`}</li>`).join("")}</ul>` : ""}
      ${bucketed(list)}
      ${!taskFor && H().goals.length ? `<p class="block-h">Goals</p><ul class="rows">${H().goals.map((x) => `<li><span class="txt">${esc(x.title)}<span class="meta">By ${esc(day(x.due))} · ${x.done} of ${x.total} done${x.by && x.by !== D.me.handle ? " · from Manav" : ""}</span></span>
        <span class="ring-s" style="--p:${x.total ? x.done / x.total : 0}"></span><button class="x" data-goaldel="${x.id}" aria-label="Delete the goal ${esc(x.title)}">×</button></li>`).join("")}</ul>` : ""}`;
  },

  events() {
    const ev = allEvents();
    if (!calMonth) calMonth = D.today.slice(0, 7);
    if (!calDay) calDay = D.today;
    const [y, m] = calMonth.split("-").map(Number);
    const first = `${calMonth}-01`, lead = (new Date(first + "T00:00:00Z").getUTCDay() + 6) % 7;
    const len = new Date(Date.UTC(y, m, 0)).getUTCDate();
    const cells = [...Array(lead)].map(() => `<span></span>`).concat([...Array(len)].map((_, i) => {
      const d = `${calMonth}-${String(i + 1).padStart(2, "0")}`, es = ev.filter((e) => e.day === d);
      return `<button type="button" class="cd${d === D.today ? " now" : ""}${d === calDay ? " sel" : ""}${d < D.today ? " past" : ""}" data-cd="${d}"><b>${i + 1}</b><i>${es.slice(0, 3).map((e) => `<u class="k-${e.kind}"></u>`).join("")}</i></button>`;
    }));
    const onDay = ev.filter((e) => e.day === calDay);
    const ahead = ev.filter((e) => e.day >= D.today).slice(0, 12);
    const row = (e) => `<li><u class="kbar k-${e.kind}"></u><span class="txt">${esc(evName(e))}<span class="meta">${esc(KCOL[e.kind] || e.kind)}${e.time ? " · " + esc(e.time) : ""}${e.chairs ? ` · ${e.sold} of ${e.chairs} paid` : e.crm ? " · from the CRM" : ""}</span></span>
      ${e.mine && e.id ? `<button class="x" data-evdel="${e.id}" aria-label="Take ${esc(e.title)} off the calendar">×</button>` : ""}</li>`;
    const mName = new Date(first + "T00:00:00Z").toLocaleString("en-GB", { month: "long", year: "numeric", timeZone: "UTC" });
    return `<div class="icon">🗓️</div><h2>What's on</h2>
      <div class="legend">${Object.entries(KCOL).filter(([k]) => k !== "other").map(([k, n]) => `<span><u class="k-${k}"></u>${n}</span>`).join("")}</div>
      <div class="mhead"><button type="button" class="linkish" data-mv="-1" aria-label="Last month">‹</button><b>${esc(mName)}</b><button type="button" class="linkish" data-mv="1" aria-label="Next month">›</button></div>
      <div class="mgrid">${["M", "T", "W", "T", "F", "S", "S"].map((x) => `<small>${x}</small>`).join("")}${cells.join("")}</div>
      <p class="block-h">${esc(when(calDay))}${calDay !== D.today && calDay !== addD(D.today, 1) ? "" : ", " + esc(day(calDay))}</p>
      ${onDay.length ? `<ul class="rows">${onDay.map(row).join("")}</ul>` : `<p class="t-sub">Nothing on this day.</p>`}
      <details class="fold add-ev"${ev.length ? "" : " open"}><summary>Add to the calendar</summary>
        <form data-addev><div class="chips" data-kind>${Object.entries(KCOL).map(([k, n]) => `<button type="button" data-k="${k}" class="${k === "reactions" ? "on" : ""}">${n}</button>`).join("")}</div>
          <label class="f"><span>What</span><input name="title" placeholder="Reactions: Saturday breakfast" maxlength="100" required></label>
          <div class="steprow"><input name="day" type="date" value="${esc(calDay >= D.today ? calDay : D.today)}" required aria-label="Day"><input name="time" type="time" aria-label="Time"></div>
          <label class="f"><span>Where (optional)</span><input name="place" maxlength="80" placeholder="Ahmedabad, or online"></label>
          <p class="err" data-everr></p><button class="btn green">Add it</button></form>
        <p class="t-sub">Build Clubs come from the website's calendar and practicals from the CRM, on their own. Add anything else: Reactions, Catalyst sessions, team days.</p></details>
      <p class="block-h">Coming up</p>${ahead.length ? `<ul class="rows">${ahead.map((e) => row({ ...e, title: `${when(e.day)} · ${e.title}` })).join("")}</ul>` : `<p class="t-sub">Nothing ahead yet.</p>`}`;
  },

  founders() {
    const f = H().founders, sheet = D.attend?.sheet;
    const by = (k) => f.list.filter((x) => x.stage === k);
    return `<div class="icon">🚀</div><h2>Catalyst founders</h2>
      <div class="fstrip">${f.stages.map((s) => `<span class="st-${s.key}"><b>${by(s.key).length}</b><small>${esc(s.label)}</small></span>`).join("")}</div>
      ${f.stages.filter((s) => by(s.key).length).map((s) => `<p class="block-h"><i class="sdot st-${s.key}"></i>${esc(s.label)}${s.next ? ` · next: ${esc(s.next.toLowerCase())}` : ""}</p>
        <ul class="rows">${by(s.key).map((x) => `<li><span class="txt">${esc(x.name)}<span class="meta">${esc([x.company, x.city].filter(Boolean).join(" · "))}${x.terms ? ` · ${esc(x.terms)}` : ""}</span></span>
          ${s.key === "confirmed" && D.agreements ? `<button class="btn small" data-agree>Agreement</button>` : ""}</li>`).join("")}</ul>`).join("")}
      <div class="acts">${sheet ? `<a class="btn small" href="${esc(sheet)}" target="_blank" rel="noopener">Open the sheet ↗</a>` : ""}${D.agreements ? `<button class="btn small ghost" data-agree>New agreement</button>` : ""}
        <button class="btn small ghost" data-fsync>Read the sheet now</button></div>
      ${fold("How a founder moves", `This reads the Status column of the contacts sheet${f.at ? `, last at ${esc(new Date(f.at).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }))}` : ""}. Write one of these in it and they move here: <b>scheduled</b>, <b>talked</b>, <b>confirmed</b>, <b>contract sent</b>, <b>signed</b>, or <b>not joining</b>. A blank status means they still need a call.`)}`;
  },

  homeadd() {
    const t = homeTiles(D);
    return `<div class="icon">➕</div><h2>Add to your home</h2>
      ${t.hidden.length ? `<p class="block-h">Tiles you've hidden</p><ul class="rows">${t.hidden.map((id) => `<li><span class="txt">${esc(TILE_NAMES[id] || id)}</span><button class="btn small" data-show="${esc(id)}">Add</button></li>`).join("")}</ul>` : ""}
      <p class="block-h">A link you use often</p>
      <form data-addlink><label class="f"><span>Name</span><input name="label" maxlength="28" placeholder="Practicals sheet" required></label>
        <label class="f"><span>Link</span><input name="url" inputmode="url" autocapitalize="none" placeholder="https://" required></label>
        <label class="f"><span>Icon (one emoji, optional)</span><input name="icon" maxlength="8" placeholder="📄"></label>
        <p class="err" data-linkerr></p><button class="btn green">Add the link</button></form>`;
  },

  link(id) {
    const l = H().links.find((x) => x.id === id); if (!l) return `<h2>That link is gone.</h2>`;
    return `<div class="icon">${esc(l.icon || "🔗")}</div><h2>Edit link</h2>
      <form data-editlink="${esc(id)}"><label class="f"><span>Name</span><input name="label" value="${esc(l.label)}" maxlength="28" required></label>
        <label class="f"><span>Link</span><input name="url" inputmode="url" autocapitalize="none" value="${esc(l.url)}" required></label>
        <label class="f"><span>Icon</span><input name="icon" value="${esc(l.icon || "")}" maxlength="8"></label>
        <div class="acts"><button class="btn green">Save</button><button type="button" class="btn ghost" data-dellink>Remove</button></div></form>`;
  },
});

/* Each page's own wiring, run after every paint. */
function wireHomePage(page, close, paint, name) {
  const redo = async () => { D = await api("/api/board"); if (taskFor) otherTasks = (await api("/api/tasks?for=" + taskFor)).tasks; draw(); paint(); };
  if (name === "tasks") {
    page.querySelectorAll("[data-for] button").forEach((b) => b.onclick = async () => {
      taskFor = b.dataset.h; otherTasks = taskFor ? (await api("/api/tasks?for=" + taskFor)).tasks : null; goalDraft = null; paint();
    });
    const add = $("[data-addtask]", page);
    add.onsubmit = async (e) => {
      e.preventDefault();
      try { await api("/api/task/add", { title: add.t.value, due: add.d.value, for: taskFor }); await redo(); $("[data-addtask] input", page)?.focus(); }
      catch (err) { $("[data-taskerr]", page).textContent = err.message; }
    };
    $("[data-goaltoggle]", page).onclick = () => { goalOpen = !goalOpen; paint(); };
    const gf = $("[data-goalform]", page);
    if (gf) gf.onsubmit = async (e) => {
      e.preventDefault();
      goalDraft = { title: gf.g.value.trim(), due: gf.gd.value, loading: true }; paint();
      try { const r = await api("/api/goal/plan", { title: goalDraft.title, due: goalDraft.due, for: taskFor }); goalDraft = { ...goalDraft, loading: false, tasks: r.tasks }; }
      catch (err) { goalDraft = { ...goalDraft, loading: false, err: err.message }; }
      paint();
    };
    const sync = () => page.querySelectorAll("[data-draft] .draft").forEach((row) => {
      const t = goalDraft.tasks[Number(row.dataset.i)]; t.title = $("[data-dt]", row).value; t.due = $("[data-dd]", row).value;
    });
    page.querySelectorAll("[data-drop]").forEach((b) => b.onclick = () => { sync(); goalDraft.tasks.splice(Number(b.closest(".draft").dataset.i), 1); paint(); });
    const keep = $("[data-keep]", page);
    if (keep) keep.onclick = async () => {
      sync();
      try { await api("/api/goal", { title: goalDraft.title, due: goalDraft.due, tasks: goalDraft.tasks, for: taskFor }); goalDraft = null; goalOpen = false; await redo(); }
      catch (err) { alert(err.message); }
    };
    page.querySelectorAll("[data-task]").forEach((li) => {
      const [kind, id] = li.dataset.task.split(":"), path = kind === "step" ? "/api/step" : "/api/task";
      $("[data-done]", li).onclick = async (e) => {
        const b = e.currentTarget, on = !b.classList.contains("on"); b.classList.toggle("on", on);
        if (on && navigator.vibrate) navigator.vibrate(10);
        try { await api(path, { id: Number(id), done: on }); setTimeout(redo, 300); } catch (err) { alert(err.message); }
      };
      const due = $("[data-due]", li);
      if (due) due.onchange = async () => { try { await api("/api/task", { id: Number(id), due: due.value }); await redo(); } catch (err) { alert(err.message); } };
      const rm = $("[data-remove]", li);
      if (rm) rm.onclick = async () => { li.classList.add("going"); try { await api("/api/task", { id: Number(id), remove: true }); setTimeout(redo, 250); } catch (err) { alert(err.message); } };
      const ed = $("[data-edit]", li);
      if (ed) ed.onclick = () => {
        const inp = document.createElement("input"); inp.value = ed.textContent; inp.maxLength = 160; inp.className = "tk-in"; ed.replaceWith(inp); inp.focus();
        const save = async () => { inp.onblur = null; const v = inp.value.trim(); if (v && v !== ed.textContent) { try { await api("/api/task", { id: Number(id), title: v }); } catch (err) { alert(err.message); } } redo(); };
        inp.onblur = save; inp.onkeydown = (e) => { if (e.key === "Enter") inp.blur(); if (e.key === "Escape") { inp.onblur = null; paint(); } };
      };
    });
    page.querySelectorAll("[data-sug]").forEach((li) => {
      const x = suggestions().find((y) => y.key === li.dataset.sug); if (!x) return;
      const take = $("[data-take]", li), m = $("[data-mute]", li), sd = $("[data-sdue]", li), done = $("[data-stepdone]", li);
      if (sd) sd.onchange = () => { x.due = sd.value; sd.parentNode.firstChild.textContent = when(sd.value); };
      if (take) take.onclick = async () => {
        try { await api("/api/task/add", { title: x.title, due: sd?.value || D.today }); await mute(x.key); await redo(); } catch (err) { alert(err.message); }
      };
      if (m) m.onclick = async () => { li.classList.add("going"); await mute(x.key); setTimeout(() => { draw(); paint(); }, 250); };
      if (done) done.onclick = async () => { done.classList.add("on"); try { await api("/api/step", { id: Number(done.dataset.stepdone), done: true }); setTimeout(redo, 300); } catch (err) { alert(err.message); } };
    });
    page.querySelectorAll("[data-goaldel]").forEach((b) => b.onclick = async () => {
      if (!confirm("Delete this goal and its open steps? Steps already done stay done.")) return;
      try { await api("/api/goal/remove", { id: Number(b.dataset.goaldel) }); await redo(); } catch (err) { alert(err.message); }
    });
  }
  if (name === "events") {
    page.querySelectorAll("[data-mv]").forEach((b) => b.onclick = () => {
      const [y, m] = calMonth.split("-").map(Number), d = new Date(Date.UTC(y, m - 1 + Number(b.dataset.mv), 1));
      calMonth = d.toISOString().slice(0, 7); paint();
    });
    page.querySelectorAll("[data-cd]").forEach((b) => b.onclick = () => { calDay = b.dataset.cd; paint(); });
    let kind = "reactions";
    page.querySelectorAll("[data-kind] button").forEach((b) => b.onclick = () => {
      kind = b.dataset.k; page.querySelectorAll("[data-kind] button").forEach((x) => x.classList.toggle("on", x === b));
    });
    const f = $("[data-addev]", page);
    f.onsubmit = async (e) => {
      e.preventDefault();
      try { await api("/api/event/add", { kind, title: f.title.value, day: f.day.value, time: f.time.value, place: f.place.value }); calDay = f.day.value; calMonth = calDay.slice(0, 7); await redo(); }
      catch (err) { $("[data-everr]", page).textContent = err.message; }
    };
    page.querySelectorAll("[data-evdel]").forEach((b) => b.onclick = async () => {
      try { await api("/api/event/remove", { id: Number(b.dataset.evdel) }); await redo(); } catch (err) { alert(err.message); }
    });
  }
  if (name === "founders") {
    page.querySelectorAll("[data-agree]").forEach((b) => b.onclick = openAgreements);
    const s = $("[data-fsync]", page);
    if (s) s.onclick = async () => { s.textContent = "Reading…"; try { await api("/api/home/founders", {}); await redo(); } catch (err) { alert(err.message); } };
  }
  if (name === "homeadd") {
    page.querySelectorAll("[data-show]").forEach((b) => b.onclick = async () => {
      const t = homeTiles(D), id = b.dataset.show;
      await saveLayout(t.order.concat(id), t.hidden.filter((x) => x !== id)); draw(); paint();
    });
    const f = $("[data-addlink]", page);
    f.onsubmit = async (e) => {
      e.preventDefault();
      let url = f.url.value.trim(); if (!/^https?:\/\//i.test(url)) url = "https://" + url;
      const l = { id: Math.random().toString(36).slice(2, 9), label: f.label.value.trim(), url, icon: f.icon.value.trim() || "🔗" };
      await saveLinks(H().links.concat(l)); close();
    };
  }
  if (name === "link") {
    const f = $("[data-editlink]", page); if (!f) return;
    const id = f.dataset.editlink;
    f.onsubmit = async (e) => {
      e.preventDefault();
      let url = f.url.value.trim(); if (!/^https?:\/\//i.test(url)) url = "https://" + url;
      await saveLinks(H().links.map((l) => (l.id === id ? { ...l, label: f.label.value.trim(), url, icon: f.icon.value.trim() || "🔗" } : l))); close();
    };
    $("[data-dellink]", page).onclick = async () => { await saveLinks(H().links.filter((l) => l.id !== id)); close(); };
  }
}

/* ── the tour: the first time they sign in, and any time from "How this works" ──
   16 Nov, his brief: handwritten (Schoolbell), demonstrative, on the screen itself with
   the rest blurred, never in blocks. Someone who has no idea what link they were sent
   should finish it knowing why this exists, and what their own superpowers are here.
   So it points at their real tiles, one at a time, and shows the moves. */
const GOAL_DEMO = {
  umang: ["Get every confirmed founder signed", ["Call the founders still to talk", "Send each agreement as a PDF", "Collect every signature"]],
  arpita: ["Run three practicals in December", ["Message experts about December dates", "Fix date and price on a call", "Put all three on the website"]],
  isha: ["Fill every Sunday by Friday", ["Rate every new entry before 7pm", "Send 50 invites by Wednesday", "Chase the yes-but-unpaid on Thursday"]],
  asiya: ["A story from every Build Club this month", ["Ask for photos on Sunday", "Post the story by 9pm", "Reply to every comment within 4 hours"]],
};
const goalDemo = () => GOAL_DEMO[D.me.handle] || ["Launch the next Catalyst cohort", ["Fix the dates with the founders", "Open applications on the website", "Pick the founders"]];
const hand = (t) => `<span class="hw">${t}</span>`;

function tourSteps() {
  const d = D, name = d.me.name.split(" ")[0], has = (id) => app.querySelector(`[data-tile="${id}"]`);
  const crmLine = { Practicals: "Add a practical's date here and it lands on everyone's calendar.", "Venture Catalyst": "It shows Catalyst applications only, so you see just what you work on.",
    "CRM and WhatsApp": "Rate every entry and send the invites, already signed in.", "Social media and creative ops": "Everyone who has applied, and every invite, already signed in." }[d.me.title] || "Already signed in. Tap and you're there.";
  /* One handwritten aside per step, never more: Schoolbell is a sprinkle (16 Nov). */
  const s = [{ h: `Hey ${name} 👋`, p: ["This is your Chemistry Labs dashboard. I built it to help you do your work better and faster.",
    "Everything you work on sits here, on your phone: what to do next, what's coming up, and every link you need. No more hunting through chats.",
    "Here's what it can do for you."], aside: "— Manav" }];
  if (has("tasks")) {
    const [g, steps] = goalDemo();
    s.push({ sel: "tasks", h: "Your next steps", p: ["Everything here has a day. Tick it off right from the home screen."], aside: "tap the circle when it's done" });
    s.push({ sel: "tasks", h: "Suggested next steps", p: ["The hub reads your work and suggests what to do next: from your projects, your numbers" + (has("founders") ? " and your founders" : "") + ".", "Add one with a tap. Wave away what doesn't fit."], aside: "it's here to help, not to watch" });
    s.push({ sel: "tasks", h: "Got something big?", p: ["Write the goal and its deadline. You get suggested steps, each with a date, and you keep only the ones you want."],
      demo: `<div class="gdemo"><b>${esc(g)}</b>${steps.map((x, i) => `<i style="--i:${i}">${esc(x)}<small>${["in 2 days", "next week", "by the deadline"][i]}</small></i>`).join("")}</div>`,
      more: d.me.owner ? "You can add next steps to anyone's list too." : "I can add a next step for you too. Those say \"From Manav\".", aside: "try it with something big" });
  }
  if (has("events")) s.push({ sel: "events", h: "Everything we're doing", p: ["Build Clubs in every city, practicals, Catalyst sessions and Reactions, on one calendar.", "Tap for the whole month. Add a Reactions plan and the whole team sees it."], aside: "always the latest dates" });
  if (has("founders")) s.push({ sel: "founders", h: "Your founders, by stage", p: ["To call, booked, talked, confirmed, contract sent, signed.", "Change a founder's Status in your sheet and they move here on their own."], aside: "no double entry" });
  if (has("reactions")) s.push({ sel: "reactions", h: "Reactions forms", p: ["Make the sign-up page for a Reactions event, share its link, and close it when the table is full."] });
  if (has("agreements")) s.push({ sel: "agreements", h: "Agreements in a minute", p: ["Fill in a founder's details and get their agreement as a PDF."] });
  if (has("attend")) s.push({ sel: "attend", h: "Who came", p: ["Tick the founders after every session. Each one counts toward people in rooms."] });
  if (has("contacts")) s.push({ sel: "contacts", h: "Your contacts sheet", p: ["One tap away."] });
  if (has("mine") && d.mine?.label) s.push({ sel: "mine", h: "Your number", p: [`${d.mine.label}. This is what your work moves.`, "Tap it to see how it's counted and what would move it next."], aside: "this one's yours" });
  if (has("people")) s.push({ sel: "people", h: "Our number", p: ["People in rooms this month. Everyone at Chemistry Labs moves this one together."] });
  if (has("crm")) s.push({ sel: "crm", h: "Your CRM", p: [crmLine] });
  if (has("social")) s.push({ sel: "social", h: "The social calendar", p: ["Every post for the next two weeks, and the stage each one is at."] });
  if (has("jobs")) s.push({ sel: "jobs", h: "Jobs the hub checks for you", p: ["When one is done, it shows here on its own. You never have to report it."], aside: "less reporting, more doing" });
  if (has("team")) s.push({ sel: "team", h: "Your team", p: ["Everyone's number at a glance. Tap a person to see their screen."] });
  const link = app.querySelector('[data-tile^="link:"]');
  if (link) s.push({ sel: link.dataset.tile, h: "Your links", p: ["They sit here like apps. Add the ones you open every day."] });
  s.push({ sel: "grid", h: "Make it yours", p: ["Press and hold any tile. Drag it to move it, tap − to hide it, and + to add a link."], jiggle: true, aside: "just like your phone" });
  s.push({ h: `That's it, ${name}`, p: ["Open this whenever you wonder what's next. It will tell you.", "You can watch this again from \"How this works\" under your name."], last: true, aside: "go get it" });
  return s;
}

function welcome() {
  const steps = tourSteps();
  let i = 0;
  const root = document.createElement("div");
  root.className = "tour"; root.setAttribute("role", "dialog"); root.setAttribute("aria-label", "How your dashboard works");
  root.innerHTML = `<div class="tb tb-t"></div><div class="tb tb-r"></div><div class="tb tb-b"></div><div class="tb tb-l"></div><div class="tring"></div><svg class="tarrow" aria-hidden="true"><path/></svg><div class="tnote"></div>`;
  document.body.append(root);
  document.documentElement.classList.add("touring");
  const screen = $(".screen", app);
  const done = async () => {
    screen?.classList.remove("editing");
    document.documentElement.classList.remove("touring");
    root.classList.add("bye"); setTimeout(() => root.remove(), motion ? 350 : 0);
    window.scrollTo(0, 0);
    if (!H().welcomed) { D.home.welcomed = true; try { await api("/api/home", { welcomed: true }); } catch {} }
  };
  const noteHtml = (st) => `<h3 class="th">${esc(st.h)}</h3>${st.p.map((x) => `<p>${esc(x)}</p>`).join("")}${st.demo || ""}${st.more ? `<p>${esc(st.more)}</p>` : ""}
      ${st.aside ? `<p class="aside hw">${esc(st.aside)}</p>` : ""}
      <div class="tnav"><span class="tdots">${steps.map((_, j) => `<i class="${j === i ? "on" : ""}"></i>`).join("")}</span>
      ${i ? `<button class="tbtn ghost" data-b>Back</button>` : `<button class="tbtn ghost" data-s>Skip</button>`}<button class="tbtn" data-n>${st.last ? "Let's go" : i ? "Next" : "Show me"}</button></div>`;
  const show = () => {
    const st = steps[i], note = $(".tnote", root), ring = $(".tring", root), arrow = $(".tarrow", root);
    screen?.classList.toggle("editing", !!st.jiggle);
    const el = st.sel === "grid" ? $(".grid", app) : st.sel ? app.querySelector(`[data-tile="${st.sel}"]`) : null;
    const W = innerWidth, Hh = innerHeight;
    /* The note is written first so its height is known; then the page scrolls so the tile and
       the note both fit on the screen, note under the tile where it can. */
    note.innerHTML = noteHtml(st);
    note.className = "tnote" + (el ? "" : " solo");
    note.style.top = "-9999px"; note.style.bottom = "";
    const nh = note.offsetHeight, gap = 46;
    let r = null, place = "solo";
    if (el) {
      const b = el.getBoundingClientRect(), th = st.jiggle ? Math.min(b.height, Hh * 0.36) : b.height;
      const want = Math.max(20, (Hh - (th + gap + nh)) / 2);
      window.scrollTo(0, Math.max(0, scrollY + b.top - want));
      const c = el.getBoundingClientRect(), pad = 8;
      r = { top: Math.max(8, c.top - pad), left: Math.max(4, c.left - pad), right: Math.min(W - 4, c.right + pad), bottom: Math.min(Hh - 8, c.bottom + pad) };
      if (st.jiggle) r.bottom = Math.min(r.bottom, r.top + th + pad);
      place = Hh - r.bottom - gap >= nh + 12 ? "below" : r.top - gap >= nh + 12 ? "above" : "over";
    }
    /* Four blurred panes around the hole, so the tile itself stays sharp. */
    const [t, rt, bt, l] = root.querySelectorAll(".tb");
    if (r) {
      Object.assign(t.style, { top: "0", left: "0", width: "100%", height: r.top + "px" });
      Object.assign(bt.style, { top: r.bottom + "px", left: "0", width: "100%", height: Hh - r.bottom + "px" });
      Object.assign(l.style, { top: r.top + "px", left: "0", width: r.left + "px", height: r.bottom - r.top + "px" });
      Object.assign(rt.style, { top: r.top + "px", left: r.right + "px", width: W - r.right + "px", height: r.bottom - r.top + "px" });
      Object.assign(ring.style, { display: "block", top: r.top + "px", left: r.left + "px", width: r.right - r.left + "px", height: r.bottom - r.top + "px" });
    } else {
      Object.assign(t.style, { top: "0", left: "0", width: "100%", height: "100%" });
      for (const x of [rt, bt, l]) x.style.height = "0";
      ring.style.display = "none";
    }
    note.style.top = "";
    note.classList.add(place);
    const below = place !== "above";
    if (place === "below") note.style.top = r.bottom + gap + "px";
    else if (place === "above") note.style.bottom = Hh - r.top + gap + "px";
    else if (place === "over") note.style.bottom = "16px";
    /* A hand-drawn arrow from the note to the tile. */
    if (r && place !== "over") {
      const x1 = W * 0.3, x2 = Math.min(r.right - 30, Math.max(r.left + 30, W * 0.55));
      const y1 = below ? r.bottom + 44 : Hh - (Hh - r.top + 44), y2 = below ? r.bottom + 6 : r.top - 6;
      arrow.setAttribute("viewBox", `0 0 ${W} ${Hh}`);
      const mx = (x1 + x2) / 2 - 30, my = (y1 + y2) / 2;
      const head = below ? `M${x2 - 7} ${y2 + 9} L${x2} ${y2} L${x2 + 8} ${y2 + 7}` : `M${x2 - 7} ${y2 - 9} L${x2} ${y2} L${x2 + 8} ${y2 - 7}`;
      $("path", arrow).setAttribute("d", `M${x1} ${y1} Q${mx} ${my} ${x2} ${y2} ${head}`);
      arrow.style.display = "block";
      arrow.classList.remove("draw"); void arrow.getBoundingClientRect(); arrow.classList.add("draw");
    } else arrow.style.display = "none";
    note.classList.remove("in"); void note.offsetWidth; note.classList.add("in");
    $("[data-n]", note).onclick = () => (st.last ? done() : (i++, show()));
    const b = $("[data-b]", note); if (b) b.onclick = () => { i--; show(); };
    const sk = $("[data-s]", note); if (sk) sk.onclick = done;
  };
  let x0 = null;
  root.addEventListener("touchstart", (e) => { x0 = e.touches[0].clientX; }, { passive: true });
  root.addEventListener("touchend", (e) => {
    if (x0 == null) return; const dx = e.changedTouches[0].clientX - x0; x0 = null;
    if (dx < -60 && i < steps.length - 1) { i++; show(); } else if (dx > 60 && i) { i--; show(); }
  });
  root.addEventListener("touchmove", (e) => e.preventDefault(), { passive: false });
  show();
}


/* ── an invite: they pick their own password, and they're in ── */
async function invite(t) {
  app.innerHTML = `<div class="wall"></div><div class="screen"><div class="login"><h1 class="lockup"><span>chemistry</span><span>labs<i>.</i></span></h1><p>Opening your invite…</p></div></div>`;
  let v;
  try { const r = await fetch(API + "/api/invite?t=" + encodeURIComponent(t)); v = await r.json(); if (!r.ok) throw new Error(v.error); }
  catch (e) { history.replaceState(null, "", location.pathname); return login(e.message || "This link didn't open. Ask Manav for a fresh one."); }
  app.innerHTML = `<div class="wall"></div><div class="screen"><form class="login" id="inv">
    <h1 class="lockup"><span>chemistry</span><span>labs<i>.</i></span></h1>
    <p class="inv-h">Hello ${esc(v.name)} 👋</p>
    <p>This is your team screen. ${v.existing ? "Pick a new password" : "Pick a password"} and you're in. Only you will know it.</p>
    <label class="f"><span>Your username</span><input value="${esc(v.username)}" name="u" autocomplete="username" readonly></label>
    <label class="f"><span>Your password, 8 characters or more</span><input name="pw" type="password" autocomplete="new-password" minlength="8" required></label>
    <label class="showpw"><input type="checkbox" data-show> Show it</label>
    <p class="err"></p><button class="btn green" type="submit">Set my password</button></form></div>`;
  const f = $("#inv");
  $("[data-show]", f).onchange = (e) => { f.pw.type = e.target.checked ? "text" : "password"; };
  f.onsubmit = async (e) => {
    e.preventDefault();
    try {
      const r = await fetch(API + "/api/invite", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ t, pw: f.pw.value }) });
      const j = await r.json(); if (!r.ok) throw new Error(j.error);
      store.set(j.key); history.replaceState(null, "", location.pathname); firstPaint = true; load();
    } catch (err) { $(".err", f).textContent = err.message; }
  };
}

function boot() {
  const m = location.hash.match(/invite=([A-Za-z0-9_-]+)/);
  if (m) return invite(m[1]);
  load();
}

boot();
