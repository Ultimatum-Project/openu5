/**
 * COSTURA DE ARNÉS `setDungeonPos` — CERO-RAND, verificado con CONTADOR DE RAND.
 *
 * El resync de interior del WALKTHROUGH-ESPEJO necesita fijar mazmorra+planta+celda+FACING
 * sin mover el stream (todas las costuras del espejo son cero-rand a propósito: el
 * instrumento no debe tocar lo que la medición compara). `teleportDungeon`, el hook que ya
 * existía, NO sirve por dos razones que estos tests fijan como contrato:
 *
 *  1. **No fija el facing.** Y dentro del 3D el facing decide qué se ve y hacia dónde avanza
 *     un `Advance`: resincronizar la celda sin el facing deja la party mirando a otro sitio.
 *  2. **No es cero-rand.** Si no estás dentro entra por `enterDungeon`, cuyo epílogo llama
 *     `ds.respawnWanderer()` — el único consumidor de rand del camino de entrada (banco
 *     `rand(0,7)` + hasta 8 celdas `rand(0,63)` + roll de oculto `rand(0,99)`, wanderer.ts).
 *
 * El contador va donde el consumo REALMENTE ocurre: el `OriginalRng` inyectado (`liveRng`,
 * el g_rng_seed compartido) y el `RandFn` del ctx. Se cuentan LLAMADAS, y además se compara
 * la SEMILLA VIVA antes/después (un rand deja huella en g_rng_seed).
 */
import { describe, it, expect } from "vitest";
import {
  CellType,
  type DungeonCell,
  type DungeonData,
  type DungeonState,
} from "../src/core/dungeon/dungeon.js";
import { setDungeonPos, enterDungeon, type DungeonCmdsCtx } from "../src/core/dungeon/dungeon-cmds.js";
import { OriginalRng } from "../src/core/rng-original.js";
import type { GameState } from "../src/core/state.js";

const DECEIT = 33;
const DESPISE = 34;
const N = 8;

/** OriginalRng que CUENTA cada tirada (misma clase → DungeonState lo acepta tal cual). */
class CountingRng extends OriginalRng {
  calls = 0;
  override next(lo: number, hi: number): number {
    this.calls++;
    return super.next(lo, hi);
  }
}

/** Mazmorra 8×8×8: todo Nothing salvo una escalera-arriba en (f0,1,1) — la que busca
 *  `enterDungeon` desde superficie. */
function makeDungeon(location: number, name: string): DungeonData {
  const floors: DungeonCell[][][] = Array.from({ length: N }, () =>
    Array.from({ length: N }, () =>
      Array.from({ length: N }, (): DungeonCell => ({ type: CellType.Nothing, sub: 0 })),
    ),
  );
  floors[0]![1]![1] = { type: 0x1, sub: 0 }; // escalera arriba (entrada de superficie)
  return { location, name, floors };
}

function makeCtx(): {
  ctx: DungeonCmdsCtx;
  rng: CountingRng;
  randCalls: () => number;
  ds: () => DungeonState | null;
} {
  const rng = new CountingRng(0x1234);
  let randCalls = 0;
  let dungeonState: DungeonState | null = null;
  const state = {
    position: { location: 0, floor: 0, x: 50, y: 60 },
    dungeonRoomsCleared: undefined,
  } as unknown as GameState;
  const ctx: DungeonCmdsCtx = {
    state,
    rand: (lo, hi) => {
      randCalls++;
      return rng.next(lo, hi);
    },
    liveRng: rng,
    dungeons: [makeDungeon(DECEIT, "Deceit"), makeDungeon(DESPISE, "Despise")],
    locationsX: Array.from({ length: 41 }, (_, i) => 100 + i),
    locationsY: Array.from({ length: 41 }, (_, i) => 200 + i),
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
  return { ctx, rng, randCalls: () => randCalls, ds: () => dungeonState };
}

describe("setDungeonPos — cero-rand (contador de rand antes/después)", () => {
  it("crea el estado de mazmorra desde FUERA sin gastar una sola tirada", () => {
    const { ctx, rng, randCalls, ds } = makeCtx();
    const seedBefore = rng.getSeed();

    setDungeonPos(ctx, DECEIT, 3, 5, 6, "west");

    expect(rng.calls).toBe(0); // ni una tirada del stream vivo
    expect(randCalls()).toBe(0); // ni una del RandFn del ctx
    expect(rng.getSeed()).toBe(seedBefore); // g_rng_seed intacto
    expect(ds()?.pos).toEqual({ dungeon: DECEIT, floor: 3, x: 5, y: 6, facing: "west" });
  });

  it("el errante nace INACTIVO (no se llama respawnWanderer: es el consumidor de rand)", () => {
    const { ctx, rng, ds } = makeCtx();
    setDungeonPos(ctx, DECEIT, 0, 1, 1, "south");
    expect(ds()!.wanderer.type).toBe(0xff); // WANDERER_INACTIVE
    expect(rng.calls).toBe(0);
  });

  it("ya DENTRO de la misma mazmorra: mutación pura de planta/celda/FACING, cero-rand", () => {
    const { ctx, rng, ds } = makeCtx();
    setDungeonPos(ctx, DECEIT, 0, 1, 1, "south");
    const first = ds();
    setDungeonPos(ctx, DECEIT, 7, 2, 3, "east");
    expect(ds()).toBe(first); // NO se recarga el estado (misma instancia)
    expect(ds()?.pos).toEqual({ dungeon: DECEIT, floor: 7, x: 2, y: 3, facing: "east" });
    expect(rng.calls).toBe(0);
  });

  it("cambiar de MAZMORRA reconstruye el estado, también cero-rand", () => {
    const { ctx, rng, ds } = makeCtx();
    setDungeonPos(ctx, DECEIT, 1, 1, 1, "north");
    const first = ds();
    setDungeonPos(ctx, DESPISE, 4, 4, 4, "west");
    expect(ds()).not.toBe(first);
    expect(ds()?.pos.dungeon).toBe(DESPISE);
    expect(rng.calls).toBe(0);
  });

  it("fija el tile de SUPERFICIE de la salida (misma tabla que exitDungeonTo)", () => {
    const { ctx } = makeCtx();
    setDungeonPos(ctx, DECEIT, 2, 2, 2, "north");
    // locationsX[32]=132, locationsY[32]=232 — EN CRUDO, como exitDungeonTo en las dos capas
    // (DUNGEON 0x1d10-0x1d1b). El +1 que fijaba este aserto era el sapo de britannia-y1-acta.
    expect(ctx.state.position).toEqual({ location: 0, floor: 0, x: 132, y: 232 });
  });

  it("mazmorra desconocida = NO-OP (no se fabrica un estado inventado)", () => {
    const { ctx, ds } = makeCtx();
    setDungeonPos(ctx, 99, 0, 0, 0, "north");
    expect(ds()).toBeNull();
  });

  it("CONTRASTE: el camino de ENTRADA REAL sí consume rand (respawnWanderer)", () => {
    const { ctx, rng } = makeCtx();
    enterDungeon(ctx, DECEIT, 0);
    // Por eso teleportDungeon (que pasa por enterDungeon) no puede ser la costura del espejo.
    expect(rng.calls).toBeGreaterThan(0);
  });
});
