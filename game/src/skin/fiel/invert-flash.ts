/**
 * INVERSIÓN de pantalla del pergamino de HECHIZO-DE-TIEMPO (In Sanct / In An /
 * An Tym) — CALCO del mecanismo derivado del binario:
 *
 *   tail del lector de scrolls (CAST.OVL 0x125c: push char/turnos/idx) →
 *   stub 0x80b2 → setter CAST2.OVL 0x08f8 (g_time_spell/turns) → CAST2 0x0000:
 *     · noise_burst de entrada (kernel 0x223c)
 *     · set_color([g_unk_13b0]=0xF blanco, SEL 0x2d) + rect XOR del VIEWPORT
 *       (8,8)-(183,183) — residente 0x0b86 = STC + SEL 0x3f (EGA.DRV fn21 con
 *       carry programa el Graphics Controller en función XOR, 0x1183-0x1197)
 *       ⇒ cada píxel c → c^15 (inversión EGA). Chrome y paneles INTACTOS.
 *     · dos tone_sweep espejo (kernel 0x2192, tablas DS 0x4af6-0x4b2c)
 *     · el MISMO rect XOR otra vez (XOR involutivo) ⇒ des-invierte.
 *
 * ⇒ La inversión NO dura el time-stop entero (la nota del testigo lo suponía):
 * es la ventana de los dos sweeps del jingle (~1.4 s In Sanct / ~1.7 s In An /
 * ~2.9 s An Tym), una vez por (U)se. Testigo: doom-n6-combate-20260721.mov —
 * ventanas brillantes de 3-4 s en cada An Tym (f042-045, f109-111, …), suelo
 * negro→blanco, murallas magenta-claro→verde, lava roja→cyan (= XOR 15 exacto).
 *
 * Presentación PURA (patrón ApparitionFlash): la piel la dispara desde el cue
 * `time-spell` del bus de sfx y pinta composite `difference` blanco sobre el
 * viewport (255−c por canal = volteo EGA; misma aproximación documentada en
 * apparition.ts — sólo el par marrón 6 ↔ azul-claro 9 diverge del XOR de índice,
 * porque el marrón EGA #AA5500 no es complementario por canal: Clase C).
 * Divergencia consciente: el original BLOQUEA el input durante el jingle (la
 * rutina es síncrona); el port lo superpone sin pacear (Clase C).
 */

import { QUAKE_PULSES, QUAKE_PERIOD_MS } from "./quake.js";

/** Estado de un frame del flash: ¿invertir el viewport ahora? */
export class TimeSpellFlash {
  private start = 0;
  /** Retardo hasta que empieza la inversión (= dur del noise_burst de entrada). */
  private delay = 0;
  /** Duración de la ventana invertida (= los dos sweeps espejo). */
  private dur = 0;

  /** ¿Flash vivo (pendiente o invirtiendo)? La piel repinta mientras lo esté. */
  get active(): boolean {
    return this.dur > 0;
  }

  /** Arranca el flash a reloj de pared: ventana [delay, delay+dur) desde `now`. */
  trigger(now: number, window: { delay: number; dur: number }): void {
    this.start = now;
    this.delay = window.delay;
    this.dur = window.dur;
  }

  /** Corta el flash (cambio de piel / desmontaje). */
  clear(): void {
    this.dur = 0;
  }

  /**
   * ¿La ventana `[delay, delay+dur)` cubre `now`? **PURA** — no autodesactiva nada, y por
   * eso la puede llamar un SEGUNDO lector sin robarle la caducidad al primero.
   *
   * 🔴 Existe porque la inversión tiene DOS pintores y no uno (#295, 14-08): la piel fiel
   * la pinta en su canvas oculto (`invertAt` de aquí abajo) y la piel SHADER —la de
   * fábrica— tiene que pintarla OTRA VEZ en su compose, porque su paso (2) recompone el
   * viewport por su cuenta y PISA lo que la fiel hornea. Es la misma razón por la que
   * existen sus pasos (2f) terremoto, (2f-bis) rito y (2g) apagón de cama.
   */
  invertsAt(now: number): boolean {
    if (this.dur <= 0) return false;
    const t = now - this.start;
    return t >= this.delay && t < this.delay + this.dur;
  }

  /**
   * ¿Invertir el viewport a tiempo `now`? Se autodesactiva al expirar.
   *
   * La ventana NO se re-deriva aquí: se delega en `invertsAt` para que las dos lecturas no
   * puedan divergir el día que alguien mueva un `>=`. Lo propio de este método es sólo la
   * caducidad (`dur = 0`), que es lo que un lector pasivo no debe provocar.
   */
  invertAt(now: number): boolean {
    if (this.dur > 0 && now - this.start >= this.delay + this.dur) this.dur = 0;
    return this.invertsAt(now);
  }
}

/**
 * Las MÁSCARAS de los tres destellos del curandero (#299) — los estados XOR ACUMULADOS de
 * la pantalla, no los colores empujados: SHOPPES 0x13b0 hace rect XOR con `set_color(4)`
 * (0x13c1), luego con `set_color(15)` (0x1403) y luego OTRA VEZ con 15 (0x1438, sin
 * set_color entre medias), así que lo que se VE es p^4 → p^4^15 = p^11 → p^11^15 = p^4.
 * El residuo p^4 tras el `ret` (0x1469) lo restaura el redibujo del bucle de menú del
 * llamador (getkey_with_redraw) — aquí, el fin de la tercera ventana.
 *
 * Los valores 4 y 15 son #305 derivado en ESTÁTICO: `g_unk_13ae`/`g_unk_13b0` tienen UN
 * único sitio de escritura en el corpus (INTRO.OVL 0x09f4/0x09fa, rama EGA/Tandy 52c8 ∉
 * {0,3}: 4 y 0xF), con corroboración viva en otros tiempos (#297: g_13ae=rojo EGA 4 en la
 * captura del catalejo; #295: g_13b0=15 careado color a color en el WELL DONE).
 */
export const HEALER_FLASH_MASKS: readonly [number, number, number] = [4, 4 ^ 15, 4];

/**
 * SECUENCIA DE TRES VENTANAS XOR contiguas, una MÁSCARA por ventana — el esqueleto común
 * de los dos idioms del binario que encadenan TRES rect XOR del viewport con otra cosa en
 * medio (barridos de altavoz en el curandero, ráfagas de 0x3072 en la ceremonia del
 * Códice). Hermana de `TimeSpellFlash` (misma familia: ventana de reloj de pared), pero
 * con máscara por ventana en vez de encendido/apagado: las máscaras ≠15 no se pueden
 * pintar con `difference` blanco (veto medido de #317) — el pintor es
 * `paletteXorViewportInterior` (fiel) / `paletteXorRect` (shader).
 *
 * Las MÁSCARAS son fijas por subclase (los estados acumulados que el asm determina); las
 * VENTANAS llegan al `trigger` porque su fuente es distinta por sitio (catálogo de audio
 * en el curandero, duración de la ráfaga en el Códice).
 */
export class XorMaskFlash {
  constructor(private readonly masks: readonly [number, number, number]) {}
  private start = 0;
  private wins: readonly [number, number, number] | null = null;

  /** ¿Destello vivo? La piel mantiene el reloj de repintado mientras lo esté. */
  get active(): boolean {
    return this.wins !== null;
  }

  /** Arranca la secuencia a reloj de pared: tres ventanas contiguas desde `now`. */
  trigger(now: number, windows: readonly [number, number, number]): void {
    this.start = now;
    this.wins = windows;
  }

  /** Corta el destello (cambio de piel / teardown). */
  clear(): void {
    this.wins = null;
  }

  /**
   * Máscara XOR vigente en `now` (0 = ninguna). **PURA** — no caduca nada: es la lectura
   * del compose de la piel shader, que no debe robarle la caducidad al pintor de la fiel
   * (misma pareja invertsAt/invertAt de arriba, por la misma razón #295).
   */
  masksAt(now: number): number {
    if (!this.wins) return 0;
    let t = now - this.start;
    if (t < 0) return 0;
    for (let i = 0; i < 3; i++) {
      const w = this.wins[i]!;
      if (t < w) return this.masks[i]!;
      t -= w;
    }
    return 0;
  }

  /** Máscara vigente, autodesactivando la secuencia al expirar (el pintor de la fiel). */
  maskAt(now: number): number {
    if (this.wins) {
      const total = this.wins[0] + this.wins[1] + this.wins[2];
      if (now - this.start >= total) this.wins = null;
    }
    return this.masksAt(now);
  }
}

/**
 * DESTELLO DE LA LUZ del curandero (#299) — «Receive now the Light!». Disparado por el cue
 * `shop-transaction` del bus de sfx, que el port ya emite en los TRES sitios del binario:
 * 0x1611 Cure / 0x1684 Heal / 0x16eb Resurrect, caridad y gratis incluidos.
 *
 * Las ventanas llegan de `healerFlashWindowsMs()` (speaker.ts): cada una es la duración
 * del par de barridos que en el binario corre entre su rect XOR y el siguiente.
 */
export class HealerLightFlash extends XorMaskFlash {
  constructor() {
    super(HEALER_FLASH_MASKS);
  }
}

/**
 * Las MÁSCARAS del BRACKET XOR de la ceremonia final del Códice (fix-codice, 19-08) — los
 * estados acumulados de la pantalla, no los colores empujados: CAST2 0x0dac-0x0dee
 * (bytes leídos en crudo) hace rect XOR con `set_color([g_unk_13ae]=4)` (0x0db3), luego
 * con `set_color([g_unk_13b0]=15)` (0x0dca), y luego OTRA VEZ con el 4 de `g_unk_13ae`
 * (0x0de1) — cada rect ANTES de su ráfaga de 0x3072 (0x0dc0/0x0dd7/0x0dee). Lo que se VE:
 * p^4 → p^4^15 = p^11 → p^11^4 = p^15. 🔴 El tercer empuje es el DISCRIMINANTE contra el
 * curandero (SHOPPES 0x1438 repite el 15 ⇒ [4,11,4]): aquí la ceremonia TERMINA en
 * inversión PLENA (p^15). Ese residuo lo restaura en 1988 el redibujo del primer keywait
 * (0x0df8 `call 0x448c` → getkey_with_redraw 0x266c, cuyo 0x5910 corre: la ceremonia
 * transcurre con location overworld ∉ 0x21..0x7f — shrine-rito-cadencia-negativo.md §0 y
 * agregado-23-acta.md:197) — aquí, la caducidad de la tercera ventana.
 *
 * Los valores 4 y 15 son #305 derivado en ESTÁTICO (único escritor INTRO.OVL 0x09f4/0x09fa,
 * rama EGA/Tandy), con la misma corroboración viva que cita HEALER_FLASH_MASKS.
 */
export const CODEX_WIND_MASKS: readonly [number, number, number] = [4, 4 ^ 15, 4 ^ 15 ^ 4];

/**
 * Las VENTANAS del bracket — el TIMING, partido como manda la memoria
 * compartir-la-primitiva:
 *   · DERIVADO (asm): TRES ventanas contiguas, cada una = UNA invocación de la primitiva
 *     de sacudida 0x3072 — entre un rect XOR y el siguiente no corre NADA más (CAST2
 *     0x0dac-0x0dee: push color / call set_color / push 8,8,0xb7,0xb7 / call rect /
 *     call 0x4e92, tres veces seguidas).
 *   · CALIBRADO (Clase C, dueño quake.ts): QUAKE_PULSES × QUAKE_PERIOD_MS por ráfaga.
 *     NO es una constante prestada de otro subsistema: la ventana bracketa LA MISMA
 *     QuakeShake que la piel corre (planTurnPhase funde las tres ráfagas de la ceremonia
 *     en una sacudida sostenida de 3·QUAKE_PULSES contiguos), así que máscara y sacudida
 *     cambian de ventana EN EL MISMO instante por construcción — y si quake.ts recalibra
 *     su cadencia, esta ventana se mueve con él sola.
 */
export function codexWindWindowsMs(): [number, number, number] {
  const w = QUAKE_PULSES * QUAKE_PERIOD_MS;
  return [w, w, w];
}

/**
 * EL BRACKET XOR de la ceremonia final del Códice (fix-codice) — la pieza que #295 dejó
 * fichada («lo que le falta al port aquí no es la sacudida, es el bracket») y cuya DOBLE
 * cerradura abrió #299 (#305 derivada en estático + este modelo de render). Disparado por
 * `applyTurnFx` cuando el lote trae los quake con `xorBracket` (el marcador que emite
 * shrine-ceremonies.ts en los tres de la ceremonia — el CONTEO no discrimina: el endgame
 * emite tres quakes sin bracket, use-tools.ts:106), alineado con el arranque de la
 * QuakeShake sostenida (`now + quakeStartMs`).
 */
export class CodexWindFlash extends XorMaskFlash {
  constructor() {
    super(CODEX_WIND_MASKS);
  }
}
