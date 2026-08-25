/**
 * Despacho COMPLETO del pasillo de mazmorra + ecos de movimiento (auditoría de
 * cobertura, ítems `teclas-02-dungeon-dispatch-completo` y `str-dungeon-move-echo`).
 *
 * Citas:
 *  - Ecos de movimiento: DUNGEON.OVL move() 0x0502 — "Advance\n" (DS 0x2cc0,
 *    rama dir==3 @0x0542), "Back up\n" (DS 0x2ce6 @0x064a), "Turn right\n"
 *    (DS 0x2cda @0x0636), "Turn left\n" (DS 0x2d00 @0x066e), "Turn around.\n"
 *    (DS 0x2d0b @0x0533). Strings verificadas byte a byte en DATA.OVL
 *    (fileoff = DS+0x10, dump 0x2cd0-0x2d2c).
 *  - Gate "Not in doorway!\n" (DS 0x2cc9/0x2cef): SOLO los giros L/R (dir 1/2)
 *    lo comprueban (`cmp al,0xe0` @0x062d/0x065f sobre el tile BAJO la party);
 *    el giro 180° (rama default 0x0533) NO. El giro gateado NO cambia el facing.
 *  - Pass: kernel_cmd_dispatch 0x31F4 (loc≠0 → "Pass\n" DS 0xa134, ret 1).
 *  - Attack de mazmorra: DUNGEON 0x1D4A — "Attack\n" (DS 0x6caa) + celda ENCARADA
 *    vs monstruo errante → "What?\n" (DS 0x6cb2); ret 0 = SIN turno.
 *    (~~no portado~~ RANCIO, retirado #327: el errante SÍ está portado —
 *    core/dungeon/wanderer.ts— y esta rama lo consume vía dungeonCommand("attack").)
 *  - Get: SJOG get_dungeon 0x179E — "Get\n" (DS 0x8da4); cofre cerrado →
 *    "Must open first!\n" (DS 0x8daa); sin cofre → "Not here!\n" (DS 0x8dda).
 *  - Jimmy: SJOG jimmy_dungeon 0x0C3E — desarme de trampa de cofre:
 *    rand(1,0x1e) > (floor·2 − DEX + 0x1e)>>1 → "Chest unlocked\n" (tile→0x40|lit,
 *    llave INTACTA); fallo → "Key broke!\n" + llave−1; cofre sin trampa → llave
 *    SIEMPRE rompe; sin llaves → "No keys!\n"; 0x70 → "Already open!\n";
 *    resto → "What?\n".
 *  - Look: DNGLOOK 0x0000 — gate de oscuridad (0x0013), cabecera "You see:\n"
 *    (DS 0x7542), tabla de descripciones DS 0x7618-0x76f0, remap 0x61→0x00
 *    (@0x0070), campos por tile exacto (0x0084-0x00b5), muro especial por
 *    variante (0x00c1-0x00ff con easter egg rand(1,0xff)==0xff).
 */
import { describe, it, expect } from "vitest";
import {
  DungeonState,
  CellType,
  type DungeonCell,
  type DungeonData,
  type DungeonPos,
} from "../src/core/dungeon/index.js";
import {
  dungeonDrinkAhead,
  dungeonCommand,
  type DungeonCmdsCtx,
} from "../src/core/dungeon/dungeon-cmds.js";
import type { OriginalRng } from "../src/core/rng-original.js";
import { createNewGame, type ExtractedInitialState, type GameState } from "../src/core/state.js";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

function load<T>(rel: string): T {
  const path = fileURLToPath(new URL(rel, import.meta.url));
  return JSON.parse(readFileSync(path, "utf8").replace(/^﻿/, "")) as T;
}

function freshState(over: Partial<GameState> = {}): GameState {
  const s = createNewGame(load<ExtractedInitialState>("../assets/initial-state.json"));
  return Object.assign(s, over);
}

/** Mazmorra sintética vacía (todo Nothing) con celdas puntuales. */
function synthDungeon(
  cells: { f?: number; x: number; y: number; cell: DungeonCell }[],
  location = 33,
): DungeonData {
  const floors: DungeonCell[][][] = Array.from({ length: 8 }, () =>
    Array.from({ length: 8 }, () =>
      Array.from({ length: 8 }, () => ({ type: CellType.Nothing, sub: 0 })),
    ),
  );
  for (const c of cells) floors[c.f ?? 0]![c.y]![c.x] = c.cell;
  return { location, name: "Synth", floors };
}

function mkPos(over: Partial<DungeonPos> = {}): DungeonPos {
  return { dungeon: 33, floor: 0, x: 3, y: 3, facing: "north", ...over };
}

/** RNG stub determinista (la firma next(lo,hi) del OriginalRng). */
function stubRng(value: number): OriginalRng {
  return { next: () => value } as unknown as OriginalRng;
}

const texts = (evs: { text?: string }[]): (string | undefined)[] => evs.map((e) => e.text);

describe("ecos de movimiento (DUNGEON move() 0x0502)", () => {
  it("forward emite 'Advance\\n' ANTES del resultado del paso (0x0542)", () => {
    const ds = new DungeonState([synthDungeon([])], mkPos());
    const evs = ds.forward(freshState());
    expect(evs[0]).toEqual({ kind: "message", text: "Advance\n" });
    expect(evs.some((e) => e.kind === "moved")).toBe(true);
  });

  it("back emite 'Back up\\n' (0x064a)", () => {
    const ds = new DungeonState([synthDungeon([])], mkPos());
    const evs = ds.back(freshState());
    expect(evs[0]).toEqual({ kind: "message", text: "Back up\n" });
  });

  it("forward BLOQUEADO conserva el orden eco→'Blocked!' (0x0542 imprime antes del choque)", () => {
    const d = synthDungeon([{ x: 3, y: 2, cell: { type: CellType.Wall, sub: 0 } }]);
    const ds = new DungeonState([d], mkPos({ facing: "north" }));
    const evs = ds.forward(freshState());
    expect(texts(evs)).toEqual(["Advance\n", "Blocked!"]);
  });

  it("turnLeft/turnRight/turnAround emiten sus ecos y giran (0x066e/0x0636/0x0533)", () => {
    const ds = new DungeonState([synthDungeon([])], mkPos({ facing: "north" }));
    expect(texts(ds.turnLeft())).toEqual(["Turn left\n", undefined]);
    expect(ds.pos.facing).toBe("west");
    expect(texts(ds.turnRight())).toEqual(["Turn right\n", undefined]);
    expect(ds.pos.facing).toBe("north");
    expect(texts(ds.turnAround())).toEqual(["Turn around.\n", undefined]);
    expect(ds.pos.facing).toBe("south");
  });

  it("sobre una PUERTA (0xE0) los giros L/R dan 'Not in doorway!\\n' y NO giran (0x0628/0x065a)", () => {
    const d = synthDungeon([{ x: 3, y: 3, cell: { type: CellType.NormalDoor, sub: 0 } }]);
    const ds = new DungeonState([d], mkPos({ facing: "north" }));
    expect(texts(ds.turnLeft())).toEqual(["Not in doorway!\n"]);
    expect(ds.pos.facing).toBe("north"); // el giro NO se ejecutó
    expect(texts(ds.turnRight())).toEqual(["Not in doorway!\n"]);
    expect(ds.pos.facing).toBe("north");
    // El giro 180° NO tiene el gate (rama default 0x0533).
    expect(texts(ds.turnAround())).toEqual(["Turn around.\n", undefined]);
    expect(ds.pos.facing).toBe("south");
    // Y avanzar/retroceder tampoco lo tienen (dir 3/4 imprimen incondicional).
    const evs = ds.forward(freshState());
    expect(evs[0]!.text).toBe("Advance\n");
  });
});

describe("despacho del pasillo (kernel 0x3178 vía DUNGEON 0x07a0)", () => {
  it("pass NO emite el eco (lo imprime el despachador, kernel 0x31F4 → 0x33ea)", () => {
    const ds = new DungeonState([synthDungeon([])], mkPos());
    // "Pass\n" (DS 0xa134) lo imprime el DESPACHADOR antes de saltar al handler del
    // overlay, y ese despachador es COMÚN a overworld y mazmorra — por eso el eco vive
    // en el call-site de main.ts (`hud.echo(CMD_STRINGS.pass)`, con bullet ►) y no
    // aquí. Emitirlo como `{kind:"message"}` desde el handler lo dejaba sin el prompt
    // «>» del original (QA usuario móvil 28-07).
    expect(texts(ds.pass())).toEqual([]);
  });

  it("attack emite 'Attack\\n' + 'What?\\n' (DUNGEON 0x1d56/0x1e00, sin errante portado)", () => {
    const ds = new DungeonState([synthDungeon([])], mkPos());
    expect(texts(ds.attack())).toEqual(["Attack\n", "What?\n"]);
  });

  it("get: cofre cerrado → 'Must open first!\\n' (SJOG 0x17e3); sin cofre → 'Not here!\\n' (0x18c0)", () => {
    const d = synthDungeon([{ x: 3, y: 3, cell: { type: CellType.Chest, sub: 0 } }]);
    const ds = new DungeonState([d], mkPos());
    expect(texts(ds.getHere(freshState()))).toEqual(["Get\n", "Must open first!\n"]);
    const ds2 = new DungeonState([synthDungeon([])], mkPos());
    expect(texts(ds2.getHere(freshState()))).toEqual(["Get\n", "Not here!\n"]);
  });

  it("jimmy sin llaves → 'No keys!\\n' (SJOG 0x0cbb/0x0ce0)", () => {
    const d = synthDungeon([{ x: 3, y: 3, cell: { type: CellType.Chest, sub: 3 } }]);
    const ds = new DungeonState([d], mkPos());
    const st = freshState({ keys: 0 });
    expect(texts(ds.jimmyHere(st))).toEqual(["No keys!\n"]);
  });

  it("jimmy en cofre SIN trampa: la llave SIEMPRE rompe (SJOG 0x0cc2)", () => {
    const d = synthDungeon([{ x: 3, y: 3, cell: { type: CellType.Chest, sub: 0 } }]);
    const ds = new DungeonState([d], mkPos());
    const st = freshState({ keys: 2 });
    expect(texts(ds.jimmyHere(st))).toEqual(["Key broke!\n"]);
    expect(st.keys).toBe(1);
  });

  it("jimmy desarma la trampa con roll > (floor·2−DEX+0x1e)>>1: 'Chest unlocked\\n', tile→0x40|lit, llave INTACTA (0x0cf6-0x0d21)", () => {
    const d = synthDungeon([{ x: 3, y: 3, cell: { type: CellType.Chest, sub: 0xb } }]); // trampa 3 + lit 8
    const ds = new DungeonState([d], mkPos(), stubRng(30)); // roll=30 > umbral
    const st = freshState({ keys: 1 });
    st.characters[st.activeCharacter === 0xff ? 0 : st.activeCharacter]!.dexterity = 20;
    expect(texts(ds.jimmyHere(st))).toEqual(["Chest unlocked\n"]);
    expect(st.keys).toBe(1); // el éxito NO gasta llave
    const cell = ds.cellAt(0, 3, 3);
    expect(cell.type).toBe(CellType.Chest);
    expect(cell.sub).toBe(0x8); // trampa fuera, bit lit conservado (al&8 + 0x40)
  });

  it("jimmy FALLA con roll ≤ umbral: 'Key broke!\\n' + llave−1, trampa intacta (0x0d28)", () => {
    const d = synthDungeon([{ x: 3, y: 3, cell: { type: CellType.Chest, sub: 3 } }]);
    const ds = new DungeonState([d], mkPos(), stubRng(1)); // roll=1 ≤ umbral 5 (floor 0, DEX 20)
    const st = freshState({ keys: 1 });
    st.characters[st.activeCharacter === 0xff ? 0 : st.activeCharacter]!.dexterity = 20;
    expect(texts(ds.jimmyHere(st))).toEqual(["Key broke!\n"]);
    expect(st.keys).toBe(0);
    expect(ds.cellAt(0, 3, 3).sub).toBe(3); // trampa sigue
  });

  it("jimmy: 0x70 → 'Already open!\\n' (0x0d37); sin cofre → 'What?\\n' (0x0d3c)", () => {
    const d = synthDungeon([{ x: 3, y: 3, cell: { type: CellType.OpenChest, sub: 0 } }]);
    const ds = new DungeonState([d], mkPos());
    expect(texts(ds.jimmyHere(freshState({ keys: 1 })))).toEqual(["Already open!\n"]);
    const ds2 = new DungeonState([synthDungeon([])], mkPos());
    expect(texts(ds2.jimmyHere(freshState({ keys: 1 })))).toEqual(["What?\n"]);
  });
});

describe("(L)ook 3D (DNGLOOK 0x0000)", () => {
  const lit = { torchTurns: 10 } as Partial<GameState>;

  it("a oscuras → 'You see:\\ndarkness.\\n' (DS 0x752e, gate 0x0013)", () => {
    const ds = new DungeonState([synthDungeon([])], mkPos());
    const st = freshState({ torchTurns: 0, lightSpellMins: 0 });
    expect(texts(ds.lookAhead(st))).toEqual(["You see:\ndarkness.\n"]);
  });

  it("describe la celda ENCARADA por familia (tabla DS 0x7618-0x76f0)", () => {
    const cases: [DungeonCell, string][] = [
      [{ type: CellType.Nothing, sub: 0 }, "a passage.\n"],
      [{ type: CellType.LadderUp, sub: 0 }, "an up ladder.\n"],
      [{ type: CellType.LadderDown, sub: 0 }, "a down ladder.\n"],
      [{ type: CellType.LadderUpDown, sub: 0 }, "a ladder.\n"],
      [{ type: CellType.Chest, sub: 0 }, "a wooden chest.\n"],
      [{ type: CellType.Fountain, sub: 1 }, "a fountain.\n"],
      [{ type: CellType.Trap, sub: 0 }, "a pit.\n"],
      [{ type: CellType.OpenChest, sub: 0 }, "an open chest.\n"],
      [{ type: CellType.Marker, sub: 0 }, "nothing of note.\n"],
      [{ type: CellType.RoomsBroke, sub: 0 }, "a heavy door.\n"],
      [{ type: CellType.Wall, sub: 0 }, "a wall.\n"],
      [{ type: CellType.SecretDoor, sub: 0 }, "a wall.\n"], // NO se delata (DS 0x76d6)
      [{ type: CellType.NormalDoor, sub: 0 }, "a heavy door.\n"],
      [{ type: CellType.Room, sub: 0 }, "a heavy door.\n"],
    ];
    for (const [cell, want] of cases) {
      const d = synthDungeon([{ x: 3, y: 2, cell }]);
      const ds = new DungeonState([d], mkPos({ facing: "north" }));
      expect(texts(ds.lookAhead(freshState(lit)))).toEqual(["You see:\n", want]);
    }
  });

  it("tile EXACTO 0x61 (caída oculta) se ve como 'a passage.\\n' (remap @0x0070)", () => {
    const d = synthDungeon([{ x: 3, y: 2, cell: { type: CellType.Trap, sub: 1 } }]);
    const ds = new DungeonState([d], mkPos({ facing: "north" }));
    expect(texts(ds.lookAhead(freshState(lit)))).toEqual(["You see:\n", "a passage.\n"]);
  });

  it("campos por tile exacto (0x0084-0x00b5) y variante iluminada → energy field", () => {
    const cases: [number, string][] = [
      [0x0, "A sleep field.\n"],
      [0x1, "A poison gas field.\n"],
      [0x2, "A wall of fire.\n"],
      [0x3, "An electric field.\n"],
      [0x9, "An energy field.\n"], // 0x89 (lit) cae al default 0x009b
    ];
    for (const [sub, want] of cases) {
      const d = synthDungeon([{ x: 3, y: 2, cell: { type: CellType.MagicField, sub } }]);
      const ds = new DungeonState([d], mkPos({ facing: "north" }));
      expect(texts(ds.lookAhead(freshState(lit)))).toEqual(["You see:\n", want]);
    }
  });

  it("muro especial por variante de mazmorra (0x00c1-0x00ff): Despise=1, Shame=2, Deceit=3+easter egg", () => {
    const wall = { type: CellType.SpecialWall, sub: 0 };
    // Despise (34, variante 1) → estalactita.
    let d = synthDungeon([{ x: 3, y: 2, cell: wall }], 34);
    let ds = new DungeonState([d], mkPos({ dungeon: 34, facing: "north" }));
    expect(texts(ds.lookAhead(freshState(lit)))[1]).toBe("a dripping stalactite.\n");
    // Shame (38, variante 2) → pasaje derrumbado.
    d = synthDungeon([{ x: 3, y: 2, cell: wall }], 38);
    ds = new DungeonState([d], mkPos({ dungeon: 38, facing: "north" }));
    expect(texts(ds.lookAhead(freshState(lit)))[1]).toBe("a caved in passage.\n");
    // Deceit (33, variante 3): rand(1,0xff)==0xff → pirata; resto → aventurero.
    d = synthDungeon([{ x: 3, y: 2, cell: wall }], 33);
    ds = new DungeonState([d], mkPos({ dungeon: 33, facing: "north" }), stubRng(0xff));
    expect(texts(ds.lookAhead(freshState(lit)))[1]).toBe("an unfortunate software pirate.\n");
    ds = new DungeonState([d], mkPos({ dungeon: 33, facing: "north" }), stubRng(1));
    expect(texts(ds.lookAhead(freshState(lit)))[1]).toBe("a less fortunate adventurer.\n");
  });

  it("fountainAhead detecta la fuente ENCARADA y drinkFountain(at) bebe ESA fuente (DNGLOOK 0x012f/0x01f0)", () => {
    const d = synthDungeon([{ x: 3, y: 2, cell: { type: CellType.Fountain, sub: 1 } }]); // heal
    const ds = new DungeonState([d], mkPos({ facing: "north" }));
    expect(ds.fountainAhead()).toBe(true);
    const st = freshState(lit);
    const ch = st.characters[0]!;
    ch.currentHp = 1;
    st.activeCharacter = 0;
    const evs = ds.drinkFountain(st, ds.aheadCoords());
    expect(evs[0]!.text).toBe("Healed!");
    expect(ch.currentHp).toBe(ch.maxHp);
    // La celda de la party NO es fuente: el atajo QoL sin `at` no encuentra fuente.
    expect(ds.drinkFountain(st)[0]!.text).toBe("No fountain here.");
  });
});

describe("fidelidad drink/daño (re/notes/drink-ahead-fidelity.md)", () => {
  /** Fuente bad-taste (sub 3) bajo la party en (3,3) y ENCARADA en (3,2). */
  const badTasteDungeon = () =>
    synthDungeon([
      { x: 3, y: 3, cell: { type: CellType.Fountain, sub: 3 } },
      { x: 3, y: 2, cell: { type: CellType.Fountain, sub: 3 } },
    ]);

  /** Ctx mínimo de dungeon-cmds sobre un DungeonState dado (stubs inertes). */
  function mkCtx(ds: DungeonState, state: GameState): DungeonCmdsCtx {
    return {
      state,
      rand: (lo: number) => lo,
      liveRng: stubRng(0),
      locationsX: [],
      locationsY: [],
      getDungeonState: () => ds,
      setDungeonState: () => {},
      locationNameBanner: () => {},
      hydrateUnderworldPlot: () => {},
      clearOverworldEnemies: () => {},
      startDungeonRoomCombat: () => [],
      startDungeonCorridorCombat: () => [],
      checkDoomRescue: () => [],
      checkRefuge: () => [],
    };
  }

  it("'Bad taste.' emite el guión 0x2a52 ENTERO: flash de fila + blip via damage-script (DNGLOOK 0x027b → kernel 0x2a52: 0x2a28 @0x2a59/0x2a6e + noise_burst 0x223c @0x2a68)", () => {
    const ds = new DungeonState([badTasteDungeon()], mkPos(), stubRng(5));
    const st = freshState();
    st.activeCharacter = 0;
    const evs = ds.drinkFountain(st);
    // Esperado EN CRUDO: el kernel 0x2a52 recibe push [bp-0xc] = slot del PJ
    // seleccionado (aquí 0); el bus damage-script entrega flash 0x2a28 + cue
    // 0x223c por slot (PoisonTick), no un sfx pelado que perdería el flash.
    expect(evs.map((e) => e.kind)).toEqual(["message", "damage", "damage-script"]);
    expect(evs[0]!.text).toBe("Bad taste.");
    expect(evs[2]).toEqual({ kind: "damage-script", slots: [0] });
  });

  it("Cure/Heal/Poison siguen MUDAS (escrituras directas sin kernel 0x2a52)", () => {
    for (const sub of [0, 1, 2]) {
      const d = synthDungeon([{ x: 3, y: 3, cell: { type: CellType.Fountain, sub } }]);
      const ds = new DungeonState([d], mkPos());
      const evs = ds.drinkFountain(freshState());
      expect(evs.some((e) => e.kind === "sfx" || e.kind === "damage-script")).toBe(false);
    }
  });

  it("muerte por fuente del PJ ACTIVO limpia activeCharacter=0xff (kernel 0x2a52 @0x2a91-0x2a9b)", () => {
    const ds = new DungeonState([badTasteDungeon()], mkPos(), stubRng(7));
    const st = freshState();
    st.activeCharacter = 0;
    st.characters[0]!.currentHp = 3; // dmg 7 ≥ 3 → muere
    ds.drinkFountain(st);
    expect(st.characters[0]!.status).toBe("D");
    expect(st.characters[0]!.currentHp).toBe(0);
    expect(st.activeCharacter).toBe(0xff);
  });

  it("muerte por hazard (campo eléctrico 0x83) de un NO-activo conserva activeCharacter", () => {
    // Rebote del campo de energía (DUNGEON 0x0470 → far 0x2aa8 → 0x2a52 por miembro).
    const d = synthDungeon([{ x: 3, y: 2, cell: { type: CellType.MagicField, sub: 3 } }]);
    const ds = new DungeonState([d], mkPos({ facing: "north" }), stubRng(8));
    const st = freshState();
    st.activeCharacter = 1;
    st.characters[0]!.currentHp = 1; // muere con dmg 8
    st.characters[1]!.currentHp = 50; // el activo sobrevive
    ds.forward(st);
    expect(st.characters[0]!.status).toBe("D");
    expect(st.activeCharacter).toBe(1); // sólo se limpia si el MUERTO era el activo
  });

  it("muerte por hazard del PJ ACTIVO limpia activeCharacter=0xff", () => {
    const d = synthDungeon([{ x: 3, y: 2, cell: { type: CellType.MagicField, sub: 3 } }]);
    const ds = new DungeonState([d], mkPos({ facing: "north" }), stubRng(8));
    const st = freshState();
    st.activeCharacter = 1;
    st.characters[1]!.currentHp = 2; // el activo muere con dmg 8
    ds.forward(st);
    expect(st.characters[1]!.status).toBe("D");
    expect(st.activeCharacter).toBe(0xff);
  });

  it("traductor UNIFICADO: dungeonDrinkAhead emite los MISMOS eventos de drink que dungeonCommand('drink') — incluido el guión poison-tick del kernel 0x2a52", () => {
    // Misma fuente bad-taste por ambas vías (encarada para el Look, propia para 'd'),
    // mismo rng stub → mismo daño. dungeonCommand antepone los turn-messages del
    // advanceTurn; el resto debe ser IDÉNTICO (antes el filtro message|damage del
    // DrinkAhead se tragaba el sfx del kernel 0x2a52).
    const stA = freshState();
    stA.activeCharacter = 0;
    const dsA = new DungeonState([badTasteDungeon()], mkPos({ facing: "north" }), stubRng(4));
    const aheadEvents = dungeonDrinkAhead(mkCtx(dsA, stA));

    const stB = freshState();
    stB.activeCharacter = 0;
    const dsB = new DungeonState([badTasteDungeon()], mkPos({ facing: "north" }), stubRng(4));
    const cmdEvents = dungeonCommand(mkCtx(dsB, stB), "drink");

    expect(aheadEvents.length).toBeGreaterThan(0);
    // El guión de 0x2a52 (flash 0x2a28 + blip 0x223c, slot 0 EN CRUDO) viaja por
    // la vía fiel del Look como "poison-tick" — el bus que lo pacea (#213/#328).
    expect(
      aheadEvents.some((e) => e.kind === "poison-tick" && e.poisonTick?.slots.length === 1 &&
        e.poisonTick.slots[0] === 0),
    ).toBe(true);
    // La cola de dungeonCommand (tras los turn-messages) = eventos del DrinkAhead.
    expect(cmdEvents.slice(cmdEvents.length - aheadEvents.length)).toEqual(aheadEvents);
  });
});

describe("(L)ook 3D con Dir- (F3 — DNGLOOK selector @0x0007 + dir @0x0028)", () => {
  // La cadena Player:/Dir- vive en la UI (pickCommandChar + pendingDungeonLook,
  // main.ts); el core recibe el target elegido y describe ESA celda con el mismo
  // wrap &7 del Search (aheadCoords). mkPos = (3,3) facing north.
  const board = (): DungeonState =>
    new DungeonState(
      [synthDungeon([
        { x: 3, y: 2, cell: { type: CellType.Fountain, sub: 1 } }, // ahead (N)
        { x: 4, y: 3, cell: { type: CellType.Chest, sub: 0 } }, // right (E)
        { x: 2, y: 3, cell: { type: CellType.Wall, sub: 0 } }, // left (W)
      ])],
      mkPos(),
    );
  const st = (): GameState => freshState({ torchTurns: 100 });

  it("Ahead (default) describe la celda encarada", () => {
    expect(texts(board().lookAhead(st()))).toEqual(["You see:\n", "a fountain.\n"]);
  });

  it("Right/Left rotan el facing ((f+1)&3 / (f+3)&3) y Here describe la celda propia", () => {
    const ds = board();
    expect(texts(ds.lookAhead(st(), "right"))).toEqual(["You see:\n", "a wooden chest.\n"]);
    expect(texts(ds.lookAhead(st(), "left"))).toEqual(["You see:\n", "a wall.\n"]);
    expect(texts(ds.lookAhead(st(), "here"))).toEqual(["You see:\n", "a passage.\n"]);
  });

  it("wrap toroidal &7: mirar Ahead desde el borde 0 describe la celda del otro lado", () => {
    const ds = new DungeonState(
      [synthDungeon([{ x: 3, y: 7, cell: { type: CellType.Fountain, sub: 0 } }])],
      mkPos({ y: 0 }), // (3,0) facing north → ahead = (3,-1) → wrap (3,7)
    );
    expect(texts(ds.lookAhead(st()))).toEqual(["You see:\n", "a fountain.\n"]);
  });

  it("fountainAhead(target) sigue la celda MIRADA (encadena el drink del Look, 0x012f)", () => {
    const ds = board();
    expect(ds.fountainAhead()).toBe(true); // ahead = fuente
    expect(ds.fountainAhead("right")).toBe(false); // cofre
    expect(ds.fountainAhead("here")).toBe(false);
  });

  it("a oscuras el gate @0x0013 corta ANTES del Dir-: darkness sin describir target", () => {
    const dark = freshState({ torchTurns: 0, lightSpellMins: 0 });
    expect(texts(board().lookAhead(dark, "right"))).toEqual(["You see:\ndarkness.\n"]);
  });
});
