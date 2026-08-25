/**
 * CELDA DE DEPÓSITO DE LA SALIDA DE MAZMORRA — la MISMA en las dos capas.
 *
 * El port sumaba `+1` a la `y` sólo al salir a Britannia (`exitDungeonTo`), y el `+1` estaba
 * FIJADO por sus propios asertos. No tiene respaldo en el binario. Adjudicado en
 * `re/notes/britannia-y1-acta.md`; las citas, porque este fichero es el guarda:
 *
 *   DUNGEON.OVL 0x1d08 (rutina de salida)
 *     1d09  mov al,[g_location] · 1d0e  mov si,ax
 *     1d10  mov al,[si + 0x1e89] → 1d14  mov [g_party_x],al
 *     1d17  mov al,[si + 0x1eb1] → 1d1b  mov [g_party_y],al
 *     1d25  cmp [g_floor],0 → 1d2c/1d36 planta 0xFF/0 + cadena "Underworld!"/"Britannia!"
 *   Las dos coordenadas se escriben ANTES del test de capa, y el test de capa sólo toca
 *   `g_floor` y la cadena. No hay término por capa, ni por costura, ni en los llamadores
 *   (0x1dce→0x1dd1 y 0x1f44→0x1f47 no vuelven a tocar `g_party_y`).
 *
 *   MAINOUT.OVL 0x0790 (entrada) — y esto es lo que hace el ajuste IMPOSIBLE, no sólo ausente:
 *     07a8  cmp byte ptr [si + 0x1e8a],dl   ; g_party_x
 *     07ae  cmp byte ptr [si + 0x1eb2],cl   ; g_party_y
 *     0887  mov al,[bp-2] · 088a  inc al · 088c  mov [g_location],al   ⇒ g_location = si+1
 *   La entrada EXIGE estar sobre esa celda, y direcciona el mismo byte que la salida:
 *   0x1e8a+si = 0x1e89+(si+1). Salir devuelve exactamente a la celda desde la que se entró.
 *
 * Los tres asertos de abajo son independientes: la celda cruda, la IGUALDAD entre capas
 * (que es la propiedad estructural, invariante al valor de la tabla) y el viaje de ida y
 * vuelta (que es la identidad de los dos sitios del ASM).
 */
import { describe, it, expect } from "vitest";
import {
  CellType,
  type DungeonCell,
  type DungeonData,
  type DungeonState,
} from "../src/core/dungeon/dungeon.js";
import {
  enterDungeon,
  exitDungeonTo,
  setDungeonPos,
  type DungeonCmdsCtx,
} from "../src/core/dungeon/dungeon-cmds.js";
import { OriginalRng } from "../src/core/rng-original.js";
import type { GameEvent } from "../src/core/game.js";
import type { GameState } from "../src/core/state.js";

const DECEIT = 33;
const N = 8;

/** Mazmorra 8×8×8 vacía con la escalera-arriba en (f0,1,1) — la que busca `enterDungeon`. */
function makeDungeon(location: number, name: string): DungeonData {
  const floors: DungeonCell[][][] = Array.from({ length: N }, () =>
    Array.from({ length: N }, () =>
      Array.from({ length: N }, (): DungeonCell => ({ type: CellType.Nothing, sub: 0 })),
    ),
  );
  floors[0]![1]![1] = { type: 0x1, sub: 0 };
  return { location, name, floors };
}

/** X e Y con series DISTINTAS y no correlativas: un índice o un eje cruzado no puede colar. */
const LOC_X = Array.from({ length: 41 }, (_, i) => 10 + i * 3);
const LOC_Y = Array.from({ length: 41 }, (_, i) => 200 - i * 2);
const IDX = DECEIT - 1;

function makeCtx(): { ctx: DungeonCmdsCtx; ds: () => DungeonState | null } {
  const rng = new OriginalRng(0x1234);
  let dungeonState: DungeonState | null = null;
  const state = {
    position: { location: 0, floor: 0, x: 0, y: 0 },
    dungeonRoomsCleared: undefined,
  } as unknown as GameState;
  const ctx: DungeonCmdsCtx = {
    state,
    rand: (lo, hi) => rng.next(lo, hi),
    liveRng: rng,
    dungeons: [makeDungeon(DECEIT, "Deceit")],
    locationsX: LOC_X,
    locationsY: LOC_Y,
    getDungeonState: () => dungeonState,
    setDungeonState: (d) => {
      dungeonState = d;
    },
    locationNameBanner: () => undefined,
    hydrateUnderworldPlot: () => undefined,
    clearOverworldEnemies: () => undefined,
    startDungeonRoomCombat: () => [],
    startDungeonCorridorCombat: () => [],
    checkDoomRescue: () => [],
    checkRefuge: () => [],
  };
  return { ctx, ds: () => dungeonState };
}

/** Deja la party dentro de la mazmorra sin pasar por la celda de superficie. */
function inside(ctx: DungeonCmdsCtx): void {
  setDungeonPos(ctx, DECEIT, 0, 1, 1, "south");
}

describe("salida de mazmorra — celda de depósito (DUNGEON 0x1d10-0x1d1b)", () => {
  it("a Britannia deposita en locationsX/Y EN CRUDO (sin desplazamiento en y)", () => {
    const { ctx } = makeCtx();
    inside(ctx);
    const events: GameEvent[] = [];
    exitDungeonTo(ctx, events, false);
    expect(ctx.state.position).toEqual({ location: 0, floor: 0, x: LOC_X[IDX], y: LOC_Y[IDX] });
  });

  it("al Underworld deposita en la MISMA celda, sólo cambia la planta (0xFF)", () => {
    const { ctx } = makeCtx();
    inside(ctx);
    const events: GameEvent[] = [];
    exitDungeonTo(ctx, events, true);
    expect(ctx.state.position).toEqual({ location: 0, floor: 0xff, x: LOC_X[IDX], y: LOC_Y[IDX] });
  });

  it("★ las DOS capas depositan en la misma (x,y): el test de capa (0x1d25) es POSTERIOR a las dos escrituras", () => {
    const a = makeCtx();
    inside(a.ctx);
    exitDungeonTo(a.ctx, [], false);
    const b = makeCtx();
    inside(b.ctx);
    exitDungeonTo(b.ctx, [], true);
    // Invariante ESTRUCTURAL: no depende del valor de la tabla, sólo de que no haya término por capa.
    expect({ x: a.ctx.state.position.x, y: a.ctx.state.position.y }).toEqual({
      x: b.ctx.state.position.x,
      y: b.ctx.state.position.y,
    });
    expect(a.ctx.state.position.floor).toBe(0);
    expect(b.ctx.state.position.floor).toBe(0xff);
  });

  it("★★ IDA Y VUELTA: se sale a la MISMA celda desde la que la entrada exige entrar (0x1e8a+si = 0x1e89+si+1)", () => {
    const { ctx } = makeCtx();
    // La entrada real sólo dispara estando sobre el tile de la tabla (MAINOUT 0x07a8/0x07ae).
    ctx.state.position = { location: 0, floor: 0, x: LOC_X[IDX]!, y: LOC_Y[IDX]! };
    const before = { ...ctx.state.position };
    enterDungeon(ctx, DECEIT, 0);
    expect(ctx.state.position, "entrar no mueve el tile de superficie").toEqual(before);
    exitDungeonTo(ctx, [], false);
    expect(ctx.state.position).toEqual(before);
  });
});
