/**
 * Grand Tour — TÁCTICAS PURAS del pather (carril tour-telemetry, fixes F1-F3).
 *
 * Lógica de decisión SIN Playwright ni page (unit-testeable en vitest), extraída de los
 * tres patrones de atasco que la 1ª cosecha de telemetría midió y clasificó
 * (tools/tour-telemetry-analyze.py, pasada ch01-ch18 de 8.008 acciones):
 *
 *  F1 `isGoalBump`      — walkTo EXACTO contra una casilla no-transitable (readSign
 *                         sondeando un lado empotrado en muro; goToCell contra una celda
 *                         de lápida/valla). Antes: ~17 acciones de thrash (bump + 16
 *                         burnTurns del WAIT_CAP) por intento; ch10 acumuló ×614.
 *                         Ahora: ruta a la ADYACENTE + UN bump + throw inmediato.
 *  F2 `RetryThrottle`   — primitiva de firma-de-fallo repetida. ⚠ NO CABLEADA: su
 *                         cableado original (espera agrupada de 5 turnos en
 *                         approachAndTalk) se FALSIFICÓ en la pasada-1 del resello —
 *                         quemar 5× tiempo de JUEGO por reintento deriva el reloj y
 *                         pierde ventanas de schedule (ch05: el herrero se acuesta en
 *                         un bolsillo inalcanzable y la venta muere). La tormenta de
 *                         acciones que quería matar (ch12 ×1020 = 60×17) ya la mata F1b
 *                         sin coste de turnos. Queda unit-testeada por si un futuro
 *                         cableado SIN coste de reloj (p.ej. saltarse re-planes de CPU)
 *                         la necesita.
 *  F3 `OscillationDamper`— thrash A-B-A-B del perseguidor/re-ruteo (ch06 ×25 ciclos,
 *                         ch12 ×30): cuando las últimas 4 posiciones forman A-B-A-B, el
 *                         siguiente paso se SUSTITUYE por una espera (burnTurn) para que
 *                         el actor móvil se estabilice.
 *
 * DETERMINISMO: todo es función del historial de posiciones/fallos — misma secuencia de
 * juego → mismas decisiones → sellos ×2 byte-idénticos. Estos fixes CAMBIAN el consumo
 * de turnos de los capítulos afectados (juegan MEJOR, no con otras reglas) → el resello
 * serial ch01-ch18 que los acompaña es parte del carril (ruling del lead 2026-07-23).
 */

/**
 * F1 — ¿Es este walkTo un GOAL-BUMP? (objetivo EXACTO no-transitable). `goalTile` es el
 * tile del snapshot en la casilla objetivo (undefined = fuera de mapa). En modo
 * `adjacent` nunca: el BFS no pisa el objetivo. El llamador, si true, debe: ruta a la
 * adyacente + UN bump direccional (conserva el eco de registro) + abortar con error.
 */
export function isGoalBump(
  goalTile: number | undefined,
  adjacent: boolean,
  traversable: (tile: number) => boolean,
): boolean {
  if (adjacent) return false;
  if (goalTile === undefined) return false; // fuera de mapa: lo maneja el error normal
  return !traversable(goalTile);
}

/**
 * F2 — Detector de FIRMA-DE-FALLO repetida. `note(sig)` registra un fallo y devuelve
 * cuántos turnos debe esperar el llamador antes del siguiente reintento: 1 (espera
 * histórica) mientras la firma cambie o no acumule `threshold` repeticiones; `groupedWait`
 * cuando el MISMO fallo se repite ≥ threshold veces seguidas (reintentar ya no aporta:
 * espera agrupada). Un fallo con firma distinta resetea la cuenta (hubo cambio de
 * situación → paciencia fresca).
 */
export class RetryThrottle {
  private lastSig: string | null = null;
  private repeats = 0;
  constructor(
    private readonly threshold = 3,
    private readonly groupedWait = 5,
  ) {}
  note(sig: string): number {
    if (sig === this.lastSig) {
      this.repeats += 1;
    } else {
      this.lastSig = sig;
      this.repeats = 1;
    }
    return this.repeats >= this.threshold ? this.groupedWait : 1;
  }
  reset(): void {
    this.lastSig = null;
    this.repeats = 0;
  }
}

/**
 * F3 — Amortiguador de OSCILACIÓN A-B-A-B. `next(key)` registra la posición actual
 * (clave serializada) y devuelve true cuando las últimas 4 posiciones forman A-B-A-B
 * (A≠B, 2 ciclos completos) → el llamador debe ESPERAR un turno en vez de dar el paso
 * (el actor móvil al que seguimos/rodeamos se estabiliza). Tras detectar, el historial
 * se limpia (una espera por detección; se re-acumula desde cero).
 */
export class OscillationDamper {
  private hist: string[] = [];
  next(key: string): boolean {
    this.hist.push(key);
    if (this.hist.length > 4) this.hist.shift();
    const h = this.hist;
    if (h.length === 4 && h[3] === h[1] && h[2] === h[0] && h[3] !== h[2]) {
      this.hist = [];
      return true;
    }
    return false;
  }
  reset(): void {
    this.hist = [];
  }
}

/**
 * F4 — DECISIÓN ante un prompt de guardia (F2-T4). Tabla pura: qué debe hacer el arnés
 * con el `tag` que devuelve el hook `__u5test.guardPromptOpen()`.
 *
 * Por qué existe (task #51, adjudicación del rojo de ch06-moonglow): el arnés respondía
 * `'y'` a los DOS tags. Para `guard-tribute` `'y'` es «pago» y es el ruling del lead
 * (2026-07-22, «el arnés se adapta al mundo»). Para `guard-arrest` `'y'` es «come
 * quietly» — o sea, el arnés ACEPTABA que encarcelaran al party y seguía como si nada.
 *
 * Y `guard-arrest` sólo se arma cuando el pago FALLÓ (`guardDemand` ret 1: rehusar, o
 * aceptar sin oro suficiente — tributo = 10 gp × miembro vivo). O sea: es la señal de
 * que la PREMISA ECONÓMICA del capítulo se rompió. Aceptar la cárcel la entierra: el
 * party despierta en la celda de Yew (loc 4, 25,4, llaves confiscadas, reloj a las 8) y
 * el capítulo sigue corriendo DECENAS de pasos en el pueblo equivocado hasta morir con
 * un mensaje que nombra otro subsistema (el rojo medido decía «climbLadder(up): sin
 * escalera en la planta 0» — cierto, porque Yew tiene plantas −1 y 0, no 1).
 *
 * `"arrested"` = el llamador debe ABORTAR con un error que nombre la causa.
 */
export type GuardPromptAction = "none" | "pay" | "arrested";

export function guardPromptAction(tag: string | null | undefined): GuardPromptAction {
  if (tag === "guard-tribute") return "pay";
  if (tag === "guard-arrest") return "arrested";
  return "none";
}

/**
 * ★★ DECISIÓN ante CUALQUIER `yesno` de Flow 2 vivo (el arnés del ESPEJO). Superconjunto
 * de `guardPromptAction`, al que **DELEGA** los dos tags de guardia para que las dos tablas
 * no puedan divergir; añade el único tag que el espejo necesita y el tour no:
 *
 *   `troll-toll` → **`"refuse"`** (tecla `n`).
 *
 * POR QUÉ ESTÁ SEPARADA DE `guardPromptAction`, y es deliberado: `payGuardIfPrompted`
 * (nav.ts, el Grand Tour) hace `press('y')` para TODO lo que no sea `"none"`/`"arrested"`,
 * y luego aplica el veredicto de pago del TRIBUTO (`tributePaymentVerdict`, oro = 10 gp ×
 * vivos). Si el peaje entrase por ahí, el tour pagaría el peaje y reventaría en el aserto
 * con una causa ajena. Con la tabla separada, `guardPromptAction("troll-toll")` sigue
 * dando `"none"` y **el Grand Tour queda byte-idéntico en comportamiento**.
 *
 * POR QUÉ `"refuse"` Y NO `"pay"` — la decisión la trae el CORPUS, no el arnés. Los cuatro
 * overlays de peaje de los dos corpus del espejo llevan `expectDelta: 0` y su `ledgerCite`
 * dice literalmente «el LP no pagó»: `ad01-g04` (39 gp) · `ad04-g10` (39) · `ad04-g17` (39)
 * · `ad05-g03` (36). El importe es `99 − 3×STR` (determinista), y rehusar es además la
 * ÚNICA rama de `resolveTrollToll` (core/game.ts, MAINOUT 0x1B3E) que no toca el oro —
 * o sea, la única que no puede mover un delta de ledger armado. Pagar contradiría los
 * cuatro `expectDelta: 0` a la vez.
 *
 * Y no hay tercera salida: el getkey del peaje es crudo (ESC ignorado, `prompt-manager`
 * tipo `yesno`) y `resolveTrollToll` sólo tiene dos ramas (pagar → sigue el turno;
 * rehusar/no-poder → combate de trolls). «Cerrar sin fabricar estado» es IMPOSIBLE POR
 * CONSTRUCCIÓN para este prompt: la elección real es cuál de los dos estados se fabrica,
 * y el corpus ya dice cuál fabricó el LP.
 */
export type BlockingYesNoAction = GuardPromptAction | "refuse";

export function blockingYesNoAction(tag: string | null | undefined): BlockingYesNoAction {
  if (tag === "troll-toll") return "refuse";
  return guardPromptAction(tag);
}

/**
 * F4 — VEREDICTO del beat `guard-tribute-paid` (task #52, cierra la vía tributo→pago de
 * #46). Tabla pura: dado el estado ANTES y DESPUÉS de responder al prompt del guardia,
 * ¿el pago fue el que el binario modela?
 *
 * Por qué con ASERTO y no sólo con marca: una marca de cobertura sólo dice «pasé por
 * aquí». Los dos hechos que DEFINEN el pago son cuantitativos, y sin comprobarlos un
 * cobro de más, de menos, o un prompt que se queda abierto pasan por verdes:
 *
 *  1. `"amount"` — el oro baja EXACTAMENTE `10 × vivos`. Es el importe derivado de
 *     `guardDemand` (TALK 0x0230-0x0269): `0xa` por miembro con `status != 'D'`
 *     (`0x025a cmp byte[si],0x44`). Un delta distinto significa que el cobro NO es el
 *     modelado — o que no hubo cobro (arresto) sino otra cosa.
 *  2. `"prompt"` — el prompt queda CERRADO. Con oro suficiente `guardDemand` devuelve
 *     `ret 0`: el guardia queda satisfecho y no imprime texto. Un prompt todavía abierto
 *     significa que la respuesta no lo resolvió.
 *
 * Este veredicto es ADEMÁS el control de no-cárcel del re-sello de ch08: si el arresto
 * hubiera ocurrido, el oro no bajaría en múltiplos exactos del tributo.
 */
export type TributeVerdict = "ok" | "amount" | "prompt";

/** location de Minoc (`blackthorn.ts:LOC_MINOC`, `0x01f3 cmp [g_location],5`). */
export const LOC_MINOC = 5;

/**
 * Importe DERIVADO que el guardia se lleva, según la rama de `guardDemand` que aplique:
 *
 *  · **Minoc es CARIDAD, no tributo** (`blackthorn.ts:647`, `0x01f3 cmp [g_location],5`):
 *    aceptar es `gold = trunc(gold/2)` y devuelve SIEMPRE `ret 0` — sin gate de oro y sin
 *    escalada posible. Minoc no puede arrestar por pobre que vaya el party.
 *  · en cualquier otro pueblo es TRIBUTO: `10 × vivos` con gate de oro.
 *
 * ⚠ Esta distinción NO es cosmética: sin ella el aserto del beat acusaría en FALSO a una
 * caridad legítima («el cobro no es el modelado») porque el oro no bajaría en múltiplos de
 * 10×vivos sino a la mitad. Hoy ningún capítulo dispara la caridad —el censo mide 0
 * demandas en Minoc— pero los guardias DEAMBULAN: la ausencia de hoy es fortuna, no ley,
 * y un instrumento que sólo es correcto mientras la fortuna aguante no sirve de guarda.
 */
export function guardChargeFor(before: { gold: number; living: number; loc: number }): number {
  if (before.loc === LOC_MINOC) return before.gold - Math.trunc(before.gold / 2);
  return before.living * 10;
}

export function tributePaymentVerdict(
  before: { gold: number; living: number; loc: number },
  after: { gold: number; tag: string | null },
): TributeVerdict {
  if (after.gold !== before.gold - guardChargeFor(before)) return "amount";
  if (after.tag !== null) return "prompt";
  return "ok";
}
