#!/usr/bin/env node
/**
 * WALKTHROUGH-ESPEJO — re-colapso de rachas de tecleo sobre rutas YA CURADAS.
 *
 * `segment.mjs` ganó el colapso de rachas tolerante a huecos (`computeRachaGroups`,
 * fix del cabo §7.2 de `espejo-ad-salud`): las lecturas PARCIALES que el OCR hizo de
 * una misma getstring («VA · VAR · BARN · BARNABAS») ya no salen como varios `typed`.
 * Pero las rutas COMMITEADAS de `routes/` y `routes-ad/` se generaron con el colapso
 * viejo y llevan meses de curación encima (overlays, anclas, dungeon-ops, ledger):
 * re-segmentarlas desde cero PISARÍA todo eso.
 *
 * Esta herramienta aplica EL MISMO discriminante (importa `computeRachaGroups` del
 * propio segment.mjs — una sola fuente, no una réplica) a una ruta existente:
 *   · reconstruye los grupos de racha desde el ocrlog fuente de la ruta;
 *   · para cada grupo con ≥2 lecturas, localiza las ops `typed`/`typedMantra` de la
 *     ruta cuyas `ocrLn` son miembros del grupo y conserva UNA — la de texto más
 *     largo (desempates: menos glifos sospechosos, después la más tardía = estado
 *     final del tecleo) — retirando las demás;
 *   · NO toca ops de overlay (`src:"overlay"`): eso es curación humana;
 *   · NO toca nada más de la ruta (nav, keys, expect, skips, anclas).
 *
 * Por defecto SECO (informa y no escribe). `--write` persiste.
 *
 * Uso:  node e2e/espejo-tour/tools/recollapse-typed.mjs [--routes <dir>] [--write] <partNN>...
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { buildEvents, computeRachaGroups, betterReading } from "./segment.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const CLIPS = join(HERE, "..", "..", "..", "..", "original", "av-referencia", "yt", "clips");

const argv = process.argv.slice(2);
const routesArg = argv.includes("--routes") ? argv.splice(argv.indexOf("--routes"), 2)[1] : "routes";
const ROUTES = routesArg.startsWith("/") ? routesArg : join(HERE, "..", routesArg);
const WRITE = argv.includes("--write");
const parts = argv.filter((a) => !a.startsWith("--"));
if (!parts.length) {
  console.error("uso: recollapse-typed.mjs [--routes <dir>] [--write] <partNN>...");
  process.exit(2);
}

let totalDropped = 0;
for (const part of parts) {
  const routePath = join(ROUTES, `${part}.route.json`);
  if (!existsSync(routePath)) {
    console.error(`${routePath}: no existe`);
    process.exitCode = 1;
    continue;
  }
  const route = JSON.parse(readFileSync(routePath, "utf8"));
  const ocrPath = join(CLIPS, route.source);
  if (!existsSync(ocrPath)) {
    console.error(`${part}: ocrlog fuente no encontrado (${ocrPath})`);
    process.exitCode = 1;
    continue;
  }
  const lines = readFileSync(ocrPath, "utf8").split("\n");
  const groups = computeRachaGroups(buildEvents(lines, 1)).filter((g) => g.members.length > 1);
  const lnGroup = new Map(); // ocrLn → grupo
  for (const g of groups) for (const m of g.members) lnGroup.set(m.ln, g);

  // ops typed/typedMantra de la ruta, agrupadas por grupo de racha
  const byGroup = new Map(); // grupo → [{seg, idx, op}]
  for (const seg of route.segments) {
    seg.script.forEach((op, idx) => {
      const s = op.typed ?? op.typedMantra;
      if (s === undefined || op.src === "overlay") return;
      const g = lnGroup.get(op.ocrLn);
      if (!g) return;
      if (!byGroup.has(g)) byGroup.set(g, []);
      byGroup.get(g).push({ seg, idx, op });
    });
  }

  let dropped = 0;
  const toDrop = new Set();
  for (const [g, ops] of byGroup) {
    if (ops.length < 2) continue; // la curación ya dejó una sola: nada que hacer
    let keep = ops[0];
    for (const o of ops.slice(1)) {
      const a = keep.op.typed ?? keep.op.typedMantra;
      const b = o.op.typed ?? o.op.typedMantra;
      if (betterReading(b, a)) keep = o;
    }
    for (const o of ops)
      if (o !== keep) {
        toDrop.add(o.op);
        dropped++;
        console.log(
          `  ${part} ${keep.seg.id ?? ""} ocrLn ${o.op.ocrLn}: −${JSON.stringify(
            o.op.typed ?? o.op.typedMantra,
          )} (racha → ${JSON.stringify(keep.op.typed ?? keep.op.typedMantra)} @${keep.op.ocrLn})`,
        );
      }
  }
  for (const seg of route.segments) seg.script = seg.script.filter((op) => !toDrop.has(op));
  totalDropped += dropped;
  console.log(`${part}: ${dropped} typed parciales retirados${WRITE ? "" : " (SECO, sin escribir)"}`);
  if (WRITE && dropped) writeFileSync(routePath, JSON.stringify(route, null, 2) + "\n");
}
console.log(`TOTAL: ${totalDropped} ops retiradas en ${parts.length} rutas`);
