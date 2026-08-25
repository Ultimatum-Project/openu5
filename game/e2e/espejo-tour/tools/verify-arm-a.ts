/**
 * VALIDACIÓN DEL PAREADO DE 3d — ¿es `.espejo-3c` un BRAZO A legítimo?
 *
 * Todo el análisis de 3d descansa en una afirmación: que `.espejo-3c` y el run nuevo arrancan del
 * MISMO checkpoint y ejecutan las MISMAS teclas hasta el primer segmento de fase 3d, así que la
 * única diferencia entre ellos es la conducción de los `post-combat`. Si eso es cierto, el pareado
 * mide el efecto de conducir. Si no lo es, mide eso MÁS el ruido de cadena — que está medido en
 * **×2.00**, o sea MAYOR que el efecto que se busca (~×1.5). La diferencia entre un resultado y un
 * espejismo es exactamente esta comprobación.
 *
 * Cómo se comprueba, sin suponer nada: los segmentos ANTERIORES al primer `openedBy:"3d"` de cada
 * parte tienen que producir un transcript **byte a byte idéntico** en los dos runs. La suite ya
 * demostró que un run repetido desde el mismo checkpoint es reproducible byte a byte (ad21 del
 * relevo-4), así que cualquier diferencia ahí delata que el brazo A NO es válido.
 *
 * Se ejecuta ANTES de mirar ningún porcentaje. Si falla, el informe dice «pareado inválido» y no
 * da factor — no se rebaja el criterio para poder dar un número.
 *
 *   npx tsx game/e2e/espejo-tour/tools/verify-arm-a.ts [--a .espejo-3c] [--b .espejo-3d]
 *
 * ⚠ SEGUNDA FUNCIÓN (desde el fix de LOS del 2026-07-25): **detectar CONTAMINACIÓN POR CAMBIO DE
 * CORE AJENO**. El brazo A se grabó con una versión del core; si entre medias aterriza un fix que
 * cambia la MECÁNICA (no el instrumento del espejo), el brazo A y el B dejan de ser comparables —
 * el mismo confundido del ruido de cadena, pero introducido desde fuera del carril.
 *
 * El detector es el mismo (identidad byte a byte de los segmentos previos), pero hace falta saber
 * DÓNDE muerde: por eso se reporta además qué segmentos de interior del brazo A **resolvieron
 * combate** (`combatRounds > 0`), que es la superficie por la que un fix de combate puede entrar, y
 * si el chequeo de identidad los cubre o no. Un segmento con combate que quede DESPUÉS del primer
 * 3d no lo cubre nadie: se declara y sus comparables no entran en el factor.
 *
 * Exit 0 = pareado VÁLIDO. Exit 1 = inválido (o sin datos para decidirlo).
 */
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { loadRoute, ROUTES_AD_DIR, ROUTES_DIR, type Segment } from "../runner";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..", "..", "..", "..");
const routesFor = (part: string): string => (part.startsWith("ad") ? ROUTES_AD_DIR : ROUTES_DIR);
const abs = (p: string): string => (p.startsWith("/") ? p : join(ROOT, p));

function main(): void {
  const argv = process.argv.slice(2);
  let dirA = join(ROOT, ".espejo-3c");
  let dirB = join(ROOT, ".espejo-3d");
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--a") dirA = abs(argv[++i]!);
    else if (argv[i] === "--b") dirB = abs(argv[++i]!);
  }
  if (!existsSync(dirB)) {
    console.error(`no existe el run nuevo: ${dirB} (¿has corrido ya tools/run-3d.sh?)`);
    process.exit(1);
  }

  const parts = readdirSync(dirB)
    .filter((f) => f.endsWith(".transcript.json"))
    .map((f) => f.replace(".transcript.json", ""))
    .sort();

  let comparadas = 0;
  let invalidas = 0;
  let sinBrazoA = 0;
  let expuestos = 0;
  let cubiertosOK = 0;
  let sinCubrir = 0;
  const sinCubrirIds: string[] = [];

  for (const part of parts) {
    const fa = join(dirA, `${part}.transcript.json`);
    const fb = join(dirB, `${part}.transcript.json`);
    if (!existsSync(fa)) {
      console.log(`  ${part}: SIN BRAZO A en ${dirA.split("/").pop()} → cobertura, no da factor`);
      sinBrazoA++;
      continue;
    }
    const ta = JSON.parse(readFileSync(fa, "utf8")) as Record<string, string[]>;
    const tb = JSON.parse(readFileSync(fb, "utf8")) as Record<string, string[]>;
    const segs = loadRoute(part, routesFor(part)).segments as Segment[];
    const primer3d = segs.findIndex((s) => String(s.openedBy) === "3d");
    // SUPERFICIE DE CONTAMINACIÓN: segmentos de interior donde el port resolvió COMBATE en el
    // brazo A. Es por donde entra un fix de mecánica de combate (p.ej. el de LOS de proyectil).
    const repA = join(dirA, `${part}.report.json`);
    if (existsSync(repA)) {
      const rep = JSON.parse(readFileSync(repA, "utf8")) as { segments?: Array<{ id: string; interior?: boolean; comparable: number; combatRounds?: number }> };
      for (const sr of rep.segments ?? []) {
        if (!sr.interior || (sr.combatRounds ?? 0) === 0) continue;
        const i = segs.findIndex((s) => s.id === sr.id);
        const cubierto = primer3d >= 0 && i >= 0 && i < primer3d;
        expuestos += sr.comparable;
        if (cubierto) cubiertosOK += sr.comparable;
        else {
          sinCubrir += sr.comparable;
          sinCubrirIds.push(sr.id);
        }
        console.log(
          `  ${part}: ${sr.id} resolvió COMBATE en el brazo A (${sr.comparable} comparables) — ` +
            (cubierto ? "cubierto por la identidad byte a byte" : "⚠ NO cubierto: va DESPUÉS del primer 3d"),
        );
      }
    }
    if (primer3d < 0) {
      console.log(`  ${part}: no tiene segmentos 3d → nada que validar`);
      continue;
    }
    // sólo los segmentos ESTRICTAMENTE anteriores al primer 3d: de ahí en adelante la divergencia
    // es el EFECTO del tratamiento, no ruido, y comparar sería un error.
    const previos = segs.slice(0, primer3d);
    const difs: string[] = [];
    let vistos = 0;
    for (const seg of previos) {
      const a = ta[seg.id];
      const b = tb[seg.id];
      if (!a || !b) continue;
      vistos++;
      if (JSON.stringify(a) !== JSON.stringify(b)) difs.push(seg.id);
    }
    comparadas++;
    if (difs.length === 0) {
      console.log(`  ${part}: ✅ ${vistos} segmentos previos BYTE-IDÉNTICOS (primer 3d = ${segs[primer3d]!.id}) → pareado VÁLIDO`);
    } else {
      invalidas++;
      console.log(`  ${part}: ❌ ${difs.length}/${vistos} segmentos previos DIFIEREN (${difs.slice(0, 5).join(", ")}) → pareado INVÁLIDO`);
    }
  }

  console.log("");
  if (comparadas === 0) {
    console.log("VEREDICTO: no hay ninguna parte con brazo A → NO se puede dar factor, sólo cobertura.");
    process.exit(1);
  }
  if (invalidas > 0) {
    console.log(
      `VEREDICTO: PAREADO INVÁLIDO en ${invalidas}/${comparadas} partes. El run nuevo NO arranca del mismo estado\n` +
        `que ${dirA.split("/").pop()}, así que la diferencia incluye ruido de cadena (medido: ×2.00, MAYOR que el efecto\n` +
        `buscado). NO se reporta factor para esas partes — se reporta que el pareado no vale.`,
    );
    process.exit(1);
  }
  if (expuestos > 0) {
    console.log(
      `\nCONTAMINACIÓN POR CORE AJENO: ${expuestos} comparables del brazo A viven en segmentos que ` +
        `resolvieron COMBATE.\n  · ${cubiertosOK} los cubre la identidad byte a byte de arriba (si es verde, el fix fue INERTE ahí).` +
        (sinCubrir > 0
          ? `\n  · ⚠ ${sinCubrir} NO los cubre nadie (${sinCubrirIds.join(", ")}): van después del primer 3d.\n` +
            `    Esos comparables se DECLARAN y NO entran en el factor.`
          : ""),
    );
  }
  console.log(
    `VEREDICTO: PAREADO VÁLIDO en ${comparadas}/${comparadas} partes${sinBrazoA ? ` (+${sinBrazoA} de sola cobertura)` : ""}.\n` +
      `El efecto medido es atribuible a la CONDUCCIÓN de los post-combat y no al estado de la cadena.\n` +
      `Ahora sí: npx tsx game/e2e/espejo-tour/tools/calib-paired.ts --a ${dirA.split("/").pop()} --b ${dirB.split("/").pop()} --phase 3d`,
  );
}

main();
