// SALINAN persis dari popsnap-remote/src/spec.js — daftar pengaturan yang boleh diubah dari Remote Booth.
// Booth memeriksa ulang di sini (penentu terakhir): kunci pembayaran / PIN / token TIDAK PERNAH bisa diubah dari jarak jauh.
// Daftar pengaturan yang BOLEH diubah dari remote. Dipakai server (validasi + membentuk form di UI).
// Pengaturan yang sama diperiksa lagi di sisi booth (remoteAgent.js) — booth tetap penentu terakhir.
// SENGAJA tidak ada: kunci pembayaran (Midtrans/DOKU), PIN, token sinkron kasir, folder penyimpanan.
const GROUPS = [
  { id: "event", title: "Event", fields: [
    { path: "event.name", label: "Nama event", type: "text", max: 60 },
    { path: "event.subtitle", label: "Subjudul", type: "text", max: 100 },
  ] },
  { id: "modes", title: "Mode booth", hint: "Foto selalu aktif. Mode lain harus diberi harga (0 = gratis).", fields: [
    { path: "general.modes.gif.enabled", label: "GIF aktif", type: "bool" },
    { path: "general.modes.gif.price", label: "Harga GIF (Rp)", type: "int", min: 0, max: 10000000 },
    { path: "general.modes.boomerang.enabled", label: "Boomerang aktif", type: "bool" },
    { path: "general.modes.boomerang.price", label: "Harga Boomerang (Rp)", type: "int", min: 0, max: 10000000 },
    { path: "general.modes.video.enabled", label: "Video aktif", type: "bool" },
    { path: "general.modes.video.price", label: "Harga Video (Rp)", type: "int", min: 0, max: 10000000 },
  ] },
  { id: "payment", title: "Pembayaran", hint: "Ubah cara bayar di booth. Hati-hati: berlaku untuk tamu berikutnya.", fields: [
    { path: "payment.mode", label: "Mode bayar", type: "enum", options: [
      ["auto", "Otomatis (QRIS saat online, voucher saat offline)"], ["qris", "QRIS saja"], ["voucher", "Voucher saja"], ["both", "QRIS + voucher"], ["none", "Tanpa bayar di booth (bayar di kasir)"],
    ] },
  ] },
  { id: "session", title: "Sesi foto", fields: [
    { path: "session.totalShots", label: "Jumlah jepretan", type: "int", min: 1, max: 20 },
    { path: "session.maxRetakes", label: "Maks. retake", type: "int", min: 0, max: 20 },
    { path: "display.capture.countdownFirst", label: "Hitung mundur foto pertama (detik)", type: "int", min: 0, max: 30 },
    { path: "display.capture.countdownOthers", label: "Hitung mundur foto berikutnya (detik)", type: "int", min: 0, max: 30 },
    { path: "display.capture.displayPhotoSeconds", label: "Lama tampil hasil tiap foto (detik)", type: "int", min: 0, max: 20 },
  ] },
  { id: "timers", title: "Batas waktu layar (detik)", fields: [
    { path: "session.timers.payment", label: "Layar bayar", type: "int", min: 10, max: 3600 },
    { path: "session.timers.photoSession", label: "Sesi foto", type: "int", min: 10, max: 3600 },
    { path: "session.timers.photoSessionExtend", label: "Perpanjangan sesi foto", type: "int", min: 0, max: 3600 },
    { path: "session.timers.editor", label: "Editor", type: "int", min: 10, max: 3600 },
    { path: "session.timers.downloadQr", label: "Layar hasil / QR", type: "int", min: 0, max: 3600 },
  ] },
  { id: "print", title: "Cetak", fields: [
    { path: "printing.enabled", label: "Cetak aktif", type: "bool" },
    { path: "printing.auto", label: "Cetak otomatis tiap sesi selesai", type: "bool" },
    { path: "printing.autoCopies", label: "Salinan cetak otomatis", type: "int", min: 1, max: 3 },
    { path: "printing.showButton", label: "Tampilkan tombol Add Print", type: "bool" },
    { path: "printing.price", label: "Harga Add Print per lembar (Rp)", type: "int", min: 0, max: 10000000 },
    { path: "printing.copies", label: "Pilihan maks. salinan di tombol Print", type: "int", min: 1, max: 9 },
    { path: "printing.limit.enabled", label: "Batasi jumlah cetak", type: "bool" },
    { path: "printing.limit.perSession", label: "Batas cetak per sesi", type: "int", min: 1, max: 99 },
    { path: "printing.limit.perEvent", label: "Batas cetak per event", type: "int", min: 1, max: 1000000 },
  ] },
  { id: "look", title: "Tampilan & kamera", fields: [
    { path: "display.colors.primary", label: "Warna utama", type: "color" },
    { path: "display.colors.background", label: "Warna latar", type: "color" },
    { path: "camera.exposureSchedule.enabled", label: "Jadwal otomatis kamera (siang/malam)", type: "bool" },
  ] },
];

const FIELDS = {};
for (const g of GROUPS) for (const f of g.fields) FIELDS[f.path] = f;

/** Periksa & rapikan patch datar { "path": nilai }. Kembali { ok, clean, errors }. */
function validatePatch(patch) {
  const clean = {}, errors = [];
  if (!patch || typeof patch !== "object" || Array.isArray(patch)) return { ok: false, clean, errors: ["Patch tidak valid."] };
  for (const [path, raw] of Object.entries(patch)) {
    const f = FIELDS[path];
    if (!f) { errors.push(`Pengaturan "${path}" tidak boleh diubah dari remote.`); continue; }
    if (f.type === "bool") { if (typeof raw !== "boolean") errors.push(`${f.label}: harus ya/tidak.`); else clean[path] = raw; }
    else if (f.type === "int") {
      const n = Number(raw);
      if (!Number.isFinite(n) || !Number.isInteger(n) || n < f.min || n > f.max) errors.push(`${f.label}: angka ${f.min}–${f.max}.`); else clean[path] = n;
    } else if (f.type === "text") {
      const s = String(raw ?? "").trim();
      if (s.length > f.max) errors.push(`${f.label}: maksimal ${f.max} karakter.`); else clean[path] = s;
    } else if (f.type === "color") {
      if (!/^#[0-9a-fA-F]{6}$/.test(String(raw))) errors.push(`${f.label}: format #RRGGBB.`); else clean[path] = String(raw).toUpperCase();
    } else if (f.type === "enum") {
      if (!f.options.some(([v]) => v === raw)) errors.push(`${f.label}: pilihan tidak dikenal.`); else clean[path] = raw;
    }
  }
  return { ok: errors.length === 0 && Object.keys(clean).length > 0, clean, errors };
}

/** { "a.b.c": v } -> { a: { b: { c: v } } } */
function unflatten(flat) {
  const out = {};
  for (const [path, v] of Object.entries(flat)) {
    const keys = path.split(".");
    let o = out;
    keys.slice(0, -1).forEach((k) => { o = o[k] = o[k] || {}; });
    o[keys[keys.length - 1]] = v;
  }
  return out;
}

module.exports = { GROUPS, FIELDS, validatePatch, unflatten };
