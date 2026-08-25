/**
 * FASE 3f — CENSO de los bloques DIVERGENTES del corpus LP1 tardío (part07-24).
 *
 * Instrumento de DIAGNÓSTICO, no de medición: vuelca los divergentes agrupados por su forma
 * plegada para que los reconocedores de 3f se diseñen sobre EVIDENCIA CONTADA y no sobre una
 * intuición. Puro y offline (transcripts congelados de `.espejo-lp1/`).
 *
 *   npx tsx game/e2e/espejo-tour/tools/censo-3f.ts [--dir .espejo-lp1] [--top N] [parts…]
 *
 * `--sample N` imprime además N ejemplos crudos por racimo (el crudo importa: la firma del OCR
 * es lo que se está censando).
 */
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { loadRoute, diffSegment, ROUTES_DIR } from "../runner";
import { LP1_PROFILE } from "../ocr-profile";

/** Esqueleto de una línea para agrupar: minúsculas, dígitos→#, no-alfanumérico→espacio. */
const skeleton = (s: string): string =>
  s.toLowerCase().replace(/\d+/g, "#").replace(/[^a-z#]+/g, " ").trim().slice(0, 60);

function main(): void {
  const argv = process.argv.slice(2);
  let dir = ".espejo-lp1";
  let top = 40;
  let sample = 0;
  const parts: string[] = [];
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--dir") dir = argv[++i]!;
    else if (argv[i] === "--top") top = Number(argv[++i]);
    else if (argv[i] === "--sample") sample = Number(argv[++i]);
    else parts.push(argv[i]!);
  }
  const list = parts.length
    ? parts
    : readdirSync(dir).filter((f) => f.endsWith(".transcript.json")).map((f) => f.replace(".transcript.json", "")).sort();

  const clusters = new Map<string, { n: number; ex: string[] }>();
  let total = 0;
  let ghostish = 0; // bloques con la firma de SEGUNDA PASADA del OCR (espacios→`"`)
  let mudo = 0; // segmentos cuyo transcript del port estaba VACÍO
  for (const part of list) {
    if (!existsSync(join(dir, `${part}.transcript.json`))) continue;
    const route = loadRoute(part, ROUTES_DIR);
    const tr = JSON.parse(readFileSync(join(dir, `${part}.transcript.json`), "utf8")) as Record<string, string[]>;
    for (const seg of route.segments) {
      if (seg.skip != null) continue;
      const lines = tr[seg.id];
      if (!lines) continue;
      const d = diffSegment(seg, lines, LP1_PROFILE);
      for (const b of d.blocks) {
        if (b.verdict !== "divergent") continue;
        const src = seg.expect.find((e) => e.ocrLn === b.ocrLn);
        if (!src) continue;
        total++;
        if (lines.length === 0) mudo++;
        if (/[^\s"]"[^\s"]/.test(src.text)) ghostish++;
        const k = skeleton(src.text);
        const c = clusters.get(k) ?? { n: 0, ex: [] };
        c.n++;
        if (c.ex.length < Math.max(sample, 1)) c.ex.push(src.text.slice(0, 90));
        clusters.set(k, c);
      }
    }
  }
  const sorted = [...clusters.entries()].sort((a, b) => b[1].n - a[1].n);
  console.log(`DIVERGENTES: ${total} en ${list.length} partes · racimos distintos: ${sorted.length}`);
  console.log(`  con firma de SEGUNDA PASADA del OCR (\\S"\\S): ${ghostish} (${((ghostish / total) * 100).toFixed(1)}%)`);
  console.log(`  en segmentos con transcript del port VACÍO: ${mudo} (${((mudo / total) * 100).toFixed(1)}%)\n`);
  let acc = 0;
  sorted.slice(0, top).forEach(([k, c], i) => {
    acc += c.n;
    console.log(`${String(i + 1).padStart(3)}. ${String(c.n).padStart(5)}×  ${k}`);
    if (sample) for (const e of c.ex) console.log(`         │ ${JSON.stringify(e)}`);
  });
  console.log(`\ntop-${top} cubre ${acc}/${total} (${((acc / total) * 100).toFixed(1)}%)`);
}

main();
