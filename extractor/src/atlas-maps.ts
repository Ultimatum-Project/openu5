/**
 * Genera el atlas de mapas del manual: Britannia y Underworld completos,
 * los 32 pueblos por plantas y los planos de las 8 mazmorras — todo
 * renderizado desde los datos extraídos con los tiles originales.
 *
 * Uso: npx tsx src/atlas-maps.ts   (requiere game/assets/ ya extraído)
 */
import { readFileSync, mkdirSync } from "node:fs";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { PNG } from "pngjs";
import { writePng } from "./png.js";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const ASSETS = join(ROOT, "game/assets");
const OUT = join(ROOT, "docs/manual/maps");

const json = <T>(p: string): T => JSON.parse(readFileSync(join(ASSETS, p), "utf-8")) as T;

// Atlas EGA 16px: 32 columnas de tiles
const atlasPng = PNG.sync.read(readFileSync(join(ASSETS, "tiles-ega.png")));
const TILE = 16;
const ATLAS_COLS = 32;

function blitTile(dst: PNG, tile: number, dx: number, dy: number, scale = 1): void {
  const sx = (tile % ATLAS_COLS) * TILE;
  const sy = Math.floor(tile / ATLAS_COLS) * TILE;
  for (let y = 0; y < TILE * scale; y++) {
    for (let x = 0; x < TILE * scale; x++) {
      const si = ((sy + Math.floor(y / scale)) * atlasPng.width + sx + Math.floor(x / scale)) * 4;
      const di = ((dy + y) * dst.width + dx + x) * 4;
      dst.data[di] = atlasPng.data[si]!;
      dst.data[di + 1] = atlasPng.data[si + 1]!;
      dst.data[di + 2] = atlasPng.data[si + 2]!;
      dst.data[di + 3] = 255;
    }
  }
}

function renderTileMap(tiles: number[][], scalePx: number): PNG {
  const h = tiles.length;
  const w = tiles[0]!.length;
  const png = new PNG({ width: w * scalePx, height: h * scalePx });
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      // blit reducido: muestrea el tile 16px al tamaño scalePx
      const tile = tiles[y]![x]!;
      const sx = (tile % ATLAS_COLS) * TILE;
      const sy = Math.floor(tile / ATLAS_COLS) * TILE;
      for (let py = 0; py < scalePx; py++) {
        for (let px = 0; px < scalePx; px++) {
          const si =
            ((sy + Math.floor((py * TILE) / scalePx)) * atlasPng.width +
              sx +
              Math.floor((px * TILE) / scalePx)) *
            4;
          const di = ((y * scalePx + py) * png.width + x * scalePx + px) * 4;
          png.data[di] = atlasPng.data[si]!;
          png.data[di + 1] = atlasPng.data[si + 1]!;
          png.data[di + 2] = atlasPng.data[si + 2]!;
          png.data[di + 3] = 255;
        }
      }
    }
  }
  return png;
}

function save(png: PNG, name: string): void {
  writePng(join(OUT, name), new Uint8Array(png.data), png.width, png.height);
  console.log(`  🗺  ${name} (${png.width}×${png.height})`);
}

mkdirSync(OUT, { recursive: true });

// ── 1. Britannia y Underworld (4px/tile → 1024×1024)
console.log("Overworld…");
save(renderTileMap(json<number[][]>("maps/overworld.json"), 4), "britannia.png");
save(renderTileMap(json<number[][]>("maps/underworld.json"), 4), "underworld.png");

// ── 2. Pueblos (16px/tile → 512×512 por planta)
console.log("Pueblos…");
interface SmallMap {
  id: number;
  name: string;
  floors: { z: number; tiles: number[][] }[];
}
for (const loc of json<SmallMap[]>("maps/smallmaps.json")) {
  for (const floor of loc.floors) {
    const suffix = loc.floors.length > 1 ? `-planta${floor.z}` : "";
    save(renderTileMap(floor.tiles, 16), `pueblo-${String(loc.id).padStart(2, "0")}-${loc.name.toLowerCase()}${suffix}.png`);
  }
}

// ── 3. Mazmorras: plano 8×8 por planta, colores por tipo de celda + leyenda
console.log("Mazmorras…");
interface Dungeon {
  location: number;
  name: string;
  floors: { type: number; sub: number }[][][];
}
const CELL_COLORS: Record<number, [number, number, number]> = {
  0x0: [26, 20, 12], // pasillo
  0x1: [216, 192, 96], // escalera arriba
  0x2: [160, 128, 48], // escalera abajo
  0x3: [255, 224, 128], // arriba+abajo
  0x4: [176, 128, 48], // cofre
  0x5: [48, 96, 192], // fuente
  0x6: [192, 64, 64], // trampa
  0x7: [112, 80, 32], // cofre abierto
  0x8: [160, 64, 192], // campo mágico
  0xa: [90, 82, 60], // rooms broke
  0xb: [200, 184, 144], // muro
  0xc: [170, 154, 114], // muro 2
  0xd: [230, 140, 60], // puerta secreta
  0xe: [138, 90, 40], // puerta
  0xf: [64, 160, 96], // sala
};
const CELL_PX = 24;
for (const dungeon of json<Dungeon[]>("maps/dungeons.json")) {
  // 8 plantas en rejilla 4×2, con margen
  const margin = 8;
  const floorPx = 8 * CELL_PX;
  const png = new PNG({
    width: 4 * floorPx + 5 * margin,
    height: 2 * floorPx + 3 * margin,
  });
  // fondo
  for (let i = 0; i < png.data.length; i += 4) {
    png.data[i] = 10;
    png.data[i + 1] = 8;
    png.data[i + 2] = 4;
    png.data[i + 3] = 255;
  }
  dungeon.floors.forEach((floor, f) => {
    const ox = margin + (f % 4) * (floorPx + margin);
    const oy = margin + Math.floor(f / 4) * (floorPx + margin);
    for (let y = 0; y < 8; y++) {
      for (let x = 0; x < 8; x++) {
        const cell = floor[y]![x]!;
        const [r, g, b] = CELL_COLORS[cell.type] ?? [255, 0, 255];
        for (let py = 1; py < CELL_PX - 1; py++) {
          for (let px = 1; px < CELL_PX - 1; px++) {
            const di = ((oy + y * CELL_PX + py) * png.width + ox + x * CELL_PX + px) * 4;
            png.data[di] = r;
            png.data[di + 1] = g;
            png.data[di + 2] = b;
            png.data[di + 3] = 255;
          }
        }
      }
    }
  });
  save(png, `mazmorra-${dungeon.name.toLowerCase()}.png`);
}

console.log("\n✔ Atlas completo en docs/manual/maps/");
