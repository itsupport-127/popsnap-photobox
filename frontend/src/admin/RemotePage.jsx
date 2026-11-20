import React, { useCallback, useEffect, useState } from "react";
import { Btn, Card, Notice, Page, Toggle } from "./ui";
import { Row } from "./settings/controls";
import { inputCls } from "./editorKit";
import { getRemoteConfig, saveRemoteConfig, testRemote } from "../services/remoteService";

const ago = (iso) => { if (!iso) return "belum pernah"; const s = Math.max(0, Math.round((Date.now() - new Date(iso)) / 1000)); return s < 60 ? `${s} dtk lalu` : s < 3600 ? `${Math.floor(s / 60)} mnt lalu` : `${Math.floor(s / 3600)} jam lalu`; };

export default function RemotePage() {
  const [cfg, setCfg] = useState(null);
  const [url, setUrl] = useState("");
  const [token, setToken] = useState("");
  const [enabled, setEnabled] = useState(false);
  const [msg, setMsg] = useState(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => getRemoteConfig().then((c) => { setCfg(c); return c; }).catch((e) => setMsg({ tone: "error", text: e.message })), []);
  useEffect(() => { load().then((c) => { if (c) { setUrl(c.url); setEnabled(c.enabled); } }); const t = setInterval(load, 5000); return () => clearInterval(t); }, [load]);

  async function save() {
    setBusy(true); setMsg(null);
    try { const c = await saveRemoteConfig({ url, enabled, ...(token ? { token } : {}) }); setCfg(c); setToken(""); setMsg({ tone: "ok", text: "Tersimpan." }); }
    catch (e) { setMsg({ tone: "error", text: e.message }); }
    setBusy(false);
  }
  async function test() {
    setBusy(true); setMsg(null);
    try { const r = await testRemote({ url, ...(token ? { token } : {}) }); setMsg({ tone: "ok", text: `Terhubung ke Remote Booth${r.name ? ` sebagai “${r.name}”` : ""}.` }); }
    catch (e) { setMsg({ tone: "error", text: e.message }); }
    setBusy(false);
  }

  const st = cfg?.status;
  return (
    <Page title="Remote Booth" subtitle="Hubungkan booth ini ke web Remote Booth supaya bisa dipantau & dikendalikan dari mana saja (tanpa membuka port di jaringan booth).">
      <Card title="Koneksi" hint="Buat booth di web Remote Booth (tombol “+ Tambah booth”), lalu tempel alamat dan token-nya di sini.">
        <Row label="Aktifkan"><Toggle checked={enabled} onChange={setEnabled} label="Sambungkan booth ke Remote Booth" /></Row>
        <Row label="Alamat server"><input className={`${inputCls} w-full max-w-md`} value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://remote.domainanda.com" /></Row>
        <Row label="Token booth" hint={cfg?.tokenSet ? `Token tersimpan (berakhiran …${cfg.tokenTail}). Kosongkan kalau tidak ingin mengganti.` : "Salin dari web Remote Booth saat membuat booth."}>
          <input type="password" autoComplete="off" className={`${inputCls} w-full max-w-md`} value={token} onChange={(e) => setToken(e.target.value)} placeholder={cfg?.tokenSet ? "••••••••••••" : "rb_…"} />
        </Row>
        <div className="flex flex-wrap gap-2 pt-3 pl-0 sm:pl-[226px]">
          <Btn variant="primary" onClick={save} disabled={busy}>Simpan</Btn>
          <Btn onClick={test} disabled={busy}>Tes koneksi</Btn>
        </div>
        {msg && <div className="mt-3"><Notice tone={msg.tone}>{msg.text}</Notice></div>}
      </Card>

      <Card title="Status">
        {!cfg?.enabled ? <Notice tone="info">Remote Booth belum diaktifkan.</Notice> : st?.connected
          ? <Notice tone="ok">Terhubung{st.boothName ? ` sebagai “${st.boothName}”` : ""}. Kabar terakhir ke server: {ago(st.lastOkAt)}.</Notice>
          : <Notice tone="warn">Belum terhubung{st?.lastError ? `: ${st.lastError}` : ""}. Booth tetap berjalan normal; akan mencoba lagi otomatis.</Notice>}
        <p className="text-[12px] text-[#6B7684] mt-3">Layar kiosk: {st?.frontendAlive ? "terhubung" : "belum terbuka / tidak terhubung"}.{cfg?.lock?.on ? " Booth sedang DIKUNCI dari Remote." : ""}</p>
      </Card>

      <Card title="Yang bisa dilakukan dari Remote">
        <ul className="text-[13px] text-[#181B23] list-disc pl-5 space-y-1">
          <li>Melihat status booth (layar yang tampil, online/offline), transaksi hari ini, dan riwayat transaksi.</li>
          <li>Mengunci / membuka booth, membatalkan sesi yang berjalan, memuat ulang tampilan.</li>
          <li>Mengubah pengaturan aman: harga mode, jumlah foto, timer, cetak, mode bayar, warna, jadwal kamera.</li>
        </ul>
        <p className="text-[12px] text-[#6B7684] mt-3">Yang <b>tidak</b> bisa diubah dari jarak jauh: kunci pembayaran (Midtrans/DOKU), PIN, token kasir, folder penyimpanan, template. Semua perubahan dari Remote tercatat di menu Log.</p>
      </Card>
    </Page>
  );
}
