/**
 * CAPTURA COMPARATIVA del re-flow vertical (canónico vs re-flow), 5 teléfonos × 4 estados.
 *
 * NO es un test: es el banco de EVIDENCIA para que el usuario decida. Mide el área REAL
 * del visor 11×11 en la página (no un modelo) y guarda las capturas emparejadas + un
 * `metricas.json` con px², % de pantalla y el factor medido.
 *
 *   U5_PORT=5289 OUT=<dir> npx tsx tools/portrait-reflow/capturar.ts [--headless]
 *
 * REGLAS DEL CARRIL respetadas: dev server PROPIO en un puerto 52xx (nunca el 5199 del
 * usuario), navegador VISIBLE por defecto (regla del usuario), y el arnés no toca ningún
 * fichero de la suite existente.
 */
import { chromium, type Browser, type Page } from "@playwright/test";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { portraitLayout } from "../../src/skin/portrait/layout.js";

const PORT = process.env.U5_PORT ?? "5289";
const BASE = `http://localhost:${PORT}`;
const OUT = process.env.OUT ?? "/tmp/portrait-reflow";
const HEADLESS = process.argv.includes("--headless");

/** Los 5 teléfonos verticales del encargo (CSS px + DPR real del hardware). */
const DEVICES = [
  { id: "iphone-se", name: "iPhone SE", w: 375, h: 667, dpr: 2 },
  { id: "galaxy-s8", name: "Galaxy S8", w: 360, h: 740, dpr: 3 },
  { id: "iphone-15", name: "iPhone 15", w: 393, h: 852, dpr: 3 },
  { id: "pixel-7", name: "Pixel 7", w: 412, h: 915, dpr: 2.625 },
  { id: "iphone-15-pro-max", name: "iPhone 15 Pro Max", w: 430, h: 932, dpr: 3 },
] as const;

/** Los 4 estados del encargo. `drive` deja la pantalla en el estado a fotografiar. */
const STATES = [
  { id: "mundo", label: "Mundo (overworld, llanura)", drive: async (): Promise<void> => {} },
  {
    id: "log-largo",
    label: "Log largo (consola con historial)",
    drive: async (page: Page): Promise<void> => {
      // Pasos + Look: cada acción escribe en la consola → llena las 12 filas del log.
      for (const k of ["ArrowRight", "ArrowDown", "ArrowLeft", "ArrowUp"]) {
        for (let i = 0; i < 2; i++) await press(page, k);
      }
      await press(page, "l");
      await press(page, "ArrowUp");
      await press(page, "l");
      await press(page, "ArrowDown");
    },
  },
  {
    id: "ztats",
    label: "Ztats (ficha de personaje en el panel)",
    drive: async (page: Page): Promise<void> => {
      await press(page, "z");
      await press(page, "1");
    },
  },
  {
    id: "combate",
    label: "Combate (arena, tras atacar a un goblin)",
    drive: async (page: Page): Promise<void> => {
      // Goblin (def 0) sembrado al ESTE — patrón determinista de attack.spec.
      await page.evaluate(() => {
        const t = (window as unknown as { __u5test?: { game?: unknown } }).__u5test;
        const g = t?.game as
          | { overworldEnemies?: { enemies: unknown[] } }
          | undefined;
        g?.overworldEnemies?.enemies.push({ defIndex: 0, tile: 0x94, water: false, x: 61, y: 60 });
      });
      await press(page, "ArrowRight"); // paso al contacto = ataque
      await page
        .waitForFunction(
          () => {
            const t = (window as unknown as { __u5test?: { game?: { combat?: unknown } } }).__u5test;
            return t?.game?.combat != null;
          },
          undefined,
          { timeout: 8_000 },
        )
        .catch(() => undefined);
    },
  },
] as const;

/**
 * HALLAZGO DE LA MEDICIÓN que motiva la 3ª variante: la botonera NO mide 326 px. En modo
 * MUNDO la rejilla de ~20 comandos está capada a `max-height:46vh` (`index.html:257`) y
 * el deck entero se come 428-550 px = 58-64 % de la pantalla; en COMBATE, con 2 botones,
 * son 321 px fijos. El layout CLÁSICO es insensible (width-limited: esa botonera se come
 * letterbox NEGRO, por eso nadie lo notó); el re-flow es height-limited y lo paga entero.
 * Esta variante NO toca la plataforma: inyecta un override de CSS en el arnés para MEDIR
 * cuánto valdría el re-flow con una rejilla de comandos más corta.
 */
const DECK_CORTO_CSS = ".touch-commands { max-height: 22vh !important; }";

const VARIANTS = [
  { id: "canonico", label: "Canónico (bandera OFF)", query: "" },
  { id: "reflow", label: "Re-flow vertical (bandera ON)", query: "&reflow=force" },
  {
    id: "reflow-deck-corto",
    label: "Re-flow + rejilla de comandos a 22vh (sólo arnés, la plataforma no se toca)",
    query: "&reflow=force",
    css: DECK_CORTO_CSS,
  },
] as const;

async function press(page: Page, key: string): Promise<void> {
  await page.keyboard.press(key);
  await page.waitForTimeout(120);
}

interface Metric {
  device: string;
  deviceId: string;
  w: number;
  h: number;
  state: string;
  variant: string;
  kind: string;
  /** Rect CSS del visor 11×11 en la página. */
  playRect: { left: number; top: number; width: number; height: number };
  playArea: number;
  playPct: number;
  availW: number;
  availH: number;
  file: string;
}

/**
 * Área del visor 11×11 MEDIDA EN LA PÁGINA. En re-flow la da la sonda de la piel; en
 * canónico se deriva del rect CSS del canvas (176/320 × 176/200 de su tamaño), que es
 * exactamente la porción del 320×200 que ocupa el visor.
 */
async function measure(page: Page): Promise<{
  kind: string;
  playRect: { left: number; top: number; width: number; height: number };
  playArea: number;
  playPct: number;
  availW: number;
  availH: number;
}> {
  return page.evaluate(() => {
    const probe = (
      window as unknown as { __u5reflow?: { probe: () => Record<string, unknown> | null } }
    ).__u5reflow?.probe();
    if (probe) {
      return {
        kind: probe.kind as string,
        playRect: probe.playRect as { left: number; top: number; width: number; height: number },
        playArea: probe.playArea as number,
        playPct: probe.playPct as number,
        availW: probe.availW as number,
        availH: probe.availH as number,
      };
    }
    let best: HTMLCanvasElement | null = null;
    let area = 0;
    for (const c of document.querySelectorAll<HTMLCanvasElement>("#app canvas")) {
      const b = c.getBoundingClientRect();
      if (b.width * b.height > area) {
        area = b.width * b.height;
        best = c;
      }
    }
    const b = best?.getBoundingClientRect();
    const container = best?.parentElement?.getBoundingClientRect();
    if (!b) {
      return {
        kind: "none",
        playRect: { left: 0, top: 0, width: 0, height: 0 },
        playArea: 0,
        playPct: 0,
        availW: 0,
        availH: 0,
      };
    }
    // El visor 11×11 ocupa (8,8)+176×176 de la pantalla lógica 320×200.
    const rect = {
      left: b.left + (8 / 320) * b.width,
      top: b.top + (8 / 200) * b.height,
      width: (176 / 320) * b.width,
      height: (176 / 200) * b.height,
    };
    const a = rect.width * rect.height;
    return {
      kind: "clasico-fiel",
      playRect: rect,
      playArea: a,
      playPct: (a / (window.innerWidth * window.innerHeight)) * 100,
      availW: container?.width ?? 0,
      availH: container?.height ?? 0,
    };
  });
}

async function capture(browser: Browser): Promise<Metric[]> {
  const metrics: Metric[] = [];
  for (const d of DEVICES) {
    for (const v of VARIANTS) {
      for (const s of STATES) {
        const ctx = await browser.newContext({
          viewport: { width: d.w, height: d.h },
          deviceScaleFactor: d.dpr,
          isMobile: true,
          hasTouch: true,
        });
        const page = await ctx.newPage();
        await page.addInitScript(() => localStorage.clear());
        const css = "css" in v ? (v.css as string) : null;
        if (css) {
          // ANTES de la carga: el deck mide su reserva al montarse, así que el override
          // tiene que estar en el `head` desde el principio (un `addStyleTag` posterior
          // no re-dispara `syncReserve`).
          // Se inserta SIEMPRE en DOMContentLoaded (no antes): el `<style>` inline de
          // `index.html` ya está parseado, así que este va DESPUÉS en el orden de cascada.
          await page.addInitScript((c: string) => {
            document.addEventListener("DOMContentLoaded", () => {
              const s = document.createElement("style");
              s.textContent = c;
              document.head.appendChild(s);
            });
          }, css);
        }
        const url = `${BASE}/?skin=faithful&nointro&loc=0&x=60&y=60&hour=10&seed=7&lang=es${v.query}`;
        await page.goto(url);
        await page.waitForFunction(
          () =>
            (window as unknown as { __u5test?: { worldReady?: () => boolean } }).__u5test?.worldReady?.() ===
            true,
          undefined,
          { timeout: 25_000 },
        );
        await page.waitForTimeout(700); // asiento del layout tras la reserva del deck
        await s.drive(page);
        await page.waitForTimeout(500);
        const m = await measure(page);
        const file = `${d.id}__${s.id}__${v.id}.png`;
        await page.screenshot({ path: join(OUT, file) });
        metrics.push({
          device: d.name,
          deviceId: d.id,
          w: d.w,
          h: d.h,
          state: s.id,
          variant: v.id,
          file,
          ...m,
        });
        process.stdout.write(
          `· ${d.id} ${s.id} ${v.id}: ${m.kind} ${Math.round(m.playArea).toLocaleString("es")} px² ` +
            `(${m.playPct.toFixed(1)} % de pantalla)\n`,
        );
        await ctx.close();
      }
    }
  }
  return metrics;
}

const N = (x: number): string => Math.round(x).toLocaleString("es");

function indexHtml(metrics: Metric[]): string {
  const byKey = new Map<string, Metric>();
  for (const m of metrics) byKey.set(`${m.deviceId}|${m.state}|${m.variant}`, m);
  const rows: string[] = [];
  for (const d of DEVICES) {
    rows.push(`<h2>${d.name} — ${d.w}×${d.h}</h2>`);
    for (const s of STATES) {
      const c = byKey.get(`${d.id}|${s.id}|canonico`);
      const r = byKey.get(`${d.id}|${s.id}|reflow`);
      if (!c || !r) continue;
      const k = byKey.get(`${d.id}|${s.id}|reflow-deck-corto`);
      const factor = c.playArea > 0 ? r.playArea / c.playArea : 0;
      const factorK = c.playArea > 0 && k ? k.playArea / c.playArea : 0;
      // ¿Qué elegiría la bandera `?reflow=1` (decisión honesta) en este hueco?
      const auto = portraitLayout(r.availW, r.availH, 1).kind;
      rows.push(`<section>
  <h3>${s.label} <span class="f ${factor >= 1 ? "win" : "lose"}">${factor.toFixed(2)}×</span>
    ${k ? `<span class="f ${factorK >= 1 ? "win" : "lose"}">${factorK.toFixed(2)}× con deck corto</span>` : ""}
    <span class="auto">botonera ${N(d.h - r.availH)} px · hueco de juego ${N(r.availW)}×${N(r.availH)}
    · bandera <code>?reflow=1</code> elegiría <b>${auto}</b></span></h3>
  <div class="pair">
    <figure><img src="${c.file}" alt=""><figcaption>Canónico · visor
      ${N(c.playArea)} px² (${c.playPct.toFixed(1)} % de la pantalla)</figcaption></figure>
    <figure><img src="${r.file}" alt=""><figcaption>Re-flow · visor
      ${N(r.playArea)} px² (${r.playPct.toFixed(1)} % de la pantalla)</figcaption></figure>
    ${
      k
        ? `<figure><img src="${k.file}" alt=""><figcaption>Re-flow + rejilla a 22vh (sólo arnés) · visor
      ${N(k.playArea)} px² (${k.playPct.toFixed(1)} % de la pantalla) · botonera ${N(d.h - k.availH)} px</figcaption></figure>`
        : ""
    }
  </div>
</section>`);
    }
  }
  const table = (stateId: string): string =>
    DEVICES.map((d) => {
      const c = byKey.get(`${d.id}|${stateId}|canonico`);
      const r = byKey.get(`${d.id}|${stateId}|reflow`);
      const k = byKey.get(`${d.id}|${stateId}|reflow-deck-corto`);
      const f = c && r && c.playArea > 0 ? r.playArea / c.playArea : 0;
      const fk = c && k && c.playArea > 0 ? k.playArea / c.playArea : 0;
      const auto = r ? portraitLayout(r.availW, r.availH, 1).kind : "?";
      return `<tr><td>${d.name}</td><td>${d.w}×${d.h}</td><td>${N(d.h - (r?.availH ?? 0))}</td>
        <td>${N(r?.availH ?? 0)}</td><td>${N(c?.playArea ?? 0)}</td><td>${N(r?.playArea ?? 0)}</td>
        <td class="${f >= 1 ? "win" : "lose"}">${f.toFixed(2)}×</td><td>${auto}</td>
        <td>${N(k?.playArea ?? 0)}</td><td class="${fk >= 1 ? "win" : "lose"}">${fk.toFixed(2)}×</td></tr>`;
    }).join("\n");
  const head =
    `<tr><th>dispositivo</th><th>CSS</th><th>botonera</th><th>hueco alto</th>` +
    `<th>canónico px²</th><th>re-flow px²</th><th>×</th><th>elige</th>` +
    `<th>re-flow deck-corto px²</th><th>×</th></tr>`;
  const tables = STATES.map(
    (s) => `<h3>${s.label}</h3><table>${head}${table(s.id)}</table>`,
  ).join("\n");
  return `<!doctype html><meta charset="utf-8"><title>Re-flow vertical — comparativa</title>
<style>
 :root{color-scheme:dark light}
 body{font:14px/1.5 system-ui,sans-serif;margin:0;padding:24px;background:#111;color:#eee}
 h1{font-size:22px}h2{margin-top:36px;border-bottom:1px solid #333;padding-bottom:6px}
 h3{font-size:15px;font-weight:600;display:flex;gap:12px;align-items:baseline;flex-wrap:wrap}
 .pair{display:flex;gap:16px;flex-wrap:wrap}
 figure{margin:0}
 img{max-height:70vh;border:1px solid #444;background:#000;display:block}
 figcaption{font-size:12px;color:#aaa;max-width:44ch;padding-top:4px}
 .f{font-weight:700;padding:2px 8px;border-radius:4px}
 .win{background:#14532d;color:#bbf7d0}.lose{background:#7f1d1d;color:#fecaca}
 .auto{font-size:12px;color:#9ca3af;font-weight:400}
 table{border-collapse:collapse;margin:16px 0}th,td{border:1px solid #444;padding:4px 10px;text-align:right}
 th:first-child,td:first-child{text-align:left}
 p.nota{max-width:80ch;color:#bbb}
</style>
<h1>Re-flow VERTICAL — canónico vs re-flow (medido en el navegador)</h1>
<p class="nota">Área = el <b>visor 11×11 real</b> en px² de pantalla (no el canvas: es lo que se
ve como área de juego). El re-flow de estas capturas va <b>FORZADO</b>
(<code>?reflow=force</code>) para poder compararlo también donde perdería; la columna «elige»
dice qué haría la bandera honesta <code>?reflow=1</code> en ese hueco. La botonera está montada
y contada en las dos variantes. La ventana lógica sigue siendo 11×11: se gana escala, no tiles.</p>
<p class="nota"><b>EL HALLAZGO DE LA MEDICIÓN:</b> la botonera NO mide 326 px como suponía el
modelo — en modo MUNDO la rejilla de ~20 comandos ocupa <b>510-545 px</b> (58-60 % de la
pantalla), y en COMBATE sólo ~320 px. El layout canónico es insensible a eso (es
<i>width-limited</i>: la botonera se come letterbox NEGRO, y su área de juego es idéntica en
mundo y en combate). El re-flow es <i>height-limited</i>: cada píxel de botonera sale del mapa.
De ahí que el mismo re-flow dé <b>×0,80-0,94 en mundo</b> y <b>×2,9-3,2 en combate</b>.</p>
${tables}
${rows.join("\n")}
`;
}

async function main(): Promise<void> {
  mkdirSync(OUT, { recursive: true });
  // `--html-only` re-genera el index desde `metricas.json` SIN gastar la ventana de
  // Playwright (el arnés es compartido con otros carriles: cero runs innecesarios).
  if (process.argv.includes("--html-only")) {
    const metrics = JSON.parse(readFileSync(join(OUT, "metricas.json"), "utf8")) as Metric[];
    writeFileSync(join(OUT, "index.html"), indexHtml(metrics));
    console.log(`index.html re-generado desde ${metrics.length} métricas en ${OUT}`);
    return;
  }
  const browser = await chromium.launch({ headless: HEADLESS });
  try {
    const metrics = await capture(browser);
    writeFileSync(join(OUT, "metricas.json"), JSON.stringify(metrics, null, 2));
    writeFileSync(join(OUT, "index.html"), indexHtml(metrics));
    console.log(`\n${metrics.length} capturas + index.html + metricas.json en ${OUT}`);
  } finally {
    await browser.close();
  }
}

void main();
