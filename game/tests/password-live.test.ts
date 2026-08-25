/**
 * F1.7-T3 · Blackthorn PASSWORD vivo (pieza C — la vía de escape del bucle de
 * captura). TALK.OVL:0x01e2 handler de guardia (dialogNum 0xFF), rama loc 0x12
 * (Palacio) 0x02a4.
 *
 * Flujo derivado del asm (re/notes/blackthorn.md §5, verified DATA.OVL):
 *  - Al hablar (T) con un guardia del Palacio (NPC dialogNumber >= 0xFD, tile 0x70)
 *    el guardia reta: `"Give now the\npassword, bearer\nof the Badge!"` (DS 0x90fc,
 *    entre comillas) + "Your response?" (DS 0x9128) y lee hasta 14 chars.
 *  - La respuesta se compara con "IMPE" (DS:0x4A9A) por strcmp CASE-INSENSITIVE
 *    (TALK:0 hace `and 0x7f`+toupper char a char) sobre los **PRIMEROS 4 chars**:
 *    0x02dc `mov byte[bp-0xc],0` escribe un NUL en buf[4] ANTES del strcmp,
 *    truncando el input a 4 → "IMPER"/"IMPERIAL"/"IMPE " PASAN, "IMP"/"XMPE" fallan
 *    (bug-for-bug; NO es igualdad exacta). Acierto → "Pass, friend!" (DS 0x913a)
 *    ret 0; fallo → ret 0x216 = 1 (escalada; el handler NO imprime, el caller
 *    opaco hostiliza).
 *  - EFECTO SOBRE LA CAPTURA — ★ REESCRITO por T-B (2026-07-30,
 *    re/notes/tc-result-producer.md §3): la pregunta «¿cómo recuerda el binario el
 *    Pass, friend?» tenía una respuesta que no era Clase C sino NEGATIVA: **no lo
 *    recuerda**. Las únicas escrituras de estado global en los 0x13b bytes de
 *    TALK 0x01e2 son `g_gold` (0x0225, 0x029d) — ni flag, ni contador, ni marca
 *    por-NPC. `ret 0` sólo evita la captura de ESA interacción. La bandera
 *    conservadora `blackthornPassGranted` queda RETIRADA, y con la insignia puesta
 *    la intercepción del turno siguiente vuelve a retar (T-A).
 *
 * ~~El gate previo `g_time_spell==0x1d` (0x587a normalmente 'Q'/'T'/0, nunca 0x1d →
 * sentinel anómalo, casi seguro el Black Badge equipado) queda ⚠️ oráculo: NO se
 * modela como pre-condición (gatearlo estrictamente sin poder derivar/rastrear el
 * estado del Badge haría el escape INALCANZABLE — valor conservador documentado).~~
 * 🔴 RANCIO, corregido en el careo insignia-impera (2026-08-24): el ⚠️ se cerró
 * ESTÁTICO por #277 — 0x1D ES la Black Badge puesta, su ÚNICO escritor es (U)se
 * Badge (CAST.OVL 0x1b47 tras «Badge worn!», port `use-tools.ts:352`) — y el gate
 * SÍ se modela como pre-condición desde entonces (`guardDemand` blackthorn.ts:680,
 * `tryTalkGuard` guard-encounters.ts:164, `checkBlackthornCapture`
 * blackthorn-capture.ts:281). Los tests #277/T-A de abajo lo EJERCEN por las dos
 * vías; el escape no quedó inalcanzable porque la insignia es obtenible y usable.
 */
import { describe, expect, it } from "vitest";
import type {
  CharacterState,
  ExtractedInitialState,
  GameState,
} from "../src/core/state.js";
import { serialize, deserialize } from "../src/core/state.js";
import { Game, type GameData, type GameEvent } from "../src/core/game.js";
import type { SmallMapLocation, WorldData } from "../src/core/world/map.js";
import { NpcManager, type NpcSlot } from "../src/core/npc/manager.js";
import { LOC_BLACKTHORN , TIME_SPELL_BADGE} from "../src/core/world/blackthorn.js";

const BT = LOC_BLACKTHORN; // 0x12 = 18

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

function makeState(over: Partial<GameState> = {}): GameState {
  const base: Partial<GameState> = {
    version: 1,
    characters: [makeChar({ name: "Avatar" }), makeChar({ name: "Iolo" })],
    partySize: 2,
    activeCharacter: 0,
    food: 100,
    gold: 100,
    keys: 5,
    gems: 3,
    torches: 2,
    equipmentQuantities: Array.from({ length: 48 }, () => 0),
    // #277: el reto de password EXIGE la Black Badge puesta (gate g_time_spell==0x1d,
    // TALK 0x02a4) — sin ella el binario salta a la rama sin password.
    timeSpell: TIME_SPELL_BADGE,
    karma: 40,
    time: { year: 139, month: 4, day: 7, hour: 8, minute: 35 },
    turnsSinceStart: 0,
    position: { location: BT, floor: 0, x: 5, y: 5 },
    transport: "foot",
    torchTurns: 3,
    prevHour: 8,
    npcDead: Array.from({ length: 32 }, () => [] as boolean[]),
    npcMet: Array.from({ length: 32 }, () => [] as boolean[]),
  };
  return { ...base, ...over } as GameState;
}

function makeLocation(id: number, name: string): SmallMapLocation {
  const tiles = Array.from({ length: 32 }, () => Array.from({ length: 32 }, () => 5));
  return { id, name, floors: [{ z: 0, tiles }, { z: 1, tiles }, { z: 2, tiles }] };
}

function makeWorld(): WorldData {
  const overworld = Array.from({ length: 256 }, () =>
    Array.from({ length: 256 }, () => 5),
  );
  return {
    overworld,
    underworld: overworld,
    smallMaps: new Map([[BT, makeLocation(BT, "Palace of Blackthorn")]]),
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

/** Un guardia (tile/type 0x70=112, dialogNumber 0xFF) fijo en (gx,gy) floor 0. */
function guardSlot(gx: number, gy: number): NpcSlot {
  return {
    slot: 1,
    // #64 (ruling): `[4,4,4]` con `times` a 0 => ranura 0 a cualquier hora => aiType 4 =
    // ARMADO siempre. El dato REAL de los guardias es `[0,4,0]`/`times [21,5,11,13]`, pero
    // meterlo aquí haría del HORARIO una precondición de una suite que estudia el PASSWORD.
    // El horario tiene sus propios tests en capture-live.test.ts.
    aiTypes: [4, 4, 4],
    x: [gx, gx, gx],
    y: [gy, gy, gy],
    z: [0, 0, 0],
    times: [0, 0, 0, 0],
    type: 0x70,
    dialogNumber: 0xff,
  };
}

/** Game con un NpcManager real y un guardia adyacente al norte del party (5,4). */
function makeGuardGame(s: GameState = makeState()): Game {
  const npcData: Record<number, NpcSlot[]> = { [BT]: [guardSlot(5, 4)] };
  const mgr = new NpcManager(npcData);
  return new Game({} as ExtractedInitialState, makeWorld(), gameData, s, {
    npcManager: mgr,
  });
}

function makeGame(s: GameState = makeState()): Game {
  return new Game({} as ExtractedInitialState, makeWorld(), gameData, s);
}

const promptOf = (events: GameEvent[], kind: string): GameEvent | undefined =>
  events.find((e) => e.kind === kind);

const messages = (events: GameEvent[]): string[] =>
  events.filter((e) => e.kind === "message").map((e) => e.text ?? "");

describe("F1.7-T3 — Blackthorn password (TALK 0x02a4, pieza C)", () => {
  it("TALK a un guardia del Palacio abre el prompt del password con el reto verbatim del Badge", () => {
    const game = makeGuardGame();
    const events = game.tryTalkGuard("north") ?? [];

    const prompt = promptOf(events, "blackthorn-guard-password-prompt");
    expect(prompt).toBeDefined();
    // DS 0x90fc (entre comillas 0x2ae/0x2bc): "Give now the password, bearer of the Badge!"
    expect(prompt?.text).toContain("Give now the");
    expect(prompt?.text).toContain("bearer");
    expect(prompt?.text).toContain("of the Badge!");
  });

  it("tryTalkGuard NO dispara fuera de loc 0x12 (el password es gate por location)", () => {
    const game = makeGuardGame(makeState({ position: { location: 13, floor: 0, x: 5, y: 5 } }));
    expect(game.tryTalkGuard("north")).toBeNull();
  });

  it("tryTalkGuard NO dispara sin guardia adyacente (dirección vacía)", () => {
    const game = makeGuardGame();
    expect(game.tryTalkGuard("south")).toBeNull(); // el guardia está al norte
  });

  it('password "IMPE" correcto → "Pass, friend!" y ESTE turno no hay captura', () => {
    const game = makeGuardGame();
    game.tryTalkGuard("north");
    const out = game.submitGuardPassword("IMPE");

    expect(messages(out).some((t) => t.includes("Pass, friend!"))).toBe(true);
    expect(game.state.position.x).toBe(5); // no depositado en (10,7)
  });

  it("T-B — acertar NO concede pase: el turno siguiente el guardia RE-RETA", () => {
    // TALK 0x01e2 no escribe flag alguno (sus únicas escrituras globales son
    // `g_gold`, 0x0225/0x029d). Con la insignia puesta, la intercepción del turno
    // siguiente vuelve a retar (T-A) en vez de dejar pasar.
    const game = makeGuardGame();
    game.tryTalkGuard("north");
    game.submitGuardPassword("IMPE");
    const turn = game.confirmTownExit(false);
    expect(promptOf(turn, "blackthorn-guard-password-prompt")).toBeDefined();
  });

  it("★ password erróneo por (T)alk → ARRESTA en el acto (ruling 30-07)", () => {
    // La escalada de guard_demand la propagan TALK 0x031E (0x03e2) y TALK 0x041c
    // (0x04c8) hasta el dispatcher, que escribe result=2 (kernel 0x3403); npc_engine
    // entra con [bp+4]==1 y 0x13b4 `jne` salta DIRECTO a 0x13d6 → TOWN 0x12ae.
    const game = makeGuardGame();
    game.tryTalkGuard("north");
    const out = game.submitGuardPassword("MELLON");
    expect(promptOf(out, "blackthorn-interrogation-prompt")).toBeDefined();
  });

  it("el match es CASE-INSENSITIVE (strcmp toupper, TALK:0)", () => {
    for (const pw of ["impe", "Impe", "iMpE", "IMPE"]) {
      const game = makeGuardGame();
      game.tryTalkGuard("north");
      const out = game.submitGuardPassword(pw);
      expect(messages(out).some((t) => t.includes("Pass, friend!"))).toBe(true);
    }
  });

  it("el match es sobre los PRIMEROS 4 chars (0x02dc trunca el buffer a 4: buf[4]=0)", () => {
    for (const pw of ["IMPER", "IMPERIAL", "IMPE ", "impe rial"]) {
      const game = makeGuardGame();
      game.tryTalkGuard("north");
      const out = game.submitGuardPassword(pw);
      expect(messages(out).some((t) => t.includes("Pass, friend!"))).toBe(true);
    }
    for (const pw of ["IMP", "XMPE"]) {
      const game = makeGuardGame();
      game.tryTalkGuard("north");
      const out = game.submitGuardPassword(pw);
      // Fallo ⇒ ret 1 ⇒ arresto: NO hay "Pass, friend!", y la escena de captura sí.
      expect(messages(out).some((t) => t.includes("Pass, friend!"))).toBe(false);
      expect(promptOf(out, "blackthorn-interrogation-prompt")).toBeDefined();
    }
  });

  it("#277 residuo (capa de PROMPT) — sin insignia el guardia NI PREGUNTA: el reto no se imprime ni se arma la máquina", () => {
    // TALK 0x02a4 `cmp [g_time_spell],0x1d` corre ANTES del print del reto (0x2ae):
    // sin insignia `jmp 0x216` = `mov ax,1 / ret` — ret 1 SILENCIOSO, ni reto ni texto.
    const game = makeGuardGame(makeState({ timeSpell: undefined }));
    const events = game.tryTalkGuard("north");
    // El talk SÍ se consume (no es null → main.ts no cae a "Funny, no response!")…
    expect(events).toEqual([]);
    // …pero la máquina de password NO queda armada: un submit posterior es no-op.
    expect(game.submitGuardPassword("IMPE")).toEqual([]);
  });

  it("#277 — SIN la Black Badge puesta el reto NI SE ARMA, así que no hay escalada por (T)alk", () => {
    // El gate 0x02a4 corta ANTES del print (0x02ae), así que `tryTalkGuard` devuelve
    // [] sin armar la máquina: el submit posterior es no-op. La escalada por (T)alk
    // sólo existe habiendo reto que fallar.
    const game = makeGuardGame(makeState({ timeSpell: undefined }));
    game.tryTalkGuard("north");
    expect(game.submitGuardPassword("IMPE")).toEqual([]);
  });

  it("submitGuardPassword es idempotente sin prompt activo", () => {
    const game = makeGuardGame();
    expect(game.submitGuardPassword("IMPE")).toEqual([]);
  });

  it("baseline SIN insignia: el guardia adyacente dispara la captura", () => {
    const game = makeGuardGame(makeState({ timeSpell: undefined }));
    const turn = game.confirmTownExit(false);
    expect(promptOf(turn, "blackthorn-interrogation-prompt")).toBeDefined();
  });

  it("T-B — no hay pase que serializar: tras save/load el guardia vuelve a retar", () => {
    const game = makeGuardGame();
    game.tryTalkGuard("north");
    game.submitGuardPassword("IMPE");

    const reloaded = deserialize(serialize(game.state));
    expect((reloaded as unknown as Record<string, unknown>).blackthornPassGranted).toBeUndefined();
    const game2 = makeGuardGame(reloaded);
    const turn = game2.confirmTownExit(false);
    expect(promptOf(turn, "blackthorn-guard-password-prompt")).toBeDefined();
  });

  // ── T-A EN LA INTERCEPCIÓN (careo insignia-impera, F2 cabos-ad) ────────────
  // La vía del tren #134: no el comando (T)alk sino la PASADA DE NPCs — npc_engine
  // 0x13b4 con result==1 llama a TALK 0x031E → guard_demand 0x01e2, cuyo primer
  // gate en loc 0x12 es la insignia (0x02a4). El crudo del LP (ad_ep12:6728-6740)
  // enseña EXACTAMENTE esto: re-entra al palacio con la insignia puesta, un guardia
  // le para y le RETA («bearer of the Badge!» → IMPERA → «Pass, friend!») en vez de
  // capturarlo en silencio. Los tres testigos siguientes fijan la clase entera con
  // esperados en crudo.

  it("T-A intercepción — CON insignia la primera adyacencia RETA el password (no captura muda)", () => {
    const game = makeGuardGame(); // makeState trae timeSpell = TIME_SPELL_BADGE
    const turn = game.confirmTownExit(false);
    const prompt = promptOf(turn, "blackthorn-guard-password-prompt");
    expect(prompt).toBeDefined();
    // Reto EN CRUDO — DATA.OVL fileoff 0x910c = DS 0x90fc, verificado byte a byte:
    expect(prompt?.text).toContain("Give now the\npassword, bearer\nof the Badge!");
    // Sin captura: ni interrogatorio ni depósito ni confiscación.
    expect(promptOf(turn, "blackthorn-interrogation-prompt")).toBeUndefined();
    expect(game.state.position.x).toBe(5);
    expect(game.state.position.y).toBe(5);
    expect(game.state.keys).toBe(5);
  });

  it("T-A intercepción — IMPERA correcto → «Pass, friend!» y libre ese turno (sin depósito)", () => {
    const game = makeGuardGame();
    game.confirmTownExit(false); // arma el reto de la intercepción
    const out = game.submitGuardPassword("IMPERA"); // el LP tecleó la palabra ENTERA (ad_ep12:6737)
    // DS 0x913a en crudo; el truncado a 4 (0x02dc) hace pasar "IMPERA" por "IMPE".
    expect(messages(out).some((t) => t.includes("Pass, friend!"))).toBe(true);
    expect(promptOf(out, "blackthorn-interrogation-prompt")).toBeUndefined();
    expect(game.state.position.x).toBe(5);
    expect(game.state.keys).toBe(5);
  });

  it("T-A intercepción — fallar el reto ESCALA a la captura (ret 1 → npc_engine 0x13d6 → TOWN 0x12ae)", () => {
    const game = makeGuardGame();
    game.confirmTownExit(false);
    const out = game.submitGuardPassword("MELLON");
    expect(messages(out).some((t) => t.includes("Pass, friend!"))).toBe(false);
    // La escena de captura: la venda (DATA.OVL 0x6fbc, mismo texto que la vía sin
    // insignia — con insignia el fallo cuesta LO MISMO que no llevarla) + trono.
    expect(messages(out).some((t) => t.includes("Thou art subdued and blindfolded!"))).toBe(true);
    expect(promptOf(out, "blackthorn-interrogation-prompt")).toBeDefined();
  });

  it("T-B — un pase HEREDADO de un save viejo ya no suprime la captura", () => {
    const legacy = makeState({ timeSpell: undefined, shrineDestroyed: Array.from({ length: 8 }, () => 0xff) });
    (legacy as unknown as Record<string, unknown>).blackthornPassGranted = true;
    const game = makeGuardGame(legacy);
    const turn = game.confirmTownExit(false);
    // 8 santuarios caídos → sin interrogatorio, DEPÓSITO directo: llaves confiscadas.
    expect(promptOf(turn, "blackthorn-interrogation-prompt")).toBeUndefined();
    expect(game.state.keys).toBe(0);
  });
});
