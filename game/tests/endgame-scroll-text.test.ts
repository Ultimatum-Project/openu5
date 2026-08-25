/**
 * REPRO scroll-vacío (bug en vivo 2026-07-23): el pergamino del cierre (fase `scroll`)
 * salía con el ARTE pintado pero el interior EN BLANCO. Este test cierra el agujero de
 * verificación (el e2e asertaba fase/eventos, no el TEXTO del canvas): ejercita el pacer
 * REAL (runScroll → buildScrollLines) y el renderer REAL (paintEndgameScroll) con stubs
 * de ctx/fuente que REGISTRAN los glifos estampados, en EN y ES.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { EndgamePacer, EG_SCROLL_LINE_MS } from "../src/ui/endgame-pacer.js";
import { paintEndgameScroll, type EndgameScenesPack } from "../src/skin/fiel/endgame-frame.js";
import type { EndgameScript } from "../src/core/endgame/sequence.js";
import type { EndgameSceneView } from "../src/skin/api.js";
import type { FaithfulFont } from "../src/skin/fiel/font.js";
import type { Game } from "../src/core/game.js";
import { setLang } from "../src/i18n/index.js";

(globalThis as Record<string, unknown>).window ??= globalThis;

function makeHarness() {
  const scenes: (EndgameSceneView | null)[] = [];
  const game = {
    state: {
      partySize: 1,
      characters: [{ class: "A", name: "ELWOOD" }],
      time: { year: 141, month: 6, day: 8 },
    },
  } as unknown as Game;
  const pacer = new EndgamePacer({
    game,
    view: { setEndgameScene: (s) => scenes.push(s), emitSfx: () => {} },
    hud: { message: () => {}, messageAppend: () => {} },
    refreshAwaiting: () => {},
    cancelAutoWalk: () => {},
    sceneMs: (ms) => ms,
    sceneBeatMs: null,
    endgameRoom: null,
  });
  return { pacer, scenes };
}

const SCRIPT: EndgameScript = {
  ending: "victory",
  beats: [{ phase: "scroll" }, { phase: "terminalFreeze" }],
} as EndgameScript;

beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  vi.useRealTimers();
  setLang("en");
});

const fakeCtx = (): CanvasRenderingContext2D =>
  ({ fillStyle: "", fillRect: () => {}, drawImage: () => {} }) as unknown as CanvasRenderingContext2D;

/** Fuente-stub: registra cada glifo estampado (código + posición + color). */
function fakeFont(rec: { code: number; x: number; y: number; color?: string }[]): FaithfulFont {
  return {
    drawGlyph: (
      _ctx: CanvasRenderingContext2D,
      code: number,
      x: number,
      y: number,
      _scale?: number,
      color?: string,
    ) => {
      rec.push({ code, x, y, color });
    },
  } as unknown as FaithfulFont;
}

for (const lang of ["en", "es"] as const) {
  describe(`pergamino del cierre — texto estampado (${lang})`, () => {
    it("runScroll publica scrollLines NO vacías y el reveal avanza hasta el final", () => {
      setLang(lang);
      const { pacer, scenes } = makeHarness();
      pacer.run(SCRIPT);
      vi.advanceTimersByTime(EG_SCROLL_LINE_MS * 60);
      const last = scenes[scenes.length - 1]!;
      expect(last.scrollLines?.length ?? 0).toBeGreaterThan(0);
      expect(last.scrollReveal).toBe(last.scrollLines!.length);
      const texts = last.scrollLines!.map((l) => l.text);
      // Primera línea del datestamp (ENDGAME 0x0326) presente y no vacía.
      expect(texts[0]).toMatch(lang === "en" ? /^Be it known/ : /\S/);
      // Las 2 líneas RÚNICAS derivadas (re/notes/endgame.md §Pergamino).
      expect(last.scrollLines!.filter((l) => l.rune).length).toBe(2);
      // El informe va FUERA del pergamino (below) y no vacío.
      const below = last.scrollLines!.filter((l) => l.below);
      expect(below.length).toBeGreaterThan(0);
      for (const l of below) expect(l.text).toMatch(/\S/);
    });

    it("paintEndgameScroll ESTAMPA glifos de tinta (el interior no queda en blanco)", () => {
      setLang(lang);
      const { pacer, scenes } = makeHarness();
      pacer.run(SCRIPT);
      vi.advanceTimersByTime(EG_SCROLL_LINE_MS * 60);
      const last = scenes[scenes.length - 1]!;
      // CON el arte (pack con endsc:0): tinta interior NEGRA sobre el pergamino, y el
      // informe de abajo sin tinta (blanco). El ctx-stub no blitea; sólo cuenta glifos.
      const pack: EndgameScenesPack = {
        img: {} as CanvasImageSource,
        entries: { "endsc:0": { x: 0, y: 607, width: 260, height: 168 } },
        titles: null,
        proport: null,
      };
      const rec: { code: number; x: number; y: number; color?: string }[] = [];
      paintEndgameScroll(fakeCtx(), fakeFont(rec), fakeFont(rec), pack, last);
      expect(rec.length).toBeGreaterThan(50);
      const drawn = String.fromCharCode(...rec.map((r) => r.code));
      if (lang === "en") expect(drawn).toContain("Be it known");
      expect(rec.some((r) => r.color === "#000000")).toBe(true);
      expect(rec.some((r) => r.color === undefined)).toBe(true);
    });

    it("la tinta interior NUNCA pisa el arte del borde (banda del testigo w140, en crudo)", () => {
      // Defecto con captura (2026-08-22): con wrap a 25 cols y centrado por píxel,
      // «…and our» salía a x≈234 del arte (zona del rollo derecho). Banda MEDIDA del
      // binario en w140 (recorte de endgame-cases.json, escala ×4): la tinta interior
      // vive en x 72..240 — «Lord British, thereby» (21 cols) va de 72 a 240 y ninguna
      // línea sale de ahí. Los límites van EN CRUDO (px de pantalla 320×200), no
      // derivados del sujeto. Primera fila de tinta: y=8 (rejilla de 8 px, arte en y=0).
      setLang(lang);
      const { pacer, scenes } = makeHarness();
      pacer.run(SCRIPT);
      vi.advanceTimersByTime(EG_SCROLL_LINE_MS * 60);
      const last = scenes[scenes.length - 1]!;
      const pack: EndgameScenesPack = {
        img: {} as CanvasImageSource,
        entries: { "endsc:0": { x: 0, y: 607, width: 260, height: 168 } },
        titles: null,
        proport: null,
      };
      const rec: { code: number; x: number; y: number; color?: string }[] = [];
      paintEndgameScroll(fakeCtx(), fakeFont(rec), fakeFont(rec), pack, last);
      // La tinta interior (negra sobre el pergamino) — el informe de abajo (blanco,
      // fuera del arte) no entra en la banda.
      const ink = rec.filter((r) => r.color === "#000000");
      expect(ink.length).toBeGreaterThan(50);
      for (const r of ink) {
        expect(r.x, `glifo ${String.fromCharCode(r.code)} en x=${r.x}`).toBeGreaterThanOrEqual(72);
        expect(r.x + 8, `glifo ${String.fromCharCode(r.code)} hasta x=${r.x + 8}`).toBeLessThanOrEqual(240);
      }
      expect(Math.min(...ink.map((r) => r.y))).toBe(8);
    });

    it("el arte va en (41,0) y la rejilla de texto cae en múltiplos de 8 (testigo w140, en crudo)", () => {
      // El pergamino del original NO está centrado en pantalla: medido por correlación
      // de la silueta del borde contra el testigo normalizado (pico único dx=+11 dy=−2
      // sobre el `(320−260)/2 = 30`, `oy = 2` de antes) ⇒ (41, 0). Es la causa RAÍZ del
      // desbordamiento reportado: con el papel 11 px a la izquierda, el texto —que va
      // centrado EN PANTALLA— queda descentrado DENTRO del papel y roza el rollo derecho.
      // Cotas EN CRUDO (px de la pantalla lógica 320×200), NO derivadas del sujeto:
      // arte en (41,0); primera fila de tinta y=8; informe `below` en 168/176/184.
      setLang(lang);
      const { pacer, scenes } = makeHarness();
      pacer.run(SCRIPT);
      vi.advanceTimersByTime(EG_SCROLL_LINE_MS * 60);
      const last = scenes[scenes.length - 1]!;
      const pack: EndgameScenesPack = {
        img: {} as CanvasImageSource,
        entries: { "endsc:0": { x: 0, y: 607, width: 260, height: 168 } },
        titles: null,
        proport: null,
      };
      const blits: number[][] = [];
      const ctx = {
        fillStyle: "",
        fillRect: () => {},
        drawImage: (...a: unknown[]) => blits.push(a.slice(1) as number[]),
      } as unknown as CanvasRenderingContext2D;
      const rec: { code: number; x: number; y: number; color?: string }[] = [];
      paintEndgameScroll(ctx, fakeFont(rec), fakeFont(rec), pack, last);
      // Blit del arte: (sx,sy,sw,sh, dx,dy,dw,dh) → destino (41,0).
      expect(blits.length).toBe(1);
      expect([blits[0]![4], blits[0]![5]]).toEqual([41, 0]);
      // Toda fila de texto (tinta interior E informe) cae en la rejilla de 8 px.
      for (const r of rec) expect(r.y % 8, `glifo en y=${r.y} fuera de la rejilla`).toBe(0);
      const below = rec.filter((r) => r.color === undefined);
      expect(below.length).toBeGreaterThan(20);
      expect(Math.min(...below.map((r) => r.y))).toBe(168);
      // El informe del TESTIGO son 3 filas — 168/176/184 (es sólo se carea contra su
      // arranque: su prosa es más larga y envuelve a 4 filas, que es el idioma, no la
      // geometría). Con `oy=2` estas tres caían en 176/184/192 y la última quedaba
      // pegada al borde inferior de la pantalla.
      if (lang === "en") {
        expect([...new Set(below.map((r) => r.y))].sort((a, b) => a - b)).toEqual([168, 176, 184]);
      }
    });

    it("SIN pack (ausencia con gracia): la tinta NO es negra — el texto sigue VISIBLE sobre negro", () => {
      // Guarda del bug scroll-vacío 2026-07-23: sin endsc:0 el fondo es NEGRO y la tinta
      // fija "#000000" dejaba el pergamino invisible-por-construcción. Degradación
      // coherente con paintEndgameStory: glifos SIN tinte (blancos del atlas).
      setLang(lang);
      const { pacer, scenes } = makeHarness();
      pacer.run(SCRIPT);
      vi.advanceTimersByTime(EG_SCROLL_LINE_MS * 60);
      const last = scenes[scenes.length - 1]!;
      const rec: { code: number; x: number; y: number; color?: string }[] = [];
      paintEndgameScroll(fakeCtx(), fakeFont(rec), fakeFont(rec), null, last);
      expect(rec.length).toBeGreaterThan(50);
      expect(rec.every((r) => r.color !== "#000000")).toBe(true);
    });
  });
}
