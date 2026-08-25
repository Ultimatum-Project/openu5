/**
 * #196 — CABLEADO del robo de Faulinei al CERRAR la conversación (TALK 0x1305 → 0x1180).
 *
 * Failing-first MEDIDO: este fichero importa sólo módulos que YA existían en `main`
 * (`Game`, `TalkConsole`), así que antes del fix fallaba por la ASERCIÓN —«el inventario
 * sigue intacto y no se imprime nada»— y no por resolución de módulo
 * (failing-first-import-trap).
 *
 * El disparador del binario es INCONDICIONAL al salir del intérprete de guiones:
 * `run_scripted_conversation` 0x127E llama a 0x1180 en 0x1305, punto al que convergen los
 * tres caminos del cuerpo (0x12f9 `jne`, 0x1300 `jne`, y la caída de 0x1302). En el port
 * el embudo equivalente es `TalkConsole.end()`, al que llegan tanto el fin normal de la
 * charla (`render` sin prompt armado) como el ESC del getstring (`cancel`) — este test
 * ejercita LOS DOS.
 */
import { describe, expect, it } from "vitest";
import type { CharacterState, ExtractedInitialState, GameState } from "../src/core/state.js";
import { Game, type GameData } from "../src/core/game.js";
import type { SmallMapLocation, WorldData } from "../src/core/world/map.js";
import { TalkConsole, type TalkTarget } from "../src/ui/talk-console.js";
import type { TalkScript } from "../src/core/dialogue/conversation.js";

/** Britain: una de las 8 ciudades por las que vagan los Shadowlords (g_location 1..8). */
const TOWN = 2;

function makeChar(): CharacterState {
  return {
    name: "Avatar", gender: 0x0b, class: "A", status: "G",
    strength: 20, dexterity: 20, intelligence: 20,
    currentMp: 10, currentHp: 50, maxHp: 60, exp: 0, level: 2, monthsAtInn: 0,
    helmet: 0xff, armor: 0xff, weapon: 0xff, shield: 0xff, ring: 0xff, amulet: 0xff,
    partyStatus: 0,
  };
}

function makeWorld(): WorldData {
  const grass = Array.from({ length: 256 }, () => Array.from({ length: 256 }, () => 5));
  const tiles = (): number[][] => Array.from({ length: 32 }, () => Array.from({ length: 32 }, () => 5));
  const loc: SmallMapLocation = { id: TOWN, name: "Britain", floors: [{ z: 0, tiles: tiles() }] };
  return { overworld: grass, underworld: grass, smallMaps: new Map([[TOWN, loc]]) };
}

const gameData: GameData = {
  locationsX: Array.from({ length: 32 }, () => 100),
  locationsY: Array.from({ length: 32 }, () => 100),
  locationNames: Array.from({ length: 32 }, (_, i) => `Loc${i + 1}`),
};

function makeState(over: Partial<GameState> = {}): GameState {
  return {
    version: 1,
    characters: [makeChar()],
    partySize: 1,
    activeCharacter: 0,
    food: 100, gold: 100, keys: 0, gems: 0, torches: 0,
    equipmentQuantities: Array.from({ length: 48 }, () => 0),
    scrollQuantities: Array.from({ length: 8 }, () => 0),
    potionQuantities: Array.from({ length: 8 }, () => 0),
    reagentQuantities: Array.from({ length: 8 }, () => 0),
    karma: 40,
    time: { year: 139, month: 4, day: 7, hour: 8, minute: 35 },
    turnsSinceStart: 0,
    // Posición dentro del pueblo, fuera de la fila 4 (la celda de Yew) para que la
    // colocación del Shadowlord NO quede suprimida por la guarda TOWN 0x02bb.
    position: { location: TOWN, floor: 0, x: 15, y: 30 },
    transport: "foot",
    torchTurns: 0,
    prevHour: 8,
    npcDead: Array.from({ length: 32 }, () => [] as boolean[]),
    npcMet: Array.from({ length: 32 }, () => [] as boolean[]),
    ...over,
  } as GameState;
}

/** Guion TLK mínimo: sin keywords propias, sólo las 4 implícitas (name/job/work/bye). */
function makeScript(): TalkScript {
  const line = (text: string): { kind: "text"; text: string }[] => [{ kind: "text", text }];
  return {
    npcIndex: 0,
    name: line("Guard"),
    description: line("a guard"),
    greeting: line("Hail."),
    job: line("I guard."),
    bye: line("Farewell."),
    qa: [],
    labels: [],
  };
}

interface Harness {
  game: Game;
  console: TalkConsole;
  said: string[];
  prompts: { current: { resolve(word: string): void; cancel(): void } | null };
}

function harness(state: GameState): Harness {
  const game = new Game({} as ExtractedInitialState, makeWorld(), gameData, state);
  const said: string[] = [];
  const prompts: Harness["prompts"] = { current: null };
  const console = new TalkConsole({
    game,
    hud: {
      message: (t) => said.push(t),
      // #364-c: una línea mixta llega por tramos; el arnés registra la concatenación.
      messageSegments: (segs) => said.push(segs.map((s) => s.text).join("")),
      echoCursor: () => {},
    },
    prompts: prompts as never,
    refreshAwaiting: () => {},
    // Arnés = automatización: las pausas del guion no aparcan (mismo contrato que el
    // espejo/e2e — ver TalkConsoleDeps.instant, bug 2 talk-celda-paginacion).
    instant: () => true,
  });
  return { game, console, said, prompts };
}

/** Abre una charla y la cierra por `way`; devuelve lo que se imprimió. */
function talkAndClose(state: GameState, way: "bye" | "esc"): string[] {
  const h = harness(state);
  h.console.start({ npc: { location: TOWN, slot: 0, type: 0x50 }, script: makeScript() } as unknown as TalkTarget);
  expect(h.prompts.current, "precondición: la charla llegó a pedir keyword").not.toBeNull();
  if (way === "bye") h.prompts.current!.resolve("bye");
  else h.prompts.current!.cancel();
  expect(h.console.active, "la charla debe haber terminado").toBe(false);
  return h.said;
}

const STOLEN = "\nSomething was stolen!\n";

describe("#196 — el robo de Faulinei al cerrar cada charla", () => {
  it("★ CONTROL NEGATIVO: sin Shadowlord en la ciudad no roba ni dice nada", () => {
    // Precondición (#187): el inventario NO está vacío — lo que falta es Faulinei.
    const state = makeState({ shadowlordLocs: [0xff, 0xff, 0xff], keys: 5, gold: 100 });
    expect(state.keys + state.gold, "precondición: hay botín que robar").toBeGreaterThan(0);
    const said = talkAndClose(state, "bye");
    expect(said.join("")).not.toContain("stolen");
    expect(state.keys).toBe(5);
    expect(state.gold).toBe(100);
  });

  it("★ CONTROL NEGATIVO: con ASTAROTH (índice 1) tampoco — el gate es `== 0`, no «hay alguno»", () => {
    // El discriminador de #52 §1: `cmp [g_unk_5958],0` pregunta por la FALSEDAD, no por
    // presencia. Con Astaroth el `jne` se cumple igual que con el sentinel.
    const state = makeState({ shadowlordLocs: [0xff, TOWN, 0xff], keys: 5, gold: 100 });
    const said = talkAndClose(state, "bye");
    expect(said.join("")).not.toContain("stolen");
    expect(state.keys).toBe(5);
  });

  it("★ con FAULINEI (índice 0) toda charla acaba en robo, y lo dice", () => {
    const state = makeState({ shadowlordLocs: [TOWN, 0xff, 0xff], keys: 5, gold: 100 });
    const said = talkAndClose(state, "bye");
    expect(said, "el mensaje DS 0x94dc, byte-exacto").toContain(STOLEN);
    expect(state.keys, "1 llave menos: la cascada corta antes de llegar al oro").toBe(4);
    expect(state.gold, "…y el oro NO se toca mientras queden llaves/gemas/antorchas").toBe(100);
  });

  it("★ también al cerrar con ESC — el 0x1305 es INCONDICIONAL, no cuelga de despedirse", () => {
    const state = makeState({ shadowlordLocs: [TOWN, 0xff, 0xff], keys: 5, gold: 100 });
    const said = talkAndClose(state, "esc");
    expect(said).toContain(STOLEN);
    expect(state.keys).toBe(4);
  });

  it("★ el robo es POR CONVERSACIÓN: dos charlas, dos piezas", () => {
    const state = makeState({ shadowlordLocs: [TOWN, 0xff, 0xff], keys: 5, gold: 100 });
    talkAndClose(state, "bye");
    talkAndClose(state, "bye");
    expect(state.keys + state.gems + state.torches, "5 llaves − 2 robos").toBe(3);
  });

  it("★ FONDO DE LA CASCADA: sin llaves/gemas/antorchas ni objetos, se va el ORO (rand(1,15))", () => {
    const state = makeState({ shadowlordLocs: [TOWN, 0xff, 0xff], keys: 0, gems: 0, torches: 0, gold: 100 });
    talkAndClose(state, "bye");
    expect(state.gold, "rand(1,15) sobre 100").toBeGreaterThanOrEqual(85);
    expect(state.gold, "…y algo se llevó").toBeLessThan(100);
  });
});
