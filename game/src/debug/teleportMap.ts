/**
 * Canvas del mapa GRANDE de Britannia para el teletransporte del menú debug.
 * Renderiza el overworld/underworld 256×256 (1px/tile, coloreado por tipo con
 * `defaultTileColor` — la MISMA fn del minimapa) UNA vez por capa, marca la
 * posición actual, y traduce el CLICK a `api.teleportOverworld`. Cero-rand: sólo
 * lee `world` (tiles) y llama al teleport (que fija posición y repinta).
 */
import { defaultTileColor } from "../core/tile-colors.js";
import type { WorldData } from "../core/world/map.js";
import { LARGE_MAP_SIZE, UNDERWORLD_FLOOR, type DebugApi } from "./debugApi.js";

const MAP_PX = LARGE_MAP_SIZE; // 256

/** Cachea el ImageData de cada capa: pintar 65k px es caro para repetir por refresh. */
function renderLayer(tiles: number[][]): ImageData {
  const img = new ImageData(MAP_PX, MAP_PX);
  for (let y = 0; y < MAP_PX; y++) {
    const row = tiles[y];
    if (!row) continue;
    for (let x = 0; x < MAP_PX; x++) {
      const tile = row[x];
      if (tile === undefined) continue;
      const color = defaultTileColor(tile);
      const off = (y * MAP_PX + x) * 4;
      img.data[off] = (color >> 16) & 0xff;
      img.data[off + 1] = (color >> 8) & 0xff;
      img.data[off + 2] = color & 0xff;
      img.data[off + 3] = 255;
    }
  }
  return img;
}

export function buildTeleportMap(api: DebugApi, world: WorldData): HTMLElement {
  const wrap = document.createElement("div");
  wrap.className = "u5dbg-telemap";

  // Selector de capa (Britannia / Underworld).
  const layerRow = document.createElement("div");
  layerRow.className = "u5dbg-telemap-toolbar";
  const layerSel = document.createElement("select");
  layerSel.innerHTML =
    '<option value="over">Britannia (overworld)</option>' +
    '<option value="under">Underworld</option>';
  const coordLabel = document.createElement("span");
  coordLabel.className = "u5dbg-telemap-coord";
  layerRow.append(layerSel, coordLabel);

  const frame = document.createElement("div");
  frame.className = "u5dbg-telemap-frame";
  const canvas = document.createElement("canvas");
  canvas.width = MAP_PX;
  canvas.height = MAP_PX;
  canvas.className = "u5dbg-telemap-canvas";
  const marker = document.createElement("div");
  marker.className = "u5dbg-telemap-marker";
  frame.append(canvas, marker);
  wrap.append(layerRow, frame);

  const ctx = canvas.getContext("2d");
  const layers: Record<"over" | "under", ImageData | null> = { over: null, under: null };

  const currentLayer = (): "over" | "under" => (layerSel.value === "under" ? "under" : "over");

  const drawLayer = (): void => {
    if (!ctx) return;
    const key = currentLayer();
    if (!layers[key]) {
      layers[key] = renderLayer(key === "under" ? world.underworld : world.overworld);
    }
    ctx.putImageData(layers[key]!, 0, 0);
  };

  const placeMarker = (): void => {
    const p = api.state().position;
    const onThisLayer =
      p.location === 0 &&
      ((currentLayer() === "under" && p.floor === UNDERWORLD_FLOOR) ||
        (currentLayer() === "over" && p.floor !== UNDERWORLD_FLOOR));
    marker.style.display = onThisLayer ? "block" : "none";
    if (onThisLayer) {
      marker.style.left = `${((p.x + 0.5) / MAP_PX) * 100}%`;
      marker.style.top = `${((p.y + 0.5) / MAP_PX) * 100}%`;
    }
  };

  const eventToTile = (ev: MouseEvent): { x: number; y: number } => {
    const rect = canvas.getBoundingClientRect();
    const x = Math.floor(((ev.clientX - rect.left) / rect.width) * MAP_PX);
    const y = Math.floor(((ev.clientY - rect.top) / rect.height) * MAP_PX);
    return {
      x: Math.max(0, Math.min(MAP_PX - 1, x)),
      y: Math.max(0, Math.min(MAP_PX - 1, y)),
    };
  };

  canvas.addEventListener("mousemove", (ev) => {
    const { x, y } = eventToTile(ev);
    coordLabel.textContent = `(${x}, ${y})`;
  });
  canvas.addEventListener("click", (ev) => {
    const { x, y } = eventToTile(ev);
    api.teleportOverworld(x, y, currentLayer() === "under");
    placeMarker();
  });
  layerSel.addEventListener("change", () => {
    drawLayer();
    placeMarker();
  });

  drawLayer();
  placeMarker();

  // El panel re-monta el custom en cada refresh, así que basta el estado inicial;
  // pero exponemos un método para reubicar el marcador sin re-render completo.
  (wrap as HTMLElement & { __refreshMarker?: () => void }).__refreshMarker = placeMarker;
  return wrap;
}
