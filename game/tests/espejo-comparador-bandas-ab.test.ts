/**
 * A/B DEL COMPARADOR sobre TRANSCRIPTS CONGELADOS — el mismo sha, los mismos bytes, dos
 * comparadores.
 *
 * ★ POR QUÉ ASÍ Y NO CON DOS CORRIDAS. `diffSegment` es PURO y `ESPEJO_DUMP=1` existe justamente
 * para esto (`runner.ts`, `writeTranscript`). Re-corriendo el diff sobre el MISMO
 * `<parte>.transcript.json` con el perfil congelado `ad-pre-bandas` y con el vigente, el delta es
 * atribuible al comparador y **el ruido run-to-run del port es estructuralmente imposible** —
 * no hay dos corridas que puedan diferir. Es lo que hace que la advertencia de proyecto «excluye
 * o replica `ad06` para deltas ≤ ±3» no aplique aquí.
 *
 * Esto NO es un informe de una vez: es un GATE re-ejecutable. Se salta si no hay material
 * (`.espejo/VIEJO/` es derivado y gitignored), igual que `espejo-3f-monotonia.test.ts` se salta
 * sin `.espejo-lp1/`. Para regenerarlo, ver §REPRODUCIBILIDAD del acta.
 */
import { describe, it, expect, beforeAll } from "vitest";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { diffSegment, loadRoute, type Segment } from "../e2e/espejo-tour/runner";
import { ROUTES_AD_DIR } from "../e2e/espejo-tour/runner";
import { ROUTES_DIR } from "../e2e/espejo-tour/runner";
import {
  AD_PROFILE,
  AD_PRE_BANDAS_PROFILE,
  LP1_PROFILE,
  LP1_PRE_BANDAS_PROFILE,
  type OcrProfile,
} from "../e2e/espejo-tour/ocr-profile";

/**
 * DOS BANCOS, el mismo gate. El de AD y el de LP1 se miden con el MISMO código y los MISMOS
 * criterios: es la condición de SIMETRÍA del marco (un predicado estructural no puede depender del
 * corpus que mide), y la que el ruling del lead del 01-08 hizo obligatoria al extender la
 * exclusión de billetes a LP1.
 */
interface Banco {
  nombre: string;
  dump: string;
  routes: string;
  viejo: OcrProfile;
  nuevo: OcrProfile;
}
const BANCOS: Banco[] = [
  { nombre: "AD", dump: join(__dirname, "..", "..", ".espejo", "VIEJO"), routes: ROUTES_AD_DIR, viejo: AD_PRE_BANDAS_PROFILE, nuevo: AD_PROFILE },
  { nombre: "LP1", dump: join(__dirname, "..", "..", ".espejo", "LP1"), routes: ROUTES_DIR, viejo: LP1_PRE_BANDAS_PROFILE, nuevo: LP1_PROFILE },
];
const tieneMaterial = (b: Banco): boolean =>
  existsSync(b.dump) && readdirSync(b.dump).some((f) => f.endsWith(".transcript.json"));

/** clases que el comparador cuenta en el denominador */
const COMPARABLE = new Set(["match", "covered", "fuzzy", "divergent"]);
const lado = (v: string): "BUENO" | "FALLA" | "FUERA" =>
  !COMPARABLE.has(v) ? "FUERA" : v === "divergent" ? "FALLA" : "BUENO";

interface Celda {
  part: string;
  seg: string;
  ocrLn: number;
  a: { v: string; c: string };
  b: { v: string; c: string };
}

const partesConDump = (b: Banco): string[] =>
  readdirSync(b.dump)
    .filter((f) => f.endsWith(".transcript.json"))
    .map((f) => f.replace(".transcript.json", ""))
    .sort();

/** corre las dos ramas del A/B sobre todo el material congelado. */
function ab(banco: Banco): {
  celdas: Celda[];
  enSmallmap: Set<string>;
  tot: Record<"A" | "B", { m: number; c: number }>;
  porParte: Record<string, { am: number; ac: number; bm: number; bc: number; outcome: number; saludo: number; outcomeInt: number; saludoInt: number }>;
} {
  const celdas: Celda[] = [];
  const enSmallmap = new Set<string>();
  const tot = { A: { m: 0, c: 0 }, B: { m: 0, c: 0 } };
  const porParte: Record<string, { am: number; ac: number; bm: number; bc: number; outcome: number; saludo: number; outcomeInt: number; saludoInt: number }> = {};
  for (const part of partesConDump(banco)) {
    const trans = JSON.parse(readFileSync(join(banco.dump, `${part}.transcript.json`), "utf8")) as Record<string, string[]>;
    const route = loadRoute(part, banco.routes);
    const bySeg = new Map<string, Segment>((route.segments as Segment[]).map((s) => [s.id, s]));
    // ★ LA POBLACIÓN LA MANDA EL REPORT VIVO, no el dump. El volcado guarda `portLines` de TODOS
    // los segmentos de la ruta, incluidos los que el runner SALTA (`skip`, `todos`), que el
    // comparador vivo nunca difunde. Difundirlos aquí medía otra población: el control de
    // calibración lo cazó (`ad20` daba 81/1096 contra los 5/57 del report). Se replica sólo lo
    // que el report declara haber difundido, y el `interior` se toma de él —no de `seg.openedBy`—
    // porque es `runSegment` quien lo decide.
    const vivo = JSON.parse(readFileSync(join(banco.dump, `${part}.report.json`), "utf8")) as {
      segments: Array<{ id: string; interior?: boolean; blocks: unknown[] }>;
    };
    const difundidos = new Map(vivo.segments.filter((x) => x.blocks.length > 0).map((x) => [x.id, !!x.interior]));
    const acc = { am: 0, ac: 0, bm: 0, bc: 0, outcome: 0, saludo: 0, outcomeInt: 0, saludoInt: 0 };
    for (const [segId, lines] of Object.entries(trans)) {
      const seg = bySeg.get(segId);
      if (!seg || !difundidos.has(segId)) continue;
      const esInterior = difundidos.get(segId)!;
      const run = (p: OcrProfile) => diffSegment(seg, lines, p);
      const A = run(banco.viejo);
      const B = run(banco.nuevo);
      // sólo la métrica de SMALLMAP (los interiores van por su propia línea, ruling del lead)
      if (!esInterior) enSmallmap.add(`${part}|${segId}`);
      if (!esInterior) {
        acc.am += A.matched;
        acc.ac += A.comparable;
        acc.bm += B.matched;
        acc.bc += B.comparable;
        // los contadores van SMALLMAP, como el Δc de al lado: mezclar los de interior hacía que
        // la columna «excluido» no cuadrara con la columna «Δc» y pareciera un descuadre.
        acc.outcome += B.combatOutcomeRng;
        acc.saludo += B.shopGreetingRng;
      } else {
        acc.outcomeInt += B.combatOutcomeRng;
        acc.saludoInt += B.shopGreetingRng;
      }
      for (let i = 0; i < A.blocks.length; i++) {
        const a = A.blocks[i]!;
        const b = B.blocks[i]!;
        expect(a.ocrLn).toBe(b.ocrLn); // los dos brazos ven los MISMOS bloques, en el mismo orden
        if (a.verdict !== b.verdict || a.class !== b.class) {
          celdas.push({ part, seg: segId, ocrLn: a.ocrLn, a: { v: a.verdict, c: a.class }, b: { v: b.verdict, c: b.class } });
        }
      }
    }
    porParte[part] = acc;
    tot.A.m += acc.am;
    tot.A.c += acc.ac;
    tot.B.m += acc.bm;
    tot.B.c += acc.bc;
  }
  return { celdas, enSmallmap, tot, porParte };
}

for (const banco of BANCOS) {
  describe.skipIf(!tieneMaterial(banco))(`A/B del comparador · corpus ${banco.nombre} · transcripts congelados`, () => {
  // El banco vive en .espejo/ (gitignored, material derivado de corridas): sin él la suite
  // SALTA declarándolo por el skipIf de arriba. PERO el cuerpo del describe corre igual
  // durante la colección de vitest (skipIf marca los tests, no evita el callback), así que
  // el A/B se computa en beforeAll — que sí respeta el skip. Sin esto, un árbol sin bancos
  // (p. ej. main tras retirar el worktree de la ventana) revienta por ENOENT en colección.
  // Regenerar bancos: bash re/tools/run_brazo_espejo.sh <worktree> <puerto> <parte> <TAG>
  let r!: ReturnType<typeof ab>;
  beforeAll(() => {
    r = ab(banco);
  });

  it("imprime el A/B descompuesto (el entregable de la ventana)", () => {
    const pct = (m: number, c: number): string => (c ? ((100 * m) / c).toFixed(1) + "%" : "—");
    console.log(`\n### A/B — ${partesConDump(banco).length} partes, MISMOS transcripts, dos comparadores`);
    console.log("parte     VIEJO m/c            NUEVO m/c            Δm     Δc   | excl-desenlace excl-saludo");
    for (const [p, v] of Object.entries(r.porParte)) {
      console.log(
        `${p.padEnd(9)} ${`${v.am}/${v.ac}`.padEnd(12)} ${pct(v.am, v.ac).padStart(6)}  ${`${v.bm}/${v.bc}`.padEnd(12)} ${pct(v.bm, v.bc).padStart(6)}  ` +
          `${(v.bm - v.am >= 0 ? "+" : "") + (v.bm - v.am)}`.padStart(5) +
          `${(v.bc - v.ac >= 0 ? "+" : "") + (v.bc - v.ac)}`.padStart(6) +
          ` |${String(v.outcome).padStart(9)}${String(v.saludo).padStart(13)}`,
      );
    }
    console.log(
      `TOTAL     ${`${r.tot.A.m}/${r.tot.A.c}`.padEnd(12)} ${pct(r.tot.A.m, r.tot.A.c).padStart(6)}  ` +
        `${`${r.tot.B.m}/${r.tot.B.c}`.padEnd(12)} ${pct(r.tot.B.m, r.tot.B.c).padStart(6)}  ` +
        `${(r.tot.B.m - r.tot.A.m >= 0 ? "+" : "") + (r.tot.B.m - r.tot.A.m)}`.padStart(5) +
        `${(r.tot.B.c - r.tot.A.c >= 0 ? "+" : "") + (r.tot.B.c - r.tot.A.c)}`.padStart(6),
    );

    // ── DESCOMPOSICIÓN del delta, bloque a bloque, por MECANISMO
    const porMec: Record<string, Celda[]> = {};
    for (const c of r.celdas) {
      const k =
        c.b.c === "combat-outcome-rng"
          ? "EXCLUSIÓN desenlace de combate curado"
          : c.b.c === "shop-greeting-rng"
            ? "EXCLUSIÓN saludo de tienda"
            : lado(c.a.v) === lado(c.b.v)
              ? `sólo ETIQUETA (${c.a.v}→${c.b.v})`
              : `ROBUSTECIMIENTO ${c.a.v}→${c.b.v}`;
      (porMec[k] ??= []).push(c);
    }
    console.log(`\n### LOS ${r.celdas.length} BLOQUES QUE SE MUEVEN, POR MECANISMO`);
    for (const [k, v] of Object.entries(porMec).sort((x, y) => y[1].length - x[1].length)) {
      console.log(`  ${String(v.length).padStart(4)}  ${k}`);
    }
    console.log(`\n### LOS QUE VIENEN DE UN VEREDICTO BUENO (los que CUESTAN cifra)`);
    for (const c of r.celdas.filter((x) => lado(x.a.v) === "BUENO" && lado(x.b.v) !== "BUENO")) {
      console.log(`  ${c.part} ${c.seg} ln${c.ocrLn}  ${c.a.v}[${c.a.c}] → ${c.b.v}[${c.b.c}]`);
    }
    expect(r.celdas.length).toBeGreaterThan(0);
  });

  // ── C1 del pre-registro: TODO el delta del denominador vive en las clases nuevas ─────────
  it("C1 · todo bloque que SALE del denominador lo hace por una de las DOS clases nuevas", () => {
    const salen = r.celdas.filter((c) => lado(c.a.v) !== "FUERA" && lado(c.b.v) === "FUERA");
    const ajenos = salen.filter((c) => c.b.c !== "combat-outcome-rng" && c.b.c !== "shop-greeting-rng");
    expect(ajenos.map((c) => `${c.part} ${c.seg} ln${c.ocrLn} ${c.a.v}→${c.b.v}[${c.b.c}]`)).toEqual([]);
  });

  it("C1 · Δcomparable = −(los que SALEN) + (los que ENTRAN), y cada dirección tiene UN dueño", () => {
    // La identidad ingenua «Δcomparable = −(todo lo excluido)» es FALSA y lo fue al medirla: la
    // mayoría de los desenlaces curados YA estaban fuera del denominador en el brazo viejo (los
    // recogía `combatOverridesCuratedClass` al final), así que excluirlos antes de casar no mueve
    // la cifra — sólo la hace SIMÉTRICA. Lo que hay que exigir es el balance por dirección:
    const smallmap = new Set(
      r.celdas.filter((c) => r.enSmallmap.has(`${c.part}|${c.seg}`)).map((c) => c),
    );
    const salen = [...smallmap].filter((c) => lado(c.a.v) !== "FUERA" && lado(c.b.v) === "FUERA");
    const entran = [...smallmap].filter((c) => lado(c.a.v) === "FUERA" && lado(c.b.v) !== "FUERA");
    expect(r.tot.A.c - r.tot.B.c).toBe(salen.length - entran.length);
    // SALIR del denominador sólo pueden hacerlo las dos clases nuevas (el criterio del encargo)…
    expect(salen.filter((c) => c.b.c !== "combat-outcome-rng" && c.b.c !== "shop-greeting-rng")).toEqual([]);
    // …y ENTRAR sólo puede hacerlo el robustecimiento: una exclusión jamás mete nada al denominador.
    expect(entran.filter((c) => c.b.c === "combat-outcome-rng" || c.b.c === "shop-greeting-rng")).toEqual([]);
  });

  // ── ANCLAS DE LEDGER: las exclusiones NO PUEDEN tocarlas, y se comprueba ────────────────
  // Ruling del lead (01-08) al extender la exclusión a LP1: «verifica que los DOS deltas de
  // ledger verdes (part04 +36, part05 −954) quedan intactos: son anclas de LEDGER, no de
  // conformidad». El argumento estructural es que `ledgerDelta` NO se deriva de los bloques —lo
  // mide `runSegment` del oro del port antes/después de la transacción— así que ninguna palabra
  // de `diffSegment` puede moverlo. Pero «no puede» se comprueba, no se declara.
  it("★ los deltas de LEDGER de la corrida siguen CUADRANDO (expected = got)", () => {
    const vistos: string[] = [];
    for (const part of partesConDump(banco)) {
      const rep = JSON.parse(readFileSync(join(banco.dump, `${part}.report.json`), "utf8")) as {
        ledger?: { ledgerDeltas?: Array<{ seg: string; expected: number; got: number; match: boolean }> };
      };
      for (const d of rep.ledger?.ledgerDeltas ?? []) {
        vistos.push(`${d.seg} ${d.expected >= 0 ? "+" : ""}${d.expected}`);
        expect(`${d.seg} exp=${d.expected} got=${d.got}`).toBe(`${d.seg} exp=${d.expected} got=${d.expected}`);
        expect([d.seg, d.match]).toEqual([d.seg, true]);
      }
    }
    if (banco.nombre === "LP1") {
      // los DOS que el lead nombra tienen que estar EN la corrida: si no aparecieran, este test
      // sería un verde vacío que no vigila nada.
      expect(vistos).toContain("part04-g03 +36");
      expect(vistos).toContain("part05-g05 -954");
    }
    console.log(`\n  [${banco.nombre}] anclas de ledger verificadas: ${vistos.join(" · ") || "(ninguna en estas partes)"}`);
  });

  it("C3 · el ROBUSTECIMIENTO es MONODIRECCIONAL: nunca convierte un casado en divergente", () => {
    const malos = r.celdas.filter(
      (c) => c.b.c !== "combat-outcome-rng" && c.b.c !== "shop-greeting-rng" && lado(c.a.v) === "BUENO" && lado(c.b.v) === "FALLA",
    );
    expect(malos.map((c) => `${c.part} ${c.seg} ln${c.ocrLn} ${c.a.v}→${c.b.v}`)).toEqual([]);
  });

  // ── CALIBRACIÓN DEL ARNÉS: el replay offline tiene que REPRODUCIR el report en vivo ──────
  // Sin esto, todo lo de arriba mide un comparador de mentira. Los reports de la corrida traen
  // el brazo que estuviera vivo cuando corrió cada parte, y el `ocrProfile`/los contadores nuevos
  // dicen CUÁL era: se compara cada parte contra el brazo que le toca, no contra el que conviene.
  // ══════════════════════════════════════════════════════════════════════════════════════
  // CALIBRACIÓN DEL ARNÉS. Sin esto, todo lo de arriba mediría un comparador de mentira — y ya
  // cazó un fallo real: la primera versión difundía TODOS los segmentos del volcado, incluidos
  // los que el runner salta, y daba `ad20` 81/1096 contra los 5/57 del report.
  it.skipIf(banco.nombre !== "AD")("★★ el brazo VIEJO reproduce las cifras que OTRO CARRIL archivó, parte a parte", () => {
    // ★ El control fuerte no es contra mi propia corrida: es contra números publicados por otra
    // ventana, en otro worktree y otro día. `anclas-f4-acta.md` §6.2 (brazo DESPUÉS) y
    // `fichas-f1f2-acta.md` §1.2 / `espejo-conf` (brazo B) archivaron éstos:
    const ARCHIVADAS: Record<string, string> = {
      ad01: "160/608", // anclas-f4 §6.2 DESPUÉS
      ad03: "93/502", //  anclas-f4 §6.2 DESPUÉS
      ad04: "55/443", //  anclas-f4 §6.2 DESPUÉS
      ad07: "140/1083", // anclas-f4 §6.2 DESPUÉS
      ad20: "5/57", //    fichas-f1f2 §1.2 brazo B (y espejo-conf)
    };
    const obtenidas: Record<string, string> = {};
    for (const [part, esperada] of Object.entries(ARCHIVADAS)) {
      const v = r.porParte[part];
      if (!v) continue;
      obtenidas[part] = `${v.am}/${v.ac}`;
      expect(`${part} ${obtenidas[part]}`).toBe(`${part} ${esperada}`);
    }
    expect(Object.keys(obtenidas).length).toBeGreaterThanOrEqual(5);
  });

  it("★ cada report EN VIVO lo reproduce EXACTAMENTE uno de los dos brazos, y salen los dos", () => {
    // 🔴 DAÑO DECLARADO DE ESTA VENTANA: la corrida se lanzó ANTES de implementar y el árbol
    // cambió MIENTRAS corría, así que las 7 partes no comparten brazo. Se comprueba lo que se
    // puede comprobar —que ningún report vivo queda SIN explicar por uno de los dos brazos— y se
    // deja el reparto impreso. No se elige el brazo por conveniencia: se exige unicidad.
    const reparto: string[] = [];
    for (const part of partesConDump(banco)) {
      const rep = JSON.parse(readFileSync(join(banco.dump, `${part}.report.json`), "utf8"));
      const v = r.porParte[part]!;
      const vivo = `${rep.matched}/${rep.comparable}`;
      const casaViejo = `${v.am}/${v.ac}` === vivo;
      const casaNuevo = `${v.bm}/${v.bc}` === vivo;
      expect(`${part} vivo=${vivo} viejo=${v.am}/${v.ac} nuevo=${v.bm}/${v.bc}`).toBe(
        `${part} vivo=${vivo} viejo=${v.am}/${v.ac} nuevo=${v.bm}/${v.bc}`,
      );
      expect([part, casaViejo || casaNuevo]).toEqual([part, true]); // ninguno queda sin explicar
      reparto.push(`${part}:${casaViejo && casaNuevo ? "AMBOS(sin delta)" : casaViejo ? "VIEJO" : "NUEVO"}`);
    }
    console.log(`\n  brazo vivo de cada parte → ${reparto.join(" · ")}`);
    // DIENTES (sólo AD): su corrida cubrió los dos brazos porque el árbol cambió a mitad. La de
    // LP1 se lanzó con el árbol CONGELADO a propósito (el daño declarado de la primera entrega),
    // así que ahí todas las partes son del brazo VIEJO — y ESO es lo que se exige, porque un
    // report vivo del brazo nuevo significaría que el árbol volvió a moverse durante la corrida.
    const marcas = new Set(reparto.map((x) => x.split(":")[1]));
    if (banco.nombre === "AD") expect(marcas.has("VIEJO") && marcas.has("NUEVO")).toBe(true);
    else expect([...marcas].filter((m) => m === "NUEVO")).toEqual([]);
  });
  });
}
