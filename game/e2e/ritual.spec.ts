/**
 * E2E — EL RITUAL DE LOS SHADOWLORDS (F1.10-T5). Reachability del clímax de la
 * trama por la UI real: en la sala de la Llama de una Virtud, (Y)ell el nombre
 * del Shadowlord lo CONVOCA sobre la Llama; pisar la casilla del ritual y (U)se
 * el Shard lo DESTRUYE. Derivado de CMDS.OVL 0x1030 + CAST.OVL 0x15b4.
 *
 * Geometría (validada contra assets/maps/smallmaps.json): The Lycaeum (loc 30,
 * floor 2) tiene la Llama (tile 0xDE) en (15,8); el ritual se hace en (15,9). El
 * SL convocado aparece en party_y-2, así que gritar desde (15,10) lo coloca EN la
 * Llama (15,8); tras pisar (15,9), queda al norte y el Shard lo destruye.
 */
import { test, expect } from "@playwright/test";
import { gotoGame, readState, hudLog } from "./helpers";

type Pg = import("@playwright/test").Page;

/**
 * Selecciona un usable por su etiqueta en el OVERLAY DE PERGAMINO de (U)se de la piel fiel
 * (jubilado el popup DOM dev): lee el hook `__u5test.readyPicker()`, baja la barra hasta el
 * ítem y pulsa Enter para USARLO. (Espejo del `pickerUse` de use-item.spec.ts.)
 */
async function selectUsable(page: Pg, label: string): Promise<void> {
  interface Probe {
    phase: "select" | "pick";
    rows: { name: string }[];
    cursor: number;
  }
  for (let i = 0; i < 40; i++) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const pk = (await page.evaluate(() => (window as any).__u5test.readyPicker())) as Probe | null;
    if (!pk || pk.phase !== "pick") throw new Error("selectUsable: el picker de (U)se no está abierto");
    if (pk.rows[pk.cursor]?.name.includes(label)) {
      await page.locator("body").press("Enter");
      return;
    }
    await page.locator("body").press("ArrowDown");
  }
  throw new Error(`selectUsable: no encontré "${label}" en el picker`);
}

async function giveShard(page: Pg): Promise<void> {
  await page.evaluate(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as any).__u5test.state().shards.falsehood = true;
  });
}

async function setY(page: Pg, y: number): Promise<void> {
  await page.evaluate((yy) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as any).__u5test.state().position.y = yy;
  }, y);
}

test("Yell + Use Shard en la Llama de la Verdad destruye a Faulinei", async ({ page }) => {
  // The Lycaeum (loc 30), floor 2, una casilla al sur de la Llama del ritual.
  await gotoGame(page, { loc: 30, floor: 2, x: 15, y: 10, seed: 1 });
  await giveShard(page);

  // (Y)ell FAULINEI → convoca al Shadowlord sobre la Llama (15,8). El input es por
  // CONSOLA fiel (getstring 0x7b9c), no un popup: se teclea la palabra y Enter la
  // envía (item 2 de fidelidad de comandos).
  await page.keyboard.press("y");
  await page.keyboard.type("FAULINEI");
  await page.keyboard.press("Enter");
  expect(await readState<number>(page, "shadowlordSummoned")).toBe(0);
  const summoned = await readState<{ x: number; y: number; kind: string }[]>(page, "worldObjects");
  expect(summoned.some((o) => o.kind === "shadowlord" && o.x === 15 && o.y === 8)).toBe(true);

  // El Avatar pisa la casilla del ritual (15,9): el SL queda al norte.
  await setY(page, 9);

  // (U)se → Shard/Falsehd (name-table 0x1916) → el ritual destruye al Shadowlord.
  await page.keyboard.press("u");
  await selectUsable(page, "Shard/Falsehd");

  expect((await hudLog(page, 8)).join("\n")).toContain("is wrought!");
  expect(await readState<boolean>(page, 'questFlags["shadowlord-dead:falsehood"]')).toBe(true);
  expect(await readState<boolean>(page, "shards.falsehood")).toBe(false); // shard consumido
  const after = await readState<{ kind: string }[]>(page, "worldObjects");
  expect(after.some((o) => o.kind === "shadowlord")).toBe(false); // el SL desapareció
});

test("Use Shard fuera de la posición de la Llama → 'No effect!' y el shard NO se consume", async ({ page }) => {
  // En la sala correcta (loc 30) pero en la casilla equivocada (15,10, no (15,9)).
  await gotoGame(page, { loc: 30, floor: 2, x: 15, y: 10, seed: 1 });
  await giveShard(page);

  await page.keyboard.press("u");
  await selectUsable(page, "Shard/Falsehd");

  expect((await hudLog(page, 8)).join("\n")).toContain("No effect!");
  expect(await readState<boolean>(page, "shards.falsehood")).toBe(true); // no se consume en el fallo
});
