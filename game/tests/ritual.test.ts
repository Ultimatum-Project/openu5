/**
 * F1.10-T5 · EL RITUAL DE LOS SHADOWLORDS — convocatoria (Yell) + destrucción
 * (Use Shard). Derivado byte a byte de CMDS.OVL 0x1030 (summon) y CAST.OVL 0x15b4
 * (ritual); tablas/strings de DATA.OVL. Ver re/notes/shadowlord-ritual.md.
 *
 * Tests failing-first del MOTOR PURO (quest/ritual.ts) + el cableado en Game
 * (yell/yellWord/useShard). SIN RNG en ninguno de los dos flujos (declarado).
 */
import { describe, it, expect } from "vitest";
import {
  matchYellName,
  summonShadowlord,
  castShardIntoFlame,
  SHADOWLORD_TILE,
  FLAME_X,
  FLAME_Y,
  FLAME_LOCATION,
  FLAME_FLOOR,
} from "../src/core/quest/ritual.js";
import {
  Game,
  type GameData,
} from "../src/core/game.js";
import type { CharacterState, ExtractedInitialState, GameState } from "../src/core/state.js";
import type { SmallMapLocation, WorldData } from "../src/core/world/map.js";
import { shadowlordDeadFlag } from "../src/core/quest/shadowlords.js";

// idx canónico: 0=falsehood, 1=hatred, 2=cowardice
const IDX = { falsehood: 0, hatred: 1, cowardice: 2 } as const;

// ---------------------------------------------------------------------------
// Motor puro — convocatoria (CMDS 0x1030)
// ---------------------------------------------------------------------------

describe("matchYellName (CMDS 0x105a, substring-toupper)", () => {
  it("empareja los tres nombres, insensible a mayúsculas", () => {
    expect(matchYellName("FAULINEI")).toBe(0);
    expect(matchYellName("astaroth")).toBe(1);
    expect(matchYellName("Nosfentor")).toBe(2);
  });
  it("acepta la palabra que CONTIENE el nombre (substring, patrón mantra)", () => {
    expect(matchYellName("faulinei ")).toBe(0);
  });
  it("palabra sin nombre → -1", () => {
    expect(matchYellName("HOIST")).toBe(-1);
    expect(matchYellName("")).toBe(-1);
  });
});

describe("summonShadowlord (CMDS 0x1030) — gates en orden del binario", () => {
  const alive = [true, true, true];
  it("convoca al Shadowlord del nombre y lo coloca en y-2", () => {
    const r = summonShadowlord({ word: "ASTAROTH", partyY: 3, alive, shadowlordPresent: false });
    expect(r).toEqual({ ok: true, idx: 1, spawnDy: 2 });
  });
  it("palabra que no empareja → No effect", () => {
    const r = summonShadowlord({ word: "FURL", partyY: 9, alive, shadowlordPresent: false });
    expect(r.ok).toBe(false);
    expect(r.message).toBe("\nNo effect!\n");
  });
  it("party_y < 2 → No effect (0x106f; el SL cae en y-2)", () => {
    const r = summonShadowlord({ word: "FAULINEI", partyY: 1, alive, shadowlordPresent: false });
    expect(r.ok).toBe(false);
  });
  it("Shadowlord ya destruido → No effect (0x1076: locs==0xff)", () => {
    const r = summonShadowlord({
      word: "FAULINEI",
      partyY: 9,
      alive: [false, true, true],
      shadowlordPresent: false,
    });
    expect(r.ok).toBe(false);
  });
  it("ya hay un Shadowlord presente (tile 0xFC) → No effect (0x109b)", () => {
    const r = summonShadowlord({ word: "FAULINEI", partyY: 9, alive, shadowlordPresent: true });
    expect(r.ok).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Motor puro — ritual (CAST 0x15b4)
// ---------------------------------------------------------------------------

/** Entrada "en la Llama correcta con el SL adyacente" para el shard idx dado. */
function atFlameWithSl(idx: number) {
  return {
    shardIdx: idx,
    partyX: FLAME_X[idx]!,
    partyY: FLAME_Y[idx]!,
    location: FLAME_LOCATION[idx]!,
    floor: FLAME_FLOOR[idx]!,
    tileAbove: SHADOWLORD_TILE,
    summonedIdx: idx,
  };
}

describe("castShardIntoFlame (CAST 0x15b4) — emparejamiento y strings byte-exactos", () => {
  it("Falsehood → Flame of Truth → Faulinei (destruye)", () => {
    const r = castShardIntoFlame(atFlameWithSl(IDX.falsehood));
    expect(r.destroyed).toBe(true);
    expect(r.doomBit).toBe(0x02);
    expect(r.lines.join("")).toBe(
      "Gem Shard\n\nThou dost hold above thee the evil Shard of Falsehood..." +
        "\n\n...and cast it into the Flame of Truth!\n" +
        "\nThe doom of the Shadowlord Faulinei is wrought!\n",
    );
  });
  it("Hatred → Flame of Love → Astaroth (destruye; nombres NO intercambiados)", () => {
    const r = castShardIntoFlame(atFlameWithSl(IDX.hatred));
    expect(r.destroyed).toBe(true);
    expect(r.doomBit).toBe(0x04);
    expect(r.lines.join("")).toContain("into the Flame of Love!");
    expect(r.lines.join("")).toContain("the Shadowlord Astaroth is wrought!");
  });
  it("Cowardice → Flame of Courage → Nosfentor (destruye; floor 0xFF literal)", () => {
    const r = castShardIntoFlame(atFlameWithSl(IDX.cowardice));
    expect(r.destroyed).toBe(true);
    expect(r.doomBit).toBe(0x08);
    expect(r.lines.join("")).toContain("into the Flame of Courage!");
    expect(r.lines.join("")).toContain("the Shadowlord Nosfentor is wrought!");
  });
});

describe("castShardIntoFlame — fallos (bug-for-bug)", () => {
  it("Llama equivocada (posición no coincide) → 'No effect!' y NO destruye", () => {
    const inp = { ...atFlameWithSl(IDX.falsehood), location: 0x1f }; // otra sala
    const r = castShardIntoFlame(inp);
    expect(r.destroyed).toBe(false);
    expect(r.lines.join("")).toBe(
      "Gem Shard\n\nThou dost hold above thee the evil Shard of Falsehood...\n\nNo effect!\n",
    );
  });
  it("en la Llama pero SIN Shadowlord adyacente (tile != 0xFC) → imprime 'cast into the Flame' y NADA más", () => {
    const inp = { ...atFlameWithSl(IDX.falsehood), tileAbove: 0x05 };
    const r = castShardIntoFlame(inp);
    expect(r.destroyed).toBe(false);
    expect(r.lines.join("")).toBe(
      "Gem Shard\n\nThou dost hold above thee the evil Shard of Falsehood..." +
        "\n\n...and cast it into the Flame of Truth!\n",
    );
  });
  it("en la Llama, SL presente pero el idx convocado NO coincide → no destruye", () => {
    const inp = { ...atFlameWithSl(IDX.falsehood), summonedIdx: IDX.hatred };
    const r = castShardIntoFlame(inp);
    expect(r.destroyed).toBe(false);
    expect(r.lines.join("")).toContain("cast it into the Flame of Truth!");
    expect(r.lines.join("")).not.toContain("is wrought!");
  });
});

// ---------------------------------------------------------------------------
// Cableado en Game — useShard / yell / yellWord
// ---------------------------------------------------------------------------

function makeChar(over: Partial<CharacterState> = {}): CharacterState {
  return {
    name: "Avatar",
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

function makeState(over: Partial<GameState> = {}): GameState {
  const base: Partial<GameState> = {
    version: 1,
    characters: [makeChar()],
    partySize: 1,
    activeCharacter: 0,
    food: 100,
    gold: 100,
    keys: 0,
    gems: 0,
    torches: 2,
    equipmentQuantities: Array.from({ length: 48 }, () => 0),
    reagentQuantities: Array.from({ length: 8 }, () => 0),
    karma: 40,
    time: { year: 139, month: 4, day: 7, hour: 8, minute: 35 },
    turnsSinceStart: 0,
    position: { location: 30, floor: 2, x: 15, y: 10 },
    transport: "foot",
    torchTurns: 3,
    prevHour: 8,
    shards: { falsehood: true, hatred: true, cowardice: true },
    lbArtifacts: { amulet: false, crown: false, sceptre: false },
    questFlags: {},
    worldObjects: [],
    npcDead: Array.from({ length: 32 }, () => [] as boolean[]),
    npcMet: Array.from({ length: 32 }, () => [] as boolean[]),
  };
  return { ...base, ...over } as GameState;
}

function makeLocation(id: number): SmallMapLocation {
  const tiles = Array.from({ length: 32 }, () => Array.from({ length: 32 }, () => 5));
  return { id, name: `Loc${id}`, floors: [{ z: 0, tiles }, { z: 1, tiles }, { z: 2, tiles }] };
}

function makeWorld(): WorldData {
  const overworld = Array.from({ length: 256 }, () => Array.from({ length: 256 }, () => 5));
  return {
    overworld,
    underworld: overworld,
    smallMaps: new Map([
      [30, makeLocation(30)],
      [31, makeLocation(31)],
      [32, makeLocation(32)],
    ]),
  };
}

const gameData: GameData = {
  locationsX: Array.from({ length: 32 }, () => 100),
  locationsY: Array.from({ length: 32 }, () => 100),
  locationNames: Array.from({ length: 32 }, (_, i) => `Loc${i + 1}`),
};

function makeGame(s: GameState): Game {
  return new Game({} as ExtractedInitialState, makeWorld(), gameData, s);
}

function messages(events: { kind: string; text?: string }[]): string {
  return events
    .filter((e) => e.kind === "message")
    .map((e) => e.text ?? "")
    .join("");
}

describe("Game.yell() — dispatcher (CMDS 0x1418)", () => {
  it("a pie → emite yell-word-prompt (no toca las velas)", () => {
    const game = makeGame(makeState());
    const ev = game.yell();
    expect(ev).toEqual([{ kind: "yell-word-prompt" }]);
  });
});

describe("Game.yellWord — convocatoria en la sala de la Llama", () => {
  it("gritar FAULINEI en la Llama de la Verdad coloca el Shadowlord en y-2", () => {
    const game = makeGame(makeState({ position: { location: 30, floor: 2, x: 15, y: 10 } }));
    game.reseed(1);
    game.yellWord("FAULINEI");
    expect(game.state.shadowlordSummoned).toBe(0);
    const sl = (game.state.worldObjects ?? []).find((o) => o.kind === "shadowlord");
    expect(sl).toMatchObject({ location: 30, floor: 2, x: 15, y: 8, tile: SHADOWLORD_TILE });
  });
  it("fuera de una sala de Llama → 'No effect!' y NO convoca", () => {
    const game = makeGame(makeState({ position: { location: 6, floor: 0, x: 5, y: 5 } }));
    const ev = game.yellWord("FAULINEI");
    expect(messages(ev)).toBe("\nNo effect!\n");
    expect(game.state.shadowlordSummoned).toBeUndefined();
  });
});

describe("Game.useShard — ritual completo (CAST 0x15b4)", () => {
  it("flujo canónico: Yell bajo la Llama → pisar la Llama → Use Shard destruye", () => {
    // Party una casilla al sur de la Llama de la Verdad (15,9) para que el SL
    // convocado (y-2) caiga justo en (15,8) = una al norte de la Llama.
    const game = makeGame(makeState({ position: { location: 30, floor: 2, x: 15, y: 10 } }));
    game.reseed(1);
    game.yellWord("FAULINEI"); // SL → (15,8)

    // El Avatar pisa la casilla de la Llama (15,9): el SL queda al norte (y-1).
    game.state.position.y = 9;
    const ev = game.useShard("falsehood");

    expect(messages(ev)).toBe(
      "Gem Shard\n\nThou dost hold above thee the evil Shard of Falsehood..." +
        "\n\n...and cast it into the Flame of Truth!\n" +
        "\nThe doom of the Shadowlord Faulinei is wrought!\n",
    );
    // Efectos de destrucción.
    expect(game.state.questFlags[shadowlordDeadFlag("falsehood")]).toBe(true);
    expect(game.state.shards.falsehood).toBe(false); // shard consumido (0x1710)
    expect(game.state.shadowlordDoomBits).toBe(0x02); // doom-bit (0x171d)
    expect(game.state.shadowlordSummoned).toBeUndefined();
    // El objeto del Shadowlord desaparece del mundo.
    expect((game.state.worldObjects ?? []).some((o) => o.kind === "shadowlord")).toBe(false);
  });

  it("en la Llama correcta pero SIN convocar → imprime hasta 'the Flame of' y NO destruye", () => {
    const game = makeGame(makeState({ position: { location: 30, floor: 2, x: 15, y: 9 } }));
    const ev = game.useShard("falsehood");
    expect(messages(ev)).toBe(
      "Gem Shard\n\nThou dost hold above thee the evil Shard of Falsehood..." +
        "\n\n...and cast it into the Flame of Truth!\n",
    );
    expect(game.state.questFlags[shadowlordDeadFlag("falsehood")]).toBeUndefined();
    expect(game.state.shards.falsehood).toBe(true); // NO se consume en el fallo
  });

  it("en el lugar equivocado → 'No effect!' y el shard NO se consume", () => {
    const game = makeGame(makeState({ position: { location: 6, floor: 0, x: 5, y: 5 } }));
    const ev = game.useShard("falsehood");
    expect(messages(ev)).toContain("No effect!");
    expect(game.state.shards.falsehood).toBe(true);
  });
});
