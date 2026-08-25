/**
 * #295 — LA PRIMITIVA COMPARTIDA DEL RECTÁNGULO INTERIOR DE LA VENTANA.
 *
 * El negativo NO es un efecto del santuario: es una primitiva con disparadores como casos
 * (censo del espejo con rótulo leído de consola: WELL DONE ×6 · CAST de hechizo ×7 · Codex
 * ×1 — `re/notes/espejo-barrido-2.md`). Y comparte GEOMETRÍA con el apagón del sueño
 * (#296, carril efectos-mundo): el rect que el binario escribe `rect(8,8,0xb7,0xb7)`.
 *
 * LO QUE SELLA ESTE FICHERO es el punto donde esa geometría se copia MAL, que no es una
 * hipótesis sino la forma del dato: el binario da ESQUINAS INCLUSIVAS (0xb7 = 183) y
 * `fillRect` quiere ORIGEN+TAMAÑO (176). Quien pase `0xb7` como `w` pinta 7 px de más y se
 * come el separador de x=185..191; quien derive `w` y lo carea contra `0xb7` creerá que no
 * cuadra. Los dos errores son invisibles en un test que sólo mire una de las dos lecturas,
 * así que aquí se miran LAS DOS y se exige que `x2/y2` se CALCULEN de `VIEWPORT`.
 *
 * MUTANTES (CORRIDOS, y uno de los dos NO murió — se deja escrito porque el límite importa):
 *   · M1 `w/h: 0xb7` (la esquina inclusiva copiada como TAMAÑO, el error que esta guarda
 *     existe para cazar) → **MATA 3 de los 8**. Es el mutante que justifica la línea.
 *   · M2 `x2/y2: 183` literal en vez de derivado de `VIEWPORT` → **SOBREVIVE. Los 8 verdes.**
 *     🔴 Y es un límite REAL, no un descuido que se pueda tapar añadiendo asertos: hoy el
 *     literal 183 y la derivación `8 + 11*16 − 1` VALEN LO MISMO, así que ninguna
 *     comprobación de VALOR puede separarlos — daría igual cuántas escribiera. Separarlos
 *     exigiría que la geometría fuese una FUNCIÓN de un viewport parametrizable, y eso es
 *     maquinaria que hoy no tiene ningún consumidor: no se construye por el test.
 *     ⇒ La derivación se sostiene por LECTURA (el docblock de `frame.ts` la explica), no por
 *     esta guarda. Lo que la guarda sí sostiene es que los valores sean los correctos y
 *     mutuamente consistentes — que es donde muerde el error de verdad (M1).
 *     Este párrafo decía que M2 caía «porque el aserto mueve VIEWPORT.tiles». Era una
 *     PREDICCIÓN escrita antes de correrlo, y al correrlo salió falsa.
 */
import { describe, it, expect } from "vitest";
import { VIEWPORT, VIEWPORT_INTERIOR, invertViewportInterior } from "../src/skin/fiel/frame.js";

describe("#295 — VIEWPORT_INTERIOR: las dos lecturas del mismo rect", () => {
  it("el TAMAÑO es 176 = 11 tiles × 16 px (no la esquina inclusiva del binario)", () => {
    expect(VIEWPORT_INTERIOR.w).toBe(176);
    expect(VIEWPORT_INTERIOR.h).toBe(176);
    expect(VIEWPORT_INTERIOR.w, "control independiente: la rejilla y el rect hablan de lo mismo")
      .toBe(VIEWPORT.tiles * VIEWPORT.tile);
  });

  it("la ESQUINA INCLUSIVA es 0xb7, que es como lo escribe el binario (rect 8,8,0xb7,0xb7)", () => {
    expect(VIEWPORT_INTERIOR.x2).toBe(0xb7);
    expect(VIEWPORT_INTERIOR.y2).toBe(0xb7);
    expect(VIEWPORT_INTERIOR.x, "y el origen es el 8,8 del binario").toBe(8);
    expect(VIEWPORT_INTERIOR.y).toBe(8);
  });

  it("las dos lecturas son CONSISTENTES: x2 = x + w − 1 (el 1 que se pierde al copiar)", () => {
    expect(VIEWPORT_INTERIOR.x2).toBe(VIEWPORT_INTERIOR.x + VIEWPORT_INTERIOR.w - 1);
    expect(VIEWPORT_INTERIOR.y2).toBe(VIEWPORT_INTERIOR.y + VIEWPORT_INTERIOR.h - 1);
  });

  it("NO invade el separador de x=185..191 (0xb9..0xbf), que el original deja intacto", () => {
    expect(VIEWPORT_INTERIOR.x2).toBeLessThan(0xb9);
  });
});

describe("#295 — invertViewportInterior pinta el interior y NADA más", () => {
  /**
   * `ctx` de mentira: apunta el rect pedido y el modo de composición vigente al pedirlo.
   *
   * 🔴 `save`/`restore` implementan la PILA DE ESTADO DE VERDAD, no un contador. La primera
   * versión de este espía sólo contaba las llamadas, y el aserto de «no contamina lo que se
   * pinte después» salió ROJO **contra código correcto**: era el INSTRUMENTO el que no
   * restauraba nada. Un doble que no modela la semántica que el aserto interroga no prueba
   * la propiedad — la finge en un sentido o la niega en el otro, y aquí la negó.
   */
  function ctxEspia(): {
    ctx: CanvasRenderingContext2D;
    llamadas: { x: number; y: number; w: number; h: number; op: string; fill: string }[];
    saves: number;
    restores: number;
  } {
    const llamadas: { x: number; y: number; w: number; h: number; op: string; fill: string }[] = [];
    const pila: { op: string; fill: string }[] = [];
    let saves = 0;
    let restores = 0;
    const fake = {
      globalCompositeOperation: "source-over",
      fillStyle: "#000000",
      save() {
        saves++;
        pila.push({
          op: String(fake.globalCompositeOperation),
          fill: String(fake.fillStyle),
        });
      },
      restore() {
        restores++;
        const previo = pila.pop();
        if (previo) {
          fake.globalCompositeOperation = previo.op;
          fake.fillStyle = previo.fill;
        }
      },
      fillRect(x: number, y: number, w: number, h: number) {
        llamadas.push({
          x, y, w, h,
          op: String(fake.globalCompositeOperation),
          fill: String(fake.fillStyle),
        });
      },
    };
    return {
      ctx: fake as unknown as CanvasRenderingContext2D,
      llamadas,
      get saves() { return saves; },
      get restores() { return restores; },
    };
  }

  it("CONTROL DEL ESPÍA: su save/restore restaura de verdad (si no, el aserto de abajo es vacuo)", () => {
    const e = ctxEspia();
    e.ctx.globalCompositeOperation = "lighter";
    e.ctx.save();
    e.ctx.globalCompositeOperation = "difference";
    e.ctx.restore();
    expect(e.ctx.globalCompositeOperation, "el doble modela la pila, no la finge").toBe("lighter");
  });

  it("un solo fillRect, exactamente sobre (8,8,176,176)", () => {
    const e = ctxEspia();
    invertViewportInterior(e.ctx);
    expect(e.llamadas).toHaveLength(1);
    expect(e.llamadas[0]).toMatchObject({ x: 8, y: 8, w: 176, h: 176 });
  });

  it("el gesto es `difference` con BLANCO — el equivalente de XOR 15 sobre la paleta EGA", () => {
    const e = ctxEspia();
    invertViewportInterior(e.ctx);
    expect(e.llamadas[0]!.op).toBe("difference");
    expect(e.llamadas[0]!.fill).toBe("#ffffff");
  });

  it("deja el ctx COMO ESTABA (save/restore emparejados): no contamina lo que se pinte después", () => {
    const e = ctxEspia();
    invertViewportInterior(e.ctx);
    expect(e.saves).toBe(1);
    expect(e.restores).toBe(1);
    expect(e.ctx.globalCompositeOperation, "el modo vive dentro del save/restore").not.toBe("difference");
  });
});
