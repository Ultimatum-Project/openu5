/**
 * EL BARDO ANIMA EN LOCKSTEP CON SU MELODÍA (ficha #39, residuo 1).
 *
 * `camp-bard-anim.md §7` archivó esto bajo «Tasa real por iteración (Clase C)» y con eso
 * lo desactivó: la tasa ES Clase C, pero el RATIO no lo es. Son dos cifras distintas y
 * sólo una es inderivable.
 *
 * DERIVADO (asm, cadena completa):
 *
 *   ULTIMA.EXE 0x3ae6  RUN-N-FRAMES(n):
 *     0x3b07  call 0x5910          ; redibujo
 *     0x3b0e  call 0x20fa(1)       ; espera 1 tick
 *     0x3b11  dec si / jnz 0x3b07  ; ⇒ n veces. CMDS.OVL 0x0188 empuja 0x34 ⇒ n = 52
 *
 *   ULTIMA.EXE 0x5910  viewport_redraw:
 *     0x5941  call 0x4552          ; intérprete de anim POR ACTOR  (el SPRITE)
 *     0x5a1a  call 0x4102          ; motor de ambiente, modo 4     (la NOTA)
 *     0x5a1d  mov byte ptr [0x5891], 1   ; el latch queda a 1 en CADA salida
 *
 * CENSO (no «no encontré otro»): `grep -n "call 0x4552" *.asm` sobre los 28 .asm da
 * UNA sola línea, ULTIMA.EXE:9544 (=0x5941). `grep -n "call 0x4102"` da UNA sola,
 * ULTIMA.EXE:9625 (=0x5a1a). ⇒ NINGUNO de los dos tiene reloj propio: los dos son
 * hijos del MISMO redibujo, y los dos corren en él o en ninguno (el latch [0x5891]
 * los gatea a la vez, 0x5933 y 0x5a13).
 *
 * ⇒ Durante la canción: 52 redibujos ⇒ **52 pasos de sprite y 52 notas, intercalados
 * 1:1 dentro del mismo redibujo**. El RATIO es 1.000 y es ESTRUCTURAL — no depende de
 * la máquina. Lo que sí depende de la máquina es la TASA absoluta: 0x20fa se SALTA la
 * espera cuando n==1 y [0x5356] ≤ 0xF0 (0x2103 cmp ax,1 / 0x2108 cmp [0x5356],0xf0 /
 * 0x210e jle 0x2152) ⇒ los ms por vuelta son Clase C y siguen sin medir contra DOSBox.
 *
 * EL DEFECTO DEL PORT: el bardo colgaba del reloj de actores compartido (110 ms =
 * ANIM_TICK_MS×2, el modelo del redibujo del BUCLE PRINCIPAL) mientras la melodía la
 * agenda Web Audio a su paso de índice. Dos relojes independientes ⇒ ~68 frames contra
 * 52 notas sobre la misma fase, ratio 1.3 en vez de 1.0, y sin fase fija entre sprite
 * y nota. El bucle de la canción NO es el bucle principal, así que el reloj compartido
 * es el modelo equivocado PARA ESTE ACTOR.
 *
 * EL FIX: el bardo sale del runner compartido y va a uno propio, avanzado por
 * `CAMP_BARD_STEP_MS` = el paso de índice de la melodía. Lockstep POR CONSTRUCCIÓN:
 * los dos leen la misma constante. El reloj compartido NO se mueve — ni su periodo ni
 * su fase ni el frame de ningún otro actor (control negativo abajo).
 */
import { describe, expect, it } from "vitest";
import { FaithfulSkin } from "../src/skin/fiel/skin.js";
import { CAMP_BARD_STEP_MS, CAMP_BARD_INDEX_COUNT, cueDurationMs } from "../src/skin/fiel/speaker.js";
import { CAMP_BARD_ACTOR_ID, CAMP_BARD_PLAYING_TILE, CAMP_BARD_SEED } from "../src/skin/campScene.js";
import type { CoreView } from "../src/skin/api.js";

/** Tick base del reloj compartido (ANIM_TICK_MS en skin.ts), LITERAL + candado abajo. */
const TICK_MS = 55;

interface Snap {
  timeStopped?: boolean;
  campScene?: unknown;
  actors?: unknown[];
}

function makeSkin(snap: Snap): FaithfulSkin {
  const skin = new FaithfulSkin();
  (skin as unknown as Record<string, unknown>).view = {
    snapshot: () => snap,
    ambientSfx: () => {},
  } as unknown as CoreView;
  return skin;
}

/** Escena de camp con el bardo TOCANDO en (4,4) — lo único que `campBardActor` mira. */
const bardScene = {
  members: [{ charIdx: 0, col: 4, row: 4, tile: CAMP_BARD_PLAYING_TILE, guard: true, bard: true }],
};

type Priv = Record<string, unknown> & {
  tickAnimClock: (dtMs?: number) => boolean;
  buildActorFrames: (snap: unknown) => ReadonlyMap<number, number> | undefined;
};

/** Alimenta el reloj con `dtMs` de reloj de PARED repartidos en frames de rAF de ~16 ms. */
function feed(skin: FaithfulSkin, dtMs: number, frameMs = 16): void {
  const priv = skin as unknown as Priv;
  let left = dtMs;
  while (left > 0) {
    const dt = Math.min(frameMs, left);
    priv.accum = ((priv.accum as number) ?? 0) + dt;
    priv.tickAnimClock(dt);
    left -= dt;
  }
}

/**
 * Cuenta los pasos del intérprete del bardo envolviendo `tick()` de SU runner. Se
 * instrumenta desde el test (no con un contador en producción) para no meter estado
 * que sólo existe para medirse.
 */
function countBardSteps(skin: FaithfulSkin): () => number {
  const runner = (skin as unknown as Record<string, unknown>).campBardProg as {
    tick: () => void;
  };
  const orig = runner.tick.bind(runner);
  let n = 0;
  runner.tick = () => {
    n++;
    orig();
  };
  return () => n;
}

describe("bardo de acampada: lockstep sprite↔melodía (ficha #39, residuo 1)", () => {
  it("★ el paso del sprite ES el paso de índice de la melodía (una constante, no dos)", () => {
    // POR CONSTRUCCIÓN: si alguien reparte la canción en otro nº de slots, el paso del
    // sprite le sigue solo. Es la aserción que impide que los dos relojes vuelvan a
    // divergir en silencio.
    expect(CAMP_BARD_STEP_MS).toBeCloseTo(
      cueDurationMs({ id: "bard-song" }) / CAMP_BARD_INDEX_COUNT,
      6,
    );
    // …y NO es el paso del reloj compartido, que es el del bucle principal.
    expect(CAMP_BARD_STEP_MS).not.toBeCloseTo(TICK_MS * 2, 0);
  });

  it("★ sobre la canción entera da 52 pasos de sprite — uno por nota, como 0x3AE6(52)", () => {
    const skin = makeSkin({ campScene: bardScene });
    (skin as unknown as Priv).buildActorFrames({ campScene: bardScene }); // siembra el actor
    const steps = countBardSteps(skin);
    expect(steps()).toBe(0);
    // MEDIO paso de margen: la duración del cue es EXACTAMENTE 52 pasos, y una suma de
    // flotantes que caiga un ULP por debajo del borde daría 51. Con medio paso de más
    // el 52º está garantizado y el 53º sigue siendo imposible — el aserto mide el
    // RECUENTO, no la aritmética de coma flotante.
    feed(skin, cueDurationMs({ id: "bard-song" }) + CAMP_BARD_STEP_MS / 2);
    expect(steps()).toBe(CAMP_BARD_INDEX_COUNT); // 52, ni 51 ni los ~68 del reloj compartido
  });

  it("★ CONTROL NEGATIVO: el reloj compartido no se mueve — misma fase y mismo periodo", () => {
    // Sin esto, «el bardo ahora va a 144 ms» sería compatible con haber cambiado el
    // reloj de TODO el terreno (agua, fuego, banderas, NPC) — que es justo lo que este
    // carril NO puede hacer. La fase es el observable del reloj compartido.
    const conBardo = makeSkin({ campScene: bardScene });
    const sinBardo = makeSkin({});
    (conBardo as unknown as Priv).buildActorFrames({ campScene: bardScene });
    feed(conBardo, 7500);
    feed(sinBardo, 7500);
    expect(conBardo.animPhase).toBe(sinBardo.animPhase);
    expect(conBardo.animPhase).toBe(Math.floor(7500 / TICK_MS) & 0xffff);
  });

  it("el bardo NO cuelga del runner de actores compartido", () => {
    // Discriminante estructural: si el bardo siguiera en `actorProg`, este runner
    // tendría su id. Un fix que sólo cambiase ANIM_TICK_MS pasaría los tests de
    // recuento y moriría aquí.
    const skin = makeSkin({ campScene: bardScene });
    (skin as unknown as Priv).buildActorFrames({ campScene: bardScene });
    const shared = (skin as unknown as Record<string, unknown>).actorProg as {
      states: Map<string, unknown>;
    };
    expect(shared.states.has(CAMP_BARD_ACTOR_ID)).toBe(false);
    const own = (skin as unknown as Record<string, unknown>).campBardProg as {
      states: Map<string, unknown>;
    };
    expect(own.states.has(CAMP_BARD_ACTOR_ID)).toBe(true);
  });

  it("los frames siguen siendo 0x15D/0x15E/0x15F y nunca 0x15C", () => {
    // El fix mueve la CADENCIA, no el programa: el ciclo visible de §4a no cambia.
    const skin = makeSkin({ campScene: bardScene });
    const priv = skin as unknown as Priv;
    const seen = new Set<number>();
    for (let i = 0; i < CAMP_BARD_INDEX_COUNT * 4; i++) {
      const map = priv.buildActorFrames({ campScene: bardScene });
      seen.add(map?.get(4 * 11 + 4) ?? CAMP_BARD_PLAYING_TILE);
      feed(skin, CAMP_BARD_STEP_MS);
    }
    expect(seen.size).toBeGreaterThan(1); // anima de verdad
    expect([...seen].every((f) => f >= 0x15d && f <= 0x15f)).toBe(true);
    expect(seen.has(0x15c)).toBe(false);
    expect(CAMP_BARD_SEED).toBe(0x5f);
  });

  it("An Tym congela también al bardo (latch [0x5891] = 0 salta 0x4552 Y 0x4102)", () => {
    // 0x5924 `mov [0x5891],0` con g_time_spell=='T' ⇒ ni sprite ni nota. (En la
    // práctica CMDS.OVL 0x001c/0x001f BORRAN el hechizo al acampar, así que el caso no
    // es alcanzable en el original; se calca por coherencia del latch, no por mecánica.)
    const skin = makeSkin({ campScene: bardScene, timeStopped: true });
    (skin as unknown as Priv).buildActorFrames({ campScene: bardScene });
    const steps = countBardSteps(skin);
    feed(skin, cueDurationMs({ id: "bard-song" }));
    expect(steps()).toBe(0);
  });

  it("CANDADO: el literal TICK_MS de este test sigue casando con ANIM_TICK_MS del módulo", async () => {
    const src = await import("node:fs/promises").then((fs) =>
      fs.readFile(new URL("../src/skin/fiel/skin.ts", import.meta.url), "utf8"),
    );
    expect(src).toMatch(new RegExp(`const ANIM_TICK_MS = ${TICK_MS};`));
  });
});
