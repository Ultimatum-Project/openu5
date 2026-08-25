/**
 * HAZ DEL FARO (#326) — core/world/lighthouse.ts + su cableado en coreview.
 *
 * Derivación (re/notes/efectos-visuales-326.md §1, re-verificada sobre este árbol):
 * `lighthouse_beam_rotate_anim` (ULTIMA.EXE 0x70a6) GIRA una cuña de 3 rayos de la
 * rosa de 16 (tabla DS 0x1f7e) y la estampa en el buffer de celdas iluminadas
 * 0xAD14 (0x7040/0x7091), el mismo que consultan las tres ramas del pase de la
 * party (5c29/5c40/5c8c). Emisores: tile 0x2a en pueblos (TOWN.OVL 0x04ca), 0x1b
 * en el overworld (OUTSUBS.OVL 0x026b). Puerta: `g_light_level >= 0x32` o sin
 * emisor ⇒ fase 0xff.
 *
 * Los esperados van EN CRUDO (bytes/celdas literales), y la tabla además se carea
 * byte a byte contra DATA.OVL con control positivo delante.
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  BEAM_DAY_GATE,
  BEAM_INACTIVE,
  BEAM_RAYS,
  BEAM_RAY_COUNT,
  BEAM_REACH,
  LIGHTHOUSE_LIGHT_TILE,
  LIGHTHOUSE_TILE,
  advanceBeamPhase,
  beamLitWindowCells,
} from "../src/core/world/lighthouse.js";
import { CENTER, WINDOW, computeVisibleWindow } from "../src/core/world/visibility.js";
import { TILE_INFO } from "../src/core/tiles.js";

const idx = (col: number, row: number): number => row * WINDOW + col;

describe("tabla de rayos 0x1f7e — careo byte a byte contra DATA.OVL", () => {
  const dataOvl = readFileSync(
    fileURLToPath(new URL("../../original/u5/play/DATA.OVL", import.meta.url)),
  );
  const FILE_OFF = 0x1f7e + 0x10; // delta DS→file = +0x10

  it("CONTROL POSITIVO del delta +0x10: la tabla radial (DS 0x6AA8) sale donde debe", () => {
    // Primera fila de RADIAL_DISTANCE (visibility.ts, ya careada): 50,41,34,29,26,25.
    const radial = dataOvl.subarray(0x6aa8 + 0x10, 0x6aa8 + 0x10 + 6);
    expect([...radial]).toEqual([50, 41, 34, 29, 26, 25]);
  });

  it("los 16 rayos × 16 pares (dx,dy) coinciden con el fichero (bytes con signo)", () => {
    const sgn = (b: number): number => (b > 127 ? b - 256 : b);
    for (let ray = 0; ray < BEAM_RAY_COUNT; ray++) {
      const ent = dataOvl.subarray(FILE_OFF + ray * 32, FILE_OFF + ray * 32 + 32);
      const filePairs = Array.from({ length: 16 }, (_, i) => [sgn(ent[i * 2]!), sgn(ent[i * 2 + 1]!)]);
      expect(BEAM_RAYS[ray]!.map((p) => [...p])).toEqual(filePairs);
    }
  });
});

describe("tabla de rayos — geometría EN CRUDO (sin pasar por el fichero)", () => {
  it("rayo 1 = NORTE: la columna (0,-1..-7) + los flancos ±1 desde -4", () => {
    expect(BEAM_RAYS[1]!.map((p) => [...p])).toEqual([
      [0, -1], [0, -2], [0, -3], [0, -4], [0, -5], [0, -6], [0, -7],
      [-1, -4], [-1, -5], [-1, -6], [-1, -7],
      [1, -4], [1, -5], [1, -6], [1, -7],
      [0, 0],
    ]);
  });
  it("rayo 5 = ESTE y rayo 13 = OESTE (simétricos)", () => {
    expect(BEAM_RAYS[5]!.map((p) => [...p])).toEqual([
      [1, 0], [2, 0], [3, 0], [4, 0], [5, 0], [6, 0], [7, 0],
      [4, -1], [5, -1], [6, -1], [7, -1],
      [4, 1], [5, 1], [6, 1], [7, 1],
      [0, 0],
    ]);
    // El OESTE es el ESTE con dx negado (misma forma, [dy] con flancos invertidos en orden).
    expect(BEAM_RAYS[13]!.map((p) => [...p])).toEqual([
      [-1, 0], [-2, 0], [-3, 0], [-4, 0], [-5, 0], [-6, 0], [-7, 0],
      [-4, 1], [-5, 1], [-6, 1], [-7, 1],
      [-4, -1], [-5, -1], [-6, -1], [-7, -1],
      [0, 0],
    ]);
  });
  it("todos los rayos llevan al menos un relleno (0,0): la torre siempre queda en el buffer", () => {
    for (const ray of BEAM_RAYS) {
      expect(ray.some(([dx, dy]) => dx === 0 && dy === 0)).toBe(true);
    }
  });
  it("BEAM_REACH se DERIVA de la tabla y vale 7 (hay |7| y no hay |8|)", () => {
    expect(BEAM_REACH).toBe(7);
    const all = BEAM_RAYS.flat();
    expect(all.some(([dx, dy]) => Math.abs(dx) === 7 || Math.abs(dy) === 7)).toBe(true);
    expect(all.some(([dx, dy]) => Math.abs(dx) > 7 || Math.abs(dy) > 7)).toBe(false);
  });
  it("los tiles emisores y la puerta de día, EN CRUDO y por NOMBRE", () => {
    expect(LIGHTHOUSE_LIGHT_TILE).toBe(0x2a);
    expect(TILE_INFO[LIGHTHOUSE_LIGHT_TILE]!.name).toBe("LighthouseLight");
    expect(LIGHTHOUSE_TILE).toBe(0x1b);
    expect(TILE_INFO[LIGHTHOUSE_TILE]!.name).toBe("Lighthouse");
    expect(BEAM_DAY_GATE).toBe(0x32); // 0x70a6 `cmp g_light_level, 0x32; jae`
  });
});

describe("fase del haz (0x70a6): activación, avance y wrap", () => {
  it("activación 0xff→0 (0x70c8) y avance p→p+1 (0x7161)", () => {
    expect(advanceBeamPhase(BEAM_INACTIVE)).toBe(0);
    expect(advanceBeamPhase(0)).toBe(1);
    expect(advanceBeamPhase(5)).toBe(6);
  });
  it("wrap: fase 15 → 0 (0x719c `cmp 0xf; jbe` + 0x71a3)", () => {
    expect(advanceBeamPhase(15)).toBe(0);
  });
});

describe("la cuña = unión {p, p+1, p+2} — EQUIVALENTE EXACTO al sellado incremental del asm", () => {
  it("simulación de 48 pasadas off/on contra el modelo de unión: idénticas", () => {
    // El asm no re-estampa la cuña entera: apaga el rayo p (0x7132, valor 0) y
    // enciende el p+3 (0x718c, valor 0xff), y 0xAD14 PERSISTE entre redibujos
    // (0x5e4a sólo lo reconstruye al cargar mapa / cambiar emisores). Este test
    // reproduce ESA semántica de buffer y la carea con `beamLitWindowCells`.
    // MUTANTE que mata: una cuña de 2 rayos (o de 4) diverge en la primera pasada.
    const buf = new Map<string, number>();
    const stamp = (ray: number, val: number): void => {
      for (const [dx, dy] of BEAM_RAYS[((ray % 16) + 16) % 16]!) buf.set(`${dx},${dy}`, val);
    };
    // Activación (0x70c1-0x70fe): fase 0xff → 0, enciende rayos 0, 1, 2.
    let phase = advanceBeamPhase(BEAM_INACTIVE);
    stamp(0, 1);
    stamp(1, 1);
    stamp(2, 1);
    const emitter = [CENTER, CENTER] as const; // la unión se compara vía celdas de ventana
    for (let paso = 0; paso < 48; paso++) {
      const litBuf = new Set<number>();
      for (const [key, v] of buf) {
        if (!v) continue;
        const [dx, dy] = key.split(",").map(Number) as [number, number];
        const col = emitter[0] + dx;
        const row = emitter[1] + dy;
        if (col >= 0 && row >= 0 && col < WINDOW && row < WINDOW) litBuf.add(idx(col, row));
      }
      const model = beamLitWindowCells([emitter], phase)!;
      expect([...model].sort()).toEqual([...litBuf].sort());
      // Pasada siguiente (0x7132-0x7199): off p, inc, on (fase nueva)+2.
      stamp(phase, 0);
      phase = advanceBeamPhase(phase);
      stamp(phase + 2, 1);
    }
  });

  it("fase inactiva o sin emisores → undefined (nada que fusionar)", () => {
    expect(beamLitWindowCells([[CENTER, CENTER]], BEAM_INACTIVE)).toBeUndefined();
    expect(beamLitWindowCells([], 0)).toBeUndefined();
  });

  it("emisor fuera de la ventana: sólo entran las celdas que caen dentro", () => {
    // Emisor 3 columnas al ESTE del borde (col 13): con fase 13 (cuña O/ONO/NO)
    // el rayo 13 mete (-1..-7, 0) → columnas 12..6; dentro de la ventana: 6..10.
    const lit = beamLitWindowCells([[13, CENTER]], 13)!;
    expect(lit.has(idx(10, CENTER))).toBe(true); // (-3, 0)
    expect(lit.has(idx(6, CENTER))).toBe(true); // (-7, 0)
    // Todos los índices devueltos caen dentro de la ventana (el estampador del
    // asm acota a 0..31 del chunk; aquí la cota es la ventana).
    for (const i of lit) {
      expect(i).toBeGreaterThanOrEqual(0);
      expect(i).toBeLessThan(WINDOW * WINDOW);
    }
  });

  it("cuña con wrap: fase 15 enciende {15, 0, 1} — cruza el norte", () => {
    const lit = beamLitWindowCells([[CENTER, CENTER]], 15)!;
    // rayo 15 (NO): (-1,-1); rayo 0 (NNO): (-1,-2); rayo 1 (N): (0,-1).
    expect(lit.has(idx(CENTER - 1, CENTER - 1))).toBe(true);
    expect(lit.has(idx(CENTER - 1, CENTER - 2))).toBe(true);
    expect(lit.has(idx(CENTER, CENTER - 1))).toBe(true);
    // NEGATIVO: el ESTE (rayo 5, (2,0)) está apagado en esa cuña.
    expect(lit.has(idx(CENTER + 2, CENTER))).toBe(false);
  });
});

describe("computeVisibleWindow + beamLit — el haz es una FUENTE DE LUZ, no un sprite", () => {
  const OPEN = (): number => 5;

  it("de noche (2), la cuña norte del faro adyacente REVELA el pasillo del rayo", () => {
    // Emisor en (6,5) (dentro del disco nocturno de la party) con fase 1 (cuña
    // N/NNE/NNO… en realidad {1,2,3}): el rayo 1 sube en columna — (6,4), (6,3),
    // (6,2), (6,1) encadenan puente a puente hasta arriba.
    const beam = beamLitWindowCells([[6, 5]], 1)!;
    const lit = computeVisibleWindow(2, OPEN, beam);
    const dark = computeVisibleWindow(2, OPEN);
    for (const row of [4, 3, 2, 1, 0]) {
      expect(lit[idx(6, row)]).toBe(1); // el rayo se VE
    }
    // NEGATIVO (sin haz, mismas celdas): fuera del radio 2 todo eso es negro.
    for (const row of [3, 2, 1, 0]) {
      expect(dark[idx(6, row)]).toBe(0);
    }
  });

  it("RESPLANDOR (#350): un trozo de haz aislado sobre suelo abierto SÍ se ve — y el que un muro sella o ilumina a medias, NO", () => {
    // 🔴 Hasta #350-resplandor este test se llamaba «PUENTE (#256): un trozo de
    // haz AISLADO del disco NO se ve» y fijaba 0 para estas tres celdas. Ese 0
    // salía de la lectura de #256 (transparente-fuera-de-radio exige padre
    // visible+lit), NO de una medición del oráculo — y la derivación de #350
    // (re/notes/resplandor-350-derivacion.md, 726/726 contra RAM) la corrigió:
    // el haz estampa el MISMO 0xAD14 que los halos (0x7091) y el pase de la
    // party lo consume sin distinguir la fuente; una celda TRANSPARENTE
    // iluminada alcanzable —aunque el paseo cruce oscuridad— se enciende por
    // sí sola (5c52-5c91). El trozo aislado sobre suelo abierto SE VE.
    const isla = new Set([idx(9, 0), idx(10, 0), idx(10, 1)]);
    const field = computeVisibleWindow(2, OPEN, isla);
    expect(field[idx(9, 0)]).toBe(1);
    expect(field[idx(10, 0)]).toBe(1);
    expect(field[idx(10, 1)]).toBe(1);

    // El papel de DISCRIMINADOR contra el mutante «pintar beamLit directo en el
    // campo» no se pierde: se muda a donde la semántica derivada sigue diciendo
    // NO. (a) Un MURO iluminado por el haz sin padre visible+iluminado queda a
    // oscuras (5c05-5c45: el test del padre es de la rama OPACA).
    const muro = (c: number, r: number): number => (c === 9 && r === 0 ? 0x4f : 5);
    const muroLit = computeVisibleWindow(2, muro, new Set([idx(9, 0)]));
    expect(muroLit[idx(9, 0)]).toBe(0);
    // (b) Un trozo de haz SELLADO tras un anillo de muro no se alcanza: los
    // muros no propagan el paseo (ni visibles ni ocultos).
    const sellado = (c: number, r: number): number =>
      (c === 8 && r <= 1) || (c >= 8 && r === 2) ? 0x4f : 5;
    const dentro = new Set([idx(9, 0), idx(10, 0), idx(10, 1)]);
    const selladoField = computeVisibleWindow(2, sellado, dentro);
    expect(selladoField[idx(9, 0)]).toBe(0);
    expect(selladoField[idx(10, 0)]).toBe(0);
    expect(selladoField[idx(10, 1)]).toBe(0);
  });

  it("de DÍA (50) el haz no añade nada: la ventana ya está entera (puerta 0x32 aparte)", () => {
    const beam = beamLitWindowCells([[CENTER, CENTER]], 0)!;
    const conHaz = computeVisibleWindow(50, OPEN, beam);
    const sinHaz = computeVisibleWindow(50, OPEN);
    expect([...conHaz]).toEqual([...sinHaz]);
  });
});
