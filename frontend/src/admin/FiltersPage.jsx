import useUnsavedGuard from "./useUnsavedGuard";
import React, { useEffect, useRef, useState } from "react";
import { getAdminSettings, saveAdminSettings } from "../services/settingsService";
import { Btn, Notice, Page, useSavedFlag } from "./ui";
import SettingsFilters from "./settings/SettingsFilters";

/** Admin > Filter: daftar filter foto yang bisa dipilih tamu di layar Pilih & Edit Foto (menu sendiri, seperti Stiker). */
export default function FiltersPage() {
  const [s, setS] = useState(null);
  const original = useRef(null);
  const [saved, flash] = useSavedFlag();
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    getAdminSettings().then((d) => { if (d) { setS(d); original.current = JSON.stringify(d.editor ?? {}); } }).catch((e) => setError(e.message));
  }, []);

  useUnsavedGuard(!!s && JSON.stringify(s.editor ?? {}) !== original.current && !saved); // hook harus sebelum return awal
  if (!s) return <Page title="Filter">{error ? <Notice tone="error">{error}</Notice> : <p className="text-[#6B7684] text-[13px]">Memuat...</p>}</Page>;

  const set = (path, value) => setS((prev) => {
    const next = JSON.parse(JSON.stringify(prev));
    let o = next;
    for (const k of path.slice(0, -1)) o = o[k];
    o[path[path.length - 1]] = value;
    return next;
  });
  const dirty = JSON.stringify(s.editor ?? {}) !== original.current;

  async function save() {
    setError(null); setBusy(true);
    try {
      const res = await saveAdminSettings({ editor: s.editor }); // hanya bagian filter yang dikirim
      if (res) { setS(res); original.current = JSON.stringify(res.editor ?? {}); }
      flash();
    } catch (err) { setError(err.message); }
    finally { setBusy(false); }
  }
  const discard = () => { const e = JSON.parse(original.current); setS((p) => ({ ...p, editor: e })); setError(null); };

  return (
    <div className="pb-24">
      <Page title="Filter" subtitle="Filter foto yang bisa dipilih tamu di layar Pilih & Edit Foto. Tambah, ubah urutan, atau impor filter sendiri.">
        {error && <Notice tone="error">{error}</Notice>}
        <SettingsFilters s={s} set={set} />
      </Page>
      <div className="fixed bottom-0 left-0 right-0 bg-[#FFFFFF] border-t border-[#D5DCE4] px-6 py-3 flex items-center justify-end gap-3 z-20">
        {saved && <span className="text-emerald-600 text-[13px]">Tersimpan ✓</span>}
        {dirty && !saved && <span className="text-amber-600 text-[13px]">Ada perubahan yang belum disimpan</span>}
        <Btn onClick={discard} disabled={!dirty || busy}>Cancel</Btn>
        <Btn variant="primary" onClick={save} disabled={!dirty || busy}>{busy ? "Menyimpan..." : "Save"}</Btn>
      </div>
    </div>
  );
}
