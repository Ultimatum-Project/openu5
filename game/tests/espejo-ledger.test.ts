/**
 * WALKTHROUGH-ESPEJO — CAPACIDAD DEL LEDGER (carril E-2).
 *
 * Estos tests miden el INSTRUMENTO, no la población: lo que se comprueba aquí es qué puede
 * ENTRAR al ledger, no que ninguna ruta lo use todavía. La población de rutas (peajes de AD,
 * ~397 compras/ventas) está deliberadamente vacía por el AVISO DE ORDEN de
 * `re/notes/espejo-ledger-ad.md` §4: poner los deltas antes de conectar las conversaciones
 * produce un ledger de ceros que no distingue «el port cobró mal» de «la tienda no abrió».
 *
 * CANDADO DE NO-REGRESIÓN: los dos deltas VERDES de LP1 (+36 venta de part04, −954 gemas del
 * guild de part05) se fijan LEYENDO LAS RUTAS COMMITEADAS, no copiando sus literales aquí:
 * si alguien mueve el overlay, el candado cae con él en vez de dar un verde de museo.
 */
import { describe, it, expect } from "vitest";
import {
  diffSegment,
  anchorIsShop,
  ledgerArm,
  ledgerDeltaResult,
  listParts,
  loadRoute,
  strSeedTargets,
  exitResyncVerdict,
  UNDERWORLD_FLOOR as RUNNER_UNDERWORLD_FLOOR,
  ROUTES_AD_DIR,
  SNIPPET_MAX_CHARS,
  type Op,
  type Segment,
  countedDigits,
  literalSpan,
  blockPatternFor,
} from "../e2e/espejo-tour/runner";
import { AD_PROFILE, collapseWith } from "../e2e/espejo-tour/ocr-profile";
import { describeCorpusReal, ROUTES_SINT_DIR } from "./espejo-corpus";
import { trollToll } from "../src/core/world/loops/hazards";
import { UNDERWORLD_FLOOR as CORE_UNDERWORLD_FLOOR } from "../src/debug/debugApi";

/** Todos los ops del guion de una parte, con su segmento (para citar el fallo). */
function opsOf(part: string, dir?: string): Array<{ seg: string; op: Op }> {
  return loadRoute(part, dir).segments.flatMap((s) => s.script.map((op) => ({ seg: s.id, op })));
}

/**
 * ── QUÉ CORRE DÓNDE EN ESTE FICHERO (ver `tests/espejo-corpus.ts`) ───────────────────────
 * 41 de los 48 bloques de aquí son FUNCIONES PURAS conducidas con literales: no abren ningún
 * corpus y por tanto viajan al público tal cual. Los 7 que sí lo abren son los CANDADOS —
 * los dos deltas verdes de LP1, la lista de once armados de AD, los 16 del Underworld, la
 * cuarentena— y son CENSOS por identidad del corpus real: sobre un corpus que escribiéramos
 * nosotros serían tautológicos, así que se quedan con su sujeto bajo `describeCorpusReal`.
 * El único que se mueve al sintético es el CONTROL POSITIVO del censo de costuras, que no
 * afirma ninguna cifra: sólo que el camino esté ejercitado.
 *
 * 🔴 Ninguna lectura de corpus fuera del callback de un `it` (ni siquiera dentro de un
 * `describeCorpusReal`: `describe.skip` ejecuta su cuerpo al recolectar).
 */
describe("ledgerArm — armado del ledger por op (funciones puras)", () => {
  it("un ancla de NPC SIN expectDelta no arma nada (resincroniza, no mide)", () => {
    expect(ledgerArm({ anchor: { kind: "npc", cmd: "talk", match: "shop:InnKeeper" } })).toBeNull();
  });

  it("un ancla de CARA nunca arma el ledger (mira un tile; no hay transacción)", () => {
    expect(ledgerArm({ anchor: { kind: "face", cmd: "l", dir: "north", sees: "a hot stove", tileIds: [1] } })).toBeNull();
  });

  it("un op sin ancla ni expectDelta no arma nada", () => {
    expect(ledgerArm({ key: "y" })).toBeNull();
  });
});

describeCorpusReal("ledgerArm — CANDADOS de población sobre el corpus REAL", () => {
  it("CANDADO LP1: las DOS transacciones ancladas de part04/part05 arman el oro con su delta", () => {
    const armed = [...opsOf("part04"), ...opsOf("part05")]
      .map(({ seg, op }) => ({ seg, arm: ledgerArm(op) }))
      .filter((x) => x.arm !== null);
    expect(armed).toEqual([
      { seg: "part04-g03", arm: { gold: 36, keys: null, gems: null } }, // venta de 3 Leather Helm a Gwenneth
      { seg: "part05-g05", arm: { gold: -954, keys: null, gems: null } }, // 3 gemas a 318 en el guild de New Magincia
    ]);
  });

  // ⚠ TÍTULO CORREGIDO (25-08): decía «13 y 11 ops» y el cuerpo asierta 13 y **18** desde la
  // recalibración de #43 — las 7 ops con `src: "overlay-timing"` de `part05-g05` pasaron a
  // contarse dentro de la familia `overlay*` (11 + 7 = 18). El cuerpo es el que mide, así que
  // manda el cuerpo; el título llevaba la cifra PRE-#43 y se leía como una discrepancia del
  // corpus. [[el-comentario-que-delega-o-resume-no-tiene-quien-lo-caree]]
  it("CANDADO LP1: las ráfagas de arnés de esos dos segmentos siguen siendo 13 y 18 ops", () => {
    // El resto de la ráfaga (seeds + teclas) NO arma nada; si alguien la reescribe, este
    // conteo cae y obliga a re-mirar el candado de arriba en vez de arrastrarlo.
    // #43: el conteo cuenta la familia `overlay*` ENTERA, no `"overlay"` exacto. part05-g05
    // llevaba 7 ops con `src: "overlay-timing"` —etiqueta sin productor en el repo, interleadas a
    // mano— que ahora viven dentro de su bloque `insertOps` y salen como `"overlay"`. La ráfaga
    // TOTAL no se movió (18 antes y 18 ahora); lo que cambió es la etiqueta. Contarla entera es
    // lo que impide que un re-etiquetado vuelva a mover este candado sin mover una sola tecla.
    const burst = (part: string, seg: string): number =>
      opsOf(part).filter((x) => x.seg === seg && String(x.op.src ?? "").startsWith("overlay")).length;
    expect(burst("part04", "part04-g03")).toBe(13);
    expect(burst("part05", "part05-g05")).toBe(18);
  });

  it("ningún OTRO op de LP1 arma el ledger (la población es de DOS, no más)", () => {
    const total = listParts()
      .flatMap((p) => opsOf(p))
      .filter(({ op }) => ledgerArm(op) !== null).length;
    expect(total).toBe(2);
  });

  it("el corpus AD arma ONCE, y son EXACTAMENTE los pre-registrados (F3b + teclas-ad09 + poblar-deltas)", () => {
    // ★ Este candado decía `toBe(0)` con la nota «existe para que el día que alguien pueble AD
    // tenga que venir aquí a cambiarlo». Ese día fue F3b: el orden que exigía
    // espejo-ledger-ad.md §4 (conectar conversaciones → seedInt → deltas) está CUMPLIDO —
    // el INT de Diener está triangulado (17→20→24) y el ancla de gremio de ad21-g26 engancha
    // (`shopOpen✓`), que es lo que hace medible el único delta con signo del corpus.
    //
    // No se relaja a «>= 0»: se sustituye un cardinal por la LISTA. Un conteo cuadra por
    // casualidad; una lista no, y cualquier población NUEVA sigue teniendo que pasar por aquí.
    const armados = listParts(ROUTES_AD_DIR)
      .flatMap((p) => opsOf(p, ROUTES_AD_DIR))
      .filter(({ op }) => ledgerArm(op) !== null);
    // ★ RE-CALIBRADO CON MOTIVO (carril `teclas-ad09`): entra `ad09-g04` con −274 (herrero de
    // Bordermarch, ocrLn 370). ⚠ Su delta NO se mide todavía en vivo: el segmento es
    // `ctx: overworld` y el ancla de NPC se abstiene con `skip` — ver `teclas-ad09-acta.md`.
    // Se puebla igual porque el ESPERADO está derivado del binario y es correcto; lo que falta
    // es el arnés de costura interna, no la cifra.
    // ★ RE-CALIBRADO CON MOTIVO (carril `poblar-deltas`): entran las TRES ventas `smallmap`
    // — `ad03-g11` (+3, Trinsic), `ad04-g08` (+58, Minoc) y `ad06-g34` (+220, Minoc). A
    // diferencia de `ad09-g04`, estos tres SÍ los mide el runner en vivo: llevan `enter.loc` y
    // el ancla de NPC no se abstiene. Derivación en `re/notes/poblar-deltas-acta.md`.
    expect(armados.map((x) => x.seg).sort()).toEqual([
      "ad01-g04", "ad01-g07", "ad03-g11", "ad04-g08", "ad04-g10", "ad04-g17", "ad05-g03",
      "ad06-g34", "ad08-g19", "ad09-g04", "ad21-g26",
    ]);
    // SEIS de los ONCE asertan CERO: el LP RECHAZÓ esos beats (peajes no pagados, astillero y
    // gremio declinados). Los CINCO con signo son `ad21-g26` (−1024), `ad09-g04` (−274),
    // `ad03-g11` (+3), `ad04-g08` (+58) y `ad06-g34` (+220) — los tres últimos, VENTAS: el
    // primer signo POSITIVO del corpus AD. Poblar «el importe del OCR» en los rechazados habría
    // fabricado transacciones que nunca ocurrieron — ver espejo-final-f3b-acta.md §1.
    const ceros = armados.filter(({ op }) => {
      const a = ledgerArm(op)!;
      return a.gold === 0 && (a.keys ?? 0) === 0 && (a.gems ?? 0) === 0;
    });
    expect(ceros).toHaveLength(6);
  });
});

describe("ledgerArm — DESACOPLE del ancla de NPC (peajes y tributos)", () => {
  // El peaje de troll es un disparo de TERRENO (pisar un puente): no hay NPC al que anclar,
  // así que con el armado colgado del ancla no podía entrar al ledger jamás. Los importes
  // son los del corpus AD: 39 gp en ad01/ad04 y 36 gp en ad05.
  it("un op con expectDelta SUELTO arma el oro sin ancla ninguna", () => {
    expect(ledgerArm({ expectDelta: -39 })).toEqual({ gold: -39, keys: null, gems: null });
  });

  it("expectDelta 0 ARMA — «esta transacción no movió el oro» es una aserción, no un no-armar", () => {
    // Distinción que sostiene todo el instrumento: armar con 0 mide el RECHAZO del peaje
    // (los 4 del corpus AD acaban en `N` → delta 0); no armar es no medir nada.
    expect(ledgerArm({ expectDelta: 0 })).toEqual({ gold: 0, keys: null, gems: null });
  });

  it("el expectDelta del OP manda sobre el del ancla (el op es la forma más específica)", () => {
    const op: Op = { expectDelta: -39, anchor: { kind: "npc", cmd: "buy", match: "d130", expectDelta: 5 } };
    expect(ledgerArm(op)).toEqual({ gold: -39, keys: null, gems: null });
  });

  it("el ancla de NPC sigue armando cuando el op no trae expectDelta (las dos verdes de LP1)", () => {
    expect(ledgerArm({ anchor: { kind: "npc", cmd: "buy", match: "shop:GuildMaster", expectDelta: -954 } })).toEqual({ gold: -954, keys: null, gems: null });
  });
});

describe("ledgerDeltaResult — comparación del delta", () => {
  it("delta EXACTO = match (los dos verdes de LP1)", () => {
    expect(ledgerDeltaResult(2000, 1046, -954)).toEqual({ expected: -954, got: -954, match: true });
    expect(ledgerDeltaResult(150, 186, 36)).toEqual({ expected: 36, got: 36, match: true });
  });
  it("delta distinto = divergencia del port, con el obtenido a la vista", () => {
    expect(ledgerDeltaResult(2000, 1000, -954)).toEqual({ expected: -954, got: -1000, match: false });
  });

  it("contador NO LEGIBLE ≠ contador a cero: got null, sin match y DECLARADO", () => {
    // El arnés lee `s.keys ?? null`. Si un build sin ese campo devuelve null, la resta daría
    // NaN (o, con un `?? 0` complaciente, un 0 que MATCHEA un delta esperado de 0 y firma un
    // verde que no se ha medido). Un contador ilegible tiene que salir como ilegible.
    expect(ledgerDeltaResult(null, 3, 2)).toEqual({ expected: 2, got: null, match: false, unreadable: true });
    expect(ledgerDeltaResult(3, null, 2)).toEqual({ expected: 2, got: null, match: false, unreadable: true });
    expect(ledgerDeltaResult(null, null, 0)).toEqual({ expected: 0, got: null, match: false, unreadable: true });
  });
});

describe("ledgerArm — LLAVES y GEMAS (los dos contadores que se leían y nunca se comparaban)", () => {
  it("expectKeysDelta arma las llaves", () => {
    expect(ledgerArm({ expectKeysDelta: -1 })).toEqual({ gold: null, keys: -1, gems: null });
  });

  it("expectGemsDelta arma las gemas", () => {
    // +3 gemas es la contraparte EN ESPECIE de las -954 monedas del guild de New Magincia:
    // el oro medía la mitad de la transacción y la otra mitad no se miraba.
    expect(ledgerArm({ expectGemsDelta: 3 })).toEqual({ gold: null, keys: null, gems: 3 });
  });

  it("los tres contadores conviven en un mismo op", () => {
    expect(ledgerArm({ expectDelta: -954, expectGemsDelta: 3, expectKeysDelta: 0 })).toEqual({ gold: -954, keys: 0, gems: 3 });
  });

  it("las llaves/gemas también cuelgan de un op CON ancla (una tienda vende en especie)", () => {
    const op: Op = { expectGemsDelta: 3, anchor: { kind: "npc", cmd: "buy", match: "shop:GuildMaster", expectDelta: -954 } };
    expect(ledgerArm(op)).toEqual({ gold: -954, keys: null, gems: 3 });
  });
});

describe("strSeedTargets — a quién siembra la STR el arnés del peaje", () => {
  // El importe del peaje del troll es 99 − 3·STR, y ese STR es el del PRIMER MIEMBRO
  // CONSCIENTE ('G'/'P'), no el del avatar ni el del que falla la tirada de DEX (la
  // derivación vive en core/world/loops/hazards.ts). El arnés siembra a TODOS los
  // conscientes precisamente para no tener que replicar aquí esa selección.
  const g = (status: string) => ({ status });

  it("party sana: siembra a los tres", () => {
    expect(strSeedTargets([g("G"), g("G"), g("G")], 3)).toEqual([0, 1, 2]);
  });

  it("★ con el avatar MUERTO el objetivo NO es characters[0] — sembrar como seedInt fallaría", () => {
    // Éste es el caso que hace que seedStr no pueda copiar a seedInt: con el avatar 'D' el
    // port cobra por el STR del miembro 1, así que sembrar sólo el 0 dejaría el importe al
    // valor de la plantilla y el peaje seguiría siendo incomparable.
    expect(strSeedTargets([g("D"), g("G"), g("G")], 3)).toEqual([1, 2]);
  });

  it("los dormidos ('S') tampoco cuentan", () => {
    expect(strSeedTargets([g("S"), g("P"), g("D")], 3)).toEqual([1]);
  });

  it("no mira más allá de partySize ni de los 6 slots", () => {
    expect(strSeedTargets([g("G"), g("G"), g("G")], 1)).toEqual([0]);
    expect(strSeedTargets(Array(9).fill(g("G")), 9)).toEqual([0, 1, 2, 3, 4, 5]);
  });

  it("party entera inconsciente: no hay a quién sembrar, y se dice (lista vacía)", () => {
    expect(strSeedTargets([g("D"), g("S")], 2)).toEqual([]);
  });

  it("CONTROL contra el port: sembrada la STR de los 4 peajes de AD salen sus importes", () => {
    // No es un literal mío: es la fórmula del port. 39 gp ⇒ STR 20 (ad01/ad04, tres beats);
    // 36 gp ⇒ STR 21 (ad05). Si el port cambiara la fórmula, este control cae con ella.
    expect(trollToll(20)).toBe(39);
    expect(trollToll(21)).toBe(36);
  });
});

describe("snippet del bloque divergente — DESTRUNCADO (defecto de métrica declarado)", () => {
  // `corrida-ad-resultado.md` §4.4 declaró que el 18 % de SEARCH_CONTAIN en AD era un defecto
  // de la propia métrica: la frase de rechazo de la familia («nothing of note.») caía FUERA de
  // la ventana del snippet, así que la columna del BLOQUE quedaba sesgada A LA BAJA para las
  // familias de desenlace largo. Medido aquí: la ventana se agotaba por NÚMERO DE LÍNEAS (3
  // tras la mejor), no por el corte de caracteres — el snippet ocupaba 47 de los 160 chars.
  const seg = (text: string): Segment => ({
    id: "t-g01",
    ctx: "smallmap",
    seam: null,
    ocr: { from: 1, to: 99 },
    script: [],
    expect: [{ text, ocrLn: 1, class: "auto" }],
  });
  const PORT = [
    "Search-East",
    "Thou dost find",
    "a spiked pit trap",
    "and the party",
    "leaps aside just",
    "in time, finding",
    "nothing of note.",
  ];

  it("el desenlace largo ENTRA en el snippet (la familia de rechazo ya es visible)", () => {
    const r = diffSegment(seg("Search-East Thou dost find a locked oaken chest full of gold"), PORT);
    expect(r.blocks[0]!.verdict).toBe("divergent");
    expect(r.blocks[0]!.snippet).toContain("nothing of note.");
  });

  it("la ventana sigue ACOTADA: no se vuelca el transcript entero en cada bloque", () => {
    const largo = Array.from({ length: 60 }, (_, i) => `linea de relleno numero ${i}`);
    const r = diffSegment(seg("Search-East Thou dost find a locked oaken chest full of gold"), [...PORT, ...largo]);
    expect(r.blocks[0]!.snippet!.length).toBeLessThanOrEqual(SNIPPET_MAX_CHARS);
    expect(SNIPPET_MAX_CHARS).toBeLessThanOrEqual(600); // cota declarada, no «lo que salga»
  });
});

describe("resync de SALIDA al mapa grande — la capa (Britannia vs Underworld)", () => {
  // Britannia y el Underworld son la MISMA location (0) y se distinguen sólo por `floor`
  // (0xFF = Underworld). La guarda de éxito del resync de salida sólo mira la location, así
  // que por construcción NO PUEDE ver un depósito en la capa equivocada.
  const BRITANNIA = 0;
  const UNDERWORLD = 0xff;

  it("CANDADO: la constante de capa del arnés no puede derivar de la del core", () => {
    // El literal 0xFF vive en dos sitios (la fachada de debug y este arnés). Que la
    // fachada deposita en Britannia con dos argumentos y en el Underworld con tres ya lo
    // prueba `debug-api.test.ts`; lo que no estaba atado es que las dos constantes sigan
    // siendo la misma, que es de lo que depende toda la discriminación de capa.
    expect(UNDERWORLD).toBe(CORE_UNDERWORLD_FLOOR);
    expect(RUNNER_UNDERWORLD_FLOOR).toBe(CORE_UNDERWORLD_FLOOR);
  });

  it("la party fuera del mapa grande sigue siendo RESYNC-FAIL", () => {
    const v = exitResyncVerdict({ location: 7, floor: 0 }, false);
    expect(v.ok).toBe(false);
    expect(v.reason).toContain("location=7");
  });

  it("★ la guarda DISCRIMINA la capa: caer en el mapa grande equivocado es RESYNC-FAIL", () => {
    // Los dos casos que el defecto produce. Antes del fix la guarda firmaba los dos como
    // buenos porque sólo miraba la location, y Britannia y el Underworld son los dos 0.
    const aBritannia = exitResyncVerdict({ location: 0, floor: UNDERWORLD }, false);
    expect(aBritannia.ok).toBe(false);
    expect(aBritannia.reason).toContain("Underworld");

    const alUnderworld = exitResyncVerdict({ location: 0, floor: BRITANNIA }, true);
    expect(alUnderworld.ok).toBe(false);
    expect(alUnderworld.reason).toContain("Britannia");
  });

  it("la capa CORRECTA sigue siendo verde en las dos direcciones", () => {
    expect(exitResyncVerdict({ location: 0, floor: BRITANNIA }, false).ok).toBe(true);
    expect(exitResyncVerdict({ location: 0, floor: UNDERWORLD }, true).ok).toBe(true);
  });
});

/** Las costuras de mapa grande de un corpus. Función (no constante): no lee nada hasta que la
 *  llama un `it`. */
const seams = (dir?: string) =>
  listParts(dir)
    .flatMap((p) => loadRoute(p, dir).segments)
    .filter((s) => s.enter?.overworld);

describe("costura overworld — el camino existe y declara su CAPA (corpus sintético)", () => {
  // CONTROL POSITIVO del censo, instanciado sobre el corpus que viaja: sin costuras
  // `enter.overworld` en el corpus, los filtros por capa de abajo (y los del propio runner)
  // barrerían un conjunto vacío y quedarían verdes sin haber discriminado nada.
  it("hay costuras de overworld que ejercitan este camino (control positivo del censo)", () => {
    const ov = seams(ROUTES_SINT_DIR);
    expect(ov.length, "el corpus sintético no trae NI UNA costura `enter.overworld`").toBeGreaterThan(0);
    // Y las DOS capas están instanciadas: sin una costura marcada `underworld` el filtro por
    // capa nunca se ejerce, que es exactamente el agujero que el fix de capa cerró.
    const under = ov.filter((s) => s.enter?.underworld === true);
    expect(under.length, "ninguna costura declara `enter.underworld`: el filtro de capa pasó en vacío").toBeGreaterThan(0);
    expect(ov.length - under.length, "ninguna costura queda en Britannia: falta el lado opuesto").toBeGreaterThan(0);
  });
});

describeCorpusReal("costura overworld — censo de la capa declarada en las rutas commiteadas", () => {
  // NO-REGRESIÓN del fix de capa: mientras ninguna ruta declare `enter.underworld`, TODAS las
  // costuras de overworld resuelven a Britannia, que es exactamente lo que el runner hacía
  // antes. El fix no puede haber movido ninguna corrida.
  //
  // ★ El control positivo genérico («hay costuras que ejercitan este camino») se instancia
  // arriba sobre `routes-sint/`. Aquí NO hace falta: los dos bloques de abajo asiertan una
  // LISTA de 16 identidades, que no se puede satisfacer en vacío.

  it("la población del Underworld son ESTOS 16 segmentos, por identidad y no por cifra", () => {
    // Un conteo cuadra por casualidad; la lista no. Si el clasificador se regenera y pierde (o
    // gana) costuras, este test dice CUÁLES, no sólo cuántas.
    const ids = [...seams(), ...seams(ROUTES_AD_DIR)].filter((x) => x.enter?.underworld === true).map((x) => x.id).sort();
    expect(ids).toEqual([
      "ad15-g14", "ad17-g12", "ad17-g14", "ad17-g18", "ad18-g11",
      "ad20-g08", "ad20-g09", "ad20-g10", "ad23-g03", "ad23-g04", "ad24-g31",
      "part17-g07", "part19-g09", "part19-g10", "part20-g11", "part22-g07",
    ]);
  });

  /**
   * ★★ CONTRATO CAMBIADO A PROPÓSITO (ruling del lead, 31-07) — y la traza de por qué, porque
   * este test pinaba EXACTAMENTE lo contrario y borrarla lo dejaría pareciendo una regresión.
   *
   * Pinaba: «el skip sólo se retira en la clase A, porque en la clase B la party ya está en
   * `location` 0 y el resync NO se dispara». Esa justificación era **falsa**, y no por poco:
   * `setDungeonPos` aparca `state.position` en `location: 0` MIENTRAS la party está dentro del
   * 3D (`dungeon-cmds.ts:201-211`), así que `location` 0 no significa «ya salió» — no significa
   * nada. El testigo es `dungeonState`. Con el gate arreglado el resync **sí puede correr** para
   * la clase B, y el ruling la des-skipea.
   *
   * MEDIDO tras el cambio: de los 6 de clase B corridos en vivo, `ad15-g14`, `ad23-g04` y
   * `ad24-g31` disparan y depositan en el Underworld; los tres de `ad20` dan `CAPA-EXIT`.
   */
  it("los 16 tienen el SKIP RETIRADO (ruling: la clase B también)", () => {
    const conMarca = [...seams(), ...seams(ROUTES_AD_DIR)].filter((x) => x.enter?.underworld === true);
    const sinSkip = conMarca.filter((x) => x.skip == null).map((x) => x.id).sort();
    expect(sinSkip).toEqual([
      "ad15-g14", "ad17-g12", "ad17-g14", "ad17-g18", "ad18-g11",
      "ad20-g08", "ad20-g09", "ad20-g10", "ad23-g03", "ad23-g04", "ad24-g31",
      "part17-g07", "part19-g09", "part19-g10", "part20-g11", "part22-g07",
    ]);
  });

  // Control OPUESTO: el aserto de arriba se satisfaría igual si el corpus entero dejara de
  // skipear (una regeneración que se cargue la regla). La cuarentena real tiene que seguir ahí.
  it("y la cuarentena del resto del corpus SIGUE en pie", () => {
    const todos = [...listParts().flatMap((p) => loadRoute(p).segments),
                   ...listParts(ROUTES_AD_DIR).flatMap((p) => loadRoute(p, ROUTES_AD_DIR).segments)];
    expect(todos.filter((s) => s.skip != null).length).toBeGreaterThan(100);
  });
});

describe("anchorIsShop — qué anclas exigen verificación de ENGANCHE de tienda", () => {
  // Un ancla de tienda no basta con abrir conversación: hay que comprobar que la tienda
  // ENGANCHÓ (`shopOpen`), o las teclas de compra caen sobre el mapa y el ledger mide 0 en
  // silencio. Quién entra a ese bucle lo decide esta función.
  const A = (cmd: string, match: string) => ({ cmd, match });

  it("las dos anclas de LP1 son tienda (buy/sell + shop:), y lo siguen siendo", () => {
    expect(anchorIsShop(A("sell", "shop:Blacksmith"))).toBe(true);
    expect(anchorIsShop(A("buy", "shop:GuildMaster"))).toBe(true);
  });

  it("un peaje no es tienda: no se le exige shopOpen", () => {
    expect(anchorIsShop(A("toll", "d130"))).toBe(false);
    expect(anchorIsShop(A("talk", "Gwenneth"))).toBe(false);
  });

  it("★ un ancla talk+shop: SÍ es tienda — las 47 de AD entran al bucle de verificación", () => {
    // Forma exacta de las 47 anclas del corpus AD: cmd "talk", match por TIPO de tienda.
    // Medido sobre main: 47/47 son así, y con la regla anterior las 47 daban false.
    expect(anchorIsShop(A("talk", "shop:Healer"))).toBe(true);
    expect(anchorIsShop(A("talk", "shop:InnKeeper"))).toBe(true);
  });

  it("el arma de `cmd` NO se retira: un buy/sell casado por dialogNumber sigue verificándose", () => {
    // `d<N>` es una forma de match DOCUMENTADA en NpcAnchor («mercaderes sin ambigüedad de
    // tipo»). Keyear SÓLO por `match` la dejaría sin verificación en silencio. Hoy no hay
    // ninguna así (medido: 0 en los dos corpus), y por eso mismo el agujero pasaría inadvertido.
    expect(anchorIsShop(A("buy", "d130"))).toBe(true);
  });
});

// ---------------------------------------------------------------- T-LEDGER (31-07)
/**
 * CANAL NUMÉRICO DEL LEDGER — los dos defectos que adjudicar los 42 `numericDeltas` de la
 * ventana E-3 dejó al descubierto (`re/notes/deltas-42-adjudicacion.md`).
 *
 * T-LEDGER-GLIFO: `rawDigits` leía el texto OCR CRUDO y era el único consumidor del
 * comparador que no pasaba por el modelo de glifos, cuyas clases BASE declaran `0`≡`O`.
 * Resultado: la `O` de `Open-` se contaba como el número cero. 42 de 43 observaciones del
 * canal en aquella ventana eran fantasmas.
 *
 * T-LEDGER-VENTANA: la ventana de líneas del port que alimenta `got` salía del span del
 * match, y el comodín `[oi2-9]{1,7}` puede morder la línea ANTERIOR — 16 de 42 ventanas
 * abarcaban más de una línea. Mientras el canal sólo fabricaba fantasmas era inocuo; con
 * números de verdad TAPA divergencias (el caso `mordida` de abajo).
 */
const numSeg = (text: string): Segment => ({
  id: "t-num01",
  ctx: "smallmap",
  seam: null,
  ocr: { from: 1, to: 99 },
  script: [],
  expect: [{ text, ocrLn: 1, class: "auto" }],
});

describe("T-LEDGER-GLIFO — un glifo leído como dígito NO es un número", () => {
  it("★ el fantasma canónico: «0pen-North» contra «Open-North» no produce delta numérico", () => {
    // Los 38 de la familia mayor de los 42. El bloque CASA (el port dijo la línea); lo que
    // no puede es declarar que el LP mostraba un cero.
    const d = diffSegment(numSeg("0pen-North"), ["Open-North"], AD_PROFILE);
    expect(d.blocks[0]!.verdict).toBe("match");
    expect(d.blocks[0]!.numbers).toBeUndefined();
  });

  it("★ los otros tres fantasmas de la ventana E-3: VICTORY, Oaken Oar y what?", () => {
    for (const [ocr, port] of [
      ["VICT0RY!", "VICTORY!"],
      ["Welcome to The 0aken 0ar!", "Welcome to The Oaken Oar!"],
      ["What7", "What?"],
    ] as const) {
      expect(diffSegment(numSeg(ocr), [port], AD_PROFILE).blocks[0]!.numbers).toBeUndefined();
    }
  });

  it("★ TRAMPA DEL PLEGADO: un número REAL no se puede plegar — «150» jamás puede salir «5»", () => {
    // El fix ingenuo (derivar los dígitos de la representación PLEGADA) mataba 40 de los 42
    // fantasmas, y por eso parecía el fix. Es una TRAMPA: el plegado convierte `0`→`o` y
    // `1`→`i` DENTRO del número, así que «150»→«5», «63»→«3» (AD pliega 6→o) y «1»→nada.
    // Habría cambiado 42 fantasmas de glifo por un fantasma ARITMÉTICO en cada contador real.
    const d = diffSegment(numSeg("Thou hast 150 gold."), ["Thou hast 150 gold."], AD_PROFILE);
    expect(d.blocks[0]!.numbers).toEqual({ expected: ["150"], got: ["150"] });
    const e = diffSegment(numSeg("Thou hast 63 food."), ["Thou hast 63 food."], AD_PROFILE);
    expect(e.blocks[0]!.numbers).toEqual({ expected: ["63"], got: ["63"] });
    expect(countedDigits("Thou hast 1 key!")).toEqual(["1"]);
  });

  it("una divergencia numérica REAL sigue aflorando (el canal no se queda mudo)", () => {
    const d = diffSegment(numSeg("Thou hast 63 food."), ["Thou hast 12 food."], AD_PROFILE);
    expect(d.blocks[0]!.numbers).toEqual({ expected: ["63"], got: ["12"] });
  });

  it("el criterio es AISLAMIENTO DE TOKEN, y se aplica a los DOS lados del diff", () => {
    // pegado a letra = glifo; token suelto = número. Derivado del corpus AD: de 29.349
    // dígitos pegados a letra los top son 0pen/0pened/VICT0RY/5outh/5hamlno (confusiones),
    // y de 2.724 aislados los top son «1 food!», «2 torches!», «1 key!», «13 gold!».
    expect(countedDigits("0pen-North")).toEqual([]);
    expect(countedDigits("VICT0RY!")).toEqual([]);
    expect(countedDigits("What7")).toEqual([]);
    expect(countedDigits("2H Axe")).toEqual([]); // «2H» es el arma, no un contador
    expect(countedDigits("13 gold!")).toEqual(["13"]);
    expect(countedDigits("The pocket watch reads 3:28 AM.")).toEqual(["3", "28"]);
  });

  it("★ `?`≡`7` NO entra como clase de glifo (la decisión, con su motivo)", () => {
    // Las clases de glifo alimentan `collapseWith`, que usa TODO el comparador (blockPattern,
    // coverageRatio, dice): meter `?`≡`7` movería la conformidad de los dos corpus enteros
    // para arreglar dos bloques. El aislamiento de token ya los mata sin tocar el matcher, y
    // en el corpus el `?`→`7` sólo aparece pegado a letra («what7»). Candado: si alguien lo
    // añade, este test cae y le obliga a medir la conformidad antes.
    expect(AD_PROFILE.glyphClasses.some((g) => g.chars.includes("7") || g.to === "7")).toBe(false);
    expect(countedDigits("X-it what7")).toEqual([]);
  });
});

describe("T-LEDGER-VENTANA — la ventana del `got` es la del LITERAL, no la del comodín", () => {
  // Las dos líneas del port del caso de la mordida. La de arriba TERMINA en «!» —que el
  // comparador pliega a `i`, de la clase del comodín— y es lo que deja al comodín cruzar el
  // salto de línea. Es la forma exacta de los 16/42 medidos («Nothing to open!» + «Open-…»).
  const BITE_PORT = ["Thou hast 3 torches!", "gems left."];
  const BITE_OCR = "3 gems left.";

  it("★ MORDIDA: el comodín se come la línea anterior, el literal vive en la de abajo", () => {
    // El bloque OCR EMPIEZA por dígito ⇒ el patrón empieza por comodín, y `[oi2-9]{1,7}`
    // acepta `o`/`i`. Los offsets se CALCULAN del propio colapso: hardcodearlos ataría el
    // test a la tabla de plegado del perfil y caería por motivos que no son éste.
    const line0 = collapseWith(BITE_PORT[0]!, AD_PROFILE);
    const T = line0 + collapseWith(BITE_PORT[1]!, AD_PROFILE);
    const m = blockPatternFor(BITE_OCR, AD_PROFILE).exec(T)!;
    expect(m.index).toBeLessThan(line0.length); // el match ARRANCA arriba: hay mordida
    expect(literalSpan(m)!.from).toBe(line0.length); // el literal, no
  });

  it("★★ EL CASO QUE IMPORTA: la mordida TAPA una divergencia real (falso acuerdo)", () => {
    // El port perdió el contador —dice «gems left.» sin número, divergencia GENUINA— pero la
    // línea de arriba trae un 3, y con la ventana ensanchada `got` sale ["3"] == esperado: el
    // canal firma un acuerdo que no existe. Es el falso NEGATIVO, y es el que importa: un
    // canal que grita en falso se audita, uno que calla en falso no.
    const d = diffSegment(numSeg(BITE_OCR), BITE_PORT, AD_PROFILE);
    expect(d.blocks[0]!.verdict).toBe("match");
    expect(d.blocks[0]!.numbers).toEqual({ expected: ["3"], got: [] });
  });

  it("la ventana LEGÍTIMA de varias líneas se conserva (el bloque que abarca dos de verdad)", () => {
    // Acotar no puede volverse recortar: un bloque cuyo LITERAL cruza dos líneas del port
    // tiene que seguir leyendo las dos.
    const d = diffSegment(
      numSeg("Thou hast 5 gems and 9 keys!"),
      ["Thou hast 5 gems", "and 9 keys!"],
      AD_PROFILE,
    );
    expect(d.blocks[0]!.numbers).toEqual({ expected: ["5", "9"], got: ["5", "9"] });
  });

  it("bloque SIN literal (sólo dígitos): no hay ancla, se declara y se usa el span entero", () => {
    expect(literalSpan(blockPatternFor("150", AD_PROFILE).exec("aaa150bbb")!)).toBeNull();
  });
});
