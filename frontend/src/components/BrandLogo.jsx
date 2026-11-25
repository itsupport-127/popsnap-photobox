import React, { useState, useEffect } from "react";
import { useBrand } from "../state/brand";

/** Logo aplikasi (bawaan POPSNAP, bisa diganti di Admin). Kalau gambar unggahan hilang / gagal dimuat, kembali ke logo bawaan. */
// Tata letak semua layar dibuat untuk logo bawaan (805 x 268 = sekitar 3:1). Logo unggahan bisa berbentuk apa saja (persegi, tinggi, lebar),
// jadi logo SELALU dimuat di dalam kotak 3:1 (object-fit: contain): posisi & ukuran kotak ikut tata letak layar, isinya diperkecil agar muat
// dan tidak pernah menabrak judul / tombol di sekitarnya. Logo bawaan persis memenuhi kotaknya (tampilan tidak berubah).
export const LOGO_ASPECT = "805 / 268";
export default function BrandLogo({ alt, style, ...props }) {
  const b = useBrand();
  const [bad, setBad] = useState(false);
  useEffect(() => setBad(false), [b.logo]);
  return (
    <div {...props} style={{ ...style, height: "auto", aspectRatio: LOGO_ASPECT }}>
      <img src={bad ? b.defaultLogo : b.logo} alt={alt ?? b.name} draggable={false} onError={() => setBad(true)} style={{ display: "block", width: "100%", height: "100%", objectFit: "contain" }} />
    </div>
  );
}
