/**
 * #21 — cmd_enter en el UNDERWORLD: EL RUN.
 *
 * La derivación de `cmd_enter` (MAINOUT.OVL 0x08de) estaba cerrada y con tres medidas
 * escritas en `game/e2e/grandtour/ch15-underworld.spec.ts:25-38`:
 *   (1) la rutina son 125 líneas con CERO referencias a `g_floor` — despacha por el TILE
 *       bajo la party (`0x08fb call tile_addr` → `0x0900 mov al,[bx]`) y por nada más;
 *   (2) el tile 24 (0x18, dungeon) tiene RAMA PROPIA — `0x09e9 cmp ax,0x18 / je 0x9b8` —
 *       y cae al tronco común `0x9ab push ax / call 0x790` = `enter_map_location`;
 *   (3) las casillas con tile 24 en el Underworld son TRES: (y,x) = (20,126), (27,156)
 *       y (73,240).
 * Lo único que faltaba era el RUN: pulsar (E) en el port y ver qué pasa. Esto es ese run.
 *
 * ★ CUARTA MEDIDA, que la ficha no traía — QUIÉNES son las tres bocas. El acta sólo tenía
 * las coordenadas. Cruzando con `data.json` locationsX/Y (y con `locationAt`, que devuelve
 * `i+1`: el id es 1-based, `movement.ts:375`) las tres son mazmorras REALES y distintas:
 *   (20,126) → id 36 WRONG · (27,156) → id 37 COVETOUS · (73,240) → id 33 DECEIT
 * ⚠ El nombre NO se lee con `locationNames[id-1]`: el array tiene 35 entradas para 40
 * localizaciones porque las 5 de nombre 0x0000 (locations 14-18, keeps/castillos) NO
 * ocupan sitio — `locationNameIndexes` las marca con el mismo puntero 16. El mapeo real
 * es `id<=13 ? N[id-1] : N[id-6]`. Leerlo mal da 'SHAME' donde pone DECEIT.
 *
 * QUÉ MIDE, y por qué discrimina. Las 8 entradas de mazmorra NACEN SELLADAS: el compose de
 * render (OUTSUBS 0x98 → func1 0x0, `0149: mov byte [bx],0xdf`) sobreescribe la cueva base
 * con el derrumbe 0xDF, y ese gate es FLOOR-INDEPENDIENTE (`location === 0` cubre superficie
 * Y Underworld, `game.ts` §sello de mazmorra). Así que cada boca da DOS casos opuestos con
 * el mismo pulsador, y el par es el control:
 *   · sello CERRADO → la casilla es derrumbe 0xDF, no tile 24 ⇒ (E) cae al default
 *     `0x09ee` = "Enter What?" y NO carga mapa. (Control NEGATIVO: si esto pasara a verde
 *     por sí solo, el aserto positivo de abajo no probaría nada.)
 *   · sello ABIERTO (`questFlags["word-spoken:<id>"]`, la Palabra gritada con (Y), CMDS
 *     0x12c8) → la casilla vuelve a tile 24 ⇒ (E) imprime "Enter dungeon" (DS 0x2ac7) y
 *     entra de verdad (`dungeonState` deja de ser null).
 *
 * NO ENCADENA NI SELLA. Spec suelto a propósito: arranca con `gotoGame` fresco y no importa
 * ni exporta checkpoint. Meter esto en ch15 habría movido el digest del capítulo encadenado,
 * que es justo lo que la ventana de re-sello quiere evitar.
 */
import { test, expect, type Page } from "@playwright/test";
import { gotoGame, consoleText, readState } from "./helpers";

/** Underworld = large map con `floor === 0xff` (`core/world/map.ts:61`). */
const UNDERWORLD_FLOOR = 0xff;
/** Derrumbe del sello (compose OUTSUBS 0x0149 `mov byte [bx],0xdf`). */
const RUBBLE_TILE = 0xdf;
/** Cueva-mazmorra: la rama propia `0x09e9 cmp ax,0x18` de cmd_enter. */
const DUNGEON_TILE = 0x18; // 24

/** Las TRES bocas de tile 24 del Underworld, con la mazmorra que hay detrás de cada una. */
const MOUTHS = [
  { name: "WRONG", id: 36, x: 126, y: 20 },
  { name: "COVETOUS", id: 37, x: 156, y: 27 },
  { name: "DECEIT", id: 33, x: 240, y: 73 },
] as const;

/** Tile que `cmd_enter` leería: el MISMO `activeMap.tileAt` que consulta `Game.enter()`. */
const tileUnderParty = (page: Page) =>
  page.evaluate(() => {
    const g = (window as unknown as { __u5test: { game: any } }).__u5test.game;
    return g.activeMap.tileAt(g.state.position.x, g.state.position.y) as number;
  });

/** ¿Estamos DENTRO de una mazmorra? El modo no vive en GameState (ver dungeon.spec.ts §DISCRIMINADOR). */
const inDungeon = (page: Page) =>
  page.evaluate(
    () => (window as unknown as { __u5test: { game: any } }).__u5test.game.dungeonState !== null,
  );

/** Abre el sello de `id` como lo dejaría gritar la Palabra adyacente (CMDS 0x12c8). */
const openSeal = (page: Page, id: number) =>
  page.evaluate((loc) => {
    (window as unknown as { __u5test: { game: any } }).__u5test.game.state.questFlags[
      `word-spoken:${loc}`
    ] = true;
  }, id);

for (const mouth of MOUTHS) {
  test(`#21 · (E) en la boca de ${mouth.name} (${mouth.x},${mouth.y}) del Underworld: sellada NO entra, abierta SÍ`, async ({
    page,
  }) => {
    await gotoGame(page, { loc: 0, floor: UNDERWORLD_FLOOR, x: mouth.x, y: mouth.y });

    // La party está en el Underworld, encima de la coord de la mazmorra.
    const pos = await readState<{ location: number; floor: number; x: number; y: number }>(
      page,
      "position",
    );
    expect(pos, "party en el Underworld sobre la boca").toMatchObject({
      location: 0,
      floor: UNDERWORLD_FLOOR,
      x: mouth.x,
      y: mouth.y,
    });

    // --- CONTROL NEGATIVO: sello cerrado ⇒ derrumbe, y (E) no despacha ---
    expect(await tileUnderParty(page), "sello cerrado ⇒ derrumbe 0xDF").toBe(RUBBLE_TILE);
    await page.locator("body").press("e");
    expect(await consoleText(page), 'sellada ⇒ default 0x09ee "Enter What?"').toContain(
      "Enter What?",
    );
    expect(await inDungeon(page), "sellada ⇒ NO ha cargado mazmorra").toBe(false);

    // --- CASO DEL ACTA: sello abierto ⇒ tile 24, y (E) entra ---
    await openSeal(page, mouth.id);
    expect(await tileUnderParty(page), "sello abierto ⇒ vuelve la cueva 0x18").toBe(DUNGEON_TILE);
    await page.locator("body").press("e");
    expect(await consoleText(page), 'abierta ⇒ "Enter dungeon" (DS 0x2ac7)').toContain(
      "Enter dungeon",
    );
    expect(await inDungeon(page), "abierta ⇒ HA cargado la mazmorra").toBe(true);
  });
}
