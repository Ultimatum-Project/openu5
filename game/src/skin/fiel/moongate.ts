/**
 * Animación de la moongate (subida/bajada), piel fiel.
 *
 * DERIVADO del binario DOS (ULTIMA.EXE), no a ojo:
 * - `g_moongate_anim` (DS 0x5887) es un contador COSMÉTICO 0..16 (cap 0x10), NO
 *   una fase lunar y NO la tabla de tiles animados: es un contador propio que el
 *   compositor sube/baja. No toca advance_clock ni RNG (re/notes/shrines.md §1.3).
 * - `kernel_moongate_render` 0x475a: de NOCHE `anim++` (cap 0x10, inc-con-cap
 *   0x3ef0 @0x4775); de DÍA `anim--`, y al llegar a 0 el tile pasa a hierba
 *   (@0x4786-0x4798). El tile compuesto es binario: 0xDC (puerta) / 5 (hierba).
 * - Las ETAPAS visibles están en el bucle de blit 0x56e6-0x5709: si el tile es
 *   0xDC y `anim` ∈ 1..15 → blit PARCIAL `0x1112(anim,x,y)` (puerta creciendo);
 *   si `anim` == 0 o ≥ 0x10 → blit lleno `0x10e0`. O sea 16 etapas: 1..15 =
 *   puerta emergiendo/menguando, 16 = puerta llena.
 * - La geometría exacta del recorte parcial vive en el driver gráfico (fn 0x60),
 *   fuera del disasm; los testigos fijan la FORMA (Clase C — por vídeo): franja en
 *   la parte BAJA de la celda (vídeo K: la puerta sale del suelo) y recorte de las
 *   filas SUPERIORES del tile (moongate-animacion-viaje.mov, zoom del cierre
 *   f069-f078: el borde alto de la puerta — fila azul oscuro + hairline cyan —
 *   visible en todas las etapas; la puerta sube/baja ENTERA enseñando su parte alta).
 * - La CADENCIA (1 paso por pase del compositor) no es derivable del asm →
 *   la piel la corre con su propio reloj (contrato coreview: "la piel lo anima con
 *   su reloj; el core no sabe cadencias"). Sin impacto en parity.
 */

/** Tile de la moongate en el atlas (0xDC). */
export const MOONGATE_TILE = 220;

/** Etapas del contador `g_moongate_anim` (cap 0x10). 0 = ausente, 16 = llena. */
export const MOONGATE_STAGES = 16;

/**
 * ms por etapa cuando la piel corre la animación de AMBIENTE (aparición/ocaso de
 * las puertas al anochecer/amanecer) a reloj de PARED (rAF). El original avanza 1
 * etapa por pase del compositor; la cadencia exacta no es derivable (Clase C) →
 * ~0.5s de subida/bajada (16·32 ms) casa con el vídeo K, recalibrable sin tocar
 * la mecánica.
 */
export const MOONGATE_STAGE_MS = 32;

/**
 * ms por etapa del CIERRE scripted del CRUCE (kernel_moongate_enter 0x48a8). El
 * ÚNICO bucle de animación del cruce es 0x4912-0x492b y es DESCENDENTE: blit
 * parcial `0x1112(anim,5,5)` + `delay(2)` (0x20fa) + `dec [0x5887]` → etapas
 * 15→1 sobre el ORIGEN (la puerta se hunde sobre el jugador ya disuelto). NO
 * existe un segundo bucle de llegada: el cierre deja `g_moongate_anim`=0 y al
 * re-dibujar el DESTINO es el compositor de ambiente (`kernel_moongate_render`
 * 0x475a, `anim++` de noche @0x4775) quien SUBE las puertas 0→16 — la piel lo
 * calca reseteando su etapa de ambiente a 0 al terminar el cruce. Cadencia del
 * cierre: testigo `moongate-animacion-viaje.mov` (cierres f040-f045 y f069-f078
 * ≈ 15 etapas en 0.6-0.9 s) → ~60 ms/etapa. Clase C (la duración del `delay(2)`
 * no es derivable byte-exacta), recalibrable sin tocar la mecánica.
 */
export const MOONGATE_TRANSIT_STAGE_MS = 60;

/**
 * ms que la puerta se sostiene LLENA sobre el jugador en el ORIGEN antes de que
 * arranque el cierre 15→1. En el original ese hueco lo llenan el barrido de
 * activación (0x2192 @0x48e5), la disolución LFSR del jugador bajo la puerta
 * (fx_tile_fizzle_in 0x1068 @0x48fe) y el beep 0x3ae6(1) @0x490a — todos ANTES del
 * bucle. Testigo: puerta llena f034-f039 / f063-f068 ≈ 0.6-0.7 s. Clase C
 * (duraciones de sonido/wipe no derivables byte-exactas); la disolución LFSR
 * por-celda se modela como aparición directa + hold (a 10 fps del testigo la
 * materialización cabe entre dos frames).
 */
export const MOONGATE_DEPART_HOLD_MS = 650;

/**
 * Avanza una etapa (0..MOONGATE_STAGES) UN paso hacia abierta (present=true, la
 * puerta sube) o cerrada (present=false, la puerta baja), con clamp. Réplica del
 * `anim++`/`anim--` por pase del compositor (0x4775 / 0x4786). Puro y testeable.
 */
export function stepMoongateStage(prev: number, present: boolean): number {
  if (present) return Math.min(MOONGATE_STAGES, prev + 1);
  return Math.max(0, prev - 1);
}

/**
 * Realización a reloj de PARED de `stepMoongateStage`: avanza la etapa (float
 * 0..16) hacia abierta (present) o cerrada (!present) proporcional a `dtMs`,
 * con clamp. La usa el bucle rAF de la piel para una subida/bajada suave.
 * `stageMs` = ms por etapa (ambiente por defecto; el cruce usa
 * `MOONGATE_TRANSIT_STAGE_MS`, más pausado).
 */
export function advanceMoongateStageMs(
  stage: number,
  present: boolean,
  dtMs: number,
  stageMs: number = MOONGATE_STAGE_MS,
): number {
  // TICKET #18 — knob de escenas a 0: `stageMs <= 0` significa «sin espera de reloj»,
  // así que la etapa SALTA a su destino en un frame. Sin este corte, `dtMs / 0` da
  // Infinity (y `0 / 0` da NaN, que el clamp NO arregla: `Math.min(16, NaN)` es NaN y
  // envenenaría la etapa para siempre).
  if (stageMs <= 0) return present ? MOONGATE_STAGES : 0;
  const delta = dtMs / stageMs;
  const next = present ? stage + delta : stage - delta;
  return Math.max(0, Math.min(MOONGATE_STAGES, next));
}

/**
 * Rectángulo de revelación (anclado abajo) de una moongate en su etapa, dentro de
 * una celda de `tilePx` px. Devuelve el desplazamiento Y y la altura visibles: la
 * puerta ocupa la franja INFERIOR `[offY, offY+h)` — sale del suelo (vídeo K).
 *
 * ⚠ La franja de DESTINO va abajo, pero el recorte de ORIGEN del sprite son las
 * `h` filas SUPERIORES del tile 0xdc: el testigo (`moongate-animacion-viaje.mov`,
 * zoom del cierre f069-f078) muestra el BORDE SUPERIOR de la puerta (fila azul
 * oscuro + hairline cyan, filas 0-1 del tile — el cuerpo no tiene borde inferior)
 * visible en cada etapa: la puerta se hunde/asoma ENTERA y siempre se le ve la
 * parte alta, no se recorta por abajo. Puro.
 * - etapa ≤ 0        → h = 0 (nada).
 * - etapa ≥ 16       → h = tilePx (llena).
 * - etapa intermedia → h proporcional.
 */
export function moongateRevealRect(
  stage: number,
  tilePx: number,
): { offY: number; h: number } {
  const clamped = Math.max(0, Math.min(MOONGATE_STAGES, stage));
  const h = Math.round((clamped / MOONGATE_STAGES) * tilePx);
  return { offY: tilePx - h, h };
}
