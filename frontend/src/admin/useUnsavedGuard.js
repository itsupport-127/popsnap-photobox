import { useEffect } from "react";

/**
 * Peringatan "perubahan belum disimpan". Aktif selama dirty = true:
 *  - tutup / muat ulang tab atau aplikasi -> dialog bawaan browser
 *  - klik menu / tautan lain di dalam admin -> konfirmasi (Batal = tetap di halaman)
 * (Router yang dipakai bukan "data router", jadi tombol Back tidak bisa dicegat; yang tertangkap: menu, tautan, tutup, refresh.)
 */
export default function useUnsavedGuard(dirty) {
  useEffect(() => {
    if (!dirty) return undefined;
    const onUnload = (e) => { e.preventDefault(); e.returnValue = ""; };
    const onClick = (e) => {
      const a = e.target?.closest?.("a[href]");
      if (!a || a.target === "_blank" || a.hasAttribute("download")) return;
      const href = a.getAttribute("href") || "";
      if (href.startsWith("mailto:") || href.startsWith("tel:")) return;
      if (!window.confirm("Ada perubahan yang belum disimpan. Tinggalkan halaman ini?")) { e.preventDefault(); e.stopPropagation(); }
    };
    window.addEventListener("beforeunload", onUnload);
    document.addEventListener("click", onClick, true); // fase capture: lebih dulu dari penangan router
    return () => { window.removeEventListener("beforeunload", onUnload); document.removeEventListener("click", onClick, true); };
  }, [dirty]);
}
