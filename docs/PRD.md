# PRD: POPSNAP Photobox

Dokumen kebutuhan produk (Product Requirements Document) untuk aplikasi photobox POPSNAP.
Ditulis dari kode di repo ini dan riwayat pengerjaannya (lihat `docs/PROGRESS.md`). Kalau dokumen dan kode berbeda, **kode yang benar**: perbarui dokumen ini.

Status per fitur memakai tiga tanda:
- **Ada**: sudah ada di kode dan lulus tes otomatis / diperiksa lewat kode.
- **Ada, belum teruji di alat asli**: kode ada, tetapi bergantung pada perangkat keras (kamera, printer, layar sentuh) yang belum dicoba di lokasi.
- **Belum ada**: direncanakan.

---

## 1. Ringkasan

POPSNAP adalah aplikasi photobox untuk studio foto / event: tamu memilih template, membayar (atau memakai voucher / gratis), berfoto dengan hitung mundur otomatis, mengedit ringan, lalu menerima hasil lewat **QR + link galeri** dan **cetak**. Aplikasi berjalan **lokal di PC booth** (Windows, dibungkus Electron `.exe`) dan tetap bekerja walau internet mati (offline-first). Data ringkas dan hasil foto disinkronkan ke sistem lain bila internet ada.

Nama dan logo di dalam aplikasi bisa diganti dari Admin; bawaannya **POPSNAP**.

### Tujuan
1. Booth bisa dioperasikan tamu tanpa bantuan: alur jelas, tombol besar, cocok layar sentuh.
2. Pemilik studio tidak kehilangan uang atau foto: setiap sesi tercatat, hasil tersimpan permanen di PC dan di cloud.
3. Studio bisa menyesuaikan tampilan, harga, template, dan alur tanpa mengubah kode.
4. PC booth baru bisa disiapkan cepat (migrasi mudah): lihat `docs/PROGRESS.md`, bagian Panduan migrasi.

### Bukan tujuan
- Bukan aplikasi cloud murni: booth harus bisa jalan tanpa internet.
- Bukan pengganti sistem kasir; kasir adalah aplikasi terpisah (`popsnap-kasir`).

---

## 2. Pengguna dan peran

| Peran | Siapa | Bisa apa |
|---|---|---|
| **Tamu** | Pelanggan di depan booth | Menjalani alur sesi, memilih template, membayar, berfoto, mengedit, menerima QR |
| **Kasir** | Staf studio | Membuat / membatalkan voucher, mengganti mode bayar, melihat pembayaran |
| **Admin** | Operator booth | Template, pengaturan, filter, stiker, tools (sesuai hak akses) |
| **Super Admin** | Pemilik | Semua hak, kelola pengguna & hak akses per peran, log aktivitas |
| **Pemilik jarak jauh** | Pemilik di luar lokasi | Memantau dan mengendalikan booth lewat Remote Booth (dibatasi, lihat 5.9) |

Hak akses diperiksa ulang dari database di setiap permintaan, jadi perubahan hak atau penonaktifan akun langsung berlaku.

---

## 3. Ekosistem (repo terkait)

| Repo | Peran | Hubungan dengan photobox |
|---|---|---|
| **popsnap-photobox** (repo ini) | Aplikasi booth: Electron + Express + React + SQLite | Sumber transaksi dan foto |
| **popsnap-gallery** | Galeri pelanggan: Express + SQLite + S3/R2 | Menerima foto dari booth (token sesi 10 karakter), halaman `/s/<token>`, unggah manual dari website |
| **popsnap-kasir** | Aplikasi kasir: Laravel + Inertia/React | Menerima transaksi booth (`/api/photobox/transactions`), menampilkan status galeri, menarik sesi galeri yang belum punya transaksi |
| **popsnap-paygate** | Gerbang pembayaran | Pembayaran QRIS |
| **popsnap-remote** | Server Remote Booth | Booth tersambung KELUAR ke sini (tanpa port masuk) |
| `cloud-dashboard/` (di repo ini) | Dashboard pusat multi-toko versi awal | Menerima ringkasan angka per toko |

Pengikat antar sistem: token studio (kasir), `KASIR_API_KEY` di galeri = `POPSNAP_GALLERY_KEY` di kasir, dan nomor transaksi `PB-<studio>-<tanggal>-<urut>` sebagai acuan pencocokan transaksi dan link galeri.

---

## 4. Alur utama tamu

Urutan bawaan (bisa diatur di **Admin > Alur**; langkah yang tidak dipakai dilewati):

1. **Welcome**: tombol Start, status kamera (Start aktif hanya kalau kamera siap), logo.
2. **Disclaimer** (opsional): tamu menyetujui ketentuan.
3. **Pilih template** (kategori, favorit, atau satu template saja).
4. **Pembayaran**: QRIS, voucher, atau tanpa pembayaran, sesuai mode bayar.
5. **Layar pengingat** (opsional): teks, jumlah foto dan retake.
6. **Sesi foto**: hitung mundur otomatis, jepret, tampil sebentar, retake terbatas.
7. **Izin foto** (opsional): bolehkah dipakai di sosmed / mading.
8. **Editor**: filter, stiker, posisi dan zoom foto di slot.
9. **Hasil**: QR + link galeri, tab Foto / GIF, cetak.

Ada juga mode **GIF, Boomerang, dan Video** (harga sendiri, 0 = gratis).

Aturan: setiap layar punya batas waktu supaya booth tidak menggantung; gembok di pojok layar membuka PIN untuk keluar ke menu admin.

---

## 5. Kebutuhan fungsional

### 5.1 Template dan editor
- Editor template N-layer: gambar, slot foto, teks, bentuk; urutan layer, align, undo/redo, kertas (2x6, 4x6, 5x7, 6x8, 8x10, A4, custom).
- Impor / ekspor format dslrBooth dan `.popsnap.json`; impor beberapa folder sekaligus tanpa dobel.
- Favorit template menentukan apa yang terlihat tamu.
- Status: **Ada**. Impor elemen dslrBooth selain gambar memakai perkiraan nama atribut (belum ada contoh asli).

### 5.2 Pembayaran
- Mode: Voucher saja, Otomatis, Voucher + QRIS, QRIS saja, **Tanpa pembayaran** (mengikuti kasir).
- QRIS lewat Midtrans atau DOKU; status dicek langsung ke penyedia (tidak bergantung webhook).
- Voucher: kode tanpa karakter membingungkan, sekali pakai (atomik), masa berlaku, batas 10 percobaan salah per menit, bisa ditempel (paste) dan diketik dari keyboard.
- Diskon / promo dari kasir dicatat di transaksi.
- Kalau QRIS gagal, booth otomatis jatuh ke voucher.
- Status: **Ada**. Pembayaran sungguhan perlu diuji di lokasi dengan kunci produksi.

### 5.3 Kamera
- Sumber: webcam, DSLR lewat digiCamControl atau gPhoto2, dan SDK pabrikan lewat program perantara **Canon** dan **Nikon** (`native/`).
- Live view dengan orientasi, rotasi, mirror, filter, profil warna, auto cahaya.
- Bentuk bingkai (ikut kamera / ikut slot template / penuhi layar) dan bentuk thumbnail; ada panduan pemilihan di Admin > Kamera.
- Status: **Ada, belum teruji di alat asli** untuk kamera potret/miring, HDMI, dan perangkat tertentu.

### 5.4 Sesi foto dan hasil
- Hitung mundur, jepret otomatis, jeda tampil, retake terbatas, foto mentah disimpan.
- Hasil akhir digabung ke template (`composeImage`), arsip **permanen** di folder output per tanggal dan sesi (final, foto mentah, salinan cetak `print.jpg`).
- Status: **Ada**.

### 5.5 Cetak
- Cetak dari kiosk lewat Electron, pratinjau cetak, salinan JPEG untuk driver printer.
- Status: **Ada, belum teruji di alat asli** (printer fisik).

### 5.6 Galeri dan QR
- Setiap sesi mendapat token 10 karakter (`XXXX XXXX XX`); booth mengunggah ke galeri dengan antrean (3 unggahan paralel, hasil akhir lebih dulu).
- Unggahan hasil sesi dipecah (final dulu, foto mentah menyusul) supaya tidak gagal 413 di PC dengan hasil besar.
- Kalau gagal / offline: file tetap ada di folder hasil, antrean dicoba lagi otomatis; **unggah manual** dari website galeri sebagai cadangan.
- Izin foto tamu (sosmed / mading) disimpan dan tampil di galeri; folder salinan per izin dibuat di arsip.
- Status: **Ada**.

### 5.7 Sinkron kasir
- Transaksi dikirim ke kasir dengan nomor `PB-<studio>-<tanggal>-<urut>`, termasuk nilai gross, diskon, promo, metode bayar, dan link galeri.
- Kasir menampilkan status galeri (belum terunggah / sudah masuk) dan kode link.
- Sesi galeri tanpa transaksi (mis. unggah manual) otomatis dibuatkan baris sementara `GAL-<token>` di kasir, lalu diganti saat transaksi asli tiba.
- Status: **Ada**.

### 5.8 Pengaturan, pengguna, dan keamanan
- Pengaturan bertab (Booth & Event, Tampilan, Pengingat & Izin, Sesi Foto, Kamera, Hasil Akhir, GIF/Live/Video, Cetak) dengan penanda belum disimpan; ekspor / impor pengaturan antar PC (tanpa rahasia).
- Tampilan: warna, latar, tombol kunci (gembok + PIN), keyboard layar, **logo dan nama aplikasi** (bawaan POPSNAP; logo dimuat di kotak 3:1 agar rapi untuk bentuk apa pun).
- Pengguna, peran, hak akses, ganti password sendiri, batas gagal login, **log aktivitas** (dapat diunduh CSV).
- Pengamanan: validasi nama file dan id sesi, path tidak boleh keluar folder, pengaturan rahasia tidak diekspor, PIN disimpan ter-hash.
- Status: **Ada**. Audit keamanan menyeluruh untuk repo ini belum selesai (lihat 8).

### 5.9 Remote Booth
- Agent booth tersambung keluar ke `popsnap-remote`: heartbeat, status layar, ringkasan hari ini, perintah (kunci / buka booth, batalkan sesi, muat ulang, ubah pengaturan aman).
- Daftar pengaturan yang boleh diubah ada di `backend/remoteSpec.js`; **kunci pembayaran, PIN, token, dan sinkron kasir / galeri tidak pernah bisa diubah dari jauh.**
- Offline-first: kalau remote mati, booth jalan normal.
- Status: **Ada, belum teruji di alat asli** end-to-end dengan server remote produksi.

### 5.10 Log dan diagnosis
- Log aplikasi per tanggal (`<data>/logs/app-YYYY-MM-DD.log`), disimpan 14 hari, maksimal 30 MB per file, rahasia disensor; bisa dibaca dari Remote Booth.
- Log aktivitas pengguna di database (login, perubahan, voucher, template).
- Status: **Ada**.

---

## 6. Kebutuhan non-fungsional

| Aspek | Kebutuhan |
|---|---|
| Offline-first | Sesi, cetak, dan arsip lokal jalan tanpa internet; sinkron menyusul |
| Ketahanan | Hasil tamu tidak boleh hilang: arsip lokal permanen, antrean unggah dengan percobaan ulang, kunci unggah sesi bertahan setelah restart |
| Tampilan | Responsif di berbagai ukuran dan rasio layar (landscape, portrait, persegi); unggahan besar dipecah |
| Keamanan | Hak akses per peran, rahasia tidak dikirim / diekspor, batas percobaan login dan voucher |
| Kemudahan migrasi | Pustaka `Pictures\POPSNAP` memulihkan pengaturan dan template otomatis di PC baru |
| Bahasa | Antarmuka berbahasa Indonesia |

---

## 7. Arsitektur dan data

```
Tamu / Admin --> Frontend React (Vite) <--> Backend Express (port 4000) --> SQLite (db/popsnap.db)
                                              |-- uploads/ (sementara), output/ (arsip permanen), library/ (cadangan)
                                              |-- kamera: webcam | digiCamControl | gPhoto2 | Canon/Nikon bridge
                                              |-- gallerySync --> popsnap-gallery
                                              |-- cloudSync   --> popsnap-kasir
                                              |-- remoteAgent --> popsnap-remote
Electron membungkus semuanya jadi POPSNAP.exe (menjalankan backend sendiri)
```

Tabel utama SQLite: `templates`, `vouchers`, `sessions`, `payments`, `users`, `store_settings`, `tx_log`, `sticker_categories`, `stickers`, `categories`, `session_files`, `activity_log`, `print_jobs`, `app_settings`. Migrasi skema dilakukan otomatis (`ALTER TABLE` dalam try/catch).

Variabel lingkungan penting (`.env` di folder data): `PORT`, `POPSNAP_DATA`, `POPSNAP_LIBRARY`, `OUTPUT_DIR`, `PUBLIC_HOST`, `POPSNAP_ALLOW_LAN`, `MIDTRANS_SERVER_KEY`, `MIDTRANS_CLIENT_KEY`, `MIDTRANS_IS_PRODUCTION`, `DOKU_BASE_URL`, `CLOUD_SYNC_URL`, `CLOUD_SYNC_API_KEY`.

---

## 8. Risiko, batasan, dan yang belum ada

| Hal | Keterangan |
|---|---|
| Uji alat asli | Kamera DSLR / HDMI / potret, printer, layar sentuh (pinch-zoom di Editor), dialog pilih banyak folder di `.exe`, dan Remote Booth penuh belum terbukti di lokasi |
| Audit keamanan | Repo kasir sudah diaudit (temuan belum seluruhnya ditindaklanjuti); repo galeri dan photobox perlu diaudit ulang sebelum produksi |
| Konkurensi | Shift yang tumpang tindih dan kode diskon sekali pakai yang dipakai bersamaan bisa memberi lebih satu kali |
| "Tanpa pembayaran" | Bergantung pada kasir |
| Belum ada | Antrean digital, galeri event gabungan, laporan analitik lanjutan di dashboard pusat, layer Session Data / QR di dalam template, tab Effects / Survey / Language, kontrol dari HP tamu |

---

## 9. Kriteria penerimaan sebelum produksi

1. Satu sesi penuh berhasil di PC booth: pilih template, bayar (QRIS sandbox dan voucher), foto, editor, hasil, QR terbuka di HP.
2. Matikan internet di tengah sesi: hasil tetap ada di folder output; setelah internet kembali, galeri dan kasir terisi otomatis tanpa dobel.
3. Nomor transaksi di kasir cocok dengan kode link di galeri.
4. PC baru: pasang `.exe`, salin folder pustaka, pengaturan dan template terpulihkan.
5. Semua tes backend (`backend/test/*.js`) lulus dan build frontend berhasil.
