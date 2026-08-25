/**
 * Task E2E-7 — Journey de tienda: precios por INTELIGENCIA byte-exactos en el browser
 * real (ShopConsole + core/shops/shops.ts).
 *
 * PIEL FIEL (jubilada la piel dev, fase 2): ~~el binario NUNCA abre ventana~~ **ABSOLUTO
 * FALSO, retirado #327** — y aquí el sujeto es JUSTO el que lo desmiente: SHOPPES.OVL abre
 * DOS ventanas (`set_text_window`, kernel 0x1c22) y emite el juego COMPLETO de los siete
 * glifos de marco por `putChar` (0x16ba), igual que SHOPPES3 (posada, #283) y ZSTATS. Las
 * dos ventanas de tienda ya portadas: «Arms» del sell del herrero y el GUEST REGISTER de la
 * posada (#283, 02b3a158). Lo cierto y acotado: la TIENDA ORDINARIA — el mercader
 * es una CONVERSACIÓN dentro del marco EGA (SHOPPES*.OVL): saluda, ofrece un menú POR
 * TECLA y la selección de ítem va por letra en la MISMA consola. El viejo `ShopPanel` DOM
 * (botones/inputs) era QoL exclusivo de la piel dev y se retiró. Este spec conduce el
 * comercio DESDE LA TECLA vía el hook lógico `__u5test.shopConsole()` (mismo canal que la
 * piel fiel pinta), sin depender de píxeles — el MECANISMO genérico ya lo cubre
 * `grandtour/shops-console.spec.ts`; aquí se fija el CÁLCULO byte-exacto de precios.
 *
 * Tienda usada: Iolo's Bows (Britain, loc 2), herrero Gwenneth. El herrero (slot 1 de
 * assets/npcs.json, dialogNumber 0x81) spawnea en (4,19) planta 0 a la hora INIT (8:35);
 * Talk no avanza turno, así que su posición es determinista entre el deep-link y la tienda.
 *
 * Fórmulas EXACTAS (core/shops/shops.ts, derivadas de SHOPPES.OVL, Task 3.6):
 *   compra = base + ⌊base·(100 − 3·INT)/100⌋         (dos pasos, trunc→0)
 *   venta  = ⌊3·INT·base/100⌋ + 1
 * El Avatar de "Journey Onward" tiene INT = 15 (assets/initial-state.json).
 *
 * Item elegido: Bow (Equipment id 26, base 75 en data.json:equipmentBasePrices).
 *   compra(INT 15) = 75 + ⌊75·(100−45)/100⌋ = 75 + ⌊41.25⌋ = 116
 *   venta (INT 15) = ⌊3·15·75/100⌋ + 1 = 33 + 1 = 34
 * El Bow arranca con cantidad 0 (initial-state), así que "Bow (×1)" en la lista de venta
 * sólo aparece tras comprarlo — sin colisión con el equipo inicial del party.
 *
 * Etiquetas de la consola: cada opción es `{ key, label }`; la lista de compra rotula
 * `"<Nombre> — <precio> gp"` y se elige POR LETRA. La VENTA (T-004b) ya no va por letra:
 * se presenta en la ventana «Arms» del panel (`list_wares` SHOPPES.OVL 0x0c80, fila
 * `N-Abbrev` sin precio) y se navega con ↑/↓ + Enter (Space/ESC → menú). El snapshot
 * lógico `options` conserva las etiquetas `"<Nombre> (×<qty>) — <precio> gp"` en el
 * MISMO orden que las filas de la ventana (mapeo índice→fila para este spec). Comprar/
 * vender NO cierra la tienda (re-renderiza la misma lista); para pasar de compra a venta
 * hay que SALIR (Space = despedida) y volver a hablar.
 */
import { test, expect, type Page } from "@playwright/test";
import { gotoGame, readState, consoleText } from "./helpers";

const BOW_ID = 26;
const BOW_BASE = 75; // data.json:equipmentBasePrices[26]

/** Réplica en el spec de shopBuyPrice/shopSellPrice (byte-exactas). */
const buyPrice = (base: number, int: number): number =>
  base + Math.trunc((base * (100 - 3 * int)) / 100);
const sellPrice = (base: number, int: number): number =>
  Math.trunc((3 * int * base) / 100) + 1;

interface ShopSnap {
  type: string;
  phase: string;
  options: { key: string; label: string }[];
}

/** Vista lógica de la tienda por consola (mismo canal que pinta la piel fiel). */
const shopSnap = (page: Page): Promise<ShopSnap | null> =>
  page.evaluate(
    () =>
      (window as unknown as { __u5test: { shopConsole?: () => ShopSnap | null } }).__u5test.shopConsole?.() ??
      null,
  );
const shopOpen = (page: Page): Promise<boolean> =>
  page.evaluate(
    () => (window as unknown as { __u5test: { shopOpen?: () => boolean } }).__u5test.shopOpen?.() ?? false,
  );
const press = (page: Page, key: string): Promise<void> => page.locator("body").press(key);

/** Tecla de la opción cuyo label casa `re` en el snapshot actual, o undefined. */
async function optionKey(page: Page, re: RegExp): Promise<string | undefined> {
  const snap = await shopSnap(page);
  return snap?.options.find((o) => re.test(o.label))?.key;
}

/**
 * Deep-link junto al herrero (5,19), abre su tienda con Talk-Oeste (hacia 4,19) y
 * salta la PAUSA de pacing del saludo (getkey 0x83dc: cualquier tecla imprime la
 * atribución `$ says,` + la pregunta Buy/Sell) hasta dejar el menú armado.
 */
async function openBlacksmith(page: Page): Promise<void> {
  await gotoGame(page, { loc: 2, floor: 0, x: 5, y: 19 });
  await press(page, "t");
  await press(page, "ArrowLeft"); // hacia el NPC en (4,19)
  await expect.poll(() => shopOpen(page)).toBe(true);
  const snap = await shopSnap(page);
  expect(snap?.type, "es el herrero (Blacksmith)").toBe("Blacksmith");
  expect(snap?.phase, "el welcome arma la pausa de pacing (SHOPPES 0x12c3)").toBe("blacksmith-pause");
  await press(page, "Enter"); // getkey de pacing: la tecla se descarta
  await expect.poll(async () => (await shopSnap(page))?.phase).toBe("menu");
}

// ── Saludos de tienda (carril saludos-shoppe) ───────────────────────────────────────────
// Derivación completa en re/notes/shoppe-greetings-witness.md: herrero = SHOPPES 0x12b2
// (welcome DS 0x8018 + `$ says,` + pregunta rand(0,1) DS 0x7f48/0x7f70); los 7 tipos de
// tabla = emisor 0x01b6 (comilla + plantilla shoppe.json[tabla 0x3b2a][rand(0,3)] con
// $/#/@ expandidos). El rand es del stream VIVO (ruling paridad FIEL-TOTAL). Las
// PLANTILLAS reales son asset de EA → aquí se asevera la ESTRUCTURA (comilla de
// apertura, expansión sin placeholders crudos, parte del día por g_hour), no su texto.

test("el herrero saluda al entrar: welcome expandido + PAUSA por tecla (0x83dc) + pregunta Buy/Sell 1-de-2", async ({ page }) => {
  // Flujo por fases (sin openBlacksmith, que salta la pausa): welcome → pausa → pregunta.
  await gotoGame(page, { loc: 2, floor: 0, x: 5, y: 19 });
  await press(page, "t");
  await press(page, "ArrowLeft");
  await expect.poll(() => shopOpen(page)).toBe(true);
  let text = await consoleText(page);
  // Welcome DS 0x8018 con @ y # expandidos (hora INIT 8:35 → morning; tienda de Britain).
  expect(text).toContain('"Good morning, and welcome to Iolo\'s Bows!"');
  // PAUSA de pacing (getkey SHOPPES 0x12c3): la atribución y la pregunta AÚN no salen.
  expect(text).not.toContain("Gwenneth says,");
  expect((await shopSnap(page))?.phase, "la pausa queda armada").toBe("blacksmith-pause");
  // Cualquier tecla continúa (el getkey la descarta).
  await press(page, "Enter");
  await expect.poll(async () => (await shopSnap(page))?.phase).toBe("menu");
  text = await consoleText(page);
  // Atribución DS 0x8036 con $ expandido (Gwenneth, herrera de Britain).
  expect(text).toContain("Gwenneth says,");
  // Pregunta 1-de-2 (rand(0,1) del stream vivo, tabla DS 0x3d46) con cierre `" `.
  expect(text).toMatch(/Wouldst thou Buy or Sell\?" |Wish ye to Buy, or hast thou wares to Sell\?" /);
  // Sin placeholders crudos tras la expansión.
  expect(text).not.toMatch(/[#$@]/);
});

test("el MagicSeller saluda (plantilla 1-de-4 expandida) y pregunta Y/N: 'Y' ecoa Yes+lista, 'n' ecoa No y despide", async ({ page }) => {
  // Jhelom (loc 7): su MagicSeller (dialogNumber 0x85) vive en la planta 0 en todas las
  // franjas del schedule. Posición VIVA en runtime (deambula) + party adyacente (patrón
  // del test del GuildMaster).
  // hour=10: gate horario de #315 (shopIsOpen = bit 0 del scheduleIndex). Sus times
  // [19,9,17,18] (npcs.json loc 7 slot 1) dan índice 1 (impar = ATIENDE) de 9 a 16;
  // a la hora INIT (8:35) el índice es 0 y el tendero rechaza con «Come see me...».
  await gotoGame(page, { loc: 7, floor: 0, x: 8, y: 6, hour: 10 });
  const npc = await page.evaluate(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const g = (window as any).__u5test.game;
    const seller = g.npcManager.npcsAt(7, 0).find((n: { dialogNumber: number }) => n.dialogNumber === 0x85);
    return seller ? { x: seller.x, y: seller.y } : null;
  });
  expect(npc).not.toBeNull();
  await page.evaluate((p) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const s = (window as any).__u5test.state();
    s.position.x = p!.x + 1;
    s.position.y = p!.y;
  }, npc);
  await press(page, "t");
  await press(page, "ArrowLeft");
  await expect.poll(() => shopOpen(page)).toBe(true);

  // Fase Y/N del saludo (SHOPPES 0x75e): el saludo terminó en pregunta.
  let snap = await shopSnap(page);
  expect(snap?.type).toBe("MagicSeller");
  expect(snap?.phase, "el saludo del MagicSeller arma el Y/N").toBe("greet-yn");
  expect((snap?.options ?? []).map((o) => o.key).sort()).toEqual(["n", "y"]);

  // El saludo salió por consola: comilla de apertura + expansión completa ($/#/@ fuera).
  const greet = await consoleText(page);
  expect(greet).toMatch(/^"/m);
  expect(greet).not.toMatch(/[#$@]/);

  // Tecla no válida RE-LEE (getkey 0x772 solo acepta Y/N/espacio): sigue en greet-yn.
  await press(page, "q");
  expect((await shopSnap(page))?.phase).toBe("greet-yn");

  // 'Y' → eco DS 0x7a2c (`Yes` + `"Fine! We sell:`) + lista de reactivos + interest.
  await press(page, "y");
  await expect.poll(async () => (await shopSnap(page))?.phase).toBe("reagent-list");
  const afterYes = await consoleText(page);
  expect(afterYes).toContain("Yes");
  expect(afterYes).toContain('"Fine! We sell:');
  expect(afterYes).toContain('Thy interest?"');
  expect(((await shopSnap(page))?.options ?? []).length).toBeGreaterThan(0);

  // Salir y reabrir: 'n' → eco `No` (DS 0x7a44) + despedida + tienda cerrada.
  await press(page, "Space");
  await expect.poll(() => shopOpen(page)).toBe(false);
  await press(page, "t");
  await press(page, "ArrowLeft");
  await expect.poll(() => shopOpen(page)).toBe(true);
  expect((await shopSnap(page))?.phase).toBe("greet-yn");
  await press(page, "n");
  await expect.poll(() => shopOpen(page)).toBe(false);
  const afterNo = await consoleText(page);
  expect(afterNo).toContain("No");
  // Despedida fiel 1-de-4 (SHOPPES 0x0202; sin compra → tabla DS 0x3b6a) + atribución
  // `says $.` (DS 0x785c). El registro es asset de EA → se asevera la ESTRUCTURA:
  // línea entrecomillada de cierre + línea `says <tendero>.`, sin placeholders crudos.
  expect(afterNo).toMatch(/^"[^"]+"$/m);
  expect(afterNo).toMatch(/^says [^\n]+\.$/m);
  expect(afterNo).not.toMatch(/[#$@]/);
});

test("comprar un Bow en Iolo's Bows cobra base+⌊base·(100−3·INT)/100⌋ y lo añade al inventario", async ({ page }) => {
  await openBlacksmith(page);

  const int = await readState<number>(page, "characters[0].intelligence");
  expect(int).toBe(15);
  const expectedBuy = buyPrice(BOW_BASE, int); // 116
  expect(expectedBuy).toBe(116); // literal de la derivación (regresión del cálculo)

  // Menú → 'Buy' → eco `Buy` + charla 1-de-4 ×2 (rama 'B' 0x1306) + lista fiel
  // `letra...Nombre` SIN precio (bucle 0x0b30; carril buy-herrero).
  const buyKey = await optionKey(page, /^Buy$/);
  expect(buyKey, "el menú del herrero ofrece Buy por tecla").toBeTruthy();
  await press(page, buyKey!);
  await expect.poll(async () => (await shopSnap(page))?.phase).toBe("buy-list");
  // (El eco `Buy` puede haber scrolleado fuera de la ventana de consola: se asevera
  // la charla + lista, que es lo que queda visible.)
  const listText = await consoleText(page);
  // exclamación 1-de-4 (rand(0,3), tabla DS 0x3d4a) + presentación 1-de-4 (DS 0x3d52)
  expect(listText).toMatch(/"(Very good!|Excellent!|Fine, fine!|But of course!)/);
  expect(listText).toMatch(/(We have:|We stock:|Thou canst buy:|We've got:)/);
  expect(listText).toContain("c...Bow"); // fila fiel: letra + `...` (DS 0x7c48) + nombre, sin precio
  // pregunta 1-de-4 tras la lista (rand(0,3), tabla DS 0x3cb6) con su cierre `" `
  expect(listText).toMatch(
    /(What may I show thee\?|Which wouldst thou like to see\?|What is thine interest\?|Which would ye see\?)" /,
  );

  // El snapshot del arnés rotula el precio byte-exacto en la opción del ítem.
  const bowKey = await optionKey(page, new RegExp(`^Bow — ${expectedBuy} gp$`));
  expect(bowKey, `debe haber una opción "Bow — ${expectedBuy} gp"`).toBeTruthy();

  const goldBefore = await readState<number>(page, "gold");
  expect(goldBefore).toBe(150);
  expect(await readState<number>(page, `equipmentQuantities[${BOW_ID}]`)).toBe(0);

  // Letra → PITCH del ítem (buy_one_item 0x09ac: plantilla con %=precio) + Y/N.
  await press(page, bowKey!);
  await expect.poll(async () => (await shopSnap(page))?.phase).toBe("buy-deal");
  const pitch = await consoleText(page);
  expect(pitch).toContain(`${expectedBuy} gold`); // «This fine yew Bow costs but 116 gold…»
  expect(pitch).not.toMatch(/[#$@%]/); // sin placeholders crudos
  expect(await readState<number>(page, `equipmentQuantities[${BOW_ID}]`)).toBe(0); // aún sin comprar

  // 'Y' → compra. El oro baja EXACTAMENTE el precio y aparece en el inventario.
  await press(page, "y");
  await expect.poll(async () => (await shopSnap(page))?.phase).toBe("buy-list"); // re-lista (0x0c49)
  const goldAfter = await readState<number>(page, "gold");
  expect(goldBefore - goldAfter).toBe(expectedBuy); // 150 − 116
  expect(goldAfter).toBe(34);
  expect(await readState<number>(page, `equipmentQuantities[${BOW_ID}]`)).toBe(1);
  // La re-lista sincrónica (0x0c49) puede scrollear el `Sold!` (DS 0x7bb4) fuera de
  // la ventana: se asevera el epílogo (DS 0x7bbc + cola de género), que queda visible.
  const afterBuy = await consoleText(page);
  expect(afterBuy).toContain("Anything else,");
  expect(afterBuy).toMatch(/(then\?|sir\?|milady\?)/);
});

test("todo el stock del herrero muestra el precio de compra byte-exacto por INT", async ({ page }) => {
  await openBlacksmith(page);
  const int = await readState<number>(page, "characters[0].intelligence");

  await press(page, (await optionKey(page, /^Buy$/))!);
  await expect.poll(async () => (await shopSnap(page))?.phase).toBe("buy-list");

  // Stock de Britain (weaponsSoldByMerchants[0] = ids 16,17,26,27,28,29,36) con su base
  // real de data.json:equipmentBasePrices. Cada opción debe rotular el precio que devuelve
  // la fórmula de compra para la INT del Avatar.
  const stock: Array<[string, number]> = [
    ["Dagger", 1],
    ["Sling", 10],
    ["Bow", 75],
    ["Arrows", 10],
    ["Crossbow", 150],
    ["Quarrels", 15],
    ["Magic Bow", 800],
  ];
  const snap = await shopSnap(page);
  const labels = (snap?.options ?? []).map((o) => o.label);
  for (const [label, base] of stock) {
    const expected = buyPrice(base, int);
    expect(labels, `${label} debe rotular ${expected} gp`).toContain(`${label} — ${expected} gp`);
  }
});

test("vender el Bow recién comprado paga ⌊3·INT·base/100⌋+1", async ({ page }) => {
  await openBlacksmith(page);
  const int = await readState<number>(page, "characters[0].intelligence");
  const expectedBuy = buyPrice(BOW_BASE, int); // 116
  const expectedSell = sellPrice(BOW_BASE, int); // 34
  expect(expectedSell).toBe(34); // literal de la derivación

  // Compra primero (la fila de venta sólo existe con cantidad > 0). El flujo fiel
  // pasa por el pitch + Y/N (carril buy-herrero).
  await press(page, (await optionKey(page, /^Buy$/))!);
  await expect.poll(async () => (await shopSnap(page))?.phase).toBe("buy-list");
  await press(page, (await optionKey(page, new RegExp(`^Bow — ${expectedBuy} gp$`)))!);
  await expect.poll(async () => (await shopSnap(page))?.phase).toBe("buy-deal");
  await press(page, "y");
  await expect.poll(async () => (await shopSnap(page))?.phase).toBe("buy-list");
  expect(await readState<number>(page, `equipmentQuantities[${BOW_ID}]`)).toBe(1);

  // Comprar re-renderiza la lista de compra: salir (Space = despedida) y reabrir para
  // llegar al menú y de ahí a la lista de venta.
  await press(page, "Space");
  await expect.poll(() => shopOpen(page)).toBe(false);
  await press(page, "t");
  await press(page, "ArrowLeft");
  await expect.poll(() => shopOpen(page)).toBe(true);
  // Reabrir re-arma la pausa de pacing del saludo (0x83dc): una tecla la salta.
  await press(page, "Enter");
  await expect.poll(async () => (await shopSnap(page))?.phase).toBe("menu");

  // Menú → 'Sell' → ventana «Arms» (T-004b): la barra arranca en la primera fila; se
  // baja con ↓ hasta el Bow (mismo orden snapshot↔ventana) y se vende con Enter. El
  // snapshot lógico sigue rotulando "Bow (×1) — 34 gp" (precio byte-exacto).
  await press(page, (await optionKey(page, /^Sell$/))!);
  await expect.poll(async () => (await shopSnap(page))?.phase).toBe("sell-list");
  const sellSnap = await shopSnap(page);
  const bowRe = new RegExp(`^Bow \\(×1\\) — ${expectedSell} gp$`);
  const sellIdx = (sellSnap?.options ?? []).findIndex((o) => bowRe.test(o.label));
  expect(sellIdx, `debe haber "Bow (×1) — ${expectedSell} gp"`).toBeGreaterThanOrEqual(0);

  const goldBefore = await readState<number>(page, "gold");
  expect(goldBefore).toBe(34); // 150 − 116
  for (let i = 0; i < sellIdx; i++) await press(page, "ArrowDown");
  await press(page, "Enter");

  // OFERTA + Deal? Y/N (sell_one_item SHOPPES 0x0e76, carril sell-offers): el Enter ya
  // NO vende directo — emite la plantilla rand(0,7) con %=precio &=nombre y espera
  // 'Y'/'N' (fase sell-deal). La venta ejecuta con 'Y'.
  await expect.poll(async () => (await shopSnap(page))?.phase).toBe("sell-deal");
  expect(await readState<number>(page, `equipmentQuantities[${BOW_ID}]`)).toBe(1); // aún sin vender
  await press(page, "y");

  const goldAfter = await readState<number>(page, "gold");
  expect(goldAfter - goldBefore).toBe(expectedSell); // +34
  expect(goldAfter).toBe(68);
  expect(await readState<number>(page, `equipmentQuantities[${BOW_ID}]`)).toBe(0);
});

// ── GuildMaster / mercado negro (#51) ───────────────────────────────────────────────────
// El gremio (dialogNumber 0x86, SHOP_TOWNES.GuildMaster = [8,22,24]) es el ÚNICO vendedor
// de llaves/gemas/antorchas. Buccaneer's Den (loc 24) = town2 → GUILD_PRICES[2] = [keys 185,
// gems 225, torches 25]. El NPC spawnea a la hora del deep-link; su posición se lee en runtime.
// El menú del gremio ES la lista de productos (una tecla por lote fijo): keys +3 / gems +4 /
// torches +5.

test("el GuildMaster vende llaves/gemas/antorchas y la compra de Keys da +3 al precio por INT", async ({ page }) => {
  // Llegar a Buccaneer's Den (loc 24) — el deep-link fuerza fresh + enterMap(24), hidrata NPCs.
  // hour=10: gate horario de #315. Times del gremio [21,9,12,13] (npcs.json loc 24 slot 1)
  // → scheduleIndex 1 (impar = ATIENDE) de 9 a 11; a la hora INIT (8:35) da 0 y rechaza.
  await gotoGame(page, { loc: 24, floor: 0, x: 15, y: 15, hour: 10 });

  // Posición REAL del NPC del gremio (dialogNumber 0x86) tras el spawn.
  const npc = await page.evaluate(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const g = (window as any).__u5test.game;
    const guild = g.npcManager.npcsAt(24, 0).find((n: { dialogNumber: number }) => n.dialogNumber === 0x86);
    return guild ? { x: guild.x, y: guild.y } : null;
  });
  expect(npc).not.toBeNull();

  // Colocar al party al ESTE del NPC (para hablar al Oeste) y darle oro de sobra.
  await page.evaluate((p) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const s = (window as any).__u5test.state();
    s.position.x = p!.x + 1;
    s.position.y = p!.y;
    s.gold = 1000;
  }, npc);

  await press(page, "t");
  await press(page, "ArrowLeft"); // Talk-Oeste hacia el NPC del gremio
  await expect.poll(() => shopOpen(page)).toBe(true);
  let snap = await shopSnap(page);
  expect(snap?.type).toBe("GuildMaster");

  // GATE Y/N del saludo (C4, SHOPPES 0x4b6): el saludo del gremio termina en pregunta.
  expect(snap?.phase, "el saludo del gremio arma el Y/N").toBe("greet-yn");
  await press(page, "y");
  await expect.poll(async () => (await shopSnap(page))?.phase).toBe("guild-list");
  snap = await shopSnap(page);

  // Eco fiel `Yes\n\n"We sell:` (DS 0x7916) + filas fijas + `Thy concern?" ` (0x7906).
  const listText = await consoleText(page);
  expect(listText).toContain('"We sell:');
  expect(listText).toContain("a.........Keys");
  expect(listText).toContain("b.........Gems");
  expect(listText).toContain("c......Torches");
  expect(listText).toContain('Thy concern?"');

  // Los TRES productos del gremio presentes con su lote fijo (keys +3 / gems +4 / torches +5)
  // y NO el placeholder de "fase posterior".
  const labels = (snap?.options ?? []).map((o) => o.label).join("\n");
  expect(labels).toContain("Keys (×3)");
  expect(labels).toContain("Gems (×4)");
  expect(labels).toContain("Torches (×5)");
  expect(await consoleText(page)).not.toContain("fase posterior");

  const int = await readState<number>(page, "characters[0].intelligence");
  const KEYS_BASE = 185; // GUILD_PRICES[2][0] (Buccaneer's Den)
  const expectedKeys = buyPrice(KEYS_BASE, int);

  const keysKey = await optionKey(page, new RegExp(`^Keys \\(×3\\) — ${expectedKeys} gp$`));
  expect(keysKey, `debe haber "Keys (×3) — ${expectedKeys} gp"`).toBeTruthy();

  const goldBefore = await readState<number>(page, "gold");
  const keysBefore = await readState<number>(page, "keys");
  await press(page, keysKey!);

  // CADENA fiel (buy_one_guild 0x2ba): pitch shoppe[160] con el precio + `Interested?" `
  // → Y/N; la compra sólo ejecuta al confirmar.
  await expect.poll(async () => (await shopSnap(page))?.phase).toBe("guild-deal");
  const pitchText = await consoleText(page);
  expect(pitchText).toContain('Interested?"');
  expect(pitchText).toContain(String(expectedKeys)); // % = precio interpolado en el pitch
  expect(await readState<number>(page, "keys")).toBe(keysBefore); // aún sin comprar
  await press(page, "y");

  await expect.poll(async () => await readState<number>(page, "keys")).toBe(keysBefore + 3); // lote fijo +3
  expect(goldBefore - (await readState<number>(page, "gold"))).toBe(expectedKeys); // cobro por INT
  // Epílogo `"Sold!" says $.` + What-else con género y RE-LISTA (0x46e→0x40d).
  const soldText = await consoleText(page);
  expect(soldText).toContain('"Sold!"');
  expect((await shopSnap(page))?.phase).toBe("guild-list");
});

// ── C2/diff-1 · Cadena de confirmación del reactivo (buy_one_reagent SHOPPES 0x502) ──
test("comprar un reactivo: pitch por-slot + `Is this thy need?` Y/N; 'N' re-lista y 'Y' cobra + thanks", async ({ page }) => {
  // Jhelom (loc 7): MagicSeller (dialogNumber 0x85), patrón del test del saludo.
  // hour=10: dentro del tramo del tendero (times [19,9,17,18] → índice 1 de 9 a 16;
  // gate horario #315 — a la hora INIT rechazaba con «Come see me...»).
  await gotoGame(page, { loc: 7, floor: 0, x: 8, y: 6, hour: 10 });
  const npc = await page.evaluate(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const g = (window as any).__u5test.game;
    const seller = g.npcManager.npcsAt(7, 0).find((n: { dialogNumber: number }) => n.dialogNumber === 0x85);
    return seller ? { x: seller.x, y: seller.y } : null;
  });
  expect(npc).not.toBeNull();
  await page.evaluate((p) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const s = (window as any).__u5test.state();
    s.position.x = p!.x + 1;
    s.position.y = p!.y;
    s.gold = 500;
  }, npc);
  await press(page, "t");
  await press(page, "ArrowLeft");
  await expect.poll(() => shopOpen(page)).toBe(true);
  await press(page, "y"); // gate del saludo → lista
  await expect.poll(async () => (await shopSnap(page))?.phase).toBe("reagent-list");
  const firstKey = (await shopSnap(page))!.options[0]!.key;

  // Letra → PITCH del slot (shoppe.json[139+slot], %=precio ^=cantidad) + prompt Y/N.
  await press(page, firstKey);
  await expect.poll(async () => (await shopSnap(page))?.phase).toBe("reagent-deal");
  const pitch = await consoleText(page);
  expect(pitch).toContain('Is this thy need?"');
  expect(pitch).not.toMatch(/[%^]/); // % y ^ expandidos (precio/cantidad)

  // 'N' (0x5f5): eco `No` + `"What else?` y RE-LISTA (sin cobrar).
  const goldBefore = await readState<number>(page, "gold");
  await press(page, "n");
  await expect.poll(async () => (await shopSnap(page))?.phase).toBe("reagent-list");
  expect(await consoleText(page)).toContain('"What else?');
  expect(await readState<number>(page, "gold")).toBe(goldBefore);

  // Letra + 'Y' (0x600): cobra, `"I thank thee!" says $.` + `"Anything else?` y re-lista.
  const reagentsBefore = await readState<number[]>(page, "reagentQuantities");
  await press(page, firstKey);
  await expect.poll(async () => (await shopSnap(page))?.phase).toBe("reagent-deal");
  await press(page, "y");
  await expect.poll(async () => (await shopSnap(page))?.phase).toBe("reagent-list");
  const bought = await consoleText(page);
  expect(bought).toContain('"I thank thee!"');
  expect(bought).toContain('"Anything else?');
  expect(await readState<number>(page, "gold")).toBeLessThan(goldBefore); // cobrado
  const reagentsAfter = await readState<number[]>(page, "reagentQuantities");
  expect(reagentsAfter.reduce((a, b) => a + b, 0)).toBeGreaterThan(reagentsBefore.reduce((a, b) => a + b, 0));
});

// ── C3/C4 · Cadena del curandero (SHOPPES 0x14f8/0x137c/0x146a) ─────────────────────
test("curandero: gate Y/N + nature-of-need + cotización `Wilt thou pay?` + epílogo any-other-way", async ({ page }) => {
  // Cove (loc 23): healer (dialogNumber 0x87).
  await gotoGame(page, { loc: 23, floor: 0, x: 15, y: 15 });
  const npc = await page.evaluate(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const g = (window as any).__u5test.game;
    const healer = g.npcManager.npcsAt(23, 0).find((n: { dialogNumber: number }) => n.dialogNumber === 0x87);
    return healer ? { x: healer.x, y: healer.y } : null;
  });
  expect(npc).not.toBeNull();
  await page.evaluate((p) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const s = (window as any).__u5test.state();
    s.position.x = p!.x + 1;
    s.position.y = p!.y;
    s.gold = 500;
    s.characters[0].currentHp = Math.max(1, s.characters[0].maxHp - 5); // heal procede
  }, npc);
  await press(page, "t");
  await press(page, "ArrowLeft");
  await expect.poll(() => shopOpen(page)).toBe(true);
  let snap = await shopSnap(page);
  expect(snap?.type).toBe("Healer");
  // C4: el saludo del curandero TERMINA en pregunta → gate Y/N (0x1510).
  expect(snap?.phase).toBe("greet-yn");

  // 'Y' → services + `What is the nature of thy need?` (0x1542-0x154d).
  await press(page, "y");
  await expect.poll(async () => (await shopSnap(page))?.phase).toBe("healer-need");
  const nature = await consoleText(page);
  expect(nature).toContain('"We have powers to Cure, Heal, or Resurrect."');
  expect(nature).toContain('"What is the nature of thy need?"');

  // 'H' → picker de miembro (0x137c): con party>1 imprime `"Who needs my aid?" `
  // y abre el select de roster (kernel 0x8bfe [= CS 0x2e8e → ULTIMA.EXE:0x2e8e]); Enter elige el cursor (miembro 0).
  await press(page, "h");
  const partySize = await readState<number>(page, "partySize");
  if (partySize > 1) {
    await expect.poll(() => consoleText(page)).toContain('"Who needs my aid?"');
    await press(page, "Enter");
  }
  await expect.poll(async () => (await shopSnap(page))?.phase).toBe("healer-pay");
  const quote = await consoleText(page);
  expect(quote).toContain("I can heal thee");
  expect(quote).toMatch(/for \d+ gold\./); // % = precio interpolado
  expect(quote).toContain('pay?"');

  // 'Y': cobra + cura + epílogo `Is there any other way…` (0x15a8) → gate Y/N de nuevo.
  const goldBefore = await readState<number>(page, "gold");
  await press(page, "y");
  await expect.poll(async () => (await shopSnap(page))?.phase).toBe("healer-again");
  expect(await readState<number>(page, "gold")).toBeLessThan(goldBefore);
  const hp = await readState<number>(page, "characters[0].currentHp");
  const maxHp = await readState<number>(page, "characters[0].maxHp");
  expect(hp).toBe(maxHp);
  const tail = await consoleText(page);
  expect(tail).toContain("Is there any other way");

  // 'N' → `No` + despedida (0x171e arg=1) y la tienda cierra.
  await press(page, "n");
  await expect.poll(() => shopOpen(page)).toBe(false);
});

// ── C4 · Gate Y/N del saludo en la TABERNA (SHOPPES2 0x688) ─────────────────────────
test("taberna: `No` en el gate del saludo despide con el pool de despecho (E09)", async ({ page }) => {
  // Britain (loc 2): barkeeper (dialogNumber 0x82).
  await gotoGame(page, { loc: 2, floor: 0, x: 15, y: 15 });
  const npc = await page.evaluate(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const g = (window as any).__u5test.game;
    const keeper = g.npcManager.npcsAt(2, 0).find((n: { dialogNumber: number }) => n.dialogNumber === 0x82);
    return keeper ? { x: keeper.x, y: keeper.y } : null;
  });
  expect(npc).not.toBeNull();
  await page.evaluate((p) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const s = (window as any).__u5test.state();
    s.position.x = p!.x + 1;
    s.position.y = p!.y;
  }, npc);
  await press(page, "t");
  await press(page, "ArrowLeft");
  await expect.poll(() => shopOpen(page)).toBe(true);
  const snap = await shopSnap(page);
  expect(snap?.type).toBe("Barkeeper");
  expect(snap?.phase, "el saludo de taberna arma el Y/N (C4)").toBe("greet-yn");
  await press(page, "n");
  await expect.poll(() => shopOpen(page)).toBe(false);
  const out = await consoleText(page);
  expect(out).toContain("No");
  // Despedida del pool (tabla A, «Hmph. Well, later then...» y compañía) + atribución.
  expect(out).toMatch(/^says [^\n]+\.$/m);
});
