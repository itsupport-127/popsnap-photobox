// Uji: ubah harga template massal (PUT /api/templates/prices): izin, validasi, atomik, log aktivitas, batalkan.
//   node test/template-prices.js
const os = require("os"), fs = require("fs"), path = require("path"), assert = require("assert"), { spawn } = require("child_process");
const DATA = fs.mkdtempSync(path.join(os.tmpdir(), "booth-")); process.env.POPSNAP_DATA = DATA;

(async () => {
  const db = require("../db");
  const ins = db.prepare("INSERT INTO templates (id, name, category, background_url, canvas_width, canvas_height, price, favorite) VALUES (?, ?, 'PhotoBox', '/x.png', 1200, 1800, ?, ?)");
  ins.run("t1", "Strip A", 25000, 1); ins.run("t2", "Strip B", 30000, 1); ins.run("t3", "Kotak C", 0, 0);
  db.close?.();
  const PORT = 4900 + Math.floor(Math.random() * 90), B = `http://127.0.0.1:${PORT}`;
  const srv = spawn(process.execPath, [path.join(__dirname, "..", "server.js")], { env: { ...process.env, PORT: String(PORT), POPSNAP_DATA: DATA }, stdio: ["ignore", "pipe", "pipe"] });
  let log = ""; srv.stdout.on("data", (d) => (log += d)); srv.stderr.on("data", (d) => (log += d));
  for (let i = 0; i < 60; i++) { try { await fetch(B + "/api/health"); break; } catch { await new Promise((r) => setTimeout(r, 250)); } }
  const done = (code) => { srv.kill(); process.exit(code); };
  try {
    const setup = await (await fetch(B + "/api/auth/setup", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ username: "admin1", password: "Rahasia123!", storeName: "T" }) })).json();
    const H = { "Content-Type": "application/json", Authorization: "Bearer " + setup.token };
    const put = (items, extra = {}, h = H) => fetch(B + "/api/templates/prices", { method: "PUT", headers: h, body: JSON.stringify({ items, ...extra }) }).then(async (r) => ({ status: r.status, body: await r.json().catch(() => ({})) }));
    const prices = async () => Object.fromEntries((await (await fetch(B + "/api/templates")).json()).map((t) => [t.id, t.price]));

    assert.strictEqual((await put([{ id: "t1", price: 1 }], {}, { "Content-Type": "application/json" })).status, 401, "tanpa login harus ditolak");
    // validasi: tidak ada yang berubah kalau satu item buruk
    for (const bad of [[], "x", [{ id: "t1", price: -1 }], [{ id: "t1", price: "abc" }], [{ id: "t1", price: 10_000_001 }], [{ price: 5 }], [{ id: "t1", price: 40000 }, { id: "tidakada", price: 1 }]]) {
      const r = await put(bad); assert([400, 404].includes(r.status), "harus ditolak: " + JSON.stringify(bad) + " -> " + r.status);
    }
    assert.deepStrictEqual(await prices(), { t1: 25000, t2: 30000, t3: 0 }, "penolakan tidak boleh mengubah apa pun (atomik)");

    const r1 = await put([{ id: "t1", price: 35000 }, { id: "t2", price: 35000 }, { id: "t3", price: 0 }]);
    assert.strictEqual(r1.status, 200); assert.strictEqual(r1.body.changed.length, 2); assert.strictEqual(r1.body.unchanged, 1);
    assert.deepStrictEqual(await prices(), { t1: 35000, t2: 35000, t3: 0 });
    assert.deepStrictEqual(r1.body.changed.map((c) => [c.id, c.from, c.to]), [["t1", 25000, 35000], ["t2", 30000, 35000]]);
    // pembulatan desimal & gratiskan
    assert.strictEqual((await put([{ id: "t3", price: 4999.6 }, { id: "t1", price: 0 }])).status, 200);
    assert.deepStrictEqual(await prices(), { t1: 0, t2: 35000, t3: 5000 });
    // batalkan = kirim harga lama
    const r3 = await put(r1.body.changed.map((c) => ({ id: c.id, price: c.from })), { undo: true });
    assert.strictEqual(r3.status, 200); assert.deepStrictEqual(await prices(), { t1: 25000, t2: 30000, t3: 5000 });
    // log aktivitas
    const act = await (await fetch(B + "/api/admin/activity?limit=50", { headers: H })).json();
    const acts = (act.rows || act.items || act).map((a) => a.action);
    assert(acts.includes("template.price.bulk") && acts.includes("template.price.undo"), "harus tercatat di log: " + acts.join(","));
    console.log("ok  harga template massal: login wajib, validasi atomik, ubah/gratiskan/bulatkan, batalkan, tercatat di log");
    done(0);
  } catch (e) { console.error("GAGAL:", e.message, "\n", log.slice(-600)); done(1); }
})();
