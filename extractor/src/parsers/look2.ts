/**
 * Parser de LOOK2.DAT de Ultima V — las frases que imprime el comando (L)ook
 * ("Thou dost see " + <frase>) al describir un tile, indexadas por id de tile.
 *
 * Formato (derivado del volcado de bytes de LOOK2.DAT y de cmd_look 0x099c en
 * re/notes/lookobj.md, que hace `tile = *ext_a172(x,y)` y describe ese tile):
 *
 *   0x0000 .. (N*2-1) : tabla de N punteros uint16 LE, uno por tile (0..N-1).
 *                       Cada puntero es un OFFSET absoluto dentro del fichero.
 *   pool de strings    : cadenas ASCII terminadas en NUL a las que apuntan los
 *                       punteros. Varios tiles pueden apuntar a la misma cadena
 *                       (p.ej. las 4 caras de un mismo mueble → una sola frase).
 *
 * El tamaño de la tabla de punteros se deduce del puntero mínimo: el pool de
 * strings empieza justo donde acaba la tabla, así que `min(punteros)` es el
 * offset del primer string y, dividido entre 2, el número de entradas.
 *
 * Las frases YA traen su artículo ("a chest", "an odd rug", "the Crown!"), así
 * que el comando sólo antepone el prefijo "Thou dost see " (DATA.OVL 0x752d = subcadena
 * DELIBERADA: la cadena es `\nThou dost see\n` desde 0x752c y la cita salta el `\n` — t#57).
 * Tiles sin descripción real llevan el marcador "x" en el fichero original.
 */

/**
 * Devuelve un array indexado por id de tile con la frase de LOOK2.DAT de cada
 * tile (0..N-1). Las cadenas se decodifican como latin1 (ASCII de 7 bits en la
 * práctica).
 */
export function parseLook2(bytes: Uint8Array): string[] {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);

  // El pool de strings arranca en el puntero mínimo; la tabla ocupa todo lo
  // anterior. Recorremos punteros hasta alcanzar ese límite.
  let poolStart = bytes.byteLength;
  // Primera pasada: hallar el offset más bajo mirando pares consecutivos hasta
  // que el índice alcanza el pool.
  for (let i = 0; i * 2 < poolStart; i++) {
    const ptr = view.getUint16(i * 2, true);
    if (ptr < poolStart) poolStart = ptr;
  }

  const count = poolStart >> 1;
  const readString = (off: number): string => {
    let end = off;
    while (end < bytes.byteLength && bytes[end] !== 0) end++;
    let s = "";
    for (let i = off; i < end; i++) s += String.fromCharCode(bytes[i]!);
    return s;
  };

  const out: string[] = new Array(count);
  for (let i = 0; i < count; i++) {
    out[i] = readString(view.getUint16(i * 2, true));
  }
  return out;
}
