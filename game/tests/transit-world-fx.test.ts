/**
 * #359 — LOS FX DEL MUNDO NO DESAPARECEN DURANTE EL CRUCE DE MOONGATE.
 *
 * El defecto: `FaithfulSkin.render()` tiene un early-return para el transit
 * (`if (this.transit) { this.paintTransit(); return; }`) que se saltaba el pintado de
 * `worldFx` de más abajo. Un fx vivo al arrancar el cruce (ráfaga #201 / cañonazo #313)
 * desaparecía TODO el transit (~1610 ms: hold 650 + 16×60) — y en las DOS pieles, porque
 * con `transiting` la shader cae al recorte PLENO del canvas fiel (`useMotion` lleva
 * `!transiting`) y hereda lo que la fiel hornee; su (2e-bis) declina con razón (vía de
 * terreno). 🔴 El careo contra la clase #253 que pedía la ficha dio NEGATIVO: la pérdida
 * nace en la PROPIA fiel, no en la recomposición de la shader — el cañonazo incluso
 * divergía entre pieles (la shader ya lo pintaba vía su 2f-quater incondicional).
 *
 * ALCANZABILIDAD (la mitad que la ficha declaraba sin medir): los emisores de worldFx son
 * comandos del jugador (andanada 0x0A48 / cañón 0x0CFE) y el ritual del shard (0x3522, vía
 * `use-tools`); nada purga la capa y el input no se bloquea mientras el fx corre a reloj de
 * pared, así que «fx vivo + pisar la puerta» es alcanzable EN EL PORT. En el binario el
 * estado es inexpresable (animaciones = bucles síncronos: `kernel_moongate_enter` 0x48a8 no
 * puede coincidir con `explosion_fx_at_cell` 0x3522), luego el pintado sobre el frame
 * congelado es Clase C: se repinta (polaridad PÉRDIDA), no se declina.
 *
 * Arnés: el de `antym-freeze.test.ts` / `skin-lifecycle.test.ts` — la clase real se
 * construye en node, los privados se siembran por índice y el ctx es un REGISTRADOR: los
 * asertos miran las llamadas de canvas EN CRUDO (coordenadas literales, derivadas a mano en
 * cada aserto — no calculadas desde las constantes del sujeto).
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { FaithfulSkin } from "../src/skin/fiel/skin.js";

const RAIZ_GAME = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const leer = (rel: string): string => readFileSync(resolve(RAIZ_GAME, rel), "utf8");

/** Registrador de canvas 2D: apunta cada drawImage/fillRect con el fillStyle vigente. */
interface Op {
  op: "drawImage" | "fillRect";
  args: unknown[];
  fillStyle: string;
}
function ctxRegistrador(): { ctx: CanvasRenderingContext2D; ops: Op[] } {
  const ops: Op[] = [];
  const state = { fillStyle: "" };
  const ctx = {
    set fillStyle(v: string) {
      state.fillStyle = v;
    },
    get fillStyle(): string {
      return state.fillStyle;
    },
    drawImage: (...args: unknown[]) => {
      ops.push({ op: "drawImage", args, fillStyle: state.fillStyle });
    },
    fillRect: (...args: unknown[]) => {
      ops.push({ op: "fillRect", args, fillStyle: state.fillStyle });
    },
  } as unknown as CanvasRenderingContext2D;
  return { ctx, ops };
}

/** Marcadores de identidad: el aserto distingue fuentes por REFERENCIA, no por forma. */
const ATLAS = { marca: "atlas" } as unknown as CanvasImageSource;
const BUF = { marca: "transit-buf" } as unknown as HTMLCanvasElement;
const T0 = 100_000; // reloj de pared sembrado; los offsets de cada aserto van en crudo

/**
 * Piel con los privados sembrados para entrar a `render()` por la rama del transit:
 * ctx registrador + font/atlas/view de mentira + `transit` a mitad de cierre (stage 8).
 * `now` se clava por instancia (la propiedad tapa al método del prototipo).
 */
function makeSkinEnTransit(nowMs: number): { skin: FaithfulSkin; ops: Op[] } {
  const skin = new FaithfulSkin();
  const priv = skin as unknown as Record<string, unknown>;
  const { ctx, ops } = ctxRegistrador();
  priv.ctx = ctx;
  priv.font = { marca: "font" };
  priv.atlas = ATLAS;
  priv.view = { snapshot: () => ({}) }; // la rama del transit NO llega al snapshot
  priv.transit = { buf: BUF, stage: 8, hold: 0 };
  priv.now = () => nowMs;
  return { skin, ops };
}

function render(skin: FaithfulSkin): void {
  (skin as unknown as { render: () => void }).render();
}

function pushFx(skin: FaithfulSkin, fx: Record<string, unknown>, t0: number): void {
  (
    skin as unknown as {
      worldFx: { push: (fx: unknown, t0: number) => void; active: boolean };
    }
  ).worldFx.push(fx, t0);
}

describe("#359 — worldFx sobre el frame congelado del transit", () => {
  it("la RÁFAGA (#201) se blitea durante el cruce, ENCIMA del frame congelado", () => {
    // Explosión en la celda (dx=2, dy=1) respecto al grupo, arrancada 10 ms antes del
    // frame: afterPause=10 → idx=0 (par) → blit del tile Explosion (0).
    const { skin, ops } = makeSkinEnTransit(T0 + 10);
    pushFx(skin, { kind: "cellExplosion", dx: 2, dy: 1, bursts: 7, preDelayUnits: 0 }, T0);
    render(skin);

    // EN CRUDO: viewport x=y=8, tile 16, centro de la ventana 11×11 = celda 5 →
    // destino (8+(5+2)·16, 8+(5+1)·16) = (120, 104); tile 0 → recorte fuente (0,0,16,16).
    const idxExplosion = ops.findIndex(
      (o) =>
        o.op === "drawImage" &&
        o.args[0] === ATLAS &&
        o.args[1] === 0 &&
        o.args[2] === 0 &&
        o.args[3] === 16 &&
        o.args[4] === 16 &&
        o.args[5] === 120 &&
        o.args[6] === 104,
    );
    expect(idxExplosion, "la ráfaga no se blitea durante el transit (#359)").toBeGreaterThan(-1);

    // ORDEN: la ráfaga cae ENCIMA del frame congelado, no debajo — el blit del buffer
    // del transit (drawImage(buf, 0, 0)) tiene que ir ANTES.
    const idxBuf = ops.findIndex((o) => o.op === "drawImage" && o.args[0] === BUF);
    expect(idxBuf, "paintTransit no blitea el frame congelado").toBeGreaterThan(-1);
    expect(idxExplosion).toBeGreaterThan(idxBuf);
  });

  it("el CAÑONAZO (#313) también: punto blanco 4×4 interpolado, sobre el frame congelado", () => {
    // Vuelo (0,0)→(3,0): duración 3·55 = 165 ms; a t0+82.5 va por la mitad → dx=1.5 →
    // col 6.5 → fillRect(8 + 6.5·16 + (16−4)/2, 8 + 5·16 + 6, 4, 4) = (118, 94, 4, 4).
    const { skin, ops } = makeSkinEnTransit(T0 + 82.5);
    pushFx(skin, { kind: "cellProjectile", fromDx: 0, fromDy: 0, toDx: 3, toDy: 0 }, T0);
    render(skin);

    const dot = ops.find(
      (o) =>
        o.op === "fillRect" &&
        o.fillStyle === "#ffffff" &&
        o.args[0] === 118 &&
        o.args[1] === 94 &&
        o.args[2] === 4 &&
        o.args[3] === 4,
    );
    expect(dot, "el cañonazo no se pinta durante el transit (#359)").toBeDefined();
  });

  it("★ control positivo del instrumento: SIN fx vivo, ese blit NO aparece", () => {
    // Cierra la vía del falso verde por registrador promiscuo: si el aserto de arriba
    // pasara también sin fx, no estaría midiendo el pintado sino el arnés.
    const { skin, ops } = makeSkinEnTransit(T0 + 10);
    render(skin);
    const fantasma = ops.find(
      (o) => o.op === "drawImage" && o.args[0] === ATLAS && o.args[5] === 120 && o.args[6] === 104,
    );
    expect(fantasma).toBeUndefined();
    // …y el transit en sí SÍ pintó (el arnés entra por la rama que dice entrar).
    expect(ops.some((o) => o.op === "drawImage" && o.args[0] === BUF)).toBe(true);
  });

  it("CANDADO: los literales de estos asertos siguen casando con las constantes del sujeto", () => {
    // Los esperados van EN CRUDO arriba; este candado impide que un cambio de geometría
    // los deje midiendo a un fantasma (la trampa del esperado-derivado, al revés).
    const frame = leer("src/skin/fiel/frame.ts");
    expect(frame).toContain("export const VIEWPORT = { x: 8, y: 8, tile: 16, tiles: 11 }");
    const wfx = leer("src/skin/world-fx.ts");
    expect(wfx).toContain("export const EXPLOSION_TILE = 0");
    expect(wfx).toContain("export const PROJECTILE_MS_PER_CELL_BORROWED = 55");
    expect(wfx).toContain("export const PROJECTILE_DOT_PX = 4");
    expect(wfx).toContain('export const PROJECTILE_DOT_COLOR = "#ffffff"');
    expect(wfx).toContain("export const EXPLOSION_BURST_MS = 60");
    const api = leer("src/skin/api.ts");
    expect(api).toContain("export const VIEW_WINDOW = 11");
  });
});
