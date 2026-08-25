/**
 * SEPARADORES BLANCOS del portrait cuadrado — dónde CAEN, no sólo que existan.
 *
 * BUG DEL USUARIO (01-08): «cuando se activa historial en portrait sale línea arriba de
 * historial». Medido en un iPhone 15 (393×852, dpr 3) antes del arreglo: la línea del
 * TECHO de la banda se pintaba en `bandTop` — o sea, sobre las 6 primeras filas de
 * dispositivo de la banda, que son 1,3 scanlines de la fuente. Sin historial esa fila es
 * la barra azul de la costura y el destrozo no se nota; CON historial es el banner
 * ►HISTORY◄ y la línea le comía el trazo superior a las letras y al remate ►.
 *
 * Lo que sella este fichero es el INVARIANTE que hace imposible la clase entera del
 * defecto: **ningún separador pisa píxel de contenido**. No hace falta que el historial
 * esté puesto para comprobarlo — de hecho es mejor que no, porque así el test no depende
 * de qué se esté pintando en esa fila.
 */
import { describe, expect, it } from "vitest";
import { PortraitSkin } from "../src/skin/portrait/skin.js";
import { squareLayout } from "../src/skin/portrait/layout-cuadrado.js";
import { MAP_BLOCK_H, lineaTechoBanda, type PortraitLayout } from "../src/skin/portrait/layout.js";
import { SEP_GAP_PX } from "../src/skin/portrait/layout-cuadrado.js";

interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** ctx de mentira que anota los `fillRect` (los separadores) y traga los `drawImage`. */
function ctxEspia(w: number, h: number): { ctx: CanvasRenderingContext2D; fills: Rect[] } {
  const fills: Rect[] = [];
  const ctx = {
    canvas: { width: w, height: h },
    fillStyle: "",
    imageSmoothingEnabled: false,
    fillRect: (x: number, y: number, rw: number, rh: number) => {
      fills.push({ x, y, w: rw, h: rh });
    },
    drawImage: () => {},
  };
  return { ctx: ctx as unknown as CanvasRenderingContext2D, fills };
}

/**
 * Corre un `present()` real y devuelve los `fillRect` que NO son el borrado del lienzo.
 * Los campos privados se siembran por índice (mismo recurso que `portrait-hosted-source`).
 * `srcCanvas` es un objeto pelado a propósito: sin `getContext`, las dos lecturas de
 * píxeles de `paintSeparators` caen por su rama segura y quedan sólo las líneas — que es
 * justo lo que este fichero mide.
 */
function separadores(L: PortraitLayout, dpr: number, scrollActive: boolean): Rect[] {
  const skin = new PortraitSkin("cuadrado");
  const priv = skin as unknown as Record<string, unknown>;
  const { ctx, fills } = ctxEspia(Math.ceil(L.canvasW * dpr), Math.ceil(L.canvasH * dpr));
  priv.ctx = ctx;
  priv.srcCanvas = {};
  priv.layout = L;
  priv.srcScale = 1;
  priv.dpr = dpr;
  priv.presentForce = true;
  priv.lastSeamActive = scrollActive;
  priv.hosted = {
    id: "espia",
    sourceFrameGen: 7,
    consoleScrollActive: scrollActive,
    panelListOpen: false,
  };
  (priv.present as () => void).call(skin);
  // El primero es el `fillRect` de borrado (lienzo entero): fuera.
  return fills.filter((f) => !(f.x === 0 && f.y === 0 && f.w === ctx.canvas.width));
}

const CENSO = [
  { name: "iPhone SE", w: 375, h: 400, dpr: 2 },
  { name: "iPhone 15", w: 393, h: 384, dpr: 3 },
  { name: "Pixel 7", w: 412, h: 420, dpr: 3 },
  { name: "iPhone 15 Pro Max", w: 430, h: 430, dpr: 3 },
];

describe("separadores del portrait — ninguno pisa contenido", () => {
  for (const d of CENSO) {
    for (const scroll of [false, true]) {
      it(`${d.name} (scrollback ${scroll ? "ON" : "off"}): la línea del techo vive en el HUECO`, () => {
        const L = squareLayout(d.w, d.h, {
          force: "reflow",
          orient: "portrait",
          consoleScrollActive: scroll,
        });
        const bandTop = Math.min(L.panes.panel.dy, L.panes.seamLog.dy) * d.dpr;
        const mapBottom = MAP_BLOCK_H * L.mapScale * d.dpr;
        const fills = separadores(L, d.dpr, scroll);
        // La línea del TECHO DE LA BANDA es la que NACE en el hueco (la otra, la del pie
        // del mapa, nace DENTRO del bloque de mapa y muere en su última scanline: ésa
        // pisa cromo del marco a propósito y no es de lo que va este fichero).
        const techo = fills.filter((f) => f.y > mapBottom - 1e-6 && f.y < bandTop + 1e-6);
        expect(techo.length, "hay línea de techo de banda").toBeGreaterThan(0);
        for (const f of techo) {
          // EL INVARIANTE: acaba en el techo de la banda, no DENTRO de ella…
          expect(f.y + f.h, "no invade la banda").toBeLessThanOrEqual(bandTop + 1e-6);
          // …y tampoco muerde el bloque de mapa por arriba: cabe en el hueco.
          expect(f.y, "no invade el bloque de mapa").toBeGreaterThanOrEqual(mapBottom - 1e-6);
          expect(f.h, "grosor visible").toBeGreaterThan(0);
        }
      });
    }
  }

  /**
   * CONTROL POSITIVO del instrumento: con el separador puesto donde estaba ANTES del
   * arreglo (dentro de la banda), el predicado de arriba tiene que ponerse ROJO. Sin
   * esto, un `paintSeparators` que dejara de pintar pasaría el test por no pintar nada.
   */
  it("control: una línea colocada como ANTES del arreglo VIOLA el invariante", () => {
    const L = squareLayout(393, 384, { force: "reflow", orient: "portrait" });
    const dpr = 3;
    const bandTop = Math.min(L.panes.panel.dy, L.panes.seamLog.dy) * dpr;
    const grosor = Math.max(1, Math.round(L.bandScale)) * dpr;
    const comoAntes = { x: 0, y: bandTop, w: 100, h: grosor };
    expect(comoAntes.y + comoAntes.h).toBeGreaterThan(bandTop + 1e-6);
    expect(grosor).toBeGreaterThan(0);
  });

  /**
   * PETICIÓN DEL USUARIO 02-08, ítem 3: «la línea encima de la lista de jugadores no llega
   * hasta el límite de la izquierda». Su ancho salía de los PANES DE CONTENIDO, y desde la
   * banda azul perimetral del 01-08 el contenido arranca tras la tira `bandLeft` — MEDIDO
   * con `tools/portrait-pulido/sonda.ts` en el canvas compuesto: x=29 de 786 (iPhone 15),
   * 30 de 824 (Pixel 7), 32 de 860 (Pro Max), 24 de 640 (SE), o sea exactamente el grosor
   * de la tira. Ahora va de borde a borde del lienzo, como la del pie del mapa.
   */
  for (const d of CENSO) {
    it(`${d.name}: la línea del techo va de BORDE A BORDE del lienzo`, () => {
      const L = squareLayout(d.w, d.h, { force: "reflow", orient: "portrait" });
      const bandTop = Math.min(L.panes.panel.dy, L.panes.seamLog.dy) * d.dpr;
      const mapBottom = MAP_BLOCK_H * L.mapScale * d.dpr;
      const ancho = Math.ceil(L.canvasW * d.dpr);
      const techo = separadores(L, d.dpr, false).filter(
        (f) => f.y > mapBottom - 1e-6 && f.y < bandTop + 1e-6,
      );
      expect(techo.length, "hay línea de techo").toBeGreaterThan(0);
      for (const f of techo) {
        expect(f.x, "arranca en el borde izquierdo").toBe(0);
        expect(f.w, "llega al borde derecho").toBe(ancho);
      }
      // CONTROL DE ALCANCE: la banda azul de la izquierda SIGUE existiendo (si alguien la
      // retirara, este test pasaría por el motivo equivocado — no habría nada que cubrir).
      expect(L.panes.bandLeft, "la tira azul izquierda sigue ahí").not.toBeNull();
      expect(L.panes.bandLeft!.dw, "…y mide más de 0").toBeGreaterThan(0);
      expect(L.panes.panel.dx, "…y el contenido sigue empezando tras ella").toBeGreaterThan(0);
    });
  }

  /**
   * DÓNDE dentro del hueco, y por qué depende del scrollback. Un solo criterio para los dos
   * casos: **la línea hace de BORDE de lo que tenga debajo, y sólo puede hacerlo si lo de
   * debajo es CROMO.** La primera scanline de la banda cambia de dueño con el historial:
   *
   *   · scrollback OFF — es cromo del original (margen azul en la columna de jugadores, filo
   *     superior de la caja de consola en la del log): la línea va PEGADA (03-08, petición
   *     del usuario: «debería ser una línea blanca como borde de la banda azul y pegada a
   *     ésta, y está separada»).
   *   · scrollback ON — es el banner ►HISTORIAL◄, o sea CONTENIDO.
   *
   * 🔴 AQUÍ HUBO DOS RAMAS Y AHORA HAY UNA (ruling del 03-08). La rama del scrollback dejaba
   * la línea CENTRADA en el hueco para no leerse como «una línea encima de HISTORIAL» (queja
   * del 02-08) — y el precio era que **la banda se quedaba SIN BORDE SUPERIOR** con el
   * historial abierto, que es lo que el usuario reportó el 03-08. El intercambio se resolvió
   * al revés: la línea va **PEGADA EN LOS DOS MODOS**, y al banner se le respeta **saltándose
   * sus columnas**, no apartando la línea.
   * Las columnas del banner se LEEN de la fuente con `opaqueColumns` —el mismo helper del
   * hueco del rótulo de vientos—, porque MEDIDO el 03-08 el banner se pinta sobre una VENTANA
   * NEGRA igual que aquél (fuente fila 80: sin historial todo blanco; con historial, negro en
   * x217…286). Eso NO se puede observar en este fichero: su `srcCanvas` es un objeto pelado a
   * propósito, así que las lecturas de píxeles caen por su rama segura. Lo cubren
   * `portrait-deck-a4` (que el hueco se lee con `opaqueColumns`) y la medición en navegador
   * (cobertura de la línea 100 % sin historial → 74 % con historial = el ancho del banner).
   *
   * Lo que estos tests SÍ sellan, y sigue siendo el invariante del 01-08: **la línea NUNCA
   * entra en la banda** — acaba EN su techo, jamás dentro.
   */
  for (const d of CENSO) {
    it(`${d.name} (scrollback off): la línea va PEGADA al techo de la banda`, () => {
      const L = squareLayout(d.w, d.h, {
        force: "reflow",
        orient: "portrait",
        consoleScrollActive: false,
      });
      const bandTop = Math.min(L.panes.panel.dy, L.panes.seamLog.dy) * d.dpr;
      const mapBottom = MAP_BLOCK_H * L.mapScale * d.dpr;
      const techo = separadores(L, d.dpr, false).filter(
        (f) => f.y > mapBottom - 1e-6 && f.y < bandTop + 1e-6,
      );
      expect(techo.length).toBeGreaterThan(0);
      for (const f of techo) {
        // PEGADA: acaba EXACTAMENTE en el techo de la banda, sin negro entre medias…
        expect(f.y + f.h, "sin negro entre la línea y la banda").toBeCloseTo(bandTop, 6);
        // …y el hueco NO se lo come: todo el negro se va ARRIBA, contra el bloque de mapa,
        // que es la separación que el usuario pidió el 02-08 y que este cambio conserva.
        expect(f.y - mapBottom, "el negro del hueco queda ARRIBA").toBeGreaterThan(f.h);
      }
    });

    it(`${d.name} (scrollback ON): la línea acaba EN el techo, nunca DENTRO de la banda`, () => {
      const L = squareLayout(d.w, d.h, {
        force: "reflow",
        orient: "portrait",
        consoleScrollActive: true,
      });
      const bandTop = Math.min(L.panes.panel.dy, L.panes.seamLog.dy) * d.dpr;
      const mapBottom = MAP_BLOCK_H * L.mapScale * d.dpr;
      const techo = separadores(L, d.dpr, true).filter(
        (f) => f.y > mapBottom - 1e-6 && f.y < bandTop + 1e-6,
      );
      expect(techo.length).toBeGreaterThan(0);
      for (const f of techo) {
        // PEGADA también con historial (ruling 03-08): acaba EXACTAMENTE en el techo…
        expect(f.y + f.h, "sin negro entre la línea y la banda").toBeCloseTo(bandTop, 6);
        // …y NUNCA dentro, que es el invariante del 01-08 y lo único que no se deroga:
        // si `f.y + f.h` pasara de `bandTop`, la línea se comería el trazo del banner.
        expect(f.y + f.h, "la línea NO entra en la banda").toBeLessThanOrEqual(bandTop + 1e-6);
        expect(f.y, "y no invade el bloque de mapa por arriba").toBeGreaterThan(mapBottom + 1e-6);
      }
    });
  }

  /**
   * 🔴 CONTROL INVERTIDO POR EL RULING DEL 03-08. Antes exigía que las dos ramas fueran
   * DISTINTAS (era el control de que el scrollback se consultaba de verdad). Ahora exige lo
   * contrario —**que sean la MISMA**— porque el modo dejó de gobernar la posición: la línea
   * va pegada siempre y quien decide el hueco del banner es la FUENTE, no una bandera.
   * Este control es el que se pone rojo si alguien repone `holgura`.
   */
  for (const d of CENSO) {
    it(`${d.name}: abrir el historial NO mueve la línea (una sola rama)`, () => {
      const yDe = (scroll: boolean): number => {
        const L = squareLayout(d.w, d.h, {
          force: "reflow",
          orient: "portrait",
          consoleScrollActive: scroll,
        });
        const bandTop = Math.min(L.panes.panel.dy, L.panes.seamLog.dy) * d.dpr;
        const mapBottom = MAP_BLOCK_H * L.mapScale * d.dpr;
        const techo = separadores(L, d.dpr, scroll).filter(
          (f) => f.y > mapBottom - 1e-6 && f.y < bandTop + 1e-6,
        );
        expect(techo.length).toBe(1);
        return techo[0]!.y;
      };
      expect(yDe(true), "la línea se movió al abrir el historial: ¿ha vuelto `holgura`?").toBe(
        yDe(false),
      );
    });
  }

  /**
   * EL HUECO, ítem 2: «en portrait separaría un poco más el ui de arriba del bloque de
   * jugadores y logs». `SEP_GAP_PX` pasó de 2 a 6 px de JUEGO. El número se nombra aquí
   * porque es el que hace posibles los ítems de arriba: con 2, el hueco medía 4,1 px CSS en
   * un iPhone 15 y las dos líneas se comían 3 — no había sitio ni para dejar negro a los dos
   * lados de la línea (rama del scrollback) ni para que, al pegarla al techo de la banda
   * (03-08), el negro que se va arriba siga separando de verdad los dos bloques.
   */
  it("el hueco de separación son 5 px de juego, y da para línea + negro a los dos lados", () => {
    // 2 (original) → 6 el 02-08 («separaría un poco más el ui de arriba del bloque de
    // jugadores y logs») → 5 el 03-08 («redúcela también un pelín»). El número se fija aquí
    // porque es una PETICIÓN, no una derivación: el suelo geométrico está en 2 —medido: el
    // dispositivo que ata es el Pixel 7, que necesita 1,24— y NO se baja hasta ahí porque
    // eso desharía la petición del 02-08. Si alguien lo mueve, que sea por otra petición.
    expect(SEP_GAP_PX, "5 px de juego (2 → 6 el 02-08 → 5 el 03-08)").toBe(5);
    // Y menos de una fila de texto del original: el hueco no llega a valer un renglón.
    expect(SEP_GAP_PX).toBeLessThan(8);
  });

  /**
   * 🔴 EL SUELO GEOMÉTRICO, SEPARADO DEL VALOR FIJADO — y la separación es el arreglo.
   *
   * Antes, la comprobación de que el hueco da para «línea + 1 px de negro por lado» vivía
   * DETRÁS de `expect(SEP_GAP_PX).toBe(...)`, en el mismo `it`. Consecuencia: bajar
   * `SEP_GAP_PX` para tantear el suelo hacía fallar el `toBe` PRIMERO, y la comprobación
   * geométrica —la que de verdad dice dónde está el límite— **no llegaba a ejecutarse**.
   * O sea que el suelo no se podía medir sin editar el test. Es
   * `asercion-temprana-mata-las-de-detras`, y me pasó al intentar verificar el suelo: con el
   * filtro puesto, `SEP_GAP_PX = 1` salía VERDE porque corría el otro `it`, más flojo.
   *
   * Ahora la propiedad se prueba SOBRE UN PARÁMETRO, no sobre la constante: así el suelo se
   * puede localizar sin tocar nada.
   */
  // ⚠ NO se le añade un `sepGapPx` a `squareLayout` sólo para poder testear: sería cambiar
  // producción por comodidad del test. Se calcula el hueco con el MODELO —el hueco son
  // `SEP_GAP_PX` px de juego escalados por `mapScale`— y **el modelo se VALIDA primero**
  // contra el layout real al valor vigente. Sin esa validación estaríamos probando mi
  // aritmética, no el reparto.
  const medidas = (d: (typeof CENSO)[number]) => {
    const L = squareLayout(d.w, d.h, { force: "reflow", orient: "portrait" });
    const huecoReal =
      (Math.min(L.panes.panel.dy, L.panes.seamLog.dy) - MAP_BLOCK_H * L.mapScale) * d.dpr;
    const grosor = Math.max(1, Math.round(L.bandScale)) * d.dpr;
    return { porPx: L.mapScale * d.dpr, huecoReal, grosor };
  };
  const huecoDa = (gap: number, d: (typeof CENSO)[number]): boolean => {
    const { porPx, grosor } = medidas(d);
    return gap * porPx > grosor + 2;
  };

  it("el valor VIGENTE cumple la condición del hueco en todo el censo", () => {
    for (const d of CENSO) {
      const L = squareLayout(d.w, d.h, { force: "reflow", orient: "portrait" });
      const hueco =
        (Math.min(L.panes.panel.dy, L.panes.seamLog.dy) - MAP_BLOCK_H * L.mapScale) * d.dpr;
      const grosor = Math.max(1, Math.round(L.bandScale)) * d.dpr;
      // Línea + al menos 1 px de negro por cada lado.
      expect(hueco, `${d.name}`).toBeGreaterThan(grosor + 2);
    }
  });

  it("el MODELO del hueco casa con el layout real (si no, lo de abajo no prueba nada)", () => {
    for (const d of CENSO) {
      const { porPx, huecoReal } = medidas(d);
      expect(SEP_GAP_PX * porPx, `${d.name}: el modelo no reproduce el hueco real`).toBeCloseTo(
        huecoReal,
        6,
      );
    }
  });

  it("★ y el SUELO está en 2: a 1 la línea pierde su hueco (y se nombra dónde)", () => {
    // Localizado sobre el parámetro, sin tocar la constante. Esto es lo que convierte
    // «cabría bajarlo» en un número con su geometría al lado.
    for (const d of CENSO) {
      expect(huecoDa(2, d), `a SEP_GAP_PX=2 el hueco debería bastar en ${d.name}`).toBe(true);
    }
    const rompen = CENSO.filter((d) => !huecoDa(1, d)).map((d) => d.name);
    expect(rompen.length, "a SEP_GAP_PX=1 alguien tiene que perder el hueco").toBeGreaterThan(0);
    // Y se NOMBRA, para que el próximo que quiera bajarlo sepa contra qué choca.
    expect(rompen).toContain("Pixel 7");
  });

  /** Y el hueco existe de verdad: si `SEP_GAP_PX` cayera a 0, la línea no cabría. */
  it("el hueco de separación da para el grosor de la línea en todo el censo", () => {
    for (const d of CENSO) {
      const L = squareLayout(d.w, d.h, { force: "reflow", orient: "portrait" });
      const hueco = (Math.min(L.panes.panel.dy, L.panes.seamLog.dy) - MAP_BLOCK_H * L.mapScale) * d.dpr;
      expect(hueco, `${d.name}`).toBeGreaterThanOrEqual(Math.max(1, Math.round(L.bandScale)) * d.dpr);
    }
  });
});

/**
 * #379 (24-08) — «doble línea junto al rótulo HISTORIAL». Con el historial abierto la
 * cinta del banner trae SU regla superior (#246) y el separador iba pegado POR FUERA
 * (ruling 03-08): apilados, la línea del techo salía con grosor DOBLE sobre la columna
 * del log y sencillo sobre la del panel — el escalón de la captura del usuario. La regla
 * nueva es la del pie del mapa con Winds: con banner, la línea SE SUPERPONE a la regla
 * de la cinta (misma scanline, mismo grosor bliteado); sin banner, todo sigue igual.
 */
describe("#379 — la línea del techo con banner se superpone a la regla, no se apila", () => {
  it("con banner: misma scanline y grosor que la regla de la cinta; sin banner: por fuera", () => {
    for (const d of CENSO) {
      const L = squareLayout(d.w, d.h, {
        force: "reflow",
        orient: "portrait",
        consoleScrollActive: true,
      });
      const k = d.dpr;
      const techo = Math.min(L.panes.panel.dy, L.panes.seamLog.dy) * k;
      const scanline = (L.panes.seamLog.dh / L.panes.seamLog.sh) * k;

      const con = lineaTechoBanda(L.panes, L.bandScale, k, true)!;
      expect(con, d.name).not.toBeNull();
      // DENTRO, sobre la primera scanline de la banda = la regla de la cinta, entera.
      expect(con.y, `${d.name} con banner: en el techo`).toBeCloseTo(techo, 6);
      expect(con.h, `${d.name} con banner: el grosor de la regla`).toBeCloseTo(scanline, 6);

      const sin = lineaTechoBanda(L.panes, L.bandScale, k, false)!;
      expect(sin, d.name).not.toBeNull();
      // POR FUERA, acabando EN el techo (ruling 03-08, intacto donde se dictó).
      expect(sin.y + sin.h, `${d.name} sin banner: acaba en el techo`).toBeCloseTo(techo, 6);
      expect(sin.h, `${d.name} sin banner: grosor redondeado`).toBeCloseTo(
        Math.max(1, Math.round(L.bandScale)) * k,
        6,
      );

      // MUTANTE del defecto: el apilado de antes (separador fuera + regla dentro) daba
      // grosor separador+regla a partir de `techo − grosor`; la geometría nueva NO
      // reproduce ese intervalo.
      expect(con.y, `${d.name} ya no arranca fuera`).not.toBeCloseTo(sin.y, 6);
    }
  });

  it("sin hueco de separación (composición apaisada) no hay línea", () => {
    const L = squareLayout(844, 390, { force: "reflow", orient: "landscape" });
    expect(lineaTechoBanda(L.panes, L.bandScale, 3, true)).toBeNull();
    expect(lineaTechoBanda(L.panes, L.bandScale, 3, false)).toBeNull();
  });
});
