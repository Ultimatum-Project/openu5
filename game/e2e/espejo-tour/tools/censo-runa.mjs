/**
 * SONDA COMMITEADA del censo de `typed` que son ECO RÚNICO (carril des-por-7).
 *
 * PORQUÉ: el getstring rúnico de Cast/Mix (CAST2.OVL:0x00de) se teclea por INICIAL y
 * ECOA la sílaba entera en mayúsculas ("D" → "DES"). El OCR del LP sólo ve el ECO, así
 * que la ruta guarda `typed: "DES POR"` cuando lo que el jugador PULSÓ fue `D`,`P`.
 * Un `typed` así, re-tecleado literal contra el prompt rúnico, NO reproduce el hechizo:
 * el ESPACIO es la tecla de ENVÍO del prompt (prompt-manager.ts:142), así que "DES POR"
 * envía las iniciales `DES` (Des·Ex·Sanct = ningún hechizo → "No effect!") y deja `POR`
 * cayendo sobre el MAPA como comandos sueltos.
 *
 * Esta sonda enumera la población para que la cifra del acta sea reproducible.
 *   node game/e2e/espejo-tour/tools/censo-runa.mjs
 */
import { readFileSync } from "node:fs";
import { globSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..");

/** DATA.OVL DS:0x1b7a — 'J' y 'O' tienen puntero NULL (rechazadas por 0x00fa/0x0101). */
const RUNE_BY_INITIAL = {
  A: "AN", B: "BET", C: "CORP", D: "DES", E: "EX", F: "FLAM", G: "GRAV", H: "HUR",
  I: "IN", K: "KAL", L: "LOR", M: "MANI", N: "NOX", P: "POR", Q: "QUAS", R: "REL",
  S: "SANCT", T: "TYM", U: "UUS", V: "VAS", W: "WIS", X: "XEN", Y: "YLEM", Z: "ZU",
};
const SYLLABLES = new Set(Object.values(RUNE_BY_INITIAL));

/** Un `typed` es ECO RÚNICO si TODOS sus tokens son sílabas de la tabla. */
export function esEcoRunico(texto) {
  const toks = texto.toUpperCase().trim().split(/\s+/).filter(Boolean);
  return toks.length > 0 && toks.every((t) => SYLLABLES.has(t));
}

function rutas() {
  return [
    ...globSync(join(ROOT, "routes", "*.route.json")),
    ...globSync(join(ROOT, "routes-ad", "*.route.json")),
  ].sort();
}

function main() {
  const porForma = new Map();
  let total = 0;
  let ficheros = 0;
  for (const f of rutas()) {
    ficheros++;
    const doc = JSON.parse(readFileSync(f, "utf8"));
    for (const seg of doc.segments ?? []) {
      for (const op of seg.script ?? []) {
        const t = op.typed ?? op.type ?? op.typedMantra;
        if (typeof t !== "string" || !esEcoRunico(t)) continue;
        total++;
        porForma.set(t.toUpperCase(), (porForma.get(t.toUpperCase()) ?? 0) + 1);
      }
    }
  }
  const multi = [...porForma.entries()].filter(([k]) => k.includes(" "));
  console.log(`rutas barridas         : ${ficheros}`);
  console.log(`typed que son ECO RÚNICO: ${total} (${porForma.size} formas distintas)`);
  console.log(`  de ellas MULTI-sílaba : ${multi.reduce((a, [, n]) => a + n, 0)} (${multi.length} formas)`);
  console.log("--- formas, por frecuencia ---");
  for (const [k, n] of [...porForma.entries()].sort((a, b) => b[1] - a[1])) {
    console.log(String(n).padStart(4), k);
  }
}

if (process.argv[1] && process.argv[1].endsWith("censo-runa.mjs")) main();
