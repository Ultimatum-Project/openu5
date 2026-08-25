/**
 * LA REGLA DE FASE DEL LOTE DE TURNO (#243 → #208) — módulo propio porque tiene
 * consumidores en LAS DOS mitades de la presentación: las pieles (el CUÁNDO de cada
 * visual, `applyTurnFx`) y el bus de sonido (`CoreViewImpl.notifyTurn` /
 * `flushEventPrefix`). Hasta #208 vivía en `fiel/skin.ts` como `planVisualPhase`;
 * meterlo en `coreview.ts` desde allí habría arrastrado el grafo entero de la piel
 * fiel al adaptador. Las FUENTES no se mueven: la lista de qué empuja fase es
 * `CHAINED_CUES` (fix-quakeshake; antes `BLOCKING_CUES`, su subconjunto de pausa) y la
 * duración `cueDurationMs` (dueño `fiel/speaker.ts`), la sacudida
 * `QUAKE_PULSES`/`QUAKE_PERIOD_MS` (dueño `fiel/quake.ts`) y la explosión
 * `PAUSE_UNIT_MS`/`EXPLOSION_BURST_MS` (dueño `world-fx.ts`).
 */
import type { GameEvent } from "../core/game.js";
import { CHAINED_CUES, cueDurationMs } from "./fiel/speaker.js";
import { QUAKE_PULSES, QUAKE_PERIOD_MS } from "./fiel/quake.js";
import { PAUSE_UNIT_MS, EXPLOSION_BURST_MS } from "./world-fx.js";

/** Lo que `planTurnPhase` decide para un lote de turno. Todo en ms desde `now`. */
export interface TurnPhasePlan {
  /** Nº de ráfagas de sacudida del lote (0 = no hay). */
  quakes: number;
  /** Instante en que arranca la sacudida (0 si nada la precede). */
  quakeStartMs: number;
  /**
   * ¿Las ráfagas del lote llevan el BRACKET XOR de la ceremonia del Códice? (marcador
   * `xorBracket` de los eventos, fix-codice). Decide que `applyTurnFx` arranque el
   * `CodexWindFlash` alineado con la sacudida. 🔴 Por MARCADOR y no por conteo: el
   * endgame también emite tres quakes en un lote y no bracketa (use-tools.ts:106).
   */
  xorBracket: boolean;
  /** Una entrada por `cell-explosion`, con su espera ya resuelta. */
  explosions: { cellFx: NonNullable<GameEvent["cellFx"]>; leadMs: number }[];
  /**
   * ★ #208 — LA PROYECCIÓN DE AUDIO del mismo recorrido: `sfxLeadMs[i]` es la espera (ms
   * desde `now`) del evento `events[i]` cuando es `{kind:"sfx"}` (0 en el resto de
   * posiciones). El bus la lleva hasta el agendado (`notifyTurn` → `onSfx(cue, leadMs)` →
   * `SpeakerAudio.play` → `playSegs`), donde compone por MAX con el `tail` de #206.
   * Va indexada por POSICIÓN DE EVENTO y no como lista aparte para que el plan y el
   * enrutador no puedan discrepar sobre qué eventos son sfx.
   */
  sfxLeadMs: readonly number[];
}

/**
 * 🔴 LA FASE DE LOS EFECTOS DEL TURNO (#243 el canal visual; #208 el de audio; hasta #208
 * se llamó `planVisualPhase` — así la citan las actas de #243/#373) — función PURA para
 * que su veredicto sea un dato y no una inspección del texto de la piel.
 *
 * Recorre el lote EN ORDEN y decide cuándo puede empezar cada efecto. La regla es la del
 * binario de 1988, donde hay UN SOLO HILO y cada primitiva gira hasta acabar:
 *   · un cue de `CHAINED_CUES` empuja hacia atrás todo lo que venga DETRÁS de él en el lote
 *     — `tone_sweep` bit-banguea el gate del altavoz y no vuelve hasta terminar (#206: «el
 *     audio ES el reloj»). 🔴 fix-quakeshake: el predicado era `BLOCKING_CUES` (la pausa de
 *     juego de #212, subconjunto) y dejaba fuera a `shrine-well-done` — la QuakeShake del
 *     WELL DONE arrancaba en t=0 solapada con el arranque del negativo, mientras el binario
 *     la corre tras el `jg 0xc69` que cierra los barridos (CAST2 0x0c88). Serializado en el
 *     binario ⇒ empuja fase aquí; pausar el JUEGO sigue siendo solo de `BLOCKING_CUES`;
 *   · la SACUDIDA también bloquea — `screen_shake_fx` (`ULTIMA.EXE:0x3072`) es un bucle de
 *     dibujo con `speaker_off` a la salida (acta §3.1) — así que lo que va detrás de ella
 *     empieza cuando termina. Las ráfagas consecutivas del MISMO lote no se encadenan entre
 *     sí: son una sacudida sostenida de N·QUAKE_PULSES (la ceremonia del Codex con sus tres,
 *     CAST2 0x0dc0/0dd7/0dee);
 *   · ★ #208: la EXPLOSIÓN bloquea igual (`explosion_fx_at_cell`, CAST 0x16f4 ×7 en el
 *     ritual: cada llamada gira hasta acabar) — avanza el reloj su duración entera
 *     (`preDelayUnits`·55 + `bursts`·60, las constantes de su dueño `world-fx.ts`);
 *   · ★ #208: cada cue de sonido RECIBE el reloj en su posición (`sfxLeadMs`) — es la
 *     inversa que `fx-243.md` §9.3 dejó medida: la fanfarria del ritual (CAST 0x1759, tras
 *     las 7 explosiones de 0x16e1-0x16fa) entraba ~3,4 s antes porque el audio solo
 *     esperaba al audio. 🔴 CON UNA REUNIFICACIÓN: el cue `quake` no es un sonido que siga
 *     a la sacudida — ES su otra mitad (kernel `0x3072` dibuja Y suena: un tono por banda,
 *     acta av-243 §3.1), y el port lo parte en `{kind:"quake"}` + cue al emitirlo. Se
 *     alinea con el ARRANQUE de su ventana en vez de esperar su final; cualquier otro cue
 *     posterior a una sacudida la espera entera (cierra la ventana), como en el binario.
 * La lista de qué empuja fase sale de `CHAINED_CUES` y la duración de `cueDurationMs`, las
 * MISMAS que usa el encadenado de audio de #206/#345 (la pausa de juego de #212 sigue leyendo
 * su subconjunto `BLOCKING_CUES`): tres consumidores, una fuente. Las de la sacudida salen de
 * `quake.ts`, que es su dueño.
 *
 * Lo que arregla, medido sobre el vídeo del usuario (`Shadowlords.MP4`, 16-08): el ritual
 * arrancaba el barrido de 7,13 s y la coreografía en el MISMO instante, así que lo visual
 * terminaba a los ~2,4 s y quedaban ~6,9 s de sonido con la pantalla congelada. Ahora la
 * coreografía espera al barrido, como en `CAST 0x15dd-0x162a` → `0x1674`; y desde #208 la
 * fanfarria espera a la coreografía (7130+2808+585 = 10.523 ms), como en `CAST 0x1759`.
 *
 * ALCANCE, para que nadie lea esto como un cambio global: sólo se mueve lo que va DETRÁS de
 * un encadenado o de un visual en su PROPIO lote. `CHAINED_CUES` tiene hoy cuatro miembros
 * (`shard-sweep`, `victory-fanfare`, `shrine-well-done` y `quake` — el último con rama
 * propia: no empuja, se alinea) y ningún otro turno del juego los emite por delante de un
 * visual ⇒ con un lote sin encadenados esta función devuelve ceros y nada cambia de
 * instante. La población de `sfxLeadMs` ≠ 0 hoy es DOS: la fanfarria del ritual y el rumble
 * del WELL DONE (fix-quakeshake; 5.347,5 = el tail que su agendado YA tenía por
 * `CHAINED_CUES`, así que el compose por MAX no mueve el audio — lo que se movió es la
 * QuakeShake visual, que lee `quakeStartMs`). Los pares {sacudida, rumble} del sismo, el
 * clavicémbalo, la Palabra de Poder y el Códice quedan alineados a su ventana — leads 0;
 * censo en `fase-audio-208.test.ts`. La generalización a TODO el audio del binario (encadenar
 * también pisadas/golpes/ambiente) sigue FUERA, con su ventana y su población — lo que #208
 * cierra es la regla de fase entre canales, no el cerrojo global por cue.
 *
 * ⚠ Y LA MITAD QUE ESTO NO COMPRA, declarada (advertencia del carril de #212, av-243 §5.2):
 * el encadenado agenda AUDIO — no PARA el juego. En 1988 la fanfarria bloquea el hilo y al
 * terminar el binario VACÍA el búfer de teclado (ULTIMA.EXE:0x1b16). La puerta del lado del
 * JUEGO para el ritual (hermana de la de la arena, `combatPacer.armBlockingPause` en
 * `routeCombatSfx`) sigue siendo de la familia #212 y se adjudica aparte.
 */
export function planTurnPhase(events: readonly GameEvent[]): TurnPhasePlan {
  let leadMs = 0; // ms desde `now` en que puede empezar el siguiente efecto
  let quakes = 0;
  let quakeStartMs = 0;
  let xorBracket = false;
  const explosions: TurnPhasePlan["explosions"] = [];
  const sfxLeadMs: number[] = new Array<number>(events.length).fill(0);
  /** Cierra la ventana de la sacudida sobre `leadMs` cuando llega un efecto POSTERIOR. */
  const cerrarVentanaDeSacudida = (): void => {
    if (quakes === 0) return;
    leadMs = Math.max(leadMs, quakeStartMs + quakes * QUAKE_PULSES * QUAKE_PERIOD_MS);
  };
  for (let i = 0; i < events.length; i++) {
    const e = events[i]!;
    if (e.kind === "sfx" && e.sfx) {
      if (e.sfx.id === "quake") {
        // La otra mitad de `screen_shake_fx` (0x3072): alineado con SU ventana, no detrás.
        sfxLeadMs[i] = quakes > 0 ? quakeStartMs : leadMs;
      } else {
        cerrarVentanaDeSacudida();
        sfxLeadMs[i] = leadMs;
        // fix-quakeshake: el predicado es CHAINED_CUES (serializado en el binario), no
        // BLOCKING_CUES (pausa de juego). Con BLOCKING, `shrine-well-done` no empujaba y
        // la QuakeShake VISUAL del WELL DONE arrancaba en t=0 mientras su audio (tail de
        // CHAINED_CUES) sonaba en 5.347,5 — el solape que #355 dejó declarado. El cue
        // `quake` también es CHAINED pero nunca llega aquí (rama propia arriba), así que
        // este avance no llama a `cueDurationMs({id:"quake"})` (que avanzaría noiseState).
        if (CHAINED_CUES.has(e.sfx.id)) leadMs += cueDurationMs(e.sfx);
      }
    } else if (e.kind === "quake") {
      if (quakes === 0) quakeStartMs = leadMs;
      quakes++;
      if (e.xorBracket) xorBracket = true;
    } else if (e.kind === "cell-explosion" && e.cellFx) {
      cerrarVentanaDeSacudida();
      explosions.push({ cellFx: e.cellFx, leadMs });
      // ★ #208: la explosión BLOQUEA en el binario (0x16f4 gira hasta acabar) — avanza el
      // reloj para lo que la sigue (hoy: la fanfarria del ritual, CAST 0x1759).
      leadMs += e.cellFx.preDelayUnits * PAUSE_UNIT_MS + e.cellFx.bursts * EXPLOSION_BURST_MS;
    }
  }
  return { quakes, quakeStartMs, xorBracket, explosions, sfxLeadMs };
}
