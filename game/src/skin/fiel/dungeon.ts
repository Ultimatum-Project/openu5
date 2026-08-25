/**
 * Vista de mazmorra first-person para la PIEL FIEL — COMPOSITOR de rodajas (M2).
 *
 * El original NO vectoriza trapecios: COMPONE el pasillo blitteando las 28 rodajas
 * de perspectiva pre-dibujadas de DNG{1,2,3}.16 (`extractor/parsers/dngtiles.ts`
 * `parseDngView`) a una X FIJA por profundidad, SIN estirar, en pares con espejo.
 * Modelo reverse-engineered del binario (re/notes/dungeon3d-audit.md §6/§7,
 * DUNGEON.OVL `dng_blit_piece` @0x134A, `fn_1682` laterales @0x1682, `fn_150a`
 * frontales @0x150a, driver `dng_draw_view` @0x1a90):
 *
 *  - Los laterales (rodajas 0-3 muro / 4-7 puerta / 16-19 pasaje abierto / 20-23
 *    alcoba) se blitean por profundidad d en `SIDE_X[side][d]`, altura nativa 164,
 *    Y=14. El lado IZQUIERDO normal (prim. 0x8b7c), el DERECHO ESPEJADO (0x8a2c) →
 *    simetría del túnel. Los 4 anillos ABUTAN de borde a borde (16→96, 96→176).
 *  - El muro de FONDO (dead-end/puerta) se dibuja en PAR: mitad izquierda normal en
 *    `96−ancho`, mitad derecha espejada en `X=96` (override 0x60 del binario).
 *  - Suelo moteado y techo van HORNEADOS en cada rodaja (altura completa) → el visor
 *    queda lleno; el único negro es el punto de fuga tras `lightDepth`.
 *
 * La LÓGICA (qué celda es visible, facing, tipos) sale del snapshot; aquí sólo se
 * COMPONE. Las features (escaleras/fuentes/trampas/cofres) salen de ITEMS.16
 * (`featureBlits`, calcado de fn_1952 @0x1952); el campo mágico no tiene arte y va
 * por su subsistema de CHISPAS (`magic_field_sparkle_drawer` @0x127e, tablas y
 * derivación en dungeon-decor.ts).
 */
import type { DungeonCellView, DungeonViewInfo } from "../api.js";
import { VIEWPORT } from "./frame.js";

/** Rectángulo de una rodaja dentro del atlas de perspectiva (game/assets). */
export interface AtlasRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/**
 * Pack de PERSPECTIVA de mazmorra: el atlas de rodajas de pared extraído de
 * DNG*.16 (extractor/parsers/dngtiles.ts) por VARIANTE de textura. `paintDungeon`
 * elige la variante por `DungeonViewInfo.wallVariant`; sin pack cae al placeholder.
 */
export interface DungeonWallPack {
  image: CanvasImageSource;
  /**
   * Rodajas por VARIANTE de muro: `rectsByVariant[v]` = las 28 rodajas de la
   * variante v (0=DNG1 oliva, 1=DNG2 rojo, 2=DNG3 gris). `paintDungeon` elige la
   * variante por `DungeonViewInfo.wallVariant` (V→índice V−1, DUNGEON:0x0e7b).
   */
  rectsByVariant: readonly (readonly (AtlasRect | null)[])[];
  /** Override de auditoría (`?dungvar=N`): fuerza el índice de variante; null = por mazmorra. */
  variantOverride?: number | null;
}

/** Pack ya resuelto a UNA variante (rodajas + imagen), lo que consume el blitter. */
interface ResolvedPack {
  image: CanvasImageSource;
  rects: readonly (AtlasRect | null)[];
}

/**
 * Pack de FEATURES de mazmorra (ITEMS.16, banco a9c4 del binario): 20 imágenes
 * REALES en perspectiva — escalera 0-3, fuente 4-7, trampa 8-11, cofre cerrado
 * 12-15, cofre abierto 16-19, cada grupo a 4 profundidades (si=0 la más cercana,
 * 40 px de ancho). Son MEDIAS features (mitad izquierda): el original blitea la
 * mitad normal en X=96−w (tabla 0x2e72) y su espejo-H ABUTTED en X=96
 * (`dng_blit_piece` @DUNGEON:0x13ee/0x13e6). La transparencia viene HORNEADA en
 * el alpha del atlas (máscara AND del contenedor, extractor parseItemsView) —
 * NADA de keying color-0 (el interior negro del cofre abierto es opaco).
 */
export interface DungeonFeatPack {
  image: CanvasImageSource;
  /** Los 20 rects de ITEMS.16 (parseItemsView), por índice de imagen. */
  rects: readonly (AtlasRect | null)[];
}

// Paleta EGA 16: fuente única compartida (ega.ts, auditoría D2; brown-fix índice 6 allí).
import { EGA_PALETTE as EGA } from "./ega.js";
// Decoración procedural (goteo de estalactita / destello del esqueleto).
import {
  DungeonDecorState,
  dripFrontPos,
  dripRects,
  dripSidePos,
  glintRects,
  type DecorRect,
} from "./dungeon-decor.js";

// Tipos de celda por nibble ALTO (dict DNGLOOK, dungeon.ts CellType).
const T = {
  Nothing: 0x0,
  LadderUp: 0x1,
  LadderDown: 0x2,
  LadderUpDown: 0x3,
  Chest: 0x4,
  Fountain: 0x5,
  Trap: 0x6,
  OpenChest: 0x7,
  MagicField: 0x8,
  RoomsBroke: 0xa,
  Wall: 0xb,
  SpecialWall: 0xc,
  SecretDoor: 0xd,
  NormalDoor: 0xe,
  Room: 0xf,
} as const;

type Facing = DungeonViewInfo["facing"];

/**
 * Nombre de la dirección de cara que la banda INFERIOR de mazmorra imprime tras
 * "Dir:" (dng_draw_panel DUNGEON:0x01D2 → North/East/South/West según g_dng_facing
 * 0..3; dungeon.md §0.3). Es el MISMO literal inglés que la tabla de vientos.
 */
export const DUNGEON_DIR_NAMES: Record<Facing, string> = {
  north: "North",
  east: "East",
  south: "South",
  west: "West",
};

/**
 * Banda SUPERIOR de mazmorra: el nivel actual "L1".."L8". g_floor 0..7 = nivel 1..8
 * (dungeon.md §4). Medido de video-N (f010/f030: ►L1◄).
 */
export function dungeonLevelLabel(floor: number): string {
  return `L${floor + 1}`;
}

/**
 * Banda INFERIOR de mazmorra: "Dir:" + el nombre de dirección JUSTIFICADO A LA
 * DERECHA en un campo de 7 (medido de f010/f030). `dirName` ya viene traducido.
 */
export function dungeonDirLabel(dirName: string): string {
  return `Dir:${dirName.padStart(7)}`;
}

const FWD: Record<Facing, readonly [number, number]> = {
  north: [0, -1],
  east: [1, 0],
  south: [0, 1],
  west: [-1, 0],
};
const LEFT_OF: Record<Facing, Facing> = {
  north: "west",
  west: "south",
  south: "east",
  east: "north",
};

// ── Geometría del compositor (DATA.OVL, DS+0x10; verificada byte-a-byte) ──────
//
// 0x2e62: X de pantalla de la rodaja lateral por [lado][profundidad]. Los 4
// anillos de cada lado abutan (IZQ 16→96, DER 96→176; anchos 24+32+16+8=80).
const SIDE_X = {
  left: [16, 40, 72, 88] as const, //   0x2e62[0..3]
  right: [152, 120, 104, 96] as const, // 0x2e62[4..7]
} as const;
/** Y de pantalla del tope de toda rodaja (0x134A push 0xe). Altura nativa = 164. */
const SLICE_Y = 14;
/** Override X del binario para el muro de fondo espejado (0x134A: mov [bp-6],0x60). */
const CENTER_X = 0x60; // 96

/**
 * Base de rodaja LATERAL por tipo del vecino (fn_1682 @0x1682, switch tile&0xf0).
 * pieceCode = base + profundidad; la imagen lejana = pieceCode directo.
 */
function sideBase(cell: DungeonCellView): number {
  const k = cell.type;
  if (k < 0xa) return 0x10; // abierto → pasaje lateral (rodajas 16-19)
  if (k === T.SpecialWall) return 0x14; // especial → alcoba (20-23)
  if (k === T.RoomsBroke || k === T.NormalDoor || k === T.Room) return 4; // puerta lateral (4-7)
  return 0; // muro / secreta → lateral liso (0-3)
}

/**
 * Base de rodaja FRONTAL por tipo de la celda de fondo (fn_150a @0x150a, BYTE
 * table 0x2e80[kind]). pieceCode = base + profundidad.
 */
function frontBase(kind: number): number {
  switch (kind) {
    case T.Wall:
    case T.SecretDoor:
      return 8; // dead-end liso (9-11)
    case T.SpecialWall:
      return 0x18; // muro especial (25-27)
    default:
      return 12; // rooms_broke/puerta/sala → frente con puerta (13-15)
  }
}

/** ¿La celda corta la línea de visión (kinds 0xa..0xf: muro/especial/secreta/puerta/sala)? */
function blocksView(cell: DungeonCellView): boolean {
  if (cell.type === T.SecretDoor && cell.secretRevealed) return true; // revelada = puerta (frente + para)
  return cell.type >= 0xa;
}

const WALL_CELL: DungeonCellView = { x: -1, y: -1, type: T.Wall, sub: 0, secretRevealed: false };

/** Blit de muro lateral: rodaja `slice` en `x` (borde izq), espejada para el lado derecho. */
export interface SideBlit {
  op: "side";
  depth: number;
  side: "left" | "right";
  slice: number;
  x: number;
  mirror: boolean;
}
/** Muro de fondo: se dibuja en PAR (mitad izq normal en 96−ancho, mitad der espejada en 96). */
export interface FrontBlit {
  op: "front";
  depth: number;
  slice: number;
}
/** Monstruo ERRANTE 3D en una celda del cono (dungeon-wanderer.md §9): dos
 *  MITADES espejadas (prims 0x8b7c/0x8a2c @DUNGEON 0x1230/0x1267), índice de
 *  sprite = frame·3 + prof−1 (el layout del atlas dungeon-mon), X izquierda por
 *  tabla 0x2E2A (72/80/88) + espejo en 0x60=96, Y por tabla 0x2E32 con fila 1 =
 *  TECHO (araña/slime acechando). */
export interface MonsterOp {
  op: "monster";
  depth: number;
  bank: number;
  ceiling: boolean;
}

/** Feature de celda (escalera/fuente/trampa/cofre/campo) en el cono, si=0..3. */
export interface FeatureOp {
  op: "feature";
  cellType: number;
  sub: number;
  depth: number;
}
/**
 * DECORACIÓN procedural sobre un muro especial (0xC) — goteo de estalactita
 * (variante 1, fn_150a @0x155f / fn_1682 @0x16e0) o destello del esqueleto
 * (variante 3, @0x15fa). Se emite JUNTO a su blit de muro (el original lo
 * dibuja dentro de la misma rutina de blit, antes de las features).
 */
export interface DecorOp {
  op: "decor";
  kind: "dripFront" | "dripSide" | "glint";
  depth: number;
  /** Lado del disparo lateral (derecho = X espejada 0xBE−X). */
  side?: "left" | "right";
  /** Celda dueña del estado de gota (coords absolutas de la planta). */
  cellX: number;
  cellY: number;
}
export type DungeonDrawOp = SideBlit | FrontBlit | FeatureOp | MonsterOp | DecorOp;

/** Pack del monstruo errante (MON0-7.16 → atlas dungeon-mon): 8 variantes de 6
 *  rects = 2 frames × 3 profundidades (24×66 / 16×25 / 8×6). */
export interface DungeonMonPack {
  image: CanvasImageSource;
  /** rects por banco (variants[bank].rects, índice = frame·3 + prof−1). */
  banks: readonly (readonly (AtlasRect | null)[])[];
}

/**
 * PLAN de composición puro (sin canvas): la lista determinista de rodajas/features
 * que el original blitea para esta vista. Réplica del driver `dng_draw_view`
 * @DUNGEON:0x1a90 — marcha near→far, muro de fondo al primer bloqueo, features
 * lejos→cerca. Testeable sin DOM; `paintDungeon` sólo lo RENDERIZA.
 */
export function planDungeonView(dv: DungeonViewInfo): DungeonDrawOp[] {
  const ops: DungeonDrawOp[] = [];
  if (!dv.lit) return ops;

  const byKey = new Map<string, DungeonCellView>();
  for (const c of dv.cells) byKey.set(`${c.x}:${c.y}`, c);
  const present = (x: number, y: number): boolean => byKey.has(`${x}:${y}`);
  const cellAt = (x: number, y: number): DungeonCellView => byKey.get(`${x}:${y}`) ?? WALL_CELL;

  const fwd = FWD[dv.facing];
  const leftDir = FWD[LEFT_OF[dv.facing]];
  const maxDepth = Math.min(dv.lightDepth, 3);

  const features: (FeatureOp | MonsterOp)[] = [];
  for (let si = 0; si <= maxDepth; si++) {
    const cx = dv.pos.x + fwd[0] * si;
    const cy = dv.pos.y + fwd[1] * si;
    if (si > 0 && !present(cx, cy)) break; // tras la luz → punto de fuga negro
    const cell = cellAt(cx, cy);

    if (si > 0 && blocksView(cell)) {
      const kind = cell.type === T.SecretDoor && cell.secretRevealed ? T.NormalDoor : cell.type;
      ops.push({ op: "front", depth: si, slice: frontBase(kind) + si });
      // Decoración del muro especial FRONTAL (fn_150a, tras el par de blits):
      // goteo en DNG1 a prof 1-2 (0x155f-0x1579) / destello en DNG3 a prof 1
      // (0x15fa-0x1608). Ambos gateados por tile&0xf0==0xC0.
      if (cell.type === T.SpecialWall) {
        if (dv.wallVariant === 1 && (si === 1 || si === 2)) {
          ops.push({ op: "decor", kind: "dripFront", depth: si, cellX: cx, cellY: cy });
        } else if (dv.wallVariant === 3 && si === 1) {
          ops.push({ op: "decor", kind: "glint", depth: si, cellX: cx, cellY: cy });
        }
      }
      break;
    }

    const standingOnDoor = si === 0 && cell.type === T.NormalDoor; // driver 0x1b1e
    if (!standingOnDoor) {
      const ln = cellAt(cx + leftDir[0], cy + leftDir[1]);
      const rn = cellAt(cx - leftDir[0], cy - leftDir[1]);
      ops.push({ op: "side", depth: si, side: "left", slice: sideBase(ln) + si, x: SIDE_X.left[si]!, mirror: false });
      ops.push({ op: "side", depth: si, side: "right", slice: sideBase(rn) + si, x: SIDE_X.right[si]!, mirror: true });
      // Decoración del muro especial LATERAL (fn_1682 @0x16d7-0x1735): goteo
      // sólo en DNG1 y a prof 0-1, con estado en la celda VECINA (la del 0xC).
      if (dv.wallVariant === 1 && si <= 1) {
        if (ln.type === T.SpecialWall) {
          ops.push({ op: "decor", kind: "dripSide", depth: si, side: "left", cellX: ln.x, cellY: ln.y });
        }
        if (rn.type === T.SpecialWall) {
          ops.push({ op: "decor", kind: "dripSide", depth: si, side: "right", cellX: rn.x, cellY: rn.y });
        }
      }
    }

    // Features TAMBIÉN a si=0 (celda pisada): el driver 0x1a90 (bucle 0x1b98)
    // llama fn_1952 desde lejos hasta si=0 INCLUSIVE — de pie sobre la escalera
    // se dibuja la imagen 0 (40×80). El gate si>0 anterior era un defecto
    // (careo decor-mazmorra: p19-0720/f001/f010 = img 0 en si=0).
    if (cell.type >= T.LadderUp && cell.type <= T.MagicField) {
      features.push({ op: "feature", cellType: cell.type, sub: cell.sub, depth: si });
    }
    // Errante 3D sobre la celda frontal (comparación con wrap &7, como el rayo).
    if (si > 0 && dv.monster) {
      const wx = ((cx % 8) + 8) % 8;
      const wy = ((cy % 8) + 8) % 8;
      if (wx === dv.monster.x && wy === dv.monster.y) {
        features.push({ op: "monster", depth: si, bank: dv.monster.bank, ceiling: dv.monster.ceiling });
      }
    }
  }
  // Painter lejos→cerca.
  for (let i = features.length - 1; i >= 0; i--) ops.push(features[i]!);
  return ops;
}

/**
 * Pinta la vista de mazmorra en el viewport (8,8)-(184,184). `phase` alimenta el
 * titileo de la antorcha del punto de fuga (cosmético, no toca estado).
 */
export function paintDungeon(
  ctx: CanvasRenderingContext2D,
  dv: DungeonViewInfo,
  phase: number,
  /** Pack de perspectiva; si se pasa, se componen las rodajas reales. */
  pack?: DungeonWallPack | null,
  /** Pack de features (ITEMS.16); si se pasa, se blitean los frames reales. */
  featPack?: DungeonFeatPack | null,
  /** Pack del monstruo errante (MON0-7.16); sin él el errante no se dibuja. */
  monPack?: DungeonMonPack | null,
  /**
   * Estado vivo del decorado procedural (goteo/destello, dungeon-decor.ts);
   * sin él la decoración no se dibuja (packless/tests deterministas).
   */
  decor?: DungeonDecorState | null,
): void {
  const ox = VIEWPORT.x;
  const oy = VIEWPORT.y;
  const size = VIEWPORT.tile * VIEWPORT.tiles; // 176

  const resolved: ResolvedPack | null = pack
    ? (() => {
        const idx = pack.variantOverride != null ? pack.variantOverride : dv.wallVariant - 1;
        const rects =
          pack.rectsByVariant[Math.max(0, Math.min(pack.rectsByVariant.length - 1, idx))];
        return rects ? { image: pack.image, rects } : null;
      })()
    : null;

  ctx.save();
  ctx.beginPath();
  ctx.rect(ox, oy, size, size);
  ctx.clip();

  // Base negra: el gate de luz a oscuras, y el punto de fuga tras `lightDepth`.
  // Todo lo iluminado lo tapan las rodajas (suelo/techo horneados) o el placeholder.
  ctx.fillStyle = "#000000";
  ctx.fillRect(ox, oy, size, size);
  if (!dv.lit) {
    ctx.restore();
    return;
  }

  for (const op of planDungeonView(dv)) {
    if (op.op === "side") {
      if (!(resolved && blitSlice(ctx, resolved, op.slice, op.x, op.mirror))) {
        drawSidePlaceholder(ctx, op.depth, op.side, op.slice - op.depth < 0x10);
      }
    } else if (op.op === "front") {
      drawFront(ctx, resolved, op);
    } else if (op.op === "monster") {
      drawMonster(ctx, op, phase, monPack);
    } else if (op.op === "decor") {
      if (decor) drawDecor(ctx, op, dv.floor, decor);
    } else {
      drawContents(ctx, op, featPack, decor);
    }
  }

  // (flickerMotes RETIRADO 2026-07-25: era una invención — su apoyo «spec §2 paso 7»
  // (DNGLOOK 0x0EEE-0x0FD3) quedó re-derivado por dungeon-wanderer.md §7 como el
  // barajado de SLOTS DE MONSTRUO de la arena procedural, no «motas de luz»; y el
  // careo contra video-N-frames f010-f049 del original da 0 píxeles amarillos.
  // Testigo del usuario 09:45: «en orig no veo esos píxeles» — CONFIRMADO.)
  ctx.restore();
}

// ── Monstruo errante: geometría del blit (DUNGEON 0x1210-0x1273; DATA.OVL) ────
/** X de la MITAD izquierda por profundidad 1-3 (tabla DS 0x2E2A[1..3]); espejo en 0x60. */
const MON_X = [72, 80, 88] as const;
/** Y por [fila][profundidad 1-3] (tabla DS 0x2E32): fila 0 = suelo, fila 1 = TECHO. */
const MON_Y = [
  [86, 96, 98],
  [40, 70, 85],
] as const;
const MON_CENTER_X = 0x60; // 96

/**
 * Dibuja el errante a su profundidad: dos MITADES espejadas (0x8b7c + espejo
 * 0x8a2c), sprite = frame·3 + prof−1 del banco. La ANIMACIÓN del binario tira
 * 2×rand(0,100) por redraw + máquina de bits del attr (0x117A-0x120D) — RNG de
 * RENDER, excluido del núcleo puro (divergencia sancionada dungeon.md §12.11):
 * aquí cada mitad alterna por fase de reloj de la piel (presentación pura).
 */
function drawMonster(
  ctx: CanvasRenderingContext2D,
  op: MonsterOp,
  phase: number,
  monPack?: DungeonMonPack | null,
): void {
  if (!monPack || op.depth < 1 || op.depth > 3) return;
  const rects = monPack.banks[op.bank];
  if (!rects) return;
  const y = MON_Y[op.ceiling ? 1 : 0][op.depth - 1]!;
  const x = MON_X[op.depth - 1]!;
  const frameA = phase & 1;
  const frameB = (phase >> 1) & 1;
  const left = rects[frameA * 3 + op.depth - 1];
  const right = rects[frameB * 3 + op.depth - 1];
  if (left) ctx.drawImage(monPack.image, left.x, left.y, left.w, left.h, x, y, left.w, left.h);
  if (right) {
    ctx.save();
    ctx.translate(MON_CENTER_X + right.w, y);
    ctx.scale(-1, 1);
    ctx.drawImage(monPack.image, right.x, right.y, right.w, right.h, 0, 0, right.w, right.h);
    ctx.restore();
  }
}

/**
 * Blitea la rodaja `index` en `(dx, SLICE_Y)` a tamaño NATIVO (sin estirar). Con
 * `mirror`, voltea horizontalmente dentro de la caja [dx, dx+w] (prim. 0x8a2c del
 * binario). Devuelve `false` si la ranura no existe (caller cae al placeholder).
 */
function blitSlice(
  ctx: CanvasRenderingContext2D,
  pack: ResolvedPack,
  index: number,
  dx: number,
  mirror: boolean,
): boolean {
  const r = pack.rects[index];
  if (!r) return false;
  if (mirror) {
    ctx.save();
    ctx.translate(dx + r.w, SLICE_Y);
    ctx.scale(-1, 1);
    ctx.drawImage(pack.image, r.x, r.y, r.w, r.h, 0, 0, r.w, r.h);
    ctx.restore();
  } else {
    ctx.drawImage(pack.image, r.x, r.y, r.w, r.h, dx, SLICE_Y, r.w, r.h);
  }
  return true;
}

/** Ancho de una rodaja (para calcular la X del par frontal). */
function sliceW(pack: ResolvedPack, index: number): number {
  return pack.rects[index]?.w ?? 0;
}

function drawFront(ctx: CanvasRenderingContext2D, pack: ResolvedPack | null, op: FrontBlit): void {
  if (pack) {
    const w = sliceW(pack, op.slice);
    // Par binario: mitad IZQ normal terminando en el centro (96−ancho), mitad DER
    // espejada anclada en el centro (override X=0x60).
    const okL = blitSlice(ctx, pack, op.slice, CENTER_X - w, false);
    const okR = blitSlice(ctx, pack, op.slice, CENTER_X, true);
    if (okL || okR) return;
  }
  // Puerta si la base de la rodaja es 12 (frente con puerta 13-15).
  drawFrontPlaceholder(ctx, op.depth, op.slice - op.depth === 12);
}

// ── Decoración procedural (goteo 0x145c / destello 0x15fa) ───────────────────

/**
 * Dibuja un op de decoración avanzando el estado vivo (un paso de máquina por
 * REDIBUJO, como el original — fn_150a/fn_1682 corren dentro del redraw). El
 * estado de gota es por celda (floor:x:y, el original lo guarda en los 3 bits
 * bajos del tile del mapa vivo).
 */
function drawDecor(
  ctx: CanvasRenderingContext2D,
  op: DecorOp,
  floor: number,
  decor: DungeonDecorState,
): void {
  if (op.kind === "glint") {
    if (decor.rollGlint()) paintDecorRects(ctx, glintRects());
    return;
  }
  const st = decor.stepDrip(`${floor}:${op.cellX}:${op.cellY}`);
  if (st == null) return; // frame de estado 5 (reset, sin dibujo)
  const pos =
    op.kind === "dripFront"
      ? dripFrontPos(op.depth, st)
      : dripSidePos(op.depth, op.side ?? "left", st);
  paintDecorRects(ctx, dripRects(pos.x, pos.y, st));
}

function paintDecorRects(ctx: CanvasRenderingContext2D, rects: readonly DecorRect[]): void {
  for (const r of rects) {
    ctx.fillStyle = EGA[r.color]!;
    ctx.fillRect(r.x, r.y, r.w, r.h);
  }
}

// ── Placeholder geométrico (sin pack, ?dungpack=off) ─────────────────────────
// Cuñas planas EGA con la MISMA geometría de anillos que el compositor, para que
// la auditoría vea el esqueleto sin las rodajas.

function ringBox(depth: number): { l: number; r: number; top: number; bot: number } {
  const l = SIDE_X.left[depth]!;
  const r = SIDE_X.right[depth]! + (depth === 0 ? 24 : 0); // near abarca hasta el borde
  const top = SLICE_Y + depth * 18;
  const bot = SLICE_Y + 164 - depth * 18;
  return { l, r, top, bot };
}

function drawSidePlaceholder(
  ctx: CanvasRenderingContext2D,
  depth: number,
  side: "left" | "right",
  wall: boolean,
): void {
  const near = ringBox(depth);
  const far = ringBox(Math.min(depth + 1, 3));
  const nx = side === "left" ? near.l : near.r;
  const fx = side === "left" ? far.l : far.r;
  ctx.beginPath();
  ctx.moveTo(nx, near.top);
  ctx.lineTo(fx, far.top);
  ctx.lineTo(fx, far.bot);
  ctx.lineTo(nx, near.bot);
  ctx.closePath();
  ctx.fillStyle = wall ? (side === "left" ? EGA[8] : EGA[7]) : EGA[0];
  ctx.fill();
  ctx.strokeStyle = EGA[0];
  ctx.lineWidth = 1;
  ctx.stroke();
}

function drawFrontPlaceholder(ctx: CanvasRenderingContext2D, depth: number, door: boolean): void {
  const far = ringBox(Math.min(depth + 1, 3));
  ctx.fillStyle = EGA[7];
  ctx.fillRect(far.l, far.top, far.r - far.l, far.bot - far.top);
  ctx.strokeStyle = EGA[0];
  ctx.strokeRect(far.l, far.top, far.r - far.l, far.bot - far.top);
  if (door) {
    const dw = (far.r - far.l) * 0.4;
    const dh = (far.bot - far.top) * 0.62;
    ctx.fillStyle = EGA[6];
    ctx.fillRect((far.l + far.r) / 2 - dw / 2, far.bot - dh, dw, dh);
  }
}

// ── Features (escaleras/fuentes/trampas/cofres) — imágenes NATIVAS de ITEMS.16 ─
// Modelo CALCADO de `fn_1952` @DUNGEON:0x1952 + `dng_blit_piece` @0x134A (rama
// feature, pieceCode ≥ 0x1f), verificado instrucción a instrucción (careo
// decor-mazmorra wf_8648a9bf + re-disasm 2026-07-25):
//
//   pieceCode = base[kind] + si·2  →  imagen = (pieceCode+1)>>1 − 16 = imgBase + si
//   con si = profundidad 0..3 (¡la imagen si a la distancia si, SIN off-by-one!).
//
// Cada kind tiene hasta DOS bloques (tablas DATA.OVL, DS+0x10, byte por kind):
//   • 0x2f16[kind] = base del bloque VOLTEADO-V (side=1 del blit): sólo escalera-
//     ARRIBA — kind 1 y kind 3 = 0x1f → imgs 0-3. Se dibuja PRIMERO (0x1984).
//   • 0x2f1e[kind] = base del bloque normal (side=0): escalera-abajo/kind 3 =
//     0x1f→0-3, cofre 0x37→12-15, fuente 0x27→4-7, trampa 0x2f→8-11, cofre
//     abierto 0x3f→16-19. Se dibuja después (0x19ae).
// LadderUpDown (kind 3) lleva AMBOS bloques (up volteado + down sin voltear).
// Trampa (kind 6): sólo se dibuja con (tile&7)==0 (fn_1952 @0x197b).
/** Base de imagen del bloque VOLTEADO (escalera-arriba), por kind (0x2f16). */
const FEAT_UP_IMG_BASE: Partial<Record<number, number>> = {
  [T.LadderUp]: 0,
  [T.LadderUpDown]: 0,
};
/** Base de imagen del bloque normal, por kind (0x2f1e). */
const FEAT_IMG_BASE: Partial<Record<number, number>> = {
  [T.LadderDown]: 0,
  [T.LadderUpDown]: 0,
  [T.Chest]: 12,
  [T.Fountain]: 4,
  [T.Trap]: 8,
  [T.OpenChest]: 16,
};

// Anclaje del blit (dng_blit_piece @0x134A, rama feature 0x13c6-0x1452):
//   X: mitad normal en 0x2e72[si] = [56,72,80,88] = 96−w; espejo-H ABUTTED en
//      X=0x60=96 (0x13e6). NADA de solape w/2 (§8c revertido: era compensación
//      del off-by-one de profundidad).
//   Y: vflip (side=1, img<8) → 0x2e82[si]; side=0 con img≥8 → 0x2e7a[si];
//      side=0 con img<8 → 0x60=96 constante (0x13fa-0x1428).
//   • Escalera-arriba (VOLTEADA verticalmente, 0x140b): tope = 0x2e82[si] =
//     [15,39,71,87] → base fija en y=95 y la placa-trampilla queda ARRIBA
//     (careo p19-0720: placa y=17-28, raíles x=75-79/112-116, base y≈95).
const FEAT_Y_LADDER_UP = [15, 39, 71, 87] as const;
//   • Trampa/cofres (img≥8, objetos BAJOS): 0x2e7a[si] = [152,120,104,96].
const FEAT_Y_FLOOR = [152, 120, 104, 96] as const;
//   • Fuente / escalera-abajo (img<8, side=0): tope en el horizonte y=96 (0x1412).
const FEAT_Y_TOP_HORIZON = 96;

/** Un blit de media-feature ya resuelto (para el careo y el render). */
export interface FeatureBlit {
  /** Índice de imagen 0..19 de ITEMS.16. */
  img: number;
  /** X de pantalla del borde izquierdo del blit. */
  x: number;
  /** Y de pantalla del tope del blit. */
  yTop: number;
  w: number;
  h: number;
  /** Mitad derecha espejada horizontalmente (blit 0x8a2c). */
  mirror: boolean;
  /** Bloque escalera-arriba: volteado verticalmente (5º arg de 0x8b7c/0x8a2c). */
  vflip: boolean;
}

/**
 * PLAN de blits de una feature a profundidad `si` (0..3): la lista determinista
 * de medias-imágenes que el original blitea (fn_1952 → dng_blit_piece). PURO y
 * exportado para test; `drawContents` sólo lo renderiza. Devuelve [] si el kind
 * no tiene arte en ITEMS.16 (MagicField va por primitiva aparte) o si la trampa
 * está gateada por (sub&7)!=0.
 */
export function featureBlits(
  cellType: number,
  sub: number,
  depth: number,
  rects: readonly (AtlasRect | null)[],
): FeatureBlit[] {
  const si = Math.min(Math.max(depth, 0), 3);
  // Trampa: fn_1952 @0x197b sólo la dibuja con los 3 bits bajos del tile a 0.
  if (cellType === T.Trap && (sub & 7) !== 0) return [];
  const out: FeatureBlit[] = [];
  const pushPair = (imgBase: number, vflip: boolean): void => {
    const img = imgBase + si;
    const r = rects[img];
    if (!r) return;
    const yTop = vflip
      ? FEAT_Y_LADDER_UP[si]!
      : img >= 8
        ? FEAT_Y_FLOOR[si]!
        : FEAT_Y_TOP_HORIZON;
    out.push({ img, x: CENTER_X - r.w, yTop, w: r.w, h: r.h, mirror: false, vflip });
    out.push({ img, x: CENTER_X, yTop, w: r.w, h: r.h, mirror: true, vflip });
  };
  const up = FEAT_UP_IMG_BASE[cellType];
  if (up !== undefined) pushPair(up, true);
  const normal = FEAT_IMG_BASE[cellType];
  if (normal !== undefined) pushPair(normal, false);
  return out;
}

/** Caja de la celda a profundidad d (para la primitiva de reserva). */
function featureBox(depth: number): { cx: number; floorY: number; s: number } {
  const innerL = [40, 72, 88, 96][depth]!;
  const innerR = [152, 120, 104, 96][depth]!;
  const w = Math.max(8, innerR - innerL);
  const floorY = [150, 122, 106, 98][depth]!;
  return { cx: CENTER_X, floorY, s: w };
}

function drawContents(
  ctx: CanvasRenderingContext2D,
  feat: FeatureOp,
  featPack?: DungeonFeatPack | null,
  decor?: DungeonDecorState | null,
): void {
  // El campo mágico NO tiene arte en ITEMS.16: es el subsistema de CHISPAS
  // 0x127e (tablas y derivación en dungeon-decor.ts). Sin estado de decorado
  // —packless, tests deterministas— cae a la primitiva de abajo.
  if (feat.cellType === T.MagicField && decor) {
    paintDecorRects(ctx, decor.fieldSparks(feat.depth, feat.sub));
    return;
  }
  // Imágenes nativas de ITEMS.16: por bloque, mitad normal en 96−w + espejo-H
  // ABUTTED en 96; escalera-arriba VOLTEADA-V con la base en y=95 (tablas y citas
  // arriba). La transparencia viene horneada en el alpha del atlas (máscara AND).
  if (featPack && feat.cellType !== T.MagicField) {
    const blits = featureBlits(feat.cellType, feat.sub, feat.depth, featPack.rects);
    for (const b of blits) {
      const r = featPack.rects[b.img]!;
      if (!b.mirror && !b.vflip) {
        ctx.drawImage(featPack.image, r.x, r.y, r.w, r.h, b.x, b.yTop, r.w, r.h);
        continue;
      }
      ctx.save();
      ctx.translate(b.mirror ? b.x + r.w : b.x, b.vflip ? b.yTop + r.h : b.yTop);
      ctx.scale(b.mirror ? -1 : 1, b.vflip ? -1 : 1);
      ctx.drawImage(featPack.image, r.x, r.y, r.w, r.h, 0, 0, r.w, r.h);
      ctx.restore();
    }
    return;
  }
  // Reserva: primitiva escalada (sin pack de features, o campo mágico sin estado
  // de decorado — las chispas de 0x127e las pinta la rama de arriba).
  const { cx, floorY, s } = featureBox(feat.depth);
  ctx.lineWidth = 1;
  switch (feat.cellType) {
    case T.LadderUp:
    case T.LadderDown:
    case T.LadderUpDown: {
      ctx.strokeStyle = EGA[14];
      const h = s * 0.9;
      const top = floorY - h;
      for (const dx of [-s / 8, s / 8]) {
        ctx.beginPath();
        ctx.moveTo(cx + dx, floorY);
        ctx.lineTo(cx + dx, top);
        ctx.stroke();
      }
      for (let i = 0; i <= 4; i++) {
        const y = top + (h * i) / 4;
        ctx.beginPath();
        ctx.moveTo(cx - s / 8, y);
        ctx.lineTo(cx + s / 8, y);
        ctx.stroke();
      }
      break;
    }
    case T.Chest:
    case T.OpenChest: {
      ctx.fillStyle = feat.cellType === T.Chest ? EGA[6] : EGA[8];
      ctx.fillRect(cx - s / 6, floorY - s * 0.28, s / 3, s * 0.28);
      break;
    }
    case T.Fountain: {
      ctx.strokeStyle = EGA[11];
      ctx.beginPath();
      ctx.ellipse(cx, floorY - s * 0.1, s * 0.2, s * 0.08, 0, 0, Math.PI * 2);
      ctx.stroke();
      break;
    }
    case T.MagicField: {
      const fieldCol = [EGA[13], EGA[10], EGA[12], EGA[11]][feat.sub & 0x3] ?? EGA[13];
      ctx.strokeStyle = fieldCol;
      ctx.strokeRect(cx - s / 4, floorY - s * 0.5, s / 2, s * 0.5);
      break;
    }
    default:
      break;
  }
}

