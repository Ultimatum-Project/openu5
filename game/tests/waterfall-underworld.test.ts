/**
 * CATARATA al Underworld (auditoría de cobertura, ítem `str-waterfall-underworld`).
 *
 * Citas (re/disasm):
 *  - OUTSUBS.OVL falls 0x0458: "F-A-L-L-S!!!\n" (DS 0x39b5, DATA.OVL fileoff
 *    0x39c5) @0x0460; bucle de daño por miembro 0x04b6 (salta status 'D'; roll
 *    kernel 0x3abe = max(1, rand(0,0x3c)>>1) vs DEX roster+0xD, fallo → −1 HP
 *    vía damage_member kernel 0x2a52); posición (0x36,0x8a) @0x0500-0x050c →
 *    "Falling into underworld!!\n" (DS 0x39c3) + g_floor=0xFF @0x0515 +
 *    BRIT.OOL→UNDER.OOL. Transporte y (x,y) preservados.
 *  - Trigger: MAINOUT 0x05b2-0x05bb / 0x0d05-0x0d0e — tile al SUR de la party
 *    (g_unk_abc7, el vecino-sur del clavicémbalo) & 0xfc == 0xD4.
 *  - ★ #322: el +2 al sur NO es una aproximación — son los DOS
 *    `party_move_by_delta(dy=1, dx=0)` de 0x046e y 0x047f (thunk PLINK86 0x7bc6
 *    → MAINOUT.OVL fileoff 0x0354, `add [g_party_x],al` / `add [g_party_y],al`).
 *    No interviene ninguna «corriente de río»: `outsubs_waterfall_fall` no escribe
 *    `g_party_y` en ningún sitio.
 *  - BANCO que SÍ sigue vivo: las TRES llamadas a 0x3AE6 (0x0475(1), 0x04a5(1),
 *    0x04f7(2) = CUATRO unidades) son ticks de mundo — 0x3AE6 hace n × { 0x5910
 *    viewport_redraw + 0x20fa(1) } y 0x5910 llama a `0x2f62 maybe_change_wind`,
 *    que abre con `rand_range(0,0x3f)`. El port no los corre ⇒ cablearlos MOVERÁ
 *    EL STREAM. Es el consumidor #1 ya adjudicado en re/deliberate-divergences.md
 *    §Addendum-task-#17 (RNG-en-render), pero con cadencia DETERMINISTA (4 exactos,
 *    por evento) en vez del timer idle — ver el docblock de `checkWaterfall`.
 *    Y la ocultación del transporte (0x049d guarda / 0x04fa-0x04fd restaura)
 *    cubre sólo frames(1)+daño+frames(2), NO los dos pasos.
 *  - Britannia tiene 3 cataratas — (46,91), (100,97), (54,137) — y SOLO la de
 *    (54,137) deja a la party en (0x36,0x8a)=(54,138): la única entrada al
 *    Underworld (por eso el binario compara la posición en duro).
 */
import { describe, expect, it } from "vitest";
import type { CharacterState, ExtractedInitialState, GameState } from "../src/core/state.js";
import { Game, type GameData } from "../src/core/game.js";
import { SFX_CATALOG } from "../src/skin/fiel/speaker.js";
import type { WorldData } from "../src/core/world/map.js";

function makeChar(over: Partial<CharacterState> = {}): CharacterState {
  return {
    name: "Test", gender: 0x0b, class: "A", status: "G",
    strength: 20, dexterity: 20, intelligence: 20, currentMp: 10,
    currentHp: 50, maxHp: 60, exp: 0, level: 2, monthsAtInn: 0,
    helmet: 0xff, armor: 0xff, weapon: 0xff, shield: 0xff, ring: 0xff, amulet: 0xff,
    partyStatus: 0, ...over,
  } as CharacterState;
}

function makeState(over: Partial<GameState> = {}): GameState {
  const base: Partial<GameState> = {
    version: 1,
    characters: [makeChar()], partySize: 1, activeCharacter: 0,
    food: 100, gold: 100, magicCarpets: 0,
    time: { year: 139, month: 4, day: 7, hour: 12, minute: 0 },
    turnsSinceStart: 0, position: { location: 0, floor: 0, x: 54, y: 135 },
    transport: "skiff", transportTile: 0x2a, // skiff rumbo SUR (0x28+2)
    torchTurns: 0, torches: 2, prevHour: 12, wind: 0,
    shards: { falsehood: false, hatred: false, cowardice: false },
    lbArtifacts: { amulet: false, crown: false, sceptre: false },
    questFlags: {},
    worldObjects: [],
    specialItems: { spyglass: false, hmsCape: false, sextant: false, pocketWatch: false, blackBadge: false, woodenBox: false },
  };
  return { ...base, ...over } as GameState;
}

/** Mundo de agua profunda (tile 1) con cataratas puntuales (0xd4). */
function makeWorld(spots: { x: number; y: number; tile: number }[]): WorldData {
  const overworld = Array.from({ length: 256 }, () => Array<number>(256).fill(1));
  for (const s of spots) overworld[s.y]![s.x] = s.tile;
  return { overworld, underworld: overworld, smallMaps: new Map() };
}
const gameData: GameData = { locationsX: [], locationsY: [], locationNames: [] };

function makeGame(s: GameState, world: WorldData): Game {
  return new Game({} as ExtractedInitialState, world, gameData, s, {});
}

const msgs = (evs: { kind: string; text?: string }[]): string[] =>
  evs.filter((e) => e.kind === "message").map((e) => e.text!);

describe("catarata (OUTSUBS 0x0458)", () => {
  it("remar hasta el tile sobre LA catarata (54,136) dispara F-A-L-L-S + entrada al Underworld en (0x36,0x8a)", () => {
    const st = makeState();
    const game = makeGame(st, makeWorld([{ x: 54, y: 137, tile: 0xd4 }]));
    const evs = game.move("south"); // (54,135) → (54,136); vecino-sur = 0xd4
    const m = msgs(evs);
    expect(m).toContain("F-A-L-L-S!!!\n"); // DS 0x39b5
    expect(m).toContain("Falling into underworld!!\n"); // DS 0x39c3
    expect(st.position.floor).toBe(0xff); // g_floor=0xFF @0x0515
    expect(st.position.x).toBe(0x36); // 54 — (x,y) preservadas tras el arrastre
    expect(st.position.y).toBe(0x8a); // 138 = 136+2 (arrastre neto catarata abajo)
    expect(st.transport).toBe("skiff"); // transporte preservado (0x049d guarda/0x04fa restaura)
  });

  it("una catarata que NO deja a la party en (0x36,0x8a) NO baja al Underworld", () => {
    const st = makeState({ position: { location: 0, floor: 0, x: 100, y: 95 } });
    const game = makeGame(st, makeWorld([{ x: 100, y: 97, tile: 0xd4 }]));
    const evs = game.move("south"); // (100,96); vecino-sur catarata
    const m = msgs(evs);
    expect(m).toContain("F-A-L-L-S!!!\n");
    expect(m).not.toContain("Falling into underworld!!\n");
    expect(st.position.floor).toBe(0); // sigue en Britannia
    expect(st.position.y).toBe(98); // arrastrada catarata abajo
  });

  it("daño gateado por DEX (bucle 0x04b6): DEX 31 esquiva siempre (roll máx 30); DEX 1 recibe −1 HP", () => {
    // roll = max(1, rand(0,0x3c)>>1) ∈ 1..30 → DEX 31 > roll SIEMPRE (ja @0x04d2).
    const stA = makeState({ characters: [makeChar({ dexterity: 31 })] });
    const gA = makeGame(stA, makeWorld([{ x: 54, y: 137, tile: 0xd4 }]));
    gA.move("south");
    expect(stA.characters[0]!.currentHp).toBe(50);
    // DEX 1 nunca supera el roll (mínimo 1, `ja` estricto) → −1 HP (kernel 0x2a52).
    const stB = makeState({ characters: [makeChar({ dexterity: 1 })] });
    const gB = makeGame(stB, makeWorld([{ x: 54, y: 137, tile: 0xd4 }]));
    gB.move("south");
    expect(stB.characters[0]!.currentHp).toBe(49);
  });

  it("los miembros muertos ('D') se saltan sin consumir tirada (0x04c1 cmp 'D')", () => {
    const st = makeState({
      characters: [makeChar({ status: "D", currentHp: 0 }), makeChar({ dexterity: 1 })],
      partySize: 2,
    });
    const game = makeGame(st, makeWorld([{ x: 54, y: 137, tile: 0xd4 }]));
    game.move("south");
    expect(st.characters[0]!.currentHp).toBe(0); // el muerto ni se toca
    expect(st.characters[1]!.currentHp).toBe(49);
  });

  // ★ #322 — el cue de la caída. Esperados EN CRUDO: los cuatro literales son los
  // inmediatos de OUTSUBS 0x0482-0x0491 leídos del disasm (0x9c4=2500, 0x320=800,
  // 1, 0x12c=300), NO se calculan desde el sujeto.
  it("la caída emite el glissando propio `waterfall-fall`, NO el préstamo `quake`", () => {
    const st = makeState();
    const game = makeGame(st, makeWorld([{ x: 54, y: 137, tile: 0xd4 }]));
    const sfx = game.move("south").filter((e) => e.kind === "sfx").map((e) => (e as { sfx: { id: string } }).sfx.id);
    expect(sfx).toContain("waterfall-fall"); // OUTSUBS 0x0492 → kernel 0x43AE
    expect(sfx).not.toContain("quake"); // el préstamo retirado (kernel 0x3072/0xaea2 es OTRA primitiva)
  });

  it("`waterfall-fall` rinde glide(2500→800) — los cuatro inmediatos de OUTSUBS 0x0482-0x0491", () => {
    const segs = SFX_CATALOG["waterfall-fall"]();
    expect(segs).toHaveLength(1);
    const seg = segs[0] as { kind: string; f0: number; f1: number; ms: number };
    expect(seg.kind).toBe("tone");
    expect(seg.f0).toBe(2500); // 0x9c4 @0x0482 (start)
    // 0x320=800 @0x0486 es la NOMINAL, que 0x43ae nunca compara (#137): el barrido corta
    // en la vuelta 300 con inc = trunc(−1700/300) = −5 ⇒ último tono 2500 − 5·299 = 1005.
    expect(seg.f1).toBe(1005);
    expect(seg.f0).toBeGreaterThan(seg.f1); // DESCENDENTE — la forma que el docblock afirma
    // total=0x12c=300 (@0x048e), misma ley de duración que el cañonazo (glide total=300).
    expect(seg.ms).toBeCloseTo((SFX_CATALOG["cannon-fire"]()[0] as { ms: number }).ms, 6);
  });

  it("sin catarata al sur no pasa nada (gate & 0xfc == 0xD4)", () => {
    const st = makeState();
    const game = makeGame(st, makeWorld([]));
    const evs = game.move("south");
    expect(msgs(evs)).not.toContain("F-A-L-L-S!!!\n");
    expect(st.position.y).toBe(136);
    expect(st.position.floor).toBe(0);
  });
});
