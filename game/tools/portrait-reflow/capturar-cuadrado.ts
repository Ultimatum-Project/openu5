/**
 * BANCO DE LA VARIANTE CUADRADO — captura comparativa REAL en navegador.
 *
 * Amplía el banco del carril (`capturar.ts`, variante «banda») con las tres piezas que
 * pidió el usuario y con la DESCOMPOSICIÓN que hace falta para no atribuir la mejora a
 * quien no es:
 *
 *   canonico          layout de siempre, botonera de siempre          (el patrón)
 *   canonico-ancho    layout de siempre + BOTONERA ANCHA              (¿cuánto es del deck?)
 *   reflow            variante «banda» forzada                        (lo que ya había)
 *   cuadrado-solo     variante cuadrado + botonera de siempre         (¿cuánto es del layout?)
 *   cuadrado-cruz     variante cuadrado + botonera ancha, cruz 3×3    ← LA PROPUESTA
 *   cuadrado-fila     variante cuadrado + botonera ancha, ◀▲▼▶       ← la agresiva
 *
 * Y en las DOS orientaciones: el encargo dice «en cualquier tamaño y orientación», y el
 * apaisado es justo donde la variante «banda» no tenía nada que enseñar.
 *
 *   U5_PORT=5297 OUT=<dir> npx tsx tools/portrait-reflow/capturar-cuadrado.ts [--headless]
 *   ... --html-only    re-genera el index desde metricas.json sin gastar Playwright
 *   ... --solo-vertical / --solo-apaisado    acota la pasada
 *
 * REGLAS DEL CARRIL: dev server PROPIO en un puerto 52xx (jamás el 5199 del usuario),
 * navegador VISIBLE por defecto, y el arnés no toca ningún fichero de la suite.
 */
import { chromium, type Browser, type Page } from "@playwright/test";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { ROOT_CLASS, wideDeckCss } from "../../src/skin/portrait/deck-ancho.js";

const PORT = process.env.U5_PORT ?? "5297";
const BASE = `http://localhost:${PORT}`;
const OUT = process.env.OUT ?? "/tmp/portrait-cuadrado";
const HEADLESS = process.argv.includes("--headless");

interface Device {
  id: string;
  name: string;
  w: number;
  h: number;
  dpr: number;
}

/** Los 5 teléfonos del comparador anterior (mismos: la comparación tiene que ser directa). */
const PHONES: Device[] = [
  { id: "iphone-se", name: "iPhone SE", w: 375, h: 667, dpr: 2 },
  { id: "galaxy-s8", name: "Galaxy S8", w: 360, h: 740, dpr: 3 },
  { id: "iphone-15", name: "iPhone 15", w: 393, h: 852, dpr: 3 },
  { id: "pixel-7", name: "Pixel 7", w: 412, h: 915, dpr: 2.625 },
  { id: "iphone-15-pro-max", name: "iPhone 15 Pro Max", w: 430, h: 932, dpr: 3 },
];

/** Subconjunto girado (el apaisado es caro y su veredicto es homogéneo entre teléfonos). */
const PHONES_LS: Device[] = ["galaxy-s8", "iphone-15", "iphone-15-pro-max"].map((id) => {
  const d = PHONES.find((p) => p.id === id)!;
  return { ...d, id: `${d.id}-ls`, name: `${d.name} (girado)`, w: d.h, h: d.w };
});

async function press(page: Page, key: string): Promise<void> {
  await page.keyboard.press(key);
  await page.waitForTimeout(120);
}

/** Los 4 estados del encargo. `drive` deja la pantalla en el estado a fotografiar. */
const STATES = [
  { id: "mundo", label: "Mundo (overworld, llanura)", drive: async (): Promise<void> => {} },
  {
    id: "log-largo",
    label: "Log largo (consola con historial)",
    drive: async (page: Page): Promise<void> => {
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
      await page.evaluate(() => {
        const t = (window as unknown as { __u5test?: { game?: unknown } }).__u5test;
        const g = t?.game as { overworldEnemies?: { enemies: unknown[] } } | undefined;
        g?.overworldEnemies?.enemies.push({ defIndex: 0, tile: 0x94, water: false, x: 61, y: 60 });
      });
      await press(page, "ArrowRight");
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

interface Variant {
  id: string;
  label: string;
  query: string;
  /** Sub-variante del deck ancho a inyectar DESDE EL ARNÉS (para el canónico, que no monta
   *  la piel del prototipo y por tanto no instala el CSS él solo). */
  injectDeck?: "cruz" | "fila";
}

/**
 * LAS 4 VARIANTES tras el refinamiento del 26-07. Se han retirado las tres que aislaban
 * variables de la iteración anterior (`canonico-ancho`, `cuadrado-solo`, `cuadrado-cruz-15`):
 * con el reparto invertido —el mapa se lleva el ancho y la botonera vive en lo que queda—
 * el área del mapa en VERTICAL ya no es una variable (es ancho × ancho en las dos
 * sub-variantes), así que aislarla no mide nada. Lo que ahora hay que comparar es
 * exactamente lo que preguntó el usuario: **cuánta botonera queda visible sin scroll**.
 */
const VARIANTS: Variant[] = [
  { id: "canonico", label: "Canónico (bandera OFF)", query: "" },
  { id: "reflow", label: "Re-flow «banda» (la variante del 25-07)", query: "&reflow=force" },
  {
    id: "cuadrado-bloques",
    label:
      "★ CUADRADO — 3 columnas (cursores · acciones · accesos directos) con teclado del " +
      "SISTEMA. El DEFECTO tras la corrección del usuario del 26-07",
    query: "&reflow=cuadrado-force&deck=bloques",
  },
  {
    id: "cuadrado-nativo",
    label: "CUADRADO — 3 barras apiladas con teclado del sistema (iteración anterior)",
    query: "&reflow=cuadrado-force&deck=nativo",
  },
  {
    id: "cuadrado-columnas",
    label: "CUADRADO — 4 columnas con teclados propios (la del veredicto)",
    query: "&reflow=cuadrado-force&deck=columnas",
  },
];

/**
 * En APAISADO el CSS del deck ancho no aplica (está scopeado a `data-orient="portrait"`:
 * la columna lateral tiene su propia geometría, medida y sellada por la auditoría móvil).
 * O sea que allí las 4 variantes «cuadrado» dan el MISMO píxel y `canonico-ancho` es
 * `canonico`. Fotografiar las 7 sería gastar la ventana en duplicados: se filtran a 3.
 */
const VARIANTS_LS = VARIANTS.filter((v) =>
  ["canonico", "reflow", "cuadrado-bloques"].includes(v.id),
);

interface Metric {
  device: string;
  deviceId: string;
  orient: "portrait" | "landscape";
  w: number;
  h: number;
  state: string;
  variant: string;
  kind: string;
  playRect: { left: number; top: number; width: number; height: number };
  playArea: number;
  playPct: number;
  /** ancho ÷ alto del visor en pantalla. 1,000 = cuadrado. */
  squareRatio: number;
  availW: number;
  availH: number;
  /** Alto (vertical) o ancho (apaisado) que se come la botonera, medido en la página. */
  deckPx: number;
  /**
   * LA MÉTRICA DEL REFINAMIENTO: de la zona de botones (`.touch-sheets` = cruceta +
   * rejilla de comandos), cuánto se ve SIN SCROLL y cuánto mide entera. El usuario pidió
   * exactamente esto para decidir el alto de las dos piezas.
   */
  sheetsVis: number;
  sheetsFull: number;
  /** Botones de comando ENTEROS visibles sin scroll (los medio-cortados no cuentan). */
  cmdsVis: number;
  cmdsTotal: number;
  file: string;
}

/**
 * Área del visor 11×11 MEDIDA EN LA PÁGINA. En las variantes del prototipo la da la sonda
 * de la piel; en canónico se deriva del rect CSS del canvas (176/320 × 176/200 de su
 * tamaño), que es exactamente la porción del 320×200 que ocupa el visor.
 */
async function measure(page: Page): Promise<Omit<Metric, keyof DeviceKeys>> {
  return page.evaluate(() => {
    const deckRect = document.querySelector(".touch-controls")?.getBoundingClientRect();
    const probe = (
      window as unknown as { __u5reflow?: { probe: () => Record<string, unknown> | null } }
    ).__u5reflow?.probe();
    const landscape = window.innerWidth > window.innerHeight;
    const deckPx = deckRect ? (landscape ? deckRect.width : deckRect.height) : 0;
    // LA MÉTRICA DEL REFINAMIENTO. `.touch-sheets` es la zona de botones (cruceta +
    // rejilla): lo VISIBLE es su rect y lo que hay en total, su scrollHeight. Y el conteo
    // de comandos ENTEROS a la vista se hace por rects: un botón medio cortado por el
    // borde inferior no es un botón usable, así que no cuenta.
    // OJO CON EL INSTRUMENTO: la sub-variante `columnas` disuelve `.touch-sheets` con
    // `display:contents` (es como sube las cuatro piezas a la rejilla del deck), así que ahí
    // ese nodo NO TIENE CAJA — medirlo daba 0/0 y «0 comandos visibles» EN FALSO. La zona de
    // botones se mide sobre el contenedor que de verdad scrollea en cada sub-variante:
    // `.touch-sheets` cuando existe como caja, y si no, la propia lista de comandos.
    const sheetsEl = document.querySelector(".touch-sheets");
    const sheetsBox = sheetsEl?.getBoundingClientRect();
    const gridEl = document.querySelector(".touch-commands");
    const gridBox = gridEl?.getBoundingClientRect();
    const zonaEl = sheetsBox && sheetsBox.height > 0 ? sheetsEl : gridEl;
    const zonaBox = zonaEl?.getBoundingClientRect();
    const sheetsVis = zonaBox?.height ?? 0;
    const sheetsFull = zonaEl?.scrollHeight ?? 0;
    // Y EL CONTEO va contra la INTERSECCIÓN de todo lo que recorta, porque quién recorta
    // cambia con la sub-variante: en `fila`/`cruz` es `.touch-sheets` (la rejilla lleva
    // `overflow:visible`, así que su propia caja contiene los 22 y contarlos contra ella
    // daba 22/22 EN FALSO); en `columnas` es la lista, que scrollea ella misma. Sumando
    // también el deck, el criterio vale para las tres sin caso especial.
    const cmds = [...document.querySelectorAll(".touch-cmd")];
    let top = -Infinity;
    let bot = Infinity;
    for (const r of [gridBox, sheetsBox && sheetsBox.height > 0 ? sheetsBox : null, deckRect]) {
      if (!r) continue;
      top = Math.max(top, r.top);
      bot = Math.min(bot, r.bottom);
    }
    const cmdsVis = Number.isFinite(top)
      ? cmds.filter((c) => {
          const b = c.getBoundingClientRect();
          return b.height > 0 && b.top >= top - 0.5 && b.bottom <= bot + 0.5;
        }).length
      : 0;
    if (probe) {
      const r = probe.playRect as { left: number; top: number; width: number; height: number };
      return {
        kind: `${probe.kind as string}/${probe.variant as string}/${probe.deck as string}`,
        playRect: r,
        playArea: probe.playArea as number,
        playPct: probe.playPct as number,
        squareRatio: probe.squareRatio as number,
        availW: probe.availW as number,
        availH: probe.availH as number,
        deckPx,
        sheetsVis,
        sheetsFull,
        cmdsVis,
        cmdsTotal: cmds.length,
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
        squareRatio: 0,
        availW: 0,
        availH: 0,
        deckPx,
        sheetsVis,
        sheetsFull,
        cmdsVis,
        cmdsTotal: cmds.length,
      };
    }
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
      squareRatio: rect.height > 0 ? rect.width / rect.height : 0,
      availW: container?.width ?? 0,
      availH: container?.height ?? 0,
      deckPx,
      sheetsVis,
      sheetsFull,
      cmdsVis,
      cmdsTotal: cmds.length,
    };
  });
}

/** Campos que pone el bucle, no la medición (para el tipo de `measure`). */
interface DeviceKeys {
  device: string;
  deviceId: string;
  orient: "portrait" | "landscape";
  w: number;
  h: number;
  state: string;
  variant: string;
  file: string;
}

async function capture(browser: Browser, devices: Device[]): Promise<Metric[]> {
  const metrics: Metric[] = [];
  for (const d of devices) {
    const orient: "portrait" | "landscape" = d.w > d.h ? "landscape" : "portrait";
    // Apaisado: 3 variantes (el resto son duplicados, ver `VARIANTS_LS`) y 2 estados —
    // en apaisado el deck NO cambia con el estado (columna lateral de alto fijo), así que
    // «log largo» y «ztats» darían la misma geometría que «mundo».
    const variants = orient === "landscape" ? VARIANTS_LS : VARIANTS;
    const states = orient === "landscape" ? STATES.filter((s) => s.id !== "ztats") : STATES;
    for (const v of variants) {
      for (const s of states) {
        const ctx = await browser.newContext({
          viewport: { width: d.w, height: d.h },
          deviceScaleFactor: d.dpr,
          isMobile: true,
          hasTouch: true,
        });
        const page = await ctx.newPage();
        await page.addInitScript(() => localStorage.clear());
        if (v.injectDeck) {
          // MISMA cadena de CSS que instala la piel (importada, no copiada: no puede
          // derivar). Se inyecta en DOMContentLoaded para ganar la cascada al `<style>`
          // inline de index.html, y la clase/dataset van a mano porque aquí no hay piel
          // del prototipo montada que las ponga.
          await page.addInitScript(
            ([cssText, cls, mode]: [string, string, string]) => {
              document.addEventListener("DOMContentLoaded", () => {
                const st = document.createElement("style");
                st.textContent = cssText;
                document.head.appendChild(st);
                document.documentElement.classList.add(cls);
                document.documentElement.dataset.deckAncho = mode;
              });
            },
            [wideDeckCss(), ROOT_CLASS, v.injectDeck] as [string, string, string],
          );
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
          orient,
          w: d.w,
          h: d.h,
          state: s.id,
          variant: v.id,
          file,
          ...m,
        });
        process.stdout.write(
          `· ${d.id} ${s.id} ${v.id}: ${m.kind} ${Math.round(m.playArea).toLocaleString("es")} px² ` +
            `(${m.playPct.toFixed(1)} %) ratio ${m.squareRatio.toFixed(3)} deck ${Math.round(m.deckPx)}\n`,
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
  const devices: Device[] = [];
  for (const m of metrics) {
    if (!devices.some((d) => d.id === m.deviceId)) {
      devices.push({ id: m.deviceId, name: m.device, w: m.w, h: m.h, dpr: 0 });
    }
  }
  const states = STATES.filter((s) => metrics.some((m) => m.state === s.id));

  const cell = (m: Metric | undefined, base: Metric | undefined): string => {
    if (!m) return "<td colspan=6>—</td>";
    const f = base && base.playArea > 0 ? m.playArea / base.playArea : 0;
    const sq = Math.abs(m.squareRatio - 1) < 0.005;
    // «Botonera visible sin scroll»: la zona de botones que se ve, y cuántos comandos
    // ENTEROS caben ahí. Rojo cuando no cabe ni un comando entero (el caso que el usuario
    // tiene que ver para decidir).
    const cls = m.cmdsVis === 0 ? "lose" : m.cmdsVis >= m.cmdsTotal ? "win" : "";
    return (
      `<td>${N(m.playArea)}</td><td>${m.playPct.toFixed(1)} %</td>` +
      `<td class="${f >= 1 ? "win" : "lose"}">${f.toFixed(2)}×</td>` +
      `<td class="${sq ? "sq" : "nosq"}">${m.squareRatio.toFixed(3)}</td>` +
      `<td>${N(m.sheetsVis)}/${N(m.sheetsFull)}</td>` +
      `<td class="${cls}">${m.cmdsVis}/${m.cmdsTotal}</td>`
    );
  };

  const tablesFor = (orient: "portrait" | "landscape"): string => {
    const devs = devices.filter((d) => metrics.some((m) => m.deviceId === d.id && m.orient === orient));
    if (!devs.length) return "";
    const vars = VARIANTS.filter((v) =>
      metrics.some((m) => m.orient === orient && m.variant === v.id),
    );
    const sts = states.filter((s) => metrics.some((m) => m.orient === orient && m.state === s.id));
    const head =
      `<tr><th rowspan=2>dispositivo</th><th rowspan=2>CSS</th><th rowspan=2>botonera</th>` +
      vars.map((v) => `<th colspan=6>${v.id}</th>`).join("") +
      `</tr><tr>` +
      vars
        .map(
          () =>
            `<th>visor px²</th><th>%</th><th>×</th><th>cuad.</th>` +
            `<th title="alto visible de la zona de botones / alto total">botonera vis/total</th>` +
            `<th title="comandos ENTEROS visibles sin scroll">cmds</th>`,
        )
        .join("") +
      `</tr>`;
    const body = sts
      .map((s) => {
        const rows = devs
          .map((d) => {
            const base = byKey.get(`${d.id}|${s.id}|canonico`);
            const cells = vars.map((v) => cell(byKey.get(`${d.id}|${s.id}|${v.id}`), base)).join("");
            const deckOf = (id: string): number => byKey.get(`${d.id}|${s.id}|${id}`)?.deckPx ?? 0;
            return `<tr><td>${d.name}</td><td>${d.w}×${d.h}</td>
              <td>${N(deckOf("canonico"))}→${N(deckOf("cuadrado-fila") || deckOf("cuadrado-cruz"))}</td>${cells}</tr>`;
          })
          .join("\n");
        return `<h3>${s.label}</h3><div class="tw"><table>${head}${rows}</table></div>`;
      })
      .join("\n");
    return `<h2>Tabla — ${orient === "portrait" ? "VERTICAL" : "APAISADO"}</h2>${body}`;
  };
  const tables = tablesFor("portrait") + tablesFor("landscape");

  const figs = devices
    .map((d) => {
      const secs = states
        .map((s) => {
          const shots = VARIANTS.map((v) => {
            const m = byKey.get(`${d.id}|${s.id}|${v.id}`);
            if (!m) return "";
            const base = byKey.get(`${d.id}|${s.id}|canonico`);
            const f = base && base.playArea > 0 ? m.playArea / base.playArea : 0;
            return `<figure><img src="${m.file}" alt=""><figcaption><b>${v.id}</b><br>
              ${N(m.playArea)} px² (${m.playPct.toFixed(1)} %) · <span class="${f >= 1 ? "win" : "lose"}">${f.toFixed(2)}×</span><br>
              visor ${N(m.playRect.width)}×${N(m.playRect.height)} · cuadratura ${m.squareRatio.toFixed(3)}<br>
              botonera ${N(m.deckPx)} px · hueco ${N(m.availW)}×${N(m.availH)}</figcaption></figure>`;
          }).join("");
          return `<section><h3>${s.label}</h3><div class="pair">${shots}</div></section>`;
        })
        .join("\n");
      return `<h2>${d.name} — ${d.w}×${d.h}</h2>${secs}`;
    })
    .join("\n");

  return `<!doctype html><meta charset="utf-8"><title>Re-flow CUADRADO — comparativa</title>
<style>
 :root{color-scheme:dark light}
 body{font:14px/1.5 system-ui,sans-serif;margin:0;padding:24px;background:#111;color:#eee}
 h1{font-size:22px}h2{margin-top:40px;border-bottom:1px solid #333;padding-bottom:6px}
 h3{font-size:15px;font-weight:600}
 .pair{display:flex;gap:14px;flex-wrap:wrap;align-items:flex-start}
 figure{margin:0;max-width:300px}
 img{max-height:62vh;max-width:100%;border:1px solid #444;background:#000;display:block}
 figcaption{font-size:11px;color:#aaa;padding-top:4px}
 .win{background:#14532d;color:#bbf7d0;padding:1px 5px;border-radius:3px}
 .lose{background:#7f1d1d;color:#fecaca;padding:1px 5px;border-radius:3px}
 .sq{color:#bbf7d0}.nosq{color:#fecaca;font-weight:700}
 .tw{overflow-x:auto}
 table{border-collapse:collapse;margin:12px 0;font-size:12px}
 th,td{border:1px solid #444;padding:3px 7px;text-align:right;white-space:nowrap}
 th:first-child,td:first-child{text-align:left}
 p.nota{max-width:88ch;color:#bbb}
 code{background:#222;padding:1px 4px;border-radius:3px}
</style>
<h1>Re-flow <b>CUADRADO</b> — mapa 1:1 + botonera a ancho completo</h1>
<p class="nota">Petición del usuario: «Re-flow + botonera a ancho completo real. En general
quiero que siempre el view del mapa sea cuadrado como en original.» Área = el <b>visor 11×11
real</b> en px² de pantalla, medido EN LA PÁGINA. La columna <b>cuad.</b> es ancho÷alto del
visor: <b>1,000 = cuadrado</b> (el invariante de la variante). Las variantes del prototipo van
<b>FORZADAS</b> (<code>-force</code>) para poder compararlas también donde perderían. La ventana
lógica sigue siendo 11×11 en todas: se gana escala, jamás tiles.</p>
<p class="nota"><b>Cómo leer la descomposición:</b> <code>canonico-ancho</code> = sólo la
botonera · <code>cuadrado-solo</code> = sólo el layout · <code>cuadrado-cruz</code> y
<code>cuadrado-fila</code> = las dos cosas. Si la mejora estuviera casi toda en una columna,
la otra pieza no se estaría ganando el sitio.</p>
${tables}
${figs}
`;
}

async function main(): Promise<void> {
  mkdirSync(OUT, { recursive: true });
  if (process.argv.includes("--html-only")) {
    const metrics = JSON.parse(readFileSync(join(OUT, "metricas.json"), "utf8")) as Metric[];
    writeFileSync(join(OUT, "index.html"), indexHtml(metrics));
    console.log(`index.html re-generado desde ${metrics.length} métricas en ${OUT}`);
    return;
  }
  let devices = [
    ...(process.argv.includes("--solo-apaisado") ? [] : PHONES),
    ...(process.argv.includes("--solo-vertical") ? [] : PHONES_LS),
  ];
  // `U5_DEVICES=iphone-15,pixel-7-ls` acota la pasada a un puñado (humo del arnés sin
  // gastar los ~9 min de la tanda entera).
  const only = process.env.U5_DEVICES?.split(",").map((s) => s.trim()).filter(Boolean);
  if (only?.length) devices = devices.filter((d) => only.includes(d.id));
  const browser = await chromium.launch({ headless: HEADLESS });
  try {
    const metrics = await capture(browser, devices);
    writeFileSync(join(OUT, "metricas.json"), JSON.stringify(metrics, null, 2));
    writeFileSync(join(OUT, "index.html"), indexHtml(metrics));
    console.log(`\n${metrics.length} capturas + index.html + metricas.json en ${OUT}`);
  } finally {
    await browser.close();
  }
}

void main();
