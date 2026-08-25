/**
 * Fase 1.5 — Capa de objetos del mundo (g_world_objects 0x5C5A), E2E de cierre.
 *
 * Cubre el ciclo de la fase de punta a punta contra el ESTADO real (nunca
 * píxeles), vía el hook DEV `__u5test.addWorldObject` (siembra determinista de un
 * objeto estacionario) y la tienda VIVA del Shipwright (compra orgánica):
 *   (1) cofre-objeto: (O)pen → trampa exacta → el objeto desaparece + karma-robo;
 *   (2) antorcha de pared: (G)et → torches++ (cap 99) → el objeto desaparece;
 *   (3) naval orgánico: comprar en el Shipwright REAL coloca la nave en el muelle
 *       del OVERWORLD; y el ciclo Board→dañar→X-it→re-atracar→re-abordar preserva
 *       el hull (aviso DANGER al re-abordar una nave malparada);
 *   (4) persistencia: guardar/cargar (F5) conserva worldObjects (patrón fix #49).
 *
 * Determinismo: seeds fijos; el cofre/antorcha se siembran a mano (el sembrado real
 * de cofres de pueblo es el oráculo O5, sin derivar). Coords de costa verificadas
 * contra assets/maps/overworld.json (tile 2 = agua abordable; vecino ortogonal
 * walkable = tierra). El Shipwright de East_Britanny (loc 21) se visita en su TRAMO
 * de tienda (hour=10, gate #315) con posición leída VIVA — en tramo abierto está en
 * su puesto (7,10) y deambula (aiType 4), ya no en la casilla de descanso (3,26).
 */
import { test, expect } from "@playwright/test";
import type { Page } from "@playwright/test";
import { gotoGame, readState, consoleText } from "./helpers";
import type { WorldObject } from "../src/core/state";
import { lootOpenLine } from "../src/core/world/commands";

/** Siembra un objeto del mundo vía el hook DEV (capa g_world_objects, F1.5). */
async function seed(page: Page, obj: WorldObject): Promise<void> {
  await page.evaluate((o) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as any).__u5test.addWorldObject(o);
  }, obj as unknown as Record<string, unknown>);
}

/** Sprites del botín-suelo a pintar (Game.lootRenderTiles, capa de render #21). */
async function lootRender(page: Page): Promise<{ x: number; y: number; tile: number }[]> {
  return page.evaluate(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (window as any).__u5test.game.lootRenderTiles();
  });
}

/** Fija oro (seam de test, como saves.spec empuja enemigos al vivo). */
async function setGold(page: Page, gold: number): Promise<void> {
  await page.evaluate((g) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as any).__u5test.game.state.gold = g;
  }, gold);
}

// ---------------------------------------------------------------------------
// (1) Cofre-objeto
// ---------------------------------------------------------------------------
test("(O)pen sobre un cofre-objeto trampeado dispara 'Trapped!', roba karma y lo elimina", async ({
  page,
}) => {
  // Iolo's Hut (loc 13, INIT): party en (15,15). El cofre al norte (15,14).
  await gotoGame(page, { loc: 13, floor: 0, x: 15, y: 15 });
  await seed(page, {
    location: 13, floor: 0, x: 15, y: 14, tile: 0x40, kind: "chest",
    // bit 0x80 = trampa; nibble de contenido 0 → botín vacío ("Chest empty!") para que la
    // línea "Trapped!" no la desplace la lluvia de líneas por-pieza (0x12A) en el hud-log
    // rodante (#13). El disparo de trampa es independiente del contenido.
    contents: 0x80, trapped: true, // SJOG open_chest_world 0x112C
  });
  expect(await readState<WorldObject[]>(page, "worldObjects")).toHaveLength(1);
  const karmaBefore = await readState<number>(page, "karma");

  await page.locator("body").press("o");
  await page.locator("body").press("ArrowUp");

  // "Trapped!" (str 0x8b7e) sale en el HUD; el COFRE se retira; karma robo −2. Sin botín no
  // hay objetos-suelo (kind "loot"), así que la lista queda vacía.
  await expect.poll(() => consoleText(page)).toContain("Trapped");
  const afterObjs = await readState<WorldObject[]>(page, "worldObjects");
  expect(afterObjs.some((o) => o.kind === "chest")).toBe(false); // cofre abierto y retirado
  expect(afterObjs.some((o) => o.kind === "loot")).toBe(false);  // contenido 0 → sin botín
  const karmaAfter = await readState<number>(page, "karma");
  expect(karmaAfter).toBe(karmaBefore > 2 ? karmaBefore - 2 : 0); // asm 0x11f7-0x1206
});

test("(O)pen coloca el botín al suelo ('Found:') y el (G)et lo recoge uno a uno #13", async ({
  page,
}) => {
  // Iolo's Hut (loc 13): party (15,15), cofre rico al norte (15,14). Open coloca el botín
  // como objetos-suelo (kind "loot") en (15,14) y emite "Found:"; nada se acredita aún.
  await gotoGame(page, { loc: 13, floor: 0, x: 15, y: 15, seed: 0x4242 });
  await seed(page, {
    location: 13, floor: 0, x: 15, y: 14, tile: 0x40, kind: "chest", contents: 0x63, trapped: false,
  });

  await page.locator("body").press("o");
  await page.locator("body").press("ArrowUp");

  const afterOpen = await readState<WorldObject[]>(page, "worldObjects");
  expect(afterOpen.some((o) => o.kind === "chest")).toBe(false);        // cofre retirado
  const loot = afterOpen.filter((o) => o.kind === "loot");
  expect(loot.length).toBeGreaterThan(0);                              // botín al suelo
  expect(loot.every((o) => o.x === 15 && o.y === 14)).toBe(true);      // apilado en la celda del cofre
  // El dispatcher 0x12A imprime una línea por pieza tras "Found:"; con botín rico el hud-log
  // rodante desplaza "Found:", pero la línea de la ÚLTIMA pieza colocada es la más reciente.
  const lastLine = lootOpenLine(loot[loot.length - 1]!.loot!.id);
  await expect.poll(() => consoleText(page)).toContain(lastLine);

  // Recoge la primera pieza con (G)et hacia el norte: baja el recuento de "loot" en 1.
  await page.locator("body").press("g");
  await page.locator("body").press("ArrowUp");
  const afterGet = await readState<WorldObject[]>(page, "worldObjects");
  expect(afterGet.filter((o) => o.kind === "loot").length).toBe(loot.length - 1);
});

test("#21 · el botín-suelo se PINTA (entidad render-only, tile=id+0x100), LIFO al recogerlo", async ({
  page,
}) => {
  // La capa de render de botín (Game.lootRenderTiles) expone el sprite que el compositor de
  // objetos dibuja: por celda, el TOPE de la pila, tile = id+0x100 (banco alto del atlas).
  // Sembramos gems(id8) al fondo y weapon(id5) al tope en (15,14); el render pinta la espada
  // (0x105). Cada (G)et retira el tope y revela el siguiente; al vaciar, la celda queda limpia.
  await gotoGame(page, { loc: 13, floor: 0, x: 15, y: 15, seed: 0x4242 });
  await seed(page, { location: 13, floor: 0, x: 15, y: 14, tile: 8, kind: "loot", loot: { id: 8, category: "gems", qty: 2 } });
  await seed(page, { location: 13, floor: 0, x: 15, y: 14, tile: 5, kind: "loot", loot: { id: 5, category: "equipment", qty: 1 } });

  expect(await lootRender(page)).toEqual([{ x: 15, y: 14, tile: 0x105 }]); // tope = ItemWeapon
  await page.locator("body").press("g");
  await page.locator("body").press("ArrowUp");
  expect(await lootRender(page)).toEqual([{ x: 15, y: 14, tile: 0x108 }]); // revela ItemGem
  await page.locator("body").press("g");
  await page.locator("body").press("ArrowUp");
  expect(await lootRender(page)).toEqual([]); // celda limpia
});

test("#21 · cofre anidado (id1): render=0x101; (G)et→'Open it first!'; (O)pen lo abre", async ({
  page,
}) => {
  await gotoGame(page, { loc: 13, floor: 0, x: 15, y: 15, seed: 0x4242 });
  await seed(page, {
    location: 13, floor: 0, x: 15, y: 14, tile: 1, kind: "loot", contents: 0x40, loot: { id: 1, category: "chest", qty: 0x40 },
  });
  expect(await lootRender(page)).toEqual([{ x: 15, y: 14, tile: 0x101 }]); // Chest

  await page.locator("body").press("g");
  await page.locator("body").press("ArrowUp");
  await expect.poll(() => consoleText(page)).toContain("Open it first!");
  // (G)et NO retira el cofre anidado.
  expect((await readState<WorldObject[]>(page, "worldObjects")).some((o) => o.kind === "loot" && o.loot?.id === 1)).toBe(true);

  await page.locator("body").press("o");
  await page.locator("body").press("ArrowUp");
  // (O)pen abre el cofre anidado: desaparece (su contenido se esparce o queda vacío).
  expect((await readState<WorldObject[]>(page, "worldObjects")).some((o) => o.kind === "loot" && o.loot?.id === 1)).toBe(false);
});

test("#21 · cofre anidado ENTERRADO: (G)et toma el tope, (O)pen recorre la pila y abre el cofre (fix)", async ({
  page,
}) => {
  // Pila con el cofre(id1) al FONDO y un weapon(id5) al TOPE. (G)et actúa sobre el tope → toma el
  // weapon (no "Open it first!"). (O)pen barre la pila (open_chest_world 0x1153), salta el weapon
  // y abre el cofre de debajo. Reproduce el bug del fix-round (lootAt tope literal fallaba).
  await gotoGame(page, { loc: 13, floor: 0, x: 15, y: 15, seed: 0x4242 });
  await seed(page, { location: 13, floor: 0, x: 15, y: 14, tile: 1, kind: "loot", contents: 0x20, loot: { id: 1, category: "chest", qty: 0x20 } });
  await seed(page, { location: 13, floor: 0, x: 15, y: 14, tile: 5, kind: "loot", loot: { id: 5, category: "equipment", qty: 1 } });
  expect(await lootRender(page)).toEqual([{ x: 15, y: 14, tile: 0x105 }]); // el tope pintado = weapon

  await page.locator("body").press("g"); // Get toma el weapon del tope, NO rechaza
  await page.locator("body").press("ArrowUp");
  // #261 — ANCLA POSITIVA antes de aserir la ausencia. Esto era
  // `expect.poll(...).not.toContain("Open it first!")`, que pasaba en la PRIMERA
  // evaluación (la ausencia es cierta antes de que llegue el mensaje) y por tanto no
  // esperaba ni medía nada. Ahora se aguarda a que el (G)et RESUELVA de verdad —el
  // weapon del tope sale de la capa de objetos— y sólo entonces se comprueba la
  // ausencia, sin poll, sobre un estado ya asentado.
  await expect
    .poll(async () =>
      (await readState<WorldObject[]>(page, "worldObjects")).some((o) => o.loot?.id === 5),
    )
    .toBe(false); // el weapon TOMADO
  expect(await consoleText(page)).not.toContain("Open it first!");
  expect((await readState<WorldObject[]>(page, "worldObjects")).some((o) => o.kind === "loot" && o.loot?.id === 1)).toBe(true); // cofre intacto (bajo)

  await page.locator("body").press("o"); // Open recorre la pila y abre el cofre enterrado
  await page.locator("body").press("ArrowUp");
  expect((await readState<WorldObject[]>(page, "worldObjects")).some((o) => o.kind === "loot" && o.loot?.id === 1)).toBe(false);
});

// ---------------------------------------------------------------------------
// (2) Antorcha de pared
// ---------------------------------------------------------------------------
test("(G)et sobre una antorcha de pared sube torches y la elimina", async ({ page }) => {
  await gotoGame(page, { loc: 13, floor: 0, x: 15, y: 15 });
  await seed(page, {
    location: 13, floor: 0, x: 15, y: 14, tile: 0x8f, kind: "torch",
  });
  const torchesBefore = await readState<number>(page, "torches");

  await page.locator("body").press("g");
  await page.locator("body").press("ArrowUp");

  // RE-ADJUDICADO (#54 pieza 11): el port emitía «Torch!», string FABRICADO. La rama
  // SJOG 0x1504 imprime el ENTERO (print_int 0x5abe) + " torch" (DS 0x8c8a) + sufijo
  // "!\n" (0x8c92) si la cantidad es 1 / "es!\n" (0x8c96) si no. Con la cantidad que
  // acredita el port (1) la línea fiel es «1 torch!». No es re-baseline de un rojo: el
  // valor viejo era el placeholder, este sale del binario.
  await expect.poll(() => consoleText(page)).toContain("1 torch!");
  expect(await readState<number>(page, "torches")).toBe(Math.min(0x63, torchesBefore + 1));
  expect(await readState<WorldObject[]>(page, "worldObjects")).toHaveLength(0);
});

// ---------------------------------------------------------------------------
// (3) Naval orgánico — compra viva + ciclo Board/dañar/X-it/re-abordar
// ---------------------------------------------------------------------------
/** ¿Hay tienda por consola abierta? (piel fiel; el panel DOM del shipwright era sólo-dev.) */
const shopOpen = (page: Page): Promise<boolean> =>
  page.evaluate(
    () => (window as unknown as { __u5test: { shopOpen?: () => boolean } }).__u5test.shopOpen?.() ?? false,
  );
/** Opciones {key,label} de la tienda por consola actual. */
const shopOptions = (page: Page): Promise<{ key: string; label: string }[]> =>
  page.evaluate(
    () =>
      (window as unknown as { __u5test: { shopConsole?: () => { options: { key: string; label: string }[] } | null } })
        .__u5test.shopConsole?.()?.options ?? [],
  );

test("comprar en el Shipwright VIVO coloca la nave en el muelle del overworld (loc 0)", async ({
  page,
}) => {
  // East_Britanny (loc 21): shipwright (dialogNumber 0x84). hour=10: gate horario de
  // #315 — sus times [18,9,11,13] (npcs.json loc 21 slot 2) dan scheduleIndex 1 (impar
  // = ATIENDE) de 9 a 10; a la hora INIT (8:35) el índice es 0, el tendero rechaza con
  // «Come see me...» Y además está en su casilla de descanso (3,26) — en tramo abierto
  // su puesto es (7,10) y deambula (aiType 4), así que la posición se lee VIVA y la
  // party se teleporta adyacente (patrón del GuildMaster de shop.spec). Shipwright
  // idx=2 en SHOP_TOWNES → muelle SHIP_DOCK_X/Y[2] = (79,109). El menú del shipwright
  // ES la lista de naves: una tecla por nave ("Frigate — N gp").
  await gotoGame(page, { loc: 21, floor: 0, x: 15, y: 15, hour: 10 });
  const npc = await page.evaluate(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const g = (window as any).__u5test.game;
    const wright = g.npcManager.npcsAt(21, 0).find((n: { dialogNumber: number }) => n.dialogNumber === 0x84);
    return wright ? { x: wright.x, y: wright.y } : null;
  });
  expect(npc, "el shipwright de East Britanny está en la planta 0").not.toBeNull();
  await page.evaluate((p) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const s = (window as any).__u5test.state();
    s.position.x = p!.x + 1;
    s.position.y = p!.y;
  }, npc);
  await setGold(page, 5000); // el precio regateado de la fragata supera el oro INIT
  const goldBefore = await readState<number>(page, "gold");

  await page.locator("body").press("t");
  await page.locator("body").press("ArrowLeft"); // Talk hacia el shipwright adyacente al oeste
  await expect.poll(() => shopOpen(page)).toBe(true);
  // Gate Y/N del saludo (C4, SHOPPES2 0xad4): 'y' entra a la lista de naves.
  await page.locator("body").press("y");
  await expect.poll(async () => ((await shopOptions(page)).some((o) => /Frigate/.test(o.label)))).toBe(true);

  const frigateKey = (await shopOptions(page)).find((o) => /Frigate/.test(o.label))?.key;
  expect(frigateKey, "el shipwright ofrece una Frigate por tecla").toBeTruthy();
  await page.locator("body").press(frigateKey!);
  // RE-BASELINE 2026-07-25: elegir la nave ya no compra — el flujo calcado del astillero
  // añadió su fase `ship-take` (pitch + «Wilt thou take it?» + Sí/No, SHOPPES 0x940 con
  // el precio expandido en la plantilla). La compra la cierra la 'y'. El test databa de
  // antes de ese calco y llevaba sin poder correr desde el 22-07 (la suite e2e por
  // defecto no arrancaba: import de JSON sin atributo en core/world/commands.ts).
  await expect.poll(async () => (await shopOptions(page)).some((o) => o.key === "y")).toBe(true);
  await page.locator("body").press("y");

  // El oro baja (precio regateado) y la nave aparece como objeto en el muelle del
  // OVERWORLD: fragata (tile 0x25, hull 99, 2 skiffs).
  expect(await readState<number>(page, "gold")).toBeLessThan(goldBefore);
  const ships = (await readState<WorldObject[]>(page, "worldObjects")).filter(
    (o) => o.kind === "ship",
  );
  expect(ships).toHaveLength(1);
  // tile en el BANCO ALTO (#137): `spawnDockShip` guarda `purchasedShipTile(flags) + 0x100`
  // porque la capa de objetos del port vive en el espacio de tile COMPLETO — el 0x25 pelado
  // que este aserto esperaba es el BYTE del registro del binario, no el tile del port.
  expect(ships[0]).toMatchObject({ location: 0, x: 79, y: 109, tile: 0x125, hull: 99, skiffs: 2 });
});

test("ciclo naval orgánico: Board → dañar → X-it re-atraca con hull vivo → re-abordar avisa DANGER", async ({
  page,
}) => {
  // Costa del overworld (150,20) = agua (tile 2) con tierra walkable ortogonal al
  // este (151,20). Sembramos una fragata en la celda del party y la abordamos.
  await gotoGame(page, { loc: 0, floor: 0, x: 150, y: 20, hour: 12, seed: 4242 });
  await seed(page, {
    // 0x124 = fragata velas arriadas N EN EL BANCO ALTO (#137): `board()` discrimina «hay
    // vehículo» por `tileAt(...) >= 0x100`; con el byte pelado 0x24 el despacho cae al
    // «What?» por defecto y la party se queda a pie.
    location: 0, floor: 0, x: 150, y: 20, tile: 0x124, kind: "ship", hull: 99, skiffs: 2,
  });

  await page.locator("body").press("b"); // (B)oard la fragata del objeto
  expect(await readState<string>(page, "transport")).toBe("ship");
  expect(await readState<WorldObject[]>(page, "worldObjects")).toHaveLength(0); // retirada

  // La nave sufre daño (seam de test: hull directo a slot0).
  await page.evaluate(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as any).__u5test.game.state.shipHull = 5;
  });

  await page.locator("body").press("x"); // X-it en tierra → re-atraca la nave
  expect(await readState<string>(page, "transport")).toBe("foot");
  const parked = (await readState<WorldObject[]>(page, "worldObjects")).filter(
    (o) => o.kind === "ship",
  );
  expect(parked).toHaveLength(1);
  expect(parked[0]!.hull).toBe(5); // hull VIVO preservado en el objeto re-atracado

  await page.locator("body").press("b"); // re-abordar la nave malparada
  expect(await readState<string>(page, "transport")).toBe("ship");
  await expect.poll(() => consoleText(page)).toContain("DANGER"); // hull<10 (board 0x08E5)
});

// ---------------------------------------------------------------------------
// (4) Persistencia — guardar/cargar conserva worldObjects (patrón fix #49)
// ---------------------------------------------------------------------------
function savePanelOf(page: Page) {
  return page.locator(".save-panel", {
    has: page.locator(".save-title", { hasText: "Journeys" }),
  });
}

test("un objeto del mundo sobrevive a guardar y cargar (F5)", async ({ page }) => {
  await gotoGame(page, { loc: 0, x: 76, y: 40, hour: 10 });
  await seed(page, {
    // Banco alto (#137), como los demás objetos-nave de este fichero. Este test ya pasaba
    // con el byte pelado (su sujeto es el round-trip del campo, y el aserto es simétrico):
    // se alinea para que el fichero no enseñe DOS convenciones para el mismo campo.
    location: 0, floor: 0, x: 79, y: 109, tile: 0x125, kind: "ship", hull: 42, skiffs: 1,
  });
  expect(await readState<WorldObject[]>(page, "worldObjects")).toHaveLength(1);

  await page.keyboard.press("F5");
  const panel = savePanelOf(page);
  await expect(panel).toBeVisible();
  await panel.locator("input.save-name").fill("con-objeto");
  await panel.locator(".save-btn-save").click();
  await expect(panel.locator(".save-slot", { hasText: "con-objeto" })).toBeVisible();

  // Vacía la lista viva para que la carga tenga algo real que restaurar (no un no-op).
  await page.evaluate(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as any).__u5test.game.state.worldObjects.length = 0;
  });
  expect(await readState<WorldObject[]>(page, "worldObjects")).toHaveLength(0);

  await panel.locator(".save-slot", { hasText: "con-objeto" }).locator(".save-btn-load").click();
  await expect(panel).toBeHidden();

  const restored = await readState<WorldObject[]>(page, "worldObjects");
  expect(restored).toHaveLength(1);
  expect(restored[0]).toMatchObject({ location: 0, x: 79, y: 109, tile: 0x125, hull: 42, skiffs: 1 });
});
