/**
 * FASE 3f — MEDICIÓN OFICIAL: antes (`lp1`) vs después (`lp1-3f`) sobre el material congelado.
 *
 * Respeta el CONTRATO DEL RUNNER, que es lo que hace comparables estos números con los reportes
 * del 26-07 (verificado por `verify-baseline-3f.ts`, 18/18 exactas):
 *   · los segmentos `skip:"pendiente-runner"` NO llevan diff (planSegment: `diff: !navOnly`);
 *   · la conformidad de la PARTE es sólo SMALLMAP — el interior va aparte (ruling de la Fase 3).
 *
 * Imprime SIEMPRE el denominador junto al porcentaje, y el censo de lo retirado POR MECANISMO
 * (la mitigación obligatoria que pide el doc de diseño: un reconocedor ancho se auto-absuelve, y
 * la única defensa es que se vea exactamente qué sale y por qué).
 *
 *   npx tsx game/e2e/espejo-tour/tools/medir-3f.ts [--dir .espejo-lp1] [parts…]
 */
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { loadRoute, diffSegment, ROUTES_DIR } from "../runner";
import { LP1_PROFILE, LP1_LATE_PROFILE } from "../ocr-profile";

interface M { comparable: number; matched: number; divergent: number; blocks: number }
const zero = (): M => ({ comparable: 0, matched: 0, divergent: 0, blocks: 0 });
const add = (a: M, b: M): void => {
  a.comparable += b.comparable;
  a.matched += b.matched;
  a.divergent += b.divergent;
  a.blocks += b.blocks;
};
const pct = (m: M): string => (m.comparable ? ((m.matched / m.comparable) * 100).toFixed(1) + "%" : "—");
const show = (m: M): string => `${pct(m).padStart(6)} (${String(m.matched).padStart(4)}/${String(m.comparable).padEnd(5)})`;

function main(): void {
  const argv = process.argv.slice(2);
  let dir = ".espejo-lp1";
  const parts: string[] = [];
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--dir") dir = argv[++i]!;
    else parts.push(argv[i]!);
  }
  const list = parts.length
    ? parts
    : readdirSync(dir).filter((f) => f.endsWith(".transcript.json")).map((f) => f.replace(".transcript.json", "")).sort();

  const censo = new Map<string, number>();
  const T = { base: zero(), late: zero() };
  const Ti = { base: zero(), late: zero() };
  const G = { base: zero(), late: zero() }; // part09-18, el grupo de la predicción
  const E = { base: zero(), late: zero() }; // part07-08, el grupo «ya clasificado»
  const GRUPO = new Set(["part09", "part10", "part11", "part12", "part13", "part14", "part15", "part16", "part17", "part18"]);
  const TEMPRANAS = new Set(["part07", "part08"]);

  console.log("parte      ANTES (lp1)          DESPUES (lp1-3f)     Δdenominador  Δnumerador  bloques");
  for (const part of list) {
    if (!existsSync(join(dir, `${part}.transcript.json`))) continue;
    const route = loadRoute(part, ROUTES_DIR);
    const tr = JSON.parse(readFileSync(join(dir, `${part}.transcript.json`), "utf8")) as Record<string, string[]>;
    const p = { base: zero(), late: zero() };
    const pi = { base: zero(), late: zero() };
    for (const seg of route.segments) {
      if (seg.skip != null) continue;
      const lines = tr[seg.id];
      if (!lines) continue;
      const b = diffSegment(seg, lines, LP1_PROFILE);
      const l = diffSegment(seg, lines, LP1_LATE_PROFILE);
      for (const blk of l.blocks) if (blk.class.startsWith("3f-")) censo.set(blk.class, (censo.get(blk.class) ?? 0) + 1);
      const mb: M = { comparable: b.comparable, matched: b.matched, divergent: b.blocks.filter((x) => x.verdict === "divergent").length, blocks: b.blocks.length };
      const ml: M = { comparable: l.comparable, matched: l.matched, divergent: l.blocks.filter((x) => x.verdict === "divergent").length, blocks: l.blocks.length };
      add(seg.openedBy ? pi.base : p.base, mb);
      add(seg.openedBy ? pi.late : p.late, ml);
    }
    add(T.base, p.base);
    add(T.late, p.late);
    add(Ti.base, pi.base);
    add(Ti.late, pi.late);
    if (GRUPO.has(part)) { add(G.base, p.base); add(G.late, p.late); }
    if (TEMPRANAS.has(part)) { add(E.base, p.base); add(E.late, p.late); }
    console.log(
      `${part}   ${show(p.base)}   ${show(p.late)}   ` +
        `${String(p.late.comparable - p.base.comparable).padStart(7)}   ${String(p.late.matched - p.base.matched).padStart(8)}   ${p.base.blocks}`,
    );
  }
  console.log("\n--- AGREGADOS (smallmap; el interior va aparte por el ruling de la Fase 3) ---");
  console.log(`part07-24 (18)   ANTES ${show(T.base)}   DESPUES ${show(T.late)}`);
  console.log(`part09-18 (10) ★ ANTES ${show(G.base)}   DESPUES ${show(G.late)}`);
  console.log(`part07-08  (2)   ANTES ${show(E.base)}   DESPUES ${show(E.late)}`);
  console.log(`INTERIOR         ANTES ${show(Ti.base)}   DESPUES ${show(Ti.late)}`);

  const retirado = T.base.comparable - T.late.comparable;
  console.log(`\n--- CENSO DE LO RETIRADO POR MECANISMO (${retirado} bloques) ---`);
  for (const [k, n] of [...censo.entries()].sort((a, b) => b[1] - a[1])) console.log(`  ${String(n).padStart(6)}  ${k}`);
  console.log(
    `\nDENOMINADOR retirado: ${retirado}/${T.base.comparable} = ${((retirado / Math.max(1, T.base.comparable)) * 100).toFixed(1)}% (18 partes)` +
      `\n  del grupo part09-18: ${G.base.comparable - G.late.comparable}/${G.base.comparable} = ` +
      `${(((G.base.comparable - G.late.comparable) / Math.max(1, G.base.comparable)) * 100).toFixed(1)}%`,
  );
  console.log(`NUMERADOR: ${T.base.matched} → ${T.late.matched} (delta ${T.late.matched - T.base.matched}; la regla monótona exige 0)`);
}

main();
