/**
 * tile → color 0xRRGGBB por FAMILIA de tile (heurística por nombre). Era el
 * pintor del minimapa QoL (retirado 26-07: el original solo enseña mapa vía
 * (V)iew con gema); lo reutilizan el volcado de mapas del drawer QA
 * (`debug/teleportMap`) y el minimapa de las tarjetas de `/byo`.
 *
 * 🔴 VIVÍA EN `debug/` Y SU CABECERA DECÍA «Solo DEV». Las dos cosas dejaron de ser
 * ciertas al usarlo la landing pública, así que se mueve y se corrige a la vez: un
 * fichero de producción bajo `debug/` invita a que alguien lo pode creyendo que sobra,
 * y una cabecera que promete «solo DEV» sobre código que se sirve a todo el mundo es
 * texto rancio del que siembra — más peligroso por estar en el sitio donde se mira.
 *
 * ⚠️ ARRASTRA `core/tiles.js` → `core/data/TileData.json`, que son **458 KB** (medido).
 * Quien lo importe desde una página web tiene que hacerlo con `import()` DINÁMICO o
 * multiplicará por seis el bundle de arranque. La tabla es de Ultima5Redux (MIT), no
 * de EA: ver `core/data/ATTRIBUTION.txt`.
 */
import { TILE_INFO } from "./tiles.js";

export type TileColorFn = (tile: number) => number;

export function defaultTileColor(tile: number): number {
  const info = TILE_INFO[tile];
  if (!info) return 0x101010;
  const name = info.name.toLowerCase();

  if (name.includes("water") || name.includes("waterfall") || name.includes("ocean")) {
    return 0x1a4a8a;
  }
  if (name.includes("lava")) return 0xb1420f;
  if (name.includes("mountain")) return 0x6f6f6f;
  if (name.includes("hills")) return 0x7a8a3a;
  if (name.includes("forest") || name.includes("tree")) return 0x1f5c1f;
  if (name.includes("swamp")) return 0x4d5a2a;
  if (name.includes("desert") || name.includes("sand")) return 0xc2a865;
  if (
    name.includes("castle") ||
    name.includes("keep") ||
    name.includes("village") ||
    name.includes("town") ||
    name.includes("towne")
  ) {
    return 0xd4af37;
  }
  // 🔴 «WALL» SE MIRA ANTES QUE «BRICK»/«FLOOR», y esto lo destapó pintar INTERIORES (#112).
  // Esta tabla nació para el SOBREMUNDO, donde no hay paredes; al usarla en un plano de
  // 32×32 el orden de las reglas dejó de ser inocuo: `StoneBrickWall`, `StoneBrickWallSecret`
  // y `BrickWallArchway` casaban por «brick» y salían del MISMO color que `BrickFloor`, así
  // que el muro y el suelo eran la misma mancha y el plano no enseñaba las habitaciones — que
  // es justo lo único que un plano tiene que enseñar.
  // MEDIDO sobre `maps/smallmaps.json`: pasaba en **51 de las 64 plantas**, con 7926 celdas de
  // muro fundidas contra 12 529 de suelo real. No es un caso raro: es la mayoría del corpus.
  // Van al gris que YA usan `SmallRockWall` y `LargeRockWall` — la tabla ya tenía decidido de
  // qué color es una pared; lo que fallaba era llegar a esa línea.
  if (name.includes("wall")) return 0x444444;
  if (name.includes("bridge") || name.includes("path") || name.includes("brick") || name.includes("floor")) {
    return 0xa98b5d;
  }
  if (name.includes("grass")) return 0x2e7d32;
  if (info.walkable) return 0x2e7d32;
  return 0x444444;
}
