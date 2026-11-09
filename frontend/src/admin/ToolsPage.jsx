import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { cleanupOrphanedFiles } from "../services/templateService";
import { cleanArchive, fmtBytes, getStorage } from "../services/storageService";
import { useOverview } from "./AdminApp";
import { Btn, Card, Page, StatusDot } from "./ui";
import { useKiosk } from "../hooks/useKiosk";
import appConfig from "../config/appConfig";

export default function ToolsPage() {
  const { overview } = useOverview();
  const sys = overview?.system;
  const [cleanMsg, setCleanMsg] = useState(null);
  const kiosk = useKiosk();
  // Tutup aplikasi selalu lewat PIN (walau sudah login admin); tanpa PIN terpasang cukup konfirmasi
  function quitApp() {
    if (appConfig.settings?.general?.pinSet) kiosk.requestUnlock(() => window.electronAPI.kiosk.quit(), "PIN untuk menutup aplikasi");
    else if (confirm("Tutup aplikasi POPSNAP sekarang?")) window.electronAPI.kiosk.quit();
  }

  async function cleanup() {
    if (!confirm("Bersihkan file yang sudah tidak dipakai template mana pun? Jalankan saat tidak ada pelanggan yang sedang sesi foto.")) return;
    try { const r = await cleanupOrphanedFiles(); setCleanMsg(`Selesai — ${r.deletedCount} file tidak terpakai dibersihkan.`); }
    catch (err) { setCleanMsg(err.message); }
  }

  const [st, setSt] = useState(null);
  const [stErr, setStErr] = useState(null);
  const [keepDays, setKeepDays] = useState(90);
  const [arcMsg, setArcMsg] = useState(null);
  const loadStorage = (fresh) => getStorage(fresh).then((v) => { setSt(v); setStErr(null); }).catch((e) => setStErr(e.message));
  useEffect(() => { loadStorage(false); }, []);
  async function cleanOldArchive() {
    const d = Math.floor(Number(keepDays));
    if (!(d >= 7)) { setArcMsg("Isi minimal 7 hari."); return; }
    if (!confirm(`Hapus SELAMANYA semua foto di arsip yang lebih tua dari ${d} hari? Pastikan sudah diunggah ke galeri / dicadangkan.`)) return;
    try { const r = await cleanArchive(d); setArcMsg(`Selesai — ${r.removedDays} folder tanggal dihapus, ${fmtBytes(r.freedBytes)} lega${r.failed ? `, ${r.failed} gagal (file terpakai?)` : ""}.`); loadStorage(true); }
    catch (err) { setArcMsg(err.message); }
  }

  return (
    <Page title="Tools">
      <Card title="INFO SISTEM">
        <div className="grid grid-cols-2 gap-y-2 text-[13px]">
          <span className="text-[#55606E]">Internet</span><span><StatusDot on={!!overview?.payment?.online} label={overview?.payment?.online ? "Tersambung" : `Terputus${overview?.payment?.onlineReason ? " (" + overview.payment.onlineReason + ")" : ""}`} /></span>
          <span className="text-[#55606E]">Alamat backend (LAN)</span><span className="text-[#181B23]">{sys ? `http://${sys.publicHost}:${sys.port}` : "—"}</span>
          <span className="text-[#55606E]">Retensi foto</span><span className="text-[#181B23]">{sys ? `${sys.retentionDays} hari` : "—"}</span>
          <span className="text-[#55606E]">Folder arsip foto</span><span className="text-[#181B23] break-all">{sys?.outputDir || "—"}</span>
        </div>
      </Card>

      <Card title="SETELAN KAMERA" hint="Atur ISO, shutter, aperture, dan white balance kamera Canon/Nikon langsung dari sini, plus wizard flash dan foto tes (seperti dslrBooth).">
        <Link to="/admin/tools/camera" className="inline-block px-4 py-2 text-[13px] font-bold italic rounded-full bg-white hover:bg-[#F4F7FA] text-[#181B23] border border-[#C7D0DA]">Buka Setelan Kamera</Link>
      </Card>

      {window.electronAPI?.kiosk && (
        <Card title="APLIKASI DESKTOP" hint="Di aplikasi desktop, tombol tutup jendela dan Alt+F4 dikunci supaya tamu tidak bisa menutup booth. Keluar lewat sini.">
          <Btn variant="danger" onClick={quitApp}>Keluar dari Aplikasi</Btn>
        </Card>
      )}

      <Card title="PENYIMPANAN" hint="Uploads = file sementara (link QR, aset template) dan dihapus otomatis sesuai retensi. Arsip = hasil final + foto mentah per tanggal, tidak pernah dihapus otomatis.">
        {stErr && <p className="text-[13px] text-[#B42318]">{stErr}</p>}
        {st && (
          <>
            <div className="grid grid-cols-2 gap-y-2 text-[13px]">
              <span className="text-[#55606E]">Disk kosong</span><span className="text-[#181B23]">{st.disk?.freeGB != null ? `${st.disk.freeGB} GB dari ${st.disk.totalGB} GB` : "—"}{st.disk?.level === "low" ? " · hampir penuh" : st.disk?.level === "critical" ? " · PENUH" : ""}</span>
              <span className="text-[#55606E]">Uploads (sementara)</span><span className="text-[#181B23]">{fmtBytes(st.uploads.bytes)} · {st.uploads.files} file · dihapus otomatis setelah {st.retentionDays} hari</span>
              <span className="text-[#55606E]">Arsip foto (permanen)</span><span className="text-[#181B23]">{fmtBytes(st.output.bytes)} · {st.output.sessions} sesi · {st.output.dayCount} hari{st.output.oldest ? ` · tertua ${st.output.oldest}` : ""}</span>
              <span className="text-[#55606E]">Cadangan database</span><span className="text-[#181B23]">{fmtBytes(st.backups.bytes)} · {st.backups.files} file</span>
              <span className="text-[#55606E]">Pustaka (template &amp; setelan)</span><span className="text-[#181B23]">{fmtBytes(st.library.bytes)}</span>
            </div>
            {st.output.days.length > 0 && (
              <details className="mt-3 text-[13px]">
                <summary className="cursor-pointer text-[#55606E]">Ukuran arsip per tanggal</summary>
                <ul className="mt-2 grid grid-cols-2 gap-x-6 gap-y-1">
                  {st.output.days.map((d) => <li key={d.date} className="flex justify-between"><span>{d.date}</span><span className="text-[#55606E]">{d.sessions} sesi · {fmtBytes(d.bytes)}</span></li>)}
                </ul>
              </details>
            )}
            <div className="flex items-center gap-2 mt-4 text-[13px] flex-wrap">
              <span className="text-[#262A38]">Hapus arsip yang lebih tua dari</span>
              <input type="number" min={7} max={3650} value={keepDays} onChange={(e) => setKeepDays(e.target.value)} className="w-20 px-2 py-1 border border-[#C7D0DA] rounded-md" aria-label="Hari" />
              <span className="text-[#262A38]">hari</span>
              <Btn variant="danger" onClick={cleanOldArchive}>Hapus Arsip Lama</Btn>
              <Btn onClick={() => loadStorage(true)}>Segarkan</Btn>
            </div>
            {arcMsg && <p className="text-[13px] text-[#262A38] mt-3">{arcMsg}</p>}
          </>
        )}
        {!st && !stErr && <p className="text-[13px] text-[#55606E]">Menghitung…</p>}
      </Card>

      <Card title="PEMBERSIHAN" hint="Menghapus file gambar template yang tidak lagi dipakai.">
        <Btn onClick={cleanup}>Bersihkan File Tidak Terpakai</Btn>
        {cleanMsg && <p className="text-[13px] text-[#262A38] mt-3">{cleanMsg}</p>}
      </Card>
    </Page>
  );
}
