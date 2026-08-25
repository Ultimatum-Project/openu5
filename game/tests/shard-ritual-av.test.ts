/**
 * #201 — LOS EFECTOS AV DEL RITUAL DEL SHARD.
 *
 * DERIVACIÓN (`re/disasm/CAST.OVL.asm`, `use_shard_at_flame` @0x15b4; cuerpo leído):
 *
 *   0x15d6/0x15fe/0x1604  mov ax,0x47cc|0x47d9|0x47e3 ; push ; call 0x58d0  → imprime el shard
 *   0x15dd  mov si,0x7d0                    ┐ BUCLE ASCENDENTE: 460 llamadas a `tone_sweep`
 *   0x15e0  push 0xa50,1,0xc8,si,0          │ (0x6212 → ULTIMA.EXE:0x2192, base 0xBF80)
 *   0x15f3  add si,0x32 ; cmp si,0x61a8     ┘ el ±0x32 es del BUCLE; el arg `step` es 0
 *   0x160d  mov si,0x61a8 … sub si,0x32     → BUCLE DESCENDENTE, idéntico salvo el sentido
 *   0x162f  cmp [bx+0x4882],al …            → GATE de posición (x/y/location/floor)
 *   0x1656  call 0x842e ; jmp 0x175c        → FRACASO: sonido propio y `ret` SIN fanfarria
 *   0x1752  push 0x4874 ; call 0x58d0
 *   0x1759  call 0x83e8                     → ÉXITO: `sfx_victory_fanfare` (0x4368)
 *
 * Las dos propiedades que este fichero vigila y que el port tenía MAL antes de #201:
 *  (1) los DOS barridos van SIEMPRE — terminan en 0x162c, y el gate que decide el efecto
 *      está DESPUÉS (0x162f). Colgarlos del éxito inventa una condición que no existe.
 *  (2) la fanfarria va SÓLO en la cola de éxito. El `spell-zap` que el port emitía aquí era
 *      una atribución heredada y falsa (`sfx-catalog.md` §3.5 / `core/sfx.ts`).
 */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { describeSiViaja } from "./assets-opcionales.js";
import { useShard, type UseToolsCtx } from "../src/core/endgame/use-tools.js";
import { FLAME_X, FLAME_Y, FLAME_LOCATION, FLAME_FLOOR, SHADOWLORD_TILE } from "../src/core/quest/ritual.js";
import type { GameState } from "../src/core/state.js";
import { SFX_CATALOG, SpeakerSynth, BLOCKING_CUES, cueDurationMs } from "../src/skin/fiel/speaker.js";
import { WorldFxLayer, PAUSE_UNIT_MS, EXPLOSION_TILE } from "../src/skin/world-fx.js";
import { planTurnPhase } from "../src/skin/turn-phase.js";
import type { SfxId } from "../src/core/sfx.js";
import { QUAKE_PULSES, QUAKE_PERIOD_MS } from "../src/skin/fiel/quake.js";
import { TILE_INFO } from "../src/core/tiles.js";
import { buildAnimGroups, SPRITE_BANK } from "../src/render/tileanim.js";
import { fakeAudioCtx } from "./helpers/fake-audio-ctx.js";

const IDX = 0; // falsehood / Faulinei — Lycaeum

/**
 * `ctx` mínimo: `useShard` sólo toca posición, banderas de gesta y `worldObjects`. Se
 * construye a mano (y no vía `Game`) para que el aserto mire LOS EVENTOS y nada más.
 */
function makeCtx(opts: { atFlame: boolean; summoned: boolean }): UseToolsCtx {
  const x = FLAME_X[IDX]!;
  const y = FLAME_Y[IDX]!;
  const location = FLAME_LOCATION[IDX]!;
  const floor = FLAME_FLOOR[IDX]!;
  const state = {
    position: opts.atFlame ? { x, y, location, floor } : { x: 1, y: 1, location: 0, floor: 0 },
    questFlags: {},
    shards: { falsehood: true, hatred: true, cowardice: true },
    shadowlordLocs: [0, 0, 0],
    shadowlordDoomBits: 0,
    shadowlordSummoned: opts.summoned ? IDX : undefined,
    // #238: la destrucción escribe TAMBIÉN npcDead[28][6-idx] (el `or word
    // [g_npc_dead_bitmap+112]` de CAST 0x171d aliasa la fila de Stonegate, loc 29).
    npcDead: Array.from({ length: 32 }, () => Array.from({ length: 32 }, () => false)),
    worldObjects: opts.summoned
      ? [{ tile: SHADOWLORD_TILE, location, floor, x, y: y - 1 }]
      : [],
  } as unknown as GameState;
  return {
    state,
    dungeonState: null,
    rand: () => 0,
    mapTileWithOverrides: () => 0,
    setMapOverride: () => {},
    setVolatileTerrain: () => {},
    syncTransportFromTile: () => {},
  } as unknown as UseToolsCtx;
}

const sfxIds = (evs: ReturnType<typeof useShard>): string[] =>
  evs.filter((e) => e.kind === "sfx").map((e) => (e as { sfx: { id: string } }).sfx.id);

describe("#201 · barridos del ritual (CAST 0x15dd-0x162a, ANTES del gate de 0x162f)", () => {
  it("el barrido suena aunque el ritual NO surta efecto (lejos de la Llama)", () => {
    // Éste es el aserto que el código anterior fallaba: el descendente colgaba del éxito.
    expect(sfxIds(useShard(makeCtx({ atFlame: false, summoned: false }), "falsehood"))).toEqual([
      "shard-sweep",
    ]);
  });

  it("suena también en la Llama correcta sin Shadowlord convocado (gate posterior)", () => {
    expect(sfxIds(useShard(makeCtx({ atFlame: true, summoned: false }), "falsehood"))).toEqual([
      "shard-sweep",
    ]);
  });

  it("va DESPUÉS del nombre del shard (0x15d9 imprime, 0x15dd barre) y antes del resto", () => {
    const evs = useShard(makeCtx({ atFlame: true, summoned: true }), "falsehood");
    const kinds = evs.map((e) => e.kind);
    expect(kinds[0]).toBe("message"); // 0x47cc, el nombre del shard
    expect(kinds[1]).toBe("sfx");
    expect(kinds[2]).toBe("message"); // el resto de la coreografía de texto
  });
});

describe("#201 · fanfarria de victoria (CAST 0x1759 → 0x83e8 → ULTIMA.EXE:0x4368)", () => {
  it("suena SÓLO cuando el Shadowlord cae, y cierra la secuencia", () => {
    const ok = sfxIds(useShard(makeCtx({ atFlame: true, summoned: true }), "falsehood"));
    expect(ok).toEqual(["shard-sweep", "quake", "victory-fanfare"]);
  });

  it("la rama de fracaso no la emite (0x1656 salta a 0x175c, sin pasar por 0x1759)", () => {
    expect(sfxIds(useShard(makeCtx({ atFlame: true, summoned: false }), "falsehood"))).not.toContain(
      "victory-fanfare",
    );
  });

  it("el `spell-zap` mal atribuido ya no sale de este camino (§3.5)", () => {
    for (const c of [
      { atFlame: false, summoned: false },
      { atFlame: true, summoned: false },
      { atFlame: true, summoned: true },
    ]) {
      expect(sfxIds(useShard(makeCtx(c), "falsehood"))).not.toContain("spell-zap");
    }
  });
});

describe("#201 · el catálogo no puede divergir de sí mismo", () => {
  it("`cast-spell` y `victory-fanfare` son LA MISMA onda (0x4368, atribución de §3.5)", () => {
    // No es redundancia: son dos ids vivos sobre un único cuerpo. Si alguien retoca uno
    // creyendo que son sonidos distintos, este aserto lo para.
    expect(SFX_CATALOG["victory-fanfare"]()).toEqual(SFX_CATALOG["cast-spell"]());
  });

  it("el barrido son DOS tramos iguales — el ↑/↓ es DUTY, que `toneSweep` no modela", () => {
    const segs = SFX_CATALOG["shard-sweep"]();
    expect(segs).toHaveLength(2);
    expect(segs[0]).toEqual(segs[1]);
  });

  it("cada tramo dura las 460 iteraciones del bucle, no una llamada suelta", () => {
    // 0x7d0→0x61a8 de 0x32 en 0x32 = 460. La duración de UNA llamada (count=0xc8) es de
    // milisegundos: si alguien deja caer el factor, el barrido se queda en un chasquido.
    const half = SFX_CATALOG["shard-sweep"]()[0]!;
    expect(Math.round(half.ms)).toBe(Math.round((0xc8 * 1000 * 460) / (24000 / 0.93)));
  });
});

describe("#201 · coreografía de la destrucción (CAST 0x1674-0x1759)", () => {
  const ok = () => useShard(makeCtx({ atFlame: true, summoned: true }), "falsehood");
  const fail = () => useShard(makeCtx({ atFlame: true, summoned: false }), "falsehood");

  it("#238 · la destrucción marca el NPC de STONEGATE: npcDead[28][6] (el `or` de 0x171d)", () => {
    // El «bitmap de doom» del ritual no es un word aparte: DS 0x5BCA = g_npc_dead_bitmap+112
    // = fila 28 (loc 29, Stonegate) del bitmap, y DOOM_BIT[0]=0x02 cae MSB-first en el slot 6.
    // Derivación: re/notes/trama-nativa-238-231.md §1.
    const ctx = makeCtx({ atFlame: true, summoned: true });
    useShard(ctx, "falsehood");
    expect(ctx.state.shadowlordDoomBits).toBe(0x02);
    expect(ctx.state.npcDead[28]![6]).toBe(true);
    // Y SOLO ese bit: ni otra fila ni otro slot (el OR no barre nada).
    const encendidos = ctx.state.npcDead.flatMap((fila, l) =>
      fila.flatMap((v, n) => (v ? [`${l}:${n}`] : [])),
    );
    expect(encendidos).toEqual(["28:6"]);
  });

  it("TRES sacudidas, ni una más — 0x169d/0x16a0/0x16a3, cero args cada una", () => {
    // Van juntas a propósito: la piel fiel cuenta las del batch y alarga la sacudida a
    // N·QUAKE_PULSES (mismo patrón que la ceremonia del Codex, shrine-ceremonies.ts:299).
    expect(ok().filter((e) => e.kind === "quake")).toHaveLength(3);
  });

  it("la explosión va sobre la celda del NORTE, 7 ráfagas, tras la PAUSA(3)", () => {
    const ex = ok().find((e) => e.kind === "cell-explosion") as
      | { cellFx: Record<string, number> }
      | undefined;
    // 🔴 El esperado va EN CRUDO. `underTile` es **252 = 0xFC**: el BYTE DE RANURA que el
    // binario guarda en el slot (TOWN 0x3a1), NO el índice de sprite — el banco alto lo suma
    // la PIEL (`skin/world-fx.ts`), porque `core/` no puede importar de `render/` (Regla A de
    // `tests/skin-import-guard.test.ts`, que tumbó la primera versión de este cableado).
    // El literal se escribe a mano a propósito: derivarlo de `SHADOWLORD_TILE` sería
    // re-ejecutar el sujeto y el aserto pasaría con la constante movida.
    expect(ex?.cellFx).toEqual({ dx: 0, dy: -1, bursts: 7, preDelayUnits: 3, underTile: 252 });
  });

  it("nada de la coreografía se emite si el Shadowlord no cae", () => {
    const kinds = fail().map((e) => e.kind);
    expect(kinds).not.toContain("quake");
    expect(kinds).not.toContain("cell-explosion");
  });

  it("el ORDEN es el del binario: sacudidas → explosión → fanfarria", () => {
    const evs = ok();
    const at = (k: string) => evs.findIndex((e) => e.kind === k);
    const fanfare = evs.findIndex(
      (e) => e.kind === "sfx" && (e as { sfx: { id: string } }).sfx.id === "victory-fanfare",
    );
    expect(at("quake")).toBeLessThan(at("cell-explosion"));
    expect(at("cell-explosion")).toBeLessThan(fanfare);
  });
});

describe("#201 · el pintor del canal nuevo (skin/world-fx.ts)", () => {
  const FX = { kind: "cellExplosion", dx: 0, dy: -1, bursts: 7, preDelayUnits: 3 } as const;

  it("durante la PAUSA(3) no pinta nada — el respiro es parte del efecto", () => {
    const layer = new WorldFxLayer();
    layer.push(FX, 0);
    const hits: number[][] = [];
    layer.paint(3 * PAUSE_UNIT_MS - 1, { blit: (t, dx, dy) => void hits.push([t, dx, dy]), dot: () => {} });
    expect(hits).toEqual([]);
    expect(layer.active).toBe(true); // vivo, sólo callado
  });

  it("pasada la pausa PARPADEA sobre la celda (el original re-pinta entre blits)", () => {
    const layer = new WorldFxLayer();
    layer.push(FX, 0);
    const hits: number[][] = [];
    layer.paint(3 * PAUSE_UNIT_MS + 1, { blit: (t, dx, dy) => void hits.push([t, dx, dy]), dot: () => {} });
    expect(hits).toEqual([[EXPLOSION_TILE, 0, -1]]);
    // el siguiente tramo es el hueco: si pintara siempre, esto también daría un hit
    const gap: number[][] = [];
    layer.paint(3 * PAUSE_UNIT_MS + 61, { blit: (t, dx, dy) => void gap.push([t, dx, dy]), dot: () => {} });
    expect(gap).toEqual([]);
  });

  it("se purga solo al agotar las 7 ráfagas (nadie tiene que acordarse de limpiarlo)", () => {
    const layer = new WorldFxLayer();
    layer.push(FX, 0);
    layer.paint(WorldFxLayer.durationMs(FX), { blit: () => {}, dot: () => {} });
    expect(layer.active).toBe(false);
  });
});

describe("#201 · el canal tiene CONSUMIDOR (tiene test ≠ está vigilado)", () => {
  // El predicado es de CLASE, no una cadena cableada: se lee del core QUÉ eventos de fx del
  // mundo existen y se exige que ALGUNA piel los consuma. Si mañana entra un segundo kind y
  // nadie lo pinta, esto se pone rojo sin que haya que acordarse de ampliar el test.
  const ROOT = new URL("../src/", import.meta.url);
  const read = (rel: string) => readFileSync(new URL(rel, ROOT), "utf8");

  it("todo evento de fx-de-celda declarado en el core lo pinta al menos una piel", () => {
    const core = read("core/game.ts");
    const kinds = [...core.matchAll(/^\s*\|\s*"([a-z-]*-explosion|[a-z-]*-fx)"/gm)].map((m) => m[1]!);
    expect(kinds).toContain("cell-explosion"); // control positivo: el censo no está vacío
    // `turn-phase.ts` cuenta como consumidor: es el lector COMPARTIDO del lote (#208) —
    // las dos pieles pintan lo que su plan devuelve (`applyTurnFx` sobre `plan.explosions`),
    // así que el literal del kind vive allí y no en el texto de cada piel.
    const skins = ["skin/fiel/skin.ts", "skin/shader/skin.ts", "skin/turn-phase.ts"].map(read);
    for (const k of kinds) {
      const consumidores = skins.filter((src) => src.includes(`"${k}"`)).length;
      expect(consumidores, `nadie consume el evento ${k}`).toBeGreaterThan(0);
    }
  });
});

describe("#206 · los cues del ritual se ENCADENAN en vez de solaparse", () => {
  // El contexto falso vive en `tests/helpers/fake-audio-ctx.ts` desde #345, que necesitaba el
  // MISMO doble para medir el encadenado del WELL DONE: la clase declara que se inyecta justo
  // para poder medir el AGENDADO sin navegador, y `currentTime` no avanza solo, así que si dos
  // cues arrancan en el mismo instante es porque el código los puso ahí y no por deriva del
  // reloj. Estaba inline aquí; se movió en vez de copiarse para que los dos ficheros no puedan
  // divergir sobre qué modela el doble.
  const fakeCtx = fakeAudioCtx;

  it("la fanfarria NO arranca hasta que acaba el barrido (el original bloquea)", () => {
    const { ctx, started } = fakeCtx();
    const synth = new SpeakerSynth(ctx);
    synth.play({ id: "shard-sweep" });
    const trasBarrido = started.length;
    synth.play({ id: "victory-fanfare" });
    // El 1er segmento de la fanfarria arranca DESPUÉS del final del barrido (7,13 s), no en 0.
    expect(started[trasBarrido]).toBeGreaterThan(7);
  });

  it("un cue NO bloqueante sigue arrancando YA — el alcance es el declarado, no global", () => {
    // Esto es la mitad honesta del acotamiento: #208 es donde vive el encadenado general.
    const { ctx, started } = fakeCtx();
    const synth = new SpeakerSynth(ctx);
    synth.play({ id: "shard-sweep" });
    const antes = started.length;
    synth.play({ id: "combat-hit" });
    expect(started[antes]).toBe(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────────────────
// #243 — ¿ANIMA EL ORIGINAL AL SHADOWLORD PARADO? (re/notes/shadowlord-av-243.md §1)
//
// El usuario reportó el 13-08 que el port no le mueve los brazos al Shadowlord quieto. La
// respuesta es que el ORIGINAL tampoco, y estas guardas vigilan las DOS mitades del porqué,
// que hoy no tenían ninguna:
//
//  (a) el reloj maestro de animación `advance_tile_anim_frames` (ULTIMA.EXE:0x44b8) sólo
//      remapea BANCO BAJO. No es una ausencia grepeada: es la enumeración de las cotas
//      literales de sus cinco bucles, RE-EXTRAÍDA del disasm en cada corrida para que no
//      pueda quedar rancia si `0x44b8` se regenera.
//  (b) 🔴 y la trampa que invierte la respuesta: el reloj SÍ togglea `0xfa..0xfd`, y `0xFC`
//      es exactamente el byte que el objeto Shadowlord lleva en la tabla 0x5c5a. Son DOS
//      BANCOS: bajo 0xFC = Bellows1 (el fuelle del herrero), alto 0x1FC = ShadowLord1.
//      Quien junte «el reloj togglea 0xFC» con «el Shadowlord es el tile 0xFC» concluye que
//      el original lo parpadea cada ~220 ms — lo contrario de la verdad.
// ─────────────────────────────────────────────────────────────────────────────────────────
// 🔴 `re/disasm/*.asm` NO viaja: el EA-material check del génesis los prohíbe por nombre
// (`-iname '*.asm'`). El `throw` de `cuerpoReloj()` de más abajo sigue siendo la
// conducta correcta EN NUESTRO ÁRBOL —y `describeSiViaja` la conserva, con un rojo que
// nombra la REGLA 2— pero en el público la ausencia no es un defecto: es el diseño.
// Los otros 36 tests del fichero no leen el disasm y siguen en `test:pure`.
describeSiViaja(["re/disasm/ULTIMA.EXE.asm"], "#243 · el reloj maestro de tiles (ULTIMA.EXE:0x44b8) no toca sprites de ACTOR", () => {
  const ASM = new URL("../../re/disasm/ULTIMA.EXE.asm", import.meta.url);

  /** Cuerpo de `advance_tile_anim_frames`, de su prólogo a su `ret`. */
  function cuerpoReloj(): { dir: number; insn: string }[] {
    let texto: string;
    try {
      texto = readFileSync(ASM, "utf8");
    } catch {
      // Ausencia = ROJO, nunca skip: en un worktree los .asm se enlazan UNO A UNO (REGLA 2),
      // y un skip aquí sería un verde vacuo con pinta de «no aplica».
      throw new Error(
        `FALTA ${ASM.pathname} — sin el cuerpo esta guarda no puede re-extraer las cotas ` +
          "del reloj y daría verde sin haber mirado nada (REGLA 2: los .asm van uno a uno).",
      );
    }
    const filas: { dir: number; insn: string }[] = [];
    for (const linea of texto.split("\n")) {
      const m = /^([0-9a-f]{4}):\s*[0-9a-f]+\s+(.*)$/.exec(linea);
      if (!m) continue;
      const dir = parseInt(m[1]!, 16);
      if (dir >= 0x44b8 && dir <= 0x454d) filas.push({ dir, insn: m[2]!.trim() });
    }
    return filas;
  }

  /**
   * Los tiles que el reloj toca = los valores que `si` recorre. Cada bucle arranca con
   * `mov si, <base>` y termina con `cmp si, <tope>` + salto, así que el dominio es la unión
   * de los `[base, tope)` con paso 1 (el `inc si` de cada vuelta).
   */
  function dominio(): number[] {
    const cuerpo = cuerpoReloj();
    const bases: number[] = [];
    const topes: number[] = [];
    for (const { insn } of cuerpo) {
      const b = /^mov si, (0x[0-9a-f]+)$/.exec(insn);
      if (b) bases.push(parseInt(b[1]!, 16));
      const t = /^cmp si, (0x[0-9a-f]+)$/.exec(insn);
      if (t) topes.push(parseInt(t[1]!, 16));
    }
    expect(bases.length, "no se leyó ningún `mov si` — el patrón no casa con este disasm").toBe(
      topes.length,
    );
    expect(bases.length, "el reloj tiene CINCO bucles; leer otra cosa es leer otra rutina").toBe(5);
    const tiles = new Set<number>();
    for (let i = 0; i < bases.length; i++) {
      for (let t = bases[i]!; t < topes[i]!; t++) tiles.add(t);
    }
    return [...tiles].sort((a, b) => a - b);
  }

  it("sus cinco bucles son EXACTAMENTE los cinco rangos de terreno derivados", () => {
    const esperado = [
      ...[0xd4, 0xd5, 0xd6, 0xd7], // Waterfall1..4
      ...[0xd8, 0xd9, 0xda, 0xdb], // Fountain1..4
      ...[0x80, 0x81, 0x82, 0x83], // tortura (XOR 1)
      ...[0xec, 0xed, 0xee, 0xef], // SnakeSign1..4
      ...[0xfa, 0xfb, 0xfc, 0xfd], // Clock1/2 · Bellows1/2 (XOR 1)
    ].sort((a, b) => a - b);
    expect(dominio()).toEqual(esperado);
  });

  it("★★ ningún tile del BANCO ALTO (>= 0x100) entra en el reloj — por eso un actor quieto no se anima", () => {
    const dom = dominio();
    expect(dom.length, "control positivo: el dominio no puede estar vacío").toBeGreaterThan(0);
    expect(dom.filter((t) => t >= SPRITE_BANK)).toEqual([]);
  });

  it("🔴 el 0xFC del reloj es el FUELLE, no el Shadowlord — son dos bancos", () => {
    expect(dominio()).toContain(0xfc); // el reloj SÍ lo togglea…
    expect(TILE_INFO[0xfc]?.name).toBe("Bellows1"); // …pero éste es el fuelle del herrero
    expect(TILE_INFO[0x1fc]?.name).toBe("ShadowLord1"); // y el Shadowlord vive en el banco alto
    expect(SHADOWLORD_TILE).toBe(0xfc); // el byte del OBJETO, que no es el sprite
  });
});

describe("#243 · el sprite del Shadowlord son CUATRO frames que avanzan por TURNO", () => {
  it("0x1FC-0x1FF son un grupo de 4 y es `perTurn` (no reloj de render)", () => {
    const grupos = buildAnimGroups();
    const g = grupos[0x1fc];
    expect(g, "el Shadowlord dejó de tener grupo de animación").toBeTruthy();
    expect(g!.base).toBe(0x1fc);
    expect(g!.size).toBe(4);
    // La propiedad que decide la respuesta al usuario: si esto pasara a false, el port
    // animaría al Shadowlord parado a ~110 ms y DEJARÍA de ser fiel.
    expect(g!.perTurn).toBe(true);
    for (const t of [0x1fd, 0x1fe, 0x1ff]) expect(grupos[t]?.base).toBe(0x1fc);
  });

  it("los cuatro frames son los cuatro ShadowLord, en orden", () => {
    expect([0x1fc, 0x1fd, 0x1fe, 0x1ff].map((t) => TILE_INFO[t]?.name)).toEqual([
      "ShadowLord1",
      "ShadowLord2",
      "ShadowLord3",
      "ShadowLord4",
    ]);
  });
});

/**
 * #243 — EL ORDEN Y LA FASE, careados contra el vídeo del usuario (`Shadowlords.MP4`,
 * 16-08, 13,87 s con pista de audio).
 *
 * Lo MEDIDO en ese vídeo, que es lo que estos asertos vigilan que no vuelva:
 *   · audio (RMS a 50 ms): barrido continuo 1,80-8,90 s = 7,10 s ≈ los 7130 ms del
 *     catálogo; fanfarria 8,90-11,03 s a 1811 Hz ×3 + 2402 Hz (los dos pitches de #212).
 *   · vídeo (diffs de fotograma a 10 fps): siete picos de ~13,2 entre 1,80 y 4,10 s (la
 *     sacudida) y desde 4,20 s hasta el final CERO cambio — ruido de fondo 0,03-0,16 en
 *     la ventana donde tocaba la ráfaga, discriminante ×100.
 * ⇒ la coreografía cabía entera dentro del barrido y la ráfaga no se pintaba en absoluto.
 */
describe("#243 · el ORDEN: el Shadowlord sigue en la celda BAJO la ráfaga", () => {
  const FX = {
    kind: "cellExplosion",
    dx: 0,
    dy: -1,
    bursts: 7,
    preDelayUnits: 3,
    // 🔴 El descriptor trae 252 = 0xFC (byte de ranura, SIN banco) y los asertos de abajo
    // esperan blits de **508** = 0x1FC `ShadowLord1`. Esa diferencia ES el aserto: acredita
    // que la SUMA DEL BANCO la hace esta capa. Si alguien la quita, 252 llega al blit y el
    // jugador ve `Bellows1` — el «soplador dorado» de #195.
    underTile: 252,
  } as const;

  it("durante la PAUSA(3) la celda enseña el Shadowlord — no está vacía, está esperando", () => {
    const layer = new WorldFxLayer();
    layer.push(FX, 0);
    const hits: number[][] = [];
    layer.paint(3 * PAUSE_UNIT_MS - 1, { blit: (t, dx, dy) => hits.push([t, dx, dy]), dot: () => {} });
    // 🔴 El aserto AFIRMA el rasgo, no sólo niega el error: exige el tile 508 en (0,−1).
    // Un `not.toEqual([])` pasaría también con la explosión pintada antes de tiempo.
    expect(hits).toEqual([[508, 0, -1]]);
  });

  it("en el blit de explosión el Shadowlord va PRIMERO y la ráfaga ENCIMA (ese orden)", () => {
    const layer = new WorldFxLayer();
    layer.push(FX, 0);
    const hits: number[][] = [];
    layer.paint(3 * PAUSE_UNIT_MS + 1, { blit: (t, dx, dy) => hits.push([t, dx, dy]), dot: () => {} });
    expect(hits).toEqual([
      [508, 0, -1],
      [EXPLOSION_TILE, 0, -1],
    ]);
  });

  it("en el HUECO entre blits vuelve a verse el Shadowlord (el original re-pinta)", () => {
    const layer = new WorldFxLayer();
    layer.push(FX, 0);
    const gap: number[][] = [];
    layer.paint(3 * PAUSE_UNIT_MS + 61, { blit: (t, dx, dy) => gap.push([t, dx, dy]), dot: () => {} });
    expect(gap).toEqual([[508, 0, -1]]);
  });

  it("sin `underTile` el comportamiento es el previo a #243 (nadie hereda el sprite)", () => {
    // Control NEGATIVO: la capa no inventa un tile de fondo por su cuenta.
    const layer = new WorldFxLayer();
    layer.push({ kind: "cellExplosion", dx: 0, dy: -1, bursts: 7, preDelayUnits: 3 }, 0);
    const hits: number[][] = [];
    layer.paint(3 * PAUSE_UNIT_MS - 1, { blit: (t, dx, dy) => hits.push([t, dx, dy]), dot: () => {} });
    expect(hits).toEqual([]);
  });
});

describe("#243 · la FASE: lo visual espera al audio que BLOQUEA (planTurnPhase)", () => {
  // Tipado con el `SfxId` REAL, no con `string`: así un id inventado en el fixture es
  // un rojo de tsc y no un verde silencioso (clase de `vitest-no-typechequea`).
  const sfx = (id: SfxId) => ({ kind: "sfx" as const, sfx: { id } });
  const CELL = { dx: 0, dy: -1, bursts: 7, preDelayUnits: 3, underTile: 252 };
  const explosion = { kind: "cell-explosion" as const, cellFx: CELL };
  const quake = { kind: "quake" as const };

  /** Duración del barrido, del CATÁLOGO (no un literal: si se recalibra, el test le sigue). */
  const SWEEP = cueDurationMs({ id: "shard-sweep" });
  /** 3 ráfagas × 8 pulsos × 117 ms — las constantes de `quake.ts`, su dueño. */
  const SACUDIDA = 3 * QUAKE_PULSES * QUAKE_PERIOD_MS;

  it("el barrido mide 7130 ms — la cifra que el vídeo del usuario confirma (7,10 s)", () => {
    expect(Math.round(SWEEP)).toBe(7130);
  });

  it("la sacudida del ritual arranca TRAS el barrido, no en el mismo instante", () => {
    const plan = planTurnPhase([sfx("shard-sweep"), quake, quake, quake, explosion]);
    expect(plan.quakes).toBe(3);
    expect(plan.quakeStartMs).toBeCloseTo(SWEEP, 6);
  });

  it("la explosión espera al barrido Y a la sacudida — 2808 ms más", () => {
    const plan = planTurnPhase([sfx("shard-sweep"), quake, quake, quake, explosion]);
    expect(SACUDIDA).toBe(2808); // el esperado, en crudo
    expect(plan.explosions).toHaveLength(1);
    expect(plan.explosions[0]!.leadMs).toBeCloseTo(SWEEP + 2808, 6);
  });

  it("un cue POSTERIOR al visual no lo mueve — el orden del array es el del binario", () => {
    // `victory-fanfare` va DETRÁS de la explosión en el ritual (CAST 0x1759 tras 0x16fa):
    // si el recorrido no fuera posicional, sumaría sus 2 s a la espera de la ráfaga.
    const conFanfarria = planTurnPhase([
      sfx("shard-sweep"), quake, quake, quake, explosion, sfx("victory-fanfare"),
    ]);
    const sinFanfarria = planTurnPhase([sfx("shard-sweep"), quake, quake, quake, explosion]);
    expect(conFanfarria.explosions[0]!.leadMs).toBe(sinFanfarria.explosions[0]!.leadMs);
  });

  it("★ ALCANCE: un lote SIN cues bloqueantes no mueve nada de sitio (ceros)", () => {
    // El sismo del Underworld y el clavicémbalo emiten `quake` + un cue NO bloqueante.
    // Si esto dejara de dar 0, #243 habría retrasado media presentación del juego.
    const plan = planTurnPhase([quake, sfx("quake"), { kind: "map-changed" as const }]);
    expect(plan.quakeStartMs).toBe(0);
    expect(plan.quakes).toBe(1);
    expect(plan.explosions).toEqual([]);
  });

  it("`quake` NO está en BLOCKING_CUES — el cue del rumble no bloquea, la sacudida sí", () => {
    // Control del ALCANCE de arriba: si alguien metiera `quake` en la lista, el aserto
    // anterior seguiría en 0 para el primer visual pero todo lo posterior se movería.
    expect(BLOCKING_CUES.has("quake")).toBe(false);
    expect([...BLOCKING_CUES].sort()).toEqual(["shard-sweep", "victory-fanfare"]);
  });
});

describe("#243 · la piel SHADER pinta el fx del mundo (era la causa de «no hay explosión»)", () => {
  const ROOT = new URL("../src/", import.meta.url);
  const read = (rel: string) => readFileSync(new URL(rel, ROOT), "utf8");

  it("la fiel EXPONE el pintor y la shader lo LLAMA — las dos mitades, no una", () => {
    expect(read("skin/fiel/skin.ts")).toMatch(/paintWorldFxInto\(ctx: CanvasRenderingContext2D/);
    // La mitad que faltaba: el llamador. Con sólo la primera, la piel de fábrica
    // seguiría sin pintar nada y el test estaría verde por media implementación.
    // El literal lleva `false` (#313): el shader recompone SOLO la explosión — su proyectil
    // lo pinta (2f-quater) `paintCannonball`, y sin la guarda saldría DOS veces en terreno.
    expect(read("skin/shader/skin.ts")).toContain("this.faithful.paintWorldFxInto(ctx, now, false)");
  });

  it("la shader se guarda por `worldFxActive`, no por una réplica de la condición", () => {
    expect(read("skin/shader/skin.ts")).toContain("this.faithful.worldFxActive");
  });
});

describe("#243 · el ritual sigue a RNG CERO (la ventana de #249 NO se abre aquí)", () => {
  // 🔴 No es una afirmación de prosa: se CUENTA. El acta §3.2 midió que el BINARIO tira
  // 5.568 veces por ritual (screen_shake_fx → rand_range ×1856 × 3 invocaciones) y el port
  // corre a cero. Cablear ese consumo es la ventana de paridad de #249, de otro carril; el
  // arreglo AV de #243 no puede abrirla por descuido, así que se mide en las dos ramas.
  const conContador = (opts: { atFlame: boolean; summoned: boolean }) => {
    const ctx = makeCtx(opts);
    let tiradas = 0;
    ctx.rand = (min: number) => {
      tiradas++;
      return min;
    };
    useShard(ctx, "falsehood");
    return tiradas;
  };

  it("la rama de ÉXITO (con toda la coreografía) no toca el stream", () => {
    expect(conContador({ atFlame: true, summoned: true })).toBe(0);
  });

  it("la rama de FRACASO tampoco", () => {
    expect(conContador({ atFlame: false, summoned: false })).toBe(0);
  });
});
