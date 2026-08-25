/**
 * COMPARACIÓN PAREADA de dos runs — el instrumento de los DISCRIMINADORES del pre-registro.
 *
 * Nace de un error propio: comparé «sin conducir 9.2%» con «conducido 21.4%» y lo llamé el efecto
 * de conducir, cuando eran **poblaciones distintas** (8 segmentos contra 1). Comparar agregados de
 * lotes distintos no mide una palanca, mide la diferencia entre los lotes. Este banco sólo compara
 * **el MISMO segmento en los dos runs**, y descarta el que falte en cualquiera de los dos.
 *
 * Y sirve para lo que el porcentaje NO puede decidir (§3 de `PREDICCION-3d.md`): como el `expect`
 * de un segmento es el MISMO en los dos runs, el denominador es directamente comparable. Si
 * `comparable` CAE al conducir, la conformidad se compró encogiendo el denominador — el pecado que
 * el carril evita a propósito. Si sube o se queda plano, la mejora está en el NUMERADOR, que es la
 * única forma honesta de mejorar.
 *
 * ⚠ La razón de ser: los MISMOS 8 segmentos de 3d de ad17 sin conducir dan 6.1% en un run y 12.3%
 * en otro (mismo denominador, 538). La línea base tiene MÁS varianza run-a-run que el efecto que
 * se busca, así que el agregado no basta y hay que mirar segmento a segmento.
 *
 *   npx tsx game/e2e/espejo-tour/tools/calib-paired.ts --a .espejo-3c --b .espejo-3d [--phase 3d]
 *
 * `--a` = run de REFERENCIA (antes), `--b` = run NUEVO (después).
 */
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { loadRoute, diffSegment, ROUTES_AD_DIR, ROUTES_DIR, type Segment } from "../runner";
import { AD_PROFILE } from "../ocr-profile";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..", "..", "..", "..");
const routesFor = (part: string): string => (part.startsWith("ad") ? ROUTES_AD_DIR : ROUTES_DIR);

interface Side {
  matched: number;
  comparable: number;
  divergent: number;
  combat: number;
  sala: number;
  driven: boolean;
}
const measure = (seg: Segment, lines: string[], driven: boolean): Side => {
  const d = diffSegment(seg, lines, AD_PROFILE);
  return {
    matched: d.matched,
    comparable: d.comparable,
    divergent: d.blocks.filter((b) => b.verdict === "divergent").length,
    combat: d.combatRng,
    sala: d.salaDeferred,
    driven,
  };
};
const pc = (m: number, c: number): string => (c ? ((m / c) * 100).toFixed(1) + "%" : "—");

/** Segmentos que ESE run condujo como interior (lo dice su propio reporte). */
function drivenSet(dir: string, part: string): Set<string> {
  const f = join(dir, `${part}.report.json`);
  const s = new Set<string>();
  if (!existsSync(f)) return s;
  const rep = JSON.parse(readFileSync(f, "utf8")) as { segments?: Array<{ id: string; interior?: boolean }> };
  for (const sr of rep.segments ?? []) if (sr.interior) s.add(sr.id);
  return s;
}

function main(): void {
  const argv = process.argv.slice(2);
  let dirA = join(ROOT, ".espejo-3c");
  let dirB = join(ROOT, ".espejo-3d");
  let phase: string | null = null;
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--a") dirA = argv[++i]!.startsWith("/") ? argv[i]! : join(ROOT, argv[i]!);
    else if (argv[i] === "--b") dirB = argv[++i]!.startsWith("/") ? argv[i]! : join(ROOT, argv[i]!);
    else if (argv[i] === "--phase") phase = argv[++i]!;
  }

  const parts = readdirSync(dirB)
    .filter((f) => f.endsWith(".transcript.json"))
    .map((f) => f.replace(".transcript.json", ""))
    .sort();

  const totA = { matched: 0, comparable: 0, combat: 0, sala: 0 };
  const totB = { matched: 0, comparable: 0, combat: 0, sala: 0 };
  let pares = 0;
  let mejoran = 0;
  let empeoran = 0;
  let declinadas = 0;
  const rows: string[] = [];

  for (const part of parts) {
    const fa = join(dirA, `${part}.transcript.json`);
    const fb = join(dirB, `${part}.transcript.json`);
    if (!existsSync(fa) || !existsSync(fb)) continue;
    const ta = JSON.parse(readFileSync(fa, "utf8")) as Record<string, string[]>;
    const tb = JSON.parse(readFileSync(fb, "utf8")) as Record<string, string[]>;
    const dA = drivenSet(dirA, part);
    const dB = drivenSet(dirB, part);
    const route = loadRoute(part, routesFor(part));
    for (const seg of route.segments as Segment[]) {
      if (!seg.openedBy) continue;
      if (phase && String(seg.openedBy) !== phase) continue;
      const la = ta[seg.id];
      const lb = tb[seg.id];
      if (!la || !la.length || !lb || !lb.length) continue; // el par tiene que existir en LOS DOS
      const a = measure(seg, la, dA.has(seg.id));
      const b = measure(seg, lb, dB.has(seg.id));
      pares++;
      totA.matched += a.matched; totA.comparable += a.comparable; totA.combat += a.combat; totA.sala += a.sala;
      totB.matched += b.matched; totB.comparable += b.comparable; totB.combat += b.combat; totB.sala += b.sala;
      const ra = a.comparable ? a.matched / a.comparable : 0;
      const rb = b.comparable ? b.matched / b.comparable : 0;
      if (rb > ra) mejoran++;
      else if (rb < ra) empeoran++;
      if (!b.driven) declinadas++;
      // ⚠ el denominador es el DISCRIMINADOR: cae ⇒ conformidad comprada encogiéndolo
      const dc = b.comparable - a.comparable;
      const flag = dc < -Math.max(3, a.comparable * 0.1) ? "  ⚠ DENOMINADOR CAE" : rb < ra ? "  ← empeora" : "";
      rows.push(
        `  ${seg.id.padEnd(10)} [${seg.openedBy}] ${a.driven ? "cond" : "sin "} ${String(a.matched).padStart(4)}/${String(a.comparable).padEnd(5)} ${pc(a.matched, a.comparable).padStart(6)}` +
          `  →  ${b.driven ? "cond" : "sin "} ${String(b.matched).padStart(4)}/${String(b.comparable).padEnd(5)} ${pc(b.matched, b.comparable).padStart(6)}` +
          `  Δcomp=${dc >= 0 ? "+" : ""}${dc}${flag}`,
      );
    }
  }

  console.log(`\n===== PAREADO: ${dirA.split("/").pop()} → ${dirB.split("/").pop()}${phase ? ` (fase ${phase})` : ""} =====\n`);
  console.log(rows.join("\n"));
  const rA = totA.comparable ? totA.matched / totA.comparable : 0;
  const rB = totB.comparable ? totB.matched / totB.comparable : 0;
  console.log(`\n  ${pares} pares (mismo segmento en los dos runs; los que faltan en uno se DESCARTAN)`);
  console.log(`  ANTES   ${totA.matched}/${totA.comparable} = ${pc(totA.matched, totA.comparable)}   combate=${totA.combat} sala=${totA.sala}`);
  console.log(`  DESPUÉS ${totB.matched}/${totB.comparable} = ${pc(totB.matched, totB.comparable)}   combate=${totB.combat} sala=${totB.sala}`);
  console.log(`  factor = ×${rA ? (rB / rA).toFixed(2) : "—"}`);
  const dc = totB.comparable - totA.comparable;
  const pctDc = totA.comparable ? (100 * dc) / totA.comparable : 0;
  console.log(
    `\n  DISCRIMINADOR nº1 — denominador: ${totA.comparable} → ${totB.comparable} (${dc >= 0 ? "+" : ""}${dc}, ${pctDc.toFixed(1)}%). ` +
      (pctDc < -10
        ? "⚠ CAE >10%: la conformidad puede estar comprada ENCOGIENDO el denominador."
        : "OK: la mejora está en el NUMERADOR (que es la única forma honesta)."),
  );
  console.log(`  DISCRIMINADOR nº7 — costura declinada en el run nuevo: ${declinadas}/${pares} segmentos` + (pares && declinadas / pares > 0.8 ? "  ⚠ >80%: «la medida» sería el run sin conducir con otra etiqueta." : ""));
  console.log(`  reparto por segmento: ${mejoran} mejoran · ${empeoran} empeoran · ${pares - mejoran - empeoran} igual`);
  console.log("");
}

main();
