import React, { useEffect, useState } from "react";
import { API_BASE } from "../../services/settingsService";
import { authHeader } from "../../services/authService";
import { Btn } from "../ui";
import { Row } from "./controls";

// Folder pustaka (Pictures\POPSNAP: Settings + Templates), lihat backend/library.js.
const call = (path, method = "GET", body) => fetch(`${API_BASE}${path}`, { method, headers: { ...(body ? { "Content-Type": "application/json" } : {}), ...authHeader() }, body: body ? JSON.stringify(body) : undefined }).then(async (r) => { const j = await r.json().catch(() => ({})); if (!r.ok) throw new Error(j.error || `HTTP ${r.status}`); return j; });

export default function LibraryRow() {
  const [st, setSt] = useState(null);
  const [msg, setMsg] = useState(null);
  const [busy, setBusy] = useState(false);
  const load = () => call("/api/library/status").then(setSt).catch(() => setSt(null));
  useEffect(() => { load(); }, []);
  async function run(fn, ok) { setBusy(true); setMsg(null); try { const r = await fn(); setMsg({ tone: "ok", t: ok(r) }); await load(); } catch (e) { setMsg({ tone: "err", t: e.message }); } finally { setBusy(false); } }
  const sync = () => run(() => call("/api/library/sync", "POST"), () => "Folder pustaka diperbarui.");
  const restore = () => {
    if (!window.confirm("Muat pengaturan dari folder pustaka dan tambahkan template yang belum ada di aplikasi? Template yang sudah ada tidak ditimpa.")) return;
    run(() => call("/api/library/restore", "POST", {}), (r) => `${r.settings ? "Pengaturan dimuat. " : "Tidak ada berkas pengaturan. "}${r.added ?? 0} template ditambahkan, ${r.skipped ?? 0} dilewati (sudah ada). Muat ulang halaman untuk melihat hasilnya.`);
  };
  return (
    <Row label="Folder pustaka" hint="Salinan otomatis seluruh pengaturan dan template, bisa dibuka di File Explorer: Settings (pengaturan, tanpa kunci pembayaran & PIN) dan Templates (satu folder per template beserta gambarnya). Diperbarui otomatis tiap ada perubahan. PC baru tanpa akun memulihkannya sendiri dari folder ini.">
      <p className="text-[12px] text-[#6B7684]">Lokasi: <span className="font-mono">{st?.dir || "—"}</span></p>
      {st && <p className="text-[12px] text-[#6B7684] mt-0.5">{st.settingsFile ? "Pengaturan tersimpan" : "Pengaturan belum ditulis"} · {st.templates} template{st.lastOkAt ? ` · diperbarui ${new Date(st.lastOkAt).toLocaleString("id-ID")}` : ""}{st.lastError ? ` · galat: ${st.lastError}` : ""}</p>}
      <div className="flex items-center gap-2 mt-2">
        <Btn onClick={sync} disabled={busy}>Perbarui sekarang</Btn>
        <Btn onClick={restore} disabled={busy}>Pulihkan dari folder</Btn>
        {msg && <span className={`text-[12px] ${msg.tone === "err" ? "text-red-600" : "text-[#0F5C52]"}`}>{msg.t}</span>}
      </div>
    </Row>
  );
}
