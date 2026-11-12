import React, { useEffect, useState } from "react";
import { API_BASE } from "../services/settingsService";
import { authHeader } from "../services/authService";
import { listPrinters, printTestPage, canSilentPrint } from "../services/printService";
import { Btn, Card, Page } from "./ui";

// "Cek siap buka": satu halaman yang memeriksa semua yang dibutuhkan sebelum studio dibuka. Hijau = siap, kuning = perlu perhatian, merah = harus diperbaiki.
// Pemeriksaan kamera & printer hanya akurat bila halaman ini dibuka di PC booth itu sendiri.
const TONE = { ok: "bg-emerald-500", warn: "bg-amber-400", bad: "bg-red-500", skip: "bg-slate-300" };
const j = (u, auth) => fetch(`${API_BASE}${u}`, auth ? { headers: authHeader() } : undefined).then(async (r) => { if (!r.ok) throw Object.assign(new Error(`HTTP ${r.status}`), { status: r.status }); return r.json(); });

async function runChecks() {
  const out = [];
  const add = (name, tone, text, fix) => out.push({ name, tone, text, fix });
  let pub = null;
  try { pub = await j("/api/settings/public"); } catch { add("Server booth", "bad", "Server booth tidak menjawab.", "Tutup dan buka ulang aplikasi POPSNAP."); return out; }
  add("Server booth", "ok", "Berjalan normal.");

  try {
    const d = await j("/api/system/disk");
    if (d.freeGB == null) add("Ruang disk", "skip", "Tidak bisa dibaca.");
    else if (d.level === "critical") add("Ruang disk", "bad", `Tersisa ${d.freeGB} GB dari ${d.totalGB} GB. Booth menolak sesi baru.`, "Pindahkan atau hapus arsip lama.");
    else if (d.level === "low") add("Ruang disk", "warn", `Tersisa ${d.freeGB} GB dari ${d.totalGB} GB.`, "Segera pindahkan arsip lama.");
    else add("Ruang disk", "ok", `Tersisa ${d.freeGB} GB dari ${d.totalGB} GB.`);
  } catch { add("Ruang disk", "skip", "Tidak bisa dibaca."); }

  // Kamera
  const cam = pub.camera ?? {};
  if (cam.mode === "dslr") {
    try {
      const d = await j("/api/camera/dslr/status");
      if (d.online && (d.cameras?.length ?? 0) > 0 && !d.virtualOnly) add("Kamera (DSLR)", "ok", `Terbaca: ${d.cameras.join(", ")}.`);
      else add("Kamera (DSLR)", "bad", d.virtualOnly ? "Hanya kamera virtual yang terbaca." : d.online ? "Penghubung kamera jalan, tapi kamera belum terbaca." : "Penghubung kamera (digiCamControl / SDK) tidak menjawab.", "Cek kabel USB, kamera menyala, lalu Pengaturan > Kamera.");
    } catch (e) { add("Kamera (DSLR)", "skip", e.status === 403 ? "Hanya bisa diperiksa dari PC booth ini." : "Tidak bisa diperiksa."); }
  } else {
    try {
      const s = await navigator.mediaDevices.getUserMedia({ video: true }); s.getTracks().forEach((t) => t.stop());
      add("Kamera (webcam)", "ok", "Webcam terbaca.");
    } catch (e) {
      const why = e?.name === "NotAllowedError" ? "Izin kamera ditolak." : e?.name === "NotReadableError" ? "Kamera sedang dipakai program lain." : e?.name === "NotFoundError" ? "Webcam tidak ditemukan." : "Webcam tidak bisa dibuka.";
      add("Kamera (webcam)", "bad", why, "Cek kabel dan izin kamera, lalu Pengaturan > Kamera.");
    }
  }

  // Internet & pembayaran
  const pay = pub.payment ?? {};
  try {
    const o = await j("/api/online");
    add("Internet", o.offline ? "warn" : "ok", o.offline ? "Offline. Booth hanya menerima voucher dan layar akhir tanpa QR." : "Tersambung.");
  } catch { add("Internet", "skip", "Tidak bisa diperiksa."); }
  if (pay.simulate) add("Simulasi pembayaran", "bad", "Simulasi pembayaran MASIH AKTIF: QRIS dianggap lunas tanpa uang masuk.", "Pembayaran > QRIS, matikan \"Simulasi\" sebelum studio dibuka.");
  // Gateway masih Sandbox = uang tidak asli: transaksi berlabel TEST di kasir dan TIDAK dihitung sebagai pendapatan
  if (pay.testPayment) add("Gateway pembayaran", "bad", "Gateway QRIS masih SANDBOX (uji coba): uang tamu tidak masuk, dan transaksi berlabel TEST di kasir (tidak dihitung pendapatan).", "Pembayaran > QRIS, pilih mode Production sebelum studio dibuka.");
  if (pay.mode === "none") add("Pembayaran", "ok", "Mode tanpa pembayaran: booth hanya untuk foto, bayar di aplikasi kasir.");
  else if (pay.mode === "voucher") add("Pembayaran", "ok", "Mode voucher (bayar di kasir).");
  else if (pay.qrisDown) add("Pembayaran", "warn", "QRIS belum bisa dipakai (offline atau belum diatur). Tamu diminta menghubungi CS.", "Cek internet dan Pembayaran > QRIS.");
  else add("Pembayaran", "ok", "QRIS siap.");
  // Simulasi QRIS = pembayaran palsu (dianggap lunas dalam 6 detik): berbahaya di booth sungguhan. Hanya admin yang boleh membaca pengaturan ini.
  try {
    const st = await j("/api/settings", true);
    if (st?.payment?.qris?.simulate) add("Simulasi pembayaran", "bad", "Mode simulasi QRIS AKTIF: tamu bisa foto gratis tanpa membayar.", "Matikan di Pengaturan > Pembayaran > Mode simulasi QRIS.");
  } catch { /* tanpa izin membaca pengaturan: lewati */ }

  // Printer
  const pr = pub.printing ?? {};
  if (!pr.enabled) add("Printer", "skip", "Fitur cetak dimatikan.");
  else if (!canSilentPrint()) add("Printer", "skip", "Pemeriksaan printer hanya di aplikasi desktop POPSNAP (.exe).");
  else {
    const r = await listPrinters();
    const want = pr.main?.name;
    const found = r.ok && (want ? r.printers.some((p) => p.name === want) : r.printers.length > 0);
    add("Printer", found ? "ok" : "bad", found ? `Terpasang: ${want || r.printers.find((p) => p.isDefault)?.name || r.printers[0].name}.` : want ? `Printer "${want}" tidak ditemukan di Windows.` : "Tidak ada printer di Windows.", found ? undefined : "Cek printer menyala dan terhubung, lalu Pengaturan > Cetak.");
  }

  // Galeri / kasir
  try {
    const g = await j("/api/gallery/status", true);
    if (!g.enabled) add("Galeri online", "skip", "Dimatikan.");
    else if (!g.configured) add("Galeri online", "warn", "Belum diatur.", "Pembayaran > Galeri.");
    else if (g.blocked || g.lastError) add("Galeri online", "warn", `Pengiriman bermasalah: ${g.lastError || "terblokir"}. ${g.activeSessions} sesi menunggu.`, "Cek internet; sesi terkirim sendiri saat pulih.");
    else add("Galeri online", "ok", g.activeSessions ? `Tersambung. ${g.activeSessions} sesi masih dalam antrean.` : "Tersambung, tidak ada antrean.");
  } catch (e) { add("Galeri online", "skip", e.status === 403 ? "Akun ini tidak boleh melihat status galeri." : "Tidak bisa diperiksa."); }
  return out;
}

export default function ReadyCheckPage() {
  const [rows, setRows] = useState(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);
  const run = async () => { setBusy(true); setMsg(null); try { setRows(await runChecks()); } finally { setBusy(false); } };
  useEffect(() => { run(); }, []);
  const bad = rows?.filter((r) => r.tone === "bad").length ?? 0, warn = rows?.filter((r) => r.tone === "warn").length ?? 0;
  async function testPrint() {
    const r = await printTestPage((await j("/api/settings/public")).printing, "main");
    setMsg(r.ok ? "Halaman uji dikirim ke printer." : r.error);
  }
  return (
    <Page title="Cek siap buka" subtitle="Periksa semuanya sebelum studio dibuka. Paling akurat bila dibuka di PC booth ini.">
      <Card title={rows ? (bad ? `${bad} hal harus diperbaiki` : warn ? `Siap, ${warn} hal perlu perhatian` : "Semua siap") : "Memeriksa…"}>
        <div className="flex flex-col divide-y divide-[#E3E8EE]">
          {(rows ?? []).map((r) => (
            <div key={r.name} className="flex items-start gap-3 py-2.5">
              <span className={`mt-1.5 h-3 w-3 rounded-full shrink-0 ${TONE[r.tone]}`} aria-hidden />
              <div className="min-w-0">
                <div className="text-[14px] font-semibold text-[#181B23]">{r.name}</div>
                <div className="text-[13px] text-[#55606E]">{r.text}</div>
                {r.fix && r.tone !== "ok" && <div className="text-[12px] text-[#B45309]">Saran: {r.fix}</div>}
              </div>
            </div>
          ))}
        </div>
        <div className="flex items-center gap-3 mt-3">
          <Btn variant="primary" onClick={run} disabled={busy}>{busy ? "Memeriksa…" : "Periksa lagi"}</Btn>
          {canSilentPrint() && <Btn onClick={testPrint}>Cetak halaman uji</Btn>}
          {msg && <span className="text-[12px] text-[#55606E]">{msg}</span>}
        </div>
      </Card>
    </Page>
  );
}
