// ==========================================================
// Agent Remote Booth: menyambungkan booth ini KELUAR ke server popsnap-remote (tanpa port masuk / tanpa IP publik).
//
//  - Heartbeat tiap 8 dtk: status layar, ringkasan hari ini, nilai pengaturan yang boleh diubah, transaksi terbaru.
//  - Long-poll perintah: kunci/buka booth, batalkan sesi, muat ulang tampilan, ubah pengaturan aman, tes koneksi.
//  - Layar kiosk (React) melapor lewat /api/remote/ui-state dan menerima perintah lewat /api/remote/ui-cmd (lokal).
//  - Pengaturan rahasia (kunci pembayaran, PIN, token) TIDAK dikirim dan TIDAK bisa diubah (lihat remoteSpec.js).
//  - Offline-first: kalau server remote / internet mati, booth jalan normal; agent mencoba lagi dengan jeda bertahap.
// ==========================================================
const db = require("./db");
const settingsStore = require("./settings");
const cloud = require("./cloudSync");
const { logActivity } = require("./activity");
const spec = require("./remoteSpec");

const KEY = "remote";
const HELLO_MS = 8000;
const FRONT_ALIVE_MS = 25000;
const APP_VERSION = (() => { try { return require("./package.json").version; } catch { return "1"; } })();

const st = { running: false, connected: false, lastOkAt: null, lastError: null, boothName: null, uiAt: 0, ui: { screen: null, shots: null }, lastTxSig: "", lastTxFullAt: 0, fails: 0, genId: 0 };
const tools = {};            // alat yang didaftarkan modul lain (storage, kamera, dst)
function registerTool(type, fn) { tools[type] = fn; }
const frontQueue = [];       // perintah untuk layar kiosk
const frontWaiters = [];     // long-poll dari layar kiosk

// ---------- konfigurasi (tabel app_settings, kunci "remote") ----------
function load() {
  try {
    const raw = db.prepare("SELECT value FROM app_settings WHERE key = ?").get(KEY)?.value;
    const c = raw ? JSON.parse(raw) : {};
    return { enabled: !!c.enabled, url: String(c.url || ""), token: String(c.token || ""), lock: { on: !!c.lock?.on, message: String(c.lock?.message || "") } };
  } catch { return { enabled: false, url: "", token: "", lock: { on: false, message: "" } }; }
}
function save(c) {
  db.prepare("INSERT INTO app_settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value").run(KEY, JSON.stringify(c));
}
const baseUrl = (c = load()) => c.url.replace(/\/+$/, "");
const isHttp = (u) => /^https?:\/\/[^\s/]+/i.test(u);

function publicConfig() {
  const c = load();
  return {
    enabled: c.enabled, url: c.url, tokenSet: !!c.token, tokenTail: c.token ? c.token.slice(-4) : "", lock: c.lock,
    status: { connected: st.connected, lastOkAt: st.lastOkAt, lastError: st.lastError, boothName: st.boothName, frontendAlive: frontAlive() },
  };
}
const frontAlive = () => Date.now() - st.uiAt < FRONT_ALIVE_MS;

// ---------- snapshot yang dikirim ke server ----------
function flatSettings() {
  const s = settingsStore.load(), out = {};
  for (const path of Object.keys(spec.FIELDS)) {
    const v = path.split(".").reduce((o, k) => (o == null ? undefined : o[k]), s);
    if (v !== undefined) out[path] = v;
  }
  return out;
}
function localDayStartIso() { const d = new Date(); d.setHours(0, 0, 0, 0); return d.toISOString(); }
function today() {
  const r = db.prepare("SELECT COUNT(*) n, COALESCE(SUM(amount),0) rev FROM tx_log WHERE status = 'paid' AND COALESCE(is_test,0) = 0 AND COALESCE(paid_at, created_at) >= ?").get(localDayStartIso());
  return { count: r.n, revenue: r.rev };
}
function diskBrief() {
  try { const f = require("fs").statfsSync(require("./config").dataDir); const t = f.blocks * f.bsize; return { freeGB: Math.round((f.bavail * f.bsize) / 1e8) / 10, totalGB: Math.round(t / 1e8) / 10 }; } catch { return null; }
}
function info() {
  const s = settingsStore.load();
  const cam = { webcam: "Webcam", dslr: "DSLR (digiCamControl)", canon: "Canon (langsung)", nikon: "Nikon (langsung)" }[s.camera?.mode] || s.camera?.mode || "-";
  let pending = null; try { pending = cloud.status().pending; } catch { /* */ }
  return { camera: cam, printer: s.printing?.enabled ? (s.printing.main?.name || "Printer bawaan") : "Cetak mati", paymentMode: s.payment?.mode, pendingSync: pending, disk: diskBrief(), uptimeMin: Math.round(process.uptime() / 60) };
}
function txPayload() {
  let rows = []; try { rows = cloud.recent(60); } catch { /* */ }
  const slim = rows.map((r) => ({ order_no: r.order_no, mode: r.mode, method: r.method, template_name: r.template_name, category: r.category, voucher_code: r.voucher_code,
    amount: r.amount, status: r.status, is_test: !!r.is_test, created_at: r.created_at, paid_at: r.paid_at, updated_at: r.updated_at }));
  const sig = slim.map((r) => r.order_no + r.updated_at + r.status).join("|");
  const full = Date.now() - st.lastTxFullAt > 5 * 60 * 1000;
  if (sig === st.lastTxSig && !full) return undefined;
  return { tx: slim, sig, full };
}

// ---------- HTTP ke server remote ----------
async function http(path, { method = "GET", body, timeout = 12000 } = {}) {
  const c = load();
  const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), timeout);
  try {
    const res = await fetch(baseUrl(c) + path, { method, signal: ctl.signal, headers: { Authorization: "Bearer " + c.token, ...(body ? { "Content-Type": "application/json" } : {}) }, body: body ? JSON.stringify(body) : undefined });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) { const e = new Error(data.error || `Server remote menjawab ${res.status}`); e.status = res.status; throw e; }
    return data;
  } finally { clearTimeout(t); }
}

async function hello() {
  const c = load();
  const body = { version: APP_VERSION, ui: uiReport(c), today: today(), settings: flatSettings(), info: info() };
  const tx = txPayload(); if (tx) body.tx = tx.tx;
  const d = await http("/api/agent/hello", { method: "POST", body });
  if (tx) { st.lastTxSig = tx.sig; if (tx.full) st.lastTxFullAt = Date.now(); }
  st.boothName = d.name || st.boothName;
}
function uiReport(c = load()) {
  const alive = frontAlive();
  const lockedState = st.ui.locked || (c.lock.on ? "pending" : "off");
  return { screen: alive ? st.ui.screen : null, shots: alive ? st.ui.shots : null, locked: c.lock.on ? lockedState : "off", lockMessage: c.lock.on ? c.lock.message : "", kiosk: alive };
}

// ---------- perintah dari server ----------
function toFront(cmd) {
  const w = frontWaiters.shift();
  if (w) { clearTimeout(w.timer); w.res.json({ commands: [cmd] }); } else frontQueue.push(cmd);
}
async function handle(cmd) {
  const c = load();
  switch (cmd.type) {
    case "ping": return { ok: true, message: "Booth terhubung" + (frontAlive() ? "" : " (layar kiosk belum terbuka)") };
    case "lock": {
      save({ ...c, lock: { on: true, message: String(cmd.payload?.message || "").slice(0, 120) } });
      logActivity("remote", "remote.lock", "booth", { message: cmd.payload?.message || "" });
      toFront({ type: "lock", message: cmd.payload?.message || "" });
      return { ok: true, message: frontAlive() ? "Booth dikunci" : "Terkunci (layar kiosk belum terbuka, berlaku saat dibuka)" };
    }
    case "unlock":
      save({ ...c, lock: { on: false, message: "" } });
      logActivity("remote", "remote.unlock", "booth", {});
      toFront({ type: "unlock" });
      return { ok: true, message: "Kunci dibuka" };
    case "cancel_session":
      if (!frontAlive()) return { ok: false, error: "Layar kiosk tidak terhubung (aplikasi booth belum terbuka)." };
      logActivity("remote", "remote.cancel_session", "booth", { screen: st.ui.screen });
      toFront({ type: "cancel_session" });
      return { ok: true, message: "Sesi dibatalkan" };
    case "reload_ui":
      if (!frontAlive()) return { ok: false, error: "Layar kiosk tidak terhubung (aplikasi booth belum terbuka)." };
      logActivity("remote", "remote.reload_ui", "booth", {});
      toFront({ type: "reload_ui" });
      return { ok: true, message: "Tampilan dimuat ulang" };
    case "settings.patch": {
      const v = spec.validatePatch(cmd.payload?.patch);
      if (!v.ok) return { ok: false, error: v.errors[0] || "Tidak ada perubahan yang valid." };
      const before = flatSettings();
      settingsStore.update(spec.unflatten(v.clean));
      const after = flatSettings();
      const applied = {}, differ = [];
      for (const [p, want] of Object.entries(v.clean)) {
        applied[p] = after[p];
        if (String(after[p]) !== String(want)) differ.push(`${spec.FIELDS[p].label} → ${after[p]}`);
      }
      const changed = Object.keys(v.clean).filter((p) => String(before[p]) !== String(after[p]));
      logActivity("remote", "remote.settings", "booth", { paths: Object.keys(v.clean) });
      return { ok: true, applied, message: `${changed.length} pengaturan diterapkan` + (differ.length ? ` (disesuaikan booth: ${differ.join(", ")})` : "") };
    }
    default: {
      const fn = tools[cmd.type];
      if (!fn || !spec.TOOL_TYPES.includes(cmd.type)) return { ok: false, error: "Perintah tidak dikenal." };
      const v = spec.validateTool(cmd.type, cmd.payload);
      if (!v.ok) return { ok: false, error: v.error };
      logActivity("remote", "remote.tool", cmd.type, {});
      const r = await fn(v.payload);
      return r && typeof r === "object" ? r : { ok: false, error: "Alat tidak memberi hasil." };
    }
  }
}

// ---------- loop ----------
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
let helloTimer = null;
async function helloLoop(gen) {
  while (st.running && gen === st.genId) {
    const c = load();
    if (!c.enabled || !isHttp(c.url) || !c.token) { st.connected = false; await wait(3000); continue; }
    try { await hello(); st.connected = true; st.lastOkAt = new Date().toISOString(); st.lastError = null; st.fails = 0; }
    catch (e) { st.connected = false; st.lastError = e.name === "AbortError" ? "Server remote tidak menjawab" : e.message; st.fails += 1; }
    await wait(st.fails ? Math.min(60000, 5000 * st.fails) : HELLO_MS);
  }
}
async function pollLoop(gen) {
  while (st.running && gen === st.genId) {
    const c = load();
    if (!c.enabled || !isHttp(c.url) || !c.token) { await wait(3000); continue; }
    try {
      const d = await http("/api/agent/poll", { timeout: 40000 });
      for (const cmd of d.commands || []) {
        let r; try { r = await handle(cmd); } catch (e) { r = { ok: false, error: e.message }; }
        await http("/api/agent/ack", { method: "POST", body: { id: cmd.id, ok: !!r.ok, message: r.message, applied: r.applied, error: r.error, data: r.data } }).catch(() => {});
      }
      st.connected = true;
    } catch (e) { st.connected = false; st.lastError = e.name === "AbortError" ? "Server remote tidak menjawab" : e.message; await wait(e.status === 401 ? 15000 : 5000); }
  }
}

function start() {
  if (st.running) return;
  st.running = true; st.genId += 1;
  helloLoop(st.genId).catch(() => {}); pollLoop(st.genId).catch(() => {});
}
function stop() { st.running = false; st.genId += 1; }

// ---------- rute lokal ----------
function mount(app, requirePerm) {
  const admin = requirePerm("settings.manage");

  app.get("/api/remote/config", admin, (req, res) => res.json(publicConfig()));
  app.put("/api/remote/config", admin, (req, res) => {
    const b = req.body || {}, c = load();
    const url = b.url !== undefined ? String(b.url).trim().replace(/\/+$/, "") : c.url;
    if (url && !isHttp(url)) return res.status(400).json({ error: "Alamat harus diawali http:// atau https://" });
    const token = typeof b.token === "string" && b.token.trim() ? b.token.trim() : c.token;
    const enabled = b.enabled !== undefined ? !!b.enabled : c.enabled;
    if (enabled && (!url || !token)) return res.status(400).json({ error: "Isi alamat server dan token dulu sebelum mengaktifkan." });
    save({ ...c, enabled, url, token });
    logActivity(req.user, "remote.config", "remote", { enabled, url, token: b.token ? "diubah" : "tetap" }, req);
    st.fails = 0; st.lastError = null;
    res.json(publicConfig());
  });
  app.post("/api/remote/test", admin, async (req, res) => {
    const b = req.body || {}, c = load();
    const url = (b.url ? String(b.url).trim() : c.url).replace(/\/+$/, ""), token = b.token ? String(b.token).trim() : c.token;
    if (!isHttp(url) || !token) return res.status(400).json({ error: "Isi alamat server dan token dulu." });
    const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), 10000);
    try {
      const r = await fetch(url + "/api/agent/hello", { method: "POST", signal: ctl.signal, headers: { Authorization: "Bearer " + token, "Content-Type": "application/json" }, body: JSON.stringify({ version: APP_VERSION, ui: uiReport(c), today: today(), settings: flatSettings(), info: info() }) });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) return res.status(400).json({ error: r.status === 401 ? "Token ditolak server (salah / sudah diganti)." : (d.error || `Server menjawab ${r.status}`) });
      res.json({ ok: true, name: d.name });
    } catch (e) { res.status(502).json({ error: e.name === "AbortError" ? "Server tidak menjawab (timeout)." : "Tidak bisa terhubung: " + (e.cause?.code || e.message) }); }
    finally { clearTimeout(t); }
  });

  // --- dipakai layar kiosk (lokal, tanpa login seperti rute kiosk lainnya) ---
  app.post("/api/remote/ui-state", (req, res) => {
    const b = req.body || {};
    st.uiAt = Date.now();
    st.ui = { screen: String(b.screen || "").slice(0, 30) || null, shots: Number.isFinite(Number(b.shots)) ? Number(b.shots) : null, locked: ["on", "pending", "off"].includes(b.locked) ? b.locked : "off" };
    res.json({ ok: true, lock: load().lock });
  });
  app.get("/api/remote/ui-cmd", (req, res) => {
    st.uiAt = Date.now();
    if (frontQueue.length) return res.json({ commands: frontQueue.splice(0, 5) });
    const w = { res, timer: setTimeout(() => { const i = frontWaiters.indexOf(w); if (i >= 0) frontWaiters.splice(i, 1); if (!res.writableEnded) res.json({ commands: [] }); }, 20000) };
    frontWaiters.push(w);
    req.on("close", () => { const i = frontWaiters.indexOf(w); if (i >= 0) { clearTimeout(w.timer); frontWaiters.splice(i, 1); } });
  });
}

const sessionActive = () => frontAlive() && !!st.ui.screen && st.ui.screen !== "WELCOME";
module.exports = { sessionActive, registerTool, mount, start, stop, status: publicConfig, _handle: handle, _load: load, _save: save };
