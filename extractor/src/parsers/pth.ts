/**
 * Parser de BRITISH.PTH — las RUTAS de las figuras andantes del "attract" de la
 * pantalla de título (demo autónomo del vídeo E del usuario). Derivado byte a
 * byte de `path_walk_anim` (INTRO.OVL 0x0050) y su llamador (0x0c02-0x0c3f);
 * re/notes/intro.md §3.
 *
 * CODEC (path_walk_anim 0x00ab-0x00f7): cada byte `b` codifica UN paso de una
 * figura sobre la pantalla:
 *   - Δx = b & 7            (bits 0-2 = |dx|), negado si b & 0x08 (bit 3).
 *   - Δy = (b >> 4) & 7     (bits 4-6 = |dy|), negado si b & 0x80 (bit 7).
 *   El paso mueve [bp+4] += Δx (la coord que arranca en el 2º arg del llamador) y
 *   [bp+6] += Δy (la del 1er arg). Cada 0x1f pasos hay un tick de animación
 *   (0x0110, `call 0x9f3a`); un poll de tecla (0x9b9e) aborta el demo.
 *   - `b == 0` TERMINA la ruta actual (0x011e: `cmp byte[bx+si],0; jz return`);
 *     la rutina se llama 4 veces (0x0c0f/0x1e/0x2d/0x3c), una por figura, con el
 *     cursor compartido `[0xbb18]` avanzando de una ruta a la siguiente.
 *
 * POSICIONES DE ARRANQUE (llamador 0x0c07-0x0c3b, 4 `push (x,y)` antes de cada
 * `call 0x50`): (0x2c,0x44), (0x40,0x5e), (0x8f,0x4e), (0xa7,0x69) en px lógicos.
 * El primer valor pusheado queda en [bp+6] (recibe Δy), el segundo en [bp+4]
 * (recibe Δx) — es decir el par se lee como (Δy-start, Δx-start); aquí se expone
 * como {x, y} con x = coord de Δx, y = coord de Δy (verificado: las 4 figuras
 * permanecen dentro de 320×200 con este mapeo).
 */

/** Un paso de figura: desplazamiento en px lógicos. */
export interface PathStep {
  dx: number;
  dy: number;
}

/** Una ruta de figura: posición inicial + pasos hasta el terminador 0x00. */
export interface PathRoute {
  start: { x: number; y: number };
  steps: PathStep[];
}

export interface BritishPath {
  routes: PathRoute[];
}

/**
 * Posiciones de arranque de las 4 figuras (INTRO.OVL 0x0c07-0x0c3b). El llamador
 * pushea (a, b) y en path_walk_anim [bp+4]=b recibe Δx, [bp+6]=a recibe Δy →
 * x = b (2º valor), y = a (1er valor). Los pares del asm son
 * (0x2c,0x44),(0x40,0x5e),(0x8f,0x4e),(0xa7,0x69) = (a,b); de ahí {x:b, y:a}.
 */
export const FIGURE_STARTS: readonly { x: number; y: number }[] = [
  { x: 0x44, y: 0x2c },
  { x: 0x5e, y: 0x40 },
  { x: 0x4e, y: 0x8f },
  { x: 0x69, y: 0xa7 },
];

/** Decodifica un byte de paso (b != 0) a su (dx, dy) con signo. */
function decodeStep(b: number): PathStep {
  let dx = b & 0x7;
  if (b & 0x08) dx = -dx;
  let dy = (b >> 4) & 0x7;
  if (b & 0x80) dy = -dy;
  return { dx, dy };
}

/**
 * Parsea BRITISH.PTH en sus rutas (una por figura), troceando por el terminador
 * 0x00 y emparejando cada ruta con su posición de arranque derivada. Ignora un
 * posible trozo vacío final (padding tras el último terminador).
 */
export function parseBritishPath(bytes: Uint8Array): BritishPath {
  const routes: PathRoute[] = [];
  let steps: PathStep[] = [];
  for (let i = 0; i < bytes.length; i++) {
    const b = bytes[i]!;
    if (b === 0) {
      // Terminador de ruta: cierra la ruta actual (aunque quede vacía sólo si
      // hubo pasos previos — un 0 inicial no crea ruta espuria).
      if (steps.length > 0) {
        const start = FIGURE_STARTS[routes.length] ?? { x: 0, y: 0 };
        routes.push({ start: { ...start }, steps });
        steps = [];
      }
      continue;
    }
    steps.push(decodeStep(b));
  }
  // Cola sin terminar (por si el fichero no cierra con 0x00).
  if (steps.length > 0) {
    const start = FIGURE_STARTS[routes.length] ?? { x: 0, y: 0 };
    routes.push({ start: { ...start }, steps });
  }
  return { routes };
}
