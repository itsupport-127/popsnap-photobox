import React, { useEffect, useRef, useState } from "react";
import { Minus, Plus } from "lucide-react";
import FilteredImg from "./FilteredImg";
import { ADJ_MAX, clampAdjust, isNeutral, overflowFrac } from "../utils/photoAdjust";

/**
 * Jendela "Zoom / Geser": tamu memperbesar dan menggeser foto di dalam slot template.
 *  - geser foto dengan jari / mouse, cubit dua jari atau roda mouse untuk zoom, atau tombol − / + dan penggeser
 *  - bisa pindah antar slot lewat nomor di atas; hasilnya tersimpan per slot (editorState.adjust)
 * @param slots   [{ n, aspect, url, radius }]  slot yang punya foto (n = nomor slot)
 */
export default function PhotoAdjustModal({ slots, startSlot, adjust, filterId, mirror, onChange, onClose }) {
  const [cur, setCur] = useState(() => (slots.some((s) => s.n === startSlot) ? startSlot : slots[0]?.n));
  const slot = slots.find((s) => s.n === cur) ?? slots[0];
  const [photoAR, setPhotoAR] = useState(null);
  const [a, setA] = useState({ z: 1, tx: 0, ty: 0 });
  const boxRef = useRef(null);
  const pts = useRef(new Map());
  const gest = useRef(null);
  const live = useRef(a); live.current = a;

  // Muat foto untuk tahu rasio aslinya (batas geser bergantung padanya)
  useEffect(() => {
    if (!slot) return undefined;
    let dead = false;
    setPhotoAR(null);
    const im = new Image();
    im.onload = () => { if (!dead) setPhotoAR(im.naturalWidth / (im.naturalHeight || 1)); };
    im.src = slot.url;
    return () => { dead = true; };
  }, [slot?.url]); // eslint-disable-line react-hooks/exhaustive-deps

  // Ganti slot -> muat pengaturan tersimpan slot itu
  useEffect(() => { setA(adjust?.[cur] ? { z: adjust[cur].z || 1, tx: adjust[cur].tx || 0, ty: adjust[cur].ty || 0 } : { z: 1, tx: 0, ty: 0 }); }, [cur]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!slot) return null;
  const AR = slot.aspect || 1;
  const pAR = photoAR || AR;
  const clamp = (v) => clampAdjust(v, AR, pAR);
  const commit = (v) => onChange(cur, isNeutral(v) ? null : v);
  const apply = (v, save = false) => { const c = clamp(v); setA(c); if (save) commit(c); return c; };
  const setZoom = (z, save) => apply({ ...live.current, z }, save);

  const down = (e) => {
    e.currentTarget.setPointerCapture?.(e.pointerId);
    pts.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const r = boxRef.current.getBoundingClientRect();
    if (pts.current.size === 2) {
      const [p, q] = [...pts.current.values()];
      gest.current = { mode: "pinch", d0: Math.hypot(p.x - q.x, p.y - q.y) || 1, z0: live.current.z };
    } else gest.current = { mode: "pan", x0: e.clientX, y0: e.clientY, tx0: live.current.tx, ty0: live.current.ty, w: r.width, h: r.height };
  };
  const move = (e) => {
    if (!pts.current.has(e.pointerId) || !gest.current) return;
    pts.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const g = gest.current;
    if (g.mode === "pinch" && pts.current.size >= 2) {
      const [p, q] = [...pts.current.values()];
      apply({ ...live.current, z: g.z0 * (Math.hypot(p.x - q.x, p.y - q.y) / g.d0) });
    } else if (g.mode === "pan") {
      apply({ ...live.current, tx: g.tx0 + (e.clientX - g.x0) / g.w, ty: g.ty0 + (e.clientY - g.y0) / g.h });
    }
  };
  const up = (e) => {
    pts.current.delete(e.pointerId);
    if (pts.current.size === 0) { gest.current = null; commit(live.current); }
    else if (pts.current.size === 1) { // dari cubit kembali ke geser satu jari
      const [p] = [...pts.current.values()], r = boxRef.current.getBoundingClientRect();
      gest.current = { mode: "pan", x0: p.x, y0: p.y, tx0: live.current.tx, ty0: live.current.ty, w: r.width, h: r.height };
    }
  };
  const wheel = (e) => setZoom(live.current.z * Math.exp(-e.deltaY * 0.0015), true);

  const { fx, fy } = overflowFrac(a.z, AR, pAR);
  const canPan = fx > 0.001 || fy > 0.001;
  const btn = "px-5 py-3 rounded-full font-bold text-[18px] border-2 border-black/80";
  const round = { width: 56, height: 56, borderRadius: "50%", border: "2px solid #000", background: "#fff", display: "flex", alignItems: "center", justifyContent: "center" };

  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center p-3" style={{ background: "rgba(0,0,0,.78)" }} role="dialog" aria-label="Zoom dan geser foto">
      <div className="modal-card flex flex-col items-center gap-3 p-4" style={{ maxWidth: "94vw", maxHeight: "96vh" }}>
        <p className="display-h3" style={{ margin: 0 }}>Zoom &amp; geser foto</p>
        {slots.length > 1 && (
          <div className="flex gap-2 flex-wrap justify-center">
            {slots.map((s) => (
              <button key={s.n} type="button" onClick={() => setCur(s.n)} aria-pressed={s.n === cur}
                style={{ width: 52, height: 52, borderRadius: "50%", border: "2px solid #000", fontWeight: 800, fontSize: 22, background: s.n === cur ? "#E02843" : "#fff", color: s.n === cur ? "#fff" : "#222" }}>{s.n + 1}</button>
            ))}
          </div>
        )}
        {/* Jendela slot: persis bentuk slot di template */}
        <div ref={boxRef} onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up} onWheel={wheel}
          style={{ position: "relative", overflow: "hidden", aspectRatio: String(AR), width: `min(86vw, calc(44vh * ${AR}))`, maxWidth: "100%", background: "#222", borderRadius: slot.radius || 0, border: "3px solid #E02843", touchAction: "none", cursor: canPan ? "grab" : "default", userSelect: "none" }}>
          <div style={{ position: "absolute", inset: 0, transformOrigin: "center", transform: `translate(${a.tx * 100}%, ${a.ty * 100}%) scale(${a.z})` }}>
            <FilteredImg src={slot.url} filterId={filterId} mirror={mirror} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block", pointerEvents: "none" }} />
          </div>
        </div>
        <p style={{ margin: 0, fontSize: 15, color: "#55606E", textAlign: "center" }}>
          {a.z <= 1.005 && !canPan ? "Perbesar dulu untuk menggeser foto" : canPan ? "Geser foto dengan jari · cubit atau tombol +/− untuk zoom" : "Geser tidak diperlukan"}
        </p>
        <div className="flex items-center gap-3 w-full" style={{ maxWidth: 420 }}>
          <button type="button" aria-label="Perkecil" onClick={() => setZoom(live.current.z - 0.25, true)} style={round}><Minus size={26} /></button>
          <input type="range" min={1} max={ADJ_MAX} step={0.01} value={a.z} aria-label="Zoom" onChange={(e) => setZoom(Number(e.target.value))} onPointerUp={() => commit(live.current)} onKeyUp={() => commit(live.current)} style={{ flex: 1, accentColor: "#E02843", height: 36 }} />
          <button type="button" aria-label="Perbesar" onClick={() => setZoom(live.current.z + 0.25, true)} style={round}><Plus size={26} /></button>
          <span style={{ width: 52, textAlign: "right", fontWeight: 700 }}>{Math.round(a.z * 100)}%</span>
        </div>
        <div className="flex gap-3">
          <button type="button" className={btn} style={{ background: "#fff" }} disabled={isNeutral(a)} onClick={() => { setA({ z: 1, tx: 0, ty: 0 }); onChange(cur, null); }}>Reset</button>
          <button type="button" className={btn} style={{ background: "#E02843", color: "#fff" }} onClick={() => { commit(live.current); onClose(); }}>Selesai</button>
        </div>
      </div>
    </div>
  );
}
