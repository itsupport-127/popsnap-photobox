import React, { useState, useEffect } from "react";
import { useBrand } from "../state/brand";

/** Logo aplikasi (bawaan POPSNAP, bisa diganti di Admin). Kalau gambar unggahan hilang / gagal dimuat, kembali ke logo bawaan. */
export default function BrandLogo({ alt, ...props }) {
  const b = useBrand();
  const [bad, setBad] = useState(false);
  useEffect(() => setBad(false), [b.logo]);
  return <img {...props} src={bad ? b.defaultLogo : b.logo} alt={alt ?? b.name} onError={() => setBad(true)} />;
}
