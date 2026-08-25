/**
 * Ciclo de vida del CampSleep (ui/camp-sleep.ts) — TRAMO 1 del refactor
 * estructural (auditoría MANT-1/ARQ-2): la secuencia de sueño de la acampada
 * (timers campSleep/campSongTimer/campFlashTimer + flag modal `camping`) era un
 * closure de boot() inimportable. Cubre por UNIDAD:
 *   · sueño normal: Zzzz → 1 campSleepStep por hora → campWake → desmonte;
 *   · vigía BARDO: fase canción (reloj congelado, cero campSleepStep) y LUEGO vela;
 *   · aparición: la escena queda montada durante el flash y se desmonta al acabar
 *     (timer CON handle — R6/MANT-2);
 *   · emboscada: corta el sueño sin campWake;
 *   · cancel()/reset(): teardown sin efectos diferidos (la clase de R3).
 * La MECÁNICA (rands de campSleepStep/campWake) es del core y no se toca aquí.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { CampSleep, CAMP_HOUR_MS } from "../src/ui/camp-sleep.js";
import type { Game } from "../src/core/game.js";

// El conductor usa window.setInterval/setTimeout (browser); en node = globalThis.
(globalThis as Record<string, unknown>).window ??= globalThis;

type Events = ReturnType<Game["move"]>;

interface SceneCall {
  on: boolean;
  guardIdx?: number;
  guardCell?: { col: number; row: number } | null;
  songPhase?: boolean;
}

function makeHarness(opts?: {
  guardClass?: string;
  wakeEvents?: Events;
  ambushAtHour?: number;
  /** Flag global de SONIDO (^S / F8) = `g_unk_a9ce` del original. Default ON. */
  soundEnabled?: boolean;
}) {
  const calls = {
    scenes: [] as SceneCall[],
    sfx: [] as string[],
    messages: [] as string[],
    applied: [] as Events[],
    steps: [] as number[],
    /** Celda que el controlador ENTREGA al núcleo en cada paso (la mitad de ida). */
    celdasRecibidas: [] as (SceneCall["guardCell"] | null)[],
    wakes: 0,
  };
  const game = {
    state: {
      partySize: 2,
      characters: [
        { class: opts?.guardClass ?? "F", status: "G" },
        { class: "M", status: "G" },
      ],
    },
    campSleepStep: (h: number, _hours: number, guardCell: SceneCall["guardCell"]) => {
      calls.steps.push(h);
      calls.celdasRecibidas.push(guardCell ?? null);
      // 🔴 El mock MUEVE la celda (una columna al este por hora). Devolverla TAL CUAL —que
      // es lo que hacía antes— deja ciego al controlador: con el vigía siempre quieto,
      // «enhebrar» y «no enhebrar» dan exactamente la misma traza y el mutante que borra
      // el enhebrado sobrevive a todo el fichero. El paseo real lo calcula el núcleo; aquí
      // sólo hace falta que la celda CAMBIE para que el enhebrado sea observable.
      const movida = guardCell ? { col: guardCell.col + 1, row: guardCell.row } : null;
      return { ambush: opts?.ambushAtHour === h, events: [] as never as Events, guardCell: movida };
    },
    campGuardStartCell: (idx: number) => (idx < 0 ? null : { col: 6, row: 4 }),
    campWake: (_guardIdx: number) => {
      calls.wakes++;
      return (opts?.wakeEvents ?? []) as Events;
    },
  } as unknown as Game;
  const ctl = new CampSleep({
    game,
    view: {
      setCampScene: (on, guardIdx, guardCell, songPhase) =>
        calls.scenes.push({ on, guardIdx, guardCell, songPhase }),
      emitSfx: (cue) => calls.sfx.push(cue.id),
    },
    hud: { message: (t) => calls.messages.push(t) },
    applyEvents: (e) => calls.applied.push(e),
    refreshAwaiting: () => {},
    cancelAutoWalk: () => {},
    sceneMs: (ms) => ms,
    soundEnabled: () => opts?.soundEnabled ?? true,
  });
  return { ctl, calls };
}

beforeEach(() => {
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
});

describe("CampSleep — sueño normal (vigía no-bardo)", () => {
  it("Zzzz + escena montada + 1 campSleepStep por hora + campWake + desmonte", () => {
    const { ctl, calls } = makeHarness();
    ctl.run(2, 0);
    expect(calls.messages).toEqual(["Zzzzzz...\n\n"]); // DATA.OVL DS 0x41d4
    expect(ctl.camping).toBe(true);
    // La escena arranca con el vigía en SU PUESTO de formación (campGuardStartCell), no
    // en una hora 0: la celda la lleva el núcleo desde el primer montaje.
    expect(calls.scenes[0]).toEqual({ on: true, guardIdx: 0, guardCell: { col: 6, row: 4 }, songPhase: undefined });
    expect(calls.steps).toEqual([]); // el reloj aún no corrió
    vi.advanceTimersByTime(CAMP_HOUR_MS); // h=0
    vi.advanceTimersByTime(CAMP_HOUR_MS); // h=1
    expect(calls.steps).toEqual([0, 1]);
    expect(calls.wakes).toBe(0);
    vi.advanceTimersByTime(CAMP_HOUR_MS); // h==hours → wake
    expect(calls.wakes).toBe(1);
    expect(ctl.camping).toBe(false);
    // Sin aparición: desmonte inmediato de la escena.
    expect(calls.scenes[calls.scenes.length - 1]!.on).toBe(false);
  });

  // Antes este caso exigía que la escena recibiera un CONTADOR DE HORAS creciente (0,1,2)
  // del que la piel derivaba la celda por paridad — es decir, FIJABA EL DEFECTO. Ahora la
  // celda la calcula el núcleo (`campGuardWalk`) y el controlador sólo la ENHEBRA de hora
  // en hora; lo que toca blindar es ese enhebrado, no un contador.
  it("la celda del vigía se enhebra: la que devuelve el núcleo es la que va a la escena", () => {
    const { ctl, calls } = makeHarness();
    ctl.run(3, 1);
    vi.advanceTimersByTime(CAMP_HOUR_MS * 2);
    const celdas = calls.scenes.filter((s) => s.on).map((s) => s.guardCell);
    // El mock avanza una columna por hora ⇒ montaje en el puesto de formación y luego LA
    // CELDA QUE VOLVIÓ del núcleo, no la de partida repetida.
    expect(celdas).toEqual([
      { col: 6, row: 4 }, { col: 7, row: 4 }, { col: 8, row: 4 },
    ]);
  });

  it("🔴 …y la de VUELTA es la de IDA del paso siguiente (el enhebrado va en los dos sentidos)", () => {
    // La mitad que faltaba: sin ella, un controlador que pinte la celda nueva pero siga
    // ENTREGANDO al núcleo la de partida pasa el caso de arriba y deja al vigía clavado.
    const { ctl, calls } = makeHarness();
    ctl.run(3, 1);
    vi.advanceTimersByTime(CAMP_HOUR_MS * 3);
    expect(calls.celdasRecibidas).toEqual([
      { col: 6, row: 4 }, { col: 7, row: 4 }, { col: 8, row: 4 },
    ]);
  });
});

describe("CampSleep — canción de Iolo (vigía BARDO)", () => {
  it("fase canción con reloj CONGELADO (cero campSleepStep) y luego vela normal", () => {
    const { ctl, calls } = makeHarness({ guardClass: "B" });
    ctl.run(1, 0);
    // Fase canción: escena songPhase + cue bard-song, sin tocar game.*.
    expect(calls.scenes.some((s) => s.songPhase === true)).toBe(true);
    expect(calls.sfx).toEqual(["bard-song"]);
    vi.advanceTimersByTime(CAMP_HOUR_MS * 3);
    expect(calls.steps).toEqual([]); // el reloj sigue congelado durante la canción
    vi.runOnlyPendingTimers(); // fin de la canción → arranca el bucle de horas
    vi.advanceTimersByTime(CAMP_HOUR_MS * 2);
    expect(calls.steps).toEqual([0]);
    expect(calls.wakes).toBe(1);
  });
});

/**
 * RESIDUO 3 de la ficha #39 — el GATE DE SONIDO (^S) manda sobre el SPRITE, no sólo
 * sobre el audio.
 *
 * `camp-bard-anim.md §7` lo dejó declarado y sin cerrar. DERIVADO del asm, cadena
 * completa (las tres líneas se leen juntas o no se entiende):
 *
 *   CMDS.OVL 0x0010  mov word ptr [bp-4], 0xffff   ; ranura del bardo INICIALIZADA a -1
 *   CMDS.OVL 0x0116  cmp byte ptr [bx], 0x42       ; clase 'B'
 *   CMDS.OVL 0x011e  cmp [bp-0x20], [bp+6]         ; …y ese miembro ES el vigía
 *   CMDS.OVL 0x0123  cmp byte ptr [g_unk_a9ce], 0
 *   CMDS.OVL 0x0128  je  0x130                     ; ★ SONIDO OFF → NO guarda la ranura
 *   CMDS.OVL 0x012a  mov [bp-4], [bp-0x24]         ;   (sólo si pasa las TRES)
 *   CMDS.OVL 0x014f  cmp word ptr [bp-4], -1
 *   CMDS.OVL 0x0153  je  0x1b0                     ; ★ …y salta POR ENCIMA de TODO
 *
 * El salto de 0x0153 se lleva por delante las TRES cosas, no sólo el audio:
 *   · 0x017c-0x0181  mov al,0x5f → [objrec+0]=[objrec+1]=0x5F   (EL SPRITE DEL LAÚD)
 *   · 0x0183         mov byte ptr [0x6a08],1                     (la melodía)
 *   · 0x0188-0x018c  push 0x34 / call 0x7b66 = 0x3AE6(52)        (LA PAUSA de 52 redibujos)
 *
 * ⇒ con ^S apagado el bardo se duerme como los demás y "Zzzzzz..." sale EN EL ACTO.
 * El port sólo silenciaba el cue (`speaker.play` retorna si `!_enabled`): seguía
 * cambiando el sprite, animándolo y congelando el reloj 7.5 s EN SILENCIO.
 *
 * NO mueve el stream de RNG: la fase canción ya era presentación pura (no llama a
 * `game.*`), así que suprimirla no cambia ni un rand — lo blinda el test
 * discriminante de camp-scene.test.ts y la paridad.
 */
describe("CampSleep — gate de SONIDO ^S sobre el bardo (ficha #39, residuo 3)", () => {
  it("★ sonido OFF: ni sprite de laúd, ni cue, ni pausa — el bucle de horas arranca YA", () => {
    const { ctl, calls } = makeHarness({ guardClass: "B", soundEnabled: false });
    ctl.run(1, 0);
    // Ni el sprite ni el audio: el easter egg entero se salta (0x0128 je 0x130).
    expect(calls.scenes.some((s) => s.songPhase === true)).toBe(false);
    expect(calls.sfx).toEqual([]);
    // Y la PAUSA tampoco existe: sin canción no hay 0x3AE6(52), así que el reloj
    // corre desde el primer tick. Es la mitad que un fix a medias (silenciar el cue
    // pero dejar la escena) NO daría: seguirían 7.5 s congelados en silencio.
    vi.advanceTimersByTime(CAMP_HOUR_MS * 2);
    expect(calls.steps).toEqual([0]);
    expect(calls.wakes).toBe(1);
  });

  it("control positivo: con sonido ON el mismo vigía bardo SÍ dispara la canción", () => {
    // Sin este control el test de arriba pasaría igual con el easter egg roto del todo.
    const { ctl, calls } = makeHarness({ guardClass: "B", soundEnabled: true });
    ctl.run(1, 0);
    expect(calls.scenes.some((s) => s.songPhase === true)).toBe(true);
    expect(calls.sfx).toEqual(["bard-song"]);
    vi.advanceTimersByTime(CAMP_HOUR_MS * 2);
    expect(calls.steps).toEqual([]); // congelado por la canción
  });

  it("control negativo: con sonido OFF un vigía NO-bardo se comporta igual que siempre", () => {
    // El gate 0x0123 está DENTRO de la rama de clase 'B' (0x0119 jne 0x130): apagar el
    // sonido no puede cambiar nada para un vigía que no es bardo. Si este test se
    // pusiera rojo, el gate se habría cableado demasiado arriba.
    const on = makeHarness({ guardClass: "F", soundEnabled: true });
    const off = makeHarness({ guardClass: "F", soundEnabled: false });
    on.ctl.run(2, 0);
    off.ctl.run(2, 0);
    vi.advanceTimersByTime(CAMP_HOUR_MS * 3);
    expect(off.calls.steps).toEqual(on.calls.steps);
    expect(off.calls.scenes.map((s) => s.songPhase)).toEqual(
      on.calls.scenes.map((s) => s.songPhase),
    );
  });
});

describe("CampSleep — aparición y emboscada", () => {
  it("aparición: la escena queda montada durante el flash y se desmonta al acabar", () => {
    const { ctl, calls } = makeHarness({
      wakeEvents: [
        { kind: "sfx", sfx: { id: "apparition-materialize" } },
      ] as unknown as Events,
    });
    ctl.run(1, 0);
    vi.advanceTimersByTime(CAMP_HOUR_MS * 2); // h=0 + wake
    expect(calls.wakes).toBe(1);
    // El flash aún corre: el último setCampScene sigue siendo de montaje.
    expect(calls.scenes[calls.scenes.length - 1]!.on).toBe(true);
    vi.runOnlyPendingTimers(); // fin del pulso (apparitionDurationMs)
    expect(calls.scenes[calls.scenes.length - 1]!.on).toBe(false);
  });

  it("emboscada: corta el sueño SIN campWake (epílogo 0x0306, ax=1)", () => {
    const { ctl, calls } = makeHarness({ ambushAtHour: 0 });
    ctl.run(4, 0);
    vi.advanceTimersByTime(CAMP_HOUR_MS);
    expect(ctl.camping).toBe(false);
    expect(calls.wakes).toBe(0);
    expect(calls.scenes[calls.scenes.length - 1]!.on).toBe(false);
    // El interval quedó cancelado: no siguen corriendo horas.
    vi.advanceTimersByTime(CAMP_HOUR_MS * 10);
    expect(calls.steps).toEqual([0]);
  });
});

describe("CampSleep — teardown (la clase de R3)", () => {
  it("cancel() a mitad de sueño: cero pasos/wake posteriores", () => {
    const { ctl, calls } = makeHarness();
    ctl.run(8, 0);
    vi.advanceTimersByTime(CAMP_HOUR_MS);
    ctl.cancel();
    vi.advanceTimersByTime(CAMP_HOUR_MS * 20);
    expect(calls.steps).toEqual([0]);
    expect(calls.wakes).toBe(0);
    expect(ctl.camping).toBe(true); // cancel NO baja el flag (eso es reset)
  });

  it("reset(): cancela, baja el flag modal y desmonta la escena", () => {
    const { ctl, calls } = makeHarness();
    ctl.run(8, 0);
    ctl.reset();
    expect(ctl.camping).toBe(false);
    expect(calls.scenes[calls.scenes.length - 1]!.on).toBe(false);
    vi.advanceTimersByTime(CAMP_HOUR_MS * 20);
    expect(calls.steps).toEqual([]); // ningún timer sobrevivió al teardown
  });

  it("re-acampar (run tras run) no deja timers huérfanos del primer sueño", () => {
    const { ctl, calls } = makeHarness();
    ctl.run(8, 0);
    vi.advanceTimersByTime(CAMP_HOUR_MS);
    ctl.run(1, 0); // re-acampada: cancela la anterior
    vi.advanceTimersByTime(CAMP_HOUR_MS * 2);
    // Pasos: h=0 del primer sueño + h=0 y wake del segundo (sin interleaving).
    expect(calls.steps).toEqual([0, 0]);
    expect(calls.wakes).toBe(1);
  });
});
