/**
 * DOBLE DE `AudioContext` PARA MEDIR EL AGENDADO DEL SPEAKER, sin navegador.
 *
 * `SpeakerSynth` recibe su contexto por constructor precisamente para esto: aquí `currentTime`
 * NO avanza solo, así que si dos cues arrancan en el mismo instante es porque el código los
 * puso ahí y no por deriva del reloj. Lo que el doble registra son los DOS filos de cada
 * oscilador —`start(t)` y `stop(t)`—, que es lo que permite preguntar por el EFECTO del
 * encadenado («¿arranca este cue en o después del final del anterior?») y no sólo por la
 * pertenencia de un id a una lista.
 *
 * 🔴 `stopped` no estaba en la versión original de este doble (vivía inline en
 * `shard-ritual-av.test.ts` y descartaba los `stop`). Sin la cola no se puede medir el
 * encadenado contra el FINAL REAL del cue anterior: sólo contra una duración recalculada
 * aparte, que es el aserto que se cree su propio esperado. Ver `victory-fanfare-212.test.ts`
 * §#345, donde las dos lecturas se CAREAN entre sí a propósito.
 */

/** Nodo de parámetro (`AudioParam`) que acepta toda la rampa y no guarda nada. */
const rampa = (): Record<string, () => void> => ({
  setValueAtTime: () => {},
  linearRampToValueAtTime: () => {},
  exponentialRampToValueAtTime: () => {},
  setTargetAtTime: () => {},
  cancelScheduledValues: () => {},
});

export interface FakeAudioCtx {
  /** El doble, con la forma que `SpeakerSynth` consume. */
  ctx: AudioContext;
  /** Instante de `osc.start(t)` de cada segmento agendado, en orden de agendado. */
  started: number[];
  /** Instante de `osc.stop(t)` de cada segmento agendado, en el mismo orden. */
  stopped: number[];
}

export function fakeAudioCtx(): FakeAudioCtx {
  const started: number[] = [];
  const stopped: number[] = [];
  const node = (): Record<string, unknown> => ({
    connect: () => {},
    start: (t: number) => started.push(t),
    stop: (t: number) => stopped.push(t),
    frequency: rampa(),
    gain: rampa(),
    type: "",
    curve: null as unknown,
  });
  const ctx = {
    currentTime: 0,
    destination: {},
    createOscillator: node,
    createGain: node,
    createWaveShaper: node,
    createBiquadFilter: () => ({
      connect: () => {},
      type: "",
      frequency: { setValueAtTime: () => {} },
      Q: { setValueAtTime: () => {} },
    }),
  };
  return { ctx: ctx as unknown as AudioContext, started, stopped };
}
