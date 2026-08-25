/**
 * D1 · VERIFICACIÓN MIRANDO — la catarata en ALFOMBRA (espejo ES, Ep11 1:47).
 *
 * El momento del LP (ASR verbatim, subs/11-*[10].srt 1:50-2:20): «si uso la
 * alfombra voladora en la cascada puedo No oh … he caído en el mundo
 * subterráneo … maldición tengo una alfombra voladora Cómo vuelvo para
 * arriba … Up No». Cuatro conductas: la catarata TIRA de la alfombra, cae al
 * Underworld, CONSERVA la alfombra, y no hay Up de vuelta.
 *
 * Geometría REAL del mapa (assets/maps/overworld.json, censo del carril):
 * (54,135)=0x64 y (54,136)=0x60 son WaterStream (alfombra-pasables, río),
 * (54,137)=0xd4 es LA catarata-entrada, y el +2 de falls deja a la party en
 * (54,138) = (0x36,0x8a) → «Falling into underworld!!» (OUTSUBS 0x0500-0x0515).
 *
 * El trigger que este spec ejercita es el SITIO A del fix D1 (MAINOUT 0x05b2,
 * entrada de tick_and_getkey — TODO transporte): antes del fix, la vía de la
 * alfombra no llamaba a checkWaterfall y la alfombra se posaba sobre el río
 * sin caer jamás.
 */
import { test, expect } from "@playwright/test";
import { gotoGame, consoleText, readState } from "./helpers";

test("D1 · alfombra en el río (54,135→136): la catarata tira, cae al Underworld y CONSERVA la alfombra", async ({
  page,
}) => {
  await gotoGame(page, { loc: 0, floor: 0, x: 54, y: 135 });

  // Montar la alfombra por estado (el deep-link no lleva transporte). Mismo
  // patrón de inyección que openSeal en cmd-enter-underworld.spec.ts.
  await page.evaluate(() => {
    const g = (window as unknown as { __u5test: { game: any } }).__u5test.game;
    g.state.transport = "carpet";
    g.state.transportTile = 0x14; // alfombra rumbo oeste/este — clase 0x14
    g.state.magicCarpets = 1;
  });

  // Un paso al SUR: (54,136), río 0x60 con la catarata 0xd4 como vecino-sur.
  await page.keyboard.press("ArrowDown");

  // F-A-L-L-S!!! (DS 0x39b5) + Falling into underworld!! (DS 0x39c3).
  await expect.poll(() => consoleText(page), { timeout: 10_000 }).toMatch(/F-A-L-L-S!!!/);
  await expect
    .poll(() => consoleText(page), { timeout: 10_000 })
    .toMatch(/Falling into underworld!!/);

  // Estado final: (0x36,0x8a) en el Underworld, alfombra PRESERVADA
  // (OUTSUBS 0x049d guarda / 0x04fa-0x04fd restaura g_transport_tile).
  const pos = await readState<{ location: number; floor: number; x: number; y: number }>(
    page,
    "position",
  );
  expect(pos).toMatchObject({ location: 0, floor: 0xff, x: 0x36, y: 0x8a });
  const transport = await page.evaluate(
    () => (window as unknown as { __u5test: { game: any } }).__u5test.game.state.transport,
  );
  expect(transport).toBe("carpet");

  // La captura para MIRAR (regla: en trabajo visual el verde no se firma sin
  // mirar la captura): la party EN ALFOMBRA sobre el Underworld.
  await page.screenshot({
    path:
      process.env.U5_SHOT_DIR !== undefined
        ? `${process.env.U5_SHOT_DIR}/waterfall-carpet-underworld.png`
        : "test-results/waterfall-carpet-underworld.png",
  });
});
