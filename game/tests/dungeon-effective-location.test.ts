/**
 * AUD-A2 (#123) — la GUARDA `loc >= 0x21` sobre `position.location` era CÓDIGO MUERTO:
 * dentro de la mazmorra corría el turno de OVERWORLD.
 *
 * DERIVACIÓN (el binario SÍ escribe g_location al entrar). MAINOUT.OVL
 * `mainout_enter_location` 0x0790:
 *   07a0-07d6  bucle `si = 0x20..0x27` buscando (g_party_x,g_party_y) en las tablas de
 *              localización DS 0x1e8a (x) / 0x1eb2 (y); al casar `[bp-2] = si`
 *   0887       `mov al,[bp-2]`
 *   088a       `inc al`
 *   088c       `mov byte ptr [g_location], al`      ⇒ g_location = si+1 = 0x21..0x28
 * y el bucle de DUNGEON.OVL lo RELEE dos veces de forma independiente:
 *   0eff  `cmp byte ptr [g_location], 0x20 / jbe`
 *   0f47  `cmp byte ptr [g_location], 0x21 / jae`
 *
 * El clon NO hace esa escritura a propósito: `enterDungeon` deja `state.position` en el
 * tile de SUPERFICIE de la entrada (location 0), porque ahí aterriza la salida
 * (dungeon-cmds.ts). La mazmorra vive en `game.dungeonState`. `Game.effectiveLocation`
 * es el puente: devuelve el valor DERIVADO (0x21..0x28 = `dungeonState.pos.dungeon`).
 *
 * Lo que este fichero fija:
 *  1. el accesor devuelve 0 fuera y el id de mazmorra dentro;
 *  2. (I)gnite dentro de la mazmorra corre el turno de MAZMORRA — mismo reloj y mismo
 *     stream que `advanceTurn` a secas — y NO el de overworld (viento + gate de spawn);
 *  3. la ANTORCHA usa la fórmula de mazmorra `112 + rand(0,15)` y no los 240 fijos;
 *  4. la Skull Key corta con "Not here!" en vez de desmagificar una puerta del mapa de
 *     SUPERFICIE en las coordenadas de la entrada;
 *  5. CONTROL POSITIVO: en el overworld nada de lo anterior cambia (el turno de
 *     overworld sigue rodando su viento y su gate de spawn).
 */
import { describe, expect, it } from "vitest";
import { Game, type GameData } from "../src/core/game.js";
import type { CharacterState, GameState } from "../src/core/state.js";
import type { WorldData } from "../src/core/world/map.js";
import { CellType, type DungeonCell, type DungeonData } from "../src/core/dungeon/dungeon.js";
import { OriginalRng } from "../src/core/rng-original.js";
import { advanceTurn } from "../src/core/world/movement.js";
import {
  igniteTorch,
  MINUTES_PER_ACTION_DUNGEON,
  MINUTES_PER_ACTION_OUTDOORS,
  TORCH_MINUTES,
} from "../src/core/world/survival.js";

const DESPISE = 34; // 0x22 — dentro de la banda 0x21..0x28
const PX = 50;
const PY = 60;
const N = 8;

function makeChar(): CharacterState {
  return {
    name: "Avatar", gender: 0x0b, class: "A", status: "G", strength: 20, dexterity: 20,
    intelligence: 20, currentMp: 10, currentHp: 50, maxHp: 60, exp: 0, level: 2,
    monthsAtInn: 0, helmet: 0xff, armor: 0xff, weapon: 0xff, shield: 0xff, ring: 0xff,
    amulet: 0xff, partyStatus: 0,
  };
}

function makeState(): GameState {
  return {
    characters: [makeChar()],
    partySize: 1,
    activeCharacter: 0,
    food: 100,
    time: { year: 139, month: 4, day: 7, hour: 8, minute: 35 },
    turnsSinceStart: 0,
    position: { location: 0, floor: 0, x: PX, y: PY },
    transport: "foot",
    torchTurns: 0,
    torches: 5,
    skullKeys: 3,
    prevHour: 8,
  } as GameState;
}

function makeWorld(): WorldData {
  const overworld = Array.from({ length: 256 }, () => Array.from({ length: 256 }, () => 5));
  return { overworld, underworld: overworld, smallMaps: new Map() };
}

const gameData: GameData = {
  locationsX: Array.from({ length: 41 }, (_, i) => (i === DESPISE - 1 ? PX : 250)),
  locationsY: Array.from({ length: 41 }, (_, i) => (i === DESPISE - 1 ? PY : 250)),
  locationNames: Array.from({ length: 41 }, (_, i) => `Loc${i + 1}`),
};

/** Mazmorra 8×8×8 vacía con la escalera-arriba en (f0,1,1) que busca `enterDungeon`. */
function makeDungeon(location: number, name: string): DungeonData {
  const floors: DungeonCell[][][] = Array.from({ length: N }, () =>
    Array.from({ length: N }, () =>
      Array.from({ length: N }, (): DungeonCell => ({ type: CellType.Nothing, sub: 0 })),
    ),
  );
  floors[0]![1]![1] = { type: 0x1, sub: 0 };
  return { location, name, floors };
}

function makeGame(): Game {
  return new Game({} as never, makeWorld(), gameData, makeState(), {
    dungeons: [makeDungeon(DESPISE, "Despise")],
  } as never);
}

/** Partida nueva → (E)nter Despise. Deja el juego DENTRO de la mazmorra. */
function enterDespise(game: Game): void {
  game.enterDungeon(DESPISE, 0);
  expect(game.dungeonState).not.toBeNull();
}

const SEED = 0x4321;

describe("AUD-A2 — g_location EFECTIVO dentro de la mazmorra (MAINOUT 0x088c)", () => {
  it("el accesor vale 0 en el overworld y el id de mazmorra dentro", () => {
    const game = makeGame();
    expect(game.effectiveLocation).toBe(0);
    enterDespise(game);
    // `position.location` SIGUE siendo 0 (el clon deja ahí el tile de superficie)…
    expect(game.state.position.location).toBe(0);
    // …pero el g_location efectivo es el que el binario escribiría en 0x088c.
    expect(game.effectiveLocation).toBe(DESPISE);
    expect(game.effectiveLocation).toBeGreaterThanOrEqual(0x21);
    expect(game.effectiveLocation).toBeLessThanOrEqual(0x28);
  });

  it("(I)gnite en mazmorra corre el turno de MAZMORRA: mismo reloj y mismo stream que advanceTurn", () => {
    const game = makeGame();
    enterDespise(game);
    game.reseed(SEED);
    const before = { ...game.state.time };
    const torchesBefore = game.state.torches;
    game.ignite();

    // Referencia INDEPENDIENTE: lo único que el bucle de mazmorra hace es
    // igniteTorch (con la banda correcta) + advanceTurn. Ni viento ni gate de spawn.
    const ref = new OriginalRng(SEED);
    const refRand = (lo: number, hi: number): number => ref.next(lo, hi);
    const refState = makeState();
    refState.time = { ...before };
    refState.torches = torchesBefore;
    igniteTorch(refState, refRand, DESPISE);
    // ★ #159: la referencia cobra los MINUTOS DE MAZMORRA (1), no `undefined`. Pasar
    // `undefined` la mandaba a minutesPerAction(refState.position.location) y, como este
    // arnés deja esa location en 0 igual que el clon, cobraba los 2 de EXTERIOR — o sea
    // que la referencia reproducía el mismo defecto que medía, y la igualdad salía verde
    // por coincidencia de bug. El 1 sale del binario (DUNGEON 0x0fef `jmp 0xf2e` →
    // `push 1` / `call advance_clock 0x4f7c`), no del port.
    advanceTurn(refState, MINUTES_PER_ACTION_DUNGEON, refRand);

    expect(game.state.time).toEqual(refState.time);
    expect(game.liveSeed()).toBe(ref.getSeed());
    expect(game.state.torchTurns).toBe(refState.torchTurns);
  });

  // ── #159: el COSTE EN MINUTOS del turno de mazmorra ──
  //
  // CANDADO. Medido en main @a566a8ea ANTES del fix: los cuatro comandos cobraban 2
  // minutos (pasaban `undefined` → minutesPerAction(position.location) → rama de
  // EXTERIOR, porque el clon deja esa location en 0 bajo tierra). El binario cobra 1:
  //
  //   | offset   | mnemónico                              | lectura |
  //   |----------|----------------------------------------|---------|
  //   | `0x0fe0` | `cmp [g_time_spell],0x51` / `je 0xf1e`  | sin 'Q' cae al siguiente |
  //   | `0x0fea` | `mov di,1`                             | |
  //   | `0x0fed` | `mov ax,di`                            | ax = 1 |
  //   | `0x0fef` | `jmp 0xf2e`                            | entra en el bloque de 'Q' |
  //   | `0x0f2e` | `push ax`                              | |
  //   | `0x0f2f` | `call 0x4f7c`                          | advance_clock(1) |
  //
  // Salto verificado byte a byte: `e9 3c ff` ⇒ 0x0ff2 + (−196) = 0x0f2e. Y el destino
  // del `call` de 0x0f2f es advance_clock por CONTROL POSITIVO, no por su etiqueta (que
  // en overlay es file-relativa y miente): los dos advance_clock ya bautizados del repo
  // — TOWN 0x15d4 y MAINOUT 0x0c3d — rinden el MISMO `call 0xffffcdac` byte a byte.
  //
  // ⚠ EL ASERTO VA CONTRA EL LITERAL 1, NO CONTRA `MINUTES_PER_ACTION_DUNGEON`. Comparar
  // el reloj contra la constante que el propio código usa es CIRCULAR: mide «los
  // call-sites leen la constante», no «el coste es 1». Medido: con la constante puesta a
  // 7 esa versión del test seguía VERDE (y con ella las 309 unidades enteras, que es
  // cuanta cobertura tiene hoy este reloj: ninguna). El 1 de abajo es el del binario.
  it("★ #159: cada comando de mazmorra cuesta 1 minuto (DUNGEON 0x0fef → 0x0f2e)", () => {
    const game = makeGame();
    enterDespise(game);
    const mins = (): number => game.state.time.hour * 60 + game.state.time.minute;
    for (const cmd of ["forward", "left", "right", "back"] as const) {
      const t0 = mins();
      game.dungeonCommand(cmd);
      expect(mins() - t0).toBe(1);
    }
    // La constante que consumen los call-sites es ese mismo 1 del binario...
    expect(MINUTES_PER_ACTION_DUNGEON).toBe(1);
    // ...y NO el coste de exterior, que es lo que se cobraba antes del fix.
    expect(MINUTES_PER_ACTION_OUTDOORS).toBe(2);
  });

  // El 5º call-site de mazmorra, el que el censo por `advanceTurn(` destapó: Uus Por /
  // Des Por en la vista 3D (DUNGEON 0x1C6A mode=1) vuelve al MISMO bucle y cobra su
  // misma cola de reloj. Su propio docblock ya lo declaraba («aquí sólo se cobra el
  // turno de mazmorra ... como dungeonCommand») mientras pasaba `undefined` y cobraba 2.
  it("★ #159: el cambio de planta mágico (Uus/Des Por) cuesta ese mismo minuto", () => {
    const game = makeGame();
    enterDespise(game);
    const mins = (): number => game.state.time.hour * 60 + game.state.time.minute;
    const t0 = mins();
    game.dungeonMagicChangeLevel(1);
    expect(mins() - t0).toBe(1);
  });

  it("la ANTORCHA de mazmorra es 112 + rand(0,15), no los 240 fijos del exterior", () => {
    const game = makeGame();
    enterDespise(game);
    game.reseed(SEED);
    const before = { ...game.state.time };
    game.ignite();
    // igniteTorch deja 112 + rand(0,15) (CMDS 0x0DBA-0x0DD0) y el turno que viene
    // detrás se come sus minutos del contador (advance_clock 0x4fb4), así que hay que
    // sumarlos de vuelta para leer el valor recién encendido.
    const charged =
      (game.state.time.hour - before.hour) * 60 + (game.state.time.minute - before.minute);
    expect(charged).toBeGreaterThan(0);
    const lit = game.state.torchTurns + charged;
    expect(lit).toBeGreaterThanOrEqual(0x70); // 112
    expect(lit).toBeLessThanOrEqual(0x7f); // 112 + 15
    expect(lit).not.toBe(TORCH_MINUTES); // NUNCA los 240 del exterior
  });

  it("la Skull Key en mazmorra dice «Not here!» y NO toca el mapa de superficie", () => {
    const game = makeGame();
    enterDespise(game);
    const keysBefore = game.state.skullKeys;
    const events = game.useSkullKey("north");
    const text = events.map((e) => ("text" in e ? e.text : "")).join("|");
    expect(text).toContain("Not here!");
    // La llave se gasta igual (0x18c4 es un dec incondicional, ANTES del gate).
    expect(game.state.skullKeys).toBe(keysBefore - 1);
  });

  // ── CONTROL POSITIVO: fuera de la mazmorra nada de esto cambia ──
  it("CONTROL: en el overworld (I)gnite sigue corriendo el turno de OVERWORLD", () => {
    const game = makeGame(); // sin entrar a la mazmorra
    expect(game.effectiveLocation).toBe(0);
    game.reseed(SEED);
    game.ignite();
    // El camino de overworld consume MÁS stream que el de mazmorra (viento + gate de
    // spawn), así que el seed diverge del de la referencia mazmorra-only.
    const ref = new OriginalRng(SEED);
    const refRand = (lo: number, hi: number): number => ref.next(lo, hi);
    const refState = makeState();
    igniteTorch(refState, refRand, 0);
    advanceTurn(refState, undefined, refRand);
    expect(game.liveSeed()).not.toBe(ref.getSeed());
    // Y la antorcha de exterior son los 240 FIJOS, sin tirada (CMDS 0x0DD6) — menos los
    // 2 minutos que cobra el paso de exterior (MINUTES_PER_ACTION_OUTDOORS).
    expect(game.state.torchTurns).toBe(TORCH_MINUTES - MINUTES_PER_ACTION_OUTDOORS);
  });

  it("CONTROL: en el overworld la Skull Key NO dice «Not here!»", () => {
    const game = makeGame();
    const events = game.useSkullKey("north");
    const text = events.map((e) => ("text" in e ? e.text : "")).join("|");
    expect(text).not.toContain("Not here!");
  });
});
