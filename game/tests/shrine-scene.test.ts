/**
 * Ficha #277 · ESCENA del santuario / cámara del Codex (CAST2.OVL 0x0e76).
 *
 * Lo que fija esta guarda es el enunciado del reporte del usuario: **tras (E)nter en un
 * santuario, el viewport pinta el MAPA DEL SANTUARIO y el Avatar termina ARRODILLADO ante
 * el altar** — no un mensaje de consola sobre el sobremundo. Se comprueba de punta a punta:
 * `Game.enter()` → evento `shrine-scene` → guion → `CoreViewImpl.snapshot().window`.
 *
 * Cifras DERIVADAS del binario (cuerpo leído, direcciones en shrine-scene.ts):
 *   · mapa 11×11 de MISCMAPS.DAT[176:352] con el brasero-altar en (5,5)   — 0x0ed2/0x0f0c
 *   · entrada de la party en (5,10)                                        — 0x0f91/0x0f96
 *   · CUATRO cues con la escena vacía antes de colocarla                   — 0x0f80 `mov si,4`
 *   · CUATRO pasos al norte (SIETE en el Codex) → (5,6) / (5,3)            — 0x1042 / 0x1048
 *   · tile de arrodillado 0x6c (+0x100 = 364 Begger1)                      — 0x09a1
 *   · al volver: de pie 0x1c (+0x100 = 284) y desandar al sur hasta (5,10) — 0x1075/0x109c
 */
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import type { CharacterState, ExtractedInitialState, GameState } from "../src/core/state.js";
import { Game, type GameData, type GameEvent } from "../src/core/game.js";
import type { WorldData } from "../src/core/world/map.js";
import { SHRINE_TILE, type ShrineData } from "../src/core/world/shrines.js";
import {
  buildShrineEnterScript,
  buildShrineExitScript,
  shrineAltarStand,
  SHRINE_AVATAR_TILE,
  SHRINE_KNEEL_TILE,
  SHRINE_ENTRY,
  SHRINE_STEPS,
  EMPTY_CUES,
  SHRINE_SCENE_MINUTES,
  type ShrineSceneScript,
  type ShrineSceneTiles,
} from "../src/core/world/shrine-scene.js";
import { CoreViewImpl } from "../src/skin/coreview.js";
import { VIEW_WINDOW } from "../src/skin/api.js";

const ASSETS = resolve(dirname(fileURLToPath(import.meta.url)), "../assets");
/** `shrine-scene.json` del extractor (MISCMAPS.DAT[176:352] y [352:528]). */
const SCENES = JSON.parse(readFileSync(`${ASSETS}/shrine-scene.json`, "utf-8")) as {
  shrine: { tiles: number[][] };
  codex: { tiles: number[][] };
};
const scenes: Record<"shrine" | "codex", ShrineSceneTiles> = {
  shrine: SCENES.shrine.tiles,
  codex: SCENES.codex.tiles,
};

const BRAZIER = 0xb2; // altar del santuario (TileData 178 Brazier)
const LECTURN = 0x41; // atril de la cámara del Codex (TileData 65 Lecturn)
const LARGE_ROCK = 0x4d; // montón de piedra de las esquinas (TileData 77 LargeRockWall)

const SHRINES: ShrineData = {
  virtues: ["Honesty", "Compassion", "Valour", "Justice", "Sacrifice", "Honor", "Spirituality", "Humility"],
  mantras: ["Ahm", "Mu", "Ra", "Beh", "Cah", "Summ", "Om", "Lum"],
  shrineX: [101, 0, 0, 0, 0, 0, 0, 0],
  shrineY: [100, 0, 0, 0, 0, 0, 0, 0],
};

function makeChar(): CharacterState {
  return {
    name: "Avatar", gender: 0x0b, class: "A", status: "G",
    strength: 20, dexterity: 20, intelligence: 20,
    currentMp: 10, currentHp: 50, maxHp: 60, exp: 0, level: 2, monthsAtInn: 0,
    helmet: 0xff, armor: 0xff, weapon: 0xff, shield: 0xff, ring: 0xff, amulet: 0xff,
    partyStatus: 0,
  };
}

function makeState(): GameState {
  return {
    characters: [makeChar()], partySize: 1, activeCharacter: 0,
    food: 100, gold: 1000, karma: 50,
    time: { year: 139, month: 4, day: 7, hour: 8, minute: 35 },
    turnsSinceStart: 0,
    position: { location: 0, floor: 0, x: 101, y: 100 }, // ENCIMA del santuario
    transport: "foot", torchTurns: 0, torches: 2, prevHour: 8,
  } as GameState;
}

function makeWorld(): WorldData {
  const overworld = Array.from({ length: 256 }, () => Array.from({ length: 256 }, () => 5));
  overworld[100]![101] = SHRINE_TILE;
  return { overworld, underworld: overworld, smallMaps: new Map() };
}

const gameData = (withScenes: boolean): GameData => ({
  locationsX: Array.from({ length: 32 }, () => 250),
  locationsY: Array.from({ length: 32 }, () => 250),
  locationNames: Array.from({ length: 32 }, (_, i) => `Loc${i + 1}`),
  shrines: SHRINES,
  ...(withScenes ? { shrineScenes: scenes as Record<"shrine" | "codex", ShrineSceneTiles> } : {}),
});

const makeGame = (withScenes = true): Game =>
  new Game({} as ExtractedInitialState, makeWorld(), gameData(withScenes), makeState());

const sceneEvents = (evs: GameEvent[]): ShrineSceneScript[] =>
  evs.filter((e) => e.kind === "shrine-scene" && e.shrineScene).map((e) => e.shrineScene!);

/** Reproduce el guion entero y devuelve el ÚLTIMO fotograma (el que queda en pantalla). */
function lastFrame(script: ShrineSceneScript): ShrineSceneScript["beats"][number] {
  return script.beats[script.beats.length - 1]!;
}

const cell = (win: Int16Array, col: number, row: number): number =>
  win[row * VIEW_WINDOW + col]!;

describe("#277 · datos de la escena (MISCMAPS.DAT vía shrine-scene.json)", () => {
  it("el mapa del santuario lleva el brasero-altar en (5,5) y roca en las esquinas", () => {
    expect(scenes.shrine.length).toBe(11);
    expect(scenes.shrine[0]!.length).toBe(11);
    expect(scenes.shrine[5]![5]).toBe(BRAZIER);
    expect(scenes.shrine[0]![2]).toBe(LARGE_ROCK);
  });

  it("el mapa del Codex lleva el atril en (5,2) — el OTRO registro, no el mismo", () => {
    expect(scenes.codex[2]![5]).toBe(LECTURN);
    expect(scenes.codex).not.toEqual(scenes.shrine);
  });
});

describe("#277 · guion derivado (CAST2 0x0e76)", () => {
  it("entrada: 4 cues vacíos → aparece en (5,10) → 4 pasos al norte → arrodillado en (5,6)", () => {
    const s = buildShrineEnterScript("shrine", scenes.shrine);
    // Los CUATRO primeros beats no llevan Avatar (0x0f80 `mov si,4`, antes de colocarlo).
    expect(s.beats.slice(0, EMPTY_CUES).every((b) => b.avatar === null)).toBe(true);
    expect(s.beats[EMPTY_CUES]!.avatar).toEqual({
      x: SHRINE_ENTRY.x, y: SHRINE_ENTRY.y, tile: SHRINE_AVATAR_TILE,
    });
    // 4 vacíos + colocación + 4 pasos + kneel = 10 beats.
    expect(s.beats.length).toBe(EMPTY_CUES + 1 + SHRINE_STEPS.shrine + 1);
    const end = lastFrame(s);
    expect(end.avatar).toEqual({ x: 5, y: 6, tile: SHRINE_KNEEL_TILE });
    expect(end.footstep).toBe(false); // el kneel NO es un `spectacle_cue` (0x09a1 sin call 0xe64)
    // Y la celda del altar está JUSTO AL NORTE de donde acaba (0x1042: 10−4 = 6).
    expect(shrineAltarStand("shrine")).toEqual({ x: 5, y: 6 });
    expect(scenes.shrine[end.avatar!.y - 1]![end.avatar!.x]).toBe(BRAZIER);
  });

  it("NUEVE cues antes del kneel — la cifra que el testigo de vídeo pinó (#277/#278)", () => {
    // 🔴 Este número es la BISAGRA entre la derivación y la calibración, y por eso se fija.
    // playlist-espejo-278 midió sobre Part 19 (Honor, 1080p): corte t=94,6 · Avatar aparece
    // t=97,1 · swap a arrodillado t=100,1. Los 4 cues VACÍOS caen entre corte y aparición;
    // la colocación + los 4 pasos, entre aparición y kneel. ⇒ 9 cues en 5,5 s = 0,611 s/cue,
    // que es de donde sale la unidad de 120 ms/fotograma de main.ts (el cue son 5). Si
    // alguien cambia la estructura de cues, la unidad calibrada deja de predecir el vídeo:
    // este aserto lo para antes.
    const s = buildShrineEnterScript("shrine", scenes.shrine);
    const cues = s.beats.filter((b) => b.footstep).length;
    expect(cues).toBe(9);
    // Y el kneel NO es un cue: es el beat 10, el único sin pisada.
    expect(s.beats.length - cues).toBe(1);
    expect(lastFrame(s).footstep).toBe(false);
  });

  it("el Codex baja SIETE pasos (0x1048) y acaba al sur del atril", () => {
    const s = buildShrineEnterScript("codex", scenes.codex);
    const end = lastFrame(s);
    expect(SHRINE_STEPS.codex).toBe(7);
    expect(end.avatar).toEqual({ x: 5, y: 3, tile: SHRINE_KNEEL_TILE });
    expect(scenes.codex[end.avatar!.y - 1]![end.avatar!.x]).toBe(LECTURN);
  });

  it("salida: se pone DE PIE, desanda al sur hasta (5,10) y la escena queda vacía", () => {
    const s = buildShrineExitScript("shrine", scenes.shrine);
    expect(s.beats[0]!.avatar).toEqual({ x: 5, y: 6, tile: SHRINE_AVATAR_TILE });
    const ys = s.beats.map((b) => b.avatar?.y).filter((y): y is number => y !== undefined);
    expect(ys).toEqual([6, 7, 8, 9, 10]); // 0x109c `inc [+3]` hasta 10
    expect(lastFrame(s).avatar).toBeNull();
  });
});

describe("#277 · (E)nter en un santuario monta la escena y la pinta en el viewport", () => {
  it("el viewport pinta el MAPA del santuario y el Avatar acaba ARRODILLADO ante el altar", () => {
    const game = makeGame();
    const view = new CoreViewImpl(game);
    const evs = game.enter();

    // 1) El (E)nter emite la escena (ANTES del kneel de texto y del prompt).
    const scripts = sceneEvents(evs);
    expect(scripts.length).toBe(1);
    const idxScene = evs.findIndex((e) => e.kind === "shrine-scene");
    const idxPrompt = evs.findIndex((e) => e.kind === "shrine-visit-prompt");
    expect(idxScene).toBeGreaterThan(-1);
    expect(idxPrompt).toBeGreaterThan(idxScene);

    // 2) El último fotograma del guion, montado en la vista, ES lo que ve el jugador.
    const end = lastFrame(scripts[0]!);
    view.setShrineScene({
      tiles: scripts[0]!.tiles,
      avatar: { col: end.avatar!.x, row: end.avatar!.y, tile: end.avatar!.tile },
    });
    const snap = view.snapshot();
    expect(snap.shrineScene).not.toBeNull();
    // El MAPA del santuario (no el sobremundo: allí todo era hierba 5 salvo el 0x19).
    expect(cell(snap.window, 5, 5)).toBe(BRAZIER);
    expect(cell(snap.window, 2, 0)).toBe(LARGE_ROCK);
    // El Avatar ARRODILLADO en la celda de debajo del altar.
    expect(cell(snap.window, 5, 6)).toBe(SHRINE_KNEEL_TILE);
    // 🔴 Guarda de la CLASE #253, forma #363: `terrainWindow` SÍ se puebla — y ES LA
    // ESCENA, no el sobremundo (que en este fixture es todo hierba 5: si la capa de
    // mundo del motionScroll volviera a leer el mapa, estas celdas dirían 5 y no
    // brasero/roca). Es el canal por el que la piel shader compone el Avatar con
    // transparencia: sin él caía al recorte pleno y el sprite salía con su cuadrado
    // negro opaco sobre la explanada (3ª instancia de la clase #351, reporte 16-08).
    const tw = snap.terrainWindow!;
    expect(tw).toBeDefined();
    expect(cell(tw, 5, 5)).toBe(BRAZIER); // la escena, no la hierba 5 del sobremundo
    expect(cell(tw, 2, 0)).toBe(LARGE_ROCK);
    // …y bajo el Avatar lleva el SUELO de la escena (hierba 0x05 del MISCMAPS crudo),
    // NO el sprite: es lo que el shader enseña a través del fondo transparente.
    expect(cell(tw, 5, 6)).toBe(0x05);
    // El Avatar viaja como actor `party` (la fiel lo filtra; el shader lo compone
    // con su recorte transparente en (2d), la misma vía que el mundo).
    expect(snap.actors).toEqual([{ id: "party", tile: SHRINE_KNEEL_TILE, col: 5, row: 6 }]);
    // Sin censura de visibilidad: la explanada entera visible (como el original).
    expect(snap.visMask).toBeDefined();
    expect(Array.from(snap.visMask!).every((v) => v === 1)).toBe(true);
  });

  it("#363 · la cámara del CODEX puebla la misma capa: suelo 0x44 bajo el actor", () => {
    const game = makeGame();
    const view = new CoreViewImpl(game);
    const s = buildShrineEnterScript("codex", scenes.codex);
    const end = lastFrame(s);
    view.setShrineScene({
      tiles: s.tiles,
      avatar: { col: end.avatar!.x, row: end.avatar!.y, tile: end.avatar!.tile },
    });
    const snap = view.snapshot();
    const tw = snap.terrainWindow!;
    expect(tw).toBeDefined();
    // Suelo de ladrillo 0x44 del MISCMAPS crudo bajo el arrodillado en (5,3);
    // el atril 0x41 en (5,2) queda en la capa de terreno (lo pinta la capa de mundo).
    expect(cell(tw, 5, 3)).toBe(0x44);
    expect(cell(tw, 5, 2)).toBe(LECTURN);
    expect(cell(snap.window, 5, 3)).toBe(SHRINE_KNEEL_TILE); // la fiel, intacta
    expect(snap.actors).toEqual([{ id: "party", tile: SHRINE_KNEEL_TILE, col: 5, row: 3 }]);
  });

  it("#363 · los beats SIN Avatar (cues vacíos) llevan terreno de escena y CERO actores", () => {
    const game = makeGame();
    const view = new CoreViewImpl(game);
    view.setShrineScene({ tiles: scenes.shrine, avatar: null });
    const snap = view.snapshot();
    expect(cell(snap.terrainWindow!, 5, 5)).toBe(BRAZIER);
    expect(cell(snap.window, 5, 5)).toBe(BRAZIER);
    expect(snap.actors).toBeUndefined(); // explanada vacía: nada que componer
  });

  it("SIN el asset de escena el rito degrada al flujo de texto de siempre (no revienta)", () => {
    const evs = makeGame(false).enter();
    expect(sceneEvents(evs).length).toBe(0);
    expect(evs.some((e) => e.kind === "shrine-visit-prompt")).toBe(true);
  });

  it("al resolver el rito se emite la escena de SALIDA (desmonta el mapa)", () => {
    const game = makeGame();
    game.enter();
    // Virtud + mantra×3 correctos para Honesty (índice 0) → rama ORDAINED, terminal.
    const out = game.submitShrineVisit("Honesty", ["Ahm", "Ahm", "Ahm"]);
    const scripts = sceneEvents(out);
    expect(scripts.length).toBe(1);
    expect(lastFrame(scripts[0]!).avatar).toBeNull();
  });

  it("un fallo del rito TAMBIÉN desmonta la escena (rama unfocused)", () => {
    const game = makeGame();
    game.enter();
    const out = game.submitShrineVisit("Compassion", ["nope", "nope", "nope"]);
    expect(out.some((e) => e.kind === "message" && e.text?.includes("unfocused"))).toBe(true);
    expect(sceneEvents(out).length).toBe(1);
  });
});

describe("#275 · la entrada VACÍA sale del rito EN SILENCIO (CAST2 0x09cc / 0x0a1e)", () => {
  // El binario mira el buffer ANTES de compararlo (`cmp byte [0xbd08], 0`) y salta a 0x0d1d,
  // que cae DESPUÉS del `call 0x5906` de 0x0d1a: la salida vacía no imprime NADA. La cadena
  // «Thine thoughts are unfocused.» (0xb5de) vive en la rama 0x0a62, la del mantra
  // EQUIVOCADO, inalcanzable con el buffer vacío. Estos dos asertos son el par que separa
  // las dos ramas: sin el discriminante de vacío las dos dirían «unfocused».
  it("virtud vacía: ni una sola emisión de texto (y la escena se desmonta igual)", () => {
    const game = makeGame();
    game.enter();
    const out = game.submitShrineVisit("", ["Ahm", "Ahm", "Ahm"]);
    expect(out.filter((e) => e.kind === "message")).toEqual([]);
    expect(sceneEvents(out).length).toBe(1); // sale del rito, como el 0x0d1d del binario
  });

  it("un mantra vacío de los tres: mismo silencio", () => {
    const game = makeGame();
    game.enter();
    const out = game.submitShrineVisit("Honesty", ["Ahm", "", "Ahm"]);
    expect(out.filter((e) => e.kind === "message")).toEqual([]);
  });

  it("CONTROL: con el buffer NO vacío y equivocado, el original SÍ habla", () => {
    // Control positivo del par: si este aserto se cae junto con los de arriba, lo que se
    // rompió es la rama de fallo entera, no el discriminante de vacío.
    const game = makeGame();
    game.enter();
    const out = game.submitShrineVisit("Honesty", ["Ahm", "nope", "Ahm"]);
    expect(out.some((e) => e.kind === "message" && e.text?.includes("unfocused"))).toBe(true);
  });
});

describe("#277 · hueco DECLARADO, no portado", () => {
  it("los 16 minutos que el original cobra por el rito están derivados pero NO cableados", () => {
    // CAST2 0x10ed `push 0x10; call advance_clock`. NO se aplica en el port: `advanceClock`
    // consume RNG con reintento sin tope en el cambio de día (#101), así que cablearlo mueve
    // el stream y sale del alcance de #277 (que es la ESCENA). Queda declarado con su cifra.
    expect(SHRINE_SCENE_MINUTES).toBe(16);
    const game = makeGame();
    const before = { ...game.state.time };
    game.enter();
    game.submitShrineVisit("Honesty", ["Ahm", "Ahm", "Ahm"]);
    expect(game.state.time).toEqual(before); // el reloj NO se mueve (hueco declarado)
  });
});

describe("#324 · la SALA DEL TRONO del asset (MISCMAPS.DAT[0:176], clave `capture`)", () => {
  // El careo mapa↔tablas que ADJUDICA la orientación de la escena de captura: los
  // grilletes 0x85 (Manacles) del mapa deben caer EXACTOS en los seis asientos de la
  // party derivados de DS 0x1F0A/0x1F42/0x1F48 (fila numLiving=6 → códigos 4,5,3,2,1,0).
  // Esperados EN CRUDO (leídos del volcado del registro 0, no del sujeto).
  const capture = (
    SCENES as unknown as { capture?: { tiles?: number[][] } }
  ).capture?.tiles;

  it("el asset trae la clave `capture` (extractor con seek 0)", () => {
    expect(capture).toBeDefined();
    expect(capture).toHaveLength(11);
  });

  it("grilletes 0x85 en los SEIS asientos de la party (cruce con 0x1f42/0x1f48)", () => {
    const seats = [
      [3, 5],
      [7, 5],
      [0, 1],
      [1, 1],
      [9, 1],
      [10, 1],
    ] as const;
    for (const [x, y] of seats) expect(capture?.[y]?.[x]).toBe(0x85);
  });

  it("el mobiliario de la escena: trono, mesa, reloj, puertas", () => {
    expect(capture?.[4]?.[5]).toBe(0xb9); // LockedDoor tras el trono (5,4)
    expect(capture?.[7]?.[5]).toBe(0x80); // TortureChair1 (5,7) — la mesa del péndulo
    expect(capture?.[9]?.[5]).toBe(0xe8); // Hourglass1 vacío (5,9) — el estado base
    expect(capture?.[4]?.[0]).toBe(0xbb); // LockedDoorView (0,4) — la puerta oeste del final
    expect(capture?.[4]?.[10]).toBe(0xbb); // y su simétrica este
    // El hueco de la puerta sur por el que entran guardias y sale Blackthorn: (4..6,10).
    expect(capture?.[10]?.slice(4, 7)).toEqual([0x44, 0x44, 0x44]);
  });
});
