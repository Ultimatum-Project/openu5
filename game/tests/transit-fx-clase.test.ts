/**
 * CABO DE #359 (carril fix-transit-fx-b) — EL CENSO COMPLETO DEL EARLY-RETURN DEL TRANSIT.
 *
 * #359 repintó `worldFx` en la rama transit de `FaithfulSkin.render()` y declaró la
 * candidata: «el mismo early-return se salta quake/apparition/flashes». Este fichero sella
 * la adjudicación de ESA clase, efecto a efecto (censo derivado del código: todo lo que
 * vive entre la línea del early-return y el final de `render()`):
 *
 * ALCANZABLES durante los ~1610 ms del cruce (se repintan — polaridad PÉRDIDA):
 *  · QUAKE (#29) — el (Y)ell de la palabra de poder dispara el quake ANTES de la lógica
 *    del sello («NO depende de mazmorra adyacente», game.ts, rama WORD_UTTERED), así que
 *    se puede gritar junto a una puerta lunar (las puertas nacen donde el jugador ENTIERRA
 *    las moonstones — `moongatePositions` itera `state.moonstones`); el cue `quake` NO es
 *    bloqueante (speaker.ts: meterlo en BLOCKING_CUES «habría comido teclas en CADA
 *    terremoto») y nada purga la QuakeShake salvo unmount/swap ⇒ sacudida viva (936 ms)
 *    + pisar la puerta es alcanzable.
 *  · APPARITION (camp) — `wake()` baja el flag modal `camping` ANTES de aplicar los
 *    eventos que disparan el flash (ui/camp-sleep.ts: `this._camping = false` y después
 *    `applyEvents(events)`), y `handleGameKey` sólo traga con `camping=true` ⇒ durante
 *    los hasta ~14,6 s del flash (4 vivos) el jugador SE MUEVE; la acampada está gateada
 *    a sobremundo a pie = donde viven las puertas. Nada purga la ApparitionFlash.
 *  · TIME-SPELL FLASH — el pergamino se usa en el sobremundo (main.ts emite el cue
 *    `time-spell` en las dos vías) y su docblock declara la divergencia Clase C: «el
 *    original BLOQUEA el input durante el jingle; el port lo superpone sin pacear»
 *    (invert-flash.ts) ⇒ inversión viva (≤~2,9 s An Tym) + pisar la puerta, alcanzable.
 *
 * INALCANZABLES (documentados, NO se repintan — el porqué, con cita):
 *  · combatFx — pisar una puerta exige modo mundo; al salir de combate el primer render
 *    normal purga la capa (`else if (this.combatFx.active) this.combatFx.clear()`).
 *  · healerFlash — emisor único: cue `shop-transaction` del curandero (SHOPPES 0x1611/
 *    0x1684/0x16eb), interiores de pueblo; el diálogo de tienda es modal mientras arranca
 *    y las moonstones sólo se entierran en el mapa grande (Z_BRITANNIA/Z_UNDERWORLD,
 *    moongates.ts) ⇒ no hay puerta alcanzable dentro de la ventana (~6,2 s con el modal
 *    delante y el pueblo entero en medio; exigiría además un curandero abierto de noche
 *    20-05h, que es cuando existen puertas). No acreditada — se documenta, no se repinta.
 *  · codexWindFlash — el bracket (3×936 ms) corre DENTRO de la escena del santuario
 *    (mapa propio 11×11, CAST2 0x0e76) y encajonado entre los keyWaits de la ceremonia
 *    (0x0d9f delante, 0x0df8 detrás, #294): el input de toda la ventana lo consume la
 *    espera de tecla como «cualquier tecla». Muere con la tercera ráfaga.
 *  · ritualInvert — el WELL DONE/ALAKAZAM también vive DENTRO de la escena del santuario
 *    y su restauración llega ANTES de la caminata de salida (main.ts difiere el
 *    `shrineScenePacer.run` a `whenRestored`): el estado nunca está vivo con la party
 *    de vuelta en el sobremundo. (El agujero «moverse con la escena montada» existe como
 *    clase aparte — el pacer se declara modal sin guarda en handleGameKey — y es candidata
 *    para el lead, no la vía de este fix.)
 *  · bedBlackout — `handleGameKey` traga todo con `bedSleepCtl.sleeping` (main.ts) y la
 *    cama es un tile de pueblo: doble exclusión.
 *
 * POLARIDAD, por efecto (careo #253):
 *  · quake: la shader lo recomponía INCONDICIONAL en su paso (2f) — repintarlo en la fiel
 *    sin tocar (2f) lo sumaría DOS veces durante el cruce (el recorte pleno hereda el
 *    shift ya horneado y (2f) desplaza encima = 2·qoff). El gate nació aquí como
 *    `!transiting`; el carril fix-agua-quake MIDIÓ la candidata 1 de este commit (la misma
 *    doble suma en recorte pleno SIN cruce, dy=16 con motion OFF) y lo generalizó a
 *    `terrainOnly` — que SUBSUME al de aquí (`transiting` ⇒ `!useMotion` ⇒ `!terrainOnly`).
 *    Ver el aserto estructural de abajo y agua-quake-clase.test.ts.
 *  · apparition: en la vía de RECORTE PLENO —la de este cruce— la shader hereda lo que la
 *    fiel horneó ⇒ sin dup. 🔴 Esta línea decía «la shader no tiene pintor propio» a secas
 *    y CADUCÓ el 22-08: el careo A/B del campamento (22 capturas por piel) midió la otra
 *    mitad de la clase #253 — en la vía de TERRENO el paso (2) recompone el viewport y
 *    PISABA la aparición, así que la shader ya tiene su pareado, gateado a `terrainOnly`
 *    justo para que esta vía siga heredando. Ver `shader-aparicion-camp.test.ts`.
 *  · timeFlash: `paintViewportInversions` declina con `!terrainOnly` (shader/skin.ts,
 *    lección #345) y durante el cruce terrainOnly=false ⇒ hereda, sin dup.
 *
 * Arnés: el de `transit-world-fx.test.ts` (antym-freeze) — clase real en node, privados
 * por índice, ctx REGISTRADOR; esperados EN CRUDO derivados a mano en cada aserto.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { FaithfulSkin } from "../src/skin/fiel/skin.js";

const RAIZ_GAME = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const leer = (rel: string): string => readFileSync(resolve(RAIZ_GAME, rel), "utf8");

/** Registrador de canvas 2D: apunta drawImage/fillRect con fillStyle y composite vigentes. */
interface Op {
  op: "drawImage" | "fillRect";
  args: unknown[];
  fillStyle: string;
  gco: string;
}
function ctxRegistrador(): { ctx: CanvasRenderingContext2D; ops: Op[] } {
  const ops: Op[] = [];
  const state = { fillStyle: "", gco: "source-over" };
  const ctx = {
    canvas: { marca: "main-canvas" },
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
    // `save/restore` del registrador NO restauran gco/fillStyle a propósito: el aserto
    // lee el estado VIGENTE en el instante del op, que es lo que pinta el navegador.
    save: () => {},
    restore: () => {},
    beginPath: () => {},
    rect: () => {},
    clip: () => {},
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

/** Marcadores de identidad: los asertos distinguen fuentes por REFERENCIA. */
const ATLAS = { marca: "atlas" } as unknown as CanvasImageSource;
const BUF = { marca: "transit-buf" } as unknown as HTMLCanvasElement;
const T0 = 100_000;

/** Buffer falso del re-blit de la sacudida (ya dimensionado 176×176 → sin resize). */
function quakeBufFalso(): HTMLCanvasElement {
  return {
    marca: "quake-buf",
    width: 176,
    height: 176,
    getContext: () => ({
      set imageSmoothingEnabled(_v: boolean) {},
      clearRect: () => {},
      drawImage: () => {},
    }),
  } as unknown as HTMLCanvasElement;
}

function makeSkinEnTransit(
  nowMs: number,
  snap: Record<string, unknown> = {},
): { skin: FaithfulSkin; ops: Op[]; priv: Record<string, unknown> } {
  const skin = new FaithfulSkin();
  const priv = skin as unknown as Record<string, unknown>;
  const { ctx, ops } = ctxRegistrador();
  priv.ctx = ctx;
  priv.font = { marca: "font" };
  priv.atlas = ATLAS;
  priv.view = { snapshot: () => snap };
  priv.transit = { buf: BUF, stage: 8, hold: 0 };
  priv.now = () => nowMs;
  return { skin, ops, priv };
}

function render(skin: FaithfulSkin): void {
  (skin as unknown as { render: () => void }).render();
}

const idxBufBlit = (ops: Op[]): number =>
  ops.findIndex((o) => o.op === "drawImage" && o.args[0] === BUF);

describe("cabo de #359 — quake/apparition/timeFlash sobre el frame congelado del transit", () => {
  it("la SACUDIDA (#29) desplaza el viewport durante el cruce, sobre el frame congelado", () => {
    // Quake disparado 10 ms antes del frame: t=10 < QUAKE_DOWN_MS=42 → offset = 2 px.
    const { skin, ops, priv } = makeSkinEnTransit(T0 + 10);
    const qbuf = quakeBufFalso();
    priv.quakeBuf = qbuf;
    (skin as unknown as { quake: { trigger: (t: number) => void } }).quake.trigger(T0);
    render(skin);

    // EN CRUDO: viewport (8,8), 11 tiles × 16 px = 176; el re-blit borra a negro el rect
    // y vuelve a pintar el buffer 2 px MÁS ABAJO: drawImage(quakeBuf, 8, 8+2=10).
    const negro = ops.findIndex(
      (o) =>
        o.op === "fillRect" &&
        o.fillStyle === "#000" &&
        o.args[0] === 8 &&
        o.args[1] === 8 &&
        o.args[2] === 176 &&
        o.args[3] === 176,
    );
    expect(negro, "la sacudida no borra el rect del viewport durante el transit (cabo de #359)").toBeGreaterThan(-1);
    const reblit = ops.findIndex(
      (o) => o.op === "drawImage" && o.args[0] === qbuf && o.args[1] === 8 && o.args[2] === 10,
    );
    expect(reblit, "la sacudida no re-blitea desplazado durante el transit (cabo de #359)").toBeGreaterThan(-1);
    // ORDEN: encima del frame congelado (el blit del buffer del transit va antes).
    expect(reblit).toBeGreaterThan(idxBufBlit(ops));
  });

  it("orden calcado del camino normal: la sacudida ANTES del worldFx (el fx no se desplaza)", () => {
    const { skin, ops, priv } = makeSkinEnTransit(T0 + 10);
    priv.quakeBuf = quakeBufFalso();
    (skin as unknown as { quake: { trigger: (t: number) => void } }).quake.trigger(T0);
    (
      skin as unknown as { worldFx: { push: (fx: unknown, t0: number) => void } }
    ).worldFx.push({ kind: "cellExplosion", dx: 2, dy: 1, bursts: 7, preDelayUnits: 0 }, T0);
    render(skin);
    const reblit = ops.findIndex((o) => o.op === "drawImage" && o.args[1] === 8 && o.args[2] === 10);
    // Ráfaga (#201) en (dx=2,dy=1): destino (120,104) — mismos literales que #359.
    const explosion = ops.findIndex(
      (o) => o.op === "drawImage" && o.args[0] === ATLAS && o.args[5] === 120 && o.args[6] === 104,
    );
    expect(reblit).toBeGreaterThan(-1);
    expect(explosion).toBeGreaterThan(-1);
    expect(explosion, "el fx debe pintarse DESPUÉS del re-blit de la sacudida, como en el camino normal").toBeGreaterThan(reblit);
  });

  it("la APARICIÓN del campamento sigue pintándose durante el cruce: despiertos + figura + inversión", () => {
    // 2 pulsos (2 vivos), t=+10 ms → pulso 0, ventana de inversión (10 < 2200).
    // El snapshot VIVO conserva campScene (el timer de camp-sleep lo desmonta después).
    const campScene = {
      members: [
        { charIdx: 0, col: 4, row: 6, tile: 0x11a, awakeTile: 300 },
        { charIdx: 1, col: 6, row: 6, tile: 0x11a, awakeTile: 301 },
      ],
      fire: { col: 5, row: 5, tile: 179 },
    };
    const { skin, ops, priv } = makeSkinEnTransit(T0 + 10, { campScene });
    priv.phase = 0;
    (skin as unknown as { apparition: { trigger: (t: number, p: number) => void } }).apparition.trigger(T0, 2);
    render(skin);

    // EN CRUDO (atlas 32 columnas × 16 px):
    //  · figura 0x174=372 → src (320,176); celda fija (5,5) → dest (8+80, 8+80) = (88,88).
    const figura = ops.find(
      (o) =>
        o.op === "drawImage" &&
        o.args[0] === ATLAS &&
        o.args[1] === 320 &&
        o.args[2] === 176 &&
        o.args[5] === 88 &&
        o.args[6] === 88,
    );
    expect(figura, "la figura de la aparición no se blitea durante el transit (cabo de #359)").toBeDefined();
    //  · miembro 0 DESPIERTO (pulso 0): awakeTile 300 → src (192,144); (4,6) → dest (72,104).
    const despierto = ops.find(
      (o) =>
        o.op === "drawImage" &&
        o.args[0] === ATLAS &&
        o.args[1] === 192 &&
        o.args[2] === 144 &&
        o.args[5] === 72 &&
        o.args[6] === 104,
    );
    expect(despierto, "el miembro despierto del pulso no se pinta durante el transit").toBeDefined();
    //  · miembro 1 AÚN dormido en el pulso 0: su awakeTile 301 → src (208,144) NO aparece.
    const dormido = ops.find(
      (o) => o.op === "drawImage" && o.args[1] === 208 && o.args[2] === 144,
    );
    expect(dormido).toBeUndefined();
    //  · inversión del pulso: fillRect blanco en `difference` sobre (8,8,176,176), DESPUÉS
    //    de la figura (se invierte con la escena, como el testigo).
    const invert = ops.findIndex(
      (o) =>
        o.op === "fillRect" &&
        o.gco === "difference" &&
        o.fillStyle === "#ffffff" &&
        o.args[0] === 8 &&
        o.args[1] === 8 &&
        o.args[2] === 176 &&
        o.args[3] === 176,
    );
    expect(invert, "la inversión de la aparición no se aplica durante el transit").toBeGreaterThan(-1);
    const idxFigura = ops.findIndex((o) => o === figura);
    expect(invert).toBeGreaterThan(idxFigura);
  });

  it("el flash del PERGAMINO DE TIEMPO invierte el viewport durante el cruce", () => {
    const { skin, ops } = makeSkinEnTransit(T0 + 10);
    (
      skin as unknown as {
        timeFlash: { trigger: (t: number, w: { delay: number; dur: number }) => void };
      }
    ).timeFlash.trigger(T0, { delay: 0, dur: 1000 });
    render(skin);
    const invert = ops.findIndex(
      (o) =>
        o.op === "fillRect" &&
        o.gco === "difference" &&
        o.fillStyle === "#ffffff" &&
        o.args[0] === 8 &&
        o.args[1] === 8 &&
        o.args[2] === 176 &&
        o.args[3] === 176,
    );
    expect(invert, "la inversión del pergamino no se aplica durante el transit (cabo de #359)").toBeGreaterThan(-1);
    expect(invert).toBeGreaterThan(idxBufBlit(ops));
  });

  it("★ control positivo del instrumento: SIN fx vivo, ninguno de esos ops aparece", () => {
    const { skin, ops } = makeSkinEnTransit(T0 + 10);
    render(skin);
    expect(ops.find((o) => o.op === "fillRect" && o.fillStyle === "#000")).toBeUndefined();
    expect(ops.find((o) => o.op === "fillRect" && o.gco === "difference")).toBeUndefined();
    expect(ops.find((o) => o.op === "drawImage" && o.args[5] === 88 && o.args[6] === 88)).toBeUndefined();
    // …y el transit en sí SÍ pintó (el arnés entra por la rama que dice entrar).
    expect(idxBufBlit(ops)).toBeGreaterThan(-1);
  });

  it("POLARIDAD en la shader: (2f) declina durante el cruce — sin doble sacudida", () => {
    // El paso (2f) era INCONDICIONAL; con la fiel horneando el shift en la rama transit,
    // el recorte pleno lo hereda y (2f) encima lo sumaría dos veces (2·qoff). El gate
    // nació `!transiting` (5962ad37) y fix-agua-quake lo generalizó a `terrainOnly` tras
    // MEDIR la misma doble suma fuera del cruce (candidata 1, dy=16 en motion OFF): la vía
    // que hereda el recorte pleno nunca re-aplica, y `transiting` ⇒ `!terrainOnly` ⇒ el
    // cruce sigue cubierto por el gate nuevo.
    const src = leer("src/skin/shader/skin.ts");
    const i = src.indexOf("if (qoff > 0 && terrainOnly) this.paintQuakeShift(ctx, wr, qoff * s)");
    expect(i, "el paso (2f) de la shader debe declinar durante el transit (doble sacudida)").toBeGreaterThan(0);
  });

  it("CANDADO: los literales de estos asertos siguen casando con las constantes del sujeto", () => {
    const frame = leer("src/skin/fiel/frame.ts");
    expect(frame).toContain("export const VIEWPORT = { x: 8, y: 8, tile: 16, tiles: 11 }");
    const quake = leer("src/skin/fiel/quake.ts");
    expect(quake).toContain("export const QUAKE_AMPLITUDE_PX = 2");
    expect(quake).toContain("export const QUAKE_DOWN_MS = 42");
    const app = leer("src/skin/fiel/apparition.ts");
    expect(app).toContain("export const APPARITION_FIGURE_TILE = 0x174");
    expect(app).toContain("export const APPARITION_INVERT_MS = 2200");
    expect(app).toContain("export const APPARITION_FIGURE_CELL = { col: 5, row: 5 }");
    const skinSrc = leer("src/skin/fiel/skin.ts");
    expect(skinSrc).toContain("const ATLAS_COLS = 32");
    expect(skinSrc).toContain("const ATLAS_TILE = 16");
  });
});
