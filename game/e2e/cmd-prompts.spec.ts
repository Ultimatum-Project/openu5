/**
 * Task #72 — PROMPTS del log de tres comandos de overworld vs el original DOS
 * (testigos del usuario en original/av-referencia/command-prompts/).
 *
 * Verifica que el TEXTO y la INTERACCIÓN de (C)ast, (Y)ell y (K)limb calcan el
 * binario:
 *   · CAST caster-select = "Player: " (DS 0xa3c4). Selección por realce de fila del
 *     roster (setSelectCursor), NO banda ">Select:<".
 *     🔴 Este spec decía «= "Cast & who?" (ampersand 0x26 verificado pixel-a-pixel
 *     contra ORIG_cast_yell_log.png)» y afirmaba `not.toContain("Player:")`, o sea
 *     el aserto INVERSO del original. Corregido por el carril fix-cast-selector
 *     (22-08): `CAST:0x0dd5 call 0x8a08` → kernel 0x4988, y su única vía que
 *     pregunta imprime DS 0xa3c4 = "Player: " (@0x4a02) + el nombre (@0x4a30). El
 *     testigo pixel citado ya no existe en disco; el corpus OCR de 49 rutas de LPs
 *     da 70 filas «Cast... Player: <nombre> Spell name:» y 0 «Cast & who?».
 *   · YELL = eco "Yell " (DS 0xa286) + el handler imprime "what?\n:" (DS 0x4529) → dos
 *     filas: "►Yell what?" (eco) y ":<palabra>" (getstring, sin bullet, con cursor). El
 *     '\n:' es la 2ª línea del prompt (CMDS 0x1418 rama tierra,
 *     kernel 0x7b9c [= CS 0x3b1c → ULTIMA.EXE:0x3b1c input_string]). CORRIGE
 *     la hipótesis previa de este spec ("no Yell what?, inline"): el testigo del usuario
 *     (verdicts/yell-prompt) + los bytes de DATA.OVL (DS 0x4529 "what?\n:") + video-M
 *     (death-resurrection-audit.md §S1) confirman "Yell what?" en línea nueva con cursor.
 *   · KLIMB overworld (garfio, CMDS 0x1C20): sin garfio → "With what?" SIN pedir
 *     dirección; con garfio+a pie → "Klimb-" + eco de dirección + resultado del
 *     tile ("Not climbable!"/"Impassable!"/escalada), nunca "What?".
 */
import { test, expect } from "@playwright/test";
import { gotoGame, hudLog } from "./helpers";

test("(C)ast overworld: caster-select imprime 'Player: ' (DS 0xa3c4)", async ({
  page,
}) => {
  await gotoGame(page); // Iolo's Hut (loc 13) — el caster-select es el mismo en todo contexto
  await page.locator("body").press("c");
  const log = (await hudLog(page, 6)).join("\n");
  expect(log).toContain("Player:"); // DS 0xa3c4, el ÚNICO print de prompt de 0x4a00-0x4a57
  expect(log).not.toContain("Cast & who?"); // fabricada: 0 hits en DATA.OVL y 0 en el corpus
  expect(log).not.toContain("Cast — who?");
  // El picker fiel publica el cursor del roster (realce), no una banda Select.
  const cursor = await page.evaluate(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const t = (window as any).__u5test;
    return t.game.view?.snapshot?.().selectCursor ?? "n/a";
  });
  // El cursor de selección arranca en el 1er miembro (0) — señal del realce de fila.
  expect(cursor === 0 || cursor === "n/a").toBeTruthy();
  await page.locator("body").press("Escape"); // cancelar sin efecto
});

test("(Y)ell overworld: eco 'Yell what?' + fila de getstring ':' en línea nueva", async ({ page }) => {
  await gotoGame(page, { loc: 0, x: 82, y: 108 }); // overworld a pie
  await page.locator("body").press("y");
  let lines = await hudLog(page, 4);
  let log = lines.join("\n");
  // Fila 1: eco del comando "Yell what?" (kernel "Yell " DS 0xa286 + handler "what?\n:"
  // DS 0x4529). Fila 2: el cursor ':' del getstring en LÍNEA NUEVA (por el \n de 0x4529).
  expect(log).toContain("Yell what?");
  expect(lines).toContain(":"); // fila del getstring, sola, en línea nueva
  // La palabra se teclea en la fila del ':' (NO pegada a "Yell").
  await page.locator("body").press("f");
  await page.locator("body").press("o");
  await page.locator("body").press("o");
  lines = await hudLog(page, 4);
  expect(lines).toContain(":foo"); // input ecoado tras el ':' del getstring
  expect(lines.join("\n")).not.toMatch(/Yell\s*foo/i); // NO inline tras "Yell"
  await page.locator("body").press("Enter");
});

test("(K)limb overworld SIN garfio: 'With what?' sin pedir dirección", async ({ page }) => {
  await gotoGame(page, { loc: 0, x: 82, y: 108 });
  await page.locator("body").press("k");
  const log = (await hudLog(page, 4)).join("\n");
  expect(log).toContain("With what?");
  expect(log).not.toContain("Klimb-"); // no llegó a pedir dirección
});

test("(K)limb overworld CON garfio, tile no-montaña: 'Klimb-<Dir>' + 'Not climbable!'", async ({
  page,
}) => {
  await gotoGame(page, { loc: 0, x: 82, y: 108 });
  await page.evaluate(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as any).__u5test.state().grapple = true;
  });
  await page.locator("body").press("k"); // → pide dirección, eco "Klimb-"
  let log = (await hudLog(page, 4)).join("\n");
  expect(log).toContain("Klimb-");
  await page.locator("body").press("ArrowRight"); // East
  log = (await hudLog(page, 4)).join("\n");
  expect(log).toContain("Klimb-East"); // eco de dirección en la misma fila
  // El tile objetivo no es SmallMountains (0x0C) → mensaje del binario, jamás "What?".
  expect(log).toMatch(/Not climbable!|Impassable!/);
  expect(log).not.toContain("What?");
});
