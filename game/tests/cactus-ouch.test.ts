/**
 * #157 — el «OUCH!» del CACTUS a pie, que el port declaraba como hueco propio.
 *
 * DERIVACIÓN. `ship_try_move` (MAINOUT.OVL 0x01fe+342, el nombre del ledger
 * `re/ledger/frontier.json`; este docblock decía `move_try`, nombre que acuñó
 * `cactus-ouch-acta.md` y que NO existe en el ledger — unificado en #178) es UNA sola
 * rutina para TODOS los modos:
 * su discriminador a-pie/vehículo es `cmp [g_transport_tile],0x20 / jb` (0x0312), y su
 * cola de BLOQUEO (0x0312-0x0347) la comparten pie y barco. Ahí está el hallazgo:
 *
 *   0322  print DS 0x29ae = "Blocked!\n"      ← SIEMPRE, sea cactus o no
 *   0329  cmp word ptr [bp-6], 0x2f           ← ¿el TILE DESTINO es cactus?
 *   032f    print DS 0x29b8 = "OUCH!\n"
 *   0336    call 0xffffa8d8 → CS 0x2AA8 = kernel_party_random_damage
 *           (rand(1,8) a cada miembro no muerto)
 *   033c  else: beep(0xa5,0xc8)               ← el bump de pared normal
 *
 * O sea: **el beep y el OUCH son ramas EXCLUYENTES**. El port ya decía «el bump por
 * cactus NO suena», pero lo decía como coartada de un hueco; el `else` de 0x033c es lo
 * que lo sostiene.
 *
 * Cadenas verificadas byte a byte en DATA.OVL (fileoff = DS + 0x10):
 *   DS 0x29ae → b'Blocked!\n'   ·   DS 0x29b8 → b'OUCH!\n'
 *
 * TESTIGO INDEPENDIENTE (LP1 part07-g12, ocrLn=917): «Blocked! 0UCH!» — las dos
 * cadenas, en el orden 0x0322 → 0x032f. El port imprimía «Blocked!» y se comía el OUCH.
 *
 * El cactus NAVAL ya estaba portado (`shipTryMove`, transport.ts) citando esta MISMA
 * rutina y esta MISMA rutina de daño; lo que faltaba era la vía a pie.
 */
import { describe, expect, it } from "vitest";
import { Game, type GameData } from "../src/core/game.js";
import type { CharacterState, GameState } from "../src/core/state.js";
import type { WorldData } from "../src/core/world/map.js";
import { TILE_CACTUS } from "../src/core/world/transport.js";

/**
 * El tile del cactus, LITERAL a propósito: si el test importara sólo la constante, un
 * código sin el fix fallaría por `undefined` (error de import) en vez de por la
 * ASERCIÓN, y el rojo dejaría de demostrar el defecto. El literal viene del binario
 * (`cmp word ptr [bp-6], 0x2f`, MAINOUT 0x0329); abajo se comprueba que la constante
 * exportada coincide, así que la duplicación no puede derivar en silencio.
 */
const CACTUS = 0x2f;

const PX = 50;
const PY = 50;
const GRASS = 5; // transitable a pie
const MOUNTAIN = 0x0c; // montaña — intransitable NO-cactus (control del beep; carpet-b2.md)

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
  } as GameState;
}

/** Overworld de hierba con `blocker` al ESTE de la party. */
function makeWorld(blocker: number): WorldData {
  const overworld = Array.from({ length: 256 }, () =>
    Array.from({ length: 256 }, () => GRASS),
  );
  overworld[PY]![PX + 1] = blocker;
  return { overworld, underworld: overworld, smallMaps: new Map() };
}

const gameData: GameData = {
  locationsX: Array.from({ length: 41 }, () => 250),
  locationsY: Array.from({ length: 41 }, () => 250),
  locationNames: Array.from({ length: 41 }, (_, i) => `Loc${i + 1}`),
};

function makeGame(blocker: number): Game {
  return new Game({} as never, makeWorld(blocker), gameData, makeState());
}

function texts(events: readonly { kind: string; text?: string }[]): string[] {
  return events.filter((e) => e.kind === "message").map((e) => e.text ?? "");
}

/** El cue viaja en `sfx: { id }` (sfx.ts::sfxEvent), no en un `id` de primer nivel. */
function sfxIds(events: readonly { kind: string; sfx?: { id: string } }[]): string[] {
  return events.filter((e) => e.kind === "sfx").map((e) => e.sfx?.id ?? "");
}

describe("#157 — cactus a pie: «Blocked!» + «OUCH!» + daño (MAINOUT 0x0329)", () => {
  it("la constante exportada ES el 0x2f del binario (candado de la duplicación)", () => {
    expect(TILE_CACTUS).toBe(CACTUS);
  });

  it("imprime OUCH! DESPUÉS de Blocked! (orden 0x0322 → 0x032f)", () => {
    const game = makeGame(CACTUS);
    const ev = game.move("east") as { kind: string; text?: string }[];
    const msgs = texts(ev);
    expect(msgs).toContain("Blocked!");
    expect(msgs).toContain("OUCH!");
    // El orden importa: es el del testigo LP1 «Blocked! 0UCH!».
    expect(msgs.indexOf("Blocked!")).toBeLessThan(msgs.indexOf("OUCH!"));
  });

  it("PINCHA al party: rand(1,8) por miembro vivo (kernel 0x2AA8)", () => {
    const game = makeGame(CACTUS);
    const before = game.state.characters.slice(0, 2).map((c) => c.currentHp);
    game.move("east");
    const after = game.state.characters.slice(0, 2).map((c) => c.currentHp);
    // Los DOS miembros vivos pierden entre 1 y 8 (el barrido es por miembro).
    for (let i = 0; i < 2; i++) {
      const lost = before[i]! - after[i]!;
      expect(lost).toBeGreaterThanOrEqual(1);
      expect(lost).toBeLessThanOrEqual(8);
    }
  });

  it("el cactus NO emite el beep de choque (son ramas EXCLUYENTES, 0x033c es el else)", () => {
    const game = makeGame(CACTUS);
    const ev = game.move("east") as { kind: string; sfx?: { id: string } }[];
    expect(sfxIds(ev)).not.toContain("move-blocked");
  });

  it("la party NO se mueve: el cactus sigue siendo intransitable", () => {
    const game = makeGame(CACTUS);
    game.move("east");
    expect(game.state.position.x).toBe(PX);
  });

  // ── CONTROLES: un bloqueo NO-cactus se comporta como siempre ──
  it("CONTROL: contra montaña hay Blocked! + beep, y NI OUCH NI daño", () => {
    const game = makeGame(MOUNTAIN);
    const before = game.state.characters[0]!.currentHp;
    const ev = game.move("east") as { kind: string; text?: string; sfx?: { id: string } }[];
    const msgs = texts(ev);
    expect(msgs).toContain("Blocked!");
    expect(msgs).not.toContain("OUCH!");
    expect(sfxIds(ev)).toContain("move-blocked");
    expect(game.state.characters[0]!.currentHp).toBe(before);
  });

  it("CONTROL: un paso LIBRE no imprime nada de esto", () => {
    const game = makeGame(MOUNTAIN);
    const ev = game.move("west") as { kind: string; text?: string }[];
    const msgs = texts(ev);
    expect(msgs).not.toContain("Blocked!");
    expect(msgs).not.toContain("OUCH!");
    expect(game.state.position.x).toBe(PX - 1);
  });
});
