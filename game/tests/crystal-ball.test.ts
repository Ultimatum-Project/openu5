/**
 * #144 — BOLA DE CRISTAL (tile 0x29), el caso que `cmd_look` se comía antes del callee.
 *
 * DERIVACIÓN COMPLETA en `game/src/core/world/crystal-ball.ts` y `re/notes/bola-144-acta.md`.
 * Resumen del asm que estos tests fijan (LOOKOBJ.OVL, base near-call 0xa290):
 *
 *   0x09e4  cmp word ptr [bp-2], 0x29 ; jne 0xa40   ← corta ANTES del "\nThou dost see\n"
 *   0x09ea  call 0xffffa6f8 → kernel 0x4988         resolve_command_char()
 *   0x09f0  inc ax ; jne                            ← -1 ⇒ epílogo SIN tirada
 *   0x09f6  push 1 ; push 0x1e ; call rand_range    rand(1,30)  ← 1 tirada
 *   0x0a01  cl = byte[idx*0x20 + 0x55b6]            registro+0x0E = INTELIGENCIA
 *   0x0a0e  cmp cx, ax ; ja 0xa2a                   gana si INT > tirada (empate PIERDE)
 *   0x0a2a  "Strange vision!" + gem_view(...)       SIN gastar gema
 *   0x0a12  "Death vision!"   + apply_damage(idx,1) kernel 0x2A52, puede MATAR
 *
 * LITERALES A PROPÓSITO. El tile (0x29) y las cotas de la tirada (1,30) se escriben
 * a mano aquí, del binario, y hay un candado que los compara con las constantes
 * exportadas: si el test importara sólo la constante, un port sin el fix fallaría por
 * `undefined` en vez de por la aserción, y el rojo dejaría de demostrar el defecto.
 *
 * EL CONTEST SIN RNG. Los dos extremos son deterministas por construcción: con INT=0
 * ninguna tirada de 1..30 puede perder contra ella (0 > roll es falso siempre) y con
 * INT=31 ninguna puede ganarle (31 > 30 ≥ roll siempre). Así se fija la POLARIDAD del
 * `ja` sin depender de la semilla; el empate (la frontera real) se comprueba aparte
 * sobre la función pura.
 */
import { describe, expect, it } from "vitest";
import { Game, type GameData } from "../src/core/game.js";
import type { CharacterState, GameState } from "../src/core/state.js";
import type { WorldData } from "../src/core/world/map.js";
import {
  crystalBallWins,
  CRYSTAL_BALL_TILE,
  CRYSTAL_BALL_ROLL_MIN,
  CRYSTAL_BALL_ROLL_MAX,
  CRYSTAL_BALL_DEATH_DAMAGE,
} from "../src/core/world/crystal-ball.js";

/** `cmp word ptr [bp - 2], 0x29` — LOOKOBJ 0x09e4. */
const BALL = 0x29;
/** `mov ax,1` / `mov ax,0x1e` — LOOKOBJ 0x09f6/0x09fa (primer push = MIN). */
const ROLL_MIN = 1;
const ROLL_MAX = 30;
/** INT que NUNCA gana (0 > roll es falso para todo roll ≥ 1). */
const INT_ALWAYS_LOSES = 0;
/** INT que SIEMPRE gana (31 > 30 ≥ roll). */
const INT_ALWAYS_WINS = 31;

const PX = 50;
const PY = 50;
const GRASS = 5;

function makeChar(name: string, intelligence: number, currentHp = 50): CharacterState {
  return {
    name, gender: 0x0b, class: "A", status: "G", strength: 20, dexterity: 20,
    intelligence, currentMp: 10, currentHp, maxHp: 60, exp: 0, level: 2,
    monthsAtInn: 0, helmet: 0xff, armor: 0xff, weapon: 0xff, shield: 0xff, ring: 0xff,
    amulet: 0xff, partyStatus: 0,
  } as CharacterState;
}

function makeState(intelligence: number, currentHp = 50): GameState {
  return {
    characters: [makeChar("Avatar", intelligence, currentHp), makeChar("Iolo", intelligence, currentHp)],
    partySize: 2,
    activeCharacter: 0,
    food: 100,
    gems: 3,
    time: { year: 139, month: 4, day: 7, hour: 12, minute: 0 },
    turnsSinceStart: 0,
    position: { location: 0, floor: 0, x: PX, y: PY },
    transport: "foot",
    torchTurns: 0,
    torches: 2,
    prevHour: 12,
  } as GameState;
}

/**
 * Overworld de hierba con `tile` al ESTE de la party (la casilla que se mira).
 * MEMOIZADO por tile: el barrido de semillas construye decenas de `Game` y una malla
 * 256×256 por cada uno hacía que el fichero se pasara del timeout al correr con la
 * suite entera (en solitario iba). El mundo es de solo-lectura en estos tests.
 */
const WORLDS = new Map<number, WorldData>();
function makeWorld(tile: number): WorldData {
  const cached = WORLDS.get(tile);
  if (cached) return cached;
  const overworld = Array.from({ length: 256 }, () =>
    Array.from({ length: 256 }, () => GRASS),
  );
  overworld[PY]![PX + 1] = tile;
  const world: WorldData = { overworld, underworld: overworld, smallMaps: new Map() };
  WORLDS.set(tile, world);
  return world;
}

const gameData: GameData = {
  locationsX: Array.from({ length: 41 }, () => 250),
  locationsY: Array.from({ length: 41 }, () => 250),
  locationNames: Array.from({ length: 41 }, (_, i) => `Loc${i + 1}`),
  // LOOK2.DAT sintético: la frase genérica del tile de la bola. Si el port cayera en
  // la rama genérica en vez de en la de 0x29, este texto saldría — y los tests lo cazan.
  look2: Array.from({ length: 256 }, (_, i) => (i === BALL ? "a crytal sphere" : "a thing")),
};

function makeGame(tile: number, intelligence: number, currentHp = 50): Game {
  return new Game({} as never, makeWorld(tile), gameData, makeState(intelligence, currentHp));
}

type Ev = { kind: string; text?: string; gemFromCrystalBall?: boolean };
const texts = (ev: readonly Ev[]): string[] =>
  ev.filter((e) => e.kind === "message").map((e) => e.text ?? "");

describe("#144 — candados de los literales del binario", () => {
  it("las constantes exportadas SON las del asm (tile, cotas, daño)", () => {
    expect(CRYSTAL_BALL_TILE).toBe(BALL);
    expect(CRYSTAL_BALL_ROLL_MIN).toBe(ROLL_MIN);
    expect(CRYSTAL_BALL_ROLL_MAX).toBe(ROLL_MAX);
    expect(CRYSTAL_BALL_DEATH_DAMAGE).toBe(1); // `mov ax,1` @0x0a1c
  });
});

describe("#144 — polaridad del `ja` (LOOKOBJ 0x0a0e), función pura", () => {
  it("INT > tirada GANA", () => {
    expect(crystalBallWins(20, 19)).toBe(true);
    expect(crystalBallWins(31, ROLL_MAX)).toBe(true);
  });
  it("el EMPATE pierde (`ja` es estrictamente mayor)", () => {
    expect(crystalBallWins(20, 20)).toBe(false);
  });
  it("INT < tirada PIERDE", () => {
    expect(crystalBallWins(19, 20)).toBe(false);
    expect(crystalBallWins(INT_ALWAYS_LOSES, ROLL_MIN)).toBe(false);
  });
});

describe("#144 — (L)ook sobre la bola CORTA antes de la descripción genérica", () => {
  it("no imprime «Thou dost see» ni la frase LOOK2: emite el prompt de PJ", () => {
    const ev = makeGame(BALL, 20).look("east") as Ev[];
    expect(ev.map((e) => e.kind)).toEqual(["crystal-ball-prompt"]);
    expect(texts(ev)).toEqual([]);
  });

  it("CONTROL: un tile cualquiera SÍ sigue por la vía genérica «Thou dost see …»", () => {
    const ev = makeGame(0x06, 20).look("east") as Ev[];
    expect(ev.map((e) => e.kind)).toEqual(["message"]);
    expect(texts(ev)[0]).toContain("Thou dost see");
  });
});

describe("#144 — la visión de MUERTE (INT <= tirada, LOOKOBJ 0x0a12)", () => {
  it("imprime «Death vision!» y NADA más de texto", () => {
    const ev = makeGame(BALL, INT_ALWAYS_LOSES).crystalBall(0) as Ev[];
    expect(texts(ev)).toEqual(["Death vision!"]);
  });

  it("quita 1 HP AL PJ ELEGIDO (apply_damage(idx,1), kernel 0x2A52) y a nadie más", () => {
    const game = makeGame(BALL, INT_ALWAYS_LOSES);
    game.crystalBall(1); // el elegido es el SEGUNDO miembro, no el activo
    expect(game.state.characters[1]!.currentHp).toBe(49);
    expect(game.state.characters[0]!.currentHp).toBe(50);
  });

  it("PUEDE MATAR: a 1 HP el PJ cae a 0 con status 'D' y se deselecciona el activo", () => {
    const game = makeGame(BALL, INT_ALWAYS_LOSES, 1);
    game.crystalBall(0);
    expect(game.state.characters[0]!.currentHp).toBe(0);
    expect(game.state.characters[0]!.status).toBe("D");
    expect(game.state.activeCharacter).toBe(0xff); // 0x2a9b `mov [g_active_char], 0xff`
  });

  it("emite party-changed (el redraw 0x8670) y NINGUNA vista aérea", () => {
    const ev = makeGame(BALL, INT_ALWAYS_LOSES).crystalBall(0) as Ev[];
    expect(ev.map((e) => e.kind)).toEqual(["message", "party-changed"]);
  });
});

describe("#144 — la visión EXTRAÑA (INT > tirada, LOOKOBJ 0x0a2a)", () => {
  it("imprime «Strange vision!» y abre la vista aérea", () => {
    const ev = makeGame(BALL, INT_ALWAYS_WINS).crystalBall(0) as Ev[];
    expect(texts(ev)).toEqual(["Strange vision!"]);
    expect(ev.map((e) => e.kind)).toEqual(["message", "gem-view"]);
  });

  it("NO consume gema: el `dec [g_gems]` es del case V del despachador (0x3428)", () => {
    const game = makeGame(BALL, INT_ALWAYS_WINS);
    const before = game.state.gems;
    game.crystalBall(0);
    expect(game.state.gems).toBe(before);
  });

  it("marca la vista como venida de la bola (cerrarla no cobra el turno de (V))", () => {
    const ev = makeGame(BALL, INT_ALWAYS_WINS).crystalBall(0) as Ev[];
    expect(ev.find((e) => e.kind === "gem-view")?.gemFromCrystalBall).toBe(true);
  });

  it("no hace daño a nadie", () => {
    const game = makeGame(BALL, INT_ALWAYS_WINS);
    game.crystalBall(0);
    expect(game.state.characters.slice(0, 2).map((c) => c.currentHp)).toEqual([50, 50]);
  });
});

describe("#144 — consumo del stream RNG (la tirada de 0x09f6)", () => {
  /**
   * `crystalBall` gasta EXACTAMENTE una tirada, y la gasta en las DOS ramas (el
   * `call rand_range` está ANTES del `cmp`, en 0x09f6). Se mide por delta de semilla
   * contra el turno gemelo: dos llamadas desde la misma semilla dejan el stream en el
   * mismo sitio que UNA llamada suelta al mismo generador desde esa semilla, repetida.
   */
  function seedAfterCrystalBall(intelligence: number): number {
    const game = makeGame(BALL, intelligence);
    game.reseed(0x1234);
    game.crystalBall(0);
    return game.liveSeed();
  }

  it("gasta 1 tirada en la rama de MUERTE y 1 en la de VISIÓN (misma semilla final)", () => {
    // Mismo punto del stream en las dos ramas ⇒ el consumo no depende del resultado.
    expect(seedAfterCrystalBall(INT_ALWAYS_LOSES)).toBe(seedAfterCrystalBall(INT_ALWAYS_WINS));
  });

  it("la semilla AVANZA (no es una rama sin RNG)", () => {
    const game = makeGame(BALL, INT_ALWAYS_WINS);
    game.reseed(0x1234);
    const before = game.liveSeed();
    game.crystalBall(0);
    expect(game.liveSeed()).not.toBe(before);
  });

  it("la tirada cae SIEMPRE en [1,30]: con INT=1 gana sólo si sale más de 1", () => {
    // Barrido de semillas: con INT=31 gana siempre y con INT=0 pierde siempre. Si el
    // rango estuviera mal (p.ej. rand(0,30) o rand(1,31)) uno de los dos rompería.
    for (let s = 1; s <= 120; s++) {
      const win = makeGame(BALL, INT_ALWAYS_WINS);
      win.reseed(s);
      expect((win.crystalBall(0) as Ev[])[0]!.text).toBe("Strange vision!");
      const lose = makeGame(BALL, INT_ALWAYS_LOSES);
      lose.reseed(s);
      expect((lose.crystalBall(0) as Ev[])[0]!.text).toBe("Death vision!");
    }
  });

  it("(L)ook sobre la bola NO gasta tirada por sí solo (el rand va tras el selector)", () => {
    // LOOKOBJ 0x09f0 `inc ax; jne`: si el selector devuelve -1 se salta al epílogo SIN
    // llegar al rand. En el port el selector vive en la UI, así que `look()` sólo emite
    // el prompt — y no puede haber tocado el stream.
    const game = makeGame(BALL, 20);
    game.reseed(0x1234);
    const before = game.liveSeed();
    game.look("east");
    expect(game.liveSeed()).toBe(before);
  });
});
