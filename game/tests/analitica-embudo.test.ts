// @vitest-environment jsdom
/**
 * EL EMBUDO BYO: que cada escalón salga con lo que dice llevar, y sólo con permiso.
 *
 * Este fichero es hermano de `analitica-cero-peticiones.test.ts` y NO lo repite: allí
 * se mide el invariante duro (sin consentimiento, cero peticiones) sobre los canales de
 * salida; aquí se mide que, CON permiso, los escalones nuevos existen, llevan su
 * etiqueta y no llevan lo que no deben.
 *
 * ── LOS DOS RECORRIDOS ─────────────────────────────────────────────────────────
 * La mayoría de casos van por `instalaConsentimiento` con el cargador REAL y un
 * `window.posthog` de mentira, en vez de por un doble de `creaAnalitica`. Cuesta unas
 * líneas más y compra lo que un doble no puede dar: el evento del consentimiento se
 * emite en el instante en que aún no hay SDK cargado (el `<script>` acaba de
 * insertarse), así que sólo llega si la COLA de `sdk-posthog.ts` lo retiene y lo suelta
 * al `load`. Con un doble, esa cola no participa y el caso pasaría verde aunque el
 * evento se perdiera en producción — que es justo el escalón más fácil de perder,
 * porque es el único que ocurre a la vez que la carga.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { creaAnalitica, type OpcionesSdk, type SdkCargado } from "../src/web/analitica.js";
import {
  eventoVivo,
  hayAnaliticaViva,
  registraAnaliticaViva,
} from "../src/web/analitica-viva.js";
import { instalaConsentimiento } from "../src/web/arranque.js";
import { guardarConsentimiento, leerConsentimiento, type AlmacenSimple } from "../src/web/consentimiento.js";
import { EV } from "../src/web/eventos.js";
import { ATRIBUTO_SCRIPT, cargaSdkPostHog } from "../src/web/sdk-posthog.js";

const CLAVE = "phc_clave_de_prueba";
const HOST = "https://eu.i.posthog.com";
const CONFIG = { clave: CLAVE, host: HOST } as const;

/** Lo capturado por el SDK de mentira: `[nombre, propiedades]`. */
type Captura = [string, Record<string, unknown> | undefined];

function almacenFalso(inicial: Record<string, string> = {}): AlmacenSimple {
  const m = new Map(Object.entries(inicial));
  return {
    getItem: (k) => m.get(k) ?? null,
    setItem: (k, v) => void m.set(k, v),
    removeItem: (k) => void m.delete(k),
  };
}

/**
 * Planta un `window.posthog` de mentira y devuelve lo que capture.
 *
 * No hay red por ningún lado: `sdk-posthog.ts` inserta un `<script>` que en jsdom no
 * carga nada, y el `load` se dispara a mano cuando el caso lo pida.
 */
function posthogFalso(): { capturas: Captura[]; init: ReturnType<typeof vi.fn> } {
  const capturas: Captura[] = [];
  const init = vi.fn();
  (window as unknown as { posthog?: unknown }).posthog = {
    init,
    capture: (n: string, p?: Record<string, unknown>) => void capturas.push([n, p]),
    opt_out_capturing: vi.fn(),
    stopSessionRecording: vi.fn(),
    reset: vi.fn(),
  };
  return { capturas, init };
}

/** Suelta el `<script>` insertado: a partir de aquí el SDK está «cargado». */
function cargaElScript(): void {
  document
    .querySelector<HTMLScriptElement>(`script[${ATRIBUTO_SCRIPT}]`)!
    .dispatchEvent(new Event("load"));
}

const casilla = (n: "analitica" | "partida"): HTMLInputElement =>
  document.querySelector<HTMLInputElement>(`#openu5-consentimiento-${n}`)!;
const botonGuardar = (): HTMLButtonElement =>
  document.querySelector<HTMLButtonElement>(`#openu5-consentimiento [data-accion="guardar"]`)!;

beforeEach(() => {
  document.head.innerHTML = "";
  document.body.innerHTML = "";
  window.localStorage.clear();
  registraAnaliticaViva(null);
});
afterEach(() => {
  delete (window as unknown as { posthog?: unknown }).posthog;
});

// ─────────────────────────────────────────────────────────────────────────────
// El escalón del consentimiento.
// ─────────────────────────────────────────────────────────────────────────────
describe("escalón «consintió»", () => {
  it("ACEPTAR emite el evento — aunque el SDK aún no haya cargado cuando se emite", () => {
    const { capturas } = posthogFalso();
    const { panel } = instalaConsentimiento({ superficie: "byo", config: CONFIG });
    panel.abre();
    casilla("analitica").checked = true;
    botonGuardar().click();
    // Justo aquí el evento YA se emitió y el SDK NO estaba listo: si la cola no lo
    // retuviera, se habría perdido y `capturas` quedaría vacío para siempre.
    expect(capturas).toHaveLength(0);
    cargaElScript();
    // EXACTAMENTE UNA VEZ, y el cardinal no es celo: un escalón emitido dos veces no
    // se ve en ningún sitio —ni en rojo, ni en la página, ni en el propio evento— y
    // sale como el DOBLE de gente consintiendo. Un `toContain` da verde con dos.
    // (Lo encontró un mutante que duplicaba la llamada en vez de moverla: sobrevivió.)
    expect(capturas.filter((c) => c[0] === EV.CONSENTIMIENTO_DADO)).toHaveLength(1);
  });

  it("no se re-emite al volver a guardar la MISMA elección… pero sí una por decisión", () => {
    const { capturas } = posthogFalso();
    const { panel } = instalaConsentimiento({ superficie: "byo", config: CONFIG });
    panel.abre();
    casilla("analitica").checked = true;
    botonGuardar().click();
    cargaElScript();
    expect(capturas.filter((c) => c[0] === EV.CONSENTIMIENTO_DADO)).toHaveLength(1);
    // Reabrir y volver a guardar es UNA DECISIÓN MÁS (el visitante revisó su elección),
    // así que emite otra vez. Lo que se fija aquí es que sea una por decisión y no dos.
    panel.abre();
    botonGuardar().click();
    expect(capturas.filter((c) => c[0] === EV.CONSENTIMIENTO_DADO)).toHaveLength(2);
  });

  it("RECHAZAR no emite nada, y ni siquiera inserta el <script>", () => {
    const { capturas } = posthogFalso();
    const { panel } = instalaConsentimiento({ superficie: "byo", config: CONFIG });
    panel.abre();
    botonGuardar().click(); // guardar con las dos casillas apagadas = decidir que no
    expect(document.querySelectorAll(`script[${ATRIBUTO_SCRIPT}]`)).toHaveLength(0);
    expect(capturas).toHaveLength(0);
    // Y la decisión SÍ quedó guardada: rechazar es decidir, no aplazar.
    expect(leerConsentimiento(window.localStorage)!.analitica).toBe(false);
  });

  it("lleva `partida` para poder leer el reparto DENTRO de quien aceptó", () => {
    const { capturas } = posthogFalso();
    const { panel } = instalaConsentimiento({ superficie: "byo", config: CONFIG });
    panel.abre();
    casilla("analitica").checked = true;
    casilla("partida").checked = true;
    botonGuardar().click();
    cargaElScript();
    const props = capturas.find((c) => c[0] === EV.CONSENTIMIENTO_DADO)![1]!;
    expect(props["partida"]).toBe(true);
  });

  it("aceptar SÓLO «guardar mi partida» no enciende la analítica ni emite el escalón", () => {
    const { capturas } = posthogFalso();
    const { panel } = instalaConsentimiento({ superficie: "byo", config: CONFIG });
    panel.abre();
    casilla("partida").checked = true; // el otro nivel sigue apagado
    botonGuardar().click();
    expect(document.querySelectorAll(`script[${ATRIBUTO_SCRIPT}]`)).toHaveLength(0);
    expect(capturas).toHaveLength(0);
    expect(leerConsentimiento(window.localStorage)!.partida).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// El escalón de LLEGADA — el agujero que sólo se ve empezando sin almacén.
// ─────────────────────────────────────────────────────────────────────────────
describe("escalón de llegada (`eventoLlegada`)", () => {
  it("🔴 PRIMERA visita: aceptar recupera la llegada que se descartó al cargar", () => {
    // Sin `eventoLlegada`, éste es el caso que perdía `byo_visto` para siempre:
    // el visitante nuevo que acepta mandaba `consentimiento_dado` y ninguna visita.
    const { capturas } = posthogFalso();
    const { panel } = instalaConsentimiento({
      superficie: "byo",
      config: CONFIG,
      eventoLlegada: EV.BYO_VISTO,
    });
    panel.abre();
    casilla("analitica").checked = true;
    botonGuardar().click();
    cargaElScript();
    const nombres = capturas.map((c) => c[0]);
    expect(nombres).toContain(EV.BYO_VISTO);
    expect(nombres).toContain(EV.CONSENTIMIENTO_DADO);
  });

  it("visita de VUELTA (permiso ya guardado): la llegada sale al instalar, sin panel", () => {
    guardarConsentimiento(window.localStorage, { analitica: true, partida: false });
    const { capturas } = posthogFalso();
    instalaConsentimiento({ superficie: "byo", config: CONFIG, eventoLlegada: EV.BYO_VISTO });
    cargaElScript();
    expect(capturas.filter((c) => c[0] === EV.BYO_VISTO)).toHaveLength(1);
  });

  it("UNA sola vez por carga: revisar la elección después no cuenta otra visita", () => {
    guardarConsentimiento(window.localStorage, { analitica: true, partida: false });
    const { capturas } = posthogFalso();
    const { panel } = instalaConsentimiento({
      superficie: "byo",
      config: CONFIG,
      eventoLlegada: EV.BYO_VISTO,
    });
    cargaElScript();
    panel.abre();
    botonGuardar().click(); // vuelve a decidir: emite consentimiento, NO otra visita
    expect(capturas.filter((c) => c[0] === EV.BYO_VISTO)).toHaveLength(1);
  });

  it("RECHAZAR no emite llegada — y no se guarda para enviarla luego", () => {
    const { capturas } = posthogFalso();
    const { panel } = instalaConsentimiento({
      superficie: "byo",
      config: CONFIG,
      eventoLlegada: EV.BYO_VISTO,
    });
    panel.abre();
    botonGuardar().click(); // las dos casillas apagadas
    expect(document.querySelectorAll(`script[${ATRIBUTO_SCRIPT}]`)).toHaveLength(0);
    expect(capturas).toHaveLength(0);
  });

  it("🔴 el pestillo se cierra cuando la llegada SALE, no cuando se intenta", () => {
    // Si el intento fallido de la instalación (sin permiso) gastara el «ya emitida»,
    // aceptar después no mandaría nada y el agujero seguiría abierto con otra cara.
    const { capturas } = posthogFalso();
    const { panel } = instalaConsentimiento({
      superficie: "byo",
      config: CONFIG,
      eventoLlegada: EV.BYO_VISTO,
    });
    // 1er intento (al instalar): sin permiso ⇒ nada sale, pestillo INTACTO.
    expect(capturas).toHaveLength(0);
    panel.abre();
    casilla("analitica").checked = true;
    botonGuardar().click();
    cargaElScript();
    expect(capturas.filter((c) => c[0] === EV.BYO_VISTO)).toHaveLength(1);
  });

  it("sin `eventoLlegada` no se inventa ninguno", () => {
    guardarConsentimiento(window.localStorage, { analitica: true, partida: false });
    const { capturas } = posthogFalso();
    instalaConsentimiento({ superficie: "byo", config: CONFIG });
    cargaElScript();
    expect(capturas).toHaveLength(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// La etiqueta de idioma.
// ─────────────────────────────────────────────────────────────────────────────
describe("propiedad `idioma`", () => {
  /** Deja el consentimiento ya dado y devuelve la instalación con el SDK ya cargado. */
  function yaAceptado(lang?: string) {
    guardarConsentimiento(window.localStorage, { analitica: true, partida: false });
    if (lang) window.localStorage.setItem("openu5-lang", lang);
    const { capturas } = posthogFalso();
    const inst = instalaConsentimiento({ superficie: "byo", config: CONFIG });
    cargaElScript();
    return { ...inst, capturas };
  }

  it("cada evento sale etiquetado con el idioma elegido en la portada", () => {
    const { analitica, capturas } = yaAceptado("es");
    analitica.evento(EV.BYO_VISTO);
    expect(capturas.at(-1)![1]!["idioma"]).toBe("es");
  });

  it("se lee VIVO: cambiar de idioma a media sesión cambia la etiqueta del evento siguiente", () => {
    const { analitica, capturas } = yaAceptado("es");
    analitica.evento(EV.BYO_VISTO);
    expect(capturas.at(-1)![1]!["idioma"]).toBe("es");
    // El botón ES/EN de la portada escribe justo esta clave, sin recargar la página.
    window.localStorage.setItem("openu5-lang", "en");
    analitica.evento(EV.BYO_CARPETA, { ficheros: 30 });
    expect(capturas.at(-1)![1]!["idioma"]).toBe("en");
  });

  it("sin idioma guardado cae al del navegador, y nunca queda vacío", () => {
    const { analitica, capturas } = yaAceptado();
    analitica.evento(EV.BYO_VISTO);
    expect(["es", "en"]).toContain(capturas.at(-1)![1]!["idioma"]);
  });

  it("un resolvedor de idioma que LANZA no se lleva por delante el evento", () => {
    const capturas: Captura[] = [];
    const a = creaAnalitica({
      config: CONFIG,
      superficie: "byo",
      consentimiento: () => leerConsentimiento(almacenFalso({})) ?? { version: 1, analitica: true, partida: false, fecha: "" },
      cargaSdk: (): SdkCargado => ({
        captura: (n, p) => void capturas.push([n, p]),
        apaga: vi.fn(),
      }),
      idioma: () => {
        throw new Error("SecurityError: modo privado");
      },
      avisa: () => {}, // el aviso es ruido aquí; lo que se mide es que el evento SALE
    });
    a.evento(EV.BYO_VISTO);
    expect(capturas).toHaveLength(1);
    expect(capturas[0]![1]!).not.toHaveProperty("idioma");
  });

  it("un evento que trae su propio `idioma` o `superficie` manda sobre el automático", () => {
    const { analitica, capturas } = yaAceptado("es");
    analitica.evento(EV.BYO_VISTO, { idioma: "de", superficie: "otra" });
    expect(capturas.at(-1)![1]!["idioma"]).toBe("de");
    expect(capturas.at(-1)![1]!["superficie"]).toBe("otra");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// El handle vivo — la ruta que usan los emisores que no lo reciben.
// ─────────────────────────────────────────────────────────────────────────────
describe("handle vivo (`eventoVivo`)", () => {
  function dobleAnalitica() {
    const capturas: Captura[] = [];
    const cargaSdk = vi.fn<(o: OpcionesSdk) => SdkCargado>(() => ({
      captura: (n, p) => void capturas.push([n, p]),
      apaga: vi.fn(),
    }));
    return { capturas, cargaSdk };
  }

  it("SIN registrar es un no-op: no lanza y no envía", () => {
    expect(hayAnaliticaViva()).toBe(false);
    expect(() => eventoVivo(EV.BYO_MOMENTO_ANADIDO, { momento: "m01" })).not.toThrow();
  });

  it("registrado y CON permiso, reenvía el evento con sus propiedades", () => {
    const { capturas, cargaSdk } = dobleAnalitica();
    const almacen = almacenFalso();
    guardarConsentimiento(almacen, { analitica: true, partida: false });
    registraAnaliticaViva(
      creaAnalitica({
        config: CONFIG,
        superficie: "byo",
        consentimiento: () => leerConsentimiento(almacen),
        cargaSdk,
      }),
    );
    eventoVivo(EV.BYO_MOMENTO_ANADIDO, { momento: "m01" });
    expect(capturas).toEqual([[EV.BYO_MOMENTO_ANADIDO, { superficie: "byo", momento: "m01" }]]);
  });

  it("🔴 registrado y SIN permiso, NO reenvía: la puerta está detrás, no delante", () => {
    const { capturas, cargaSdk } = dobleAnalitica();
    registraAnaliticaViva(
      creaAnalitica({
        config: CONFIG,
        superficie: "byo",
        consentimiento: () => leerConsentimiento(almacenFalso()), // sin decidir
        cargaSdk,
      }),
    );
    eventoVivo(EV.BYO_PARTIDA_JUGADA, { origen: "propia" });
    expect(cargaSdk).not.toHaveBeenCalled();
    expect(capturas).toHaveLength(0);
  });

  it("REVOCAR corta también esta ruta, no sólo la del handle directo", () => {
    const { capturas, cargaSdk } = dobleAnalitica();
    const almacen = almacenFalso();
    guardarConsentimiento(almacen, { analitica: true, partida: false });
    registraAnaliticaViva(
      creaAnalitica({
        config: CONFIG,
        superficie: "byo",
        consentimiento: () => leerConsentimiento(almacen),
        cargaSdk,
      }),
    );
    eventoVivo(EV.BYO_PRIMERA_PARTIDA, { origen: "momento" });
    expect(capturas).toHaveLength(1);
    guardarConsentimiento(almacen, { analitica: false, partida: false });
    eventoVivo(EV.BYO_PARTIDA_JUGADA, { origen: "momento" });
    expect(capturas).toHaveLength(1); // el segundo NO salió
  });

  it("🔴 `instalaConsentimiento` registra EL MISMO objeto, no una segunda analítica", () => {
    // El riesgo que mide este caso NO es «se olvidó de registrar» (eso lo mide el caso
    // de arriba): es que lo registrado sea OTRA analítica, con su propia lectura del
    // permiso. Sería el segundo camino a la red que la cabecera del módulo promete que
    // no existe, y `hayAnaliticaViva()` diría que sí igualmente. Sólo se distingue por
    // CONDUCTA: revocar en el handle devuelto tiene que callar también a `eventoVivo`.
    const { capturas } = posthogFalso();
    guardarConsentimiento(window.localStorage, { analitica: true, partida: false });
    const { analitica } = instalaConsentimiento({ superficie: "byo", config: CONFIG });
    cargaElScript();
    expect(hayAnaliticaViva()).toBe(true);

    eventoVivo(EV.BYO_MOMENTO_ANADIDO, { momento: "m01" });
    expect(capturas.map((c) => c[0])).toContain(EV.BYO_MOMENTO_ANADIDO);
    const antes = capturas.length;

    guardarConsentimiento(window.localStorage, { analitica: false, partida: false });
    analitica.sincroniza(); // revocación por el handle devuelto
    eventoVivo(EV.BYO_PARTIDA_JUGADA, { origen: "momento" });
    expect(capturas).toHaveLength(antes); // una analítica aparte habría emitido igual
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// El catálogo, como conjunto.
// ─────────────────────────────────────────────────────────────────────────────
describe("catálogo de eventos", () => {
  it("ningún nombre está repetido", () => {
    const nombres = Object.values(EV);
    expect(new Set(nombres).size).toBe(nombres.length);
  });

  it("los siete escalones del embudo BYO existen y son distintos entre sí", () => {
    const embudo = [
      EV.BYO_VISTO,
      EV.CONSENTIMIENTO_DADO,
      EV.BYO_EXTRACCION_INICIO,
      EV.BYO_EXTRACCION_OK,
      EV.BYO_PRIMERA_PARTIDA,
      EV.BYO_MOMENTO_ANADIDO,
      EV.BYO_PARTIDA_JUGADA,
    ];
    expect(new Set(embudo).size).toBe(7);
    for (const e of embudo) expect(e).toMatch(/^[a-z0-9_]+$/);
  });
});
