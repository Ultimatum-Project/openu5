/**
 * Journey E2E — despacho COMPLETO del pasillo de mazmorra + ecos de movimiento +
 * familia Ctrl (auditoría de cobertura: teclas-02, str-dungeon-move-echo,
 * teclas-01-ctrl-k-karma, str-ctrl-quit-sound-ver).
 *
 * Ejercita el CABLEADO REAL de la UI (main.ts handleDungeonKey / handleCtrlKey)
 * que los unit no cubren. Citas: DUNGEON.OVL move() 0x0502 (ecos DS 0x2cc0-0x2d2c),
 * dispatcher DUNGEON 0x06c4 (Ctrl-K 0x06f2, dígitos 0x07bc, letras → kernel 0x3178
 * @0x07a0), kernel_cmd_dispatch 0x3178 (ramas de mazmorra por g_location), MAINOUT
 * jump table 0x0bbe (Ctrl-K/E/V/S). Entrada a Deceit por el recipe de dungeon.spec.
 */
import { test, expect, type Page } from "@playwright/test";
import { hudLog, waitWorldReady } from "./helpers";

const DECEIT = { x: 240, y: 74, hour: 10 }; // 1 al sur de la entrada (240,73)

async function bootDeceit(page: Page, lang: "es" | "en"): Promise<void> {
  await page.addInitScript(() => localStorage.clear());
  await page.goto(`/?skin=faithful&nointro&lang=${lang}&x=${DECEIT.x}&y=${DECEIT.y}&hour=${DECEIT.hour}`);
  await waitWorldReady(page);
  await page.evaluate(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as any).__u5test.game.state.questFlags["word-spoken:33"] = true;
  });
  await page.keyboard.press("ArrowUp"); // pisa la entrada (240,73)
  await page.keyboard.press("e"); // (E)nter → enterDungeon(33)
  await page.waitForFunction(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    () => (window as any).__u5test.game.dungeonState != null,
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const facing = (page: Page): Promise<string> =>
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  page.evaluate(() => (window as any).__u5test.game.dungeonState.pos.facing);

test("lang=es: ecos de movimiento en vivo — Avanzáis / Giráis / Media vuelta (DS 0x2cc0-0x2d0b)", async ({ page }) => {
  await bootDeceit(page, "es");
  await page.keyboard.press("ArrowLeft"); // Turn left (DUNGEON 0x066e)
  expect((await hudLog(page, 4)).join("\n")).toContain("Giráis a la izquierda");
  await page.keyboard.press("ArrowRight"); // Turn right (0x0636)
  expect((await hudLog(page, 4)).join("\n")).toContain("Giráis a la derecha");
  await page.keyboard.press("Enter"); // giro 180° (0x0533)
  expect((await hudLog(page, 4)).join("\n")).toContain("Media vuelta.");
  await page.keyboard.press("ArrowUp"); // Advance (0x0542)
  expect((await hudLog(page, 6)).join("\n")).toContain("Avanzáis");
  await page.keyboard.press("ArrowDown"); // Back up (0x064a)
  expect((await hudLog(page, 6)).join("\n")).toContain("Retrocedéis");
});

test("lang=es: Ctrl-K imprime el KARMA (decimal, sin turno) y Ctrl-S el toggle de sonido (jump table <0x20)", async ({ page }) => {
  await bootDeceit(page, "es");
  const { karma, minute } = await page.evaluate(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const st = (window as any).__u5test.game.state;
    return { karma: st.karma as number, minute: st.time.minute as number };
  });
  await page.keyboard.press("Control+k");
  expect((await hudLog(page, 3)).join("\n")).toContain(String(karma));
  // SIN turno (MAINOUT 0x0b7c jmp 0xaf8: re-lee tecla sin pasar por el reloj).
  const minuteAfter = await page.evaluate(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    () => (window as any).__u5test.game.state.time.minute as number,
  );
  expect(minuteAfter).toBe(minute);
  // Ctrl-S: "Sound " (DS 0x2b54) + estado NUEVO ("On"/"Off") — en ES por pieza.
  await page.keyboard.press("Control+s");
  expect((await hudLog(page, 3)).join("\n")).toMatch(/Sonido (activado|desactivado)/);
  // Ctrl-V: versión "1.16" (MAINOUT 0x0b6e; misidentificación del censo corregida).
  await page.keyboard.press("Control+v");
  expect((await hudLog(page, 3)).join("\n")).toContain("1.16");
});

test("lang=en: despacho del pasillo — Space/A/T/P/G/L byte-exactos (kernel 0x3178 vía DUNGEON 0x07a0)", async ({ page }) => {
  await bootDeceit(page, "en");
  // Space = Pass ("Pass\n" DS 0xa134, kernel 0x31F4 rama loc≠0).
  await page.keyboard.press(" ");
  expect((await hudLog(page, 3)).join("\n")).toContain("Pass");
  // A = Attack de mazmorra ("Attack\n" + "What?\n", DUNGEON 0x1d56/0x1e00).
  await page.keyboard.press("a");
  const afterA = (await hudLog(page, 4)).join("\n");
  expect(afterA).toContain("Attack");
  expect(afterA).toContain("What?");
  // T = "Talk-Funny, no response!\n" (DS 0xa22c, kernel 0x33e7).
  await page.keyboard.press("t");
  expect((await hudLog(page, 4)).join("\n")).toContain("Talk-Funny, no response!");
  // P = "Push\nNot here!\n" (DS 0xa1d4, kernel 0x3378, ret 0).
  await page.keyboard.press("p");
  expect((await hudLog(page, 4)).join("\n")).toContain("Not here!");
  // G = get_dungeon sin cofre ("Get\n" + "Not here!\n", SJOG 0x17a6/0x18c0).
  await page.keyboard.press("g");
  expect((await hudLog(page, 4)).join("\n")).toContain("Get");
  // L = Look (DNGLOOK 0x0000). RE-BASELINE 2026-07-25: el Look de mazmorra abre ANTES el
  // SELECTOR DE MIEMBRO («Player:», `resolve_display_char` @0x0007 — cadena de
  // presentación F3, testigo P16 «>Look... / Player: Min / Dir-Ahead / You see:»), que se
  // cableó DESPUÉS de la última vez que esta suite pudo correr (la suite e2e por defecto
  // llevaba desde el 22-07 sin arrancar por el import de JSON sin atributo, ver
  // core/world/commands.ts). El eco «Look...» sale ya; el «You see:» llega tras elegir
  // miembro. A oscuras el gate de luz @0x0013 se salta el «Dir-» y describe darkness.
  await page.keyboard.press("l");
  expect((await hudLog(page, 4)).join("\n")).toContain("Look");
  await page.keyboard.press("1"); // elige al miembro 1 del selector «Player:»
  const afterL = (await hudLog(page, 6)).join("\n");
  expect(afterL).toContain("You see:");
  expect(afterL).toContain("darkness.");
});

test("numpad con NumLock: Numpad4 gira (getkey remap 0x26a4) y la fila superior sigue siendo Set Active Plr", async ({ page }) => {
  await bootDeceit(page, "en");
  const before = await facing(page);
  await page.keyboard.press("Numpad4"); // ← relativo (turn left)
  const after = await facing(page);
  expect(after).not.toBe(before);
  // Fila superior: dígito = Set Active Player (DUNGEON 0x07bc → kernel 0xbeb0 [= CS 0x4080 → ULTIMA.EXE:0x4080], ret 0).
  await page.keyboard.press("1");
  expect((await hudLog(page, 3)).join("\n")).toContain("Set Active Plr:");
});
