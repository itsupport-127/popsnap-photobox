import React, { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Btn, Card, Notice, Page } from "./ui";
import { getAdminSettings, saveAdminSettings, getCameraExposure, setCameraExposure } from "../services/settingsService";
import { API_BASE } from "../services/settingsService";

const PROPS = [
  { key: "tv", label: "Shutter Speed" },
  { key: "av", label: "Aperture" },
  { key: "iso", label: "ISO" },
  { key: "wb", label: "White Balance" },
];

// Nilai awal yang disarankan per jenis flash (seperti "Camera Wizard" dslrBooth). Mode kamera harus M.
const FLASH_PRESETS = [
  { id: "none", title: "Tanpa flash", sub: "Lampu continuous / cahaya ruangan", iso: 800, tv: 1 / 60, av: 4, wb: "auto" },
  { id: "speedlight", title: "Speedlight", sub: "Flash hot-shoe di kamera", iso: 100, tv: 1 / 125, av: 8, wb: "flash" },
  { id: "external", title: "Flash eksternal", sub: "Lampu studio / strobe", iso: 100, tv: 1 / 125, av: 8, wb: "flash" },
  { id: "builtin", title: "Flash bawaan", sub: "Flash pop-up di kamera", iso: 200, tv: 1 / 125, av: 5.6, wb: "flash" },
];

// Ubah label pilihan kamera jadi angka supaya bisa dicocokkan: "1/125" -> 0.008, "f/5.6" -> 5.6, "100" -> 100, "2\"" -> 2
function toNumber(label) {
  const t = String(label).replace(/[f\/]*\s*$/i, "").trim();
  const frac = String(label).match(/^\s*(\d+(?:[.,]\d+)?)\s*\/\s*(\d+(?:[.,]\d+)?)/);
  if (frac) return Number(frac[1].replace(",", ".")) / Number(frac[2].replace(",", "."));
  const m = String(label).match(/(\d+(?:[.,]\d+)?)/);
  return m ? Number(m[1].replace(",", ".")) : NaN;
}

function closest(prop, opts, want) {
  let best = null, bestD = Infinity;
  for (const [v, label] of opts) {
    let n = prop === "av" ? toNumber(String(label).replace(/^f\s*\/?/i, "")) : toNumber(label);
    if (!isFinite(n) || n <= 0) continue;
    const d = Math.abs(Math.log(n / want));
    if (d < bestD) { bestD = d; best = v; }
  }
  return best;
}

export default function CameraSettingsPage() {
  const [info, setInfo] = useState(null);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [photo, setPhoto] = useState(null);
  const [shooting, setShooting] = useState(false);
  const [wizard, setWizard] = useState(false);
  // Profil terpisah: "photo" dipakai saat jepret, "live" saat live view menyala (server menerapkannya otomatis bergantian)
  const [ex, setEx] = useState({ split: false, live: {}, photo: {} });
  const [tab, setTab] = useState("photo");
  useEffect(() => { getAdminSettings().then((s) => { const e = s?.camera?.exposure; if (e) setEx({ split: !!e.split, live: e.live || {}, photo: e.photo || {} }); }).catch(() => {}); }, []);
  const snap = (i) => Object.fromEntries(PROPS.map(({ key }) => [key, i?.[key]?.cur]).filter(([, v]) => v != null && v !== ""));
  async function saveEx(next) { setEx(next); try { await saveAdminSettings({ camera: { exposure: next } }); } catch (e) { setErr(e.message); } }
  async function toggleSplit(on) {
    const cur = snap(info);
    await saveEx(on ? { split: true, live: { ...cur }, photo: { ...cur } } : { ...ex, split: false });
    setTab("photo");
  }
  async function switchTab(t) {
    if (t === tab || busy) return;
    setBusy(true); setErr(""); setMsg("");
    try {
      const target = { ...(ex[t] || {}) };
      let cur = info;
      for (const { key } of PROPS) {
        const v = target[key];
        if (v == null || cur?.[key]?.cur === v) continue;
        try { const r = await setCameraExposure(key, v); if (r?.info) cur = r.info; } catch { /* abaikan: server tetap mencoba lagi nanti */ }
      }
      if (cur) setInfo(cur);
      setTab(t);
    } finally { setBusy(false); }
  }

  const load = useCallback(async () => {
    setBusy(true); setErr("");
    try { const r = await getCameraExposure(); if (r) setInfo(r); }
    catch (e) { setErr(e.message); setInfo(null); }
    finally { setBusy(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  async function change(prop, value) {
    setBusy(true); setErr(""); setMsg("");
    try {
      const r = await setCameraExposure(prop, value); if (r?.info) setInfo(r.info);
      if (ex.split) saveEx({ ...ex, [tab]: { ...ex[tab], [prop]: String(value) } });
    }
    catch (e) { setErr(e.message); await load(); }
    finally { setBusy(false); }
  }

  // Geser satu langkah di daftar (naik / turun)
  function step(prop, dir) {
    const p = info?.[prop]; if (!p) return;
    const i = p.opts.findIndex(([v]) => v === p.cur);
    const n = p.opts[i + dir]; if (n) change(prop, n[0]);
  }

  async function applyPreset(pr) {
    setBusy(true); setErr(""); setMsg(""); setWizard(false);
    const done = [], skipped = [];
    try {
      let cur = info;
      const plan = [
        ["iso", closest("iso", cur.iso.opts, pr.iso)],
        ["tv", closest("tv", cur.tv.opts, pr.tv)],
        ["av", closest("av", cur.av.opts, pr.av)],
        ["wb", (cur.wb.opts.find(([, l]) => l.toLowerCase().startsWith(pr.wb)) || [])[0]],
      ];
      for (const [prop, val] of plan) {
        if (val == null) { skipped.push(prop); continue; }
        try { const r = await setCameraExposure(prop, val); if (r?.info) { cur = r.info; setInfo(r.info); } done.push(prop); }
        catch { skipped.push(prop); }
      }
      setMsg(`Wizard "${pr.title}" diterapkan${skipped.length ? ` (tidak bisa diatur: ${skipped.join(", ")})` : ""}. Ambil foto tes untuk memeriksa.`);
    } catch (e) { setErr(e.message); }
    finally { setBusy(false); }
  }

  async function testShot() {
    setShooting(true); setErr(""); setPhoto(null);
    try {
      const res = await fetch(`${API_BASE}/api/camera/dslr/capture`, { method: "POST" });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error || `Gagal jepret (${res.status})`);
      setPhoto(d.image);
    } catch (e) { setErr(e.message); }
    finally { setShooting(false); }
  }

  return (
    <Page title="Setelan Kamera" subtitle="Atur eksposur kamera Canon/Nikon seperti di dslrBooth. Tersimpan di kamera dan dipakai untuk semua foto." right={<Link to="/admin/tools" className="text-[13px] text-[#4082AE] underline">← Tools</Link>}>
      {err && <Notice tone="error">{err}</Notice>}
      {msg && <Notice tone="ok">{msg}</Notice>}

      {ex.split && info?.profileErrors && Object.keys(info.profileErrors).length > 0 && (
        <Notice tone="warn">Kamera menolak sebagian nilai profil: {Object.entries(info.profileErrors).map(([k, v]) => `${k.startsWith("live") ? "Live" : "Foto"} ${k.split(".")[1].toUpperCase()} (${v})`).join(", ")}. Pastikan dial kamera di mode M dan pilih nilai dari daftar, lalu klik "Baca ulang dari kamera".</Notice>
      )}

      {info && info.manual === false && (
        <Notice tone="warn">Kamera belum di mode <b>M (Manual)</b>. Putar dial mode ke M supaya shutter, aperture, dan ISO bisa diatur dari sini.</Notice>
      )}

      <Card title="PROFIL LIVE & FOTO" hint="Atur ISO / shutter / aperture / WB berbeda untuk tampilan live dan untuk foto, lalu diganti otomatis. Hanya Canon / Nikon langsung.">
        <label className="flex items-center gap-2 text-[14px] font-semibold text-[#181B23]">
          <input type="checkbox" checked={ex.split} disabled={busy || !info} onChange={(e) => toggleSplit(e.target.checked)} />
          Pisahkan pengaturan Live dan Foto
        </label>
        {ex.split && (
          <div className="mt-3">
            <div className="inline-flex rounded-xl border border-[#C7D0DA] overflow-hidden">
              {[["photo", "Foto"], ["live", "Live view"]].map(([k, l]) => (
                <button key={k} onClick={() => switchTab(k)} disabled={busy} className={`px-4 py-2 text-[14px] font-bold ${tab === k ? "bg-[#E02843] text-white" : "bg-white text-[#262A38]"}`}>{l}</button>
              ))}
            </div>
            <div className="text-[12px] text-[#55606E] mt-2">Sedang mengedit profil <b>{tab === "photo" ? "Foto" : "Live view"}</b>: perubahan di bawah hanya tersimpan untuk profil ini. Contoh: Live view ISO tinggi supaya terang, Foto ISO rendah. Saat ini "Auto Exposure" bawaan dimatikan otomatis.</div>
          </div>
        )}
      </Card>

      <Card title="EKSPOSUR" hint="Pilihan diambil dari kamera yang tersambung. Klik panah atau pilih dari daftar.">
        {!info ? (
          <div className="text-[13px] text-[#55606E]">{busy ? "Membaca kamera…" : "Kamera belum terbaca."} <Btn onClick={load} disabled={busy} className="ml-2">Coba lagi</Btn></div>
        ) : (
          <div className="grid sm:grid-cols-2 gap-4">
            {PROPS.map(({ key, label }) => {
              const p = info[key];
              const idx = p ? p.opts.findIndex(([v]) => v === p.cur) : -1;
              return (
                <div key={key}>
                  <div className="text-[12px] font-bold text-[#55606E] mb-1">{label}</div>
                  {!p || !p.opts.length ? <div className="text-[13px] text-[#8793A1]">Tidak bisa diatur dari sini (atur di kamera)</div> : (
                    <div className="flex items-center gap-2">
                      <Btn onClick={() => step(key, -1)} disabled={busy || idx <= 0}>◀</Btn>
                      <select value={p.cur ?? ""} disabled={busy} onChange={(e) => change(key, e.target.value)} className="flex-1 border border-[#C7D0DA] rounded-xl px-3 py-2 text-[14px] bg-white">
                        {p.cur == null && <option value="">—</option>}
                        {p.opts.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                      </select>
                      <Btn onClick={() => step(key, 1)} disabled={busy || idx < 0 || idx >= p.opts.length - 1}>▶</Btn>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
        <div className="flex gap-2 flex-wrap mt-4">
          <Btn variant="primary" onClick={testShot} disabled={shooting || busy || !info}>{shooting ? "Menjepret…" : "Foto tes"}</Btn>
          <Btn onClick={() => setWizard(true)} disabled={busy || !info}>Wizard flash</Btn>
          <Btn onClick={load} disabled={busy}>Baca ulang dari kamera</Btn>
        </div>
        {photo && <img src={photo} alt="Foto tes" className="mt-4 max-h-[420px] rounded-xl border border-[#D5DCE4]" />}
      </Card>

      {wizard && (
        <Card title="WIZARD KAMERA" hint="Apakah kamu memakai flash? Pilihanmu mengisi ISO, shutter, aperture, dan white balance awal yang cocok. Setelah itu sesuaikan dengan foto tes.">
          <div className="grid grid-cols-2 gap-3">
            {FLASH_PRESETS.map((pr) => (
              <button key={pr.id} onClick={() => applyPreset(pr)} className="text-left px-4 py-3 rounded-2xl border border-[#C7D0DA] hover:border-[#E02843] hover:bg-[#FFF5F6]">
                <div className="text-[15px] font-extrabold text-[#181B23]">{pr.title}</div>
                <div className="text-[12px] text-[#55606E]">{pr.sub}</div>
                <div className="text-[12px] text-[#8793A1] mt-1">ISO {pr.iso} · {pr.tv < 1 ? `1/${Math.round(1 / pr.tv)}` : pr.tv}s · f/{pr.av}</div>
              </button>
            ))}
          </div>
          <div className="mt-3"><Btn onClick={() => setWizard(false)}>Batal</Btn></div>
        </Card>
      )}

      <Card title="CATATAN">
        <ul className="list-disc pl-5 text-[13px] text-[#262A38] space-y-1">
          <li>Dengan flash/strobe, foto biasanya tajam dan terang walau live view terlihat gelap. Untuk live view lebih terang pakai <b>Admin → Pengaturan → Kamera → Auto Exposure</b> (tidak mengubah foto).</li>
          <li>Kalau ISO kamera tertinggal tinggi setelah aplikasi lain, atur ISO di sini lalu <b>Foto tes</b>.</li>
          <li>Nilai di sini dikirim ke kamera lewat USB. Kamera yang tidak mengizinkannya akan menampilkan pesan penolakan.</li>
        </ul>
      </Card>
    </Page>
  );
}
