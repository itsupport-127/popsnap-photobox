import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import TemplatePreview from "../components/TemplatePreview";
import { listTemplates } from "../services/templateService";
import { API_BASE, getAdminSettings } from "../services/settingsService";
import { authHeader, handleAuthError } from "../services/authService";
import { Btn, Card, Notice, Page } from "./ui";

// Menu Harga: ubah harga template satu per satu atau sekaligus. Harga yang dipakai booth selalu dibaca server dari template saat bayar,
// jadi perubahan di sini berlaku untuk sesi berikutnya. Tidak ada yang tersimpan sebelum tombol "Simpan perubahan" ditekan.
const rupiah = (n) => `Rp ${Number(n || 0).toLocaleString("id-ID")}`;
const MAX = 10_000_000;
const ROUND = [{ v: 0, l: "Tanpa pembulatan" }, { v: 500, l: "Bulatkan ke Rp 500" }, { v: 1000, l: "Bulatkan ke Rp 1.000" }, { v: 5000, l: "Bulatkan ke Rp 5.000" }];
const roundTo = (n, step) => (step > 0 ? Math.round(n / step) * step : Math.round(n));
const clamp = (n) => Math.min(MAX, Math.max(0, Math.round(n)));

async function putPrices(items, undo = false) {
  const res = await fetch(`${API_BASE}/api/templates/prices`, { method: "PUT", headers: { "Content-Type": "application/json", ...authHeader() }, body: JSON.stringify({ items, undo }) });
  if (handleAuthError(res.status)) return null;
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Gagal menyimpan harga.");
  return data;
}

export default function PricesPage() {
  const [rows, setRows] = useState(null);
  const [cats, setCats] = useState([]);
  const [modes, setModes] = useState(null);
  const [draft, setDraft] = useState({}); // id -> harga baru (angka); hanya yang diubah
  const [sel, setSel] = useState(() => new Set());
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("all"); // all | live | draft
  const [cat, setCat] = useState("all");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null); // { tone, text }
  const [last, setLast] = useState(null); // perubahan terakhir (untuk Batalkan)
  // aksi massal
  const [bulkMode, setBulkMode] = useState("set"); // set | addRp | addPct
  const [bulkVal, setBulkVal] = useState("");
  const [bulkRound, setBulkRound] = useState(0);

  const refreshTemplates = async () => setRows(await listTemplates());
  async function load() {
    await refreshTemplates();
    try {
      const r = await fetch(`${API_BASE}/api/categories`);
      if (r.ok) setCats(await r.json());
    } catch { /* kategori hanya untuk filter */ }
    try { setModes((await getAdminSettings())?.general?.modes || null); } catch { setModes(null); }
  }
  useEffect(() => { load().catch(() => setRows([])); }, []);

  const catLabel = (id) => cats.find((c) => c.id === id)?.label ?? id;
  const priceOf = (t) => (draft[t.id] !== undefined ? draft[t.id] : t.price || 0);
  const visible = useMemo(() => {
    const s = q.trim().toLowerCase();
    return (rows || []).filter((t) => (status === "all" || (status === "live") === !!t.favorite) && (cat === "all" || t.category === cat) && (!s || String(t.name).toLowerCase().includes(s)));
  }, [rows, q, status, cat]);
  const changes = (rows || []).filter((t) => draft[t.id] !== undefined && draft[t.id] !== (t.price || 0));
  const allVisibleSel = visible.length > 0 && visible.every((t) => sel.has(t.id));
  const usedCats = [...new Set((rows || []).map((t) => t.category))];

  function setOne(id, v) {
    const n = v === "" ? 0 : clamp(Number(String(v).replace(/[^\d]/g, "")));
    setDraft((d) => ({ ...d, [id]: n }));
  }
  function toggle(id) { setSel((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; }); }
  function toggleAll() { setSel(allVisibleSel ? new Set() : new Set(visible.map((t) => t.id))); }
  const targets = () => (sel.size ? (rows || []).filter((t) => sel.has(t.id)) : []);

  function applyBulk() {
    const ts = targets();
    const v = Number(String(bulkVal).replace(",", "."));
    if (!ts.length) return setMsg({ tone: "warn", text: "Centang dulu template yang mau diubah." });
    if (!Number.isFinite(v) || (bulkMode === "set" && bulkVal === "")) return setMsg({ tone: "warn", text: "Isi angkanya dulu." });
    setDraft((d) => {
      const n = { ...d };
      for (const t of ts) {
        const cur = priceOf(t);
        const raw = bulkMode === "set" ? v : bulkMode === "addRp" ? cur + v : cur * (1 + v / 100);
        n[t.id] = clamp(roundTo(raw, bulkRound));
      }
      return n;
    });
    setMsg({ tone: "info", text: `${ts.length} template diubah di tabel. Periksa, lalu tekan "Simpan perubahan".` });
  }
  function setSelectedTo(v) {
    const ts = targets();
    if (!ts.length) return setMsg({ tone: "warn", text: "Centang dulu template yang mau diubah." });
    setDraft((d) => { const n = { ...d }; for (const t of ts) n[t.id] = v; return n; });
    setMsg({ tone: "info", text: `${ts.length} template diubah di tabel. Periksa, lalu tekan "Simpan perubahan".` });
  }
  function matchLive() {
    const live = (rows || []).filter((t) => t.favorite);
    if (!live.length) return setMsg({ tone: "warn", text: "Belum ada template Live (★)." });
    const ref = Number(String(bulkVal)) || priceOf(live[0]);
    setDraft((d) => { const n = { ...d }; for (const t of live) n[t.id] = clamp(ref); return n; });
    setMsg({ tone: "info", text: `Semua ${live.length} template Live disamakan ke ${rupiah(ref)} (angka di kolom "Angka" bila diisi, kalau kosong memakai harga template Live pertama). Tekan "Simpan perubahan".` });
  }

  async function save() {
    if (!changes.length) return;
    setBusy(true); setMsg(null);
    try {
      const r = await putPrices(changes.map((t) => ({ id: t.id, price: draft[t.id] })));
      if (!r) return;
      setLast(r.changed);
      setDraft({});
      setMsg({ tone: "ok", text: `${r.changed.length} harga tersimpan. Berlaku untuk sesi berikutnya.` });
      await refreshTemplates();
    } catch (e) { setMsg({ tone: "error", text: e.message }); } finally { setBusy(false); }
  }
  async function undo() {
    if (!last?.length) return;
    setBusy(true); setMsg(null);
    try {
      const r = await putPrices(last.map((c) => ({ id: c.id, price: c.from })), true);
      if (!r) return;
      setLast(null);
      setMsg({ tone: "ok", text: `Perubahan terakhir dibatalkan (${r.changed.length} harga dikembalikan).` });
      await refreshTemplates();
    } catch (e) { setMsg({ tone: "error", text: e.message }); } finally { setBusy(false); }
  }

  const live = (rows || []).filter((t) => t.favorite);
  const livePrices = [...new Set(live.map((t) => draft[t.id] !== undefined ? draft[t.id] : t.price || 0))];

  return (
    <Page title="Harga" subtitle="Ubah harga template satu per satu atau sekaligus. Harga 0 = gratis. Belum tersimpan sebelum tombol Simpan perubahan ditekan.">
      {msg && <Notice tone={msg.tone}>{msg.text}</Notice>}

      {modes && (
        <Card title="HARGA MODE LAIN" hint="GIF, Boomerang, dan Video punya harga sendiri (bukan per template). Ubah di Pengaturan > GIF, Live & Video.">
          <div className="flex flex-wrap gap-x-6 gap-y-1 text-[13px]">
            {["gif", "boomerang", "video"].map((m) => <span key={m}><span className="text-[#55606E] capitalize">{m}</span>: <b>{modes[m]?.price ? rupiah(modes[m].price) : "Gratis"}</b></span>)}
            <Link to="/admin/settings" className="text-[#E02843] font-bold">Buka Pengaturan</Link>
          </div>
        </Card>
      )}

      <Card title="AKSI MASSAL" hint="Centang template di tabel (atau pilih semua yang tampil), pilih aksinya, lalu periksa hasilnya di tabel sebelum disimpan.">
        <div className="flex flex-wrap items-end gap-3">
          <label className="text-[12px] text-[#55606E] flex flex-col gap-1">Aksi
            <select value={bulkMode} onChange={(e) => setBulkMode(e.target.value)} className="px-2 py-2 border border-[#C7D0DA] rounded-lg text-[13px] bg-white">
              <option value="set">Set jadi satu harga (Rp)</option>
              <option value="addRp">Naik / turun (Rp)</option>
              <option value="addPct">Naik / turun (%)</option>
            </select>
          </label>
          <label className="text-[12px] text-[#55606E] flex flex-col gap-1">Angka
            <input value={bulkVal} onChange={(e) => setBulkVal(e.target.value)} inputMode="decimal" placeholder={bulkMode === "set" ? "35000" : bulkMode === "addRp" ? "5000 atau -5000" : "10 atau -10"} className="w-36 px-2 py-2 border border-[#C7D0DA] rounded-lg text-[13px]" />
          </label>
          <label className="text-[12px] text-[#55606E] flex flex-col gap-1">Pembulatan
            <select value={bulkRound} onChange={(e) => setBulkRound(Number(e.target.value))} className="px-2 py-2 border border-[#C7D0DA] rounded-lg text-[13px] bg-white">
              {ROUND.map((r) => <option key={r.v} value={r.v}>{r.l}</option>)}
            </select>
          </label>
          <Btn variant="primary" onClick={applyBulk}>Terapkan ke yang dicentang ({sel.size})</Btn>
          <Btn onClick={() => setSelectedTo(0)}>Gratiskan yang dicentang</Btn>
          <Btn onClick={matchLive}>Samakan semua template Live</Btn>
        </div>
        <p className="text-[12px] text-[#6B7684] mt-2">"Samakan semua template Live" memakai angka di kolom Angka (kalau kosong: harga template Live pertama). Berguna untuk alur "bayar dulu", yang mensyaratkan semua template yang tampil berharga sama.</p>
        {live.length > 0 && <p className="text-[12px] mt-1 text-[#55606E]">Template Live (tampil di booth): {live.length}. {livePrices.length === 1 ? <>Semuanya berharga sama: <b>{rupiah(livePrices[0])}</b>.</> : <>Harganya berbeda-beda ({livePrices.sort((a, b) => a - b).map(rupiah).join(", ")}).</>}</p>}
      </Card>

      <Card title={`DAFTAR TEMPLATE${rows ? ` (${visible.length}${visible.length !== rows.length ? ` dari ${rows.length}` : ""})` : ""}`}>
        <div className="flex flex-wrap items-center gap-2 mb-3">
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cari nama template…" className="flex-1 min-w-[160px] px-3 py-2 border border-[#C7D0DA] rounded-lg text-[13px]" />
          <select value={status} onChange={(e) => setStatus(e.target.value)} className="px-2 py-2 border border-[#C7D0DA] rounded-lg text-[13px] bg-white">
            <option value="all">Semua status</option><option value="live">Live ★ (tampil di booth)</option><option value="draft">Draft (tidak tampil)</option>
          </select>
          <select value={cat} onChange={(e) => setCat(e.target.value)} className="px-2 py-2 border border-[#C7D0DA] rounded-lg text-[13px] bg-white">
            <option value="all">Semua kategori</option>
            {usedCats.map((c) => <option key={c} value={c}>{catLabel(c)}</option>)}
          </select>
        </div>

        {rows === null ? <p className="text-[13px] text-[#55606E]">Memuat…</p> : visible.length === 0 ? <p className="text-[13px] text-[#55606E]">Tidak ada template yang cocok.</p> : (
          <div className="overflow-x-auto -mx-1">
            <table className="w-full text-[13px] min-w-[560px]">
              <thead>
                <tr className="text-left text-[12px] text-[#55606E] border-b border-[#D5DCE4]">
                  <th className="px-2 py-2 w-8"><input type="checkbox" checked={allVisibleSel} onChange={toggleAll} aria-label="Pilih semua yang tampil" /></th>
                  <th className="px-2 py-2">Template</th><th className="px-2 py-2 hidden sm:table-cell">Kategori</th><th className="px-2 py-2">Status</th>
                  <th className="px-2 py-2 text-right">Harga lama</th><th className="px-2 py-2 w-36">Harga baru (Rp)</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((t) => {
                  const cur = t.price || 0, now = priceOf(t), changed = now !== cur;
                  return (
                    <tr key={t.id} className={`border-b border-[#EEF1F5] ${changed ? "bg-[#FFF8DC]" : ""}`}>
                      <td className="px-2 py-2"><input type="checkbox" checked={sel.has(t.id)} onChange={() => toggle(t.id)} aria-label={`Pilih ${t.name}`} /></td>
                      <td className="px-2 py-2"><div className="flex items-center gap-2 min-w-0"><div className="w-9 h-12 shrink-0 rounded bg-[#F4F7FA] border border-[#D5DCE4] overflow-hidden"><TemplatePreview template={t} className="h-full w-full" /></div><span className="font-semibold break-words min-w-0">{t.name}</span></div></td>
                      <td className="px-2 py-2 hidden sm:table-cell text-[#55606E]">{catLabel(t.category)}</td>
                      <td className="px-2 py-2">{t.favorite ? <span className="text-emerald-700 font-bold">Live ★</span> : <span className="text-[#6B7684]">Draft</span>}</td>
                      <td className="px-2 py-2 text-right text-[#55606E]">{cur ? rupiah(cur) : "Gratis"}</td>
                      <td className="px-2 py-2">
                        <input value={now ? String(now) : "0"} onChange={(e) => setOne(t.id, e.target.value)} onFocus={(e) => e.target.select()} inputMode="numeric" aria-label={`Harga baru ${t.name}`} className={`w-full px-2 py-1.5 border rounded-lg text-right text-[13px] ${changed ? "border-[#E02843] font-bold" : "border-[#C7D0DA]"}`} />
                        {now === 0 && <div className="text-[11px] text-amber-600 text-right">Gratis</div>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <div className="sticky bottom-0 -mx-4 sm:-mx-6 px-4 sm:px-6 py-3 bg-white/95 backdrop-blur border-t border-[#D5DCE4] flex flex-wrap items-center gap-3">
        <span className="text-[13px] text-[#262A38] mr-auto">{changes.length ? <><b>{changes.length}</b> perubahan belum disimpan</> : "Tidak ada perubahan"}</span>
        {last?.length > 0 && <Btn onClick={undo} disabled={busy}>Batalkan perubahan terakhir ({last.length})</Btn>}
        <Btn onClick={() => { setDraft({}); setMsg(null); }} disabled={busy || !changes.length}>Buang perubahan</Btn>
        <Btn variant="primary" onClick={save} disabled={busy || !changes.length}>{busy ? "Menyimpan…" : "Simpan perubahan"}</Btn>
      </div>
    </Page>
  );
}
