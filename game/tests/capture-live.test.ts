/**
 * F1.7-T2 · Blackthorn CAPTURA viva (BLCKTHRN.OVL 0x060e `blackthorn_capture`,
 * disparada por TOWN 0x12ae).
 *
 * El motor puro (`blackthornCapture`/`runInterrogation`, world/blackthorn.ts) ya
 * está portado y con paridad; esta suite ejercita el CABLEADO al juego vivo: el
 * bucle de contexto de pueblo comprueba, TRAS el townTurn y ANTES del refuge
 * (0x1436), `g_location==0x12 && party_conscious_state>=0` (TOWN 0x12ae) y dispara
 * la escena de captura/interrogatorio. La captura confisca SÓLO las llaves
 * (g_keys=0, BLCKTHRN 0x08f6) y deposita al party en (10,7) de loc 0x12. El
 * interrogatorio es una máquina de prompts en cadena (patrón Words of Power):
 * `submitInterrogationResponse` consume una respuesta por ronda. Textos
 * byte-exactos de MISCMSG.DAT (records cargados en runtime a DS 0xB21E; ver
 * re/notes/blackthorn.md §3). Determinista, 0 RNG. Captura y refuge son
 * MUTUAMENTE EXCLUSIVOS (0x39fc: >=0 vs ==-1).
 */
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { describeSiViaja } from "./assets-opcionales.js";
import type {
  CharacterState,
  ExtractedInitialState,
  GameState,
} from "../src/core/state.js";
import { Game, type GameData } from "../src/core/game.js";
import type { SmallMapLocation, WorldData } from "../src/core/world/map.js";
import type { NpcManager, NpcRuntime } from "../src/core/npc/manager.js";
import { LOC_BLACKTHORN, PALACE_GUARD_TYPE } from "../src/core/world/blackthorn.js";
import { scheduleIndex } from "../src/core/time.js";
import { describeConAssets } from "./assets-opcionales.js";
import { conDsStrings, dsRecordDeAsset, DS_STRINGS } from "./ds-strings-fixture.js";

function makeChar(over: Partial<CharacterState> = {}): CharacterState {
  return {
    name: "Test",
    gender: 0x0b,
    class: "A",
    status: "G",
    strength: 20,
    dexterity: 20,
    intelligence: 20,
    currentMp: 10,
    currentHp: 50,
    maxHp: 60,
    exp: 0,
    level: 2,
    monthsAtInn: 0,
    helmet: 0xff,
    armor: 0xff,
    weapon: 0xff,
    shield: 0xff,
    ring: 0xff,
    amulet: 0xff,
    partyStatus: 0,
    ...over,
  };
}

const dead = (name = "Test"): CharacterState =>
  makeChar({ name, status: "D", currentHp: 0 });

const BT = LOC_BLACKTHORN; // 0x12 = 18

function makeState(over: Partial<GameState> = {}): GameState {
  const base: Partial<GameState> = {
    characters: [makeChar({ name: "Avatar" }), makeChar({ name: "Iolo" })],
    partySize: 2,
    activeCharacter: 0,
    food: 100,
    gold: 100,
    keys: 5,
    gems: 3,
    torches: 2,
    equipmentQuantities: Array.from({ length: 48 }, (_, i) => (i === 1 ? 4 : 0)),
    karma: 40,
    time: { year: 139, month: 4, day: 7, hour: 8, minute: 35 },
    turnsSinceStart: 0,
    position: { location: BT, floor: 0, x: 5, y: 5 },
    transport: "foot",
    torchTurns: 3,
    prevHour: 8,
    shrineDestroyed: undefined,
  };
  return { ...base, ...over } as GameState;
}

function makeLocation(id: number, name: string): SmallMapLocation {
  const tiles = Array.from({ length: 32 }, () => Array.from({ length: 32 }, () => 5));
  // z=-1 incluido: el depósito de la captura aterriza en el SÓTANO (g_floor=0xff
  // = z=-1, BLCKTHRN 0x08e7) — como el Palacio real (smallmaps.json loc 18:
  // floors [-1,0,1,2,3]).
  return { id, name, floors: [{ z: -1, tiles }, { z: 0, tiles }, { z: 1, tiles }, { z: 2, tiles }] };
}

function makeWorld(): WorldData {
  const overworld = Array.from({ length: 256 }, () =>
    Array.from({ length: 256 }, () => 5),
  );
  return {
    overworld,
    underworld: overworld,
    smallMaps: new Map([
      [BT, makeLocation(BT, "Palace of Blackthorn")],
      [13, makeLocation(13, "Iolo's Hut")],
    ]),
  };
}

const gameData: GameData = {
  locationsX: Array.from({ length: 32 }, () => 100),
  locationsY: Array.from({ length: 32 }, () => 100),
  locationNames: Array.from({ length: 32 }, (_, i) => `Loc${i + 1}`),
  shrines: {
    virtues: ["Honesty", "Compassion", "Valour", "Justice", "Sacrifice", "Honor", "Spirituality", "Humility"],
    mantras: ["Ahm", "Mu", "Ra", "Beh", "Cah", "Summ", "Om", "Lum"],
    shrineX: Array.from({ length: 8 }, () => 0),
    shrineY: Array.from({ length: 8 }, () => 0),
  },
};

/**
 * NPC manager mínimo: coloca UN guardia del Palacio (type 0x70) ORTOGONALMENTE
 * adyacente al party en su misma planta dentro de loc 0x12. Con el trigger real de
 * F1.7-T5 (ataque de guardia por adyacencia manhattan==1, npc_engine 0x13a7) la
 * captura sólo dispara con un guardia pegado — este stub reproduce ese enganche sin
 * cargar los .NPC. Fuera de Blackthorn (p.ej. loc 13) `npcsAt` devuelve vacío.
 */
function guardManager(s: GameState): NpcManager {
  const guard = {
    slot: 8,
    type: PALACE_GUARD_TYPE,
    dialogNumber: 0xff,
    x: s.position.x + 1, // adyacente al este
    y: s.position.y,
    z: s.position.floor,
    // #64: horario EXPLICITO. `[4,4,4]` con `times` a 0 => `scheduleIndex` da
    // ranura 0 a cualquier hora => aiType 4 = ARMADO siempre. Estos tests estudian
    // la GEOMETRIA (adyacencia) y el cableado, no el horario: el horario tiene sus
    // propios tests al final del fichero.
    aiTypes: [4, 4, 4], times: [0, 0, 0, 0],
  } as unknown as NpcRuntime;
  return {
    setRng() {},
    enterMap() {},
    tick() {},
    npcsAt: (loc: number, floor: number) =>
      loc === BT && floor === guard.z ? [guard] : [],
    npcAt: (loc: number, floor: number, x: number, y: number) =>
      loc === BT && floor === guard.z && x === guard.x && y === guard.y ? guard : null,
  } as unknown as NpcManager;
}

function makeGame(s: GameState = makeState()): Game {
  return new Game({} as ExtractedInitialState, makeWorld(), gameData, s, {
    npcManager: guardManager(s),
  });
}

const promptOf = (events: { kind: string; text?: string }[]): string | undefined =>
  events.find((e) => e.kind === "blackthorn-interrogation-prompt")?.text;

const messages = (events: { kind: string; text?: string }[]): string[] =>
  events.filter((e) => e.kind === "message").map((e) => e.text ?? "");

describeConAssets([DS_STRINGS], "F1.7-T2 — Blackthorn captura viva (BLCKTHRN 0x060e / TOWN 0x12ae)", () => {
  conDsStrings();
  it("dispara en loc 0x12 con party vivo: emite el prompt del interrogatorio con la virtud", () => {
    const game = makeGame();
    const events = game.confirmTownExit(false); // TOWN 0x15D4: un townTurn

    const q = promptOf(events);
    expect(q).toBeDefined();
    // print_question variante 0 (MISCMSG rec0 + virtud DATA.OVL 0x1f4e + "?\"").
    expect(q).toContain("What is the Mantra of the Mystic Shrine of Honesty");
    // La escena PAUSA antes del depósito: llaves aún no confiscadas.
    expect(game.state.keys).toBe(5);
    expect(game.state.position.x).toBe(5); // sin depositar todavía
  });

  it("confiscación EXACTA: sólo las llaves (g_keys=0); oro/equipo/gemas intactos", () => {
    const game = makeGame(makeState({ characters: [makeChar({ name: "Avatar" })], partySize: 1 }));
    game.confirmTownExit(false); // arranca la captura
    game.submitInterrogationResponse("nonsense"); // Avatar solo + fallo → dungeon

    expect(game.state.keys).toBe(0); // BLCKTHRN 0x08f6: g_keys=0
    expect(game.state.gold).toBe(100); // intacto
    expect(game.state.gems).toBe(3); // intacto
    expect(game.state.equipmentQuantities[1]).toBe(4); // inventario intacto
    // Depósito (10,7) en loc 0x12, a pie.
    expect(game.state.position.location).toBe(BT);
    expect(game.state.position.x).toBe(10);
    expect(game.state.position.y).toBe(7);
    expect(game.state.transport).toBe("foot");
  });

  it("interrogatorio party>1 · CEDER el mantra = traición (karma−5, santuario caído, un compañero ejecutado)", () => {
    const game = makeGame(
      makeState({
        characters: [makeChar({ name: "Avatar" }), makeChar({ name: "Iolo" }), makeChar({ name: "Shamino" })],
        partySize: 3,
        karma: 40,
      }),
    );
    const start = game.confirmTownExit(false);
    expect(promptOf(start)).toBeDefined();
    const out = game.submitInterrogationResponse("Ahm"); // mantra de Honesty (shrine 0)

    // Traición: santuario 0 marcado 0xff, karma −5, un compañero ejecutado.
    expect((game.state.shrineDestroyed ?? [])[0]).toBe(0xff);
    expect(game.state.karma).toBe(35);
    expect(game.state.partySize).toBe(2);
    expect(game.state.characters[0]!.name).toBe("Avatar");
    expect(game.state.characters[1]!.name).toBe("Shamino");
    // El ejecutado NO desaparece: queda APARCADO en el slot 15 con partyStatus 0x7f
    // (BLCKTHRN 0x04c2-0x04cf; cierre del carril save-residuos, ex-Task F).
    expect(game.state.characters[15]!.name).toBe("Iolo");
    expect(game.state.characters[15]!.partyStatus).toBe(0x7f);
    // MISCMSG rec5 (merciful death).
    expect(messages(out).some((t) => t.includes("merciful death"))).toBe(true);
  });

  it("interrogatorio Avatar SOLO · CEDER = perdón (rewarded with thy life, sin sacrificio)", () => {
    const game = makeGame(makeState({ characters: [makeChar({ name: "Avatar" })], partySize: 1, karma: 40 }));
    game.confirmTownExit(false);
    const out = game.submitInterrogationResponse("the ahm"); // substring match

    expect((game.state.shrineDestroyed ?? [])[0]).toBe(0xff);
    expect(game.state.karma).toBe(35);
    expect(game.state.partySize).toBe(1); // sin sacrificio
    // MISCMSG rec9.
    expect(messages(out).some((t) => t.includes("rewarded with thy life"))).toBe(true);
  });

  it("interrogatorio Avatar SOLO · fallar = mazmorra (To the dungeon, sin caída de santuario)", () => {
    const game = makeGame(makeState({ characters: [makeChar({ name: "Avatar" })], partySize: 1, karma: 40 }));
    game.confirmTownExit(false);
    const out = game.submitInterrogationResponse("wrong");

    expect((game.state.shrineDestroyed ?? [])[0] ?? 0).toBe(0); // santuario intacto
    expect(game.state.karma).toBe(40); // sin penalización
    // MISCMSG rec10.
    expect(messages(out).some((t) => t.includes("To the dungeon"))).toBe(true);
  });

  it("interrogatorio party>1 · 4 fallos = péndulo (compañero ejecutado; sin caída de santuario)", () => {
    const game = makeGame(
      makeState({
        characters: [makeChar({ name: "Avatar" }), makeChar({ name: "Iolo" }), makeChar({ name: "Shamino" })],
        partySize: 3,
        karma: 40,
      }),
    );
    game.confirmTownExit(false);
    // Ronda 0..2 fallan → devuelven la siguiente pregunta; ronda 3 falla → péndulo.
    const r0 = game.submitInterrogationResponse("no");
    expect(promptOf(r0)).toBeDefined();
    expect(messages(r0).some((t) => t.includes("Make not the mistake"))).toBe(true); // rec7 aviso
    // Aviso DOBLE (BLCKTHRN 0x051c, fix interrogation-sand-threat): rec8 (MISCMSG 0x25f)
    // + nombre del roster slot 1 FIJO (DS 0x55c8 = Iolo) + ' die!" ' (DATA.OVL 0x6fbc).
    expect(
      messages(r0).some((t) =>
        t.includes('"I will ask thee until the sand has fallen. And then will Iolo die!" '),
      ),
    ).toBe(true);
    expect(promptOf(game.submitInterrogationResponse("no"))).toBeDefined();
    expect(promptOf(game.submitInterrogationResponse("no"))).toBeDefined();
    const out = game.submitInterrogationResponse("no");

    expect(promptOf(out)).toBeUndefined(); // terminó
    expect((game.state.shrineDestroyed ?? [])[0] ?? 0).toBe(0); // santuario intacto
    expect(game.state.karma).toBe(40); // negarse NO toca karma
    expect(game.state.partySize).toBe(2); // un compañero ejecutado por el péndulo
    // MISCMSG rec4 + nombre de la víctima (DATA.OVL 0x6f92/0x6f96) + rec6.
    expect(messages(out).some((t) => t.includes("pendulum blade falls"))).toBe(true);
    // La víctima (2º miembro vivo = Iolo) se nombra entre la hoja y la traición.
    expect(messages(out).some((t) => t.includes("Iolo is sliced in half!"))).toBe(true);
    expect(messages(out).some((t) => t.includes("treachery"))).toBe(true);
  });

  it("exclusión mutua: en loc 0x12 con TODO el party muerto dispara REFUGE (no captura)", () => {
    const game = makeGame(
      makeState({ characters: [dead("Avatar"), dead("Iolo")], partySize: 2, karma: 40 }),
    );
    const events = game.confirmTownExit(false);

    expect(promptOf(events)).toBeUndefined(); // NO captura
    // Refuge: emite el GUIÓN de la escena (la piel lo pacea) en vez de mutar en el acto.
    const refuge = events.find((e) => e.kind === "refuge")?.refuge;
    expect(refuge).toBeDefined();
    expect(refuge!.beats.some((b) => b.message === "Thou hast found refuge.")).toBe(true);
    // Al resolverla, despierta en el castillo de Lord British (loc 0x11).
    game.resolveRefuge();
    expect(game.state.position.location).toBe(0x11);
  });

  it("no captura FUERA de Blackthorn: pueblo normal (loc 13) con party vivo → turno sin prompt", () => {
    const game = makeGame(makeState({ position: { location: 13, floor: 0, x: 5, y: 5 } }));
    const events = game.confirmTownExit(false);

    expect(promptOf(events)).toBeUndefined();
    expect(game.state.position.location).toBe(13); // sigue en el pueblo
    expect(game.state.keys).toBe(5); // sin confiscar
  });

  it("8 santuarios caídos: captura SIN interrogatorio (deposita directo, llaves a 0)", () => {
    const game = makeGame(
      makeState({ shrineDestroyed: Array.from({ length: 8 }, () => 0xff) }),
    );
    const events = game.confirmTownExit(false);

    expect(promptOf(events)).toBeUndefined(); // sin interrogatorio (BLCKTHRN 0x0665)
    expect(game.state.keys).toBe(0); // depositado igualmente
    expect(game.state.position.x).toBe(10);
    expect(game.state.position.y).toBe(7);
  });

  it("depósito en el SÓTANO: g_floor=0xff (z=-1) aunque la captura dispare en planta alta", () => {
    // Ex-Clase C CERRADA (24-08): BLCKTHRN 0x08e7 `mov [g_floor],0xff` ES la planta
    // de aterrizaje (0xff = sótano, el valor que deja el `dec [g_floor]` de KLIMB
    // TOWN 0x0566 al bajar de la planta 0; saveNative 0xff ↔ z=-1). Control por
    // tiles del asset: (10,7) sólo es pisable en z=-1 (68, la celda con puerta 187
    // en (10,9)); en z=0 es muro 79 — donde el fix anterior encastraba al party.
    const game = makeGame(
      makeState({
        characters: [makeChar({ name: "Avatar" })],
        partySize: 1,
        position: { location: BT, floor: 2, x: 5, y: 5 },
      }),
    );
    game.confirmTownExit(false);
    game.submitInterrogationResponse("wrong");

    expect(game.state.position.floor).toBe(-1); // g_floor=0xff (BLCKTHRN 0x08e7)
    expect(game.state.position.x).toBe(10); // 0x08f6
    expect(game.state.position.y).toBe(7); // 0x08fb
  });
});

describeConAssets([DS_STRINGS], "F1.7 #23 — monólogo de apertura del interrogatorio (escena del trono, BLCKTHRN 0x060e)", () => {
  conDsStrings();
  // Textos byte-exactos (derivados 2026-07-14): DATA.OVL vía kernel print
  // (fileoff = DS_off + 0x10) + MISCMSG rec11 (DS 0xb54a). Ver el orden de prints
  // 0x0652→0x08ca en re/notes/blackthorn.md §3.1.
  const BLINDFOLD = "\nThou art subdued and blindfolded!"; // 0x6fbc @0x0652
  const DRAG = "\n\nStrong guards drag thee away!"; // 0x6fe0 @0x06b0
  const CHAINED = "\n\nThou hast been chained and manacled!"; // 0x7024 @0x07dc
  const FOOTSTEPS = "\n\nFootsteps!"; // 0x704c @0x07ea
  // 0x705a + nombre(DS 0x55a8) + 0x7074, @0x0883-0x0891
  const greeting = (name: string) =>
    `\n\nBlackthorn says:\n\n"Ah, ${name}!\n'Tis indeed an honour to meet thee at last! `;
  // 0x70a4 + género(0x70c8 "man " / 0x70c0 " lady ") + 0x70ce, @0x089b-0x08bc
  const guardOrder = (word: string) => `\n\nGUARD! Release this good${word}at once!"`;
  // MISCMSG rec11 @0x08ca (DS 0xb54a), byte-exacto (con espacio final)
  // Esperado LEÍDO DEL ASSET por un camino independiente del port (`leeAsset` crudo, no
  // `dsRec`): lo que se comprueba sigue siendo que el monólogo emite ESTE record y no otro.
  const WAIT_MANTRA = (): string => dsRecordDeAsset("MISCMSG.DAT", 11);

  // confirmTownExit(false) YA NO antepone el "No" del prompt de salida: ese eco es
  // PRESENTACIÓN y lo pinta INLINE el reductor de prompts (main.ts messageAppend tras
  // "Dost thou wish to leave? "), no el core. El core emite sólo el monólogo de la
  // captura, así que aquí ya no hay que descartar la 1ª línea.
  const scene = (events: { kind: string; text?: string }[]): string[] =>
    messages(events);

  it("emite la escena del trono COMPLETA en orden, y luego el prompt de la 1ª pregunta", () => {
    const game = makeGame(); // Avatar (0x0b=M) + Iolo
    const events = game.confirmTownExit(false);

    expect(scene(events)).toEqual([
      BLINDFOLD,
      DRAG,
      CHAINED,
      FOOTSTEPS,
      greeting("Avatar"),
      guardOrder("man "),
      WAIT_MANTRA(),
    ]);
    // El prompt de la 1ª pregunta llega DESPUÉS del monólogo (misma tanda de eventos).
    expect(promptOf(events)).toContain("What is the Mantra of the Mystic Shrine of Honesty");
    const idxWait = events.findIndex((e) => e.text === WAIT_MANTRA());
    const idxPrompt = events.findIndex((e) => e.kind === "blackthorn-interrogation-prompt");
    expect(idxWait).toBeGreaterThanOrEqual(0);
    expect(idxPrompt).toBeGreaterThan(idxWait);
  });

  it("saludo con el NOMBRE del Avatar (DS 0x55a8 = g_party_records[0].name)", () => {
    const s = makeState({
      characters: [makeChar({ name: "Shamino" }), makeChar({ name: "Iolo" })],
      partySize: 2,
    });
    const events = makeGame(s).confirmTownExit(false);
    expect(scene(events)).toContain(greeting("Shamino"));
  });

  it('nombre VACÍO → fallback "Avatar" (convención del port, la del panel/eco)', () => {
    // Estado sólo-port «avatar sin bautizar»: el binario no lo puede producir (su
    // creación de personaje exige nombre), así que no hay conducta original que
    // calcar; sin el fallback el saludo salía «"Ah, !» mientras el panel del grupo
    // decía «Avatar» (coreview `m.name || "Avatar"`) — vídeo del usuario, 24-08.
    const s = makeState({
      characters: [makeChar({ name: "" }), makeChar({ name: "Iolo" })],
      partySize: 2,
    });
    const events = makeGame(s).confirmTownExit(false);
    expect(scene(events)).toContain(greeting("Avatar"));
  });

  it("orden a la guardia con el GÉNERO del Avatar: 0x0c=F → ' lady '", () => {
    const s = makeState({
      characters: [makeChar({ name: "Avatar", gender: 0x0c }), makeChar({ name: "Iolo" })],
      partySize: 2,
    });
    const events = makeGame(s).confirmTownExit(false);
    expect(scene(events)).toContain(guardOrder(" lady "));
  });

  it("8 santuarios caídos: SÓLO la venda (0x0652) y depósito — sin trono ni rec11", () => {
    const game = makeGame(
      makeState({ shrineDestroyed: Array.from({ length: 8 }, () => 0xff) }),
    );
    const msgs = scene(game.confirmTownExit(false));
    expect(msgs).toEqual([BLINDFOLD]); // 0x0665 salta a 0x08e7 tras la venda
    expect(msgs).not.toContain(WAIT_MANTRA());
  });
});

describeConAssets([DS_STRINGS], "F1.7-T5 — trigger real: captura SÓLO con guardia adyacente (npc_engine 0x13a7)", () => {
  conDsStrings();
  /** Game con un guardia del Palacio a distancia Manhattan `d` del party (eje este). */
  function gameWithGuardAt(d: number, over: Partial<GameState> = {}): Game {
    const s = makeState(over);
    const guard = {
      slot: 8,
      type: PALACE_GUARD_TYPE,
      dialogNumber: 0xff,
      x: s.position.x + d,
      y: s.position.y,
      z: s.position.floor,
      // #64: horario EXPLICITO. `[4,4,4]` con `times` a 0 => `scheduleIndex` da
      // ranura 0 a cualquier hora => aiType 4 = ARMADO siempre. Estos tests estudian
      // la GEOMETRIA (adyacencia) y el cableado, no el horario: el horario tiene sus
      // propios tests al final del fichero.
      aiTypes: [4, 4, 4], times: [0, 0, 0, 0],
    } as unknown as NpcRuntime;
    const mgr = {
      setRng() {},
      enterMap() {},
      tick() {},
      npcsAt: (loc: number, floor: number) =>
        loc === BT && floor === guard.z ? [guard] : [],
      npcAt: (loc: number, floor: number, x: number, y: number) =>
        loc === BT && floor === guard.z && x === guard.x && y === guard.y ? guard : null,
    } as unknown as NpcManager;
    return new Game({} as ExtractedInitialState, makeWorld(), gameData, s, {
      npcManager: mgr,
    });
  }

  it("en el Palacio con el party vivo pero SIN guardia adyacente → NO captura (ya no es per-turno)", () => {
    const game = gameWithGuardAt(3, { characters: [makeChar({ name: "Avatar" })], partySize: 1 });
    const events = game.confirmTownExit(false); // un townTurn completo

    expect(promptOf(events)).toBeUndefined(); // sin escena de captura
    expect(game.state.keys).toBe(5); // sin confiscar
    expect(game.state.position.x).toBe(5); // sin depositar
  });

  it("guardia adyacente (manhattan==1) → captura", () => {
    const game = gameWithGuardAt(1, { characters: [makeChar({ name: "Avatar" })], partySize: 1 });
    expect(promptOf(game.confirmTownExit(false))).toBeDefined();
  });

  it("guardia en diagonal (manhattan==2) → NO captura (el fast-path exige ==1)", () => {
    const s = makeState({ characters: [makeChar({ name: "Avatar" })], partySize: 1 });
    const guard = {
      slot: 8, type: PALACE_GUARD_TYPE, dialogNumber: 0xff,
      x: s.position.x + 1, y: s.position.y + 1, z: s.position.floor,
      aiTypes: [4, 4, 4], times: [0, 0, 0, 0], // #64: armado a cualquier hora
    } as unknown as NpcRuntime;
    const mgr = {
      setRng() {}, enterMap() {}, tick() {},
      npcsAt: (loc: number, floor: number) => (loc === BT && floor === guard.z ? [guard] : []),
      npcAt: () => null,
    } as unknown as NpcManager;
    const game = new Game({} as ExtractedInitialState, makeWorld(), gameData, s, { npcManager: mgr });
    expect(promptOf(game.confirmTownExit(false))).toBeUndefined();
  });

  it("T-B — el pase permanente se RETIRÓ: un flag heredado ya no evita la captura", () => {
    // Era `blackthornPassGranted`, modelo del clon. El binario no escribe pase
    // alguno (TALK 0x01e2 sólo toca `g_gold`), así que un save viejo que lo traiga
    // no debe suprimir nada. Ver re/notes/tc-result-producer.md §3 y §7.
    const over = { characters: [makeChar({ name: "Avatar" })], partySize: 1 };
    (over as Record<string, unknown>).blackthornPassGranted = true;
    const game = gameWithGuardAt(1, over);
    const events = game.confirmTownExit(false);
    expect(promptOf(events)).toBeDefined();
  });
});

/**
 * #64 — LA CAPTURA DEL PALACIO ES HORARIA.
 *
 * Derivación completa en re/notes/horaria-64-adjudicacion.md. El resumen que estos
 * tests sellan: la ranura de horario con la que se lee el `aiType` del guardia sale
 * de `NPC.OVL 0x12e0,`, un selector `argmin((hora - times[k]) & 0xff)` con remapeo
 * 3→1, alimentado con `g_hour` desde `TOWN.OVL 1668,`. El gate `NPC.OVL 0x072c,`
 * (`cmp word ptr [bp - 2], 3` / `jle`) exige `aiType > 3` para armar `[0x65bf]`, y
 * los ocho guardias del Palacio valen `aiType 0` en su ranura 0.
 *
 * ⚠ La tabla de horas NO se escribe a mano aquí: se DERIVA con el mismo selector
 * que corre el port (`scheduleIndex`), para que el test no pueda quedarse pegado a
 * una lista copiada mientras la mecánica cambia debajo. Lo que el test fija es la
 * REGLA (`aiTypes[ranura] > 3` ⇒ captura), no sus 24 respuestas.
 */
describeConAssets([DS_STRINGS], "#64 — captura HORARIA del Palacio (selector de ranura NPC.OVL 0x12e0,)", () => {
  conDsStrings();
  /** Horario REAL de los guardias 8/9/15 del Palacio (game/assets/npcs.json "18"). */
  const PRE_ARRESTO = { aiTypes: [0, 4, 0], times: [21, 5, 11, 13] };
  /** Tras la alarma de arresto (`0x085e,`): hostilidad permanente, sin horario. */
  const POST_ARRESTO = { aiTypes: [7, 7, 7], times: [0, 0, 0, 0] };

  function gameAtHour(hour: number, sched: { aiTypes: number[]; times: number[] }): Game {
    const s = makeState({
      characters: [makeChar({ name: "Avatar" })],
      partySize: 1,
      time: { year: 139, month: 4, day: 7, hour, minute: 0 },
      prevHour: hour,
    });
    const guard = {
      slot: 8,
      type: PALACE_GUARD_TYPE,
      dialogNumber: 0xff,
      x: s.position.x + 1, // adyacente al este (manhattan 1)
      y: s.position.y,
      z: s.position.floor,
      aiTypes: sched.aiTypes,
      times: sched.times,
    } as unknown as NpcRuntime;
    const mgr = {
      setRng() {}, enterMap() {}, tick() {},
      npcsAt: (loc: number, floor: number) => (loc === BT && floor === guard.z ? [guard] : []),
      npcAt: (loc: number, floor: number, x: number, y: number) =>
        loc === BT && floor === guard.z && x === guard.x && y === guard.y ? guard : null,
    } as unknown as NpcManager;
    return new Game({} as ExtractedInitialState, makeWorld(), gameData, s, { npcManager: mgr });
  }

  const capturaA = (hour: number, sched: { aiTypes: number[]; times: number[] }): boolean =>
    promptOf(gameAtHour(hour, sched).confirmTownExit(false)) !== undefined;

  /** La regla del binario, sin la lista de horas: `aiTypes[ranura(hora)] > 3`. */
  const armaSegunElBinario = (hour: number, s: { aiTypes: number[]; times: number[] }): boolean =>
    s.aiTypes[scheduleIndex(s.times, hour)]! > 3;

  it("(a)+(b) las 24 horas siguen la ranura del horario, no un «siempre»", () => {
    for (let hour = 0; hour < 24; hour++) {
      expect(capturaA(hour, PRE_ARRESTO), `hora ${hour}`).toBe(
        armaSegunElBinario(hour, PRE_ARRESTO),
      );
    }
  });

  it("(a) NINGUNA captura entre las 21:00 y las 04:59 — la ranura 0 vale aiType 0", () => {
    for (const hour of [21, 22, 23, 0, 1, 2, 3, 4]) {
      expect(capturaA(hour, PRE_ARRESTO), `hora ${hour}`).toBe(false);
    }
  });

  it("(b) SÍ captura en la franja armada (5-10 y 13-20), donde la ranura vale aiType 4", () => {
    for (const hour of [5, 8, 10, 13, 17, 20]) {
      expect(capturaA(hour, PRE_ARRESTO), `hora ${hour}`).toBe(true);
    }
  });

  it("(b-control) el MEDIODÍA (11-12) cae en la ranura 2, que también es aiType 0 ⇒ NO captura", () => {
    // Control que separa «horario» de «es de noche»: 11 y 12 son de día y NO capturan
    // porque la ranura 2 de estos guardias vale 0. Sin él, el test (a) pasaría con una
    // implementación que sólo mirase si es de noche.
    for (const hour of [11, 12]) {
      expect(capturaA(hour, PRE_ARRESTO), `hora ${hour}`).toBe(false);
    }
  });

  it("(c) POST-ARRESTO: con aiTypes [7,7,7] y times [0,0,0,0] captura a CUALQUIER hora", () => {
    // times todo a 0 ⇒ las cuatro restas empatan ⇒ `jbe` se cumple siempre ⇒ ranura 0
    // ⇒ aiType 7 > 3, y el 7 arma SIN el gate de diálogo (`0x073a,` `jmp 0x7be`).
    for (let hour = 0; hour < 24; hour++) {
      expect(capturaA(hour, POST_ARRESTO), `hora ${hour}`).toBe(true);
    }
  });
});

describeConAssets([DS_STRINGS], "#288 — advance_clock(2) de la escalada del interrogatorio (BLCKTHRN 0x05aa-0x05b4)", () => {
  conDsStrings();
  // Derivación asm (re/notes/blackthorn.md §3.2 + disasm careado): en `interrogate`
  // 0x054a, la rama del fallo (0x056e je 0x59e) con numLiving>=2 (0x059e) y warned!=0
  // (0x05aa) ejecuta `0x05b0 push 2 ; 0x05b4 call 0xffffacec` = advance_clock(2)
  // (kernel 0x4F7C: 0xacec + 0xa290 = 0x14f7c & 0xffff). ÚNICO call-site de
  // advance_clock en la secuencia de captura (0x060e/0x054a); el otro del overlay
  // (0x0c2e) es del refuge. El primer fallo sólo arma warned (0x05f4) — sin reloj.
  // Esperados EN CRUDO: partida a las 8:35; el townTurn del arranque (TOWN 0x15d4,
  // advance_clock(1)) deja 8:36 y cada ronda fallada 1..3 suma 2 min.

  const party3 = () =>
    makeState({
      characters: [makeChar({ name: "Avatar" }), makeChar({ name: "Iolo" }), makeChar({ name: "Shamino" })],
      partySize: 3,
      karma: 40,
      torchTurns: 60,
    });

  it("péndulo (4 fallos): 3 × advance_clock(2) → 8:42, y la antorcha consumió los minutos", () => {
    const game = makeGame(party3());
    game.confirmTownExit(false); // townTurn 1 min → 8:36
    game.submitInterrogationResponse("no"); // ronda 0: aviso, SIN reloj (0x05f4)
    game.submitInterrogationResponse("no"); // ronda 1: +2 (0x05b4)
    game.submitInterrogationResponse("no"); // ronda 2: +2
    game.submitInterrogationResponse("no"); // ronda 3: +2, y el péndulo cae

    expect(game.state.time.hour).toBe(8);
    expect(game.state.time.minute).toBe(42); // 35 + 1 (town) + 6 (3 rondas)
    // Antorcha en MINUTOS (advance_clock 0x4FB4): 60 − 1 − 6 = 53.
    expect(game.state.torchTurns).toBe(53);
  });

  it("primer fallo (warned=0): SOLO avisa, el reloj NO se mueve (0x05aa je 0x5f4)", () => {
    const game = makeGame(party3());
    game.confirmTownExit(false); // → 8:36
    game.submitInterrogationResponse("no"); // ronda 0

    expect(game.state.time.hour).toBe(8);
    expect(game.state.time.minute).toBe(36);
  });

  it("traición en ronda 2 (fallo·fallo·acierto): SOLO la ronda 1 fallada suma → 8:38", () => {
    const game = makeGame(party3());
    game.confirmTownExit(false); // → 8:36
    game.submitInterrogationResponse("no"); // ronda 0: aviso
    game.submitInterrogationResponse("no"); // ronda 1: +2
    game.submitInterrogationResponse("Ahm"); // ronda 2: MATCH — 0x056c or ax,ax NO pasa por 0x59e

    expect(game.state.time.hour).toBe(8);
    expect(game.state.time.minute).toBe(38);
  });

  it("Avatar solo fallando (mazmorra): sin reloj — 0x059e cmp [bp+4],2 corta antes", () => {
    const game = makeGame(
      makeState({ characters: [makeChar({ name: "Avatar" })], partySize: 1, torchTurns: 60 }),
    );
    game.confirmTownExit(false); // → 8:36
    game.submitInterrogationResponse("no"); // dungeon, termina

    expect(game.state.time.hour).toBe(8);
    expect(game.state.time.minute).toBe(36);
  });

  it("cruce de hora: captura a las 8:58 → la ronda 1 fallada deja 9:01 (rollover 0x4FC8)", () => {
    const game = makeGame(
      makeState({
        characters: [makeChar({ name: "Avatar" }), makeChar({ name: "Iolo" })],
        partySize: 2,
        time: { year: 139, month: 4, day: 7, hour: 8, minute: 58 },
        prevHour: 8,
        torchTurns: 60,
      }),
    );
    game.confirmTownExit(false); // → 8:59
    game.submitInterrogationResponse("no"); // ronda 0: aviso
    game.submitInterrogationResponse("no"); // ronda 1: +2 → 9:01

    expect(game.state.time.hour).toBe(9); // el pestillo horario de #108 ve la hora NUEVA
    expect(game.state.time.minute).toBe(1);
    // Snapshot del flanco (0x4FA0): la última llamada partió de la hora 8.
    expect(game.state.prevHour).toBe(8);
  });
});

describeSiViaja(["game/assets/maps/smallmaps.json"], "depósito (10,7) contra el MAPA REAL del Palacio (asset extraído, loc 18)", () => {
  // Testigo que instancia la diferencia DONDE EXISTE: la celda del depósito sólo es
  // pisable en el sótano. Esperados EN CRUDO del asset (leídos a mano el 24-08):
  //   z=-1 → (10,7)=68 (suelo de la celda), (10,9)=187 (su puerta-rastrillo)
  //   z= 0 → (10,7)=79 (MURO — donde el floor=0 del fix anterior encastraba al party,
  //          con el rastrillo 184 en (11,7): la geometría exacta del vídeo del usuario)
  //   z= 1 → 79 · z=2 → 79 · z=3 → 81 (muros todos)
  // Si el asset no está en un árbol PRIVADO (worktree sin symlink game/assets) esto
  // revienta ruidoso: preferible a un skip silencioso. `describeSiViaja` conserva esa
  // propiedad y añade la otra mitad — en el árbol PÚBLICO, donde game/assets NO PUEDE
  // estar, el bloque se SALTA con motivo visible en vez de enrojecer el CI. Los otros
  // 29 tests de este fichero no leen assets y siguen en `test:pure`.
  it("(10,7) sólo es pisable en z=-1; en el resto de plantas es muro", () => {
    const ASSETS = resolve(dirname(fileURLToPath(import.meta.url)), "../assets");
    const maps = JSON.parse(
      readFileSync(`${ASSETS}/maps/smallmaps.json`, "utf-8"),
    ) as SmallMapLocation[];
    const pal = maps.find((l) => l.id === LOC_BLACKTHORN)!;
    expect(pal.floors.map((f) => f.z)).toEqual([-1, 0, 1, 2, 3]);
    const at = (z: number, x: number, y: number): number =>
      pal.floors.find((f) => f.z === z)!.tiles[y]![x]!;
    expect(at(-1, 10, 7)).toBe(68); // celda: suelo
    expect(at(-1, 10, 9)).toBe(187); // su puerta (rastrillo)
    expect(at(0, 10, 7)).toBe(79); // planta 0: MURO (el bug del vídeo)
    expect(at(0, 11, 7)).toBe(184); // el rastrillo al este del muro (frame-42)
    expect(at(1, 10, 7)).toBe(79);
    expect(at(2, 10, 7)).toBe(79);
    expect(at(3, 10, 7)).toBe(81);
  });
});
