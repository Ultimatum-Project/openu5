/**
 * FASE 3e-a — FILTRO DE LOCALIZACIÓN EN MAZMORRA (puro, offline, sin Playwright).
 *
 * Qué es y qué NO es
 * ------------------
 * **NO es un ancla.** Es un REDUCTOR del espacio de búsqueda. Dentro del 3D no hay nada
 * invertible y abundante en el OCR del LP (el (L)ook 3D sí lo es pero el LP casi no lo usa: 13
 * beats; el oráculo de facing, 5; la GEMA no lleva posición en absoluto — ver `DISENO-3e.md`).
 * Lo que sí hay es la propia NAVEGACIÓN: el LP avanza y gira, y el mundo le responde. Eso, contra
 * el mapa estático, es un problema clásico de localización: filtrar los estados `(x,y,facing)`
 * incompatibles con lo observado.
 *
 * El resultado se compone con la MISMA disciplina que `anchors.ts`: el filtro entrega un conjunto
 * de candidatas y **quien decide sigue siendo la CERCANÍA** (`resolveDungeonAnchor`, gemelo de
 * `resolveFaceAnchor`), que declina si hay demasiadas. El filtro nunca elige.
 *
 * LA PROPIEDAD PORTANTE: SANO, NO CONVERGENTE
 * -------------------------------------------
 * El criterio de aceptación **no** es «cuántas candidatas deja» sino que **NUNCA excluya la celda
 * verdadera**. Un filtro que deja 1 y a veces se equivoca teletransportaría la party a una celda
 * falsa y mediría el interior equivocado — fabricación con forma de precisión. Uno que deja 8 y
 * siempre contiene la verdad es honesto y componible. Blindado en
 * `tests/espejo-dungeon-filter.test.ts` (barrido de las 64 plantas REALES).
 *
 * De ahí las dos decisiones que le quitan potencia A PROPÓSITO:
 *
 * 1. **`Blocked!` NO informa.** El port emite la MISMA cadena (DS 0x2D23) por muro
 *    (`isPassable` falso, dungeon.ts:357) y por ERRANTE en el destino (dng_move 0x067c-0x0691,
 *    dungeon.ts:363). En la partida del LP el errante estaba VIVO, así que un `Blocked!` suyo no
 *    demuestra que haya muro: excluir por él podría tirar la celda verdadera. Se ignora.
 *    Quien informa es el **avance CON ÉXITO** (la celda de delante era transitable de verdad).
 * 2. **La puerta secreta no excluye.** `isPassable` la deja pasar sólo si fue revelada por Search
 *    (dungeon.ts:291) y el conjunto de reveladas del LP no es reconstruible. Así que el filtro
 *    sólo excluye por lo que bloquea SIEMPRE: `Wall` (0xB) y `SpecialWall` (0xC).
 *
 * Coste medido de ser sano: con el modelo ingenuo (usar `Blocked!` como muro) la mediana caía a 5
 * candidatas en 20 avances; con el modelo sano hacen falta ~2-4× más observaciones. Es el precio
 * correcto.
 */

import { stripGhostPass } from "./ocr-profile";

/** Celda tal como viene en `assets/maps/dungeons.json` (nibble alto = tipo, bajo = subtipo). */
export interface FilterCell {
  type: number;
  sub: number;
}
/** Una planta = 8×8 (dungeon.ts:212 `const N = 8`). Indexado `[y][x]`. */
export type FloorGrid = FilterCell[][];

/** Lado del grid y nº de plantas (DUNGEON.DAT / dungeon.ts:212). */
export const N = 8;

/** Facing como índice 0..3 = N,E,S,W (mismo orden que `DELTA` del core). */
export const DELTA: ReadonlyArray<readonly [number, number]> = [
  [0, -1],
  [1, 0],
  [0, 1],
  [-1, 0],
];

/** Tipos por nibble alto que hacen falta aquí (espejo de `CellType` de core/dungeon). */
const WALL = 0xb;
const SPECIAL_WALL = 0xc;
const SECRET_DOOR = 0xd;
const NORMAL_DOOR = 0xe;
const MAGIC_FIELD = 0x8;
const FIELD_ENERGY = 3;

/** WRAP toroidal por eje (DUNGEON:0x057a/0x0583 — `x=-1 → 7`, `x=8 → 0`; NO es clamp). */
export const wrap = (v: number): number => ((v % N) + N) % N;

/**
 * ¿Bloquea SIEMPRE, sea cual sea el estado de la partida? Sólo muro y muro especial.
 * La puerta secreta (0xD) queda FUERA a propósito: pasa si fue revelada por Search y no sabemos
 * cuáles reveló el LP. Excluir por ella podría tirar la celda verdadera (ver cabecera).
 */
export const definitelyBlocks = (c: FilterCell): boolean => c.type === WALL || c.type === SPECIAL_WALL;

/** Puerta NORMAL (0xE): la que dispara el gate «Not in doorway!» de los giros L/R. */
export const isNormalDoor = (c: FilterCell): boolean => c.type === NORMAL_DOOR;

/** Campo de ENERGÍA: tile EXACTO 0x83, sin variante iluminada (dungeon.ts:344, DUNGEON:0x0470). */
export const isEnergyField = (c: FilterCell): boolean => c.type === MAGIC_FIELD && c.sub === FIELD_ENERGY;

/** Estado candidato: celda + orientación. La PLANTA va aparte (ver `FloorTracker`). */
export interface DngState {
  x: number;
  y: number;
  facing: number;
}

/**
 * OBSERVACIONES SANAS — lo que el transcript del LP permite afirmar, y nada más.
 *
 * Cada una viene con lo que el port imprime y su cita, para que quien añada una nueva tenga que
 * demostrar que es inequívoca (el contraejemplo es `Blocked!`, que parece informativo y no lo es).
 */
export type DngObs =
  /** El avance PROSPERÓ (eco `Advance` sin `Blocked!`/`Ouch!` detrás) → la celda de delante era
   *  transitable Y sin errante. Es LA observación informativa. */
  | { kind: "advance-ok" }
  /** `Blocked!` (DS 0x2D23) → muro **O** errante. AMBIGUO: no excluye nada. Se cuenta, no informa. */
  | { kind: "advance-blocked" }
  /** `Ouch!` + `Electric field!` → la celda de delante es el tile EXACTO 0x83. Inequívoco: el
   *  errante no produce esta cadena. No avanza. */
  | { kind: "energy-field" }
  /** Giro L/R que SÍ ocurrió (eco `Turn left`/`Turn right`) → la celda ACTUAL no es puerta normal. */
  | { kind: "turn"; right: boolean }
  /** `Not in doorway!` (DS 0x2cc9/0x2cef) → la celda ACTUAL **es** puerta normal (0xE). Sólo hay 7
   *  en las 8 mazmorras, así que es la observación más discriminante del corpus. NO gira. */
  | { kind: "not-in-doorway" }
  /** Giro de 180° (rama default @0x0533): sin gate de puerta → sin información, sólo rota. */
  | { kind: "turn-around" };

/** Todos los estados de una planta: 64 celdas × 4 facings = 256. */
export function allStates(): DngState[] {
  const out: DngState[] = [];
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) for (let facing = 0; facing < 4; facing++) out.push({ x, y, facing });
  return out;
}

const ahead = (g: FloorGrid, s: DngState): FilterCell => {
  const [dx, dy] = DELTA[s.facing]!;
  return g[wrap(s.y + dy)]![wrap(s.x + dx)]!;
};
const here = (g: FloorGrid, s: DngState): FilterCell => g[s.y]![s.x]!;

/**
 * Aplica UNA observación al conjunto de candidatas. PURO. Devuelve el conjunto nuevo.
 *
 * Invariante que los tests blindan: si el estado verdadero estaba en `states`, sigue estando en el
 * resultado. Toda rama que EXCLUYA tiene que ser inequívoca; ante la duda, no se excluye.
 */
export function applyObs(g: FloorGrid, states: DngState[], obs: DngObs): DngState[] {
  switch (obs.kind) {
    case "advance-ok":
      // la celda de delante era transitable → fuera las que tienen muro seguro delante…
      return states
        .filter((s) => !definitelyBlocks(ahead(g, s)))
        // …y las supervivientes AVANZAN (el LP avanzó, así que ellas también)
        .map((s) => {
          const [dx, dy] = DELTA[s.facing]!;
          return { x: wrap(s.x + dx), y: wrap(s.y + dy), facing: s.facing };
        });
    case "advance-blocked":
      // AMBIGUO (muro o errante): no se excluye ni se mueve. Ver cabecera.
      return states;
    case "energy-field":
      return states.filter((s) => isEnergyField(ahead(g, s)));
    case "turn":
      // giró ⇒ no estaba sobre puerta normal; y las candidatas giran igual
      return states
        .filter((s) => !isNormalDoor(here(g, s)))
        .map((s) => ({ x: s.x, y: s.y, facing: obs.right ? (s.facing + 1) % 4 : (s.facing + 3) % 4 }));
    case "not-in-doorway":
      // NO giró ⇒ está sobre puerta normal (sólo 7 celdas en las 8 mazmorras)
      return states.filter((s) => isNormalDoor(here(g, s)));
    case "turn-around":
      return states.map((s) => ({ x: s.x, y: s.y, facing: (s.facing + 2) % 4 }));
  }
}

/** Corre la secuencia entera desde el desconocimiento total (256 estados). PURO. */
export function runFilter(g: FloorGrid, obs: readonly DngObs[]): DngState[] {
  let states = allStates();
  for (const o of obs) states = applyObs(g, states, o);
  return states;
}

/** Observaciones que APORTAN (las que pueden excluir). `advance-blocked` y `turn-around` no. */
export const isInformative = (o: DngObs): boolean =>
  o.kind === "advance-ok" || o.kind === "energy-field" || o.kind === "not-in-doorway" || o.kind === "turn";

/**
 * PRESUPUESTO. Sin observaciones informativas suficientes el filtro no baja de ~100 candidatas y
 * anclar sería adivinar. El umbral sale de la medición: con el modelo SANO hacen falta del orden
 * de 40 observaciones para una mediana de ~10.
 *
 * Las visitas sin presupuesto **se DECLARAN**, no se anclan y no se silencian — misma doctrina que
 * `ambiguous` en `resolveFaceAnchor` y que `floorUnknown` en 3b.
 *
 * ═══ 40 → 5, y con el residual ACEPTADO POR ESCRITO (ruling del despertar del anclaje E-3) ═══
 *
 * El 40 venía de una medición que la estructura de hoy ya no tiene. Las TRES citas que mandan:
 *
 * 1. **`re/notes/regen-71b-presupuestos-re-derivacion.md`** — re-derivada la tabla sobre los 190
 *    tramos de la partición de hoy, **`MIN_BUDGET = 40` no es una zona muerta: es INALCANZABLE**
 *    (la banda 40+ tiene **0 muestras**; tenía 7 cuando se fijó el umbral). La banda útil bajó a
 *    **5-19**, donde están **32 de los 34** tramos que anclarían por conteo real. Un umbral que
 *    ningún tramo puede alcanzar no regula: apaga.
 * 2. **`re/notes/geo-13-cinturon-acta.md` §1 — LA PARADA.** Bajarlo **no somete la banda a
 *    abstención: la EXIME**. El `ghostRisk` de aquí abajo vive DENTRO de la rama bajo-presupuesto,
 *    y los 34 tramos que anclarían tienen todos presupuesto ≥ 5 (mínimo **exactamente 5**), así que
 *    con `MIN_BUDGET = 5` toman la rama `enough` y **el cinturón fantasma no se consulta ni una
 *    vez**. El número cae justo en la frontera donde esa protección se apaga, y eso **no es un
 *    efecto colateral: es lo que este cambio hace**.
 * 3. **RULING (task #1/#5, 31-07) — EL RESIDUAL SE ACEPTA, no se disimula.** El riesgo de pasada
 *    fantasma en la rama `enough` queda aceptado EXPLÍCITAMENTE, porque:
 *    - la protección contra observación falsa vive ahora **EN LOS GUARDAS DE DERIVACIÓN**, no en
 *      este cinturón terminal: **#54** (discriminador de re-lectura, **11** retiradas), **#55**
 *      (guarda de roster, **27**) y la **entrega 2** (`isBareEcho`, **2**) — las tres con punto
 *      fijo del ciclo;
 *    - y el cinturón fantasma **no discrimina**: su firma está en el **49,7 %** de los bloques del
 *      corpus abierto y marca **88 de 88** segmentos (`geo-13-cinturon-acta.md` §1.1). Testa la
 *      FIRMA —ruido de comillas—, no el DEFECTO: saturación estructural. Un detector que se
 *      enciende en la mitad del material no separa nada.
 *
 *    **Residual conocido, con nombre y cita.** Los dos primeros se ficharon como latentes en
 *    `regen-71b-isbareecho-diagnostico.md` y quedan ADJUDICADOS en `re/notes/latentes-e2-acta.md`,
 *    que corrige su enunciado: NO son residual de esta rama.
 *    - `ad19-g26` — 2ª instancia del agujero **a↔u**. El guarda **SÍ lo detecta**; lo que no llega
 *      es el ESCRITOR (`enrichPart` sólo procesa `ctx` `dungeon`/`post-combat`, y este segmento es
 *      `resume`). Medido: **5** detecciones vivas, **las 5** fuera del dominio del escritor y
 *      **0** dentro. No se «materializa al abrir el segmento»: abrirlo lo RETIRARÍA.
 *    - `ln7368/9` — duplicación **sin comilla**. Relajar `hasGhostSignature` para verla cuesta
 *      **62 retiradas más** (**51** en segmentos que sí se escriben, **50** de ellas `advance`):
 *      la dirección peligrosa. No hay testigo que la adjudique — el `nav` sale del MISMO OCR.
 *      ⚠ `ad18-adjudicacion-acta.md` §2.1 ficha dos casos más y los llama instancias del mismo
 *      latente; medido, los tres fallan condiciones DISTINTAS (C1 / C1+C2 / C1+C4+C5). El peaje de
 *      partición que esa acta exige está pagado: **27 de 646** segmentos con L1, **35** con
 *      L1+ventana-5 — y **ninguna de las dos palancas caza ninguno de los dos casos de `ad18`**.
 *    - y los combates NO ATESTIGUADOS, confinados por `combat-risk` — el cinturón que sí
 *      discrimina por POSICIÓN y que por eso se cableó FUERA de esta rama.
 *
 *    ⚠ Lo que ese censo SÍ destapa, y no es residual sino COBERTURA: **7 segmentos** que
 *    `mkoverlay-ad` clasifica INTERIOR (2 `start` + 5 `resume`, **728** ops de script, `ad20-g01`
 *    y `ad19-g26` los gordos) quedan fuera del `ctx` que el derivador procesa. Los dos
 *    clasificadores de «esto es mazmorra» DISCREPAN, y el anclaje no ve ese material. Ticket
 *    propio: mover el `ctx` cambia la partición del arco (646 segmentos, 88/190/910).
 *
 * ⚠ **Este número NO baja de 5 sin re-medir la tabla (`regen-71b`) ni sube sin re-abrir el
 * ruling.** No es una perilla de potencia: decide qué protección existe.
 *
 * ⚠ Lo que este cambio NO hace, medido y no supuesto (`re/notes/ancla-13b-acta.md`): **no abre el
 * anclaje**. Sube de 0 anclas a **2** (`ad16-g18` y `ad17-g11`), porque el techo no lo pone el
 * presupuesto sino el CONTEO: sólo 13 de los 88 segmentos llegan a ≤ 4 candidatas, y `combat-risk`
 * se abstiene en 11 de esos 13. Quien lea «40 → 5» como «ya ancla» está leyendo la perilla, no la
 * medición.
 */
export const MIN_BUDGET = 5;

export interface BudgetVerdict {
  informative: number;
  enough: boolean;
  /** razón declarada cuando no hay presupuesto (para el reporte, nunca un skip mudo) */
  reason?: string;
}
export function budgetOf(obs: readonly DngObs[]): BudgetVerdict {
  const informative = obs.filter(isInformative).length;
  if (informative >= MIN_BUDGET) return { informative, enough: true };
  return {
    informative,
    enough: false,
    reason: `sin presupuesto para anclar: ${informative} observaciones informativas (mínimo ${MIN_BUDGET}); ` +
      `con menos, el filtro no baja de ~100 candidatas y el desempate por cercanía sería adivinar`,
  };
}

// ───────────────────────────────────────────── composición con el desempate por cercanía

export type DngResolveStatus = "resolved" | "miss" | "ambiguous" | "no-budget" | "combat-risk";
export interface DngResolution {
  status: DngResolveStatus;
  state?: DngState;
  candidates: number;
  drift?: number;
  reason?: string;
  /** ancló con el conteo REAL por debajo del presupuesto (ruling del lead, 31-07). Se DECLARA
   *  siempre: es la única vía de anclaje que no pasó por el proxy, y tiene que ser auditable. */
  belowBudget?: boolean;
}

/** Distancia toroidal (el grid envuelve: la distancia 7 en un eje es en realidad 1). */
export function torusDist(a: { x: number; y: number }, b: { x: number; y: number }): number {
  const dx = Math.min(wrap(a.x - b.x), wrap(b.x - a.x));
  const dy = Math.min(wrap(a.y - b.y), wrap(b.y - a.y));
  return dx + dy;
}

/**
 * GEMELO DE `resolveFaceAnchor` (anchors.ts), y a propósito con el mismo contrato: el filtro
 * REDUCE, **la cercanía DECIDE**, y si quedan demasiadas se DECLINA en vez de adivinar.
 *
 *   0 candidatas            → `miss`      (el mapa vivo no casa con el estático: dato, no fallo)
 *   > maxCandidates         → `ambiguous` (se declina el resync y se reporta)
 *   sin presupuesto         → `no-budget` (declarado; ver `budgetOf`)
 *   resto                   → la más cercana a `from`, con su deriva
 *
 * `from` es la posición VIVA del port. Igual que en smallmap, la deriva es incremental, así que la
 * candidata más próxima a donde ya está la party es la apuesta correcta — y si hay empate o
 * demasiadas, no se apuesta.
 */
export function resolveDungeonAnchor(
  states: readonly DngState[],
  from: { x: number; y: number },
  opts: { maxCandidates?: number; budget?: BudgetVerdict; ghostRisk?: boolean; combatRisk?: boolean } = {},
): DngResolution {
  const maxCandidates = opts.maxCandidates ?? 4;
  // ⚠ EL ORDEN DE ESTAS DOS GUARDAS DECIDE A QUIÉN ACUSA EL VEREDICTO, y estaba al revés.
  // Con el presupuesto delante, un conjunto YA VACÍO salía etiquetado `no-budget` — que acusa al
  // CORPUS («faltan observaciones» ⇒ traer más material) cuando el culpable es el ALIMENTADO
  // («excluí la celda verdadera» ⇒ arreglar el cableado). Las dos etiquetas mandan a acciones
  // OPUESTAS. Medido en el A/B de ad17: 6 de los 10 segmentos decían `no-budget` con 0 candidatas,
  // y leído al pie de la letra habría mandado la ventana siguiente a buscar corpus que no hacía
  // falta. El vacío es más específico y más grave: va PRIMERO.
  if (states.length === 0) {
    return {
      status: "miss",
      candidates: 0,
      reason: "el mapa vivo no casa con el estático (celdas mutadas: secretos revelados, cofres, hoyos) — es un dato, no un fallo del filtro",
    };
  }
  let belowBudget = false;
  if (opts.budget && !opts.budget.enough) {
    // ── RULING DEL LEAD (31-07): EL CONTEO REAL MANDA SOBRE EL PROXY ────────────────────
    // El presupuesto compraba confianza en que un conjunto pequeño no fuera ARTEFACTO de
    // corrupción. Tras 3e-b (sanidad restaurada + reinicio en cada frontera de planta) un
    // conjunto ≤ maxCandidates sólo puede carecer de la verdad por una OBSERVACIÓN FALSA — y
    // esa amenaza está confinada a las firmas conocidas del lever 2, no al TAMAÑO del
    // conjunto. Así que con el conteo ya dentro del umbral, el proxy sobra.
    // Medido: ad15-g05 llegó a 3 candidatas (maxCandidates=4) y el proxy lo vetaba.
    if (states.length > maxCandidates) {
      // aquí el proxy y el conteo dicen lo MISMO: no hay con qué anclar
      return {
        status: "no-budget",
        candidates: states.length,
        reason: `${opts.budget.reason} [quedaban ${states.length} candidatas]`,
      };
    }
    if (opts.ghostRisk) {
      // CINTURÓN (condición 2 del ruling): con una firma de PASADA FANTASMA en el segmento,
      // la única vía de fabricación que queda sigue viva ⇒ se ABSTIENE de anclar bajo
      // presupuesto. No se relaja el criterio justo donde el riesgo está identificado.
      return {
        status: "no-budget",
        candidates: states.length,
        reason:
          `${opts.budget.reason} [quedaban ${states.length} candidatas — ANCLAJE BAJO-PRESUPUESTO ` +
          `ABSTENIDO: el segmento trae firma de segunda pasada fantasma (la de runner.ts:748), ` +
          `que es la vía por la que una observación FALSA podría haber dejado este conjunto]`,
      };
    }
    belowBudget = true;
  }
  if (states.length > maxCandidates) {
    return { status: "ambiguous", candidates: states.length, reason: `${states.length} candidatas > ${maxCandidates}: se declina el resync (no se adivina)` };
  }
  // ── ★ #13 — CINTURÓN DE COMBATE EN LA COLA ──────────────────────────────────────────
  // Va AQUÍ, y las dos cosas importan.
  // (a) FUERA de la rama bajo-presupuesto, a diferencia del `ghostRisk`. Un cinturón que sólo
  //     actúa cuando falta presupuesto se APAGA justo donde hay algo que anclar: medido en #13,
  //     con `MIN_BUDGET = 5` los 34 tramos que anclarían tienen todos presupuesto de sobra.
  // (b) DESPUÉS del vacío y de la ambigüedad, porque el veredicto tiene que acusar a quien toca
  //     (misma lección que el orden `miss`/`no-budget` de arriba): si el conjunto ya estaba vacío
  //     o ya era ambiguo, ésos son diagnósticos más específicos y el combate no pinta nada.
  //     Así `combat-risk` significa exactamente «habría anclado, y me abstengo».
  if (opts.combatRisk) {
    return {
      status: "combat-risk",
      candidates: states.length,
      reason:
        `ANCLAJE ABSTENIDO: el segmento trae un COMBATE en la cola (tras su última observación y ` +
        `sin frontera que reinicie), así que estas ${states.length} candidatas describen la celda ` +
        `ANTERIOR al desplazamiento post-combate (DNGLOOK.OVL 0x0fda, códigos 1-4: una celda + ` +
        `facing). Anclar aquí pondría la party una celda al lado con forma de precisión — ver ` +
        `re/notes/geo-13-acta.md §6`,
    };
  }
  let best = states[0]!;
  let bestD = torusDist(from, best);
  for (const s of states.slice(1)) {
    const d = torusDist(from, s);
    if (d < bestD) {
      best = s;
      bestD = d;
    }
  }
  return {
    status: "resolved",
    state: best,
    candidates: states.length,
    drift: bestD,
    ...(belowBudget
      ? {
          belowBudget: true,
          reason: `anclado con el CONTEO real (${states.length} candidatas ≤ ${maxCandidates}) por DEBAJO del presupuesto (${opts.budget?.informative ?? "?"} observaciones informativas < ${MIN_BUDGET}) — ruling del lead 31-07, declarado para auditoría`,
        }
      : {}),
  };
}

// ───────────────────────────────────────────────────────── planta por conteo de klimb

/**
 * PLANTA por transición de `klimb`. Es la asimetría nº3 del informe de 3d («planta RELATIVA»):
 * la costura `carryover` toma la planta VIVA del port porque la ABSOLUTA no es derivable
 * (`--visits`: sólo 4 de 22 visitas tienen la cadena de segmentos completa).
 *
 * ⚠ ALCANCE HONESTO: esto **no** resuelve la planta absoluta. Sólo propaga una planta ya conocida
 * a través de los klimb del LP y detecta la INCONSISTENCIA (salirse del rango 0..7), que es
 * información real: si la secuencia del LP se sale, la planta supuesta era falsa. Convertir eso en
 * planta absoluta exigiría una cadena de visita completa, que el corpus no da en 18 de 22 casos.
 */
export interface FloorTracker {
  floor: number | null;
  /** el conteo del LP se salió del rango → la planta supuesta queda FALSIFICADA */
  falsified: boolean;
}
export function applyKlimb(t: FloorTracker, dir: "up" | "down"): FloorTracker {
  if (t.floor === null || t.falsified) return { floor: null, falsified: t.falsified };
  const next = dir === "down" ? t.floor + 1 : t.floor - 1;
  if (next < 0 || next >= N) return { floor: null, falsified: true };
  return { floor: next, falsified: false };
}

// ═══════════════════════════════════ DERIVACIÓN DE OBSERVACIONES DESDE EL OCR DEL LP

/** Forma mínima de un op de pasillo y de un bloque `expect` (evita acoplar con runner.ts). */
export interface ObsOp { dng?: string; dir?: string; ocrLn?: number }
export interface ObsBlock { text: string; ocrLn: number }

/** Firmas del LP, tolerantes a la corrupción del OCR (misma doctrina que `ocrFriendly`). */
const RE_BLOCKED = /b[il1]ocked!/i;
const RE_OUCH = /ouch!|e[il1]ectr[il1]c f[il1]e[il1]d/i;
const RE_NOT_DOORWAY = /not [il1]n doorway/i;
/** «Falling...» de la trampa de foso. ⚠ NO vale `fall` a secas: `Falled!` es el OCR de
 *  `Failed!` (Use/Cast) y sale 7 veces sólo en ad17 — daría fronteras de planta FANTASMA. */
const RE_FALLING = /f[au][il1]{2,3}ng/gi;
/**
 * ★ #67 — FRONTERA DE SALA. `Entering room..` (DATA.OVL 0x2c68) marca que el party pasó de la
 * celda de pasillo a un COMBATE DE ARENA. Sola NO rompe nada: al entrar, el party ya está EN la
 * celda de la sala (`dungeon.ts` on_enter resuelve el movimiento antes de lanzar el combate), así
 * que si el combate acaba en victoria la cadena de posiciones del pasillo CONTINÚA.
 *
 * Lo que la rompe es salir HUYENDO por un borde: `Combat.playerEscape` emite `Leave!` POR MIEMBRO
 * al cruzarlo (`combat.ts` :2707, SJOG 0x1bb2 → DS 0x8ea6), gateado por `escapeBorder`
 * (`combat.ts` :2694, «All must use the same exit!»). Tras esa salida el party está en OTRA celda,
 * y seguir aplicando las observaciones siguientes contra la misma cadena es el mismo error de
 * GRID EQUIVOCADO que este fichero ya evita con el `klimb` y la caída de foso.
 */
const RE_ROOM = /enter[il1]ng room|enter[il1]ng r00m/i;
const RE_LEAVE = /l[eu][ua]ve!/i;
/**
 * ★ #71b — FRONTERA DE COMBATE DE PASILLO. Lo que la rompe NO es el combate: es la EMBOSCADA.
 *
 * El desplazamiento post-combate está gateado por la CAUSA, y el binario lo dice en dos overlays:
 * `DNGLOOK.OVL` 0x0fda (emboscada) despacha `g_unk_58a0` sobre LOS SEIS códigos —0fdf `cmp ax,1`,
 * 0fe4 `cmp ax,2`, 0fe9 `cmp ax,3`, 0fee `cmp ax,4`, 0ff3 `cmp ax,5`, 0ff8 `cmp ax,6`— y los cuatro
 * primeros mueven UNA celda fijando además el facing (1004 `dec [g_party_y]` + 100a
 * `mov [g_dng_facing],al`; 1022 `inc [g_party_x]`; 103c `inc [g_party_y]`; 1056 `dec [g_party_x]`,
 * todos con wrap a 0..7). En cambio `DUNGEON.OVL` 0x1db8 —la vuelta del combate lanzado por
 * (A)ttack, justo tras 1db5 `call 0xffffddb6`— prueba SÓLO dos: 1db8 `cmp [g_unk_58a0],5` /
 * 1dbd `jne 0x1dec` y 1dec `cmp [g_unk_58a0],6` / 1df1 `jne 0x1dd1`; los códigos 1-4 ni se prueban
 * y caen a la cola común sin tocar `g_party_x/y` ni `g_dng_facing`.
 *
 * ⇒ por (A)ttack la posición Y el facing se CONSERVAN (la cadena sigue); por emboscada NO.
 *
 * No se exige además `Leave!`/`Escape!` —a diferencia de la frontera de SALA— y la razón es de
 * mecanismo, no de comodidad: la victoria no cierra el combate (`combat.ts` `maybeLatchVictory`
 * sólo latchea el flag; `over` es `ended || !anyActiveOnSide("party")`), así que el party SIEMPRE
 * termina cruzando un borde y los códigos 1-4 se aplican igual. En el OCR ese eco por miembro
 * sobrevive en 2 de las 19 ventanas de emboscada del corpus abierto: exigirlo sería exigir una
 * evidencia que el OCR pierde de forma sistemática. Y la forma `Attacked from the <dir>!` ya rompe
 * la cadena por sí sola, porque GIRA al party antes del combate (`dungeon.ts`:1406-1409).
 *
 * ⚠ La `-ed` NO es opcional: `Attack-Aim!` (y sus corrupciones `Attuck-Alm!`/`Attack-Alm!`) es el
 * eco del CUERPO del combate y sale 3.911 veces en AD, contra 87 emisiones de `Attacked`. Sin
 * exigir la terminación, la firma cortaría dentro de cada combate.
 */
const RE_AMBUSH = /att[au@][ck][ck][ea3][dcl]/i;
/**
 * ★ #13 — HUBO COMBATE en esta ventana (no dice su causa: sólo que lo hubo). Ver
 * `hasUnattestedCombatTail` para el porqué de cada firma y para el cero en falso que costó la
 * versión estrecha. La portante es el banner de roster (`COMBAT.OVL` 0x0701-0x07af).
 */
const RE_COMBAT_BODY = /[,.]\s*arm[eo]d\s+w[il1t]|nrmgH|n[rn]mgd|att[a-z0-9@]{0,3}[-z ]?a[il1]m|[uv][til1]ct[o0]r|UTCT0RY|batt[il1]e\s*[il18]s?\s*l[o0]st/i;

/**
 * UN TRAMO de observaciones tomadas TODAS en la MISMA planta, y el klimb que lo cierra.
 *
 * Existe porque el `klimb` ocurre DENTRO del segmento (18 en ad17, en 6 de sus 10 interiores) y
 * `applyObs` sólo tiene sentido contra el grid de la planta donde se tomó la observación. Aplicar
 * un tramo contra el grid equivocado no es «menos preciso»: EXCLUYE la celda verdadera, que es lo
 * único que este filtro no puede permitirse. Medido antes del arreglo, sobre 168 cruces
 * sintéticos: la verdad se perdía en 111 (66,1%), y en 21 de ellos el conjunto quedaba con ≤4
 * candidatas y NINGUNA era la verdadera — o sea el resolvedor habría aceptado y teletransportado
 * la party a una celda FALSA (fabricación con forma de precisión).
 */
export interface ObsRun {
  obs: DngObs[];
  /** dirección del klimb que CIERRA este tramo (ausente en el último). */
  klimbAfter?: "up" | "down";
  /**
   * PLANTAS CAÍDAS por trampa de foso al final de este tramo. La derivación es exacta:
   * `pitFall` (dungeon.ts:1263-1269) es un bucle que por CADA planta imprime «Pit Trap!» +
   * **«Falling...»** y luego hace `f += 1`, así que **un “Falling...” = una planta abajo**, y
   * (x,y) se conserva (relee `cellAt(f, x, y)` con las mismas). Cascada posible: dos fosos
   * encadenados dan dos mensajes.
   */
  fallAfter?: number;
  /**
   * ★ #67 — este tramo lo CIERRA una huida de combate de sala (`Entering room..` + `Leave!`).
   * A diferencia de `klimbAfter` y `fallAfter`, la nueva posición NO es derivable: la salida por
   * borde deja al party en una celda que el OCR no nombra. Por eso el tramo siguiente arranca sin
   * ninguna relación con éste — que es exactamente lo correcto, y lo que faltaba.
   */
  roomEscapeAfter?: boolean;
  /**
   * ★ #71b — este tramo lo CIERRA una EMBOSCADA del errante 3D en el pasillo. Igual que
   * `roomEscapeAfter`, la nueva posición NO es derivable: los códigos 1-4 (`DNGLOOK` 0x0fda)
   * mueven una celda en la dirección del borde de salida, que el OCR no nombra. Tampoco toca la
   * planta, así que el `FloorTracker` se conserva. Ver la derivación en `RE_AMBUSH`.
   */
  corridorAmbushAfter?: boolean;
}

/** Grid por planta. `stepFilterForSegment` lo acepta en vez de un grid suelto para poder aplicar
 *  CADA tramo contra la planta en la que se tomó. */
export type GridLookup = (floor: number) => FloorGrid | null;

/**
 * Convierte el guion del LP + su OCR en TRAMOS de observaciones, uno por planta visitada.
 *
 * La clave metodológica: las observaciones describen **al LP**, no al port — el filtro localiza
 * dónde estaba el LP para poder llevar allí a la party. Por eso se derivan del `expect` (lo que vio
 * el LP), nunca del transcript del port.
 *
 * Regla de lectura, que es la que el corpus permite: el eco de cada comando cae en su propio
 * `ocrLn`, así que lo que ocurrió DESPUÉS de un `advance` está en los bloques entre su línea y la
 * del op siguiente. Si ahí aparece `Blocked!` el avance no prosperó; si aparece `Ouch!/Electric
 * field!` chocó con el campo; si no aparece nada, prosperó.
 *
 * CONSERVADOR: un op cuyo `ocrLn` falta no produce observación (no se inventa el orden).
 *
 * Siempre devuelve AL MENOS un tramo (posiblemente vacío): sin klimbs, un solo tramo con todo.
 * `observationsFor` es el aplanado de esto, así que los dos no pueden divergir.
 */
export function observationRunsFor(script: readonly ObsOp[], expect: readonly ObsBlock[]): ObsRun[] {
  const ops = script.filter((o) => o.dng && o.ocrLn != null);
  const runs: ObsRun[] = [];
  let cur: DngObs[] = [];
  for (let i = 0; i < ops.length; i++) {
    const op = ops[i]!;
    const from = op.ocrLn!;
    const to = ops[i + 1]?.ocrLn ?? Number.MAX_SAFE_INTEGER;
    // ventana (from, to): lo que el LP vio entre este comando y el siguiente
    const window = expect.filter((b) => b.ocrLn >= from && b.ocrLn < to).map((b) => b.text).join(" ");
    // La CAÍDA se detecta en la VENTANA del op (no es un op: la dispara pisar la celda), y
    // ocurre DESPUÉS de la observación de ese op — se avanza a la celda y ahí se cae.
    const falls = (window.match(RE_FALLING) ?? []).length;
    if (op.dng === "klimb") {
      // CIERRA el tramo. La dirección viene del propio guion (`dir`), que el derivador ya extrae
      // del eco «Kllmb-Down!/Up!» del OCR. Sin dirección no se puede seguir la planta: se cierra
      // igual (el tramo siguiente es de OTRA planta) pero sin decir cuál.
      const dir = op.dir === "up" || op.dir === "down" ? op.dir : undefined;
      // ⚠ La caída de foso de ESTA ventana se arrastra junto con el klimb. Antes se calculaba
      // `falls` arriba y este `continue` la TIRABA, así que un «Falling...» caído en la ventana de
      // un klimb no bajaba el `FloorTracker`: la planta quedaba una ARRIBA y todo lo siguiente se
      // aplicaba contra el grid equivocado. Klimb y caída son independientes y se COMPONEN — el
      // port sube (o baja) por la escalera y luego pisa el foso de la celda de destino.
      runs.push({ obs: cur, ...(dir ? { klimbAfter: dir } : {}), ...(falls > 0 ? { fallAfter: falls } : {}) });
      cur = [];
      continue;
    }
    const out = cur;
    switch (op.dng) {
      case "back":
        // ⚠ `back` retrocede SIN girar: su chequeo de muro mira la celda de DETRÁS y el movimiento
        // va al revés. Modelarlo como `advance` movería la candidata en la dirección EQUIVOCADA y
        // podría excluir la celda verdadera — que es lo único que este filtro no puede permitirse.
        // Se deja NO-INFORMATIVO hasta tener su propia observación con test. Mejor perder potencia
        // que perder la verdad.
        break;
      case "advance":
        if (RE_OUCH.test(window)) out.push({ kind: "energy-field" });
        else if (RE_BLOCKED.test(window)) out.push({ kind: "advance-blocked" });
        else out.push({ kind: "advance-ok" });
        break;
      case "turnLeft":
      case "turnRight":
        if (RE_NOT_DOORWAY.test(window)) out.push({ kind: "not-in-doorway" });
        else out.push({ kind: "turn", right: op.dng === "turnRight" });
        break;
      case "turnAround":
        out.push({ kind: "turn-around" });
        break;
      // search/look/ignite/pass no aportan información de MURO: se ignoran a propósito.
      // (El `klimb` se trata ARRIBA: no es una observación, es una FRONTERA de planta.)
      default:
        break;
    }
    if (falls > 0) {
      // frontera de planta: cierra el tramo DESPUÉS de la observación de este op
      runs.push({ obs: cur, fallAfter: falls });
      cur = [];
      continue;
    }
    // ★ #67 — FRONTERA DE SALA por HUIDA: cierra igual que la caída, DESPUÉS de la observación
    // (el comando de este op sí ocurrió en el pasillo; lo que ya no es continuo es lo de después).
    // Exige las DOS firmas: `Entering room..` sola es una sala DESPEJADA —el port la anuncia igual
    // (`dungeon.ts` on_enter) pero no hay combate ni rotura— y cortar ahí disuelve tramos que hoy
    // discriminan sin ninguna razón. Medido sobre AD: 85 ventanas con firma de sala, de las que 59
    // son despejadas, 26 llevan `Leave!` y CERO llevan victoria.
    if (RE_ROOM.test(window) && RE_LEAVE.test(window)) {
      runs.push({ obs: cur, roomEscapeAfter: true });
      cur = [];
      continue;
    }
    // ★ #71b — FRONTERA DE PASILLO por EMBOSCADA: cierra igual que la huida de sala, DESPUÉS de la
    // observación (el comando de este op sí ocurrió antes de que el errante pisara al party).
    if (RE_AMBUSH.test(window)) {
      runs.push({ obs: cur, corridorAmbushAfter: true });
      cur = [];
    }
  }
  runs.push({ obs: cur });
  return runs;
}

/**
 * Convierte el guion del LP + su OCR en la secuencia de OBSERVACIONES del filtro.
 *
 * La clave metodológica: las observaciones describen **al LP**, no al port — el filtro localiza
 * dónde estaba el LP para poder llevar allí a la party. Por eso se derivan del `expect` (lo que vio
 * el LP), nunca del transcript del port.
 *
 * ⚠ APLANA los tramos, así que PIERDE dónde estaban las fronteras de planta. Quien vaya a
 * APLICARLAS contra un grid tiene que usar `observationRunsFor` — aplicar esta lista contra un
 * único grid es exactamente el defecto que el A/B de ad17 midió. Se conserva porque el análisis
 * offline (contar observaciones, medir presupuesto) sí quiere la lista plana.
 */
export function observationsFor(script: readonly ObsOp[], expect: readonly ObsBlock[]): DngObs[] {
  return observationRunsFor(script, expect).flatMap((r) => r.obs);
}

/**
 * ¿El segmento trae la firma de la SEGUNDA PASADA FANTASMA del OCR de AD?
 *
 * Es el CINTURÓN de la condición 2 del ruling del 31-07: con esta firma presente, el anclaje
 * por-conteo-bajo-presupuesto se ABSTIENE, porque la pasada fantasma es la vía por la que una
 * observación FALSA (un `advance-ok` de más, que además MUEVE las candidatas) podría haber
 * dejado un conjunto pequeño y equivocado.
 *
 * Usa el MISMO `stripGhostPass` que el diff (`runner.ts:748`) en vez de una regex propia: dos
 * detectores de la misma firma derivan, y esta ventana entera ha ido de consumidores del mismo
 * corpus con criterios distintos. Si el diff cambia de criterio, éste cambia con él.
 *
 * ⚠ ALCANCE: sólo decide si se ABSTIENE de anclar. NO limpia las observaciones — la corrección
 * de raíz vive en `derive-dungeon-ops.mjs` y exige regenerar rutas (ventana propia, ticket #43).
 */
export function hasGhostPassSignature(expect: readonly ObsBlock[]): boolean {
  return expect.some((b) => stripGhostPass(b.text) !== b.text);
}

/**
 * ★ #13 — ¿el segmento trae un COMBATE EN LA COLA, después de su última observación?
 *
 * Es el CINTURÓN gemelo de `hasGhostPassSignature`, y tapa el riesgo que la vía geométrica midió
 * pero no pudo adjudicar (`re/notes/geo-13-acta.md`): de los 64 episodios de combate sin frontera
 * del corpus abierto, **60 ocurren después de la última observación de su tramo** y **57 en el
 * último tramo con observaciones de su segmento** — justo donde `stepFilterForSegment` resuelve el
 * ancla con `f.states`. Si ese combate fue una emboscada, `f.states` describe la celda ANTERIOR al
 * desplazamiento (0x0fda códigos 1-4) y el resync desplazaría a la party una celda.
 *
 * La geometría NO puede decidir si lo fue: adjudicó 0 de 26, y por estructura (sólo adjudica donde
 * la lectura continua es imposible, y sólo hay 2 tramos así). Así que el filtro hace lo que hace
 * con `Blocked!` y con la puerta secreta: **mejor perder potencia que perder la verdad**.
 *
 * QUÉ CUENTA COMO COMBATE — cuatro firmas, y la portante es la única con cita de overlay:
 * el banner de roster `<Nombre>, armed with <armas>:` (`COMBAT.OVL` 0x0701-0x07af, cierre `:` =
 * DS 0x6dbe), que es emisión EXCLUSIVA de combate y cubre 213 de las 220 ventanas de combate del
 * corpus. `Attack-Aim!` sólo cubre 104: con ella sola el barrido de completitud de #13 daba «0
 * ventanas con VICTORY sin cuerpo», que era un CERO EN FALSO (`UTCT0RYT` de `ad24-g14` ln2922).
 *
 * ⚠ NO se absuelve por eco de (A)ttack aunque el mecanismo lo permitiría (0x1db8 conserva posición
 * y facing): el eco pelado `Attack` no es distinguible de un `Attack-Aim!` TRUNCADO por el OCR
 * —el corpus trae `Attack-A`, `Attack-Ai`, `Attac`, `Atta`, `Att`— y absolver con un fragmento que
 * puede ser de la otra familia absolvería en falso. Medido: absolver por (A)ttack deja de morder
 * en 3 de los 10 segmentos, uno de ellos (`ad17-g04`) anclando a UNA candidata.
 *
 * Una FRONTERA (klimb / caída / huida de sala / emboscada) después de la última observación TAPA
 * el combate: ahí el conjunto se reinicia igual, así que no hay estado rancio que proteger.
 */
export function hasUnattestedCombatTail(script: readonly ObsOp[], expect: readonly ObsBlock[]): boolean {
  const ops = script.filter((o) => o.dng && o.ocrLn != null);
  // la última op que PRODUJO observación: lo que hay de ahí en adelante es la COLA
  let last = -1;
  for (let i = 0; i < ops.length; i++) {
    const d = ops[i]!.dng;
    if (d === "advance" || d === "turnLeft" || d === "turnRight" || d === "turnAround") last = i;
  }
  if (last < 0) return false; // sin observaciones no hay estado acumulado que pueda quedar rancio
  for (let i = last; i < ops.length; i++) {
    const from = ops[i]!.ocrLn!;
    const to = ops[i + 1]?.ocrLn ?? Number.MAX_SAFE_INTEGER;
    const window = expect.filter((b) => b.ocrLn >= from && b.ocrLn < to).map((b) => b.text).join(" ");
    if (RE_COMBAT_BODY.test(window)) return true;
    // frontera que reinicia igual ⇒ deja de haber cola que proteger
    if (
      ops[i]!.dng === "klimb" ||
      (window.match(RE_FALLING) ?? []).length > 0 ||
      (RE_ROOM.test(window) && RE_LEAVE.test(window)) ||
      RE_AMBUSH.test(window)
    ) {
      return false;
    }
  }
  return false;
}

/** `back` NO produce observación (ver el `case` en `observationRunsFor`). Expuesto para el test. */
export const BACK_IS_INFORMATIVE = false;

// ═══════════════════════════════════════════════ ACUMULADOR POR VISITA (lo que el runner conduce)

/**
 * Estado del filtro a lo largo de UNA VISITA a la mazmorra. Vive fuera de `runSegment` porque el
 * presupuesto no lo da un segmento suelto.
 *
 * ⚠ El ejemplo que llevaba esta línea CADUCÓ con el propio delta que la rodea (auditoría final,
 * 01-08): decía «`ad17-g04` aporta 35 observaciones y el mínimo son 40», y hoy `MIN_BUDGET = 5`
 * (40→5, ver la derivación de arriba) — con 5, esos 35 son presupuesto de SOBRA y el ejemplo ya
 * no ilustra ninguna escasez.
 *
 * Lo que SOBREVIVE al cambio de umbral, y es la razón por la que este acumulador sigue viviendo
 * fuera de `runSegment`, es la de ad14/cadena: el interior sólo tiene sentido como CADENA. El
 * estado se acumula ENTRE segmentos, así que recortar el acumulador a uno solo rompería el
 * anclaje cualquiera que sea el umbral — eso no depende del 40 ni del 5.
 *
 * Se RESETEA al cambiar de planta: los 256 estados son de una planta concreta, así que arrastrarlos
 * a través de un `klimb` mezclaría mapas distintos y podría excluir la celda verdadera.
 */
export interface DngFilter {
  dungeon: number | null;
  floor: number | null;
  states: DngState[];
  obs: DngObs[];
  /** invocaciones REALES del filtro — la prueba de que el cableado se ejecuta, no sólo existe */
  fed: number;
  resets: number;
  outcomes: { resolved: number; ambiguous: number; miss: number; noBudget: number; combatRisk: number };
  /** resyncs efectivamente aplicados (drift > 0 y ancla resuelta) */
  applied: number;
  /** klimbs ATRAVESADOS dentro de un segmento (la frontera de planta que 3e-a no veía) */
  klimbs: number;
  /** plantas caídas por trampa de foso (frontera SIN op: sólo la delata «Falling...») */
  falls: number;
  /** anclajes con el CONTEO por debajo del presupuesto (ruling 31-07) — auditables */
  belowBudgetAnchors: number;
  /** segmentos con firma de pasada fantasma ⇒ el anclaje bajo-presupuesto se abstuvo */
  ghostRiskSegments: number;
  /** ★ #13 — segmentos con COMBATE EN LA COLA ⇒ el anclaje se abstuvo (haya presupuesto o no) */
  combatRiskSegments: number;
  /** tramos cuya planta NO se pudo resolver ⇒ hubo que reiniciar y se perdió el presupuesto */
  runsDropped: number;
  /** la planta que la cadena de klimbs del LP predice, ¿coincide con la VIVA del port? */
  floorAgree: number;
  floorDisagree: number;
  /** la cadena de klimbs del LP se salió de 0..7 (salida de mazmorra): planta FALSIFICADA */
  floorFalsified: number;
}

export const newDngFilter = (): DngFilter => ({
  dungeon: null,
  floor: null,
  states: [],
  obs: [],
  fed: 0,
  resets: 0,
  outcomes: { resolved: 0, ambiguous: 0, miss: 0, noBudget: 0, combatRisk: 0 },
  applied: 0,
  klimbs: 0,
  falls: 0,
  belowBudgetAnchors: 0,
  ghostRiskSegments: 0,
  combatRiskSegments: 0,
  runsDropped: 0,
  floorAgree: 0,
  floorDisagree: 0,
  floorFalsified: 0,
});

/** Reinicia el filtro para una planta (cambio de mazmorra o de planta). */
export function resetFilter(f: DngFilter, dungeon: number, floor: number): void {
  f.dungeon = dungeon;
  f.floor = floor;
  f.states = allStates();
  f.obs = [];
  f.resets++;
}

/**
 * Alimenta el filtro con las observaciones de UN segmento y devuelve el veredicto del ancla.
 * PURO respecto al puerto (el runner le pasa la posición viva y el grid). Testeable sin Playwright.
 *
 * EL SEGMENTO PUEDE CRUZAR DE PLANTA — y ésa era la avería (A/B de ad17, 2026-07-31: factor
 * ×1,00 con 0 candidatas en 10 de 10). Se alimenta TRAMO A TRAMO, cada uno contra el grid de SU
 * planta. Dos reglas:
 *
 * 1. **En cada frontera de planta el conjunto se REINICIA.** El klimb en sí preserva
 *    (x, y, facing) —toca sólo `pos.floor` (dungeon.ts:697/703) y relee la celda con la MISMA
 *    `pos.x/pos.y` (:709)—, así que ARRASTRAR las candidatas sería sano *si el klimb fuera la
 *    única forma de cambiar de planta*. **No lo es**: la TRAMPA DE FOSO (`pitFall`,
 *    dungeon.ts:1252-1298) baja de planta SIN op de klimb, en cascada, y sólo se anuncia con
 *    «Falling...» en el texto. El corpus AD tiene 26 bloques así en 10 partes, 3 de ellos en
 *    `ad17-g03`. Arrastrar candidatas a través de una caída NO OBSERVADA es exactamente la
 *    unsoundness que este arreglo viene a quitar, así que se reinicia — misma doctrina que
 *    `Blocked!` y que la puerta secreta: **mejor perder potencia que perder la verdad**.
 *    (Y está MEDIDO que aquí reiniciar además rinde más: con arrastre, `ad17-g03` y `ad17-g09`
 *    daban 0 hipótesis (mazmorra, planta) viables de 64; reiniciando dan 6 y 7.)
 *    El día que «Falling...» se derive como observación —un mensaje por planta caída,
 *    dungeon.ts:1263-1265— el arrastre pasa a ser sano y se puede recuperar el presupuesto.
 * 2. **Un tramo que no se puede aplicar OBLIGA a reiniciar igual.** Si no hay grid para su
 *    planta, sus observaciones se pierden — y el LP SÍ se movió durante ese tramo. Se CUENTA en
 *    `runsDropped`, nunca en silencio.
 *
 * `gridOrLookup` acepta un grid suelto —«sólo conozco esta planta», que es lo que el runner podía
 * dar antes— o una función por planta, que es lo que le da toda la potencia.
 */
export function stepFilterForSegment(
  f: DngFilter,
  gridOrLookup: FloorGrid | GridLookup,
  script: readonly ObsOp[],
  expect: readonly ObsBlock[],
  live: { x: number; y: number; floor?: number },
  opts: { maxCandidates?: number } = {},
): DngResolution {
  const runs = observationRunsFor(script, expect);
  // Con un grid suelto sólo se conoce la planta VIVA (la del final del segmento); con lookup, todas.
  const lookup: GridLookup =
    typeof gridOrLookup === "function"
      ? gridOrLookup
      : (floor) => (live.floor === undefined || floor === live.floor ? gridOrLookup : null);

  // La planta de cada tramo sale de encadenar los klimbs del LP desde la que el filtro traía.
  // Es el uso para el que `FloorTracker`/`applyKlimb` existían y que nadie llamaba.
  let tracker: FloorTracker = { floor: f.floor, falsified: false };

  for (let i = 0; i < runs.length; i++) {
    const run = runs[i]!;
    const g = tracker.floor === null || tracker.falsified ? null : lookup(tracker.floor);
    if (g) {
      for (const o of run.obs) {
        f.states = applyObs(g, f.states, o);
        f.obs.push(o);
        f.fed++;
      }
    } else if (run.obs.length) {
      // sin grid no se puede seguir el movimiento del LP ⇒ el conjunto deja de contener la verdad
      f.runsDropped++;
      f.states = allStates();
      f.obs = [];
    }
    // ★ #71 — la frontera de SALA de #67 TENÍA QUE ESTAR AQUÍ y no estaba. `roomEscapeAfter` se
    // emitía en `observationRunsFor` y NADIE la leía en el runner: un tramo cerrado por huida de
    // sala caía al siguiente SIN reinicio, así que el EMPALME que #67 vino a partir seguía intacto
    // en la capa que se EJECUTA. El «ad17-g08 a 5/64» era cierto en el arnés de medición offline y
    // FALSO en producción. A diferencia del klimb y de la caída, la huida NO cambia de planta
    // (`tracker` no se toca): sólo rompe la cadena de POSICIÓN, porque la salida por borde deja al
    // party en una celda que el OCR no nombra.
    // ★ #71b — la emboscada de pasillo rompe la cadena por la MISMA razón que la huida de sala
    // (posición nueva no derivable) y con el mismo alcance: NO toca el `tracker`, porque los
    // códigos 1-4 mueven en el plano, no de planta.
    if ((run.roomEscapeAfter || run.corridorAmbushAfter) && !run.klimbAfter && !run.fallAfter) {
      f.states = allStates();
      f.obs = [];
    }
    if (run.klimbAfter || run.fallAfter) {
      if (run.klimbAfter) {
        f.klimbs++;
        tracker = applyKlimb(tracker, run.klimbAfter);
      }
      // La caída SIEMPRE baja, una planta por mensaje (dungeon.ts:1263-1269).
      for (let k = 0; k < (run.fallAfter ?? 0); k++) {
        f.falls++;
        tracker = applyKlimb(tracker, "down");
      }
      if (tracker.falsified) f.floorFalsified++;
      // REINICIO en la frontera: sigue habiendo una puerta al cambio de planta que NO deja
      // rastro en el texto — la huida de combate por klimb (game.ts:6576/6597, códigos 5/6
      // de escape, ±1 planta y sin mensaje). Mientras esa exista, arrastrar candidatas a
      // través de una frontera no es demostrablemente sano. Ver §6 del acta.
      f.states = allStates();
      f.obs = [];
    }
  }

  // ¿La cadena de klimbs del LP predice la planta que el port reporta? Discrepar es DATO: el
  // replay y el LP están en plantas distintas y el conjunto describe un mapa que no es el vivo.
  const predicted = tracker.falsified ? null : tracker.floor;
  if (live.floor !== undefined && predicted !== null) {
    if (predicted === live.floor) f.floorAgree++;
    else {
      f.floorDisagree++;
      f.states = allStates(); // conservador: no se ancla con un conjunto de OTRA planta
      f.obs = [];
    }
  }
  f.floor = live.floor ?? predicted ?? f.floor;

  const budget = budgetOf(f.obs);
  const ghostRisk = hasGhostPassSignature(expect);
  if (ghostRisk) f.ghostRiskSegments++;
  const combatRisk = hasUnattestedCombatTail(script, expect);
  if (combatRisk) f.combatRiskSegments++;
  const res = resolveDungeonAnchor(f.states, live, { ...opts, budget, ghostRisk, combatRisk });
  if (res.belowBudget) f.belowBudgetAnchors++;
  f.outcomes[res.status === "no-budget" ? "noBudget" : res.status === "combat-risk" ? "combatRisk" : res.status]++;
  return res;
}
