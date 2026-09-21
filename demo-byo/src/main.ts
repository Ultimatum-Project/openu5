/**
 * UI de la demo BYO-files: drop de carpeta → validación → extracción en el
 * navegador (extractor/src/browser.ts) → registro del SW → jugar.
 */
import {
  collectDropped,
  collectFiles,
  clearExtraction,
  collectZip,
  esZip,
  extractToCache,
  hasExtraction,
  inspectSource,
  type SourceFiles,
  type SourceInspection,
} from "../../extractor/src/browser.js";
import { idiomaActual, instalaConsentimiento } from "../../game/src/web/arranque.js";
import { EV } from "../../game/src/web/eventos.js";
import { instalaIdiomaByo, txt } from "./idioma.js";
import { atiendeEnlaceCompartido, instalaBotonMomentos } from "./momentos.js";
import { borraTodo, leeInventario, pintaPartidas, type Inventario } from "./partidas.js";
import { mountUltimatumImporter, type UltimatumImportController } from "./ultimatum-import.js";

// Consentimiento (carril 1) ANTES que nada: mientras no haya permiso, `evento()`
// descarta y no se carga ningún SDK. Los hitos de abajo son el embudo del BYO —
// el único dato que cambia decisiones: dónde se pierde la gente en la mayor
// fricción del proyecto.
// `eventoLlegada` y no un `evento()` suelto debajo: en la PRIMERA visita ese suelto
// se emite antes de que exista permiso y se descarta, así que quien acepta mandaba
// el consentimiento y ninguna visita. Ver el porqué medido en `arranque.ts`.
const { analitica } = instalaConsentimiento({ superficie: "byo", eventoLlegada: EV.BYO_VISTO });

// IDIOMA: reusa el resolvedor COMPARTIDO (`openu5-lang`) para que la elección hecha en la
// portada VIAJE hasta aquí. Ver la cabecera de `idioma.ts` para el criterio de la capa 2.
instalaIdiomaByo();

const drop = document.getElementById("drop")!;
const picker = document.getElementById("picker") as HTMLInputElement;
const logEl = document.getElementById("log")!;
const estadoEl = document.getElementById("estado")!;
const play = document.getElementById("play") as HTMLButtonElement;

function log(msg: string, cls = ""): void {
  const line = document.createElement("div");
  if (cls) line.className = cls;
  line.textContent = msg;
  logEl.appendChild(line);
  logEl.scrollTop = logEl.scrollHeight;
}

// ─────────────────────────────────────────────────────────────────────────────────────
// LOS CINCO ESTADOS DE LA ZONA DE CARGA
//
// El defecto que cierran (auditoría de páginas, J2): la página tenía UN estado — una
// caja de puntos y un botón cuya condición de aparición nunca se explicaba. Los cuatro
// fallos son más probables que el acierto en el primer intento, y cada uno pide un
// siguiente paso DISTINTO: por eso no pueden compartir un error genérico.
//
// 🔴 REGLA QUE GOBIERNA EL CONTENIDO: se pinta LA EVIDENCIA, NO EL VEREDICTO. El
// extractor sabe (a) qué ficheros faltan y (b) cuáles miden otra cosa — nada más. No
// sabe qué edición tienes, así que no lo dice. El fichero con sus dos cifras dice
// exactamente lo que sabemos y no envejece.
//
// 🔴 Y NINGÚN CARDINAL ESTÁ ESCRITO AQUÍ: los 31 exigidos y los 17 con tamaño
// comprobable salen de `REQUIRED_FILES` vía `inspectSource`. La propuesta de rediseño
// decía «27 FILES» seis veces, y prometía una comprobación de `AVATAR.EXE` que el
// extractor no hace (ese fichero NO está en la tabla). La FORMA sale de la maqueta;
// los DATOS, del validador. Nunca al revés.
// ─────────────────────────────────────────────────────────────────────────────────────

type Estado =
  | { k: "vacio" }
  | { k: "leyendo"; fase: "leyendo" | "extrayendo" }
  | { k: "incompleto"; insp: SourceInspection }
  | { k: "otraEdicion"; insp: SourceInspection; src: SourceFiles }
  | { k: "listo"; assets: number | null }
  // 🔴 `titulo` YA FORMADO, no un `motivo` que el pintor envuelva en «La extracción
  // falló: …». Un zip que no se puede abrir NO es una extracción fallida: la
  // extracción ni empezó. Envolverlo daba «Extraction failed: I couldn't open that
  // .zip», que nombra mal la fase donde murió y manda a mirar al sitio equivocado.
  | { k: "fallo"; titulo: string };

let estado: Estado = { k: "vacio" };

/** Miles con el separador del idioma vigente (39.424 en es · 39,424 en en). */
function num(n: number): string {
  return n.toLocaleString(idiomaActual() === "es" ? "es-ES" : "en-US");
}

/** Crea un elemento con texto plano. TEXTO, nunca `innerHTML`: aquí entran datos. */
function el(tag: string, cls: string, texto?: string): HTMLElement {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (texto !== undefined) n.textContent = texto;
  return n;
}

function boton(rotulo: string, alPulsar: () => void): HTMLButtonElement {
  const b = document.createElement("button");
  b.type = "button";
  b.textContent = rotulo;
  b.addEventListener("click", alPulsar);
  return b;
}

/**
 * Pinta el estado vigente. Idempotente y sin memoria: se le puede llamar otra vez al
 * cambiar de idioma (y así se hace, más abajo) porque reconstruye el panel entero
 * desde `estado`.
 */
function pinta(): void {
  estadoEl.textContent = "";
  const caja = el("div", "est");
  estadoEl.appendChild(caja);
  const censo = (i: SourceInspection): void => {
    caja.appendChild(
      el(
        "div",
        "est__censo",
        txt("censo", { correctos: num(i.correctos), total: num(i.total) }),
      ),
    );
  };
  // El alcance de la comprobación de tamaño viaja PEGADO a la afirmación que lo usa,
  // no en una nota al pie: son 17 de 31, y sin decirlo «esto no es la edición DOS» se
  // lee como un veredicto sobre los 31.
  const alcance = (i: SourceInspection): void => {
    caja.appendChild(
      el(
        "p",
        "est__alcance",
        txt("alcanceTamano", {
          medibles: num(i.medibles),
          total: num(i.total),
          resto: num(i.total - i.medibles),
        }),
      ),
    );
  };

  switch (estado.k) {
    case "vacio": {
      const i = inspectSource(new Map());
      caja.appendChild(el("h2", "est__titulo", txt("vacioTitulo")));
      caja.appendChild(el("p", "est__cuerpo", txt("vacioCuerpo", { total: num(i.total) })));
      break;
    }
    case "leyendo": {
      caja.className = "est est--parcial";
      caja.appendChild(el("h2", "est__titulo", txt(estado.fase)));
      break;
    }
    case "incompleto": {
      const i = estado.insp;
      caja.className = "est est--falta";
      censo(i);
      caja.appendChild(
        el(
          "h2",
          "est__titulo",
          i.missing.length === 1
            ? txt("faltaUno")
            : txt("faltanVarios", { n: num(i.missing.length) }),
        ),
      );
      const lista = el("ul", "est__evidencia");
      // Los nombres son de EA y son literales: no se traducen ni se truncan a un «y N
      // más». Quien mira esta lista está buscando cuál le falta.
      for (const nombre of i.missing) lista.appendChild(el("li", "", nombre));
      caja.appendChild(lista);
      caja.appendChild(el("p", "est__cuerpo", txt("faltanCuerpo")));
      const acciones = el("div", "est__acciones");
      acciones.appendChild(boton(txt("otraCarpeta"), () => picker.click()));
      const ver = document.createElement("a");
      ver.href = idiomaActual() === "es" ? "/jugar" : "/en/play";
      ver.textContent = txt("verLista");
      acciones.appendChild(ver);
      caja.appendChild(acciones);
      break;
    }
    case "otraEdicion": {
      const i = estado.insp;
      const fuente = estado.src;
      caja.className = "est est--parcial";
      censo(i);
      const lista = el("ul", "est__evidencia");
      for (const m of i.sizeMismatch)
        lista.appendChild(
          el(
            "li",
            "",
            txt("midePero", {
              nombre: m.name,
              size: num(m.size),
              expected: num(m.expected),
            }),
          ),
        );
      caja.appendChild(lista);
      caja.appendChild(el("p", "est__cuerpo", txt("otraEdicionCuerpo")));
      const acciones = el("div", "est__acciones");
      // «Intentarlo igualmente» NO es un adorno: el aviso dice literalmente que puede
      // funcionar en parte, y negar el intento sería afirmar más de lo que sabemos.
      acciones.appendChild(boton(txt("intentarIgual"), () => void extrae(fuente)));
      acciones.appendChild(boton(txt("otraCarpeta"), () => picker.click()));
      caja.appendChild(acciones);
      alcance(i);
      break;
    }
    case "listo": {
      caja.className = "est est--listo";
      caja.appendChild(
        el(
          "h2",
          "est__titulo",
          estado.assets === null
            ? txt("extraccionPrevia")
            : txt("extraccionOk", { n: num(estado.assets) }),
        ),
      );
      // 🔴 NO se promete «y funciona sin conexión a partir de ahora»: esa frase de la
      // propuesta está REFUTADA (ficha #65 — el sitio no guarda su propia página para
      // uso sin conexión). Lo que sí es cierto es que no hay que repetir el paso.
      // UN solo párrafo (directriz de concisión, 08-2026): qué hace el botón, que no
      // se repite la carga, y dónde quedan las partidas — ver `listoCuerpo` en idioma.ts.
      caja.appendChild(el("p", "est__cuerpo", txt("listoCuerpo")));
      break;
    }
    case "fallo": {
      caja.className = "est est--falta";
      caja.appendChild(el("h2", "est__titulo", estado.titulo));
      const acciones = el("div", "est__acciones");
      acciones.appendChild(boton(txt("otraCarpeta"), () => picker.click()));
      caja.appendChild(acciones);
      break;
    }
  }
}

function ve(e: Estado): void {
  estado = e;
  pinta();
}

// El panel SIGUE AL IDIOMA. Sin esto, quien cambia de idioma con ficheros ya soltados se
// queda con el diagnóstico en el idioma anterior — y el diagnóstico es justo lo que más
// importa leer. `aplicaIdioma` emite este evento en cada cambio.
window.addEventListener("openu5:lang", () => pinta());

async function registerSw(): Promise<void> {
  if (!("serviceWorker" in navigator)) {
    throw new Error(txt("sinSW"));
  }
  const reg = await navigator.serviceWorker.register("/sw.js");
  await navigator.serviceWorker.ready;
  // Si el SW acaba de instalarse, reclamar esta página puede tardar un tick.
  if (!navigator.serviceWorker.controller) {
    await new Promise<void>((res) => {
      const t = setTimeout(res, 1500); // fallback: la navegación ya irá controlada
      navigator.serviceWorker.addEventListener("controllerchange", () => {
        clearTimeout(t);
        res();
      }, { once: true });
    });
  }
  void reg;
}

/** Extracción propiamente dicha: estados 02 (segunda mitad) → 05, o fallo. */
async function extrae(src: SourceFiles): Promise<void> {
  ve({ k: "leyendo", fase: "extrayendo" });
  // El escalón que separa «eligió mal la carpeta» de «eligió bien y el navegador no
  // pudo»: sin él, abandonar DURANTE la extracción (que en un móvil tarda y quema
  // memoria) es indistinguible de no haber llegado nunca a extraer.
  analitica.evento(EV.BYO_EXTRACCION_INICIO, { ficheros: src.size });
  const arranque = Date.now();
  try {
    // Pedir persistencia: sin ella el navegador puede desalojar la cache bajo
    // presión de disco (Safari ITP incluso por inactividad). Best-effort.
    await navigator.storage?.persist?.().catch(() => false);
    const n = await extractToCache(src, (m) => log(m));
    log(txt("extraccionOk", { n: String(n) }));
    analitica.evento(EV.BYO_EXTRACCION_OK, { assets: n, duracion_ms: Date.now() - arranque });
    ve({ k: "listo", assets: n });
    // Ahora SÍ hay con qué jugar: las partidas que estaban listadas sin acción pasan a
    // tener su «continuar». Quien vuelve a un navegador con partidas y sin extracción
    // (caché desalojada) recorre exactamente ese camino.
    // Y aquí se CUMPLE el enlace compartido que llegó sin copia: el visitante leyó el aviso,
    // soltó su carpeta, y la galería se abre sola en la tarjeta que pidió. Sin esto, el
    // enlace habría muerto en el aviso y habría que acordarse de volver a pincharlo.
    void refrescaPartidas().then(() => atiendeEnlaceCompartido(hayCopia));
    await registerSw();
    play.style.display = "inline-block";
    play.focus();
  } catch (e) {
    const motivo = e instanceof Error ? e.message : String(e);
    log(txt("extraccionFallo", { motivo }), "err");
    // La duración TAMBIÉN en el fallo: distingue un rechazo inmediato de una muerte
    // por memoria a mitad de camino, que son dos problemas distintos.
    analitica.evento(EV.BYO_EXTRACCION_FALLO, { motivo, duracion_ms: Date.now() - arranque });
    ve({ k: "fallo", titulo: txt("extraccionFallo", { motivo }) });
  }
}

async function run(src: SourceFiles): Promise<void> {
  logEl.textContent = "";
  if (ultimatumImporter?.enabled) {
    await ultimatumImporter.review(src);
    return;
  }
  if (ultimatumImporter?.enabled) {
    await ultimatumImporter.review(src);
    return;
  }
  if (ultimatumImporter?.enabled) {
    await ultimatumImporter.review(src);
    return;
  }
  if (ultimatumImporter?.enabled) {
    await ultimatumImporter.review(src);
    return;
  }
  if (ultimatumImporter?.enabled) {
    await ultimatumImporter.review(src);
    return;
  }
  if (ultimatumImporter?.enabled) {
    await ultimatumImporter.review(src);
    return;
  }
  if (ultimatumImporter?.enabled) {
    await ultimatumImporter.review(src);
    return;
  }
  if (ultimatumImporter?.enabled) {
    await ultimatumImporter.review(src);
    return;
  }
  if (ultimatumImporter?.enabled) {
    await ultimatumImporter.review(src);
    return;
  }
  if (ultimatumImporter?.enabled) {
    await ultimatumImporter.review(src);
    return;
  }
  if (ultimatumImporter?.enabled) {
    await ultimatumImporter.review(src);
    return;
  }
  if (ultimatumImporter?.enabled) {
    await ultimatumImporter.review(src);
    return;
  }
  if (ultimatumImporter?.enabled) {
    await ultimatumImporter.review(src);
    return;
  }
  if (ultimatumImporter?.enabled) {
    await ultimatumImporter.review(src);
    return;
  }
  if (ultimatumImporter?.enabled) {
    await ultimatumImporter.review(src);
    return;
  }
  if (ultimatumImporter?.enabled) {
    await ultimatumImporter.review(src);
    return;
  }
  if (ultimatumImporter?.enabled) {
    await ultimatumImporter.review(src);
    return;
  }
  if (ultimatumImporter?.enabled) {
    await ultimatumImporter.review(src);
    return;
  }
  if (ultimatumImporter?.enabled) {
    await ultimatumImporter.review(src);
    return;
  }
  if (ultimatumImporter?.enabled) {
    await ultimatumImporter.review(src);
    return;
  }
  if (ultimatumImporter?.enabled) {
    await ultimatumImporter.review(src);
    return;
  }
  // Los ficheros YA están leídos: quien llama entró en «leyendo» antes de leerlos.
  log(txt("recibidos", { n: String(src.size) }));
  analitica.evento(EV.BYO_CARPETA, { ficheros: src.size });
  // 🔴 LAS DOS CLASES DE PROBLEMA SE SEPARAN AQUÍ, y no es cosmética: «te faltan
  // ficheros» se arregla eligiendo otra carpeta; «esto mide otra cosa» no se arregla
  // en absoluto, y lo único honesto es ofrecer intentarlo. Antes las dos caían en el
  // mismo volcado de texto y el visitante no sabía cuál de las dos le había pasado.
  const insp = inspectSource(src);
  if (insp.problems.length > 0) {
    // El log sigue llevando el detalle en crudo: es lo que alguien copia y pega para
    // pedir ayuda, y sobrevive al cambio de idioma porque no se repinta.
    log(txt("carpetaIncompleta"), "err");
    for (const p of insp.problems.slice(0, 12)) log(`  - ${p}`, "err");
    log(txt("apuntaCarpeta"), "err");
    // CUÁNTOS problemas, de qué CLASE, y de qué NOMBRE DE FICHERO DEL ORIGINAL: son
    // nombres de EA fijos (ULTIMA.EXE, TILES.16…), no rutas ni nombres del usuario.
    analitica.evento(EV.BYO_FUENTE_INVALIDA, {
      problemas: insp.problems.length,
      clase: insp.missing.length > 0 ? "faltan" : "tamano",
    });
    ve(
      insp.missing.length > 0
        ? { k: "incompleto", insp }
        : { k: "otraEdicion", insp, src },
    );
    return;
  }
  await extrae(src);
}

drop.addEventListener("dragover", (e) => {
  e.preventDefault();
  drop.classList.add("hover");
});
/**
 * Abre un `.zip` y lo pasa por el mismo `run()` que una carpeta.
 *
 * El zip es el TERCER productor del mapa nombre→bytes; de aquí en adelante el flujo es
 * idéntico, así que los cinco estados valen igual sin una línea de más.
 */
async function desdeZip(file: File): Promise<void> {
  logEl.textContent = "";
  ve({ k: "leyendo", fase: "leyendo" });
  log(txt("zipAbriendo"));
  let src: SourceFiles;
  try {
    src = await collectZip(file);
  } catch (e) {
    // Un zip corrupto, cifrado o que no es un zip revienta DENTRO del descompresor. Es
    // su propio fallo y merece su propio mensaje: mandar a alguien al estado «te faltan
    // 31 ficheros» cuando lo que pasa es que el archivo está roto es una pista falsa.
    const motivo = e instanceof Error ? e.message : String(e);
    log(txt("zipRoto", { motivo }), "err");
    ve({ k: "fallo", titulo: txt("zipRoto", { motivo }) });
    return;
  }
  if (src.size === 0) {
    log(txt("zipVacio"), "err");
    ve({ k: "fallo", titulo: txt("zipVacio") });
    return;
  }
  await run(src);
}

/** Del lote soltado/elegido, el primer `.zip` si lo hay. */
function zipDe(files: readonly File[]): File | undefined {
  return files.find((f) => esZip(f));
}

drop.addEventListener("dragleave", () => drop.classList.remove("hover"));
drop.addEventListener("drop", (e) => {
  e.preventDefault();
  drop.classList.remove("hover");
  // Un `.zip` suelto llega como fichero normal en `files`, no como entrada de directorio.
  // Se mira ANTES que `items`: si no, `collectDropped` lo metería en el mapa como un
  // fichero más llamado «ULTIMA5.ZIP» y la validación diría que faltan los 31.
  const zip = zipDe(Array.from(e.dataTransfer?.files ?? []));
  if (zip) {
    void desdeZip(zip);
    return;
  }
  if (e.dataTransfer?.items) {
    // 🔴 EL ESTADO «LEYENDO» SE ENTRA AQUÍ, NO EN `run()`. Medido en navegador el 07-08:
    // ponerlo dentro de `run` hacía que NO SE PINTARA NUNCA — el trabajo de leer (126
    // `file.arrayBuffer()`, decenas de segundos con una carpeta de verdad) ocurre ANTES
    // de que `run` exista, y una vez dentro `run` pasa a «extrayendo» sin ceder al hilo
    // de pintado, así que el navegador nunca llega a dibujar el estado intermedio.
    // Resultado: durante la fase MÁS LENTA la página no decía nada. Es exactamente el
    // defecto que estos estados vienen a cerrar, y sólo lo vio una sonda que registraba
    // la SECUENCIA de estados, no el estado final.
    ve({ k: "leyendo", fase: "leyendo" });
    void collectDropped(e.dataTransfer.items).then(run);
  }
});
drop.addEventListener("click", () => picker.click());
drop.addEventListener("keydown", (e) => {
  if (e.key === "Enter" || e.key === " ") picker.click();
});
picker.addEventListener("change", () => {
  if (picker.files) {
    ve({ k: "leyendo", fase: "leyendo" }); // ver el comentario del `drop` de arriba
    void collectFiles(Array.from(picker.files)).then(run);
  }
});
play.addEventListener("click", () => {
  analitica.evento(EV.BYO_JUGAR);
  // Ultimatum owns the public game route. The standalone engine remains at
  // /play.html only as the host's same-origin runtime implementation.
  location.href = "/games/ultima5/";
});

// ── LA VÍA DEL ZIP ───────────────────────────────────────────────────────────────────
// 🔴 HACE FALTA UN SEGUNDO `<input>`, y no es duplicar por duplicar: `webkitdirectory`
// convierte al principal en un selector de CARPETAS y con ese atributo NO se puede
// elegir un fichero suelto. Sin este otro, el zip sólo sería alcanzable ARRASTRANDO —
// que es exactamente lo que un teléfono no puede hacer, o sea que la vía no serviría
// para el único caso que existe para resolver.
const pickerZip = document.getElementById("picker-zip") as HTMLInputElement;
const viaZip = document.getElementById("via-zip")!;

let ultimatumImporter: UltimatumImportController | undefined;
ultimatumImporter = mountUltimatumImporter({
  doc: document,
  picker,
  pickerZip,
  log,
  onInstalled: async (assets) => {
    log(txt("extraccionOk", { n: String(assets) }));
    ve({ k: "listo", assets });
    await registerSw();
    play.style.display = "inline-block";
    play.focus();
    await refrescaPartidas();
  },
});

function pintaViaZip(): void {
  viaZip.textContent = "";
  viaZip.appendChild(el("span", "", txt("zipVia") + " "));
  viaZip.appendChild(boton(txt("zipBoton"), () => pickerZip.click()));
  const porque = el("small", "", " " + txt("zipPorQue"));
  viaZip.appendChild(porque);
}
pickerZip.addEventListener("change", () => {
  const f = pickerZip.files?.[0];
  if (f) void desdeZip(f);
});
// Sigue al idioma por el mismo evento que el panel de estados.
window.addEventListener("openu5:lang", () => pintaViaZip());
pintaViaZip();

// ── TUS DATOS: el botón que hace verdadera la tercera promesa ────────────────────────
// «Se lee aquí, se queda aquí, y lo puedes borrar aquí» son tres afirmaciones. Las dos
// primeras las sostiene el código sin más; la tercera exige que exista LA ACCIÓN, o es
// una capacidad que el visitante no puede ejercer.
const tusDatos = document.getElementById("tus-datos")!;

/**
 * Ejecuta el borrado completo y deja la pantalla contando lo que ha pasado.
 *
 * ── EL ORDEN IMPORTA, y no por elegancia ────────────────────────────────────────────
 * Primero lo que tiene CUENTA que enseñar (la copia, las partidas, las repeticiones:
 * son las tres cosas que el visitante reconoce y las tres que quiere ver numeradas), y
 * al final el barrido por prefijos, que recoge TODO lo demás — preferencias, idioma,
 * consentimiento, la última coordenada del menú debug — y da de baja el service worker.
 * Al revés, el barrido se llevaría el índice de partidas por delante y `borraTodo`
 * contaría CERO sobre unas partidas que sí existían: un resumen que miente a la baja
 * justo en el número que más importa.
 */
async function borraDeVerdad(): Promise<void> {
  // 🔴 EL IDIOMA NO SE PIERDE AL BORRARLO, y hace falta decir por qué aquí no hay nada que
  // hacer: `openu5-lang` es una de las claves que se van, así que desde el barrido
  // `idiomaActual()` caería a `navigator.language`. Esta operación dispara TRES repintados
  // (el panel de estados, la lista de partidas y este bloque) y los tres saldrían en el
  // idioma de respaldo: media pantalla en cada lengua, fotografiada. Lo sostiene el CERROJO
  // de `idioma.ts` (`congelaIdioma`, puesto por `aplicaIdioma` al cargar), que sobrevive al
  // borrado de la clave. La preferencia se borra igual; lo que no cambia bajo los pies es la
  // pantalla que se está mirando.
  //
  // El CENSO DE CLAVES se toma también antes: el barrido corre al final, cuando
  // `clearAllSaves` ya se ha llevado las suyas, así que contar sólo lo que él retira daría
  // «5 ajustes» sobre una confirmación que acababa de enumerar 9. Dos cifras de añadas
  // distintas, juntas y contradiciéndose delante del usuario.
  const clavesAntes = (await censaDatos()).ajustes;
  const habiaCopia = await hasExtraction();
  await clearExtraction();
  // Las partidas y las repeticiones son datos del jugador en el MISMO origen: si se
  // quedaran, «este navegador ya no guarda nada de tu copia» sería falso justo en el
  // rótulo que lo afirma.
  const { partidas, repeticiones } = await borraTodo();
  const { borraDatosLocales, cubierta } = await import("./limpieza.js");
  const resto = await borraDatosLocales();
  // Lo que de verdad se fue de `localStorage`: lo que había MENOS lo que queda. Cubre las dos
  // pasadas (la de `clearAllSaves` y la del barrido) y, si alguna clave se resistiera a
  // borrarse, la resta lo dice — un `resto.claves.length` la habría contado como ida.
  let quedan = 0;
  try {
    quedan = Object.keys(localStorage).filter(cubierta).length;
  } catch {
    quedan = 0;
  }
  const clavesIdas = Math.max(0, clavesAntes - quedan);
  const habia =
    habiaCopia || partidas > 0 || repeticiones > 0 || clavesIdas > 0 || resto.caches.length > 0;
  // El botón se queda: alguien puede volver a soltar ficheros y querer borrarlos
  // otra vez. Lo que cambia es el aviso — un borrado mudo no se distingue de un
  // botón roto.
  //
  // 🔴 Y el aviso lleva las CIFRAS MEDIDAS AL BORRAR, no la lista de lo que se pensaba
  // borrar: es la diferencia entre «he hecho esto» y «tenía intención de hacer esto», y
  // con cuatro almacenes que pueden fallar por separado (modo privado, caché bloqueada)
  // la segunda forma sería una afirmación sin respaldo.
  const idas: string[] = [];
  if (partidas === 1) idas.push(txt("borrarInventarioPartida"));
  else if (partidas > 1) idas.push(txt("borrarInventarioPartidas", { n: num(partidas) }));
  if (repeticiones === 1) idas.push(txt("borrarInventarioRepeticion"));
  else if (repeticiones > 1)
    idas.push(txt("borrarInventarioRepeticiones", { n: num(repeticiones) }));
  if (clavesIdas === 1) idas.push(txt("borradoAjuste"));
  else if (clavesIdas > 1) idas.push(txt("borradoAjustes", { n: num(clavesIdas) }));
  if (resto.caches.length === 1) idas.push(txt("borradoCache"));
  else if (resto.caches.length > 1)
    idas.push(txt("borradoCaches", { n: num(resto.caches.length) }));
  pintaTusDatos(
    habia ? txt("borradoDetalle", { lista: idas.join(" · ") }) : txt("nadaQueBorrar"),
  );
  if (habiaCopia) {
    play.style.display = "none";
    ve({ k: "vacio" });
  }
  await refrescaPartidas();
}

/** Todo lo que se va a perder, para poder enseñarlo ANTES de perderlo. */
interface Censo {
  inv: Inventario;
  copia: boolean;
  /** Claves de `localStorage` de este sitio: preferencias, idioma y consentimiento. */
  ajustes: number;
}

/**
 * Cuenta lo que hay AHORA mismo. Se llama al pulsar, nunca al cargar la página: entre una
 * cosa y otra el jugador ha podido guardar una partida en otra pestaña.
 */
async function censaDatos(): Promise<Censo> {
  const inv = await leeInventario();
  const copia = await hasExtraction();
  const { cubierta } = await import("./limpieza.js");
  let ajustes = 0;
  try {
    ajustes = Object.keys(localStorage).filter(cubierta).length;
  } catch {
    ajustes = 0; // almacenamiento bloqueado: no hay nada que contar ni que borrar
  }
  return { inv, copia, ajustes };
}

/** ¿Hay algo? Si no, el botón no pregunta nada: dice que no hay nada y ya está. */
function hayAlgo(c: Censo): boolean {
  return c.inv.partidas.length > 0 || c.inv.repeticiones.length > 0 || c.copia || c.ajustes > 0;
}

/**
 * El inventario en la lengua vigente: «3 partidas guardadas», «1 repetición», «tu copia
 * extraída», «7 ajustes de este navegador»…
 *
 * 🔴 LAS PARTIDAS VAN PRIMERAS y no es orden alfabético: es el ORDEN DEL COSTE. Los
 * recursos extraídos se recuperan soltando la carpeta y un ajuste se vuelve a poner en dos
 * clics; una partida de cuarenta horas, no. Quien lee esta línea de corrido tiene que
 * tropezar con lo irrecuperable en la primera palabra, no en la cuarta.
 */
function inventarioEnPalabras(c: Censo): string[] {
  const partes: string[] = [];
  if (c.inv.partidas.length === 1) partes.push(txt("borrarInventarioPartida"));
  else if (c.inv.partidas.length > 1)
    partes.push(txt("borrarInventarioPartidas", { n: num(c.inv.partidas.length) }));
  if (c.inv.repeticiones.length === 1) partes.push(txt("borrarInventarioRepeticion"));
  else if (c.inv.repeticiones.length > 1)
    partes.push(txt("borrarInventarioRepeticiones", { n: num(c.inv.repeticiones.length) }));
  if (c.copia) partes.push(txt("borrarInventarioCopia"));
  if (c.ajustes > 0) partes.push(txt("borrarInventarioAjustes", { n: num(c.ajustes) }));
  return partes;
}

/**
 * Pinta la confirmación con el inventario delante.
 *
 * 🔴 Sin `confirm()` del navegador: es modal, no se traduce con el idioma de la página
 * y en móvil puede salir con el nombre del dominio encima. Aquí la pregunta vive donde
 * está el botón y enumera exactamente lo que se va a perder.
 */
function pintaConfirmacion(c: Censo): void {
  tusDatos.textContent = "";
  tusDatos.appendChild(el("span", "", txt("borrarAviso") + " " + inventarioEnPalabras(c).join(" · ") + ". "));
  tusDatos.appendChild(
    boton(txt("borrarConfirmar"), () => {
      void borraDeVerdad();
    }),
  );
  tusDatos.appendChild(el("span", "", " "));
  tusDatos.appendChild(
    boton(txt("borrarCancelar"), () => pintaTusDatos(txt("borrarCancelado"))),
  );
}

function pintaTusDatos(aviso?: string): void {
  tusDatos.textContent = "";
  tusDatos.appendChild(
    boton(txt("borrar"), () => {
      void (async () => {
        // 🔴 EL CENSO SE LEE AHORA, no se toma del que se pintó al cargar: entre una cosa
        // y otra el jugador ha podido guardar una partida en otra pestaña.
        const c = await censaDatos();
        // 🔴 SE PREGUNTA SIEMPRE QUE HAYA ALGO — y esto CAMBIA la regla anterior, que era
        // «preguntar sólo si hay algo irrecuperable (partidas o repeticiones)». La razón
        // del cambio es que cambió el ALCANCE, no el gusto: el botón ya no borra sólo la
        // copia y las partidas, sino también los ajustes, el idioma, el consentimiento y
        // el service worker. Con la regla vieja, un visitante sin partidas pulsaba y
        // perdía en silencio su respuesta al panel de permisos. Lo que se conserva de
        // aquella decisión es su parte buena: sin NADA que borrar no hay confirmación de
        // trámite — se dice que no hay nada y se acabó.
        if (hayAlgo(c)) {
          pintaConfirmacion(c);
          return;
        }
        await borraDeVerdad();
      })();
    }),
  );
  const permisos = document.createElement("a");
  permisos.href = "#";
  permisos.setAttribute("data-openu5-consent", ""); // el panel REAL, el mismo del pie
  permisos.textContent = txt("misPermisos");
  tusDatos.appendChild(el("span", "", " · "));
  tusDatos.appendChild(permisos);
  if (aviso) tusDatos.appendChild(el("small", "", " " + aviso));
}
window.addEventListener("openu5:lang", () => pintaTusDatos());
pintaTusDatos();

// ── TUS PARTIDAS Y REPETICIONES (bloque 2d) ─────────────────────────────────────────
// Lo que el JUEGO guardó en este navegador, listado aquí. Ver la cabecera de
// `partidas.ts` para por qué se puede leer desde esta página (mismo origen) y por qué
// en desarrollo saldrá vacío (dos puertos = dos orígenes).
const partidasEl = document.getElementById("partidas")!;
let inventario: Inventario = { partidas: [], repeticiones: [], miniaturas: new Map() };
let hayCopia = false;

/** Relee el almacén y repinta. Se llama al cargar, al extraer y al borrar. */
async function refrescaPartidas(): Promise<void> {
  inventario = await leeInventario();
  hayCopia = await hasExtraction();
  pintaPartidas(partidasEl, inventario, hayCopia, repintaPartidas);
  anotaPrimeraPartida();
}

/** `null` = todavía no hay línea base (no se ha leído el almacén ni una vez). */
let habiaPartidas: boolean | null = null;

/**
 * «Primera partida» = este navegador pasa de CERO a tener alguna DURANTE esta visita.
 *
 * 🔴 La primera lectura sólo FIJA LA LÍNEA BASE y no emite, aunque encuentre partidas:
 * quien llega con las de otro día no las ha creado ahora, y contarlas aquí inflaría el
 * escalón con gente que ya estaba dentro del embudo — un crecimiento que se leería como
 * producto funcionando cuando es sólo gente volviendo.
 *
 * 🔴 Y EL PRECIO DE ESA LÍNEA BASE: la ventana de observación es UNA CARGA de esta
 * página, y el único escritor del índice (`core/persistence.ts`) corre en `/play.html`,
 * que es otro documento. Así que una partida creada JUGANDO jamás se ve nacer desde aquí
 * — al volver ya existe y la absorbe la línea base. El único 0→≥1 que ocurre con esta
 * página abierta es el del modal de momentos.
 *
 * 🔴 Y `origen` NO ES DE FIAR: ese mismo modal arranca `/play.html` en un iframe oculto
 * para la miniatura, y dentro `autosave()` escribe `autosave-N` SIN `provenance`. Como
 * `partidas[0]` es la más reciente, esa ranura puede ganarle al momento y hacer que aquí
 * salga `propia`. Sin medir (pide copia real de EA). La derivación entera y qué haría
 * falta para cerrarlo están junto al evento, en `eventos.ts`.
 */
function anotaPrimeraPartida(): void {
  const hay = inventario.partidas.length > 0;
  const antes = habiaPartidas;
  habiaPartidas = hay;
  if (antes !== false || !hay) return; // sin línea base, ya las había, o sigue en cero
  // `partidas[0]` es la MÁS RECIENTE: `leeInventario` ordena por timestamp descendente.
  // Viniendo de cero, es la que acaba de aparecer.
  analitica.evento(EV.BYO_PRIMERA_PARTIDA, {
    origen: inventario.partidas[0]?.provenance === "momento" ? "momento" : "propia",
  });
}

/** Lo que una tarjeta llama cuando cambia el almacén desde dentro (captura regenerada). */
function repintaPartidas(): void {
  void refrescaPartidas();
}
// Sigue al idioma SIN releer el almacén: repintar es formatear otra vez lo que ya se
// leyó, y una lectura de IndexedDB por cada pulsación del conmutador sería trabajo
// gratis que además puede llegar desordenado.
window.addEventListener("openu5:lang", () =>
  pintaPartidas(partidasEl, inventario, hayCopia, repintaPartidas),
);
// Y RELEE cuando algo ha ESCRITO en el almacén desde otro trozo de la página — hoy, importar
// una partida de un fichero (`exporta.ts`). Es un evento y no una llamada directa porque el
// que escribe vive en un chunk perezoso: darle la función obligaría a que `partidas.ts` se la
// pasara, y con ella el cierre entero de este módulo. Repintar sin releer no valdría: la
// partida importada no está en el `inventario` que se leyó al cargar.
window.addEventListener("openu5:partidas", () => void refrescaPartidas());
// 🔴 Aquí NO va la primera lectura del almacén: está más abajo, encadenada con el enlace
// compartido (`refrescaPartidas().then(...)`). Volver a ponerla aquí no rompe nada visible
// —de ahí el riesgo— pero deja DOS lecturas de IndexedDB en cada carga.

// ── TABLA DE RÉCORDS (carril 2 del diseño de lanzamiento) ───────────────────────────
// 🔴 LA DECIDE EL BUILD, NO UNA SONDA. `VITE_RECORDS_API` es el prefijo de los endpoints
// (p. ej. `/api`); vacío = este despliegue no tiene backend de récords y aquí no pasa nada:
// ni se carga el chunk, ni se pide nada, ni se pinta sección. (El chunk SÍ se EMITE en el
// build —vite lo emite por el `import()` estático, medido: `records-*.js` aparece en el dist
// con y sin la variable—; lo que no ocurre es que nadie lo pida.) Mismo patrón que la analítica
// (`VITE_POSTHOG_KEY`: sin configuración, no se carga nada) y por la misma razón — una
// función que depende de infraestructura desplegada se apaga desde donde se sabe si existe.
//
// 🔴 Y NO SE SONDEA. La primera versión pedía `/api/tabla` para averiguarlo y la batería la
// paró con las manos en la masa: 404 en la consola de cada visitante, tres por carga. El
// porqué completo está en la cabecera de `records.ts`.
const recordsEl = document.getElementById("records")!;
const apiRecords =
  typeof (import.meta as { env?: Record<string, unknown> }).env?.["VITE_RECORDS_API"] === "string"
    ? String((import.meta as { env?: Record<string, unknown> }).env!["VITE_RECORDS_API"]).trim()
    : "";
// El chunk entra por `import()` (quien sólo viene a soltar su carpeta no lo paga) y se pide
// UNA vez: `montaRecords` se re-llama al cambiar de idioma sobre el módulo ya cargado.
if (apiRecords) {
  void import("./records.js").then((m) => {
    const monta = (): void => void m.montaRecords(recordsEl, apiRecords);
    window.addEventListener("openu5:lang", monta);
    monta();
  });
}

// ── MOMENTOS LEGENDARIOS ─────────────────────────────────────────────────────────────
// El botón que abre la galería (spec 2026-08-08). `hayCopia` se le pasa como FUNCIÓN y no
// como valor: se resuelve al pulsar, y entre que la página carga y alguien pulsa puede
// haber soltado la carpeta — con el valor congelado, el modal diría «hace falta tu copia»
// sobre un navegador que acaba de extraerla.
const momentosEl = document.getElementById("momentos")!;
function pintaMomentos(): void {
  instalaBotonMomentos(momentosEl, () => hayCopia, () => void refrescaPartidas());
}
window.addEventListener("openu5:lang", () => pintaMomentos());
pintaMomentos();

// ── ENLACE COMPARTIDO (`?momento=momento-07`) ────────────────────────────────────────
// 🔴 VA DETRÁS de `refrescaPartidas()`, y el orden es la decisión: `hayCopia` sólo tiene
// valor de verdad una vez leído el almacén, y esa lectura es asíncrona. Preguntando antes,
// TODO enlace compartido caería en «hace falta tu copia» — incluido el de quien la tiene,
// que es el caso para el que existe la función.
void refrescaPartidas().then(() => atiendeEnlaceCompartido(hayCopia));

// ESTADO 01 · VACÍO. Se pinta ya, sin esperar a nada: el defecto que cierra es
// justamente que la página no decía NADA hasta que pasaba algo.
pinta();

// Visita repetida: si ya hay una extracción completa, ofrecer jugar directo.
void hasExtraction().then(async (ok) => {
  if (ok) {
    log(txt("extraccionPrevia"));
    // 🔴 SÓLO si seguimos en el estado inicial: esta comprobación es asíncrona y puede
    // resolverse DESPUÉS de que el visitante haya soltado una carpeta. Sin la guarda,
    // una extracción vieja pisaría el diagnóstico de la carpeta recién soltada — y el
    // estado que se quedaría en pantalla («listo») sería el contrario del verdadero.
    if (estado.k === "vacio") ve({ k: "listo", assets: null });
    await registerSw().catch(() => {});
    play.style.display = "inline-block";
  }
});

// Modo de TEST (?fetchsrc=/ruta): baja los originales por HTTP desde un
// servidor LOCAL de desarrollo (sirve la copia del desarrollador; jamás en
// producción, donde ese endpoint no existe). Habilita el smoke E2E del flujo
// completo sin drag-and-drop manual. `<ruta>/index.json` = lista de ficheros.
const fetchSrc = new URLSearchParams(location.search).get("fetchsrc");
if (fetchSrc) {
  void (async () => {
    try {
      // Mismo contrato que el drop y el picker: el estado «leyendo» se entra ANTES de
      // leer, para que esta ruta recorra los mismos estados que la de un usuario (si no,
      // la sonda del navegador estaría midiendo un camino que nadie recorre).
      ve({ k: "leyendo", fase: "leyendo" });
      log(`[test] fetching source files from ${fetchSrc}…`);
      const names = (await (await fetch(`${fetchSrc}/index.json`)).json()) as string[];
      const src: SourceFiles = new Map();
      for (const name of names) {
        const res = await fetch(`${fetchSrc}/${encodeURIComponent(name)}`);
        if (!res.ok) continue;
        src.set(name.toUpperCase(), new Uint8Array(await res.arrayBuffer()));
      }
      await run(src);
    } catch (e) {
      log(`[test] fetchsrc failed: ${e instanceof Error ? e.message : String(e)}`, "err");
    }
  })();
}
