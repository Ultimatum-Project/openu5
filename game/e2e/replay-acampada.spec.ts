/**
 * E2E — EL PEOR CASO del carril: una grabación que ATRAVIESA una acampada.
 *
 * La acampada (H)ole up es la única pieza de la partida que corre a RELOJ DE PARED de
 * verdad: `CampSleep` avanza una hora cada 360 ms con `setTimeout`, y mientras dura,
 * `handleGameKey` se traga TODO el input. Es exactamente donde el diseño «se indexa por
 * turno, no por reloj» se rompería si estuviera mal:
 *
 *  1. Al GRABAR, las teclas que el jugador pulsa mientras la party duerme no hacen nada.
 *     Si el grabador se las quedara, al reproducir se ejecutarían — porque para entonces
 *     la escena que las tragaba ya habría terminado — y la partida divergiría. Es el
 *     testigo vivo del `keyRec.drop()` de las escenas modales, que hasta ahora sólo lo
 *     tenían las teclas de shell y el panel DOM abierto (herencia de mecanismo, no
 *     medición).
 *  2. Al REPRODUCIR, la tecla que viene DESPUÉS de la acampada tiene que ESPERAR a que
 *     la party despierte. El reproductor pregunta `ready()` antes de cada tecla; sin esa
 *     espera, reproducir a 8× entregaría la tecla dentro del sueño, se la tragaría el
 *     mismo guarda, y se perdería.
 *
 * (76,40) es terreno acampable; (82,108) —el del resto de specs— es agua y el comando
 * rebota con "On land or ship!".
 */
import { test, expect, type Page } from "@playwright/test";

const CANVAS = ".faithful-skin canvas";
const GAME_URL = "/?skin=faithful&nointro&loc=0&x=76&y=40&seed=1234";

/** 8 h × 360 ms/h ≈ 2,9 s de escena. Se espera con holgura. */
const CAMP_MS = 6000;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Log = any;

async function boot(page: Page): Promise<void> {
  await page.addInitScript(() => localStorage.clear());
  await page.goto(GAME_URL);
  await expect(page.locator(CANVAS)).toBeVisible({ timeout: 30_000 });
  await page.waitForFunction(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    () => Boolean((window as any).__u5test?.replay),
    undefined,
    { timeout: 30_000 },
  );
}

const fingerprint = (page: Page): Promise<string> =>
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  page.evaluate(() => (window as any).__u5test.replay.fingerprint() as string);

const consoleLines = (page: Page): Promise<string[]> =>
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  page.evaluate(() => ((window as any).__u5test.consoleLines?.() ?? []) as string[]);

/**
 * Graba una partida que acampa. Devuelve el registro, la trayectoria de las teclas que
 * SÍ contaron, y cuántas se pulsaron durante el sueño.
 */
async function recordWithCamp(page: Page): Promise<{
  log: Log;
  trace: string[];
  asleepPresses: number;
  final: string;
}> {
  await boot(page);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await page.evaluate(() => (window as any).__u5test.replay.startRec());
  const trace: string[] = [];
  const press = async (k: string): Promise<void> => {
    await page.locator("body").press(k);
    await page.waitForTimeout(40);
    trace.push(await fingerprint(page));
  };

  await press("ArrowRight");
  await press("h"); // "Hole up & camp!" → "For how many hours? (1-9)"
  await press("8"); // ocho horas
  await press("n"); // sin vigía → arranca el sueño AQUÍ

  // ── la party duerme: estas teclas NO son de la partida ──────────────────────
  const asleepPresses = 6;
  for (let i = 0; i < asleepPresses; i++) {
    await page.locator("body").press(i % 2 ? "ArrowUp" : "l");
    await page.waitForTimeout(150);
  }
  await page.waitForTimeout(CAMP_MS);
  expect(
    (await consoleLines(page)).join(" "),
    "la acampada tiene que haber terminado para que el test signifique algo",
  ).toMatch(/rested|Ambushed|Zzzz/i);

  await press("ArrowDown");
  await press("ArrowLeft");

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const log = await page.evaluate(() => (window as any).__u5test.replay.stopRec("acampada"));
  return { log, trace, asleepPresses, final: await fingerprint(page) };
}

/**
 * Reproduce tecla a tecla. `step()` es un no-op mientras el juego no acepta input, así
 * que se reintenta hasta que el índice avanza: eso es precisamente la ESPERA que el
 * reproductor hace por su cuenta con `play()`, aquí hecha explícita para poder tomar la
 * huella justo después de cada tecla.
 */
async function replayStepwise(page: Page, log: Log): Promise<{ trace: string[]; final: string }> {
  await boot(page);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await page.evaluate((l) => (window as any).__u5test.replay.load(l), log);
  const trace: string[] = [];
  for (let i = 0; i < (log.count as number); i++) {
    await expect
      .poll(
        async () =>
          page.evaluate(() => {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const r = (window as any).__u5test.replay;
            r.step(); // no-op si hay una escena modal viva
            return r.status().index as number;
          }),
        { timeout: 20_000, intervals: [50] },
      )
      .toBe(i + 1);
    trace.push(await fingerprint(page));
  }
  return { trace, final: await fingerprint(page) };
}

test.describe("registro de teclas — a través de una ACAMPADA", () => {
  test("🔴 las teclas pulsadas MIENTRAS la party duerme no se graban", async ({ page }) => {
    const rec = await recordWithCamp(page);
    // 6 teclas de juego (ArrowRight, h, 8, n, ArrowDown, ArrowLeft) y ninguna de las
    // que se pulsaron dormido. Si alguna se colara, al reproducir se ejecutaría con la
    // party ya despierta y la partida divergiría.
    expect(rec.log.count).toBe(6);
    expect([...(rec.log.keys as string)]).toEqual([
      "\x04", // ArrowRight
      "h",
      "8",
      "n",
      "\x02", // ArrowDown
      "\x03", // ArrowLeft
    ]);
    expect(rec.asleepPresses).toBe(6); // se pulsaron: el testigo no es vacuo
  });

  test("la ida y vuelta a través de la acampada da la MISMA trayectoria", async ({ page }) => {
    const rec = await recordWithCamp(page);
    const rep = await replayStepwise(page, rec.log);
    for (let i = 0; i < rec.trace.length; i++) {
      expect(rep.trace[i], `divergió en la tecla ${i}`).toBe(rec.trace[i]);
    }
    expect(rep.final).toBe(rec.final);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const st = await page.evaluate(() => (window as any).__u5test.replay.status());
    expect(st.state).not.toBe("diverged");
  });

  test("🔴 a 8×, la tecla de después del sueño ESPERA en vez de perderse", async ({ page }) => {
    const rec = await recordWithCamp(page);

    await boot(page);
    await page.evaluate((l) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const r = (window as any).__u5test.replay;
      r.load(l);
      r.setSpeed(8);
      r.play();
    }, rec.log);
    await expect
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .poll(() => page.evaluate(() => (window as any).__u5test.replay.status().state as string), {
        timeout: 30_000,
      })
      .toBe("ended");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const st = await page.evaluate(() => (window as any).__u5test.replay.status());
    expect(st.index).toBe(rec.log.count); // ninguna tecla se quedó por el camino
    expect(st.state).not.toBe("diverged");
    // La acampada NO se acelera con la velocidad de reproducción (es una escena a
    // reloj de pared, no un turno), y aun así el estado final es el mismo: la prueba
    // de que el índice es el TURNO y no el reloj.
    expect(await fingerprint(page)).toBe(rec.final);
  });
});
