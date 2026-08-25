/**
 * MAPA DE CONFORMIDAD desde reports (carril espejo-auditor, hito 2).
 *
 * Agrega un directorio de `*.report.json` (los que escribe `writeReport` vía
 * ESPEJO_OUT) en: tabla por parte (smallmap + interior, procedencia sha/dirty),
 * tabla por segmento (peores primero) y racimos de divergentes (por snippet).
 *
 *   node tools/mapa-conformidad.mjs <dirReports> [--top N] [--clusters N] [--json]
 */
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const args = process.argv.slice(2);
const dir = args.find((a) => !a.startsWith("--"));
if (!dir) { console.error("uso: node mapa-conformidad.mjs <dirReports> [--top N] [--clusters N]"); process.exit(2); }
const topN = Number(args.find((a) => a.startsWith("--top="))?.split("=")[1] ?? 25);
const cluN = Number(args.find((a) => a.startsWith("--clusters="))?.split("=")[1] ?? 25);
const asJson = args.includes("--json");

const files = readdirSync(dir).filter((f) => f.endsWith(".report.json")).sort();
const parts = files.map((f) => JSON.parse(readFileSync(join(dir, f), "utf8")));

const pct = (a, b) => (b ? ((100 * a) / b).toFixed(1) + "%" : "—");

if (!asJson) {
  console.log("## Por parte (smallmap ‖ interior)\n");
  console.log("| parte | sha | dirty | conf | matched/comparable | divergent | int.conf | int.m/c | MISS | resyncs* |");
  console.log("|---|---|---|---|---|---|---|---|---|---|");
}
let agg = { m: 0, c: 0, d: 0, im: 0, ic: 0, miss: 0 };
const segRows = [];
const clusters = new Map();
for (const p of parts) {
  const im = p.interior?.matched ?? 0, ic = p.interior?.comparable ?? 0;
  agg.m += p.matched; agg.c += p.comparable; agg.d += p.divergent;
  agg.im += im; agg.ic += ic; agg.miss += p.anchorsMissed ?? 0;
  const resyncs = p.segments.reduce((n, s) => n + (s.resyncs?.length ?? 0), 0);
  if (!asJson) console.log(
    `| ${p.part} | ${p.sha ?? "?"} | ${p.dirty ? "SÍ" : "no"} | ${pct(p.matched, p.comparable)} | ${p.matched}/${p.comparable} | ${p.divergent} | ${pct(im, ic)} | ${im}/${ic} | ${p.anchorsMissed ?? 0} | ${resyncs} |`);
  for (const s of p.segments) {
    if (s.comparable > 0) {
      segRows.push({ part: p.part, id: s.id, ctx: s.ctx, comparable: s.comparable, matched: s.matched, interior: !!s.interior });
    }
    for (const b of s.blocks ?? []) {
      if (b.verdict !== "divergent") continue;
      // clave de racimo: snippet normalizado (o clase) — agrupa la MISMA divergencia repetida
      const key = (b.snippet ?? "(sin snippet)").toLowerCase().replace(/\d+/g, "#").slice(0, 60);
      const e = clusters.get(key) ?? { n: 0, where: new Map() };
      e.n++;
      e.where.set(s.id, (e.where.get(s.id) ?? 0) + 1);
      clusters.set(key, e);
    }
  }
}
if (!asJson) {
  console.log(`| **TOTAL** | — | — | ${pct(agg.m, agg.c)} | ${agg.m}/${agg.c} | ${agg.d} | ${pct(agg.im, agg.ic)} | ${agg.im}/${agg.ic} | ${agg.miss} | — |`);
  console.log("\n(*resyncs = costuras/anclas que teletransportaron, agregado de parte)");

  segRows.sort((a, b) => (a.matched / a.comparable) - (b.matched / b.comparable) || b.comparable - a.comparable);
  console.log(`\n## Peores ${topN} segmentos (comparable≥10, peor conformidad primero)\n`);
  console.log("| segmento | ctx | int | matched/comparable | conf |");
  console.log("|---|---|---|---|---|");
  for (const s of segRows.filter((x) => x.comparable >= 10).slice(0, topN)) {
    console.log(`| ${s.id} | ${s.ctx} | ${s.interior ? "sí" : ""} | ${s.matched}/${s.comparable} | ${pct(s.matched, s.comparable)} |`);
  }

  const clu = [...clusters.entries()].sort((a, b) => b[1].n - a[1].n).slice(0, cluN);
  console.log(`\n## Racimos de divergentes (top ${cluN} por snippet del port normalizado)\n`);
  console.log("| n | snippet (port, ~) | segmentos (top 3) |");
  console.log("|---|---|---|");
  for (const [k, e] of clu) {
    const where = [...e.where.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([id, n]) => `${id}×${n}`).join(" ");
    console.log(`| ${e.n} | \`${k.replace(/\|/g, "\\|")}\` | ${where} |`);
  }
} else {
  console.log(JSON.stringify({ agg, segRows, clusters: [...clusters.entries()].map(([k, e]) => ({ k, n: e.n })) }, null, 2));
}
