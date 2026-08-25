/**
 * @vitest-environment jsdom
 *
 * LA MINIATURA SALE A RESOLUCIÓN NATIVA EN TODOS LOS LAYOUTS (ficha #153).
 *
 * EL DEFECTO QUE CIERRA, MEDIDO POR LA AUDITORÍA audit-ux: en escritorio y en el layout
 * móvil CLÁSICO la captura salía 320×200; en el layout PARTIDO (el de fábrica en táctil) y
 * en APAISADO salía el TELÉFONO ENTERO —1170×1696 y 1700×1020, 5,5× de peso— porque el
 * heurístico de `ui/screenshot.ts` exige que el visible sea un múltiplo ENTERO del nativo
 * con el mismo factor en los dos ejes, y ahí los factores son 3,66/8,48 y 5,31/5,10. El
 * canvas 320×200 EXISTÍA y estaba pintado (byte a byte idéntico entre layouts, SHA-256
 * careado): era un fallo de SELECCIÓN.
 *
 * ── POR QUÉ ESTE FICHERO TIENE DOS MITADES QUE PARECEN LA MISMA ─────────────────────────
 * Hay DOS propiedades independientes y hacen falta las dos, porque cada una tiene su propio
 * modo de romperse en silencio:
 *
 *   §A  la piel fiel DECLARA su búfer  →  su sujeto es `skin/fiel/skin.ts`
 *   §B  el selector PREFIERE lo declarado  →  su sujeto es `ui/screenshot.ts`
 *
 * Un test que sólo construya canvas de mentira y llame al selector (§B) pasa VERDE con la
 * declaración BORRADA de la piel: el test se fabrica su propio marcador. Y un test que sólo
 * mire el atributo (§A) pasa verde con el selector ignorándolo. El mutante M1 de la ficha —
 * quitar `declararBuferNativo(canvas)` de `skin/fiel/skin.ts:2149`— sólo muere si §A monta
 * LA PIEL DE VERDAD, así que §A la monta.
 *
 * 🔴 Y `mount` NO LLEGA AL FINAL EN JSDOM, A PROPÓSITO. jsdom no trae el paquete `canvas`,
 * así que `getContext("2d")` devuelve `null` y `FaithfulSkin.mount` lanza «sin contexto 2D»
 * — pero eso pasa DESPUÉS de crear el canvas, marcarlo y colgarlo del árbol, que es todo lo
 * que §A necesita. La promesa rechazada se traga a propósito. Si algún día alguien mueve el
 * `getContext` por delante del `appendChild`, este test se pondrá rojo: es un aviso
 * correcto, no un falso positivo, porque en ese mundo la marca ya no estaría en el DOM.
 */
import { describe, expect, it } from "vitest";
import {
  NATIVE_ATTR,
  buferNativo,
  declararBuferNativo,
  elegirCanvas,
} from "../src/ui/screenshot.js";
import { debeRecapturar, medirPng, refrescarMiniatura } from "../src/ui/shot-refresh.js";
import { esCapturaCanonica } from "../src/core/png-dims.js";
import { FaithfulSkin } from "../src/skin/fiel/skin.js";
import type { CoreView } from "../src/skin/api.js";

/** Un canvas real de jsdom con el backbuffer pedido, colgado de `root`. */
function canvasEn(root: HTMLElement, w: number, h: number, marcado = false): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  if (marcado) declararBuferNativo(c);
  root.appendChild(c);
  return c;
}

/**
 * Monta la piel fiel de VERDAD y devuelve el root con su canvas dentro.
 * Ver la cabecera: `mount` rechaza en jsdom y eso no invalida nada de lo que §A mide.
 */
function montarFiel(): HTMLElement {
  const root = document.createElement("div");
  document.body.appendChild(root);
  const skin = new FaithfulSkin();
  const vistaVacia = {} as CoreView;
  const intentsVacios = { send: () => {} } as unknown as Parameters<FaithfulSkin["mount"]>[2];
  void skin.mount(root, vistaVacia, intentsVacios).catch(() => {
    /* jsdom sin contexto 2D: esperado, y posterior al appendChild del canvas */
  });
  return root;
}

/**
 * En jsdom `getImageData` no existe, así que el predicado de contenido REAL diría «vacío»
 * de todos los canvas y taparía lo que se quiere medir aquí. Se inyecta, que es para lo que
 * `screenshot.ts` acepta los predicados por parámetro. La guarda de contenido tiene sus
 * propios casos en §C, con el predicado diciendo la verdad sobre cada canvas.
 */
const TODOS_CON_CONTENIDO = { conContenido: () => true };

// ── §A · LA PIEL DECLARA (mutante M1) ───────────────────────────────────────────────────

describe("§A la piel fiel declara su búfer nativo", () => {
  it("monta un canvas 320×200 y lo MARCA (M1: sin la marca, muere §B entero)", () => {
    const root = montarFiel();
    const c = root.querySelector("canvas");
    expect(c, "FaithfulSkin.mount no dejó ningún canvas en el árbol").not.toBeNull();
    expect(`${c!.width}×${c!.height}`).toBe("320×200");
    expect(
      c!.getAttribute(NATIVE_ATTR),
      `el canvas de la piel fiel no lleva ${NATIVE_ATTR}: la captura volverá a adivinar`,
    ).toBe("1");
  });
});

// ── §B · EL SELECTOR PREFIERE LO DECLARADO, EN LAS CUATRO TOPOLOGÍAS MEDIDAS ────────────

/**
 * Las cuatro filas son las de la auditoría. Las dos primeras ya salían bien ANTES del fix y
 * están aquí como NO-REGRESIÓN: sin ellas, un cambio que arregle el móvil rompiendo el
 * escritorio pasaría verde.
 */
const LAYOUTS = [
  { nombre: "escritorio (shader)", visible: [960, 600] },
  { nombre: "móvil CLÁSICO", visible: [960, 600] },
  { nombre: "móvil PARTIDO (de fábrica)", visible: [1170, 1696] },
  { nombre: "móvil APAISADO", visible: [1700, 1020] },
] as const;

describe("§B el búfer declarado gana en TODOS los layouts", () => {
  for (const { nombre, visible } of LAYOUTS) {
    it(`${nombre} (visible ${visible[0]}×${visible[1]}) captura 320×200`, () => {
      const root = montarFiel();
      canvasEn(root, visible[0], visible[1]); // el compuesto que ve el jugador
      for (let i = 0; i < 4; i++) canvasEn(root, 8, 8); // los u5of-brk del marco
      const el = elegirCanvas([...root.querySelectorAll("canvas")], TODOS_CON_CONTENIDO);
      expect(el).not.toBeNull();
      expect(
        `${el!.canvas.width}×${el!.canvas.height}`,
        `${nombre}: se capturaría ${el!.canvas.width}×${el!.canvas.height}`,
      ).toBe("320×200");
      expect(el!.declarado, `${nombre}: se eligió por heurístico, no por declaración`).toBe(true);
    });
  }

  it("CONTROL de que §B no es vacuo: sin declaración, el partido SÍ cae al teléfono entero", () => {
    // Reproduce el defecto original quitando la marca. Si este caso saliera 320×200, el de
    // arriba no estaría midiendo la declaración sino una casualidad de la geometría.
    const root = document.createElement("div");
    canvasEn(root, 320, 200); // el nativo, SIN marcar
    canvasEn(root, 1170, 1696);
    const el = elegirCanvas([...root.querySelectorAll("canvas")], TODOS_CON_CONTENIDO);
    expect(`${el!.canvas.width}×${el!.canvas.height}`).toBe("1170×1696");
    expect(el!.declarado).toBe(false);
  });

  it("el heurístico SIGUE vivo para una piel sin declaración (escritorio, no-regresión)", () => {
    const root = document.createElement("div");
    canvasEn(root, 320, 200);
    canvasEn(root, 960, 600);
    for (let i = 0; i < 4; i++) canvasEn(root, 8, 8);
    const el = elegirCanvas([...root.querySelectorAll("canvas")], TODOS_CON_CONTENIDO);
    expect(`${el!.canvas.width}×${el!.canvas.height}`).toBe("320×200");
    expect(el!.declarado).toBe(false);
  });

  it("una declaración de 640×400 gana al 320×200 declarado (la escala no está cableada)", () => {
    const root = document.createElement("div");
    canvasEn(root, 320, 200, true);
    canvasEn(root, 640, 400, true);
    canvasEn(root, 1280, 800);
    const el = elegirCanvas([...root.querySelectorAll("canvas")], TODOS_CON_CONTENIDO);
    expect(`${el!.canvas.width}×${el!.canvas.height}`).toBe("640×400");
  });
});

// ── §C · MUTANTE M2 · DECLARACIÓN QUE APUNTA A UN CANVAS VACÍO ──────────────────────────

describe("§C M2 — una declaración sin contenido NO captura negro", () => {
  it("cae al heurístico cuando el declarado está en blanco", () => {
    const root = document.createElement("div");
    const vacio = canvasEn(root, 320, 200, true); // declarado y EN BLANCO
    const bueno = canvasEn(root, 320, 200); // sin marca pero pintado
    canvasEn(root, 960, 600);
    const el = elegirCanvas([...root.querySelectorAll("canvas")], {
      conContenido: (c) => c !== vacio,
    });
    expect(el!.canvas, "se eligió el búfer declarado VACÍO: la miniatura saldría negra").toBe(
      bueno,
    );
    expect(el!.declarado).toBe(false);
  });

  it("sin respaldo posible, degrada al VISIBLE — nunca al declarado vacío", () => {
    const root = document.createElement("div");
    const vacio = canvasEn(root, 320, 200, true);
    const visible = canvasEn(root, 1170, 1696);
    const el = elegirCanvas([...root.querySelectorAll("canvas")], {
      conContenido: (c) => c !== vacio,
    });
    expect(el!.canvas).toBe(visible);
  });

  it("CONTROL: con contenido, ese mismo declarado SÍ gana (el aserto de arriba no es vacuo)", () => {
    const root = document.createElement("div");
    const declarado = canvasEn(root, 320, 200, true);
    canvasEn(root, 1170, 1696);
    const el = elegirCanvas([...root.querySelectorAll("canvas")], TODOS_CON_CONTENIDO);
    expect(el!.canvas).toBe(declarado);
  });
});

// ── §D · LAS DOS GUARDAS HISTÓRICAS DE `buferNativo` SIGUEN EN PIE ──────────────────────

describe("§D el heurístico no se ha aflojado por el camino", () => {
  it("un 8×8 solo NO es candidato aunque 960/8 y 600/8 sean enteros (120 ≠ 75)", () => {
    const brk = { width: 8, height: 8 };
    const visible = { width: 960, height: 600 };
    expect(buferNativo([brk, visible], visible, () => true)).toBeNull();
  });
});

// ── §E · RE-CAPTURA DE LAS VIEJAS: EL PREDICADO ────────────────────────────────────────

/** PNG REAL de 7×3 (zlib+CRC de verdad, generado fuera de este fichero) — control del parser. */
const PNG_REAL_7x3 =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAcAAAADCAIAAADQoYKS" +
  "AAAAEklEQVR4nGP4z8CAibAI4RQFAMeWFOx1QjWwAAAAAElFTkSuQmCC";

/** Cabecera PNG sintética con las dimensiones pedidas (para las que no quiero codificar). */
function pngDe(w: number, h: number): string {
  const b = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13];
  for (const ch of "IHDR") b.push(ch.charCodeAt(0));
  for (const v of [w, h]) b.push((v >>> 24) & 255, (v >>> 16) & 255, (v >>> 8) & 255, v & 255);
  b.push(8, 2, 0, 0, 0, 0, 0, 0, 0); // resto de IHDR + CRC (irrelevantes para el parseo)
  return "data:image/png;base64," + btoa(String.fromCharCode(...b));
}

describe("§E medirPng", () => {
  it("lee las dimensiones de un PNG REAL (control independiente del generador sintético)", () => {
    expect(medirPng(PNG_REAL_7x3)).toEqual({ width: 7, height: 3 });
  });

  it("lee las dimensiones del sintético (que es lo que usan los casos de abajo)", () => {
    expect(medirPng(pngDe(1170, 1696))).toEqual({ width: 1170, height: 1696 });
  });

  it("devuelve null para un jpeg viejo y para basura", () => {
    expect(medirPng("data:image/jpeg;base64,/9j/4AAQSkZJRg==")).toBeNull();
    expect(medirPng("data:image/png;base64,AAAA")).toBeNull();
    expect(medirPng("no soy un dataURL")).toBeNull();
  });
});

const DECLARADO_320 = { width: 320, height: 200, declarado: true };

describe("§E debeRecapturar", () => {
  it("sin miniatura ⇒ sí", () => {
    expect(debeRecapturar(null, DECLARADO_320)).toBe(true);
  });

  it("jpeg de antes del 08-08 ⇒ sí", () => {
    expect(debeRecapturar("data:image/jpeg;base64,/9j/4AAQSkZJRg==", DECLARADO_320)).toBe(true);
  });

  it("el TELÉFONO ENTERO de un layout partido ⇒ sí (el caso que motiva la ficha)", () => {
    expect(debeRecapturar(pngDe(1170, 1696), DECLARADO_320)).toBe(true);
  });

  it("ya está a resolución nativa ⇒ NO (y aquí es donde se corta el bucle)", () => {
    expect(debeRecapturar(pngDe(320, 200), DECLARADO_320)).toBe(false);
  });

  it("🔴 piel SIN declaración ⇒ NO, aunque las dimensiones no cuadren", () => {
    // El criterio ingenuo («si no es 320×200, re-captura») pisaría esta miniatura BUENA con
    // el teléfono entero: sin declaración, lo que se capturaría ahora son 1170×1696. Este
    // caso es el que separa el criterio correcto del invertido.
    const sinDeclarar = { width: 1170, height: 1696, declarado: false };
    expect(debeRecapturar(pngDe(320, 200), sinDeclarar)).toBe(false);
    expect(debeRecapturar(null, sinDeclarar)).toBe(false);
  });

  it("sin canvas todavía (objetivo null) ⇒ NO", () => {
    expect(debeRecapturar(null, null)).toBe(false);
  });

  it("una piel de 640×400 declarada CONVERGE a 640×400, no a 320×200", () => {
    const declarado640 = { width: 640, height: 400, declarado: true };
    expect(debeRecapturar(pngDe(320, 200), declarado640)).toBe(true);
    expect(debeRecapturar(pngDe(640, 400), declarado640)).toBe(false);
  });
});

// ── §F · RE-CAPTURA DE LAS VIEJAS: EL EFECTO ───────────────────────────────────────────

interface Espia {
  escrituras: [string, string][];
  deps: Parameters<typeof refrescarMiniatura>[2];
}

function espia(guardada: string | null, objetivo: { width: number; height: number; declarado: boolean } | null): Espia {
  const escrituras: [string, string][] = [];
  let almacen = guardada;
  return {
    escrituras,
    deps: {
      leer: () => almacen,
      escribir: (id, shot) => {
        escrituras.push([id, shot]);
        almacen = shot;
        return true;
      },
      capturar: () => pngDe(objetivo?.width ?? 0, objetivo?.height ?? 0),
      medir: () => objetivo,
      esperarFrame: () => Promise.resolve(),
      intentados: new Set<string>(),
    },
  };
}

describe("§F refrescarMiniatura", () => {
  it("re-escribe la miniatura del teléfono entero con una de 320×200", async () => {
    const e = espia(pngDe(1170, 1696), DECLARADO_320);
    expect(await refrescarMiniatura("save-1", document, e.deps)).toBe(true);
    expect(e.escrituras).toHaveLength(1);
    expect(medirPng(e.escrituras[0]![1])).toEqual({ width: 320, height: 200 });
  });

  it("NO toca una que ya está bien", async () => {
    const e = espia(pngDe(320, 200), DECLARADO_320);
    expect(await refrescarMiniatura("save-2", document, e.deps)).toBe(false);
    expect(e.escrituras).toHaveLength(0);
  });

  it("tras una re-captura BUENA no hay segunda: las dimensiones ya cuadran", async () => {
    const e = espia(pngDe(1170, 1696), DECLARADO_320);
    await refrescarMiniatura("save-3", document, e.deps);
    await refrescarMiniatura("save-3", document, e.deps);
    await refrescarMiniatura("save-3", document, e.deps);
    expect(e.escrituras).toHaveLength(1);
  });

  it("🔴 y si la escritura FRACASA tampoco se reintenta — el freno del registro", async () => {
    // ESTE es el caso que separa los dos frenos, y hace falta escribirlo aparte: en el test
    // de arriba la segunda llamada no escribe porque el PREDICADO ya está satisfecho, así
    // que con el registro borrado ese test sigue VERDE (medido: el mutante M4 sobrevivía a
    // él). Con la escritura fracasando —cuota llena, que es el motivo real por el que existe
    // el registro— la miniatura sigue siendo la mala y el predicado vuelve a decir que sí:
    // sin registro, cada carga del mismo slot re-captura otra vez, para nada.
    const intentos: string[] = [];
    const deps = {
      leer: () => pngDe(1170, 1696), // nunca cambia: la escritura no cuaja
      escribir: (id: string) => {
        intentos.push(id);
        return false;
      },
      capturar: () => pngDe(320, 200),
      medir: () => DECLARADO_320,
      esperarFrame: () => Promise.resolve(),
      intentados: new Set<string>(),
    };
    await refrescarMiniatura("save-lleno", document, deps);
    await refrescarMiniatura("save-lleno", document, deps);
    await refrescarMiniatura("save-lleno", document, deps);
    expect(intentos, "se reintenta en cada carga del mismo slot").toEqual(["save-lleno"]);
  });

  it("CONTROL: el registro es POR ID, no un cerrojo global", async () => {
    const intentados = new Set<string>();
    const mk = (): Parameters<typeof refrescarMiniatura>[2] => ({
      leer: () => null,
      escribir: () => true,
      capturar: () => pngDe(320, 200),
      medir: () => DECLARADO_320,
      esperarFrame: () => Promise.resolve(),
      intentados,
    });
    expect(await refrescarMiniatura("a", document, mk())).toBe(true);
    expect(await refrescarMiniatura("b", document, mk())).toBe(true);
    expect(await refrescarMiniatura("a", document, mk())).toBe(false);
  });

  it("un fallo de escritura NO se propaga (la carga de la partida no depende del adorno)", async () => {
    const deps = {
      leer: () => null,
      escribir: () => {
        throw new Error("cuota");
      },
      capturar: () => pngDe(320, 200),
      medir: () => DECLARADO_320,
      esperarFrame: () => Promise.resolve(),
      intentados: new Set<string>(),
    };
    await expect(refrescarMiniatura("save-4", document, deps)).resolves.toBe(false);
  });
});

/**
 * ── EL PREDICADO DE LA TARJETA (lote 2 de #174) ─────────────────────────────────────────
 *
 * `esCapturaCanonica` decide si /byo OFRECE «Rehacer captura». Es OTRO predicado que
 * `debeRecapturar`, a propósito y no por descuido: aquél mira si la piel DECLARA su búfer
 * (porque re-capturar SOLO se hace sin preguntar y desde una piel sin declaración pisaría
 * una miniatura buena con el teléfono entero), y éste mira la PROPORCIÓN de lo guardado
 * (porque lo que dispara la regeneración es un CLIC y la captura se produce en un iframe
 * que /byo monta a 960×600, donde la fiel siempre declara).
 *
 * ★★ Los dos tests de abajo son EL PAR que impide colapsarlos: sobre el MISMO dato —una
 * captura 320×200 con una piel que no declara— uno dice `false` y el otro `true`, y las dos
 * respuestas son correctas porque las preguntas son distintas. Quien un día «unifique» los
 * predicados rompe exactamente uno de estos dos.
 */
describe("esCapturaCanonica — el predicado que decide si la tarjeta OFRECE rehacer", () => {
  it("la captura del TELÉFONO ENTERO no es canónica (el caso del usuario, 11-08)", () => {
    // 1170×1696 es lo que guardaba el productor antes de #153 desde un móvil partido, y es
    // literalmente lo que el usuario tiene en sus autosaves del 09-08.
    expect(esCapturaCanonica(pngDe(1170, 1696))).toBe(false);
    expect(esCapturaCanonica(pngDe(1700, 1020))).toBe(false); // móvil apaisado
  });

  it("la captura NATIVA sí lo es — y este control es el que impide ofrecer el botón SIEMPRE", () => {
    expect(esCapturaCanonica(pngDe(320, 200))).toBe(true);
  });

  it("la proporción, no el tamaño: un nativo de 640×400 sigue siendo canónico", () => {
    // No se cablea 320×200 aquí: la geometría de la pantalla vive en `skin/fiel/frame.ts`.
    expect(esCapturaCanonica(pngDe(640, 400))).toBe(true);
  });

  it("sin foto, y un jpeg VIEJO o ilegible, cuentan como no canónicos", () => {
    expect(esCapturaCanonica(null)).toBe(false);
    expect(esCapturaCanonica("data:image/jpeg;base64,/9j/4AAQ")).toBe(false);
    expect(esCapturaCanonica("data:image/png;base64,corto")).toBe(false);
  });

  it("🔴 NO colapsa con debeRecapturar: mismo dato, respuestas OPUESTAS y las dos correctas", () => {
    const sinDeclarar = { width: 320, height: 200, declarado: false };
    // La automática NO toca (la piel no declara: no puede acreditar que la nueva sea mejor)…
    expect(debeRecapturar(pngDe(320, 200), sinDeclarar)).toBe(false);
    // …y la tarjeta TAMPOCO ofrece, porque lo guardado ya es canónico. Coinciden aquí.
    expect(esCapturaCanonica(pngDe(320, 200))).toBe(true);
    // Donde DIVERGEN es con el teléfono guardado y una piel que no declara: la automática se
    // abstiene (haría daño), la tarjeta ofrece (el clic monta su propio iframe que sí declara).
    expect(debeRecapturar(pngDe(1170, 1696), sinDeclarar)).toBe(false);
    expect(esCapturaCanonica(pngDe(1170, 1696))).toBe(false);
  });
});
