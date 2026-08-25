/**
 * Task E2E-6 — Journey de comandos de mundo (Look / Get / Open / Search / Klimb).
 *
 * Coordenadas y tiles LEÍDOS de los mapas reales (game/assets/maps/smallmaps.json
 * + passability de src/core/data/TileData.json), no adivinados. Cada escenario
 * documenta loc/floor/x/y y el tile objetivo en el comentario; ver
 * .superpowers/sdd/task-6-report.md para la derivación completa.
 *
 * Modelo de input (src/main.ts): Look/Get/Open/Search piden dirección (tecla del
 * comando + flecha vía `pendingDirCommand`); Klimb se ejecuta sin dirección.
 * Corrección (fix #47): Search es DIRECCIONAL en el binario (SJOG 0x095C: 097e
 * llama a getdir 0x766c; inspecciona party+dir, 0988-099d). Un spec previo de esta
 * suite codificaba "Search sin dirección" — que era EL BUG (puertas secretas 0x4E
 * irrevelables desde teclado), no la conducta correcta. Ver re/verified/cmds.md §54.
 * Rutas de estado reales (src/core/state.ts): `food` y `karma` cuelgan de la raíz
 * de GameState, no de un sub-objeto `inventory`.
 */
import { test, expect, type Page } from "@playwright/test";
import { gotoGame, readState, hudLog } from "./helpers";

/**
 * Selecciona un usable por su etiqueta en el OVERLAY DE PERGAMINO de (U)se de la piel fiel
 * (jubilado el popup DOM dev). Lee el hook lógico `__u5test.readyPicker()` (mismo canal que
 * Ready, #78), baja la barra hasta el ítem y pulsa Enter para USARLO. Espejo del `pickerUse`
 * de use-item.spec.ts.
 */
async function selectUsable(page: Page, label: string): Promise<void> {
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

test("Look direccional describe el tile adyacente (LOOK 'Thou dost see')", async ({ page }) => {
  // INIT canónico: Iolo's Hut (loc 13, floor 0), party en (15,15). El vecino
  // ESTE (16,15) = tile 148 TableLeft → game.look() responde "Thou dost see …".
  await gotoGame(page);
  await page.keyboard.press("l");
  await page.keyboard.press("ArrowRight");
  const log = await hudLog(page);
  expect(log.join("\n")).toContain("Thou dost see");
});

test("Look a un cofre-NPC del castillo describe 'a chest', no 'citizen' (#F13-2)", async ({
  page,
}) => {
  // Castillo de Lord British (loc 17), sótano (floor -1). El slot-NPC 23 es un
  // Chest (type 1 → tile 257) en (16,21). cmd_look (LOOKOBJ 0x099c) describe el
  // tile COMPOSITADO vía LOOK2.DAT → "a chest". El atajo inventado "citizen of
  // Britannia" (game.ts:1854 antiguo) queda retirado. Party en (15,21) mira ESTE.
  await gotoGame(page, { loc: 17, floor: -1, x: 15, y: 21 });
  await page.keyboard.press("l");
  await page.keyboard.press("ArrowRight");
  const log = (await hudLog(page)).join("\n");
  expect(log).toContain("Thou dost see a chest");
  expect(log).not.toContain("citizen");
});

test("Get de cosecha (trigo) da +1 comida y cuesta 1 de karma", async ({ page }) => {
  // Britain (loc 2) planta ALTA (floor 1): campo de trigo. Party en (25,24) =
  // tile 45 WheatInField (walkable); vecino ESTE (26,24) = 45 WheatInField.
  // game.get() sobre trigo: setMapOverride→44 Plowed, food++, karma=max(0,karma-1),
  // mensaje DERIVADO del binario "Crops picked!" (GET 0x18CE, DS 0x8df4, cmds.md §10).
  // El "Harvested!" anterior era fabricación de la era-clon (Ultima5Redux) — corregido #69.
  await gotoGame(page, { loc: 2, floor: 1, x: 25, y: 24 });
  const foodBefore = await readState<number>(page, "food");
  const karmaBefore = await readState<number>(page, "karma");
  await page.keyboard.press("g");
  await page.keyboard.press("ArrowRight");
  const log = await hudLog(page);
  expect(log.join("\n")).toContain("Crops picked!");
  expect(await readState<number>(page, "food")).toBe(foodBefore + 1);
  expect(await readState<number>(page, "karma")).toBe(Math.max(0, karmaBefore - 1));
});

test("Open de puerta la abre y deja de bloquear el paso", async ({ page }) => {
  // Britain (loc 2, floor 0). Party en (26,2) = tile 68 BrickFloor (walkable);
  // vecino ESTE (27,2) = tile 184 RegularDoor (NO walkable, IsOpenable). Open →
  // "Opened!" y DoorManager sustituye el tile por 68 unos turnos: el paso
  // posterior hacia el ESTE mueve la party (position.x 26→27) SIN "Blocked!".
  await gotoGame(page, { loc: 2, floor: 0, x: 26, y: 2 });
  await page.keyboard.press("o");
  await page.keyboard.press("ArrowRight");
  const openLog = await hudLog(page);
  expect(openLog.join("\n")).toContain("Opened!");
  expect(await readState<number>(page, "position.x")).toBe(26); // Open no mueve

  // Paso hacia la puerta ahora abierta: debe cruzar, no bloquear.
  await page.keyboard.press("ArrowRight");
  const moveLog = await hudLog(page);
  expect(moveLog.join("\n")).not.toContain("Blocked!");
  expect(await readState<number>(page, "position.x")).toBe(27);
});

test("(U)se Skull Key desmagifica una skull door (0x97→0xB8), gasta 1 llave y luego Open abre", async ({ page }) => {
  // Britain (loc 2, floor 0). Party en (26,2). Colocamos una skull door 0x97 al ESTE
  // (27,2) vía override y damos 1 skull key. (U)se → Skull Key → ESTE debe: consumir la
  // llave (0x18c4 dec), desmagificar 0x97→0xB8 (CAST2.OVL 0x0768 @0x07a0, leído byte a
  // byte 2026-07-25; el viejo «kernel 0x75a2» era el destino near-call crudo), y dejar la puerta
  // cerrada-normal abrible con (O)pen. Es el mecanismo REAL de las skull doors (NO el
  // hechizo In Ex Por, que no toca puertas). Task #22.
  await gotoGame(page, { loc: 2, floor: 0, x: 26, y: 2 });
  await page.evaluate(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const g = (window as any).__u5test.game;
    g.state.skullKeys = 1;
    g.setMapOverride(27, 2, 0x97); // skull door mágica al ESTE
  });

  await page.keyboard.press("u");
  // (U)se en la piel fiel: el picker es el OVERLAY DE PERGAMINO (no el popup DOM dev,
  // jubilado). Se conduce por teclado leyendo el hook lógico `readyPicker` (mismo canal
  // que use-item.spec.ts): bajar hasta la fila "Skull Keys" (name-table) y Enter lo usa;
  // el ECO de la consola sigue siendo "Skull Key" (DS 0x48fe), que es OTRA cadena.
  await selectUsable(page, "Skull Keys"); // name-table 0x1916
  await page.keyboard.press("ArrowRight"); // getdir → ESTE
  const useLog = (await hudLog(page)).join("\n");
  expect(useLog).toContain("Skull Key"); // str DATA.OVL 0x48fe

  // La llave se gastó y la puerta quedó desmagificada (0x97→0xB8) en el mapa vivo.
  expect(await readState<number>(page, "skullKeys")).toBe(0);
  // ★ RE-SELLO DE CANAL (ventana 2026-07-29, por #119 tanda 2 @d3078543). El VALOR 0xB8 no
  // se mueve — sigue siendo el `mov byte ptr [bx],0xB8` de CAST2.OVL 0x07a0. Lo que cambia
  // es DÓNDE se escribe: 0x0782 `call 0x6222` resuelve al helper tile_addr del kernel
  // (ULTIMA.EXE 0x4402), que devuelve el puntero al BÚFER DE TERRENO vivo, no a una capa
  // persistida ⇒ el port lo modela en el canal volátil (`setVolatileTerrain`), que muere
  // en la siguiente carga de mapa. Leer `mapOverrides` medía la capa EQUIVOCADA. El canal
  // correcto se observa por el mismo sitio que lo consume el juego, `activeMap.tileAt`.
  const doorTile = await page.evaluate(
    () => (window as unknown as { __u5test: { game: { activeMap: { tileAt(x: number, y: number): number } } } })
      .__u5test.game.activeMap.tileAt(27, 2),
  );
  expect(doorTile).toBe(0xb8);

  // Ahora (O)pen la abre (0xB8 sin cerrojo → "Opened!").
  await page.keyboard.press("o");
  await page.keyboard.press("ArrowRight");
  expect((await hudLog(page)).join("\n")).toContain("Opened!");
});

test("Search direccional sin objeto responde 'Nothing of note.'", async ({ page }) => {
  // INIT: Iolo's Hut (loc 13, floor 0), party en (15,15). Search pide dirección
  // (fix #47: SJOG 0x095C es direccional). Buscando al ESTE (16,15) no hay puerta
  // secreta; ni searchObject en la casilla actual (el único de loc 13 está en 24,2),
  // ni árbol de calaveras ni item de trama → "Nothing of note." (world/search.ts).
  await gotoGame(page);
  await page.keyboard.press("s");
  expect((await hudLog(page)).join("\n")).toContain("Search-");
  await page.keyboard.press("ArrowRight");
  // Player-select del comando (SJOG 0x09a0 → kernel 0x4988, C6): con party>1 sin
  // activo pregunta «Player: » — Enter confirma el cursor (miembro 0).
  await page.keyboard.press("Enter");
  const log = await hudLog(page);
  // Prosa fiel C6: default `Thou dost find` + continuación minúscula (SJOG 0x636).
  expect(log.join("\n")).toContain("Thou dost find");
  expect(log.join("\n")).toContain("nothing of note.");
});

test("Search direccional revela una puerta secreta (0x4E) y se puede cruzar", async ({ page }) => {
  // Puerta secreta REAL: Lord British's Castle (loc 17), planta 1 (z=1), tile 0x4E
  // (78, StoneBrickWallSecret) en (14,11). Al OESTE (13,11)=68 BrickFloor (walkable):
  // la party parte ahí y busca al ESTE. Al ESTE de la puerta (15,11)=68 BrickFloor,
  // el corredor oculto z1 del castillo (contenido inalcanzable con el bug #47).
  // Coords LEÍDAS de game/assets/maps/smallmaps.json (no adivinadas).
  await gotoGame(page, { loc: 17, floor: 1, x: 13, y: 11 });

  // Estado inicial: la celda al ESTE es un muro secreto (0x4E), no una puerta.
  const tileAt = (x: number, y: number) =>
    page.evaluate(
      ([px, py]) => (window as unknown as { __u5test: { game: { activeMap: { tileAt(x: number, y: number): number } } } })
        .__u5test.game.activeMap.tileAt(px, py),
      [x, y] as [number, number],
    );
  expect(await tileAt(14, 11)).toBe(0x4e); // muro secreto, no revelado

  // Search al ESTE (SJOG 0x095C): revela 0x4E → 0xB9 (mundo), "a hidden door!".
  await page.keyboard.press("s");
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("Enter"); // player-select del comando (C6): confirma miembro
  expect((await hudLog(page)).join("\n")).toContain("hidden door");
  expect(await tileAt(14, 11)).toBe(0xb9); // revelada como puerta (cerrada)

  // Cruzar: 0xB9 es una puerta CERRADA. Se destraba con Jimmy (0xB9→0xB8) y luego
  // Open (0xB8→suelo temporal). Jimmy YA está ligado a teclado en el mundo (fix #48:
  // 'j' = Jimmy direccional, como en el binario; el diario QoL se mudó a F6). Sólo se
  // preparan llaves y DEX por el hook (estado inicial), no la acción: el destrabado
  // se hace SOLO con teclado. DEX 30 > roll[0..29] fuerza éxito determinista.
  await page.evaluate(() => {
    const g = (window as unknown as { __u5test: { game: { state: { keys: number; characters: Array<{ dexterity: number }> } } } }).__u5test.game;
    g.state.keys = 5;
    for (const c of g.state.characters) c.dexterity = 30; // 30 > roll(0..29) siempre
  });
  await page.keyboard.press("j"); // Jimmy (fix #48: ligado a teclado en el mundo)
  await page.keyboard.press("ArrowRight");
  expect((await hudLog(page)).join("\n")).toContain("Unlocked!");
  expect(await tileAt(14, 11)).toBe(0xb8); // puerta desbloqueada por Jimmy

  await page.keyboard.press("o"); // Open (sí está ligado a teclado)
  await page.keyboard.press("ArrowRight");
  expect((await hudLog(page)).join("\n")).toContain("Opened!");

  // Ahora la puerta abierta deja pasar: paso al ESTE cruza (x: 13→14).
  await page.keyboard.press("ArrowRight");
  expect(await readState<number>(page, "position.x")).toBe(14);
});

test("Klimb sin medio de escalada responde 'With what?'", async ({ page }) => {
  // Overworld (loc 0). INIT no lleva grapple (initial-state.json grapple=false),
  // así que Klimb en el exterior (klimbGrapple) sale por "With what?" (game.ts
  // klimbGrapple(): requiere Grapple). La posición es irrelevante: no hay acción.
  await gotoGame(page, { x: 60, y: 60 });
  await page.keyboard.press("k");
  const log = await hudLog(page);
  expect(log.join("\n")).toMatch(/With what\?|What\?/i);
});

test("Camp (H) en poblado sin cama: gate 'Hole up- Only in bed!' (no abre horas)", async ({
  page,
}) => {
  // INIT canónico (Iolo's Hut, loc 13). El party NO está sobre una cama (tile 0xAB), así
  // que el gate fiel de camp-en-poblado (game.ts campContext; kernel 0x329c desvía 'H' a la
  // rama pueblo) responde "Hole up- Only in bed!" y NO abre el prompt de horas. (Antes este
  // escenario esperaba "For how many hours?" en Iolo's Hut: era el spec OBSOLETO — el gate,
  // pedido por el usuario y fiel al binario, es lo correcto.)
  await gotoGame(page, { hour: 2 });
  await page.keyboard.press("h");
  const log = (await hudLog(page, 8)).join("\n");
  expect(log).toContain("Only in bed!");
  expect(log).not.toContain("For how many hours?");
  expect(log).not.toContain("Party rested!");
});

test("Camp (H) en overworld: pide horas → corre el reloj N horas y descansa la party", async ({
  page,
}) => {
  // Overworld a pie sobre HIERBA (loc 0 por defecto, tile 5 en (76,40)): el camp fiel monta
  // la escena CampFire y corre el reloj. Reseed determinista (sin emboscada). Declinamos el
  // watch (N) para el flujo corto. H → "Hole up & camp!" + "For how many hours? (1-9)".
  await gotoGame(page, { x: 76, y: 40, hour: 2 });
  await page.evaluate(() => (window as unknown as { __u5test: { reseed: (n: number) => void } }).__u5test.reseed(0));
  await page.keyboard.press("h");
  const opened = (await hudLog(page, 8)).join("\n");
  expect(opened).toContain("Hole up & camp!");
  expect(opened).toContain("For how many hours?");
  await page.keyboard.press("1"); // 1 hora
  if ((await hudLog(page, 8)).join("\n").includes("watch")) await page.keyboard.press("n");
  await expect
    .poll(async () => (await hudLog(page, 12)).join("\n"), { timeout: 8000 })
    .toContain("Party rested!");
  expect(await readState<number>(page, "time.hour")).toBe(3); // 2 + 1
});

test("Camp (H) con Iolo (bardo) de guardia: toca la canción y LUEGO descansa; el reloj NO avanza durante la canción", async ({
  page,
}) => {
  // Easter egg de Iolo (witness-derived, CAMP_IOLO_MUSICA.mov): con Iolo (bardo, idx 2) de
  // vigía, el camp mete una FASE CANCIÓN (~7.5s, reloj CONGELADO) ANTES del bucle de horas.
  // Verifica el timing end-to-end: tras la canción el reloj corre y llega "Party rested!", y
  // el reloj sólo avanza la 1 hora de sueño (2→3) — la canción NO gasta tiempo (pureza).
  await gotoGame(page, { x: 76, y: 40, hour: 2 });
  await page.evaluate(() => (window as unknown as { __u5test: { reseed: (n: number) => void } }).__u5test.reseed(0));
  await page.keyboard.press("h");
  await page.keyboard.press("1"); // 1 hora
  // "Wilt thou set a watch?" → Y → "Who will stand guard?" → picker → '3' = Iolo (idx 2).
  await expect
    .poll(async () => (await hudLog(page, 8)).join("\n"), { timeout: 3000 })
    .toContain("watch");
  await page.keyboard.press("y");
  await page.keyboard.press("3"); // Iolo (bardo)
  // La fase canción tarda ~7.5s; el flujo debe completarse después (timeout amplio).
  await expect
    .poll(async () => (await hudLog(page, 12)).join("\n"), { timeout: 14000 })
    .toContain("Party rested!");
  expect(await readState<number>(page, "time.hour")).toBe(3); // 2 + 1: la canción no gasta reloj
});

test("Camp (H) en overworld: '0' cancela sin acampar ni gastar tiempo", async ({ page }) => {
  // Filtro de dígito del kernel (0x3ddf): '0' cancela → jmp 0x3eea (sin turno). Overworld
  // (hierba) para llegar al prompt de horas (en poblado el gate 'Only in bed!' iría antes).
  await gotoGame(page, { x: 76, y: 40, hour: 7 });
  await page.keyboard.press("h");
  expect((await hudLog(page, 8)).join("\n")).toContain("For how many hours?");
  await page.keyboard.press("0"); // cancelar
  const log = (await hudLog(page, 12)).join("\n");
  expect(log).not.toContain("Party rested!");
  expect(await readState<number>(page, "time.hour")).toBe(7); // sin cambio
});
