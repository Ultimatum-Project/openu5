/**
 * WALKTHROUGH-ESPEJO — guardas OFFLINE de la suite (sin playwright):
 *   · las rutas cargan, encadenan (entry.checkpoint) y tienen costuras sanas
 *   · el motor de diff (collapse/blockPattern/dice) matchea lo que debe matchear:
 *     wrap de 16 columnas des-hecho, confusiones OCR l/I/1/]/0/O, números wildcard con
 *     LEDGER de dígitos, RNG excluido, known-gaps con ticket, divergencia con snippet.
 *
 * ── LA FRONTERA DE LOS DOS CORPUS (ver `tests/espejo-corpus.ts`) ─────────────────────────
 * Lo que se asierta aquí sobre la FORMA —que la cadena encadene, que un `skip` planifique
 * nav-only, que un `recruit` viaje como op sancionada— es una propiedad de la HERRAMIENTA y
 * se instancia sobre `routes-sint/`, que VIAJA al repositorio público. Lo que se asierta
 * sobre el CORPUS REAL —el cardinal de 25 partes de AD, el avatar «Barnabas», los ~529 pasos
 * del input-log de Part02, la lista por identidad de los 6 companions del LP2— es un hecho
 * de un corpus que NO controlamos, y ése es justamente su valor: no se mueve al sintético
 * (allí el esperado lo escribiríamos nosotros y el aserto pasaría con la herramienta rota),
 * se envuelve en `describeCorpusReal`. [[el-aserto-que-calcula-su-esperado-desde-el-sujeto-es-tautologico]]
 *
 * 🔴 Y NINGUNA lectura del corpus real fuera del callback de un `it` — tampoco dentro de un
 * `describeCorpusReal`: `describe.skip` EJECUTA su cuerpo al recolectar, así que un
 * `readFileSync` ahí seguiría dando ENOENT en el árbol público.
 */
import { describe, it, expect } from "vitest";
import {
  collapse,
  diffSegment,
  loadRoute,
  listParts,
  planSegment,
  shouldResolveCombat,
  ledgerDeltaResult,
  ROUTES_AD_DIR,
  type Segment,
} from "../e2e/espejo-tour/runner";
import { describeCorpusReal, ROUTES_SINT_DIR, PARTES_SINT } from "./espejo-corpus";
import { joinByName } from "../src/core/party";
import type { GameState } from "../src/core/state";

const seg = (expectBlocks: Array<{ text: string; class?: string }>): Segment => ({
  id: "t-g01",
  ctx: "smallmap",
  seam: null,
  ocr: { from: 1, to: 99 },
  script: [],
  expect: expectBlocks.map((b, i) => ({ text: b.text, ocrLn: i + 1, class: b.class ?? "auto" })),
});

// ══════════════════════════════════════════════════════════════════════ CORPUS SINTÉTICO
/**
 * LA FORMA DE UNA RUTA, instanciada sobre `routes-sint/` — corre en TODAS partes.
 *
 * Ninguno de estos asertos nombra un cardinal, un id ni un importe del LP: son los mismos
 * predicados que abajo se corren sobre LP1/LP2, con el corpus que sí viaja como sujeto.
 *
 * 🔴 CADA BARRIDO LLEVA GUARDA DE POBLACIÓN. Un `for` sobre un corpus que no contenga la
 * clase que el test examina pasa EN VACÍO, y ése es el verde falso que esta reescritura
 * existe para evitar: el día que alguien regenere `routes-sint/` sin segmentos `skip`, o sin
 * `enter.loc`, el barrido seguiría verde sin haber mirado nada. [[el-vacio-se-lee-como-exito]]
 */
describe("corpus SINTÉTICO — la FORMA de una ruta (routes-sint/, viaja al público)", () => {
  it("las partes cargan y encadenan por checkpoint (cadena CONTIGUA sint01..sint06)", () => {
    // El denominador sale de `PARTES_SINT` (escrito EN CRUDO en espejo-corpus.ts), no del
    // propio directorio: un censo cuyo denominador lo pone el sujeto pasa en vacío el día que
    // el directorio se vacíe. [[un-censo-nunca-lleva-2-dev-null]]
    const parts = listParts(ROUTES_SINT_DIR);
    expect(parts).toEqual([...PARTES_SINT]);

    let prev: string | null = null;
    let conLoc = 0;
    let segmentos = 0;
    const locs: number[] = [];
    for (const p of parts) {
      const r = loadRoute(p, ROUTES_SINT_DIR);
      expect(r.part).toBe(p);
      expect(r.segments.length).toBeGreaterThan(0);
      if (prev === null) {
        expect(r.entry.boot).toBe("fresh");
        // El avatar se DECLARA en la primera de la cadena (rasgo de formato). Qué nombre sea
        // es cosa del corpus: aquí sólo se exige que esté, y su valor concreto se carea
        // contra el LP2 en el bloque de corpus real.
        expect(r.entry.normalizeAvatarName).toBeTruthy();
      } else {
        expect(r.entry.checkpoint).toBe(prev);
      }
      for (const s of r.segments) {
        segmentos++;
        if (s.enter?.loc != null) {
          conLoc++;
          locs.push(s.enter.loc);
          // costuras enter con loc conocida — un id de location válido del juego (1..40)
          expect(s.enter.loc, s.id).toBeGreaterThanOrEqual(1);
          expect(s.enter.loc, s.id).toBeLessThanOrEqual(40);
        }
        expect(s.ocr.from, s.id).toBeLessThanOrEqual(s.ocr.to);
      }
      prev = p;
    }

    // ── GUARDAS DE POBLACIÓN ──────────────────────────────────────────────────────────
    expect(segmentos, "el barrido de `ocr.from<=to` no miró NI UN segmento").toBeGreaterThan(0);
    expect(conLoc, "ningún segmento declara `enter.loc`: el rango 1..40 pasó en vacío").toBeGreaterThan(0);
    // Y los BORDES del rango, que el corpus instancia a propósito (README de routes-sint):
    // sin ellos el `>=1`/`<=40` se satisfaría con cualquier valor central y no probaría la cota.
    expect(Math.min(...locs), "falta el borde inferior del rango de location").toBe(1);
    expect(Math.max(...locs), "falta el borde superior del rango de location").toBe(40);
  });

  it("los joins viajan como op `{recruit}` sancionado, y su ORDEN de aparición es estable", () => {
    // La FORMA de la propiedad que abajo se carea por identidad contra los 6 companions del
    // LP2: que el join no se replique a mano en el guion sino que viaje como op del arnés, y
    // que el orden en que el barrido los encuentra sea el de la cadena.
    const found: string[] = [];
    for (const part of PARTES_SINT) {
      for (const seg of loadRoute(part, ROUTES_SINT_DIR).segments) {
        for (const op of seg.script) if (op.recruit) found.push(op.recruit);
      }
    }
    expect(found.length, "el corpus sintético no trae NI UN op `recruit`").toBeGreaterThan(0);
    expect(found).toEqual(["Vela", "Quilla"]);
  });

  it("todo segmento con `skip` planifica nav-only (NI combate NI diff), y hay `skip` que mirar", () => {
    let skips = 0;
    for (const part of PARTES_SINT) {
      for (const seg of loadRoute(part, ROUTES_SINT_DIR).segments) {
        if (!seg.skip) continue;
        skips++;
        const p = planSegment(seg);
        expect(p.mode, `${part}/${seg.id}`).toBe("nav-only");
        expect(p.diff, `${part}/${seg.id}`).toBe(false);
        expect(p.resolveCombat, `${part}/${seg.id}`).toBe(false);
      }
    }
    // Sin esta guarda, un `routes-sint/` regenerado sin la clasificación de interiores dejaría
    // el barrido en verde sin haber planificado un solo segmento. NO es un umbral calibrado
    // (el `>80` del corpus AD sí lo es, y por eso se queda con su corpus): es «>0».
    expect(skips, "ningún segmento del corpus sintético trae `skip`: el barrido pasó en vacío").toBeGreaterThan(0);
  });
});

// ══════════════════════════════════════════════════════════════════════════ CORPUS REAL
describeCorpusReal("espejo-tour rutas commiteadas", () => {
  it("las partes cargan y encadenan por checkpoint (cadena CONTIGUA part01..partNN)", () => {
    const parts = listParts();
    // Cadena contigua sin huecos desde part01 (la suite crece por lotes 07-12/13-18/19-24;
    // el arnés valida el prefijo contiguo, no un literal fijo — evolución del carril).
    expect(parts.length).toBeGreaterThanOrEqual(6);
    expect(parts[0]).toBe("part01");
    parts.forEach((p, i) => expect(p).toBe(`part${String(i + 1).padStart(2, "0")}`));
    let prev: string | null = null;
    for (const p of parts) {
      const r = loadRoute(p);
      expect(r.part).toBe(p);
      expect(r.segments.length).toBeGreaterThan(0);
      if (prev === null) {
        expect(r.entry.boot).toBe("fresh");
      } else {
        expect(r.entry.checkpoint).toBe(prev);
      }
      // costuras enter con loc conocida — un id de location válido del juego (1..40)
      for (const s of r.segments) {
        if (s.enter?.loc != null) {
          expect(s.enter.loc).toBeGreaterThanOrEqual(1);
          expect(s.enter.loc).toBeLessThanOrEqual(40);
        }
        expect(s.ocr.from).toBeLessThanOrEqual(s.ocr.to);
      }
      prev = p;
    }
  });

  it("las rutas conservan input-log real (nav) y evidencia (expect)", () => {
    const r = loadRoute("part02");
    const navSteps = r.segments.reduce(
      (a, s) => a + s.script.reduce((b, op) => b + (op.nav ? op.nav.reduce((c, n) => c + n.n, 0) : 0), 0),
      0,
    );
    expect(navSteps).toBeGreaterThan(400); // el input-log de Part02 ronda los 529 pasos
    const yew = r.segments.find((s) => s.enter?.banner === "YEW");
    expect(yew).toBeDefined();
  });
});

describeCorpusReal("espejo-2 rutas AD commiteadas (LP2 Alex Diener, routes-ad/)", () => {
  it("las 25 partes cargan y encadenan por checkpoint (cadena CONTIGUA ad01..ad25)", () => {
    const parts = listParts(ROUTES_AD_DIR);
    expect(parts.length).toBe(25);
    parts.forEach((p, i) => expect(p).toBe(`ad${String(i + 1).padStart(2, "0")}`));
    let prev: string | null = null;
    for (const p of parts) {
      const r = loadRoute(p, ROUTES_AD_DIR);
      expect(r.part).toBe(p);
      expect(r.segments.length).toBeGreaterThan(0);
      if (prev === null) {
        expect(r.entry.boot).toBe("fresh");
        expect(r.entry.normalizeAvatarName).toBe("Barnabas");
      } else {
        expect(r.entry.checkpoint).toBe(prev);
      }
      for (const s of r.segments) {
        if (s.enter?.loc != null) {
          expect(s.enter.loc).toBeGreaterThanOrEqual(1);
          expect(s.enter.loc).toBeLessThanOrEqual(40);
        }
        expect(s.ocr.from).toBeLessThanOrEqual(s.ocr.to);
      }
      prev = p;
    }
  });

  it("AD es mazmorra-céntrico: los interiores van [SKIP:pendiente-runner] y planifican nav-only", () => {
    let skips = 0;
    for (const part of listParts(ROUTES_AD_DIR)) {
      for (const seg of loadRoute(part, ROUTES_AD_DIR).segments) {
        if (seg.skip) {
          skips++;
          const p = planSegment(seg);
          expect(p.mode, `${part}/${seg.id}`).toBe("nav-only");
          expect(p.diff).toBe(false);
          expect(p.resolveCombat).toBe(false);
        }
      }
    }
    // Alambre-trampa contra una regeneración que PIERDA la clasificación de interiores.
    //
    // ★ RECALIBRADO en #43, y la calibración vieja era la que estaba mal formulada: el 150 salía
    // de «245/656 al generarlo», un estado anterior a DOS cosas que desde entonces recortan la
    // población a propósito — (1) `openedBy`, que el runner ya conduce y por tanto no debe
    // saltarse (E-3/3e), y (2) el fix de #32, que deja de creer interior una costura de salida al
    // Underworld. Medido tras la regeneración de #43: 200 → 116 en AD, y las 89 con `openedBy`
    // siguen sin skip, igual que en la ruta commiteada. O sea la bajada es la clasificación
    // AFINADA, no perdida.
    //
    // Un umbral que se rompería con un arreglo BUENO no es un criterio: es una coincidencia
    // fijada. El nuevo se pone por debajo del suelo medido para seguir cazando lo que este test
    // existe para cazar —que la clasificación se evapore— sin volver a acusar a un fix correcto.
    expect(skips).toBeGreaterThan(80);
  });

  it("los joins del LP2 viajan como op {recruit} sancionado (6 companions, party distinta al LP1)", () => {
    const found: string[] = [];
    for (const part of listParts(ROUTES_AD_DIR)) {
      for (const seg of loadRoute(part, ROUTES_AD_DIR).segments) {
        for (const op of seg.script) if (op.recruit) found.push(op.recruit);
      }
    }
    expect(found).toEqual(["Gwenno", "Jaana", "Julia", "Mariah", "Geoffrey", "Johne"]);
  });
});

describe("motor de decisión (planSegment) — guard de skip:pendiente-runner", () => {
  const withScript = (script: Segment["script"], skip?: string): Segment => ({
    id: "t-g01", ctx: "dungeon", seam: "dungeon-enter", ocr: { from: 1, to: 9 },
    script, expect: [], ...(skip ? { skip } : {}),
  });

  it("segmento normal → modo full: conduce combate y disecciona", () => {
    const p = planSegment(withScript([{ nav: [{ m: "north", v: "walk", n: 3 }] }, { key: "o" }]));
    expect(p.mode).toBe("full");
    expect(p.resolveCombat).toBe(true);
    expect(p.diff).toBe(true);
    expect(p.enterSeam).toBe(true);
  });

  it("segmento skip → modo nav-only: NI combate NI diff NI costura, pero conserva la nav", () => {
    const p = planSegment(withScript(
      [{ nav: [{ m: "east", v: "walk", n: 2 }] }, { key: "a" }, { todo: "Entering room.." }],
      "pendiente-runner",
    ));
    expect(p.mode).toBe("nav-only");
    expect(p.skip).toBe("pendiente-runner");
    expect(p.resolveCombat).toBe(false);
    expect(p.diff).toBe(false);
    expect(p.enterSeam).toBe(false);
    // la nav se preserva (para no desincronizar la posición al atravesar el interior);
    // las ops de escena (teclas/todos) quedan fuera del plan de ejecución nav-only
    expect(p.navOps).toHaveLength(1);
    expect(p.sceneOps.map((o) => o.key ?? o.todo)).toEqual(["a", "Entering room.."]);
  });

  it("contrato del recruit-arnés: core joinByName sube partySize y pone partyStatus=0", () => {
    // El op {recruit} LLAMA a core/party.joinByName vía __u5test.join (no replica). Este
    // test BLINDA el contrato del que depende el ledger de party: si el core cambia el
    // efecto del join, revienta AQUÍ (en verde/rojo), no en silencio (ruling Condición A).
    const state = {
      characters: [
        { name: "Min", partyStatus: 0 },
        { name: "Shamino", partyStatus: 0 },
        { name: "Iolo", partyStatus: 0 },
        { name: "Jaana", partyStatus: 0xff },
      ],
      partySize: 3,
    } as unknown as GameState;
    const r = joinByName(state, "Jaana");
    expect(r.ok).toBe(true);
    expect(state.partySize).toBe(4);
    expect(state.characters.find((c) => c.name === "Jaana")!.partyStatus).toBe(0);
    // idempotencia / party llena: re-unir a alguien ya dentro no re-sube
    expect(joinByName(state, "Jaana").ok).toBe(false);
    expect(state.partySize).toBe(4);
  });

  it("ledger DELTA por transacción (comparable), no el balance (no-comparable por loot RNG)", () => {
    // el port cobra el delta EXACTO → match; balance sembrado (2000) no importa, sólo el delta
    expect(ledgerDeltaResult(2000, 1046, -954)).toEqual({ expected: -954, got: -954, match: true });
    // venta +36
    expect(ledgerDeltaResult(150, 186, 36)).toEqual({ expected: 36, got: 36, match: true });
    // DIVERGENCIA de port: cobró de más (el buy no fue exacto) → match:false = sapo de mecánica
    expect(ledgerDeltaResult(2000, 1000, -954)).toEqual({ expected: -954, got: -1000, match: false });
    // buy que NO disparó (oro sin cambio) → got 0 ≠ -954
    expect(ledgerDeltaResult(2000, 2000, -954).match).toBe(false);
  });

  it("guard anti-thrash de combate: un combate atascado NO se re-lanza (fix del timeout part02)", () => {
    // sin combate → no se lanza (y el llamador rearma el guard)
    expect(shouldResolveCombat(false, { stuck: false })).toBe(false);
    // combate activo, aún no atascado → se lanza
    expect(shouldResolveCombat(true, { stuck: false })).toBe(true);
    // combate activo YA marcado atascado → NO se re-lanza (corta el bucle resolver↔nav 104×)
    expect(shouldResolveCombat(true, { stuck: true })).toBe(false);
  });

  // La MISMA propiedad corre además sobre el corpus sintético (arriba, con guarda de
  // población) y por tanto viaja al público. Ésta se queda porque su SUJETO es el corpus
  // real: que la curación de LP1 no pierda la clasificación de interiores.
  describeCorpusReal("…y sobre el corpus real de LP1", () => {
    it("todos los segmentos [SKIP] de las rutas commiteadas planifican nav-only", () => {
      let skips = 0;
      for (const part of listParts()) {
        for (const seg of loadRoute(part).segments) {
          if (seg.skip) {
            skips++;
            const p = planSegment(seg);
            expect(p.mode, `${part}/${seg.id}`).toBe("nav-only");
            expect(p.diff).toBe(false);
            expect(p.resolveCombat).toBe(false);
          }
        }
      }
      expect(skips, "ningún segmento de LP1 trae `skip`: el barrido pasó en vacío").toBeGreaterThan(0);
    });
  });
});

describe("motor de diff", () => {
  it("des-wrap + confusiones OCR: bloque de 16 cols matchea la línea lógica del port", () => {
    const r = diffSegment(seg([{ text: "Thou dost find nothing of note" }]), [
      ">Search-East",
      "Thou dost find nothing of note!",
    ]);
    expect(r.blocks[0]!.verdict).toBe("match");
    // las confusiones del OCR real colapsan igual que el texto limpio del port
    expect(collapse("0rc ki[led!")).toBe(collapse("Orc killed!"));
    expect(collapse(">0pen-North 0pened!")).toBe(collapse("Open-North Opened!"));
  });

  it("números en wildcard + ledger de dígitos (deriva numérica registrada, no descartada)", () => {
    const r = diffSegment(seg([{ text: "The trolls demand a 24 gp toll!" }]), [
      "The trolls demand a 21 gp",
      "toll!",
    ]);
    expect(r.blocks[0]!.verdict).toBe("match");
    expect(r.blocks[0]!.numbers).toEqual({ expected: ["24"], got: ["21"] });
  });

  it("RNG de combate queda no-comparable (no penaliza conformidad)", () => {
    const r = diffSegment(seg([{ text: "Orc killed!" }, { text: "Min, armed with Long Sword:" }]), []);
    expect(r.blocks.every((b) => b.verdict === "rng")).toBe(true);
    expect(r.conformity).toBeNull();
  });

  it("known-gap ausente lleva ticket y no penaliza; si matchea aflora gap-cerrado", () => {
    const missing = diffSegment(seg([{ text: "Thou spieth trolls under the bridge!" }]), ["otra cosa"]);
    expect(missing.blocks[0]!.verdict).toBe("known-gap");
    expect(missing.blocks[0]!.ticket).toContain("C5");
    const present = diffSegment(seg([{ text: "Thou spieth trolls under the bridge!" }]), [
      "Thou spieth trolls under the bridge!",
    ]);
    expect(present.blocks[0]!.verdict).toBe("gap-cerrado");
  });

  it("divergencia real: verdict divergent con snippet del port", () => {
    const r = diffSegment(seg([{ text: "Dost thou wish to leave? Yes Exit to Britannia!" }]), [
      "Un texto completamente distinto",
      "que no casa con nada",
    ]);
    expect(r.blocks[0]!.verdict).toBe("divergent");
    expect(r.conformity).toBe(0);
  });
});

describe("motor de diff — consciente de CANAL/OCR (Fase B, empírico de part01-04)", () => {
  it("eco de comando: 'Look-East Thou dost see X' casa contra el RESULTADO del port", () => {
    // el port NO registra el eco de input '>Look-East'; sólo el resultado
    const r = diffSegment(seg([{ text: "Look-East Thou dost see a hot stove" }]), [
      "Thou dost see a hot stove",
    ]);
    expect(r.blocks[0]!.verdict).toBe("match");
  });

  it("interstitial 'Player: Min' (indicador de jugador activo) se retira antes de casar", () => {
    const r = diffSegment(seg([{ text: "Search-East Player: Min Thou dost find nothing of note" }]), [
      "Thou dost find nothing of note",
    ]);
    expect(r.blocks[0]!.verdict).toBe("match");
  });

  it("RNG tolerante a OCR: 'VICT0RY!' y '0rc ki[led!' → rng (antes fugaban como divergentes)", () => {
    const r = diffSegment(seg([{ text: "VICT0RY!" }, { text: "0rc ki[led!" }]), []);
    expect(r.blocks.every((b) => b.verdict === "rng")).toBe(true);
    expect(r.conformity).toBeNull(); // no comparable
  });

  it("PRESENTACION estrechada: Z-stats overlay + indicador de jugador PURO (no contenido)", () => {
    const r = diffSegment(
      seg([
        { text: "Z-stats... Player: Min Status: Done" },
        { text: "Player: Min Player: Jaana" }, // indicadores repetidos = pantalla
        { text: "Player: None!" },
      ]),
      ["ruido del port"],
    );
    expect(r.blocks.every((b) => b.verdict === "presentacion")).toBe(true);
    expect(r.presentacion).toBe(3);
    expect(r.comparable).toBe(0);
  });

  it("PRESENTACION NO se traga 'Player: <contenido>' (el scroll #7 del spot-check)", () => {
    // 'Player: A scroll: RP!' es un resultado LOGUEADO por el port → NO indicador puro →
    // debe intentar casar (y casar si el port lo tiene), no barrerse como presentacion.
    const r = diffSegment(seg([{ text: "Player: A scroll: RP!" }]), ["A scroll: RP!"]);
    expect(r.blocks[0]!.verdict).toBe("match");
    expect(r.presentacion).toBe(0);
  });

  it("OCR-PARTIAL con evidencia: 'Look-2' con el 'Look-East' que el port SÍ logueó → ocr-partial", () => {
    const r = diffSegment(seg([{ text: "Look-2" }]), ["Look-East", "Thou dost see a table"]);
    expect(r.blocks[0]!.verdict).toBe("ocr-partial");
    expect(r.ocrPartial).toBe(1);
    expect(r.comparable).toBe(0); // no-comparable (captura fallida demostrada)
  });

  it("OCR-PARTIAL SIN evidencia NO se barre: sin eco port-logueado queda DIVERGENTE", () => {
    const r = diffSegment(seg([{ text: "Look-2" }]), ["Cast...", "Nada que ver aqui"]);
    expect(r.blocks[0]!.verdict).toBe("divergent");
    expect(r.ocrPartial).toBe(0);
  });
});
