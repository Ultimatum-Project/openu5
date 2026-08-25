/**
 * ¿HAY ALGO QUE CONSENTIR? — y el guarda que impide que la respuesta se quede rancia.
 *
 * El defecto que estos tests fijan (medido el 2026-08-04 con el sitio YA PUBLICADO): el
 * panel se abría en las tres superficies pidiendo permiso para dos cosas que ninguna
 * podía ocurrir. No era una fuga —no se enviaba nada, que era el compromiso— sino lo
 * contrario: una decisión sin efecto, y una casilla inerte gasta la credibilidad de las
 * que sí funcionarán cuando se cableen.
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  disponibilidadDe,
  hayAlgoQueConsentir,
  puedeAbrirseSolo,
  SUBIDA_DE_PARTIDA_CABLEADA,
} from "../src/web/disponibilidad.js";

// Las CUATRO del tipo `Superficie`. Esta lista es literal y no derivada, así que
// añadir una superficie al tipo NO la mete aquí: hay que escribirla (ficha #125 —
// `doc` llevaba desde el 07-08 en el código y fuera de este barrido).
const SUPERFICIES = ["portada", "byo", "play", "doc"] as const;

describe("disponibilidad: se pregunta por lo que PUEDE pasar", () => {
  it("sin clave y sin subida cableada, NO hay nada que consentir en ninguna superficie", () => {
    for (const superficie of SUPERFICIES) {
      const d = disponibilidadDe({ clave: "", superficie, subidaCableada: false });
      expect(hayAlgoQueConsentir(d), superficie).toBe(false);
      expect(puedeAbrirseSolo(superficie, d), superficie).toBe(false);
    }
  });

  it("una clave en blanco NO cuenta como clave", () => {
    // El caso real: `VITE_POSTHOG_KEY=" "` en un .env mal copiado daría `true` con un
    // `!== ""` a secas, y volveríamos a preguntar por algo que no puede pasar.
    const d = disponibilidadDe({ clave: "   ", superficie: "portada", subidaCableada: false });
    expect(d.analitica).toBe(false);
  });

  it("con clave, el panel se abre solo en portada y byo — y NUNCA en play", () => {
    for (const superficie of SUPERFICIES) {
      const d = disponibilidadDe({ clave: "phc_real", superficie, subidaCableada: false });
      expect(d.analitica, superficie).toBe(true);
      expect(hayAlgoQueConsentir(d), superficie).toBe(true);
      expect(puedeAbrirseSolo(superficie, d)).toBe(superficie !== "play");
    }
  });

  it("play NO se abre solo ni con los DOS permisos disponibles", () => {
    // Control del caso fuerte: la exclusión de `play` es por la SUPERFICIE (el lienzo a
    // pantalla completa), no un efecto colateral de que hoy no haya nada disponible.
    const d = disponibilidadDe({ clave: "phc_real", superficie: "play", subidaCableada: true });
    expect(hayAlgoQueConsentir(d)).toBe(true);
    expect(puedeAbrirseSolo("play", d)).toBe(false);
  });

  it("cablear la subida basta para que portada pregunte, aun sin clave", () => {
    const d = disponibilidadDe({ clave: "", superficie: "portada", subidaCableada: true });
    expect(d.analitica).toBe(false);
    expect(hayAlgoQueConsentir(d)).toBe(true);
    expect(puedeAbrirseSolo("portada", d)).toBe(true);
  });
});

/**
 * 🔴 EL GUARDA QUE IMPORTA. `SUBIDA_DE_PARTIDA_CABLEADA = false` es una AFIRMACIÓN SOBRE
 * EL ÁRBOL —«nadie lee el permiso `partida` para decidir si sube algo»— y las
 * afirmaciones sobre el árbol caducan solas. Sin esto, el carril que cablee la subida
 * dejaría la constante en `false`, el panel no preguntaría, y **subiríamos partidas sin
 * haberlo consentido**: exactamente el defecto contrario y mucho peor que el original.
 *
 * Se busca el ACCESO al campo (`.partida`) en `game/src`, excluyendo los tres ficheros
 * que por definición lo tocan (el que lo define, el que lo pinta y el que lo guarda).
 *
 * ── 🔴 UNA EXCLUSIÓN MÁS, Y POR QUÉ ES DE FORMA Y NO DE FICHERO (ficha #128) ─────────────
 * El 09-08 este guarda se puso ROJO por `web/arranque.ts:178`:
 *     analitica.evento(EV.CONSENTIMIENTO_DADO, { partida: c.partida });
 * Eso NO decide si se sube nada: ETIQUETA un evento de analítica con la elección que el
 * visitante acaba de tomar. El predicado (`.partida` en cualquier posición) era más ancho
 * que la intención declarada arriba («nadie lee el permiso para DECIDIR si sube algo»), y
 * un guarda que grita por algo que no es su defecto acaba desactivado por cansancio.
 *
 * De las tres salidas posibles se descarta la fácil: EXENTAR `arranque.ts` dejaría al
 * guarda CIEGO en ese fichero para siempre, y `arranque.ts` es justo donde primero
 * aparecería una lectura de verdad —es quien tiene el consentimiento en la mano—. Se
 * estrecha la FORMA, no el sitio.
 *
 * El estrechamiento conserva el DEFAULT-DENY: se sigue barriendo TODO `.partida` y sólo se
 * resta UNA forma, la etiqueta dentro de una EMISIÓN DE ANALÍTICA (`evento(…)`,
 * `eventoVivo(…)`, `onAnalyticsEvent(…)`). No se resta «cualquier `partida:` en un objeto»
 * a propósito: un `fetch(…, { body: JSON.stringify({ partida: c.partida }) })` tiene esa
 * misma forma y SÍ manda el permiso a un servidor — ése tiene que seguir gritando.
 *
 * ⚠️ COSTE DECLARADO DEL ESTRECHAMIENTO: un consumidor real escrito DENTRO de una llamada
 * de analítica se colaría (p. ej. `evento(X, { sube: c.partida && subir() })`). Es una
 * forma retorcida y sin motivo, pero es el hueco que este predicado deja, y prefiero
 * nombrarlo aquí a que alguien lo descubra creyendo que el guarda lo cubría.
 */
const RAIZ = new URL("../src", import.meta.url).pathname;
const EXENTOS = new Set(["consentimiento.ts", "panel-consentimiento.ts", "disponibilidad.ts"]);

function ficherosTs(dir: string): string[] {
  const salida: string[] = [];
  for (const entrada of readdirSync(dir)) {
    const ruta = join(dir, entrada);
    if (statSync(ruta).isDirectory()) salida.push(...ficherosTs(ruta));
    else if (entrada.endsWith(".ts") && !EXENTOS.has(entrada)) salida.push(ruta);
  }
  return salida;
}

/**
 * Quita el ARGUMENTO DE PROPIEDADES de las emisiones de analítica, que es donde vive la
 * etiqueta inerte. Deja el resto del fichero intacto para que lo barra el predicado.
 *
 * No intenta parsear TypeScript: casa desde `evento(`/`eventoVivo(`/`onAnalyticsEvent(`
 * hasta el cierre de la llamada, sin cruzar un `;` ni una línea en blanco, que es cuanto
 * necesita una emisión de una sola sentencia. Si algún día una emisión se parte en varias
 * sentencias, esto dejará de recortarla — y el guarda volverá a gritar, que es el lado
 * seguro: prefiere el falso positivo al falso negativo.
 */
function sinEtiquetasDeAnalitica(txt: string): string {
  return txt.replace(
    /\b(?:evento|eventoVivo|onAnalyticsEvent)\s*\([^;]*?\)\s*;/gs,
    "/*emision-de-analitica*/;",
  );
}

describe("guarda: la constante no puede quedarse rancia", () => {
  it("si aparece un consumidor de `.partida`, la constante DEBE estar en true", () => {
    const consumidores = ficherosTs(RAIZ).filter((f) =>
      /\.partida\b/.test(sinEtiquetasDeAnalitica(readFileSync(f, "utf8"))),
    );

    if (SUBIDA_DE_PARTIDA_CABLEADA) {
      // Simétrico: declararla cableada sin consumidor devuelve la casilla inerte.
      expect(
        consumidores.length,
        "SUBIDA_DE_PARTIDA_CABLEADA=true pero NADIE lee `.partida`: el panel pediría permiso para algo que sigue sin ocurrir. Ponla en false o cablea el consumidor.",
      ).toBeGreaterThan(0);
    } else {
      expect(
        consumidores.map((f) => f.slice(RAIZ.length + 1)),
        "Alguien lee `.partida` pero SUBIDA_DE_PARTIDA_CABLEADA sigue en false: el panel NO preguntará y se subirían partidas sin consentimiento. Ponla en true en ESTE commit (game/src/web/disponibilidad.ts).",
      ).toEqual([]);
    }
  });

  /** El predicado COMPLETO, tal y como lo usa el aserto de arriba. */
  const detecta = (src: string) => /\.partida\b/.test(sinEtiquetasDeAnalitica(src));

  it("el guarda TIENE DIENTES: detecta el acceso cuando existe", () => {
    // Control positivo sobre el propio predicado — sin esto, un regex roto daría
    // siempre lista vacía y el guarda sería verde para siempre.
    // 🔴 Se ejerce el predicado COMPLETO (con el recorte de etiquetas dentro), no el regex
    // pelado: tras la ficha #128 el regex ya no es el predicado, y un control que midiera
    // sólo el regex dejaría el recorte —la parte nueva y la única que puede cegar— sin
    // vigilancia. Un control tiene que apuntar al objeto que de verdad decide.
    expect(detecta("if (c.partida) subir()")).toBe(true);
    expect(detecta("// la partida del usuario")).toBe(false);
  });

  it("el ESTRECHAMIENTO no ciega: sólo calla la etiqueta de analítica", () => {
    // 🔴 EL PAR DE LA EXCLUSIÓN. Restar una forma es abrir un hueco, y un hueco sin
    // control se ensancha solo. Estas cuatro filas fijan sus DOS bordes: lo que debe
    // callar, y lo que NO puede callar por parecerse.
    //
    // CALLA (la etiqueta que motivó #128, forma literal de arranque.ts:178):
    expect(detecta("analitica.evento(EV.CONSENTIMIENTO_DADO, { partida: c.partida });")).toBe(
      false,
    );
    // NO CALLA: la misma forma de objeto, pero enviando el permiso a un servidor.
    expect(
      detecta('fetch(u, { body: JSON.stringify({ partida: c.partida }) });'),
    ).toBe(true);
    // NO CALLA: la decisión de subir, que es el defecto que este guarda existe para cazar.
    expect(detecta("if (c.partida) await subeLaPartida();")).toBe(true);
    // NO CALLA: una lectura suelta junto a una emisión — el recorte es de la LLAMADA,
    // no de la línea ni del fichero.
    expect(
      detecta("evento(EV.X, { partida: c.partida });\nif (c.partida) subir();"),
    ).toBe(true);
  });
});
