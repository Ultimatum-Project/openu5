/**
 * PASO ABIERTO EN MAMPOSTERÍA — las celdas de MURO por las que se CAMINA (arco de muralla,
 * entrada del castillo). Capa de VISTA pura: `render/` puede leer `core/tiles` (Regla C del
 * guard de costuras) — las pieles NO, por eso el predicado vive aquí y `skin/shader` lo
 * importa desde `render/`, igual que `floor-underlay.ts`.
 *
 * PARA QUÉ: la piel shader COMPONE los actores sobre el terreno recortándoles el fondo negro
 * (`actor-transparency.ts`, flood-fill exterior), así que el terreno de la celda asoma
 * alrededor de la silueta. El binario NO compone: es UN blit POR CELDA y el actor SUSTITUYE
 * al tile — `ULTIMA.EXE:0x56ac viewport_compose` (doble bucle 11×11; por celda, «si la capa de
 * actor tiene algo → dibuja el sprite de actor (`0x10e0`); EN OTRO CASO → mapea el tile por
 * `[tile-0x4ee2]` y lo dibuja», `re/notes/kernel-sweep-2.md` §3). Detrás del Avatar no hay
 * NADA que ver. Sobre suelo la diferencia no se nota; sobre un paso de mampostería sí: el
 * ladrillo del arco se cuela por el fondo del sprite y el Avatar se deshilacha contra el muro
 * (reporte del usuario en Paws, 12-08-2026).
 *
 * RULING: extensión a ACTORES del «nunca fondo de pared» de `docs/verdicts/transp-wave2/`
 * (§FIX del underlay compartido) — donde aquel prohibió SINTETIZAR pared bajo una decoración
 * recortada, éste prohíbe DEJAR VER la pared bajo un actor recortado. Decisión del lead
 * 12-08-2026 (ficha #197, opción a).
 *
 * 🔴 EL CONJUNTO SON DOS Y NO SE AMPLÍA. El instrumento obvio —«tile con
 * FlatTileSubstitution»— está MEDIDO Y REFUTADO: atrapa 64 tiles CAMINABLES (bosque, camas,
 * sillas, alfombra, BARCOS con sustitución Water, monturas, bocas de mazmorra) donde la
 * transparencia sí se quiere. La clase «paso abierto en mampostería caminable» tiene dos
 * miembros de verdad en los datos; no es un uno-a-uno disfrazado, es que la población es 2.
 * El rastrillo (`0x200 BrickWallArchwayWithPortcullis`) queda fuera por NO ser caminable:
 * nunca hay un actor encima. La PASABILIDAD no la toca este fichero (adjudicada FIEL:
 * `DATA.OVL` fileoff `0x54e4` deja 0x87 como el único caminable de la familia).
 *
 * DERIVACIÓN POR NOMBRE, no por número: los ids salen de `TILE_INFO` en runtime, así que un
 * re-vendorizado de `TileData.json` que mueva los índices no deja el predicado apuntando a
 * otro tile en silencio. `game/tests/contour-transp.test.ts` re-deriva la población por
 * corrida y se pone rojo si cambia.
 */
import { TILE_INFO } from "../core/tiles.js";

/**
 * Las dos FAMILIAS de nombre, tal como las escribe `TileData.json` (Clase-D vendorizado de
 * Ultima5Redux: `CastleBritianEntrace` lleva SU errata de origen — no se corrige aquí, es la
 * clave de búsqueda contra el dato real). Son PREFIJOS, no nombres exactos, y eso es
 * deliberado: `BrickWallArchway` tiene una variante `…WithPortcullis` (0x200) que la familia
 * SÍ recoge y a la que echa la condición `walkable` de abajo. Con match exacto la familia
 * daría dos y `walkable` no separaría nada — sería una condición decorativa (un mutante que
 * la borre sobreviviría, medido el 12-08-2026 antes de escribirlo así).
 */
export const MASONRY_PASSAGE_FAMILY: readonly string[] = [
  "BrickWallArchway", // 0x87 arco de muralla (el de Paws del reporte) · 0x200 con rastrillo
  "CastleBritianEntrace", // 0x3e entrada del castillo
];

/**
 * Familia por nombre ∩ CAMINABLE. Las dos condiciones cargan peso: la familia deja fuera todo
 * el resto del atlas; `walkable` deja fuera el rastrillo 0x200 — que es exactamente el ruling
 * («con rastrillo no es caminable, nunca hay actor encima»), no una cautela genérica.
 */
function derivePassageTiles(): ReadonlySet<number> {
  const out = new Set<number>();
  TILE_INFO.forEach((info, id) => {
    if (!info || !info.walkable) return;
    if (!MASONRY_PASSAGE_FAMILY.some((f) => info.name.startsWith(f))) return;
    out.add(id);
  });
  return out;
}

/** Población derivada esta corrida (la guarda la carea contra los nombres declarados). */
export const MASONRY_PASSAGE_TILES: ReadonlySet<number> = derivePassageTiles();

/** ¿Es una celda de paso abierto en mampostería (⇒ el actor encima se blitea OPACO)? */
export function isMasonryPassage(tile: number): boolean {
  return MASONRY_PASSAGE_TILES.has(tile);
}
