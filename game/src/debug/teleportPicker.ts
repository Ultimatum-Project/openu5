/**
 * SELECTOR DE MAPA (point-and-click) del teletransporte de depuración.
 *
 * Modal grande centrado (más usable que embutir el mapa en el drawer de 360 px) que
 * ofrece TRES pestañas de destino — Overworld / Ciudades y castillos / Mazmorras —
 * cada una con su mapa renderizado del DATO VIVO del core (nunca de JSONs stale):
 *   · Overworld: 256×256 con zoom (rueda) + pan (arrastre) + doble-click (acercar).
 *     Capa Britannia/Underworld. Pinta con `defaultTileColor` (la misma del minimapa).
 *   · Ciudad/castillo: `getActiveMap(world,loc,floor).tileAt` (la MISMA fuente que usa
 *     el juego) → retícula 32×32. Selector de planta si la localización tiene varias.
 *   · Mazmorra: planta COMPLETA 8×8 (sin flood — es herramienta de debug) con el
 *     lenguaje visual de la gema (muro=bloque blanco, sala=caja amarilla, escalera=H…),
 *     tabla derivada de `skin/fiel/gemmap.ts`. 8 pestañas de planta.
 *
 * Un CLICK (o un input numérico x,y + Enter) teletransporta a esa celda exacta vía la
 * fachada cero-mutación (`DebugApi`): overworld→`teleportOverworld`, ciudad→
 * `teleportSmallMap`, mazmorra→`teleportDungeon`. La celda de la party se marca; el
 * hover muestra (x,y) + nombre de tile (y en mazmorra el subtipo, p.ej. «Room #8»). Si
 * el destino es muro/impasable avisa PERO permite (es debug). Recuerda el último destino
 * (localStorage). Todo el chrome pasa por `ts()` (capa shell, no es.json).
 *
 * ESC cierra el modal SIN llegar al juego (captura en la raíz, patrón del drawer:
 * stopPropagation salvo para dejar tipear en sus propios inputs).
 */
import { defaultTileColor } from "../core/tile-colors.js";
import { TILE_INFO } from "../core/tiles.js";
import { CellType, dungeonCellAt, DungeonState } from "../core/dungeon/dungeon.js";
import type { DungeonData } from "../core/dungeon/dungeon.js";
import {
  buildGemView,
  DUNGEON_GEM_DISPLAY,
  DUNGEON_GEM_CENTER,
  DUNGEON_VIEW_SIZE,
} from "../core/world/gem-view.js";
import { getActiveMap, LARGE_MAP_SIZE, SMALL_MAP_SIZE, type WorldData } from "../core/world/map.js";
import { UNDERWORLD_FLOOR, type DebugApi } from "./debugApi.js";
import { ts } from "../i18n/shell.js";

const STYLE_ID = "u5dbg-telepicker-style";
const LS_KEY = "u5dbg-teleport-last";
/** Lado en px del marco del mapa (cuadrado). Fijo: math de zoom/pan estable. */
const FRAME = 460;

type Mode = "overworld" | "town" | "dungeon";

/** Último destino recordado (localStorage). */
interface LastDest {
  mode: Mode;
  id: number; // town: location; dungeon: location; overworld: 0=Britannia, 0xFF=Underworld
  floor: number;
  x: number;
  y: number;
}

// Paleta EGA 16: fuente única compartida (skin/fiel/ega.ts, auditoría D2).
import { EGA_PALETTE as EGA } from "../skin/fiel/ega.js";
import { escapeHtml } from "../core/escape-html.js";

/**
 * COLOR de relleno por tipo de celda de mazmorra (índice EGA), CALCADO de la fuente de
 * verdad `DUNGEON_GEM_FILL` de skin/fiel/gemmap.ts — NO se importa en runtime (el módulo
 * debug no cruza a la capa skin), se replica con cita y `picker-gemmap-parity.test.ts`
 * asevera que coincide byte a byte para que no divergan. `null` = el original NO pinta la
 * celda (pasillo 0x0, cofre-abierto 0x7, marcador 0x9) → NEGRO, como el gem.
 */
export const DUNGEON_FILL: Readonly<Record<number, number | null>> = {
  0x0: null, // pasillo → negro
  0x1: 0x7, 0x2: 0x7, 0x3: 0x7, // escaleras gris
  0x4: 0xe, // cofre amarillo
  0x5: 0x9, // fuente azul brillante
  0x6: 0xc, // trampa rojo brillante
  0x7: null, // cofre abierto → negro
  0x8: 0xd, // campo mágico (multicolor; primer color representativo)
  0x9: null, // marcador → negro
  0xa: 0xe, // sala amarillo
  0xb: 0xf, // muro BLANCO MACIZO
  0xc: 0x1, // muro especial azul
  0xd: 0x1, // secreta azul
  0xe: 0xe, // puerta amarillo
  0xf: 0xe, // sala amarillo
};

/**
 * GLIFO (forma) que el picker dibuja por tipo, equivalente al glifo RUNES que pinta el gem
 * (gemmap.ts): muro=bloque, sala=CAJA hueca (RUNES 0x73), escalera=«H» (0x2e/2d/2f),
 * cofre=relleno (0x70), puerta=barra (0x77), fuente=rombo, trampa=aspa, campo=franjas,
 * secreta=recuadro (0x76). `null` = no se pinta (== DUNGEON_FILL null). La paridad de
 * PRESENCIA (qué tipos llevan glifo) la asevera picker-gemmap-parity.test.ts contra el gem;
 * este mapa fija además QUÉ forma por tipo para que no se cambie por descuido.
 */
export type GlyphKind =
  | "wallBlock" | "roomBox" | "ladderH" | "chestFill" | "doorBar"
  | "fountainDiamond" | "trapCross" | "fieldStripes" | "secretInset";
export const DUNGEON_GLYPH_KIND: Readonly<Record<number, GlyphKind | null>> = {
  0x0: null,
  0x1: "ladderH", 0x2: "ladderH", 0x3: "ladderH",
  0x4: "chestFill",
  0x5: "fountainDiamond",
  0x6: "trapCross",
  0x7: null,
  0x8: "fieldStripes",
  0x9: null,
  0xa: "roomBox",
  0xb: "wallBlock",
  0xc: "wallBlock", // muro especial = bloque (azul)
  0xd: "secretInset",
  0xe: "doorBar",
  0xf: "roomBox",
};

/** Etiqueta legible por tipo de celda de mazmorra (base inglesa → ts()). */
const DUNGEON_TYPE_LABEL: Record<number, string> = {
  [CellType.Nothing]: "Corridor",
  [CellType.LadderUp]: "Ladder up",
  [CellType.LadderDown]: "Ladder down",
  [CellType.LadderUpDown]: "Ladder up/down",
  [CellType.Chest]: "Chest",
  [CellType.Fountain]: "Fountain",
  [CellType.Trap]: "Trap",
  [CellType.OpenChest]: "Open chest",
  [CellType.MagicField]: "Magic field",
  [CellType.Marker]: "Marker",
  [CellType.RoomsBroke]: "Room (cleared)",
  [CellType.Wall]: "Wall",
  [CellType.SpecialWall]: "Special wall",
  [CellType.SecretDoor]: "Secret door",
  [CellType.NormalDoor]: "Door",
  [CellType.Room]: "Room",
};
const FOUNTAIN_SUB = ["Cure poison", "Heal", "Poison", "Bad taste"];
const TRAP_SUB = ["Pit", "Pit fall", "Bomb"];
const FIELD_SUB = ["Sleep", "Poison", "Flame", "Energy"];

/** Nibble alto que bloquea el paso (misma regla que DungeonState.isPassable). */
const DUNGEON_IMPASSABLE = new Set<number>([CellType.Wall, CellType.SpecialWall, CellType.SecretDoor]);

const CSS = `
.u5tp-backdrop{position:fixed;inset:0;z-index:100000;background:rgba(0,0,0,.55);
  display:flex;align-items:center;justify-content:center;font:12px/1.45 ui-monospace,SFMono-Regular,Menlo,monospace}
.u5tp-card{background:#14161b;color:#c8ccd4;border:1px solid #2a2f3a;border-radius:8px;
  box-shadow:0 12px 48px rgba(0,0,0,.6);max-width:96vw;max-height:94vh;overflow:auto;
  display:flex;flex-direction:column}
.u5tp-head{display:flex;align-items:center;gap:8px;padding:9px 12px;border-bottom:1px solid #2a2f3a;background:#1b1e26}
.u5tp-title{font-weight:700;letter-spacing:.04em;color:#e6e9ef;flex:1}
.u5tp-close{cursor:pointer;background:#232734;border:1px solid #2f3542;color:#c8ccd4;border-radius:4px;padding:2px 9px}
.u5tp-close:hover{background:#2c3140}
.u5tp-tabs{display:flex;gap:4px;padding:8px 12px 0}
.u5tp-tab{cursor:pointer;background:#1b1e26;border:1px solid #2a2f3a;color:#aeb4c0;border-radius:5px 5px 0 0;padding:5px 12px}
.u5tp-tab:hover{background:#20242e}
.u5tp-tab.active{background:#14161b;color:#e6e9ef;border-bottom-color:#14161b;font-weight:600}
.u5tp-body{display:flex;gap:12px;padding:12px}
.u5tp-frame{position:relative;width:${FRAME}px;height:${FRAME}px;flex:0 0 auto;
  border:1px solid #2a2f3a;background:#000;overflow:hidden;cursor:crosshair;touch-action:none}
.u5tp-inner{position:absolute;top:0;left:0;transform-origin:0 0}
.u5tp-inner canvas{display:block;image-rendering:pixelated}
.u5tp-marker{position:absolute;pointer-events:none;transform:translate(-50%,-50%)}
.u5tp-marker.party{width:9px;height:9px;border:2px solid #55ff55;border-radius:50%;
  box-shadow:0 0 0 1px #000;animation:u5tpblink 1s steps(2) infinite}
.u5tp-marker.dest{width:11px;height:11px;border:2px solid #ff4d4d;box-shadow:0 0 0 1px #000}
@keyframes u5tpblink{50%{opacity:.3}}
.u5tp-side{flex:1 1 auto;min-width:220px;display:flex;flex-direction:column;gap:9px}
.u5tp-row{display:flex;align-items:center;gap:6px;flex-wrap:wrap}
.u5tp-row label{color:#8b93a3}
.u5tp-side select,.u5tp-side input[type=number]{background:#0f1116;border:1px solid #2a2f3a;color:#e6e9ef;
  border-radius:4px;padding:4px 6px;font:inherit}
.u5tp-side input[type=number]{width:64px}
.u5tp-floors{display:flex;gap:3px;flex-wrap:wrap}
.u5tp-floor{cursor:pointer;background:#1b1e26;border:1px solid #2a2f3a;color:#aeb4c0;border-radius:4px;
  padding:3px 8px;min-width:26px;text-align:center}
.u5tp-floor:hover{background:#20242e}
.u5tp-floor.active{background:#2d5cff33;border-color:#3358d4;color:#c9d6ff;font-weight:600}
.u5tp-hover{color:#c8ccd4;background:#0f1116;border:1px solid #2a2f3a;border-radius:5px;padding:6px 8px;min-height:2.6em}
.u5tp-hover .coord{color:#e6e9ef;font-weight:600}
.u5tp-hover .tile{color:#9aa3b2}
.u5tp-warn{color:#ffd166;min-height:1.3em}
.u5tp-go{background:#2d5cff22;border:1px solid #3358d4;color:#c9d6ff;border-radius:5px;padding:6px 12px;cursor:pointer;font:inherit}
.u5tp-go:hover{background:#2d5cff44}
.u5tp-last{color:#727a8a;font-size:11px}
.u5tp-last a{color:#9aa3b2;cursor:pointer;text-decoration:underline}
.u5tp-hint{color:#727a8a;font-size:11px}
`;

function injectStyle(): void {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = CSS;
  document.head.appendChild(style);
}

function loadLast(): LastDest | null {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return null;
    const v = JSON.parse(raw) as LastDest;
    if (v && typeof v.x === "number" && typeof v.y === "number") return v;
  } catch {
    /* almacenamiento no disponible o JSON corrupto: sin último destino */
  }
  return null;
}
function saveLast(d: LastDest): void {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(d));
  } catch {
    /* almacenamiento lleno/no disponible: el recuerdo es best-effort */
  }
}

/**
 * Vista de mapa con zoom/pan y marcadores. Reutilizable por las tres pestañas: se
 * (re)configura con el lado lógico (celdas/lado), el tamaño de celda en px del canvas
 * fuente, y una fn que pinta el canvas. Traduce puntero↔celda y coloca los marcadores
 * de party/destino (posicionados en px-fuente dentro del `inner` transformado).
 */
class MapView {
  readonly frame = document.createElement("div");
  private readonly inner = document.createElement("div");
  private readonly canvas = document.createElement("canvas");
  private readonly partyMarker = document.createElement("div");
  private readonly destMarker = document.createElement("div");
  private size = 1; // celdas por lado
  private cellPx = 1; // px de canvas por celda
  private scale = 1; // px de pantalla por px-fuente
  private tx = 0;
  private ty = 0;
  private allowZoom = true;
  private dragging = false;
  private dragMoved = false;
  private lastX = 0;
  private lastY = 0;
  private clickTimer: number | null = null;
  onPick: (x: number, y: number) => void = () => {};
  onHover: (x: number, y: number) => void = () => {};
  onLeave: () => void = () => {};

  constructor() {
    this.frame.className = "u5tp-frame";
    this.inner.className = "u5tp-inner";
    this.partyMarker.className = "u5tp-marker party";
    this.destMarker.className = "u5tp-marker dest";
    this.partyMarker.style.display = "none";
    this.destMarker.style.display = "none";
    this.inner.append(this.canvas, this.partyMarker, this.destMarker);
    this.frame.appendChild(this.inner);
    this.wire();
  }

  /** (Re)configura la fuente. `keepView` conserva zoom/pan (p.ej. cambio de planta). */
  configure(opts: {
    size: number;
    cellPx: number;
    allowZoom: boolean;
    paint: (ctx: CanvasRenderingContext2D, cellPx: number) => void;
    keepView?: boolean;
  }): void {
    const sizeChanged = opts.size !== this.size || opts.cellPx !== this.cellPx;
    this.size = opts.size;
    this.cellPx = opts.cellPx;
    this.allowZoom = opts.allowZoom;
    const srcPx = this.size * this.cellPx;
    this.canvas.width = srcPx;
    this.canvas.height = srcPx;
    this.canvas.style.width = `${srcPx}px`;
    this.canvas.style.height = `${srcPx}px`;
    this.inner.style.width = `${srcPx}px`;
    this.inner.style.height = `${srcPx}px`;
    const ctx = this.canvas.getContext("2d");
    if (ctx) {
      ctx.clearRect(0, 0, srcPx, srcPx);
      opts.paint(ctx, this.cellPx);
    }
    if (!opts.keepView || sizeChanged) this.fit();
    else this.applyTransform();
  }

  /** Encaja el mapa en el marco (centrado). */
  private fit(): void {
    const srcPx = this.size * this.cellPx;
    this.scale = FRAME / srcPx;
    this.tx = 0;
    this.ty = 0;
    this.applyTransform();
  }

  private applyTransform(): void {
    this.inner.style.transform = `translate(${this.tx}px,${this.ty}px) scale(${this.scale})`;
  }

  private cellFromClient(clientX: number, clientY: number): { x: number; y: number } {
    const r = this.frame.getBoundingClientRect();
    const sx = (clientX - r.left - this.tx) / this.scale;
    const sy = (clientY - r.top - this.ty) / this.scale;
    const x = Math.floor(sx / this.cellPx);
    const y = Math.floor(sy / this.cellPx);
    return {
      x: Math.max(0, Math.min(this.size - 1, x)),
      y: Math.max(0, Math.min(this.size - 1, y)),
    };
  }

  private zoomAt(clientX: number, clientY: number, factor: number): void {
    if (!this.allowZoom) return;
    const r = this.frame.getBoundingClientRect();
    const fx = clientX - r.left;
    const fy = clientY - r.top;
    const sx = (fx - this.tx) / this.scale;
    const sy = (fy - this.ty) / this.scale;
    const base = FRAME / (this.size * this.cellPx);
    this.scale = Math.max(base, Math.min(base * 12, this.scale * factor));
    this.tx = fx - sx * this.scale;
    this.ty = fy - sy * this.scale;
    this.applyTransform();
  }

  private wire(): void {
    this.frame.addEventListener("wheel", (ev) => {
      if (!this.allowZoom) return;
      ev.preventDefault();
      this.zoomAt(ev.clientX, ev.clientY, ev.deltaY < 0 ? 1.15 : 1 / 1.15);
    }, { passive: false });

    this.frame.addEventListener("mousedown", (ev) => {
      this.dragging = true;
      this.dragMoved = false;
      this.lastX = ev.clientX;
      this.lastY = ev.clientY;
    });
    window.addEventListener("mousemove", (ev) => {
      if (!this.dragging) return;
      const dx = ev.clientX - this.lastX;
      const dy = ev.clientY - this.lastY;
      if (Math.abs(dx) + Math.abs(dy) > 3) this.dragMoved = true;
      // Sólo se panea si hay zoom por encima del fit (si no, no hay a dónde arrastrar).
      const base = FRAME / (this.size * this.cellPx);
      if (this.allowZoom && this.scale > base + 1e-6) {
        this.tx += dx;
        this.ty += dy;
        this.applyTransform();
      }
      this.lastX = ev.clientX;
      this.lastY = ev.clientY;
    });
    window.addEventListener("mouseup", () => {
      this.dragging = false;
    });

    this.frame.addEventListener("mousemove", (ev) => {
      const { x, y } = this.cellFromClient(ev.clientX, ev.clientY);
      this.onHover(x, y);
    });
    this.frame.addEventListener("mouseleave", () => this.onLeave());
    this.frame.addEventListener("click", (ev) => {
      if (this.dragMoved) return; // fue un pan, no un pick
      const { x, y } = this.cellFromClient(ev.clientX, ev.clientY);
      // Retrasa el pick para distinguir click SIMPLE (teleport) de DOBLE-click (zoom):
      // si llega un dblclick antes del timeout se cancela y NO teletransporta.
      if (this.clickTimer !== null) window.clearTimeout(this.clickTimer);
      this.clickTimer = window.setTimeout(() => {
        this.clickTimer = null;
        this.onPick(x, y);
      }, 220);
    });
    this.frame.addEventListener("dblclick", (ev) => {
      ev.preventDefault();
      if (this.clickTimer !== null) {
        window.clearTimeout(this.clickTimer);
        this.clickTimer = null;
      }
      this.zoomAt(ev.clientX, ev.clientY, 2);
    });
  }

  setParty(cell: { x: number; y: number } | null): void {
    if (!cell) {
      this.partyMarker.style.display = "none";
      return;
    }
    this.partyMarker.style.display = "block";
    this.partyMarker.style.left = `${(cell.x + 0.5) * this.cellPx}px`;
    this.partyMarker.style.top = `${(cell.y + 0.5) * this.cellPx}px`;
  }

  setDest(cell: { x: number; y: number } | null): void {
    if (!cell) {
      this.destMarker.style.display = "none";
      return;
    }
    this.destMarker.style.display = "block";
    this.destMarker.style.left = `${(cell.x + 0.5) * this.cellPx}px`;
    this.destMarker.style.top = `${(cell.y + 0.5) * this.cellPx}px`;
  }
}

/** Pinta un tile del mundo (overworld/small map) como celda de color. */
function paintTileCell(
  ctx: CanvasRenderingContext2D,
  px: number,
  py: number,
  cellPx: number,
  tile: number,
  grid: boolean,
): void {
  const c = defaultTileColor(tile);
  ctx.fillStyle = `#${c.toString(16).padStart(6, "0")}`;
  ctx.fillRect(px, py, cellPx, cellPx);
  if (grid && cellPx >= 6) {
    ctx.strokeStyle = "rgba(0,0,0,.35)";
    ctx.lineWidth = 1;
    ctx.strokeRect(px + 0.5, py + 0.5, cellPx - 1, cellPx - 1);
  }
}

/** Nombre de tile para el hover (TILE_INFO). */
function tileName(tile: number): string {
  return TILE_INFO[tile]?.name ?? `#${tile}`;
}

/**
 * Pinta una celda de mazmorra con el LENGUAJE VISUAL DE LA GEMA (gemmap.ts), calcado de
 * `DUNGEON_FILL` (== `DUNGEON_GEM_FILL` de gemmap, guardado por parity test):
 *  - FONDO NEGRO (como el gem); el pasillo (0x0), cofre-abierto (0x7) y marcador (0x9) NO
 *    se pintan → quedan negros, igual que el original.
 *  - MURO (0xB) y muro especial (0xC) = BLOQUE MACIZO (blanco / azul).
 *  - sala (0xA/0xF) = caja hueca amarilla; escalera «H» gris; cofre/puerta amarillos;
 *    fuente rombo azul; trampa aspa roja; campo mágico franjas; secreta azul revelada.
 * Sin retícula clara (el gem no la tiene; el hover marca la celda).
 */
function paintDungeonCell(
  ctx: CanvasRenderingContext2D,
  px: number,
  py: number,
  cellPx: number,
  type: number,
  _sub: number,
  wallVisible = true,
): void {
  ctx.fillStyle = "#000000"; // fondo NEGRO, como el gem
  ctx.fillRect(px, py, cellPx, cellPx);
  const fill = DUNGEON_FILL[type];
  if (fill == null) return; // pasillo / cofre-abierto / marcador → negro (el original no los pinta)
  const color = EGA[fill]!;
  const cx = px + cellPx / 2;
  const cy = py + cellPx / 2;
  const inset = Math.max(2, Math.floor(cellPx * 0.18));
  const stroke = Math.max(1, Math.floor(cellPx / 14));
  ctx.lineWidth = stroke;

  switch (type) {
    case CellType.Wall:
      // B1 (ruling): el muro de roca sólo es BLANCO si bordea hueco; la roca INTERIOR
      // (rodeada de muro) queda NEGRA → negro-dominante, como el gem in-game.
      if (!wallVisible) return;
      ctx.fillStyle = color; // bloque blanco macizo (IBM 0x7f)
      ctx.fillRect(px, py, cellPx, cellPx);
      break;
    case CellType.SpecialWall:
      ctx.fillStyle = color; // muro especial azul (feature, siempre visible)
      ctx.fillRect(px, py, cellPx, cellPx);
      break;
    case CellType.SecretDoor:
      ctx.fillStyle = color; // secreta revelada, azul (el gem la dibuja distinta al muro)
      ctx.fillRect(px + inset, py + inset, cellPx - 2 * inset, cellPx - 2 * inset);
      break;
    case CellType.Room:
    case CellType.RoomsBroke:
      ctx.strokeStyle = color; // caja hueca amarilla (RUNES 0x73)
      ctx.strokeRect(px + inset, py + inset, cellPx - 2 * inset, cellPx - 2 * inset);
      break;
    case CellType.LadderUp:
    case CellType.LadderDown:
    case CellType.LadderUpDown:
      paintLadder(ctx, px, py, cellPx, type, color);
      break;
    case CellType.Chest:
      ctx.fillStyle = color;
      ctx.fillRect(px + inset, py + inset, cellPx - 2 * inset, cellPx - 2 * inset);
      break;
    case CellType.NormalDoor:
      ctx.fillStyle = color;
      ctx.fillRect(cx - stroke, py + inset, stroke * 2, cellPx - 2 * inset);
      break;
    case CellType.Fountain: {
      const r = cellPx / 2 - inset;
      ctx.strokeStyle = color; // rombo azul brillante
      ctx.beginPath();
      ctx.moveTo(cx, cy - r);
      ctx.lineTo(cx + r, cy);
      ctx.lineTo(cx, cy + r);
      ctx.lineTo(cx - r, cy);
      ctx.closePath();
      ctx.stroke();
      break;
    }
    case CellType.Trap: {
      const r = cellPx / 2 - inset;
      ctx.strokeStyle = color; // aspa roja brillante
      ctx.beginPath();
      ctx.moveTo(cx - r, cy - r);
      ctx.lineTo(cx + r, cy + r);
      ctx.moveTo(cx + r, cy - r);
      ctx.lineTo(cx - r, cy + r);
      ctx.stroke();
      break;
    }
    case CellType.MagicField: {
      const stripes = [0xd, 0xc, 0x9, 0xa]; // franjas multicolor (== gemmap FIELD_STRIPES)
      const band = (cellPx - 2 * inset) / stripes.length;
      for (let i = 0; i < stripes.length; i++) {
        ctx.fillStyle = EGA[stripes[i]!]!;
        ctx.fillRect(px + inset, py + inset + Math.floor(i * band), cellPx - 2 * inset, Math.ceil(band));
      }
      break;
    }
    default:
      break;
  }
}

/**
 * Pinta una celda de mazmorra en ESTILO CLUEBOOK (pedido usuario 2026-07-21, contra el
 * escaneo del cluebook original): ROCA NEGRA, pasillos BLANCOS, glifos OSCUROS sobre el
 * blanco — figura-fondo INVERSA al gem (que es blanco-muro/negro-pasillo). Salas = ⊠
 * (caja con aspa, el símbolo del cluebook). La vista Gem del toggle conserva el lenguaje
 * fiel in-game; esta es la lámina de papel.
 */
function paintCluebookCell(
  ctx: CanvasRenderingContext2D,
  px: number,
  py: number,
  cellPx: number,
  type: number,
): void {
  ctx.fillStyle = "#000000"; // roca / fondo
  ctx.fillRect(px, py, cellPx, cellPx);
  if (type === CellType.Wall || type === CellType.SpecialWall) return; // roca negra
  // Celda transitable: papel blanco.
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(px, py, cellPx, cellPx);
  const cx = px + cellPx / 2;
  const cy = py + cellPx / 2;
  const inset = Math.max(2, Math.floor(cellPx * 0.18));
  const stroke = Math.max(1, Math.floor(cellPx / 14));
  ctx.lineWidth = stroke;
  switch (type) {
    case CellType.LadderUp:
    case CellType.LadderDown:
    case CellType.LadderUpDown:
      paintLadder(ctx, px, py, cellPx, type, "#000000"); // escalera negra sobre papel
      break;
    case CellType.Room:
    case CellType.RoomsBroke: {
      // ⊠ del cluebook: caja + aspa.
      const a = px + inset, b = py + inset, s = cellPx - 2 * inset;
      ctx.strokeStyle = "#000000";
      ctx.strokeRect(a, b, s, s);
      ctx.beginPath();
      ctx.moveTo(a, b); ctx.lineTo(a + s, b + s);
      ctx.moveTo(a + s, b); ctx.lineTo(a, b + s);
      ctx.stroke();
      break;
    }
    case CellType.SecretDoor:
      ctx.strokeStyle = "#1c6fd6"; // secreta: marco azul (revelada, es herramienta debug)
      ctx.strokeRect(px + inset, py + inset, cellPx - 2 * inset, cellPx - 2 * inset);
      break;
    case CellType.NormalDoor:
      ctx.fillStyle = "#000000";
      ctx.fillRect(cx - stroke, py + inset, stroke * 2, cellPx - 2 * inset);
      break;
    case CellType.Chest:
      ctx.fillStyle = "#b8860b";
      ctx.fillRect(px + inset, py + inset, cellPx - 2 * inset, cellPx - 2 * inset);
      break;
    case CellType.Fountain: {
      const r = cellPx / 2 - inset;
      ctx.strokeStyle = "#1c6fd6";
      ctx.beginPath();
      ctx.moveTo(cx, cy - r); ctx.lineTo(cx + r, cy); ctx.lineTo(cx, cy + r); ctx.lineTo(cx - r, cy);
      ctx.closePath();
      ctx.stroke();
      break;
    }
    case CellType.Trap: {
      const r = cellPx / 2 - inset;
      ctx.strokeStyle = "#c62828";
      ctx.beginPath();
      ctx.moveTo(cx - r, cy - r); ctx.lineTo(cx + r, cy + r);
      ctx.moveTo(cx + r, cy - r); ctx.lineTo(cx - r, cy + r);
      ctx.stroke();
      break;
    }
    case CellType.MagicField:
      ctx.fillStyle = "#7b1fa2";
      ctx.fillRect(px + inset, py + inset, cellPx - 2 * inset, cellPx - 2 * inset);
      break;
    default:
      break; // Nothing / cofre-abierto / marcador → papel blanco limpio
  }
}

/** Marcador central de la vista gem (party/semilla): rombo VERDE (RUNES 0x60, EGA 0xa). */
function paintGemCenter(ctx: CanvasRenderingContext2D, px: number, py: number, cellPx: number): void {
  const cx = px + cellPx / 2;
  const cy = py + cellPx / 2;
  const r = cellPx / 2 - 2;
  ctx.fillStyle = EGA[0xa]!; // verde brillante
  ctx.beginPath();
  ctx.moveTo(cx, cy - r);
  ctx.lineTo(cx + r, cy);
  ctx.lineTo(cx, cy + r);
  ctx.lineTo(cx - r, cy);
  ctx.closePath();
  ctx.fill();
}

/** Escalera «H» con travesaños; punta ▲/▼/⬍ según suba, baje o ambas. Color = gris del gem. */
function paintLadder(
  ctx: CanvasRenderingContext2D,
  px: number,
  py: number,
  cellPx: number,
  type: number,
  color: string,
): void {
  const inset = Math.max(2, Math.floor(cellPx * 0.22));
  const x0 = px + inset;
  const x1 = px + cellPx - inset;
  const y0 = py + inset;
  const y1 = py + cellPx - inset;
  ctx.strokeStyle = color; // gris (DUNGEON_FILL[ladder] = 0x7)
  ctx.lineWidth = Math.max(1, Math.floor(cellPx / 12));
  ctx.beginPath();
  ctx.moveTo(x0, y0); ctx.lineTo(x0, y1); // poste izq
  ctx.moveTo(x1, y0); ctx.lineTo(x1, y1); // poste dcho
  // «H con travesaños» (RUNES 0x2e/0x2d/0x2f): dos travesaños INTERIORES (no bordes)
  // → lee como una H, no como una litera de rejilla.
  for (const f of [1 / 3, 2 / 3]) {
    const ry = y0 + (y1 - y0) * f;
    ctx.moveTo(x0, ry); ctx.lineTo(x1, ry);
  }
  ctx.stroke();
  // Flecha de dirección.
  ctx.fillStyle = EGA[0xf];
  const cxp = (x0 + x1) / 2;
  const a = Math.max(2, cellPx * 0.12);
  if (type === CellType.LadderUp || type === CellType.LadderUpDown) {
    ctx.beginPath(); ctx.moveTo(cxp, y0 - a); ctx.lineTo(cxp - a, y0); ctx.lineTo(cxp + a, y0); ctx.closePath(); ctx.fill();
  }
  if (type === CellType.LadderDown || type === CellType.LadderUpDown) {
    ctx.beginPath(); ctx.moveTo(cxp, y1 + a); ctx.lineTo(cxp - a, y1); ctx.lineTo(cxp + a, y1); ctx.closePath(); ctx.fill();
  }
}

/** Etiqueta de hover de una celda de mazmorra: tipo + subtipo legible. */
function dungeonCellLabel(type: number, sub: number): string {
  const base = ts(DUNGEON_TYPE_LABEL[type] ?? `type 0x${type.toString(16)}`);
  if (type === CellType.Fountain && FOUNTAIN_SUB[sub & 7]) return `${base} · ${ts(FOUNTAIN_SUB[sub & 7]!)}`;
  if (type === CellType.Trap && TRAP_SUB[sub & 7]) return `${base} · ${ts(TRAP_SUB[sub & 7]!)}`;
  if (type === CellType.MagicField && FIELD_SUB[sub & 7]) return `${base} · ${ts(FIELD_SUB[sub & 7]!)}`;
  if ((type === CellType.Room || type === CellType.RoomsBroke) && sub) return `${base} #${sub}`;
  if (sub) return `${base} (sub ${sub})`;
  return base;
}

/**
 * Abre (o reenfoca) el selector de mapa. Singleton: una sola instancia viva; reabrir
 * la reutiliza. `world` es el dato de mundo del core (mismo que usa el juego).
 */
let SINGLETON: TeleportPicker | null = null;
export function openTeleportPicker(api: DebugApi, world: WorldData): void {
  if (!SINGLETON) SINGLETON = new TeleportPicker(api, world);
  SINGLETON.open();
}

class TeleportPicker {
  private readonly backdrop = document.createElement("div");
  private readonly card = document.createElement("div");
  private readonly map = new MapView();
  private readonly tabsEl = document.createElement("div");
  private readonly controlsEl = document.createElement("div");
  private readonly hoverEl = document.createElement("div");
  private readonly warnEl = document.createElement("div");
  private readonly lastEl = document.createElement("div");
  private readonly xInput = document.createElement("input");
  private readonly yInput = document.createElement("input");

  private mode: Mode = "overworld";
  private overUnder = false; // capa overworld: false=Britannia, true=Underworld
  private town = 0; // location del small map seleccionado
  private townFloor = 0;
  private dungeon = 0; // location de mazmorra seleccionada
  private dungeonFloor = 0;
  /** Vista de mazmorra: "gem" = display 22×22 embaldosado+flood (como el juego); "full" = planta 8×8.
   * Default FULL (pedido del usuario 2026-07-21): el teleport es herramienta de debug y debe
   * enseñar la planta ENTERA estilo cluebook (el gem fiel solo muestra lo conectado a tus pasillos). */
  private dungeonView: "gem" | "full" = "full";
  /** Celda-semilla del flood del gem (party si está en esta planta, si no la escalera-up). null en full. */
  private gemSeed: { x: number; y: number } | null = null;
  private dest: { x: number; y: number } | null = null;

  constructor(private api: DebugApi, private world: WorldData) {
    injectStyle();
    this.build();
    this.map.onHover = (x, y) => this.onHover(x, y);
    this.map.onLeave = () => this.clearHover();
    this.map.onPick = (x, y) => this.pick(x, y);
  }

  private build(): void {
    this.backdrop.className = "u5tp-backdrop";
    this.backdrop.setAttribute("data-testid", "u5-teleport-picker");
    this.card.className = "u5tp-card";

    const head = document.createElement("div");
    head.className = "u5tp-head";
    const title = document.createElement("span");
    title.className = "u5tp-title";
    title.textContent = ts("Teleport map");
    const close = document.createElement("button");
    close.className = "u5tp-close";
    close.textContent = "esc";
    close.setAttribute("data-testid", "u5-teleport-picker-close");
    close.addEventListener("click", () => this.close());
    head.append(title, close);

    this.tabsEl.className = "u5tp-tabs";

    const body = document.createElement("div");
    body.className = "u5tp-body";
    const side = document.createElement("div");
    side.className = "u5tp-side";

    this.controlsEl.className = "u5tp-controls";
    this.hoverEl.className = "u5tp-hover";
    this.warnEl.className = "u5tp-warn";

    // Input numérico de precisión (x,y) + Ir.
    const coordRow = document.createElement("div");
    coordRow.className = "u5tp-row";
    const xl = document.createElement("label"); xl.textContent = "x";
    const yl = document.createElement("label"); yl.textContent = "y";
    this.xInput.type = "number"; this.xInput.min = "0"; this.xInput.setAttribute("data-testid", "u5-teleport-x");
    this.yInput.type = "number"; this.yInput.min = "0"; this.yInput.setAttribute("data-testid", "u5-teleport-y");
    const go = document.createElement("button");
    go.className = "u5tp-go";
    go.textContent = ts("Go");
    go.setAttribute("data-testid", "u5-teleport-go");
    const goFromInputs = (): void => {
      const x = Number(this.xInput.value);
      const y = Number(this.yInput.value);
      if (!Number.isFinite(x) || !Number.isFinite(y)) return;
      const fx = Math.floor(x), fy = Math.floor(y);
      // Los inputs son SIEMPRE coord de PLANTA en mazmorra → teleport directo (sin la
      // traducción display→planta de `pick`, que es para clicks de la vista gem).
      if (this.mode === "dungeon") this.teleportDungeonFloorDirect(fx, fy);
      else this.pick(fx, fy);
    };
    go.addEventListener("click", goFromInputs);
    for (const inp of [this.xInput, this.yInput]) {
      inp.addEventListener("keydown", (ev) => {
        if (ev.key === "Enter") { ev.preventDefault(); goFromInputs(); }
      });
      inp.addEventListener("input", () => {
        const x = Number(this.xInput.value);
        const y = Number(this.yInput.value);
        if (Number.isFinite(x) && Number.isFinite(y)) this.previewDest(Math.floor(x), Math.floor(y));
      });
    }
    coordRow.append(xl, this.xInput, yl, this.yInput, go);

    const hint = document.createElement("div");
    hint.className = "u5tp-hint";
    hint.textContent = ts("Wheel = zoom · drag = pan · double-click = zoom in · click a cell = teleport");

    this.lastEl.className = "u5tp-last";

    side.append(this.controlsEl, this.hoverEl, coordRow, this.warnEl, hint, this.lastEl);
    body.append(this.map.frame, side);

    this.card.append(head, this.tabsEl, body);
    this.backdrop.appendChild(this.card);

    // Cierre por backdrop (fuera de la tarjeta).
    this.backdrop.addEventListener("mousedown", (ev) => {
      if (ev.target === this.backdrop) this.close();
    });
    // ESC cierra SIN llegar al juego; el resto de teclas no burbujean al window (patrón
    // del drawer). Los inputs propios siguen recibiendo sus eventos (esto es bubble).
    this.backdrop.addEventListener("keydown", (ev) => {
      if (ev.key === "Escape") {
        ev.preventDefault();
        ev.stopPropagation();
        this.close();
        return;
      }
      ev.stopPropagation();
    });

    this.buildTabs();
  }

  private buildTabs(): void {
    this.tabsEl.replaceChildren();
    const dungeons = this.api.game.dungeons ?? [];
    const defs: { mode: Mode; label: string; enabled: boolean }[] = [
      { mode: "overworld", label: ts("Overworld"), enabled: true },
      { mode: "town", label: ts("Cities & castles"), enabled: this.world.smallMaps.size > 0 },
      { mode: "dungeon", label: ts("Dungeons"), enabled: dungeons.length > 0 },
    ];
    for (const d of defs) {
      const t = document.createElement("div");
      t.className = "u5tp-tab" + (this.mode === d.mode ? " active" : "");
      t.textContent = d.label;
      t.setAttribute("data-testid", `u5-teleport-tab-${d.mode}`);
      if (!d.enabled) {
        t.style.opacity = "0.4";
        t.style.pointerEvents = "none";
      } else {
        t.addEventListener("click", () => {
          this.mode = d.mode;
          this.dest = null;
          this.buildTabs();
          this.render();
        });
      }
      this.tabsEl.appendChild(t);
    }
  }

  /** Rellena controles + mapa según la pestaña activa. */
  private render(): void {
    this.controlsEl.replaceChildren();
    this.warnEl.textContent = "";
    if (this.mode === "overworld") this.renderOverworld();
    else if (this.mode === "town") this.renderTown();
    else this.renderDungeon();
    this.renderLast();
    this.refreshMarkers();
  }

  // ── Overworld ──────────────────────────────────────────────────────────────
  private renderOverworld(): void {
    const row = document.createElement("div");
    row.className = "u5tp-row";
    const label = document.createElement("label");
    label.textContent = ts("Layer");
    const sel = document.createElement("select");
    sel.innerHTML =
      `<option value="over">${ts("Britannia (overworld)")}</option>` +
      `<option value="under">${ts("Underworld")}</option>`;
    sel.value = this.overUnder ? "under" : "over";
    sel.setAttribute("data-testid", "u5-teleport-layer");
    sel.addEventListener("change", () => {
      this.overUnder = sel.value === "under";
      this.dest = null;
      this.render();
    });
    row.append(label, sel);
    this.controlsEl.appendChild(row);

    const tiles = this.overUnder ? this.world.underworld : this.world.overworld;
    this.map.configure({
      size: LARGE_MAP_SIZE,
      cellPx: 1,
      allowZoom: true,
      paint: (ctx) => {
        for (let y = 0; y < LARGE_MAP_SIZE; y++) {
          const rowT = tiles[y];
          if (!rowT) continue;
          for (let x = 0; x < LARGE_MAP_SIZE; x++) {
            const t = rowT[x];
            if (t === undefined) continue;
            paintTileCell(ctx, x, y, 1, t, false);
          }
        }
      },
    });
  }

  // ── Ciudades y castillos ─────────────────────────────────────────────────────
  private renderTown(): void {
    const locs = [...this.world.smallMaps.entries()].sort((a, b) => a[0] - b[0]);
    if (!this.town || !this.world.smallMaps.has(this.town)) this.town = locs[0]?.[0] ?? 0;

    const row = document.createElement("div");
    row.className = "u5tp-row";
    const label = document.createElement("label");
    label.textContent = ts("Location");
    const sel = document.createElement("select");
    sel.setAttribute("data-testid", "u5-teleport-location");
    for (const [id, loc] of locs) {
      const o = document.createElement("option");
      o.value = String(id);
      o.textContent = `${id}: ${loc.name}`;
      sel.appendChild(o);
    }
    sel.value = String(this.town);
    sel.addEventListener("change", () => {
      this.town = Number(sel.value);
      this.townFloor = 0;
      this.dest = null;
      this.render();
    });
    row.append(label, sel);
    this.controlsEl.appendChild(row);

    const loc = this.world.smallMaps.get(this.town);
    const floors = loc?.floors ?? [];
    if (!floors.some((f) => f.z === this.townFloor)) this.townFloor = floors[0]?.z ?? 0;
    if (floors.length > 1) {
      this.controlsEl.appendChild(this.floorTabs(floors.map((f) => f.z), this.townFloor, (z) => {
        this.townFloor = z;
        this.dest = null;
        this.render();
      }));
    }

    const map = getActiveMap(this.world, this.town, this.townFloor);
    const cellPx = 14;
    this.map.configure({
      size: SMALL_MAP_SIZE,
      cellPx,
      allowZoom: true,
      paint: (ctx) => {
        for (let y = 0; y < SMALL_MAP_SIZE; y++) {
          for (let x = 0; x < SMALL_MAP_SIZE; x++) {
            paintTileCell(ctx, x * cellPx, y * cellPx, cellPx, map.tileAt(x, y), true);
          }
        }
      },
    });
  }

  // ── Mazmorras ────────────────────────────────────────────────────────────────
  private renderDungeon(): void {
    const dungeons = (this.api.game.dungeons ?? []).slice().sort((a, b) => a.location - b.location);
    if (!dungeons.some((d) => d.location === this.dungeon)) this.dungeon = dungeons[0]?.location ?? 0;

    const row = document.createElement("div");
    row.className = "u5tp-row";
    const label = document.createElement("label");
    label.textContent = ts("Dungeon");
    const sel = document.createElement("select");
    sel.setAttribute("data-testid", "u5-teleport-dungeon");
    for (const d of dungeons) {
      const o = document.createElement("option");
      o.value = String(d.location);
      o.textContent = `${d.location}: ${d.name}`;
      sel.appendChild(o);
    }
    sel.value = String(this.dungeon);
    sel.addEventListener("change", () => {
      this.dungeon = Number(sel.value);
      this.dest = null;
      this.render();
    });
    row.append(label, sel);
    this.controlsEl.appendChild(row);

    const data = dungeons.find((d) => d.location === this.dungeon);
    const nFloors = data?.floors.length ?? 8;
    if (this.dungeonFloor < 0 || this.dungeonFloor >= nFloors) this.dungeonFloor = 0;
    this.controlsEl.appendChild(
      this.floorTabs(
        Array.from({ length: nFloors }, (_, i) => i),
        this.dungeonFloor,
        (z) => {
          this.dungeonFloor = z;
          this.dest = null;
          this.render();
        },
        (z) => `${z + 1}`, // planta 0 = nivel 1 (etiqueta legible)
      ),
    );

    // Toggle de vista: Gem (display 22×22 embaldosado+flood, como el juego) / Planta completa.
    const viewRow = document.createElement("div");
    viewRow.className = "u5tp-row";
    const vlabel = document.createElement("label");
    vlabel.textContent = ts("View");
    const vtabs = document.createElement("div");
    vtabs.className = "u5tp-floors";
    for (const [m, lbl] of [["gem", "Gem"], ["full", ts("Full floor")]] as const) {
      const t = document.createElement("div");
      t.className = "u5tp-floor" + (this.dungeonView === m ? " active" : "");
      t.textContent = lbl;
      t.setAttribute("data-testid", `u5-teleport-dview-${m}`);
      t.addEventListener("click", () => {
        this.dungeonView = m;
        this.dest = null;
        this.render();
      });
      vtabs.appendChild(t);
    }
    viewRow.append(vlabel, vtabs);
    this.controlsEl.appendChild(viewRow);

    if (this.dungeonView === "gem" && data && this.api.game.dungeons) {
      this.renderDungeonGem(data);
    } else {
      this.gemSeed = null;
      this.renderDungeonFull(data);
    }
  }

  /** Vista PLANTA COMPLETA 8×8 en ESTILO CLUEBOOK (roca negra, pasillos blancos, salas ⊠). */
  private renderDungeonFull(data: DungeonData | undefined): void {
    const cellPx = 52;
    this.map.configure({
      size: 8,
      cellPx,
      allowZoom: true,
      paint: (ctx) => {
        if (!data) return; // datos de mazmorra no cargados → negro
        // LECTURA de celdas por el MISMO código que el gem (dungeonCellAt de core, OOB=Wall).
        for (let y = 0; y < 8; y++) {
          for (let x = 0; x < 8; x++) {
            const cell = dungeonCellAt(data, this.dungeonFloor, x, y);
            paintCluebookCell(ctx, x * cellPx, y * cellPx, cellPx, cell.type);
          }
        }
      },
    });
  }

  /**
   * Vista GEM: reutiliza `buildGemView` (el MISMO módulo del juego) para el display 22×22
   * que embaldosa la planta 8×8 toroidalmente y hace flood-fill desde la party (o la
   * escalera-up si la party no está en esta planta). Es LITERALMENTE lo que pinta la (V)ista
   * gem in-game. El click se traduce a coord de planta por `toFloorCoord` (wrap toroidal).
   */
  private renderDungeonGem(data: DungeonData): void {
    const seed = this.dungeonGemSeed(data, this.dungeonFloor);
    this.gemSeed = seed;
    const ds = new DungeonState(this.api.game.dungeons!, {
      dungeon: this.dungeon,
      floor: this.dungeonFloor,
      x: seed.x,
      y: seed.y,
      facing: "north",
    });
    const gv = buildGemView(this.api.state(), this.world, ds);
    const N = gv.width; // 22
    const cellPx = 20;
    // Nota de UI: desde dónde "mira" el gem (documenta la semilla del flood, apunte del lead).
    const note = document.createElement("div");
    note.className = "u5tp-hint";
    const from = this.partyOnThisFloor() ? ts("party") : ts("up-ladder");
    note.textContent = `${ts("Gem: flood-fill from")} ${from} (${seed.x},${seed.y})`;
    this.controlsEl.appendChild(note);

    this.map.configure({
      size: N,
      cellPx,
      allowZoom: true,
      paint: (ctx) => {
        for (let r = 0; r < N; r++) {
          for (let c = 0; c < N; c++) {
            const t = gv.tiles[r]?.[c] ?? -1; // -1 = no alcanzada → negro
            paintDungeonCell(ctx, c * cellPx, r * cellPx, cellPx, t < 0 ? CellType.Nothing : t, gv.sub?.[r]?.[c] ?? 0, true);
          }
        }
        // Marcador del centro (party/semilla) = rombo verde, como el gem (RUNES 0x60).
        paintGemCenter(ctx, gv.marker.x * cellPx, gv.marker.y * cellPx, cellPx);
      },
    });
  }

  /** ¿La party está en la mazmorra+planta mostradas? (semilla del flood + marcador). */
  private partyOnThisFloor(): boolean {
    const ds = this.api.game.dungeonState;
    return !!(ds && ds.pos.dungeon === this.dungeon && ds.pos.floor === this.dungeonFloor);
  }

  /** Celda-semilla del flood del gem: party si está en esta planta, si no la escalera-up, si no el primer hueco. */
  private dungeonGemSeed(data: DungeonData, floor: number): { x: number; y: number } {
    const ds = this.api.game.dungeonState;
    if (ds && ds.pos.dungeon === this.dungeon && ds.pos.floor === floor) return { x: ds.pos.x, y: ds.pos.y };
    for (let y = 0; y < DUNGEON_VIEW_SIZE; y++) {
      for (let x = 0; x < DUNGEON_VIEW_SIZE; x++) {
        const t = dungeonCellAt(data, floor, x, y).type;
        if (t === CellType.LadderUp || t === CellType.LadderUpDown) return { x, y };
      }
    }
    for (let y = 0; y < DUNGEON_VIEW_SIZE; y++) {
      for (let x = 0; x < DUNGEON_VIEW_SIZE; x++) {
        if (!DUNGEON_IMPASSABLE.has(dungeonCellAt(data, floor, x, y).type)) return { x, y };
      }
    }
    return { x: 0, y: 0 };
  }

  /** Traduce coord del MAPA (display 22×22 en gem) a coord de PLANTA 8×8 (wrap toroidal). */
  private toFloorCoord(x: number, y: number): { x: number; y: number } {
    if (this.mode === "dungeon" && this.gemSeed) {
      const mask = DUNGEON_VIEW_SIZE - 1;
      return {
        x: (x + this.gemSeed.x - DUNGEON_GEM_CENTER) & mask,
        y: (y + this.gemSeed.y - DUNGEON_GEM_CENTER) & mask,
      };
    }
    return { x, y };
  }

  /** Fila de pestañas de planta. `fmt` opcional formatea la etiqueta (default = z). */
  private floorTabs(
    zs: number[],
    active: number,
    onPick: (z: number) => void,
    fmt: (z: number) => string = (z) => `${z}`,
  ): HTMLElement {
    const wrap = document.createElement("div");
    wrap.className = "u5tp-row";
    const label = document.createElement("label");
    label.textContent = ts("Floor");
    wrap.appendChild(label);
    const tabs = document.createElement("div");
    tabs.className = "u5tp-floors";
    for (const z of zs) {
      const t = document.createElement("div");
      t.className = "u5tp-floor" + (z === active ? " active" : "");
      t.textContent = fmt(z);
      t.setAttribute("data-testid", `u5-teleport-floor-${z}`);
      t.addEventListener("click", () => onPick(z));
      tabs.appendChild(t);
    }
    wrap.appendChild(tabs);
    return wrap;
  }

  // ── Interacción ──────────────────────────────────────────────────────────────
  private onHover(x: number, y: number): void {
    // En mazmorra el (x,y) puede ser coord de DISPLAY (gem) → traducir a coord de PLANTA
    // para la etiqueta, el aviso y los inputs numéricos (que son SIEMPRE de planta).
    const f = this.mode === "dungeon" ? this.toFloorCoord(x, y) : { x, y };
    let label: string;
    if (this.mode === "dungeon") {
      const data = (this.api.game.dungeons ?? []).find((d) => d.location === this.dungeon);
      const cell = data ? dungeonCellAt(data, this.dungeonFloor, f.x, f.y) : undefined;
      label = dungeonCellLabel(cell?.type ?? CellType.Wall, cell?.sub ?? 0);
    } else {
      label = tileName(this.currentTileAt(f.x, f.y));
    }
    this.hoverEl.innerHTML =
      `<span class="coord">(${f.x}, ${f.y})</span> <span class="tile">${escapeHtml(label)}</span>`;
    this.xInput.value = String(f.x);
    this.yInput.value = String(f.y);
  }

  private clearHover(): void {
    this.hoverEl.textContent = "";
  }

  private currentTileAt(x: number, y: number): number {
    if (this.mode === "overworld") {
      const tiles = this.overUnder ? this.world.underworld : this.world.overworld;
      return tiles[y]?.[x] ?? -1;
    }
    return getActiveMap(this.world, this.town, this.townFloor).tileAt(x, y);
  }

  /** ¿La celda destino es transitable? (para el aviso; NO bloquea el teleport). */
  private isPassable(x: number, y: number): boolean {
    if (this.mode === "dungeon") {
      const data = (this.api.game.dungeons ?? []).find((d) => d.location === this.dungeon);
      const type = data ? dungeonCellAt(data, this.dungeonFloor, x, y).type : CellType.Wall;
      return !DUNGEON_IMPASSABLE.has(type);
    }
    return TILE_INFO[this.currentTileAt(x, y)]?.walkable ?? false;
  }

  /** Marca un destino sin teletransportar (input numérico en curso). */
  private previewDest(x: number, y: number): void {
    if (this.mode === "dungeon") {
      // x,y = coord de PLANTA (los inputs). Aviso con coord de planta; el marcador de
      // destino sólo tiene celda única en planta completa (en gem una planta mapea a varias).
      if (x < 0 || y < 0 || x >= 8 || y >= 8) return;
      this.updateWarn(x, y);
      if (!this.gemSeed) {
        this.dest = { x, y };
        this.map.setDest(this.dest);
      }
      return;
    }
    if (!this.inBounds(x, y)) return;
    this.dest = { x, y };
    this.map.setDest(this.dest);
    this.updateWarn(x, y);
  }

  /** Teleport DIRECTO a una celda de PLANTA (inputs numéricos): sin traducción display→planta. */
  private teleportDungeonFloorDirect(fx: number, fy: number): void {
    if (fx < 0 || fy < 0 || fx >= 8 || fy >= 8) return;
    this.api.teleportDungeon(this.dungeon, this.dungeonFloor, fx, fy);
    saveLast({ mode: "dungeon", id: this.dungeon, floor: this.dungeonFloor, x: fx, y: fy });
    this.updateWarn(fx, fy);
    // En planta completa el destino es esa celda; en gem una planta mapea a varias celdas
    // del display → sin marcador de destino único.
    this.dest = this.gemSeed ? null : { x: fx, y: fy };
    this.renderLast();
    this.refreshMarkers();
  }

  private inBounds(x: number, y: number): boolean {
    // En mazmorra vista-gem el mapa es 22×22 (display); en planta completa 8×8.
    const dungeonSize = this.gemSeed ? DUNGEON_GEM_DISPLAY : 8;
    const size = this.mode === "overworld" ? LARGE_MAP_SIZE : this.mode === "town" ? SMALL_MAP_SIZE : dungeonSize;
    return x >= 0 && y >= 0 && x < size && y < size;
  }

  private updateWarn(x: number, y: number): void {
    this.warnEl.textContent = this.isPassable(x, y)
      ? ""
      : `⚠ ${ts("Destination is a wall / impassable (teleport allowed anyway).")}`;
  }

  /**
   * CLICK / Ir: teletransporta a (x,y) en la selección activa. En mazmorra vista-gem el
   * (x,y) es coord de DISPLAY 22×22 → se traduce a coord de planta por `toFloorCoord`; el
   * marcador de destino se deja en coord del MAPA (display) para que caiga donde se pulsó.
   */
  private pick(x: number, y: number): void {
    if (!this.inBounds(x, y)) return;
    this.dest = { x, y }; // marcador en coords del MAPA (display en gem, planta en full)
    let last: LastDest;
    if (this.mode === "overworld") {
      this.api.teleportOverworld(x, y, this.overUnder);
      last = { mode: "overworld", id: this.overUnder ? UNDERWORLD_FLOOR : 0, floor: 0, x, y };
      this.updateWarn(x, y);
    } else if (this.mode === "town") {
      this.api.teleportSmallMap(this.town, this.townFloor, x, y);
      last = { mode: "town", id: this.town, floor: this.townFloor, x, y };
      this.updateWarn(x, y);
    } else {
      const f = this.toFloorCoord(x, y);
      this.api.teleportDungeon(this.dungeon, this.dungeonFloor, f.x, f.y);
      last = { mode: "dungeon", id: this.dungeon, floor: this.dungeonFloor, x: f.x, y: f.y };
      this.updateWarn(f.x, f.y); // aviso con coord de PLANTA
    }
    saveLast(last);
    this.renderLast();
    this.refreshMarkers();
  }

  /** Marcadores de party (si está en el mapa mostrado) y destino. */
  private refreshMarkers(): void {
    this.map.setParty(this.partyCell());
    this.map.setDest(this.dest);
  }

  private partyCell(): { x: number; y: number } | null {
    const ds = this.api.game.dungeonState;
    if (this.mode === "dungeon") {
      // Vista gem: el centro del display (11,11) es la semilla (party/escalera); el rombo
      // verde ya lo pinta el canvas, así que no duplicamos el marcador DOM de party.
      if (this.gemSeed) return null;
      if (ds && ds.pos.dungeon === this.dungeon && ds.pos.floor === this.dungeonFloor) {
        return { x: ds.pos.x, y: ds.pos.y };
      }
      return null;
    }
    if (ds) return null; // estás en mazmorra: la party no está en overworld/town
    const p = this.api.state().position;
    if (this.mode === "overworld") {
      const onLayer = p.location === 0 && (this.overUnder ? p.floor === UNDERWORLD_FLOOR : p.floor !== UNDERWORLD_FLOOR);
      return onLayer ? { x: p.x, y: p.y } : null;
    }
    return p.location === this.town && p.floor === this.townFloor ? { x: p.x, y: p.y } : null;
  }

  private renderLast(): void {
    const d = loadLast();
    if (!d) {
      this.lastEl.textContent = "";
      return;
    }
    const where = this.describeDest(d);
    this.lastEl.innerHTML = `${escapeHtml(ts("Last destination:"))} ${escapeHtml(where)} `;
    const again = document.createElement("a");
    again.textContent = ts("Go again");
    again.setAttribute("data-testid", "u5-teleport-again");
    again.addEventListener("click", () => this.gotoLast(d));
    this.lastEl.appendChild(again);
  }

  private describeDest(d: LastDest): string {
    if (d.mode === "overworld") {
      return `${d.id === UNDERWORLD_FLOOR ? ts("Underworld") : ts("Britannia (overworld)")} (${d.x},${d.y})`;
    }
    if (d.mode === "town") {
      const name = this.world.smallMaps.get(d.id)?.name ?? `#${d.id}`;
      return `${name} f${d.floor} (${d.x},${d.y})`;
    }
    const name = (this.api.game.dungeons ?? []).find((x) => x.location === d.id)?.name ?? `#${d.id}`;
    return `${name} L${d.floor + 1} (${d.x},${d.y})`;
  }

  /** Reaplica un destino recordado: fija la pestaña/selección y teletransporta. */
  private gotoLast(d: LastDest): void {
    this.mode = d.mode;
    if (d.mode === "overworld") this.overUnder = d.id === UNDERWORLD_FLOOR;
    else if (d.mode === "town") { this.town = d.id; this.townFloor = d.floor; }
    else { this.dungeon = d.id; this.dungeonFloor = d.floor; }
    this.dest = { x: d.x, y: d.y };
    this.buildTabs();
    this.render();
    this.pick(d.x, d.y);
  }

  /** Coloca la pestaña/selección inicial según DÓNDE está la party ahora. */
  private syncToCurrent(): void {
    const ds = this.api.game.dungeonState;
    if (ds) {
      this.mode = "dungeon";
      this.dungeon = ds.pos.dungeon;
      this.dungeonFloor = ds.pos.floor;
      return;
    }
    const p = this.api.state().position;
    if (p.location === 0) {
      this.mode = "overworld";
      this.overUnder = p.floor === UNDERWORLD_FLOOR;
    } else if (this.world.smallMaps.has(p.location)) {
      this.mode = "town";
      this.town = p.location;
      this.townFloor = p.floor;
    }
  }

  open(): void {
    if (!this.backdrop.isConnected) document.body.appendChild(this.backdrop);
    this.dest = null;
    this.syncToCurrent();
    this.buildTabs();
    this.render();
    // Foco al card para que ESC/teclas las capture el modal, no el juego.
    this.card.tabIndex = -1;
    this.card.focus();
  }

  close(): void {
    if (this.backdrop.isConnected) this.backdrop.remove();
  }
}

