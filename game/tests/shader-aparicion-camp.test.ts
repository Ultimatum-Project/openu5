/**
 * APARICIÓN DEL CAMPAMENTO EN LA PIEL SHADER — 3ª instancia MEDIDA de la clase #253 en
 * su polaridad PÉRDIDA (tras #201 explosiones y #313 cañonazo).
 *
 * EL DEFECTO, MEDIDO ANTES DEL FIX (careo A/B del carril de regrabación, 22 capturas por
 * piel en `scratchpad/camp-verificacion/ab-{faithful,shader}-NN.png`): la figura 0x174 en
 * la hoguera + los despiertos por pulso + los pulsos de inversión aparecen en la piel FIEL
 * y NO en la SHADER. Causa: la fiel los hornea en SU canvas oculto DESPUÉS de su render, y
 * la vía de terreno de la shader (paso 2) recompone el viewport desde el snapshot y los
 * PISA — el compose de la shader tenía pareados explícitos para quake/time-flash/healer/
 * códice/cañonazo y NINGUNA mención a la aparición.
 *
 * LAS DOS POLARIDADES (memoria `la-clase-253-tiene-dos-polaridades-perdida-y-duplicacion`):
 * el pareado va gateado a `terrainOnly`. En recorte pleno (`!terrainOnly`: motion OFF,
 * mazmorra, cruce de moongate) el viewport de la shader ES un recorte del canvas fiel, que
 * YA trae la aparición horneada; repintar allí DUPLICARÍA — y como el pulso se pinta con
 * `difference` blanco, dos inversiones se CANCELAN y el síntoma sería el mismo que la
 * pérdida. El mismo discriminante que (2f) quake y que `paintViewportInversions` (#345).
 *
 * LO QUE CUBRE CADA BLOQUE:
 *  · §1 el pintor extraído `paintApparitionInto` pinta en el ctx QUE SE LE DA (no en el
 *    canvas de la fiel) — es lo que hace posible reusarlo desde el compose de la shader.
 *  · §2 `apparitionActive` es la señal que el compose consulta.
 *  · §3 GUARDA DE FUENTE, declarada como tal (`ShaderSkin` no monta en jsdom, misma
 *    frontera que `cannon-projectile.test.ts` §3): el compose LLAMA al pintor, con el
 *    gate `terrainOnly`, y en su sitio del orden (tras el cañonazo, antes de las
 *    inversiones XOR) — que es el orden de la fiel (worldFx → aparición → timeFlash).
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { FaithfulSkin } from "../src/skin/fiel/skin.js";
import type { CampSceneView } from "../src/skin/api.js";

const RAIZ_GAME = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const leer = (rel: string): string => readFileSync(resolve(RAIZ_GAME, rel), "utf8");

interface Op {
  op: "drawImage" | "fillRect";
  args: unknown[];
  fillStyle: string;
  gco: string;
}

/** Registrador de canvas 2D (mismo arnés que transit-fx-clase.test.ts). */
function ctxRegistrador(marca: string): { ctx: CanvasRenderingContext2D; ops: Op[] } {
  const ops: Op[] = [];
  const state = { fillStyle: "", gco: "source-over" };
  const ctx = {
    canvas: { marca },
    set fillStyle(v: string) {
      state.fillStyle = v;
    },
    get fillStyle(): string {
      return state.fillStyle;
    },
    set globalCompositeOperation(v: string) {
      state.gco = v;
    },
    get globalCompositeOperation(): string {
      return state.gco;
    },
    save: () => {},
    restore: () => {},
    beginPath: () => {},
    rect: () => {},
    clip: () => {},
    translate: () => {},
    scale: () => {},
    set imageSmoothingEnabled(_v: boolean) {},
    drawImage: (...args: unknown[]) => {
      ops.push({ op: "drawImage", args, fillStyle: state.fillStyle, gco: state.gco });
    },
    fillRect: (...args: unknown[]) => {
      ops.push({ op: "fillRect", args, fillStyle: state.fillStyle, gco: state.gco });
    },
  } as unknown as CanvasRenderingContext2D;
  return { ctx, ops };
}

const ATLAS = { marca: "atlas" } as unknown as CanvasImageSource;
const T0 = 100_000;

/**
 * campScene mínimo: dos durmientes y la hoguera (mismos literales que #359). TIPADO
 * (sin `as`) a propósito: un fixture con `as` no lo typechequea vitest y el aserto pasa
 * verde contra una forma que el sujeto no acepta.
 */
const CAMP: CampSceneView = {
  members: [
    { charIdx: 0, col: 4, row: 6, tile: 0x11a, awakeTile: 300, guard: false, bard: false },
    { charIdx: 1, col: 6, row: 6, tile: 0x11a, awakeTile: 301, guard: false, bard: false },
  ],
  fire: { col: 5, row: 5, tile: 179 },
};

function skinConAparicion(nowMs: number): {
  skin: FaithfulSkin;
  propio: Op[];
  priv: Record<string, unknown>;
} {
  const skin = new FaithfulSkin();
  const priv = skin as unknown as Record<string, unknown>;
  const { ctx, ops } = ctxRegistrador("canvas-de-la-fiel");
  priv.ctx = ctx;
  priv.atlas = ATLAS;
  priv.phase = 0;
  priv.now = () => nowMs;
  (skin as unknown as { apparition: { trigger: (t: number, p: number) => void } }).apparition.trigger(T0, 2);
  return { skin, propio: ops, priv };
}

describe("§1 — el pintor de la aparición es REUSABLE: pinta en el ctx que se le pasa", () => {
  it("blitea figura + despierto + inversión en el ctx AJENO, y NADA en el de la fiel", () => {
    // t=+10 ms → pulso 0 y dentro de la ventana de inversión (10 < APPARITION_INVERT_MS).
    const { skin, propio } = skinConAparicion(T0 + 10);
    const { ctx: ajeno, ops } = ctxRegistrador("canvas-de-la-shader");
    skin.paintApparitionInto(ajeno, CAMP);

    // EN CRUDO (atlas de 32 columnas × 16 px, viewport en (8,8) con tile 16):
    //  · figura 0x174 = 372 → fila 11, col 20 → src (320,176); celda FIJA (5,5) → dest (88,88).
    const figura = ops.find(
      (o) =>
        o.op === "drawImage" &&
        o.args[0] === ATLAS &&
        o.args[1] === 320 &&
        o.args[2] === 176 &&
        o.args[5] === 88 &&
        o.args[6] === 88,
    );
    expect(figura, "la figura 0x174 no se blitea en el ctx ajeno").toBeDefined();
    //  · miembro 0 DESPIERTO en el pulso 0: awakeTile 300 → src (192,144); (4,6) → dest (72,104).
    const despierto = ops.find(
      (o) => o.op === "drawImage" && o.args[1] === 192 && o.args[2] === 144 && o.args[5] === 72 && o.args[6] === 104,
    );
    expect(despierto, "el despierto del pulso 0 no se pinta en el ctx ajeno").toBeDefined();
    //  · miembro 1 AÚN dormido en el pulso 0: su awakeTile 301 → src (208,144) NO aparece.
    expect(ops.find((o) => o.args[1] === 208 && o.args[2] === 144)).toBeUndefined();
    //  · inversión del pulso: fillRect BLANCO en `difference` sobre (8,8,176,176), DESPUÉS
    //    de la figura (se invierte con la escena, como el testigo).
    const iFig = ops.findIndex((o) => o === figura);
    const iInv = ops.findIndex(
      (o) =>
        o.op === "fillRect" &&
        o.gco === "difference" &&
        o.fillStyle === "#ffffff" &&
        o.args[0] === 8 &&
        o.args[1] === 8 &&
        o.args[2] === 176 &&
        o.args[3] === 176,
    );
    expect(iInv, "falta el pulso de inversión del viewport").toBeGreaterThan(-1);
    expect(iInv).toBeGreaterThan(iFig);

    // 🔴 EL ASERTO QUE HACE FALTA PARA QUE LA SHADER PUEDA REUSARLO: nada cayó en el canvas
    // de la fiel. Un pintor que ignorase su parámetro y escribiese en `this.ctx` dejaría el
    // viewport de la shader intacto — la avería que este fichero cierra, otra vez.
    expect(propio, "el pintor escribió en el canvas de la FIEL en vez de en el que se le dio").toEqual([]);
  });

  it("fuera de la ventana de la secuencia no pinta nada (no ensucia el viewport)", () => {
    const skin = new FaithfulSkin();
    const priv = skin as unknown as Record<string, unknown>;
    priv.atlas = ATLAS;
    priv.now = () => T0;
    const { ctx, ops } = ctxRegistrador("canvas-de-la-shader");
    skin.paintApparitionInto(ctx, CAMP);
    expect(ops).toEqual([]);
  });
});

describe("§2 — `apparitionActive` es la señal que el compose consulta", () => {
  it("false en reposo, true con la secuencia viva", () => {
    const { skin } = skinConAparicion(T0 + 10);
    expect(skin.apparitionActive).toBe(true);
    const limpia = new FaithfulSkin();
    expect(limpia.apparitionActive).toBe(false);
  });
});

describe("§3 — GUARDA DE FUENTE: el compose de la shader la pinta, gateada y en su sitio", () => {
  it("llama a paintApparitionInto bajo el gate terrainOnly", () => {
    const src = leer("src/skin/shader/skin.ts");
    const i = src.indexOf("this.faithful.paintApparitionInto(ctx, snap.campScene)");
    expect(i, "el compose de la shader NO pinta la aparición (clase #253, pérdida)").toBeGreaterThan(0);
    // El gate va en el `if` que abre el bloque: se busca hacia atrás desde la llamada.
    const gate = src.lastIndexOf("if (terrainOnly && this.faithful.apparitionActive", i);
    expect(
      gate,
      "el pareado de la aparición no está gateado a `terrainOnly`: en recorte pleno DUPLICA",
    ).toBeGreaterThan(0);
  });

  it("va tras el cañonazo y antes de las inversiones XOR (orden de la fiel)", () => {
    const src = leer("src/skin/shader/skin.ts");
    const iBala = src.indexOf("this.paintCannonball(ctx, wr, size, now)");
    const iApp = src.indexOf("this.faithful.paintApparitionInto(ctx, snap.campScene)");
    const iXor = src.indexOf("this.paintViewportInversions(ctx, wr, size, snap, now");
    expect(iBala).toBeGreaterThan(0); // control positivo: los tres anclajes existen HOY
    expect(iApp).toBeGreaterThan(0);
    expect(iXor).toBeGreaterThan(0);
    expect(iBala).toBeLessThan(iApp);
    expect(iApp).toBeLessThan(iXor);
  });

  it("CANDADO: los literales de los asertos siguen casando con las constantes del sujeto", () => {
    const app = leer("src/skin/fiel/apparition.ts");
    expect(app).toContain("export const APPARITION_FIGURE_TILE = 0x174");
    expect(app).toContain("export const APPARITION_FIGURE_CELL = { col: 5, row: 5 }");
    const frame = leer("src/skin/fiel/frame.ts");
    expect(frame).toContain("export const VIEWPORT = { x: 8, y: 8, tile: 16, tiles: 11 }");
    const skinSrc = leer("src/skin/fiel/skin.ts");
    expect(skinSrc).toContain("const ATLAS_COLS = 32");
  });
});
