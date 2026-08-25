// @vitest-environment jsdom
/**
 * EL PANEL DE CONSENTIMIENTO — que la UI no conceda lo que el usuario no marcó.
 *
 * Los defectos que sella son los clásicos de un banner de cookies mal hecho, y son
 * defectos MUDOS: la página se ve idéntica tanto si la casilla venía premarcada como
 * si no, y tanto si cerrar cuenta como aceptar como si no. Aquí se miden:
 *   - las dos casillas arrancan APAGADAS (también al reabrir tras rechazar);
 *   - «Guardar elección» guarda EXACTAMENTE lo marcado, nivel a nivel;
 *   - cerrar con ✕ o Escape NO concede nada;
 *   - reabrir muestra lo ya elegido, para poder RETIRARLO (revocación, UE).
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import { creaPanelConsentimiento } from "../src/web/panel-consentimiento.js";
import {
  leerConsentimiento,
  guardarConsentimiento,
  type AlmacenSimple,
  type Consentimiento,
} from "../src/web/consentimiento.js";
import type { Superficie } from "../src/web/superficies.js";

function almacenFalso(): AlmacenSimple {
  const m = new Map<string, string>();
  return {
    getItem: (k) => m.get(k) ?? null,
    setItem: (k, v) => void m.set(k, v),
    removeItem: (k) => void m.delete(k),
  };
}

function monta(superficie: Superficie = "portada", almacen = almacenFalso()) {
  const decisiones: Consentimiento[] = [];
  const panel = creaPanelConsentimiento({
    superficie,
    almacen,
    doc: document,
    idioma: () => "es",
    alDecidir: (c) => void decisiones.push(c),
  });
  return { panel, almacen, decisiones };
}

const casilla = (n: "analitica" | "partida"): HTMLInputElement =>
  document.querySelector<HTMLInputElement>(`#openu5-consentimiento-${n}`)!;
const boton = (a: "rechazar" | "guardar"): HTMLButtonElement =>
  document.querySelector<HTMLButtonElement>(`#openu5-consentimiento [data-accion="${a}"]`)!;

beforeEach(() => {
  document.head.innerHTML = "";
  document.body.innerHTML = "";
});

describe("panel de consentimiento", () => {
  it("las DOS casillas arrancan apagadas en la primera visita", () => {
    const { panel } = monta();
    panel.abre();
    expect(casilla("analitica").checked).toBe(false);
    expect(casilla("partida").checked).toBe(false);
  });

  it("guardar sin marcar nada NO concede nada (y queda decidido: no se vuelve a preguntar)", () => {
    const { panel, almacen } = monta();
    panel.abre();
    boton("guardar").click();
    const c = leerConsentimiento(almacen)!;
    expect(c.analitica).toBe(false);
    expect(c.partida).toBe(false);
    expect(c).not.toBeNull(); // hay decisión ⇒ el panel no reaparece sola
    expect(panel.visible()).toBe(false);
  });

  it("cada nivel se guarda por separado: marcar «partida» no enciende la analítica", () => {
    const { panel, almacen, decisiones } = monta();
    panel.abre();
    casilla("partida").checked = true;
    boton("guardar").click();
    expect(leerConsentimiento(almacen)).toMatchObject({ analitica: false, partida: true });
    expect(decisiones).toHaveLength(1);
  });

  it("✕ no concede nada aunque las casillas estén marcadas", () => {
    const { panel, almacen } = monta();
    panel.abre();
    casilla("analitica").checked = true;
    casilla("partida").checked = true;
    document.querySelector<HTMLButtonElement>("#openu5-consentimiento .x")!.click();
    expect(leerConsentimiento(almacen)).toMatchObject({ analitica: false, partida: false });
  });

  it("Escape tampoco concede nada, y no se propaga al juego", () => {
    const { panel, almacen } = monta("play");
    panel.abre();
    casilla("analitica").checked = true;
    const alJuego = vi.fn();
    document.addEventListener("keydown", alJuego);
    document
      .querySelector("#openu5-consentimiento")!
      .dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    expect(leerConsentimiento(almacen)).toMatchObject({ analitica: false, partida: false });
    expect(alJuego).not.toHaveBeenCalled();
    document.removeEventListener("keydown", alJuego);
  });

  it("reabrir muestra lo YA concedido, para poder retirarlo (revocación)", () => {
    const almacen = almacenFalso();
    guardarConsentimiento(almacen, { analitica: true, partida: true });
    const { panel } = monta("portada", almacen);
    panel.abre();
    expect(casilla("analitica").checked).toBe(true);
    expect(casilla("partida").checked).toBe(true);
    // Retirar sólo uno de los dos.
    casilla("analitica").checked = false;
    boton("guardar").click();
    expect(leerConsentimiento(almacen)).toMatchObject({ analitica: false, partida: true });
  });

  it("«Rechazar todo» retira lo concedido antes", () => {
    const almacen = almacenFalso();
    guardarConsentimiento(almacen, { analitica: true, partida: true });
    const { panel } = monta("portada", almacen);
    panel.abre();
    boton("rechazar").click();
    expect(leerConsentimiento(almacen)).toMatchObject({ analitica: false, partida: false });
  });

  it("el aviso de grabación aparece en LAS TRES superficies (directriz 2026-08-05: play también se graba)", () => {
    for (const [superficie, esperado] of [
      ["portada", true],
      ["byo", true],
      ["play", true],
    ] as const) {
      document.body.innerHTML = "";
      monta(superficie).panel.abre();
      const hayAviso = document.querySelector("#openu5-consentimiento .grab") !== null;
      expect(hayAviso, superficie).toBe(esperado);
    }
  });

  it("el texto declara lo que se envía y lo que NUNCA sale del dispositivo", () => {
    monta().panel.abre();
    const txt = document.querySelector("#openu5-consentimiento")!.textContent ?? "";
    expect(txt).toContain("nunca salen de tu dispositivo");
    expect(txt).toContain("la lista de teclas que pulsas");
    expect(txt).toContain("Nunca los ficheros del juego, nunca imágenes");
  });

  it("abrir dos veces no duplica el panel ni sus estilos", () => {
    const { panel } = monta();
    panel.abre();
    panel.abre();
    expect(document.querySelectorAll("#openu5-consentimiento")).toHaveLength(1);
    expect(document.querySelectorAll("#openu5-consentimiento-css")).toHaveLength(1);
  });
});

/**
 * §ANFITRION — el panel EMPOTRADO de /privacidad.
 *
 * 🔴 LO QUE ESTOS CUATRO ASERTOS PROTEGEN, y por qué ninguno sobra: el modo empotrado
 * es el MISMO panel con cuatro diferencias de comportamiento, y **cada una falla en
 * silencio por su cuenta**. Si se monta fuera del hueco, /privacidad publica una banda
 * flotante y una sección vacía debajo del texto que la anuncia. Si conserva la reserva,
 * deja una franja en blanco al pie. Si `decide()` no reabre, el control DESAPARECE al
 * primer clic en la única página cuyo tema es ese control. Y en las otras trece páginas
 * —que NO ponen hueco— nada de esto debe cambiar: por eso el último caso es el control.
 */
function montaCon(anfitrion?: () => HTMLElement | null) {
  const almacen = almacenFalso();
  const decisiones: Consentimiento[] = [];
  const panel = creaPanelConsentimiento({
    superficie: "doc" as Superficie,
    almacen,
    doc: document,
    idioma: () => "es",
    alDecidir: (c) => void decisiones.push(c),
    anfitrion,
  });
  return { panel, almacen, decisiones };
}

describe("panel EMPOTRADO (§anfitrion)", () => {
  const hueco = () => {
    const d = document.createElement("div");
    d.id = "panel-aqui";
    document.body.appendChild(d);
    return d;
  };

  it("con anfitrión se monta DENTRO del hueco y con la clase que lo desancla", () => {
    const h = hueco();
    montaCon(() => h).panel.abre();
    const el = document.getElementById("openu5-consentimiento")!;
    expect(h.contains(el)).toBe(true);
    expect(el.classList.contains("empotrado")).toBe(true);
  });

  it("empotrado NO crea la reserva (no tapa nada que compensar)", () => {
    const h = hueco();
    montaCon(() => h).panel.abre();
    expect(document.getElementById("openu5-consentimiento-reserva")).toBeNull();
  });

  it("empotrado SIGUE EN PIE tras decidir, con lo elegido ya marcado", () => {
    const h = hueco();
    const { panel, decisiones } = montaCon(() => h);
    panel.abre();
    casilla("analitica").checked = true;
    boton("guardar").click();
    // la decisión se guardó UNA vez…
    expect(decisiones).toEqual([expect.objectContaining({ analitica: true, partida: false })]);
    // …y el panel no se fue: sigue dentro del hueco y refleja lo guardado.
    const el = document.getElementById("openu5-consentimiento");
    expect(el).not.toBeNull();
    expect(h.contains(el!)).toBe(true);
    expect(casilla("analitica").checked).toBe(true);
    // 🔴 Y UNO SOLO: la reapertura no puede duplicar el panel.
    expect(document.querySelectorAll("#openu5-consentimiento")).toHaveLength(1);
  });

  it("CONTROL · sin anfitrión (o con hueco ausente) sigue siendo la banda flotante", () => {
    // Sin la función: las trece páginas que no empotran.
    montaCon().panel.abre();
    let el = document.getElementById("openu5-consentimiento")!;
    expect(el.parentElement).toBe(document.body);
    expect(el.classList.contains("empotrado")).toBe(false);
    expect(document.getElementById("openu5-consentimiento-reserva")).not.toBeNull();
    document.body.innerHTML = "";
    // Con la función pero SIN hueco en el DOM: degrada al mismo estado, no revienta.
    montaCon(() => document.getElementById("panel-aqui")).panel.abre();
    el = document.getElementById("openu5-consentimiento")!;
    expect(el.parentElement).toBe(document.body);
    expect(el.classList.contains("empotrado")).toBe(false);
  });
});
