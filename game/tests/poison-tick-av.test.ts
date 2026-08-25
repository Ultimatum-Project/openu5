/**
 * ★ #213 — SONIDO + RESALTE del TICK DE VENENO al andar.
 *
 * REPORTE DEL USUARIO (13-08, jugando): al andar con miembros envenenados, el
 * original hace en cada paso y POR CADA envenenado un sonido y el resalte de su fila
 * del roster en negativo. El port aplicaba el daño y no hacía ninguna de las dos.
 *
 * DERIVACIÓN (ULTIMA.EXE, cuerpos leídos — la cabecera de `ui/poison-tick.ts` la
 * transcribe entera). `kernel_turn_housekeeping` 0x2AE8 recorre los slots en orden
 * ascendente (0x2b0b) y por cada `status=='P'` (0x2b36) llama a
 * `kernel_apply_damage(i,1)` (0x2b40). Esa rutina (0x2a52) invierte la fila con
 * `0x2a28` (0x2a59), suena `noise_burst(10,1600,2000)` con `0x223c` (0x2a68),
 * des-invierte (0x2a6e) y sólo entonces resta el HP (0x2a7b).
 *
 * ESTE FICHERO CUBRE LAS TRES AFIRMACIONES, cada una con su mutante:
 *   1. CENSO: `turnHousekeeping` reporta EXACTAMENTE los slots con 'P', en orden de
 *      slot, y NO los 'D'/'S' (que el bucle salta en 0x2b2f/0x2b34) ni los sanos.
 *   2. CARDINALIDAD: N envenenados ⇒ N blips y N inversiones DISTINTAS, no una.
 *   3. STREAM CERO: el censo no consume una sola tirada de `g_rng` (el ruido sortea
 *      con el PRNG local `[0x545c]`, sfx-catalog.md §1.2).
 */
import { describe, expect, it, vi } from "vitest";
import type { CharacterState, GameState } from "../src/core/state.js";
import { turnHousekeeping } from "../src/core/world/survival.js";
import { PoisonTick, POISON_BLIP_MS } from "../src/ui/poison-tick.js";
import { renderCue } from "../src/skin/fiel/speaker.js";
import { rosterInvertRow } from "../src/skin/fiel/roster.js";
import type { PoisonTickScript } from "../src/core/game.js";

(globalThis as Record<string, unknown>).window ??= globalThis;

function makeChar(status: string, name: string): CharacterState {
  return {
    name,
    gender: 0x0b,
    class: "A",
    status,
    strength: 20,
    dexterity: 20,
    intelligence: 20,
    currentMp: 10,
    currentHp: 50,
    maxHp: 60,
    exp: 0,
    level: 2,
    monthsAtInn: 0,
    helmet: 0xff,
    armor: 0xff,
    weapon: 0xff,
    shield: 0xff,
    ring: 0xff,
    amulet: 0xff,
    inn: 0,
  } as unknown as CharacterState;
}

/** Party con los estados dados, reloj CONGELADO (prevHour===hour) para que el bloque
 *  de hambre de 0x2b5d no corra y el único efecto medido sea el veneno. */
function makeState(statuses: readonly string[]): GameState {
  return {
    characters: statuses.map((st, i) => makeChar(st, `PJ${i}`)),
    partySize: statuses.length,
    activeCharacter: 0xff,
    food: 100,
    time: { year: 139, month: 4, day: 7, hour: 8, minute: 35 },
    turnsSinceStart: 0,
    position: { location: 0, floor: 0, x: 15, y: 15 },
    transport: "foot",
    torchTurns: 0,
    torches: 0,
    prevHour: 8,
  } as unknown as GameState;
}

function ticksOf(statuses: readonly string[]): {
  slots: number[];
  rands: number;
} {
  const s = makeState(statuses);
  const slots: number[] = [];
  let rands = 0;
  const rand = (lo: number, hi: number): number => {
    rands++;
    return lo;
  };
  turnHousekeeping(s, rand, (i) => slots.push(i));
  return { slots, rands };
}

describe("#213 · censo del tick de veneno (kernel 0x2b0b-0x2b40)", () => {
  it("reporta SÓLO los 'P', y en ORDEN DE SLOT (el bucle 0x2b0b recorre di ascendente)", () => {
    // Mezcla deliberada: el envenenado del slot 3 va DESPUÉS del del slot 0 aunque
    // en medio haya un muerto y un sano — el orden es el de las ranuras, no el de
    // aparición de otra cosa.
    expect(ticksOf(["P", "G", "D", "P", "P", "C"]).slots).toEqual([0, 3, 4]);
  });

  it("una party sin envenenados no reporta NADA (control negativo)", () => {
    expect(ticksOf(["G", "C", "D", "S"]).slots).toEqual([]);
  });

  it("un envenenado MUERTO o DORMIDO no tickea: el bucle sale antes (0x2b2f/0x2b34)", () => {
    // 'D' y 'S' se saltan enteros; un 'P' sólo tickea mientras siga siendo 'P'.
    expect(ticksOf(["D", "S"]).slots).toEqual([]);
  });

  it("el censo respeta partySize aunque el roster tenga más fichas", () => {
    const s = makeState(["P", "P", "P"]);
    s.partySize = 2; // el bucle compara contra g_party_size (0x2b4d)
    const slots: number[] = [];
    turnHousekeeping(
      s,
      (lo) => lo,
      (i) => slots.push(i),
    );
    expect(slots).toEqual([0, 1]);
  });

  it("STREAM CERO: el tick no consume NI UNA tirada de g_rng", () => {
    // El anillo de regeneración (0x400C) sí tira, pero sólo por PORTADOR de anillo y
    // estos PJ llevan ring=0xff. Con el reloj congelado no hay hambre. ⇒ el único
    // candidato a consumir sería el veneno, y el binario lo hace con el PRNG LOCAL
    // del altavoz ([0x545c]), no con rand_range 0x2092.
    expect(ticksOf(["P", "P", "P", "P", "P", "P"]).rands).toBe(0);
  });

  it("MUTANTE M1 — un censo que ignorase el estado (todos los slots) sería DISTINTO", () => {
    // Fabrica el testigo sintético: lo que produciría el bug «reportar toda la party».
    const statuses = ["P", "G", "D", "P", "P", "C"];
    const ingenuo = statuses.map((_, i) => i);
    expect(ticksOf(statuses).slots).not.toEqual(ingenuo);
    expect(ingenuo.length).toBe(6); // y la diferencia es de CARDINAL, no de orden
    expect(ticksOf(statuses).slots.length).toBe(3);
  });
});

describe("#213 · secuencia AV: un blip y una inversión POR envenenado", () => {
  function harness(blipMs: number) {
    const flashes: (number | null)[] = [];
    const cues: number[] = [];
    const ctl = new PoisonTick({
      blipMs,
      setDamageFlash: (idx) => flashes.push(idx),
      playDamageCue: () => cues.push(1),
    });
    return { ctl, flashes, cues };
  }

  const SCRIPT: PoisonTickScript = { slots: [0, 3, 4] };

  it("con paso >0 los blips son SECUENCIALES: uno por miembro, espaciados", () => {
    vi.useFakeTimers();
    try {
      const { ctl, flashes, cues } = harness(POISON_BLIP_MS);
      ctl.run(SCRIPT);
      // El primero suena YA (0x2a59/0x2a68 del slot 0), los otros aún no.
      expect(cues.length).toBe(1);
      expect(flashes.at(-1)).toBe(0);
      vi.advanceTimersByTime(POISON_BLIP_MS);
      expect(cues.length).toBe(2);
      expect(flashes.at(-1)).toBe(3);
      vi.advanceTimersByTime(POISON_BLIP_MS);
      expect(cues.length).toBe(3);
      expect(flashes.at(-1)).toBe(4);
      // Tras el último, la fila vuelve a normal (0x2a6e del último miembro).
      vi.advanceTimersByTime(POISON_BLIP_MS);
      expect(cues.length).toBe(3);
      expect(flashes.at(-1)).toBe(null);
    } finally {
      vi.useRealTimers();
    }
  });

  it("las filas invertidas son las TRES del guión, en su orden (no una sola repetida)", () => {
    vi.useFakeTimers();
    try {
      const { ctl, flashes } = harness(POISON_BLIP_MS);
      ctl.run(SCRIPT);
      vi.advanceTimersByTime(POISON_BLIP_MS * 4);
      expect(flashes).toEqual([null, 0, 3, 4, null]); // el `null` inicial es el cancel() de entrada
    } finally {
      vi.useRealTimers();
    }
  });

  it("MUTANTE M2 — con UN SOLO cue (el bug de superponer) el cardinal sería 1, no 3", () => {
    vi.useFakeTimers();
    try {
      const { ctl, cues } = harness(POISON_BLIP_MS);
      ctl.run(SCRIPT);
      vi.advanceTimersByTime(POISON_BLIP_MS * 4);
      expect(cues.length).toBe(SCRIPT.slots.length);
      expect(cues.length).not.toBe(1);
    } finally {
      vi.useRealTimers();
    }
  });

  it("bajo automatización (paso 0) suenan los N cues sin timers ni flash", () => {
    const { ctl, flashes, cues } = harness(0);
    ctl.run(SCRIPT);
    expect(cues.length).toBe(3);
    expect(flashes).toEqual([null]); // sólo el cancel() de entrada: nada que apagar después
  });

  it("cancel() a mitad apaga el flash y no deja sonar más", () => {
    vi.useFakeTimers();
    try {
      const { ctl, flashes, cues } = harness(POISON_BLIP_MS);
      ctl.run(SCRIPT);
      ctl.cancel();
      vi.advanceTimersByTime(POISON_BLIP_MS * 5);
      expect(cues.length).toBe(1);
      expect(flashes.at(-1)).toBe(null);
    } finally {
      vi.useRealTimers();
    }
  });

  it("un guión vacío no toca nada (no hay envenenados ⇒ el paso es mudo)", () => {
    const { ctl, cues } = harness(POISON_BLIP_MS);
    ctl.run({ slots: [] });
    expect(cues.length).toBe(0);
  });
});

describe("#213 · el cue reutilizado es el del binario, no uno nuevo", () => {
  it("`combat-damage` = noise_burst(10,1600,2000) del 0x2a68, y el paso = su duración", () => {
    // El catálogo ya tenía este cue atribuido a 0x2a52 @0x2a68: el fix EMITE el que
    // existe, no inventa otro. Y el espaciado entre miembros es exactamente su
    // duración renderizada — que es lo que el original tarda en el burst bloqueante.
    const segs = renderCue({ id: "combat-damage" });
    expect(segs.length).toBe(1);
    expect(segs[0]!.kind).toBe("noise");
    expect(segs[0]!.ms).toBeCloseTo(POISON_BLIP_MS, 6);
  });
});

describe("#213 · precedencia del vídeo inverso (rosterInvertRow, 0x2a28 compartida)", () => {
  it("el flash de daño GANA a los otros tres marcadores", () => {
    expect(
      rosterInvertRow({
        damageFlash: 4,
        ztatsCursor: 1,
        selectCursor: 2,
        combatActor: 3,
      }),
    ).toBe(4);
  });

  it("sin flash, la cadena previa queda INTACTA: ztats > select > actor de combate", () => {
    expect(
      rosterInvertRow({ ztatsCursor: 1, selectCursor: 2, combatActor: 3 }),
    ).toBe(1);
    expect(rosterInvertRow({ selectCursor: 2, combatActor: 3 })).toBe(2);
    expect(rosterInvertRow({ combatActor: 3 })).toBe(3);
    expect(rosterInvertRow({})).toBe(null);
  });

  it("el flash en la fila 0 NO se confunde con «sin flash» (0 es falsy, ?? no lo es)", () => {
    // La trampa de este predicado: con `||` en vez de `??`, el envenenado del SLOT 0 —
    // el Avatar, el caso más común — perdería su resalte y lo robaría el marcador de
    // debajo. El aserto instancia la diferencia DONDE EXISTE.
    expect(rosterInvertRow({ damageFlash: 0, selectCursor: 2 })).toBe(0);
  });

  it("MUTANTE M3 — la variante con `||` daría 2 en el caso del slot 0", () => {
    const conBarras = (m: {
      damageFlash?: number | null;
      selectCursor?: number | null;
    }) => m.damageFlash || m.selectCursor || null;
    expect(conBarras({ damageFlash: 0, selectCursor: 2 })).toBe(2); // el bug
    expect(rosterInvertRow({ damageFlash: 0, selectCursor: 2 })).toBe(0); // el código real
  });
});
