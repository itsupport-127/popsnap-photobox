import { useEffect, useRef, useState } from "react";
import { reportState, pollCommands } from "../services/remoteService";

/**
 * Menghubungkan layar kiosk dengan Remote Booth (lewat backend lokal):
 *  - melapor layar yang sedang tampil tiap berubah + tiap 6 dtk
 *  - menerima perintah: lock / unlock / cancel_session / reload_ui
 * Kunci tidak memutus tamu yang sedang berfoto: layar baru terkunci saat kembali ke layar awal (WELCOME).
 * Kegagalan jaringan lokal diabaikan — booth tetap jalan normal tanpa Remote.
 */
export default function useRemoteLink(state, shots, dispatch, welcomeState = "WELCOME") {
  const [lock, setLock] = useState({ on: false, message: "" });
  const ref = useRef({ state, shots, lock });
  ref.current = { state, shots, lock };

  const locked = lock.on && state === welcomeState ? "on" : lock.on ? "pending" : "off";

  // laporan status
  useEffect(() => {
    let dead = false;
    const send = () => reportState({ screen: ref.current.state, shots: ref.current.shots, locked: ref.current.lock.on ? (ref.current.state === welcomeState ? "on" : "pending") : "off" })
      .then((r) => { if (!dead && r?.lock) setLock((p) => (p.on === r.lock.on && p.message === r.lock.message ? p : { on: !!r.lock.on, message: r.lock.message || "" })); })
      .catch(() => {});
    send();
    const t = setInterval(send, 6000);
    return () => { dead = true; clearInterval(t); };
  }, [state, shots, lock.on, welcomeState]);

  // penerima perintah
  useEffect(() => {
    let dead = false; const ctl = new AbortController();
    (async () => {
      while (!dead) {
        try {
          const cmds = await pollCommands(ctl.signal);
          for (const c of cmds) {
            if (c.type === "lock") setLock({ on: true, message: c.message || "" });
            else if (c.type === "unlock") setLock({ on: false, message: "" });
            else if (c.type === "cancel_session") dispatch({ type: "CANCEL_SESSION" });
            else if (c.type === "reload_ui") window.location.reload();
          }
        } catch { if (dead) return; await new Promise((r) => setTimeout(r, 4000)); }
      }
    })();
    return () => { dead = true; ctl.abort(); };
  }, [dispatch]);

  return { locked, lockMessage: lock.message };
}
