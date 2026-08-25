/**
 * CONTORNO-TRANSPARENCIA (piel shader) — CABLEO REAL de la familia FUENTE (0xd8–0xdb).
 *
 * Aclaración del usuario: la «transparencia» NO es translucidez parcial del cuerpo. Es
 * SUSTITUIR LOS PÍXELES NEGROS DEL CONTORNO por transparencia — los negros EXTERIORES
 * (conectados al borde de la celda = fondo del sprite) se vuelven transparentes y dejan ver
 * el terreno de debajo; los negros INTERNOS del dibujo (detalle encerrado en la silueta) SE
 * QUEDAN NEGROS. El algoritmo es el flood-fill exterior de `actor-transparency.ts`
 * (`exteriorBgMask`); esta capa lo aplica al TERRENO —la fiel lo hornea sin hook por-tile—
 * sintetizando el suelo de debajo (`dominantFloorNeighbor`) antes de blitear el recorte.
 *
 * POLARIDAD: default **ON** (aprobado). `?contourTransp=off` es el KILL-SWITCH de QA que
 * revierte a byte-idéntico (fuente horneada con su fondo negro). Se aplica ANTES del pase de
 * niebla. Alcance: SOLO la familia fuente — los actores (wisp/fantasmas) y otros tiles
 * (fields) los trata el carril `transp-wire` (alpha de cuerpo), no esta capa. La moongate
 * NO la trata NADIE desde el 22-07-2026 (veredicto del usuario): va opaca.
 */

// El predicado de suelo-vs-pared necesita TileData (passability); las pieles NO pueden leer
// el core en runtime (guard de costuras, Regla B), así que vive en `render/` (Regla C) y aquí
// sólo se importa y re-exporta para los consumidores/tests de esta capa.
export { isFloorUnderlayCandidate } from "../../render/floor-underlay.js";
import { isFloorUnderlayCandidate } from "../../render/floor-underlay.js";

/**
 * Fuegos que NO se recortan porque su FONDO REAL ya viene horneado en el gráfico (principio
 * del usuario: «el fondo sintetizado debe ser lo que REALMENTE hay detrás»). NO se recortan —
 * conservan su celda ENTERA horneada (como antes de contour-transp); su titileo fn32 lo sigue
 * aportando la fiel. Dos sub-familias:
 *  · MONTADOS EN PARED: sconces izq/dcha (0xb0/0xb1) y chimenea/hogar (0xbc, familia del
 *    hogar) + cocina (0xbf CookStove, empotrada contra pared). Testigo del usuario: el recorte
 *    les pintaba SUELO de ladrillo detrás cuando lo correcto es el MURO.
 *  · SOBRE MOBILIARIO: 0xbe CandleOnTable — su fondo real es la MESA, ya horneada en el tile;
 *    recortarla pintaría suelo bajo la vela (veredicto del lead).
 * Los fuegos de SUELO (brasero 0xb2, hoguera 0xb3, farola 0xbd, llama azul 0xde) SÍ se
 * recortan sobre suelo sintetizado (su fondo real es el suelo, que no viene en el gráfico).
 */
const WALL_MOUNTED_FIRE_TILES: ReadonlySet<number> = new Set([
  0xb0, // RightSconce (pared)
  0xb1, // LeftSconce (pared)
  0xbc, // Fireplace / hogar (pared)
  0xbe, // CandleOnTable (fondo = mesa horneada)
  0xbf, // CookStove (empotrada contra pared)
]);

/** ¿Es un fuego que NO se recorta (fondo real ya horneado: pared o mobiliario)? */
export function isWallMountedFire(tile: number): boolean {
  return WALL_MOUNTED_FIRE_TILES.has(tile);
}

/** Parser puro del gate (testeable sin `location`). Default ON; sólo `off` lo apaga. */
export function parseContourTransp(search: string): boolean {
  try {
    return new URLSearchParams(search).get("contourTransp") !== "off";
  } catch {
    return true;
  }
}

/** ¿Está activo el contorno-transparencia esta sesión? (default ON, kill-switch `=off`). Cacheado. */
let cached: boolean | null = null;
export function contourTranspEnabled(): boolean {
  if (cached !== null) return cached;
  cached = parseContourTransp(globalThis.location?.search ?? "");
  return cached;
}

/** ¿Es un tile de FUENTE (0xd8–0xdb, las 4 fases de la animación)? */
export function isFountainTile(tile: number): boolean {
  return tile >= 0 && tile < 0x100 && (tile & 0xfc) === 0xd8;
}

/** Vecino de suelo dominante bajo una celda: tile + su celda fuente (para copiar píxeles). */
export interface FloorNeighbor {
  readonly tile: number;
  readonly row: number;
  readonly col: number;
}

/** Desplazamientos ortogonales (N,S,O,E). */
const ORTHO: readonly (readonly [number, number])[] = [
  [-1, 0],
  [1, 0],
  [0, -1],
  [0, 1],
];

/**
 * SUELO DOMINANTE bajo una celda (helper reutilizable — lo consume la fuente aquí y lo
 * reusará `transp-wire` para el underlay de fields). Un tile «recortable» (fuente,
 * campo, moongate) NO lleva su suelo en `terrainWindow`: la celda muestra el tile, no el
 * suelo. Se infiere del entorno: de los 4 vecinos ORTOGONALES, el tile que MÁS aparece
 * («de los colindantes el que más aparezca», ruling del usuario), ignorando los que `skip`
 * marca (p. ej. otras fuentes) Y los que NO son suelo (`isFloorUnderlayCandidate`: muros,
 * puertas, ventanas — «nunca hay nada con fondo de pared», ruling del usuario). Devuelve ese
 * tile y UNA celda fuente suya (row,col) para copiar sus píxeles YA renderizados
 * (xBR-exactos), o `null` si no hay vecino utilizable (celda aislada / rodeada de pared → el
 * llamante deja el tile intacto, nunca pinta pared ni negro a ciegas).
 *
 * `tw` es la ventana de terreno row-major de lado `n` (11). Empate → gana el primero visto
 * en orden N,S,O,E (determinista). OJO: la mayoría es entre SUELOS: 3 paredes + 1 suelo →
 * gana el suelo aunque las paredes sean más (las paredes ni cuentan).
 */
export function dominantFloorNeighbor(
  tw: Int16Array,
  n: number,
  row: number,
  col: number,
  skip: (tile: number) => boolean,
): FloorNeighbor | null {
  const counts = new Map<number, number>();
  let best: FloorNeighbor | null = null;
  let bestN = 0;
  for (const [dr, dc] of ORTHO) {
    const r = row + dr;
    const c = col + dc;
    if (r < 0 || r >= n || c < 0 || c >= n) continue;
    const t = tw[r * n + c] ?? -1;
    if (t < 0 || skip(t) || !isFloorUnderlayCandidate(t)) continue;
    const k = (counts.get(t) ?? 0) + 1;
    counts.set(t, k);
    if (k > bestN) {
      bestN = k;
      best = { tile: t, row: r, col: c };
    }
  }
  return best;
}

/**
 * SUELO **DECLARADO** bajo una celda: busca en los 4 ortogonales una celda cuyo tile sea
 * EXACTAMENTE `wanted` (el `flatTileSubstitution` que los datos del original declaran detrás
 * de ese mobiliario) y devuelve UNA suya para copiar sus píxeles ya renderizados. `null` si
 * ninguno lo es — y entonces el llamante deja la celda INTACTA, sin recortar.
 *
 * Por qué esto y no `dominantFloorNeighbor` para el MOBILIARIO (medido el 12-08-2026 sobre las
 * 923 celdas de la clase en los 32 mapas pequeños): en **128** el vecino dominante NO es el
 * suelo declarado, y lo que domina son **SILLAS** (87) y **ESCALERAS** (3) — tiles caminables,
 * y por tanto candidatos legítimos para `isFloorUnderlayCandidate`, cuyos píxeles pintarían una
 * silla fantasma debajo de la mesa. Exigir el suelo declarado corta ese caso de raíz: **770 de
 * 923 celdas (83,4%)** tienen el suelo declarado al lado y se recortan; las **153** restantes se
 * quedan exactamente como hoy (horneadas), que es el mismo conservadurismo del «emisor aislado».
 * Los **12 fuelles de las 11 herrerías** están las 12 en el grupo bueno.
 *
 * La FUENTE y los FUEGOS siguen con `dominantFloorNeighbor`: sus veredictos se firmaron sobre
 * capturas con esa regla y no se tocan desde aquí.
 */
export function declaredFloorNeighbor(
  tw: Int16Array,
  n: number,
  row: number,
  col: number,
  wanted: number,
): FloorNeighbor | null {
  for (const [dr, dc] of ORTHO) {
    const r = row + dr;
    const c = col + dc;
    if (r < 0 || r >= n || c < 0 || c >= n) continue;
    if ((tw[r * n + c] ?? -1) !== wanted) continue;
    return { tile: wanted, row: r, col: c };
  }
  return null;
}
