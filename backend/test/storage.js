// Uji: pembersihan sesi kedaluwarsa (jalan setelah start, tahan file terkunci), pembersih file yatim (tidak menyentuh file sesi / file baru),
// ringkasan penyimpanan & hapus arsip lama.   node test/storage.js
const os = require("os"), fs = require("fs"), path = require("path"), assert = require("assert"), { spawn } = require("child_process");
const DATA = fs.mkdtempSync(path.join(os.tmpdir(), "booth-")); process.env.POPSNAP_DATA = DATA;
const OUT = path.join(DATA, "output"); process.env.OUTPUT_DIR = OUT;

(async () => {
  const db = require("../db");
  const up = path.join(DATA, "uploads"); fs.mkdirSync(up, { recursive: true });
  const put = (name, kb = 1, ageMin = 60) => { const f = path.join(up, name); fs.writeFileSync(f, Buffer.alloc(kb * 1024, 1)); const t = new Date(Date.now() - ageMin * 60000); fs.utimesSync(f, t, t); return f; };
  const past = new Date(Date.now() - 3600e3).toISOString(), future = new Date(Date.now() + 86400e3).toISOString();
  // sesi kedaluwarsa (ISO "T") -> harus terhapus bersama filenya; sesi aktif tetap
  put("old-final.png"); put("old-raw.jpg"); put("live-final.png"); put("live-raw.jpg"); put("live-clip.mp4"); put("stale-temp-abc", 1, 120); put("fresh-temp-xyz", 1, 1); put("tpl-bg.png");
  db.prepare("INSERT INTO sessions (id, final_image_path, expires_at, mode) VALUES ('s-old', '/uploads/old-final.png', ?, 'photo')").run(past);
  db.prepare("INSERT INTO session_files (session_id, kind, idx, path) VALUES ('s-old','raw',1,'/uploads/old-raw.jpg')").run();
  db.prepare("INSERT INTO sessions (id, final_image_path, expires_at, mode) VALUES ('s-live', '/uploads/live-final.png', ?, 'photo')").run(future);
  db.prepare("INSERT INTO session_files (session_id, kind, idx, path) VALUES ('s-live','raw',1,'/uploads/live-raw.jpg')").run();
  db.prepare("INSERT INTO session_files (session_id, kind, idx, path) VALUES ('s-live','clip',1,'/uploads/live-clip.mp4')").run();
  // arsip: 3 folder tanggal + 1 folder lain
  const day = (n) => { const d = new Date(); d.setDate(d.getDate() - n); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };
  for (const n of [1, 40, 100]) { const d = path.join(OUT, day(n), "sesi-" + n); fs.mkdirSync(d, { recursive: true }); fs.writeFileSync(path.join(d, "final.jpg"), Buffer.alloc(2048)); }
  fs.mkdirSync(path.join(OUT, "Sosmed"), { recursive: true }); fs.writeFileSync(path.join(OUT, "Sosmed", "x.jpg"), "x");
  db.close?.();

  const PORT = 4900 + Math.floor(Math.random() * 100), B = `http://127.0.0.1:${PORT}`;
  const srv = spawn(process.execPath, [path.join(__dirname, "..", "server.js")], { env: { ...process.env, PORT: String(PORT), POPSNAP_DATA: DATA, OUTPUT_DIR: OUT }, stdio: ["ignore", "pipe", "pipe"] });
  let log = ""; srv.stdout.on("data", (d) => (log += d)); srv.stderr.on("data", (d) => (log += d));
  const done = (c) => { srv.kill(); process.exit(c); };
  const j = async (u, body, tok) => { const r = await fetch(B + u, { method: body ? "POST" : "GET", headers: { "Content-Type": "application/json", ...(tok ? { Authorization: "Bearer " + tok } : {}) }, body: body ? JSON.stringify(body) : undefined }); return { status: r.status, body: await r.json().catch(() => ({})) }; };
  for (let i = 0; i < 60; i++) { try { await fetch(B + "/api/health"); break; } catch { await new Promise((r) => setTimeout(r, 250)); } }
  try {
    const s = await j("/api/auth/setup", { username: "admin", password: "Passw0rd!x1", storeName: "T" });
    assert(s.body.token, "setup: " + JSON.stringify(s.body)); const tok = s.body.token;
    assert.strictEqual((await j("/api/storage")).status, 401, "ringkasan penyimpanan wajib login");

    // 1) pembersih file yatim: hanya file lama yang tidak dipakai siapa pun
    let r = await j("/api/templates/cleanup-orphaned-files", {}, tok);
    assert(r.status === 200 && r.body.ok, JSON.stringify(r.body));
    const has = (n) => fs.existsSync(path.join(up, n));
    assert(has("live-raw.jpg") && has("live-clip.mp4") && has("live-final.png"), "file sesi aktif (mentah / klip / final) TIDAK boleh terhapus");
    assert(has("fresh-temp-xyz"), "file baru (<15 menit) tidak disentuh");
    assert(!has("stale-temp-abc"), "file lama yang tidak dipakai terhapus");

    // 2) sesi kedaluwarsa dibersihkan otomatis ~30 dtk setelah start (tidak menunggu 6 jam)
    const t0 = Date.now(); while (Date.now() - t0 < 45000 && has("old-final.png")) await new Promise((x) => setTimeout(x, 1000));
    assert(!has("old-final.png") && !has("old-raw.jpg"), "sesi kedaluwarsa harus terhapus setelah start: " + log.slice(-300));
    assert(has("live-final.png") && has("live-raw.jpg") && has("live-clip.mp4"), "sesi aktif aman dari pembersihan otomatis");
    { const { DatabaseSync } = require("node:sqlite"); const dbf = path.join(DATA, "db", "popsnap.db"); const d2 = new DatabaseSync(dbf); assert.strictEqual(d2.prepare("SELECT COUNT(*) c FROM sessions WHERE id='s-old'").get().c, 0, "catatan sesi kedaluwarsa dihapus"); d2.close(); }

    // 3) ringkasan penyimpanan
    r = await j("/api/storage?fresh=1", null, tok);
    assert(r.status === 200 && r.body.output.dayCount === 3 && r.body.output.sessions === 3 && r.body.output.bytes === 6144, JSON.stringify(r.body.output));
    assert(r.body.uploads.files >= 4 && r.body.output.oldest === day(100) && r.body.output.otherBytes >= 1, JSON.stringify(r.body));

    // 4) hapus arsip lama: batas dicek, folder lain aman
    assert.strictEqual((await j("/api/storage/archive-cleanup", { olderThanDays: 2 }, tok)).status, 400, "batas minimal 7 hari");
    r = await j("/api/storage/archive-cleanup", { olderThanDays: 30 }, tok);
    assert(r.body.ok && r.body.removedDays === 2 && r.body.freedBytes === 4096, JSON.stringify(r.body));
    assert(fs.existsSync(path.join(OUT, day(1))) && !fs.existsSync(path.join(OUT, day(40))) && !fs.existsSync(path.join(OUT, day(100))), "hanya yang lebih tua dari 30 hari");
    assert(fs.existsSync(path.join(OUT, "Sosmed", "x.jpg")), "folder non-tanggal tidak disentuh");
    console.log("ok  penyimpanan: file yatim aman untuk sesi aktif, sesi kedaluwarsa dibersihkan sejak start, ringkasan & hapus arsip lama");
    done(0);
  } catch (e) { console.error("GAGAL:", e.message, "\n", log.slice(-600)); done(1); }
})();
