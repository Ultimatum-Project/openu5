/**
 * EL BLOQUEO POR PNJ EN PUEBLO ES MUDO EN EL PORT — y en el binario NO.
 *
 * Hermana de PUEBLO de la ficha #342 (`apie-342-ocupacion.test.ts`, que cubre la vía
 * de EXTERIOR, MAINOUT 0x01FE). La cola de pueblo es `town_move` TOWN.OVL 0x0600 y su
 * bloque de ocupación se leyó del disasm para esta ficha, no se heredó del acta:
 *
 *   0678: mov al, byte ptr [bx + si - 0x5459]   ; el TERRENO se busca aquí, pero
 *   067e: mov word ptr [bp - 0xe], ax           ;   todavia NO se consulta
 *   0669: mov word ptr [bp - 4], 1              ; «pasa» entra valiendo 1
 *   069c: call 0xffffb4be                       ; → kernel 0x368E find_object_at_xy
 *   06a2: or ax, ax / jne 0x6a9                 ;   (sin actor → 0x776, [bp-4] sigue 1)
 *   06a9: mov word ptr [bp - 4], 0              ; ★ HAY ACTOR ⇒ BLOQUEA por defecto
 *   06bf: cmp [bp-8],0x24 / 06c5: cmp 0x2c      ; lista blanca: fragata/esquife
 *   06ce: cmp [bp-8],0x1b                       ;   alfombra
 *   06d7: and al,0xfe / 06dc: cmp al,0x10       ;   caballo 0x10/0x11
 *   06e3: cmp [bp-8],0x1e · 06ec: cmp [bp-8],0x1f
 *   0771: mov word ptr [bp - 4], 1              ;   los de la lista vuelven a «pasa»
 *   0776: cmp word ptr [bp - 4], 0 / 077c: jmp 0x83a   ; ⇒ MISMA COLA que el terreno
 *   0788: call 0xffffaa7c                       ; el terreno se consulta DESPUÉS
 *   083a: mov ax, 0x26d6 / call print           ; b'Blocked!\n' (DS 0x26d6)
 *   0841: mov ax,0xa5 · 0845: mov ax,0xc8 · 0849: call 0xffffa0f0   ; beep(0xa5,0xc8)
 *
 * (Los `call 0xffff….` son near-calls cross-overlay: destino real =
 * `(target + load_seg*16) & 0xFFFF`, con TOWN.OVL en `load_seg = 0x081D` → `+0x81D0`.
 * Control positivo del método: 0xffffb4be → 0x368E, que es el mismo destino que ya
 * cita `re/notes/f8-objeto-vision-luz.md` §1 por otra vía.)
 *
 * ★ LO QUE DECIDE: el bloqueo por ACTOR y el bloqueo por TERRENO **comparten la cola**
 * 0x083a. No hay dos salidas: `[bp-4]==0` manda a la MISMA rutina que imprime
 * «Blocked!» y beepea. La tabla 0x5C5A que barre 0x368E es la tabla viva de actores
 * del .NPC — lo prueba `NPC.OVL 0x091c/0x0926`, que escribe la x y la y del PNJ que
 * acaba de caminar en `si + 0x5c5c` / `si + 0x5c5d` con `si = slot << 3` (base 0x5C5A,
 * paso 8, campo +2 = x, +3 = y). ⇒ **en el binario, andar contra un PNJ imprime
 * «Blocked!» y suena**, exactamente igual que andar contra un muro.
 *
 * EL PORT lo resolvía por una vía APARTE (`Game.move` → `npcAtTarget`) que retornaba
 * antes de llegar a la cola compartida: consumía el turno y **no emitía ni mensaje ni
 * sonido**. Dos observables perdidos por tener DOS colas donde el binario tiene UNA.
 *
 * 🔴 Por qué importa más allá de la fidelidad: el arnés del careo visual clasifica
 * «el port bloqueó» leyendo la ÚLTIMA LÍNEA de la consola del port
 * (`game/tools/careo-visual/captura-port.pw.ts`, `portFallo = /Blocked!|…/`). Con el
 * bloqueo por PNJ mudo, ese predicado **no puede ver justo el caso que existe para
 * corregir**. Medido en el corpus del ch02: de 841 compases de movimiento, 8 fueron
 * bloqueos MUDOS del port — y el primero (`c0050`) es la PRIMERA divergencia de
 * posición de todo el episodio.
 */
import { describe, expect, it } from "vitest";
import { Game, type GameData, type GameSystems } from "../src/core/game.js";
import type { CharacterState, ExtractedInitialState, GameState } from "../src/core/state.js";
import type { SmallMapLocation, WorldData } from "../src/core/world/map.js";
import { NpcManager, type NpcSlot } from "../src/core/npc/manager.js";
import { DoorManager } from "../src/core/world/doors.js";

const TOWN = 2;
const SMALL = 32;
const FLOOR_TILE = 68; // 0x44 BrickFloor — pisable a pie
const WALL_TILE = 79; // 0x4F StoneBrickWall — NO pisable
const NPC_X = 5;
const NPC_Y = 5;
/** El party arranca al SUR del PNJ y anda al NORTE, contra su casilla. */
const START = { x: NPC_X, y: NPC_Y + 1 };

function makeChar(): CharacterState {
  return {
    name: "Test", gender: 0x0b, class: "A", status: "G",
    strength: 20, dexterity: 20, intelligence: 20, currentMp: 10, currentHp: 50, maxHp: 60,
    exp: 0, level: 2, monthsAtInn: 0,
    helmet: 0xff, armor: 0xff, weapon: 0xff, shield: 0xff, ring: 0xff, amulet: 0xff,
    partyStatus: 0,
  } as CharacterState;
}

function makeState(): GameState {
  return {
    version: 1, characters: [makeChar()], partySize: 1, activeCharacter: 0,
    food: 100, gold: 100, keys: 5, gems: 0, torches: 2, karma: 50, skullKeys: 0,
    time: { year: 139, month: 4, day: 7, hour: 12, minute: 0 },
    turnsSinceStart: 0,
    position: { location: TOWN, floor: 0, x: START.x, y: START.y },
    transport: "foot", torchTurns: 0,
    questFlags: {}, journal: [], worldObjects: [],
    npcDead: Array.from({ length: 32 }, () => [] as boolean[]),
    npcMet: Array.from({ length: 32 }, () => [] as boolean[]),
    equipmentQuantities: new Array(48).fill(0),
    spellQuantities: new Array(48).fill(0),
    scrollQuantities: new Array(8).fill(0),
    potionQuantities: new Array(8).fill(0),
    reagentQuantities: new Array(8).fill(0),
  } as unknown as GameState;
}

/** Pueblo 32×32 de suelo pisable; `muroEn` pone un muro 0x4F en una casilla. */
function world(muroEn?: { x: number; y: number }): WorldData {
  const tiles = Array.from({ length: SMALL }, () =>
    Array.from({ length: SMALL }, () => FLOOR_TILE),
  );
  if (muroEn) tiles[muroEn.y]![muroEn.x] = WALL_TILE;
  const map: SmallMapLocation = { id: TOWN, name: "TestTown", floors: [{ z: 0, tiles }] };
  const overworld = Array.from({ length: 256 }, () =>
    Array.from({ length: 256 }, () => FLOOR_TILE),
  );
  return { overworld, underworld: overworld, smallMaps: new Map([[TOWN, map]]) };
}

const gameData: GameData = {
  locationsX: Array.from({ length: 32 }, () => 250),
  locationsY: Array.from({ length: 32 }, () => 250),
  locationNames: Array.from({ length: 32 }, (_, i) => `Loc${i + 1}`),
  searchObjects: [],
};

/**
 * `type` del slot: 0x54 es el de la familia de mercaderes en `npcs.json` (el mismo
 * que usa `talk-mounted-merchant.test.ts`). Está FUERA de la lista blanca de
 * TOWN 0x06bf-0x06f5, así que en el binario este actor BLOQUEA.
 */
function makeGame(opts: { conNpc: boolean; muroEn?: { x: number; y: number } }) {
  const slot: NpcSlot = {
    slot: 3,
    aiTypes: [0, 0, 0],
    x: [NPC_X, NPC_X, NPC_X], y: [NPC_Y, NPC_Y, NPC_Y], z: [0, 0, 0],
    times: [0, 8, 16, 24],
    type: 0x54,
    dialogNumber: 1,
  };
  const state = makeState();
  const npcManager = new NpcManager(opts.conNpc ? { [TOWN]: [slot] } : { [TOWN]: [] });
  const systems: GameSystems = { npcManager, doors: new DoorManager() };
  const g = new Game({} as ExtractedInitialState, world(opts.muroEn), gameData, state, systems);
  npcManager.enterMap(TOWN, state);
  return { g, state };
}

interface Paso {
  avanzo: boolean;
  pos: { x: number; y: number };
  mensajes: string[];
  sfx: string[];
  /** Los `kind` en ORDEN, para poder carear la SECUENCIA y no sólo la presencia. */
  orden: string[];
  minutos: number;
}

function pasoAlNorte(opts: { conNpc: boolean; muroEn?: { x: number; y: number } }): Paso {
  const { g, state } = makeGame(opts);
  const antes = state.time.hour * 60 + state.time.minute;
  const events = g.move("north");
  const despues = state.time.hour * 60 + state.time.minute;
  return {
    avanzo: events.some((e) => e.kind === "moved"),
    pos: { x: state.position.x, y: state.position.y },
    mensajes: events.flatMap((e) => (e.kind === "message" ? [e.text ?? ""] : [])),
    sfx: events.flatMap((e) =>
      e.kind === "sfx" ? [(e as { sfx: { id: string } }).sfx.id] : [],
    ),
    orden: events.map((e) => e.kind),
    minutos: (despues - antes + 24 * 60) % (24 * 60),
  };
}

describe("PUEBLO · el PNJ bloquea por la MISMA cola que el muro (TOWN.OVL 0x0776 → 0x083a)", () => {
  it("CONTROL POSITIVO — sin nadie delante, el paso avanza y NO dice «Blocked!»", () => {
    const r = pasoAlNorte({ conNpc: false });
    expect(r.avanzo).toBe(true);
    expect(r.pos).toEqual({ x: NPC_X, y: NPC_Y });
    expect(r.mensajes).not.toContain("Blocked!");
    expect(r.sfx).not.toContain("move-blocked");
  });

  it("CONTROL DE REFERENCIA — un MURO en la casilla destino sí imprime y suena", () => {
    // Es el testigo que fija el ESPERADO EN CRUDO de los dos casos siguientes: no se
    // deriva del sujeto, se lee de la cola de terreno que ya estaba portada.
    const r = pasoAlNorte({ conNpc: false, muroEn: { x: NPC_X, y: NPC_Y } });
    expect(r.avanzo).toBe(false);
    expect(r.pos).toEqual(START);
    expect(r.mensajes).toContain("Blocked!");
    expect(r.sfx).toContain("move-blocked");
  });

  it("★ SUJETO — un PNJ en la casilla destino IMPRIME «Blocked!» (DS 0x26d6, 0x083a)", () => {
    const r = pasoAlNorte({ conNpc: true });
    expect(r.avanzo).toBe(false);
    expect(r.pos).toEqual(START);
    expect(r.mensajes).toContain("Blocked!");
  });

  it("★ SUJETO — y SUENA: beep(0xa5,0xc8) de 0x0849, el mismo del muro", () => {
    expect(pasoAlNorte({ conNpc: true }).sfx).toContain("move-blocked");
  });

  it("las dos colas son UNA: PNJ y muro producen el MISMO mensaje y el MISMO sfx", () => {
    // El aserto que impide que el fix se escriba como una TERCERA cola con texto propio.
    const npc = pasoAlNorte({ conNpc: true });
    const muro = pasoAlNorte({ conNpc: false, muroEn: { x: NPC_X, y: NPC_Y } });
    expect(npc.mensajes.filter((m) => m === "Blocked!")).toEqual(
      muro.mensajes.filter((m) => m === "Blocked!"),
    );
    expect(npc.sfx).toEqual(muro.sfx);
  });

  it("el ECO DE RUMBO va ANTES del «Blocked!» (0x0665 imprime el rumbo, 0x083a el fallo)", () => {
    const r = pasoAlNorte({ conNpc: true });
    const iEco = r.orden.indexOf("walk-echo");
    const iMsg = r.orden.indexOf("message");
    expect(iEco).toBeGreaterThanOrEqual(0);
    expect(iMsg).toBeGreaterThan(iEco);
  });

  it("GUARDA DE NO-REGRESIÓN — el bloqueo por PNJ sigue consumiendo 1 minuto (TOWN 0x15D4)", () => {
    // Ya era cierto antes del fix; va aquí para que añadir mensaje y sonido no se lleve
    // por delante el turno, que es la mitad que el port SÍ tenía bien.
    expect(pasoAlNorte({ conNpc: true }).minutos).toBe(1);
  });
});
