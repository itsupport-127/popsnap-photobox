import React from "react";

/** Layar "booth tidak tersedia" saat dikunci dari Remote Booth. Di bawah gembok petugas (KioskLock, z-index 90) supaya PIN tetap bisa dipakai. */
export default function RemoteLockScreen({ message }) {
  return (
    <div role="alert" style={{ position: "fixed", inset: 0, zIndex: 80, display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 18, padding: 32, textAlign: "center", background: "#181B23", color: "#fff", cursor: "default" }}>
      <svg width="72" height="72" viewBox="0 0 24 24" fill="none" stroke="#E02843" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="4" y="11" width="16" height="10" rx="2" /><path d="M8 11V7a4 4 0 0 1 8 0v4" /></svg>
      <div style={{ fontSize: "clamp(28px,5vw,56px)", fontWeight: 800, lineHeight: 1.1 }}>Booth sedang tidak tersedia</div>
      <div style={{ fontSize: "clamp(16px,2.4vw,28px)", opacity: 0.85, maxWidth: 900 }}>{message || "Mohon tunggu sebentar, ya. Terima kasih!"}</div>
    </div>
  );
}
