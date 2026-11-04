import React, { useEffect, useState } from "react";
import { NumInput, inputCls } from "../editorKit";
import { Btn, Card, Notice } from "../ui";
import { Check, Range, Row, Select } from "./controls";
import { addSharedPrinter, canSilentPrint, listPrinters, printTestPage } from "../../services/printService";
import { getPrintStats, resetPrintCount } from "../../services/settingsService";
import { listTemplates } from "../../services/templateService";
import { canSilentPrint as canPrintNow, paperForTemplate, printTemplateTest } from "../../services/printService";
import { composeImage } from "../../utils/composeImage";
import { photoSlotPlan } from "../../utils/templatePhotos";

const PAPER_IN = { "2x6": [2, 6], "4x6": [4, 6], "5x7": [5, 7], "6x8": [6, 8], "8x10": [8, 10], a5: [5.83, 8.27], a4: [8.27, 11.69] };

/** Cek tiap template: apakah rasio gambarnya sama dengan kertas? Kalau beda, mode "Penuhi kertas" memotong tepinya (mode "Utuh" menyisakan bingkai putih). */
/** Pratinjau di layar: template di atas kertas yang dipilih, lengkap dengan skala / geser printer utama.
 *  Merah bergaris = bagian yang TERPOTONG (keluar kertas), biru bergaris = kertas kosong (bingkai putih). Plus tombol tes cetak dengan template asli + garis panduan. */
export function PrintPreview({ pr }) {
  const [tpls, setTpls] = useState([]);
  const [id, setId] = useState("");
  const [img, setImg] = useState(null);
  const [msg, setMsg] = useState(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => { let dead = false; listTemplates().then((t) => { if (!dead && Array.isArray(t)) setTpls(t.filter((x) => x.canvasWidth && x.canvasHeight)); }).catch(() => {}); return () => { dead = true; }; }, []);
  const t = tpls.find((x) => String(x.id) === String(id)) ?? tpls[0];

  // Gambar template (slot foto diisi warna contoh) -> dipakai pratinjau & tes cetak
  useEffect(() => {
    if (!t) return undefined;
    let dead = false;
    setImg(null);
    (async () => {
      try {
        const layers = t.layers ?? [];
        const n = Math.max(1, photoSlotPlan(layers).count);
        const c = document.createElement("canvas"); c.width = 600; c.height = 600;
        const g = c.getContext("2d"), gr = g.createLinearGradient(0, 0, 600, 600); gr.addColorStop(0, "#9ec5fe"); gr.addColorStop(1, "#f8b4c8");
        g.fillStyle = gr; g.fillRect(0, 0, 600, 600);
        const url = await composeImage({ canvasWidth: t.canvasWidth, canvasHeight: t.canvasHeight, layers, photos: Array(n).fill(c.toDataURL("image/jpeg", 0.8)), backgroundColor: t.backgroundColor, editorState: { filter: "none", mirror: false, adjust: {}, stickers: [] } });
        if (!dead) setImg(url);
      } catch { if (!dead) setImg(null); }
    })();
    return () => { dead = true; };
  }, [t?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!t) return null;
  const W = Number(t.canvasWidth), H = Number(t.canvasHeight);
  const dup = pr.strip2x6 && H / W >= 2.5;
  const key = paperForTemplate(pr, t, dup);
  const c = (dup ? 2 * W : W) / H;
  const known = PAPER_IN[key];
  let pw, ph;
  if (known) { const land = pr.autorotate && !dup && c > 1; pw = land ? Math.max(...known) : Math.min(...known); ph = land ? Math.min(...known) : Math.max(...known); }
  else { pw = c; ph = 1; } // ukuran kertas tidak diketahui: dianggap sama dengan template
  const p = pw / ph;
  const MAXD = 250, m = 36;
  const PW = p >= 1 ? MAXD : MAXD * p, PH = p >= 1 ? MAXD / p : MAXD;
  const u = pr.main;
  const sc = Math.max(0.5, Math.min(1.5, (Number(u.scale) || 100) / 100));
  let w, h;
  if (pr.fit === "fit") { if (c > p) { w = PW; h = PW / c; } else { h = PH; w = PH * c; } }
  else if (c > p) { h = PH; w = PH * c; } else { w = PW; h = PW / c; }
  w *= sc; h *= sc;
  const cx = PW / 2 + ((Number(u.x) || 0) / 2 / 100) * PW, cy = PH / 2 + ((Number(u.y) || 0) / 2 / 100) * PH;
  const left = cx - w / 2, top = cy - h / 2;
  // Bagian gambar yang keluar kertas / kertas yang tidak tertutup (dalam % luas kertas)
  const ix = Math.max(0, Math.min(PW, left + w) - Math.max(0, left)), iy = Math.max(0, Math.min(PH, top + h) - Math.max(0, top));
  const cutPct = Math.round((1 - (ix * iy) / (w * h)) * 100), emptyPct = Math.round((1 - (ix * iy) / (PW * PH)) * 100);
  const pics = (op) => (dup ? [0, 1] : [0]).map((i) => <img key={i} src={img} alt="" draggable={false} style={{ width: dup ? "50%" : "100%", height: "100%", objectFit: "fill", display: "block", opacity: op }} />);
  const stripes = (a, b) => `repeating-linear-gradient(45deg, ${a} 0 5px, ${b} 5px 10px)`;

  async function testPrint() {
    if (!img) return;
    setBusy(true); setMsg(null);
    const r = await printTemplateTest(pr, t, img, "main");
    setBusy(false);
    setMsg(r.ok ? { tone: "info", t: "Tes cetak dikirim. Lihat garis merah di tepi kertas: kalau hilang di satu sisi, sisi itu terpotong." } : { tone: "error", t: r.error });
  }

  return (
    <div className="border border-[#D5DCE4] bg-[#F4F7FA] p-3 mt-2">
      <div className="text-[12px] font-semibold text-[#55606E] mb-2">PRATINJAU CETAK (sesuai pengaturan di atas + skala / geser printer utama)</div>
      <div className="flex gap-4 flex-wrap items-start">
        <div style={{ position: "relative", width: PW + 2 * m, height: PH + 2 * m, flex: "none" }}>
          {img && (
            <div style={{ position: "absolute", left: m + left, top: m + top, width: w, height: h, display: "flex", background: stripes("#ffc9c9", "#fff"), boxSizing: "border-box", outline: "1px dashed #d33" }}>{pics(0.4)}</div>
          )}
          <div style={{ position: "absolute", left: m, top: m, width: PW, height: PH, overflow: "hidden", background: stripes("#cfe0ff", "#fff"), border: "2px solid #000", boxSizing: "content-box", marginLeft: -2, marginTop: -2, boxShadow: "0 2px 8px rgba(0,0,0,.25)" }}>
            {img ? <div style={{ position: "absolute", left, top, width: w, height: h, display: "flex" }}>{pics(1)}</div> : <span className="text-[12px] text-[#6B7684] p-2">Memuat…</span>}
          </div>
        </div>
        <div className="flex-1 min-w-[240px] text-[12px] text-[#3a4452] space-y-1.5">
          <Select className="max-w-xs" value={String(t.id)} onChange={(v) => setId(v)} options={tpls.map((x) => [String(x.id), `${x.name} (${x.canvasWidth}×${x.canvasHeight})`])} />
          <div>Kertas: <b>{known ? key : "ikuti printer (tidak diketahui)"}</b> {known ? `(${pw.toFixed(2)}×${ph.toFixed(2)} inci)` : ""} · {dup ? "strip dobel" : pr.fit === "fit" ? "mode Utuh" : "mode Penuhi kertas"}</div>
          <div><span style={{ display: "inline-block", width: 14, height: 14, background: stripes("#ff9a9a", "#fff"), border: "1px solid #d33", verticalAlign: "middle" }} /> merah = <b>terpotong</b> ({cutPct}% gambar) &nbsp; <span style={{ display: "inline-block", width: 14, height: 14, background: stripes("#9bbcff", "#fff"), border: "1px solid #36c", verticalAlign: "middle" }} /> biru = kertas kosong ({emptyPct}% kertas)</div>
          <div className={cutPct > 0 ? "text-[#B00020] font-semibold" : "text-[#1a7f37] font-semibold"}>{cutPct > 0 ? `Ada bagian gambar yang terpotong (${cutPct}%).` : emptyPct > 0 ? `Tidak terpotong, tapi ada bingkai putih (${emptyPct}% kertas).` : "Pas: tidak terpotong dan tidak ada bingkai putih."}</div>
          <div className="text-[#6B7684]">Pratinjau tidak memperhitungkan batas cetak printer (lihat Cetak halaman uji untuk mengukurnya).</div>
          <div className="flex items-center gap-3 pt-1"><Btn onClick={testPrint} disabled={!canPrintNow() || !img || busy}>Cetak tes dengan template ini</Btn>{msg && <span className={`text-[12px] ${msg.tone === "error" ? "text-red-600" : "text-emerald-600"}`}>{msg.t}</span>}</div>
          {!canPrintNow() && <div className="text-[#6B7684]">Tombol tes cetak hanya aktif di aplikasi desktop (.exe).</div>}
        </div>
      </div>
    </div>
  );
}

export function FitCheck({ pr }) {
  const [tpls, setTpls] = useState(null);
  useEffect(() => { let dead = false; listTemplates().then((t) => { if (!dead) setTpls(Array.isArray(t) ? t : []); }).catch(() => { if (!dead) setTpls([]); }); return () => { dead = true; }; }, []);
  if (!tpls) return null;
  const rows = [];
  for (const t of tpls) {
    const W = Number(t.canvasWidth), H = Number(t.canvasHeight);
    if (!W || !H) continue;
    const dup = pr.strip2x6 && H / W >= 2.5;
    const key = paperForTemplate(pr, t, dup);
    const dim = PAPER_IN[key];
    if (!dim) { if (pr.paper !== "auto" && pr.paper !== "template") continue; rows.push({ t, note: "Ukuran kertas: ikuti printer (tidak bisa dicek di sini). Pilih ukuran kertas baku supaya bisa dicek.", level: "info" }); continue; }
    // rasio isi (strip dobel = dua strip berdampingan) vs rasio kertas; kertas diputar mengikuti isi bila "Putar otomatis" aktif
    const c = (dup ? 2 * W : W) / H;
    const pw = pr.autorotate && !dup && c > 1 ? Math.max(...dim) : Math.min(...dim), ph = pr.autorotate && !dup && c > 1 ? Math.min(...dim) : Math.max(...dim);
    const p = pw / ph;
    const diff = Math.abs(c - p) / p;
    if (diff < 0.012) continue;
    const shown = Math.min(c / p, p / c); // bagian yang tampil
    const pct = Math.round((1 - shown) * 100);
    const axis = c < p ? "tinggi" : "lebar";
    rows.push({ t, level: pr.fit === "fit" ? "warn" : "bad",
      note: pr.fit === "fit" ? `Rasio ${c.toFixed(2)} vs kertas ${p.toFixed(2)} (${key}): ada bingkai putih ±${pct}% pada ${axis === "tinggi" ? "lebar" : "tinggi"}.`
        : `Rasio ${c.toFixed(2)} vs kertas ${p.toFixed(2)} (${key}): ${pct}% ${axis} gambar TERPOTONG (tepi atas/bawah atau kiri/kanan).` });
  }
  if (!rows.length) return <Notice tone="info">Cek ukuran: semua template cocok dengan kertas yang dipilih, tidak ada yang terpotong oleh pengaturan ini. Kalau tetap terpotong, penyebabnya dari printer: nyalakan "Borderless" di Printing Preferences, atau pakai Cetak halaman uji (ada penggaris mm) untuk mengukur dan sesuaikan Skala.</Notice>;
  return (
    <div className="border border-[#E8C9A0] bg-[#FFF8EE] p-3 mt-2 text-[12px] text-[#5A4520]">
      <div className="font-semibold mb-1">CEK UKURAN TEMPLATE vs KERTAS ({rows.length} template)</div>
      <ul className="list-disc pl-5 space-y-0.5">{rows.slice(0, 10).map((r, i) => <li key={i}><b>{r.t.name}</b> ({r.t.canvasWidth}×{r.t.canvasHeight}): {r.note}</li>)}</ul>
      {rows.length > 10 && <div className="mt-1">…dan {rows.length - 10} lainnya.</div>}
      <div className="mt-1">Perbaiki: pilih ukuran kertas yang sama dengan template, atau pilih "Ikuti ukuran template", atau ubah ukuran kanvas template di Template Editor.</div>
    </div>
  );
}

const N = ({ value, min, onCommit }) => <div className="w-28"><NumInput value={value} min={min} onCommit={(v) => onCommit(Math.round(v))} /></div>;

// Penjajaran cetak (skala + geser) satu printer, gaya dslrBooth "Printer Alignment"
function Alignment({ s, set, which, label }) {
  const u = s.printing[which];
  const [msg, setMsg] = useState(null);
  async function test() {
    setMsg(null);
    const r = await printTestPage(s.printing, which);
    setMsg(r.ok ? { tone: "info", t: "Halaman uji dikirim ke printer." } : { tone: "error", t: r.error });
  }
  return (
    <div className="border border-[#D5DCE4] bg-[#F4F7FA] p-3 mt-2">
      <div className="text-[12px] font-semibold text-[#55606E] mb-1">PENJAJARAN CETAK — {label}</div>
      <p className="text-[12px] text-[#6B7684] mb-1">Dipakai untuk menengahkan hasil di kertas kalau cetakan bergeser atau terpotong.</p>
      <Row label="Skala" hint="Kecilkan kalau hasil terpotong; besarkan kalau ada tepi putih."><Range value={u.scale} min={50} max={150} unit="%" onChange={(v) => set(["printing", which, "scale"], v)} /></Row>
      <Row label="Geser horizontal"><Range value={u.x} min={-100} max={100} onChange={(v) => set(["printing", which, "x"], v)} /></Row>
      <Row label="Geser vertikal"><Range value={u.y} min={-100} max={100} onChange={(v) => set(["printing", which, "y"], v)} /></Row>
      <Row label=""><div className="flex items-center gap-3"><Btn onClick={test} disabled={!canSilentPrint()}>Cetak halaman uji</Btn>{msg && <span className={`text-[12px] ${msg.tone === "error" ? "text-red-600" : "text-emerald-600"}`}>{msg.t}</span>}</div></Row>
    </div>
  );
}

export default function SettingsPrinting({ s, set, only }) {
  const vis = (t) => !only || only.includes(t); // tampilkan hanya kartu yang diminta halaman Pengaturan (pengelompokan baru)
  const pr = s.printing;
  const [printers, setPrinters] = useState([]);
  const [err, setErr] = useState(null);
  const [share, setShare] = useState("");
  const [shareMsg, setShareMsg] = useState(null);
  const [busy, setBusy] = useState(false);
  const [stats, setStats] = useState(null);

  async function refresh() {
    const r = await listPrinters();
    setPrinters(r.printers || []);
    setErr(r.ok ? null : r.error);
  }
  useEffect(() => { refresh(); getPrintStats().then(setStats).catch(() => {}); }, []);

  async function add() {
    setBusy(true); setShareMsg(null);
    const r = await addSharedPrinter(share);
    setBusy(false);
    if (r.ok) { setShareMsg({ ok: true, t: "Printer ditambahkan. Pilih di daftar printer di atas." }); setShare(""); await refresh(); }
    else setShareMsg({ ok: false, t: r.error });
  }

  const opts = (cur) => {
    const list = printers.map((p) => [p.name, p.name + (p.isDefault ? " (bawaan Windows)" : "")]);
    if (cur && !printers.some((p) => p.name === cur)) list.unshift([cur, `${cur} (tidak terdeteksi)`]);
    return [["", "— belum dipilih —"], ...list];
  };

  return (
    <>
      {vis("CETAK (PRINTING)") && (
      <Card title="CETAK (PRINTING)" hint="Mencetak hasil foto ke printer yang dikenal Windows. Bisa printer yang dicolok ke PC booth ini, atau printer PC lain yang di-share lewat jaringan.">
        <Row label="Aktifkan cetak"><Check checked={pr.enabled} onChange={(x) => set(["printing", "enabled"], x)} label="Aktifkan fitur cetak di booth" /></Row>
        {err && <Notice tone="info">{err}</Notice>}
        <Row label="Printer utama" hint="Daftar diambil dari Windows. Printer dari PaperCut Mobility Print (client) otomatis muncul di sini setelah terpasang di Windows — tinggal pilih, tekan Segarkan kalau belum tampil.">
          <div className="flex gap-2 items-center">
            <Select className="max-w-md" value={pr.main.name} onChange={(v) => set(["printing", "main", "name"], v)} options={opts(pr.main.name)} />
            <Btn onClick={refresh}>Segarkan</Btn>
          </div>
        </Row>
        <Row label="Tambah printer sharing" hint="Opsional. Kalau memakai Mobility Print, tidak perlu. Hanya untuk printer sharing Windows biasa dari PC lain: ketik alamatnya lalu Tambahkan.">
          <div className="flex gap-2 items-center">
            <input className={`${inputCls} max-w-xs`} placeholder="\\NAMA-PC\NAMA-PRINTER" value={share} onChange={(e) => setShare(e.target.value)} />
            <Btn onClick={add} disabled={busy || !share.trim() || !canSilentPrint()}>{busy ? "Menambahkan…" : "Tambahkan"}</Btn>
          </div>
          {shareMsg && <p className={`text-[12px] mt-1 ${shareMsg.ok ? "text-emerald-600" : "text-red-600"}`}>{shareMsg.t}</p>}
        </Row>
        <Alignment s={s} set={set} which="main" label="PRINTER UTAMA" />
        <Row label="Printer kedua" hint="Dipakai bersama printer utama bila 'Cetak ke kedua printer' dicentang.">
          <div className="flex gap-2 items-center">
            <Select className="max-w-md" value={pr.second.name} onChange={(v) => set(["printing", "second", "name"], v)} options={opts(pr.second.name)} />
            <Btn onClick={() => set(["printing", "second", "name"], "")} disabled={!pr.second.name}>Hapus</Btn>
          </div>
        </Row>
        {pr.second.name && <Alignment s={s} set={set} which="second" label="PRINTER KEDUA" />}
      </Card>)}

      {vis("PERILAKU CETAK") && (
      <Card title="PERILAKU CETAK">
        <Row label="Cetak otomatis" hint="Hasil langsung dicetak begitu sesi selesai, tanpa tamu menekan apa pun (sudah termasuk harga sesi)."><Check checked={pr.auto} onChange={(x) => set(["printing", "auto"], x)} label="Langsung cetak saat hasil keluar" /></Row>
        {pr.auto && <Row label="Salinan otomatis" hint="1–3 salinan."><N value={pr.autoCopies} min={1} onCommit={(x) => set(["printing", "autoCopies"], Math.min(3, x))} /></Row>}
        <Row label="Tombol Add Print" hint="Tamu bisa menambah cetakan di layar akhir. Boleh dinyalakan bersama atau tanpa cetak otomatis."><Check checked={pr.showButton} onChange={(x) => set(["printing", "showButton"], x)} label="Tampilkan tombol Add Print di akhir sesi" /></Row>
        {pr.showButton && <Row label="Harga per salinan (Rp)" hint="0 = gratis (langsung cetak). Lebih dari 0 = tamu scan QRIS lagi, lunas baru dicetak. Butuh QRIS aktif & internet."><div className="w-40"><NumInput value={pr.price} min={0} step={500} onCommit={(x) => set(["printing", "price"], Math.round(x))} /></div></Row>}
        <Row label="Cetak ke kedua printer"><Check checked={pr.both} disabled={!pr.second.name} onChange={(x) => set(["printing", "both"], x)} label="Cetak bergantian ke printer utama dan kedua" /></Row>
        <Row label="Putar otomatis"><Check checked={pr.autorotate} onChange={(x) => set(["printing", "autorotate"], x)} label="Orientasi kertas mengikuti orientasi template" /></Row>
        <Row label="Ukuran kertas" hint="Ukuran yang dikirim ke printer. Samakan dengan kertas yang terpasang (mis. 4x6 untuk 10x15 cm). 'Ikuti printer' memakai bawaan driver, yang kadang berbeda dari pilihan di Printing Preferences sehingga hasil terpotong atau ada tepi putih."><Select value={pr.paper ?? "auto"} onChange={(x) => set(["printing", "paper"], x)} options={[["auto", "Ikuti printer"], ["template", "Ikuti ukuran template (otomatis)"], ["2x6", "2x6 inci (strip)"], ["4x6", "4x6 inci (10x15 cm)"], ["5x7", "5x7 inci (13x18 cm)"], ["6x8", "6x8 inci (15x20 cm)"], ["8x10", "8x10 inci (20x25 cm)"], ["a5", "A5"], ["a4", "A4"]]} /></Row>
        <FitCheck pr={pr} />
        <PrintPreview pr={pr} />
        <Row label="Ukuran di kertas"><Select value={pr.fit} onChange={(x) => set(["printing", "fit"], x)} options={[["fill", "Penuhi kertas (tepi bisa terpotong sedikit)"], ["fit", "Utuh (bisa ada bingkai putih)"]]} /></Row>
        <Row label="Batasi cetak"><Check checked={pr.limit.enabled} onChange={(x) => set(["printing", "limit", "enabled"], x)} label="Batasi jumlah cetak per event dan per sesi" /></Row>
        {pr.limit.enabled && (<>
          <Row label="Per event" hint={stats ? `Sudah tercetak: ${stats.total}` : ""}>
            <div className="flex items-center gap-3"><N value={pr.limit.perEvent} min={1} onCommit={(x) => set(["printing", "limit", "perEvent"], x)} />
              <Btn onClick={async () => { if (confirm("Reset hitungan cetak event menjadi 0?")) setStats(await resetPrintCount()); }}>Reset hitungan</Btn></div>
          </Row>
          <Row label="Per sesi"><N value={pr.limit.perSession} min={1} onCommit={(x) => set(["printing", "limit", "perSession"], x)} /></Row>
        </>)}
        <Row label="Pilihan salinan" hint="Jumlah salinan maksimum yang bisa dipilih tamu setelah menekan PRINT (1–9)."><N value={pr.copies} min={1} onCommit={(x) => set(["printing", "copies"], Math.min(9, x))} /></Row>
        <Row label="Ketajaman cetak" hint="Mempertajam gambar akhir sebelum dicetak."><Select value={pr.sharpening} onChange={(x) => set(["printing", "sharpening"], x)} options={[["none", "Tidak ada"], ["low", "Rendah"], ["medium", "Sedang"], ["high", "Tinggi"]]} /></Row>
        <Row label="Cetak 2x6"><Check checked={pr.strip2x6} onChange={(x) => set(["printing", "strip2x6"], x)} label="Template strip 2x6 dicetak dobel berdampingan di kertas 4x6 (lalu dipotong jadi dua)" /></Row>
        <Notice tone="info">Cetak diam-diam (tanpa dialog) hanya jalan di aplikasi desktop POPSNAP. Tombol Simpan di bawah berlaku untuk semua pengaturan di tab ini.</Notice>
      </Card>)}
    </>
  );
}
