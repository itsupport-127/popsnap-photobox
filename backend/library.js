// ==========================================================
// Pustaka POPSNAP (seperti dslrBooth): folder yang bisa dibuka di File Explorer berisi
//   <Pictures>\POPSNAP\Settings\popsnap-settings.json     seluruh konfigurasi (tanpa kunci pembayaran & PIN)
//   <Pictures>\POPSNAP\Templates\<nama>__<id>\template.json + files\   tiap template beserta gambar yang dipakainya
// Isinya DICERMINKAN otomatis dari database tiap kali pengaturan / template berubah (jeda 3 detik), jadi folder ini
// selalu terbaru. Database tetap sumber utama; folder dipakai untuk cadangan, salin ke PC lain, dan pemulihan:
//   - PC / AppData baru (belum ada akun): pengaturan & template dipulihkan otomatis dari folder ini
//   - restore() manual (tombol "Pulihkan dari folder" di Pengaturan): menambah template yang belum ada, memuat pengaturan
// Template yang dihapus dari aplikasi dipindah ke Templates\_dihapus (tidak langsung hilang dari folder).
// ==========================================================
const fs = require("fs");
const path = require("path");
const config = require("./config");
const db = require("./db");
const settingsStore = require("./settings");

const root = () => config.libraryDir;
const dirs = () => ({ settings: path.join(root(), "Settings"), templates: path.join(root(), "Templates") });
const SETTINGS_FILE = () => path.join(dirs().settings, "popsnap-settings.json");
const safe = (n) => String(n || "template").replace(/[\\/:*?"<>|\x00-\x1f]+/g, "-").replace(/\s+/g, " ").trim().slice(0, 60) || "template";
const UPLOAD_RE = /\/uploads\/([\w.\-]{1,120})/g;
const state = { lastOkAt: null, lastError: null };

function writeJson(file, obj) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = file + ".tmp";
  fs.writeFileSync(tmp, JSON.stringify(obj, null, 2));
  fs.renameSync(tmp, file);
}

function exportSettings() {
  const data = JSON.parse(JSON.stringify(settingsStore.load()));
  delete data.payment; // kunci QRIS / kasir / cloud: jangan ditulis polos di folder Gambar
  if (data.general) delete data.general.security; // hash PIN
  writeJson(SETTINGS_FILE(), { format: "popsnap-library-settings", version: 1, savedAt: new Date().toISOString(), settings: data });
}

function exportTemplates() {
  const base = dirs().templates;
  fs.mkdirSync(base, { recursive: true });
  const rows = db.prepare("SELECT * FROM templates").all();
  const keep = new Set();
  for (const row of rows) {
    const name = `${safe(row.name)}__${row.id}`;
    keep.add(name);
    const dir = path.join(base, name);
    writeJson(path.join(dir, "template.json"), { format: "popsnap-library-template", version: 1, savedAt: new Date().toISOString(), row });
    const files = new Set(); let m;
    UPLOAD_RE.lastIndex = 0;
    const text = JSON.stringify(row);
    while ((m = UPLOAD_RE.exec(text))) files.add(m[1]);
    for (const f of files) {
      const src = path.join(config.dataDir, "uploads", f), dst = path.join(dir, "files", f);
      try {
        if (!fs.existsSync(src)) continue;
        if (fs.existsSync(dst) && fs.statSync(dst).size === fs.statSync(src).size) continue;
        fs.mkdirSync(path.dirname(dst), { recursive: true });
        fs.copyFileSync(src, dst);
      } catch { /* satu gambar gagal disalin: lanjutkan yang lain */ }
    }
  }
  // folder template yang sudah tidak ada di database -> _dihapus (nama bisa berubah saat template diganti namanya: pindahkan folder lama)
  for (const d of fs.readdirSync(base, { withFileTypes: true })) {
    if (!d.isDirectory() || d.name.startsWith("_") || keep.has(d.name)) continue;
    const trash = path.join(base, "_dihapus");
    try { fs.mkdirSync(trash, { recursive: true }); fs.renameSync(path.join(base, d.name), path.join(trash, `${d.name}__${Date.now()}`)); } catch { /* abaikan */ }
  }
  writeJson(path.join(base, "_kategori.json"), { format: "popsnap-library-categories", version: 1, rows: db.prepare("SELECT * FROM categories").all() });
}

function syncNow() {
  try { exportSettings(); exportTemplates(); state.lastOkAt = new Date().toISOString(); state.lastError = null; return { ok: true }; }
  catch (e) { state.lastError = e.message; console.error("[pustaka] gagal:", e.message); return { ok: false, error: e.message }; }
}

let timer = null;
function schedule() { clearTimeout(timer); timer = setTimeout(syncNow, 3000); }

function restoreSettings() {
  const f = SETTINGS_FILE();
  if (!fs.existsSync(f)) return { settings: false };
  const j = JSON.parse(fs.readFileSync(f, "utf8"));
  if (j?.format !== "popsnap-library-settings" || typeof j.settings !== "object") throw new Error("Berkas pengaturan di folder pustaka tidak dikenali.");
  settingsStore.update(j.settings); // lewat validasi biasa; yang tidak dikenal dibuang
  return { settings: true };
}

function restoreTemplates() {
  const base = dirs().templates;
  if (!fs.existsSync(base)) return { added: 0, skipped: 0 };
  const cols = new Set(db.prepare("PRAGMA table_info(templates)").all().map((c) => c.name));
  const exists = db.prepare("SELECT 1 FROM templates WHERE id = ?");
  let added = 0, skipped = 0;
  const catFile = path.join(base, "_kategori.json");
  try {
    for (const c of JSON.parse(fs.readFileSync(catFile, "utf8")).rows ?? []) {
      const ck = Object.keys(c).filter((k) => ["id", "label", "sort", "icon"].includes(k) || k in c);
      try { db.prepare(`INSERT OR IGNORE INTO categories (${ck.join(",")}) VALUES (${ck.map(() => "?").join(",")})`).run(...ck.map((k) => c[k])); } catch { /* kolom beda: lewati */ }
    }
  } catch { /* tanpa berkas kategori */ }
  for (const d of fs.readdirSync(base, { withFileTypes: true })) {
    if (!d.isDirectory() || d.name.startsWith("_")) continue;
    try {
      const j = JSON.parse(fs.readFileSync(path.join(base, d.name, "template.json"), "utf8"));
      const row = j?.row;
      if (j?.format !== "popsnap-library-template" || !row?.id || !/^[\w-]{1,64}$/.test(String(row.id))) { skipped++; continue; }
      if (exists.get(row.id)) { skipped++; continue; }
      const filesDir = path.join(base, d.name, "files");
      if (fs.existsSync(filesDir)) for (const f of fs.readdirSync(filesDir)) {
        if (!/^[\w.\-]{1,120}$/.test(f)) continue;
        const dst = path.join(config.dataDir, "uploads", f);
        if (!fs.existsSync(dst)) fs.copyFileSync(path.join(filesDir, f), dst);
      }
      const ks = Object.keys(row).filter((k) => cols.has(k));
      db.prepare(`INSERT INTO templates (${ks.join(",")}) VALUES (${ks.map(() => "?").join(",")})`).run(...ks.map((k) => row[k]));
      added++;
    } catch (e) { skipped++; console.error(`[pustaka] template ${d.name} dilewati:`, e.message); }
  }
  return { added, skipped };
}

function restore({ settings = true, templates = true } = {}) {
  const out = {};
  if (settings) Object.assign(out, restoreSettings());
  if (templates) Object.assign(out, restoreTemplates());
  return out;
}

function status() {
  let templates = 0;
  try { templates = fs.readdirSync(dirs().templates, { withFileTypes: true }).filter((d) => d.isDirectory() && !d.name.startsWith("_")).length; } catch { /* belum ada */ }
  return { dir: root(), settingsFile: fs.existsSync(SETTINGS_FILE()), templates, lastOkAt: state.lastOkAt, lastError: state.lastError };
}

/** Panggil sekali saat server nyala: PC baru (belum ada akun) -> pulihkan dari folder; lalu cermin berkala. */
function start() {
  try {
    fs.mkdirSync(dirs().settings, { recursive: true });
    fs.mkdirSync(dirs().templates, { recursive: true });
    const fresh = db.prepare("SELECT COUNT(*) n FROM users").get().n === 0;
    if (fresh) {
      const r = restore();
      if (r.settings || r.added) console.log(`[pustaka] dipulihkan dari ${root()}:`, JSON.stringify(r));
    } else if (db.prepare("SELECT COUNT(*) n FROM templates").get().n === 0) {
      const r = restoreTemplates();
      if (r.added) console.log(`[pustaka] ${r.added} template dipulihkan dari ${root()}`);
    }
  } catch (e) { state.lastError = e.message; console.error("[pustaka] pemulihan gagal:", e.message); }
  setTimeout(syncNow, 20000);
  setInterval(syncNow, 30 * 60 * 1000); // jaring pengaman kalau ada perubahan yang terlewat
}

module.exports = { start, schedule, syncNow, restore, status };
