// @vitest-environment jsdom
/**
 * #333 pieza B (+ recíproca del ▤ y 2-en-1) — EL DECK NO RESUCITA EN ESCRITORIO.
 *
 * DECISIÓN DEL USUARIO (16-08, delegada al lead): en puntero no táctil el layout partido
 * ni se ofrece ni se restaura. La pieza A1 (gate de régimen en `layoutPartidoInicial` /
 * `layoutPartidoDisponible`) vive en `defaults-arranque.test.ts` §1-bis; aquí se ata el
 * otro lado del bug: la CASCADA.
 *
 * EL MECANISMO (medido, memoria
 * `el-important-escrito-contra-un-valor-del-inline-se-invierte-cuando-el-valor-cambia`):
 * `ui/touch.ts` apaga el deck con `display:none` INLINE; `deck-ancho.ts` publicaba
 * `.touch-controls { display: grid !important }` justificado «porque ui/touch.ts pone
 * display:flex inline» — cierto para el valor que el autor vio y falso como propiedad:
 * cuando el inline vale `none` (escritorio), el mismo `!important` RESUCITA el deck (38
 * botones en Chrome de escritorio). El remedio: acotar esas reglas a `html.u5-touch`, la
 * clase que `aplicarRegimen` publica con el régimen VIVO (#334).
 *
 * 🔴 SON CUATRO REGLAS, NO TRES. El traspaso del carril tactil-336 contó tres (193, 730,
 * 1011) y avisó «quien acote sólo la primera leerá el fix no funciona»; el censo sobre el
 * árbol dio CUATRO — la del layout APAISADO no estaba contada, y es justo la que casa en
 * un escritorio 1440×900 (landscape). Por eso este fichero carea las reglas UNA A UNA con
 * su selector esperado EN CRUDO: des-acotar cualquiera de las cuatro pone rojo su aserto
 * (un `toContain` sobre el CSS entero no sabría cuál de las cuatro lo satisfizo).
 *
 * Y EL COMPLEMENTO TAMBIÉN SE ATA: los `justify-content … !important` del apaisado son
 * OTRA cosa (pegado del juego al raíl, ficha aparte) y NO llevan la clase — sin ese
 * control, un barrido de sobre-acotado pasaría en silencio.
 */
import { describe, it, expect, beforeEach } from "vitest";
import {
  wideDeckCss,
  layoutOriginalCss,
  layoutApaisadoCss,
  installLayoutToggleButton,
  TOUCH_CLASS,
} from "../src/skin/portrait/deck-ancho.js";
import {
  layoutPartidoDisponible,
  layoutPartidoInicial,
  esPantallaTactil,
} from "../src/skin/portrait/skin.js";
import { esTactilAhora, onCambioRegimenTactil } from "../src/ui/regimen-tactil.js";

/* ══ Parser de reglas — misma técnica que `landscape-homog.test.ts`: partir el CSS en
   reglas para poder afirmar POR SELECTOR, no sobre el texto entero. Los comentarios se
   retiran ANTES de partir (alguno cita llaves). Ninguna de las tres funciones parseadas
   lleva at-rules anidadas (`@supports` vive en `botonesUiCss`, verificado). */
interface Regla {
  selector: string;
  cuerpo: string;
}

function reglas(css: string): Regla[] {
  const limpio = css.replace(/\/\*[\s\S]*?\*\//g, "");
  const out: Regla[] = [];
  for (const bloque of limpio.split("}")) {
    const i = bloque.indexOf("{");
    if (i < 0) continue;
    out.push({
      selector: bloque.slice(0, i).trim().replace(/\s+/g, " "),
      cuerpo: bloque.slice(i + 1),
    });
  }
  return out;
}

const resucita = (r: Regla): boolean =>
  r.selector.includes(".touch-controls") && /display:\s*grid\s*!important/.test(r.cuerpo);

/** Las tres fuentes con reglas de resurrección, con su cardinal esperado EN CRUDO. */
const FUENTES: { nombre: string; css: string; esperadas: string[] }[] = [
  {
    nombre: "wideDeckCss",
    css: wideDeckCss(),
    esperadas: [
      'html.u5-touch.u5-deck-ancho[data-deck-ancho="bloques"][data-orient="portrait"] .touch-controls',
      'html.u5-touch.u5-deck-ancho[data-deck-ancho="columnas"][data-orient="portrait"] .touch-controls',
    ],
  },
  {
    nombre: "layoutOriginalCss",
    css: layoutOriginalCss(),
    esperadas: [
      'html.u5-touch.u5-btn-ui:not(.u5-deck-ancho)[data-orient="portrait"] .touch-controls',
    ],
  },
  {
    nombre: "layoutApaisadoCss",
    css: layoutApaisadoCss(),
    esperadas: ['html.u5-touch.u5-btn-ui[data-orient="landscape"] .touch-controls'],
  },
];

describe("#333 B — los `display: grid !important` del deck van acotados a `html.u5-touch`", () => {
  it("control positivo del parser: las fuentes tienen reglas y el detector sabe decir sí", () => {
    // Sin esto, un parser roto daría cero reglas y los censos de abajo pasarían vacíos
    // (un censo-cero jamás se firma sin control positivo).
    for (const f of FUENTES) {
      expect(reglas(f.css).length, f.nombre).toBeGreaterThan(3);
      expect(reglas(f.css).filter(resucita).length, f.nombre).toBeGreaterThan(0);
    }
  });

  // UNA A UNA y con el selector esperado EN CRUDO: el aserto que cazaría a un mutante
  // que des-acote exactamente esa regla (quitarle `u5-touch` cambia el selector y este
  // `find` deja de encontrarla).
  for (const f of FUENTES) {
    for (const sel of f.esperadas) {
      it(`${f.nombre}: la regla «${sel.slice(0, 58)}…» existe y resucita SOLO en táctil`, () => {
        const r = reglas(f.css).find((x) => x.selector === sel);
        expect(r, `no hay regla con el selector esperado en ${f.nombre}`).toBeDefined();
        expect(r!.cuerpo).toMatch(/display:\s*grid\s*!important/);
      });
    }
  }

  it("censo cerrado: CUATRO reglas de resurrección en total, y NINGUNA sin `html.u5-touch`", () => {
    // La red por debajo de los asertos uno-a-uno: si mañana alguien AÑADE una quinta
    // regla `display:grid !important` sin acotar (el modo de fallo original: cada
    // sub-variante nueva copiaba el patrón), este censo la nombra.
    const todas = FUENTES.flatMap((f) => reglas(f.css).filter(resucita));
    expect(todas.length).toBe(4);
    for (const r of todas) {
      expect(r.selector.startsWith(`html.${TOUCH_CLASS}.`), r.selector).toBe(true);
    }
    expect(TOUCH_CLASS).toBe("u5-touch"); // la clase que publica `aplicarRegimen`, en crudo
  });

  it("el COMPLEMENTO no se acota: los `justify-content !important` del apaisado (pegado, no visibilidad) quedan como estaban", () => {
    // El traspaso avisa: el 4º `!important` histórico (`justify-content` de
    // `#app > .shader-skin`) es OTRA cosa y NO se toca. Control contra el barrido de más.
    const pegado = reglas(layoutApaisadoCss()).filter((r) =>
      /justify-content:\s*flex-(start|end)\s*!important/.test(r.cuerpo),
    );
    expect(pegado.length).toBe(2); // base + espejo del ⇄
    for (const r of pegado) {
      expect(r.selector, r.selector).not.toContain("u5-touch");
      expect(r.selector).toContain("#app > .shader-skin");
    }
  });
});

describe("#333 recíproca — en TÁCTIL el ▤ sigue existiendo y funcional (el encierro del 27-07 no vuelve por el otro lado)", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
    document.documentElement.className = "";
  });

  it("installLayoutToggleButton ancla el ▤ en `.touch-shellmenu` y el click dispara el toggle", () => {
    // ESTADO del DOM, no espías de instalación: se mira dónde quedó el botón y qué le
    // pasa al DOM al pulsarlo. (El callback contado es la FUNCIÓN pedida al botón, no un
    // espía sobre el mecanismo.)
    const deck = document.createElement("div");
    deck.className = "touch-controls";
    const menu = document.createElement("div");
    menu.className = "touch-shellmenu on";
    deck.appendChild(menu);
    document.body.appendChild(deck);

    let toggles = 0;
    const quitar = installLayoutToggleButton(() => {
      toggles += 1;
    });
    const btn = document.querySelector<HTMLButtonElement>(".touch-shellmenu .u5layout-btn");
    expect(btn, "el ▤ no quedó anclado dentro del menú ☰ del deck").not.toBeNull();
    expect(btn!.style.display).not.toBe("none"); // nadie lo apaga inline al instalarlo
    btn!.click();
    expect(toggles).toBe(1);
    // A3-5: pulsar el ▤ cierra el menú overlay para no tapar el layout recién elegido.
    expect(menu.classList.contains("on")).toBe(false);
    quitar();
    expect(document.querySelector(".u5layout-btn")).toBeNull(); // desinstalación limpia
  });

  it("ninguna de las reglas acotadas APAGA nada: todas encienden (`grid`), así que en táctil el deck —y el ▤ dentro— se ven", () => {
    // La acotación de la pieza B sólo puede QUITAR resurrecciones en escritorio, nunca
    // añadir apagados en táctil: se censa que ningún selector con `u5-touch` publique
    // `display: none` sobre el deck o el menú del ▤.
    const conClase = FUENTES.flatMap((f) => reglas(f.css)).filter((r) =>
      r.selector.includes("u5-touch"),
    );
    expect(conClase.length).toBeGreaterThan(0); // control positivo del filtro
    for (const r of conClase) {
      expect(r.cuerpo, r.selector).not.toMatch(/display:\s*none/);
    }
  });
});

/** MediaQueryList controlable — calcado del arnés de `regimen-tactil-vivo.test.ts`. */
function stubMatchMedia(inicialCoarse: boolean): { poner(coarse: boolean): void } {
  let coarse = inicialCoarse;
  const cbs = new Set<() => void>();
  window.matchMedia = ((q: string) => ({
    get matches() {
      return q.includes("coarse") ? coarse : false;
    },
    media: q,
    addEventListener: (_: string, cb: () => void) => cbs.add(cb),
    removeEventListener: (_: string, cb: () => void) => cbs.delete(cb),
    addListener: (cb: () => void) => cbs.add(cb),
    removeListener: (cb: () => void) => cbs.delete(cb),
    onchange: null,
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia;
  return {
    poner(v: boolean) {
      coarse = v;
      for (const cb of [...cbs]) cb();
    },
  };
}

describe("#333 A1 en el 2-en-1 — la decisión de layout sigue al régimen EN CALIENTE", () => {
  beforeEach(() => window.history.replaceState(null, "", "/"));

  it("plegar a tableta re-abre el partido; enchufar el ratón lo cierra — con la MISMA cadena viva que consume main.ts", () => {
    // La cadena que `main.ts` compone (`quiereLayoutPartidoAhora` y la suscripción
    // `onCambioRegimenTactil` que re-sincroniza el layout montado): preferencia guardada
    // CONSTANTE a favor, régimen que cambia. Esperados en crudo a cada lado del cambio.
    const mq = stubMatchMedia(false);
    const guardado = true; // u5.layoutPartido=1 — el sendero medido del bug

    // Escritorio: ni se restaura ni se ofrece, con la preferencia a favor delante.
    expect(esPantallaTactil()).toBe(false); // control del arnés: sabe decir «no»
    expect(layoutPartidoInicial(guardado, null, esPantallaTactil())).toBe(false);
    expect(layoutPartidoDisponible(guardado, null, esPantallaTactil())).toBe(false);

    // El oyente es el MISMO mecanismo al que main.ts cuelga la re-sincronización.
    const vistos: boolean[] = [];
    const off = onCambioRegimenTactil((t) => vistos.push(t));

    mq.poner(true); // se pliega a tableta
    expect(vistos).toEqual([true]); // el cambio LLEGÓ, resuelto (no crudo)
    expect(esTactilAhora()).toBe(true);
    expect(layoutPartidoInicial(guardado, null, esPantallaTactil())).toBe(true);
    expect(layoutPartidoDisponible(guardado, null, esPantallaTactil())).toBe(true);

    mq.poner(false); // se enchufa el ratón
    expect(vistos).toEqual([true, false]);
    expect(layoutPartidoInicial(guardado, null, esPantallaTactil())).toBe(false);
    expect(layoutPartidoDisponible(guardado, null, esPantallaTactil())).toBe(false);
    off();
  });

  it("`?touch=1` deja el régimen clavado en táctil: el vaivén del puntero no lo mueve (la puerta del caso ambiguo)", () => {
    const mq = stubMatchMedia(false);
    window.history.replaceState(null, "", "/?touch=1");
    expect(layoutPartidoDisponible(true, null, esPantallaTactil())).toBe(true);
    mq.poner(false);
    expect(layoutPartidoDisponible(true, null, esPantallaTactil())).toBe(true);
  });
});
