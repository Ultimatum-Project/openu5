/**
 * EL SUELO TÁCTIL Y SUS EXCEPCIONES — **UN SOLO SITIO**.
 *
 * ══════════════════════════════════════════════════════════════════════════════════════
 * POR QUÉ EXISTE ESTE FICHERO (censo del 03-08, y es el hallazgo que lo justifica)
 * ══════════════════════════════════════════════════════════════════════════════════════
 * El suelo de 44 px estaba escrito A MANO en CUATRO puertas distintas:
 *
 *     mobile-geometry.spec.ts:36     const MIN_TARGET = 44      (+ :469 :571 :572 :610)
 *     mobile-intensive.spec.ts:789   minH: 44 en 5 grupos
 *     mobile-panels.spec.ts:39       const MIN_TARGET = 44      (+ :190)
 *     mobile-audit.spec.ts:531       umbralTarget: 44           (+ el informe HTML)
 *
 * Cuatro copias de la MISMA norma, cada una capaz de moverse sin las otras. Y no es
 * hipotético: el 03-08 se declaró una excepción para el numpad en `mobile-intensive` y las
 * otras tres siguieron exigiendo 44 — tres rojos, uno de ellos **en el layout clásico**,
 * donde no había cambiado nada.
 *
 * ★★ LA REGLA QUE SE FIJA AQUÍ: **una excepción declarada en UNA puerta no es una
 * excepción declarada — es una incoherencia entre dos guardas que miden lo mismo.**
 * Y es la SEGUNDA vez en doce horas que esta familia muerde: la primera fue el ancho del
 * numpad, donde `mobile-geometry` declaraba la exención `/touch-kb|touch-num/` y
 * `mobile-intensive` no la aplicaba. Aquello se arregló aplicando la exención existente;
 * esto quita la duplicación de raíz.
 *
 * ⚠ La cuarta puerta era la peor: `mobile-audit` **publica el umbral en un informe HTML**.
 * Si el suelo se mueve y el informe no, el informe MIENTE a quien lo lea.
 *
 * ══════════════════════════════════════════════════════════════════════════════════════
 * CÓMO SE DECLARA UNA EXCEPCIÓN (y por qué no puede ensancharse sola)
 * ══════════════════════════════════════════════════════════════════════════════════════
 * Con la MISMA disciplina que `mobile-geometry:assertExcepcionDeclarada` ya usaba para la
 * elipsis de los rótulos, que es el patrón bueno de este repo y no se inventa aquí:
 *
 *   · **ATADA A SU FUENTE.** Una excepción cita la regla de producto que la AUTORIZA, y
 *     `assertExcepcionesVivas()` comprueba que esa regla sigue existiendo. Si alguien
 *     deroga la declaración —p. ej. sube el numpad a 44 otra vez—, **la excepción se
 *     evapora sola** y el gate vuelve a exigir el suelo. No se avala: se CITA y se verifica.
 *   · **DEL ANCHO JUSTO.** Una excepción nombra su selector y su EJE. Bajar el alto del
 *     numpad no autoriza a bajar el ancho de nada, ni el alto de otra superficie.
 *   · **CON SALIDA ESCRITA.** `queLaCerraria` no es prosa: es la condición concreta que
 *     haría innecesaria la excepción. Una excepción sin salida es un cabo suelto
 *     disfrazado de registro (misma exigencia que `desamparadas.json` le pone al `motivo`).
 */
import { expect } from "@playwright/test";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * EL SUELO: 44 px CSS, el área táctil mínima del iOS HIG.
 *
 * No es una preferencia nuestra ni un número de auditoría: es la cifra que Apple publica y
 * contra la que se revisa. El extra de 48 (recomendación Android) NO es la norma y depende
 * de la geometría — vive en `deck.ts:sueloFilaUtil`, que lo razona.
 */
export const SUELO_TACTIL = 44;

/** Eje que una excepción relaja. Bajar uno NO autoriza a bajar el otro. */
export type Eje = "alto" | "ancho";

export interface ExcepcionSuelo {
  /**
   * CLASES EXACTAS a las que aplica. Explícitas y no derivadas de un selector: derivarlas
   * «de la última clase del `sel`» hacía que `.touch-sheet-az .touch-kb` NO cubriera el
   * numpad (`.touch-num`) — que es justo la mitad de la clase que la exención histórica
   * `/touch-kb|touch-num/` sí cubría. Una excepción cubre lo que ENUMERA, ni más ni menos.
   */
  readonly clases: readonly string[];
  /** Qué eje se relaja, y hasta cuánto. */
  readonly eje: Eje;
  readonly valor: number;
  /** Etiqueta legible para los mensajes de fallo. */
  readonly etiqueta: string;
  /** DÓNDE ocurre (layout, orientación, superficie). */
  readonly donde: string;
  /** POR QUÉ existe. */
  readonly porQue: string;
  /** QUÉ LA CERRARÍA — la condición concreta, no una intención. */
  readonly queLaCerraria: string;
  /**
   * LA FUENTE QUE LA AUTORIZA: fichero de producto + literal que tiene que seguir ahí.
   * Si desaparece, `assertExcepcionesVivas()` se pone ROJO y la excepción deja de aplicar.
   */
  readonly fuente: { readonly fichero: string; readonly literal: string };
}

export const EXCEPCIONES: readonly ExcepcionSuelo[] = [
  {
    clases: ["touch-num"],
    eje: "alto",
    valor: 34,
    etiqueta: "numpad (excepción declarada)",
    donde: "layout PARTIDO vertical, hoja «123», en todo el censo de dispositivos",
    porQue:
      "Durante 12 h fueron 44, garantizados por un TOPE que acotaba el mapa. El tope se " +
      "retiró el 03-08 porque su coste se midió en un eje (alto) y se pagaba en DOS —la " +
      "escala del mapa es uniforme, así que topar el alto le quitaba el ANCHO y aparecían " +
      "franjas negras laterales— y porque en hardware real mordía donde el emulador decía " +
      "que no. El usuario, mirándolo, prefiere el mapa: «los teclados numéricos se ven bien».",
    queLaCerraria:
      "(a) que VIVA el scroll de la zona de hojas —hoy muerto por el `touch-action:none` de " +
      "`.touch-btn`—, con lo que la botonera podría ceder alto sin robárselo al mapa; o " +
      "(b) un tope re-derivado con su coste medido en LOS DOS EJES y sobre métricas de " +
      "dispositivo REALES, no emuladas.",
    fuente: {
      fichero: "src/skin/portrait/deck-ancho.ts",
      literal: "font-size: 14px; min-height: 34px; touch-action: pan-y;",
    },
  },
  {
    // Cubre las DOS familias de tecla, igual que la exención histórica `/touch-kb|touch-num/`.
    clases: ["touch-kb", "touch-num"],
    eje: "ancho",
    valor: 26,
    etiqueta: "teclas de teclado (QWERTY y numpad)",
    donde: "cualquier hoja de teclado, en los dos layouts",
    porQue:
      "En el eje que se EMPAQUETA el suelo es geométricamente imposible: 10 teclas QWERTY a " +
      "44 piden 440 px en un teléfono de 390, y 3 del numpad piden 132 en una columna de 89. " +
      "El ALTO sí es alcanzable —las filas se apilan— y por eso el ancho cede y el alto no.",
    queLaCerraria:
      "Nada razonable: es geometría, no una deuda. Si algún día el deck deja de empaquetar " +
      "teclas por fila (p. ej. teclado por gestos), la excepción sobra.",
    fuente: {
      fichero: "e2e/mobile/mobile-geometry.spec.ts",
      literal: "/touch-kb|touch-num/",
    },
  },
] as const;

const aqui = dirname(fileURLToPath(import.meta.url));
const RAIZ_GAME = join(aqui, "..", "..");

/**
 * 🔴 COMPRUEBA QUE CADA EXCEPCIÓN SIGUE AUTORIZADA POR SU FUENTE.
 *
 * Es lo que impide que esto se convierta en una lista de perdones: si el literal que la
 * autoriza desaparece del producto, la excepción **no vale**, y este aserto lo dice
 * nombrando la excepción y el fichero. Llámalo desde cualquier puerta que use el suelo.
 */
export function assertExcepcionesVivas(): void {
  for (const e of EXCEPCIONES) {
    const ruta = join(RAIZ_GAME, e.fuente.fichero);
    let texto = "";
    try {
      texto = readFileSync(ruta, "utf8");
    } catch {
      texto = "";
    }
    expect(
      texto.includes(e.fuente.literal),
      `excepción «${e.etiqueta}»: su fuente ya NO la autoriza — falta «${e.fuente.literal}» ` +
        `en ${e.fuente.fichero}. Si la decisión se derogó, RETIRA la excepción de ` +
        `e2e/mobile/suelo-tactil.ts; no la dejes viva sin respaldo.`,
    ).toBe(true);
  }
}

/**
 * Suelo aplicable a un elemento, por su selector/clase y eje. Devuelve `SUELO_TACTIL` salvo
 * que haya una excepción declarada que lo cubra.
 *
 * `clases` es la lista de clases del elemento medido (o su selector): una excepción aplica
 * si su `sel` menciona alguna de ellas. Se compara por CLASE y no por selector completo
 * para que sirva igual a las puertas que miden por `class` que a las que miden por selector.
 */
export function sueloDe(clases: string, eje: Eje): number {
  for (const e of EXCEPCIONES) {
    if (e.eje !== eje) continue;
    if (e.clases.some((c) => clases.includes(c))) return e.valor;
  }
  return SUELO_TACTIL;
}

/** Etiqueta de la excepción que cubre a `clases` en `eje`, o `null`. Para los mensajes. */
export function etiquetaExcepcion(clases: string, eje: Eje): string | null {
  for (const e of EXCEPCIONES) {
    if (e.eje !== eje) continue;
    if (e.clases.some((c) => clases.includes(c))) return e.etiqueta;
  }
  return null;
}
