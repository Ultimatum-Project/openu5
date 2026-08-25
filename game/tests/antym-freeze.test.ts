/**
 * AN TYM CONGELA EL RELOJ DE TERRENO (#177).
 *
 * El original no gatea el reloj maestro de terreno (`0x44b8`) en sí mismo: lo gatea su
 * CALLER. `viewport_redraw` CS 0x5910 apaga el latch `[0x5891]` en su cabecera cuando
 * `g_time_spell == 0x54` ('T') y salta por encima de `0x5941 call 0x4552` —cuya cola es
 * la única llamadora de `0x44b8`— y, en la cola, de `0x5a1a call 0x4102` (ambiente).
 *
 * Ese nivel de indirección es exactamente lo que mantuvo el hueco sellado: la nota
 * `antim-freeze.md` §2 miró el cuerpo de `0x4552`, no encontró ningún `cmp g_time_spell`,
 * y concluyó EN NEGRITA que «el terreno NO se congela». La conclusión era falsa y era la
 * que autorizaba que el port no lo implementara.
 *
 * Arnés: el mismo de `skin-lifecycle.test.ts` — la clase real se construye en node (sus
 * field-initializers están guardados para entorno sin DOM) y los campos privados se
 * siembran por índice (`private` de TS es sólo de compilación). No se llama a `mount`.
 */
import { describe, expect, it } from "vitest";
import { FaithfulSkin } from "../src/skin/fiel/skin.js";
import type { CoreView } from "../src/skin/api.js";

/** Tick base del reloj de animación (ANIM_TICK_MS en skin.ts). Se declara como
 *  LITERAL y se ancla aparte contra el módulo, para que un cambio de la constante
 *  rompa por ASERCIÓN y no por un test que silenciosamente deja de ejercitar nada
 *  (la trampa del import de `failing-first`). */
const TICK_MS = 55;

/** Piel con `view` sembrado: sólo `snapshot().timeStopped` es relevante aquí. */
function makeSkin(timeStopped: boolean): FaithfulSkin {
  const skin = new FaithfulSkin();
  (skin as unknown as Record<string, unknown>).view = makeView(timeStopped);
  return skin;
}

/** `ambientSfx` hace falta porque la rama NO congelada llega a `tickAmbient` (0x4102):
 *  sin él el control positivo peta por TypeError en vez de medir la fase. */
function makeView(timeStopped: boolean): CoreView {
  return {
    snapshot: () => ({ timeStopped }),
    ambientSfx: () => {},
  } as unknown as CoreView;
}

/** Corre el reloj `n` ticks completos y devuelve la fase resultante. */
function runTicks(skin: FaithfulSkin, n: number): number {
  const priv = skin as unknown as Record<string, unknown> & {
    tickAnimClock: () => boolean;
  };
  priv.accum = TICK_MS * n + TICK_MS / 2; // media sobra: no completa un tick de más
  priv.tickAnimClock();
  return skin.animPhase;
}

describe("An Tym congela el reloj de TERRENO (latch [0x5891] en viewport_redraw 0x5910)", () => {
  it("★ SIN el hechizo, la fase de terreno AVANZA un paso por tick", () => {
    // Control positivo: sin esto, el test de abajo pasaría también con un reloj muerto.
    const skin = makeSkin(false);
    expect(skin.animPhase).toBe(0);
    expect(runTicks(skin, 3)).toBe(3);
  });

  it("★ CON el hechizo puesto, la fase de terreno NO avanza (era el hueco de #177)", () => {
    const skin = makeSkin(true);
    expect(runTicks(skin, 3)).toBe(0);
  });

  it("el acumulador se DRENA congelado: al expirar no hay ráfaga de frames atrasados", () => {
    // Es la diferencia entre «no llamar» (original) y «aplazar la llamada». Si el
    // acumulador no se drenase, esta fase saltaría de golpe al descongelar.
    const skin = makeSkin(true);
    runTicks(skin, 4);
    const priv = skin as unknown as Record<string, unknown>;
    expect(priv.accum as number).toBeLessThan(TICK_MS);

    // Descongelar y correr UN tick: avanza exactamente 1, no 5.
    (skin as unknown as { view: CoreView }).view = makeView(false);
    priv.accum = TICK_MS;
    (skin as unknown as { tickAnimClock: () => boolean }).tickAnimClock();
    expect(skin.animPhase).toBe(1);
  });

  it("congelado, el reloj sigue devolviendo `true` (el repintado NO se para)", () => {
    // El original salta las LLAMADAS de animación, pero `viewport_redraw` entero sigue
    // corriendo: la pantalla se repinta (party, consola, sacudidas). Si esto devolviera
    // false, An Tym congelaría de más.
    const skin = makeSkin(true);
    const priv = skin as unknown as Record<string, unknown> & {
      tickAnimClock: () => boolean;
    };
    priv.accum = TICK_MS * 2;
    expect(priv.tickAnimClock()).toBe(true);
  });

  it("CANDADO: el literal TICK_MS de este test sigue casando con ANIM_TICK_MS del módulo", async () => {
    // Sin este candado, si alguien cambia ANIM_TICK_MS los tests de arriba dejarían de
    // completar ticks y pasarían EN FALSO (fase 0 esperada, fase 0 obtenida por no
    // haber corrido nada).
    const src = await import("node:fs/promises").then((fs) =>
      fs.readFile(new URL("../src/skin/fiel/skin.ts", import.meta.url), "utf8"),
    );
    const m = /ANIM_TICK_MS\s*=\s*(\d+)/.exec(src);
    expect(m, "no se encontró ANIM_TICK_MS en skin.ts").not.toBeNull();
    expect(Number(m![1])).toBe(TICK_MS);
  });
});

/**
 * #183 — RESIDUO DE #177: la MOONGATE también se congela.
 *
 * El bloque que el latch `[0x5891]` se salta con An Tym no acaba en el intérprete de
 * animación: `0x5938 je 0x5954` salta por encima de CUATRO llamadas, y las dos últimas
 * son el compositor de ambiente de la moongate y el pulso del faro
 * (`re/disasm/ULTIMA.EXE.asm`, verbatim):
 *
 *     5924: c606915800   mov byte ptr [0x5891], 0   ; camino de An Tym (0x591d cmp 'T')
 *     5933: 803e915800   cmp byte ptr [0x5891], 0
 *     5938: 741a         je 0x5954                  ; ← se salta TODO lo de abajo
 *     5941: e80eec       call 0x4552                ;   intérprete de animación   (#177)
 *     5944: e81bd6       call 0x2f62                ;   maybe_change_wind         (ya gateado)
 *     5947: 803e935880   cmp byte ptr [g_location], 0x80
 *     594c: 7306         jae 0x5954
 *     594e: e809ee       call 0x475a                ; ★ compositor de moongate (anim++/--)
 *     5951: e85217       call 0x70a6                ; ★ pulso del faro
 *
 * `0x475a` es quien sube/baja `g_moongate_anim` (DS 0x5887) — el contador que la piel
 * calca con `moongateStage`. ⇒ bajo An Tym la puerta NO sube ni baja.
 *
 * Lo que este fix NO congela, y por derivación: el CIERRE del cruce
 * (`kernel_moongate_enter` 0x48a8, bucle 0x4912-0x492b) es una secuencia scripted con
 * su propio `delay`, FUERA del bloque saltado ⇒ sigue corriendo. Y el faro (0x70a6) no
 * tiene productor en el port (`world/visibility.ts:52,125` declara el HAZ DEL FARO
 * fuera de alcance): nada que congelar, medido y declarado.
 */
describe("#183 · An Tym congela también la MOONGATE de ambiente (CS 0x475a)", () => {
  /** ms por etapa de ambiente (MOONGATE_STAGE_MS en fiel/moongate.ts). Literal + candado
   *  abajo, por la misma razón que TICK_MS. */
  const STAGE_MS = 32;

  /** Piel con la moongate ACTIVA (anochecer) y la etapa a 0: el rAF debe subirla. */
  function makeGateSkin(timeStopped: boolean): FaithfulSkin {
    const skin = makeSkin(timeStopped);
    const priv = skin as unknown as Record<string, unknown>;
    priv.moongateActive = true;
    priv.moongateStage = 0;
    return skin;
  }

  /** Un frame de rAF de `dtMs`: devuelve si la etapa cambió. */
  function frame(skin: FaithfulSkin, dtMs: number): boolean {
    return (
      skin as unknown as { tickMoongateAmbient: (dt: number) => boolean }
    ).tickMoongateAmbient(dtMs);
  }

  it("★ SIN el hechizo, la etapa de la moongate SUBE (control positivo)", () => {
    const skin = makeGateSkin(false);
    expect(skin.liveMoongateStage).toBe(0);
    expect(frame(skin, STAGE_MS * 3)).toBe(true);
    expect(skin.liveMoongateStage).toBe(3);
  });

  it("★ CON el hechizo puesto, la etapa NO se mueve (residuo declarado por #177)", () => {
    const skin = makeGateSkin(true);
    expect(frame(skin, STAGE_MS * 3)).toBe(false);
    expect(skin.liveMoongateStage).toBe(0);
  });

  it("congelada a MEDIA subida se queda donde estaba, y al expirar reanuda sin salto", () => {
    // El original no aplaza la llamada: la SALTA. Al descongelar la puerta sigue desde
    // la etapa en que se quedó, no da un brinco recuperando el tiempo parado.
    const skin = makeGateSkin(false);
    frame(skin, STAGE_MS * 5);
    expect(skin.liveMoongateStage).toBe(5);

    (skin as unknown as { view: CoreView }).view = makeView(true);
    frame(skin, STAGE_MS * 100);
    expect(skin.liveMoongateStage).toBe(5);

    (skin as unknown as { view: CoreView }).view = makeView(false);
    frame(skin, STAGE_MS * 2);
    expect(skin.liveMoongateStage).toBe(7);
  });

  it("la BAJADA (amanecer) también se congela", () => {
    const skin = makeGateSkin(true);
    const priv = skin as unknown as Record<string, unknown>;
    priv.moongateActive = false;
    priv.moongateStage = 16;
    expect(frame(skin, STAGE_MS * 4)).toBe(false);
    expect(skin.liveMoongateStage).toBe(16);
  });

  it("CANDADO: el literal STAGE_MS sigue casando con MOONGATE_STAGE_MS del módulo", async () => {
    // Si alguien recalibra la cadencia (es Clase C, recalibrable), los tests de arriba
    // dejarían de completar etapas enteras y las igualdades exactas (3, 5, 7, 16)
    // pasarían a comparar floats — o peor, pasarían en falso midiendo un reloj muerto.
    const src = await import("node:fs/promises").then((fs) =>
      fs.readFile(new URL("../src/skin/fiel/moongate.ts", import.meta.url), "utf8"),
    );
    const m = /MOONGATE_STAGE_MS\s*=\s*(\d+)/.exec(src);
    expect(m, "no se encontró MOONGATE_STAGE_MS en fiel/moongate.ts").not.toBeNull();
    expect(Number(m![1])).toBe(STAGE_MS);
  });
});
