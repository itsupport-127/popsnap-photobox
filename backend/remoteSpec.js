// SALINAN persis dari popsnap-remote/src/spec.js — daftar pengaturan yang boleh diubah dari Remote Booth.
// Booth memeriksa ulang di sini (penentu terakhir): kunci pembayaran / PIN / token / sinkron kasir-galeri TIDAK PERNAH bisa diubah dari jarak jauh.
// Daftar pengaturan & alat yang BOLEH dikendalikan dari Remote Booth.
// Dipakai server remote (validasi + membentuk form di UI). SALINAN PERSIS ada di popsnap-photobox/backend/remoteSpec.js:
// booth memeriksa ulang dengan file yang sama dan tetap menjadi penentu terakhir (nilai di luar batas dirapikan booth).
//
// Pengelompokan MENGIKUTI tab Pengaturan di app photobox (Booth & Event, Tampilan, Pengingat & Izin, Sesi Foto, Kamera,
// Hasil Akhir, GIF/Live/Video, Cetak) + Alur Sesi + Pembayaran.
//
// SENGAJA tidak ada (tidak bisa diubah dari jarak jauh):
//  - rahasia: kunci Midtrans/DOKU, PIN, API key kasir, token
//  - konfigurasi sinkron ke web lain: sinkron kasir (payment.cloud), galeri, dan Remote itu sendiri
//  - lokasi di komputer booth: folder data/ekspor, alamat digiCamControl, nama printer, ID perangkat kamera/mikrofon
//  - gambar unggahan, daftar filter, dan teks pengingat per baris (perlu editor khusus di app photobox)
//  - mode simulasi QRIS (hanya untuk testing)

const B = (path, label, o = {}) => ({ path, label, type: "bool", ...o });
const I = (path, label, min, max, o = {}) => ({ path, label, type: "int", min, max, ...o });
const N = (path, label, min, max, o = {}) => ({ path, label, type: "num", min, max, step: 0.1, ...o });
const T = (path, label, max, o = {}) => ({ path, label, type: "text", max, ...o });
const TA = (path, label, max, o = {}) => ({ path, label, type: "textarea", max, ...o });
const C = (path, label, o = {}) => ({ path, label, type: "color", ...o });
const E = (path, label, options, o = {}) => ({ path, label, type: "enum", options, ...o });
const PF = (path, label, o = {}) => ({ path, label, type: "profile", ...o });   // {iso,av,tv,wb} = kode pilihan kamera ("" = tidak diatur)
const PD = (path, label, o = {}) => ({ path, label, type: "periods", ...o });   // daftar periode jadwal (maks 6)
const DEG = [[0, "0°"], [90, "90°"], [180, "180°"], [270, "270°"]];
const DEG_PLUS = [[0, "0° (ikut Rotation)"], [90, "+90°"], [180, "+180°"], [270, "+270°"]];

const SECTIONS = [
  // ------------------------------------------------------------------ Booth & Event
  { id: "booth", title: "Booth & Event", desc: "Nama event, mode booth, keyboard, tombol kunci, dan ekspor.", groups: [
    { id: "event", title: "Event", fields: [
      T("event.name", "Nama event (judul layar Start)", 60),
      T("event.subtitle", "Subjudul", 100),
    ] },
    { id: "modes", title: "Mode booth", hint: "Foto selalu aktif. Mode lain tampil di layar Start kalau dinyalakan; harga 0 = gratis.", fields: [
      B("general.modes.photo.createGif", "Mode Foto juga membuat GIF"),
      B("general.modes.gif.enabled", "Mode GIF aktif"),
      I("general.modes.gif.price", "Harga GIF", 0, 100000000, { unit: "Rp", when: "general.modes.gif.enabled" }),
      B("general.modes.boomerang.enabled", "Mode Boomerang aktif"),
      I("general.modes.boomerang.price", "Harga Boomerang", 0, 100000000, { unit: "Rp", when: "general.modes.boomerang.enabled" }),
      B("general.modes.video.enabled", "Mode Video aktif"),
      I("general.modes.video.price", "Harga Video", 0, 100000000, { unit: "Rp", when: "general.modes.video.enabled" }),
      B("general.modes.showLabels", "Tampilkan teks di bawah ikon mode"),
    ] },
    { id: "keyboard", title: "Keyboard", fields: [
      E("general.virtualKeyboard", "Keyboard di layar tamu", [["off", "Keyboard fisik / bawaan perangkat"], ["builtin", "Keyboard layar POPSNAP"], ["windows", "Keyboard sentuh Windows"]]),
    ] },
    { id: "lock", title: "Tombol kunci (gembok)", hint: "Gembok di pojok layar untuk membuka menu admin lewat PIN.", fields: [
      E("display.lock.position", "Posisi", [["top-left", "Kiri atas"], ["top-right", "Kanan atas"], ["bottom-left", "Kiri bawah"], ["bottom-right", "Kanan bawah"]]),
      E("display.lock.style", "Tampilan gembok", [["always", "Selalu terlihat"], ["fade", "Muncul sebentar lalu menghilang"], ["hidden", "Tersembunyi (ketuk pojok)"]]),
      I("display.lock.opacity", "Transparansi (gaya selalu terlihat)", 5, 100, { unit: "%" }),
      I("display.lock.hideAfterSeconds", "Lama tampil (gaya menghilang / tersembunyi)", 2, 30, { unit: "detik" }),
      I("display.lock.zoneSize", "Luas area pojok yang peka ketuk", 60, 240, { unit: "px" }),
    ] },
    { id: "export", title: "Ekspor real-time", hint: "Salin hasil sesi ke folder lain (flashdisk / folder cloud). Foldernya diatur di app photobox.", fields: [
      B("general.export.enabled", "Aktifkan ekspor real-time"),
      B("general.export.prints", "Ikut salin hasil cetak (Prints)", { when: "general.export.enabled" }),
      E("general.export.printsFormat", "Format hasil cetak", [["jpeg", "JPEG"], ["png", "PNG"]], { when: "general.export.enabled" }),
      B("general.export.originals", "Ikut salin foto asli (Originals)", { when: "general.export.enabled" }),
      B("general.export.gifs", "Ikut salin GIF", { when: "general.export.enabled" }),
      B("general.export.videos", "Ikut salin video", { when: "general.export.enabled" }),
    ] },
  ] },

  // ------------------------------------------------------------------ Alur Sesi
  { id: "alur", title: "Alur Sesi", desc: "Urutan langkah setelah tamu menekan Start.", groups: [
    { id: "flow", title: "Urutan langkah", hint: "Langkah yang sedang dimatikan atau tidak relevan otomatis dilewati di booth. Foto → Edit → Hasil selalu di akhir.", fields: [
      { path: "general.flow.steps", label: "Urutan langkah", type: "steps", options: [
        ["disclaimer", "Ketentuan (Disclaimer)", "Tamu menyetujui ketentuan.", "general.disclaimer.enabled", "Nyalakan di Pengingat & Izin → Disclaimer"],
        ["template", "Pilih Template", "Pilih kelompok & template (dilewati kalau hanya ada satu template, atau mode GIF/Boomerang/Video)."],
        ["payment", "Pembayaran", "QRIS / voucher. “Bayar dulu” hanya berlaku kalau semua template yang tampil harganya sama."],
        ["consent", "Izin Foto (Sosmed)", "Tamu ditanya boleh dibagikan di sosmed / dipajang.", "general.consent.enabled", "Nyalakan di Pengingat & Izin → Izin foto"],
        ["reminder", "Layar Pengingat", "Pengingat singkat sebelum sesi foto dimulai.", "display.reminder.enabled", "Nyalakan di Pengingat & Izin → Layar pengingat"],
      ] },
    ] },
  ] },

  // ------------------------------------------------------------------ Tampilan & Layar Awal
  { id: "tampilan", title: "Tampilan & Layar Awal", desc: "Layar penuh, warna tema, dan layar Start.", groups: [
    { id: "fullscreen", title: "Layar penuh", fields: [
      B("display.startFullscreen", "Buka aplikasi dalam layar penuh"),
      B("display.autoFullscreen", "Masuk layar penuh otomatis saat Start ditekan"),
    ] },
    { id: "colors", title: "Warna tema", hint: "Dipakai di semua layar tamu.", fields: [
      C("display.colors.background", "Warna latar"),
      C("display.colors.primary", "Warna utama (tombol)"),
      C("display.colors.buttonText", "Warna teks tombol"),
      C("display.colors.secondary", "Warna sekunder"),
    ] },
    { id: "start", title: "Layar Start", fields: [
      E("display.startScreen.stretch", "Ukuran gambar latar", [["cover", "Penuhi layar (dipotong)"], ["contain", "Muat di layar (tanpa potong)"], ["fill", "Tarik penuh (bisa melar)"], ["center", "Ukuran asli, di tengah"]]),
      B("display.startScreen.triggerKeys", "Tombol Spasi, S, Page Up, Page Down, F13 = Start"),
    ] },
  ] },

  // ------------------------------------------------------------------ Pengingat & Izin
  { id: "pengingat", title: "Pengingat & Izin", desc: "Disclaimer, izin foto, dan layar pengingat.", groups: [
    { id: "disclaimer", title: "Disclaimer", hint: "Tamu harus setuju sebelum mulai. Kalau menolak, sesi dibatalkan.", fields: [
      B("general.disclaimer.enabled", "Wajibkan tamu menyetujui ketentuan"),
      T("general.disclaimer.header", "Judul", 120, { when: "general.disclaimer.enabled" }),
      TA("general.disclaimer.text", "Isi ketentuan", 3000, { when: "general.disclaimer.enabled" }),
    ] },
    { id: "consent", title: "Izin foto (sosmed & dipajang di toko)", hint: "Jawaban tamu menandai folder sesi BOLEH / TIDAK untuk content creator.", fields: [
      B("general.consent.enabled", "Tanya izin foto ke tamu"),
      T("general.consent.title", "Judul", 40, { when: "general.consent.enabled" }),
      TA("general.consent.text", "Pertanyaan", 200, { when: "general.consent.enabled" }),
      I("general.consent.seconds", "Batas waktu menjawab", 5, 120, { unit: "detik", when: "general.consent.enabled" }),
    ] },
    { id: "reminder", title: "Layar pengingat", hint: "Tampil setelah pembayaran, sebelum sesi foto. Isi tiap baris pengingat dan gambarnya diatur di app photobox.", fields: [
      B("display.reminder.enabled", "Tampilkan pengingat sebelum sesi dimulai"),
      I("display.reminder.seconds", "Lama tampil", 2, 60, { unit: "detik", when: "display.reminder.enabled" }),
      B("display.reminder.skippable", "Ketuk layar = langsung mulai", { when: "display.reminder.enabled" }),
      C("display.reminder.panelColor", "Warna panel", { when: "display.reminder.enabled" }),
      C("display.reminder.textColor", "Warna teks", { when: "display.reminder.enabled" }),
    ] },
  ] },

  // ------------------------------------------------------------------ Sesi Foto
  { id: "sesi", title: "Sesi Foto", desc: "Jumlah foto, hitung mundur, mode ketuk, dan batas waktu.", groups: [
    { id: "rules", title: "Aturan sesi", fields: [
      B("general.rawFilter", "Filter pilihan tamu ikut dipasang ke foto mentah", { hint: "Mati (disarankan): file mentah tetap polos sebagai cadangan foto asli." }),
      I("session.totalShots", "Jumlah foto per sesi", 1, 20),
      I("session.maxRetakes", "Batas retake per sesi", 0, 20),
    ] },
    { id: "capture", title: "Pengambilan foto", fields: [
      B("display.capture.manualTrigger", "Foto diambil setelah tamu mengetuk (bukan otomatis)"),
      E("display.capture.manualScope", "Yang perlu diketuk", [["all", "Tiap foto diketuk"], ["first", "Foto pertama saja, sisanya otomatis"]], { when: "display.capture.manualTrigger" }),
      E("display.capture.captureHint", "Animasi penanda tombol potret", [["pulse", "Membesar-mengecil"], ["bounce", "Melompat"], ["wiggle", "Bergoyang"], ["off", "Mati"]]),
      B("display.capture.autoSequence", "Ambil foto berurutan otomatis (saat mode ketuk mati)"),
      I("display.capture.countdownFirst", "Hitung mundur foto pertama", 0, 30, { unit: "detik" }),
      I("display.capture.countdownOthers", "Hitung mundur foto berikutnya", 0, 30, { unit: "detik" }),
      I("display.capture.displayPhotoSeconds", "Lama tampil tiap foto", 0, 20, { unit: "detik" }),
      I("display.capture.pauseSeconds", "Jeda sebelum foto berikutnya", 0, 30, { unit: "detik" }),
      C("display.capture.countdownColor", "Warna angka hitung mundur"),
      B("display.capture.cropLiveview", "Potong live view sesuai slot foto di template"),
      B("display.capture.hideCancel", "Sembunyikan tombol Batal saat pengambilan foto"),
      B("display.capture.showThumbnails", "Tampilkan thumbnail foto (tombol Retake ada di sini)"),
      E("display.capture.thumbnailLocation", "Posisi thumbnail", [["bottom", "Bawah"], ["top", "Atas"], ["left", "Kiri"], ["right", "Kanan"]], { when: "display.capture.showThumbnails" }),
    ] },
    { id: "timers", title: "Batas waktu layar", hint: "Setelah waktu habis, booth kembali ke layar awal.", fields: [
      I("session.timers.payment", "Layar bayar", 10, 600, { unit: "detik" }),
      I("session.timers.photoSession", "Sesi foto", 30, 3600, { unit: "detik" }),
      I("session.timers.photoSessionExtend", "Perpanjangan sesi foto", 10, 600, { unit: "detik" }),
      I("session.timers.editor", "Editor", 30, 1800, { unit: "detik" }),
      I("session.timers.downloadQr", "Layar hasil / QR (0 = tidak otomatis)", 0, 900, { unit: "detik" }),
    ] },
  ] },

  // ------------------------------------------------------------------ Kamera & Live View
  { id: "kamera", title: "Kamera & Live View", desc: "Sumber kamera, live view, dan profil warna.", groups: [
    { id: "camera", title: "Kamera", fields: [
      E("camera.mode", "Sumber kamera", [["webcam", "Webcam / kamera USB (browser)"], ["dslr", "DSLR / mirrorless (Canon, Nikon, dll)"]]),
      E("camera.liveSource", "Sumber tampilan live (mode DSLR)", [["camera", "Kamera (USB live view)"], ["webcam", "Webcam / capture card HDMI (rendah delay)"]], { when: "camera.mode", whenValue: "dslr" }),
      E("camera.orientation", "Orientasi kamera", [["auto", "Otomatis (ikut gambar kamera)"], ["landscape", "Landscape (melebar)"], ["portrait", "Portrait (tegak)"]]),
      B("camera.autoTrigger", "Jepret otomatis saat hitung mundur selesai"),
      I("camera.resolution", "Resolusi webcam (0 = frame rate tinggi 640×480 … 3 = kualitas tertinggi 4K)", 0, 3),
      E("camera.dslr.driver", "Penghubung DSLR", [["digicam", "digiCamControl"], ["canon", "Canon SDK (EDSDK)"], ["nikon", "Nikon SDK"], ["sony", "Sony SDK (Camera Remote)"]], { when: "camera.mode", whenValue: "dslr" }),
    ] },
    { id: "liveview", title: "Live view", fields: [
      B("camera.liveView.enabled", "Tampilkan video pratinjau saat hitung mundur"),
      B("camera.liveView.mirror", "Mirror (seperti cermin) sebagai pilihan awal", { when: "camera.liveView.enabled" }),
      E("camera.liveView.rotation", "Rotasi", DEG, { numeric: true }),
      E("camera.liveView.clipRotation", "Putar tambahan hasil Live / GIF", DEG_PLUS, { numeric: true }),
      B("camera.liveView.displayOnStart", "Tampilkan live view sebagai latar layar Start"),
      B("camera.liveView.guide", "Tampilkan garis panduan"),
      E("camera.liveView.frameMode", "Bentuk bingkai", [["camera", "Ikut kamera"], ["template", "Ikut slot template (yang terlihat = yang tercetak)"], ["screen", "Penuhi area layar"]]),
      E("camera.liveView.thumbMode", "Bentuk thumbnail foto", [["ratio", "Rasio slot (bawaan)"], ["shape", "Rasio + bentuk slot"], ["each", "Tiap kotak ikut slotnya sendiri"], ["frame", "Foto utuh + bingkai area potongan"], ["whole", "Foto utuh (tanpa potong)"]]),
    ] },
    { id: "liveview-color", title: "Kecerahan & warna live view", hint: "Hanya mengubah tampilan live view, bukan hasil foto.", fields: [
      B("camera.liveView.asIs", "Live view apa adanya (persis dari kamera)"),
      I("camera.liveView.brightness", "Kecerahan", 10, 1000, { unit: "%" }),
      B("camera.liveView.autoBright", "Samakan kecerahan dengan hasil jepret otomatis"),
      B("camera.liveView.canonAutoExposure", "Auto Exposure (Canon/Nikon): terangkan live view di kamera"),
      I("camera.liveView.canonBoost", "Penguat Canon", 0, 6),
      I("camera.liveView.contrast", "Kontras", 50, 160, { unit: "%" }),
      I("camera.liveView.saturation", "Saturasi", 0, 200, { unit: "%" }),
      I("camera.liveView.warmth", "Kehangatan warna (negatif = dingin, positif = hangat)", -30, 30),
    ] },
    { id: "photolight", title: "Auto cahaya foto", fields: [
      B("camera.photoLight.auto", "Otomatis terangkan / gelapkan foto hasil jepret ke target"),
      I("camera.photoLight.target", "Target terang (0–255)", 60, 200, { when: "camera.photoLight.auto" }),
      I("camera.photoLight.maxPct", "Maksimal koreksi", 0, 100, { unit: "%", when: "camera.photoLight.auto" }),
    ] },
    { id: "exposure", title: "Profil Live & Foto", hint: "ISO / shutter / aperture / white balance (Canon / Nikon langsung). Pilihan diambil dari kamera yang tersambung: klik “Baca opsi dari kamera” dulu. Berlaku saat live view berganti profil.", fields: [
      B("camera.exposure.split", "Pisahkan setelan Live View dan Foto", { hint: "Mati: satu setelan kamera untuk keduanya. Nyala: Live View lebih terang supaya tampak, Foto lebih gelap supaya tidak gosong." }),
      PF("camera.exposure.live", "Profil Live View", { when: "camera.exposure.split" }),
      PF("camera.exposure.photo", "Profil Foto", { when: "camera.exposure.split" }),
    ] },
    { id: "schedule", title: "Jadwal siang / malam", hint: "Ganti setelan kamera otomatis menurut jam (maks. 6 periode, jam tidak boleh bertumpuk). Pergantian terjadi di sela sesi, tidak saat jepret. Di luar periode dipakai profil dasar di atas.", fields: [
      B("camera.exposureSchedule.enabled", "Ganti setelan kamera otomatis menurut jam"),
      PD("camera.exposureSchedule.periods", "Daftar periode", { when: "camera.exposureSchedule.enabled" }),
    ] },
  ] },

  // ------------------------------------------------------------------ Hasil Akhir
  { id: "hasil", title: "Hasil Akhir", desc: "Tampilan hasil, layar tunggu, QR, dan ucapan.", groups: [
    { id: "result", title: "Tampilan hasil", fields: [
      B("result.live", "Buat tampilan Live (video momen)"),
      B("result.gif", "Buat tampilan GIF"),
      E("result.defaultView", "Tampilan awal", [["photo", "Foto"], ["live", "Live"], ["gif", "GIF"]]),
      E("result.gifStyle", "Gaya GIF", [["template", "Di dalam template"], ["plain", "Polos (foto saja)"], ["both", "Keduanya"]]),
      I("result.gifHoldMs", "Tahan hasil akhir", 0, 6000, { unit: "ms" }),
    ] },
    { id: "loading", title: "Layar tunggu hasil", fields: [
      B("result.loadingOn", "Tampilkan layar tunggu sebelum hasil"),
      I("result.loadingMinSec", "Tunggu minimal", 0, 15, { unit: "detik", when: "result.loadingOn" }),
      I("result.loadingMaxSec", "Tunggu maksimal", 5, 90, { unit: "detik", when: "result.loadingOn" }),
    ] },
    { id: "sharing", title: "Layar akhir & QR", fields: [
      E("display.sharing.mode", "Mode akhir sesi", [["qr", "QR + preview (tamu unduh)"], ["preview", "Preview saja (tanpa QR)"]]),
      E("display.sharing.offline", "Saat internet mati", [["auto", "Otomatis (tanpa QR saat offline)"], ["force", "Selalu tanpa QR (paksa offline)"], ["off", "Selalu tampilkan QR"]]),
      B("display.sharing.hideDone", "Sembunyikan tombol Done"),
      E("display.sharing.iconsLocation", "Posisi ikon berbagi", [["right", "Kanan"], ["left", "Kiri"], ["bottom", "Bawah"]]),
      B("display.sharing.showLabels", "Tampilkan teks di samping QR"),
    ] },
    { id: "thanks", title: "Ucapan terima kasih & pesan offline", fields: [
      B("display.sharing.thanksOn", "Tampilkan ucapan terima kasih"),
      E("display.sharing.thanksLang", "Bahasa ucapan", [["id", "Bahasa Indonesia saja"], ["both", "Indonesia + Inggris"]], { when: "display.sharing.thanksOn" }),
      T("display.sharing.thanksTitle", "Judul ucapan", 100, { when: "display.sharing.thanksOn" }),
      TA("display.sharing.thanksText", "Teks ucapan", 200, { when: "display.sharing.thanksOn" }),
      T("display.sharing.thanksTitleEn", "Judul ucapan (Inggris)", 100, { when: "display.sharing.thanksOn" }),
      TA("display.sharing.thanksTextEn", "Teks ucapan (Inggris)", 200, { when: "display.sharing.thanksOn" }),
      TA("display.sharing.offlineText", "Pesan saat offline", 200),
      TA("display.sharing.offlineTextEn", "Pesan saat offline (Inggris)", 200),
    ] },
  ] },

  // ------------------------------------------------------------------ GIF, Live & Video
  { id: "media", title: "GIF, Live & Video", desc: "Pengaturan GIF, Live (video momen), boomerang, dan video.", groups: [
    { id: "gif", title: "GIF stop-motion", fields: [
      I("gif.frames", "Jumlah foto (frame)", 2, 12),
      I("gif.frameDelayMs", "Jeda antar frame", 100, 3000, { unit: "ms" }),
      I("gif.width", "Lebar GIF", 240, 1200, { unit: "px" }),
    ] },
    { id: "live", title: "Live (video momen di template)", hint: "Tiap jepretan merekam klip pendek yang dipasang ke slot template. Berlaku untuk template yang “Template animasi”-nya menyala.", fields: [
      B("animated.enabled", "Template animasi aktif"),
      N("animated.secondsBefore", "Rekam sebelum jepret", 0, 10, { unit: "detik" }),
      N("animated.secondsAfter", "Rekam sesudah jepret", 0, 10, { unit: "detik" }),
      I("animated.fps", "Frame per detik", 5, 15),
      E("animated.loop", "Pola putar", [["pingpong", "Maju-mundur (mulus)"], ["loop", "Ulang dari awal"]]),
      I("animated.gifWidth", "Lebar GIF template", 240, 800, { unit: "px" }),
      B("animated.templateMp4", "Buat juga video MP4 template"),
      B("animated.rawClips", "Simpan klip mentah tiap foto"),
      E("animated.rawFormat", "Format klip mentah", [["mp4", "MP4 (GIF jika tidak didukung)"], ["gif", "GIF"]], { when: "animated.rawClips" }),
      I("animated.clipWidth", "Lebar klip mentah", 240, 1280, { unit: "px", when: "animated.rawClips" }),
      I("animated.liveBrightness", "Kecerahan Live", 50, 150, { unit: "%" }),
      I("animated.liveContrast", "Kontras Live", 50, 150, { unit: "%" }),
      I("animated.liveSharpness", "Ketajaman Live", 0, 100),
      B("animated.downloadPage", "QR membuka halaman unduh berisi semua file"),
    ] },
    { id: "boomerang", title: "Boomerang", fields: [
      I("boomerang.seconds", "Durasi rekam", 1, 6, { unit: "detik" }),
      I("boomerang.fps", "Frame per detik", 5, 15),
      I("boomerang.width", "Lebar", 240, 800, { unit: "px" }),
    ] },
    { id: "video", title: "Video", fields: [
      I("video.seconds", "Durasi maksimal", 3, 120, { unit: "detik" }),
      B("video.audio", "Ikut rekam suara dari mikrofon"),
    ] },
  ] },

  // ------------------------------------------------------------------ Cetak
  { id: "cetak", title: "Cetak", desc: "Perilaku cetak, kertas, batas, dan kalibrasi.", groups: [
    { id: "print-main", title: "Cetak", hint: "Nama printer dipilih di app photobox.", fields: [
      B("printing.enabled", "Aktifkan fitur cetak di booth"),
      B("printing.auto", "Cetak otomatis begitu hasil keluar", { when: "printing.enabled" }),
      I("printing.autoCopies", "Salinan cetak otomatis", 1, 3, { when: "printing.enabled" }),
      B("printing.showButton", "Tampilkan tombol Add Print di akhir sesi", { when: "printing.enabled" }),
      I("printing.price", "Harga Add Print per lembar (0 = gratis)", 0, 10000000, { unit: "Rp", when: "printing.enabled" }),
      I("printing.copies", "Pilihan maks. salinan di tombol Print", 1, 9, { when: "printing.enabled" }),
      B("printing.both", "Cetak bergantian ke printer utama & kedua", { when: "printing.enabled" }),
    ] },
    { id: "paper", title: "Kertas & kualitas", fields: [
      B("printing.autorotate", "Putar otomatis mengikuti orientasi template"),
      E("printing.paper", "Ukuran kertas dikirim ke printer", [["auto", "Ikuti printer"], ["template", "Ikuti ukuran template"], ["2x6", "2x6 inci (strip)"], ["4x6", "4x6 inci"], ["5x7", "5x7 inci"], ["6x8", "6x8 inci"], ["8x10", "8x10 inci"], ["a5", "A5"], ["a4", "A4"]]),
      E("printing.fit", "Penyesuaian gambar", [["fill", "Penuhi kertas (tepi bisa terpotong)"], ["fit", "Utuh (bisa ada bingkai putih)"]]),
      E("printing.sharpening", "Ketajaman cetak", [["none", "Tidak ada"], ["low", "Rendah"], ["medium", "Sedang"], ["high", "Tinggi"]]),
      B("printing.strip2x6", "Strip 2x6 dicetak dobel di kertas 4x6 (lalu dipotong)"),
    ] },
    { id: "limit", title: "Batas cetak", fields: [
      B("printing.limit.enabled", "Batasi jumlah cetak"),
      I("printing.limit.perEvent", "Maks. per event", 1, 1000000, { when: "printing.limit.enabled" }),
      I("printing.limit.perSession", "Maks. per sesi", 1, 99, { when: "printing.limit.enabled" }),
    ] },
    { id: "calib-main", title: "Kalibrasi printer utama", hint: "Geser / skala gambar cetak. Ubah sedikit-sedikit lalu cetak tes.", fields: [
      N("printing.main.scale", "Skala", 50, 150, { unit: "%" }),
      N("printing.main.scaleY", "Skala vertikal (0 = ikut skala)", 50, 150, { unit: "%", allowZero: true }),
      N("printing.main.x", "Geser horizontal", -100, 100),
      N("printing.main.y", "Geser vertikal", -100, 100),
    ] },
    { id: "calib-second", title: "Kalibrasi printer kedua", fields: [
      N("printing.second.scale", "Skala", 50, 150, { unit: "%" }),
      N("printing.second.scaleY", "Skala vertikal (0 = ikut skala)", 50, 150, { unit: "%", allowZero: true }),
      N("printing.second.x", "Geser horizontal", -100, 100),
      N("printing.second.y", "Geser vertikal", -100, 100),
    ] },
  ] },

  // ------------------------------------------------------------------ Pembayaran
  { id: "bayar", title: "Pembayaran", desc: "Cara bayar di booth. Kunci QRIS dan sinkron kasir hanya bisa diubah di app photobox.", groups: [
    { id: "pay", title: "Cara bayar", hint: "Berlaku untuk tamu berikutnya. Hati-hati mengubahnya saat ada antrean.", fields: [
      E("payment.mode", "Mode bayar", [["auto", "Otomatis (QRIS saat online, voucher saat offline)"], ["qris", "QRIS saja"], ["voucher", "Voucher saja"], ["both", "QRIS + voucher"], ["none", "Tanpa bayar di booth (bayar di kasir)"]], { danger: true }),
      I("payment.voucherExpiryHours", "Masa berlaku voucher (0 = tidak kedaluwarsa)", 0, 720, { unit: "jam" }),
    ] },
  ] },
];

const FIELDS = {};
for (const s of SECTIONS) for (const g of s.groups) for (const f of g.fields) FIELDS[f.path] = f;

// ---------- alat (perintah sekali jalan) ----------
const CAM_PROPS = ["tv", "av", "iso", "wb"];
const TOOL_TYPES = ["tools.storage", "tools.archive_cleanup", "tools.cleanup_orphans", "camera.status", "camera.exposure.get", "camera.exposure.set", "logs.read"];

/** Periksa & rapikan payload perintah alat. Kembali { ok, payload, error }. */
function validateTool(type, raw) {
  const p = raw && typeof raw === "object" && !Array.isArray(raw) ? raw : {};
  switch (type) {
    case "tools.storage": return { ok: true, payload: { fresh: p.fresh === true } };
    case "tools.cleanup_orphans":
    case "camera.status":
    case "camera.exposure.get": return { ok: true, payload: null };
    case "tools.archive_cleanup": {
      const d = Number(p.days);
      if (!Number.isInteger(d) || d < 7 || d > 3650) return { ok: false, error: "Isi batas hari antara 7 dan 3650." };
      return { ok: true, payload: { days: d } };
    }
    case "camera.exposure.set": {
      if (!CAM_PROPS.includes(p.prop)) return { ok: false, error: "Setelan kamera tidak dikenal." };
      if (!/^\d{1,10}$/.test(String(p.value))) return { ok: false, error: "Nilai setelan kamera tidak valid." };
      return { ok: true, payload: { prop: p.prop, value: String(p.value) } };
    }
    case "logs.read": {
      // Baca log aplikasi (hanya baca). date kosong = hari ini menurut jam booth.
      let date = null;
      if (p.date !== undefined && p.date !== null && p.date !== "") {
        const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(p.date));
        const dt = m && new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
        if (!m || dt.getUTCFullYear() !== +m[1] || dt.getUTCMonth() !== +m[2] - 1 || dt.getUTCDate() !== +m[3]) return { ok: false, error: "Tanggal log tidak valid (format YYYY-MM-DD)." };
        date = String(p.date);
      }
      const level = p.level === undefined || p.level === "" ? "all" : p.level;
      if (!["all", "warn", "error"].includes(level)) return { ok: false, error: "Tingkat log tidak dikenal." };
      const tail = p.tail === undefined || p.tail === "" ? 400 : Number(p.tail);
      if (!Number.isInteger(tail) || tail < 50 || tail > 2000) return { ok: false, error: "Jumlah baris log 50–2000." };
      const hm = (v) => (v === undefined || v === null || v === "" ? null : /^([01]\d|2[0-3]):[0-5]\d$/.test(String(v)) ? String(v) : false);
      const from = hm(p.from), to = hm(p.to);
      if (from === false || to === false) return { ok: false, error: "Jam log harus HH:MM." };
      const q = p.q === undefined || p.q === null ? "" : String(p.q).trim().slice(0, 60);
      return { ok: true, payload: { date, level, tail, from, to, q, activity: p.activity !== false } };
    }
    default: return { ok: false, error: "Perintah tidak dikenal." };
  }
}

/** Periksa & rapikan patch datar { "path": nilai }. Kembali { ok, clean, errors }. */
const PROFILE_KEYS = ["iso", "av", "tv", "wb"], CODE = /^\d{1,10}$/, HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;
function cleanProfile(v) {
  if (!v || typeof v !== "object" || Array.isArray(v)) return null;
  for (const k of Object.keys(v)) if (!PROFILE_KEYS.includes(k)) return null;
  const out = {};
  for (const k of PROFILE_KEYS) { const x = v[k]; if (x === undefined || x === null || x === "") out[k] = ""; else if (CODE.test(String(x))) out[k] = String(x); else return null; }
  return out;
}
const toMin = (t) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3));
function cleanPeriods(raw) {
  if (!Array.isArray(raw)) return { err: "harus daftar periode." };
  if (raw.length > 6) return { err: "maksimal 6 periode." };
  const out = [], ids = new Set(), cover = new Array(1440).fill(-1);
  for (let i = 0; i < raw.length; i++) {
    const q = raw[i]; if (!q || typeof q !== "object" || Array.isArray(q)) return { err: `periode ${i + 1} tidak valid.` };
    const label = String(q.label ?? "").trim();
    if (!label || label.length > 24) return { err: `periode ${i + 1}: nama 1–24 karakter.` };
    if (!HHMM.test(String(q.from)) || !HHMM.test(String(q.to))) return { err: `periode “${label}”: jam harus HH:MM.` };
    if (q.from === q.to) return { err: `periode “${label}”: jam mulai dan selesai tidak boleh sama.` };
    const live = cleanProfile(q.live ?? {}), photo = cleanProfile(q.photo ?? {});
    if (!live || !photo) return { err: `periode “${label}”: setelan kamera tidak valid.` };
    let id = typeof q.id === "string" && /^[\w-]{1,24}$/.test(q.id) ? q.id : `p${i + 1}`; if (ids.has(id)) id = `p${i + 1}-${i}`; ids.add(id);
    const a = toMin(q.from), z = toMin(q.to);
    for (let m = a; m !== z; m = (m + 1) % 1440) { if (cover[m] !== -1 && cover[m] !== i) return { err: `periode “${label}” bertumpuk dengan “${out[cover[m]].label}”.` }; cover[m] = i; }
    out.push({ id, label, from: q.from, to: q.to, live, photo });
  }
  return { ok: out };
}

function validatePatch(patch) {
  const clean = {}, errors = [];
  if (!patch || typeof patch !== "object" || Array.isArray(patch)) return { ok: false, clean, errors: ["Patch tidak valid."] };
  for (const [path, raw] of Object.entries(patch)) {
    const f = Object.prototype.hasOwnProperty.call(FIELDS, path) ? FIELDS[path] : null;
    if (!f) { errors.push(`Pengaturan "${path}" tidak boleh diubah dari remote.`); continue; }
    if (f.type === "bool") { if (typeof raw !== "boolean") errors.push(`${f.label}: harus ya/tidak.`); else clean[path] = raw; }
    else if (f.type === "int") {
      const n = typeof raw === "string" && raw.trim() === "" ? NaN : Number(raw);
      if (!Number.isFinite(n) || !Number.isInteger(n) || n < f.min || n > f.max) errors.push(`${f.label}: angka ${f.min}–${f.max}.`); else clean[path] = n;
    } else if (f.type === "num") {
      const n = typeof raw === "string" && raw.trim() === "" ? NaN : Number(raw);
      const ok = Number.isFinite(n) && ((n >= f.min && n <= f.max) || (f.allowZero && n === 0));
      if (!ok) errors.push(`${f.label}: angka ${f.allowZero ? "0 atau " : ""}${f.min}–${f.max}.`); else clean[path] = Math.round(n * 10) / 10;
    } else if (f.type === "text" || f.type === "textarea") {
      const s = String(raw ?? "").trim();
      if (s.length > f.max) errors.push(`${f.label}: maksimal ${f.max} karakter.`); else clean[path] = s;
    } else if (f.type === "color") {
      if (!/^#[0-9a-fA-F]{6}$/.test(String(raw))) errors.push(`${f.label}: format #RRGGBB.`); else clean[path] = String(raw).toUpperCase();
    } else if (f.type === "enum") {
      const hit = f.options.find(([v]) => (f.numeric ? Number(raw) === v && raw !== "" && raw !== null : v === raw));
      if (!hit) errors.push(`${f.label}: pilihan tidak dikenal.`); else clean[path] = hit[0];
    } else if (f.type === "profile") {
      const v = cleanProfile(raw); if (!v) errors.push(`${f.label}: nilai kamera tidak valid.`); else clean[path] = v;
    } else if (f.type === "periods") {
      const r = cleanPeriods(raw); if (r.err) errors.push(`${f.label}: ${r.err}`); else clean[path] = r.ok;
    } else if (f.type === "steps") {
      const ids = f.options.map((o) => o[0]);
      if (!Array.isArray(raw) || raw.length !== ids.length || new Set(raw).size !== ids.length || !raw.every((x) => ids.includes(x))) errors.push(`${f.label}: harus memuat semua langkah tepat satu kali.`);
      else clean[path] = raw.slice();
    }
  }
  return { ok: errors.length === 0 && Object.keys(clean).length > 0, clean, errors };
}

/** { "a.b.c": v } -> { a: { b: { c: v } } } */
function unflatten(flat) {
  const out = {};
  for (const [path, v] of Object.entries(flat)) {
    const keys = path.split(".");
    let o = out;
    keys.slice(0, -1).forEach((k) => { o = o[k] = o[k] || {}; });
    o[keys[keys.length - 1]] = v;
  }
  return out;
}

module.exports = { SECTIONS, FIELDS, TOOL_TYPES, validatePatch, validateTool, unflatten };
