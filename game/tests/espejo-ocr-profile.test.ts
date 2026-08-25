/**
 * WALKTHROUGH-ESPEJO — guardas OFFLINE de la CALIBRACIÓN POR CORPUS (relevo-3/3b).
 *
 * Lo que blindan, en orden de importancia:
 *   1. **`LP1_PROFILE` es la IDENTIDAD.** El comparador validado contra aulddragon
 *      (part01..06: 0 ANCHOR-MISS, deltas anclados verdes) NO se puede mover al recalibrar
 *      el corpus AD. Si alguien toca las clases base o el orden del plegado, revienta AQUÍ.
 *   2. Que el perfil AD retire la SEGUNDA PASADA FANTASMA sin comerse las comillas legítimas
 *      del texto del juego (el riesgo obvio del strip: «"I thank thee!" says Nilrem.»).
 *   3. Que la categoría `ocr-garbage` sea CONSERVADORA: ningún eco real del port puede caer
 *      ahí (si cayera, el comparador se estaría auto-absolviendo — divergencias silenciadas).
 *   4. Que el casado por COBERTURA no invente matches (propiedades de coverageRatio).
 *   5. Que el resync de LOCATION por costura resuelva los banners corruptos de AD y, ante la
 *      duda, devuelva `null` (mejor sin resync que una location falsa).
 *   6. El contrato del CORE del que depende el op `dismiss` (`shops.innLeave`), gemelo del
 *      blindaje que ya tiene `recruit`/`joinByName`.
 */
import { describe, it, expect } from "vitest";
import {
  LP1_PROFILE,
  LP1_PRE_BANDAS_PROFILE,
  AD_PROFILE,
  AD_PRE3C_PROFILE,
  AD_PRE_BANDAS_PROFILE,
  AD_PRE3D_PROFILE,
  AD_COMBAT_RNG,
  EQUIP_WORDS,
  probeFold,
  isRosterTail,
  profileFor,
  collapseWith,
  stripGhostPass,
  isGarbage,
  coverageRatio,
} from "../e2e/espejo-tour/ocr-profile";
import { collapse, diffSegment, seamLocationFromBanner, KEEP_BANNERS, type Segment } from "../e2e/espejo-tour/runner";
import { innLeave } from "../src/core/shops/shops";
import type { GameState } from "../src/core/state";
import inventoryDetails from "../src/core/data/InventoryDetails.json";

const seg = (texts: string[], cls = "auto"): Segment => ({
  id: "t-g01",
  ctx: "smallmap",
  seam: null,
  ocr: { from: 1, to: 99 },
  script: [],
  expect: texts.map((text, i) => ({ text, ocrLn: i + 1, class: cls })),
});

describe("perfil de OCR — LP1 es la IDENTIDAD (los números de part01..06 no se mueven)", () => {
  // Corpus deliberadamente cargado de todo lo que el perfil AD SÍ pliega (u/v/y, s/g, o/6/c)
  // más los artefactos que la clase base ya plegaba (l/I/1/]/[/|/! → i, 0/O → o).
  const CORPUS = [
    "Thou art tired! Open-West Nothing to open!",
    "0pen Vpen Klimb-Vp Eagt Wegt gee flnd toroh Dvne interest7",
    "The pocket watch reads 3:28 AM.",
    "«¿Qué?» — acentos, puntuación y \"comillas\" 1234567890",
    "wTEh\"Cr6ggH6wT\" MnrTnh,\"nrmgH\"\"",
    "",
    "I|]1[!0O",
  ];
  it("collapseWith(·, LP1) === collapse(·) sobre corpus con TODOS los glifos ambiguos", () => {
    for (const s of CORPUS) expect(collapseWith(s, LP1_PROFILE)).toBe(collapse(s));
  });
  it("el perfil por defecto (sin ESPEJO_OCR ni corpus ad) es LP1", () => {
    expect(profileFor(undefined)).toBe(LP1_PROFILE);
    expect(profileFor("no-existe")).toBe(LP1_PROFILE); // id desconocido NO cambia el comparador
    expect(profileFor("ad")).toBe(AD_PROFILE);
  });
  it("LP1 no pliega nada extra: u/v/y y s/g siguen DISTINTOS (si se plegaran, LP1 casaría de más)", () => {
    expect(collapseWith("use", LP1_PROFILE)).not.toBe(collapseWith("vse", LP1_PROFILE));
    expect(collapseWith("east", LP1_PROFILE)).not.toBe(collapseWith("eagt", LP1_PROFILE));
  });
  it("el perfil AD SÍ los pliega, y SIMÉTRICAMENTE (los dos lados del diff caen en el mismo alfabeto)", () => {
    expect(collapseWith("Vse", AD_PROFILE)).toBe(collapseWith("Use", AD_PROFILE));
    expect(collapseWith("Eagt", AD_PROFILE)).toBe(collapseWith("East", AD_PROFILE));
    expect(collapseWith("Y6ur", AD_PROFILE)).toBe(collapseWith("Your", AD_PROFILE));
    expect(collapseWith("toroh", AD_PROFILE)).toBe(collapseWith("torch", AD_PROFILE));
  });
});

describe("segunda pasada FANTASMA del OCR de AD (stripGhostPass)", () => {
  it("retira los runs con comillas INTERNAS (espacio leído como \") y sus colas", () => {
    expect(stripGhostPass('with Crossbow: wTEh"Cr6ggH6wT"')).toBe("with Crossbow:");
    expect(stripGhostPass('Player: Iolo PlayerT"Iolo"""')).toBe("Player: Iolo");
    expect(stripGhostPass('In the barrel In"the"barrel""')).toBe("In the barrel");
  });
  it("NO toca las comillas legítimas del texto del juego (el riesgo del strip)", () => {
    const legit = '"I thank thee!" says Nilrem.';
    expect(stripGhostPass(legit)).toBe(legit);
    expect(stripGhostPass('He says: "Thou art welcome."')).toBe('He says: "Thou art welcome."');
  });
  it("un bloque que ERA sólo la pasada fantasma queda sin contenido → no-comparable (ocr-ghost)", () => {
    const d = diffSegment(seg(['MnrTnh,"nrmgH""""']), ["Mariah, armed with Crossbow:"], AD_PROFILE);
    expect(d.blocks[0]!.verdict).toBe("ocr-ghost");
    expect(d.ocrGhost).toBe(1);
    expect(d.comparable).toBe(0); // no penaliza NI regala: sale del denominador
  });
  it("con LP1 ese MISMO bloque sigue siendo comparable (el perfil no se aplica fuera de AD)", () => {
    const d = diffSegment(seg(['MnrTnh,"nrmgH""""']), ["Mariah, armed with Crossbow:"], LP1_PROFILE);
    expect(d.ocrGhost).toBe(0);
    expect(d.comparable).toBe(1);
  });
});

describe("basura de área gráfica (ocr-garbage) — CONSERVADORA", () => {
  it("detecta OCR de sprite/marco sin texto detrás", () => {
    expect(isGarbage("\"w'w/\\/mt( FV `.. FY `.i JL1 ? .j;")).toBe(true);
    expect(isGarbage("`.. `.i ?.j; /\\/")).toBe(true);
  });
  it("NUNCA se come un eco real del port (si lo hiciera, silenciaría divergencias)", () => {
    for (const real of [
      "Blocked!",
      "Opened!",
      "Nothing to open!",
      "Hull weak!",
      "Rowing!",
      "Thou art tired!",
      "A magic carpet!",
      "The pocket watch reads 3:28 AM.",
      '"I thank thee!" says Donya.',
      "Min, armed with Crossbow:",
    ]) {
      expect(isGarbage(real), real).toBe(false);
    }
  });
  it("no clasifica bloques cortos (sin evidencia suficiente)", () => {
    expect(isGarbage("`.")).toBe(false);
    expect(isGarbage("")).toBe(false);
  });
});

describe("casado por COBERTURA-TILING (coverageRatio) — no inventa matches", () => {
  it("cobertura total si el needle está contiguo en el hay", () => {
    expect(coverageRatio("abcdefghij", "xxabcdefghijyy", 5)).toBe(1);
  });
  it("cobertura 1 sobre un needle vacío, 0 si el hay no tiene nada largo en común", () => {
    expect(coverageRatio("", "cualquiera", 5)).toBe(1);
    expect(coverageRatio("abcdefghij", "zzzzzzzzzz", 5)).toBe(0);
  });
  it("teselas por debajo de minTile NO cuentan (evita casar por ruido de bigramas)", () => {
    // "abcd" (4) está en el hay pero minTile=5 lo rechaza
    expect(coverageRatio("abcd", "xxabcdxx", 5)).toBe(0);
  });
  it("cuenta la fracción cubierta cuando el contenido llega A TROZOS (truncamiento del OCR)", () => {
    // needle 20 chars = dos mitades de 10 presentes por separado → cobertura total
    expect(coverageRatio("aaaaabbbbbcccccddddd", "cccccddddd___aaaaabbbbb", 5)).toBe(1);
    // la mitad presente, la otra no → ~0.5
    expect(coverageRatio("aaaaabbbbbzzzzzyyyyy", "aaaaabbbbb", 5)).toBeCloseTo(0.5, 2);
  });
  it("el umbral del perfil AD (0.85) exige casi todo el bloque", () => {
    expect(AD_PROFILE.coverage!.threshold).toBeGreaterThanOrEqual(0.85);
    expect(AD_PROFILE.coverage!.minTile).toBeGreaterThanOrEqual(5);
  });
});

describe("resync de LOCATION por costura (seamLocationFromBanner)", () => {
  // Tabla mínima con la MISMA forma que `locationNames` (ids 1-13 → idx id-1; ≥19 → idx id-6).
  const NAMES = ["Moonglow", "Britain", "Jhelom", "Yew", "Minoc", "Trinsic", "Skara Brae", "New Magincia"];
  it("keeps sin entrada en tabla: Blackthorn=18 y Lord British=17, incluso con el banner CORRUPTO", () => {
    expect(seamLocationFromBanner("PALACE OF BLACKTHORN RNOG NMG YGG", NAMES)).toBe(18);
    expect(seamLocationFromBanner("CASTLE OF LORD BRLTLSH OFTETGHT", NAMES)).toBe(17);
    // los dos ids salen del core (state.ts loc 18 / game.ts loc 0x11), no de la tabla
    expect(KEEP_BANNERS.map((k) => k.loc).sort()).toEqual([17, 18]);
  });
  it("nombre de la tabla contenido en el banner (gana el más largo)", () => {
    expect(seamLocationFromBanner("BRITAIN", NAMES)).toBe(2);
    expect(seamLocationFromBanner("SKARA BRAE", NAMES)).toBe(7);
  });
  it("banner con basura a la DERECHA: casa por bigramas sobre el PREFIJO", () => {
    expect(seamLocationFromBanner("MOONGLOW GNRBGE XX", NAMES)).toBe(1);
    expect(seamLocationFromBanner("TRLNSLC ~zg", NAMES)).toBe(6);
  });
  it("ante la duda devuelve null — MEJOR SIN RESYNC que una location falsa", () => {
    expect(seamLocationFromBanner("XQZW NNNN GGGG", NAMES)).toBeNull();
    expect(seamLocationFromBanner("", NAMES)).toBeNull();
    expect(seamLocationFromBanner("ab", NAMES)).toBeNull();
    // umbral alto explícito: un banner que no se parece a nada NO se adivina
    expect(seamLocationFromBanner("ZZZZZZZZ", NAMES, 0.95)).toBeNull();
  });
});

describe("FASE 3c — patrones de COMBATE calibrados para AD", () => {
  /**
   * EL test que importa: cada patrón tiene que casar la línea que el PORT emite de verdad,
   * pasada por `probeFold`. Los patrones se escriben en el alfabeto PLEGADO, y ahí es fácil
   * escribir un literal sin plegar (`victory` → la `v` colapsa a `u`, así que `/viotoru/` no
   * casa nunca). Dos patrones nacieron con ese bug exacto y este careo los cazó.
   * Las cadenas de abajo son las del port, con cita: banner de roster `main.ts:1219`
   * (COMBAT.OVL 0x0701-0x07af), etiquetas de herida `core/combat/combat.ts:69` (WOUND_LABELS),
   * desenlace `combat.ts:968`, huida `core/sfx.ts:251` (SJOG 0x1c37).
   */
  const PORT_COMBAT = [
    "Iolo, armed with Halberd:",
    "Geoffrey, armed with Spiked Helm, Mace, Spiked Shield:",
    "Min, armed with bare hands:",
    "Attack-Aim!",
    "Set active plr",
    "Troll missed!",
    "Iolo hit!",
    "Orc killed!",
    "Reaper critical!",
    "Dragon heavily wounded!",
    "Slime lightly wounded!",
    "Headless barely wounded!",
    "Shamino grazed!",
    "VICTORY!",
    "BATTLE IS LOST!",
    "Escape!",
  ];
  it("cada línea REAL del port cae en algún patrón (careo del alfabeto plegado)", () => {
    for (const s of PORT_COMBAT) {
      const p = probeFold(s);
      expect(AD_COMBAT_RNG.some((re) => re.test(p)), `${s} → ${p}`).toBe(true);
    }
  });
  it("las etiquetas de herida del test son las del CORE (si el core cambia, revienta aquí)", () => {
    // espejo de WOUND_LABELS (combat.ts:69) — no se puede importar (no exportada), así que se
    // CAREA el contenido: cada etiqueta viva tiene que estar cubierta por los patrones.
    for (const label of ["critical!", "heavily wounded!", "lightly wounded!", "barely wounded!"])
      expect(AD_COMBAT_RNG.some((re) => re.test(probeFold(`Troll ${label}`))), label).toBe(true);
  });

  it("las variantes del OCR de AD colapsan a la MISMA forma canónica", () => {
    for (const v of ["Attack-Alm!", "Attuck-Alm!", "Attuok-Alm!", "Attaok-Alm!"])
      expect(probeFold(v)).toBe(probeFold("Attack-Aim!"));
    expect(probeFold("VICT0RY!")).toBe(probeFold("VICTORY!"));
    expect(probeFold("kllled!")).toBe(probeFold("killed!"));
    expect(probeFold("mlgged!")).toBe(probeFold("missed!"));
    expect(probeFold("Set aotlve plr")).toBe(probeFold("Set active plr"));
  });

  it("NO barre los DOS usos no-combate de «armed» del corpus (material comparable de verdad)", () => {
    // el ancla es la COMA del banner, no la palabra desnuda
    const noCombate = [
      '"Well armed art thou to fight Death\'s embrace, O enlightened one!"', // core/game.ts:3963
      // KEEP.TLK, recortado a 11 palabras (cita corta): la muestra sólo tiene que llevar
      // «armed with …» en prosa NO-combate y una coma que no sea la del banner — que es
      // justo el ancla que se está ejerciendo. El pasaje completo eran 20 palabras de EA
      // viajando al árbol público sin que el aserto ganara nada con ellas.
      "name, for it is at the mercy of one armed with such",
    ];
    for (const s of noCombate)
      expect(AD_COMBAT_RNG.some((re) => re.test(probeFold(s))), s.slice(0, 40)).toBe(false);
  });
  it("NO barre el regateo de tienda que el `battie` DESNUDO de LP1 sí se comía", () => {
    const haggle = "Well, now. can hardly afford to give ye more than 23 gp for that battle-worn shield";
    expect(AD_COMBAT_RNG.some((re) => re.test(probeFold(haggle)))).toBe(false);
  });

  describe("cola de armas huérfana del banner (isRosterTail)", () => {
    it("reconoce las colas que el OCR de AD deja sin nombre ni «armed»", () => {
      for (const s of ["with Halberd:", "with Magic Axe:", "Magic Axe:", "Sword:", "Gauche, Short Sword:", "wlth Hulberd:", "with Crossbow:", "wlth Muglc Axe:"])
        expect(isRosterTail(s), s).toBe(true);
    });
    it("EXIGE el bloque entero: una palabra ajena lo descalifica (no se barre material comparable)", () => {
      for (const s of [
        "Search-East Sword:", // arrastra un eco de comando REAL → sigue divergente
        "Search-d Gauche, Short Sword:",
        "Thou dost see a sword:",
        "with Halberd", // sin el `:` de cierre del banner (DS 0x6dbe)
        "Spell name:",
        "Your interest?",
        "",
      ])
        expect(isRosterTail(s), s).toBe(false);
    });
    it("el vocabulario es el del PORT: careo contra InventoryDetails.json → Armament", () => {
      // MISMO origen que EQUIP_NAMES en main.ts:2596 — si el core cambia la tabla, revienta aquí
      const armament = (inventoryDetails as { Armament: { ItemName: string }[] }).Armament.slice(1);
      expect(armament.length).toBe(48);
      for (const a of armament) {
        const words = a.ItemName.replace(/([a-z])([A-Z])/g, "$1 $2").split(/\s+/);
        for (const w of words) expect(EQUIP_WORDS.has(probeFold(w)), `${a.ItemName} → ${w}`).toBe(true);
      }
      // y el banner ENTERO de cada arma se reconoce como cola
      for (const a of armament)
        expect(isRosterTail(`with ${a.ItemName.replace(/([a-z])([A-Z])/g, "$1 $2")}:`), a.ItemName).toBe(true);
    });
  });

  describe("la calibración NO puede fabricar NI OCULTAR conformidad (invariante de 3c)", () => {
    // El reconocedor va en la ÚLTIMA posición del diff a propósito: sólo convierte
    // DIVERGENTE → no-comparable. Es monótono sobre `matched`.
    const CORPUS = [
      "Iolo, armed wit Sling:", "with Halberd:", "Attuck-Alm!", "VICT0RY!", "Escape!",
      "Blocked!", "Thou dost see a hot stove.", "The pocket watch reads 3:28 AM.",
      "Troll mlgged!", "Set aotlve plr",
    ];
    const PORT = ["Blocked!", "Thou dost see a hot stove.", "The pocket watch reads 3:28 AM."];
    it("un bloque que el port SÍ dijo sigue contando como match (no se declasifica)", () => {
      const antes = diffSegment(seg(CORPUS), PORT, AD_PRE3C_PROFILE);
      const ahora = diffSegment(seg(CORPUS), PORT, AD_PROFILE);
      expect(ahora.matched).toBe(antes.matched); // ← el numerador es INTOCABLE
      expect(ahora.matched).toBe(3);
    });
    it("todo lo retirado sale EXACTAMENTE de los divergentes (contabilidad cerrada)", () => {
      const antes = diffSegment(seg(CORPUS), PORT, AD_PRE3C_PROFILE);
      const ahora = diffSegment(seg(CORPUS), PORT, AD_PROFILE);
      const divAntes = antes.blocks.filter((b) => b.verdict === "divergent").length;
      const divAhora = ahora.blocks.filter((b) => b.verdict === "divergent").length;
      expect(divAntes - divAhora).toBe(ahora.combatRng);
      expect(ahora.comparable).toBe(antes.comparable - ahora.combatRng);
      // ninguna otra categoría se mueve
      expect(ahora.ocrGhost).toBe(antes.ocrGhost);
      expect(ahora.ocrGarbage).toBe(antes.ocrGarbage);
      expect(ahora.covered).toBe(antes.covered);
      expect(ahora.presentacion).toBe(antes.presentacion);
    });
    it("los mecanismos se cuentan por SEPARADO (auditables y reversibles uno a uno)", () => {
      const d = diffSegment(seg(CORPUS), PORT, AD_PROFILE);
      expect(d.combatRosterTail).toBe(1); // "with Halberd:"
      expect(d.combatRng).toBeGreaterThan(d.combatRosterTail + d.combatCurated);
    });
    it("la clase CURADA `exact` sólo se declasifica si el perfil lo permite", () => {
      const soloVictoria = seg(["VICT0RY!"], "exact");
      // ★ ACTUALIZADO POR LA VENTANA `comparador-bandas`, y el invariante de 3c NO se toca: lo que
      // cambia es QUÉ CAPA se lleva el bloque. Con `combatOutcomeLottery` el desenlace curado sale
      // del denominador ANTES de casar (gane o pierda su tirada), así que ya no llega a la palanca
      // de 3c y `combatCurated` deja de contarlo. La palanca de 3c se sigue probando aquí, sobre el
      // perfil donde ES la última palabra (`ad-pre-bandas`) — si se probara sólo con `ad`, este
      // test dejaría de vigilar 3c sin que nadie se enterase.
      const con3cAlMando = diffSegment(soloVictoria, ["nada"], AD_PRE_BANDAS_PROFILE);
      expect(con3cAlMando.combatCurated).toBe(1);
      expect(con3cAlMando.blocks[0]!.class).toBe("combat-rng-curado");
      // el perfil de 3b la dejaba DIVERGENTE (la contradicción que 3c resuelve, declarada)
      const pre = diffSegment(soloVictoria, ["nada"], { ...AD_PRE3C_PROFILE, combatOutcomeLottery: false });
      expect(pre.combatCurated).toBe(0);
      expect(pre.blocks[0]!.verdict).toBe("divergent");
      // y con el perfil VIGENTE se la lleva la capa nueva, que es no-comparable igual
      const hoy = diffSegment(soloVictoria, ["nada"], AD_PROFILE);
      expect(hoy.blocks[0]!.class).toBe("combat-outcome-rng");
      expect(hoy.comparable).toBe(0);
    });
  });

  describe("LP1 sigue siendo la IDENTIDAD (nada de 3c le llega)", () => {
    it("el perfil LP1 no lleva patrones de combate ni cola de armas ni override de clase", () => {
      expect(LP1_PROFILE.combatRng).toEqual([]);
      expect(LP1_PROFILE.detectRosterTail).toBe(false);
      expect(LP1_PROFILE.combatOverridesCuratedClass).toBe(false);
      expect(LP1_PROFILE.detectAdPending).toBe(false);
    });
    it("los MISMOS bloques de combate con LP1 NO pasan por los mecanismos de 3c", () => {
      const d = diffSegment(seg(["Iolo, armed wit Sling:", "with Halberd:", "VICT0RY!"]), ["nada"], LP1_PROFILE);
      expect(d.combatRng).toBe(0);
      expect(d.combatRosterTail).toBe(0);
      expect(d.combatCurated).toBe(0);
      // LP1 se comporta EXACTAMENTE como antes de 3c: el roster partido y la cola de armas
      // siguen COMPARABLES (su OCR no partía la línea, así que nunca fueron un problema), y
      // `VICT0RY!` con clase `auto` ya lo declasificaba el `RNG_AUTO` histórico (/victory/).
      expect(d.comparable).toBe(2);
      expect(d.blocks.map((b) => b.verdict)).toEqual(["divergent", "divergent", "rng"]);
    });
    it("★ RECALIBRADO — con clase CURADA `exact`, LP1 YA NO deja la contradicción (ruling del lead 01-08)", () => {
      // 🔴 ESTE TEST CODIFICABA EL RULING ANTERIOR («LP1 arrastra la contradicción y moverla es un
      // ruling del lead»). El lead RULÓ el 01-08 lo contrario, por SIMETRÍA: el mecanismo es el
      // mismo —el desenlace de combate es RNG del port— y un predicado estructural no puede
      // depender del corpus que mide. Se recalibra CON MOTIVO, no se borra: lo que antes salía
      // `divergent` (y por tanto CONTABA como fallo de fidelidad) ahora sale del denominador.
      // La población afectada es de 75 bloques en 18 partes de LP1 (censo corregido, §2.1 del
      // acta de `comparador-bandas`; el censo viejo decía 13 porque su patrón no casaba VICT0RY).
      const d = diffSegment(seg(["VICT0RY!"], "exact"), ["nada"], LP1_PROFILE);
      expect(d.blocks[0]!.class).toBe("combat-outcome-rng");
      expect(d.comparable).toBe(0);
      expect(d.combatOutcomeRng).toBe(1);
      // y el brazo «antes» del A/B conserva el comportamiento viejo, para que el delta sea medible
      const antes = diffSegment(seg(["VICT0RY!"], "exact"), ["nada"], LP1_PRE_BANDAS_PROFILE);
      expect(antes.blocks[0]!.verdict).toBe("divergent");
      expect(antes.combatCurated).toBe(0);
    });
    it("`ad-pre3c` es el perfil AD de 3b: idéntico salvo las palancas de 3c", () => {
      expect(AD_PRE3C_PROFILE.glyphClasses).toEqual(AD_PROFILE.glyphClasses);
      expect(AD_PRE3C_PROFILE.coverage).toEqual(AD_PROFILE.coverage);
      expect(AD_PRE3C_PROFILE.stripGhost).toBe(AD_PROFILE.stripGhost);
      expect(AD_PRE3C_PROFILE.detectGarbage).toBe(AD_PROFILE.detectGarbage);
      // ...y en particular CONSERVA la clasificación `pending` (si no, el «antes» mentiría)
      expect(AD_PRE3C_PROFILE.detectAdPending).toBe(AD_PROFILE.detectAdPending);
      expect(AD_PRE3C_PROFILE.combatRng).toEqual([]);
    });
  });
});

describe("FASE 3d — `sala-diferida` UNIFICADA con el reconocedor calibrado", () => {
  // Deber previo nº1 de 3d. Hasta 3c, `sala-diferida` clasificaba en la PRIMERA posición del
  // diff (antes de comprobar si el port había dicho el bloque), así que podía retirar matches
  // REALES — justo lo que la doctrina de 3c prohíbe. Movida a la ÚLTIMA posición, comparte la
  // garantía de `combat-rng`: sólo convierte DIVERGENTE → no-comparable.
  //
  // Medido sobre los transcripts congelados (tools/calib-sala.ts): de los 741 bloques que la
  // posición vieja se llevaba en `.espejo-r3b`, 734 los reconocen YA `rng`/`combat-rng` y sólo
  // 7 necesitan la red de sala; en `.espejo-3c` recuperó 1 match real («VICT0RY!», ad24-g05).
  const interior = (texts: string[], cls = "auto"): Segment => ({ ...seg(texts, cls), ctx: "dungeon", openedBy: "3b" });

  it("un bloque con firma de SALA que el port SÍ dijo cuenta como MATCH (ya no lo retira)", () => {
    const s = interior(["Entering room..", "Advance"]);
    const PORT = ["Entering room..", "Advance"];
    const antes = diffSegment(s, PORT, AD_PRE3D_PROFILE);
    const ahora = diffSegment(s, PORT, AD_PROFILE);
    // la posición vieja tiraba «Entering room..» sin mirar el transcript
    expect(antes.salaDeferred).toBe(1);
    expect(antes.matched).toBe(1);
    // la nueva lo casa: el port lo dijo
    expect(ahora.matched).toBe(2);
    expect(ahora.salaDeferred).toBe(0);
  });

  it("un bloque de SALA que el port NO dijo sigue fuera del denominador (la red no se pierde)", () => {
    // Caso REAL del corpus (ad22-g23 ocr:2311): la firma de daño suelta, sin el nombre del
    // atacante ni el verbo de tirada, no la reconoce ningún patrón calibrado de 3c — llega al
    // final del diff y es la propia `sala-diferida` quien la retira. Es uno de los 7 bloques
    // (de 741) que en `.espejo-r3b` siguen necesitando la red agnóstica de corpus.
    const s = interior(["Dragon llghtly"]);
    const d = diffSegment(s, ["Advance"], AD_PROFILE);
    expect(d.salaDeferred).toBe(1);
    expect(d.combatRng).toBe(0); // no lo cubría el reconocedor de 3c: la red NO es redundante
    expect(d.comparable).toBe(0);
  });

  it("MONOTONÍA sobre `matched`: mover la palanca nunca puede bajar el numerador", () => {
    const CORPUS = [
      "Entering room..", "Attack-Alm!", "Troll killed!", "VICT0RY!", "Set aotlve plr",
      "Iolo, armed with Sling:", "Advance", "Blocked!", "Turn left", "Barnabas wounded!",
    ];
    // varios transcripts distintos: en todos, matched sólo puede subir
    for (const PORT of [[] as string[], ["Advance"], ["Advance", "Blocked!", "Turn left"], CORPUS]) {
      const antes = diffSegment(interior(CORPUS), PORT, AD_PRE3D_PROFILE);
      const ahora = diffSegment(interior(CORPUS), PORT, AD_PROFILE);
      expect(ahora.matched).toBeGreaterThanOrEqual(antes.matched);
    }
  });

  it("fuera de un interior abierto la palanca es INERTE (no toca smallmap/overworld)", () => {
    const CORPUS = ["Entering room..", "Troll killed!", "Advance"];
    const PORT = ["Advance"];
    const a = diffSegment(seg(CORPUS), PORT, AD_PRE3D_PROFILE);
    const b = diffSegment(seg(CORPUS), PORT, AD_PROFILE);
    expect(a.salaDeferred).toBe(0);
    expect(b.salaDeferred).toBe(0);
    expect(b.matched).toBe(a.matched);
    expect(b.comparable).toBe(a.comparable);
  });

  it("`ad-pre3d` difiere de `ad` en UNA SOLA palanca (línea base atribuible)", () => {
    const { salaDeferredBeforeMatch: _a, ...restoPre } = AD_PRE3D_PROFILE;
    const { salaDeferredBeforeMatch: _b, ...restoAd } = AD_PROFILE;
    expect(restoPre).toEqual({ ...restoAd, id: "ad-pre3d" });
    expect(AD_PRE3D_PROFILE.salaDeferredBeforeMatch).toBe(true);
    expect(AD_PROFILE.salaDeferredBeforeMatch).toBe(false);
  });

  it("los perfiles VIGENTES llevan la posición nueva (nadie puede revertirla sin romper esto)", () => {
    expect(AD_PROFILE.salaDeferredBeforeMatch).toBe(false);
    expect(LP1_PROFILE.salaDeferredBeforeMatch).toBe(false);
    // `ad-pre3c` reproduce 3b, que SÍ clasificaba antes de casar
    expect(AD_PRE3C_PROFILE.salaDeferredBeforeMatch).toBe(true);
  });
});

describe("contrato del dismiss-arnés: core shops.innLeave (calco SHOPPES3 0x02AE)", () => {
  // El op {dismiss} LLAMA a core/shops.innLeave vía __u5test.innLeave (no replica). Este test
  // BLINDA el contrato del que depende el ledger de party de los SWAPS del LP2: si el core
  // cambia el efecto de la tecla L del posadero, revienta AQUÍ, no en silencio.
  const mkState = (): GameState =>
    ({
      characters: [
        { name: "Min", partyStatus: 0, monthsAtInn: 0 },
        { name: "Shamino", partyStatus: 0, monthsAtInn: 0 },
        { name: "Iolo", partyStatus: 0, monthsAtInn: 0 },
        { name: "Julia", partyStatus: 0, monthsAtInn: 0 },
      ],
      partySize: 4,
    }) as unknown as GameState;

  it("deja al companion EN la location (partyStatus=location, monthsAtInn=0) y baja partySize", () => {
    const s = mkState();
    const r = innLeave(s, 3, 7); // Julia en Skara Brae (loc 7) = el swap Julia→Mariah del LP2
    expect(r.ok).toBe(true);
    expect(s.characters[3]!.partyStatus).toBe(7);
    expect(s.characters[3]!.monthsAtInn).toBe(0);
    expect(s.partySize).toBe(3); // ← el hueco que el `recruit` siguiente necesita
  });
  it("el Avatar NO se puede dejar («Thy friend will not leave thee!»)", () => {
    const s = mkState();
    expect(innLeave(s, 0, 7).ok).toBe(false);
    expect(s.partySize).toBe(4);
  });
  it("no deja a quien NO está en la party, ni vacía la party", () => {
    const s = mkState();
    s.characters[3]!.partyStatus = 7; // ya dejada
    expect(innLeave(s, 3, 7).ok).toBe(false);
    const solo = { characters: [{ name: "Min", partyStatus: 0 }], partySize: 1 } as unknown as GameState;
    expect(innLeave(solo, 0, 2).ok).toBe(false);
  });
});
