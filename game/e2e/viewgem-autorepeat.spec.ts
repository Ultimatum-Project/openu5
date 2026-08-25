/**
 * E2E — MANTENER PULSADA LA V NO CIERRA LA VISTA NI SE COME GEMAS (bug del original §1.11).
 *
 * Origen: reporte de un jugador en la cámara del trono de Blackthorn — «la consola dice
 * "View a gem!" y no pasa nada». La causa NO era que la vista no pintara (pinta): era que
 * el auto-repeat del teclado la cerraba dentro del mismo gesto que la abrió.
 *
 * ── LA ARITMÉTICA QUE ENGAÑA, Y QUE ESTE FICHERO FIJA ───────────────────────────────────
 * La rama que CIERRA el modal retorna sin ecoar, así que los ecos cuentan sólo ABERTURAS
 * (⌈N/2⌉) y es la PARIDAD de N la que decide si queda abierta. Antes del arreglo:
 *
 *     N=1 → 1 eco, −1 gema, vista ABIERTA      N=2 → 1 eco, −1 gema, vista CERRADA
 *     N=3 → 2 ecos, −2 gemas, vista ABIERTA    N=4 → 2 ecos, −2 gemas, vista CERRADA
 *
 * Con N=2 el jugador veía UN eco y ninguna vista: indistinguible de un comando roto. Por eso
 * «sale un solo eco» NO descartaba el auto-repeat — lo confirmaba.
 *
 * DESPUÉS del arreglo la paridad desaparece: N=1..4 dan todos 1 eco, 1 gema y vista ABIERTA.
 * Ese colapso es lo que se asevera aquí, y es el aserto que un `if (ev.repeat)` mal puesto
 * (o retirado) rompe inmediatamente.
 *
 * ⚠ ESTE FICHERO NECESITA UN NAVEGADOR DE VERDAD y no vale con `dispatchEvent`: sólo el
 * `Input.dispatchKeyEvent` de CDP con `autoRepeat: true` produce un `KeyboardEvent.repeat`
 * verdadero. Un `new KeyboardEvent("keydown", …)` lo deja en `false` y el test pasaría
 * vacuo — mediría un teclado que no existe.
 */
import { test, expect, type Page } from "@playwright/test";
import { gotoGame } from "./helpers";

/** Blackthorn planta 3, la casilla del reporte (delante del trono). */
const TRONO = { loc: 18, floor: 3, x: 15, y: 14 };

interface Estado {
  ecos: number;
  gems: number;
  minutos: number;
  vistaAbierta: boolean;
}

/** Manda `n` keydown de 'v': la 1ª normal y las demás como AUTO-REPEAT del sistema. */
async function mantenerV(page: Page, n: number): Promise<void> {
  const cdp = await page.context().newCDPSession(page);
  const tecla = { key: "v", code: "KeyV", text: "v", windowsVirtualKeyCode: 86 };
  await cdp.send("Input.dispatchKeyEvent", { type: "keyDown", ...tecla });
  for (let i = 1; i < n; i++) {
    await page.waitForTimeout(60);
    await cdp.send("Input.dispatchKeyEvent", { type: "keyDown", ...tecla, autoRepeat: true });
  }
  await cdp.send("Input.dispatchKeyEvent", { type: "keyUp", key: "v", code: "KeyV", windowsVirtualKeyCode: 86 });
  await page.waitForTimeout(600);
}

const leer = (page: Page): Promise<Estado> =>
  page.evaluate(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const t = (window as any).__u5test;
    const s = t.state();
    return {
      ecos: (t.consoleLines() as string[]).filter((l) => l.includes("View a gem!")).length,
      gems: s.gems,
      minutos: s.time.hour * 60 + s.time.minute,
      vistaAbierta: t.inputSinks().gemView === true,
    };
  });

for (const n of [1, 2, 3, 4]) {
  test(`mantener la V con ${n} pulsación(es): 1 eco, 1 gema y la vista SIGUE ABIERTA`, async ({
    page,
  }) => {
    await gotoGame(page, TRONO);
    await page.locator("html[data-shell-skin]").waitFor({ state: "attached", timeout: 30_000 });
    await page.waitForTimeout(400);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await page.evaluate(() => { (window as any).__u5test.state().gems = 5; });
    const antes = await leer(page);

    await mantenerV(page, n);
    const despues = await leer(page);

    // La PARIDAD murió: el resultado ya no depende de cuántas repeticiones llegaron.
    expect(despues.ecos, "el eco es de la APERTURA y sólo hubo una").toBe(1);
    expect(despues.gems, "una sola gema por gesto, no una por repetición").toBe(5 - 1);
    expect(despues.vistaAbierta, "una repetición NO puede cerrar lo que abrió su propia pulsación").toBe(true);
    // El turno de (V) se cobra AL CERRAR (orden del binario), así que con la vista abierta
    // el reloj no se ha movido — y de paso esto caza el cierre-y-reapertura silencioso.
    expect(despues.minutos, "sin cierre no hay turno cobrado").toBe(antes.minutos);
  });
}

test("CONTROL — una SEGUNDA PULSACIÓN de verdad sí cierra, y ahí se cobra el turno", async ({
  page,
}) => {
  // Sin este control, el arreglo podría haber dejado el modal imposible de cerrar y los
  // cuatro asertos de arriba seguirían verdes: «no se cierra nunca» los pasa todos.
  await gotoGame(page, TRONO);
  await page.locator("html[data-shell-skin]").waitFor({ state: "attached", timeout: 30_000 });
  await page.waitForTimeout(400);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await page.evaluate(() => { (window as any).__u5test.state().gems = 5; });
  const antes = await leer(page);

  await page.keyboard.press("v");
  await page.waitForTimeout(400);
  expect((await leer(page)).vistaAbierta).toBe(true);

  await page.keyboard.press("x"); // tecla NUEVA: repeat=false
  await page.waitForTimeout(500);
  const despues = await leer(page);
  expect(despues.vistaAbierta, "cualquier tecla NUEVA cierra, como en 1988").toBe(false);
  expect(despues.minutos, "el turno se cobra al cerrar").toBeGreaterThan(antes.minutos);
});

test("CONTROL — ANDAR MANTENIENDO la flecha sigue vivo (lo que rompería una guarda global)", async ({
  page,
}) => {
  // La razón DERIVADA por la que la guarda no está en todo el despachador: en el original se
  // anda manteniendo la flecha (la repetición typematic ES el paso continuo), y este repo la
  // reproduce a mano en táctil (ui/hold-repeat.ts). Si alguien "simplifica" el arreglo
  // subiendo el `if (ev.repeat)` al principio del keydown, ESTE test se pone rojo.
  await gotoGame(page, { loc: 0, x: 82, y: 108 });
  await page.locator("html[data-shell-skin]").waitFor({ state: "attached", timeout: 30_000 });
  await page.waitForTimeout(400);
  const pos = (): Promise<{ x: number; y: number }> =>
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    page.evaluate(() => { const p = (window as any).__u5test.state().position; return { x: p.x, y: p.y }; });
  const p0 = await pos();

  const cdp = await page.context().newCDPSession(page);
  const der = { key: "ArrowRight", code: "ArrowRight", windowsVirtualKeyCode: 39 };
  await cdp.send("Input.dispatchKeyEvent", { type: "rawKeyDown", ...der });
  for (let i = 0; i < 4; i++) {
    await page.waitForTimeout(150);
    await cdp.send("Input.dispatchKeyEvent", { type: "rawKeyDown", ...der, autoRepeat: true });
  }
  await cdp.send("Input.dispatchKeyEvent", { type: "keyUp", ...der });
  await page.waitForTimeout(900);

  const p1 = await pos();
  expect(Math.abs(p1.x - p0.x) + Math.abs(p1.y - p0.y)).toBeGreaterThan(1);
});
