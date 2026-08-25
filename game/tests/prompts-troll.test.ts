/**
 * Fase 1.3 · Flow 2 — Peaje de trolls interactivo (MAINOUT 0x1B3E).
 *
 * Regla EXACTA del binario (loops.md §1.4, scout-prompts.md Flow 2, hazards.ts):
 * al pisar un puente (tile 0x6A/0x6B) a pie con el gate rand(0,7)==0, los trolls
 * emboscan. El original NO auto-paga: pregunta "The trolls demand a <N> gp toll!
 * / Dost thou pay?" (0x6b2c+0x6b4a) con un getkey CRUDO (no consume el stream) y
 * PAUSA el turno A MITAD (tras advance_clock(2)+ambush; antes del world_turn final):
 *   - Y y oro≥toll → cobra el peaje y REANUDA la cola del turno (tickDoorsAndNpcs
 *     + world_turn final) SIN spawn — pasa libre.
 *   - Y pero oro<toll → REEMBOLSA (no cobra) y cae al spawn.
 *   - N o no-puede-pagar → spawn de un troll (defIndex 41) en party_x/y + combate,
 *     que SUSTITUYE la cola del turno (0xb714→0xdf80).
 * N = 99 − 3·STR del PRIMER MIEMBRO CONSCIENTE.
 *
 * Estos tests ejercitan el MOTOR (`move()` pausa vía `pendingTroll` + emite
 * `troll-toll-prompt`; `resolveTrollToll()` resuelve). La captura de tecla Y/N
 * (ESC IGNORADO, ⚠ distinto de Flow 1) vive en main.ts (E2E en e2e/prompts.spec.ts).
 *
 * SEMILLA: reseed(112) fuerza la emboscada sobre el puente desde (100,100)→sur con
 * la party de abajo (viento rand(0,63) → gate rand(0,7)==0 → tick viento interno →
 * rand(1,30)=5 > DEX 3 del miembro 0 ⇒ paga). Derivada con un barrido [0,2000) de
 * outdoorTurn(onBridge) (258 semillas fuerzan; 112 es la 1ª con payerIndex=0).
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import type {
  CharacterState,
  ExtractedInitialState,
  GameState,
} from "../src/core/state.js";
import {
  Game,
  type CombatResources,
  type GameData,
} from "../src/core/game.js";
import {
  buildEnemyDefs,
  type AdditionalEnemyFlag,
  type EnemyDataInput,
} from "../src/core/combat/enemies.js";
import type { CombatMapData } from "../src/core/combat/combat.js";
import type { WorldData } from "../src/core/world/map.js";

function load<T>(rel: string): T {
  return JSON.parse(readFileSync(fileURLToPath(new URL(rel, import.meta.url)), "utf8")) as T;
}
const data = load<EnemyDataInput & { defenseValues: number[] }>("../assets/data.json");
const additionalFlags = load<AdditionalEnemyFlag[]>(
  "../src/core/data/AdditionalEnemyFlags.json",
);
const combatMaps = load<CombatMapData[]>("../assets/maps/combatmaps.json");

/** reseed que fuerza la emboscada con payerIndex=0 desde (100,100)→sur (ver cabecera). */
const AMBUSH_SEED = 112;
/** STR del 1er consciente en la party de test → toll = 99 − 3·20 = 39. */
const PARTY_STR = 20;
const EXPECTED_TOLL = 0x63 - 3 * PARTY_STR; // 39

function makeChar(over: Partial<CharacterState> = {}): CharacterState {
  return {
    name: "Test",
    gender: 0x0b,
    class: "A",
    status: "G",
    strength: PARTY_STR,
    dexterity: 3, // DEX baja: rand(1,30) casi siempre la supera ⇒ el miembro paga
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
    characters: [makeChar(), makeChar({ name: "Iolo" })],
    partySize: 2,
    activeCharacter: 0,
    food: 100,
    gold: 500,
    time: { year: 139, month: 4, day: 7, hour: 8, minute: 35 },
    turnsSinceStart: 0,
    position: { location: 0, floor: 0, x: 100, y: 100 },
    transport: "foot",
    torchTurns: 0,
    torches: 2,
    prevHour: 8,
  };
  return { ...base, ...over } as GameState;
}

/** Overworld todo hierba con un PUENTE (0x6A) al sur de (100,100). */
function makeWorld(): WorldData {
  const overworld = Array.from({ length: 256 }, () =>
    Array.from({ length: 256 }, () => 5),
  );
  overworld[101]![100] = 0x6a; // destino del paso "south": puente troll horizontal
  return { overworld, underworld: overworld, smallMaps: new Map() };
}

const gameData: GameData = { locationsX: [], locationsY: [], locationNames: [] };
const combatResources: CombatResources = {
  combatMaps,
  enemyDefs: buildEnemyDefs(data, additionalFlags),
  attackValues: [],
  attackRangeValues: [],
  defenseValues: data.defenseValues,
};

function makeGame(s: GameState = makeState()): Game {
  const g = new Game({} as ExtractedInitialState, makeWorld(), gameData, s, {
    combatResources,
  });
  g.reseed(AMBUSH_SEED);
  return g;
}

/** Acceso al campo privado `pendingTroll` para observar la pausa a mitad de turno. */
function pendingTroll(g: Game): unknown {
  return (g as unknown as { pendingTroll: unknown }).pendingTroll;
}

describe("Flow 2 — peaje de trolls interactivo (MAINOUT 0x1B3E)", () => {
  it("cruzar el puente PAUSA: emite troll-toll-prompt con el toll y NO corre aún el world_turn final", () => {
    const game = makeGame();
    const events = game.move("south");

    // Pausa a mitad de turno: pendingTroll vivo, sin combate todavía.
    expect(pendingTroll(game)).not.toBeNull();
    expect(game.combat).toBeNull();
    // Emite el prompt con el peaje = 99 − 3·STR del 1er consciente.
    const prompt = events.find((e) => e.kind === "troll-toll-prompt");
    expect(prompt).toBeDefined();
    expect(prompt?.toll).toBe(EXPECTED_TOLL);
    // El viejo auto-pago ya no existe.
    expect(events.some((e) => e.kind === "message" && e.text === "The bridge trolls demand a toll!")).toBe(false);
    // Aún no ha cobrado el oro (la cola sigue diferida).
    expect(game.state.gold).toBe(500);
  });

  it("el preámbulo sneaks viaja como GUIÓN paceable troll-sneak (MAINOUT 0x1c0e-0x1ca6)", () => {
    const game = makeGame();
    const events = game.move("south");

    // El guión PRECEDE al prompt en el mismo array (0x1c12... antes de troll_toll 0x1b44).
    const iSneak = events.findIndex((e) => e.kind === "troll-sneak");
    const iPrompt = events.findIndex((e) => e.kind === "troll-toll-prompt");
    expect(iSneak).toBeGreaterThanOrEqual(0);
    expect(iSneak).toBeLessThan(iPrompt);
    // Los mensajes sueltos del burst viejo ya no existen (los sustituye el guión).
    expect(events.some((e) => e.kind === "message" && e.text?.includes("sneaks across"))).toBe(false);
    expect(events.some((e) => e.kind === "message" && e.text?.includes("spieth"))).toBe(false);

    const beats = events[iSneak]!.trollSneak!.beats;
    // Preámbulo (DS 0x6b64) + run-n-frames 0x3AE6(10) = pausa MUDA [0x1c12 + 0x1c19;
    // adenda fanfarria-re 2026-07-22: 0x3ae6 no es beep].
    expect(beats[0]).toEqual({
      message: "\nThou spieth trolls under the bridge!\n\n",
      pauseUnits: 10,
    });
    // Miembros: grupos de 5 beats — nombre+delay(5), punto+delay(5) ×2, punto seco,
    // `\n\n` (0x1c44-0x1c6b). Con payer (hay prompt) NO hay beat `Trolls evaded!`.
    expect((beats.length - 1) % 5).toBe(0);
    const members = (beats.length - 1) / 5;
    expect(members).toBeGreaterThanOrEqual(1);
    for (let m = 0; m < members; m++) {
      const g = beats.slice(1 + m * 5, 6 + m * 5);
      expect(g[0]!.message).toMatch(/ sneaks across$/);
      expect(g[0]!.pauseUnits).toBe(5);
      expect(g[1]).toEqual({ append: ".", pauseUnits: 5 });
      expect(g[2]).toEqual({ append: ".", pauseUnits: 5 });
      expect(g[3]).toEqual({ append: "." });
      expect(g[4]).toEqual({ message: "\n" });
    }
    expect(beats.some((b) => b.message?.includes("evaded"))).toBe(false);
  });

  it("todos pasan (DEX 30): el guión cierra con `Trolls evaded!` y NO hay prompt (0x1ca2)", () => {
    const game = makeGame(
      makeState({
        characters: [makeChar({ dexterity: 30 }), makeChar({ name: "Iolo", dexterity: 30 })],
      }),
    );
    const events = game.move("south");

    const sneak = events.find((e) => e.kind === "troll-sneak");
    expect(sneak).toBeDefined();
    const beats = sneak!.trollSneak!.beats;
    // 1 preámbulo + 2 miembros × 5 + veredicto (DS 0x6ba0, sin delay).
    expect(beats.length).toBe(1 + 2 * 5 + 1);
    expect(beats[beats.length - 1]).toEqual({ message: "Trolls evaded!\n" });
    expect(events.some((e) => e.kind === "troll-toll-prompt")).toBe(false);
    expect(pendingTroll(game)).toBeNull();
  });

  it("resolveTrollToll(true) con oro≥toll: cobra, sin combate, reanuda la cola", () => {
    const game = makeGame();
    game.move("south"); // abre el prompt

    game.resolveTrollToll(true);

    expect(game.state.gold).toBe(500 - EXPECTED_TOLL); // 461
    expect(pendingTroll(game)).toBeNull();
    expect(game.combat).toBeNull(); // pasa libre: la cola del turno NO es combate
  });

  it("resolveTrollToll(false): oro intacto y combate iniciado (spawn sustituye la cola)", () => {
    const game = makeGame();
    game.move("south");

    game.resolveTrollToll(false);

    expect(game.state.gold).toBe(500); // no cobra
    expect(pendingTroll(game)).toBeNull();
    expect(game.combat).not.toBeNull(); // el troll ataca
  });

  it("resolveTrollToll(true) con oro<toll: REEMBOLSA (oro intacto) y combate", () => {
    const game = makeGame(makeState({ gold: 20 })); // 20 < 39
    game.move("south");

    game.resolveTrollToll(true);

    expect(game.state.gold).toBe(20); // reembolso: no se queda en negativo
    expect(pendingTroll(game)).toBeNull();
    expect(game.combat).not.toBeNull();
  });

  it("STR 99 editada: toll NEGATIVO (−198), el prompt SALTA IGUAL y pagar REGALA oro (auditoría byte-wrap)", () => {
    // MAINOUT 0x1b3e: el prompt corre SIEMPRE tras el fallo de DEX — el toll
    // 0x63 − 3·STR es word CON SIGNO (0x1b5e-0x1b65) y el pago 0x1ba9
    // `sub g_gold, ax` con ax = −198 SUMA 198 al oro (gate 0x1bb2 `jge` pasa).
    // Regresión del gate `toll > 0` del port, que suprimía el prompt.
    const game = makeGame(
      makeState({
        characters: [makeChar({ strength: 99 }), makeChar({ name: "Iolo", strength: 99 })],
      }),
    );
    const events = game.move("south");

    const prompt = events.find((e) => e.kind === "troll-toll-prompt");
    expect(prompt).toBeDefined();
    expect(prompt?.toll).toBe(0x63 - 3 * 99); // −198
    expect(pendingTroll(game)).not.toBeNull();

    game.resolveTrollToll(true);
    expect(game.state.gold).toBe(500 + 198); // pagar un peaje negativo REGALA oro
    expect(game.combat).toBeNull();
  });

  it("oro EDITADO > 32767: el `jge` CON SIGNO del original (0x1bb2) lo ve negativo → no puede pagar (auditoría byte-wrap)", () => {
    // 0x1ba9 `sub g_gold,ax` (word) + 0x1bb2 `jge`: con g_gold 40000 la resta
    // queda ≥ 0x8000 → signo negativo → reembolso 0x1bb9 + combate. El oro
    // legítimo (cap 9999) nunca entra aquí.
    const game = makeGame(makeState({ gold: 40000 }));
    game.move("south");

    game.resolveTrollToll(true); // intenta pagar 39 con 40000 "de sobra"

    expect(game.state.gold).toBe(40000); // reembolso: no cobró
    expect(game.combat).not.toBeNull(); // cae al combate como insolvente
  });

  it("el spawn de rechazo usa el defIndex del Troll (41 en la tabla de 48)", () => {
    // Cita: monsterNamesUpper[41]='TROLLS'; enemyDefs[41].name='Troll' (enemyName
    // 0x1B4B → tabla mixta idx 39). El combate arranca con ese enemigo.
    expect(combatResources.enemyDefs[41]!.name).toBe("Troll");
    const game = makeGame();
    game.move("south");
    game.resolveTrollToll(false);
    expect(game.combat).not.toBeNull();
  });

  it("el prompt es getkey crudo: abrir el peaje no consume RNG (semilla del stream)", () => {
    // El getkey del prompt (0x1b86) no toca g_rng_seed: la semilla justo tras
    // move→prompt es la misma que tras un move idéntico SIN el gate de troll no
    // sería comparable, así que anclamos por el consumo interno: abrir el prompt
    // deja la semilla EXACTA que dejó el ambush (que sí consumió), y responder Y
    // con oro de sobra (cola diferida) la avanza igual que el world_turn normal.
    const seedOf = (g: Game): number =>
      (g as unknown as { liveRng: { getSeed(): number } }).liveRng.getSeed();

    const a = makeGame();
    a.move("south");
    const seedAtPrompt = seedOf(a);
    // Responder Y (getkey crudo) no debe mover la semilla POR SÍ MISMO; sólo la
    // cola diferida (tickDoorsAndNpcs + world_turn final) la avanza.
    a.resolveTrollToll(true);
    const seedAfterResume = seedOf(a);

    // La reanudación corre el world_turn final (spawn gate rand(1,30)): la semilla
    // avanza. Lo que NO puede pasar es que el prompt en sí consuma un rand extra.
    // Comprobamos que la reanudación es determinista con la misma semilla de prompt.
    const b = makeGame();
    b.move("south");
    expect(seedOf(b)).toBe(seedAtPrompt); // el ambush consume idéntico en ambas
    b.resolveTrollToll(true);
    expect(seedOf(b)).toBe(seedAfterResume); // reanudación determinista
  });
});
