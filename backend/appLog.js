// ==========================================================
// Log aplikasi: semua console.log / info / warn / error ikut disimpan ke file per tanggal
// (<data>/logs/app-YYYY-MM-DD.log), disimpan 14 hari. Dipakai alat "Log aplikasi" di Remote Booth.
//  - Rahasia (token, kata sandi, kunci) disensor sebelum ditulis.
//  - Satu file dibatasi 30 MB; lewat itu hanya ditulis satu baris pemberitahuan.
//  - Hanya MENAMBAH ke file; pembacaan lewat readLog() (hanya baca).
// ==========================================================
const fs = require("fs");
const path = require("path");
const util = require("util");

const KEEP_DAYS = 14;
const MAX_FILE = 30 * 1024 * 1024;
const MAX_OUT_CHARS = 240000; // batas isi yang dikirim ke Remote
const LINE_RE = /^(\d{4}-\d{2}-\d{2}) (\d{2}:\d{2}:\d{2}\.\d{3}) \[([IWE])\] /;

let dir = null, stream = null, streamDate = "", written = 0, installed = false;

const pad = (n, l = 2) => String(n).padStart(l, "0");
const ymd = (d = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const hms = (d = new Date()) => `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}.${pad(d.getMilliseconds(), 3)}`;

/** Sensor rahasia: token / kata sandi / kunci / JWT / header Authorization. */
function redact(s) {
  return String(s)
    .replace(/\b(authorization|cookie|set-cookie)\s*[:=]\s*(?:(?:Bearer|Basic)\s+)?[^\s,;]+/gi, "$1: [DISENSOR]")
    .replace(/\bBearer\s+[A-Za-z0-9._~+\/=-]{8,}/g, "Bearer [DISENSOR]")
    .replace(/(["']?(?:token|secret|password|passwd|pass|pin|api[_-]?key|server[_-]?key|client[_-]?key|access[_-]?key|private[_-]?key|signature)["']?\s*[:=]\s*)(["'])?[^\s"',}&]{3,}/gi, "$1$2[DISENSOR]")
    .replace(/\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{4,}/g, "[JWT-DISENSOR]");
}

function open(date) {
  try { stream && stream.end(); } catch { /* abaikan */ }
  streamDate = date;
  const file = path.join(dir, `app-${date}.log`);
  try { written = fs.existsSync(file) ? fs.statSync(file).size : 0; } catch { written = 0; }
  stream = fs.createWriteStream(file, { flags: "a" });
  stream.on("error", () => { stream = null; }); // gagal tulis log tidak boleh menjatuhkan aplikasi
}

function write(level, args) {
  if (!dir) return;
  try {
    const now = new Date(), date = ymd(now);
    if (!stream || date !== streamDate) open(date);
    if (!stream) return;
    if (written > MAX_FILE) return;
    let text = args.map((a) => (typeof a === "string" ? a : util.inspect(a, { depth: 3, breakLength: 160 }))).join(" ");
    text = redact(text).replace(/\r/g, "").replace(/\n/g, "\n    ");
    if (text.length > 8000) text = text.slice(0, 8000) + " …(dipotong)";
    const line = `${date} ${hms(now)} [${level}] ${text}\n`;
    written += Buffer.byteLength(line);
    if (written > MAX_FILE) { stream.write(`${date} ${hms(now)} [W] Log hari ini melewati 30 MB, baris berikutnya tidak disimpan.\n`); return; }
    stream.write(line);
  } catch { /* abaikan */ }
}

function prune() {
  try {
    const cutoff = ymd(new Date(Date.now() - KEEP_DAYS * 86400000));
    for (const f of fs.readdirSync(dir)) { const m = /^app-(\d{4}-\d{2}-\d{2})\.log$/.exec(f); if (m && m[1] < cutoff) { try { fs.unlinkSync(path.join(dir, f)); } catch { /* abaikan */ } } }
  } catch { /* abaikan */ }
}

/** Panggil sekali, paling awal di server.js. */
function install(dataDir) {
  if (installed) return; installed = true;
  try { dir = path.join(dataDir, "logs"); fs.mkdirSync(dir, { recursive: true }); } catch { dir = null; return; }
  for (const [m, lv] of [["log", "I"], ["info", "I"], ["warn", "W"], ["error", "E"]]) {
    const orig = console[m].bind(console);
    console[m] = (...a) => { write(lv, a); orig(...a); };
  }
  prune(); setInterval(prune, 6 * 3600 * 1000).unref();
  write("I", [`=== Aplikasi dimulai (pid ${process.pid}, node ${process.version}) ===`]);
}

function dates() {
  try { return fs.readdirSync(dir).map((f) => /^app-(\d{4}-\d{2}-\d{2})\.log$/.exec(f)?.[1]).filter(Boolean).sort().reverse(); } catch { return []; }
}

/**
 * Baca log satu tanggal secara BERTAHAP (stream), jadi app tidak tertahan walau filenya besar.
 * opts: { date, level: all|warn|error, tail, from: "HH:MM", to: "HH:MM", q }
 * Mengembalikan Promise<{ date, dates, total, shown, truncated, bytes, lines: [string] }>.
 */
async function readLog(opts = {}) {
  const date = opts.date || ymd();
  const out = { date, today: ymd(), dates: dates(), total: 0, shown: 0, truncated: false, bytes: 0, lines: [] };
  if (!dir) return { ...out, error: "Log aplikasi tidak aktif." };
  const file = path.join(dir, `app-${date}.log`);
  try { out.bytes = fs.statSync(file).size; } catch { return out; }
  const rank = { I: 0, W: 1, E: 2 }, min = opts.level === "error" ? 2 : opts.level === "warn" ? 1 : 0;
  const q = (opts.q || "").toLowerCase(), cap = Math.max(1, Math.min(2000, opts.tail || 400));
  const ring = []; // hanya N catatan cocok terakhir yang disimpan (hemat memori)
  let cur = null, total = 0;
  const flush = () => {
    if (!cur) return;
    if (rank[cur.lv] >= min && (!opts.from || cur.t >= opts.from) && (!opts.to || cur.t <= opts.to) && (!q || cur.text.toLowerCase().includes(q))) {
      total++; ring.push(cur.text); if (ring.length > cap) ring.shift();
    }
  };
  await new Promise((resolve) => {
    const rl = require("readline").createInterface({ input: fs.createReadStream(file, { encoding: "utf8" }), crlfDelay: Infinity });
    rl.on("line", (ln) => {
      if (!ln) return;
      const m = LINE_RE.exec(ln);
      if (m) { flush(); cur = { t: m[2].slice(0, 5), lv: m[3], text: ln }; }
      else if (cur && cur.text.length < 20000) cur.text += "\n" + ln; // baris lanjutan (stack trace)
    });
    rl.on("close", resolve); rl.on("error", resolve);
  });
  flush();
  out.total = total;
  let size = 0; const keep = [];
  for (let i = ring.length - 1; i >= 0; i--) { size += ring[i].length + 1; if (size > MAX_OUT_CHARS) break; keep.push(ring[i]); }
  keep.reverse();
  out.lines = keep; out.shown = keep.length; out.truncated = keep.length < total;
  return out;
}

module.exports = { install, readLog, redact, ymd };
