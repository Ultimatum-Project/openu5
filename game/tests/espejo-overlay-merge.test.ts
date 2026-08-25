/**
 * #43 ruling 1 — REGENERAR NO PUEDE BORRAR LA CURACIÓN MANUAL, y la fusión es ENTRADA A ENTRADA.
 *
 * Medido en la fase 1 de #43 (main `cc4a3b8a`): regenerar los overlays con los generadores de
 * entonces destruía, a nivel de RUTA, los DOS ÚNICOS `anchor.expectDelta` del proyecto
 * (part04-g03 +36 · part05-g05 −954), los 3 `recruit` de LP1 y los 3 `dismiss` de AD.
 *
 * ★★ El caso canónico —y la razón de que este fichero exista en vez de un `{...a,...b}`— es
 * `ad13-g21`: lleva el `recruit` (que el generador SÍ re-emite desde su tabla RECRUITS) y el
 * `dismiss` (que no) en el **MISMO array `insertOps`**. Fusionar por CLAVE reemplaza el array
 * entero y deja los `dismiss` en **2 de 3**, que es un arreglo que parece bueno: mata dos
 * tercios del defecto y el que queda se va sin ruido.
 *
 * Failing-first: los tres bloques de abajo se comprobaron ROJOS contra la fusión por clave
 * (`{ ...prev, ...gen }`) antes de escribir `mergeInsertOps`.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  mergeInsertOps,
  mergePatch,
  applyPatchKeys,
  PATCHABLE,
  type InsertBlock,
} from "../e2e/espejo-tour/tools/overlay-merge.mjs";
import { describeCorpusReal, ROUTES_SINT_DIR, PARTES_SINT } from "./espejo-corpus";

const TOUR = join(dirname(fileURLToPath(import.meta.url)), "..", "e2e", "espejo-tour");
type OverlayLeido = { segments: Record<string, { insertOps?: InsertBlock[]; [k: string]: unknown }> };
const readOverlayEn = (dirAbs: string, part: string) =>
  JSON.parse(readFileSync(join(dirAbs, "overlays", `${part}.json`), "utf8")) as OverlayLeido;
const readOverlay = (dir: string, part: string) => readOverlayEn(join(TOUR, dir), part);

/** La fusión INGENUA contra la que se calibró el rojo. No se usa en producción: es el control. */
const byKey = (prev: object, gen: object) => ({ ...prev, ...gen });

/**
 * ★★ LA FORMA DEL DEFECTO, INSTANCIADA — `sint05-g02` es `ad13-g21` con otros nombres.
 *
 * El caso canónico no es una anécdota de `ad13`: es una FORMA —dos anclas distintas en el mismo
 * array `insertOps`, una que el generador re-emite y otra que sólo existe curada a mano— y una
 * forma se puede escribir en cualquier corpus. `routes-sint/` la lleva a propósito
 * (`routes-sint/README.md`, fila «DOS anclas `insertOps` distintas en el MISMO segmento»):
 * ancla 20 con `{recruit:"Quilla"}` y ancla 12 con `{dismiss:"Torbin"}`.
 *
 * Lo que NO se mueve aquí es el censo del corpus real: que `ad13-g21` SIGA teniendo el caso es un
 * hecho del artefacto de EA y vive abajo, acotado. Los dos son necesarios y dicen cosas distintas
 * — éste prueba la FUNCIÓN, aquél vigila el CORPUS.
 *
 * 🔴 Lectura DENTRO de cada `it`, nunca en el cuerpo del `describe`: es la regla que este fichero
 * violaba (el `const ad13` de arriba se evaluaba al recolectar, y en un árbol sin corpus mataba
 * los tres bloques antes de que nadie decidiera saltarlos).
 */
describe("#43 ruling 1 — sint05-g02: el recruit y el dismiss comparten array insertOps", () => {
  const sint05 = () => readOverlayEn(ROUTES_SINT_DIR, "sint05").segments["sint05-g02"]!;
  const genLikeRecruitOnly = { insertOps: [{ afterOcrLn: 20, ops: [{ recruit: "Quilla" }] }] };

  it("★ guarda de POBLACIÓN: el corpus sintético tiene el caso (DOS anclas en un segmento)", () => {
    // Sin esto, los dos asertos de abajo pasarían en vacío el día que alguien re-ancle el
    // `dismiss` a otro segmento: la fusión conservaría «los dos» de un array de uno.
    const seg = sint05();
    expect(seg.insertOps, "sint05-g02 perdió sus insertOps").toBeDefined();
    expect(seg.insertOps!.length, "hacen falta DOS bloques para que la forma exista").toBe(2);
    expect(seg.insertOps!.map((b) => b.afterOcrLn)).toEqual([20, 12]);
    const ops = seg.insertOps!.flatMap((b) => b.ops);
    expect(ops).toContainEqual({ recruit: "Quilla" });
    expect(ops).toContainEqual({ dismiss: "Torbin" });
  });

  it("★★ la fusión por CLAVE pierde el dismiss (el control que calibra el rojo)", () => {
    const naive = byKey(sint05(), genLikeRecruitOnly) as { insertOps: InsertBlock[] };
    const ops = naive.insertOps.flatMap((b) => b.ops);
    expect(ops).toContainEqual({ recruit: "Quilla" });
    expect(ops).not.toContainEqual({ dismiss: "Torbin" }); // ← el defecto, fijado a propósito
  });

  it("la fusión ENTRADA A ENTRADA conserva los dos, y sin duplicar el recruit", () => {
    const seg = sint05();
    const merged = mergePatch(seg, genLikeRecruitOnly);
    const ops = merged.insertOps!.flatMap((b) => b.ops);
    expect(ops).toContainEqual({ recruit: "Quilla" });
    expect(ops).toContainEqual({ dismiss: "Torbin" });
    expect(ops.filter((o) => "recruit" in o)).toHaveLength(1);
    // idempotencia: el overlay ya curado sale IDÉNTICO, que es lo que da punto fijo
    expect(merged.insertOps).toEqual(seg.insertOps);
  });
});

describeCorpusReal("#43 ruling 1 — ad13-g21: el caso canónico sigue en el corpus REAL", () => {
  it("★ el corpus sigue teniendo el caso: DOS anclas distintas en el mismo segmento", () => {
    // Datos REALES del overlay commiteado, no un fixture inventado: si el corpus cambia de forma
    // —si alguien re-ancla el `dismiss` a otro segmento— este test tiene que enterarse. Lo que
    // vigila es el ARTEFACTO; la función que la forma motivó se prueba arriba, sobre el sintético.
    const ad13 = readOverlay("routes-ad", "ad13").segments["ad13-g21"]!;
    expect(ad13.insertOps).toBeDefined();
    const anchors = ad13.insertOps!.map((b) => b.afterOcrLn);
    expect(anchors).toEqual([2690, 2680]);
    const ops = ad13.insertOps!.flatMap((b) => b.ops);
    expect(ops).toContainEqual({ recruit: "Geoffrey" });
    expect(ops).toContainEqual({ dismiss: "Jaana" });
  });
});

describe("#43 ruling 1 — mergeInsertOps", () => {
  it("agrupa por afterOcrLn y conserva el orden de anclas del overlay viejo", () => {
    const prev: InsertBlock[] = [
      { afterOcrLn: 2690, ops: [{ recruit: "Geoffrey" }] },
      { afterOcrLn: 2680, ops: [{ dismiss: "Jaana" }] },
    ];
    const next: InsertBlock[] = [{ afterOcrLn: 2690, ops: [{ recruit: "Geoffrey" }] }];
    expect(mergeInsertOps(prev, next)).toEqual(prev);
  });

  it("un bloque del generador que el overlay NO cubre se añade detrás", () => {
    const prev: InsertBlock[] = [{ afterOcrLn: 10, ops: [{ dismiss: "Iolo" }] }];
    const next: InsertBlock[] = [{ afterOcrLn: 10, ops: [{ recruit: "Johne" }] }];
    expect(mergeInsertOps(prev, next)).toEqual([
      { afterOcrLn: 10, ops: [{ dismiss: "Iolo" }] },
      { afterOcrLn: 10, ops: [{ recruit: "Johne" }] },
    ]);
  });

  it("la identidad de bloque es ESTABLE al orden de claves (no duplica por reordenar el JSON)", () => {
    const prev: InsertBlock[] = [{ afterOcrLn: 1, ops: [{ a: 1, b: { x: 1, y: 2 } }] }];
    const next: InsertBlock[] = [{ afterOcrLn: 1, ops: [{ b: { y: 2, x: 1 }, a: 1 }] }];
    expect(mergeInsertOps(prev, next)).toHaveLength(1);
  });

  /**
   * ★★ EL SAPO QUE ME COMÍ, y por qué el instrumento que lo tapó era el problema.
   *
   * La primera versión deduplicaba por OP dentro del ancla. Parece más fino y destruye el guion:
   * una secuencia de teclado repite ops a propósito (`Enter`,`y`,`Enter`,`y`,…). Medido con
   * aquella versión puesta: `part06-g05` 32 ops → 6, `part04-g03` 13 → 9.
   *
   * No lo cazó mi verificación de entonces —«¿se pierde alguna CLAVE?»— porque la clave
   * `insertOps` seguía presente: el censo por CLAVES no discrimina la pérdida por OPS. De ahí
   * que este test cuente ops del corpus REAL.
   */
  it("★★ NO deduplica ops repetidas dentro de un bloque (una secuencia de teclas las repite)", () => {
    const prev: InsertBlock[] = [
      { afterOcrLn: 1, ops: [{ key: "Enter" }, { key: "y" }, { key: "Enter" }, { key: "y" }] },
    ];
    expect(mergeInsertOps(prev, [])[0]!.ops).toHaveLength(4);
    expect(mergeInsertOps(prev, prev)[0]!.ops).toHaveLength(4); // e idempotente
  });

  it("★ conserva los campos del bloque que no son `ops` (p. ej. `at:\"first\"`)", () => {
    // Reconstruir el bloque como {afterOcrLn, ops} tira `at`, y en la primera regeneración el
    // bloque del ledger de part04-g03 se volvía al final del segmento. Mismo error que la ventana
    // persigue —reconstruir en vez de preservar—, una capa más adentro.
    const prev = [{ afterOcrLn: 1070, at: "first", ops: [{ seedInt: 25 }] }] as InsertBlock[];
    expect(mergeInsertOps(prev, [])[0]!).toMatchObject({ at: "first" });
    expect(mergeInsertOps(prev, prev)[0]!).toMatchObject({ at: "first" });
  });

  /**
   * ★ IDEMPOTENCIA SOBRE UN CORPUS, no sobre un literal: fusionar un overlay consigo mismo no
   * puede perder ops. Es el barrido que cazaría una regresión de la dedup (el sapo de arriba).
   *
   * 🔴 CON CONTADOR DE POBLACIÓN, que es lo que a este bloque le faltaba: tal y como estaba
   * escrito —un `continue` para los patches sin `insertOps` y ningún censo— pasaba en VACÍO sobre
   * cualquier corpus que no tuviera ni un `insertOps`. El verde no distinguía «ninguna pérdida»
   * de «nada que perder».
   */
  it("★ corpus SINTÉTICO: ningún overlay pierde OPS al fusionarse consigo mismo", () => {
    let segmentos = 0;
    let ops = 0;
    for (const part of PARTES_SINT) {
      const ov = readOverlayEn(ROUTES_SINT_DIR, part);
      for (const [sid, patch] of Object.entries(ov.segments)) {
        if (!patch.insertOps) continue;
        const before = patch.insertOps.reduce((a, b) => a + b.ops.length, 0);
        const after = mergeInsertOps(patch.insertOps, patch.insertOps).reduce((a, b) => a + b.ops.length, 0);
        expect(after, `${part}/${sid}: ops`).toBe(before);
        segmentos++;
        ops += before;
      }
    }
    expect(segmentos, "segmentos sintéticos con insertOps: si fuera 0, el barrido no barrió nada").toBeGreaterThan(0);
    expect(ops, "ops sometidas a la fusión: idem").toBeGreaterThan(0);
  });
});

/**
 * El MISMO barrido sobre los 49 overlays REALES. Se queda porque ahí sí vigila un corpus AJENO:
 * el sintético lo escribimos nosotros y sus formas son las que le pusimos, mientras que las de
 * `routes/`/`routes-ad/` las puso el LP y pueden traer una que la fusión no sepa tratar.
 */
describeCorpusReal("#43 ruling 1 — mergeInsertOps sobre los 49 overlays REALES", () => {
  it("★ corpus: ningún overlay pierde OPS al fusionarse consigo mismo", () => {
    let segmentos = 0;
    for (const [dir, n, pre] of [
      ["routes", 24, "part"],
      ["routes-ad", 25, "ad"],
    ] as const) {
      for (let i = 1; i <= n; i++) {
        const ov = readOverlay(dir, `${pre}${String(i).padStart(2, "0")}`);
        for (const [sid, patch] of Object.entries(ov.segments)) {
          if (!patch.insertOps) continue;
          const before = patch.insertOps.reduce((a, b) => a + b.ops.length, 0);
          const after = mergeInsertOps(patch.insertOps, patch.insertOps).reduce((a, b) => a + b.ops.length, 0);
          expect(after, `${sid}: ops`).toBe(before);
          segmentos++;
        }
      }
    }
    expect(segmentos, "segmentos con insertOps en los 49 overlays").toBeGreaterThan(0);
  });
});

describe("#43 ruling 1 — mergePatch preserva lo que el generador no emite", () => {
  it("conserva calib/ctx/enter/expectClass y deja mandar al generador en lo suyo", () => {
    const prev = { ctx: "smallmap", calib: true, expectClass: { "12": "pending" }, skip: "pendiente-runner", note: "vieja" };
    const gen = { skip: false as const, note: "nueva", anchor: "abc" };
    expect(mergePatch(prev, gen)).toEqual({
      ctx: "smallmap",
      calib: true,
      expectClass: { "12": "pending" },
      skip: false, // TOMBSTONE conservado: tiene que llegar a curate, no podarse aquí
      note: "nueva",
      anchor: "abc",
    });
  });

  it("★ el TOMBSTONE sobrevive a la fusión — si se podara, la baja no se propagaría nunca", () => {
    expect(mergePatch({ skip: "pendiente-runner" }, { skip: false }).skip).toBe(false);
  });
});

/**
 * #43 ruling 2 — LA BAJA SE PROPAGA POR POLARIDAD EXPLÍCITA, NO POR AUSENCIA.
 *
 * La fase 1 midió que `curate` sólo sabía ASIGNAR: un overlay que dejaba de traer `skip` no lo
 * quitaba de la ruta, así que las bajas del fix de #32 no llegaban POR CONSTRUCCIÓN (A/B/C:
 * curate con overlays viejos y con overlays regenerados daba el MISMO censo, 97/289).
 *
 * ★ Y la baja NO puede inferirse de la ausencia: eso mataría, en el siguiente `curate`,
 * cualquier curación hecha a mano en la ruta que el overlay no conociera — el mismo veneno que
 * esta ventana vino a quitar, una capa más arriba. Por eso hay aquí un test de cada polaridad
 * MÁS uno de la ausencia; sin el tercero, «borra siempre que no esté» pasaría los otros dos.
 */
describe("#43 ruling 2 — applyPatchKeys aplica las dos polaridades", () => {
  it("valor normal: asigna", () => {
    expect(applyPatchKeys({ id: "g1" } as Record<string, unknown>, { skip: "pendiente-runner" }).skip).toBe(
      "pendiente-runner",
    );
  });

  it("★ tombstone `false`: QUITA la clave (no la deja en false)", () => {
    const seg = applyPatchKeys({ id: "g1", skip: "pendiente-runner" } as Record<string, unknown>, { skip: false });
    expect("skip" in seg).toBe(false);
  });

  it("★★ clave AUSENTE: «no opino» — la curación manual de la ruta SOBREVIVE", () => {
    // El control que separa este diseño de «ausente = bórralo». Sin él, la implementación
    // venenosa pasaría los dos tests de arriba.
    const seg = applyPatchKeys({ id: "g1", skip: "pendiente-runner", calib: true } as Record<string, unknown>, {
      note: "sólo cambio la nota",
    });
    expect(seg.skip).toBe("pendiente-runner");
    expect(seg.calib).toBe(true);
  });

  it("`seam: null` es un VALOR legítimo, no un tombstone", () => {
    const seg = applyPatchKeys({ id: "g1", seam: "enter" } as Record<string, unknown>, { seam: null });
    expect("seam" in seg).toBe(true);
    expect(seg.seam).toBeNull();
  });

});

/**
 * ★ LA AUDITORÍA DEL CENTINELA — y por qué NO tiene gemelo sintético.
 *
 * Lo que este bloque pregunta es si el corpus que NO controlamos usa `false` como valor real en
 * alguna clave PATCHABLE, porque el día que lo haga el contrato del tombstone deja de ser seguro.
 * Sobre `routes-sint/` la respuesta la escribiríamos nosotros en el mismo commit que el sujeto:
 * sería una tautología con forma de auditoría. Se acota, no se muda.
 */
describeCorpusReal("#43 ruling 2 — el centinela `false` en los 49 overlays REALES", () => {
  it("★ el centinela `false` está LIBRE en el corpus (censado, no supuesto)", () => {
    // Si algún día una de estas claves usa `false` como valor real, este contrato deja de ser
    // seguro y hay que cambiar de centinela. El test lo detecta en vez de que lo descubra un run.
    for (const dir of ["routes", "routes-ad"]) {
      const parts = dir === "routes" ? 24 : 25;
      const pre = dir === "routes" ? "part" : "ad";
      for (let i = 1; i <= parts; i++) {
        const ov = readOverlay(dir, `${pre}${String(i).padStart(2, "0")}`);
        for (const patch of Object.values(ov.segments)) {
          for (const k of PATCHABLE) {
            if (k === "skip") continue; // `skip:false` ES el tombstone que este ruling introduce
            expect(patch[k], `${dir}/${pre}${i} · ${k}`).not.toBe(false);
          }
        }
      }
    }
  });
});
