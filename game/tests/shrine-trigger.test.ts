/**
 * Fase 1.4 · Trigger de santuario VIVO + Codex + ceremonia de meditación.
 *
 * El binario despacha la ceremonia por el TILE bajo el party (CAST2 0x0e76:
 * 0x19→shrine_visit, 0x11→Codex). El clon lo replica en checkShrineEntry, llamado
 * desde move() tras el turno del paso. 0 RNG: paridad de VALOR. Reglas del motor
 * puro (world/shrines.ts) NO se reimplementan aquí — sólo se disparan.
 * Citas: re/notes/shrines.md §2, .superpowers/sdd/scout-shrines.md.
 */
import { describe, expect, it } from "vitest";
import type { CharacterState, ExtractedInitialState, GameState } from "../src/core/state.js";
import { Game, type GameData, type GameEvent } from "../src/core/game.js";
import type { WorldData } from "../src/core/world/map.js";
import { describeConAssets } from "./assets-opcionales.js";
import { conDsStrings, dsRecordDeAsset, DS_STRINGS } from "./ds-strings-fixture.js";
import {
  SHRINE_TILE, CODEX_TILE, BROKEN_SHRINE_TILE, type ShrineData,
} from "../src/core/world/shrines.js";

// Honesty = virtud 0: STR_FLAG[0]=0, DEX[0]=0, INT[0]=1 → sube Intelligence.
const SHRINES: ShrineData = {
  virtues: ["Honesty", "Compassion", "Valour", "Justice", "Sacrifice", "Honor", "Spirituality", "Humility"],
  mantras: ["Ahm", "Mu", "Ra", "Beh", "Cah", "Summ", "Om", "Lum"],
  shrineX: [101, 0, 0, 0, 0, 0, 0, 0],  // Honesty en (101,100); resto irrelevante
  shrineY: [100, 0, 0, 0, 0, 0, 0, 0],
};

function makeChar(over: Partial<CharacterState> = {}): CharacterState {
  return {
    name: "Avatar", gender: 0x0b, class: "A", status: "G",
    strength: 20, dexterity: 20, intelligence: 20,
    currentMp: 10, currentHp: 50, maxHp: 60, exp: 0, level: 2, monthsAtInn: 0,
    helmet: 0xff, armor: 0xff, weapon: 0xff, shield: 0xff, ring: 0xff, amulet: 0xff,
    partyStatus: 0, ...over,
  };
}

function makeState(over: Partial<GameState> = {}): GameState {
  const base: Partial<GameState> = {
    characters: [makeChar()], partySize: 1, activeCharacter: 0,
    food: 100, gold: 1000, karma: 50,
    time: { year: 139, month: 4, day: 7, hour: 8, minute: 35 },
    turnsSinceStart: 0,
    position: { location: 0, floor: 0, x: 100, y: 100 }, // 1 al O del santuario
    transport: "foot", torchTurns: 0, torches: 2, prevHour: 8,
  };
  return { ...base, ...over } as GameState;
}

function makeWorld(shrineAt?: { x: number; y: number; tile: number }): WorldData {
  const overworld = Array.from({ length: 256 }, () => Array.from({ length: 256 }, () => 5));
  if (shrineAt) overworld[shrineAt.y]![shrineAt.x] = shrineAt.tile;
  return { overworld, underworld: overworld, smallMaps: new Map() };
}

const gameData = (): GameData => ({
  locationsX: Array.from({ length: 32 }, () => 250), // lejos: no coincide con el santuario
  locationsY: Array.from({ length: 32 }, () => 250),
  locationNames: Array.from({ length: 32 }, (_, i) => `Loc${i + 1}`),
  shrines: SHRINES,
});

function makeGame(s: GameState, world: WorldData): Game {
  return new Game({} as ExtractedInitialState, world, gameData(), s);
}

const messages = (evs: { kind: string; text?: string }[]) =>
  evs.filter((e) => e.kind === "message").map((e) => e.text);

const seedOf = (g: Game): number =>
  (g as unknown as { liveRng: { getSeed(): number } }).liveRng.getSeed();

describe("F1.4 · trigger de santuario VIVO", () => {
  it("(E)nter sobre un santuario en pie: eco «Enter the shrine of <Virtud>» + ceremonia (F2-T6)", () => {
    const world = makeWorld({ x: 101, y: 100, tile: SHRINE_TILE });
    const game = makeGame(makeState(), world);

    const stepEvents = game.move("east"); // (100,100) → (101,100) = Shrine 0x19
    expect(game.state.position.x).toBe(101);
    // F2-T6: pisar YA NO dispara — la ceremonia cuelga del (E)nter (cmd_enter
    // 0x9da→0x936: eco DS 0x2a6f "Enter " + 0x2a76 "the shrine of\n" + tabla
    // 0x1f4e[i] + '\n' y call 0xf89a directo, sin getkey). Testigo P09:
    // «>Enter the shrine of Compassion» ANTES de «Thou dost approach…».
    expect(messages(stepEvents)).toEqual([]);
    const events = game.enter();
    // Eco + aproximación (MISCMSG 0xa59) + kneel (MISCMSG 0x718) + interrogatorio.
    expect(messages(events)).toEqual([
      "Enter the shrine of\nHonesty\n",
      "\nThou dost approach the tranquil Shrine...\n\n",
      "...and thou dost kneel before the Altar.\n\n",
    ]);
    expect(events.some((e) => e.kind === "shrine-visit-prompt")).toBe(true);
    expect(game.state.shrineQuestBitmap ?? 0).toBe(0); // aún sin quest (interrogatorio pendiente)
  });

  it("pisar tile normal (no santuario) NO corre ceremonia", () => {
    const world = makeWorld(); // sin santuario: (101,100) es hierba 5
    const game = makeGame(makeState(), world);

    const events = game.move("east");

    expect(game.state.position.x).toBe(101);
    expect(messages(events)).toEqual([]);
    expect(game.state.shrineQuestBitmap ?? 0).toBe(0);
  });

  it("santuario sin coord en la tabla (Spirituality centinela 0,0) NO dispara", () => {
    // Un tile Shrine 0x19 en una casilla que NO casa ninguna coord de la tabla:
    // shrineIndexAt devuelve -1 (el sentinel (0,0) nunca casa en juego). Sin ceremonia.
    const world = makeWorld({ x: 50, y: 50, tile: SHRINE_TILE });
    const game = makeGame(makeState({ position: { location: 0, floor: 0, x: 49, y: 50 } }), world);

    game.move("east"); // (49,50) → (50,50) = Shrine sin coord
    const events = game.enter();

    expect(game.state.position.x).toBe(50);
    // shrineIndexAt<0 → cae al default de cmd_enter ("Enter What?", 0x09ee).
    expect(messages(events)).toEqual(["Enter What?"]);
    expect(game.state.shrineQuestBitmap ?? 0).toBe(0);
  });
});

describeConAssets([DS_STRINGS], "F1.4 · ceremonia de meditación (AL PISAR, sin yes/no)", () => {
  conDsStrings();
  // Pisar el santuario CORRE la ceremonia en el mismo paso (el original despacha del
  // step directo a shrine_visit CAST2 0x0966, sin prompt "Meditate?"). Devuelve los
  // eventos del `move` para asertarlos.
  function steppedOnHonesty(over: Partial<GameState> = {}): { game: Game; events: GameEvent[] } {
    const world = makeWorld({ x: 101, y: 100, tile: SHRINE_TILE });
    const game = makeGame(makeState(over), world);
    game.move("east");
    const events = game.enter(); // F2-T6: la ceremonia cuelga del (E)nter
    return { game, events };
  }

  // T-003: el paso emite kneel + shrine-visit-prompt; la ceremonia se resuelve con el
  // INTERROGATORIO (virtud + mantra ×3, CAST2 0x09c1/0x0a0c). Este helper lo contesta BIEN.
  function meditatedOnHonesty(over: Partial<GameState> = {}): { game: Game; events: GameEvent[] } {
    const { game } = steppedOnHonesty(over);
    const events = game.submitShrineVisit("Honesty", ["Ahm", "Ahm", "Ahm"]);
    return { game, events };
  }

  it("ordained (T-003): Codex NO aprendido + interrogatorio CORRECTO → Altar speaks + sacred Quest + fija la quest", () => {
    const { game, events } = meditatedOnHonesty({ shrineVisitedBitmap: 0, shrineQuestBitmap: 0 });
    expect(messages(events)).toEqual([
      "\n\nThe Altar speaks and a Quest is ordained! ", // MISCMSG 0x78c
      "\n\n\"'Tis now thy sacred Quest to go unto the Codex and learn the failing of Dishonesty!\"\n", // 0x7b9 + 0x4b5e[0] + DS 0x9598
      "\n\"Return again when thy Quest is done!\"\n", // MISCMSG 0x7f6
    ]);
    expect(game.state.shrineQuestBitmap).toBe(0b1); // quest de Honesty fijada (0x0a88)
  });

  it("F2-T5: MAYÚSCULAS y substring PASAN (kernel 0x6f1e case-insensitive; el LP tecleó COMPASSION/MU)", () => {
    // Comparador CAST2 0x09e3/0x0a43 → thunk 0x8d3e = kernel 0x6f1e: substring
    // toupper AMBOS lados (0x6f5f-0x6f6b). «HONESTY»/«AHM» y «xxHonestyyy» pasan;
    // «Hon» (needle más largo que el input, 0x6f3b) falla.
    const upper = steppedOnHonesty({ shrineVisitedBitmap: 0, shrineQuestBitmap: 0 }).game;
    upper.submitShrineVisit("HONESTY", ["AHM", "ahm", "Ahm"]);
    expect(upper.state.shrineQuestBitmap).toBe(0b1); // ordained con mayúsculas (espejo S4)

    const sub = steppedOnHonesty({ shrineVisitedBitmap: 0, shrineQuestBitmap: 0 }).game;
    sub.submitShrineVisit("xxHonestyyy", ["the AHM", "AHM!", "-ahm-"]);
    expect(sub.state.shrineQuestBitmap).toBe(0b1); // substring-match, como check_mantra

    const short = steppedOnHonesty({ shrineVisitedBitmap: 0, shrineQuestBitmap: 0 }).game;
    const events = short.submitShrineVisit("Hon", ["Ahm", "Ahm", "Ahm"]);
    expect(messages(events)).toEqual(["\n\nThine thoughts are unfocused.\n"]);
    expect(short.state.shrineQuestBitmap ?? 0).toBe(0); // needle > input → -1
  });

  it("unfocused (T-003): un mantra erróneo → «Thine thoughts are unfocused.» y SIN quest", () => {
    const { game } = steppedOnHonesty({ shrineVisitedBitmap: 0, shrineQuestBitmap: 0 });
    const events = game.submitShrineVisit("Honesty", ["Ahm", "Mu", "Ahm"]);
    expect(messages(events)).toEqual(["\n\nThine thoughts are unfocused.\n"]); // MISCMSG 0x76b
    expect(game.state.shrineQuestBitmap ?? 0).toBe(0);
  });

  it("quest-complete: Codex aprendido + quest activa → +3 karma, +1 Intelligence (cap 30)", () => {
    const { game, events } = meditatedOnHonesty({
      shrineVisitedBitmap: 0b1, shrineQuestBitmap: 0b1, karma: 50,
      characters: [makeChar({ intelligence: 20 })],
    });
    expect(game.state.karma).toBe(53); // +3 (Honesty no es Humildad)
    expect(game.state.characters[0]!.intelligence).toBe(21); // INT_FLAG[0]=1
    expect(game.state.shrineQuestBitmap).toBe(0); // quest consumida
    expect(messages(events)).toContain('\n\nA thunderous voice booms:\n\n"WELL DONE!"\n\n'); // MISCMSG.DAT 0x0864
    expect(messages(events)).toContain("Intelligence +1\n"); // byte-exacto DS 0x95d4 (DATA.OVL 0x95e4)
  });

  it("donation: Codex aprendido + sin quest → emite shrine-donate-prompt (flujo F1.3)", () => {
    const { events } = meditatedOnHonesty({ shrineVisitedBitmap: 0b1, shrineQuestBitmap: 0 });
    expect(events.some((e) => e.kind === "shrine-donate-prompt")).toBe(true);
  });

  it("Codex: pisar el tile 0x11 con quest activa marca la lección y no re-dispara", () => {
    const world = makeWorld({ x: 101, y: 100, tile: CODEX_TILE });
    const game = makeGame(makeState({ shrineQuestBitmap: 0b1, shrineVisitedBitmap: 0 }), world);
    game.move("east");
    const events = game.enter(); // F2-T6: (E)nter corre el peregrinaje (cmd_enter 0x986)
    expect(game.state.shrineVisitedBitmap).toBe(0b1); // lección de la virtud 0 aprendida
    expect(events.some((e) => e.kind === "party-changed")).toBe(true);
    // Textos byte-exactos de MISCMSG.DAT (buffer 0xb21e, offset de fichero 0x3ab):
    const msgs = messages(events);
    expect(msgs).toContain("\nThe book is open to the page thou dost seek!\n\n"); // 0x0890
    expect(msgs).toContain("Upon the hallowed page thou dost read:\n\n"); // 0x08c0
    // Aproximación del Codex (MISCMSG 0xa86, rutina de ENTRADA 0x0e76 selector tile==0x11
    // — #281: el 0x0f69 compara [bp-4], el TILE bajo la party de call 0x6222 (0x0e8d),
    // NO g_location, que 0x0ea4 acaba de poner a 0xFF; loc 0x11 sería el castillo de LB).
    expect(msgs).toContain("\nThe Codex of Ultimate Wisdom lies before thee...");
    // Lección LARGA de la virtud 0 (MISCMSG rec 20, fileoff 0x4ab; tabla DS 0x4b6e =
    // DATA.OVL fileoff 0x4b7e — fix codex-lesson-swap: antes imprimía el record CORTO
    // 12 (0x3ab, tabla 0x4b5e), que es SOLO del mandato ORDAINED).
    expect(msgs).toContain(
      '"A dishonest life brings\nunto thee temporary gain, but forsakes\nthe permanent."\n\n',
    );
  });

  it("Codex: urnas de compañeros perdidos (roster partyStatus 0x7f) tras la aproximación", () => {
    // CAST2 0x0fa4-0x1037 (SOLO tile==0x11 — cmp [bp-4],0x11 en 0x0fa4, mismo
    // discriminante de TILE que la aproximación; #281): records 1..15 del roster con partyStatus
    // (+0x1F) == 0x7f — el marcador que deja sacrifice_member (BLCKTHRN 0x04c2) —
    // imprimen DS 0x9624 + (1: DS 0x9636 / >1: DS 0x9648) + nombre + '\n'.
    const world = makeWorld({ x: 101, y: 100, tile: CODEX_TILE });
    const roster = [
      makeChar(), // slot 0 = Avatar (el scan del binario arranca en 0x55e7 = slot 1)
      makeChar({ name: "Iolo", partyStatus: 0x7f }),
      makeChar({ name: "Shamino", partyStatus: 0x7f }),
    ];
    const game = makeGame(
      makeState({ characters: roster, shrineQuestBitmap: 0b1, shrineVisitedBitmap: 0 }),
      world,
    );
    game.move("east");
    const msgs = messages(game.enter());
    expect(msgs).toContain("\n\nThou dost see\n"); // DS 0x9624
    expect(msgs).toContain("urns marked:\n\n"); // DS 0x9648 (rama count>1)
    expect(msgs).toContain("Iolo\n");
    expect(msgs).toContain("Shamino\n");
  });

  it("Codex: UNA urna usa la rama singular ('an urn marked:'); sin 0x7f no hay urnas", () => {
    const world = makeWorld({ x: 101, y: 100, tile: CODEX_TILE });
    const one = makeGame(
      makeState({
        characters: [makeChar(), makeChar({ name: "Iolo", partyStatus: 0x7f })],
        shrineQuestBitmap: 0b1,
        shrineVisitedBitmap: 0,
      }),
      world,
    );
    one.move("east");
    const msgs = messages(one.enter());
    expect(msgs).toContain("an urn marked:\n\n"); // DS 0x9636 (rama count==1, CAST2 0x0fc3)
    expect(msgs).not.toContain("urns marked:\n\n");
    // Sin partyStatus 0x7f: ni cabecera ni urnas (el scan 0x0f44 cuenta 0).
    const none = makeGame(
      makeState({ shrineQuestBitmap: 0b1, shrineVisitedBitmap: 0 }),
      makeWorld({ x: 101, y: 100, tile: CODEX_TILE }),
    );
    none.move("east");
    expect(messages(none.enter())).not.toContain("\n\nThou dost see\n");
  });

  it("Codex 8/8: la última lección dispara la CEREMONIA de las 8 virtudes (profecía rúnica)", () => {
    // 7 lecciones ya aprendidas (0x7f) + quest de Humildad (bit 7) activa: pisar el Codex
    // marca el 8º bit → 0xFF → ceremonia final (CAST2 0x0dac-0x0e5b).
    const world = makeWorld({ x: 101, y: 100, tile: CODEX_TILE });
    const game = makeGame(makeState({ shrineVisitedBitmap: 0x7f, shrineQuestBitmap: 1 << 7 }), world);
    game.move("east");
    const events = game.enter(); // F2-T6
    expect(game.state.shrineVisitedBitmap).toBe(0xff);
    // Secuencia byte-exacta: eco de (E)nter + aproximación + intro + página + ceremonia.
    expect(messages(events)).toEqual([
      "Enter the Shrine of the Codex!", // DS 0x2a6f + 0x2a89 (cmd_enter 0x986, F2-T6)
      "\nThe Codex of Ultimate Wisdom lies before thee...", // MISCMSG 0xa86
      "\nThe book is open to the page thou dost seek!\n\n", // 0x0890
      "Upon the hallowed page thou dost read:\n\n", // 0x08c0
      `"${dsRecordDeAsset("MISCMSG.DAT", 27)}"\n\n`, // lección LARGA virtud 7 (MISCMSG rec 27, 0x6bb — fix codex-lesson-swap)
      dsRecordDeAsset("MISCMSG.DAT", 40), // "A STRANGE WIND…" — MISCMSG 0x0900
      "Thou dost read:\n\n", // DS 0x95ea
      dsRecordDeAsset("MISCMSG.DAT", 41), // profecía p1 — MISCMSG 0x092a
      dsRecordDeAsset("MISCMSG.DAT", 42), // profecía p2 — MISCMSG 0x097c
      dsRecordDeAsset("MISCMSG.DAT", 43), // profecía p3 (VERAMOCOR) — MISCMSG 0x09b7
      dsRecordDeAsset("MISCMSG.DAT", 44), // profecía p4 — MISCMSG 0x0a2b
    ]);
    // Las 4 páginas de la PROFECÍA llevan `rune: true` (fuente RUNES.CH); la prosa NO.
    const runeMsgs = events.filter((e) => e.kind === "message" && e.rune).map((e) => e.text);
    expect(runeMsgs).toHaveLength(4);
    expect(runeMsgs.every((t) => typeof t === "string" && t!.includes("@"))).toBe(true);
    expect(events.find((e) => e.text === "A STRANGE WIND CAUSES THE PAGE TO TURN!\n\n")!.rune).toBeFalsy();
    // Las 3 ráfagas de "viento" = la primitiva de terremoto (kernel 0x3072) disparada
    // 3× (CAST2 0x0dc0/0dd7/0dee): 3 eventos `quake` + 3 cues `sfx` de rumble, ANTES
    // del texto "A STRANGE WIND…". La piel enruta los quake a su QuakeShake sostenida.
    expect(events.filter((e) => e.kind === "quake")).toHaveLength(3);
    expect(events.filter((e) => e.kind === "sfx" && e.sfx?.id === "quake")).toHaveLength(3);
    // fix-codice: las TRES llevan el marcador del BRACKET XOR (los pares set_color+rect
    // de 0x0db3/0x0dca/0x0de1 que las envuelven) — la piel arranca con él su
    // CodexWindFlash (máscaras acumuladas 4/11/15). Las tres, no «alguna»: el conteo NO
    // es el discriminante (el endgame emite 3 quakes sin bracket, use-tools.ts:106).
    expect(events.filter((e) => e.kind === "quake").every((e) => e.xorBracket === true)).toBe(true);
    // Orden: las 3 sacudidas preceden al primer mensaje "A STRANGE WIND…".
    const firstQuake = events.findIndex((e) => e.kind === "quake");
    const windMsg = events.findIndex((e) => e.text === "A STRANGE WIND CAUSES THE PAGE TO TURN!\n\n");
    expect(firstQuake).toBeGreaterThanOrEqual(0);
    expect(firstQuake).toBeLessThan(windMsg);
  });

  it("Codex 7/8 (aún NO completo): NO dispara la ceremonia", () => {
    // 6 aprendidas (0x3f) + quest de la 7ª: al marcarla queda 0x7f, no 0xFF → sin ceremonia.
    const world = makeWorld({ x: 101, y: 100, tile: CODEX_TILE });
    const game = makeGame(makeState({ shrineVisitedBitmap: 0x3f, shrineQuestBitmap: 1 << 6 }), world);
    game.move("east");
    const events = game.enter(); // F2-T6
    expect(game.state.shrineVisitedBitmap).toBe(0x7f);
    expect(messages(events)).not.toContain("A STRANGE WIND CAUSES THE PAGE TO TURN!\n\n");
    expect(events.some((e) => e.kind === "message" && e.rune)).toBe(false);
  });

  it("la ceremonia AL PISAR es DETERMINISTA (misma semilla → misma semilla y eventos)", () => {
    // La ceremonia (runShrineCeremony) es PURA: no toca el stream vivo (sólo estado +
    // mensajes). El RNG que el `move` gasta es el del PASO de mundo (encuentro), no la
    // ceremonia — por eso se compara determinismo entre dos corridas idénticas.
    for (const mode of [
      { shrineVisitedBitmap: 0, shrineQuestBitmap: 0 },          // show-mantra
      { shrineVisitedBitmap: 0b1, shrineQuestBitmap: 0b1 },      // quest-complete
      { shrineVisitedBitmap: 0b1, shrineQuestBitmap: 0 },        // donation
    ]) {
      const run = (): { seed: number; msgs: (string | undefined)[] } => {
        const game = makeGame(makeState(mode), makeWorld({ x: 101, y: 100, tile: SHRINE_TILE }));
        game.reseed(4242);
        game.move("east");
        const events = game.enter(); // F2-T6
        return { seed: seedOf(game), msgs: messages(events) };
      };
      const a = run();
      const b = run();
      expect(a.seed).toBe(b.seed);
      expect(a.msgs).toEqual(b.msgs);
    }
  });
});

describe("F1.4 · restaurar santuario destruido (CMDS 0x1202, tile 0x1a)", () => {
  function steppedOnBrokenHonesty(): Game {
    // #212: el mapa ESTÁTICO guarda 0x19 (SHRINE_TILE) — la ruina 0x1a la pinta el
    // compose por frame desde g_shrine_destroyed (OUTSUBS 0x0178, game.ts tileAt).
    // El harness antiguo horneaba 0x1a en el estático, cosa que el mapa real no hace.
    const world = makeWorld({ x: 101, y: 100, tile: SHRINE_TILE });
    const destroyed = new Array(8).fill(0);
    destroyed[0] = 0x80; // Honesty destruido por un Shadowlord (bit alto)
    const game = makeGame(makeState({ shrineDestroyed: destroyed }), world);
    game.move("east"); // (100,100) → (101,100): el compose muestra 0x1a → arma pendingRestore
    return game;
  }

  it("pisar un santuario destruido emite shrine-restore-prompt (NO meditate)", () => {
    const world = makeWorld({ x: 101, y: 100, tile: BROKEN_SHRINE_TILE });
    const destroyed = new Array(8).fill(0);
    destroyed[0] = 0x80;
    const game = makeGame(makeState({ shrineDestroyed: destroyed }), world);
    const events = game.move("east");
    expect(events.some((e) => e.kind === "shrine-restore-prompt")).toBe(true);
    expect(messages(events)).toEqual([]); // NO corre la ceremonia (santuario destruido)
  });

  it("virtud + mantra×3 correctos y coord exacta → restaura (bit limpio + repinta 0x19)", () => {
    const game = steppedOnBrokenHonesty();
    const events = game.submitShrineRestore("Honesty", ["Ahm", "Ahm", "Ahm"]);
    expect((game.state.shrineDestroyed ?? [])[0]).toBe(0); // bit alto limpiado (efecto puro)
    expect(game.activeMap.tileAt(101, 100)).toBe(SHRINE_TILE); // 0x1a → 0x19 (repintado)
    expect(events.some((e) => e.kind === "map-changed")).toBe(true);
  });

  it("★ #212: restaurar NO deja rastro en mapOverrides — la persistencia es el BITMAP", () => {
    // En el binario el repintado inmediato es una escritura VOLÁTIL por tile_addr
    // (CMDS 0x12a2/0x12ad sobre el búfer vivo) y la persistencia REAL es el bitmap
    // g_shrine_destroyed (roster+0x332, en el .GAM); el compose por frame
    // (OUTSUBS.OVL 0x0178) repinta 0x19/0x1a desde el bitmap en cada carga. Un
    // mapOverride persistente de 0x19 era un NO-OP (el mapa estático ya guarda
    // 0x19) que sólo ensuciaba el save.
    const game = steppedOnBrokenHonesty();
    game.submitShrineRestore("Honesty", ["Ahm", "Ahm", "Ahm"]);
    expect(game.state.mapOverrides?.["0:0:101:100"]).toBeUndefined();
    expect(game.activeMap.tileAt(101, 100)).toBe(SHRINE_TILE); // el compose basta
  });

  it("un solo dato erróneo (2º mantra) → NO restaura, tile intacto", () => {
    const game = steppedOnBrokenHonesty();
    const events = game.submitShrineRestore("Honesty", ["Ahm", "Mu", "Ahm"]);
    expect((game.state.shrineDestroyed ?? [])[0]).toBe(0x80); // sigue destruido
    expect(game.activeMap.tileAt(101, 100)).toBe(BROKEN_SHRINE_TILE); // sin repintar
    expect(events.some((e) => e.kind === "map-changed")).toBe(false);
  });

  it("virtud equivocada → NO restaura", () => {
    const game = steppedOnBrokenHonesty();
    game.submitShrineRestore("Compassion", ["Ahm", "Ahm", "Ahm"]);
    expect((game.state.shrineDestroyed ?? [])[0]).toBe(0x80);
  });

  it("resolver sin pendiente (nunca se pisó el tile) es NO-OP", () => {
    const world = makeWorld({ x: 101, y: 100, tile: BROKEN_SHRINE_TILE });
    const destroyed = new Array(8).fill(0);
    destroyed[0] = 0x80;
    const game = makeGame(makeState({ shrineDestroyed: destroyed }), world);
    const events = game.submitShrineRestore("Honesty", ["Ahm", "Ahm", "Ahm"]);
    expect((game.state.shrineDestroyed ?? [])[0]).toBe(0x80); // sin pendingRestore: nada
    expect(events.some((e) => e.kind === "map-changed")).toBe(false);
  });

  it("el flujo de restauración es 0 RNG: la semilla viva no se mueve", () => {
    const game = steppedOnBrokenHonesty();
    game.reseed(4242);
    const seed0 = seedOf(game);
    game.submitShrineRestore("Honesty", ["Ahm", "Ahm", "Ahm"]);
    expect(seedOf(game)).toBe(seed0);
  });
});

/**
 * REGRESIÓN — santuario destruido pintado DINÁMICAMENTE desde g_shrine_destroyed
 * (OUTSUBS 0x0178-0x019a): el mapa estático de Britannia guarda el tile de santuario
 * VIVO (0x19) en TODAS las coords (verificado: los 7 santuarios reales = 0x19 en
 * assets/maps/overworld.json); la destrucción vive SÓLO en el bitmap g_shrine_destroyed
 * (SAVED.GAM 0x332, NO en el mapa — el .GAM son 4192 B, no lleva el overworld). El
 * original repinta 0x19→0x1a cada frame vía el detector 0x004a. El port NO lo hacía:
 * con el save real del usuario (Honesty = 0xff) el santuario salía intacto y meditaba
 * en vez de pedir restauración. Estos tests parten del mapa REAL (0x19) — a diferencia
 * del bloque de arriba, que sembraba 0x1a a mano y ENMASCARABA el bug.
 */
describe("F1.4 · swap dinámico destruido (mapa 0x19 + bitmap) — regresión REPORTE 3", () => {
  const withHonestyDestroyed = (destroyed: boolean): Game => {
    // Mapa con el tile de santuario VIVO (0x19), como el overworld shipeado.
    const world = makeWorld({ x: 101, y: 100, tile: SHRINE_TILE });
    const bits = new Array(8).fill(0);
    if (destroyed) bits[0] = 0x80; // Honesty destruido por el Shadowlord de la Falsedad
    return makeGame(makeState({ shrineDestroyed: bits }), world);
  };

  it("mapa 0x19 + bit destruido → activeMap.tileAt devuelve ruinas 0x1a", () => {
    const game = withHonestyDestroyed(true);
    expect(game.activeMap.tileAt(101, 100)).toBe(BROKEN_SHRINE_TILE);
  });

  it("mapa 0x19 SIN destruir → activeMap.tileAt devuelve el santuario 0x19 (sin tocar)", () => {
    const game = withHonestyDestroyed(false);
    expect(game.activeMap.tileAt(101, 100)).toBe(SHRINE_TILE);
  });

  it("pisar el santuario destruido (desde mapa 0x19) emite RESTORE, no meditate", () => {
    const game = withHonestyDestroyed(true);
    const events = game.move("east"); // (100,100)→(101,100): tileAt swap → 0x1a → restore
    expect(events.some((e) => e.kind === "shrine-restore-prompt")).toBe(true);
    expect(messages(events)).toEqual([]); // NO corre la ceremonia (destruido)
  });

  it("(E)nter sobre el mismo santuario SIN destruir CORRE la ceremonia (control del swap)", () => {
    const game = withHonestyDestroyed(false);
    game.move("east");
    const events = game.enter(); // F2-T6: la ceremonia cuelga del (E)nter
    expect(messages(events)).toEqual([
      "Enter the shrine of\nHonesty\n", // eco cmd_enter 0x936 (F2-T6)
      "\nThou dost approach the tranquil Shrine...\n\n", // MISCMSG 0xa59
      "...and thou dost kneel before the Altar.\n\n",
    ]); // T-003: eco + aproximación + kneel + interrogatorio
    expect(events.some((e) => e.kind === "shrine-restore-prompt")).toBe(false);
  });

  it("restaurar (limpia el bit) hace que el swap deje de aplicarse → vuelve a 0x19", () => {
    const game = withHonestyDestroyed(true);
    game.move("east"); // arma pendingRestore
    game.submitShrineRestore("Honesty", ["Ahm", "Ahm", "Ahm"]);
    expect((game.state.shrineDestroyed ?? [])[0]).toBe(0); // bit limpio
    expect(game.activeMap.tileAt(101, 100)).toBe(SHRINE_TILE); // swap ya no aplica
  });

  it("el swap dinámico es 0 RNG: leer el tile no mueve la semilla viva", () => {
    const game = withHonestyDestroyed(true);
    game.reseed(4242);
    const seed0 = seedOf(game);
    game.activeMap.tileAt(101, 100);
    expect(seedOf(game)).toBe(seed0);
  });
});
