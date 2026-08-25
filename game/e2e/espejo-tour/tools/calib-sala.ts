/**
 * DEBER PREVIO Nº1 DE 3d — ¿cuánto RETIRABA `sala-diferida` al clasificar antes de casar?
 *
 * `sala-diferida` retira del denominador de INTERIORES los bloques con firma de combate de
 * sala. Hasta 3c lo hacía en la PRIMERA posición del diff, o sea **antes de comprobar si el
 * port había dicho el bloque** — a diferencia de los patrones de 3c, que van en la última
 * posición justo para ser monótonos sobre `matched`. La deuda que 3c declaró: así podía
 * borrar conformidad REAL, y abrir los 209 `post-combat` (material de sala + pasillo mezclado)
 * habría multiplicado esa asimetría y dejado el número global ilegible.
 *
 * Este banco lo MIDE, no lo supone. Dos pasadas de `diffSegment` (que es PURO) sobre el MISMO
 * transcript congelado, con dos perfiles que difieren en UNA SOLA palanca
 * (`salaDeferredBeforeMatch`):
 *
 *   ad-pre3d  → sala clasificada ANTES de casar   (el comportamiento de 3b/3c)
 *   ad        → sala clasificada AL FINAL          (vigente desde 3d)
 *
 * Lo que hay que leer: **`matched` sólo puede SUBIR**. Cada match recuperado es un bloque que
 * el port SÍ emitió y que la posición vieja tiraba a `sala-diferida` sin mirar. Y el desglose
 * dice a qué veredicto se fueron los bloques que la sala ya no se queda (match/covered/fuzzy
 * recuperados vs los que siguen sin contraparte y ahora los recoge `combat-rng` o la propia
 * sala en su nueva posición).
 *
 *   npx tsx game/e2e/espejo-tour/tools/calib-sala.ts [--dir DIR] [partes…]
 */
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { loadRoute, diffSegment, ROUTES_AD_DIR, ROUTES_DIR, type Segment, type BlockResult } from "../runner";
import { AD_PROFILE, AD_PRE3D_PROFILE } from "../ocr-profile";

const HERE = dirname(fileURLToPath(import.meta.url));
const DEFAULT_DIR = join(HERE, "..", "..", "..", "..", ".espejo-3c");

/** Corpus de una parte por su PREFIJO (`adNN` → routes-ad, `partNN` → routes). Sin esto el banco
 *  sólo sabía leer AD y la NO-REGRESIÓN de LP1 no se podía comprobar con el mismo instrumento. */
const routesFor = (part: string): string => (part.startsWith("ad") ? ROUTES_AD_DIR : ROUTES_DIR);

interface Row {
  segs: number;
  comparable: number;
  matched: number;
  divergent: number;
  sala: number;
  combat: number;
}
const zero = (): Row => ({ segs: 0, comparable: 0, matched: 0, divergent: 0, sala: 0, combat: 0 });

function add(a: Row, blocks: BlockResult[], comparable: number, matched: number): void {
  a.segs++;
  a.comparable += comparable;
  a.matched += matched;
  a.divergent += blocks.filter((b) => b.verdict === "divergent").length;
  a.sala += blocks.filter((b) => b.verdict === "sala-diferida").length;
  a.combat += blocks.filter((b) => b.verdict === "combat-rng").length;
}

const pc = (r: Row): string => (r.comparable ? ((r.matched / r.comparable) * 100).toFixed(1) + "%" : "—");
const show = (name: string, r: Row): string =>
  `${name.padEnd(30)} conf=${pc(r).padStart(6)}  ${String(r.matched).padStart(4)}/${String(r.comparable).padEnd(5)} ` +
  `div=${String(r.divergent).padStart(5)} sala=${String(r.sala).padStart(4)} combate=${String(r.combat).padStart(5)} segs=${r.segs}`;

function main(): void {
  const argv = process.argv.slice(2);
  let dir = DEFAULT_DIR;
  const parts: string[] = [];
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--dir") dir = argv[++i]!;
    else parts.push(argv[i]!);
  }
  const list = parts.length
    ? parts
    : readdirSync(dir).filter((f) => f.endsWith(".transcript.json")).map((f) => f.replace(".transcript.json", "")).sort();

  const antes = zero();
  const ahora = zero();
  /** A qué veredicto se van, con la sala AL FINAL, los bloques que ANTES eran `sala-diferida`. */
  const destino: Record<string, number> = {};
  const ejemplos: string[] = [];

  for (const part of list) {
    const f = join(dir, `${part}.transcript.json`);
    if (!existsSync(f)) continue;
    const route = loadRoute(part, routesFor(part));
    const tr = JSON.parse(readFileSync(f, "utf8")) as Record<string, string[]>;
    for (const seg of route.segments as Segment[]) {
      const lines = tr[seg.id];
      if (!seg.openedBy || !lines || lines.length === 0) continue;
      const a = diffSegment(seg, lines, AD_PRE3D_PROFILE);
      const b = diffSegment(seg, lines, AD_PROFILE);
      add(antes, a.blocks, a.comparable, a.matched);
      add(ahora, b.blocks, b.comparable, b.matched);
      // el `expect` es el mismo array en las dos pasadas → los bloques van en el mismo orden
      a.blocks.forEach((blkA, i) => {
        if (blkA.verdict !== "sala-diferida") return;
        const blkB = b.blocks[i]!;
        destino[blkB.verdict] = (destino[blkB.verdict] ?? 0) + 1;
        if (blkB.verdict === "match" || blkB.verdict === "covered" || blkB.verdict === "fuzzy") {
          const src = (seg.expect.find((e) => e.ocrLn === blkA.ocrLn)?.text ?? "").replace(/\s+/g, " ").slice(0, 70);
          if (ejemplos.length < 12) ejemplos.push(`    [${blkB.verdict}] ${seg.id} ocr:${blkA.ocrLn}  «${src}»`);
        }
      });
    }
  }

  console.log(`\n===== SALA-DIFERIDA: antes/después de moverla a la última posición (${list.length} partes, ${dir}) =====\n`);
  console.log(show("ANTES  (ad-pre3d, sala arriba)", antes));
  console.log(show("AHORA  (ad, sala al final)", ahora));
  const dMatched = ahora.matched - antes.matched;
  console.log(
    `\n  matcheados  ${antes.matched} → ${ahora.matched}  (${dMatched >= 0 ? "+" : ""}${dMatched} ← DEBE ser ≥ 0: la palanca es monótona sobre matched)`,
  );
  console.log(`  comparables ${antes.comparable} → ${ahora.comparable}  (${ahora.comparable - antes.comparable})`);
  console.log(`  sala        ${antes.sala} → ${ahora.sala}  (${ahora.sala - antes.sala})`);
  console.log(`  conformidad ${pc(antes)} → ${pc(ahora)}`);
  console.log(`\n  DESTINO de los ${antes.sala} bloques que ANTES eran sala-diferida:`);
  for (const [v, n] of Object.entries(destino).sort((x, y) => y[1] - x[1])) console.log(`    ${v.padEnd(16)} ${n}`);
  if (ejemplos.length) {
    console.log(`\n  MATCHES RECUPERADOS (muestra) — bloques que el port SÍ dijo y la posición vieja tiraba:`);
    for (const e of ejemplos) console.log(e);
  }
  console.log("");
}

main();
