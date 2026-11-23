// Merek di dalam aplikasi: logo + nama. Bawaan: logo POPSNAP. Diatur di Admin > Tampilan > Logo & nama aplikasi.
// Disimpan ringkas di localStorage supaya logo langsung benar saat aplikasi dibuka (tanpa berkedip logo bawaan dulu).
import { useSyncExternalStore } from "react";
import defaultLogo from "../assets/logo-popsnap.png";

const KEY = "popsnap.brand";
const DEFAULT_NAME = "POPSNAP";
const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:4000";
const clean = (b) => ({ logo: typeof b?.logo === "string" ? b.logo : "", name: (typeof b?.name === "string" ? b.name.trim() : "") || DEFAULT_NAME });

let state = (() => { try { return clean(JSON.parse(localStorage.getItem(KEY) || "{}")); } catch { return clean({}); } })();
const subs = new Set();
const applyTitle = () => { try { document.title = state.name; } catch { /* abaikan */ } };
applyTitle();

/** Pasang merek dari pengaturan (display.brand). Aman dipanggil berulang; hanya memberi tahu kalau ada yang berubah. */
export function setBrand(b) {
  const next = clean(b);
  if (next.logo === state.logo && next.name === state.name) return;
  state = next;
  try { localStorage.setItem(KEY, JSON.stringify(state)); } catch { /* abaikan */ }
  applyTitle();
  subs.forEach((f) => f());
}

/** Ambil ulang dari server (dipanggil saat aplikasi dibuka dan setelah admin menyimpan pengaturan). Gagal = merek terakhir tetap dipakai. */
export async function refreshBrand() {
  try {
    const r = await fetch(`${API_BASE}/api/settings/public`);
    if (r.ok) setBrand((await r.json())?.display?.brand);
  } catch { /* backend belum siap: pakai yang tersimpan */ }
}

export function useBrand() {
  const s = useSyncExternalStore((f) => { subs.add(f); return () => subs.delete(f); }, () => state);
  return { name: s.name, logo: s.logo || defaultLogo, custom: !!s.logo, defaultLogo };
}
