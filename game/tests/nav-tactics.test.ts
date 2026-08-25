/**
 * Unit de las TÁCTICAS PURAS del pather (e2e/grandtour/nav-tactics.ts) — fixes F1-F3
 * del carril tour-telemetry (aprobados por ruling del lead 2026-07-23 tras la 1ª
 * cosecha de telemetría: ch12 ×1020 acciones, ch10 ×614, oscilaciones ×25-30).
 */
import { describe, expect, it } from "vitest";
import { blockingYesNoAction, guardPromptAction, tributePaymentVerdict, guardChargeFor, LOC_MINOC, isGoalBump, OscillationDamper, RetryThrottle } from "../e2e/grandtour/nav-tactics";

const passable = (t: number): boolean => t === 4; // tabla juguete: sólo el tile 4 se pisa

describe("F1 isGoalBump — walkTo exacto contra casilla no-transitable", () => {
  it("detecta el goal-bump: objetivo no-pisable en modo exacto", () => {
    expect(isGoalBump(79, false, passable)).toBe(true); // StoneBrickWall (caso ch10 real)
  });
  it("NO dispara en modo adjacent (el BFS nunca pisa el objetivo)", () => {
    expect(isGoalBump(79, true, passable)).toBe(false);
  });
  it("NO dispara con objetivo pisable ni fuera de mapa", () => {
    expect(isGoalBump(4, false, passable)).toBe(false);
    expect(isGoalBump(undefined, false, passable)).toBe(false);
  });
});

describe("F2 RetryThrottle — firma de fallo repetida → espera agrupada", () => {
  it("espera 1 mientras la firma cambia; agrupa (5) a la 3ª repetición idéntica", () => {
    const t = new RetryThrottle();
    expect(t.note("npc@5,7:party@3,3")).toBe(1);
    expect(t.note("npc@5,7:party@3,3")).toBe(1);
    expect(t.note("npc@5,7:party@3,3")).toBe(5); // 3ª idéntica → agrupada
    expect(t.note("npc@5,7:party@3,3")).toBe(5); // sigue agrupando mientras no cambie
  });
  it("una firma DISTINTA resetea la paciencia (la situación cambió)", () => {
    const t = new RetryThrottle();
    t.note("a");
    t.note("a");
    expect(t.note("b")).toBe(1); // cambio → cuenta desde 1
    expect(t.note("b")).toBe(1);
    expect(t.note("b")).toBe(5);
  });
  it("threshold y groupedWait son configurables; reset() limpia", () => {
    const t = new RetryThrottle(2, 7);
    t.note("x");
    expect(t.note("x")).toBe(7);
    t.reset();
    expect(t.note("x")).toBe(1);
  });
});

describe("F3 OscillationDamper — A-B-A-B → espera en vez de paso", () => {
  it("detecta dos ciclos A-B completos y pide ESPERAR; luego re-acumula desde cero", () => {
    const d = new OscillationDamper();
    expect(d.next("A")).toBe(false);
    expect(d.next("B")).toBe(false);
    expect(d.next("A")).toBe(false);
    expect(d.next("B")).toBe(true); // A-B-A-B completo → hold
    // tras el hold el historial se limpia: hacen falta otras 4 para re-disparar
    expect(d.next("A")).toBe(false);
    expect(d.next("B")).toBe(false);
    expect(d.next("A")).toBe(false);
    expect(d.next("B")).toBe(true);
  });
  it("NO dispara en marcha normal (posiciones que avanzan) ni en A-A-A-A (quieto)", () => {
    const d = new OscillationDamper();
    for (const k of ["p1", "p2", "p3", "p4", "p5"]) expect(d.next(k)).toBe(false);
    d.reset();
    for (let i = 0; i < 6; i++) expect(d.next("A")).toBe(false); // quieto ≠ oscilar
  });
  it("NO dispara con ciclo de 3 (A-B-C-A-B-C, rodeo legítimo)", () => {
    const d = new OscillationDamper();
    for (const k of ["A", "B", "C", "A", "B", "C", "A", "B"]) expect(d.next(k)).toBe(false);
  });
});

describe("F4 guardPromptAction — el arnés NO debe aceptar el arresto (task #51)", () => {
  it("el tributo se PAGA ('y' es el ruling del lead)", () => {
    expect(guardPromptAction("guard-tribute")).toBe("pay");
  });
  it("★ el ARRESTO aborta: 'y' sería «come quietly» y entierra la causa", () => {
    expect(guardPromptAction("guard-arrest")).toBe("arrested");
  });
  it("cualquier otro tag (o ninguno) no toca nada", () => {
    expect(guardPromptAction(null)).toBe("none");
    expect(guardPromptAction(undefined)).toBe("none");
    expect(guardPromptAction("shop-panel")).toBe("none");
  });
});

describe("blockingYesNoAction — la tabla del ESPEJO: el peaje de trolls se REHÚSA", () => {
  it("el peaje → 'refuse': la decisión son los 4 overlays `expectDelta: 0` del corpus", () => {
    expect(blockingYesNoAction("troll-toll")).toBe("refuse");
  });

  it("★★ INVARIANCIA DEL GRAND TOUR: para su tabla el peaje sigue siendo 'none'", () => {
    // `payGuardIfPrompted` (nav.ts) hace press('y') para todo lo que no sea none/arrested y
    // luego aplica el veredicto de pago del TRIBUTO. Si el peaje entrase por ahí, el tour
    // pagaría el peaje y reventaría en un aserto con causa ajena. Las DOS tablas separadas
    // son justamente esta propiedad, y aquí se assertea en vez de confiarse.
    expect(guardPromptAction("troll-toll")).toBe("none");
  });

  it("DELEGA los dos tags de guardia — las dos tablas no pueden divergir", () => {
    for (const tag of ["guard-tribute", "guard-arrest", "shop-panel", null, undefined]) {
      expect(blockingYesNoAction(tag), `tag=${String(tag)}`).toBe(guardPromptAction(tag));
    }
  });
});

describe("F4 tributePaymentVerdict — el beat de PAGO con ASERTO (task #52 / #46)", () => {
  // El caso canónico de la cadena: party de 2 vivos ⇒ tributo 20 (10 gp × vivo,
  // guardDemand TALK 0x0230-0x0269), pagado con el oro pineado por entryGold.
  it("pago CANÓNICO: el oro baja 10×vivos y el prompt queda cerrado", () => {
    expect(tributePaymentVerdict({ gold: 200, living: 2, loc: 1 }, { gold: 180, tag: null })).toBe("ok");
  });

  it("★ cobro de MENOS: no es el importe modelado", () => {
    expect(tributePaymentVerdict({ gold: 200, living: 2, loc: 1 }, { gold: 190, tag: null })).toBe("amount");
  });

  it("★ cobro de MÁS: tampoco", () => {
    expect(tributePaymentVerdict({ gold: 200, living: 2, loc: 1 }, { gold: 170, tag: null })).toBe("amount");
  });

  it("★ el oro NO se movió: es la firma de que el pago no ocurrió (¿arresto?)", () => {
    expect(tributePaymentVerdict({ gold: 1, living: 2, loc: 1 }, { gold: 1, tag: null })).toBe("amount");
  });

  it("★ prompt todavía ABIERTO tras pagar el importe correcto: el guardia no quedó satisfecho", () => {
    expect(tributePaymentVerdict({ gold: 200, living: 2, loc: 1 }, { gold: 180, tag: "guard-tribute" })).toBe("prompt");
  });

  // El importe DEPENDE de los vivos, no es la constante 20. Un party al techo de 6 paga 60.
  // Sin este caso, un mutante que devolviera `before.gold - 20` pasaría los de arriba.
  it("★ el importe escala con los VIVOS, no es la constante 20", () => {
    expect(tributePaymentVerdict({ gold: 200, living: 6, loc: 1 }, { gold: 140, tag: null })).toBe("ok");
    expect(tributePaymentVerdict({ gold: 200, living: 6, loc: 1 }, { gold: 180, tag: null })).toBe("amount");
  });

  // El ORDEN importa: con importe malo Y prompt abierto manda "amount", que es el
  // diagnóstico de la causa (el prompt abierto sería su consecuencia).
  it("importe malo Y prompt abierto ⇒ manda el importe (la causa, no la consecuencia)", () => {
    expect(tributePaymentVerdict({ gold: 200, living: 2, loc: 1 }, { gold: 200, tag: "guard-arrest" })).toBe("amount");
  });
});

describe("F4 guardChargeFor — Minoc es CARIDAD, no tributo (task #52)", () => {
  // blackthorn.ts:647 (0x01f3 cmp [g_location],5): en Minoc aceptar es gold/2 y devuelve
  // SIEMPRE ret 0. Sin este caso el aserto del beat acusaría en falso a una caridad legítima.
  it("★ en Minoc el cobro es la MITAD (trunc), no 10×vivos", () => {
    expect(guardChargeFor({ gold: 200, living: 2, loc: LOC_MINOC })).toBe(100);
    expect(tributePaymentVerdict({ gold: 200, living: 2, loc: LOC_MINOC }, { gold: 100, tag: null })).toBe("ok");
  });

  it("★ la caridad TRUNCA (oro impar): 51 → 25 se lleva 26", () => {
    expect(guardChargeFor({ gold: 51, living: 2, loc: LOC_MINOC })).toBe(26);
    expect(tributePaymentVerdict({ gold: 51, living: 2, loc: LOC_MINOC }, { gold: 25, tag: null })).toBe("ok");
  });

  it("★ un cobro de TRIBUTO en Minoc sería el error (la rama equivocada)", () => {
    expect(tributePaymentVerdict({ gold: 200, living: 2, loc: LOC_MINOC }, { gold: 180, tag: null })).toBe("amount");
  });

  it("la caridad con 1 gp no se lleva nada (trunc(1/2)=0) y sigue siendo válida", () => {
    expect(guardChargeFor({ gold: 1, living: 2, loc: LOC_MINOC })).toBe(1);
  });

  it("fuera de Minoc manda el tributo 10×vivos", () => {
    expect(guardChargeFor({ gold: 200, living: 2, loc: 1 })).toBe(20);
    expect(guardChargeFor({ gold: 200, living: 3, loc: 4 })).toBe(30);
  });
});
