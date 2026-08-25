/**
 * #380 — GUARDA: las claves de `<lang>.json` son HUELLAS, no el texto de EA.
 *
 * ── QUÉ VIGILA Y POR QUÉ EXISTE ────────────────────────────────────────────────
 * Hasta el 25-08 las claves de `src/i18n/es.json` eran el texto INGLÉS del juego en
 * claro: 3.998 claves / 26.532 palabras, con diálogo TLK entero, en un fichero
 * TRACKED que viaja al repo público y va empotrado en el bundle que sirve
 * openu5.org. Medido: de esas claves, 2.056 (19.870 palabras, 493 pasajes de ≥13
 * palabras) NO aparecían en NINGÚN otro fichero del índice — `es.json` era su ÚNICO
 * vehículo. Es la misma clase de riesgo que #228/#376 con otro transporte, y era el
 * pendiente #380.
 *
 * Desde este commit la clave es `huella(inglés)` (`src/i18n/huella.ts`). Este
 * fichero impide la vuelta atrás.
 *
 * ── POR QUÉ ESTÁ EN LA BATERÍA PURA ────────────────────────────────────────────
 * Deliberado: `test:pure` es lo que corre el CI del REPO PÚBLICO, que es justo el
 * árbol cuyo contenido se quiere vigilar. Una guarda contra «texto de EA en el
 * árbol» que sólo corriera aquí dentro no protegería al de allí. Por eso no usa el
 * corpus (`game/assets/`, que no viaja): sus predicados son sobre la FORMA de las
 * claves y sobre el hash, y ambos son autónomos.
 *
 * ── EL REPARTO CON `i18n-manifest.test.ts` (no es solapamiento) ────────────────
 * Hay una clase de violación que la forma NO puede ver: una clave inglesa que
 * CASUALMENTE parezca una huella. No es teórica — `Spirituality` e `Intelligence`
 * tienen EXACTAMENTE 12 letras y encajan en `[A-Za-z0-9_-]{12}`; de hecho el primer
 * plegado las dejó en claro por eso mismo y las dos perdieron su traducción sin dar
 * error (lo cazó el careo total, no una muestra). Ese caso lo cubre la guarda
 * ANTI-FABRICACIÓN de `i18n-manifest.test.ts`, que exige que cada clave sea huella
 * de UNA CADENA DEL CORPUS: `Spirituality` no es huella de nada, así que sale como
 * huérfana y enrojece. Necesita el corpus, y por eso vive allí y no aquí.
 * ⇒ forma (pura, viaja) + procedencia (con corpus, no viaja) = la clase entera.
 */
import { describe, it, expect } from "vitest";
import { createHash } from "node:crypto";
import { huella, esHuella, HUELLA_LEN } from "../src/i18n/huella.js";
import esTable from "../src/i18n/es.json";

const claves = Object.keys((esTable as { strings: Record<string, unknown> }).strings);

describe("#380 (A) — la tabla no lleva texto del juego en las claves", () => {
  it("hay claves que vigilar (el predicado no está muerto)", () => {
    // Sin esta cota, una tabla vacía o mal leída dejaría pasar todos los asertos de
    // abajo por población cero — el modo de fallo clásico de una guarda de barrido.
    expect(claves.length).toBeGreaterThan(3000);
  });

  it("TODA clave tiene forma de huella (default-DENY sobre la clase entera)", () => {
    const enClaro = claves.filter((k) => !esHuella(k));
    expect(
      enClaro.slice(0, 8),
      `claves que NO son huellas (¿alguien volvió a meter inglés en claro?). ` +
        `Pliega la tabla con \`node tools/i18n-huella.mjs encode\`.`,
    ).toEqual([]);
  });

  it("ninguna clave lleva espacio, salto ni puntuación de prosa", () => {
    // Redundante con `esHuella` a propósito: nombra el RASGO que se persigue (prosa),
    // no sólo el formato. Si mañana alguien relaja `esHuella`, este aserto sigue en pie.
    const conProsa = claves.filter((k) => /[\s.,!?'"«»:;()]/.test(k));
    expect(conProsa.slice(0, 8), "claves con puntuación/espacio = frases, no huellas").toEqual([]);
  });

  it("la longitud total de las claves es la de 3.998 huellas, no la de un corpus inglés", () => {
    // Cota de VOLUMEN, independiente de la forma: 26.532 palabras de inglés no caben
    // en 12 bytes por clave. Caza el plegado a medias (media tabla en claro).
    const bytes = claves.reduce((a, k) => a + k.length, 0);
    expect(bytes).toBe(claves.length * HUELLA_LEN);
  });
});

describe("#380 (B) — la huella es la que dice ser", () => {
  it("coincide con node:crypto (sha256 → base64url → 12) sobre vectores fijos", () => {
    // Las dos implementaciones (portable en el navegador, node:crypto en las
    // herramientas) tienen que dar lo MISMO o el fichero plegado y el runtime dejarían
    // de entenderse. Careadas aquí sobre vectores, y sobre las 5.944 cadenas del
    // dominio real en el careo del carril.
    const casos = ["", "a", "abc", "Arms", "Incapacitated!", "\n\nYour response?", "ñ", "x".repeat(64), "x".repeat(1000)];
    for (const s of casos) {
      expect(huella(s), `huella de ${JSON.stringify(s.slice(0, 20))}`).toBe(
        createHash("sha256").update(s, "utf8").digest("base64url").slice(0, HUELLA_LEN),
      );
    }
  });

  it("sha256('abc') es el vector conocido de FIPS 180-4", () => {
    // Ancla EN CRUDO del algoritmo: si la implementación portable se rompiera de un
    // modo que node:crypto replicase (no puede, pero el ancla no depende de esa fe),
    // esto lo delata contra el estándar publicado.
    expect(createHash("sha256").update("abc").digest("hex")).toBe(
      "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
    );
    expect(huella("abc")).toBe("ungWv48Bz-pB");
  });

  it("es determinista y la caché no altera el resultado", () => {
    // `huella()` memoiza; una caché mal escrita devolvería la huella de OTRA cadena.
    const a = huella("Arms");
    for (let i = 0; i < 3; i++) expect(huella("Arms")).toBe(a);
    expect(huella("Armss")).not.toBe(a);
  });

  it("no hay colisiones entre las claves vivas de la tabla", () => {
    // Las claves ya son huellas, así que colisión = dos entradas con la misma clave,
    // que el JSON no permite. Lo que se comprueba aquí es el CARDINAL: que plegar no
    // fusionó dos entradas en una (el modo de fallo real de un N corto).
    expect(new Set(claves).size).toBe(claves.length);
  });
});

describe("#380 (C) — la guarda MUERDE (el árbol limpio no ejercita el rojo)", () => {
  it("M1 · el testigo limpio pasa", () => {
    expect(esHuella("ungWv48Bz-pB")).toBe(true);
  });

  it("M2 · una clave inglesa en claro cae por forma", () => {
    for (const prosa of ['"Begone,\nvermin!"\n', "Incapacitated!", "Thou dost see {}", "Arms"]) {
      expect(esHuella(prosa), `${JSON.stringify(prosa)} no puede pasar por huella`).toBe(false);
    }
  });

  it("M3 · el detector de prosa caza puntuación y espacios", () => {
    const conProsa = ["Sulfur Ash", "Look-", "a.b"].filter((k) => /[\s.,!?'"«»:;()]/.test(k));
    expect(conProsa).toEqual(["Sulfur Ash", "a.b"]);
  });

  it("M4 · LÍMITE DECLARADO: una palabra inglesa de 12 letras pasa por forma", () => {
    // No es un fallo de este fichero: es la frontera que justifica el reparto con
    // `i18n-manifest.test.ts` (ver cabecera). Se deja escrito como aserto para que
    // nadie lo lea como cobertura que no existe — y para que, si alguien endurece
    // `esHuella` con un diccionario, este aserto le avise de que cambió el contrato.
    expect(esHuella("Spirituality")).toBe(true);
    expect(esHuella("Intelligence")).toBe(true);
    expect("Spirituality".length).toBe(HUELLA_LEN);
  });
});
