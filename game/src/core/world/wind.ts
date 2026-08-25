/**
 * Viento y navegación por viento — reglas EXACTAS del original (Task 3.7).
 *
 * Port bit a bit de las rutinas del kernel/MAINOUT re-derivadas en
 * re/notes/transport.md (§Viento) y re/verified/transport.md:
 *
 *  - maybe_change_wind (kernel 0x2F62): se llama UNA vez por world-turn desde
 *    el housekeeping 0x5910 (gate [0x5891]!=0; Time-stop lo salta). Consume
 *    SIEMPRE 1×rand(0,63); 63/64 no cambia. En el hit 1/64 propone dirección
 *    con rand(0,4) y, si propone Calm, la acepta solo si rand(0,255)>=192
 *    (Calm infra-ponderado ~1/4), re-tirando en caso contrario. Es el ÚNICO
 *    consumo de RNG del TICK DE VIENTO — crítico para la paridad del stream
 *    (el broadside y la reparación consumen su propio rand aparte).
 *  - set_wind (kernel 0x2E96): escribe g_wind (0x5892) y RESETEA el contador
 *    de deriva g_wind_drift_ctr (0x5883). Único escritor de g_wind en toda la
 *    imagen (lo llaman maybe_change_wind y Rel Hur).
 *  - Empuje del viento (tablas DATA.OVL 0x29F5/0x29F9): el viento empuja en la
 *    dirección OPUESTA a su nombre (viento del Norte empuja al Sur).
 *  - Deriva del barco (MAINOUT 0x0598/0x0619-0x0655): cadencia determinista
 *    (sin RNG) por contador 0x5883 con umbral di%3 (a favor 1 / perpendicular
 *    2 / en contra 0).
 */
import type { GameState } from "../state.js";
import type { RandFn } from "./survival.js";

/** g_wind (DS 0x5892): 0=Calm, 1=North, 2=South, 3=East, 4=West. */
export const WIND_CALM = 0;
export const WIND_NORTH = 1;
export const WIND_SOUTH = 2;
export const WIND_EAST = 3;
export const WIND_WEST = 4;

/**
 * Empuje del viento (DATA.OVL wind_dx@0x29F5 / wind_dy@0x29F9), indexado por
 * g_wind. El viento empuja hacia la dirección opuesta a su nombre: N→(0,+1),
 * S→(0,−1), E→(−1,0), W→(+1,0); Calm (idx 0) no se usa (la deriva se salta).
 */
export const WIND_DX: readonly number[] = [0, 0, 0, -1, 1];
export const WIND_DY: readonly number[] = [0, 1, -1, 0, 0];

/**
 * Nombres para la línea de estado (kernel 0x2E96 switch): "<Dir> Winds".
 * El original escribe "Calm ","North","South","East ","West " + " Winds".
 */
export const WIND_NAMES: readonly string[] = ["Calm", "North", "South", "East", "West"];

/**
 * Etiquetas COMPUESTAS de la banda de vientos (`<dir campo 5> + " Winds"`), tal como
 * las blitea la piel fiel (`skin.ts`, ULTIMA.EXE 0x2ed9 + " Winds" DATA.OVL 0x558a).
 * Existen como const escaneada para que la guarda anti-fab (extract-user-strings
 * `DISPLAY_CONSTS`) las vea y `es.json` pueda traducir la banda ENTERA por su string
 * inglés exacto (con su doble espacio para los nombres de 4 letras). La piel indexa
 * aquí por `WIND_NAMES.indexOf(snap.wind)` y pasa el resultado por `t()`.
 */
export const WIND_BAND_LABELS: readonly string[] = [
  "Calm  Winds",
  "North Winds",
  "South Winds",
  "East  Winds",
  "West  Winds",
];

/**
 * g_sail_dir (DS 0x5955): rumbo del barco. 0 = parado; si no, código de
 * dirección del kernel (1=Oeste, 2=Este, 3=Norte, 4=Sur — getkey, ver
 * re/notes/transport.md §Rumbos). El barco navegando repite este rumbo solo.
 */
const SAIL_STOPPED = 0;

/** Rumbo (g_sail_dir 1=W,2=E,3=N,4=S) → vector de avance (MAINOUT 0x05FB). */
export function courseVector(sailDir: number): { dx: number; dy: number } {
  switch (sailDir) {
    case 1:
      return { dx: -1, dy: 0 }; // Oeste
    case 2:
      return { dx: 1, dy: 0 }; // Este
    case 3:
      return { dx: 0, dy: -1 }; // Norte
    case 4:
      return { dx: 0, dy: 1 }; // Sur
    default:
      return { dx: 0, dy: 0 };
  }
}

/**
 * set_wind(w) — kernel 0x2E96. Escribe g_wind y resetea el contador de deriva
 * (0x2EA5: `mov byte[0x5883],0`). arg -1 en el original solo redibuja la
 * brújula; aquí no se modela el redibujado (usar el valor 0..4).
 */
export function setWind(state: GameState, w: number): void {
  state.wind = w;
  state.windDriftCtr = 0;
}

/**
 * maybe_change_wind() — kernel 0x2F62. Se llama 1×/world-turn. Consume
 * SIEMPRE 1×rand(0,63); si sale 0 (1/64) cambia el viento. Devuelve true si
 * el viento cambió. NO redibuja fuera del overworld (el caller decide cuándo
 * llamarla; ver el gate [0x5891] en re/notes/transport.md §Viento).
 *
 * Bucle de propuesta (0x2f89-0x2f9d):
 *   w = rand(0,4); si w!=0 → set_wind(w)
 *   si w==0 (propone Calm): k = rand(0,255); si k>=0xC0 → set_wind(0)
 *                           si no → re-tira rand(0,4)
 */
export function maybeChangeWind(state: GameState, rand: RandFn): boolean {
  if (rand(0, 63) !== 0) return false; // 63/64: sin cambio, 1 rand consumido
  for (;;) {
    const w = rand(0, 4);
    if (w !== 0) {
      setWind(state, w);
      return true;
    }
    if (rand(0, 255) >= 0xc0) {
      setWind(state, WIND_CALM);
      return true;
    }
    // k<192: Calm rechazada, re-tira rand(0,4) (sesgo anti-calma).
  }
}

/**
 * Cadencia de auto-deriva del barco (MAINOUT 0x0619-0x0655) — SIN RNG.
 * Devuelve true si el barco auto-avanza un tile en su rumbo este tick.
 *
 * di = 1 + (empuje_x≠rumbo_x) + (empuje_y≠rumbo_y); umbral = di%3
 *   a favor del viento (empuje==rumbo)  → di=1 → umbral 1
 *   perpendicular                        → di=2 → umbral 2
 *   en contra (empuje opuesto al rumbo)  → di=3 → umbral 0 (avanza siempre)
 * Si umbral > ctr: no deriva y ctr++ (0x06A7). Si no: ctr=0 y deriva (0x0651).
 * Con Calm (0x05ED) la deriva se salta por completo (no auto-avanza).
 */
export function windDriftStep(state: GameState): boolean {
  const sailDir = state.sailDir ?? SAIL_STOPPED;
  if (sailDir === SAIL_STOPPED) return false;
  const w = state.wind ?? WIND_CALM;
  if (w === WIND_CALM) {
    // Calm: no hay empuje; el barco no auto-deriva (0x05ED je 0x670).
    return false;
  }
  const course = courseVector(sailDir);
  let di = 1;
  if (WIND_DX[w] !== course.dx) di++;
  if (WIND_DY[w] !== course.dy) di++;
  const threshold = di % 3;
  const ctr = state.windDriftCtr ?? 0;
  if (threshold > ctr) {
    state.windDriftCtr = ctr + 1;
    return false;
  }
  state.windDriftCtr = 0;
  return true;
}
