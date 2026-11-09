// Uji: diskon kasir di booth (cek harga, QRIS dengan harga setelah diskon, kode salah/kasir mati, pengiriman meta ke kasir).
//   node test/discount.js
const os = require("os"), fs = require("fs"), path = require("path"), http = require("http"), assert = require("assert"), { spawn } = require("child_process");
const DATA = fs.mkdtempSync(path.join(os.tmpdir(), "booth-")); process.env.POPSNAP_DATA = DATA;

(async () => {
  let quotes = [], pushed = [], kasirDown = false;
  const kasir = http.createServer((req, res) => {
    let body = ""; req.on("data", (c) => (body += c)); req.on("end", () => {
      res.setHeader("Content-Type", "application/json");
      if (kasirDown) { res.statusCode = 503; return res.end("{}"); }
      const j = body ? JSON.parse(body) : {};
      if (req.url === "/api/photobox/discount/quote") {
        quotes.push(j);
        const code = String(j.code || "").toUpperCase(), g = j.amount; let auto = null, cd = null;
        auto = { id: 1, name: "Promo Pagi", discount: 2000 };
        if (code === "HEMAT5") cd = { id: 2, code: "HEMAT5", name: "Hemat 5rb", discount: 5000 };
        else if (code) return res.end(JSON.stringify({ ok: false, error: "Kode diskon tidak ditemukan atau sudah tidak berlaku.", gross: g, discount: 0, final: g, auto: null, code: null }));
        const d = auto.discount + (cd?.discount || 0);
        return res.end(JSON.stringify({ ok: true, gross: g, discount: d, final: g - d, capped: false, auto, code: cd }));
      }
      if (req.url === "/api/photobox/transactions") { pushed.push(...j.transactions); return res.end(JSON.stringify({ ok: true, results: j.transactions.map((t) => ({ order_no: t.order_no, ok: true })) })); }
      if (req.url.startsWith("/api/photobox/changes")) return res.end(JSON.stringify({ ok: true, changes: [], cursor: null }));
      res.statusCode = 404; res.end("{}");
    });
  }).listen(0);

  // siapkan pengaturan & template di folder data, lalu jalankan server sungguhan
  const settings = require("../settings"), db = require("../db");
  settings.update({ payment: { mode: "qris", qris: { simulate: true }, cloud: { enabled: true, url: `http://127.0.0.1:${kasir.address().port}`, token: "tok", studioCode: "ABC", discountEnabled: true } } });
  db.prepare("INSERT INTO templates (id, name, category, background_url, canvas_width, canvas_height, price) VALUES ('t35', 'Tes 35rb', 'PhotoBox', '/x.png', 1200, 1800, 35000)").run();
  // transaksi "uang asli" (bukan simulasi) yang sudah lunas: harus terkirim ke kasir lengkap dengan meta diskon
  const REAL = "PB-ABC-261109-9001", nowIso = new Date().toISOString();
  db.prepare(`INSERT INTO tx_log (order_no, method, mode, template_id, template_name, category, amount, status, created_at, paid_at, updated_at, gross_amount, discount, promo_code, promo_name, is_test)
    VALUES (?, 'qris', 'photo', 't35', 'Tes 35rb', 'PhotoBox', 28000, 'paid', ?, ?, ?, 35000, 7000, 'HEMAT5', 'Promo Pagi + Hemat 5rb', 0)`).run(REAL, nowIso, nowIso, nowIso);
  db.close?.();
  const PORT = 4700 + Math.floor(Math.random() * 200), B = `http://127.0.0.1:${PORT}`;
  const srv = spawn(process.execPath, [path.join(__dirname, "..", "server.js")], { env: { ...process.env, PORT: String(PORT), POPSNAP_DATA: DATA }, stdio: ["ignore", "pipe", "pipe"] });
  let log = ""; srv.stdout.on("data", (d) => (log += d)); srv.stderr.on("data", (d) => (log += d));
  const j = async (u, body) => { const r = await fetch(B + u, { method: body ? "POST" : "GET", headers: { "Content-Type": "application/json" }, body: body ? JSON.stringify(body) : undefined }); return { status: r.status, body: await r.json().catch(() => ({})) }; };
  for (let i = 0; i < 60; i++) { try { await fetch(B + "/api/health"); break; } catch { await new Promise((r) => setTimeout(r, 250)); } }
  const done = (code) => { srv.kill(); kasir.close(); process.exit(code); };
  try {
    const pub = await j("/api/settings/public");
    assert(pub.status === 200, "settings publik: " + pub.status + " " + log.slice(-300));
    // 1) promo otomatis tampil di cek harga
    let q = await j("/api/discount/quote", { templateId: "t35" });
    assert(q.body.enabled && q.body.ok && q.body.final === 33000 && q.body.discount === 2000 && q.body.auto.name === "Promo Pagi", JSON.stringify(q.body));
    assert.strictEqual(quotes.at(-1).amount, 35000, "harga dikirim dari server (template), bukan dari browser");
    // 2) kode benar: dipotong lagi
    q = await j("/api/discount/quote", { templateId: "t35", code: "hemat5" }); assert(q.body.ok && q.body.final === 28000 && q.body.code.code === "HEMAT5", JSON.stringify(q.body));
    // 3) kode salah
    q = await j("/api/discount/quote", { templateId: "t35", code: "NGAWUR" }); assert(q.body.ok === false && /tidak ditemukan/.test(q.body.error), JSON.stringify(q.body));
    // 4) QRIS dibuat dengan harga akhir; nominal dari browser diabaikan
    let p = await j("/api/payment/qris", { templateId: "t35", discountCode: "HEMAT5", amount: 1 });
    assert(p.status === 200 && p.body.amount === 28000 && p.body.grossAmount === 35000 && p.body.discount === 7000, JSON.stringify(p.body));
    const orderA = p.body.orderId;
    // 5) tanpa kode: hanya promo otomatis
    p = await j("/api/payment/qris", { templateId: "t35" }); assert(p.body.amount === 33000 && p.body.discount === 2000, JSON.stringify(p.body));
    // 6) kode salah -> ditolak (tidak diam-diam menagih penuh)
    p = await j("/api/payment/qris", { templateId: "t35", discountCode: "NGAWUR" }); assert(p.status === 400 && /tidak ditemukan/.test(p.body.error), p.status + JSON.stringify(p.body));
    // 7) kasir mati: tanpa kode = harga normal; dengan kode = 502 dengan pesan jelas
    kasirDown = true;
    p = await j("/api/payment/qris", { templateId: "t35" }); assert(p.status === 200 && p.body.amount === 35000 && !p.body.discount, "kasir mati tanpa kode harus harga normal: " + JSON.stringify(p.body));
    p = await j("/api/payment/qris", { templateId: "t35", discountCode: "HEMAT5" }); assert(p.status === 502 && /kasir tidak terjangkau/.test(p.body.error), p.status + JSON.stringify(p.body));
    q = await j("/api/discount/quote", { templateId: "t35" }); assert(q.body.unreachable === true && q.body.ok === false, JSON.stringify(q.body));
    kasirDown = false;
    // 8) transaksi uang asli yang lunas -> terkirim ke kasir dengan meta diskon & amount = yang dibayar
    for (let i = 0; i < 40 && !pushed.find((t) => t.order_no === REAL); i++) await new Promise((r) => setTimeout(r, 500));
    const t = pushed.find((x) => x.order_no === REAL);
    assert(t, "transaksi lunas harus terkirim ke kasir. log=" + log.slice(-300));
    assert(t.amount === 28000 && t.meta?.discount === 7000 && t.meta.gross_amount === 35000 && t.meta.promo_code === "HEMAT5" && /Promo Pagi/.test(t.meta.promo_name), JSON.stringify(t));
    // 9) transaksi SIMULASI (is_test) ikut terkirim ke kasir TAPI bertanda is_test (kasir menampilkan label TEST & tidak menghitungnya); yang asli bertanda false
    for (let i = 0; i < 40 && !pushed.find((x) => x.order_no === orderA); i++) await new Promise((r) => setTimeout(r, 500));
    const sim = pushed.find((x) => x.order_no === orderA);
    assert(sim, "transaksi simulasi harus tetap terkirim ke kasir (riwayat). log=" + log.slice(-300));
    assert(sim.is_test === true, "transaksi simulasi harus bertanda is_test: " + JSON.stringify(sim));
    assert(t.is_test === false, "transaksi uang asli tidak boleh bertanda is_test: " + JSON.stringify(t));
    console.log("ok  diskon kasir: promo otomatis, kode benar/salah, harga dari server, kasir mati, meta terkirim ke kasir, transaksi simulasi terkirim bertanda TEST");
    done(0);
  } catch (e) { console.error("GAGAL:", e.message, "\n--- log server ---\n" + log.slice(-600)); done(1); }
})();
