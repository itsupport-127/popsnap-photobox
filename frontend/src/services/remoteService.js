// Remote Booth: komunikasi layar kiosk <-> backend booth (lokal), dan konfigurasi dari halaman admin.
import { authHeader } from "./authService";

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:4000";

/** Layar kiosk melapor: layar apa yang tampil, foto keberapa, status kunci. Mengembalikan { lock: {on,message} }. */
export async function reportState(payload) {
  const res = await fetch(`${API_BASE}/api/remote/ui-state`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
  if (!res.ok) throw new Error("ui-state " + res.status);
  return res.json();
}

/** Long-poll perintah dari Remote Booth (maks. ~20 dtk). */
export async function pollCommands(signal) {
  const res = await fetch(`${API_BASE}/api/remote/ui-cmd`, { signal });
  if (!res.ok) throw new Error("ui-cmd " + res.status);
  return (await res.json()).commands || [];
}

const call = async (path, opts = {}) => {
  const r = await fetch(`${API_BASE}${path}`, { ...opts, headers: { "Content-Type": "application/json", ...authHeader() }, body: opts.body ? JSON.stringify(opts.body) : undefined });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d.error || `Gagal (${r.status})`);
  return d;
};
export const getRemoteConfig = () => call("/api/remote/config");
export const saveRemoteConfig = (body) => call("/api/remote/config", { method: "PUT", body });
export const testRemote = (body) => call("/api/remote/test", { method: "POST", body });
