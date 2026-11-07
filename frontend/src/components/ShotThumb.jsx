import React from "react";
import { STAR_POINTS } from "../utils/composeImage";

/**
 * Isi kotak thumbnail foto di layar sesi (HANYA tampilan pratinjau: foto aslinya tidak diubah / dipotong,
 * hasil akhir tetap dipotong oleh template saat Editor & cetak).
 *
 * Mode "Bentuk thumbnail" (Admin > Kamera):
 *   ratio : kotak mengikuti rasio slot template, foto dipotong dari tengah (bawaan)
 *   shape : seperti ratio + bentuk slot (lingkaran / bintang / sudut membulat) dipakai memotong foto
 *   each  : seperti shape, tetapi tiap kotak memakai rasio & bentuk slotnya sendiri
 *   frame : seluruh foto tampil, bingkai putih menandai bagian yang akan masuk slot, di luar bingkai digelapkan
 *   whole : seluruh foto tampil utuh tanpa dipotong
 */
export const THUMB_MODES = ["ratio", "shape", "each", "frame", "whole"];
export const THUMB_LABELS = {
  ratio: "Rasio slot (bawaan)",
  shape: "Rasio + bentuk slot (lingkaran/bintang/membulat)",
  each: "Tiap kotak ikut slotnya sendiri",
  frame: "Foto utuh + bingkai area potongan",
  whole: "Foto utuh (tanpa potong)",
};

const STAR_CLIP = `polygon(${STAR_POINTS.map(([x, y]) => `${(x * 100).toFixed(2)}% ${(y * 100).toFixed(2)}%`).join(",")})`;

/** Gaya pemotong bentuk slot (persentase, jadi tidak tergantung ukuran kotak). `ar` = lebar / tinggi kotak. */
export function shapeStyle(kind, ar = 1) {
  if (kind === "circle") return { borderRadius: "50%" };
  if (kind === "star") return { clipPath: STAR_CLIP };
  if (kind === "rounded") {
    // sama dengan composeImage: radius = 15% dari sisi terpendek
    const a = ar > 0 ? ar : 1;
    return { borderRadius: `${(15 * Math.min(1, 1 / a)).toFixed(2)}% / ${(15 * Math.min(1, a)).toFixed(2)}%` };
  }
  return {};
}

export default function ShotThumb({ src, mode = "ratio", kind = "rect", slotAR = 1, boxAR = 1, mirror = false, U, edge = 4, onPhotoAR, retake = null, alt = "" }) {
  const img = (objectFit) => (
    <img
      src={src}
      alt={alt}
      draggable={false}
      onLoad={(e) => { const i = e.currentTarget; if (i.naturalWidth && i.naturalHeight) onPhotoAR?.(i.naturalWidth / i.naturalHeight); }}
      style={{ width: "100%", height: "100%", display: "block", objectFit, transform: mirror ? "scaleX(-1)" : undefined }}
    />
  );

  if (mode === "shape" || mode === "each") {
    return (
      <div style={{ position: "absolute", inset: 0, filter: `drop-shadow(0 ${U(3)} ${U(5)} rgba(0,0,0,.4))` }}>
        <div style={{ position: "absolute", inset: 0, background: "#fff", ...shapeStyle(kind, boxAR) }} />
        <div style={{ position: "absolute", inset: U(edge), overflow: "hidden", ...shapeStyle(kind, boxAR) }}>
          {img("cover")}
          {retake}
        </div>
      </div>
    );
  }

  const base = { position: "absolute", inset: 0, overflow: "hidden", background: mode === "whole" ? "#111" : undefined };
  if (mode === "frame") {
    // Bagian foto yang akan masuk slot: "cover" slot di dalam foto, di tengah (sama dengan posisi awal di template)
    const fw = boxAR > slotAR ? slotAR / boxAR : 1;
    const fh = boxAR > slotAR ? 1 : boxAR / slotAR;
    const holeAR = slotAR;
    const edgeStyle = kind === "circle" ? { borderRadius: "50%" } : kind === "rounded" ? shapeStyle("rounded", holeAR) : {};
    return (
      <div style={base}>
        {img("contain")}
        <div aria-hidden="true" style={{
          position: "absolute", left: "50%", top: "50%", width: `${(fw * 100).toFixed(2)}%`, height: `${(fh * 100).toFixed(2)}%`,
          transform: "translate(-50%, -50%)", boxSizing: "border-box", border: `max(1.5px, ${U(3)}) solid #fff`,
          boxShadow: "0 0 0 999px rgba(0,0,0,.55)", pointerEvents: "none", ...edgeStyle,
        }} />
        {retake}
      </div>
    );
  }
  return (
    <div style={base}>
      {img(mode === "whole" ? "contain" : "cover")}
      {retake}
    </div>
  );
}
