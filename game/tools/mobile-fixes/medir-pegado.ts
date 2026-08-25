/**
 * SONDA DEL BUG 2 — «el juego no sale pegado al lado» (carril `bug2-app`).
 *
 * QUÉ MIDE, y por qué no vale la sonda hermana. `medir-railes.ts` (carril `landscape-homog`)
 * ya publica `negroIzq/negroDer/negroAbajo`, y de ahí salen los 18,2 px del acta. Lo que NO
 * puede decir es QUIÉN reparte ese sobrante, que es justo lo que hay que saber para
 * arreglarlo y —sobre todo— para probar que el arreglo NO toca el vertical:
 *   · el CONTENEDOR VISIBLE de la piel y su `justify-content`/`align-items` RESUELTOS;
 *   · el reparto de `#app` (padding + `justify-content`), para poder demostrar que ahí no
 *     hay hueco libre que repartir;
 *   · el rect del canvas en VERTICAL, que es el control de no-regresión.
 *
 * 🔴 EL HALLAZGO QUE OBLIGA A ESTA SONDA. El informe (`docs/mobile/BUGS-MOVIL-2026-08-01.md`,
 * bug 2) sitúa la causa en `game/index.html:47-49` — el `justify-content:center` de `#app`.
 * MEDIDO: cambiar ese valor es INERTE. El contenedor de la piel (`.portrait-skin`,
 * `.faithful-skin` o `.shader-skin`, según layout y piel) se declara `width:100%;height:100%`,
 * así que llena la caja de contenido de `#app` y no deja sobrante que `#app` pueda repartir.
 * Quien centra es el `justify-content:center` INLINE de ese contenedor. Esta sonda imprime
 * las dos capas juntas para que la adjudicación no dependa de leer CSS.
 *
 * EL CONTENEDOR VISIBLE se identifica como HIJO DIRECTO de `#app` con tamaño no nulo. No es
 * cosmética: la piel alojada vive DENTRO de `.portrait-skin-src` (host de 0×0, `opacity:0`)
 * con su canvas a resolución nativa aparcado en (−160,−100), y el acta de `landscape-homog`
 * §8 documenta que elegirlo «por área» daba un hueco negro de −312 px en el SE rotado. El
 * combinador de hijo directo lo excluye por construcción.
 *
 * LA FRANJA de la muesca se inyecta por `--u5-safe-l/r` (`index.html`, `:root`) igual que en
 * la sonda hermana: Chromium da `env(safe-area-inset-*)` siempre 0.
 *
 * USO (dev server PROPIO en un 52xx — jamás el 5199 del usuario):
 *   U5_PORT=5236 npx tsx tools/mobile-fixes/medir-pegado.ts
 *   ... OUT=/ruta/pegado.json --shots=/ruta/dir
 */
import { chromium, type Browser, type Page } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const PORT = process.env.U5_PORT ?? "5236";
const BASE = `http://localhost:${PORT}`;
const OUT = process.env.OUT ?? "";
const SHOTS = process.argv.find((a) => a.startsWith("--shots="))?.slice("--shots=".length) ?? "";

interface Escena {
  id: string;
  label: string;
  w: number;
  h: number;
  safeL: number;
  safeR: number;
  padSide: "left" | "right";
  /** `cuadrado` = layout partido (piel `portrait`); `off` = layout clásico (piel fiel directa). */
  reflow: "cuadrado" | "off";
  /**
   * Preferencia `u5.layoutPartido` (el botón ▤). `undefined` = sin tocar, manda la bandera.
   * Puesta a `false` CON `reflow=cuadrado` reproduce el estado que ninguna bandera sola
   * alcanza y que sí alcanza el jugador con un toque: la piel de botones INSTALADA (o sea,
   * el CSS de los dos raíles vivo) y el layout CLÁSICO montado, con lo cual el contenedor
   * visible pasa a ser `.faithful-skin`. Una regla que nombrara sólo `.portrait-skin`
   * quedaría muda justo ahí.
   */
  layoutPartido?: boolean;
}

/**
 * LAS ESCENAS. Las cuatro primeras son las del apaisado (la de 852×330 franja 0 es LA del
 * informe: 18,2 px por lado). Las dos de VERTICAL son el CONTROL de no-regresión que exige
 * el encargo — el contenedor de la piel es el MISMO objeto en las dos orientaciones, así que
 * «mi regla no toca el vertical» no se argumenta, se mide. `ls-852x330-clasico` cubre el
 * segundo contenedor visible (`.faithful-skin` sin envoltorio partido): si la regla nombrara
 * sólo `.portrait-skin`, esta escena seguiría con el hueco.
 */
const ESCENAS: Escena[] = [
  { id: "ls-852x330-safe0", label: "852×330 iPhone 15 con barra · franja 0 (LA DEL INFORME)", w: 852, h: 330, safeL: 0, safeR: 0, padSide: "left", reflow: "cuadrado" },
  { id: "ls-852x330-safe59", label: "852×330 · franja 59 (14/15 Pro)", w: 852, h: 330, safeL: 59, safeR: 0, padSide: "left", reflow: "cuadrado" },
  { id: "ls-852x330-safe0-right", label: "852×330 · franja 0 · ⇄ (raíl A a la DERECHA)", w: 852, h: 330, safeL: 0, safeR: 0, padSide: "right", reflow: "cuadrado" },
  { id: "ls-852x330-safe59-right", label: "852×330 · franja 59 DERECHA · ⇄", w: 852, h: 330, safeL: 0, safeR: 59, padSide: "right", reflow: "cuadrado" },
  { id: "ls-852x393-safe0", label: "852×393 iPhone 15 sin barra · franja 0 (ya pegado en main)", w: 852, h: 393, safeL: 0, safeR: 0, padSide: "left", reflow: "cuadrado" },
  { id: "ls-915x412-safe0", label: "915×412 Pixel 7 apaisado · franja 0", w: 915, h: 412, safeL: 0, safeR: 0, padSide: "left", reflow: "cuadrado" },
  { id: "ls-568x320-safe0", label: "568×320 iPhone SE rotado · franja 0 (el sobrante VERTICAL)", w: 568, h: 320, safeL: 0, safeR: 0, padSide: "left", reflow: "cuadrado" },
  { id: "ls-852x330-clasico", label: "852×330 · franja 0 · layout CLÁSICO sin piel de botones (deck de una columna)", w: 852, h: 330, safeL: 0, safeR: 0, padSide: "left", reflow: "off" },
  { id: "ls-852x330-railes-fiel", label: "852×330 · franja 0 · RAÍLES + layout clásico (.faithful-skin visible)", w: 852, h: 330, safeL: 0, safeR: 0, padSide: "left", reflow: "cuadrado", layoutPartido: false },
  { id: "pt-393x852-safe0", label: "CONTROL VERTICAL · 393×852 iPhone 15", w: 393, h: 852, safeL: 0, safeR: 0, padSide: "left", reflow: "cuadrado" },
  { id: "pt-320x568-safe0", label: "CONTROL VERTICAL · 320×568 iPhone SE", w: 320, h: 568, safeL: 0, safeR: 0, padSide: "left", reflow: "cuadrado" },
];

interface Medida {
  id: string;
  label: string;
  w: number;
  h: number;
  orient: string;
  padSide: string;
  /**
   * ¿Está puesta la piel de botones (`u5-btn-ui`)? Es el prefijo de TODO el CSS apaisado,
   * regla nueva incluida: sin ella la escena está fuera de su alcance, y decirlo evita leer
   * un «no cambió nada» como un fix inerte.
   */
  btnUi: boolean;
  /** Contenedor VISIBLE de la piel: hijo directo de `#app` con tamaño no nulo. */
  piel: { clase: string; x: number; y: number; w: number; h: number; jc: string; ai: string } | null;
  /** La capa que el informe acusó. `libre` = sobrante que `#app` PUEDE repartir. */
  app: { padL: number; padR: number; contenidoW: number; jc: string; ai: string; libre: number };
  canvas: { x: number; y: number; w: number; h: number };
  /** Columnas de la rejilla del deck (0 en vertical: no hay raíles). */
  railIzq: number;
  railDer: number;
  /** Hueco negro entre el borde INTERIOR de cada raíl y el canvas. LA CIFRA DEL BUG. */
  negroIzq: number;
  negroDer: number;
  negroArriba: number;
  negroAbajo: number;
  /** ¿De qué lado está el raíl A (el del pad)? Es al que debe quedar pegado el juego. */
  ladoRailA: "izq" | "der" | "n/a";
}

async function medir(page: Page, e: Escena): Promise<Medida> {
  return page.evaluate((esc: Escena): Medida => {
    const r1 = (n: number): number => Math.round(n * 10) / 10;
    const root = document.documentElement;
    const px = (s: string): number => parseFloat(s) || 0;
    const app = document.querySelector<HTMLElement>("#app");
    const appCs = app ? getComputedStyle(app) : null;
    const appB = app?.getBoundingClientRect();

    // EL CONTENEDOR VISIBLE. Hijo DIRECTO de `#app` (excluye la piel alojada, que cuelga de
    // `.portrait-skin-src`) y con tamaño no nulo (excluye el propio host, de 0×0).
    let piel: HTMLElement | null = null;
    for (const el of Array.from(app?.children ?? [])) {
      const h = el as HTMLElement;
      if (!/(^|\s)(portrait|faithful|shader)-skin(\s|$)/.test(h.className)) continue;
      const b = h.getBoundingClientRect();
      if (b.width < 1 || b.height < 1) continue;
      piel = h;
      break;
    }
    const pielCs = piel ? getComputedStyle(piel) : null;
    const pielB = piel?.getBoundingClientRect();

    const cv = piel?.querySelector<HTMLElement>("canvas") ?? null;
    const cb = cv?.getBoundingClientRect() ?? null;

    const deck = document.querySelector<HTMLElement>(".touch-controls");
    const enApaisado = (root.dataset.orient ?? "") === "landscape";
    const cols =
      deck && enApaisado
        ? getComputedStyle(deck)
            .gridTemplateColumns.split(/\s+/)
            .map((s) => px(s))
        : [];
    const railIzq = r1(cols[0] ?? 0);
    const railDer = r1(cols[2] ?? 0);

    const contenidoW = appB ? appB.width - px(appCs?.paddingLeft ?? "0") - px(appCs?.paddingRight ?? "0") : 0;

    return {
      id: esc.id,
      label: esc.label,
      w: window.innerWidth,
      h: window.innerHeight,
      orient: root.dataset.orient ?? "?",
      padSide: root.dataset.padSide ?? "left",
      btnUi: root.classList.contains("u5-btn-ui"),
      piel: piel && pielB
        ? {
            clase: piel.className.split(/\s+/)[0] ?? "?",
            x: r1(pielB.x), y: r1(pielB.y), w: r1(pielB.width), h: r1(pielB.height),
            jc: pielCs?.justifyContent ?? "?", ai: pielCs?.alignItems ?? "?",
          }
        : null,
      app: {
        padL: r1(px(appCs?.paddingLeft ?? "0")),
        padR: r1(px(appCs?.paddingRight ?? "0")),
        contenidoW: r1(contenidoW),
        jc: appCs?.justifyContent ?? "?",
        ai: appCs?.alignItems ?? "?",
        // Sobrante que `#app` puede repartir: si es 0, su `justify-content` es INERTE.
        libre: r1(contenidoW - (pielB?.width ?? contenidoW)),
      },
      canvas: cb ? { x: r1(cb.x), y: r1(cb.y), w: r1(cb.width), h: r1(cb.height) } : { x: 0, y: 0, w: 0, h: 0 },
      railIzq,
      railDer,
      // En vertical no hay raíles: el hueco se mide contra el borde de la pantalla, que es
      // lo que `railIzq/Der = 0` deja hacer sin un caso especial.
      negroIzq: cb ? r1(cb.x - railIzq) : 0,
      negroDer: cb ? r1(window.innerWidth - railDer - cb.right) : 0,
      negroArriba: cb ? r1(cb.y - (appB?.y ?? 0)) : 0,
      negroAbajo: cb ? r1(window.innerHeight - cb.bottom) : 0,
      ladoRailA: !enApaisado ? "n/a" : (root.dataset.padSide === "right" ? "der" : "izq"),
    };
  }, e);
}

async function unaEscena(browser: Browser, e: Escena): Promise<Medida> {
  const ctx = await browser.newContext({
    viewport: { width: e.w, height: e.h },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
  });
  const page = await ctx.newPage();
  await page.addInitScript(
    ([side, layout]: [string, string]) => {
      localStorage.clear();
      localStorage.setItem("u5.padSide", side);
      if (layout !== "") localStorage.setItem("u5.layoutPartido", layout);
      // `tsx`/esbuild envuelve las funciones con nombre en `__name(...)` y el cuerpo de
      // `evaluate` viaja YA COMPILADO: en la página `__name` no existe (misma nota que
      // `medir.ts` y `medir-railes.ts`).
      (globalThis as unknown as { __name?: unknown }).__name ??= <T,>(f: T): T => f;
    },
    [e.padSide, e.layoutPartido === undefined ? "" : e.layoutPartido ? "1" : "0"] as [string, string],
  );
  await page.goto(
    `${BASE}/?skin=faithful&nointro&reflow=${e.reflow}&loc=0&x=60&y=60&hour=10&seed=7&lang=es`,
  );
  await page.waitForFunction(
    () =>
      (window as unknown as { __u5test?: { worldReady?: () => boolean } }).__u5test?.worldReady?.() === true,
    undefined,
    { timeout: 25_000 },
  );
  await page.waitForSelector(".touch-controls", { timeout: 5_000 });

  if (e.safeL > 0 || e.safeR > 0) {
    const conVars = await page.evaluate(
      () => getComputedStyle(document.documentElement).getPropertyValue("--u5-safe-l").trim() !== "",
    );
    if (!conVars) throw new Error("`--u5-safe-l` no existe: sin ella la franja es INMEDIBLE");
    await page.evaluate(
      ([l, r]: [number, number]) => {
        document.documentElement.style.setProperty("--u5-safe-l", `${l}px`);
        document.documentElement.style.setProperty("--u5-safe-r", `${r}px`);
      },
      [e.safeL, e.safeR] as [number, number],
    );
  }
  await page.evaluate(() => window.dispatchEvent(new Event("resize")));
  await page.waitForTimeout(700);

  const m = await medir(page, e);

  if (SHOTS) {
    mkdirSync(SHOTS, { recursive: true });
    // El canvas se RE-CREA al re-escalar y queda negro hasta el fotograma siguiente: una
    // captura inmediata parece una regresión que no es (misma espera que `medir-railes.ts`).
    await page
      .waitForFunction(
        () => {
          const app = document.querySelector("#app");
          let vis: HTMLCanvasElement | null = null;
          for (const el of Array.from(app?.children ?? [])) {
            const h = el as HTMLElement;
            if (!/(^|\s)(portrait|faithful|shader)-skin(\s|$)/.test(h.className)) continue;
            const b = h.getBoundingClientRect();
            if (b.width < 1 || b.height < 1) continue;
            vis = h.querySelector("canvas");
            break;
          }
          if (!vis) return false;
          const c2 = vis.getContext("2d");
          if (!c2) return false;
          const d = c2.getImageData(0, 0, Math.min(64, vis.width), Math.min(64, vis.height)).data;
          for (let i = 0; i < d.length; i += 4) {
            if (d[i]! > 8 || d[i + 1]! > 8 || d[i + 2]! > 8) return true;
          }
          return false;
        },
        undefined,
        { timeout: 8_000 },
      )
      .catch(() => process.stdout.write(`  ⚠ ${e.id}: el canvas seguía en negro al capturar\n`));
    await page.screenshot({ path: join(SHOTS, `${e.id}.png`) });
  }
  await ctx.close();
  return m;
}

const N = (x: number): string => x.toLocaleString("es", { maximumFractionDigits: 1 });

async function main(): Promise<void> {
  const browser = await chromium.launch({ headless: true });
  const out: Medida[] = [];
  for (const e of ESCENAS) {
    const m = await unaEscena(browser, e);
    out.push(m);
    process.stdout.write(
      `· ${m.label}\n` +
        `    orient ${m.orient} · u5-btn-ui ${m.btnUi ? "SÍ" : "NO"} · raíl A a la ${m.ladoRailA} · piel ${m.piel?.clase ?? "NINGUNA"} ` +
        `jc=${m.piel?.jc ?? "?"} ai=${m.piel?.ai ?? "?"}\n` +
        `    #app pad ${N(m.app.padL)}/${N(m.app.padR)} · contenido ${N(m.app.contenidoW)} · jc=${m.app.jc} · LIBRE ${N(m.app.libre)}\n` +
        `    canvas x ${N(m.canvas.x)} y ${N(m.canvas.y)} w ${N(m.canvas.w)} h ${N(m.canvas.h)}\n` +
        `    NEGRO izq ${N(m.negroIzq)} der ${N(m.negroDer)} arriba ${N(m.negroArriba)} abajo ${N(m.negroAbajo)}\n`,
    );
  }
  await browser.close();
  if (OUT) {
    writeFileSync(OUT, JSON.stringify({ base: BASE, fecha: new Date().toISOString(), medidas: out }, null, 2));
    process.stdout.write(`\nJSON → ${OUT}\n`);
  }
}

void main();
