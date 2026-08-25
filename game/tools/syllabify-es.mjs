/**
 * i18n — SILABIFICADOR ESPAÑOL: herramienta de AUTORADO (no de build ni runtime).
 *
 * Coloca guiones discrecionales U+00AD en el texto ESPAÑOL de la fuente PROPORCIONAL
 * de la intro (narraciones de la gitana, The Summoning), para que el word-wrap
 * justificado del original (proport.ts `drawWrappedAround`) pueda hifenar en columnas
 * estrechas — como el binario hizo con su propio '_' en el inglés. Su salida se
 * CONGELA dentro de `src/i18n/es.json` (los U+00AD quedan en los valores); esto es la
 * PROCEDENCIA reproducible de esos guiones + reuso al autorar más texto proporcional.
 *
 * Reglas estándar RAE simplificadas: diptongos/hiatos, dígrafos (ch/ll/rr), grupos
 * consonánticos inseparables (pr,br,tr,dr,cr,gr,fr,pl,bl,cl,gl,fl,tl). Cualquier corte
 * dudoso se revisa a ojo en el render (láminas de creación).
 * Run (self-test):  node game/tools/syllabify-es.mjs
 */

const STRONG = "aeoáéóAEOÁÉÓ";
const WEAK = "iuüIUÜ";
const ACC_WEAK = "íúÍÚ";
const VOWELS = STRONG + WEAK + ACC_WEAK;
const isV = (c) => VOWELS.includes(c);
const isStrong = (c) => STRONG.includes(c);
const INSEP = new Set(["pr","br","tr","dr","cr","gr","fr","pl","bl","cl","gl","fl","tl"]);
const DIGRAPH = new Set(["ch","ll","rr"]);

// ¿forman c1c2 un grupo que va JUNTO al inicio de sílaba?
function keepTogether(a, b) {
  const pair = (a + b).toLowerCase();
  return INSEP.has(pair) || DIGRAPH.has(pair);
}

// ¿las vocales v1 v2 forman diptongo (misma sílaba)?  (fuerte+débil o débil+débil,
// SIN tilde en la débil). Dos fuertes = hiato; débil tildada = hiato.
function sameSyllableVowels(v1, v2) {
  if (ACC_WEAK.includes(v1) || ACC_WEAK.includes(v2)) return false; // hiato por tilde
  if (isStrong(v1) && isStrong(v2)) return false; // hiato de dos fuertes
  return true; // fuerte+débil, débil+fuerte, débil+débil
}

/** Divide una palabra (solo letras) en sílabas. */
export function syllabify(word) {
  const ch = [...word];
  // núcleos vocálicos: agrupa vocales contiguas en el mismo (diptongo/triptongo) o parte.
  // Trabajamos por posiciones y marcamos cortes ANTES de un índice.
  const n = ch.length;
  const cuts = new Set(); // índices donde empieza sílaba nueva
  let i = 0;
  // localizar posiciones de vocales
  const vpos = [];
  for (let k = 0; k < n; k++) if (isV(ch[k])) vpos.push(k);
  if (vpos.length <= 1) return [word];
  // entre cada par de vocales-nucleo consecutivas (que NO estén en el mismo núcleo),
  // repartir las consonantes intermedias.
  // Primero, fusiona vocales contiguas en núcleos.
  const nuclei = []; // cada núcleo = [startIdx, endIdx] inclusivo de vocales contiguas de misma sílaba
  let s = vpos[0], prev = vpos[0];
  for (let j = 1; j < vpos.length; j++) {
    const p = vpos[j];
    if (p === prev + 1 && sameSyllableVowels(ch[prev], ch[p])) { prev = p; continue; }
    nuclei.push([s, prev]); s = p; prev = p;
  }
  nuclei.push([s, prev]);
  // entre núcleo m y m+1: consonantes en (end_m, start_{m+1})
  for (let m = 0; m < nuclei.length - 1; m++) {
    const cStart = nuclei[m][1] + 1;
    const cEnd = nuclei[m + 1][0]; // exclusivo
    const cons = [];
    for (let k = cStart; k < cEnd; k++) cons.push(k);
    let cut;
    if (cons.length === 0) cut = cEnd; // V-V (hiato): corte entre vocales
    else if (cons.length === 1) cut = cons[0]; // V-CV
    else {
      // 2+ consonantes: si las DOS ÚLTIMAS forman grupo inseparable/dígrafo → van juntas
      const last2a = ch[cons[cons.length - 2]], last2b = ch[cons[cons.length - 1]];
      if (keepTogether(last2a, last2b)) cut = cons[cons.length - 2];
      else cut = cons[cons.length - 1]; // la última consonante con la vocal siguiente
    }
    cuts.add(cut);
  }
  // construir sílabas por los cortes
  const out = [];
  let start = 0;
  const sorted = [...cuts].sort((a, b) => a - b);
  for (const c of sorted) { out.push(ch.slice(start, c).join("")); start = c; }
  out.push(ch.slice(start).join(""));
  return out.filter((x) => x.length);
}

const SOFT = "­";
/**
 * Inserta U+00AD entre sílabas de las palabras "largas". No parte si dejaría un trozo
 * de 1 letra a un lado (huérfanas tipográficas). Solo toca tokens de letras (respeta
 * puntuación, '{', comillas). `minLen` = longitud mínima de palabra para hifenar.
 */
export function softHyphenate(text, minLen = 7) {
  return text.replace(/[A-Za-zÁÉÍÓÚÜÑáéíóúüñ]+/g, (w) => {
    if (w.length < minLen) return w;
    const syl = syllabify(w);
    if (syl.length < 2) return w;
    // une sílabas con SHY, pero evita huérfanas de 1 letra al principio/fin
    let out = syl[0];
    for (let i = 1; i < syl.length; i++) {
      const leftLen = out.replace(new RegExp(SOFT, "g"), "").length;
      const isLast = i === syl.length - 1;
      const rightLen = syl.slice(i).join("").length;
      if (leftLen >= 2 && (!isLast || rightLen >= 2)) out += SOFT;
      out += syl[i];
    }
    return out;
  });
}

// self-test
if (process.argv[1] && import.meta.url.endsWith(process.argv[1].split("/").pop())) {
  const tests = ["misteriosa","carreta","gitana","incensarios","Espiritualidad","Britannia","Iluminación","anciana","comprensión","heroica","aguardado","crusada","paseáis","futuro","Sabiduría","adalid","gesta","Codex","Avatar","virtud","Oscuridad","poderoso"];
  for (const t of tests) console.log(t, "→", syllabify(t).join("·"), " SHY:", softHyphenate(t).replace(/­/g,"·"));
}
