/**
 * #359 + transit-fx clase B (merges 2d2c82da y 3c362070) — los FX del MUNDO se PINTAN
 * también DURANTE el cruce de la moongate. El early-return de la rama `transit` de la
 * piel fiel (fiel/skin.ts render()) se saltaba el pintado de quake/worldFx/apparition/
 * timeFlash: el fx seguía VIVO (fxActive() true) pero la pantalla quedaba QUIETA todo
 * el cruce — por eso el aserto de este spec es de PÍXEL, no de liveness (un aserto de
 * fxActive pasaría igual con el bug).
 *
 * DETECTOR (derivado de la mecánica del quake, fiel/quake.ts + paintQuakeShift): la
 * sacudida re-blitea el viewport 2 px ABAJO en onda cuadrada (42 ms desplazado / 75 ms
 * reposo, 8 pulsos) ⇒ mientras hay quake los píxeles de una franja del viewport
 * CAMBIAN entre frames (el contenido sube y baja); sin quake, el frame del transit es
 * un BUFER CONGELADO (paintTransit blitea siempre el mismo canvas) y la franja es
 * estática. La franja se toma a la IZQUIERDA del centro (x 24..80, y 24..168 del
 * lienzo EGA) para excluir la única animación legítima del transit: el cierre de la
 * puerta sobre el party, que pinta en la celda CENTRAL (px 88..104).
 * ⚠ Un detector de «banda superior negra» NO sirve aquí: es de NOCHE (la puerta lo
 * exige) y el radio de visión deja la orla del viewport SIEMPRE negra — se midió
 * (maxBlack=1 sin quake) y por eso el detector es de CAMBIO, no de color.
 *
 * IDENTIDAD DE FRAME (el aserto es «el cambio ocurre SOBRE el frame congelado del
 * ORIGEN»): el origen (76,40) es pradera — fracción VERDE-dominante > 0.03 en el
 * círculo de visión (techo nocturno medido ~0.07); el destino del teleport es mar
 * abierto (250,120, tile 1), azul-dominante, verde ≈ 0. Si el transit hubiera
 * cerrado antes de muestrear, el verde habría caído y la identidad enrojece.
 *
 * VENTANAS (derivadas): transit = 650 ms de hold + 16×32 ms de cierre ≈ 1.162 ms;
 * quake = 8×117 ≈ 936 ms, empujado NADA MÁS confirmar el teleport ⇒ el quake muere
 * antes que el transit y todo cambio observado cae dentro del cruce. El muestreo
 * corre a rAF DENTRO de un único evaluate (~40 frames ≈ 660 ms): sin carrera de IPC
 * (lección #374: nada de timing fino a través del wire).
 */
import { test, expect } from "@playwright/test";
import type { Page } from "@playwright/test";
import { gotoGame, readState, skinCycleReady } from "./helpers";

interface Pos { x: number; y: number; location: number }

/** Tablero lunar determinista: puerta pisable en (77,40), destino (250,120) mar. */
async function seedGateToSea(page: Page): Promise<void> {
  await page.evaluate(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const s = (window as any).__u5test.state();
    s.feluccaPhase = 0x30;
    s.trammelPhase = 0x33; // hour 22 ⇒ Trammel = fase 3
    s.moonstones[0] = { x: 77, y: 40, z: 0, location: 0, buried: true };
    s.moonstones[3] = { x: 250, y: 120, z: 0, location: 0, buried: true };
  });
}

/**
 * Muestrea el lienzo a rAF durante `frames` cuadros. Devuelve:
 *  - changedFrames: nº de muestras cuya FRANJA (izquierda del centro) difiere de la
 *    primera muestra (>0.5% de px con delta de canal >24) — el pulso del quake.
 *  - maxGreen: máxima fracción verde-dominante del viewport (identidad de origen).
 */
async function sampleViewport(page: Page, frames: number): Promise<{ changedFrames: number; maxGreen: number }> {
  return page.evaluate(async (nFrames) => {
    const cs = [...document.querySelectorAll("canvas")].filter(
      (cv) => document.contains(cv) && cv.getClientRects().length > 0,
    );
    cs.sort((a, b) => b.width * b.height - a.width * a.height);
    const cv = cs[0]!;
    const ctx = cv.getContext("2d")!;
    const s = cv.width / 320;
    const vx = Math.round(8 * s);
    const vy = Math.round(8 * s);
    const vw = Math.round(176 * s);
    const vh = Math.round(176 * s);
    // Franja: x 24..80, y 24..168 (px EGA) — dentro del viewport, fuera de la celda
    // central (px 88..104), donde anima el cierre de la puerta del transit.
    const fx = Math.round(24 * s);
    const fy = Math.round(24 * s);
    const fw = Math.round(56 * s);
    const fh = Math.round(144 * s);
    let base: Uint8ClampedArray | null = null;
    let changedFrames = 0;
    let maxGreen = 0;
    for (let f = 0; f < nFrames; f++) {
      await new Promise((r) => requestAnimationFrame(r));
      const strip = ctx.getImageData(fx, fy, fw, fh).data;
      if (base === null) {
        base = strip.slice();
      } else {
        let diff = 0;
        for (let i = 0; i < strip.length; i += 4) {
          if (
            Math.abs(strip[i]! - base[i]!) > 24 ||
            Math.abs(strip[i + 1]! - base[i + 1]!) > 24 ||
            Math.abs(strip[i + 2]! - base[i + 2]!) > 24
          ) {
            diff++;
            if (diff > strip.length / 4 / 200) break; // 0.5%: ya cuenta como cambio
          }
        }
        if (diff > strip.length / 4 / 200) changedFrames++;
      }
      // Identidad de origen: verde-dominante en el viewport (muestreo 1 de cada 4 px).
      const view = ctx.getImageData(vx, vy, vw, vh).data;
      let green = 0;
      let counted = 0;
      for (let i = 0; i < view.length; i += 16) {
        counted++;
        const r = view[i]!;
        const g = view[i + 1]!;
        const b = view[i + 2]!;
        if (g > 40 && g > r + 10 && g > b + 10) green++;
      }
      maxGreen = Math.max(maxGreen, green / counted);
    }
    return { changedFrames, maxGreen };
  }, frames);
}

/** Pisa la puerta (arranca el transit + teleporta) y verifica el teleport en crudo. */
async function stepThroughGate(page: Page): Promise<void> {
  await page.keyboard.press("ArrowRight");
  await expect.poll(async () => (await readState<Pos>(page, "position")).x).toBe(250);
  expect((await readState<Pos>(page, "position")).y).toBe(120);
}

test("#359 · el quake se PINTA sobre el frame congelado del transit (la franja pulsa + identidad de origen)", async ({ page }) => {
  test.setTimeout(45_000);
  await gotoGame(page, { loc: 0, x: 76, y: 40, hour: 22, seed: 1234 });
  await skinCycleReady(page);
  await seedGateToSea(page);

  // CONTROL POSITIVO del detector en la MISMA corrida, ANTES del cruce (patrón de
  // shrine-quake-camino-373): un quake por el camino normal (sin transit) debe hacer
  // pulsar la franja sobre la pradera. Si esto no lo ve, el instrumento está roto y
  // el aserto del transit no significaría nada.
  await page.evaluate(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as any).__u5test.applyEvents([{ kind: "quake" }]);
  });
  const control = await sampleViewport(page, 40); // ~660 ms ≥ 5 pulsos
  expect(control.changedFrames, `control positivo: changed=${control.changedFrames} maxGreen=${control.maxGreen}`).toBeGreaterThanOrEqual(3);
  // Deja morir la sacudida del control (8×117 ≈ 936 ms) antes de armar la del aserto.
  await expect
    .poll(() => page.evaluate(() =>
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (window as any).__u5test.fxActive()), { timeout: 5_000 })
    .toBe(false);

  // EL ASERTO #359: pisa la puerta (transit ≈ 1.162 ms) y empuja el quake YA MISMO;
  // el muestreo (~660 ms) cae entero dentro del cruce y del quake.
  await stepThroughGate(page);
  await page.evaluate(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as any).__u5test.applyEvents([{ kind: "quake" }]);
  });
  const v = await sampleViewport(page, 40);
  // Pre-fix: el early-return del transit no pintaba el shift → la franja del frame
  // congelado no pulsa jamás (changedFrames=0).
  expect(v.changedFrames, `changed=${v.changedFrames} maxGreen=${v.maxGreen}`).toBeGreaterThanOrEqual(3);
  // Identidad: lo muestreado era el frame del ORIGEN (pradera), no el mar del destino.
  expect(v.maxGreen).toBeGreaterThan(0.03);
});

test("#359 · negativo: el transit SIN quake es un frame congelado — la franja no pulsa (el detector no dispara solo)", async ({ page }) => {
  await gotoGame(page, { loc: 0, x: 76, y: 40, hour: 22, seed: 1234 });
  await skinCycleReady(page);
  await seedGateToSea(page);

  await stepThroughGate(page);
  const v = await sampleViewport(page, 40);
  expect(v.changedFrames, `changed=${v.changedFrames} maxGreen=${v.maxGreen}`).toBe(0);
  expect(v.maxGreen).toBeGreaterThan(0.03); // el frame congelado del origen SÍ se vio
});
