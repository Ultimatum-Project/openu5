/**
 * REGISTRO DE TECLAS — tipos (carril 2 del diseño de lanzamiento,
 * docs/superpowers/specs/2026-08-04-lanzamiento-e-instrumentacion-design.md).
 *
 * El fundamento es que el núcleo del port es PURO: mismo estado inicial + mismas
 * teclas ⇒ mismo resultado. Así que una partida entera cabe en
 *
 *     huella del estado inicial  +  [tecla, nº de turno] × N
 *
 * ⚠ Se indexa por TURNO, no por reloj de pared. El reloj gobierna la ANIMACIÓN y no
 * es reproducible: el mismo registro reproducido en una máquina más lenta, o a 4×,
 * daría otra partida si la posición de una tecla dependiera de milisegundos. El
 * `turn` de cada evento es a la vez el índice de salto Y la SUMA DE CONTROL: si al
 * reproducir la tecla i el `turnsSinceStart` resultante no es el registrado, la
 * repetición ha DIVERGIDO y se dice, en vez de seguir pintando una partida falsa.
 *
 * ⚠ Esta capa NO envía nada a ningún sitio. Es local (IndexedDB) y punto.
 */

/** Un evento del registro, ya decodificado. */
export interface ReplayEvent {
  /** `KeyboardEvent.key` tal cual lo consumió el juego. */
  key: string;
  /** `state.turnsSinceStart` DESPUÉS de que el juego procesara la tecla. */
  turn: number;
  /** Modificadores que el reductor mira (main.ts:821 y la rama numpad de 3952). */
  ctrl?: boolean;
  meta?: boolean;
  alt?: boolean;
  /** `KeyboardEvent.code` empezaba por "Numpad" (dígitos del teclado numérico). */
  numpad?: boolean;
}

/**
 * El ancla: de dónde arranca la repetición. Es el estado COMPLETO serializado más
 * la semilla viva del RNG del kernel (`g_rng_seed`), que NO viaja en el GameState —
 * es campo privado de `Game` (game.ts:632) y sin él la repetición diverge al primer
 * turno que tire un dado.
 */
export interface ReplayAnchor {
  /** `JSON.stringify(game.state)` en el instante de empezar a grabar. */
  state: string;
  /** `game.liveSeed()` en ese mismo instante. */
  seed: number;
}

/** Registro completo, tal y como se guarda en IndexedDB. */
export interface ReplayLog {
  /** Versión del formato. Sube si cambia la codificación. */
  v: 1;
  id: string;
  /** Nombre que ve el usuario. */
  label: string;
  /** Reloj de pared — METADATO para ordenar la lista. NUNCA se usa para reproducir. */
  createdAt: number;
  anchor: ReplayAnchor;
  /** Teclas codificadas: ~1 carácter por tecla (ver codec.ts). */
  keys: string;
  /** Deltas de turno codificados: ~1 carácter por tecla. */
  turns: string;
  /** Sidecar de modificadores: sólo las teclas que llevaban alguno (raro). */
  mods: string;
  /** Nº de teclas (redundante con `keys`, pero se lista sin decodificar). */
  count: number;
  /** Turno final (idem: la lista lo enseña sin decodificar). */
  lastTurn: number;
}

/** Cabecera para listar sin cargar el registro entero. */
export interface ReplayMeta {
  id: string;
  label: string;
  createdAt: number;
  count: number;
  lastTurn: number;
  /** Tamaño en BYTES UTF-8 del registro serializado (medida, no estimación). */
  bytes: number;
}
