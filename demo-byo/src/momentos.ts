/**
 * MOMENTOS LEGENDARIOS — la galería de `/byo` (spec 2026-08-08).
 *
 * Diez partidas prefabricadas en los momentos clave de Ultima V. Se añaden UNA A UNA a las
 * partidas de este navegador y se juegan libremente desde ahí.
 *
 * ── QUÉ HAY AQUÍ Y QUÉ NO ───────────────────────────────────────────────────────────────
 * Aquí vive la PANTALLA: el botón, el modal, las diez tarjetas y el estado de cada botón.
 * La instalación —que arrastra el modelo del juego entero— vive en `momentos-instala.ts` y
 * entra por `import()` al primer clic, igual que `minimapa.ts` y `iconos.ts`: quien no abre
 * el modal no paga ese chunk.
 *
 * ── «AÑADIDO ✓» SE LEE DEL ALMACÉN, NO DE UNA VARIABLE ──────────────────────────────────
 * 🔴 Exigencia del spec (decisión #5) y no un detalle: el momento sembrado es un save NORMAL
 * y el jugador puede BORRARLO desde el juego o desde el botón «borrar» de esta misma página.
 * Un booleano de sesión seguiría diciendo «Añadido ✓» sobre una partida que ya no existe —
 * un botón apagado que afirma algo falso, y encima sin forma de volver a añadirlo. Leyendo
 * `readSaveIndex()` cada vez que se pinta, el estado sobrevive a la recarga PORQUE no lo
 * guarda nadie: es el almacén el que lo sabe.
 * El predicado ya no vive aquí: lo calcula `insignias.ts` JUNTO al de «jugado», para que la
 * insignia y el estado del botón no puedan discrepar. Lo que se movió es dónde se calcula;
 * el criterio es el mismo y sigue sin persistirse.
 *
 * ── LLEGAR POR UN ENLACE COMPARTIDO ─────────────────────────────────────────────────────
 * `…/byo?momento=momento-07` abre esta galería con esa tarjeta destacada y el foco en su
 * botón. **No se siembra nada solo**: el enlace deja el momento delante y el clic sigue
 * siendo del visitante, que es la confirmación — un enlace que escribiera en el almacén de
 * quien lo abre sería otra clase de cosa. Los tres casos que no pueden abrir (enlace roto,
 * momento no disponible, sin extracción) se dicen ARRIBA, junto al botón de la galería, en
 * vez de abrir un modal que sólo serviría para dar una mala noticia; ver `comparte.ts`.
 *
 * ── LAS «PRÓXIMAMENTE» SE ENSEÑAN, Y HOY NO HAY NINGUNA ─────────────────────────────────
 * Con su título y su línea, y SIN botón. La regla de esta pantalla es que no hay controles
 * muertos (`partidas.ts`): una tarjeta que se pudiera pulsar y no sembrara nada sería
 * exactamente eso. Enseñarlas cuesta una línea cada una y dice el mapa completo de lo que va
 * a haber.
 *
 * 🔴 AQUÍ PONÍA «LAS NUEVE», Y ERA UNA CIFRA CONGELADA A MANO que describía una población
 * que ya no existe (corregido el 12-08-2026, ficha #204). `hornea.mjs:57` deriva
 * `disponible: m.estado !== undefined`, y **los diez momentos de `game/src/momentos/defs.ts`
 * tienen `estado`** desde que cerraron #114/#117/#119: hoy la galería pinta CERO
 * «Próximamente». El rótulo se queda porque un momento nuevo entra sin `estado` y vuelve a
 * necesitarlo — lo que no puede quedarse es el NÚMERO, que no lo deriva nadie y por tanto
 * envejece sin que nada avise. La regla, dicha aquí para el siguiente: en un comentario
 * junto a un derivador se describe la REGLA, nunca el cardinal que la regla produjo un día.
 */
import { readSaveIndex } from "../../game/src/core/save-keys.js";
import { eventoVivo } from "../../game/src/web/analitica-viva.js";
import { idiomaActual } from "../../game/src/web/arranque.js";
import { EV } from "../../game/src/web/eventos.js";
import { decideLlegada, enlaceDeMomento, momentoDeLaUrl, type Llegada } from "./comparte.js";
import { txt } from "./idioma.js";
import { insignias, leeAperturas, type Insignia } from "./insignias.js";

/** Una entrada del catálogo horneado (`demo-byo/momentos/hornea.mjs`). */
interface EntradaCatalogo {
  id: string;
  acto: number;
  titulo: { es: string; en: string };
  ambiente: { es: string; en: string };
  lugar: { es: string; en: string };
  miniatura: string;
  disponible: boolean;
}

let catalogo: EntradaCatalogo[] | null = null;
let dlg: HTMLDialogElement | null = null;
/** Aviso bajo la lista: el resultado de la última acción, o un fallo con su causa. */
let aviso = "";
/** Qué hacer cuando la lista de partidas de la página tiene que repintarse. */
let alCambiar: (() => void) | null = null;
/** Tarjeta que hay que destacar al abrir (la del enlace compartido), o `null`. */
let destacado: string | null = null;
/**
 * Lo que el enlace compartido dejó dicho ARRIBA, junto al botón de la galería, cuando no se
 * podía abrir. Vive fuera de `instalaBotonMomentos` porque esa función se vuelve a llamar en
 * cada cambio de idioma: si el aviso fuera un argumento, cambiar de idioma lo borraría.
 */
let avisoEnlace: Llegada = { k: "nada" };
/**
 * Con qué se montó el botón. Se guarda para poder REPINTAR el bloque cuando el aviso del
 * enlace llegue: `atiendeEnlaceCompartido` es asíncrona (espera al catálogo) y termina DESPUÉS
 * de que `main.ts` haya montado el botón, así que sin esto el aviso no aparecería hasta el
 * siguiente cambio de idioma — es decir, nunca, para casi todo el mundo.
 */
let montaje: { raiz: HTMLElement; estado: () => boolean; alRefrescar: () => void } | null = null;

const lang = (): "es" | "en" => idiomaActual();

function el(tag: string, cls: string, texto?: string): HTMLElement {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (texto !== undefined) n.textContent = texto;
  return n;
}

/**
 * Las insignias de todos los momentos, LEÍDAS AHORA. Da a la vez el «añadido» (que decide el
 * estado del botón) y el «jugado» (que sólo se enseña): un único cálculo, en `insignias.ts`,
 * para que el botón y la marca no puedan contar cosas distintas del mismo momento.
 */
function marcas(): Map<string, Insignia> {
  return insignias(readSaveIndex(), leeAperturas());
}

/** El catálogo, pedido una vez. Un fallo devuelve `[]` y el modal lo dice. */
async function leeCatalogo(): Promise<EntradaCatalogo[]> {
  if (catalogo) return catalogo;
  try {
    const r = await fetch("/momentos/momentos.json");
    if (!r.ok) throw new Error(String(r.status));
    catalogo = (await r.json()) as EntradaCatalogo[];
  } catch {
    catalogo = [];
  }
  return catalogo;
}

/** Pinta (o repinta) la lista dentro del modal. Idempotente y sin memoria. */
function pintaLista(cont: HTMLElement, entradas: EntradaCatalogo[], hayCopia: boolean): void {
  cont.textContent = "";
  if (entradas.length === 0) {
    cont.appendChild(el("p", "guardados__vacio", txt("momentosSinCatalogo")));
    return;
  }
  const marca = marcas();
  const lista = el("ul", "momentos__lista");
  /** La tarjeta destacada por el enlace, para llevarla a la vista cuando esté en el DOM. */
  let tarjetaDestacada: HTMLElement | null = null;
  let botonDestacado: HTMLButtonElement | null = null;
  for (const m of entradas) {
    const ins = marca.get(m.id);
    const li = el("li", "momento");
    const info = el("div", "momento__info");
    info.appendChild(el("small", "momento__acto", txt("momentoActo", { n: String(m.acto) })));
    info.appendChild(el("b", "momento__titulo", m.titulo[lang()] ?? m.titulo.en));
    info.appendChild(el("small", "momento__ambiente", m.ambiente[lang()] ?? m.ambiente.en));
    // ── LA INSIGNIA DE «JUGADO» ─────────────────────────────────────────────────────────
    // Sólo ésta, y no una de «añadido» al lado: «Añadido ✓» YA lo dice el estado de la
    // derecha, y repetirlo en la misma tarjeta con otras palabras sería el visitante
    // preguntándose si son dos hechos distintos. Los dos predicados salen del mismo sitio
    // (`insignias.ts`); lo que cambia es dónde se enseña cada uno.
    if (ins?.jugado) {
      info.appendChild(el("span", "momento__insignia", txt("momentoJugado")));
    }
    li.appendChild(info);

    if (!m.disponible) {
      li.appendChild(el("span", "momento__estado", txt("momentoProximamente")));
    } else if (ins?.anadido) {
      // Ya está: se dice, y NO se ofrece añadirlo otra vez. El enlace a jugarlo NO se pone
      // aquí — está en su tarjeta de la lista de partidas, que es donde vive esa partida.
      li.appendChild(el("span", "momento__estado momento__estado--hecho", txt("momentoAnadido")));
    } else if (!hayCopia) {
      // Sin extracción no hay con qué componer el save (ver `momentos-instala.ts`), igual que
      // no hay con qué jugar. Se dice el porqué en vez de dejar un botón que fallaría.
      li.appendChild(el("span", "momento__estado", txt("momentoSinCopia")));
    } else {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "momento__anadir";
      b.textContent = txt("momentoAnadir");
      b.addEventListener("click", () => void anade(m, b, cont, entradas, hayCopia));
      li.appendChild(b);
      if (m.id === destacado) botonDestacado = b;
    }
    // «Copiar enlace» va en TODAS las tarjetas, incluidas las de «Próximamente» y las que ya
    // están añadidas: compartir un momento no depende de que TÚ puedas sembrarlo ahora.
    li.appendChild(botonCopiar(m.id, cont, entradas, hayCopia));
    if (m.id === destacado) {
      li.classList.add("momento--destacado");
      tarjetaDestacada = li;
    }
    lista.appendChild(li);
  }
  cont.appendChild(lista);
  if (aviso) cont.appendChild(el("p", "guardados__nota", aviso));
  // 🔴 DESPUÉS de meter la lista en el documento: `scrollIntoView` sobre un nodo que todavía
  // no está en el DOM no hace nada y no da error — la tarjeta compartida se habría quedado
  // sin llevar a la vista en las listas largas, en silencio.
  if (tarjetaDestacada) {
    tarjetaDestacada.scrollIntoView({ block: "center" });
    // El foco va al botón que el enlace vino a ofrecer, no a la tarjeta: quien llega por un
    // enlace compartido y navega con teclado tiene la acción bajo el dedo. Si ese momento ya
    // está añadido no hay botón, y entonces no se roba el foco a nadie.
    botonDestacado?.focus();
  }
}

/**
 * El botón «Copiar enlace» de una tarjeta.
 *
 * 🔴 EL FALLO NO ES SILENCIOSO Y NO NECESITA UI PROPIA. `navigator.clipboard` no existe en
 * contexto inseguro (http:// que no sea localhost) y puede rechazar por permisos; en ese caso
 * el enlace se ESCRIBE en el aviso de abajo, que es texto seleccionable y ya existe para esto.
 * Un botón que no hace nada y no dice nada se lee como una pantalla rota.
 */
function botonCopiar(
  id: string,
  cont: HTMLElement,
  entradas: EntradaCatalogo[],
  hayCopia: boolean,
): HTMLButtonElement {
  const b = document.createElement("button");
  b.type = "button";
  b.className = "momento__copiar";
  b.textContent = txt("momentoCopiar");
  b.addEventListener("click", () => {
    const url = enlaceDeMomento(id, location.href);
    void navigator.clipboard
      ?.writeText(url)
      .then(() => {
        // El rótulo del propio botón, no un aviso al pie: la confirmación tiene que estar
        // donde estaba el dedo. Se deshace en el siguiente repintado, que es lo correcto —
        // «copiado» es de hace un segundo, no un estado de la tarjeta.
        b.textContent = txt("momentoCopiado");
      })
      .catch(() => {
        aviso = txt("momentoCopiarManual", { url });
        pintaLista(cont, entradas, hayCopia);
      });
    if (!navigator.clipboard) {
      aviso = txt("momentoCopiarManual", { url });
      pintaLista(cont, entradas, hayCopia);
    }
  });
  return b;
}

/** El clic de «Añadir a mis partidas». */
async function anade(
  m: EntradaCatalogo,
  boton: HTMLButtonElement,
  cont: HTMLElement,
  entradas: EntradaCatalogo[],
  hayCopia: boolean,
): Promise<void> {
  boton.disabled = true;
  boton.textContent = txt("momentoAnadiendo");
  try {
    const { instalaMomento, generaShotDelMomento } = await import("./momentos-instala.js");
    const { momentoPorId } = await import("../../game/src/momentos/defs.js");
    const def = momentoPorId(m.id);
    if (!def) throw new Error(`sin def para ${m.id}`);
    await instalaMomento(def);
    // ── LA CAPTURA VA DESPUÉS Y SU FALLO NO TUMBA NADA ────────────────────────────────
    // La partida YA está sembrada en la línea de arriba; esto sólo le pone la foto,
    // arrancando el juego sobre ella en un iframe oculto. Es la misma separación que
    // `persistence.ts:92-97` hace entre el dato y su ilustración: perder el momento por no
    // poder pintar una miniatura sería un intercambio absurdo. Por eso ni se espera su
    // resultado para dar el momento por añadido ni se propaga su error.
    boton.textContent = txt("momentoPintando");
    await generaShotDelMomento(def.id).catch(() => false);
    aviso = txt("momentoHecho", { titulo: m.titulo[lang()] ?? m.titulo.en });
    // El id del CATÁLOGO (`m01`…), que es material nuestro: ni contenido del juego ni
    // nada que el visitante escribiera. Va aquí y no antes del `catch`: sólo cuenta el
    // momento que de verdad quedó sembrado.
    eventoVivo(EV.BYO_MOMENTO_ANADIDO, { momento: def.id });
    // La lista de partidas de la página de detrás tiene una entrada más: se repinta, o el
    // visitante cerraría el modal y vería la lista de antes.
    alCambiar?.();
  } catch (e) {
    const nombre = e instanceof Error ? e.name : "";
    aviso =
      nombre === "ErrorSinCopia"
        ? txt("momentoSinCopia")
        : txt("momentoFallo", { motivo: e instanceof Error ? e.message : String(e) });
  }
  // Se repinta ENTERO desde el almacén: así el botón que acaba de sembrar pasa a «Añadido ✓»
  // por la misma lectura que lo haría tras recargar, y no por haber recordado que lo pulsé.
  pintaLista(cont, entradas, hayCopia);
}

function cierra(): void {
  dlg?.close();
}

function desmonta(): void {
  dlg?.remove();
  dlg = null;
}

/**
 * Abre la galería. `hayCopia` = este navegador tiene la extracción.
 *
 * `destacar` = el momento que trajo un enlace compartido: su tarjeta sale marcada, se lleva a
 * la vista y se le da el foco al botón. Ausente = apertura normal por el botón, sin destacado
 * (por eso se REINICIA aquí: si no, un enlace seguido al principio de la sesión seguiría
 * destacando su tarjeta en todas las aperturas posteriores).
 */
export async function abreMomentos(hayCopia: boolean, destacar?: string): Promise<void> {
  desmonta(); // una segunda llamada reemplaza a la anterior, sin dejarla en el DOM
  aviso = "";
  destacado = destacar ?? null;
  dlg = document.createElement("dialog");
  dlg.className = "momentos-modal";
  dlg.setAttribute("aria-label", txt("momentosTitulo"));

  const barra = el("div", "momentos-modal__barra");
  barra.appendChild(el("strong", "", txt("momentosTitulo")));
  const cerrar = document.createElement("button");
  cerrar.type = "button";
  cerrar.className = "momentos-modal__cerrar";
  cerrar.textContent = txt("replayCerrar");
  cerrar.addEventListener("click", cierra);
  barra.appendChild(cerrar);

  const cuerpo = el("div", "momentos-modal__cuerpo");
  cuerpo.appendChild(el("p", "guardados__que", txt("momentosQue")));
  const lista = el("div", "momentos-modal__lista");
  lista.appendChild(el("p", "guardados__vacio", txt("momentosCargando")));
  cuerpo.append(lista);

  dlg.append(barra, cuerpo);
  dlg.addEventListener("click", (ev) => {
    if (ev.target === dlg) cierra();
  });
  // Único punto de desmontaje: aquí llegan el botón, el fondo y el Escape (misma razón que
  // `popover-replay.ts`, donde tres rutas y un desmontaje en una de ellas costó un rojo).
  dlg.addEventListener("close", desmonta);
  document.body.appendChild(dlg);
  dlg.showModal();
  cerrar.focus();

  pintaLista(lista, await leeCatalogo(), hayCopia);
}

/**
 * Monta el botón «Momentos legendarios» dentro de `raiz`.
 *
 * `estado()` se consulta EN EL CLIC y no al montar: entre que la página carga y alguien
 * pulsa, puede haber soltado la carpeta (y entonces sí hay copia). `alRefrescar` es lo que
 * hay que llamar cuando el almacén cambia — la lista de partidas de la página.
 */
export function instalaBotonMomentos(
  raiz: HTMLElement,
  estado: () => boolean,
  alRefrescar: () => void,
): void {
  alCambiar = alRefrescar;
  montaje = { raiz, estado, alRefrescar };
  raiz.textContent = "";
  const b = document.createElement("button");
  b.type = "button";
  b.className = "momentos__abrir";
  b.textContent = txt("momentosAbrir");
  b.addEventListener("click", () => void abreMomentos(estado()));
  raiz.appendChild(b);
  raiz.appendChild(el("small", "momentos__que", " " + txt("momentosAbrirQue")));
  // El aviso del enlace compartido, si lo hubo. Se repinta con el resto (y por eso vive en
  // una variable de módulo): cambiar de idioma no puede tragárselo.
  const t = textoDelAviso(avisoEnlace);
  if (t) raiz.appendChild(el("p", "momentos__enlace", t));
}

/** El texto de un enlace que NO pudo abrir la galería. `""` = no hay nada que decir. */
function textoDelAviso(ll: Llegada): string {
  switch (ll.k) {
    case "desconocido":
      return txt("enlaceDesconocido", { id: ll.id });
    case "proximamente":
      return txt("enlaceProximamente");
    case "sinCopia":
      return txt("enlaceSinCopia");
    default:
      return "";
  }
}

/**
 * ATIENDE UN ENLACE COMPARTIDO (`…/byo?momento=momento-07`). Devuelve lo que decidió, para
 * que quien llama pueda saber si quedó pendiente.
 *
 * 🔴 SE PUEDE LLAMAR VARIAS VECES, y se hace: `main.ts` la llama al cargar y OTRA VEZ cuando
 * termina una extracción. Ésa es la vía por la que un enlace seguido sin la copia acaba
 * cumpliéndose — el visitante lee el aviso, suelta su carpeta, y la galería se abre sola en la
 * tarjeta que pidió, sin tener que acordarse del enlace ni volver a pincharlo. La idempotencia
 * la da que la decisión se recalcula ENTERA cada vez desde la URL, el catálogo y `hayCopia`:
 * no hay estado que arrastre la respuesta anterior.
 */
export async function atiendeEnlaceCompartido(hayCopia: boolean): Promise<Llegada> {
  const ll = decideLlegada(momentoDeLaUrl(location.search), await leeCatalogo(), hayCopia);
  avisoEnlace = ll;
  if (montaje) instalaBotonMomentos(montaje.raiz, montaje.estado, montaje.alRefrescar);
  if (ll.k === "abre") await abreMomentos(hayCopia, ll.id);
  return ll;
}
