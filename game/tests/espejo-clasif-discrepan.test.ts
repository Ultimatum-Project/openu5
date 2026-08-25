/**
 * LOS DOS CLASIFICADORES DE INTERIOR — SONDA COMMITEADA del censo de la discrepancia.
 * Pre-registro: `re/notes/clasif-discrepan-preregistro.md`.
 *
 * `mkoverlay-ad.mjs` (máquina `stepInterior`, ARRASTRE de estado entre segmentos y episodios) y
 * `derive-dungeon-ops.mjs` (filtro `ctx !== "dungeon" && !post-combat`, línea 651) contestan
 * distinto a «¿está la party dentro de una mazmorra?». Esta sonda MIDE esa discrepancia.
 *
 * ★ Por qué existe teniendo ya el censo B de `espejo-latentes-e2.test.ts`: aquél filtra por el
 * RÓTULO de la nota (`/interior-dng|entrada-dng/`) y da 7. El rótulo NO es una frontera de
 * mecanismo — las tres ramas de marcado de `mkoverlay-ad` (204/207/215) tratan igual a los 199
 * interiores, y el derivador no ve a ninguno de los que caen fuera de su `ctx`, tenga el `why`
 * que tenga. La población real de la discrepancia es 17, y 10 de ellos se los comió aquel regex.
 *
 * ★★ CALIBRACIÓN antes de medir: el primer test comprueba que la réplica del bucle de
 * `mkoverlay-ad` —importando su `stepInterior` REAL— reproduce SEGMENTO A SEGMENTO las notas
 * persistidas en el artefacto commiteado. Sin eso, los censos de abajo medirían mi bucle y no el
 * suyo ([[replica-del-test-no-es-el-test-la-fase]]).
 */
import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { stepInterior } from "../e2e/espejo-tour/tools/mkoverlay-ad.mjs";
import { CTX_NEUTRO, neutralInteriorProbe, resolveDungeonForPostCombat } from "../e2e/espejo-tour/tools/derive-dungeon-ops.mjs";
import { describeCorpusReal, PARTES_SINT, ROUTES_AD_DIR, ROUTES_DIR, ROUTES_SINT_DIR } from "./espejo-corpus";

const ROUTES_AD = ROUTES_AD_DIR;

interface Seg {
  id: string;
  ctx: string;
  note?: string;
  seam?: string | null;
  // campos CONCRETOS (sin índice `[k: string]`): así el mismo tipo vale para `stepInterior`
  // (`SegLike`) y para `neutralInteriorProbe` (`RouteLike`/`SegEnterLike`) sin castear
  enter?: {
    loc?: number | null;
    banner?: string;
    underworld?: boolean;
    dungeon?: boolean;
    carryover?: boolean;
    dungeonFrom?: string;
  };
  openedBy?: string;
  skip?: string | boolean;
  skipReason?: string;
  script?: Array<Record<string, unknown>>;
  expect?: Array<{ text: string }>;
}

function parts(): string[] {
  return readdirSync(ROUTES_AD)
    .filter((n) => n.endsWith(".route.json"))
    .map((n) => n.replace(".route.json", ""))
    .sort();
}

/** Copia EXACTA del acumulador de textos de `mkoverlay-ad.mjs` (`segTexts`, n = 8). */
function segTexts(seg: Seg, n = 8): string {
  const out: string[] = [];
  for (const b of seg.expect ?? []) {
    out.push(b.text);
    if (out.length >= n) break;
  }
  return out.join(" ");
}

interface Fila {
  id: string;
  ctx: string;
  why: string;
  ops: number;
  openedBy: string | null;
}

/**
 * Recorre `ad01..ad25` con el MISMO arrastre que `mkoverlay-ad.mjs` (el estado de interior CRUZA
 * episodios: ad09 acaba dentro de Destard y ad10 arranca ahí) y devuelve los segmentos que la
 * máquina deja en `inInterior`, con su `why` — que es lo que acaba en la nota del artefacto.
 */
function interiores(): Fila[] {
  const out: Fila[] = [];
  let inInterior = false;
  let why = "";
  let from = "boot";
  for (const part of parts()) {
    const route = JSON.parse(readFileSync(join(ROUTES_AD, `${part}.route.json`), "utf8")) as { segments: Seg[] };
    why = inInterior ? `${why}-arrastre-${from}` : "";
    for (const seg of route.segments) {
      const step = stepInterior(seg, segTexts(seg), { inInterior, why }) as { inInterior: boolean; why: string };
      ({ inInterior, why } = step);
      // rama 204 de mkoverlay: la costura Underworld la adjudicó #23 y NO se marca interior
      if (seg.enter?.underworld) {
        if (why === "entrada-dng") why = "interior-dng";
        continue;
      }
      if (inInterior) {
        out.push({
          id: seg.id,
          ctx: seg.ctx,
          why: why.replace(/-arrastre-.*$/, ""),
          ops: (seg.script ?? []).length,
          openedBy: seg.openedBy ?? null,
        });
        if (why === "entrada-dng") why = "interior-dng";
      }
    }
    why = why.replace(/-arrastre-.*$/, "");
    from = part;
  }
  return out;
}

/**
 * El dominio del escritor ANTES de esta ventana (`derive-dungeon-ops.mjs`, literal:
 * `ctx !== "dungeon" && !postCombat`). Se conserva a propósito para que el censo de la
 * DISCREPANCIA siga midiendo lo que el ticket enunció; el dominio de hoy es más ancho y lo
 * declara `CTX_NEUTRO`, que se importa de producción (nunca se copia: dos copias divergen).
 */
const esProcesado = (ctx: string) => ctx === "dungeon" || ctx === "post-combat";

/**
 * El corpus SINTÉTICO, cargado por su lista EN CRUDO (`PARTES_SINT`) y no por `readdir`: un
 * censo cuyo denominador sale del propio sujeto pasa en vacío el día que el directorio se
 * vacíe. [[un-censo-nunca-lleva-2-dev-null]]
 *
 * 🔴 Como todas las cargas de este fichero, se invoca DENTRO del `it`. Ninguna lectura de disco
 * puede vivir en carga de módulo ni en el cuerpo de un `describe` —vitest ejecuta ese cuerpo al
 * recolectar, también el de un `describe.skip`— o el ENOENT del árbol público se lleva por
 * delante el fichero entero.
 */
function rutasSint(): Array<{ id: string; route: { segments: Seg[] } }> {
  return PARTES_SINT.map((p) => ({
    id: p,
    route: JSON.parse(readFileSync(join(ROUTES_SINT_DIR, `${p}.route.json`), "utf8")) as { segments: Seg[] },
  }));
}

describeCorpusReal("clasificadores de interior — CALIBRACIÓN de la réplica contra el artefacto", () => {
  it("★★ la réplica de `stepInterior` reproduce SEGMENTO A SEGMENTO las notas persistidas", () => {
    const vivos = new Map(interiores().map((f) => [f.id, f.why]));
    let comprobados = 0;
    for (const part of parts()) {
      const route = JSON.parse(readFileSync(join(ROUTES_AD, `${part}.route.json`), "utf8")) as { segments: Seg[] };
      for (const seg of route.segments) {
        const enNota = /interior-dng|entrada-dng|sala-combate/.exec(seg.note ?? "")?.[0] ?? null;
        const enVivo = vivos.get(seg.id) ?? null;
        // `underworld` y `exit-ambiguo-dng` no llegan a la nota por la rama 204: fuera del careo
        if (enNota == null && enVivo != null && !/interior-dng|entrada-dng|sala-combate/.test(enVivo)) continue;
        expect(enVivo, `la réplica discrepa del artefacto en ${seg.id}`).toBe(enNota);
        comprobados++;
      }
    }
    expect(comprobados, "el careo no cubrió los 646 segmentos").toBe(646);
  });
});

describeCorpusReal("clasificadores de interior — CENSO de la discrepancia (población REAL)", () => {
  it("`stepInterior` deja 199 segmentos en interior: 87 con `why` de pasillo y 112 de sala", () => {
    const todos = interiores();
    expect(todos).toHaveLength(199);
    const porWhy = new Map<string, number>();
    for (const f of todos) porWhy.set(f.why, (porWhy.get(f.why) ?? 0) + 1);
    expect([...porWhy].sort()).toEqual([
      ["entrada-dng", 16],
      ["interior-dng", 71],
      ["sala-combate", 112],
    ]);
  });

  /*
   * ★ RECALIBRACIÓN DE OPS 2.014 → 2.010 (y 179 → 176 · 89 → 88 en los dos de `ad19`), con motivo
   * y sin tocar la POBLACIÓN, que sigue siendo 17. Las 4 ops que faltan no son ruido: son
   * EXACTAMENTE las que el guarda #54 retiró al entrar `ad19-g26` y `ad19-g33` en el dominio del
   * escritor, cuando la ventana `banner-ad19` curó el banner de `ad19-g17`. Son `ln7315`,
   * `ln7364` y `ln7443` de `g26` y `ln10532` de `g33` — las MISMAS cuatro que `latentes-e2-acta`
   * §1.1 nombró y que `clasif-discrepan` §6/P9 predijo en contrafactual. O sea: el cardinal se
   * mueve porque una predicción de dos actas atrás ACERTÓ, y este pin es donde se ve.
   */
  it("★★ fuera del `ctx` que el derivador procesa hay 17 segmentos y 1.998 ops, no los 7 del acta", () => {
    const fuera = interiores().filter((f) => !esProcesado(f.ctx));
    expect(fuera).toHaveLength(17);
    // 2010→1998 tras el re-colapso de tecleos parciales (fix-tecleos-parciales: −12 typed
    // fantasma en estos segmentos; los 17 segmentos no se mueven)
    expect(fuera.reduce((a, f) => a + f.ops, 0)).toBe(1998);
    // el subconjunto que el regex del acta de E-2 SÍ veía (`/interior-dng|entrada-dng/`)
    const delActa = fuera.filter((f) => f.why !== "sala-combate");
    expect(delActa.map((f) => `${f.id}[${f.ctx}]:${f.ops}`)).toEqual([
      "ad10-g01[start]:35",
      "ad19-g24[resume]:3",
      "ad19-g25[resume]:3",
      "ad19-g26[resume]:176",
      "ad19-g32[resume]:4",
      "ad19-g33[resume]:88",
      "ad20-g01[start]:415",
    ]);
    // 728 cuando `latentes-e2` lo midió; 724 hoy, y los 4 que faltan son las retiradas del
    // guarda #54 en `ad19-g26`/`g33` que aquella misma acta había predicho (ver el bloque de
    // arriba). La POBLACIÓN —los 7 segmentos— no se ha movido.
    expect(delActa.reduce((a, f) => a + f.ops, 0)).toBe(724);
    // ★ y los DIEZ que aquel filtro por rótulo se dejó fuera: mismo mecanismo, mismo silencio
    const perdidos = fuera.filter((f) => f.why === "sala-combate");
    expect(perdidos.map((f) => `${f.id}[${f.ctx}]:${f.ops}`)).toEqual([
      // 261→256 y (abajo) 617→610 tras el re-colapso de tecleos parciales (−5 y −7 typed
      // fantasma; la población de DIEZ segmentos no se mueve)
      "ad15-g10[resume]:256",
      "ad21-g01[start]:58",
      "ad21-g05[resume]:212",
      "ad24-g17[resume]:10",
      "ad24-g18[resume]:4",
      "ad24-g19[resume]:25",
      "ad25-g04[combat]:17",
      "ad25-g06[combat]:25",
      "ad25-g19[resume]:610",
      "ad25-g22[resume]:57",
    ]);
    expect(perdidos.reduce((a, f) => a + f.ops, 0)).toBe(1274); // 1286−12 (re-colapso, ver arriba)
  });

  it("★ la población ADJUDICABLE son los de `ctx` NEUTRO: 15 (los 2 de `ctx:combat` salen)", () => {
    const fuera = interiores().filter((f) => !esProcesado(f.ctx));
    const neutros = fuera.filter((f) => CTX_NEUTRO.has(f.ctx));
    const declarados = fuera.filter((f) => !CTX_NEUTRO.has(f.ctx));
    expect(neutros).toHaveLength(15);
    // 1968→1956 tras el re-colapso de tecleos parciales (misma docena de typed fantasma)
    expect(neutros.reduce((a, f) => a + f.ops, 0)).toBe(1956);
    // `combat` SÍ declara contexto (paréntesis de RNG, doctrina 3c/3d): el derivador acierta ahí
    expect(declarados.map((f) => f.id)).toEqual(["ad25-g04", "ad25-g06"]);
    expect(new Set(declarados.map((f) => f.ctx))).toEqual(new Set(["combat"]));
  });

  /*
   * ★ RECALIBRACIÓN 3 → 5, con motivo: la ventana `clasif-discrepan` abrió 3 de los 15 y dejó
   * DECLARADO por qué no abrían `ad19-g26` y `ad19-g33` — la SEGUNDA PUERTA de su §5, el banner
   * `WRUNG`≠`WRONG` de `ad19-g17`. La ventana `banner-ad19` curó ese banner y esos dos abrieron,
   * exactamente como su contrafactual había medido. Los otros 10 siguen cerrados por MATERIAL
   * (nunca por su `ctx`), que es lo que este test existe para vigilar.
   */
  it("de los 15, el derivador abre 5 — y los abre como `3d-neutro`, no como `3d`", () => {
    const neutros = interiores().filter((f) => !esProcesado(f.ctx) && CTX_NEUTRO.has(f.ctx));
    const abiertos = neutros.filter((f) => f.openedBy != null);
    expect(abiertos.map((f) => `${f.id}:${f.openedBy}`)).toEqual([
      "ad15-g10:3d-neutro",
      "ad19-g26:3d-neutro",
      "ad19-g33:3d-neutro",
      "ad24-g19:3d-neutro",
      "ad25-g22:3d-neutro",
    ]);
    // los otros 10 siguen cerrados, y NO por su `ctx`: por el material
    expect(neutros.filter((f) => f.openedBy == null)).toHaveLength(10);
  });
});

/**
 * ═══ LA COSTURA DE UNA RANURA NEUTRA ABIERTA — propiedad de la HERRAMIENTA ════════════════
 *
 * Una ranura NEUTRA (`post-combat`, `resume`, `start`) no declara lugar: la costura que la
 * corta es un `VICTORY!`, una acampada o el arranque de un episodio. Por eso, cuando el
 * derivador la abre, su costura **no puede ser la de 3b** —que teletransporta a la celda de
 * ENTRADA de la planta 0, donde a mitad de visita el LP no está— sino una `carryover`, que el
 * runner sólo COMPRUEBA. Eso es cierto de la herramienta, no de un corpus, y se instancia en
 * los dos.
 *
 * ⚠ EL PREDICADO SE ESCRIBE SOBRE EL `ctx` NEUTRO, NO SOBRE LA ETIQUETA `3d-neutro`, y el
 * cambio es deliberado: `openedBy` es un RÓTULO de fase y el rasgo que obliga a la costura
 * sintética es que la ranura **no declare lugar**. Medido al portarlo: `routes-sint/` tiene un
 * `sint06-g02` con `openedBy: "3d-neutro"` sobre un `ctx: "dungeon"` con costura
 * `dungeon-enter` REAL — una combinación que el derivador no produce (a un `ctx:dungeon` le
 * pone 3b/3c), y que con el predicado por rótulo habría dado un rojo que no es del sujeto.
 * [[el-rotulo-no-derivado-no-es-el-mecanismo]]
 */
function pruebaCosturaNeutra(corpus: () => Array<{ segments: Seg[] }>): void {
  it("★ toda RANURA NEUTRA abierta lleva costura CARRYOVER con mazmorra y procedencia — nunca teletransporte", () => {
    const segs = corpus()
      .flatMap((r) => r.segments)
      .filter((s) => s.openedBy && CTX_NEUTRO.has(s.ctx));
    // 🔴 guarda de población: sin ranuras neutras abiertas, el `for` de abajo pasa siempre
    expect(
      segs.length,
      "ninguna ranura neutra abierta en este corpus: la maquinaria de 3d/3d-neutro no se está ejercitando",
    ).toBeGreaterThan(0);
    for (const seg of segs) {
      const e = seg.enter as { loc?: number; dungeon?: boolean; carryover?: boolean; dungeonFrom?: string };
      expect(e, `${seg.id}: abierto sin costura`).toBeTruthy();
      expect(e.dungeon, `${seg.id}`).toBe(true);
      // sin `carryover` la costura de 3b teletransportaría a la celda de ENTRADA de la planta 0,
      // y a mitad de visita el LP no está ahí: sería FABRICAR posición
      expect(e.carryover, `${seg.id}: costura SIN carryover = teletransporte fabricado`).toBe(true);
      expect(e.loc! >= 33 && e.loc! <= 40, `${seg.id}: enter.loc=${e.loc} no es mazmorra`).toBe(true);
      expect(e.dungeonFrom, `${seg.id}: mazmorra sin procedencia declarada`).toBeTruthy();
      expect(seg.skip, `${seg.id}: abierto pero con skip`).toBeUndefined();
    }
  });
}

describe("clasificadores de interior — la costura de la ranura NEUTRA (corpus SINTÉTICO)", () => {
  pruebaCosturaNeutra(() => rutasSint().map((r) => r.route));
});

describeCorpusReal("clasificadores de interior — LO QUE EL CAMBIO NO PUEDE HACER (guardas)", () => {
  pruebaCosturaNeutra(() =>
    parts().map((part) => JSON.parse(readFileSync(join(ROUTES_AD, `${part}.route.json`), "utf8")) as { segments: Seg[] }),
  );

  /**
   * ★★ EL REGRESOR DE LA PODA. La primera corrida de este cambio, sin el gate de interior,
   * CERRÓ 51 segmentos que hoy se conducen (22 `start` —el arranque de cada episodio— y 29
   * `resume` de posada/overworld), porque la rama `else` de `enrichPart` hace
   * `if (!seg.skip) seg.skip = "pendiente-runner"`. 51 fuera del denominador de conformidad en
   * silencio. Este pin es lo que impide que vuelva.
   */
  it("★★ el derivador NO cierra ranuras neutras: sólo 12 de los 66 `resume`/`start` llevan `skip`", () => {
    let conSkip = 0;
    let total = 0;
    const porCtx: Record<string, number> = { resume: 0, start: 0 };
    for (const part of parts()) {
      const route = JSON.parse(readFileSync(join(ROUTES_AD, `${part}.route.json`), "utf8")) as { segments: Seg[] };
      for (const seg of route.segments) {
        if (seg.ctx !== "resume" && seg.ctx !== "start") continue;
        total++;
        if (seg.skip) {
          conSkip++;
          porCtx[seg.ctx]!++;
        }
      }
    }
    expect(total).toBe(66);
    // ★ 12 → 10 (ventana `banner-ad19`): `ad19-g26` y `ad19-g33` dejan de llevar `skip` porque
    // ABREN, no porque nadie los cierre. El regresor que este test vigila —la poda silenciosa de
    // 51— sigue midiendo lo mismo: lo que no puede pasar es que este número SUBA.
    expect(conSkip, "el derivador ha CERRADO ranuras neutras que se conducían").toBe(10);
    expect(porCtx).toEqual({ start: 3, resume: 7 });
  });

  /**
   * ★★ LA SEGUNDA PUERTA — **ADJUDICADA**, no ya sólo declarada.
   *
   * Este test pinaba el estado en que `clasif-discrepan` dejó la visita a Wrong de `ad19`: los 5
   * `resume` cerrados por MAZMORRA INDETERMINABLE, porque la costura `dungeon-enter` que abrió la
   * visita (`ad19-g17`) traía `loc: null` — su banner OCR quedó en «WRUNG A MAGIC CARPET SAVE
   * GAME YES», y `resolveBanner` no pliega `u↔o`, así que «WRUNG» nunca casó «WRONG» (36).
   *
   * La ventana `banner-ad19` CURÓ ese banner (`enter.loc = 36` por overlay, vía el aplicador
   * quirúrgico; ver `re/notes/banner-ad19-acta.md`). El test no se borra —documentaría un estado
   * que ya no existe y perderíamos la vigilancia— sino que se **invierte de polaridad**: lo que
   * antes probaba que la puerta estaba cerrada, ahora prueba que está cerrada POR EL LADO BUENO.
   *
   * ★ Los DIENTES se conservan intactos y por el mismo motivo: el veredicto se le pide EN VIVO al
   * predicado, no se lee del `skipReason` que el tool dejó escrito. Un mutante que colapsara
   * `indeterminable` en `fuera` sale por un `return` antes de tocar el artefacto, así que un test
   * que sólo mirara texto persistido pasaría sobre datos RANCIOS.
   */
  it("★★ la segunda puerta de `ad19` está ADJUDICADA: el banner resuelve y la visita entera es `dentro`", () => {
    const route = JSON.parse(readFileSync(join(ROUTES_AD, "ad19.route.json"), "utf8")) as { segments: Seg[] };
    const g17 = route.segments.find((s) => s.id === "ad19-g17")!;
    expect(g17.seam).toBe("dungeon-enter");
    // la CURACIÓN, con su evidencia: el `loc` adjudicado y el banner OCR CRUDO conservado — el
    // banner es lo que motiva la adjudicación, y sustituirlo por «WRONG» fingiría que el
    // segmentador casó cuando no casó
    expect(g17.enter?.loc, "la curación de `ad19-g17` se ha perdido").toBe(36);
    expect(g17.enter?.banner, "el banner OCR es la EVIDENCIA: no se reescribe").toBe("WRUNG A MAGIC CARPET SAVE GAME YES");

    // ★ VEREDICTO EN VIVO: los 5 `resume` de la visita ya no son `indeterminable` — son `dentro`,
    // con la mazmorra 36 y la procedencia citando la costura que abrió la visita.
    for (const id of ["ad19-g24", "ad19-g25", "ad19-g26", "ad19-g32", "ad19-g33"]) {
      const i = route.segments.findIndex((s) => s.id === id);
      const probe = neutralInteriorProbe(route, i);
      expect(probe.kind, `${id}: el veredicto VIVO`).toBe("dentro");
      expect((probe as { id: number }).id, `${id}: mazmorra`).toBe(36);
      expect((probe as { how: string }).how, `${id}: procedencia`).toBe("visita-abierta-en-ad19-g17");
    }

    // ★★ NADIE de la visita conserva ya un `skipReason` de INDETERMINABLE. El control es sobre la
    // RUTA ENTERA (no sobre los 5 nombrados): si el texto sobreviviera en cualquier otro segmento
    // sería un `skipReason` RANCIO, que es peor que ninguno.
    expect(route.segments.filter((s) => /INDETERMINABLE/.test(s.skipReason ?? "")).map((s) => s.id)).toEqual([
      // los DOS `post-combat` de overworld/naval ANTERIORES a la costura: ésos SÍ están fuera, y
      // su razón era y sigue siendo correcta (población del control: si fuera 0, el control no
      // distinguiría «se arregló» de «se borró el texto para todos»)
      "ad19-g03",
      "ad19-g07",
    ]);

    // ★ y de los 5, los que siguen cerrados lo están por MATERIAL, con la razón cambiada
    const cerrados = route.segments.filter((s) => ["ad19-g24", "ad19-g25", "ad19-g32"].includes(s.id));
    expect(cerrados).toHaveLength(3);
    for (const s of cerrados) expect(s.skipReason, `${s.id}`).toMatch(/no clasificable como pasillo/);
  });
});

describe("`neutralInteriorProbe` — los tres veredictos, sobre rutas SINTÉTICAS", () => {
  const dngEnter = (id: string, loc: number | null) => ({ id, ctx: "dungeon", enter: { loc, dungeon: true, banner: "DESPISE" } });
  const salida = (id: string) => ({ id, ctx: "overworld", enter: { overworld: true } });
  const resume = (id: string) => ({ id, ctx: "resume" });

  it("DENTRO: retrocediendo se llega a la costura de la visita sin cruzar salida", () => {
    const route = { segments: [dngEnter("g01", 34), resume("g02")] };
    expect(neutralInteriorProbe(route, 1)).toEqual({ kind: "dentro", id: 34, how: "visita-abierta-en-g01" });
  });

  it("FUERA: una SALIDA entre medias corta el retroceso (la acampada es de superficie)", () => {
    const route = { segments: [dngEnter("g01", 34), salida("g02"), resume("g03")] };
    expect(neutralInteriorProbe(route, 2)).toEqual({ kind: "fuera" });
  });

  it("FUERA: sin nada detrás (el `start` del episodio) — el derivador no cruza episodios", () => {
    expect(neutralInteriorProbe({ segments: [{ id: "g01", ctx: "start" }] }, 0)).toEqual({ kind: "fuera" });
  });

  it("★ INDETERMINABLE: la visita existe pero su costura no dejó loc de mazmorra (el caso `ad19-g17`)", () => {
    const route = { segments: [dngEnter("g01", null), resume("g02")] };
    expect(neutralInteriorProbe(route, 1)).toEqual({ kind: "indeterminable", desde: "g01", banner: "DESPISE" });
  });

  it("★ INDETERMINABLE también con una loc que NO es mazmorra (`ad20-g16/17` = COVE, loc 23)", () => {
    const route = { segments: [dngEnter("g01", 23), resume("g02")] };
    expect(neutralInteriorProbe(route, 1).kind).toBe("indeterminable");
  });

  it("★ la costura SINTÉTICA `carryover` se atraviesa como transparente (idempotencia)", () => {
    // si se aceptara como evidencia, la 2ª corrida resolvería contra lo que escribió la 1ª y la
    // procedencia iría cambiando de segmento en cada pasada
    const route = {
      segments: [dngEnter("g01", 34), { id: "g02", ctx: "post-combat", enter: { loc: 34, dungeon: true, carryover: true } }, resume("g03")],
    };
    expect(neutralInteriorProbe(route, 2)).toEqual({ kind: "dentro", id: 34, how: "visita-abierta-en-g01" });
  });

  it("la ranura `combat` NO es neutra: declara contexto y queda fuera del dominio", () => {
    expect([...CTX_NEUTRO].sort()).toEqual(["post-combat", "resume", "start"]);
    expect(CTX_NEUTRO.has("combat")).toBe(false);
    expect(CTX_NEUTRO.has("smallmap")).toBe(false);
    expect(CTX_NEUTRO.has("overworld")).toBe(false);
    expect(CTX_NEUTRO.has("shrine")).toBe(false);
  });
});

/*
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * ★★ EL GUARDA DE LA TERCERA INSTANCIA — un `skipReason` no puede AFIRMAR lo que no comprobó
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 *
 * Pre-registro: `re/notes/cola-probe-preregistro.md` §2/§3.
 *
 * El texto «este post-combat no es de interior» es una AFIRMACIÓN sobre dónde está la party, y
 * `enrichPart` lo escribía sin comprobarla: le bastaba `resolveDungeonForPostCombat() == null`,
 * que mezcla DOS causas —`fuera` (se cruzó una salida) e `indeterminable` (la visita existe pero
 * su costura no dejó id)—. En el segundo caso el texto es FALSO: el segmento SÍ es interior.
 *
 * Ya ha aparecido DOS veces:
 *   1ª — `ad19`, 22 segmentos (`banner-ad19-acta.md` §3). Lo arregló EL DATO (curar `enter.loc`),
 *        no el código, y su §9 dejó escrito que «en el siguiente banner corrupto volvería a mentir».
 *   2ª — censo de este carril: **14 vivos** en dos visitas (`ad11-g07..g11`, `ad20-g18..g26`) y
 *        **4 latentes** en LP1 (`part18-g14/16/17/18`), que nacerían en cuanto alguien re-derive.
 *
 * ★ LOS DIENTES: el veredicto se le pide EN VIVO a `neutralInteriorProbe`, no se lee del
 * `skipReason` persistido. Un guarda que sólo cruzara textos del artefacto pasaría en verde sobre
 * datos RANCIOS, que es justo el estado en que este defecto sobrevive.
 *
 * ★★ LA POBLACIÓN DE CONTROL NO ES 0 y por eso el guarda discrimina: 115 segmentos llevan ese
 * texto LEGÍTIMAMENTE (probe = `fuera`). Un guarda que exigiera «nadie lo lleva» no distinguiría
 * «se arregló» de «se borró el texto para todos» — el mismo criterio que el control de `ad19`.
 */
const ROUTES_LP1 = ROUTES_DIR;
const AFIRMA_FUERA = "este post-combat no es de interior";

function todosLosCorpus(): Array<{ corpus: string; route: { segments: Seg[] } }> {
  const out: Array<{ corpus: string; route: { segments: Seg[] } }> = [];
  for (const dir of [ROUTES_AD, ROUTES_LP1]) {
    for (const n of readdirSync(dir).filter((f) => f.endsWith(".route.json")).sort()) {
      out.push({ corpus: `${dir.endsWith("routes") ? "LP1" : "AD"}:${n}`, route: JSON.parse(readFileSync(join(dir, n), "utf8")) as { segments: Seg[] } });
    }
  }
  return out;
}

/** Cruza el TEXTO persistido con el veredicto VIVO del predicado, en el corpus que se le dé. */
function careoTextoVsProbe(
  corpus: () => Array<{ route: { segments: Seg[] } }>,
): { mienten: string[]; legitimos: string[] } {
  const mienten: string[] = [];
  const legitimos: string[] = [];
  for (const { route } of corpus()) {
    (route.segments ?? []).forEach((seg, i) => {
      if (!(seg.skipReason ?? "").includes(AFIRMA_FUERA)) return;
      const kind = neutralInteriorProbe(route, i).kind;
      if (kind === "fuera") legitimos.push(seg.id);
      else mienten.push(`${seg.id}[${kind}]`);
    });
  }
  return { mienten, legitimos };
}

/**
 * ★ El guarda, instanciado sobre el corpus SINTÉTICO — el que corre en el repositorio público.
 *
 * `routes-sint/` tiene DOS `post-combat` con el texto canónico de `fuera` (`sint01-g05` y
 * `sint04-g05`, escritos por el propio derivador), y en los dos el veredicto VIVO es `fuera`
 * porque entre ellos y la última visita hay una costura de SALIDA. Es el caso legítimo, y con
 * él el guarda tiene sujeto: si alguien colapsara `indeterminable` en `fuera` dentro del
 * predicado, este aserto es el que lo vería sin necesidad del corpus real.
 *
 * ✅ CABO CERRADO (25-08, en la misma ventana). Este comentario decía que el corpus sintético
 * no instanciaba el tercer veredicto —`indeterminable`— y que por eso el careo del texto
 * `INDETERMINABLE` seguía sólo contra el corpus real. Ya lo instancia: `sint02-g05` es una
 * costura `dungeon-enter` cuya `loc` es 23 (GLASS COVE, un pueblo: NO es mazmorra 33..40), y
 * `sint02-g06`/`sint02-g07` son los dos `post-combat` que cuelgan de esa visita y por eso no
 * resuelven. El `skipReason` de los dos lo escribió el DERIVADOR, no la mano: «interior con
 * mazmorra INDETERMINABLE: la visita se abrió en sint02-g05, cuya costura `dungeon-enter` no
 * dejó una loc 33..40». Es el caso de `ad20-g16/17` (COVE) reproducido en forma.
 */
describe("★★ guarda del `skipReason` — sobre el corpus SINTÉTICO (viaja al público)", () => {
  const sint = () => rutasSint();

  it("CERO segmentos con el texto de `fuera` y un veredicto vivo que NO es `fuera`", () => {
    const { mienten, legitimos } = careoTextoVsProbe(sint);
    // 🔴 el control y su población, en el MISMO aserto: sin segmentos que lleven el texto, el
    // `toEqual([])` de abajo se cumple porque no hay a quién acusar.
    expect(
      legitimos.length,
      "ningún segmento del corpus sintético lleva el texto de `fuera`: el guarda no tiene sujeto",
    ).toBeGreaterThan(0);
    expect(
      mienten,
      `estos segmentos AFIRMAN «${AFIRMA_FUERA}» y el predicado dice otra cosa: son interior y su razón MIENTE`,
    ).toEqual([]);
  });

  it("★ los `post-combat` con veredicto `indeterminable` DECLARAN la visita que no resuelve", () => {
    // La OTRA mitad del careo, y la que impide el fix perezoso: emitir el texto pesimista para
    // todo el mundo pasaría el aserto de arriba (0 mentiras, porque ya nadie afirma `fuera`)
    // sin haber consultado al predicado ni una vez. Aquí se exige la implicación contraria.
    const indeterminables: string[] = [];
    for (const { route } of sint()) {
      route.segments.forEach((seg, i) => {
        if (seg.ctx !== "post-combat" || !seg.skipReason) return;
        if (neutralInteriorProbe(route, i).kind !== "indeterminable") return;
        indeterminables.push(seg.id);
        expect(seg.skipReason, `${seg.id}: es interior con id irresoluble y su razón no lo dice`).toMatch(/INDETERMINABLE/);
        expect(seg.skipReason, `${seg.id}: no nombra la visita de la que cuelga`).toMatch(/la visita se abrió en \S+/);
      });
    }
    // POBLACIÓN POR IDENTIDAD, no por cifra: el corpus sintético trae este caso A PROPÓSITO
    // (`routes-sint/README.md`, fila «el TERCER veredicto del probe»). Si la lista se vacía —
    // porque alguien le dio a `sint02-g05` una loc de mazmorra y la visita pasó a resolver— el
    // aserto de arriba se quedaría sin sujeto y este `toEqual` lo dice en vez de callarlo.
    expect(indeterminables).toEqual(["sint02-g06", "sint02-g07"]);
  });
});

describeCorpusReal("★★ guarda — ningún `skipReason` afirma «no es de interior» sin que el probe lo respalde", () => {
  it("CERO segmentos con el texto de `fuera` y un veredicto vivo que NO es `fuera`", () => {
    const { mienten } = careoTextoVsProbe(todosLosCorpus);
    expect(
      mienten,
      `estos segmentos AFIRMAN «${AFIRMA_FUERA}» y el predicado dice otra cosa: son interior y su razón MIENTE`,
    ).toEqual([]);
  });

  it("★ el control TIENE población: 115 lo llevan legítimamente (74 AD + 41 LP1)", () => {
    // sin esta cifra, borrar el texto para todos pondría verde el test de arriba
    const { legitimos } = careoTextoVsProbe(todosLosCorpus);
    expect(legitimos).toHaveLength(115);
    expect(legitimos.filter((id) => id.startsWith("ad"))).toHaveLength(74);
    expect(legitimos.filter((id) => id.startsWith("part"))).toHaveLength(41);
  });

  /*
   * ★ La otra mitad del careo: que los `indeterminable` REALES existan y estén DECLARADOS. Sin
   * esto, un fix que emitiera el texto pesimista para todo el mundo pasaría los dos tests de
   * arriba (0 mentiras porque nadie afirma `fuera`) sin haber consultado nunca al predicado.
   */
  it("★ los `post-combat` con veredicto `indeterminable` declaran la visita que no resuelve", () => {
    const indeterminables: string[] = [];
    for (const { route } of todosLosCorpus()) {
      (route.segments ?? []).forEach((seg, i) => {
        if (seg.ctx !== "post-combat" || !seg.skipReason) return;
        if (neutralInteriorProbe(route, i).kind !== "indeterminable") return;
        indeterminables.push(seg.id);
        expect(seg.skipReason, `${seg.id}: es interior con id irresoluble y su razón no lo dice`).toMatch(/INDETERMINABLE/);
        expect(seg.skipReason, `${seg.id}: no nombra la visita de la que cuelga`).toMatch(/la visita se abrió en \S+/);
      });
    }
    // población NOMBRADA: las dos visitas del censo del pre-registro (§3). Si esta lista se
    // vacía, el guarda de arriba deja de tener sujeto y hay que re-derivar el censo.
    expect(indeterminables).toEqual([
      "ad11-g07", "ad11-g08", "ad11-g09", "ad11-g10", "ad11-g11",
      "ad20-g18", "ad20-g19", "ad20-g20", "ad20-g21", "ad20-g22",
      "ad20-g23", "ad20-g24", "ad20-g25", "ad20-g26",
    ]);
  });
});

/*
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * 🔴 SONDA DE DEUDA — el corpus LP1 NO está en el punto fijo de su propio derivador
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 *
 * Medido por el carril `cola-probe` (pre-registro §1) y NO arreglado por él: mover estos
 * segmentos es territorio adjudicado y decisión del lead. Esta sonda existe para que la cifra
 * no viva sólo en un acta ([[cifra-sin-sonda-commiteada]]).
 *
 * `derive-dungeon-ops --all --routes routes-ad` deja el corpus AD **byte-idéntico**: AD está en
 * su punto fijo. Sobre `routes` (LP1) modifica **19 de 24 ficheros**, y el tool NO es el culpable
 * —es idempotente, la 2ª y la 3ª corrida dan el mismo sha—: lo rancio es el ARTEFACTO commiteado.
 * Re-derivar LP1 hoy CIERRA 66 `post-combat` (65 por el conflicto de abajo + `part19-g07`, que cae
 * por MATERIAL: sus `converted` bajan de 3 a 2) y abre 5.
 *
 * ★★ EL MECANISMO, con nombre: `mkoverlay-lp1` escribe `skip: false` (tombstone «quítalo») para
 * todo `post-combat` que su máquina declara NO interior, y el cinturón de `enrichPart`
 * (`if (!seg.skip) seg.skip = "pendiente-runner"`) se lo vuelve a poner. Los dos productores están
 * en conflicto PERMANENTE sobre esos segmentos y gana el que corrió último. En AD ganó el
 * derivador; en LP1 ganó `curate`/`mkoverlay`.
 *
 * 🔴 Consecuencia viva: cualquiera que re-corra el derivador por cualquier motivo saca 65
 * segmentos del denominador de LP1 EN SILENCIO. Esta sonda lo vuelve ruidoso.
 *
 * ⚠ POLARIDAD: este test es VERDE mientras la deuda siga ahí y ROJO cuando alguien la mueva. Eso
 * es a propósito: no vigila que el estado sea bueno —no lo es—, vigila que no cambie sin que la
 * ventana que lo cambie vuelva aquí a re-declarar la cifra.
 */
describeCorpusReal("🔴 sonda de deuda — LP1 fuera del punto fijo del derivador (no la arregla `cola-probe`)", () => {
  it("la HUELLA del conflicto: 65 `post-combat` sin mazmorra y SIN `skip` en LP1, 0 en AD", () => {
    const huella: Record<string, string[]> = { LP1: [], AD: [] };
    for (const { corpus, route } of todosLosCorpus()) {
      const donde = corpus.startsWith("LP1") ? "LP1" : "AD";
      (route.segments ?? []).forEach((seg, i) => {
        if (seg.ctx !== "post-combat") return;
        const propio = seg.enter?.loc != null && seg.enter.loc >= 33 && seg.enter.loc <= 40 && !seg.enter.carryover;
        if (propio || resolveDungeonForPostCombat(route, i) != null) return; // el derivador SÍ le resuelve mazmorra
        if (!seg.skip && !seg.openedBy) huella[donde]!.push(seg.id);
      });
    }
    // AD está en su punto fijo: allí el cinturón ya cerró a todos los que le tocaba
    expect(huella.AD, "AD ha dejado de estar en su punto fijo").toEqual([]);
    // LP1 no: éstos están HOY en el denominador y una re-derivación se los lleva
    expect(
      huella.LP1,
      "la deuda de LP1 ha cambiado de tamaño: re-declárala en el acta que la mueva antes de tocar esta cifra",
    ).toHaveLength(65);
  });
});
