import { describe, expect, it } from "vitest";
import { TILE_BY_NAME, TILE_INFO, tileInfo } from "../src/core/tiles.js";

describe("TILE_INFO (TileData.json de Ultima5Redux, MIT)", () => {
  it("carga 529 tiles (512 base + extendidos)", () => {
    expect(TILE_INFO.filter(Boolean).length).toBe(529);
  });

  it("agua no es transitable a pie pero sí en barco", () => {
    const water = tileInfo(1); // Water1
    expect(water.name).toBe("Water1");
    expect(water.walkable).toBe(false);
    expect(water.boatPassable).toBe(true);
  });

  it("la hierba es transitable", () => {
    const grass = TILE_BY_NAME.get("Grass");
    expect(grass).toBeDefined();
    expect(tileInfo(grass!).walkable).toBe(true);
  });

  it("las montañas altas no son transitables, las colinas sí", () => {
    const tall = TILE_BY_NAME.get("TallMountains"); // tile 13
    expect(tall).toBe(13);
    expect(tileInfo(tall!).walkable).toBe(false);
    const hills = TILE_BY_NAME.get("Hills1"); // tile 11
    expect(tileInfo(hills!).walkable).toBe(true);
  });
});
