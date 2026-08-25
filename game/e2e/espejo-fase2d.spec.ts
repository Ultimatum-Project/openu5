/**
 * WALKTHROUGH-ESPEJO fase 2 — runner D: healer (C3) contra testigo AD Ep01.
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

test("S8 healer — East Britanny (Milan): resurrect quote + no-pay + any-other-way", async ({
  page,
}) => {
  test.setTimeout(90_000);
  await armAccumulator(page);
  await gotoGame(page, { loc: 21, x: 3, y: 25, hour: 10 });
  await page.evaluate(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const st = (window as any).__u5test.game.state;
    st.gold = 50; // no llega para resurrect (LP: 237 oro → No)
    const c = st.characters[1];
    c.status = "D"; // un muerto para el pitch de resurrección
    c.currentHp = 0;
  });
  // localiza al curandero VIVO (dlg 0x87) y colócate al lado
  const found = await page.evaluate(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const t = (window as any).__u5test;
    const st = t.game.state;
    for (let y = 0; y < 32; y++) {
      for (let x = 0; x < 32; x++) {
        const npc = t.game.npcManager?.npcAt(st.position.location, st.position.floor, x, y);
        if (npc && npc.dialogNumber === 0x87) {
          st.position.x = x;
          st.position.y = y + 1;
          return { x, y };
        }
      }
    }
    return null;
  });
  console.log("healer:", JSON.stringify(found));
  await key(page, "t");
  await key(page, "ArrowUp", 700); // Milan
  console.log(
    "shop:",
    JSON.stringify(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await page.evaluate(() => (window as any).__u5test.shopConsole?.() ?? null),
    ),
  );
  await key(page, "y", 700); // gate
  await key(page, "r", 700); // Resurrect en nature-of-need
  console.log(
    "shop tras r:",
    JSON.stringify(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await page.evaluate(() => (window as any).__u5test.shopConsole?.() ?? null),
    ),
  );
  // sonda del picker: ¿party-select overlay o lista por letra?
  const probe = await page.evaluate(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const t = (window as any).__u5test;
    return { shop: t.shopConsole?.() ?? null, partySelect: t.partySelectOpen?.() ?? null };
  });
  console.log("picker probe:", JSON.stringify(probe));
  await key(page, "b", 900); // por si la lista incluye al Avatar como a)
  await key(page, "ArrowDown", 400); // por si es cursor
  await key(page, "Enter", 900);
  console.log(
    "tras select:",
    JSON.stringify(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await page.evaluate(() => (window as any).__u5test.shopConsole?.() ?? null),
    ),
  );
  await key(page, "n", 900); // Wilt thou pay? → No (LP)
  await key(page, "n", 900); // any other way? → No
  await dump(page, "s8-healer");
});
