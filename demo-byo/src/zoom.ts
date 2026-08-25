/**
 * ZOOM Y ARRASTRE dentro del visor: pellizco en táctil, rueda y doble clic en escritorio.
 *
 * ── QUÉ SE AMPLÍA Y POR QUÉ NO SE SUAVIZA ───────────────────────────────────────────
 * Lo que hay dentro es pixel art de 1988 a su resolución nativa (320×200 la captura, y el
 * minimapa un lienzo de tiles). El zoom existe para VER EL PÍXEL, no para disimularlo:
 * `image-rendering: pixelated` lo pone el CSS del visor y aquí no se toca. Se amplía con
 * `transform: scale`, que respeta ese modo de interpolación.
 *
 * ── POR QUÉ POINTER EVENTS Y NO touch/mouse POR SEPARADO ────────────────────────────
 * Un solo juego de escuchadores cubre ratón, dedo y lápiz, y el pellizco sale de llevar
 * la cuenta de los punteros activos. Escribir las dos familias por separado duplicaría
 * la máquina de estados y es donde se cuelan las divergencias entre plataformas.
 *
 * ── 🔴 `touch-action: none`, QUE ES LA LÍNEA QUE EVITA EL DEFECTO OBVIO ─────────────
 * Sin ella el pellizco lo captura el NAVEGADOR y hace zoom de la página entera: el visor
 * se ampliaría junto con todo lo demás y el gesto no llegaría nunca a este código. Va en
 * el marco, no en el documento, para no romper el desplazamiento normal de la página
 * cuando el visor está cerrado.
 *
 * ── LO QUE NO SE TOCA ───────────────────────────────────────────────────────────────
 * · El cierre por Escape: `<dialog>` lo emite el navegador y aquí no se intercepta ninguna
 *   tecla. Hay aserto en la sonda porque «no lo toco» es una afirmación, no una garantía.
 * · El desplazamiento de la página de fondo: lo bloquea el propio `showModal()`.
 * · El estado del zoom muere con el diálogo — el visor lo REMUEVE al cerrar, así que la
 *   próxima apertura empieza a 1 sin que nadie tenga que acordarse de resetear. También
 *   con aserto: es una propiedad de la que dependemos, no un detalle de implementación.
 */

/** Cuánto se puede ampliar. 8× sobre 320 px son 2560: de sobra para mirar un tile. */
const MAX = 8;
const MIN = 1;
/** A cuánto salta el doble clic / doble toque. */
const SALTO = 3;

export interface Zoom {
  /** Escala actual. Para las sondas y para quien quiera pintar un indicador. */
  escala(): number;
  /** Suelta los escuchadores. El visor no lo necesita (remueve el nodo), pero existe. */
  suelta(): void;
}

export function habilitaZoom(marco: HTMLElement, imagen: HTMLElement): Zoom {
  let escala = 1;
  let tx = 0;
  let ty = 0;
  // Punteros vivos, por id. Con uno se arrastra; con dos se pellizca.
  const punteros = new Map<number, { x: number; y: number }>();
  let pinchaPrev = 0;

  imagen.style.transformOrigin = "center center";
  marco.style.touchAction = "none"; // ver la cabecera: sin esto el gesto no llega aquí
  marco.style.overflow = "hidden";
  pinta();

  function pinta(): void {
    // 🔴 El desplazamiento se ACOTA al hueco que el zoom deja libre: sin esto, un
    // arrastre largo saca la imagen de la pantalla y deja al visitante mirando el vacío
    // sin forma obvia de volver (el reset vive en el doble clic, que ya no ve).
    const caja = marco.getBoundingClientRect();
    const libreX = Math.max(0, (caja.width * (escala - 1)) / 2);
    const libreY = Math.max(0, (caja.height * (escala - 1)) / 2);
    tx = Math.min(libreX, Math.max(-libreX, tx));
    ty = Math.min(libreY, Math.max(-libreY, ty));
    imagen.style.transform = `translate(${tx}px, ${ty}px) scale(${escala})`;
    imagen.style.cursor = escala > MIN ? "grab" : "";
  }

  /** Amplía manteniendo fijo el punto (cx, cy) de la pantalla — el del cursor o el del pellizco. */
  function ampliaEn(nueva: number, cx: number, cy: number): void {
    const previa = escala;
    escala = Math.min(MAX, Math.max(MIN, nueva));
    if (escala === previa) return;
    const caja = marco.getBoundingClientRect();
    // Vector del centro del marco al punto de anclaje, en coordenadas de pantalla.
    const dx = cx - (caja.left + caja.width / 2);
    const dy = cy - (caja.top + caja.height / 2);
    // Para que ese punto no se mueva, la traslación compensa el cambio de escala.
    const k = escala / previa;
    tx = dx - (dx - tx) * k;
    ty = dy - (dy - ty) * k;
    if (escala === MIN) {
      tx = 0;
      ty = 0;
    }
    pinta();
  }

  const enRueda = (ev: WheelEvent): void => {
    ev.preventDefault(); // si no, la rueda desplaza el diálogo por debajo
    ampliaEn(escala * (ev.deltaY < 0 ? 1.25 : 0.8), ev.clientX, ev.clientY);
  };

  const enDoble = (ev: MouseEvent): void => {
    // Alterna: si ya está ampliado, vuelve a 1; si no, salta. Así el doble clic es
    // SIEMPRE la salida — incluida la de «me he perdido dentro de la imagen».
    ampliaEn(escala > MIN ? MIN : SALTO, ev.clientX, ev.clientY);
  };

  const enBaja = (ev: PointerEvent): void => {
    punteros.set(ev.pointerId, { x: ev.clientX, y: ev.clientY });
    if (punteros.size === 2) pinchaPrev = distancia();
    if (punteros.size === 1 && escala > MIN) imagen.style.cursor = "grabbing";
    marco.setPointerCapture(ev.pointerId);
  };

  const enMueve = (ev: PointerEvent): void => {
    const previo = punteros.get(ev.pointerId);
    if (!previo) return;
    const actual = { x: ev.clientX, y: ev.clientY };
    punteros.set(ev.pointerId, actual);

    if (punteros.size >= 2) {
      const d = distancia();
      if (pinchaPrev > 0 && d > 0) {
        const [a, b] = [...punteros.values()];
        ampliaEn((escala * d) / pinchaPrev, (a!.x + b!.x) / 2, (a!.y + b!.y) / 2);
      }
      pinchaPrev = d;
      return;
    }
    if (escala > MIN) {
      tx += actual.x - previo.x;
      ty += actual.y - previo.y;
      pinta();
    }
  };

  const enAlza = (ev: PointerEvent): void => {
    punteros.delete(ev.pointerId);
    if (punteros.size < 2) pinchaPrev = 0;
    if (escala > MIN) imagen.style.cursor = "grab";
  };

  function distancia(): number {
    const [a, b] = [...punteros.values()];
    if (!a || !b) return 0;
    return Math.hypot(a.x - b.x, a.y - b.y);
  }

  marco.addEventListener("wheel", enRueda, { passive: false });
  marco.addEventListener("dblclick", enDoble);
  marco.addEventListener("pointerdown", enBaja);
  marco.addEventListener("pointermove", enMueve);
  marco.addEventListener("pointerup", enAlza);
  marco.addEventListener("pointercancel", enAlza);

  return {
    escala: () => escala,
    suelta() {
      marco.removeEventListener("wheel", enRueda);
      marco.removeEventListener("dblclick", enDoble);
      marco.removeEventListener("pointerdown", enBaja);
      marco.removeEventListener("pointermove", enMueve);
      marco.removeEventListener("pointerup", enAlza);
      marco.removeEventListener("pointercancel", enAlza);
    },
  };
}
