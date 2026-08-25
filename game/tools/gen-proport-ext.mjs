/**
 * i18n — EXTENSIÓN ESPAÑOLA de la fuente PROPORCIONAL (PROPORT.PCS).
 *
 * Hermano proporcional de `docs/skin-remaster/shader-evolucion/font_ext.py` (que
 * hace lo mismo para la 8×8 monoespaciada). El texto LÍRICO de la intro (The
 * Summoning, narración/dilemas de la gitana) se pinta con la fuente PROPORCIONAL
 * (`skin/fiel/proport.ts`), cuyo atlas `proport-font.png` que emite el extractor
 * SÓLO cubre ASCII 0x20..0x7A — sin acentos. El español necesita á é í ó ú ü ñ ¿ ¡.
 *
 * MODELO (idéntico al de la 8×8 y al scoping aprobado por el lead):
 *   - Los glifos de extensión son ARTE AUTORADO (no salen de PROPORT.PCS/EA), así
 *     que viven en ESTE generador TRACKED, no en el extractor. El PNG resultante
 *     sigue gitignored (material derivado); lo REGENERA quien construya assets.
 *   - Es un POST-PROCESADOR: corre DESPUÉS del extractor
 *     (`extractor … → proport-font.{png,json}`) y APENDIZA los glifos ES a la tira.
 *   - APPEND SIN REFLOW: la región base [0..baseEnd) del PNG se copia VERBATIM y las
 *     `x` de los glifos base NO se tocan (condición dura del lead) → en `lang=en`,
 *     donde el texto es ASCII y jamás indexa un code ≥0xA0, el render proporcional
 *     es BYTE-IDÉNTICO. Los glifos nuevos se dibujan a partir de `baseEnd`.
 *   - IDEMPOTENTE: filtra la entrada a los glifos BASE (code < 0x80) antes de
 *     apendizar, así re-ejecutarlo sobre un atlas ya extendido no duplica.
 *
 * DISEÑO DE LOS SIGNOS (estilo slab-serif del original, trazo 2px):
 *   - minúsculas: base en filas 2-6, con las 2 filas de techo (0-1) libres → acute/
 *     tilde/diéresis encima (calco de ACC_LC de font_ext.py).
 *   - ¡ = ! volteado vertical; ¿ = ? rotado 180° (igual que la 8×8).
 *   - MAYÚSCULAS acentuadas NO se autoran: la celda de 8px no deja techo sobre una
 *     mayúscula (llenan filas 0-6). Convención de época (tipografía áurea y del
 *     propio juego): acento OMITIDO sobre inicial mayúscula. Sólo pican palabras
 *     cuya PRIMERA letra va acentuada Y capitalizada (Él, Ánimo, Última…); se
 *     resuelven al autorar c/d/e. «Así», «Días»… NO pican (sólo la 1ª letra es
 *     mayúscula; la vocal acentuada va minúscula, y esa sí existe).
 *
 * Salida: game/assets/proport-font.{png,json} (gitignored, atlas EXTENDIDO).
 * Run:    node game/tools/gen-proport-ext.mjs   (tras el extractor)
 *
 * `EXT_GLYPHS`/`HEIGHT` se EXPORTAN para el guard `tests/proport-ext.test.ts`
 * (cobertura + forma de los bitmaps sin tocar el asset gitignored).
 */
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { PNG } from "pngjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const ASSETS = join(HERE, "..", "assets");
const PNG_PATH = join(ASSETS, "proport-font.png");
const JSON_PATH = join(ASSETS, "proport-font.json");

/**
 * Glifos ES de extensión. `rows` = 8 filas de píxeles ('#' tinta, '.' transparente);
 * width = longitud de las filas. Codepoints NFC (charCodeAt = 1 code unit; la vía de
 * proport.ts los indexa directo). Orden por codepoint.
 */
export const EXT_GLYPHS = [
  // ¡ (0xA1) = ! volteado: punto arriba, asta abajo.
  { code: 0xa1, rows: ["##", "##", "..", "##", "##", "##", "##", ".."] },
  // ¿ (0xBF) = ? rotado 180°.
  { code: 0xbf, rows: ["..##..", "......", "..##..", ".##...", "##....", "##..##", ".####.", "......"] },
  // á (0xE1): a + acute (filas 0-1, sube a la derecha).
  { code: 0xe1, rows: ["..##.", ".##..", ".####", "##.##", "##.##", "##.##", ".####", "....."] },
  // é (0xE9): e + acute.
  { code: 0xe9, rows: ["..##.", ".##..", ".###.", "##.##", "#####", "##...", ".####", "....."] },
  // í (0xED): i ensanchada a 3px con acute claro (asta cols 0-1).
  { code: 0xed, rows: [".##", "##.", "##.", "##.", "##.", "##.", "##.", "..."] },
  // ó (0xF3): o + acute.
  { code: 0xf3, rows: ["..##.", ".##..", ".###.", "##.##", "##.##", "##.##", ".###.", "....."] },
  // ú (0xFA): u + acute.
  { code: 0xfa, rows: ["..##.", ".##..", "##.##", "##.##", "##.##", "##.##", ".###.", "....."] },
  // ü (0xFC): u + diéresis (dos puntos, fila 0).
  { code: 0xfc, rows: [".#.#.", ".....", "##.##", "##.##", "##.##", "##.##", ".###.", "....."] },
  // ñ (0xF1): n + tilde (filas 0-1, onda de dos jorobas).
  { code: 0xf1, rows: ["##.##.", ".##.##", "##..##", "###.##", "######", "##.###", "##..##", "......"] },
];

export const HEIGHT = 8;
const BASE_MAX_CODE = 0x80; // los glifos base del extractor son ASCII (< 0x80)

function main() {
  const manifest = JSON.parse(readFileSync(JSON_PATH, "utf8"));
  if (manifest.height !== HEIGHT) {
    throw new Error(`proport height ${manifest.height} != ${HEIGHT}; revisa el atlas base`);
  }
  // IDEMPOTENCIA: quédate SÓLO con los glifos base (descarta cualquier ext previo).
  const baseGlyphs = manifest.glyphs.filter((g) => g.code < BASE_MAX_CODE);
  const baseEnd = baseGlyphs.reduce((m, g) => Math.max(m, g.x + g.width), 0);

  const src = PNG.sync.read(readFileSync(PNG_PATH));
  if (src.height !== HEIGHT) throw new Error(`PNG height ${src.height} != ${HEIGHT}`);

  const extWidth = EXT_GLYPHS.reduce((s, g) => s + g.rows[0].length, 0);
  const outWidth = baseEnd + extWidth;
  const out = new PNG({ width: outWidth, height: HEIGHT });
  out.data.fill(0); // transparente

  // 1) Copia VERBATIM la región base [0..baseEnd) — cero reflow de las x base.
  for (let y = 0; y < HEIGHT; y++) {
    for (let x = 0; x < baseEnd; x++) {
      const si = (y * src.width + x) * 4;
      const di = (y * outWidth + x) * 4;
      out.data[di] = src.data[si];
      out.data[di + 1] = src.data[si + 1];
      out.data[di + 2] = src.data[si + 2];
      out.data[di + 3] = src.data[si + 3];
    }
  }

  // 2) Dibuja los glifos ext a partir de baseEnd + entradas de manifiesto.
  const extEntries = [];
  let penX = baseEnd;
  for (const g of EXT_GLYPHS) {
    const w = g.rows[0].length;
    for (let y = 0; y < HEIGHT; y++) {
      const row = g.rows[y] ?? "";
      for (let x = 0; x < w; x++) {
        if (row[x] === "#") {
          const di = (y * outWidth + penX + x) * 4;
          out.data[di] = 255;
          out.data[di + 1] = 255;
          out.data[di + 2] = 255;
          out.data[di + 3] = 255;
        }
      }
    }
    extEntries.push({ code: g.code, x: penX, width: w });
    penX += w;
  }

  const outManifest = { height: HEIGHT, glyphs: [...baseGlyphs, ...extEntries] };
  writeFileSync(PNG_PATH, PNG.sync.write(out));
  writeFileSync(JSON_PATH, JSON.stringify(outManifest));
  console.log(
    `proport ext: base ${baseGlyphs.length} glifos (x<${baseEnd}) + ${extEntries.length} ES ` +
      `(${EXT_GLYPHS.map((g) => String.fromCodePoint(g.code)).join(" ")}) → ${outWidth}×${HEIGHT}`,
  );
}

// Sólo escribe el asset cuando se invoca como script (no al importarlo el test).
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) main();
