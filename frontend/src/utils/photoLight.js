// "Auto cahaya foto": mengukur kecerahan foto hasil jepret (bagian tengah, tempat wajah) lalu menggeser gamma-nya ke arah target.
// Terpisah dari live view (live view punya pengaturan sendiri). Hanya membantu selisih kecil: foto yang sangat gelap / terbakar tidak bisa dipulihkan.
import { lookFilter } from "./liveLook";

export const PHOTO_LIGHT_DEFAULT = { auto: false, target: 120, maxPct: 40 };

/** Rata-rata kecerahan (0-255) bagian tengah gambar (60% tengah, supaya latar putih / lampu tidak mengacaukan). */
export function centerLuma(img) {
  const W = 96, H = Math.max(1, Math.round((img.naturalHeight / Math.max(1, img.naturalWidth)) * W));
  const c = document.createElement("canvas");
  c.width = W; c.height = H;
  const ctx = c.getContext("2d", { willReadFrequently: true });
  ctx.drawImage(img, 0, 0, W, H);
  const x0 = Math.round(W * 0.2), y0 = Math.round(H * 0.2), w = Math.max(1, Math.round(W * 0.6)), h = Math.max(1, Math.round(H * 0.6));
  const d = ctx.getImageData(x0, y0, w, h).data;
  let sum = 0;
  for (let i = 0; i < d.length; i += 4) sum += 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
  return sum / (d.length / 4);
}

/** Eksponen gamma (out = in^e) yang menggeser rata-rata `luma` ke `target`, dibatasi ±maxPct %. 1 = tidak perlu koreksi. */
export function gammaFor(luma, target, maxPct = 40) {
  if (!(luma > 8) || !(luma < 247)) return 1; // hampir hitam / putih polos: koreksi tidak masuk akal
  const t = Math.min(0.9, Math.max(0.2, target / 255));
  let e = Math.log(t) / Math.log(luma / 255);
  const m = 1 + Math.min(100, Math.max(0, maxPct)) / 100;
  e = Math.min(m, Math.max(1 / m, e));
  return Math.abs(e - 1) < 0.05 ? 1 : e;
}

/** Terapkan koreksi ke foto (data URL). Mengembalikan { photo, luma, gamma }; kalau tidak perlu / gagal, foto asli. */
export async function autoLightPhoto(src, cfg = {}) {
  const o = { ...PHOTO_LIGHT_DEFAULT, ...cfg };
  if (!o.auto || !src) return { photo: src, luma: null, gamma: 1 };
  try {
    const img = new Image();
    img.src = src;
    await img.decode();
    const luma = centerLuma(img);
    const e = gammaFor(luma, o.target, o.maxPct);
    if (e === 1) return { photo: src, luma, gamma: 1 };
    const c = document.createElement("canvas");
    c.width = img.naturalWidth; c.height = img.naturalHeight;
    const ctx = c.getContext("2d");
    const f = lookFilter(1 / e);
    if (!f) return { photo: src, luma, gamma: 1 };
    ctx.filter = f;
    ctx.drawImage(img, 0, 0);
    ctx.filter = "none";
    return { photo: c.toDataURL("image/jpeg", 0.93), luma, gamma: e };
  } catch {
    return { photo: src, luma: null, gamma: 1 };
  }
}
