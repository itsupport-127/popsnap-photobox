// Salin pengaturan antar PC booth. Yang TIDAK ikut (khusus PC / rahasia): pembayaran (kunci QRIS, kasir, cloud), PIN & keamanan,
// folder data / ekspor, perangkat kamera (webcam / DSLR) dan nama printer, serta daftar filter (punya halaman sendiri).
const FORMAT = "popsnap-settings";
const SECTIONS = ["event", "general", "printing", "camera", "display", "gif", "result", "animated", "boomerang", "video", "session"];

const clone = (o) => JSON.parse(JSON.stringify(o));

export function buildExport(s) {
  const out = {};
  for (const k of SECTIONS) if (s?.[k] !== undefined) out[k] = clone(s[k]);
  if (out.general) { delete out.general.dataDir; delete out.general.export; delete out.general.security; }
  if (out.camera) { delete out.camera.videoDeviceId; delete out.camera.audioDeviceId; delete out.camera.dslr; }
  if (out.printing) { if (out.printing.main) delete out.printing.main.name; if (out.printing.second) delete out.printing.second.name; delete out.printing.both; }
  return { format: FORMAT, version: 1, exportedAt: new Date().toISOString(), settings: out };
}

/** Gabungkan hasil impor ke pengaturan saat ini (hanya kunci yang sudah ada; yang khusus-PC tetap milik PC ini). Mengembalikan { next, changed }. */
export function applyImport(current, parsed) {
  if (!parsed || parsed.format !== FORMAT || typeof parsed.settings !== "object") throw new Error("Berkas ini bukan ekspor pengaturan POPSNAP.");
  const next = clone(current);
  let changed = 0;
  const merge = (dst, src) => {
    for (const [k, v] of Object.entries(src)) {
      if (!(k in dst)) continue; // kunci asing diabaikan (server tetap memvalidasi saat Simpan)
      if (v && typeof v === "object" && !Array.isArray(v) && dst[k] && typeof dst[k] === "object" && !Array.isArray(dst[k])) merge(dst[k], v);
      else if (JSON.stringify(dst[k]) !== JSON.stringify(v)) { dst[k] = v; changed++; }
    }
  };
  for (const k of SECTIONS) if (parsed.settings[k] && next[k]) merge(next[k], parsed.settings[k]);
  return { next, changed };
}

export function downloadJson(obj, name) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(obj, null, 2)], { type: "application/json" }));
  const a = document.createElement("a"); a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
