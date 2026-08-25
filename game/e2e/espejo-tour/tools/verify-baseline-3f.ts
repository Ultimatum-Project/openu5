/**
 * FASE 3f — VERIFICACIÓN DE LÍNEA BASE del banco offline contra los REPORTES CONGELADOS.
 *
 * Antes de tocar un solo reconocedor hay que demostrar que el banco offline REPRODUCE, número a
 * número, lo que la corrida en vivo del 26-07 escribió en `.espejo-lp1/NN.report.json`. Si el
 * «antes» del banco no es el «antes» real, cualquier delta que midamos después es del instrumento
 * y no de la palanca — el error exacto que `AD_PRE3C_PROFILE` existe para no cometer.
 *
 * DOS filtros, los dos indispensables (cada uno se descubrió reproduciendo y fallando):
 *  1. `seg.skip == null`. NO vale «el transcript trae líneas» (`--driven-only` de calib-offline):
 *     un segmento `skip:"pendiente-runner"` se ATRAVIESA en nav-only y SÍ emite líneas del port
 *     («North», «Blocked!»), pero el runner NO le hace diff (planSegment: `diff: !navOnly`) y lo
 *     reporta con comparable 0.
 *  2. `seg.openedBy == null` para la métrica de PARTE. El ruling de la Fase 3 mantiene la
 *     conformidad de INTERIOR aparte de la de smallmap (`espejo-tour.spec.ts:143` — `outer =
 *     segReports.filter(s => !s.interior)`), así que el `comparable` de la parte es SÓLO
 *     smallmap. Sin este filtro 6 de las 18 partes no reproducían.
 *
 *   npx tsx game/e2e/espejo-tour/tools/verify-baseline-3f.ts [--dir .espejo-lp1]
 *
 * Sale 0 si las 18 partes reproducen comparable/matched/divergent EXACTOS; 1 si alguna no.
 */
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { loadRoute, diffSegment, ROUTES_DIR, type PartReport } from "../runner";
import { LP1_PROFILE } from "../ocr-profile";

function main(): void {
  const argv = process.argv.slice(2);
  let dir = ".espejo-lp1";
  for (let i = 0; i < argv.length; i++) if (argv[i] === "--dir") dir = argv[++i]!;
  const parts = readdirSync(dir)
    .filter((f) => f.endsWith(".report.json"))
    .map((f) => f.replace(".report.json", ""))
    .sort();
  let bad = 0;
  for (const part of parts) {
    const rep = JSON.parse(readFileSync(join(dir, `${part}.report.json`), "utf8")) as PartReport;
    const tr = JSON.parse(readFileSync(join(dir, `${part}.transcript.json`), "utf8")) as Record<string, string[]>;
    const route = loadRoute(part, ROUTES_DIR);
    let comparable = 0;
    let matched = 0;
    let divergent = 0;
    let iComparable = 0;
    let iMatched = 0;
    for (const seg of route.segments) {
      if (seg.skip != null) continue; // nav-only: el runner NO le hace diff
      const lines = tr[seg.id];
      if (!lines) continue;
      const d = diffSegment(seg, lines, LP1_PROFILE);
      if (seg.openedBy) {
        iComparable += d.comparable;
        iMatched += d.matched;
        continue; // métrica de INTERIOR, aparte de la de la parte (ruling de la Fase 3)
      }
      comparable += d.comparable;
      matched += d.matched;
      divergent += d.blocks.filter((b) => b.verdict === "divergent").length;
    }
    const ok =
      comparable === rep.comparable &&
      matched === rep.matched &&
      divergent === rep.divergent &&
      iComparable === rep.interior.comparable &&
      iMatched === rep.interior.matched;
    if (!ok) bad++;
    console.log(
      `${ok ? "OK  " : "MISS"} ${part}  offline ${matched}/${comparable} div=${divergent} int=${iMatched}/${iComparable}` +
        `   reporte ${rep.matched}/${rep.comparable} div=${rep.divergent} int=${rep.interior.matched}/${rep.interior.comparable}`,
    );
  }
  console.log(bad === 0 ? `\nLÍNEA BASE REPRODUCIDA: ${parts.length}/${parts.length}` : `\n${bad} partes NO reproducen`);
  process.exit(bad === 0 ? 0 : 1);
}

main();
