/**
 * Tests unit de CoreView + SkinManager (E1-S1).
 *
 * CoreView es el adaptador core→piel: compone la ventana 11×11, mantiene la
 * consola compartida (que sobrevive al swap de piel) y hace fan-out de los
 * eventos de turno. SkinManager monta/desmonta pieles sin que el core se entere.
 * Estos tests fijan el contrato con un `Game` mínimo (sin PixiJS/DOM).
 */
import { describe, expect, it } from "vitest";
import type { CharacterState, ExtractedInitialState, GameState } from "../src/core/state.js";
import { Game, type CombatResources, type GameData } from "../src/core/game.js";
import type { CombatMapData } from "../src/core/combat/combat.js";
import type { WorldData } from "../src/core/world/map.js";
import {
  DungeonState,
  CellType,
  type DungeonCell,
  type DungeonData,
} from "../src/core/dungeon/dungeon.js";
import { CoreViewImpl } from "../src/skin/coreview.js";
import { SkinManager } from "../src/skin/manager.js";
import { CMD_STRINGS, DIR_WORDS } from "../src/core/world/cmd-strings.js";
import {
  TILE_HIDDEN,
  TILE_OFFMAP,
  VIEW_HALF,
  VIEW_WINDOW,
  type CoreView,
  type IntentSink,
  type Skin,
} from "../src/skin/api.js";

function makeChar(over: Partial<CharacterState> = {}): CharacterState {
  return {
    name: "Test", gender: 0x0b, class: "A", status: "G",
    strength: 20, dexterity: 20, intelligence: 20,
    currentMp: 10, currentHp: 50, maxHp: 60, exp: 0, level: 2, monthsAtInn: 0,
    helmet: 0xff, armor: 0xff, weapon: 0xff, shield: 0xff, ring: 0xff, amulet: 0xff,
    partyStatus: 0, ...over,
  };
}

function makeState(over: Partial<GameState> = {}): GameState {
  const base: Partial<GameState> = {
    characters: [makeChar({ name: "Avatar" }), makeChar({ name: "Iolo" })],
    partySize: 2, activeCharacter: 0, food: 100, gold: 150,
    time: { year: 139, month: 4, day: 7, hour: 12, minute: 0 },
    turnsSinceStart: 0,
    position: { location: 0, floor: 0, x: 100, y: 100 },
    transport: "foot", torchTurns: 0, torches: 2, prevHour: 12,
  };
  return { ...base, ...over } as GameState;
}

/** Overworld 256×256 de hierba (tile 5, walkable), wraps toroidal. */
function grassWorld(): WorldData {
  const overworld = Array.from({ length: 256 }, () => Array.from({ length: 256 }, () => 5));
  return { overworld, underworld: overworld, smallMaps: new Map() };
}

const gameData: GameData = { locationsX: [], locationsY: [], locationNames: [] };
const combatResources: CombatResources = {
  combatMaps: [], enemyDefs: [], attackValues: [], attackRangeValues: [], defenseValues: [],
};

function makeGame(over: Partial<GameState> = {}): Game {
  return new Game({} as ExtractedInitialState, grassWorld(), gameData, makeState(over), {
    combatResources,
  });
}

describe("CoreViewImpl.snapshot", () => {
  it("compone una ventana 11×11 centrada en la party", () => {
    const view = new CoreViewImpl(makeGame());
    const snap = view.snapshot();
    expect(snap.mode).toBe("world");
    expect(snap.window.length).toBe(VIEW_WINDOW * VIEW_WINDOW);
    expect(snap.center).toEqual({ x: 100, y: 100 });
    // Centro = tile del Avatar (284) sobre el terreno.
    expect(snap.window[VIEW_HALF * VIEW_WINDOW + VIEW_HALF]).toBe(284);
    // Una casilla no-central = terreno de hierba (5).
    expect(snap.window[0]).toBe(5);
  });

  it("dungeonView es TOROIDAL: mirar al borde 8×8 envuelve el tile (sin vacío negro)", () => {
    // Mazmorra 8×8: todo muro salvo la fila y=3. La party en (0,3) mira al OESTE →
    // la celda de delante (−1,3) debe ENVOLVER a (7,3). Regresión del agujero negro.
    const wall = (): DungeonCell => ({ type: CellType.Wall, sub: 0 });
    const floor: DungeonCell[][] = Array.from({ length: 8 }, () =>
      Array.from({ length: 8 }, wall),
    );
    floor[3]![0] = { type: CellType.Nothing, sub: 0 }; // (0,3) party
    floor[3]![7] = { type: CellType.LadderDown, sub: 0 }; // (7,3) marca distintiva
    const dungeon: DungeonData = { location: 33, name: "Test", floors: [floor] };
    const game = makeGame({ torchTurns: 50 });
    game.dungeonState = new DungeonState([dungeon], {
      dungeon: 33, floor: 0, x: 0, y: 3, facing: "west",
    });
    const snap = new CoreViewImpl(game).snapshot();
    expect(snap.dungeon).not.toBeNull();
    // La celda MARCHADA (−1,3) está presente y trae el tile ENVUELTO de (7,3).
    const wrapped = snap.dungeon!.cells.find((c) => c.x === -1 && c.y === 3);
    expect(wrapped).toBeDefined();
    expect(wrapped!.type).toBe(CellType.LadderDown);
  });

  it("expone SOLO los stats visibles del roster (name/hp/maxHp/status)", () => {
    const view = new CoreViewImpl(makeGame());
    const snap = view.snapshot();
    expect(snap.party.length).toBe(2);
    expect(snap.party[0]).toEqual({ name: "Avatar", hp: 50, maxHp: 60, status: "G" });
    // El tipo no lleva datos ocultos: sin % ni barras (comprobación estructural).
    expect(Object.keys(snap.party[0]!).sort()).toEqual(["hp", "maxHp", "name", "status"]);
  });

  it("copia el reloj como valor (no referencia viva)", () => {
    const game = makeGame();
    const view = new CoreViewImpl(game);
    const snap = view.snapshot();
    expect(snap.clock).toEqual(game.state.time);
    game.state.time.hour = 23;
    expect(snap.clock.hour).toBe(12); // el snapshot es un valor congelado
  });

  it("motion (eje 3): expone terrainWindow SIN actores + actors con id (world)", () => {
    const view = new CoreViewImpl(makeGame());
    const snap = view.snapshot();
    // terrainWindow existe y es 11×11.
    expect(snap.terrainWindow).toBeDefined();
    expect(snap.terrainWindow!.length).toBe(VIEW_WINDOW * VIEW_WINDOW);
    // El centro: window lleva el Avatar (284); terrainWindow lleva el TERRENO debajo (5).
    const c = VIEW_HALF * VIEW_WINDOW + VIEW_HALF;
    expect(snap.window[c]).toBe(284);
    expect(snap.terrainWindow![c]).toBe(5);
    // El Avatar va como actor FIJO al centro, id estable "party".
    const party = snap.actors?.find((a) => a.id === "party");
    expect(party).toEqual({ id: "party", tile: 284, col: VIEW_HALF, row: VIEW_HALF });
  });

  it("motion (scroll-shadows): terrainWindow va SIN censurar; la niebla viaja en visMask", () => {
    // Noche cerrada (luz 2): las celdas lejanas están OCULTAS en `window` (fiel) pero el
    // terreno CRUDO sigue en terrainWindow (para que scrollee limpio), y `visMask` las
    // marca 0 → el shader las ennegrece FIJAS A PANTALLA (sombra pegada al Avatar).
    const view = new CoreViewImpl(
      makeGame({ time: { year: 139, month: 4, day: 7, hour: 2, minute: 0 }, torchTurns: 0 }),
    );
    const snap = view.snapshot();
    const c = VIEW_HALF * VIEW_WINDOW + VIEW_HALF;
    const far = VIEW_HALF * VIEW_WINDOW + (VIEW_HALF + 2); // 2 casillas: oculta de noche
    // window censura (byte-intacta); terrainWindow NO (terreno crudo = hierba 5).
    expect(snap.window[far]).toBe(TILE_HIDDEN);
    expect(snap.terrainWindow![far]).toBe(5);
    // visMask: centro visible (1), lejos oculto (0).
    expect(snap.visMask).toBeDefined();
    expect(snap.visMask!.length).toBe(VIEW_WINDOW * VIEW_WINDOW);
    expect(snap.visMask![c]).toBe(1);
    expect(snap.visMask![far]).toBe(0);
  });

  // An Tym (parar el tiempo, g_time_spell=='T'/0x54): el snapshot de mapa expone
  // `timeStopped` para que la piel congele el contador por-turno de los sprites de
  // criatura (`skin/fiel/skin.ts onTurn`). El terreno NO depende de ese contador →
  // sigue animando. Ver re/notes/antim-freeze.md.
  it("An Tym: timeStopped=true con timeSpell 'T'; falsy sin él", () => {
    expect(new CoreViewImpl(makeGame({ timeSpell: "T", timeSpellTurns: 10 })).snapshot().timeStopped).toBe(true);
    // Sin hechizo de tiempo → sin congelación.
    expect(new CoreViewImpl(makeGame()).snapshot().timeStopped).toBeFalsy();
    // Otro efecto temporal (Quickness 'Q') NO es An Tym → no congela.
    expect(new CoreViewImpl(makeGame({ timeSpell: "Q", timeSpellTurns: 10 })).snapshot().timeStopped).toBeFalsy();
  });
});

describe("CoreViewImpl censura de visibilidad (E1-S2)", () => {
  const CENTER = VIEW_HALF * VIEW_WINDOW + VIEW_HALF;

  it("día: ventana entera visible, sin TILE_HIDDEN", () => {
    // hora 12 → luz 50 (día pleno).
    const view = new CoreViewImpl(makeGame({ time: { year: 139, month: 4, day: 7, hour: 12, minute: 0 } }));
    const snap = view.snapshot();
    expect([...snap.window].some((t) => t === TILE_HIDDEN)).toBe(false);
    // Esquina (dentro del overworld que hace wrap) = hierba visible.
    expect(snap.window[0]).toBe(5);
  });

  it("noche: sólo el 3×3 alrededor de la party; el resto a negro (TILE_HIDDEN)", () => {
    // hora 2 + sin antorcha → luz 2 (noche).
    const view = new CoreViewImpl(
      makeGame({ time: { year: 139, month: 4, day: 7, hour: 2, minute: 0 }, torchTurns: 0 }),
    );
    const snap = view.snapshot();
    // Centro = avatar.
    expect(snap.window[CENTER]).toBe(284);
    // 3×3 alrededor: terreno visible (hierba, salvo el centro).
    expect(snap.window[(VIEW_HALF - 1) * VIEW_WINDOW + VIEW_HALF]).toBe(5);
    // A 2 casillas: censurado.
    expect(snap.window[VIEW_HALF * VIEW_WINDOW + (VIEW_HALF + 2)]).toBe(TILE_HIDDEN);
    // La esquina: censurada (dentro del mapa, no visible).
    expect(snap.window[0]).toBe(TILE_HIDDEN);
  });

  it("antorcha de noche amplía el radio (más casillas visibles que sin ella)", () => {
    const night = { time: { year: 139, month: 4, day: 7, hour: 2, minute: 0 } };
    const dark = new CoreViewImpl(makeGame({ ...night, torchTurns: 0 }));
    const lit = new CoreViewImpl(makeGame({ ...night, torchTurns: 100 }));
    const visibleCount = (v: CoreViewImpl): number =>
      [...v.snapshot().window].filter((t) => t !== TILE_HIDDEN).length;
    expect(visibleCount(lit)).toBeGreaterThan(visibleCount(dark));
  });

  it("la censura viaja en snapshot.window (radio nocturno, decisión #5)", () => {
    // La ventana está centrada en la party; el render lee estas casillas, no una
    // consulta por-tile (E1-S3). Noche radio 2: centro + radial ≤ 2 visibles.
    const view = new CoreViewImpl(
      makeGame({ time: { year: 139, month: 4, day: 7, hour: 2, minute: 0 }, torchTurns: 0 }),
    );
    const w = view.snapshot().window;
    expect(w[CENTER]).toBe(284); // la party (centro)
    expect(w[VIEW_HALF * VIEW_WINDOW + (VIEW_HALF + 1)]).toBe(5); // radial 1: hierba visible
    expect(w[VIEW_HALF * VIEW_WINDOW + (VIEW_HALF + 3)]).toBe(TILE_HIDDEN); // radial 9 > 2
  });
});

describe("CoreViewImpl entidades de combate (sprite por clase, party_anim_build 0x6936)", () => {
  // Inyecta un combate REAL mínimo: entities() lee game.combat.combatants y
  // resuelve el tile de cada PJ por su CLASE vía state.characters[charIdx].class.
  function gameInCombat(
    characters: CharacterState[],
    combatants: unknown[],
  ): CoreViewImpl {
    const game = makeGame({ characters, partySize: characters.length });
    (game as unknown as { combat: unknown }).combat = {
      mapTiles: [],
      combatants,
      lootTiles: () => [],
      get activeActor() {
        return null;
      },
    };
    return new CoreViewImpl(game);
  }
  // arena (x,y) → índice de ventana en modo combate (center=5,5, VIEW_HALF=5 ⇒ col=x, row=y).
  const cell = (x: number, y: number): number => y * VIEW_WINDOW + x;

  it("cada miembro sale con el sprite de SU clase (screenshot del usuario: Avatar+Shamino+Iolo = 3 tiles distintos)", () => {
    // Regresión del bug: antes TODOS usaban AVATAR_TILE (284) → tres caballeros iguales.
    const chars = [
      makeChar({ name: "Avatar", class: "A" }), // → Avatar1  0x14c
      makeChar({ name: "Shamino", class: "F" }), // → Fighter1 0x148 (roster real: 'F')
      makeChar({ name: "Iolo", class: "B" }), // → Bard1    0x144
    ];
    const combatants = [
      { id: 1, kind: "player", charIdx: 0, x: 2, y: 3, status: "active", invisible: false },
      { id: 2, kind: "player", charIdx: 1, x: 4, y: 3, status: "active", invisible: false },
      { id: 3, kind: "player", charIdx: 2, x: 6, y: 3, status: "active", invisible: false },
    ];
    const w = gameInCombat(chars, combatants).snapshot().window;
    expect(w[cell(2, 3)]).toBe(0x14c); // Avatar1
    expect(w[cell(4, 3)]).toBe(0x148); // Fighter1
    expect(w[cell(6, 3)]).toBe(0x144); // Bard1
    // Load-bearing: los tres son DISTINTOS y ninguno es el andar del mundo (284).
    const tiles = [w[cell(2, 3)], w[cell(4, 3)], w[cell(6, 3)]];
    expect(new Set(tiles).size).toBe(3);
    expect(tiles).not.toContain(284);
  });

  it("mapea A/B/F/M a Avatar1/Bard1/Fighter1/Wizard1 (jump-table cs:[bx+0x6b04])", () => {
    const chars = [
      makeChar({ class: "A" }),
      makeChar({ class: "B" }),
      makeChar({ class: "F" }),
      makeChar({ class: "M" }),
    ];
    const combatants = chars.map((_, i) => ({
      id: i + 1, kind: "player", charIdx: i, x: i, y: 0, status: "active", invisible: false,
    }));
    const w = gameInCombat(chars, combatants).snapshot().window;
    expect(w[cell(0, 0)]).toBe(0x14c); // A Avatar1
    expect(w[cell(1, 0)]).toBe(0x144); // B Bard1
    expect(w[cell(2, 0)]).toBe(0x148); // F Fighter1
    expect(w[cell(3, 0)]).toBe(0x140); // M Wizard1
  });

  it("los enemigos siguen usando def.tile (no se ven afectados por el fix)", () => {
    const chars = [makeChar({ class: "A" })];
    const combatants = [
      { id: 1, kind: "player", charIdx: 0, x: 1, y: 1, status: "active", invisible: false },
      { id: 2, kind: "enemy", x: 3, y: 1, status: "active", invisible: false, enemyDef: { tile: 0x150 } },
    ];
    const w = gameInCombat(chars, combatants).snapshot().window;
    expect(w[cell(1, 1)]).toBe(0x14c); // party: sprite por clase
    expect(w[cell(3, 1)]).toBe(0x150); // enemigo: def.tile intacto
  });

  it("los restos de la arena (cadáver/sangre/cofre) se blitean del BANCO ALTO (+0x100)", () => {
    // Regresión del testigo del PUENTE: lootTiles() devuelve el BYTE del objeto que
    // COMBAT:0x1574 escribe (cadáver 0x1E, sangre 0x1F, cofre 0x01); el render de la
    // arena los pinta desde el banco alto igual que PJ/enemigos. Sin el +0x100 salían
    // sus gemelos del banco bajo (0x1E LeftDesert2 / 0x1F RightDesert2 / 0x01 Water1) —
    // el «desierto con transparencia» sobre los tablones del puente.
    const game = makeGame({ characters: [makeChar({ class: "A" })], partySize: 1 });
    (game as unknown as { combat: unknown }).combat = {
      mapTiles: [],
      combatants: [],
      lootTiles: () => [
        { x: 2, y: 2, tile: 0x1e }, // cadáver de PJ
        { x: 4, y: 2, tile: 0x1f }, // charco de sangre
        { x: 6, y: 2, tile: 0x01 }, // cofre
      ],
      get activeActor() {
        return null;
      },
    };
    const w = new CoreViewImpl(game).snapshot().window;
    expect(w[cell(2, 2)]).toBe(0x11e); // DeadBody, no 0x1E LeftDesert2
    expect(w[cell(4, 2)]).toBe(0x11f); // Splat,    no 0x1F RightDesert2
    expect(w[cell(6, 2)]).toBe(0x101); // Chest,    no 0x01 Water1
  });

  // Gate del comando (Z)stats en COMBATE (thunk 0x9ce→dba6 del árbol COMBAT.OVL 0x0838):
  // el bucle de comando de combate acepta la 'Z' → `awaitingCommand` alto. RE-BASELINE
  // careo-combate T8: `awaitingInput` ya NO se apaga por combate — el await de combate
  // muestra el prompt ▷+cursor bajo el banner "armed with" (j-full-t3); el apagado
  // durante la tanda enemiga paceada lo gobierna main.ts (setAwaitingInput).
  it("en combate: awaitingInput=true (prompt ▷ del await, T8) y awaitingCommand=true (gate de Z-stats)", () => {
    const view = gameInCombat(
      [makeChar({ class: "A" })],
      [{ id: 1, kind: "player", charIdx: 0, x: 1, y: 1, status: "active", invisible: false }],
    );
    view.setAwaitingInput(true); // bucle de comando (sin getstring/getnum abierto)
    const snap = view.snapshot();
    expect(snap.awaitingInput).toBe(true); // prompt ▷+cursor también en combate (T8)
    expect(snap.awaitingCommand).toBe(true); // y la 'Z' SÍ abre Ztats en la arena
  });

  it("en combate con getstring rúnico (Cast) abierto: awaitingCommand=false protege la 'Z'", () => {
    const view = gameInCombat(
      [makeChar({ class: "A" })],
      [{ id: 1, kind: "player", charIdx: 0, x: 1, y: 1, status: "active", invisible: false }],
    );
    view.setAwaitingInput(false); // main.ts apaga `this.awaiting` mientras hay un getstring
    const snap = view.snapshot();
    expect(snap.awaitingCommand).toBe(false); // 'z' es CARÁCTER (An Zu), no comando
  });

  it("fuera de combate: awaitingCommand coincide con awaitingInput", () => {
    const view = new CoreViewImpl(makeGame());
    view.setAwaitingInput(true);
    let snap = view.snapshot();
    expect(snap.awaitingCommand).toBe(true);
    expect(snap.awaitingInput).toBe(true);
    view.setAwaitingInput(false);
    snap = view.snapshot();
    expect(snap.awaitingCommand).toBe(false);
    expect(snap.awaitingInput).toBe(false);
  });
});

describe("CoreViewImpl consola compartida", () => {
  it("mantiene un ring corto y notifica onConsole", () => {
    const view = new CoreViewImpl(makeGame());
    const seen: string[][] = [];
    view.subscribe({ onConsole: (lines) => seen.push(lines.map((l) => l.text)) });
    for (let i = 0; i < 20; i++) view.pushConsole(`line ${i}`);
    const snap = view.snapshot();
    expect(snap.console.length).toBe(12); // ring de 12
    expect(snap.console.at(-1)?.text).toBe("line 19");
    expect(seen.at(-1)?.at(-1)).toBe("line 19");
  });

  it("echoSetLast reescribe la fila de eco viva (getstring de consola: Yell)", () => {
    const view = new CoreViewImpl(makeGame());
    const seen: string[][] = [];
    view.subscribe({ onConsole: (lines) => seen.push(lines.map((l) => l.text)) });
    view.pushConsole("Yell ", "echo"); // eco del comando
    view.echoSetLast("Yell F"); // teclea 'F' → re-pinta la MISMA fila
    view.echoSetLast("Yell FI"); // 'I'
    view.echoSetLast("Yell F"); // backspace
    const snap = view.snapshot();
    expect(snap.console.length).toBe(1); // NO abre filas nuevas: reescribe la última
    expect(snap.console.at(-1)?.text).toBe("Yell F");
    expect(snap.console.at(-1)?.kind).toBe("echo");
    expect(seen.at(-1)?.at(-1)).toBe("Yell F"); // notifica onConsole en cada pulsación
  });

  it("echoSetLast abre fila nueva si la última no es un eco (defensivo)", () => {
    const view = new CoreViewImpl(makeGame());
    view.pushConsole("Result.", "message"); // último = mensaje, no eco
    view.echoSetLast("Yell F");
    const snap = view.snapshot();
    expect(snap.console.length).toBe(2);
    expect(snap.console.at(-1)?.text).toBe("Yell F");
    expect(snap.console.at(-1)?.kind).toBe("echo");
  });
});

/**
 * #108 — ARITMÉTICA DE FILAS del impresor del kernel (`print_string` 0x1850).
 *
 * Regla derivada por DOBLE TESTIGO CIEGO del ASM (re/notes/printstr-1850-derivacion.md,
 * cuerpo entero de 201 instrucciones + 4 callees; carriles printstr-108 y ready-flow
 * coinciden en la aritmética). El modelo del original NO es «lista de líneas» sino un
 * CURSOR (fila, columna) sobre la ventana de texto:
 *
 *   · `1742: inc byte ptr [si + 5]` (emisor de carácter 0x16ba) — FILA++ SIN NINGUNA
 *     GUARDA. Todo 0x0a avanza fila, siempre; no hay memoria del carácter anterior ⇒
 *     los blancos consecutivos NO se colapsan (§4.1, §6 p.3).
 *   · `1910: call 0x16ba` (rama de segmento vacío) — cada \n de la entrada se emite
 *     VERBATIM exactamente una vez (§2.4).
 *   · Una fila SOLO existe si se dibujó glifo en ella: el \n final deja el cursor en la
 *     columna 0 de la siguiente, pero no crea fila ⇒ «Pass\n» = 1 fila, no 2 (§6 p.1a).
 *   · El idioma «no gastes fila si ya estás en columna 0» vive en los CALL-SITES que
 *     MIDEN COLUMNA (kernel 0x4a3d `call 0x1f12; or ax,ax; je`, y ZSTATS 0x004d byte a
 *     byte por thunks, sesgo +0xE1E0 verificado con 3 puntos) — NO en el impresor (§4.3).
 *     `pushConsole` modela ese envoltorio: cierra la fila abierta al terminar. Ver la
 *     ADJUDICACIÓN del hueco §7.4 en re/notes/printstr-108-impl.md §2.
 *
 * ⇒ El port necesita estado de FILA ABIERTA (el equivalente de línea de la columna del
 * cursor): podar el trozo vacío final del `split` NO basta (§7.3 trampa 1), porque no
 * distingue «este \n cierra una fila viva» de «este \n deja una fila en blanco».
 */
describe("#108 CoreViewImpl aritmética de filas (print_string 0x1850)", () => {
  const rows = (v: CoreViewImpl): string[] => v.snapshot().console.map((l) => l.text);

  it("«Pass\\n» desde fila cerrada = UNA fila (el \\n final no crea fila)", () => {
    const view = new CoreViewImpl(makeGame());
    view.pushConsole("Pass\n");
    expect(rows(view)).toEqual([
      "Pass",
      // ASM: 0x1910 emite el 0x0a una sola vez y 0x1742 `inc [si+5]` solo mueve el
      // cursor a la columna 0 de la fila siguiente — una fila sin glifo NO existe.
      // printstr-1850-derivacion.md §6 p.1a: original 1, port (pre-#108) 2 ⇒ sobraba 1.
    ]);
  });

  it("«Ready...\\n\\n» desde fila cerrada = DOS filas (contenido + UNA en blanco)", () => {
    const view = new CoreViewImpl(makeGame());
    view.pushConsole("Ready...\n\n");
    expect(rows(view)).toEqual(
      ["Ready...", ""],
      // ASM: DOS pasadas por 0x1910 ⇒ dos `1742: inc byte ptr [si+5]`. El 1º cierra la
      // fila de contenido, el 2º quema una fila entera en blanco.
      // §6 p.1b: original 2, port (pre-#108) 3 ⇒ sobraba 1.
    );
  });

  it("tres (P)ass seguidos = tres filas CONSECUTIVAS, sin blancos entre ellas", () => {
    const view = new CoreViewImpl(makeGame());
    view.pushConsole("Pass\n");
    view.pushConsole("Pass\n");
    view.pushConsole("Pass\n");
    expect(rows(view)).toEqual(
      ["Pass", "Pass", "Pass"],
      // Predicción PRE-REGISTRADA §8.1 para el testigo DOSBox: si aparece un blanco
      // entre Pass y Pass, el acta printstr-1850-derivacion.md está REFUTADA.
      // El port pre-#108 mostraba Pass, blanco, Pass, blanco, Pass, blanco.
    );
  });

  it("NO colapsa blancos consecutivos: «a\\n\\n\\nb» deja DOS filas vacías reales", () => {
    const view = new CoreViewImpl(makeGame());
    view.pushConsole("a\n\n\nb");
    expect(rows(view)).toEqual(
      ["a", "", "", "b"],
      // ASM: `1742: inc byte ptr [si+5]` NO lleva `cmp` previo ni memoria del carácter
      // anterior ⇒ cada 0x0a = un inc de fila (§6 p.3, §7.3 trampa 3: los blancos
      // interiores son REALES, no se des-duplican ni se recortan).
    );
  });

  it("«Thou art empty-\\nhanded!\\n» = DOS filas de contenido, CERO blancos", () => {
    const view = new CoreViewImpl(makeGame());
    view.pushConsole("Thou art empty-\nhanded!\n");
    expect(rows(view)).toEqual(
      ["Thou art empty-", "handed!"],
      // DS 0x997e, wrap HORNEADO en el propio literal. ASM §6 p.5: el impresor NO
      // distingue el \n horneado del \n de fin de entrada — mismo byte, mismo camino
      // (0x18ef corta el segmento sea cual sea su origen). Predicción §8.6.
    );
  });

  it("«Spell name:\\n:» = una fila volcada + el cursor «:» en fila propia ABIERTA", () => {
    const view = new CoreViewImpl(makeGame());
    view.pushConsole("Spell name:\n:");
    expect(rows(view)).toEqual(
      ["Spell name:", ":"],
      // DS 0x4603. El \n interior vuelca; el ":" abre fila y NO se vuelca al terminar
      // la llamada salvo por el envoltorio del call-site (§7.2, tabla caso a caso).
    );
  });

  // ── El discriminante FINO (§8.5): el mismo literal da 1 ó 2 blancos según la COLUMNA ──
  // Es el único caso que distingue el modelo de CURSOR de un modelo de líneas puro, y
  // el que prueba que hace falta el estado de fila abierta (§7.3 trampa 1).

  // ⚠ DETECTOR, NO VEREDICTO DE FIDELIDAD — residuo declarado de #108.
  // El original, desde columna C > 0, deja UN solo blanco aquí (§5: 0x0bee imprime
  // "\n\n" + arg + "\n\nItem: " por el impresor CRUDO; el 1er 0x0a cierra la fila viva
  // sin quemar nada y solo el 2º deja blanco). El port deja DOS porque `messageAppend`
  // no arrastra columna a la llamada siguiente, y no puede: sus call-sites podaron el
  // `\n` de la cadena del binario (main.ts:836 "Yes" por 0x967a "Yes\n"), así que marcar
  // la fila como abierta pegaría "Saving..." al "Save game? Yes" anterior. Cerrar esto
  // exige devolver esos `\n` — tarjeta aparte, ver printstr-108-impl.md §3.
  // Este expect fija el BASELINE MEDIDO del port; si se pone rojo es que el port cambió,
  // NO que se haya vuelto fiel. Al arreglar el residuo, el valor esperado pasa a
  // ["Item: Ring", "", "Item: "] y este comentario se retira.
  it("DETECTOR: «\\n\\nItem: » tras messageAppend deja DOS blancos (original: UNO)", () => {
    const view = new CoreViewImpl(makeGame());
    view.pushConsole("Item: "); // "Item: " (DS 0x9998)
    view.messageAppend("Ring"); // continúa la fila viva ⇒ en el ORIGINAL, col > 0
    view.pushConsole("\n\nItem: "); // re-prompt de la envoltura ZSTATS 0x0bee
    expect(rows(view)).toEqual(
      ["Item: Ring", "", "", "Item: "],
      // Baseline del PORT (no del binario). Memoria ready-reject-wrapper-0xbee: la línea
      // en blanco + el RE-PROMPT los pone la envoltura 0x0bee, así que el call-site NO
      // debe duplicarlos — eso sigue siendo cierto y no es lo que mide este detector.
    );
  });

  it("«\\n\\nItem: » con fila CERRADA: DOS blancos (el 1º ya no cierra nada)", () => {
    const view = new CoreViewImpl(makeGame());
    view.pushConsole("Pass\n"); // deja la fila CERRADA (cursor en columna 0)
    view.pushConsole("\n\nItem: ");
    expect(rows(view)).toEqual(
      ["Pass", "", "", "Item: "],
      // ASM §5 + §6 p.2: la asimetría NO la produce ninguna rama del impresor (1742 es
      // un `inc` incondicional) sino el ESTADO PREVIO de [si+4] (la columna). Desde
      // columna 0 los dos 0x0a queman fila ⇒ DOS blancos. Predicción §8.5.
    );
  });

  it("cadena VACÍA: no imprime nada ni mueve el cursor (0x186f)", () => {
    const view = new CoreViewImpl(makeGame());
    view.pushConsole("Pass\n");
    view.pushConsole("");
    expect(rows(view)).toEqual(
      ["Pass"],
      // ASM 0x186a-0x186f: `cmp byte ptr [bx],0 / jne / jmp 0x1a36` — la cadena vacía
      // sale ANTES de tocar la ventana. Un split("") que empuje "" ya diverge aquí (§1).
    );
  });
});

describe("CoreViewImpl awaitingInput (gate del cursor F-G)", () => {
  it("NO se apaga por el COMBATE en sí (careo-combate T8: prompt ▷ en el await de la arena)", () => {
    const game = makeGame();
    const view = new CoreViewImpl(game);
    // Overworld en reposo → el bucle está en el prompt de comando: cursor ON.
    expect(view.snapshot().awaitingInput).toBe(true);
    // Combate activo: el original SÍ pinta ▷+cursor bajo el banner del turno
    // (j-full-t3) — el gate previo por game.combat quedó falsificado (T8). El
    // apagado durante la tanda enemiga lo conduce main.ts vía setAwaitingInput.
    game.combat = { mapTiles: [], combatants: [], lootTiles: () => [] } as unknown as NonNullable<Game["combat"]>;
    expect(view.snapshot().awaitingInput).toBe(true);
    game.combat = null;
    expect(view.snapshot().awaitingInput).toBe(true);
  });

  it("respeta el gate de modales de UI (setAwaitingInput)", () => {
    const view = new CoreViewImpl(makeGame());
    view.setAwaitingInput(false); // diálogo/selector/prompt Y-N abierto
    expect(view.snapshot().awaitingInput).toBe(false);
    view.setAwaitingInput(true);
    expect(view.snapshot().awaitingInput).toBe(true);
  });

  it("en combate manda el gate de modales/pacer (setAwaitingInput), no game.combat (T8)", () => {
    const game = makeGame();
    const view = new CoreViewImpl(game);
    game.combat = { mapTiles: [], combatants: [], lootTiles: () => [] } as unknown as NonNullable<Game["combat"]>;
    view.setAwaitingInput(false); // modal abierto o tanda enemiga paceada (main.ts)
    expect(view.snapshot().awaitingInput).toBe(false);
    // Modal cerrado / tanda terminada → prompt ▷ del await de combate (T8).
    view.setAwaitingInput(true);
    expect(view.snapshot().awaitingInput).toBe(true);
    game.combat = null;
    expect(view.snapshot().awaitingInput).toBe(true);
  });
});

describe("CoreViewImpl vista de mazmorra (E1-S9)", () => {
  function emptyFloor(): DungeonCell[][] {
    return Array.from({ length: 8 }, () =>
      Array.from({ length: 8 }, () => ({ type: CellType.Nothing, sub: 0 })),
    );
  }
  function makeDungeon(): DungeonData {
    const floors = Array.from({ length: 8 }, () => emptyFloor());
    floors[0]![3]![5] = { type: CellType.Wall, sub: 0 }; // muro en (x5,y3)
    return { location: 33, name: "Test", floors };
  }

  it("expone el cono ILUMINADO (profundidad 4) por facing, coords absolutas", () => {
    const game = makeGame({ torchTurns: 100 });
    game.dungeonState = new DungeonState([makeDungeon()], {
      dungeon: 33,
      floor: 0,
      x: 3,
      y: 3,
      facing: "east",
    });
    const dv = new CoreViewImpl(game).snapshot().dungeon;
    expect(dv).not.toBeNull();
    expect(dv!.facing).toBe("east");
    expect(dv!.lightDepth).toBe(4); // task #47: raycast de 4 celdas (DUNGEON:0x1B0C)
    expect(dv!.lit).toBe(true);
    // 4 profundidades (0..3) × 3 (frente + 2 laterales) = 12 celdas, todas en rango.
    expect(dv!.cells.length).toBe(12);
    expect(dv!.cells.find((c) => c.x === 5 && c.y === 3)?.type).toBe(CellType.Wall);
    expect(dv!.pos).toEqual({ x: 3, y: 3 });
  });

  it("a oscuras (sin antorcha) el cono es solo la celda actual + laterales", () => {
    const game = makeGame({ torchTurns: 0 });
    game.dungeonState = new DungeonState([makeDungeon()], {
      dungeon: 33,
      floor: 0,
      x: 3,
      y: 3,
      facing: "east",
    });
    const dv = new CoreViewImpl(game).snapshot().dungeon;
    expect(dv!.lightDepth).toBe(0);
    expect(dv!.lit).toBe(false);
    expect(dv!.cells.length).toBe(3); // (3,3) + (3,2) + (3,4)
  });

  it("snapshot.dungeon es null fuera de mazmorra", () => {
    expect(new CoreViewImpl(makeGame()).snapshot().dungeon).toBeNull();
  });

  // COMBAT-VIEW-BUG: al entrar a una SALA de mazmorra, game.combat y game.dungeonState
  // COEXISTEN (el 3D se reanuda al salir por el borde, así que dungeonState NO se anula).
  // Pero la VISTA debe ser la ARENA, no el pasillo 3D. Antes `dungeon` seguía no-nulo y la
  // piel (skin.ts prioriza snap.dungeon) pintaba el corredor con viewport negro ENCIMA del
  // combate en curso. El gate anula `dungeon` mientras hay combate.
  it("en combate de SALA (dungeonState + combat coexisten): dungeon=null, la vista es la arena", () => {
    const game = makeGame({ torchTurns: 100 });
    game.dungeonState = new DungeonState([makeDungeon()], {
      dungeon: 33, floor: 0, x: 3, y: 3, facing: "east",
    });
    // Combate REAL mínimo inyectado ENCIMA de la mazmorra (como al pisar una sala 0xF).
    (game as unknown as { combat: unknown }).combat = {
      mapTiles: [],
      combatants: [{ id: 1, kind: "player", charIdx: 0, x: 5, y: 5, status: "active", invisible: false }],
      lootTiles: () => [],
      get activeActor() { return null; },
    };
    const snap = new CoreViewImpl(game).snapshot();
    expect(snap.mode).toBe("combat");
    expect(snap.dungeon).toBeNull(); // ← el fix: el pasillo 3D NO gana al combate
    expect(snap.combatView).not.toBeNull(); // la arena manda
  });

  it("al CERRAR el combate (combat=null, dungeonState sigue) el 3D REANUDA (dungeon vuelve)", () => {
    const game = makeGame({ torchTurns: 100 });
    game.dungeonState = new DungeonState([makeDungeon()], {
      dungeon: 33, floor: 0, x: 3, y: 3, facing: "east",
    });
    (game as unknown as { combat: unknown }).combat = null; // endCombat ya cerró la arena
    const snap = new CoreViewImpl(game).snapshot();
    expect(snap.mode).toBe("dungeon");
    expect(snap.dungeon).not.toBeNull(); // reanuda el corredor en la celda de salida
    expect(snap.combatView).toBeNull();
  });
});

describe("CoreViewImpl fan-out de turno", () => {
  it("entrega onTurn a TODAS las pieles suscritas y respeta unsubscribe", () => {
    const view = new CoreViewImpl(makeGame());
    let a = 0, b = 0;
    const offA = view.subscribe({ onTurn: () => a++ });
    view.subscribe({ onTurn: () => b++ });
    view.notifyTurn([{ kind: "message", text: "x" }]);
    expect([a, b]).toEqual([1, 1]);
    offA();
    view.notifyTurn([{ kind: "message", text: "y" }]);
    expect([a, b]).toEqual([1, 2]); // A ya no recibe
  });
});

describe("SkinManager swap", () => {
  /** Piel de prueba (sin DOM): registra sus llamadas de ciclo de vida. */
  function fixtureSkin(id: string, log: string[]): Skin {
    return {
      id,
      mount(_root: HTMLElement, view: CoreView) {
        log.push(`mount:${id}`);
        // Prueba de contrato: la piel sólo LEE del view.
        view.snapshot();
      },
      unmount() {
        log.push(`unmount:${id}`);
      },
    };
  }

  it("desmonta la piel saliente antes de montar la entrante", async () => {
    const log: string[] = [];
    const view = new CoreViewImpl(makeGame());
    const intents: IntentSink = { dispatch() {} };
    const mgr = new SkinManager({} as unknown as HTMLElement, view, intents);
    mgr.register(fixtureSkin("dev", log));
    mgr.register(fixtureSkin("faithful", log));

    await mgr.swap("dev");
    expect(mgr.currentId).toBe("dev");
    await mgr.toggle();
    expect(mgr.currentId).toBe("faithful");
    await mgr.toggle();
    expect(mgr.currentId).toBe("dev");

    expect(log).toEqual([
      "mount:dev",
      "unmount:dev",
      "mount:faithful",
      "unmount:faithful",
      "mount:dev",
    ]);
  });

  it("toggle es no-op con una sola piel (E1-S1: sólo dev)", async () => {
    const log: string[] = [];
    const view = new CoreViewImpl(makeGame());
    const mgr = new SkinManager({} as unknown as HTMLElement, view, { dispatch() {} });
    mgr.register(fixtureSkin("dev", log));
    await mgr.swap("dev");
    await mgr.toggle();
    expect(mgr.currentId).toBe("dev");
    expect(log).toEqual(["mount:dev"]); // ni unmount ni segundo mount
  });
});

describe("CoreViewImpl.snapshot — gate de la banda celeste (E1-S8b, 0x4a8c)", () => {
  // Mundo con small maps para pueblo (1), Ararat (25) y una loc de mazmorra (33).
  function worldWithTowns(): WorldData {
    const w = grassWorld();
    const floor = { z: 0, tiles: Array.from({ length: 32 }, () => Array.from({ length: 32 }, () => 5)) };
    for (const id of [1, 25, 33]) w.smallMaps.set(id, { id, name: `Loc${id}`, floors: [floor] });
    return w;
  }
  // gameData con la tabla lunar (bytes 0x30+fase); día 7 → i=12 → fase 3/3.
  const skyData: GameData = { locationsX: [], locationsY: [], locationNames: [], moonPhases: Array(56).fill(0x33) };

  function skyGame(pos: { location: number; floor: number }, wind?: number): Game {
    return new Game(
      {} as ExtractedInitialState,
      worldWithTowns(),
      skyData,
      makeState({ position: { ...pos, x: 15, y: 15 }, wind }),
      { combatResources },
    );
  }

  it("overworld: banda presente con las fases del día", () => {
    const snap = new CoreViewImpl(skyGame({ location: 0, floor: 0 })).snapshot();
    expect(snap.sky).toEqual({ felucca: 3, trammel: 3 });
  });

  it("PUEBLO (loc 1): banda PRESENTE — el kernel sólo la apaga en mazmorra (fix review)", () => {
    const snap = new CoreViewImpl(skyGame({ location: 1, floor: 0 })).snapshot();
    expect(snap.sky).not.toBeNull();
  });

  it("mazmorra (loc >= 0x21): banda null (0x4a8c cmp 0x21 jb)", () => {
    const snap = new CoreViewImpl(skyGame({ location: 33, floor: 0 })).snapshot();
    expect(snap.sky).toBeNull();
  });

  it("Ararat (loc 0x19): banda null (dibuja cajas, 0x4ba2)", () => {
    const snap = new CoreViewImpl(skyGame({ location: 25, floor: 0 })).snapshot();
    expect(snap.sky).toBeNull();
  });

  it("underworld (floor >= 0x80): banda null (0x4b5d)", () => {
    const snap = new CoreViewImpl(skyGame({ location: 0, floor: 0xff })).snapshot();
    expect(snap.sky).toBeNull();
  });

  // El indicador de VIENTOS comparte el gate de la banda celeste (draw_wind_indicator
  // 0x2E96 @0x2eaa: location < 0x21 && != 0x19 && floor < 0x80), defecto #4 del marco.
  it("VIENTOS en PUEBLO (loc 1): dirección VISIBLE — el original lo pinta en interiores", () => {
    const snap = new CoreViewImpl(skyGame({ location: 1, floor: 0 }, 2)).snapshot();
    expect(snap.wind).toBe("South");
  });

  it("VIENTOS en overworld con Calm (g_wind 0): 'Calm', no null (asm 0x2ef8)", () => {
    const snap = new CoreViewImpl(skyGame({ location: 0, floor: 0 }, 0)).snapshot();
    expect(snap.wind).toBe("Calm");
  });

  it("VIENTOS en mazmorra (loc >= 0x21) y underworld (floor >= 0x80): null", () => {
    expect(new CoreViewImpl(skyGame({ location: 33, floor: 0 }, 2)).snapshot().wind).toBeNull();
    expect(new CoreViewImpl(skyGame({ location: 0, floor: 0xff }, 2)).snapshot().wind).toBeNull();
  });
});

describe("CoreViewImpl.snapshot — ztats (E1-S11, info visible del record)", () => {
  it("expone la ficha completa de cada miembro de la party", () => {
    const snap = new CoreViewImpl(makeGame()).snapshot();
    expect(snap.ztats.length).toBe(2);
    // makeChar: Str/Dex/Int 20, HP 50/60, MP 10, clase 'A', estado 'G'.
    expect(snap.ztats[0]).toMatchObject({
      name: "Avatar",
      charClass: "A",
      status: "G",
      str: 20,
      dex: 20,
      int: 20,
      hp: 50,
      maxHp: 60,
      mp: 10,
      level: 2,
    });
  });

  it("wind: nombre en overworld Y pueblos (gate 0x2E96), 'Calm' en calma, null en underworld (F-C)", () => {
    const overE = new CoreViewImpl(makeGame({ wind: 3, position: { location: 0, floor: 0, x: 50, y: 50 } })).snapshot();
    expect(overE.wind).toBe("East");
    // Calm (g_wind 0) IMPRIME "Calm Winds" en el original (asm 0x2ef8 imprime la cadena
    // 0x555c="Calm"), no se oculta — la piel fiel lo muestra igual que las demás.
    const calm = new CoreViewImpl(makeGame({ wind: 0, position: { location: 0, floor: 0, x: 50, y: 50 } })).snapshot();
    expect(calm.wind).toBe("Calm");
    // El caso PUEBLO (location < 0x21 → viento visible, asm 0x2eaa; antes se ocultaba
    // con `location !== 0`) se cubre en el bloque "gate de la banda celeste" con un
    // mundo que instancia small maps (skyGame). Underworld (floor >= 0x80): sin
    // indicador (asm 0x2ebe salta el dibujo).
    const under = new CoreViewImpl(makeGame({ wind: 1, position: { location: 0, floor: 0xff, x: 50, y: 50 } })).snapshot();
    expect(under.wind).toBeNull();
  });

  it("mapea el byte de género a M/F (0x0B/0x0C)", () => {
    const male = new CoreViewImpl(makeGame({ characters: [makeChar({ name: "M", gender: 0x0b, partyStatus: 0 })] }))
      .snapshot();
    const female = new CoreViewImpl(makeGame({ characters: [makeChar({ name: "F", gender: 0x0c, partyStatus: 0 })] }))
      .snapshot();
    expect(male.ztats[0]!.gender).toBe("M");
    expect(female.ztats[0]!.gender).toBe("F");
  });

  it("página Items (lista 0xf): nombres 0x1916 verbatim, sin-número POR ÍTEM (0xff)", () => {
    // Tabla extendida 0xb9ee (build_extended_item_table 0x099a) con los NOMBRES EXACTOS de
    // la name-table 0x1916: scrolls `*código` (glifo pergamino), potions `!color` (glifo
    // poción), Magic Crpt, Skull Keys, Amulet/Crown/Sceptre, shards, Pocket Watch, box…
    // El "sin número" es un FLAG POR ÍTEM (byte guardado 0xff). 🔴 CORRECCIÓN (carril
    // usepicker-fidelidad): quién vale 0xff lo dice el CENSO DE ESCRITORES del disasm, no
    // los saves de la biblioteca. Los NUEVE escritores de flags graban 0xff (spyglass TALK
    // 0x06f8 · sextant TALK 0x06f0 · badge TALK 0x0700 · box SJOG 0x14f7 · hms cape SJOG
    // 0x15d4 · amulet/crown/sceptre SJOG 0x1712/0x16e6/0x1706 · shards SJOG 0x16bd) ⇒ los
    // seis útiles salen SIN número. El "Wooden Box=1" que decía la versión anterior venía
    // de `puertas-doom-con-caja/SAVED.GAM`, y ese 1 lo escribió NUESTRO writeBoolPreserve
    // al encender el flag, no EA. Contables de verdad: scrolls, potions, carpet, skull keys.
    const snap = new CoreViewImpl(
      makeGame({
        scrollQuantities: [14, 0, 0, 0, 0, 0, 2, 0],
        potionQuantities: [0, 3, 0, 0, 0, 0, 0, 0],
        magicCarpets: 1,
        skullKeys: 5,
        shards: { falsehood: true, hatred: false, cowardice: false },
        lbArtifacts: { amulet: true, crown: false, sceptre: false },
        specialItems: {
          spyglass: false, hmsCape: false, sextant: true,
          pocketWatch: true, blackBadge: false, woodenBox: true,
        },
      }),
    ).snapshot();
    const quest = snap.inventory.quest;
    const byName = (n: string) => quest.find((q) => q.name === n);
    // CONTABLES con su cuenta y sus NOMBRES VERBATIM (sigilos incluidos).
    expect(byName("*VL")?.qty).toBe(14); //   scroll Vas Lor (glifo pergamino + " + VL")
    expect(byName("*IMC")?.qty).toBe(2); //   scroll In Mani Corp
    expect(byName("!Yellow")?.qty).toBe(3); // potion (glifo poción + " + Yellow")
    expect(byName("Magic Crpt")?.qty).toBe(1);
    expect(byName("Skull Keys")?.qty).toBe(5); // contable de verdad (`dec` CAST 0x18c4)
    // OCULTOS (0xff): los SEIS útiles + regalia + shards + hms cape.
    expect(byName("Sextant")?.qty).toBe(0xff); //    TALK 0x06f0 graba 0xff
    expect(byName("Wooden Box")?.qty).toBe(0xff); // SJOG 0x14f7 graba 0xff
    expect(byName("Pocket Watch")?.qty).toBe(0xff);
    expect(byName("Amulet")?.qty).toBe(0xff);
    expect(byName("Shard/Falsehd")?.qty).toBe(0xff);
    // No poseídos ausentes.
    expect(byName("Crown")).toBeUndefined();
    expect(byName("Spyglass")).toBeUndefined();
    expect(byName("HMS Cape Plan")).toBeUndefined();
    // ORDEN de la tabla extendida: scrolls → potions → carpet → skull keys → … → watch → box.
    const at = (n: string) => quest.findIndex((q) => q.name === n);
    expect(at("*VL")).toBeLessThan(at("!Yellow"));
    expect(at("!Yellow")).toBeLessThan(at("Skull Keys"));
    expect(at("Skull Keys")).toBeLessThan(at("Pocket Watch"));
    expect(at("Pocket Watch")).toBeLessThan(at("Wooden Box"));
  });
});

describe("CoreViewImpl.visField — halo nocturno de moongate (task #55, kernel 0x475a)", () => {
  // El original ESCRIBE el tile de moongate (0xDC) en el mapa de noche
  // (kernel_moongate_render 0x475a, llamado en 0x594e antes del window-build
  // 0x5D0A). 0xDC ∈ EMITTER_TILES → proyecta un disco de luz de radio 10. La luz
  // AMBIENTAL nocturna es 2 fija (advance_clock 0x50CF: no hay término lunar en el
  // radio), IDÉNTICA en overworld y pueblo — por eso town_night ya calcaba y sólo
  // el overworld junto a una moonstone divergía: la party ve el HALO de la puerta,
  // no el radio 2. La puerta va como ENTIDAD (no la ve `map.tileAt`), así que hay
  // que HORNEARLA en el terreno del flood de visibilidad para que el emisor dispare.
  // Evidencia: SAVED.GAM.03 (party 23,128) con moonstone 6 en (23,126) → diamante
  // radio-10 (37 tiles) desplazado 2 al norte (píxel-diff mismo-estado, tanda 2).
  const RAW_PHASES = Array.from({ length: 56 }, () => 0x30); // todas fase 0

  function nightState(moonBuried: boolean): GameState {
    const moonstones = Array.from({ length: 8 }, () => ({
      x: 0,
      y: 0,
      buried: false,
      z: 0,
      location: 0,
    }));
    // Fase activa (0) enterrada 2 casillas al NORTE de la party (100,100).
    moonstones[0] = { x: 100, y: 98, buried: moonBuried, z: 0, location: 0 };
    return makeState({
      time: { year: 139, month: 5, day: 4, hour: 0, minute: 30 },
      position: { location: 0, floor: 0, x: 100, y: 100 },
      moonstones,
    });
  }

  function litCount(state: GameState): number {
    const game = new Game(
      {} as ExtractedInitialState,
      grassWorld(),
      { locationsX: [], locationsY: [], locationNames: [], moonPhases: RAW_PHASES },
      state,
      { combatResources },
    );
    const snap = new CoreViewImpl(game).snapshot();
    let n = 0;
    for (const t of snap.window) if (t !== TILE_HIDDEN) n++;
    return n;
  }

  it("moongate 2 al norte → halo de radio 10 (37 tiles), no el radio 2 ambiental", () => {
    expect(litCount(nightState(true))).toBe(37);
  });

  it("sin moongate enterrada cerca → radio 2 de noche (9 tiles), como el pueblo (town_night)", () => {
    expect(litCount(nightState(false))).toBe(9);
  });
});

describe("CoreViewImpl relleno de borde de small map (task #70)", () => {
  // Small map 32×32 (sin wrap) de suelo de ladrillo (68) con la celda (31,31) =
  // hierba (5), como Britain. El original rellena las celdas del viewport que caen
  // FUERA del mapa con esa celda (31,31) — kernel 0x4402 → puntero fijo 0x6A07 —,
  // no con negro. Ver `ActiveMap.edgeFillTile` (map.ts) y coreview.ts.
  const BRICK = 68;
  const EDGE = 5; // (31,31) = hierba
  function townWorld(): WorldData {
    const tiles = Array.from({ length: 32 }, () =>
      Array.from({ length: 32 }, () => BRICK),
    );
    tiles[31]![31] = EDGE;
    const loc = { id: 2, name: "Britain", floors: [{ z: 0, tiles }] };
    const overworld = Array.from({ length: 256 }, () =>
      Array.from({ length: 256 }, () => 5),
    );
    return { overworld, underworld: overworld, smallMaps: new Map([[2, loc]]) };
  }
  function townGame(x: number, y: number): Game {
    return new Game(
      {} as ExtractedInitialState,
      townWorld(),
      gameData,
      makeState({
        // mediodía → luz plena, sin censura: las celdas off-map se ven (no negras).
        time: { year: 139, month: 4, day: 7, hour: 12, minute: 0 },
        position: { location: 2, floor: 0, x, y },
      }),
      { combatResources },
    );
  }

  it("borde SUR (party y=29, como britain_legit): filas off-map = hierba, no TILE_OFFMAP", () => {
    // party en (15,29): el viewport 11×11 llega a y=24..34; y=32,33,34 = OOB.
    const snap = new CoreViewImpl(townGame(15, 29)).snapshot();
    // Filas del viewport 8,9,10 (ty=32,33,34) están FUERA del mapa 32×32.
    for (const row of [8, 9, 10]) {
      for (let col = 0; col < VIEW_WINDOW; col++) {
        const t = snap.window[row * VIEW_WINDOW + col];
        expect(t).not.toBe(TILE_OFFMAP);
        expect(t).not.toBe(TILE_HIDDEN); // de día están iluminadas (hierba transparente)
        expect(t).toBe(EDGE);
      }
    }
    // Y una fila DENTRO del mapa sigue siendo ladrillo (salvo entidades/party).
    expect(snap.window[0 * VIEW_WINDOW + 0]).toBe(BRICK);
  });

  it("borde ESTE (party x=29): columnas off-map = hierba, no negro", () => {
    const snap = new CoreViewImpl(townGame(29, 15)).snapshot();
    // Columnas 8,9,10 (tx=32,33,34) están fuera del mapa.
    for (const col of [8, 9, 10]) {
      for (let row = 0; row < VIEW_WINDOW; row++) {
        const t = snap.window[row * VIEW_WINDOW + col];
        expect(t).toBe(EDGE);
      }
    }
  });

  it("overworld (wrap toroidal) intacto: NUNCA hay TILE_OFFMAP en la ventana", () => {
    // Cerca del borde nominal del large map: el wrap evita cualquier off-map.
    const snap = new CoreViewImpl(makeGame({
      position: { location: 0, floor: 0, x: 2, y: 1 },
    })).snapshot();
    expect([...snap.window].some((t) => t === TILE_OFFMAP)).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Eco de la DIRECCIÓN en comandos direccionales (getdir kernel 0x35EC) — QA usuario.
// El dispatcher imprime "Open-" (sin \n) y getdir imprime la palabra de dirección
// a continuación en la MISMA fila ("Open-North"), antes del resultado. La piel lo
// modela con `echoAppend` (continúa la fila del eco). El wiring por comando vive en
// main.ts (DIR_ECHO_COMMANDS) y lo ejercita e2e; aquí se fija el mecanismo + strings.
// ─────────────────────────────────────────────────────────────────────────────
describe("CoreViewImpl.echoAppend — eco de dirección (getdir 0x35EC)", () => {
  it("continúa la fila del eco en la MISMA línea ('Open-' + 'North' → 'Open-North')", () => {
    const view = new CoreViewImpl(makeGame());
    view.pushConsole(CMD_STRINGS.open, "echo"); // "Open-"
    view.echoAppend(DIR_WORDS.north); //           + "North"
    const con = view.snapshot().console;
    const last = con[con.length - 1]!;
    expect(last.text).toBe("Open-North");
    expect(last.kind).toBe("echo");
  });

  it("el resultado del comando cae en la fila SIGUIENTE (no se pega al eco)", () => {
    const view = new CoreViewImpl(makeGame());
    view.pushConsole(CMD_STRINGS.jimmy, "echo"); // "Jimmy-"
    view.echoAppend(DIR_WORDS.west); //             + "West"
    view.pushConsole("Unlocked!", "message"); //    resultado, fila nueva
    const con = view.snapshot().console;
    expect(con[con.length - 2]!.text).toBe("Jimmy-West");
    expect(con[con.length - 2]!.kind).toBe("echo");
    expect(con[con.length - 1]!).toEqual({ text: "Unlocked!", kind: "message" });
  });

  it("defensivo: si la última fila NO es un eco, abre una fila de eco nueva", () => {
    const view = new CoreViewImpl(makeGame());
    view.pushConsole("Welcome!", "message");
    view.echoAppend(DIR_WORDS.east);
    const con = view.snapshot().console;
    expect(con[con.length - 1]!).toEqual({ text: "East", kind: "echo" });
  });

  it("DIR_WORDS = las palabras verbatim de getdir (DS 0xa2a6/a2ae/a2bc/a2b6)", () => {
    expect(DIR_WORDS).toEqual({
      north: "North", south: "South", east: "East", west: "West",
    });
  });

  it("flujo completo de un comando direccional: dash + dir en una fila, resultado en la siguiente", () => {
    // Reproduce lo que hace main.ts para un comando de DIR_ECHO_COMMANDS.
    const view = new CoreViewImpl(makeGame());
    view.pushConsole(CMD_STRINGS.attack, "echo"); // "Attack-"
    view.echoAppend(DIR_WORDS.south); //             + "South"
    view.pushConsole("En Garde!", "message");
    const con = view.snapshot().console.slice(-2);
    expect(con.map((l) => l.text)).toEqual(["Attack-South", "En Garde!"]);
  });
});

describe("CoreViewImpl escena de acampada — fase canción de Iolo (glue songPhase → snapshot)", () => {
  // playerStarts["south"] de CampFire (por índice de miembro); fuego en (5,5).
  const SOUTH = [
    { x: 6, y: 6 }, { x: 4, y: 4 }, { x: 6, y: 4 },
    { x: 4, y: 6 }, { x: 5, y: 3 }, { x: 3, y: 5 },
  ];
  function campFireArena(): CombatMapData {
    const tiles = Array.from({ length: 11 }, () => Array.from({ length: 11 }, () => 5));
    tiles[5]![5] = 179; // hoguera
    return {
      index: 0, territory: "britannia", name: "CampFire", tiles,
      playerStarts: { south: SOUTH, north: SOUTH, east: SOUTH, west: SOUTH },
      units: [], triggers: [],
    };
  }
  function campGame(): Game {
    const state = makeState({
      characters: [makeChar({ name: "Avatar", class: "A" }), makeChar({ name: "Iolo", class: "B" })],
      partySize: 2,
    });
    return new Game({} as ExtractedInitialState, grassWorld(), gameData, state, {
      combatResources: {
        combatMaps: [campFireArena()],
        enemyDefs: [], attackValues: [], attackRangeValues: [], defenseValues: [],
      },
    });
  }
  const at = (snap: ReturnType<CoreViewImpl["snapshot"]>, col: number, row: number): number =>
    snap.window[row * VIEW_WINDOW + col]!;

  it("FASE 1 (songPhase): la ventana hornea el tile del laúd (0x15f) en el puesto de Iolo (4,4)", () => {
    const view = new CoreViewImpl(campGame());
    view.setCampScene(true, 1, { col: 4, row: 4 }, true); // Iolo (idx 1) vela, fase canción
    const snap = view.snapshot();
    expect(at(snap, 5, 5)).toBe(179); // hoguera baked de la arena
    // 0x15f, no 0x15c: el asm siembra el byte 0x5F (CMDS.OVL 0x017c `b05f mov al,0x5f`)
    // en los DOS campos de anim; 0x5c es sólo la BASE del grupo. El animador por-actor
    // de la piel lo cicla desde ahí (0x15d·0x15e·0x15f). Ver re/notes/camp-bard-anim.md.
    expect(at(snap, 4, 4)).toBe(0x15f); // Iolo tocando el laúd (south[1])
    expect(at(snap, 6, 6)).toBe(0x11e); // Avatar durmiente (south[0])
  });

  it("FASE 2 (songPhase=false): Iolo vela con su sprite de clase Bard (0x144), no el laúd", () => {
    const view = new CoreViewImpl(campGame());
    view.setCampScene(true, 1, { col: 4, row: 4 }, false); // en su puesto (4,4)
    const snap = view.snapshot();
    expect(at(snap, 4, 4)).toBe(0x144); // Bard1, sprite de clase — no 0x15c
    expect(at(snap, 6, 6)).toBe(0x11e); // el durmiente no cambia entre fases
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// #366 · La escena de camp puebla su capa de MOTION (patrón de #363/bakeShrineScene;
// 4ª instancia de la clase #351 — defecto sólo-shader invisible al e2e). Sin esta capa
// la piel shader caía a su recorte pleno y los durmientes salían con su cuadrado negro
// opaco sobre la arena (captura del carril fix-363: parches negros tras los durmientes).
// ─────────────────────────────────────────────────────────────────────────────
describe("CoreViewImpl escena de acampada — capa de motion (#366, patrón #363)", () => {
  const SOUTH = [
    { x: 6, y: 6 }, { x: 4, y: 4 }, { x: 6, y: 4 },
    { x: 4, y: 6 }, { x: 5, y: 3 }, { x: 3, y: 5 },
  ];
  // Arena con suelo 7 (DISCRIMINANTE: el sobremundo del fixture es todo hierba 5 — si
  // la capa de terreno volviera a leer el mapa, estas celdas dirían 5 y no 7/179).
  function dirtCampArena(): CombatMapData {
    const tiles = Array.from({ length: 11 }, () => Array.from({ length: 11 }, () => 7));
    tiles[5]![5] = 179; // hoguera
    return {
      index: 0, territory: "britannia", name: "CampFire", tiles,
      playerStarts: { south: SOUTH, north: SOUTH, east: SOUTH, west: SOUTH },
      units: [], triggers: [],
    };
  }
  function campGame(): Game {
    const state = makeState({
      characters: [makeChar({ name: "Avatar", class: "A" }), makeChar({ name: "Iolo", class: "B" })],
      partySize: 2,
    });
    return new Game({} as ExtractedInitialState, grassWorld(), gameData, state, {
      combatResources: {
        combatMaps: [dirtCampArena()],
        enemyDefs: [], attackValues: [], attackRangeValues: [], defenseValues: [],
      },
    });
  }
  const cell = (arr: ArrayLike<number>, col: number, row: number): number =>
    arr[row * VIEW_WINDOW + col]!;

  it("🔴 guarda #253 espejo de shrine: terrainWindow SÍ se puebla — y ES LA ARENA, no el sobremundo; suelo EN CRUDO bajo cada durmiente", () => {
    const view = new CoreViewImpl(campGame());
    view.setCampScene(true); // todos duermen (guardIdx -1)
    const snap = view.snapshot();
    const tw = snap.terrainWindow!;
    expect(tw).toBeDefined();
    // La escena, no la hierba 5 del sobremundo: si la capa de mundo del motionScroll
    // volviera a leer el mapa, estas celdas dirían 5 (el sobremundo compuesto ENCIMA
    // sería exactamente la regresión que la guarda de #253 vigila).
    expect(cell(tw, 5, 5)).toBe(179); // hoguera de la arena
    expect(cell(tw, 0, 0)).toBe(7); // suelo de la arena
    // …y bajo cada durmiente lleva el SUELO de la arena EN CRUDO (7), NO el sprite:
    // es lo que el shader enseña a través del fondo transparente del tumbado.
    expect(cell(tw, 6, 6)).toBe(7);
    expect(cell(tw, 4, 4)).toBe(7);
    // La vista fiel, intacta: los durmientes siguen horneados en `window`.
    expect(cell(snap.window, 6, 6)).toBe(0x11e);
    expect(cell(snap.window, 4, 4)).toBe(0x11e);
    // Cada miembro viaja como actor `camp:<charIdx>` (la fiel los filtra en
    // buildActorFrames; el shader los compone con su recorte transparente en (2d)).
    expect(snap.actors).toEqual([
      { id: "camp:0", tile: 0x11e, col: 6, row: 6 },
      { id: "camp:1", tile: 0x11e, col: 4, row: 4 },
    ]);
    // Sin censura de visibilidad: la arena entera visible (como el original).
    expect(snap.visMask).toBeDefined();
    expect(Array.from(snap.visMask!).every((v) => v === 1)).toBe(true);
  });

  it("FASE canción: el bardo viaja como actor `camp-bard` (0x15f, runner propio) con su suelo EN CRUDO debajo", () => {
    const view = new CoreViewImpl(campGame());
    view.setCampScene(true, 1, { col: 4, row: 4 }, true); // Iolo (idx 1) vela, canción
    const snap = view.snapshot();
    expect(cell(snap.terrainWindow!, 4, 4)).toBe(7); // el suelo, no el laúd
    expect(cell(snap.window, 4, 4)).toBe(0x15f); // la fiel, intacta
    expect(snap.actors).toEqual([
      { id: "camp:0", tile: 0x11e, col: 6, row: 6 },
      { id: "camp-bard", tile: 0x15f, col: 4, row: 4 },
    ]);
  });

  it("FASE 2: el vigía viaja como `camp:1` (id ESTABLE entre horas: el shader desliza su paseo) en la celda de ronda", () => {
    const view = new CoreViewImpl(campGame());
    view.setCampScene(true, 1, { col: 6, row: 5 }, false); // de ronda fuera de su puesto
    const snap = view.snapshot();
    expect(cell(snap.terrainWindow!, 6, 5)).toBe(7); // suelo crudo bajo el vigía
    expect(cell(snap.window, 6, 5)).toBe(0x144); // Bard1 horneado en la fiel
    expect(snap.actors).toEqual([
      { id: "camp:0", tile: 0x11e, col: 6, row: 6 },
      { id: "camp:1", tile: 0x144, col: 6, row: 5 },
    ]);
  });
});
