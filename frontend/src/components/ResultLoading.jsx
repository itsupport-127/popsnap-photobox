import React, { useEffect, useState } from "react";

// Layar tunggu sebelum hasil akhir. Sengaja ringan untuk PC booth: hanya opacity/transform (GPU), tanpa video, tanpa kanvas;
// satu timer kecil (2 dtk) yang hanya merender komponen ini, jadi pembuatan Live/GIF tidak terganggu.
const U = (n) => `calc(var(--u) * ${n})`;

const TXT = {
  id: { title: "Foto kamu sedang disiapkan", sub: "Sebentar ya, hasilnya hampir jadi", foto: "Menyusun foto", live: "Membuat Live", gif: "Membuat GIF" },
  en: { title: "Getting your photos ready", sub: "Just a moment, almost there", foto: "Putting photos together", live: "Making Live video", gif: "Making GIF" },
};

export default function ResultLoading({ photos, mirror, lang, steps, CW, CH, P }) {
  const [idx, setIdx] = useState(0);
  const n = photos.length;
  useEffect(() => {
    if (n < 2) return undefined;
    const id = setInterval(() => setIdx((i) => (i + 1) % n), 2000);
    return () => clearInterval(id);
  }, [n]);

  const t = TXT[lang === "en" ? "en" : "id"], tEn = TXT.en;
  const cw = P(420, 560, 500), ch = P(520, 700, 620);

  return (
    <div className="rl-overlay" role="status" aria-live="polite" style={{ position: "absolute", inset: 0, zIndex: 40, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: U(P(44, 60, 44)), paddingBottom: U(P(20, 80, 20)) }}>
      <div className="rl-card" style={{ position: "relative", flex: "none", width: U(cw), height: U(ch), padding: U(18), paddingBottom: U(60), borderRadius: U(22), boxSizing: "border-box" }}>
        <div style={{ position: "relative", width: "100%", height: "100%", overflow: "hidden", borderRadius: U(10), background: "#cfd6de" }}>
          {photos.map((src, i) => (
            <img key={i} src={src} alt="" decoding="async" draggable={false}
              style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", opacity: i === idx ? 1 : 0, transition: "opacity .7s ease", transform: mirror ? "scaleX(-1)" : undefined }} />
          ))}
        </div>
        <div style={{ position: "absolute", left: 0, right: 0, bottom: U(18), height: U(26), display: "flex", justifyContent: "center", alignItems: "center", gap: U(14) }}>
          <span className="rl-dot" style={{ width: U(16), height: U(16), animationDelay: "0s" }} />
          <span className="rl-dot" style={{ width: U(16), height: U(16), animationDelay: ".18s" }} />
          <span className="rl-dot" style={{ width: U(16), height: U(16), animationDelay: ".36s" }} />
        </div>
      </div>

      <div style={{ flex: "none", textAlign: "center", color: "#fff", textShadow: "0 2px 6px rgba(0,0,0,.45)", padding: `0 ${U(40)}` }}>
        <p style={{ margin: 0, fontSize: U(P(46, 54, 46)), fontWeight: 800, fontStyle: "italic" }}>{lang === "en" ? tEn.title : t.title}</p>
        <p style={{ margin: 0, marginTop: U(8), fontSize: U(P(26, 30, 26)), fontWeight: 600, opacity: .92 }}>{lang === "en" ? tEn.sub : t.sub}</p>
        {lang === "both" && <p style={{ margin: 0, marginTop: U(6), fontSize: U(P(22, 26, 22)), fontWeight: 500, fontStyle: "italic", opacity: .85 }}>{tEn.title}</p>}
      </div>

      <ul style={{ flex: "none", margin: 0, padding: 0, listStyle: "none", display: "flex", justifyContent: "center", flexWrap: "wrap", gap: `${U(14)} ${U(P(44, 30, 36))}` }}>
        {steps.map((s) => (
          <li key={s.id} className={s.done ? "rl-step rl-step--done" : "rl-step"} style={{ display: "flex", alignItems: "center", gap: U(10), fontSize: U(P(28, 28, 26)), fontWeight: 700, color: "#fff", textShadow: "0 1px 3px rgba(0,0,0,.4)" }}>
            <span className="rl-mark" style={{ width: U(36), height: U(36), fontSize: U(24) }}>{s.done ? "\u2713" : ""}</span>
            {lang === "en" ? tEn[s.id] : t[s.id]}
          </li>
        ))}
      </ul>
    </div>
  );
}
