/**
 * RNG exacto del kernel de Ultima V (ULTIMA.EXE), bit a bit.
 *
 * Re-derivado del asm de la rutina `rand_range` del kernel (offset de
 * código 0x2092; evidencia completa y listado en re/notes/rng.md). NO es
 * el LCG estándar de Borland: es un generador add/rotate/xor de 16 bits
 * sobre una única semilla word (el global g_rng_seed, DS:0x5420):
 *
 *   x = (seed + 0x9248) & 0xFFFF     ; add ax, 0x9248
 *   x = ror16(x, 3)                  ; d1c8 ×3 (ror ax,1)
 *   x = x ^ 0x9248                   ; xor ax, 0x9248
 *   x = (x + 0x11) & 0xFFFF          ; add ax, 0x11
 *   seed = x                         ; mov [g_rng_seed], ax
 *   retorno = lo + ((x & 0x7FFF) % (hi - lo + 1))
 *
 * Paridad verificada contra el binario real bajo dosbox-x
 * (re/tools/test_rng_parity.py) y con vectores fijos en
 * game/tests/rng-original.test.ts.
 *
 * ESTADO (re-medido 30-07-2026): SÍ está cableado al bucle del juego desde F.2.
 * `game.ts:616` instancia el stream vivo (`liveRng = new OriginalRng(0)`) y `game.ts:618`
 * enruta por él el `rand(lo, hi)` del turno (housekeeping, spawn, colocación, combate;
 * ver deliberate-divergences §2). La cabecera anterior decía lo contrario: era rancia de
 * `fcecff74`, anterior a F.2.
 *
 * NO se afirma que sea el ÚNICO stream del proceso, porque hay contraejemplo vivo:
 * `world/shadowlord-wither.ts:81` fabrica un OriginalRng propio y deliberado (0x022a,
 * srand del día) y `world/survival.ts:57` mantiene un `sharedRng` que es el valor por
 * defecto de 9 firmas. Cuáles de esas 9 reciben el rand vivo en producción está SIN
 * auditar; hasta que se audite, "un solo stream" no está medido.
 */

const ADD_IN = 0x9248; // constante sumada antes de rotar
const XOR_K = 0x9248; // máscara XOR tras rotar (misma constante)
const ADD_OUT = 0x11; // incremento final

/** Rotación a la derecha de 3 bits sobre 16 bits (tres `ror ax, 1`). */
function ror16by3(x: number): number {
  return ((x >>> 3) | (x << 13)) & 0xffff;
}

export class OriginalRng {
  /** Réplica de g_rng_seed (DS:0x5420 del kernel), word de 16 bits. */
  private state: number;

  constructor(seed = 0) {
    this.state = seed & 0xffff;
  }

  /** Siembra la semilla (equivale al srand del kernel, rutina 0x207E). */
  seed(n: number): void {
    this.state = n & 0xffff;
  }

  /** Valor vivo de la semilla (lo que contendría g_rng_seed). */
  getSeed(): number {
    return this.state;
  }

  /**
   * Un paso crudo del generador: devuelve la nueva semilla de 16 bits.
   * Es exactamente el valor que el kernel deja en g_rng_seed (0x2098–0x20AA).
   */
  nextRaw16(): number {
    let x = (this.state + ADD_IN) & 0xffff;
    x = ror16by3(x);
    x ^= XOR_K;
    x = (x + ADD_OUT) & 0xffff;
    this.state = x;
    // ── SONDA #31-bis: CONTADOR DE PASOS DEL STREAM (medición, NO comportamiento) ──
    // Éste es el ÚNICO paso del generador — `next()` lo llama una vez por `rand_range`
    // y el arnés de paridad lo llama directo, así que contar aquí cuenta el stream
    // ENTERO sin depender de por dónde entre el llamador. Mismo contrato opt-in que
    // `armSpawnLog`: sin sumidero instalado esto es UNA lectura de propiedad.
    // Por qué hace falta: los sellos comparan TEXTO, así que un movimiento de stream
    // que no cambie lo impreso los deja intactos. El nº de pasos SÍ es el stream.
    const probe = (globalThis as { __u5rng?: { n: number; seed: number } }).__u5rng;
    if (probe) {
      probe.n++;
      probe.seed = x;
    }
    return x;
  }

  /**
   * Entero aleatorio en [lo, hi] AMBOS inclusive — la firma real del kernel
   * (rand_range(lo, hi), llamada 22 veces desde el propio kernel; p.ej.
   * push 1 / push 8 → 1..8). Consume un paso crudo por llamada.
   */
  next(lo: number, hi: number): number {
    const span = hi - lo + 1;
    if (span <= 0) {
      // ★ EL ORIGINAL SÍ LLEGA AQUÍ, y cuelga. La afirmación anterior de este
      // comentario («el original nunca lo hace») está REFUTADA por lectura del asm:
      // el botín de cofre de mazmorra pide `rand_range(1, planta*4)` (SJOG.OVL:0x179e)
      // y en la planta 0 eso es `rand_range(1, 0)`. El kernel no comprueba el rango —
      //     20b6  sub cx,bx    ; 0 − 1 = 0xFFFF
      //     20b8  inc cx       ; → 0x0000
      //     20bb  div cx       ; división por cero → INT 00h
      // 🔴 CORREGIDO 07-08-2026: NO es un cuelgue duro. El arranque instala su propio
      // manejador de INT 00h (0x0244-0x024c → CS:0x0212), que es el de la C-runtime de
      // MICROSOFT: escribe por STDERR «run-time error R6003 - integer divide by 0» y
      // llama exit(255), cerrando handles y restaurando vectores. Se identificó por una
      // vía independiente del cuerpo: la tabla DS:0xa452 decodifica a R6000…R6009, que
      // son códigos MSC. El defecto sigue siendo real y esta divergencia sigue siendo
      // correcta; lo que cambia es el modo de fallo — no se congela la máquina, se
      // TERMINA EL PROCESO y se pierde el progreso no guardado. SIN MEDIR: si la salida
      // restaura el modo de vídeo, o sea si el mensaje llega a verse.
      // — así que el cero del divisor sale del WRAP, no de una resta que dé cero.
      // Inalcanzable con los mapas de fábrica (ningún cofre en la planta 0), pero
      // abierto a cualquier mapa generado en runtime.
      // Lanzar en vez de colgar es DIVERGENCIA DELIBERADA, autorizada por la excepción
      // de cuelgues del contrato de fidelidad. Ver docs/bugs-del-original.md §1.5.
      // 🔴 El throw va ANTES de `nextRaw16()` a propósito: así un llamador que capture
      // la excepción NO se lleva un paso del stream por delante. No lo reordenes.
      throw new RangeError(`OriginalRng.next: rango inválido [${lo}, ${hi}]`);
    }
    return lo + ((this.nextRaw16() & 0x7fff) % span);
  }
}

/**
 * Hash de la hora DOS con el que el original fabrica una semilla
 * (rutina 0x2056: INT 21h AH=2Ch → CH=hora CL=min DH=seg DL=centésimas).
 * Se expone para poder sembrar "como el original" cuando Fase 3 lo cablee.
 * Devuelve un valor en [0, 0xFFF].
 */
export function timeHashSeed(hour: number, minute: number, second: number, hundredths: number): number {
  const cx = (((hour * 2) & 0xff) << 8) | ((minute * 4) & 0xff);
  const dx = (((second * 8) & 0xff) << 8) | (hundredths & 0xff);
  return (((dx + cx) & 0xffff) ^ 0x91eb) & 0xfff;
}
