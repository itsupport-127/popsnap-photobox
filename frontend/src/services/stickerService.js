// Stiker (Editor > Add sticker). Daftar publik dipakai booth; unggah/ubah/hapus butuh login admin (hak "Edit template").
import { authHeader, handleAuthError } from "./authService";
import { DEFAULT_STICKERS } from "../utils/defaultStickers";

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:4000";

/** { categories:[{id,label,count}], uncategorized, stickers:[{id,categoryId,name,url,width,height}], builtin } */
export async function listStickers() {
  let data = null;
  try {
    const res = await fetch(`${API_BASE}/api/stickers`);
    if (!res.ok) throw new Error("backend unavailable");
    data = await res.json();
  } catch { /* backend mati -> pakai stiker bawaan */ }
  const up = data?.stickers ?? [];
  const cfg = data?.builtin ?? { mode: "auto", hidden: [] };
  const showBuiltin = cfg.mode === "on" || (cfg.mode === "auto" && up.length === 0);
  const own = showBuiltin ? DEFAULT_STICKERS.filter((s) => !(cfg.hidden || []).includes(s.id)) : [];
  if (!own.length) return { categories: data?.categories ?? [], uncategorized: data?.uncategorized ?? 0, stickers: up, builtin: false };
  const cats = data?.categories ?? [];
  if (!up.length || !cats.length) return { categories: cats, uncategorized: (data?.uncategorized ?? 0) + own.length, stickers: [...up, ...own], builtin: !up.length };
  // ada kategori unggahan: stiker bawaan jadi satu tab sendiri
  return { categories: [...cats, { id: "builtin", label: "Bawaan", count: own.length }], uncategorized: data.uncategorized, stickers: [...up, ...own.map((s) => ({ ...s, categoryId: "builtin" }))], builtin: false };
}

/** Pengaturan stiker bawaan: { mode: "auto"|"on"|"off", hidden: [id,...] } */
export const saveBuiltinStickers = (patch) => call("/api/stickers-builtin", "PUT", patch);
export { DEFAULT_STICKERS };

async function call(path, method, body) {
  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers: { ...authHeader(), ...(body ? { "Content-Type": "application/json" } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (handleAuthError(res.status)) return null;
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Gagal menyimpan stiker.");
  return data;
}

/** Daftar untuk halaman admin (tanpa stiker bawaan). */
export async function adminListStickers() {
  const res = await fetch(`${API_BASE}/api/stickers`);
  if (!res.ok) throw new Error("Backend tidak bisa dihubungi.");
  return res.json();
}
export async function uploadStickers(files, categoryId) {
  const form = new FormData();
  if (categoryId) form.append("categoryId", categoryId);
  [...files].forEach((f) => form.append("images", f));
  const res = await fetch(`${API_BASE}/api/stickers`, { method: "POST", headers: authHeader(), body: form });
  if (handleAuthError(res.status)) return null;
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Gagal mengunggah stiker.");
  return data;
}
export const updateSticker = (id, patch) => call(`/api/stickers/${encodeURIComponent(id)}`, "PUT", patch);
export const deleteSticker = (id) => call(`/api/stickers/${encodeURIComponent(id)}`, "DELETE");
export const createStickerCategory = (label) => call("/api/sticker-categories", "POST", { label });
export const renameStickerCategory = (id, label) => call(`/api/sticker-categories/${encodeURIComponent(id)}`, "PUT", { label });
export const deleteStickerCategory = (id) => call(`/api/sticker-categories/${encodeURIComponent(id)}`, "DELETE");
