/**
 * LA PUERTA DE LOS CINCO SELLOS — tests de las dos mitades.
 *
 * Lo que se sella aquí es la razón de existir de la puerta: hoy (2026-08-02) entraron seis
 * cambios del arnés sin esta comprobación y `ad06-g34` quedó en `220 → 0`. La doctrina
 * existía y se repitió a dos carriles; lo que faltaba era el mecanismo.
 *
 * Los dos predicados que hay que vigilar son distintos y fallan distinto:
 *   · `veredicto_sellos`  — ¿siguen intactos? El modo de fallo temido es el VERDE POR
 *     AUSENCIA: una parte que no corrió no tiene sello, y un recorrido sobre «lo que hay»
 *     lo lee como que no pasa nada.
 *   · `alcance_sellos`    — ¿hay que mirar? El modo de fallo temido es el FALSO NEGATIVO:
 *     un diff que SÍ toca el arnés y el detector deja pasar. El caso real es F-6
 *     (`game/e2e/grandtour/nav.ts`), que NO vive bajo `espejo-tour/`.
 */
import { describe, expect, it } from "vitest";
import { readFileSync, writeFileSync, mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { execFileSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { SELLOS, partesNecesarias, veredicto, cargar } from "../../re/tools/veredicto_sellos.mjs";
import { cierreDeImports, clasifica, analiza, normalizaRango, auditaProcedencia, ENTRADAS, DATOS } from "../../re/tools/alcance_sellos.mjs";
import { procedencia } from "../e2e/espejo-tour/runner";
import { VARIANTES_APERTURA, testigoDeVariante, clasificaConTestigo, aperturaDelFlujo, DESPACHADOR } from "../../re/tools/testigo_variante.mjs";

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

/** Report mínimo con la forma REAL que emite el runner (verificada contra reports en disco). */
function repCon(seg: string, expected: number, got: number | null, extra: Partial<Record<string, unknown>> = {}) {
  return {
    when: "2026-08-02T12:00:00.000Z",
    ledger: { ledgerDeltas: [{ seg, expected, got, match: got === expected, ...(got === null ? { unreadable: true } : {}) }] },
    segments: [{ id: seg, resyncs: [`LEDGER-DELTA txn: esperado ${expected}, obtenido ${got} ✗ (DIVERGENCIA DE PORT en la transacción)`] }],
    ...extra,
  };
}
/** Los cinco en verde, que es la única entrada que debe dar exit 0. */
function todosVerdes() {
  const m = new Map();
  for (const [seg, s] of Object.entries(SELLOS)) m.set(s.parte, repCon(seg, s.esperado, s.esperado));
  return m;
}

/**
 * ★★ EL TESTIGO SINTÉTICO DE LA MAQUINARIA DE `roturaConocida` (EXIT 5).
 *
 * 🔴 POR QUÉ EXISTE, que es lo que impide que alguien lo «simplifique» de vuelta: hasta el
 * 2026-08-05 estos tests se apoyaban en la tabla REAL, porque `ad06-g34` estaba roto de verdad
 * y servía de cobaya. Ese día el sello volvió a pagar y su `roturaConocida` se retiró — y la
 * maquinaria del EXIT 5 se quedó sin ningún caso vivo que la ejercitara.
 *
 * Atar el test a la tabla de producción significaba que **probar el mecanismo exigía mantener
 * una deuda real abierta**: un incentivo perverso (arreglar la deuda rompe su propio test) y un
 * verde que se cae solo el día que alguien hace bien su trabajo. El mecanismo tiene que estar
 * probado SIEMPRE, haya deudas vivas o ninguna.
 * [[el-instrumento-necesita-testigo-propio-no-el-caso-vivo]]
 *
 * El sello es DELIBERADAMENTE inexistente (`zz-sintetico-g01`, parte `zzsint`): si alguien lo
 * ve en un log de producción, es un bug del test, no una deuda.
 */
const SEG_SINT = "zz-sintetico-g01";
const PARTE_SINT = "zzsint";
const ESPERADO_SINT = 100;
const CADUCA_SINT = "2026-08-16";
const SELLOS_CON_DEUDA_SINTETICA = {
  [SEG_SINT]: {
    parte: PARTE_SINT,
    corpus: "ad" as const, // sin el `as const` TS lo infiere `string` y no casa con `Sello`
    esperado: ESPERADO_SINT,
    roturaConocida: {
      got: 0,
      causa: "rotura de LABORATORIO — este sello no existe; sólo ejercita la maquinaria del exit 5",
      ficha: "#SINT",
      caduca: CADUCA_SINT,
    },
  },
};

/** Corre el veredicto SOBRE LA TABLA SINTÉTICA. `got: null` = la parte no corrió. */
function juzgaSintetico(got: number | null, hoy: Date, presente = true) {
  const m = new Map();
  if (presente) m.set(PARTE_SINT, repCon(SEG_SINT, ESPERADO_SINT, got));
  const v = veredicto(m, hoy, SELLOS_CON_DEUDA_SINTETICA);
  return { v, f: v.filas.find((x) => x.seg === SEG_SINT)! };
}

describe("veredicto_sellos — ¿siguen intactos?", () => {
  it("los cinco en verde ⇒ ok, y son EXACTAMENTE cinco filas", () => {
    const v = veredicto(todosVerdes());
    expect(v.ok).toBe(true);
    expect(v.filas).toHaveLength(5);
    expect(v.filas.every((f) => f.estado === "INTACTO")).toBe(true);
  });

  it("★ LA AUSENCIA ES ROJA: una parte que no corrió NO se lee como que no pasa nada", () => {
    const m = todosVerdes();
    m.delete("ad21");
    const v = veredicto(m);
    expect(v.ok).toBe(false);
    const f = v.filas.find((x) => x.seg === "ad21-g26")!;
    expect(f.estado).toBe("SIN-CORRER");
    // …y el rojo NOMBRA lo que falta: un gate que dice «algo falló» no sirve para bisecar.
    expect(f.detalle).toContain("ad21");
  });

  it("★ el sello ROTO se reporta con el got y con el diagnóstico DEL RUNNER, no con el mío", () => {
    const m = todosVerdes();
    m.set("ad09", repCon("ad09-g04", -274, 0)); // determinista: una corrida basta para acusar
    const v = veredicto(m);
    expect(v.ok).toBe(false);
    const f = v.filas.find((x) => x.seg === "ad09-g04")!;
    expect(f.estado).toBe("ROTO");
    expect(f.got).toBe(0);
    expect(f.linea).toContain("DIVERGENCIA DE PORT");
  });

  /**
   * ★★ NINGÚN SELLO SE SALVA REPLICANDO — la premisa que lo permitía está REFUTADA.
   *
   * `91ec3505` trataba `ad06-g34` como estocástico («basta que UNA réplica pague») a partir de
   * una serie de siete corridas que parecía biestable. Las siete eran de SEIS ÁRBOLES
   * distintos: etiquetadas por sha, cada 220 es de un árbol anterior a F-A3 y cada 0 de uno
   * posterior — un escalón monótono, no una lotería. Y `fd6c7f7f` corrido dos veces dio 220 y
   * 220. Así que el criterio vuelve a ser el único honesto: **todas las réplicas pagan, o no**.
   */
  it("★★ una réplica que paga NO salva a las que no: el criterio es TODAS", () => {
    const m = todosVerdes();
    m.set("part04", [repCon("part04-g03", 36, 0), repCon("part04-g03", 36, 0), repCon("part04-g03", 36, 36)]);
    const f = veredicto(m).filas.find((x) => x.seg === "part04-g03")!;
    expect(f.estado).toBe("ROTO");
    expect(f.ok).toBe(false);
    expect(f.replicas).toBe(3);
  });

  /**
   * ★★ LA ROTURA CONOCIDA. `ad06-g34` está roto en main por F-A3, que ya está adjudicado. El
   * esperado NO se re-basa a 0 (eso consagraría el defecto: la puerta se pondría roja el día
   * que lo arreglen), así que el sello es un rojo permanente — y un rojo permanente que no
   * mide nada se aprende a saltar. Lo que lo salva es que TIENE que distinguir tres cosas.
   */
  it("★★ ROTO-CONOCIDO: NO es verde, pero DENTRO DE CADUCIDAD no bloquea el diff", () => {
    // `hoy` INYECTADO: si esto leyera el reloj de pared, el test se pondría rojo solo el
    // 2026-08-17 sin que nadie tocara una línea. Y la TABLA también se inyecta, por lo mismo
    // en el otro eje: si dependiera de la real, se caería al arreglarse la última deuda.
    const { v, f } = juzgaSintetico(0, new Date("2026-08-03T00:00:00Z"));
    expect(f.estado).toBe("ROTO-CONOCIDO");
    expect(f.ok).toBe(false); // NUNCA es un verde: el sello sigue sin pagar
    expect(f.bloquea).toBe(false); // …pero no acusa a ESTE diff
    expect(v.ok).toBe(false);
    expect(v.bloquea).toBe(false); // ⇒ exit 5, no exit 1
    expect(f.detalle).toContain("LABORATORIO"); // la causa, nombrada
    expect(f.detalle).toContain("#SINT"); // y dónde vive la adjudicación
  });

  // ═══ LOS DOS SENTIDOS DEL PELIGRO, que es donde el lead pidió los mutantes ═══
  // Relajar el bloqueo abre un boquete si se relaja de más, y no sirve de nada si se relaja
  // de menos. Estos dos tests fijan los dos filos.

  it("🔴 (a) una ROTURA NUEVA sigue BLOQUEANDO — relajar el conocido no abrió el boquete", () => {
    // El fallo que este cambio podría haber introducido: que un sello CON rotura conocida,
    // dando un valor INESPERADO, se colase por la puerta de «es la conocida» y saliera 5.
    const { v, f } = juzgaSintetico(-40, new Date("2026-08-03T00:00:00Z"));
    expect(f.estado).toBe("ROTO-NUEVO");
    expect(f.bloquea).toBe(true);
    expect(v.bloquea).toBe(true); // ⇒ exit 1. El boquete NO está abierto.
  });

  it("🔴 (b) la rotura conocida con la CADUCIDAD VENCIDA vuelve a BLOQUEAR", () => {
    // Lo que impide que «conocida» se vuelva eterna: pasada la fecha, la deuda vence.
    const { v, f } = juzgaSintetico(0, new Date("2026-09-01T00:00:00Z")); // caduca 2026-08-16
    expect(f.estado).toBe("ROTO-CONOCIDO-CADUCADO");
    expect(f.ok).toBe(false);
    expect(f.bloquea).toBe(true);
    expect(v.bloquea).toBe(true); // ⇒ exit 1
    expect(f.detalle).toContain("VENCIDA");
    expect(f.detalle).toContain("#SINT"); // sigue diciendo dónde se cierra
  });

  it("★ y el conteo de días es el que se imprime: dentro, positivo; vencida, negativo", () => {
    const dentro = juzgaSintetico(0, new Date("2026-08-14T00:00:00Z")).f;
    const fuera = juzgaSintetico(0, new Date("2026-08-20T00:00:00Z")).f;
    expect(dentro.diasCaducidad).toBeGreaterThan(0);
    expect(fuera.diasCaducidad).toBeLessThan(0);
    expect(dentro.detalle).toContain("quedan");
  });

  it("★★ los CINCO intactos siguen siendo el único exit 0 — no bloquear ≠ aprobar", () => {
    const v = veredicto(todosVerdes(), new Date("2026-08-03T00:00:00Z"));
    expect(v.ok).toBe(true);
    expect(v.bloquea).toBe(false);
  });

  it("★★ default DENY: un estado roto SIN `bloquea` declarado bloquea igual", () => {
    // Una fila nueva que alguien añada mañana no puede colarse por omisión.
    const m = todosVerdes();
    m.delete("part04"); // ⇒ SIN-CORRER, que no declara `bloquea`
    const v = veredicto(m, new Date("2026-08-03T00:00:00Z"));
    const f = v.filas.find((x) => x.seg === "part04-g03")!;
    expect(f.estado).toBe("SIN-CORRER");
    expect(f.bloquea).toBe(true);
    expect(v.bloquea).toBe(true);
  });

  it("★★ …y una ROTURA NUEVA ENCIMA no se esconde detrás de la conocida", () => {
    // El fallo temido: un sello con deuda registrada empieza a dar OTRO valor y alguien lo lee
    // como «el rojo de siempre».
    // ⚠ `ROTO-NUEVO` sólo existe POR CONTRASTE con una rotura conocida: sin ella el estado es
    // `ROTO` a secas. Por eso este caso vive en la tabla sintética y no en la real — sobre
    // producción (ya sin deudas) no habría con qué contrastar y el test mediría otra cosa.
    const { f } = juzgaSintetico(-40, new Date("2026-08-03T00:00:00Z"));
    expect(f.estado).toBe("ROTO-NUEVO");
    expect(f.ok).toBe(false);
    expect(f.got).toBe(-40);
    expect(f.detalle).toContain("NUEVA");
  });

  it("★★ …y si el sello VUELVE A PAGAR, la anotación se declara RANCIA en vez de callarse", () => {
    // 🔴 ESTE ES EL CAMINO QUE SE RECORRIÓ DE VERDAD el 2026-08-05 con `ad06-g34`: el sello
    // volvió a pagar 220 y la anotación había que retirarla. Si no lo dijera, la próxima
    // rotura de verdad se leería como «la conocida» y pasaría por la puerta.
    // ⚠ Y aquí está el motivo de que este test NO pueda vivir de la tabla real: aquel día se
    // retiró la ÚLTIMA `roturaConocida` viva, así que sobre producción esta rama ya no tiene
    // ningún sello que la ejercite.
    const { f } = juzgaSintetico(ESPERADO_SINT, new Date("2026-08-03T00:00:00Z"));
    expect(f.estado).toBe("INTACTO");
    expect(f.ok).toBe(true);
    expect(f.detalle).toContain("RETIRA");
  });

  it("★ una AUSENCIA de sello con rotura conocida sigue siendo SIN-CORRER, no ROTO-CONOCIDO", () => {
    // La rotura conocida no puede convertirse en una coartada para no medir.
    const { f } = juzgaSintetico(null, new Date("2026-08-03T00:00:00Z"), false);
    expect(f.estado).toBe("SIN-CORRER");
    expect(f.ok).toBe(false);
  });

  it("un sello DETERMINISTA no se salva por una réplica: las tiene que pagar TODAS", () => {
    const m = todosVerdes();
    m.set("ad21", [repCon("ad21-g26", -1024, -1024), repCon("ad21-g26", -1024, 0)]);
    expect(veredicto(m).filas.find((x) => x.seg === "ad21-g26")!.estado).toBe("ROTO");
  });

  it("★★ PORTERÍA MOVIDA: si el CORPUS cambia el esperado, `match` sería true y NO basta", () => {
    // El report se cree verde (expected 999 === got 999) — es exactamente el verde circular
    // que `match` no puede ver, porque `expected` lo pone el corpus.
    const m = todosVerdes();
    m.set("ad06", repCon("ad06-g34", 999, 999));
    const v = veredicto(m);
    expect(v.ok).toBe(false);
    const f = v.filas.find((x) => x.seg === "ad06-g34")!;
    expect(f.estado).toBe("PORTERIA-MOVIDA");
    expect(f.detalle).toContain("220"); // la constante publicada, para que se vea el desvío
  });

  it("el contador ILEGIBLE no es un verde (got null nunca cuadra con el publicado)", () => {
    const m = todosVerdes();
    m.set("ad09", repCon("ad09-g04", -274, null));
    const v = veredicto(m);
    expect(v.ok).toBe(false);
    expect(v.filas.find((x) => x.seg === "ad09-g04")!.estado).toBe("ROTO");
  });

  it("un delta que el segmento no armó sale AUSENTE, distinto de SIN-CORRER", () => {
    const m = todosVerdes();
    m.set("part04", { when: "2026-08-02T12:00:00.000Z", ledger: { ledgerDeltas: [] }, segments: [] });
    const v = veredicto(m);
    expect(v.filas.find((x) => x.seg === "part04-g03")!.estado).toBe("AUSENTE");
  });

  /**
   * ★ `cargar()` SOBRE DISCO. Los tests de arriba son puros y no lo tocaban: un mutante que
   * hacía que las réplicas se PISARAN (`out.set(parte, [rep])` en vez de apilar) SOBREVIVÍA
   * a los 20. Perderlas en silencio convierte «N corridas» en «la última», y con el criterio
   * determinista eso es justo lo que FABRICA UN VERDE: una réplica roja seguida de una verde
   * se leería como intacta. Se mide con dirs de verdad, y el orden importa (la roja primero).
   */
  it("★ cargar() APILA réplicas de varios dirs, no las pisa — y excluye las rancias", () => {
    const base = mkdtempSync(join(tmpdir(), "u5-sellos-"));
    const dirs = ["r1", "r2"].map((r) => join(base, r));
    for (const d of dirs) mkdirSync(d);
    // dos réplicas de part04 en dirs distintos, una roja y otra que paga. Se usa un sello SIN
    // `roturaConocida` a propósito: lo que se mide aquí es el APILADO, no el modelo de rotura.
    writeFileSync(join(dirs[0]!, "part04.report.json"), JSON.stringify(repCon("part04-g03", 36, 0)));
    writeFileSync(join(dirs[1]!, "part04.report.json"), JSON.stringify(repCon("part04-g03", 36, 36)));
    // y una RANCIA (anterior a la ventana) que no debe contarse
    writeFileSync(join(dirs[0]!, "ad09.report.json"),
      JSON.stringify({ ...repCon("ad09-g04", -274, -274), when: "2020-01-01T00:00:00.000Z" }));

    const { reports, rancios } = cargar(dirs, new Date("2026-08-01T00:00:00Z"));
    expect((reports.get("part04") as unknown[]).length, "las dos réplicas de part04").toBe(2);
    expect(reports.has("ad09"), "la rancia queda EXCLUIDA").toBe(false);
    expect(rancios.join(" ")).toContain("ad09");

    // …y el veredicto usa LAS DOS: si se pisaran, sólo quedaría la verde (`r2`) y esto saldría
    // INTACTO. Que salga ROTO es lo que prueba que la roja no se perdió.
    const f = veredicto(reports).filas.find((x) => x.seg === "part04-g03")!;
    expect(f.replicas).toBe(2);
    expect(f.estado).toBe("ROTO");
    rmSync(base, { recursive: true, force: true });
  });

  /**
   * ★★ LA PROCEDENCIA VIAJA CON EL ARTEFACTO. Este es el defecto de raíz del episodio del
   * 02-08: los reports no llevaban sha, así que una serie de siete corridas de SEIS árboles se
   * leyó como si fueran siete medidas de lo mismo. `writeReport` lo sella ahora en el único
   * punto por el que pasan todos los reports.
   */
  it("★★ writeReport SELLA el sha y el dirty — la procedencia no depende de acordarse", () => {
    const out = mkdtempSync(join(tmpdir(), "u5-proc-"));
    const prev = process.env.ESPEJO_OUT;
    process.env.ESPEJO_OUT = out;
    try {
      const p = procedencia();
      // corremos DENTRO del repo, así que git tiene que saber contestar
      expect(p.sha, "sha del árbol que corre este test").toMatch(/^[0-9a-f]{40}$/);
      expect(typeof p.dirty).toBe("boolean");
    } finally {
      if (prev === undefined) delete process.env.ESPEJO_OUT; else process.env.ESPEJO_OUT = prev;
      rmSync(out, { recursive: true, force: true });
    }
  });

  it("las partes necesarias cubren los cinco sellos y declaran su corpus", () => {
    const p = partesNecesarias();
    expect(p.map((x) => x.parte).sort()).toEqual(["ad06", "ad09", "ad21", "part04", "part05"]);
    expect(p.filter((x) => x.corpus === "ad").map((x) => x.parte).sort()).toEqual(["ad06", "ad09", "ad21"]);
  });

  /**
   * ★★ LAS DOS TABLAS DE CONSTANTES NO PUEDEN DIVERGIR. `agrega_espejo_ventana.mjs` ya
   * publicaba los cinco valores; la mía los duplica porque aquel fichero es un script que
   * EJECUTA `main()` al importarse. Duplicar constantes es exactamente como se separan en
   * silencio, así que aquí se leen las DOS del fuente y se exige que digan lo mismo.
   */
  it("★★ los cinco valores publicados coinciden con los de agrega_espejo_ventana.mjs", () => {
    const src = readFileSync(join(RAIZ, "re/tools/agrega_espejo_ventana.mjs"), "utf8");
    const bloque = src.match(/const VERDES = \{([\s\S]*?)\};/);
    expect(bloque, "no encontré `const VERDES` en agrega_espejo_ventana.mjs").toBeTruthy();
    const suyos: Record<string, number> = {};
    for (const m of (bloque?.[1] ?? "").matchAll(/"([^"]+)":\s*(-?\d+)/g)) suyos[m[1]!] = Number(m[2]);
    const mios = Object.fromEntries(Object.entries(SELLOS).map(([k, v]) => [k, v.esperado]));
    expect(suyos).toEqual(mios);
  });
});

/**
 * ★★ EL TESTIGO DE LA VARIANTE. Una puerta que sólo mira el importe se pone roja cada vez que
 * alguien desplaza el stream del `rand(0,3)` del herrero —cosa que hace CUALQUIER fix que mueva
 * una posición— y quien la ve lee «he roto el ledger». Ese falso positivo, repetido, desconecta
 * la puerta. El testigo separa las tres cosas que el importe solo confunde.
 */
describe("testigo_variante — ¿qué prompt sacó el herrero?", () => {
  const CORPUS = [
    "Thou art in the Blacksmith's shoppe.",
    "Show me what ye got...",
    "Arms",
  ];

  it("★ reconoce la variante aunque el OCR coma puntuación y parta la línea", () => {
    // El prompt real llega partido por el ancho de la ventana y con la puntuación comida.
    const t = testigoDeVariante(["Show me what", "ye got"])!;
    expect(t.indice).toBe(2);
  });

  it("★ distingue las dos que empiezan igual («What dost thou …»)", () => {
    expect(testigoDeVariante(["What dost thou wish to sell?"])!.indice).toBe(1);
    expect(testigoDeVariante(["What dost thou have for me to buy?"])!.indice).toBe(3);
  });

  it("sin prompt de tienda no inventa variante", () => {
    expect(testigoDeVariante(["The party marches on.", ""])).toBeNull();
  });

  it("★ dos variantes en el mismo segmento NO se resuelven a la primera", () => {
    const t = testigoDeVariante(["What dost thou wish to sell?", "Show me what ye got..."])!;
    expect(t.indice).toBe(-1);
    expect(t.ambiguas).toEqual([1, 2]);
  });

  it("★★ importe ✗ + variante DISTINTA no es «sello roto», es NO-DETERMINISTA", () => {
    const c = clasificaConTestigo({ pagaImporte: false, variante: testigoDeVariante(CORPUS), esperada: 0 });
    expect(c.clase).toBe("NO-DETERMINISTA");
    expect(c.porque).toContain("STREAM");
  });

  it("★★ importe ✗ + MISMA variante SÍ acusa: es el único rojo que culpa al port", () => {
    const c = clasificaConTestigo({ pagaImporte: false, variante: testigoDeVariante(CORPUS), esperada: 2 });
    expect(c.clase).toBe("ROTO-DE-VERDAD");
  });

  it("★ importe ✓ con la variante cambiada es VERDE POR SUERTE, no verde robusto", () => {
    const c = clasificaConTestigo({ pagaImporte: true, variante: testigoDeVariante(CORPUS), esperada: 0 });
    expect(c.clase).toBe("VERDE-POR-SUERTE");
  });

  it("importe ✓ + misma variante = VERDE ROBUSTO", () => {
    const c = clasificaConTestigo({ pagaImporte: true, variante: testigoDeVariante(CORPUS), esperada: 2 });
    expect(c.clase).toBe("VERDE-ROBUSTO");
  });

  /**
   * ★★ SIN REFERENCIA MEDIDA, EL TESTIGO INFORMA PERO NO ADJUDICA. Nadie ha medido todavía bajo
   * qué variante quedó registrado el sello, y elegir una por defecto (p. ej. «la 0, que es la
   * primera de la tabla») fabricaría el veredicto que la puerta existe para dar.
   */
  it("★★ sin variante de referencia NO clasifica: sale SIN-REFERENCIA", () => {
    const c = clasificaConTestigo({ pagaImporte: false, variante: testigoDeVariante(CORPUS), esperada: null });
    expect(c.clase).toBe("SIN-REFERENCIA");
    expect(c.porque).toContain("NADIE");
  });

  it("sin transcript volcado se dice que no hay testigo, no se supone uno", () => {
    expect(clasificaConTestigo({ pagaImporte: true, variante: null, esperada: 2 }).clase).toBe("SIN-TESTIGO");
  });

  /**
   * ★★ EL OBSERVABLE DEL BRAZO ROJO. La variante NO existe cuando el sello está roto (medido:
   * el transcript de `ad06` en main no trae ninguna de las cuatro en ninguno de sus 35
   * segmentos, porque la sesión se cierra en el despachador antes de entrar a la venta). Así
   * que el discriminante del rojo no puede ser la variante: es si la VENTA llegó a abrirse.
   */
  it("★★ tienda abierta y venta NO ⇒ SOLO-TIENDA: la avería es del FLUJO, no del importe", () => {
    // Exactamente lo que emite el port en main sobre ad06-g34 (medido, no inventado).
    const a = aperturaDelFlujo([
      'Greetings, traveller! Wish ye to Buy, or hast thou wares to Sell?" ',
      '"Be off with ye, then..."',
    ]);
    expect(a.estado).toBe("SOLO-TIENDA");
    // …y el porqué nombra LAS DOS averías para que no se confundan: flujo vs importe.
    expect(a.porque).toContain("flujo");
    expect(a.porque).toContain("no en el importe");
  });

  it("★ si sale un prompt de apertura, la venta SÍ se abrió", () => {
    expect(aperturaDelFlujo([
      'Greetings, traveller! Wish ye to Buy, or hast thou wares to Sell?" ',
      "Show me what ye got...",
    ]).estado).toBe("VENTA-ABIERTA");
  });

  it("★ sin despachador no se confunde «no hubo tienda» con «no hubo venta»", () => {
    expect(aperturaDelFlujo(["The party marches on."]).estado).toBe("SIN-TIENDA");
  });

  it("★★ el despachador coincide con `blacksmithAsk2` del port", () => {
    const src = readFileSync(join(RAIZ, "game/src/core/world/cmd-strings.ts"), "utf8");
    expect(src).toContain(DESPACHADOR);
  });

  /**
   * ★★ LAS CUATRO VARIANTES ESTÁN DUPLICADAS DESDE EL PORT y así es como se separan en
   * silencio. Se leen del fuente de `shoppe-greetings.ts` y se exige que digan lo mismo.
   */
  it("★★ las cuatro variantes coinciden con BLACKSMITH_SELL_PROMPTS del port", () => {
    const src = readFileSync(join(RAIZ, "game/src/core/shops/shoppe-greetings.ts"), "utf8");
    const bloque = src.match(/BLACKSMITH_SELL_PROMPTS = \[([\s\S]*?)\] as const;/);
    expect(bloque, "no encontré BLACKSMITH_SELL_PROMPTS en shoppe-greetings.ts").toBeTruthy();
    const suyas = [...(bloque?.[1] ?? "").matchAll(/"([^"]+)"/g)].map((m) => m[1]);
    expect(suyas).toEqual([...VARIANTES_APERTURA]);
  });
});

describe("alcance_sellos — ¿hay que mirar?", () => {
  const cierre = cierreDeImports(RAIZ, ENTRADAS).ficheros;

  it("★★ EL FALSO NEGATIVO QUE IMPORTA: F-6 tocó grandtour/nav.ts y TIENE que caer dentro", () => {
    // `runner.ts` lo importa (`from "../grandtour/nav"`), así que el cierre lo alcanza aunque
    // no viva bajo `espejo-tour/`. Una lista de rutas escrita a mano lo habría dejado pasar.
    expect(cierre.has("game/e2e/grandtour/nav.ts")).toBe(true);
    const c = clasifica("game/e2e/grandtour/nav.ts", { cierre, soloArnes: true });
    expect(c?.tramo).toBe("T1 ARNÉS-CÓDIGO");
  });

  it("el cierre alcanza el RELOJ y las tácticas, que son los otros dos vehículos del riesgo", () => {
    expect(cierre.has("game/src/core/time.ts")).toBe(true);
    expect(cierre.has("game/e2e/grandtour/nav-tactics.ts")).toBe(true);
  });

  it("★ el cierre DISCRIMINA: no se traga game/src entero", () => {
    const deSrc = [...cierre].filter((f) => f.startsWith("game/src/"));
    expect(deSrc.length).toBeGreaterThan(10);
    expect(deSrc.length).toBeLessThan(60); // hoy 23 sobre 233 ficheros de src/
  });

  it("los DATOS del guion entran por T2 (ningún cierre de imports los ve)", () => {
    for (const f of [
      "game/e2e/espejo-tour/routes-ad/ad09.route.json",
      "game/e2e/espejo-tour/routes-ad/overlays/ad09.json",
      "game/e2e/espejo-tour/saves/ad06.gam",
      "game/e2e/espejo-tour/routes/part04.route.json",
    ]) {
      expect(clasifica(f, { cierre, soloArnes: true })?.tramo, f).toBe("T2 ARNÉS-DATOS");
    }
    // y cada glob declara POR QUÉ está: sin justificación sería una lista a ojo
    expect(DATOS.every((d) => d.porque.length > 20)).toBe(true);
  });

  it("actas, docs y tests unitarios quedan FUERA", () => {
    for (const f of ["re/notes/beats-combate-acta.md", "docs/publicacion/re-notes-EXCLUIDAS.txt",
                     "game/tests/espejo-anchors.test.ts", "game/tools/deploy-artifacts.ts"]) {
      expect(clasifica(f, { cierre, soloArnes: false }), f).toBeNull();
    }
  });

  it("★ el PORT es T3 y `--solo-arnes` lo excluye — la elección queda escrita, no en un default", () => {
    const f = "game/src/skin/portrait/deck-ancho.ts";
    expect(clasifica(f, { cierre, soloArnes: false })?.tramo).toBe("T3 PORT");
    expect(clasifica(f, { cierre, soloArnes: true })).toBeNull();
  });

  it("analiza() reparte dentro/fuera sobre una lista mezclada", () => {
    const r = analiza(RAIZ, [
      "game/e2e/grandtour/nav.ts",
      "game/e2e/espejo-tour/routes-ad/ad09.route.json",
      "re/notes/x.md",
    ], { soloArnes: true });
    expect(r.dentro.map((d) => d.fichero).sort()).toEqual([
      "game/e2e/espejo-tour/routes-ad/ad09.route.json",
      "game/e2e/grandtour/nav.ts",
    ]);
    expect(r.fuera).toEqual(["re/notes/x.md"]);
  });

  /**
   * ★★ EL RANGO DE DOS PUNTOS CONTESTA A OTRA PREGUNTA — y una de sus dos formas de fallar es
   * justo el FALSO NEGATIVO contra el que se pidió blindar este predicado.
   *
   * Medido sobre esta misma rama: `--rango main..HEAD` devolvía 26 ficheros e imputaba cinco
   * `game/src/skin/portrait/**` del carril de UI (falso positivo, y la cifra cambia sola según
   * se mueva main). Con tres puntos: 7 ficheros y UNO en alcance. Y al revés — si mi rama toca
   * un fichero que main dejó IGUAL, el diff de dos puntos NO lo enseña y el detector lo deja
   * pasar, que es el mutante que este carril tenía encargo de matar.
   */
  it("★★ un rango de DOS puntos se normaliza a merge-base y lo DICE", () => {
    const n = normalizaRango("main..HEAD");
    expect(n.rango).toBe("main...HEAD");
    expect(n.aviso).toContain("falso negativo");
  });

  /**
   * ★★ LA MISMA TRAMPA POR LA OTRA PUERTA. `normalizaRango` protegía `--rango`; `--stdin` y
   * `--ficheros` no pasaban por NADA, y es por ahí por donde entró el error de verdad — dos
   * personas distintas el mismo día (2026-08-06): una clasificó 28 ficheros cuando los suyos
   * eran 4, y otra comparó dos corridas separadas por 18. Cuando el mismo error lo cometen
   * dos sujetos en una jornada, el sospechoso es la herramienta.
   *
   * El testigo es lo que le faltaba a la guarda para ser una puerta: sin él sería una
   * comprobación que nunca se pone roja, y ya sabemos lo que vale eso.
   */
  it("★★ la guarda de PROCEDENCIA caza una lista que no viene de merge-base, y CALLA con una que sí", () => {
    const repo = mkdtempSync(join(tmpdir(), "proc-"));
    const git = (...a: string[]) => execFileSync("git", ["-C", repo, ...a], { encoding: "utf8" });
    git("init", "-q", "-b", "main");
    git("config", "user.email", "t@t"); git("config", "user.name", "t");
    writeFileSync(join(repo, "base.txt"), "0"); git("add", "-A"); git("commit", "-qm", "base");
    // main avanza por su cuenta (otro carril)
    writeFileSync(join(repo, "de-main.txt"), "1"); git("add", "-A"); git("commit", "-qm", "main");
    // y mi rama sale de ANTES de eso y toca lo suyo
    git("checkout", "-q", "-b", "mia", "HEAD~1");
    writeFileSync(join(repo, "mio.txt"), "2"); git("add", "-A"); git("commit", "-qm", "mio");

    // CONTROL POSITIVO: la lista de `git diff main` mete el fichero AJENO ⇒ tiene que cazarlo.
    const mal = auditaProcedencia(repo, ["mio.txt", "de-main.txt"], "main");
    expect(mal.comprobable).toBe(true);
    expect(mal.ajenos).toEqual(["de-main.txt"]);

    // CONTROL NEGATIVO: la lista buena no dispara nada. Sin esto, una guarda que gritara
    // SIEMPRE pasaría el test de arriba y sería igual de inútil.
    expect(auditaProcedencia(repo, ["mio.txt"], "main").ajenos).toEqual([]);

    rmSync(repo, { recursive: true, force: true });
  });

  it("★ un rango que YA es de tres puntos se respeta y no avisa de nada", () => {
    const n = normalizaRango("main...HEAD");
    expect(n.rango).toBe("main...HEAD");
    expect(n.aviso).toBeNull();
  });

  it("★ un rango sin `..` (un sha suelto) se deja intacto", () => {
    const n = normalizaRango("c5724c68");
    expect(n.rango).toBe("c5724c68");
    expect(n.aviso).toBeNull();
  });

  it("el escáner no deja especificadores relativos sin resolver (agujeros declarados = 0 hoy)", () => {
    expect(cierreDeImports(RAIZ, ENTRADAS).sinResolver).toEqual([]);
  });
});
