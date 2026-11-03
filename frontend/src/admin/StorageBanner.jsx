import React from "react";
import useStorage from "../hooks/useStorage";
import { Notice } from "./ui";

// Peringatan ruang disk di halaman admin (hanya tampil kalau sempit).
export default function StorageBanner() {
  const { level, freeGB } = useStorage(30000);
  if (level === "ok") return null;
  return level === "critical"
    ? <Notice tone="error"><b>Ruang disk hampir habis ({freeGB} GB tersisa).</b> Booth menolak sesi baru sampai ruang dikosongkan. Pindahkan atau hapus folder arsip lama (Pengaturan &gt; Media / folder ekspor).</Notice>
    : <Notice tone="warn"><b>Ruang disk menipis ({freeGB} GB tersisa).</b> Segera pindahkan atau hapus arsip lama supaya sesi tidak gagal tersimpan.</Notice>;
}
