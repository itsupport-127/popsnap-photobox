// Baca isi beberapa folder template dslrBooth dari disk (dipakai dialog "Pilih folder" bawaan Windows di Electron).
// Hanya template.xml dan gambar (png/jpg) yang dibaca; sisanya dilewati. Hasil: [{ path: "NamaFolder/sub/file.png", data: Buffer }]
// path memakai nama folder yang dipilih sebagai awalan, supaya cocok dengan parseDslrFolder() di frontend.
const fs = require("fs");
const path = require("path");

const WANT = /\.(xml|png|jpe?g)$/i;
const MAX_DEPTH = 6;
const MAX_FILES = 6000;
const MAX_BYTES = 600 * 1024 * 1024;

function readFolders(dirs) {
  const out = [];
  let bytes = 0;
  const used = new Set(); // nama folder kembar (dua folder berbeda bernama sama) diberi akhiran
  for (const dir of dirs || []) {
    let st; try { st = fs.statSync(dir); } catch { continue; }
    if (!st.isDirectory()) continue;
    let base = path.basename(dir) || "folder", name = base, n = 2;
    while (used.has(name.toLowerCase())) name = `${base} (${n++})`;
    used.add(name.toLowerCase());
    const walk = (abs, rel, depth) => {
      let entries; try { entries = fs.readdirSync(abs, { withFileTypes: true }); } catch { return; }
      for (const e of entries) {
        const a = path.join(abs, e.name), r = rel + "/" + e.name;
        if (e.isSymbolicLink()) continue;
        if (e.isDirectory()) { if (depth < MAX_DEPTH) walk(a, r, depth + 1); continue; }
        if (!e.isFile() || !WANT.test(e.name)) continue;
        if (out.length >= MAX_FILES) throw new Error(`Terlalu banyak file (> ${MAX_FILES}). Pilih folder yang lebih kecil.`);
        const size = fs.statSync(a).size;
        bytes += size;
        if (bytes > MAX_BYTES) throw new Error("Total ukuran terlalu besar (> 600 MB). Pilih lebih sedikit folder sekaligus.");
        out.push({ path: r, data: fs.readFileSync(a) });
      }
    };
    walk(dir, name, 0);
  }
  return out;
}

module.exports = { readFolders };
