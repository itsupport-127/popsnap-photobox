// ==========================================================
// Zoom & geser foto di dalam slot template (Editor > "Zoom / Geser").
// Disimpan per NOMOR SLOT di editorState.adjust[n] = { z, tx, ty }
//   z  = perbesaran (1 = pas "cover" seperti biasa, maks ADJ_MAX)
//   tx, ty = pergeseran foto dalam PECAHAN lebar / tinggi slot (positif = foto bergeser ke kanan / bawah, seperti yang dilihat tamu)
// Rumus yang sama dipakai pratinjau CSS (TemplatePreview), hasil akhir (composeImage), dan frame Live / GIF.
// ==========================================================
export const ADJ_MAX = 4;

/** Seberapa jauh foto boleh digeser (pecahan lebar/tinggi slot) pada zoom z, supaya tidak ada celah kosong. */
export function overflowFrac(z, slotAR, photoAR) {
  const cw = photoAR > slotAR ? photoAR / slotAR : 1;   // lebar foto "cover" dibanding lebar slot
  const chh = photoAR > slotAR ? 1 : slotAR / photoAR;  // tinggi foto "cover" dibanding tinggi slot
  return { fx: Math.max(0, (z * cw - 1) / 2), fy: Math.max(0, (z * chh - 1) / 2) };
}

export function clampAdjust(a, slotAR, photoAR) {
  const z = Math.min(ADJ_MAX, Math.max(1, Number(a?.z) || 1));
  const { fx, fy } = overflowFrac(z, slotAR, photoAR);
  const c = (v, f) => Math.min(f, Math.max(-f, Number(v) || 0));
  return { z, tx: c(a?.tx, fx), ty: c(a?.ty, fy) };
}

/** Pengaturan yang tidak mengubah apa pun dianggap tidak ada (null). */
export function isNeutral(a) {
  return !a || (Math.abs((a.z ?? 1) - 1) < 0.005 && Math.abs(a.tx || 0) < 0.002 && Math.abs(a.ty || 0) < 0.002);
}
