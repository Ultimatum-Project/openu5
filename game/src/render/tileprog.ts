/**
 * Intérprete del BYTECODE de animación por-actor del original (`anim_script_tick
 * 0x4552`) — capa de VISTA pura. Calca el motor de programas de 16 B en `DS:0x1b18`
 * (mapa `DS:0x1bc8`, offset delta 0, `re/notes/tile-anim-census.md §2`) que anima
 * fuego/antorchas, banderas de castillo, y otras decoraciones ondeantes/titilantes.
 *
 * ⚠ Es DISTINTO del reloj maestro determinista (`tileanim.ts`, `0x44b8`): aquí cada
 * tile animado lleva un PC+timer y el avance está gateado por RNG (50 %/llamada) y
 * hay opcodes probabilísticos (5/6). Para NO tocar el stream de juego (render-RNG
 * excluido, task #17) el gate/opcodes usan un **PRNG LOCAL de vista declarado**
 * (`ViewPrng`), no `g_rng` (0x5420).
 *
 * SEMÁNTICA exacta (leída de `0x4552`/`0x46c2`):
 *  - Estado por actor empaquetado como `[reg+6] = (PC<<4) | timer` (dos nibbles).
 *  - `timer==0xf` → salta (centinela); `timer!=0` → `timer--`, espera (sin avanzar).
 *  - `timer==0` → GATE: salvo base∈{0x5c,0xa8}, `rand(0,0xff)`; si `<0x80` no hace nada
 *    (50 %). Si pasa, ejecuta el bucle de opcodes:
 *      op>7  → delay: `timer = op-0x80`, `PC++`, PARA.
 *      op 0  → `PC=0`, SIGUE.
 *      op 1–4 → muestra frame `base+op-1`, `PC++`, PARA.
 *      op 5  → `rand`; `>=0x40` (75 %) `PC++` y SIGUE; si no, frame=`base`, `timer=6`
 *              (salvo base 0x5c), PARA.
 *      op 6  → `rand`; `>=0xc0` (25 %) `PC++` y SIGUE; si no `PC=0` y SIGUE.
 *      op 7  → `PC=2`, SIGUE.
 *    (byte más allá del programa = 0 → op0). PC/timer se enmascaran a 4 bits.
 *
 * Régimen de arquitectura: los PC/timer viven en el RENDERER (esta capa), no en el
 * core. `render/` puede leer `core/tiles` (Regla C) pero no importa la piel.
 */

/** Guardas de base que el original SALTA (no anima): `<0x34`, `0xe8`, `0xb4`. */
function baseSkipped(base: number): boolean {
  return base < 0x34 || base === 0xe8 || base === 0xb4;
}

/** Bases con ejecución directa (SIN gate RNG del 50 %): 0x5c, 0xa8 (`0x4611/0x4617`). */
function baseUngated(base: number): boolean {
  return base === 0x5c || base === 0xa8;
}

/**
 * PRNG LOCAL de vista (mulberry32) — declarado NO ligado al `g_rng` del juego
 * (task #17: el RNG de render no debe desalinear el stream). Sólo alimenta el gate
 * del 50 % y los opcodes 5/6 del intérprete. Determinista dado su seed (testeable).
 */
export class ViewPrng {
  private s: number;
  constructor(seed: number) {
    this.s = seed >>> 0;
  }
  /** Siguiente entero en [0, 0xff] (calca el rango de `rand_range(0,0xff)`). */
  next255(): number {
    let t = (this.s += 0x6d2b79f5) >>> 0;
    t = Math.imul(t ^ (t >>> 15), t | 1) >>> 0;
    t = (t ^ (t + Math.imul(t ^ (t >>> 7), t | 61))) >>> 0;
    return ((t ^ (t >>> 14)) >>> 0) & 0xff;
  }
}

/**
 * Estado por-actor del intérprete: `base` del grupo (byte bajo 0x34..0xfc, como
 * `[reg+0]&0xfc` en el original), `bank` de sprite a re-sumar al frame mostrado
 * (0 = decoración de banco bajo; `SPRITE_BANK` = actor de banco alto, ver §4 del witness
 * `re/notes/witness-idle-anim-sequences.md`), PC, timer, frame ya con banco.
 *
 * `seed` = el byte `[reg+0]` **CRUDO**, del que `base` es sólo `&0xfc`. Casi siempre
 * coinciden (`kernel_spawn_actor` siembra `al = tipo*4 + 0x40`, ULTIMA.EXE 0x663e-0x6647
 * ⇒ los 2 bits bajos a 0), pero NO siempre: el camp escribe 0x5F (CMDS.OVL 0x017c
 * `b05f mov al,0x5f`) en el bardo de guardia. Importa en DOS sitios que el original
 * lee de `[reg+0]` y no de la base: el frame SEMBRADO y la rama 25 % del op5
 * (`0x467c mov al, byte ptr [si]`). Ver `re/notes/camp-bard-anim.md`.
 */
export interface ProgState {
  base: number;
  bank: number;
  /** Byte `[reg+0]` crudo (== `base` salvo el bardo de acampada). */
  seed: number;
  pc: number;
  timer: number;
  frame: number;
}

/**
 * Estado inicial de un actor con `base` (byte bajo), `bank` de sprite (0 por
 * defecto = banco bajo; `SPRITE_BANK` = actor — la constante y no su valor en hex:
 * el bit de banco NO es un offset de rutina, y un hex suelto en un docblock hereda
 * el overlay en mayúsculas citado más arriba y entra en la banda como atribución
 * sostenida FALSA; lo cazó `test_banda_criterios` al aterrizar #35) y `seed` =
 * byte `[reg+0]` crudo (por defecto
 * `base`, que es el caso de todo actor sembrado por `kernel_spawn_actor`). PC=0,
 * timer=0, frame = `bank|seed`. El frame inicial es el tile SIN mutar (lo sembrado)
 * ⇒ el primer render antes de cualquier `tick` es idéntico al previo
 * (goldens/parity invariantes).
 */
export function initProgState(base: number, bank = 0, seed = base): ProgState {
  return { base, bank, seed: seed & 0xff, pc: 0, timer: 0, frame: bank | (seed & 0xff) };
}

/**
 * Avanza UN actor UNA llamada del reloj de animación (calco del cuerpo del bucle
 * de `0x4552` por actor). Muta `st`. `program` = bytes del programa (opcodes+delays).
 * `prng` alimenta el gate 50 % y los opcodes 5/6. No-op si la base está saltada.
 */
export function tickProg(st: ProgState, program: readonly number[], prng: ViewPrng): void {
  const { base } = st;
  if (baseSkipped(base)) return;
  // Centinela / espera del timer (nibble bajo de [reg+6]).
  if (st.timer === 0xf) return;
  if (st.timer !== 0) {
    st.timer = (st.timer - 1) & 0xf;
    return;
  }
  // Gate RNG del 50 % (salvo bases directas 0x5c/0xa8).
  if (!baseUngated(base) && prng.next255() < 0x80) return;
  // Bucle de opcodes: PARA en show-frame/delay, SIGUE en control (0/5adv/6/7).
  // Cota de seguridad por si un programa cicla sin PARAR (no debería).
  for (let guard = 0; guard < 32; guard++) {
    const op = program[st.pc] ?? 0; // byte más allá del programa = 0 → op0
    if (op > 7) {
      st.timer = (op - 0x80) & 0xf;
      st.pc = (st.pc + 1) & 0xf;
      return;
    }
    if (op >= 1 && op <= 4) {
      st.frame = st.bank | ((base + op - 1) & 0xff);
      st.pc = (st.pc + 1) & 0xf;
      return;
    }
    if (op === 0) {
      st.pc = 0;
      continue;
    }
    if (op === 5) {
      if (prng.next255() >= 0x40) {
        st.pc = (st.pc + 1) & 0xf; // 75 %: avanza
        continue;
      }
      // 25 %: frame "apagado" = `[reg+0]` CRUDO (`0x467c mov al, byte ptr [si]`, no la
      // base). Luego el asm BIFURCA por base (`0x467f cmp 0x5c`):
      //  · base 0x5c → `je 0x4660` = **PC++** y SIN timer (el bardo no descansa: sigue
      //    tocando, y el 0x4660 mete el PC en el `00` de fin de programa ⇒ la vuelta
      //    siguiente reinicia por op0). SIN este PC++ el intérprete se quedaba clavado
      //    en el op5 para siempre = bardo CONGELADO (defecto latente, sin caso vivo
      //    hasta que la escena de camp lo usó).
      //  · resto → `0x4685 timer=6` y el PC NO avanza (descanso en el frame apagado).
      st.frame = st.bank | st.seed;
      if (base === 0x5c) st.pc = (st.pc + 1) & 0xf;
      else st.timer = 6;
      return;
    }
    if (op === 6) {
      if (prng.next255() >= 0xc0) {
        st.pc = (st.pc + 1) & 0xf; // 25 %: avanza
      } else {
        st.pc = 0; // 75 %: reinicia
      }
      continue;
    }
    // op === 7
    st.pc = 2;
  }
}

/**
 * Programas de animación CONFIRMADOS EN VIVO por el oráculo (scout de píxel-mask),
 * indexados por tile-base del grupo (`[reg+0] & 0xfc`). Contenido = bytes del
 * programa `0x1b18` (delta 0). Se AMPLÍA cada vez que el scout confirma la
 * secuencia real de tile-ids de una familia. Vacío ⇒ el intérprete no anima nada.
 */
export const PROGRAM_BY_BASE: ReadonlyMap<number, readonly number[]> = new Map([
  // Antorchas / braseros / hoguera de pared (dump en vivo): frames 0-3 + delay 7.
  [0xb0, [0x01, 0x02, 0x03, 0x04, 0x87]],
  // Hoguera 0xdc (dump en vivo): ping-pong 0-1-2-1-... con opcode-5 RNG al final.
  [0xdc, [0x02, 0x03, 0x04, 0x03, 0x02, 0x05]],
]);

/**
 * Bases HABILITADAS para animar por el intérprete en runtime. VACÍO por diseño:
 * cada familia se enchufa aquí SÓLO cuando el scout confirma su SECUENCIA real de
 * tile-ids (evita el "morphing" —p.ej. antorcha 0xb0→brasero 0xb2→hoguera 0xb3—
 * hasta saber qué frames muestra de verdad). Ver `tile-anim-census.md §4`.
 */
export const ENABLED_PROGRAM_BASES: ReadonlySet<number> = new Set<number>();

/** Base de grupo (`tile & 0xfc`) alineada a 4, para indexar `PROGRAM_BY_BASE`. */
export function progBase(tile: number): number {
  return tile & 0xfc;
}

/**
 * Runner por-celda del viewport: mantiene un `ProgState` por celda visible y lo
 * avanza una vez por llamada del reloj de animación. Si el tile de una celda cambia
 * (scroll/turno) reinicia su estado (calco aproximado: el original persiste estado
 * por-actor; aquí es por-celda de vista, aceptado por el lead). Sólo actúa sobre
 * tiles cuya base está en `ENABLED_PROGRAM_BASES`.
 */
export class TileProgRunner {
  private readonly states: (ProgState | null)[];
  private readonly prng: ViewPrng;

  constructor(cellCount: number, seed = 0x1b18c0de) {
    this.states = new Array<ProgState | null>(cellCount).fill(null);
    this.prng = new ViewPrng(seed);
  }

  /**
   * Frame a mostrar para el tile de una celda. Si su base está habilitada y tiene
   * programa, devuelve el frame del intérprete; si no, el tile tal cual.
   */
  frameFor(cell: number, tile: number): number {
    if (tile < 0) return tile;
    const base = progBase(tile);
    if (!ENABLED_PROGRAM_BASES.has(base) || !PROGRAM_BY_BASE.has(base)) return tile;
    const st = this.states[cell];
    if (st && st.base === base) return st.frame;
    // Celda nueva o tile cambiado → (re)inicia el estado en este tile.
    const fresh = initProgState(base);
    this.states[cell] = fresh;
    return fresh.frame;
  }

  /** Avanza TODOS los actores de celda una llamada del reloj de animación. */
  tick(): void {
    for (const st of this.states) {
      if (!st) continue;
      const program = PROGRAM_BY_BASE.get(st.base);
      if (program) tickProg(st, program, this.prng);
    }
  }
}

/**
 * Programas de animación de REPOSO de los ACTORES del banco alto (0x1xx),
 * CONFIRMADOS EN VIVO por el oráculo (`re/notes/witness-idle-anim-sequences.md`,
 * 2026-07-19; cierra el hueco de `sprite-anim-cadence.md §4`). Indexados por el
 * byte bajo del tile (`tile & 0xfc`, = `[reg+0]&0xfc` del original). Contenido =
 * bytes del programa `0x1b18` leídos de la RAM VIVA (no del mapa estático de
 * DATA.OVL, que §2 de `tile-anim-census` probó corrupto). Separados de
 * `PROGRAM_BY_BASE` a propósito: el gating es «actor de banco alto», NO «tile con
 * esa base» — esos mismos bytes bajos (0x48/0x54/0x70…) son también TERRENO en el
 * banco bajo y el runner por-celda de terreno NO debe animarlos.
 */
const ACTOR_PROGRAMS: ReadonlyArray<{ prog: readonly number[]; bases: readonly number[] }> = [
  // ── PERSONAS (§4/§4ter/§4quater): banco COMPLETO 0x40-0x7f (todas capturadas en vivo) ──
  {
    prog: [0x02, 0x03, 0x04, 0x05],
    // Wizard/Bard/Fighter/Avatar-tile/Towns/Merchant (§4/§4ter) + Jester/BardPlaying/
    // Stocks/WallPrisoner/Child/Begger/Apparation/Blackthorn/LordBritish (§4quater).
    bases: [0x40, 0x44, 0x48, 0x4c, 0x50, 0x54, 0x58, 0x5c, 0x60, 0x64, 0x68, 0x6c, 0x74, 0x78, 0x7c],
  },
  { prog: [0x02, 0x84, 0x03, 0x84, 0x04, 0x84, 0x05], bases: [0x70] }, // Guard (progid 5, delay 4)
  // ── MONSTRUOS/CRIATURAS (§4bis, captura en vivo capture_monsters.out) ──
  // progid 0: ciclo 3 frames + descanso op5 (el más común).
  {
    prog: [0x02, 0x03, 0x04, 0x05],
    bases: [0x80, 0x84, 0x88, 0x90, 0xa4, 0xac, 0xbc, 0xc4, 0xcc, 0xd4, 0xe0, 0xec, 0xf8, 0xfc],
  },
  // progid 1: 4-ciclo limpio.
  { prog: [0x01, 0x02, 0x03, 0x04], bases: [0x94, 0x9c, 0xa0, 0xc0, 0xc8, 0xd0, 0xd8] },
  // progid 2: ping-pong (MongBat).
  { prog: [0x01, 0x02, 0x03, 0x04, 0x03, 0x04, 0x01, 0x02], bases: [0xf0] },
  // progid 3: 4 frames + retención 7 en el frame 3 (Gazer).
  { prog: [0x01, 0x02, 0x03, 0x04, 0x87], bases: [0xb0] },
  // progid 4: frame0 + HALT 0x8f (Mimic, UNGATED) → CAMUFLAJE ESTÁTICO (el 0x8f = timer
  // 0xf = centinela de salto; el intérprete lo congela solo, sin caso especial).
  { prog: [0x01, 0x8f, 0x02, 0x03, 0x04], bases: [0xa8] },
  // progid 6: Spider.
  { prog: [0x01, 0x02, 0x01, 0x02, 0x03, 0x04, 0x02, 0x03, 0x04], bases: [0x98] },
  // progid 7: ping-pong + op5 (Dragon, Troll).
  { prog: [0x02, 0x03, 0x04, 0x03, 0x02, 0x05], bases: [0xdc, 0xe4] },
  // progid 8: frame0 + HALT 0x8f (Corpser) → CAMUFLAJE ESTÁTICO (trampa de suelo quieta).
  { prog: [0x01, 0x8f, 0x02, 0x03, 0x04, 0x07], bases: [0xf4] },
  // progid 9: delays 2 + op6 (Shark).
  { prog: [0x02, 0x82, 0x03, 0x82, 0x04, 0x82, 0x06, 0x01], bases: [0x8c] },
  // progid 0x0a: 3 frames + op5 (StoneGargoyle).
  { prog: [0x01, 0x02, 0x03, 0x05], bases: [0xb8] },
];

/**
 * Programas de animación de REPOSO de los ACTORES del banco alto (0x1xx),
 * CONFIRMADOS EN VIVO por el oráculo (`re/notes/witness-idle-anim-sequences.md` §4
 * personas + §4bis monstruos, 2026-07-19). Indexados por el byte bajo del tile
 * (`tile & 0xfc`, = `[reg+0]&0xfc` del original). Separados de `PROGRAM_BY_BASE` a
 * propósito: el gating es «actor de banco alto», NO «tile con esa base» — esos
 * mismos bytes bajos (0x48/0xb0/0xdc…) son también TERRENO en el banco bajo y el
 * runner por-celda de terreno NO debe animarlos.
 *
 * NOTA HALT (§4bis hallazgo 1): Mimic (0xa8) y Corpser (0xf4) llevan `op 0x8f`
 * (= delay `0x8f-0x80`=0x0f = timer centinela) ⇒ el intérprete los CONGELA en el
 * frame base+0 (camuflaje: el mimic finge cofre, el corpser trampa de suelo). No
 * hay caso especial: `tickProg` respeta el centinela 0xf; basta el programa correcto.
 */
export const ACTOR_PROGRAM_BY_BASE: ReadonlyMap<number, readonly number[]> = new Map(
  ACTOR_PROGRAMS.flatMap(({ prog, bases }) => bases.map((b) => [b, prog] as const)),
);

/** Bytes bajos de actor HABILITADOS para animar por el intérprete por-actor. */
export const ENABLED_ACTOR_BASES: ReadonlySet<number> = new Set(ACTOR_PROGRAM_BY_BASE.keys());

/**
 * Runner del intérprete `0x4552` POR-ACTOR (calco del original: un `ProgState`
 * persistente por actor de la tabla `0x5c5a`, indexado aquí por el `id` estable
 * del `ActorView`). Sustituye al modelo per-turn (`sprite-anim-cadence §3`) SÓLO
 * para los NPC del banco alto: éstos animan CONTINUO por bytecode (RNG-gated) en
 * reposo, como el original; el party-leader se congela y NO entra aquí (no está
 * en `0x5c5a` → el caller lo excluye por `id === "party"`).
 *
 * `ViewPrng` LOCAL (no `g_rng`): el gate 50 %/opcodes 5-6 NO tocan el stream del
 * juego (render-RNG excluido, #17) ⇒ determinismo del Grand Tour intacto.
 */
export class ActorProgRunner {
  private readonly states = new Map<string, ProgState>();
  private readonly prng: ViewPrng;

  constructor(seed = 0x5c5a1d1e) {
    this.prng = new ViewPrng(seed);
  }

  /**
   * Frame a mostrar para un actor `id` con `tile` de banco alto. Si su byte bajo
   * está habilitado, devuelve el frame del intérprete (con banco re-sumado); si no,
   * el tile tal cual → el caller cae a su animación previa. Siembra el estado la
   * primera vez (frame = tile sembrado ⇒ el primer render es idéntico al previo).
   *
   * `seed` = byte `[reg+0]` CRUDO cuando NO coincide con la base del grupo (único
   * caso vivo: el bardo de acampada, 0x5F — CMDS.OVL 0x017c). Omitido ⇒ `base`,
   * que es lo que siembra `kernel_spawn_actor` para todo lo demás ⇒ salida
   * byte-idéntica para los callers previos.
   */
  frameFor(id: string, tile: number, seed?: number): number {
    if (tile < 0) return tile;
    const base = progBase(tile) & 0xff; // byte bajo (0x48, 0x70…)
    if (!ENABLED_ACTOR_BASES.has(base) || !ACTOR_PROGRAM_BY_BASE.has(base)) return tile;
    const bank = tile & 0xff00;
    const rawSeed = (seed ?? base) & 0xff;
    let st = this.states.get(id);
    if (!st || st.base !== base || st.bank !== bank || st.seed !== rawSeed) {
      st = initProgState(base, bank, rawSeed);
      this.states.set(id, st);
    }
    return st.frame;
  }

  /**
   * Reconcilia el conjunto de actores vivos: siembra los nuevos (frame sembrado) y
   * DESCARTA los que ya no están (evita fugas de estado por ids muertos). Llamar
   * cada render antes de leer frames. Los actores no habilitados no crean estado.
   */
  sync(actors: readonly { id: string; tile: number; seed?: number }[]): void {
    const live = new Set<string>();
    for (const a of actors) {
      const base = progBase(a.tile) & 0xff;
      if (!ENABLED_ACTOR_BASES.has(base)) continue;
      live.add(a.id);
      this.frameFor(a.id, a.tile, a.seed); // siembra si falta / re-siembra si cambió
    }
    for (const id of this.states.keys()) if (!live.has(id)) this.states.delete(id);
  }

  /** Avanza TODOS los actores vivos una llamada del reloj de animación (~110 ms). */
  tick(): void {
    for (const st of this.states.values()) {
      const program = ACTOR_PROGRAM_BY_BASE.get(st.base);
      if (program) tickProg(st, program, this.prng);
    }
  }
}
