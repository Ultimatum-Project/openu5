/**
 * EL PC-SPEAKER FIEL (task #3) — capa PURA del sintetizador: las 6 primitivas y
 * el catálogo acción→segmentos, sin AudioContext real. Fija la fórmula de
 * conversión parámetro→Hz (la constante de calibración `SPEAKER_SAMPLE_RATE_HZ`)
 * y las FORMAS derivadas del asm (§ de `re/notes/sfx-catalog.md`). Un contexto
 * de audio FALSO comprueba el agendado de `SpeakerSynth` sin navegador.
 */
import { describe, expect, it } from "vitest";
import {
  SPEAKER_SAMPLE_RATE_HZ,
  incToHz,
  samplesToMs,
  toneSweep,
  noiseBurst,
  noisePrng,
  pitHz,
  beep,
  glide,
  renderCue,
  cueDurationMs,
  CAMP_BARD_STEP_MS,
  CAMP_BARD_INDEX_COUNT,
  SFX_CATALOG,
  SpeakerSynth,
  SpeakerAudio,
  speakerEnabled,
  setSpeakerEnabled,
  SPEAKER_STORAGE_KEY,
  type SfxSeg,
} from "../src/skin/fiel/speaker.js";

describe("conversión parámetro→Hz (calibración única)", () => {
  it("incToHz sigue (inc/65536)·SR y cae en rango audible", () => {
    expect(incToHz(0x8000)).toBeCloseTo(SPEAKER_SAMPLE_RATE_HZ / 2, 5); // medio módulo
    expect(incToHz(0xfd2)).toBeGreaterThan(20);
    expect(incToHz(0xfd2)).toBeLessThan(20000);
  });
  it("incToHz recorta al rango [20, 20000]", () => {
    expect(incToHz(1)).toBe(20); // demasiado grave → piso
    expect(incToHz(0xffff)).toBeLessThanOrEqual(20000);
  });
  it("samplesToMs = count·delay·1000/SR; delay escala la duración", () => {
    expect(samplesToMs(SPEAKER_SAMPLE_RATE_HZ, 1)).toBeCloseTo(1000, 5); // SR muestras = 1 s
    expect(samplesToMs(1000, 2)).toBeCloseTo(samplesToMs(1000, 1) * 2, 5);
  });
});

describe("tone_sweep (0x2192)", () => {
  it("f0 deriva de inc; la duración escala con count", () => {
    const a = toneSweep(0xa50, 1, 5000, 200, 13);
    const b = toneSweep(0xa50, 1, 10000, 200, 13);
    expect(a.f0).toBeCloseTo(incToHz(0xa50), 5);
    expect(b.ms).toBeCloseTo(a.ms * 2, 5);
  });
  it("pitch CONSTANTE = incToHz(inc), independiente de start/step (el sweep de bx es DUTY, no pitch)", () => {
    // Regresión del bug de moongate/clavicémbalo: 0x2192 es PWM con fundamental fijo
    // = inc/65536·SR; el umbral bx sólo modula el duty (timbre →AV). El modelo viejo
    // (§1.1: step<0 sube, step>0 baja) quedó REFUTADO por el espectro de los testigos
    // (moongate ~2000 Hz constante; clavicémbalo notas estables). Cualquier start/step
    // da f0===f1===incToHz(inc).
    for (const [start, step] of [
      [20000, -10],
      [1000, 6],
      [2000, 2],
      [20000, -4],
    ] as const) {
      const s = toneSweep(0x2000, 1, 1000, start, step);
      expect(s.f0).toBe(s.f1); // constante — sin rampa de pitch
      expect(s.f0).toBeCloseTo(incToHz(0x2000), 6);
    }
  });
  it("count negativo se lee como u16 (no rompe la duración)", () => {
    const seg = toneSweep(0x1180, 1, -536, 300, 1);
    expect(seg.ms).toBeGreaterThan(0);
  });
});

describe("noise_burst (0x223c) + PRNG local [0x545c]", () => {
  it("el PRNG es determinista y de 16 bits", () => {
    const a = noisePrng(0x1234);
    const b = noisePrng(0x1234);
    expect(a).toBe(b);
    expect(a).toBeGreaterThanOrEqual(0);
    expect(a).toBeLessThanOrEqual(0xffff);
  });
  it("todas las frecuencias caen en [0x64, band]", () => {
    const seg = noiseBurst(10, 3000, 2000);
    expect(seg.kind).toBe("noise");
    for (const f of (seg as { freqs: number[] }).freqs) {
      expect(f).toBeGreaterThanOrEqual(0x64);
      // El TECHO exacto de una banda es `pitHz(band)`, no `band`: la cuantizacion del
      // contador del PIT (#254) puede empujar la emitida un pelo por encima del sorteo.
      expect(f).toBeLessThanOrEqual(pitHz(2000));
    }
  });
  it("nº de muestras ≈ dur/step (más grano con step menor)", () => {
    const coarse = noiseBurst(40, 3000, 500) as { freqs: number[] };
    const fine = noiseBurst(10, 3000, 500) as { freqs: number[] };
    expect(fine.freqs.length).toBeGreaterThan(coarse.freqs.length);
  });
  it("misma semilla ⇒ misma secuencia (reproducible para tests)", () => {
    const x = noiseBurst(10, 300, 2000, 0xabcd) as { freqs: number[] };
    const y = noiseBurst(10, 300, 2000, 0xabcd) as { freqs: number[] };
    expect(x.freqs).toEqual(y.freqs);
  });
});

describe("beep (0x22c0) y glide (0x43ae)", () => {
  it("beep es un tono fijo de pitch directo", () => {
    const seg = beep(3000, 3);
    expect(seg.f0).toBe(seg.f1);
    expect(seg.f0).toBe(3000);
    expect(seg.ms).toBeGreaterThan(0);
  });
  it("glide es la ESCALERA del binario y NUNCA llega a la nominal (#137)", () => {
    const seg = glide(2500, 800, 1, 300);
    expect(seg.f0).toBe(2500);
    // 0x43ae no compara `fin`: inc = trunc(−1700/300) = −5, 300 vueltas ⇒ el último
    // divisor escrito al PIT suena a 2500 − 5·299 = 1005 Hz, no a la nominal 800.
    expect(seg.f1).toBe(1005);
    expect(seg.steps).toHaveLength(300);
    expect(seg.ms).toBeGreaterThan(0);
  });
});

describe("catálogo acción→segmentos (§6)", () => {
  it("todo SfxId produce al menos un segmento", () => {
    for (const id of Object.keys(SFX_CATALOG) as (keyof typeof SFX_CATALOG)[]) {
      expect(renderCue({ id }).length).toBeGreaterThan(0);
    }
  });
  it("combat-hit = un burst de ruido; cast-spell = 4 tonos (TS×4)", () => {
    expect(renderCue({ id: "combat-hit" })).toHaveLength(1);
    expect(renderCue({ id: "combat-hit" })[0]!.kind).toBe("noise");
    expect(renderCue({ id: "cast-spell" })).toHaveLength(4);
  });
  it("apparition-arpeggio = 6 notas de la tabla [0x3a26] (3 en la fundamental + 3 ascendentes)", () => {
    // RE-BASELINE (carril aparición): OUTSUBS 0x0683-0x06a2 recorre si=0x3a26..0x3a32
    // (6 words) → DATA.OVL fo 0x3a36 = 2620×3, 3700, 3900, 4160. El baseline previo de
    // 3 notas era un placeholder nominal ("NO derivable del estático", ya derivado).
    const segs = renderCue({ id: "apparition-arpeggio" }) as SfxSeg[];
    expect(segs).toHaveLength(6);
    const tones = segs.filter((s): s is Extract<SfxSeg, { kind: "tone" }> => s.kind === "tone");
    expect(tones).toHaveLength(6);
    // f0 sale en Hz (incToHz del inc PWM): 3 iguales en la fundamental + 3 ascendentes.
    expect(tones[0]!.f0).toBe(tones[1]!.f0);
    expect(tones[1]!.f0).toBe(tones[2]!.f0);
    expect(tones[2]!.f0).toBeLessThan(tones[3]!.f0);
    expect(tones[3]!.f0).toBeLessThan(tones[4]!.f0);
    expect(tones[4]!.f0).toBeLessThan(tones[5]!.f0);
  });
  it("apparition-chord es un acorde LARGO (count=60000)", () => {
    expect(cueDurationMs({ id: "apparition-chord" })).toBeGreaterThan(
      cueDurationMs({ id: "apparition-heal-chime" }),
    );
  });
  it("instrument-note varía por dígito `n`", () => {
    const a = renderCue({ id: "instrument-note", n: 0 })[0] as { f0: number };
    const b = renderCue({ id: "instrument-note", n: 9 })[0] as { f0: number };
    expect(a.f0).not.toBe(b.f0);
  });
  it("shop-transaction: jingle del curandero = 6 sweeps (SHOPPES 0x13b0-0x1469, 3 pares espejo)", () => {
    // RE-BASELINE (carril audio-costuras): los 6 tone_sweep de SHOPPES viven en
    // UNA rutina LINEAL (0x13b0→ret 0x1469) — 3 pares con inc 0x100e/0x11b2/0x8fc
    // — cuyos únicos callers son las ramas C/H/R del curandero al ejecutar el
    // servicio. El modelo previo (1 sweep, asc=éxito/desc=fallo por `n`) queda
    // retirado; `n` se ignora (mismo jingle siempre).
    const segs = renderCue({ id: "shop-transaction" });
    expect(segs).toHaveLength(6);
    const same = renderCue({ id: "shop-transaction", n: -1 });
    expect(same).toEqual(segs); // n ignorado
    // Pares: 1-2 mismo inc (pitch), 3-4 mismo inc, 5-6 mismo inc.
    const tones = segs as Array<{ f0: number; ms: number }>;
    expect(tones[0]!.f0).toBe(tones[1]!.f0);
    expect(tones[2]!.f0).toBe(tones[3]!.f0);
    expect(tones[4]!.f0).toBe(tones[5]!.f0);
  });
  it("dungeon-trap = NB(40,3000,500): el bang del despachador de trampa (kernel 0x2fd0 @0x2fe3)", () => {
    // RE-BASELINE: el NB(1,50,3500) anterior era la atribución suelta «gotas/eco»;
    // esos params son ahora `field-afflict` (DUNGEON @0x99e/@0xa30). Misma tupla
    // que search-fail (SJOG 0x237): misma duración (las freqs del ruido salen del
    // PRNG local compartido → no se comparan literal).
    const trap = renderCue({ id: "dungeon-trap" })[0] as { kind: string; ms: number };
    const fail0 = renderCue({ id: "search-fail" })[0] as { kind: string; ms: number };
    expect(trap.kind).toBe("noise");
    expect(trap.ms).toBe(fail0.ms); // dur=3000 en ambos (NB(40,3000,500))
    const afflict = renderCue({ id: "field-afflict" })[0] as { ms: number };
    expect(afflict.ms).toBeGreaterThan(0);
    const zap = renderCue({ id: "dungeon-zap" })[0] as { kind: string };
    expect(zap.kind).toBe("noise");
    const fail = renderCue({ id: "dungeon-fail" })[0] as { kind: string; f0: number; f1: number };
    expect(fail.kind).toBe("tone");
    expect(fail.f0).toBe(800); // glide 800→2000 (DUNGEON 0x1cfb; Hz exactos, no →AV)
    // #137: inc = 1200/50 = 24 (exacto), 50 vueltas ⇒ último tono 800 + 24·49 = 1976 Hz
    // (la nominal 2000 nunca se escribe: el tono suena ANTES del incremento final).
    expect(fail.f1).toBe(1976);
  });
  it("move-blocked = beep(0xa5,0xc8): un tono fijo (bump de pared MAINOUT 0x0344/TOWN 0x0849)", () => {
    const segs = renderCue({ id: "move-blocked" }) as SfxSeg[];
    expect(segs).toHaveLength(1);
    const s = segs[0]!;
    expect(s.kind).toBe("tone");
    const t = s as Extract<SfxSeg, { kind: "tone" }>;
    expect(t.f0).toBe(t.f1); // beep = pitch fijo
    expect(t.ms).toBeGreaterThan(0);
    // Debe coincidir con beep(0xa5,0xc8) directo (los mismos params del asm).
    expect(t).toEqual(beep(0xa5, 0xc8));
  });

  // #161 — los dos beeps del funnel de rechazo de la arena (SJOG 0x1f26, rematado
  // en 0x1f52/0x1f5d). Esperados EN CRUDO del asm (no derivados del sujeto):
  // primer push = freq (convención adjudicada por el call-site del tic del reloj,
  // kernel 0x4299) ⇒ 0xdc=220 Hz y 0x96=150 Hz, dur 0x96 ambos, SIN silencio entre
  // medias (el binario encadena los dos `call beep` sin delay). El aserto de 220
  // AFIRMA el rasgo que el comentario histórico tenía invertido («dos pitidos de
  // 150 Hz»): con la pareja invertida el primer beep saldría a 150 y esto cae.
  it("combat-reject = beep(0xdc,0x96) + beep(0x96,0x96): bip-bop descendente 220→150 Hz sin hueco", () => {
    const segs = renderCue({ id: "combat-reject" }) as SfxSeg[];
    expect(segs).toHaveLength(2); // dos tonos contiguos, ningún segmento de silencio
    const [a, b] = segs as [Extract<SfxSeg, { kind: "tone" }>, Extract<SfxSeg, { kind: "tone" }>];
    expect(a.kind).toBe("tone");
    expect(b.kind).toBe("tone");
    expect(a.f0).toBe(220); // 0xdc — NO 150: la pareja del primer beep va (freq, dur)
    expect(a.f0).toBe(a.f1); // beep = pitch fijo
    expect(b.f0).toBe(150); // 0x96
    expect(b.f0).toBe(b.f1);
    expect(a.ms).toBeCloseTo(b.ms, 6); // dur 0x96 en ambos
    // Y byte-exactos contra la primitiva con los params del asm.
    expect(a).toEqual(beep(0xdc, 0x96));
    expect(b).toEqual(beep(0x96, 0x96));
  });

  // Footstep (kernel sfx_footstep 0x433e): dos noise_burst, band 1000 luego 1500.
  // Refuta "andar es mudo" — testigo de runtime en walk-sound-verdict.md (#51).
  it("move-step = noise_burst(1,25,1000) + silence(0x14) + noise_burst(1,25,1500)", () => {
    const segs = renderCue({ id: "move-step" }) as SfxSeg[];
    expect(segs).toHaveLength(3); // dos bursts SEPARADOS por el hueco delay(0x14) del asm (0x4355)
    // El PRNG del ruido es PERSISTENTE (task #72): los freqs varían por burst, así
    // que se comparan por ESTRUCTURA (ms es seed-independiente) y rango de banda.
    const b0 = segs[0] as { kind: string; ms: number; freqs: number[] };
    const b2 = segs[2] as { kind: string; ms: number; freqs: number[] };
    expect(b0.kind).toBe("noise");
    expect(b0.ms).toBeCloseTo(noiseBurst(1, 25, 1000, 0).ms, 6);
    expect(Math.max(...b0.freqs)).toBeLessThanOrEqual(pitHz(1000)); // band=1000 (techo cuantizado, #254)
    expect(segs[1]!.kind).toBe("silence"); // el hueco de 18.6 ms (dos clics "tk‥tk")
    expect(b2.kind).toBe("noise");
    expect(b2.ms).toBeCloseTo(noiseBurst(1, 25, 1500, 0).ms, 6);
    expect(Math.max(...b2.freqs)).toBeLessThanOrEqual(pitHz(1500)); // band=1500 (techo cuantizado, #254)
  });
});

// ── Capa de audio: contexto FALSO que registra el agendado ────────────────────

interface FakeParam {
  sets: [number, number][];
  ramps: [number, number][];
}
function fakeParam(): FakeParam & {
  setValueAtTime(v: number, t: number): void;
  linearRampToValueAtTime(v: number, t: number): void;
  exponentialRampToValueAtTime(v: number, t: number): void;
} {
  const sets: [number, number][] = [];
  const ramps: [number, number][] = [];
  return {
    sets,
    ramps,
    setValueAtTime(v, t) {
      sets.push([v, t]);
    },
    linearRampToValueAtTime(v, t) {
      ramps.push([v, t]);
    },
    exponentialRampToValueAtTime(v, t) {
      ramps.push([v, t]);
    },
  };
}

function fakeCtx() {
  const oscillators: { freq: FakeParam; started: number; stopped: number }[] = [];
  // Nodos registrados para poder inspeccionar el GRAFO del ruido (task #72-re): el
  // código muta `.type`/`.frequency.value`/`.curve` sobre los objetos devueltos, así que
  // guardar la referencia deja leer los valores finales tras `play()`.
  const filters: { type: string; frequency: { value: number } }[] = [];
  const shapers: { curve: Float32Array | null }[] = [];
  // Registro del grafo: cada `connect(target)` anota [origen, destino] por etiqueta, para
  // verificar el CAMINO del ruido (osc→shaper→gain→hp→lp→dest) y no sólo que existan nodos.
  const edges: [string, string][] = [];
  const label = (n: unknown): string => {
    const node = n as { _label?: string; type?: string };
    if (node?._label === "filter") return node.type ?? "filter"; // highpass/lowpass
    return node?._label ?? ((n as AudioNode) === ctxRef.destination ? "dest" : "?");
  };
  const ctxRef = {
    currentTime: 0,
    destination: { name: "dest", _label: "dest" } as unknown as AudioNode,
    createOscillator() {
      const freq = fakeParam();
      const rec = { freq, started: -1, stopped: -1 };
      oscillators.push(rec);
      const node = {
        _label: "osc",
        type: "sine",
        frequency: freq,
        connect(t: unknown) { edges.push(["osc", label(t)]); },
        start(t: number) { rec.started = t; },
        stop(t: number) { rec.stopped = t; },
      };
      return node as unknown as OscillatorNode;
    },
    createGain() {
      const node = { _label: "gain", gain: fakeParam(), connect(t: unknown) { edges.push(["gain", label(t)]); } };
      return node as unknown as GainNode;
    },
    createBiquadFilter() {
      // Filtros del ruido (paso-bajo cono + paso-alto AC, task #72-re).
      const node = { _label: "filter", type: "lowpass", frequency: { value: 0 }, connect(t: unknown) { edges.push([node.type, label(t)]); } };
      filters.push(node);
      return node as unknown as BiquadFilterNode;
    },
    createWaveShaper() {
      // Modelador unipolar del ruido (0/+1, task #72-re).
      const node: { _label: string; curve: Float32Array | null; connect(t: unknown): void } = {
        _label: "shaper", curve: null, connect(t: unknown) { edges.push(["shaper", label(t)]); },
      };
      shapers.push(node);
      return node as unknown as WaveShaperNode;
    },
  };
  const ctx = ctxRef as unknown as AudioContext;
  return { ctx, oscillators, filters, shapers, edges };
}

describe("SpeakerSynth (agendado en un AudioContext falso)", () => {
  it("un cue de un solo segmento agenda un oscilador cuadrado", () => {
    const { ctx, oscillators } = fakeCtx();
    new SpeakerSynth(ctx).play({ id: "combat-hit" });
    expect(oscillators).toHaveLength(1);
    expect(oscillators[0]!.started).toBe(0);
    expect(oscillators[0]!.stopped).toBeGreaterThan(0);
  });
  it("cast-spell (TS×4) agenda 4 osciladores encadenados en el tiempo", () => {
    const { ctx, oscillators } = fakeCtx();
    new SpeakerSynth(ctx).play({ id: "cast-spell" });
    expect(oscillators).toHaveLength(4);
    // Cada segmento arranca donde acabó el anterior (encadenado).
    expect(oscillators[1]!.started).toBeCloseTo(oscillators[0]!.stopped, 5);
  });
  it("un GLIDE (0x43ae) agenda ESCALERA de sets (#137, sin rampa); un tono 0x2192 un solo set", () => {
    const g = fakeCtx();
    new SpeakerSynth(g.ctx).play({ id: "cannon-fire" }); // glide 1000→200 ⇒ escalera de 60
    expect(g.oscillators[0]!.freq.ramps.length).toBe(0); // el PIT no rampa: salta de divisor en divisor
    expect(g.oscillators[0]!.freq.sets.length).toBe(60); // un set_tone por vuelta (300/5)
    const m = fakeCtx();
    new SpeakerSynth(m.ctx).play({ id: "moongate" }); // 0x2192 ⇒ pitch fijo, sin rampa
    expect(m.oscillators[0]!.freq.ramps.length).toBe(0);
    expect(m.oscillators[0]!.freq.sets.length).toBe(1);
  });

  // ── Ancla del fix #72-re (el hallazgo MÁS importante) ──────────────────────
  // Sin estos asserts, revertir el WaveShaper unipolar / el paso-alto / el borde seco
  // dejaría los demás tests verdes (sólo comprueban duraciones/frecuencias). Estos
  // discriminan la CADENA DE SÍNTESIS del ruido, que es donde vivía el "no se parece".
  it("RUIDO: cablea WaveShaper UNIPOLAR (curva [0,0,1]) + paso-alto AC + paso-bajo cono", () => {
    const { ctx, shapers, filters, edges } = fakeCtx();
    new SpeakerSynth(ctx).play({ id: "combat-hit" }); // noise_burst
    // Unipolar: exactamente un WaveShaper con la curva del gate monopolo.
    expect(shapers).toHaveLength(1);
    expect(Array.from(shapers[0]!.curve ?? [])).toEqual([0, 0, 1]);
    // Dos biquads: paso-alto (acople AC ~20 Hz) y paso-bajo (cono, NOISE_LOWPASS_HZ).
    const types = filters.map((f) => f.type).sort();
    expect(types).toEqual(["highpass", "lowpass"]);
    expect(filters.find((f) => f.type === "highpass")!.frequency.value).toBe(20);
    expect(filters.find((f) => f.type === "lowpass")!.frequency.value).toBe(2100);
    // CAMINO real (no sólo que existan): osc→shaper→gain→highpass→lowpass→dest.
    expect(edges).toEqual([
      ["osc", "shaper"],
      ["shaper", "gain"],
      ["gain", "highpass"],
      ["highpass", "lowpass"],
      ["lowpass", "dest"],
    ]);
  });
  it("TONO sostenido: NO pasa por el WaveShaper ni por filtros de ruido (osc→gain→dest)", () => {
    const { ctx, shapers, filters, edges } = fakeCtx();
    new SpeakerSynth(ctx).play({ id: "move-blocked" }); // beep (tono)
    expect(shapers).toHaveLength(0);
    expect(filters).toHaveLength(0);
    expect(edges).toEqual([
      ["osc", "gain"],
      ["gain", "dest"],
    ]);
  });
  it("PASO: puerta del ruido casi instantánea (borde seco, no el ataque suave del tono)", () => {
    // El burst de ruido más corto NO debe gastar el EDGE_S de 4 ms del tono: su ataque
    // (primer tramo de rampa de ganancia) ha de ser <= NOISE_EDGE_S·2, no ~4 ms.
    const { ctx } = fakeCtx();
    const gains: FakeParam[] = [];
    const spyCtx = {
      ...(ctx as unknown as Record<string, unknown>),
      createGain() {
        const gain = fakeParam();
        gains.push(gain);
        return { gain, connect() {} } as unknown as GainNode;
      },
    } as unknown as AudioContext;
    new SpeakerSynth(spyCtx).play({ id: "move-step" }); // 2 noise bursts
    // Primer burst: el ataque va de ~0 (setValueAtTime en t0) al pico (ramp). El tiempo
    // de ese primer ramp - t0 = borde. Debe ser <= 0.5 ms (NOISE_EDGE_S=0.2, con margen),
    // muy por debajo del 4 ms del tono.
    const g = gains[0]!;
    const t0 = g.sets[0]![1];
    const attackEnd = g.ramps[0]![1];
    expect(attackEnd - t0).toBeLessThanOrEqual(0.0005);
  });
});

// ── Toggle persistente ────────────────────────────────────────────────────────

function fakeStore(): Storage {
  const m = new Map<string, string>();
  return {
    getItem: (k) => m.get(k) ?? null,
    setItem: (k, v) => void m.set(k, v),
    removeItem: (k) => void m.delete(k),
    clear: () => m.clear(),
    key: () => null,
    length: 0,
  } as Storage;
}

describe("toggle persistente del speaker", () => {
  it("default ON; persiste el apagado y lo relee", () => {
    const store = fakeStore();
    expect(speakerEnabled(store)).toBe(true); // sin entrada → ON
    setSpeakerEnabled(false, store);
    expect(store.getItem(SPEAKER_STORAGE_KEY)).toBe("0");
    expect(speakerEnabled(store)).toBe(false);
    setSpeakerEnabled(true, store);
    expect(speakerEnabled(store)).toBe(true);
  });
});

describe("SpeakerAudio (ciclo de vida robusto)", () => {
  it("sin Web Audio (factory null) no lanza al reproducir", () => {
    const audio = new SpeakerAudio(() => null);
    expect(() => audio.play({ id: "combat-hit" })).not.toThrow();
  });
  it("apagado no crea contexto ni reproduce", () => {
    let created = 0;
    const audio = new SpeakerAudio(() => {
      created++;
      return fakeCtx().ctx;
    });
    audio.setEnabled(false);
    audio.play({ id: "combat-hit" });
    expect(created).toBe(0);
  });
  it("encendido reproduce a través del contexto inyectado", () => {
    const { ctx, oscillators } = fakeCtx();
    const audio = new SpeakerAudio(() => ctx);
    audio.setEnabled(true);
    audio.play({ id: "combat-hit" });
    expect(oscillators.length).toBeGreaterThan(0);
  });
});

describe("SpeakerAudio.unlock (desbloqueo por gesto de usuario)", () => {
  // El demo del attract dispara sus cues desde el rAF; los navegadores sólo reanudan
  // Web Audio dentro de un handler de gesto. `unlock()` crea+reanuda el AudioContext en
  // el 1er gesto para que los `play()` posteriores del rAF ya suenen. Ctx SUSPENDED con
  // `resume` espiado (fakeCtx no lo trae; el ciclo real lo comprueba en ensure()).
  function suspendedCtx() {
    const inner = fakeCtx();
    let resumes = 0;
    const c = inner.ctx as unknown as { state: AudioContextState; resume(): Promise<void> };
    c.state = "suspended";
    c.resume = () => {
      resumes++;
      c.state = "running";
      return Promise.resolve();
    };
    return { ctx: inner.ctx, oscillators: inner.oscillators, resumes: () => resumes };
  }

  it("crea y REANUDA el contexto en el gesto, es idempotente y no reproduce nada", () => {
    let created = 0;
    const fake = suspendedCtx();
    const audio = new SpeakerAudio(() => {
      created++;
      return fake.ctx;
    });
    audio.setEnabled(true);
    audio.unlock();
    expect(created).toBe(1);
    expect(fake.resumes()).toBeGreaterThanOrEqual(1); // resume DENTRO del gesto
    expect(fake.oscillators).toHaveLength(0); // desbloquear ≠ sonar
    audio.unlock();
    expect(created).toBe(1); // idempotente: no recrea el contexto
  });

  it("apagado no crea contexto (nada que desbloquear)", () => {
    let created = 0;
    const audio = new SpeakerAudio(() => {
      created++;
      return fakeCtx().ctx;
    });
    audio.setEnabled(false);
    audio.unlock();
    expect(created).toBe(0);
  });

  it("sin Web Audio (factory null) unlock no lanza", () => {
    const audio = new SpeakerAudio(() => null);
    expect(() => audio.unlock()).not.toThrow();
  });

  it("tras unlock, un play posterior (rAF) suena por el mismo contexto ya reanudado", () => {
    const fake = suspendedCtx();
    const audio = new SpeakerAudio(() => fake.ctx);
    audio.setEnabled(true);
    audio.unlock();
    audio.play({ id: "combat-hit" });
    expect(fake.oscillators.length).toBeGreaterThan(0);
  });
});

describe("tabla de notas del clavicémbalo (DS:0x2746, derivada de DATA.OVL)", () => {
  // Tabla REAL indexada por dígito 0-9 (TOWN 0x0E34 `push [bx+0x2746]`, bx=dígito).
  // Ver re/notes/interactions-piano-fire-audit.md §1.4.
  const REAL_NOTES = [0x1eab, 0x0c2c, 0x0da9, 0x0f56, 0x103f, 0x123c, 0x1478, 0x16fa, 0x1857, 0x1b53];
  it("el cue instrument-note usa la freq real por dígito", () => {
    for (let d = 0; d < 10; d++) {
      const segs = SFX_CATALOG["instrument-note"](d);
      expect(segs[0]?.kind).toBe("tone");
      const seg = segs[0] as Extract<SfxSeg, { kind: "tone" }>;
      expect(seg.f0).toBeCloseTo(incToHz(REAL_NOTES[d]!), 6);
    }
  });
  it("dígitos 1-9 forman una escala ascendente; el 0 es la nota más aguda", () => {
    const f = (d: number) =>
      (SFX_CATALOG["instrument-note"](d)[0] as Extract<SfxSeg, { kind: "tone" }>).f0;
    for (let d = 1; d < 9; d++) expect(f(d + 1)).toBeGreaterThan(f(d));
    expect(f(0)).toBeGreaterThan(f(9));
  });
});

describe("canción del laúd de Iolo (bard-song) — contenido del binario + ritmo Clase C", () => {
  // Tabla de freq REAL del binario (DATA.OVL fo 0x6a44; motor kernel 0x42d2 modo 4). Índice
  // 0 = rest. Ver re/notes/camp-scene-kernel.md §6. La MELODÍA (0x6a58) tiene 53 índices.
  const BARD_FREQ = [0x0000, 0x0da9, 0x0f56, 0x1136, 0x123c, 0x1478, 0x16fa, 0x1857, 0x19ca, 0x1b53];
  const MELODY_LEN = 53;
  const tones = () =>
    renderCue({ id: "bard-song" }).filter((s): s is Extract<SfxSeg, { kind: "tone" }> => s.kind === "tone");

  it("cada nota es un tono de pitch CONSTANTE, no una sirena descendente a 20 Hz", () => {
    // Regresión del bug: el toneSweep genérico leía el paso 0xfff6 como +65526 (no −10) y
    // hundía cada nota a f1=20 Hz (una sirena). La nota fiel es pitch fijo (f0===f1).
    const ts = tones();
    expect(ts.length).toBeGreaterThan(0);
    for (const t of ts) {
      expect(t.f0).toBe(t.f1); // constante
      expect(t.f1).toBeGreaterThan(1000); // jamás recortada al piso de 20 Hz
    }
  });

  it("los pitches = incToHz(freq del binario); refuta la teoría del divisor PIT (171–341 Hz)", () => {
    // freq es el INCREMENTO de fase del acumulador (0x21c4/0x21f1 add dx,[bp+0xc]), NO un
    // divisor del PIT (0x21ac escribe un divisor FIJO 0x3c). Pitch = incToHz(freq), en ~1.4–
    // 2.75 kHz (medido en el testigo CAMP_IOLO_MUSICA.mov: fundamentales 1.5–2.4 kHz), NO los
    // 1193182/divisor = 171–341 Hz que daría la interpretación de divisor.
    const pitches = [...new Set(tones().map((t) => t.f0))].sort((a, b) => a - b);
    expect(pitches[0]).toBeCloseTo(incToHz(BARD_FREQ[1]!), 6); // nota más grave = índice 1
    expect(pitches[0]).toBeGreaterThan(1000); // muy por encima de la banda del divisor (≤341 Hz)
    expect(pitches[pitches.length - 1]).toBeLessThan(3000);
  });

  it("el contorno melódico sube con el índice (idx alto → pitch alto)", () => {
    // Consecuencia de que freq es incremento: pitch monótono creciente en el índice.
    for (let idx = 2; idx <= 9; idx++) {
      expect(incToHz(BARD_FREQ[idx]!)).toBeGreaterThan(incToHz(BARD_FREQ[idx - 1]!));
    }
  });

  it("un rest dura ~1 slot (≈ una nota), no 24× de más", () => {
    // Regresión del bug: el rest reusaba silence(0x7d0) con el factor ×24 de delay_via_timer
    // → 1860 ms, 24× la nota. Un rest y una nota ocupan el MISMO slot temporal (motor 0x42d2:
    // un índice por tick). El slot ~142 ms; el rest jamás supera ~1.5× la nota.
    const segs = renderCue({ id: "bard-song" });
    const restMs = Math.max(...segs.filter((s) => s.kind === "silence").map((s) => s.ms));
    const noteMs = tones()[0]!.ms;
    expect(restMs).toBeLessThan(noteMs * 2); // no el 24× del bug
    expect(restMs).toBeGreaterThan(noteMs * 0.9); // pero sí un slot completo
  });

  it("emite exactamente un segmento-tono por nota (índice ≠ 0) de los que TOCA", () => {
    // ✎ ficha #39: el `.slice(1)` NO es cosmético — la acampada arranca con el cursor
    // sembrado a 1 (CMDS.OVL 0x0183) y sólo da 52 vueltas, así que el índice 0 (que es
    // una NOTA, vale 1) no suena. Antes este aserto fijaba los 53 y por eso el residuo
    // declarado en camp-bard-anim.md §7 sobrevivió en verde. Detalle y cadena del asm
    // en el describe «la ACAMPADA toca los índices 1..52» de abajo.
    const nonRest = [
      1, 4, 4, 0, 0, 1, 5, 5, 0, 0, 4, 9, 6, 9, 7, 4, 6, 5, 1, 4, 0, 0, 0, 1, 5, 0, 0,
      0, 4, 9, 6, 5, 6, 4, 0, 0, 0, 5, 8, 8, 9, 5, 6, 8, 9, 5, 4, 6, 5, 4, 3, 2, 1,
    ]
      .slice(1)
      .filter((i) => i !== 0).length;
    expect(tones().length).toBe(nonRest);
  });

  it("el cue completo cabe en ~7.5 s (la fase visual) — no se derrama al moverse", () => {
    // Total ≈ 52 · ~144 ms ≈ 7.5 s. camp-sleep.ts ata campSongMs = ceil(cueDurationMs) →
    // la fase visual cubre EXACTAMENTE el audio, sin ráfagas en la caminata post-camp.
    // El TOTAL es el ancla Clase C del testigo y NO se movió con la ficha #39: lo que
    // cambió es el reparto (52 slots de ~144 ms en vez de 53 de ~141.5).
    const total = cueDurationMs({ id: "bard-song" });
    expect(total).toBeGreaterThan(7000);
    expect(total).toBeLessThan(8000);
    expect(MELODY_LEN).toBe(53); // la TABLA
    expect(total / CAMP_BARD_INDEX_COUNT).toBeCloseTo(144, 0); // ~144 ms por índice TOCADO
  });
});

/**
 * RESIDUO 2 de la ficha #39 — la ACAMPADA no toca la melodía entera.
 *
 * `camp-bard-anim.md §7` lo declaró («arranca en el índice 1 … se tocan 52 de los 53»)
 * pero NO lo cerró, y el cue seguía tocando los 53. DERIVADO del asm, cadena completa:
 *
 *   CMDS.OVL 0x0183  mov byte ptr [0x6a08], 1     ; cursor de melodía SEMBRADO a 1
 *   CMDS.OVL 0x0188  push 0x34 / call 0x7b66      ; = ULTIMA.EXE 0x3AE6(52)
 *   ULTIMA.EXE 0x3b07 call 0x5910 / 0x3b0e call 0x20fa(1) / 0x3b11 dec si / jnz
 *                                                ; ⇒ EXACTAMENTE 52 redibujos
 *   ULTIMA.EXE 0x42d8 mov al,[bx + 0x6a48]       ; lee melodía[cursor]
 *   ULTIMA.EXE 0x42fe inc byte ptr [0x6a08]      ; …y avanza UNO por redibujo
 *   ULTIMA.EXE 0x4302 cmp [0x6a08],0x35 / jb     ; envuelve a 0 al llegar a 53
 *
 * ⇒ cursor 1,2,…,52 y a la 52ª vuelta `inc` lo deja en 0x35 → 0. Se tocan los índices
 * **1..52** (52 slots); el índice **0 NO suena NUNCA en la acampada**. El índice 0 vale
 * 1 (una NOTA, no un silencio), así que el port metía una nota de más A LA CABEZA.
 *
 * Lo que NO cambia: el TOTAL (~7.5 s) sigue siendo Clase C anclada al testigo
 * (CAMP_IOLO_MUSICA.mov). El asm fija el RECUENTO (52), no los ms; repartir el mismo
 * total entre 52 slots en vez de 53 conserva el ancla y arregla la estructura.
 */
describe("bard-song: la ACAMPADA toca los índices 1..52, no los 53 (ficha #39, residuo 2)", () => {
  const BARD_FREQ = [0x0000, 0x0da9, 0x0f56, 0x1136, 0x123c, 0x1478, 0x16fa, 0x1857, 0x19ca, 0x1b53];
  // La melodía del binario (DATA.OVL fo 0x6a58 = RAM 0x6a48), 53 índices.
  const MELODY = [
    1, 4, 4, 0, 0, 1, 5, 5, 0, 0, 4, 9, 6, 9, 7, 4, 6, 5, 1, 4, 0, 0, 0, 1, 5, 0, 0,
    0, 4, 9, 6, 5, 6, 4, 0, 0, 0, 5, 8, 8, 9, 5, 6, 8, 9, 5, 4, 6, 5, 4, 3, 2, 1,
  ];
  const tones = () =>
    renderCue({ id: "bard-song" }).filter(
      (s): s is Extract<SfxSeg, { kind: "tone" }> => s.kind === "tone",
    );

  it("★ la PRIMERA nota es la del índice 1 (=4), no la del índice 0 (=1)", () => {
    // EL DISCRIMINANTE. Es la única aserción que separa «52 slots» de «53 slots» por el
    // CONTENIDO y no por el recuento: con el cursor sembrado a 1 el primer sonido del
    // original es melodía[1]=4; el port arrancaba en melodía[0]=1, un semitono-índice
    // por debajo. Un cambio que sólo recortase la COLA pasaría el test de recuento y
    // moriría aquí.
    expect(MELODY[0]).toBe(1); // el índice que el original SE SALTA…
    expect(MELODY[1]).toBe(4); // …y el que suena primero
    expect(tones()[0]!.f0).toBeCloseTo(incToHz(BARD_FREQ[4]!), 6);
  });

  it("★ toca 52 slots — uno por redibujo de 0x3AE6(52)", () => {
    expect(CAMP_BARD_INDEX_COUNT).toBe(52);
    expect(MELODY.length).toBe(53); // la TABLA tiene 53; la acampada recorre 52
    // Slots = notas + silencios de slot completo. El total dividido por el paso de
    // índice da el recuento sin depender de cómo se segmenten notas y huecos.
    const total = cueDurationMs({ id: "bard-song" });
    expect(total / CAMP_BARD_STEP_MS).toBeCloseTo(52, 6);
  });

  it("★ 39 tonos: los no-cero de 1..52 (uno menos que los 40 de 0..52)", () => {
    // Las cifras son CONTADAS sobre la tabla, no heredadas: 13 rests (índice 0) y 40
    // notas en los 53; el índice 0 vale 1 (nota), así que 1..52 deja 39 notas y los
    // MISMOS 13 rests. El slot que se cae es una NOTA, no un silencio.
    const played = MELODY.slice(1); // índices 1..52
    expect(played.length).toBe(52);
    expect(played.filter((i) => i === 0).length).toBe(13); // los rests no cambian
    expect(played.filter((i) => i !== 0).length).toBe(39);
    expect(MELODY.filter((i) => i !== 0).length).toBe(40); // lo que tocaba ANTES
    expect(tones().length).toBe(39);
  });

  it("el TOTAL sigue anclado al testigo (~7.5 s): sólo cambia el reparto, no la duración", () => {
    // El ancla Clase C (testigo CAMP_IOLO_MUSICA.mov, 6.5–14 s) NO se toca: los mismos
    // 7500 ms se reparten entre 52 slots ⇒ ~144.2 ms/índice en vez de ~141.5.
    const total = cueDurationMs({ id: "bard-song" });
    expect(total).toBeGreaterThan(7000);
    expect(total).toBeLessThan(8000);
    expect(CAMP_BARD_STEP_MS).toBeCloseTo(7500 / 52, 6);
  });
});
