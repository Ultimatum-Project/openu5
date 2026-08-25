/**
 * #353 (merge ef914dd9) — las arenas de SALA de mazmorra SIEMBRAN los objetos del
 * `.CBT`: 1988 no sólo excluye los sprites tipo-2 (<0x40) del roster de combatientes,
 * los COLOCA (fase 2 de ULTIMA.EXE 0x6506 + post-proceso de cantidades de DNGLOOK
 * 0x131d-0x1381). El port no portaba esa fase entera.
 *
 * Cadena REAL end-to-end (receta de dungeon-room-escape.spec): entrar a la mazmorra,
 * inyectar una celda-sala delante y PISARLA con la tecla de avance — el despacho
 * (main.ts → dungeon-cmds → startDungeonRoomCombat) monta el Combat con la siembra.
 *
 * Sala elegida: DESTARD sala 0 = combatmaps[32] (roomCombatMapIndex(35,0) = 16+1·16),
 * porque su `.CBT` trae LAS CUATRO clases de la ley de cantidades en un solo mapa
 * (units leídas de game/assets/maps/combatmaps.json):
 *   · sprite 1 (COFRE)    en (6,2) → contenido DETERMINISTA 3·floor+7 (0x1328-0x1339)
 *   · sprite 2 (DINERO)   en (2,5) → rand(1, 10·floor+10) (0x1341-0x1358)
 *   · sprite 5 (ítem)     en (3,7) → OBJ_QTY_BASE[5]=0x1e + rand(0, SPAN[5]−1=3)
 *   · sprite 30 (DECORADO ≥0x10, cadáver 0x1e) en (4,8) → sólo capa visual, sin rand
 * Con la sala en la planta 3: cofre = 3·3+7 = 16; oro ∈ [1,40]; ítem 5 ∈ [30,33].
 *
 * Control negativo: DECEIT sala 1 = combatmaps[17], CERO unidades tipo-2 → las tres
 * capas de siembra quedan VACÍAS (el detector no fabrica objetos donde no los hay).
 */
import { test, expect } from "@playwright/test";
import { gotoGame, inCombat } from "./helpers";

/* eslint-disable @typescript-eslint/no-explicit-any */

/** Entra a `dungeonId`, planta una celda-sala `sub` al sur y la pisa (flujo real). */
async function enterRoom(page: import("@playwright/test").Page, dungeonId: number, sub: number): Promise<void> {
  await page.evaluate(
    ({ d, r }) => {
      const t = (window as any).__u5test;
      t.game.enterDungeon(d);
      const ds = t.game.dungeonState;
      ds.pos.floor = 3;
      ds.pos.x = 3;
      ds.pos.y = 3;
      ds.pos.facing = "south";
      ds.setCell(3, 3, 4, { type: 0xf, sub: r }); // Room delante (sur → y+1)
    },
    { d: dungeonId, r: sub },
  );
  await page.keyboard.press("ArrowUp"); // avanza y PISA la sala → combate top-down
  await expect.poll(() => inCombat(page)).toBe(true);
}

/** Foto cruda de las tres capas de siembra del Combat vivo. */
async function seededLayers(page: import("@playwright/test").Page): Promise<{
  loot: [string, number][];
  chests: [string, number][];
  piles: [string, { id: number; qty: number }[]][];
}> {
  return page.evaluate(() => {
    const c = (window as any).__u5test.game.combat;
    return {
      loot: [...c.lootLayer.entries()],
      chests: [...c.chestContents.entries()],
      piles: [...c.lootPiles.entries()].map(([k, v]: [string, any[]]) => [
        k,
        v.map((g) => ({ id: g.id, qty: g.qty })),
      ]),
    };
  });
}

test("#353 · Destard sala 0 (cm32): el .CBT siembra cofre/oro/ítem/decorado con la ley de cantidades en crudo", async ({ page }) => {
  await gotoGame(page);
  await enterRoom(page, 35, 0);

  const s = await seededLayers(page);
  const loot = new Map(s.loot);
  const chests = new Map(s.chests);
  const piles = new Map(s.piles);

  // COFRE (6,2): tile 0x01 en la capa de suelo SIN bit de trampa, contenido 3·3+7=16.
  expect(loot.get("6:2")).toBe(0x01);
  expect(chests.get("6:2")).toBe(16);

  // DECORADO (4,8): el cadáver 0x1e en la capa visual, sin cantidad ni pila.
  expect(loot.get("4:8")).toBe(0x1e);
  expect(piles.has("4:8")).toBe(false);

  // DINERO (2,5): una pieza id 2 con qty ∈ [1, 10·3+10] (una tirada de rand viva).
  const gold = piles.get("2:5");
  expect(gold).toHaveLength(1);
  expect(gold![0]!.id).toBe(2);
  expect(gold![0]!.qty).toBeGreaterThanOrEqual(1);
  expect(gold![0]!.qty).toBeLessThanOrEqual(40);

  // ÍTEM 5 (3,7): base 0x1e=30 + rand(0,3) ⇒ qty ∈ [30,33].
  const item = piles.get("3:7");
  expect(item).toHaveLength(1);
  expect(item![0]!.id).toBe(5);
  expect(item![0]!.qty).toBeGreaterThanOrEqual(30);
  expect(item![0]!.qty).toBeLessThanOrEqual(33);

  // Y nada más: las cuatro celdas censadas son TODA la siembra de cm32.
  expect(s.loot).toHaveLength(2); // cofre + decorado
  expect(s.chests).toHaveLength(1);
  expect(s.piles).toHaveLength(2); // oro + ítem
});

test("#353 · control negativo — Deceit sala 1 (cm17) no tiene tipo-2: las capas de siembra quedan VACÍAS", async ({ page }) => {
  await gotoGame(page);
  await enterRoom(page, 33, 1);

  const s = await seededLayers(page);
  expect(s.loot).toHaveLength(0);
  expect(s.chests).toHaveLength(0);
  expect(s.piles).toHaveLength(0);
});
