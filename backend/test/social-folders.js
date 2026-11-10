// Uji: penanda izin foto di folder output (_BOLEH-SOSMED / _BOLEH-MADING / _TIDAK-BOLEH), tanpa perlu membuka aplikasi.
//   node test/social-folders.js
const os = require("os"), fs = require("fs"), path = require("path"), assert = require("assert"), { spawn } = require("child_process");
const DATA = fs.mkdtempSync(path.join(os.tmpdir(), "booth-")), OUT = path.join(DATA, "output");
const d = new Date(), DATE = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

(async () => {
  fs.mkdirSync(path.join(OUT, DATE, "SESI-A1"), { recursive: true });
  fs.writeFileSync(path.join(OUT, DATE, "SESI-A1", "hasil.jpg"), "foto");
  const PORT = 4900 + Math.floor(Math.random() * 100), B = `http://127.0.0.1:${PORT}`;
  const srv = spawn(process.execPath, [path.join(__dirname, "..", "server.js")], { env: { ...process.env, PORT: String(PORT), POPSNAP_DATA: DATA, OUTPUT_DIR: OUT }, stdio: ["ignore", "pipe", "pipe"] });
  let log = ""; srv.stdout.on("data", (x) => (log += x)); srv.stderr.on("data", (x) => (log += x));
  for (let i = 0; i < 60; i++) { try { await fetch(B + "/api/health"); break; } catch { await new Promise((r) => setTimeout(r, 250)); } }
  const finish = (consent) => fetch(B + "/api/session/finish", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ sessionId: "SESI-A1", socialConsent: consent }) });
  const ls = (dir) => { try { return fs.readdirSync(path.join(OUT, dir)).sort(); } catch { return []; } };
  const wait = async (fn) => { for (let i = 0; i < 20 && !fn(); i++) await new Promise((r) => setTimeout(r, 250)); };
  const done = (code) => { srv.kill(); process.exit(code); };
  try {
    // 1) tamu menolak -> hanya folder kosong penanda, TANPA salinan foto
    assert((await finish(0)).status === 200, "finish gagal: " + log.slice(-300));
    await wait(() => ls("_TIDAK-BOLEH").length);
    assert.deepStrictEqual(ls("_TIDAK-BOLEH"), [`${DATE}_SESI-A1_TIDAK-BOLEH`], "penanda tolak. log=" + log.slice(-300));
    assert.deepStrictEqual(fs.readdirSync(path.join(OUT, "_TIDAK-BOLEH", `${DATE}_SESI-A1_TIDAK-BOLEH`)), [], "folder penanda tolak harus kosong (tidak menyalin foto)");
    assert(!ls("_BOLEH-MADING").length && !ls("_BOLEH-SOSMED").length, "tidak boleh ada di folder BOLEH");

    // 2) tamu berubah pikiran: boleh sosmed + mading -> salinan di dua folder BOLEH, penanda tolak hilang
    assert((await finish(3)).status === 200);
    await wait(() => ls("_BOLEH-MADING").length && !ls("_TIDAK-BOLEH").length);
    assert.deepStrictEqual(ls("_BOLEH-MADING"), [`${DATE}_SESI-A1_SOSMED+MADING`]);
    assert.deepStrictEqual(ls("_BOLEH-SOSMED"), [`${DATE}_SESI-A1_SOSMED+MADING`]);
    assert(fs.existsSync(path.join(OUT, "_BOLEH-MADING", `${DATE}_SESI-A1_SOSMED+MADING`, "hasil.jpg")), "foto harus tersalin ke folder mading");
    assert.deepStrictEqual(ls("_TIDAK-BOLEH"), [], "penanda tolak harus dihapus saat izin berubah");
    assert.deepStrictEqual(ls("_BOLEH-KEDUANYA"), [`${DATE}_SESI-A1_KEDUANYA`], "boleh keduanya harus ada penandanya");
    assert.deepStrictEqual(fs.readdirSync(path.join(OUT, "_BOLEH-KEDUANYA", `${DATE}_SESI-A1_KEDUANYA`)), [], "penanda keduanya kosong (foto sudah ada di dua folder BOLEH)");

    // 2b) sosmed saja -> hanya folder sosmed; penanda keduanya hilang
    assert((await finish(1)).status === 200);
    await wait(() => !ls("_BOLEH-MADING").length);
    assert.deepStrictEqual(ls("_BOLEH-SOSMED"), [`${DATE}_SESI-A1_SOSMED`]);
    assert.deepStrictEqual(ls("_BOLEH-MADING"), [], "mading harus kosong kalau hanya sosmed");
    assert.deepStrictEqual(ls("_BOLEH-KEDUANYA"), [], "penanda keduanya harus hilang");

    // 3) folder asli sesi tidak pernah diubah
    assert(fs.existsSync(path.join(OUT, DATE, "SESI-A1", "hasil.jpg")), "folder asli harus utuh");
    console.log("ok  penanda izin di folder: SOSMED / MADING / KEDUANYA / TIDAK-BOLEH, ikut berubah saat izin diganti, folder asli utuh");
    done(0);
  } catch (e) { console.error("GAGAL:", e.message); done(1); }
})();
