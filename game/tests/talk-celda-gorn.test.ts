/**
 * Carril talk-celda-paginacion — los DOS bugs de la conversación con el compañero de
 * celda de Blackthorn (Gorn, CASTLE.TLK npcIndex 11), evidencia del usuario en móvil
 * (captura carcel-talk-error.jpeg: «Get all that down? / You respond- :yes / Get the
 * keys I hid in the brazier and let's be off! / System Error - No Match!», todo el
 * volcado de golpe).
 *
 * BUG 1 — «System Error - No Match!»: la string ES del binario (DATA.OVL DS 0x93A8,
 * un rótulo de error de desarrollador que EA publicó), pero su vía es SOLO el no-match
 * real de `join_party` (TALK.OVL 0x08a4: nombre AUSENTE del roster). Con el NPC YA en
 * la party, el barrido 0x086d-0x08a2 (ranuras 15..1, sin filtrar por partyStatus) lo
 * ENCUENTRA y toma la vía found 0x08c8: `ret 1` SIN texto + despawn del NPC del mapa
 * (0x0916 `push [0xbcdc]; call 0xbb86` = TOWN 0x0052 npc_dead_bit_set + 0x091d `call
 * 0xbb92` = TOWN 0x00B0 npc_clear_slot — resoluciones de thunk citadas en
 * re/notes/trama-140-acta.md y re/notes/get-alfombra-346.md). El port ni despawneaba
 * al alistar (Gorn seguía pintado en su celda) ni distinguía «ya alistado» de
 * «inexistente»: re-hablarle imprimía el System Error. Fix: outcome `already`
 * (silencio + fin + despawn; el swap corrupto del binario es Clase C y no se calca)
 * y `despawnNpc` señalado también en `joined`.
 *
 * BUG 2 — paginación: el kernel de texto de TALK NO cuenta líneas (el intérprete
 * talk_process_byte 0x0f32 imprime carácter a carácter); la paginación es de AUTORÍA
 * del guion, con DOS opcodes que el port marcaba (`flushLine(true)`) y NINGUNA capa
 * honraba (el flag `pause` no tenía consumidor — el volcado salía entero de golpe):
 *   · 0x8F KeyWait → TALK 0x1010 `call 0x66ec` = kernel getkey 0x266c (TALK ve el
 *     kernel con +0x4080; control positivo del mapeo: 0x7F70→0x3ef0 y 0x7FB6→0x3f36
 *     ya resueltos en effects.ts/#283). BLOQUEA hasta cualquier tecla, cursor animado
 *     (0x267f call 0x1b38, la clase de #341 §7.2).
 *   · 0x83 Pause → bucle TALK 0x0f92-0x0fb3: hasta 0x1c (28) ticks INT 1Ch (~54,9 ms)
 *     sondeando el teclado — auto-avanza sola (~1,54 s), una tecla la corta, sin cursor.
 * Fix: el core emite `pause: "key" | "timed"` y TalkConsole aparca el RESTO del volcado
 * (patrón ShrineKeyPacer #294, con `instant` bajo automatización).
 *
 * Esperados EN CRUDO del guion real: assets/talk/castle.json npcIndex 11 (extraído de
 * CASTLE.TLK offset 0x15c7-0x180f; el opcode crudo va tras «off!»: a2 8d 8d 84 =
 * StartNewSection NL NL JoinParty). Este fichero LEE assets ⇒ está excluido de
 * vitest.pure.config.ts.
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { CharacterState, ExtractedInitialState, GameState } from "../src/core/state.js";
import { Game, type GameData } from "../src/core/game.js";
import type { SmallMapLocation, WorldData } from "../src/core/world/map.js";
import { TalkConsole, type TalkTarget } from "../src/ui/talk-console.js";
import {
  Conversation,
  type DialogueOutput,
  type TalkScript,
} from "../src/core/dialogue/conversation.js";
import { applyDialogueEffect } from "../src/core/dialogue/effects.js";
import { partyMembers } from "../src/core/party.js";

/** Palacio de Blackthorn para el arnés (el id sólo ancla state/npc en el MISMO mapa). */
const PALACE = 18;
/** Slot del NPC de Gorn en el arnés (el bit de npcDead se asierta sobre él). */
const GORN_SLOT = 11;

const SYSTEM_ERROR = "System Error";
const BRAZIER_LINE = "Get the keys I hid in the brazier and let's be off! ";

function gornScript(): TalkScript {
  const scripts = JSON.parse(
    readFileSync(fileURLToPath(new URL("../assets/talk/castle.json", import.meta.url)), "utf8"),
  ) as TalkScript[];
  const s = scripts.find((x) => x.npcIndex === 11);
  if (!s) throw new Error("castle.json sin npcIndex 11 (Gorn)");
  return s;
}

function makeChar(name: string, partyStatus: number): CharacterState {
  return {
    name, gender: 0x0b, class: "F", status: "G",
    strength: 20, dexterity: 20, intelligence: 20,
    currentMp: 10, currentHp: 50, maxHp: 60, exp: 0, level: 2, monthsAtInn: 0,
    helmet: 0xff, armor: 0xff, weapon: 0xff, shield: 0xff, ring: 0xff, amulet: 0xff,
    partyStatus,
  } as CharacterState;
}

function makeWorld(): WorldData {
  const grass = Array.from({ length: 256 }, () => Array.from({ length: 256 }, () => 5));
  const tiles = (): number[][] =>
    Array.from({ length: 32 }, () => Array.from({ length: 32 }, () => 5));
  const loc: SmallMapLocation = { id: PALACE, name: "Palace", floors: [{ z: 0, tiles: tiles() }] };
  return { overworld: grass, underworld: grass, smallMaps: new Map([[PALACE, loc]]) };
}

const gameData: GameData = {
  locationsX: Array.from({ length: 32 }, () => 100),
  locationsY: Array.from({ length: 32 }, () => 100),
  locationNames: Array.from({ length: 32 }, (_, i) => `Loc${i + 1}`),
};

/** Estado mínimo; `gornInParty` reproduce la foto de la captura (Gorn ya reclutado). */
function makeState(gornInParty: boolean): GameState {
  return {
    version: 1,
    characters: [makeChar("Avatar", 0), makeChar("Gorn", gornInParty ? 0 : 0xff)],
    partySize: gornInParty ? 2 : 1,
    activeCharacter: 0,
    food: 100, gold: 100, keys: 0, gems: 0, torches: 0,
    equipmentQuantities: Array.from({ length: 48 }, () => 0),
    scrollQuantities: Array.from({ length: 8 }, () => 0),
    potionQuantities: Array.from({ length: 8 }, () => 0),
    reagentQuantities: Array.from({ length: 8 }, () => 0),
    karma: 40,
    time: { year: 139, month: 4, day: 7, hour: 8, minute: 35 },
    turnsSinceStart: 0,
    position: { location: PALACE, floor: 0, x: 15, y: 30 },
    transport: "foot",
    torchTurns: 0,
    prevHour: 8,
    npcDead: Array.from({ length: 32 }, () => [] as boolean[]),
    npcMet: Array.from({ length: 32 }, () => [] as boolean[]),
    // Sin Shadowlords: el robo de Faulinei del end() (#196) no ensucia los asertos.
    shadowlordLocs: [0xff, 0xff, 0xff],
  } as GameState;
}

interface Harness {
  game: Game;
  state: GameState;
  console: TalkConsole;
  said: string[];
  prompts: { current: { resolve(word: string): void; cancel(): void } | null };
}

/** Arnés de TalkConsole (patrón faulinei-theft-live) con `instant` CONMUTABLE (bug 2). */
function harness(state: GameState, instant: boolean): Harness {
  const game = new Game({} as ExtractedInitialState, makeWorld(), gameData, state);
  const said: string[] = [];
  const prompts: Harness["prompts"] = { current: null };
  const console = new TalkConsole({
    game,
    hud: {
      message: (t) => said.push(t),
      messageSegments: (segs) => said.push(segs.map((s) => s.text).join("")),
      echoCursor: () => {},
    },
    prompts: prompts as never,
    refreshAwaiting: () => {},
    instant: () => instant,
  });
  return { game, state, console, said, prompts };
}

/** Gorn como TalkTarget del arnés: tile de PERSONA (fam <0x80, ≠0x70 — pasa el gate
 *  de npc_dead_bit_set TOWN 0x0073-0x0082) en el MISMO mapa que el estado. */
function gornTarget(): TalkTarget {
  return {
    npc: { location: PALACE, slot: GORN_SLOT, type: 0x50 },
    script: gornScript(),
  } as unknown as TalkTarget;
}

/** Conduce la charla completa de la captura (T → yes → yes → [esperas] → yes). Con
 *  `instant=false` suelta cada espera aparcada con una tecla, contándolas. */
function fullConversation(h: Harness, target: TalkTarget): { waits: number } {
  let waits = 0;
  const drain = (): void => {
    while (h.console.keyWaiting) {
      waits++;
      h.console.consumeKey();
    }
  };
  h.console.start(target);
  drain();
  for (const word of ["yes", "yes", "yes"]) {
    if (!h.prompts.current) break;
    const p = h.prompts.current;
    h.prompts.current = null;
    p.resolve(word);
    drain();
  }
  return { waits };
}

// ─────────────────────────────────────────────────────────────────────────────────────
// BUG 1 — nivel Conversation/efectos: la charla EXACTA de la captura, guion real.
// ─────────────────────────────────────────────────────────────────────────────────────

describe("bug 1 — compañero de celda ya reclutado: yes final SIN «System Error - No Match!»", () => {
  it("★ el guion real llega al opcode JoinParty tras el yes a «Get all that down?»", () => {
    const c = new Conversation(gornScript(), {
      avatarName: "Avatar",
      npcKnowsAvatar: false,
      tr: (s) => s,
    });
    const out: DialogueOutput[] = [];
    out.push(...c.start());
    for (const w of ["yes", "yes", "yes"]) out.push(...c.input(w));
    const lines = out.filter((o) => o.kind === "line").map((o) => o.text);
    // Esperados EN CRUDO del guion (castle.json npc 11, extraído de CASTLE.TLK):
    expect(lines.join("|")).toContain("Get all that down?");
    expect(lines.join("|")).toContain(BRAZIER_LINE);
    const effects = out.filter((o) => o.kind === "effect").map((o) => o.effect.kind);
    expect(effects).toContain("joinParty"); // 84 crudo tras «off!» (a2 8d 8d 84)
  });

  it("★ TESTIGO de la captura: Gorn EN party → charla completa, cero System Error, y el bit npcDead del slot queda puesto (TALK 0x0916)", () => {
    const h = harness(makeState(true), true);
    fullConversation(h, gornTarget());
    const texto = h.said.join("|");
    expect(texto).toContain(BRAZIER_LINE); // la respuesta del guion SÍ se imprime
    expect(texto).not.toContain(SYSTEM_ERROR); // …y el rótulo DS 0x93A8 NO
    expect(h.console.active, "la conversación TERMINA (ret 1 de la vía found)").toBe(false);
    // El despawn PERSISTENTE (npc_dead_bit_set): enterMap ya filtra este bit — Gorn no
    // vuelve a aparecer en la celda, que es como el binario hace inalcanzable re-hablarle.
    expect(h.state.npcDead[PALACE - 1]?.[GORN_SLOT]).toBe(true);
    // Y el roster NI SE MUEVE (la corrupción del swap del binario es Clase C, no se calca).
    expect(h.state.partySize).toBe(2);
    expect(partyMembers(h.state).map((c) => c.name)).toEqual(["Avatar", "Gorn"]);
  });

  it("★ CONTROL POSITIVO: Gorn NO reclutado → el mismo yes lo alista, sin System Error, con despawn", () => {
    const h = harness(makeState(false), true);
    fullConversation(h, gornTarget());
    expect(h.said.join("|")).not.toContain(SYSTEM_ERROR);
    expect(h.state.partySize).toBe(2);
    expect(partyMembers(h.state).map((c) => c.name)).toContain("Gorn");
    expect(h.state.npcDead[PALACE - 1]?.[GORN_SLOT]).toBe(true);
  });

  it("el no-match REAL (nombre ausente del roster) CONSERVA el rótulo DS 0x93A8 y NO despawnea", () => {
    // La vía 0x08a4 del binario sigue intacta: el fix no la vació (regla del aserto que
    // sólo niega lo incorrecto — aquí se AFIRMA el rasgo que debe sobrevivir).
    const s = makeState(false);
    const r = applyDialogueEffect(s, { kind: "joinParty" }, "Batlin");
    expect(r.messages).toEqual(["\nSystem Error -\nNo Match!"]);
    expect(r.ended).toBe(true);
    expect(r.despawnNpc ?? false).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────────────────────
// BUG 2 — las pausas del guion en TalkConsole (aparcar/reanudar).
// ─────────────────────────────────────────────────────────────────────────────────────

describe("bug 2 — paginación del guion TLK (KeyWait 0x8F / Pause 0x83)", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("★ el core distingue las DOS clases: Pause→'timed' (saludo) y KeyWait→'key' (ruta de escape, SEIS)", () => {
    const c = new Conversation(gornScript(), {
      avatarName: "Avatar",
      npcKnowsAvatar: false,
      tr: (s) => s,
    });
    const out: DialogueOutput[] = [...c.start()];
    const timed = out.filter((o) => o.kind === "line" && o.pause === "timed");
    expect(timed, "el 0x83 entre «…my cell!» y «With me for an escape?»").toHaveLength(1);
    out.length = 0;
    out.push(...c.input("yes")); // → label 1 (sin pausas)
    expect(out.some((o) => o.kind === "line" && o.pause)).toBe(false);
    out.length = 0;
    out.push(...c.input("yes")); // → labels 2+3: la ruta de escape entera
    const keys = out.filter((o) => o.kind === "line" && o.pause === "key");
    // EN CRUDO del guion: 1 KeyWait en label 2 + 5 en label 3 = 6 (bytes 8f de
    // CASTLE.TLK 0x15c7-0x180f).
    expect(keys).toHaveLength(6);
  });

  it("★ TESTIGO del volcado largo: sin `instant` la charla aparca SIETE veces y cada tecla suelta una", () => {
    const h = harness(makeState(true), false);
    const target = gornTarget();
    h.console.start(target);
    // El saludo aparca en el Pause (0x83): cronometrada ⇒ keyWaiting SÍ, cursor NO.
    expect(h.console.keyWaiting).toBe(true);
    expect(h.console.cursorWaiting, "Pause no pasa por getkey 0x266c ⇒ sin cursor").toBe(false);
    // «With me for an escape?» AÚN no se ha impreso: el resto del volcado está aparcado.
    expect(h.said.join("|")).not.toContain("With me for an escape?");
    expect(h.prompts.current).toBeNull();
    const { waits } = fullConversation2(h);
    // 1 Pause del saludo (ya contada aparte) + 6 KeyWaits = las 7 esperas del guion.
    expect(waits + 1).toBe(7);
    expect(h.said.join("|")).toContain(BRAZIER_LINE);
    expect(h.said.join("|")).not.toContain(SYSTEM_ERROR);
    expect(h.console.active).toBe(false);
  });

  /** Continúa la charla del testigo largo tras el primer aparcamiento ya asertado. */
  function fullConversation2(h: Harness): { waits: number } {
    let waits = 0;
    const drain = (): void => {
      while (h.console.keyWaiting) {
        // Los KeyWait de la ruta de escape llevan el cursor del bucle 0x266c.
        waits++;
        h.console.consumeKey();
      }
    };
    h.console.consumeKey(); // suelta el Pause del saludo
    drain();
    for (const word of ["yes", "yes", "yes"]) {
      if (!h.prompts.current) break;
      const p = h.prompts.current;
      h.prompts.current = null;
      p.resolve(word);
      drain();
    }
    return { waits };
  }

  it("los KeyWait de la ruta de escape SÍ llevan cursor (bucle 0x266c)", () => {
    const h = harness(makeState(true), false);
    h.console.start(gornTarget());
    h.console.consumeKey(); // Pause del saludo
    // (el prompt vivo se captura ANTES de anular: resolve re-arma el siguiente en línea)
    let p = h.prompts.current!;
    h.prompts.current = null;
    p.resolve("yes");
    // (label 1 no tiene pausas: el prompt se re-armó sin aparcar)
    p = h.prompts.current!;
    h.prompts.current = null;
    p.resolve("yes");
    expect(h.console.keyWaiting).toBe(true);
    expect(h.console.cursorWaiting, "KeyWait espera en getkey 0x266c ⇒ cursor animado").toBe(true);
  });

  it("★ la Pause CRONOMETRADA auto-avanza sola a los 28 ticks (~1538 ms) sin tecla", () => {
    vi.useFakeTimers();
    const h = harness(makeState(true), false);
    h.console.start(gornTarget());
    expect(h.console.keyWaiting).toBe(true);
    expect(h.said.join("|")).not.toContain("With me for an escape?");
    vi.advanceTimersByTime(1538); // TALK 0x0fae: 0x1c vueltas de delay(1) INT 1Ch
    expect(h.console.keyWaiting, "el guion siguió solo").toBe(false);
    expect(h.said.join("|")).toContain("With me for an escape?");
    expect(h.prompts.current, "y el prompt de la pregunta quedó armado").not.toBeNull();
  });

  it("★ CONTROL POSITIVO: un diálogo corto (sin opcodes de pausa) NO aparca nunca", () => {
    const short: TalkScript = {
      npcIndex: 1,
      name: [{ kind: "text", text: "Guard" }],
      description: [{ kind: "text", text: "a guard." }],
      greeting: [{ kind: "text", text: "Hail." }],
      job: [{ kind: "text", text: "I guard." }],
      bye: [{ kind: "text", text: "Farewell." }],
      qa: [],
      labels: [],
    };
    const h = harness(makeState(true), false); // instant=false: si aparcara, se vería
    h.console.start({
      npc: { location: PALACE, slot: 1, type: 0x50 },
      script: short,
    } as unknown as TalkTarget);
    expect(h.console.keyWaiting).toBe(false);
    expect(h.prompts.current, "fue directo al prompt de keyword").not.toBeNull();
  });

  it("bajo automatización (`instant`) el guion CON pausas drena de una — el contrato de los sellos", () => {
    const h = harness(makeState(true), true);
    h.console.start(gornTarget());
    expect(h.console.keyWaiting).toBe(false);
    expect(h.said.join("|")).toContain("With me for an escape?");
    expect(h.prompts.current).not.toBeNull();
  });
});
