/**
 * PANEL DE CONSENTIMIENTO — la única UI del carril 1.
 *
 * Vive en las TRES superficies (portada, /byo, /play) y por eso es autónomo: trae
 * sus propios estilos y sus propios textos es/en, sin depender del i18n del juego
 * (que no existe en la portada estática) ni del CSS de la página que lo hospeda.
 *
 * Régimen de la UI, que es parte del compromiso y no decoración:
 *   - Las DOS casillas arrancan APAGADAS, siempre, también al reabrir el panel tras
 *     haber rechazado. Nada viene premarcado.
 *   - «Rechazar todo» y «Guardar elección» tienen el MISMO peso visual: no hay un
 *     botón grande y verde que acepte y un enlace gris que rechace.
 *   - Cerrar sin elegir (Escape, ✕) NO concede nada: guarda el rechazo explícito,
 *     que es la elección que el silencio ya implicaba, y deja de preguntar.
 *   - El segundo nivel se presenta como FUNCIÓN DEL JUEGO («Guardar mi partida»),
 *     porque eso es lo que es: da repetición y récords a cambio del permiso.
 */
import {
  eleccionVigente,
  guardarConsentimiento,
  leerConsentimiento,
  type AlmacenSimple,
  type Consentimiento,
  type Eleccion,
} from "./consentimiento.js";
import { permiteGrabacionSesion, type Superficie } from "./superficies.js";
// `esc` es el nombre local histórico; la primitiva compartida se llama `escapeHtml`.
import { escapeHtml as esc } from "../core/escape-html.js";

export type Idioma = "es" | "en";

const ID_PANEL = "openu5-consentimiento";
/** El hueco que compensa la banda fija del panel. Ver el porqué medido en el CSS. */
const ID_RESERVA = "openu5-consentimiento-reserva";
const ID_ESTILOS = "openu5-consentimiento-css";

interface Textos {
  titulo: string;
  /** UNA frase: la promesa que decide. El resto va plegado en introMas (#166). */
  intro: string;
  introMas: string;
  analiticaTitulo: string;
  analiticaDetalle: string;
  partidaTitulo: string;
  partidaDetalle: string;
  grabacion: string;
  /** Rótulo del disclosure que abre la prosa de cada permiso (#166). */
  verDetalles: string;
  rechazar: string;
  guardar: string;
  cerrar: string;
  revocable: string;
}

const TEXTOS: Record<Idioma, Textos> = {
  es: {
    titulo: "Tú decides qué se envía",
    intro: "Tus ficheros del juego <b>nunca salen de tu dispositivo</b>.",
    introMas:
      "Eso no cambia y sigue siendo comprobable en el código. Lo de abajo son dos " +
      "permisos aparte, los dos apagados. Si no activas ninguno, este sitio no envía " +
      "nada a nadie.",
    analiticaTitulo: "Analítica anónima",
    analiticaDetalle:
      "Cuánta gente entra, desde qué sitio llega y en qué paso se atasca al traer sus " +
      "ficheros. Sin nombre, sin cuenta y sin perfil de persona.",
    partidaTitulo: "Guardar mi partida",
    partidaDetalle:
      "Guarda <b>la lista de teclas que pulsas</b>, con la que se reconstruye tu partida " +
      "entera: repetición, enlace para compartirla y tabla de récords. Esa lista incluye " +
      "lo que escribes — los nombres que inventas, lo que dices en una conversación. " +
      "Nunca los ficheros del juego, nunca imágenes.",
    grabacion:
      "Si aceptas la analítica, se graba tu sesión para ver dónde se atasca la gente: " +
      "el manejo de la web y también la pantalla del juego tal como tu navegador la " +
      "dibuja con tus ficheros, incluido lo que tecleas. Es el único canal que captura " +
      "imágenes; va al espacio privado del proyecto y no se publica.",
    verDetalles: "Ver detalles",
    rechazar: "Rechazar todo",
    guardar: "Guardar elección",
    cerrar: "Cerrar sin aceptar nada",
    // 🔴 NOMBRA EL ENLACE QUE EXISTE. Decía «desde «Privacidad»», y en el pie de las 19
    // páginas con cromo hay DOS enlaces: «Privacidad y datos», que lleva a la PÁGINA, y
    // «Mis permisos», que abre ESTE panel. Mandaba al primero, o sea a leer en vez de a
    // cambiar — la misma frase equivocada que /privacidad tenía en su sección «Cómo
    // cambiar de opinión», y por la misma razón: se escribieron cuando el pie sólo tenía
    // un enlace. Si el rótulo del pie cambia, esta cadena cambia con él.
    // 🔴 UNA LÍNEA, Y ESO ES UN REQUISITO MEDIDO, no una preferencia de estilo: a 390 px este
    // texto costaba DOS líneas (50 px con su margen) y el panel desbordaba 79 px en el
    // iPhone SE. Se podó hasta caber en una (~47 caracteres) CONSERVANDO los dos verbos
    // —cambiar y RETIRAR— y el sitio donde se hace. Lo que se fue es «en el pie de cualquier
    // página». La alternativa que se DESCARTÓ con razón escrita era esconder la línea entera
    // dentro del desplegable: saber que la decisión es reversible es justo lo que quita
    // presión a la decisión que el panel está pidiendo, así que pagar el desbordamiento con
    // esa información sería optimizar la métrica del panel contra el propósito del panel.
    revocable: "Puedes cambiarlo o retirarlo en «Mis permisos».",
  },
  en: {
    titulo: "You decide what gets sent",
    intro: "Your game files <b>never leave your device</b>.",
    introMas:
      "That does not change and is still verifiable in the code. Below are two separate " +
      "permissions, both off. If you turn neither on, this site sends nothing to anyone.",
    analiticaTitulo: "Anonymous analytics",
    analiticaDetalle:
      "How many people arrive, where they come from, and which step they get stuck on when " +
      "bringing their own files. No name, no account, no person profile.",
    partidaTitulo: "Save my game",
    partidaDetalle:
      "Stores <b>the list of keys you press</b>, from which your whole session is rebuilt: " +
      "replay, a shareable link and a records table. That list includes what you type — the " +
      "names you invent, what you say in a conversation. Never the game files, never images.",
    grabacion:
      "If you accept analytics, your session is recorded to see where people get stuck: " +
      "how you use the site and also the game screen as your browser draws it from your " +
      "files, including what you type. This is the only channel that captures images; it " +
      "goes to the project's private space and is never published.",
    verDetalles: "See details",
    rechazar: "Reject everything",
    guardar: "Save choice",
    cerrar: "Close without accepting anything",
    revocable: "You can change or withdraw this in “My permissions”.",
  },
};

const CSS = `
/* 🔴 EL TOPE ES 60vh Y NO 88vh, Y LA RESERVA DE ABAJO EXISTE: los dos, juntos, son la
   ficha #124. Medido el 09-08 con el panel abierto: a 88vh ocupaba el 87-88 % del alto
   en móvil y paisaje, y en escritorio su banda de 422 px se comía la ZONA DE SOLTAR
   entera (98-100 % del área de la zona #drop, cero franjas pulsables) — el paso más caro del
   embudo, inpulsable mientras el visitante no decidiera. De que el panel DEBA APARECER
   no se sigue que deba TAPAR.
   El tope NO esconde nada: overflow-y:auto ya estaba, así que el texto sigue entero y
   se lee desplazando DENTRO del panel. Eso descarta el remedio que parecía obvio —una
   tira mínima con «ver detalles»—, que en paisaje (390 px de alto) convertiría una
   decisión de privacidad en un clic a ciegas: una decisión que no se puede leer no es
   una decisión informada. */
#${ID_PANEL}{position:fixed;left:0;right:0;bottom:0;z-index:2147483000;
  background:var(--u5-surface-card, #0b1018);color:var(--u5-text-primary, #dfe4ee);border-top:1px solid var(--u5-border-strong, #2b3550);
  font:15px/1.6 -apple-system,BlinkMacSystemFont,"Segoe UI",Helvetica,Arial,sans-serif;
  box-shadow:0 -14px 40px rgba(0,0,0,.55);max-height:45vh;overflow-y:auto;
  padding-bottom:env(safe-area-inset-bottom,0)}
/* LA RESERVA. Un hueco al final del documento del alto exacto del panel, para que lo
   que el panel cubre se pueda traer a la vista desplazando la PÁGINA. Va como elemento
   propio y no como padding-bottom en el body porque el padding del body es de la
   página y pisarlo sería decidir por ella; esto sólo AÑADE, y se va con el panel. */
#${ID_RESERVA}{width:100%;flex:0 0 auto;pointer-events:none}
#${ID_PANEL} .cnt{max-width:1080px;margin:0 auto;padding:20px 22px 22px;position:relative}
#${ID_PANEL} h2{margin:0 0 6px;font-size:18px;color:var(--u5-accent, #e7c65a);letter-spacing:-.01em}
#${ID_PANEL} p{margin:0 0 10px;font-size:14px;color:var(--u5-text-strong, #c3cad8)}
#${ID_PANEL} b{color:var(--u5-text-primary, #eef1f7)}
/* margin-bottom 10 -> 5: es EL margen que gobierna, y no es obvio. El elemento que
   sobresalia bajo la barra era .pie, pero su margin-top NO manda: margenes adyacentes
   COLAPSAN a max(), asi que con .niveles en 10 cualquier valor de .pie por debajo de 10
   es inerte (medido: declarados 10 y 3, suma 13, max 10, distancia REAL 10). Por eso
   bajar .pie de 12 a 3 movio N solo 2 px. El knob es el VECINO. */
#${ID_PANEL} .niveles{display:grid;gap:10px;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));margin-bottom:5px}
#${ID_PANEL} .nivel{background:var(--u5-surface-base, #070b12);border:1px solid var(--u5-border-subtle, #1e2636);border-radius:9px;padding:9px 13px}
#${ID_PANEL} .nivel label{display:flex;gap:10px;align-items:flex-start;cursor:pointer;font-weight:600;color:var(--u5-text-primary, #eef1f7)}
#${ID_PANEL} .nivel input{margin:4px 0 0;width:17px;height:17px;flex:0 0 auto;accent-color:var(--u5-accent, #e7c65a);cursor:pointer}
#${ID_PANEL} .nivel .det{margin:7px 0 0 27px;font-size:13px;color:var(--u5-text-secondary, #9aa4ba);line-height:1.55}
/* (B) EL DETALLE, A UN GESTO — no retirado. El veto escrito de este panel sigue en pie
   («una decisión que no se puede leer no es una decisión informada»): la prosa completa
   de cada permiso NO se borra, se pliega, y se abre ANTES de decidir. Lo que queda
   siempre visible es lo que hace falta para elegir: el titular y el interruptor. */
#${ID_PANEL} .mas{margin:6px 0 0 27px}
#${ID_PANEL} .intro-mas{margin-left:0;margin-top:0}
/* 🔴 EL ROTULO DEL DISCLOSURE VA EN LA FILA DEL TITULO, no en una linea propia — y esto
   sale de una MEDICION, no del gusto: a 390x668 (el peor caso, iPhone SE) el segundo
   interruptor caia 52 px por debajo del techo de contenido, o sea escondido tras la barra
   de botones. Recortar espaciado dio 28 px y no llegaba; la linea suelta del rotulo valia
   30 px POR PERMISO. Subirlo a la fila del titulo devuelve los 60 y deja el caso peor con
   holgura. El contenido plegado sigue fluyendo debajo, sin cambiar. */
#${ID_PANEL} .nivel{position:relative}
#${ID_PANEL} .nivel .mas{margin:0}
#${ID_PANEL} .nivel .mas>summary{position:absolute;top:7px;right:11px;padding:6px 4px}
#${ID_PANEL} .nivel .mas .det{margin-top:6px}
#${ID_PANEL} .nivel label{padding-right:96px}
#${ID_PANEL} .mas>summary{cursor:pointer;font-size:13px;color:var(--u5-accent, #e7c65a);
  padding:4px 0;list-style:none;display:inline-block;min-height:24px}
#${ID_PANEL} .mas>summary::-webkit-details-marker{display:none}
#${ID_PANEL} .mas>summary::before{content:"▸ "}
#${ID_PANEL} .mas[open]>summary::before{content:"▾ "}
#${ID_PANEL} .mas>summary:focus-visible{outline:2px solid var(--u5-focus-color, #5aa8e7);outline-offset:2px}
#${ID_PANEL} .mas .det{margin:6px 0 0}
/* La clase grab ya no es un bloque suelto del panel cerrado: vive DENTRO del .det del primer
   desplegable, así que su margen separa de la prosa que tiene encima, no del resto del panel.
   (Sin comillas invertidas: este comentario vive DENTRO del literal de plantilla del CSS y
   una sola lo cerraría — es la trampa que el propio fichero avisa arriba, y hoy he caído en
   ella por SEGUNDA vez.) */
#${ID_PANEL} .grab{font-size:12.5px;color:var(--u5-text-tertiary, #8b94a8);margin:8px 0 0}
/* 🔴 LOS BOTONES DE DECISIÓN VAN PEGADOS AL FONDO DEL PANEL (#166), y esto NO es
   maquillaje: MEDIDO el 11-08 antes del arreglo, a 390×844 caían en el byte 974 de un
   viewport de 844 —130 px por debajo del pliegue, con 244 px de scroll DENTRO del
   panel— y a 390×668 (iPhone SE) con 349 px. Los DOS idiomas igual, así que no era
   longitud de texto. Eran ALCANZABLES (la ficha #124 lo garantiza y seguía verde) pero
   por un scroll interno sin borde que lo anuncie: el visitante veía un muro de prosa y
   ninguna forma aparente de decidir. «Alcanzable» y «se ve al llegar» son dos preguntas
   distintas sobre el mismo panel, y ésta es la segunda.
   Los márgenes negativos son los del relleno de .cnt (22 px): la barra llega de borde
   a borde y se apoya en el fondo real del panel, no sobre el relleno. Fondo OPACO a
   propósito — lo que quede por debajo pasa por detrás, no se transparenta encima. */
#${ID_PANEL} .btns{display:flex;flex-wrap:wrap;gap:10px;align-items:center;
  position:sticky;bottom:0;z-index:1;background:var(--u5-surface-card, #0b1018);
  border-top:1px solid var(--u5-border-subtle, #1e2636);
  margin:12px -22px -22px;padding:9px 22px 11px}
#${ID_PANEL} button.act{font:inherit;font-size:14px;font-weight:600;padding:10px 20px;
  border-radius:8px;border:1px solid var(--u5-border-control, #3a465f);background:var(--u5-surface-well, #151d2c);color:var(--u5-text-primary, #dfe4ee);cursor:pointer}
#${ID_PANEL} button.act:hover{border-color:var(--u5-accent-press, #b8952f);color:var(--u5-accent, #e7c65a)}
#${ID_PANEL} button.act:focus-visible{outline:2px solid var(--u5-focus-color, #5aa8e7);outline-offset:2px}
/* margin-top 12 -> 3: MEDIDO, no tanteado. Con 12 el pie sobresalia 7 px por debajo
   del borde SUPERIOR de la barra sticky en 390x668 (la barra lo tapaba). El recorte es
   de 9 px sobre el margen del PROPIO elemento que sobresalia, con 2 px de holgura. */
#${ID_PANEL} .pie{font-size:12px;color:var(--u5-text-quiet, #77809a);margin:3px 0 0}
#${ID_PANEL} .x{position:absolute;top:12px;right:16px;background:none;border:0;color:var(--u5-text-quiet, #77809a);
  font-size:20px;line-height:1;cursor:pointer;padding:4px 8px}
#${ID_PANEL} .x:hover{color:var(--u5-text-primary, #dfe4ee)}
@media (max-width:640px){#${ID_PANEL} .cnt{padding:16px 16px 18px}
  #${ID_PANEL} .btns button.act{flex:1 1 auto}}
/* ── EMPOTRADO (§anfitrion) — el MISMO panel dentro del flujo de la página ────────
   Sólo se anula lo que hace de él una BANDA FLOTANTE: la posición fija, el tope de
   alto, la sombra que lo despega y el relleno de safe-area. Todo lo demás —casillas,
   textos, botones, comportamiento— es el mismo nodo, así que no puede decir una cosa
   aquí y otra en la banda.
   🔴 NI UN ACENTO GRAVE EN ESTE COMENTARIO: vive DENTRO de una plantilla de JavaScript
   y uno solo la cierra a mitad (dos errores de sintaxis a 40 líneas de aquí, medido).
   🔴 Y SE VA EL BOTÓN ✕: cerrar tiene sentido en algo que TAPA, y esto no tapa nada.
   Peor: la ✕ GUARDA UN RECHAZO (ver la llamada a decide desde el oyente de la clase x),
   así que empotrado sería un botón que parece «ocultar esto» y en realidad decide por ti.
   El tope de 60vh también se va: aquí no hay nada debajo que proteger, y un panel de
   privacidad con scroll interno dentro de una página con scroll propio son dos barras
   anidadas para leer un texto que ya cabe. */
#${ID_PANEL}.empotrado{position:static;max-height:none;overflow-y:visible;box-shadow:none;
  border:1px solid var(--u5-border-strong, #2b3550);border-radius:10px;padding-bottom:0;
  margin:18px 0;scroll-margin-top:80px}
#${ID_PANEL}.empotrado .cnt{padding:18px 20px 20px}
#${ID_PANEL}.empotrado .x{display:none}
/* Y la barra pegajosa se DESPEGA aquí: sin tope de alto ni scroll propio no hay pliegue
   que salvar, y un sticky dentro del flujo de la página se agarraría al scroll de la
   PÁGINA — la barra seguiría al lector por un documento donde el panel ya cabe entero. */
#${ID_PANEL}.empotrado .btns{position:static;background:none;border-top:0;margin:14px 0 0;padding:0}
`;

export interface DepsPanel {
  readonly superficie: Superficie;
  readonly almacen: AlmacenSimple | null | undefined;
  readonly doc?: Document;
  /** Idioma vivo. Se consulta en cada apertura (la portada tiene botón ES/EN). */
  idioma(): Idioma;
  /** Se llama tras GUARDAR una elección (incluido el rechazo). */
  alDecidir(c: Consentimiento): void;
  /**
   * ANFITRIÓN OPCIONAL — dónde montar el panel. `null`/ausente = la banda flotante de
   * siempre, pegada abajo sobre `body`. Devolviendo un elemento, el MISMO panel se monta
   * DENTRO de él y en el flujo de la página (clase `empotrado`).
   *
   * 🔴 EXISTE POR /privacidad Y EL DEFECTO ES DE ESA PÁGINA: es la única del sitio cuyo
   * tema ES el consentimiento, y era la única que hablaba del panel sin ofrecerlo —
   * mandaba al pie, y encima nombrando el enlace equivocado («Privacidad y datos», que
   * lleva a la propia página en la que ya estás; el que abre el panel es «Mis permisos»).
   * Un documento que explica un control y no lo contiene obliga a un viaje para ejercer
   * lo que acaba de explicar.
   *
   * ★ SE PASA UNA FUNCIÓN Y NO UN ELEMENTO porque el panel se abre y se cierra muchas
   * veces sobre un DOM que cambia: resolver el anfitrión EN CADA APERTURA hace que un
   * host que aún no existe (script en el `<head>`) o que se ha ido no deje el panel
   * montado en un nodo huérfano — degrada a la banda flotante, que es el estado bueno.
   * Ésa es la regla de fallo elegida: sin anfitrión hay panel, nunca al revés.
   */
  anfitrion?(): HTMLElement | null | undefined;
}

export interface PanelConsentimiento {
  /** Abre el panel (para revocar/cambiar). Si ya está abierto, lo enfoca. */
  abre(): void;
  /** Lo quita del DOM sin guardar nada. */
  cierra(): void;
  /** ¿Está visible ahora mismo? */
  visible(): boolean;
}

/**
 * Crea el panel. NO lo muestra: quien decide si toca preguntar es `arranque.ts`
 * (se pregunta cuando `leerConsentimiento()` da `null`, es decir, sin decidir).
 */
export function creaPanelConsentimiento(deps: DepsPanel): PanelConsentimiento {
  const doc = deps.doc ?? document;
  // Del propio documento y no de la global: así el panel sigue funcionando montado en el
  // jsdom de los tests, donde `window` no es la ventana de ESTE documento.
  const win = doc.defaultView;
  let raiz: HTMLElement | null = null;

  function estilos(): void {
    if (doc.getElementById(ID_ESTILOS)) return;
    const st = doc.createElement("style");
    st.id = ID_ESTILOS;
    st.textContent = CSS;
    (doc.head ?? doc.documentElement).appendChild(st);
  }

  function decide(eleccion: Eleccion): void {
    const c = guardarConsentimiento(deps.almacen, eleccion);
    const empotrado = deps.anfitrion?.() != null;
    cierra();
    deps.alDecidir(c);
    // 🔴 EMPOTRADO: SE REABRE, y no es un parpadeo gratuito. `cierra()` QUITA el panel
    // del DOM, que es lo correcto para una banda flotante (ya decidiste, deja de tapar) y
    // exactamente lo contrario de lo que quiere una página empotrada: dejaría un HUECO
    // donde estaba el único control de permisos, en la página cuyo tema es el control de
    // permisos. Se vuelve a montar y las casillas salen con lo RECIÉN guardado, porque
    // `abre()` relee el almacén con `eleccionVigente` — o sea que la reapertura es además
    // el acuse de recibo: ves marcado lo que acabas de elegir.
    if (empotrado) abre();
  }

  /**
   * Mantiene el hueco del final del documento igual de alto que el panel.
   *
   * Se re-mide en `resize` porque el alto del panel depende del viewport (tope 60vh) y
   * del reflujo del texto: una reserva calculada UNA vez al abrir se queda corta al girar
   * el móvil, que es justo el caso donde el panel ocupa proporcionalmente más.
   */
  function ajustaReserva(): void {
    if (!raiz) return;
    let hueco = doc.getElementById(ID_RESERVA);
    if (!hueco) {
      hueco = doc.createElement("div");
      hueco.id = ID_RESERVA;
      hueco.setAttribute("aria-hidden", "true");
      (doc.body ?? doc.documentElement).appendChild(hueco);
    }
    hueco.style.height = `${Math.ceil(raiz.getBoundingClientRect().height)}px`;
  }

  function cierra(): void {
    raiz?.remove();
    raiz = null;
    // El hueco SE VA CON EL PANEL. Dejarlo sería un pie en blanco permanente en una
    // página que ya no tiene nada fijo abajo.
    doc.getElementById(ID_RESERVA)?.remove();
    win?.removeEventListener("resize", ajustaReserva);
  }

  function abre(): void {
    if (raiz) {
      raiz.querySelector<HTMLInputElement>("input")?.focus();
      return;
    }
    estilos();
    const t = TEXTOS[deps.idioma()] ?? TEXTOS.en;
    // Las casillas reflejan lo YA elegido al reabrir (para poder retirar un permiso
    // viéndolo marcado); en la primera visita `eleccionVigente(null)` da todo apagado.
    const vig = eleccionVigente(leerConsentimiento(deps.almacen));

    const el = doc.createElement("div");
    el.id = ID_PANEL;
    el.setAttribute("role", "dialog");
    el.setAttribute("aria-modal", "false");
    el.setAttribute("aria-labelledby", `${ID_PANEL}-h`);
    el.innerHTML = `
      <div class="cnt">
        <button class="x" type="button" aria-label="${esc(t.cerrar)}">✕</button>
        <h2 id="${ID_PANEL}-h">${esc(t.titulo)}</h2>
        <p>${t.intro}</p>
        <details class="mas intro-mas"><summary>${esc(t.verDetalles)}</summary>
          <div class="det">${t.introMas}${
            // 🔴 EL AVISO DE GRABACIÓN VIVE AQUÍ DENTRO, no suelto en el panel cerrado. Antes
            // era su propio `<details class="mas grab">`, y eso lo dejaba como un «Ver
            // detalles» SIN RÓTULO QUE LO ENCABEZARA: los otros tres cuelgan de un titular o
            // de un interruptor y éste no colgaba de nada. En la captura del iPhone SE es
            // justo el que salía cortado por el borde. Sacarlo del estado cerrado devuelve
            // 43 px MEDIDOS y de paso quita el huérfano.
            permiteGrabacionSesion(deps.superficie) ? `<p class="grab">${esc(t.grabacion)}</p>` : ""
          }</div></details>
        <div class="niveles">
          <div class="nivel">
            <label><input type="checkbox" id="${ID_PANEL}-analitica"${vig.analitica ? " checked" : ""}>
              <span>${esc(t.analiticaTitulo)}</span></label>
            <details class="mas"><summary>${esc(t.verDetalles)}</summary>
              <div class="det">${t.analiticaDetalle}</div></details>
          </div>
          <div class="nivel">
            <label><input type="checkbox" id="${ID_PANEL}-partida"${vig.partida ? " checked" : ""}>
              <span>${esc(t.partidaTitulo)}</span></label>
            <details class="mas"><summary>${esc(t.verDetalles)}</summary>
              <div class="det">${t.partidaDetalle}</div></details>
          </div>
        </div>
        <p class="pie">${esc(t.revocable)}</p>
        <div class="btns">
          <button class="act" type="button" data-accion="rechazar">${esc(t.rechazar)}</button>
          <button class="act" type="button" data-accion="guardar">${esc(t.guardar)}</button>
        </div>
      </div>`;

    const casilla = (sufijo: string): boolean =>
      el.querySelector<HTMLInputElement>(`#${ID_PANEL}-${sufijo}`)?.checked === true;

    el.querySelector<HTMLButtonElement>('[data-accion="rechazar"]')!.addEventListener(
      "click",
      () => decide({ analitica: false, partida: false }),
    );
    el.querySelector<HTMLButtonElement>('[data-accion="guardar"]')!.addEventListener(
      "click",
      () => decide({ analitica: casilla("analitica"), partida: casilla("partida") }),
    );
    // ✕ y Escape: cerrar sin aceptar NADA. Guarda el rechazo explícito para no
    // volver a preguntar en cada carga — el silencio ya significaba «no».
    el.querySelector<HTMLButtonElement>(".x")!.addEventListener("click", () =>
      decide({ analitica: false, partida: false }),
    );
    el.addEventListener("keydown", (e) => {
      if ((e as KeyboardEvent).key === "Escape") {
        e.stopPropagation(); // que no le llegue al juego (Escape cierra sus paneles)
        decide({ analitica: false, partida: false });
      }
    });

    // ¿Anfitrión? Se resuelve AQUÍ, en cada apertura, no una vez al crear el panel
    // (ver `DepsPanel.anfitrion`): un host que aún no existe degrada a banda flotante.
    const host = deps.anfitrion?.() ?? null;
    if (host) el.classList.add("empotrado");
    (host ?? doc.body ?? doc.documentElement).appendChild(el);
    raiz = el;
    // 🔴 LA RESERVA ES SÓLO DE LA BANDA FLOTANTE. Empotrado el panel ocupa su sitio en el
    // flujo —no cubre nada—, así que el hueco del final sería una franja en blanco al pie
    // de la página sin nada que compensar. La reserva existe para lo que TAPA (#124).
    if (!host) {
      // La reserva se crea DESPUÉS de montar: antes el panel no tiene alto que medir.
      ajustaReserva();
      win?.addEventListener("resize", ajustaReserva);
    }
    // 🔴 Y EL FOCO TAMPOCO SE ROBA CUANDO ESTÁ EMPOTRADO: la banda aparece ENCIMA y pide
    // una decisión, así que llevar el foco a su primera casilla es lo correcto. Empotrado,
    // el panel es un párrafo más de un documento que se está leyendo desde arriba: saltar
    // el foco a mitad de página al cargar mueve el lector a un sitio que no pidió y, con
    // lector de pantalla, se salta el texto que explica lo que va a decidir.
    if (!host) el.querySelector<HTMLInputElement>("input")?.focus();
  }

  return { abre, cierra, visible: () => raiz !== null };
}

