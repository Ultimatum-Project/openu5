/**
 * Tests del núcleo de mazmorras (Fase 6) con datos REALES de
 * assets/maps/dungeons.json y la party inicial de initial-state.json.
 *
 * Deceit (location 33), planta 0 (grid real, # muro, . nada, U ladderUp,
 * D ladderDown, ^ trap, s secretDoor):
 *      x: 0 1 2 3 4 5 6 7
 *   y=0:   # s # ^ # . # ^
 *   y=1:   # U # # # ^ # #
 *   y=2:   # . # ^ # # # ^
 *   y=3:   . ^ . . # D # .
 *   y=4:   # # # ^ # s # ^
 *   y=5:   # # # # # ^ # #
 *   y=6:   # D # ^ # . # ^
 *   y=7:   # . # . # D . .
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, it, expect } from "vitest";
import { createNewGame, type ExtractedInitialState, type GameState } from "../src/core/state.js";
import {
  DungeonState,
  roomCombatMapIndex,
  wallVariant,
  dungeonClearedBitIndex,
  dungeonRoomCleared,
  dungeonMarkRoomCleared,
  CellType,
  type DungeonCell,
  type DungeonData,
  type DungeonPos,
} from "../src/core/dungeon/index.js";
import { OriginalRng } from "../src/core/rng-original.js";
import {
  chestTrap,
  dungeonChestLoot,
  applyLootGrant,
  lootItemName,
} from "../src/core/world/commands.js";

function load<T>(rel: string): T {
  const path = fileURLToPath(new URL(rel, import.meta.url));
  return JSON.parse(readFileSync(path, "utf8").replace(/^﻿/, "")) as T;
}

const dungeons = load<DungeonData[]>("../assets/maps/dungeons.json");

function freshState(): GameState {
  return createNewGame(load<ExtractedInitialState>("../assets/initial-state.json"));
}

function pos(over: Partial<DungeonPos> = {}): DungeonPos {
  return { dungeon: 33, floor: 0, x: 1, y: 3, facing: "east", ...over };
}

/** Mazmorra sintética (loc 33) con un único cofre en (2,2) planta 0, subtipo `sub`. */
function chestDungeon(sub: number): DungeonData {
  const floors: DungeonCell[][][] = Array.from({ length: 8 }, () =>
    Array.from({ length: 8 }, () =>
      Array.from({ length: 8 }, () => ({ type: CellType.Nothing, sub: 0 })),
    ),
  );
  floors[0]![2]![2] = { type: CellType.Chest, sub };
  return { location: 33, name: "TestChest", floors };
}
function chestPos(): DungeonPos {
  return { dungeon: 33, floor: 0, x: 2, y: 2, facing: "north" };
}

describe("layout real de Deceit", () => {
  it("carga la mazmorra 33 con 8 plantas de 8x8", () => {
    const deceit = dungeons.find((d) => d.location === 33)!;
    expect(deceit.name).toBe("Deceit");
    expect(deceit.floors.length).toBe(8);
    expect(deceit.floors[0]!.length).toBe(8);
    expect(deceit.floors[0]![0]!.length).toBe(8);
  });

  it("planta 0 tiene la escalera de entrada (LadderUp) en (1,1)", () => {
    const dg = new DungeonState(dungeons, pos());
    expect(dg.cellAt(0, 1, 1)).toMatchObject({ type: CellType.LadderUp });
  });

  it("cellAt fuera de rango devuelve Wall", () => {
    const dg = new DungeonState(dungeons, pos());
    expect(dg.cellAt(0, -1, 0).type).toBe(CellType.Wall);
    expect(dg.cellAt(0, 8, 8).type).toBe(CellType.Wall);
    expect(dg.cellAt(99, 0, 0).type).toBe(CellType.Wall);
  });
});

describe("movimiento y muros reales", () => {
  it("avanza por el pasillo y=3 hasta chocar con el muro en (4,3)", () => {
    // (1,3)^  (2,3).  (3,3).  (4,3)#  → dos pasos al este y bloqueo.
    const dg = new DungeonState(dungeons, pos({ x: 1, y: 3, facing: "east" }));
    const state = freshState();

    expect(dg.cellAhead(1)).toMatchObject({ type: CellType.Nothing }); // (2,3)
    const e1 = dg.forward(state);
    expect(e1.some((e) => e.kind === "moved")).toBe(true);
    expect([dg.pos.x, dg.pos.y]).toEqual([2, 3]);

    dg.forward(state);
    expect([dg.pos.x, dg.pos.y]).toEqual([3, 3]);

    // (4,3) es muro: no se mueve.
    expect(dg.cellAhead(1).type).toBe(CellType.Wall);
    const blocked = dg.forward(state);
    expect(blocked.some((e) => e.kind === "moved")).toBe(false);
    expect([dg.pos.x, dg.pos.y]).toEqual([3, 3]);
  });

  it("una puerta secreta sin revelar bloquea como un muro", () => {
    // (1,1) mirando al norte → (1,0) es SecretDoor, no transitable aún.
    const dg = new DungeonState(dungeons, pos({ x: 1, y: 1, facing: "north" }));
    const state = freshState();
    expect(dg.cellAhead(1).type).toBe(CellType.SecretDoor);
    dg.forward(state);
    expect([dg.pos.x, dg.pos.y]).toEqual([1, 1]); // sin moverse
  });

  it("girar cambia la dirección de vista (horario y antihorario)", () => {
    const dg = new DungeonState(dungeons, pos({ facing: "north" }));
    dg.turnRight();
    expect(dg.pos.facing).toBe("east");
    dg.turnRight();
    expect(dg.pos.facing).toBe("south");
    dg.turnLeft();
    expect(dg.pos.facing).toBe("east");
  });

  it("giro 180° (ENTER/PERIOD del original, DUNGEON:0x0533): invierte el rumbo sin moverse", () => {
    const dg = new DungeonState(dungeons, pos({ x: 1, y: 1, facing: "north" }));
    const ev = dg.turnAround();
    expect(dg.pos.facing).toBe("south");
    expect([dg.pos.x, dg.pos.y]).toEqual([1, 1]);
    // Eco "Turn around.\n" (DS 0x2d0b, str-dungeon-move-echo) + giro.
    expect(ev).toEqual([{ kind: "message", text: "Turn around.\n" }, { kind: "turned" }]);
    dg.turnAround();
    expect(dg.pos.facing).toBe("north");
    dg.turnRight(); // east
    dg.turnAround();
    expect(dg.pos.facing).toBe("west");
  });

  it("pisar un hoyo simple (0x60) avisa pero no cae ni daña", () => {
    // (1,3) f0 es Trap sub 0 (0x60 hoyo simple, decorativo); en el binario NO
    // dispara caída (sólo 0x61/0x69). Entramos desde (2,3) al oeste.
    const dg = new DungeonState(dungeons, pos({ x: 2, y: 3, facing: "west" }));
    const state = freshState();
    const before = state.characters[0]!.currentHp;
    const ev = dg.forward(state);
    expect([dg.pos.x, dg.pos.y]).toEqual([1, 3]);
    expect(ev.some((e) => e.kind === "message" && /pit/i.test(e.text ?? ""))).toBe(true);
    expect(ev.some((e) => e.kind === "damage")).toBe(false);
    expect(dg.pos.floor).toBe(0);
    expect(state.characters[0]!.currentHp).toBe(before);
  });
});

describe("fuentes reales", () => {
  it("beber en una fuente de curación total (0x51) sube al PJ activo a maxHp", () => {
    // Deceit f1 (1,5) = 0x51 (heal). Nos plantamos encima y bebemos.
    const dg = new DungeonState(dungeons, pos({ dungeon: 33, floor: 1, x: 1, y: 5 }));
    const state = freshState();
    expect(dg.cellAt(1, 1, 5)).toMatchObject({ type: 0x5, sub: 1 });
    const ch = state.characters[0]!;
    ch.currentHp = 1;
    const ev = dg.drinkFountain(state);
    expect(ev.some((e) => e.kind === "message" && /heal/i.test(e.text ?? ""))).toBe(true);
    expect(ch.currentHp).toBe(ch.maxHp);
  });

  it("beber en una fuente de veneno (0x53 mal sabor) daña rand(0,7) al PJ activo", () => {
    // Deceit f2 (3,1) = 0x53 (bad taste). Daño acotado 0..7.
    const dg = new DungeonState(dungeons, pos({ dungeon: 33, floor: 2, x: 3, y: 1 }));
    const state = freshState();
    expect(dg.cellAt(2, 3, 1)).toMatchObject({ type: 0x5, sub: 3 });
    const ch = state.characters[0]!;
    const before = ch.currentHp;
    const ev = dg.drinkFountain(state);
    expect(ev.some((e) => e.kind === "message" && /taste/i.test(e.text ?? ""))).toBe(true);
    expect(before - ch.currentHp).toBeGreaterThanOrEqual(0);
    expect(before - ch.currentHp).toBeLessThanOrEqual(7);
  });

  it("fountainHere() distingue la fuente de otra celda (gate del prompt 'Will you drink?')", () => {
    // (1,5) de Deceit f1 es fuente; (1,6) es escalera de bajada — NO fuente.
    const onFountain = new DungeonState(dungeons, pos({ dungeon: 33, floor: 1, x: 1, y: 5 }));
    expect(onFountain.fountainHere()).toBe(true);
    const offFountain = new DungeonState(dungeons, pos({ dungeon: 33, floor: 1, x: 1, y: 6 }));
    expect(offFountain.fountainHere()).toBe(false);
  });
});

describe("escaleras y salidas", () => {
  it("klimb up en planta 0 sobre LadderUp → exit-overworld", () => {
    const dg = new DungeonState(dungeons, pos({ floor: 0, x: 1, y: 1, facing: "north" }));
    const state = freshState();
    const ev = dg.klimb(state, "up");
    // change_level imprime la dirección (0x1C83) ANTES del gate de salida (0x1C87),
    // así que "Up!\n" (DS 0x6c74) se emite aun cuando el klimb sale al overworld. #62
    expect(ev.some((e) => e.kind === "message" && e.text === "Up!\n")).toBe(true);
    expect(ev.some((e) => e.kind === "exit-overworld")).toBe(true);
    expect(dg.pos.floor).toBe(0); // no cambia de planta al salir
  });

  it("klimb down en Deceit desde LadderDown baja de planta y entra en la Room 0", () => {
    // Deceit f0 (5,3) LadderDown → f1 (5,3) Room sub 0 (DungeonRoomAccess: KlimbDown).
    const dg = new DungeonState(dungeons, pos({ floor: 0, x: 5, y: 3 }));
    const state = freshState();
    expect(dg.cellAt(0, 5, 3).type).toBe(CellType.LadderDown);
    const ev = dg.klimb(state, "down");
    expect(dg.pos.floor).toBe(1);
    // "Down!\n" (DS 0x6c6c) impreso por change_level (0x1C83) al bajar de planta. #62
    expect(ev.some((e) => e.kind === "message" && e.text === "Down!\n")).toBe(true);
    expect(ev.some((e) => e.kind === "floor-changed")).toBe(true);
    const room = ev.find((e) => e.kind === "combat-room")!;
    // Deceit orden 0 → 16 + 0*16 + 0 = 16.
    expect(room.roomCombatMapIndex).toBe(16);
  });

  it("Deceit no conecta con el Underworld: su planta 7 no tiene escalera abajo", () => {
    const deceit = dungeons.find((d) => d.location === 33)!;
    const hasDown = deceit.floors[7]!.some((row) =>
      row.some((c) => c.type === CellType.LadderDown || c.type === CellType.LadderUpDown),
    );
    expect(hasDown).toBe(false);
  });

  it("klimb down en la planta 7 de Wrong (LadderDown en 7,7) → exit-underworld", () => {
    // Wrong (36) sí tiene escalera abajo en la planta más profunda.
    const dg = new DungeonState(dungeons, pos({ dungeon: 36, floor: 7, x: 7, y: 7 }));
    const state = freshState();
    expect(dg.cellAt(7, 7, 7).type).toBe(CellType.LadderDown);
    const ev = dg.klimb(state, "down");
    // "Down!\n" (DS 0x6c6c) se emite ANTES del gate de salida (0x1C83 < 0x1C87). #62
    expect(ev.some((e) => e.kind === "message" && e.text === "Down!\n")).toBe(true);
    expect(ev.some((e) => e.kind === "exit-underworld")).toBe(true);
    expect(dg.pos.floor).toBe(7);
  });
});

describe("cofre real", () => {
  // Dataset real: los 3 cofres de pasillo de U5 tienen sub=1 (bit de trampa 0x7
  // puesto, LIT limpio) → todos atrapados. Deceit (33) planta 7 (5,5) es uno.
  it("Deceit p7 (5,5): (O)pen dispara la trampa (tabla completa) SIN botín; el (G)et posterior acredita el botín REAL (dungeonChestLoot) — rand exacto O→G", () => {
    expect(dungeons.find((d) => d.location === 33)!.floors[7]![5]![5]).toMatchObject({
      type: CellType.Chest,
      sub: 1,
    });
    const seed = 20260719;
    const dg = new DungeonState(
      dungeons,
      pos({ dungeon: 33, floor: 7, x: 5, y: 5 }),
      new OriginalRng(seed),
    );
    const state = freshState();
    // Residual-3: el binario reparte O y G en DOS comandos (open_dungeon 0x12D4 solo
    // trampa+tile 0x70; get_dungeon 0x179E acredita) — el port ya no los colapsa.
    const ev = dg.openChest(state);
    expect(dg.cellAt(7, 5, 5).type).toBe(CellType.OpenChest); // 0x134a: (tile&8)+0x70
    const evGet = dg.getHere(state);

    // Referencia independiente: MISMO seed, MISMO orden (trampa 0x7050 primero, luego
    // las 7 filas de dungeonChestLoot 0x179E). Prueba el cableado y el orden del stream.
    const ref = new OriginalRng(seed);
    const rand = (lo: number, hi: number): number => ref.next(lo, hi);
    const refState = freshState();
    const opener = refState.activeCharacter === 0xff ? 0 : refState.activeCharacter;
    // `partySize` = el mismo que pasa openChest 0x1323 — si aquí se pusiera otra cota
    // el espejo dejaría de serlo y el stream se desviaría (ficha #41).
    const trap = chestTrap(33, opener, refState.characters, rand, refState.partySize); // loc 33 ≤ 0x7f → tabla completa
    const grants = dungeonChestLoot(7, rand);
    for (const g of grants) applyLootGrant(refState, g);

    // Contadores simples acreditados EXACTOS (no el oro falso rand(1,90) de antes).
    expect(state.gold).toBe(refState.gold);
    expect(state.keys).toBe(refState.keys);
    expect(state.gems).toBe(refState.gems);
    expect(state.torches).toBe(refState.torches);
    expect(state.food).toBe(refState.food);
    // La trampa mutó al que abre igual que en la referencia (HP o estado).
    expect(state.characters[opener]!.currentHp).toBe(refState.characters[opener]!.currentHp);
    expect(state.characters[opener]!.status).toBe(refState.characters[opener]!.status);

    // (O)pen: nombre de trampa → "Chest opened"; el botín NO sale aquí (0x12D4).
    const openTexts = ev.filter((e) => e.kind === "message").map((e) => e.text);
    expect(openTexts).toContain(trap.message); // "ACID!"/"POISON!"/"BOMB!"/"GAS!"
    expect(openTexts).toContain("Chest opened");
    expect(openTexts.join("")).not.toContain("You find:");
    // (G)et: eco "Get" + cabecera 0x8dbc + una línea por pieza acreditada (0x1458).
    const getTexts = evGet.filter((e) => e.kind === "message").map((e) => e.text);
    expect(getTexts[0]).toBe("Get\n"); // DS 0x8da4 (0x17a6)
    expect(getTexts).toContain("contents\nof chest\nYou find:\n"); // DS 0x8dbc (0x181f)
    for (const g of grants) expect(getTexts).toContain(lootItemName(g.id, g.qty));

    // `tile &= 8` (0x181a): tras el (G)et la celda deja de ser cofre (queda pasillo).
    expect(dg.cellAt(7, 5, 5).type).toBe(CellType.Nothing);
  });

  it("un cofre NO trampeado (sub sin bit 0x7) no dispara trampa pero sí da botín real al (G)et", () => {
    const seed = 42;
    const dgTrap = new DungeonState([chestDungeon(1)], chestPos(), new OriginalRng(seed));
    const dgClean = new DungeonState([chestDungeon(0)], chestPos(), new OriginalRng(seed));
    const trapNames = new Set(["ACID!", "POISON!", "BOMB!", "GAS!"]);

    const stClean = freshState();
    const evClean = [...dgClean.openChest(stClean), ...dgClean.getHere(stClean)];
    expect(evClean.some((e) => trapNames.has(e.text ?? ""))).toBe(false);
    expect(evClean.some((e) => e.text === "contents\nof chest\nYou find:\n")).toBe(true);

    // El trampeado (sub=1) sí gasta rand en la trampa antes del botín → stream distinto.
    const evTrap = dgTrap.openChest(freshState());
    expect(evTrap.some((e) => trapNames.has(e.text ?? ""))).toBe(true);
  });

  it("★ #328: la trampa que DAÑA emite el guión de flash de daño (un 0x2a52 por slot, en orden)", () => {
    // rand fijo = 5 ⇒ TRAP_TYPE_TABLE[5] = 2 = BOMB (DS:0x559e). El bucle 0x2aa8
    // llama a kernel_apply_damage 0x2a52 por miembro VIVO del grupo — y 0x2a52 es
    // daño Y presentación (flash XOR de la fila 0x2a28 @0x2a59/0x2a6e + blip @0x2a68).
    const dg = new DungeonState(
      [chestDungeon(1)],
      chestPos(),
      { next: () => 5 } as unknown as OriginalRng,
    );
    const state = freshState();
    state.partySize = 3;
    const ev = dg.openChest(state);
    expect(ev.filter((e) => e.kind === "damage-script")).toEqual([
      { kind: "damage-script", slots: [0, 1, 2] }, // esperado en crudo: los 3 del grupo, ascendente
    ]);

    // CONTROL: GAS (rand 7 → tabla[7] = 3) muta estado SIN pasar por 0x2a52 ⇒ sin guión.
    const dg2 = new DungeonState(
      [chestDungeon(1)],
      chestPos(),
      { next: () => 7 } as unknown as OriginalRng,
    );
    const st2 = freshState();
    st2.partySize = 3;
    const ev2 = dg2.openChest(st2);
    expect(ev2.some((e) => e.kind === "damage-script")).toBe(false);
    expect(ev2.some((e) => e.text === "GAS!")).toBe(true); // control del control: la trampa sí saltó
  });

  it("abrir un cofre ya abierto (aún sin saquear) responde «Already Open!» (0x12D4 tile 0x70)", () => {
    const dg = new DungeonState([chestDungeon(1)], chestPos(), new OriginalRng(1));
    const state = freshState();
    dg.openChest(state);
    const ev = dg.openChest(state);
    expect(ev).toEqual([{ kind: "message", text: "Already Open!" }]);
    // Tras el (G)et la celda ya no es cofre: un (O)pen posterior no ve nada.
    dg.getHere(state);
    const evAfter = dg.openChest(state);
    // RE-BASELINE 2026-07-25 (sapo real del espejo-2): el original responde "What?\n"
    // (DATA.OVL 0x8bb6, 3ª salida del despachador SJOG 0x12d4 vía `mov ax,0x8bb6` @0x1368);
    // "No chest here." era una cadena FABRICADA que no existe en ningún binario.
    expect(evAfter).toEqual([{ kind: "message", text: "What?\n" }]);
  });

  it("el botín no rebasa el tope u16 del oro (add_word_capped 0x9C84 vía applyLootGrant)", () => {
    const dg = new DungeonState(dungeons, pos({ dungeon: 33, floor: 7, x: 5, y: 5 }));
    const state = freshState();
    state.gold = 9999;
    dg.openChest(state);
    dg.getHere(state);
    expect(state.gold).toBe(9999); // no rebasa el tope u16 del original
  });

  it("los overrides serializan y restauran round-trip", () => {
    const dg = new DungeonState(dungeons, pos({ dungeon: 33, floor: 7, x: 5, y: 5 }));
    const state = freshState();
    dg.openChest(state);

    const snapshot = dg.serializeOverrides();
    // Al abrir, el subtipo se limpia conservando sólo el bit iluminado (sub 1 → 0).
    expect(snapshot).toContainEqual({ floor: 7, x: 5, y: 5, type: CellType.OpenChest, sub: 0 });

    // Un estado nuevo, sin abrir el cofre, lo ve cerrado hasta restaurar.
    const dg2 = new DungeonState(dungeons, pos({ dungeon: 33, floor: 7, x: 5, y: 5 }));
    expect(dg2.cellAt(7, 5, 5).type).toBe(CellType.Chest);
    dg2.restoreOverrides(snapshot);
    expect(dg2.cellAt(7, 5, 5).type).toBe(CellType.OpenChest);
  });
});

describe("salas de combate", () => {
  it("la fórmula RoomNumber → índice de combate usa el orden que salta Despise", () => {
    // Deceit (33) orden 0 → 16 + RoomNumber.
    expect(roomCombatMapIndex(33, 0)).toBe(16);
    expect(roomCombatMapIndex(33, 15)).toBe(31);
    // Destard (35) orden 1 (Despise no cuenta) → 32 + RoomNumber.
    expect(roomCombatMapIndex(35, 0)).toBe(32);
    // Doom (40) orden 6 → 16 + 96 = 112..
    expect(roomCombatMapIndex(40, 0)).toBe(112);
  });

  it("pisar una Room de Deceit (via klimb) emite combat-room con el índice real", () => {
    // Deceit f1 (5,7) Room sub 1; se entra por klimb down desde f0 (5,7) LadderDown.
    const dg = new DungeonState(dungeons, pos({ dungeon: 33, floor: 0, x: 5, y: 7 }));
    const state = freshState();
    expect(dg.cellAt(0, 5, 7).type).toBe(CellType.LadderDown);
    const ev = dg.klimb(state, "down");
    expect(dg.cellAt(1, 5, 7)).toMatchObject({ type: CellType.Room, sub: 1 });
    const room = ev.find((e) => e.kind === "combat-room")!;
    expect(room.roomCombatMapIndex).toBe(17); // 16 + 0*16 + 1
  });
});

describe("bitmap de salas despejadas (g_dng_room_cleared, DNGLOOK 0x0844/0x093a)", () => {
  it("dungeonClearedBitIndex replica la fórmula del binario y el colapso Deceit≡Despise", () => {
    // (dungIdx<<4)+room, dungIdx = loc-0x21 (−1 si ≥1). Deceit(0x21) y Despise(0x22)→idx 0.
    expect(dungeonClearedBitIndex(0x21, 0)).toBe(0); // Deceit sala 0
    expect(dungeonClearedBitIndex(0x21, 3)).toBe(3); // Deceit sala 3 → byte0 bit3
    expect(dungeonClearedBitIndex(0x22, 3)).toBe(3); // Despise COLAPSA a idx 0 (quirk)
    expect(dungeonClearedBitIndex(0x23, 0)).toBe(16); // Destard → idx 1 → byte2
    expect(dungeonClearedBitIndex(0x28, 15)).toBe(6 * 16 + 15); // Doom sala 15 → bit 111
  });

  it("mark/read del bit persistente sobre GameState", () => {
    const state = freshState();
    expect(dungeonRoomCleared(state, 33, 2)).toBe(false); // vacío al empezar
    dungeonMarkRoomCleared(state, 33, 2);
    expect(dungeonRoomCleared(state, 33, 2)).toBe(true);
    expect(dungeonRoomCleared(state, 33, 3)).toBe(false); // no contamina otras salas
    // bit 2 de Deceit → byte0 = 0x04, LSB-first
    expect(state.dungeonRoomsCleared![0]).toBe(0x04);
  });

  it("ganar una sala la marca despejada y la degrada a RoomsBroke (0xF→0xA)", () => {
    // Deceit f2 (1,1) Room sub 2.
    const dg = new DungeonState(dungeons, pos({ dungeon: 33, floor: 2, x: 1, y: 1 }));
    const state = freshState();
    expect(dg.cellAt(2, 1, 1)).toMatchObject({ type: CellType.Room, sub: 2 });
    dg.markCurrentRoomCleared(state);
    expect(dungeonRoomCleared(state, 33, 2)).toBe(true);
    expect(dg.cellAt(2, 1, 1)).toMatchObject({ type: CellType.RoomsBroke, sub: 2 });
  });

  it("una sala ya despejada NO re-dispara combate al re-entrar la mazmorra", () => {
    const state = freshState();
    // 1ª visita: klimb-down aterriza en Deceit f1 (5,7) Room sub 1 → combate.
    const dg1 = new DungeonState(dungeons, pos({ dungeon: 33, floor: 0, x: 5, y: 7 }));
    const ev1 = dg1.klimb(state, "down");
    expect(ev1.some((e) => e.kind === "combat-room")).toBe(true);
    dg1.markCurrentRoomCleared(state); // victoria → marca el bit persistente
    expect(dungeonRoomCleared(state, 33, 1)).toBe(true);
    // 2ª visita = mapa fresco (nueva DungeonState): applyClearedRooms degrada la sala,
    // y el MISMO klimb-down ya no dispara combate.
    const dg2 = new DungeonState(dungeons, pos({ dungeon: 33, floor: 0, x: 5, y: 7 }));
    dg2.applyClearedRooms(state);
    const ev2 = dg2.klimb(state, "down");
    // Sin combate, PERO con el eco "Entering room..." (el binario entra igual, vacía).
    expect(ev2.some((e) => e.kind === "combat-room")).toBe(false);
    expect(ev2.some((e) => e.kind === "message" && e.text === "Entering room...")).toBe(true);
    expect(dg2.cellAt(1, 5, 7).type).toBe(CellType.RoomsBroke);
  });

  // ── Guarda de salas EXENTAS (DNGLOOK 0x0844 cabeza, 0x0850-0x0887) ──────────
  // Tabla ESTÁTICA `DATA.OVL 0x384a` (= DS:0x383a) = 50 5b 41 46 4b 4c + cuenta 06
  // contigua en 0x3850. Clave = ((loc & 0xF) << 4) + room — NO colapsa Deceit≡Despise.
  // Derivación: re/notes/dungeon.md §14.1.2.
  it("las 6 salas EXENTAS de la tabla DS:0x383a NO ponen el bit persistente", () => {
    const state = freshState();
    const exempt: Array<[number, number, number]> = [
      [36, 1, 0x41], // Wrong sala 1  (cm49)
      [36, 6, 0x46], // Wrong sala 6  (cm54)
      [36, 11, 0x4b], // Wrong sala 11 (cm59)
      [36, 12, 0x4c], // Wrong sala 12 (cm60)
      [37, 0, 0x50], // Covetous sala 0  (cm64)
      [37, 11, 0x5b], // Covetous sala 11 (cm75)
    ];
    for (const [loc, room, key] of exempt) {
      dungeonMarkRoomCleared(state, loc, room);
      expect(
        dungeonRoomCleared(state, loc, room),
        `loc ${loc} sala ${room} = clave 0x${key.toString(16)} está en DATA.OVL 0x384a ` +
          `⇒ 0x0844 sale por el epílogo SIN el 'or [bx+0x58e0],al'`,
      ).toBe(false);
    }
  });

  it("una sala NO exenta de la MISMA mazmorra sí pone el bit (la guarda no es un apagón)", () => {
    const state = freshState();
    // Wrong sala 2 (clave 0x42) y Covetous sala 1 (0x51) NO están en la tabla de 6.
    dungeonMarkRoomCleared(state, 36, 2);
    dungeonMarkRoomCleared(state, 37, 1);
    expect(dungeonRoomCleared(state, 36, 2), "Wrong sala 2 = clave 0x42, ausente de DATA.OVL 0x384a").toBe(true);
    expect(dungeonRoomCleared(state, 37, 1), "Covetous sala 1 = clave 0x51, ausente de DATA.OVL 0x384a").toBe(true);
  });

  it("★ CICLO: una sala exenta se consume EN la visita y se RE-ARMA en la siguiente", () => {
    // Covetous (loc 37) f3 (1,1) = sala 11, EXENTA (clave 0x5b).
    const state = freshState();
    const dg1 = new DungeonState(dungeons, pos({ dungeon: 37, floor: 3, x: 1, y: 1 }));
    expect(dg1.cellAt(3, 1, 1)).toMatchObject({ type: CellType.Room, sub: 11 });

    dg1.markRoomClearedAt(state, 3, 1, 1); // victoria
    // (a) DENTRO de la visita SÍ se consume: el `&0xAF` de DUNGEON 0x00f5 no está guardado.
    expect(dg1.cellAt(3, 1, 1).type, "0x00f5 &0xAF degrada la celda sin guarda").toBe(CellType.RoomsBroke);
    // (b) pero el bit PERSISTENTE no se pone (la guarda de 0x0844).
    expect(dungeonRoomCleared(state, 37, 11), "clave 0x5b exenta ⇒ sin bit").toBe(false);

    // (c) 2ª visita = mapa fresco: applyClearedRooms (= 0x093a) sólo degrada las celdas CON
    //     bit ⇒ la sala vuelve ARMADA y re-dispara combate.
    const dg2 = new DungeonState(dungeons, pos({ dungeon: 37, floor: 3, x: 1, y: 1 }));
    dg2.applyClearedRooms(state);
    expect(dg2.cellAt(3, 1, 1).type, "re-armada: 0x093a no la degrada porque su bit nunca se puso").toBe(
      CellType.Room,
    );
  });

  it("CONTROL del ciclo: una sala NO exenta sí queda despejada entre visitas", () => {
    // Misma mecánica sobre Deceit (loc 33) f2 (1,1) sala 2 — clave 0x12, no exenta.
    const state = freshState();
    const dg1 = new DungeonState(dungeons, pos({ dungeon: 33, floor: 2, x: 1, y: 1 }));
    dg1.markRoomClearedAt(state, 2, 1, 1);
    expect(dungeonRoomCleared(state, 33, 2)).toBe(true);
    const dg2 = new DungeonState(dungeons, pos({ dungeon: 33, floor: 2, x: 1, y: 1 }));
    dg2.applyClearedRooms(state);
    expect(dg2.cellAt(2, 1, 1).type, "sin exención: 0x093a la degrada en la carga").toBe(CellType.RoomsBroke);
  });

  it("applyClearedRooms degrada al cargar sólo las salas con bit puesto", () => {
    const state = freshState();
    dungeonMarkRoomCleared(state, 33, 2); // Deceit sala 2 (f2 1,1)
    const dg = new DungeonState(dungeons, pos({ dungeon: 33, floor: 2, x: 1, y: 1 }));
    // Antes de aplicar: la sala sigue viva (0xF) en los datos clonados.
    expect(dg.cellAt(2, 1, 1).type).toBe(CellType.Room);
    dg.applyClearedRooms(state);
    expect(dg.cellAt(2, 1, 1).type).toBe(CellType.RoomsBroke); // degradada
    // Otra sala sin bit (sub 1, f1 5,7) permanece viva.
    expect(dg.cellAt(1, 5, 7).type).toBe(CellType.Room);
  });
});

describe("puerta secreta", () => {
  it("Search revela una puerta secreta adyacente y la vuelve transitable", () => {
    // Deceit f2 (5,0) SecretDoor; el jugador está debajo en (5,1) mirando al norte.
    const dg = new DungeonState(dungeons, pos({ dungeon: 33, floor: 2, x: 5, y: 1, facing: "north" }));
    const state = freshState();
    state.torchTurns = 100; // con luz (gate E4-1)
    expect(dg.cellAt(2, 5, 0).type).toBe(CellType.SecretDoor);

    // Antes de buscar, la puerta bloquea.
    expect(dg.isPassable(dg.cellAt(2, 5, 0), 2, 5, 0)).toBe(false);
    dg.forward(state);
    expect([dg.pos.x, dg.pos.y]).toEqual([5, 1]);

    const ev = dg.search(state);
    // search_dungeon (SJOG:0x0646) imprime "You find:" y luego el resultado.
    const texts = ev.filter((e) => e.kind === "message").map((e) => e.text);
    expect(texts).toEqual(["You find:", "A hidden door!"]);

    // Ahora es transitable y podemos entrar.
    expect(dg.isPassable(dg.cellAt(2, 5, 0), 2, 5, 0)).toBe(true);
    dg.forward(state);
    expect([dg.pos.x, dg.pos.y]).toEqual([5, 0]);
  });

  it("Search es DIRECCIONAL: mira SÓLO la celda de delante, no los 4 vecinos", () => {
    // Mirando al SUR: la puerta secreta de (5,0) queda a la ESPALDA; delante (5,2)
    // es un foso de caída (0x61) → E4 lo describe ("A pit!"), y NO revela la puerta
    // de atrás. Lo que ancla el test es la DIRECCIONALIDAD, no el mensaje exacto.
    const dg = new DungeonState(dungeons, pos({ dungeon: 33, floor: 2, x: 5, y: 1, facing: "south" }));
    const state = freshState();
    state.torchTurns = 100; // con luz (gate E4-1)
    const texts = dg.search(state).filter((e) => e.kind === "message").map((e) => e.text);
    expect(texts[0]).toBe("You find:");
    expect(texts).not.toContain("A hidden door!"); // no se reveló la puerta a la espalda
    // La puerta a la espalda SIGUE bloqueando (no revelada).
    expect(dg.isPassable(dg.cellAt(2, 5, 0), 2, 5, 0)).toBe(false);
  });

  it("Search revela a través del WRAP toroidal (SJOG:0x0698/0x06a3 `and 7`)", () => {
    // Hythloth (39) f0: la party en (0,5) mirando al OESTE; la celda de delante con
    // wrap es la SECRETA (7,5) — la única entrada del par emparedado r1/r2. El binario
    // enmascara el ahead con `and 7` antes del fetch (0x595A), igual que el paso
    // (DUNGEON:0x057a): buscar desde el borde DEBE revelar la puerta del otro lado.
    const dg = new DungeonState(dungeons, pos({ dungeon: 39, floor: 0, x: 0, y: 5, facing: "west" }));
    const state = freshState();
    state.torchTurns = 100; // con luz (gate E4-1)
    expect(dg.cellAt(0, 7, 5).type).toBe(CellType.SecretDoor);
    // Sin revelar, el paso con wrap está bloqueado.
    expect(dg.isPassable(dg.cellAt(0, 7, 5), 0, 7, 5)).toBe(false);
    dg.forward(state);
    expect([dg.pos.x, dg.pos.y]).toEqual([0, 5]);

    const texts = dg.search(state).filter((e) => e.kind === "message").map((e) => e.text);
    expect(texts).toEqual(["You find:", "A hidden door!"]);

    // Revelada: transitable, y el forward WRAPEA de (0,5) a (7,5).
    expect(dg.isPassable(dg.cellAt(0, 7, 5), 0, 7, 5)).toBe(true);
    dg.forward(state);
    expect([dg.pos.x, dg.pos.y]).toEqual([7, 5]);
  });
});

describe("Search de trampa E4 (cofre/bomba/foso) — mutaciones", () => {
  // Mazmorra sintética 1 planta: party en (1,1) mirando al ESTE, celda de delante
  // (2,1) = `ahead`. DEX del PJ activo controla el threshold; rng inyectable.
  function dgAhead(ahead: { type: number; sub: number }, dex: number, seed = 7, dungeon = 33) {
    const floor = Array.from({ length: 8 }, () =>
      Array.from({ length: 8 }, () => ({ type: 0, sub: 0 })),
    );
    floor[1]![2] = ahead;
    const dg = new DungeonState(
      [{ location: dungeon, name: "D", floors: [floor] }],
      { dungeon, floor: 0, x: 1, y: 1, facing: "east" },
      new OriginalRng(seed),
    );
    const state = freshState();
    state.activeCharacter = 0;
    state.characters[0]!.dexterity = dex;
    state.torchTurns = 100; // con luz: el Search de mazmorra no aborta (gate E4-1)
    return { dg, state };
  }

  it("bomba 0x62 detectada (DEX 30 → thr 0): 'A bomb trap!' + DESARMA a hoyo/nada", () => {
    const { dg, state } = dgAhead({ type: CellType.Trap, sub: 2 }, 30);
    const texts = dg.search(state).filter((e) => e.kind === "message").map((e) => e.text);
    expect(texts).toEqual(["You find:", "A bomb trap!"]);
    // La bomba quedó desarmada (tipo Nothing).
    expect(dg.cellAt(0, 2, 1).type).toBe(CellType.Nothing);
  });

  it("foso de caída 0x61: 'A pit!' + revela a hoyo simple (sub 0), sin rand", () => {
    const { dg, state } = dgAhead({ type: CellType.Trap, sub: 1 }, 15);
    const texts = dg.search(state).filter((e) => e.kind === "message").map((e) => e.text);
    expect(texts).toEqual(["You find:", "A pit!"]);
    const c = dg.cellAt(0, 2, 1);
    expect(c.type).toBe(CellType.Trap);
    expect(c.sub & 0x7).toBe(0); // revelado a hoyo simple
  });

  it("hoyo simple 0x60: DS 0x8786 entera, sin rand ni mutación (#133)", () => {
    const { dg, state } = dgAhead({ type: CellType.Trap, sub: 0 }, 15);
    const seedBefore = dg.serializeOverrides().length; // proxy: sin overrides nuevos
    const texts = dg.search(state).filter((e) => e.kind === "message").map((e) => e.text);
    expect(texts).toEqual(["You find:", "Nothing hidden\nin the pit."]); // #133: DS 0x8786 ENTERA (antes sólo la cola tras el \n)
    expect(dg.serializeOverrides().length).toBe(seedBefore);
  });

  it("cofre 0x40 sin trampa (DEX 30 → thr 0): 'No trap' (1 tirada)", () => {
    const { dg, state } = dgAhead({ type: CellType.Chest, sub: 0 }, 30);
    const texts = dg.search(state).filter((e) => e.kind === "message").map((e) => e.text);
    expect(texts).toEqual(["You find:", "No trap"]);
  });

  it("sin luz (torchTurns 0): gate E4-1 aborta — '\\nYou find:\\ndarkness.\\n', NO busca", () => {
    const { dg, state } = dgAhead({ type: CellType.Chest, sub: 0 }, 30);
    state.torchTurns = 0; // oscuridad total → aborta sin tirada
    const texts = dg.search(state).filter((e) => e.kind === "message").map((e) => e.text);
    // String RESUELTO con cita binaria: SJOG 0x0668 push DS 0x86de = DATA.OVL
    // 0x86EE '\nYou find:\ndarkness.\n' (cierra el PENDIENTE-TESTIGO de E4-1).
    expect(texts).toEqual(["\nYou find:\ndarkness.\n"]);
  });

  // Muro especial 0xC (E4-3): la variante es DETERMINISTA por mazmorra (sin rand).
  it("muro 0xC en Deceit (33, variant 3): los DOS prints + se derrumba a muro (#133)", () => {
    const { dg, state } = dgAhead({ type: CellType.SpecialWall, sub: 0 }, 15, 7, 33);
    const texts = dg.search(state).filter((e) => e.kind === "message").map((e) => e.text);
    expect(texts).toEqual(["You find:", "Nothing hidden on the skeleton.", "It crumbles away."]); // #133: 0x0868 + 0x086f son DOS prints
    expect(dg.cellAt(0, 2, 1).type).toBe(CellType.Wall); // derrumbado
  });

  it("muro 0xC en Shame (38, variant 2): 'Nothing in the caved in passage.'", () => {
    const { dg, state } = dgAhead({ type: CellType.SpecialWall, sub: 0 }, 15, 7, 38);
    const texts = dg.search(state).filter((e) => e.kind === "message").map((e) => e.text);
    expect(texts).toEqual(["You find:", "Nothing in the caved in passage."]);
    expect(dg.cellAt(0, 2, 1).type).toBe(CellType.SpecialWall); // NO se derrumba
  });

  it("muro 0xC en Despise (34, variant 1): 'Nothing on the stalactite.'", () => {
    const { dg, state } = dgAhead({ type: CellType.SpecialWall, sub: 0 }, 15, 7, 34);
    const texts = dg.search(state).filter((e) => e.kind === "message").map((e) => e.text);
    expect(texts).toEqual(["You find:", "Nothing on the stalactite."]);
  });
});

describe("Search F2-T7 — celda objetivo (Dir- 0x0672) + miembro del selector 0x8a08", () => {
  /** Party en (1,1) mirando al ESTE; celda `at` colocada donde diga el test. */
  function dgAt(
    cell: { x: number; y: number; type: number; sub: number },
    seed = 7,
  ) {
    const floor = Array.from({ length: 8 }, () =>
      Array.from({ length: 8 }, () => ({ type: 0, sub: 0 })),
    );
    floor[cell.y]![cell.x] = { type: cell.type, sub: cell.sub };
    const dg = new DungeonState(
      [{ location: 33, name: "D", floors: [floor] }],
      { dungeon: 33, floor: 0, x: 1, y: 1, facing: "east" },
      new OriginalRng(seed),
    );
    const state = freshState();
    state.activeCharacter = 0;
    state.torchTurns = 100;
    return { dg, state };
  }

  it("target 'here' inspecciona la celda PROPIA (getkey 4, DS 0x84fa)", () => {
    const { dg, state } = dgAt({ x: 1, y: 1, type: CellType.Trap, sub: 0 });
    const texts = dg
      .search(state, { target: "here" })
      .filter((e) => e.kind === "message")
      .map((e) => e.text);
    expect(texts).toEqual(["You find:", "Nothing hidden\nin the pit."]); // #133: DS 0x8786 ENTERA (antes sólo la cola tras el \n)
  });

  it("target 'right' = (f+1)&3: mirando al este inspecciona el SUR (1,2)", () => {
    const { dg, state } = dgAt({ x: 1, y: 2, type: CellType.Trap, sub: 0 });
    const texts = dg
      .search(state, { target: "right" })
      .filter((e) => e.kind === "message")
      .map((e) => e.text);
    expect(texts).toEqual(["You find:", "Nothing hidden\nin the pit."]); // #133: DS 0x8786 ENTERA (antes sólo la cola tras el \n)
  });

  it("target 'left' = (f+3)&3: mirando al este inspecciona el NORTE (1,0)", () => {
    const { dg, state } = dgAt({ x: 1, y: 0, type: CellType.Trap, sub: 0 });
    const texts = dg
      .search(state, { target: "left" })
      .filter((e) => e.kind === "message")
      .map((e) => e.text);
    expect(texts).toEqual(["You find:", "Nothing hidden\nin the pit."]); // #133: DS 0x8786 ENTERA (antes sólo la cola tras el \n)
  });

  it("sin opts sigue siendo ahead (compatibilidad con los llamadores previos)", () => {
    const { dg, state } = dgAt({ x: 2, y: 1, type: CellType.Trap, sub: 0 });
    const texts = dg.search(state).filter((e) => e.kind === "message").map((e) => e.text);
    expect(texts).toEqual(["You find:", "Nothing hidden\nin the pit."]); // #133: DS 0x8786 ENTERA (antes sólo la cola tras el \n)
  });

  it("searcherIdx: el threshold de trampa lee el DEX del MIEMBRO ELEGIDO (0x06b7)", () => {
    // Busca una semilla cuyo rand(1,30) caiga ≤ 14: con el ACTIVO (DEX 2 → thr 14)
    // reportaría trampa, pero con el miembro 1 (DEX 30 → thr 0) da 'No trap'.
    let seed = -1;
    for (let s = 1; s < 200; s++) {
      if (new OriginalRng(s).next(1, 30) <= 14) {
        seed = s;
        break;
      }
    }
    expect(seed).toBeGreaterThan(0);

    const make = () => {
      const r = dgAt({ x: 2, y: 1, type: CellType.Chest, sub: 0 }, seed);
      r.state.characters[0]!.dexterity = 2;
      r.state.characters[1] = { ...r.state.characters[0]!, name: "Min", dexterity: 30 };
      r.state.partySize = 2;
      return r;
    };
    // Control: con el activo (DEX 2) el roll ≤ thr → reporta una trampa.
    const ctl = make();
    const ctlTexts = ctl.dg.search(ctl.state).filter((e) => e.kind === "message").map((e) => e.text);
    expect(ctlTexts[1]).toMatch(/trap/i);
    // Con searcherIdx=1 (DEX 30 → thr 0): el MISMO roll queda por encima → 'No trap'.
    const sel = make();
    const selTexts = sel.dg
      .search(sel.state, { searcherIdx: 1 })
      .filter((e) => e.kind === "message")
      .map((e) => e.text);
    expect(selTexts).toEqual(["You find:", "No trap"]);
  });
});

describe("luz", () => {
  it("sin antorcha profundidad 0; con antorcha 4 (raycast DUNGEON:0x1B0C, si=0..3)", async () => {
    const { visibleDepth } = await import("../src/core/dungeon/light.js");
    const state = freshState();
    state.torchTurns = 0;
    state.lightSpellMins = 0;
    expect(visibleDepth(state)).toBe(0);
    state.torchTurns = 20;
    expect(visibleDepth(state)).toBe(4); // task #47: 4 celdas, no 3 (bucle `cmp si,4;jge`)
  });
});

describe("Klimb con garfio en mazmorra (DUNGEON 0x1E10 → 0x1e6e)", () => {
  // Mazmorra sintética de 3 plantas, todo Nothing; sólo se ajusta la celda de la
  // party (planta 1, 3,3) para aislar el bit 0x08 (lit) y el flag del garfio.
  function grappleDungeon(center: DungeonCell): DungeonData[] {
    const emptyFloor = (): DungeonCell[][] =>
      Array.from({ length: 8 }, () =>
        Array.from({ length: 8 }, (): DungeonCell => ({ type: CellType.Nothing, sub: 0 })),
      );
    const floors = Array.from({ length: 3 }, () => emptyFloor());
    floors[1]![3]![3] = { ...center };
    return [{ location: 33, name: "GrappleTest", floors }];
  }
  const at = (): DungeonPos => pos({ dungeon: 33, floor: 1, x: 3, y: 3 });
  const LIT_NOTHING: DungeonCell = { type: CellType.Nothing, sub: 0x8 }; // techo iluminado
  const DARK_NOTHING: DungeonCell = { type: CellType.Nothing, sub: 0x0 };
  const msgs = (ev: ReturnType<DungeonState["klimb"]>): string[] =>
    ev.filter((e) => e.kind === "message").map((e) => e.text ?? "");

  it("garfio + celda iluminada (sin escalera) → SUBE una planta (1e6e)", () => {
    const dg = new DungeonState(grappleDungeon(LIT_NOTHING), at(), new OriginalRng(1));
    const state = freshState();
    state.grapple = true;
    const ev = dg.klimb(state);
    expect(msgs(ev)).toContain("Up!\n"); // change_level imprime la dirección (0x1C83). #62
    expect(ev.some((e) => e.kind === "floor-changed")).toBe(true);
    expect(dg.pos.floor).toBe(0);
  });

  it("celda iluminada SIN garfio → 'Klimb-\\nWith What?' y no sube (0x6cd6)", () => {
    const dg = new DungeonState(grappleDungeon(LIT_NOTHING), at(), new OriginalRng(1));
    const state = freshState();
    state.grapple = false;
    const ev = dg.klimb(state);
    expect(msgs(ev)).toEqual(["Klimb-\nWith What?"]);
    expect(dg.pos.floor).toBe(1);
  });

  it("celda NO iluminada sin escalera → 'Klimb-what?' aun con garfio (0x6cea)", () => {
    const dg = new DungeonState(grappleDungeon(DARK_NOTHING), at(), new OriginalRng(1));
    const state = freshState();
    state.grapple = true; // el garfio no basta: la celda debe estar iluminada (bit 0x08)
    const ev = dg.klimb(state);
    expect(msgs(ev)).toEqual(["Klimb-what?"]);
    expect(dg.pos.floor).toBe(1);
  });

  it("la escalera arriba sube sin depender del bit lit ni del garfio (rama de escalera)", () => {
    const dg = new DungeonState(
      grappleDungeon({ type: CellType.LadderUp, sub: 0 }),
      at(),
      new OriginalRng(1),
    );
    const state = freshState();
    state.grapple = false;
    const ev = dg.klimb(state);
    expect(dg.pos.floor).toBe(0);
    expect(msgs(ev)).toContain("Up!\n"); // dirección impresa por change_level (0x1C83). #62
    expect(ev.some((e) => e.kind === "floor-changed")).toBe(true);
  });
});

describe("Klimb U/D prompt en mazmorra (DUNGEON 0x1e9c: escalera arriba Y abajo)", () => {
  function synthDungeon(center: DungeonCell): DungeonData[] {
    const emptyFloor = (): DungeonCell[][] =>
      Array.from({ length: 8 }, () =>
        Array.from({ length: 8 }, (): DungeonCell => ({ type: CellType.Nothing, sub: 0 })),
      );
    const floors = Array.from({ length: 3 }, () => emptyFloor());
    floors[1]![3]![3] = { ...center };
    return [{ location: 33, name: "UDTest", floors }];
  }
  const at = (): DungeonPos => pos({ dungeon: 33, floor: 1, x: 3, y: 3 });
  const msgs = (ev: ReturnType<DungeonState["klimb"]>): string[] =>
    ev.filter((e) => e.kind === "message").map((e) => e.text ?? "");
  const BOTH: DungeonCell = { type: CellType.LadderUpDown, sub: 0 };

  it("escalera arriba Y abajo → klimbNeedsChoice = true (pide prompt)", () => {
    const dg = new DungeonState(synthDungeon(BOTH), at(), new OriginalRng(1));
    expect(dg.klimbNeedsChoice(freshState())).toBe(true);
  });

  it("una sola escalera (arriba o abajo) → klimbNeedsChoice = false (sin prompt)", () => {
    const up = new DungeonState(synthDungeon({ type: CellType.LadderUp, sub: 0 }), at(), new OriginalRng(1));
    const down = new DungeonState(synthDungeon({ type: CellType.LadderDown, sub: 0 }), at(), new OriginalRng(1));
    expect(up.klimbNeedsChoice(freshState())).toBe(false);
    expect(down.klimbNeedsChoice(freshState())).toBe(false);
  });

  it("elección U (dir 'up') sube; D (dir 'down') baja + change_level imprime la dirección", () => {
    const s = freshState();
    const upDg = new DungeonState(synthDungeon(BOTH), at(), new OriginalRng(1));
    const upEv = upDg.klimb(s, "up");
    expect(upDg.pos.floor).toBe(0);
    expect(msgs(upEv)).toContain("Up!\n"); // 0x1C83 "Up!\n" (DS 0x6c74). #62
    const downDg = new DungeonState(synthDungeon(BOTH), at(), new OriginalRng(1));
    const downEv = downDg.klimb(s, "down");
    expect(downDg.pos.floor).toBe(2);
    expect(msgs(downEv)).toContain("Down!\n"); // 0x1C83 "Down!\n" (DS 0x6c6c). #62
  });

  it("Pass (Space) → 'Pass' sin cambiar de planta (0x6cc6)", () => {
    const dg = new DungeonState(synthDungeon(BOTH), at(), new OriginalRng(1));
    const ev = dg.klimb(freshState(), "pass");
    expect(msgs(ev)).toEqual(["Pass"]);
    expect(dg.pos.floor).toBe(1);
  });

  it("el garfio compone: LadderDown + celda iluminada + garfio → ambas vías → prompt", () => {
    const s = freshState();
    s.grapple = true;
    const dg = new DungeonState(synthDungeon({ type: CellType.LadderDown, sub: 0x8 }), at(), new OriginalRng(1));
    expect(dg.klimbNeedsChoice(s)).toBe(true); // canDown (escalera) + canUp (lit && garfio)
    expect(dg.klimbNeedsChoice(freshState())).toBe(false); // sin garfio, sólo baja → sin prompt
  });
});

describe("wallVariant — tileset de muro por mazmorra (DUNGEON:0x0e7b, tabla 0x25F2)", () => {
  // Derivado del binario: idx = loc−0x20; {1,4,5}→3 (DNG3 gris), {6,7}→2 (DNG2 rojo),
  // else→1 (DNG1 oliva). Verificado en vivo (Deceit gris casa video-N f010).
  it("mapea las 8 mazmorras a su variante DNG*.16", () => {
    const table: Record<number, { name: string; v: number }> = {
      33: { name: "Deceit", v: 3 },
      34: { name: "Despise", v: 1 },
      35: { name: "Destard", v: 1 },
      36: { name: "Wrong", v: 3 },
      37: { name: "Covetous", v: 3 },
      38: { name: "Shame", v: 2 },
      39: { name: "Hythloth", v: 2 },
      40: { name: "Doom", v: 1 },
    };
    for (const [loc, { v }] of Object.entries(table)) {
      expect(wallVariant(Number(loc))).toBe(v);
    }
  });
});
