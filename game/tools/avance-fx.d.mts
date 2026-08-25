/**
 * Declaraciones de `avance-fx.mjs` (#207).
 *
 * ── POR QUÉ UN SIDECAR .d.mts Y NO CONVERTIR EL MÓDULO A .ts ─────────────────────────
 * Porque el consumidor de producción es NODE PELADO. `partida-render.mjs` se ejecuta con
 * `node game/tools/partida-render.mjs <id>` (su propia cabecera lo documenta así) e importa
 * este módulo con `./avance-fx.mjs`. Node no importa TypeScript: convertirlo obligaría a
 * meter un paso de compilación —o un loader— en una herramienta que hoy corre sin ninguno,
 * y a cambiar la línea de uso publicada. El coste caería sobre el pipeline de render entero
 * para arreglar un aviso de tipos del ARNÉS.
 *
 * El reparto que queda, y es el que se quería: el módulo es JS ejecutable por node; el test
 * de la puerta lo importa TIPADO. `game/tsconfig.json` lleva `include: ["src","tests"]`, así
 * que `tools/` no entra al programa por sí mismo — entra sólo a través de este fichero,
 * cuando `tests/render-avance-fx.test.ts` resuelve el import.
 *
 * 🔴 LA EXTENSIÓN ES `.d.mts`, NO `.d.ts`: TypeScript empareja un import `./x.mjs` con
 * `x.d.mts`. Un `.d.ts` al lado NO lo recoge y el error TS7016 sigue exactamente igual.
 *
 * ⚠️ Estas firmas son una COPIA A MANO del módulo: nada las obliga a coincidir con él. Si
 * cambias la firma de `avanzaPasoDeReplay`, cámbiala aquí — el guardián de que no divergen
 * en lo que importa es `tests/render-avance-fx.test.ts`, que conduce la función REAL con
 * estos tipos puestos y se pondría rojo si dejaran de describirla.
 */

/** Subfotogramas que se avanzan SIEMPRE, haya o no animación viva (el ritmo del replay). */
export const SUBFOTOGRAMAS_MIN: number;

/** Tope de seguridad: subfotogramas máximos de UN paso de replay. Backstop, no presupuesto. */
export const TOPE_SUBFOTOGRAMAS: number;

/** Lo que se le pasa al aviso cuando el tope corta con el predicado todavía en alto. */
export interface AvisoDeTope {
  /** Índice del paso de replay donde saltó el tope (-1 si el llamador no lo pasó). */
  paso: number;
  /** El tope que se alcanzó, en subfotogramas. */
  tope: number;
}

export interface OpcionesDeAvance {
  /** Avanza el reloj y captura UN fotograma. Si lanza, se propaga sin tocar. */
  subfotograma: () => Promise<void>;
  /** Predicado de animación viva. */
  hayFxViva: () => Promise<boolean>;
  /** Se llama UNA vez si el tope corta. Por defecto LANZA: el silencio no es la opción de fábrica. */
  alAlcanzarTope?: (info: AvisoDeTope) => void;
  /** Índice del paso, sólo para el mensaje. */
  paso?: number;
  /** Mínimo de ritmo. Por defecto `SUBFOTOGRAMAS_MIN`. */
  minimo?: number;
  /** Tope de seguridad. Por defecto `TOPE_SUBFOTOGRAMAS`. */
  tope?: number;
}

export interface ResultadoDeAvance {
  /** Subfotogramas avanzados en este paso (≥ `minimo`). */
  subfotogramas: number;
  /** ¿Cortó el tope con el predicado todavía en alto? */
  topeAlcanzado: boolean;
}

/**
 * Avanza UN paso de replay: el mínimo de ritmo y luego lo que haga falta hasta que no quede
 * animación viva, sin pasar del tope.
 */
export function avanzaPasoDeReplay(o: OpcionesDeAvance): Promise<ResultadoDeAvance>;
