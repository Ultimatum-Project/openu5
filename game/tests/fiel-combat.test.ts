/**
 * PIEL FIEL — OVERLAYS + FX DE COMBATE (E1-S12).
 *
 * Cubre las tres piezas nuevas de S12 sin navegador:
 *   1. `paintCombatOverlays` (puro): recuadro del activo (§1, parpadeo por fase) +
 *      retícula de apuntado (§7).
 *   2. `CombatFxLayer` (estado): proyectil interpola y expira; flash de impacto y
 *      de pantalla; flag `active`.
 *   3. `CoreViewImpl.combatView()`: proyección censurada (sin invisibles), celda
 *      del activo (vía `activeActor`, sin avanzar iniciativa) y retícula de aim.
 */
import { describe, expect, it } from "vitest";
import {
  CombatFxLayer,
  paintCombatOverlays,
} from "../src/skin/fiel/combat.js";
import { VIEWPORT } from "../src/skin/fiel/frame.js";
import { TILE_HIDDEN, type CombatView } from "../src/skin/api.js";
import { CoreViewImpl } from "../src/skin/coreview.js";
import {
  Game,
  type CombatResources,
  type GameData,
} from "../src/core/game.js";
import type {
  CharacterState,
  ExtractedInitialState,
  GameState,
} from "../src/core/state.js";
import type { WorldData } from "../src/core/world/map.js";

/** Ctx espía: cuenta fillRect y registra el último rect + fillStyle usados. */
function spyCtx() {
  const rects: { x: number; y: number; w: number; h: number; style: string }[] = [];
  const state = { fillStyle: "" };
  const ctx = {
    get fillStyle() {
      return state.fillStyle;
    },
    set fillStyle(v: string) {
      state.fillStyle = v;
    },
    fillRect(x: number, y: number, w: number, h: number) {
      rects.push({ x, y, w, h, style: state.fillStyle });
    },
  } as unknown as CanvasRenderingContext2D;
  return { ctx, rects };
}

describe("paintCombatOverlays (S12 §1/§7)", () => {
  it("dibuja el recuadro del ORIGEN/activo de LÍNEA DOBLE (2 px) PARPADEANDO a ~9 Hz (§1, careo T3)", () => {
    const cv: CombatView = {
      combatants: [{ id: 1, x: 3, y: 4, kind: "party", sleeping: false, charmed: false }],
      active: { id: 1, x: 3, y: 4 },
      aim: null,
    };
    const even = spyCtx();
    paintCombatOverlays(even.ctx, cv, 0);
    // 4 lados del marco de la celda activa (ASM 0x5779: filas/cols {0,1} y {14,15}).
    expect(even.rects.length).toBe(4);
    // Anclado a la celda (3,4) del viewport.
    const x = VIEWPORT.x + 3 * VIEWPORT.tile;
    const y = VIEWPORT.y + 4 * VIEWPORT.tile;
    expect(even.rects.some((r) => r.x === x && r.y === y)).toBe(true);
    // LÍNEA DOBLE: cada lado tiene 2 px de grosor (bandas contiguas, no 1 px).
    const top = even.rects.find((r) => r.x === x && r.y === y && r.w === VIEWPORT.tile);
    expect(top?.h).toBe(2);
    const left = even.rects.find((r) => r.x === x && r.y === y && r.h === VIEWPORT.tile);
    expect(left?.w).toBe(2);

    // El recuadro PARPADEA a ~9 Hz — MEDIDO (careo-combate T3): vídeo-J ON≈49/OFF≈60 ms,
    // vídeo-O ON≈52/OFF≈60 ms (ciclo ≈110 ms). Con `phase` en ticks de 55 ms, la fase
    // impar NO dibuja. (La cita previa «vídeo-O no parpadea a ojo» quedó falsificada
    // por la medición del propio vídeo-O.)
    const odd = spyCtx();
    paintCombatOverlays(odd.ctx, cv, 1);
    expect(odd.rects.length).toBe(0);
  });

  it("dibuja la retícula de aim/TARGET (§7): CRUZ DE DOBLE LÍNEA con hueco central", () => {
    const cv: CombatView = {
      combatants: [],
      active: null,
      aim: { cell: { x: 5, y: 5 } },
    };
    const spy = spyCtx();
    paintCombatOverlays(spy.ctx, cv, 0); // fase par: cursor visible, sin recuadro activo
    // ASM 0x5813: doble línea vertical (cols 6,9) + horizontal (filas 6,9), cada
    // tramo partido en el centro → 2 cols × 2 tramos + 2 filas × 2 tramos = 8 rects.
    const fills = spy.rects.filter((r) => r.w === VIEWPORT.tile && r.h === VIEWPORT.tile);
    expect(fills.length).toBe(0);
    expect(spy.rects.length).toBe(8);
    const x0 = VIEWPORT.x + 5 * VIEWPORT.tile;
    const y0 = VIEWPORT.y + 5 * VIEWPORT.tile;
    // Las líneas caen en cols {6,9} (verticales, w=1) y filas {6,9} (horizontales,
    // h=1): DOBLE línea con "espacio" en 7-8. Ningún tramo toca los bordes del tile.
    const verticals = spy.rects.filter((r) => r.w === 1);
    const horizontals = spy.rects.filter((r) => r.h === 1);
    expect(verticals.length).toBe(4);
    expect(horizontals.length).toBe(4);
    expect(new Set(verticals.map((r) => r.x - x0))).toEqual(new Set([6, 9]));
    expect(new Set(horizontals.map((r) => r.y - y0))).toEqual(new Set([6, 9]));
    // Hueco central: ningún rect cubre el píxel (x0+7..8, y0+7..8) del centro.
    const coversCenter = spy.rects.some(
      (r) =>
        x0 + 7 >= r.x && x0 + 7 < r.x + r.w && y0 + 7 >= r.y && y0 + 7 < r.y + r.h,
    );
    expect(coversCenter).toBe(false);
    // El cursor parpadea a ~110 ms por fase (Clase C, careo T12): con `phase` en
    // ticks de 55 ms el gate es `(phase>>1)&1` → sigue visible en phase 1 y se
    // apaga en phase 2-3.
    const p1 = spyCtx();
    paintCombatOverlays(p1.ctx, cv, 1);
    expect(p1.rects.length).toBe(8);
    const p2 = spyCtx();
    paintCombatOverlays(p2.ctx, cv, 2);
    expect(p2.rects.length).toBe(0);
  });
});

describe("CombatFxLayer (S12 §2/§3)", () => {
  it("proyectil: interpola de origen a destino y expira", () => {
    const fx = new CombatFxLayer();
    fx.push({ kind: "projectile", from: { x: 0, y: 0 }, to: { x: 4, y: 0 }, hit: true }, 1000);
    expect(fx.active).toBe(true);

    // A mitad de vuelo hay un glifo dibujado (4×4).
    const mid = spyCtx();
    const aliveMid = fx.paint(mid.ctx, 1000 + 4 * 55 * 0.5);
    expect(aliveMid).toBe(true);
    expect(mid.rects.some((r) => r.w === 4 && r.h === 4)).toBe(true);

    // Pasada la duración total (4 celdas × 55 ms) ya no queda nada.
    const done = spyCtx();
    const aliveEnd = fx.paint(done.ctx, 1000 + 4 * 55 + 1);
    expect(aliveEnd).toBe(false);
    expect(done.rects.length).toBe(0);
    expect(fx.active).toBe(false);
  });

  it("estallido de impacto: estrella de 8 puntas fija, expira tras su duración", () => {
    const fx = new CombatFxLayer();
    fx.push({ kind: "hitFlash", x: 2, y: 2, targetKind: "enemy" }, 0);
    const start = spyCtx();
    expect(fx.paint(start.ctx, 0)).toBe(true);
    const T = VIEWPORT.tile;
    const ox = VIEWPORT.x + 2 * T + T / 2; // centro de la celda del objetivo
    const oy = VIEWPORT.y + 2 * T + T / 2;
    // ESTRELLA DE 8 PUNTAS (calca COMSUBS:0x0F4A + medición del original): pintada
    // como muchos píxeles 1×1 + un núcleo 3×3, no un tile ni un relleno de celda.
    expect(start.rects.length).toBeGreaterThan(5);
    // NO hay underglow/relleno de celda (el original no tiñe la celda).
    expect(
      start.rects.some((r) => r.w === T && r.h === T),
      "no debe haber relleno/underglow de celda",
    ).toBe(false);
    // Sólo píxeles 1×1 (los brazos) y un núcleo 3×3.
    const arms = start.rects.filter((r) => r.w === 1 && r.h === 1);
    expect(arms.length).toBeGreaterThan(5);
    // Paleta EGA medida: blanco núcleo, amarillo estrella, rojo contorno.
    const palette = new Set(["#ffffff", "#ffff55", "#ff5555"]);
    expect(start.rects.every((r) => palette.has(r.style))).toBe(true);
    // Núcleo blanco 3×3 centrado.
    expect(
      start.rects.some((r) => r.w === 3 && r.h === 3 && r.style === "#ffffff" &&
        r.x === ox - 1 && r.y === oy - 1),
      "falta el núcleo blanco de la estrella",
    ).toBe(true);
    // Puntas CARDINALES rojas hasta el borde del tile (±7 px del centro).
    const hasRedAt = (x: number, y: number): boolean =>
      start.rects.some((r) => r.x === x && r.y === y && r.style === "#ff5555");
    expect(hasRedAt(ox + 7, oy), "falta la punta este roja").toBe(true);
    expect(hasRedAt(ox - 7, oy), "falta la punta oeste roja").toBe(true);
    expect(hasRedAt(ox, oy - 7), "falta la punta norte roja").toBe(true);
    expect(hasRedAt(ox, oy + 7), "falta la punta sur roja").toBe(true);
    // Cuerpo DIAGONAL: hay rojo fuera de ambos ejes (la estrella tiene 8 puntas,
    // no una simple cruz) — algún píxel rojo con |dx|≥3 y |dy|≥3.
    expect(
      start.rects.some((r) => r.style === "#ff5555" &&
        Math.abs(r.x - ox) >= 3 && Math.abs(r.y - oy) >= 3),
      "falta el cuerpo diagonal rojo (estrella de 8 puntas)",
    ).toBe(true);
    // La forma es FIJA: a mitad de vida el dibujo es idéntico (sin parpadeo/re-scatter).
    const mid = spyCtx();
    expect(fx.paint(mid.ctx, 60)).toBe(true); // 60 ms < HIT_FLASH_MS (120)
    expect(mid.rects.length).toBe(start.rects.length);
    const after = spyCtx();
    expect(fx.paint(after.ctx, 500)).toBe(false); // > HIT_FLASH_MS
    expect(after.rects.length).toBe(0);
  });

  it("clear() vacía la capa", () => {
    const fx = new CombatFxLayer();
    fx.push({ kind: "screenFlash", n: 3 }, 0);
    expect(fx.active).toBe(true);
    fx.clear();
    expect(fx.active).toBe(false);
  });
});

// ── combatView(): proyección censurada desde un stub de combate ──────────────
interface FakeCombatant {
  id: number;
  x: number;
  y: number;
  kind: "player" | "enemy";
  status: string;
  sleeping: boolean;
  charmed: boolean;
  invisible: boolean;
  charIdx?: number;
}
function fakeCombatant(over: Partial<FakeCombatant>): FakeCombatant {
  return {
    id: 1, x: 0, y: 0, kind: "enemy", status: "active",
    sleeping: false, charmed: false, invisible: false, ...over,
  };
}

// Game mínimo REAL (el snapshot completo lee activeMap/state/roster); sólo se le
// inyecta `game.combat` con lo que `combatView()` consume (mapTiles + combatants +
// activeActor). Mismo patrón que skin-coreview.test.ts.
function makeChar(name: string): CharacterState {
  return {
    name, gender: 0x0b, class: "A", status: "G",
    strength: 20, dexterity: 20, intelligence: 20,
    currentMp: 10, currentHp: 50, maxHp: 60, exp: 0, level: 2, monthsAtInn: 0,
    helmet: 0xff, armor: 0xff, weapon: 0xff, shield: 0xff, ring: 0xff, amulet: 0xff,
    partyStatus: 0,
  } as CharacterState;
}
function makeState(): GameState {
  return {
    characters: [makeChar("Avatar")],
    partySize: 1, activeCharacter: 0, food: 100, gold: 150,
    time: { year: 139, month: 4, day: 7, hour: 12, minute: 0 },
    turnsSinceStart: 0,
    position: { location: 0, floor: 0, x: 100, y: 100 },
    transport: "foot", torchTurns: 0, torches: 2, prevHour: 12,
  } as unknown as GameState;
}
function grassWorld(): WorldData {
  const grid = Array.from({ length: 256 }, () => Array.from({ length: 256 }, () => 5));
  return { overworld: grid, underworld: grid, smallMaps: new Map() };
}
const combatResources: CombatResources = {
  combatMaps: [], enemyDefs: [], attackValues: [], attackRangeValues: [], defenseValues: [],
};
const gameData: GameData = { locationsX: [], locationsY: [], locationNames: [] };

function gameWithCombat(combatants: FakeCombatant[], active: FakeCombatant | null): Game {
  const game = new Game(
    {} as ExtractedInitialState,
    grassWorld(),
    gameData,
    makeState(),
    { combatResources },
  );
  game.combat = {
    mapTiles: [],
    combatants,
    lootTiles: () => [],
    get activeActor() {
      return active;
    },
  } as unknown as NonNullable<Game["combat"]>;
  return game;
}

describe("CoreViewImpl.combatView() (S12)", () => {
  it("expone combatientes vivos, censura enemigos invisibles y marca el activo", () => {
    const hero = fakeCombatant({ id: 1, x: 5, y: 5, kind: "player" });
    const orc = fakeCombatant({ id: 2, x: 6, y: 5, kind: "enemy" });
    const ghost = fakeCombatant({ id: 3, x: 7, y: 5, kind: "enemy", invisible: true });
    const dead = fakeCombatant({ id: 4, x: 8, y: 5, kind: "enemy", status: "dead" });
    const view = new CoreViewImpl(gameWithCombat([hero, orc, ghost, dead], hero));
    const cv = view.snapshot().combatView!;
    expect(cv).not.toBeNull();
    const ids = cv.combatants.map((c) => c.id).sort();
    expect(ids).toEqual([1, 2]); // sin invisible (3) ni muerto (4)
    expect(cv.active).toEqual({ id: 1, x: 5, y: 5 });
    expect(cv.aim).toBeNull(); // no se está apuntando
  });

  it("aim: setCombatAim con cursor expone SÓLO la celda del cursor móvil (§7)", () => {
    const hero = fakeCombatant({ id: 1, x: 5, y: 5, kind: "player" });
    const orc = fakeCombatant({ id: 2, x: 6, y: 5, kind: "enemy" });
    const view = new CoreViewImpl(gameWithCombat([hero, orc], hero));
    view.setCombatAim(true, { x: 6, y: 5 }); // cursor sobre el enemigo
    const cv = view.snapshot().combatView!;
    expect(cv.aim).not.toBeNull();
    expect(cv.aim!.cell).toEqual({ x: 6, y: 5 });
    // Sin cursor NO hay retícula (main.ts siempre lo pasa).
    view.setCombatAim(true);
    expect(view.snapshot().combatView!.aim).toBeNull();
    // Apagarla la retira.
    view.setCombatAim(false);
    expect(view.snapshot().combatView!.aim).toBeNull();
  });

  it("combatActiveCharIdx = charIdx del PJ cuyo turno de combate es (fila inversa §1)", () => {
    const hero = fakeCombatant({ id: 1, x: 5, y: 5, kind: "player", charIdx: 2 });
    const orc = fakeCombatant({ id: 2, x: 6, y: 5, kind: "enemy" });
    const view = new CoreViewImpl(gameWithCombat([hero, orc], hero));
    expect(view.snapshot().combatActiveCharIdx).toBe(2);
  });

  it("combatActiveCharIdx = null si el turno es de un enemigo o no hay combate", () => {
    const hero = fakeCombatant({ id: 1, x: 5, y: 5, kind: "player", charIdx: 0 });
    const orc = fakeCombatant({ id: 2, x: 6, y: 5, kind: "enemy" });
    // Turno del enemigo (active = orc): la party no va inversa.
    const enemyTurn = new CoreViewImpl(gameWithCombat([hero, orc], orc));
    expect(enemyTurn.snapshot().combatActiveCharIdx).toBeNull();
    // Sin actor activo (arranque/entre turnos): null.
    const noActive = new CoreViewImpl(gameWithCombat([], null));
    expect(noActive.snapshot().combatActiveCharIdx).toBeNull();
  });

  it("emitCombatFx hace fan-out del efecto a onCombatFx", () => {
    const view = new CoreViewImpl(gameWithCombat([], null));
    const got: string[] = [];
    view.subscribe({ onCombatFx: (fx) => got.push(fx.kind) });
    view.emitCombatFx({ kind: "hitFlash", x: 1, y: 1, targetKind: "enemy" });
    expect(got).toEqual(["hitFlash"]);
  });
});

// ── BLINDAJE: la arena de combate NO se censura por luz (veredicto #33/#37) ──────
// combat-light-verdict.md (3ª lectura + witness runtime): el combate corre con
// g_location=0xFF (≥0x80), así que el compositor kernel 0x5910 toma la COPIA CRUDA de
// la arena (0x59f8, rep movsw 0xAD14→0xAB02, sin máscara) y la rama LOS/flood
// (0x5910→0x5D0A→0x5A28, sólo loc<0x80) NUNCA se alcanza en combate. La arena y todos
// los combatientes se ven SIEMPRE (día, noche, mazmorra), sin radio de luz ni rombo
// negro. El intento de portar floodFOV/combatVisField (task #37, 669c4bc) se revirtió
// (f01d68b) por sobre-censurar la arena de día con el activo descentrado. Este test
// FALLA si alguien re-introduce un campo de visibilidad en la ruta de combate.
/** Arena 11×11 de suelo abierto (tile 5): terreno real para poder detectar censura. */
function grassArena(): number[][] {
  return Array.from({ length: 11 }, () => Array.from({ length: 11 }, () => 5));
}
/** Game de combate con arena real y hora/antorcha controladas. */
function combatGame(
  active: FakeCombatant | null,
  combatants: FakeCombatant[],
  opts: { hour: number; torch: number },
): Game {
  const state = makeState();
  state.time.hour = opts.hour;
  state.prevHour = opts.hour;
  state.torchTurns = opts.torch;
  const game = new Game(
    {} as ExtractedInitialState,
    grassWorld(),
    gameData,
    state,
    { combatResources },
  );
  game.combat = {
    mapTiles: grassArena(),
    combatants,
    lootTiles: () => [],
    get activeActor() {
      return active;
    },
  } as unknown as NonNullable<Game["combat"]>;
  return game;
}
/** Nº de celdas de la ventana censuradas a negro por luz (TILE_HIDDEN). */
function hiddenCount(window: Int16Array): number {
  let n = 0;
  for (const v of window) if (v === TILE_HIDDEN) n++;
  return n;
}

describe("CoreViewImpl — la arena de combate NO se censura por luz (#33/#37 verdict)", () => {
  // El activo en una ESQUINA (0,0) y un enemigo en la esquina OPUESTA (10,10), a
  // distancia radial 50: si alguien re-portara un flood centrado en el activo, de
  // noche (radio 2) casi toda la arena quedaría TILE_HIDDEN y el enemigo invisible;
  // de día (radio 50) la tabla radial 6×6 devolvería 51 para offsets >5 y también
  // apagaría celdas (la regresión R1). El original no censura: hidden === 0 siempre.
  const hero = () => fakeCombatant({ id: 1, x: 0, y: 0, kind: "player" });
  const foe = () => fakeCombatant({ id: 2, x: 10, y: 10, kind: "enemy" });

  it("de NOCHE (sin antorcha) con el activo en una esquina: 0 celdas a negro", () => {
    const w = new CoreViewImpl(
      combatGame(hero(), [hero(), foe()], { hour: 22, torch: 0 }),
    ).snapshot().window;
    // FIEL por ULTIMA.EXE 0x5910: con loc≥0x80 toma la rama directa 0x59f8-0x5a0b
    // (`cx=0x160; rep movsw` 0xAD14→0xAB02) = copia CRUDA de la arena, sin máscara
    // (re/notes/combat-light-verdict.md:85-91; el combate no tiene campo de visibilidad).
    expect(hiddenCount(w)).toBe(0); // arena entera visible
    expect(w[10 * 11 + 10]).not.toBe(TILE_HIDDEN); // el enemigo lejano se ve
  });

  it("de DÍA con el activo descentrado: 0 celdas a negro (blindaje R1)", () => {
    const w = new CoreViewImpl(
      combatGame(hero(), [hero(), foe()], { hour: 12, torch: 0 }),
    ).snapshot().window;
    expect(hiddenCount(w)).toBe(0);
  });
});
