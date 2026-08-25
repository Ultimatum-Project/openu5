/**
 * Tests de las reglas EXACTAS de supervivencia/reloj/movimiento (Task 3.1).
 * Cada regla cita su derivación: re/notes/kernel-survival.md (asm) y los
 * escenarios de paridad DOSBox (re/parity/kernel/).
 */
import { describe, expect, it, vi } from "vitest";
import type {
  CharacterState,
  ExtractedInitialState,
  GameState,
} from "../src/core/state.js";
import { Game, type GameData } from "../src/core/game.js";
import {
  advanceClock,
  relocateShadowlordsAtMidnight,
  turnHousekeeping,
  igniteTorch,
  lightLevel,
  minutesPerAction,
  partyRandomDamage,
  MEAL_HOURS,
  TORCH_MINUTES,
  RING_OF_REGENERATION,
  ringRegenSweep,
} from "../src/core/world/survival.js";
import { advanceTurn, terrainSpeedClass, tryMove } from "../src/core/world/movement.js";
import type { ActiveMap, WorldData } from "../src/core/world/map.js";
import { OriginalRng } from "../src/core/rng-original.js";

function makeChar(over: Partial<CharacterState> = {}): CharacterState {
  return {
    name: "Test",
    gender: 0x0b,
    class: "A",
    status: "G",
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
    partyStatus: 0,
    ...over,
  };
}

function makeState(over: Partial<GameState> = {}): GameState {
  const base: Partial<GameState> = {
    characters: [makeChar(), makeChar({ name: "Iolo" }), makeChar({ name: "Shamino" })],
    partySize: 3,
    activeCharacter: 0,
    food: 100,
    time: { year: 139, month: 4, day: 7, hour: 8, minute: 35 },
    turnsSinceStart: 0,
    position: { location: 13, floor: 0, x: 15, y: 15 },
    transport: "foot",
    torchTurns: 0,
    torches: 2,
    prevHour: 8,
  };
  return { ...base, ...over } as GameState;
}

/** Mapa sintético: todo hierba (5) salvo lo que diga tiles. */
function flatMap(wraps: boolean, tiles: Record<string, number> = {}, fill = 5): ActiveMap {
  return {
    kind: wraps ? "large" : "small",
    location: wraps ? 0 : 13,
    floor: 0,
    width: wraps ? 256 : 32,
    height: wraps ? 256 : 32,
    wraps,
    tileAt: (x, y) => tiles[`${x},${y}`] ?? fill,
  } as ActiveMap;
}

const rngRand = (seed: number) => {
  const rng = new OriginalRng(seed);
  return (lo: number, hi: number) => rng.next(lo, hi);
};

describe("advanceClock (kernel_advance_clock 0x4F7C)", () => {
  it("suma minutos y consume antorcha/luz en MINUTOS", () => {
    const s = makeState({ torchTurns: 10, lightSpellMins: 3 });
    advanceClock(s, 2);
    expect(s.time.minute).toBe(37);
    expect(s.torchTurns).toBe(8);
    expect(s.lightSpellMins).toBe(1);
    advanceClock(s, 2);
    expect(s.lightSpellMins).toBe(0); // suelo 0 (counter_sub_u8)
  });

  it("guarda prevHour ANTES de avanzar (detección de cambio de hora)", () => {
    const s = makeState();
    s.time.minute = 59;
    advanceClock(s, 1);
    expect(s.prevHour).toBe(8);
    expect(s.time.hour).toBe(9);
    expect(s.time.minute).toBe(0);
  });

  it("rollover completo 23:59 + fin de mes 13 → año nuevo y monthsAtInn++", () => {
    const s = makeState();
    s.time = { year: 139, month: 13, day: 28, hour: 23, minute: 59 };
    advanceClock(s, 1);
    expect(s.time).toEqual({ year: 140, month: 1, day: 1, hour: 0, minute: 0 });
    expect(s.characters[0]!.monthsAtInn).toBe(1); // 0x5072: cap a 25
  });

  it("Quickness ('Q') divide el coste a la mitad, mínimo 1", () => {
    const s = makeState({ timeSpell: "Q" });
    advanceClock(s, 2);
    expect(s.time.minute).toBe(36); // 2>>1 = 1
    advanceClock(s, 1);
    expect(s.time.minute).toBe(37); // 1>>1=0 → 1
  });

  it("Time-stop ('T') congela el reloj y la antorcha", () => {
    const s = makeState({ timeSpell: "T", torchTurns: 10 });
    advanceClock(s, 2);
    expect(s.time.minute).toBe(35);
    expect(s.torchTurns).toBe(10);
  });

  // ★ #102 — el `return` del port con 'T' es una divergencia INERTE, y esto lo prueba.
  // El binario NO retorna: `0x4fa6 cmp [g_time_spell],0x54 / 0x4fab je 0x4fc8` salta al
  // test de rollover, cae por `0x4fcf jmp 0x50a1` y por tanto ALCANZA LA COLA — incluido
  // el refresco del latch lunar de 0x514a. El port hace `return` y no lo alcanza.
  // No se observa NUNCA porque la primera guarda de la cola es
  // `0x514a mov al,[g_prev_hour] / 0x514d cmp [g_hour],al / 0x5151 je` (salta si NO cambió
  // la hora), y con 'T' `g_prev_hour` se acaba de igualar a `g_hour` en 0x4fa0-0x4fa3
  // ANTES del test de 'T' — y la hora ya no se toca. ⇒ el flanco es siempre falso.
  it("#102: con 'T' el latch lunar no puede dispararse — el atajo del port es inerte", () => {
    const sky = { moonPhasesRaw: Array(56).fill(0x39), location: 0 };
    const s = makeState({ timeSpell: "T", torchTurns: 10 });
    s.time = { year: 139, month: 4, day: 7, hour: 9, minute: 59 };
    s.prevHour = 8; // flanco ABIERTO al entrar: si el atajo importara, se vería aquí
    s.feluccaPhase = 0x30;
    s.trammelPhase = 0x30;

    advanceClock(s, 5, rngRand(1), sky);

    // El snapshot SÍ ocurre (0x4fa3), y cierra el flanco él solo.
    expect(s.prevHour).toBe(9);
    expect(s.time.hour).toBe(9);
    expect(s.prevHour).toBe(s.time.hour); // ⇒ 0x5151 `je` SIEMPRE salta con 'T'
    // Y por tanto el latch no se toca, alcanzase o no la cola.
    expect(s.feluccaPhase).toBe(0x30);
    expect(s.trammelPhase).toBe(0x30);
    // Lo demás de 'T', ya cubierto arriba: ni reloj ni antorcha.
    expect(s.time.minute).toBe(59);
    expect(s.torchTurns).toBe(10);
  });

  it("medianoche con rand vivo re-sortea Shadowlords (0x4FF5); sin rand no", () => {
    // Sin rand (caller puro): el cruce de medianoche NO reubica.
    const pure = makeState({ shadowlordLocs: [1, 2, 3] });
    pure.time = { year: 139, month: 4, day: 7, hour: 23, minute: 59 };
    advanceClock(pure, 1);
    expect(pure.time.hour).toBe(0);
    expect(pure.shadowlordLocs).toEqual([1, 2, 3]); // sin re-roll

    // Con rand vivo: cada Shadowlord con loc<0x80 recibe town nuevo 1..8.
    const live = makeState({ shadowlordLocs: [1, 2, 3] });
    live.position.location = 5; // g_location a evitar
    live.time = { year: 139, month: 4, day: 7, hour: 23, minute: 59 };
    advanceClock(live, 1, rngRand(0x777));
    for (const loc of live.shadowlordLocs!) {
      expect(loc).toBeGreaterThanOrEqual(1);
      expect(loc).toBeLessThanOrEqual(8);
      expect(loc).not.toBe(5); // != g_location
    }
    // != entre sí (bucle de reintento 0x5004).
    const set = new Set(live.shadowlordLocs);
    expect(set.size).toBe(3);
    // 🔴 Y QUE HAYA REUBICADO DE VERDAD. Sin esta línea el test es VACUO: con
    // `[1,2,3]` de partida, los tres asertos de arriba (rango 1..8 · != 5 · tres
    // distintos) los cumple el array SIN TOCAR, así que borrar la llamada a
    // `relocateShadowlordsAtMidnight` desde advanceClock dejaba el test VERDE
    // (mutante M6, superviviente medido). Con #101-bis ningún slot conserva su
    // valor, así que se puede exigir slot a slot.
    expect(live.shadowlordLocs).not.toEqual([1, 2, 3]);
    for (let i = 0; i < 3; i++) expect(live.shadowlordLocs![i]).not.toBe(i + 1);
  });

  it("re-roll de medianoche dispara EXACTAMENTE una vez por cruce (exactly-once)", () => {
    // Dos advanceClock en el mismo paso lento: sólo el que cruza 23→0 reubica.
    const s = makeState({ shadowlordLocs: [1, 2, 3] });
    s.position.location = 8;
    s.time = { year: 139, month: 4, day: 7, hour: 23, minute: 58 };
    // El "extra" de terreno lento cruza medianoche → reubica.
    advanceClock(s, 4, rngRand(0x123));
    const afterFirst = [...s.shadowlordLocs!];
    expect(s.time.hour).toBe(0);
    // El coste base ya NO cruza medianoche (0:02 → 0:04): NO vuelve a reubicar.
    advanceClock(s, 2, rngRand(0x999));
    expect(s.shadowlordLocs).toEqual(afterFirst);
  });

  it("un Shadowlord destruido (loc>=0x80) no se reubica a medianoche", () => {
    const s = makeState({ shadowlordLocs: [0x80, 2, 3] });
    s.position.location = 7;
    relocateShadowlordsAtMidnight(s, rngRand(0x44));
    expect(s.shadowlordLocs![0]).toBe(0x80); // ausente: intacto
    expect(s.shadowlordLocs![1]).toBeLessThanOrEqual(8);
    expect(s.shadowlordLocs![2]).toBeLessThanOrEqual(8);
  });

  /** Única semilla de 16 bits con `OriginalRng` estancado — ver el test 🔴 del final. */
  const SEMILLA_PUNTO_FIJO = 20;

  // ★ #101-bis — EL CANDIDATO SE COMPARA TAMBIÉN CONTRA EL PROPIO SLOT.
  // El bucle interno del binario recorre `si = 0..2` (0x5020 `mov al,[si+0x58c8]` …
  // 0x502d `cmp si,3` / 0x5030 `jl`), o sea LOS TRES slots — y la escritura del slot
  // que se está reubicando es POSTERIOR (0x5044), así que en el momento de comparar
  // ahí sigue su valor VIEJO. Un candidato igual a la ciudad donde el Shadowlord YA
  // está se anula (0x502a `sub cx,cx`) y `0x5037 or di,di / 0x5039 je 0x5004` vuelve
  // a tirar. El port comparaba sólo los otros dos, así que aceptaba «quedarse».
  it("#101-bis: un candidato igual a la ciudad ACTUAL del propio Shadowlord se rechaza y RE-TIRA", () => {
    // Sólo el slot 0 vivo: los otros dos a 0x80 para que no puedan ser la causa del
    // rechazo. party=1 != 4, así que g_location tampoco lo es. Queda una sola causa
    // posible: la comparación contra el propio slot.
    const s = makeState({ shadowlordLocs: [4, 0x80, 0x80] });
    s.position.location = 1;

    const guion = [4, 6]; // 1ª tirada = SU PROPIA ciudad → rechazo; 2ª = 6 → aceptada
    let tiradas = 0;
    const rand = (lo: number, hi: number) => {
      expect([lo, hi]).toEqual([1, 8]); // 0x5004 push 1 / 0x5008 push 8
      const v = guion[tiradas++];
      if (v === undefined) throw new Error(`tirada ${tiradas} fuera de guion`);
      return v;
    };

    relocateShadowlordsAtMidnight(s, rand);

    // (a) aserto de CONTEO: el rechazo cuesta una tirada extra.
    expect(tiradas).toBe(2);
    // (b) aserto de DESTINO: acaba en la 2ª, no en la suya.
    expect(s.shadowlordLocs![0]).toBe(6);
  });

  it("#101-bis: ningún Shadowlord conserva su ciudad tras el re-sorteo (propiedad, 300 semillas)", () => {
    // El binario da CERO «se queda» sobre 60.000 reubicaciones — es estructural, no
    // estadístico. Aquí basta un barrido: cualquier «se queda» delata la comparación
    // que falta.
    const inicio = [4, 2, 7];
    for (let seed = 1; seed <= 300; seed++) {
      if (seed === SEMILLA_PUNTO_FIJO) continue; // ver el test de abajo: colgaría
      const s = makeState({ shadowlordLocs: [...inicio] });
      s.position.location = 1;
      relocateShadowlordsAtMidnight(s, rngRand(seed));
      for (let i = 0; i < 3; i++) {
        expect(s.shadowlordLocs![i]).not.toBe(inicio[i]);
      }
    }
  });

  // 🔴 EL REINTENTO SIN COTA ES LITERALMENTE SIN COTA — y hay UNA semilla que lo cuelga.
  // Descubierto al escribir el test de arriba: con `seed=20` el barrido se colgó, y la
  // causa NO era el arreglo sino el generador. `OriginalRng(20)` es un PUNTO FIJO:
  //   x = (20 + 0x9248) = 0x925C → ror3 = 0x924B → ^0x9248 = 0x0003 → +0x11 = 20
  // La semilla no avanza NUNCA, así que `next(lo,hi)` devuelve una constante para
  // siempre. Con el reintento del binario (0x5039 `je 0x5004`, sin contador) eso es un
  // bucle infinito en cuanto la constante choque con g_location o con un slot.
  // Medido sobre el espacio ENTERO de 16 bits: es el ÚNICO punto fijo, su ÚNICA
  // preimagen es él mismo (nadie cae dentro dando pasos) y el ciclo del stream vivo
  // (`OriginalRng(0)`, game.ts:616) tiene 47.343 estados y NO lo contiene.
  // ⇒ sólo se entra por un `srand(20)` explícito — y el juego re-siembra del reloj de
  // pared al acampar (ficha #60). Alcanzabilidad estrecha, consecuencia total: se
  // congela el RNG del juego ENTERO, no sólo este bucle.
  // NO se le pone cota al bucle: el binario no la tiene y ponerla sería divergencia.
  // Se DECLARA y se prueba, que es lo que se puede sostener con el binario delante.
  it("🔴 semilla 20 = punto fijo único del generador (por qué el reintento sin cota es un riesgo real)", () => {
    const rng = new OriginalRng(SEMILLA_PUNTO_FIJO);
    for (let k = 0; k < 1000; k++) expect(rng.next(1, 8)).toBe(5); // constante
    expect(new OriginalRng(SEMILLA_PUNTO_FIJO).nextRaw16()).toBe(SEMILLA_PUNTO_FIJO);

    // Único en los 16 bits, y con una sola preimagen: la suya.
    let puntosFijos = 0;
    let preimagenes = 0;
    for (let s = 0; s <= 0xffff; s++) {
      const sig = new OriginalRng(s).nextRaw16();
      if (sig === s) puntosFijos++;
      if (sig === SEMILLA_PUNTO_FIJO) preimagenes++;
    }
    expect(puntosFijos).toBe(1);
    expect(preimagenes).toBe(1); // sólo él mismo ⇒ no se cae dentro dando pasos
  });
});

describe("turnHousekeeping (kernel_turn_housekeeping 0x2AE8)", () => {
  it("a las 6/12/18 (cambio de hora) descuenta comida por miembro vivo no D/S", () => {
    expect(MEAL_HOURS).toEqual([6, 12, 18]);
    const s = makeState();
    s.characters[1]!.status = "D"; // muerto: no come
    s.time.hour = 12;
    s.prevHour = 11;
    const msgs = turnHousekeeping(s, rngRand(1));
    expect(msgs).toEqual([]);
    expect(s.food).toBe(98); // 2 comensales (G + G)
    expect(s.prevHour).toBe(12);
  });

  it("cambio de hora que no es comida NO descuenta comida", () => {
    const s = makeState();
    s.time.hour = 9;
    s.prevHour = 8;
    turnHousekeeping(s, rngRand(1));
    expect(s.food).toBe(100);
  });

  it("sin cambio de hora no hay comida ni hambre", () => {
    const s = makeState({ food: 0 });
    const msgs = turnHousekeeping(s, rngRand(1));
    expect(msgs).toEqual([]);
  });

  it("Starving!: food==0 y cambio de hora → rand(1,8) de daño por miembro vivo", () => {
    const s = makeState({ food: 0 });
    s.time.hour = 9;
    s.prevHour = 8;
    // Réplica exacta de la secuencia RNG del original
    const rngA = new OriginalRng(0x1234);
    const expected = [rngA.next(1, 8), rngA.next(1, 8), rngA.next(1, 8)];
    const msgs = turnHousekeeping(s, rngRand(0x1234));
    expect(msgs).toEqual(["Starving!"]);
    expect(s.characters.map((c) => 50 - c.currentHp)).toEqual(expected);
  });

  it("veneno 'P': 1 HP por turno y muerte a 0 con status 'D'", () => {
    const s = makeState();
    s.characters[0]!.status = "P";
    s.characters[0]!.currentHp = 1;
    turnHousekeeping(s, rngRand(1));
    expect(s.characters[0]!.currentHp).toBe(0);
    expect(s.characters[0]!.status).toBe("D");
    expect(s.activeCharacter).toBe(0xff); // era el activo
  });

  it("anillo de regeneración (id 44): +1 HP cuando rand(0,7)==7", () => {
    const s = makeState();
    s.characters[0]!.ring = RING_OF_REGENERATION;
    s.characters[0]!.currentHp = 10;
    // Busca una semilla cuyo primer rand(0,7) sea 7
    let seed = 0;
    for (; seed < 100; seed++) {
      if (new OriginalRng(seed).next(0, 7) === 7) break;
    }
    turnHousekeeping(s, rngRand(seed));
    expect(s.characters[0]!.currentHp).toBe(11);
  });

  // ringRegenSweep = la lógica COMPARTIDA por los 3 callers del binario (mundo 0x2BCA,
  // combate 0x6794→0x67F6, camp 0x0207). kernel_ring_regen 0x400C.
  describe("ringRegenSweep (0x400C) — lógica compartida de los 3 callers", () => {
    const members = (rings: number[], statuses?: string[]) =>
      rings.map((ring, i) => ({ ring, status: statuses?.[i] ?? "G" }));

    it("sólo el miembro con el anillo (44) rola; heal en ==7 (1/8)", () => {
      const heals: number[] = [];
      // rand siempre 7 → todo miembro-con-anillo cura.
      ringRegenSweep(members([0xff, RING_OF_REGENERATION, 0xff]), 3, () => 7, (i) => heals.push(i));
      expect(heals).toEqual([1]);
    });

    it("sin anillo NO consume rands (gate ANTES del rand) — sellos intactos", () => {
      let rolls = 0;
      ringRegenSweep(members([0xff, 0xff, 0xff]), 3, () => { rolls++; return 7; }, () => {});
      expect(rolls).toBe(0); // ninguna tirada: nadie lleva el anillo
    });

    it("resultado != 7 no cura (7/8)", () => {
      const heals: number[] = [];
      ringRegenSweep(members([RING_OF_REGENERATION]), 1, () => 6, (i) => heals.push(i));
      expect(heals).toEqual([]);
    });

    it("miembro muerto ('D') no rola ni cura, aunque lleve el anillo", () => {
      let rolls = 0;
      const heals: number[] = [];
      ringRegenSweep(members([RING_OF_REGENERATION], ["D"]), 1, () => { rolls++; return 7; }, (i) => heals.push(i));
      expect(rolls).toBe(0);
      expect(heals).toEqual([]);
    });

    it("recorre EN ORDEN 0..N y respeta count (g_party_size)", () => {
      const order: number[] = [];
      ringRegenSweep(
        members([RING_OF_REGENERATION, RING_OF_REGENERATION, RING_OF_REGENERATION]),
        2, // sólo 2 miembros en el party
        () => 7,
        (i) => order.push(i),
      );
      expect(order).toEqual([0, 1]); // el 3º queda fuera del party (count=2)
    });
  });

  it("partyRandomDamage respeta a los muertos", () => {
    const s = makeState();
    s.characters[1]!.status = "D";
    s.characters[1]!.currentHp = 0;
    partyRandomDamage(s, () => 8);
    expect(s.characters[0]!.currentHp).toBe(42);
    expect(s.characters[1]!.currentHp).toBe(0);
    expect(s.characters[2]!.currentHp).toBe(42);
  });
});

describe("igniteTorch (CMDS.OVL 0x0D98)", () => {
  it("fuera de mazmorra: 240 minutos FIJOS y consume una antorcha", () => {
    const s = makeState({ torchTurns: 33 });
    expect(igniteTorch(s, rngRand(1))).toBeNull();
    expect(s.torchTurns).toBe(TORCH_MINUTES); // = 240, no acumula
    expect(s.torches).toBe(1);
  });

  it("en mazmorra (loc 33..40): +112+rand(0,15) saturando en 255", () => {
    const s = makeState();
    s.position.location = 0x21;
    s.torchTurns = 200;
    igniteTorch(s, () => 15);
    expect(s.torchTurns).toBe(255); // 200+127 → cap
    s.torchTurns = 0;
    igniteTorch(s, () => 0);
    expect(s.torchTurns).toBe(112);
  });

  it("sin antorchas: 'None owned!'", () => {
    const s = makeState({ torches: 0, torchTurns: 5 });
    expect(igniteTorch(s, rngRand(1))).toBe("None owned!");
    expect(s.torchTurns).toBe(5);
  });
});

describe("lightLevel (kernel 0x50A1)", () => {
  const at = (hour: number, minute: number, over: Partial<GameState> = {}) => {
    const s = makeState(over);
    s.time.hour = hour;
    s.time.minute = minute;
    return lightLevel(s);
  };
  it("noche 2, día 50, rampa a las 5 y 19", () => {
    expect(at(23, 0)).toBe(2);
    expect(at(4, 59)).toBe(2);
    expect(at(12, 0)).toBe(50);
    expect(at(5, 0)).toBe(2);
    expect(at(5, 15)).toBe(5);
    expect(at(5, 59)).toBe(49);
    expect(at(19, 0)).toBe(49);
    expect(at(19, 59)).toBe(2);
  });
  it("mínimos por antorcha (10) y hechizo de luz (18)", () => {
    expect(at(23, 0, { torchTurns: 5 })).toBe(10);
    expect(at(23, 0, { lightSpellMins: 5 })).toBe(18);
    expect(at(12, 0, { torchTurns: 5 })).toBe(50); // no baja el día
  });
  it("location 25 y underworld siempre a oscuras", () => {
    const s = makeState();
    s.time.hour = 12;
    s.position.location = 25;
    expect(lightLevel(s)).toBe(2);
    s.position.location = 0;
    s.position.floor = 0xff;
    expect(lightLevel(s)).toBe(2);
  });
  it("los SÓTANOS (planta z=-1) están a oscuras aunque sea de día (0x50BA byte)", () => {
    // g_floor se compara como byte sin signo: -1 → 0xFF > 0x7F → oscuro. Sótanos
    // de Yew / LB / Blackthorn / Serpent's Hold (z=-1). Planta baja (0) = día.
    const s = makeState();
    s.time.hour = 12;
    s.position.location = 6; // un pueblo cualquiera
    s.position.floor = -1; // sótano
    expect(lightLevel(s)).toBe(2);
    s.position.floor = 0; // planta baja
    expect(lightLevel(s)).toBe(50);
    s.position.floor = 2; // planta alta
    expect(lightLevel(s)).toBe(50);
  });
});

describe("movimiento exacto (MAINOUT/TOWN, kernel-survival.md §5)", () => {
  it("pueblo: 1 min por paso; bloqueado también consume 1 min", () => {
    const s = makeState();
    const map = flatMap(false, { "15,14": 77 /* muro: no transitable */ });
    let r = tryMove(s, map, "south", rngRand(1));
    expect(r.moved).toBe(true);
    expect(s.time.minute).toBe(36);
    r = tryMove(s, map, "north", rngRand(1)); // vuelve a 15,15
    s.position = { location: 13, floor: 0, x: 15, y: 15 };
    const before = s.time.minute;
    r = tryMove(s, map, "north", rngRand(1)); // 15,14 = muro
    expect(r.moved).toBe(false);
    expect(r.message).toBe("Blocked!");
    expect(s.time.minute).toBe(before + 1); // TOWN 0x15D4: cobra el minuto
  });

  it("exterior: 2 min por paso normal; bloqueado NO consume tiempo ni turno", () => {
    const s = makeState();
    s.position = { location: 0, floor: 0, x: 100, y: 100 };
    const map = flatMap(true, { "100,99": 1 /* agua */ });
    let r = tryMove(s, map, "south", rngRand(1));
    expect(r.moved).toBe(true);
    expect(s.time.minute).toBe(37); // +2
    expect(s.turnsSinceStart).toBe(1);
    const turns = s.turnsSinceStart;
    r = tryMove(s, map, "north", rngRand(1)); // de vuelta… primero recolócate
    s.position = { location: 0, floor: 0, x: 100, y: 100 };
    const min = s.time.minute;
    r = tryMove(s, map, "north", rngRand(1)); // agua = bloqueado
    expect(r.moved).toBe(false);
    expect(r.message).toBe("Blocked!");
    expect(s.time.minute).toBe(min); // MAINOUT 0xC30: sin coste
    expect(s.turnsSinceStart).toBe(2); // solo los 2 pasos válidos
    expect(turns).toBe(1); // capturado tras el primer paso
  });

  it("terreno lento: clase 1 (+2, Slow progress!) y clase 2 (+4, Very slow!)", () => {
    expect(terrainSpeedClass(5)).toBe(0);
    for (const t of [4, 6, 7, 8, 0x1e, 0x1f]) expect(terrainSpeedClass(t)).toBe(1);
    for (let t = 9; t <= 0xf; t++) expect(terrainSpeedClass(t)).toBe(2);
    expect(terrainSpeedClass(0x10)).toBe(0);

    const s = makeState();
    s.position = { location: 0, floor: 0, x: 100, y: 100 };
    const map = flatMap(true, { "100,101": 8, "100,102": 9 });
    let r = tryMove(s, map, "south", rngRand(1)); // bosque (clase 1)
    expect(r.message).toBe("Slow progress!");
    expect(s.time.minute).toBe(39); // 35 + 4
    r = tryMove(s, map, "south", rngRand(1)); // montaña baja (clase 2)
    expect(r.message).toBe("Very slow!");
    expect(s.time.minute).toBe(45); // +6
  });

  it("terreno lento: el advance_clock extra es una llamada SEPARADA — un cruce de hora dentro del tramo lento es invisible al housekeeping", () => {
    // Original: MAINOUT 0x461 advance_clock(4) [muy lento, re-snapshotea
    // g_prev_hour] y DESPUÉS el bucle 0xC39 advance_clock(2). Paso muy
    // lento a las 5:58 → 6:04, pero el cruce 5→6 cae en la llamada extra:
    // g_prev_hour queda en 6 antes de la llamada base y el housekeeping
    // NO ve el cambio de hora (ni comida de las 6:00 ni Starving!).
    const s = makeState({ food: 100 });
    s.time.hour = 5;
    s.time.minute = 58;
    s.prevHour = 5;
    s.position = { location: 0, floor: 0, x: 100, y: 100 };
    const map = flatMap(true, { "100,101": 9 /* clase 2 */ });
    const r = tryMove(s, map, "south", rngRand(1));
    expect(r.message).toBe("Very slow!");
    expect(s.time.hour).toBe(6);
    expect(s.time.minute).toBe(4);
    expect(s.food).toBe(100); // el original NO descuenta la comida aquí
    expect(r.sideMessages).toEqual([]);
  });

  it("wrap 256×256 en ambos ejes (byte natural del original)", () => {
    const s = makeState();
    s.position = { location: 0, floor: 0, x: 0, y: 0 };
    const map = flatMap(true);
    tryMove(s, map, "west", rngRand(1));
    expect(s.position.x).toBe(255);
    s.position = { location: 0, floor: 0, x: 0, y: 0 };
    tryMove(s, map, "north", rngRand(1));
    expect(s.position.y).toBe(255);
    tryMove(s, map, "south", rngRand(1));
    expect(s.position.y).toBe(0);
  });

  it("salir por el borde de un pueblo no consume minuto", () => {
    const s = makeState();
    s.position = { location: 13, floor: 0, x: 0, y: 15 };
    const r = tryMove(s, flatMap(false), "west", rngRand(1));
    expect(r.exitedMap).toBe(true);
    expect(s.time.minute).toBe(35);
    expect(s.turnsSinceStart).toBe(0);
  });

  it("minutesPerAction: 1 pueblo, 2 exterior; advanceTurn integra reloj+housekeeping", () => {
    expect(minutesPerAction(13)).toBe(1);
    expect(minutesPerAction(0)).toBe(2);
    const s = makeState({ food: 0 });
    s.time.hour = 5;
    s.time.minute = 59;
    s.prevHour = 5;
    s.position = { location: 0, floor: 0, x: 100, y: 100 };
    const msgs = advanceTurn(s, undefined, rngRand(0x42)); // 2 min → 6:01, cambia hora
    expect(s.time.hour).toBe(6);
    expect(msgs).toEqual(["Starving!"]); // hambre en el cambio de hora
  });

  it("terreno lento: MoveResult declara los turnos EXTRA del mundo (MAINOUT 0x448/0x468)", () => {
    const s = makeState();
    s.position = { location: 0, floor: 0, x: 100, y: 100 };
    const map = flatMap(true, { "100,101": 8, "100,102": 9, "100,103": 5 });
    expect(tryMove(s, map, "south", rngRand(1)).extraWorldTurns).toBe(1); // clase 1
    expect(tryMove(s, map, "south", rngRand(1)).extraWorldTurns).toBe(2); // clase 2
    expect(tryMove(s, map, "south", rngRand(1)).extraWorldTurns).toBeUndefined(); // normal
  });
});

describe("Game: turnos extra de monstruos y coste de turno de Ignite (fixes 3.1)", () => {
  /** Overworld sintético 256×256 de hierba (5) con overrides puntuales. */
  function makeWorld(tiles: Record<string, number> = {}): WorldData {
    const overworld = Array.from({ length: 256 }, (_, y) =>
      Array.from({ length: 256 }, (_, x) => tiles[`${x},${y}`] ?? 5),
    );
    return { overworld, underworld: overworld, smallMaps: new Map() };
  }
  const gameData: GameData = { locationsX: [], locationsY: [], locationNames: [] };
  const makeGame = (s: GameState, tiles: Record<string, number> = {}): Game =>
    new Game({} as ExtractedInitialState, makeWorld(tiles), gameData, s);

  it("el world_turn (outdoorWorldTurn) corre 1/2 veces EXTRA en terreno lento — los monstruos se mueven esas veces adicionales", () => {
    // El world-turn se dirige por runContextTurn: el terreno lento corre speed ×
    // outdoorWorldTurn (call 0x1A60) tras el viento (afterWind, MAINOUT 0x3E0) y
    // luego el world_turn FINAL (0xD11) → outdoorWorldTurn se llama speed+1 veces
    // por paso (conteos 2/3/1 según clase 1/2/0). Cada llamada rueda su gate de
    // spawn rand(1,30) (finding #1) — por eso el world_turn es la unidad medida.
    const s = makeState();
    s.position = { location: 0, floor: 0, x: 100, y: 100 };
    const game = makeGame(s, { "100,101": 8, "100,102": 9, "100,103": 5 });
    const spy = vi.spyOn(
      game as unknown as { outdoorWorldTurn: () => unknown[] },
      "outdoorWorldTurn",
    );

    game.move("south"); // clase 1 → 1 world-turn extra + el final
    expect(spy).toHaveBeenCalledTimes(2);
    spy.mockClear();
    game.move("south"); // clase 2 → 2 world-turns extra + el final
    expect(spy).toHaveBeenCalledTimes(3);
    spy.mockClear();
    game.move("south"); // normal → solo el world-turn final
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it("Ignite consume el turno estándar, también al fallar (dispatcher devuelve consumido)", () => {
    const s = makeState({ torches: 1 }); // pueblo (loc 13): 1 min/acción, 8:35
    const game = makeGame(s);

    let events = game.ignite();
    // ÉXITO: el binario NO imprime resultado (CMDS 0x0D98 solo emite "None owned!" al
    // fallar); "Torch ignited!" era FABRICADO. El eco ">Ignite torch!" lo pone el dispatch
    // (main.ts hud.echo), no game.ignite(). #77.
    expect(events.some((e) => e.kind === "message" && e.text === "Torch ignited!")).toBe(false);
    expect(s.torches).toBe(0);
    expect(s.time.minute).toBe(36); // +1 min: el comando cobra turno
    expect(s.torchTurns).toBe(239); // 240 fijos y el minuto del propio turno ya consume 1
    expect(s.turnsSinceStart).toBe(1);

    events = game.ignite(); // sin antorchas
    expect(events.some((e) => e.kind === "message" && e.text === "None owned!")).toBe(true);
    expect(s.time.minute).toBe(37); // el fallo TAMBIÉN cobra el turno
    expect(s.torchTurns).toBe(238);
  });
});
