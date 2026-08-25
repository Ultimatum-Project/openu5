/**
 * #182 D2 — In Por (blink) NO EXISTÍA en el exterior (CAST.OVL 0x05F0 → 0x0680).
 *
 * `cast.ts:152` devolvía `{kind:"blink"}` y el ÚNICO consumidor era `combat.ts:2257`
 * (`git grep '"blink"' game/src` → 3 hits: unión de tipo, return y case de combate).
 * Fuera de combate el efecto caía al final de la cadena de `main.ts` sin rama: el
 * hechizo y el maná YA gastados, sin pedir dirección y sin mover a nadie.
 *
 * La guarda que parte el handler es `05e9: cmp byte ptr [g_location],0x7f` /
 * `05ee: ja 0x5f3`; lo citado es la rama de COMBATE y la HERMANA `05f0: jmp 0x680` es
 * esta. `TIME_PERMITTED_BITS[17] = 0x09` (combate | exterior) la acota a `g_location==0`.
 * La derivación completa del rayo, con sus offsets, vive en `src/core/magic/blink.ts`.
 *
 * LO QUE ESTOS TESTS DISCRIMINAN (un port «razonable» falla los tres primeros):
 *  1. el rayo NO se para en la primera hierba — tras escribir la posición (0x0713/0x071a)
 *     el flujo cae a 0x0722 y SIGUE: gana la ÚLTIMA;
 *  2. el alcance lo fija la VENTANA DE CHUNKS (`g_chunk_origin` + 0x20, 0x06af-0x06d7),
 *     no el borde del mapa;
 *  3. `071d: mov byte [g_unk_24e6],1` está DENTRO del `if (tile==5)` ⇒ un blink que no
 *     encuentra hierba no consume turno.
 *
 * ⚠ HONESTIDAD SOBRE EL FAILING-FIRST: aquí la mecánica estaba AUSENTE ENTERA (ni rutina
 * ni productor), no como en D5 (rutina portada sin productor). El primer rojo es por
 * tanto ESTRUCTURAL —`game.applyBlinkSpell is not a function`— y NO demuestra nada por sí
 * solo (firma de `failing-first-import-trap`). La evidencia de que el modelo es el del
 * binario y no uno plausible la cargan los tres controles de arriba, que separan esta
 * derivación de la alternativa obvia.
 */
import { describe, expect, it } from "vitest";
import { Game, type GameData } from "../src/core/game.js";
import type { CharacterState, GameState } from "../src/core/state.js";
import type { WorldData } from "../src/core/world/map.js";

/**
 * Tile de hierba, LITERAL y SIN importar nada del módulo nuevo (`cmp byte ptr [bx], 5`,
 * CAST 0x0709). `blink.ts` tampoco lo exporta: así ningún rojo de este fichero puede ser
 * un error de módulo disfrazado de aserción (`failing-first-import-trap`).
 */
const GRASS = 5;
/** Terreno de relleno: cualquier cosa que NO sea 5 (montaña). */
const MOUNTAIN = 0x0c;

const PX = 100;
const PY = 100;
/** Origen de la ventana de chunks del arnés ⇒ xMax = 96 + 0x20 = 128 (0x06b4/0x06ba). */
const ORIGIN = { x: 96, y: 96 };

function makeChar(name: string): CharacterState {
  return {
    name, gender: 0x0b, class: "A", status: "G", strength: 20, dexterity: 20,
    intelligence: 20, currentMp: 10, currentHp: 50, maxHp: 60, exp: 0, level: 2,
    monthsAtInn: 0, helmet: 0xff, armor: 0xff, weapon: 0xff, shield: 0xff, ring: 0xff,
    amulet: 0xff, partyStatus: 0,
  } as CharacterState;
}

function makeState(): GameState {
  return {
    characters: [makeChar("Avatar"), makeChar("Iolo")],
    partySize: 2,
    activeCharacter: 0,
    food: 100,
    time: { year: 139, month: 4, day: 7, hour: 12, minute: 0 },
    turnsSinceStart: 0,
    position: { location: 0, floor: 0, x: PX, y: PY },
    transport: "foot",
    torchTurns: 0,
    torches: 2,
    prevHour: 12,
    chunkOrigin: { ...ORIGIN },
  } as GameState;
}

/** Overworld TODO montaña con hierba SÓLO en las celdas pedidas. */
function makeWorld(grass: [number, number][]): WorldData {
  const overworld = Array.from({ length: 256 }, () =>
    Array.from({ length: 256 }, () => MOUNTAIN),
  );
  for (const [x, y] of grass) overworld[y]![x] = GRASS;
  return { overworld, underworld: overworld, smallMaps: new Map() };
}

const gameData: GameData = {
  locationsX: Array.from({ length: 41 }, () => 250),
  locationsY: Array.from({ length: 41 }, () => 250),
  locationNames: Array.from({ length: 41 }, (_, i) => `Loc${i + 1}`),
};

function makeGame(grass: [number, number][], s = makeState()): { game: Game; state: GameState } {
  return { game: new Game({} as never, makeWorld(grass), gameData, s), state: s };
}

describe("#182 D2 · In Por de EXTERIOR (CAST.OVL 0x0680)", () => {
  it("★ teleporta a la ÚLTIMA hierba del rayo, no a la primera (0x0722 sin break)", () => {
    const { game, state } = makeGame([[102, PY], [106, PY]]);
    game.applyBlinkSpell("east");
    expect(state.position.x).toBe(106);
    expect(state.position.y).toBe(PY);
  });

  it("★ el alcance lo corta la VENTANA DE CHUNKS, no el mapa (0x06af-0x06d7)", () => {
    // origin.x = 96 ⇒ xMax = 128: la hierba de 120 cuenta, la de 130 queda FUERA.
    const { game, state } = makeGame([[120, PY], [130, PY]]);
    game.applyBlinkSpell("east");
    expect(state.position.x).toBe(120);
  });

  it("★ sin hierba en el rayo NO se mueve NI consume turno (0x071d dentro del if)", () => {
    const { game, state } = makeGame([[PX, PY - 3]]); // hierba al NORTE, se apunta al ESTE
    const minute = state.time.minute;
    const seed = game.liveSeed();

    const events = game.applyBlinkSpell("east");

    expect(state.position.x).toBe(PX);
    expect(state.time.minute).toBe(minute);
    expect(game.liveSeed()).toBe(seed);
    expect(events).toEqual([]);
  });

  it("cancelar el getdir (Space, 0x0687) no mueve ni cobra: cero eventos", () => {
    const { game, state } = makeGame([[102, PY]]);
    const minute = state.time.minute;
    expect(game.applyBlinkSpell(null)).toEqual([]);
    expect(state.position.x).toBe(PX);
    expect(state.time.minute).toBe(minute);
  });

  it("un blink ACERTADO sí cierra turno — el par positivo del control de arriba", () => {
    const { game, state } = makeGame([[102, PY]]);
    const minute = state.time.minute;
    const seed = game.liveSeed();

    const events = game.applyBlinkSpell("east");

    expect(state.position.x).toBe(102);
    expect(state.time.minute).not.toBe(minute); // 0x071d marca turno ⇒ el cierre corre
    expect(game.liveSeed()).not.toBe(seed); // …y el cierre del exterior sí tira dados
    expect(events.some((e) => e.kind === "map-changed")).toBe(true);
  });

  it("las cuatro direcciones del getdir de CAST2 0x0306 (0x036c-0x03a5)", () => {
    // 0x036c dec scratch_y = North · 0x038c inc scratch_y = South
    // 0x039a dec scratch_x = West  · 0x037e inc scratch_x = East
    const cases: [Parameters<Game["applyBlinkSpell"]>[0], [number, number], [number, number]][] = [
      ["north", [PX, PY - 4], [PX, PY - 4]],
      ["south", [PX, PY + 4], [PX, PY + 4]],
      ["west", [PX - 4, PY], [PX - 4, PY]],
      ["east", [PX + 4, PY], [PX + 4, PY]],
    ];
    for (const [dir, grass, expected] of cases) {
      const { game, state } = makeGame([grass]);
      game.applyBlinkSpell(dir);
      expect([state.position.x, state.position.y]).toEqual(expected);
    }
  });

  it("el borde BAJO de la ventana también corta (0x0728 `cmp si,origen` / 0x06f1)", () => {
    // origin.x = 96: hacia el OESTE la hierba de 95 queda fuera; la de 97, dentro.
    const { game, state } = makeGame([[97, PY], [95, PY]]);
    game.applyBlinkSpell("west");
    expect(state.position.x).toBe(97);
  });

  it("★ RE-DERIVA la ventana de chunks alrededor del destino (MAINOUT 0x0019-0x004c)", () => {
    // 0x0740 llama a MAINOUT:0x0000, cuyo tramo 0x0019-0x004c es `initChunkOrigin`.
    // x=120: 120 & 0xf0 = 112 y 120 & 0x0f = 8 (NO < 8) ⇒ origen 112, no el 96 de entrada.
    // y=100: 100 & 0xf0 = 96 y 100 & 0x0f = 4 (< 8) ⇒ el bloque se corre a 80 (0x0026).
    const { game, state } = makeGame([[120, PY]]);
    game.applyBlinkSpell("east");
    expect(state.chunkOrigin).toEqual({ x: 112, y: 80 });
  });
});
