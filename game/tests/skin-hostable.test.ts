/**
 * ALOJAMIENTO DE PIELES (LOTE C: smooth × layout partido) — los DOS bloqueos que el
 * diagnóstico `re/notes/diagnostico-smooth-portrait.md` midió, convertidos en guardas.
 *
 * Antes del lote, «shader + partido» era imposible POR CONSTRUCCIÓN, y este fichero fija
 * en aritmética las dos razones (ninguna de las dos era una decisión de producto):
 *
 *  1. SUPERFICIE (§2.2). `PortraitSkin` consume CINCO miembros del alojado. `FaithfulSkin`
 *     los publica desde siempre; `ShaderSkin` los tenía en su fiel interna SIN reexportar,
 *     así que no podía ser alojada. Aquí se comprueba que ahora los publica **y que
 *     delegan de verdad** — un getter que devolviera una constante pasaría un `typeof`.
 *
 *  2. ESCALA (§3, probe3). Alojada en el host 0×0 del envoltorio, la shader medía su
 *     contenedor, obtenía 0, caía al `|| SCREEN_W` del llamador y resolvía ×1: backbuffer
 *     320×200 y **cero suavizado**. El CONTROL POSITIVO de este fichero es exactamente esa
 *     medida — se afirma que sin anfitrión el 0×0 SIGUE dando 1 (o sea, que el arreglo no
 *     es «ahora todo da 3») y que con anfitrión da lo que el anfitrión pide.
 *
 * Sin DOM: `shaderScale` es puro, y las clases se construyen en node (sus
 * field-initializers están guardados para entorno sin DOM, igual que en skin-lifecycle).
 */
import { describe, expect, it } from "vitest";
import { FaithfulSkin } from "../src/skin/fiel/skin.js";
import { ShaderSkin, shaderCanvasSize, shaderScale } from "../src/skin/shader/skin.js";
import type { HostableSkin } from "../src/skin/hostable.js";

/** Los cinco miembros de la tabla del §2.2 del diagnóstico. */
const CINCO = [
  "consoleScrollActive",
  "sourceFrameGen",
  "panelListOpen",
  "consoleScrollLines",
  "panelScrollLines",
] as const;

describe("HostableSkin — superficie que el envoltorio consume del alojado (§2.2)", () => {
  it("FaithfulSkin la satisface TAL CUAL (por eso skin/fiel/ no se toca en este lote)", () => {
    const f = new FaithfulSkin();
    // Asignación estructural: si faltara un miembro, esto no compila (`tsc` es el gate).
    const h: HostableSkin = f;
    expect(typeof h.consoleScrollActive).toBe("boolean");
    expect(typeof h.panelListOpen).toBe("boolean");
    expect(typeof h.sourceFrameGen).toBe("number");
    expect(typeof h.consoleScrollLines).toBe("function");
    expect(typeof h.panelScrollLines).toBe("function");
  });

  it("ShaderSkin publica los CINCO (era el bloqueo (a): los tenía sin reexportar)", () => {
    const s = new ShaderSkin();
    const h: HostableSkin = s;
    for (const k of CINCO) {
      expect(k in (s as unknown as Record<string, unknown>), `falta ${k}`).toBe(true);
    }
    expect(typeof h.consoleScrollActive).toBe("boolean");
    expect(typeof h.panelListOpen).toBe("boolean");
    expect(typeof h.sourceFrameGen).toBe("number");
  });

  it("los passthrough DELEGAN en la fiel interna (no son constantes que engañen al typeof)", () => {
    const s = new ShaderSkin();
    // La fiel interna es privada; se alcanza por índice (mismo recurso que skin-lifecycle
    // usa para inspeccionar estado post-unmount: `private` es sólo de compilación).
    const interna = (s as unknown as Record<string, unknown>).faithful as Record<string, unknown>;
    const vistos: [string, number][] = [];
    interna.consoleScrollLines = (d: number) => vistos.push(["console", d]);
    interna.panelScrollLines = (d: number) => vistos.push(["panel", d]);
    Object.defineProperty(interna, "consoleScrollActive", { get: () => true, configurable: true });
    Object.defineProperty(interna, "panelListOpen", { get: () => true, configurable: true });

    s.consoleScrollLines(-3);
    s.panelScrollLines(7);
    expect(vistos).toEqual([
      ["console", -3],
      ["panel", 7],
    ]);
    expect(s.consoleScrollActive).toBe(true);
    expect(s.panelListOpen).toBe(true);
  });

  it("`sourceFrameGen` de la shader NO delega: es SU contador de presents compuestos", () => {
    // Delegar en la fiel se saltaría justo los frames del scroll suave / tweens de actores
    // (la fuente que el anfitrión lee es el canvas de la shader, que muta más a menudo).
    const s = new ShaderSkin();
    const stats = (s as unknown as Record<string, unknown>).presentStats as { painted: number };
    expect(s.sourceFrameGen).toBe(stats.painted);
    stats.painted = 42;
    expect(s.sourceFrameGen).toBe(42);
    // …y de paso: no está leyendo el de la fiel.
    const interna = (s as unknown as Record<string, unknown>).faithful as Record<string, unknown>;
    Object.defineProperty(interna, "sourceFrameGen", { get: () => 999, configurable: true });
    expect(s.sourceFrameGen).toBe(42);
  });
});

describe("shaderScale — el bloqueo (b): el host oculto mide 0 (§3, probe3)", () => {
  // CONTROL POSITIVO: la medida que hizo el diagnóstico, tal cual. Si esta aserción
  // dejara de valer, el arreglo de abajo no probaría nada (estaríamos midiendo otra cosa).
  it("SIN anfitrión, un contenedor 0×0 sigue colapsando a ×1 = cero suavizado", () => {
    // `availW/availH` llegan como 0 → el llamador aplica `|| SCREEN_W` = 320 → ceil(1) = 1.
    expect(shaderScale(320, 200, 1, true, null)).toBe(1);
    expect(shaderCanvasSize(shaderScale(320, 200, 1, true, null))).toEqual({
      width: 320,
      height: 200,
    });
  });

  it("CON anfitrión, manda la escala impuesta (y el backbuffer la sigue)", () => {
    expect(shaderScale(320, 200, 1, true, 3)).toBe(3);
    expect(shaderCanvasSize(3)).toEqual({ width: 960, height: 600 });
    // La impuesta gana también sobre una medida legítima: el anfitrión sabe a qué tamaño
    // va a pintar cada región; el contenedor de la piel alojada no pinta nada.
    expect(shaderScale(1920, 1200, 1, false, 2)).toBe(2);
  });

  it("sin anfitrión NO cambia nada de lo de antes (móvil ceil, escritorio round)", () => {
    expect(shaderScale(393, 852, 1, true, null)).toBe(2); // iPhone 15 vertical: ×2, como se midió
    expect(shaderScale(1920, 1200, 1, false, null)).toBe(6); // escritorio: escala entera exacta
  });

  it("la escala impuesta se acota a entero ≥ 1 (una fraccionaria rompería el blit)", () => {
    expect(shaderScale(0, 0, 1, true, 2.9)).toBe(2);
    expect(shaderScale(0, 0, 1, true, 0)).toBe(1);
    expect(shaderScale(0, 0, 1, true, -5)).toBe(1);
  });
});

describe("ShaderSkin.setHostedScale / hostedSource", () => {
  it("sin canvas montado, `hostedSource()` es null (contrato: el anfitrión decide)", () => {
    expect(new ShaderSkin().hostedSource()).toBeNull();
  });

  it("`setHostedScale` guarda la escala y `unmount` la SUELTA", () => {
    const s = new ShaderSkin();
    const priv = s as unknown as Record<string, unknown>;
    s.setHostedScale(4);
    expect(priv.hostedScale).toBe(4);
    // Al salir del layout partido esta MISMA instancia se monta como piel de primera
    // clase: si la escala impuesta sobreviviera, se quedaría pegada la del anfitrión.
    s.unmount();
    expect(priv.hostedScale).toBeNull();
  });

  it("`setHostedScale` re-dispara el resize (el backbuffer tiene que seguirla)", () => {
    const s = new ShaderSkin();
    const priv = s as unknown as Record<string, unknown>;
    let resizes = 0;
    priv.resizeHandler = () => {
      resizes++;
    };
    s.setHostedScale(3);
    expect(resizes).toBe(1);
    s.setHostedScale(3); // misma escala: no re-dispara (el resize rehace el chrome vectorial)
    expect(resizes).toBe(1);
    s.setHostedScale(null);
    expect(resizes).toBe(2);
  });
});
