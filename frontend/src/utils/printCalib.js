// ==========================================================
// Kalibrasi cetak dari lembar tes: driver printer sering memperbesar "halaman" (Borderless / Expansion) dan menggesernya sedikit,
// sehingga Skala 100% terpotong dan Skala yang dikecilkan masih menyisakan putih di satu sisi.
// Lembar kalibrasi dicetak TANPA skala / geser aplikasi, jadi pinggirannya (garis bernomor) menunjukkan persis apa yang dilakukan driver:
//   terpotong di sisi t/b/l/r (mm; positif = terpotong, negatif = ada ruang putih di luar bingkai).
// Dari situ dihitung Skala + Geser yang membuat gambar pas menutup kertas.
// ==========================================================

/**
 * @param {{w:number,h:number}} paper  ukuran kertas (mm) sesuai arah cetak (tegak: w < h)
 * @param {{t:number,b:number,l:number,r:number}} cut  mm terpotong per sisi (boleh negatif)
 * @param {"fill"|"fit"} fit
 * @returns {{scale:number,scaleY:number,x:number,y:number,mh:number,mv:number,warn?:string,note?:string}}
 */
export function calibrate(paper, cut, fit = "fill") {
  const { w: W, h: H } = paper; // fit tidak lagi memengaruhi hasil (gambar dipaskan ke jendela kertas)
  const t = Number(cut.t) || 0, b = Number(cut.b) || 0, l = Number(cut.l) || 0, r = Number(cut.r) || 0;
  const mh = 1 + (l + r) / W, mv = 1 + (t + b) / H; // perbesaran halaman oleh driver (>1 = diperbesar)
  if (!(mh > 0.7 && mh < 1.4 && mv > 0.7 && mv < 1.4)) return { scale: 100, scaleY: 0, x: 0, y: 0, mh, mv, warn: "Angka tidak masuk akal (perbesaran driver di luar 70–140%). Periksa lagi pembacaan tiap sisi." };
  // jendela kertas dalam koordinat halaman (mm): mulai di (l/mh, t/mv), lebar W/mh, tinggi H/mv.
  // Gambar diskalakan PERSIS ke jendela itu (lebar 1/mh, tinggi 1/mv): driver memperbesar halaman dengan faktor yang sama lagi,
  // jadi hasil tercetak pas kertas dan tidak melar (kalau driver memperbesar lebar & tinggi tidak sama, kemelaran driver ikut dibatalkan).
  const fx = 1 / mh, fy = 1 / mv;
  const cx = l / mh + W / (2 * mh), cy = t / mv + H / (2 * mv);
  const dx = cx - W / 2, dy = cy - H / 2; // pusat gambar harus pindah sejauh ini (mm halaman)
  const r1 = (v) => Math.round(v * 10) / 10;
  const cl = (v, a, c) => Math.max(a, Math.min(c, v));
  const same = Math.abs(fx - fy) < 0.005; // hampir sama: satu skala saja
  const sx = same ? (fx + fy) / 2 : fx, sy = same ? 0 : fy; // scaleY 0 = ikut Skala
  const out = { scale: r1(cl(sx * 100, 50, 150)), scaleY: sy ? r1(cl(sy * 100, 50, 150)) : 0, x: r1(cl((200 * dx) / W, -100, 100)), y: r1(cl((200 * dy) / H, -100, 100)), mh, mv };
  if (!same) out.note = `Driver memperbesar lebar ${Math.round((mh - 1) * 1000) / 10}% dan tinggi ${Math.round((mv - 1) * 1000) / 10}% (tidak sama). Skala lebar dan tinggi diatur terpisah supaya gambar tidak melar.`;
  return out;
}
