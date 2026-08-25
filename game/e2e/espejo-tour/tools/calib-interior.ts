/**
 * DESCOMPOSICIÓN OFFLINE DE LA MÉTRICA DE INTERIORES (Fases 3c/3d).
 *
 * Hermano de `calib-offline.ts`, con la misma virtud: `diffSegment` es PURO, así que sobre un
 * transcript CONGELADO (`ESPEJO_DUMP=1`) se re-mide el interior con cualquier perfil sin gastar
 * la ventana playwright. Aquí lo que interesa no es un porcentaje suelto sino **de dónde sale**:
 *
 *   (a) MATERIAL NUEVO ABIERTO — segmentos que la fase anterior no medía. Suben comparables Y
 *       matcheados: es material que antes no estaba en juego en absoluto. La FASE que abrió cada
 *       interior viaja en la ruta (`openedBy`), y eso es lo que hace AUTOMÁTICA la separación.
 *   (b) PATRONES RETIRADOS — bloques de COMBATE que el port sí emite y el OCR de Diener escribe
 *       distinto. Bajan el denominador SIN tocar el numerador (los reconocedores van en la última
 *       posición del diff justo para garantizar eso).
 *
 * Las dos suben la conformidad y NO son la misma cosa. Mezclarlas sería exactamente el tipo de
 * número que este carril no reporta.
 *
 * ⚠ TRAMPA QUE ESTE BANCO TIENE QUE EVITAR (cazada al abrir 3d): el transcript congelado trae
 * líneas TAMBIÉN de los segmentos que aquel run SALTÓ. La rama de `skip` del runner pulsa las
 * `nav` del guion y captura la consola igual, así que un `post-combat` saltado deja 31 líneas de
 * «Turn left / Advance / Blocked!» — ecos REALES del port, pero producidos por flechas 2D
 * reinterpretadas dentro del 3D (la rotura nº2 de 3b), no por las ops `{dng}` derivadas.
 * Puntuar el material de 3d contra ESE transcript da un número que parece la medida de 3d y no
 * lo es. Se separa leyendo el `report.json` del mismo run: un segmento con `interior:true` fue
 * CONDUCIDO; el resto va a una fila aparte, etiquetada como lo que es — la LÍNEA BASE «sin
 * conducir», útil justo para saber cuánto añade el instrumento cuando el run en vivo llegue.
 *
 *   npx tsx game/e2e/espejo-tour/tools/calib-interior.ts --dir DIR [partes…]
 */
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { loadRoute, diffSegment, ROUTES_AD_DIR, ROUTES_DIR, type Segment } from "../runner";
import { AD_PROFILE, AD_PRE3C_PROFILE, type OcrProfile } from "../ocr-profile";

const HERE = dirname(fileURLToPath(import.meta.url));
const DEFAULT_DIR = join(HERE, "..", "..", "..", "..", ".espejo-3c");

/** Corpus de una parte por su PREFIJO (`adNN` → routes-ad, `partNN` → routes). Sin esto el banco
 *  sólo sabía leer AD y la NO-REGRESIÓN de LP1 no se podía comprobar con el mismo instrumento. */
const routesFor = (part: string): string => (part.startsWith("ad") ? ROUTES_AD_DIR : ROUTES_DIR);

interface Row {
  comparable: number;
  matched: number;
  divergent: number;
  combat: number;
  rosterTail: number;
  curated: number;
  sala: number;
  segs: number;
}
const zero = (): Row => ({ comparable: 0, matched: 0, divergent: 0, combat: 0, rosterTail: 0, curated: 0, sala: 0, segs: 0 });

function add(a: Row, seg: Segment, lines: string[], profile: OcrProfile): void {
  const d = diffSegment(seg, lines, profile);
  a.segs++;
  a.comparable += d.comparable;
  a.matched += d.matched;
  a.divergent += d.blocks.filter((b) => b.verdict === "divergent").length;
  a.combat += d.combatRng;
  a.rosterTail += d.combatRosterTail;
  a.curated += d.combatCurated;
  a.sala += d.salaDeferred;
}

const pc = (r: Row): string => (r.comparable ? ((r.matched / r.comparable) * 100).toFixed(1) + "%" : "—");
const show = (name: string, r: Row): string =>
  `${name.padEnd(30)} conf=${pc(r).padStart(6)}  ${String(r.matched).padStart(5)}/${String(r.comparable).padEnd(6)} ` +
  `div=${String(r.divergent).padStart(5)} combate=${String(r.combat).padStart(5)} (cola=${r.rosterTail} curado=${r.curated}) sala=${String(r.sala).padStart(4)} segs=${r.segs}`;

/** Fases en orden cronológico: cada una es material que la anterior NO medía. */
const PHASES = ["3b", "3c", "3d"] as const;

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

  // (a) el material de CADA fase, aislado, con el perfil vigente
  const byPhase: Record<string, Row> = Object.fromEntries(PHASES.map((p) => [p, zero()]));
  // (b) los pasillos de 3b medidos con el perfil de 3b vs con el vigente → aísla los patrones
  const base3b = zero();
  const base3bCal = zero();
  // el interior COMPLETO (lo que reporta la suite) — SÓLO material conducido
  const total = zero();
  // material abierto DESPUÉS de este run: su transcript NO viene de las ops `{dng}` (ver ⚠ arriba)
  const noConducido: Record<string, Row> = Object.fromEntries(PHASES.map((p) => [p, zero()]));

  for (const part of list) {
    const f = join(dir, `${part}.transcript.json`);
    if (!existsSync(f)) continue;
    const route = loadRoute(part, routesFor(part));
    const tr = JSON.parse(readFileSync(f, "utf8")) as Record<string, string[]>;
    // ¿qué segmentos CONDUJO aquel run como interior? (lo dice su propio reporte)
    const rf = join(dir, `${part}.report.json`);
    const driven = new Set<string>();
    if (existsSync(rf)) {
      const rep = JSON.parse(readFileSync(rf, "utf8")) as { segments?: Array<{ id: string; interior?: boolean }> };
      for (const sr of rep.segments ?? []) if (sr.interior) driven.add(sr.id);
    }
    for (const seg of route.segments) {
      const lines = tr[seg.id];
      if (!seg.openedBy || !lines || lines.length === 0) continue;
      const phase = String(seg.openedBy);
      if (!driven.has(seg.id)) {
        // abierto DESPUÉS de este run: el transcript no sale de las ops `{dng}` → línea base
        if (noConducido[phase]) add(noConducido[phase]!, seg, lines, AD_PROFILE);
        continue;
      }
      if (byPhase[phase]) add(byPhase[phase]!, seg, lines, AD_PROFILE);
      if (phase === "3b") {
        add(base3b, seg, lines, AD_PRE3C_PROFILE);
        add(base3bCal, seg, lines, AD_PROFILE);
      }
      add(total, seg, lines, AD_PROFILE);
    }
  }

  console.log(`\n===== INTERIORES: descomposición por FASE (${list.length} partes, transcript congelado de ${dir}) =====\n`);
  console.log(show("3b: pasillos, perfil 3b", base3b));
  console.log(show("  + (b) patrones de 3c", base3bCal));
  for (const p of PHASES) {
    const r = byPhase[p]!;
    if (r.segs === 0) continue;
    console.log(show(p === "3b" ? "(a) material 3b (pasillo)" : `(a) material NUEVO de ${p}`, r));
  }
  console.log(show("TOTAL interior (conducido)", total));
  for (const p of PHASES) {
    const r = noConducido[p]!;
    if (r.segs === 0) continue;
    console.log(
      show(`  [${p} SIN CONDUCIR]`, r) +
        "\n" +
        `${" ".repeat(30)}↑ abierto DESPUÉS de este run: su transcript viene de la rama SKIP (flechas 2D\n` +
        `${" ".repeat(30)}  dentro del 3D), NO de las ops {dng}. NO es la medida de esa fase — es la\n` +
        `${" ".repeat(30)}  LÍNEA BASE contra la que comparar el run en vivo.`,
    );
  }

  console.log(
    `\n  (b) PATRONES RETIRADOS  sobre los mismos pasillos de 3b: comparables ${base3b.comparable} → ${base3bCal.comparable} ` +
      `(${base3bCal.comparable - base3b.comparable}), matcheados ${base3b.matched} → ${base3bCal.matched} ` +
      `(${base3bCal.matched - base3b.matched} ← DEBE ser 0), conf ${pc(base3b)} → ${pc(base3bCal)}`,
  );
  for (const p of PHASES) {
    const r = byPhase[p]!;
    if (r.segs === 0 || p === "3b") continue;
    console.log(
      `  (a) MATERIAL NUEVO ${p}    ${r.segs} segmentos que las fases previas no medían: +${r.comparable} comparables, +${r.matched} matcheados, conf propia ${pc(r)}`,
    );
  }
  console.log(`  TOTAL                   ${pc(base3b)} (${base3b.matched}/${base3b.comparable}) → ${pc(total)} (${total.matched}/${total.comparable})\n`);
}

main();
