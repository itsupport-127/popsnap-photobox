import React, { useCallback, useEffect, useRef, useState } from "react";
import { Page, Card, Btn, Notice } from "./ui";
import { inputCls } from "./editorKit";
import {
  adminListStickers, uploadStickers, updateSticker, deleteSticker, saveBuiltinStickers, DEFAULT_STICKERS,
  createStickerCategory, renameStickerCategory, deleteStickerCategory,
} from "../services/stickerService";

const CHECKER = "repeating-conic-gradient(#E9EEF3 0% 25%, #fff 0% 50%) 50% / 16px 16px";

/** Admin > Stiker: unggah stiker untuk layar "Add sticker" di booth, dikelompokkan per kategori. */
export default function StickersPage() {
  const [data, setData] = useState({ categories: [], uncategorized: 0, stickers: [], builtin: { mode: "auto", hidden: [] } });
  const [tab, setTab] = useState("all"); // all | none | id kategori
  const [msg, setMsg] = useState(null); // { tone, text }
  const [busy, setBusy] = useState(false);
  const [newCat, setNewCat] = useState("");
  const [over, setOver] = useState(false);
  const fileRef = useRef(null);
  const dirRef = useRef(null);

  const load = useCallback(() => adminListStickers().then(setData).catch((e) => setMsg({ tone: "error", text: e.message })), []);
  useEffect(() => { load(); }, [load]);

  const run = async (fn, okText) => {
    setBusy(true); setMsg(null);
    try {
      const r = await fn();
      if (r) { setData((p) => ({ categories: r.categories, uncategorized: r.uncategorized, stickers: r.stickers, builtin: r.builtin ?? p.builtin })); if (okText) setMsg({ tone: "ok", text: okText(r) }); return r; }
    } catch (e) { setMsg({ tone: "error", text: e.message }); }
    finally { setBusy(false); }
  };

  const targetCat = tab !== "all" && tab !== "none" ? tab : "";
  const upload = (files) => {
    const list = [...files].filter((f) => f.type.startsWith("image/"));
    if (!list.length) return setMsg({ tone: "warn", text: "Pilih file gambar (PNG / WEBP / GIF / JPG)." });
    run(() => uploadStickers(list, targetCat), (r) => `${r.added} stiker ditambahkan.${r.rejected?.length ? ` Ditolak: ${r.rejected.join("; ")}` : ""}`);
  };

  const bi = data.builtin || { mode: "auto", hidden: [] }, hid = bi.hidden || [];
  // Impor FOLDER: nama subfolder = kategori (dibuat otomatis kalau belum ada); file di luar subfolder masuk kategori yang sedang dibuka
  const importFolder = async (fileList) => {
    const files = [...fileList].filter((f) => f.type.startsWith("image/"));
    if (!files.length) return setMsg({ tone: "warn", text: "Tidak ada file gambar (PNG / WEBP / GIF / JPG) di folder itu." });
    const groups = new Map(); // label kategori ("" = kategori yang sedang dibuka) -> file
    for (const f of files) {
      const parts = String(f.webkitRelativePath || "").split("/");
      const label = (parts.length >= 3 ? parts[parts.length - 2] : parts.length === 2 ? parts[0] : "").trim().slice(0, 40);
      if (!groups.has(label)) groups.set(label, []);
      groups.get(label).push(f);
    }
    setBusy(true); setMsg(null);
    let added = 0, rejected = [], cats = [...data.categories], last = null;
    try {
      for (const [label, list] of groups) {
        let catId = targetCat;
        if (label) {
          let c = cats.find((x) => x.label.toLowerCase() === label.toLowerCase());
          if (!c) { const r = await createStickerCategory(label); if (!r) return; cats = r.categories; c = cats.find((x) => x.id === r.created) || cats.find((x) => x.label.toLowerCase() === label.toLowerCase()); }
          catId = c?.id || "";
        }
        list.sort((a, b) => String(a.name).localeCompare(String(b.name), undefined, { numeric: true }));
        for (let i = 0; i < list.length; i += 40) { // server menerima maks. 40 file per kiriman
          const r = await uploadStickers(list.slice(i, i + 40), catId);
          if (!r) return;
          added += r.added || 0; rejected.push(...(r.rejected || [])); last = r;
        }
      }
      if (last) setData((p) => ({ categories: last.categories, uncategorized: last.uncategorized, stickers: last.stickers, builtin: last.builtin ?? p.builtin }));
      setMsg({ tone: rejected.length ? "warn" : "ok", text: `${added} stiker diimpor dari ${groups.size > 1 || [...groups.keys()][0] ? groups.size + " kategori/folder" : "folder"}.${rejected.length ? ` Ditolak: ${rejected.slice(0, 5).join("; ")}${rejected.length > 5 ? ` (+${rejected.length - 5})` : ""}` : ""}` });
    } catch (e) { setMsg({ tone: "error", text: e.message }); load(); }
    finally { setBusy(false); }
  };

  const shown = data.stickers.filter((s) => (tab === "all" ? true : tab === "none" ? !s.categoryId : s.categoryId === tab));
  const curCat = data.categories.find((c) => c.id === tab);

  const addCat = async () => {
    const label = newCat.trim();
    if (!label) return;
    const r = await run(() => createStickerCategory(label), () => `Kategori "${label}" dibuat.`);
    if (r?.created) { setTab(r.created); setNewCat(""); }
  };
  const rename = () => {
    const label = window.prompt("Nama baru kategori:", curCat.label);
    if (label && label.trim()) run(() => renameStickerCategory(curCat.id, label.trim()), () => "Nama kategori diubah.");
  };
  const removeCat = async () => {
    if (!window.confirm(`Hapus kategori "${curCat.label}"? Stikernya tidak dihapus, hanya pindah ke "Lainnya".`)) return;
    await run(() => deleteStickerCategory(curCat.id), () => "Kategori dihapus.");
    setTab("all");
  };

  const tabs = [{ id: "all", label: "Semua", n: data.stickers.length }, ...data.categories.map((c) => ({ id: c.id, label: c.label, n: c.count })), ...(data.uncategorized && data.categories.length ? [{ id: "none", label: "Lainnya", n: data.uncategorized }] : [])];

  return (
    <Page title="Stiker" subtitle="Stiker yang bisa ditempel tamu di layar Add sticker. Kategori bersifat opsional: kalau dibuat, muncul sebagai tab di booth.">
      {data.stickers.length === 0 && <Notice tone="info">Belum ada stiker unggahan, jadi booth memakai stiker bawaan (atur di kartu "Stiker bawaan" di bawah). Begitu kamu mengunggah satu stiker, stiker bawaan otomatis diganti, kecuali kamu pilih "Selalu".</Notice>}
      {msg && <Notice tone={msg.tone}>{msg.text}</Notice>}

      <Card title="Kategori" hint="Contoh: Ulang tahun, Wisuda, Lucu, Natal. Menghapus kategori tidak menghapus stikernya.">
        <div className="flex flex-wrap gap-2 items-center">
          {tabs.map((t) => (
            <button key={t.id} onClick={() => setTab(t.id)} className={`px-3 py-1.5 rounded-full text-[13px] font-bold italic border ${tab === t.id ? "bg-[#E02843] text-white border-black/50" : "bg-white border-[#C7D0DA] text-[#181B23]"}`}>
              {t.label} <span className="opacity-70">({t.n})</span>
            </button>
          ))}
        </div>
        <div className="flex flex-wrap gap-2 items-center mt-3">
          <input className={`${inputCls} !w-56 rounded-full px-3`} placeholder="Nama kategori baru" value={newCat} maxLength={40}
            onChange={(e) => setNewCat(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addCat()} />
          <Btn onClick={addCat} disabled={busy || !newCat.trim()}>+ Tambah kategori</Btn>
          {curCat && <><Btn onClick={rename} disabled={busy}>Ganti nama</Btn><Btn variant="danger" onClick={removeCat} disabled={busy}>Hapus kategori</Btn></>}
        </div>
      </Card>

      <Card title={`Unggah stiker${curCat ? ` ke "${curCat.label}"` : ""}`} hint="PNG transparan paling bagus. PNG / WEBP / GIF / JPG, maks. 3 MB dan 4000 px per gambar, bisa banyak file sekaligus.">
        <div
          onDragOver={(e) => { e.preventDefault(); setOver(true); }} onDragLeave={() => setOver(false)}
          onDrop={(e) => { e.preventDefault(); setOver(false); upload(e.dataTransfer.files); }}
          onClick={() => fileRef.current?.click()}
          className={`border-2 border-dashed rounded-[16px] px-4 py-8 text-center cursor-pointer text-[13px] ${over ? "border-[#E02843] bg-[#FDE8EB]" : "border-[#C7D0DA] bg-[#F4F7FA]"}`}>
          {busy ? "Mengunggah…" : "Klik di sini atau seret file stiker ke sini (bisa banyak file sekaligus)"}
          <input ref={fileRef} type="file" multiple accept="image/png,image/webp,image/gif,image/jpeg" className="hidden"
            onChange={(e) => { if (e.target.files?.length) upload(e.target.files); e.target.value = ""; }} />
        </div>
        <div className="flex flex-wrap items-center gap-3 mt-3">
          <Btn onClick={() => dirRef.current?.click()} disabled={busy}>Impor folder stiker</Btn>
          <span className="text-[12px] text-[#6B7684]">Pilih satu folder berisi gambar. Nama subfolder otomatis jadi kategori (mis. Ulang Tahun/a.png → kategori “Ulang Tahun”). Folder tanpa subfolder masuk ke kategori yang sedang dibuka.</span>
          <input ref={dirRef} type="file" webkitdirectory="" directory="" multiple className="hidden"
            onChange={(e) => { if (e.target.files?.length) importFolder(e.target.files); e.target.value = ""; }} />
        </div>
      </Card>

      <Card title={`Stiker bawaan (${DEFAULT_STICKERS.length - hid.length} tampil dari ${DEFAULT_STICKERS.length})`} hint="Stiker gambar bawaan aplikasi. Stiker bawaan tidak bisa dihapus permanen, tapi bisa disembunyikan dari booth. Mau diganti? Unggah stikermu di atas, lalu sembunyikan bawaan.">
        <div className="flex flex-wrap gap-2 items-center mb-3">
          <span className="text-[13px] font-bold">Tampilkan di booth:</span>
          <select className={`${inputCls} !w-auto`} value={bi.mode} disabled={busy} onChange={(e) => run(() => saveBuiltinStickers({ mode: e.target.value }), () => "Pengaturan stiker bawaan disimpan.")}>
            <option value="auto">Otomatis (hanya kalau belum ada stiker unggahan)</option>
            <option value="on">Selalu, bersama stiker unggahan (tab "Bawaan")</option>
            <option value="off">Jangan tampilkan sama sekali</option>
          </select>
          <Btn disabled={busy} onClick={() => run(() => saveBuiltinStickers({ hidden: DEFAULT_STICKERS.map((s) => s.id) }), () => "Semua stiker bawaan disembunyikan.")}>Sembunyikan semua</Btn>
          <Btn disabled={busy} onClick={() => run(() => saveBuiltinStickers({ hidden: [] }), () => "Semua stiker bawaan ditampilkan.")}>Tampilkan semua</Btn>
        </div>
        {bi.mode === "auto" && data.stickers.length > 0 && <p className="text-[12px] text-[#6B7684] mb-3">Saat ini sudah ada stiker unggahan, jadi stiker bawaan tidak tampil di booth. Pilih "Selalu" kalau mau menampilkannya juga.</p>}
        <div className="grid grid-cols-4 md:grid-cols-7 gap-3">
          {DEFAULT_STICKERS.map((s) => {
            const off = hid.includes(s.id) || bi.mode === "off";
            return (
              <div key={s.id} className={`border border-[#D5DCE4] rounded-[14px] p-2 bg-white flex flex-col gap-1.5 ${off ? "opacity-50" : ""}`}>
                <div className="aspect-square rounded-[10px] flex items-center justify-center" style={{ background: CHECKER }}>
                  <img src={s.url} alt={s.name} className="max-w-full max-h-full object-contain p-1" draggable={false} />
                </div>
                <button className="text-[12px] font-bold text-[#E02843] hover:underline text-left disabled:opacity-40" disabled={busy}
                  onClick={() => run(() => saveBuiltinStickers({ hidden: hid.includes(s.id) ? hid.filter((x) => x !== s.id) : [...hid, s.id] }))}>
                  {hid.includes(s.id) ? "Tampilkan" : "Sembunyikan"}
                </button>
              </div>
            );
          })}
        </div>
      </Card>

      <Card title={`Daftar stiker (${shown.length})`}>
        {shown.length === 0 ? <p className="text-[13px] text-[#6B7684]">Belum ada stiker di sini.</p> : (
          <div className="grid grid-cols-4 md:grid-cols-6 gap-3">
            {shown.map((s) => (
              <div key={s.id} className="border border-[#D5DCE4] rounded-[14px] p-2 bg-white flex flex-col gap-1.5">
                <div className="aspect-square rounded-[10px] flex items-center justify-center" style={{ background: CHECKER }}>
                  <img src={s.url} alt={s.name} className="max-w-full max-h-full object-contain p-1" draggable={false} />
                </div>
                <select className={`${inputCls} !text-[12px]`} value={s.categoryId || ""} disabled={busy}
                  onChange={(e) => run(() => updateSticker(s.id, { categoryId: e.target.value || null }))}>
                  <option value="">Lainnya</option>
                  {data.categories.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
                </select>
                <button className="text-[12px] font-bold text-[#E02843] hover:underline text-left disabled:opacity-40" disabled={busy}
                  onClick={() => window.confirm("Hapus stiker ini?") && run(() => deleteSticker(s.id), () => "Stiker dihapus.")}>Hapus</button>
              </div>
            ))}
          </div>
        )}
      </Card>
    </Page>
  );
}
