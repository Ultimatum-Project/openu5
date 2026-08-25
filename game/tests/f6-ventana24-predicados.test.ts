/**
 * Los CUATRO predicados pre-registrados de la ventana `f6-24`, contra fixtures SINTÉTICOS.
 *
 * Por qué existe este fichero y por qué se commitea CON el pre-registro y no después: los
 * predicados deciden qué se adjudica y cómo, así que si se validan mirando los reports reales ya
 * no son un pre-registro — son una racionalización. Aquí se validan contra casos construidos a
 * mano que cubren la frontera de cada uno; cuando lleguen los reports, lo único que puede
 * cambiar es un BUG (y se declara), nunca el criterio.
 *
 * Los casos NO son inventados del aire: reproducen, en miniatura, las formas medidas en
 * `re/notes/beats-combate-acta.md` — el `+8/−3` de `ad06-g34` (churn que el neto esconde), el
 * banner `ORCS` contra un corpus de `Troll` (§3), y el `auto/match → combat-rng` que sale del
 * denominador frente al `auto/match → auto/divergent` que no (§11.2).
 */
import { describe, expect, it } from "vitest";
import { scheduleIndex } from "../../re/tools/censo_sombra_mercader.mjs";
import {
  churnSegmento,
  churnParte,
  clasificaBloque,
  combateDelPort,
  folddBicho,
  ledgerSeMueve,
  PARTES_SELLADAS,
  opsNoConducidas,
  fraccionNoConducida,
  curvaDenominador,
  fronterasHorario,
  margenAFrontera,
} from "../../re/tools/f6_ventana24.mjs";

const B = (ocrLn: number, cls: string, verdict: string) => ({ ocrLn, class: cls, verdict });

describe("f6-24 · predicado 1 — CHURN (el cribado)", () => {
  it("dos brazos idénticos dan churn 0", () => {
    const a = [B(10, "auto", "match"), B(20, "rng", "rng")];
    expect(churnSegmento(a, a.map((x) => ({ ...x })))).toBe(0);
  });

  it("★★ el churn VE lo que el neto CANCELA (la forma de ad06-g34: +8/−3)", () => {
    const rev = [...Array(8)].map((_, i) => B(100 + i, "auto", "divergent")).concat([...Array(3)].map((_, i) => B(200 + i, "auto", "match")));
    const h = [...Array(8)].map((_, i) => B(100 + i, "auto", "match")).concat([...Array(3)].map((_, i) => B(200 + i, "auto", "divergent")));
    const casan = (bs: ReturnType<typeof B>[]) => bs.filter((b) => b.verdict === "match").length;
    expect(casan(h) - casan(rev)).toBe(5); // el neto que YO habría usado de filtro
    expect(churnSegmento(h, rev)).toBe(11); // el churn que hay que usar
  });

  it("🔴 el caso que refuta el cribado por |Δ|: neto EXACTAMENTE 0 y churn 2", () => {
    const rev = [B(10, "auto", "match"), B(20, "auto", "divergent")];
    const h = [B(10, "auto", "divergent"), B(20, "auto", "match")];
    const casan = (bs: ReturnType<typeof B>[]) => bs.filter((b) => b.verdict === "match").length;
    expect(casan(h) - casan(rev)).toBe(0); // un filtro por Δ lo DEJA FUERA
    expect(churnSegmento(h, rev)).toBe(2); // el pre-registro lo manda a fase 2
  });

  it("un bloque que sólo existe en un brazo cuenta como churn (en los dos sentidos)", () => {
    expect(churnSegmento([B(10, "auto", "match"), B(11, "auto", "match")], [B(10, "auto", "match")])).toBe(1);
    expect(churnSegmento([B(10, "auto", "match")], [B(10, "auto", "match"), B(11, "auto", "match")])).toBe(1);
  });

  it("el cambio de CLASE con el mismo veredicto también es churn (no se escapa por la métrica)", () => {
    expect(churnSegmento([B(10, "combat-rng", "combat-rng")], [B(10, "combat-roster-tail", "combat-rng")])).toBe(1);
  });

  it("churnParte suma segmentos y cuenta los que faltan en un brazo", () => {
    const rep = (segs: unknown[]) => ({ segments: segs, matched: 0, comparable: 0 });
    const h = rep([{ id: "g1", blocks: [B(1, "auto", "match")] }, { id: "g2", blocks: [B(2, "auto", "match"), B(3, "auto", "match")] }]);
    const rv = rep([{ id: "g1", blocks: [B(1, "auto", "divergent")] }]);
    const r = churnParte(h as never, rv as never);
    expect(r.total).toBe(3); // 1 de g1 + los 2 bloques de un g2 que Rev no tiene
    expect(r.porSegmento.map((s: { id: string }) => s.id).sort()).toEqual(["g1", "g2"]);
  });
});

describe("f6-24 · predicado 2 — pérdida de VEREDICTO vs salida del DENOMINADOR", () => {
  it("auto/match → auto/divergent = pérdida REAL", () => {
    expect(clasificaBloque(B(1, "auto", "match"), B(1, "auto", "divergent"))).toBe("perdida-veredicto");
  });
  it("auto/match → combat-rng/combat-rng = sale del denominador", () => {
    expect(clasificaBloque(B(1, "auto", "match"), B(1, "combat-rng", "combat-rng"))).toBe("sale-del-denominador");
  });
  it("covered cuenta como que CASABA (es numerador)", () => {
    expect(clasificaBloque(B(1, "auto", "covered"), B(1, "auto", "divergent"))).toBe("perdida-veredicto");
  });
  it("⚠ cambiar de clase pero acabar DIVERGENT es pérdida real, no absolución", () => {
    expect(clasificaBloque(B(1, "exact", "match"), B(1, "auto", "divergent"))).toBe("perdida-veredicto");
  });
  it("ganancia e igual", () => {
    expect(clasificaBloque(B(1, "auto", "divergent"), B(1, "auto", "match"))).toBe("ganancia");
    expect(clasificaBloque(B(1, "auto", "match"), B(1, "auto", "match"))).toBe("igual");
  });
});

describe("f6-24 · predicado 3 — ¿el combate era del PORT o del LP?", () => {
  const T_ORCS = ["North", "Slow progress!", "Attacked!", "      ORCS", "*** CONFLICT ***", "Gwenno, armed with Sling:"];
  const CORPUS_TROLLS = ["Attack-Aim! Troll missed!", "Troll killed! Barnabas hit!"];
  const CORPUS_ORCOS = ["Attack-Aim! Orc barely wounded!", "Orc killed!"];

  it("★★ el caso REAL de ad01-g05: banner ORCS contra un corpus de TROLLS ⇒ combate del PORT", () => {
    const r = combateDelPort(T_ORCS, CORPUS_TROLLS);
    expect(r.veredicto).toBe("combate-propio");
    expect(r.bicho).toBe("ORCS");
  });

  it("el MISMO transcript contra un corpus que SÍ nombra orcos ⇒ combate del LP (no es lotería)", () => {
    expect(combateDelPort(T_ORCS, CORPUS_ORCOS).veredicto).toBe("combate-del-lp");
  });

  it("sin banner de combate ⇒ sin-combate (es el caso de main en ad01-g05)", () => {
    expect(combateDelPort(["North", "Slow progress!", "Cast...", "Player: "], CORPUS_TROLLS).veredicto).toBe("sin-combate");
  });

  it("combate con banner ilegible ⇒ NO ADJUDICABLE, no se adivina", () => {
    expect(combateDelPort(["Attacked!", "   ", "*** CONFLICT ***"], CORPUS_TROLLS).veredicto).toBe("combate-sin-bicho");
    expect(combateDelPort(["Attacked!", "%%", "*** CONFLICT ***"], CORPUS_TROLLS).veredicto).toBe("combate-sin-bicho");
  });

  it("plegado singular/plural: el banner dice ORCS y las tiradas dicen Orc", () => {
    expect(folddBicho("ORCS")).toBe("ORC");
    expect(folddBicho("  Orc, ")).toBe("ORC");
    expect(folddBicho("SEA SERPENTS")).toBe("SEA SERPENT");
  });

  it("⚠ palabra COMPLETA: `ORC` no puede casar dentro de `torch`", () => {
    expect(combateDelPort(T_ORCS, ["Ignite torch! Thou dost find nothing"]).veredicto).toBe("combate-propio");
  });

  it("el OCR corrupto del banner CONFLICT (`C0NFLICT`) se reconoce igual", () => {
    expect(combateDelPort(["Attacked!", "TROLLS", "*** C0NFLICT ***"], CORPUS_TROLLS).veredicto).toBe("combate-del-lp");
  });
});

describe("f6-24 · predicado 4 — el ledger de las partes SELLADAS", () => {
  const rep = (deltas: unknown[]) => ({ ledger: { ledgerDeltas: deltas } });
  it("las tres partes selladas de la ventana están nombradas en el pre-registro", () => {
    expect(PARTES_SELLADAS).toEqual({ ad06: "ad06-g34", ad09: "ad09-g04", ad21: "ad21-g26" });
  });
  it("un importe que cambia se detecta", () => {
    const r = ledgerSeMueve(rep([{ seg: "ad06-g34", expected: 220, got: 212, match: false }]) as never, rep([{ seg: "ad06-g34", expected: 220, got: 220, match: true }]) as never);
    expect(r.movido).toBe(true);
  });
  it("un delta que DESAPARECE también es movimiento (no sólo el importe)", () => {
    expect(ledgerSeMueve(rep([]) as never, rep([{ seg: "ad09-g04", expected: -274, got: -274, match: true }]) as never).movido).toBe(true);
  });
  it("iguales no se mueven", () => {
    const d = [{ seg: "ad21-g26", expected: -1024, got: -1024, match: true }];
    expect(ledgerSeMueve(rep(d) as never, rep([...d]) as never).movido).toBe(false);
  });
});

describe("f6-24 · predicado 5 — DENOMINADOR NO CONDUCIDO (la corrección del lead)", () => {
  const seg = (id: string, comparable: number, matched: number, todosSkipped: number, extra = {}) => ({
    id, comparable, matched, todosSkipped, blocks: [], ...extra,
  });

  it("opsNoConducidas separa los TRES mecanismos y no los mezcla en un número", () => {
    const r = opsNoConducidas({ todosSkipped: 605, salaOpsSkipped: 3, typedSkipped: 16 });
    expect(r).toEqual({ todos: 605, sala: 3, typed: 16, total: 624 });
  });

  it("★★ la forma REAL de ad02-g04: 605 de 624 ops sin conducir = 0,97 del guion", () => {
    const f = fraccionNoConducida({ todosSkipped: 605, typedSkipped: 16, salaOpsSkipped: 0 }, 624);
    expect(f).toBeGreaterThanOrEqual(0.9);
    expect(f).toBeLessThanOrEqual(1);
  });

  it("🔴 el discriminante NO es la emisión: dos segmentos con el MISMO transcript vacío se separan", () => {
    // (i) el arnés no pulsó nada → no conducido; (ii) el arnés pulsó todo y el port calló → PERDIDO.
    const noConducido = fraccionNoConducida({ todosSkipped: 100 }, 100);
    const perdido = fraccionNoConducida({ todosSkipped: 0 }, 100);
    expect(noConducido).toBe(1);
    expect(perdido).toBe(0); // mismo transcript vacío, veredicto OPUESTO
  });

  it("sin ops totales del corpus, la fracción es null y NO se inventa", () => {
    expect(fraccionNoConducida({ todosSkipped: 10 }, undefined)).toBeNull();
    expect(fraccionNoConducida({ todosSkipped: 10 }, 0)).toBeNull();
  });

  it("la curva es ACUMULADA y descendente, y arrastra el comparable de cada banda", () => {
    const rep = {
      comparable: 300, matched: 30,
      segments: [seg("a", 200, 0, 95), seg("b", 60, 10, 40), seg("c", 40, 20, 0)],
    };
    const ops = { a: 100, b: 100, c: 100 };
    const c = curvaDenominador(rep as never, ops);
    const b = (x: number) => c.filas.find((f) => f.banda === x)!;
    expect(b(0.9).comparable).toBe(200); // sólo `a`
    expect(b(0.25).comparable).toBe(260); // `a` + `b`
    expect(b(0).comparable).toBe(300); // los tres
    expect(b(0.9).segmentos).toBe(1);
  });

  it("un segmento sin ops en el corpus va a `sinDato`, no a una banda", () => {
    const rep = { comparable: 50, matched: 0, segments: [seg("z", 50, 0, 10)] };
    const c = curvaDenominador(rep as never, {});
    expect(c.sinDato).toEqual({ segmentos: 1, comparable: 50 });
    expect(c.filas.every((f) => f.comparable === 0)).toBe(true);
  });
});

describe("f6-24 · predicado 6 — MARGEN AL BORDE DE HORARIO (§A2)", () => {
  it("las fronteras salen de scheduleIndex, no de una tabla propia", () => {
    // horario del NPC real del slot 1 de loc 1 (`assets/npcs.json`): times [21,9,17,18]
    const f = fronterasHorario([21, 9, 17, 18], scheduleIndex);
    expect(f.length).toBeGreaterThan(0);
    // toda frontera declarada tiene que CAMBIAR el índice; y ninguna hora fuera de la lista debe hacerlo
    for (let h = 0; h < 24; h++) {
      const cambia = scheduleIndex([21, 9, 17, 18], h) !== scheduleIndex([21, 9, 17, 18], (h + 23) % 24);
      expect(f.includes(h)).toBe(cambia);
    }
  });

  it("un horario CONSTANTE no tiene frontera y el margen es null (no cero)", () => {
    expect(fronterasHorario([0, 0, 0, 0], scheduleIndex)).toEqual([]);
    expect(margenAFrontera(12, 0, [])).toBeNull();
    expect(margenAFrontera(12, 0, null)).toBeNull();
  });

  it("★ el testigo del lead: reloj 19:07 contra una frontera a las 21:00 = 113 min", () => {
    expect(margenAFrontera(19, 7, [21])).toBe(113);
    expect(margenAFrontera(19, 23, [21])).toBe(97);
  });

  it("⚠ el margen va por el CÍRCULO de 24 h: 23:50 está a 10 min de una frontera a las 00:00", () => {
    expect(margenAFrontera(23, 50, [0])).toBe(10); // un Math.abs pelado daría 1430
    expect(margenAFrontera(0, 10, [0])).toBe(10);
  });

  it("con varias fronteras se toma la MÁS CERCANA", () => {
    expect(margenAFrontera(10, 0, [9, 17, 21])).toBe(60);
    expect(margenAFrontera(16, 30, [9, 17, 21])).toBe(30);
  });
});
