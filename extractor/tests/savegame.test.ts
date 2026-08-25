import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  parseSaveGame,
  serializeSaveGame,
  SAVED_GAM_SIZE,
  type CharacterRecord,
  type InitialState,
} from "../src/parsers/savegame.js";
import { U5_DIR } from "./helpers.js";

const read = (name: string) => new Uint8Array(readFileSync(`${U5_DIR}/${name}`));

/** Save real del usuario (respaldado; datos EA no versionados). */
const SEED_SAVE = resolve(U5_DIR, "../saves/partida-javier-2026-07-15/SAVED.GAM");

/**
 * Valores reales de la partida nueva canónica (INIT.GAM), verificados contra los
 * bytes originales de MS-DOS Ultima V:
 *   - Party: Avatar (name vacío hasta introducirlo), Shamino, Iolo → partySize 3.
 *   - Posición inicial: location 13 (Iolos_Hut), floor 0, (x,y) = (15,15).
 *   - Karma inicial 75, oro 150, comida 63, llaves 2, antorchas 4.
 *   - Fecha inicial: año 139, mes 4, día 5, 08:35. Personaje activo 0xFF, turnos 0.
 */
describe("parseSaveGame (INIT.GAM = partida nueva)", () => {
  const state = parseSaveGame(read("INIT.GAM"));

  it("characters[0] es el Avatar (class 'A')", () => {
    expect(state.characters[0]!.class).toBe("A");
  });

  it("hay 16 registros de personaje", () => {
    expect(state.characters.length).toBe(16);
  });

  it("Shamino e Iolo están en el party inicial", () => {
    expect(state.characters[1]!.name).toBe("Shamino");
    expect(state.characters[2]!.name).toBe("Iolo");
  });

  it("turnsSinceStart === 0 (partida nueva)", () => {
    expect(state.turnsSinceStart).toBe(0);
  });

  it("partySize >= 1 (es 3: Avatar, Shamino, Iolo)", () => {
    expect(state.partySize).toBeGreaterThanOrEqual(1);
    expect(state.partySize).toBe(3);
  });

  it("posición inicial: Iolos_Hut (13), floor 0, (15,15)", () => {
    expect(state.location).toBe(13);
    expect(state.floor).toBe(0);
    expect(state.x).toBe(15);
    expect(state.y).toBe(15);
  });

  it("karma inicial 75", () => {
    expect(state.karma).toBe(75);
  });

  it("oro 150, comida 63", () => {
    expect(state.gold).toBe(150);
    expect(state.food).toBe(63);
  });

  it("fecha inicial: año 139, mes 4, día 5, 08:35", () => {
    expect(state.year).toBe(139);
    expect(state.month).toBe(4);
    expect(state.day).toBe(5);
    expect(state.hour).toBe(8);
    expect(state.minute).toBe(35);
  });

  it("cantidades de equipo/hechizos/scrolls/pociones/reagentes con longitud correcta", () => {
    expect(state.equipmentQuantities.length).toBe(48);
    expect(state.spellQuantities.length).toBe(48);
    expect(state.scrollQuantities.length).toBe(8);
    expect(state.potionQuantities.length).toBe(8);
    expect(state.reagentQuantities.length).toBe(8);
  });

  it("8 moonstones enterradas en Britannia (z=0, buried)", () => {
    expect(state.moonstones.length).toBe(8);
    for (const m of state.moonstones) {
      expect(m.buried).toBe(true);
      expect(m.z).toBe(0);
    }
  });

  it("npcDead y npcMet tienen dimensiones 32 × 32", () => {
    expect(state.npcDead.length).toBe(32);
    expect(state.npcMet.length).toBe(32);
    for (const row of state.npcDead) expect(row.length).toBe(32);
    for (const row of state.npcMet) expect(row.length).toBe(32);
  });
});

/**
 * Bloque 1 de la task #27 — serializer core→SAVED.GAM byte-válido, INVERSO exacto de
 * parseSaveGame. Estrategia "template + patch" (preserva bytes oscuros).
 */
describe("serializeSaveGame (inverso de parseSaveGame)", () => {
  const initBytes = read("INIT.GAM");

  it("produce exactamente 4192 bytes (0x1060)", () => {
    const out = serializeSaveGame(parseSaveGame(initBytes), initBytes);
    expect(out.length).toBe(SAVED_GAM_SIZE);
    expect(SAVED_GAM_SIZE).toBe(4192);
  });

  it("round-trip BYTE-EXACTO: serialize(parse(INIT.GAM), INIT.GAM) === INIT.GAM", () => {
    const out = serializeSaveGame(parseSaveGame(initBytes), initBytes);
    // Comparación byte a byte de los 4192 bytes (incluye los bytes oscuros preservados).
    const orig = initBytes.subarray(0, SAVED_GAM_SIZE);
    let firstDiff = -1;
    for (let i = 0; i < SAVED_GAM_SIZE; i++) {
      if (out[i] !== orig[i]) {
        firstDiff = i;
        break;
      }
    }
    expect(firstDiff, `primer byte que difiere: 0x${firstDiff.toString(16)}`).toBe(-1);
  });

  it("round-trip SEMÁNTICO con campos mutados: parse(serialize(mutado)) == mutado", () => {
    const mutated = parseSaveGame(initBytes);
    mutated.gold = 8803;
    mutated.food = 1234;
    mutated.keys = 9;
    mutated.karma = 42;
    mutated.year = 141;
    mutated.month = 12;
    mutated.day = 28;
    mutated.hour = 23;
    mutated.minute = 59;
    mutated.location = 15;
    mutated.floor = 0xff;
    mutated.x = 91;
    mutated.y = 223;
    mutated.turnsSinceStart = 1535;
    mutated.torchTurns = 96;
    mutated.partySize = 4;
    mutated.activeCharacter = 2;
    mutated.characters[0]!.name = "Milovan";
    mutated.characters[0]!.exp = 4321;
    mutated.characters[0]!.currentHp = 250;
    mutated.characters[0]!.weapon = 0x10;
    mutated.characters[1]!.status = "P";
    mutated.grapple = true;
    mutated.magicCarpets = 2;
    mutated.equipmentQuantities[5] = 10;
    mutated.spellQuantities[0] = 7;
    // `location` y `buried` son el MISMO byte 0x29a: en la mochila ⇒ 0xFF, o el estado
    // no es representable en el .GAM y el round-trip no puede cerrar.
    mutated.moonstones[0]!.buried = false;
    mutated.moonstones[0]!.location = 0xff;
    mutated.moonstones[0]!.x = 77;
    mutated.npcDead[3]![5] = true;
    mutated.npcMet[10]![20] = true;

    const roundTripped = parseSaveGame(serializeSaveGame(mutated, initBytes));
    expect(roundTripped).toEqual(mutated);
  });

  it("rechaza una plantilla demasiado corta", () => {
    expect(() => serializeSaveGame(parseSaveGame(initBytes), initBytes.subarray(0, 100)))
      .toThrow(/demasiado corta/);
  });

  // Caso semilla: el save REAL del usuario (partida mid-game con valores no-canónicos:
  // turn 0x2E5=255 saturado, floor, obj0 sincronizado, party de 3). Prueba que el
  // serializer round-trip byte-exacto también sobre datos reales, no solo INIT.GAM.
  const seedIt = existsSync(SEED_SAVE) ? it : it.skip;
  seedIt("round-trip BYTE-EXACTO del save semilla del usuario", () => {
    const seed = new Uint8Array(readFileSync(SEED_SAVE));
    expect(seed.length).toBe(SAVED_GAM_SIZE);
    const out = serializeSaveGame(parseSaveGame(seed), seed);
    let firstDiff = -1;
    for (let i = 0; i < SAVED_GAM_SIZE; i++) {
      if (out[i] !== seed[i]) {
        firstDiff = i;
        break;
      }
    }
    expect(firstDiff, `primer byte que difiere: 0x${firstDiff.toString(16)}`).toBe(-1);
  });
});

/**
 * FIXTURE CANÓNICO ANTI-DRIFT — copia EXACTA de `canonicalInit` en
 * game/tests/save-native.test.ts. El game y el extractor NO pueden importarse en un
 * mismo runner (cross-workspace), así que la equivalencia del codec espejo se fija por
 * el sha256 de este .GAM canónico: el MISMO valor está aseverado en AMBAS suites. Si
 * el codec de un lado deriva (offset/encoding), su sha rompe y hay que reconciliar.
 * ⚠️ Editar este fixture obliga a editar el gemelo del game o el sha divergirá.
 */
function canonicalInit(): InitialState {
  const ch = (over: Partial<CharacterRecord> = {}): CharacterRecord => ({
    name: "", gender: 0x0b, class: "A", status: "G", strength: 0, dexterity: 0,
    intelligence: 0, currentMp: 0, currentHp: 0, maxHp: 0, exp: 0, level: 0,
    monthsAtInn: 0, helmet: 0xff, armor: 0xff, weapon: 0xff, shield: 0xff, ring: 0xff,
    amulet: 0xff, partyStatus: 0, ...over,
  });
  return {
    characters: [
      ch({ name: "Avatar", strength: 20, currentHp: 100, maxHp: 100, exp: 1234, level: 3 }),
      ...Array.from({ length: 15 }, () => ch({ partyStatus: 0xff })),
    ],
    food: 500, gold: 4242, keys: 3, gems: 7, torches: 12, skullKeys: 1, grapple: true,
    magicCarpets: 0,
    specialItems: { spyglass: false, hmsCape: false, sextant: false, blackBadge: false, woodenBox: false },
    shards: { falsehood: false, hatred: false, cowardice: false },
    lbArtifacts: { amulet: false, crown: false, sceptre: false },
    equipmentQuantities: Array.from({ length: 48 }, (_, i) => i % 5),
    spellQuantities: Array.from({ length: 48 }, () => 0),
    scrollQuantities: Array.from({ length: 8 }, () => 0),
    potionQuantities: Array.from({ length: 8 }, () => 0),
    reagentQuantities: Array.from({ length: 8 }, () => 0),
    moonstones: Array.from({ length: 8 }, (_, i) => ({ x: i, y: 0, buried: true, z: 0, location: 0 })),
    partySize: 1, year: 139, month: 4, day: 5, hour: 8, minute: 35, karma: 75,
    turnsSinceStart: 100, activeCharacter: 0xff, location: 13, floor: 0, x: 0, y: 0,
    torchTurns: 40,
    npcDead: Array.from({ length: 32 }, () => Array.from({ length: 32 }, () => false)),
    npcMet: Array.from({ length: 32 }, () => Array.from({ length: 32 }, () => false)),
  };
}

describe("serializeSaveGame — guarda ANTI-DRIFT (espejo game↔extractor)", () => {
  // MISMO valor que CANONICAL_GAM_SHA256 en game/tests/save-native.test.ts.
  const CANONICAL_GAM_SHA256 =
    "e2060824d2bffe071bf87707f1ce9b99657a2587643604cc7bcd4defb3683fc1";

  it("sha256 del .GAM canónico coincide con el fijado en el game", () => {
    const gam = serializeSaveGame(canonicalInit(), new Uint8Array(SAVED_GAM_SIZE));
    const sha = createHash("sha256").update(gam).digest("hex");
    expect(sha).toBe(CANONICAL_GAM_SHA256);
  });
});
