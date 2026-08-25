/**
 * VENTANA `comparador-bandas` — LOS CUATRO PREDICADOS, CON SUS DIENTES.
 *
 * Cada bloque de tests fija DOS cosas a la vez, y esa es la forma deliberada:
 *   1. **que el defecto EXISTÍA** — se asierta el comportamiento del perfil congelado
 *      `ad-pre-bandas` (el comparador VIEJO). Si alguien «arreglara» el viejo, estos asertos
 *      caen y avisan de que la línea base del A/B ha dejado de ser la línea base.
 *   2. **que el remedio lo corrige** — se asierta el perfil vigente.
 * Un test que sólo mirara el lado nuevo no distinguiría «lo arreglé» de «nunca estuvo roto»
 * ([[control-verde-sin-dientes]]).
 *
 * El control que manda el encargo está en el último describe: una POBLACIÓN de bloques normales
 * cuya cifra exacta queda PINEADA — los predicados nuevos no pueden tocar ni uno.
 *
 * Pre-registro: re/notes/comparador-bandas-preregistro.md
 */
import { describe, it, expect } from "vitest";
import { diffSegment, bestDiceWindow, type Segment } from "../e2e/espejo-tour/runner";
import { AD_PROFILE, AD_PRE_BANDAS_PROFILE, LP1_PROFILE, LP1_PRE_BANDAS_PROFILE, coverageRatio, coverageRatioMonotone } from "../e2e/espejo-tour/ocr-profile";
import { shopGreetingLines, shopGreetingPoolTypes } from "../e2e/espejo-tour/shop-greeting";

type Blk = { ocrLn: number; text: string; class?: string };
type Op = Record<string, unknown>;

const seg = (expect_: Blk[], script: Op[] = [], extra: Partial<Segment> = {}): Segment =>
  ({
    id: "t-g01",
    ctx: "test",
    seam: null,
    script,
    expect: expect_.map((b) => ({ ocrLn: b.ocrLn, text: b.text, class: b.class ?? "auto" })),
    ...extra,
  }) as unknown as Segment;

/** veredicto+clase de cada bloque, con el perfil que se le pase. */
const run = (s: Segment, lines: string[], profile = AD_PROFILE): Array<{ v: string; c: string }> =>
  diffSegment(s, lines, profile).blocks.map((b) => ({ v: b.verdict, c: b.class }));

// ══════════════════════════════════════════════════════════════════════════════════════════
describe("F4-f · coverageRatio: el teselado GREEDY NO ES MONÓTONO en el transcript", () => {
  // ★ EL CONTRAEJEMPLO MÍNIMO, que es el mecanismo entero de la mitad de F4-f.
  it("añadir texto al transcript PIERDE cobertura (hay2 ⊃ hay1 y cobertura 1.000 → 0.667)", () => {
    const needle = "ABCDEF";
    const hay1 = "xxABCxxDEFxx";
    const hay2 = hay1 + "ABCD"; // superconjunto ESTRICTO
    expect(coverageRatio(needle, hay1, 3)).toBe(1);
    expect(coverageRatio(needle, hay2, 3)).toBeCloseTo(2 / 3, 5); // 🔴 el defecto
    // y el estimador nuevo no puede hacer eso:
    expect(coverageRatioMonotone(needle, hay1, 3)).toBe(1);
    expect(coverageRatioMonotone(needle, hay2, 3)).toBe(1);
  });

  it("MONOTONÍA como propiedad: sobre 400 casos aleatorios, ampliar `hay` nunca baja la cobertura", () => {
    // Generador determinista (LCG) — un test de propiedad que no puede ser flaky.
    let s = 12345;
    const rnd = (n: number): number => ((s = (s * 1103515245 + 12345) & 0x7fffffff), s % n);
    const alfa = "abcde";
    let bajadasGreedy = 0;
    for (let k = 0; k < 400; k++) {
      const needle = Array.from({ length: 6 + rnd(14) }, () => alfa[rnd(alfa.length)]).join("");
      const hay1 = Array.from({ length: 20 + rnd(40) }, () => alfa[rnd(alfa.length)]).join("");
      const hay2 = hay1 + Array.from({ length: 1 + rnd(12) }, () => alfa[rnd(alfa.length)]).join("");
      expect(coverageRatioMonotone(needle, hay2, 3)).toBeGreaterThanOrEqual(coverageRatioMonotone(needle, hay1, 3));
      if (coverageRatio(needle, hay2, 3) < coverageRatio(needle, hay1, 3)) bajadasGreedy++;
    }
    // DIENTES: el greedy no sólo puede bajar en teoría — baja de verdad en esta población.
    // Si este número fuera 0, el test de monotonía de arriba no probaría nada.
    expect(bajadasGreedy).toBeGreaterThan(0);
  });

  it("nunca subestima al greedy (es la MISMA definición, computada de verdad)", () => {
    let s = 999;
    const rnd = (n: number): number => ((s = (s * 1103515245 + 12345) & 0x7fffffff), s % n);
    const alfa = "abcd";
    for (let k = 0; k < 300; k++) {
      const needle = Array.from({ length: 6 + rnd(16) }, () => alfa[rnd(alfa.length)]).join("");
      const hay = Array.from({ length: 20 + rnd(40) }, () => alfa[rnd(alfa.length)]).join("");
      expect(coverageRatioMonotone(needle, hay, 3)).toBeGreaterThanOrEqual(coverageRatio(needle, hay, 3));
    }
  });
});

// ══════════════════════════════════════════════════════════════════════════════════════════
describe("F4-f · fuzzy: la REJILLA depende de la FASE; el barrido exacto no", () => {
  const cb = "thepocketwatcreads328amandtheskyisclear";
  const core = "zzz" + "thepocketwatchreads328amandtheskyisclear" + "zzz";
  /** la rejilla histórica, replicada aquí para poder MEDIR su defecto (no se importa: es código
   *  que vive dentro de `diffSegment` y aquí sólo hace de testigo). */
  const rejilla = (a: string, T: string): number => {
    const w = Math.max(a.length, 8);
    const step = Math.max(2, Math.floor(w / 6));
    let best = 0;
    for (let i = 0; i + Math.floor(w * 0.7) <= T.length; i += step) {
      const b = T.slice(i, i + w);
      const g = (x: string): Map<string, number> => {
        const m = new Map<string, number>();
        for (let j = 0; j < x.length - 1; j++) m.set(x.slice(j, j + 2), (m.get(x.slice(j, j + 2)) ?? 0) + 1);
        return m;
      };
      const ga = g(a);
      const gb = g(b);
      let inter = 0;
      for (const [k, n] of ga) inter += Math.min(n, gb.get(k) ?? 0);
      const sc = (2 * inter) / (a.length - 1 + (b.length - 1));
      if (sc > best) best = sc;
    }
    return best;
  };

  it("🔴 la rejilla OSCILA sólo moviendo el prefijo del transcript; el exacto es INVARIANTE", () => {
    const rej = new Set<string>();
    const exa = new Set<string>();
    for (let pad = 0; pad < 8; pad++) {
      const T = "q".repeat(pad) + core;
      rej.add(rejilla(cb, T).toFixed(4));
      exa.add(bestDiceWindow(cb, T).best.toFixed(4));
    }
    expect(rej.size).toBeGreaterThan(1); // el defecto EXISTE (si esto fuera 1, no habría nada que arreglar)
    expect(exa.size).toBe(1); // el remedio
  });

  // ★★ ESTE TEST EXISTE PORQUE UN MUTANTE SOBREVIVIÓ. Los dos de arriba prueban `bestDiceWindow`
  // y la rejilla por separado, pero NINGUNO pasaba por `diffSegment`: apagar la palanca
  // `fuzzyExactScan` dejaba la suite entera en VERDE (M5, 0 rojos). O sea, la palanca no estaba
  // protegida y una reversión silenciosa habría pasado el gate. Aquí se mide lo que el comparador
  // REPORTA (`sim` del bloque) con cada perfil, que es la magnitud que decide el veredicto.
  it("★ la PALANCA enruta al estimador: con `ad-pre-bandas` el `sim` reportado OSCILA; con `ad`, no", () => {
    // el bloque tiene que llegar VIVO a la etapa fuzzy: con OCR poco corrupto casa antes por
    // cobertura y el `sim` que se reporta ya no es el del barrido (primera versión de este test).
    const bloque = { ocrLn: 1, text: "Thu dst find a smal chst hre in th dark rom" };
    const sims = (profile: typeof AD_PROFILE): Set<string> => {
      const out = new Set<string>();
      for (let pad = 0; pad < 10; pad++) {
        // el bloque NO casa entero: la corrupción del OCR lo deja en la banda del fuzzy, que es
        // donde vive el defecto. Lo que se mueve entre iteraciones es SÓLO el prefijo de `T`.
        const T = ["z".repeat(pad) + "North", "Thou dost find a small chest here in the dark room", "South"];
        const b = diffSegment(seg([bloque]), T, profile).blocks[0]!;
        out.add(String(b.sim));
      }
      return out;
    };
    expect(sims(AD_PRE_BANDAS_PROFILE).size).toBeGreaterThan(1); // 🔴 el defecto, a través del comparador
    expect(sims(AD_PROFILE).size).toBe(1); // el remedio, a través del comparador
  });

  it("el barrido exacto coincide con la FUERZA BRUTA sobre todas las ventanas", () => {
    let s = 4242;
    const rnd = (n: number): number => ((s = (s * 1103515245 + 12345) & 0x7fffffff), s % n);
    const alfa = "abcdef ";
    for (let k = 0; k < 120; k++) {
      const a = Array.from({ length: 8 + rnd(20) }, () => alfa[rnd(alfa.length)]).join("");
      const T = Array.from({ length: 40 + rnd(80) }, () => alfa[rnd(alfa.length)]).join("");
      const w = Math.max(a.length, 8);
      let bruto = 0;
      for (let i = 0; i + Math.floor(w * 0.7) <= T.length; i++) {
        const b = T.slice(i, i + w);
        const g = (x: string): Map<string, number> => {
          const m = new Map<string, number>();
          for (let j = 0; j < x.length - 1; j++) m.set(x.slice(j, j + 2), (m.get(x.slice(j, j + 2)) ?? 0) + 1);
          return m;
        };
        const ga = g(a);
        const gb = g(b);
        let inter = 0;
        for (const [q, n] of ga) inter += Math.min(n, gb.get(q) ?? 0);
        const sc = (2 * inter) / (a.length - 1 + (b.length - 1));
        if (sc > bruto) bruto = sc;
      }
      expect(bestDiceWindow(a, T).best).toBeCloseTo(bruto, 9);
    }
  });
});

// ══════════════════════════════════════════════════════════════════════════════════════════
describe("F-5 · el desenlace de combate CURADO es una lotería DE UN SOLO FILO", () => {
  const desenlace = { ocrLn: 10, text: "BATTLE IS L0ST!", class: "exact" };
  const vecino = { ocrLn: 11, text: "North" };

  it("🔴 VIEJO: si el port pierde un combate ahí, el billete PREMIADO entra como match (+1/+1)", () => {
    const r = diffSegment(seg([desenlace, vecino]), ["Attacked!", "SNAKES", "BATTLE IS LOST!", "North"], AD_PRE_BANDAS_PROFILE);
    expect(r.blocks[0]!.verdict).toBe("match");
    expect(r.comparable).toBe(2);
    expect(r.matched).toBe(2);
  });

  it("🔴 VIEJO: si NO lo pierde, el mismo bloque sale del denominador (0/0) — la asimetría", () => {
    const r = diffSegment(seg([desenlace, vecino]), ["North"], AD_PRE_BANDAS_PROFILE);
    expect(r.blocks[0]!.class).toBe("combat-rng-curado");
    expect(r.comparable).toBe(1); // ← sólo el vecino
  });

  it("NUEVO: sale del denominador en los DOS casos, y con contador propio", () => {
    for (const lines of [["Attacked!", "SNAKES", "BATTLE IS LOST!", "North"], ["North"]]) {
      const r = diffSegment(seg([desenlace, vecino]), lines, AD_PROFILE);
      expect(r.blocks[0]!.verdict).toBe("combat-rng");
      expect(r.blocks[0]!.class).toBe("combat-outcome-rng");
      expect(r.combatOutcomeRng).toBe(1);
      expect(r.comparable).toBe(1); // el vecino, y sólo el vecino
    }
  });

  it("NO captura un bloque de clase AUTO (ése ya lo declara `rng` la política histórica)", () => {
    const r = diffSegment(seg([{ ocrLn: 10, text: "BATTLE IS L0ST!" }]), ["North"], AD_PROFILE);
    expect(r.blocks[0]!.class).not.toBe("combat-outcome-rng");
    expect(r.combatOutcomeRng).toBe(0);
  });

  it("NO captura un bloque CURADO que no sea un desenlace (aunque esté en un combate)", () => {
    const r = diffSegment(
      seg([{ ocrLn: 10, text: "Thou dost find a chest", class: "exact" }]),
      ["Attacked!", "SNAKES", "BATTLE IS LOST!"],
      AD_PROFILE,
    );
    expect(r.blocks[0]!.class).not.toBe("combat-outcome-rng");
    expect(r.combatOutcomeRng).toBe(0);
  });

  // ★ RECALIBRADO POR EL RULING DEL LEAD (01-08). La primera entrega dejó la palanca apagada en
  // LP1 y este test lo fijaba. El lead ruló que la exclusión **se aplica también a LP1**, por el
  // CUARTO criterio del marco —SIMETRÍA—: el mecanismo es idéntico (el desenlace es RNG del port)
  // y un predicado estructural no puede depender del corpus que mide. Se recalibra con motivo, y
  // el comportamiento viejo se conserva en el perfil `lp1-pre-bandas` para que el A/B lo mida.
  it("★ con perfil LP1 la palanca está ENCENDIDA (ruling del lead 01-08: simetría)", () => {
    const r = diffSegment(seg([desenlace, vecino]), ["BATTLE IS LOST!", "North"], LP1_PROFILE);
    expect(r.blocks[0]!.class).toBe("combat-outcome-rng");
    expect(r.combatOutcomeRng).toBe(1);
    expect(r.comparable).toBe(1); // el billete PREMIADO sale del numerador Y del denominador
    // el brazo «antes» conserva el comportamiento viejo: en LP1 el billete ni siquiera se
    // declasificaba al final (`combatOverridesCuratedClass` es false), así que CASABA.
    const antes = diffSegment(seg([desenlace, vecino]), ["BATTLE IS LOST!", "North"], LP1_PRE_BANDAS_PROFILE);
    expect(antes.blocks[0]!.verdict).toBe("match");
    expect(antes.comparable).toBe(2);
  });
});

// ══════════════════════════════════════════════════════════════════════════════════════════
describe("SALUDOS · el predicado es el ancla, y el HERRERO no entra", () => {
  const saludo = { ocrLn: 84, text: 'Talk-East "Fair morning, adventurer. I, Jessica, do bid thee welcome"' };
  const otro = { ocrLn: 90, text: "North" };
  const anclaDe = (match: string, ocrLn = 84): Op[] => [{ key: "t", ocrLn, anchor: { kind: "npc", cmd: "talk", match, ocrLn } }];

  it("la tabla de pool tiene los 7 tipos del rand(0,3) y NO al Blacksmith", () => {
    expect(shopGreetingPoolTypes()).toEqual([
      "Barkeeper", "GuildMaster", "Healer", "HorseSeller", "InnKeeper", "MagicSeller", "Shipwright",
    ]);
    expect(shopGreetingPoolTypes()).not.toContain("Blacksmith");
  });

  it("🔴 VIEJO: el saludo es lotería de DOS filos — casa (+1/+1) o cuenta como fallo (0/1)", () => {
    const conSuerte = diffSegment(seg([saludo, otro], anclaDe("shop:Healer")), ['"Fair morning, adventurer. I, Jessica, do bid thee welcome"', "North"], AD_PRE_BANDAS_PROFILE);
    expect(conSuerte.matched).toBe(2);
    expect(conSuerte.comparable).toBe(2);
    const sinSuerte = diffSegment(seg([saludo, otro], anclaDe("shop:Healer")), ['"I bid thee welcome in our sanctum, wanderer."', "North"], AD_PRE_BANDAS_PROFILE);
    expect(sinSuerte.blocks[0]!.verdict).toBe("divergent"); // ← el 3/4 que NO es deuda de nadie
    expect(sinSuerte.comparable).toBe(2);
  });

  it("NUEVO: sale del denominador tire lo que tire el port, con contador propio", () => {
    for (const lines of [['"Fair morning, adventurer. I, Jessica, do bid thee welcome"', "North"], ['"I bid thee welcome in our sanctum, wanderer."', "North"]]) {
      const r = diffSegment(seg([saludo, otro], anclaDe("shop:Healer")), lines, AD_PROFILE);
      expect(r.blocks[0]!.class).toBe("shop-greeting-rng");
      expect(r.blocks[0]!.verdict).toBe("rng");
      expect(r.shopGreetingRng).toBe(1);
      expect(r.comparable).toBe(1);
    }
  });

  // ★★ EL CONTROL QUE CORRIGIÓ EL PRE-REGISTRO. El herrero no pasa por rand(0,3): su fila de la
  // tabla DS 0x3b2a está a cero y saluda por vía propia con plantilla FIJA. Un predicado sobre
  // todo `shop:*` habría borrado 12 bloques ADJUDICABLES del corpus AD.
  it("★ el saludo del BLACKSMITH NO se excluye: es fijo, y por tanto adjudicable", () => {
    const r = diffSegment(seg([saludo, otro], anclaDe("shop:Blacksmith")), ["North"], AD_PROFILE);
    expect(r.blocks[0]!.class).not.toBe("shop-greeting-rng");
    expect(r.shopGreetingRng).toBe(0);
    expect(r.comparable).toBe(2); // el saludo del herrero SIGUE contando
    expect(shopGreetingLines(anclaDe("shop:Blacksmith").map((o) => o.anchor as never)).size).toBe(0);
  });

  it("sólo toca la LÍNEA del ancla: un bloque vecino del mismo segmento queda intacto", () => {
    const r = diffSegment(seg([saludo, otro], anclaDe("shop:Healer")), ["North"], AD_PROFILE);
    expect(r.blocks[1]!.class).not.toBe("shop-greeting-rng");
    expect(r.blocks[1]!.verdict).toBe("match");
  });

  it("un ancla de CARA (kind face) o sin `shop:` no captura nada", () => {
    expect(shopGreetingLines([{ kind: "face", ocrLn: 84, match: "shop:Healer" }]).size).toBe(0);
    expect(shopGreetingLines([{ kind: "npc", ocrLn: 84, match: "d134" }]).size).toBe(0);
    expect(shopGreetingLines([{ kind: "npc", match: "shop:Healer" }]).size).toBe(0); // sin ocrLn
  });

  // ★ RECALIBRADO por el mismo ruling. En LP1 la palanca está encendida por SIMETRÍA aunque sea
  // INERTE sobre el corpus real: `censo_saludos_ancla.mjs` da **0 anclas de tienda que caigan
  // sobre un bloque** en `routes/`. Que sea inerte hoy no es motivo para dejar el predicado
  // dependiendo del corpus — y este test lo demuestra con un segmento sintético que SÍ la tiene.
  it("★ con perfil LP1 la palanca está ENCENDIDA, aunque sobre el corpus real capture 0", () => {
    const r = diffSegment(seg([saludo, otro], anclaDe("shop:Healer")), ["North"], LP1_PROFILE);
    expect(r.shopGreetingRng).toBe(1);
    expect(diffSegment(seg([saludo, otro], anclaDe("shop:Healer")), ["North"], LP1_PRE_BANDAS_PROFILE).shopGreetingRng).toBe(0);
  });
});

// ══════════════════════════════════════════════════════════════════════════════════════════
describe("★ CONTROL DE NO-CAPTURA: la población normal queda INTACTA (cifra pineada)", () => {
  // 24 bloques de material corriente del corpus (movimiento, puertas, búsquedas, diálogo que no
  // es saludo de pool, panel, combate NO curado). Ninguno puede ser tocado por los predicados
  // nuevos. La cifra va PINEADA: si un predicado se ensancha, este número se mueve y el test cae.
  const POBLACION: string[] = [
    "0pen-West", "Vpen-North", "Blocked!", "Your interest?", "Slow progress", "Very slow!",
    "North", "South", "East", "West", "Klimb-Vp", "Search-East",
    "Thou dost find", "Nothing of note.", "Z-stat", "Ignite torch!", "0pened!", "Get-2",
    'Talk-North "Hail, friend! Wouldst thou Buy or Sell?"',
    "d...Iron Helm e...Large Shiel f...Scale Mail",
    '"We sell ocean-going Frigates and small, ligh Skiffs"',
    "Min, armed with Magic Axe:", "Troll missed!", "The pocket watc reads 3:28 AM.",
  ];
  const bloques = POBLACION.map((text, i) => ({ ocrLn: 100 + i, text }));
  // un ancla de saludo en el segmento, apuntando a una línea que NO es de la población
  const script: Op[] = [{ key: "t", anchor: { kind: "npc", cmd: "talk", match: "shop:Healer", ocrLn: 84 } }];
  const T = POBLACION.slice(0, 12); // el port dice la mitad: hay matches Y divergentes

  it("los predicados de EXCLUSIÓN no capturan NI UNO de los 24", () => {
    const r = diffSegment(seg(bloques, script), T, AD_PROFILE);
    expect(r.combatOutcomeRng).toBe(0);
    expect(r.shopGreetingRng).toBe(0);
    expect(r.blocks.filter((b) => b.class === "combat-outcome-rng" || b.class === "shop-greeting-rng")).toHaveLength(0);
  });

  it("★ con las exclusiones encendidas y los ROBUSTECIMIENTOS apagados, los 24 veredictos son IDÉNTICOS al comparador viejo", () => {
    // Aísla el efecto: lo que mueve veredictos de material adjudicable es el robustecimiento
    // (declarado como relajación en el pre-registro §3.3), NUNCA las exclusiones.
    const soloExclusiones = { ...AD_PROFILE, id: "ad-solo-exclusiones", coverageMonotone: false, fuzzyExactScan: false };
    const viejo = run(seg(bloques, script), T, AD_PRE_BANDAS_PROFILE);
    const nuevo = run(seg(bloques, script), T, soloExclusiones);
    expect(nuevo).toEqual(viejo);
    expect(viejo).toHaveLength(24); // ← cifra PINEADA de la población de control
  });

  it("y el robustecimiento sólo puede mover en UNA dirección (divergent → covered/fuzzy)", () => {
    const viejo = run(seg(bloques, script), T, AD_PRE_BANDAS_PROFILE);
    const nuevo = run(seg(bloques, script), T, AD_PROFILE);
    for (let i = 0; i < viejo.length; i++) {
      if (viejo[i]!.v === nuevo[i]!.v) continue;
      expect(viejo[i]!.v).toBe("divergent"); // nunca al revés
      expect(["covered", "fuzzy", "match"]).toContain(nuevo[i]!.v);
    }
  });
});

// ══════════════════════════════════════════════════════════════════════════════════════════
describe("★★ INVARIANCIA ANTE ΔT — el criterio de éxito de F4-f (C3 del pre-registro)", () => {
  // El churn de F4-f dice: cuando el port emite MÁS texto, se re-encuadran las ventanas de
  // `covered`/`fuzzy` de bloques que no tienen nada que ver. Se mide directamente: se INYECTA
  // texto ajeno en el transcript y se cuenta cuántos bloques cambian de veredicto.
  // ★ EL BLOQUE CON DIENTES, y no es decorativo. La primera versión de este fixture usaba
  // material «realista» (`0pen-West`, `Blocked!`, la lista del herrero) y daba **0 cambios en los
  // DOS brazos**: un control verde que no probaba nada ([[control-verde-sin-dientes]]). El
  // fixture que sí tiene dientes se CONSTRUYE desde el contraejemplo ya demostrado arriba: con
  // `minTile=5`, un bloque `X(5)+Y(5)` cuyas dos mitades están en `T` se cubre entero… hasta que
  // el port emite en otro sitio la cadena `X+Y[0]` (6 caracteres), que descarrila el teselado
  // greedy y tira la cobertura a 0,6. Los caracteres son estables bajo el plegado de glifos del
  // perfil AD (nada de c/g/l/v/y/0/1/6), para que el fixture pruebe el teselado y no el colapso.
  const CEBO = "abdef hjkmn"; // → colapsa a "abdefhjkmn"
  const BLOQUES = [
    CEBO,
    "The pocket watc reads 3:28 AM.", "Thou dost flnd a gold nugget here", "0pen-West 0pened!",
    "Your interest? You respond-", "d...Iron Helm e...Large Shiel f...Scale Mail g...Plate Mail",
    "Talk-South Welcome to The Smugglers Inn I am Lorie", "Blocked! Very slow!",
    "F]v North Blocked!", "5earch-East Thou dost find", "Z-stat Player Min Status Good",
  ].map((text, i) => ({ ocrLn: 200 + i, text }));
  const PORT = [
    "North abdef zz", "hjkmn South",
    "The pocket watch reads 3:28 AM.", "Thou dost find a gold nugget here", "Open-West", "Opened!",
    "Your interest?", "You respond-", "d...Iron Helm", "e...Large Shield", "f...Scale Mail",
    "g...Plate Mail", "Talk-South", "Welcome to The Smugglers Inn, I am Lorie", "Blocked!",
    "Very slow!", "North", "Search-East", "Thou dost find", "Player: Min",
  ];
  /** lo que un fix hace emitir DE MÁS al port: diálogo de tienda que antes no salía, más una cola
   *  que contiene `abdefh` — o sea, texto AJENO al bloque del cebo y que sin embargo le cuesta el
   *  casado con el comparador viejo. Ese es el corazón de F4-f. */
  const RELLENO = [
    "Fair morning, adventurer. I, Regina, do bid thee welcome unto The Healers Mission.",
    "May we offer thee solace?", "No", "We have powers to Cure, Heal, or Resurrect.",
    "tail abdefh",
  ];

  /** ¿el bloque cuenta, y cuenta como bueno? Es LA partición que define la conformidad. */
  const COMPARABLES = ["match", "covered", "fuzzy", "divergent"];
  const particion = (v: string): string => (COMPARABLES.includes(v) ? (v === "divergent" ? "FALLA" : "BUENO") : "FUERA");

  /** cambios inyectando el relleno en TODAS las posiciones (es lo que hace un fix del port río
   *  arriba). Devuelve los de PARTICIÓN (los que mueven la cifra) y los de sólo ETIQUETA. */
  const cambios = (profile: typeof AD_PROFILE): { particion: number; etiqueta: string[] } => {
    const base = run(seg(BLOQUES), PORT, profile).map((b) => b.v);
    let p = 0;
    const etiqueta: string[] = [];
    for (let pos = 0; pos <= PORT.length; pos++) {
      const T = [...PORT.slice(0, pos), ...RELLENO, ...PORT.slice(pos)];
      const otro = run(seg(BLOQUES), T, profile).map((b) => b.v);
      for (let i = 0; i < base.length; i++) {
        if (base[i] === otro[i]) continue;
        if (particion(base[i]!) !== particion(otro[i]!)) p++;
        else etiqueta.push(`${base[i]}→${otro[i]}`);
      }
    }
    return { particion: p, etiqueta };
  };

  it("🔴 con el comparador VIEJO la CIFRA se mueve al inyectar texto ajeno; con el NUEVO, CERO", () => {
    const viejo = cambios(AD_PRE_BANDAS_PROFILE);
    const nuevo = cambios(AD_PROFILE);
    expect(viejo.particion).toBeGreaterThan(0); // el churn de F4-f, reproducido en un test
    expect(nuevo.particion).toBe(0); // ★ la propiedad que se exige: la conformidad no se mueve
  });

  // ★★ EL RESIDUO, MEDIDO Y NOMBRADO EN VEZ DE ESCONDIDO. El pre-registro (P6) pedía «0 bloques
  // cambian de VEREDICTO». Medido, con el comparador nuevo quedan cambios `match ↔ covered`, y
  // NO son churn: los dos veredictos están del mismo lado de la partición, así que la cifra no
  // se mueve. Su causa es otra y es LEGÍTIMA: `T` es la concatenación de las líneas del port SIN
  // separador, así que un bloque puede casar por PATRÓN a caballo de dos líneas contiguas;
  // insertar texto entre ellas rompe esa contigüidad y el bloque pasa a casar por COBERTURA.
  // Que el comparador distinga «el port lo dijo seguido» de «lo dijo a trozos» es información,
  // no ruido. Se fija aquí para que el residuo no pueda crecer en silencio hacia la partición.
  it("★ el residuo que QUEDA es sólo de etiqueta `match↔covered`, y ninguno cambia de lado", () => {
    const nuevo = cambios(AD_PROFILE);
    expect(nuevo.etiqueta.length).toBeGreaterThan(0); // existe: se declara, no se tapa
    expect([...new Set(nuevo.etiqueta)]).toEqual(["match→covered"]);
    for (const e of new Set(nuevo.etiqueta)) {
      const [a, b] = e.split("→") as [string, string];
      expect(particion(a)).toBe("BUENO");
      expect(particion(b)).toBe("BUENO");
    }
  });
});
