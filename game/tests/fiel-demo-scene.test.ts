/**
 * DEMO-SCENE — el intérprete del cine-guion del attract (task #46 Stage 3).
 * Valida el parser de datos (demo-scene.json), la decodificación de los 16 opcodes
 * y el determinismo del playback. Deriva `re/notes/demo-scene-data.md` (FONT.OVL
 * font_scene_init 0x04a4 + scene_tick 0x02fc; MISCMAPS.DAT[704:]).
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import {
  buildDemoFrames,
  decodeScript,
  Op,
  MOONGATE_TILE,
  type DemoSceneData,
} from "../src/skin/fiel/demo-scene.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const data = JSON.parse(
  readFileSync(join(HERE, "..", "assets", "demo-scene.json"), "utf8"),
) as DemoSceneData;

describe("demo-scene.json (parser de MISCMAPS.DAT[704:])", () => {
  it("tiene 4 mapas de 4×19 + script + tablas de dirección N/E/S/W", () => {
    expect(data.cols).toBe(19);
    expect(data.rows).toBe(4);
    expect(data.maps).toHaveLength(4);
    expect(data.maps[0]).toHaveLength(4);
    expect(data.maps[0]![0]).toHaveLength(19);
    // Direcciones canónicas U5: N(0,-1) E(+1,0) S(0,+1) W(-1,0).
    expect(data.dirs.dcol).toEqual([0, 1, 0, -1]);
    expect(data.dirs.drow).toEqual([-1, 0, 1, 0]);
  });

  it("la escena 0 ES el estudio del Avatar byte-exacto (muro 0x4f, espejo 0x9d, planta 0x5b)", () => {
    const flat = data.maps[0]!.flat();
    expect(flat).toContain(0x4f); // StoneBrickWall (perímetro)
    expect(flat).toContain(0x9d); // Mirror
    expect(flat).toContain(0x5b); // Plant
    expect(flat).toContain(0x44); // BrickFloor
    // fila 0 arranca con borde negro (0xff) + muro (0x4f).
    expect(data.maps[0]![0]!.slice(0, 3)).toEqual([0xff, 0xff, 0x4f]);
  });

  it("lleva los 4 rótulos de escena del cluster (The Summoning/Journey/Arrival/Welcoming)", () => {
    expect(data.titles).toEqual(["The Summoning", "The Journey", "The Arrival", "The Welcoming"]);
  });

  it("SOLO la escena 0 tiene borde 0xff (por eso no llena todo el ancho); las demás son full-width", () => {
    // El usuario: "la primera escena no cubre el ancho entero". 0xff = celda negra/borde.
    expect(data.maps[0]!.flat()).toContain(0xff);
    expect(data.maps[1]!.flat()).not.toContain(0xff);
    expect(data.maps[2]!.flat()).not.toContain(0xff);
    expect(data.maps[3]!.flat()).not.toContain(0xff);
  });

  it("The Arrival (escena 2) trae tiles de CASCADA (0xd4) — el ambiente de agua del witness", () => {
    // Requisito del usuario: el sonido de la cascada debe sonar como en el juego.
    expect(data.maps[2]!.flat().some((t) => (t & 0xfc) === 0xd4)).toBe(true);
    expect(data.maps[0]!.flat().some((t) => (t & 0xfc) === 0xd4)).toBe(false);
  });
});

describe("decodeScript (16 opcodes, jump table FONT 0x94a)", () => {
  const instrs = decodeScript(data.script);

  it("el script cierra EXACTO en EOF con RESTART (bucle del attract)", () => {
    expect(data.script[data.script.length - 1]).toBe(Op.RESTART); // 9
    expect(instrs.at(-1)!.op).toBe(Op.RESTART);
  });

  it("arranca cargando la escena 0 y limpiando actores (SCENE 0; CLEAR)", () => {
    expect(instrs[0]).toEqual({ op: Op.SCENE, args: [0] });
    expect(instrs[1]).toEqual({ op: Op.CLEAR, args: [] });
  });

  it("recorre las 4 escenas encadenadas (LOAD_SCENE 0,1,2,3)", () => {
    const scenes = instrs.filter((i) => i.op === Op.SCENE).map((i) => i.args[0]);
    expect(scenes).toEqual([0, 1, 2, 3]);
  });

  it("contiene moongates (RISE+FALL), un SUMMON y pasos WALK coreografiados", () => {
    const kinds = new Set(instrs.map((i) => i.op));
    expect(kinds.has(Op.MGRISE)).toBe(true);
    expect(kinds.has(Op.MGFALL)).toBe(true);
    expect(kinds.has(Op.SUMMON)).toBe(true);
    expect(instrs.filter((i) => i.op === Op.WALK).length).toBeGreaterThan(20);
  });

  it("todos los opcodes decodifican dentro de rango (0..15, ningún byte perdido como dato)", () => {
    for (const i of instrs) expect(i.op).toBeLessThanOrEqual(15);
  });
});

describe("buildDemoFrames (playback determinista)", () => {
  const frames = buildDemoFrames(data);

  it("produce un ciclo de frames no vacío y determinista (dos pasadas idénticas)", () => {
    expect(frames.length).toBeGreaterThan(100);
    const again = buildDemoFrames(data);
    expect(again.length).toBe(frames.length);
    // comparación estructural de una muestra + longitudes de tiles
    expect(again[0]).toEqual(frames[0]);
    expect(again.at(-1)).toEqual(frames.at(-1));
    expect(frames.every((f) => f.tiles.length === data.rows * data.cols)).toBe(true);
  });

  it("visita las 4 escenas en orden a lo largo del ciclo", () => {
    const order: number[] = [];
    for (const f of frames) if (order.at(-1) !== f.scene) order.push(f.scene);
    expect(order).toEqual([0, 1, 2, 3]);
  });

  it("dispara TRUENO en los moongates y un SUMMON", () => {
    const sfx = frames.map((f) => f.sfx).filter(Boolean);
    expect(sfx).toContain("thunder");
    expect(sfx).toContain("summon");
  });

  it("planta el tile del moongate (0xdc) en algún frame", () => {
    expect(frames.some((f) => f.tiles.includes(MOONGATE_TILE))).toBe(true);
  });

  it("los ACTORES se blitean al banco de móviles (+0x100): el byte 0xfc del guion = sprite 0x1fc (Shadowlord)", () => {
    // FONT 0x02a2 0x2e3: ah=0; ah+=1 → tile|0x0100. Sin esto los actores salían como
    // tiles de terreno (0x4c=rocas, 0x50=muro, 0xfc=amarillo) en vez de personajes.
    expect(frames.some((f) => f.tiles.includes(0x1fc))).toBe(true); // Shadowlord (0xfc+0x100)
    expect(frames.some((f) => f.tiles.includes(0x150))).toBe(true); // Avatar del estudio (0x50+0x100)
    expect(frames.some((f) => f.tiles.includes(0x14c))).toBe(true); // Avatar exterior (0x4c+0x100)
    // slot9 (tile 0x16) es el CÍRCULO DE INVOCACIÓN gris = sprite 0x116 (witness f070).
    expect(frames.some((f) => f.tiles.includes(0x116))).toBe(true);
    // El byte crudo 0x16 no debe aparecer como tile dibujado (siempre va +0x100).
    expect(frames.some((f) => f.tiles.includes(0x16))).toBe(false);
  });

  it("revela la escena por cortina: el primer frame oculta columnas (-1), un frame tardío no", () => {
    // Tras LOAD_SCENE la cortina arranca en el eje: casi todo oculto.
    expect(frames[0]!.tiles.filter((t) => t === -1).length).toBeGreaterThan(0);
  });
});
