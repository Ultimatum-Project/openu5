/**
 * SONDA DEL APAISADO REDISEÑADO (dos raíles) — carril `landscape-homog`.
 *
 * POR QUÉ NO SE EXTIENDE `medir.ts`. Aquella sonda mide el deck de `main`: UNA columna
 * lateral cuyo ancho ES el dato (`utilDeck = clientWidth − padding`). El rediseño convierte
 * el deck en un MARCO a pantalla completa (`left:0;right:0`) con dos raíles dentro, así que
 * su `utilDeck` mediría el ancho de la pantalla y daría una cifra que parece buena y no
 * significa nada. Son dos geometrías distintas y por tanto dos instrumentos distintos; el
 * de `main` se deja intacto también porque es de otro carril y se comparte.
 *
 * QUÉ MIDE, y por qué justo esto:
 *   · ANCHO DE CADA RAÍL y del hueco central — la reserva del mapa.
 *   · LA CRUZ: celda, ancho de la rejilla y —lo que de verdad importa con muesca— su
 *     DISTANCIA AL BORDE EXTERIOR de la pantalla. Un raíl que se ensancha bien pero centra
 *     la cruz dentro de la franja es un fix que pasa la aritmética y falla en el pulgar.
 *   · LAS TRES TECLAS (ENT/SPC/ESC): padre real y celda de rejilla. Es el testigo de la
 *     directriz del usuario (que estén EN EL PAD, como en vertical), y se pregunta al DOM
 *     VIVO, no al texto del CSS — el acta `mobile-fixes-0108` documenta un test que llevaba
 *     meses verde comprobando el CSS de una clase que nadie llegaba a poner.
 *   · LA LISTA DE COMANDOS: celda y rótulos recortados (la queja original del informe).
 *   · EL LATIDO: 12 `resize` seguidos listando la serie de anchos. La ficha 1-ter obliga a
 *     COMPROBARLO, no a suponerlo.
 *
 * LA FRANJA se inyecta por `--u5-safe-l/r` (`index.html`, `:root`), nunca por una réplica:
 * el fix de los raíles pasa por esas mismas variables, así que quien recalcula es la cascada
 * REAL. Chromium da `env(safe-area-inset-*)` siempre 0 y sin esto el defecto es invisible.
 *
 * USO (dev server PROPIO en un 52xx — jamás el 5199 del usuario):
 *   U5_PORT=5232 npx tsx tools/mobile-fixes/medir-railes.ts
 *   ... OUT=/ruta/raile.json --shots=/ruta/dir
 */
import { chromium, type Browser, type Page } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const PORT = process.env.U5_PORT ?? "5232";
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
}

/**
 * Los tres viewports que pide el encargo (852×393 y 852×330 con franja 0 y 59, Pixel 7
 * 915×412 apaisado) más el iPhone SE rotado, que es el peor caso de ALTO, y el ⇄ con la
 * franja al otro lado — que es donde un fix cableado a `-left` se cae.
 */
const ESCENAS: Escena[] = [
  { id: "ls-852x393-safe0", label: "852×393 iPhone 15 sin barra · franja 0 (CONTROL)", w: 852, h: 393, safeL: 0, safeR: 0, padSide: "left" },
  { id: "ls-852x393-safe59", label: "852×393 iPhone 15 sin barra · franja 59", w: 852, h: 393, safeL: 59, safeR: 0, padSide: "left" },
  { id: "ls-852x330-safe0", label: "852×330 iPhone 15 con barra · franja 0 (CONTROL)", w: 852, h: 330, safeL: 0, safeR: 0, padSide: "left" },
  { id: "ls-852x330-safe59", label: "852×330 iPhone 15 con barra · franja 59", w: 852, h: 330, safeL: 59, safeR: 0, padSide: "left" },
  { id: "ls-852x330-safe44", label: "852×330 · franja 44 (X/11/12/13)", w: 852, h: 330, safeL: 44, safeR: 0, padSide: "left" },
  { id: "ls-852x330-safe59-right", label: "852×330 · franja 59 DERECHA · ⇄ (deck a la derecha)", w: 852, h: 330, safeL: 0, safeR: 59, padSide: "right" },
  { id: "ls-915x412-safe0", label: "915×412 Pixel 7 apaisado · franja 0", w: 915, h: 412, safeL: 0, safeR: 0, padSide: "left" },
  { id: "ls-568x320-safe0", label: "568×320 iPhone SE rotado · franja 0 (CONTROL)", w: 568, h: 320, safeL: 0, safeR: 0, padSide: "left" },
  { id: "ls-568x320-safe59", label: "568×320 iPhone SE rotado · franja 59 (EL PEOR)", w: 568, h: 320, safeL: 59, safeR: 0, padSide: "left" },
];

interface Tecla {
  clase: string;
  padre: string;
  col: string;
  fila: string;
  w: number;
  h: number;
  recortado: boolean;
}

interface Medida {
  id: string;
  label: string;
  w: number;
  h: number;
  orient: string;
  padSide: string;
  /** ¿Está el fix de la franja puesto? Se pregunta al valor RESUELTO del raíl, no al git. */
  railA: number;
  railB: number;
  /** Hueco central entre raíles: lo que le queda al mapa. */
  centro: number;
  /** Reserva que `#app` guarda a cada lado (tiene que casar con los raíles). */
  appPadL: number;
  appPadR: number;
  dpad: { w: number; celda: number; xIzq: number; xDer: number };
  /** Distancia de la cruz al borde EXTERIOR de la pantalla. Con franja F debe ser ≥ F. */
  cruzAlBorde: number;
  teclas: Tecla[];
  /** Las tres teclas, ¿hijas de `.touch-dpad`? Testigo de la directriz. */
  teclasEnPad: boolean;
  cmdCelda: number;
  cmdRecortados: number;
  cmdTotal: number;
  util: { w: number; celda: number; recortados: number; total: number };
  canvas: { x: number; y: number; w: number; h: number };
  negroIzq: number;
  negroDer: number;
  negroAbajo: number;
  /**
   * Series de 12 `resize`. `railA` es LA GEOMETRÍA QUE MANDA (la columna del raíl, que es
   * quien coloca cruz y mapa); `deckW` es `--u5-deck-w`, que en el rediseño ya no fija el
   * ancho del deck —lo pisa `layoutApaisadoCss`— pero se sigue publicando y de él cuelga
   * `--u5-touch-reserve-x`, que `index.html` usa para centrar los paneles. Se listan las dos
   * porque responden a preguntas distintas: si late la primera, late el layout; si late sólo
   * la segunda, laten los paneles.
   */
  latido: { deckW: number[]; railA: number[] };
}

async function medir(page: Page, e: Escena): Promise<Medida> {
  return page.evaluate((esc: Escena): Medida => {
    const r1 = (n: number): number => Math.round(n * 10) / 10;
    const root = document.documentElement;
    const px = (s: string): number => parseFloat(s) || 0;
    const q = <T extends HTMLElement>(s: string): T | null => document.querySelector<T>(s);

    const util = q(".touch-util");
    const dpad = q(".touch-dpad");
    const wrap = q(".touch-cmdwrap");
    const app = q("#app");

    const utilB = util?.getBoundingClientRect();
    const dpadB = dpad?.getBoundingClientRect();
    const wrapB = wrap?.getBoundingClientRect();

    // El raíl es la COLUMNA de la rejilla, no la caja de un hijo: se lee de las pistas
    // resueltas de `.touch-controls`. Con el ⇄, A y B intercambian número de columna, así
    // que «raíl A» se identifica por dónde está `.touch-util`, no por la posición 1.
    const deck = q(".touch-controls");
    const cols = deck
      ? getComputedStyle(deck)
          .gridTemplateColumns.split(/\s+/)
          .map((s) => px(s))
      : [];
    const izquierda = esc.padSide === "left";
    const railA = r1(izquierda ? (cols[0] ?? 0) : (cols[2] ?? 0));
    const railB = r1(izquierda ? (cols[2] ?? 0) : (cols[0] ?? 0));
    const centro = r1(cols[1] ?? 0);

    const appCs = app ? getComputedStyle(app) : null;

    // La cruz contra el borde exterior de la PANTALLA (no del raíl).
    // ⚠ SE MIDEN LOS BOTONES, no el contenedor. `.touch-dpad` lleva el relleno de la franja,
    // así que su caja de BORDE ocupa la columna entera y su `left` da 0 SIEMPRE — con y sin
    // muesca. Medir ahí daría un verde constante que no significa nada (la primera versión
    // de esta sonda lo hacía y por eso salían nueve ceros idénticos). Lo que decide si el
    // pulgar alcanza la cruz es dónde está la TECLA más exterior.
    const botones = Array.from(document.querySelectorAll<HTMLElement>(".touch-dpad > *"))
      .map((el) => el.getBoundingClientRect())
      .filter((b) => b.width > 0);
    const cruzIzq = botones.length ? Math.min(...botones.map((b) => b.left)) : 0;
    const cruzDer = botones.length ? Math.max(...botones.map((b) => b.right)) : 0;
    const cruzAlBorde = botones.length
      ? r1(izquierda ? cruzIzq : window.innerWidth - cruzDer)
      : 0;

    const teclas: Tecla[] = [];
    for (const cls of ["u5padkey-spc", "u5padkey-ent", "u5padkey-esc"]) {
      const el = q(`.${cls}`);
      if (!el) continue;
      const b = el.getBoundingClientRect();
      const cs = getComputedStyle(el);
      teclas.push({
        clase: cls,
        padre: el.parentElement?.className.split(/\s+/)[0] ?? "?",
        col: cs.gridColumnStart,
        fila: cs.gridRowStart,
        w: r1(b.width),
        h: r1(b.height),
        recortado: el.scrollWidth > el.clientWidth + 1,
      });
    }
    const teclasEnPad =
      teclas.length === 3 && teclas.every((t) => t.padre === "touch-dpad");

    const celdas = (sel: string): { celda: number; recortados: number; total: number } => {
      let celda = 0;
      let rec = 0;
      let tot = 0;
      for (const c of Array.from(document.querySelectorAll<HTMLElement>(sel))) {
        const b = c.getBoundingClientRect();
        if (b.width < 1) continue;
        tot++;
        celda = Math.max(celda, b.width);
        if (c.scrollWidth > c.clientWidth + 1) rec++;
      }
      return { celda: r1(celda), recortados: rec, total: tot };
    };
    const cmd = celdas(".touch-commands .touch-cmd");
    const act = celdas(".touch-util .touch-util-btn, .touch-util .touch-mode");

    // ⚠ EL CANVAS DE LA PIEL ACTIVA, no «el más grande de #app». Dentro de `#app` conviven
    // DOS canvas de juego: el de `.portrait-skin` (el que se ve) y el de `.faithful-skin`,
    // que sigue montado a resolución nativa 320×200 y aparcado en (−160,−100). En el iPhone
    // SE rotado el mostrado mide 312×187 = 58.344 px² y el aparcado 64.000: el «max por
    // área» elegía AL APARCADO y de ahí salía un hueco negro de −312 px. Filtrar por
    // «interseca el viewport» NO basta —el aparcado asoma por (0,0)— y ése fue el segundo
    // intento fallido. El criterio que sí decide es de QUIÉN es el canvas.
    let cb: DOMRect | null = null;
    let best = 0;
    const dentroDePiel = document.querySelectorAll("#app .portrait-skin canvas");
    const candidatos = dentroDePiel.length
      ? dentroDePiel
      : document.querySelectorAll("#app canvas");
    for (const c of Array.from(candidatos)) {
      const b = c.getBoundingClientRect();
      if (b.width * b.height > best) {
        best = b.width * b.height;
        cb = b;
      }
    }

    return {
      id: esc.id,
      label: esc.label,
      w: window.innerWidth,
      h: window.innerHeight,
      orient: root.dataset.orient ?? "?",
      padSide: root.dataset.padSide ?? "left",
      railA,
      railB,
      centro,
      appPadL: px(appCs?.paddingLeft ?? "0"),
      appPadR: px(appCs?.paddingRight ?? "0"),
      dpad: {
        // El ANCHO ÚTIL de la cruz = de la tecla más a la izquierda a la más a la derecha
        // (3×44 + 2×4 = 140 por diseño). `dpadB.width` daría la columna entera: incluye el
        // relleno de la franja y por tanto CRECE con la muesca, que es justo lo contrario
        // de lo que hay que vigilar.
        w: r1(cruzDer - cruzIzq),
        celda: r1(q(".touch-dpad .dpad-up")?.getBoundingClientRect().width ?? 0),
        xIzq: r1(cruzIzq),
        xDer: r1(window.innerWidth - cruzDer),
      },
      cruzAlBorde,
      teclas,
      teclasEnPad,
      cmdCelda: cmd.celda,
      cmdRecortados: cmd.recortados,
      cmdTotal: cmd.total,
      util: { w: r1(utilB?.width ?? 0), celda: act.celda, recortados: act.recortados, total: act.total },
      canvas: { x: r1(cb?.x ?? 0), y: r1(cb?.y ?? 0), w: r1(cb?.width ?? 0), h: r1(cb?.height ?? 0) },
      // Bandas negras entre el borde INTERIOR de cada raíl y el canvas. Se miden contra las
      // COLUMNAS de la rejilla (`cols[0]` / `cols[2]`), no contra el rect de un hijo:
      // `.touch-util` sólo ocupa la FILA 1 de su raíl y `.touch-cmdwrap` la 1-2, así que sus
      // cajas no son el borde del raíl en todas las alturas. La columna sí lo es siempre.
      negroIzq: cb ? r1(cb.x - (cols[0] ?? 0)) : 0,
      negroDer: cb ? r1(window.innerWidth - (cols[2] ?? 0) - cb.right) : 0,
      negroAbajo: cb ? r1(window.innerHeight - cb.bottom) : 0,
      latido: { deckW: [], railA: [] },
    };
  }, e);
}

/**
 * EL LATIDO. `syncReserve` publica `--u5-deck-w` desde `landscapeDeckWidth`, que lee el
 * RATIO del canvas MONTADO; si el ancho publicado re-escala el canvas, el ratio medido
 * cambia y el punto fijo puede desaparecer (así latió el deck de `main` entre 319/376/383).
 * Con raíles FIJOS el bucle DEBERÍA estar muerto — esto lo comprueba en vez de suponerlo.
 * Se lista la serie entera, no su varianza: una serie con dos valores y una meseta de tres
 * vueltas se lee mal como «estable» si sólo se mira el final.
 */
async function medirLatido(page: Page): Promise<{ deckW: number[]; railA: number[] }> {
  const deckW: number[] = [];
  const railA: number[] = [];
  for (let i = 0; i < 12; i++) {
    await page.evaluate(() => window.dispatchEvent(new Event("resize")));
    await page.waitForTimeout(180);
    const [d, a] = await page.evaluate((): [number, number] => {
      const r1 = (n: number): number => Math.round(n * 10) / 10;
      const cs = getComputedStyle(document.documentElement);
      const deck = document.querySelector<HTMLElement>(".touch-controls");
      // El raíl A es la columna 1 con el deck a la izquierda y la 3 con el ⇄ puesto:
      // tomar siempre la 1 mediría el raíl B en la escena del espejo (daba «estable (104)»,
      // una cifra correcta de OTRA cosa — el tipo de verde que no prueba lo que dice).
      const cols = deck ? getComputedStyle(deck).gridTemplateColumns.split(/\s+/) : [];
      const idx = document.documentElement.dataset.padSide === "right" ? 2 : 0;
      const col = parseFloat(cols[idx] ?? "0");
      return [r1(parseFloat(cs.getPropertyValue("--u5-deck-w")) || 0), r1(col || 0)];
    });
    deckW.push(d);
    railA.push(a);
  }
  return { deckW, railA };
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
      // `tsx`/esbuild compila con `keepNames` y envuelve las funciones con nombre en
      // `__name(...)`; el cuerpo de `evaluate` se serializa YA COMPILADO y en la página
      // `__name` no existe. Se define como identidad (misma nota que en `medir.ts`).
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

  const latido = await medirLatido(page);
  await page.waitForTimeout(600);

  const m = await medir(page, e);
  m.latido = latido;

  if (SHOTS) {
    mkdirSync(SHOTS, { recursive: true });
    // El canvas se RE-CREA al re-escalar y queda negro hasta el siguiente fotograma: una
    // captura inmediata parece una regresión que no es. Se espera a que tenga píxeles.
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
          const ctx2 = best.getContext("2d");
          if (!ctx2) return false;
          const d = ctx2.getImageData(0, 0, Math.min(64, best.width), Math.min(64, best.height)).data;
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

/**
 * Clasifica una serie SIN esconder la diferencia entre las dos cosas que la ficha 1-ter
 * separa: CONVERGER (unos rebotes y luego una constante para siempre) no es LATIR (no hay
 * cola constante). El acta de `main` avisa además de que el ciclo tiene mesetas de 2-3
 * vueltas, así que una cola constante corta no vale: se exige que la constante ocupe al
 * menos la SEGUNDA MITAD de la serie, y se imprime la serie entera para que el lector
 * juzgue por su cuenta en vez de fiarse de esta etiqueta.
 */
function veredictoSerie(s: number[]): string {
  if (s.length === 0) return "sin datos";
  const ultimo = s[s.length - 1]!;
  let i = s.length - 1;
  while (i > 0 && s[i - 1] === ultimo) i--;
  const cola = s.length - i;
  if (i === 0) return `estable desde la 1ª (${N(ultimo)})`;
  if (cola >= s.length / 2) return `converge en la vuelta ${i + 1} y se queda (${s.slice(0, i + 1).map(N).join("→")}, luego ${N(ultimo)} ×${cola})`;
  return `⚠ LATE: ${s.map(N).join(", ")}`;
}

async function main(): Promise<void> {
  const browser = await chromium.launch({ headless: true });
  const out: Medida[] = [];
  for (const e of ESCENAS) {
    const m = await unaEscena(browser, e);
    out.push(m);
    process.stdout.write(
      `· ${m.label.padEnd(50)}\n` +
        `    raíl A ${N(m.railA)} · raíl B ${N(m.railB)} · centro ${N(m.centro)} · #app pad ${N(m.appPadL)}/${N(m.appPadR)}\n` +
        `    cruz ${N(m.dpad.w)} celda ${N(m.dpad.celda)} · AL BORDE ${N(m.cruzAlBorde)} · teclas en pad: ${m.teclasEnPad ? "SÍ" : "NO"} (${m.teclas.map((t) => `${t.clase.slice(9)}@${t.col},${t.fila} ${N(t.w)}px${t.recortado ? " RECORTADO" : ""}`).join(" · ")})\n` +
        `    cmd celda ${N(m.cmdCelda)} recortados ${m.cmdRecortados}/${m.cmdTotal} · activadores celda ${N(m.util.celda)} recortados ${m.util.recortados}/${m.util.total}\n` +
        `    negro izq ${N(m.negroIzq)} der ${N(m.negroDer)} abajo ${N(m.negroAbajo)}\n` +
        `    LATIDO raíl A: ${veredictoSerie(m.latido.railA)}\n` +
        `    LATIDO deck-w: ${veredictoSerie(m.latido.deckW)}\n`,
    );
  }
  await browser.close();
  if (OUT) {
    writeFileSync(OUT, JSON.stringify({ base: BASE, fecha: new Date().toISOString(), medidas: out }, null, 2));
    process.stdout.write(`\nJSON → ${OUT}\n`);
  }
}

void main();
