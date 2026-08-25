/**
 * Parser del mapa grande (overworld 256×256) de Ultima V: BRIT.DAT y UNDER.DAT.
 *
 * El mapa son 256 chunks de 16×16 tiles (1 byte/tile) en orden row-major
 * (chunk = row*16 + col). BRIT.DAT es DISPERSO: un índice de 256 bytes en
 * DATA.OVL offset 0x3886 marca con 0xFF los chunks que son íntegramente agua
 * (tile 0x01) y NO están presentes en el .DAT. Cualquier otro valor = chunk
 * presente = leer los siguientes 256 bytes secuenciales del .DAT.
 *
 * UNDER.DAT es DENSO: sin overlay, todos los chunks presentes (65536 bytes).
 *
 * Ver docs/formats/maps.md §1.
 */

const CHUNKS_PER_SIDE = 16;
const CHUNK_TILES = 16;
const MAP_SIZE = CHUNKS_PER_SIDE * CHUNK_TILES; // 256
const WATER_TILE = 0x01;

/**
 * Construye el overworld 256×256 indexado [y][x].
 *
 * @param dat    Bytes de BRIT.DAT (disperso) o UNDER.DAT (denso).
 * @param overlay Los 256 bytes de índice de chunks (DATA.OVL[0x3886..0x3985]).
 *                `null` para mapas densos como UNDER.DAT.
 */
export function parseLargeMap(
  dat: Uint8Array,
  overlay: Uint8Array | null,
): number[][] {
  const map: number[][] = Array.from({ length: MAP_SIZE }, () =>
    new Array<number>(MAP_SIZE).fill(WATER_TILE),
  );

  let srcIdx = 0;
  for (let chunk = 0; chunk < CHUNKS_PER_SIDE * CHUNKS_PER_SIDE; chunk++) {
    const col = chunk % CHUNKS_PER_SIDE;
    const row = chunk >> 4;
    const isWater = overlay !== null && overlay[chunk] === 0xff;

    for (let y = row * CHUNK_TILES; y < row * CHUNK_TILES + CHUNK_TILES; y++) {
      const rowArr = map[y]!;
      for (let x = col * CHUNK_TILES; x < col * CHUNK_TILES + CHUNK_TILES; x++) {
        rowArr[x] = isWater ? WATER_TILE : dat[srcIdx++]!;
      }
    }
  }

  return map;
}
