/**
 * Fase 1.3 · Flow 3 — Donación de santuario (CAST2 0x0B1D).
 *
 * Regla EXACTA del binario (scout-prompts.md Flow 3, shrines.md:159): al meditar
 * con el Codex y sin quest activa, el original pide un DÍGITO con un getkey crudo
 * (0x448c, NO consume el stream vivo). Sobre ese dígito `n`:
 *   - n≤0 → NO-OP: imprime " gp" (DS 0x959c) y sale sin donar.
 *   - 100·n > oro → "not enough" (0xb6b9) y RE-PREGUNTA (el bucle 0xb5f→0xb63 del
 *     original): re-emite el prompt, no cobra ni sube karma.
 *   - si alcanza → shrineDonate: gold−=100·n, karma+=n (clamp 99, KARMA_MAX 0x63).
 *
 * Estos tests ejercitan el MOTOR (`submitDonation()` puro + re-emisión del prompt);
 * la captura de dígito y el TRIGGER de meditación viven en la UI (el trigger es F1.4,
 * frontera declarada por el plan — sin E2E aquí).
 */
import { describe, expect, it } from "vitest";
import type {
  CharacterState,
  ExtractedInitialState,
  GameState,
} from "../src/core/state.js";
import { Game, type GameData } from "../src/core/game.js";
import type { SmallMapLocation, WorldData } from "../src/core/world/map.js";
import {
  renderCue,
  donationInvertWindowMs,
  wellDoneInvertWindowMs,
} from "../src/skin/fiel/speaker.js";

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
    characters: [makeChar()],
    partySize: 1,
    activeCharacter: 0,
    food: 100,
    gold: 1000,
    karma: 50,
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

function makeLocation(): SmallMapLocation {
  const tiles = Array.from({ length: 32 }, () => Array.from({ length: 32 }, () => 5));
  return { id: 1, name: "Loc", floors: [{ z: 0, tiles }] };
}

function makeWorld(): WorldData {
  const overworld = Array.from({ length: 256 }, () =>
    Array.from({ length: 256 }, () => 5),
  );
  return {
    overworld,
    underworld: overworld,
    smallMaps: new Map([[1, makeLocation()]]),
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

const seedOf = (g: Game): number =>
  (g as unknown as { liveRng: { getSeed(): number } }).liveRng.getSeed();

describe("Flow 3 — donación de santuario (CAST2 0x0B1D)", () => {
  it("submitDonation(0): NO-OP — no toca oro/karma y emite ' gp' (DS 0x959c)", () => {
    const game = makeGame(makeState({ gold: 1000, karma: 50 }));
    const events = game.submitDonation(0);

    expect(game.state.gold).toBe(1000); // intacto
    expect(game.state.karma).toBe(50); // intacto
    // Exactamente un mensaje "0 gp\n" (dígito '0' + " gp\n", DS 0x959c) y SIN re-pregunta.
    expect(events.filter((e) => e.kind === "message").map((e) => e.text)).toEqual(["0 gp\n"]);
    expect(events.some((e) => e.kind === "shrine-donate-prompt")).toBe(false);
    expect(events.some((e) => e.kind === "party-changed")).toBe(false);
  });

  it("submitDonation(n) con 100·n > oro: NO cobra y RE-EMITE el prompt (bucle 0xb5f)", () => {
    // 5 dígito → 500 gp pedidos, pero solo hay 300 → insuficiente.
    const game = makeGame(makeState({ gold: 300, karma: 40 }));
    const events = game.submitDonation(5);

    expect(game.state.gold).toBe(300); // NO cobra
    expect(game.state.karma).toBe(40); // NO sube karma
    // eco "500 gp\n\n" (SIEMPRE, 0x0b40) + "not that much gold" (MISCMSG 0x0846) + re-prompt.
    expect(events.some((e) => e.kind === "message" && e.text === "500 gp\n\n")).toBe(true);
    expect(events.some((e) => e.kind === "message" && e.text === "Thou hast not that much gold!")).toBe(true);
    expect(events.some((e) => e.kind === "shrine-donate-prompt")).toBe(true);
    expect(events.some((e) => e.kind === "party-changed")).toBe(false);
  });

  it("submitDonation(n) con oro suficiente: gold−=100n, karma+=n y emite party-changed", () => {
    const game = makeGame(makeState({ gold: 1000, karma: 50 }));
    const events = game.submitDonation(3);

    expect(game.state.gold).toBe(1000 - 300); // 100·3
    expect(game.state.karma).toBe(50 + 3); // +n
    expect(events.some((e) => e.kind === "message" && e.text === "300 gp\n\n")).toBe(true); // eco (DS 0x95a2)
    expect(events.some((e) => e.kind === "message" && e.text === "ALAKAZAM!\n")).toBe(true); // éxito (DS 0x95aa+0x95b4)
    // #364-c — el ALAKAZAM viaja POR TRAMOS: "ALAKAZAM" (DS 0x95aa) impreso bajo
    // set_font(1) (CAST2 0x0ba1) y el "!\n" (DS 0x95b4) tras volver a font 0 (0x0baf).
    // El cambio de fuente ocurre A MITAD DE FILA; `text` sigue siendo la concatenación.
    const alakazam = events.find((e) => e.kind === "message" && e.text === "ALAKAZAM!\n");
    expect(alakazam?.segments).toEqual([
      { text: "ALAKAZAM", rune: true },
      { text: "!\n", rune: false },
    ]);
    expect(events.some((e) => e.kind === "party-changed")).toBe(true);
    expect(events.some((e) => e.kind === "shrine-donate-prompt")).toBe(false);
  });

  it("donación válida al límite del oro (100·n == oro): cobra y deja oro en 0", () => {
    const game = makeGame(makeState({ gold: 200, karma: 10 }));
    const events = game.submitDonation(2); // 200 gp exactos

    expect(game.state.gold).toBe(0);
    expect(game.state.karma).toBe(12);
    expect(events.some((e) => e.kind === "party-changed")).toBe(true);
  });

  it("clamp de karma a 99 (KARMA_MAX 0x63): karma no supera 99 aunque n empuje más", () => {
    const game = makeGame(makeState({ gold: 1000, karma: 95 }));
    game.submitDonation(9); // +9 → 104 → clamp 99

    expect(game.state.karma).toBe(99);
    expect(game.state.gold).toBe(1000 - 900);
  });

  it("el prompt es getkey crudo: submitDonation NO consume el stream vivo (0 RNG)", () => {
    // Prueba directa del "0 RNG" por la semilla viva (g_rng_seed): ni la donación
    // válida, ni el NO-OP, ni la re-pregunta por oro insuficiente tocan el stream.
    const valid = makeGame();
    valid.reseed(4242);
    const seed0 = seedOf(valid);
    valid.submitDonation(3); // donación válida
    expect(seedOf(valid)).toBe(seed0);

    const noop = makeGame();
    noop.reseed(4242);
    noop.submitDonation(0); // NO-OP
    expect(seedOf(noop)).toBe(seed0);

    const insufficient = makeGame(makeState({ gold: 100 }));
    insufficient.reseed(4242);
    insufficient.submitDonation(9); // insuficiente → re-pregunta
    expect(seedOf(insufficient)).toBe(seed0);
  });
});

/**
 * #364 — Paridad AV del ÉXITO de la donación (CAST2 0x0b7c-0x0c14): tras el ALAKAZAM el
 * binario invierte el viewport (rect XOR 0x0bc3-0x0bcd, SUELTO) y lo sostiene con DOS
 * barridos espejo `tone(0xa8c,1,0xc8,si,0)` (0x0bd0-0x0c0f), restaurando en 0xd16
 * (`kernel_flash(10)` vía `jmp` @0x0c14). SIN sacudida (no hay `call 0x4e92` en esta rama).
 * Las salidas SIN efecto no pasan por ese tramo: n=0 sale por 0x0b2f y el oro insuficiente
 * por 0x0b52→re-prompt, ANTES del bloque AV.
 *
 * MUTANTES CORRIDOS (sobre fixture verde, restaurado tras cada uno):
 *   · M1 — quitar `events.push({kind:"ritual-invert",…})` del éxito → MATA (orden + objeto).
 *   · M2 — quitar `events.push(sfxEvent("shrine-donation"))` → MATA (adyacencia + id).
 */
describe("#364 — paridad AV de la donación aceptada (rama 0x0b1d)", () => {
  it("ÉXITO en el ORDEN del binario: ALAKAZAM (0x0ba8) → invert (0x0bcd) → sfx (0x0bd0)", () => {
    const game = makeGame(makeState({ gold: 1000, karma: 50 }));
    const events = game.submitDonation(3);
    const iMsg = events.findIndex((e) => e.kind === "message" && e.text === "ALAKAZAM!\n");
    const iInv = events.findIndex((e) => e.kind === "ritual-invert");
    const iSfx = events.findIndex((e) => e.kind === "sfx");
    const iParty = events.findIndex((e) => e.kind === "party-changed");
    expect(iMsg, "control positivo: sin ALAKAZAM los demás índices serían vacuos").toBeGreaterThanOrEqual(0);
    expect(iInv, "0x0ba8 print < 0x0bcd rect XOR").toBeGreaterThan(iMsg);
    expect(iSfx, "los barridos van pegados detrás del rect (0x0bd0)").toBe(iInv + 1);
    expect(iParty).toBeGreaterThan(iSfx);
  });

  it("el invert DECLARA su rito y el cue es el de la donación (esperados en crudo)", () => {
    const events = makeGame().submitDonation(3);
    expect(events.find((e) => e.kind === "ritual-invert")).toMatchObject({
      kind: "ritual-invert",
      ritual: "donation", // la piel deriva la ventana del par 0xc8, no del 0x96 del WELL DONE
    });
    expect(events.find((e) => e.kind === "sfx")).toMatchObject({
      kind: "sfx",
      sfx: { id: "shrine-donation" },
    });
  });

  it("NEGATIVO n=0 (salida 0x0b2f): NI cue NI invert", () => {
    const events = makeGame(makeState({ gold: 1000 })).submitDonation(0);
    expect(events.some((e) => e.kind === "ritual-invert")).toBe(false);
    expect(events.some((e) => e.kind === "sfx")).toBe(false);
  });

  it("NEGATIVO oro insuficiente (0x0b52 → re-prompt): NI cue NI invert", () => {
    const events = makeGame(makeState({ gold: 300 })).submitDonation(5); // pide 500 con 300
    expect(events.some((e) => e.kind === "ritual-invert")).toBe(false);
    expect(events.some((e) => e.kind === "sfx")).toBe(false);
  });

  it("la ventana sale de SUS barridos: 2 tramos iguales y 7.130 ms EN CRUDO (count 0xc8)", () => {
    const segs = renderCue({ id: "shrine-donation" });
    expect(segs, "los dos bucles de 0x0bd0 y 0x0bf2").toHaveLength(2);
    expect(segs[0]!.ms).toBeCloseTo(segs[1]!.ms, 6);
    // EN CRUDO (no desde el sujeto): 460 iteraciones × (0xc8·0,93/24) ms = 3.565 ms por
    // tramo ⇒ 7.130 ms los dos. Y la del WELL DONE es 6.277,5 ms (#355: sus barridos
    // count 0x96 = 5.347,5 MÁS la sacudida de 0x0c88 = 930; la donación NO suma sacudida
    // porque su tramo 0x0bcd→jmp 0xd16 @0x0c14 no llama a 0x4e92 — solo los dos 0x3fb2 de
    // 0x0be3/0x0c05): DISTINTAS — el aserto del par cruzado es lo que mata al mutante
    // «reusé wellDoneInvertWindowMs».
    expect(donationInvertWindowMs()).toBeCloseTo(7130, 6);
    expect(donationInvertWindowMs()).toBeCloseTo(segs[0]!.ms + segs[1]!.ms, 6);
    expect(wellDoneInvertWindowMs()).toBeCloseTo(6277.5, 6);
    // pitch del modelo: inc 0xa8c ⇒ (2700/65536)·(24000/0,93) Hz ≈ 1063,2 Hz constante.
    expect((segs[0] as { f0: number }).f0).toBeCloseTo(1063.19, 1);
  });
});
