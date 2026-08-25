/**
 * PoisonTick — paceador del TICK DE VENENO AL ANDAR (★ #213).
 *
 * DERIVACIÓN (ULTIMA.EXE, cuerpos leídos). `kernel_turn_housekeeping` 0x2AE8 recorre
 * los slots de la party en orden ASCENDENTE (bucle 0x2b0b, `di` = índice) y por cada
 * miembro con `status=='P'` (0x2b36 `cmp ax,0x50`) llama a `kernel_apply_damage(i,1)`
 * (0x2b3b `push di` / 0x2b3c-0x2b3f `push 1` / 0x2b40 `call 0x2a52`). Y 0x2a52 es a la
 * vez el daño Y su presentación, EN ESTE ORDEN:
 *
 *     2a56: push [bp+6]        ; el slot
 *     2a59: call 0x2a28        ; INVIERTE la fila del roster de ese slot
 *     2a5c: push 0xa           ; step  = 10
 *     2a5f: push 0x640         ; dur   = 1600
 *     2a64: push 0x7d0         ; band  = 2000
 *     2a68: call 0x223c        ; noise_burst — el ruido del golpe
 *     2a6b: push [bp+6]
 *     2a6e: call 0x2a28        ; DES-INVIERTE (0x2a28 es un XOR: la 2ª llamada restaura)
 *     2a7b: sub [si+0x55b8], ax ; y SÓLO ENTONCES resta el HP
 *
 * `0x2a28` es la rutina de inversión de fila COMPARTIDA: la usan también el cursor del
 * picker `select_party_member` (0x2daf/0x2dc4/0x2e1f/0x2e7d) y el impacto de combate
 * (0x35ba/0x35cd). Por eso este paceador no pinta nada propio: publica el índice de
 * fila en `setDamageFlash` y la piel lo enruta al MISMO `invertIdx` de siempre.
 *
 * SECUENCIALIDAD. `0x223c` es un bucle de espera calibrada con el gate del altavoz
 * abierto: el original es mono-hilo y BLOQUEA hasta acabar (la regla de #206, «el audio
 * ES el reloj»). Con N envenenados, por tanto, son **N secuencias completas y
 * sucesivas**, no N sonidos superpuestos, y el orden es el de los SLOTS. Aquí eso se
 * consigue espaciando los cues a reloj de pared — sin tocar el cerrojo `BLOCKING` de
 * `playSegs`, cuyo alcance sigue acotado al ritual del shard (#206/#208).
 *
 * STREAM CERO. La frecuencia del ruido sale de un PRNG **local de sonido** en `[0x545c]`
 * (`0x2255-0x2265`: `((s+0x9248) ror 3) ^ 0x9248) + 0x11`), NO de `g_rng`
 * (`rand_range` 0x2092). Esta presentación no puede desalinear el stream —
 * re/notes/sfx-catalog.md §1.2.
 *
 * DURACIÓN. El cue `combat-damage` del catálogo ya es exactamente ese
 * `noiseBurst(10,1600,2000)` (skin/fiel/speaker.ts). Su duración renderizada sale de
 * `samplesToMs(dur · NOISE_FACTOR, 1)` = 1600·1,5·1000/25806,45 ≈ **93 ms**, y ése es
 * el paso entre miembros: `POISON_BLIP_MS`. No es una calibración a ojo — es el mismo
 * número que el sintetizador programa para el segmento.
 *
 * BAJO AUTOMATIZACIÓN (`navigator.webdriver`) la unidad es 0 → todo se drena síncrono,
 * byte-idéntico al flujo previo salvo por los cues (e2e/digests sin drift de tiempos),
 * igual que hace `TrollSneak`. A diferencia de ella, este paceador **NO es modal**: no
 * traga input ni difiere el resto del turno, porque el tick de veneno ocurre en CADA
 * paso y bloquear el andar sería peor que el defecto que arregla.
 */
import type { PoisonTickScript } from "../core/game.js";

/**
 * Duración del cue `combat-damage` = `noise_burst(step=10, dur=1600, band=2000)`
 * (kernel 0x2a52 @0x2a68), en ms, según el MISMO modelo que usa el sintetizador:
 * `samplesToMs(dur · 1,5, 1)` con `SPEAKER_SAMPLE_RATE_HZ = 24000/0,93`.
 * Es el espaciado entre miembros envenenados (el original los encadena bloqueando).
 */
export const POISON_BLIP_MS = (1600 * 1.5 * 1000) / (24000 / 0.93);

export interface PoisonTickDeps {
  /** ms entre blips (0 = drain síncrono bajo automatización). */
  blipMs: number;
  /** Publica la fila invertida por el flash de daño (`0x2a28`), o `null` al apagarlo. */
  setDamageFlash: (idx: number | null) => void;
  /** Emite el cue del ruido de daño (`0x223c` con (10,1600,2000)). */
  playDamageCue: () => void;
}

export class PoisonTick {
  private timer: number | null = null;

  constructor(private readonly deps: PoisonTickDeps) {}

  /** Corta la secuencia y apaga el flash (cambio de piel / carga de partida). */
  cancel(): void {
    if (this.timer !== null) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    this.deps.setDamageFlash(null);
  }

  /**
   * Reproduce el guión: por cada slot, EN ORDEN, invierte su fila + suena el ruido, y
   * al agotarse los blips apaga el flash. Con `blipMs === 0` (automatización) emite
   * todos los cues de golpe y deja el flash apagado — sin timers vivos.
   */
  run(script: PoisonTickScript): void {
    const { blipMs, setDamageFlash, playDamageCue } = this.deps;
    this.cancel();
    const slots = script.slots;
    if (slots.length === 0) return;
    if (blipMs <= 0) {
      for (let i = 0; i < slots.length; i++) playDamageCue();
      return;
    }
    let i = 0;
    const step = (): void => {
      this.timer = null;
      if (i >= slots.length) {
        setDamageFlash(null); // 0x2a6e del ÚLTIMO miembro: la fila vuelve a normal
        return;
      }
      const slot = slots[i++]!;
      setDamageFlash(slot); // 0x2a59 — invierte la fila de ESTE miembro
      playDamageCue(); // 0x2a68 — noise_burst(10,1600,2000)
      this.timer = window.setTimeout(step, blipMs);
    };
    step();
  }
}
