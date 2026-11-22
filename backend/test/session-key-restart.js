// Uji: kunci unggah sesi TETAP berlaku setelah aplikasi di-restart di tengah sesi (GIF / foto mentah / klip yang menyusul tidak boleh ditolak).
//   node test/session-key-restart.js
const os = require("os"), fs = require("fs"), path = require("path"), assert = require("assert"), { spawn } = require("child_process");
const DATA = fs.mkdtempSync(path.join(os.tmpdir(), "booth-")), OUT = path.join(DATA, "output");
const PORT = 4800 + Math.floor(Math.random() * 100), B = `http://127.0.0.1:${PORT}`;
let log = "", srv;
const start = async () => {
  srv = spawn(process.execPath, [path.join(__dirname, "..", "server.js")], { env: { ...process.env, PORT: String(PORT), POPSNAP_DATA: DATA, OUTPUT_DIR: OUT }, stdio: ["ignore", "pipe", "pipe"] });
  srv.stdout.on("data", (x) => (log += x)); srv.stderr.on("data", (x) => (log += x));
  for (let i = 0; i < 80; i++) { try { await fetch(B + "/api/health"); return; } catch { await new Promise((r) => setTimeout(r, 250)); } }
  throw new Error("server tidak naik: " + log.slice(-300));
};
const stop = () => new Promise((r) => { srv.once("exit", r); srv.kill(); });
const shots = (id, key) => fetch(B + "/api/session/shots", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ sessionId: id, key, offset: 0, shots: [] }) });
(async () => {
  try {
    await start();
    const r = await fetch(B + "/api/session/finish", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ sessionId: "SESI-RESTART-1", templateId: "t35", paymentMethod: "free" }) });
    assert.strictEqual(r.status, 200, "finish gagal: " + log.slice(-300));
    const key = (await r.json()).uploadKey; assert(key, "uploadKey harus ada");
    assert.notStrictEqual((await shots("SESI-RESTART-1", "kunci-salah")).status, 200); // kunci salah tetap ditolak
    await stop(); await start(); // restart aplikasi di tengah sesi
    const after = await shots("SESI-RESTART-1", key);
    assert.notStrictEqual(after.status, 403, "setelah restart, kunci sesi harus masih berlaku. log=" + log.slice(-300));
    console.log("ok  kunci unggah sesi bertahan setelah restart aplikasi");
    const bad = await shots("SESI-RESTART-1", "kunci-salah"); assert.strictEqual(bad.status, 403);
    const none = await shots("SESI-TIDAK-ADA", key); assert.strictEqual(none.status, 403);
    assert(/\[upload\] foto mentah DITOLAK sesi SESI-RESTART-1: kunci tidak cocok/.test(log) && /kunci sesi tidak ditemukan/.test(log), "penolakan harus tercatat di log. log=" + log.slice(-400));
    console.log("ok  kunci salah / sesi tak dikenal tetap ditolak, dan penolakan tercatat di log dengan alasannya");
    await stop(); process.exit(0);
  } catch (e) { console.error("GAGAL:", e.message); try { srv.kill(); } catch { /* */ } process.exit(1); }
})();
