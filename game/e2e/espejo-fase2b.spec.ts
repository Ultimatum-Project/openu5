/**
 * WALKTHROUGH-ESPEJO fase 2 — runner B (retries con localización viva del NPC,
 * sonda de case en el shrine, dump crudo del Codex y pit-trap por teleport).
 * Carril docs. Ver espejo-fase2.spec.ts para el arnés.
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
const SUITE = FASE2_ON ? "espejo fase 2 — B" : "espejo fase 2 — B (OFF: falta U5_ESPEJO_FASE2=1)";

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

async function typeAnswer(page: Page, text: string): Promise<void> {
  const overlay = page.locator(".save-name:visible");
  if ((await overlay.count()) > 0) {
    await overlay.fill(text);
    await page.keyboard.press("Enter");
    await page.waitForTimeout(200);
    return;
  }
  await page.keyboard.type(text, { delay: 25 });
  await page.keyboard.press("Enter");
  await page.waitForTimeout(200);
}

async function key(page: Page, k: string, ms = 250): Promise<void> {
  await page.keyboard.press(k);
  await page.waitForTimeout(ms);
}

/** Busca en el mapa vivo al NPC con dialogNumber `dlg` y coloca al player al lado. */
async function standNextToShopkeeper(
  page: Page,
  dlg: number,
): Promise<{ dir: string } | null> {
  return page.evaluate((dlgNum) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const t = (window as any).__u5test;
    const st = t.game.state;
    const loc = st.position.location;
    for (let y = 0; y < 32; y++) {
      for (let x = 0; x < 32; x++) {
        const npc = t.game.npcManager?.npcAt(loc, st.position.floor, x, y);
        if (npc && npc.dialogNumber === dlgNum) {
          // intenta N, S, E, W del NPC
          const cands = [
            { px: x, py: y + 1, dir: "ArrowUp" },
            { px: x, py: y - 1, dir: "ArrowDown" },
            { px: x - 1, py: y, dir: "ArrowRight" },
            { px: x + 1, py: y, dir: "ArrowLeft" },
          ];
          for (const c of cands) {
            if (c.px < 0 || c.py < 0 || c.px > 31 || c.py > 31) continue;
            st.position.x = c.px;
            st.position.y = c.py;
            return { dir: c.dir, npcAt: { x, y } };
          }
        }
      }
    }
    return null;
  }, dlg);
}

test.describe(SUITE, () => {
  test.skip(!FASE2_ON, "cosechadora OPT-IN: U5_ESPEJO_FASE2=1 (no aserta; no es un gate)");

  test("S1b posada REST — Buccaneer's Den (Ransack)", async ({ page }) => {
    test.setTimeout(90_000);
    await armAccumulator(page);
    await gotoGame(page, { loc: 24, x: 15, y: 15, hour: 10 });
    await page.evaluate(() => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (window as any).__u5test.game.state.gold = 300;
    });
    const found = await standNextToShopkeeper(page, 0x88);
    console.log("innkeeper:", JSON.stringify(found));
    if (!found) return;
    await key(page, "t");
    await key(page, found.dir, 700);
    await key(page, "y", 700); // gate del saludo
    await key(page, "r", 1500); // Rest
    await key(page, "y", 1200); // por si hay confirm
    await dump(page, "s1b-inn-rest");
  });

  test("S2b posada LEAVE — Paws (Lorien)", async ({ page }) => {
    test.setTimeout(90_000);
    await armAccumulator(page);
    await gotoGame(page, { loc: 22, x: 15, y: 15, hour: 10 });
    const found = await standNextToShopkeeper(page, 0x88);
    console.log("innkeeper:", JSON.stringify(found));
    if (!found) return;
    await key(page, "t");
    await key(page, found.dir, 700);
    await key(page, "y", 700);
    await key(page, "l", 700); // Leave a companion
    await key(page, "a", 900);
    await key(page, "n", 900); // anything more? → No
    await dump(page, "s2b-inn-leave");
  });

  test("S4b shrine — Compassion con case exacto (Compassion/Mu)", async ({ page }) => {
    test.setTimeout(90_000);
    await armAccumulator(page);
    await gotoGame(page, { loc: 0, x: 128, y: 93, hour: 10 });
    await key(page, "ArrowUp", 900);
    await typeAnswer(page, "Compassion");
    await typeAnswer(page, "Mu");
    await typeAnswer(page, "Mu");
    await typeAnswer(page, "Mu");
    await page.waitForTimeout(900);
    await dump(page, "s4b-shrine-exactcase");
  });

  test("S5b Codex — dump crudo del ring", async ({ page }) => {
    test.setTimeout(90_000);
    await armAccumulator(page);
    await gotoGame(page, { loc: 0, x: 233, y: 237, hour: 10 });
    await page.evaluate(() => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (window as any).__u5test.game.state.shrineQuestBitmap = 1 << 1;
    });
    for (let i = 0; i < 3; i++) {
      await key(page, "ArrowUp", 400);
      console.log(
        `ring tras paso ${i}:`,
        JSON.stringify(
          await page.evaluate(() =>
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (window as any).__u5test.consoleLines(),
          ),
        ),
      );
    }
    await page.waitForTimeout(600);
    await dump(page, "s5b-codex");
  });

  test("S6b Deceit — pit trap por teleport + klimb", async ({ page }) => {
    test.setTimeout(90_000);
    await armAccumulator(page);
    await gotoGame(page, { loc: 0, x: 240, y: 74, hour: 10 });
    await page.evaluate(() => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (window as any).__u5test.game.state.questFlags["word-spoken:33"] = true;
    });
    await key(page, "ArrowUp", 400);
    await key(page, "e", 900);
    await page.evaluate(() => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (window as any).__u5test.game.state.torches = 3;
    });
    await key(page, "i", 400);
    // teleport a (3,3) mirando norte; (3,2) es PitFall 0x61
    await page.evaluate(() => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const ds = (window as any).__u5test.game.dungeonState;
      ds.pos.x = 3;
      ds.pos.y = 3;
      ds.pos.facing = "north";
    });
    await key(page, "ArrowUp", 1200); // Advance → Pit Trap! Falling... ...splat!
    console.log(
      "pos tras pit:",
      JSON.stringify(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await page.evaluate(() => (window as any).__u5test.game.dungeonState?.pos ?? null),
      ),
    );
    // Klimb: teleport de vuelta a la escalera de la planta 0 (1,1) si seguimos dentro
    await page.evaluate(() => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const ds = (window as any).__u5test.game.dungeonState;
      if (ds) {
        ds.pos.floor = 0;
        ds.pos.x = 1;
        ds.pos.y = 1;
        ds.pos.facing = "south";
      }
    });
    await key(page, "k", 800); // Klimb (escalera arriba planta 0 → salir)
    await dump(page, "s6b-deceit-pit");
  });

  test("S7 banner village — Paws desde overworld (C1 index)", async ({ page }) => {
    test.setTimeout(90_000);
    await armAccumulator(page);
    // Paws en el overworld: locationsX/Y idx 21 → probe live
    const paws = await page
      .context()
      .newPage()
      .then(async (p) => {
        await p.close();
        return null;
      })
      .catch(() => null);
    void paws;
    await gotoGame(page, { loc: 0, x: 145, y: 190, hour: 10 });
    // coloca a la party sobre la entrada de Paws leyendo las tablas vivas
    const at = await page.evaluate(() => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const t = (window as any).__u5test;
      const d = t.game.data ?? null;
      return d ? { x: d.locationsX?.[21], y: d.locationsY?.[21] } : null;
    });
    console.log("paws entry:", JSON.stringify(at));
    if (at && at.x != null) {
      await page.evaluate((c) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const st = (window as any).__u5test.game.state;
        st.position.x = c.x;
        st.position.y = c.y;
      }, at);
      await key(page, "e", 900);
    }
    await dump(page, "s7-banner-paws");
  });
});
