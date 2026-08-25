/**
 * GUARDA DE CLASE — ficha #253 (clase de viewgem #247): toda vista MODAL del viewport
 * que la fiel pinte desde descriptor propio tiene que DECLINAR la capa de mundo del
 * shader (`paintWorldInto`), o el motionScroll la TAPA (la piel shader es la DE FÁBRICA:
 * compone terreno encima de la vista ya pintada — reporte View Gem del 13-08).
 *
 * El defecto de clase: el fix de #247 enumeraba las ramas A MANO dentro de
 * `paintWorldInto` (`snap.zodiacView || snap.gemView || snap.dungeon`) — una copia del
 * despacho de `paintFaithful` que nadie sincronizaba. Una QUINTA rama modal futura
 * nacía tapada sin que ningún test la nombrase.
 *
 * El remedio (dos mitades, y esta guarda vigila los tres eslabones):
 *   · FUENTE ÚNICA: `VIEWPORT_MODAL_KEYS` (skin/fiel/skin.ts), consumida en RUNTIME
 *     por `paintWorldInto` vía `viewportModalActive` — registrar = declinar.
 *   · §1 CENSO AST default-DENY: se extraen del FUENTE las ramas reales del despacho
 *     modal de `paintFaithful` (el if/else-if cuyo else final llama a
 *     `paintViewportTiles`) y se exige IGUALDAD de conjuntos con la lista, en ambas
 *     direcciones: rama nueva sin registrar → rojo NOMBRÁNDOLA; clave rancia sin
 *     rama → rojo nombrándola también.
 *   · §2 CONSUMO: `paintWorldInto` sigue llamando a `viewportModalActive` (por AST).
 *     Sin este eslabón, re-inlinear la enumeración dejaría §1 verde y la clase abierta.
 *   · §3 RUNTIME: cada clave registrada declina DE VERDAD (prototype-call con `this`
 *     mínimo, el patrón de bed-sleep-blackout §3), con control positivo delante.
 *
 * Por qué AST y no regex: mismo motivo que la guarda #251 (css-literales) — un regex
 * sobre el fuente nace vacuo con la primera forma que el autor no anticipó; el árbol
 * sintáctico ve la FORMA real del despacho. Y el extractor lleva su propio cierre:
 * una rama del despacho cuya condición no nombre ningún `snap.*` también enrojece
 * (el punto ciego del extractor no puede callar una rama).
 *
 * Lógica PURA (lee el fuente del repo, sin DOM). Medición base: 2026-08-19, main
 * 722310d7 — 4 ramas / 3 claves (zodiacView, gemView ×2 ramas, dungeon).
 */
import ts from "typescript";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { describe, it, expect } from "vitest";
import {
  FaithfulSkin,
  VIEWPORT_MODAL_KEYS,
  viewportModalActive,
} from "../src/skin/fiel/skin.js";
import { TILE_OFFMAP, VIEW_WINDOW, type ViewSnapshot } from "../src/skin/api.js";

const here = dirname(fileURLToPath(import.meta.url));
const FICHERO_SKIN = join(here, "..", "src", "skin", "fiel", "skin.ts");

// ─────────────────────────────────────────────────────────────────────────────────────
// Extractor AST: las ramas del despacho MODAL del viewport en `paintFaithful`.
// Ancla estructural (no de línea): el if/else-if TOP de cadena — no es él mismo el
// else de otro if — cuyo ELSE terminal es un bloque que llama a `paintViewportTiles`.
// ─────────────────────────────────────────────────────────────────────────────────────

type Rama = { texto: string; camposSnap: string[] };

/** ¿Contiene el nodo una llamada a `paintViewportTiles`? */
function llamaAPaintViewportTiles(n: ts.Node): boolean {
  let hallado = false;
  const visita = (x: ts.Node): void => {
    if (
      ts.isCallExpression(x) &&
      ts.isIdentifier(x.expression) &&
      x.expression.text === "paintViewportTiles"
    ) {
      hallado = true;
    }
    if (!hallado) ts.forEachChild(x, visita);
  };
  visita(n);
  return hallado;
}

/** Campos `snap.<x>` mencionados en una expresión (dedupe en orden de aparición). */
function camposSnapDe(expr: ts.Expression): string[] {
  const campos: string[] = [];
  const visita = (x: ts.Node): void => {
    if (
      ts.isPropertyAccessExpression(x) &&
      ts.isIdentifier(x.expression) &&
      x.expression.text === "snap" &&
      !campos.includes(x.name.text)
    ) {
      campos.push(x.name.text);
    }
    ts.forEachChild(x, visita);
  };
  visita(expr);
  return campos;
}

/**
 * Devuelve las cadenas modales halladas en `paintFaithful` (debe salir UNA):
 * cada una como lista de ramas con sus campos `snap.*`.
 */
function censaDespachoModal(src: string): Rama[][] {
  const sf = ts.createSourceFile("skin.ts", src, ts.ScriptTarget.Latest, true);
  const cadenas: Rama[][] = [];
  let fn: ts.FunctionDeclaration | undefined;
  const buscaFn = (n: ts.Node): void => {
    if (ts.isFunctionDeclaration(n) && n.name?.text === "paintFaithful") fn = n;
    else ts.forEachChild(n, buscaFn);
  };
  buscaFn(sf);
  if (!fn?.body) return cadenas; // el aserto de unicidad de abajo lo nombrará

  const visita = (n: ts.Node): void => {
    if (ts.isIfStatement(n)) {
      // Sólo la CABEZA de cadena: un if que es else-de-otro se censa con su cabeza.
      const padre = n.parent;
      const esCabeza = !(ts.isIfStatement(padre) && padre.elseStatement === n);
      if (esCabeza) {
        // Recorre la cadena else-if hasta el else terminal.
        const ramas: Rama[] = [];
        let actual: ts.Statement | undefined = n;
        let terminal: ts.Statement | undefined;
        while (actual && ts.isIfStatement(actual)) {
          ramas.push({
            texto: actual.expression.getText(sf),
            camposSnap: camposSnapDe(actual.expression),
          });
          terminal = actual.elseStatement;
          actual = actual.elseStatement;
        }
        if (terminal && llamaAPaintViewportTiles(terminal)) cadenas.push(ramas);
      }
    }
    ts.forEachChild(n, visita);
  };
  visita(fn.body);
  return cadenas;
}

/** Cuerpo AST del método `paintWorldInto` de la clase (para el eslabón de consumo). */
function cuerpoPaintWorldInto(src: string): ts.Node | undefined {
  const sf = ts.createSourceFile("skin.ts", src, ts.ScriptTarget.Latest, true);
  let cuerpo: ts.Node | undefined;
  const visita = (n: ts.Node): void => {
    if (
      ts.isMethodDeclaration(n) &&
      ts.isIdentifier(n.name) &&
      n.name.text === "paintWorldInto" &&
      n.body
    ) {
      cuerpo = n.body;
    } else {
      ts.forEachChild(n, visita);
    }
  };
  visita(sf);
  return cuerpo;
}

// ─────────────────────────────────────────────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────────────────────────────────────────────
const src = readFileSync(FICHERO_SKIN, "utf8");

describe("ficha #253 §1 — CENSO AST: las ramas modales de paintFaithful == VIEWPORT_MODAL_KEYS", () => {
  const cadenas = censaDespachoModal(src);

  it("CONTROL POSITIVO: el ancla estructural encuentra EXACTAMENTE una cadena modal, con ramas", () => {
    // Si esto enrojece, el despacho del viewport cambió de FORMA (o paintFaithful /
    // paintViewportTiles se renombraron): re-anclar el extractor ANTES de tocar la lista.
    expect(cadenas, "cadenas if/else-if cuyo else terminal pinta terreno").toHaveLength(1);
    expect(cadenas[0]!.length, "ramas de la cadena modal").toBeGreaterThan(0);
    // Centinela conocido: el zodíaco está en la cadena desde #247/#297 — si el extractor
    // dejara de ver condiciones reales, esto lo delata aunque la igualdad de abajo
    // comparase vacío contra vacío.
    expect(cadenas[0]!.flatMap((r) => r.camposSnap)).toContain("zodiacView");
  });

  it("cada rama del despacho modal nombra al menos un campo snap.* (punto ciego del extractor)", () => {
    for (const rama of cadenas[0] ?? []) {
      expect(
        rama.camposSnap.length,
        `la rama «${rama.texto}» no nombra ningún campo snap.* — el censo no puede ` +
          "adjudicarla; refactoriza la condición o amplía el extractor en este test",
      ).toBeGreaterThan(0);
    }
  });

  it("default-DENY en ambas direcciones: ramas ⊆ lista y lista ⊆ ramas", () => {
    const enRamas = [...new Set((cadenas[0] ?? []).flatMap((r) => r.camposSnap))].sort();
    const enLista = [...VIEWPORT_MODAL_KEYS].sort();
    expect(
      enRamas,
      "Rama modal del viewport SIN registrar en VIEWPORT_MODAL_KEYS (la shader la taparía " +
        "con motionScroll: regístrala y paintWorldInto declina solo) — o clave RANCIA en la " +
        "lista sin rama en paintFaithful (retírala con su porqué)",
    ).toEqual(enLista);
  });
});

describe("ficha #253 §2 — CONSUMO: paintWorldInto deriva su declinación de la lista", () => {
  it("el cuerpo de paintWorldInto llama a viewportModalActive (por AST)", () => {
    const cuerpo = cuerpoPaintWorldInto(src);
    expect(cuerpo, "método paintWorldInto con cuerpo en FaithfulSkin").toBeDefined();
    let consume = false;
    const visita = (n: ts.Node): void => {
      if (
        ts.isCallExpression(n) &&
        ts.isIdentifier(n.expression) &&
        n.expression.text === "viewportModalActive"
      ) {
        consume = true;
      }
      ts.forEachChild(n, visita);
    };
    visita(cuerpo!);
    expect(
      consume,
      "paintWorldInto ya no consume viewportModalActive: re-inlinear la enumeración " +
        "reabre la clase #253 (la lista dejaría de declinar en runtime)",
    ).toBe(true);
  });
});

describe("ficha #253 §3 — RUNTIME: cada clave registrada DECLINA la capa de mundo", () => {
  // `this` mínimo (patrón de bed-sleep-blackout §3): `atlas` truthy pasa la primera
  // guarda, y la ventana entera a TILE_OFFMAP hace que paintViewportTiles no toque el
  // ctx — el control positivo corre DE VERDAD sin canvas.
  const conAtlas = {
    atlas: {} as CanvasImageSource,
    phase: 0,
    anim: [],
    moongateStage: 0,
    personTurnCount: 0,
  };
  const ctx = {} as CanvasRenderingContext2D;
  const snapCon = (extra: Record<string, unknown>): ViewSnapshot =>
    ({
      terrainWindow: new Int16Array(VIEW_WINDOW * VIEW_WINDOW).fill(TILE_OFFMAP),
      zodiacView: null,
      gemView: null,
      dungeon: null,
      bedBlackout: false,
      ...extra,
    }) as unknown as ViewSnapshot;

  const llama = (extra: Record<string, unknown>): boolean =>
    (
      FaithfulSkin.prototype.paintWorldInto as (
        this: unknown,
        c: CanvasRenderingContext2D,
        s: ViewSnapshot,
      ) => boolean
    ).call(conAtlas, ctx, snapCon(extra));

  it("CONTROL POSITIVO: sin modal vivo SÍ sirve la capa de terreno", () => {
    expect(llama({})).toBe(true);
    expect(viewportModalActive(snapCon({}))).toBe(false);
  });

  for (const clave of VIEWPORT_MODAL_KEYS) {
    it(`con «${clave}» vivo DECLINA — el shader cae al recorte pleno que lleva la vista`, () => {
      expect(viewportModalActive(snapCon({ [clave]: {} }))).toBe(true);
      expect(llama({ [clave]: {} })).toBe(false);
    });
  }
});
