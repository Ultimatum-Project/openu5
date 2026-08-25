// @vitest-environment jsdom
/**
 * LA GUARDA DEL CARRIL 1: **sin consentimiento, CERO peticiones a PostHog.**
 *
 * No «peticiones sin cookie», no «eventos anónimos», no «se envía y se filtra en el
 * servidor»: cero. Es la afirmación que la portada hace por escrito, así que tiene
 * que ser una propiedad medida y no una intención.
 *
 * ── POR QUÉ ESTA GUARDA TIENE DOS CAPAS ────────────────────────────────────────
 * Contar llamadas al cargador inyectado (capa 1) sólo prueba que `analitica.ts` no
 * llama a SU dependencia — no prueba nada sobre la red, porque el doble no la toca.
 * Un fallo real («alguien mete un `fetch` de prueba en el cargador», «el SDK se
 * importa por npm y se autoinicializa al importarse») pasaría esa capa entera.
 * Por eso la capa 2 corre el cargador REAL (`sdk-posthog.ts`) en un documento jsdom
 * y cuenta los CANALES DE SALIDA: `<script>` insertados, `fetch`, `XMLHttpRequest`,
 * `sendBeacon` e `<img>`. Ahí sí se mide la propiedad que se afirma.
 *
 * La capa 3 es el CONTROL POSITIVO: con clave y con permiso, el script SÍ aparece,
 * y apunta a `…/static/array.js`. Sin él, un cargador roto —o un `cargaSdk` que no
 * hiciera nada— daría los mismos ceros y la guarda estaría verde por vacío.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { creaAnalitica, type OpcionesSdk, type SdkCargado } from "../src/web/analitica.js";
import {
  CLAVE_CONSENTIMIENTO,
  VERSION_CONSENTIMIENTO,
  guardarConsentimiento,
  leerConsentimiento,
  type AlmacenSimple,
  type Consentimiento,
} from "../src/web/consentimiento.js";
import { permiteGrabacionSesion, type Superficie } from "../src/web/superficies.js";
import { ATRIBUTO_SCRIPT, cargaSdkPostHog } from "../src/web/sdk-posthog.js";

const CLAVE = "phc_clave_de_prueba";
const HOST = "https://eu.i.posthog.com";

/** Almacén de mentira, sin depender del localStorage del entorno de test. */
function almacenFalso(inicial: Record<string, string> = {}): AlmacenSimple {
  const m = new Map(Object.entries(inicial));
  return {
    getItem: (k) => m.get(k) ?? null,
    setItem: (k, v) => void m.set(k, v),
    removeItem: (k) => void m.delete(k),
  };
}

function consentimientoDe(analitica: boolean, partida = false): AlmacenSimple {
  const a = almacenFalso();
  guardarConsentimiento(a, { analitica, partida });
  return a;
}

// ─────────────────────────────────────────────────────────────────────────────
// CAPA 1 — la decisión: ¿se llega siquiera a pedir la carga del SDK?
// ─────────────────────────────────────────────────────────────────────────────
describe("capa 1 · la decisión no llega al cargador sin permiso", () => {
  function monta(almacen: AlmacenSimple, clave = CLAVE, superficie: Superficie = "portada") {
    const cargaSdk = vi.fn<(o: OpcionesSdk) => SdkCargado>(() => ({
      captura: vi.fn(),
      apaga: vi.fn(),
    }));
    const analitica = creaAnalitica({
      config: { clave, host: HOST },
      superficie,
      consentimiento: () => leerConsentimiento(almacen),
      cargaSdk,
    });
    return { analitica, cargaSdk };
  }

  it("SIN DECIDIR (nada guardado) ⇒ no se pide el SDK ni se envía un evento", () => {
    const { analitica, cargaSdk } = monta(almacenFalso());
    expect(analitica.sincroniza()).toBe("sin-consentimiento");
    analitica.evento("portada_vista");
    expect(cargaSdk).not.toHaveBeenCalled();
    expect(analitica.activa()).toBe(false);
  });

  it("RECHAZADO explícitamente ⇒ tampoco", () => {
    const { analitica, cargaSdk } = monta(consentimientoDe(false));
    expect(analitica.sincroniza()).toBe("sin-consentimiento");
    analitica.evento("portada_vista");
    expect(cargaSdk).not.toHaveBeenCalled();
  });

  it("ACEPTADO pero SIN CLAVE (el despliegue de hoy) ⇒ tampoco se carga nada", () => {
    const { analitica, cargaSdk } = monta(consentimientoDe(true), "");
    expect(analitica.sincroniza()).toBe("sin-clave");
    analitica.evento("portada_vista");
    expect(cargaSdk).not.toHaveBeenCalled();
  });

  it("consentimiento CORRUPTO o de otra versión ⇒ se trata como sin decidir", () => {
    for (const crudo of [
      "{no es json",
      "null",
      '"una cadena"',
      JSON.stringify({ version: VERSION_CONSENTIMIENTO + 1, analitica: true, partida: true }),
      JSON.stringify({ version: VERSION_CONSENTIMIENTO, analitica: "sí", partida: true }),
    ]) {
      const { analitica, cargaSdk } = monta(almacenFalso({ [CLAVE_CONSENTIMIENTO]: crudo }));
      expect(analitica.sincroniza(), crudo).toBe("sin-consentimiento");
      expect(cargaSdk, crudo).not.toHaveBeenCalled();
    }
  });

  it("ACEPTADO y con clave ⇒ el SDK se pide UNA vez y los eventos salen", () => {
    const { analitica, cargaSdk } = monta(consentimientoDe(true));
    expect(analitica.sincroniza()).toBe("arrancada");
    analitica.sincroniza();
    analitica.evento("portada_vista");
    expect(cargaSdk).toHaveBeenCalledTimes(1);
    expect(analitica.activa()).toBe(true);
  });

  it("REVOCAR en caliente apaga el SDK ya cargado y corta los eventos", () => {
    const almacen = consentimientoDe(true);
    const { analitica, cargaSdk } = monta(almacen);
    analitica.sincroniza();
    const sdk = cargaSdk.mock.results[0]!.value as SdkCargado;
    analitica.evento("uno");
    expect(sdk.captura).toHaveBeenCalledTimes(1);

    guardarConsentimiento(almacen, { analitica: false, partida: false });
    expect(analitica.sincroniza()).toBe("sin-consentimiento");
    expect(sdk.apaga).toHaveBeenCalledTimes(1);
    analitica.evento("dos");
    expect(sdk.captura).toHaveBeenCalledTimes(1); // el segundo NO se envió
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// CAPA 2 y 3 — los canales de salida REALES, con el cargador de verdad.
// ─────────────────────────────────────────────────────────────────────────────
describe("capa 2 · con el cargador REAL, ningún canal de salida se abre", () => {
  /** Todo lo que una página puede usar para hablar con un tercero. */
  interface Canales {
    scripts(): number;
    fetch: ReturnType<typeof vi.fn>;
    xhr: ReturnType<typeof vi.fn>;
    beacon: ReturnType<typeof vi.fn>;
    imgs(): number;
    iframes(): number;
  }
  let canales: Canales;
  let restaurar: (() => void)[] = [];

  beforeEach(() => {
    document.head.innerHTML = "";
    document.body.innerHTML = "";
    const f = vi.fn(async () => new Response("{}"));
    const x = vi.fn();
    const b = vi.fn(() => true);
    const antesFetch = globalThis.fetch;
    const antesOpen = XMLHttpRequest.prototype.open;
    const antesBeacon = navigator.sendBeacon;
    globalThis.fetch = f as unknown as typeof fetch;
    XMLHttpRequest.prototype.open = x as unknown as typeof XMLHttpRequest.prototype.open;
    Object.defineProperty(navigator, "sendBeacon", { value: b, configurable: true });
    restaurar = [
      () => void (globalThis.fetch = antesFetch),
      () => void (XMLHttpRequest.prototype.open = antesOpen),
      () => Object.defineProperty(navigator, "sendBeacon", { value: antesBeacon, configurable: true }),
    ];
    canales = {
      scripts: () => document.querySelectorAll("script").length,
      fetch: f,
      xhr: x,
      beacon: b,
      imgs: () => document.querySelectorAll("img").length,
      iframes: () => document.querySelectorAll("iframe").length,
    };
  });
  afterEach(() => {
    for (const r of restaurar) r();
  });

  function todoACero(): void {
    expect(canales.scripts(), "<script> insertados").toBe(0);
    expect(canales.fetch, "fetch()").not.toHaveBeenCalled();
    expect(canales.xhr, "XMLHttpRequest.open()").not.toHaveBeenCalled();
    expect(canales.beacon, "navigator.sendBeacon()").not.toHaveBeenCalled();
    expect(canales.imgs(), "<img> insertados (píxel de rastreo)").toBe(0);
    expect(canales.iframes(), "<iframe> insertados").toBe(0);
  }

  function montaReal(almacen: AlmacenSimple, clave: string, superficie: Superficie) {
    return creaAnalitica({
      config: { clave, host: HOST },
      superficie,
      consentimiento: () => leerConsentimiento(almacen),
      cargaSdk: (o) => cargaSdkPostHog(o, document, window),
    });
  }

  for (const superficie of ["portada", "byo", "play", "doc"] as const) {
    it(`${superficie}: sin decidir ⇒ cero salidas por cualquier canal`, () => {
      const a = montaReal(almacenFalso(), CLAVE, superficie);
      a.sincroniza();
      a.evento("portada_vista");
      a.evento("byo_carpeta_elegida", { n: 42 });
      todoACero();
    });

    it(`${superficie}: rechazado ⇒ cero salidas por cualquier canal`, () => {
      const a = montaReal(consentimientoDe(false), CLAVE, superficie);
      a.sincroniza();
      a.evento("byo_extraccion_ok");
      todoACero();
    });

    it(`${superficie}: aceptado pero SIN CLAVE ⇒ cero salidas por cualquier canal`, () => {
      const a = montaReal(consentimientoDe(true), "", superficie);
      a.sincroniza();
      a.evento("byo_extraccion_ok");
      todoACero();
    });
  }
});

describe("capa 3 · control positivo: con permiso y clave el script SÍ se inserta", () => {
  beforeEach(() => {
    document.head.innerHTML = "";
    document.body.innerHTML = "";
  });

  function scriptInsertado(): HTMLScriptElement | null {
    return document.querySelector<HTMLScriptElement>(`script[${ATRIBUTO_SCRIPT}]`);
  }

  it("inserta EXACTAMENTE un <script> hacia array.js del host configurado", () => {
    const a = creaAnalitica({
      config: { clave: CLAVE, host: HOST },
      superficie: "portada",
      consentimiento: () => leerConsentimiento(consentimientoDe(true)),
      cargaSdk: (o) => cargaSdkPostHog(o, document, window),
    });
    expect(a.sincroniza()).toBe("arrancada");
    a.sincroniza();
    a.evento("portada_vista");
    const scripts = document.querySelectorAll(`script[${ATRIBUTO_SCRIPT}]`);
    expect(scripts.length).toBe(1);
    expect(scriptInsertado()!.src).toBe(`${HOST}/static/array.js`);
  });

  it("el init pasa disable_session_recording SEGÚN la superficie (y en /doc queda apagada)", async () => {
    const vistos: Record<string, Record<string, unknown>> = {};
    for (const superficie of ["portada", "byo", "play", "doc"] as const) {
      document.head.innerHTML = "";
      const init = vi.fn((_c: string, cfg: Record<string, unknown>) => {
        vistos[superficie] = cfg;
      });
      (window as unknown as { posthog?: unknown }).posthog = { init, capture: vi.fn() };
      const sdk = cargaSdkPostHog(
        {
          clave: CLAVE,
          host: HOST,
          superficie,
          grabacionSesion: permiteGrabacionSesion(superficie),
        },
        document,
        window,
      );
      sdk.captura("antes-de-cargar"); // se encola: el script aún no ha "cargado"
      scriptInsertado()!.dispatchEvent(new Event("load"));
      expect(init).toHaveBeenCalledTimes(1);
    }
    expect(vistos["portada"]!["disable_session_recording"]).toBe(false);
    expect(vistos["byo"]!["disable_session_recording"]).toBe(false);
    // Directriz del usuario (2026-08-05): «grabación de todas las sesiones» — /play
    // TAMBIÉN se graba (canvas incluido). La exclusión anterior queda derogada; su
    // razón histórica está en el docstring de permiteGrabacionSesion.
    expect(vistos["play"]!["disable_session_recording"]).toBe(false);
    // `doc` es la ÚNICA que llega hoy al init con la grabación apagada — el extremo
    // opuesto del aserto, sin el cual esta prueba pasaría con la lista blanca abierta
    // de par en par (todo `false` es indistinguible de «no filtra nada»).
    expect(vistos["doc"]!["disable_session_recording"]).toBe(true);
    delete (window as unknown as { posthog?: unknown }).posthog;
  });

  it("los eventos encolados antes de cargar se sueltan al cargar, y NO antes", () => {
    document.head.innerHTML = "";
    const capture = vi.fn();
    (window as unknown as { posthog?: unknown }).posthog = { init: vi.fn(), capture };
    const sdk = cargaSdkPostHog(
      { clave: CLAVE, host: HOST, superficie: "byo", grabacionSesion: true },
      document,
      window,
    );
    sdk.captura("uno");
    sdk.captura("dos");
    expect(capture).not.toHaveBeenCalled();
    scriptInsertado()!.dispatchEvent(new Event("load"));
    expect(capture.mock.calls.map((c) => c[0])).toEqual(["uno", "dos"]);
    delete (window as unknown as { posthog?: unknown }).posthog;
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// El modelo de consentimiento, por sí solo.
// ─────────────────────────────────────────────────────────────────────────────
describe("modelo de consentimiento", () => {
  it("los dos niveles son INDEPENDIENTES: aceptar partida no enciende la analítica", () => {
    const a = almacenFalso();
    const c = guardarConsentimiento(a, { analitica: false, partida: true });
    expect(c.analitica).toBe(false);
    expect(c.partida).toBe(true);
    const leido = leerConsentimiento(a) as Consentimiento;
    expect(leido.analitica).toBe(false);
    expect(leido.partida).toBe(true);
  });

  it("un almacén que LANZA se lee como «sin decidir», no como aceptado", () => {
    const roto: AlmacenSimple = {
      getItem: () => {
        throw new Error("SecurityError: modo privado");
      },
      setItem: () => {
        throw new Error("QuotaExceeded");
      },
      removeItem: () => {},
    };
    expect(leerConsentimiento(roto)).toBeNull();
    // Y guardar tampoco puede reventar la página: devuelve la elección en memoria.
    expect(guardarConsentimiento(roto, { analitica: true, partida: false }).analitica).toBe(true);
  });

  it("permiteGrabacionSesion es LISTA BLANCA: las cuatro superficies clasificadas, y nada más", () => {
    expect(permiteGrabacionSesion("portada")).toBe(true);
    expect(permiteGrabacionSesion("byo")).toBe(true);
    // Directriz del usuario (2026-08-05): /play también se graba. Sigue siendo lista
    // BLANCA: el valor de la lista no era excluir a play, era que lo no clasificado
    // caiga del lado seguro — y eso se conserva.
    expect(permiteGrabacionSesion("play")).toBe(true);
    // `doc` (páginas de documentación) NO graba: decisión del lead del 2026-08-09,
    // ficha #125, razonada en el docstring de permiteGrabacionSesion. Este aserto es
    // lo ÚNICO que distingue «excluida a propósito» de «se nos olvidó clasificarla»:
    // en el código las dos son el mismo `false`.
    expect(permiteGrabacionSesion("doc")).toBe(false);
    // Una superficie futura sin clasificar cae del lado seguro.
    expect(permiteGrabacionSesion("atlas" as Superficie)).toBe(false);
  });
});
