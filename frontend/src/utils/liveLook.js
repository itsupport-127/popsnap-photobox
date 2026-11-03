// "Tampilan live view" untuk kanvas: kurva gamma kecerahan + profil warna (saturasi, kontras, hangat/dingin) yang SAMA persis
// dengan SVG filter di components/LiveView.jsx. Dipakai saat menggambar foto webcam, klip Live, dan frame GIF/boomerang supaya
// yang dilihat tamu di layar jepret = foto = hasil Live. Hasilnya string `ctx.filter` (di-cache), atau null kalau tidak perlu.
const cache = new Map();

export function lookFilter(gain = 1, lv = {}, extra = null) {
  const ct = (lv.contrast ?? 100) / 100, sat = (lv.saturation ?? 100) / 100, wm = (lv.warmth ?? 0) / 100;
  const useGamma = Math.abs(gain - 1) > 0.02;
  const useColor = Math.abs(ct - 1) > 0.01 || Math.abs(sat - 1) > 0.01 || Math.abs(wm) > 0.005;
  // extra = penyesuaian khusus Live { brightness %, contrast %, sharpness 0-100 }
  const eb = (extra?.brightness ?? 100) / 100, ec = (extra?.contrast ?? 100) / 100, es = Math.min(1, Math.max(0, (extra?.sharpness ?? 0) / 100));
  const useExtra = Math.abs(eb - 1) > 0.01 || Math.abs(ec - 1) > 0.01;
  if (!useGamma && !useColor && !useExtra && es === 0) return null;
  const exp = (1 / Math.max(0.1, gain)).toFixed(3);
  const cInt = ((1 - ct) / 2).toFixed(4), rS = (ct * (1 + wm)).toFixed(4), bS = (ct * (1 - wm)).toFixed(4), gS = ct.toFixed(4);
  const key = `${useGamma ? exp : "-"}|${useColor ? [sat, cInt, rS, gS, bS].join(",") : "-"}|${eb},${ec},${es}`;
  let f = cache.get(key);
  if (f) return f;
  const gamma = useGamma ? `<feComponentTransfer><feFuncR type="gamma" amplitude="1" exponent="${exp}" offset="0"/><feFuncG type="gamma" amplitude="1" exponent="${exp}" offset="0"/><feFuncB type="gamma" amplitude="1" exponent="${exp}" offset="0"/></feComponentTransfer>` : "";
  const color = useColor ? `<feColorMatrix type="saturate" values="${sat}"/><feComponentTransfer><feFuncR type="linear" slope="${rS}" intercept="${cInt}"/><feFuncG type="linear" slope="${gS}" intercept="${cInt}"/><feFuncB type="linear" slope="${bS}" intercept="${cInt}"/></feComponentTransfer>` : "";
  const eI = ((1 - ec) / 2).toFixed(4), eS = (ec * eb).toFixed(4), k = (es * 0.6).toFixed(3);
  const extraXml = useExtra ? `<feComponentTransfer><feFuncR type="linear" slope="${eS}" intercept="${eI}"/><feFuncG type="linear" slope="${eS}" intercept="${eI}"/><feFuncB type="linear" slope="${eS}" intercept="${eI}"/></feComponentTransfer>` : "";
  // Ketajaman: kernel 3x3 (pusat 1+4k, tetangga -k) -> menajamkan tepi tanpa menggeser kecerahan rata-rata
  const sharp = es > 0 ? `<feConvolveMatrix order="3" kernelMatrix="0 -${k} 0 -${k} ${(1 + 4 * k).toFixed(3)} -${k} 0 -${k} 0" divisor="1" preserveAlpha="true" edgeMode="duplicate"/>` : "";
  const svg = `<svg xmlns="http://www.w3.org/2000/svg"><filter id="f" color-interpolation-filters="sRGB">${gamma}${color}${extraXml}${sharp}</filter></svg>`;
  f = `url("data:image/svg+xml;utf8,${encodeURIComponent(svg)}#f")`;
  cache.set(key, f);
  return f;
}
