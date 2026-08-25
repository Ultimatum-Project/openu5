/**
 * EL PC-SPEAKER FIEL (task #3) — el "modo 1988" de la piel fiel en Web Audio.
 *
 * EMULA el mecanismo real del speaker de ULTIMA V (no reproduce samples): el
 * altavoz es un gate conmutado por software; el "pitch" es la TASA de conmutación
 * de una onda CUADRADA (`drivers-drv.md`, `kernel-sweep-2/3.md`). Aquí se genera
 * con un `OscillatorNode` de tipo `"square"` — sin ningún sample pregrabado.
 *
 * Dos capas:
 *   1. PURA (testeable sin AudioContext): las 6 primitivas del catálogo
 *      (`tone_sweep`, `noise_burst`, `beep`, `glide`, `set_tone`, `stop`) como
 *      funciones paramétricas que producen una lista de SEGMENTOS `SfxSeg`
 *      (frecuencia(es) + duración). El catálogo `SFX_CATALOG` mapea cada acción
 *      lógica (`SfxId`) a su secuencia de segmentos con los params EXACTOS del
 *      asm (`re/notes/sfx-catalog.md §6`).
 *   2. AUDIO: `SpeakerSynth` agenda esos segmentos en un `AudioContext`, y
 *      `SpeakerAudio` añade el ciclo de vida (contexto perezoso por gesto de
 *      usuario, toggle persistente). El core NUNCA ve nada de esto.
 *
 * CALIBRACIÓN — DERIVADA del disasm + anclada con el ORÁCULO (task #56, ya no →AV).
 * Las 4 primitivas comparten UN bucle de retardo (`dec [mem]; jne`) cuyo nº de
 * iteraciones = paramCount · innerCount, con innerCount fijado por el reloj
 * calibrado `C=[0x5356]` (0x21a6/0x228c/0x20c8):
 *   · tone_sweep : inner = floor(C/24)   (div 0x18 en 0x21a6)
 *   · noise_burst: inner = C >> 4        (shr 4 en 0x228c) = C/16
 *   · beep/glide : inner = C >> shiftTbl[1] = C >> 0 = C   (delay(·,1), tabla[1]=0)
 * La duración = iteraciones · t_dec, y como `C·t_dec` es MÁQUINA-INDEPENDIENTE por
 * diseño (0x1158 calibra C inversamente a la CPU), definimos UNA constante ancla:
 *   `DELAY_UNIT_MS` = C·t_dec = ms por unidad de `delay` con inner=C.
 * MEDIDA con las CAPTURAS REALES del original (task #72, DOSBox-X): la cascada
 * `ultima_001.wav` da burst NB(20,60,10000) = 3.46 ms sobre 115 muestras ⇒
 * DELAY_UNIT_MS = 0.93 ms (antes 1.10 del oráculo, ±13 %; ver DELAY_UNIT_MS abajo).
 * De aquí salen todas las duraciones y `SPEAKER_SAMPLE_RATE_HZ` (la tasa del
 * bit-bang del sweep = 24000/U). El PITCH:
 *   · sweep : (inc/65536) · SR   [Hz]  (PWM: dx += inc, envuelve cada 65536)
 *   · beep/glide/set_tone: el PIT SÍ fija el tono → Hz EXACTOS (= arg, 0x22e2
 *     `div 0x1234DE / arg` ⇒ freq de salida = arg). NO son →AV.
 */
import type { SfxCue, SfxId } from "../../core/sfx.js";
// Constantes DERIVADAS del driver de vídeo para los dos cues del título (#220). Viven en
// `introAnim.ts` (módulo puro, sin DOM) para que la guarda las lea sin montar el intro.
import {
  SUBTITLE_CRACKLE_BAND,
  SUBTITLE_CRACKLE_DUR,
  TITLE_FIZZLE_BAND0,
  TITLE_FIZZLE_BURSTS_PER_CUE,
} from "./introAnim.js";

/**
 * ANCLA de calibración: `C·t_dec` [ms] = duración de 1 unidad de `delay` con el
 * bucle interno completo (inner=C). Máquina-independiente por diseño (0x1158). De
 * aquí sale TODO (duraciones y `SPEAKER_SAMPLE_RATE_HZ`).
 *
 * REFINADO a 0.93 ms con las CAPTURAS REALES del original (task #72, DOSBox-X;
 * antes 1.10 ms del oráculo con ±13 %). Dos anclas independientes convergen:
 *   · la cascada `ultima_001.wav`: burst NB(20,60,10000) mide **3.46 ms** de mediana
 *     sobre 115 bursts ⇒ dur·(C>>4)·t_dec = 60·81·t_dec = 3.46 ms ⇒ t_dec=0.711 µs,
 *     U = C·t_dec = 1308·0.711 µs = **0.93 ms**.
 *   · el PASO `ultima_000.wav`: el hueco entre los dos clics (delay(0x14,1) =
 *     20·C·t_dec) mide 16.8–18.7 ms, consistente con U≈0.84–0.93 (bracket).
 * Se ancla en la cascada (115 muestras, mejor SNR). Consecuencia DERIVADA (misma
 * t_dec, sin grado de libertad): `SR_sweep = 24000/U` sube 21818→25806 Hz, así que
 * los sweeps suben ~18 % de pitch — verificable cuando el usuario capture un sweep
 * (moongate/cast). Ver re/notes/audio-diff-calibration.md §7.
 */
export const DELAY_UNIT_MS = 0.93;
/**
 * Tasa efectiva del bit-bang del SWEEP (inner=floor(C/24)) = 24000/U. Fija el
 * pitch del sweep y ES la base de `samplesToMs`. Con U=0.93 (WAV real, task #72)
 * = 25806 Hz (era 21818 con U=1.10 del oráculo).
 */
export const SPEAKER_SAMPLE_RATE_HZ = 24000 / DELAY_UNIT_MS;

/** Módulo del acumulador de fase `dx` del generador PWM (16 bits). */
const PHASE_MODULO = 0x10000;
/** Rango audible al que se recorta todo pitch generado. */
const HZ_MIN = 20;
const HZ_MAX = 20000;

/**
 * Un tono de `ms` milisegundos. Si lleva `steps`, es la ESCALERA real de un glide 0x43ae:
 * un escalón por vuelta del bucle (cada uno = un `set_tone` 0x22e2 que reescribe el divisor
 * del PIT), equiespaciados en el tiempo (`delay(1, paso)` constante), en UN solo oscilador
 * (el gate del speaker no se cierra entre vueltas). Sin `steps`, `f0`→`f1` interpola
 * linealmente (glissando continuo, p. ej. tonos fijos con `f0 === f1`).
 */
export interface ToneSeg {
  kind: "tone";
  f0: number;
  f1: number;
  ms: number;
  steps?: number[];
}
/** Un burst de ruido: secuencia rápida de frecuencias (del PRNG local) en `ms`. */
export interface NoiseSeg {
  kind: "noise";
  freqs: number[];
  ms: number;
}
/** Un HUECO de silencio de `ms` (gate cerrado): el `delay_via_timer` entre bursts. */
export interface SilenceSeg {
  kind: "silence";
  ms: number;
}
export type SfxSeg = ToneSeg | NoiseSeg | SilenceSeg;

function clampHz(f: number): number {
  return Math.min(HZ_MAX, Math.max(HZ_MIN, f));
}

/** `count` como entero sin signo de 16 bits (algunos call-sites empujan negativos). */
function u16(count: number): number {
  return count < 0 ? count + PHASE_MODULO : count;
}

/** pitch(inc) = (inc/65536)·SR — la tasa de conmutación del gate (ver cabecera). */
export function incToHz(inc: number): number {
  return clampHz((u16(inc) / PHASE_MODULO) * SPEAKER_SAMPLE_RATE_HZ);
}

/** duración de `count` muestras con multiplicador `delay` (ver cabecera). */
export function samplesToMs(count: number, delay: number): number {
  return (u16(count) * Math.max(1, delay) * 1000) / SPEAKER_SAMPLE_RATE_HZ;
}

/**
 * `pcspeaker_tone_sweep` (0x2192) — PITCH CONSTANTE = `incToHz(inc)`.
 *
 * El primitivo es un PWM por software: `dx += inc` por iteración (envuelve mod 65536),
 * gate ON cuando `dx > bx` (0x21f8 `cmp dx,bx; ja`). El FUNDAMENTAL audible = tasa a la
 * que `dx` envuelve = `inc/65536 · SR` — CONSTANTE, NO depende de `bx`. El umbral `bx`
 * (arranca en `start`, +`step` por iteración) sólo modula el DUTY CYCLE = timbre, NO el
 * pitch (→AV, no modelado; el `OscillatorNode "square"` es duty fijo 50%).
 *
 * REFUTA el modelo viejo (§1.1: "step<0 sube, step>0 baja", rampa f0→f1 por start/bxEnd):
 * era una interpretación errónea, refutada por el ESPECTRO de dos testigos —
 *   · moongate (video-K-moongate.mov): ~2000 Hz CONSTANTE mientras bx barre 2000→62000
 *     (el viejo modelo la hundía a 75 Hz: un "whoosh" descendente que el usuario oyó mal).
 *   · clavicémbalo (HARPSI_SANDALWOOD_QUAKE.mov): cada nota es pitch ESTABLE (3562/3962/
 *     4202/2361 Hz sostenidos), no el chirp ascendente ×5 que daba el viejo `f1=f0·5`.
 * `start`/`step` se conservan en la firma (son los args ASM y documentan el sweep de duty),
 * pero NO entran en el pitch. Los saltos a 2º armónico en el arranque/cola de cada tono del
 * testigo son precisamente ese cambio de duty — consistente con pitch fijo.
 */
export function toneSweep(
  inc: number,
  delay: number,
  count: number,
  start: number,
  step: number,
): ToneSeg {
  void start;
  void step; // el sweep de bx es DUTY (timbre →AV), no pitch — ver cabecera
  const n = u16(count);
  const f = incToHz(inc);
  return { kind: "tone", f0: f, f1: f, ms: samplesToMs(n, delay) };
}

/**
 * FACTORES de duración por primitiva RELATIVOS al bucle del sweep (la base de
 * `samplesToMs`, cuyo inner = floor(C/24)). Cada factor = inner_de_la_primitiva /
 * inner_del_sweep, así reusamos `samplesToMs` sin más constantes libres:
 *   · beep/glide: inner=C  → factor = C/(C/24) = 24
 *   · noise:      inner=C/16 → factor = (C/16)/(C/24) = 24/16 = 1.5
 * (Antes: 256 y 64 nominales `→AV`; medían 11.6× y 2.9× de MÁS. Ahora derivados.)
 */
const SWEEP_INNER_DIV = 24; // floor(C/24), 0x21a6 `div 0x18`
const NOISE_INNER_SHIFT = 4; // C>>4, 0x228c `shr 4`
const BEEP_FACTOR = SWEEP_INNER_DIV; // beep/glide: inner=C
const GLIDE_FACTOR = SWEEP_INNER_DIV;
const NOISE_FACTOR = SWEEP_INNER_DIV / (1 << NOISE_INNER_SHIFT); // 24/16 = 1.5

/**
 * `delay_via_timer` (0x20c8) AISLADO como hueco de silencio (gate cerrado). El nº
 * de decrementos = count · (C>>shiftTbl[shiftidx]); con shiftidx=1 (tabla[1]=0)
 * inner=C, igual que beep/glide → factor 24. Lo usa el hueco entre los 2 bursts
 * del PASO (0x4355 `delay(0x14,1)`).
 */
export function silence(count: number, shiftidx: 1 = 1): SilenceSeg {
  void shiftidx; // sólo se usa shiftidx=1 en el catálogo (inner=C); documentado por completitud
  return { kind: "silence", ms: samplesToMs(count * BEEP_FACTOR, 1) };
}

/** `pcspeaker_beep` (0x22c0): tono FIJO de pitch directo (`freq` ya en Hz) y `dur` ticks. */
export function beep(freq: number, dur: number): ToneSeg {
  const f = clampHz(freq);
  return { kind: "tone", f0: f, f1: f, ms: samplesToMs(dur * BEEP_FACTOR, 1) };
}

/**
 * `pcspeaker_glide` (0x43ae) — la ESCALERA real del binario, no una rampa limpia (#137).
 *
 * El cuerpo (ULTIMA.EXE.asm:7424-7459, span 0x43ae-0x43ff):
 *   · `inc = trunc16(((endFreq − startFreq) · step) / total)` — el `imul` (0x43c2) deja el
 *     producto en dx:ax pero 0x43c5 GUARDA SÓLO ax y 0x43cb `cwd` re-deriva el signo del
 *     low word (la parte alta se descarta); el `idiv` (0x43cc) trunca hacia CERO.
 *   · bucle `mientras di < total { set_tone(si); delay(1, step); si += inc; di += step }`
 *     (0x43d8-0x43ef) con corte `jl` FIRMADO (0x43ef) — total ≤ 0 ⇒ NI UNA vuelta
 *     (el sitio dinámico de DUNGEON.OVL 0x1483 empuja `20 − 8n`: mudo con n ≥ 3).
 *   · 🔴 `endFreq` ([bp+8]) NO SE COMPARA NUNCA: sólo entra en el cálculo del incremento.
 *     El barrido termina donde lo deje la aritmética — el último divisor escrito al PIT
 *     (0x22e2 `div 0x1234DE` → `out 0x42` ×2) RETIENE hasta el gate OFF (0x43f7 → 0x230e
 *     `and al,0xfc; out 0x61`). ⇒ la frecuencia final EFECTIVA es `inicio + inc·(vueltas−1)`,
 *     y en los 30 call-sites estáticos del juego NUNCA coincide con la nominal (medido en
 *     re/notes/firma-43ae-todos-los-callsites.md §3; derivación y calco en
 *     re/notes/barrido-137-acta.md): waterfall 2500→«800» acaba en 1005 Hz (+205),
 *     MAINOUT 660→«150» en 272 Hz (+122, más de una octava).
 *
 * Aquí `f1` = esa frecuencia final efectiva (lo último que el PIT retuvo), y `steps` lleva
 * la escalera entera para que la síntesis conmute divisor a divisor (un `setValueAtTime`
 * por vuelta) en vez de rampar. La DURACIÓN no cambia: vueltas·paso = total en todos los
 * sitios estáticos (división exacta), misma ley `samplesToMs(total·GLIDE_FACTOR, 1)`.
 */
export function glide(startFreq: number, endFreq: number, step: number, total: number): ToneSeg {
  // step ≤ 0 colgaría el bucle del binario (di nunca avanza); ningún call-site lo empuja.
  if (step <= 0 || total <= 0) {
    // `jl` firmado con di=0: ni una vuelta — barrido MUDO (sólo gate OFF).
    const f = clampHz(startFreq);
    return { kind: "tone", f0: f, f1: f, ms: 0, steps: [] };
  }
  const prod16 = (((endFreq - startFreq) * step) << 16) >> 16; // imul: sólo el low word + cwd
  const inc = Math.trunc(prod16 / total); // idiv: trunca hacia cero
  const steps: number[] = [];
  for (let di = 0, si = startFreq; di < total; di += step, si = (si + inc + PHASE_MODULO) % PHASE_MODULO) {
    steps.push(clampHz(si)); // set_tone ANTES del incremento: el último tono es pre-incremento
  }
  return {
    kind: "tone",
    f0: steps[0]!,
    f1: steps[steps.length - 1]!,
    ms: samplesToMs(steps.length * step * GLIDE_FACTOR, 1),
    steps,
  };
}

/**
 * PRNG LOCAL del ruido del speaker `[0x545c]` (§1.2): `(([s]+0x9248) ror 3) ^
 * 0x9248) + 0x11`, aritmética de 16 bits. Es LOCAL: NO consume `g_rng` — cero
 * impacto en el orden de rands del juego (crítico para paridad). Determinista.
 */
export function noisePrng(s: number): number {
  const a = (s + 0x9248) & 0xffff;
  const rotated = ((a >>> 3) | (a << 13)) & 0xffff; // ror 3 en 16 bits
  return (((rotated ^ 0x9248) & 0xffff) + 0x11) & 0xffff;
}

/**
 * RELOJ DE ENTRADA DEL 8253 = **1.193.182 Hz**. No es una constante elegida aquí: es el
 * DIVIDENDO literal de `ULTIMA.EXE:0x227b/0x227e` (`mov dx,0x12` + `mov ax,0x34de` ⇒
 * `dx:ax = 0x1234DE`) y de `EGA.DRV:0x27e8/0x27eb`. Que ese número sea el reloj del PIT es
 * lo que convierte el cociente en un CONTADOR — y es justo lo que la ficha #254 pasó por
 * alto al leerlo como si fuera la frecuencia. (= 14,31818 MHz / 12, el reloj del PC.)
 */
const PIT_CLOCK_HZ = 0x1234de;

/**
 * La frecuencia que EMITE el canal 2 cuando el binario le programa el valor `v` (#254).
 *
 * El binario calcula `contador = 0x1234DE / v` (0x2281 `div cx`) y lo escribe al puerto
 * 0x42 en dos mitades (0x2283 `out 0x42,al` · 0x2285 `mov al,ah` · 0x2287 `out 0x42,al`).
 * El 8253 divide su reloj por ese contador, que es **ENTERO**: la salida no es `v` exacto
 * sino `reloj / floor(reloj / v)`. La ley sigue siendo «el valor sorteado es la frecuencia»
 * —lo que #254 confirmó—; esto es su CUANTIZACIÓN, y es la ley EXACTA del original.
 *
 * La desviación crece con la frecuencia (el contador se hace pequeño y su paso, grueso):
 * 0,165 % hasta 2 kHz · 0,832 % a 10 kHz · 1,692 % a 20 kHz · **2,127 % a 25 kHz**, el
 * peor caso de todo el catálogo (`ambient-fountain`, en `v=24858` → contador 47). Está por
 * debajo de un cuarto de semitono; se calca porque es DERIVADA y cuesta una línea, no
 * porque se oiga. Cota fijada con su caso extremo en `tests/intro-sonidos-220.test.ts`.
 *
 * `Math.max(1, …)` cubre `v > reloj` (contador 0): imposible con las bandas del catálogo
 * (la mayor es 25000 → contador 47), y en el binario sería una división por cero del PIT.
 *
 * EXPORTADA porque el TECHO exacto de una banda `B` es `pitHz(B)`, no `B`: la cuantización
 * puede empujar la frecuencia emitida un pelo POR ENCIMA del valor sorteado (+0,10 % en
 * banda 2000, +0,27 % en banda 10000, medidos). Los asertos de rango de los tests usan esta
 * misma función en vez de una tolerancia a ojo — el techo es DERIVADO, no un margen.
 */
export function pitHz(v: number): number {
  return PIT_CLOCK_HZ / Math.max(1, Math.floor(PIT_CLOCK_HZ / Math.max(1, v)));
}

/** Semilla inicial del PRNG local (arbitraria; el timbre exacto es →AV). */
const NOISE_SEED = 0x1234;
/** Cota de seguridad de muestras de ruido por burst (evita bucles patológicos). */
const NOISE_MAX_STEPS = 512;

/**
 * Estado PERSISTENTE del PRNG del ruido, espejo de `[0x545c]` (task #72): en el
 * original el estado NO se reinicia por burst — avanza continuamente entre llamadas.
 * Antes el port re-sembraba a `NOISE_SEED` en cada burst, así que con la cadencia
 * ambiente ya a 55 ms (1 tick) la cascada repetía SIEMPRE los mismos 3 tonos 18×/s
 * → zumbido tonal, no ruido. Persistiendo el estado, cada burst saca tonos nuevos
 * (áspero/variado como el hardware). LOCAL: no toca `g_rng` (cero paridad).
 */
let noiseState = NOISE_SEED;

/**
 * `pcspeaker_noise_burst` (0x223c): el burst dura hasta que el acumulador (+= `step`)
 * alcanza `dur`; cada iteración programa una frecuencia aleatoria en `[0x64, band]`
 * (del PRNG local). `nSteps ≈ dur/step` = resolución/grano; duración = `dur` muestras.
 * `seed` explícito = arranque determinista (tests); omitido = continúa el estado
 * persistente `[0x545c]` (comportamiento de juego, tonos variados por burst).
 *
 * EL VALOR SORTEADO **ES** LA FRECUENCIA EN Hz, y eso está DERIVADO, no supuesto (#254).
 * El binario hace `dx:ax = 0x1234DE; div cx` con cx = el valor (0x227b-0x2281) y escribe el
 * cociente al puerto 0x42 (0x2283/0x2287). El valor es, sí, el DIVISOR de esa división —
 * pero el DIVIDENDO es `0x1234DE` = 1.193.182 = el RELOJ del PIT, así que el cociente es el
 * CONTADOR del canal 2, y la frecuencia emitida es `reloj/contador` = el valor. Es la misma
 * cuenta que la cabecera ya razonaba para `set_tone 0x22e2`. La ficha #254 llegó a esta
 * función diciendo que el binario emitía `0x1234DE/valor` («ley inversa, ~20 cues con el
 * timbre invertido»): eso es el CONTADOR leído como si fuera la frecuencia. Guarda con
 * control negativo en `tests/intro-sonidos-220.test.ts` (#254).
 *
 * 🔴 LO QUE SÍ ESTABA MAL Y AQUÍ SE ARREGLA: el `span`. El binario hace `sub cx,bx` seguido
 * de `inc cx` (0x226e/0x2270) ⇒ el módulo es `band-0x64+1` y el sorteo cubre `[0x64, band]`
 * CERRADO por arriba. Aquí el `+1` faltaba, así que el valor más alto de cada banda no salía
 * nunca. El efecto es de un valor entre miles (imperceptible), pero mueve la secuencia
 * exacta de todos los cues de ruido; se declara en vez de dejarlo implícito.
 * El `Math.max(1, …)` cubre `band ≤ 0x64` — que en el binario ENVUELVE en 16 bits (defecto
 * del original, misma familia que `rand_range` sin guarda) y en el catálogo sólo alcanza
 * `refuge-thunder` (band 90), que es Clase C calibrada al testigo, no un param del asm.
 *
 * Y la frecuencia emitida pasa por `pitHz`: el contador es ENTERO, así que el altavoz no
 * suena a `v` exacto sino a `reloj/floor(reloj/v)`. Ver `pitHz` justo debajo.
 */
export function noiseBurst(step: number, dur: number, band: number, seed?: number): NoiseSeg {
  const lo = 0x64;
  const span = Math.max(1, band - lo + 1); // `sub cx,bx; inc cx` @0x226e/0x2270
  const nRaw = step > 0 ? Math.floor(dur / step) : dur;
  const n = Math.max(1, Math.min(nRaw, NOISE_MAX_STEPS));
  const freqs: number[] = [];
  let s = (seed ?? noiseState) & 0xffff;
  for (let i = 0; i < n; i++) {
    s = noisePrng(s);
    freqs.push(clampHz(pitHz(lo + (s % span))));
  }
  if (seed === undefined) noiseState = s; // persiste sólo el estado compartido de juego
  return { kind: "noise", freqs, ms: samplesToMs(dur * NOISE_FACTOR, 1) };
}

/**
 * Tabla de notas del arpegio de materialización de la aparición `[0x3a26]` — DERIVADA
 * del binario (carril aparición): OUTSUBS 0x0683-0x06a2 recorre `si=0x3a26..0x3a32`
 * (6 words) y por cada uno `tone_sweep([si], 1, 0x1388, 0xc8, 0xd)` (0x0698). Los
 * words viven en DATA.OVL (DS 0x3a26 → fileoff 0x3a36) = 2620×3 + 3700, 3900, 4160:
 * tres golpes en la fundamental (0x0a3c, la misma freq del sweep de materialización)
 * y tres notas ascendentes. Sustituye al placeholder nominal de 3 notas (task #4).
 */
const ARPEGGIO_NOTES = [0x0a3c, 0x0a3c, 0x0a3c, 0x0e74, 0x0f3c, 0x1040];
/**
 * Tabla de notas del CLAVICÉMBALO `[0x2746]` (indexada por dígito 0-9): DERIVADA
 * de DATA.OVL (DS:0x2746, fileoff 0x2756; TOWN 0x0E34 `push [bx+0x2746]`, bx=dígito).
 * Dígito 0 = nota más aguda (10ª tecla); dígitos 1-9 = escala ascendente.
 * Ver re/notes/interactions-piano-fire-audit.md §1.4 (task #54).
 */
const INSTRUMENT_NOTES = [
  0x1eab, 0x0c2c, 0x0da9, 0x0f56, 0x103f, 0x123c, 0x1478, 0x16fa, 0x1857, 0x1b53,
];

function instrumentNote(n: number): number {
  const d = Math.max(0, Math.min(9, Math.trunc(n)));
  return INSTRUMENT_NOTES[d]!;
}

/**
 * Canción del laúd de Iolo — DATOS EXACTOS del binario (DATA.OVL), derivados por el oráculo
 * DOSBox + estático. El motor de sonido del kernel (modo 4, `0x42d2`) toca por índice:
 * `al = melodía[contador]` ([0x6a48], 53 notas, contador [0x6a08] cicla 0..0x34); si `al!=0`
 * → `freq = tablaFreq[al]` ([0x6a34]) → `sweep(freq, 1, 0x7d0, 0x4e20, 0xfff6)` (0x2192);
 * si `al==0` → SILENCIO (`0x42df cmp 0; je` salta el sweep). El oráculo capturó freq=0x123c
 * (=índice 4) durante el camp de Iolo — cuadra. Cita: DATA.OVL fo 0x6a58 (melodía) + 0x6a44
 * (freq); kernel 0x42d2/0x2192. Ver re/notes/camp-scene-kernel.md §6.
 */
const BARD_FREQ_TABLE = [
  0x0000, 0x0da9, 0x0f56, 0x1136, 0x123c, 0x1478, 0x16fa, 0x1857, 0x19ca, 0x1b53,
] as const;
const BARD_MELODY = [
  1, 4, 4, 0, 0, 1, 5, 5, 0, 0, 4, 9, 6, 9, 7, 4, 6, 5, 1, 4, 0, 0, 0, 1, 5, 0, 0,
  0, 4, 9, 6, 5, 6, 4, 0, 0, 0, 5, 8, 8, 9, 5, 6, 8, 9, 5, 4, 6, 5, 4, 3, 2, 1,
] as const;

/**
 * RITMO de la canción — Clase C (cadencia real-time), witness-derived de
 * CAMP_IOLO_MUSICA.mov. El motor de sonido del original (kernel 0x42d2) avanza UN índice
 * del contador [0x6a08] por tick del bucle de animación: una nota y un rest ocupan un slot
 * de tiempo IGUAL. Medido en el testigo (análisis espectral del .mov): 53 índices en ~7.5 s
 * (audio 6.5–14 s) ⇒ ~142 ms por índice; dentro del slot la nota suena ~77 ms (el sweep,
 * count=0x7d0, coincide con los ~70 ms medianos medidos) y deja un hueco de silencio ~65 ms.
 * El nº de notas y las freqs son ASM-exactos (binario); SÓLO el reparto temporal es Clase C.
 */
const BARD_SONG_TOTAL_MS = 7500; // testigo: la canción suena 6.5–14 s

/**
 * Los índices que la ACAMPADA recorre: **1..52**, no los 53 de la tabla (ficha #39,
 * residuo 2 de `camp-bard-anim.md §7`). Cadena del asm:
 *
 *   CMDS.OVL  0x0183  mov byte ptr [0x6a08], 1    ; cursor SEMBRADO a 1, no a 0
 *   CMDS.OVL  0x0188  push 0x34 / call 0x7b66     ; = ULTIMA.EXE 0x3AE6(52)
 *   ULTIMA.EXE 0x3b07 call 0x5910 / 0x3b11 dec si / jnz  ; ⇒ 52 redibujos
 *   ULTIMA.EXE 0x42d8 mov al,[bx + 0x6a48]        ; una lectura de melodía por redibujo
 *   ULTIMA.EXE 0x42fe inc byte ptr [0x6a08]       ; …y un avance
 *   ULTIMA.EXE 0x4302 cmp [0x6a08],0x35 / jb      ; envuelve a 0 al llegar a 53
 *
 * ⇒ cursor 1,2,…,52 y a la 52ª vuelta el `inc` lo deja en 0x35 → 0. El índice 0 **NO
 * suena nunca en la acampada**; y vale 1, o sea una NOTA, así que tocar los 53 metía
 * una nota de más A LA CABEZA de la canción.
 *
 * El TOTAL (~7.5 s) NO se toca: sigue siendo el ancla Clase C del testigo
 * (CAMP_IOLO_MUSICA.mov, 6.5–14 s). El asm fija el RECUENTO, no los ms — repartir el
 * mismo total entre 52 slots conserva el ancla y arregla la estructura.
 */
const BARD_CAMP_MELODY = BARD_MELODY.slice(1); // índices 1..52
/** Nº de índices que suena la acampada = las 52 vueltas de `0x3AE6(0x34)`. */
export const CAMP_BARD_INDEX_COUNT = BARD_CAMP_MELODY.length;
const BARD_INDEX_MS = BARD_SONG_TOTAL_MS / CAMP_BARD_INDEX_COUNT; // ~144.2 ms/índice

/**
 * Paso del SPRITE del bardo = paso de ÍNDICE de su melodía. Es una sola constante a
 * propósito: en el original sprite y nota son hijos del MISMO redibujo (`0x5910` llama
 * a `0x4552` en 0x5941 y a `0x4102` en 0x5a1a, y ninguno de los dos tiene otro
 * llamador en los 28 .asm), así que el lockstep no es una coincidencia de cadencias
 * sino la estructura del bucle. La piel fiel avanza el intérprete del bardo con ESTA
 * constante para que no puedan volver a divergir. Ver `camp-bard-anim.md §4` y
 * `tests/camp-bard-lockstep.test.ts`.
 *
 * Lo que sigue SIN adjudicar (Clase C): los ms absolutos por vuelta. `0x20fa` se salta
 * la espera cuando n==1 y `[0x5356] ≤ 0xF0` (0x2103/0x2108/0x210e) ⇒ la tasa real es
 * dependiente de la máquina y no se ha medido contra DOSBox. Lo que este carril cierra
 * es el RATIO (1 frame por nota), que es estructural y no depende de la tasa.
 */
export const CAMP_BARD_STEP_MS = BARD_INDEX_MS;

const BARD_NOTE_TONE_MS = samplesToMs(0x7d0, 1); // ~77.5 ms, duración del sweep de una nota

/**
 * Una nota de la canción = tono de pitch CONSTANTE = `incToHz(freq)`: la portadora del
 * motor (0x2192 hace `dx += freq` por iteración y envuelve cada 65536 → el fundamental es
 * FIJO en freq/65536·SR; cita: kernel 0x21c4/0x21f1 `mov ax,[bp+0xc]; add dx,ax`, con la
 * freq empujada primero en 0x42e7 → [bp+0xc]). El sweep del umbral bx (0x4e20→0, paso −10)
 * del original modula el DUTY CYCLE, NO el pitch (→AV) — NO es un glissando.
 *
 * BUG QUE CORRIGE: el `toneSweep` genérico del catálogo modela el drift de bx como una
 * RAMPA de pitch y, al recibir el paso 0xfff6 como +65526 (no −10), calculaba bxEnd enorme
 * ⇒ ratio≈0 ⇒ f1 recortada a 20 Hz: cada nota era una SIRENA descendente de su pitch a
 * 20 Hz en 77 ms (el "sonidos raros" del reporte), no un tono. El testigo muestra tonos
 * estables (2ª interpretación: 1853 Hz sostenido). Aquí la nota es un tono limpio y fijo.
 */
function bardNote(idx: number): ToneSeg {
  const hz = incToHz(BARD_FREQ_TABLE[idx]!);
  return { kind: "tone", f0: hz, f1: hz, ms: BARD_NOTE_TONE_MS };
}

/**
 * Silencio de `ms` arbitrarios — el hueco tras cada nota y el rest de la canción del bardo.
 * Cadencia Clase C (witness-derived): SIN primitiva ASM detrás, a diferencia de `silence()`,
 * que modela `delay_via_timer` (0x20c8) con su factor ×24 y NO aplica a un rest de la canción
 * (en el original un rest sólo avanza el contador y retorna; el pacing es el tick externo).
 */
function pauseMs(ms: number): SilenceSeg {
  return { kind: "silence", ms };
}

/**
 * CATÁLOGO acción→sonido (§6 de `sfx-catalog.md`). Cada `SfxId` produce su
 * secuencia de segmentos con los params EXACTOS del asm. La piel llama a
 * `renderCue`; el core sólo emite el ID lógico.
 */
// ── Pergamino de hechizo-de-tiempo (CAST2.OVL 0x0000, idx<9) — tablas VERBATIM ──
// DATA.OVL (fileoff = DS+0x10), indexadas por el idx del scroll (In Sanct=2,
// In An=3, An Tym=7; el resto de slots pertenecen a otros clientes del setter).
/** `[0x4af6]` — inc del PWM de ambos sweeps (pitch del jingle por idx). */
const TIME_SPELL_INC = [8810, 7830, 7060, 6550, 5950, 5570, 5180, 4820, 4480];
/** `[0x4b08]` — umbral inicial `bx` del sweep de SUBIDA. */
const TIME_SPELL_F0_UP = [2700, 3000, 1000, 100, 5000, 4000, 2500, 1000, 1];
/** `[0x4b1a]` — umbral inicial `bx` del sweep de BAJADA (espejo, step negado). */
const TIME_SPELL_F0_DOWN = [32700, 31000, 37000, 45000, 31000, 34000, 36500, 39000, 42000];
/** `[0x4b2c]` — paso del umbral por muestra (signo = dirección). */
const TIME_SPELL_STEP = [3, 2, 2, 2, 1, 1, 1, 1, 1];

/**
 * Ventana temporal de la INVERSIÓN de pantalla del jingle de tiempo (ms desde el
 * arranque del cue): el original toca el NB de entrada, INVIERTE el viewport
 * (XOR blanco (8,8)-(183,183), 0x0b86 = STC+fn21), toca los DOS sweeps y
 * DES-invierte (XOR es involutivo). ⇒ delay = dur del NB; dur = 2 sweeps.
 * DERIVADO de los mismos params del catálogo (cero constantes libres nuevas).
 * Testigo: doom-n6-combate f042-f045 y ss. — ventanas de ~3 s por (U)se de
 * An Tym (idx 7), chrome/paneles NUNCA invertidos.
 */
export function timeSpellFlashWindowMs(idx: number): { delay: number; dur: number } {
  const intro = noiseBurst(0x320, 0x1f40 + 0x640 * idx, 0x2bc, 1).ms;
  const sweep = samplesToMs(0x2710 + 0xfa0 * idx, 1);
  return { delay: intro, dur: 2 * sweep };
}

/**
 * `sfx_victory_fanfare` (`ULTIMA.EXE:0x4368`, §3.5): tres notas iguales y una final más
 * grave y del doble de larga. Definida UNA vez porque la sirven DOS ids del catálogo:
 * `victory-fanfare` (el nombre verdadero) y `cast-spell` (la atribución heredada que §3.5
 * declara falsa y que sigue sin arreglar por decisión del lead). Compartir el cuerpo impide
 * que se separen mientras convivan.
 */
function victoryFanfare(): SfxSeg[] {
  return [
    toneSweep(4600, 1, 10800, 300, 6),
    toneSweep(4600, 1, 10800, 300, 6),
    toneSweep(4600, 1, 10800, 300, 6),
    toneSweep(6100, 1, 21600, 300, 3),
  ];
}

/**
 * BARRIDOS DEL RITUAL DEL SHARD (#201) — `CAST.OVL:0x15dd-0x162a`, DOS bucles consecutivos.
 * Cada uno llama a `tone_sweep` con los MISMOS cinco argumentos salvo `start`, que es la
 * variable del bucle: sube 0x7d0→0x61a8 de 0x32 en 0x32, y luego baja igual. El 5º argumento
 * (`step`) es CERO en ambos (`sub ax,ax` en 0x15ed/0x161d) — el ±0x32 es del bucle, no de él.
 *
 * ⚠ Bajo el modelo de `toneSweep` (pitch = `incToHz(inc)`; `start`/`step` sólo mueven el DUTY,
 * ver cabecera) las dos mitades son IDÉNTICAS: mismo `inc`, mismo `count`. Lo que en 1988
 * sube y baja es el TIMBRE, que aquí no se modela. Se emiten los dos tramos igualmente para
 * que la duración total sea la del original.
 *
 * 🔴 CONSECUENCIA MEDIDA, declarada y no escondida: 460 iteraciones × 7,75 ms = 3,57 s por
 * tramo, 7,13 s los dos, a un tono FIJO de 1039,6 Hz. En 1988 esos 7 s eran interesantes
 * porque el timbre barría de punta a punta; aquí son 7 s de onda cuadrada plana. La duración
 * y el tono son los derivados — lo que falta es el eje que este motor no tiene. Vecina: #137
 * (calcar el barrido REAL del speaker), que es donde se arreglaría de verdad.
 *
 * Las iteraciones se DERIVAN de las cotas (no se cablea el 460), y el total NO cabe en el
 * `count` de una sola llamada (200·460 desborda los 16 bits que `toneSweep` trunca), así que
 * el tramo se construye escalando la duración de UNA llamada — exacto porque todas son iguales
 * y van seguidas.
 */
const SHARD_SWEEP_LO = 0x7d0; // `mov si,0x7d0` @0x15dd
const SHARD_SWEEP_HI = 0x61a8; // `cmp si,0x61a8` @0x15f6
const SHARD_SWEEP_STRIDE = 0x32; // `add si,0x32` @0x15f3 / `sub si,0x32` @0x1623
const SHARD_SWEEP_ITERS = Math.ceil((SHARD_SWEEP_HI - SHARD_SWEEP_LO) / SHARD_SWEEP_STRIDE);

function shardSweepHalf(): ToneSeg {
  const one = toneSweep(0xa50, 1, 0xc8, SHARD_SWEEP_LO, 0); // args @0x15e0-0x15ef
  return { ...one, ms: one.ms * SHARD_SWEEP_ITERS };
}

/**
 * BARRIDOS DEL «WELL DONE» DEL ALTAR (#295) — `CAST2.OVL:0x0c44-0x0c85`, la MISMA forma de
 * dos bucles espejo que el ritual del shard de aquí arriba, con las MISMAS cotas y el mismo
 * paso (`mov si,0x7d0` @0x0c44 · `add si,0x32` @0x0c5a · `cmp si,0x61a8` @0x0c5d, y la
 * vuelta en 0x0c66-0x0c83). Lo único distinto son dos de los cinco argumentos del tono:
 * `inc`=0xc1c (el shard usa 0xa50) y `count`=0x96 (el shard 0xc8). El 5º (`step`) es CERO en
 * los dos (`sub ax,ax` @0x0c54/0x0c76): el ±0x32 es del bucle, no del sweep.
 *
 * Las cotas se REUSAN de las del shard a propósito — son literalmente las mismas constantes
 * en el binario, y compartirlas impide que alguien las mueva en un sitio y no en el otro.
 *
 * ⚠ Hereda la misma limitación DECLARADA que el shard: bajo el modelo de `toneSweep` las dos
 * mitades son idénticas (mismo pitch), porque lo que barre en 1988 es el DUTY = timbre, que
 * este motor no tiene. La DURACIÓN y el tono sí son los derivados. Vecina: #137.
 */
function wellDoneSweepHalf(): ToneSeg {
  const one = toneSweep(0xc1c, 1, 0x96, SHARD_SWEEP_LO, 0); // args @0x0c47-0x0c56
  return { ...one, ms: one.ms * SHARD_SWEEP_ITERS };
}

/**
 * BARRIDOS DEL «ALAKAZAM» DE LA DONACIÓN (#364) — `CAST2.OVL:0x0bd0-0x0c0f`, rama de
 * donación ACEPTADA (0x0b1d) de `shrine_visit`. TERCER miembro de la familia de dos bucles
 * espejo (shard, WELL DONE, y éste): mismas cotas y el mismo paso (`mov si,0x7d0` @0x0bd0 ·
 * `add si,0x32` @0x0be6 · `cmp si,0x61a8` @0x0be9, y la vuelta en 0x0bf2-0x0c0f). Sus cinco
 * argumentos del tono, constantes salvo `si` (@0x0bd3-0x0be2): `inc`=0xa8c (propio),
 * `delay`=1, `count`=0xc8 — el del SHARD, no el 0x96 del WELL DONE — y `step`=0
 * (`sub ax,ax` @0x0be0/0x0c02: el ±0x32 es del bucle, no del sweep).
 *
 * Las cotas se REUSAN de las del shard por la misma razón que el WELL DONE de arriba: son
 * las mismas constantes en el binario, y compartirlas impide que diverjan.
 *
 * ⚠ Hereda la limitación DECLARADA de la familia: bajo el modelo de `toneSweep` las dos
 * mitades son idénticas (el DUTY que barre en 1988 es timbre, no pitch). Vecina: #137.
 */
function donationSweepHalf(): ToneSeg {
  const one = toneSweep(0xa8c, 1, 0xc8, SHARD_SWEEP_LO, 0); // args @0x0bd3-0x0be2
  return { ...one, ms: one.ms * SHARD_SWEEP_ITERS };
}

/**
 * MELODÍA del ORDAINED (#364-b) — `CAST2.OVL:0x0adb-0x0b02`, rama 0x0a81 de `shrine_visit`
 * (primera meditación de una virtud, pre-Códice). NO es de la familia de dos bucles espejo:
 * es un bucle de SIETE llamadas a `tone` (0x3fb2 → kernel 0x2192) con los cinco argumentos
 * leídos de CUATRO tablas paralelas de 7 words en DS — punteros que avanzan de 2 en 2 hasta
 * `cmp si,0x4c1e` (@0x0afe):
 *   · `inc`   = [0x4be6+2i]  (`di` sembrado @0x0acb)
 *   · `delay` = 1 constante  (`mov ax,1` @0x0add)
 *   · `count` = [0x4bf4+2i]  (`[bp-0xe]` @0x0ace)
 *   · `start` = [0x4c02+2i]  (`[bp-0x10]` @0x0ad3)
 *   · `step`  = [0x4c10+2i]  (`si` @0x0ad8)
 * Los VALORES son de DATA.OVL, fileoff = DS+0x10 (mapeo con control positivo en
 * `re/notes/siembra-objetos-cbt-353.md` §3: DS 0x385e → fo 0x386e = la EC_GROUP_TABLE);
 * aquí van VERBATIM: fo 0x4bf6 (inc) · 0x4c04 (count) · 0x4c12 (start) · 0x4c20 (step).
 *
 * Bajo el modelo de `toneSweep` (pitch = `incToHz(inc)`; `start`/`step` mueven el DUTY =
 * timbre, no el pitch — ver cabecera de `toneSweep`), la melodía son 7 tonos de pitch fijo:
 * ~1299 Hz (0xce4) · ~1546 Hz (0xf55) ×4 · ~1457 Hz (0xe74) · ~1546 Hz, con duraciones
 * 271/232/116×4/310 ms ≈ 1.279 ms en total. A diferencia de la familia shard/WELL DONE,
 * aquí `step` NO es cero (9/10/21/21/21/21/8): en 1988 cada nota barre además su duty desde
 * `start` — timbre que este motor no modela (vecina #137), declarado y no escondido.
 *
 * SIN inversión NI sacudida: la rama no llama a 0x2890/0x29a6/0x4e92 — tras el bucle salta
 * directa al `kernel_flash(10)` común (`jmp 0xd16` @0x0b04). Por eso este cue no lleva
 * ventana (`ritual-invert`) ni entra en `CHAINED_CUES`.
 */
export const ORDAINED_INC = [0x0ce4, 0x0f55, 0x0f55, 0x0f55, 0x0f55, 0x0e74, 0x0f55] as const; // DS 0x4be6 → fo 0x4bf6
export const ORDAINED_COUNT = [0x1b58, 0x1770, 0x0bb8, 0x0bb8, 0x0bb8, 0x0bb8, 0x1f40] as const; // DS 0x4bf4 → fo 0x4c04
export const ORDAINED_START = [0x03e8, 0x03e8, 0x03e8, 0x03e8, 0x03e8, 0x03e8, 0x01f4] as const; // DS 0x4c02 → fo 0x4c12
export const ORDAINED_STEP = [0x09, 0x0a, 0x15, 0x15, 0x15, 0x15, 0x08] as const; // DS 0x4c10 → fo 0x4c20

function ordainedMelody(): ToneSeg[] {
  return ORDAINED_INC.map((inc, i) =>
    toneSweep(inc, 1, ORDAINED_COUNT[i]!, ORDAINED_START[i]!, ORDAINED_STEP[i]!),
  );
}

/**
 * TERREMOTO (#29): rumble grave PULSADO — 8 pulsos (uno por sacudida del viewport, periodo
 * ~116 ms) sincronizados con la QuakeShake; cada pulso, TRES sub-ráfagas + hueco. Los
 * detalles del modelo (tri-banda, Clase C calibrado al testigo) están en la entrada `quake`
 * del catálogo, que es quien lo sirve. El parámetro `seed`, SOLO para sondas de duración
 * (`quakeDurationMs`): con seed el PRNG del ruido NO avanza el estado compartido, así que
 * preguntar «cuánto dura» no mueve la secuencia de frecuencias de los cues siguientes. Los
 * `ms` de cada segmento no dependen del seed.
 */
function quakeSegs(seed?: number): SfxSeg[] {
  return Array.from({ length: 8 }, () => [
    noiseBurst(1, 300, 180, seed), // GRAVE — fundamental (medido ~106 Hz)
    noiseBurst(1, 220, 480, seed), // CUERPO medio
    noiseBurst(1, 200, 980, seed), // BANDA ALTA — recortada por NOISE_LOWPASS_HZ
    silence(80),
  ]).flat();
}

/**
 * Duración total del cue `quake` (930 ms con U=0,93), SIN tocar el PRNG compartido del
 * ruido — a diferencia de `cueDurationMs({id:"quake"})`, que expande el catálogo y avanza
 * `noiseState`. La consume `wellDoneInvertWindowMs` (#355): la ventana del negativo se
 * pregunta en el MISMO instante en que el rito va a sonar, y una sonda que moviera el
 * estado cambiaría las frecuencias del trueno que está a punto de agendarse.
 */
export function quakeDurationMs(): number {
  return quakeSegs(1).reduce((acc, s) => acc + s.ms, 0);
}

/**
 * Duración de la VENTANA DE INVERSIÓN de la DONACIÓN (#364), en ms.
 *
 * Mismo régimen «suelto» que el WELL DONE de abajo: el rect XOR de 0x0bcd no lo des-invierte
 * nadie — lo restaura el `kernel_flash(10)` de 0xd16 (`jmp 0xd16` @0x0c14), y entre uno y
 * otro sólo corren los dos barridos ⇒ la ventana ES su duración, sin delay de entrada.
 * NO se reusa `wellDoneInvertWindowMs`: los `count` difieren (0xc8 vs 0x96) y la ventana
 * de cada rito debe moverse con SU cue si un día se recalibra el modelo del altavoz.
 */
export function donationInvertWindowMs(): number {
  return 2 * donationSweepHalf().ms;
}

/**
 * Duración de la VENTANA DE INVERSIÓN del WELL DONE (#295, ventana COMPLETA por #355), en ms.
 *
 * 🔴 Es un régimen DISTINTO al del jingle de tiempo (`timeSpellFlashWindowMs`), y la
 * diferencia es del BINARIO, no de estilo: allí el rect XOR está PAREADO (0x0031 invierte,
 * 0x007a des-invierte) y la ventana es «lo que dura lo de en medio»; aquí el rect XOR está
 * SUELTO (0x0c41 invierte y nadie des-invierte) y lo que restaura el viewport es el
 * `kernel_flash(10)` de 0x0d1a. Por eso esto NO tiene `delay`: la inversión empieza en el
 * mismo instante.
 *
 * 🔴 #355 — «entre uno y otro sólo hay los dos barridos», que es lo que decía aquí, era
 * FALSO (acta #345 §6). Las llamadas del tramo 0x0c41→0x0d1a son SEIS, releídas del asm
 * (base cross-overlay 0xE1E0, adjudicada con control positivo en
 * `re/notes/shrine-rito-cadencia-negativo.md` §0):
 *   · 0x0c57/0x0c79 `call 0x3fb2` — los DOS barridos (460 tonos cada uno, bucles
 *     0x0c44-0x0c61 y 0x0c66-0x0c83) ................................. 5.347,5 ms
 *   · 0x0c88 `call 0x4e92` → kernel 0x3072 — la SACUDIDA (el `quake`). El port la emite
 *     ENCADENADA justo en la cola de los barridos (`CHAINED_CUES`), así que su duración
 *     se toma del MISMO catálogo que la agenda: `quakeDurationMs()` ....... +930 ms
 *   · 0x0cba/0x0cdb/0x0cfc `call 0x3670` — TRES `print_string` CONDICIONALES (gateados
 *     por las tablas de atributo `[bx+0x4b7e/0x4b86/0x4b8e]`: de 0 a 3 según la virtud).
 *     `print_string` (kernel 0x1850) no gira el temporizador — no hay constante de reloj
 *     que derivar, y el port los imprime síncronos DENTRO de la ventana ....... +0 ms
 * ⇒ ventana = 5.347,5 + 930 = 6.277,5 ms. Con la corta (solo barridos) el trueno arrancaba
 * en t=5.347,5 = EXACTAMENTE cuando la pantalla se restauraba: sonaba fuera del negativo.
 *
 * Reparto derivado/calibrado, declarado (doctrina de `compartir-la-primitiva…`): la
 * ESTRUCTURA (qué llamadas quedan dentro y en qué orden) es derivada del asm; la ESCALA de
 * cada sumando es la de su cue del port (barridos: `samplesToMs` con U=0,93 del WAV real;
 * sacudida: modelo tri-banda Clase C calibrado al testigo de #29). Nada se recalibra aquí:
 * si un día se recalibra el altavoz, la ventana se mueve SOLA con sus dos sumandos.
 *
 * CERO ms de vídeo: lo que el testigo acredita es el HECHO (negativo sostenido con el
 * trueno dentro), no la cifra.
 */
export function wellDoneInvertWindowMs(): number {
  return 2 * wellDoneSweepHalf().ms + quakeDurationMs();
}

/**
 * Los SEIS tone_sweep del jingle del curandero (SHOPPES 0x13b0), en orden y con los
 * cinco args del asm VERBATIM — FUENTE ÚNICA: de aquí salen el cue `shop-transaction`
 * del catálogo Y las ventanas de los tres destellos XOR (#299). Tres pares espejo
 * subida/bajada; cada par va precedido en el binario por su rect XOR (0x13c1/0x1403/
 * 0x1438), así que la ventana de cada destello = la suma de su par.
 */
const HEALER_JINGLE_SWEEPS: readonly [number, number, number, number, number][] = [
  [0x100e, 1, 0x57e4, 0x1388, 1], // @0x13d8
  [0x100e, 1, 0x57e4, 0x6b6c, -1], // @0x13ef
  [0x11b2, 1, 0x9c40, 1, 1], // @0x1417
  [0x11b2, 1, 0x9c40, 0x9c40, -1], // @0x142b (start reusa ax=0x9c40)
  [0x8fc, 1, 0x4650, 1, 2], // @0x144f
  [0x8fc, 1, 0x4650, 0x8ca0, -2], // @0x1466
];

/**
 * Ventanas de los TRES destellos XOR del curandero (#299), en ms — una por rect XOR de
 * SHOPPES 0x13b0 (0x13c1 máscara 4 · 0x1403 máscara 4^15=11 · 0x1438 máscara 4), cada
 * una = la duración de su par de barridos (lo único que corre entre un rect y el
 * siguiente; el residuo tras el tercero lo restaura el redibujo del bucle de menú).
 * Derivada de los MISMOS args que el cue: si se recalibra el altavoz, se mueve sola.
 * Las máscaras viven con el animador (`HEALER_FLASH_MASKS`, invert-flash.ts).
 */
export function healerFlashWindowsMs(): [number, number, number] {
  const ms = (i: number): number => {
    const [, delay, count] = HEALER_JINGLE_SWEEPS[i]!;
    return samplesToMs(count, delay);
  };
  return [ms(0) + ms(1), ms(2) + ms(3), ms(4) + ms(5)];
}

export const SFX_CATALOG: Record<SfxId, (n?: number) => SfxSeg[]> = {
  // Combate — noise_burst (§3.1).
  "combat-hit": () => [noiseBurst(10, 3000, 2000)],
  "combat-hit-heavy": () => [noiseBurst(40, 3000, 500)],
  "combat-damage": () => [noiseBurst(10, 1600, 2000)],
  "combat-defeat": () => [noiseBurst(40, 3000, 500)],
  // Magia (§3.5 / §4.2).
  // 🔴 `cast-spell` NO es el sonido de lanzar un conjuro: es `sfx_victory_fanfare 0x4368`,
  // cuyos dos únicos llamadores son COMBAT tras «VICTORY!» y la cola del ritual del shard
  // (`sfx-catalog.md` §3.5, atribución declarada falsa y SIN ARREGLAR por decisión del lead).
  // Comparte la onda con `victory-fanfare` — el nombre verdadero, añadido en #201 para el
  // camino que sí es suyo — para que las dos no puedan divergir mientras convivan.
  "cast-spell": victoryFanfare,
  "spell-zap": () => [toneSweep(0x2648, 1, 28000, 1000, 2)], // §4.2 CAST @0xd85 "zap largo agudo"
  // ABANICO de línea (CAST 0x1f60): NB de entrada con dur POR MODO (0x1f91-0x1faa/
  // 0x2088: 1→0x3e80, 2→0x4b00, 3/4→0x5140; step=0x320, band=0x2bc) + el CRACKLE del
  // trazador (0x1bb0 1bf4-1c00: set_tone(rand(100,10000)) POR PÍXEL pintado — aquí
  // agregado como ráfaga en banda [100,10000] de ~400 ms ≈ el crecimiento del abanico;
  // Clase C el troceo, DERIVADA la banda). ⚠ el rand del crackle en el original es el
  // kernel 0x2092 (rand de juego) — el port NO lo consume (paridad propia intacta).
  "line-spray": (n = 4) => [
    noiseBurst(0x320, n === 1 ? 0x3e80 : n === 2 ? 0x4b00 : 0x5140, 0x2bc),
    noiseBurst(8, 6900, 10000),
  ],
  // JINGLE del pergamino de tiempo (CAST2 0x0000, idx<9): NB de entrada
  // (step=0x320, dur=0x1f40+0x640·idx, band=0x2bc; 0x000b-0x001d) y DOS sweeps
  // espejo 0x2192 (subida f0=[0x4b08+2i] step=+[0x4b2c+2i]; bajada f0=[0x4b1a+2i]
  // step=−; inc=[0x4af6+2i], delay=1, count=0x2710+0xfa0·idx; 0x0045-0x006d).
  // Entre ambos sweeps el viewport está INVERTIDO (XOR blanco 0x0b86 antes/después;
  // la ventana temporal la da `timeSpellFlashWindowMs`). Tablas VERBATIM de DATA.OVL.
  "time-spell": (n = 7) => [
    noiseBurst(0x320, 0x1f40 + 0x640 * n, 0x2bc),
    toneSweep(TIME_SPELL_INC[n]!, 1, 0x2710 + 0xfa0 * n, TIME_SPELL_F0_UP[n]!, TIME_SPELL_STEP[n]!),
    toneSweep(TIME_SPELL_INC[n]!, 1, 0x2710 + 0xfa0 * n, TIME_SPELL_F0_DOWN[n]!, -TIME_SPELL_STEP[n]!),
  ],
  // ROMPER EL ESPEJO (#217) — TOWN.OVL `town_attack_cmd` 0x0a69-0x0a80, transcrito:
  //   0a69  si = 0x7d0
  //   0a6c  push 0x28 / push 0x78 / push si ; call noise_burst   (ver el orden abajo)
  //   0a78  si += 0x3e8
  //   0a7c  cmp si, 0x4e20 ; jl 0xa6c
  // El bucle EJECUTA con si = 2000,3000,…,19000 (tras la vuelta de si=19000 el `si`
  // vale 20000 y `jl 0x4e20` ya no salta) = 18 ráfagas exactas.
  // 🔴 ORDEN DE ARGUMENTOS: los pushes van (0x28, 0x78, si) y en cdecl el ÚLTIMO
  // empujado es el PRIMER argumento, así que en C es `noise_burst(si, 0x78, 0x28)`
  // = (band, dur, step). La notación del corpus —y la de `noiseBurst` aquí— es la de
  // PUSH: (step, dur, band). Careado contra el sitio ya documentado del campo
  // eléctrico (DUNGEON 0x4b9, pushes 1/0x1f4/0x4e20 = step 1, dur 500, techo 20000).
  // ⇒ step = 0x28 = 40, dur = 0x78 = 120, band = el `si` del bucle.
  // Con dur/step = 3, cada ráfaga son 3 tonos sorteados en [100, band]: 54 en total.
  "mirror-break": () =>
    Array.from({ length: 18 }, (_, i) => noiseBurst(0x28, 0x78, 0x7d0 + 0x3e8 * i)),
  // Objetos / mundo.
  sceptre: () => [toneSweep(0xfd2, 1, 65000, 1, 1)], // §3.2
  // Materialización de Blackthorn en la captura (#324): tone_sweep único de BLCKTHRN
  // 0x082b-0x083f — pushes (0xaf0, 1, 0x32c8, 0x64, 5), notación PUSH como el resto.
  "blackthorn-materialize": () => [toneSweep(0xaf0, 1, 0x32c8, 0x64, 5)],
  // Ritual del shard (#201): los dos tramos, ascendente y descendente (CAST 0x15dd-0x162a).
  "shard-sweep": () => [shardSweepHalf(), shardSweepHalf()],
  // WELL DONE del Altar (#295): los dos tramos espejo de CAST2 0x0c44-0x0c85. Misma forma
  // que el shard, otros `inc`/`count` — ver `wellDoneSweepHalf`.
  "shrine-well-done": () => [wellDoneSweepHalf(), wellDoneSweepHalf()],
  // ALAKAZAM de la donación aceptada (#364): los dos tramos espejo de CAST2 0x0bd0-0x0c0f.
  // Misma familia, `inc`=0xa8c y `count`=0xc8 — ver `donationSweepHalf`. NO entra en
  // `CHAINED_CUES`: en su rama no hay segundo cue con el que serializarse (no hay 0x4e92).
  "shrine-donation": () => [donationSweepHalf(), donationSweepHalf()],
  // Melodía de 7 notas del ORDAINED (#364-b): bucle CAST2 0x0adb-0x0b02, args por nota de
  // las cuatro tablas DS 0x4be6/0x4bf4/0x4c02/0x4c10 (DATA.OVL) — ver `ordainedMelody`.
  // Sin inversión ni sacudida en su rama ⇒ ni ventana ni `CHAINED_CUES`.
  "shrine-ordained": () => ordainedMelody(),
  "victory-fanfare": victoryFanfare, // 0x4368 — §3.5; misma onda que `cast-spell`
  moongate: () => [toneSweep(0x170c, 1, 30000, 2000, 2)], // §3.3
  "shadowlord-announce": () => [toneSweep(0x19c8, 1, 60000, 2000, 1)], // §4.1
  // TERREMOTO (#29): rumble grave PULSADO — 8 pulsos (uno por sacudida del viewport,
  // periodo ~116 ms) sincronizados con la QuakeShake. Cada pulso son TRES sub-ráfagas
  // de ruido: GRAVE (band 180 → asienta el fundamental medido), CUERPO medio (band 480)
  // y BANDA ALTA (band 980, la recorta el LP 2100). El modelo antiguo era una sola
  // ráfaga band=520: su energía se apilaba en 300-500 Hz (pico ≈316 Hz) y le faltaba el
  // grave → «no suena igual» del testigo. MEDIDO en el AUDIO real (DUNGEON_WORD_QUAKE_
  // INFAMA.mov 4.04-4.92s + HARPSI_SANDALWOOD_QUAKE.mov 26.48-27.35s, Welch PSD): pico
  // 105.5 Hz (ambos clips), energía repartida 100-1000 Hz. Este modelo tri-banda baja el
  // pico del port a ~129 Hz y la distancia L1 de las bandas de 90.5→35.9 (docs/verdicts/
  // quake-shader/AUDIO.md). Params acústicos EXACTOS = kernel @0xaea2 sin resolver →
  // CALIBRADOS al testigo. ⚠ Clase C. El residual >2.1 kHz (sizzle real 11%) lo capa el
  // LP global (compartido con pasos/ambiente): NO se sube aquí. NUNCA música de fondo.
  quake: () => quakeSegs(),
  "instrument-note": (n = 0) => [toneSweep(instrumentNote(n), 1, 4000, 20000, -4)], // §4.1
  // JINGLE del servicio del CURANDERO — RE-DERIVADO (carril audio-costuras): la
  // rutina SHOPPES 0x13b0→ret 0x1469 es LINEAL y toca los 6 tone_sweep en secuencia
  // (3 pares espejo subida/bajada). Params COMPLETOS leídos de los push (el reuso
  // de `ax` en 0x1416/0x1426 se lee sin ambigüedad → el hedge «→AV» de §4.4 queda
  // resuelto): NO existe la variante asc=éxito/desc=fallo del modelo anterior — el
  // jingle es uno solo y suena únicamente al EJECUTARSE el servicio (callers
  // 0x1611/0x1684/0x16eb = ramas Cure/Heal/Resurrect). `n` se ignora.
  // Los seis args viven en `HEALER_JINGLE_SWEEPS` (fuente única con las ventanas de los
  // tres destellos XOR de #299 — `healerFlashWindowsMs`).
  "shop-transaction": () => HEALER_JINGLE_SWEEPS.map((a) => toneSweep(...a)),
  // Cañonazo de fragata (F) — glide(1000→200,5,300), CMDS 0x0962 @0x9d5 / 0x0c05.
  "cannon-fire": () => [glide(1000, 200, 5, 300)],
  // Caída por catarata (#322) — glide(2500→800,1,300), OUTSUBS 0x0482-0x0492.
  // Mismo `total` que el cañonazo (300) y por tanto misma duración; lo que cambia
  // es el par de frecuencias (2500→800 aquí, 1000→200 allí).
  "waterfall-fall": () => [glide(2500, 800, 1, 300)],
  // Huida del arena (SJOG 0x1c37) y anillo consumido (ZSTATS 0xe42): ambos
  // glide(1200→2000,1,40) [0x4b0→0x7d0].
  "combat-escape": () => [glide(1200, 2000, 1, 40)],
  "ring-vanishes": () => [glide(1200, 2000, 1, 40)],
  // Absorción del desenlace (cabo de #179, SJOG 0x1ef8-0x1f08 → kernel 0x43AE):
  // TERCER miembro de la tupla glide(1200→2000,1,40) [0x4b0→0x7d0, paso 1, 0x28] —
  // que absorber y huir suenen igual es del binario. UN solo tono: el «tono corto»
  // previo al nombre era putchar('\n') (careo en el docblock del SfxId y en
  // absorcion-179-acta.md §10). Ni bloqueante ni encadenado (familia combat-escape).
  "combat-absorbed": () => [glide(1200, 2000, 1, 40)],
  // Rechazo de comando en la arena (funnel SJOG 0x1f26, ficha #161): dos beeps
  // CONTIGUOS y DESCENDENTES — 220 Hz (0xdc) y 150 Hz (0x96), dur 0x96 cada uno
  // (0x1f52/0x1f5d → kernel 0x22c0 vía base 0xBF80). En el binario no hay hueco
  // entre ambos (beep = set_tone + delay 0x20c8 + off; el segundo arranca al
  // retornar el primero). Derivación y controles en el docblock del SfxId.
  "combat-reject": () => [beep(0xdc, 0x96), beep(0x96, 0x96)],
  // Ambiente por proximidad (`ambient_sfx_tick` 0x4102 §1b; re/notes/ambient-audio-
  // audit.md). El burbujeo de la fuente, el rumor de la cascada, el tic-tac y la
  // campanada del reloj — el SFX del tile animado más cercano al party.
  "ambient-fountain": () => [noiseBurst(10, 30, 25000)], // 0x42c4 clase 3
  "ambient-waterfall": () => [noiseBurst(20, 60, 10000)], // 0x42be clase 2
  // SFX del cine-guion de la intro (demo), PARAMS byte-citados del scene engine FONT.OVL
  // (demo-stage3): thunder = moongate rise/fall (0x03c6 NB(20,60,10000)); chime = moongate
  // modo-3 (0x03ef tono 3000, dur 3 → beep; el frame-4 = 2000 se colapsa al representativo);
  // summon = opcode SUMMON (0x088d NB(1,1200,4000), grano fino → ráfaga larga casi-tonal).
  "intro-thunder": () => [noiseBurst(20, 60, 10000)],
  "intro-chime": () => [beep(3000, 3)],
  "intro-summon": () => [noiseBurst(1, 1200, 4000)],
  // PANTALLA DE TÍTULO (#220) — emisor `EGA.DRV:0x27af`, el `noise_burst` PROPIO del
  // driver de vídeo. Su banda se DIVIDE por 2 antes de mapear al rango (`0x27d9 shr cx,1`),
  // al revés que el del kernel (`ULTIMA.EXE:0x226b`, sin desplazar): por eso el `>> 1`.
  // Quitarlo ENSANCHA el sorteo al doble — el error que este `>>1` existe para evitar.
  // ✅ Aquí decía que el port usa el valor como Hz «mientras el binario lo usa como DIVISOR
  // del PIT», con la inversión de timbre que eso implicaría en ~20 cues. #254 lo REFUTÓ: el
  // dividendo de esa `div` es el reloj del PIT, el cociente es el contador, y la frecuencia
  // emitida es el valor sorteado — las dos leyes coinciden. Ver el docblock de `noiseBurst`.
  //  · fizzle = dissolve de pantalla (sel 0x66 CF=0, @0x269f): UNA ráfaga de 1 pulso por
  //    cada 2 píxeles, con la banda subiendo de 1 en 1 desde 0xf0 (`0x26a2 inc cs:[0x27a7]`).
  //    `n` = la banda del original en ese punto; el port agrupa las ráfagas de un tramo en
  //    un solo `noiseBurst` de `TITLE_FIZZLE_BURSTS_PER_CUE` pulsos (ver introAnim.ts).
  //  · crackle = crepitar del subtítulo (sel 0x69 CF=1, @0x29c5): `noise_burst(1,0x19,0xbb8)`.
  "title-fizzle": (n) => [
    noiseBurst(1, TITLE_FIZZLE_BURSTS_PER_CUE, (n ?? TITLE_FIZZLE_BAND0) >> 1),
  ],
  "title-crackle": () => [noiseBurst(1, SUBTITLE_CRACKLE_DUR, SUBTITLE_CRACKLE_BAND >> 1)],
  "ambient-clock-tick": () => [beep(3000, 3)], // 0x42a1 clase 1 fase 0 (TIC)
  "ambient-clock-tock": () => [beep(2000, 3)], // 0x429c clase 1 fase 4 (TAC)
  "ambient-clock-chime": () => [toneSweep(3116, 1, 2000, 20000, -10)], // 0x428b dar la hora
  // Movimiento — PASO EXITOSO a pie (kernel sfx_footstep 0x433e): dos noise_burst
  // cortos, band 1000 luego 1500, SEPARADOS por delay(0x14,1) (0x4355) = 22 ms de
  // silencio (dos clics "tk‥tk", no un blip). El hueco ya NO es →AV: es
  // delay(count=0x14,shiftidx=1) → inner=C (misma unidad que beep). Params EXACTOS
  // del asm 0x434a/0x4355/0x4364, confirmados por el oráculo (task #56) y la
  // captura de pila del testigo (re/notes/walk-sound-verdict.md §6).
  "move-step": () => [noiseBurst(1, 25, 1000), silence(0x14), noiseBurst(1, 25, 1500)],
  // Bump de pared a pie: beep(freq=0xa5, dur=0xc8), idéntico en MAINOUT 0x0344
  // (overworld) y TOWN 0x0849 (pueblo). Hz/env reales →AV.
  "move-blocked": () => [beep(0xa5, 0xc8)],
  // Trampas / búsqueda (§4.6/§4.8, re-derivadas por el carril audio-costuras).
  "search-fail": () => [noiseBurst(40, 3000, 500)],
  // Trampa de cofre DISPARADA: el despachador kernel 0x2fd0 abre con
  // NB(0x28,0xbb8,0x1f4) @0x2fe3 INCONDICIONAL (mismos params que el spring del
  // search, SJOG 0x237). El modelo previo NB(1,50,3500) era la atribución suelta
  // «gotas/eco» de §4.6 — esos params son en realidad el blip de aflicción por
  // campo (DUNGEON 0x99e/0xa30 → cue `field-afflict`).
  "dungeon-trap": () => [noiseBurst(40, 3000, 500)],
  // Choque con campo eléctrico (DUNGEON 0x0470): NB(1,0x1f4,0x4e20) @0x4b9.
  "dungeon-zap": () => [noiseBurst(1, 500, 20000)],
  // Miembro dormido/envenenado por campo (DUNGEON @0x99e/@0xa30): NB(1,0x32,0xdac).
  "field-afflict": () => [noiseBurst(1, 50, 3500)],
  // «Failed!» de Uus/Des Por (DUNGEON 0x1ce4): glide(0x320→0x7d0, 1, 0x32).
  "dungeon-fail": () => [glide(800, 2000, 1, 50)],
  // "Borrowed!" al coger la antorcha de pared con (G)et (SJOG 0x1a21):
  // call 0x842e(0x32, 1, 0x7d0, 0x320) = glide(0x320→0x7d0, 1, 0x32).
  "torch-borrowed": () => [glide(800, 2000, 1, 50)],
  // La APARICIÓN del campamento (§4.7a).
  "apparition-materialize": () => [toneSweep(0xa3c, 1, 10000, 2500, 6)],
  "apparition-arpeggio": () => ARPEGGIO_NOTES.map((note) => toneSweep(note, 1, 5000, 200, 13)),
  "apparition-heal-chime": () => [toneSweep(0x157c, 1, 5000, 200, 13)],
  "apparition-chord": () => [toneSweep(0x157c, 1, 60000, 2500, 1)],
  // TRUENO de la resurrección de LB ("There is a peal of thunder!", BLCKTHRN 0x0acc/0x0acf
  // `call 0x8de2` ×2). La rutina 0x8de2 está por encima del techo del disasm kernel (0x86ee)
  // → params Clase C, calibrados al testigo: un BOOM grave y sostenido (banda baja, larga
  // duración), más pesado que el `intro-thunder` del moongate. Se emite una vez por peal.
  "refuge-thunder": () => [noiseBurst(1, 260, 220), noiseBurst(1, 180, 90)],
  // Canción de laúd de Iolo (FASE 1 del camp). Por el CANAL SPEAKER (el original la emite por
  // tonos de PC-speaker, no por driver de música). La MELODÍA (índices) y la TABLA DE FREQ son
  // los BYTES EXACTOS del binario (DATA.OVL 0x6a58 + 0x6a44; motor kernel 0x42d2 modo 4). Cada
  // índice ocupa un slot de tiempo IGUAL (~142 ms, witness-derived, Clase C): una NOTA suena a
  // pitch CONSTANTE `incToHz(freq)` (bardNote) ~77 ms y deja un hueco; un REST (índice 0, el
  // `0x42df cmp 0; je` del motor salta el sweep) es un slot de silencio. Total ~7.5 s = la fase
  // canción visual (CAMP_SONG_MS deriva de este cue → el audio NUNCA se derrama en la caminata).
  // Recorre BARD_CAMP_MELODY (índices 1..52), NO la tabla entera: el cursor arranca
  // sembrado a 1 y sólo hay 52 redibujos. Ver BARD_CAMP_MELODY arriba (ficha #39).
  "bard-song": () =>
    BARD_CAMP_MELODY.flatMap((i) =>
      i === 0
        ? [pauseMs(BARD_INDEX_MS)] // rest = un slot completo de silencio
        : [bardNote(i), pauseMs(BARD_INDEX_MS - BARD_NOTE_TONE_MS)], // nota + hueco hasta el slot
    ),
  // ENDGAME (#34): el cue `endgame-beep` (zumbido 70 Hz) fue RETIRADO — modelaba el
  // ARTEFACTO del host, no al juego (adenda fanfarria-re 2026-07-22, re/notes/
  // fanfarria-endgame-espectral.md §3/§5): 0x3ae6 es RUN-N-FRAMES (pausa MUDA de
  // n ticks ≈ n·55 ms; el «rumble grave» medido en el testigo era la firma que ese
  // DOSBox da a los bucles de espera, no un sonido del binario). Las pausas las
  // modela ahora el PACER (delayUnits/cadencia de frames), sin cue. Los únicos
  // sonidos reales de la fase final: paso de sprite (`move-step`, 0x04fe→0x433e→
  // 0x223c) y los dos sweeps 0x7f02 (orb 0x0987; «lives!» 0x078f, sin cablear).
  // Barrido del lanzamiento del Orb (ENDGAME 0x0973): params EXACTOS del asm —
  // tone_sweep(0x1450, 1, 50000, 10000, 1) vía 0x7f02.
  "endgame-orb": () => [toneSweep(0x1450, 1, 50000, 10000, 1)],
};

/** Expande un cue lógico a sus segmentos (capa PURA, sin audio). */
export function renderCue(cue: SfxCue): SfxSeg[] {
  const fn = SFX_CATALOG[cue.id];
  return fn ? fn(cue.n) : [];
}

/** Duración total (ms) de un cue: suma de sus segmentos. Útil para tests/encadenado. */
export function cueDurationMs(cue: SfxCue): number {
  return renderCue(cue).reduce((acc, s) => acc + s.ms, 0);
}

// ── Capa de AUDIO ───────────────────────────────────────────────────────────

/** Ganancia de pico de cada segmento (el square es fuerte; se mantiene discreto). */
const PEAK_GAIN = 0.12;
/** Rampa de ataque/relajación de los TONOS sostenidos (evita clicks del cuadrado). */
const EDGE_S = 0.004;
/**
 * Rampa de puerta del RUIDO: casi instantánea (task #72-re). El burst del speaker es
 * la apertura/cierre ABRUPTO del gate; su transiente ES el sonido (la cascada real
 * tiene crest 6.43 full-file, no un ataque suave). Con el EDGE_S de 4 ms un burst de
 * ~3.5 ms se triangulaba a ~1 ms (duty 0.9 % vs 6.4 % real, mitad de bursts audibles).
 * Un borde de 0.2 ms mantiene el burst a su duración plena y su ataque seco.
 */
const NOISE_EDGE_S = 0.0002;
/**
 * EL RUIDO ES UNIPOLAR (task #72-re — REFUTA el modelo bipolar anterior). El altavoz
 * PC es MONOPOLO: el gate del PIT sólo empuja el cono (0 → +V), nunca tira (no hay −V).
 * La captura real de la cascada (`ultima_001.wav`) lo confirma con evidencia REPRODUCIBLE:
 * asimetría de energía E+/E− = 22.4× (min −353 vs max +9700 = 27:1 a fondo de escala),
 * y dentro de un burst 93 % de muestras positivas — NO una cuadrada bipolar de media cero.
 * (El DC full-file es +0.0002 ≈ 0 porque el capturador acopla AC y hay 94 % de silencio
 * entre bursts; la unipolaridad NO se ve en el DC medio sino en la asimetría de energía.)
 * La consecuencia es ACÚSTICA y era el gran desajuste: un burst unipolar es un PEDESTAL de
 * DC recortado por la ventana de ~3.5 ms, cuyo espectro es un sinc centrado en continua
 * (lóbulo ~270 Hz) → la mayoría de la energía por debajo de 300 Hz (el "chuff"/retumbo
 * grave; 82 % en base burst-train). El modelo BIPOLAR anterior tenía DC cero, así que TODA
 * su energía caía en la portadora [100,band] → cascada centroide 1000 Hz vs 458 Hz real y
 * paso 1094 Hz vs 554 Hz real (medido en el navegador, base declarada en §NOISE_LOWPASS_HZ)
 * → siseo tonal brillante, el "no se parece" del usuario. Se implementa con un WaveShaper
 * que mapea el cuadrado ±1 → 0/+1 (curva [0,0,1]: negativo y silencio→0, positivo→1 =
 * puerta abierta). Los TONOS sostenidos (beep/glide/sweep) NO se tocan (su DC es constante
 * e inaudible; su contenido audible es idéntico bipolar o unipolar).
 */
const NOISE_UNIPOLAR_CURVE = new Float32Array([0, 0, 1]);
/**
 * Paso-bajo del RUIDO = rolloff del cono del altavoz (BiquadFilter lowpass, 2 polos,
 * task #72-re). CALIBRADO CONTRA LA SALIDA REAL DEL NAVEGADOR (OfflineAudioContext con
 * este mismo SpeakerSynth), NO contra el render offline — el `square` de Web Audio es
 * BANDA-LIMITADO y repica en las transiciones, así que suena más brillante que un
 * cuadrado crudo (lección de #72: el offline y el navegador DIVERGEN; el juez es lo que
 * suena en el navegador). BASE DE MEDIDA declarada (centroide = media ponderada por
 * energía del espectro Hann): cascada en base BURST-TRAIN (concatenando sólo las
 * regiones de burst, umbral 0.25·env-max) — es la comparación apples-to-apples port↔real;
 * paso en base full-file de la región activa. Con LP 2100 Hz la salida real del navegador
 * da: cascada centroide 407 Hz (real burst-train 458 Hz) y paso ~535 Hz (real full 554 Hz).
 * NOTA de reproducibilidad: el PASO es un solo disparo de ~50 ms con 2 bursts y frecuencias
 * ALEATORIAS del PRNG por render → su centroide VARÍA (offline: media 569 Hz, sd 45 Hz,
 * rango 504–682 sobre 15 draws); el real 554–602 cae dentro. El ANCLA estable es la
 * cascada (tren de 116 bursts promedia el PRNG). En base FULL-FILE la cascada real da 708 Hz
 * (cf. §7.4; el navegador full-file 467 Hz — ver CABO abajo). El grave lo aporta el pedestal
 * DC del burst UNIPOLAR; el LP sólo quita el repique de banda-limitada y modela el cono.
 * (Era 1500 con el modelo bipolar, que sonaba a ~1000 Hz de siseo tonal — el "no se parece".)
 *
 * CABO (overshoot hacia grave, task #72-re): a LP 2100 el port pierde el "sizzle" >3 kHz que
 * el real SÍ tiene (real banda 3–5 kHz 3.4 % vs port ~1.4 %; por eso el real full-file sube
 * a 708 Hz y el port sólo a 467). El burst unipolar ya da el retumbo correcto, pero el port
 * queda algo MÁS oscuro que el real. VÍA (no aplicar sin nueva captura): subir el LP y añadir
 * un shelf agudo que devuelva el >3 kHz sin perder el dominio grave. NO se retoca a ciegas.
 */
const NOISE_LOWPASS_HZ = 2100;
/**
 * Paso-alto del RUIDO = acoplamiento AC del altavoz (BiquadFilter highpass, 2 polos,
 * ~20 Hz, task #72-re). Sangra la continua ESTÁTICA del gate unipolar (que no es sonido y
 * desperdicia headroom) pero deja intacto el pedestal transitorio del burst (energía
 * 18–300 Hz). El espejo offline usa un biquad RBJ de 2 polos idéntico.
 */
const NOISE_HIGHPASS_HZ = 20;

/**
 * CUES CUYO EMISOR EN EL BINARIO BLOQUEA EL BUCLE (#206, ampliado por #212).
 *
 * 🔴 DECLARACIÓN DE HONESTIDAD, porque esta lista es más estrecha que la regla que la
 * justifica: en el original **TODO** el audio bloquea — un solo hilo, y cada primitiva del
 * altavoz gira hasta acabar antes de devolver el control. La regla es GLOBAL. Aquí se aplica
 * sólo a los cues DONDE SE MIDIÓ el daño, porque generalizarla toca cada sonido del juego
 * —golpes, pisadas, ambiente— y esa clase tiene veredictos de audio firmados detrás
 * (calibración #26/#29, el testigo del clavicémbalo, la pisada §3.6). ★ #208 cerró la parte
 * de FASE ENTRE CANALES de esa generalización — un cue puede esperar a los VISUALES que lo
 * preceden en su lote (`planTurnPhase.sfxLeadMs` → `playSegs(…, leadMs)`, la fanfarria del
 * ritual tras sacudida y explosión) — pero el encadenado GLOBAL por cue (que TODO sonido
 * encadene con todo) sigue FUERA, con su ventana y su población de regresión. Esto no es la
 * regla del binario: es su aplicación acotada, y la lista CRECE CON NOMBRE Y RAZÓN, nunca
 * de rebote.
 *
 * LA LISTA, con por qué está cada uno:
 *  · `shard-sweep`     — barrido del ritual (CAST 0x15dd-0x162a), 7,13 s. #206: reporte del
 *                        usuario en el deploy #21 («se oía colgado» = tres cues apilados).
 *  · `victory-fanfare` — 0x4368, 2,09 s. Entró en #206 por la COLA DEL RITUAL (CAST 0x1759);
 *                        #212 le añade el segundo llamador del binario, la VICTORIA del arena
 *                        (COMBAT 0x0d02), que es donde el usuario oyó la pausa. Mismo cue,
 *                        misma razón: la lista NO se ensancha, se ensancha su alcance de uso.
 *
 * 🔴 ESTA LISTA TIENE DOS CONSUMIDORES y por eso vive fuera de `SpeakerSynth`: el encadenado
 * de AUDIO (`playSegs`, aquí) y la PAUSA DE JUEGO (`ui/combat-pacer.ts`, #212). Son los dos
 * lados del mismo hecho —el emisor gira hasta acabar—, así que se leen de UNA fuente: dos
 * listas con el mismo contenido son dos listas que un día divergen.
 */
export const BLOCKING_CUES: ReadonlySet<string> = new Set<string>([
  "shard-sweep",
  "victory-fanfare",
]);

/**
 * CUES QUE SE ENCADENAN EN EL AUDIO — superconjunto de `BLOCKING_CUES` (#345).
 *
 * 🔴 POR QUÉ SON DOS LISTAS Y NO UNA. Hasta #345 sólo había `BLOCKING_CUES`, y con razón: en
 * 1988 **encadenar y pausar son la misma cosa**, porque el audio ES el reloj (un solo hilo,
 * cada primitiva gira hasta acabar). En el port son DOS propiedades con ALCANCES distintos, y
 * unirlas obligaba a comprar la una para tener la otra:
 *   · ENCADENAR (aquí) — `playSegs` arranca el cue en `max(currentTime, tail)`: es sólo el
 *     orden de la mezcla, no toca al jugador.
 *   · PAUSAR (`BLOCKING_CUES`) — `main.ts` arma además `combatPacer.armBlockingPause`, que
 *     CONGELA el juego la duración del cue y **tira las teclas encoladas** (0x1b16).
 * El WELL DONE necesitaba lo primero y NO lo segundo: meter `quake` en `BLOCKING_CUES` habría
 * congelado el juego 930 ms y comido teclas en CADA terremoto (clavicémbalo, palabra de poder,
 * In Vas Por Ylem, catarata), y `shrine-well-done` habría metido 5,35 s de pausa dentro de un
 * rito que ya pacean `shrineScenePacer` y las once esperas de tecla de #294 — dos relojes
 * discutiendo. `BLOCKING_CUES` conserva sus DOS miembros exactos: no crece de rebote.
 *
 * LOS DOS QUE ENTRAN, con su razón (CAST2 0x0c44-0x0c88):
 *   · `shrine-well-done` — los dos barridos del altar, 0x0c44-0x0c85.
 *   · `quake` — la sacudida de 0x0c88, que en el binario va DESPUÉS del `jl` que cierra los
 *     barridos: están SERIALIZADAS por construcción. El port las arrancaba las dos en
 *     `currentTime` y el trueno (930 ms, −28,6 dB) quedaba 21,1 dB por debajo del tono del
 *     altar (5,35 s, −20,0 dB) — el «no oigo el trueno» del 16-08. Es la MISMA divergencia de
 *     ORDEN que #330(B) arregló en lo visual, en el otro canal.
 * ⚠ El nivel bajo del trueno es un AGRAVANTE MEDIDO aparte (la ruta del ruido entera va 6-9 dB
 * bajo la tonal por el gate unipolar), NO la causa: hay cues más flojos que se oyen sin queja
 * —`move-step` a −34,0 dB— porque suenan en SILENCIO. Si tras esta serialización el trueno
 * siguiera flojo, el sujeto es la ruta del ruido (22 cues) y es ficha aparte, no un retoque aquí.
 */
export const CHAINED_CUES: ReadonlySet<string> = new Set<string>([
  ...BLOCKING_CUES,
  "shrine-well-done",
  "quake",
]);

/**
 * `SpeakerSynth` — agenda `SfxSeg[]` en un `AudioContext`. Sin estado de juego;
 * un `OscillatorNode` "square" por segmento con envolvente de ganancia. El
 * `AudioContext` se INYECTA (un contexto falso permite testear el agendado sin
 * navegador).
 */
export class SpeakerSynth {
  constructor(
    private ctx: AudioContext,
    private destination: AudioNode = ctx.destination,
  ) {}

  /**
   * CUES QUE SE ENCADENAN ENTRE SÍ en vez de solaparse (#206) — la lista y su declaración de
   * alcance viven en `CHAINED_CUES` (arriba).
   *
   * Lo que se arregla aquí: `playSegs` arrancaba SIEMPRE en `currentTime`, así que los cues se
   * apilaban en el mismo instante. Los tres del ritual sonaban superpuestos desde T y lo que
   * el usuario oía «colgado» era la cola del más largo. No es que el audio fuera por detrás:
   * es que nunca esperó a nada.
   *
   * 🔴 LEE `CHAINED_CUES`, NO `BLOCKING_CUES` (#345). Hasta #345 eran la misma lista y por eso
   * aquí ponía `BLOCKING_CUES`: encadenar audio y pausar juego iban juntos. No pueden seguir
   * juntos — el WELL DONE necesita el encadenado y NO la pausa (que congelaría el rito 5,35 s
   * y se comería teclas). `BLOCKING_CUES ⊆ CHAINED_CUES`: todo lo que pausa encadena, no al
   * revés. La razón completa, en el docblock de `CHAINED_CUES`.
   */
  private static readonly BLOCKING = CHAINED_CUES;

  /** Instante (reloj del `AudioContext`) en que acaba el último cue BLOQUEANTE agendado. */
  private tail = 0;

  /**
   * Reproduce un cue lógico (lo expande y encadena sus segmentos).
   *
   * ★ #208 — `leadMs` es la espera de FASE del lote (ms desde ahora): la calcula
   * `planTurnPhase` recorriendo el lote de turno (los visuales que preceden al cue — la
   * sacudida, la explosión — empujan su arranque, igual que en 1988 el hilo único no
   * llegaba al `sfx_victory_fanfare` de CAST 0x1759 hasta acabar las explosiones), y la
   * trae el bus (`onSfx(cue, leadMs)`). Default 0 = los caminos sin lote (combate,
   * casting, ambiente) quedan exactamente donde estaban.
   */
  play(cue: SfxCue, leadMs = 0): void {
    this.playSegs(renderCue(cue), SpeakerSynth.BLOCKING.has(cue.id), leadMs);
  }

  /**
   * Encadena una lista de segmentos. Los cues NO bloqueantes arrancan en `currentTime`, como
   * siempre; los bloqueantes esperan a que acabe el bloqueante anterior y corren el testigo.
   *
   * ★ #208 — el `leadMs` de fase y el `tail` de #206 se componen por MAX, no se suman: son
   * dos lecturas del MISMO hecho (todo lo anterior del hilo de 1988 tiene que acabar), una
   * desde el lote y otra desde la cola de audio; sumarlas contaría dos veces al barrido.
   */
  playSegs(segs: readonly SfxSeg[], blocking = false, leadMs = 0): void {
    let t = this.ctx.currentTime + leadMs / 1000;
    if (blocking) t = Math.max(t, this.tail);
    for (const seg of segs) t = this.scheduleSeg(seg, t);
    if (blocking) this.tail = t;
  }

  private scheduleSeg(seg: SfxSeg, startT: number): number {
    // Barrido MUDO (#137): un glide con total ≤ 0 no da ni una vuelta en el binario
    // (jl firmado, DUNGEON 0x1483 con n ≥ 3) — ni oscilador ni avance de tiempo.
    if (seg.kind === "tone" && seg.ms === 0) return startT;
    const dur = Math.max(0.001, seg.ms / 1000);
    const end = startT + dur;
    // Hueco de silencio (gate cerrado): sólo avanza el tiempo, sin oscilador.
    if (seg.kind === "silence") return end;
    const osc = this.ctx.createOscillator();
    osc.type = "square";
    const gain = this.ctx.createGain();
    // El RUIDO: cuadrado → WaveShaper unipolar (0/+1, el gate monopolo del altavoz) →
    // ganancia (pedestal DC recortado por la ventana = el "chuff" grave) → paso-alto
    // (acopla AC) → paso-bajo (rolloff del cono). Los TONOS sostenidos van directos.
    if (seg.kind === "noise") {
      const shaper = this.ctx.createWaveShaper();
      shaper.curve = NOISE_UNIPOLAR_CURVE;
      osc.connect(shaper);
      shaper.connect(gain);
      const hp = this.ctx.createBiquadFilter();
      hp.type = "highpass";
      hp.frequency.value = NOISE_HIGHPASS_HZ;
      const lp = this.ctx.createBiquadFilter();
      lp.type = "lowpass";
      lp.frequency.value = NOISE_LOWPASS_HZ;
      gain.connect(hp);
      hp.connect(lp);
      lp.connect(this.destination);
    } else {
      osc.connect(gain);
      gain.connect(this.destination);
    }

    // Envolvente trapezoidal: los tonos con borde suave (no chasquear), el ruido con
    // puerta casi instantánea (su transiente ES el sonido — ver NOISE_EDGE_S).
    const g = gain.gain;
    const edge = Math.min(seg.kind === "noise" ? NOISE_EDGE_S : EDGE_S, dur / 2);
    g.setValueAtTime(0.0001, startT);
    g.exponentialRampToValueAtTime(PEAK_GAIN, startT + edge);
    g.setValueAtTime(PEAK_GAIN, Math.max(startT + edge, end - edge));
    g.exponentialRampToValueAtTime(0.0001, end);

    if (seg.kind === "tone") {
      if (seg.steps && seg.steps.length > 0) {
        // ESCALERA del glide 0x43ae (#137): un `setValueAtTime` por vuelta del bucle — el
        // PIT salta de divisor en divisor (0x22e2 reescribe, el registro retiene entre
        // escrituras); jamás rampa, y la nominal `fin` nunca se escribe.
        const stepDur = dur / seg.steps.length; // delay(1, paso) constante ⇒ equiespaciados
        seg.steps.forEach((f, i) => osc.frequency.setValueAtTime(f, startT + i * stepDur));
      } else {
        osc.frequency.setValueAtTime(seg.f0, startT);
        if (seg.f1 !== seg.f0) osc.frequency.linearRampToValueAtTime(seg.f1, end);
      }
    } else if (seg.freqs.length > 0) {
      // Ruido: conmuta rápidamente la frecuencia del cuadrado por los valores del
      // PRNG (así suena el ruido del speaker real — sin buffer de samples).
      const stepDur = dur / seg.freqs.length;
      seg.freqs.forEach((f, i) => osc.frequency.setValueAtTime(f, startT + i * stepDur));
    }
    osc.start(startT);
    osc.stop(end);
    return end;
  }
}

/** Clave del toggle persistente (localStorage). Default: ON en la piel fiel. */
export const SPEAKER_STORAGE_KEY = "u5.speaker";

/** ¿Está el speaker activado? Lee localStorage; por defecto ON. Nunca lanza. */
export function speakerEnabled(store: Pick<Storage, "getItem"> | undefined = safeStorage()): boolean {
  try {
    return store?.getItem(SPEAKER_STORAGE_KEY) !== "0";
  } catch {
    return true;
  }
}

/** Persiste el toggle del speaker. Nunca lanza (modo privado, cuota…). */
export function setSpeakerEnabled(
  enabled: boolean,
  store: Pick<Storage, "setItem"> | undefined = safeStorage(),
): void {
  try {
    store?.setItem(SPEAKER_STORAGE_KEY, enabled ? "1" : "0");
  } catch {
    /* almacenamiento no disponible: el toggle vive sólo en memoria (SpeakerAudio) */
  }
}

function safeStorage(): Storage | undefined {
  try {
    return typeof localStorage !== "undefined" ? localStorage : undefined;
  } catch {
    return undefined;
  }
}

/** Fábrica de AudioContext inyectable (para tests). Devuelve `null` si no hay Web Audio. */
export type AudioContextFactory = () => AudioContext | null;

function defaultAudioFactory(): AudioContext | null {
  const Ctor =
    typeof AudioContext !== "undefined"
      ? AudioContext
      : (globalThis as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  return Ctor ? new Ctor() : null;
}

/**
 * `SpeakerAudio` — el ciclo de vida del speaker para la piel fiel: crea el
 * `AudioContext` PEREZOSAMENTE en el primer `play` (los navegadores exigen un
 * gesto de usuario), respeta el toggle persistente y jamás rompe el juego si no
 * hay Web Audio (headless/SSR). La piel fiel instancia uno y le enruta `onSfx`.
 */
export class SpeakerAudio {
  private ctx: AudioContext | null = null;
  private synth: SpeakerSynth | null = null;
  private _enabled: boolean;

  constructor(private makeContext: AudioContextFactory = defaultAudioFactory) {
    this._enabled = speakerEnabled();
  }

  get enabled(): boolean {
    return this._enabled;
  }

  /** Cambia el toggle (persistente). Al apagar, no reproduce nada. */
  setEnabled(on: boolean): void {
    this._enabled = on;
    setSpeakerEnabled(on);
    if (!on) void this.ctx?.suspend?.();
  }

  toggle(): boolean {
    this.setEnabled(!this._enabled);
    return this._enabled;
  }

  /**
   * Reproduce un cue si el speaker está activo y Web Audio disponible. Nunca lanza.
   * `leadMs` = espera de fase del lote (#208, ver `SpeakerSynth.play`); default 0.
   */
  play(cue: SfxCue, leadMs = 0): void {
    if (!this._enabled) return;
    try {
      const synth = this.ensure();
      if (synth) synth.play(cue, leadMs);
    } catch {
      /* audio no disponible: silencio, el juego sigue */
    }
  }

  /**
   * Desbloquea Web Audio desde un GESTO de usuario. Los navegadores sólo permiten
   * crear/reanudar un `AudioContext` dentro de un handler de gesto (keydown/pointerdown);
   * el demo del attract dispara sus cues desde el rAF, no desde un gesto, así que sin
   * esto el contexto nace `suspended` y todo el audio del demo es mudo. Llamar aquí en el
   * PRIMER gesto deja el contexto vivo para los `play()` posteriores. Idempotente
   * (`ensure` memoiza) y no reproduce nada. Si el toggle está apagado, no fuerza contexto.
   */
  unlock(): void {
    if (!this._enabled) return;
    try {
      this.ensure();
    } catch {
      /* sin Web Audio: silencio, el juego sigue */
    }
  }

  private ensure(): SpeakerSynth | null {
    if (this.synth) {
      if (this.ctx?.state === "suspended") void this.ctx.resume?.();
      return this.synth;
    }
    const ctx = this.makeContext();
    if (!ctx) return null;
    this.ctx = ctx;
    if (ctx.state === "suspended") void ctx.resume?.();
    this.synth = new SpeakerSynth(ctx);
    return this.synth;
  }

  /** Libera el AudioContext (al desmontar la piel). */
  dispose(): void {
    void this.ctx?.close?.();
    this.ctx = null;
    this.synth = null;
  }
}
