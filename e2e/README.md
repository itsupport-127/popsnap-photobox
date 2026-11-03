# Uji asap (smoke test)

Menjalankan satu sesi booth penuh dengan kamera palsu Chromium sampai layar hasil. Jalankan setelah mengubah layar booth.

    cd e2e
    npm i playwright
    node smoke.cjs                  # potret (bawaan)
    SHAPE=landscape node smoke.cjs  # atau square

Butuh backend (port 4000) dan frontend jalan, minimal satu template aktif, mode kamera webcam.
Env: `POPSNAP_URL`, `POPSNAP_API`, `ADMIN_USER`, `ADMIN_PASS`, `SHAPE`. Gagal = exit code 1 dan tangkapan layar `smoke-gagal.png`.
