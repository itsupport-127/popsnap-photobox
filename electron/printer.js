// ==========================================================
// printer — cetak foto ke printer Windows (printer lokal langsung ATAU printer sharing \\PC\NAMA yang sudah ditambahkan ke Windows).
//   list()      daftar printer yang dikenal Windows
//   addShare()  tambahkan printer sharing (\\PC\NAMA) ke Windows
//   print()     cetak satu gambar tanpa dialog (silent), dengan skala / geser / salinan / sharpening
//   testPage()  halaman uji untuk mengecek posisi cetak
// Gambar dirender di jendela tersembunyi (HTML + CSS), lalu dicetak lewat webContents.print.
// ==========================================================
const { BrowserWindow } = require("electron");
const { execFile } = require("child_process");
const fs = require("fs");
const os = require("os");
const path = require("path");

const SHARPEN = { none: 0, low: 0.15, medium: 0.3, high: 0.5 };

async function list(win) {
  const ps = await win.webContents.getPrintersAsync();
  return ps.map((p) => ({ name: p.name, displayName: p.displayName || p.name, isDefault: !!p.isDefault, status: p.status }));
}

function addShare(unc) {
  return new Promise((resolve) => {
    if (process.platform !== "win32") return resolve({ ok: false, error: "Hanya untuk Windows." });
    if (!/^\\\\[\w.\-$]+\\[^\\/:*?"<>|]{1,100}$/.test(unc)) return resolve({ ok: false, error: "Format harus \\\\NAMA-PC\\NAMA-PRINTER (contoh: \\\\KASIR-PC\\EPSON-L805)." });
    execFile("rundll32", ["printui.dll,PrintUIEntry", "/in", "/n" + unc], { windowsHide: true, timeout: 45000 }, (err) => {
      resolve(err ? { ok: false, error: "Gagal menambahkan printer. Pastikan PC induk menyala, printer di-share, dan Anda satu jaringan." } : { ok: true });
    });
  });
}

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

// Penggaris tepi: persegi panjang bersarang tiap 1 mm dari tepi kertas (1..6). Angka TERKECIL yang garisnya tampak utuh di sebuah sisi
// = berapa mm sisi itu terpotong (batas area cetak printer / driver tidak "Borderless").
function ruler(color) {
  const rings = [1, 2, 3, 4, 5, 6, 7, 8].map((i) => `<div style="position:absolute;left:${i}mm;top:${i}mm;right:${i}mm;bottom:${i}mm;border:0.25mm solid ${color}"></div>`).join("");
  const nums = [1, 2, 3, 4, 5, 6, 7, 8].map((i) => { const o = `calc(12% + ${i * 9}%)`; const t = `position:absolute;font:1.7mm sans-serif;line-height:1;background:#fff;color:${color};padding:0 .3mm`;
    return `<span style="${t};left:${o};top:${i - 0.9}mm">${i}</span><span style="${t};left:${o};bottom:${i - 0.9}mm">${i}</span><span style="${t};top:${o};left:${i - 0.4}mm">${i}</span><span style="${t};top:${o};right:${i - 0.4}mm">${i}</span>`; }).join("");
  return { rings, nums };
}
// Bagian HTML yang sama untuk cetak foto & halaman uji
function pageHtml({ body, scale, scaleY, x, y, script = "", pre = "" }) {
  const sc = Math.max(0.5, Math.min(1.5, (Number(scale) || 100) / 100));
  const scy = Number(scaleY) > 0 ? Math.max(0.5, Math.min(1.5, Number(scaleY) / 100)) : sc; // skala vertikal terpisah (kalibrasi); 0 = ikut skala
  const tx = Math.max(-100, Math.min(100, Number(x) || 0)), ty = Math.max(-100, Math.min(100, Number(y) || 0));
  return `<!doctype html><html><head><meta charset="utf-8"><style>
@page { size: auto; margin: 0 }
html, body { margin: 0; width: 100%; height: 100%; overflow: hidden; background: #fff }
#w { position: absolute; inset: 0; transform: translate(${tx / 2}%, ${ty / 2}%) scale(${sc}, ${scy}); transform-origin: center; display: flex }
#w img { flex: 1 1 0; min-width: 0; height: 100%; display: block }
</style></head><body><div id="w">${body}</div>${pre}<script>${script}</script></body></html>`;
}

// Ukuran kertas (mikron) -> dikirim ke printer. "auto" = ikuti bawaan printer (sering berbeda dari yang dipilih di Printing Preferences).
const PAPER = { "2x6": [50800, 152400], "4x6": [101600, 152400], "5x7": [127000, 177800], "6x8": [152400, 203200], a5: [148000, 210000], "8x10": [203200, 254000], a4: [210000, 297000] };

async function printHtml(html, { deviceName, copies = 1, landscape = false, files = {}, probe, paper }) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "popsnap-print-"));
  const w = new BrowserWindow({ show: false, width: 1200, height: 1800, webPreferences: { sandbox: true, javascript: true, offscreen: false } });
  try {
    for (const [n, buf] of Object.entries(files)) fs.writeFileSync(path.join(dir, n), buf);
    const f = path.join(dir, "p.html"); fs.writeFileSync(f, html);
    await w.loadFile(f);
    let land = landscape;
    if (probe) { const r = await w.webContents.executeJavaScript(probe); if (r && typeof r.landscape === "boolean") land = r.landscape; }
    return await new Promise((resolve) => {
      w.webContents.print({ silent: true, printBackground: true, deviceName: deviceName || undefined, copies: Math.max(1, Math.min(9, copies | 0 || 1)), landscape: land, margins: { marginType: "none" }, ...(PAPER[paper] ? { pageSize: { width: PAPER[paper][0], height: PAPER[paper][1] } } : {}) },
        (ok, why) => resolve(ok ? { ok: true } : { ok: false, error: why === "cancelled" ? "Pencetakan dibatalkan." : `Printer menolak: ${why || "tidak diketahui"}` }));
    });
  } catch (e) { return { ok: false, error: e.message }; }
  finally { try { w.destroy(); } catch { /* sudah ditutup */ } try { fs.rmSync(dir, { recursive: true, force: true }); } catch { /* abaikan */ } }
}

// Garis panduan untuk tes cetak dengan template asli: digambar di tepi KERTAS (tidak ikut skala / geser gambar).
// Garis merah luar tepat di tepi kertas; bila hilang di satu sisi, sisi itu terpotong. Ring 3 mm putus-putus, tanda sudut, dan silang tengah.
function guidesHtml(label) {
  const L = "position:absolute;pointer-events:none;";
  const corner = (pos) => { const [v, h] = pos; return `<div style="${L}${v}:0;${h}:0;width:6mm;height:6mm;border-${v}:0.35mm solid #e00;border-${h}:0.35mm solid #e00"></div>`; };
  return `<div style="${L}inset:0;z-index:9">
    <div style="${L}inset:0.2mm;border:0.3mm solid #e00"></div>
    <div style="${L}inset:3mm;border:0.25mm dashed #e00"></div>
    ${[["top", "left"], ["top", "right"], ["bottom", "left"], ["bottom", "right"]].map(corner).join("")}
    <div style="${L}left:0;right:0;top:50%;border-top:0.2mm dashed rgba(224,0,0,.7)"></div><div style="${L}top:0;bottom:0;left:50%;border-left:0.2mm dashed rgba(224,0,0,.7)"></div>
    <div style="${L}left:50%;bottom:6mm;transform:translateX(-50%);font:2.6mm sans-serif;background:#fff;color:#c00;padding:0.4mm 1.4mm;white-space:nowrap">${esc(label)}</div>
  </div>`;
}

/** o: { dataUrl, printer, scale, x, y, copies, sharpening, fit: "fill"|"fit", autorotate, dup, guides } */
async function print(o) {
  const m = /^data:image\/(png|jpeg);base64,(.+)$/.exec(String(o.dataUrl || ""));
  if (!m) return { ok: false, error: "Gambar tidak valid." };
  const k = SHARPEN[o.sharpening] ?? 0;
  const fit = o.fit === "fit" ? "contain" : "cover";
  const script = `
(async () => {
  const img = new Image(); img.src = window.__src; await img.decode(); // data: URL (file:// membuat canvas "tainted")
  let src = img.src;
  const K = ${k};
  if (K > 0) try {
    const L = Math.max(img.naturalWidth, img.naturalHeight), r = L > 3600 ? 3600 / L : 1;
    const w = Math.round(img.naturalWidth * r), h = Math.round(img.naturalHeight * r);
    const c = document.createElement("canvas"); c.width = w; c.height = h;
    const g = c.getContext("2d"); g.drawImage(img, 0, 0, w, h);
    const d = g.getImageData(0, 0, w, h), a = d.data, o = new Uint8ClampedArray(a);
    for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) { const i = (y * w + x) * 4;
      for (let ch = 0; ch < 3; ch++) { const p = i + ch;
        o[p] = a[p] * (1 + 4 * K) - K * (a[p - 4] + a[p + 4] + a[p - w * 4] + a[p + w * 4]); } }
    d.data.set(o); g.putImageData(d, 0, 0);
    src = await new Promise((res) => c.toBlob((b) => res(URL.createObjectURL(b)), "image/png"));
  } catch (e) { src = img.src; }
  for (const el of document.querySelectorAll("#w img")) { el.style.objectFit = "${fit}"; el.src = src; await el.decode().catch(() => {}); }
  window.__info = { w: img.naturalWidth, h: img.naturalHeight };
})();`;
  const body = o.dup ? '<img><img>' : '<img>';
  const pre = (o.guides ? guidesHtml("TES CETAK — garis merah luar hilang di satu sisi = sisi itu terpotong") : "") + '<script src="d.js"></script>';
  const html = pageHtml({ body, scale: o.scale, scaleY: o.scaleY, x: o.x, y: o.y, script, pre });
  const dataJs = Buffer.from("window.__src=" + JSON.stringify(o.dataUrl) + ";");
  // tunggu skrip selesai (window.__info terisi) lalu tentukan orientasi kertas dari bentuk gambar
  const rot = !!o.autorotate && !o.dup; // strip 2x6 dobel selalu tegak
  const probe = `new Promise((res) => { const t = setInterval(() => { if (window.__info) { clearInterval(t); res({ landscape: ${rot} && window.__info.w > window.__info.h }); } }, 50); setTimeout(() => { clearInterval(t); res({}); }, 20000); })`;
  return printHtml(html, { deviceName: o.printer, copies: o.copies, files: { "d.js": dataJs }, probe, paper: o.paper });
}

async function testPage(o) {
  const lab = o.calibrate ? `${esc(o.printer || "(printer bawaan Windows)")} — LEMBAR KALIBRASI (tanpa skala / geser aplikasi)` : `${esc(o.printer || "(printer bawaan Windows)")} — skala ${o.scale}%${o.scaleY ? "/" + o.scaleY + "%" : ""} · geser ${o.x}/${o.y}`;
  const { rings, nums } = ruler("#000");
  const body = `<div style="flex:1;position:relative;box-sizing:border-box;border:3px solid #000;font:14px sans-serif">${rings}${nums}
    <div style="position:absolute;left:0;right:0;top:50%;border-top:1px dashed #888"></div><div style="position:absolute;top:0;bottom:0;left:50%;border-left:1px dashed #888"></div>
    <div style="position:absolute;left:8mm;top:8mm;background:#fff">KIRI-ATAS</div><div style="position:absolute;right:8mm;top:8mm;background:#fff">KANAN-ATAS</div>
    <div style="position:absolute;left:8mm;bottom:8mm;background:#fff">KIRI-BAWAH</div><div style="position:absolute;right:8mm;bottom:8mm;background:#fff">KANAN-BAWAH</div>
    <div style="position:absolute;left:20mm;right:6mm;top:44%;text-align:center;font-size:18px;font-weight:700">POPSNAP — TES CETAK</div>
    <div style="position:absolute;left:20mm;right:6mm;top:52%;text-align:center;font-size:11px">${lab}</div>
    <div style="position:absolute;left:20mm;top:70%;width:70mm;border-top:0.3mm solid #000;height:3mm;border-left:0.3mm solid #000;border-right:0.3mm solid #000;box-sizing:border-box"></div>
    <div style="position:absolute;left:20mm;width:70mm;top:calc(70% + 3.5mm);text-align:center;font-size:9px">garis ukur 70 mm (mendatar)</div>
    <div style="position:absolute;left:10mm;top:50%;height:120mm;margin-top:-60mm;border-left:0.3mm solid #000;width:3mm;border-top:0.3mm solid #000;border-bottom:0.3mm solid #000;box-sizing:border-box"></div>
    <div style="position:absolute;left:14mm;top:50%;transform:translateY(-50%);font-size:9px;writing-mode:vertical-rl">garis ukur 120 mm (tegak)</div>
    <div style="position:absolute;left:20mm;right:6mm;top:60%;text-align:center;font-size:10px;color:#333">Garis bernomor = jarak dari tepi kertas (mm). Angka terkecil yang tampak utuh di tiap sisi = mm yang terpotong di sisi itu.</div></div>`;
  return printHtml(pageHtml({ body, scale: o.scale, scaleY: o.scaleY, x: o.x, y: o.y }), { deviceName: o.printer, copies: 1, paper: o.paper });
}

module.exports = { list, addShare, print, testPage };
