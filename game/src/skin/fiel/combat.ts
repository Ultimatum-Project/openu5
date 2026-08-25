/**
 * PIEL FIEL — OVERLAYS DE COMBATE (E1-S12).
 *
 * La ARENA (terreno + combatientes) YA la pinta el viewport 11×11 del snapshot
 * (`window`), igual que el mundo: en combate `activeMap` ES la arena y las
 * entidades se componen encima (regla dura #2, censura en el core). Este módulo
 * añade SÓLO lo que el tile-buffer no porta y el original dibuja por encima:
 *
 *   1. RECUADRO DEL ACTIVO (spec §1) — un marco sobre la celda del combatiente
 *      cuyo turno es. En el original es "por turno" (no un tick de anim): al
 *      llegar el turno se ilumina al activo. El PARPADEO/cadencia = Clase C (#26):
 *      aquí parpadea con el reloj F-A (fase par) como el cursor de consola.
 *   2. RETÍCULA DE APUNTADO (spec §7) — mientras el jugador elige objetivo
 *      (comando A / hechizo): resalta las celdas legales y el cursor.
 *   3. EFECTOS EFÍMEROS (spec §2/§3) — proyectil en vuelo y flash de impacto,
 *      empujados por el bus `onCombatFx` y animados con reloj de pared. Su
 *      cadencia/px-por-frame/duración son Clase C (#26): valores plausibles aquí.
 *
 * Todo overlay es geometría vectorial (rects) sobre el viewport EGA; no depende
 * del atlas. Colores plausibles acotados por el marco — Clase C, a calibrar en
 * píxel-diff (#26). `paintCombatOverlays` es PURO (snapshot+fase → dibujo);
 * `CombatFxLayer` es el único con estado (los fx vivos y su tiempo de arranque).
 */
import { VIEWPORT } from "./frame.js";
import type { CombatFx, CombatView } from "../api.js";

const TILE = VIEWPORT.tile;
const ARENA_PX = VIEWPORT.tiles * TILE;

// ── Colores (Clase C → #26; CALIBRADOS contra video-J, 2026-07-15) ──────────
// Medición: `original/av-referencia/video-J-combate-overworld.mov` (combate de
// overworld vs orcs, melee). Muestreo EGA de frames nativos (ffmpeg vsync 0 +
// PIL). Metodología por-píxel en el commit de calibración (#26) y su mensaje.
/**
 * Recuadro del combatiente ACTIVO / ORIGEN (`g_cmb_actor`, el que tiene el turno).
 * Blanco puro EGA #ffffff (video-J muestrea ≥238 en los 3 canales). DERIVADO:
 * `ULTIMA.EXE.asm` 0x5779-0x5807 dibuja un marco de LÍNEA DOBLE (2 px) — filas y
 * columnas {0,1} y {14,15} del tile de 16 px (0xc9c/0xcf2 = línea H/V blanca en
 * y=Y0+bp6+si, x=X0+bp6+si con bp6∈{0,1}, si∈{0,14}). Ver `strokeActiveBox`.
 */
const CURSOR_COLOR = "#ffffff";
/**
 * Retícula de APUNTADO / TARGET (`g_cmb_aim_x/y`, la celda a la que apuntas).
 * Blanco #ffffff. DERIVADA de `ULTIMA.EXE.asm` 0x5813-0x5906 (gated on
 * `g_cmb_aim_active`): NO son corchetes de esquina — es la CRUZ DE DOBLE LÍNEA
 * CON ESPACIO del original (testigo usuario 2026-07-17). Ver `strokeAimReticle`.
 */
const AIM_COLOR = "#ffffff";
/**
 * Glifo del proyectil en vuelo. NO MEDIBLE en video-J (combate 100% melee, sin
 * ataques a distancia ni hechizos). Se conserva el amarillo; recalibrar con un
 * vídeo que muestre arco/hechizo. El impacto sí se midió (ver `paintStarburst`).
 */
const PROJECTILE_COLOR = "#ffff55";
/**
 * Colores del ESTALLIDO de impacto (`paintStarburst`). MEDIDOS del frame de golpe
 * del original (`av-referencia/capturas-2026-07-19/combate-victoria-permanencia.mov`,
 * f18, downscale nativo 320×200): núcleo BLANCO EGA-15, estrella interior AMARILLA
 * EGA-14, contorno exterior ROJO-claro EGA-12. Nada de underglow: el original NO
 * tiñe la celda — sólo pinta la estrella sobre el fondo.
 */
const STAR_WHITE = "#ffffff";
const STAR_YELLOW = "#ffff55";
const STAR_RED = "#ff5555";
/** Flash de pantalla completa (daño de terreno/evento). */
const SCREEN_FLASH_COLOR = "rgba(255,255,255,0.5)";

// ── Cadencias de los fx (Clase C → #26; ms; CALIBRADAS contra video-J) ──────
/**
 * Duración del vuelo del proyectil POR CELDA recorrida (spec §2: 13/6/8 px/frame
 * + delay kernel 0x3ee8 [= CS 0x20c8 → ULTIMA.EXE:0x20c8 delay_via_timer; el call vive
 * en COMSUBS 0x13d9, dentro de projectile_flight_anim (0x12de), con `push 0x28`]).
 * NO MEDIBLE en video-J (sin proyectiles: combate melee).
 * Se conserva 55 ms/celda; recalibrar con vídeo de arco/hechizo.
 */
const PROJECTILE_MS_PER_CELL = 55;
/**
 * Duración total del estallido de impacto. RE-MEDIDO (careo-combate T10): en
 * vídeo-J el salto amarillo dura 22.044→22.240 s ≈ 196 ms (corroborado por el
 * sheet a 8 fps: 2 frames); la medida previa de 120 ms venía de una captura a
 * 10 fps con un solo frame visible (cota floja, superada). La estrella es FIJA
 * toda su vida, SIN parpadeo — spec §3: "un ciclo invert→restore".
 */
const HIT_FLASH_MS = 196;
/** Duración de cada flash de pantalla completa (`kernel_flash`, spec §8). NO
 * exercido en video-J (la trampa ACID de un cofre no dispara flash de pantalla:
 * luminancia plana). Sin recalibrar. */
const SCREEN_FLASH_MS = 90;

// ── Estallido de impacto (spec §3): ESTRELLA DE 8 PUNTAS (geometría MEDIDA) ──
/**
 * El impacto NO blitea un tile ni un scatter aleatorio: el original dibuja una
 * ESTRELLA DE 8 PUNTAS FIJA y sólida. Derivado de `COMSUBS.OVL:0x0F4A` (lee una
 * FORMA de tabla de 9 filas y la traza con `call 0x2930` = línea — 0fd8-1023 el
 * bucle de filas, 1026-1079+ los brazos; NO un bucle de puntos aleatorios) y
 * MEDIDO píxel a píxel del frame de golpe del original (clip combate 2026-07-19,
 * f18, downscale nativo 320×200): estrella rellena de contorno ROJO, cuerpo
 * AMARILLO con espigas amarillas que corren por los brazos hasta cerca de las
 * puntas (rojas), y núcleo BLANCO 3×3.
 *
 * La silueta se modela con un radio de estrella `R(θ) = valle + (punta−valle)·
 * |cos(4θ)|^pot`: `|cos(4θ)|` tiene 8 máximos (cada 45°) → 8 puntas; `pot` afila.
 * Dos estrellas concéntricas (roja exterior, amarilla interior) + las espigas
 * amarillas por brazo. Radios en píxeles desde el centro de la celda de 16 px.
 */
const STAR_RED_POINT = 7.0; // radio a la punta roja (llega al borde del tile)
const STAR_RED_VALLEY = 4.2; // radio al valle rojo (entre puntas)
const STAR_RED_POW = 1.1; // afilado de las puntas rojas
const STAR_YEL_POINT = 4.6; // radio a la punta amarilla (estrella interior)
const STAR_YEL_VALLEY = 2.8; // radio al valle amarillo
const STAR_YEL_POW = 1.1; // afilado de las puntas amarillas
const STAR_SPIKE_CARD = 6; // espiga amarilla por brazo cardinal (hacia la punta)
const STAR_SPIKE_DIAG = 4; // espiga amarilla por brazo diagonal

// ── ABANICO de hechizo de línea (CAST.OVL 0x1f60→0x1c36→0x1bb0) — CALCO ─────
/**
 * Curva radial de 21 words — VERBATIM de DATA.OVL (DS 0x1cf0, fileoff 0x1d00),
 * la MISMA tabla que `SPRAY_SLOPE_CURVE` del core (no se importa: la piel sólo
 * puede `import type` del core — guarda skin-import-guard). En el trazador
 * (0x1c36) es el ACUMULADOR de pendiente por rayo: cada paso de eje resta 10 y
 * al agotarse (<1) da un paso PERPENDICULAR y recarga curve[i] ⇒ pendiente
 * perpendicular = 10/curve[i] por píxel. Rayo 0 (10) = diagonal 45°; rayo 10
 * (2000) = recto. 21 rayos = el CONO de ±45° del testigo (aulddragon Part 24).
 */
export const SPRAY_CURVE = [
  10, 12, 14, 16, 20, 25, 35, 50, 80, 190, 2000, 190, 80, 50, 35, 25, 20, 16, 14, 12, 10,
] as const;
/**
 * Color del rayo por modo del hechizo (1..4). DERIVADO: cada stub del dispatch
 * (CAST.OVL 0xf3f) empuja su global de color — In Zu→g_unk_13b6, In Nox Hur→
 * g_unk_13b4, In Flam Hur→g_unk_13ae, In Vas Grav Corp→g_unk_13b2 — cuyos
 * valores EGA los fija el init de vídeo (INTRO.OVL 0x09ee: 13ae=4 rojo,
 * 13b2=1 azul, 13b4=2 verde, 13b6=5 magenta; 13b2 ES el azul del marco del
 * juego, frame.ts). El trazador les suma 8 (0x1c88 `add [bp+8],8`) ⇒ variante
 * BRILLANTE: In Vas Grav Corp = 9 azul-claro (testigo Part 24 ✓).
 */
export function sprayColorForMode(mode: number): string {
  switch (mode) {
    case 1: return "#ff55ff"; // In Zu: 5+8 = 13 magenta-claro
    case 2: return "#55ff55"; // In Nox Hur: 2+8 = 10 verde-claro
    case 3: return "#ff5555"; // In Flam Hur: 4+8 = 12 rojo-claro
    default: return "#5555ff"; // In Vas Grav Corp (4): 1+8 = 9 azul-claro
  }
}
/** Punto de una polilínea de rayo, en píxeles de ARENA (0..175). */
export interface SprayPoint {
  x: number;
  y: number;
}
/**
 * Traza los 21 rayos del abanico — CALCO píxel a píxel de CAST.OVL 0x1c36+0x1bb0
 * en espacio de ARENA (px de pantalla − 8; la paridad de y se conserva porque el
 * offset 8 es par). Por rayo: origen = punto MEDIO del borde del tile del caster
 * que mira a la dirección (0x1c6a-0x1cec: base = esquina sup-izq del tile,
 * dir oeste y+8 / este x+16,y+8 / norte x+8 / sur x+8,y+16); avance de 1 px por
 * paso en el eje con acumulador `weight` (−10 por paso; al agotarse, paso
 * PERPENDICULAR ±1 — rayos 0-9 a un lado, 10-20 al otro, signo por dirección
 * 0x1ecb-0x1f14 — y recarga curve[i]). El rayo TERMINA al salir del viewport
 * (0x1bb0 bounds 8..0xb6 → arena 0..174, ANTES de pintar) o, en filas de y
 * IMPAR, si la celda es OPACA a hechizos (tabla 0x6a14 vía kernel 0x3f6e,
 * DESPUÉS de pintar el píxel: el muro recibe el último píxel, como el original).
 * `opaque(cx,cy)` lo aporta el adaptador (main.ts) con `blocksSpellLine` del
 * core sobre la rejilla viva de la arena. Determinista (el rand(15) de 0x1d33
 * sólo trocea el CRECIMIENTO por pasada — lo anima `paintOne`, no cambia la
 * forma). Diagonales: el original sólo apunta a 4 direcciones (getdir); si el
 * aim del port es diagonal se toma el eje vertical (Clase-C).
 */
export function traceSprayRays(
  caster: SprayPoint,
  dir: SprayPoint,
  opaque: (cx: number, cy: number) => boolean,
): SprayPoint[][] {
  const N = SPRAY_CURVE.length; // 21
  const bx = caster.x * TILE;
  const by = caster.y * TILE;
  // Eje + origen por dirección (0x1c6a-0x1cec). Vertical gana en diagonal.
  const vert = dir.y !== 0;
  const axis: SprayPoint = vert
    ? { x: 0, y: Math.sign(dir.y) }
    : { x: Math.sign(dir.x), y: 0 };
  let ox: number;
  let oy: number;
  // Signo del paso perpendicular para los rayos 0-9 (0x1ecb-0x1f14; 10-20 = el opuesto).
  let perpLow: SprayPoint;
  if (vert && axis.y < 0) {
    ox = bx + 8; oy = by; // norte (dir 3): perp x−1 (0x1ee4 add x,si con si=−1)
    perpLow = { x: -1, y: 0 };
  } else if (vert) {
    ox = bx + 8; oy = by + 16; // sur (dir 4): perp x+1 (0x1f02 sub x,si)
    perpLow = { x: 1, y: 0 };
  } else if (axis.x < 0) {
    ox = bx; oy = by + 8; // oeste (dir 1): perp y+1 (0x1f10→1f06 sub y,si)
    perpLow = { x: 0, y: 1 };
  } else {
    ox = bx + 16; oy = by + 8; // este (dir 2): perp y−1 (0x1f0a→1ee8 add y,si)
    perpLow = { x: 0, y: -1 };
  }
  const MAX = 176; // arena 11×16; bounds de pintado 0..174 (0x1bb0: 8..0xb6)
  const rays: SprayPoint[][] = [];
  for (let i = 0; i < N; i++) {
    const path: SprayPoint[] = [];
    let x = ox;
    let y = oy;
    let weight = SPRAY_CURVE[i]!;
    const pdx = i < 10 ? perpLow.x : -perpLow.x;
    const pdy = i < 10 ? perpLow.y : -perpLow.y;
    for (let step = 0; step < 2 * MAX; step++) {
      if (x < 0 || x > MAX - 2 || y < 0 || y > MAX - 2) break; // bounds ANTES de pintar
      path.push({ x, y });
      // Fila impar: corte LOS por celda (0x1bb0 1c03 `test y,1` + 0x3f6e/0x6a14),
      // DESPUÉS de pintar. El rayo 10 (recto) nunca gira; los demás serpentean.
      if ((y & 1) === 1 && opaque(x >> 4, y >> 4)) break;
      weight -= 10;
      x += axis.x;
      y += axis.y;
      if (weight < 1) {
        x += pdx;
        y += pdy;
        weight += SPRAY_CURVE[i]!;
      }
    }
    rays.push(path);
  }
  return rays;
}

// ── Cadencias del abanico (Clase C, calibradas al testigo Part 24 @30 fps) ──
/** Una "pasada" del bucle del original (por pasada cada rayo crece rand(0..15) px,
 *  0x1d33). ≈1 frame: el crecimiento completo (~170 px máx) tarda ~300-400 ms,
 *  como el testigo (s034→s042). */
const SPRAY_PASS_MS = 16;
/** Cuánto queda el abanico completo en pantalla antes de expirar (el original lo
 *  deja pintado hasta el siguiente redraw del turno; testigo ≈150 ms). */
const SPRAY_HOLD_MS = 150;
/** Media de px por pasada del crecimiento (rand(0..15) ⇒ 7.5). */
const SPRAY_MEAN_STEP = 7.5;

/** Esquina superior-izquierda en píxeles del viewport para la celda (cx,cy). */
function cellPx(cx: number, cy: number): { px: number; py: number } {
  return { px: VIEWPORT.x + cx * TILE, py: VIEWPORT.y + cy * TILE };
}

/**
 * Recuadro del ACTIVO / ORIGEN: marco de LÍNEA DOBLE (2 px) sobre el tile de 16 px.
 * Calca `ULTIMA.EXE.asm` 0x5779-0x5807: filas {0,1} y {14,15}, columnas {0,1} y
 * {14,15}, todas blancas y sólidas (bandas contiguas de 2 px, sin hueco). Cuatro
 * rects de 2 px de grosor = los cuatro lados. (Offsets literales del ASM: TILE=16.)
 */
function strokeActiveBox(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  color: string,
): void {
  const { px, py } = cellPx(cx, cy);
  ctx.fillStyle = color;
  ctx.fillRect(px, py, TILE, 2); // arriba (filas 0,1)
  ctx.fillRect(px, py + TILE - 2, TILE, 2); // abajo (filas 14,15)
  ctx.fillRect(px, py, 2, TILE); // izquierda (cols 0,1)
  ctx.fillRect(px + TILE - 2, py, 2, TILE); // derecha (cols 14,15)
}

/**
 * ESTALLIDO de impacto (spec §3): la ESTRELLA DE 8 PUNTAS que el original pinta
 * sobre la celda del objetivo al acertar un golpe. Forma FIJA y determinista (sin
 * RNG, sin parpadeo): se dibuja igual durante toda la vida del fx. Calca la forma
 * de `COMSUBS:0x0F4A` y la MEDICIÓN píxel a píxel del frame de golpe del original
 * (ver `STAR_*`). Tres capas concéntricas con la misma silueta de 8 puntas: rojo
 * (contorno exterior) → amarillo (estrella interior) → núcleo blanco 3×3. Sólo
 * `fillRect` opacos (sin alpha ni tile → el ctx-espía del pixeldiff lo captura); se
 * recorta a la arena para no pintar fuera del viewport de combate.
 */
function paintStarburst(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
): void {
  const { px, py } = cellPx(cx, cy);
  const ox = px + TILE / 2; // centro (entero) de la celda de 16 px
  const oy = py + TILE / 2;
  const inArena = (x: number, y: number): boolean =>
    x >= VIEWPORT.x && y >= VIEWPORT.y && x < VIEWPORT.x + ARENA_PX && y < VIEWPORT.y + ARENA_PX;
  const dot = (x: number, y: number, color: string): void => {
    if (inArena(x, y)) {
      ctx.fillStyle = color;
      ctx.fillRect(x, y, 1, 1);
    }
  };
  // Recorre la celda de 16 px; cada píxel se colorea por su radio contra las dos
  // estrellas concéntricas (roja exterior, amarilla interior). `|cos(4θ)|` da las
  // 8 puntas cada 45°; `^pot` las afila.
  for (let ly = 0; ly < TILE; ly++) {
    for (let lx = 0; lx < TILE; lx++) {
      const dx = lx - TILE / 2;
      const dy = ly - TILE / 2;
      const r = Math.hypot(dx, dy);
      const lobe = Math.abs(Math.cos(4 * Math.atan2(dy, dx)));
      const rRed = STAR_RED_VALLEY + (STAR_RED_POINT - STAR_RED_VALLEY) * lobe ** STAR_RED_POW;
      if (r > rRed) continue;
      const rYel = STAR_YEL_VALLEY + (STAR_YEL_POINT - STAR_YEL_VALLEY) * lobe ** STAR_YEL_POW;
      dot(px + lx, py + ly, r <= rYel ? STAR_YELLOW : STAR_RED);
    }
  }
  // Espigas AMARILLAS por cada brazo (el centro amarillo que corre hacia las puntas
  // rojas, medido en el original): línea de 1 px del centro hacia fuera.
  const spike = (dirX: number, dirY: number, len: number): void => {
    for (let d = 1; d <= len; d++) dot(ox + dirX * d, oy + dirY * d, STAR_YELLOW);
  };
  spike(1, 0, STAR_SPIKE_CARD);
  spike(-1, 0, STAR_SPIKE_CARD);
  spike(0, 1, STAR_SPIKE_CARD);
  spike(0, -1, STAR_SPIKE_CARD);
  spike(1, 1, STAR_SPIKE_DIAG);
  spike(1, -1, STAR_SPIKE_DIAG);
  spike(-1, 1, STAR_SPIKE_DIAG);
  spike(-1, -1, STAR_SPIKE_DIAG);
  // Núcleo blanco 3×3 centrado (siempre dentro para una celda válida).
  ctx.fillStyle = STAR_WHITE;
  ctx.fillRect(ox - 1, oy - 1, 3, 3);
}

/**
 * Retícula de apuntado (§7). CALCADA del ASM (`ULTIMA.EXE.asm` 0x5813-0x5906, la
 * rama gated on `g_cmb_aim_active` del redibujo del viewport de combate; primitivas
 * 0xa70=set_color, 0xb10=línea, 0xf90=lineTo). NO son corchetes de esquina: es una
 * CRUZ DE DOBLE LÍNEA CON ESPACIO (testigo usuario 2026-07-17). Sobre el tile de
 * 16 px el kernel pinta blanco en:
 *   · FILAS 6 y 9  (bucle externo bp-6∈{0,1} sube la Y de fila 6→9; bp-0x14 = fila)
 *   · COLUMNAS 6 y 9 (bucle interno bp-8∈{0,1} desplaza la X; di = columna)
 * cada tramo PARTIDO en el centro (hueco en 7-8) y extendido de la inserción 2 a 13.
 * → doble línea horizontal (filas 6,9; el "espacio entre las líneas" son las filas
 * 7-8) + doble línea vertical (cols 6,9; hueco cols 7-8), con hueco central para que
 * el objetivo asome. Los tramos NEGROS del ASM sólo aíslan la línea (aquí no se
 * pintan: la arena asoma por los huecos). Offsets literales del ASM: TILE=16.
 */
function strokeAimReticle(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  color: string,
): void {
  const { px, py } = cellPx(cx, cy);
  ctx.fillStyle = color;
  // Doble línea VERTICAL (cols 6 y 9), partida en el centro: tramos y 2..6 y 9..13.
  for (const c of [6, 9]) {
    ctx.fillRect(px + c, py + 2, 1, 5); // tramo superior
    ctx.fillRect(px + c, py + 9, 1, 5); // tramo inferior
  }
  // Doble línea HORIZONTAL (filas 6 y 9), partida en el centro: tramos x 2..6 y 9..13.
  for (const r of [6, 9]) {
    ctx.fillRect(px + 2, py + r, 5, 1); // tramo izquierdo
    ctx.fillRect(px + 9, py + r, 5, 1); // tramo derecho
  }
}

/**
 * PINTADO PURO de los overlays estáticos de combate (recuadro del activo §1 +
 * retícula de apuntado §7). Sin estado → testeable con un ctx espía. Se llama tras
 * blitear la arena. `phase` = fase del reloj F-A (parpadeo del recuadro, Clase C).
 */
export function paintCombatOverlays(
  ctx: CanvasRenderingContext2D,
  cv: CombatView,
  phase: number,
): void {
  // Recuadro del combatiente ACTIVO / ORIGEN (spec §1, ASM 0x5779): marco blanco de
  // LÍNEA DOBLE (2 px) sobre su tile (`g_cmb_actor`) que PARPADEA a ~9 Hz.
  // MEDIDO (careo-combate T3): vídeo-J 2.5-3.15 s ON≈49 ms/OFF≈60 ms; vídeo-O
  // 18.5-19.3 s ON≈52 ms/OFF≈60 ms (9 ciclos limpios) → ciclo ≈110 ms (≈3.5-4
  // frames VGA 70 Hz por fase). La cita previa «en el vídeo-O no parpadea a ojo»
  // queda FALSIFICADA por la medición del propio vídeo-O. `phase` llega en ticks
  // de ~55 ms (reloj F-A base): `phase & 1` = ON 55/OFF 55 ≈ el ciclo medido.
  if (cv.active && (phase & 1) === 0) {
    strokeActiveBox(ctx, cv.active.x, cv.active.y, CURSOR_COLOR);
  }
  // Retícula de apuntado / TARGET (spec §7, ASM 0x5813): la CRUZ DE DOBLE LÍNEA CON
  // ESPACIO blanca sobre la celda apuntada (`g_cmb_aim_x/y`). Sin relleno de celdas
  // (el original no resalta el alcance). Blink a ~4-5 Hz (fase 100-125 ms medida en
  // canvas; cadencia original sin testigo limpio — Clase C, careo T12): con `phase`
  // ahora en ticks de 55 ms se conserva con `phase >> 1`.
  if (cv.aim && ((phase >> 1) & 1) === 0) {
    strokeAimReticle(ctx, cv.aim.cell.x, cv.aim.cell.y, AIM_COLOR);
  }
}

interface LiveFx {
  fx: CombatFx;
  /** Instante (ms, reloj de pared) en que se empujó. */
  start: number;
}

/**
 * Capa de EFECTOS EFÍMEROS de combate (proyectil/impacto/flash, spec §2/§3). El
 * único estado de la piel de combate: los fx vivos y su arranque. Los empuja el
 * bus `onCombatFx`; `paint` los dibuja según el tiempo transcurrido y expira los
 * agotados. Cadencias = Clase C (#26). No lee el core: sólo los fx recibidos.
 */
export class CombatFxLayer {
  private items: LiveFx[] = [];

  /** ¿Hay algún fx vivo? (la piel pide repintado continuo mientras lo haya). */
  get active(): boolean {
    return this.items.length > 0;
  }

  /** Encola un fx recibido del bus, sellando su instante de arranque. */
  push(fx: CombatFx, now: number): void {
    this.items.push({ fx, start: now });
  }

  /** Descarta todos los fx (cambio de piel / fin de combate). */
  clear(): void {
    this.items = [];
  }

  /**
   * Dibuja los fx vivos en su posición/estado a tiempo `now` (ms) y purga los
   * agotados. Devuelve true si aún quedan fx (para seguir repintando). Puro
   * respecto al ctx: sólo escribe rects.
   */
  paint(ctx: CanvasRenderingContext2D, now: number): boolean {
    const alive: LiveFx[] = [];
    for (const it of this.items) {
      if (this.paintOne(ctx, it, now - it.start)) alive.push(it);
    }
    this.items = alive;
    return alive.length > 0;
  }

  /** Pinta un fx; devuelve false si ya expiró. `t` = ms desde el arranque. */
  private paintOne(
    ctx: CanvasRenderingContext2D,
    it: LiveFx,
    t: number,
  ): boolean {
    const fx = it.fx;
    if (fx.kind === "projectile") {
      const dx = fx.to.x - fx.from.x;
      const dy = fx.to.y - fx.from.y;
      const cells = Math.max(1, Math.max(Math.abs(dx), Math.abs(dy)));
      const dur = cells * PROJECTILE_MS_PER_CELL;
      if (t >= dur) return false;
      const f = t / dur;
      const cx = fx.from.x + dx * f;
      const cy = fx.from.y + dy * f;
      // Glifo del misil: cuadradito centrado en la celda interpolada (px libre).
      const px = VIEWPORT.x + cx * TILE + TILE / 2 - 2;
      const py = VIEWPORT.y + cy * TILE + TILE / 2 - 2;
      ctx.fillStyle = PROJECTILE_COLOR;
      ctx.fillRect(px, py, 4, 4);
      return true;
    }
    if (fx.kind === "hitFlash") {
      if (t >= HIT_FLASH_MS) return false;
      // ESTRELLA DE 8 PUNTAS sobre la celda del objetivo (spec §3): calca la forma de
      // `COMSUBS:0x0F4A` + medición del frame de golpe del original — núcleo blanco,
      // estrella amarilla, contorno rojo. Forma FIJA toda su vida (sin parpadeo), SIN
      // underglow de celda (el original no tiñe la celda). Duración = HIT_FLASH_MS.
      paintStarburst(ctx, fx.x, fx.y);
      return true;
    }
    // quake: se intercepta en `onCombatFx` (dispara la QuakeShake); nunca llega
    // aquí como fx a pintar por celda.
    if (fx.kind === "quake") return false;
    if (fx.kind === "lineSpray") {
      // ABANICO (0x1c36): los rayos CRECEN por pasadas — en el original cada rayo
      // avanza rand(0..15) px por pasada (0x1d33) y lo dibujado PERSISTE (se acumula,
      // testigo Part 24 s037→s042). Aquí la forma ya viene trazada (fx.rays); el
      // crecimiento se anima con un LCG LOCAL de presentación (sellado por fx: mismo
      // dibujo cada frame; JAMÁS el rng de combate — paridad intacta).
      const passes = Math.floor(t / SPRAY_PASS_MS);
      const longest = fx.rays.reduce((m, r) => Math.max(m, r.length), 0);
      // Expira cuando hasta el rayo más largo ha podido crecer entero + el hold.
      const passesToFull = Math.ceil(longest / SPRAY_MEAN_STEP) + 4;
      if (t >= passesToFull * SPRAY_PASS_MS + SPRAY_HOLD_MS) return false;
      ctx.fillStyle = (fx as { color: string }).color;
      for (let i = 0; i < fx.rays.length; i++) {
        const ray = fx.rays[i]!;
        // Longitud revelada: suma de rand(0..15) por pasada, LCG determinista por rayo.
        let seed = (it.start * 2654435761 + i * 40503) >>> 0;
        let len = 0;
        for (let p = 0; p < passes && len < ray.length; p++) {
          seed = (seed * 1664525 + 1013904223) >>> 0;
          len += seed % 16;
        }
        len = Math.min(len, ray.length);
        for (let k = 0; k < len; k++) {
          const pt = ray[k]!;
          // El original pinta (x,y) y (x+1,y) — par horizontal de 2 px (0x1be0-0x1bf1).
          ctx.fillRect(VIEWPORT.x + pt.x, VIEWPORT.y + pt.y, 2, 1);
        }
      }
      return true;
    }
    // screenFlash: n destellos de pantalla completa sobre la arena.
    const total = fx.n * SCREEN_FLASH_MS;
    if (t >= total) return false;
    if (Math.floor(t / SCREEN_FLASH_MS) % 2 === 0) {
      ctx.fillStyle = SCREEN_FLASH_COLOR;
      ctx.fillRect(VIEWPORT.x, VIEWPORT.y, ARENA_PX, ARENA_PX);
    }
    return true;
  }
}
