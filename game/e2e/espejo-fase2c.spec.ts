/**
 * WALKTHROUGH-ESPEJO fase 2 — runner C: sonda Codex (tile + ceremonia + ring crudo).
 *
 * CLASE DEL SPEC: CAPACIDAD-DE-ARNÉS (COSECHADORA) — cero aserciones; OPT-IN con
 * `U5_ESPEJO_FASE2=1`. La derivación de la clase y de por qué el gate es por env y
 * no por testIgnore está en la cabecera de espejo-fase2.spec.ts.
 */
import { test, type Page } from "@playwright/test";
import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import { gotoGame } from "./helpers";

const FASE2_ON = process.env.U5_ESPEJO_FASE2 === "1" || process.env.U5_ESPEJO_FASE2 === "true";
test.skip(!FASE2_ON, "cosechadora OPT-IN: U5_ESPEJO_FASE2=1 (no aserta; no es un gate)");

const OUT_DIR =
  process.env.ESPEJO_OUT ??
  path.join(path.dirname(fileURLToPath(import.meta.url)), "..", ".espejo-fase2");

async function key(page: Page, k: string, ms = 300): Promise<void> {
  await page.keyboard.press(k);
  await page.waitForTimeout(ms);
}

test("S5c Codex — mapa de tiles + ceremonia con ring crudo", async ({ page }) => {
  test.setTimeout(90_000);
  await gotoGame(page, { loc: 0, x: 233, y: 237, hour: 10 });
  await page.evaluate(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as any).__u5test.game.state.shrineQuestBitmap = 1 << 1;
  });
  const tiles = await page.evaluate(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const g = (window as any).__u5test.game;
    const out: string[] = [];
    for (let y = 228; y <= 238; y++) {
      let row = `y=${y}: `;
      for (let x = 230; x <= 236; x++) row += g.activeMap.tileAt(x, y).toString(16).padStart(2, "0") + " ";
      out.push(row);
    }
    return out;
  });
  console.log(tiles.join("\n"));
  const rings: string[] = [];
  for (let i = 0; i < 8; i++) {
    await key(page, "ArrowUp", 350);
    const ring = await page.evaluate(() =>
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (window as any).__u5test.consoleLines(),
    );
    const pos = await page.evaluate(() => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const p = (window as any).__u5test.game.state.position;
      return `${p.x},${p.y}`;
    });
    rings.push(`--- paso ${i} pos=${pos} ---\n` + ring.join("\n"));
  }
  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.writeFileSync(path.join(OUT_DIR, "s5c-codex-probe.txt"), rings.join("\n\n") + "\n");
});
