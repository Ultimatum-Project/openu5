/**
 * @vitest-environment jsdom
 *
 * #302 — EL TECLADO DEL SISTEMA NO SE CIERRA ENTRE PROMPTS DE TEXTO ENCADENADOS.
 *
 * Reporte del usuario (14-08, iPhone): el rito del santuario pide texto CUATRO veces
 * seguidas (virtud + mantra ×3, CAST2 0x09c1 `getstring` + bucle 0x0a0c que reusa el mismo
 * buffer DS 0xbd08 en 0x0a17), y «el teclado se oculta tras cada mantra» — había que volver
 * a tocar «ABC» tres veces para completar una sola ceremonia.
 *
 * CAUSA MEDIDA — son DOS piezas, y cada una por separado parece correcta:
 *   (1) `deck-nativo.ts` blurea el campo invisible SIEMPRE al enviar la línea (rama
 *       `insertLineBreak` de `onBeforeInput` y rama `Enter` de `onInputKeyDown`);
 *   (2) `syncAz` sólo actúa en el FLANCO — `if (azOn === azWasOn) return`. Como el prompt
 *       siguiente vuelve a ser de texto, la hoja A-Z NO baja, no hay flanco, y nadie
 *       devuelve el foco que (1) acaba de soltar.
 * Juntas: teclado cerrado y sin nadie que lo reabra. Ninguna de las dos es un defecto
 * mirándola sola, que es por lo que sobrevivió.
 *
 * QUÉ SELLA ESTE FICHERO, y por qué en jsdom y no en e2e: el predicado es «¿quién tiene el
 * foco?» inmediatamente después del envío, que es exactamente lo que jsdom modela bien y
 * barato (~10 ms). El e2e real (WebKit) NO puede sustituirlo: playwright no expone si iOS
 * DESPLEGÓ el teclado del sistema, sólo el foco — y el foco es justo esto. La condición
 * añadida de iOS (que el `focus()` viva dentro del gesto) se satisface por construcción y
 * no por temporizador: la cadena `emitKey("Enter")` → PromptManager → `askText` →
 * `expectInput` es SÍNCRONA, así que cuando se decide blurear el motor ya ha declarado si
 * sigue pidiendo texto. Aquí se sella esa sincronía: si alguien la rompe metiendo un
 * `await`/`setTimeout` en medio, la hoja aún no estará alzada al mirarla y el test cae.
 *
 * MUTANTE (corrido, no supuesto): devolver el `input.blur()` incondicional a cualquiera de
 * las dos ramas pone en rojo «el teclado SIGUE abierto…» y deja verde el control de cierre.
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { installNativeKeyboard } from "../src/skin/portrait/deck-nativo.js";

/** Deck mínimo: lo que `installNativeKeyboard` busca por selector para montarse. */
function montaDeck(): void {
  document.body.innerHTML = `
    <div id="app"></div>
    <div class="touch-controls">
      <div class="touch-sheets">
        <div class="touch-sheet touch-sheet-az"></div>
        <div class="touch-sheet touch-sheet-num"></div>
      </div>
      <div class="touch-util"></div>
    </div>`;
}

const hojaAz = (): HTMLElement => document.querySelector<HTMLElement>(".touch-sheet-az")!;
const campo = (): HTMLInputElement => document.querySelector<HTMLInputElement>(".u5kb-input")!;

/** Alza/baja la hoja A-Z como haría `expectInput` — la MISMA clase que lee `estadoHoja`. */
function declaraQueEsperaTexto(si: boolean): void {
  hojaAz().classList.toggle("touch-sheet-on", si);
}

/**
 * Envía la línea por la vía de `keydown` (la de la mayoría de teclados virtuales). El
 * `handler` corre DENTRO del despacho del evento y simula lo que hace el motor al
 * resolverse el prompt: declarar si sigue esperando texto. Ése es el orden real —
 * `emitKey` dispara la cadena síncrona antes de que se decida el blur.
 */
function enviaLinea(handler: () => void): void {
  const onKey = (ev: KeyboardEvent): void => {
    if (ev.key === "Enter") handler();
  };
  window.addEventListener("keydown", onKey);
  campo().dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
  window.removeEventListener("keydown", onKey);
}

describe("#302 — el teclado persiste mientras el rito siga pidiendo texto", () => {
  let handle: { destroy?: () => void } | null = null;

  beforeEach(() => {
    montaDeck();
    handle = installNativeKeyboard(document.getElementById("app")) as { destroy?: () => void };
  });
  afterEach(() => {
    handle?.destroy?.();
    document.body.innerHTML = "";
  });

  it("EL DEFECTO: enviar la virtud con OTRO prompt de texto detrás NO cierra el teclado", () => {
    declaraQueEsperaTexto(true);
    campo().focus();
    expect(document.activeElement, "premisa: el campo tiene el foco al teclear").toBe(campo());

    // El motor resuelve la virtud y pide el 1er mantra: la hoja A-Z sigue alzada.
    enviaLinea(() => declaraQueEsperaTexto(true));

    expect(
      document.activeElement,
      "el teclado SIGUE abierto para el mantra siguiente (con el blur incondicional valía <body>)",
    ).toBe(campo());
  });

  it("CONTROL DE CIERRE: acabado el rito (nadie pide texto), el teclado SÍ se cierra", () => {
    declaraQueEsperaTexto(true);
    campo().focus();

    // Último mantra: el core resuelve la ceremonia y NO abre prompt nuevo ⇒ la hoja baja.
    enviaLinea(() => declaraQueEsperaTexto(false));

    expect(
      document.activeElement,
      "sin prompt detrás el campo suelta el foco: el teclado no se queda pegado",
    ).not.toBe(campo());
  });

  it("las CUATRO entradas del rito (virtud + mantra ×3) van sin soltar el foco ni una vez", () => {
    declaraQueEsperaTexto(true);
    campo().focus();
    // Virtud + mantras 1 y 2: cada envío deja otro prompt de texto detrás.
    for (let i = 0; i < 3; i++) {
      enviaLinea(() => declaraQueEsperaTexto(true));
      expect(document.activeElement, `entrada ${i + 1} de 4: el foco no se suelta`).toBe(campo());
    }
    // Mantra 3: es el último, y ahí sí se cierra.
    enviaLinea(() => declaraQueEsperaTexto(false));
    expect(document.activeElement, "cerrada la 4ª, el teclado se retira").not.toBe(campo());
  });

  it("la OTRA vía de envío (`beforeinput`) tampoco suelta el foco", () => {
    // 🔴 Esta prueba la pidió el MUTANTE, no el diseño: M1 (blur incondicional en la rama
    // `keydown`) mató 2 de 4, y al mirar cuáles quedaban vivas se vio que NINGUNA tocaba la
    // rama `insertLineBreak` de `onBeforeInput`. Son DOS caminos de envío reales —
    // `beforeinput` es la fuente en los teclados virtuales que no emiten un `key` fiable,
    // que es justo el caso del reporte— y una guarda con la mitad de la población habría
    // dejado pasar el defecto por el otro lado.
    declaraQueEsperaTexto(true);
    campo().focus();
    const onKey = (ev: KeyboardEvent): void => {
      if (ev.key === "Enter") declaraQueEsperaTexto(true);
    };
    window.addEventListener("keydown", onKey);
    campo().dispatchEvent(
      new InputEvent("beforeinput", { inputType: "insertLineBreak", bubbles: true, cancelable: true }),
    );
    window.removeEventListener("keydown", onKey);
    expect(document.activeElement, "misma regla por las dos vías de envío").toBe(campo());
  });

  it("ESC aborta el rito y cierra el teclado aunque la hoja siguiera alzada", () => {
    // El core resuelve con cadena vacía y limpia su `pending` (CAST2 0x09cc): no hay prompt
    // encadenado que preservar. La hoja se deja alzada A PROPÓSITO para instanciar la
    // diferencia: si ESC compartiera el camino de Enter, este aserto caería.
    declaraQueEsperaTexto(true);
    campo().focus();
    campo().dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    expect(document.activeElement, "ESC cierra siempre").not.toBe(campo());
  });
});
