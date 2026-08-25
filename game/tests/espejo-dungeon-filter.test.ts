/**
 * FASE 3e-a — guardas del FILTRO DE LOCALIZACIÓN en mazmorra.
 *
 * La primera sección es LA que importa: **el filtro nunca puede excluir la celda verdadera**. Es
 * el criterio de aceptación del diseño, por encima de cuántas candidatas deje. Un filtro que
 * converge a 1 y a veces se equivoca teletransporta la party a una celda falsa y mide el interior
 * equivocado — fabricación con forma de precisión.
 *
 * El barrido va sobre las **64 plantas REALES** de `assets/maps/dungeons.json`, no sobre grids de
 * juguete, y con el ERRANTE simulado a varias tasas: la razón de que `Blocked!` no informe es
 * precisamente que el errante emite la misma cadena que el muro (dungeon.ts:363, DS 0x2D23), así
 * que la propiedad tiene que aguantar con el errante metiendo ruido.
 */
import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import {
  N,
  DELTA,
  wrap,
  allStates,
  applyObs,
  runFilter,
  budgetOf,
  isInformative,
  resolveDungeonAnchor,
  torusDist,
  definitelyBlocks,
  isNormalDoor,
  isEnergyField,
  applyKlimb,
  MIN_BUDGET,
  observationsFor,
  observationRunsFor,
  hasGhostPassSignature,
  hasUnattestedCombatTail,
  BACK_IS_INFORMATIVE,
  newDngFilter,
  resetFilter,
  stepFilterForSegment,
  type FloorGrid,
  type FloorTracker,
  type DngObs,
  type DngState,
  type ObsOp as DngOpLike,
} from "../e2e/espejo-tour/dungeon-filter";
// La tarjeta `ad18-g14` señala (sin adjudicarlo) al discriminador de re-lectura de #54.
import { hasGhostSignature, isGhostReread } from "../e2e/espejo-tour/tools/derive-dungeon-ops.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const DUNGEONS = JSON.parse(
  readFileSync(join(HERE, "..", "assets", "maps", "dungeons.json"), "utf8"),
) as Array<{ location: number; name: string; floors: FloorGrid[] }>;

/** Todas las plantas reales del juego: 8 mazmorras × 8 plantas. */
const ALL_FLOORS: Array<{ name: string; floor: number; g: FloorGrid }> = DUNGEONS.flatMap((d) =>
  d.floors.map((g, i) => ({ name: d.name, floor: i, g })),
);

/** PRNG determinista (los tests no pueden depender de Math.random). */
const rng = (seed: number) => {
  let s = seed;
  return () => ((s = (s * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
};

const cellAhead = (g: FloorGrid, s: DngState) => {
  const [dx, dy] = DELTA[s.facing]!;
  return g[wrap(s.y + dy)]![wrap(s.x + dx)]!;
};

/**
 * Simula un paseo REAL por la planta y devuelve (observaciones, estado final verdadero).
 * `wandererRate` = probabilidad de que el errante ocupe la celda destino y produzca un `Blocked!`
 * ESPURIO (celda transitable pero bloqueada) — el caso que hace insano usar `Blocked!` como muro.
 */
function walk(g: FloorGrid, steps: number, seed: number, wandererRate: number): { obs: DngObs[]; truth: DngState } {
  const R = rng(seed);
  let t: DngState = { x: Math.floor(R() * N), y: Math.floor(R() * N), facing: Math.floor(R() * 4) };
  // arranca en una celda donde la party podría estar de verdad
  let guard = 0;
  while (definitelyBlocks(g[t.y]![t.x]!) && guard++ < 200) t = { x: Math.floor(R() * N), y: Math.floor(R() * N), facing: t.facing };
  const obs: DngObs[] = [];
  for (let i = 0; i < steps; i++) {
    const r = R();
    if (r < 0.3) {
      if (isNormalDoor(g[t.y]![t.x]!)) obs.push({ kind: "not-in-doorway" });
      else {
        const right = R() < 0.5;
        obs.push({ kind: "turn", right });
        t = { ...t, facing: right ? (t.facing + 1) % 4 : (t.facing + 3) % 4 };
      }
      continue;
    }
    if (r < 0.35) {
      obs.push({ kind: "turn-around" });
      t = { ...t, facing: (t.facing + 2) % 4 };
      continue;
    }
    const tgt = cellAhead(g, t);
    if (isEnergyField(tgt)) {
      obs.push({ kind: "energy-field" });
      continue;
    }
    // el ERRANTE bloquea una celda transitable y emite el MISMO "Blocked!" que el muro
    if (definitelyBlocks(tgt) || R() < wandererRate) {
      obs.push({ kind: "advance-blocked" });
      continue;
    }
    obs.push({ kind: "advance-ok" });
    const [dx, dy] = DELTA[t.facing]!;
    t = { x: wrap(t.x + dx), y: wrap(t.y + dy), facing: t.facing };
  }
  return { obs, truth: t };
}

const same = (a: DngState, b: DngState) => a.x === b.x && a.y === b.y && a.facing === b.facing;

describe("FASE 3e-a — PROPIEDAD PORTANTE: el filtro NUNCA excluye la celda verdadera", () => {
  // Ésta es la prueba que decide si el filtro es aceptable. Si un cambio futuro la pone roja, el
  // filtro deja de ser componible con el resync y NO se puede usar, por bien que converja.
  for (const wandererRate of [0, 0.05, 0.15, 0.4]) {
    it(`barrido de las 64 plantas reales × 8 paseos, con errante al ${wandererRate * 100}%`, () => {
      let runs = 0;
      let lost = 0;
      const perdidas: string[] = [];
      for (const { name, floor, g } of ALL_FLOORS) {
        for (let s = 1; s <= 8; s++) {
          const { obs, truth } = walk(g, 60, s * 7919 + floor * 31, wandererRate);
          const states = runFilter(g, obs);
          runs++;
          if (!states.some((st) => same(st, truth))) {
            lost++;
            if (perdidas.length < 5) perdidas.push(`${name} f${floor} seed${s}`);
          }
        }
      }
      expect(runs).toBeGreaterThan(500);
      expect(lost, `verdad PERDIDA en ${lost}/${runs}: ${perdidas.join(", ")}`).toBe(0);
    });
  }

  it("`Blocked!` NO excluye — es la decisión que hace sano al filtro (errante = misma cadena)", () => {
    // Con el errante al 40% hay muchísimos `Blocked!` espurios. Si el filtro los tratara como
    // muro, la verdad se perdería constantemente. Este test lo demuestra POR CONTRASTE.
    const { g } = ALL_FLOORS[0]!;
    const states = allStates();
    const antes = states.length;
    expect(applyObs(g, states, { kind: "advance-blocked" }).length).toBe(antes); // no excluye
    // …y tampoco mueve
    expect(applyObs(g, states, { kind: "advance-blocked" })).toEqual(states);
  });

  it("la puerta SECRETA no excluye (su transitabilidad depende del Search del LP)", () => {
    // grid sintético: delante del estado (0,1,N) hay una puerta secreta (0xD)
    const g: FloorGrid = Array.from({ length: N }, () => Array.from({ length: N }, () => ({ type: 0, sub: 0 })));
    g[0]![0] = { type: 0xd, sub: 0 };
    const s: DngState = { x: 0, y: 1, facing: 0 }; // mirando al norte → (0,0)
    const out = applyObs(g, [s], { kind: "advance-ok" });
    // sobrevive (y avanza): si el LP la había revelado, ése ES el estado verdadero
    expect(out).toHaveLength(1);
    expect(out[0]).toEqual({ x: 0, y: 0, facing: 0 });
  });

  it("el muro SÍ excluye (es lo único que bloquea pase lo que pase)", () => {
    const g: FloorGrid = Array.from({ length: N }, () => Array.from({ length: N }, () => ({ type: 0, sub: 0 })));
    g[0]![0] = { type: 0xb, sub: 0 }; // Wall
    expect(applyObs(g, [{ x: 0, y: 1, facing: 0 }], { kind: "advance-ok" })).toHaveLength(0);
  });
});

describe("FASE 3e-a — semántica de cada observación (todas con su cita)", () => {
  const flat = (): FloorGrid => Array.from({ length: N }, () => Array.from({ length: N }, () => ({ type: 0, sub: 0 })));

  it("`advance-ok` avanza CON wrap toroidal (DUNGEON:0x057a/0x0583, no clamp)", () => {
    const g = flat();
    const out = applyObs(g, [{ x: 3, y: 0, facing: 0 }], { kind: "advance-ok" });
    expect(out[0]).toEqual({ x: 3, y: 7, facing: 0 }); // y=-1 → 7
  });

  it("`not-in-doorway` deja SÓLO las que están sobre puerta normal, y NO gira", () => {
    const g = flat();
    g[2]![2] = { type: 0xe, sub: 0 };
    const out = applyObs(g, [{ x: 2, y: 2, facing: 1 }, { x: 3, y: 3, facing: 1 }], { kind: "not-in-doorway" });
    expect(out).toEqual([{ x: 2, y: 2, facing: 1 }]); // facing intacto
  });

  it("`turn` descarta las que están sobre puerta normal (ésas no habrían girado) y rota el resto", () => {
    const g = flat();
    g[2]![2] = { type: 0xe, sub: 0 };
    const out = applyObs(g, [{ x: 2, y: 2, facing: 0 }, { x: 3, y: 3, facing: 0 }], { kind: "turn", right: true });
    expect(out).toEqual([{ x: 3, y: 3, facing: 1 }]);
  });

  it("`energy-field` exige el tile EXACTO 0x83 (la variante iluminada NO cuenta)", () => {
    const g = flat();
    g[0]![0] = { type: 0x8, sub: 3 }; // 0x83
    g[0]![1] = { type: 0x8, sub: 3 | 0x8 }; // iluminada → NO
    expect(applyObs(g, [{ x: 0, y: 1, facing: 0 }], { kind: "energy-field" })).toHaveLength(1);
    expect(applyObs(g, [{ x: 1, y: 1, facing: 0 }], { kind: "energy-field" })).toHaveLength(0);
  });

  it("`turn-around` rota 180° y no filtra (la rama default no tiene gate de puerta)", () => {
    const g = flat();
    g[2]![2] = { type: 0xe, sub: 0 };
    const out = applyObs(g, [{ x: 2, y: 2, facing: 0 }], { kind: "turn-around" });
    expect(out).toEqual([{ x: 2, y: 2, facing: 2 }]); // sobrevive AUNQUE esté en puerta
  });

  it("arranca del desconocimiento TOTAL: 256 estados (64 celdas × 4 facings)", () => {
    expect(allStates()).toHaveLength(256);
  });
});

describe("FASE 3e-a — PRESUPUESTO: las visitas sin material se DECLARAN, no se ancla", () => {
  it("`advance-blocked` y `turn-around` NO cuentan como informativas", () => {
    expect(isInformative({ kind: "advance-blocked" })).toBe(false);
    expect(isInformative({ kind: "turn-around" })).toBe(false);
    expect(isInformative({ kind: "advance-ok" })).toBe(true);
    expect(isInformative({ kind: "not-in-doorway" })).toBe(true);
  });

  it("por debajo del mínimo devuelve `enough:false` CON RAZÓN declarada (nunca un skip mudo)", () => {
    // RELATIVO al umbral a propósito: este test blinda el COMPORTAMIENTO en el borde. Quien pina el
    // VALOR es el test de abajo, y tienen que ser dos — un test que derive su expectativa de la
    // constante no puede detectar que la constante esté mal.
    const pocas: DngObs[] = Array.from({ length: MIN_BUDGET - 1 }, () => ({ kind: "advance-ok" }) as DngObs);
    const b = budgetOf(pocas);
    expect(b.enough).toBe(false);
    expect(b.informative).toBe(MIN_BUDGET - 1);
    expect(b.reason).toMatch(/sin presupuesto para anclar/);
    // y JUSTO en el umbral ya hay presupuesto (el mínimo es inclusivo)
    expect(budgetOf(Array.from({ length: MIN_BUDGET }, () => ({ kind: "advance-ok" }) as DngObs)).enough).toBe(true);
  });

  /**
   * ★ EL VALOR, pinado con su porqué (ruling task #1/#5). No es decoración: `MIN_BUDGET` decide si
   * el cinturón fantasma se consulta o no —vive DENTRO de la rama bajo-presupuesto—, así que
   * cambiarlo cambia QUÉ PROTECCIÓN EXISTE, no cuánta potencia se pide.
   *
   * - **40 era INALCANZABLE**: sobre los **232** tramos de la partición de hoy la banda 40+ tiene 0
   *   muestras (`re/notes/regen-71b-presupuestos-re-derivacion.md`; el cardinal se movió con la
   *   población, la conclusión no).
   * - ⚠ **«5 EXIME a la banda en vez de someterla» YA NO ES CIERTO, y esta línea lo dice en vez de
   *   quedarse como aval rancio.** Se midió cuando los tramos anclables eran 34 y ninguno bajaba de
   *   5, de donde: «toman la rama `enough` y el `ghostRisk` no se consulta ni una vez»
   *   (`re/notes/geo-13-cinturon-acta.md` §1). La ventana `banner-ad19` abrió 15 segmentos al curar
   *   el banner de `ad19-g17` y los anclables pasaron a **47**, con **uno de presupuesto 4**:
   *   `ad19-g21`. Hoy el `ghostRisk` **SÍ se consulta**, exactamente una vez, y se abstiene —o sea
   *   el residual que el ruling aceptó por escrito ha DEJADO DE SER HIPOTÉTICO.
   *   Medido en «★★ la capa de TRAMOS re-derivada» y en «★★ re-derivación OFFLINE», abajo.
   * - Lo que NO cambió: `combat-risk` sigue FUERA de esa rama y sigue siendo quien confina el
   *   riesgo vivo (15 de las 16 abstenciones), y **ninguna ancla se movió** (`belowBudget` = 0).
   *
   * ⇒ El VALOR sigue en 5 y esta ventana **no lo toca**: es cláusula sellada y la decisión de si
   * 4 debe entrar es del lead, con la cifra delante. Si alguien lo mueve, que sea con un ruling
   * delante y no de paso.
   */
  it("★ el VALOR de MIN_BUDGET está pinado: 5, y con el residual aceptado por escrito", () => {
    expect(MIN_BUDGET).toBe(5);
  });

  it("un mar de `Blocked!` NO compra presupuesto (son ambiguos)", () => {
    const ruido: DngObs[] = Array.from({ length: 200 }, () => ({ kind: "advance-blocked" }) as DngObs);
    expect(budgetOf(ruido).enough).toBe(false);
  });

  // ⚠ ESTE TEST CAMBIÓ DE CONTRATO (ruling del lead, 31-07). Pinaba lo contrario: «devuelve
  // `no-budget` y NO ancla, aunque haya pocas candidatas». Se deja la traza porque el cambio es
  // deliberado y no una regresión: el presupuesto compraba confianza en que un conjunto pequeño
  // no fuera ARTEFACTO de corrupción, y tras 3e-b (sanidad restaurada + reinicio en cada frontera
  // de planta) esa amenaza quedó confinada a las firmas conocidas del lever 2 — no al TAMAÑO del
  // conjunto. El CONTEO REAL manda sobre el PROXY. El veto sigue vivo por encima del umbral y
  // cuando hay firma de pasada fantasma (los dos casos, más abajo en 3e-b).
  it("con el conteo YA dentro del umbral ancla aunque falte presupuesto (el proxy no veta al conteo)", () => {
    const r = resolveDungeonAnchor([{ x: 1, y: 1, facing: 0 }], { x: 0, y: 0 }, { budget: budgetOf([]) });
    expect(r.status).toBe("resolved");
    expect(r.belowBudget, "ancló bajo presupuesto sin DECLARARLO: no sería auditable").toBe(true);
    expect(r.reason, "el motivo no declara las cifras que hacen auditable el anclaje").toBeTruthy();
  });
});

describe("FASE 3e-a — composición: el filtro REDUCE, la CERCANÍA decide (gemelo de resolveFaceAnchor)", () => {
  const budget = budgetOf(Array.from({ length: MIN_BUDGET }, () => ({ kind: "advance-ok" }) as DngObs));

  it("con pocas candidatas elige la MÁS CERCANA a la posición viva del port", () => {
    const r = resolveDungeonAnchor(
      [{ x: 7, y: 7, facing: 0 }, { x: 1, y: 1, facing: 2 }],
      { x: 1, y: 2 },
      { budget },
    );
    expect(r.status).toBe("resolved");
    expect(r.state).toEqual({ x: 1, y: 1, facing: 2 });
    expect(r.drift).toBe(1);
  });

  it("la cercanía es TOROIDAL (el grid envuelve: 7→0 es distancia 1, no 7)", () => {
    expect(torusDist({ x: 0, y: 0 }, { x: 7, y: 0 })).toBe(1);
    expect(torusDist({ x: 0, y: 0 }, { x: 4, y: 4 })).toBe(8);
  });

  it("con DEMASIADAS candidatas DECLINA (`ambiguous`) en vez de adivinar", () => {
    const muchas = allStates().slice(0, 40);
    const r = resolveDungeonAnchor(muchas, { x: 0, y: 0 }, { budget });
    expect(r.status).toBe("ambiguous");
    expect(r.state).toBeUndefined();
    expect(r.candidates).toBe(40);
  });

  it("con CERO candidatas es `miss`, y lo declara como DATO (mapa vivo ≠ estático), no como fallo", () => {
    const r = resolveDungeonAnchor([], { x: 0, y: 0 }, { budget });
    expect(r.status).toBe("miss");
    expect(r.reason).toMatch(/no casa con el est/);
  });

  it("el umbral por defecto es el MISMO que el de resolveFaceAnchor (4): misma disciplina", () => {
    const cinco = allStates().slice(0, 5);
    expect(resolveDungeonAnchor(cinco, { x: 0, y: 0 }, { budget }).status).toBe("ambiguous");
    expect(resolveDungeonAnchor(cinco.slice(0, 4), { x: 0, y: 0 }, { budget }).status).toBe("resolved");
  });
});

describe("FASE 3e-a — planta por klimb: ALCANCE DECLARADO (no da la planta absoluta)", () => {
  it("propaga una planta conocida: Klimb-Down baja, Klimb-Up sube", () => {
    expect(applyKlimb({ floor: 2, falsified: false }, "down")).toEqual({ floor: 3, falsified: false });
    expect(applyKlimb({ floor: 2, falsified: false }, "up")).toEqual({ floor: 1, falsified: false });
  });

  it("si la secuencia del LP se SALE del rango, la planta supuesta queda FALSIFICADA", () => {
    // el caso real de 3b: la costura supone la CIMA y un Klimb-Up del LP la desmiente
    expect(applyKlimb({ floor: 0, falsified: false }, "up")).toEqual({ floor: null, falsified: true });
    expect(applyKlimb({ floor: 7, falsified: false }, "down")).toEqual({ floor: null, falsified: true });
  });

  it("sin planta de partida NO inventa ninguna (la absoluta no es derivable: --visits, 4 de 22)", () => {
    expect(applyKlimb({ floor: null, falsified: false }, "down")).toEqual({ floor: null, falsified: false });
  });

  it("una vez falsificada, se queda falsificada (no se re-adivina más abajo)", () => {
    expect(applyKlimb({ floor: null, falsified: true }, "down").falsified).toBe(true);
  });
});

describe("FASE 3e-a — los datos reales cumplen lo que el diseño supone", () => {
  it("son 8 mazmorras × 8 plantas × 8×8 celdas", () => {
    expect(DUNGEONS).toHaveLength(8);
    for (const d of DUNGEONS) {
      expect(d.floors).toHaveLength(N);
      for (const f of d.floors) {
        expect(f).toHaveLength(N);
        for (const row of f) expect(row).toHaveLength(N);
      }
    }
  });

  it("las puertas NORMALES (0xE) son rarísimas — por eso `Not in doorway!` discrimina tanto", () => {
    let doors = 0;
    for (const { g } of ALL_FLOORS) for (const row of g) for (const c of row) if (isNormalDoor(c)) doors++;
    // dungeon.ts:381 dice «sólo hay 7 celdas 0xE en las 8 mazmorras»
    expect(doors).toBeLessThanOrEqual(16);
    expect(doors).toBeGreaterThan(0);
  });

  it("el filtro reduce de verdad sobre plantas reales (no es un no-op)", () => {
    // NO se asierta convergencia a 1: el criterio de aceptación es la SANIDAD, no la mediana.
    const { g } = ALL_FLOORS[0]!;
    const { obs } = walk(g, 80, 12345, 0.05);
    expect(runFilter(g, obs).length).toBeLessThan(allStates().length);
  });
});

describe("FASE 3e-a — DERIVACIÓN de observaciones desde el OCR del LP", () => {
  // Las observaciones describen AL LP, no al port: el filtro localiza dónde estaba el LP para
  // poder llevar allí a la party. Por eso se derivan del `expect`, nunca del transcript del port.
  const op = (dng: string, ocrLn: number) => ({ dng, ocrLn });
  const blk = (text: string, ocrLn: number) => ({ text, ocrLn });

  it("un `advance` sin `Blocked!` detrás = avance CON ÉXITO (la observación informativa)", () => {
    const obs = observationsFor([op("advance", 10), op("turnLeft", 12)], [blk("Advance", 10), blk("Turn left", 12)]);
    expect(obs).toEqual([{ kind: "advance-ok" }, { kind: "turn", right: false }]);
  });

  it("un `advance` con `Blocked!` en su ventana = AMBIGUO (no informa: pudo ser el errante)", () => {
    const obs = observationsFor([op("advance", 10), op("advance", 13)], [blk("Advance", 10), blk("Blocked!", 11), blk("Advance", 13)]);
    expect(obs[0]).toEqual({ kind: "advance-blocked" });
  });

  it("tolera la corrupción del OCR («B1ocked!», «Not 1n doorway»)", () => {
    expect(observationsFor([op("advance", 1)], [blk("Advance B1ocked!", 1)])[0]).toEqual({ kind: "advance-blocked" });
    expect(observationsFor([op("turnRight", 1)], [blk("Not 1n doorway!", 1)])[0]).toEqual({ kind: "not-in-doorway" });
  });

  it("`Ouch!/Electric field!` gana sobre `Blocked!` (es inequívoco; el errante no lo produce)", () => {
    const obs = observationsFor([op("advance", 1)], [blk("Advance Ouch! Electric field!", 1)]);
    expect(obs[0]).toEqual({ kind: "energy-field" });
  });

  it("`back` NO produce observación — retrocede sin girar y modelarlo como avance movería mal", () => {
    expect(BACK_IS_INFORMATIVE).toBe(false);
    expect(observationsFor([op("back", 1)], [blk("Back up", 1)])).toEqual([]);
  });

  it("un op SIN `ocrLn` no produce observación (no se inventa el orden)", () => {
    expect(observationsFor([{ dng: "advance" }], [blk("Advance", 1)])).toEqual([]);
  });

  it("klimb/search/look/ignite/pass no aportan información de MURO", () => {
    const ops = [op("klimb", 1), op("search", 2), op("look", 3), op("ignite", 4), op("pass", 5)];
    expect(observationsFor(ops, [blk("x", 1), blk("x", 2), blk("x", 3), blk("x", 4), blk("x", 5)])).toEqual([]);
  });
});

describe("FASE 3e-a — EL CABLEADO SE EJECUTA (no basta con que exista)", () => {
  // «implementado y no integrado» fue un fallo real de este carril: el filtro vivía con 29 tests
  // y CERO consumidores, así que una ventana midiéndolo habría medido lo mismo que 3d y el número
  // habría parecido «efecto cero del filtro» — una conclusión falsa con datos limpios.
  // `fed` es el contador de invocaciones reales; si el cableado dejara de correr, se queda en 0.
  const g = ALL_FLOORS[0]!.g;
  const script = [
    { dng: "advance", ocrLn: 1 },
    { dng: "turnRight", ocrLn: 2 },
    { dng: "advance", ocrLn: 3 },
  ];
  const expectBlocks = [{ text: "Advance", ocrLn: 1 }, { text: "Turn right", ocrLn: 2 }, { text: "Advance", ocrLn: 3 }];

  it("`stepFilterForSegment` ALIMENTA el filtro: `fed` pasa de 0 a >0", () => {
    const f = newDngFilter();
    resetFilter(f, 33, 0);
    expect(f.fed).toBe(0);
    stepFilterForSegment(f, g, script, expectBlocks, { x: 0, y: 0 });
    expect(f.fed, "el filtro no se alimentó: el cableado existe pero NO corre").toBe(3);
    expect(f.obs).toHaveLength(3);
  });

  it("ACUMULA entre segmentos (el presupuesto no lo da un segmento suelto: 35 obs < 40)", () => {
    const f = newDngFilter();
    resetFilter(f, 33, 0);
    stepFilterForSegment(f, g, script, expectBlocks, { x: 0, y: 0 });
    stepFilterForSegment(f, g, script, expectBlocks, { x: 0, y: 0 });
    expect(f.fed).toBe(6);
  });

  it("cada llamada REGISTRA su veredicto (la contabilidad no se pierde)", () => {
    const f = newDngFilter();
    resetFilter(f, 33, 0);
    const r = stepFilterForSegment(f, g, script, expectBlocks, { x: 0, y: 0 });
    const total = f.outcomes.resolved + f.outcomes.ambiguous + f.outcomes.miss + f.outcomes.noBudget;
    expect(total).toBe(1);
    expect(["resolved", "ambiguous", "miss", "no-budget"]).toContain(r.status);
  });

  it("con pocas observaciones el veredicto es `no-budget` — declarado, no anclado", () => {
    const f = newDngFilter();
    resetFilter(f, 33, 0);
    const r = stepFilterForSegment(f, g, script, expectBlocks, { x: 0, y: 0 });
    expect(r.status).toBe("no-budget");
    expect(f.outcomes.noBudget).toBe(1);
  });

  it("cambiar de PLANTA reinicia el filtro (los 256 estados son de UNA planta)", () => {
    const f = newDngFilter();
    resetFilter(f, 33, 0);
    stepFilterForSegment(f, g, script, expectBlocks, { x: 0, y: 0 });
    expect(f.obs.length).toBe(3);
    resetFilter(f, 33, 1);
    expect(f.obs).toHaveLength(0);
    expect(f.states).toHaveLength(256);
    expect(f.resets).toBe(2);
  });

  it("el runner IMPORTA y LLAMA al filtro (guarda contra volver a dejarlo sin consumidor)", () => {
    const runner = readFileSync(join(HERE, "..", "e2e", "espejo-tour", "runner.ts"), "utf8");
    expect(runner, "runner.ts no importa dungeon-filter").toMatch(/from "\.\/dungeon-filter\.js"/);
    expect(runner, "runner.ts no llama a stepFilterForSegment").toMatch(/stepFilterForSegment\(/);
    expect(runner, "el runner no expone filterFed en el reporte").toMatch(/filterFed/);
  });

  it("y la SPEC se lo PASA — el punto ciego que la guarda anterior no cubría", () => {
    // La primera versión de esta guarda comprobaba que el runner LLAMA al filtro… pero nada
    // comprobaba que ALGUIEN le pase uno. La spec llamaba `runSegment(page, seg)` a secas, así que
    // el filtro quedaba DORMIDO y el test seguía verde: el mismo «existe ≠ se ejecuta» un nivel
    // más arriba. Se detectó en la cobertura, viendo `filterStatus` vacío en los 16 segmentos.
    const spec = readFileSync(join(HERE, "..", "e2e", "espejo-tour", "espejo-tour.spec.ts"), "utf8");
    expect(spec, "la spec no construye el acumulador").toMatch(/newDngFilter\(\)/);
    expect(spec, "la spec no pasa dngFilter/dngGrid a runSegment").toMatch(/runSegment\(page, seg, \{[^}]*dngFilter/);
    expect(spec, "falta el conmutador A/B del experimento interno").toMatch(/U5_ESPEJO_FILTER/);
  });

  it("el filtro está OFF por defecto (el brazo A debe comportarse EXACTAMENTE como 3d)", () => {
    const spec = readFileSync(join(HERE, "..", "e2e", "espejo-tour", "espejo-tour.spec.ts"), "utf8");
    // sin la variable puesta, `FILTER_ON` es false y no se construye acumulador ni grid
    expect(spec).toMatch(/const FILTER_ON = process\.env\.U5_ESPEJO_FILTER === "1"/);
    expect(spec).toMatch(/FILTER_ON \? newDngFilter\(\) : undefined/);
  });
});

// ═══════════════════════════════ FASE 3e-b — EL KLIMB DENTRO DEL SEGMENTO (hito 3)
//
// El A/B de ad17 (2026-07-31) dio factor ×1,00 con 0 candidatas en 10 de 10 segmentos: el filtro
// excluía la celda verdadera SIEMPRE. La causa no estaba en su lógica sino en el ALIMENTADO —
// `stepFilterForSegment` aplicaba TODAS las observaciones del segmento contra UN solo grid, y el
// `klimb` ocurre a MITAD de segmento (18 klimbs en ad17, en 6 de sus 10 interiores).
//
// Por qué el barrido de las 64 plantas no lo cazó: su generador (`walk`) pasea sobre UN grid, así
// que el fallo NO ESTÁ EN SU ESPACIO DE ENTRADAS. Este bloque añade el generador que sí lo produce.

/** Como `walk` pero desde un estado DADO. Se duplica el bucle a propósito en vez de refactorizar
 *  `walk`: tocarlo cambiaría el consumo del PRNG y con él los 256 paseos del barrido histórico. */
function walkFrom(g: FloorGrid, start: DngState, steps: number, seed: number, wandererRate: number): { obs: DngObs[]; truth: DngState } {
  const R = rng(seed);
  let t: DngState = { ...start };
  const obs: DngObs[] = [];
  for (let i = 0; i < steps; i++) {
    const r = R();
    if (r < 0.3) {
      if (isNormalDoor(g[t.y]![t.x]!)) obs.push({ kind: "not-in-doorway" });
      else {
        const right = R() < 0.5;
        obs.push({ kind: "turn", right });
        t = { ...t, facing: right ? (t.facing + 1) % 4 : (t.facing + 3) % 4 };
      }
      continue;
    }
    if (r < 0.35) {
      obs.push({ kind: "turn-around" });
      t = { ...t, facing: (t.facing + 2) % 4 };
      continue;
    }
    const tgt = cellAhead(g, t);
    if (isEnergyField(tgt)) {
      obs.push({ kind: "energy-field" });
      continue;
    }
    if (definitelyBlocks(tgt) || R() < wandererRate) {
      obs.push({ kind: "advance-blocked" });
      continue;
    }
    obs.push({ kind: "advance-ok" });
    const [dx, dy] = DELTA[t.facing]!;
    t = { x: wrap(t.x + dx), y: wrap(t.y + dy), facing: t.facing };
  }
  return { obs, truth: t };
}

/** Primera celda transitable de una planta (arranque estable, sin depender del PRNG). */
function firstOpen(g: FloorGrid): DngState {
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) if (!definitelyBlocks(g[y]![x]!)) return { x, y, facing: 1 };
  throw new Error("planta sin celda transitable");
}

/**
 * Convierte observaciones en el (script, expect) que el LP habría dejado. El test alimenta al
 * filtro por el CAMINO REAL (`observationsFor` dentro de `stepFilterForSegment`), no por un atajo:
 * si sintetizara mal, el rojo sería del instrumento y no del código — el sapo de la casa.
 */
function synth(obs: readonly DngObs[], startLn: number): { script: Array<{ dng: string; dir?: string; ocrLn: number }>; expect: Array<{ text: string; ocrLn: number }> } {
  const script: Array<{ dng: string; dir?: string; ocrLn: number }> = [];
  const expectB: Array<{ text: string; ocrLn: number }> = [];
  let ln = startLn;
  for (const o of obs) {
    if (o.kind === "advance-ok") { script.push({ dng: "advance", ocrLn: ln }); expectB.push({ text: "Advance", ocrLn: ln }); }
    else if (o.kind === "advance-blocked") { script.push({ dng: "advance", ocrLn: ln }); expectB.push({ text: "Advance Blocked!", ocrLn: ln }); }
    else if (o.kind === "energy-field") { script.push({ dng: "advance", ocrLn: ln }); expectB.push({ text: "Advance Ouch! Electric field!", ocrLn: ln }); }
    else if (o.kind === "turn") { script.push({ dng: o.right ? "turnRight" : "turnLeft", ocrLn: ln }); expectB.push({ text: o.right ? "Turn right" : "Turn left", ocrLn: ln }); }
    else if (o.kind === "not-in-doorway") { script.push({ dng: "turnRight", ocrLn: ln }); expectB.push({ text: "Not in doorway!", ocrLn: ln }); }
    else { script.push({ dng: "turnAround", ocrLn: ln }); expectB.push({ text: "Turn around", ocrLn: ln }); }
    ln += 2;
  }
  return { script, expect: expectB };
}

describe("FASE 3e-b — el segmento que CRUZA DE PLANTA (la entrada que el barrido no podía generar)", () => {
  const A = ALL_FLOORS[0]!.g;
  const B = ALL_FLOORS[1]!.g;

  it("CONTROL DEL INSTRUMENTO: `synth` round-trip — observationsFor(synth(obs)) === obs", () => {
    // Sin esto, un rojo de los tests de abajo podría ser de MI sintetizador y no del filtro.
    const w = walkFrom(A, firstOpen(A), 40, 12345, 0.1);
    const { script, expect: exp } = synth(w.obs, 100);
    expect(observationsFor(script, exp)).toEqual(w.obs);
  });

  // ⚠ UN SOLO CRUCE NO DISCRIMINA. Medido al escribir estos tests: con un cruce suelto
  // (25+25 pasos, plantas 0→1 de la mazmorra 33) la verdad SOBREVIVE aun con el defecto dentro —
  // mezclar plantas corrompe el conjunto de forma PROBABILÍSTICA, no segura. Un test de un solo
  // caso habría salido verde con el bug puesto y habría «demostrado» que no hay nada que
  // arreglar. Por eso esto es un BARRIDO, igual que la propiedad portante de 3e-a: se cuentan
  // las pérdidas sobre muchos cruces y se exige CERO.
  it("BARRIDO de cruces de planta: la verdad NUNCA se pierde (0 pérdidas exigidas)", () => {
    // El klimb preserva x,y,facing — sólo mueve `floor` (dungeon.ts:697/703, y :709 relee la
    // MISMA x,y). Así que el paseo de la planta B arranca donde terminó el de la A.
    let runs = 0;
    let lost = 0;
    const perdidas: string[] = [];
    for (const d of DUNGEONS) {
      for (let fl = 0; fl + 1 < d.floors.length; fl++) {
        const gA = d.floors[fl]!;
        const gB = d.floors[fl + 1]!;
        for (let s = 1; s <= 3; s++) {
          const w1 = walkFrom(gA, firstOpen(gA), 20, s * 7919 + fl * 31, 0);
          const w2 = walkFrom(gB, w1.truth, 20, s * 104729 + fl * 17, 0);
          const s1 = synth(w1.obs, 100);
          const s2 = synth(w2.obs, 500);
          const f = newDngFilter();
          resetFilter(f, d.location, fl);
          // El runner pasa el grid de la planta VIVA (la del final del segmento) — aquí, la B.
          stepFilterForSegment(
            f,
            gB,
            [...s1.script, { dng: "klimb", dir: "down", ocrLn: 400 }, ...s2.script],
            [...s1.expect, { text: "Kllmb-Down!", ocrLn: 400 }, ...s2.expect],
            { x: w2.truth.x, y: w2.truth.y, floor: fl + 1 },
          );
          runs++;
          if (!f.states.some((st) => same(st, w2.truth))) {
            lost++;
            if (perdidas.length < 5) perdidas.push(`${d.name} f${fl}→f${fl + 1} seed${s} (quedaron ${f.states.length})`);
          }
        }
      }
    }
    expect(runs).toBeGreaterThan(100);
    expect(
      lost,
      `verdad PERDIDA en ${lost}/${runs} cruces: ${perdidas.join(", ")}. ` +
        "Las observaciones de la planta de origen se están aplicando al grid de la de destino.",
    ).toBe(0);
  });

  it("un segmento que cruzó de planta NO envenena al siguiente (el conjunto vacío es ABSORBENTE)", () => {
    const w1 = walkFrom(A, firstOpen(A), 25, 555, 0);
    const w2 = walkFrom(B, w1.truth, 20, 666, 0);
    const s1 = synth(w1.obs, 100);
    const s2 = synth(w2.obs, 500);
    const f = newDngFilter();
    resetFilter(f, 33, 0);
    // segmento 1: cruza de planta
    stepFilterForSegment(
      f,
      B,
      [...s1.script, { dng: "klimb", dir: "down", ocrLn: 400 }, ...s2.script],
      [...s1.expect, { text: "Kllmb-Down!", ocrLn: 400 }, ...s2.expect],
      { x: w2.truth.x, y: w2.truth.y, floor: 1 },
    );
    // segmento 2: LIMPIO, entero en la planta B (el caso de ad17-g05/g07/g10/g17)
    const w3 = walkFrom(B, w2.truth, 15, 999, 0);
    const s3 = synth(w3.obs, 900);
    stepFilterForSegment(f, B, s3.script, s3.expect, { x: w3.truth.x, y: w3.truth.y, floor: 1 });
    expect(
      f.states.some((s) => same(s, w3.truth)),
      `el segmento LIMPIO heredó un conjunto ya vaciado: ${f.states.length} candidatas. ` +
        "Es el contagio medido en ad17 (g05/g07/g10/g17 heredaban de g04/g09/g11).",
    ).toBe(true);
  });

  it("con conjunto VACÍO y presupuesto insuficiente manda el VACÍO: `miss`, no `no-budget`", () => {
    // Las dos etiquetas acusan a culpables OPUESTOS: `no-budget` al CORPUS («faltan
    // observaciones» ⇒ traer más material) y el vacío al CABLEADO («excluí la verdad»).
    // Medido en ad17: 6 de 10 segmentos decían `no-budget` con 0 candidatas ya.
    const r = resolveDungeonAnchor([], { x: 0, y: 0 }, { budget: { informative: 3, enough: false, reason: "pocas" } });
    expect(r.status, "el presupuesto tapó un conjunto VACÍO: el veredicto acusa al corpus y el culpable es el cableado").toBe("miss");
    expect(r.candidates).toBe(0);
  });

  it("en la frontera de planta el conjunto se REINICIA (la caída de foso no se observa)", () => {
    // Decisión con motivo, para que nadie la «optimice» de vuelta: el klimb SÍ preserva
    // (x,y,facing), así que arrastrar las candidatas parece gratis — pero el klimb NO es la
    // única forma de cambiar de planta. `pitFall` (dungeon.ts:1252-1298) baja en cascada SIN op,
    // anunciándose sólo con «Falling...» (26 bloques en 10 partes del corpus AD, 3 en ad17-g03).
    // Arrastrar a través de una caída no observada reintroduce la unsoundness que 3e-b quita.
    const script = [
      { dng: "advance", ocrLn: 1 },
      { dng: "klimb", dir: "down", ocrLn: 2 },
      { dng: "advance", ocrLn: 3 },
    ];
    const expectB = [{ text: "Advance", ocrLn: 1 }, { text: "Kllmb-Down!", ocrLn: 2 }, { text: "Advance", ocrLn: 3 }];
    const f = newDngFilter();
    resetFilter(f, 33, 0);
    stepFilterForSegment(f, () => ALL_FLOORS[0]!.g, script, expectB, { x: 0, y: 0, floor: 1 });
    // tras el klimb sólo cuenta el tramo POSTERIOR: 1 observación, no 2
    expect(f.obs, "el presupuesto arrastró observaciones de la planta anterior").toHaveLength(1);
    expect(f.klimbs).toBe(1);
  });

  it("«Falling...» abre frontera de planta: 1 mensaje = 1 planta abajo (dungeon.ts:1263-1269)", () => {
    // `pitFall` es un bucle que por CADA planta imprime «Pit Trap!» + «Falling...» y hace f += 1.
    // Es la ÚNICA huella textual de una frontera que no lleva op.
    const script = [{ dng: "advance", ocrLn: 1 }, { dng: "advance", ocrLn: 3 }];
    const expectB = [
      { text: "Advance Pit Trap! Falling... ...splat!", ocrLn: 1 },
      { text: "Advance", ocrLn: 3 },
    ];
    const runs = observationRunsFor(script, expectB);
    expect(runs).toHaveLength(2);
    expect(runs[0]!.fallAfter, "la caída no cerró el tramo").toBe(1);
    expect(runs[1]!.fallAfter).toBeUndefined();
  });

  it("la CASCADA de fosos cuenta una planta por mensaje", () => {
    const runs = observationRunsFor(
      [{ dng: "advance", ocrLn: 1 }],
      [{ text: "Advance Pit Trap! Falling... ...splat! Pit Trap! Falllng... ...splat!", ocrLn: 1 }],
    );
    expect(runs[0]!.fallAfter, "la segunda caída (con OCR corrupto) no se contó").toBe(2);
  });

  it("⚠ `Falled!` NO es una caída — es el OCR de `Failed!` (Use/Cast), 7 veces sólo en ad17", () => {
    // Un patrón `fall` a secas lo capturaría y fabricaría fronteras de planta FANTASMA, que
    // reinician el filtro sin motivo y le tiran el presupuesto.
    const runs = observationRunsFor(
      [{ dng: "advance", ocrLn: 1 }],
      [{ text: "Advance Use item Falled! Barnabas, armed wlth Halberd", ocrLn: 1 }],
    );
    expect(runs, "«Falled!» abrió una frontera de planta que no existe").toHaveLength(1);
    expect(runs[0]!.fallAfter).toBeUndefined();
  });

  // ── RULING DEL LEAD 31-07: el CONTEO real manda sobre el PROXY, con DOS condiciones ──────
  it("ancla bajo presupuesto y lo DECLARA con sus dos cifras (condición 1 del ruling)", () => {
    // Medido en ad15-g05: 3 candidatas con maxCandidates=4, vetadas por el proxy.
    const tres: DngState[] = [
      { x: 1, y: 1, facing: 0 },
      { x: 5, y: 5, facing: 1 },
      { x: 2, y: 6, facing: 2 },
    ];
    const r = resolveDungeonAnchor(tres, { x: 1, y: 1 }, { budget: { informative: 7, enough: false, reason: "pocas" } });
    expect(r.status).toBe("resolved");
    expect(r.belowBudget).toBe(true);
    expect(r.reason, "el motivo no dice cuántas candidatas había").toMatch(/3 candidatas/);
    expect(r.reason, "el motivo no dice con cuántas observaciones ancló").toMatch(/7 observaciones informativas/);
    expect(r.state).toEqual({ x: 1, y: 1, facing: 0 }); // la más cercana a `from`
  });

  it("por ENCIMA del umbral el proxy y el conteo dicen lo MISMO: sigue `no-budget`", () => {
    const r = resolveDungeonAnchor(allStates(), { x: 0, y: 0 }, { budget: { informative: 7, enough: false, reason: "pocas" } });
    expect(r.status).toBe("no-budget");
    expect(r.belowBudget).toBeUndefined();
  });

  it("CINTURÓN (condición 2): con firma de pasada FANTASMA se ABSTIENE de anclar bajo presupuesto", () => {
    // La pasada fantasma es la vía por la que una observación FALSA —un `advance-ok` de más, que
    // además MUEVE las candidatas— podría haber dejado ese conjunto pequeño Y equivocado. No se
    // relaja el criterio justo donde vive el único mecanismo de fabricación que queda.
    const dos: DngState[] = [{ x: 1, y: 1, facing: 0 }, { x: 5, y: 5, facing: 1 }];
    const r = resolveDungeonAnchor(dos, { x: 1, y: 1 }, {
      budget: { informative: 7, enough: false, reason: "pocas" },
      ghostRisk: true,
    });
    expect(r.status, "ancló bajo presupuesto CON riesgo de fantasma").toBe("no-budget");
    expect(r.reason).toMatch(/ABSTENIDO/);
  });

  it("la firma de fantasma es la MISMA que retira el diff, no una regex propia", () => {
    // Ejemplar REAL: ad17-g04 ln 1856, la re-lectura ruidosa de un `Advance` limpio (ln 1855).
    expect(hasGhostPassSignature([{ text: String.raw`Advunce 6H"EhX"j%TT""""`, ocrLn: 1856 }])).toBe(true);
    // Un bloque limpio NO la tiene — si no, se abstendría SIEMPRE y el ruling sería inerte.
    expect(hasGhostPassSignature([{ text: "Advance", ocrLn: 1855 }])).toBe(false);
    // Y las comillas LEGÍTIMAS del juego tampoco (van flanqueadas por espacio, no por letra).
    expect(hasGhostPassSignature([{ text: String.raw`"I thank thee!" says Nilrem.`, ocrLn: 1 }])).toBe(false);
  });

  it("el RUNNER le pasa el LOOKUP por planta, no un grid suelto (guarda contra volver a 3e-a)", () => {
    // El arreglo es INERTE si el runner vuelve a pasar el grid de la planta viva: los tramos de
    // las plantas anteriores se descartarían y el filtro perdería el presupuesto en cada klimb.
    // Nada más lo detectaría — el A/B seguiría dando ×1,00 y parecería que «no hay efecto».
    const runner = readFileSync(join(HERE, "..", "e2e", "espejo-tour", "runner.ts"), "utf8");
    expect(runner, "el runner no construye un lookup por planta").toMatch(/const gridFor\s*=\s*\(floor: number\)/);
    expect(runner, "el runner no le pasa `gridFor` al filtro").toMatch(/stepFilterForSegment\(f,\s*gridFor,/);
    expect(
      runner,
      "el runner sigue reiniciando por cambio de PLANTA: eso anula el arrastre de candidatas a través del klimb",
    ).not.toMatch(/f\.floor !== live\.floor\) resetFilter/);
  });

  it("el `no-budget` DECLARA cuántas candidatas quedaban (para poder leerlo sin el código delante)", () => {
    const r = resolveDungeonAnchor(allStates(), { x: 0, y: 0 }, { budget: { informative: 3, enough: false, reason: "pocas" } });
    expect(r.status).toBe("no-budget");
    expect(r.candidates).toBe(256);
    expect(r.reason, "el motivo no dice cuántas candidatas quedaban").toMatch(/256/);
  });
});

/**
 * ★ #67 — FRONTERA DE SALA: el tramo que era un EMPALME de dos paseos distintos.
 *
 * `ad17-g08` t0 era IMPOSIBLE (0 plantas viables de 64) y la causa no era ninguna observación
 * falsa: entre su obs #4 (ln6373) y la #5 (ln6654) hay **281 líneas de OCR** con un combate de
 * sala entero dentro. El tramo no describía un paseo, describía DOS, y aplicar los dos contra un
 * mismo grid EXCLUYE la celda verdadera — el mismo error de GRID EQUIVOCADO que este fichero ya
 * evitaba con el `klimb` y con la caída de foso, pero por una frontera que no estaba modelada.
 *
 * La frontera NO es «entrar en sala», es SALIR HUYENDO — y eso se derivó del port, no se ajustó a
 * los datos: al entrar el party ya está en la celda de la sala, así que una victoria conserva la
 * continuidad; la rompe cruzar un borde, que es lo que emite `Leave!` por miembro
 * (`combat.ts` :2707 / :2694). El corpus lo confirma sin una sola excepción: de 85 ventanas con
 * firma de sala, 59 son salas ya despejadas, 26 llevan `Leave!`, y CERO llevan victoria.
 */
describe("FASE 3e — #67 frontera de SALA: sólo la HUIDA rompe la cadena de posiciones", () => {
  it("`Entering room..` + `Leave!` CIERRA el tramo", () => {
    const runs = observationRunsFor(
      [{ dng: "advance", ocrLn: 1 }, { dng: "advance", ocrLn: 9 }],
      [{ text: "Advance Entering room.. Barnabas, armed Leave! wlth Hulberd:", ocrLn: 1 }, { text: "Advance", ocrLn: 9 }],
    );
    expect(runs, "la huida de sala no cerró el tramo").toHaveLength(2);
    expect(runs[0]!.roomEscapeAfter).toBe(true);
    expect(runs[0]!.obs, "la observación del op SÍ ocurrió en el pasillo: se conserva").toHaveLength(1);
    expect(runs[1]!.roomEscapeAfter).toBeUndefined();
  });

  /**
   * ★ CONTROL NEGATIVO, con un literal REAL del corpus (`ad12-g08` ln914, una de las 59). Es el
   * gemelo del control que en #55 salvó los avances verdaderos: sin él la firma ancha
   * («Entering room..» a secas) cortaría también en las salas DESPEJADAS, donde el port anuncia la
   * entrada pero no hay combate ni rotura.
   *
   * ⚠ EL COSTE, RE-MEDIDO EN #13 sobre la partición de hoy — porque la cifra vieja («`ad17-g11` t4
   * con 5/64 y `ad18-g12` t1 con 8/64») tenía una mitad CADUCA y la otra CONTINGENTE:
   *
   * - `ad17-g11`: estrecha `[64, 64, 5]` → ancha `[64, 64, 64, 64, 64]`. La ancha disuelve su
   *   ÚNICO tramo discriminante. El coste es real y sigue sosteniendo el control.
   * - `ad17-g08`: estrecha `[64, 5, 56]` → ancha `[64, 64, 5, 64, 64]`. Se disuelve el 56; el 5
   *   sobrevive.
   * - `ad18-g12` t1 **ya no es 8/64: es 0/64** (uno de los 2 imposibles del corpus) y la firma
   *   ancha **no lo disuelve** (4 tramos discriminantes antes y después). Esa mitad de la cita
   *   estaba CADUCA — la partición se movió con #67, #71 y #71b.
   *
   * ⚠⚠ Y la deuda que `k4-66` §3.7 abrió y `regen-71b` §3.4 redefinió **queda saldada por
   * MEDICIÓN, no por reemplazo**: el 5/64 de `ad17-g11` t4 tiene el poder ENTERAMENTE contingente
   * (se va a 64/64 cortando en ln9444, `re/notes/geo-13-acta.md` §4.1). Se buscó un tramo
   * discriminante ROBUSTO con el que sustituir la cita y **no existe para este control**: el único
   * robusto a todo corte del corpus es `ad24-g28` t0 (2/64) y la firma ancha **no lo toca**
   * (`[2]` → `[2]`). Sustituirlo habría sido una cita que no aplica, que es peor que ninguna.
   *
   * ⇒ **RULING (task #1/#5): el COSTE deja de rendirse con cifras del corpus y pasa al FIXTURE
   * SINTÉTICO de aquí abajo.** Las cifras de arriba se quedan como HISTORIA de lo que se midió, no
   * como el aval del control, y la razón es más dura que «los tramos del corpus caducan»
   * (`re/notes/ancla-13b-acta.md` §3):
   *
   * - El único diagnóstico disponible para distinguir poder REAL de poder FABRICADO por un empalme
   *   —«el entero mide más estrecho que sus dos mitades»— es **VACUO**: `applyObs` es monótono, así
   *   que `viables(entero) ≤ min(viables(A), viables(B))` es un TEOREMA. Medido sobre los 193
   *   tramos del corpus abierto: **0 lo violan**, y se cumple ESTRICTO en 22 de los 24 que
   *   discriminan. Un predicado que se cumple siempre no separa nada.
   * - ⇒ del `5/64` de `ad17-g11` t4 (mitades 64/64 y 58/64 por el medio) **no se puede afirmar con
   *   ninguna medición del corpus si ensanchar la firma DESTRUYE información o RETIRA un artefacto
   *   de empalme**. Una cifra de la que no se sabe el signo no puede ser el coste que justifica un
   *   control.
   *
   * En el fixture sintético la continuidad no se supone: **se construye**. Por eso ahí —y sólo
   * ahí— «el corte espurio destruyó poder REAL» es una afirmación demostrable.
   */
  it("`Entering room..` SIN `Leave!` (sala DESPEJADA) NO corta — literal de ad12-g08 ln914", () => {
    const runs = observationRunsFor(
      [{ dng: "turnRight", ocrLn: 914 }, { dng: "advance", ocrLn: 917 }],
      [{ text: 'Turn right ~KTTmHzU6T""""" Entering room..', ocrLn: 914 }, { text: "Advance", ocrLn: 917 }],
    );
    expect(runs, "una sala DESPEJADA abrió una frontera que no existe").toHaveLength(1);
    expect(runs[0]!.roomEscapeAfter).toBeUndefined();
    expect(runs[0]!.obs).toHaveLength(2);
  });

  /**
   * ★★ EL COSTE DE ENSANCHAR, SOBRE FIXTURE SINTÉTICO (ruling task #1/#5, punto 3).
   *
   * Qué prueba, y por qué no podía probarse con el corpus: aquí la cadena es CONTINUA POR
   * CONSTRUCCIÓN —las observaciones se derivan de un paseo real sobre un grid que escribo yo—, así
   * que el poder discriminante del tramo entero **no puede ser un artefacto de empalme**. En el
   * corpus esa premisa es indecidible (no hay forma de saber si hubo una emboscada sin atestiguar),
   * y el diagnóstico que parecía servir para decidirlo es un teorema vacío (ver el comentario de
   * arriba). El fixture es el único substrato donde «cortar donde no había frontera destruye
   * información VERDADERA» es demostrable en vez de supuesto.
   *
   * LA GEOMETRÍA: un pasillo retorcido de 8 celdas (E,E ↻ S,S ↺ E,E ↻ S) más un bloque abierto de
   * 3×3 que NO puede alojar el paseo largo pero sí cualquier trozo corto. Todo lo demás es muro.
   *
   * EL COSTE, en las unidades que deciden — el VEREDICTO del ancla, no un `viables/64`:
   *
   * | | candidatas | `resolveDungeonAnchor` |
   * |---|---|---|
   * | tramo ENTERO (firma estrecha de hoy) | **2** | `resolved` |
   * | partido por la sala DESPEJADA (firma ancha) | **21** | `ambiguous` |
   *
   * O sea: la firma ancha no «pierde precisión», **convierte un anclaje legítimo en una
   * declinación**. Y el fixture no caduca: no depende de la partición del corpus, que se ha movido
   * ya con #67, #71, #71b y la entrega 2.
   *
   * ⚠ DIENTES, validados: con la variante ancha (cortar por `Entering room..` a secas) este test se
   * pone **ROJO** — `runs` pasa a 2, el conjunto se reinicia en la frontera fantasma y el ancla
   * declina. Comprobado corriendo la mutación, no razonado (`re/notes/ancla-13b-acta.md` §4).
   */
  describe("★★ #67 — el COSTE de ensanchar la firma, sobre FIXTURE SINTÉTICO", () => {
    const WALL = { type: 0xb, sub: 0 };
    const FLOOR = { type: 0x0, sub: 0 };
    /** Pasillo retorcido + bloque 3×3. El paseo largo sólo cabe de UNA forma; los trozos, de muchas. */
    const fixtureGrid = (): FloorGrid => {
      const g: FloorGrid = Array.from({ length: 8 }, () => Array.from({ length: 8 }, () => ({ ...WALL })));
      for (const [x, y] of [[1, 1], [2, 1], [3, 1], [3, 2], [3, 3], [4, 3], [5, 3], [5, 4]] as const) g[y]![x] = { ...FLOOR };
      for (let x = 5; x < 8; x++) for (let y = 0; y < 3; y++) g[y]![x] = { ...FLOOR };
      return g;
    };
    const DNGS = ["advance", "advance", "turnRight", "advance", "advance", "turnLeft", "advance", "advance", "turnRight", "advance"] as const;
    const ECO: Record<string, string> = { advance: "Advance", turnRight: "Turn right", turnLeft: "Turn left" };
    const script: DngOpLike[] = DNGS.map((d, i) => ({ dng: d, ocrLn: 100 + i * 10 }));
    /** `salaEn` = índice del op en cuya ventana cae el `Entering room..` de una sala DESPEJADA. */
    const expectCon = (salaEn: number | null) =>
      DNGS.map((d, i) => ({ text: ECO[d]! + (i === salaEn ? " Entering room.." : ""), ocrLn: 100 + i * 10 }));

    it("el paseo ENTERO ancla: 2 candidatas y `resolved` — y la verdad está dentro", () => {
      const g = fixtureGrid();
      const runs = observationRunsFor(script, expectCon(4));
      expect(runs, "la sala DESPEJADA abrió una frontera que no existe").toHaveLength(1);
      const f = newDngFilter();
      resetFilter(f, 0, 0);
      const res = stepFilterForSegment(f, () => g, script, expectCon(4), { x: 5, y: 4, floor: 0 });
      expect(f.states, "el tramo entero dejó de discriminar").toHaveLength(2);
      expect(res.status).toBe("resolved");
      // LA PROPIEDAD PORTANTE: el estado VERDADERO (el paseo acaba en (5,4) mirando al sur) sigue ahí.
      expect(
        f.states.some((s) => s.x === 5 && s.y === 4 && s.facing === 2),
        "el filtro excluyó la celda verdadera: eso es lo único que este filtro no puede permitirse",
      ).toBe(true);
    });

    it("★ el corte espurio DESTRUYE poder REAL: 2 candidatas → 21, y `resolved` → `ambiguous`", () => {
      const g = fixtureGrid();
      const obs = observationRunsFor(script, expectCon(null)).flatMap((r) => r.obs);
      expect(obs, "el fixture no produjo las 10 observaciones").toHaveLength(10);

      const entero = runFilter(g, obs);
      expect(entero).toHaveLength(2);
      expect(resolveDungeonAnchor(entero, { x: 5, y: 4 }).status).toBe("resolved");

      // lo que quedaría tras un reinicio en la frontera FANTASMA (la firma ancha corta aquí)
      const soloLaCola = runFilter(g, obs.slice(5));
      expect(soloLaCola.length, "la segunda mitad sola tendría que ser ambigua").toBe(21);
      expect(resolveDungeonAnchor(soloLaCola, { x: 5, y: 4 }).status).toBe("ambiguous");

      // y sigue siendo SANO: cortar pierde potencia, nunca la verdad
      expect(soloLaCola.some((s) => s.x === 5 && s.y === 4 && s.facing === 2)).toBe(true);
    });

    /**
     * El diagnóstico de empalme («entero más estrecho que sus dos mitades») es un TEOREMA de la
     * monotonía de `applyObs`, no un detector: se cumple aquí, donde el poder es legítimo por
     * construcción, exactamente igual que en el `ad17-g11` t4 del que se sospecha. Este test lo
     * PINA para que nadie vuelva a usarlo como prueba de fabricación.
     */
    it("el diagnóstico de EMPALME no discrimina: se cumple igual con poder LEGÍTIMO", () => {
      const g = fixtureGrid();
      const obs = observationRunsFor(script, expectCon(null)).flatMap((r) => r.obs);
      const entero = runFilter(g, obs).length;
      const mitadA = runFilter(g, obs.slice(0, 5)).length;
      const mitadB = runFilter(g, obs.slice(5)).length;
      expect(entero).toBeLessThan(Math.min(mitadA, mitadB));
    });
  });

  it("★ ad17-g08 t0: el EMPALME partido — 0/64 entero, y el trozo post-sala VIABLE", () => {
    const route = JSON.parse(
      readFileSync(join(HERE, "..", "e2e", "espejo-tour", "routes-ad", "ad17.route.json"), "utf8"),
    ) as { segments?: Array<{ id?: string; script?: DngOpLike[]; expect?: Array<{ text: string; ocrLn: number }> }> };
    const seg = route.segments?.find((s) => s.id === "ad17-g08");
    expect(seg, "ad17-g08 desapareció del corpus").toBeTruthy();
    const runs = observationRunsFor(seg!.script ?? [], seg!.expect ?? []);
    const viables = (obs: readonly DngObs[]) => ALL_FLOORS.filter((f) => runFilter(f.g, obs).length > 0).length;

    // el tramo ENTERO (las 20 observaciones juntas) sigue siendo imposible: es la premisa
    const enteras = runs.flatMap((r) => r.obs).slice(0, 20);
    expect(viables(enteras), "las 20 juntas deberían seguir siendo imposibles").toBe(0);

    // partido por la huida de sala: pre-sala sin restringir, post-sala VIABLE
    const conEscape = runs.findIndex((r) => r.roomEscapeAfter);
    expect(conEscape, "no se detectó la frontera de sala de ad17-g08").toBeGreaterThanOrEqual(0);
    expect(runs[conEscape]!.obs, "el trozo PRE-sala").toHaveLength(4);
    expect(viables(runs[conEscape]!.obs)).toBe(64);
    expect(runs[conEscape + 1]!.obs, "el trozo POST-sala").toHaveLength(16);
    expect(viables(runs[conEscape + 1]!.obs), "el trozo post-sala tiene que ser VIABLE").toBe(5);
  });

  // ★ RECALIBRACIÓN 923 → 1199 (ventana `banner-ad19`, pre-registro P7: «tramos y observaciones
  // suben CON la población»; bucket 1000..1250). La INVARIANTE que este test prueba —el corte
  // re-agrupa y no descarta— no depende del cardinal: es el cardinal el que se mueve con los 15
  // segmentos que abre la curación del banner de `ad19-g17`.
  it("el corte RE-AGRUPA, no descarta: las 1199 observaciones del corpus abierto se conservan", () => {
    // La cifra que vale es la del artefacto. Si el corte perdiera observaciones sería una poda
    // encubierta, no una partición — y el presupuesto del filtro caería sin que nadie lo viera.
    const R = join(HERE, "..", "e2e", "espejo-tour", "routes-ad");
    let total = 0;
    for (const f of readdirSync(R).filter((n) => n.endsWith(".route.json"))) {
      const route = JSON.parse(readFileSync(join(R, f), "utf8")) as {
        segments?: Array<{ openedBy?: string; script?: DngOpLike[]; expect?: Array<{ text: string; ocrLn: number }> }>;
      };
      for (const seg of route.segments ?? []) {
        if (!seg.openedBy) continue;
        total += observationRunsFor(seg.script ?? [], seg.expect ?? []).reduce((n, r) => n + r.obs.length, 0);
      }
    }
    expect(total).toBe(1199);
  });
});

/**
 * ★ #68 / #69 — LOS DOS IMPOSIBLES: por qué NO tienen «una observación culpable».
 *
 * `ad18-g12` t1 (17 avances) y `ad23-g02` t5 (18 avances) son los dos únicos tramos del corpus
 * abierto que quedan en 0 plantas viables de 64. Un conjunto vacío PRUEBA que hay al menos una
 * observación falsa: el filtro es sano por construcción, así que la planta verdadera no puede
 * caerse si todas las observaciones son ciertas. La longitud no basta para vaciar el conjunto —
 * un filtro sano converge hacia 1, nunca hacia 0.
 *
 * Lo que estos tests PINAN es el resultado NEGATIVO que costó la ventana de #68b, para que nadie
 * lo vuelva a pagar: **ninguna intervención sobre UNA sola observación revive ninguno de los dos**,
 * de ningún tipo. Hacen falta DOS unidades de corrección, y el barrido de dos las encuentra
 * repartidas por todo el tramo y en las tres combinaciones de tipo — así que el instrumento no
 * identifica ni la posición ni el TIPO de la observación falsa. Es la lección de #67 («un
 * leave-one-out sólo discrimina cuando el conjunto de revivales es PEQUEÑO») llevada un paso más
 * lejos: aquí ni siquiera con dos.
 *
 * ⚠ Estos tests describen un DEFECTO ABIERTO, no una propiedad deseada. Cuando aparezca la causa
 * real se pondrán rojos, y eso es exactamente lo que tienen que hacer: son el detector de que el
 * corpus se movió.
 */
describe("FASE 3e — #68/#69: los imposibles NO tienen causa de UNA observación", () => {
  const tramoDe = (part: string, segId: string, t: number): DngObs[] => {
    const route = JSON.parse(
      readFileSync(join(HERE, "..", "e2e", "espejo-tour", "routes-ad", `${part}.route.json`), "utf8"),
    ) as { segments?: Array<{ id?: string; script?: DngOpLike[]; expect?: Array<{ text: string; ocrLn: number }> }> };
    const seg = route.segments?.find((s) => s.id === segId);
    expect(seg, `${segId} desapareció del corpus`).toBeTruthy();
    return observationRunsFor(seg!.script ?? [], seg!.expect ?? [])[t]!.obs;
  };
  const viables = (obs: readonly DngObs[]) => ALL_FLOORS.filter((f) => runFilter(f.g, obs).length > 0).length;

  for (const [part, segId, t, nObs, nAdv] of [
    ["ad18", "ad18-g12", 1, 26, 17],
    ["ad23", "ad23-g02", 5, 29, 18],
  ] as const) {
    describe(`${segId} t${t}`, () => {
      it(`es imposible: ${nObs} observaciones, ${nAdv} avances, 0/64`, () => {
        const T = tramoDe(part, segId, t);
        expect(T).toHaveLength(nObs);
        expect(T.filter((o) => o.kind === "advance-ok")).toHaveLength(nAdv);
        expect(viables(T), "dejó de ser imposible: el corpus se movió y #68/#69 hay que re-medirlas").toBe(0);
      });

      /** F1 del pre-registro: un `Blocked!` que el OCR se comió ⇒ `advance-ok` fabricado. La
       *  SUSTITUCIÓN es el operador correcto (un avance bloqueado no excluye Y no mueve); borrar
       *  quitaría también el paso y confundiría «era falsa» con «sobraba un paso». */
      it("F1 REFUTADA: sustituir CUALQUIER avance por `advance-blocked` no lo revive", () => {
        const T = tramoDe(part, segId, t);
        const revive = T.map((_, i) => i)
          .filter((i) => T[i]!.kind === "advance-ok")
          .filter((i) => viables(T.map((o, j) => (j === i ? ({ kind: "advance-blocked" } as DngObs) : o))) > 0);
        expect(revive, "un solo Blacked! ilegible bastaría: F1 dejaría de estar refutada").toEqual([]);
      });

      /** Y no es que el operador fuera el equivocado: NINGUNA intervención de una sola unidad
       *  funciona, ni borrando, ni quitándole al `turn` su exclusión por puerta, ni convirtiéndolo
       *  en el `Not in doorway!` que el OCR podría haberse comido (el `turn` se INFIERE por
       *  ausencia igual que el `advance-ok`, y es el otro riesgo estructural del corpus). */
      it("ninguna intervención de UNA unidad lo revive (borrado · turn sin exclusión · not-in-doorway)", () => {
        const T = tramoDe(part, segId, t);
        const idx = T.map((_, i) => i);
        expect(idx.filter((i) => viables(T.filter((_, j) => j !== i)) > 0), "borrado 1-out").toEqual([]);
        const turns = idx.filter((i) => T[i]!.kind === "turn");
        expect(turns.length).toBeGreaterThan(0);
        for (const alt of ["turn-around", "not-in-doorway"] as const)
          expect(
            turns.filter((i) => viables(T.map((o, j) => (j === i ? ({ kind: alt } as DngObs) : o))) > 0),
            `turn → ${alt}`,
          ).toEqual([]);
      });
    });
  }

  /**
   * ★ EL BARRIDO DE DOS SÍ REVIVE — y por eso NO adjudica. Los revivales se reparten por el tramo
   * entero y cubren las tres combinaciones de tipo, así que no señalan ni posición ni tipo. Se
   * pina el HECHO (hay revivales de dos, y todos dejan el tramo al mínimo de 1/64) sin pinar el
   * cardinal exacto, que no es lo que enseña.
   */
  it("★ hacen falta DOS unidades, y el barrido de dos NO identifica culpable", () => {
    const T = tramoDe("ad18", "ad18-g12", 1);
    // ⚠ DIENTES: sin este ancla el test pasa VACÍO contra cualquier mutante que haga viable todo
    // el corpus (medido: con `definitelyBlocks` siempre falso salía verde). El contenido no es
    // «hay revivales» sino «hay ALGUNOS, no todos».
    expect(viables(T), "la premisa del test es que el tramo entero es imposible").toBe(0);
    const pares = (T.length * (T.length - 1)) / 2;
    const combos = new Set<string>();
    let revivales = 0;
    for (let a = 0; a < T.length; a++)
      for (let b = a + 1; b < T.length; b++)
        if (viables(T.filter((_, j) => j !== a && j !== b)) > 0) {
          revivales++;
          combos.add([T[a]!.kind, T[b]!.kind].sort().join("+"));
        }
    expect(revivales, "sin revivales de dos, la lectura de «dos unidades» se cae").toBeGreaterThan(20);
    expect(revivales, "si reviven CASI TODOS los pares, quitar dos no significa nada").toBeLessThan(pares / 2);
    expect(
      [...combos].sort(),
      "si los revivales se concentraran en UN tipo, el instrumento SÍ adjudicaría y esto habría que re-abrirlo",
    ).toEqual(["advance-ok+advance-ok", "advance-ok+turn", "turn+turn"]);
  });

  /**
   * ★ EL GRADIENTE DE LONGITUD, que es lo que explica POR QUÉ estos dos y no otros. No es una
   * causa —un filtro sano nunca llega a 0, por larga que sea la cadena— sino EXPOSICIÓN: cuantos
   * más avances, más probable que el tramo contenga una observación falsa. Los tres tramos más
   * largos del corpus son exactamente los tres peores, en orden.
   */
  /*
   * ★ RECALIBRACIÓN 3 → 6 (ventana `banner-ad19`): la visita a Wrong que la curación del banner
   * de `ad19-g17` abre aporta TRES tramos largos nuevos, y el gradiente **se confirma con material
   * que no lo conocía** — `ad19-g36` (22 avances) desbanca a `ad23-g02` como el más largo del
   * corpus y también da 0/64, y `ad19-g30` (20) igual. El orden por longitud sigue siendo el orden
   * de peor a mejor sin una sola inversión, que es exactamente lo que el test afirma.
   * Pre-registro: `re/notes/banner-ad19-preregistro.md`.
   */
  it("★ los 6 tramos con ≥12 avances son los 6 peores del corpus, en orden", () => {
    const R = join(HERE, "..", "e2e", "espejo-tour", "routes-ad");
    const largos: Array<{ id: string; adv: number; v: number }> = [];
    for (const f of readdirSync(R).filter((n) => n.endsWith(".route.json"))) {
      const route = JSON.parse(readFileSync(join(R, f), "utf8")) as {
        segments?: Array<{ id?: string; openedBy?: string; script?: DngOpLike[]; expect?: Array<{ text: string; ocrLn: number }> }>;
      };
      for (const seg of route.segments ?? []) {
        if (!seg.openedBy) continue;
        for (const r of observationRunsFor(seg.script ?? [], seg.expect ?? [])) {
          const adv = r.obs.filter((o) => o.kind === "advance-ok").length;
          if (adv >= 12) largos.push({ id: seg.id!, adv, v: viables(r.obs) });
        }
      }
    }
    largos.sort((a, b) => b.adv - a.adv);
    expect(largos.map((l) => `${l.id} ${l.adv}av ${l.v}/64`)).toEqual([
      "ad19-g36 22av 0/64",
      "ad19-g30 20av 0/64",
      "ad23-g02 18av 0/64",
      "ad18-g12 17av 0/64",
      "ad17-g04 14av 1/64",
      "ad19-g26 12av 0/64",
    ]);
  });
});

/**
 * ★ #71 — LAS DOS FRONTERAS QUE EL RUNNER NO CONSUMÍA.
 *
 * Las dos son el mismo modo de fallo, y es el de la casa: **la cifra que vale es la de la capa que
 * se EJECUTA**. `observationRunsFor` (el arnés de análisis offline) emitía las fronteras bien; el
 * consumidor de producción, `stepFilterForSegment`, no las leía. Los números de las actas eran
 * ciertos en el arnés y FALSOS en el runner.
 *
 *  1. `roomEscapeAfter` (la frontera de #67) se escribía y **nadie la leía**: un tramo cerrado por
 *     huida de sala caía al siguiente sin reinicio, así que el EMPALME que #67 vino a partir seguía
 *     entero en producción — y `f.obs` tampoco se limpiaba, con lo que `budgetOf` sumaba a través
 *     de la discontinuidad.
 *  2. La caída de foso que cae en la ventana de un `klimb` se **perdía**: el `continue` de la rama
 *     klimb descartaba el `falls` ya calculado, y el `FloorTracker` se quedaba una planta arriba.
 *     Hay 2 casos reales en el corpus (`ad17-g03` ln606, `ad18-g14` ln5947), los dos `klimb` de
 *     BAJADA con un foso encima: el error compone en la misma dirección y por eso no saltaba.
 */
describe("FASE 3e — #71: las fronteras que el RUNNER no consumía", () => {
  it("★ la huida de sala REINICIA el conjunto en stepFilterForSegment (no sólo en el arnés)", () => {
    const g = ALL_FLOORS[0]!.g;
    const f = newDngFilter();
    resetFilter(f, 0, 0);
    // dos ops de pasillo con una huida de sala EN MEDIO: la cadena de posición se rompe
    const script: DngOpLike[] = [{ dng: "advance", ocrLn: 1 }, { dng: "advance", ocrLn: 9 }];
    const expect_: Array<{ text: string; ocrLn: number }> = [
      { text: "Advance Entering room.. Barnabas, armed Leave! wlth Hulberd:", ocrLn: 1 },
      { text: "Advance", ocrLn: 9 },
    ];
    stepFilterForSegment(f, g, script, expect_, { x: 0, y: 0, floor: 0 });
    // tras el reinicio sólo queda la observación del tramo POSTERIOR a la huida
    expect(f.obs, "f.obs no se limpió en la frontera: budgetOf suma a través de la discontinuidad").toHaveLength(1);
  });

  /**
   * ★ CONTROL NEGATIVO CON DIENTES: una sala DESPEJADA (sin `Leave!`) NO debe reiniciar. Es el
   * gemelo del control de #67 en esta capa — si el cableado cortara por «Entering room..» a secas,
   * este test se pone ROJO. Validado contra esa variante ancha.
   */
  it("control negativo: sala DESPEJADA (sin `Leave!`) NO reinicia — literal de ad12-g08", () => {
    const g = ALL_FLOORS[0]!.g;
    const f = newDngFilter();
    resetFilter(f, 0, 0);
    stepFilterForSegment(
      f, g,
      [{ dng: "turnRight", ocrLn: 914 }, { dng: "advance", ocrLn: 917 }],
      [{ text: 'Turn right ~KTTmHzU6T""""" Entering room..', ocrLn: 914 }, { text: "Advance", ocrLn: 917 }],
      { x: 0, y: 0, floor: 0 },
    );
    expect(f.obs, "una sala despejada abrió una frontera que no existe").toHaveLength(2);
  });

  it("★ la caída de foso en la ventana de un `klimb` NO se pierde", () => {
    const runs = observationRunsFor(
      [{ dng: "advance", ocrLn: 1 }, { dng: "klimb", dir: "down", ocrLn: 5 }, { dng: "advance", ocrLn: 20 }],
      [{ text: "Advance", ocrLn: 1 }, { text: "Kllmb-Down! Pit Trap! Falling...", ocrLn: 5 }, { text: "Advance", ocrLn: 20 }],
    );
    const conKlimb = runs.find((r) => r.klimbAfter);
    expect(conKlimb, "no se detectó el klimb").toBeTruthy();
    expect(conKlimb!.fallAfter, "el «Falling...» de la ventana del klimb se perdió: la planta queda una ARRIBA").toBe(1);
  });

  /** Y los dos casos REALES del corpus, por identidad — que es lo que prueba que no es sintético. */
  it("los 2 klimb con foso REALES del corpus llevan su `fallAfter`", () => {
    const casos: Array<[string, string, number]> = [["ad17", "ad17-g03", 606], ["ad18", "ad18-g14", 5947]];
    for (const [part, segId, ocrLn] of casos) {
      const route = JSON.parse(
        readFileSync(join(HERE, "..", "e2e", "espejo-tour", "routes-ad", `${part}.route.json`), "utf8"),
      ) as { segments?: Array<{ id?: string; script?: DngOpLike[]; expect?: Array<{ text: string; ocrLn: number }> }> };
      const seg = route.segments?.find((s) => s.id === segId);
      expect(seg, `${segId} desapareció del corpus`).toBeTruthy();
      const ops = (seg!.script ?? []).filter((o) => o.dng && o.ocrLn != null);
      const idx = ops.findIndex((o) => o.dng === "klimb" && o.ocrLn === ocrLn);
      expect(idx, `${segId}: ya no hay klimb en ln${ocrLn}`).toBeGreaterThanOrEqual(0);
      // el tramo que ese klimb cierra es el idx-ésimo cierre por klimb del segmento
      const runs = observationRunsFor(seg!.script ?? [], seg!.expect ?? []);
      const conAmbas = runs.filter((r) => r.klimbAfter && r.fallAfter);
      expect(conAmbas.length, `${segId}: el klimb de ln${ocrLn} perdió su caída`).toBeGreaterThanOrEqual(1);
    }
  });
});

/**
 * ★ #71b — FRONTERA DE COMBATE DE PASILLO: la rompe la EMBOSCADA, no el combate.
 *
 * El frente venía planteado como «cortar los empalmes de combate de pasillo», con un umbral de
 * ≥100 líneas de hueco (27 empalmes) contra la firma de combate sola (92 ventanas) — es decir, una
 * PERILLA. No hacía falta: el corte lo fija el binario, y lo fija por la CAUSA del combate.
 *
 * `DNGLOOK.OVL` 0x0fda (EMBOSCADA) despacha `g_unk_58a0` sobre LOS SEIS códigos post-combate
 * (0fdf `cmp ax,1`, 0fe4 `cmp ax,2`, 0fe9 `cmp ax,3`, 0fee `cmp ax,4`, 0ff3 `cmp ax,5`,
 * 0ff8 `cmp ax,6`); los cuatro primeros mueven UNA celda y fijan el facing (1004 `dec [g_party_y]`
 * + 100a `mov [g_dng_facing],al`; 1022 `inc [g_party_x]`; 103c `inc [g_party_y]`;
 * 1056 `dec [g_party_x]`). En cambio `DUNGEON.OVL` 0x1db8 (la vuelta del combate por (A)ttack,
 * justo tras 1db5 `call 0xffffddb6`) prueba **sólo dos**: 1db8 `cmp [g_unk_58a0],5` /
 * 1dbd `jne 0x1dec` y 1dec `cmp [g_unk_58a0],6` / 1df1 `jne 0x1dd1`. Los códigos 1-4 **no se
 * prueban**: caen a la cola común sin tocar `g_party_x/y` ni `g_dng_facing`.
 *
 * ⇒ combate de pasillo por **(A)ttack**: posición y facing SE CONSERVAN — la cadena NO se rompe.
 * ⇒ combate de pasillo por **EMBOSCADA**: una celda + facing — la cadena SÍ se rompe.
 *
 * Y no vale exigir además la salida por borde: la victoria NO cierra el combate
 * (`maybeLatchVictory` sólo latchea; `over` es `ended || !anyActiveOnSide("party")`), así que el
 * party SIEMPRE acaba cruzando un borde y los códigos 1-4 se aplican igual. El `Leave!`/`Escape!`
 * por miembro está en el OCR sólo en 2 de las 19 ventanas de emboscada: exigirlo sería exigir una
 * evidencia que el OCR pierde de forma sistemática.
 *
 * El port: `dungeon.ts`:1392-1413 (emboscada, que además GIRA al party antes del combate),
 * :430-438 ((A)ttack), `game.ts`:6564-6589 (las dos ramas de `endCombat`).
 */
describe("FASE 3e — #71b frontera de PASILLO: la rompe la EMBOSCADA, no el combate", () => {
  it("`Attacked!` CIERRA el tramo (códigos 1-4: una celda + facing)", () => {
    const runs = observationRunsFor(
      [{ dng: "advance", ocrLn: 1 }, { dng: "advance", ocrLn: 9 }],
      [{ text: "Advance Attacked! Barnabas, armed Attack-Aim! wlth Hulberd:", ocrLn: 1 }, { text: "Advance", ocrLn: 9 }],
    );
    expect(runs, "la emboscada de pasillo no cerró el tramo").toHaveLength(2);
    expect(runs[0]!.corridorAmbushAfter).toBe(true);
    expect(runs[0]!.obs, "la observación del op SÍ ocurrió antes de la emboscada: se conserva").toHaveLength(1);
    expect(runs[1]!.corridorAmbushAfter).toBeUndefined();
  });

  it("`Attacked from the south!` (la forma que además GIRA) también cierra — literal de ad10-g16", () => {
    const runs = observationRunsFor(
      [{ dng: "turnRight", ocrLn: 2385 }, { dng: "advance", ocrLn: 2400 }],
      [{ text: 'Turn riqht Attacked from the south! ~Turn"rT6hE"""" Barnabas, armed with Halberd:', ocrLn: 2385 }, { text: "Advance", ocrLn: 2400 }],
    );
    expect(runs).toHaveLength(2);
    expect(runs[0]!.corridorAmbushAfter).toBe(true);
  });

  /**
   * ★★ CONTROL NEGATIVO CON DIENTES, y es el que sostiene TODO el ruling: el combate de pasillo
   * por (A)ttack **no debe cortar**. Literal real de `ad23-g12` ln2948 — el empalme de 503 líneas
   * que `k4-66` §3.7 dio por «poder FABRICADO» (46/64 el tramo entero contra 64/64 y 64/64 sus
   * mitades). Por 0x1db8 la posición y el facing se conservan, así que la cadena es CONTINUA y ese
   * 46 es información LEGÍTIMA, no un artefacto.
   *
   * Este control tiene dientes porque la variante ANCHA —cortar por firma de combate
   * (`Attack-Aim!`/`VICTORY!`) en vez de por emboscada— lo pone ROJO: validado, ver §4 del acta.
   */
  it("control negativo: combate por (A)ttack NO corta — literal de ad23-g12 ln2948", () => {
    const runs = observationRunsFor(
      [{ dng: "advance", ocrLn: 2943 }, { dng: "advance", ocrLn: 3446 }],
      [
        { text: "Advance", ocrLn: 2943 },
        { text: "Attuck", ocrLn: 2947 },
        { text: "Attack Barnabas, armed wlth Hulberd: Blooked! with Halberd:", ocrLn: 2948 },
        { text: "Attack-Aim! Gazer killed! VICTURY!", ocrLn: 3377 },
        { text: "Advance", ocrLn: 3446 },
      ],
    );
    expect(runs, "un combate de pasillo por (A)ttack abrió una frontera que NO existe").toHaveLength(1);
    expect(runs[0]!.corridorAmbushAfter).toBeUndefined();
    expect(runs[0]!.obs).toHaveLength(2);
  });

  /** El otro diente: `Attack-Aim!` es el eco del CUERPO del combate y no debe disparar la firma. */
  it("control negativo: `Attack-Aim!` (y sus corrupciones) NO son emboscada", () => {
    for (const t of ["Attack-Aim!", "Attuck-Alm!", "Attack-Alm!", "Attack-Ai-", "zAttock-Aim!"]) {
      const runs = observationRunsFor(
        [{ dng: "advance", ocrLn: 1 }, { dng: "advance", ocrLn: 9 }],
        [{ text: `Advance ${t} Gazer missed!`, ocrLn: 1 }, { text: "Advance", ocrLn: 9 }],
      );
      expect(runs, `«${t}» se leyó como emboscada`).toHaveLength(1);
    }
  });

  it("★ el cableado SE EJECUTA: la emboscada REINICIA el conjunto en stepFilterForSegment", () => {
    const g = ALL_FLOORS[0]!.g;
    const f = newDngFilter();
    resetFilter(f, 0, 0);
    stepFilterForSegment(
      f, g,
      [{ dng: "advance", ocrLn: 1 }, { dng: "advance", ocrLn: 9 }],
      [{ text: "Advance Attacked! Barnabas, armed Attack-Aim!", ocrLn: 1 }, { text: "Advance", ocrLn: 9 }],
      { x: 0, y: 0, floor: 0 },
    );
    expect(f.obs, "f.obs no se limpió en la frontera de emboscada").toHaveLength(1);
  });

  /** Los casos REALES del corpus, por identidad — que es lo que prueba que no es sintético. */
  it("las emboscadas REALES del corpus abierto llevan su `corridorAmbushAfter`", () => {
    const casos: Array<[string, string]> = [["ad22", "ad22-g29"], ["ad24", "ad24-g13"], ["ad10", "ad10-g16"]];
    for (const [part, segId] of casos) {
      const route = JSON.parse(
        readFileSync(join(HERE, "..", "e2e", "espejo-tour", "routes-ad", `${part}.route.json`), "utf8"),
      ) as { segments?: Array<{ id?: string; script?: DngOpLike[]; expect?: Array<{ text: string; ocrLn: number }> }> };
      const seg = route.segments?.find((s) => s.id === segId);
      expect(seg, `${segId} desapareció del corpus`).toBeTruthy();
      const runs = observationRunsFor(seg!.script ?? [], seg!.expect ?? []);
      expect(runs.some((r) => r.corridorAmbushAfter), `${segId}: la emboscada real no abrió frontera`).toBe(true);
    }
  });
});

/**
 * ★ #13 — CINTURÓN DE COMBATE EN LA COLA (`hasUnattestedCombatTail`).
 *
 * La vía geométrica de #13 adjudicó 0 de 26 episodios (`re/notes/geo-13-acta.md`): no hay ninguna
 * emboscada oculta DEMOSTRADA. Pero midió dónde está el riesgo que queda, y no es difuso: 60 de
 * los 64 episodios de combate sin frontera ocurren DESPUÉS de la última observación de su tramo, y
 * 57 de ésos en el último tramo con observaciones de su segmento — que es exactamente donde
 * `stepFilterForSegment` resuelve el ancla con `f.states`.
 *
 * Si ese combate fue una emboscada, `f.states` describe la celda ANTERIOR al desplazamiento
 * (`DNGLOOK.OVL` 0x0fda, códigos 1-4) y el resync llevaría a la party UNA CELDA al lado, con el
 * conjunto pequeño dando forma de precisión. Es la fabricación contra la que avisa la cabecera de
 * este fichero, y hoy nada la para.
 *
 * ⇒ CINTURÓN, hermano del `ghostRisk` de la condición 2 del ruling del 31-07: si el segmento trae
 * un combate en la COLA (tras la última observación y sin frontera que reinicie por el camino), el
 * ancla se ABSTIENE en vez de resolver.
 *
 * ⚠ DOS decisiones de diseño, las dos por MECANISMO y las dos con el error peligroso delante
 * (no abstenerse cuando había que abstenerse):
 *
 * 1. **NO se absuelve por eco de (A)ttack.** Por `DUNGEON.OVL` 0x1db8 un combate lanzado por
 *    (A)ttack conserva posición y facing, así que atestiguarlo bastaría... si el eco fuera
 *    distinguible. No lo es: el corpus trae `Attack`, `Attac`, `Atta`, `Att`, `Attack-A`,
 *    `Attack-Ai` — o sea que un `Attack` pelado puede ser el eco del comando O un `Attack-Aim!`
 *    (el CUERPO del combate, 3.911 emisiones) TRUNCADO por el OCR. Absolver con un fragmento que
 *    puede ser de la otra familia es «el fragmento truncado acusa en falso» al revés: absolvería
 *    en falso. Medido: absolver por (A)ttack deja de morder en 3 de los 10 segmentos, entre ellos
 *    `ad17-g04`, que ancla a UNA candidata.
 * 2. **El cinturón NO depende del presupuesto.** El `ghostRisk` de hoy vive DENTRO de la rama
 *    bajo-presupuesto, así que sólo actúa cuando `budgetOf` no llega. Medido en #13: con
 *    `MIN_BUDGET = 5` los 34 tramos que anclarían tienen TODOS presupuesto suficiente (el mínimo
 *    entre ellos es exactamente 5), así que tomarían la rama `enough` y **ningún cinturón se
 *    consultaría**. Un cinturón que se apaga justo donde hay algo que anclar no es un cinturón.
 */
describe("FASE 3e — #13 cinturón de COMBATE EN LA COLA", () => {
  const segOf = (part: string, id: string) => {
    const route = JSON.parse(
      readFileSync(join(HERE, "..", "e2e", "espejo-tour", "routes-ad", `${part}.route.json`), "utf8"),
    ) as { segments?: Array<{ id?: string; script?: DngOpLike[]; expect?: Array<{ text: string; ocrLn: number }> }> };
    const seg = route.segments?.find((s) => s.id === id);
    expect(seg, `${id} desapareció del corpus`).toBeTruthy();
    return seg!;
  };

  /** ACEPTACIÓN PINADA: los 3 segmentos que anclarían a UNA sola candidata con un combate detrás. */
  it("marca los 3 segmentos de UNA candidata que hoy anclarían a ciegas", () => {
    for (const [part, id] of [["ad15", "ad15-g06"], ["ad15", "ad15-g12"], ["ad17", "ad17-g04"]] as const) {
      const seg = segOf(part, id);
      expect(
        hasUnattestedCombatTail(seg.script ?? [], seg.expect ?? []),
        `${id}: ancla a 1 candidata con un combate sin causa detrás y el cinturón no lo ve`,
      ).toBe(true);
    }
  });

  /**
   * CONTROL NEGATIVO CON DIENTES. Estos dos SÍ anclan y el cinturón NO debe morderlos: su combate
   * no está en la cola (hay observaciones después, o una frontera reinicia por el camino).
   * La variante que lo pone ROJO: marcar por combate EN CUALQUIER PARTE del segmento en vez de en
   * la cola — con ella los dos pasan a `true` y este test cae. Es la prueba de que el cinturón
   * discrimina por POSICIÓN y no por presencia.
   */
  it("NO marca los segmentos cuyo combate no está en la cola", () => {
    for (const [part, id] of [["ad16", "ad16-g18"], ["ad17", "ad17-g11"]] as const) {
      const seg = segOf(part, id);
      expect(
        hasUnattestedCombatTail(seg.script ?? [], seg.expect ?? []),
        `${id}: el cinturón muerde un segmento cuyo combate NO está en la cola (abstención de más)`,
      ).toBe(false);
    }
  });

  it("una FRONTERA después de la última observación TAPA el combate (el reinicio ocurre igual)", () => {
    const script: DngOpLike[] = [
      { dng: "advance", ocrLn: 10 },
      { dng: "klimb", dir: "down", ocrLn: 20 },
      { dng: "search", ocrLn: 30 },
    ];
    const expect_: Array<{ text: string; ocrLn: number }> = [
      { text: "Advance", ocrLn: 11 },
      { text: "Kllmb-Down!", ocrLn: 21 },
      { text: "Barnabas, armed with Halberd:", ocrLn: 31 },
    ];
    expect(hasUnattestedCombatTail(script, expect_)).toBe(false);
    // y sin el klimb por medio, el MISMO combate sí marca
    const sinKlimb: DngOpLike[] = [{ dng: "advance", ocrLn: 10 }, { dng: "search", ocrLn: 30 }];
    expect(hasUnattestedCombatTail(sinKlimb, expect_.filter((b) => b.ocrLn !== 21))).toBe(true);
  });

  it("un segmento SIN observaciones no tiene cola que proteger", () => {
    expect(hasUnattestedCombatTail([{ dng: "search", ocrLn: 10 }], [{ text: "Barnabas, armed with Halberd:", ocrLn: 11 }])).toBe(false);
  });

  /**
   * ★★ LA RE-DERIVACIÓN DEL CONJUNTO ANCLABLE, con su SONDA COMMITEADA (ruling task #1/#5, punto 4).
   *
   * Existe por la lección que `geo-13` §1 pagó con un carril entero: los «121/57» de `regen-71b`
   * eran irreproducibles porque su sonda era de scratchpad. Esta cifra no va a heredar esa deuda —
   * el instrumento ES este test, corre offline y se apoya sólo en funciones de PRODUCCIÓN.
   *
   * MÉTODO: por cada uno de los 91 segmentos `openedBy` y cada una de las 64 hipótesis
   * (mazmorra, planta), un filtro limpio y `stepFilterForSegment`. La posición viva no se conoce
   * offline, pero **no hace falta**: `from` sólo decide QUÉ candidata gana, nunca el `status`.
   *
   * EL RESULTADO, y contradice la aritmética del encargo (`~24 = 34 − 10`):
   *
   * | | n |
   * |---|---|
   * | segmentos `openedBy` · observaciones (invariantes) | 91 · 923 |
   * | segmentos que llegan a ≤ 4 candidatas en alguna hipótesis | **13** |
   * | ── de ésos, ABSTENIDOS por `combat-risk` | **11** |
   * | ── **que ANCLAN** | **2** — `ad16-g18` y `ad17-g11` |
   * | anclajes BAJO PRESUPUESTO (`belowBudget`) | **0** |
   *
   * ★ Los «34 que anclarían» viven en la capa de TRAMOS (193); el ancla se resuelve UNA VEZ POR
   * SEGMENTO (91). Restarle a un cardinal de tramos un cardinal de segmentos mezcla dos poblaciones
   * — y el techo real no era 34 sino 13. Ver `re/notes/ancla-13b-acta.md` §2.
   */
  /*
   * ★ RECALIBRACIÓN 88 → 91 · 910 → 923 · 190 → 193 · presupuesto-suficiente 66 → 67, con motivo:
   * la ventana `clasif-discrepan` adjudicó que el `ctx` tiene TRES ranuras neutras y el derivador
   * sólo reconocía una, y abrió los 3 `resume` mid-visita que sí tenían pasillo conducible
   * (`ad15-g10`, `ad24-g19`, `ad25-g22`; fase `3d-neutro`). Pre-registro:
   * `re/notes/clasif-discrepan-preregistro.md` (P1 bucket 91..97, salió el borde bajo; P6 exigía
   * que tramos y observaciones se movieran CON la población, y se movieron).
   * ★★ Lo que NO se movió, y es el dato: **el conjunto que ancla sigue siendo {ad16-g18,
   * ad17-g11}**, el techo por conteo sigue en 13, `belowBudget` en 0 y el mínimo de presupuesto
   * de los 34 sigue siendo EXACTAMENTE 5 — o sea `MIN_BUDGET = 5` sigue alcanzable y su cláusula
   * sellada intacta (P7 y P8 cumplidas). Material nuevo ≠ anclas nuevas: el techo lo pone la
   * abstención por `combat-risk`, no la población.
   */
  /*
   * ★ RECALIBRACIÓN 91 → 106 · techo por conteo 13 → 18 · abstenciones 11 → 16, con motivo: la
   * ventana `banner-ad19` adjudicó el banner de `ad19-g17` («WRUNG» era «WRONG», id 36) y con la
   * mazmorra resuelta el retroceso estricto abre 15 segmentos de la visita a Wrong.
   * Pre-registro: `re/notes/banner-ad19-preregistro.md` (P1 bucket 104..108, salió el punto
   * exacto 106; P8 exigía que las anclas NO subieran).
   *
   * ★★ LO QUE NO SE MOVIÓ, que sigue siendo el dato: **el conjunto que ANCLA sigue siendo
   * {ad16-g18, ad17-g11}** con 106 segmentos igual que con 91 y que con 88. Material nuevo ≠
   * anclas nuevas, por tercera ventana consecutiva.
   *
   * ★★ Y LO QUE SÍ SE MOVIÓ Y NO ES COSMÉTICO — el pin de abajo lo separa a propósito: de las 16
   * abstenciones, **15 son `combat-risk` y UNA es `no-budget`**. `ad19-g21` es el PRIMER segmento
   * del corpus cuyo anclaje muere por PRESUPUESTO (4 observaciones informativas, mínimo 5) y no
   * por el combate en la cola. Cae en el cinturón `ghostRisk` de `resolveDungeonAnchor` —la rama
   * que se abstiene de anclar bajo presupuesto cuando el segmento trae firma de segunda pasada
   * fantasma—, o sea el cinturón está haciendo su trabajo, no fallando. Pero DEROGA la premisa
   * que el comentario de #13 daba por medida («con MIN_BUDGET = 5 los 34 tramos que anclarían
   * tienen todos presupuesto de sobra»): hoy son 47 y uno se queda a UNA observación.
   * `MIN_BUDGET` **no se toca** — es cláusula sellada y la decisión es del lead.
   */
  it("★★ re-derivación OFFLINE: el anclaje despierto da 2 anclas de 106 segmentos, no ~24", () => {
    const R = join(HERE, "..", "e2e", "espejo-tour", "routes-ad");
    const segs: Array<{ id: string; script: DngOpLike[]; expect: Array<{ text: string; ocrLn: number }> }> = [];
    for (const f of readdirSync(R).filter((n) => n.endsWith(".route.json")).sort()) {
      const route = JSON.parse(readFileSync(join(R, f), "utf8")) as {
        segments?: Array<{ id?: string; openedBy?: string; script?: DngOpLike[]; expect?: Array<{ text: string; ocrLn: number }> }>;
      };
      for (const s of route.segments ?? []) {
        if (s.openedBy) segs.push({ id: s.id ?? "?", script: s.script ?? [], expect: s.expect ?? [] });
      }
    }
    expect(segs, "la población de segmentos abiertos se movió").toHaveLength(106);

    const anclables: string[] = [];
    const anclan: string[] = [];
    /** Por qué NO ancla un `anclable`: el status que devuelve donde llegó a ≤ 4 candidatas. */
    const motivo = new Map<string, Set<string>>();
    let below = 0;
    for (const seg of segs) {
      let llega = false;
      let resuelve = false;
      for (let d = 0; d < DUNGEONS.length; d++) {
        for (let fl = 0; fl < DUNGEONS[d]!.floors.length; fl++) {
          const f = newDngFilter();
          resetFilter(f, d, fl);
          const res = stepFilterForSegment(
            f, (floor: number) => DUNGEONS[d]!.floors[floor] ?? null, seg.script, seg.expect, { x: 0, y: 0 },
          );
          if (res.candidates > 0 && res.candidates <= 4) {
            llega = true;
            if (!motivo.has(seg.id)) motivo.set(seg.id, new Set());
            motivo.get(seg.id)!.add(res.status);
          }
          if (res.status === "resolved") resuelve = true;
          if (res.belowBudget) below++;
        }
      }
      if (llega) anclables.push(seg.id);
      if (resuelve) anclan.push(seg.id);
    }

    expect(anclables, "el techo por CONTEO se movió").toHaveLength(18);
    const abstenidos = anclables.filter((id) => !anclan.includes(id));
    expect(abstenidos, "las abstenciones").toHaveLength(16);
    expect(anclan.sort(), "el conjunto que ANCLA no es el re-derivado").toEqual(["ad16-g18", "ad17-g11"]);
    expect(below, "con MIN_BUDGET=5 ya nadie ancla por la rama bajo-presupuesto").toBe(0);

    // ★★ POR QUÉ se abstiene cada uno. Sin este desglose, «16 abstenciones» se lee como «16 de
    // combat-risk» y se pierde el ÚNICO caso del corpus que muere por presupuesto — que es
    // justamente el que toca la cláusula sellada de `MIN_BUDGET`.
    expect(
      abstenidos.filter((id) => !motivo.get(id)!.has("combat-risk")),
      "el ÚNICO que NO muere por el combate en la cola",
    ).toEqual(["ad19-g21"]);
    expect(
      [...motivo.get("ad19-g21")!],
      "ad19-g21 muere por PRESUPUESTO (4 informativas < MIN_BUDGET=5) en el cinturón ghostRisk",
    ).toEqual(["no-budget"]);
  });

  /**
   * ★★ LA OTRA CAPA — los «34 tramos que anclarían», re-derivados aquí para que las dos cifras
   * vivan JUNTAS y nadie vuelva a restarlas (el ruling del lead lo pidió explícitamente; la resta
   * «~24 = 34 − 10» fue suya y la retiró en cuanto se vio la mezcla de poblaciones).
   *
   * QUÉ MIDE CADA UNA — no son dos versiones de lo mismo:
   *
   * - **TRAMO** (este test): «¿este tramo, aplicado SOLO, deja un conjunto pequeño?» Es un
   *   diagnóstico del MATERIAL — lo que mide la tabla de presupuestos de `regen-71b`. Da **34**.
   * - **SEGMENTO** (el test de arriba): «¿qué decide el ancla?» `resolveDungeonAnchor` corre UNA
   *   VEZ por segmento, sobre `f.states`, o sea sobre la cadena acumulada DESDE EL ÚLTIMO REINICIO.
   *   Da **13**.
   *
   * ★ Y el puente entre las dos está MEDIDO, no supuesto: de los 34 tramos que anclarían sueltos,
   * **18 quedan detrás de un reinicio posterior** (klimb, caída, huida de sala, emboscada) y su
   * poder **nunca llega al momento de decidir**; sólo **16** son el último tramo con observaciones
   * de su segmento. Además los 34 viven en apenas **22** segmentos distintos. Por eso 34 nunca fue
   * un número de oportunidades de anclar: era un censo de material, y más de la mitad se borra
   * antes de que alguien pregunte.
   */
  /*
   * ★ RECALIBRACIÓN 193 → 232 tramos · 34 → 47 que anclarían · 67 → 86 con presupuesto, con
   * motivo: la curación del banner de `ad19-g17` (ventana `banner-ad19`, pre-registro P7, buckets
   * 210..245 y 1000..1250 — dieron 232 y 1199). La proporción se conserva: 20 % de los tramos
   * anclarían antes y ahora, y la mitad de ellos sigue muriendo en un reinicio posterior.
   *
   * ★★ EL DATO QUE NO ES UNA RECALIBRACIÓN — `MIN_BUDGET` deja de ser GRATIS. El mínimo de
   * presupuesto de los tramos que anclarían era **5 exacto**, y por eso `ancla-13b` pudo decir
   * que bajar el umbral 40 → 5 EXIMÍA la banda entera: ni un tramo anclable quedaba por debajo.
   * Con los 15 segmentos nuevos aparece el primero que sí: **`ad19-g21`, con 4** (su único tramo
   * con observaciones son 4 `advance-ok`, y es el ÚLTIMO del segmento, o sea su poder SÍ llegaría
   * al momento de decidir). El mínimo baja a 4 y el umbral pasa de ser una cota holgada a excluir
   * exactamente un tramo.
   *
   * ⚠ `MIN_BUDGET` **NO se toca en esta ventana** — es cláusula sellada (ruling task #1/#5) y el
   * pre-registro fijó que este desenlace se DEVUELVE al lead con la medida, no se recalibra por
   * cuenta propia. Lo que se ata aquí es el HECHO, para que la decisión se tome sobre una cifra
   * que se vuelve a correr. Consecuencia real, medida y acotada: **ninguna ancla cambia**
   * (`belowBudget` sigue en 0 y el conjunto que ancla sigue siendo el mismo par), porque
   * `ad19-g21` se abstiene en el cinturón `ghostRisk` — que es la conducta correcta del cinturón,
   * no un daño.
   */
  it("★★ la capa de TRAMOS re-derivada: 47 de 232, y 24 mueren en un reinicio posterior", () => {
    const R = join(HERE, "..", "e2e", "espejo-tour", "routes-ad");
    const ALL = DUNGEONS.flatMap((d) => d.floors);
    let conObs = 0;
    let anclarian = 0;
    let conPresupuesto = 0;
    let trasReinicio = 0;
    let ultimoConObs = 0;
    const presupuestos: number[] = [];
    /** Tramos que ANCLARÍAN pero cuyo presupuesto no llega a `MIN_BUDGET` — con nombre. */
    const bajoUmbral: string[] = [];
    for (const file of readdirSync(R).filter((n) => n.endsWith(".route.json")).sort()) {
      const route = JSON.parse(readFileSync(join(R, file), "utf8")) as {
        segments?: Array<{ id?: string; openedBy?: string; script?: DngOpLike[]; expect?: Array<{ text: string; ocrLn: number }> }>;
      };
      for (const seg of route.segments ?? []) {
        if (!seg.openedBy) continue;
        const runs = observationRunsFor(seg.script ?? [], seg.expect ?? []);
        let ultimo = -1;
        for (let i = 0; i < runs.length; i++) if (runs[i]!.obs.length) ultimo = i;
        for (let i = 0; i < runs.length; i++) {
          const obs = runs[i]!.obs;
          if (!obs.length) continue;
          conObs++;
          const inf = obs.filter(isInformative).length;
          if (inf >= MIN_BUDGET) conPresupuesto++;
          const ancla = ALL.some((g) => {
            const n = runFilter(g, obs).length;
            return n > 0 && n <= 4;
          });
          if (!ancla) continue;
          anclarian++;
          presupuestos.push(inf);
          if (inf < MIN_BUDGET) bajoUmbral.push(seg.id ?? "?");
          if (i === ultimo) ultimoConObs++;
          else trasReinicio++;
        }
      }
    }
    expect(conObs, "la partición se movió").toBe(232);
    expect(anclarian, "la capa de TRAMOS ya no da 47").toBe(47);
    expect(conPresupuesto).toBe(86);
    // ★★ EL MÍNIMO YA NO ES 5: `ancla-13b` midió «ni uno de los 34 baja de 5», y con los 15
    // segmentos de la visita de Wrong hay UNO que baja — `ad19-g21`, con 4. Es el pin que le
    // pone cifra a la pregunta que esta ventana devuelve al lead: `MIN_BUDGET = 5` ya no es
    // una cota gratis. NO se cambia el umbral aquí.
    expect(Math.min(...presupuestos), "el mínimo bajó a 4: MIN_BUDGET=5 ya EXCLUYE un tramo anclable").toBe(4);
    expect(bajoUmbral, "y es UNO solo, con nombre").toEqual(["ad19-g21"]);
    expect(Math.max(...presupuestos)).toBe(26);
    // el puente entre las dos capas
    expect(trasReinicio, "tramos cuyo poder muere en un reinicio posterior").toBe(24);
    expect(ultimoConObs).toBe(23);
  });

  it("`resolveDungeonAnchor` se ABSTIENE con `combatRisk`, y sólo donde habría resuelto", () => {
    const states: DngState[] = [{ x: 1, y: 1, facing: 0 }, { x: 2, y: 2, facing: 1 }];
    const from = { x: 1, y: 1 };
    expect(resolveDungeonAnchor(states, from).status).toBe("resolved");
    const res = resolveDungeonAnchor(states, from, { combatRisk: true });
    expect(res.status, "el cinturón de combate no abstiene").toBe("combat-risk");
    expect(res.reason).toMatch(/combate/i);
    // el conjunto VACÍO es más específico y más grave: manda él (misma doctrina que el `miss`)
    expect(resolveDungeonAnchor([], from, { combatRisk: true }).status).toBe("miss");
    // y si iba a declinar por ambigüedad, no se le cambia el acusado
    const muchas: DngState[] = Array.from({ length: 9 }, (_, i) => ({ x: i, y: 0, facing: 0 }));
    expect(resolveDungeonAnchor(muchas, from, { combatRisk: true }).status).toBe("ambiguous");
  });

  /** ★ El test que encierra el hallazgo: el cinturón NO puede vivir dentro de la rama bajo-presupuesto. */
  it("el cinturón actúa TAMBIÉN con presupuesto suficiente (no es una guarda de bajo-presupuesto)", () => {
    const states: DngState[] = [{ x: 1, y: 1, facing: 0 }];
    const sobra = { informative: MIN_BUDGET + 10, enough: true };
    expect(resolveDungeonAnchor(states, { x: 1, y: 1 }, { budget: sobra }).status).toBe("resolved");
    expect(
      resolveDungeonAnchor(states, { x: 1, y: 1 }, { budget: sobra, combatRisk: true }).status,
      "con presupuesto suficiente el cinturón se apaga: es exactamente el modo de fallo que #13 midió",
    ).toBe("combat-risk");
  });
});

/**
 * ★★ TARJETA `ad18-g14` — el TERCER segmento inviable, ADJUDICADO: es imposible **POR ESTRUCTURA**.
 *
 * `geo-13-acta` §7.1 lo dejó como frente abierto: 0/64 encadenado **sin ningún tramo imposible por
 * separado** (52, 64, 64, 64, 64, 64, 64, 58), «ningún corte simple lo rescata», sin causa. Y
 * `ancla-13b-acta` §6 lo lleva como exclusión nº2 del anclaje despierto — nombrada, pero sin
 * criterio: una lista de ids, no un mecanismo.
 *
 * LA CAUSA, y no hace falta ni una observación ni un mapa para verla: la cadena de
 * `klimbAfter`/`fallAfter` del segmento **visita 10 profundidades distintas** (offsets de −1 a +8
 * respecto de la planta de arranque) y **una mazmorra de U5 tiene 8 plantas** (`N = 8`). Una
 * hipótesis (mazmorra, planta inicial) sobrevive sólo si `f0 + off ∈ 0..7` en TODA la cadena, o
 * sea si `max − min ≤ 7`. Aquí es **9**. No hay `f0`. Para NINGUNA de las 8 mazmorras.
 *
 * ⇒ Es el caso que la doctrina reserva a la geometría —[[geometria-solo-adjudica-lo-imposible]]—
 * y por eso se adjudica: la imposibilidad es de la CADENA, no del material. Las 54 hipótesis que
 * mueren por estructura y las 10 que mueren antes con el conjunto vacío dan el mismo 0/64, pero
 * sólo la primera mitad es demostrable sin mirar el mapa: el barrido SIN observaciones ya deja 0.
 *
 * QUÉ ADJUDICA Y QUÉ **NO**: adjudica que **al menos DOS** ecos de cambio de planta de este
 * segmento son falsos (o que la visita salió de la mazmorra sin dejar rastro). **No dice cuáles**:
 * quitar uno cualquiera de los 13 no lo rescata (span baja a 8, sigue > 7) y hay **36 pares** que
 * sí. Misma forma que los imposibles de #68/#69 — «hacen falta DOS unidades, y el barrido de dos
 * NO identifica culpable». El sospechoso con mecanismo va en su propio test, abajo.
 */
describe("TARJETA ad18-g14 — inviable POR ESTRUCTURA (la cadena no cabe en 8 plantas)", () => {
  const R = join(HERE, "..", "e2e", "espejo-tour", "routes-ad");
  type Seg = { id: string; script: DngOpLike[]; expect: Array<{ text: string; ocrLn: number }> };

  /** Los 106 segmentos `openedBy`, misma población que las dos re-derivaciones de arriba. */
  const abiertos = (): Seg[] => {
    const out: Seg[] = [];
    for (const f of readdirSync(R).filter((n) => n.endsWith(".route.json")).sort()) {
      const route = JSON.parse(readFileSync(join(R, f), "utf8")) as {
        segments?: Array<{ id?: string; openedBy?: string; script?: DngOpLike[]; expect?: Array<{ text: string; ocrLn: number }> }>;
      };
      for (const s of route.segments ?? []) if (s.openedBy) out.push({ id: s.id ?? "?", script: s.script ?? [], expect: s.expect ?? [] });
    }
    return out;
  };

  /** Los cambios de planta del segmento, en orden: `+1` baja (klimb-down o caída), `−1` sube. */
  const eventos = (s: Seg): number[] => {
    const ev: number[] = [];
    for (const r of observationRunsFor(s.script, s.expect)) {
      if (r.klimbAfter) ev.push(r.klimbAfter === "down" ? 1 : -1);
      for (let k = 0; k < (r.fallAfter ?? 0); k++) ev.push(1);
    }
    return ev;
  };

  /** Cuántas profundidades DISTINTAS recorre la cadena, menos una. Cabe en una mazmorra sii ≤ 7. */
  const span = (ev: readonly number[]): number => {
    let o = 0;
    let mn = 0;
    let mx = 0;
    for (const e of ev) {
      o += e;
      mn = Math.min(mn, o);
      mx = Math.max(mx, o);
    }
    return mx - mn;
  };

  it("★★ la cadena de `ad18-g14` visita 10 profundidades — y una mazmorra tiene 8", () => {
    const g14 = abiertos().find((s) => s.id === "ad18-g14");
    expect(g14, "ad18-g14 desapareció del corpus abierto").toBeTruthy();
    const runs = observationRunsFor(g14!.script, g14!.expect);
    expect(runs, "los 14 tramos que geo-13 §7.1 midió").toHaveLength(14);
    const ev = eventos(g14!);
    expect(ev, "11 klimbs + 2 caídas").toHaveLength(13);
    expect(ev.filter((e) => e < 0), "los que suben").toHaveLength(4);
    expect(span(ev), "el span de la cadena: 9 saltos ⇒ 10 plantas distintas").toBe(9);
    expect(span(ev), "no cabe en las N=8 plantas de ninguna mazmorra").toBeGreaterThan(N - 1);
  });

  /**
   * ★★ CONTROL DE AISLAMIENTO: el barrido **sin una sola observación**. Es lo que separa esta
   * adjudicación de un 0/64 cualquiera — si la impossibilidad dependiera del mapa, aquí
   * sobrevivirían hipótesis y el veredicto sería «material inconsistente», no «cadena imposible».
   */
  it("★★ 0 de 64 sobreviven a la cadena SIN mirar ni una observación (ni un mapa)", () => {
    const g14 = abiertos().find((s) => s.id === "ad18-g14")!;
    const ev = eventos(g14);
    let vivas = 0;
    for (let d = 0; d < DUNGEONS.length; d++) {
      for (let f0 = 0; f0 < DUNGEONS[d]!.floors.length; f0++) {
        let t: FloorTracker = { floor: f0, falsified: false };
        for (const e of ev) t = applyKlimb(t, e > 0 ? "down" : "up");
        if (!t.falsified) vivas++;
      }
    }
    expect(vivas, "la estructura sola ya adjudica: no queda planta inicial posible").toBe(0);
    // …y para que nadie lea el control como vacuo: con la cadena de otro segmento SÍ sobreviven.
    const g12 = abiertos().find((s) => s.id === "ad18-g12")!;
    let vivasG12 = 0;
    for (let f0 = 0; f0 < 8; f0++) {
      let t: FloorTracker = { floor: f0, falsified: false };
      for (const e of eventos(g12)) t = applyKlimb(t, e > 0 ? "down" : "up");
      if (!t.falsified) vivasG12++;
    }
    expect(vivasG12, "ad18-g12 (el otro 0/64) NO es imposible por estructura: lo suyo es el MATERIAL").toBeGreaterThan(0);
  });

  it("★ y es el ÚNICO de los 91: el siguiente span es 7, justo en el límite", () => {
    const segs = abiertos();
    // ★ RECALIBRACIÓN 91 → 106 (ventana `banner-ad19`, pre-registro P2): la curación del banner
    // de `ad19-g17` abrió 15 segmentos, todos de la visita a Wrong. La TARJETA SOBREVIVE al
    // ensanche, y eso la refuerza: `ad18-g14` sigue siendo el ÚNICO con span > 7, y el material
    // nuevo mete un tercer segmento JUSTO en el límite (`ad19-g26`, span 7) sin cruzarlo.
    expect(segs, "la población de segmentos abiertos se movió").toHaveLength(106);
    const spans = segs.map((s) => ({ id: s.id, span: span(eventos(s)) })).sort((a, b) => b.span - a.span);
    expect(spans.filter((x) => x.span > N - 1).map((x) => x.id), "el criterio NO es un bucket ancho").toEqual(["ad18-g14"]);
    expect(spans[0]!.span).toBe(9);
    expect(spans[1]!.span, "el segundo cabe EXACTO en 8 plantas — el criterio muerde donde debe").toBe(7);
    expect(
      spans.filter((x) => x.span === 7).map((x) => x.id).sort(),
      "los que rozan el límite sin pasarlo (uno es material NUEVO de la visita de Wrong)",
    ).toEqual(["ad17-g03", "ad19-g26", "ad25-g14"]);
  });

  /**
   * ★ LA COTA DE LA ADJUDICACIÓN, pinada para que nadie la lea más fuerte de lo que es.
   * Adjudicar «imposible» NO es adjudicar «este eco sobra»: la geometría no nombra al culpable.
   */
  it("★ ningún eco SUELTO explica la imposibilidad: 0 rescates de 13, y 36 pares de 78", () => {
    const ev = eventos(abiertos().find((s) => s.id === "ad18-g14")!);
    const sin = (drop: readonly number[]) => span(ev.filter((_, i) => !drop.includes(i)));
    let uno = 0;
    for (let i = 0; i < ev.length; i++) if (sin([i]) <= N - 1) uno++;
    let dos = 0;
    for (let i = 0; i < ev.length; i++) for (let j = i + 1; j < ev.length; j++) if (sin([i, j]) <= N - 1) dos++;
    expect(uno, "si UNO bastara, la tarjeta sería un eco espurio y no una inconsistencia de cadena").toBe(0);
    expect(dos, "los pares que sí rescatan — 36 candidatos, o sea la geometría NO señala a ninguno").toBe(36);
    expect((ev.length * (ev.length - 1)) / 2).toBe(78);
  });

  /**
   * ★★ EL SOSPECHOSO CON MECANISMO — y **no cierra el hueco**, que es la mitad que importa.
   *
   * `ad18-g14` trae DOS pares de ecos `Klimb-U/D-` (el prompt de celda con las dos escaleras,
   * `main.ts:1149`) que parecen la MISMA pulsación leída dos veces:
   *   · ln5980 `Kllmb-U/D-Down` → ln5983 `Kllmb-U/U-Uown`
   *   · ln6204 `Kllmb-U/D-Up!`  → ln6209 `Kllmb-U/U-Up!`
   * `U/U` es la confusión **D→U** del OCR sobre el mismo literal `U/D`.
   *
   * El discriminador de re-lectura de #54 (`isGhostReread`) **no puede cazarlos**, y falla por DOS
   * de sus cinco condiciones a la vez: (a) el duplicado no lleva comilla interna, así que
   * `hasGhostSignature` da `false` — es exactamente el latente `ln7368/9` que la entrega 2 dejó
   * nombrado en `regen-71b-isbareecho-diagnostico.md`; y (b) el hueco de líneas es 3 y 5, fuera
   * de la ventana `0..2`.
   *
   * ⚠ Y AQUÍ ESTÁ LA HONESTIDAD DEL TEST: retirar ese par **NO rescata el segmento** (span 8,
   * sigue > 7). Nombrar un artefacto plausible no cierra la cuenta — harían falta al menos DOS
   * descensos espurios *antes del pico*, y el `Klimb-U/D-Up!` del final ni siquiera está ahí.
   * Por eso la tarjeta se adjudica como IMPOSIBLE y el culpable queda **SIN ANCLAR**.
   */
  it("★★ el par `Klimb-U/D-` duplicado se le escapa a #54 — y aun retirándolo NO rescata", () => {
    // (a) el duplicado no dispara la firma de fantasma, así que `isGhostReread` no llega a mirar
    expect(hasGhostSignature("Kllmb-U/U-Uown"), "sin comilla interna: invisible a la firma de #54").toBe(false);
    expect(hasGhostSignature("Kllmb-U/U-Up!")).toBe(false);
    expect(
      isGhostReread(
        { op: { dng: "klimb", dir: "down" }, echo: "Klimb-Down!", sim: 1, consumed: 1 },
        "Kllmb-U/U-Uown",
        5983,
        { dng: "klimb", from: "Kllmb-U/D-Down", ocrLn: 5980 },
      ),
      "si esto se pusiera true sin re-medir la cadena, el fix estaría hecho a ojo",
    ).toBe(false);
    // (b) …y el hueco de líneas también lo deja fuera de la ventana de #54
    expect(5983 - 5980).toBeGreaterThan(2);
    expect(6209 - 6204).toBeGreaterThan(2);
    // (c) el par existe en el corpus tal cual, con sus dos líneas
    const g14 = abiertos().find((s) => s.id === "ad18-g14")!;
    const klimbs = g14.script.filter((o) => o.dng === "klimb").map((o) => o.ocrLn);
    expect(klimbs, "los dos pares sospechosos siguen en el corpus").toEqual(
      expect.arrayContaining([5980, 5983, 6204, 6209]),
    );
    // (d) LA COTA: retirar el par NO devuelve el segmento al reino de lo posible.
    //     El duplicado de ln5983 es el 7º cambio de planta de la cadena (índice 6) y el de
    //     ln6209 el 13º (índice 12) — contados en el mismo orden en que los emite `eventos`.
    const ev = eventos(g14);
    const sinElPar = span(ev.filter((_, i) => i !== 6 && i !== 12));
    expect(sinElPar, "8 sigue sin caber en 8 plantas (hace falta max−min ≤ 7)").toBe(8);
    expect(sinElPar).toBeGreaterThan(N - 1);
  });
});
