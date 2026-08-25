/**
 * #43 ruling 3 — DÓNDE ATERRIZA UN BLOQUE `insertOps`, y por qué la premisa del ruling se
 * invirtió al medirla.
 *
 * El ruling decía: «el canon es la colocación COMMITEADA; part04-g03 en el índice 10 es la
 * conducta correcta; el ancla de curate (barrido hacia atrás con `ocrLn` no monótono) se arregla
 * anclando por posición LOCAL». Medido bloque a bloque sobre los 14 `insertOps` de LP1:
 *
 *   · la regla ACTUAL reproduce la colocación commiteada en **13 de 14**;
 *   · la regla «local» propuesta reproduce **5 de 14** — movería 8 bloques que hoy están bien;
 *   · el ÚNICO que la regla actual no reproduce es justo el que el ruling cita como canon,
 *     `part04-g03` ancla 1070.
 *
 * Y ese uno es un **EDITADO A MANO declarado en el propio artefacto**: la nota que lo acompaña,
 * escrita en `15ddf3a1`, dice literalmente «el 'y' suelto de ocrLn 1076 lo consume el arnés
 * (**quitar si se regenera con curate**)». O sea el autor sabía que la ruta llevaba una
 * colocación que el pipeline no reproduce, y lo dejó avisado.
 *
 * Corrección a mi propia acta de la fase 1 (§7.2): dije que el `script` de un segmento «no es
 * monótono en `ocrLn`». **Es falso.** Las ops BASE sí son monótonas; lo que rompe el barrido es
 * `out[i].ocrLn ?? 0`, que trata una op SIN `ocrLn` (un `nav`, un `wait`) como si fuera la línea
 * 0 y detiene el barrido hacia atrás en cuanto encuentra una — y esas están cerca del final.
 *
 * Así que la conducta global NO se toca (movería 8 bloques correctos) y lo que se hace es dar al
 * overlay una forma de DECLARAR la intención: `at: "first"`. Con eso el editado a mano deja de
 * ser una edición manual irreproducible y pasa a ser dato del pipeline — la misma lección que
 * los des-skips de #23, que vivían sólo en las rutas y cualquier `curate` revertía.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { insertAt } from "../e2e/espejo-tour/tools/overlay-merge.mjs";
import { describeCorpusReal, ROUTES_SINT_DIR, PARTES_SINT } from "./espejo-corpus";

const TOUR = join(dirname(fileURLToPath(import.meta.url)), "..", "e2e", "espejo-tour");
type Op = { ocrLn?: number; src?: string; [k: string]: unknown };
type Bloque = { afterOcrLn: number; at?: "first"; ops: Op[] };
const routeEn = (dir: string, p: string) =>
  JSON.parse(readFileSync(join(dir, `${p}.route.json`), "utf8")) as {
    segments: { id: string; script: Op[] }[];
  };
const overlayEn = (dir: string, p: string) =>
  JSON.parse(readFileSync(join(dir, "overlays", `${p}.json`), "utf8")) as {
    segments: Record<string, { insertOps?: Bloque[] }>;
  };
const route = (p: string) => routeEn(join(TOUR, "routes"), p);
const overlay = (p: string) => overlayEn(join(TOUR, "routes"), p);

/** Reproduce el bucle de inserción de curate.mjs sobre las ops BASE de un segmento. */
function place(base: Op[], blocks: { afterOcrLn: number; at?: "first"; ops: Op[] }[]) {
  const out = [...base];
  for (const blk of blocks) {
    const at = insertAt(out, blk.afterOcrLn, blk.at);
    out.splice(at, 0, ...blk.ops.map((o) => ({ ...o, src: "overlay", ocrLn: blk.afterOcrLn })));
  }
  return out;
}

/**
 * ═══ POR QUÉ ESTE BLOQUE NO TIENE GEMELO SINTÉTICO ═══════════════════════════════════════════
 *
 * Su sujeto es «la colocación COMMITEADA se reproduce», y lo que le da valor es que las rutas de
 * LP1 llevan decisiones HUMANAS que el pipeline no escribió: por eso el resultado interesante fue
 * 13 de 14 y no 14 de 14, y por eso el que falla es el editado a mano declarado en su nota.
 *
 * Sobre un corpus que colocamos nosotros con esta misma regla, «se reproduce» es una propiedad
 * que el corpus tiene POR CONSTRUCCIÓN. Copiar el bucle a `routes-sint/` daría cuatro verdes más
 * en el recuento y cero careo. [[el-aserto-que-calcula-su-esperado-desde-el-sujeto-es-tautologico]]
 *
 * Lo que SÍ se instancia en el sintético está abajo, y es otra cosa: que la regla del `?? 0`
 * ponga las ráfagas donde el ARTEFACTO las tiene, con los índices escritos EN CRUDO.
 */
describeCorpusReal("#43 ruling 3 — la colocación commiteada se reproduce", () => {
  for (const part of ["part02", "part04", "part05", "part06"]) {
    it(`${part}: cada bloque insertOps aterriza donde está en la ruta commiteada`, () => {
      const r = route(part);
      const ov = overlay(part);
      let checked = 0;
      for (const seg of r.segments) {
        const blocks = ov.segments[seg.id]?.insertOps;
        if (!blocks) continue;
        // Mismo filtro que curate: toda la familia `overlay*` se retira y se repone desde el
        // overlay. `part05-g05` llevaba 7 ops con `src: "overlay-timing"` —etiqueta que ninguna
        // herramienta del repo emite, interleadas a mano— que ahora viven dentro de su bloque
        // `insertOps`; si el filtro no las quitase de la base, saldrían duplicadas.
        const base = seg.script.filter((o) => !String(o.src ?? "").startsWith("overlay"));
        const got = place(base, blocks);
        // Se compara la SECUENCIA de ops, no los bytes del fichero — y sin `src`, que es
        // metadato de idempotencia sin un solo lector fuera de curate. La única diferencia que
        // esta normalización introduce está fijada aparte, abajo: las 7 ops de `part05-g05` pasan
        // de `overlay-timing` a `overlay`. Comparar CON `src` haría rojo un cambio que no mueve
        // ni una tecla; no compararlo en ningún sitio lo escondería.
        const shape = (o: Op) => JSON.stringify({ ...o, src: undefined });
        expect(got.map(shape), seg.id).toEqual(seg.script.map(shape));
        checked++;
      }
      // guarda de POBLACIÓN: si un overlay se queda sin insertOps, el test pasaría en vacío
      expect(checked, `${part}: segmentos con insertOps`).toBeGreaterThan(0);
    });
  }

  it("★ part05-g05: la única diferencia de re-curar es la etiqueta `src`, no el guion", () => {
    // Las 7 ops `{wait:350}` que la ruta commiteada trae con `src: "overlay-timing"` —una
    // etiqueta sin productor en todo el repo— viven ahora dentro del `insertOps` del overlay, así
    // que salen con `src: "overlay"`. Es normalización de metadato: `op.src` no lo lee nadie
    // fuera de curate. Fijar aquí el ANTES y el DESPUÉS es lo que impide que esto se lea como
    // «se perdieron 7 ops» o como «cambió el guion de la compra».
    const seg = route("part05").segments.find((s) => s.id === "part05-g05")!;
    // La etiqueta huérfana ya no existe en la ruta: las 7 ops salen del overlay como `overlay`.
    expect(seg.script.filter((o) => o.src === "overlay-timing")).toHaveLength(0);
    const ov = overlay("part05").segments["part05-g05"]!.insertOps!;
    expect(ov).toHaveLength(1);
    expect(ov[0]!.ops.filter((o) => o.wait === 350)).toHaveLength(7);
    // y la ráfaga TOTAL sigue siendo 18: no se perdió ni se duplicó ninguna
    expect(seg.script.filter((o) => String(o.src ?? "").startsWith("overlay"))).toHaveLength(18);
  });

  it("★ part04-g03 mete el seed/anchor ANTES de la tienda (índice 10), no al final", () => {
    const seg = route("part04").segments.find((s) => s.id === "part04-g03")!;
    const first = seg.script.findIndex((o) => String(o.src ?? "").startsWith("overlay"));
    expect(first).toBe(10);
    // y la op que abre el bloque es la que arma el ledger, no una tecla suelta
    expect(seg.script[first]).toMatchObject({ seedInt: 25 });
  });
});

/**
 * ★★ LA REGLA DE ANCLAJE SOBRE EL CORPUS SINTÉTICO — y el cerrojo que impide que sea un punto
 * fijo autocomplaciente.
 *
 * `routes-sint/` es punto fijo de `curate` por construcción, así que «`place()` reproduce el
 * fichero» tiene un agujero conocido: si alguien cambia `insertAt` **y regenera el corpus**, el
 * sujeto y su esperado se mueven JUNTOS y el aserto sigue verde. Ése es exactamente el modo de
 * fallo que hizo descartar un gemelo del bloque de arriba.
 *
 * El segundo `it` es el que lo cierra: los índices van escritos EN CRUDO en este fichero, leídos
 * del artefacto una vez y fijados a mano. Una regeneración que mueva las ráfagas rompe estos
 * números aunque el corpus y la herramienta sigan de acuerdo entre sí. Ésa es la diferencia entre
 * medir el punto fijo y medir la REGLA.
 *
 * Y la regla que miden no es cualquiera: los dos casos elegidos son los que sólo existen por el
 * `?? 0` histórico —una op SIN `ocrLn` (un `nav`) cortando el barrido hacia atrás— más el opt-in
 * explícito `at:"first"`. Si alguien «arregla» el `?? 0`, estos dos se ponen rojos.
 */
describe("★★ #43 ruling 3 — el anclaje sobre el corpus SINTÉTICO", () => {
  it("cada bloque insertOps aterriza donde la ruta sintética lo tiene", () => {
    let segmentos = 0;
    let ops = 0;
    let conFirst = 0;
    let conOpSinOcrLn = 0;
    for (const part of PARTES_SINT) {
      const r = routeEn(ROUTES_SINT_DIR, part);
      const ov = overlayEn(ROUTES_SINT_DIR, part);
      for (const seg of r.segments) {
        const blocks = ov.segments[seg.id]?.insertOps;
        if (!blocks) continue;
        const base = seg.script.filter((o) => !String(o.src ?? "").startsWith("overlay"));
        const shape = (o: Op) => JSON.stringify({ ...o, src: undefined });
        expect(place(base, blocks).map(shape), `${part}/${seg.id}`).toEqual(seg.script.map(shape));
        segmentos++;
        ops += blocks.reduce((a, b) => a + b.ops.length, 0);
        if (blocks.some((b) => b.at === "first")) conFirst++;
        if (base.some((o) => o.ocrLn == null)) conOpSinOcrLn++;
      }
    }
    // 🔴 CUATRO guardas de población: sin ellas este bucle pasa en vacío el día que el corpus
    // sintético pierda sus `insertOps`, y las dos últimas son las que garantizan que lo ejercido
    // es la regla INTERESANTE y no el caso trivial de insertar al final de una lista monótona.
    expect(segmentos, "segmentos sintéticos con insertOps").toBeGreaterThan(0);
    expect(ops, "ops de overlay colocadas").toBeGreaterThan(0);
    expect(conFirst, 'bloques con `at:"first"`: sin uno, la rama explícita no se ejerce').toBeGreaterThan(0);
    expect(
      conOpSinOcrLn,
      "segmentos con una op SIN ocrLn en la base: sin ellos el `?? 0` no decide nada",
    ).toBeGreaterThan(0);
  });

  /**
   * ★★ LOS ÍNDICES, EN CRUDO. Leídos del artefacto y escritos aquí a mano; NO derivados de
   * `place()` ni de `insertAt`. Es el único aserto de este fichero que sobrevive a una
   * regeneración del corpus sintético con la regla cambiada.
   */
  it("★★ los índices commiteados, escritos EN CRUDO (una regeneración con otra regla los rompe)", () => {
    const idx = (script: Op[]) =>
      script.map((o, i) => [i, o] as const).filter(([, o]) => String(o.src ?? "").startsWith("overlay"));

    // ── sint03-g02: tres bloques, uno de ellos `at:"first"` ──────────────────────────────────
    // El de ancla 28 lleva `at:"first"` y por eso aterriza en MITAD del guion (índice 5, delante
    // del ancla de venta de ocrLn 30). Los otros dos van por el barrido histórico: el de ancla 20
    // se para en el `nav` sin `ocrLn` del final de la base y cae detrás de él (14-15), y el de
    // ancla 40 se va al final (16).
    const g02 = routeEn(ROUTES_SINT_DIR, "sint03").segments.find((s) => s.id === "sint03-g02")!;
    expect(g02.script).toHaveLength(17);
    expect(idx(g02.script).map(([i]) => i)).toEqual([5, 14, 15, 16]);
    expect(g02.script[5]).toMatchObject({ enterLoc: 12, ocrLn: 28 });
    expect(g02.script[14]).toMatchObject({ seedInt: 25, ocrLn: 20 });
    expect(g02.script[15]).toMatchObject({ seedStr: 30, ocrLn: 20 });
    expect(g02.script[16]).toMatchObject({ wait: 350, ocrLn: 40 });
    // población del caso: la op que corta el barrido existe y está donde se dice
    expect(g02.script[13]!.ocrLn, "el `nav` sin ocrLn que detiene el barrido de ancla 20").toBeUndefined();

    // ── sint01-g03: un solo bloque, y el `?? 0` lo mete ANTES de ops posteriores ──────────────
    // Ancla 44 con dos ops de teclado de `ocrLn` 51 detrás: sin el `?? 0` parando en el `nav` del
    // índice 3, el bloque se iría al final. Que esté en 4-5 y no en 6-7 ES la regla histórica.
    const g03 = routeEn(ROUTES_SINT_DIR, "sint01").segments.find((s) => s.id === "sint01-g03")!;
    expect(g03.script).toHaveLength(8);
    expect(idx(g03.script).map(([i]) => i)).toEqual([4, 5]);
    expect(g03.script[4]).toMatchObject({ seedGold: 900, ocrLn: 44 });
    expect(g03.script[5]).toMatchObject({ recruit: "Vela", ocrLn: 44 });
    expect(g03.script[3]!.ocrLn, "el `nav` sin ocrLn que detiene el barrido").toBeUndefined();
    expect(g03.script[6]!.ocrLn, "y hay guion DESPUÉS con ocrLn mayor que el ancla").toBe(51);
  });
});

describe("#43 ruling 3 — insertAt", () => {
  const base: Op[] = [{ ocrLn: 10 }, { ocrLn: 20 }, {}, { ocrLn: 30 }, {}];

  it("★ por defecto conserva el `?? 0` HISTÓRICO: una op sin ocrLn corta el barrido", () => {
    // Conceptualmente es un defecto (un `nav` no dice nada de la posición y aun así decide el
    // ancla), pero es la conducta que los artefactos encodan: 13 de los 14 bloques commiteados
    // de LP1 están donde esto los pone. Fijarlo aquí es lo que impide que alguien lo «arregle»
    // sin darse cuenta de que mueve 8 colocaciones con corridas medidas encima.
    expect(insertAt(base, 20)).toBe(5);
  });

  it('`at:"first"`: detrás de la PRIMERA racha que cumple el ancla', () => {
    expect(insertAt(base, 20, "first")).toBe(3);
  });

  it("las dos reglas DIFIEREN, que es justo el motivo de que la explícita exista", () => {
    const rep: Op[] = [{ ocrLn: 5 }, { ocrLn: 5 }, { ocrLn: 99 }, { ocrLn: 5 }];
    expect(insertAt(rep, 5, "first")).toBe(2);
    expect(insertAt(rep, 5)).toBe(4);
  });

  it("ancla anterior a todo: al principio", () => {
    expect(insertAt(base, 1, "first")).toBe(0);
  });
});
