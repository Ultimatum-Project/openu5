/**
 * ECO DE RUMBO COMPUESTO en el juego VIVO — «Ride North» / «Fly North» / «Row North».
 *
 * CLASE DEL SPEC: VEREDICTO-DE-FIDELIDAD. La tabla pura la asierta
 * `transport-verbo-rumbo.test.ts`; aquí se prueba la COMPOSICIÓN que sale por eventos:
 * `transport_face` (MAINOUT 0x00DA) imprime el verbo SIN `\n` y `outdoor_move`
 * (0x0490, push DS 0x29DB en 0x0507) imprime el rumbo CON `\n` ⇒ UNA línea.
 *
 * Los tests corren en `en`, donde `tf()` es la identidad y el resultado es
 * byte-idéntico a la concatenación del binario — que es el contrato de fidelidad.
 */
import { describe, expect, it } from "vitest";
import type { CharacterState, ExtractedInitialState, GameState } from "../src/core/state.js";
import { Game, type GameData } from "../src/core/game.js";
import type { WorldData } from "../src/core/world/map.js";

function makeChar(over: Partial<CharacterState> = {}): CharacterState {
  return {
    name: "Test", gender: 0x0b, class: "A", status: "G",
    strength: 20, dexterity: 20, intelligence: 20, currentMp: 10,
    currentHp: 50, maxHp: 60, exp: 0, level: 2, monthsAtInn: 0,
    helmet: 0xff, armor: 0xff, weapon: 0xff, shield: 0xff, ring: 0xff, amulet: 0xff,
    partyStatus: 0, ...over,
  };
}
function makeState(over: Partial<GameState> = {}): GameState {
  const base: Partial<GameState> = {
    version: 1,
    characters: [makeChar()], partySize: 1, activeCharacter: 0,
    food: 100, gold: 100, magicCarpets: 0,
    time: { year: 139, month: 4, day: 7, hour: 12, minute: 0 },
    turnsSinceStart: 0, position: { location: 0, floor: 0, x: 100, y: 100 },
    transport: "foot", torchTurns: 0, torches: 2, prevHour: 12,
    wind: 0, specialItems: { spyglass: false, hmsCape: false, sextant: false, pocketWatch: false, blackBadge: false, woodenBox: false },
  };
  return { ...base, ...over } as GameState;
}
function makeWorld(tile = 4, spots: { x: number; y: number; tile: number }[] = []): WorldData {
  const overworld = Array.from({ length: 256 }, () => Array<number>(256).fill(tile));
  for (const s of spots) overworld[s.y]![s.x] = s.tile;
  return { overworld, underworld: overworld, smallMaps: new Map() };
}
/** Mundo con un PUEBLO (small map) navegable, para el reparto por contexto del barco. */
const TOWN_ID = 13;
function makeTownWorld(tile = 1): WorldData {
  const overworld = Array.from({ length: 256 }, () => Array<number>(256).fill(4));
  const tiles = Array.from({ length: 32 }, () => Array<number>(32).fill(tile));
  return {
    overworld,
    underworld: overworld,
    smallMaps: new Map([[TOWN_ID, { id: TOWN_ID, name: "Test Town", floors: [{ z: 0, tiles }] }]]),
  } as unknown as WorldData;
}
const gameData: GameData = { locationsX: [], locationsY: [], locationNames: [] };
const makeGame = (s: GameState, w: WorldData = makeWorld()): Game =>
  new Game({} as ExtractedInitialState, w, gameData, s, {});

/** Textos de los ecos de rumbo (`walk-echo`) de un paso. */
const echoes = (g: Game, dir: "north" | "south" | "east" | "west"): string[] =>
  g.move(dir).filter((e) => e.kind === "walk-echo").map((e) => e.text!);

describe("eco de rumbo compuesto (transport_face 0x00DA + outdoor_move 0x0507)", () => {
  it("A PIE: rumbo pelado, sin verbo (default 0x0129 no imprime)", () => {
    const st = makeState({ transport: "foot", transportTile: 0x1c });
    expect(echoes(makeGame(st), "north")).toEqual(["North"]);
  });

  it("MONTADO: «Ride North» (0x010A, DS 0x2946 «Ride »)", () => {
    const st = makeState({ transport: "horse", transportTile: 0x10 });
    expect(echoes(makeGame(st), "north")).toEqual(["Ride North"]);
  });

  it("ALFOMBRA: «Fly North» — el racimo exacto que el espejo veía divergir 2 794 veces", () => {
    const st = makeState({ transport: "carpet", transportTile: 0x14 });
    expect(echoes(makeGame(st), "north")).toEqual(["Fly North"]);
  });

  it("el verbo NO depende del facing del tile, sólo de la CLASE (and 0xFC en 0x00EA)", () => {
    for (const t of [0x14, 0x15, 0x16, 0x17]) {
      const st = makeState({ transport: "carpet", transportTile: t });
      expect(echoes(makeGame(st), "east")).toEqual(["Fly East"]);
    }
  });

  it("los cuatro rumbos se componen igual (DS 0x29DB/0x29E2/0x29E9/0x29EF)", () => {
    const dirs = [["north", "Fly North"], ["south", "Fly South"], ["east", "Fly East"], ["west", "Fly West"]] as const;
    for (const [d, want] of dirs) {
      const st = makeState({ transport: "carpet", transportTile: 0x14 });
      expect(echoes(makeGame(st), d)).toEqual([want]);
    }
  });

  it("ESQUIFE: «Row <rumbo>», NO «Head» — la clase 0x28 despacha a 0x0152", () => {
    // El esquife imprime «Row » en TODO pulsado y devuelve 0; «Head » es exclusivo de
    // la fragata (0x20/0x24 → 0x016A). Antes el port emitía «Head South» aquí.
    const st = makeState({
      transport: "skiff", transportTile: 0x2a, // facing S: rema sin virar
      position: { location: 0, floor: 0, x: 100, y: 100 },
    });
    const ev = makeGame(st, makeWorld(1)).move("south");
    expect(ev.filter((e) => e.kind === "walk-echo").map((e) => e.text)).toEqual(["Row South"]);
    expect(ev.some((e) => e.text === "Head South")).toBe(false);
  });

  it("ESQUIFE VIRANDO: también «Row», y ya no se cuela un «Head»", () => {
    const st = makeState({
      transport: "skiff", transportTile: 0x28, // facing N; pulsar S vira
      position: { location: 0, floor: 0, x: 100, y: 100 },
    });
    const ev = makeGame(st, makeWorld(1)).move("south");
    expect(ev.filter((e) => e.kind === "walk-echo").map((e) => e.text)).toEqual(["Row South"]);
    expect(ev.some((e) => e.text === "Head South")).toBe(false);
  });

  it("FRAGATA: el «Head <rumbo>» del viraje se CONSERVA (rama 0x016A, no tocada)", () => {
    const st = makeState({
      transport: "ship", transportTile: 0x24, // arriada facing N; pulsar S vira
      position: { location: 0, floor: 0, x: 100, y: 100 },
    });
    const ev = makeGame(st, makeWorld(1)).move("south");
    expect(ev.some((e) => e.text === "Head South")).toBe(true);
    // y NO gana un eco de verbo: la fragata no sale por `faceVerb`
    expect(ev.filter((e) => e.kind === "walk-echo")).toHaveLength(0);
  });

  it("★ BARCO EN PUEBLO: rumbo PELADO, sin «Head» (TOWN 0x0591/0x0596 → 0x05ED, sin verbo)", () => {
    // La diferencia ENTERA entre las dos rutinas: `town_transport_face` manda 0x20/0x24
    // DIRECTOS a 0x05ED, que sólo recompone el tile — no imprime verbo — y `town_move`
    // imprime el rumbo SIN gate (0x0662, DS 0x2676). «Head » (DS 0x2956) es de MAINOUT.
    const st = makeState({
      transport: "ship", transportTile: 0x24, // arriada facing N; pulsar S vira
      position: { location: TOWN_ID, floor: 0, x: 10, y: 10 },
    });
    const ev = makeGame(st, makeTownWorld()).move("south");
    expect(ev.some((e) => e.text === "Head South")).toBe(false);
    expect(ev.filter((e) => e.kind === "walk-echo").map((e) => e.text)).toEqual(["South"]);
  });

  it("★ BARCO EN OVERWORLD: sí dice «Head South» (MAINOUT 0x016A) — el reparto por contexto", () => {
    const st = makeState({
      transport: "ship", transportTile: 0x24,
      position: { location: 0, floor: 0, x: 100, y: 100 },
    });
    const ev = makeGame(st, makeWorld(1)).move("south");
    expect(ev.some((e) => e.text === "Head South")).toBe(true);
  });

  it("caballo y alfombra dicen LO MISMO en pueblo que en overworld (DS 0x2666/0x266C)", () => {
    // Las dos rutinas comparten palabras (otro bloque de strings, mismo texto), así que
    // `faceVerb` es context-free A PROPÓSITO: sólo el barco necesita reparto.
    for (const [transport, tile, want] of [["horse", 0x10, "Ride South"], ["carpet", 0x14, "Fly South"]] as const) {
      const st = makeState({ transport, transportTile: tile, position: { location: TOWN_ID, floor: 0, x: 10, y: 10 } });
      const ev = makeGame(st, makeTownWorld(5)).move("south");
      expect(ev.filter((e) => e.kind === "walk-echo").map((e) => e.text)).toEqual([want]);
    }
  });

  it("el eco sale también cuando el paso NO progresa (bloqueo): print ANTES de resolver", () => {
    // outdoor_move imprime el rumbo en 0x0507, ANTES de ship_try_move (0x0514) y del
    // paso: el original ecoa todo pulsado, acierte o no.
    const st = makeState({ transport: "horse", transportTile: 0x10 });
    const g = makeGame(st, makeWorld(4, [{ x: 100, y: 99, tile: 5 }])); // sin salida útil
    expect(echoes(g, "north")).toEqual(["Ride North"]);
  });
});
