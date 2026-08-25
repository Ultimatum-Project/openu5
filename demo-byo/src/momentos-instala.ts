/**
 * INSTALACIÓN de un momento legendario en las partidas de este navegador.
 *
 * 🔴 CHUNK APARTE Y CARGADO POR `import()`, como `minimapa.ts` y `iconos.ts`. Este fichero
 * arrastra el MODELO DEL JUEGO entero (`state.ts` + `saveNative.ts` + `persistence.ts`), que
 * es justo lo que `save-keys.ts` existe para mantener FUERA del bundle de una landing cuyo
 * trabajo es leer una carpeta y arrancar. Quien no abra el modal no paga un byte.
 *
 * ── DE DÓNDE SALE LA BASE: DE LA COPIA DEL VISITANTE ────────────────────────────────────
 * `/assets/init.gam` y `/assets/initial-state.json` NO son ficheros del sitio: los sirve el
 * service worker (`demo-byo/public/sw.js`) desde la Cache Storage que llenó el extractor con
 * LA COPIA DE QUIEN JUEGA (`extractor/src/pipeline.ts:351,356`). El sitio no publica ni un
 * byte de EA; lo que publica es el PARCHE del momento (`game/src/momentos/defs.ts`), que es
 * dato nuestro. Ver la cabecera de `momentos/compone.ts` para el porqué completo.
 *
 * ⇒ CONSECUENCIA VISIBLE, y se dice en la pantalla en vez de disimularla: **sin extracción
 * no se puede añadir un momento**. Tampoco se podría JUGAR (`partidas.ts` ya apaga
 * «continuar» sin copia), así que la galería usa exactamente el mismo criterio.
 */
import { horneaMomento, importaMomento } from "../../game/src/momentos/compone.js";
import type { MomentoDef } from "../../game/src/momentos/defs.js";
import type { ExtractedInitialState } from "../../game/src/core/state.js";
import { installMomentoSave } from "../../game/src/core/persistence.js";
import { SAVED_GAM_SIZE } from "../../game/src/core/saveNative.js";
import { idiomaActual } from "../../game/src/web/arranque.js";

/** Lo que hace falta de la copia del visitante para componer cualquier momento. */
export interface BaseDelVisitante {
  init: ExtractedInitialState;
  plantilla: Uint8Array;
}

/**
 * Se pide UNA vez por sesión y se reutiliza: son ~22 KB que no cambian mientras la
 * extracción sea la misma, y añadir tres momentos no debería ser tres descargas.
 */
let base: Promise<BaseDelVisitante> | null = null;

/**
 * Lee la base de la copia del visitante.
 *
 * 🔴 Los dos fallos posibles NO se colapsan en «algo salió mal»: «no hay extracción» se
 * arregla soltando la carpeta (y es el caso frecuente), y un `.gam` corto es una extracción
 * ROTA, que se arregla repitiéndola. Un mensaje único mandaría a la mitad de la gente al
 * sitio equivocado — el mismo criterio que separa los cinco estados de carga en `main.ts`.
 */
async function leeBase(): Promise<BaseDelVisitante> {
  const [rInit, rGam] = await Promise.all([
    fetch("/assets/initial-state.json"),
    fetch("/assets/init.gam"),
  ]);
  if (!rInit.ok || !rGam.ok) throw new ErrorSinCopia();
  const init = (await rInit.json()) as ExtractedInitialState;
  const plantilla = new Uint8Array(await rGam.arrayBuffer());
  if (plantilla.length < SAVED_GAM_SIZE) {
    throw new Error(`init.gam de ${plantilla.length} B (esperados ${SAVED_GAM_SIZE})`);
  }
  return { init, plantilla };
}

/** «Este navegador todavía no tiene la copia extraída». Clase propia para poder distinguirlo. */
export class ErrorSinCopia extends Error {
  constructor() {
    super("sin extracción en este navegador");
    this.name = "ErrorSinCopia";
  }
}

/**
 * SIEMBRA el momento en el almacén, dada ya la base. Devuelve el id del slot.
 *
 * El camino, entero y sin atajos: parche + copia del visitante → `GameState` → **bytes
 * nativos** (`exportNativeSave`) → **de vuelta** (`importNativeSave`) → almacén. El viaje de
 * ida y vuelta por el códec es deliberado y su porqué está en `compone.ts:importaMomento`.
 *
 * 🔴 ESTÁ SEPARADA DE LA DESCARGA A PROPÓSITO, y no por gusto arquitectónico: es la parte
 * que el arnés de verificación puede ejecutar (`demo-byo/verificacion/verifica-momentos.mjs`
 * bajo node). Si el horneado, el round-trip y el upsert vivieran dentro de la función que
 * hace `fetch`, el test tendría que reimplementar los tres pasos — y estaría midiendo un
 * camino paralelo en vez del que corre en el navegador. Lo único que queda sin cubrir por el
 * pytest es la DESCARGA, y de eso se ocupa la sonda de navegador.
 */
export function siembraMomento(
  def: MomentoDef,
  b: BaseDelVisitante,
  lang: "es" | "en",
): string {
  const horneado = horneaMomento(def, b.init, b.plantilla);
  const state = importaMomento(horneado);
  const r = installMomentoSave(
    def.id,
    state,
    def.titulo[lang] ?? def.titulo.en,
    def.lugar[lang] ?? def.lugar.en,
  );
  if (!r.ok) throw new Error(r.reason === "quota" ? "quota" : "unknown");
  return r.meta.id;
}

/**
 * Presupuesto del fotograma. El arranque en frío del juego está MEDIDO en 1604 ms (cabecera
 * de `popover-replay.ts`); 20 s deja margen de sobra para una máquina lenta sin dejar al
 * visitante esperando si algo se atasca.
 */
const PRESUPUESTO_SHOT_MS = 20_000;

/**
 * Cuántas veces se intenta, en total, antes de dejar el momento sin foto.
 *
 * 🔴 ANTES ERA UNO Y NO ESTABA ESCRITO COMO DECISIÓN: era el número de vueltas que da un
 * bucle que no existía. Un solo intento convierte CUALQUIER tropiezo pasajero —el plazo
 * que vence en una máquina cargada, un chunk que no llega, el juego que revienta al
 * arrancar— en una tarjeta sin foto PARA SIEMPRE, porque hasta hoy no había forma de
 * volver a pedirla.
 *
 * ★ Y el segundo intento NO es la misma tirada repetida, que es lo que haría inútil
 * reintentar: el primero deja los chunks del juego y los `/assets/*` del visitante ya
 * calientes en la caché HTTP y en la Cache Storage, así que el segundo arranca desde un
 * estado estrictamente mejor. Medido en la sonda: con el primer `/play.html` roto a
 * propósito, el segundo escribe la foto igual (`verifica-momentos-shot.mjs`, caso del
 * reintento).
 *
 * DOS y no más: el peor caso son 40 s de «Pintando…», y a partir de ahí lo que falla no
 * es pasajero. Lo que rescata ese caso ya no es insistir, es el botón «Generar captura»
 * de la tarjeta (`partidas.ts`), que puede pedirla otro día.
 */
const INTENTOS_SHOT = 2;

/**
 * Genera la CAPTURA del momento recién sembrado y la guarda como su miniatura.
 *
 * ── POR QUÉ UN IFRAME Y NO UN RENDERIZADOR ──────────────────────────────────────────────
 * Un momento no tiene foto porque nadie lo ha jugado, y la única vía EA-limpia es pintarlo
 * en el navegador del visitante con SUS tiles. De las tres arquitecturas que evalué, ésta
 * es la que no reimplementa nada: el juego **ya** restaura `?save=<id>` ANTES del primer
 * render —a propósito, `game/src/main.ts:430-436`— así que basta con arrancarlo y capturar.
 * La alternativa era extraer `paintSnapshot` de la piel, que vive soldado a `mount` junto al
 * teclado y el rAF (`skin/fiel/skin.ts:2155-2180,2399,2651`) y habría metido el motor entero
 * en el bundle de /byo.
 *
 * `?embed=1` es el mismo modo que ya usa el popover de repeticiones: implica `nointro` y
 * suprime el cromo. `?shot=<id>` es la única pieza nueva, y en el juego es INERTE sin el
 * parámetro.
 *
 * ── EL IFRAME SE DESMONTA SIEMPRE ───────────────────────────────────────────────────────
 * 🔴 En el `finally`, y también si vence el plazo o el mensaje no llega nunca. Un iframe
 * huérfano es una partida corriendo detrás de una página que cree haber terminado, gastando
 * CPU de alguien — el mismo defecto que `popover-replay.ts` documenta al matar su iframe al
 * cerrar. Y si tras los intentos sigue sin foto, el momento queda instalado igualmente y la
 * tarjeta lo tolera: cae al minimapa —que en los momentos de INTERIOR **ya existe** desde
 * #112 (`minimapa.ts` lo dice donde vive: «YA NO DEVUELVE `null` PARA UN INTERIOR»); antes
 * de esa ficha la tarjeta de un interior se quedaba sin nada visual, que eran seis de los
 * diez momentos— y ofrece el botón de regenerarla, que es lo que cierra el caso.
 *
 * 🔴 ESTA FRASE DECÍA «todavía no existe (#112)» hasta el 12-08-2026 (ficha #204), citando
 * la MISMA ficha que la cerró y contradiciendo a `minimapa.ts:118-122` a un fichero de
 * distancia. Dos comentarios del mismo corpus sobre el mismo cambio, uno al día y otro no:
 * el que se quedó atrás es el que sólo MENCIONA el subsistema, no el que lo implementa —
 * y por eso nadie volvió a leerlo cuando la ficha cerró.
 *
 * Devuelve si se escribió la foto. NUNCA lanza: es un adorno y no puede tumbar la siembra.
 *
 * 🔴 REINTENTA (`INTENTOS_SHOT`). El bucle vive AQUÍ y no en el llamador porque los dos
 * llamadores —la instalación (`momentos.ts`) y el botón de regenerar de la tarjeta
 * (`partidas.ts`)— quieren exactamente la misma política, y una política duplicada en dos
 * sitios es una política que un día vale distinto en cada uno.
 */
export async function generaShotDelMomento(id: string): Promise<boolean> {
  for (let intento = 1; intento <= INTENTOS_SHOT; intento++) {
    if (await unIntentoDeShot(id)) return true;
  }
  return false;
}

/**
 * UN intento: monta el iframe, espera el mensaje hasta el presupuesto y lo desmonta.
 *
 * Está separado del bucle para que el desmontaje del `finally` sea POR INTENTO. Si el
 * `finally` envolviera el bucle entero, un primer intento agotado dejaría su iframe —una
 * partida corriendo— vivo durante todo el segundo: dos juegos a la vez en la máquina que
 * ya iba justa, que es precisamente la que necesita el reintento.
 */
async function unIntentoDeShot(id: string): Promise<boolean> {
  const marco = document.createElement("iframe");
  // 🔴 DENTRO DEL VIEWPORT Y RECORTADO A 1×1 POR SU CONTENEDOR. Ni fuera de pantalla, ni
  // `display:none`, ni `visibility:hidden` — y las tres exclusiones están MEDIDAS, cada una
  // contra un motor distinto:
  //
  // · `visibility:hidden` lo descartó CHROMIUM: la captura salía de 1243 B, casi negra,
  //   porque el canvas del shader compone por `requestAnimationFrame` y ese motor no lo
  //   ejecuta en contenido invisible.
  // · **`left:-10000px` lo descarta WEBKIT**, que es el motor de TODO navegador en iOS, y es
  //   el defecto que reportó el usuario desde su iPhone (ficha #173). Medido con una página
  //   de tres iframes que sólo cuentan fotogramas, 6 s por motor:
  //
  //   | dónde está el iframe        | chromium | webkit |
  //   |-----------------------------|---------:|-------:|
  //   | visible (control)           |      721 |    175 |
  //   | **fuera de pantalla**       |      721 |  **0** |
  //   | visibility:hidden           |      720 |    175 |
  //   | opacity:0 en viewport       |      720 |    175 |
  //   | detrás de una tapa opaca    |      720 |    175 |
  //   | **recortado a 1×1 (esto)**  |      721 |    175 |
  //
  //   ★★ LA CURA DE UN MOTOR ES EL VENENO DEL OTRO, y por eso el remedio no podía salir de
  //   razonar sobre uno solo: WebKit SÍ corre el rAF con `visibility:hidden` —justo lo que
  //   Chromium suspende— y NO lo corre fuera del viewport, que es justo lo que Chromium
  //   tolera. El único cuadrante verde en los dos es «montado DENTRO del viewport y
  //   escondido de otra manera».
  //
  // CÓMO SE MANIFIESTA EL FALLO, para que nadie lo confunda con otra cosa: sin rAF, el
  // `await` de dos fotogramas de `main.ts` no se resuelve NUNCA ⇒ no hay captura, no hay
  // `postMessage`, vence el plazo de 20 s, se reintenta, y la tarjeta acaba diciendo
  // «No salió — probar otra vez». No hay error de consola ni imagen negra: parece que el
  // botón no hace nada.
  //
  // 🔴 EL QUE SE ESCONDE ES EL CONTENEDOR, NO EL IFRAME: el juego decide su layout por el
  // TAMAÑO de su caja (`esPantallaTactil`/`layoutPartidoInicial`), así que encoger el
  // iframe a 1×1 le haría montar otra piel y capturar otra pantalla. El iframe se queda de
  // 960×600 y lo recorta el `overflow:hidden` de fuera.
  marco.setAttribute("aria-hidden", "true");
  marco.tabIndex = -1;
  marco.style.cssText = "width:960px;height:600px;border:0;pointer-events:none";
  const jaula = document.createElement("div");
  jaula.setAttribute("aria-hidden", "true");
  jaula.style.cssText =
    "position:fixed;left:0;top:0;width:1px;height:1px;overflow:hidden;opacity:0;pointer-events:none;z-index:-1";
  jaula.appendChild(marco);
  const q = encodeURIComponent(id);
  marco.src = `/play.html?save=${q}&shot=${q}&embed=1&nointro`;

  let alMensaje: ((e: MessageEvent) => void) | null = null;
  try {
    return await new Promise<boolean>((resolve) => {
      const plazo = setTimeout(() => resolve(false), PRESUPUESTO_SHOT_MS);
      alMensaje = (e: MessageEvent) => {
        // Origen y forma comprobados: esta página escucha `message` para una sola cosa y no
        // va a fiarse de lo que mande cualquiera.
        if (e.origin !== window.location.origin) return;
        const d = e.data as { tipo?: string; id?: string; ok?: boolean } | null;
        if (d?.tipo !== "u5:shot" || d.id !== id) return;
        clearTimeout(plazo);
        resolve(d.ok === true);
      };
      window.addEventListener("message", alMensaje);
      document.body.appendChild(jaula);
    });
  } catch {
    return false;
  } finally {
    if (alMensaje) window.removeEventListener("message", alMensaje);
    jaula.remove(); // primero el juego, luego nada: el iframe ES el juego
  }
}

/** Añade el momento a las partidas de este navegador, leyendo antes su copia. */
export async function instalaMomento(def: MomentoDef): Promise<string> {
  base ??= leeBase();
  let b: BaseDelVisitante;
  try {
    b = await base;
  } catch (e) {
    base = null; // un fallo no se cachea: soltar la carpeta y reintentar tiene que funcionar
    throw e;
  }
  return siembraMomento(def, b, idiomaActual());
}
