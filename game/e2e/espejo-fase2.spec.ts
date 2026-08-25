/**
 * WALKTHROUGH-ESPEJO fase 2 — runner de careo VIVO (carril docs).
 *
 * ── CLASE DEL SPEC: CAPACIDAD-DE-ARNÉS (COSECHADORA) ────────────────────────
 * Esto NO es un test de regresión ni un veredicto de fidelidad: los 5 ficheros de
 * la serie (espejo-fase2, -2b, -2c, -2d, -2e) no contienen NI UNA aserción. Son
 * runners que CONDUCEN el juego y VUELCAN el transcript de la consola lógica a
 * fichero para carearlo a mano contra los testigos (let's-play). Verde aquí no
 * dice «el port es fiel»; dice «la cosecha terminó sin excepción».
 *
 * Por eso corren OPT-IN, con `U5_ESPEJO_FASE2=1`. Sin la env el fichero entero se
 * salta con razón anotada. Es el patrón del capturador móvil (mobile-audit.spec.ts
 * §AUDIT_ON) y se eligió frente a la otra opción — meter un glob `espejo-fase2*` en el
 * `testIgnore` de playwright.config.ts — porque el testIgnore los dejaría HUÉRFANOS
 * DE RUNNER (ningún config los recogería: exactamente el defecto que la propia
 * auditoría reporta para shops-console/talk-console), mientras que el gate por env
 * los mantiene invocables por su ruta bajo la config de siempre y con el mismo
 * comando que ya documentaba la cabecera. Cero cambios en lo que cosechan.
 *
 * Motivo: auditoría de cierre 2026-07-27, §sellos-verdes-en-falso — «16
 * tests-cosechadora SIN NINGÚN expect corren en la suite dev por defecto». El
 * `testIgnore` del config por defecto solo cubre prod/grandtour/espejo-tour/mobile,
 * y estos viven en e2e/ raíz: entraban en `npm run e2e` y pasaban verdes SIEMPRE.
 * (La cabecera decía además «UNTRACKED» y los 5 llevan tracked desde su commit.)
 *
 * Recrea el arnés de fase 1 (re/notes/espejo-part08.md §Arnés): cada escena = boot
 * fresco (gotoGame deep-link, piel fiel, lang=en) + conducción por teclado + volcado
 * del transcript de la consola LÓGICA (`__u5test.consoleLines()`) a fichero.
 * Acumulador page-side con poll 35 ms y dedupe por solape máximo (tolera el
 * crecimiento in-place de la línea de eco).
 *
 * Escenas fase 2 (sistemas NO careados en fase 1):
 *   S1 posada REST (Buccaneer's Den, Ransack)   — testigo aulddragon P05 ~2440
 *   S2 posada LEAVE (Paws, Lorien)              — testigo aulddragon P19 ~350
 *   S3 shipwright (East Britanny, Hawkins)      — testigo Alex Diener Ep01 ~3120
 *   S4 shrine quest-ordained (Compassion)       — testigo aulddragon P09 ~4749
 *   S5 Codex (guardian + lectura)               — testigo aulddragon P09 ~5650
 *   S6 mazmorra Deceit (yell/enter/torch/move/search/look/klimb/pit)
 *                                               — testigo aulddragon P16
 *
 * Ejecución (worktree espejo2):
 *   U5_ESPEJO_FASE2=1 U5_E2E_PORT=5244 U5_VITE_CACHE_DIR=<scratch>/vite-cache \
 *     npx playwright test e2e/espejo-fase2.spec.ts
 */
import { test, type Page } from "@playwright/test";
import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import { gotoGame } from "./helpers";

/** Gate OPT-IN de la serie cosechadora (ver cabecera). */
const FASE2_ON = process.env.U5_ESPEJO_FASE2 === "1" || process.env.U5_ESPEJO_FASE2 === "true";

/**
 * Destino de los volcados. El default era el scratchpad de OTRA sesión
 * (`<scratch> auditoría 27-07); ahora es
 * un dir del propio árbol cubierto por el patrón `.espejo-*` del .gitignore. `ESPEJO_OUT`
 * lo sigue sobreescribiendo, así que reproducir contra el destino viejo es una env.
 */
const OUT_DIR =
  process.env.ESPEJO_OUT ??
  path.join(path.dirname(fileURLToPath(import.meta.url)), "..", ".espejo-fase2");

/** Acumulador de consola page-side (poll 35 ms, dedupe por solape máximo). */
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
      // solape máximo: mayor k tal que prev[-k..] casa con cur[0..k) permitiendo que
      // la línea FRONTERA de prev sea prefijo de la de cur (eco que crece in-place).
      let best = 0;
      const max = Math.min(prev.length, cur.length);
      for (let k = max; k > 0; k--) {
        let ok = true;
        for (let i = 0; i < k; i++) {
          const a = prev[prev.length - k + i]!;
          const b = cur[i]!;
          if (a === b) continue;
          if (i === k - 1 && b.startsWith(a)) continue; // frontera creciendo
          ok = false;
          break;
        }
        if (ok) {
          best = k;
          break;
        }
      }
      if (best > 0) {
        // la línea frontera pudo crecer: actualiza el último acc si es prefijo
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

/** Responde a un prompt: overlay .save-name si está visible; si no, teclado directo. */
async function typeAnswer(page: Page, text: string): Promise<void> {
  const overlay = page.locator(".save-name:visible");
  if ((await overlay.count()) > 0) {
    await overlay.fill(text);
    await page.keyboard.press("Enter");
    await page.waitForTimeout(150);
    return;
  }
  await page.keyboard.type(text, { delay: 25 });
  await page.keyboard.press("Enter");
  await page.waitForTimeout(150);
}

async function key(page: Page, k: string, ms = 250): Promise<void> {
  await page.keyboard.press(k);
  await page.waitForTimeout(ms);
}

/** Snapshot del shop console (fase + opciones) para conducir mode-aware. */
async function shopSnap(page: Page): Promise<unknown> {
  return page.evaluate(
    () => (window as unknown as { __u5test?: { shopConsole?: () => unknown } }).__u5test?.shopConsole?.() ?? null,
  );
}

test.describe(FASE2_ON ? "espejo fase 2" : "espejo fase 2 (OFF: falta U5_ESPEJO_FASE2=1)", () => {
  test.skip(!FASE2_ON, "cosechadora OPT-IN: U5_ESPEJO_FASE2=1 (no aserta; no es un gate)");

  test("S1 posada REST — Buccaneer's Den (Ransack)", async ({ page }) => {
    test.setTimeout(90_000);
    await armAccumulator(page);
    await gotoGame(page, { loc: 24, x: 2, y: 16, hour: 10 });
    await page.evaluate(() => {
      const t = (window as unknown as { __u5test: { game: { state: { gold: number } } } }).__u5test;
      t.game.state.gold = 300;
    });
    await key(page, "t");
    await key(page, "ArrowLeft", 600); // Talk-West → Ransack (1,16)
    console.log("shop tras talk:", JSON.stringify(await shopSnap(page)));
    await key(page, "y", 600); // gate Y/N del saludo (si existe)
    console.log("shop tras y:", JSON.stringify(await shopSnap(page)));
    await key(page, "r", 1200); // Rest
    console.log("shop tras r:", JSON.stringify(await shopSnap(page)));
    // por si hay confirm Y/N
    await key(page, "y", 1200);
    await dump(page, "s1-inn-rest");
  });

  test("S2 posada LEAVE — Paws (Lorien)", async ({ page }) => {
    test.setTimeout(90_000);
    await armAccumulator(page);
    await gotoGame(page, { loc: 22, x: 27, y: 10, hour: 10 });
    await key(page, "t");
    await key(page, "ArrowUp", 600); // Talk-North → Lorien (27,9)
    console.log("shop tras talk:", JSON.stringify(await shopSnap(page)));
    await key(page, "y", 600);
    console.log("shop tras y:", JSON.stringify(await shopSnap(page)));
    await key(page, "l", 600); // Leave a companion
    console.log("shop tras l:", JSON.stringify(await shopSnap(page)));
    await key(page, "a", 800); // primer compañero
    console.log("shop tras a:", JSON.stringify(await shopSnap(page)));
    await key(page, "n", 800); // "anything more?" → No
    await dump(page, "s2-inn-leave");
  });

  test("S3 shipwright — East Britanny (Hawkins)", async ({ page }) => {
    test.setTimeout(90_000);
    await armAccumulator(page);
    await gotoGame(page, { loc: 21, x: 3, y: 25, hour: 10 });
    await page.evaluate(() => {
      const t = (window as unknown as { __u5test: { game: { state: { gold: number } } } }).__u5test;
      t.game.state.gold = 400; // llega para skiff (~186), no para frigate (~968)
    });
    await key(page, "t");
    await key(page, "ArrowDown", 600); // Talk-South → Hawkins (3,26)
    console.log("shop tras talk:", JSON.stringify(await shopSnap(page)));
    await key(page, "y", 600);
    console.log("shop tras y:", JSON.stringify(await shopSnap(page)));
    await key(page, "f", 800); // frigate — sin oro: ¿pitch? ¿rechazo?
    console.log("shop tras f:", JSON.stringify(await shopSnap(page)));
    await key(page, "y", 600); // por si hay confirm
    await key(page, "s", 1000); // skiff — con oro
    console.log("shop tras s:", JSON.stringify(await shopSnap(page)));
    await key(page, "y", 800);
    await dump(page, "s3-shipwright");
  });

  test("S4 shrine quest-ordained — Compassion (128,92)", async ({ page }) => {
    test.setTimeout(90_000);
    await armAccumulator(page);
    await gotoGame(page, { loc: 0, x: 128, y: 93, hour: 10 });
    await key(page, "ArrowUp", 800); // pisa el santuario → ceremonia
    await page.waitForTimeout(400);
    await typeAnswer(page, "COMPASSION");
    await typeAnswer(page, "MU");
    await typeAnswer(page, "MU");
    await typeAnswer(page, "MU");
    await page.waitForTimeout(800);
    await dump(page, "s4-shrine-ordained");
  });

  test("S5 Codex — guardián + lectura (quest activa)", async ({ page }) => {
    test.setTimeout(90_000);
    await armAccumulator(page);
    await gotoGame(page, { loc: 0, x: 233, y: 237, hour: 10 });
    await page.evaluate(() => {
      const t = (window as unknown as { __u5test: { game: { state: Record<string, unknown> } } }).__u5test;
      t.game.state.shrineQuestBitmap = 1 << 1; // quest de Compassion activa
    });
    for (let i = 0; i < 6; i++) await key(page, "ArrowUp", 500); // norte hacia (233,235) guardián y Codex
    await page.waitForTimeout(800);
    await dump(page, "s5-codex");
  });

  test("S6 mazmorra Deceit — yell/enter/torch/move/search/look/pit/klimb", async ({ page }) => {
    test.setTimeout(120_000);
    await armAccumulator(page);
    await gotoGame(page, { loc: 0, x: 240, y: 74, hour: 10 });
    // 1. YELL de la palabra de poder ADYACENTE a la entrada (240,73)
    await key(page, "y", 500);
    await typeAnswer(page, "FALLAX");
    await page.waitForTimeout(400);
    // 2. pisar la entrada + (E)nter
    await key(page, "ArrowUp", 400);
    await key(page, "e", 800);
    // 3. antorcha
    await page.evaluate(() => {
      const t = (window as unknown as { __u5test: { game: { state: { torches: number } } } }).__u5test;
      t.game.state.torches = 3;
    });
    await key(page, "i", 400);
    // 4. search del muro-puerta-secreta al norte de la entrada (1,0): girar 180
    await key(page, "ArrowLeft", 300); // sur→este
    await key(page, "ArrowLeft", 300); // este→norte
    await key(page, "s", 500); // Search (directional-ahead)
    await page.keyboard.press("Enter").catch(() => {}); // por si hay party-select
    await page.waitForTimeout(400);
    // 5. look
    await key(page, "l", 500);
    await page.waitForTimeout(200);
    // 6. re-encarar sur y ruta al PitFall (3,2): (1,1)→(1,3)→(3,3)→(3,2)
    await key(page, "ArrowLeft", 300); // norte→oeste
    await key(page, "ArrowLeft", 300); // oeste→sur
    await key(page, "ArrowUp", 300); // (1,2)
    await key(page, "ArrowUp", 400); // (1,3) — "A pit." hoyo simple
    await key(page, "ArrowLeft", 300); // sur→este
    await key(page, "ArrowUp", 300); // (2,3)
    await key(page, "ArrowUp", 300); // (3,3)
    await key(page, "ArrowLeft", 300); // este→norte
    await key(page, "ArrowUp", 1000); // (3,2) PitFall → "Pit Trap!/Falling.../...splat!"
    await page.waitForTimeout(600);
    console.log(
      "dungeonPos tras pit:",
      JSON.stringify(
        await page.evaluate(() => {
          const ds = (window as unknown as { __u5test: { game: { dungeonState?: { pos: unknown } } } })
            .__u5test.game.dungeonState;
          return ds ? ds.pos : null;
        }),
      ),
    );
    await dump(page, "s6-dungeon-deceit");
  });
});
