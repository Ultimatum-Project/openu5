/**
 * SONDA COMMITEADA de la ventana `espejo-conf` — las DOS poblaciones que la ventana mide.
 *
 * PORQUÉ EXISTE: una cifra de censo sin sonda commiteada es irreproducible, y esta ventana
 * pre-registra dos poblaciones (§2 de `re/notes/espejo-conf-preregistro.md`) de las que
 * dependen sus predicciones. Se ejecuta desde la raíz del repo:
 *
 *   node re/tools/censo_espejo_conf.mjs
 *
 * (1) POBLACIÓN DE `R` (fix del eco rúnico, runner.ts).
 *     Reproduce el 623 del acta `des-por-7` con el MISMO predicado que su sonda
 *     (`game/e2e/espejo-tour/tools/censo-runa.mjs`: un `typed` es eco rúnico si TODOS sus
 *     tokens son sílabas de la tabla de DATA.OVL DS:0x1b7a) y lo PARTE por `seg.skip` del
 *     `route.json`, que es la capa que el runner obedece — el runner no lee overlays.
 *
 * (2) POBLACIÓN DE `Y` (fix britannia-y1, dungeon-cmds.ts).
 *     Costuras de SALIDA DE MAZMORRA, separadas por capa de destino. Criterio mecánico:
 *     `seam:"exit"` + `enter.overworld:true` con una mazmorra viva por delante
 *     (`enter.dungeon:true` o `ctx:"dungeon"` sin una salida intermedia que la cierre).
 *     La capa la declara la propia costura (`enter.underworld`).
 *     ⚠ Censo ESTÁTICO: enumera las costuras que PUEDEN ejercitar la salida, no las que el
 *     replay ejercita de hecho. El censo dinámico sale de los reports de la corrida.
 */
import { readFileSync, globSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, basename } from "node:path";

const HERE = dirname(fileURLToPath(import.meta.url));
const TOUR = join(HERE, "..", "..", "game", "e2e", "espejo-tour");

/** DATA.OVL DS:0x1b7a — 'J' y 'O' tienen puntero NULL (rechazadas por 0x00fa/0x0101). */
const SILABAS = new Set([
  "AN", "BET", "CORP", "DES", "EX", "FLAM", "GRAV", "HUR", "IN", "KAL", "LOR", "MANI",
  "NOX", "POR", "QUAS", "REL", "SANCT", "TYM", "UUS", "VAS", "WIS", "XEN", "YLEM", "ZU",
]);

export function esEcoRunico(texto) {
  const toks = texto.toUpperCase().trim().split(/\s+/).filter(Boolean);
  return toks.length > 0 && toks.every((t) => SILABAS.has(t));
}

const parte = (f) => basename(f).replace(".route.json", "");
const rutas = (dir) => globSync(join(TOUR, dir, "*.route.json")).sort();

/** (1) ecos rúnicos por parte, partidos por `seg.skip` del route. */
export function censoRuna(dir) {
  const filas = [];
  let vivas = 0;
  let enSkip = 0;
  for (const f of rutas(dir)) {
    const doc = JSON.parse(readFileSync(f, "utf8"));
    let v = 0;
    let s = 0;
    const segs = new Set();
    for (const seg of doc.segments ?? []) {
      for (const op of seg.script ?? []) {
        const t = op.typed ?? op.type ?? op.typedMantra;
        if (typeof t !== "string" || !esEcoRunico(t)) continue;
        if (seg.skip) s++;
        else {
          v++;
          segs.add(seg.id);
        }
      }
    }
    vivas += v;
    enSkip += s;
    if (v || s) filas.push({ parte: parte(f), vivas: v, segs: segs.size, enSkip: s });
  }
  return { filas, vivas, enSkip, total: vivas + enSkip };
}

/** (2) salidas de mazmorra por capa de destino. */
export function censoSalidas(dir) {
  const brit = [];
  const under = [];
  for (const f of rutas(dir)) {
    const doc = JSON.parse(readFileSync(f, "utf8"));
    let mazmorraViva = null;
    for (const seg of doc.segments ?? []) {
      const e = seg.enter ?? {};
      if (e.dungeon === true || seg.ctx === "dungeon") mazmorraViva = e.loc ?? mazmorraViva;
      if (seg.seam === "exit" && e.overworld === true) {
        if (mazmorraViva != null) {
          const fila = { id: seg.id, dng: mazmorraViva, skip: !!seg.skip };
          (e.underworld === true ? under : brit).push(fila);
        }
        mazmorraViva = null;
      }
    }
  }
  return { brit, under };
}

function main() {
  for (const dir of ["routes-ad", "routes"]) {
    const r = censoRuna(dir);
    console.log(`\n=== ${dir} — (1) ECO RÚNICO: ${r.total} ops · VIVAS ${r.vivas} · en skip ${r.enSkip}`);
    for (const x of r.filas.filter((x) => x.vivas)) {
      console.log(`   ${x.parte.padEnd(9)} ${String(x.vivas).padStart(3)} vivas en ${String(x.segs).padStart(2)} segs   (${x.enSkip} en skip)`);
    }
    const sinVivas = r.filas.filter((x) => !x.vivas).map((x) => x.parte);
    if (sinVivas.length) console.log(`   [sólo en skip] ${sinVivas.join(" ")}`);

    const s = censoSalidas(dir);
    console.log(`--- ${dir} — (2) SALIDAS DE MAZMORRA: a Britannia ${s.brit.length} · al Underworld ${s.under.length} (control)`);
    console.log(`   BRIT  ${s.brit.map((x) => `${x.id}(dng${x.dng})${x.skip ? "[SKIP]" : ""}`).join(" ")}`);
    console.log(`   UNDER ${s.under.map((x) => `${x.id}(dng${x.dng})${x.skip ? "[SKIP]" : ""}`).join(" ")}`);
  }
}

if (process.argv[1] && process.argv[1].endsWith("censo_espejo_conf.mjs")) main();
