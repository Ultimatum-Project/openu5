/**
 * Reloj de animación de render (F-A) — `animatedFrame` puro (cicla el grupo de
 * un tile según la fase global / su divisor, calco de `advance_tile_anim_frames
 * 0x44b8`). Ver `re/notes/tile-anim-census.md`.
 */
import { describe, expect, it } from "vitest";
import {
  animatedFrame,
  buildAnimGroups,
  SPRITE_BANK,
  type AnimGroup,
} from "../src/render/tileanim.js";

describe("buildAnimGroups — corridas consecutivas de TILE_INFO + reloj maestro", () => {
  it("hay grupos animados y cada miembro cae en su corrida", () => {
    const groups = buildAnimGroups();
    const animated = groups.filter((g): g is AnimGroup => g !== null && g.size > 1);
    expect(animated.length).toBeGreaterThan(0);
    for (let i = 0; i < groups.length; i++) {
      const g = groups[i];
      if (!g) continue;
      expect(i).toBeGreaterThanOrEqual(g.base);
      expect(i).toBeLessThan(g.base + g.size);
    }
    expect(buildAnimGroups()).toBe(groups); // memoizado
  });

  it("divisor derivado del reloj: toggles 0x80/0x82/0xfa/0xfc = 4, resto = 2", () => {
    const groups = buildAnimGroups();
    // Ciclos de 4 frames (agua 0xd4, fuente 0xd8) → divisor 2 (~110 ms).
    expect(groups[0xd4]?.divisor).toBe(2);
    expect(groups[0xd8]?.divisor).toBe(2);
    // Toggles de 2 frames gateados por [0x6a7e]&1/&2 → divisor 4 (~220 ms).
    expect(groups[0x80]?.divisor).toBe(4);
    expect(groups[0x82]?.divisor).toBe(4);
    expect(groups[0xfa]?.divisor).toBe(4);
    expect(groups[0xfc]?.divisor).toBe(4);
    // Agua de superficie 0x01/0x02: NO cicla por id — su animación es el SCROLL fn32
    // (`waterfn32.ts`, mecanismo B). Redux la marca animada pero el original scrollea
    // el bitmap en su sitio; ciclar el id mostraría el agua equivocada. → sin grupo.
    expect(groups[0x01]).toBeNull();
    expect(groups[0x02]).toBeNull();
  });

  it("inyecta el grupo de rótulos de serpiente 0xec..0xef que TILE_INFO omite", () => {
    const groups = buildAnimGroups();
    for (let t = 0xec; t <= 0xef; t++) {
      expect(groups[t]).not.toBeNull();
      expect(groups[t]?.base).toBe(0xec);
      expect(groups[t]?.size).toBe(4);
      expect(groups[t]?.divisor).toBe(2);
    }
  });

  it("banco de SPRITES DE ACTOR (>=0x100) → perTurn; banco de terreno (<0x100) → reloj", () => {
    const groups = buildAnimGroups();
    // Terreno (banco bajo): NO perTurn (sigue el reloj de render libre).
    expect(groups[0xd4]?.perTurn).toBeFalsy(); // agua
    expect(groups[0xd8]?.perTurn).toBeFalsy(); // fuente
    expect(groups[0xec]?.perTurn).toBeFalsy(); // rótulo serpiente
    // Actores (banco alto ≥0x100): perTurn (avanzan por turno del mundo, no por reloj).
    expect(groups[0x150]?.perTurn).toBe(true); // TownsPerson
    expect(groups[0x154]?.perTurn).toBe(true); // Merchant
    expect(groups[0x14c]?.perTurn).toBe(true); // Avatar
    expect(groups[0x190]?.perTurn).toBe(true); // Rat (criatura)
    // TODO grupo animado con base ≥ SPRITE_BANK es perTurn; ninguno del banco bajo lo es.
    for (let i = 0; i < groups.length; i++) {
      const g = groups[i];
      if (!g || g.size <= 1) continue;
      expect(!!g.perTurn).toBe(g.base >= SPRITE_BANK);
    }
  });
});

describe("animatedFrame — ciclo de fase con divisor (0x44b8)", () => {
  // Grupo tipo agua: 4 frames en base 5, divisor 2 (avanza cada 2 fases).
  const water: (AnimGroup | null)[] = new Array<AnimGroup | null>(20).fill(null);
  for (let i = 5; i < 9; i++) water[i] = { base: 5, size: 4, divisor: 2 };

  it("un tile estático no cambia con la fase", () => {
    expect(animatedFrame(1, 0, water)).toBe(1);
    expect(animatedFrame(1, 7, water)).toBe(1);
  });

  it("cicla base + (offset + floor(phase/divisor)) % size", () => {
    // divisor 2 → el frame avanza cada 2 fases.
    expect(animatedFrame(5, 0, water)).toBe(5);
    expect(animatedFrame(5, 1, water)).toBe(5); // aún fase-frame 0
    expect(animatedFrame(5, 2, water)).toBe(6); // fase-frame 1
    expect(animatedFrame(5, 6, water)).toBe(8); // fase-frame 3
    expect(animatedFrame(5, 8, water)).toBe(5); // wrap 4-frame
    expect(animatedFrame(7, 6, water)).toBe(6); // 5 + ((2+3)%4)=5+1
  });

  it("un grupo perTurn IGNORA la fase y avanza sólo con el contador de turnos", () => {
    // Actor: 4 frames en base 0x150, perTurn (banco alto). El reloj de render (phase)
    // NO lo mueve — sólo el turno. Calco del original: un actor quieto se congela.
    const actor: (AnimGroup | null)[] = new Array<AnimGroup | null>(0x154).fill(null);
    for (let i = 0x150; i < 0x154; i++) {
      actor[i] = { base: 0x150, size: 4, divisor: 2, perTurn: true };
    }
    // Sin turnos (turn=0): CUALQUIER fase deja el frame base (no parpadea con el reloj).
    expect(animatedFrame(0x150, 0, actor, 0)).toBe(0x150);
    expect(animatedFrame(0x150, 999, actor, 0)).toBe(0x150);
    expect(animatedFrame(0x150, 50, actor, 0)).toBe(0x150);
    // El turno SÍ avanza el frame, 1 por turno; la fase sigue siendo irrelevante.
    expect(animatedFrame(0x150, 7, actor, 1)).toBe(0x151);
    expect(animatedFrame(0x150, 3, actor, 2)).toBe(0x152);
    expect(animatedFrame(0x150, 0, actor, 4)).toBe(0x150); // wrap 4-frame
    // Default turn=0 (dev/tests sin reloj de turnos) → frame base.
    expect(animatedFrame(0x150, 100, actor)).toBe(0x150);
  });

  it("toggle de 2 frames con divisor 4 alterna cada 4 fases", () => {
    const toggle: (AnimGroup | null)[] = new Array<AnimGroup | null>(4).fill(null);
    toggle[0] = { base: 0, size: 2, divisor: 4 };
    toggle[1] = { base: 0, size: 2, divisor: 4 };
    expect(animatedFrame(0, 0, toggle)).toBe(0);
    expect(animatedFrame(0, 3, toggle)).toBe(0);
    expect(animatedFrame(0, 4, toggle)).toBe(1); // flip a los 4 ticks
    expect(animatedFrame(0, 8, toggle)).toBe(0); // vuelve
  });

  it("sin grupos (o tile fuera de tabla) → el id tal cual", () => {
    expect(animatedFrame(300, 5, [])).toBe(300);
    expect(animatedFrame(300, 5, water)).toBe(300);
  });
});
