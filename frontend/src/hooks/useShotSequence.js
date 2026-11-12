import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Urutan pemotretan otomatis ala dslrBooth:  hitung mundur -> jepret -> tampilkan foto -> (hitung mundur lagi...)
 *
 * @param {object} p
 * @param {boolean} p.active        kamera siap & layar tidak sedang di-pause
 * @param {boolean} p.needed        masih ada foto yang perlu diambil
 * @param {number}  p.shotCount     jumlah foto yang sudah ada (berubah = urutan di-reset, mis. setelah retake)
 * @param {boolean} p.manual        true = TIDAK mulai sendiri: menunggu start() (ketuk layar / tombol), baru hitung mundur -> jepret
 * @param {boolean} p.autoSequence  (mode otomatis) false = foto hanya diambil saat tombol rana ditekan
 * @param {boolean} p.autoTrigger   false = setelah hitung mundur menunggu tombol "Ambil foto"
 * @param {number}  p.countdownFirst / countdownOthers / displaySeconds / pauseSeconds (jeda setelah foto tampil, sebelum hitung mundur berikutnya)
 * @param {Function} p.capture      async () => dataURL
 * @param {Function} p.onCaptured   (photo) => void
 * @returns {{ phase, count, lastPhoto, shootNow, start }}  phase: idle | countdown | await | flash | review | wait
 */
export default function useShotSequence({ active, needed, shotCount, manual = false, autoSequence, autoTrigger, countdownFirst, countdownOthers, displaySeconds, pauseSeconds = 0, capture, onCaptured }) {
  const [phase, setPhase] = useState("idle");
  const [count, setCount] = useState(0);
  const [lastPhoto, setLastPhoto] = useState(null);
  const timers = useRef([]);
  const busy = useRef(false);
  const ownChange = useRef(false); // true = perubahan jumlah foto datang dari hook ini sendiri (bukan retake dari luar)
  const latest = useRef({});
  latest.current = { capture, onCaptured, displaySeconds, pauseSeconds, needed, manual, autoSequence, autoTrigger, countdownFirst, countdownOthers, shotCount };

  const clearTimers = () => { timers.current.forEach(clearTimeout); timers.current = []; };
  const later = (fn, ms) => { const t = setTimeout(fn, ms); timers.current.push(t); };

  const shoot = useCallback(async () => {
    if (busy.current) return;
    busy.current = true;
    clearTimers();
    setPhase("flash");
    await new Promise((r) => setTimeout(r, 140)); // kilatan putih menutup layar; jepret tepat di puncak kilatan
    let photo = null;
    try { photo = await latest.current.capture(); } catch { /* ditangani di bawah */ }
    busy.current = false;
    if (!photo) { setPhase("idle"); return; }
    setLastPhoto(photo);
    const secs = latest.current.displaySeconds;
    ownChange.current = true;
    latest.current.onCaptured(photo);
    // Setelah foto tampil: kalau masih ada foto berikutnya & urutannya otomatis, beri jeda "wait" (live view + aba-aba) supaya tamu sempat ganti pose
    const afterReview = () => {
      const L = latest.current;
      if (L.pauseSeconds > 0 && L.needed && !L.manual && L.autoSequence) { setPhase("wait"); later(() => setPhase("idle"), L.pauseSeconds * 1000); }
      else setPhase("idle");
    };
    if (secs > 0) { setPhase("review"); later(afterReview, secs * 1000); }
    else { setPhase("wait"); later(afterReview, 60); } // 60 ms: beri React waktu memperbarui "needed" setelah foto terakhir
  }, []);

  // Mode manual: tamu mengetuk -> mulai hitung mundur (0 detik = langsung jepret)
  const start = useCallback(() => {
    if (busy.current) return;
    const secs = latest.current.shotCount === 0 ? latest.current.countdownFirst : latest.current.countdownOthers;
    if (secs <= 0) { shoot(); return; }
    clearTimers();
    setCount(secs);
    setPhase("countdown");
  }, [shoot]);

  // Mulai hitung mundur tiap kali "idle" & masih perlu foto (hanya mode otomatis)
  useEffect(() => {
    if (manual || !active || !needed || !autoSequence || phase !== "idle" || busy.current) return;
    const start = latest.current.shotCount === 0 ? latest.current.countdownFirst : latest.current.countdownOthers;
    if (start <= 0) { latest.current.autoTrigger ? shoot() : setPhase("await"); return; }
    setCount(start);
    setPhase("countdown");
  }, [manual, active, needed, autoSequence, phase, shoot]);

  // Detik demi detik
  useEffect(() => {
    if (phase !== "countdown") return;
    if (count <= 0) { latest.current.autoTrigger ? shoot() : setPhase("await"); return; }
    const t = setTimeout(() => setCount((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [phase, count, shoot]);

  // Jumlah foto berubah DARI LUAR (retake) -> ulang urutan dari awal. Perubahan akibat jepretan kita sendiri diabaikan,
  // kalau tidak tampilan "review" langsung terpotong.
  useEffect(() => {
    if (ownChange.current) { ownChange.current = false; return; }
    if (!busy.current) { clearTimers(); setPhase("idle"); }
  }, [shotCount]);

  // Di-pause (popup / batal) -> hentikan hitung mundur. JANGAN reset saat berubah menjadi aktif: efek itu
  // berjalan bersamaan dengan efek "mulai hitung mundur" dan akan menimpanya (bug: hitung mundur tidak pernah mulai).
  useEffect(() => {
    if (!active && !busy.current) { clearTimers(); setPhase("idle"); }
  }, [active]);

  useEffect(() => () => clearTimers(), []);

  return { phase, count, lastPhoto, shootNow: shoot, start };
}
