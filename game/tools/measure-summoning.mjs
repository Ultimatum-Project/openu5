/**
 * i18n / fidelidad — MEDIDOR DE CABIDA de las escenas de The Summoning.
 *
 * Réplica de `FaithfulProportFont.drawWrappedAround` (skin/fiel/proport.ts) + las 21
 * bandas de `skin/fiel/summoning-layout.ts`, con los ANCHOS del atlas proporcional
 * real. Dice, por escena, si el texto CABE en su banda o cuántas palabras se TRUNCAN.
 *
 * PARA QUÉ. La Summoning del port TRUNCABA el texto (16/21 escenas desbordaban) porque
 * `summoning-layout.ts` fijaba regiones DEMASIADO PEQUEÑAS. El original NO pagina ni
 * trunca por diseño: pinta el registro entero fluyendo por la PANTALLA alrededor del
 * arte (clip a penY≥0xc0). FIX = región pantalla-completa + arte como exclusión (ver
 * summoning-layout.ts). Este medidor es el GATE: con las regiones corregidas NINGUNA
 * escena debe desbordar (EN de intro-scenes.json + ES de es.json, key = texto inglés
 * verbatim). Úsalo tras tocar regiones o traducciones.
 *
 * Run:  node game/tools/measure-summoning.mjs
 */
import { readFileSync } from "node:fs";
import { huella } from "./i18n-huella.mjs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { PNG } from "pngjs";

const GAME = join(dirname(fileURLToPath(import.meta.url)), "..");
const A = (f) => join(GAME, "assets", f);

const png = PNG.sync.read(readFileSync(A("proport-font.png")));
const man = JSON.parse(readFileSync(A("proport-font.json"), "utf8"));
const by = new Map(man.glyphs.map((g) => [g.code, g]));
const SPACE_W = 4, INTER = 1, LH = man.height + 1, MIN_SEG = SPACE_W * 3, INDENT = 0xf;
const SOFT = "­", HYPHEN = 0x2d;

const advance = (cp) => (cp === 0x20 ? SPACE_W : (by.get(cp)?.width ? by.get(cp).width + INTER : 0));
const measure = (t) => [...t].reduce((s, ch) => s + advance(ch.codePointAt(0)), 0);
function hyphenate(word, availW) {
  const parts = word.split(SOFT);
  if (parts.length < 2) return null;
  const hyphenW = advance(HYPHEN);
  let acc = "", best = null;
  for (let k = 0; k < parts.length - 1; k++) {
    acc += parts[k];
    if (measure(acc) + hyphenW <= availW) best = { head: acc + "-", tail: parts.slice(k + 1).join(SOFT) };
    else break;
  }
  return best;
}

// Cartones (arte) de summoning-layout.ts: [cartonX0,y0,x1,y1]. Las escenas-título
// TYPE 1 (0/7/14) arrancan la región de texto bajo el cartón gótico (regionY0); las
// TYPE 4/5/6 (15-20) extienden el cartón a la 2ª celda del retrato (ver summoning-layout.ts).
const CARTON = [
  [0,0,176,192],[0,74,168,200],[136,0,320,131],[0,38,200,159],[152,76,320,200],[0,0,168,124],
  [72,38,240,162],[0,0,183,167],[0,90,320,200],[0,90,320,200],[0,90,320,200],[0,90,320,200],
  [0,90,320,200],[176,0,320,112],[0,0,176,113],[176,0,317,94],[0,46,141,140],[176,78,317,171],
  [0,0,141,94],[176,55,317,148],[0,87,141,181],
];
// Región de texto por escena: full-screen salvo escenas-título (y0 = pie del título).
const REGION_Y0 = { 0: 90, 7: 86, 14: 32 };

function lineSegments(r, e, y) {
  const hits = e && y < e.y1 && y + LH > e.y0;
  if (!hits) return [{ x0: r.x0, x1: r.x1 }];
  const segs = [];
  const lx = Math.min(r.x1, e.x0);
  if (lx - r.x0 >= MIN_SEG) segs.push({ x0: r.x0, x1: lx });
  const rx = Math.max(r.x0, e.x1);
  if (r.x1 - rx >= MIN_SEG) segs.push({ x0: rx, x1: r.x1 });
  return segs;
}

/** ¿cabe `text` en la banda (region + exclusión carton)? → {all, leftover}. */
export function fits(text, region, carton) {
  const words = [];
  for (const para of text.split("\n")) {
    for (const w of para.split(/\s+/)) if (w.length) words.push(w);
    words.push("\n");
  }
  let wi = 0, y = region.y0, indentNext = INDENT > 0;
  while (wi < words.length && y + LH <= region.y1 + 1) {
    if (words[wi] === "\n") { wi++; if (INDENT > 0) indentNext = true; else y += LH; continue; }
    const segs = lineSegments(region, carton, y);
    if (segs.length === 0) { y += LH; continue; }
    let placedAny = false;
    for (let si = 0; si < segs.length; si++) {
      const seg = segs[si];
      const x0 = si === 0 && indentNext ? seg.x0 + INDENT : seg.x0;
      const segW = seg.x1 - x0;
      const placed = [];
      let lineW = 0;
      while (wi < words.length && words[wi] !== "\n") {
        const w = measure(words[wi]);
        const add = placed.length === 0 ? w : SPACE_W + w;
        if (placed.length > 0 && lineW + add > segW) {
          const hy = hyphenate(words[wi], segW - lineW - SPACE_W);
          if (hy) { placed.push(hy.head); words[wi] = hy.tail; }
          break;
        }
        if (placed.length === 0 && w > segW) {
          const hy = hyphenate(words[wi], segW);
          if (hy) { placed.push(hy.head); words[wi] = hy.tail; } else { placed.push(words[wi]); wi++; }
          break;
        }
        placed.push(words[wi]); lineW += add; wi++;
      }
      if (placed.length > 0) placedAny = true;
    }
    if (!placedAny) break;
    indentNext = false; y += LH;
  }
  const all = wi >= words.length || words.slice(wi).every((w) => w === "\n");
  return { all, leftover: all ? 0 : words.slice(wi).filter((w) => w !== "\n").length };
}

// Región de texto = PANTALLA COMPLETA (summoning-layout.ts, corrección de fidelidad
// 2026-07-18); el `carton` (arte) posiciona vía la exclusión por línea.
const FULL_SCREEN = { x0: 2, y0: 2, x1: 318, y1: 198 };

/** Banda `{region, carton}` de la escena `i` (0..20). Región = pantalla completa (o bajo
 * el título en escenas TYPE 1) + arte (carton, con la 2ª celda ya incluida en TYPE 4/5/6). */
export function sceneBand(i) {
  const C = CARTON[i];
  const region = REGION_Y0[i] !== undefined ? { ...FULL_SCREEN, y0: REGION_Y0[i] } : FULL_SCREEN;
  return { region, carton: { x0: C[0], y0: C[1], x1: C[2], y1: C[3] } };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const scenes = JSON.parse(readFileSync(A("intro-scenes.json"), "utf8"));
  let es = {};
  try { es = JSON.parse(readFileSync(join(GAME, "src", "i18n", "es.json"), "utf8")).strings; } catch { /* sin es.json */ }
  let bad = 0;
  for (const s of scenes) {
    const { region, carton } = sceneBand(s.index);
    const en = fits(s.text, region, carton);
    const esVal = es[huella(s.text)]?.t;
    const esR = esVal ? fits(esVal, region, carton) : null;
    if (!en.all) bad++;
    const esTag = esR ? ` · ES ${esR.all ? "ok" : "desborda " + esR.leftover + "w"}` : "";
    console.log(`[${String(s.index).padStart(2)}] EN ${en.all ? "ok" : "desborda " + en.leftover + "w"}${esTag}`);
  }
  console.log(`\n${bad}/${scenes.length} escenas desbordan EN inglés (banda actual, pre-paginación).`);
}
