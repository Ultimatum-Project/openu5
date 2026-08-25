/**
 * PIEL FIEL (E1-S8b) — pintado puro `paintFaithful`: chrome + viewport 11×11 +
 * roster + consola + status. Sin navegador: contexto espía que separa blits de
 * TILE (16 px) de blits de GLIFO (8 px) y cuenta los rects del marco.
 */
import { describe, expect, it } from "vitest";
import {
  paintFaithful,
  paintViewportTiles,
  BULLET_BLUE,
  BULLET_WHITE,
  BAND_BRACKET_BLUE,
  BAND_BRACKET_WHITE,
} from "../src/skin/fiel/skin.js";
import { FaithfulFont, type GlyphSource } from "../src/skin/fiel/font.js";
import { FRAME_FILLS, FRAME_GLYPHS, FRAME_SEGMENTS } from "../src/skin/fiel/frame.js";
import { signBoxConsoleRows } from "../src/skin/fiel/sign-box.js";
import {
  TILE_HIDDEN,
  VIEW_WINDOW,
  type ViewSnapshot,
} from "../src/skin/api.js";

/** Nº de bits a 1 en un bitmap de 8 filas (= fillRects 1×1 que pinta drawBullet). */
function popcount(rows: readonly number[]): number {
  return rows.reduce((n, b) => n + (b.toString(2).match(/1/g)?.length ?? 0), 0);
}

function spyCtx() {
  const state = { fillStyle: "" };
  let fillRects = 0;
  let tiles = 0;
  let glyphs = 0;
  const ctx = {
    get fillStyle() {
      return state.fillStyle;
    },
    set fillStyle(v: string) {
      state.fillStyle = v;
    },
    fillRect() {
      fillRects++;
    },
    drawImage(_img: unknown, _sx: number, _sy: number, sw: number) {
      if (sw === 16) tiles++;
      else if (sw === 8) glyphs++;
    },
  } as unknown as CanvasRenderingContext2D;
  return {
    ctx,
    counts: () => ({ fillRects, tiles, glyphs }),
  };
}

function snapshot(overrides: Partial<ViewSnapshot> = {}): ViewSnapshot {
  return {
    mode: "world",
    window: new Int16Array(VIEW_WINDOW * VIEW_WINDOW).fill(5),
    center: { x: 50, y: 50 },
    console: [{ text: "Hail!", kind: "message" }],
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
    shrineScene: null, // #277
    gemView: null,
    sky: { felucca: 3, trammel: 5 },
    wind: "East",
    ztats: [],
    inventory: EMPTY_INVENTORY,
    ...overrides,
  };
}

const EMPTY_INVENTORY = {
  provisions: {
    food: 19,
    gold: 8803,
    keys: 0,
    gems: 0,
    torches: 0,
    grapple: false,
  },
  members: [],
  reagents: [],
  items: [],
  quest: [],
  equipment: [],
};

const FONT = new FaithfulFont({} as GlyphSource);
const ATLAS = {} as CanvasImageSource;

/** Fuente espía: registra cada `drawGlyph(code,dx,dy,…,color)` para inspeccionarlo,
 *  y cada `record(...)` (celdas enumeradas SIN dibujar: bullet ►, celdas rúnicas). */
function fontSpy() {
  const calls: { code: number; dx: number; dy: number; color?: string }[] = [];
  const records: { code: number; x: number; y: number; rune?: boolean }[] = [];
  const font = {
    beginFrame() {},
    recordBracket() {},
    record(code: number, x: number, y: number, _scale?: number, _color?: string, rune?: boolean) {
      records.push({ code, x, y, rune });
    },
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
  return { font, calls, records };
}

/** Contexto espía que registra cada `fillRect` con su color y geometría. */
function rectSpy() {
  let fill = "";
  const rects: { color: string; x: number; y: number; w: number; h: number }[] = [];
  const ctx = {
    get fillStyle() {
      return fill;
    },
    set fillStyle(v: string) {
      fill = v;
    },
    fillRect(x: number, y: number, w: number, h: number) {
      rects.push({ color: fill, x, y, w, h });
    },
    drawImage() {},
  } as unknown as CanvasRenderingContext2D;
  return { ctx, rects };
}

describe("paintViewportTiles (extraído — capa de mundo del motion)", () => {
  /** Spy que captura el destino (dx,dy) de cada blit de TILE (sw===16). */
  function tileSpy() {
    const tiles: { dx: number; dy: number }[] = [];
    const ctx = {
      drawImage(
        _img: unknown,
        _sx: number,
        _sy: number,
        sw: number,
        _sh: number,
        dx: number,
        dy: number,
      ) {
        if (sw === 16) tiles.push({ dx, dy });
      },
    } as unknown as CanvasRenderingContext2D;
    return { ctx, tiles };
  }

  const NONE = undefined;

  it("blitea un tile por cada celda no-negativa, en el origen dado", () => {
    const win = new Int16Array(VIEW_WINDOW * VIEW_WINDOW).fill(5);
    const spy = tileSpy();
    // Origen (0,0) = el offscreen 176×176 de la piel shader (terreno solo).
    paintViewportTiles(spy.ctx, win, 0, 0, ATLAS, 0, [], NONE, NONE, NONE, NONE, NONE, NONE, NONE, 16);
    expect(spy.tiles.length).toBe(VIEW_WINDOW * VIEW_WINDOW);
    expect(spy.tiles[0]).toEqual({ dx: 0, dy: 0 }); // primera celda en el origen
    expect(spy.tiles[VIEW_WINDOW]).toEqual({ dx: 0, dy: 16 }); // 2ª fila, +1 tile abajo
  });

  it("salta las celdas negativas (negro: OFFMAP/HIDDEN) — no las blitea", () => {
    const win = new Int16Array(VIEW_WINDOW * VIEW_WINDOW).fill(5);
    win[0] = -1; // TILE_OFFMAP
    win[1] = -2; // TILE_HIDDEN
    const spy = tileSpy();
    paintViewportTiles(spy.ctx, win, 8, 8, ATLAS, 0, [], NONE, NONE, NONE, NONE, NONE, NONE, NONE, 16);
    expect(spy.tiles.length).toBe(VIEW_WINDOW * VIEW_WINDOW - 2);
    // Con origen (8,8) la primera celda pintada (idx 2) cae en (8 + 2·16, 8).
    expect(spy.tiles[0]).toEqual({ dx: 8 + 2 * 16, dy: 8 });
  });
});

describe("paintFaithful", () => {
  it("pinta el chrome completo (1 clear + barras + segmentos)", () => {
    const spy = spyCtx();
    // sky:null aísla el conteo del chrome (con sky se añade la franja negra + los ►◄
    // del cielo); wind:null evita los píxeles fillRect de los brackets de vientos.
    paintFaithful(spy.ctx, FONT, ATLAS, snapshot({ sky: null, wind: null }));
    // +FRAME_GLYPHS.length: cada glifo de esquina limpia su celda a negro antes de
    // blitearse (OPACO, redondea la esquina azul del marco — #74, put_glyph del binario).
    expect(spy.counts().fillRects).toBe(
      1 + FRAME_FILLS.length + FRAME_GLYPHS.length + FRAME_SEGMENTS.length,
    );
  });

  it("con banda celeste añade la franja negra + los 2 remates ►◄ del cielo (F-B)", () => {
    const spy = spyCtx();
    paintFaithful(
      spy.ctx,
      FONT,
      ATLAS,
      snapshot({ sky: { felucca: 2, trammel: 5 }, wind: null }),
    );
    // Respecto al chrome solo: +1 fillRect (la franja negra) + los 2 remates ►◄
    // (drawBandBracket, draw_box_edge 0x4c2a/0x4cce). Cada remate = 1 fillRect del
    // notch negro + los píxeles azul/blanco del glifo 0x02 (popcount de
    // BAND_BRACKET_BLUE ∪ BAND_BRACKET_WHITE, disjuntos). wind:null aísla los ►◄ de
    // vientos. (El bullet de eco `BULLET_*` es OTRO glifo — consola, no banda.)
    const bracketRects = 1 + popcount(BAND_BRACKET_BLUE) + popcount(BAND_BRACKET_WHITE);
    expect(spy.counts().fillRects).toBe(
      1 + FRAME_FILLS.length + FRAME_GLYPHS.length + FRAME_SEGMENTS.length + 1 + 2 * bracketRects,
    );
  });

  it("blitea las 121 casillas del viewport cuando todas son visibles", () => {
    const spy = spyCtx();
    paintFaithful(spy.ctx, FONT, ATLAS, snapshot());
    expect(spy.counts().tiles).toBe(VIEW_WINDOW * VIEW_WINDOW);
  });

  it("en COMBATE pinta la fila del activo en VÍDEO INVERSO (barra blanca, §1)", () => {
    // La fila del PJ cuyo turno de combate es lleva una barra blanca de fondo (una
    // franja de 8 px de alto). Fuera de combate (combatActiveCharIdx null) NO existe.
    const whiteRows = (rects: { color: string; h: number }[]): number =>
      rects.filter((r) => r.color === "#ffffff" && r.h === 8).length;
    const off = rectSpy();
    paintFaithful(off.ctx, FONT, ATLAS, snapshot({ combatActiveCharIdx: null }));
    const on = rectSpy();
    paintFaithful(on.ctx, FONT, ATLAS, snapshot({ combatActiveCharIdx: 0 }));
    // Exactamente UNA barra blanca de fila más que sin combate.
    expect(whiteRows(on.rects) - whiteRows(off.rects)).toBe(1);
  });

  it("omite las casillas censuradas/fuera de mapa (negativas → negro)", () => {
    const window = new Int16Array(VIEW_WINDOW * VIEW_WINDOW).fill(5);
    window[0] = TILE_HIDDEN; // una casilla oculta
    window[1] = -1; // una fuera de mapa
    const spy = spyCtx();
    paintFaithful(spy.ctx, FONT, ATLAS, snapshot({ window }));
    expect(spy.counts().tiles).toBe(VIEW_WINDOW * VIEW_WINDOW - 2);
  });

  it("moongate overlay (seam B): repinta terreno + puerta parcial según la etapa", () => {
    const gates = [{ col: 2, row: 3, under: 5 }];
    // Etapa llena (16): 121 tiles de ventana + terreno repintado + puerta llena.
    const full = spyCtx();
    paintFaithful(full.ctx, FONT, ATLAS, snapshot({ moongates: gates }), { moongateStage: 16 });
    expect(full.counts().tiles).toBe(VIEW_WINDOW * VIEW_WINDOW + 2);
    // Etapa 0 (hundida): sólo el repintado de terreno; la puerta parcial (h=0) se omite.
    const sunk = spyCtx();
    paintFaithful(sunk.ctx, FONT, ATLAS, snapshot({ moongates: gates }), { moongateStage: 0 });
    expect(sunk.counts().tiles).toBe(VIEW_WINDOW * VIEW_WINDOW + 1);
    // Sin overlay (undefined) → sólo la ventana (compat hacia atrás).
    const none = spyCtx();
    paintFaithful(none.ctx, FONT, ATLAS, snapshot());
    expect(none.counts().tiles).toBe(VIEW_WINDOW * VIEW_WINDOW);
  });

  it("pinta glifos IBM.CH (esquinas del marco + roster + consola + status)", () => {
    const spy = spyCtx();
    paintFaithful(spy.ctx, FONT, ATLAS, snapshot());
    // Al menos las 3 runas de esquina + algo de texto.
    expect(spy.counts().glyphs).toBeGreaterThan(3);
  });

  it("F-G bullet compuesto: BLUE|WHITE == ► de celda completa, disjuntos (calibrado nativo)", () => {
    // Triángulo subyacente calibrado a la captura nativa (ztats-refs/07-log-status):
    // un ► que llena la celda (col 6-7), más lleno que el glifo 0x02 (col 5).
    const FULL_TRIANGLE = [0x80, 0xf0, 0xfe, 0xff, 0xff, 0xfe, 0xf0, 0x80];
    for (let r = 0; r < 8; r++) {
      // relleno + outline reconstruyen el triángulo…
      expect(BULLET_BLUE[r]! | BULLET_WHITE[r]!).toBe(FULL_TRIANGLE[r]);
      // …y no se solapan (cada píxel es azul O blanco, nunca ambos).
      expect(BULLET_BLUE[r]! & BULLET_WHITE[r]!).toBe(0);
    }
    // la base izquierda (col0) es AZUL en las filas centrales (no lleva outline).
    expect((BULLET_BLUE[3]! >> 7) & 1).toBe(1);
    // el outline blanco existe en los bordes de ataque.
    expect(BULLET_WHITE.some((b) => b !== 0)).toBe(true);
  });

  it("F-G bullet: el ECO compone ► AZUL + OUTLINE BLANCO (fillRect 2-color)", () => {
    const spy = rectSpy();
    // wind:null aísla el bullet (evita el ► blanco de los vientos); awaitingInput
    // false → sin línea de prompt: el único bullet es el del eco en la fila 0.
    paintFaithful(
      spy.ctx,
      FONT,
      ATLAS,
      snapshot({
        console: [{ text: "North", kind: "echo" }],
        awaitingInput: false,
        wind: null,
      }),
    );
    // Un solo eco, sin prompt: con el ancla de abajo (#113) es la ÚLTIMA fila de la
    // consola, la 23 → celda (col24,row23) = px (192,184). Pinta píxeles 1×1.
    const inCell = (r: { x: number; y: number; w: number; h: number }) =>
      r.w === 1 && r.h === 1 && r.x >= 192 && r.x < 200 && r.y >= 184 && r.y < 192;
    const blue = spy.rects.filter((r) => inCell(r) && r.color === "#0000aa");
    const white = spy.rects.filter((r) => inCell(r) && r.color === "#ffffff");
    expect(blue.length).toBeGreaterThan(0); // relleno azul
    expect(white.length).toBeGreaterThan(0); // outline blanco
  });

  it("F-G bullet: los MENSAJES del juego NO llevan ► (sin píxeles 1×1 de bullet)", () => {
    const spy = rectSpy();
    paintFaithful(
      spy.ctx,
      FONT,
      ATLAS,
      snapshot({
        console: [{ text: "Blocked!", kind: "message" }],
        awaitingInput: false,
        wind: null,
        sky: null, // aísla el bullet de consola de los remates ►◄ del cielo (F-B)
      }),
    );
    // drawBullet es la única fuente de fillRect 1×1; un mensaje no lo invoca.
    const bulletPx = spy.rects.filter(
      (r) => r.w === 1 && r.h === 1 && (r.color === "#0000aa" || r.color === "#ffffff"),
    );
    expect(bulletPx.length).toBe(0);
  });

  it("F-G ronda2: awaitingInput añade una LÍNEA de prompt nueva (► + ola) bajo el eco", () => {
    // Tres filas de contenido (eco / separador en blanco #61 / prompt) ancladas al
    // fondo (#113): el eco cae en la 21, el prompt —con su ola— en la 23. Lo que el
    // aserto fija de verdad es la DISTANCIA: la ola dos filas bajo el eco.
    const spy = fontSpy();
    paintFaithful(
      spyCtx().ctx,
      spy.font,
      ATLAS,
      snapshot({ console: [{ text: "North", kind: "echo" }], awaitingInput: true }),
    );
    const wave = [0x05, 0x06, 0x07, 0x08];
    const waveCall = spy.calls.find((c) => wave.includes(c.code));
    const textCall = spy.calls.find((c) => c.code === 0x4e); // la 'N' de North
    expect(waveCall).toBeTruthy();
    expect(textCall).toBeTruthy();
    // La 'N' del eco está en la fila 21 (y=168); la ola en la de prompt, la 23 (y=184)
    // = la última de la ventana, dos por debajo (fila 22 = separador en blanco, #61).
    expect(textCall!.dy).toBe(21 * 8);
    expect(waveCall!.dy).toBe(23 * 8); // dos filas por debajo (eco + blanco)
    expect(waveCall!.dy - textCall!.dy).toBe(2 * 8); // …y ésa es la relación invariante
    // …y la ola va tras el ► del prompt (col 24 = bullet, col 25 = ola).
    expect(waveCall!.dx).toBe((24 + 1) * 8);
  });

  it("F-G cursor: esperando DIRECCIÓN, la ola cae JUNTO al eco (no en fila de prompt aparte)", () => {
    // Item 7a: mientras un comando direccional espera la flecha ("Look-ζ"), el cursor
    // de la ola va en la MISMA fila que el eco, justo tras el texto — NO en una línea
    // de prompt nueva dos filas por debajo (que es lo que hace awaitingInput solo).
    const wave = [0x05, 0x06, 0x07, 0x08];
    const spy = fontSpy();
    paintFaithful(
      spyCtx().ctx,
      spy.font,
      ATLAS,
      snapshot({
        console: [{ text: "Look", kind: "echo" }],
        awaitingInput: true,
        awaitingDirection: true,
      }),
    );
    const waveCall = spy.calls.find((c) => wave.includes(c.code));
    const textCall = spy.calls.find((c) => c.code === 0x4c); // la 'L' de Look
    expect(waveCall).toBeTruthy();
    expect(textCall).toBeTruthy();
    // Misma fila que el eco (discriminante: sin el fix caería dos filas abajo).
    expect(waveCall!.dy).toBe(textCall!.dy);
    // …y justo tras "Look" (4 letras después de la 'L').
    expect(waveCall!.dx).toBe(textCall!.dx + 4 * 8);
  });

  it("F-G cursor: la ola (0x05-0x08) cicla con la fase y sólo con awaitingInput", () => {
    const wave = [0x05, 0x06, 0x07, 0x08];
    // Sin awaitingInput no se pinta ningún glifo de la ola.
    const off = fontSpy();
    paintFaithful(spyCtx().ctx, off.font, ATLAS, snapshot({ awaitingInput: false }));
    expect(off.calls.some((c) => wave.includes(c.code))).toBe(false);
    // Con awaitingInput, cada fase pinta el frame correspondiente del ciclo.
    for (let phase = 0; phase < 8; phase++) {
      const spy = fontSpy();
      paintFaithful(
        spyCtx().ctx,
        spy.font,
        ATLAS,
        snapshot({ awaitingInput: true }),
        { phase },
      );
      const drawn = spy.calls.map((c) => c.code);
      expect(drawn).toContain(wave[phase % 4]);
    }
  });

  it("F-G cursor: la ola SÍ se pinta durante Ztats (tras 'Status:', ztats-refs/07)", () => {
    const spy = fontSpy();
    const member = {
      name: "Avatar",
      charClass: "A",
      status: "G",
      gender: "M",
      str: 20,
      dex: 18,
      int: 15,
      hp: 50,
      maxHp: 60,
      mp: 10,
      exp: 999,
      level: 3,
    };
    // Ronda 2: el comando Z deja la consola esperando con "Status:" como última
    // fila y el original mantiene la ola ahí toda la pantalla de ztats (ref 07),
    // aunque awaitingInput sea false (el modal lo gestiona la piel).
    paintFaithful(
      spyCtx().ctx,
      spy.font,
      ATLAS,
      snapshot({ awaitingInput: false, ztats: [member] }),
      { ztats: { mode: "page", page: 0, scroll: 0, cursor: 0 } },
    );
    const wave = [0x05, 0x06, 0x07, 0x08];
    expect(spy.calls.some((c) => wave.includes(c.code))).toBe(true);
  });

  it("F-C vientos: los remates ►◄ se COMPONEN azul+outline (drawBandBracket), y el ◄ es el espejo", () => {
    const spy = rectSpy();
    paintFaithful(
      spy.ctx,
      FONT,
      ATLAS,
      snapshot({
        wind: "East",
        console: [{ text: "Hail!", kind: "message" }],
        awaitingInput: false,
      }),
    );
    // wind "East" → campo dir de 5 "East " + " Winds" = "East  Winds" (11, DOBLE
    // espacio; ULTIMA.EXE 0x2ed9, DATA.OVL 0x557e/0x558a). Origen FIJO en col6 (no
    // centrado; 0x2ecb `mov ax,6`): ► en col6 (celda x=48..55), texto col7..17, ◄ en
    // col18 (celda x=144..151); fila 23 (y=184). drawBandBracket = glifo 0x02 (azul) +
    // filo blanco, pintados 1×1; la COL BASE del triángulo (x=48 para ►, x=151 para ◄)
    // NO se pinta: la ocupa el borde del marco.
    const row = 23 * 8;
    const px = spy.rects.filter((r) => r.w === 1 && r.h === 1 && r.y >= row && r.y < row + 8);
    const open = px.filter((r) => r.x >= 48 && r.x < 56); // celda del ►
    const close = px.filter((r) => r.x >= 144 && r.x < 152); // celda del ◄
    // ambos remates llevan relleno azul + outline blanco (composición 2-color).
    expect(open.some((r) => r.color === "#0000aa")).toBe(true);
    expect(open.some((r) => r.color === "#ffffff")).toBe(true);
    expect(close.some((r) => r.color === "#0000aa")).toBe(true);
    expect(close.some((r) => r.color === "#ffffff")).toBe(true);
    // el ◄ es el ESPEJO del ►: el azul del ► crece hacia la DERECHA (punta) desde su
    // base izquierda (x=49 la 1ª col pintada) y el del ◄ hacia la IZQUIERDA (base a la
    // derecha, x=150 la 1ª col pintada). La col base del marco (x=48/x=151) va sin pintar.
    expect(open.some((r) => r.x === 49 && r.color === "#0000aa")).toBe(true);
    expect(open.every((r) => r.x !== 48)).toBe(true); // base = borde del marco (no repintada)
    expect(close.some((r) => r.x === 150 && r.color === "#0000aa")).toBe(true);
    expect(close.every((r) => r.x !== 151)).toBe(true);
  });

  it("F-C vientos: compone `<campo dir 5> Winds` — East/West/Calm DOBLE espacio, North/South uno", () => {
    // El binario imprime el nombre de dirección (campo FIJO de 5 bytes de DATA.OVL:
    // "East ","West ","Calm " con relleno; "North","South" ya son 5) SEGUIDO de " Winds"
    // (0x558a, espacio inicial propio) — ULTIMA.EXE 0x2ed9. → los de 4 letras dan doble
    // espacio. Reconstruimos el texto de la fila 23 desde los glifos de la fuente espía.
    const readBand = (wind: string): string => {
      const sp = fontSpy();
      paintFaithful(rectSpy().ctx, sp.font, ATLAS, snapshot({ wind, awaitingInput: false }));
      // Sólo las celdas del texto interior (col 7..17 → dx 56..143); fuera van el
      // chrome del marco y otros glifos que también caen en la fila 23.
      return sp.calls
        .filter((c) => c.dy === 23 * 8 && c.dx >= 56 && c.dx < 144)
        .sort((a, b) => a.dx - b.dx)
        .map((c) => String.fromCharCode(c.code))
        .join("");
    };
    expect(readBand("East")).toBe("East  Winds"); // 2 espacios
    expect(readBand("West")).toBe("West  Winds"); // 2 espacios
    expect(readBand("Calm")).toBe("Calm  Winds"); // 2 espacios
    expect(readBand("North")).toBe("North Winds"); // 1 espacio
    expect(readBand("South")).toBe("South Winds"); // 1 espacio
    // ancho constante de 11 celdas para toda dirección (origen fijo → banda estable).
    expect(readBand("East")).toHaveLength(11);
    expect(readBand("North")).toHaveLength(11);
  });

  it("con ztatsMember pinta la página de stats en el panel (E1-S11)", () => {
    const member = {
      name: "Avatar",
      charClass: "A",
      status: "G",
      gender: "M",
      str: 20,
      dex: 18,
      int: 15,
      hp: 50,
      maxHp: 60,
      mp: 10,
      exp: 999,
      level: 3,
    };
    const withStats = snapshot({ ztats: [member] });
    const closed = spyCtx();
    const open = spyCtx();
    paintFaithful(closed.ctx, FONT, ATLAS, withStats); // roster
    paintFaithful(open.ctx, FONT, ATLAS, withStats, {
      ztats: { mode: "page", page: 0, scroll: 0, cursor: 0 },
    }); // página Z
    // La ficha de stats tiene más texto que el roster de 1 miembro → más glifos.
    expect(open.counts().glyphs).toBeGreaterThan(closed.counts().glyphs);
  });

  it("al abrir Ztats resetea el panel a negro (putchar(0xff), ztats-layout §1)", () => {
    // Contexto que graba cada fillRect con el color vigente. El reset del panel
    // (cols 24..38, filas 1..9 → px 192,8,120,72) borra el chrome de las
    // sub-cajas roster/food-gold para que la página del eje no se parta sobre la
    // barra divisoria. Debe existir SÓLO con Ztats abierto y ser NEGRO.
    const rects: { x: number; y: number; w: number; h: number; color: string }[] = [];
    const s = { fillStyle: "" };
    const ctx = {
      get fillStyle() {
        return s.fillStyle;
      },
      set fillStyle(v: string) {
        s.fillStyle = v;
      },
      fillRect(x: number, y: number, w: number, h: number) {
        rects.push({ x, y, w, h, color: s.fillStyle });
      },
      drawImage() {},
    } as unknown as CanvasRenderingContext2D;
    const member = {
      name: "Avatar",
      charClass: "A",
      status: "G",
      gender: "M",
      str: 20,
      dex: 18,
      int: 15,
      hp: 50,
      maxHp: 60,
      mp: 10,
      exp: 999,
      level: 3,
    };
    const withStats = snapshot({ ztats: [member], sky: null });
    const panelReset = (r: (typeof rects)[number]) =>
      r.x === 192 && r.y === 8 && r.w === 120 && r.h === 72;

    rects.length = 0;
    paintFaithful(ctx, FONT, ATLAS, withStats); // roster: sin reset
    expect(rects.some(panelReset)).toBe(false);

    rects.length = 0;
    paintFaithful(ctx, FONT, ATLAS, withStats, {
      ztats: { mode: "page", page: 0, scroll: 0, cursor: 0 },
    }); // Ztats
    const reset = rects.find(panelReset);
    expect(reset).toBeDefined();
    expect(reset!.color).toBe("#000000");
  });
});

describe("caja de letreros (L)ook — EN EL FLUJO DE LA CONSOLA (no overlay)", () => {
  const BOX = { TL: 0x38, TR: 0x39, BL: 0x3a, BR: 0x3b, H: 0x6c, HTOP: 0x6d, HBOT: 0x6e, V: 0x67 };
  // El panel de consola arranca en col 24, fila 11 (CONSOLE_RECT 24..39). La caja se
  // pinta como filas de ESE panel (no en el viewport 8..184).
  const CONSOLE_X0 = 24 * 8;
  const CONSOLE_Y0 = 11 * 8;

  /** Consola con un cartel ya impreso en el flujo (marco + cuerpo rúnico como signCells). */
  function consoleWithSign(lines: string[]) {
    return signBoxConsoleRows(lines, 16).map((r) => ({
      text: r.text,
      kind: "message" as const,
      signCells: r.cells,
    }));
  }

  /** Renderiza con fuentes IBM/RUNES separadas para distinguir marco+cuerpo (rúnico) de IBM. */
  function renderWithSign(lines: string[]) {
    const ibm = fontSpy();
    const runes = fontSpy();
    paintFaithful(
      spyCtx().ctx,
      ibm.font,
      ATLAS,
      snapshot({ console: consoleWithSign(lines) }),
      { runes: runes.font }, // ← RUNES.CH
    );
    return { ibm: ibm.calls, runes: runes.calls, ibmRecords: ibm.records };
  }

  it("dibuja las CUATRO esquinas del marco con la fuente RÚNICA", () => {
    const { runes } = renderWithSign(["NORTH BRITAIN"]);
    const codes = runes.map((c) => c.code);
    for (const corner of [BOX.TL, BOX.TR, BOX.BL, BOX.BR]) {
      expect(codes).toContain(corner);
    }
  });

  it("dibuja aristas horizontales y verticales rúnicas (incluidas las púas decorativas)", () => {
    const { runes } = renderWithSign(["NORTH BRITAIN"]);
    const codes = runes.map((c) => c.code);
    expect(codes.filter((c) => c === BOX.H).length).toBeGreaterThan(0);
    expect(codes.filter((c) => c === BOX.V).length).toBe(2); // dos lados en la única fila de cuerpo
    expect(codes).toContain(BOX.HTOP);
    expect(codes).toContain(BOX.HBOT);
  });

  it("el CUERPO va RÚNICO (veredicto #25): la 'N' de NORTH aparece en el sink RUNES, no en IBM", () => {
    const { ibm, runes } = renderWithSign(["NORTH BRITAIN"]);
    expect(runes.map((c) => c.code)).toContain(0x4e); // 'N' con RUNES.CH
    expect(ibm.map((c) => c.code)).not.toContain(0x4e);
  });

  it("las celdas rúnicas se REGISTRAN en el sink con rune:true (pase rúnico HD del shader)", () => {
    const { ibmRecords } = renderWithSign(["NORTH BRITAIN"]);
    // El cuerpo ('N' 0x4e) y el marco (esquina 0x38) se enumeran vía `font.record`
    // marcados `rune:true` — la piel shader los enruta al atlas font-runes-hd.png
    // (lote-L6). Output-neutral: el blit rúnico nearest de la fiel no cambia (tests
    // de arriba); aquí sólo se comprueba la ENUMERACIÓN.
    const runic = ibmRecords.filter((r) => r.rune === true);
    expect(runic.map((r) => r.code)).toContain(0x4e); // 'N' del cuerpo
    expect(runic.map((r) => r.code)).toContain(BOX.TL); // esquina del marco
    for (const r of runic) {
      expect(r.x).toBeGreaterThanOrEqual(CONSOLE_X0); // dentro del panel de consola
      expect(r.y).toBeGreaterThanOrEqual(CONSOLE_Y0);
    }
    // Y ningún registro de texto NO-rúnico va marcado (el bullet ► u otros records
    // llegan sin flag): el enrutado del pase HD no puede arrastrar texto IBM al atlas runa.
    for (const r of ibmRecords) if (r.rune) expect(runic).toContain(r);
  });

  it("sin cartel en la consola no se pinta ningún glifo de marco rúnico", () => {
    const runes = fontSpy();
    paintFaithful(spyCtx().ctx, FONT, ATLAS, snapshot(), { runes: runes.font });
    const codes = runes.calls.map((c) => c.code);
    for (const corner of [BOX.TL, BOX.TR, BOX.BL, BOX.BR]) expect(codes).not.toContain(corner);
  });

  it("el marco se pinta DENTRO del panel de consola (no en el viewport)", () => {
    const boxCodes = new Set(Object.values(BOX));
    const { runes } = renderWithSign(["PAWS"]);
    const frame = runes.filter((c) => boxCodes.has(c.code)); // excluye la banda celeste rúnica
    expect(frame.length).toBeGreaterThan(0);
    for (const c of frame) {
      expect(c.dx).toBeGreaterThanOrEqual(CONSOLE_X0);
      expect(c.dy).toBeGreaterThanOrEqual(CONSOLE_Y0);
    }
  });
});
