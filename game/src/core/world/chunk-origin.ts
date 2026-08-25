/**
 * Origen de la VENTANA DE CHUNKS del overworld (`g_chunk_origin_x/y`, DS:0x589b/0x589c):
 * el rincón superior-izquierdo (múltiplo de 16) de la caché 32×32 que el motor mantiene
 * cargada alrededor del party (caché 0x6608). La (V)iew-a-gem lo usa como origen de su
 * rejilla 32×32 (gem_view LOOKOBJ 0x1136: `ext_a172(chunk_origin+col, chunk_origin+row)`)
 * y el marcador es `party − chunk_origin` (0x1109/0x110f) — por eso el original NO centra
 * la ventana en el jugador: la ancla a la caché, cuantizada a 16.
 *
 * Derivado de MAINOUT.OVL:
 *  - `initChunkOrigin` (0x0019-0x004c): al ENTRAR al overworld, origen = party alineado
 *    a 16 hacia abajo, y si el party cae en la mitad IZQUIERDA de su bloque de 16
 *    (`party & 0xF < 8`) la ventana se corre un bloque a la izquierda → el jugador queda
 *    en las columnas 8..23 del 32 (nunca centrado fijo en 16).
 *  - `scrollChunkOrigin` (0x0354-0x03cb): al MOVERSE, si el jugador sale de la ZONA MUERTA
 *    (rel 5..26 en AMBOS ejes, rel = (party − origin) & 0x1f) la ventana se corre ±16 en la
 *    dirección del paso. Es HISTERÉTICO: el origen depende del camino, no sólo de la
 *    posición actual. `initChunkOrigin` da un origen VÁLIDO (el de entrada) pero puede
 *    diferir en ±16 del real tras deambular — para la reproducción exacta hay que mantener
 *    el estado con `scrollChunkOrigin` en cada paso del overworld.
 */
export interface ChunkOrigin {
  x: number;
  y: number;
}

/** Un eje del origen inicial (MAINOUT 0x001c-0x0031). Todo mod 256 (mundo toroidal). */
function initAxis(p: number): number {
  let o = p & 0xf0; // 0x001c: and al, 0xf0  → bloque de 16 que contiene al party
  if ((p & 0x0f) < 8) o = (o - 0x10) & 0xf0; // 0x0026: cmp 8; jb → sub 0x10; and 0xf0
  return o & 0xff;
}

/** Origen de la ventana al ENTRAR al overworld en (px,py). MAINOUT 0x0019-0x004c. */
export function initChunkOrigin(px: number, py: number): ChunkOrigin {
  return { x: initAxis(px & 0xff), y: initAxis(py & 0xff) };
}

/**
 * Scroll histerético del origen al mover el party de (dx,dy). MAINOUT 0x0354-0x03cb:
 * si el jugador sigue en la zona muerta (5..26 en ambos ejes) la ventana no se mueve;
 * si sale, se corre ±16 en la dirección del paso. `px,py` = posición YA movida.
 */
export function scrollChunkOrigin(
  origin: ChunkOrigin,
  px: number,
  py: number,
  dx: number,
  dy: number,
): ChunkOrigin {
  const relX = (px - origin.x) & 0x1f; // 0x036d-0x037a: (party − origin) & 0x1f
  const relY = (py - origin.y) & 0x1f;
  // 0x0391-0x03a5: dead-zone gate — sólo NO scroll si ambos en [5,26].
  const inDeadZone = relX >= 5 && relX <= 0x1a && relY >= 5 && relY <= 0x1a;
  if (inDeadZone) return origin;
  // 0x03b0-0x03cb: origen += delta*16, realineado a 16 (y wrap mod 256).
  return { x: (origin.x + dx * 16) & 0xf0, y: (origin.y + dy * 16) & 0xf0 };
}

/**
 * ¿El origen MANTENIDO sigue siendo válido para (px,py)? — el party debe caer DENTRO de la
 * ventana 32×32 (`(party−origin)&0xff < 32` en ambos ejes). Tras un paso continuo la
 * histéresis mantiene al party en [5,26]; tras un salto NO-continuo (teleport/moongate/
 * entrada de pueblo/carga) el origen queda stale y el party sale de la ventana → hay que
 * RE-DERIVAR (el binario re-deriva chunk_origin al cargar el mapa). Esto evita hilvanar un
 * reset en los ~9 sitios de `map-changed`: la staleness se detecta por geometría.
 */
function originFresh(o: ChunkOrigin | undefined, px: number, py: number): o is ChunkOrigin {
  return !!o && ((px - o.x) & 0xff) < 32 && ((py - o.y) & 0xff) < 32;
}

/**
 * Origen de la ventana para la (V)iew-a-gem: el MANTENIDO si sigue fresco, si no la fórmula
 * de ENTRADA (`initChunkOrigin`). Read-only (no muta). El caller pasa `state.chunkOrigin`.
 */
export function gemChunkOrigin(current: ChunkOrigin | undefined, px: number, py: number): ChunkOrigin {
  return originFresh(current, px, py) ? current : initChunkOrigin(px & 0xff, py & 0xff);
}

/**
 * Avanza el origen mantenido UN paso overworld (histéresis, `scrollChunkOrigin`). `nx,ny` =
 * posición YA movida, `dx,dy` = el paso. Si el origen previo estaba stale (o ausente), se
 * re-deriva de la posición PRE-paso antes de aplicar el scroll de este paso. Devuelve el
 * nuevo origen a guardar en `state.chunkOrigin`.
 */
export function stepChunkOrigin(
  current: ChunkOrigin | undefined,
  nx: number,
  ny: number,
  dx: number,
  dy: number,
): ChunkOrigin {
  const preX = (nx - dx) & 0xff;
  const preY = (ny - dy) & 0xff;
  const base = originFresh(current, preX, preY) ? current : initChunkOrigin(preX, preY);
  return scrollChunkOrigin(base, nx & 0xff, ny & 0xff, dx, dy);
}
