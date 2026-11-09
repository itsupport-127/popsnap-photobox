// Ringkasan penyimpanan (uploads, arsip foto, cadangan) + hapus arsip lama. Hanya untuk admin (izin "tools.maintenance").
import { authHeader, handleAuthError } from "./authService";

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:4000";

export async function getStorage(fresh = false) {
  const res = await fetch(`${API_BASE}/api/storage${fresh ? "?fresh=1" : ""}`, { headers: authHeader() });
  if (handleAuthError(res.status)) return null;
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || "Gagal membaca penyimpanan.");
  return res.json();
}

export async function cleanArchive(olderThanDays) {
  const res = await fetch(`${API_BASE}/api/storage/archive-cleanup`, { method: "POST", headers: { "Content-Type": "application/json", ...authHeader() }, body: JSON.stringify({ olderThanDays }) });
  if (handleAuthError(res.status)) return null;
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || "Gagal membersihkan arsip.");
  return res.json(); // { ok, removedDays, freedBytes, failed, cutoff }
}

export const fmtBytes = (n) => (n >= 1e9 ? `${(n / 1e9).toFixed(1)} GB` : n >= 1e6 ? `${(n / 1e6).toFixed(1)} MB` : n >= 1e3 ? `${Math.round(n / 1e3)} KB` : `${n || 0} B`);
