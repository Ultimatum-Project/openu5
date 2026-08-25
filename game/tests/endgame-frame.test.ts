/**
 * Task #34 — VENTANA-FRAME del ENDGAME: tests del wiring nuevo.
 *
 *  1. `buildEndgameScript` H2c: ensamblado runtime del record 0 (rec0 + nombre + `!"`,
 *     derivation guion-table beat 1) + pausas MUDAS del censo GAP 8 (adenda fanfarria-re
 *     2026-07-22: 0x3ae6 = run-n-frames, sin beeps — sólo delayUnits).
 *  2. `buildOrbMoongateTimeline`: coreografía byte-derivada de endgame_main 0x0961-0x0a73
 *     (orb → reveal 15 frames mudos → LB primero → party uno a uno con pasos `move-step`
 *     → cierre 15 frames mudos → gate fuera).
 *  3. `endgameDissolveOrder`: permutación completa (cada píxel exactamente una vez).
 *  4. CoreView: `setEndgameScene` hornea sala+sprites en `window`, suprime mazmorra y
 *     expone el descriptor; el evento del core lleva el guión con endgameText inyectado.
 */
import { describe, expect, it } from "vitest";
import { buildEndgameScript, type EndgameText } from "../src/core/endgame/sequence.js";
import { endgameDissolveOrder } from "../src/core/transition/endgameDissolve.js";
import {
  buildOrbMoongateTimeline,
  endgameLineup,
  EndgamePrisonWander,
  LB_SEATED,
  LB_WALK_TILE,
} from "../src/skin/endgameScene.js";
import {
  GATE_CELL,
  LB_THRONE,
  MOONGATE_STEPS,
  PARTY_LINEUP,
} from "../src/skin/fiel/endgame-scene.js";
import type { CharacterState, ExtractedInitialState, GameState } from "../src/core/state.js";
import { Combat, type CombatMapData } from "../src/core/combat/combat.js";
import { Game, type GameData } from "../src/core/game.js";
import type { WorldData } from "../src/core/world/map.js";
import { DungeonState, CellType, type DungeonCell, type DungeonData } from "../src/core/dungeon/dungeon.js";
import { CoreViewImpl } from "../src/skin/coreview.js";
import { TILE_HIDDEN, VIEW_WINDOW } from "../src/skin/api.js";

const TEXT: EndgameText = {
  dialogue: Array.from({ length: 11 }, (_, i) => (i === 0 ? '\nLord British says:\n\n"Well met,\n' : `rec${i}`)),
  narration: Array.from({ length: 6 }, (_, i) => `page${i}`),
};

describe("buildEndgameScript — ensamblado del nombre + cues GAP 8 (H2c)", () => {
  it("beat 0 = rec0 + nombre + '!\"' (ensamblado runtime del binario)", () => {
    const script = buildEndgameScript("victory", TEXT, "GERALT");
    const first = script.beats.find((b) => b.phase === "dialogue")!;
    expect(first.message).toBe('\nLord British says:\n\n"Well met,\nGERALT!"');
  });

  it("sin nombre (tests H1) el record 0 viaja crudo", () => {
    const script = buildEndgameScript("victory", TEXT);
    const first = script.beats.find((b) => b.phase === "dialogue")!;
    expect(first.message).toBe(TEXT.dialogue[0]);
  });

  // RE-BASELINE (adenda fanfarria-re 2026-07-22, re/notes/fanfarria-endgame-espectral.md
  // §3/§7): 0x3ae6 = RUN-N-FRAMES, no beep — los «beeps» del censo GAP 8 son PAUSAS
  // MUDAS. El guión ya no hornea cues de `endgame-beep` (cue retirado del catálogo).
  it("re-tinte verde: 1 beat MUDO con el pump de llegada 0x28 (0x06f2, run-n-frames)", () => {
    const script = buildEndgameScript("victory", TEXT, "X");
    const greens = script.beats.filter((b) => b.phase === "greenScene");
    expect(greens.length).toBe(1);
    expect(greens[0]!.sfx).toBeUndefined();
    expect(greens[0]!.delayUnits).toBe(0x28);
  });

  it("páginas de historia y pergamino MUDOS (pumps 0x0830/0x0922 = pausas, no beeps)", () => {
    const script = buildEndgameScript("victory", TEXT, "X");
    const houses = script.beats.filter((b) => b.phase === "storyHouse");
    const dreams = script.beats.filter((b) => b.phase === "storyDream");
    const scroll = script.beats.find((b) => b.phase === "scroll")!;
    for (const b of [...houses, ...dreams, scroll]) expect(b.sfx).toBeUndefined();
    // Cada beat de historia lleva su página (lámina del atlas por orden de fichero).
    expect(houses.map((b) => b.page)).toEqual([0, 1]);
    expect(dreams.map((b) => b.page)).toEqual([2, 3, 4, 5]);
  });

  it("rama varada: «pull up a chair» (rec 10) lleva el pump 0x28 MUDO (0x0a81)", () => {
    const script = buildEndgameScript("stranded", TEXT, "X");
    const last = script.beats.filter((b) => b.phase === "dialogue").pop()!;
    expect(last.message).toBe("rec10");
    expect(last.sfx).toBeUndefined();
    expect(last.delayUnits).toBe(0x28);
  });

  it("tras el pergamino, SILENCIO: ningún beat del guión de victoria lleva cue salvo ninguno (todo mudo)", () => {
    const script = buildEndgameScript("victory", TEXT, "X");
    expect(script.beats.every((b) => b.sfx === undefined)).toBe(true);
    expect(script.beats[script.beats.length - 1]!.phase).toBe("terminalFreeze");
  });
});

describe("buildOrbMoongateTimeline — coreografía 0x0961-0x0a73 (GAP 4)", () => {
  const partyTiles = [0x14c, 0x140, 0x144];
  const frames = buildOrbMoongateTimeline(LB_WALK_TILE, partyTiles);

  it("arranca con el ORB (parpadeo + barrido endgame-orb) antes del gate", () => {
    expect(frames[0]!.orb).toEqual({ col: GATE_CELL.col, row: GATE_CELL.row });
    expect(frames[0]!.sfx).toEqual({ id: "endgame-orb" });
    expect(frames[0]!.moongate).toBeNull();
    expect(frames[2]!.orb).toBeNull(); // la partícula desaparece
  });

  // RE-BASELINE (adenda fanfarria-re §3/§7): el reveal/cierre del gate son 15 frames
  // MUDOS de animación (los «tonos asc/desc» del censo eran ticks de pacing); los
  // ÚNICOS cues de la fase son el sweep del orb (0x0973) y `move-step` por cada paso
  // de sprite (0x04fe→0x433e→0x223c, llamado por move_sprite_toward 0x510@0x595).
  it("el gate BROTA 1..16 en frames MUDOS (reveal de animación, sin tonos)", () => {
    const rising = frames.filter((f) => f.orb === null && f.moongate !== null);
    expect(rising.slice(0, 16).map((f) => f.moongate)).toEqual(
      Array.from({ length: 16 }, (_, i) => i + 1),
    );
    expect(rising.slice(0, 16).every((f) => f.sfx === undefined)).toBe(true);
  });

  it("LB entra el PRIMERO y cada paso de sprite suena `move-step` (0x04fe→0x433e)", () => {
    // LB desaparece antes que ningún miembro (orden de entrada del binario).
    const lbGone = frames.findIndex((f) => !f.actors.some((a) => a.tile === LB_WALK_TILE));
    const firstMemberGone = frames.findIndex(
      (f) => f.actors.filter((a) => a.tile !== LB_WALK_TILE).length < partyTiles.length,
    );
    expect(lbGone).toBeGreaterThan(0);
    expect(lbGone).toBeLessThan(firstMemberGone);
    // Todo frame de CAMINATA (gate lleno, sprites avanzando) lleva el click-clack del
    // paso; los frames de borrado/pacing (tick(1)/tick(4) del binario) son MUDOS.
    const steps = frames.filter((f) => f.sfx?.id === "move-step");
    expect(steps.length).toBeGreaterThan(0);
    expect(steps.every((f) => f.moongate === MOONGATE_STEPS)).toBe(true);
    // Ningún otro cue en la fase: sólo el orb-sweep inicial y los pasos.
    const cues = frames.filter((f) => f.sfx);
    expect(cues.every((f) => f.sfx!.id === "move-step" || f.sfx!.id === "endgame-orb")).toBe(true);
  });

  it("el gate se CIERRA 15→1 (contador 0x5887=0xf) en frames MUDOS y acaba vacío", () => {
    const last = frames[frames.length - 1]!;
    expect(last.moongate).toBeNull();
    expect(last.actors.length).toBe(0); // todos entraron al gate
    // Cola de cierre: las últimas 15 etapas con gate son 15..1 descendentes, sin sonido.
    const gateFrames = frames.filter((f) => f.moongate !== null);
    const closing = gateFrames.slice(-15);
    expect(closing.map((f) => f.moongate)).toEqual(Array.from({ length: 15 }, (_, i) => 15 - i));
    expect(closing.every((f) => f.sfx === undefined)).toBe(true);
  });
});

describe("endgameDissolveOrder — permutación completa (GAP 5, orden fn34)", () => {
  // Timeout ancho por CARGA, no por lentitud: aislado tarda ~430 ms, pero con varios
  // carriles gateando en paralelo en la máquina el default de 5 s da un rojo FALSO
  // (medido: rojo en una corrida de suite entera, verde en la siguiente y verde aislado).
  // Mismo remedio y misma razón que `ranged-room-drive-r15`.
  it("cubre cada píxel del frame 320×200 exactamente una vez", { timeout: 30_000 }, () => {
    const order = endgameDissolveOrder(320 * 200);
    expect(order.length).toBe(64000);
    const seen = new Uint8Array(64000);
    for (const p of order) {
      expect(p).toBeLessThan(64000);
      seen[p]!++;
    }
    expect(seen.every((c) => c === 1)).toBe(true);
  });

  it("es determinista (misma semilla → mismo orden)", () => {
    const a = endgameDissolveOrder(1000);
    const b = endgameDissolveOrder(1000);
    expect(Array.from(a.slice(0, 32))).toEqual(Array.from(b.slice(0, 32)));
  });
});

describe("endgameLineup + sala-prisión (GAP 2/3b)", () => {
  it("LB de pie junto al trono (5,3) + party en la formación DATA.OVL 0x3e5a/0x3e60", () => {
    const actors = endgameLineup(LB_WALK_TILE, [1, 2, 3]);
    expect(actors[0]).toEqual({ tile: LB_WALK_TILE, col: LB_THRONE.col, row: LB_THRONE.row });
    expect(actors.slice(1).map((a) => ({ col: a.col, row: a.row }))).toEqual(
      PARTY_LINEUP.slice(0, 3).map((p) => ({ col: p.col, row: p.row })),
    );
  });

  it("el wander de la prisión mantiene a LB SENTADO fijo y mueve la party por suelo 0x44", () => {
    const room = Array.from({ length: 11 }, () => Array.from({ length: 11 }, () => 0x44));
    const party = endgameLineup(LB_WALK_TILE, [1, 2]).slice(1);
    const wander = new EndgamePrisonWander(LB_SEATED, party, room);
    for (let i = 0; i < 20; i++) {
      const actors = wander.step();
      expect(actors[0]).toEqual(LB_SEATED); // LB sentado, inmóvil (0x0a8b)
      expect(actors.length).toBe(3);
    }
  });
});

// ── CoreView + Game: horneado de la escena y emisión del guión ─────────────────────

function makeChar(over: Partial<CharacterState> = {}): CharacterState {
  return {
    name: "Test", gender: 0x0b, class: "A", status: "G",
    strength: 20, dexterity: 20, intelligence: 20,
    currentMp: 10, currentHp: 50, maxHp: 60, exp: 0, level: 2, monthsAtInn: 0,
    helmet: 0xff, armor: 0xff, weapon: 0xff, shield: 0xff, ring: 0xff, amulet: 0xff,
    partyStatus: 0, ...over,
  } as CharacterState;
}

function makeState(over: Partial<GameState> = {}): GameState {
  const base: Partial<GameState> = {
    characters: [makeChar({ name: "GERALT" }), makeChar({ name: "Iolo", class: "B" })],
    partySize: 2, activeCharacter: 0, food: 100, gold: 150,
    time: { year: 140, month: 4, day: 5, hour: 12, minute: 0 },
    turnsSinceStart: 0,
    position: { location: 40, floor: 7, x: 4, y: 7 },
    transport: "foot", torchTurns: 50, torches: 2, prevHour: 12,
    questFlags: {
      "in-doom": true,
      "shadowlord-dead:falsehood": true,
      "shadowlord-dead:hatred": true,
      "shadowlord-dead:cowardice": true,
    },
    lbArtifacts: { amulet: true, crown: true, sceptre: true },
    specialItems: {
      spyglass: false, hmsCape: false, sextant: false,
      pocketWatch: false, blackBadge: false, woodenBox: true,
    },
  };
  return { ...base, ...over } as GameState;
}

function grassWorld(): WorldData {
  const overworld = Array.from({ length: 256 }, () => Array.from({ length: 256 }, () => 5));
  return { overworld, underworld: overworld, smallMaps: new Map() };
}

const gameData: GameData = { locationsX: [], locationsY: [], locationNames: [] };

const ROOM: number[][] = Array.from({ length: 11 }, (_, r) =>
  Array.from({ length: 11 }, (_, c) =>
    r === 0 || r === 10 || c === 0 || c === 10 ? (r === 0 && c === 0 ? 0xff : 0x4d) : 0x44,
  ),
);

function doomGame(over: Partial<GameState> = {}, endgameText?: EndgameText): Game {
  const g = new Game({} as ExtractedInitialState, grassWorld(), gameData, makeState(over), {
    endgameText,
  });
  const nothing = (): DungeonCell => ({ type: CellType.Nothing, sub: 0 });
  const floors = Array.from({ length: 8 }, () =>
    Array.from({ length: 8 }, () => Array.from({ length: 8 }, nothing)),
  );
  const doom: DungeonData = { location: 40, name: "Doom", floors };
  g.dungeonState = new DungeonState([doom], { dungeon: 40, floor: 7, x: 4, y: 7, facing: "north" });
  return g;
}

// #179 — el disparo migró de checkDoomRescue (regla sintética floor==7, retirada) a la
// cadena FIEL: absorción total en la celda de LB (cm127) → centinela → endCombat desvía
// (fireAbsorptionEndgame). El arnés ejerce esa cadena real: combate con el alma del .CBT,
// cada miembro pisa (5,2) y el teardown emite el guión. Derivación: absorcion-179-acta.md.
function absorbAndEnd(g: Game): ReturnType<Game["endCombat"]> {
  const soulMap: CombatMapData = {
    index: 127,
    territory: "dungeon",
    name: null,
    tiles: ROOM.map((row) => row.slice()),
    playerStarts: {
      east: [{ x: 5, y: 6 }, { x: 6, y: 6 }],
      west: [{ x: 5, y: 6 }, { x: 6, y: 6 }],
      south: [{ x: 5, y: 6 }, { x: 6, y: 6 }],
      north: [{ x: 5, y: 6 }, { x: 6, y: 6 }],
    },
    units: [{ sprite: 0x3c, x: 5, y: 1 }], // el alma atrapada del .CBT de cm127
    triggers: [],
  };
  const st = g.state;
  const party = st.characters
    .filter((c) => c.partyStatus === 0)
    .map((record) => ({
      charIdx: st.characters.indexOf(record),
      record,
      weapons: [{ attack: 10, range: 1 }],
    }));
  const combat = new Combat({
    map: soulMap,
    entryDirection: "south",
    party,
    enemies: { fixedFromMap: true, defs: [] },
    seed: 0,
    state: st,
    defenseValues: [],
    spellAttackRange: [],
    enemyDefs: [],
    roomCombat: true,
  });
  let guard = 0;
  while (!combat.over && guard++ < 50) {
    const cur = combat.currentUnit;
    if (!cur || cur.kind !== "player") break;
    cur.x = 5;
    cur.y = 3;
    combat.playerMove("north"); // pisa (5,2) bajo el alma → absorbido
  }
  expect(combat.absorptionSentinel, "la cadena real arma el centinela").toBe(true);
  g.combat = combat;
  return g.endCombat();
}

describe("desvío del desenlace por absorción — emisión del guión con endgameText inyectado (#34/#179)", () => {
  it("con endgameText: el evento endgame lleva el GUIÓN completo con el nombre del avatar", () => {
    const g = doomGame({}, TEXT);
    const events = absorbAndEnd(g);
    const eg = events.find((e) => e.kind === "endgame")!;
    expect(eg).toBeDefined();
    expect(eg.ending).toBe("victory");
    expect(eg.endgame).toBeDefined();
    const first = eg.endgame!.beats.find((b) => b.phase === "dialogue")!;
    expect(first.message).toContain("GERALT!\"");
  });

  it("sin endgameText: el evento endgame viaja sólo con el ending (fallback)", () => {
    const g = doomGame();
    const events = absorbAndEnd(g);
    const eg = events.find((e) => e.kind === "endgame")!;
    expect(eg.ending).toBe("victory");
    expect(eg.endgame).toBeUndefined();
  });

  it("checkDoomRescue ya NO emite el desenlace: sólo marca in-doom (#179)", () => {
    const g = doomGame({}, TEXT);
    expect(g.checkDoomRescue()).toEqual([]);
    expect(g.state.questFlags["game-won"]).toBeUndefined();
  });
});

describe("CoreView.setEndgameScene — horneado de la sala (#34)", () => {
  it("fase de sala: hornea room+actors en window, suprime la mazmorra y expone el descriptor", () => {
    const g = doomGame({}, TEXT);
    const view = new CoreViewImpl(g);
    view.setEndgameScene({
      phase: "greenScene",
      room: ROOM,
      actors: [{ tile: LB_WALK_TILE, col: 5, row: 3 }],
    });
    const snap = view.snapshot();
    expect(snap.mode).toBe("world");
    expect(snap.dungeon).toBeNull(); // la escena manda sobre el 3D
    expect(snap.endgameScene?.phase).toBe("greenScene");
    // Esquina 0xff transparente → negro; muro y suelo del mapa; sprite de LB encima.
    expect(snap.window[0]).toBe(TILE_HIDDEN);
    expect(snap.window[1]).toBe(0x4d);
    expect(snap.window[1 * VIEW_WINDOW + 1]).toBe(0x44);
    expect(snap.window[3 * VIEW_WINDOW + 5]).toBe(LB_WALK_TILE);
  });

  it("fase de pantalla completa (scroll): no hornea la sala pero sigue mandando sobre el modo", () => {
    const g = doomGame({}, TEXT);
    const view = new CoreViewImpl(g);
    view.setEndgameScene({
      phase: "scroll",
      room: ROOM,
      scrollLines: [{ text: "line" }],
      scrollReveal: 1,
    });
    const snap = view.snapshot();
    expect(snap.mode).toBe("world");
    expect(snap.dungeon).toBeNull();
    expect(snap.combatView).toBeNull();
    expect(snap.endgameScene?.scrollLines?.length).toBe(1);
  });

  it("desmontar con null restaura la vista normal", () => {
    const g = doomGame({}, TEXT);
    const view = new CoreViewImpl(g);
    view.setEndgameScene({ phase: "greenScene", room: ROOM });
    view.setEndgameScene(null);
    const snap = view.snapshot();
    expect(snap.endgameScene).toBeNull();
    expect(snap.dungeon).not.toBeNull(); // el 3D vuelve
  });
});

// ── ENDGAME-POLISH: recolor del tileset (GAP 2/4) + layout byte-derivado de la
// historia (GAP 6). Citas: EGA.DRV fn36 (SEL 0x6c) ax=4 — LUT 0x2d4d, lista
// 0x2cb0-0x2d33; ENDGAME.OVL 0x0658 (call 0xffffcd0e(1) → residente 0x6f9e(1));
// tablas DATA.OVL DS 0x3da6-0x3e0b (re/notes/endgame-derivation.md §ADENDA). ──
import {
  ENDGAME_RECOLOR_LUT,
  ENDGAME_RECOLOR_TILES,
  ORB_TILE,
  STORY_LAYOUT,
  recolorEndgameIndices,
} from "../src/skin/fiel/endgame-frame.js";

describe("recolor del tileset del endgame (EGA.DRV fn36 ax=4)", () => {
  it("la LUT es byte-exacta contra EGA.DRV 0x2d4d", () => {
    expect(Array.from(ENDGAME_RECOLOR_LUT)).toEqual([
      0x0, 0x5, 0x4, 0x4, 0x2, 0x1, 0x2, 0x7, 0x8, 0xc, 0xc, 0xc, 0xa, 0x9, 0xe, 0xf,
    ]);
  });

  it("la lista de tiles es la del binario (0x2cb0-0x2d33, offset/0x80), 22 tiles en orden", () => {
    expect(Array.from(ENDGAME_RECOLOR_TILES)).toEqual([
      0x44, 0x5c, 0x5d, 0x90, 0x92, 0x94, 0x96, 0x9b, 0xab, 0xac, 0xaf, 0xb0, 0xb1,
      0xbf, 0xdc, 0x108, 0x10e, 0x11a, 0x138, 0x139, 0x13a, 0x13b,
    ]);
    // El moongate (0xdc) y el orb (0x108) SÍ se recolorean; el espejo-arco 0x9d, los
    // muros 0x4d y el LB de pie 0x17c NO (careo del testigo: quedan sin virar).
    expect(ENDGAME_RECOLOR_TILES).toContain(0xdc);
    expect(ENDGAME_RECOLOR_TILES).toContain(ORB_TILE);
    expect(ENDGAME_RECOLOR_TILES).not.toContain(0x9d);
    expect(ENDGAME_RECOLOR_TILES).not.toContain(0x4d);
    expect(ENDGAME_RECOLOR_TILES).not.toContain(0x17c);
  });

  it("recolorEndgameIndices aplica la LUT in place (careo del testigo por familias)", () => {
    // rojo→verde, marrón→verde (ladrillo/antorcha/mesa); azul→magenta y
    // azul-claro→rojo-claro (la manta de la cama); amarillo queda (sillas);
    // rojo-claro→verde-claro; negro/blanco quedan.
    const idx = new Uint8Array([4, 6, 1, 9, 14, 12, 0, 15]);
    recolorEndgameIndices(idx);
    expect(Array.from(idx)).toEqual([2, 2, 5, 12, 14, 10, 0, 15]);
  });

  it("el orb es el tile 0x108 (registro #6 tile 8 | 0x100, ENDGAME 0x0968)", () => {
    expect(ORB_TILE).toBe(0x108);
  });
});

describe("layout byte-derivado de las pantallas de historia (tablas DS 0x3da6-0x3e0b)", () => {
  it("posición del arte por página = tablas 0x3dfa (x) / 0x3e00 (y)", () => {
    expect(STORY_LAYOUT.map((l) => l.art.x)).toEqual([0, 64, 0, 0, 0, 160]);
    expect(STORY_LAYOUT.map((l) => l.art.y)).toEqual([0, 0, 52, 0, 92, 0]);
  });

  it("titulares: página 0 = The(216,0)+Homecoming(152,28); página 3 = Dream(224,0)+The(176,0); resto sin titular", () => {
    expect(STORY_LAYOUT[0]!.titles).toEqual([
      { word: 0, x: 216, y: 0 },
      { word: 4, x: 152, y: 28 },
    ]);
    expect(STORY_LAYOUT[3]!.titles).toEqual([
      { word: 5, x: 224, y: 0 },
      { word: 0, x: 176, y: 0 },
    ]);
    for (const p of [1, 2, 4, 5]) expect(STORY_LAYOUT[p]!.titles).toEqual([]);
  });

  it("bandas de texto = globals 0x5146-0x5158 por página (volcado de las tablas)", () => {
    // bandA.x0 = tabla 0x3da6; bandB.x0 = 0x3da7; bandA.x1 = 0x3db2; bandB.x1 = 0x3db4;
    // y del corte = 0x3dd6; fondo de bandB = 0x3ddc; techo de bandA = 0x3de8.
    expect(STORY_LAYOUT.map((l) => l.bandA.x0)).toEqual([172, 0, 0, 179, 0, 0]);
    expect(STORY_LAYOUT.map((l) => l.bandB.x0)).toEqual([0, 0, 196, 0, 161, 0]);
    expect(STORY_LAYOUT.map((l) => l.bandA.x1)).toEqual([320, 320, 320, 320, 320, 154]);
    expect(STORY_LAYOUT.map((l) => l.bandB.x1)).toEqual([320, 320, 320, 320, 320, 320]);
    expect(STORY_LAYOUT.map((l) => l.bandA.y0)).toEqual([66, 92, 9, 38, 9, 0]);
    expect(STORY_LAYOUT.map((l) => l.bandA.y1)).toEqual([126, 126, 42, 100, 82, 112]);
    for (const l of STORY_LAYOUT) expect(l.bandB.y0).toBe(l.bandA.y1); // bandas encadenadas
    expect(STORY_LAYOUT.map((l) => l.bandB.y1)).toEqual([200, 200, 148, 200, 200, 200]);
  });
});
