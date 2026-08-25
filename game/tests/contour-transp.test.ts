import { describe, expect, it } from "vitest";
import {
  declaredFloorNeighbor,
  dominantFloorNeighbor,
  isFloorUnderlayCandidate,
  isFountainTile,
  isWallMountedFire,
  parseContourTransp,
} from "../src/skin/shader/contour-transp.js";
import { animatedFrame, buildAnimGroups } from "../src/render/tileanim.js";
import { isFireTile } from "../src/render/firenoise.js";
import {
  INTERIOR_FURNITURE_FLOOR,
  declaredFloorUnder,
  isInteriorFurniture,
} from "../src/render/interior-furniture.js";
import { TILE_INFO } from "../src/core/tiles.js";

describe("contour-transp gate (polaridad default ON)", () => {
  it("default ON; sólo `?contourTransp=off` lo apaga", () => {
    expect(parseContourTransp("")).toBe(true); // sin query → cableo real activo
    expect(parseContourTransp("?foo=1")).toBe(true);
    expect(parseContourTransp("?contourTransp=1")).toBe(true);
    expect(parseContourTransp("?contourTransp=off")).toBe(false); // kill-switch de QA
  });

  it("reconoce las 4 fases de la FUENTE (0xd8–0xdb) y sólo esas", () => {
    for (const t of [0xd8, 0xd9, 0xda, 0xdb]) expect(isFountainTile(t)).toBe(true);
    for (const t of [-1, 0xd7, 0xdc, 0x1d4, 0x100, 999]) expect(isFountainTile(t)).toBe(false);
  });
});

describe("dominantFloorNeighbor (suelo dominante — reusable por transp-wire)", () => {
  const N = 3;
  const grid = (vals: number[]): Int16Array => Int16Array.from(vals);

  it("elige el tile ortogonal MÁS frecuente e ignora las fuentes", () => {
    // N=0x44, S=0x44, O=0x44, E=fuente(0xd8) → domina 0x44.
    const tw = grid([9, 0x44, 9, 0x44, 0xd8, 0xd8, 9, 0x44, 9]);
    expect(dominantFloorNeighbor(tw, N, 1, 1, isFountainTile)?.tile).toBe(0x44);
  });

  it("empate → primero en orden N,S,O,E (determinista)", () => {
    // N=5, S=7 (ambos 1 vez); O y E fuera por fuente. Gana N=5.
    const tw = grid([0, 5, 0, 0xd8, 0xd8, 0xd8, 0, 7, 0]);
    expect(dominantFloorNeighbor(tw, N, 1, 1, isFountainTile)?.tile).toBe(5);
  });

  it("celda aislada (todos los vecinos son fuente) → null", () => {
    const tw = grid([0, 0xd8, 0, 0xd8, 0xd8, 0xd8, 0, 0xd8, 0]);
    expect(dominantFloorNeighbor(tw, N, 1, 1, isFountainTile)).toBeNull();
  });

  it("PAREDES excluidas: 3 muros + 1 suelo → gana el suelo aunque los muros sean mayoría", () => {
    // N,S,O = ventana de piedra (muro, walk=0 boat=0 skiff=0); E = hierba (suelo).
    const W = 74; // StoneCrossWindow (BlocksLight, no pisable)
    const tw = grid([0, W, 0, W, 0xd8, 5, 0, W, 0]);
    const f = dominantFloorNeighbor(tw, N, 1, 1, isFountainTile);
    expect(f?.tile).toBe(5); // hierba, nunca el muro
  });

  it("rodeada de pared (ningún vecino de suelo) → null (celda intacta, jamás fondo de pared)", () => {
    const W = 74;
    const tw = grid([0, W, 0, W, 0xd8, W, 0, W, 0]);
    expect(dominantFloorNeighbor(tw, N, 1, 1, isFountainTile)).toBeNull();
  });
});

describe("isFloorUnderlayCandidate — suelo vs pared (regla «nunca fondo de pared»)", () => {
  it("suelos legítimos (pisables o agua) son candidatos", () => {
    for (const t of [
      5, // Grass
      0x44, // BrickFloor
      0x48, // LeftWoodFloor2
      106, // TrollBridgeHoriz (puente — debe conservarse)
      143, // Lava (walkable en TileData)
      1, // Water1 (boat)
      3, // WaterCoast (skiff)
    ]) {
      expect(isFloorUnderlayCandidate(t)).toBe(true);
    }
  });

  it("muros / no-suelos NO son candidatos", () => {
    for (const t of [
      74, // StoneCrossWindow (muro con BlocksLight)
      75, // StoneGlassWindow
      0x46, // DryStone
      0xb0, // RightSconce (fuego de pared, walk=0)
      0xb2, // Brazier (decoración de suelo walk=0 — tampoco sirve de suelo)
      184, // RegularDoor
    ]) {
      expect(isFloorUnderlayCandidate(t)).toBe(false);
    }
  });
});

describe("isWallMountedFire — fuegos con fondo horneado que NO se recortan", () => {
  it("pared (sconces/hogar/cocina) y mobiliario (vela) NO se recortan", () => {
    // 0xb0/0xb1 sconces, 0xbc hogar, 0xbf cocina (contra pared), 0xbe vela (sobre mesa).
    for (const t of [0xb0, 0xb1, 0xbc, 0xbe, 0xbf]) expect(isWallMountedFire(t)).toBe(true);
  });
  it("fuegos de SUELO (brasero/hoguera/farola/llama azul) sí se recortan", () => {
    for (const t of [0xb2, 0xb3, 0xbd, 0xde]) expect(isWallMountedFire(t)).toBe(false);
  });
});

describe("contorno-transparencia — frame VIVO (regresión anti-congelado)", () => {
  // El recorte del contorno NO debe bliteear el tile crudo de `terrainWindow` (frame
  // FIJO → congelaba la animación de la fuente, testigo del usuario batch 14) sino el
  // frame que deriva `animatedFrame(raw, phase, groups)` esa pasada. Esta prueba fija la
  // clave de frame que el blit usa; que los 4 frames sean DISTINTOS = 4 recortes distintos.
  const groups = buildAnimGroups();

  it("la FUENTE cicla 4 ids DISTINTOS por el reloj (0xd8→0xdb) — no un frame fijo", () => {
    // Con divisor 2 (110 ms), 4 fases · 2 ticks = 8 fases barren el ciclo entero.
    const frames = new Set<number>();
    for (let phase = 0; phase < 8; phase++) {
      const f = animatedFrame(0xd8, phase, groups);
      expect(isFountainTile(f)).toBe(true); // el frame vivo sigue siendo fuente
      frames.add(f);
    }
    expect(frames).toEqual(new Set([0xd8, 0xd9, 0xda, 0xdb])); // los 4, no 1 congelado
  });

  it("el BRASERO/FUEGO NO cicla su id (su titileo es fn32 sobre el mismo id)", () => {
    // El fuego se recorta por su silueta ESTÁTICA (id fijo) y la llama viva la aporta el
    // canvas fn32; `animatedFrame` debe devolver el id tal cual en toda fase.
    for (const fire of [0xb0, 0xb1, 0xb2, 0xb3, 0xbc, 0xde]) {
      expect(isFireTile(fire)).toBe(true);
      for (let phase = 0; phase < 8; phase++) {
        expect(animatedFrame(fire, phase, groups)).toBe(fire);
      }
    }
  });
});

/**
 * GUARDA DE LA CLASE «mobiliario de interior» (#196): re-deriva la población desde
 * `TileData.json` por corrida y se pone roja si cambia. Cada condición del predicado tiene su
 * MUTANTE instanciado sobre un tile REAL de los datos, no afirmado de palabra.
 */
describe("mobiliario de interior — población derivada de TileData y sus frenos", () => {
  it("son 23, incluyen el FUELLE, y cada uno declara su suelo de interior", () => {
    expect(INTERIOR_FURNITURE_FLOOR.size).toBe(23);
    // El reporte del usuario: el fuelle y sus DOS frames de animación.
    for (const t of [0xfc, 0xfd]) {
      expect(isInteriorFurniture(t)).toBe(true);
      expect(TILE_INFO[declaredFloorUnder(t)]!.name).toBe("BrickFloor"); // 68, el dato de 1988
    }
    // Y el suelo declarado de TODOS es de interior (nadie cuela Grass/Water por la puerta).
    for (const [, floorId] of INTERIOR_FURNITURE_FLOOR) {
      expect(["BrickFloor", "MetalFloor"]).toContain(TILE_INFO[floorId]!.name);
    }
  });

  it("MUTANTE de `walkable`: sin él entrarían sillas, camas, alfombra y el arco de muralla", () => {
    // Testigos REALES con substitución de interior que sólo `walkable` deja fuera.
    for (const t of [0x90, 0xaa, 0xab, 0xac, 0x87, 0xbc]) {
      const info = TILE_INFO[t]!;
      expect(info.walkable).toBe(true); // se PISAN
      expect(info.flatTileSubstitutionName).toBe("BrickFloor"); // y declaran suelo de interior
      expect(isInteriorFurniture(t)).toBe(false); // ← sólo `walkable` los separa
    }
  });

  it("MUTANTE de `openable`: sin él entrarían las SEIS puertas (su fondo es el marco)", () => {
    const puertas = [0x97, 0x98, 0xb8, 0xb9, 0xba, 0xbb];
    for (const t of puertas) {
      const info = TILE_INFO[t]!;
      expect(info.openable).toBe(true);
      expect(info.walkable).toBe(false); // `walkable` NO las echa: hace falta `openable`
      expect(info.flatTileSubstitutionName).toBe("BrickFloor");
      expect(isInteriorFurniture(t)).toBe(false);
    }
    expect(puertas.length).toBe(6);
  });

  it("MUTANTE del banco bajo y del herraje de muro: 0x200 y el Portcullis fuera", () => {
    // Sillas-comiendo / espejo de LB / prisionero de pared son ACTORES (≥0x100): no pasan por
    // la capa de terreno. Y el rastrillo 0x99 cuelga del vano — «nunca fondo de pared».
    for (const t of [0x134, 0x13c, 0x164, 0x200]) expect(isInteriorFurniture(t)).toBe(false);
    const rastrillo = TILE_INFO[0x99]!;
    expect(rastrillo.name).toBe("Portcullis");
    expect(rastrillo.walkable).toBe(false);
    expect(rastrillo.openable).toBe(false); // ni `walkable` ni `openable` lo echan
    expect(rastrillo.flatTileSubstitutionName).toBe("BrickFloor");
    expect(isInteriorFurniture(0x99)).toBe(false); // ← lo echa la lista de herrajes de muro
  });

  it("MUTANTE de los fuegos: siguen en SU vía (contorno + fn32), no en ésta", () => {
    for (const t of [0xb0, 0xb1, 0xb2, 0xb3, 0xbd, 0xbe, 0xbf, 0xde]) {
      expect(isFireTile(t)).toBe(true);
      expect(isInteriorFurniture(t)).toBe(false); // doble tratamiento evitado
    }
  });

  it("🔴 los DOS campos de sustitución DISCREPAN en el dato, y el careo separa CERO hoy", () => {
    // El testigo de la discrepancia es REAL: los barcos declaran índice 5 (Grass) y nombre
    // «Water», y `WheatInField` al revés (índice PlowedField, nombre None). 33 filas así.
    const barco = TILE_INFO[0x12c]!;
    expect(barco.name).toBe("PirateShipUp");
    expect(TILE_INFO[barco.flatTileSubstitutionIndex]!.name).toBe("Grass");
    expect(barco.flatTileSubstitutionName).toBe("Water");

    // PERO el careo que exige el predicado NO separa nada en el banco bajo: ningún tile es
    // «interior» por un campo y no por el otro. Se declara con su CONTADOR — es un cierre ante
    // cambios del vendor, no un freno vivo, y una condición que no separa nada tiene que
    // decirlo o parece que trabaja (la lección de #197: el mutante que sobrevive acusa al
    // testigo, no a la guarda). Si este cero deja de serlo, este aserto lo cuenta.
    const INTERIOR = ["BrickFloor", "MetalFloor"];
    let soloPorIndice = 0;
    let soloPorNombre = 0;
    TILE_INFO.forEach((info, id) => {
      if (!info || id >= 0x100) return;
      const porIdx =
        info.flatTileSubstitutionIndex >= 0 &&
        INTERIOR.includes(TILE_INFO[info.flatTileSubstitutionIndex]?.name ?? "");
      const porNom = INTERIOR.includes(info.flatTileSubstitutionName);
      if (porIdx && !porNom) soloPorIndice++;
      if (porNom && !porIdx) soloPorNombre++;
    });
    expect([soloPorIndice, soloPorNombre]).toEqual([0, 0]);
  });
});

describe("declaredFloorNeighbor — el suelo lo dicen los datos, no la mayoría", () => {
  const N = 3;
  const grid = (v: number[]): Int16Array => Int16Array.from(v);
  const BRICK = 0x44; // BrickFloor, el que declara el fuelle
  const SILLA = 0x90; // ChairBackForward: CAMINABLE, así que es candidato de underlay legítimo

  it("elige la celda con el suelo DECLARADO aunque la mayoría sea otra cosa", () => {
    // N=silla, S=silla, O=silla (mayoría 3) y E=ladrillo (1). El dominante daría la SILLA;
    // el declarado da el ladrillo. Ésta es la diferencia medida en 128 de 923 celdas reales.
    const tw = grid([0, SILLA, 0, SILLA, 0xfc, BRICK, 0, SILLA, 0]);
    expect(dominantFloorNeighbor(tw, N, 1, 1, isInteriorFurniture)?.tile).toBe(SILLA);
    expect(declaredFloorNeighbor(tw, N, 1, 1, BRICK)).toEqual({ tile: BRICK, row: 1, col: 2 });
  });

  it("sin el suelo declarado al lado → null (celda INTACTA, nunca una silla de fondo)", () => {
    const tw = grid([0, SILLA, 0, SILLA, 0xfc, SILLA, 0, SILLA, 0]);
    expect(declaredFloorNeighbor(tw, N, 1, 1, BRICK)).toBeNull();
  });

  it("no se sale de la ventana por los bordes", () => {
    const tw = grid([0xfc, BRICK, 0, 0, 0, 0, 0, 0, 0]);
    expect(declaredFloorNeighbor(tw, N, 0, 0, BRICK)?.col).toBe(1); // el E, dentro
    expect(declaredFloorNeighbor(tw, N, 2, 2, BRICK)).toBeNull(); // esquina opuesta, sin él
  });
});

describe("el FUELLE anima — el recorte NO puede congelar su frame", () => {
  const groups = buildAnimGroups();
  it("0xfc↔0xfd alternan por el reloj (divisor 4), como la fuente cicla sus cuatro", () => {
    const frames = new Set<number>();
    for (let phase = 0; phase < 16; phase++) {
      const f = animatedFrame(0xfc, phase, groups);
      expect(isInteriorFurniture(f)).toBe(true); // el frame vivo sigue siendo de la clase
      frames.add(f);
    }
    expect(frames).toEqual(new Set([0xfc, 0xfd])); // los DOS, no uno congelado
  });
  it("el RELOJ (0xfa/0xfb) y el reloj de ARENA (0xe8-0xeb) también alternan", () => {
    const reloj = new Set<number>();
    for (let phase = 0; phase < 16; phase++) reloj.add(animatedFrame(0xfa, phase, groups));
    expect(reloj).toEqual(new Set([0xfa, 0xfb]));
    const arena = new Set<number>();
    for (let phase = 0; phase < 16; phase++) arena.add(animatedFrame(0xe8, phase, groups));
    expect(arena).toEqual(new Set([0xe8, 0xe9, 0xea, 0xeb]));
  });
});
