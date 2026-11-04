import appConfig from "../config/appConfig";
import { API_BASE } from "./settingsService";

// Cetak ke printer Windows lewat aplikasi desktop (Electron). Di browser biasa tidak ada akses printer -> fallback dialog cetak browser.
const el = () => (typeof window !== "undefined" ? window.electronAPI?.print : null);
export const canSilentPrint = () => !!el();
export const printingCfg = () => appConfig.settings?.printing ?? null;

export async function listPrinters() {
  const p = el();
  if (!p) return { ok: false, error: "Daftar printer hanya tersedia di aplikasi desktop POPSNAP (.exe).", printers: [] };
  return p.list();
}
export const addSharedPrinter = (unc) => (el() ? el().addShare(unc) : Promise.resolve({ ok: false, error: "Hanya di aplikasi desktop." }));

const unitOf = (u) => ({ printer: u.name || "", scale: u.scale, x: u.x, y: u.y });

// Ukuran kertas yang dikirim ke printer. "template" = ikuti ukuran kertas yang tertulis di template (strip dobel -> 4x6);
// template ukuran custom dicocokkan ke kertas baku terdekat menurut rasio. Tidak ketemu -> "auto" (ikuti printer).
const PRESETS = { "2x6": [2, 6], "4x6": [4, 6], "5x7": [5, 7], "6x8": [6, 8], "8x10": [8, 10], a4: [8.27, 11.69] };
export function paperForTemplate(cfg, template, dup) {
  const p = cfg.paper || "auto";
  if (p !== "template") return p;
  if (dup) return "4x6";
  if (PRESETS[template?.paperSize]) return template.paperSize;
  const w = template?.canvasWidth, h = template?.canvasHeight;
  if (!w || !h) return "auto";
  const ar = Math.min(w, h) / Math.max(w, h);
  let best = "auto", bd = 0.03; // selisih rasio maksimum yang masih dianggap sama
  for (const [k, [a, b]] of Object.entries(PRESETS)) { const d = Math.abs(a / b - ar); if (d < bd) { bd = d; best = k; } }
  return best;
}

export async function printTestPage(cfg, which = "main") {
  const p = el();
  if (!p) return { ok: false, error: "Cetak tes hanya di aplikasi desktop POPSNAP (.exe)." };
  return p.test({ ...unitOf(cfg[which]), paper: cfg.paper === "template" ? "auto" : cfg.paper || "auto" });
}

// Printer berikutnya untuk cetak bergantian (printer utama & kedua)
let flip = 0;
function pickUnit(cfg, template) {
  const second = cfg.second.name;
  if (cfg.both && second) return flip++ % 2 === 0 ? cfg.main : cfg.second;
  return cfg.main;
}

// Status printer Windows (bitmask PRINTER_STATUS_*): error, kertas macet, kertas habis, masalah kertas, offline, pintu terbuka.
const PRINTER_BAD = 0x2 | 0x8 | 0x10 | 0x20 | 0x80 | 0x400000;
/** Peringatan untuk layar tamu: printer utama tidak terdeteksi / offline / kertas habis. null = tampak normal atau tidak bisa diperiksa. Hanya peringatan, tidak memblokir cetak. */
export async function printerProblem(cfg = printingCfg(), which = "main") {
  const p = el();
  if (!p || !cfg?.enabled) return null;
  let r; try { r = await p.list(); } catch { return null; }
  if (!r?.ok || !Array.isArray(r.printers) || !r.printers.length) return null;
  const name = cfg[which]?.name;
  const t = name ? r.printers.find((x) => x.name === name) : r.printers.find((x) => x.isDefault);
  if (name && !t) return "Printer tidak terdeteksi. Silakan hubungi CS untuk mencetak.";
  if (t && Number(t.status) & PRINTER_BAD) return "Printer sedang bermasalah (offline atau kertas habis). Silakan hubungi CS untuk mencetak.";
  return null;
}

export async function getQuota(sessionId) {
  try { return await fetch(`${API_BASE}/api/print/quota?sessionId=${encodeURIComponent(sessionId || "")}`).then((r) => r.json()); } catch { return { allowed: 99 }; }
}

/** Cetak hasil akhir. copies = jumlah salinan. Mengembalikan { ok, error? }. Hitungan cetak dicatat di backend (untuk batas per sesi / event). */
export async function printFinal({ dataUrl, sessionId, copies = 1, template }) {
  const cfg = printingCfg();
  if (!cfg?.enabled) return { ok: false, error: "Cetak belum diaktifkan." };
  const q = await getQuota(sessionId);
  if (q.allowed < 1) return { ok: false, error: "Batas cetak tercapai." };
  copies = Math.min(copies, q.allowed);
  const unit = pickUnit(cfg, template);
  const dup = cfg.strip2x6 && (template?.canvasWidth ?? 0) > 0 && (template.canvasHeight / template.canvasWidth) >= 2.5;
  const p = el();
  let r;
  if (p) {
    r = await p.image({ dataUrl, ...unitOf(unit), copies, sharpening: cfg.sharpening, fit: cfg.fit, paper: paperForTemplate(cfg, template, dup), autorotate: cfg.autorotate, dup });
    if (!r.ok && r.error && !/dibatalkan|CS/.test(r.error)) r = { ...r, error: `${r.error} Silakan hubungi CS.` };
  }
  else r = browserPrint(dataUrl);
  if (r.ok) {
    fetch(`${API_BASE}/api/print/record`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ sessionId, copies, printer: unit.name }) }).catch(() => {});
  }
  return r;
}

function browserPrint(dataUrl) {
  const w = window.open("", "_blank", "width=800,height=1000");
  if (!w) return { ok: false, error: "Browser memblokir jendela cetak." };
  w.document.write(`<style>@page{margin:0}html,body{margin:0}img{width:100%;display:block}</style><img src="${dataUrl}" onload="setTimeout(()=>{print();close()},300)">`);
  w.document.close();
  return { ok: true };
}
