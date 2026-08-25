/**
 * Task #78 (ampliación) — GATE del JUGADOR ACTIVO en (C)ast.
 *
 * Con un jugador ACTIVO (la flecha → del roster, g_active_char≠0xFF), (C)ast va DIRECTO
 * a "Spell name:" sin preguntar (@0x49b2). Sin activo y con ≥2 elegibles pregunta
 * "Player: " (DS 0xa3c4, @0x4a02) con realce de fila del roster —SIN banda ►Select:◄—.
 *
 * 🔴 Este spec decía que el prompt era "Cast & who?" (testigo ORIG_cast_yell_log.png,
 * hoy inexistente en disco) y que «ya era correcta en el clon». Corregido por el carril
 * fix-cast-selector (22-08): la única vía de 0x4988 que pregunta tiene UN print de
 * prompt, DS 0xa3c4 = "Player: ", + el nombre (@0x4a30); el corpus OCR de 49 rutas de
 * LPs da 70 filas «Cast... Player: <nombre> Spell name:» y 0 con «Cast & who?». Lo que
 * el spec SÍ acertaba —y sigue probando— es el gate: el bug de origen era su falta.
 *
 * OJO — asimetría derivada del ASM: Ready/Ztats usan el picker CRUDO
 * (`resolve_display_char`) con ►Select:◄ y preguntan SIEMPRE (sin gate del activo);
 * sólo (C)ast salta con activo. Por eso este spec prueba CAST, no Ready.
 */
import { test, expect, type Page } from "@playwright/test";
import { createCharacter, readState, hudLog } from "./helpers";

const ALL_A = ["A", "A", "A", "A", "A", "A", "A"] as const;

async function logHas(page: Page, text: string, lines = 8): Promise<boolean> {
  return (await hudLog(page, lines)).some((l) => l.includes(text));
}

/** Inyecta un 2º miembro vivo para que haya >1 elegible (el gate sólo pregunta con >1). */
async function twoMemberParty(page: Page): Promise<void> {
  await page.evaluate(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const g = (window as any).__u5test.game;
    g.state.characters[1] = JSON.parse(JSON.stringify(g.state.characters[0]));
    g.state.characters[1].name = "Shamino";
    g.state.characters[1].status = "G";
    g.state.partySize = 2;
    g.state.activeCharacter = 0xff; // sin activo de arranque
  });
}

test("Cast: sin activo pregunta 'Player: '; con activo va DIRECTO a Spell name", async ({ page }) => {
  await createCharacter(page, "Mago", "M", [...ALL_A]);
  await twoMemberParty(page);

  // (a) SIN jugador activo y 2 elegibles → (C)ast PREGUNTA: "Player: " en el log.
  await page.keyboard.press("c");
  expect(await logHas(page, "Player:")).toBe(true);
  expect(await logHas(page, "Cast & who?")).toBe(false); // cadena fabricada, purgada
  expect(await readState<number>(page, "activeCharacter")).toBe(0xff);
  await page.keyboard.press("Escape"); // cancela el picker de caster

  // (b) Activa al jugador 1 con el dígito '1' (Set Active Plr → g_active_char=0).
  await page.keyboard.press("1");
  expect(await readState<number>(page, "activeCharacter")).toBe(0);
  expect(await logHas(page, "Set Active")).toBe(true);

  // (C)ast ahora va DIRECTO a "Spell name:" (sin prompt de PJ): teclear "il" castea In Lor.
  const mpBefore = await readState<number>(page, "characters[0].currentMp");
  await page.keyboard.press("c");
  const tail = await hudLog(page, 3);
  expect(tail.some((l) => l.includes("Spell name"))).toBe(true); // fue directo al hechizo
  for (const ch of "il") await page.locator("body").press(ch);
  await page.locator("body").press("Enter");
  // In Lor (círculo 1) casteado por el jugador ACTIVO, sin selección: −1 maná.
  expect(await readState<number>(page, "characters[0].currentMp")).toBe(mpBefore - 1);
  // In Lor es GLOBAL → éxito SILENCIOSO (CAST 0x11a6: el handler no toca [bp-0xa]=0xffff,
  // el tail no imprime nada): el binario NO emite "In Lor!" (flavor fabricado, purgado).
  // El maná decrementado (arriba) prueba el lanzamiento; el eco rúnico "IN LOR" es la traza.
  expect(await logHas(page, "IN LOR")).toBe(true);
  expect(await logHas(page, "In Lor!")).toBe(false);

  // (c) '0' deselecciona el activo (g_active_char=0xFF) → (C)ast vuelve a preguntar.
  await page.keyboard.press("0");
  expect(await readState<number>(page, "activeCharacter")).toBe(0xff);
  await page.keyboard.press("c");
  expect(await logHas(page, "Player:")).toBe(true);
  await page.keyboard.press("Escape");
});

test("Cast auto-elige el ÚNICO elegible (party de 1 NUNCA pregunta)", async ({ page }) => {
  await createCharacter(page, "Mago", "M", [...ALL_A]);
  // Reduce a party de 1 (el Avatar) → sin activo, 1 elegible → auto (@0x49fa):
  // (C)ast NO pregunta "Player: ", va DIRECTO a "Spell name:".
  await page.evaluate(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const st = (window as any).__u5test.game.state;
    st.partySize = 1;
    st.activeCharacter = 0xff;
  });
  expect(await readState<number>(page, "partySize")).toBe(1);
  expect(await readState<number>(page, "activeCharacter")).toBe(0xff);
  const mpBefore = await readState<number>(page, "characters[0].currentMp");
  await page.keyboard.press("c");
  expect(await logHas(page, "Player:")).toBe(false); // no preguntó
  const tail = await hudLog(page, 3);
  expect(tail.some((l) => l.includes("Spell name"))).toBe(true);
  for (const ch of "il") await page.locator("body").press(ch);
  await page.locator("body").press("Enter");
  expect(await readState<number>(page, "characters[0].currentMp")).toBe(mpBefore - 1);
});

test("Cast: un miembro DORMIDO no es elegible → con 1 despierto NO pregunta", async ({ page }) => {
  await createCharacter(page, "Mago", "M", [...ALL_A]);
  await twoMemberParty(page); // 2 miembros, ambos 'G', sin activo
  // Duerme al 2º ('S' = 0x53, no elegible): queda 1 elegible → auto, sin pregunta.
  await page.evaluate(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as any).__u5test.game.state.characters[1].status = "S";
  });
  const mpBefore = await readState<number>(page, "characters[0].currentMp");
  await page.keyboard.press("c");
  expect(await logHas(page, "Player:")).toBe(false); // sólo 1 elegible → auto
  for (const ch of "il") await page.locator("body").press(ch);
  await page.locator("body").press("Enter");
  // Casteó el ÚNICO elegible (el Avatar despierto, idx 0): −1 maná.
  expect(await readState<number>(page, "characters[0].currentMp")).toBe(mpBefore - 1);
});
