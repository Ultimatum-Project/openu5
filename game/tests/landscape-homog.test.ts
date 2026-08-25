/**
 * APAISADO HOMOGÉNEO — carril `landscape-homog`. Dos encargos distintos, un fichero.
 *
 * (1) LA DIRECTRIZ DEL USUARIO (01-08 noche): ESC/ENT/SPC van al pad «COMO EN PORTRAIT»,
 *     por homogeneidad entre orientaciones. La columna de menús y la de tipos de teclado se
 *     quedan como las dejó el rediseño.
 * (2) LA OBLIGACIÓN HEREDADA (`re/notes/mobile-fixes-0108-acta.md` §1-ter): los raíles del
 *     rediseño llevan el MISMO defecto de la muesca que ya se arregló en `main`.
 *
 * POR QUÉ LOS ASERTOS DE (1) SON COMPARATIVOS Y NO LITERALES. «Como en portrait» es una
 * relación, no una posición: fijar aquí `spc en la columna 1` sellaría una COINCIDENCIA —
 * el día que el vertical mueva sus celdas, este fichero seguiría verde y las dos
 * orientaciones habrían divergido en silencio, que es exactamente lo que la directriz
 * prohíbe. Así que se EXTRAEN las celdas de los dos layouts y se comparan entre sí: el
 * trinquete es la homogeneidad, no el número. (Cuál es hoy ese número se deja escrito en el
 * acta, medido en navegador.)
 *
 * Y POR QUÉ (2) SE MIRA EN EL TEXTO DEL CSS pese a que el acta avisa de que un test de texto
 * puede llevar meses verde sobre una clase que nadie pone: aquí lo que se sella es que la
 * franja pase por las VARIABLES y no por `env()`, que es una propiedad del texto y no del
 * DOM. La geometría que resulta —que la cruz conserve sus 140 px y quede a 6 px del borde
 * interior con franja 59— NO se finge aquí: se midió en navegador con
 * `tools/mobile-fixes/medir-railes.ts` y las nueve escenas están en el acta.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { layoutOriginalCss, layoutApaisadoCss } from "../src/skin/portrait/deck-ancho.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const DOM_TS = readFileSync(join(HERE, "../src/skin/portrait/deck-dom.ts"), "utf8");

const ORIG = layoutOriginalCss();
const LAND = layoutApaisadoCss();

/**
 * Cuerpo de la regla cuyo selector termina en `.<clase>`, distinguiendo la BASE del ESPEJO
 * del ⇄ (`[data-pad-side="right"]`). Hace falta partir el CSS en reglas porque un `toMatch`
 * sobre el fichero entero no puede decir CUÁL de las dos lo satisfizo — y una de ellas
 * conserva la forma correcta aunque la otra se rompa (mutante M5, que así sobrevivía).
 */
function reglaDe(css: string, clase: string, espejo: boolean): string | null {
  for (const bloque of css.split("}")) {
    const i = bloque.indexOf("{");
    if (i < 0) continue;
    const selector = bloque.slice(0, i).replace(/\/\*[\s\S]*?\*\//g, "").trim();
    if (!selector.endsWith(`.${clase}`)) continue;
    if (selector.includes('data-pad-side="right"') !== espejo) continue;
    return bloque.slice(i + 1);
  }
  return null;
}

/** Celdas de las tres teclas mudadas, tal como las declara un bloque de CSS. */
function celdasDelPad(css: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const tecla of ["spc", "ent", "esc"]) {
    const m = new RegExp(
      `\\.u5padkey-${tecla}\\s*\\{\\s*grid-column:\\s*(\\d+);\\s*grid-row:\\s*(\\d+);`,
    ).exec(css);
    if (m) out[tecla] = `${m[1]},${m[2]}`;
  }
  return out;
}

describe("directriz del usuario · ESC/ENT/SPC en el pad, IGUAL que en vertical", () => {
  it("las tres teclas tienen celda declarada en los DOS layouts", () => {
    // Control de que el extractor no está midiendo el vacío: sin esto, un cambio de formato
    // en el CSS daría dos diccionarios VACÍOS y el test de abajo pasaría por igualdad
    // trivial — verde sin haber comparado nada.
    expect(Object.keys(celdasDelPad(ORIG)).sort()).toEqual(["ent", "esc", "spc"]);
    expect(Object.keys(celdasDelPad(LAND)).sort()).toEqual(["ent", "esc", "spc"]);
  });

  it("★ y ocupan LAS MISMAS celdas relativas en apaisado que en vertical", () => {
    // ESTE es el aserto de la directriz. Si alguien mueve una tecla en un layout y no en el
    // otro, aquí se ve — que es la definición operativa de «homogeneidad entre
    // orientaciones» que pidió el usuario.
    expect(celdasDelPad(LAND)).toEqual(celdasDelPad(ORIG));
  });

  it("…y la cruz apaisada es 3×3: las teclas van EN las celdas libres, no en una fila aparte", () => {
    // ~~Cuatro filas: la de teclas + las tres de la cruz. Con tres, las teclas se colarían
    // encima de las flechas.~~ — RE-APUNTADO (carril portrait-paridad). El «se colarían
    // encima de las flechas» era cierto MIENTRAS las tres teclas vivían en la fila 1 con la
    // cruz debajo; hoy ocupan las celdas LIBRES de una cruz 3×3 (spc ↖, esc ↗, ent centro),
    // que es la forma que el aserto comparativo de arriba acaba de propagar desde el
    // vertical, y que el propio docblock de `layoutApaisadoCss` ya pedía («ENT/SPC/ESC en
    // sus CELDAS LIBRES»). Con 3×3 no hay colisión POR CONSTRUCCIÓN: cada tecla y cada
    // flecha declara su casilla y son seis casillas distintas de las nueve.
    expect(LAND).toMatch(/grid-template-rows:\s*repeat\(3, var\(--u5pad-cell\)\)/);
    expect(LAND, "la fila de teclas aparte se retiró").not.toMatch(
      /grid-template-rows:\s*repeat\(4, var\(--u5pad-cell\)\)/,
    );
    // NO-COLISIÓN explícita: las 7 piezas (3 teclas + 4 flechas) ocupan 7 casillas DISTINTAS.
    const celdas = [
      ...LAND.matchAll(/\.(u5padkey-\w+|dpad-\w+)\s*\{\s*grid-column:\s*(\d+);\s*grid-row:\s*(\d+);/g),
    ].map((m) => `${m[2]},${m[3]}`);
    expect(celdas.length, "las 7 piezas de la cruz apaisada declaran casilla").toBe(7);
    expect(new Set(celdas).size, "y no hay dos en la misma casilla").toBe(7);
  });

  it("la mudanza al pad ya no depende de la orientación (la hace `deck-dom.ts` siempre)", () => {
    // El CSS puede dar celda a una clase que nadie pone: el acta `mobile-fixes-0108` §3b
    // documenta un test verde durante meses por justo eso. Aquí se exige además que la
    // rama de código que MUDA no tenga guarda de orientación.
    expect(DOM_TS).not.toMatch(/if \(root\.dataset\.orient === "landscape"\)/);
    expect(DOM_TS).toMatch(/ensureSheetActivator\([\s\S]{0,900}?\n\s*mudar\(\);/);
  });
});

describe("obligación heredada §1-ter · la muesca, en los DOS raíles", () => {
  it("★ la franja se SUMA AL ANCHO del raíl (no se le resta por dentro)", () => {
    // El bug: con `box-sizing:border-box` (index.html:24) meter el inset como padding no
    // ensancha el raíl, lo VACÍA — 152 px menos 59 de franja dejan 93 para una cruz que
    // pide 140. Sumado al `var`, el raíl crece y lo paga el hueco central.
    expect(LAND).toMatch(/--u5rail-a:\s*calc\(152px \+ var\(--u5rail-safe-a\)\)/);
    // 110 desde el 02-08: «Nuevo orden» (94 px de contenido + 4 de borde) heredó el papel
    // de rótulo más ancho al quitarle el pictograma a «Antorcha». Ver la cabecera de
    // `layoutApaisadoCss` y la re-derivación con `tools/portrait-pulido/sonda.ts`.
    expect(LAND).toMatch(/--u5rail-b:\s*calc\(110px \+ var\(--u5rail-safe-b\)\)/);
  });

  it("★ la franja entra por las VARIABLES `--u5-safe-*`, nunca por `env()` suelto", () => {
    // No es estilo: Chromium da `env(safe-area-inset-*)` SIEMPRE 0, así que un `env()` aquí
    // vuelve el defecto INOBSERVABLE en el arnés — que es cómo sobrevivió en `main` hasta el
    // 01-08. Por la variable, la sonda la sobreescribe y recalcula la cascada REAL.
    expect(LAND).toMatch(/--u5rail-safe-a:\s*var\(--u5-safe-l/);
    expect(LAND).toMatch(/--u5rail-safe-b:\s*var\(--u5-safe-r/);
    expect(LAND).not.toMatch(/env\(safe-area-inset-(left|right)/);
  });

  it("★ el ⇄ intercambia también DE QUÉ BORDE es la franja, no sólo los raíles", () => {
    // Con el deck a la derecha, el raíl A pasa a la columna 3: su franja exterior deja de
    // ser la izquierda. Un fix cableado a `-left` se cae justo aquí (escena medida
    // `ls-852x330-safe59-right`).
    expect(LAND).toMatch(
      /data-pad-side="right"\]\s*\{\s*--u5rail-safe-a:\s*var\(--u5-safe-r[\s\S]{0,120}--u5rail-safe-b:\s*var\(--u5-safe-l/,
    );
  });

  it("★ el relleno de la franja va SÓLO por el borde exterior, en los tres elementos", () => {
    // El atajo de dos valores (`padding: 0 X`) lo ponía en LOS DOS bordes: el interior, donde
    // no hay muesca, pagaba igual. Se exige la forma de CUATRO valores.
    //
    // ⚠ Este aserto se escribió primero con un `toMatch` sobre `.touch-util\s*\{…padding:` y
    // el mutante «vuelve al atajo de 2 valores» LO SOBREVIVÍA: el patrón también casa con la
    // regla ESPEJO (`[data-pad-side="right"] .touch-util`), que conserva la forma larga, así
    // que el verde lo daba una regla distinta de la mutada. Por eso ahora se parte el CSS en
    // reglas y se pregunta a la BASE y al ESPEJO por separado.
    // Cada elemento va atado a la franja DE SU RAÍL: `.touch-util` y `.touch-dpad` viven en
    // el A, `.touch-cmdwrap` en el B. Aceptar `-[ab]` indistintamente dejaba pasar el
    // mutante «el raíl B usa la franja del A», que en un teléfono con muesca a un solo lado
    // rellena el borde equivocado — el raíl B se comería 59 px que no le tocan y el A
    // ninguno.
    for (const [sel, rail] of [
      ["touch-util", "a"],
      ["touch-dpad", "a"],
      ["touch-cmdwrap", "b"],
    ] as const) {
      const base = reglaDe(LAND, sel, false);
      const espejo = reglaDe(LAND, sel, true);
      expect(base, `no existe la regla base de .${sel}`).not.toBeNull();
      expect(espejo, `.${sel} no tiene espejo para el ⇄`).not.toBeNull();
      // Cuatro valores, con la franja DE SU RAÍL en UNO solo de los dos lados…
      const uno = new RegExp(
        `padding:\\s*0 (6px 0 calc\\(6px \\+ var\\(--u5rail-safe-${rail}\\)\\)|calc\\(6px \\+ var\\(--u5rail-safe-${rail}\\)\\) 0 6px)`,
      );
      expect(base!, `.${sel} base no reparte la franja del raíl ${rail} por un solo borde`).toMatch(uno);
      expect(espejo!, `.${sel} espejo no usa la franja del raíl ${rail}`).toMatch(uno);
      // …y el espejo con la franja en el lado CONTRARIO al de la base.
      const ladoBase = /padding:\s*0 6px/.test(base!) ? "izquierda" : "derecha";
      const ladoEspejo = /padding:\s*0 6px/.test(espejo!) ? "izquierda" : "derecha";
      expect(ladoEspejo, `.${sel}: el ⇄ deja la franja del mismo lado`).not.toBe(ladoBase);
    }
  });

  it("la cruz TAMBIÉN lleva el relleno (si no, `justify-self:center` la mete en la muesca)", () => {
    // `.touch-dpad` se centra en su columna; al ensancharse la columna con la franja, la
    // cruz se iría franja/2 hacia AFUERA — con 59 px quedaría a 35,5 del borde, dentro de la
    // muesca. Medido tras el arreglo: 65 px al borde con franja 59, o sea 6 + 59.
    const base = reglaDe(LAND, "touch-dpad", false);
    expect(base).toMatch(/justify-self:\s*center/);
    expect(base).toMatch(/padding:\s*0 6px 0 calc\(6px \+ var\(--u5rail-safe-a\)\)/);
  });
});

describe("colisión que destapó el merge · el ⛶ dejó de ser glifo solo", () => {
  it("★ el ⛶ ocupa la FILA ENTERA del raíl A (su rótulo no cabe en media)", () => {
    // El GO del portrait le puso rótulo («⛶ Pantalla»); el raíl se diseñó cuando era un
    // glifo suelto y su celda de 68 px lo CIZALLABA — medido «Pantall» en 852×330. Es una
    // sola palabra: `white-space: normal` no lo salva. Con la fila entera (136 px) cabe.
    expect(LAND).toMatch(/\.touch-util \.touch-fullscreen\s*\{[^}]*grid-column:\s*1 \/ -1/);
  });
});
