/**
 * WALKTHROUGH-ESPEJO FASE 3a — DERIVACIÓN DE OPS DE INTERIOR (guardas OFFLINE, sin Playwright).
 *
 * Dos mitades:
 *  · `tools/derive-dungeon-ops.mjs` — OCR del pasillo 3D → ops conducibles + clasificación
 *    pasillo/sala. Es la pieza que hace MEDIBLES los interiores: los `ctx:dungeon` llegaban con
 *    ~99% de sus ops en `todo` y CERO nav, así que abrirlos sin esto habría metido miles de
 *    bloques en el denominador con el port sin pulsar una tecla.
 *  · `runner.ts::floorAfterKlimb` — el rastreo de PLANTA, ancla primaria del modelo de interior.
 *
 * Los casos de OCR corrupto son LITERALES del corpus committeado (`routes/part16`, `routes-ad/*`).
 *
 * ═══ REPARTO POR CORPUS (ventana `corpus-sintetico-espejo`) ═════════════════════════════
 * De los 103 casos de este fichero, **94 no tocan ningún corpus**: son literales OCR pinados
 * a mano (a propósito — ver el JSDoc de `POBLACION`), segmentos fabricados en el propio test y
 * llamadas a `floorAfterKlimb`/`carryoverInteriorLive`/`aggregateInterior` con enteros. Y aun
 * así el fichero ENTERO estaba fuera del CI público por UNA línea: un `readdirSync(routes-ad)`
 * en el cuerpo de un `describe`, que vitest ejecuta al RECOLECTAR. 94 casos rehenes de 9.
 *
 * Hoy: la lectura es perezosa y ocurre dentro del `it`, y los 9 se reparten así —
 *  · **(T)** las propiedades de FORMA que el derivador deja al abrir un interior (que un
 *    `openedBy` no lleve `skip`, que traiga ≥3 ops con procedencia, que un `post-combat`
 *    abierto lleve costura `carryover`, que un cerrado no pierda su razón) se instancian
 *    sobre `routes-sint/` **y se siguen corriendo también sobre el corpus real**: son el
 *    mismo predicado, escrito una vez y aplicado a los dos (`pruebasDeForma`). Lo que gana el
 *    público es la mitad sintética; lo que NO se pierde es la real, que es la que cazó a
 *    `ad20-g17`/`ad11-g06` abriéndose como mazmorra con `enter.loc: 23`.
 *  · **(C)** los cardinales calibrados (`byPhase` 9/9/83/5) y los censos por identidad de la
 *    cola de roster (#55/#66) van a `describeCorpusReal`. No se mueven: sobre un corpus que
 *    escribimos nosotros serían tautológicos.
 */
import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import {
  foldEcho,
  echoTokens,
  echoSim,
  matchDungeonEcho,
  rosterTailOf,
  ROSTER_TAIL_DEFERRED,
  dirFromEcho,
  classifyDungeonSegment,
  isDungeonLoc,
  deriveDungeonOps,
  resolveSegmentDungeon,
  resolveDungeonForPostCombat,
  leavesDungeon,
  DUNGEON_VOCAB,
  DUNGEON_RESULTS,
  isBareEcho,
  isGhostReread,
} from "../e2e/espejo-tour/tools/derive-dungeon-ops.mjs";
import { isRosterTail } from "../e2e/espejo-tour/ocr-profile";
import { floorAfterKlimb, aggregateInterior, carryoverInteriorLive, type SegmentReport } from "../e2e/espejo-tour/runner";
import { describeCorpusReal, PARTES_SINT, ROUTES_AD_DIR, ROUTES_SINT_DIR } from "./espejo-corpus";

const ROUTES_AD = ROUTES_AD_DIR;

type SegAny = Record<string, unknown>;

/**
 * 🔴 LOS DOS CARGADORES SON PEREZOSOS A PROPÓSITO, y no es cosmética: **ninguna lectura de
 * corpus puede ocurrir fuera del callback de un `it`** — ni en carga de módulo ni en el cuerpo
 * de un `describe`, porque vitest ejecuta ese cuerpo al RECOLECTAR (también el de un
 * `describe.skip`). Un `readdirSync` ahí da ENOENT en el árbol público y tumba el fichero
 * entero antes de que ningún salto condicional pueda intervenir. Era exactamente el estado de
 * este fichero: 94 casos que no leen nada, rehenes de una línea que sí.
 */
function segmentosAD(): SegAny[] {
  const out: SegAny[] = [];
  for (const f of readdirSync(ROUTES_AD).filter((n) => n.endsWith(".route.json")).sort()) {
    const route = JSON.parse(readFileSync(join(ROUTES_AD, f), "utf8")) as { segments?: SegAny[] };
    out.push(...(route.segments ?? []));
  }
  return out;
}

/** El corpus SINTÉTICO no se lee por `readdir`: su denominador va EN CRUDO (`PARTES_SINT`), para
 *  que vaciar el directorio se cobre como rojo y no como censo vacío. [[un-censo-nunca-lleva-2-dev-null]] */
function segmentosSint(): SegAny[] {
  const out: SegAny[] = [];
  for (const p of PARTES_SINT) {
    const route = JSON.parse(readFileSync(join(ROUTES_SINT_DIR, `${p}.route.json`), "utf8")) as { segments?: SegAny[] };
    out.push(...(route.segments ?? []));
  }
  return out;
}

/** Todas las ops `dng` del corpus AD committeado, con su procedencia. */
const opsAD = (): Array<{ seg: string; ln: unknown; dng: string; from: string }> => {
  const out: Array<{ seg: string; ln: unknown; dng: string; from: string }> = [];
  for (const seg of segmentosAD())
    for (const op of (seg.script as SegAny[] | undefined) ?? [])
      if (op.dng && typeof op.from === "string")
        out.push({ seg: String(seg.id), ln: op.ocrLn, dng: String(op.dng), from: op.from });
  return out;
};

describe("derive-dungeon-ops — plegado y tokenización del eco", () => {
  it("pliega los sumideros de OCR del corpus a un alfabeto común", () => {
    // los tres sumideros de 's' del corpus (8/5/g) caen en el mismo representante
    expect(foldEcho("8earch...")).toBe(foldEcho("5earch..."));
    expect(foldEcho("Seuroh...")).toBe(foldEcho("geuroh..."));
    expect(foldEcho("K]lmb-Uvwn!")).toBe("kiimbuuwni"); // ]→i, v→u, !→i (clase i), sin puntuación
    expect(foldEcho("Vlew")).toBe("uiew"); // V→u, l→i (la w NO se pliega)
    // el plegado NO borra las diferencias de vocal: por eso el casado es por DISTANCIA, no igualdad
    expect(foldEcho("Advunee")).not.toBe(foldEcho("Advanoe"));
  });

  it("echoTokens retira la SEGUNDA PASADA FANTASMA y los marcadores de eco", () => {
    // literal de ad17-g03
    expect(echoTokens('Turn left ~TnZH"FT6hE""""')).toEqual(["Turn", "left"]);
    expect(echoTokens(':8earch... Dir-Ahead')).toEqual(["8earch...", "Dir-Ahead"]);
    expect(echoTokens('""""')).toEqual([]);
  });

  it("echoSim es simétrico y penaliza por longitud", () => {
    expect(echoSim("Advance", "Advance")).toBe(1);
    expect(echoSim("Advunee", "Advance")).toBeGreaterThan(0.6);
    expect(echoSim("Turn left", "Turn right")).toBeLessThan(0.85);
  });
});

describe("derive-dungeon-ops — vocabulario CERRADO del pasillo", () => {
  const cases: Array<[string, string, string | undefined]> = [
    // [eco crudo del OCR, dng esperado, dir esperada]
    ["Advance", "advance", undefined],
    ["Advunee", "advance", undefined],
    ["Advanoe", "advance", undefined],
    ["Advonee", "advance", undefined],
    ["Turn right", "turnRight", undefined],
    ["Turn r[ght", "turnRight", undefined],
    ["Turn rlght Dlr-Aheud", "turnRight", undefined],
    ["Turn [eft", "turnLeft", undefined],
    ["Turn left", "turnLeft", undefined],
    ["K]lmb-Uown!", "klimb", "down"],
    ["Kllmb-Down!", "klimb", "down"],
    ["Klimb-Up!", "klimb", "up"],
    ["Ignite torch!", "ignite", undefined],
    ["IgnTEe torch!", "ignite", undefined],
  ];
  for (const [raw, dng, dir] of cases) {
    it(`«${raw}» → ${dng}${dir ? `/${dir}` : ""}`, () => {
      const m = matchDungeonEcho(raw);
      expect(m, `sin casar: ${raw}`).not.toBeNull();
      expect(m!.op.dng).toBe(dng);
      if (dir) expect(m!.op.dir).toBe(dir);
    });
  }

  it("los ecos de RESULTADO del mundo NUNCA casan como comando (no se fabrica tecla)", () => {
    for (const r of DUNGEON_RESULTS) {
      const m = matchDungeonEcho(r);
      // «Pass» está en el vocabulario y «Push-South» se le parece; el resto no debe casar nada.
      expect(m, `${r} casó como ${m?.op.dng}`).toBeNull();
    }
  });

  it("basura de OCR sin contenido NO casa (conservador: se queda `todo`)", () => {
    for (const junk of ['j;+L qn]hppH!""', 'CX6TTZXD""%ZmXH', "", 'o%ZH%H%g""%ZmXH']) {
      expect(matchDungeonEcho(junk)).toBeNull();
    }
  });

  it("el vocabulario no tiene dos entradas que colapsen entre sí (margen del casado)", () => {
    for (const a of DUNGEON_VOCAB) {
      for (const b of DUNGEON_VOCAB) {
        if (a === b) continue;
        expect(echoSim(a.echo, b.echo), `${a.echo} vs ${b.echo}`).toBeLessThan(0.9);
      }
    }
  });
});

/**
 * ★ #55 (lever-2b) — LA COLA DE ROSTER FABRICA OPS DE PASILLO.
 *
 * El OCR de Diener parte el banner de roster del combate («<Nombre>, armed with <armas>:») en
 * dos lecturas, y a veces pega la SEGUNDA MITAD —la que ya no lleva ni el nombre ni `armed`,
 * sólo la lista de armas y el `:`— detrás de una cabeza que casa el vocabulario del pasillo.
 * El derivador leía esa cabeza como un eco de comando y emitía un op que el LP nunca hizo, y
 * cada op fabricado MUEVE las candidatas del filtro de mazmorra una celda de más.
 *
 * El reconocedor es `isRosterTail` (ocr-profile.ts), aplicado a la COLA que queda tras el eco.
 * NO se escribe un segundo reconocedor: `isRosterTail` ya consulta `isEquipWord`, así que el
 * vocabulario de armamento sigue siendo UNO — que es justo lo que hace defendible al guarda.
 * Medido y contra el instrumento propio: una regex ad-hoc de `advance` dejaba 18 de 28 fuera
 * (familias enteras: `turnLeft/Right`, `klimb`, `pass`, `turnAround`, `back`).
 */
describe("derive-dungeon-ops — #55 cola de ROSTER: el op de pasillo que el LP nunca hizo", () => {
  /**
   * CONTROL NEGATIVO, pinado antes de tocar el derivador. Sin él el guarda no es defendible:
   * la firma ANCHA («armed» / «with X:» / acaba en `:`) casaba 277 colas y la intermedia 112, y
   * casi todas eran avances REALES con el banner de roster concatenado detrás. Retirarlas
   * habría sido matar 112 verdaderos para cazar uno falso.
   */
  const CONTROL: Array<[string, boolean, string]> = [
    ["Barnabas, armed with Halberd:", false, "banner ENTERO: el avance real se preserva"],
    ["Entering room.. Barnabas, armed with Halberd", false, "ni acaba en `:` ni es sólo armamento"],
    ["Barnabas, armed with Halberd: wTEh\"HnTHgrH", false, "arrastra material comparable"],
    ["with Halberd:", true, "LA MITAD HUÉRFANA — el defecto"],
    ["", false, "cola vacía (eco `Advance` limpio): jamás casa"],
  ];
  for (const [cola, esperado, porque] of CONTROL) {
    it(`control negativo — «${cola}» → ${esperado} (${porque})`, () => {
      expect(isRosterTail(cola)).toBe(esperado);
    });
  }

  it("un eco LIMPIO y un eco con el banner ENTERO detrás siguen derivando (no se matan verdaderos)", () => {
    // La otra mitad del control: que el guarda no se lleve por delante los casos VERDADEROS.
    for (const raw of ["Advance", "Advance Barnabas, armed with Halberd:", "Turn left", "Kllmb-Up!"]) {
      expect(matchDungeonEcho(raw), `${raw} dejó de derivar`).not.toBeNull();
    }
  });

  /**
   * LA POBLACIÓN, POR IDENTIDAD. Literales del corpus committeado (main `7051c0d4`), con el
   * segmento y la línea de OCR de donde salen. Se pinan como literales y no se buscan en la
   * ruta a propósito: tras regenerar ya no están en el artefacto, y un test que los buscara
   * ahí se volvería verde por desaparición del sujeto en vez de por el guarda.
   */
  const POBLACION: Array<[string, string, number, string]> = [
    ["Advunoe with Halberd:", "ad17-g04", 1933, "advance"], // ← la #27, la que mata a ad17-g04 t2
    ["Advance with Halberd:", "ad17-g05", 2644, "advance"],
    ["Puss with Magic Axe:", "ad17-g07", 5427, "pass"],
    ["Advance with Halberd:", "ad17-g10", 8327, "advance"],
    ["Turn rlght with Magic Axe:", "ad17-g11", 9328, "turnRight"],
    ["Advance with Halberd:", "ad17-g11", 9358, "advance"],
    ["Turn rlght wlth Muglo Axe:", "ad17-g11", 9635, "turnRight"],
    ["Turn around. with Magic Axe:", "ad17-g17", 11306, "turnAround"],
    ["Turn right with Magic Axe:", "ad18-g12", 3921, "turnRight"],
    ["Kllmb-Up! with Magic Axe:", "ad18-g13", 4751, "klimb"],
    ["Turn right with Magic Axe:", "ad18-g13", 4831, "turnRight"],
    ["Pagg wlth Maglo Axe:", "ad18-g14", 5884, "pass"],
    ["Turn left wlth Muglo Axe:", "ad18-g14", 5925, "turnLeft"],
    ["Kllmb-Uown! wlth Muglo Axe:", "ad18-g14", 6171, "klimb"],
    ["Turn left wlth Hulberd:", "ad19-g20", 5423, "turnLeft"],
    ["Kllmb-Down! wlth Muglo Axe:", "ad19-g20", 5695, "klimb"],
    ["Advance with Halberd:", "ad19-g36", 11072, "advance"],
    ["Advanoe with Halberd:", "ad19-g39", 11994, "advance"],
    ["Turn left wlth Hulberd:", "ad20-g03", 2629, "turnLeft"],
    ["Buok up with Halberd:", "ad20-g06", 3710, "back"],
    ["Turn left wlth Hulberd:", "ad20-g19", 7824, "turnLeft"],
    // `ad23-g12` ln3458 NO está aquí: es K4, DIFERIDA a #66 por ruling del lead — ver abajo.
    ["Advunce wlth Maglo Axe:", "ad23-g15", 4070, "advance"],
    ["Advunoe with Halberd:", "ad23-g16", 4192, "advance"],
    ["Advunce jTEh\"M%6T%\"A,XT with Magic Axe:", "ad23-g17", 4330, "advance"],
    ["Turn right with Magic Axe:", "ad23-g18", 4796, "turnRight"],
    ["Advance with Magic Axe:", "ad24-g16", 4011, "advance"],
    ["Turn right with Halberd:", "ad24-g27", 6575, "turnRight"],
  ];

  for (const [raw, seg, ln, dng] of POBLACION) {
    it(`${seg} ln${ln} (${dng}) — «${raw}» NO deriva`, () => {
      expect(matchDungeonEcho(raw), `${seg} ln${ln}: sigue fabricando ${dng}`).toBeNull();
    });
  }

  /**
   * ★ Los DOS con fantasma EN MEDIO (`ad23-g12` ln3458, `ad23-g17` ln4330) son los que obligan a
   * medir la cola sobre `echoTokens` y no sobre el crudo: `consumed` cuenta tokens YA limpios de
   * la re-lectura, así que cortar el crudo por ese índice está desalineado por construcción y
   * deja escapar estos dos. Es la misma trampa de «el instrumento equivocado» de #54.
   */
  it("la cola se mide tras retirar la re-lectura fantasma (si no, dos escapan)", () => {
    for (const raw of ['Kllmb-Up! jTEh"H%THXFHT"" with Halberd:', 'Advunce jTEh"M%6T%"A,XT with Magic Axe:']) {
      expect(matchDungeonEcho(raw), raw).toBeNull();
      // y la prueba de que el desalineamiento es real: por el crudo la cola NO es de roster
      expect(isRosterTail(raw.trim().split(/\s+/).slice(1).join(" ")), `${raw}: el crudo la dejaría pasar`).toBe(false);
    }
  });

  /**
   * ★ #66 — K4, la ÚNICA de la población que NO se retira, y por qué el estado que aterriza es
   * el CONSERVADOR.
   *
   * Retirar una op fusiona los dos tramos que separaba. `ad23-g12` ln3458 es un `klimb` —una
   * FRONTERA DE PLANTA— y los dos tramos que separa TIENEN observaciones: t2 (9 obs, 46/64) y
   * t3 (3 obs, 64/64). Fusionados dan 38/64, o sea la retirada ESTRECHA un tramo que hoy mide,
   * y ahí la familia deja de ser inocua: F2 (resto de redibujado) haría la fusión correcta,
   * F4 (`klimb` real) aplicaría observaciones de DOS plantas contra un solo grid. El artefacto
   * no distingue —38>0, no aparece la contradicción que delataría la fusión errónea— así que se
   * difiere en vez de adivinar. Los otros tres `klimb` de la población sí se retiran: su efecto
   * sobre plantas viables es NULO en las dos lecturas.
   *
   * ★ No lee corpus: `ROSTER_TAIL_DEFERRED` es una constante de PRODUCCIÓN y el eco es literal.
   */
  it("#66 — la diferida se declara por identidad y CONSERVA su op", () => {
    expect(ROSTER_TAIL_DEFERRED).toEqual([{ seg: "ad23-g12", ocrLn: 3458, ticket: "#66", dng: "klimb" }]);
    const raw = 'Kllmb-Up! jTEh"H%THXFHT"" with Halberd:';
    // el guarda SÍ la reconoce como cola de roster…
    expect(rosterTailOf(raw)).toBe("with Halberd:");
    expect(matchDungeonEcho(raw)).toBeNull();
    // …y sólo la excepción explícita la deja derivar
    expect(matchDungeonEcho(raw, { allowRosterTail: true })?.op.dng).toBe("klimb");
  });

  /**
   * ═══ LOS TRES CENSOS DEL ARTEFACTO REAL ═════════════════════════════════════════════════
   * Aquí abajo el sujeto deja de ser el guarda y pasa a ser el CORPUS: «¿queda viva alguna de
   * las 27?», «¿esa cabeza aparece exactamente en estos dos segmentos?», «¿cuáles son las 6
   * del residuo?». Son adjudicaciones sobre `routes-ad` y no se pueden replicar en el
   * sintético: el esperado lo escribiríamos nosotros junto al sujeto.
   * Los 35 casos de arriba —los literales pinados, el control negativo, `ROSTER_TAIL_DEFERRED`—
   * no leen corpus y se quedan corriendo en el árbol público.
   */
  describeCorpusReal("#55 — los censos sobre el ARTEFACTO committeado", () => {
  it("el ARTEFACTO no conserva ni una op `dng` de la población (la cifra que vale)", () => {
    // ★ La doctrina de la casa: la cifra que adjudica es la del ARTEFACTO, no la del detector.
    //
    // ⚠ Y el detector NO puede pasar por `matchDungeonEcho`. Escrito así la primera vez, este
    // test se puso VERDE con el guarda puesto y las rutas SIN regenerar: el guarda devuelve
    // null, el detector no ve nada y el test se absuelve solo. Es la circularidad de «test contra
    // la constante» disfrazada de censo. `rosterTailOf` es la sonda que NO pasa por el guarda.
    //
    // El ÚNICO superviviente admitido es la diferida de #66, y se exige por identidad: si
    // desapareciera (retirada sin ruling) o si apareciera otra, este test se pone rojo.
    const literales = new Set(POBLACION.map(([raw]) => raw));
    const vivos = opsAD()
      .filter((o) => rosterTailOf(o.from) != null || literales.has(o.from))
      .map((o) => `${o.seg}/${String(o.ln)}/${o.dng}`);
    expect(vivos).toEqual(["ad23-g12/3458/klimb"]);
  });

  it("#66 — la diferición va por IDENTIDAD, no por el literal (que NO es único)", () => {
    // `Kllmb-Up! jTEh"H%THXFHT""` aparece también en ad18-g15 ln7066 y ad23-g14 ln3710, con
    // colas DISTINTAS que nunca fueron población. Una excepción por texto habría diferido tres.
    const conMismaCabeza = opsAD().filter((o) => o.from.startsWith('Kllmb-Up! jTEh"H%THXFHT""'));
    expect(conMismaCabeza.map((o) => `${o.seg}/${String(o.ln)}`).sort()).toEqual([
      "ad18-g15/7066",
      "ad23-g12/3458",
    ]);
    // y de esas, sólo UNA tiene cola de roster
    expect(conMismaCabeza.filter((o) => rosterTailOf(o.from) != null).map((o) => o.seg)).toEqual(["ad23-g12"]);
  });

  /**
   * ★ RESIDUO DECLARADO, no alcance de #55 — y lo destapó un detector MÍO mal calibrado.
   *
   * Escribí el censo del artefacto probando la cola tras 1 O 2 tokens (saltándome uno), y sacó
   * seis ops más. Ensanchar así rompe el control negativo de A.3: `ad24-g24` ln5485 es
   * «Advance MnrTnh""nrmgH"" with Magic Axe:», y `MnrTnh""nrmgH""` es la lectura fantasma de
   * «Mariah, armed» que la cabecera de ocr-profile.ts documenta palabra por palabra. O sea: el
   * banner ENTERO detrás de un avance REAL, exactamente el caso que A.3 pina como preservable.
   * Retirarlo habría sido matar un verdadero.
   *
   * Los otros cinco llevan `Escape!` o `Attuoked!` intercalados y NO están adjudicados: pueden
   * ser el mismo defecto con contenido de juego en medio, o ecos reales. Se pinan por identidad
   * para que la población sea visible y no crezca en silencio; adjudicarlos exige leer sus beats
   * y es ventana propia.
   */
  it("residuo: 6 ops con la cola de roster DETRÁS de un token intercalado (fichadas, sin adjudicar)", () => {
    const RESIDUO = [
      "Kllmb-Uown! Escape! Magic Axe:", // ad17-g13 ln10032
      "Kllmb-Up! Escape! with Magic Axe:", // ad18-g13 ln4935
      "Puss Escape! Magic Axe:", // ad19-g20 ln6408
      'Advance wTEh"Mn6TZ"A,gT <q++ngp\'q;,!"" with Halberd: RnE"kTT', // ad21-g02 ln210
      "Advance Attuoked! wlth Halberd: with Magic Axe:", // ad23-g16 ln4198
      'Advance MnrTnh""nrmgH"" with Magic Axe:', // ad24-g24 ln5485 — banner ENTERO: avance REAL
    ];
    const conColaSaltando = (from: string) => {
      const toks = echoTokens(from);
      return rosterTailOf(from) == null && [1, 2].some((n) => toks.length > n && isRosterTail(toks.slice(n).join(" ")));
    };
    const hallados = opsAD().filter((o) => conColaSaltando(o.from)).map((o) => o.from);
    expect(hallados.sort()).toEqual([...RESIDUO].sort());
  });
  });
});

describe("derive-dungeon-ops — prompt «Dir-» del Search/Look", () => {
  it("lee la dirección cuando es legible", () => {
    expect(dirFromEcho("Search... Dir-Ahead You find: A pit!")).toBe("ahead");
    expect(dirFromEcho("8caroh... Dlr-Ahcad")).toBe("ahead");
    expect(dirFromEcho("Search... Dir-Left")).toBe("left");
    expect(dirFromEcho("Look... Dir-Here")).toBe("here");
  });

  it("sin dirección legible NO se inventa (el op se queda `todo`)", () => {
    expect(dirFromEcho("Search...")).toBeNull();
    expect(dirFromEcho("5eurch... Dir-s")).toBeNull(); // «Dir-s» = OCR partido → no se adivina
    const { script, stats } = deriveDungeonOps({
      script: [{ todo: "Search..." }, { todo: "Search... Dir-Ahead" }],
    });
    expect(stats.needDirSkipped).toBe(1);
    expect(script[0]!.todo).toBe("Search..."); // intacto
    expect(script[1]!.dng).toBe("search");
    expect(script[1]!.dir).toBe("ahead");
  });
});

describe("derive-dungeon-ops — derivación de un segmento", () => {
  it("convierte lo casable, conserva lo demás y guarda PROCEDENCIA (`from`)", () => {
    const seg = {
      script: [
        { todo: "Advunee", ocrLn: 10 },
        { todo: 'j;+L qn]hppH!""', ocrLn: 11 },
        { key: "y", ocrLn: 12 },
        { nav: [{ m: "north", v: "walk", n: 2 }] },
        { todo: "Turn right", ocrLn: 13 },
      ],
    };
    const { script, stats } = deriveDungeonOps(seg);
    expect(stats.converted).toBe(2);
    expect(stats.kept).toBe(1);
    expect(script[0]).toMatchObject({ dng: "advance", from: "Advunee", ocrLn: 10 });
    expect(script[2]).toEqual({ key: "y", ocrLn: 12 }); // ops ya conducidas: intactas
    expect(script[3]).toEqual(seg.script[3]); // nav intacto
  });

  it("es IDEMPOTENTE: re-derivar desde el `from` da el mismo resultado", () => {
    const seg = { script: [{ todo: "Advunee", ocrLn: 10 }, { todo: "K]lmb-Uown!", ocrLn: 11 }] };
    const once = deriveDungeonOps(seg);
    const twice = deriveDungeonOps({ script: once.script });
    expect(twice.script).toEqual(once.script);
    expect(twice.stats.converted).toBe(once.stats.converted);
  });

  it("cuenta la GEMA como pendiente (ruling: es 3e, no se conduce en 3b)", () => {
    const { stats } = deriveDungeonOps({ script: [{ todo: "Vlew a gem!" }, { todo: "View a gem!" }] });
    expect(stats.pendingGem).toBe(2);
    expect(stats.converted).toBe(0);
  });
});

describe("derive-dungeon-ops — clasificación pasillo vs SALA", () => {
  it("un pasillo puro es `corridor`", () => {
    const seg = {
      script: [{ todo: "Advance" }, { todo: "Turn left" }, { todo: "Advunee" }, { todo: "Turn right" }],
      expect: [{ text: "Advance" }, { text: "Turn left" }],
    };
    expect(classifyDungeonSegment(seg).kind).toBe("corridor");
  });

  it("la SALA PURA (sin pasillo que conducir) sigue cerrada — ahí el cierre es la razón honesta", () => {
    const seg = {
      script: [{ todo: "Entering room.." }, { todo: "Attack-Aim!" }, { todo: "Troll killed!" }, { todo: "Ettin missed!" }],
      expect: [{ text: "Barnabas, armed with Halberd:" }],
    };
    const cls = classifyDungeonSegment(seg);
    expect(cls.kind).toBe("room-combat");
    expect(cls.navHits).toBeLessThan(3); // = no hay pasillo: nada que medir
  });

  it("FASE 3c — el material MIXTO (pasillo Y sala) ya NO se cierra por la sala", () => {
    // Hasta 3b esto se cerraba entero porque el RNG de combate no estaba calibrado para AD y sus
    // bloques habrían divergido por INSTRUMENTO. Calibrado (AD_COMBAT_RNG + isRosterTail), el
    // pasillo del mismo segmento SÍ es medible: 12 segmentos con nav=6..37 estaban cerrados por
    // la sala que los acompaña.
    const seg = {
      script: [
        { todo: "Advance" }, { todo: "Turn left" }, { todo: "Advunee" }, { todo: "Turn right" },
        { todo: "Entering room.." }, { todo: "Attack-Aim!" }, { todo: "Troll killed!" },
      ],
      expect: [{ text: "Barnabas, armed with Halberd:" }],
    };
    const cls = classifyDungeonSegment(seg);
    expect(cls.kind).toBe("mixed");
    expect(cls.navHits).toBeGreaterThanOrEqual(3);
    expect(cls.roomHits).toBeGreaterThanOrEqual(3);
  });

  it("la clasificación es IDEMPOTENTE tras derivar (bug medido: los pasillos se re-cerraban solos)", () => {
    // Sin contar el `from` de las ops ya derivadas, navHits se hundía en la 2ª pasada del tool y
    // un pasillo pasaba a `unclear` → se volvía a cerrar (ad12-g02 / ad18-g10 / ad23-g12).
    const seg = {
      script: [{ todo: "Advance" }, { todo: "Turn left" }, { todo: "Advunee" }, { todo: "Turn right" }],
      expect: [],
    };
    const first = classifyDungeonSegment(seg);
    const derived = { script: deriveDungeonOps(seg).script, expect: [] };
    const second = classifyDungeonSegment(derived);
    expect(second.kind).toBe(first.kind);
    expect(second.navHits).toBe(first.navHits);
  });

  it("material sin firma de ninguno de los dos = `unclear` (no se abre)", () => {
    expect(classifyDungeonSegment({ script: [{ todo: 'o%ZH%H%g""%ZmXH' }], expect: [] }).kind).toBe("unclear");
  });
});

/**
 * ═══ LA FORMA QUE EL DERIVADOR DEJA AL ABRIR UN INTERIOR ═══════════════════════════════════
 *
 * Estas seis propiedades no hablan de NINGÚN corpus en particular: dicen qué tiene que ser
 * cierto de un segmento que el derivador ha abierto (o cerrado) para que lo que mida signifique
 * algo. Por eso se escriben UNA vez y se aplican a los DOS corpus:
 *   · sobre `routes-sint/` corren en el repositorio público (es el corpus que viaja);
 *   · sobre `routes-ad/` corren en nuestro árbol, y son las que cazaron a `ad20-g17`/`ad11-g06`
 *     abriéndose como mazmorra con `enter.loc: 23` (= COVE, un PUEBLO).
 *
 * 🔴 Cada una lleva GUARDA DE POBLACIÓN. Un `for` sobre una lista vacía pasa siempre, y en un
 * corpus que se regenera con herramientas la lista puede vaciarse sin que nadie lo decida.
 * [[el-vacio-se-lee-como-exito]]
 */
function pruebasDeForma(corpus: () => SegAny[]): void {
  const abiertos = () => corpus().filter((s) => s.openedBy);
  const enter = (s: SegAny) => s.enter as { loc?: number; carryover?: boolean; dungeon?: boolean; dungeonFrom?: string } | undefined;

  it("todo segmento `openedBy` es de ctx dungeon o de RANURA NEUTRA, sin `skip`, y trae ≥3 ops `dng`", () => {
    const segs = abiertos();
    expect(segs.length, "ningún interior abierto en este corpus: el aserto no mediría nada").toBeGreaterThan(0);
    for (const seg of segs) {
      // FASE 3d: los `post-combat` también se abren (son la CONTINUACIÓN de la misma visita).
      // ★ Y con ellos las otras dos RANURAS NEUTRAS del `ctx` (`resume`, `start`): la costura
      // que las corta —acampada, arranque de episodio— no declara lugar, igual que el
      // `VICTORY!`. Ver `re/notes/clasif-discrepan-preregistro.md` §2 y el JSDoc de
      // `CTX_NEUTRO` en el derivador. `combat` NO entra: ése sí declara contexto.
      expect(["dungeon", "post-combat", "resume", "start"], `${seg.id}`).toContain(seg.ctx);
      expect(seg.skip, `${seg.id} abierto pero con skip`).toBeUndefined();
      const dng = ((seg.script as SegAny[] | undefined) ?? []).filter((o) => o.dng);
      expect(dng.length, `${seg.id} abierto con ${dng.length} ops dng`).toBeGreaterThanOrEqual(3);
      for (const op of dng) expect(op.from, `${seg.id}: op dng sin procedencia`).toBeTruthy();
    }
  });

  it("la FASE que abrió cada interior viaja en la ruta y es del vocabulario CERRADO (`3b`/`3c`/`3d`/`3d-neutro`)", () => {
    // Es lo que hace AUTOMÁTICA la descomposición del informe: «material nuevo abierto en 3c»
    // frente a «lo que ya medía 3b». Si `openedBy` se volviera un booleano o se re-etiquetara
    // en masa, el antes/después dejaría de ser atribuible y habría que recontar a mano.
    // ★ El CARDINAL por fase es otra cosa —una calibración del corpus real— y vive abajo, en
    // `describeCorpusReal`. Aquí sólo se vigila el vocabulario, que sí es de la herramienta.
    const segs = abiertos();
    expect(segs.length, "ningún interior abierto en este corpus").toBeGreaterThan(0);
    for (const seg of segs) {
      expect(["3b", "3c", "3d", "3d-neutro"], `${seg.id}: fase '${String(seg.openedBy)}' desconocida`).toContain(
        seg.openedBy,
      );
    }
  });

  it("todo `post-combat` abierto lleva costura CARRYOVER con procedencia (nunca teletransporte)", () => {
    // La costura de 3b pone a la party en la celda de ENTRADA de la mazmorra. A mitad de visita
    // el LP no está ahí, así que teletransportarlo sería FABRICAR posición. La costura de un
    // post-combat es `carryover`: el runner sólo COMPRUEBA que la party siga dentro.
    const segs = abiertos().filter((s) => s.ctx === "post-combat");
    expect(segs.length, "ningún `post-combat` abierto: la maquinaria de 3d no se está ejercitando").toBeGreaterThan(0);
    for (const seg of segs) {
      const e = enter(seg);
      expect(e, `${seg.id}: post-combat abierto sin costura`).toBeTruthy();
      expect(e!.dungeon, `${seg.id}`).toBe(true);
      expect(e!.carryover, `${seg.id}: costura de post-combat SIN carryover = teletransporte fabricado`).toBe(true);
      expect(isDungeonLoc(e!.loc), `${seg.id}: enter.loc=${e!.loc} no es mazmorra`).toBe(true);
      // procedencia auditable: de qué banner salió la mazmorra
      expect(e!.dungeonFrom, `${seg.id}: mazmorra sin procedencia declarada`).toBeTruthy();
    }
  });

  it("ningún `post-combat` CERRADO pierde su razón declarada", () => {
    const segs = corpus().filter((s) => s.ctx === "post-combat" && !s.openedBy && s.skip);
    expect(segs.length, "ningún `post-combat` cerrado: el aserto no mediría nada").toBeGreaterThan(0);
    for (const seg of segs) {
      expect(seg.skipReason, `${seg.id} cerrado sin razón declarada`).toBeTruthy();
      // y NO conserva la costura sintética (se retira con el segmento)
      expect(enter(seg)?.carryover, `${seg.id}`).toBeUndefined();
    }
  });

  it("ningún interior abierto tiene un `enter.loc` que NO sea mazmorra 33..40", () => {
    // ad20-g17 y ad11-g06 traían `enter.loc: 23` (= COVE, un PUEBLO) y se abrieron como
    // mazmorra. El guard de runtime lo cazó y lo declaró («INTERIOR-SIN-MAZMORRA … la costura no
    // dejó a la party dentro del 3D»), así que no condujo teclas de pasillo por el overworld —
    // pero el segmento entraba en la métrica de interior con 28 comparables NO conducibles,
    // todos divergentes. Un interior que no se puede conducir no es material: es lastre.
    // Rango 33..40 = 0x21..0x28, el del despachador del original (SJOG.OVL 0x137a).
    const segs = abiertos();
    expect(segs.length, "ningún interior abierto en este corpus").toBeGreaterThan(0);
    for (const seg of segs) {
      const loc = enter(seg)?.loc;
      expect(isDungeonLoc(loc), `${seg.id}: abierto con enter.loc=${loc}, que no es mazmorra`).toBe(true);
    }
  });

  it("ningún segmento CERRADO de ctx dungeon pierde su razón declarada", () => {
    const segs = corpus().filter((s) => s.ctx === "dungeon" && !s.openedBy);
    expect(segs.length, "ningún `ctx:dungeon` cerrado: el aserto no mediría nada").toBeGreaterThan(0);
    for (const seg of segs) {
      expect(seg.skip, `${seg.id}`).toBe("pendiente-runner");
      expect(seg.skipReason, `${seg.id} cerrado sin razón declarada`).toBeTruthy();
    }
  });
}

describe("rutas SINTÉTICAS — la FORMA del interior abierto (corre TAMBIÉN en el repo público)", () => {
  pruebasDeForma(segmentosSint);

  /**
   * ★ EL CONTROL NEGATIVO QUE EL CORPUS SINTÉTICO TRAE A PROPÓSITO (`README.md`, tabla:
   * «`enter.loc` fuera del rango de mazmorra, como control negativo → `sint03-g04` (23)»).
   *
   * Sin él, «ningún interior abierto tiene un `enter.loc` fuera de 33..40» se cumpliría también
   * en un corpus donde NINGUNA location cayera fuera del rango — es decir, el aserto pasaría
   * sin que `isDungeonLoc` hubiese tenido nunca ocasión de decir que no. `sint03-g04` es
   * `GLASS COVE` (loc 23, la clase de `ad20-g17`): existe, está CERRADO, y su razón lo dice.
   */
  it("★ control negativo: la location que NO es mazmorra existe en el corpus y está CERRADA", () => {
    const control = segmentosSint().find((s) => s.id === "sint03-g04");
    expect(control, "`sint03-g04` (el control negativo del rango de mazmorra) ha desaparecido").toBeDefined();
    const loc = (control!.enter as { loc?: number } | undefined)?.loc;
    expect(isDungeonLoc(loc), `el control negativo dejó de serlo: loc=${loc} ahora SÍ es mazmorra`).toBe(false);
    expect(control!.openedBy, "el control negativo se ha ABIERTO como interior").toBeUndefined();
    expect(control!.skip, "el control negativo ya no está cerrado").toBeTruthy();
    expect(control!.skipReason, "el control negativo perdió su razón declarada").toBeTruthy();
  });
});

describeCorpusReal("rutas COMMITEADAS — las que están abiertas llevan ops de pasillo derivadas", () => {
  pruebasDeForma(segmentosAD);

  it("la FASE que abrió cada interior viaja en la ruta (`3b` pasillo / `3c` mixto / `3d` post-combat)", () => {
    // ★ El CARDINAL por fase, que es lo que hace atribuible el antes/después del informe. Es
    // calibración del corpus REAL —cada cifra lleva abajo la ventana que la movió— y por eso no
    // viaja al sintético: allí el esperado lo escribiríamos nosotros.
    const byPhase: Record<string, number> = {};
    for (const seg of segmentosAD()) {
      if (!seg.openedBy) continue;
      byPhase[String(seg.openedBy)] = (byPhase[String(seg.openedBy)] ?? 0) + 1;
    }
    // los 9 pasillos que midió 3b NO se re-etiquetan al abrir los mixtos de 3c, ni éstos al
    // abrir los post-combat de 3d: cada fase conserva EXACTAMENTE el material que abrió.
    expect(byPhase["3b"]).toBe(9);
    // ★ 8 → 9 (ventana `banner-ad19`): la costura `ad19-g17` en persona. Curarle el `enter.loc`
    // no sólo desbloquea a los de detrás — el propio segmento de entrada era `mixed` con 22 ops
    // derivables y estaba cerrado por «mazmorra INDETERMINABLE», así que abre como `3c`.
    expect(byPhase["3c"]).toBe(9);
    // ★ #55 — 72 → 71. `ad23-g18` se CERRÓ al retirarle su op de cola-de-roster (ln4796): tenía
    // exactamente 3 ops derivables, el mínimo, y se quedó en 2. El cierre es la regla conservadora
    // del propio tool y viaja con su razón declarada («mixto con material insuficiente: sólo 2 ops
    // derivables (mínimo 3) de 5 ecos de pasillo»), pero CUESTA 65 bloques de denominador. Se
    // mueve el pin declarándolo, no en silencio.
    // ★ 71 → 83 (ventana `banner-ad19`, pre-registro P1: bucket 104..108 sobre el total, salió el
    // punto exacto 106). Los 12 nuevos son TODOS `post-combat` de la visita a Wrong de `ad19`, que
    // estaban cerrados con un `skipReason` que además MENTÍA («este post-combat no es de
    // interior»): sí lo eran, y lo que faltaba era el id de la mazmorra. Con `enter.loc = 36` el
    // retroceso estricto los resuelve y su costura sintética `carryover` cita
    // `visita-abierta-en-ad19-g17`.
    // ★ Y este 83 es además el que cubre el `n` que antes se re-contaba en el test de la costura
    // CARRYOVER: es la MISMA población medida dos veces, así que el cardinal se pina UNA vez y
    // aquí. [[diffstat-no-es-censo]]
    expect(byPhase["3d"]).toBe(83);
    // ★ `3d-neutro` — las OTRAS dos ranuras neutras del `ctx` (`resume`/`start`), abiertas por la
    // ventana `clasif-discrepan` (pre-registro P1: bucket 91..97, salió 91 = el borde bajo).
    // Fase PROPIA a propósito: un `resume` es una ACAMPADA, no la continuación de un combate, y
    // mezclarlos borraría la atribución del informe. Los tres primeros son `resume` mid-visita:
    // `ad15-g10`, `ad24-g19`, `ad25-g22`. Ninguno de los 88 anteriores se re-etiqueta.
    // ★ 3 → 5 (ventana `banner-ad19`): `ad19-g26` y `ad19-g33`, los dos `resume` de la visita a
    // Wrong que `clasif-discrepan` §5 dejó DECLARADOS como «indeterminables» — la segunda puerta
    // que aquella ventana nombró y ésta cierra.
    expect(byPhase["3d-neutro"]).toBe(5);
  });
});

describe("FASE 3d — mazmorra de un `post-combat` por retroceso ESTRICTO", () => {
  // Deber previo nº2 de 3d. Un `post-combat` NO declara contexto: el segmentador cortó por el
  // `VICTORY!`/`BATTLE IS LOST!`, no por un banner, así que llega SIN `enter`. El retroceso
  // ingenuo de `resolveSegmentDungeon` (que a un `ctx:"dungeon"` le vale, porque ese ctx ya
  // afirma «estoy dentro») le pondría mazmorra también a los post-combat de un encuentro del
  // OVERWORLD — y abrirlos repetiría la rotura nº1 de 3b (teclas de pasillo sobre el mapa
  // grande) multiplicada por los 209 del censo.
  const R = (...segs: Array<Record<string, unknown>>) => ({ segments: segs });
  const dngSeg = (id: string, loc: number) => ({ id, ctx: "dungeon", enter: { loc, banner: "DESTARD", dungeon: true } });
  const pc = (id: string) => ({ id, ctx: "post-combat" });

  it("resuelve la mazmorra de la VISITA abierta por el banner precedente", () => {
    const route = R(dngSeg("g01", 35), pc("g02"), pc("g03"));
    expect(resolveDungeonForPostCombat(route, 1)).toEqual({ id: 35, how: "visita-abierta-en-g01" });
    expect(resolveDungeonForPostCombat(route, 2)).toEqual({ id: 35, how: "visita-abierta-en-g01" });
  });

  it("PARA en una costura de SALIDA: un post-combat de encuentro del overworld NO es interior", () => {
    // caso real: ad12-g22 (post-combat tras un combate del overworld, con la visita a Destard
    // 20 segmentos más atrás). El ingenuo lo resolvía; el estricto no.
    const route = R(dngSeg("g01", 35), pc("g02"), { id: "g03", ctx: "overworld", enter: { overworld: true } }, pc("g04"));
    expect(resolveSegmentDungeon(route, 3)).toEqual({ id: 35, how: "banner-precedente" }); // el ingenuo SÍ
    expect(resolveDungeonForPostCombat(route, 3)).toBeNull(); // el estricto NO
  });

  it("PARA también en un banner de otra location (pueblo/castillo), legible o corrupto", () => {
    for (const enter of [{ loc: 23, banner: "COVE" }, { loc: null, banner: "PALACE OF TTO H RE" }, { shrine: "HONESTY" }]) {
      const route = R(dngSeg("g01", 35), { id: "g02", ctx: "smallmap", enter }, pc("g03"));
      expect(leavesDungeon({ enter } as never), JSON.stringify(enter)).toBe(true);
      expect(resolveDungeonForPostCombat(route, 2), JSON.stringify(enter)).toBeNull();
    }
  });

  it("una RE-ENTRADA posterior gana: se resuelve contra la visita MÁS CERCANA", () => {
    // ad17: g13 (DECEIT) → g14 salida → g15 post-combat (NULL) → g16 (DECEIT) → g17 post-combat
    const route = R(
      dngSeg("g13", 33),
      { id: "g14", ctx: "overworld", enter: { overworld: true } },
      pc("g15"),
      dngSeg("g16", 33),
      pc("g17"),
    );
    expect(resolveDungeonForPostCombat(route, 2)).toBeNull();
    expect(resolveDungeonForPostCombat(route, 4)).toEqual({ id: 33, how: "visita-abierta-en-g16" });
  });

  it("NO hay atajo de «única mazmorra de la ruta» (el ingenuo sí lo tiene)", () => {
    // sin banner precedente alcanzable, el ingenuo se lo inventa de la ruta entera; el estricto
    // se calla. Caso real: ad18-g04, el ÚNICO que la parada descarta de los 73 candidatos.
    const route = R(pc("g01"), dngSeg("g02", 33));
    expect(resolveSegmentDungeon(route, 0)).toEqual({ id: 33, how: "única-mazmorra-de-la-ruta" });
    expect(resolveDungeonForPostCombat(route, 0)).toBeNull();
  });

  it("un `enter.loc` que no es mazmorra 33..40 NO abre nada (gate isDungeonLoc)", () => {
    const route = R({ id: "g01", ctx: "dungeon", enter: { loc: 23, banner: "COVE", dungeon: true } }, pc("g02"));
    expect(resolveDungeonForPostCombat(route, 1)).toBeNull();
  });

  it("IDEMPOTENCIA: la costura SINTÉTICA no es evidencia para el siguiente segmento", () => {
    // tras la 1ª corrida, g02 lleva un `enter` derivado. Si contara como banner, g03 se
    // resolvería contra g02 y la procedencia iría cambiando en cada pasada.
    const route = R(
      dngSeg("g01", 35),
      { id: "g02", ctx: "post-combat", enter: { loc: 35, dungeon: true, carryover: true, dungeonFrom: "visita-abierta-en-g01" } },
      pc("g03"),
    );
    expect(resolveDungeonForPostCombat(route, 2)).toEqual({ id: 35, how: "visita-abierta-en-g01" });
    // y tampoco para el resolutor ingenuo de los `ctx:dungeon`
    expect(resolveSegmentDungeon(route, 2)).toEqual({ id: 35, how: "banner-precedente" });
  });

  it("una costura de mazmorra REAL no cuenta como salida", () => {
    expect(leavesDungeon({ enter: { loc: 35, banner: "DESTARD", dungeon: true } } as never)).toBe(false);
    expect(leavesDungeon(undefined)).toBe(false); // sin `enter` no declara nada
  });
});

describe("FASE 3d — decisión de la costura CARRYOVER (post-combat)", () => {
  // Un post-combat no se teletransporta: se COMPRUEBA. La regla es estricta a propósito — si la
  // party no está en LA mazmorra esperada, conducir las teclas del pasillo mediría otra cosa
  // (otro interior) o el overworld (la rotura nº1 de 3b). Cuando no vale, se declara y no se
  // conduce: un interior abierto que no midió nada es un DATO, no un silencio.
  const at = (dungeon: number, floor = 2) => ({ dungeon, floor, x: 4, y: 5, facing: "north" });

  it("la party sigue en LA mazmorra esperada → se conduce", () => {
    expect(carryoverInteriorLive(at(33), 33)).toBe(true);
  });

  it("la party está en OTRA mazmorra → NO se conduce (mediría el interior equivocado)", () => {
    expect(carryoverInteriorLive(at(35), 33)).toBe(false);
  });

  it("la party está FUERA del 3D → NO se conduce (sería la rotura nº1 de 3b)", () => {
    expect(carryoverInteriorLive(null, 33)).toBe(false);
  });

  it("sin mazmorra esperada no se conduce (no se adivina)", () => {
    expect(carryoverInteriorLive(at(33), null)).toBe(false);
    expect(carryoverInteriorLive(at(33), undefined)).toBe(false);
  });

  it("la PLANTA no entra en la decisión: a mitad de visita es cualquiera (y no es derivable)", () => {
    for (const f of [0, 1, 5, 7]) expect(carryoverInteriorLive(at(33, f), 33)).toBe(true);
  });
});

describe("runner — rastreo de PLANTA (ancla primaria del interior)", () => {
  it("Klimb-Down desde f0 esperando f1: casa", () => {
    expect(floorAfterKlimb(0, "down", 1)).toEqual({ expected: 1, verdict: "match" });
  });

  it("Klimb-Up desde f3 con la planta viva desalineada: RESYNC a la esperada", () => {
    expect(floorAfterKlimb(3, "up", 5)).toEqual({ expected: 2, verdict: "resync" });
  });

  it("sin ancla previa adopta la planta viva (no inventa)", () => {
    expect(floorAfterKlimb(null, "down", 4)).toEqual({ expected: 4, verdict: "unknown" });
  });

  it("planta viva null = la party SALIÓ de la mazmorra (klimb en el tope)", () => {
    expect(floorAfterKlimb(0, "up", null)).toEqual({ expected: null, verdict: "exited" });
  });

  it("no se sale del rango 0..7 al contar", () => {
    expect(floorAfterKlimb(7, "down", 7).expected).toBe(7);
  });
});

describe("runner — métrica de interiores APARTE (ruling del lead)", () => {
  const seg = (over: Partial<SegmentReport>): SegmentReport =>
    ({
      id: "x",
      ctx: "dungeon",
      seam: null,
      comparable: 0,
      matched: 0,
      conformity: null,
      presentacion: 0,
      ocrPartial: 0,
      ocrGhost: 0,
      ocrGarbage: 0,
      covered: 0,
      resyncs: [],
      combatRounds: 0,
      todosSkipped: 0,
      typedSkipped: 0,
      anchorsResolved: 0,
      anchorsJumped: 0,
      anchorsMissed: 0,
      anchorsAmbiguous: 0,
      drifts: [],
      salaDeferred: 0,
      dngOps: 0,
      wandererFrozen: 0,
      floorMatches: 0,
      floorResyncs: 0,
      floorUnknown: 0,
      salaOpsSkipped: 0,
      blocks: [],
      ...over,
    }) as SegmentReport;

  it("sólo agrega los segmentos de INTERIOR, con su instrumento declarado", () => {
    const m = aggregateInterior([
      seg({ interior: true, comparable: 10, matched: 4, salaDeferred: 7, dngOps: 30, wandererFrozen: 3, floorMatches: 2, floorResyncs: 1 }),
      seg({ comparable: 100, matched: 90 }), // smallmap: NO entra
    ]);
    expect(m).toMatchObject({ segments: 1, comparable: 10, matched: 4, conformity: 0.4, salaDeferred: 7, dngOps: 30, wandererFrozen: 3 });
  });

  it("sin interiores abiertos la conformidad de interior es null (no 0: no hay medición)", () => {
    expect(aggregateInterior([seg({ comparable: 5, matched: 5 })]).conformity).toBeNull();
  });
});

/**
 * ★ #71b entrega 2 — AGUJERO A de `isBareEcho`: el pliegue `a↔u`, y por qué es LOCAL.
 *
 * `a↔u` es la confusión DOMINANTE del OCR de AD («Advunce», «Attucked», «wlth Hulberd», «Buck up»)
 * y `probeFold` (`ocr-profile.ts`) sí la pliega. El `FOLD` del derivador NO — y estaba bien que no,
 * porque ese `FOLD` lo consume `foldEcho`, y `foldEcho` lo usa `echoSim`, que es el casado del
 * VOCABULARIO CERRADO de los 12 comandos: plegar más ahí hace que comandos distintos se parezcan.
 *
 * MEDIDO (mutante `["uvy","u"]`→`["uvya","u"]` sobre los 646 segmentos AD): **61 segmentos**
 * cambian su script derivado, `pendingGem` **337 → 0**, `needDirSkipped` 346 → 424. Es otro
 * derivador, no un ajuste fino.
 *
 * ⇒ el pliegue va **LOCAL a `isBareEcho`** (`foldBare`), que es el único sitio donde hace falta:
 * allí no se elige entre comandos, se compara un residuo contra la cabeza YA casada.
 */
describe("derive-dungeon-ops — #71b: el pliegue a↔u es LOCAL a isBareEcho", () => {
  it("★ `Buck up` es el eco pelado de `Back up` — caso REAL de ad17-g09 ln7129", () => {
    expect(isBareEcho('Buck up ~TnZH"TXTE"""""', "Back up")).toBe(true);
  });

  it("★ y la re-lectura REAL se detecta como fantasma (las 4 condiciones + isBareEcho)", () => {
    const prev = { dng: "back", from: "Back up", ocrLn: 7128 };
    const m = { op: { dng: "back" }, echo: "Back up", sim: 1, consumed: 2 };
    expect(isGhostReread(m, 'Buck up ~TnZH"TXTE"""""', 7129, prev)).toBe(true);
  });

  /**
   * ★★ CONTROL NEGATIVO CON DIENTES, y es el que vigila LA MINA: el `FOLD` compartido NO se ha
   * ampliado. Si alguien «arregla» `a↔u` en `FOLD` en vez de en `foldBare`, este test se pone
   * ROJO — y con él se van 61 segmentos del artefacto sin que nadie lo note.
   */
  it("control negativo: el FOLD del VOCABULARIO sigue SIN plegar a↔u", () => {
    expect(foldEcho("Buck")).not.toBe(foldEcho("Back"));
    expect(foldEcho("Advunce")).not.toBe(foldEcho("Advance"));
  });

  /** El otro diente: `isBareEcho` sigue viendo el contenido de juego REAL como contenido. */
  it("control negativo: contenido de juego real NO es eco pelado", () => {
    expect(isBareEcho('Advunce Thou dost find nothing!', "Advunce")).toBe(false);
    expect(isBareEcho('Buck up Entering room..', "Back up")).toBe(false);
  });

  /** Y no se traga un comando DISTINTO sólo por parecerse tras plegar. */
  it("control negativo: `Buck up` NO es eco pelado de `Advance`", () => {
    expect(isBareEcho('Buck up ~TnZH"TXTE"""""', "Advance")).toBe(false);
  });
});

/**
 * ★ #71b entrega 2 — AGUJERO B de `isBareEcho`: el token de RUIDO que contaba como juego.
 *
 * `stripGhostTokens` sólo retira tokens con COMILLA INTERNA (`GHOST_TOKEN` = `/[^\s"]"[^\s"]/`).
 * La cola de una re-lectura fantasma puede traer un token sin comilla —`vWvY.` en `ad20-g03`
 * ln2650— que, por tener 4 letras, contaba como «contenido de juego» y bloqueaba el veredicto de
 * eco pelado.
 *
 * El predicado es «token SIN NINGUNA VOCAL ⇒ no es contenido», y los otros dos candidatos se
 * descartaron MIDIENDO antes de elegir:
 *  · reusar `isGarbage` (`ocr-profile.ts`) NO PUEDE por construcción: exige que el bloque no
 *    tenga ninguna palabra de ≥4 letras, y `vWvY` tiene exactamente 4;
 *  · «mayúscula interna ⇒ ruido» tiene un falso positivo REAL en el corpus: caza `GeoFFrey,`
 *    (35 apariciones), que es contenido de juego — retirar por ahí borraría ops REALES.
 *
 * Y el predicado elegido se midió ANTES de implementarlo: sobre los 646 segmentos AD retira
 * **exactamente 1 op** (la de `ad20-g03`) y ninguna más — que era la condición pre-registrada
 * para poder implementarlo sin pisar el ruling de cola-de-roster de #55.
 */
describe("derive-dungeon-ops — #71b: el token de RUIDO no es contenido de juego", () => {
  it("★ `vWvY.` es ruido — caso REAL de ad20-g03 ln2650", () => {
    expect(isBareEcho('Advunce TE"ZFDmHTXg"""" vWvY.', "Advunce")).toBe(true);
  });

  it("★ y la re-lectura REAL se detecta como fantasma", () => {
    const prev = { dng: "advance", from: "Advance", ocrLn: 2649 };
    const m = { op: { dng: "advance" }, echo: "Advance", sim: 1, consumed: 1 };
    expect(isGhostReread(m, 'Advunce TE"ZFDmHTXg"""" vWvY.', 2650, prev)).toBe(true);
  });

  /**
   * ★★ CONTROL NEGATIVO CON DIENTES: los dos candidatos DESCARTADOS. Si alguien sustituye el
   * predicado por «mayúscula interna», el primero se pone ROJO — `GeoFFrey` es contenido.
   */
  it("control negativo: `GeoFFrey` es CONTENIDO, no ruido (mata el candidato de mayúscula interna)", () => {
    // ⚠ `GeoFFrey` va SOLO a propósito. La primera versión de este control decía
    // «Advunce GeoFFrey, armed» y salía VERDE contra el mutante de mayúscula-interna: quien
    // bloqueaba el eco pelado era `armed`, no `GeoFFrey`, así que el control no tenía DIENTES.
    // Con la palabra sospechosa aislada, el mutante lo pone rojo — comprobado.
    expect(isBareEcho("Advunce GeoFFrey,", "Advunce")).toBe(false);
  });

  it("control negativo: una palabra de juego CON vocales sigue bloqueando el eco pelado", () => {
    expect(isBareEcho('Advunce Thou dost find nothing!', "Advunce")).toBe(false);
    expect(isBareEcho('Advunce Blocked!', "Advunce")).toBe(false);
  });
});
