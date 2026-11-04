import React, { useEffect, useRef } from "react";
import { clampAdjust, isNeutral } from "../utils/photoAdjust";

/**
 * Lapisan sentuh di atas satu slot foto (Editor, langkah gaya):
 *  - cubit dua jari = zoom, geser satu jari = pindahkan foto, roda mouse = zoom — langsung, tanpa membuka jendela
 *  - ketuk saja (tanpa bergerak) = onTap (buka jendela Zoom / Geser dengan penggeser & tombol)
 * Hasil disimpan lewat onChange(adj | null), sama seperti PhotoAdjustModal.
 */
export default function SlotGestureLayer({ url, adj, onChange, onTap, style, label }) {
  const ref = useRef(null);
  const pts = useRef(new Map());
  const gest = useRef(null);
  const moved = useRef(false);
  const arRef = useRef(null);
  const cur = useRef({ z: 1, tx: 0, ty: 0 });
  cur.current = { z: adj?.z || 1, tx: adj?.tx || 0, ty: adj?.ty || 0 };

  // Rasio asli foto (batas geser bergantung padanya)
  useEffect(() => {
    let dead = false; arRef.current = null;
    const im = new Image();
    im.onload = () => { if (!dead) arRef.current = im.naturalWidth / (im.naturalHeight || 1); };
    im.src = url;
    return () => { dead = true; };
  }, [url]);

  const slotAR = () => { const el = ref.current; return el && el.offsetHeight ? el.offsetWidth / el.offsetHeight : 1; };
  const apply = (v) => { const c = clampAdjust(v, slotAR(), arRef.current || slotAR()); cur.current = c; onChange(isNeutral(c) ? null : c); };
  const rect = () => ref.current.getBoundingClientRect();

  const down = (e) => {
    e.currentTarget.setPointerCapture?.(e.pointerId);
    pts.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const r = rect();
    if (pts.current.size === 1) moved.current = false;
    if (pts.current.size === 2) {
      const [p, q] = [...pts.current.values()];
      gest.current = { mode: "pinch", d0: Math.hypot(p.x - q.x, p.y - q.y) || 1, z0: cur.current.z };
      moved.current = true;
    } else gest.current = { mode: "pan", x0: e.clientX, y0: e.clientY, tx0: cur.current.tx, ty0: cur.current.ty, w: r.width || 1, h: r.height || 1 };
  };
  const move = (e) => {
    if (!pts.current.has(e.pointerId) || !gest.current) return;
    pts.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const g = gest.current;
    if (g.mode === "pinch" && pts.current.size >= 2) {
      const [p, q] = [...pts.current.values()];
      apply({ ...cur.current, z: g.z0 * (Math.hypot(p.x - q.x, p.y - q.y) / g.d0) });
    } else if (g.mode === "pan") {
      const dx = e.clientX - g.x0, dy = e.clientY - g.y0;
      if (!moved.current && Math.hypot(dx, dy) < 8) return;
      moved.current = true;
      apply({ ...cur.current, tx: g.tx0 + dx / g.w, ty: g.ty0 + dy / g.h });
    }
  };
  const up = (e) => {
    const wasMoved = moved.current;
    pts.current.delete(e.pointerId);
    if (pts.current.size === 0) {
      gest.current = null;
      if (!wasMoved && e.type === "pointerup") onTap?.();
    } else if (pts.current.size === 1) {
      const [p] = [...pts.current.values()], r = rect();
      gest.current = { mode: "pan", x0: p.x, y0: p.y, tx0: cur.current.tx, ty0: cur.current.ty, w: r.width || 1, h: r.height || 1 };
    }
  };
  const wheel = (e) => apply({ ...cur.current, z: cur.current.z * Math.exp(-e.deltaY * 0.0015) });

  return (
    <div ref={ref} role="button" aria-label={label} data-testid="slot-gesture"
      onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up} onWheel={wheel}
      style={{ ...style, touchAction: "none", cursor: "grab" }} />
  );
}
