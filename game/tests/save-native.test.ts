/**
 * Task #27 bloque 2 — codec game-side SAVED.GAM nativo + sidecar.
 * Round-trip GameState → export → import → GameState IDÉNTICO (deep-equal completo con
 * un estado POBLADO: todo campo cubierto por el .GAM o por el sidecar).
 */
import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { createNewGame, type CharacterState, type ExtractedInitialState, type GameState } from "../src/core/state.js";
import { canonicalInit } from "./helpers/canonical-init.js";
import { Game } from "../src/core/game.js";
import type { WorldData } from "../src/core/world/map.js";
import {
  exportNativeSave,
  importNativeSave,
  buildNativeOol,
  parseSaveWindow,
  SAVED_GAM_SIZE,
} from "../src/core/saveNative.js";

/**
 * FIXTURE CANÓNICO ANTI-DRIFT — vive en `tests/helpers/canonical-init.ts` desde #240.
 * NO se re-exporta desde aquí a propósito: quien lo importaba DE ESTE FICHERO arrastraba
 * la suite entera de save-native dentro de la suya (80 tests fantasma medidos). El helper
 * lleva el porqué y el régimen anti-drift con el extractor.
 */

/**
 * sha256 del SAVED.GAM canónico (fixture arriba + plantilla en blanco). Este MISMO
 * valor está fijado en extractor/tests/savegame.test.ts: si el codec del game o el del
 * extractor derivan, su sha rompe y hay que reconciliarlos (guarda anti-drift del
 * espejo game↔extractor, que no pueden importarse en un mismo runner).
 */
export const CANONICAL_GAM_SHA256 =
  "e2060824d2bffe071bf87707f1ce9b99657a2587643604cc7bcd4defb3683fc1";

function makeChar(over: Partial<CharacterState> = {}): CharacterState {
  return {
    name: "Avatar", gender: 0x0b, class: "A", status: "G", strength: 20, dexterity: 18,
    intelligence: 22, currentMp: 15, currentHp: 250, maxHp: 300, exp: 4321, level: 6,
    monthsAtInn: 0, helmet: 0x0a, armor: 0x0b, weapon: 0x10, shield: 0x0c, ring: 0xff,
    amulet: 0xff, partyStatus: 0, ...over,
  };
}

/** GameState mid-game POBLADO: todos los campos con valor (sin undefined). */
function makeFullState(): GameState {
  return {
    version: 1,
    characters: [
      makeChar(),
      makeChar({ name: "Shamino", class: "F", status: "P", weapon: 0x12 }),
      makeChar({ name: "Iolo", class: "B", currentHp: 100, maxHp: 120 }),
      ...Array.from({ length: 13 }, (_, i) => makeChar({ name: `Slot${i}`, partyStatus: 0xff, status: "D" })),
    ],
    partySize: 3,
    activeCharacter: 1,
    food: 1234,
    gold: 8803,
    keys: 9,
    gems: 53,
    torches: 96,
    skullKeys: 3,
    grapple: true,
    magicCarpets: 2,
    equipmentQuantities: Array.from({ length: 48 }, (_, i) => i % 7),
    spellQuantities: Array.from({ length: 48 }, (_, i) => (i * 3) % 11),
    scrollQuantities: [1, 2, 3, 4, 5, 6, 7, 8],
    potionQuantities: [8, 7, 6, 5, 4, 3, 2, 1],
    reagentQuantities: [9, 9, 5, 5, 2, 2, 1, 1],
    specialItems: { spyglass: true, hmsCape: true, sextant: false, pocketWatch: false, blackBadge: true, woodenBox: false },
    shards: { falsehood: true, hatred: false, cowardice: true },
    lbArtifacts: { amulet: true, crown: false, sceptre: true },
    moonstones: Array.from({ length: 8 }, (_, i) => ({
      // `location` y `buried` son el mismo byte: sin enterrar ⇒ 0xFF, o el round-trip no cierra.
      x: 10 + i, y: 200 + i, buried: i % 2 === 0, z: i < 4 ? 0 : 0xff, location: i % 2 === 0 ? 0 : 0xff,
    })),
    karma: 42,
    time: { year: 141, month: 12, day: 28, hour: 23, minute: 59 },
    turnsSinceStart: 200,
    // #115 — ERA `{ location: 15, floor: 0xff }`, que es un estado IMPOSIBLE: la 15 es un
    // mapa pequeño y no tiene sótano (sólo Yew 4, LB 17, Blackthorn 18 y Serpent's Hold 32
    // traen z = −1 en `maps/smallmaps.json`), así que ninguna partida real pudo tener esa
    // pareja. Con el códec leyendo 0xFF crudo daba igual; en cuanto el lector interpreta el
    // byte con la location, un fixture irreal empieza a afirmar cosas irreales.
    // Ahora es el SÓTANO del castillo de Lord British: alcanzable, el MISMO byte 0xFF en
    // disco, y de paso este round-trip poblado cubre el signo de la planta.
    position: { location: 17, floor: -1, x: 91, y: 223 },
    transport: "ship",
    torchTurns: 96,
    prevHour: 22,
    lightSpellMins: 30,
    timeSpell: "Q",
    timeSpellTurns: 12,
    wind: 3,
    transportTile: 0x24,
    sailDir: 2,
    windDriftCtr: 1,
    shipHull: 47,
    shipSkiffs: 1,
    hmsCapeToggle: 1,
    shrineQuestBitmap: 0b0010_1101,
    shrineVisitedBitmap: 0b1000_0011,
    shrineDestroyed: [0x80, 0, 0, 0x80, 0, 0, 0, 0],
    // 14 bytes: Deceit sala 3 (byte0 bit3 = 0x08) + una sala en otra mazmorra (byte5 = 0x02).
    dungeonRoomsCleared: [0x08, 0, 0, 0, 0, 0x02, 0, 0, 0, 0, 0, 0, 0, 0],
    shadowlordLocs: [7, 12, 20],
    shadowlordSummoned: 1,
    shadowlordDoomBits: 0x02,
    // ⚠ CONSISTENCIA #238: doomBits 0x02 ALIASA npcDead[28][6] (Stonegate loc 29, slot 6 —
    // el `or word [g_npc_dead_bitmap+112]` de CAST 0x171d). El ritual del port escribe los
    // dos juntos desde #238; un fixture con el bit sólo en doomBits sería un estado que el
    // juego ya no produce, y el round-trip deep-equal lo delataría (el import lee el bit
    // por la vía npcDead).
    npcDead: Array.from({ length: 32 }, (_, l) =>
      Array.from({ length: 32 }, (_, n) => (l + n) % 5 === 0 || (l === 28 && n === 6)),
    ),
    npcMet: Array.from({ length: 32 }, (_, l) => Array.from({ length: 32 }, (_, n) => (l * n) % 7 === 0)),
    questFlags: { metLordBritish: true, foundWord: true, shrineHonor: false },
    journal: [
      { turn: 10, location: 0, npc: "Iolo", text: "Onward!" },
      { turn: 42, location: 15, npc: "", text: "A storm brews." },
    ],
    openDoors: [{ location: 8, floor: 0, x: 12, y: 14, tile: 0xb8, turnsLeft: 3 }],
    mapOverrides: { "8:0:12:15": 68, "0:255:91:223": 5 },
    explored: { "0:0": "AAECAwQ=", "15:0": "//8AAA==" },
    treasuryLoot: { "18:0:5:5": 200 },
    skullTreeFoundDay: 17,
    reagentPatchFoundDay: [3, 0, 21], // sellos [0x5858-0x585A] de las 3 parcelas (#91)
    overworldEnemies: [{ defIndex: 41, tile: 0x148, water: false, x: 100, y: 100 }],
    worldObjects: [
      { location: 0, floor: 0, x: 39, y: 151, tile: 0x24, kind: "ship", hull: 50, skiffs: 1 },
      { location: 18, floor: 0, x: 5, y: 5, tile: 0x40, kind: "chest", contents: 0x05, trapped: false },
    ],
  };
}

/** Plantilla sintética de 4192 B (bytes oscuros a 0) → el test corre sin binarios. */
const blankTemplate = (): Uint8Array => new Uint8Array(SAVED_GAM_SIZE);

describe("saveNative — codec SAVED.GAM + sidecar (task #27 B2)", () => {
  it("exporta un .GAM de exactamente 4192 bytes", () => {
    const { gam } = exportNativeSave(makeFullState(), blankTemplate());
    expect(gam.length).toBe(SAVED_GAM_SIZE);
  });

  it("round-trip GameState → export → import → GameState IDÉNTICO (estado poblado)", () => {
    const state = makeFullState();
    const { gam, sidecar } = exportNativeSave(state, blankTemplate());
    // El sidecar viaja como JSON en el save real → simula el ida y vuelta.
    const sidecarJson = JSON.parse(JSON.stringify(sidecar));
    const loaded = importNativeSave(gam, sidecarJson);
    expect(loaded).toEqual(state);
  });

  it("el sidecar separa QoL (journal/explored) de estado-de-juego no-mapeado", () => {
    const { sidecar } = exportNativeSave(makeFullState(), blankTemplate());
    // QoL: no afecta reglas.
    expect(sidecar.qol.journal.length).toBe(2);
    expect(sidecar.qol.explored).toBeDefined();
    // Estado de juego (importa para el espejo del Grand Tour): NO en el .GAM.
    expect(sidecar.gameState.worldObjects?.length).toBe(2);
    expect(sidecar.gameState.overworldEnemies?.length).toBe(1);
    expect(sidecar.gameState.questFlags.metLordBritish).toBe(true);
    expect(sidecar.gameState.shadowlordLocs).toEqual([7, 12, 20]);
    // El journal NO debe aparecer en gameState (categorías disjuntas).
    expect("journal" in sidecar.gameState).toBe(false);
  });

  it("obj0@0x6B6/0x6B7 se sincroniza con la posición (gotcha del motor)", () => {
    const state = makeFullState();
    const { gam } = exportNativeSave(state, blankTemplate());
    expect(gam[0x6b6]).toBe(state.position.x);
    expect(gam[0x6b7]).toBe(state.position.y);
  });

  it("obj0 EN BARCO: tile/floor/hull/skiffs byte a byte (witness O1 HUECO 2)", () => {
    // makeFullState = fragata velas arriadas (transportTile 0x24), hull 47, skiffs 1, floor 0xFF.
    const state = makeFullState();
    // +6 de la plantilla debe PRESERVARSE (estado de mover vivo del avatar): siembra un valor.
    const template = blankTemplate();
    template[0x6ba] = 0x99;
    const { gam } = exportNativeSave(state, template);
    expect(gam[0x6b4]).toBe(0x24); // +0 tile de vehículo (== g_transport_tile 0x2D6)
    expect(gam[0x6b5]).toBe(0x24); // +1 espejo del tile
    expect(gam[0x2d6]).toBe(0x24); // coherente con el campo g_transport_tile
    expect(gam[0x6b6]).toBe(91); // +2 X
    expect(gam[0x6b7]).toBe(223); // +3 Y
    expect(gam[0x6b8]).toBe(0xff); // +4 floor (== byte 0x2EF)
    expect(gam[0x6b9]).toBe(47); // +5 hull (g_hull, sólo fragata)
    expect(gam[0x6ba]).toBe(0x99); // +6 estado de mover: PRESERVADO de la plantilla
    expect(gam[0x6bb]).toBe(1); // +7 skiffs (g_skiffs, sólo fragata)
  });

  it("obj0 A PIE en INTERIOR: tile del avatar, hull/skiffs = 0", () => {
    // 🔴 Este test decía «no hay vehículo ⇒ 0» a secas y esa regla está REFUTADA 15-a-2
    // (#231): a pie en el OVERWORLD el original CONSERVA g_hull/g_skiffs. El 0 de aquí
    // se sostiene por otra vía: en INTERIOR (location 17) el binario memsetea la tabla al
    // entrar (MAINOUT 0x0857) y el residuo medido allí (+7=6) sigue sin derivar — el port
    // escribe 0 declaradamente. El caso overworld-a-pie vive en el describe de #231.
    const state = makeFullState();
    state.transport = "foot";
    state.transportTile = 0x1c; // avatar a pie
    state.position = { location: 17, floor: 0, x: 15, y: 26 };
    const { gam } = exportNativeSave(state, blankTemplate());
    expect(gam[0x6b4]).toBe(0x1c); // +0 tile del avatar a pie
    expect(gam[0x6b5]).toBe(0x1c); // +1
    expect(gam[0x6b9]).toBe(0); // +5 = 0 (interior)
    expect(gam[0x6bb]).toBe(0); // +7 = 0 (interior)
  });

  it("transportTile UNDEFINED: obj0 tile/hull/skiffs NO se tocan (guarda anti-drift del sha)", () => {
    const state = makeFullState();
    state.transportTile = undefined;
    const template = blankTemplate();
    template[0x6b4] = 0xaa; // valores de plantilla que NO deben pisarse
    template[0x6b9] = 0xbb;
    const { gam } = exportNativeSave(state, template);
    expect(gam[0x6b4]).toBe(0xaa); // preservado
    expect(gam[0x6b9]).toBe(0xbb); // preservado
    // X/Y sí se sincronizan siempre (obj0 sigue a la party).
    expect(gam[0x6b6]).toBe(state.position.x);
  });

  it("transportTile → 0x2D6 y turnsSinceStart u8-saturante en 0x2E5 (fidelidad)", () => {
    const state = makeFullState();
    state.turnsSinceStart = 5000; // > 255
    const { gam } = exportNativeSave(state, blankTemplate());
    expect(gam[0x2d6]).toBe(0x24); // transportTile
    expect(gam[0x2e5]).toBe(0xff); // saturado a 255, NO desborda a 0x2E6
    expect(gam[0x2e6]).toBe(0); // preservado (plantilla en blanco)
  });

  it("parseSaveWindow lee los campos modelados del .GAM exportado", () => {
    const state = makeFullState();
    const { gam } = exportNativeSave(state, blankTemplate());
    const init = parseSaveWindow(gam);
    expect(init.gold).toBe(8803);
    expect(init.partySize).toBe(3);
    expect(init.location).toBe(17);
    // #115: el byte en disco sigue siendo 0xFF; el LECTOR lo interpreta con la location.
    expect(init.floor).toBe(-1);
    expect(gam[0x2ef]).toBe(0xff);
    expect(init.characters[1]!.name).toBe("Shamino");
  });

  it("rechaza plantilla demasiado corta", () => {
    expect(() => exportNativeSave(makeFullState(), new Uint8Array(100))).toThrow(/demasiado corta/);
  });

  it("ANTI-DRIFT: sha256 del .GAM canónico coincide con el fijado en el extractor", () => {
    const { gam } = exportNativeSave(createNewGame(canonicalInit()), new Uint8Array(SAVED_GAM_SIZE));
    const sha = createHash("sha256").update(gam).digest("hex");
    expect(sha).toBe(CANONICAL_GAM_SHA256);
  });
});

describe("buildNativeOol — writer SAVED.OOL (ítem saved-ool-no-generado)", () => {
  const makeState = (over: Partial<GameState>): GameState => {
    const s = createNewGame(canonicalInit());
    return { ...s, ...over } as GameState;
  };

  it("512 B = plantilla preservada cuando la party está en interior", () => {
    const template = new Uint8Array(0x200).map((_, i) => (i * 7) & 0xff);
    const st = makeState({ position: { location: 13, floor: 0, x: 5, y: 5 } });
    const ool = buildNativeOol(st, template);
    expect(ool.length).toBe(0x200);
    expect(Array.from(ool)).toEqual(Array.from(template)); // interior: bloques intactos
  });

  it("en el overworld refresca el bloque BRIT: reg 0 = avatar, +6 preservado", () => {
    const template = new Uint8Array(0x200).fill(0xee);
    const st = makeState({
      position: { location: 0, floor: 0, x: 0x56, y: 0x6b },
      transportTile: 0x1c,
      overworldEnemies: [],
    });
    const ool = buildNativeOol(st, template);
    // registro 0 del bloque overworld (base 0x000): TILE TILE X Y FLOOR HULL +6 SKIFFS
    expect(Array.from(ool.subarray(0, 8))).toEqual([0x1c, 0x1c, 0x56, 0x6b, 0, 0, 0xee, 0]);
    // slots 1..23 limpiados (pool de errantes vacío); 24..31 = plantilla
    expect(ool[8]).toBe(0);
    expect(ool[24 * 8]).toBe(0xee);
    // bloque UNDERWORLD (0x100..) queda plantilla
    expect(ool[0x100]).toBe(0xee);
  });

  it("fragata: reg 0 lleva hull (+5) y skiffs (+7); underworld usa el bloque 0x100", () => {
    const st = makeState({
      position: { location: 0, floor: 0xff, x: 10, y: 20 },
      transportTile: 0x22, // fragata izada E... (0x20-0x23)
      shipHull: 55,
      shipSkiffs: 2,
      overworldEnemies: [],
    });
    const ool = buildNativeOol(st, null);
    expect(Array.from(ool.subarray(0x100, 0x108))).toEqual([0x22, 0x22, 10, 20, 0xff, 55, 0, 2]);
    expect(ool[0]).toBe(0); // bloque BRIT sin plantilla = ceros
  });

  it("espeja los errantes en slots 1..23 con la codificación de 0x6B4 (#57)", () => {
    const st = makeState({
      position: { location: 0, floor: 0, x: 1, y: 1 },
      transportTile: 0x1c,
      overworldEnemies: [
        { tile: 0x12e, x: 40, y: 50, defIndex: 7, water: false, slot: 3 } as never,
      ],
    });
    const ool = buildNativeOol(st, null);
    const o = 3 * 8;
    expect(ool[o + 0]).toBe(0x2e); // tile − 0x100
    expect(ool[o + 2]).toBe(40);
    expect(ool[o + 3]).toBe(50);
    expect(ool[o + 4]).toBe(0);
  });
});

/**
 * #115 — EL SIGNO DE LA PLANTA EN EL VIAJE DE IDA Y VUELTA.
 *
 * 🔴 DEFECTO MEDIDO Y ARREGLADO el 08-08. `writeSaveWindow` escribe la planta con
 * `floor & 0xff` (0x2EF) y la lectura la devolvía CRUDA, así que un SÓTANO (z = −1) volvía
 * del códec como **255**. Consecuencia: cualquier `.GAM` nativo guardado en un sótano no se
 * podía recargar — `getActiveMap` LANZA «Location 32 (Serpents_Hold) sin planta 255»
 * (`world/map.ts:76-79`, `loc.floors.find(f => f.z === floor)`).
 *
 * ALCANCE: las CUATRO localizaciones con sótano de `maps/smallmaps.json` — Yew 4, Castillo
 * de Lord British 17, Palacio de Blackthorn 18 y Serpent's Hold 32. Lo destapó el momento
 * legendario de la Llama del Coraje (que ocurre justo en el sótano de Serpent's Hold), pero
 * el SUJETO es el códec y no la galería: el testigo no es el dueño del defecto.
 *
 * ★ LOS TRES CONTROLES NO SON ADORNO — son la mitad que hace útil a este test. El byte 0xFF
 * está SOBRECARGADO: con `location === 0` es el UNDERWORLD y tiene que seguir valiendo 0xFF.
 * Un arreglo «obvio» que extendiera el signo a todo byte ≥ 0x80 arregla los sótanos y ROMPE
 * el Underworld — y con él los momentos 8/9/10 y la docena de sitios que comparan
 * `floor === 0xff`. El discriminante es la LOCATION, y el mutante de abajo lo guarda.
 *
 * ⚠ EL LADO DE ESCRITURA SE QUEDA COMO ESTÁ: `floor & 0xff` ES la representación fiel del
 * SAVED.GAM de 1988. Quien interpreta es el lector. No «simetrizar».
 */
describe("#115 · el signo de la planta sobrevive al códec", () => {
  const conPosicion = (location: number, floor: number) => {
    const base = createNewGame(canonicalInit());
    const st = { ...base, position: { location, floor, x: 15, y: 15 } } as GameState;
    const h = exportNativeSave(st, new Uint8Array(SAVED_GAM_SIZE));
    return { byte: h.gam[0x2ef]!, leido: importNativeSave(h.gam, h.sidecar).position.floor };
  };

  // ── Los CUATRO sótanos (z = −1). Parametrizado y no en bucle con un expect dentro: en
  // bucle, el primer fallo dejaría los otros tres sin evaluar y el rojo no diría CUÁL.
  it.each([
    ["Yew", 4],
    ["Castillo de Lord British", 17],
    ["Palacio de Blackthorn", 18],
    ["Serpent's Hold", 32],
  ])("el sótano de %s (loc %i) vuelve como −1, no como 255", (_nombre, loc) => {
    const r = conPosicion(loc as number, -1);
    expect(r.byte).toBe(0xff); // el .GAM guarda el byte con signo: eso NO cambia
    expect(r.leido).toBe(-1); // y el lector lo interpreta con la location a mano
  });

  // ── CONTROL 1 — el 0xFF que SÍ es 0xFF. Si este cae, el arreglo se comió el Underworld.
  it("CONTROL · el Underworld (location 0, floor 0xFF) sigue siendo 0xFF", () => {
    const r = conPosicion(0, 0xff);
    expect(r.byte).toBe(0xff);
    expect(r.leido).toBe(0xff);
  });

  // ── CONTROL 2 y 3 — que el arreglo no toque lo que nunca estuvo roto.
  it("CONTROL · el overworld (location 0, planta 0) no se mueve", () => {
    expect(conPosicion(0, 0).leido).toBe(0);
  });

  it("CONTROL · una planta alta de mapa pequeño (Lycaeum, planta 2) no se mueve", () => {
    expect(conPosicion(30, 2).leido).toBe(2);
  });

  /**
   * 🔴 EL MUTANTE, y es el que da valor a los controles: la extensión de signo INGENUA
   * —«todo byte ≥ 0x80 es negativo»— es el arreglo que cualquiera escribiría, arregla los
   * cuatro sótanos y CONVIERTE EL UNDERWORLD EN −1. Aquí se le pone nombre y se le exige
   * que discrepe del lector real EXACTAMENTE en el Underworld.
   *
   * Sin este caso, los controles de arriba pasarían por buenos hoy y nadie sabría que la
   * regla ingenua estuvo a una línea de entrar.
   */
  it("MUTANTE · la extensión de signo INGENUA rompería el Underworld", () => {
    const ingenua = (b: number) => (b >= 0x80 ? b - 256 : b);
    const underworld = conPosicion(0, 0xff);
    const sotano = conPosicion(32, -1);

    // Sobre el MISMO byte, la regla ingenua y el lector real coinciden en el sótano…
    expect(ingenua(sotano.byte)).toBe(sotano.leido);
    // …y DISCREPAN en el Underworld: ahí la ingenua da −1 y el lector real da 0xFF.
    expect(ingenua(underworld.byte)).toBe(-1);
    expect(ingenua(underworld.byte)).not.toBe(underworld.leido);
    expect(underworld.leido).toBe(0xff);
  });
});

/**
 * #106 — LA FRAGATA DE (20,130): el original la pinta, el clon pintaba agua.
 *
 * 🔴 REPORTE DEL USUARIO (careo de vídeo lado a lado contra DOSBox, carril video-split).
 * La causa NO era «la tabla de objetos no se lee», que es lo que dice el diagnóstico corto
 * y lo que hace que uno busque en el sitio equivocado: la tabla SÍ se leía. El único lector
 * nativo de 0x6B4 era `readNativeOverworldEnemies`, que barre esos mismos slots MIRÁNDOLOS
 * POR LA LENTE DE ENEMIGO y descarta en silencio lo que no case —
 * `enemyTileToDefIndex(0x24 + 0x100) → 292 − 320 < 0 → null → continue`. La fragata se leía
 * y se tiraba, y `worldObjects` no tenía lector nativo ninguno: sólo el sidecar.
 *
 * ★ EL TESTIGO INSTANCIA LA DIFERENCIA DONDE EXISTE. El camino que el usuario vio es el del
 * arnés píxel-diff: bytes de un SAVED.GAM del DOS cargados SIN sidecar (`__u5test
 * .loadNativeSave` → `NEW_GAME_SIDECAR` de main.ts). Por eso el fixture es un .GAM con la
 * tabla poblada y el sidecar VACÍO — con sidecar el brazo nuevo ni se ejecuta. Los bytes del
 * slot son SINTÉTICOS y se escriben aquí a mano (REGLA 4: material de EA jamás en tracked);
 * reproducen el registro medido en los quince `original/av-saves/SAVED.GAM.*`, donde el
 * slot 1 lleva `24 24 14 82 00 63 20 02`.
 *
 * ★ Y EL ASERTO FINAL PREGUNTA AL PINTOR, no al array: `game.activeMap.tileAt(20,130)` es la
 * misma consulta compuesta que dibuja la celda. Un fix que poblara `worldObjects` con la
 * forma equivocada (location/floor que no casan con la party) dejaría el array lleno y la
 * pantalla con agua — exactamente el defecto que se está arreglando, pasando el test.
 */
describe("#106 · la fragata del .GAM ajeno llega al pintor", () => {
  const FRIGATE_B0 = 0x24; // velas arriadas, proa N
  const SIDECAR_VACIO = {
    version: 1 as const,
    qol: { journal: [] },
    gameState: { transport: "foot" as const, questFlags: {} },
  };

  /** .GAM sintético en el OVERWORLD con los slots que se le pidan poblados. */
  function gamConSlots(slots: Record<number, number[]>, location = 0): Uint8Array {
    const { gam } = exportNativeSave(createNewGame(canonicalInit()), new Uint8Array(SAVED_GAM_SIZE));
    gam[0x2ed] = location; // location
    gam[0x2ef] = 0; // floor
    gam[0x2f0] = 23; // X de la party (la fragata está 3 tiles al O, como el save 02b)
    gam[0x2f1] = 128;
    for (const [n, bytes] of Object.entries(slots)) {
      const o = 0x6b4 + Number(n) * 8;
      bytes.forEach((b, i) => (gam[o + i] = b));
    }
    return gam;
  }

  /** Mundo 256×256 TODO agua profunda: sin el objeto, (20,130) es agua y nada más. */
  function marAbierto(): WorldData {
    const agua = Array.from({ length: 256 }, () => Array.from({ length: 256 }, () => 1));
    return { overworld: agua, underworld: agua, smallMaps: new Map() };
  }

  const FRAGATA_SLOT1 = { 1: [FRIGATE_B0, FRIGATE_B0, 20, 130, 0x00, 0x63, 0x20, 0x02] };

  it("un SAVED.GAM del DOS sin sidecar trae la fragata de (20,130) con casco y esquifes", () => {
    const st = importNativeSave(gamConSlots(FRAGATA_SLOT1), SIDECAR_VACIO);
    expect(st.worldObjects).toEqual([
      { location: 0, floor: 0, x: 20, y: 130, slot: 1, tile: 0x124, kind: "ship", hull: 0x63, skiffs: 2 },
    ]);
  });

  it("EL PINTOR la ve: tileAt(20,130) deja de ser agua y devuelve el tile de la fragata", () => {
    const st = importNativeSave(gamConSlots(FRAGATA_SLOT1), SIDECAR_VACIO);
    const game = new Game({} as ExtractedInitialState, marAbierto(), {
      locationsX: Array.from({ length: 32 }, () => 250),
      locationsY: Array.from({ length: 32 }, () => 250),
      locationNames: Array.from({ length: 32 }, (_, i) => `Loc${i + 1}`),
    }, st);
    expect(game.activeMap.tileAt(20, 130)).toBe(0x124); // la fragata
    expect(game.activeMap.tileAt(21, 130)).toBe(1); // control: la celda de al lado sigue siendo agua
  });

  /**
   * El barrido es 1..31 y no 1..23: una nave del astillero la coloca `find_free_actor_slot`
   * (SJOG 0x0000), que barre 31→1 DESCENDENTE, así que aterriza en los slots ALTOS que el
   * pool de errantes no usa. Un lector copiado del de enemigos (que sí para en 23) dejaría
   * fuera justamente a la fragata COMPRADA — y pasaría el caso de arriba, que está en el 1.
   */
  it("un esquife en el slot 31 (el que usa la compra) también viaja", () => {
    const st = importNativeSave(
      gamConSlots({ 31: [0x28, 0x28, 77, 108, 0x00, 0x00, 0x20, 0x00] }),
      SIDECAR_VACIO,
    );
    expect(st.worldObjects).toEqual([
      { location: 0, floor: 0, x: 77, y: 108, slot: 31, tile: 0x128, kind: "ship", hull: 0, skiffs: 0 },
    ]);
  });

  /**
   * ★ EL BORDE DE ARRIBA DEL FILTRO ES LA MITAD DEL TRABAJO. 0x2C-0x2F es la fragata PIRATA,
   * que NO es un objeto atracado sino un ACTOR, y ya tiene dueño en el lector de errantes
   * (`PIRATE_ENEMY_TILE` 300 = 0x12C). Un filtro ensanchado a `& 0xF0 === 0x20` lo metería
   * en las DOS listas a la vez: pintado dos veces y movido por el tick mientras un objeto
   * inmóvil le bloquea su propia celda.
   */
  it("CONTROL · el pirata (0x2C) va a los errantes y NO a worldObjects", () => {
    const st = importNativeSave(
      gamConSlots({ 2: [0x2c, 0x2c, 30, 140, 0x00, 0x50, 0x00, 0x00] }),
      SIDECAR_VACIO,
    );
    expect(st.worldObjects).toEqual([]);
    expect(st.overworldEnemies?.map((e) => [e.slot, e.tile, e.x, e.y])).toEqual([[2, 300, 30, 140]]);
  });

  /**
   * El sidecar manda, igual que con los errantes. Un save emitido por el propio port SIEMPRE
   * trae `worldObjects` (arranca en `[]`, así que `extractSidecar` lo escribe siempre) ⇒ el
   * brazo nativo es EXCLUSIVO del .GAM ajeno y no puede alterar nada ya medido. Este caso es
   * el que fija esa frontera: con sidecar presente, la tabla NO se mira.
   */
  it("CONTROL · con sidecar presente manda el sidecar y la tabla nativa NO se lee", () => {
    const st = importNativeSave(gamConSlots(FRAGATA_SLOT1), {
      ...SIDECAR_VACIO,
      gameState: { ...SIDECAR_VACIO.gameState, worldObjects: [] },
    });
    expect(st.worldObjects).toEqual([]);
  });

  /**
   * En un INTERIOR estos slots son NPCs, y además los objetos de pueblo se RE-SIEMBRAN del
   * .NPC al entrar (`Game.hydrateInteriorObjects`, objects.md O6): sembrarlos también aquí
   * los duplicaría. Misma guarda `location === 0` que el lector de errantes.
   */
  it("CONTROL · en un interior (location ≠ 0) no se siembra nada", () => {
    const st = importNativeSave(gamConSlots(FRAGATA_SLOT1, 2), SIDECAR_VACIO);
    // `undefined` y no `[]`: en el interior NINGUNO de los dos brazos corre, así que el campo
    // se queda EXACTAMENTE como lo dejaba el códec antes de este fix. Se afirma el valor real
    // y no el cómodo — un `?? []` aquí taparía el día que el brazo empezara a correr en town.
    expect(st.worldObjects).toBeUndefined();
  });

  /**
   * ★ El aserto que aquí CONGELABA el alcance («el caballo sigue sin viajar, y es
   * deliberado») está RETIRADO: #131 lo trajo. Se conserva la memoria de por qué estaba,
   * porque la razón no era un filtro estrecho sino una duda de MODELO — resuelta contra el
   * binario, no por simetría: el establo planta el caballo en un slot de la MISMA tabla
   * (SHOPPES.OVL 0x0954-0x0978) y `board` lo despacha en la rama hermana de la fragata
   * (CMDS.OVL 0x0832 vs 0x08B8, epílogo 0x093E común).
   */
  const CABALLO_SLOT2 = { 2: [0x11, 0x11, 77, 108, 0x00, 0x00, 0x20, 0x05] };

  it("#131 · el caballo del slot 2 viaja como WorldObject kind:\"horse\"", () => {
    const st = importNativeSave(gamConSlots(CABALLO_SLOT2), SIDECAR_VACIO);
    // Sin `hull` ni `skiffs`: el fixture lleva los MISMOS +5/+6/+7 que los quince saves
    // reales (00/20/05), que son residuo del motor y no propiedades del caballo — el
    // establo los escribe a cero (0x0957-0x0961). Un lector copiado del de naves daría
    // `hull: 0, skiffs: 5`, y `toEqual` con el objeto EXACTO lo caza.
    expect(st.worldObjects).toEqual([
      { location: 0, floor: 0, x: 77, y: 108, slot: 2, tile: 0x111, kind: "horse" },
    ]);
    // ★ Y en UNA lista sola: los dos lectores barren LOS MISMOS slots, así que la
    // partición hay que afirmarla. El control del pirata (arriba) cierra este borde en la
    // dirección actor→objeto; ésta es la simétrica objeto→actor.
    // ⚠ Lo que mantiene fuera al caballo son DOS condiciones, no una (enemies.ts:202
    // `if (d < 0 || d % ENEMY_SPRITE_STRIDE !== 0) return null`): 0x111 = 273 da
    // d = 273 − 320 = −47, negativo, Y ADEMÁS no sería múltiplo de 4 aunque la base
    // bajase. Medido: con la base a 256 este aserto sigue VERDE (la sobrevive el
    // mutante) — es la segunda condición la que lo sostiene ahí. El mutante que sí lo
    // enrojece es una base que cumpla las dos (269: d = 4 ⇒ el caballo saldría como
    // enemigo def 1). Se deja escrito para que nadie lea este control como más ancho
    // de lo que es.
    expect(st.overworldEnemies ?? []).toEqual([]);
  });

  it("EL PINTOR lo ve: tileAt(77,108) deja de ser agua y devuelve el caballo", () => {
    const st = importNativeSave(gamConSlots(CABALLO_SLOT2), SIDECAR_VACIO);
    const game = new Game({} as ExtractedInitialState, marAbierto(), {
      locationsX: Array.from({ length: 32 }, () => 250),
      locationsY: Array.from({ length: 32 }, () => 250),
      locationNames: Array.from({ length: 32 }, (_, i) => `Loc${i + 1}`),
    }, st);
    expect(game.activeMap.tileAt(77, 108)).toBe(0x111); // HorseLeft
    // Control de que la coord no se inventa: las CUATRO celdas vecinas siguen intactas, y
    // en particular (108,77) —las coordenadas TRASPUESTAS— no tiene nada. 77 ≠ 108 a
    // propósito: con x == y un lector que confundiera +2 y +3 pasaría igual.
    expect(game.activeMap.tileAt(78, 108)).toBe(1);
    expect(game.activeMap.tileAt(77, 109)).toBe(1);
    expect(game.activeMap.tileAt(108, 77)).toBe(1);
  });

  /**
   * ★ LAS DOS ORIENTACIONES, y no sólo la del save. `0x10` es lo que planta el establo
   * (`mov byte [di],0x10`) y `0x11` lo que deja un desmontaje mirando al OESTE
   * (`exit` hace `transport − 2`, y 0x13 − 2 = 0x11). Un lector que igualara a
   * `TILE_HORSE` pelado, o que devolviera un 0x110 fijo, pasaría el caso de arriba
   * (que es el 0x11) y perdería el del establo — o al revés.
   */
  it("las DOS orientaciones del caballo del mundo viajan con SU tile", () => {
    const st = importNativeSave(
      gamConSlots({ 2: [0x11, 0x11, 77, 108, 0, 0, 0x20, 0x05], 7: [0x10, 0x10, 30, 41, 0, 0, 0, 0] }),
      SIDECAR_VACIO,
    );
    expect(st.worldObjects?.map((o) => [o.x, o.y, o.tile, o.kind])).toEqual([
      [77, 108, 0x111, "horse"], // HorseLeft
      [30, 41, 0x110, "horse"], // HorseRight — el que planta el establo
    ]);
  });

  /**
   * ★ EL BORDE DE ARRIBA, igual que el pirata lo era para la nave. `0x12`/`0x13` es el
   * party MONTADO (`isMounted`), que vive en `g_transport_tile` y en el SLOT 0, jamás en un
   * slot de objeto: el gate del binario es `and al,0xfe / cmp al,0x10` (CMDS 0x0832), que
   * los excluye. Un filtro ensanchado a `& 0xfc === 0x10` —la máscara de `isHorse`, que es
   * legítima para otra pregunta— sembraría un jinete fantasma como objeto del mundo.
   */
  it("CONTROL · el par MONTADO (0x12/0x13) NO entra en worldObjects", () => {
    const st = importNativeSave(
      gamConSlots({ 2: [0x12, 0x12, 77, 108, 0, 0, 0, 0], 3: [0x13, 0x13, 60, 90, 0, 0, 0, 0] }),
      SIDECAR_VACIO,
    );
    expect(st.worldObjects).toEqual([]);
  });

  /**
   * La pregunta de MODELO que bloqueaba #131 era «¿se monta igual que el del pozo?». La
   * respuesta es que se monta por el MISMO sitio y sin tocar `board()`: el `tileAt`
   * compuesto pone `worldObjects` POR ENCIMA de `mapOverrides` (game.ts §capa de objetos),
   * así que `board()` lee el mismo banco alto que leía del override, y el borrado al
   * abordar ya alcanza a los dos canales desde #137 (`removeWorldObject` para TODO `kind`).
   * Este test lo ejerce de punta a punta sobre el caballo IMPORTADO del .GAM ajeno.
   */
  it("el caballo importado SE MONTA, y al montarlo desaparece del mundo", () => {
    const gam = gamConSlots(CABALLO_SLOT2);
    gam[0x2f0] = 77; // la party se planta ENCIMA del caballo, como exige find_object_at_xy
    gam[0x2f1] = 108;
    // ⚠ Y `g_transport_tile` (file 0x2D6) tiene que llevar el 0x1C de «a pie». El fixture
    // canónico deja `transportTile` UNDEFINED a propósito (guarda anti-drift del sha: el
    // export entonces no escribe ese byte), así que sale un 0 que `isOnFoot` rechaza y `board`
    // corta con "On foot" ANTES de mirar el caballo — un rojo que no habla del fix. Los quince
    // saves reales van a pie (su slot 0 es `1c 1c 17 80 …`); se copia esa condición.
    gam[0x2d6] = 0x1c;
    const st = importNativeSave(gam, SIDECAR_VACIO);
    const game = new Game({} as ExtractedInitialState, marAbierto(), {
      locationsX: Array.from({ length: 32 }, () => 250),
      locationsY: Array.from({ length: 32 }, () => 250),
      locationNames: Array.from({ length: 32 }, (_, i) => `Loc${i + 1}`),
    }, st);
    const msgs = game.board().flatMap((e) => (e.kind === "message" ? [e.text] : []));
    expect(msgs).toContain("horse");
    // 0x11 + 2 = 0x13 = RidingHorseLeft: montar es `add al,2` (CS 0x0873) y CONSERVA la
    // orientación. Un caballo importado como 0x10 daría 0x12 — por eso el fixture es el 0x11.
    expect(game.state.transportTile).toBe(0x13);
    expect(game.state.worldObjects).toEqual([]);
    expect(game.activeMap.tileAt(77, 108)).toBe(1); // vuelve a ser el terreno de debajo
  });
});

/**
 * #136 — EL ROUND-TRIP DE LA TABLA NATIVA. Contrapartida de escritura de #106/#131.
 *
 * El defecto era una ASIMETRÍA: el port LEÍA naves y caballos de 0x6B4 pero al exportar
 * sólo escribía errantes, y antes LIMPIABA los slots 1..23 — justo donde viven la fragata
 * (slot 1) y el caballo (slot 2) de los saves reales. Importar un `.GAM` ajeno y volver a
 * exportarlo los borraba de la tabla; sobrevivían sólo en el sidecar, así que el round-trip
 * del PROPIO port no lo notaba. El daño era de fidelidad del `.gam`.
 *
 * El contrato viene de `re/notes/save-window-writer.md`: el binario no tiene writer de esta
 * tabla — vuelca la ventana viva con un solo `AH=0x40`, o sea PRESERVA. El port no puede
 * copiar eso porque parte el pool en tres (#103); lo más cercano es COMPONER.
 */
describe("#136 · la tabla nativa sobrevive al round-trip import→export", () => {
  const SIDECAR_VACIO = {
    version: 1 as const,
    qol: { journal: [] },
    gameState: { transport: "foot" as const, questFlags: {} },
  };
  const FRAGATA = [0x24, 0x24, 20, 130, 0x00, 0x63, 0x20, 0x02];
  const CABALLO = [0x11, 0x11, 77, 108, 0x00, 0x00, 0x20, 0x05];
  // +0 = 0x40 ⇒ tile 0x140 = 320 = ENEMY_SPRITE_BASE, o sea defIndex 0: el PRIMER byte que
  // `enemyTileToDefIndex` acepta. Mi primer intento puso 0x30 (tile 0x130 = 304) y el lector
  // lo descartó por negativo — el fixture no instanciaba un errante y el control era vacuo.
  const ORCO = [0x40, 0x40, 40, 40, 0x00, 0x00, 0x00, 0x00];

  function gamCon(slots: Record<number, number[]>, location = 0): Uint8Array {
    const { gam } = exportNativeSave(createNewGame(canonicalInit()), new Uint8Array(SAVED_GAM_SIZE));
    gam[0x2ed] = location; gam[0x2ef] = 0; gam[0x2f0] = 23; gam[0x2f1] = 128;
    for (const [n, bytes] of Object.entries(slots)) {
      const o = 0x6b4 + Number(n) * 8;
      bytes.forEach((b, i) => (gam[o + i] = b));
    }
    return gam;
  }
  const leerSlot = (g: Uint8Array, n: number) => Array.from(g.subarray(0x6b4 + n * 8, 0x6b4 + n * 8 + 8));

  it("la fragata y el caballo VUELVEN a sus ranuras tras exportar", () => {
    const st = importNativeSave(gamCon({ 1: FRAGATA, 2: CABALLO }), SIDECAR_VACIO);
    const { gam } = exportNativeSave(st, new Uint8Array(SAVED_GAM_SIZE));
    // Byte a byte, salvo +6 (estado de mover, que el port deja a 0 por decisión declarada —
    // witness-o1-0x6b4 §5) y, en el caballo, +7 (residuo del motor, #131).
    expect(leerSlot(gam, 1)).toEqual([0x24, 0x24, 20, 130, 0x00, 0x63, 0x00, 0x02]);
    expect(leerSlot(gam, 2)).toEqual([0x11, 0x11, 77, 108, 0x00, 0x00, 0x00, 0x00]);
  });

  it("★ LA RANURA ES LA IDENTIDAD: el esquife del slot 31 vuelve al 31, no al primer hueco", () => {
    const st = importNativeSave(gamCon({ 31: [0x28, 0x28, 60, 90, 0, 0, 0, 0] }), SIDECAR_VACIO);
    const { gam } = exportNativeSave(st, new Uint8Array(SAVED_GAM_SIZE));
    expect(leerSlot(gam, 31)).toEqual([0x28, 0x28, 60, 90, 0, 0, 0, 0]);
    // Y no se ha duplicado en ningún otro sitio: el resto de 1..31 sigue vacío.
    for (let n = 1; n <= 30; n++) expect(leerSlot(gam, n)).toEqual([0, 0, 0, 0, 0, 0, 0, 0]);
  });

  it("CONTROL · el errante convive: ni el objeto lo pisa ni él pisa al objeto", () => {
    const st = importNativeSave(gamCon({ 1: FRAGATA, 5: ORCO }), SIDECAR_VACIO);
    expect(st.overworldEnemies?.length).toBe(1);
    const { gam } = exportNativeSave(st, new Uint8Array(SAVED_GAM_SIZE));
    expect(leerSlot(gam, 1).slice(0, 4)).toEqual([0x24, 0x24, 20, 130]); // la nave sigue
    expect(leerSlot(gam, 5).slice(0, 4)).toEqual([0x40, 0x40, 40, 40]); // el orco también
  });

  /**
   * Un objeto nacido en el PORT (compra, desembarco) no trae ranura. El binario la elige con
   * `find_free_actor_slot` (SJOG 0x0000), que barre **31→1 DESCENDENTE** — por eso una nave
   * comprada aterriza en los slots altos, que es justo lo que hizo falta saber en #106 para
   * que el LECTOR barriera 1..31 y no 1..23. El escritor usa el mismo criterio.
   */
  it("un objeto SIN ranura se coloca con el barrido 31→1, no con el primer hueco ascendente", () => {
    const st = importNativeSave(gamCon({}), SIDECAR_VACIO);
    st.worldObjects = [{ location: 0, floor: 0, x: 10, y: 11, tile: 0x124, kind: "ship", hull: 99, skiffs: 1 }];
    const { gam } = exportNativeSave(st, new Uint8Array(SAVED_GAM_SIZE));
    expect(leerSlot(gam, 31)).toEqual([0x24, 0x24, 10, 11, 0, 99, 0, 1]);
    expect(leerSlot(gam, 1)).toEqual([0, 0, 0, 0, 0, 0, 0, 0]); // NO en el primer hueco
  });

  /**
   * ★ TESTIGO QUE NACIÓ DEGENERADO Y SE ARREGLÓ. El caso de arriba NO distingue si el
   * escritor respeta el «+5/+6/+7 = 0 del caballo» de #131: el caballo que devuelve el
   * lector trae `hull`/`skiffs` AUSENTES, así que `o.hull ?? 0` da cero con el código bueno
   * y con el roto. Medido: el mutante que copia hull/skiffs al caballo SOBREVIVÍA a los
   * cinco asertos. La diferencia sólo existe si el objeto LLEVA esos campos — cosa posible,
   * porque `worldObjects` también entra por el sidecar, que es JSON y no valida la clase.
   * Se instancia ahí, que es donde existe.
   */
  it("★ un caballo que TRAE hull/skiffs igual escribe ceros en +5 y +7", () => {
    const st = importNativeSave(gamCon({}), SIDECAR_VACIO);
    st.worldObjects = [
      { location: 0, floor: 0, x: 77, y: 108, slot: 2, tile: 0x111, kind: "horse", hull: 0x63, skiffs: 5 },
    ];
    const { gam } = exportNativeSave(st, new Uint8Array(SAVED_GAM_SIZE));
    expect(leerSlot(gam, 2)).toEqual([0x11, 0x11, 77, 108, 0, 0, 0, 0]);
  });

  /**
   * ★★ EL TESTIGO QUE DISTINGUE COMPONER DE «RECONSTRUIR CON CUIDADO», y el que encontró un
   * defecto: una ranura con algo que el port NO MODELA. `+0 = 0x41` da tile 0x141, que
   * `enemyTileToDefIndex` rechaza (`321 − 320 = 1`, no múltiplo de 4) y que no es nave ni
   * caballo — ningún lector la reclama, así que no está en ninguna lista viva.
   * Medido ANTES del arreglo: entraba `41 41 0f 10 00 00 30 00` y salía a CEROS. Preservar
   * sólo lo que el port entiende no es preservar: es reconstruir con mejor puntería.
   */
  it("★★ una ranura AJENA (tile que ningún lector reclama) sobrevive intacta", () => {
    const AJENA = [0x41, 0x41, 15, 16, 0x00, 0x00, 0x30, 0x00];
    const st = importNativeSave(gamCon({ 7: AJENA }), SIDECAR_VACIO);
    expect(st.worldObjects).toEqual([]);            // no la reclama el lector de objetos
    expect(st.overworldEnemies ?? []).toEqual([]);  // ni el de errantes
    const { gam } = exportNativeSave(st, gamCon({ 7: AJENA }));
    expect(leerSlot(gam, 7)).toEqual(AJENA);        // ...y aun así sale ENTERA, +6 incluido
  });

  /**
   * CONTROL que impide leer lo anterior como «no se limpia nunca»: una ranura con tile de
   * ERRANTE que ya NO está en la lista viva SÍ se limpia — es un enemigo muerto o retirado,
   * y para eso existe la limpieza del pool. El discriminante es «reclamada por una clase»,
   * no «no vacía»; sin este control, `ranurasAjenas` podría devolver todo y pasaría igual.
   */
  it("CONTROL · una ranura de ERRANTE ausente de la lista viva SÍ se limpia", () => {
    const st = importNativeSave(gamCon({ 9: [0x40, 0x40, 40, 40, 0, 0, 0, 0] }), SIDECAR_VACIO);
    expect(st.overworldEnemies?.length).toBe(1);
    st.overworldEnemies = []; // el errante muere
    const { gam } = exportNativeSave(st, gamCon({ 9: [0x40, 0x40, 40, 40, 0, 0, 0, 0] }));
    expect(leerSlot(gam, 9)).toEqual([0, 0, 0, 0, 0, 0, 0, 0]);
  });

  it("CONTROL · en un interior (location ≠ 0) el exportador no toca la tabla", () => {
    const st = importNativeSave(gamCon({ 1: FRAGATA }, 2), SIDECAR_VACIO);
    st.worldObjects = [{ location: 0, floor: 0, x: 20, y: 130, slot: 1, tile: 0x124, kind: "ship" }];
    const gamPlantilla = new Uint8Array(SAVED_GAM_SIZE);
    const { gam } = exportNativeSave(st, gamPlantilla);
    expect(leerSlot(gam, 1)).toEqual([0, 0, 0, 0, 0, 0, 0, 0]); // la plantilla, intacta
  });
});

describe("#238 · la capa de trama viaja NATIVA en el .GAM", () => {
  const SIDECAR_VACIO = {
    version: 1 as const,
    qol: { journal: [] },
    gameState: { transport: "foot" as const, questFlags: {} },
  };
  /** .GAM base emitido por el propio codec (overworld salvo que se pida otra location). */
  function gamBase(location = 0): Uint8Array {
    const { gam } = exportNativeSave(createNewGame(canonicalInit()), new Uint8Array(SAVED_GAM_SIZE));
    gam[0x2ed] = location;
    // Un save REAL siempre lleva g_transport_tile poblado (init.gam = 0x1C, a pie); el
    // estado canónico no lo trae y el byte quedaría 0 — un tile que no es ningún transporte.
    gam[0x2d6] = 0x1c;
    return gam;
  }

  it("el export escribe los Shadowlords a byte: 0x322..0x325 y el doom en 0x624", () => {
    const st = importNativeSave(gamBase(), SIDECAR_VACIO);
    st.shadowlordLocs = [0xff, 3, 0xff]; // Falsehood y Cowardice destruidos, Hatred en loc 3
    st.shadowlordSummoned = 1;
    st.shadowlordDoomBits = 0x0a; // 0x02|0x08
    const { gam } = exportNativeSave(st, new Uint8Array(SAVED_GAM_SIZE));
    // Esperados EN CRUDO (offsets del acta trama-flags-227, verificados en RAM viva §5.1):
    expect([gam[0x322], gam[0x323], gam[0x324]]).toEqual([0xff, 0x03, 0xff]);
    expect(gam[0x325]).toBe(0x01);
    // npcDead vacío en este estado ⇒ el word 0x624/0x625 es exactamente el doom OR'eado.
    expect(gam[0x624]).toBe(0x0a);
    expect(gam[0x625]).toBe(0x00);
  });

  it("sin convocado, 0x325 sale 0xFF — el reposo del binario (init.gam), no 0x00", () => {
    const st = importNativeSave(gamBase(), SIDECAR_VACIO);
    expect(st.shadowlordSummoned).toBeUndefined();
    const { gam } = exportNativeSave(st, new Uint8Array(SAVED_GAM_SIZE));
    expect(gam[0x325]).toBe(0xff);
  });

  it("un SAVED.GAM del DOS sin sidecar entrega la capa de trama al estado", () => {
    const gam = gamBase();
    gam[0x322] = 0x05; gam[0x323] = 0x08; gam[0x324] = 0xff; // Cowardice destruido
    gam[0x325] = 0x02;
    gam[0x32a + 7] = 0x80; // palabra de Doom (loc 40) dicha
    gam[0x624] = 0x08; // doom bit de Cowardice
    const st = importNativeSave(gam, SIDECAR_VACIO);
    expect(st.shadowlordLocs).toEqual([0x05, 0x08, 0xff]);
    expect(st.shadowlordSummoned).toBe(2);
    expect(st.shadowlordDoomBits).toBe(0x08);
    expect(st.questFlags["word-spoken:40"]).toBe(true);
    // Y el muerto enciende su flag del port (locs[2] ≥ 0x80 = el AND de MAINOUT 0x07f1):
    expect(st.questFlags["shadowlord-dead:cowardice"]).toBe(true);
    expect(st.questFlags["shadowlord-dead:falsehood"]).toBeUndefined();
    expect(st.questFlags["shadowlord-dead:hatred"]).toBeUndefined();
  });

  it("0x322 = 3×0x00 (init.gam) ⇒ shadowlordLocs [] — no entra al sorteo de medianoche", () => {
    const st = importNativeSave(gamBase(), SIDECAR_VACIO);
    expect(st.shadowlordLocs).toEqual([]);
  });

  it("round-trip DOS→port→DOS: la capa de trama vuelve byte a byte", () => {
    const gam = gamBase();
    gam[0x322] = 0xff; gam[0x323] = 0xff; gam[0x324] = 0xff;
    gam[0x32a + 0] = 0x80; // FALLAX dicha (Deceit, loc 33)
    gam[0x624] = 0x0e; // los tres doom bits
    const st = importNativeSave(gam, SIDECAR_VACIO);
    const { gam: out } = exportNativeSave(st, new Uint8Array(SAVED_GAM_SIZE));
    expect([out[0x322], out[0x323], out[0x324]]).toEqual([0xff, 0xff, 0xff]);
    expect(out[0x325]).toBe(0xff);
    expect(out[0x32a + 0]).toBe(0x80);
    expect(out[0x624]).toBe(0x0e);
  });

  it("sellos: el flag enciende el bit 0x80 y los 7 bits bajos de la plantilla SOBREVIVEN", () => {
    const st = importNativeSave(gamBase(), SIDECAR_VACIO);
    st.questFlags["word-spoken:33"] = true;
    const template = new Uint8Array(SAVED_GAM_SIZE);
    template[0x32a + 0] = 0x01; // bit bajo desconocido sembrado en Deceit
    template[0x32a + 1] = 0x81; // Despise: bit alto RANCIO que el estado no respalda + bajo
    const { gam } = exportNativeSave(st, template);
    expect(gam[0x32a + 0]).toBe(0x81); // 0x80 del flag + 0x01 preservado
    expect(gam[0x32a + 1]).toBe(0x01); // el 0x80 rancio se APAGA (flag ausente); 0x01 queda
  });

  it("CONTROL · el sidecar sigue mandando sobre los bytes nativos", () => {
    const gam = gamBase();
    gam[0x322] = 0xff; gam[0x323] = 0xff; gam[0x324] = 0xff;
    gam[0x325] = 0x01;
    const st = importNativeSave(gam, {
      ...SIDECAR_VACIO,
      gameState: {
        ...SIDECAR_VACIO.gameState,
        shadowlordLocs: [7, 12, 20],
        shadowlordSummoned: 2,
        shadowlordDoomBits: 0x04,
      },
    });
    expect(st.shadowlordLocs).toEqual([7, 12, 20]);
    expect(st.shadowlordSummoned).toBe(2);
    expect(st.shadowlordDoomBits).toBe(0x04);
  });

  it("CONTROL · la máscara del doom NO adopta bits ajenos de npcDead (y el bitmap los conserva)", () => {
    const gam = gamBase();
    gam[0x624] = 0x81; // 0x80|0x01: bits de npc-muerto de Stonegate FUERA de la imagen del escritor
    const st = importNativeSave(gam, SIDECAR_VACIO);
    expect(st.shadowlordDoomBits ?? 0).toBe(0); // la máscara {0x02,0x04,0x08} los rechaza
    const { gam: out } = exportNativeSave(st, new Uint8Array(SAVED_GAM_SIZE));
    expect(out[0x624]).toBe(0x81); // ...pero el byte VIAJA intacto por la vía npcDead
  });

  it("el ritual deja doomBits y npcDead[28][6-i] CONSISTENTES ⇒ el .GAM sale igual por las dos vías", () => {
    // Estado como lo produce use-tools tras destruir a Falsehood (#238): las dos escrituras.
    const st = importNativeSave(gamBase(), SIDECAR_VACIO);
    st.shadowlordDoomBits = 0x02;
    st.npcDead[28]![6] = true; // Stonegate (loc 29), slot 6 = el MISMO bit
    const { gam } = exportNativeSave(st, new Uint8Array(SAVED_GAM_SIZE));
    expect(gam[0x624]).toBe(0x02); // una sola escritura observable: OR idempotente
  });
});

describe("#231 · obj0+5/+7 (g_hull/g_skiffs) sobreviven a pie en el overworld", () => {
  const SIDECAR_VACIO = {
    version: 1 as const,
    qol: { journal: [] },
    gameState: { transport: "foot" as const, questFlags: {} },
  };
  function gamBase(location = 0): Uint8Array {
    const { gam } = exportNativeSave(createNewGame(canonicalInit()), new Uint8Array(SAVED_GAM_SIZE));
    gam[0x2ed] = location;
    // Un save REAL siempre lleva g_transport_tile poblado (init.gam = 0x1C, a pie); el
    // estado canónico no lo trae y el byte quedaría 0 — un tile que no es ningún transporte.
    gam[0x2d6] = 0x1c;
    return gam;
  }

  it("★★ el careo 15-a-2: un .GAM del DOS a pie con casco 0x63 y 2 esquifes NO los pierde", () => {
    // Los bytes del careo real (memoria del 13-08: 15 de 28 saves a pie llevan el residuo
    // de la fragata amarrada en obj0+5/+7; el docblock que juraba 0 quedó refutado).
    const gam = gamBase();
    gam[0x6b9] = 0x63; // +5 g_hull
    gam[0x6bb] = 0x02; // +7 g_skiffs
    const st = importNativeSave(gam, SIDECAR_VACIO);
    expect(st.shipHull).toBe(0x63);
    expect(st.shipSkiffs).toBe(0x02);
    // Ida y vuelta sobre plantilla EN BLANCO: si el export cero-escribiera, aquí saldría 0.
    const { gam: out } = exportNativeSave(st, new Uint8Array(SAVED_GAM_SIZE));
    expect(out[0x6b9]).toBe(0x63);
    expect(out[0x6bb]).toBe(0x02);
  });

  it("CONTROL · en INTERIOR el residuo (+7=6, sin derivar) NO se adopta ni se escribe", () => {
    const gam = gamBase(17); // castillo de LB
    gam[0x6b9] = 0x00;
    gam[0x6bb] = 0x06; // el +7=6 medido en 11/11 saves de interior — semántica SIN DETERMINAR
    const st = importNativeSave(gam, SIDECAR_VACIO);
    expect(st.shipSkiffs ?? 0).toBe(0); // no adoptado (default)
    const { gam: out } = exportNativeSave(st, new Uint8Array(SAVED_GAM_SIZE));
    expect(out[0x6bb]).toBe(0); // en interior se sigue escribiendo 0, declarado
  });

  it("en otro VEHÍCULO (caballo) el export TAMBIÉN conserva — #378 refutó el registro del establo", () => {
    // 🔴 #378: este test se llamaba «CONTROL · … el export escribe 0» y afirmaba «board()
    // vuelca el REGISTRO del vehículo abordado a slot0, y el del caballo lleva +5/+7 = 0
    // (SHOPPES 0x0957-0x0961)». El mecanismo es FALSO: esa copia registro→slot0 es
    // EXCLUSIVA de la rama fragata de cmd_board (0x08DC→0x08F4 / 0x08FE→0x0936); la rama
    // caballo (0x083B-0x0878) no escribe 0x5C5F/0x5C61 y el epílogo común 0x093E solo
    // borra el registro del objeto ABORDADO (ranura ≥1). Derivado y MEDIDO:
    // re/notes/board-epilogo-378.md + re/tools/probe_board_chain_378.py. La cobertura
    // fina por transporte vive en tests/board-chain-378.test.ts.
    const st = importNativeSave(gamBase(), SIDECAR_VACIO);
    st.shipHull = 0x63; // residuo en el estado tras una fragata anterior
    st.shipSkiffs = 0x02;
    st.transportTile = 0x12; // a caballo (montado = tile del caballo + 2, 0x0873)
    const { gam } = exportNativeSave(st, new Uint8Array(SAVED_GAM_SIZE));
    expect(gam[0x6b9]).toBe(0x63);
    expect(gam[0x6bb]).toBe(0x02);
  });

  it("CONTROL · el sidecar sigue mandando sobre obj0+5/+7", () => {
    const gam = gamBase();
    gam[0x6b9] = 0x63;
    gam[0x6bb] = 0x02;
    const st = importNativeSave(gam, {
      ...SIDECAR_VACIO,
      gameState: { ...SIDECAR_VACIO.gameState, shipHull: 7, shipSkiffs: 1 },
    });
    expect(st.shipHull).toBe(7);
    expect(st.shipSkiffs).toBe(1);
  });
});
