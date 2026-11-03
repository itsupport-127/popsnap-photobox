import { useEffect, useState } from "react";
import { API_BASE } from "../services/settingsService";

/** Level ruang disk PC booth: "ok" | "low" (< 5 GB) | "critical" (< 1 GB). Dicek tiap 60 detik; gagal baca = "ok" (jangan menghalangi sesi). */
export default function useStorage(intervalMs = 60000) {
  const [info, setInfo] = useState({ level: "ok", freeGB: null });
  useEffect(() => {
    let off = false;
    const run = () => fetch(`${API_BASE}/api/system/disk`).then((r) => r.json()).then((d) => { if (!off && d?.level) setInfo({ level: d.level, freeGB: d.freeGB }); }).catch(() => {});
    run();
    const id = setInterval(run, intervalMs);
    return () => { off = true; clearInterval(id); };
  }, [intervalMs]);
  return info;
}
