/**
 * MIGRACIÓN DE SEMILLA para la PUERTA #D1 (`src/core/npc/carga-fiel.ts`).
 *
 * Escribe en el sidecar de una semilla el campo `npcWalk` — la banda de NPC que la vía
 * `.GAM`+sidecar no sabía transportar— con EXACTAMENTE la lista que el port deriva HOY al
 * cargar esa semilla (puerta CERRADA, `enterMap(loc, state, restore=true)` por la rama de
 * ausencia). Es decir: congela la conducta actual en el fichero, en vez de re-derivarla en
 * cada carga.
 *
 * ── POR QUÉ ESTA VÍA Y NO DOSBOX ─────────────────────────────────────────────────────────
 * El encargo daba por hecho que la receta era «fabricar el estado entrando al mapa en el
 * ORIGINAL y guardar». Eso es la receta correcta para un save del BINARIO —y la única
 * medida, acta §4 armas A/E3— pero **no vale para este corpus**, por dos hechos del árbol:
 *
 *  1. Las semillas del espejo NO son saves de DOSBox: son artefactos ENCADENADOS del propio
 *     port (`saves-PROCEDENCIA.tsv`: `cadena-limpia-C` para part07-24, `cadena-AD-regenerada`
 *     para ad01-25, sembradas de `part06`/`boot-fresh`). Un save fabricado en DOSBox traería
 *     OTRA party, OTRO reloj y OTRO inventario ⇒ rompería la cadena entera y todos los
 *     esperados OCR de `routes/`, que están calibrados contra ESA cadena.
 *  2. La conducta que hay que PRESERVAR es la de hoy: las siete semillas casan con el LP
 *     porque el port repuebla y el humano del LP había entrado andando. Congelar la
 *     derivación de hoy preserva eso por CONSTRUCCIÓN; entrar al mapa en el original lo
 *     cambiaría.
 *
 * ⇒ la migración no inventa estado: escribe el que el port ya pinta. Verificable, y
 * verificado: `tests/npc-gate-carga-fresh.test.ts` exige que la lista restaurada de una
 * semilla migrada sea IDÉNTICA campo a campo a la que la semilla original re-deriva.
 *
 * ⚠ LO QUE SÍ CAMBIA, y va declarado: tras la migración las posiciones de NPC de esas
 * semillas quedan CONGELADAS en el fichero. Hoy siguen a la derivación por horario, así que
 * un fix futuro en `scheduleIndex`/aiTypes las movería en silencio; migradas, no. Para un
 * corpus de careo eso es una propiedad deseable (reproducibilidad), pero es un cambio de
 * régimen y por eso se dice aquí y en el acta.
 *
 * ── USO ──────────────────────────────────────────────────────────────────────────────────
 *   npx tsx e2e/espejo-tour/tools/migra-npcwalk.ts --dry            # censo, no escribe
 *   npx tsx e2e/espejo-tour/tools/migra-npcwalk.ts part07           # migra una
 *   npx tsx e2e/espejo-tour/tools/migra-npcwalk.ts --todas          # las siete
 *   U5_ESPEJO_SAVES_DIR=<dir> npx tsx … --todas                     # sobre una copia
 *
 * Sin argumentos: censo (equivale a `--dry`). NUNCA escribe sin que se le nombre la semilla
 * o se pase `--todas`.
 *
 * 🔴 Escribe SOBRE `saves/`, que está FUERA del índice: el diff no lo enseña. Por eso el
 * tool imprime el sha256 ANTES y DESPUÉS de cada fichero y recuerda re-sellar
 * `saves-PROCEDENCIA.tsv` (`python3 re/tools/test_saves_procedencia.py --sellar`).
 */
import { readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { importNativeSave, type SaveSidecar } from "../../../src/core/saveNative.js";
import { NpcManager, type NpcSlot } from "../../../src/core/npc/manager.js";
import { setCargaFiel } from "../../../src/core/npc/carga-fiel.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const GAME = resolve(HERE, "../../..");
const SAVES = process.env.U5_ESPEJO_SAVES_DIR?.trim() || join(GAME, "e2e/espejo-tour/saves");
const npcData = JSON.parse(readFileSync(join(GAME, "assets/npcs.json"), "utf-8")) as Record<
  number,
  NpcSlot[]
>;

/**
 * Las SIETE semillas del corpus que arrancan en mapa poblado (acta §8, re-medidas por
 * `tests/npc-gate-carga-medida.test.ts`). Va en crudo y no derivado del directorio A
 * PROPÓSITO: si mañana aparece una octava, el censo del test lo dice y esta lista tiene que
 * cambiarse A MANO, con alguien mirando. Una lista auto-derivada migraría en silencio.
 */
export const SEMILLAS_EN_PUEBLO = [
  "ad12",
  "part03",
  "part05",
  "part06",
  "part07",
  "part09",
  "part10",
] as const;

const sha = (b: Buffer | string): string => createHash("sha256").update(b).digest("hex");

interface Resultado {
  part: string;
  loc: number;
  hour: number;
  npcs: number;
  shaAntes: string;
  shaDespues: string | null;
}

/**
 * Deriva la banda con la puerta CERRADA (la conducta de hoy) y devuelve el `npcWalk`
 * resultante. Restaura el estado de la puerta pase lo que pase.
 */
function derivarBanda(part: string): { walk: unknown; loc: number; hour: number; npcs: number } {
  const prev = setCargaFiel(false);
  try {
    const gam = new Uint8Array(readFileSync(join(SAVES, `${part}.gam`)));
    const sidecar = JSON.parse(
      readFileSync(join(SAVES, `${part}.sidecar.json`), "utf-8"),
    ) as SaveSidecar;
    const state = importNativeSave(gam, sidecar);
    const loc = state.position.location;
    if (loc === 0) throw new Error(`${part}: loc=0 (overworld) — no hay banda que migrar`);
    new NpcManager(npcData).enterMap(loc, state, true);
    const walk = state.npcWalk;
    if (!walk) throw new Error(`${part}: enterMap no dejó npcWalk — la migración NO es válida`);
    return { walk, loc, hour: state.time.hour, npcs: walk.slots.length };
  } finally {
    setCargaFiel(prev);
  }
}

function migrar(part: string, escribir: boolean): Resultado {
  const ruta = join(SAVES, `${part}.sidecar.json`);
  const crudo = readFileSync(ruta);
  const shaAntes = sha(crudo);
  const { walk, loc, hour, npcs } = derivarBanda(part);
  if (!escribir) return { part, loc, hour, npcs, shaAntes, shaDespues: null };
  // Se re-escribe el JSON ENTERO desde el objeto parseado, con `npcWalk` añadido dentro de
  // `gameState`. El resto de claves conserva su valor y su orden de inserción (JSON.parse
  // preserva el orden del fichero para claves de texto), así que el diff es el campo nuevo.
  const obj = JSON.parse(crudo.toString("utf-8")) as SaveSidecar;
  (obj.gameState as unknown as Record<string, unknown>).npcWalk = walk;
  const salida = JSON.stringify(obj);
  writeFileSync(ruta, salida);
  return { part, loc, hour, npcs, shaAntes, shaDespues: sha(salida) };
}

const argv = process.argv.slice(2);
const todas = argv.includes("--todas");
const dry = argv.includes("--dry") || (argv.length === 0);
const nombradas = argv.filter((a) => !a.startsWith("--"));
const objetivo: string[] = todas ? [...SEMILLAS_EN_PUEBLO] : nombradas;

if (!dry && objetivo.length === 0) {
  console.error("migra-npcwalk: nombra una semilla, o pasa --todas. Sin eso no escribo nada.");
  process.exit(2);
}

const lista = objetivo.length > 0 ? objetivo : [...SEMILLAS_EN_PUEBLO];
const escribir = !dry;
console.log(`saves-dir: ${SAVES}${process.env.U5_ESPEJO_SAVES_DIR ? " (REDIRIGIDO)" : " (canónico)"}`);
console.log(escribir ? "modo: ESCRIBE" : "modo: censo (--dry) — no escribe nada");
for (const part of lista) {
  const r = migrar(part, escribir);
  console.log(
    `  ${r.part.padEnd(8)} loc=${String(r.loc).padStart(2)} h=${String(r.hour).padStart(2)} ` +
      `npcWalk.slots=${String(r.npcs).padStart(2)}  sha ${r.shaAntes.slice(0, 12)}` +
      (r.shaDespues ? ` → ${r.shaDespues.slice(0, 12)}` : " (sin tocar)"),
  );
}
if (escribir) {
  console.log(
    "\n🔴 `saves/` está FUERA del índice: esto NO sale en `git diff`.\n" +
      "   Re-sella el manifiesto:  python3 re/tools/test_saves_procedencia.py --sellar",
  );
}
