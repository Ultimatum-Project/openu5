/**
 * SONDA DE GEOMETRÍA MÓVIL — las cifras del carril `fix/mobile-fixes-0108`, medidas en
 * navegador sobre EL CÓDIGO DE `main`, no heredadas del informe.
 *
 * POR QUÉ EXISTE. `docs/mobile/BUGS-MOVIL-2026-08-01.md` midió sobre la rama
 * `skin/mobile-preview`, que lleva un apaisado (dos raíles de 152/104 px) que NO está en
 * `main`: `git grep -c u5rail-a main` da CERO. Las cifras del informe (celda de 8 px,
 * hueco lateral de 18,2 px) por tanto NO son las de esta base. Antes de arreglar nada hay
 * que saber qué mide el código que de verdad se sirve — y después, qué mide con el
 * arreglo puesto. Esta sonda da las dos columnas.
 *
 * LA FRANJA DE LA MUESCA. Chromium NO publica `env(safe-area-inset-*)`: los da siempre 0,
 * y por eso el defecto del apaisado no se vio nunca en el arnés. Aquí se INYECTA, y el
 * método importa:
 *   · ANTES del arreglo, el inset entra por una regla-RÉPLICA con el valor literal (la
 *     misma técnica del informe, y la misma trampa: una réplica puede DERIVAR de la regla
 *     real sin que nadie lo note).
 *   · DESPUÉS del arreglo ya no hace falta réplica: el fix expone la franja en dos
 *     custom properties (`--u5-safe-l` / `--u5-safe-r`, con `env()` por defecto), así que
 *     la sonda las sobreescribe y quien recalcula es LA CASCADA REAL, con las reglas de
 *     verdad. Ese es el motivo de que el fix pase por variables y no por más `calc(env())`
 *     repartidos: convierte un defecto INOBSERVABLE en el arnés en uno medible.
 *
 * USO (dev server PROPIO en un 52xx — jamás el 5199 del usuario):
 *   U5_PORT=5231 npx tsx tools/mobile-fixes/medir.ts            → tabla a stdout
 *   ... OUT=/ruta/medidas.json                                  → además, JSON
 *   ... --shots=/ruta/dir                                       → capturas A1/B1/E2
 */
import { chromium, type Browser, type Page } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const PORT = process.env.U5_PORT ?? "5231";
const BASE = `http://localhost:${PORT}`;
const OUT = process.env.OUT ?? "";
const SHOTS = process.argv.find((a) => a.startsWith("--shots="))?.slice("--shots=".length) ?? "";

interface Escena {
  id: string;
  /** Etiqueta legible (la que sale en la tabla). */
  label: string;
  w: number;
  h: number;
  /** Franja de seguridad izquierda/derecha a simular (px). */
  safeL: number;
  safeR: number;
  /** Lado del deck. `left` es el defecto de `loadPadSide()`. */
  padSide: "left" | "right";
}

/**
 * Las escenas del informe, con los MISMOS viewports, más los controles.
 * `852×393` = iPhone 15 apaisado sin barra · `852×330` = con barra (el caso normal) ·
 * `915×360` = Pixel 7 apaisado con barra · `568×320` = iPhone SE rotado.
 * Verticales: 393 (iPhone 15), 412 (Pixel 7), 320 (SE) — los tres del bug 5.
 */
const ESCENAS: Escena[] = [
  // ── Apaisado: control (franja 0 = lo que ve el emulador y Android) y muesca.
  { id: "ls-852x330-safe0", label: "852×330 iPhone 15 · franja 0 (CONTROL)", w: 852, h: 330, safeL: 0, safeR: 0, padSide: "left" },
  { id: "ls-852x330-safe44", label: "852×330 iPhone 15 · franja 44 (X/11/12/13)", w: 852, h: 330, safeL: 44, safeR: 0, padSide: "left" },
  { id: "ls-852x330-safe59", label: "852×330 iPhone 15 · franja 59 (14/15 Pro)", w: 852, h: 330, safeL: 59, safeR: 0, padSide: "left" },
  { id: "ls-852x330-safe59-right", label: "852×330 · franja 59 · deck a la DERECHA (⇄)", w: 852, h: 330, safeL: 0, safeR: 59, padSide: "right" },
  { id: "ls-852x393-safe0", label: "852×393 iPhone 15 sin barra · franja 0", w: 852, h: 393, safeL: 0, safeR: 0, padSide: "left" },
  { id: "ls-852x393-safe59", label: "852×393 iPhone 15 sin barra · franja 59", w: 852, h: 393, safeL: 59, safeR: 0, padSide: "left" },
  { id: "ls-915x360-safe0", label: "915×360 Pixel 7 · franja 0", w: 915, h: 360, safeL: 0, safeR: 0, padSide: "left" },
  { id: "ls-568x320-safe0", label: "568×320 iPhone SE rotado · franja 0 (CONTROL)", w: 568, h: 320, safeL: 0, safeR: 0, padSide: "left" },
  { id: "ls-568x320-safe59", label: "568×320 iPhone SE rotado · franja 59 (EL PEOR)", w: 568, h: 320, safeL: 59, safeR: 0, padSide: "left" },
  // ── Vertical: el umbral de las dos columnas (bug 5) y el ⛶ (bug 3a).
  { id: "pt-393x852", label: "393×852 iPhone 15 vertical", w: 393, h: 852, safeL: 0, safeR: 0, padSide: "left" },
  { id: "pt-412x915", label: "412×915 Pixel 7 vertical", w: 412, h: 915, safeL: 0, safeR: 0, padSide: "left" },
  { id: "pt-320x568", label: "320×568 iPhone SE vertical", w: 320, h: 568, safeL: 0, safeR: 0, padSide: "left" },
  { id: "pt-430x932", label: "430×932 iPhone 15 Pro Max vertical", w: 430, h: 932, safeL: 0, safeR: 0, padSide: "left" },
  { id: "pt-360x740", label: "360×740 Galaxy S8 vertical", w: 360, h: 740, safeL: 0, safeR: 0, padSide: "left" },
  // El ancho al que DOS columnas dejan de recortar: la rejilla necesita 110 px por celda
  // (el rótulo más ancho del corpus ES, medido abajo en `cmdNecesita`), o sea 226 px de
  // envoltorio con el gap de 6 — territorio de tableta, no de teléfono.
  { id: "pt-500x900", label: "500×900 (tableta pequeña)", w: 500, h: 900, safeL: 0, safeR: 0, padSide: "left" },
  { id: "pt-560x960", label: "560×960 (tableta)", w: 560, h: 960, safeL: 0, safeR: 0, padSide: "left" },
];

export interface Medida {
  id: string;
  label: string;
  w: number;
  h: number;
  orient: string;
  /** ¿Las custom properties del fix existen? Distingue base de arreglo SIN mirar el git. */
  varsDelFix: boolean;
  deck: { w: number; h: number; x: number; clientW: number; padL: number; padR: number };
  /** Ancho ÚTIL del deck = clientWidth − padding. Es lo que se reparten cruceta y rejilla. */
  utilDeck: number;
  /** Ancho del envoltorio de la rejilla de comandos (`.touch-cmdwrap`). */
  wrapCmd: number;
  dpadCelda: number;
  cmdCelda: number;
  cmdCols: number;
  cmdRecortados: number;
  cmdTotal: number;
  /** Ancho que pediría el rótulo MÁS ancho para no recortarse (scrollWidth + padding). */
  cmdNecesita: number;
  canvas: { x: number; y: number; w: number; h: number };
  /** Hueco NEGRO entre el borde interior del deck y el canvas (apaisado). */
  huecoDeck: number;
  /** Hueco negro por el lado opuesto al deck. */
  huecoLibre: number;
  /** Banda negra bajo el canvas (en vertical incluye la reserva del deck). */
  huecoAbajo: number;
  /**
   * El ⛶ (bugs 3a y el cableado de la decisión (b)): dónde vive DE VERDAD, su caja, el
   * cuerpo del glifo, y si hay que SCROLLEAR su columna para alcanzarlo (que es la queja
   * original del usuario: «no lo encontraba»).
   */
  fs: {
    padre: string;
    enCeldaDelPad: boolean;
    w: number;
    h: number;
    fontPx: number;
    texto: string;
    bajoElPliegue: boolean;
  } | null;
}

/**
 * Réplica de las reglas de HOY con el inset literal — sólo para medir la BASE.
 * Es una RÉPLICA declarada como tal: si `index.html` cambia, esta cadena no se entera.
 * Por eso el fix expone `--u5-safe-l/r` y la sonda deja de necesitarla (ver cabecera).
 */
function replicaInsetBase(safeL: number, safeR: number): string {
  return `
html[data-orient="landscape"] .touch-controls {
  padding-left: calc(8px + ${safeL}px) !important;
  padding-right: calc(8px + ${safeR}px) !important;
}
html.u5-touch[data-pad-side="left"] #app { padding-right: ${safeR}px !important; }
html.u5-touch[data-pad-side="right"] #app { padding-left: ${safeL}px !important; }
`;
}

async function medir(page: Page, e: Escena): Promise<Medida> {
  return page.evaluate((esc: Escena): Medida => {
    const r1 = (n: number): number => Math.round(n * 10) / 10;
    const root = document.documentElement;
    const deckEl = document.querySelector(".touch-controls") as HTMLElement | null;
    const cs = deckEl ? getComputedStyle(deckEl) : null;
    const db = deckEl?.getBoundingClientRect();

    // Canvas del juego: el de mayor área dentro de #app.
    let cb: DOMRect | null = null;
    let best = 0;
    for (const c of Array.from(document.querySelectorAll("#app canvas"))) {
      const b = c.getBoundingClientRect();
      if (b.width * b.height > best) {
        best = b.width * b.height;
        cb = b;
      }
    }

    const dpad = document.querySelector(".touch-dpad button") as HTMLElement | null;
    const dpadB = dpad?.getBoundingClientRect();

    // Rejilla de comandos: ancho de celda y NÚMERO DE COLUMNAS medido por la `x` de las
    // celdas (no por `grid-template-columns`, que en `auto-fill` reporta las pistas
    // resueltas pero no cuántas están OCUPADAS).
    const cmds = Array.from(document.querySelectorAll(".touch-commands .touch-cmd")) as HTMLElement[];
    const xs = new Set<number>();
    let cmdCelda = 0;
    let recort = 0;
    let necesita = 0;
    for (const c of cmds) {
      const b = c.getBoundingClientRect();
      if (b.width < 1) continue;
      xs.add(Math.round(b.x));
      cmdCelda = Math.max(cmdCelda, b.width);
      if (c.scrollWidth > c.clientWidth + 1) recort++;
      const ccs = getComputedStyle(c);
      necesita = Math.max(
        necesita,
        c.scrollWidth + parseFloat(ccs.paddingLeft) + parseFloat(ccs.paddingRight),
      );
    }

    // El ⛶ se busca por su clase ESTABLE (`.touch-fullscreen`, la que le pone touch.ts).
    // `.u5padkey-fs` es la marca que deck-dom le añade AL MUDARLO a la celda de la cruz:
    // preguntar por ella es preguntar si la mudanza ocurrió de verdad.
    const fsEl = document.querySelector(".touch-fullscreen") as HTMLElement | null;
    const fsB = fsEl?.getBoundingClientRect();
    // ¿Hay que scrollear para verlo? Su columna (`.touch-util`) tiene `overflow-y:auto`.
    let bajoPliegue = false;
    if (fsEl && fsB) {
      const cont = fsEl.closest(".touch-util, .touch-modebar") as HTMLElement | null;
      if (cont) {
        const cb = cont.getBoundingClientRect();
        bajoPliegue = fsB.bottom > cb.bottom + 1 || fsB.top < cb.top - 1;
      }
    }

    const orient = root.dataset.orient ?? "?";
    const padSide = root.dataset.padSide ?? "left";
    const deckIzq = orient === "landscape" && padSide === "left";
    const bordeInterior = db ? (deckIzq ? db.right : db.left) : 0;

    return {
      id: esc.id,
      label: esc.label,
      w: window.innerWidth,
      h: window.innerHeight,
      orient,
      varsDelFix:
        getComputedStyle(root).getPropertyValue("--u5-safe-l").trim() !== "" ||
        getComputedStyle(root).getPropertyValue("--u5-safe-r").trim() !== "",
      deck: {
        w: r1(db?.width ?? 0),
        h: r1(db?.height ?? 0),
        x: r1(db?.x ?? 0),
        clientW: deckEl?.clientWidth ?? 0,
        padL: parseFloat(cs?.paddingLeft ?? "0"),
        padR: parseFloat(cs?.paddingRight ?? "0"),
      },
      // clientWidth INCLUYE el padding (sólo descuenta borde y barra de scroll): el ancho
      // que de verdad se reparten cruceta y rejilla es clientWidth − padding. Confundir
      // los dos es lo que hace parecer que la muesca «no cuesta nada».
      utilDeck: r1(
        (deckEl?.clientWidth ?? 0) -
          parseFloat(cs?.paddingLeft ?? "0") -
          parseFloat(cs?.paddingRight ?? "0"),
      ),
      wrapCmd: r1(
        (document.querySelector(".touch-cmdwrap") as HTMLElement | null)?.getBoundingClientRect()
          .width ?? 0,
      ),
      dpadCelda: r1(dpadB?.width ?? 0),
      cmdCelda: r1(cmdCelda),
      cmdCols: xs.size,
      cmdRecortados: recort,
      cmdTotal: cmds.length,
      cmdNecesita: r1(necesita),
      canvas: { x: r1(cb?.x ?? 0), y: r1(cb?.y ?? 0), w: r1(cb?.width ?? 0), h: r1(cb?.height ?? 0) },
      // Bandas NEGRAS a los lados del canvas (bug 2). En apaisado se miden contra el borde
      // interior del deck y contra el borde libre de la pantalla; en vertical el deck es
      // una banda inferior, así que las dos son contra la pantalla.
      huecoDeck:
        cb && db && orient === "landscape"
          ? r1(deckIzq ? cb.x - bordeInterior : bordeInterior - cb.right)
          : cb
            ? r1(cb.x)
            : 0,
      huecoLibre:
        cb
          ? orient === "landscape"
            ? r1(deckIzq ? window.innerWidth - cb.right : cb.x)
            : r1(window.innerWidth - cb.right)
          : 0,
      huecoAbajo: cb ? r1(window.innerHeight - cb.bottom) : 0,
      fs: fsEl && fsB
        ? {
            padre: fsEl.parentElement?.className ?? "?",
            enCeldaDelPad: fsEl.classList.contains("u5padkey-fs"),
            w: r1(fsB.width),
            h: r1(fsB.height),
            fontPx: parseFloat(getComputedStyle(fsEl).fontSize),
            texto: (fsEl.textContent ?? "").trim(),
            bajoElPliegue: bajoPliegue,
          }
        : null,
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
    (side: string) => {
      localStorage.clear();
      localStorage.setItem("u5.padSide", side);
      // `tsx` compila con esbuild y `keepNames`, que envuelve toda función con nombre en
      // `__name(...)`. El cuerpo de `page.evaluate` se serializa YA COMPILADO, así que en
      // la página `__name` no existe y el evaluate muere con «__name is not defined».
      // Se define como identidad. (La suite e2e no lo necesita: la compila playwright.)
      (globalThis as unknown as { __name?: unknown }).__name ??= <T,>(f: T): T => f;
    },
    e.padSide,
  );
  await page.goto(`${BASE}/?skin=faithful&nointro&reflow=cuadrado&loc=0&x=60&y=60&hour=10&seed=7&lang=es`);
  await page.waitForFunction(
    () =>
      (window as unknown as { __u5test?: { worldReady?: () => boolean } }).__u5test?.worldReady?.() === true,
    undefined,
    { timeout: 25_000 },
  );
  await page.waitForSelector(".touch-controls", { timeout: 5_000 });

  // La franja de la muesca. Si el fix está puesto (las variables existen), se sobreescriben
  // las VARIABLES y recalcula la cascada real; si no, se inyecta la réplica literal.
  if (e.safeL > 0 || e.safeR > 0) {
    const conVars = await page.evaluate(
      () => getComputedStyle(document.documentElement).getPropertyValue("--u5-safe-l").trim() !== "",
    );
    if (conVars) {
      await page.evaluate(
        ([l, r]: [number, number]) => {
          document.documentElement.style.setProperty("--u5-safe-l", `${l}px`);
          document.documentElement.style.setProperty("--u5-safe-r", `${r}px`);
        },
        [e.safeL, e.safeR] as [number, number],
      );
    } else {
      await page.addStyleTag({ content: replicaInsetBase(e.safeL, e.safeR) });
    }
    // El ancho del deck lo re-publica `syncReserve` en el resize, y ese ancho realimenta
    // el escalado del canvas (`landscapeDeckWidth` lee el RATIO del canvas montado): un
    // solo resize deja la medición a medio converger. Se dan varios y se espera.
    for (let i = 0; i < 4; i++) {
      await page.evaluate(() => window.dispatchEvent(new Event("resize")));
      await page.waitForTimeout(250);
    }
  }
  await page.waitForTimeout(900);

  const m = await medir(page, e);
  if (SHOTS) {
    mkdirSync(SHOTS, { recursive: true });
    // El canvas se RE-CREA al cambiar el ancho del deck (la piel re-escala) y queda en
    // negro hasta el siguiente fotograma del juego: una captura inmediata sale con el
    // mapa vacío y parece una regresión que no es (la caja está — la mide `m.canvas`).
    // Se espera a que el canvas tenga PÍXELES ENCENDIDOS antes de disparar.
    await page
      .waitForFunction(
        () => {
          let best: HTMLCanvasElement | null = null;
          let area = 0;
          for (const c of Array.from(document.querySelectorAll("#app canvas"))) {
            const el = c as HTMLCanvasElement;
            const b = el.getBoundingClientRect();
            if (b.width * b.height > area) {
              area = b.width * b.height;
              best = el;
            }
          }
          if (!best || area === 0) return false;
          const ctx = best.getContext("2d");
          if (!ctx) return false;
          const d = ctx.getImageData(0, 0, Math.min(64, best.width), Math.min(64, best.height)).data;
          for (let i = 0; i < d.length; i += 4) {
            if (d[i]! > 8 || d[i + 1]! > 8 || d[i + 2]! > 8) return true;
          }
          return false;
        },
        undefined,
        { timeout: 8_000 },
      )
      .catch(() => {
        process.stdout.write(`  ⚠ ${e.id}: el canvas seguía en negro al capturar\n`);
      });
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
    if (m.orient === "landscape") {
      process.stdout.write(
        `· ${m.label.padEnd(46)} deck ${N(m.deck.w)} útil ${N(m.utilDeck)} (pad ${N(m.deck.padL)}/${N(m.deck.padR)}) ` +
          `· cruceta ${N(m.dpadCelda)} · celda cmd ${N(m.cmdCelda)}×${m.cmdCols}col (pide ${N(m.cmdNecesita)}) ` +
          `· recortados ${m.cmdRecortados}/${m.cmdTotal} · negro deck ${N(m.huecoDeck)} libre ${N(m.huecoLibre)} abajo ${N(m.huecoAbajo)}\n`,
      );
    } else {
      process.stdout.write(
        `· ${m.label.padEnd(46)} wrap ${N(m.wrapCmd)} · celda cmd ${N(m.cmdCelda)}×${m.cmdCols}col (pide ${N(m.cmdNecesita)}) ` +
          `· recortados ${m.cmdRecortados}/${m.cmdTotal} · negro izq ${N(m.huecoDeck)} der ${N(m.huecoLibre)} ` +
          `· ⛶ ${
            m.fs
              ? `${N(m.fs.w)}×${N(m.fs.h)} @${N(m.fs.fontPx)}px «${m.fs.texto}» en ${m.fs.padre.split(" ").pop()}` +
                `${m.fs.enCeldaDelPad ? " [CELDA DEL PAD]" : " [NO mudado]"}${m.fs.bajoElPliegue ? " [BAJO EL PLIEGUE]" : ""}`
              : "NO EXISTE"
          }\n`,
      );
    }
  }
  await browser.close();
  if (OUT) {
    writeFileSync(OUT, JSON.stringify({ base: BASE, fecha: new Date().toISOString(), medidas: out }, null, 2));
    process.stdout.write(`\nJSON → ${OUT}\n`);
  }
}

void main();
