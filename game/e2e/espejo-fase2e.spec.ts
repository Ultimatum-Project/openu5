/**
 * WALKTHROUGH-ESPEJO fase 2 — runner E: gremio (P05 Braunam) + taberna (P04 Tika).
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

async function armAccumulator(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const acc: string[] = [];
    let prev: string[] = [];
    (window as unknown as { __espejoAcc: string[] }).__espejoAcc = acc;
    setInterval(() => {
      const t = (window as unknown as { __u5test?: { consoleLines?: () => string[] } }).__u5test;
      if (!t?.consoleLines) return;
      const cur = t.consoleLines();
      if (cur.length === 0) return;
      let best = 0;
      const max = Math.min(prev.length, cur.length);
      for (let k = max; k > 0; k--) {
        let ok = true;
        for (let i = 0; i < k; i++) {
          const a = prev[prev.length - k + i]!;
          const b = cur[i]!;
          if (a === b) continue;
          if (i === k - 1 && b.startsWith(a)) continue;
          ok = false;
          break;
        }
        if (ok) {
          best = k;
          break;
        }
      }
      if (best > 0) {
        const grown = cur[best - 1]!;
        if (acc.length > 0 && grown.startsWith(acc[acc.length - 1]!) && grown !== acc[acc.length - 1]) {
          acc[acc.length - 1] = grown;
        }
      }
      for (let i = best; i < cur.length; i++) acc.push(cur[i]!);
      prev = cur;
    }, 35);
  });
}

async function dump(page: Page, name: string): Promise<void> {
  const acc = await page.evaluate(
    () => (window as unknown as { __espejoAcc?: string[] }).__espejoAcc ?? [],
  );
  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.writeFileSync(path.join(OUT_DIR, `${name}.txt`), acc.join("\n") + "\n");
}

async function key(page: Page, k: string, ms = 300): Promise<void> {
  await page.keyboard.press(k);
  await page.waitForTimeout(ms);
}

/** Coloca al player junto al mercader con dialogNumber dado (busca en el mapa vivo). */
async function nextTo(page: Page, dlg: number): Promise<boolean> {
  const r = await page.evaluate((dlgNum) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const t = (window as any).__u5test;
    const st = t.game.state;
    for (let y = 0; y < 32; y++) {
      for (let x = 0; x < 32; x++) {
        const npc = t.game.npcManager?.npcAt(st.position.location, st.position.floor, x, y);
        if (npc && npc.dialogNumber === dlgNum) {
          st.position.x = x;
          st.position.y = y + 1;
          return { x, y };
        }
      }
    }
    return null;
  }, dlg);
  console.log("mercader:", JSON.stringify(r));
  return r != null;
}

test("S9 gremio — Buccaneer's Den (Braunam): gems Interested/Sold", async ({ page }) => {
  test.setTimeout(90_000);
  await armAccumulator(page);
  await gotoGame(page, { loc: 24, x: 15, y: 15, hour: 10 });
  await page.evaluate(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as any).__u5test.game.state.gold = 500;
  });
  if (!(await nextTo(page, 0x86))) return;
  await key(page, "t");
  await key(page, "ArrowUp", 700);
  await key(page, "y", 700); // gate
  await key(page, "b", 800); // Gems
  await key(page, "y", 900); // Interested? → Yes (LP)
  await key(page, "n", 800); // What else → salir con letra inválida no; usamos Space después
  await key(page, " ", 800);
  await dump(page, "s9-guild");
});

test("S10 taberna — Britain (Tika): menú + rations + quantity", async ({ page }) => {
  test.setTimeout(90_000);
  await armAccumulator(page);
  await gotoGame(page, { loc: 2, x: 15, y: 15, hour: 13 });
  await page.evaluate(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as any).__u5test.game.state.gold = 500;
  });
  if (!(await nextTo(page, 0x82))) return;
  await key(page, "t");
  await key(page, "ArrowUp", 700);
  console.log(
    "shop:",
    JSON.stringify(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await page.evaluate(() => (window as any).__u5test.shopConsole?.() ?? null),
    ),
  );
  await key(page, "y", 700); // gate
  console.log(
    "shop tras y:",
    JSON.stringify(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await page.evaluate(() => (window as any).__u5test.shopConsole?.() ?? null),
    ),
  );
  await key(page, "r", 900); // Rations
  console.log(
    "shop tras r:",
    JSON.stringify(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await page.evaluate(() => (window as any).__u5test.shopConsole?.() ?? null),
    ),
  );
  await key(page, "1", 300);
  await key(page, "0", 300);
  await key(page, "Enter", 800); // por si hay prompt de cantidad
  await key(page, " ", 800); // salir
  await dump(page, "s10-tavern");
});
