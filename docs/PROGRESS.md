# POPSNAP Photobox: Log Pengerjaan dan Panduan Migrasi

Log ini merangkum seluruh pengerjaan per tanggal (dari riwayat git, 24 Okt - 25 Nov 2026) supaya progres mudah dilihat dan dilanjutkan oleh siapa pun. Dokumen kebutuhan produk ada di `docs/PRD.md`.

**Cara memakai log ini**
- Tambahkan entri baru di **paling atas** bagian "Log per tanggal" setiap selesai satu pekerjaan (format ada di bagian akhir).
- Nama commit asli di GitHub sering singkat ("update fitur"). Ringkasan di bawah dibuat dari isi perubahan; untuk tanggal 24 Okt - 8 Nov ringkasannya berdasarkan README dan nama berkas yang berubah, jadi lebih umum.
- Tanda **[belum teruji alat asli]** artinya kodenya ada dan lulus tes otomatis, tetapi perangkat kerasnya (kamera, printer, layar sentuh) belum dicoba di lokasi.

---

## Status saat ini (per 25 Nov 2026)

| Area | Status |
|---|---|
| Alur tamu (welcome sampai hasil + QR) | Selesai |
| Template editor + impor/ekspor dslrBooth | Selesai |
| Pembayaran (QRIS Midtrans / DOKU, voucher, tanpa bayar) | Selesai; uji kunci produksi di lokasi |
| Kamera (webcam, DSLR, Canon/Nikon SDK) | Selesai; **[belum teruji alat asli]** |
| Cetak | Selesai; **[belum teruji alat asli]** |
| Galeri (unggah, antrean, unggah manual) | Selesai |
| Sinkron kasir + pencocokan transaksi / kode link | Selesai |
| Remote Booth | Selesai; **[belum teruji alat asli]** end-to-end |
| Logo dan nama aplikasi dapat diganti | Selesai (bawaan POPSNAP) |
| Log aplikasi + log aktivitas | Selesai |
| Audit keamanan sebelum produksi | **Belum selesai** (kasir sudah, galeri & photobox belum) |

### Yang masih tersisa
1. Audit keamanan galeri dan photobox, lalu perbaiki temuan kasir (mis. escape `order_no` di pop-up, daftar kunci `meta` yang boleh dari klien, `hash_equals` di webhook).
2. Uji alat asli: kamera potret / HDMI, printer, layar sentuh, dialog banyak folder di `.exe`, Remote Booth.
3. Jeda foto di mode "Foto pertama saja": menurut pemilik masih terlalu cepat (sekarang diatur lewat pengaturan Tampilan: lama tampil foto dan hitung mundur foto lain).
4. Studio "Jason's" muncul padahal token studio "EMMA": penyebab belum ketemu (perlu data dari halaman Studio galeri dan daftar token studio di kasir).
5. Rencana lama: antrean digital, galeri event gabungan, laporan analitik di dashboard pusat.

---

## Log per tanggal (terbaru di atas)

### 23-25 Nov 2026: merek aplikasi
- **Logo dan nama aplikasi dapat diganti** di Admin > Pengaturan > Tampilan. Kosong = logo dan nama POPSNAP bawaan. Dipakai di layar booth, login, header admin, dan layar pengingat.
- **Tata letak logo responsif**: logo selalu dimuat di kotak 3:1 (rasio logo bawaan) dengan `object-fit: contain`, jadi logo persegi / tinggi / lebar tidak menabrak teks di layar landscape, portrait, maupun persegi. Pratinjau di Admin memakai kotak yang sama. File: `BrandLogo.jsx`, `ReminderView.jsx`, `AdminApp.jsx`, `SettingsDisplay.jsx`.
- Tes `backend/test/brand-settings.js`; tes `session-key-restart.js` (kunci unggah sesi bertahan setelah restart).
- Dokumen `docs/PRD.md` dan `docs/PROGRESS.md` (log ini) ditambahkan.

### 22 Nov 2026: log aplikasi, filter, remote
- **Log aplikasi** (`appLog.js`): semua log disimpan per tanggal, 14 hari, rahasia disensor, bisa dibaca dari Remote Booth.
- Filter pilihan tamu (CSS / LUT) diterapkan juga ke foto mentah yang diarsipkan.
- Remote Booth: daftar pengaturan yang boleh dikendalikan diperluas (`remoteSpec.js`).
- Keyboard layar dan input kode di layar bayar disempurnakan.

### 21 Nov 2026: pengaturan alur sesi
- Halaman **Alur** (`FlowPage.jsx`): urutan langkah (disclaimer, template, bayar, izin, pengingat) bisa dinyalakan / dimatikan; `sessionMachine.js` mengikuti pengaturan itu.
- Penyesuaian layar editor dan pembayaran terkait alur.

### 20 Nov 2026: Remote Booth
- Agent `remoteAgent.js` menyambung booth KELUAR ke `popsnap-remote` (heartbeat, perintah, status layar), halaman Admin Remote, layar kunci remote, daftar aman `remoteSpec.js`. **[belum teruji alat asli]**
- Pengaturan filter dan stiker mendapat opsi baru terkait remote.

### 19 Nov 2026
- Pengaturan stiker: halaman stiker, layanan stiker, dan endpoint backend disesuaikan.

### 18 Nov 2026
- Program perantara kamera Canon dan Nikon dibangun ulang (`native/`), jembatan SDK diperbarui. **[belum teruji alat asli]**

### 17 Nov 2026
- Perbaikan backend kamera yang macet; log lebih jelas.
- Hasil cetak: salinan JPEG `print.jpg` di folder sesi (untuk driver printer), arsip dan galeri tetap `final.png`.
- Pembayaran DOKU: jawaban HTTP 200 dengan isi kosong (biasanya jaringan studio) dicoba ulang sekali, pesan error lebih jelas.
- Pembuatan QRIS yang terasa lama dipercepat.
- Pemeriksaan foto di layar sesi diperbaiki.

### 16 Nov 2026
- Ekspor / impor pengaturan antar PC booth mencakup pengaturan live view baru.

### 15 Nov 2026
- **Auto cahaya foto** (`photoLight.js`): mengukur kecerahan foto hasil jepret dan menggeser gamma ke target (terpisah dari live view).
- Durasi live dan sinkron log disempurnakan.

### 14 Nov 2026
- Keyboard layar dan input.
- **Frame mode**: bentuk bingkai live view (ikut kamera / ikut slot template / penuhi layar) dan panduan garis area dibuat konsisten dengan hasil akhir; thumbnail ikut mode.
- Tambahan di repo lain: nomor transaksi di galeri dan kode link di kasir untuk pencocokan.

### 13 Nov 2026
- Pratinjau live disempurnakan; log; filter LUT.
- Retake otomatis dan perbaikan "penyebab gagal palsu" pada unggahan.

### 12 Nov 2026
- Mode zoom dan pratinjau live; **pengiriman cepat** (antrean unggah galeri lebih cepat).
- Perbaikan unggahan hasil sesi yang gagal 413: batas dinaikkan, error JSON jelas, unggahan dipecah (final dulu, foto mentah menyusul). Jeda foto otomatis dan rotasi-mirror kamera diperbaiki, pratinjau Pengaturan memakai LiveView asli.
- Pinch-zoom (dua jari) di Editor untuk layar sentuh. **[belum teruji alat asli]**

### 11 Nov 2026
- Izin sosmed / mading per tamu; folder salinan per izin di arsip.
- Dialog pilih folder khusus (bukan "Open file") dan bisa banyak folder sekaligus saat impor template, di `.exe` lewat Electron. **[belum teruji alat asli]** Di web galeri: tampilan unggah manual dan dialog disesuaikan tema.
- Perbaikan tab GIF / Foto di halaman pelanggan galeri.

### 10 Nov 2026
- Manajemen folder dan penamaan; **Mode tanpa pembayaran**; tombol kembali dari editor template; perbaikan responsif; pemeriksaan bug dan keamanan.

### 9 Nov 2026
- Fitur voucher dan unggah; tes dan pemeriksaan bug.

### 4-8 Nov 2026
- Ekspor / impor template format dslrBooth, filter live view, zoom, cetak, pratinjau cetak dan pratinjau kamera (beberapa kali disempurnakan).

### 24 Okt - 3 Nov 2026
- Dasar aplikasi, live view, mode tanpa QR, sinkron ke kasir / galeri, berbagi ke sosmed, penataan menu Pengaturan; `.gitignore` diaktifkan, `node_modules` dan berkas keluaran dikeluarkan dari Git; pembaruan keamanan.

### Sebelum git (dari README lama)
- Alur 7 tahap dan state machine, backend Express + SQLite, template editor lalu N-layer, Midtrans QRIS, Electron `.exe`, jembatan DSLR, login multi-peran, arsip permanen, dashboard pusat, voucher, pengaturan bertab, mode GIF / Boomerang / Video, log aktivitas.

---

## Panduan migrasi: memindahkan / menyiapkan PC booth baru

### A. Apa yang perlu dipindahkan
| Data | Lokasi (aplikasi `.exe`) | Perlu? |
|---|---|---|
| Database (akun, voucher, transaksi, pengaturan) | `<POPSNAP_DATA>\db\popsnap.db` (folder AppData pengguna) | Ya, kalau mau akun dan riwayat ikut |
| Berkas `.env` (kunci pembayaran, URL sinkron) | `<POPSNAP_DATA>\.env` | Ya, **rahasia: jangan diunggah ke GitHub** |
| Hasil foto permanen | `<POPSNAP_DATA>\output` (atau `OUTPUT_DIR`) | Ya, kalau ingin arsip ikut |
| Pustaka pengaturan + template | `Pictures\POPSNAP\Settings` dan `Templates` | Ya, cara tercepat |
| Log aplikasi | `<POPSNAP_DATA>\logs` | Tidak wajib |
| Unggahan sementara | `<POPSNAP_DATA>\uploads` | Tidak (otomatis dibersihkan) |

### B. Langkah pindah ke PC baru
1. **Di PC lama**: tutup POPSNAP; salin folder `Pictures\POPSNAP`, folder data (minimal `db\`, `.env`, `output\`) ke flashdisk.
2. **Di PC baru**: pasang `POPSNAP Setup x.x.x.exe` (hasil `build-exe.bat`, tersimpan di `electron\dist\`). Jalankan sekali lalu tutup.
3. Salin kembali `Pictures\POPSNAP` ke PC baru. Kalau belum ada akun di database baru, **pengaturan dan template dipulihkan otomatis** dari folder itu saat aplikasi pertama kali dibuka. (Kunci pembayaran dan PIN sengaja tidak ada di pustaka.)
4. Bila ingin akun dan riwayat ikut: tutup aplikasi, salin `db\popsnap.db` dan `.env` ke folder data baru, lalu buka lagi.
5. Isi ulang hal yang khusus PC: kamera (webcam / digiCamControl / SDK), printer, folder ekspor, PIN, kunci pembayaran bila tidak menyalin `.env`.
6. Sambungkan sinkron: token studio dan URL galeri di **Admin > Pembayaran** (bagian sinkron kasir dan galeri); cek status sinkron kasir dan galeri.
7. Jalankan **Admin > Cek Siap Buka** dan satu sesi tes (bayar voucher, foto, QR, cetak).

### C. Alternatif tanpa menyalin database
- **Admin > Pengaturan > Ekspor** menyimpan pengaturan ke file JSON; **Impor** di PC baru memuatnya (tanpa rahasia, perangkat kamera, printer, dan folder lokal).
- **Template Editor > Export / Import** memindahkan template satu per satu (ZIP dslrBooth atau `.popsnap.json`).
- Tombol **Pulihkan dari folder** di Pengaturan memuat ulang dari `Pictures\POPSNAP` kapan saja.

### D. Menjalankan dari kode (pengembangan)
```
cd backend  && npm install && node server.js        # port 4000
cd frontend && npm install && npm run dev            # web
cd electron && npm install && npm start              # desktop (butuh frontend sudah di-build untuk produksi)
cd backend  && for t in test/*.js; do node $t; done  # tes backend
```
Variabel penting: lihat `docs/PRD.md` bagian 7. Ganti port dengan `PORT`, folder data dengan `POPSNAP_DATA`.

### E. Setelah pindah: periksa
- Nomor transaksi berikutnya melanjutkan urutan (atau sengaja mulai dari awal di PC baru dengan kode studio berbeda).
- Token studio PC baru terdaftar di kasir; nama studio di galeri benar.
- Waktu dan zona waktu PC benar (memengaruhi nomor transaksi dan laporan harian).
- Antivirus tidak memblokir program perantara kamera (`backend/sdk/*`) dan `.exe` backend.

---

## Format entri log (salin ke atas bagian "Log per tanggal")

```
### <tanggal>: <judul singkat>
- Apa yang berubah (bahasa pemilik, bukan nama berkas), lalu berkas utamanya.
- Tes yang dijalankan dan hasilnya.
- Yang belum teruji / risiko, tandai [belum teruji alat asli] bila perlu.
```
