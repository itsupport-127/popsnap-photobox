// Uji: mode "Tanpa pembayaran" (booth hanya foto, bayar di kasir): tanpa layar bayar, tapi sesi tetap tercatat di kasir sebagai transaksi Gratis.
//   node test/free-mode.js
const os = require("os"), fs = require("fs"), path = require("path"), http = require("http"), assert = require("assert"), { spawn } = require("child_process");
const DATA = fs.mkdtempSync(path.join(os.tmpdir(), "booth-")); process.env.POPSNAP_DATA = DATA;

(async () => {
  const pushed = [];
  const kasir = http.createServer((req, res) => {
    let body = ""; req.on("data", (c) => (body += c)); req.on("end", () => {
      res.setHeader("Content-Type", "application/json");
      const j = body ? JSON.parse(body) : {};
      if (req.url === "/api/photobox/transactions") { pushed.push(...j.transactions); return res.end(JSON.stringify({ ok: true, results: j.transactions.map((t) => ({ order_no: t.order_no, ok: true })) })); }
      if (req.url.startsWith("/api/photobox/changes")) return res.end(JSON.stringify({ ok: true, changes: [], cursor: null }));
      res.statusCode = 404; res.end("{}");
    });
  }).listen(0);

  const settings = require("../settings"), db = require("../db");
  assert(settings.setPaymentMode("none"), "mode 'none' harus dikenali");
  assert(settings.load().payment.mode === "none");
  assert(!settings.setPaymentMode("ngawur"), "mode tidak valid harus ditolak");
  settings.update({ payment: { cloud: { enabled: true, url: `http://127.0.0.1:${kasir.address().port}`, token: "tok", studioCode: "ABC" } } });
  db.prepare("INSERT INTO templates (id, name, category, background_url, canvas_width, canvas_height, price) VALUES ('t35', 'Strip 35rb', 'PhotoBox', '/x.png', 1200, 1800, 35000)").run();
  db.close?.();
  const PORT = 4900 + Math.floor(Math.random() * 90), B = `http://127.0.0.1:${PORT}`;
  const srv = spawn(process.execPath, [path.join(__dirname, "..", "server.js")], { env: { ...process.env, PORT: String(PORT), POPSNAP_DATA: DATA }, stdio: ["ignore", "pipe", "pipe"] });
  let log = ""; srv.stdout.on("data", (d) => (log += d)); srv.stderr.on("data", (d) => (log += d));
  for (let i = 0; i < 60; i++) { try { await fetch(B + "/api/health"); break; } catch { await new Promise((r) => setTimeout(r, 250)); } }
  const done = (code) => { srv.kill(); kasir.close(); process.exit(code); };
  try {
    // 1) booth: satu "metode" = free (layar bayar dilewati), tanpa peringatan QRIS / sandbox
    const pub = await (await fetch(B + "/api/settings/public")).json();
    assert(pub.payment.mode === "none" && pub.payment.free === true, JSON.stringify(pub.payment));
    assert.deepStrictEqual(pub.payment.methods, ["free"]);
    assert(pub.payment.qrisDown === false && pub.payment.testPayment === false, "tidak boleh ada peringatan QRIS/sandbox di mode ini: " + JSON.stringify(pub.payment));

    // 2) sesi selesai tanpa bayar -> tercatat di kasir: metode free, Rp 0, lunas, ada nama paket (supaya kasir tahu mau menagih apa) + link sesi
    const r = await fetch(B + "/api/session/finish", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ sessionId: "SESI-FREE-1", templateId: "t35", paymentMethod: "free" }) });
    assert(r.status === 200, "finish gagal: " + log.slice(-300));
    for (let i = 0; i < 40 && !pushed.length; i++) await new Promise((x) => setTimeout(x, 500));
    const t = pushed.find((x) => x.session_id === "SESI-FREE-1");
    assert(t, "sesi tanpa bayar harus terkirim ke kasir. log=" + log.slice(-300));
    assert(t.method === "free" && t.amount === 0 && t.status === "paid" && t.template_name === "Strip 35rb" && t.is_test === false, JSON.stringify(t));
    console.log("ok  mode tanpa pembayaran: layar bayar dilewati, sesi tercatat di kasir sebagai Gratis (Rp 0) lengkap dengan nama paket");
    done(0);
  } catch (e) { console.error("GAGAL:", e.message); done(1); }
})();
