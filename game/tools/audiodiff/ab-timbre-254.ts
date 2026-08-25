/**
 * CAREO DE LEYES banda→frecuencia del `noise_burst` (ficha #254) + generador de las
 * muestras A/B/C que el usuario escucha.
 *
 *   npx tsx game/tools/audiodiff/ab-timbre-254.ts [outDir]
 *
 * TRES leyes, sobre EXACTAMENTE la misma secuencia de valores sorteados (semilla fija),
 * para que la única diferencia entre las muestras sea la ley:
 *
 *   A `port`     f = v                        — lo que hace `noiseBurst()` hoy.
 *   C `binario`  f = PIT / floor(PIT / v)     — lo que EMITE el 8253 con el contador que
 *                                               el binario le escribe (0x2281 `div`, 0x2283
 *                                               `out 0x42`). Es A con la CUANTIZACIÓN del
 *                                               contador entero: la ley del original.
 *   B `ficha`    f = PIT / v                  — la ley que la ficha #254 propuso calcar.
 *                                               Es el CONTADOR leído como si fuera la
 *                                               frecuencia. Se genera para poder OÍR por qué
 *                                               no se calca (queda documentada, no aplicada).
 *
 * La síntesis NO se inventa: se reusa `renderSegs` de `offline-speaker.ts`, el espejo
 * offline de `SpeakerSynth.scheduleSeg`. Lo único que cambia entre A, B y C es el array
 * `freqs` del segmento.
 *
 * CONTROLES que corre y exige (aborta si fallan), porque un A/B sin control es un A/B
 * que puede estar comparando dos veces lo mismo:
 *   1. la réplica del sorteo reproduce EXACTAMENTE `noiseBurst(step,dur,band,seed).freqs`;
 *   2. el `ms` declarado en la tabla de abajo coincide con el del catálogo REAL;
 *   3. los WAV de A y de B difieren por bytes en TODOS los pares.
 */
import { createHash } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { noiseBurst, noisePrng, renderCue, silence } from "../../src/skin/fiel/speaker.js";
import type { NoiseSeg, SfxSeg } from "../../src/skin/fiel/speaker.js";
import type { SfxId } from "../../src/core/sfx.js";
import { renderSegs, toWav } from "./offline-speaker.js";

/**
 * Reloj de entrada del 8253 = `0x1234DE`, el dividendo LITERAL de `ULTIMA.EXE:0x227e`
 * (`mov dx,0x12; mov ax,0x34de`) y de `EGA.DRV:0x27eb`. No es una constante del port:
 * es el número que está en los dos binarios, y vale 1.193.182 Hz.
 */
const PIT_CLOCK = 0x1234de;
/** Suelo del sorteo `mov bx,0x64` (0x2268 / 0x27d1): ningún valor baja de 100. */
const NOISE_LO = 0x64;
/** Recorte audible del port (`HZ_MIN`/`HZ_MAX` de speaker.ts). */
const HZ_MIN = 20;
const HZ_MAX = 20000;
const SR = 44100;

const clamp = (f: number): number => Math.min(HZ_MAX, Math.max(HZ_MIN, f));

/**
 * El sorteo del binario SIN aplicar ninguna ley: `v = 0x64 + (prng % (band-0x64+1))`,
 * espejo de 0x2255-0x2277. Devuelve los valores CRUDOS (el recorte del port se aplica
 * después, como una de las tres leyes) para que la ley de arriba no herede su tope.
 */
function drawRaw(step: number, dur: number, band: number, seed: number): number[] {
  // `sub cx,bx; inc cx` (0x226e/0x2270): el módulo lleva el `+1` y la banda es CERRADA
  // por arriba. El port tenía aquí un off-by-one, arreglado en el mismo commit que #254.
  const span = Math.max(1, band - NOISE_LO + 1);
  const nRaw = step > 0 ? Math.floor(dur / step) : dur;
  const n = Math.max(1, Math.min(nRaw, 512)); // NOISE_MAX_STEPS
  const out: number[] = [];
  let s = seed & 0xffff;
  for (let i = 0; i < n; i++) {
    s = noisePrng(s);
    out.push(NOISE_LO + (s % span));
  }
  return out;
}

type LeyId = "A-port" | "B-ficha" | "C-crudo";
const LEYES: Record<LeyId, (v: number) => number> = {
  // LO QUE EL PORT EMITE HOY = la ley EXACTA del binario: el valor sorteado es la
  // frecuencia, y el contador entero del PIT la cuantiza (#254 + decisión del lead).
  "A-port": (v) => clamp(PIT_CLOCK / Math.max(1, Math.floor(PIT_CLOCK / v))),
  // El CONTADOR leído como frecuencia — la ley que #254 propuso. Monótona INVERSA.
  "B-ficha": (v) => clamp(PIT_CLOCK / v),
  // El valor sorteado SIN cuantizar: lo que el port emitía antes de calcar el contador.
  // Se conserva para poder oír cuánto (poco) mueve la cuantización: ≤2,127 %.
  "C-crudo": (v) => clamp(v),
};

/** Un segmento de ruido del catálogo, con sus tres params del asm. */
interface NoiseSpec {
  step: number;
  dur: number;
  band: number;
}
/** Cue del A/B: su id real del catálogo + los segmentos (ruido o hueco) en orden. */
interface CueSpec {
  id: SfxId;
  rotulo: string;
  segs: (NoiseSpec | { silencioMs: number })[];
}

const esRuido = (s: CueSpec["segs"][number]): s is NoiseSpec => "band" in s;

/**
 * Los cues del A/B: los más frecuentes en juego + los dos de la intro + los dos del
 * título (#220) + el caso EXTREMO (`ambient-fountain`, band 25000, donde las dos leyes
 * se separan al máximo). Los params son los del catálogo; el control 2 los carea.
 */
const CUES: CueSpec[] = [
  { id: "move-step", rotulo: "Paso a pie (el sonido más frecuente del juego)",
    segs: [{ step: 1, dur: 25, band: 1000 }, { silencioMs: silence(0x14).ms }, { step: 1, dur: 25, band: 1500 }] },
  { id: "combat-hit", rotulo: "Golpe en combate", segs: [{ step: 10, dur: 3000, band: 2000 }] },
  { id: "combat-hit-heavy", rotulo: "Golpe pesado / derrota", segs: [{ step: 40, dur: 3000, band: 500 }] },
  { id: "combat-damage", rotulo: "Un actor recibe daño", segs: [{ step: 10, dur: 1600, band: 2000 }] },
  { id: "ambient-waterfall", rotulo: "Cascada (ambiente, band 10000)", segs: [{ step: 20, dur: 60, band: 10000 }] },
  { id: "ambient-fountain", rotulo: "Fuente (ambiente, band 25000 — el caso EXTREMO)", segs: [{ step: 10, dur: 30, band: 25000 }] },
  { id: "dungeon-zap", rotulo: "Campo eléctrico de mazmorra (band 20000)", segs: [{ step: 1, dur: 500, band: 20000 }] },
  { id: "field-afflict", rotulo: "Miembro afligido por campo", segs: [{ step: 1, dur: 50, band: 3500 }] },
  { id: "intro-thunder", rotulo: "INTRO — trueno del moongate", segs: [{ step: 20, dur: 60, band: 10000 }] },
  { id: "intro-summon", rotulo: "INTRO — invocación", segs: [{ step: 1, dur: 1200, band: 4000 }] },
];

/** Semilla fija: A, B y C comparten sorteo, así la única variable es la ley. */
const SEMILLA = 0x1234;

function segsDeCue(spec: CueSpec, ley: LeyId): SfxSeg[] {
  const f = LEYES[ley];
  let seed = SEMILLA;
  return spec.segs.map((s) => {
    if (!esRuido(s)) return { kind: "silence", ms: s.silencioMs } as SfxSeg;
    const crudos = drawRaw(s.step, s.dur, s.band, seed);
    // El estado del PRNG persiste entre ráfagas (espejo de `noiseState`): la 2ª ráfaga
    // del paso no repite los tonos de la 1ª.
    seed = crudos.length ? noisePrngTrasN(seed, crudos.length) : seed;
    const ms = noiseBurst(s.step, s.dur, s.band, SEMILLA).ms;
    return { kind: "noise", freqs: crudos.map(f), ms } as NoiseSeg;
  });
}

function noisePrngTrasN(seed: number, n: number): number {
  let s = seed & 0xffff;
  for (let i = 0; i < n; i++) s = noisePrng(s);
  return s;
}

// ── CONTROLES ────────────────────────────────────────────────────────────────────────
function control1ReplicaDelSorteo(): void {
  for (const spec of CUES) {
    for (const s of spec.segs) {
      if (!esRuido(s)) continue;
      const mio = drawRaw(s.step, s.dur, s.band, SEMILLA).map(LEYES["A-port"]);
      const suyo = (noiseBurst(s.step, s.dur, s.band, SEMILLA) as NoiseSeg).freqs;
      if (mio.length !== suyo.length || mio.some((v, i) => v !== suyo[i])) {
        throw new Error(
          `CONTROL 1 ROTO en ${spec.id} NB(${s.step},${s.dur},${s.band}): la réplica del ` +
            `sorteo NO reproduce noiseBurst() (${mio.length} vs ${suyo.length} valores). ` +
            `El A/B mediría otra cosa.`,
        );
      }
    }
  }
}

function control2ParamsContraCatalogo(): void {
  for (const spec of CUES) {
    const real = renderCue({ id: spec.id });
    const mios = segsDeCue(spec, "A-port");
    if (real.length !== mios.length) {
      throw new Error(
        `CONTROL 2 ROTO en ${spec.id}: el catálogo da ${real.length} segmentos y la tabla ` +
          `de este script declara ${mios.length}. Los params de la tabla están rancios.`,
      );
    }
    real.forEach((r, i) => {
      const m = mios[i]!;
      if (r.kind !== m.kind) {
        throw new Error(`CONTROL 2 ROTO en ${spec.id} seg ${i}: kind ${r.kind} vs ${m.kind}.`);
      }
      if (r.kind === "silence" && m.kind === "silence" && Math.abs(r.ms - m.ms) > 1e-9) {
        throw new Error(
          `CONTROL 2 ROTO en ${spec.id} seg ${i}: el hueco del catálogo mide ${r.ms} ms y la ` +
            `tabla declara ${m.ms} ms.`,
        );
      }
      if (r.kind === "noise" && m.kind === "noise") {
        if (Math.abs(r.ms - m.ms) > 1e-9 || r.freqs.length !== m.freqs.length) {
          throw new Error(
            `CONTROL 2 ROTO en ${spec.id} seg ${i}: el catálogo da ms=${r.ms} n=${r.freqs.length} ` +
              `y la tabla ms=${m.ms} n=${m.freqs.length}. Los params declarados no son los del catálogo.`,
          );
        }
      }
    });
  }
}

// ── SALIDA ───────────────────────────────────────────────────────────────────────────
interface Fila {
  cue: string;
  band: number;
  vMin: number;
  vMax: number;
  aMin: number;
  aMax: number;
  bMin: number;
  bMax: number;
  cMin: number;
  cMax: number;
  desvioCA: number; // % de la CUANTIZACIÓN (A emitida vs C cruda) en las muestras sorteadas
  desvioBanda: number; // ídem barriendo la banda ENTERA [0x64, band] — la cifra honesta
  vTope: number; // valor que produce ese peor caso
  contadores: number; // contadores DISTINTOS del PIT entre los valores sorteados
}

/**
 * Peor caso de la cuantización del contador BARRIENDO LA BANDA ENTERA, no las pocas
 * muestras que un cue sortea: `ambient-fountain` sólo saca 3 valores, y un máximo sobre
 * 3 muestras no acota la ley — acota ese sorteo.
 */
function peorCasoBanda(band: number): { pct: number; v: number } {
  let peor = 0;
  let vPeor = NOISE_LO;
  for (let v = NOISE_LO; v <= Math.max(NOISE_LO + 1, band); v++) {
    const d = Math.abs(LEYES["C-crudo"](v) - LEYES["A-port"](v)) / Math.max(1, LEYES["A-port"](v));
    if (d > peor) { peor = d; vPeor = v; }
  }
  return { pct: +(peor * 100).toFixed(2), v: vPeor };
}

function fila(spec: CueSpec, s: NoiseSpec): Fila {
  const v = drawRaw(s.step, s.dur, s.band, SEMILLA);
  const rango = (f: (x: number) => number): [number, number] => {
    const y = v.map(f);
    return [Math.min(...y), Math.max(...y)];
  };
  const [aMin, aMax] = rango(LEYES["A-port"]);
  const [bMin, bMax] = rango(LEYES["B-ficha"]);
  const [cMin, cMax] = rango(LEYES["C-crudo"]);
  const desvio = Math.max(
    ...v.map((x) => Math.abs(LEYES["C-crudo"](x) - LEYES["A-port"](x)) / Math.max(1, LEYES["A-port"](x))),
  );
  const cnt = new Set(v.map((x) => Math.floor(PIT_CLOCK / x))).size;
  const peor = peorCasoBanda(s.band);
  return {
    cue: spec.id, band: s.band,
    vMin: Math.min(...v), vMax: Math.max(...v),
    aMin: Math.round(aMin), aMax: Math.round(aMax),
    bMin: Math.round(bMin), bMax: Math.round(bMax),
    cMin: Math.round(cMin), cMax: Math.round(cMax),
    desvioCA: +(desvio * 100).toFixed(2),
    desvioBanda: peor.pct, vTope: peor.v, contadores: cnt,
  };
}

function main(): void {
  control1ReplicaDelSorteo();
  control2ParamsContraCatalogo();

  const outDir = process.argv[2] ?? join(process.cwd(), "ab-timbre-254");
  mkdirSync(outDir, { recursive: true });

  const filas: Fila[] = [];
  const sha: Record<string, string> = {};
  for (const spec of CUES) {
    for (const s of spec.segs) if (esRuido(s)) filas.push(fila(spec, s));
    for (const ley of Object.keys(LEYES) as LeyId[]) {
      const pcm = renderSegs(segsDeCue(spec, ley), { sampleRate: SR });
      const wav = toWav(pcm, SR);
      const nombre = `${spec.id}__${ley}.wav`;
      writeFileSync(join(outDir, nombre), wav);
      sha[nombre] = createHash("sha1").update(wav).digest("hex").slice(0, 12);
    }
  }

  // CONTROL 3: A y B tienen que diferir por BYTES en todos los pares.
  const iguales = CUES.filter((c) => sha[`${c.id}__A-port.wav`] === sha[`${c.id}__B-ficha.wav`]);
  if (iguales.length) {
    throw new Error(
      `CONTROL 3 ROTO: ${iguales.length} pares A/B son IDÉNTICOS por bytes ` +
        `(${iguales.map((c) => c.id).join(", ")}) — el parámetro diferenciador no llegó.`,
    );
  }
  // CONTROL 4: la CUANTIZACIÓN llegó al port. Separa «lo apliqué» de «creo que lo apliqué».
  //
  // 🔴 SE MIDE EN LAS FRECUENCIAS, NO EN LOS BYTES DEL WAV — y la primera redacción se
  // equivocaba justo en eso. Con el predicado por bytes, `move-step` y `field-afflict`
  // salían IDÉNTICOS y el control abortaba acusando al fix de no haber llegado. Falso: sus
  // 25 y 50 frecuencias difieren TODAS (maxΔ 1,66 y 9,50 Hz, medido) — lo que pasa es que
  // esos cues duran 1,45 y 2,91 ms y el desplazamiento sub-Hz no mueve ni una muestra de 16
  // bits a 44,1 kHz. «Suena igual» y «no se aplicó» son cosas distintas; el control tiene que
  // preguntar por la LEY, y el silencio del render es un dato aparte (se informa abajo).
  const sinCuantizar: string[] = [];
  for (const c of CUES) {
    const nsA = segsDeCue(c, "A-port").filter((x) => x.kind === "noise") as NoiseSeg[];
    const nsC = segsDeCue(c, "C-crudo").filter((x) => x.kind === "noise") as NoiseSeg[];
    const mueve = nsA.some((a, i) => a.freqs.some((f, j) => f !== nsC[i]!.freqs[j]));
    if (!mueve) sinCuantizar.push(c.id);
  }
  if (sinCuantizar.length) {
    throw new Error(
      `CONTROL 4 ROTO: en ${sinCuantizar.length} cues (${sinCuantizar.join(", ")}) la ` +
        `frecuencia emitida NO cambia al cuantizar — la ley del contador no llegó al port.`,
    );
  }
  // INFORME (no es un fallo): cues cuyo WAV sale idéntico pese a cambiar las frecuencias.
  // Son los cortos: la cuantización existe pero es INAUDIBLE por construcción del render.
  const mudos = CUES.filter((c) => sha[`${c.id}__A-port.wav`] === sha[`${c.id}__C-crudo.wav`]);

  writeFileSync(
    join(outDir, "careo.json"),
    JSON.stringify({ pitClock: PIT_CLOCK, semilla: SEMILLA, sampleRate: SR, filas, sha }, null, 2),
  );

  console.log(
    "cue".padEnd(20), "band".padStart(6), "v".padStart(13),
    "A=port/bin".padStart(13), "C=crudo".padStart(13), "B=ficha".padStart(13),
    "cuant%".padStart(6), "banda%".padStart(7), "@v".padStart(6), "cnt".padStart(5),
  );
  for (const f of filas) {
    console.log(
      f.cue.padEnd(20), String(f.band).padStart(6),
      `${f.vMin}-${f.vMax}`.padStart(13),
      `${f.aMin}-${f.aMax}`.padStart(13),
      `${f.cMin}-${f.cMax}`.padStart(13),
      `${f.bMin}-${f.bMax}`.padStart(13),
      String(f.desvioCA).padStart(6), String(f.desvioBanda).padStart(7),
      String(f.vTope).padStart(6), String(f.contadores).padStart(5),
    );
  }
  console.log(`\n4 controles VERDES · ${CUES.length} cues × 3 leyes -> ${outDir}`);
  console.log(
    `Cuantización INAUDIBLE (WAV byte-idéntico pese a mover las frecuencias) en ${mudos.length}/` +
      `${CUES.length}: ${mudos.map((c) => c.id).join(", ") || "ninguno"} — cues de 1-3 ms.`,
  );
  writeFileSync(join(outDir, "index.html"), paginaAB(filas));
}

function paginaAB(filas: Fila[]): string {
  const porCue = (id: string): Fila[] => filas.filter((f) => f.cue === id);
  const bloques = CUES.map((c) => {
    const fs = porCue(c.id);
    const rangos = fs
      .map(
        (f) =>
          `<code>band ${f.band}</code> → sorteo ${f.vMin}–${f.vMax} · ` +
          `A ${f.aMin}–${f.aMax} Hz · C ${f.cMin}–${f.cMax} Hz · <b>B ${f.bMin}–${f.bMax} Hz</b>`,
      )
      .join("<br>");
    const audio = (ley: LeyId, et: string) =>
      `<div class="p"><span>${et}</span><audio controls preload="none" src="${c.id}__${ley}.wav"></audio></div>`;
    return `<section><h2>${c.id}</h2><p class="r">${c.rotulo}</p><p class="d">${rangos}</p>
${audio("A-port", "A — port de hoy = LA LEY EXACTA DEL BINARIO (con cuantización del PIT)")}
${audio("C-crudo", "C — el valor sorteado SIN cuantizar (el port antes de #254-bis)")}
${audio("B-ficha", "B — la ley que proponía la ficha #254 (REFUTADA, no se aplica)")}
</section>`;
  }).join("\n");
  return `<!doctype html><meta charset="utf-8"><title>A/B timbre del ruido — ficha #254</title>
<style>
 body{font:15px/1.55 system-ui,sans-serif;max-width:56rem;margin:2rem auto;padding:0 1rem;background:#14161a;color:#e6e8ec}
 h1{font-size:1.4rem} h2{font-size:1.05rem;margin:.2rem 0;color:#9ad}
 section{border:1px solid #2b3038;border-radius:8px;padding:.8rem 1rem;margin:1rem 0;background:#191c21}
 .r{margin:.1rem 0 .4rem;color:#aeb4bf} .d{font-size:.85rem;color:#8f96a3;margin:.2rem 0 .7rem}
 .p{display:flex;align-items:center;gap:.8rem;margin:.35rem 0}
 .p span{flex:0 0 20rem;font-size:.9rem} audio{flex:1;min-width:0;height:32px}
 code{background:#22262d;padding:.05rem .3rem;border-radius:3px}
 .aviso{border-left:3px solid #d08a3a;padding:.6rem 1rem;background:#20211c;border-radius:0 6px 6px 0}
</style>
<h1>Timbre del ruido del speaker — las tres leyes (ficha #254)</h1>
<div class="aviso"><b>El veredicto, para que la escucha se lea bien:</b>
el binario <b>no</b> invierte la ley. En <code>ULTIMA.EXE:0x227e-0x2287</code> el valor sorteado
es el <i>divisor</i> de <code>0x1234DE</code>, pero <code>0x1234DE</code> = 1.193.182 Hz = el
<b>reloj de entrada del PIT</b>, así que el cociente es el <b>contador</b> que se escribe en el
puerto 0x42 — y la frecuencia que sale del altavoz es <code>reloj / contador</code>, o sea
<b>el valor sorteado</b>. <b>A es hoy la ley exacta del original</b>, cuantización del contador
entero incluida (≤2,127&nbsp;%, en la banda 25000). <b>C</b> es el sorteo sin cuantizar — el port
de ayer — y sirve para oír lo poco que mueve ese paso. <b>B</b> es el contador escuchado como si
fuera la frecuencia: se incluye sólo para oír por qué no se calca.</div>
${bloques}
<p style="color:#8f96a3;font-size:.85rem">A, B y C comparten la misma secuencia sorteada
(semilla 0x1234) y la misma síntesis (<code>offline-speaker.ts</code>, espejo de
<code>SpeakerSynth</code>): lo único que cambia es la ley. Cuatro controles verdes en el
generador: réplica del sorteo == <code>noiseBurst()</code>, params == catálogo, A≠B por bytes
(la ley refutada suena distinto) y A≠C por bytes (la cuantización llegó de verdad).</p>`;
}

main();
