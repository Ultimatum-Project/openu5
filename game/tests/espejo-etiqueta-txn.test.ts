/**
 * ★★ EL INSTRUMENTO NO PUEDE ACUSAR AL PORT DE ALGO QUE NO HIZO.
 *
 * Los DOS defectos de arnés que `re/notes/teclas-ad09-acta.md` §6 fichó y su cláusula de
 * pre-registro le prohibió arreglar. Los dos son de la misma familia —el runner enumera los
 * casos que se le ocurrieron al autor y deja el resto cayendo por el lado inseguro— y los dos
 * se arreglan aquí con la forma opuesta: preguntar por los estados de ÉXITO.
 *
 * 1. LA ETIQUETA. `LEDGER-DELTA txn` cerraba con un TERNARIO sobre `match` que sólo sabía decir
 *    `✓ (mecánica FIEL)` o `✗ (DIVERGENCIA DE PORT en la transacción)`. Cuando el ancla de NPC
 *    no enganchaba, el port no llegaba a ver la tienda, el delta salía 0 —un cero VACÍO— y la
 *    línea acusaba igualmente al port. La causa (`npc-anchor '…': skip (overworld…)`) vivía en
 *    los `resyncs`, decenas de líneas más arriba. [[cita-equivocada-peor-que-ninguna]]
 * 2. `skipTxnKeys`. Se armaba con `status === "miss" || status === "ambiguous"`; `AnchorStatus`
 *    tiene CINCO valores y `skip` no era ninguno de los dos, así que las teclas de la
 *    transacción caían sobre el MAPA.
 *
 * Los dos se miden aquí como FUNCIONES PURAS conducidas de verdad — no como una réplica de su
 * lógica escrita en el test. [[replica-del-test-no-es-el-test-la-fase]]
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, it, expect } from "vitest";
import {
  anchorEngaged,
  ledgerDeltaResult,
  ledgerTxnVerdict,
  listParts,
  loadRoute,
  ROUTES_AD_DIR,
  type AnchorStatus,
  type LedgerDelta,
} from "../e2e/espejo-tour/runner";
import { describeCorpusReal, ROUTES_SINT_DIR } from "./espejo-corpus";

/** Los CINCO valores del tipo, escritos a mano: si alguien añade un sexto, el `satisfies` de
 *  abajo no compila y el censo de este fichero deja de ser una lista incompleta en silencio. */
const TODOS: AnchorStatus[] = ["resolved-jump", "resolved-hold", "miss", "ambiguous", "skip"];

describe("anchorEngaged — LISTA BLANCA de los estados que SÍ enganchan", () => {
  it("los dos estados resueltos enganchan", () => {
    expect(anchorEngaged("resolved-jump")).toBe(true);
    expect(anchorEngaged("resolved-hold")).toBe(true);
  });

  it("★★ `skip` NO engancha — el tercer estado que la lista negra del runner se dejaba fuera", () => {
    expect(anchorEngaged("skip")).toBe(false);
  });

  it("`miss` y `ambiguous` tampoco (los dos que la forma anterior SÍ cubría)", () => {
    expect(anchorEngaged("miss")).toBe(false);
    expect(anchorEngaged("ambiguous")).toBe(false);
  });

  it("★ censo del tipo ENTERO: exactamente 2 de los 5 estados enganchan", () => {
    expect(TODOS.filter(anchorEngaged)).toEqual(["resolved-jump", "resolved-hold"]);
  });
});

/** Atajos legibles: un delta conducido que cuadra / que no / ilegible. */
const CUADRA: LedgerDelta = ledgerDeltaResult(2000, 1046, -954);
const NO_CUADRA: LedgerDelta = ledgerDeltaResult(2000, 1000, -954);
const ILEGIBLE: LedgerDelta = ledgerDeltaResult(3, null, 2);
/** El caso literal de `ad09-g04` ANTES de la costura interna: esperado −274, oro quieto. */
const AD09_CERO_VACIO: LedgerDelta = ledgerDeltaResult(1500, 1500, -274);

describe("ledgerTxnVerdict — los estados del veredicto de una transacción", () => {
  it("conducida y cuadra → FIEL, y no acusa a nadie", () => {
    const v = ledgerTxnVerdict(CUADRA, "resolved-jump");
    expect(v.state).toBe("fiel");
    expect(v.accusesPort).toBe(false);
  });

  it("conducida y NO cuadra → DIVERGENCIA, y ahí la acusación al port SÍ es correcta", () => {
    const v = ledgerTxnVerdict(NO_CUADRA, "resolved-hold");
    expect(v.state).toBe("divergencia");
    expect(v.accusesPort).toBe(true);
    expect(v.label).toContain("DIVERGENCIA DE PORT");
  });

  it("op SUELTO (peaje/tributo, sin ancla) → conducida por construcción: sigue midiendo al port", () => {
    expect(ledgerTxnVerdict(NO_CUADRA, null).state).toBe("divergencia");
    expect(ledgerTxnVerdict(NO_CUADRA, null).accusesPort).toBe(true);
    expect(ledgerTxnVerdict(CUADRA, null).state).toBe("fiel");
  });

  it("★★ ancla en `skip` y contador QUIETO → NO CONDUCIDA: cero VACÍO, y NO acusa al port", () => {
    const v = ledgerTxnVerdict(AD09_CERO_VACIO, "skip");
    expect(v.state).toBe("no-conducida");
    expect(v.accusesPort).toBe(false);
    expect(v.label).not.toContain("DIVERGENCIA DE PORT");
  });

  it("★ la etiqueta de NO CONDUCIDA nombra el estado del ancla y dice que no está medido", () => {
    const v = ledgerTxnVerdict(AD09_CERO_VACIO, "skip");
    expect(v.label).toContain("skip");
    expect(v.label).toContain("NO CONDUCIDA");
    expect(v.label).toMatch(/VAC[IÍ]O/);
  });

  it("`miss` y `ambiguous` producen el mismo estado que `skip` (no enganchar es no enganchar)", () => {
    expect(ledgerTxnVerdict(AD09_CERO_VACIO, "miss").state).toBe("no-conducida");
    expect(ledgerTxnVerdict(AD09_CERO_VACIO, "ambiguous").state).toBe("no-conducida");
  });

  it("★★ ancla sin enganchar pero el contador SE MOVIÓ → estado PROPIO, no se pliega al cero vacío", () => {
    const movido = ledgerDeltaResult(1500, 1400, -274); // got −100: ni el esperado ni 0
    const v = ledgerTxnVerdict(movido, "skip");
    expect(v.state).toBe("no-conducida-con-movimiento");
    expect(v.accusesPort).toBe(false);
    expect(v.label).toContain("-100");
  });

  it("conducida pero el contador no es LEGIBLE → ilegible, y tampoco acusa", () => {
    const v = ledgerTxnVerdict(ILEGIBLE, "resolved-jump");
    expect(v.state).toBe("ilegible");
    expect(v.accusesPort).toBe(false);
  });

  it("★ ORDEN DE GUARDAS: no-conducida MANDA sobre ilegible (si no se condujo, nada se midió)", () => {
    expect(ledgerTxnVerdict(ILEGIBLE, "skip").state).toBe("no-conducida");
  });

  it("sin transacción armada → SIN INTENTO (y el runner no emite línea)", () => {
    const v = ledgerTxnVerdict(null, null);
    expect(v.state).toBe("sin-intento");
    expect(v.accusesPort).toBe(false);
    expect(v.label).toBe("");
  });

  it("★★ LA PROPIEDAD CENTRAL, barrida: con el ancla SIN enganchar, NINGÚN delta acusa al port", () => {
    const noEnganchan = TODOS.filter((s) => !anchorEngaged(s));
    expect(noEnganchan).toHaveLength(3); // el barrido no es vacío
    for (const s of noEnganchan) {
      for (const d of [CUADRA, NO_CUADRA, ILEGIBLE, AD09_CERO_VACIO]) {
        const v = ledgerTxnVerdict(d, s);
        expect(v.accusesPort, `${s} + got=${d.got}`).toBe(false);
        expect(v.label, `${s} + got=${d.got}`).not.toContain("DIVERGENCIA DE PORT");
      }
    }
  });

  it("★ CONTROL DE INVARIANCIA: las etiquetas conducidas son BYTE-IDÉNTICAS a las de antes", () => {
    // Los 5 deltas verdes del proyecto viven en este brazo. Si su cola cambia, los transcripts
    // y las guardas que los leen se mueven — y este carril no toca ni uno.
    expect(ledgerTxnVerdict(CUADRA, "resolved-jump").label).toBe("✓ (mecánica FIEL)");
    expect(ledgerTxnVerdict(NO_CUADRA, "resolved-jump").label).toBe("✗ (DIVERGENCIA DE PORT en la transacción)");
    expect(ledgerTxnVerdict(CUADRA, null).label).toBe("✓ (mecánica FIEL)");
  });
});

/**
 * ★★ GUARDA DE CABLEADO — la mitad del arreglo que un test de función pura NO puede probar.
 *
 * Las dos decisiones viven en `runSegment`, que necesita un `Page` de Playwright: no se pueden
 * conducir desde `test:pure`. Y arreglar la función dejando el CALL SITE con su lógica inline
 * sería un arreglo localizado e INERTE — exactamente el modo de fallo que este proyecto ya ha
 * pagado. [[fix-localizado-pero-inerte]]
 *
 * Así que se mide el cableado sobre el FUENTE: que las dos líneas del runner llamen a las dos
 * funciones y que las formas viejas (la lista negra y el ternario sobre `.match`) no queden.
 * ALCANCE DECLARADO: esto prueba que la llamada ESTÁ, no que el runner produzca la línea en
 * vivo — eso lo mide la corrida SOFT del acta, no un test.
 */
const RUNNER_SRC = readFileSync(fileURLToPath(new URL("../e2e/espejo-tour/runner.ts", import.meta.url)), "utf8");

/**
 * ⚠ SIN COMENTARIOS, y no es cosmética. La primera versión de la guarda de abajo miraba el
 * fuente entero y se ponía ROJA por la PROSA de este mismo arreglo: tanto el docblock de
 * `anchorEngaged` como el comentario del call site CITAN la forma vieja para explicar por qué
 * se retiró. Un detector que no distingue código de comentario acusa a la documentación del
 * fix de ser el defecto. [[lint-que-se-acusa-a-si-mismo]]
 */
function sinComentarios(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/[^\n]*/g, "$1");
}
const RUNNER_CODE = sinComentarios(RUNNER_SRC);

describe("cableado en runner.ts — el arreglo no puede ser inerte", () => {
  it("★★ `skipTxnKeys` se arma con `anchorEngaged`, no con una enumeración de fallos", () => {
    expect(RUNNER_CODE).toMatch(/skipTxnKeys = !anchorEngaged\(outcome\.status\)/);
  });

  it("★★ la LISTA NEGRA vieja ya no está en el fuente", () => {
    // La forma literal que dejaba `skip` cayendo por el lado de «enganchó».
    expect(RUNNER_CODE).not.toMatch(/status === "miss" \|\| \w*\.?status === "ambiguous"/);
  });

  it("★★ la línea `LEDGER-DELTA txn` toma su cola de `ledgerTxnVerdict`", () => {
    const linea = RUNNER_CODE.split("\n").find((l) => l.includes("LEDGER-DELTA txn:"));
    expect(linea, "la línea LEDGER-DELTA txn ha desaparecido del runner").toBeDefined();
    expect(linea!).toContain("ledgerTxnVerdict(");
  });

  it("★ el TERNARIO sobre `.match` ya no decide ninguna de las tres etiquetas del ledger", () => {
    for (const canal of ["LEDGER-DELTA txn:", "LEDGER-DELTA llaves:", "LEDGER-DELTA gemas:"]) {
      const linea = RUNNER_CODE.split("\n").find((l) => l.includes(canal))!;
      expect(linea, canal).not.toMatch(/\w+\.match \?/);
    }
  });

  it("★ llaves y gemas pasan por el MISMO veredicto (misma puerta, mismo estado)", () => {
    for (const canal of ["LEDGER-DELTA llaves:", "LEDGER-DELTA gemas:"]) {
      const idx = RUNNER_CODE.split("\n").findIndex((l) => l.includes(canal));
      const ventana = RUNNER_CODE.split("\n").slice(idx - 2, idx + 1).join("\n");
      expect(ventana, canal).toContain("ledgerTxnVerdict(");
    }
  });
});

/**
 * ★★ LA FONTANERÍA — la guarda que los tests de arriba NO daban, y está MEDIDO.
 *
 * Mutados los dos eslabones que llevan el desenlace del ancla hasta el veredicto
 * (`opNpcStatus = outcome.status` → `null`, y `txnAnchorStatus = opNpcStatus` → `null`), los
 * **21 tests que el fichero tenía ENTONCES siguieron VERDES**. ⚠ La cifra es la de su fecha y
 * NO se re-escribe sola: hoy el fichero tiene 33 bloques (12 más: los 4 del corpus sintético
 * de abajo y los reajustes de la separación de corpus del 25-08), y la mutación NO se ha
 * vuelto a correr contra ellos. Lo que no cambia es el argumento —ninguno de los bloques de
 * COMPORTAMIENTO puede matar ese mutante, porque los tres eslabones viven en `runSegment`—,
 * y por eso la guarda de abajo es ESTÁTICA. [[cifra-de-suite-heredada-caduca-por-dos-vias]]
 * Y esa mutación deja el arreglo entero INERTE: con el estado
 * del ancla siempre a `null`, `ledgerTxnVerdict` cree que toda transacción se condujo y la
 * etiqueta vuelve a acusar al port exactamente igual que antes. Función correcta, cableado
 * correcto, y aun así el defecto de vuelta. [[fix-localizado-pero-inerte]] · [[mutante-que-no-muta]]
 *
 * Ningún test de este fichero puede cerrarlo por comportamiento: los tres eslabones viven
 * dentro del bucle de `runSegment`, que no se conduce sin medio arnés de Playwright (el mismo
 * límite que declaró `espejo-costura-interna`). Así que la guarda es ESTÁTICA y lo dice.
 */
describe("★★ la fontanería del estado del ancla — medida por mutación, no supuesta", () => {
  const idx = (aguja: string, desde = 0): number => {
    const i = RUNNER_CODE.indexOf(aguja, desde);
    expect(i, `el ancla textual de la guarda ya no existe en runner.ts: ${aguja}`).toBeGreaterThan(-1);
    return i;
  };

  it("el desenlace del ancla de NPC se CAPTURA (sin esto el veredicto no tiene con qué decidir)", () => {
    // ★ Anclas ACTUALIZADAS por la ficha F-A3: el bucle pasó a INDEXADO (el ancla de NPC tiene
    // que mirar al op siguiente para leer la dirección del guion) y la llamada ganó un 4º
    // argumento. La GUARDA no cambia de intención — sigue exigiendo que la captura del
    // desenlace vaya DESPUÉS de resolver el ancla y DENTRO del bucle —, pero el ancla de la
    // llamada se corta ANTES del cierre de paréntesis para que añadir un argumento no la vuelva
    // a romper sin que nadie haya tocado lo que aquí se vigila.
    const bucle = idx("for (let opIdx = 0; opIdx < seg.script.length; opIdx++) {");
    const captura = idx("opNpcStatus = outcome.status;", bucle);
    expect(captura, "la captura tiene que ir DESPUÉS de resolver el ancla").toBeGreaterThan(
      idx("const outcome = await resyncToNpcAnchor(page, op.anchor, resyncs", bucle),
    );
  });

  it("★★ y VIAJA al armado del ledger: `txnAnchorStatus` se rellena con él, no con `null`", () => {
    const arm = idx("const arm = ledgerArm(op);");
    const viaje = idx("txnAnchorStatus = opNpcStatus;", arm);
    // Antes de capturar el oro: el veredicto tiene que describir ESTA transacción, no la anterior.
    expect(viaje).toBeLessThan(idx("txnGoldBefore = await readGold(page);", arm));
  });

  it("★★ y el veredicto del oro se pregunta CON él (no con un literal complaciente)", () => {
    const linea = RUNNER_CODE.split("\n").find((l) => l.includes("LEDGER-DELTA txn:"))!;
    expect(linea).toContain("ledgerTxnVerdict(ledgerDelta, txnAnchorStatus)");
  });

  it("★ los tres canales del ledger preguntan por el MISMO estado de ancla", () => {
    for (const canal of ["LEDGER-DELTA txn:", "LEDGER-DELTA llaves:", "LEDGER-DELTA gemas:"]) {
      const i = RUNNER_CODE.split("\n").findIndex((l) => l.includes(canal));
      const ventana = RUNNER_CODE.split("\n").slice(i - 2, i + 1).join("\n");
      expect(ventana, canal).toContain("txnAnchorStatus");
    }
  });
});

/**
 * ★★ EL CENSO DEL CASO 2 — la población de HOY, y por qué el cinturón se pone igual.
 *
 * `teclas-ad09` §6.2 midió el defecto sobre `ad09-g04`: ancla `skip` (overworld) + 14 teclas de
 * compra cayendo sobre el mapa. **Ese caso ya no existe**: `costura-interna` (7e0b3b56) le puso
 * un `enterLoc 26` antes del ancla, así que hoy resuelve dentro de la location. Censado sobre
 * los DOS corpus, la población del caso vivo es **CERO**.
 *
 * ★ Y aun así el arreglo se queda, declarado como lo que es: un SEGURO SIN CASO VIVO, no un
 * hallazgo. El precedente exacto es `curate-cablear` §4 (mutante M2). Dos razones:
 *   1. `skip` sigue siendo ALCANZABLE en vivo aunque ningún segmento lo declare: la costura de
 *      apertura resuelve dentro de un `try/catch` que, al fallar, sólo empuja `RESYNC-FAIL enter…`
 *      y deja seguir el bucle — con la party todavía en location 0. El censo mide el CORPUS; no
 *      puede medir un resync que se cae.
 *   2. Lo que hacía inocuo al defecto era la SUERTE (el `Escape` final del bloque cerraba el
 *      picker que abría el `n`), y `compra-fantasma` ya cobró lo que pasa cuando las teclas de
 *      tienda caen donde no deben: 100 gp fantasma.
 *
 * Este bloque es además la SONDA COMMITEADA de la cifra: sin él, «población 0» sería una foto
 * de mi cabeza. [[cifra-sin-sonda-commiteada]] · [[cifra-censo-sin-sha-es-foto]]
 *
 * ── EL ALGORITMO ES INSTRUMENTO; LA CIFRA, CORPUS ────────────────────────────────────────
 * `anclasDeTxn` es la ÚNICA réplica fuera del runner del cálculo de la LOCATION EFECTIVA
 * (arranque por la costura + `enterLoc`/`exitOverworld` a mitad de guion) y de la regla de
 * corte de la ráfaga de teclas. Eso es herramienta, y se instancia sobre `routes-sint/` —
 * que trae A PROPÓSITO los dos casos, incluido el que hoy está EXTINTO en el corpus real
 * (un ancla de transacción resolviendo en el mapa grande). Los cardinales y los ids —las 7,
 * `ad09-g04`, la location 26— son el corpus, y se quedan bajo `describeCorpusReal`.
 */

/** Location EFECTIVA en cada op, siguiendo las mismas reglas que el bucle de `runSegment`:
 *  arranque por la costura del segmento, y `enterLoc`/`exitOverworld` a mitad de guion.
 *  Es una FUNCIÓN (no una constante): no abre un corpus hasta que la llama un `it`. */
function anclasDeTxn(
  dirs: ReadonlyArray<string | undefined>,
): Array<{ seg: string; loc: number | null; match: string; teclasDetras: number }> {
  const out: Array<{ seg: string; loc: number | null; match: string; teclasDetras: number }> = [];
  for (const dir of dirs) {
    for (const part of listParts(dir)) {
      for (const seg of loadRoute(part, dir).segments) {
        // `null` = no-overworld de arranque (smallmap/combat/interior): nunca dispara el `skip`.
        let loc: number | null = seg.enter?.loc ?? (seg.enter?.overworld || seg.ctx === "overworld" ? 0 : null);
        seg.script.forEach((op, i) => {
          if (op.enterLoc != null) loc = op.enterLoc;
          if (op.exitOverworld != null) loc = 0;
          if (op.anchor?.kind !== "npc" || op.anchor.expectDelta == null) return;
          let teclas = 0;
          for (const sig of seg.script.slice(i + 1)) {
            if (sig.key == null) break; // la ráfaga acaba en el primer op sin `key` (regla del runner)
            teclas++;
          }
          out.push({ seg: seg.id, loc, match: op.anchor.match, teclasDetras: teclas });
        });
      }
    }
  }
  return out;
}

describe("la LOCATION EFECTIVA de un ancla de transacción (corpus sintético)", () => {
  it("★ POBLACIÓN: hay anclas de transacción que censar, y todas llevan teclas detrás", () => {
    const anclas = anclasDeTxn([ROUTES_SINT_DIR]);
    // Sin esta guarda los dos bloques de abajo (que filtran por `loc`) podrían pasar sobre un
    // conjunto vacío: el `find` daría `undefined` y el `filter` `[]`, los dos verdes.
    expect(anclas.length, "el corpus sintético no trae NI UN ancla `{kind:'npc', expectDelta}`").toBeGreaterThan(0);
    for (const a of anclas) expect(a.teclasDetras, `${a.seg}`).toBeGreaterThan(0);
  });

  it("la ráfaga de teclas acaba en el PRIMER op sin `key` (la regla del runner, conducida)", () => {
    // `sint03-g02` coloca detrás de cada ancla dos `{key}` y luego un op de escena (`todo` /
    // `todoKeep`): si el corte se perdiera, la cuenta se comería el resto del guion.
    const anclas = anclasDeTxn([ROUTES_SINT_DIR]).filter((a) => a.seg === "sint03-g02");
    expect(anclas.length, "sint03-g02 ya no trae sus DOS anclas de transacción").toBe(2);
    expect(anclas.map((a) => a.teclasDetras)).toEqual([2, 2]);
  });

  it("★ el arranque por la costura y el `enterLoc` del guion: las dos anclas de `sint03-g02` resuelven DENTRO de la location 12", () => {
    // La primera hereda la `loc` de `enter` (costura del segmento); la segunda la toma del
    // `{enterLoc: 12}` que el overlay coloca a mitad de guion. Las dos vías, el mismo destino.
    const locs = anclasDeTxn([ROUTES_SINT_DIR]).filter((a) => a.seg === "sint03-g02").map((a) => a.loc);
    expect(locs, "sin la costura o sin el `enterLoc`, alguna caería a 0 (mapa grande)").toEqual([12, 12]);
  });

  it("★★ EL CASO QUE EL GUARDA EXISTE PARA CAZAR: un ancla de txn en el MAPA GRANDE (`loc` 0)", () => {
    // Hoy EXTINTO en los dos corpus reales (censado abajo: población 0), y por eso el
    // instrumento que lo detecta no tiene allí con qué demostrarse. `sint03-g03` lo instancia:
    // `ctx: overworld` + `exitOverworld` y NINGÚN `enterLoc` ⇒ `loc` 0 ⇒ `resyncToNpcAnchor`
    // se abstendría con `skip` y las 2 teclas de la transacción caerían sobre el mapa.
    const enOverworld = anclasDeTxn([ROUTES_SINT_DIR]).filter((a) => a.loc === 0);
    expect(enOverworld.map((a) => a.seg), "el corpus sintético perdió el caso del mapa grande").toEqual(["sint03-g03"]);
    expect(enOverworld[0]!.teclasDetras, "sin teclas detrás, el defecto no tendría con qué morder").toBeGreaterThan(0);
  });
});

describeCorpusReal("★★ censo del caso 2 sobre los DOS corpus — población de las teclas que caerían al mapa", () => {
  const anclasReales = () => anclasDeTxn([ROUTES_AD_DIR, undefined]);

  it("★ CENSO DECLARADO — 7 anclas de transacción en los dos corpus (si se mueve, muévelo con motivo)", () => {
    expect(anclasReales()).toHaveLength(7);
  });

  it("★★ POBLACIÓN DEL CASO 2 HOY = 0: ninguna ancla de transacción resuelve en `overworld`", () => {
    const enOverworld = anclasReales().filter((a) => a.loc === 0);
    expect(enOverworld, `estas anclas harían 'skip' y sus teclas caerían al mapa: ${JSON.stringify(enOverworld)}`).toEqual([]);
  });

  it("★ y `ad09-g04` —el caso que teclas-ad09 midió— resuelve HOY dentro de la location 26", () => {
    const ad09 = anclasReales().find((a) => a.seg === "ad09-g04");
    expect(ad09, "ad09-g04 ya no tiene ancla de transacción").toBeDefined();
    expect(ad09!.loc, "sin el `enterLoc 26` de costura-interna volvería a ser 0").toBe(26);
  });

  it("★ el censo NO es vacío por construcción: las 7 llevan teclas detrás (el defecto tenía con qué morder)", () => {
    for (const a of anclasReales()) expect(a.teclasDetras, `${a.seg}`).toBeGreaterThan(0);
  });
});
