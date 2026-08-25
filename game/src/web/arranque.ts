/**
 * RAÍZ DE COMPOSICIÓN del carril 1: junta consentimiento + panel + analítica y deja
 * una sola llamada para cada superficie (`portada.ts`, la demo BYO y `main.ts`).
 *
 * Lo que hace, en orden:
 *   1. Lee la configuración de PostHog del entorno (`VITE_POSTHOG_KEY` y
 *      `VITE_POSTHOG_HOST`). Sin configuración no se carga nada y el panel sigue
 *      funcionando: la elección se guarda igual y valdrá al configurar el despliegue.
 *   2. Sincroniza la analítica con el permiso YA guardado (si lo hay).
 *   3. Si nadie ha decidido todavía, abre el panel.
 *   4. Deja el panel reabrible desde cualquier `[data-openu5-consent]` de la página
 *      (el enlace «Privacidad» de la portada, el del /byo, la fila del menú SISTEMA).
 *   5. Escucha el evento `storage`: revocar en una pestaña apaga las demás.
 */
import { creaAnalitica, type Analitica, type ConfigAnalitica } from "./analitica.js";
import { credenciales } from "./analitica-credenciales.js";
import { registraAnaliticaViva } from "./analitica-viva.js";
import { EV } from "./eventos.js";
import {
  CLAVE_CONSENTIMIENTO,
  leerConsentimiento,
  permiteAnalitica,
  type AlmacenSimple,
  type Consentimiento,
} from "./consentimiento.js";
import { disponibilidadDe, puedeAbrirseSolo, type Disponibilidad } from "./disponibilidad.js";
import { creaPanelConsentimiento, type Idioma, type PanelConsentimiento } from "./panel-consentimiento.js";
import { cargaSdkPostHog } from "./sdk-posthog.js";
import type { Superficie } from "./superficies.js";

/** Atributo que reabre el panel: `<a href="#" data-openu5-consent>Privacidad</a>`. */
export const ATRIBUTO_REABRIR = "data-openu5-consent";

/** Clave de idioma que ya usa la portada (`home.html`) para su botón ES/EN. */
const CLAVE_IDIOMA = "openu5-lang";

export interface ConsentimientoInstalado {
  readonly analitica: Analitica;
  readonly panel: PanelConsentimiento;
  /** El consentimiento vigente (null = sin decidir). Se relee en cada llamada. */
  vigente(): Consentimiento | null;
  /** Qué permisos pueden hacer algo hoy. Expuesto para que el arnés lo mida. */
  readonly disponibilidad: Disponibilidad;
}

export interface OpcionesInstalacion {
  readonly superficie: Superficie;
  readonly doc?: Document;
  readonly win?: Window;
  /** Config explícita (tests / entradas que no pasan por vite). */
  readonly config?: ConfigAnalitica;
  /**
   * EVENTO DE LLEGADA de esta superficie (`EV.BYO_VISTO`, `EV.PORTADA`…). Pasarlo aquí
   * en vez de emitirlo a mano tras instalar NO es azúcar: arregla un agujero medido.
   *
   * 🔴 EL AGUJERO (medido el 08-08-2026 en navegador real, dev server propio, con el
   * host de PostHog apuntado a un stub local): la llegada se emite al cargar el módulo,
   * y en la PRIMERA visita eso es ANTES de que exista permiso ⇒ `evento()` la descarta,
   * correctamente. Resultado: el visitante nuevo que ACEPTA envía `consentimiento_dado`
   * pero NUNCA `byo_visto`. El escalón 1 del embudo pierde exactamente a la gente que
   * convierte, y el informe sale con **más consentimientos que visitas** — un embudo
   * imposible que se lee como avería del instrumento en vez de como lo que es.
   * Comprobado que el visitante que VUELVE (permiso ya guardado) sí la emite: por eso
   * el agujero es invisible en cualquier prueba que no empiece con el almacén vacío.
   *
   * Con esta opción la llegada se emite al instalar (si ya había permiso) o justo
   * después de concederlo, y **como mucho una vez por carga de página**.
   *
   * ⚠️ NO se acumula nada mientras no hay permiso: si nadie acepta, la llegada
   * simplemente no ocurre. Encolar eventos a la espera de un permiso futuro sería
   * recoger antes de preguntar, que es justo lo que el carril 1 existe para no hacer.
   */
  readonly eventoLlegada?: string;
  /**
   * ANFITRIÓN del panel — se pasa TAL CUAL a `creaPanelConsentimiento` (ver allí el
   * porqué de que sea una función y no un elemento). Ausente = banda flotante de siempre.
   * Hoy sólo lo usa `/privacidad`, que empotra el panel en su sección «Cómo cambiar de
   * opinión» en vez de mandar al pie a buscarlo.
   */
  readonly anfitrion?: () => HTMLElement | null | undefined;
  /**
   * IDIOMA FIJADO POR LA SUPERFICIE. Ausente = el resolvedor compartido `idiomaActual()`
   * (`openu5-lang` → `navigator.language`), que es lo correcto para las superficies que
   * conmutan EN LA MISMA URL con atributos `data-es`/`data-en` (portada, /verificacion,
   * /byo): ahí el idioma es del visitante y la página entera le sigue.
   *
   * 🔴 PERO EN LAS PÁGINAS CON UNA URL POR IDIOMA EL RESOLVEDOR DA LA RESPUESTA
   * EQUIVOCADA, y está MEDIDO (10-08, navegador real, las cuatro combinaciones):
   *
   *     navegador es-ES + /privacidad   → página es · panel es  ✓
   *     navegador es-ES + /en/privacy   → página EN · panel ES  ✗
   *     navegador en-US + /privacidad   → página ES · panel EN  ✗
   *     navegador en-US + /en/privacy   → página en · panel en  ✓
   *
   * DOS DE CUATRO cruzadas. Y no es un empate entre dos criterios razonables: en estas
   * páginas el idioma YA LO ELIGIÓ el visitante al abrir esa URL —no hay otra cosa que
   * esté haciendo ahí—, así que la preferencia guardada es información vieja sobre una
   * decisión que se acaba de tomar de nuevo. La URL gana.
   * Es la misma clase que el defecto de /byo que documenta `idiomaActual` («media
   * pantalla en cada idioma»), sólo que allí el arreglo fue CONSUMIR el resolvedor y
   * aquí es no consumirlo. La regla común: **el panel habla el idioma de la página que
   * lo contiene**; lo que cambia entre superficies es quién decide el de la página.
   *
   * ⚠️ Esto NO es un cuarto mecanismo de idioma: no resuelve nada ni guarda nada, sólo
   * deja que la superficie diga el suyo cuando ya lo sabe.
   */
  readonly idioma?: () => Idioma;
}

/**
 * La configuración de analítica del build.
 *
 * 🔴 YA NO SALE DEL `.env` (#129). Salía, y eso partía los builds en DOS POBLACIONES: el
 * checkout principal tenía el fichero y horneaba la clave, un worktree recién creado no, y
 * las dos poblaciones compilaban en verde con artefactos distintos. MEDIDO el 09-08 en
 * openu5.org: `/play` servía la clave y `/byo` NO — la página con más visitas llevaba
 * quién sabe cuánto sin enviar nada, en silencio, porque el modo sin clave es un no-op por
 * diseño. Hoy el valor de producción vive en `analitica-credenciales.ts` con su razón
 * escrita, el `.env` sólo manda en DEV, y la precedencia está declarada allí.
 */
export function configDelEntorno(): ConfigAnalitica {
  const env = (import.meta as { env?: Record<string, unknown> }).env ?? {};
  const { clave, host } = credenciales(env);
  // En DEV sin configurar: AVISO, no excepción. El wizard de PostHog metió aquí un
  // `throw` que habría tumbado `npm run dev`, los e2e y el vitest de cualquier
  // carril sin `.env` — su propio informe decía «diagnóstico solo-desarrollo» y el
  // código hacía otra cosa. Hoy además sólo puede pasar si alguien VACÍA la clave en DEV
  // a propósito: sin `.env` se hereda producción.
  if (env["DEV"] === true && (!clave || !host)) {
    // eslint-disable-next-line no-console
    console.warn(
      "[analitica] VITE_POSTHOG_KEY/HOST vaciadas en DEV: los eventos no se envían (no-op).",
    );
  }
  return { clave, host };
}

function almacenDe(win: Window): AlmacenSimple | null {
  try {
    return win.localStorage;
  } catch {
    return null; // Safari en privado / cookies bloqueadas: sin decisión ⇒ sin envíos
  }
}

/**
 * IDIOMA VIGENTE — resolvedor ÚNICO del sitio. Lee `openu5-lang` (la MISMA clave que
 * escribe el botón ES/EN de la portada) y cae al idioma del navegador.
 *
 * 🔴 EXPORTADO el 04-08-2026 porque `/byo` no lo usaba: era `<html lang="en">` fijo, así
 * que quien pulsaba «Jugar» en la portada en español aterrizaba en inglés justo en el
 * paso donde tiene que buscar ficheros en su disco — el punto del embudo donde más caro
 * sale perder a alguien. El panel de consentimiento SÍ salía traducido en esa misma
 * página (usa esta función), lo que hacía el defecto más raro de ver: media pantalla en
 * cada idioma.
 *
 * Reusar ESTO es lo que impide que nazca un cuarto mecanismo de idioma en el proyecto.
 */
export function idiomaActual(win: Window = window): Idioma {
  return idiomaDe(win, almacenDe(win));
}

function idiomaDe(win: Window, almacen: AlmacenSimple | null): Idioma {
  let guardado: string | null = null;
  try {
    guardado = almacen?.getItem(CLAVE_IDIOMA) ?? null;
  } catch {
    /* da igual: caemos al idioma del navegador */
  }
  if (guardado === "es" || guardado === "en") return guardado;
  return (win.navigator?.language ?? "en").toLowerCase().startsWith("es") ? "es" : "en";
}

export function instalaConsentimiento(opts: OpcionesInstalacion): ConsentimientoInstalado {
  const doc = opts.doc ?? document;
  const win = opts.win ?? window;
  const almacen = almacenDe(win);
  const config = opts.config ?? configDelEntorno();

  const analitica = creaAnalitica({
    config,
    superficie: opts.superficie,
    consentimiento: () => leerConsentimiento(almacen),
    cargaSdk: (o) => cargaSdkPostHog(o, doc, win),
    // El MISMO resolvedor que usa el panel para pintarse: si algún día divergieran,
    // el evento diría un idioma y el visitante estaría leyendo otro.
    idioma: () => idiomaDe(win, almacen),
  });

  // Deja el handle alcanzable para los emisores que no lo reciben (`momentos.ts`,
  // `partidas.ts`). Es una referencia al objeto de arriba, no otra analítica: ver la
  // cabecera de `analitica-viva.ts` para por qué eso no abre un camino a la red.
  registraAnaliticaViva(analitica);

  const panel = creaPanelConsentimiento({
    superficie: opts.superficie,
    almacen,
    doc,
    idioma: opts.idioma ?? (() => idiomaDe(win, almacen)),
    anfitrion: opts.anfitrion,
    alDecidir: (c) => {
      // Aceptar arranca la analítica SIN recargar; rechazar/retirar la apaga.
      //
      // 🔴 ESTA LÍNEA ES REDUNDANTE HOY, Y SE QUEDA A PROPÓSITO. Medido con un mutante
      // que la borra: la batería sigue verde, porque `evento()` llama a `sincroniza()`
      // por dentro y el evento de abajo se emite SIEMPRE — así que el arranque y el
      // apagado ocurrirían igual, de rebote. Vivir de ese rebote ataría el CICLO DE
      // VIDA del consentimiento (encender, y sobre todo APAGAR al revocar) a que exista
      // una emisión de analítica debajo: el día que alguien condicione el evento a
      // `if (c.analitica)` —que es la forma en que uno esperaría escribirlo— revocar
      // dejaría de apagar nada y no se pondría rojo nada. La redundancia cuesta una
      // llamada idempotente; la dependencia costaría un fallo mudo de privacidad.
      analitica.sincroniza();
      // El escalón «consintió» del embudo. Se emite SIEMPRE, sin mirar la elección: si
      // dijo que no, `evento()` lo descarta, que es el mismo cero que si lo
      // condicionáramos aquí — y con una comprobación menos que pudiera contradecir a
      // la puerta de verdad.
      //
      // El ORDEN respecto a la línea de arriba da igual (`evento()` sincroniza por su
      // cuenta): un mutante que lo emite antes sobrevive. Se escribe en este orden
      // porque se lee mejor, no porque haga falta — que es justo lo que el comentario
      // anterior afirmaba, y era falso.
      analitica.evento(EV.CONSENTIMIENTO_DADO, { partida: c.partida });
      // Y la llegada, que en la primera visita se descartó por no haber permiso aún.
      emiteLlegada();
    },
  });

  /**
   * Emite la llegada como MUCHO UNA VEZ por carga de página.
   *
   * El `permiteAnalitica` de aquí no es una segunda puerta de envío —la de verdad
   * sigue estando dentro de `evento()`— sino la condición para GASTAR EL PESTILLO:
   * sin él, la llamada de la instalación consumiría el «ya emitida» aunque el evento
   * se hubiera descartado, y al aceptar después no se emitiría nada. Es decir: el
   * pestillo se cierra cuando la llegada SALE, no cuando se intenta.
   */
  let llegadaEmitida = false;
  function emiteLlegada(): void {
    if (llegadaEmitida || !opts.eventoLlegada) return;
    if (!permiteAnalitica(leerConsentimiento(almacen))) return;
    analitica.evento(opts.eventoLlegada);
    llegadaEmitida = true;
  }

  // Permiso ya dado en una visita anterior ⇒ arranca sin preguntar otra vez.
  analitica.sincroniza();
  // …y con él, la llegada. Si no hay permiso todavía, esto no hace nada y la llegada
  // la emitirá `alDecidir` en cuanto se conceda (ver `emiteLlegada`).
  emiteLlegada();

  // Sin decidir ⇒ se pregunta SÓLO si hay algo que preguntar y la superficie lo admite.
  //
  // 🔴 Antes era `if (sin decidir) panel.abre()` a secas, y eso hacía DOS cosas mal a la
  // vez: tapaba el lienzo del juego al arrancar, y pedía permiso para dos cosas que hoy
  // no pueden ocurrir (clave vacía · nadie lee `partida`). Ver `disponibilidad.ts`.
  //
  // El panel NO desaparece: sigue reabrible desde «Privacidad» en cualquier superficie,
  // que es donde alguien que quiera revisar su elección va a buscarlo.
  const disponibilidad = disponibilidadDe({ clave: config.clave, superficie: opts.superficie });
  if (leerConsentimiento(almacen) === null && puedeAbrirseSolo(opts.superficie, disponibilidad)) {
    panel.abre();
  }

  // Reapertura declarativa: cualquier elemento con el atributo, en cualquiera de las
  // tres superficies, sin que este módulo tenga que conocer su id.
  doc.addEventListener("click", (ev) => {
    const objetivo = (ev.target as Element | null)?.closest?.(`[${ATRIBUTO_REABRIR}]`);
    if (!objetivo) return;
    ev.preventDefault();
    panel.abre();
  });

  // Otra pestaña cambió (o retiró) el permiso: obedecer aquí también. Sin esto,
  // revocar dejaba enviando la pestaña del juego que ya estaba abierta.
  win.addEventListener("storage", (ev) => {
    if ((ev as StorageEvent).key === CLAVE_CONSENTIMIENTO) analitica.sincroniza();
  });

  return { analitica, panel, disponibilidad, vigente: () => leerConsentimiento(almacen) };
}
