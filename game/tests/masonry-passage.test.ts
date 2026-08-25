import { describe, expect, it } from "vitest";
import {
  MASONRY_PASSAGE_FAMILY,
  MASONRY_PASSAGE_TILES,
  isMasonryPassage,
} from "../src/render/masonry-passage.js";
import { TILE_INFO } from "../src/core/tiles.js";

/**
 * GUARDA DE POBLACIÓN del paso de mampostería (#197). Re-deriva el conjunto DESDE
 * `TileData.json` en cada corrida y se pone roja si cambia: si un re-vendorizado mueve los
 * índices, renombra un tile o vuelve caminable el rastrillo, esto lo dice — no se descubre
 * mirando una captura tres semanas después.
 */
describe("paso de mampostería — la población es DOS y se re-deriva por corrida", () => {
  it("la población es EXACTAMENTE {0x3e, 0x87}, y cada familia declarada aporta alguno", () => {
    expect(MASONRY_PASSAGE_TILES.size).toBe(2);
    expect([...MASONRY_PASSAGE_TILES].sort((a, b) => a - b)).toEqual([0x3e, 0x87]);
    // Una familia que dejara de existir en TileData (renombrado del vendor) aportaría CERO:
    // el cardinal 2 solo no lo cazaría si otra creciera, esto sí.
    for (const fam of MASONRY_PASSAGE_FAMILY) {
      const aporta = [...MASONRY_PASSAGE_TILES].filter((id) => TILE_INFO[id]!.name.startsWith(fam));
      expect(aporta.length).toBeGreaterThan(0);
    }
  });

  it("MUTANTE: quitar CAMINABLE mete el rastrillo 0x200 — la condición carga peso REAL", () => {
    // La familia por nombre recoge TRES tiles; `walkable` es lo único que baja a dos. Se
    // instancia la diferencia donde EXISTE: si alguien borra la condición, esta cuenta cambia
    // de 2 a 3 y el aserto de población de arriba se pone rojo (comprobado con el mutante).
    const porFamilia = TILE_INFO.filter(
      (t) => t && MASONRY_PASSAGE_FAMILY.some((f) => t.name.startsWith(f)),
    );
    expect(porFamilia.length).toBe(3); // 0x3e, 0x87 y BrickWallArchwayWithPortcullis
    expect(porFamilia.filter((t) => t.walkable).length).toBe(2); // ← el filtro que decide

    const rastrillo = TILE_INFO[0x200]!;
    expect(rastrillo.name).toBe("BrickWallArchwayWithPortcullis");
    expect(rastrillo.walkable).toBe(false); // nunca hay actor encima (ruling del lead)
    expect(isMasonryPassage(0x200)).toBe(false);
  });

  it("REFUTADO: el instrumento ancho «tiene FlatTileSubstitution» atrapa decenas de caminables", () => {
    // Censo que mata la tentación de generalizar (ficha #197, decisión del lead): el campo
    // que declara «qué suelo hay detrás» lo llevan bosque, camas, sillas, alfombras, BARCOS
    // (sustitución Water) y bocas de mazmorra — todos CAMINABLES, todos con transparencia
    // querida. La clase de este fichero no es «tiles con sustitución»; son estos dos.
    const anchos = TILE_INFO.filter((t) => t && t.walkable && t.flatTileSubstitutionName !== "None");
    expect(anchos.length).toBeGreaterThan(50); // medido hoy: 64
    expect(MASONRY_PASSAGE_TILES.size).toBe(2); // la clase acotada NO crece con él
  });

  it("celdas corrientes NO son paso (suelo, hierba, muro, agua, fuera de rango)", () => {
    for (const t of [-1, 0, 0x05, 0x44, 0x46, 0x01, 0x99, 0x200, 999]) {
      expect(isMasonryPassage(t)).toBe(false);
    }
  });
});
