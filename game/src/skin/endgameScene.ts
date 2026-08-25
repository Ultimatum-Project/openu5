/**
 * CEREBRO del pacer del endgame de la piel (H2b) — derivación PURA, sin DOM.
 *
 * ⚠ Los offsets sueltos de este fichero (0x0961, 0x0a27, 0x0a37…) son de **ENDGAME.OVL**.
 * El overlay se nombra aquí en MAYÚSCULAS a propósito: es el AVAL formal que la banda
 * pegajosa exige desde el ruling #204/#217 (`sower_upper`). Sin esta línea la atribución
 * se sostenía sólo en la palabra «endgame» en minúsculas y la banda la retiraba — aunque
 * fuese CIERTA (verificado: 0x0a27 = `mov byte ptr [0x5887], 0xf`, y 0x0a33 `dec`).
 * Ver `re/notes/pegajosa-instrumento-217-acta.md` §10.2/§11.
 *
 * Calca el reparto de refugeScene.ts (módulo puro) + el pacer de main.ts (runRefugeScene):
 * el core emite el guión (`buildEndgameScript`), y aquí se decide CÓMO se pacea cada beat.
 * El pacer modal DOM (montaje, tecla/timer, render por fase) vive en main.ts — presentación
 * PURA validada en la ventana frame-a-frame del testigo; este módulo es su lógica testeable.
 *
 * MODO de avance por fase (derivado del testigo + disasm):
 *  - `key`      TEXTO paceado por TECLA: el original imprime la página (kernel_print_ds
 *               0x75c0) y ESPERA input (`call 0x83dc`) antes de la siguiente. Aplica al
 *               diálogo del trono (GAP 3) y a las páginas de las pantallas de historia (GAP 6).
 *  - `timer`    ANIMACIÓN a reloj de pared (delays 0x7e6a): re-tinte verde, orb/moongate,
 *               disolución, pergamino — auto-avanzan (como la escena de refuge).
 *  - `terminal` FIN del pacer: `terminalFreeze` (victoria: frame congelado, sin input) o
 *               `terminalPrison` (varado: la sala verde queda JUGABLE pero sin salida).
 */
// Regla B (skin-import-guard, E1-S1): la piel lee el core SÓLO por TIPOS. El guión ya
// CONSTRUIDO (`EndgameScript`) le llega en runtime por el evento `{kind:"endgame"}` — el
// core lo arma con `buildEndgameScript` (mismo canal que RefugeScript). Aquí no se importa
// nada de runtime del core (las primitivas de sprite vienen del módulo fiel, mismo árbol).
import type { EndgameBeat, EndgamePhase, EndgameScript } from "../core/endgame/sequence.js";
import type { SfxCue } from "../core/sfx.js";
import type { EndgameActorView } from "./api.js";
import {
  GATE_CELL,
  LB_THRONE,
  MOONGATE_STEPS,
  PARTY_LINEUP,
  moveSpriteToward,
  wanderSprite,
  EndgameRng,
  DEFAULT_SEED,
  type EndgameActor,
} from "./fiel/endgame-scene.js";

/** Cómo avanza un beat: por TECLA (texto), por TIMER (animación) o TERMINAL (fin). */
export type EndgamePaceMode = "key" | "timer" | "terminal";

/** Modo de avance de una fase del endgame (ver cabecera). */
export function endgamePaceMode(phase: EndgamePhase): EndgamePaceMode {
  switch (phase) {
    case "dialogue":
    case "storyHouse":
    case "storyDream":
      return "key";
    case "greenScene":
    case "orbMoongate":
    case "dissolve":
    case "scroll":
      return "timer";
    case "terminalFreeze":
    case "terminalPrison":
      return "terminal";
  }
}

/** Un paso del plan de paceo: el beat del guión + cómo lo avanza la piel. */
export interface EndgamePlanStep {
  beat: EndgameBeat;
  mode: EndgamePaceMode;
}

/**
 * Plan de paceo para un guión YA CONSTRUIDO (el core lo emite en el evento): sus beats
 * etiquetados con el MODO de avance. main.ts lo recorre — espera tecla en los `key`, arma
 * timer en los `timer`, y en el `terminal` cierra la escena (freeze o sala-prisión). El
 * guión trae el `ending` (victory/stranded), así que este plan sirve para AMBAS ramas.
 */
export function planEndgame(script: EndgameScript): EndgamePlanStep[] {
  return script.beats.map((beat) => ({
    beat,
    mode: endgamePaceMode(beat.phase),
  }));
}

// ────────────────────────────────────────────────────────────────────────────────────
// FORMACIÓN de la escena verde (GAP 2) + TIMELINE del orb/moongate (GAP 4) + WANDER de
// la sala-prisión (GAP 3b). Derivación PURA sin DOM: main.ts reproduce estos frames a
// reloj de pared (`setEndgameScene`) y emite los cues de cada frame.
// ────────────────────────────────────────────────────────────────────────────────────

/** Sprite de Lord British DE PIE («rey andante») — TileData 380 = LordBritish1 (grupo
 *  de 4 frames de andar del banco alto). El testigo ~27 s: LB pasa de trono a DE PIE. */
export const LB_WALK_TILE = 0x17c;

/**
 * LB SENTADO de la rama varada (GAP 3b, testigo 1:16: «LB se sienta en la silla de la
 * mesa»): la silla de la mesa del mapa MISCMAPS[528:704] es el tile 0x92 en (col8,row4)
 * → sprite sentado index-paralelo 0x132 (SitChair*, misma regla que partyPose 0x130 +
 * (silla − 0x90)). La silla elegida (hay dos flanqueando la mesa) es careo del testigo.
 */
export const LB_SEATED = { tile: 0x132, col: 8, row: 4 } as const;

/**
 * Formación de la escena VERDE (GAP 2): los absorbidos REAPARECEN en la formación de
 * saludo (destinos DATA.OVL 0x3e5a/0x3e60, `PARTY_LINEUP`) y Lord British queda DE PIE
 * junto al trono (`LB_THRONE` (5,3); sprite «rey andante» LordBritish1 0x17c). Es el
 * re-add por sprites del throne_scene 0x0000 (retiro reversible del absorb, GAP 1→2).
 */
export function endgameLineup(
  lbTile: number,
  partyTiles: readonly number[],
): EndgameActorView[] {
  const actors: EndgameActorView[] = [
    { tile: lbTile, col: LB_THRONE.col, row: LB_THRONE.row },
  ];
  partyTiles.forEach((tile, i) => {
    const dest = PARTY_LINEUP[i] ?? GATE_CELL;
    actors.push({ tile, col: dest.col, row: dest.row });
  });
  return actors;
}

/** Un frame del timeline del orb/moongate (fase `orbMoongate`). */
export interface OrbGateFrame {
  /** Sprites VIVOS del frame (los que ya entraron al gate desaparecen). */
  actors: EndgameActorView[];
  /** Etapa del moongate en (5,4): 1..16, o null (aún no plantado / ya cerrado). */
  moongate: number | null;
  /** Celda del ORB parpadeando, o null. */
  orb: { col: number; row: number } | null;
  /** Cue de sonido de ESTE frame (orb-sweep 0x0973 / `move-step` por paso de sprite
   *  0x04fe→0x433e; lo emite el pacer al reproducirlo). Los ticks/reveal son MUDOS. */
  sfx?: SfxCue;
}

/**
 * Timeline DETERMINISTA de la fase `orbMoongate`, calcado de la traza byte-a-byte de
 * endgame_main 0x0961-0x0a73 (GAP 4). SONIDO corregido por la adenda fanfarria-re
 * 2026-07-22 (re/notes/fanfarria-endgame-espectral.md §3/§7): los `0xffff9856` de esta
 * fase son RUN-N-FRAMES (pausas MUDAS de pacing), NO beeps — los «15 tonos asc/desc»
 * eran los 15 FRAMES de animación del reveal ([0x5887] consumido por 0x56ac→0x1112):
 *  1. ORB al suelo (0x0968-0x098f): el sprite #6 se activa y se retira («la partícula
 *     parpadea y desaparece») con su barrido de lanzamiento (`endgame-orb`, sweep
 *     0x7f02 REAL, 0x0973). La celda del orb = la del gate (5,4).
 *  2. APARECE el gate (0x0992-0x09ac): tile 0xdc, contador 0x5887 1→16 — 15 frames
 *     MUDOS de animación (el tick(1) por etapa sólo pacea; etapa 16 = puerta llena).
 *  3. LB entra el PRIMERO (0x09ae-0x09d0): tick(4) mudo de pacing, anda de (5,3) a
 *     (5,4) (`move_sprite_toward` 0x510 — cada paso SUENA: 0x04fe→0x433e click-clack,
 *     cue `move-step`) y se BORRA al llegar + tick(1) mudo.
 *  4. La party UNO A UNO (0x09d7-0x0a24): cada miembro anda hasta (5,4) (pasos con
 *     `move-step`), se borra al llegar, tick(1) mudo.
 *  5. El gate se CIERRA (0x0a27-0x0a37): 15 frames MUDOS y desaparece. El contador
 *     NO es el espejo del abrir: 0x0a27 escribe `[0x5887]=0xf` y el `dec/jne` de
 *     0x0a33 lo baja a 0 ⇒ etapas 15..1 (el abrir sí va 1→16, `cmp 0x10/jb`).
 * La CADENCIA por frame es de la piel (Clase C, calibrada al testigo 2:34 ~85-100 s).
 */
export function buildOrbMoongateTimeline(
  lbTile: number,
  partyTiles: readonly number[],
): OrbGateFrame[] {
  const frames: OrbGateFrame[] = [];
  const lb: EndgameActor = { tile: lbTile, col: LB_THRONE.col, row: LB_THRONE.row, active: true };
  const party: EndgameActor[] = partyTiles.map((tile, i) => ({
    tile,
    col: (PARTY_LINEUP[i] ?? GATE_CELL).col,
    row: (PARTY_LINEUP[i] ?? GATE_CELL).row,
    active: true,
  }));
  const alive = (): EndgameActorView[] =>
    [lb, ...party]
      .filter((a) => a.active)
      .map((a) => ({ tile: a.tile, col: a.col, row: a.row }));
  const push = (
    moongate: number | null,
    orb: { col: number; row: number } | null,
    sfx?: SfxCue,
  ): void => {
    frames.push(sfx ? { actors: alive(), moongate, orb, sfx } : { actors: alive(), moongate, orb });
  };

  // 1. Orb al suelo: parpadeo (aparece con el barrido de lanzamiento, desaparece).
  push(null, { col: GATE_CELL.col, row: GATE_CELL.row }, { id: "endgame-orb" });
  push(null, { col: GATE_CELL.col, row: GATE_CELL.row });
  push(null, null);

  // 2. El moongate BROTA: etapas 1..16 — 15 frames MUDOS de animación (el «tono» por
  // etapa del censo era el tick(1) de pacing del reveal; adenda fanfarria-re §3).
  for (let stage = 1; stage <= MOONGATE_STEPS; stage++) {
    push(stage, null);
  }

  // 3. LB entra el primero: tick(4) mudo (0x09b2, un frame de pausa), anda hasta
  // (5,4) — cada paso de move_sprite_toward SUENA (0x04fe→0x433e, cue `move-step`,
  // el click-clack del kernel ya portado) — se borra al llegar + tick(1) mudo.
  push(MOONGATE_STEPS, null);
  while (moveSpriteToward(lb, GATE_CELL.col, GATE_CELL.row))
    push(MOONGATE_STEPS, null, { id: "move-step" });
  lb.active = false;
  push(MOONGATE_STEPS, null);

  // 4. La party UNO A UNO: cada miembro anda hasta (5,4) (pasos con `move-step`),
  // se borra al llegar, tick(1) mudo de pacing.
  for (const m of party) {
    while (moveSpriteToward(m, GATE_CELL.col, GATE_CELL.row))
      push(MOONGATE_STEPS, null, { id: "move-step" });
    m.active = false;
    push(MOONGATE_STEPS, null);
  }

  // 5. El gate se CIERRA (0x0a27-0x0a37): `[0x5887]=0xf` y decrementa → etapas 15..1,
  // 15 frames MUDOS (espejo del abrir, sin sonido), y desaparece.
  for (let stage = MOONGATE_STEPS - 1; stage >= 1; stage--) {
    push(stage, null);
  }
  push(null, null);

  return frames;
}

/**
 * Estado del WANDER de la sala-prisión (rama varada, GAP 3b): el binario cae a un bucle
 * de idle INFINITO (0x0ac9/0x0ae7, 4×`wander_sprite` 0x05a2 por pasada) — los miembros
 * deambulan por el suelo 0x44 para siempre y LB queda SENTADO (el «reposicionamiento»
 * que el testigo 1:16 observó entre frames). Determinista bajo la semilla fija del port.
 */
export class EndgamePrisonWander {
  private readonly rng = new EndgameRng(DEFAULT_SEED);
  private readonly party: EndgameActor[];
  constructor(
    /** LB sentado (sprite fijo; NO deambula). */
    private readonly lbSeated: EndgameActorView,
    partyActors: readonly EndgameActorView[],
    private readonly room: ReadonlyArray<readonly number[]>,
  ) {
    this.party = partyActors.map((a) => ({ ...a, active: true }));
  }

  /** Una pasada del bucle de idle: deambula la party 1 paso RNG-gateado. */
  step(): EndgameActorView[] {
    for (const m of this.party) wanderSprite(m, this.room, this.rng);
    return [this.lbSeated, ...this.party.map((a) => ({ tile: a.tile, col: a.col, row: a.row }))];
  }
}
