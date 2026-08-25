/**
 * "THE SUMMONING" — el CUARTO top-down del attract (task #19). El demo autónomo de
 * la portada (video-P f061–f093) NO es una lámina STORY.16: es un CUARTO de tiles
 * (muros de ladrillo de piedra + suelo de ladrillo rojo, mobiliario, un MOONGATE que
 * se abre en el centro) renderizado DENTRO del panel azul, rotulado "The Summoning".
 * El original lo pinta el motor de escena (mapa top-down con cámara propia); el mapa
 * exacto es **Clase C** (no hay una "escena de attract" extraída del binario). Aquí
 * se CALCA del witness (`video-P` f070, régimen ya usado en la escena de acampada):
 * estructura de muros/suelo DERIVADA por emparejamiento de tiles contra el atlas, y
 * el mobiliario colocado a nivel de rasgo desde el frame. Módulo PURO (datos +
 * geometría del revelado/ciclo); el blit de tiles vive en `ui/faithful-intro.ts`.
 *
 * Reveladо (f061→f070): el moongate aparece en el centro y el cuarto se descubre por
 * una CORTINA horizontal que se abre simétrica desde ese eje (mismo mecanismo que el
 * pergamino de Acknowledgements). Timings de `video-P` (2 fps).
 */

/** Rejilla del cuarto: 20 columnas × 5 filas de tile (16 px) = 320×80, recortada al panel. */
export const ROOM_COLS = 20;
export const ROOM_ROWS = 5;

/** Tiles base (TileData.json): muro de ladrillo de piedra gris / suelo de ladrillo rojo. */
export const WALL_TILE = 79; // StoneBrickWall
export const FLOOR_TILE = 68; // BrickFloor
/** Moongate (animado por su propio ciclo en el atlas); se abre en el centro del cuarto. */
const ROOM_MOONGATE_TILE = 220;

/**
 * Base del cuarto: MURO en el perímetro (fila 0, laterales, fila inferior), SUELO en
 * el interior. Derivado del emparejamiento de tiles de f070 (perímetro gris = 79,
 * interior rojo = 68). `(col,row)` en la rejilla ROOM_COLS×ROOM_ROWS.
 */
export function roomBaseTile(col: number, row: number): number {
  if (row === 0 || row === ROOM_ROWS - 1 || col === 0 || col === ROOM_COLS - 1) return WALL_TILE;
  return FLOOR_TILE;
}

/** Una pieza de mobiliario/decorado sobre el suelo, en coord de rejilla. */
export interface RoomOverlay {
  col: number;
  row: number;
  tile: number;
}

/**
 * Mobiliario del cuarto, CALCADO de `video-P` f070 a nivel de rasgo (posiciones y
 * piezas legibles del frame; geometría fina = Clase C declarada). Nombres de tile de
 * TileData.json. Se pintan SOBRE el suelo (como en el juego: tile de mueble con fondo
 * transparente encima del suelo). El moongate NO va aquí — lo coloca el controlador en
 * el centro para animar su apertura.
 */
export const ROOM_OVERLAYS: readonly RoomOverlay[] = [
  // Arcos de madera en el muro (superior centro-izq y lateral derecho): BrickWallArchway.
  { col: 10, row: 0, tile: 135 },
  { col: 14, row: 2, tile: 135 },
  // Fila central-derecha: espejo + cómoda + estantería (mirror / dresser-endtable / shelf).
  { col: 9, row: 1, tile: 157 }, // Mirror
  { col: 10, row: 1, tile: 165 }, // EndTable (cómoda cian)
  { col: 12, row: 1, tile: 141 }, // Harpsichord (pieza ancha de la estantería/instrumento)
  // Zona izquierda: mesa + silla.
  { col: 3, row: 1, tile: 149 }, // TableMiddle
  { col: 4, row: 1, tile: 147 }, // ChairBackRight
  // Cama abajo-izquierda (dos tiles) + planta abajo-centro.
  { col: 2, row: 3, tile: 171 }, // LeftBed
  { col: 3, row: 3, tile: 172 }, // RightBed
  { col: 12, row: 3, tile: 91 }, // Plant
  // Cofre a la derecha.
  { col: 17, row: 1, tile: 257 }, // Chest
];

/** Columna central del cuarto (donde se abre el moongate). */
export const ROOM_MOONGATE_COL = Math.floor(ROOM_COLS / 2); // 10
export const ROOM_MOONGATE_ROW = 2;

/**
 * Fases del attract "The Summoning" (video-P): el moongate aparece y el cuarto se
 * descubre por una cortina que se abre desde el centro (`reveal`), se mantiene el
 * cuarto completo (`hold`) y se vuelve al menú. Cadencias medidas de `video-P` (2 fps).
 */
export const SUMMONING_TIMINGS = {
  /** Apertura de la cortina (f061→f070 ≈ 4.5 s a partir de la aparición del moongate). */
  revealMs: 4500,
  /** Cuarto completo en pantalla antes de pasar al menú (f070→f093 ≈ 11 s). */
  holdMs: 9000,
  /**
   * Idle en el MENÚ antes de relanzar el demo (inyecta 'R' → attract). DERIVADO del
   * contador del `intro_main_controller`: el bucle de espera cuenta **200 ticks**
   * (INTRO.OVL `0d87 cmp si,0xc8`; al agotarse dispara 'R' → demo, `intro-demo-scene.md`
   * §"200 ticks") a la cadencia del tick de sonido/escena de la intro (~55 ms,
   * `DEMO_AMBIENT_MS`) → 200·55 = 11000 ms. Antes 12000 puesto a mano sin cita.
   */
  menuIdleMs: 11000,
} as const;

/**
 * Media anchura (px) descubierta de la cortina a progreso `t∈[0,1]` sobre un ancho
 * total `fullW` (mecanismo del pergamino de Acknowledgements: la región visible crece
 * simétrica desde el centro). En `t=0` sólo asoma la columna central del moongate
 * (`seedPx`); en `t=1` la cortina cubre todo el ancho. Puro y monótono.
 */
export function curtainHalfWidth(t: number, fullW: number, seedPx = 8): number {
  const c = Math.max(0, Math.min(1, t));
  return Math.round(seedPx + c * (fullW / 2 - seedPx));
}

/** Estado del ciclo de attract (fase interna + progreso). */
export type SummoningStage = "reveal" | "hold";

/**
 * Paso PURO del ciclo del demo: dado el ms transcurrido en la fase actual, decide si
 * avanza de `reveal`→`hold` o si el `hold` terminó (→ volver al menú). Devuelve la
 * fase resultante, el progreso `t` de la cortina [0,1] y si el demo ha CONCLUIDO.
 */
export function summoningStep(
  stage: SummoningStage,
  elapsedMs: number,
): { stage: SummoningStage; t: number; done: boolean } {
  if (stage === "reveal") {
    const t = Math.min(1, elapsedMs / SUMMONING_TIMINGS.revealMs);
    if (t >= 1) return { stage: "hold", t: 1, done: false };
    return { stage: "reveal", t, done: false };
  }
  // hold
  return { stage: "hold", t: 1, done: elapsedMs >= SUMMONING_TIMINGS.holdMs };
}
