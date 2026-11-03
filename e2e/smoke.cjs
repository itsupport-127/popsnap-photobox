// Uji asap (smoke test): satu sesi penuh di booth — Start, pilih template, voucher, foto, pilih foto, stiker, sampai layar hasil.
// Gagal (exit 1) bila ada error halaman, langkah macet, atau layar hasil tidak muncul. Pakai kamera palsu Chromium (tanpa webcam).
//   Syarat: backend dan frontend sudah jalan, ada minimal satu template aktif, kamera mode webcam.
//   Jalankan: cd e2e && npm i playwright && node smoke.cjs      (ubah alamat lewat env di bawah)
//   env: POPSNAP_URL (frontend, bawaan http://127.0.0.1:5173)  POPSNAP_API (bawaan http://127.0.0.1:4000)
//        ADMIN_USER / ADMIN_PASS (bawaan admin / Admin12345)   SHAPE=landscape|portrait|square (bawaan portrait)
const { chromium } = require("playwright");
const URL_ = process.env.POPSNAP_URL || "http://127.0.0.1:5173", API = process.env.POPSNAP_API || "http://127.0.0.1:4000";
const SIZE = { landscape: [1728, 1117], portrait: [1080, 1920], square: [1200, 1200] }[process.env.SHAPE || "portrait"];

const fail = (m) => { console.error("GAGAL:", m); process.exitCode = 1; };
(async () => {
  const lr = await fetch(`${API}/api/auth/login`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ username: process.env.ADMIN_USER || "admin", password: process.env.ADMIN_PASS || "Admin12345" }) }).then((r) => r.json());
  if (!lr.token) return fail("login admin gagal (cek ADMIN_USER / ADMIN_PASS)");
  let code = "";
  for (let i = 0; i < 8; i++) { // hindari huruf "C": di keypad angka tombol itu = hapus semua
    const v = await fetch(`${API}/api/voucher/generate`, { method: "POST", headers: { Authorization: `Bearer ${lr.token}`, "Content-Type": "application/json" }, body: JSON.stringify({ count: 1, maxUses: 0 }) }).then((r) => r.json());
    code = JSON.stringify(v).match(/"code":"([A-Z0-9]+)"/)?.[1] || "";
    if (code && !code.includes("C")) break;
  }
  if (!code) return fail("voucher tidak bisa dibuat");

  const b = await chromium.launch({ args: ["--use-fake-device-for-media-stream", "--use-fake-ui-for-media-stream"] });
  const p = await (await b.newContext({ viewport: { width: SIZE[0], height: SIZE[1] } })).newPage();
  const errs = [];
  p.on("pageerror", (e) => errs.push(String(e).slice(0, 160)));
  const step = (m) => console.log(`[smoke] ${m}`);
  const click = (sel, t = 5000) => p.click(sel, { timeout: t, force: true });
  const text = () => p.innerText("body");
  try {
    await p.goto(URL_); await p.waitForTimeout(2500);
    await click("[aria-label=Mulai]"); step("Start");
    await p.getByText(/Photo Strips|Strip|4R|Custom/i).first().click({ timeout: 8000 }); await p.waitForTimeout(600);
    const card = await p.$("img[src*='/uploads/']"); if (!card) throw new Error("tidak ada template untuk dipilih");
    await card.click({ force: true }); await p.getByText("NEXT").first().click({ timeout: 5000 }); step("template dipilih");
    await p.waitForTimeout(800);
    for (const ch of code) await p.getByRole("button", { name: ch, exact: true }).first().click({ timeout: 3000 });
    await p.getByText("NEXT").first().click(); step("voucher dimasukkan");
    // layar aturan / izin -> sesi foto
    for (let i = 0; i < 40 && !(await p.$("[aria-label=Potret]")); i++) { await p.waitForTimeout(1000); const n = p.getByText("NEXT"); if (await n.count()) await n.first().click({ timeout: 1000 }).catch(() => {}); }
    if (!(await p.$("[aria-label=Potret]"))) throw new Error("layar jepret tidak muncul");
    step("layar jepret");
    for (let i = 0; i < 90 && !(await p.$("[aria-label='Pilih foto 1'], [aria-label='Pilih foto 2']")); i++) { // ketuk jepret tiap kali aktif
      const sh = await p.$("[aria-label=Potret]:not([disabled])"); if (sh) await sh.click({ force: true }).catch(() => {});
      await p.waitForTimeout(1500);
    }
    step("foto selesai");
    for (let n = 1; n <= 8; n++) { const el = await p.$(`[aria-label='Pilih foto ${n}']`); if (el) await el.click({ force: true }).catch(() => {}); await p.waitForTimeout(250); }
    for (let i = 0; i < 12; i++) { // NEXT / Selesai sampai layar hasil
      const t = await text(); if (/Finish/.test(t) && /Foto/.test(t)) break;
      const sel = await p.$("[aria-label=Selesai]"); if (sel) await sel.click({ force: true }).catch(() => {});
      else { const nx = p.getByText("NEXT"); if (await nx.count()) await nx.first().click({ timeout: 1500 }).catch(() => {}); }
      await p.waitForTimeout(2500);
    }
    for (let i = 0; i < 40 && !/Finish/.test(await text()); i++) await p.waitForTimeout(1000); // layar tunggu hasil
    if (!/Finish/.test(await text())) throw new Error("layar hasil tidak muncul");
    step("layar hasil tampil");
  } catch (e) { fail(String(e.message || e)); await p.screenshot({ path: "smoke-gagal.png" }).catch(() => {}); }
  if (errs.length) fail(`error halaman: ${errs.join(" | ")}`);
  await b.close();
  if (!process.exitCode) console.log("LULUS: satu sesi penuh sampai layar hasil.");
})();
