import React, { useEffect, useState } from "react";
import { Btn, Card, Notice, Page } from "./ui";
import { getAdminSettings, getPublicSettings, saveAdminSettings } from "../services/settingsService";

const DEFAULT = ["disclaimer", "template", "payment", "consent", "reminder"];
const INFO = {
  disclaimer: { name: "Ketentuan (Disclaimer)", desc: "Tamu menyetujui ketentuan.", cfg: "Pengaturan > Umum > Disclaimer", on: (g, d) => !!g?.disclaimer?.enabled },
  template: { name: "Pilih Template", desc: "Pilih kelompok & template (dilewati kalau Tampilan > Template diset satu template, atau mode GIF/Boomerang/Video).", cfg: null, on: () => true },
  payment: { name: "Pembayaran", desc: "QRIS / voucher. Mode GIF/Boomerang/Video hanya muncul kalau harganya diisi.", cfg: null, on: () => true },
  consent: { name: "Izin Foto (Sosmed)", desc: "Tamu ditanya boleh dibagikan di sosmed / dipajang.", cfg: "Pengaturan > Umum > Izin foto", on: (g) => !!g?.consent?.enabled },
  reminder: { name: "Layar Pengingat", desc: "Pengingat singkat sebelum sesi foto dimulai.", cfg: "Pengaturan > Tampilan > Pengingat", on: (g, d) => !!d?.reminder?.enabled },
};

export default function FlowPage() {
  const [steps, setSteps] = useState(null);
  const [saved, setSaved] = useState(null);
  const [cfg, setCfg] = useState(null);
  const [pay, setPay] = useState(null);
  const [msg, setMsg] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    getAdminSettings().then((s) => { const st = s?.general?.flow?.steps ?? DEFAULT; setSteps(st); setSaved(st); setCfg(s); }).catch((e) => setMsg({ tone: "error", text: e.message }));
    getPublicSettings().then((s) => setPay(s.flow?.payFirst ?? null)).catch(() => {});
  }, []);

  if (!steps) return <Page title="Alur Sesi">{msg ? <Notice tone={msg.tone}>{msg.text}</Notice> : <p className="text-[13px] text-[#6B7684]">Memuat…</p>}</Page>;

  const move = (i, d) => { const a = [...steps]; const j = i + d; if (j < 0 || j >= a.length) return; [a[i], a[j]] = [a[j], a[i]]; setSteps(a); setMsg(null); };
  const dirty = steps.join() !== saved.join();
  const payFirst = steps.indexOf("payment") < steps.indexOf("template");

  async function save() {
    setBusy(true); setMsg(null);
    try { const r = await saveAdminSettings({ general: { flow: { steps } } }); const st = r?.general?.flow?.steps ?? steps; setSteps(st); setSaved(st); setMsg({ tone: "ok", text: "Tersimpan. Berlaku di booth saat kembali ke layar awal (tidak perlu restart)." }); }
    catch (e) { setMsg({ tone: "error", text: e.message }); }
    setBusy(false);
  }

  const g = cfg?.general, d = cfg?.display;
  return (
    <Page title="Alur Sesi" subtitle="Atur urutan langkah setelah tamu menekan Start. Geser dengan tombol ▲ ▼. Foto → Edit → Hasil tetap berurutan.">
      <Card title="Urutan langkah" hint="Langkah yang sedang dimatikan / tidak relevan otomatis dilewati di booth.">
        <ol className="space-y-2">
          <li className="rounded-lg bg-[#F4F6FA] px-3 py-2 text-[13px] text-[#6B7684]">▶ Start (layar awal) — tetap pertama</li>
          {steps.map((id, i) => {
            const it = INFO[id]; const on = it.on(g, d);
            return (
              <li key={id} className="flex items-center gap-3 rounded-lg border border-[#E3E7EE] bg-white px-3 py-2">
                <span className="w-6 text-center font-bold text-[#6B7684]">{i + 1}</span>
                <div className="flex-1 min-w-0">
                  <div className="text-[14px] font-semibold text-[#181B23]">{it.name} {!on && <span className="ml-1 text-[11px] font-medium text-[#B45309] bg-[#FEF3C7] rounded px-1.5 py-0.5">nonaktif — dilewati</span>}</div>
                  <div className="text-[12px] text-[#6B7684]">{it.desc}{it.cfg && !on ? ` Nyalakan di ${it.cfg}.` : ""}</div>
                </div>
                <Btn onClick={() => move(i, -1)} disabled={i === 0}>▲</Btn>
                <Btn onClick={() => move(i, 1)} disabled={i === steps.length - 1}>▼</Btn>
              </li>
            );
          })}
          <li className="rounded-lg bg-[#F4F6FA] px-3 py-2 text-[13px] text-[#6B7684]">📷 Sesi foto → Edit → Hasil — tetap di akhir</li>
        </ol>
        <div className="flex flex-wrap gap-2 pt-4">
          <Btn variant="primary" onClick={save} disabled={busy || !dirty}>Simpan</Btn>
          <Btn onClick={() => { setSteps(DEFAULT); setMsg(null); }} disabled={busy || steps.join() === DEFAULT.join()}>Kembalikan bawaan</Btn>
        </div>
        {msg && <div className="mt-3"><Notice tone={msg.tone}>{msg.text}</Notice></div>}
      </Card>

      {steps.indexOf("disclaimer") > steps.indexOf("payment") && g?.disclaimer?.enabled && <Notice tone="warn">Ketentuan diletakkan SETELAH pembayaran: kalau tamu menekan “Tidak Setuju”, sesi dibatalkan padahal sudah bayar. Disarankan taruh Ketentuan sebelum Pembayaran.</Notice>}

      <Card title="Bayar dulu (bayar sebelum pilih template)" hint="Taruh Pembayaran di atas Pilih Template untuk memakai alur ini.">
        {pay?.ok
          ? <Notice tone={payFirst ? "ok" : "info"}>Semua template yang tampil harganya sama: <b>Rp {pay.price.toLocaleString("id-ID")}</b>. {payFirst ? "Alur “bayar dulu” AKTIF: tamu membayar harga ini (harga tetap per sesi), lalu memilih template." : "Kalau Pembayaran dipindah di atas Pilih Template, tamu bayar harga ini dulu."}</Notice>
          : <Notice tone={payFirst ? "warn" : "info"}>{pay ? pay.reason : "Memeriksa harga template…"} {payFirst ? "Karena itu “bayar dulu” TIDAK dipakai: di booth pembayaran tetap setelah pilih template." : "“Bayar dulu” hanya bisa dipakai kalau semua template yang tampil di booth harganya sama."}</Notice>}
        <p className="text-[12px] text-[#6B7684] mt-3">Aturan: harga dihitung server. Voucher dan diskon kasir tetap berlaku. Yang dianggap “tampil” = template berbintang (favorit), atau satu template pilihan admin.</p>
      </Card>
    </Page>
  );
}
