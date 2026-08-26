/**
 * CAREO VISUAL — RÉGIMEN 2: captura DENSA de la CEREMONIA DE CONJURO (rect XOR del
 * viewport de `CAST2:0x0000`).
 *
 * Por qué existe. El censo de #166 agrupó los 161 eventos de inversión de Lord Fenton
 * por DURACIÓN y avisó de que era un proxy. Al nombrarlos por su CONTENIDO (la consola
 * del fotograma anterior) resulta que **128 de los 161 son la MISMA ceremonia**: el
 * destello de conjuro, cuya ventana es función del CÍRCULO del hechizo (medido: 2,16 s
 * en círculo 1 … 6,40 s en círculo 8, ley afín con R²≈1). Y esa ceremonia es la que el
 * port ya modela para el PERGAMINO de tiempo (`TimeSpellFlash` + `timeSpellFlashWindowMs`,
 * la misma CAST2:0x0000) pero **no dispara al castear**: `doCast` emite el cue
 * `cast-spell` (que además es la fanfarria de victoria, atribución declarada falsa en
 * `sfx-catalog.md` §3.5) y la piel fiel no invierte nada con él.
 *
 * Este arnés mide las DOS caras con el MISMO instrumento y en la MISMA sesión:
 *   · `scroll-antym` — (U)se de pergamino An Tym: el port SÍ invierte. Es el CONTROL
 *     POSITIVO del instrumento: si esta ceremonia no saliera bimodal, un «no hay
 *     destello» en las otras no probaría nada.
 *   · `cast-vaslor` / `cast-mani` — (C)ast de un hechizo ordinario. Predicción del
 *     código: NINGUNA inversión. Vas Lor se elige porque su efecto es SILENCIOSO y sin
 *     picker de objetivo (CAST 0x0f20), así que la captura no mezcla otra escena.
 *
 * CONTROL POSITIVO **del régimen 2** (obligatorio; un careo ralo no puede verlo), por
 * `page.route` sobre el módulo que sirve vite — el árbol no se toca:
 *   · CAREO_SIEMBRA=ventana-corta   — la ventana de inversión a la MITAD. El par
 *     antes/después del careo ralo es idéntico; el denso ve 2945→1472 ms.
 *   · CAREO_SIEMBRA=orden-cambiado  — INTERCAMBIA `delay` y `dur` (el retardo del
 *     noise_burst pasa a ser la ventana y viceversa). Duración TOTAL de la escena
 *     idéntica y mismos extremos: sólo el denso lo ve, y ni siquiera un careo que
 *     midiese «cuánto dura la ceremonia» lo cazaría.
 *
 * Uso (REGLA 3: puerto propio 52xx censado con `lsof -ti` ANTES y `<title>` DESPUÉS):
 *   CAREO_PORT=5261 CAREO_CEREMONIA=scroll-antym CAREO_OUT=<dir> \
 *     npx playwright test -c tools/careo-visual/densa-hechizo.config.ts
 */
import { test, expect, type Page, type Locator } from "@playwright/test";
import { promises as fs } from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUT = process.env.CAREO_OUT ?? path.join(HERE, "_out-hechizo");
const CEREMONIA = process.env.CAREO_CEREMONIA ?? "scroll-antym";
const SIEMBRA = process.env.CAREO_SIEMBRA ?? "";
const REC_MS = Number(process.env.CAREO_REC_MS ?? 9000);

declare global {
  interface Window {
    __careoHx?: { frames: { t: number; png: string }[]; stop: () => void };
  }
}

async function faithfulCanvas(page: Page): Promise<Locator> {
  const canvas = page.locator(".faithful-skin canvas");
  await expect(canvas).toBeVisible({ timeout: 30_000 });
  await expect(canvas).toHaveAttribute("width", "320");
  await expect(canvas).toHaveAttribute("height", "200");
  return canvas;
}

async function dump(canvas: Locator, file: string): Promise<void> {
  const d = await canvas.evaluate((el) => (el as HTMLCanvasElement).toDataURL("image/png"));
  await fs.writeFile(file, Buffer.from(d.replace(/^data:image\/png;base64,/, ""), "base64"));
}

const consola = (page: Page): Promise<string[]> =>
  page.evaluate(() => {
    const h = (window as unknown as Record<string, unknown>).__u5test as
      | { consoleLines?: () => string[] }
      | undefined;
    return h?.consoleLines?.() ?? [];
  });

interface PickerProbe {
  phase: string;
  rows: { name: string }[];
  cursor: number;
}
const picker = (page: Page): Promise<PickerProbe | null> =>
  page.evaluate(() => {
    const h = (window as unknown as Record<string, unknown>).__u5test as
      | { readyPicker?: () => PickerProbe | null }
      | undefined;
    return h?.readyPicker?.() ?? null;
  });

async function pickerUse(page: Page, label: string): Promise<void> {
  for (let i = 0; i < 40; i++) {
    const pk = await picker(page);
    if (!pk || pk.phase !== "pick") throw new Error("pickerUse: el picker no está abierto");
    if (pk.rows[pk.cursor]?.name.includes(label)) {
      await page.locator("body").press("Enter");
      return;
    }
    await page.locator("body").press("ArrowDown");
  }
  throw new Error(`pickerUse: no encontré "${label}"`);
}

/** Siembra sobre el módulo que sirve vite (no toca el árbol). */
async function sembrar(page: Page): Promise<void> {
  if (!SIEMBRA) return;
  await page.route("**/src/skin/fiel/speaker.ts", async (route) => {
    const res = await route.fetch();
    const body = await res.text();
    const ANCLA = "  return { delay: intro, dur: 2 * sweep };";
    if (!body.includes(ANCLA)) throw new Error("SIEMBRA: el ancla no casó en speaker.ts");
    let nuevo: string;
    if (SIEMBRA === "ventana-corta") {
      nuevo = "  return { delay: intro, dur: sweep };";
    } else if (SIEMBRA === "orden-cambiado") {
      // Mismo TOTAL (delay+dur), fases intercambiadas: la inversión empieza antes y dura
      // lo que duraba el retardo. Un careo de «duración total» lo daría por bueno.
      nuevo = "  return { delay: 2 * sweep, dur: intro };";
    } else {
      throw new Error(`SIEMBRA desconocida: ${SIEMBRA}`);
    }
    await route.fulfill({ response: res, body: body.replace(ANCLA, nuevo) });
  });
}

/** Deja la party con maná, hechizos mezclados, pergaminos y un herido. */
async function sembrarBolsa(page: Page): Promise<void> {
  await page.evaluate(() => {
    const s = (
      window as unknown as { __u5test: { state: () => Record<string, unknown> } }
    ).__u5test.state() as Record<string, unknown> & {
      spellQuantities: number[];
      scrollQuantities: number[];
      potionQuantities: number[];
      characters: Array<Record<string, unknown>>;
      partySize: number;
      activeCharacter: number;
    };
    s.spellQuantities.fill(9);
    s.scrollQuantities.fill(0);
    s.potionQuantities.fill(0);
    s.potionQuantities[1] = 3; // pociones amarillas (color 1) para la ceremonia `pocion`
    s.scrollQuantities[7] = 3; // An Tym
    const c = s.characters[0]!;
    c.currentMp = 99;
    c.maxMp = 99;
    c.level = 8;
    // Un herido para que MANI tenga a quien curar.
    const h = (s.characters[1] ?? s.characters[0]!) as Record<string, number>;
    h.currentHp = Math.max(1, Math.floor((h.maxHp as number) / 3));
    s.activeCharacter = 0;
  });
}

test(`careo denso — ceremonia de conjuro (${CEREMONIA})`, async ({ page }) => {
  await fs.mkdir(OUT, { recursive: true });
  await page.addInitScript(() => localStorage.clear());
  await sembrar(page);
  await page.goto("/?skin=faithful&nointro&loc=0&x=82&y=108&seed=4242");
  const canvas = await faithfulCanvas(page);
  await page.waitForTimeout(1000);
  await sembrarBolsa(page);
  await page.waitForTimeout(200);

  // ── El par RALO: lo único que un careo por compás vería (antes / asentado).
  await dump(canvas, path.join(OUT, "ralo-antes.png"));

  // Grabador denso EN LA PÁGINA: un volcado por rAF con marca de tiempo.
  await page.evaluate(() => {
    const el = document.querySelector(".faithful-skin canvas") as HTMLCanvasElement;
    const t0 = performance.now();
    const st = { frames: [] as { t: number; png: string }[], stop: (): void => {} };
    let vivo = true;
    st.stop = () => {
      vivo = false;
    };
    const tick = (): void => {
      if (!vivo) return;
      st.frames.push({ t: performance.now() - t0, png: el.toDataURL("image/png") });
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
    window.__careoHx = st;
  });

  // ── El disparo de la ceremonia.
  if (CEREMONIA === "scroll-antym") {
    await page.locator("body").press("u");
    await page.waitForTimeout(120);
    // El overlay de (U)se rotula los pergaminos con `*` + iniciales (An Tym = `*AT`),
    // no con el nombre largo: medido abriendo el picker (no supuesto del nombre del ítem).
    await pickerUse(page, "*AT");
  } else if (CEREMONIA === "cast-vaslor") {
    await page.locator("body").press("c");
    await page.waitForTimeout(120);
    for (const ch of "vl") await page.locator("body").press(ch);
    await page.locator("body").press("Enter");
  } else if (CEREMONIA === "cast-mani") {
    await page.locator("body").press("c");
    await page.waitForTimeout(120);
    await page.locator("body").press("m");
    await page.locator("body").press("Enter");
    await page.waitForTimeout(250);
    await page.locator("body").press("2"); // On who: 2º miembro (el herido)
  } else if (CEREMONIA === "pocion") {
    // (U)se de POCIÓN: en el binario también pasa por CAST2:0x0000 — CAST.OVL 0x139b
    // empuja `[bp+4]`, que es el COLOR de la poción (0..7), como índice del jingle.
    // El overlay rotula las pociones con `!` + color (la de índice 1 es `!Yellow`).
    await page.locator("body").press("u");
    await page.waitForTimeout(120);
    await pickerUse(page, "!Yellow");
    await page.waitForTimeout(250);
    await page.locator("body").press("1"); // On who: 1er miembro
  } else {
    throw new Error(`CEREMONIA desconocida: ${CEREMONIA}`);
  }

  await page.waitForTimeout(REC_MS);
  await page.evaluate(() => window.__careoHx?.stop());
  await page.waitForTimeout(200);

  const frames = await page.evaluate(() => window.__careoHx?.frames ?? []);
  // eslint-disable-next-line no-console
  console.log(`fotogramas densos: ${frames.length} en ${REC_MS} ms`);

  const dir = path.join(OUT, "densa");
  await fs.mkdir(dir, { recursive: true });
  const idx: Array<{ i: number; t: number; f: string }> = [];
  for (let i = 0; i < frames.length; i++) {
    const f = frames[i]!;
    const name = `d${String(i).padStart(4, "0")}.png`;
    await fs.writeFile(
      path.join(dir, name),
      Buffer.from(f.png.replace(/^data:image\/png;base64,/, ""), "base64"),
    );
    idx.push({ i, t: Math.round(f.t * 1000) / 1000, f: name });
  }
  await dump(canvas, path.join(OUT, "ralo-despues.png"));

  // La ventana que el propio port DERIVA, leída del módulo (no re-derivada aquí: si el
  // modelo del altavoz se mueve, esta cifra se mueve con él).
  const ventana = await page.evaluate(async () => {
    // 🔴 El especificador va en una VARIABLE a propósito: es una URL que resuelve VITE en
    // el navegador, no un módulo del proyecto de `game/tools` — con el literal pegado,
    // `tsc -p tools/tsconfig.json` lo intenta resolver y da TS2307 (medido: la batería
    // enrojece por la guarda `tsc tools`, que `tsc -p game/tsconfig.json` NO cubre).
    const url = "/src/skin/fiel/speaker.ts";
    const m = (await import(/* @vite-ignore */ url)) as unknown as {
      timeSpellFlashWindowMs: (i: number) => { delay: number; dur: number };
    };
    return Object.fromEntries(
      [0, 1, 2, 3, 4, 5, 6, 7, 8].map((i) => [i, m.timeSpellFlashWindowMs(i)]),
    );
  });

  await fs.writeFile(
    path.join(OUT, "meta.json"),
    JSON.stringify(
      {
        ceremonia: CEREMONIA,
        siembra: SIEMBRA || null,
        rec_ms: REC_MS,
        n: idx.length,
        ventana_derivada_ms: ventana,
        consola: (await consola(page)).slice(-16),
        frames: idx,
      },
      null,
      1,
    ),
  );
  expect(idx.length).toBeGreaterThan(100);
});
