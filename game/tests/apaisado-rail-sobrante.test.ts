// @vitest-environment jsdom
/**
 * EL RAÍL B SE COME EL SOBRANTE DEL APAISADO (petición 6b del usuario, 02-08):
 * «los botones de accion pueden ser un poco mas anchos y menos distancia con el ui, es
 * decir que ocupen mas ancho».
 *
 * ── QUÉ DEFECTO SELLA ──────────────────────────────────────────────────────────────────
 * En apaisado el mapa escala a `min((W − banda)/FRAME_W, H/MAP_BLOCK_H)`. CON LA BARRA DEL
 * NAVEGADOR —el caso normal en un teléfono, y el de la captura del usuario— manda el ALTO:
 * el canvas sale MÁS ESTRECHO que el hueco central y el `justify-content:flex-start` del
 * 01-08 (el que pega mapa y cruceta) acumula TODO el sobrante del lado del raíl B.
 *
 * 🔴 POR QUÉ ESTE FICHERO EXISTE Y NO BASTABA CON LAS ESCENAS DE ANTES. Las escenas
 * apaisadas del censo usaban el ALTO COMPLETO (852×393, 915×412), y ahí manda el ANCHO: el
 * canvas llena el hueco central y el sobrante es **0 POR CONSTRUCCIÓN**. O sea que el
 * defecto se midió justo donde no puede existir, y el informe dijo «0 px de hueco» sobre
 * los 30-60 px que el usuario estaba mirando. Los tres escenarios de abajo llevan barra.
 *
 * ── LA MECÁNICA, Y POR QUÉ NO HAY BUCLE ────────────────────────────────────────────────
 * Lo que crece es la COLUMNA VISIBLE del deck (`--u5rail-b-vis`), no la RESERVA que `#app`
 * le da al mapa (ésa sigue siendo `--u5rail-b` a secas). El canvas no se mueve ni encoge
 * ⇒ el sobrante no se re-genera ⇒ no hay realimentación. El test de abajo ATA esa asimetría
 * (`#app` con `-b`, la rejilla con `-b-vis`): es lo único que separa este fix de un bucle.
 *
 * ── LAS CIFRAS SON MEDIDAS, NO RAZONADAS ───────────────────────────────────────────────
 * `game/tools/portrait-pulido/sonda.ts` sobre el código vivo (Chromium, `isMobile`, DPR 2),
 * carriles ANTES = `main` y DESPUÉS = este fix:
 *
 *   escena                    hueco    raíl B      botón     botón→cromo azul
 *   852×330 iPhone 15 barra   590×330  110 → 140    98 → 128   36,9 → 6,9
 *   915×360 Pixel 7   barra   653×360  110 → 152    98 → 140   49   → 7
 *   932×360 Pro Max   barra   670×360  110 → 169    98 → 157   66   → 7
 *   852×393 iPhone 15 SIN barra        110 → 110    98 →  98    6,5 →  6,5   (sobrante 0)
 *
 * y en las TRES el `mapScale` y el ancho del canvas salen IDÉNTICOS antes y después: el
 * mapa no paga nada. De las 20 escenas del censo (10 tamaños × 2 idiomas) se mueven
 * exactamente 6 —las tres con barra en los dos idiomas— y sólo en el ancho del botón.
 */
import { describe, it, expect } from "vitest";
import { layoutApaisadoCss } from "../src/skin/portrait/deck-ancho.js";
import { PortraitSkin } from "../src/skin/portrait/skin.js";

const LAND = layoutApaisadoCss();

// ── EVALUADOR DEL `calc` ────────────────────────────────────────────────────────────────
// 🔴 NO SE RE-ESCRIBE LA FÓRMULA AQUÍ: se lee la que se ENVÍA y se evalúa. Un test que
// declarase `extra = W − 152 − 110 − canvas` sería circular respecto a sí mismo y verde
// con cualquier CSS. Éste parsea el `--u5rail-b-vis` del string publicado, resuelve los
// `var()` con sus propias declaraciones (o con el fallback, que es justo lo que se quiere
// probar) y hace la aritmética. Si alguien cambia el CSS, cambia el número.

/** Declaraciones `--x: valor;` del PRIMER bloque (el `html…[data-orient=landscape]` base). */
function declaraciones(css: string): Map<string, string> {
  const bloque = css.slice(css.indexOf("{") + 1, css.indexOf("}"));
  const out = new Map<string, string>();
  for (const m of bloque.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)) {
    if (!out.has(m[1]!)) out.set(m[1]!, m[2]!.trim());
  }
  return out;
}

/** Sustituye `var(--x[, fallback])` hasta punto fijo. `env` con valor `null` = propiedad
 *  NO PUBLICADA ⇒ se usa el fallback, que es el contrato de CSS y el de la guarda. */
function expandir(expr: string, decls: Map<string, string>, env: Map<string, string | null>): string {
  for (let vuelta = 0; vuelta < 20; vuelta++) {
    const i = expr.indexOf("var(");
    if (i < 0) return expr;
    let prof = 0;
    let j = i + 3;
    for (; j < expr.length; j++) {
      if (expr[j] === "(") prof++;
      else if (expr[j] === ")" && --prof === 0) break;
    }
    const dentro = expr.slice(i + 4, j);
    const coma = dentro.indexOf(",");
    const nombre = (coma < 0 ? dentro : dentro.slice(0, coma)).trim();
    const fallback = coma < 0 ? null : dentro.slice(coma + 1).trim();
    let valor: string | null;
    if (env.has(nombre)) valor = env.get(nombre)!;
    else valor = decls.get(nombre) ?? null;
    if (valor === null) {
      if (fallback === null) throw new Error(`var(${nombre}) sin valor ni fallback`);
      valor = fallback;
    }
    expr = expr.slice(0, i) + `(${valor})` + expr.slice(j + 1);
  }
  throw new Error("var() no converge");
}

/** Evalúa longitudes en px. `100vw` se convierte con el ancho de viewport dado. */
function evaluar(expr: string, vw: number): number {
  const src = expr.replace(/\bcalc\b/g, "").replace(/\s+/g, " ");
  let p = 0;
  const saltar = (): void => {
    while (p < src.length && src[p] === " ") p++;
  };
  const primario = (): number => {
    saltar();
    for (const fn of ["max", "min"] as const) {
      if (src.startsWith(fn + "(", p)) {
        p += fn.length + 1;
        const args: number[] = [suma()];
        saltar();
        while (src[p] === ",") {
          p++;
          args.push(suma());
          saltar();
        }
        if (src[p] !== ")") throw new Error(`falta ) en ${fn} @${p}`);
        p++;
        return fn === "max" ? Math.max(...args) : Math.min(...args);
      }
    }
    if (src[p] === "(") {
      p++;
      const v = suma();
      saltar();
      if (src[p] !== ")") throw new Error(`falta ) @${p}`);
      p++;
      return v;
    }
    if (src[p] === "-") {
      p++;
      return -primario();
    }
    const m = /^-?\d+(?:\.\d+)?(px|vw)?/.exec(src.slice(p));
    if (!m) throw new Error(`token inesperado @${p}: ${src.slice(p, p + 20)}`);
    p += m[0].length;
    const n = parseFloat(m[0]);
    return m[1] === "vw" ? (n * vw) / 100 : n;
  };
  const suma = (): number => {
    let v = primario();
    for (;;) {
      saltar();
      if (src[p] === "+" || src[p] === "-") {
        const op = src[p]!;
        p++;
        const r = primario();
        v = op === "+" ? v + r : v - r;
      } else return v;
    }
  };
  const v = suma();
  saltar();
  if (p !== src.length) throw new Error(`sobra «${src.slice(p)}»`);
  return v;
}

const DECLS = declaraciones(LAND);

/** Ancho VISIBLE del raíl B para un viewport y un `--u5-canvas-w` publicado (o `null`). */
function railVisible(vw: number, canvasW: number | null): number {
  const env = new Map<string, string | null>([
    ["--u5-safe-l", null],
    ["--u5-safe-r", null],
    ["--u5-canvas-w", canvasW === null ? null : `${canvasW}px`],
  ]);
  return evaluar(expandir(DECLS.get("--u5rail-b-vis")!, DECLS, env), vw);
}

describe("apaisado · el raíl B se come el sobrante — LA ARITMÉTICA DEL CSS ENVIADO", () => {
  it("el evaluador reproduce el ancho BASE del raíl (control: si esto falla, no vale nada)", () => {
    // 110 = 98 de lista + 2×6 de padding (`landscape-homog.test.ts` ata el literal).
    // Sin sobrante que comer, `-b-vis` DEBE ser exactamente `-b`.
    expect(railVisible(852, 590)).toBe(110);
  });

  it("★ LAS TRES ESCENAS CON BARRA — el raíl crece hasta tocar el canvas (MEDIDO)", () => {
    // El `--u5-canvas-w` es el que publica la piel (`ceil` del ancho del canvas) y el ancho
    // resultante del raíl es el que la sonda leyó en el navegador. Los tres pares vienen de
    // `docs/verdicts/portrait-pulido/rail-despues.json`.
    expect(railVisible(852, 560)).toBe(140); // iPhone 15  852×330 — botón 98 → 128
    expect(railVisible(915, 611)).toBe(152); // Pixel 7    915×360 — botón 98 → 140
    expect(railVisible(932, 611)).toBe(169); // Pro Max    932×360 — botón 98 → 157
  });

  it("★ LA GUARDA, que es el CAMINO PRINCIPAL: sin publicar, el raíl se queda en su BASE", () => {
    // `syncReserve` corre varias veces ANTES de que el canvas exista, así que «la piel no ha
    // publicado nada» NO es un borde: es el estado de arranque. El fallback `100vw` hace el
    // `calc` negativo y el `max(0px, …)` lo acota a 0 ⇒ ancho base. Ni 0 ni valor inválido.
    for (const vw of [852, 915, 932, 568, 320]) {
      expect(railVisible(vw, null)).toBe(110);
    }
  });

  it("★ y NUNCA encoge: con un canvas MÁS ANCHO que el hueco, el `max(0px, …)` acota", () => {
    // Un canvas más ancho que el hueco central no debería ocurrir, pero si ocurriera el
    // `calc` sería negativo y sin el `max` el raíl se quedaría por DEBAJO de su base — o
    // sea, rótulos cizallados. Es el segundo cerrojo de la misma guarda.
    expect(railVisible(852, 900)).toBe(110);
    expect(railVisible(852, 5000)).toBe(110);
  });

  it("el sobrante se mide contra el HUECO CENTRAL (los dos raíles descontados), no contra 100vw", () => {
    // Si la fórmula olvidara un raíl, el extra saldría 152 (o 110) px más grande. Con el
    // canvas llenando el hueco entero (852 − 152 − 110 = 590) el extra tiene que ser 0.
    expect(railVisible(852, 590)).toBe(110);
    expect(railVisible(852, 589)).toBe(111);
  });
});

describe("apaisado · 🔴 LA ASIMETRÍA QUE EVITA EL BUCLE", () => {
  it("★ `#app` reserva `--u5rail-b` A SECAS — si reservara el visible, habría realimentación", () => {
    // Bucle: raíl crece → hueco central encoge → canvas encoge → sobrante nuevo → raíl crece…
    // Lo único que lo impide es que la RESERVA no lea la variable que crece.
    const reservas = LAND.match(/#app\s*\{[^}]*\}/g) ?? [];
    expect(reservas.length).toBeGreaterThanOrEqual(2); // el normal y el del espejo ⇄
    for (const r of reservas) {
      expect(r).toMatch(/var\(--u5rail-b\)/);
      expect(r).not.toMatch(/--u5rail-b-vis/);
    }
  });

  it("★ la REJILLA del deck sí usa el visible, en los DOS lados (el ⇄ no se queda fuera)", () => {
    // Base: A · hueco · B-vis. Espejo (`data-pad-side=right`): B-vis · hueco · A.
    expect(LAND).toMatch(
      /\.touch-controls \{[^}]*grid-template-columns: var\(--u5rail-a\) minmax\(0, 1fr\) var\(--u5rail-b-vis\)/,
    );
    expect(LAND).toMatch(
      /\[data-pad-side="right"\] \.touch-controls \{\s*grid-template-columns: var\(--u5rail-b-vis\) minmax\(0, 1fr\) var\(--u5rail-a\)/,
    );
    // Y ninguna rejilla se quedó con el `--u5rail-b` pelado (sería el raíl corto de siempre).
    for (const g of LAND.match(/grid-template-columns:[^;]+;/g) ?? []) {
      if (!g.includes("--u5rail-b")) continue;
      expect(g).toContain("--u5rail-b-vis");
    }
  });
});

// ── EL PRODUCTOR ────────────────────────────────────────────────────────────────────────
// 🔴 QUIÉN PUBLICA Y POR QUÉ NO LO OBSERVA NADIE. El canvas SE RE-CREA al re-escalar, así
// que un observador externo (`ui/touch.ts`) tendría que re-engancharse cada vez — y ése es
// el patrón de bugs que en emulación miden 0. Lo publica LA PIEL, que es la dueña del
// canvas, igual que ya hace con `--u5-reflow-content`; el CSS consume y no persigue nada.

/** Monta lo mínimo que `relayout` necesita: un contenedor con hueco declarado y un canvas.
 *  (No se llama a `mount`: lo que se prueba es exactamente el paso layout → propiedad.) */
function pielConHueco(w: number, h: number): PortraitSkin {
  const skin = new PortraitSkin("cuadrado-force");
  const container = document.createElement("div");
  Object.defineProperty(container, "clientWidth", { value: w, configurable: true });
  Object.defineProperty(container, "clientHeight", { value: h, configurable: true });
  const canvas = document.createElement("canvas");
  container.appendChild(canvas);
  document.body.appendChild(container);
  (skin as unknown as { container: HTMLElement }).container = container;
  (skin as unknown as { canvas: HTMLCanvasElement }).canvas = canvas;
  return skin;
}

const relayout = (skin: PortraitSkin): void =>
  (skin as unknown as { relayout: () => void }).relayout();
const canvasVar = (): string => document.documentElement.style.getPropertyValue("--u5-canvas-w");

describe("apaisado · LA PIEL PUBLICA el ancho del canvas (y sólo ella)", () => {
  it("★ en APAISADO publica el ancho del canvas — los tres huecos MEDIDOS", () => {
    // Hueco (`container.clientWidth/Height`) y ancho publicado. Las cifras se movieron con
    // la ficha #113: la consola pasó de 12 a 13 filas (`CONSOLE_RECT.botRow` 22→23, literal
    // del binario), así que `BAND_STACK_H` = 80+8+104 = **192** en vez de 184 — y 192 es
    // exactamente `MAP_BLOCK_H`. Las dos columnas del apaisado pasan a limitarse por la
    // MISMA altura ⇒ `sa == sb == h/192` y el ancho sale redondo, `191·s + 129·s = 320·s`:
    //   590×330 → 320·1,71875 = «550px»  ·  653×360 y 670×360 → 320·1,875 = «600px».
    // Es un canvas ~2 % más estrecho a cambio de la fila 23 (donde vive la línea de
    // entrada). El raíl, que es el SOBRANTE, crece en la misma medida.
    for (const [w, h, esperado] of [
      [590, 330, "550px"],
      [653, 360, "600px"],
      [670, 360, "600px"],
    ] as const) {
      document.documentElement.style.removeProperty("--u5-canvas-w");
      document.documentElement.dataset["orient"] = "landscape";
      relayout(pielConHueco(w, h));
      expect(canvasVar()).toBe(esperado);
    }
  });

  it("★ redondea HACIA ARRIBA — con `floor` el raíl se pasa y roza el cromo azul", () => {
    // El sobrante sale de RESTAR este ancho: redondear el canvas hacia arriba deja el raíl
    // parándose ANTES del borde. Con `floor` se pasaba 0,6 px, y la primera columna del
    // cromo azul empieza a 0,5 px del borde. El error se paga siempre en negro.
    //
    // 🔴 EL TESTIGO CAMBIÓ DE ALTO A PROPÓSITO (#113). Este aserto usaba 590×330, que con
    // la consola de 12 filas daba 559,64 (fraccionario: `ceil`≠`floor`, aserto con
    // dientes). Con 13 filas ese mismo hueco da 550,0 EXACTO — y sobre un entero `ceil` y
    // `floor` coinciden, así que el aserto habría seguido VERDE con el redondeo roto:
    // verde vacuo. Se cambia a 590×**331**, que da 551,666… y vuelve a distinguirlos.
    document.documentElement.style.removeProperty("--u5-canvas-w");
    document.documentElement.dataset["orient"] = "landscape";
    relayout(pielConHueco(590, 331));
    expect(canvasVar()).toBe("552px"); // 551,66… → 552 (con `floor` sería 551)
  });

  it("★ en VERTICAL la RETIRA (es el estado por defecto, y el CSS cae a la base)", () => {
    document.documentElement.dataset["orient"] = "landscape";
    relayout(pielConHueco(590, 330));
    expect(canvasVar()).not.toBe("");
    document.documentElement.dataset["orient"] = "portrait";
    relayout(pielConHueco(393, 700));
    expect(canvasVar()).toBe("");
  });

  it("🔴 y la RETIRA AL DESMONTARSE — el CSS del deck SOBREVIVE a la piel", () => {
    // MEDIDO (852×330, iPhone 15 apaisado con barra): con el layout partido la piel publica
    // un ancho y el raíl ocupa el sobrante pegado al canvas. Al pulsar ▤ la piel se va, el
    // canvas pasa a ser el de la FIEL (528 px) y la propiedad se QUEDABA con el valor
    // viejo: el raíl seguía calculado contra un canvas que ya no existe. `UI_CLASS` no se
    // va con la piel (el ▤ tiene que existir en los dos layouts), así que el CSS sigue
    // leyendo la propiedad. (El 550 en vez del 560 de antes: consola de 13 filas, #113.)
    document.documentElement.dataset["orient"] = "landscape";
    const skin = pielConHueco(590, 330);
    relayout(skin);
    expect(canvasVar()).toBe("550px");
    skin.unmount();
    expect(canvasVar()).toBe("");
    // Sin propiedad, la aritmética del CSS devuelve el ancho BASE: 110, que es exactamente
    // lo que `main` hace en el layout clásico. Ni mejor ni peor — ese layout no es suyo.
    expect(railVisible(852, null)).toBe(110);
  });
});
