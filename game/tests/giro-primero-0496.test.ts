/**
 * GIRO-PRIMERO DE LA FRAGATA — careo #343 (carril careo-fragata).
 *
 * Dos piezas del binario, con papeles distintos:
 *   - Prologo de `outdoor_move` MAINOUT 0x0496-0x04B3: SOLO clase velas izadas
 *     (0x0499 `and al,0xfc / cmp al,0x20`); compara la TECLA con `g_sail_dir`
 *     (0x04A4) y SOLO si difieren escribe el rumbo (0x04AC) Y resetea el drift
 *     ctr (0x04AF `mov [g_unk_5883],ah` con ah=0) — el `je 0x4b3` de 0x04A7
 *     salta AMBOS juntos. El gate es el RUMBO, no el facing del sprite.
 *   - `transport_face` 0x016A (fragata 0x20 Y 0x24): si el facing del TILE
 *     cambia, imprime «Head <rumbo>» y devuelve 1 → el llamador aborta el paso
 *     (`or ax,ax` en 0x04F6/0x0549/0x0563/0x057D → `jmp 0x592`): el giro
 *     CONSUME el beat. Tambien ARRIADA — por eso #343 fabrico t=0x25 «ya
 *     encarada al Este» para ejercitar el remo sin giro-primero (corrida 4).
 *
 * Testigo vivo: re/notes/testigo-remolino-343.md §2 (corrida 1: t=0x20, la
 * primera pulsacion escribe g_sail_dir, imprime «Head East» y consume el beat
 * con t 0x20→0x21; ship_try_move ni corre).
 *
 * Esperados EN CRUDO (tiles 0x20/0x21/0x24/0x25, rumbos SAIL_DIR 1=O,2=E,
 * 3=N,4=S, literales del prologo), no derivados del sujeto.
 */
import { describe, expect, it } from "vitest";
import type { CharacterState, ExtractedInitialState, GameState } from "../src/core/state.js";
import { Game, type GameData, type GameEvent } from "../src/core/game.js";
import type { WorldData } from "../src/core/world/map.js";

function makeChar(): CharacterState {
  return {
    name: "Test", gender: 0x0b, class: "A", status: "G",
    strength: 20, dexterity: 20, intelligence: 20, currentMp: 10,
    currentHp: 50, maxHp: 60, exp: 0, level: 2, monthsAtInn: 0,
    helmet: 0xff, armor: 0xff, weapon: 0xff, shield: 0xff, ring: 0xff, amulet: 0xff,
    partyStatus: 0,
  } as CharacterState;
}
function makeState(over: Partial<GameState> = {}): GameState {
  return {
    version: 1,
    characters: [makeChar()], partySize: 1, activeCharacter: 0,
    food: 100, gold: 100, magicCarpets: 0,
    time: { year: 139, month: 4, day: 7, hour: 12, minute: 0 },
    turnsSinceStart: 0, position: { location: 0, floor: 0, x: 100, y: 100 },
    transport: "ship", torchTurns: 0, torches: 2, prevHour: 12, wind: 0,
    specialItems: { spyglass: false, hmsCape: false, sextant: false, pocketWatch: false, blackBadge: false, woodenBox: false },
    shipHull: 99,
    ...over,
  } as GameState;
}
/** Sobremundo de AGUA PROFUNDA (tile 1). Viento en CALMA (wind:0): la deriva
 *  de `windDriftStep` sale por la rama Calm SIN tocar el ctr — el unico
 *  escritor del ctr en estos beats es el prologo careado (o un cambio de
 *  viento 1/64 del stream, que cada test descarta afirmando wind==0 al final). */
function waterWorld(): WorldData {
  const overworld = Array.from({ length: 256 }, () => Array<number>(256).fill(1));
  return { overworld, underworld: overworld, smallMaps: new Map() };
}
const gameData: GameData = { locationsX: [], locationNames: [], locationsY: [] };
function makeGame(s: GameState): Game {
  return new Game({} as ExtractedInitialState, waterWorld(), gameData, s, {});
}
const msgs = (events: GameEvent[]): string[] =>
  events.filter((e) => "text" in e).map((e) => (e as { text: string }).text);

describe("giro-primero — velas IZADAS (prologo 0x0496 + transport_face 0x016A)", () => {
  it("tecla != rumbo y != facing: escribe rumbo, «Head North», ctr=0 y el beat NO avanza", () => {
    // t=0x21 (izada, facing E), rumbo E (2). Pulsar NORTE.
    const st = makeState({ transportTile: 0x21, sailDir: 2, windDriftCtr: 2 });
    const g = makeGame(st);

    const events = g.move("north");

    expect(st.sailDir).toBe(3); // 0x04AC (SAIL_DIR: N=3)
    expect(st.windDriftCtr).toBe(0); // 0x04AF
    expect(st.transportTile).toBe(0x20); // facing N = (tile&0xFC)+0
    expect(msgs(events).some((t) => t.includes("Head North"))).toBe(true); // 0x016A
    expect(events.some((e) => e.kind === "moved")).toBe(false); // retorno 1 → jmp 0x592
    expect({ x: st.position.x, y: st.position.y }).toEqual({ x: 100, y: 100 });
    expect(st.wind).toBe(0); // sin cambio de viento en el beat (aisla el ctr)
  });

  it("tecla != rumbo pero == facing: escribe rumbo y resetea ctr SIN «Head» (0x04A7 no salta)", () => {
    // Estado post-dock/post-collision: rumbo parado (g_sail_dir=0, 0x0306) con
    // el sprite aun encarado al Este. Pulsar ESTE: el prologo escribe 2 y pone
    // el ctr a 0; transport_face no vira (facing igual) → sin «Head».
    const st = makeState({ transportTile: 0x21, sailDir: 0, windDriftCtr: 2 });
    const g = makeGame(st);

    const events = g.move("east");

    expect(st.sailDir).toBe(2); // 0x04AC
    expect(st.windDriftCtr).toBe(0); // 0x04AF — HOY el port no resetea aqui
    expect(st.transportTile).toBe(0x21); // facing intacto
    expect(msgs(events).some((t) => t.includes("Head"))).toBe(false); // 0x0181: sin cambio
    expect(st.wind).toBe(0);
  });

  it("tecla == rumbo pero != facing: vira con «Head North» y el ctr NO se toca (je 0x4b3)", () => {
    // g_sail_dir ya N (3) con el sprite encarado al Este. Pulsar NORTE: el
    // prologo salta ENTERO (tecla==rumbo ⇒ ni escritura ni reset del ctr);
    // transport_face si vira («Head North», beat consumido).
    const st = makeState({ transportTile: 0x21, sailDir: 3, windDriftCtr: 1 });
    const g = makeGame(st);

    const events = g.move("north");

    expect(st.sailDir).toBe(3); // sin escritura
    expect(st.windDriftCtr).toBe(1); // el reset 0x04AF NO corre — HOY el port lo resetea
    expect(st.transportTile).toBe(0x20);
    expect(msgs(events).some((t) => t.includes("Head North"))).toBe(true);
    expect(events.some((e) => e.kind === "moved")).toBe(false);
    expect(st.wind).toBe(0);
  });
});

describe("giro-primero — tambien ARRIADA (transport_face 0x016A cubre 0x24)", () => {
  it("arriada encarada al Este, pulsar NORTE: «Head North» consume el beat, sin remo", () => {
    const st = makeState({ transportTile: 0x25, sailDir: 0 });
    const g = makeGame(st);

    const events = g.move("north");

    expect(st.transportTile).toBe(0x24); // vira el sprite
    expect(st.sailDir).toBe(0); // el prologo 0x0499 NO cubre 0x24: sin escritura
    expect(msgs(events).some((t) => t.includes("Head North"))).toBe(true);
    expect(events.some((e) => e.kind === "moved")).toBe(false); // el giro se come el beat
    expect({ x: st.position.x, y: st.position.y }).toEqual({ x: 100, y: 100 });
  });

  it("CONTROL: arriada YA encarada, pulsar ESTE rema y avanza (corrida 4 de #343)", () => {
    const st = makeState({ transportTile: 0x25, sailDir: 0 });
    const g = makeGame(st);

    const events = g.move("east");

    expect(events.some((e) => e.kind === "moved")).toBe(true);
    expect({ x: st.position.x, y: st.position.y }).toEqual({ x: 101, y: 100 });
    expect(msgs(events).some((t) => t.includes("Head"))).toBe(false);
  });
});
