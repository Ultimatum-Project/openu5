/**
 * CAPTURA DETERMINISTA DEL PORT (piel fiel) para el arnés píxel-diff (task #26).
 *
 * Vuelca el canvas LÓGICO 320×200 de la PIEL FIEL SIN escalar (toDataURL: la
 * resolución interna del canvas es 320×200 pase lo que pase el CSS). Cada shot → una
 * PNG nombrada, lista para `compare.py` contra la captura gemela del original.
 *
 * Dos familias de shots:
 *   · @samestate — FASE 2: arranca la piel fiel SIN cinemática (`?skin=faithful&
 *     nointro=1`) y carga un SAVED.GAM nativo del original con `__u5test.loadNativeSave`
 *     (bytes de original/av-saves). Es el GEMELO exacto del que `capture_original.py`
 *     siembra en el oráculo → comparación de mismo-estado con `regions-samestate.json`.
 *   · hora fija — FASE 1: partida nueva (INIT) variando la hora, para contrastar la
 *     banda del cielo. No tiene gemelo mismo-estado; queda como material de calibración.
 *
 * Standalone (config propio); NO forma parte de `npm run e2e`. Uso:
 *     npx playwright test -c tools/pixeldiff/capture.config.ts               # todos
 *     npx playwright test -c tools/pixeldiff/capture.config.ts --grep @samestate
 *
 * Salida: PIXELDIFF_OUT (por defecto original/av-referencia/_pixeldiff), gitignored.
 * Los @samestate van a …/samestate/port, el resto a …/port-capture. Nunca se commitean.
 */
import { test, expect, type Page, type Locator } from "@playwright/test";
import { promises as fs } from "node:fs";
import { readFileSync } from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(HERE, "../../..");
const OUT_ROOT =
  process.env.PIXELDIFF_OUT ??
  path.resolve(REPO_ROOT, "original/av-referencia/_pixeldiff");
const SAMESTATE_OUT = path.join(OUT_ROOT, "samestate", "port");
const HOUR_OUT = path.join(OUT_ROOT, "port-capture");

interface Case {
  name: string;
  save: string; // ruta relativa al repo (original/av-saves/…)
  note?: string;
}
const cases: Case[] = (
  JSON.parse(readFileSync(path.join(HERE, "samestate-cases.json"), "utf-8")) as {
    cases: Case[];
  }
).cases;

/** Espera a que la piel fiel monte su canvas lógico 320×200 y lo devuelve. */
async function faithfulCanvas(page: Page): Promise<Locator> {
  const canvas = page.locator(".faithful-skin canvas");
  await expect(canvas).toBeVisible({ timeout: 30_000 });
  await expect(canvas).toHaveAttribute("width", "320");
  await expect(canvas).toHaveAttribute("height", "200");
  return canvas;
}

async function dumpCanvas(canvas: Locator, file: string): Promise<void> {
  const dataUrl = await canvas.evaluate((el) =>
    (el as HTMLCanvasElement).toDataURL("image/png"),
  );
  const b64 = dataUrl.replace(/^data:image\/png;base64,/, "");
  await fs.writeFile(file, Buffer.from(b64, "base64"));
}

test.describe("captura del port (piel fiel) — mismo-estado @samestate", () => {
  test.beforeAll(async () => {
    await fs.mkdir(SAMESTATE_OUT, { recursive: true });
  });

  for (const c of cases) {
    test(`${c.name} @samestate`, async ({ page }) => {
      // Piel fiel SIN cinemática: arranca directo en el mundo (nointro, DEV).
      // `fresh` = guard de determinismo (#28): nointro auto-restaura el último save,
      // pero aquí queremos partida nueva → el .GAM del oráculo se carga abajo.
      await page.addInitScript(() => localStorage.clear());
      await page.goto(`/?skin=faithful&nointro=1&seed=1&fresh=1`);
      const canvas = await faithfulCanvas(page);

      // Carga el MISMO SAVED.GAM nativo que el oráculo (bytes del original).
      const gam = await fs.readFile(path.join(REPO_ROOT, c.save));
      await page.evaluate((arr) => {
        const hooks = (
          window as unknown as {
            __u5test?: { loadNativeSave?: (b: number[]) => void };
          }
        ).__u5test;
        if (!hooks?.loadNativeSave) {
          throw new Error("__u5test.loadNativeSave ausente (¿DEV? ¿nointro?)");
        }
        hooks.loadNativeSave(arr);
      }, Array.from(gam));

      // Deja que la piel re-renderice el estado cargado (map-changed).
      await page.waitForTimeout(400);
      await dumpCanvas(canvas, path.join(SAMESTATE_OUT, `${c.name}.png`));
    });
  }
});

/**
 * DESENLACE (#176, hueco 2 de /verificacion) — captura el canvas de la piel fiel en
 * cada instante de `endgame-cases.json`, para carearlo contra los fotogramas del
 * testigo en vídeo (`endgame_visual.py`).
 *
 * El final se SIEMBRA por `__u5test` exactamente como hace `game/e2e/endgame.spec.ts`
 * (3 Shadowlords + 3 regalías + Doom planta 7 + `checkDoomRescue` por el bridge real):
 * el DISPARADOR queda fuera del marco por decisión de la ficha — lo que se compara es
 * la SECUENCIA una vez el final corre, no cómo se llega a él (eso es #179).
 *
 * 🔴 SIN `?scenebeat`: las cadencias reales son las que hacen capturable la disolución.
 * Con el knob a 40 ms la fase `dissolve` dura 40 ms y no hay dónde capturar; sin knob
 * dura 3 s (EG_DISSOLVE_MS) y `espera_ms` cae cómodamente dentro. Los beats de TEXTO
 * siguen esperando tecla con knob o sin él, así que el coste real de no ponerlo es la
 * animación del orbe (~12 s) — barato a cambio de que el instante exista.
 *
 * 🔴 La FASE SOLA NO IDENTIFICA la pantalla en las páginas de historia: `storyHouse`
 * cubre las páginas 0-1 y `storyDream` las 2-5. Por eso el objetivo es el par
 * (fase, página) y se lee con el hook `__u5test.endgameStoryPage()`.
 */
interface EndgameCase {
  name: string;
  phase: string;
  page?: number;
  espera_ms?: number;
}
const endgameCases: EndgameCase[] = (
  JSON.parse(readFileSync(path.join(HERE, "endgame-cases.json"), "utf-8")) as {
    cases: EndgameCase[];
  }
).cases;
const ENDGAME_OUT = path.join(OUT_ROOT, "endgame", "port");

test.describe("captura del port (piel fiel) — desenlace @endgame", () => {
  test("secuencia del desenlace, un volcado por instante", async ({ page }) => {
    test.setTimeout(180_000);
    await fs.mkdir(ENDGAME_OUT, { recursive: true });
    await page.addInitScript(() => localStorage.clear());
    await page.goto(`/?skin=faithful&nointro=1&seed=1&fresh=1`);
    const canvas = await faithfulCanvas(page);

    // Siembra idéntica a e2e/endgame.spec.ts (con la Sandalwood Box → rama VICTORIA).
    // #179: el desenlace se dispara por la cadena FIEL — caída al foso de la planta 6,
    // combate de la celda cm127 y absorción total (re/notes/absorcion-179-acta.md).
    await page.evaluate(() => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const t = (window as any).__u5test;
      const g = t.game;
      g.state.questFlags["shadowlord-dead:falsehood"] = true;
      g.state.questFlags["shadowlord-dead:hatred"] = true;
      g.state.questFlags["shadowlord-dead:cowardice"] = true;
      g.state.lbArtifacts = { amulet: true, crown: true, sceptre: true };
      g.state.specialItems.woodenBox = true;
      g.enterDungeon(40);
      const ds = g.dungeonState;
      ds.pos.floor = 6;
      ds.pos.x = 4;
      ds.pos.y = 7;
      ds.pos.facing = "east";
      t.applyEvents(g.checkDoomRescue()); // marca in-doom (#179: ya no dispara nada)
    });
    await page.keyboard.press("ArrowUp"); // paso al foso → caída → sala cm127
    await page.waitForFunction(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      () => (window as any).__u5test.game.combat !== null,
      undefined,
      { timeout: 10_000 },
    );
    await page.evaluate(() => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const t = (window as any).__u5test;
      const g = t.game;
      const c = g.combat;
      let guard = 0;
      while (c && !c.over && guard++ < 60) {
        const cur = c.currentUnit;
        if (!cur || cur.kind !== "player") break;
        cur.x = 5;
        cur.y = 3;
        c.playerMove("north"); // pisa (5,2) bajo el alma → absorbido
      }
      if (!c || !c.absorptionSentinel) throw new Error("la absorción no armó el centinela");
      t.applyEvents(g.endCombat());
    });

    const liveTarget = async (): Promise<{ phase: string | null; page: number | null }> =>
      page.evaluate(() => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const t = (window as any).__u5test;
        return {
          phase: (t.endgamePhase?.() as string | null) ?? null,
          page: (t.endgameStoryPage?.() as number | null) ?? null,
        };
      });

    // Los casos van EN ORDEN de la secuencia: se recorre una sola vez pulsando Espacio
    // (los beats de animación se la tragan) y se vuelca al llegar a cada objetivo.
    for (const c of endgameCases) {
      const t0 = Date.now();
      let llegado = false;
      while (Date.now() - t0 < 60_000) {
        const live = await liveTarget();
        if (live.phase === c.phase && (c.page === undefined || live.page === c.page)) {
          llegado = true;
          break;
        }
        await page.keyboard.press("Space");
        await page.waitForTimeout(80);
      }
      if (!llegado) {
        const live = await liveTarget();
        throw new Error(
          `la escena no llegó a ${c.phase}${c.page !== undefined ? ` página ${c.page}` : ""}` +
            ` (vivo: fase=${live.phase} página=${live.page})`,
        );
      }
      if (c.espera_ms) await page.waitForTimeout(c.espera_ms);
      await dumpCanvas(canvas, path.join(ENDGAME_OUT, `${c.name}.png`));
    }
  });
});

/** FASE 1 (calibración, sin gemelo mismo-estado): partida nueva variando la hora. */
const HOUR_SHOTS = [
  { name: "world_dawn", hour: 6 },
  { name: "world_noon", hour: 12 },
  { name: "world_dusk", hour: 18 },
];

test.describe("captura del port (piel fiel) — hora fija", () => {
  test.beforeAll(async () => {
    await fs.mkdir(HOUR_OUT, { recursive: true });
  });

  for (const shot of HOUR_SHOTS) {
    test(shot.name, async ({ page }) => {
      await page.addInitScript(() => localStorage.clear());
      await page.goto(`/?skin=faithful&nointro=1&seed=1&fresh=1&hour=${shot.hour}`);
      const canvas = await faithfulCanvas(page);
      await page.waitForTimeout(200);
      await dumpCanvas(canvas, path.join(HOUR_OUT, `${shot.name}.png`));
    });
  }
});
