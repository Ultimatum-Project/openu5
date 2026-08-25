/**
 * E2E — IDA Y VUELTA del registro de teclas: jugar N teclas ⇒ grabar ⇒ reproducir ⇒
 * ¿mismo estado? Es EL test del carril: todo lo demás (codec, almacén, barra) sólo
 * importa si esto pasa.
 *
 * 🔴 SE COMPARA LA TRAYECTORIA ENTERA, no el estado final. Medido en este mismo repo
 * al calibrar el arnés: alterando UNA tecla, las dos partidas divergían durante 15
 * pasos y volvían a coincidir — misma posición, mismo turno Y MISMA SEMILLA del RNG
 * (el generador es una biyección de 16 bits; desde 898 hacen falta 1 tirada y desde
 * 63364 hacen falta 2 para llegar ambas a 49410, y las órbitas se alinearon). Un test
 * que compare sólo el final habría dado VERDE con una tecla cambiada. Por eso se
 * compara huella a huella, tecla a tecla.
 *
 * La huella es `g_rng_seed | JSON del GameState` — todo el estado observable, no una
 * proyección elegida por el autor del test.
 */
import { test, expect, type Page } from "@playwright/test";

const CANVAS = ".faithful-skin canvas";
const URL = "/?skin=faithful&nointro&loc=0&x=82&y=108&seed=1234";

/**
 * Teclas de la partida grabada. Mezcla deliberada: movimiento (turno + RNG de viento,
 * spawn y wander de NPC), un comando de DOS teclas (Push + dirección), pasos
 * BLOQUEADOS (que tiran del RNG sin cobrar turno) y Look.
 */
const SEQ: readonly string[] = [
  "ArrowRight", "ArrowRight", "ArrowDown", "ArrowDown", "ArrowLeft",
  "ArrowUp", "ArrowRight", "ArrowDown", "ArrowLeft", "ArrowLeft",
  "p", "ArrowDown", "ArrowDown", "ArrowRight", "ArrowRight", "ArrowUp",
  "l", "ArrowUp", "ArrowLeft", "ArrowUp", "ArrowRight", "ArrowDown",
  "ArrowRight", "ArrowRight", "ArrowRight", "ArrowDown", "ArrowDown", "ArrowDown",
  "ArrowLeft", "ArrowLeft", "ArrowUp", "ArrowUp",
];

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Hooks = any;

interface RecordedRun {
  log: Hooks;
  /** Huella del estado tras CADA tecla consumida. */
  trace: string[];
  final: string;
}

async function boot(page: Page): Promise<void> {
  await page.addInitScript(() => localStorage.clear());
  await page.goto(URL);
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

/** Juega `seq` con el TECLADO REAL, grabando. Devuelve el registro y la trayectoria. */
async function playAndRecord(page: Page, seq: readonly string[]): Promise<RecordedRun> {
  await boot(page);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await page.evaluate(() => (window as any).__u5test.replay.startRec());
  const trace: string[] = [];
  for (const k of seq) {
    await page.locator("body").press(k);
    await page.waitForTimeout(25);
    trace.push(await fingerprint(page));
  }
  const final = await fingerprint(page);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const log = await page.evaluate(() => (window as any).__u5test.replay.stopRec("ida-y-vuelta"));
  return { log, trace, final };
}

/**
 * Reproduce `log` tecla a tecla con el MISMO reproductor que usa el usuario y devuelve
 * la trayectoria. `step()` entrega UNA tecla, así que la huella se toma en el mismo
 * sitio que al grabar.
 */
async function replay(page: Page, log: Hooks): Promise<{ trace: string[]; final: string }> {
  await boot(page);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await page.evaluate((l) => (window as any).__u5test.replay.load(l), log);
  const total: number = log.count as number;
  const trace: string[] = [];
  for (let i = 0; i < total; i++) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await page.evaluate(() => (window as any).__u5test.replay.step());
    await page.waitForTimeout(10);
    trace.push(await fingerprint(page));
  }
  const final = await fingerprint(page);
  return { trace, final };
}

/** Primer índice en el que dos trayectorias difieren; -1 si son idénticas. */
function firstDiff(a: readonly string[], b: readonly string[]): number {
  for (let i = 0; i < Math.max(a.length, b.length); i++) if (a[i] !== b[i]) return i;
  return -1;
}

test.describe("registro de teclas — ida y vuelta", () => {
  test("grabar N teclas y reproducirlas da la MISMA trayectoria, huella a huella", async ({
    page,
  }) => {
    const rec = await playAndRecord(page, SEQ);
    expect(rec.log, "el grabador devolvió un registro").toBeTruthy();
    // Toda tecla de SEQ llegó al núcleo: ninguna era de shell ni cayó en escena modal.
    expect(rec.log.count).toBe(SEQ.length);

    const rep = await replay(page, rec.log);
    const i = firstDiff(rec.trace, rep.trace);
    expect(
      i,
      i < 0 ? "" : `divergió en la tecla ${i} ("${SEQ[i]}")\nGRABADO: ${rec.trace[i]?.slice(0, 220)}\nREPETIDO: ${rep.trace[i]?.slice(0, 220)}`,
    ).toBe(-1);
    expect(rep.final).toBe(rec.final);

    // Y el reproductor no cree haber divergido (su suma de control por TURNO).
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const st = await page.evaluate(() => (window as any).__u5test.replay.status());
    expect(st.state).not.toBe("diverged");
    expect(st.index).toBe(rec.log.count);
  });

  test("CONTROL DE SENSIBILIDAD: alterar UNA tecla del registro DEBE divergir", async ({
    page,
  }) => {
    const rec = await playAndRecord(page, SEQ);
    const clean = await replay(page, rec.log);

    // Mutación quirúrgica sobre el stream codificado: la tecla 13 era ArrowRight
    // (código 4 de la tabla NAMED del codec) y pasa a ser ArrowUp (código 1). UN
    // carácter, UNA tecla — el resto del registro, incluida el ANCLA, es byte a byte
    // el mismo, así que lo único que puede explicar una divergencia es esa tecla.
    const mutated = { ...rec.log };
    const chars = [...(rec.log.keys as string)];
    expect(chars[13], "la tecla 13 del registro es ArrowRight").toBe("\x04");
    chars[13] = "\x01";
    mutated.keys = chars.join("");

    const dirty = await replay(page, mutated);
    const i = firstDiff(clean.trace, dirty.trace);
    expect(i, "la repetición alterada NO divergió: el test no está midiendo nada").toBeGreaterThanOrEqual(0);
    expect(i).toBe(13); // diverge EXACTAMENTE en la tecla alterada, no antes
  });

  test("el reloj de pared NO manda: reproducir a 8× da el mismo resultado que a 1×", async ({
    page,
  }) => {
    const rec = await playAndRecord(page, SEQ);
    const slow = await replay(page, rec.log);

    // Ahora por el camino del USUARIO: play() a 8×, con su temporizador real.
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
      .poll(() => page.evaluate(() => (window as any).__u5test.replay.status().state as string))
      .toBe("ended");
    expect(await fingerprint(page)).toBe(slow.final);
  });

  test("saltar (seek) reconstruye el estado exacto de esa tecla", async ({ page }) => {
    const rec = await playAndRecord(page, SEQ);
    const full = await replay(page, rec.log);

    await boot(page);
    await page.evaluate((l) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const r = (window as any).__u5test.replay;
      r.load(l);
      r.seek(20);
    }, rec.log);
    await expect
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .poll(() => page.evaluate(() => (window as any).__u5test.replay.status().index as number))
      .toBe(20);
    expect(await fingerprint(page)).toBe(full.trace[19]);

    // Y REBOBINAR: saltar hacia atrás rehace desde el ancla, no deja residuos.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await page.evaluate(() => (window as any).__u5test.replay.seek(5));
    await expect
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .poll(() => page.evaluate(() => (window as any).__u5test.replay.status().index as number))
      .toBe(5);
    expect(await fingerprint(page)).toBe(full.trace[4]);
  });

  test("TAMAÑO MEDIDO del registro: bytes por tecla y proyección por hora", async ({ page }) => {
    const rec = await playAndRecord(page, SEQ);
    const bytes = await page.evaluate((l) => {
      const enc = new TextEncoder();
      const keys = enc.encode(l.keys as string).length;
      const turns = enc.encode(l.turns as string).length;
      const mods = enc.encode(l.mods as string).length;
      return {
        stream: keys + turns + mods,
        anchor: enc.encode((l.anchor as { state: string }).state).length,
        total: enc.encode(JSON.stringify(l)).length,
        count: l.count as number,
      };
    }, rec.log);
    const perKey = bytes.stream / bytes.count;
    console.log(
      `MEDIDO · ${bytes.count} teclas · stream ${bytes.stream} B (${perKey.toFixed(2)} B/tecla) · ` +
        `ancla ${(bytes.anchor / 1024).toFixed(1)} KB · registro entero ${(bytes.total / 1024).toFixed(1)} KB\n` +
        `PROYECCIÓN a 4.000 teclas/hora: ${((perKey * 4000) / 1024).toFixed(1)} KB/hora de stream ` +
        `+ ${(bytes.anchor / 1024).toFixed(1)} KB de ancla (coste ÚNICO).`,
    );
    expect(perKey).toBeLessThanOrEqual(2.5);
  });

  test("🔴 las teclas que el juego IGNORA no entran en el registro", async ({ page }) => {
    await boot(page);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await page.evaluate(() => (window as any).__u5test.replay.startRec());

    // Dos teclas de JUEGO, con teclas de SHELL intercaladas (F7 música, F8 speaker,
    // F10 menú) y un PANEL DOM abierto por medio (F5).
    await page.locator("body").press("ArrowRight");
    await page.waitForTimeout(25);
    for (const k of ["F7", "F8", "F10", "F10"]) {
      await page.locator("body").press(k);
      await page.waitForTimeout(25);
    }
    await page.locator("body").press("F5"); // abre el panel de partidas
    await page.waitForTimeout(80);

    // ⚠ Con el panel abierto, las teclas del TECLADO FÍSICO ya no sirven de testigo:
    // el panel se queda el foco y su propio `stopPropagation` las para en el DOM —
    // no llegan siquiera al reductor, así que no dirían nada sobre el `drop()`. Se
    // usa el camino de la BOTONERA TÁCTIL (`window.dispatchEvent`, ui/touch.ts:209),
    // que SÍ llega al reductor con el panel abierto: es el caso real de un usuario
    // tocando el deck con el panel de partidas encima.
    await page.evaluate(() => {
      for (const key of ["ArrowUp", "ArrowUp", "l"]) {
        window.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true }));
      }
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    });
    await page.waitForTimeout(80);
    await page.locator("body").press("ArrowDown");
    await page.waitForTimeout(25);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const log = await page.evaluate(() => (window as any).__u5test.replay.stopRec("ignoradas"));
    // De las once teclas, sólo las DOS del juego. Si las ignoradas se colaran, la
    // repetición las ejecutaría (a otra velocidad el panel ya no está abierto) y la
    // partida divergiría — que es exactamente el fallo que esta asimetría evita.
    expect([...(log.keys as string)]).toEqual(["\x04", "\x02"]); // ArrowRight, ArrowDown
    expect(log.count).toBe(2);
  });

  test("mientras se reproduce, el teclado REAL no toca la partida", async ({ page }) => {
    const rec = await playAndRecord(page, SEQ);

    await boot(page);
    await page.evaluate((l) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const r = (window as any).__u5test.replay;
      r.load(l);
      r.seek(10);
    }, rec.log);
    await expect
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .poll(() => page.evaluate(() => (window as any).__u5test.replay.status().index as number))
      .toBe(10);
    const before = await fingerprint(page);
    for (const k of ["ArrowUp", "ArrowUp", "l", "ArrowDown"]) {
      await page.locator("body").press(k);
      await page.waitForTimeout(25);
    }
    expect(await fingerprint(page)).toBe(before);
  });
});
