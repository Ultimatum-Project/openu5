/**
 * Intérprete de bytecode de animación (`render/tileprog.ts`, calco de `0x4552`).
 * Verifica la semántica de opcodes contra los programas REALES + el gate/PRNG.
 */
import { describe, expect, it } from "vitest";
import {
  ViewPrng,
  initProgState,
  tickProg,
  progBase,
  PROGRAM_BY_BASE,
  ENABLED_PROGRAM_BASES,
  TileProgRunner,
  ACTOR_PROGRAM_BY_BASE,
  ENABLED_ACTOR_BASES,
  ActorProgRunner,
} from "../src/render/tileprog.js";

/** PRNG de prueba con secuencia fija (o valor constante) — inyecta `next255`. */
function mockPrng(values: number | number[]): { next255: () => number } {
  if (typeof values === "number") return { next255: () => values };
  let i = 0;
  return { next255: () => values[i++ % values.length]! };
}

describe("tickProg — opcodes show-frame + delay (fuego 01 02 03 04 87)", () => {
  const fire = [0x01, 0x02, 0x03, 0x04, 0x87];
  const pass = mockPrng(0xff) as unknown as ViewPrng; // gate siempre pasa (0xff>=0x80)

  it("cicla base+0..base+3, luego mantiene el último frame durante el delay", () => {
    const st = initProgState(0xb0);
    const frames: number[] = [];
    for (let i = 0; i < 14; i++) {
      tickProg(st, fire, pass);
      frames.push(st.frame);
    }
    // 4 frames + delay 7 (mantiene 0xb3) + reinicia a 0xb0.
    expect(frames.slice(0, 5)).toEqual([0xb0, 0xb1, 0xb2, 0xb3, 0xb3]);
    // durante el delay el frame no cambia
    expect(frames.slice(4, 12).every((f) => f === 0xb3)).toBe(true);
    // tras expirar el timer, reinicia el ciclo
    expect(frames[12]).toBe(0xb0);
  });

  it("el delay fija el timer y se decrementa (espera) sin avanzar el frame", () => {
    const st = initProgState(0xb0);
    for (let i = 0; i < 4; i++) tickProg(st, fire, pass); // consume frames 0..3
    tickProg(st, fire, pass); // ejecuta el delay 0x87 → timer 7
    expect(st.timer).toBe(7);
    const frameAtDelay = st.frame;
    tickProg(st, fire, pass); // timer 7→6 (espera)
    expect(st.timer).toBe(6);
    expect(st.frame).toBe(frameAtDelay);
  });
});

describe("tickProg — gate RNG del 50 %", () => {
  const fire = [0x01, 0x02, 0x03, 0x04, 0x87];

  it("si rand<0x80 no avanza (gate falla)", () => {
    const st = initProgState(0xb0);
    tickProg(st, fire, mockPrng(0x00) as unknown as ViewPrng);
    expect(st.frame).toBe(0xb0); // frame inicial, sin cambio
    expect(st.pc).toBe(0);
  });

  it("bases 0x5c/0xa8 ejecutan SIN gate", () => {
    // base 0x5c: aunque el prng diga 0x00 (gate fallaría), ejecuta directo.
    const st = initProgState(0x5c);
    tickProg(st, [0x01, 0x02], mockPrng(0x00) as unknown as ViewPrng);
    expect(st.frame).toBe(0x5c); // op1 → base+0
    expect(st.pc).toBe(1);
  });
});

describe("tickProg — opcode 5 (bifurcación 75/25) y hoguera", () => {
  const bonfire = [0x02, 0x03, 0x04, 0x03, 0x02, 0x05];

  it("op5 con rand>=0x40 avanza el PC (reinicia el ciclo del programa)", () => {
    const st = initProgState(0xdc);
    st.pc = 5; // apunta al op5 final
    st.timer = 0;
    // gate pasa (0xff) y luego op5 rand 0x40 → avanza PC (a 6 → fin → op0 → pc0)
    tickProg(st, bonfire, mockPrng([0xff, 0x40]) as unknown as ViewPrng);
    // tras avanzar PC más allá del fin, op0 reinicia a 0 y muestra frame base+1
    expect(st.frame).toBe(0xdc + 1);
  });

  it("op5 con rand<0x40 pone frame=base y timer=6", () => {
    const st = initProgState(0xdc);
    st.pc = 5;
    tickProg(st, bonfire, mockPrng([0xff, 0x00]) as unknown as ViewPrng);
    expect(st.frame).toBe(0xdc); // frame "apagado" (base)
    expect(st.timer).toBe(6);
  });
});

describe("tickProg — guardas y máscara de nibble", () => {
  it("base<0x34 no anima (guarda del original)", () => {
    const st = initProgState(0x14); // SmallCastle, base<0x34
    tickProg(st, [0x01, 0x02, 0x03, 0x04], mockPrng(0xff) as unknown as ViewPrng);
    expect(st.frame).toBe(0x14);
    expect(st.pc).toBe(0);
  });

  it("timer==0xf es centinela (salta)", () => {
    const st = initProgState(0xb0);
    st.timer = 0xf;
    tickProg(st, [0x01], mockPrng(0xff) as unknown as ViewPrng);
    expect(st.frame).toBe(0xb0);
    expect(st.timer).toBe(0xf);
  });
});

describe("ViewPrng — local, determinista, no toca el stream global", () => {
  it("mismo seed → misma secuencia; rango [0,0xff]", () => {
    const a = new ViewPrng(0xdead);
    const b = new ViewPrng(0xdead);
    for (let i = 0; i < 100; i++) {
      const v = a.next255();
      expect(v).toBe(b.next255());
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(0xff);
    }
  });
});

describe("datos + runner", () => {
  it("progBase alinea a 4", () => {
    expect(progBase(0xb2)).toBe(0xb0);
    expect(progBase(0xdd)).toBe(0xdc);
  });

  it("programas confirmados en vivo presentes (antorcha, hoguera)", () => {
    expect(PROGRAM_BY_BASE.get(0xb0)).toEqual([0x01, 0x02, 0x03, 0x04, 0x87]);
    expect(PROGRAM_BY_BASE.get(0xdc)).toEqual([0x02, 0x03, 0x04, 0x03, 0x02, 0x05]);
  });

  it("ENABLED vacío por diseño ⇒ el runner NO altera ningún tile (sin morphing)", () => {
    expect(ENABLED_PROGRAM_BASES.size).toBe(0);
    const r = new TileProgRunner(121);
    // aunque 0xb0 tiene programa, no está habilitado → devuelve el tile tal cual.
    expect(r.frameFor(60, 0xb0)).toBe(0xb0);
    r.tick();
    expect(r.frameFor(60, 0xb0)).toBe(0xb0);
  });
});

describe("banco alto — el frame re-suma el banco de sprite (0x100)", () => {
  const pass = mockPrng(0xff) as unknown as ViewPrng;

  it("un actor (base 0x70 = Guard, banco 0x100) muestra frames 0x170..0x173", () => {
    // Guard: 02 84 03 84 04 84 05 (delay 4 entre cada frame).
    const guard = [0x02, 0x84, 0x03, 0x84, 0x04, 0x84, 0x05];
    const st = initProgState(0x70, 0x100);
    expect(st.frame).toBe(0x170); // frame inicial = banco|base
    tickProg(st, guard, pass); // op2 → base+1
    expect(st.frame).toBe(0x171);
    // op 0x84 fija delay 4 (frame se mantiene), luego op3 → base+2.
    // tick: fija delay(4) · 4 esperas (4→0) · ejecuta op3 = 6 llamadas.
    for (let i = 0; i < 6; i++) tickProg(st, guard, pass);
    expect(st.frame).toBe(0x172); // op3 → base+2 (con el banco 0x100 re-sumado)
  });

  it("bank=0 (banco bajo) mantiene el comportamiento previo byte-idéntico", () => {
    const fire = [0x01, 0x02, 0x03, 0x04, 0x87];
    const st = initProgState(0xb0); // sin banco
    tickProg(st, fire, pass);
    expect(st.frame).toBe(0xb0);
  });
});

describe("ActorProgRunner — intérprete por-actor del banco alto (idle NPCs)", () => {
  it("datos del oráculo presentes (Fighter/Towns/Merchant/Avatar progid0, Guard progid5)", () => {
    expect(ACTOR_PROGRAM_BY_BASE.get(0x48)).toEqual([0x02, 0x03, 0x04, 0x05]);
    expect(ACTOR_PROGRAM_BY_BASE.get(0x54)).toEqual([0x02, 0x03, 0x04, 0x05]);
    expect(ACTOR_PROGRAM_BY_BASE.get(0x70)).toEqual([0x02, 0x84, 0x03, 0x84, 0x04, 0x84, 0x05]);
    for (const b of [0x48, 0x4c, 0x50, 0x54, 0x70]) expect(ENABLED_ACTOR_BASES.has(b)).toBe(true);
  });

  it("frame inicial = tile base (primer render idéntico, determinismo intacto)", () => {
    const r = new ActorProgRunner();
    // Fighter 0x148: aún sin tick, el frame es el propio tile → sin cambio visual.
    expect(r.frameFor("npc1", 0x148)).toBe(0x148);
  });

  it("tras ticks, un Fighter (0x148) cicla dentro de su grupo del banco alto (0x148..0x14b)", () => {
    const r = new ActorProgRunner(0xabcd);
    r.sync([{ id: "npc1", tile: 0x148 }]);
    const seen = new Set<number>();
    for (let i = 0; i < 200; i++) {
      r.tick();
      seen.add(r.frameFor("npc1", 0x148));
    }
    // Todos los frames observados pertenecen al grupo del actor (mismo banco alto).
    for (const f of seen) {
      expect(f).toBeGreaterThanOrEqual(0x148);
      expect(f).toBeLessThanOrEqual(0x14b);
    }
    // Y de hecho SÍ animó (más de un frame distinto en 200 llamadas).
    expect(seen.size).toBeGreaterThan(1);
  });

  it("Wizard 0x140 SÍ cicla (progid 0 — §4ter captura viva; antes estaba congelado por no-fabricar)", () => {
    const r = new ActorProgRunner();
    r.sync([{ id: "w", tile: 0x140 }]);
    const seen = new Set<number>();
    for (let i = 0; i < 50; i++) {
      r.tick();
      seen.add(r.frameFor("w", 0x140));
    }
    for (const f of seen) expect(f >= 0x140 && f <= 0x143).toBe(true);
    expect(seen.size).toBeGreaterThan(1);
  });

  it("sync descarta el estado de actores que ya no están (sin fuga)", () => {
    const r = new ActorProgRunner();
    r.sync([{ id: "a", tile: 0x148 }]);
    for (let i = 0; i < 10; i++) r.tick();
    // 'a' se va; 'b' llega → 'b' arranca fresco en su base.
    r.sync([{ id: "b", tile: 0x170 }]);
    expect(r.frameFor("b", 0x170)).toBe(0x170);
  });

  it("determinista: mismo seed + misma secuencia de ticks ⇒ mismos frames", () => {
    const mk = () => {
      const r = new ActorProgRunner(0x1234);
      r.sync([{ id: "g", tile: 0x170 }]);
      const out: number[] = [];
      for (let i = 0; i < 60; i++) { r.tick(); out.push(r.frameFor("g", 0x170)); }
      return out;
    };
    expect(mk()).toEqual(mk());
  });
});

describe("MONSTRUOS §4bis — programas de criatura (combate)", () => {
  it("datos del oráculo presentes (Rat/Bat/Gazer/Shark/StoneGargoyle/Dragon)", () => {
    expect(ACTOR_PROGRAM_BY_BASE.get(0x90)).toEqual([0x02, 0x03, 0x04, 0x05]); // Rat (progid0)
    expect(ACTOR_PROGRAM_BY_BASE.get(0x94)).toEqual([0x01, 0x02, 0x03, 0x04]); // Bat (progid1)
    expect(ACTOR_PROGRAM_BY_BASE.get(0xb0)).toEqual([0x01, 0x02, 0x03, 0x04, 0x87]); // Gazer (progid3)
    expect(ACTOR_PROGRAM_BY_BASE.get(0x8c)).toEqual([0x02, 0x82, 0x03, 0x82, 0x04, 0x82, 0x06, 0x01]); // Shark (9)
    expect(ACTOR_PROGRAM_BY_BASE.get(0xb8)).toEqual([0x01, 0x02, 0x03, 0x05]); // StoneGargoyle (0x0a)
    expect(ACTOR_PROGRAM_BY_BASE.get(0xdc)).toEqual([0x02, 0x03, 0x04, 0x03, 0x02, 0x05]); // Dragon (progid7)
    // 30 monstruos + 5 personas = todas las familias habilitadas.
    for (const b of [0x80, 0x8c, 0x94, 0x98, 0xa8, 0xb0, 0xb8, 0xdc, 0xf0, 0xf4])
      expect(ENABLED_ACTOR_BASES.has(b)).toBe(true);
  });

  it("Mimic (0x1a8) = CAMUFLAJE ESTÁTICO: HALT 0x8f lo congela en el frame base", () => {
    const r = new ActorProgRunner();
    r.sync([{ id: "mimic", tile: 0x1a8 }]);
    const frames = new Set<number>();
    for (let i = 0; i < 80; i++) { r.tick(); frames.add(r.frameFor("mimic", 0x1a8)); }
    // Sólo muestra el frame base+0 (0x1a8) y se para (finge un cofre).
    expect([...frames]).toEqual([0x1a8]);
  });

  it("Corpser (0x1f4) también se congela (HALT 0x8f, trampa de suelo quieta)", () => {
    const r = new ActorProgRunner();
    r.sync([{ id: "corpser", tile: 0x1f4 }]);
    for (let i = 0; i < 80; i++) r.tick();
    expect(r.frameFor("corpser", 0x1f4)).toBe(0x1f4);
  });

  it("un monstruo normal (Bat 0x194) SÍ cicla dentro de su grupo de banco alto", () => {
    const r = new ActorProgRunner(0x2222);
    r.sync([{ id: "bat", tile: 0x194 }]);
    const seen = new Set<number>();
    for (let i = 0; i < 200; i++) { r.tick(); seen.add(r.frameFor("bat", 0x194)); }
    for (const f of seen) {
      expect(f).toBeGreaterThanOrEqual(0x194);
      expect(f).toBeLessThanOrEqual(0x197);
    }
    expect(seen.size).toBeGreaterThan(1);
  });
});

/**
 * SEMILLA CRUDA `[reg+0]` — el bardo de acampada (Iolo tocando el laúd).
 *
 * El original NO siembra el actor con la base del grupo: `CMDS.OVL 0x017c-0x0181`
 * (`b05f mov al,0x5f` → `[objrec+1]=al` y `[objrec+0]=al`) escribe **0x5F** en los DOS
 * campos del registro de anim. De ahí salen dos consecuencias que la base sola no da:
 *  · `base = [reg+0] & 0xfc` = 0x5C ⇒ programa de BardPlaying (ungated, `0x4611`).
 *  · el frame SEMBRADO y el de la rama 25 % del op5 son **0x5F**, no 0x5C
 *    (`0x467c mov al, byte ptr [si]` lee `[reg+0]` CRUDO, no la base).
 * ⇒ durante la canción el original muestra 0x15D·0x15E·0x15F y **nunca 0x15C**.
 * Ver `re/notes/camp-bard-anim.md`.
 */
describe("semilla cruda [reg+0] — bardo de acampada (CMDS 0x017c `mov al,0x5f`)", () => {
  const bardProg = [0x02, 0x03, 0x04, 0x05];
  const CAMP_SEED = 0x5f;

  it("la SEMILLA fija el frame inicial (0x15f), no la base del grupo (0x15c)", () => {
    expect(initProgState(0x5c, 0x100, CAMP_SEED).frame).toBe(0x15f);
    // Sin semilla explícita se conserva el comportamiento previo (frame = base).
    expect(initProgState(0x5c, 0x100).frame).toBe(0x15c);
  });

  it("cicla 0x15d·0x15e·0x15f y NUNCA muestra 0x15c (rama 75 % del op5)", () => {
    const st = initProgState(0x5c, 0x100, CAMP_SEED);
    const pass = mockPrng(0xff) as unknown as ViewPrng; // op5 → 75 % (reinicia el PC)
    const frames: number[] = [];
    for (let i = 0; i < 12; i++) { tickProg(st, bardProg, pass); frames.push(st.frame); }
    expect(frames.slice(0, 6)).toEqual([0x15d, 0x15e, 0x15f, 0x15d, 0x15e, 0x15f]);
    expect(frames).not.toContain(0x15c);
  });

  it("la rama 25 % del op5 muestra la SEMILLA cruda (0x15f), no la base — y sin descanso", () => {
    const st = initProgState(0x5c, 0x100, CAMP_SEED);
    const rest = mockPrng(0x00) as unknown as ViewPrng; // op5 → 25 %
    const frames: number[] = [];
    for (let i = 0; i < 5; i++) { tickProg(st, bardProg, rest); frames.push(st.frame); }
    expect(frames).toEqual([0x15d, 0x15e, 0x15f, 0x15f, 0x15d]);
    expect(st.timer).toBe(0); // base 0x5c NO arma el timer 6 (`0x467f cmp 0x5c; je`)
  });

  it("un actor normal (Fighter 0x148) no cambia: sin semilla, la rama 25 % sigue dando la base", () => {
    const st = initProgState(0x48, 0x100);
    // 4 gates que pasan (0xff) + la tirada del op5 en 25 % (0x00).
    const rest = mockPrng([0xff, 0xff, 0xff, 0xff, 0x00]) as unknown as ViewPrng;
    const frames: number[] = [];
    for (let i = 0; i < 4; i++) { tickProg(st, [0x02, 0x03, 0x04, 0x05], rest); frames.push(st.frame); }
    expect(frames).toEqual([0x149, 0x14a, 0x14b, 0x148]); // 25 % → base+0 …
    expect(st.timer).toBe(6); // … y descanso de 6 ticks (base != 0x5c)
  });

  it("ActorProgRunner acepta la semilla y ANIMA al bardo (no se queda en un frame)", () => {
    const r = new ActorProgRunner(0x777);
    const bard = [{ id: "camp-bard", tile: 0x15f, seed: CAMP_SEED }];
    r.sync(bard);
    expect(r.frameFor("camp-bard", 0x15f, CAMP_SEED)).toBe(0x15f); // sembrado
    const seen = new Set<number>();
    for (let i = 0; i < 40; i++) { r.tick(); seen.add(r.frameFor("camp-bard", 0x15f, CAMP_SEED)); }
    expect(seen.size).toBeGreaterThan(1); // ANIMA (el defecto reportado era 1 solo frame)
    expect(seen.has(0x15c)).toBe(false); // el frame que el original nunca muestra aquí
    for (const f of seen) {
      expect(f).toBeGreaterThanOrEqual(0x15d);
      expect(f).toBeLessThanOrEqual(0x15f);
    }
  });

  it("base 0x5c es UNGATED (0x4611): avanza en CADA llamada, sin gate del 50 %", () => {
    // PRNG que SIEMPRE falla el gate del 50 % (<0x80): un actor gateado no avanzaría.
    const fail = mockPrng(0x00) as unknown as ViewPrng;
    const gated = initProgState(0x48, 0x100);
    tickProg(gated, [0x02, 0x03, 0x04, 0x05], fail);
    expect(gated.frame).toBe(0x148); // congelado por el gate
    const ungated = initProgState(0x5c, 0x100, CAMP_SEED);
    tickProg(ungated, bardProg, fail);
    expect(ungated.frame).toBe(0x15d); // avanzó igualmente
  });
});

/**
 * Regresión del PC++ de la rama 25 % con base 0x5c (`0x4683 je 0x4660` = `inc PC`).
 * Sin él el intérprete se clava en el op5 (frame apagado, sin timer que lo saque) y
 * el bardo se CONGELA para siempre — que es justo el síntoma reportado. Testigo VIVO
 * (no mock): 600 llamadas con el PRNG real; la rama 25 % cae con probabilidad ~1 por
 * cada 4 vueltas ⇒ si no avanzase el PC, la COLA de la serie sería un único frame.
 */
describe("bardo 0x5c — la rama 25 % NO congela (PC++ de 0x4660)", () => {
  it("sigue animando en la COLA de la serie (600 ticks con el PRNG real)", () => {
    const r = new ActorProgRunner(0x777);
    r.sync([{ id: "camp-bard", tile: 0x15f, seed: 0x5f }]);
    const serie: number[] = [];
    for (let i = 0; i < 600; i++) { r.tick(); serie.push(r.frameFor("camp-bard", 0x15f, 0x5f)); }
    expect(new Set(serie.slice(0, 100)).size).toBeGreaterThan(1); // arranca animando
    expect(new Set(serie.slice(-100)).size).toBeGreaterThan(1); // y SIGUE al final
    // El 25 % ha caído de sobra en 600 llamadas (≈150 vueltas): la cola lo prueba.
  });
});
