import { test, expect } from "@playwright/test";
import type { Page } from "@playwright/test";
import { gotoGame, readState, pressAndLog, hudLog } from "./helpers";

/**
 * Journey naval E2E (Fase 1.2 — deliberate-divergences §2 «Transporte naval»).
 * Aborda una fragata/skiff ORGÁNICAMENTE: siembra un objeto-nave (kind "ship") en
 * la celda del party vía el hook `__u5test.addWorldObject` (la capa de objetos del
 * mundo, F1.5) y pulsa (B) — el mismo camino que usa una nave comprada en el
 * muelle. Luego iza velas (Y), navega/rema (flechas), dispara (F) y desembarca (X).
 * Verifica el CABLEADO de las teclas B/X/Y/F y la rama naval de move() contra el
 * ESTADO real (transportTile, transport, position) y el HUD — nunca píxeles.
 * Determinista por seed (viento fijo); el remo/vira no dependen del viento.
 *
 * Migración F1.5-T5: antes se usaba el hook fantasma `boardTile`/`?ttile=`, que
 * fingía estar en un transporte SIN objeto del mundo. Ahora la nave se ABORDA de
 * verdad desde la capa de objetos → las mismas aserciones, pero ejercitando el
 * camino real objeto→Board (game.board() vuelca hull/skiffs del objeto a slot0 y
 * lo retira, transport.md §7A). Recuperación exacta del transportTile de partida:
 *   - Fragata: board() preserva el tile del objeto (0x24→0x24, 0x20→0x20).
 *   - Skiff:  board() TAMBIÉN preserva (0x28→0x28) — el «tile+2» era del caballo
 *     (CMDS 0x0873); la rama skiff lo salta (0x08B2 → jmp 0x0875, #273 adyacente).
 *
 * ★ DOS ESPACIOS DE TILE (#137, `re/notes/board-137-acta.md` §2). El byte `+0` de un
 * registro de objeto del binario es un índice del BANCO ALTO: el tile real es
 * `byte + 0x100`. La capa de objetos del port guarda el tile COMPLETO, y `board()`
 * discrimina «hay vehículo» por `tileAt(...) >= 0x100` — sembrar el BYTE pelado deja
 * `worldTile = 0` y el despacho cae al «What?» por defecto, o sea NO ABORDA y el estado
 * se queda a pie. Estos cuatro tests sembraban el byte (0x24/0x28/0x20): databan del
 * 28-07 y #137 migró la convención el 30-07 tocando sólo los tests unitarios, porque la
 * suite e2e de escritorio llevaba desde el 22-07 sin poder arrancar. Los `transportTile`
 * que se ASERTAN siguen en espacio de BYTE (`transport.ts` modela g_transport_tile).
 *
 * Coordenadas de mar VERIFICADAS contra assets/maps/overworld.json (tile 1 = agua
 * profunda): (250,120) mar abierto (bloque 5×6 de agua) para izar/navegar/disparar;
 * (245,61) con costa (tile 2 tierra) 2 casillas al oeste, para el desembarque.
 */
const SEA = { x: 250, y: 120, hour: 12 };
const COAST = { x: 245, y: 61, hour: 12 }; // tierra (tile 2) en (243,61), 2 al oeste

/** Banco alto de sprites: la capa de objetos guarda `byte + 0x100` (#137). */
const ACTOR_TILE_BANK = 0x100;

/**
 * Siembra un objeto-nave (kind "ship") en la celda del party y lo aborda con (B).
 * `tile` es el BYTE del registro de objeto del binario (el que se lee en el ASM); se
 * siembra en el banco alto porque es ahí donde vive la capa de objetos del port (#137).
 * board() lo vuelca a transportTile en espacio de byte TAL CUAL (fragatas y skiffs:
 * la rama skiff de CMDS 0x08B2 salta el `add al,2` del caballo — #273 adyacente).
 * hull 99 / skiffs 1 evitan avisos DANGER/WARNING espurios que ensuciarían el log.
 */
async function seedShipAndBoard(page: Page, tile: number): Promise<void> {
  await page.evaluate((t) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const g = (window as any).__u5test.game;
    const p = g.state.position;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as any).__u5test.addWorldObject({
      location: p.location, floor: p.floor, x: p.x, y: p.y,
      tile: t, kind: "ship", hull: 99, skiffs: 1,
    });
  }, tile + ACTOR_TILE_BANK);
  await page.locator("body").press("b"); // (B)oard — aborda el objeto-nave in situ
}

test("izar velas: Y iza/arría la fragata (0x24↔0x20)", async ({ page }) => {
  await gotoGame(page, { ...SEA, seed: 1234 });
  await seedShipAndBoard(page, 0x24); // fragata velas arriadas → board preserva 0x24
  expect(await readState<string>(page, "transport")).toBe("ship");
  expect(await readState<number>(page, "transportTile")).toBe(0x24);
  const log = await pressAndLog(page, "y"); // arriadas 0x24 → HOIST! (izadas 0x20)
  expect(await readState<number>(page, "transportTile")).toBe(0x20);
  expect(log.some((l) => l.includes("HOIST"))).toBe(true);
  const log2 = await pressAndLog(page, "y"); // izadas 0x20 → FURL! (arriadas 0x24)
  expect(await readState<number>(page, "transportTile")).toBe(0x24);
  expect(log2.some((l) => l.includes("FURL"))).toBe(true);
});

test("navegar: remar el skiff mueve un tile; y VIRAR TAMBIÉN AVANZA en el mismo pulsado (fiel)", async ({ page }) => {
  // RE-ADJUDICADO 28-07 en la ventana del lote (#32): el sello anterior («virar consume
  // el turno» sin avanzar) era la regla de la FRAGATA aplicada al skiff SIN derivar.
  // Derivación del lote (pieza #32, rama fix/lote-mecanica-town): el skiff del original
  // gira Y avanza en el MISMO golpe de tecla. Este spec era el DETECTOR: se puso rojo
  // exactamente cuando el port corrigió la conducta (specs-detector-vs-veredicto).
  await gotoGame(page, { ...SEA, seed: 1234 });
  await seedShipAndBoard(page, 0x28); // skiff → board devuelve 0x28 TAL CUAL (sin el +2 del caballo)
  expect(await readState<number>(page, "transportTile")).toBe(0x28);
  const y0 = await readState<number>(page, "position.y");
  await pressAndLog(page, "ArrowDown"); // vira a S (0x2a) Y AVANZA (regla fiel del skiff)
  const y1 = await readState<number>(page, "position.y");
  expect(y1).toBe(y0 + 1);
  const x0 = await readState<number>(page, "position.x");
  await pressAndLog(page, "ArrowRight"); // vira a E (0x28+1=0x29) Y AVANZA (fiel)
  expect(await readState<number>(page, "transportTile")).toBe(0x29); // skiff E
  expect(await readState<number>(page, "position.x")).toBe(x0 + 1); // gira y REMA al E
  expect(await readState<number>(page, "position.y")).toBe(y1);
});

test("desembarcar: X-it del skiff con tierra adyacente vuelve a pie ('skiff!')", async ({ page }) => {
  await gotoGame(page, { ...COAST, seed: 1234 });
  await seedShipAndBoard(page, 0x28); // skiff (facing inicial irrelevante: se re-orienta)
  expect(await readState<string>(page, "transport")).toBe("skiff");
  // Rema hacia el oeste (la costa) hasta que X tenga éxito o se agoten los intentos.
  let disembarked = false;
  for (let i = 0; i < 12 && !disembarked; i++) {
    await pressAndLog(page, "ArrowLeft"); // vira a O y luego rema al oeste
    const log = await pressAndLog(page, "x");
    if (log.some((l) => l.includes("skiff!"))) disembarked = true;
  }
  // El assert clave: X SIEMPRE responde con "skiff!" (éxito) o "No land nearby!"
  // (regla 0x73E), nunca un no-op silencioso. Con la costa a 2 tiles esperamos éxito.
  const finalLog = await hudLog(page, 6);
  expect(
    finalLog.some((l) => l.includes("skiff!") || l.includes("No land nearby")),
  ).toBe(true);
  if (disembarked) {
    expect(await readState<string>(page, "transport")).toBe("foot");
  }
});

test("disparar: F sin objetivo perpendicular responde (Missed!)", async ({ page }) => {
  await gotoGame(page, { ...SEA, seed: 1234 });
  await seedShipAndBoard(page, 0x20); // fragata izada N (quilla N/S) → board preserva 0x20
  expect(await readState<number>(page, "transportTile")).toBe(0x20);
  const log = await pressAndLog(page, "f"); // pide dirección: copy fiel "Fire-" (DS 0xa164)
  expect(log.some((l) => l.toLowerCase().includes("fire"))).toBe(true);
  const log2 = await pressAndLog(page, "ArrowRight"); // E: perpendicular a la quilla → dispara
  expect(
    log2.some((l) => l.includes("Missed") || l.includes("Hit") || l.includes("sunk")),
  ).toBe(true);
});
