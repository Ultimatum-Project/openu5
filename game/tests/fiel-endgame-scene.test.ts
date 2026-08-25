/**
 * ENDGAME-SCENE — el driver procedural de la cinemática final (task #20, Lote 2).
 * Valida las dos primitivas de movimiento (move_sprite_toward / wander_sprite), el
 * determinismo del playback y el FORK de la caja. Deriva ENDGAME.OVL 0x0510/0x05a2/0x0648
 * (ver game/src/skin/fiel/endgame-scene.ts + .superpowers/sdd/brief-endgame.md).
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import {
  buildEndgameCutscene,
  moveSpriteToward,
  wanderSprite,
  GATE_CELL,
  LB_START,
  LB_THRONE,
  MOONGATE_STEPS,
  MOONGATE_TILE,
  FLOOR_TILE,
  EndgameRng,
  type EndgameActor,
  type EndgameOptions,
} from "../src/skin/fiel/endgame-scene.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const endgame = JSON.parse(
  readFileSync(join(HERE, "..", "assets", "endgame.json"), "utf8"),
) as { scene: { tiles: number[][] } };

const MAP = endgame.scene.tiles;

function opts(over: Partial<EndgameOptions> = {}): EndgameOptions {
  return {
    lordBritishTile: 0x7c,
    partyTiles: [0x40, 0x41, 0x42],
    hasBox: true,
    answeredYes: true,
    map: MAP,
    ...over,
  };
}

describe("moveSpriteToward (ENDGAME 0x0510 — un tile hacia el objetivo)", () => {
  it("mueve por el eje de mayor distancia; devuelve false al llegar o inactivo", () => {
    const a: EndgameActor = { tile: 1, col: 5, row: 8, active: true };
    // dcol=0, drow=5 → mueve fila hacia 3.
    expect(moveSpriteToward(a, 5, 3)).toBe(true);
    expect(a).toMatchObject({ col: 5, row: 7 });
    // ya en destino → false.
    const b: EndgameActor = { tile: 1, col: 5, row: 3, active: true };
    expect(moveSpriteToward(b, 5, 3)).toBe(false);
    // inactivo → false.
    const c: EndgameActor = { tile: 1, col: 0, row: 0, active: false };
    expect(moveSpriteToward(c, 9, 9)).toBe(false);
  });

  it("converge en (distancia Chebyshev) pasos hasta el objetivo", () => {
    const a: EndgameActor = { tile: 1, col: LB_START.col, row: LB_START.row, active: true };
    let steps = 0;
    while (moveSpriteToward(a, LB_THRONE.col, LB_THRONE.row)) steps++;
    expect(a).toMatchObject({ col: LB_THRONE.col, row: LB_THRONE.row });
    expect(steps).toBe(Math.max(Math.abs(LB_START.col - LB_THRONE.col), Math.abs(LB_START.row - LB_THRONE.row)));
  });
});

describe("wanderSprite (ENDGAME 0x05a2 — paso aleatorio a suelo 0x44)", () => {
  it("sólo pisa suelo (0x44) y es determinista bajo la misma semilla", () => {
    const mk = (): EndgameActor => ({ tile: 1, col: 5, row: 5, active: true });
    const run = (seed: number): Array<[number, number]> => {
      const a = mk();
      const rng = new EndgameRng(seed);
      const path: Array<[number, number]> = [];
      for (let i = 0; i < 40; i++) {
        wanderSprite(a, MAP, rng);
        path.push([a.col, a.row]);
        expect(MAP[a.row]?.[a.col]).toBe(FLOOR_TILE); // nunca sale del suelo
      }
      return path;
    };
    expect(run(123)).toEqual(run(123)); // determinista
    expect(run(123)).not.toEqual(run(999)); // la semilla importa
  });

  it("un actor inactivo no se mueve", () => {
    const a: EndgameActor = { tile: 1, col: 5, row: 5, active: false };
    wanderSprite(a, MAP, new EndgameRng(1));
    expect(a).toMatchObject({ col: 5, row: 5 });
  });
});

describe("buildEndgameCutscene — estructura y determinismo", () => {
  it("es determinista (misma entrada → mismos frames)", () => {
    expect(buildEndgameCutscene(opts())).toEqual(buildEndgameCutscene(opts()));
  });

  it("Lord British entra caminando: el primer frame lo pone en LB_START", () => {
    const frames = buildEndgameCutscene(opts());
    const lb0 = frames[0]!.actors[0]!;
    expect(lb0).toMatchObject({ tile: 0x7c, col: LB_START.col, row: LB_START.row });
    // en algún frame posterior llega al trono.
    const arrived = frames.some((f) => f.actors.some((a) => a.tile === 0x7c && a.col === LB_THRONE.col && a.row === LB_THRONE.row));
    expect(arrived).toBe(true);
  });

  it("emite la pregunta de la caja (cue prompt) una vez", () => {
    const prompts = buildEndgameCutscene(opts()).filter((f) => f.cue?.kind === "prompt");
    expect(prompts.length).toBe(1);
  });
});

describe("buildEndgameCutscene — rama BUENA (caja + 'sí')", () => {
  const frames = buildEndgameCutscene(opts({ hasBox: true, answeredYes: true }));

  it("el moongate sube y baja 16 pasos (etapas 1..16 presentes)", () => {
    const stages = new Set(frames.map((f) => f.moongate).filter((s): s is number => s !== null));
    for (let s = 1; s <= MOONGATE_STEPS; s++) expect(stages.has(s)).toBe(true);
  });

  it("el party desaparece por el gate (ningún actor de party activo al final)", () => {
    const last = frames[frames.length - 1]!;
    // Sólo puede quedar Lord British (tile 0x7c); el party (0x40..0x42) ya entró al gate.
    expect(last.actors.every((a) => a.tile === 0x7c)).toBe(true);
  });

  it("muestra las 6 páginas de epílogo (END.DAT) y termina con el pergamino", () => {
    const pages = frames.filter((f) => f.cue?.kind === "narration").map((f) => (f.cue as { page: number }).page);
    expect(pages).toEqual([0, 1, 2, 3, 4, 5]);
    expect(frames[frames.length - 1]!.cue).toEqual({ kind: "scroll" });
  });

  it("recorre la narración del Orb (ENDMSG records 3..9)", () => {
    const dlg = frames.filter((f) => f.cue?.kind === "dialogue").map((f) => (f.cue as { index: number }).index);
    for (let i = 3; i <= 9; i++) expect(dlg).toContain(i);
  });
});

describe("buildEndgameCutscene — rama ALTERNATIVA (sin caja o 'no')", () => {
  it("sin caja: 'pull up a chair' (record 10), sin moongate, sin pergamino, acotado", () => {
    const frames = buildEndgameCutscene(opts({ hasBox: false, answeredYes: true, alternateFrames: 20 }));
    const dlg = frames.filter((f) => f.cue?.kind === "dialogue").map((f) => (f.cue as { index: number }).index);
    expect(dlg).toContain(10);
    expect(frames.every((f) => f.moongate === null)).toBe(true);
    expect(frames.every((f) => f.cue?.kind !== "scroll")).toBe(true);
    expect(frames.every((f) => f.cue?.kind !== "narration")).toBe(true);
  });

  it("respondió 'no' aunque tenga la caja → también es la rama alternativa", () => {
    const frames = buildEndgameCutscene(opts({ hasBox: true, answeredYes: false, alternateFrames: 10 }));
    expect(frames.some((f) => f.cue?.kind === "scroll")).toBe(false);
    expect(frames.some((f) => (f.cue as { index?: number })?.index === 10)).toBe(true);
  });

  it("el tope alternateFrames acota el bucle de wander (el original es infinito)", () => {
    const short = buildEndgameCutscene(opts({ hasBox: false, alternateFrames: 5 }));
    const long = buildEndgameCutscene(opts({ hasBox: false, alternateFrames: 50 }));
    expect(long.length).toBeGreaterThan(short.length);
  });
});
