/**
 * SONDA DEL CARRIL `fix/portrait-pulido` — las cifras de las SEIS peticiones del usuario
 * del 02-08 sobre la UI móvil (cinco en PORTRAIT y una en APAISADO), medidas en navegador
 * sobre el código VIVO.
 *
 * POR QUÉ EXISTE. Casi todos los ítems son cifras (el suelo de columna de la rejilla,
 * la holgura entre el mapa y la banda, dónde arranca la línea del techo de la banda, la
 * altura de los botones de las tres columnas) y ninguna se puede leer del CSS: salen de la
 * cascada resuelta, del canvas COMPUESTO y del texto ya rotulado en el idioma vivo. Una
 * cifra sin sonda es irreproducible — ésta es la sonda.
 *
 * QUÉ MIDE, ítem por ítem:
 *   1 · `rotulos`  — lo que PIDE cada rótulo de la rejilla de comandos (scrollWidth +
 *                    padding, o sea el ancho de celda que no lo cizalla). El máximo de esa
 *                    lista ES el suelo de columna de `deck-ancho.ts`; la sonda lo publica
 *                    ORDENADO para poder re-derivarlo cuando un rótulo cambia.
 *   2 · `sep`      — hueco NEGRO entre la última scanline del bloque de mapa y el techo de
 *                    la banda de jugadores/log, leído del CANVAS COMPUESTO (no del
 *                    descriptor: lo que se ve es lo que se pinta).
 *   3 · `lineaBanda` — x del primer y del último píxel BLANCO de la línea del techo de la
 *                    banda, contra el ancho del canvas. Si `xIni > 0` la línea no llega al
 *                    borde izquierdo, que es la queja.
 *   4 · `historial` — con el scrollback ACTIVO, las scanlines blancas que hay encima del
 *                    banner ►HISTORIAL◄, con su x-extent.
 *   5 · `columnas` — top y alto de CADA botón de las tres columnas del deck (accesos,
 *                    acciones, cruceta), más el desfase del primer botón de cada una.
 *   6 · `apaisado` — ancho del raíl de acciones, banda negra contra el canvas, y qué
 *                    rótulos DESBORDAN su celda.
 *
 * USO (dev server PROPIO en un 52xx — jamás el 5199 del usuario):
 *   U5_PORT=5241 npx tsx tools/portrait-pulido/sonda.ts            → tabla a stdout
 *   ... OUT=/ruta/medidas.json                                     → además, JSON
 *   ... SHOTS=/ruta/dir                                            → capturas por escena
 */
import { chromium, type Browser, type Page } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const PORT = process.env.U5_PORT ?? "5241";
const BASE = `http://localhost:${PORT}`;
const OUT = process.env.OUT ?? "";
const SHOTS = process.env.SHOTS ?? "";
const LANGS = (process.env.LANGS ?? "es,en").split(",");

interface Escena {
  id: string;
  label: string;
  w: number;
  h: number;
}

/** El censo de teléfonos del carril móvil: el estrecho, los dos comunes y el ancho.
 *  Los `ls-*` son APAISADO (ítem 6): ahí el deck es columna lateral y su geometría es otra. */
const ESCENAS: Escena[] = [
  { id: "iphone15", label: "393×852 iPhone 15", w: 393, h: 852 },
  { id: "pixel7", label: "412×915 Pixel 7", w: 412, h: 915 },
  { id: "promax", label: "430×932 iPhone 15 Pro Max", w: 430, h: 932 },
  { id: "se", label: "320×568 iPhone SE", w: 320, h: 568 },
  { id: "ls-iphone15", label: "852×393 iPhone 15 APAISADO sin barra", w: 852, h: 393 },
  { id: "ls-pixel7", label: "915×412 Pixel 7 APAISADO sin barra", w: 915, h: 412 },
  { id: "ls-se", label: "568×320 iPhone SE APAISADO", w: 568, h: 320 },
  // 🔴 APAISADO **CON LA BARRA DEL NAVEGADOR**, que es EL CASO NORMAL y el de la captura
  // del usuario. Importa porque en apaisado la escala del mapa es
  // `min((W − banda)/FRAME_W, H/MAP_BLOCK_H)`: con el alto recortado manda el ALTO, el
  // canvas sale MÁS ESTRECHO que el hueco central, y todo el sobrante se acumula del lado
  // del raíl B (por el `justify-content:flex-start` del 01-08). Con los altos generosos de
  // arriba ese sobrante es 0 y el defecto es INVISIBLE para la sonda — que es exactamente
  // lo que me pasó: medí 0 px de hueco mientras el usuario miraba 34.
  { id: "ls-iphone15-barra", label: "852×330 iPhone 15 APAISADO con barra", w: 852, h: 330 },
  { id: "ls-pixel7-barra", label: "915×360 Pixel 7 APAISADO con barra", w: 915, h: 360 },
  { id: "ls-promax-barra", label: "932×360 Pro Max APAISADO con barra", w: 932, h: 360 },
];

export interface Boton {
  texto: string;
  top: number;
  h: number;
  w: number;
  /** Ancho que PIDE el rótulo para no cizallarse: scrollWidth + padding horizontal. */
  pide: number;
}

export interface Medida {
  id: string;
  label: string;
  lang: string;
  w: number;
  h: number;
  /** Escalas vivas del re-flow (del descriptor publicado en `__u5reflow`). */
  mapScale: number;
  bandScale: number;
  canvas: { x: number; y: number; w: number; h: number; bbW: number; bbH: number };
  /** Ítem 2 — hueco negro, en px de DISPOSITIVO del backbuffer, entre mapa y banda. */
  sep: { yFinMapa: number; yIniBanda: number; huecoDev: number; huecoCss: number } | null;
  /** Ítem 3 — extremos de la línea blanca del techo de la banda (px de backbuffer). */
  lineaBanda: { y: number; xIni: number; xFin: number; anchoCanvas: number } | null;
  /** Ítem 4 — con historial: filas blancas ENCIMA del banner, y la fila del banner. */
  historial: {
    activo: boolean;
    yBanner: number | null;
    blancasEncima: { y: number; xIni: number; xFin: number }[];
  } | null;
  /** Ítem 5 — botones por columna. */
  columnas: { accesos: Boton[]; acciones: Boton[]; cruceta: Boton[] };
  /**
   * Ítem 6 (APAISADO) — el raíl de acciones contra el visor. `hueco` es la banda NEGRA
   * entre el borde del canvas y el borde interior del raíl: es el ancho que el raíl puede
   * comerse SIN quitarle un píxel al mapa (en apaisado el canvas está limitado por el ALTO).
   */
  apaisado: {
    railW: number;
    railX: number;
    canvasFin: number;
    hueco: number;
    aLaDerecha: boolean;
    botonFin: number | null;
    /** (a) del botón a la caja del raíl: padding del raíl. */
    botonAlRail: number | null;
    /** (b) de la caja del raíl al canvas: lo ÚNICO que el ancho del raíl mueve. */
    railAlCanvas: number;
    /** (c) del canvas al cromo AZUL: negro DENTRO del canvas compuesto. */
    canvasAlCromo: number | null;
    /** (a)+(b)+(c) — el hueco que el usuario ve y mide en su captura. */
    botonAlCromo: number | null;
  } | null;
  /** Ítem 1 — rótulos de la rejilla ORDENADOS por lo que piden (los 6 más anchos). */
  rotulos: { texto: string; pide: number }[];
}

/** Lee el canvas COMPUESTO del re-flow y devuelve las mediciones de píxel (2, 3, 4). */
async function medirCanvas(page: Page): Promise<
  Pick<Medida, "sep" | "lineaBanda"> & { canvasBB: { w: number; h: number } }
> {
  return page.evaluate(() => {
    // 🔴 EL CANVAS PRESENTADO, NO EL DE LA FUENTE. El envoltorio partido aloja la piel fiel
    // en un host `.portrait-skin-src` de 0×0 con su canvas a resolución NATIVA aparcado en
    // (−160,−100) — o sea, un canvas de más ÁREA que el presentado en los tamaños chicos.
    // Coger «el de mayor área» lo elegía a él: en un iPhone SE apaisado la sonda daba
    // «canvas de 320 acabando en x=160 y 304 px de negro contra el raíl», que es la caja de
    // la FUENTE, no nada que se vea. Se excluye por su host y por caer fuera del viewport.
    const cs = (Array.from(document.querySelectorAll("#app canvas")) as HTMLCanvasElement[])
      .filter((el) => !el.closest(".portrait-skin-src"))
      .filter((el) => {
        const b = el.getBoundingClientRect();
        return b.right > 0 && b.bottom > 0 && b.left < window.innerWidth && b.top < window.innerHeight;
      });
    let c: HTMLCanvasElement | null = null;
    let area = 0;
    for (const el of cs) {
      const b = el.getBoundingClientRect();
      if (b.width * b.height > area) {
        area = b.width * b.height;
        c = el;
      }
    }
    if (!c) return { sep: null, lineaBanda: null, canvasBB: { w: 0, h: 0 } };
    const g = c.getContext("2d", { willReadFrequently: true });
    if (!g) return { sep: null, lineaBanda: null, canvasBB: { w: c.width, h: c.height } };
    const W = c.width;
    const H = c.height;
    const d = g.getImageData(0, 0, W, H).data;
    const at = (x: number, y: number): [number, number, number] => {
      const i = (y * W + x) * 4;
      return [d[i]!, d[i + 1]!, d[i + 2]!];
    };
    const esBlanco = (x: number, y: number): boolean => {
      const [r, gg, b] = at(x, y);
      return r > 150 && gg > 150 && b > 150;
    };
    const esNegro = (x: number, y: number): boolean => {
      const [r, gg, b] = at(x, y);
      return r < 40 && gg < 40 && b < 40;
    };
    /** ¿La fila es MAYORITARIAMENTE blanca de borde a borde? (las dos líneas separadoras) */
    const filaBlanca = (y: number): number => {
      let n = 0;
      for (let x = 0; x < W; x++) if (esBlanco(x, y)) n++;
      return n / W;
    };
    /** ¿La fila es ENTERAMENTE negra? (el hueco de separación) */
    const filaNegra = (y: number): boolean => {
      for (let x = 0; x < W; x++) if (!esNegro(x, y)) return false;
      return true;
    };

    // La banda de jugadores/log arranca donde vuelve a haber AZUL a lo ancho tras el hueco.
    // Se busca desde la mitad del canvas hacia abajo la PRIMERA racha de filas negras
    // completas: ése es el hueco de separación (SEP_GAP), único sitio del canvas donde una
    // fila entera es negra entre dos bloques de cromo.
    let yFinMapa = -1;
    let yIniBanda = -1;
    for (let y = Math.floor(H * 0.35); y < H - 2; y++) {
      if (filaNegra(y) && !filaNegra(y - 1)) {
        let z = y;
        while (z < H && filaNegra(z)) z++;
        // El hueco tiene que estar seguido de cromo (no del final del canvas).
        if (z < H - 1) {
          yFinMapa = y;
          yIniBanda = z;
          break;
        }
      }
    }
    const sep =
      yFinMapa >= 0 ?
        {
          yFinMapa,
          yIniBanda,
          huecoDev: yIniBanda - yFinMapa,
          huecoCss: (yIniBanda - yFinMapa) / (window.devicePixelRatio || 1),
        }
      : null;

    // LÍNEA DEL TECHO DE LA BANDA: la primera fila con blanco a partir de `yFinMapa`
    // (se pinta pegada por abajo al techo de la banda, dentro del hueco).
    let lineaBanda: { y: number; xIni: number; xFin: number; anchoCanvas: number } | null = null;
    if (yFinMapa >= 0) {
      for (let y = yFinMapa; y < Math.min(H, yIniBanda + 4); y++) {
        if (filaBlanca(y) > 0.5) {
          let xIni = 0;
          while (xIni < W && !esBlanco(xIni, y)) xIni++;
          let xFin = W - 1;
          while (xFin >= 0 && !esBlanco(xFin, y)) xFin--;
          lineaBanda = { y, xIni, xFin, anchoCanvas: W };
          break;
        }
      }
    }
    return { sep, lineaBanda, canvasBB: { w: W, h: H } };
  });
}

/**
 * Ítem 4: activa el scrollback y busca filas blancas ENCIMA del banner ►HISTORIAL◄.
 *
 * DOS PRECONDICIONES que la primera versión de esta sonda se saltó y devolvieron un
 * «NINGUNA ✓» en falso: (a) el offset del scrollback se acota a `maxScrollOffset`, que
 * depende del historial VIVO — con dos líneas en la consola la rueda no mueve nada y el
 * modo no entra; (b) sin modo, la fila que la sonda tomaba por banner era el propio
 * separador. Aquí se CAMINA primero para llenar la consola y se verifica la entrada
 * buscando la banda AZUL del banner (fila de la costura), no una fila blanca cualquiera.
 */
async function medirHistorial(page: Page): Promise<Medida["historial"]> {
  // 1) Llenar la consola: 24 pasos de mundo, cada uno ecoa su dirección.
  for (let i = 0; i < 24; i++) {
    await page.keyboard.press(i % 2 === 0 ? "ArrowRight" : "ArrowLeft");
    await page.waitForTimeout(60);
  }
  await page.waitForTimeout(400);
  // 2) El scrollback entra por la RUEDA sobre la zona de consola (mitad derecha de la banda).
  const zona = await page.evaluate(() => {
    // 🔴 EL CANVAS PRESENTADO, NO EL DE LA FUENTE. El envoltorio partido aloja la piel fiel
    // en un host `.portrait-skin-src` de 0×0 con su canvas a resolución NATIVA aparcado en
    // (−160,−100) — o sea, un canvas de más ÁREA que el presentado en los tamaños chicos.
    // Coger «el de mayor área» lo elegía a él: en un iPhone SE apaisado la sonda daba
    // «canvas de 320 acabando en x=160 y 304 px de negro contra el raíl», que es la caja de
    // la FUENTE, no nada que se vea. Se excluye por su host y por caer fuera del viewport.
    const cs = (Array.from(document.querySelectorAll("#app canvas")) as HTMLCanvasElement[])
      .filter((el) => !el.closest(".portrait-skin-src"))
      .filter((el) => {
        const b = el.getBoundingClientRect();
        return b.right > 0 && b.bottom > 0 && b.left < window.innerWidth && b.top < window.innerHeight;
      });
    let c: HTMLCanvasElement | null = null;
    let area = 0;
    for (const el of cs) {
      const b = el.getBoundingClientRect();
      if (b.width * b.height > area) {
        area = b.width * b.height;
        c = el;
      }
    }
    if (!c) return null;
    const b = c.getBoundingClientRect();
    // Zona de log = columna DERECHA de la banda, que ocupa el cuarto inferior del canvas.
    return { x: b.x + b.width * 0.75, y: b.y + b.height * 0.93 };
  });
  if (!zona) return null;
  await page.mouse.move(zona.x, zona.y);
  // deltaY NEGATIVO: `wheelLines` mapea rueda-arriba a offset POSITIVO (retroceder en el
  // historial). Con +600 el offset se queda clavado en 0 y el modo no entra — y la sonda
  // devolvía «ninguna línea blanca ✓» sobre una captura SIN historial.
  await page.mouse.wheel(0, -600);
  await page.waitForTimeout(700);

  return page.evaluate(() => {
    // 🔴 EL CANVAS PRESENTADO, NO EL DE LA FUENTE. El envoltorio partido aloja la piel fiel
    // en un host `.portrait-skin-src` de 0×0 con su canvas a resolución NATIVA aparcado en
    // (−160,−100) — o sea, un canvas de más ÁREA que el presentado en los tamaños chicos.
    // Coger «el de mayor área» lo elegía a él: en un iPhone SE apaisado la sonda daba
    // «canvas de 320 acabando en x=160 y 304 px de negro contra el raíl», que es la caja de
    // la FUENTE, no nada que se vea. Se excluye por su host y por caer fuera del viewport.
    const cs = (Array.from(document.querySelectorAll("#app canvas")) as HTMLCanvasElement[])
      .filter((el) => !el.closest(".portrait-skin-src"))
      .filter((el) => {
        const b = el.getBoundingClientRect();
        return b.right > 0 && b.bottom > 0 && b.left < window.innerWidth && b.top < window.innerHeight;
      });
    let c: HTMLCanvasElement | null = null;
    let area = 0;
    for (const el of cs) {
      const b = el.getBoundingClientRect();
      if (b.width * b.height > area) {
        area = b.width * b.height;
        c = el;
      }
    }
    if (!c) return null;
    const g = c.getContext("2d", { willReadFrequently: true });
    if (!g) return null;
    const W = c.width;
    const H = c.height;
    const d = g.getImageData(0, 0, W, H).data;
    const blanco = (x: number, y: number): boolean => {
      const i = (y * W + x) * 4;
      return d[i]! > 150 && d[i + 1]! > 150 && d[i + 2]! > 150;
    };
    const negro = (x: number, y: number): boolean => {
      const i = (y * W + x) * 4;
      return d[i]! < 40 && d[i + 1]! < 40 && d[i + 2]! < 40;
    };
    const filaNegra = (y: number): boolean => {
      for (let x = 0; x < W; x++) if (!negro(x, y)) return false;
      return true;
    };
    // El hueco de separación otra vez, para acotar la ventana de interés.
    let yGap = -1;
    let yBanda = -1;
    for (let y = Math.floor(H * 0.35); y < H - 2; y++) {
      if (filaNegra(y) && !filaNegra(y - 1)) {
        let z = y;
        while (z < H && filaNegra(z)) z++;
        if (z < H - 1) {
          yGap = y;
          yBanda = z;
          break;
        }
      }
    }
    if (yGap < 0) return null;
    // Fin del SEPARADOR: la racha de filas mayoritariamente blancas que sigue al hueco. Lo
    // que viene DESPUÉS ya es contenido de la banda. (La primera versión de esta sonda
    // tomaba la primera fila blanca por el banner — o sea, medía el separador.)
    const mayorBlanca = (y: number): boolean => {
      let n = 0;
      for (let x = 0; x < W; x++) if (blanco(x, y)) n++;
      return n > W * 0.4;
    };
    let yContenido = yBanda;
    while (yContenido < H && mayorBlanca(yContenido)) yContenido++;

    // El banner ►HISTORIAL◄ vive en la COSTURA (primera fila de texto de la banda) y sobre
    // fondo AZUL: la fila del banner es la primera con TINTA BLANCA en la mitad DERECHA por
    // debajo de `yContenido`. Sin scrollback esa fila es azul maciza y no hay tinta: por eso
    // `yBanner === null` es la señal honesta de «el modo historial NO entró».
    const medio = Math.floor(W / 2);
    let yBanner: number | null = null;
    for (let y = yContenido; y < Math.min(H, yContenido + 24); y++) {
      let n = 0;
      for (let x = medio; x < W; x++) if (blanco(x, y)) n++;
      if (n > 6) {
        yBanner = y;
        break;
      }
    }
    // Filas blancas ENCIMA del banner y DENTRO de la banda (o sea, desde `yContenido`): las
    // sospechosas del ítem 4. El separador del hueco queda fuera a propósito — ése es el
    // ítem 3 y se mide aparte.
    const blancasEncima: { y: number; xIni: number; xFin: number }[] = [];
    for (let y = yContenido; y < (yBanner ?? yContenido); y++) {
      if (!mayorBlanca(y)) continue;
      let xIni = 0;
      while (xIni < W && !blanco(xIni, y)) xIni++;
      let xFin = W - 1;
      while (xFin >= 0 && !blanco(xFin, y)) xFin--;
      blancasEncima.push({ y, xIni, xFin });
    }
    return { activo: yBanner !== null, yBanner, blancasEncima };
  });
}

/**
 * Ítem 5 + ítem 1: botones del deck por columna y ancho INTRÍNSECO de cada rótulo.
 *
 * EL ANCHO PEDIDO NO ES `scrollWidth`. Un botón cuyo rótulo CABE tiene
 * `scrollWidth === clientWidth`, así que `scrollWidth + padding` devuelve el ancho de LA
 * CELDA y no el del texto: en un Pro Max la sonda «medía» 163 px para todos los rótulos por
 * igual. Sólo cuando la celda cizalla (el iPhone SE, envoltorio de ~49 px) el número es el
 * del contenido — que es por lo que la derivación original del suelo salió bien por
 * casualidad de haberse hecho en el teléfono estrecho.
 *
 * Aquí se mide el ancho INTRÍNSECO y en TODO dispositivo: se clona el botón en un contenedor
 * fuera de flujo con `width:max-content`, heredando su tipografía real (misma clase, mismo
 * padre, misma cascada). Lo que devuelve es «cuánto ancho de celda pide este rótulo para no
 * cizallarse», independiente de la celda que le haya tocado.
 */
async function medirDeck(page: Page): Promise<Pick<Medida, "columnas" | "rotulos">> {
  return page.evaluate(() => {
    /**
     * Ancho que PIDE el rótulo, con la MISMA fórmula que la derivación original del suelo
     * (`tools/mobile-fixes/medir.ts`: `scrollWidth + paddingL + paddingR`) — pero forzando
     * el CIZALLAMIENTO, que es lo que hace que esa fórmula signifique algo.
     *
     * La fórmula sólo mide el CONTENIDO cuando el elemento desborda: si el rótulo cabe,
     * `scrollWidth === clientWidth` y devuelve el ancho de LA CELDA. La derivación de los
     * 114 px salió correcta porque se hizo sobre el iPhone SE, cuyo envoltorio de ~49 px
     * cizalla los 25 comandos; en un Pro Max la misma fórmula habría dicho «163 px para
     * todos». Aquí se clona el botón con `width:0` en su MISMO padre (misma cascada, misma
     * tipografía) para garantizar el desbordamiento en cualquier dispositivo. Comprobado:
     * reproduce los 110 / 108 px de «🔥 Antorcha» / «Nuevo orden» del censo original.
     */
    const intrinseco = (e: HTMLElement): number => {
      const clone = e.cloneNode(true) as HTMLElement;
      clone.style.position = "absolute";
      clone.style.visibility = "hidden";
      clone.style.width = "0px";
      clone.style.minWidth = "0";
      clone.style.maxWidth = "none";
      clone.style.overflow = "hidden";
      clone.style.pointerEvents = "none";
      e.parentElement?.appendChild(clone);
      const cs = getComputedStyle(clone);
      const w = clone.scrollWidth + parseFloat(cs.paddingLeft) + parseFloat(cs.paddingRight);
      clone.remove();
      return Math.round(w * 10) / 10;
    };
    const caja = (
      el: Element,
    ): { texto: string; top: number; h: number; w: number; pide: number } => {
      const e = el as HTMLElement;
      const b = e.getBoundingClientRect();
      return {
        texto: (e.textContent ?? "").trim(),
        top: Math.round(b.top * 10) / 10,
        h: Math.round(b.height * 10) / 10,
        w: Math.round(b.width * 10) / 10,
        pide: intrinseco(e),
      };
    };
    // ORDEN VISUAL, no de árbol: la columna de accesos usa `order` en el CSS (el ☰ va a
    // −10) y la cruceta coloca por `grid-column/row`. Preguntar por el DOM devolvía el
    // «primer botón» equivocado — y el ítem 5 es justamente sobre el PRIMERO de cada columna.
    const visibles = (sel: string): ReturnType<typeof caja>[] =>
      Array.from(document.querySelectorAll(sel))
        .filter((e) => (e as HTMLElement).getBoundingClientRect().width > 1)
        .map(caja)
        .sort((a, b) => a.top - b.top);
    const accesos = visibles(".touch-util > *");
    const acciones = visibles(".touch-commands .touch-cmd");
    const cruceta = visibles(".touch-dpad > *");
    const rotulos = acciones
      .map((b) => ({ texto: b.texto, pide: b.pide }))
      .sort((a, b) => b.pide - a.pide)
      .slice(0, 6);
    return { columnas: { accesos, acciones, cruceta }, rotulos };
  });
}

async function unaEscena(browser: Browser, e: Escena, lang: string): Promise<Medida> {
  const ctx = await browser.newContext({
    viewport: { width: e.w, height: e.h },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
  });
  const page = await ctx.newPage();
  await page.addInitScript(() => {
    localStorage.clear();
    // `tsx` compila con esbuild y `keepNames`, que envuelve toda función con nombre en
    // `__name(...)`. El cuerpo de `page.evaluate` se serializa YA COMPILADO, así que en la
    // página `__name` no existe y el evaluate muere con «__name is not defined».
    (globalThis as unknown as { __name?: unknown }).__name ??= <T,>(f: T): T => f;
  });
  await page.goto(
    `${BASE}/?skin=faithful&nointro&reflow=cuadrado&loc=0&x=60&y=60&hour=10&seed=7&lang=${lang}`,
  );
  await page.waitForFunction(
    () =>
      (window as unknown as { __u5test?: { worldReady?: () => boolean } }).__u5test?.worldReady?.() ===
      true,
    undefined,
    { timeout: 30_000 },
  );
  await page.waitForSelector(".touch-controls", { timeout: 5_000 });
  await page.waitForTimeout(1200);

  const probe = await page.evaluate(() => {
    const r = (globalThis as unknown as { __u5reflow?: { probe: () => Record<string, number> } })
      .__u5reflow;
    return r ? r.probe() : null;
  });
  const canvasRect = await page.evaluate(() => {
    // 🔴 EL CANVAS PRESENTADO, NO EL DE LA FUENTE. El envoltorio partido aloja la piel fiel
    // en un host `.portrait-skin-src` de 0×0 con su canvas a resolución NATIVA aparcado en
    // (−160,−100) — o sea, un canvas de más ÁREA que el presentado en los tamaños chicos.
    // Coger «el de mayor área» lo elegía a él: en un iPhone SE apaisado la sonda daba
    // «canvas de 320 acabando en x=160 y 304 px de negro contra el raíl», que es la caja de
    // la FUENTE, no nada que se vea. Se excluye por su host y por caer fuera del viewport.
    const cs = (Array.from(document.querySelectorAll("#app canvas")) as HTMLCanvasElement[])
      .filter((el) => !el.closest(".portrait-skin-src"))
      .filter((el) => {
        const b = el.getBoundingClientRect();
        return b.right > 0 && b.bottom > 0 && b.left < window.innerWidth && b.top < window.innerHeight;
      });
    let c: HTMLCanvasElement | null = null;
    let area = 0;
    for (const el of cs) {
      const b = el.getBoundingClientRect();
      if (b.width * b.height > area) {
        area = b.width * b.height;
        c = el;
      }
    }
    if (!c) return null;
    const b = c.getBoundingClientRect();
    return { x: b.x, y: b.y, w: b.width, h: b.height, bbW: c.width, bbH: c.height };
  });

  const { sep, lineaBanda } = await medirCanvas(page);
  const deck = await medirDeck(page);
  const apaisado = await page.evaluate(() => {
    if (document.documentElement.dataset["orient"] !== "landscape") return null;
    const rail = document.querySelector(".touch-cmdwrap") as HTMLElement | null;
    if (!rail) return null;
    const rb = rail.getBoundingClientRect();
    // 🔴 EL CANVAS PRESENTADO, NO EL DE LA FUENTE. El envoltorio partido aloja la piel fiel
    // en un host `.portrait-skin-src` de 0×0 con su canvas a resolución NATIVA aparcado en
    // (−160,−100) — o sea, un canvas de más ÁREA que el presentado en los tamaños chicos.
    // Coger «el de mayor área» lo elegía a él: en un iPhone SE apaisado la sonda daba
    // «canvas de 320 acabando en x=160 y 304 px de negro contra el raíl», que es la caja de
    // la FUENTE, no nada que se vea. Se excluye por su host y por caer fuera del viewport.
    const cs = (Array.from(document.querySelectorAll("#app canvas")) as HTMLCanvasElement[])
      .filter((el) => !el.closest(".portrait-skin-src"))
      .filter((el) => {
        const b = el.getBoundingClientRect();
        return b.right > 0 && b.bottom > 0 && b.left < window.innerWidth && b.top < window.innerHeight;
      });
    let c: HTMLCanvasElement | null = null;
    let area = 0;
    for (const el of cs) {
      const b = el.getBoundingClientRect();
      if (b.width * b.height > area) {
        area = b.width * b.height;
        c = el;
      }
    }
    if (!c) return null;
    const cb = c.getBoundingClientRect();
    // El raíl B puede estar a la derecha (defecto) o a la izquierda (⇄): el hueco se mide
    // contra el borde del canvas que MIRA al raíl.
    const aLaDerecha = rb.x > cb.x;
    const hueco = aLaDerecha ? rb.x - cb.right : cb.x - rb.right;
    const r1 = (n: number): number => Math.round(n * 10) / 10;

    // ── LA DESCOMPOSICIÓN DEL HUECO QUE VE EL USUARIO ────────────────────────────────
    // Su queja es «menos distancia con el ui», y en su captura el hueco va del borde del
    // BOTÓN al MARCO AZUL del visor. Ésas son tres cosas distintas, y sólo una se arregla
    // ensanchando el raíl:
    //   (a) botón → caja del raíl : padding del raíl (y lo que el botón no llena)
    //   (b) caja del raíl → canvas: negro de layout, lo único que el ancho del raíl toca
    //   (c) canvas → cromo azul   : negro DENTRO del canvas (letterbox del compuesto)
    // Medir sólo (b) —que es lo que hacía esta sonda— da 0 y concluye «no hay hueco»
    // mientras el usuario mira 30 px de negro.
    const btn = Array.from(document.querySelectorAll(".touch-commands .touch-cmd"))
      .map((el) => el.getBoundingClientRect())
      .filter((b) => b.width > 1)[0];
    // Columna del CROMO AZUL dentro del canvas: primera (o última) columna con un píxel
    // azul, barrida por la banda central de scanlines para no depender de qué se pinta.
    let cromoX: number | null = null;
    const g = c.getContext("2d", { willReadFrequently: true });
    if (g) {
      const W = c.width;
      const H = c.height;
      const y0 = Math.floor(H * 0.35);
      const y1 = Math.floor(H * 0.65);
      const d = g.getImageData(0, y0, W, Math.max(1, y1 - y0)).data;
      const filas = Math.max(1, y1 - y0);
      const azul = (x: number): boolean => {
        for (let r = 0; r < filas; r++) {
          const i = (r * W + x) * 4;
          if (d[i + 2]! > 100 && d[i]! < 80 && d[i + 1]! < 80) return true;
        }
        return false;
      };
      if (aLaDerecha) {
        for (let x = W - 1; x >= 0; x--) {
          if (azul(x)) {
            cromoX = x;
            break;
          }
        }
      } else {
        for (let x = 0; x < W; x++) {
          if (azul(x)) {
            cromoX = x;
            break;
          }
        }
      }
    }
    // De px del backbuffer a px CSS de página.
    const cromoCss =
      cromoX === null ? null : cb.x + (cromoX / c.width) * cb.width;

    return {
      railW: r1(rb.width),
      railX: r1(rb.x),
      canvasFin: r1(aLaDerecha ? cb.right : cb.x),
      hueco: r1(hueco),
      aLaDerecha,
      botonFin: btn ? r1(aLaDerecha ? btn.x : btn.right) : null,
      // (a) + (b) + (c) = lo que el usuario ve entre su botón y el marco azul.
      // El borde del raíl que MIRA al canvas es el opuesto al que mira a la pantalla.
      botonAlRail: btn ? r1(aLaDerecha ? btn.x - rb.x : rb.right - btn.right) : null,
      railAlCanvas: r1(hueco),
      canvasAlCromo:
        cromoCss === null ? null : r1(aLaDerecha ? cb.right - cromoCss : cromoCss - cb.x),
      botonAlCromo:
        btn && cromoCss !== null ?
          r1(aLaDerecha ? btn.x - cromoCss : cromoCss - btn.right)
        : null,
    };
  });
  if (SHOTS) {
    mkdirSync(SHOTS, { recursive: true });
    await page.screenshot({ path: join(SHOTS, `${e.id}-${lang}.png`) });
  }
  const historial = await medirHistorial(page);
  if (SHOTS) {
    await page.screenshot({ path: join(SHOTS, `${e.id}-${lang}-historial.png`) });
  }

  await ctx.close();
  return {
    id: e.id,
    label: e.label,
    lang,
    w: e.w,
    h: e.h,
    mapScale: probe?.["mapScale"] ?? 0,
    bandScale: probe?.["bandScale"] ?? 0,
    canvas: canvasRect ?? { x: 0, y: 0, w: 0, h: 0, bbW: 0, bbH: 0 },
    sep,
    lineaBanda,
    historial,
    apaisado,
    ...deck,
  };
}

const N = (x: number): string => x.toLocaleString("es", { maximumFractionDigits: 1 });

function tabla(m: Medida): void {
  const o = process.stdout;
  o.write(`\n══ ${m.label} · ${m.lang} ══ mapScale ${N(m.mapScale)} · bandScale ${N(m.bandScale)}\n`);
  o.write(
    `  2 · SEPARACIÓN mapa↔banda: ${m.sep ? `${m.sep.huecoDev} px dev = ${N(m.sep.huecoCss)} px CSS (y ${m.sep.yFinMapa}→${m.sep.yIniBanda})` : "NO MEDIDA"}\n`,
  );
  o.write(
    `  3 · LÍNEA techo banda: ${
      m.lineaBanda ?
        `y=${m.lineaBanda.y} x ${m.lineaBanda.xIni}…${m.lineaBanda.xFin} de ${m.lineaBanda.anchoCanvas}` +
        (m.lineaBanda.xIni > 0 ? `  ⟵ NO llega al borde (le faltan ${m.lineaBanda.xIni} px)` : "  ✓ de borde a borde")
      : "NO MEDIDA"
    }\n`,
  );
  o.write(
    `  4 · HISTORIAL: ${
      m.historial === null ? "NO MEDIDO"
      : !m.historial.activo ? "⚠ EL MODO NO ENTRÓ (sin banner) — la medida no vale"
      : `banner y=${m.historial.yBanner} · blancas encima: ${
          m.historial.blancasEncima.length === 0 ?
            "NINGUNA ✓"
          : m.historial.blancasEncima.map((b) => `y${b.y}[${b.xIni}…${b.xFin}]`).join(" ")
        }`
    }\n`,
  );
  const alt = (bs: Boton[]): string => {
    const hs = [...new Set(bs.map((b) => b.h))].sort((a, b) => a - b);
    return hs.map(N).join("/");
  };
  o.write(
    `  5 · COLUMNAS  accesos: top ${N(m.columnas.accesos[0]?.top ?? 0)} altos ${alt(m.columnas.accesos)} (n=${m.columnas.accesos.length})\n` +
      `                acciones: top ${N(m.columnas.acciones[0]?.top ?? 0)} altos ${alt(m.columnas.acciones)} (n=${m.columnas.acciones.length})\n` +
      `                cruceta: top ${N(m.columnas.cruceta[0]?.top ?? 0)} altos ${alt(m.columnas.cruceta)} (n=${m.columnas.cruceta.length})\n`,
  );
  // Ítem 6: rótulos que NO caben en su celda (`pide > w`). En apaisado es la queja literal.
  const cizallados = m.columnas.acciones.filter((b) => b.pide > b.w + 0.5);
  o.write(
    `  1 · RÓTULOS más anchos: ${m.rotulos.map((r) => `«${r.texto}» ${N(r.pide)}`).join(" · ")}\n` +
      `  6 · CELDA de acciones ${N(m.columnas.acciones[0]?.w ?? 0)} px · DESBORDAN ${cizallados.length}/${m.columnas.acciones.length}` +
      (cizallados.length ? `: ${cizallados.map((b) => `«${b.texto}» +${N(b.pide - b.w)}`).join(" · ")}` : " ✓") +
      (m.apaisado ?
        `\n      APAISADO raíl ${N(m.apaisado.railW)} px · HUECO BOTÓN→CROMO AZUL ${m.apaisado.botonAlCromo === null ? "?" : N(m.apaisado.botonAlCromo)} px` +
        ` = padding ${m.apaisado.botonAlRail === null ? "?" : N(m.apaisado.botonAlRail)} + layout ${N(m.apaisado.railAlCanvas)} + letterbox ${m.apaisado.canvasAlCromo === null ? "?" : N(m.apaisado.canvasAlCromo)}`
      : "") +
      "\n",
  );
}

async function main(): Promise<void> {
  const browser = await chromium.launch({ headless: true });
  const out: Medida[] = [];
  for (const lang of LANGS) {
    for (const e of ESCENAS) {
      const m = await unaEscena(browser, e, lang);
      out.push(m);
      tabla(m);
    }
  }
  await browser.close();

  // EL SUELO DE COLUMNA: el máximo de lo que piden los rótulos en TODO el censo.
  let peor = { texto: "", pide: 0, donde: "" };
  for (const m of out) {
    for (const r of m.rotulos) {
      if (r.pide > peor.pide) peor = { texto: r.texto, pide: r.pide, donde: `${m.id}/${m.lang}` };
    }
  }
  process.stdout.write(
    `\n▶ SUELO DE COLUMNA derivado = ${N(peor.pide)} px — lo pide «${peor.texto}» (${peor.donde})\n`,
  );

  if (OUT) {
    writeFileSync(
      OUT,
      JSON.stringify({ base: BASE, fecha: new Date().toISOString(), suelo: peor, medidas: out }, null, 2),
    );
    process.stdout.write(`JSON → ${OUT}\n`);
  }
}

void main();
