/**
 * SCROLLBACK DE CONSOLA (carril log-scroll) — capa de SHELL/QoL opcional.
 *
 * Cubre las 4 piezas del carril:
 *   1. CoreView: HISTORIAL largo (`snapshot().consoleHistory`, tope 500) al lado
 *      del ring fiel de 12 (`snapshot().console`, INTACTO — la fidelidad no se toca),
 *      con refs COMPARTIDAS (las mutaciones in-place del eco viven en ambos).
 *   2. Helpers puros de console.ts: mapeo `consoleLinesToRows` (bullet/groupStart,
 *      extraído byte-idéntico del render vivo), `maxScrollOffset`, `scrollbackSlice`.
 *   3. Estado del modo (`ConsoleScrollback`) + mapeo de eventos (wheel/drag → líneas).
 *   4. Render: `paintFaithful` con `consoleScroll>0` pinta la ventana deslizante del
 *      historial + rótulo «HISTORY» (banda ►◄ en la barra azul) y SIN ola; con 0 es byte-idéntico
 *      al pintado vivo (las líneas nuevas presentes, las viejas no, sin rótulo).
 */
import { describe, expect, it } from "vitest";
import type { CharacterState, ExtractedInitialState, GameState } from "../src/core/state.js";
import { Game, type CombatResources, type GameData } from "../src/core/game.js";
import type { WorldData } from "../src/core/world/map.js";
import { CoreViewImpl } from "../src/skin/coreview.js";
import { CONSOLE_RECT, paintFaithful } from "../src/skin/fiel/skin.js";
import { FaithfulFont, type GlyphSource } from "../src/skin/fiel/font.js";
import {
  consoleLinesToRows,
  maxScrollOffset,
  scrollbackSlice,
  CONSOLE_BULLET,
} from "../src/skin/fiel/console.js";
import {
  ConsoleScrollback,
  wheelLines,
  dragLines,
} from "../src/skin/fiel/logscroll.js";
import { VIEW_WINDOW, type ConsoleLine, type ViewSnapshot } from "../src/skin/api.js";

// ── Mock mínimo de Game (mismo patrón que skin-coreview.test.ts) ────────────

function makeChar(over: Partial<CharacterState> = {}): CharacterState {
  return {
    name: "Test", gender: 0x0b, class: "A", status: "G",
    strength: 20, dexterity: 20, intelligence: 20,
    currentMp: 10, currentHp: 50, maxHp: 60, exp: 0, level: 2, monthsAtInn: 0,
    helmet: 0xff, armor: 0xff, weapon: 0xff, shield: 0xff, ring: 0xff, amulet: 0xff,
    partyStatus: 0, ...over,
  };
}

function makeState(): GameState {
  return {
    characters: [makeChar({ name: "Avatar" })],
    partySize: 1, activeCharacter: 0, food: 100, gold: 150,
    time: { year: 139, month: 4, day: 7, hour: 12, minute: 0 },
    turnsSinceStart: 0,
    position: { location: 0, floor: 0, x: 100, y: 100 },
    transport: "foot", torchTurns: 0, torches: 2, prevHour: 12,
  } as GameState;
}

function grassWorld(): WorldData {
  const overworld = Array.from({ length: 256 }, () => Array.from({ length: 256 }, () => 5));
  return { overworld, underworld: overworld, smallMaps: new Map() };
}

const gameData: GameData = { locationsX: [], locationsY: [], locationNames: [] };
const combatResources: CombatResources = {
  combatMaps: [], enemyDefs: [], attackValues: [], attackRangeValues: [], defenseValues: [],
};

function makeGame(): Game {
  return new Game({} as ExtractedInitialState, grassWorld(), gameData, makeState(), {
    combatResources,
  });
}

// ── 1. CoreView: historial largo al lado del ring de consola ────────────────

describe("CoreViewImpl historial de consola (log-scroll)", () => {
  it("retiene el historial más allá del ring de 12 SIN tocar el ring de consola", () => {
    const view = new CoreViewImpl(makeGame());
    for (let i = 0; i < 40; i++) view.pushConsole(`line ${i}`);
    const snap = view.snapshot();
    // El «12» es el tope del PORT (`coreview.ts:120 CONSOLE_LINES`, comentario «scrollback corto
    // estilo original»), NO un valor derivado: los rects del descriptor de texto son Clase C
    // (`re/notes/ui-text-layer.md:198-202` — el init 0x1184 deja los 4 a full-screen 40×25 y la
    // altura la fija el runtime por overlay) y nadie la ha medido por píxel-diff. Este aserto
    // sólo comprueba que el historial largo NO desborda el ring del port.
    expect(snap.console.length).toBe(12); // tope del ring del PORT (no aserto de fidelidad)
    expect(snap.console[0]?.text).toBe("line 28");
    expect(snap.consoleHistory?.length).toBe(40); // historial completo
    expect(snap.consoleHistory?.[0]?.text).toBe("line 0");
    expect(snap.consoleHistory?.at(-1)?.text).toBe("line 39");
  });

  it("recorta el historial a 500 líneas (tope del ring largo)", () => {
    const view = new CoreViewImpl(makeGame());
    for (let i = 0; i < 520; i++) view.pushConsole(`line ${i}`);
    const snap = view.snapshot();
    expect(snap.consoleHistory?.length).toBe(500);
    expect(snap.consoleHistory?.[0]?.text).toBe("line 20"); // las 20 más viejas fuera
    expect(snap.consoleHistory?.at(-1)?.text).toBe("line 519");
  });

  it("las mutaciones in-place del eco vivo (echoAppend/echoSetLast) se ven en el historial (refs compartidas)", () => {
    const view = new CoreViewImpl(makeGame());
    view.pushConsole("Yell ", "echo");
    view.echoAppend("F");
    view.echoSetLast("Yell FI");
    const snap = view.snapshot();
    expect(snap.console.at(-1)?.text).toBe("Yell FI");
    expect(snap.consoleHistory?.at(-1)?.text).toBe("Yell FI"); // mismo objeto
    expect(snap.consoleHistory?.at(-1)).toBe(snap.console.at(-1));
  });

  it("messageAppend y echoCursor también alimentan el historial", () => {
    const view = new CoreViewImpl(makeGame());
    view.pushConsole("Player: ");
    view.messageAppend("Elwood");
    view.echoCursor(":");
    const snap = view.snapshot();
    expect(snap.consoleHistory?.map((l) => l.text)).toEqual(["Player: Elwood", ":"]);
    expect(snap.consoleHistory?.at(-1)?.cont).toBe(true); // metadata conservada
  });
});

// ── 2. Helpers puros de console.ts ──────────────────────────────────────────

describe("consoleLinesToRows (mapeo bullet/groupStart, extraído del render vivo)", () => {
  it("un eco NO vacío lleva bullet ► antepuesto y abre grupo", () => {
    const rows = consoleLinesToRows([{ text: "North", kind: "echo" }]);
    expect(rows[0]?.text).toBe(CONSOLE_BULLET + "North");
    expect(rows[0]?.groupStart).toBe(true);
  });

  it("mensajes, ecos vacíos y filas de cursor (cont) NO llevan bullet ni abren grupo", () => {
    const lines: ConsoleLine[] = [
      { text: "Blocked!", kind: "message" },
      { text: "", kind: "echo" },
      { text: ":VERAMOCOR", kind: "echo", cont: true },
    ];
    const rows = consoleLinesToRows(lines);
    for (const [i, r] of rows.entries()) {
      expect(r.text).toBe(lines[i]!.text);
      expect(r.groupStart).toBe(false);
    }
  });

  it("conserva rune y signCells (letreros / profecía)", () => {
    const cells = [{ code: 0x40, rune: true }];
    const rows = consoleLinesToRows([
      { text: "runa", kind: "message", rune: true, signCells: cells },
    ]);
    expect(rows[0]?.rune).toBe(true);
    expect(rows[0]?.signCells).toBe(cells);
  });
});

describe("maxScrollOffset / scrollbackSlice (ventana deslizante)", () => {
  it("maxScrollOffset deja siempre `rows` líneas visibles (0 si cabe entero)", () => {
    expect(maxScrollOffset(30, 12)).toBe(18);
    expect(maxScrollOffset(12, 12)).toBe(0);
    expect(maxScrollOffset(5, 12)).toBe(0);
  });

  it("scrollbackSlice recorta las últimas `offset` líneas, acotado al tope", () => {
    const lines = Array.from({ length: 20 }, (_, i) => `L${i}`);
    expect(scrollbackSlice(lines, 5, 12).at(-1)).toBe("L14");
    expect(scrollbackSlice(lines, 0, 12).length).toBe(20); // offset 0 = todo
    // offset por encima del tope (20-12=8) se acota: quedan 12 líneas
    expect(scrollbackSlice(lines, 99, 12).length).toBe(12);
    expect(scrollbackSlice(lines, 99, 12).at(-1)).toBe("L11");
  });
});

// ── 3. Estado del modo + mapeo de eventos ───────────────────────────────────

describe("ConsoleScrollback (estado del modo historial)", () => {
  it("entra con scrollBy>0, se acota a [0, max], y sale a fondo o con toLive", () => {
    const s = new ConsoleScrollback();
    expect(s.active).toBe(false);
    expect(s.scrollBy(3, 10)).toBe(true);
    expect(s.offset).toBe(3);
    expect(s.active).toBe(true);
    expect(s.scrollBy(99, 10)).toBe(true); // clamp superior
    expect(s.offset).toBe(10);
    expect(s.scrollBy(1, 10)).toBe(false); // sin cambio → el caller no repinta
    expect(s.scrollBy(-10, 10)).toBe(true); // scroll a fondo = vivo
    expect(s.active).toBe(false);
    s.scrollBy(4, 10);
    expect(s.toLive()).toBe(true);
    expect(s.offset).toBe(0);
    expect(s.toLive()).toBe(false); // ya estaba vivo
  });

  it("con maxOffset 0 (historial corto) nunca entra en modo historial", () => {
    const s = new ConsoleScrollback();
    expect(s.scrollBy(5, 0)).toBe(false);
    expect(s.active).toBe(false);
  });
});

describe("wheelLines / dragLines (eventos → líneas)", () => {
  it("rueda hacia ARRIBA (deltaY<0) = retroceder (positivo), proporcional y mín. 1", () => {
    expect(wheelLines(-100)).toBe(3);
    expect(wheelLines(-3)).toBe(1);
    expect(wheelLines(100)).toBe(-3);
    expect(wheelLines(0)).toBe(0);
    expect(wheelLines(-2, 1)).toBe(2); // DOM_DELTA_LINE va 1:1
  });

  it("arrastre hacia ABAJO («tirar del papel») = líneas positivas enteras", () => {
    expect(dragLines(25, 10)).toBe(2);
    expect(dragLines(-25, 10)).toBe(-2);
    expect(dragLines(5, 10)).toBe(0); // sub-línea: el caller acumula el resto
    expect(dragLines(10, 0)).toBe(0); // canvas sin medir: no-op
  });
});

// ── 4. Render: paintFaithful con consoleScroll ──────────────────────────────

const ATLAS = {} as CanvasImageSource;
const BANNER_COLOR = "#ffffff"; // blanco de la banda (patrón vientos, skin.ts)
const BANNER_Y = 10 * 8; // barra AZUL sobre la consola (topRow-1) — feedback usuario 07-24
// Área de consola en px lógicos, DERIVADA de `CONSOLE_RECT` (celdas de 8 px). Estaba
// escrita a mano (24/11/22) y al mover `botRow` de 22 a 23 (ficha #113) el filtro dejó
// FUERA la última fila — justo donde el ancla de abajo pone la línea más NUEVA: los
// asertos «la última línea se pinta» se caían sin que el pintado tuviera nada mal. Un
// recorte del instrumento escrito con las cifras del sujeto caduca cuando el sujeto se
// mueve; derivándolo, no.
const CONSOLE_X0 = CONSOLE_RECT.leftCol * 8;
const CONSOLE_Y0 = CONSOLE_RECT.topRow * 8;
const CONSOLE_Y1 = (CONSOLE_RECT.botRow + 1) * 8;

/** Fuente espía (patrón de fiel-skin.test.ts): registra cada drawGlyph. */
function fontSpy() {
  const calls: { code: number; dx: number; dy: number; color?: string }[] = [];
  const brackets: { x: number; y: number; mirror: boolean }[] = [];
  const font = {
    beginFrame() {},
    recordBracket(x: number, y: number, mirror: boolean) {
      brackets.push({ x, y, mirror });
    },
    record() {},
    drawGlyph(
      _ctx: unknown,
      code: number,
      dx: number,
      dy: number,
      _scale?: number,
      color?: string,
    ) {
      calls.push({ code, dx, dy, color });
    },
  } as unknown as FaithfulFont;
  return { font, calls, brackets };
}

function plainCtx(): CanvasRenderingContext2D {
  return {
    fillStyle: "",
    fillRect() {},
    drawImage() {},
  } as unknown as CanvasRenderingContext2D;
}

/** Glifos pintados DENTRO del área de consola. */
function consoleGlyphs(calls: { code: number; dx: number; dy: number; color?: string }[]) {
  return calls.filter(
    (c) => c.dx >= CONSOLE_X0 && c.dy >= CONSOLE_Y0 && c.dy < CONSOLE_Y1,
  );
}

/** Snapshot con 20 líneas de historial 'A'..'T' (las últimas 12 en el ring). */
function scrollSnapshot(): ViewSnapshot {
  const history: ConsoleLine[] = Array.from({ length: 20 }, (_, i) => ({
    text: String.fromCharCode(0x41 + i), // A..T
    kind: "message" as const,
  }));
  return {
    mode: "world",
    window: new Int16Array(VIEW_WINDOW * VIEW_WINDOW).fill(5),
    center: { x: 50, y: 50 },
    console: history.slice(-12), // ring del PORT (12 líneas): I..T — ver nota abajo
    consoleHistory: history,
    awaitingInput: false,
    awaitingCommand: false,
    awaitingDirection: false,
    awaitingGetstring: false,
    party: [{ name: "Avatar", hp: 10, maxHp: 20, status: "G" }],
    activeCharacter: 0,
    combatActiveCharIdx: null,
    clock: { year: 139, month: 3, day: 5, hour: 12, minute: 30 },
    food: 19,
    gold: 8803,
    locationName: "Britannia",
    dungeon: null,
    combatView: null,
    campScene: null,
    refugeScene: null,
    gemView: null,
    sky: null,
    wind: null,
    ztats: [],
    inventory: {
      provisions: { food: 19, gold: 8803, keys: 0, gems: 0, torches: 0, grapple: false },
      members: [], reagents: [], items: [], quest: [], equipment: [],
    },
  } as unknown as ViewSnapshot;
}

describe("paintFaithful — modo scrollback (consoleScroll)", () => {
  it("registra los remates ►◄ de la banda HISTORY en el sumidero (recomposición shader — línea blanca 07-25)", () => {
    const spy = fontSpy();
    paintFaithful(plainCtx(), spy.font, ATLAS, scrollSnapshot(), { consoleScroll: 8 });
    const enBanda = spy.brackets.filter((b) => b.y === BANNER_Y);
    expect(enBanda.length).toBe(2);
    expect(enBanda[0]?.mirror).toBe(false); // ► apertura
    expect(enBanda[1]?.mirror).toBe(true); // ◄ cierre
    expect(enBanda[1]!.x).toBeGreaterThan(enBanda[0]!.x + 8);
  });

  it("con offset 0 pinta el ring vivo: la línea más nueva ('T') sí, la más vieja ('A') no, sin rótulo", () => {
    const spy = fontSpy();
    paintFaithful(plainCtx(), spy.font, ATLAS, scrollSnapshot());
    const glyphs = consoleGlyphs(spy.calls);
    expect(glyphs.some((c) => c.code === 0x54)).toBe(true); // 'T' (última)
    expect(glyphs.some((c) => c.code === 0x41)).toBe(false); // 'A' fuera del ring
    expect(glyphs.some((c) => c.color === BANNER_COLOR)).toBe(false); // sin rótulo
  });

  it("con offset al tope muestra el PRINCIPIO del historial ('A'), oculta el presente ('T') y pinta «HISTORY» pelado", () => {
    const spy = fontSpy();
    // 20 líneas sueltas (mensajes, sin separadores) → maxScrollOffset(20,12) = 8.
    paintFaithful(plainCtx(), spy.font, ATLAS, scrollSnapshot(), { consoleScroll: 8 });
    const glyphs = consoleGlyphs(spy.calls);
    // El texto del LOG va sin tinte; los glifos blancos-tintados son del rótulo
    // («HISTORY» contiene una 'T' propia — se excluye del careo de contenido).
    const logGlyphs = glyphs.filter((c) => c.color !== BANNER_COLOR);
    expect(logGlyphs.some((c) => c.code === 0x41)).toBe(true); // 'A' (histórica) visible
    expect(logGlyphs.some((c) => c.code === 0x54)).toBe(false); // 'T' (presente) fuera
    // Rótulo «HISTORY» PELADO (feedback usuario: sin el contador «-N»): banda en la
    // barra AZUL (topRow-1), blanca, patrón vientos — fuera del área de texto
    // (spy.calls directo, no consoleGlyphs que acota al área).
    const banner = spy.calls.filter((c) => c.color === BANNER_COLOR && c.dy === BANNER_Y);
    expect(banner.length).toBe("HISTORY".length);
    const bannerText = banner
      .sort((a, b) => a.dx - b.dx)
      .map((c) => String.fromCharCode(c.code))
      .join("");
    expect(bannerText).toBe("HISTORY"); // ni dígitos ni «-»
    // Y NINGÚN glifo del rótulo pisa el área de texto de la consola:
    expect(glyphs.filter((c) => c.color === BANNER_COLOR).length).toBe(0);
  });

  it("el offset se acota al historial (99 pinta lo mismo que el tope 8)", () => {
    const at8 = fontSpy();
    paintFaithful(plainCtx(), at8.font, ATLAS, scrollSnapshot(), { consoleScroll: 8 });
    const at99 = fontSpy();
    paintFaithful(plainCtx(), at99.font, ATLAS, scrollSnapshot(), { consoleScroll: 99 });
    // Mismas celdas de texto (código+posición) en ambos — el clamp iguala la
    // ventana (el rótulo, ya sin contador, es idéntico por construcción).
    const sig = (calls: { code: number; dx: number; dy: number }[]) =>
      consoleGlyphs(calls).map((c) => `${c.code}@${c.dx},${c.dy}`);
    expect(sig(at99.calls)).toEqual(sig(at8.calls));
  });

  it("sin consoleHistory en el snapshot (mocks viejos) el offset se ignora: pintado vivo", () => {
    const snap = { ...scrollSnapshot(), consoleHistory: undefined } as ViewSnapshot;
    const spy = fontSpy();
    paintFaithful(plainCtx(), spy.font, ATLAS, snap, { consoleScroll: 8 });
    const glyphs = consoleGlyphs(spy.calls);
    expect(glyphs.some((c) => c.code === 0x54)).toBe(true); // 'T' viva
    expect(glyphs.some((c) => c.color === BANNER_COLOR)).toBe(false);
  });
});
