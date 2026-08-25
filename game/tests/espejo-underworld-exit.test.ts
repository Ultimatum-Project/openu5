/**
 * #32 — LA COSTURA DE SALIDA AL UNDERWORLD **NO** ES INTERIOR (los DOS generadores).
 *
 * Emerger al Underworld es SALIR del interior igual que emerger a Britannia: la party queda
 * en un mapa GRANDE (`location` 0, `floor` 0xFF), sólo que en la otra capa. El clasificador de
 * interiores de los dos generadores de overlays trataba las dos ramas del mismo `if` de forma
 * asimétrica —Britannia cerraba, Underworld no— y ésa es la raíz que marcaba las 16 costuras
 * de salida del censo como `[SKIP:pendiente-runner]`.
 *
 * ★★ Lo que este fichero fija y NO se puede leer del `if`: en `mkoverlay-lp1.mjs` arreglar sólo
 * esa rama es INERTE. La regla #89 («Underworld» fuera de interior ABRE interior, que existe
 * porque el estado de LP1 no cruza episodios) vuelve a abrir el interior en el MISMO segmento
 * que la costura acaba de cerrar. Medido: con el fix ingenuo los 24 overlays salen byte a byte
 * idénticos a los de antes del fix. Por eso hay aquí un test por cada mitad — el de la rama
 * pasaría con el arreglo inerte; el de la regla #89 es el que lo suspende.
 *
 * Y la guarda tiene que ser la COSTURA, no una bandera de «la rama acaba de disparar»: la rama
 * está gateada por `&& inInterior`, así que en una SEGUNDA costura de salida consecutiva no
 * llega a dispararse. Caso real en el corpus: part19-g10 detrás de part19-g09.
 *
 * ═══ REPARTO POR CORPUS (ventana `corpus-sintetico-espejo`) ═════════════════════════════
 * La mitad UNITARIA de este fichero —los 6 casos × 2 generadores del clasificador y los 3 de
 * la regla #89— nunca tocó disco, y sin embargo no corría en el árbol público: la mitad de
 * CORPUS hacía `readFileSync`/`readdirSync` **en el cuerpo de un `describe`**
 * (`clasificar()`), que vitest ejecuta AL RECOLECTAR, así que el ENOENT se llevaba el fichero
 * entero antes de que ningún `skip` pudiera intervenir. Hoy esa lectura es PEREZOSA y ocurre
 * dentro del `it`, y las tres mitades quedan separadas:
 *
 *  · **unitaria** (15 casos) — corre en todas partes, y es la que enuncia el hallazgo del
 *    fichero (que arreglar sólo la rama del `if` es inerte).
 *  · **sintética** (`routes-sint/`) — la misma propiedad instanciada sobre un corpus que SÍ
 *    viaja: `sint04-g03` es una costura de salida al Underworld y `sint04-g04` la segunda
 *    consecutiva. Recupera para el público el careo de las DOS CAPAS (overlay y route), que
 *    es lo que este fichero aportaba y `espejo-ledger` no.
 *  · **censal** (`describeCorpusReal`) — los 16 ids de E-23 por identidad. No se mueven: son
 *    un hecho del LP, y sobre un corpus escrito por nosotros serían tautológicos.
 */
import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  stepInterior as stepLp1,
  type InteriorState as State,
} from "../e2e/espejo-tour/tools/mkoverlay-lp1.mjs";
import { stepInterior as stepAd } from "../e2e/espejo-tour/tools/mkoverlay-ad.mjs";
import { describeCorpusReal, PARTES_SINT } from "./espejo-corpus";

const TOUR = join(dirname(fileURLToPath(import.meta.url)), "..", "e2e", "espejo-tour");

/** Segmento de ruta con lo que además necesitan los recorridos de corpus (id y expect). */
type Seg = {
  id: string;
  ctx?: string;
  seam?: string | null;
  enter?: { loc?: number; banner?: string };
  expect?: { text: string }[];
};

/** El MISMO recorte que usan los generadores para sondear señales (8 primeros bloques). */
const segTexts = (seg: Seg, n = 8) => (seg.expect ?? []).slice(0, n).map((b) => b.text).join(" ");

const INSIDE: State = { inInterior: true, why: "entrada-dng" };
const seg = (over: Partial<Seg> = {}): Seg => ({ id: "x", ctx: "overworld", seam: null, ...over });
const exitSeam = (text: string) => seg({ seam: "exit", expect: [{ text }] });

// Sin `as`: los dos generadores tienen que seguir compartiendo la firma, y si uno se desvía el
// error tiene que salir aquí en vez de quedar tapado por un cast.
const GENERATORS = [
  ["mkoverlay-lp1", stepLp1],
  ["mkoverlay-ad", stepAd],
] as const;

describe.each(GENERATORS)("clasificador de interior — %s", (_name, step) => {
  const run = (s: Seg, state: State = INSIDE) => step(s, segTexts(s), state);

  it("la costura de salida al UNDERWORLD CIERRA el interior", () => {
    expect(run(exitSeam("Underworld!")).inInterior).toBe(false);
  });

  it("y lo etiqueta como underworld, no como salida ambigua", () => {
    expect(run(exitSeam("Underworld!")).why).toBe("underworld");
  });

  // Control de la rama gemela: la que YA cerraba tiene que seguir cerrando igual.
  it("la costura de salida a BRITANNIA sigue cerrando el interior", () => {
    expect(run(exitSeam("Britannia!")).inInterior).toBe(false);
  });

  // Control OPUESTO: sin evidencia de superficie el clasificador es conservador. Sin este
  // caso, «cerrar siempre en toda costura de salida» pasaría los dos tests de arriba.
  it("la costura de salida SIN evidencia de superficie sigue DENTRO (conservador)", () => {
    const r = run(exitSeam("Advance Blocked!"));
    expect(r.inInterior).toBe(true);
    expect(r.why).toBe("exit-ambiguo-dng");
  });

  // Control de que no hemos desarmado la apertura: si el fix hubiera roto esto, los 16 saldrían
  // a superficie por la razón equivocada.
  it("la entrada de mazmorra sigue ABRIENDO interior", () => {
    const r = run(seg({ seam: "dungeon-enter" }), { inInterior: false, why: "" });
    expect(r.inInterior).toBe(true);
    expect(r.why).toBe("entrada-dng");
  });

  it("«Entering room..» fuera de interior sigue abriendo (sala de combate)", () => {
    const r = run(seg({ expect: [{ text: "Enterlng room.." }] }), { inInterior: false, why: "" });
    expect(r.inInterior).toBe(true);
    expect(r.why).toBe("sala-combate");
  });
});

describe("mkoverlay-lp1 — la regla #89 no puede deshacer la costura de salida", () => {
  const run = (s: Seg, state: State) => stepLp1(s, segTexts(s), state);

  // ★ ÉSTE es el que suspende con el arreglo ingenuo (sólo la rama del `if`).
  it("tras cerrar por la costura, «Underworld» NO reabre el interior en ese mismo segmento", () => {
    expect(run(exitSeam("Underworld!"), INSIDE).inInterior).toBe(false);
  });

  // ★ Y éste es el que suspende si la guarda se pone como bandera de «la rama disparó»: aquí
  // la rama ni siquiera se evalúa, porque está gateada por `&& inInterior`.
  it("una SEGUNDA costura de salida consecutiva tampoco reabre (part19-g10 tras part19-g09)", () => {
    const primera = run(exitSeam("Underworld!"), INSIDE);
    expect(primera.inInterior).toBe(false);
    expect(run(exitSeam("Underworld!"), primera).inInterior).toBe(false);
  });

  // Control: la regla #89 sigue viva para lo suyo. Su caso canónico (part19-g01, «Falling into
  // underworld!!») NO es costura de salida — tiene `seam: null` —, así que la guarda no lo toca.
  // Sin este control, «desactivar la regla #89» pasaría los dos tests de arriba.
  it("la regla #89 SIGUE abriendo interior fuera de una costura de salida", () => {
    const r = run(seg({ ctx: "start", expect: [{ text: "Falling into underworld!!" }] }), {
      inInterior: false,
      why: "",
    });
    expect(r.inInterior).toBe(true);
    expect(r.why).toBe("underworld");
  });
});

/**
 * Mitad de CORPUS: los 16 segmentos del censo, por IDENTIDAD y no por conteo (un total cuadra
 * por casualidad; una lista de ids no). Se replica el recorrido de cada generador — LP1 reinicia
 * el estado en cada parte, AD lo ARRASTRA por la cadena ad01..ad25 — y se comprueba que ninguno
 * queda clasificado como interior.
 */
/** Censo de E-23, a nivel de módulo: lo usan el recorrido del clasificador Y el pin del `skip`. */
const CENSO_A = [
  "part19-g09", "part20-g11", "part22-g07",
  "ad17-g12", "ad17-g14", "ad17-g18", "ad18-g11", "ad23-g03",
];
const CENSO_B = [
  "part17-g07", "part19-g10",
  "ad15-g14", "ad20-g08", "ad20-g09", "ad20-g10", "ad23-g04", "ad24-g31",
];
const CENSO = [...CENSO_A, ...CENSO_B];

/**
 * ═══ MITAD SINTÉTICA — la MISMA propiedad, sobre el corpus que SÍ viaja ═══════════════════
 *
 * `routes-sint/` instancia el rasgo a propósito (`README.md`, tabla): `sint04-g02` abre el
 * interior con una costura `dungeon-enter`, `sint04-g03` es la costura de SALIDA al Underworld
 * (`enter.underworld`, eco `Underworld!`) y `sint04-g04` la SEGUNDA consecutiva. Eso permite
 * recuperar para el árbol público las dos cosas que la mitad de corpus aportaba y la unitaria
 * no puede:
 *   · que la costura cierre **dentro de un recorrido REAL de ruta** (con el estado abierto por
 *     un segmento anterior, no inyectado a mano por el test), y
 *   · el careo de las **DOS CAPAS** del `skip` (overlay = la que se edita, route = la que el
 *     runner CONSUME), que ya divergieron una vez en 63 segmentos.
 *
 * ⚠ Lo que NO se mueve aquí y sigue abajo: los 16 ids de E-23. Un censo por identidad sobre un
 * corpus que escribimos nosotros no prueba nada. [[el-aserto-que-calcula-su-esperado-desde-el-sujeto-es-tautologico]]
 */
describe("corpus SINTÉTICO: la costura de salida al Underworld, en las DOS capas", () => {
  const rutaSint = (part: string) =>
    JSON.parse(readFileSync(join(TOUR, "routes-sint", `${part}.route.json`), "utf8")) as { segments?: Seg[] };
  const overlaySint = (part: string) =>
    JSON.parse(readFileSync(join(TOUR, "routes-sint", "overlays", `${part}.json`), "utf8")) as {
      segments?: Record<string, Record<string, unknown>>;
    };

  /** Recorre las 6 partes con el generador dado, ARRASTRANDO el estado (como hace AD). */
  const recorrer = (step: typeof stepLp1): Map<string, State> => {
    const out = new Map<string, State>();
    let st: State = { inInterior: false, why: "" };
    for (const part of PARTES_SINT) {
      for (const s of rutaSint(part).segments ?? []) {
        st = step(s, segTexts(s), st);
        out.set(s.id, { ...st });
      }
    }
    return out;
  };

  it("★ la costura de salida al UNDERWORLD (`sint04-g03`) cierra el interior — en los DOS generadores", () => {
    for (const [nombre, step] of GENERATORS) {
      const st = recorrer(step);
      // 🔴 CONTROL POSITIVO / guarda de población: sin un interior ABIERTO detrás, «no es
      // interior» sería cierto por vacuidad y el test no mediría el cierre.
      expect(st.get("sint04-g02")?.inInterior, `${nombre}: sint04-g02 no abrió el interior`).toBe(true);
      expect(st.get("sint04-g03")?.inInterior, `${nombre}: la costura al Underworld no cerró`).toBe(false);
      expect(st.get("sint04-g03")?.why, `${nombre}: cerró pero no como underworld`).toBe("underworld");
    }
  });

  it("★ y la SEGUNDA costura consecutiva (`sint04-g04`) tampoco reabre", () => {
    for (const [nombre, step] of GENERATORS) {
      const st = recorrer(step);
      expect(st.get("sint04-g04")?.inInterior, `${nombre}: la segunda costura reabrió el interior`).toBe(false);
    }
  });

  it("★★ ninguna de las dos costuras lleva `skip` — ni en el OVERLAY ni en el ROUTE", () => {
    const COSTURAS = ["sint04-g03", "sint04-g04"];
    const ov = overlaySint("sint04").segments ?? {};
    const segs = rutaSint("sint04").segments ?? [];
    let comprobadas = 0;
    for (const id of COSTURAS) {
      // guarda de población: si un id se renombra, la ausencia tiene que ROMPER, no aprobar
      expect(ov[id], `${id}: no existe en el overlay sintético`).toBeDefined();
      const enRuta = segs.find((s) => s.id === id);
      expect(enRuta, `${id}: no existe en la ruta sintética`).toBeDefined();
      expect(ov[id]!.skip ?? false, `${id}: skipeado en el OVERLAY (la capa que se edita)`).toBe(false);
      expect(
        (enRuta as unknown as { skip?: unknown }).skip ?? false,
        `${id}: skipeado en el ROUTE (la capa que el runner CONSUME)`,
      ).toBe(false);
      comprobadas++;
    }
    expect(comprobadas, "el censo sintético de costuras se ha quedado vacío").toBe(COSTURAS.length);
  });

  /**
   * Control OPUESTO del pin de arriba, que se satisfaría igual si NADA del corpus llevara
   * `skip`. En el corpus sintético la cuarentena vive en la capa ROUTE (5 segmentos cerrados
   * con su razón declarada por el propio derivador).
   *
   * ✅ CABO CERRADO (25-08, en la misma ventana): este comentario decía que la mitad de OVERLAY
   * del control no se podía instanciar porque ningún overlay de `routes-sint/` llevaba `skip`.
   * Ya lo lleva: `overlays/sint02.json` declara `skip:"pendiente-runner"` en `sint02-g04`, el
   * mismo valor que la ruta ya tenía —así que `curate` sigue en su punto fijo— y con eso las
   * DOS capas tienen población sintética. Es lo que hace no vacuo el pin de arriba: sin un
   * `skip` en la capa que se EDITA, «ninguna de las dos costuras lleva skip en el overlay» se
   * cumpliría en un overlay que no sabe skipear.
   */
  it("control opuesto: la cuarentena del corpus sintético SIGUE en pie, en LAS DOS CAPAS", () => {
    // capa ROUTE — la que el runner CONSUME (`runSegment` mira `seg.skip`)
    const cerrados = PARTES_SINT.flatMap((p) => rutaSint(p).segments ?? []).filter(
      (s) => (s as unknown as { skip?: unknown }).skip,
    );
    expect(
      cerrados.length,
      "ningún segmento del corpus sintético lleva `skip`: el pin de arriba se cumpliría por " +
        "vacuidad, porque nadie skipea nada",
    ).toBeGreaterThan(0);

    // capa OVERLAY — la que se EDITA, y la que el pin de arriba mira. Un des-skip aplicado
    // sólo aquí es inerte sobre la medición, y por eso las dos se vigilan por separado.
    const enOverlay = PARTES_SINT.flatMap((p) =>
      Object.entries(overlaySint(p).segments ?? {})
        .filter(([, patch]) => patch.skip)
        .map(([id]) => id),
    );
    expect(
      enOverlay,
      "ningún overlay del corpus sintético declara `skip`: la mitad de OVERLAY del pin de " +
        "arriba («no está skipeado en el OVERLAY») se estaría cumpliendo sobre una capa que " +
        "no sabe skipear, que es un verde sin sujeto",
    ).toEqual(["sint02-g04"]);
  });
});

describeCorpusReal("corpus: las 16 costuras de salida al Underworld salen a SUPERFICIE", () => {
  const clasificar = (): Map<string, boolean> => {
    const out = new Map<string, boolean>();
    const wanted = new Set(CENSO);
    const route = (dir: string, part: string) =>
      JSON.parse(readFileSync(join(TOUR, dir, `${part}.route.json`), "utf8")) as { segments?: Seg[] };

    // LP1: SIN arrastre entre episodios — cada parte arranca en superficie.
    for (let i = 1; i <= 24; i++) {
      let st: State = { inInterior: false, why: "" };
      for (const s of route("routes", `part${String(i).padStart(2, "0")}`).segments ?? []) {
        st = stepLp1(s, segTexts(s), st);
        if (wanted.has(s.id)) out.set(s.id, st.inInterior);
      }
    }
    // AD: el estado CRUZA episodios, así que el orden ad01..ad25 es parte del instrumento.
    const eps = readdirSync(join(TOUR, "routes-ad"))
      .filter((f) => f.endsWith(".route.json"))
      .map((f) => f.replace(".route.json", ""))
      .sort();
    let st: State = { inInterior: false, why: "" };
    for (const ep of eps) {
      for (const s of route("routes-ad", ep).segments ?? []) {
        st = stepAd(s, segTexts(s), st);
        if (wanted.has(s.id)) out.set(s.id, st.inInterior);
      }
    }
    return out;
  };

  /**
   * 🔴 MEMOIZADO Y PEREZOSO, y el «perezoso» es lo que arregla un defecto REAL: esto era
   * `const clasificados = clasificar()` en el cuerpo del `describe`, y vitest ejecuta el cuerpo
   * de un `describe` **al recolectar** — también el de un `describe.skip`. Con las rutas
   * ausentes (árbol público, o worktree con la receta de symlinks coja) el `readFileSync`
   * reventaba en la recolección y se llevaba por delante el fichero ENTERO, incluidos los 15
   * casos unitarios que no leen nada. La lectura tiene que ocurrir DENTRO del `it`.
   */
  let cache: Map<string, boolean> | null = null;
  const clasificados = (): Map<string, boolean> => (cache ??= clasificar());

  // Guarda de POBLACIÓN: si un id se renombra o desaparece de las rutas, los asertos de abajo
  // se volverían vacuos en silencio. Una ausencia tiene que ROMPER, no aprobar.
  it("los 16 ids del censo existen en las rutas commiteadas", () => {
    expect([...clasificados().keys()].sort()).toEqual([...CENSO].sort());
  });

  it.each(CENSO_A)("clase A (E-23): %s no es interior", (id) => {
    expect(clasificados().get(id)).toBe(false);
  });

  it.each(CENSO_B)("clase B (E-23): %s no es interior", (id) => {
    expect(clasificados().get(id)).toBe(false);
  });
});

/**
 * EL `skip` DEL OVERLAY, PINADO — la capa que NADIE vigilaba.
 *
 * ⚠ **AUTOCORRECCIÓN, y la dejo escrita porque me equivoqué en voz alta.** Al añadir esto afirmé
 * que «el `skip` nunca estuvo pinado» y que la nota de E-23 §5 lo decía en falso. **Era mío el
 * error**: el pin SÍ existe —en `espejo-ledger.test.ts`, no en este fichero— y además pina la
 * capa CORRECTA (el `route.json`). Busqué en el fichero equivocado y ascendí una ausencia local a
 * ausencia global, que es exactamente lo que [[ausencia-no-se-prueba-con-head]] prohíbe. E-23
 * tenía razón.
 *
 * Lo que este bloque SÍ aporta, y por eso se queda: aquel pin mira el **route**, y el `skip` vive
 * en DOS capas que **ya divergían** (63 segmentos / 2.450 bloques en `3acd3e0d`). Nadie vigilaba
 * el **overlay**, que es la entrada del generador — y un des-skip aplicado sólo ahí es inerte
 * sobre la medición, como comprobé en carne propia.
 *
 * RULING DEL LEAD (31-07): la clase B **se des-skipea**, porque el criterio que la mantenía
 * —«el resync no corre: la party ya está en `location` 0»— murió con el hallazgo de que
 * `state.position` no atestigua la mazmorra. Hoy los **16** están des-skipeados en las dos capas.
 */
describeCorpusReal("★ el `skip` de las 16 costuras, PINADO (nadie lo vigilaba)", () => {
  const overlaySeg = (id: string): Record<string, unknown> | undefined => {
    const part = id.split("-")[0]!;
    const dir = part.startsWith("ad") ? "routes-ad" : "routes";
    const ov = JSON.parse(readFileSync(join(TOUR, dir, "overlays", `${part}.json`), "utf8")) as {
      segments?: Record<string, Record<string, unknown>>;
    };
    return ov.segments?.[id];
  };

  it("los 16 existen en su overlay (si un id se renombra, esto rompe en vez de aprobar)", () => {
    for (const id of CENSO) expect(overlaySeg(id), id).toBeDefined();
  });

  /**
   * ★★ EL `skip` VIVE EN DOS CAPAS, Y LA QUE MANDA NO ES LA QUE SE EDITA.
   *
   * El overlay es la ENTRADA del generador; `curate.mjs` lo hornea en el `route.json`. Y el
   * runner **no lee overlays en ningún momento** — `runSegment` mira `seg.skip`, que viene del
   * route. Medido sobre `3acd3e0d`: **63 segmentos / 2.450 bloques** están skipeados en el route
   * y NO en su overlay, así que las dos capas ya divergían antes de tocar nada.
   *
   * Consecuencia: un des-skip aplicado sólo al overlay es **INERTE sobre la medición** (lo
   * comprobé en carne propia: corrí ad20 y los tres segmentos seguían saliendo `nav-only`). Por
   * eso el pin exige las DOS capas: la que se edita y la que se consume.
   */
  const routeSeg = (id: string): Record<string, unknown> | undefined => {
    const part = id.split("-")[0]!;
    const dir = part.startsWith("ad") ? "routes-ad" : "routes";
    const r = JSON.parse(readFileSync(join(TOUR, dir, `${part}.route.json`), "utf8")) as {
      segments?: Record<string, unknown>[];
    };
    return r.segments?.find((s) => s.id === id);
  };

  it.each(CENSO)("%s NO está skipeado en el OVERLAY (la capa que se edita)", (id) => {
    expect(overlaySeg(id)?.skip ?? false).toBe(false);
  });

  it.each(CENSO)("%s NO está skipeado en el ROUTE (la capa que el runner CONSUME)", (id) => {
    expect(routeSeg(id)?.skip ?? false).toBe(false);
  });

  // Control OPUESTO: el pin de arriba se satisfaría igual si TODO el corpus dejara de skipearse
  // (una regeneración que se cargue la regla entera). La cuarentena real tiene que seguir ahí.
  it("y la cuarentena del resto del corpus SIGUE en pie (el pin no vale si nada skipea)", () => {
    const ad20 = JSON.parse(readFileSync(join(TOUR, "routes-ad", "overlays", "ad20.json"), "utf8")) as {
      segments?: Record<string, { skip?: unknown }>;
    };
    const skipeados = Object.values(ad20.segments ?? {}).filter((s) => s.skip);
    expect(skipeados.length).toBeGreaterThan(0);
  });
});
