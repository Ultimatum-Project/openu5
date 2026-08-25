/**
 * Creación de personaje — el cuestionario de la gitana (FONT.OVL, la
 * "Summoning" del inicio de partida). Re-derivado byte a byte del binario
 * original (FONT.OVL [0x0998,0x0E52); tablas en DATA.OVL). Evidencia completa
 * y citas en re/verified/gypsy.md y re/notes/gypsy.md.
 *
 * Mecánica exacta:
 *   - Torneo de eliminación de las 8 virtudes: 4 + 2 + 1 = 7 emparejamientos
 *     (driver FONT 0x0cd0). Cada ronda empareja TODAS las virtudes vivas.
 *   - pick_virtue (FONT 0x0998): rand_range(0,7) del kernel (OriginalRng) con
 *     muestreo por RECHAZO de virtudes ya usadas-esta-ronda o ya eliminadas;
 *     marca la elegida como usada. Entre rondas se limpia "usada-esta-ronda"
 *     (FONT 0x0ce4/0x0d0f); "eliminada" persiste.
 *   - matchup (FONT 0x09c8): elige X,Y; ordena a=min(X,Y), b=max(X,Y). La
 *     respuesta 'A' hace ganar a la virtud de índice MENOR, 'B' a la mayor;
 *     el perdedor se elimina. La posición A/B es solo presentación.
 *   - Puntuación (FONT 0x0ae0): la virtud GANADORA suma sus (STR,DEX,INT) de
 *     las tablas DATA.OVL a los acumuladores (que arrancan en los valores del
 *     registro = INIT.GAM 15/15/15).
 *   - Finalize (FONT 0x0dc8): INT = acc_int; MP (currentMp) = INT; DEX =
 *     acc_dex; STR = max(acc_str, 20)  ← suelo 20 SOLO en STR.
 *   - HP/maxHP/exp/level/clase/equipo NO se tocan (quedan los de INIT.GAM).
 *
 * 🔴 DIVERGENCIA DELIBERADA — Clase C, precedente D6. Corregido 2026-08-06 (#70).
 *
 * Este docblock decía: «al arrancar la partida g_rng_seed = 0 y NADA re-siembra entre el
 * boot y la gitana (rng.md: 0 sitios srand/time_hash en INTRO/FONT)». **Esa cláusula del
 * medio es FALSA** y se citaba a un `rng.md` que ya no la dice: el controlador de portada
 * (`INTRO.OVL 0x0986`) SÍ re-siembra —`0x0cc9` `rng_time_hash()` + `0x0ccd` `srand(ax)`—
 * una vez por llegada al menú y SIEMPRE antes de la tecla que elige opción, y 'C' =
 * *Create a character* es una de ellas. Byte-exacto en `re/notes/rng-186-acta.md` §6.
 * (Las otras dos cláusulas siguen siendo CIERTAS: INTRO no tira ningún `rand`, y el único
 * `rand` de FONT es este mismo `pick_virtue`. Por eso la frase se leía como válida.)
 *
 * ⇒ En el original el bracket VARÍA entre partidas. **El clon mantiene semilla 0 A
 * PROPÓSITO**, no por descuido: la repetición determinista —que las mismas teclas
 * produzcan la misma partida— es una propiedad declarada del producto y descansa en que
 * la creación sea reproducible. Sembrar del reloj la rompería para ganar fidelidad en un
 * punto que el jugador vive una vez por partida. Decisión del lead, 2026-08-06.
 *
 * Refinamiento OPCIONAL, no bloqueante (tarjeta T1 del acta): que la gitana observe una
 * semilla ≠ 0 *en corrida real* está DERIVADO del trazado, no medido en vivo — `time_hash`
 * da 12 bits, así que 1 de cada 4096 arranques daría 0 por casualidad, y el acta no
 * descarta un camino a la pantalla de creación sin trazar. Medirlo no cambiaría la
 * decisión; sólo afinaría la declaración.
 *
 * Lo que NO cambia: el emparejamiento de rondas 2-3 depende de las respuestas (la
 * eliminación filtra el rechazo del RNG), así que RNG y respuestas están entrelazados —
 * la simulación debe interleaver pick → par → respuesta → eliminar.
 */
import { OriginalRng } from "../rng-original.js";

/** Índice canónico de virtud de Ultima (orden de DATA.OVL). */
export enum Virtue {
  Honesty = 0,
  Compassion = 1,
  Valor = 2,
  Justice = 3,
  Sacrifice = 4,
  Honor = 5,
  Spirituality = 6,
  Humility = 7,
}

/**
 * Puntos que aporta cada virtud al GANAR un emparejamiento. Tablas de DATA.OVL
 * (mapeo DS→fileoff = DS + 0x10; verificado contra el binario):
 *   STR  DS:0x5174 (fileoff 0x5184)  [0,0,2,0,1,1,1,0]
 *   DEX  DS:0x516c (fileoff 0x517c)  [0,2,0,1,1,0,1,0]
 *   INT  DS:0x5164 (fileoff 0x5174)  [2,0,0,1,0,1,1,0]
 * El modelo de paridad (re/tools/gypsy_parity.py) los relee de DATA.OVL y los
 * cruza contra estas constantes (test_gypsy_parity.py::test_tables_match_binary).
 */
export const VIRTUE_STR: readonly number[] = [0, 0, 2, 0, 1, 1, 1, 0];
export const VIRTUE_DEX: readonly number[] = [0, 2, 0, 1, 1, 0, 1, 0];
export const VIRTUE_INT: readonly number[] = [2, 0, 0, 1, 0, 1, 1, 0];

/** Emparejamientos por ronda del torneo (FONT 0x0cd0): 4 + 2 + 1 = 7. */
const ROUND_SCHEDULE: readonly number[] = [4, 2, 1];

/** Total de virtudes / de preguntas C(8,2). */
const VIRTUE_COUNT = 8;

/**
 * Índice (0-based) de la pregunta de QUESTION.DAT para un par de virtudes.
 * Las 28 preguntas están en orden combinatorio i<j; `k = 28 − (8−i)(7−i)/2 +
 * (j−i)` (1-based) → índice `k−1`. El original indexa la matriz de DATA.OVL con
 * los dos picks X,Y SIN ordenar (FONT 0x0a8d, pre-swap), pero la matriz es
 * simétrica, así que usar `{lo=min, hi=max}` da el mismo registro.
 */
export function questionIndexForPair(a: number, b: number): number {
  const lo = Math.min(a, b);
  const hi = Math.max(a, b);
  const k = VIRTUE_COUNT * (VIRTUE_COUNT - 1) / 2 - ((VIRTUE_COUNT - lo) * (VIRTUE_COUNT - 1 - lo)) / 2 + (hi - lo);
  return k - 1;
}

/** Suelo de STR en el finalize (FONT 0x0dda: sub 0x14/sbb/not/and/add 0x14). */
const STR_FLOOR = 20;

/** Base de atributos del Avatar en INIT.GAM (los acumuladores parten de aquí). */
export interface GypsyBase {
  strength: number;
  dexterity: number;
  intelligence: number;
}

/** Un emparejamiento mostrado al jugador. `a` < `b` (índices de virtud). */
export interface GypsyMatchup {
  a: number;
  b: number;
}

/** Un emparejamiento ya resuelto (para UI/paridad). */
export interface GypsyResolved {
  a: number;
  b: number;
  answer: "A" | "B";
  winner: number;
}

/** Stats finales que la gitana escribe sobre el registro del Avatar. */
export interface GypsyStats {
  strength: number;
  dexterity: number;
  intelligence: number;
  currentMp: number;
}

/**
 * Torneo de la gitana con estado, para conducir la pantalla de creación
 * interactiva: `next()` da el siguiente par a preguntar (o null al terminar),
 * `answer('A'|'B')` registra la elección. `finalize()` da los stats.
 *
 * Determinismo: seed por defecto = 0.
 *
 * 🔴 NO «ARREGLES» ESTE DEFAULT POR FIDELIDAD. El 0 NO es «el del arranque del original»
 * —el original re-siembra del reloj en la portada antes de llegar aquí (`INTRO.OVL`
 * `0x0cc9`/`0x0ccd`, cabecera de este fichero)—: es una DIVERGENCIA DELIBERADA que sostiene
 * la repetición determinista del clon (las mismas teclas ⇒ la misma partida), propiedad
 * declarada del producto. Cambiarlo a una semilla de reloj rompe la repetición Y los
 * arneses de paridad, y el jugador sólo lo vive una vez por partida.
 * Registro: `re/deliberate-divergences.md` (Clase C, precedente D6) · ficha #70.
 */
export class GypsyTournament {
  private readonly rng: OriginalRng;
  private readonly used: boolean[] = new Array(8).fill(false);
  private readonly eliminated: boolean[] = new Array(8).fill(false);
  private accStr: number;
  private accDex: number;
  private accInt: number;
  private roundIdx = 0;
  private matchInRound = 0;
  private pending: GypsyMatchup | null = null;
  /** Historial de emparejamientos resueltos (en orden). */
  readonly resolved: GypsyResolved[] = [];

  constructor(base: GypsyBase, seed = 0) {
    this.rng = new OriginalRng(seed);
    this.accStr = base.strength;
    this.accDex = base.dexterity;
    this.accInt = base.intelligence;
  }

  /** rand_range(0,7) con rechazo de usadas-esta-ronda / eliminadas (FONT 0x0998). */
  private pick(): number {
    for (;;) {
      const v = this.rng.next(0, 7);
      if (this.used[v] || this.eliminated[v]) continue;
      this.used[v] = true;
      return v;
    }
  }

  /** ¿Quedan emparejamientos por preguntar? */
  done(): boolean {
    return this.roundIdx >= ROUND_SCHEDULE.length;
  }

  /**
   * Siguiente par a mostrar, o null si el torneo terminó. Consume RNG. Debe
   * seguirse de `answer()` antes del siguiente `next()`.
   */
  next(): GypsyMatchup | null {
    if (this.done()) return null;
    if (this.pending) return this.pending;
    // Al empezar rondas 2 y 3 se limpia "usada-esta-ronda" (FONT 0x0ce4/0x0d0f).
    if (this.matchInRound === 0 && this.roundIdx > 0) this.used.fill(false);
    const x = this.pick();
    const y = this.pick();
    this.pending = { a: Math.min(x, y), b: Math.max(x, y) };
    return this.pending;
  }

  /** Registra la respuesta al par pendiente: 'A'=gana el menor, 'B'=el mayor. */
  answer(choice: "A" | "B"): void {
    if (!this.pending) throw new Error("GypsyTournament.answer sin par pendiente");
    const { a, b } = this.pending;
    const winner = choice === "A" ? a : b;
    const loser = choice === "A" ? b : a;
    this.accStr += VIRTUE_STR[winner] ?? 0;
    this.accDex += VIRTUE_DEX[winner] ?? 0;
    this.accInt += VIRTUE_INT[winner] ?? 0;
    this.eliminated[loser] = true;
    this.resolved.push({ a, b, answer: choice, winner });
    this.pending = null;
    this.matchInRound += 1;
    if (this.matchInRound === ROUND_SCHEDULE[this.roundIdx]) {
      this.roundIdx += 1;
      this.matchInRound = 0;
    }
  }

  /**
   * Valor vivo de g_rng_seed tras las tiradas consumidas hasta ahora (F.2):
   * permite ENCADENAR el stream — el original comparte un único g_rng_seed, así
   * que la ruta crítica gitana→exterior→pueblo continúa desde esta semilla.
   */
  seedAfter(): number {
    return this.rng.getSeed();
  }

  /** Aplica el finalize (FONT 0x0dc8): STR con suelo 20, MP = INT. */
  finalize(): GypsyStats {
    const intelligence = this.accInt & 0xff;
    return {
      strength: Math.max(this.accStr & 0xff, STR_FLOOR),
      dexterity: this.accDex & 0xff,
      intelligence,
      currentMp: intelligence, // MP = INT (FONT 0x0dce)
    };
  }
}

/**
 * Ejecuta el torneo completo con un guion fijo de 7 respuestas 'A'/'B' sobre el
 * bracket determinista (seed por defecto 0). Devuelve los stats y el detalle de
 * los 7 emparejamientos. Usado por tests y por el runner de paridad.
 */
export function runGypsyQuiz(
  base: GypsyBase,
  answers: readonly ("A" | "B")[],
  seed = 0,
): GypsyStats & { matchups: GypsyResolved[] } {
  const total = ROUND_SCHEDULE.reduce((s, n) => s + n, 0);
  if (answers.length !== total) {
    throw new Error(`runGypsyQuiz espera ${total} respuestas, recibió ${answers.length}`);
  }
  const t = new GypsyTournament(base, seed);
  for (const ans of answers) {
    t.next();
    t.answer(ans);
  }
  const stats = t.finalize();
  return { ...stats, matchups: t.resolved };
}
