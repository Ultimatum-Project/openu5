/**
 * MOBILIARIO DE INTERIOR recortable — mesas, barriles, cómodas, el reloj, el reloj de arena y
 * el FUELLE de la herrería (0xfc/0xfd). Capa de VISTA pura: `render/` puede leer `core/tiles`
 * (Regla C del guard de costuras); las pieles lo importan desde aquí, como `floor-underlay.ts`.
 *
 * PARA QUÉ: la piel fiel hornea estos tiles con su fondo negro exterior OPACO, así que el
 * mobiliario se recorta contra un cuadrado negro en vez de asentarse sobre el suelo. El
 * tratamiento contorno-transparencia (`skin/shader/contour-transp.ts`) ya lo arregla para la
 * FUENTE y los fuegos de suelo; esta clase lo extiende al mobiliario. Reporte del usuario del
 * 12-08-2026 sobre el fuelle de la herrería (ficha #196).
 *
 * EL SUELO DE DEBAJO LO DECLARAN LOS DATOS, no se infiere. `TileData.json` trae
 * `FlatTileSubstitutionIndex`/`Name` por tile («qué hay debajo si quitas esto»): el fuelle
 * declara `68 BrickFloor`. Ese campo no tenía NINGÚN lector antes de esta ficha.
 *
 * 🔴 LOS DOS CAMPOS DE SUSTITUCIÓN NO SON INTERCAMBIABLES — medido el 12-08-2026 sobre el
 * `TileData.json` vendorizado: discrepan en 33 filas y las poblaciones son 155 (índice ≥ 0) vs
 * 391 (nombre ≠ None). Y ninguno domina: en los BARCOS (0x120-0x12f) el índice dice `5 Grass` y
 * el nombre `Water` — manda el nombre; en `WheatInField 0x2d` el índice dice `44 PlowedField`
 * y el nombre `None` — manda el índice. (De paso: la cifra «64 caminables» del censo que
 * refutó el instrumento ancho de #197 está medida sobre el campo NOMBRE; con el ÍNDICE habrían
 * salido 43. Quien repita ese censo tiene que decir con qué campo.)
 *
 * Por eso el predicado exige que los DOS CONCUERDEN — pero se declara lo que esa condición
 * hace HOY: **separa CERO tiles del banco bajo** (medido: ninguno es interior por un campo y no
 * por el otro). Es un CIERRE ANTE CAMBIOS del vendor, no un freno vivo; el peso lo llevan
 * `walkable` y la lista de nombres de suelo. La guarda cuenta ese cero explícitamente, así que
 * el día que empiece a separar algo se enterará alguien en vez de pasar en silencio.
 *
 * ACOTACIÓN — cinco condiciones, todas con trabajo que hacer (censadas sobre los datos):
 *  · **banco bajo** (`< 0x100`): los ≥0x100 son sprites de ACTOR (sillas-comiendo, espejo de
 *    LB, prisionero de pared) que no pasan por la capa de terreno.
 *  · **suelo declarado de INTERIOR** (`BrickFloor`/`MetalFloor`): deja fuera bosque, cactus,
 *    lápidas, vallas, carteles y los barcos — todo lo que declara Grass/Desert/Water/Hills.
 *  · **NO caminable**: deja fuera sillas, camas, alfombra, el hogar y el arco de muralla, que
 *    se PISAN y cuyo recorte no se quiere (la clase «paso de mampostería» es la de #197).
 *  · **`upright`**: se alza sobre el suelo. Hoy no separa nada por sí sola (0 tiles), y va
 *    declarado como tal — es la condición de SIGNIFICADO, el peso lo lleva `walkable`.
 *  · **no-fuego y no-rastrillo**: los fuegos ya tienen su vía (contorno + titileo fn32, con su
 *    lista de no-recortables `isWallMountedFire`); el `Portcullis 0x99` es herraje de MURO —
 *    cuelga en el vano, no se apoya en el suelo — y cae por el mismo «nunca fondo de pared»
 *    de `docs/verdicts/transp-wave2/README.md` que dejó fuera a los sconces y al hogar.
 *
 * Población resultante: **23 tiles** (`game/tests/contour-transp.test.ts` la re-deriva por
 * corrida y se pone roja si cambia).
 *
 * 🔴 NO CONFUNDIR CON EL SHADOWLORD: `0xFC` en la capa de OBJETOS/MÓVILES es Faulinei (ficha
 * #195, arreglada el 12-08). Esta clase se consulta SÓLO sobre `terrainWindow`, la capa de
 * terreno, así que no puede alcanzar al actor.
 */
import { TILE_INFO } from "../core/tiles.js";

/** Suelos de INTERIOR, por nombre del tile de sustitución. */
const INTERIOR_FLOOR_NAMES: ReadonlySet<string> = new Set(["BrickFloor", "MetalFloor"]);

/** Fuegos con vía propia (contorno + fn32): no entran en esta clase. Espejo de `FIRE_MASKS`. */
const FIRE_TILES: ReadonlySet<number> = new Set([
  0xb0, 0xb1, 0xb2, 0xb3, 0xbc, 0xbd, 0xbe, 0xbf, 0xde,
]);

/** Herrajes de MURO por nombre: cuelgan del vano, no se apoyan en el suelo. */
const WALL_HARDWARE_NAMES: ReadonlySet<string> = new Set(["Portcullis"]);

/** Deriva la clase y, por miembro, el ID del suelo que los datos declaran detrás. */
function deriveFurniture(): ReadonlyMap<number, number> {
  const out = new Map<number, number>();
  TILE_INFO.forEach((info, id) => {
    if (!info || id >= 0x100) return;
    const floorId = info.flatTileSubstitutionIndex;
    if (floorId < 0) return;
    const target = TILE_INFO[floorId];
    // Los DOS campos tienen que concordar (ver cabecera): índice→nombre === nombre declarado.
    if (!target || target.name !== info.flatTileSubstitutionName) return;
    if (!INTERIOR_FLOOR_NAMES.has(target.name)) return;
    if (info.walkable || !info.upright) return;
    if (info.openable) return; // puertas: su fondo es el marco, no el suelo
    if (FIRE_TILES.has(id) || WALL_HARDWARE_NAMES.has(info.name)) return;
    out.set(id, floorId);
  });
  return out;
}

/** Tile de mobiliario → tile de SUELO que los datos declaran debajo. 23 entradas. */
export const INTERIOR_FURNITURE_FLOOR: ReadonlyMap<number, number> = deriveFurniture();

/** ¿Es mobiliario de interior recortable? */
export function isInteriorFurniture(tile: number): boolean {
  return INTERIOR_FURNITURE_FLOOR.has(tile);
}

/** Suelo DECLARADO bajo un tile de mobiliario, o `-1` si no es de la clase. */
export function declaredFloorUnder(tile: number): number {
  return INTERIOR_FURNITURE_FLOOR.get(tile) ?? -1;
}
