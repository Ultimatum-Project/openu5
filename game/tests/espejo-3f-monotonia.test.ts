/**
 * FASE 3f — LA GARANTÍA MONÓTONA, VERIFICADA (no declarada en prosa).
 *
 * El criterio de aceptación de 3f, por encima de cualquier porcentaje, es que los reconocedores
 * del corpus tardío **no puedan tocar el numerador**: puestos en la última posición del diff,
 * sólo deben convertir DIVERGENTE → no-comparable. Si un reconocedor se comiera un bloque que
 * el port SÍ dijo, la conformidad subiría borrando conformidad real — la auto-absolución que el
 * doc de diseño marca como el riesgo serio de esta fase.
 *
 * Dos capas, a propósito:
 *  1. **SINTÉTICA** (siempre corre, sin material): un bloque de cada categoría que 3f reconoce,
 *     construido de forma que el port SÍ lo haya emitido. Si el reconocedor estuviera puesto
 *     ANTES del casado, se lo comería y estos tests caerían.
 *  2. **CORPUS ENTERO** (corre si `.espejo-lp1/` está presente; se salta si no, porque los
 *     transcripts son material pesado fuera del repo): para las 18 partes y todos sus segmentos
 *     con diff, `matched` con perfil `lp1-3f` debe ser EXACTAMENTE el de `lp1`, y cada bloque
 *     que era match/covered/fuzzy debe seguir siéndolo con el MISMO veredicto. Es más fuerte
 *     que «el numerador no baja»: el numerador no se mueve.
 */
import { describe, it, expect } from "vitest";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { diffSegment, loadRoute, ROUTES_DIR, type Segment } from "../e2e/espejo-tour/runner";
import { LP1_PROFILE, LP1_LATE_PROFILE, isLateStatusPanel, lateFold } from "../e2e/espejo-tour/ocr-profile";

const seg = (expectTexts: string[]): Segment =>
  ({
    id: "t-g01",
    ctx: "test",
    seam: null,
    script: [],
    expect: expectTexts.map((text, i) => ({ ocrLn: i + 1, text, class: "auto" })),
  }) as unknown as Segment;

const verdicts = (texts: string[], lines: string[], profile = LP1_LATE_PROFILE): string[] =>
  diffSegment(seg(texts), lines, profile).blocks.map((b) => b.verdict);

describe("3f · los reconocedores tardíos NO pueden robar un match", () => {
  it("panel de estado que el port SÍ emitió: sigue siendo match, no presentación", () => {
    // Si `isLateStatusPanel` actuara antes del casado, este bloque saldría `presentacion`.
    expect(isLateStatusPanel("Player: Min Status: None")).toBe(true);
    expect(verdicts(["Player: Min Status: None"], ["Player: Min Status: None"])).toEqual(["match"]);
  });

  it("línea de combate que el port SÍ emitió: 3f no le cambia el veredicto", () => {
    // Sale `rng` y no `match` por el LP1 histórico: `RNG_AUTO` ya la declara RNG del mundo ANTES
    // de casar (runner.ts, `cls === "rng"`). Lo que 3f tiene que garantizar no es que sea match,
    // sino que la palanca nueva **no la mueva** — y desde luego que no se la lleve a `combat-rng`.
    const t = ["Min, armed with Magic Axe:"];
    expect(verdicts(t, t, LP1_LATE_PROFILE)).toEqual(verdicts(t, t, LP1_PROFILE));
    expect(verdicts(t, t)).not.toContain("combat-rng");
  });

  it("flujo pendiente que el port SÍ emitió: sigue siendo match, no pending", () => {
    expect(verdicts(["Quit: Save game?"], ["Quit: Save game?"])).toEqual(["match"]);
  });

  it("y cuando el port NO lo dijo, sí se declasifican (el reconocedor existe de verdad)", () => {
    expect(verdicts(["Z-gtatg... P]aycr1 M[n 8tatuc: Uone"], ["North"])).toEqual(["presentacion"]);
    expect(verdicts(["Vlew a gem!"], ["North"])).toEqual(["pending"]);
    expect(verdicts(["Vro k][[ed!"], ["North"])).toEqual(["combat-rng"]);
  });

  it("con el perfil lp1 (identidad) esos mismos bloques siguen DIVERGENTES", () => {
    expect(verdicts(["Z-gtatg... P]aycr1 M[n 8tatuc: Uone"], ["North"], LP1_PROFILE)).toEqual(["divergent"]);
    expect(verdicts(["Vlew a gem!"], ["North"], LP1_PROFILE)).toEqual(["divergent"]);
  });
});

describe("3f · lo que se deja fuera A PROPÓSITO sigue en el denominador", () => {
  it("el verbo de transporte (hueco del PORT, MAINOUT 0x00DA) NO se retira", () => {
    // El binario imprime «Fly »/«Ride »/«Row » antes del rumbo; el port sólo el rumbo
    // (game.ts:958). Retirarlo sería auto-absolución.
    for (const t of ["F]v Nvrth", "Rvw Nvrth", "Ride East"])
      expect(verdicts([t], ["North"])).toEqual(["divergent"]);
  });

  it("rumbos a pie, Head y Pass (el port los emite) NO se retiran", () => {
    for (const t of ["8outh", "Eagt", "Hcad gouth", "Pagg"])
      expect(verdicts([t], ["Blocked!"])).toEqual(["divergent"]);
  });

  it("el panel con contenido REAL pegado no se barre (regla de vocabulario cerrado)", () => {
    expect(isLateStatusPanel("geurch-gvuth P]aycr: M[n Thou dogt find a wcaPvm!")).toBe(false);
    expect(verdicts(["geurch-gvuth P]aycr: M[n Thou dogt find a wcaPvm!"], ["North"])).toEqual(["divergent"]);
  });

  it("lateFold pliega la firma medida del corpus tardío", () => {
    expect(lateFold("Z-gtatg...")).toBe("z stats");
    // v/y→u: «Nvrth» y «North» NO caen en la misma forma (el plegado no toca la o), y no hace
    // falta que caigan — el rumbo no es vocabulario de 3f. Se asierta la firma REAL para que
    // nadie «arregle» el plegado hacia el casado de rumbos, que sería relajación.
    expect(lateFold("Nvrth")).toBe("nurth");
    expect(lateFold("Rcadv,,.")).toBe(lateFold("Ready..."));
  });
});

// ---------------------------------------------------------------- corpus entero
const DIR = join(__dirname, "..", "..", ".espejo-lp1");
const hasCorpus = existsSync(DIR);

describe.skipIf(!hasCorpus)("3f · MONOTONÍA sobre el corpus congelado (.espejo-lp1)", () => {
  // ~18 s: son 19 398 bloques diffeados DOS veces (perfil base y perfil 3f). El timeout va
  // explícito porque con el default de 5 s el barrido muere a mitad y el fallo parece de la
  // garantía cuando es del reloj.
  it("el numerador NO se mueve y ningún match cambia de veredicto, en las 18 partes", { timeout: 180_000 }, () => {
    const parts = readdirSync(DIR)
      .filter((f) => f.endsWith(".transcript.json"))
      .map((f) => f.replace(".transcript.json", ""))
      .sort();
    expect(parts.length).toBeGreaterThan(0);
    const MATCHY = new Set(["match", "covered", "fuzzy", "gap-cerrado"]);
    let bloques = 0;
    let robados = 0;
    for (const part of parts) {
      const route = loadRoute(part, ROUTES_DIR);
      const tr = JSON.parse(readFileSync(join(DIR, `${part}.transcript.json`), "utf8")) as Record<string, string[]>;
      for (const s of route.segments) {
        if (s.skip != null) continue;
        const lines = tr[s.id];
        if (!lines) continue;
        const base = diffSegment(s, lines, LP1_PROFILE);
        const late = diffSegment(s, lines, LP1_LATE_PROFILE);
        // el numerador del segmento, EXACTO (no «no baja»: no se mueve)
        expect(late.matched, `${part}/${s.id} numerador`).toBe(base.matched);
        expect(late.blocks.length).toBe(base.blocks.length);
        for (let i = 0; i < base.blocks.length; i++) {
          bloques++;
          const bv = base.blocks[i]!.verdict;
          const lv = late.blocks[i]!.verdict;
          if (MATCHY.has(bv)) {
            if (bv !== lv) robados++;
            expect(lv, `${part}/${s.id} bloque ${i} era ${bv}`).toBe(bv);
          } else if (bv !== "divergent") {
            // lo que NO era divergente ni match tampoco se toca (pending, rng, presentación…)
            expect(lv, `${part}/${s.id} bloque ${i} no-comparable ${bv}`).toBe(bv);
          }
        }
      }
    }
    expect(robados).toBe(0);
    // Suelo de MATERIAL, no adorno: si el barrido dejara de ver el corpus (ruta mal montada,
    // symlink roto), pasaría en verde con 0 bloques y la garantía sería vacía. Medido: 19 398
    // bloques en los segmentos con diff de las 18 partes.
    expect(bloques).toBeGreaterThan(19000);
  });
});
