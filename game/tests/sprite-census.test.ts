/**
 * CENSO DE TRANSPARENCIA (veredicto B, alpha .55 del cuerpo) — lógica PURA de la 1ª ola:
 * pertenencia a las listas blancas y la síntesis del suelo bajo un tile de terreno
 * translúcido (vecino dominante). El compositado de canvas se verifica en QA de navegador
 * (capturas en `docs/verdicts/transp-wire/`); aquí se fija la DECISIÓN sin DOM.
 */
import { describe, expect, it } from "vitest";
import {
  BLUE_FLAME_TILE,
  BODY_ALPHA,
  CONTOUR_ACTOR_TILES,
  MOONGATE_TILE,
  TRANSLUCENT_ACTOR_TILES,
  TRANSLUCENT_BOUNDARY_TILES,
  TRANSLUCENT_FIELD_TILES,
  dominantFloorNeighbor,
  isCensusTerrainTile,
} from "../src/skin/shader/sprite-census.js";

const N = 11;
/** Construye una ventana N×N con un valor de fondo y overrides puntuales por [row,col]. */
function win(bg: number, cells: [number, number, number][] = []): Int16Array {
  const w = new Int16Array(N * N).fill(bg);
  for (const [r, c, t] of cells) w[r * N + c] = t;
  return w;
}

describe("listas blancas del censo (1ª ola)", () => {
  it("actores: todos los frames de ghost/wisp/shadowlord, y NADA más", () => {
    for (const t of [412, 413, 414, 415, 468, 469, 470, 471, 508, 509, 510, 511]) {
      expect(TRANSLUCENT_ACTOR_TILES.has(t)).toBe(true);
    }
    // Boundary del shadowlord (2ª ola) y monstruos sólidos vecinos: fuera.
    for (const t of [112, 127, 411, 416, 467, 472, 507, 512]) {
      expect(TRANSLUCENT_ACTOR_TILES.has(t)).toBe(false);
    }
  });

  it("terreno: los 4 force fields + la moongate", () => {
    for (const t of [488, 489, 490, 491]) expect(TRANSLUCENT_FIELD_TILES.has(t)).toBe(true);
    expect(isCensusTerrainTile(MOONGATE_TILE)).toBe(true);
    for (const t of [488, 489, 490, 491, 220]) expect(isCensusTerrainTile(t)).toBe(true);
    expect(isCensusTerrainTile(487)).toBe(false);
    expect(isCensusTerrainTile(221)).toBe(false);
  });

  it("el alpha del cuerpo es el veredicto B (.55)", () => {
    expect(BODY_ALPHA).toBeCloseTo(0.55, 5);
  });

  it("contorno: cadáver 0x11E y sangre 0x11F de la arena, y NADA más", () => {
    expect(CONTOUR_ACTOR_TILES.has(286)).toBe(true); // 0x11E DeadBody
    expect(CONTOUR_ACTOR_TILES.has(287)).toBe(true); // 0x11F Splat
    // Los gemelos del banco BAJO (sin +0x100) NO deben translucirse (bug del desierto).
    expect(CONTOUR_ACTOR_TILES.has(0x1e)).toBe(false);
    expect(CONTOUR_ACTOR_TILES.has(0x1f)).toBe(false);
    // El cofre de la arena (0x101) NO va por contorno (es opaco sólido).
    expect(CONTOUR_ACTOR_TILES.has(0x101)).toBe(false);
    // No solapa con los actores translúcidos por alpha.
    for (const t of CONTOUR_ACTOR_TILES) expect(TRANSLUCENT_ACTOR_TILES.has(t)).toBe(false);
  });
});

describe("listas blancas del censo (2ª ola)", () => {
  it("boundary del shadowlord: las 16 fases 0x70..0x7F, y NADA fuera del rango", () => {
    for (let t = 112; t <= 127; t++) expect(TRANSLUCENT_BOUNDARY_TILES.has(t)).toBe(true);
    expect(TRANSLUCENT_BOUNDARY_TILES.has(111)).toBe(false);
    expect(TRANSLUCENT_BOUNDARY_TILES.has(128)).toBe(false);
    // El boundary es TERRENO (no actor): no debe estar en la lista de actores translúcidos.
    for (let t = 112; t <= 127; t++) expect(TRANSLUCENT_ACTOR_TILES.has(t)).toBe(false);
  });

  it("blue flame es 0xDE (222)", () => {
    expect(BLUE_FLAME_TILE).toBe(222);
  });

  it("los emisores de la 2ª ola cuentan como census (no sirven de suelo)", () => {
    for (const t of [112, 119, 127, BLUE_FLAME_TILE]) {
      expect(isCensusTerrainTile(t)).toBe(true);
    }
    // El agua (river/corner/waterfall) NO es census: la trata la capa de agua, no doble-tratar.
    for (const t of [96, 111, 212, 215, 228, 231]) expect(isCensusTerrainTile(t)).toBe(false);
    // Los puentes de troll del rango waterstream tampoco.
    for (const t of [106, 107]) expect(isCensusTerrainTile(t)).toBe(false);
    // Ventanas DESCARTADAS: ya no se enumeran en el censo (las paredes las excluye el helper).
    for (const t of [74, 75]) expect(isCensusTerrainTile(t)).toBe(false);
  });

  it("un boundary no usa a otro boundary ni a la blue flame como suelo", () => {
    // Centro boundary; N=boundary, S=hierba, O=blue flame, E=borde → único suelo = hierba.
    const tw = win(-1, [
      [5, 5, 120],
      [4, 5, 121],
      [6, 5, 4],
      [5, 4, BLUE_FLAME_TILE],
    ]);
    const idx = dominantFloorNeighbor(tw, N, 5, 5, isCensusTerrainTile);
    expect(idx).toBe(6 * N + 5);
    expect(tw[idx]).toBe(4);
  });
});

describe("dominantFloorNeighbor — suelo sintetizado bajo el tile translúcido", () => {
  it("un campo rodeado de hierba → devuelve una celda de hierba vecina", () => {
    const tw = win(4, [[5, 5, 488]]); // 4 = hierba, campo en el centro
    const idx = dominantFloorNeighbor(tw, N, 5, 5, isCensusTerrainTile);
    expect(idx).toBeGreaterThanOrEqual(0);
    expect(tw[idx]).toBe(4); // apunta a hierba, no al campo
  });

  it("gana el suelo MAYORITARIO entre los vecinos ortogonales", () => {
    // Centro campo; N=roca(7), S=hierba(4), O=hierba(4), E=roca(7) → hierba mayoritaria.
    const tw = win(0, [
      [5, 5, 488],
      [4, 5, 7],
      [6, 5, 4],
      [5, 4, 4],
      [5, 6, 7],
    ]);
    const idx = dominantFloorNeighbor(tw, N, 5, 5, isCensusTerrainTile);
    expect(tw[idx]).toBe(4);
  });

  it("ignora vecinos especiales (otro campo / moongate) como suelo", () => {
    // N=campo, S=moongate, O=hierba, E=borde(-1) → único suelo válido = hierba.
    const tw = win(-1, [
      [5, 5, 489],
      [4, 5, 490],
      [6, 5, MOONGATE_TILE],
      [5, 4, 4],
    ]);
    const idx = dominantFloorNeighbor(tw, N, 5, 5, isCensusTerrainTile);
    expect(idx).toBe(5 * N + 4);
    expect(tw[idx]).toBe(4);
  });

  it("campo aislado (sin vecino de suelo utilizable) → -1 (celda intacta)", () => {
    const tw = win(-1, [[5, 5, 491]]); // rodeado de borde/negro
    expect(dominantFloorNeighbor(tw, N, 5, 5, isCensusTerrainTile)).toBe(-1);
  });

  it("respeta los límites de la ventana (esquina)", () => {
    // Moongate en (0,0): sólo S y E existen; ambos hierba.
    const tw = win(-1, [
      [0, 0, MOONGATE_TILE],
      [1, 0, 4],
      [0, 1, 4],
    ]);
    const idx = dominantFloorNeighbor(tw, N, 0, 0, isCensusTerrainTile);
    expect(idx).toBeGreaterThanOrEqual(0);
    expect(tw[idx]).toBe(4);
  });
});
