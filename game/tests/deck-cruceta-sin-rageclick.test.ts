// @vitest-environment jsdom
/**
 * SELLO del apagado de `$rageclick` en la CRUCETA del deck táctil (`ui/touch.ts`).
 *
 * QUÉ CIERRA. La auditoría de PostHog contó 266 `$rageclick` y 239 eran las cuatro
 * flechas: el detector del SDK es un contador ciego (3 clics · <30 px · <1000 ms) y
 * andar tres casillas seguidas lo satisface por construcción. Medido en el carril: el
 * motor consume 5 de 5 toques hasta 60 ms de cadencia y la tasa es plana entre las
 * cuatro flechas ⇒ no había defecto detrás, el ruido era del instrumento. El arreglo es
 * la clase `ph-no-rageclick` en las flechas (docblock largo en `ui/touch.ts`).
 *
 * POR QUÉ ESTE FICHERO NO ES TAUTOLÓGICO. Comprobar «el botón lleva la clase que dice la
 * constante» no comprobaría NADA: el riesgo real es que el NOMBRE no sea el que el SDK
 * mira (un `ph-no-rage-click`, un `ph-norageclick`, o que PostHog lo renombre al subir de
 * versión), y ese fallo es SILENCIOSO — la clase queda puesta, bonita e inerte, y los
 * rageclicks falsos siguen llegando sin que nada se ponga rojo. Así que el esperado NO
 * sale del sujeto: se carea contra el TERCERO, por dos vías independientes —
 *   1. la lista por defecto del SDK instalado, leída de su propio módulo, y
 *   2. su predicado REAL `shouldCaptureRageclick`, EJECUTADO sobre el DOM que construye
 *      `TouchControls` (así entra también el paseo por ancestros, que es donde se
 *      decide el alcance).
 *
 * MUTANTES COMPROBADOS al escribirlo (los cuatro ponen rojo):
 *   · cambiar `CLASE_SIN_RAGECLICK` a un nombre que el SDK no mira → rojo por (1) y (2);
 *   · quitar la clase de una flecha → rojo en el caso por-flecha;
 *   · mover la clase al contenedor `.touch-dpad` → rojo en el aserto de Spc/Ent/Esc, que
 *     es justo el ensanchamiento silencioso de alcance que no queremos;
 *   · dejar de poner la clase → rojo en las cuatro flechas.
 */
import { beforeEach, describe, expect, it } from "vitest";
import { createRequire } from "node:module";
import { CLASE_SIN_RAGECLICK, TouchControls } from "../src/ui/touch.js";
import { installPortraitDeckDom } from "../src/skin/portrait/deck-dom.js";
import type { Game } from "../src/core/game.js";

/** `game` mínimo: el constructor sólo lee estos dos para elegir la rejilla. */
const fakeGame = { combat: null, dungeonState: null } as unknown as Game;

/** El SDK REAL que sirve el sitio, cargado de su propio paquete (CJS). No es una copia
 *  de sus constantes: es su módulo. Si PostHog cambia la lista o el predicado al subir
 *  de versión, estos asertos se enteran. */
const require_ = createRequire(import.meta.url);
const sdk = require_("@posthog/browser-common/utils/autocapture-utils") as {
  shouldCaptureRageclick: (el: Element, config: unknown) => boolean;
};

let deck: TouchControls;
let raiz: HTMLElement;

beforeEach(() => {
  document.body.innerHTML = "";
  const host = document.createElement("div");
  document.body.appendChild(host);
  deck = new TouchControls(host, fakeGame);
  raiz = document.querySelector<HTMLElement>(".touch-controls")!;
});

const flecha = (key: string): HTMLElement =>
  raiz.querySelector<HTMLElement>(`.touch-dpad button[data-key="${key}"]`)!;

const FLECHAS = ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"];

describe("cruceta táctil: sin `$rageclick` falso", () => {
  it("la clase que usamos es una que el SDK de PostHog REALMENTE mira", () => {
    // Vía 1: la lista por defecto del propio SDK instalado. `.ph-no-rageclick` no es una
    // convención nuestra — es su default, y aquí se lee de su módulo, no se transcribe.
    const porDefecto = require_(
      "@posthog/browser-common/utils/autocapture-utils",
    ) as Record<string, unknown>;
    // El predicado se ejerce en el test de abajo; aquí basta con que el nombre exista
    // en el SDK. Lo buscamos en el TEXTO del módulo servido para no depender de que
    // exporte la constante (es interna).
    const fuente = require_("node:fs").readFileSync(
      require_.resolve("@posthog/browser-common/utils/autocapture-utils"),
      "utf8",
    ) as string;
    expect(porDefecto.shouldCaptureRageclick).toBeTypeOf("function");
    expect(
      fuente.includes(`'.${CLASE_SIN_RAGECLICK}'`) ||
        fuente.includes(`".${CLASE_SIN_RAGECLICK}"`),
    ).toBe(true);
  });

  it.each(FLECHAS)(
    "el predicado REAL del SDK NO capturaría un rageclick en %s",
    (key) => {
      const btn = flecha(key);
      expect(btn, `falta la flecha ${key}`).toBeTruthy();
      // `true` = config por defecto (rama booleana de shouldCaptureRageclick).
      expect(sdk.shouldCaptureRageclick(btn, true)).toBe(false);
      // …y con la rama de OBJETO, que es la que usan los defaults nuevos por fecha.
      expect(sdk.shouldCaptureRageclick(btn, {})).toBe(false);
    },
  );

  it("CONTROL POSITIVO: sobre un botón sin la clase, el mismo predicado SÍ captura", () => {
    // Sin este control, los asertos de arriba pasarían igual si `shouldCaptureRageclick`
    // devolviera `false` siempre (p. ej. por un jsdom sin `window` o un cambio de API):
    // un predicado muerto se lee como un arreglo que funciona.
    const suelto = document.createElement("button");
    suelto.textContent = "control";
    document.body.appendChild(suelto);
    expect(sdk.shouldCaptureRageclick(suelto, true)).toBe(true);
  });

  it("las cuatro flechas llevan la clase", () => {
    for (const key of FLECHAS) {
      expect(flecha(key).classList.contains(CLASE_SIN_RAGECLICK), key).toBe(true);
    }
    expect(raiz.querySelectorAll(`.touch-dpad button.${CLASE_SIN_RAGECLICK}`)).toHaveLength(4);
  });

  it("el ALCANCE no se ensancha: Spc/Ent/Esc conservan su `$rageclick`", () => {
    // 🔴 ESTE TEST SE ESCRIBIÓ DOS VECES, y la primera versión era el testigo mal
    // elegido: asertaba sobre el DOM que sale del constructor, donde las teclas de
    // utilidad viven en `.touch-util` — HERMANO de `.touch-sheets`, no descendiente de
    // `.touch-dpad`. Ahí subir la clase al contenedor no las toca, así que el mutante
    // «clase movida a .touch-dpad» pasaba VERDE: el aserto era correcto y estaba
    // instanciado donde la diferencia no existe. Quien las mete DENTRO de la cruceta es
    // el layout PARTIDO (`skin/portrait/deck-dom.ts` → `mudar()`), y es exactamente la
    // geometría que enseñan los datos de PostHog del usuario:
    //   button.touch-btn.touch-util-btn.u5padkey.u5padkey-ent ; div.touch-dpad
    // Por eso aquí se llama al instalador REAL en vez de recolocar a mano: un doble
    // escrito por mí podría colocarlas donde me convenga y volver a no medir nada.
    const desmontar = installPortraitDeckDom();
    try {
      const dpad = raiz.querySelector<HTMLElement>(".touch-dpad")!;
      const utiles = [...dpad.querySelectorAll<HTMLElement>("button[data-util-key]")];
      // Control de que la MUDANZA ocurrió: sin esto, un `installPortraitDeckDom` que no
      // moviera nada dejaría la lista vacía y el bucle pasaría en vacío — el censo-cero
      // que se lee como «todo bien».
      expect(
        utiles.map((b) => b.dataset.utilKey).sort(),
        "las teclas de utilidad deben haberse mudado DENTRO de .touch-dpad",
      ).toEqual([" ", "Enter", "Escape"]);
      for (const btn of utiles) {
        expect(btn.classList.contains(CLASE_SIN_RAGECLICK), btn.dataset.utilKey).toBe(false);
        expect(sdk.shouldCaptureRageclick(btn, true), btn.dataset.utilKey).toBe(true);
      }
    } finally {
      desmontar();
    }
  });

  it("la clase no toca el `$autocapture`: no es `ph-no-capture`", () => {
    // La diferencia es la razón de haberla elegido: queremos SEGUIR contando los clics
    // de cruceta, sólo dejar de rotularlos como rabia.
    expect(CLASE_SIN_RAGECLICK).not.toBe("ph-no-capture");
    for (const key of FLECHAS) {
      expect(flecha(key).classList.contains("ph-no-capture"), key).toBe(false);
    }
  });
});
