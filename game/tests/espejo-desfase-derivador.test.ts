/**
 * GUARDA DEL PUNTO FIJO DEL DERIVADOR (carril `cola-probe`).
 *
 * PROBLEMA QUE CIERRA — y es una MINA, no una deuda. `derive-dungeon-ops.mjs` es idempotente:
 * un corpus commiteado debería ser su PUNTO FIJO, y re-derivarlo no debería mover un byte.
 * `routes-ad` lo cumple. **`routes` (LP1) no**: re-derivarlo mueve 19 de 24 ficheros y
 * **CIERRA 66 `post-combat` que hoy están DENTRO del denominador** (más 5 que abre).
 *
 * ⇒ Cualquier carril que corra el derivador **por cualquier motivo** —y hay muchos motivos—
 * mueve el denominador de LP1 **en silencio**, y la conformidad cambia sin causa atribuible.
 * El descenso se leería como defecto del port. Esta guarda lo vuelve RUIDOSO.
 *
 * ★★ POR QUÉ EL CONJUNTO ES EXACTO Y NO UN TOPE. Rojo si la divergencia CRECE, ENCOGE o CAMBIA
 * DE MIEMBROS. «Encoge» también es rojo a propósito: un arreglo silencioso y una regresión
 * silenciosa son indistinguibles desde aquí, y las dos piden acta.
 * [[rancio-exige-polaridad]] · [[cifra-sin-sonda-commiteada]]
 *
 * ★ POR QUÉ SE MIDE EN MEMORIA Y NO CORRIENDO EL CLI. `enrichRoute` es el enriquecedor de
 * PRODUCCIÓN extraído sin tocar disco (su envoltorio `enrichPart` sólo añade read/write): así
 * el guarda mide **el mismo sujeto** que el CLI sin escribir el corpus. Un test que escribiera
 * las rutas contaminaría a cualquier otro carril midiendo sobre el árbol, y `spawnSync` dentro
 * de vitest bloquea el RPC. Cross-check hecho: la lista en memoria reproduce EXACTA la que
 * deja el CLI en disco (66 / 5).
 *
 * ⚠ POLARIDAD DECLARADA: este guarda es VERDE mientras la mina siga ahí y ROJO cuando alguien
 * la mueva. No vigila que el estado sea bueno —no lo es—: vigila que no cambie sin declararlo.
 * DESACTIVARLA es otra ventana, y es del lead (ver `cierre` en el registro).
 *
 * ═══ REPARTO POR CORPUS (ventana `corpus-sintetico-espejo`) ═════════════════════════════
 * El fichero tenía CUATRO sujetos mezclados en un solo `describe`, y los tres primeros no se
 * podían correr en el árbol público porque el cuarto leía `routes{,-ad}/`. Separados:
 *
 *  1. **El REGISTRO** (`desfase-derivador.json`) — es tracked y VIAJA. Que declare causa,
 *     motivo, dueño y caducidad no depende de ningún corpus ⇒ corre en el público.
 *  2. **El corpus SINTÉTICO** (`routes-sint/`) — VIAJA, y su punto fijo es lo que impide que
 *     el propio corpus sintético se pudra: si alguien lo edita a mano y lo saca del punto
 *     fijo del derivador, este aserto se pone rojo nombrando la parte. Es el aserto que el
 *     README de `routes-sint/` promete («el corpus no se puede pudrir en silencio»).
 *  3. **Los fixtures en memoria** — dientes que sobreviven a que LP1 se arregle. Nunca
 *     tocaron disco ⇒ corren en el público.
 *  4. **La deuda de LP1 y el punto fijo de AD** — hechos de los corpus REALES (cardinales
 *     24/25, las listas `cierra_66`/`abre_5` por nombre) ⇒ `describeCorpusReal`.
 */
import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { CTX_NEUTRO, enrichRoute } from "../e2e/espejo-tour/tools/derive-dungeon-ops.mjs";
import { describeCorpusReal, PARTES_SINT } from "./espejo-corpus";

const TOUR = join(import.meta.dirname, "..", "e2e", "espejo-tour");
const REGISTRO = join(TOUR, "desfase-derivador.json");

interface Seg {
  id: string;
  ctx?: string;
  skip?: string | boolean;
  skipReason?: string;
  openedBy?: string;
  script?: Array<Record<string, unknown>>;
}
interface Ruta {
  segments: Seg[];
}
interface Entrada {
  causa: string;
  motivo: string;
  declarado_en: string;
  cierre: string;
  impacto_denominador: string;
  sha_medicion: string;
  caduca: string;
  cierra_66: string[];
  abre_5: string[];
  skipReason_cambian: number;
  ops_dng_cambian_en_segmentos: number;
}

function registro(): Record<string, Entrada> {
  return JSON.parse(readFileSync(REGISTRO, "utf8")).corpus as Record<string, Entrada>;
}

export interface Divergencia {
  cierra: string[];
  abre: string[];
  reason: number;
  ops: number;
}

/**
 * EL CENSO, como función PURA sobre un corpus ya cargado — así los fixtures sintéticos de abajo
 * la ejercitan sin depender de que la población real siga existiendo.
 * [[seguro-sin-caso-vivo-mutante-que-no-mata]]
 */
export function divergencia(rutas: Ruta[]): Divergencia {
  const d: Divergencia = { cierra: [], abre: [], reason: 0, ops: 0 };
  for (const antes of rutas) {
    const despues = JSON.parse(JSON.stringify(antes)) as Ruta;
    enrichRoute(despues, { open: true });
    const byId = new Map(despues.segments.map((s) => [s.id, s]));
    for (const a of antes.segments) {
      const b = byId.get(a.id);
      if (!b) continue;
      if (!a.skip && b.skip) d.cierra.push(a.id);
      if (a.skip && !b.skip) d.abre.push(`${a.id}:${b.openedBy ?? "?"}`);
      if ((a.skipReason ?? "") !== (b.skipReason ?? "")) d.reason++;
      const nA = (a.script ?? []).filter((o) => o.dng).length;
      const nB = (b.script ?? []).filter((o) => o.dng).length;
      if (nA !== nB) d.ops++;
    }
  }
  return d;
}

/**
 * 🔴 PEREZOSA A PROPÓSITO: **ninguna lectura de corpus fuera del callback de un `it`**. Un
 * `readdirSync` en carga de módulo —o en el cuerpo de un `describe`, incluido el de un
 * `describe.skip`, que EJECUTA su cuerpo al recolectar— da ENOENT en el árbol público y se
 * lleva el fichero entero por delante antes de que `describeCorpusReal` pueda saltarlo.
 */
function cargar(dir: string): Ruta[] {
  const d = join(TOUR, dir);
  return readdirSync(d)
    .filter((f) => f.endsWith(".route.json"))
    .sort()
    .map((f) => JSON.parse(readFileSync(join(d, f), "utf8")) as Ruta);
}

/**
 * El corpus SINTÉTICO no se lee por `readdir`: su denominador va EN CRUDO (`PARTES_SINT`).
 * Un censo cuyo denominador sale del propio sujeto pasa en vacío el día que el directorio se
 * vacíe. [[un-censo-nunca-lleva-2-dev-null]]
 */
function cargarSint(): Ruta[] {
  return PARTES_SINT.map(
    (p) => JSON.parse(readFileSync(join(TOUR, "routes-sint", `${p}.route.json`), "utf8")) as Ruta,
  );
}

/** Los segmentos que el derivador PROCESA (mazmorra + las tres ranuras neutras). La constante
 *  viva se importa de producción: dos copias divergen. */
const enDominioDelDerivador = (s: Seg) => s.ctx === "dungeon" || CTX_NEUTRO.has(s.ctx ?? "");

describe("punto fijo del derivador — el REGISTRO de la deuda (tracked: no lee corpus)", () => {
  it("★ el registro está COMPLETO: causa, motivo, cierre con dueño y caducidad", () => {
    const e = registro().routes!;
    for (const k of ["causa", "motivo", "declarado_en", "cierre", "impacto_denominador", "sha_medicion"] as const) {
      expect(e[k], `el registro no declara \`${k}\``).toBeTruthy();
    }
    // el `cierre` tiene que decir QUIÉN decide: una entrada sin dueño es un cabo suelto
    // disfrazado de registro.
    expect(e.cierre).toMatch(/LEAD/i);
    // y el impacto tiene que estar en segmentos, no en adjetivos
    expect(e.impacto_denominador).toMatch(/\d+/);
    // AD no puede tener entrada: no diverge, y un registro con sujeto vacío justifica
    // exclusiones que dejaron de existir. [[curate-no-borra-regenerar-es-inerte]]
    expect(Object.keys(registro())).toEqual(["routes"]);
  });

  it("🔴 la deuda NO es eterna: vencida la caducidad hay que re-declararla o cerrarla", () => {
    const e = registro().routes!;
    expect(e.caduca).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(
      new Date(e.caduca) >= new Date(new Date().toISOString().slice(0, 10)),
      `La caducidad del desfase de LP1 (${e.caduca}) ha VENCIDO. «Conocido» ha dejado de ser una ` +
        "razón: o el lead adjudica cuál de los dos productores manda sobre `skip` y se re-deriva " +
        "LP1, o se re-declara la deuda con una fecha nueva y el motivo de la prórroga. Un semáforo " +
        "permanentemente ámbar se ignora, y ahí se muere el guarda.",
    ).toBe(true);
  });
});

/**
 * ★★ EL ASERTO QUE IMPIDE QUE EL CORPUS SINTÉTICO SE PUDRA, y por eso vive aquí y no en el
 * README de `routes-sint/`.
 *
 * `routes-sint/` se escribió a mano y después se pasó por el pipeline hasta converger. Que HOY
 * sea punto fijo del derivador no es una propiedad estable: cualquiera que edite una op `dng`,
 * un `skip` o un `skipReason` a mano lo saca de él, y a partir de ahí los tests que se apoyan
 * en ese corpus miden un artefacto rancio. Esta es la única sonda que lo cobra, y —a diferencia
 * de sus dos hermanas de abajo— corre **también en el repositorio público**, que es donde el
 * corpus sintético existe.
 *
 * Es además el MISMO predicado con el que se juzga a AD, sobre el mismo `divergencia()`: si
 * alguien rompe el derivador, los dos se ponen rojos, y el que sobrevive al árbol público es
 * éste.
 */
describe("punto fijo del derivador — el corpus SINTÉTICO (el único que VIAJA)", () => {
  it("★★ `routes-sint` está en su punto fijo: divergencia CERO", () => {
    const rutas = cargarSint();
    // 🔴 GUARDA DE POBLACIÓN, en tres alturas: sin rutas, sin segmentos del DOMINIO del
    // derivador o sin una sola op de pasillo que re-derivar, «divergencia cero» sería el
    // vacío leyéndose como éxito. [[el-vacio-se-lee-como-exito]]
    expect(rutas, "el corpus sintético no carga: ¿se ha movido `routes-sint/`?").toHaveLength(PARTES_SINT.length);
    const segs = rutas.flatMap((r) => r.segments);
    const dominio = segs.filter(enDominioDelDerivador);
    expect(
      dominio.length,
      "el corpus sintético no tiene un solo segmento de `ctx` dungeon/post-combat/resume/start: " +
        "el derivador no tendría nada que procesar y la divergencia sería cero por vacuidad",
    ).toBeGreaterThan(0);
    const conDng = segs.filter((s) => (s.script ?? []).some((o) => o.dng));
    expect(
      conDng.length,
      "el corpus sintético no tiene una sola op `dng` que re-derivar: el contador `ops` de " +
        "`divergencia()` no podría moverse aunque el derivador se rompiera",
    ).toBeGreaterThan(0);

    expect(
      divergencia(rutas),
      "🔴 EL CORPUS SINTÉTICO HA SALIDO DE SU PUNTO FIJO. O alguien lo ha editado a mano sin " +
        "volver a pasarlo por `derive-dungeon-ops.mjs --all --routes routes-sint` (ver el 🔴 " +
        "final de `routes-sint/README.md`), o el derivador ha cambiado de conducta. Los tests " +
        "que instancian propiedades de la herramienta sobre este corpus están midiendo, desde " +
        "ya, un artefacto rancio.",
    ).toEqual({ cierra: [], abre: [], reason: 0, ops: 0 });
  });
});

// ═══ FIXTURES SINTÉTICOS — dientes que sobreviven a que LP1 se arregle ═══
// El día que la mina se desactive, la población real será 0 y los asertos del corpus real
// pasarían a ser verdes sin cubrir nada. Éstos no dependen de ningún corpus en disco.
// [[control-positivo-no-cubre-la-forma]]
describe("punto fijo del derivador — mantiene los dientes con la población REAL vacía", () => {
  /** Ruta de mano: un `post-combat` sin `enter` detrás ⇒ el cinturón lo cerrará. */
  const sinDeclarar = (): Ruta => ({
    segments: [
      { id: "tX-g01", ctx: "start" },
      { id: "tX-g02", ctx: "post-combat" }, // sin `skip`: el derivador se lo pondrá
    ],
  });

  it("detecta un CIERRE que el registro no contempla", () => {
    const d = divergencia([sinDeclarar()]);
    expect(d.cierra).toEqual(["tX-g02"]);
    expect(d.abre).toEqual([]);
  });

  it("una ruta YA en punto fijo no aporta divergencia", () => {
    const yaCerrada: Ruta = {
      segments: [
        { id: "tY-g01", ctx: "start" },
        {
          id: "tY-g02",
          ctx: "post-combat",
          skip: "pendiente-runner",
          skipReason:
            "mazmorra INDETERMINABLE: retrocediendo desde aquí, lo primero que aparece es una SALIDA de la mazmorra (overworld/santuario/otra location) — este post-combat no es de interior",
        },
      ],
    };
    expect(divergencia([yaCerrada])).toEqual({ cierra: [], abre: [], reason: 0, ops: 0 });
  });

  it("un segmento fuera del dominio del derivador (`smallmap`) NUNCA cuenta como divergencia", () => {
    // si contara, el guarda acusaría a medio corpus y sería ruido en vez de señal
    const fuera: Ruta = { segments: [{ id: "tZ-g01", ctx: "smallmap" }] };
    expect(divergencia([fuera]).cierra).toEqual([]);
  });
});

describeCorpusReal("punto fijo del derivador — el desfase de LP1 está REGISTRADO al segmento", () => {
  it("censa los DOS corpus (un «0 problemas» sin denominador no vale nada)", () => {
    // 🔴 [[el-vacio-se-lee-como-exito]]: si `cargar` devolviera [], todo lo de abajo saldría
    // verde sin haber mirado nada.
    expect(cargar("routes")).toHaveLength(24);
    expect(cargar("routes-ad")).toHaveLength(25);
  });

  it("★★ `routes-ad` SÍ está en su punto fijo: divergencia CERO", () => {
    const d = divergencia(cargar("routes-ad"));
    expect(
      { cierra: d.cierra, abre: d.abre, reason: d.reason, ops: d.ops },
      "AD ha dejado de ser punto fijo del derivador: alguien ha commiteado rutas sin re-derivar, " +
        "o ha cambiado el derivador sin re-derivar el corpus. Re-deriva AD o declara la divergencia.",
    ).toEqual({ cierra: [], abre: [], reason: 0, ops: 0 });
  });

  it("★★ el desfase de LP1 es EXACTAMENTE el registrado — 66 cierres y 5 aperturas, por nombre", () => {
    const e = registro().routes!;
    const d = divergencia(cargar("routes"));
    const aviso =
      "🔴 EL DESFASE DE LP1 HA CAMBIADO. Si re-derivas `routes` AHORA, " +
      `${d.cierra.length} segmentos SALEN del denominador de LP1 y ${d.abre.length} entran ` +
      "(el registro declaraba 66 y 5). Crecer, encoger o cambiar de miembros son los tres rojos: " +
      "actualiza `game/e2e/espejo-tour/desfase-derivador.json` con la medición nueva y di en el acta " +
      "qué la movió, o cierra la mina re-derivando LP1 y publicando la conformidad con las dos cifras.";
    expect(d.cierra, aviso).toEqual(e.cierra_66);
    expect(d.abre, aviso).toEqual(e.abre_5);
    expect(d.reason, aviso).toBe(e.skipReason_cambian);
    expect(d.ops, aviso).toBe(e.ops_dng_cambian_en_segmentos);
  });
});
