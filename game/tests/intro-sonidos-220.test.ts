/**
 * #220 — LOS DOS SONIDOS DE LA PANTALLA DE TÍTULO.
 *
 * Ninguna cifra de este fichero está escrita a mano contra el binario: todas se
 * RE-EXTRAEN de `re/disasm/EGA.DRV.asm` (y una de `re/disasm/ULTIMA.EXE.asm`) en cada
 * corrida y se carean contra las constantes del port. Si el disasm se regenera y una
 * dirección se mueve, este fichero se pone rojo NOMBRANDO la fila — no calla.
 *
 * POR QUÉ EL DRIVER Y NO EL KERNEL. `intro-av-211-derivacion.md §4` cerró con «el emisor
 * vive en el KERNEL — sin identificar, ficha #220» tras censar ULTIMA.EXE y los 24
 * overlays con `dispatch_table.near_calls_to_kernel`. El censo era correcto y su
 * conclusión falsa por POBLACIÓN: los cuatro `*.DRV` (~36 KB, «sin RE» desde
 * `intro-ovl-map.md §1.2`) no estaban dentro. Los cuatro escriben a `out 0x61/0x42`.
 *
 * ESTRUCTURA DEL EMISOR (`EGA.DRV`), leída entera:
 *   0x27af  drv_noise_burst — `cs:[0x27ad]=0`; gate ON; PRNG local `cs:[0x27a5]`;
 *           freq = 0x1234de / valor∈[0x64, cs:[0x27a7]/2]; `out 0x42`; retardo;
 *           repite hasta `cs:[0x27ad] >= cs:[0x27a9]` sumando `cs:[0x27ab]`.
 *           ⇒ es `noise_burst(step=[0x27ab], dur=[0x27a9], band=[0x27a7])` con la MISMA
 *           forma que el del kernel (`ULTIMA.EXE:0x223c`) salvo el `shr cx,1` de 0x27d9.
 *   0x269f  llamada desde el dissolve de pantalla (sel 0x66) — el FIZZLE del logo.
 *   0x29c5  llamada desde el dissolve del subtítulo (sel 0x69) — el CREPITAR.
 */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { noiseBurst, pitHz, SFX_CATALOG } from "../src/skin/fiel/speaker.js";
import {
  DRIVER_NOISE_SEED,
  driverNoisePrng,
  newTitleSoundState,
  restartCrackleStage,
  SUBTITLE_CRACKLE_BAND,
  SUBTITLE_CRACKLE_DUR,
  SUBTITLE_CRACKLE_MASK,
  SUBTITLE_CRACKLE_PIXELS_PER_TICK,
  SUBTITLE_CRACKLE_THRESHOLD0,
  SUBTITLE_CRACKLE_THRESHOLD_STEP,
  subtitleCrackleTicks,
  TITLE_FIZZLE_BAND0,
  TITLE_FIZZLE_BURSTS_PER_CUE,
  TITLE_FIZZLE_PIXELS_PER_BURST,
  titleFizzleCues,
} from "../src/skin/fiel/introAnim.js";

const EGA = readFileSync(new URL("../../re/disasm/EGA.DRV.asm", import.meta.url), "utf8");
const KERNEL = readFileSync(new URL("../../re/disasm/ULTIMA.EXE.asm", import.meta.url), "utf8");

/** Mapa offset → byte reconstruido de la COLUMNA HEX del disasm (no del binario). */
function byteMap(asm: string): Map<number, number> {
  const out = new Map<number, number>();
  for (const line of asm.split("\n")) {
    const m = /^([0-9a-f]{4}): ([0-9a-f]+)\s/.exec(line);
    if (!m) continue;
    const at = parseInt(m[1]!, 16);
    const hex = m[2]!;
    for (let i = 0; i * 2 < hex.length; i++) out.set(at + i, parseInt(hex.slice(i * 2, i * 2 + 2), 16));
  }
  return out;
}
function word(map: Map<number, number>, at: number): number {
  const lo = map.get(at);
  const hi = map.get(at + 1);
  expect(lo, `sin byte en ${at.toString(16)}`).toBeDefined();
  expect(hi, `sin byte en ${(at + 1).toString(16)}`).toBeDefined();
  return lo! | (hi! << 8);
}
/** Inmediato de `mov word ptr cs:[dst], imm` en la fila `at`. Rojo si la fila no existe. */
function movImm(asm: string, at: number, dst: number): number {
  const re = new RegExp(
    `^${at.toString(16).padStart(4, "0")}: [0-9a-f]+\\s+mov word ptr cs:\\[0x${dst.toString(16)}\\], (0x[0-9a-f]+|\\d+)$`,
    "m",
  );
  const m = re.exec(asm);
  expect(m, `EGA.DRV:0x${at.toString(16)} ya no es \`mov cs:[0x${dst.toString(16)}], imm\``).not.toBeNull();
  return Number(m![1]);
}
function hasLine(asm: string, at: number, text: string): boolean {
  const re = new RegExp(`^${at.toString(16).padStart(4, "0")}: [0-9a-f]+\\s+${text}$`, "m");
  return re.test(asm);
}

const EGA_BYTES = byteMap(EGA);

describe("#220 · el emisor de los dos sonidos del título vive en EGA.DRV", () => {
  it("el crepitar del subtítulo re-extrae band=0xbb8 y dur=0x19 JUNTO a su call", () => {
    // Los dos `mov` y el `call` son contiguos: 0x29b7 · 0x29be · 0x29c5.
    expect(movImm(EGA, 0x29b7, 0x27a7)).toBe(SUBTITLE_CRACKLE_BAND);
    expect(movImm(EGA, 0x29be, 0x27a9)).toBe(SUBTITLE_CRACKLE_DUR);
    expect(hasLine(EGA, 0x29c5, "call 0x27af")).toBe(true);
  });

  it("`step` del crepitar es 1 porque NADIE escribe cs:[0x27ab] en todo el driver", () => {
    // Censo con CONTROL POSITIVO: el mismo patrón SÍ encuentra los escritores de 0x27a7.
    const escritores = (dst: number) =>
      (EGA.match(new RegExp(`mov word ptr cs:\\[0x${dst.toString(16)}\\],`, "g")) ?? []).length;
    expect(escritores(0x27a7)).toBeGreaterThan(0); // control: el band SÍ se escribe
    expect(escritores(0x27ab)).toBe(0); // el step se queda con el valor de la imagen
    expect(word(EGA_BYTES, 0x27ab)).toBe(1);
  });

  it("el fizzle del logo: 1 ráfaga cada 2 píxeles y la banda sube de 1 en 1 desde 0xf0", () => {
    expect(hasLine(EGA, 0x2691, "xor word ptr cs:\\[0x253f\\], 1")).toBe(true); // alternancia
    expect(hasLine(EGA, 0x269f, "call 0x27af")).toBe(true);
    expect(hasLine(EGA, 0x26a2, "inc word ptr cs:\\[0x27a7\\]")).toBe(true); // banda \\+\\+
    expect(TITLE_FIZZLE_PIXELS_PER_BURST).toBe(2); // = la alternancia de arriba
    expect(word(EGA_BYTES, 0x27a7)).toBe(TITLE_FIZZLE_BAND0); // banda inicial de la imagen
  });

  it("el subtítulo son DOS etapas con el umbral REINICIADO, y el umbral baja de 3 en 3", () => {
    expect(movImm(EGA, 0x2909, 0x28c4)).toBe(SUBTITLE_CRACKLE_THRESHOLD0); // etapa 1
    expect(movImm(EGA, 0x2915, 0x28c4)).toBe(SUBTITLE_CRACKLE_THRESHOLD0); // etapa 2
    expect(hasLine(EGA, 0x2921, "call 0x296a")).toBe(true); // la 2ª llamada al bucle
    const dec = /^29a3: [0-9a-f]+\s+sub word ptr cs:\[0x28c4\], (\d+)$/m.exec(EGA);
    expect(dec, "EGA.DRV:0x29a3 ya no decrementa el umbral").not.toBeNull();
    expect(Number(dec![1])).toBe(SUBTITLE_CRACKLE_THRESHOLD_STEP);
    const mask = /^29ad: [0-9a-f]+\s+and ax, (0x[0-9a-f]+)$/m.exec(EGA);
    expect(mask, "EGA.DRV:0x29ad ya no enmascara el sorteo").not.toBeNull();
    expect(Number(mask![1])).toBe(SUBTITLE_CRACKLE_MASK);
    // Píxeles por tick: la imagen trae 0x80 y la rama de máquina lenta escribe 0x100.
    expect(word(EGA_BYTES, 0x2968)).toBe(SUBTITLE_CRACKLE_PIXELS_PER_TICK);
    expect(movImm(EGA, 0x28d3, 0x2968)).toBe(SUBTITLE_CRACKLE_PIXELS_PER_TICK * 2);
  });

  it("🔴 EL DISCRIMINANTE: el driver PARTE la banda por 2 y el kernel NO", () => {
    // Es la única diferencia estructural entre los dos `noise_burst`, y la que obliga
    // al `>> 1` de los cues. Se comprueba en los DOS lados, no en uno.
    expect(hasLine(EGA, 0x27d9, "shr cx, 1")).toBe(true);
    expect(hasLine(EGA, 0x27d4, "mov cx, word ptr cs:\\[0x27a7\\]")).toBe(true);
    // Kernel `noise_burst` 0x223c: carga el band y resta el piso SIN desplazar.
    expect(hasLine(KERNEL, 0x226b, "mov cx, word ptr \\[bp \\+ 4\\]")).toBe(true);
    expect(hasLine(KERNEL, 0x226e, "sub cx, bx")).toBe(true);
    expect(hasLine(KERNEL, 0x2270, "shr cx, 1")).toBe(false); // NO está: la banda va entera
  });

  it("el PRNG del driver es el mismo algoritmo que el del speaker del kernel", () => {
    for (const at of [0x2a07, 0x2a10, 0x2a13]) {
      expect(EGA.includes(`\n${at.toString(16)}: `), `falta la fila 0x${at.toString(16)}`).toBe(true);
    }
    expect(hasLine(EGA, 0x2a07, "add ax, 0x9248")).toBe(true);
    expect(hasLine(EGA, 0x2a10, "xor ax, 0x9248")).toBe(true);
    expect(hasLine(EGA, 0x2a13, "add ax, 0x11")).toBe(true);
    expect(hasLine(KERNEL, 0x2258, "add ax, 0x9248")).toBe(true); // el del kernel, mismo álgebra
    // Y la semilla del port sale de la imagen, no de la cabeza de nadie.
    expect(word(EGA_BYTES, 0x28c2)).toBe(DRIVER_NOISE_SEED);
    expect(driverNoisePrng(0)).toBe((((0x9248 >>> 3) ^ 0x9248) + 0x11) & 0xffff);
  });
});

describe("#220 · el port emite con la cadencia y los parámetros derivados", () => {
  it("el fizzle emite un cue por cada BURSTS_PER_CUE ráfagas, con la banda creciendo", () => {
    const st = newTitleSoundState();
    const perCue = TITLE_FIZZLE_PIXELS_PER_BURST * TITLE_FIZZLE_BURSTS_PER_CUE;
    expect(titleFizzleCues(perCue - 1, st)).toEqual([]); // aún no llega
    expect(titleFizzleCues(1, st)).toEqual([TITLE_FIZZLE_BAND0 + TITLE_FIZZLE_BURSTS_PER_CUE]);
    expect(titleFizzleCues(perCue * 2, st)).toEqual([
      TITLE_FIZZLE_BAND0 + TITLE_FIZZLE_BURSTS_PER_CUE * 2,
      TITLE_FIZZLE_BAND0 + TITLE_FIZZLE_BURSTS_PER_CUE * 3,
    ]);
    // Nº TOTAL de pulsos = 1 por cada 2 píxeles, que es lo que hace el original.
    const st2 = newTitleSoundState();
    const pixels = perCue * 40;
    const pulsos = titleFizzleCues(pixels, st2).length * TITLE_FIZZLE_BURSTS_PER_CUE;
    expect(pulsos).toBe(pixels / TITLE_FIZZLE_PIXELS_PER_BURST);
  });

  it("el crepitar se RALEA: la 1ª mitad de una etapa suena más que la 2ª", () => {
    const st = newTitleSoundState();
    const ticks = 100;
    const px = SUBTITLE_CRACKLE_PIXELS_PER_TICK * ticks;
    const primera = subtitleCrackleTicks(px, st);
    const segunda = subtitleCrackleTicks(px, st);
    expect(primera).toBeGreaterThan(segunda);
    expect(primera).toBeGreaterThan(0);
    // El umbral ha bajado exactamente 3 por tick consumido (200 ticks).
    expect(st.crackleThreshold).toBe(SUBTITLE_CRACKLE_THRESHOLD0 - SUBTITLE_CRACKLE_THRESHOLD_STEP * 200);
    // Y una etapa nueva lo devuelve al valor de arranque (0x2909/0x2915).
    restartCrackleStage(st);
    expect(st.crackleThreshold).toBe(SUBTITLE_CRACKLE_THRESHOLD0);
  });

  it("los cues del catálogo llevan la banda PARTIDA por 2 (convenio del driver)", () => {
    const crackle = SFX_CATALOG["title-crackle"]!();
    expect(crackle).toHaveLength(1);
    const seg = crackle[0]!;
    expect(seg.kind).toBe("noise");
    if (seg.kind !== "noise") throw new Error("segmento inesperado");
    // dur/step = 0x19 pulsos, y todo el sorteo cae en [0x64, band/2] — el rango del
    // DRIVER, con su `shr cx,1`. (Aquí vivía el cabo «el port usa el valor como Hz y el
    // binario como DIVISOR del PIT ⇒ ley invertida»: REFUTADO por #254, el bloque de
    // abajo. Lo que este `it` vigila —el RANGO del sorteo— no dependía de aquello.)
    expect(seg.freqs).toHaveLength(SUBTITLE_CRACKLE_DUR);
    for (const f of seg.freqs) {
      expect(f).toBeGreaterThanOrEqual(0x64);
      expect(f).toBeLessThanOrEqual(pitHz(SUBTITLE_CRACKLE_BAND >> 1));
    }
    // El fizzle: `n` es la banda del original y el cue trae BURSTS_PER_CUE pulsos.
    const fizzle = SFX_CATALOG["title-fizzle"]!(TITLE_FIZZLE_BAND0);
    expect(fizzle).toHaveLength(1);
    const fs = fizzle[0]!;
    if (fs.kind !== "noise") throw new Error("segmento inesperado");
    expect(fs.freqs).toHaveLength(TITLE_FIZZLE_BURSTS_PER_CUE);
    // Con la banda INICIAL (0xf0 >> 1 = 120) el sorteo vive en una rendija de 20 valores:
    // el fizzle arranca casi TONAL y se va abriendo. Ésa es la forma del barrido.
    for (const f of fs.freqs) expect(f).toBeLessThanOrEqual(pitHz(TITLE_FIZZLE_BAND0 >> 1));
  });

  it("una banda MAYOR ENSANCHA el sorteo: el barrido del fizzle es real, no decorativo", () => {
    const estrecho = SFX_CATALOG["title-fizzle"]!(TITLE_FIZZLE_BAND0);
    const ancho = SFX_CATALOG["title-fizzle"]!(TITLE_FIZZLE_BAND0 + 8000);
    if (estrecho[0]!.kind !== "noise" || ancho[0]!.kind !== "noise") throw new Error("segmento inesperado");
    const max = (xs: readonly number[]) => xs.reduce((a, b) => Math.max(a, b));
    expect(max(ancho[0]!.freqs)).toBeGreaterThan(max(estrecho[0]!.freqs));
    // Y el techo del rango es EXACTAMENTE band/2 en los dos (el `shr` del driver).
    for (const f of ancho[0]!.freqs) expect(f).toBeLessThanOrEqual(pitHz((TITLE_FIZZLE_BAND0 + 8000) >> 1));
  });
});

/**
 * #254 — LA LEY banda→FRECUENCIA DEL RUIDO, fijada contra el binario.
 *
 * 🔴 ESTE BLOQUE EXISTE PORQUE LA FICHA #254 ESTABA INVERTIDA, y la afirmación falsa vivía
 * en tres ficheros del árbol (incluido el comentario de veinte líneas más arriba, ya
 * corregido). La afirmación era: «el port usa el valor sorteado como Hz; el binario lo usa
 * como DIVISOR del PIT ⇒ freq = 0x1234de / valor ⇒ las dos leyes son INVERSAS».
 *
 * Lo que hace el binario, fila a fila (`ULTIMA.EXE:0x223c`, idéntico en `EGA.DRV:0x27af`):
 *   0x2279  `mov cx, ax`      — cx = el valor sorteado v ∈ [0x64, band]
 *   0x227b  `mov dx, 0x12`  ┐
 *   0x227e  `mov ax, 0x34de`┘  dx:ax = 0x1234DE
 *   0x2281  `div cx`           — ax = 0x1234DE / v
 *   0x2283  `out 0x42, al` + 0x2285 `mov al,ah` + 0x2287 `out 0x42, al`
 *
 * El valor SÍ es el divisor de la instrucción `div` — pero el DIVIDENDO es `0x1234DE` =
 * **1.193.182**, que es el RELOJ DE ENTRADA del 8253. Así que el cociente no es una
 * frecuencia: es el **contador** que se escribe en el canal 2 (puerto 0x42, LSB y luego
 * MSB). Y la frecuencia que sale del altavoz es `reloj / contador` = **v**. La ley del
 * binario y la del port son LA MISMA; lo que la ficha llamó «frecuencia efectiva» era el
 * contador. (El propio `speaker.ts` ya lo tenía bien razonado para `set_tone 0x22e2`, que
 * hace la MISMA división: «⇒ freq de salida = arg».)
 *
 * 🔴 EL GUARDA OBVIO ES VACUO — medido, no supuesto. La comprobación natural sería «la
 * frecuencia emitida sobrevive al viaje de ida y vuelta por el PIT»:
 * `f ≈ reloj / floor(reloj / f)`. Pues bien: la ley invertida ES UN PUNTO FIJO de ese
 * predicado (si f = reloj/v, entonces floor(reloj/f) = v y el viaje devuelve f). El
 * mutante pasaría VERDE. Por eso el aserto de abajo se ancla en el VALOR SORTEADO —
 * recomputado desde las constantes del PRNG re-extraídas del disasm — y no en la
 * frecuencia consigo misma; y el último `it` es el control NEGATIVO que enseña que la ley
 * invertida cae, para que nadie tenga que fiarse de este párrafo.
 */
describe("#254 · el valor sorteado del noise_burst ES la frecuencia (no el divisor)", () => {
  /** Inmediato de una fila del kernel; rojo NOMBRANDO la fila si el disasm la movió. */
  function immKernel(at: number, texto: string): number {
    const re = new RegExp(
      `^${at.toString(16).padStart(4, "0")}: [0-9a-f]+\\s+${texto} (0x[0-9a-f]+|\\d+)$`,
      "m",
    );
    const m = re.exec(KERNEL);
    expect(m, `ULTIMA.EXE:0x${at.toString(16)} ya no es \`${texto} imm\``).not.toBeNull();
    return Number(m![1]);
  }

  /** El dividendo `dx:ax` de la división que programa el PIT, re-extraído de sus dos filas. */
  const PIT_DIVIDENDO = (immKernel(0x227b, "mov dx,") << 16) | immKernel(0x227e, "mov ax,");
  /** Suelo del sorteo, re-extraído de `0x2268 mov bx, 0x64`. */
  const LO = immKernel(0x2268, "mov bx,");

  it("el dividendo de 0x227e ES el reloj del PIT — que es lo que hace del cociente un CONTADOR", () => {
    expect(PIT_DIVIDENDO).toBe(0x1234de);
    // 1.193.182 Hz = 14,31818 MHz / 12, el reloj del 8253 del PC. Si el dividendo fuese
    // cualquier otro número, el cociente NO sería un contador y la ficha tendría razón.
    expect(PIT_DIVIDENDO).toBe(1193182);
    // Y el cociente se escribe al canal 2 del PIT en dos mitades: por eso es un contador.
    expect(hasLine(KERNEL, 0x2281, "div cx")).toBe(true);
    expect(hasLine(KERNEL, 0x2283, "out 0x42, al")).toBe(true);
    expect(hasLine(KERNEL, 0x2285, "mov al, ah")).toBe(true);
    expect(hasLine(KERNEL, 0x2287, "out 0x42, al")).toBe(true);
    // El MISMO dividendo en `set_tone 0x22e2`, cuyo argumento el corpus ya llamaba Hz:
    // dos emisores, una sola ley. (Y el tercero, el del driver de vídeo, en EGA.DRV.)
    expect((immKernel(0x22f2, "mov dx,") << 16) | immKernel(0x22f5, "mov ax,")).toBe(PIT_DIVIDENDO);
    expect(hasLine(EGA, 0x27eb, "mov ax, 0x34de")).toBe(true);
  });

  it("el sorteo vive en [0x64, band] — y el port emite ESE valor, muestra a muestra", () => {
    // Las constantes del PRNG salen del disasm (0x2258/0x225f/0x2262), no de la memoria
    // de quien escribe: si el disasm se regenera y una fila se mueve, esto se pone rojo.
    const K1 = immKernel(0x2258, "add ax,");
    const K2 = immKernel(0x225f, "xor ax,");
    const K3 = immKernel(0x2262, "add ax,");
    expect(hasLine(KERNEL, 0x225b, "mov cl, 3")).toBe(true);
    expect(hasLine(KERNEL, 0x225d, "ror ax, cl")).toBe(true);
    expect(hasLine(KERNEL, 0x226e, "sub cx, bx")).toBe(true);
    expect(hasLine(KERNEL, 0x2270, "inc cx")).toBe(true);
    expect(LO).toBe(0x64);

    /**
     * El sorteo del binario, reconstruido con las constantes de arriba. El `+1` del módulo
     * es el `inc cx` de 0x2270 — sin él la banda quedaría abierta por arriba, que es el
     * off-by-one que este aserto cazó en `noiseBurst()` y que el mismo commit arregla.
     */
    const sorteo = (band: number, semilla: number, n: number): number[] => {
      const span = band - LO + 1;
      const out: number[] = [];
      let s = semilla & 0xffff;
      for (let i = 0; i < n; i++) {
        const a = (s + K1) & 0xffff;
        const rot = ((a >>> 3) | (a << 13)) & 0xffff;
        s = (((rot ^ K2) & 0xffff) + K3) & 0xffff;
        out.push(LO + (s % span));
      }
      return out;
    };

    /** Lo que el 8253 emite con el contador ENTERO que el binario le escribe (0x2281/0x2283). */
    const pit = (v: number) => PIT_DIVIDENDO / Math.floor(PIT_DIVIDENDO / v);

    // Tres bandas del catálogo real, todas por debajo del recorte HZ_MAX del port para que
    // el aserto mida la LEY y no el recorte (el recorte tiene su propio `it`, abajo).
    let mordidas = 0; // muestras donde `floor` SÍ cambia el valor — ver el aserto de abajo
    for (const [step, dur, band] of [
      [10, 3000, 2000], // combat-hit
      [1, 25, 1000], // move-step, la 1ª ráfaga
      [20, 60, 10000], // ambient-waterfall / intro-thunder
    ] as const) {
      const seg = noiseBurst(step, dur, band, 0x1234);
      if (seg.kind !== "noise") throw new Error("segmento inesperado");
      const crudo = sorteo(band, 0x1234, seg.freqs.length);
      // IDENTIDAD, no «parecido»: el port emite la frecuencia CUANTIZADA del valor sorteado.
      expect(seg.freqs).toEqual(crudo.map(pit));
      crudo.forEach((v) => {
        if (pit(v) !== v) mordidas++;
      });
      // El sorteo sigue viviendo en la banda; la cuantización sólo la roza (<2,2 %).
      crudo.forEach((v, i) => {
        expect(v).toBeGreaterThanOrEqual(LO);
        expect(v).toBeLessThanOrEqual(band);
        expect(Math.abs(seg.freqs[i]! - v) / v).toBeLessThan(0.022);
      });
    }
    // 🔴 CONDICIÓN (a) DEL LEAD, y lo que impide que este `it` sea vacuo: si `floor` no
    // mordiera en NINGUNA muestra, `crudo.map(pit)` sería `crudo` y el aserto de identidad
    // pasaría IGUAL bajo la ley SIN cuantizar. El test tiene que ver la cuantización actuar.
    expect(mordidas, "ninguna muestra distingue la ley cuantizada de la cruda").toBeGreaterThan(0);
  });

  it("CONTROL NEGATIVO: la ley que proponía la ficha (reloj/valor) NO pasa el aserto", () => {
    // Sin este `it` el bloque de arriba podría ser un aserto que cualquier ley satisface.
    // Aquí se construye la ley invertida y se comprueba que el predicado la RECHAZA.
    const band = 2000;
    const seg = noiseBurst(10, 3000, band, 0x1234);
    if (seg.kind !== "noise") throw new Error("segmento inesperado");
    const invertida = seg.freqs.map((v) => PIT_DIVIDENDO / v);
    expect(invertida).not.toEqual(seg.freqs);
    // Y sale del rango del sorteo POR ARRIBA: banda 2000 daría hasta ~11.932 Hz.
    expect(Math.max(...invertida)).toBeGreaterThan(band);
    // La inversión es lo que la hace incompatible: el valor más BAJO del sorteo produce
    // la frecuencia más ALTA. Ése es el sentido de «monótona inversa» de la ficha — cierto
    // de la ley propuesta, falso del binario.
    const iMin = seg.freqs.indexOf(Math.min(...seg.freqs));
    const iMax = seg.freqs.indexOf(Math.max(...seg.freqs));
    expect(invertida[iMin]!).toBeGreaterThan(invertida[iMax]!);
  });

  it("la CUANTIZACIÓN está APLICADA, con su cota y su caso EXTREMO (v=24858 → contador 47)", () => {
    // El contador es entero, así que el altavoz emite `reloj / floor(reloj / v)`, no `v`
    // exacto. Desde #254-bis el port la CALCA (decisión del lead: es la ley derivada del
    // original y cuesta una línea). Esto fija la cota para que crecer una banda no la
    // ensanche sin que nadie mire, y clava el peor caso de todo el catálogo.
    const desvio = (v: number) => {
      const contador = Math.floor(PIT_DIVIDENDO / v);
      expect(contador, `banda ${v}: el contador se sale de 16 bits`).toBeLessThanOrEqual(0xffff);
      expect(contador, `banda ${v}: contador 0 = división por cero en el PIT`).toBeGreaterThan(0);
      return Math.abs(PIT_DIVIDENDO / contador - v) / v;
    };
    // La cota EMPEORA con la frecuencia (el contador se hace pequeño y su paso, grueso):
    // hasta 2 kHz 0,165 % · 10 kHz 0,832 % · 20 kHz 1,692 % · 25 kHz 2,127 %. Se fijan las
    // dos que importan — la de lo que el port EMITE (recorta a 20 kHz) y la de la banda
    // más alta del catálogo — con su holgura, no con el valor pelado.
    const peorHasta = (hi: number) => {
      let p = 0;
      for (let v = LO; v <= hi; v++) p = Math.max(p, desvio(v));
      return p;
    };
    expect(peorHasta(20000)).toBeLessThan(0.018); // todo lo audible que el port emite
    expect(peorHasta(25000)).toBeLessThan(0.022); // la banda de `ambient-fountain`
    // Y en el suelo del sorteo es despreciable: el grave del original es fiel al Hz.
    expect(desvio(LO)).toBeLessThan(0.0001);

    // EL CASO EXTREMO, clavado con su aritmética entera (condición (b) del lead): el peor
    // valor de todo el catálogo es v=24858 — el último antes de que el contador baje de 48.
    const V_PEOR = 24858;
    expect(Math.floor(PIT_DIVIDENDO / V_PEOR)).toBe(47);
    expect(Math.floor(PIT_DIVIDENDO / (V_PEOR + 1))).toBe(47); // sigue en 47…
    expect(Math.floor(PIT_DIVIDENDO / 24357)).toBe(48); // …y 48 empieza antes: 24858 es del tramo 47
    expect(PIT_DIVIDENDO / 47).toBeCloseTo(25386.85, 2);
    expect(desvio(V_PEOR)).toBeCloseTo(0.02127, 5);
    // Que sea el máximo NO se afirma de palabra: se barre la banda entera y se compara.
    let vArgMax = LO;
    for (let v = LO; v <= 25000; v++) if (desvio(v) > desvio(vArgMax)) vArgMax = v;
    expect(vArgMax).toBe(V_PEOR);
  });

  it("el recorte a 20 kHz del port es SUYO: el binario no lo tiene (divergencia declarada)", () => {
    // `ambient-fountain` sortea en [100, 25000]; el port recorta a HZ_MAX=20000 y el
    // binario programa el contador 47 = 25.387 Hz. Está por encima de lo que casi nadie
    // oye, pero es una decisión del port y se declara en vez de dejarla implícita.
    const seg = noiseBurst(1, 512, 25000, 0x1234);
    if (seg.kind !== "noise") throw new Error("segmento inesperado");
    expect(Math.max(...seg.freqs)).toBeLessThanOrEqual(20000);
    expect(PIT_DIVIDENDO / Math.floor(PIT_DIVIDENDO / 25000)).toBeGreaterThan(20000);
  });
});
