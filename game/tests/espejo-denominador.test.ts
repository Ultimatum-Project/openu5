/**
 * GUARDA DEL DENOMINADOR (carril `denominador-10`, tarea #10).
 *
 * PROBLEMA QUE CIERRA. El espejo publica `matched / comparable` sobre 49 partes. Una parte
 * cuya ruta no deriva NI UN paso de nav no puede conducir movimiento: la party se queda en
 * el tile de entrada y cada bloque posicional del transcript se compara contra un estado que
 * nunca avanzó. Si además su material NO está retirado por `skip`, esos bloques SIGUEN en el
 * denominador y lo diluyen. `ad02` hace exactamente eso: 1261 comparables, 0 matched.
 *
 * ★ POR QUÉ EL PREDICADO ES «0 PASOS DE NAV» Y NO «TRAE NOTA DE CORPUS».
 * El encargo pedía un guarda que impidiera entrar en el denominador «sin nota de corpus».
 * No es implementable: `entry.note` lo GENERA `mkoverlay-*.mjs`, y 41 de las 49 notas son
 * SÓLO molde generado («Encadena del checkpoint de X. Hora canónica 10:00.»); de las 8 con
 * prosa humana, UNA SOLA —`ad02`— documenta una patología del corpus, y va APPENDEADA
 * detrás del molde EN EL MISMO STRING. O sea que «¿trae nota de corpus?» ni siquiera se
 * puede contestar sin parsear prosa: un guarda así sale VERDE por el molde (verde vacuo) o
 * ROJO en 48 partes. El predicado que sí cumple la intención mide la CAPACIDAD DE CONDUCIR,
 * y es además:
 *   · CIEGO AL RESULTADO — se lee del route.json commiteado, sin abrir ningún report;
 *   · CATEGÓRICO, no un umbral afinado — ad02 = 0, las otras 48 ≥ 47;
 *   · ANTERIOR — lo declaró quien curó ad02, antes de que hubiera conformidad que mirar.
 *
 * ── LOS DOS CORPUS (ver `tests/espejo-corpus.ts`) ────────────────────────────────────────
 * El guarda que gatea la cifra publicada tiene por sujeto el CORPUS REAL y ahí se queda,
 * bajo `describeCorpusReal`: su valor es precisamente que la población no la escribamos
 * nosotros. Pero `veredicto` y `pasosDeNav` son INSTRUMENTO, y su conducción de punta a
 * punta —censo LEÍDO DE DISCO, no array de mano— se instancia además sobre `routes-sint/`,
 * que viaja al público y trae su propia parte muda (`sint06`, la clase de `ad02`).
 *
 * 🔴 Ninguna lectura del corpus real fuera del callback de un `it` — tampoco dentro de un
 * `describeCorpusReal`, cuyo cuerpo se EJECUTA al recolectar aunque el bloque se salte.
 *
 * [[cero-vacio-exige-que-el-port-emita]] · [[preregistro-como-commit-propio]]
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  loadRoute,
  listParts,
  ROUTES_DIR,
  ROUTES_AD_DIR,
  type Route,
} from "../e2e/espejo-tour/runner";
import { describeCorpusReal, ROUTES_SINT_DIR, PARTES_SINT } from "./espejo-corpus";

const REGISTRO = join(ROUTES_DIR, "..", "desamparadas.json");

type Entrada = {
  causa: string;
  motivo: string;
  declarado_en: string;
  cierre: string;
  impacto_denominador: string;
  sha_medicion: string;
};

function registro(): Record<string, Entrada> {
  return JSON.parse(readFileSync(REGISTRO, "utf8")).desamparadas as Record<string, Entrada>;
}

/** Pasos de nav que la ruta deriva. `nav` es RLE: cada tramo lleva `n` (default 1). */
export function pasosDeNav(r: Route): number {
  let n = 0;
  for (const seg of r.segments) {
    for (const op of seg.script ?? []) {
      const nav = (op as { nav?: Array<{ n?: number }> }).nav;
      if (nav) for (const tramo of nav) n += tramo.n ?? 1;
    }
  }
  return n;
}

/** Las 49 rutas commiteadas, de los DOS corpus. */
function todasLasRutas(): Array<{ part: string; route: Route }> {
  const out: Array<{ part: string; route: Route }> = [];
  for (const dir of [ROUTES_DIR, ROUTES_AD_DIR]) {
    for (const p of listParts(dir)) out.push({ part: p, route: loadRoute(p, dir) });
  }
  return out;
}

/**
 * EL VEREDICTO, como función PURA sobre (censo, registro).
 *
 * ★★ POR QUÉ ESTÁ EXTRAÍDA. El guarda tiene HOY **un solo caso vivo** (`ad02`). El día que
 * `ad02` se arregle —o se retire del corpus— la población real baja a CERO, y un guarda con
 * población cero se queda **verde y con aspecto de cubrir**: exactamente
 * [[seguro-sin-caso-vivo-mutante-que-no-mata]]. El mutante NO basta contra eso, porque el
 * mutante también se queda sin sujeto.
 *
 * Separando el veredicto de la lectura del disco, los FIXTURES SINTÉTICOS de abajo lo
 * ejercitan con una población inventada, y siguen teniendo dientes cuando la real esté
 * vacía. [[control-positivo-no-cubre-la-forma]]
 */
export function veredicto(
  censo: Array<{ part: string; pasosNav: number }>,
  declaradas: Record<string, unknown>,
): { sinDeclarar: string[]; sobrantes: string[] } {
  const mudas = censo.filter((r) => r.pasosNav === 0).map((r) => r.part);
  return {
    sinDeclarar: mudas.filter((p) => !(p in declaradas)),
    sobrantes: Object.keys(declaradas).filter((p) => !mudas.includes(p)),
  };
}

const censoReal = () => todasLasRutas().map(({ part, route }) => ({ part, pasosNav: pasosDeNav(route) }));

/** El censo del corpus SINTÉTICO, con la MISMA función que el real. `sint06` es su parte muda
 *  (cero pasos de nav en toda la ruta), instanciada a propósito — es la clase de `ad02`.
 *  El denominador sale de `PARTES_SINT` (escrito EN CRUDO), no del propio directorio.
 *  [[un-censo-nunca-lleva-2-dev-null]] */
const censoSint = () =>
  PARTES_SINT.map((part) => ({ part, pasosNav: pasosDeNav(loadRoute(part, ROUTES_SINT_DIR)) }));

/**
 * REGISTRO SINTÉTICO de desamparadas — LITERAL, y a propósito NO un JSON nuevo.
 *
 * El sujeto del gemelo de abajo es `veredicto`, no un registro: lo que se mide es que la
 * función case el censo contra las declaraciones, no que alguien haya escrito un fichero. Un
 * `desamparadas-sint.json` añadiría un artefacto que mantener, ninguna cobertura, y encima
 * habría que decidir quién lo cura. La FORMA de las entradas (`causa`/`motivo`/`cierre`/
 * `sha_medicion`) la comprueba el bloque del registro REAL, que es donde vive esa obligación.
 */
const REGISTRO_SINT: Record<string, unknown> = { sint06: {} };

describe("denominador del espejo — partes DESAMPARADAS", () => {
  describeCorpusReal("censo de los DOS corpus reales", () => {
    it("censa las 49 rutas de los dos corpus (sin denominador, un «0 problemas» no vale nada)", () => {
      const rutas = todasLasRutas();
      // 🔴 El bucle IMPRIME su denominador: un verde sobre 0 rutas es indistinguible de un
      // verde sobre 49. [[el-vacio-se-lee-como-exito]]
      expect(rutas.length).toBe(49);
      expect(rutas.filter((r) => r.part.startsWith("part")).length).toBe(24);
      expect(rutas.filter((r) => r.part.startsWith("ad")).length).toBe(25);
    });
  });

  // ═══ TESTIGO PROPIO DE `pasosDeNav` — el instrumento, no el registro ═══
  // 🔴 EL AGUJERO QUE CIERRA (lo afinó el lead). Sin esto, el único testigo de que
  // `pasosDeNav` FUNCIONA es `expect(porParte.get("ad02")).toBe(0)` — o sea, la misma parte
  // cuya desaparición es el escenario probable. Si mañana el esquema mueve `nav` a otro
  // campo, la función devuelve >0 para TODAS ⇒ `mudas = []` ⇒ los tres asertos de arriba
  // salen verdes y el guarda queda CIEGO PARA SIEMPRE, sin que nada avise.
  // Anclado a rutas sintéticas: el valor no depende del corpus.
  describe("pasosDeNav — anclada a rutas de mano, sin depender del corpus", () => {
    const ruta = (script: unknown[]): Route =>
      ({ part: "tX", segments: [{ id: "tX-g01", ctx: "smallmap", seam: null, ocr: { from: 1, to: 9 }, script, expect: [] }] }) as unknown as Route;

    it("suma el RLE respetando `n` — no cuenta un paso por tramo", () => {
      // 3 + 1(default, ejercita el `?? 1`) + 5 = 9. Si alguien contara TRAMOS daría 3.
      const r = ruta([{ nav: [{ m: "north", v: "walk", n: 3 }, { m: "east", v: "walk" }] }, { nav: [{ m: "south", v: "fly", n: 5 }] }]);
      expect(pasosDeNav(r)).toBe(9);
    });

    it("da 0 cuando no hay NI UN op de nav (el caso que dispara el guarda)", () => {
      expect(pasosDeNav(ruta([{ todo: "Mmrth" }, { key: "y" }, { typed: "MIN" }]))).toBe(0);
      expect(pasosDeNav(ruta([]))).toBe(0);
    });
  });

  // ═══ GEMELO SOBRE EL CORPUS SINTÉTICO — el guarda ENTERO, con corpus que VIAJA ═══
  /**
   * El bloque de corpus real (abajo) es el que gatea la cifra publicada y no se mueve. Pero
   * era también el ÚNICO sitio donde `veredicto` se conducía contra un censo LEÍDO DE DISCO:
   * los fixtures del final lo alimentan con arrays escritos a mano, y por tanto no cubren
   * `pasosDeNav` ni la lectura. Este gemelo cierra ese hueco en el árbol público — mismo
   * `pasosDeNav`, mismo `veredicto`, mismo camino de lectura, corpus que viaja.
   */
  describe("el guarda, conducido de punta a punta sobre el corpus sintético", () => {
    it("`sint06` es la parte muda del corpus sintético, y el veredicto CALLA con ella declarada", () => {
      const censo = censoSint();
      expect(censo.length, "el censo sintético salió vacío").toBe(PARTES_SINT.length);

      // GUARDA DE POBLACIÓN: sin una parte muda de verdad, `veredicto` no tendría con qué
      // acusar y el `toEqual` de abajo sería un verde vacuo — el mismo modo de fallo que
      // motivó los fixtures del final. [[seguro-sin-caso-vivo-mutante-que-no-mata]]
      const mudas = censo.filter((r) => r.pasosNav === 0).map((r) => r.part);
      expect(mudas, "el corpus sintético no trae NI UNA parte muda: el guarda pasó en vacío").toEqual(["sint06"]);

      // …y el resto SÍ deriva movimiento: el predicado es CATEGÓRICO, no un umbral afinado.
      expect(Math.min(...censo.filter((r) => r.part !== "sint06").map((r) => r.pasosNav))).toBeGreaterThan(0);

      expect(veredicto(censo, REGISTRO_SINT)).toEqual({ sinDeclarar: [], sobrantes: [] });
    });

    it("…y ACUSA en cuanto se le retira `sint06` del registro (el mutante, conducido)", () => {
      // Control del control: el `toEqual` de arriba tiene que ser falsable POR ESTE CAMINO
      // —censo leído de disco, no array de mano— o no dice nada sobre la lectura.
      expect(veredicto(censoSint(), {}).sinDeclarar).toEqual(["sint06"]);
      // Y la simétrica: una entrada que ya no aplica sale como sobrante.
      expect(veredicto(censoSint(), { ...REGISTRO_SINT, sint01: {} }).sobrantes).toEqual(["sint01"]);
    });
  });

  describeCorpusReal("el guarda sobre la población REAL (lo que gatea la cifra publicada)", () => {
    it("toda ruta con 0 pasos de nav está DECLARADA en desamparadas.json", () => {
      const declaradas = registro();
      const { sinDeclarar, sobrantes } = veredicto(censoReal(), declaradas);
      expect(
        sinDeclarar,
        `Estas partes no derivan NI UN paso de nav, así que no pueden conducir movimiento, ` +
          `y NO están en game/e2e/espejo-tour/desamparadas.json: [${sinDeclarar.join(", ")}]. ` +
          `Sus comparables entran en el denominador sin poder casar. Declara cada una con su ` +
          `causa (corpus/arnés/ruta) y su cierre, o arregla la ruta.`,
      ).toEqual([]);

      // Y la simétrica: el registro no puede acumular entradas que ya no apliquen — un
      // registro rancio justifica exclusiones que dejaron de tener sujeto.
      // [[curate-no-borra-regenerar-es-inerte]]
      expect(
        sobrantes,
        `Estas partes están declaradas DESAMPARADAS pero YA derivan pasos de nav: ` +
          `[${sobrantes.join(", ")}]. Si la ruta se arregló, retira su entrada del registro ` +
          `y re-publica la cifra sin la exclusión.`,
      ).toEqual([]);
    });

    it("ad02 es el caso vivo: 0 pasos, y las otras 48 tienen material de movimiento", () => {
      const porParte = new Map(todasLasRutas().map(({ part, route }) => [part, pasosDeNav(route)]));
      expect(porParte.get("ad02")).toBe(0);

      // El predicado es CATEGÓRICO, no un umbral afinado: entre 0 y el siguiente hay un
      // abismo. Si esto se estrechara, el guarda dejaría de ser ciego al resultado y habría
      // que re-justificarlo. [[no-fijes-una-coincidencia-como-invariante]]
      const resto = [...porParte.entries()].filter(([p]) => p !== "ad02").map(([, n]) => n);
      expect(resto.length).toBe(48);
      expect(Math.min(...resto)).toBeGreaterThan(0);
    });
  });

  // ═══ FIXTURES SINTÉTICOS — los dientes que SOBREVIVEN a que `ad02` se arregle ═══
  // Exigidos por el lead: con un solo caso vivo, el día que la población real sea cero el
  // guarda quedaría verde sin cubrir nada. Estos cuatro no dependen del corpus.
  describe("mantiene los dientes con población REAL vacía (fixture sintético)", () => {
    it("acusa una parte muda NO declarada, aunque el corpus real esté sano", () => {
      const censo = [
        { part: "partZZ", pasosNav: 0 }, // inventada: no conduce y nadie la declaró
        { part: "partYY", pasosNav: 500 },
      ];
      expect(veredicto(censo, {}).sinDeclarar).toEqual(["partZZ"]);
    });

    it("calla si esa misma parte muda SÍ está declarada", () => {
      const censo = [{ part: "partZZ", pasosNav: 0 }];
      expect(veredicto(censo, { partZZ: {} })).toEqual({ sinDeclarar: [], sobrantes: [] });
    });

    it("acusa una entrada RANCIA: declarada pero ya con pasos de nav", () => {
      const censo = [{ part: "partZZ", pasosNav: 12 }];
      expect(veredicto(censo, { partZZ: {} }).sobrantes).toEqual(["partZZ"]);
    });

    // ★ EL CASO QUE MOTIVA TODO ESTO: población real vacía. Sin este fixture, el día que
    // `ad02` se cure los otros tests pasan a ser verdes vacuos y nadie se entera.
    it("con CERO partes mudas reales, el veredicto sigue siendo capaz de acusar", () => {
      expect(veredicto([{ part: "sana", pasosNav: 9 }], {})).toEqual({
        sinDeclarar: [],
        sobrantes: [],
      });
      // …y con la misma función, un caso muda dispara. El predicado no se ha atrofiado.
      expect(veredicto([{ part: "muda", pasosNav: 0 }], {}).sinDeclarar).toEqual(["muda"]);
    });
  });

  // `desamparadas.json` es tracked y VIAJA al público: este bloque no abre ningún corpus y
  // corre en todas partes.
  it("cada entrada del registro dice DÓNDE está la causa y QUÉ la cerraría", () => {
    const declaradas = registro();
    expect(Object.keys(declaradas).length).toBeGreaterThan(0);
    for (const [parte, e] of Object.entries(declaradas)) {
      expect(["corpus", "arnes", "ruta"], `${parte}: causa fuera del vocabulario`).toContain(
        e.causa,
      );
      // Un registro cuyo `cierre` es «pendiente» es un cabo suelto disfrazado de registro.
      expect(e.cierre.length, `${parte}: sin cierre`).toBeGreaterThan(40);
      expect(e.motivo.length, `${parte}: sin motivo`).toBeGreaterThan(40);
      expect(e.sha_medicion, `${parte}: cifra sin sha es una foto sin fecha`).toMatch(
        /^[0-9a-f]{8}$/,
      );
    }
  });
});
