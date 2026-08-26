/**
 * F1.7-T1 · Blackthorn "refuge" VIVO (BLCKTHRN.OVL 0x0910 `party_refuge`).
 *
 * El motor puro (`partyRefuge`, world/blackthorn.ts) ya está portado y con
 * paridad; esta suite ejercita el CABLEADO al juego vivo: el bucle de contexto
 * (TOWN 0x1436 / MAINOUT 0x0ac2 / DUNGEON 0x1014) comprueba
 * `party_conscious_state == -1` (TODO el party muerto) tras CADA turno y, en vez
 * de game-over, dispara el refuge — despiertas revivido en el castillo de Lord
 * British. NO está gated por la location de Blackthorn (a diferencia de la
 * captura): la muerte total en pueblo, overworld o mazmorra desemboca en el
 * mismo refuge. Narración byte-exacta de DATA.OVL (DS 0x70e2..0x71ea, impresa por
 * kernel_print_ds 0x75c0; fileoff = DS+0x10). Ver re/notes/blackthorn.md §4.
 */
import { describe, expect, it } from "vitest";
import { describeConAssets } from "./assets-opcionales.js";
import { conDsStrings, dsRecordDeAsset, DS_STRINGS } from "./ds-strings-fixture.js";
import type {
  CharacterState,
  ExtractedInitialState,
  GameState,
} from "../src/core/state.js";
import { Game, type GameData, type GameEvent, type RefugeScript } from "../src/core/game.js";
import type { SmallMapLocation, WorldData } from "../src/core/world/map.js";
import { LOC_LORD_BRITISH } from "../src/core/world/blackthorn.js";
import { DungeonState } from "../src/core/dungeon/dungeon.js";

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

const TOWN_LOC = 13; // Iolo's Hut (idx 12)

function makeState(over: Partial<GameState> = {}): GameState {
  const base: Partial<GameState> = {
    characters: [dead("Avatar"), dead("Iolo")],
    partySize: 2,
    activeCharacter: 0,
    food: 0,
    karma: 10,
    time: { year: 139, month: 4, day: 7, hour: 8, minute: 35 },
    turnsSinceStart: 0,
    position: { location: TOWN_LOC, floor: 0, x: 5, y: 5 },
    transport: "foot",
    torchTurns: 3,
    torches: 2,
    prevHour: 8,
    lightSpellMins: 4,
    timeSpell: undefined,
  };
  return { ...base, ...over } as GameState;
}

function makeTownLocation(): SmallMapLocation {
  const tiles = Array.from({ length: 32 }, () => Array.from({ length: 32 }, () => 5));
  return { id: TOWN_LOC, name: "Iolo's Hut", floors: [{ z: 0, tiles }] };
}

function makeWorld(): WorldData {
  const overworld = Array.from({ length: 256 }, () =>
    Array.from({ length: 256 }, () => 5),
  );
  return {
    overworld,
    underworld: overworld,
    smallMaps: new Map([[TOWN_LOC, makeTownLocation()]]),
  };
}

const gameData: GameData = {
  locationsX: Array.from({ length: 32 }, () => 100),
  locationsY: Array.from({ length: 32 }, () => 100),
  locationNames: Array.from({ length: 32 }, (_, i) => `Loc${i + 1}`),
};

function makeGame(s: GameState = makeState()): Game {
  return new Game({} as ExtractedInitialState, makeWorld(), gameData, s);
}

// Discurso de resurrección de Lord British — KARMA.DAT, indexado por karma/20 AL MORIR
// (BLCKTHRN 0x0b03-0x0b3e; la tabla de offsets DS 0x1a74). Es la línea central de la escena
// (video-M f058), ENVUELTA en comillas (prefijo DS 0x71be `\n"` + char `"` 0x0b37).
//
// 🔴 EL ESPERADO SE LEE DEL ASSET, Y NO ES TAUTOLÓGICO — que es la objeción que mantuvo
// este texto transcrito hasta el 25-08 (`acta-630` §2: «derivarlo de un asset es
// imposible»). Hoy sí se puede y hay DOS caminos independientes al mismo KARMA.DAT: el
// port lo lee por `dsRec()` (registro instalado en el arranque) y este aserto por
// `leeAsset()` (lectura cruda del JSON). Lo que se comprueba es lo que siempre se
// comprobó: que el port elige el RECORD correcto para ese karma y lo compone con sus
// comillas. Derivarlo por `dsRec` SÍ sería tautológico, y por eso no se hace.
// PEREZOSOS: `describe.skip` ejecuta su cuerpo, así que la lectura del asset no puede
// ocurrir en carga de módulo (ver `ds-strings-fixture.ts`).
const KARMA_STRAYED = (): string => dsRecordDeAsset("KARMA.DAT", 0); // karma 0-19
const KARMA_ENLIGHTENED = (): string => dsRecordDeAsset("KARMA.DAT", 4); // karma 80-99

/** Extrae el guión (`RefugeScript`) del evento `refuge` emitido, o null si no lo hay. */
function refugeScript(events: readonly GameEvent[]): RefugeScript | null {
  return events.find((e) => e.kind === "refuge")?.refuge ?? null;
}
/** Los mensajes (en orden) de los beats del guión. */
function beatMessages(script: RefugeScript): string[] {
  return script.beats.filter((b) => b.message).map((b) => b.message!);
}

describeConAssets([DS_STRINGS], "F1.7-T1 — Blackthorn refuge vivo (BLCKTHRN 0x0910)", () => {
  conDsStrings();
  it("party-wipe en pueblo: EMITE el guión de refuge SIN mutar; resolveRefuge despierta en LB", () => {
    const game = makeGame();
    const events = game.confirmTownExit(false); // TOWN 0x15D4: corre un townTurn
    const script = refugeScript(events);
    expect(script).not.toBeNull();

    // El core NO ha mutado nada aún (la escena la pacea la piel): sigue en el pueblo,
    // party CAÍDA, karma sin suelo — así el roster muestra "OD" durante la escena (f042).
    expect(game.state.position.location).toBe(TOWN_LOC);
    expect(game.state.characters.every((c) => c.status === "D")).toBe(true);
    expect(game.state.karma).toBe(10);

    // resolveRefuge (fin de la escena) aplica el despertar EXACTO (0x0c09-0x0c1d):
    // loc 0x11, planta 1, (10,10), a pie + revela el mapa/party.
    const res = game.resolveRefuge();
    expect(game.state.position.location).toBe(LOC_LORD_BRITISH); // 0x11
    expect(game.state.position.floor).toBe(1);
    expect(game.state.position.x).toBe(10);
    expect(game.state.position.y).toBe(10);
    expect(game.state.transport).toBe("foot");
    expect(res.some((e) => e.kind === "map-changed")).toBe(true);
    expect(res.some((e) => e.kind === "party-changed")).toBe(true);
  });

  it("consecuencia (resolveRefuge): party revivido, karma a suelo 75, reloj a 6:00, comida repuesta", () => {
    const game = makeGame(makeState({ karma: 10, food: 0 }));
    game.confirmTownExit(false);
    game.resolveRefuge();

    // Revive por miembro (0x0b98: currentHp := maxHp; status vivo).
    expect(game.state.characters.every((c) => c.status === "G")).toBe(true);
    expect(game.state.characters.every((c) => c.currentHp === c.maxHp)).toBe(true);
    // Karma restaurado a SUELO 75 (0x0bfd).
    expect(game.state.karma).toBeGreaterThanOrEqual(75);
    // Reloj a las 6:00 (0x0c2a); food a 63 si estaba a 0 (0x0c40).
    expect(game.state.time.hour).toBe(6);
    expect(game.state.time.minute).toBe(0);
    expect(game.state.food).toBe(0x3f);
  });

  it("guión: narración byte-exacta de DATA.OVL en orden (DS 0x70e2..0x71ea)", () => {
    const script = refugeScript(makeGame().confirmTownExit(false))!;
    const msgs = beatMessages(script);

    for (const line of [
      "An unending darkness engulfs thee...",
      "Thou hast found refuge.",
      "No evil lives here, only peace and darkness.",
      "But thy slumber is disturbed!",
      "There is a peal of thunder!",
      "Strange words are intoned.",
      "Vertigo...",
    ]) {
      expect(msgs).toContain(line);
    }
    // Orden: la oscuridad precede al despertar ("slumber disturbed").
    expect(msgs.indexOf("An unending darkness engulfs thee...")).toBeLessThan(
      msgs.indexOf("But thy slumber is disturbed!"),
    );
  });

  it("guión: cues y fases visuales — 2 truenos + void/apparition/vertigo", () => {
    const script = refugeScript(makeGame().confirmTownExit(false))!;
    const thunders = script.beats.filter((b) => b.sfx?.id === "refuge-thunder");
    expect(thunders.length).toBe(2); // 0x0acc + 0x0acf call 0x8de2
    const phases = script.beats.map((b) => b.scene).filter(Boolean);
    expect(phases).toContain("void"); // 0x0962 viewport a negro
    expect(phases).toContain("ghostLeft"); // 0x0a70 figura 0x5e
    expect(phases).toContain("ghostBoth"); // 0x0aa2 figura 0x5f
    expect(phases).toContain("apparition"); // 0x0ae9 aparición 0x174
    expect(phases).toContain("vertigo"); // 0x0bc4 destello final
  });

  it("NO gated por Blackthorn: el party-wipe en OVERWORLD también emite el refuge", () => {
    const game = makeGame(
      makeState({ position: { location: 0, floor: 0, x: 100, y: 100 } }),
    );
    const events = game.move("east");
    expect(refugeScript(events)).not.toBeNull();

    game.resolveRefuge();
    expect(game.state.position.location).toBe(LOC_LORD_BRITISH);
    expect(game.state.position.floor).toBe(1);
    expect(game.state.characters.every((c) => c.status === "G")).toBe(true);
  });

  it("no dispara con ≥1 miembro consciente: turno normal, sin refuge", () => {
    const game = makeGame(
      makeState({
        characters: [makeChar({ name: "Avatar", status: "G" }), dead("Iolo")],
        food: 100,
        karma: 10,
      }),
    );
    const events = game.confirmTownExit(false);

    expect(refugeScript(events)).toBeNull();
    expect(game.state.position.location).toBe(TOWN_LOC); // sigue en el pueblo
    expect(game.state.karma).toBe(10); // sin suelo de refuge
  });

  it("call-site MAZMORRA: dungeonCommand emite el refuge; dungeonState persiste hasta resolveRefuge", () => {
    const DUNGEON_LOC = 0x21; // primera mazmorra
    const game = makeGame(
      makeState({
        characters: [dead("Avatar"), dead("Iolo")],
        partySize: 2,
        position: { location: DUNGEON_LOC, floor: 0, x: 1, y: 1 },
      }),
    );
    // Mazmorra mínima (8×8×1 celdas vacías); `right` = turnRight, no toca el mapa.
    const floor = Array.from({ length: 8 }, () =>
      Array.from({ length: 8 }, () => ({ type: 0, sub: 0 })),
    );
    (game as unknown as { dungeonState: DungeonState }).dungeonState = new DungeonState(
      [{ location: DUNGEON_LOC, name: "Deceit", floors: [floor] }],
      { dungeon: DUNGEON_LOC, floor: 0, x: 1, y: 1, facing: "south" },
    );

    const events = game.dungeonCommand("right");
    expect(refugeScript(events)).not.toBeNull();
    // La escena corre SOBRE la mazmorra (coreview la ennegrece); el modo se cierra al RESOLVER.
    expect(game.dungeonState).not.toBeNull();

    // Guarda de idempotencia: mientras el refuge está pendiente, otro turno NO re-emite.
    const again = game.dungeonCommand("right");
    expect(refugeScript(again)).toBeNull();

    game.resolveRefuge();
    expect(game.state.position.location).toBe(LOC_LORD_BRITISH);
    expect(game.state.position.floor).toBe(1);
    expect(game.state.characters.every((c) => c.status === "G")).toBe(true);
    expect(game.dungeonState).toBeNull(); // el refuge carga BRIT.DAT → sale de mazmorra
  });

  it("compensación COMBATE: endCombat con el party caído emite el refuge (destino 0x0910)", () => {
    const game = makeGame(
      makeState({
        characters: [makeChar({ name: "Avatar", status: "G" }), makeChar({ name: "Iolo", status: "G" })],
        karma: 10,
        food: 0,
      }),
    );
    // El combate del clon es estado MODAL desacoplado: se simula el cierre de una
    // pelea donde AMBOS PJs cayeron. endCombat sincroniza 'D' al roster (bucle
    // real) y ejecuta el death-check compensatorio. Stub mínimo del contrato que
    // endCombat consume (victory=false salta collectSpoils).
    (game as unknown as { combat: unknown }).combat = {
      victory: false,
      finalSeed: 4242,
      combatants: [
        { kind: "player", charIdx: 0, status: "dead", hp: 0 },
        { kind: "player", charIdx: 1, status: "dead", hp: 0 },
      ],
    };

    const events = game.endCombat();
    expect(refugeScript(events)).not.toBeNull();

    game.resolveRefuge();
    expect(game.state.position.location).toBe(LOC_LORD_BRITISH);
    expect(game.state.position.floor).toBe(1);
    expect(game.state.characters.every((c) => c.status === "G")).toBe(true);
    expect(game.state.karma).toBeGreaterThanOrEqual(75);
  });

  it("no dispara con miembros DORMIDOS (party_conscious_state == 1, no -1)", () => {
    const game = makeGame(
      makeState({
        characters: [makeChar({ name: "Avatar", status: "S" }), dead("Iolo")],
        karma: 10,
      }),
    );
    const events = game.confirmTownExit(false);

    expect(refugeScript(events)).toBeNull();
    expect(game.state.position.location).toBe(TOWN_LOC);
    expect(game.state.karma).toBe(10);
  });

  it("resurrección: karma bajo (10/20→0) recita el record 0, ENTRE COMILLAS, entre trueno y 'Strange words'", () => {
    const game = makeGame(makeState({ karma: 10 }));
    const msgs = beatMessages(refugeScript(game.confirmTownExit(false))!);
    const quoted = `"${KARMA_STRAYED()}"`;

    expect(msgs).toContain(quoted); // discurso envuelto (0x71be `"` + 0x0b37 `"`)
    // Va ENTRE "peal of thunder" y "Strange words are intoned" (0x0ac5 → 0x0b41).
    expect(msgs.indexOf("There is a peal of thunder!")).toBeLessThan(msgs.indexOf(quoted));
    expect(msgs.indexOf(quoted)).toBeLessThan(msgs.indexOf("Strange words are intoned."));
  });

  it("RECARGA a mitad de escena: estado sin mutar ⇒ el refuge se RE-DISPARA desde el principio", () => {
    // El usuario cierra la pestaña mientras corren los beats. Como `resolveRefuge` aún no
    // ha corrido, el estado persistido tiene la party CAÍDA en el sitio de la muerte y el
    // guard `refugePending` (en memoria) se pierde. Al recargar (= NUEVA instancia de Game
    // sobre ese estado), el death-check vuelve a ver party_conscious_state==-1 y re-emite el
    // guión completo. Comportamiento CORRECTO/idempotente: la escena se repite entera, no un
    // teleport seco a medias. (No hay estado intermedio que persista y corrompa.)
    const s = makeState({ karma: 10 });
    const game1 = makeGame(s);
    expect(refugeScript(game1.confirmTownExit(false))).not.toBeNull();
    // El estado sigue SIN mutar (party caída, en el pueblo): es lo que se guardaría/recargaría.
    expect(game1.state.position.location).toBe(TOWN_LOC);
    expect(game1.state.characters.every((c) => c.status === "D")).toBe(true);

    // RECARGA: instancia fresca sobre el MISMO estado (refugePending arranca en false).
    const game2 = makeGame(game1.state);
    const script2 = refugeScript(game2.confirmTownExit(false));
    expect(script2).not.toBeNull(); // re-dispara
    // Y el guión recargado es el mismo (misma narración byte-exacta en orden).
    expect(beatMessages(script2!)).toContain("An unending darkness engulfs thee...");
    // Sólo al RESOLVER despierta en LB (una vez).
    game2.resolveRefuge();
    expect(game2.state.position.location).toBe(LOC_LORD_BRITISH);
  });

  it("resurrección: el índice usa el karma AL MORIR, no el suelo 75 posterior", () => {
    // karma 90 al morir → 90/20 = 4 → record 4 ('enlightened'). Si se leyera tras el
    // restore (75→índice 3) saldría otro record: este test ancla el ORDEN de lectura.
    const game = makeGame(makeState({ karma: 90 }));
    const msgs = beatMessages(refugeScript(game.confirmTownExit(false))!);

    expect(msgs).toContain(`"${KARMA_ENLIGHTENED()}"`);
    expect(msgs).not.toContain(`"${KARMA_STRAYED()}"`);
  });
});

// Huida por escalera de una sala de mazmorra: endCombat aplica el cambio de piso
// (E3c-2). El puente COMBAT↔DUNGEON: el combate de sala fija escapeFloorDelta y al
// cerrar, endCombat lo aplica a dungeonState.pos.floor. Sólo en combate de sala
// (gate por dungeonState) y sólo si el party huyó (no victoria). video-N f078.
describeConAssets([DS_STRINGS], "Klimb-escape de sala: cambio de piso (E3c-2)", () => {
  conDsStrings();
  function dungeonAt(floor: number): DungeonState {
    const floors = Array.from({ length: 8 }, () =>
      Array.from({ length: 8 }, () => Array.from({ length: 8 }, () => ({ type: 0, sub: 0 }))),
    );
    return new DungeonState([{ location: 0x21, name: "Deceit", floors }], {
      dungeon: 0x21,
      floor,
      x: 1,
      y: 1,
      facing: "south",
    });
  }
  function fledCombat(escapeFloorDelta: number | null, victory = false): unknown {
    return {
      victory,
      finalSeed: 1,
      escapeFloorDelta,
      collectSpoils: () => ({ gold: 0 }),
      combatants: [{ kind: "player", charIdx: 0, status: "fled", hp: 5 }],
    };
  }

  it("huida por escalera↑ (delta −1) sube un piso + BATTLE IS LOST! + map-changed", () => {
    const game = makeGame(
      makeState({ characters: [makeChar({ name: "Avatar", status: "G" })], partySize: 1 }),
    );
    (game as unknown as { dungeonState: DungeonState }).dungeonState = dungeonAt(3);
    (game as unknown as { combat: unknown }).combat = fledCombat(-1);
    const ev = game.endCombat();
    expect(game.dungeonState!.pos.floor).toBe(2);
    expect(ev.some((e) => e.kind === "message" && e.text === "BATTLE IS LOST!")).toBe(true);
    expect(ev.some((e) => e.kind === "map-changed")).toBe(true);
  });

  it("huida por escalera↓ (delta +1) baja un piso", () => {
    const game = makeGame(
      makeState({ characters: [makeChar({ name: "Avatar", status: "G" })], partySize: 1 }),
    );
    (game as unknown as { dungeonState: DungeonState }).dungeonState = dungeonAt(3);
    (game as unknown as { combat: unknown }).combat = fledCombat(1);
    game.endCombat();
    expect(game.dungeonState!.pos.floor).toBe(4);
  });

  it("VICTORIA no cambia el piso aunque haya delta (gate !victory)", () => {
    const game = makeGame(
      makeState({ characters: [makeChar({ name: "Avatar", status: "G" })], partySize: 1 }),
    );
    (game as unknown as { dungeonState: DungeonState }).dungeonState = dungeonAt(3);
    (game as unknown as { combat: unknown }).combat = fledCombat(-1, true);
    game.endCombat();
    expect(game.dungeonState!.pos.floor).toBe(3);
  });
});

/**
 * D7 — el CIERRE DEL TURNO DE PUEBLO no corre con la party a −1 (TOWN 0x15bf-0x15c5).
 *
 *   15bf: call 0xffffb82c   → CS 0x39fc party_conscious_state
 *   15c2: inc ax
 *   15c3: jne 0x15c8        ← ax ≠ −1: sigue el cierre
 *   15c5: jmp 0x1686        ← ax == −1: SE SALTA EL CIERRE ENTERO
 *
 * Tramo saltado 0x15c8-0x1685, en orden: advance_clock(1) (0x15d4 → CS 0x4f7c) ·
 * refresco de reja/puente si el turno FICHA hora y la nueva es 20 ó 5 (0x15e9) ·
 * post_turn 0x0f02 · contador [0x594f]/[0x5952] + set_map_tile CS 0x39cc (0x15f6) ·
 * copia de posición a g_char_anim_states+2/3/4 (0x160d) · toggles de cadencia de
 * montura (0x161f) y Quickness (0x1649) · guard_wander 0x0c78 (0x165f) ·
 * npc_tick_all (0x166e) · npc_engine 0x1352 (0x1683).
 *
 * ★ −1 NO es «party inconsciente» a secas. CS 0x39fc, cuerpo entero leído: devuelve 0
 * en cuanto ve un 'G'/'P', 1 si no hay ninguno pero SÍ hay un 'S' dormido, y −1 sólo si
 * no hay ni lo uno ni lo otro. Con la party ENTERA DORMIDA el cierre SÍ corre — y ese
 * es el control por condición separada de abajo.
 */
describeConAssets([DS_STRINGS], "D7 — cierre del turno de pueblo saltado con party a −1 (TOWN 0x15bf)", () => {
  conDsStrings();
  it("party-wipe: el reloj NO avanza (advance_clock 0x15d4 queda dentro del salto)", () => {
    const game = makeGame(); // makeState() = los dos miembros 'D' ⇒ −1
    const antes = { ...game.state.time };
    game.confirmTownExit(false);
    expect(game.state.time.hour).toBe(antes.hour);
    expect(game.state.time.minute).toBe(antes.minute); // ni un minuto de más
  });

  it("★ party-wipe: el STREAM NO SE MUEVE — cero rands en todo el turno", () => {
    // La aserción fuerte del tramo saltado. El cierre normal consume, como mínimo, el
    // tick de viento de townTurn, y además las tiradas de guard_wander (0x165f) y del
    // npc_engine (0x1683). Si el gate no está, g_rng_seed cambia; con el gate, no puede.
    const game = makeGame();
    game.reseed(0x1234);
    const antes = game.liveSeed();
    game.confirmTownExit(false);
    expect(game.liveSeed()).toBe(antes);
  });

  it("party-wipe: el refuge SÍ se emite (0x1436-0x1464 está FUERA del tramo saltado)", () => {
    const game = makeGame();
    expect(refugeScript(game.confirmTownExit(false))).not.toBeNull();
  });

  it("★ CONTROL POR CONDICIÓN SEPARADA: party ENTERA DORMIDA ('S') ⇒ 0x39fc devuelve 1, NO −1, y el cierre SÍ corre", () => {
    // Aísla que el gate es `== −1` y no «nadie de pie». Si alguien lo relaja a
    // «ningún miembro consciente», este caso deja de avanzar el reloj y sale rojo.
    const game = makeGame(
      makeState({
        characters: [
          makeChar({ name: "Avatar", status: "S" }),
          makeChar({ name: "Iolo", status: "S" }),
        ],
        partySize: 2,
      }),
    );
    const antes = { ...game.state.time };
    const ev = game.confirmTownExit(false);
    expect(game.state.time.minute).not.toBe(antes.minute); // advance_clock(1) corrió
    expect(refugeScript(ev)).toBeNull(); // y no es refuge
  });

  it("CONTROL: con la party viva el turno cierra normal (el gate no se dispara)", () => {
    const game = makeGame(
      makeState({
        characters: [makeChar({ name: "Avatar", status: "G" })],
        partySize: 1,
      }),
    );
    const antes = { ...game.state.time };
    const ev = game.confirmTownExit(false);
    expect(game.state.time.minute).not.toBe(antes.minute);
    expect(refugeScript(ev)).toBeNull();
  });
});
