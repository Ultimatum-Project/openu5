/**
 * DEMO-SCENE — el intérprete del cine-guion del attract (task #46 Stage 3).
 *
 * Reproduce EN NUESTRO MOTOR la "secuencia de demos de las historias" que el DOS
 * original pone en el hueco del menú: el motor de escena de FONT.OVL
 * (`font_scene_init` 0x04a4 con g_location=0x40) leyendo MISCMAPS.DAT[704:] —
 * 4 tile-maps + un script de 16 opcodes. Derivación byte a byte en
 * `re/notes/demo-scene-data.md`. Sustituye el calco provisional
 * (`summoning-room.ts` + `attract-figures.ts`), que el usuario refutó ("solo sale
 * la habitación, que además no es igual, y un avatar moviéndose sin ton ni son").
 *
 * Este módulo es PURO (presentación): decodifica los datos (`demo-scene.json`,
 * parser `extractor/.../demo-scene.ts`) y genera una lista DETERMINISTA de frames.
 * El blit de tiles + el disparo de SFX viven en `ui/faithful-intro.ts`. El
 * intérprete es reutilizable tal cual por el endgame (#20): mismo motor, mismos
 * opcodes; sólo cambia el registro de datos cargado.
 *
 * FIDELIDAD del intérprete (FONT.OVL 0x04a4 + scene_tick 0x02fc + load_scene 0x0418):
 *   - Tabla de actores (0x5c5a, 32 slots): PLACE/ERASE/MOVE/WALK escriben tile+(col,row).
 *   - scene_tick(n) corre n frames; cada frame abre la CORTINA de revelado 1 columna
 *     por lado en frames alternos (0xbd26/27=9 al cargar, toggle 0xbd28), anima el
 *     MOONGATE (modo 3: frame 0..7, chime en 0 y 4) y emite TRUENO (modo 2).
 *   - MOONGATE sube en 15 frames (0x2f32) + planta tile 0xdc + trueno; baja igual.
 *   - RESTART reinicia el script → bucle infinito (termina por tecla en el original).
 */

/**
 * Forma de `demo-scene.json` (emitido por `extractor/.../parsers/demo-scene.ts`):
 * 4 tile-maps de la banda (4×19) + bytecode del script + tablas de dirección N/E/S/W.
 */
export interface DemoSceneData {
  source: string;
  seek: number;
  cols: number;
  rows: number;
  /** [escena][fila][col] = índice de tile del atlas. */
  maps: number[][][];
  /** Bytecode del script (desde buffer 0x200 hasta EOF). */
  script: number[];
  /** Deltas de dirección N/E/S/W (índice = dir del opcode). */
  dirs: { dcol: number[]; drow: number[] };
  /** Rótulo por escena (The Summoning/Journey/Arrival/Welcoming). */
  titles: string[];
}

/** Tile del moongate que planta el script (FONT 0x0683 al=0xdc). */
export const MOONGATE_TILE = 0xdc;
/** Tile de "flash" que ANIM7/ANIM8 ponen sobre el actor (FONT 0x0715 al=0x16). */
const FLASH_TILE = 0x16;
/** Columna-eje del revelado por cortina (bd26/bd27 arrancan en 9). */
const CURTAIN_CENTER = 9;

/** Los 16 opcodes del intérprete (jump table FONT fileoff 0x94a). */
export const enum Op {
  PLACE = 0, ERASE = 1, MOVE = 2, TICK = 3, MGRISE = 4, MGFALL = 5,
  SCENE = 6, ANIM7 = 7, ANIM8 = 8, RESTART = 9, SETTILE = 10, SUMMON = 11,
  CLEAR = 12, WALK = 13, LOOP = 14, NEXT = 15,
}

/** Nº de operandos de cada opcode (para decodificar/avanzar el PC). */
const OPERANDS: Record<number, number> = {
  [Op.PLACE]: 4, [Op.ERASE]: 1, [Op.MOVE]: 2, [Op.TICK]: 1, [Op.MGRISE]: 2,
  [Op.MGFALL]: 0, [Op.SCENE]: 1, [Op.ANIM7]: 1, [Op.ANIM8]: 1, [Op.RESTART]: 0,
  [Op.SETTILE]: 3, [Op.SUMMON]: 2, [Op.CLEAR]: 0, [Op.WALK]: 2, [Op.LOOP]: 1, [Op.NEXT]: 0,
};

/** Un opcode decodificado del bytecode. */
export interface DemoInstr {
  op: Op;
  args: number[];
}

/**
 * Decodifica el bytecode del script en instrucciones (FONT 0x0974: opcode>15 se
 * ignora; cada handler consume sus operandos). No sigue el flujo (LOOP/RESTART los
 * resuelve el intérprete); es un desensamblado lineal para test/inspección.
 */
export function decodeScript(script: readonly number[]): DemoInstr[] {
  const out: DemoInstr[] = [];
  let pc = 0;
  while (pc < script.length) {
    const op = script[pc]!;
    if (op > 15) { pc += 1; continue; }
    const n = OPERANDS[op]!;
    out.push({ op, args: script.slice(pc + 1, pc + 1 + n) });
    pc += 1 + n;
  }
  return out;
}

/** Un actor de la escena (tabla 0x5c5a; stride 8: tile en +0/+1, col +2, fila +3). */
interface Actor { tile: number; col: number; row: number; active: boolean }

/** Un frame renderizado del demo. */
export interface DemoFrame {
  /** Escena (mapa) activa. */
  scene: number;
  /** Rejilla visible (rows×cols). tile o -1 si la cortina aún no reveló esa columna. */
  tiles: number[];
  /**
   * Rejilla de TERRENO (rows×cols) SIN actores — el `display` DINÁMICO (incluye las
   * mutaciones de SETTILE: puertas que abren/cierran, moongate plantada), con la misma
   * cortina que `tiles`. Es lo que hay DEBAJO de cada actor; la piel shader lo usa como
   * terreno-bajo-actor al componer el sprite transparente (si usara el mapa estático de
   * la escena mostraría la puerta CERRADA bajo un actor que cruza el hueco abierto).
   */
  terrain: number[];
  /** SFX a disparar en este frame (o null). */
  sfx: DemoSfx | null;
  /** Efectos de PÍXEL sobre la rejilla en este frame (dissolve, beam). Vacío/ausente si no hay. */
  fx?: DemoFx[];
}

export type DemoSfx = "thunder" | "chime" | "summon";

/**
 * Efecto de píxel sobre una celda (lo que el blit de dissolve `0x2e88` o el beam del
 * SUMMON hacen y que la rejilla de tiles no captura). El render lo pinta ENCIMA de la
 * banda. `dissolve` = revela `shown/256` píxeles del sprite en orden Bayer (aparición
 * ANIM7 / desaparición ANIM8 de los Shadowlords y el círculo de invocación).
 */
export type DemoFx =
  | {
      kind: "dissolve";
      col: number;
      row: number;
      /** Sprite (ya en el banco de móviles, +0x100) que se disuelve. */
      tile: number;
      /** Píxeles revelados 0..256 (0 = invisible, 256 = completo). */
      shown: number;
    }
  | {
      /**
       * BEAM/proyectil del SUMMON (op11): un segmento diagonal que se MUEVE 5 pasos
       * (FONT 0x07f0 loop, `di+=9` x, `si+=3` y; base (0x80,0x98)+(0x89,0x9b) = (128,152)-
       * (137,155)). Coords BAND-LOCAL en px (origen de la banda = pantalla y 0x78=120).
       */
      kind: "beam";
      x0: number;
      y0: number;
      x1: number;
      y1: number;
    }
  | {
      /**
       * MOONGATE abriéndose/cerrándose (op4 MGRISE / op5 MGFALL). El bucle `si=1..0xf`
       * de FONT 0x0657-0x0674 llama `call 0x2f32` que — con la base de overlay de FONT
       * (+0xe1e0) — resuelve a **kernel 0x1112**: EL MISMO blit parcial del moongate de
       * la vista de juego (`fiel/moongate.ts`, driver gráfico fn 0x60). NO es un GROW por
       * escala: la puerta SE REVELA por filas DESDE ABAJO (sale del suelo), idéntico al
       * juego. `stage` = 1..15 (de 16); en `stage` 16 el script planta el tile 0xdc lleno.
       */
      kind: "moongate";
      col: number;
      row: number;
      stage: number;
    };

/** Pasos del dissolve de ANIM7/ANIM8 (0x2e88); ~8 = revelado pixelado breve. */
export const DISSOLVE_STEPS = 8;
/** Pasos del beam del SUMMON (op11, bucle de 5). */
const SUMMON_BEAM_STEPS = 5;
/** Pasos de apertura/cierre del moongate (op4/op5, bucle si=1..0xf). */
export const MOONGATE_STEPS = 15;

/**
 * ¿Hay un tile de la familia WATERFALL (0xd4–0xd7) VISIBLE en el frame? Gate del AMBIENTE
 * de cascada del carril de audio del intro (replica el motor de sonido del original 0x416c
 * modo 2, `& 0xfc == 0xd4`). `-1` = celda aún oculta por la cortina (no cuenta). Puro.
 */
export function frameHasWaterfall(tiles: readonly number[]): boolean {
  return tiles.some((t) => t >= 0 && (t & 0xfc) === 0xd4);
}

/** Familias de tile de AMBIENTE presentes en el frame visible, para el escáner ambiente
 *  del carril de audio (replica el motor 0x416c del original): Waterfall (0xd4–0xd7),
 *  Fountain (0xd8–0xdb) y Clock (0xfa–0xfb). `-1` = celda oculta por la cortina. Puro. */
export interface DemoAmbientTiles {
  waterfall: boolean;
  fountain: boolean;
  clock: boolean;
}
export function frameAmbientTiles(tiles: readonly number[]): DemoAmbientTiles {
  let waterfall = false;
  let fountain = false;
  let clock = false;
  for (const t of tiles) {
    if (t < 0) continue;
    const m = t & 0xfc;
    if (m === 0xd4) waterfall = true;
    else if (m === 0xd8) fountain = true;
    if ((t & 0xfe) === 0xfa) clock = true;
  }
  return { waterfall, fountain, clock };
}

/**
 * Simula UN ciclo completo del script (hasta RESTART) y devuelve sus frames. El
 * demo es idéntico en cada ciclo, así que el llamador reproduce esta lista en bucle
 * (el original recicla por RESTART; termina por tecla — eso lo gestiona el ciclo del
 * menú, no el intérprete). Determinista.
 */
export function buildDemoFrames(data: DemoSceneData): DemoFrame[] {
  const { cols, rows, script } = data;
  const frames: DemoFrame[] = [];

  // Estado del motor.
  let scene = 0;
  let bg: number[] = new Array(rows * cols).fill(0); // capa de fondo (mapa)
  const display: number[] = new Array(rows * cols).fill(0); // capa visible
  const actors: Actor[] = Array.from({ length: 32 }, () => ({ tile: 0, col: 0, row: 0, active: false }));

  // Cortina de revelado (bd26/bd27 = 9 al cargar; abre 1 col/lado en frames alternos).
  let revLo = CURTAIN_CENTER;
  let revHi = CURTAIN_CENTER;
  let revToggle = false;

  // Modo de escena (0xbd29) y animación del moongate (0x515a: 0..7).
  let moonFrame = 0;
  // Moongate activo en pantalla (para MGFALL, que reutiliza la posición del MGRISE).
  let moonCol = 0;
  let moonRow = 0;

  const idx = (col: number, row: number) => row * cols + col;

  const loadScene = (n: number): void => {
    scene = n;
    const map = data.maps[n] ?? data.maps[0]!;
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
      bg[idx(c, r)] = map[r]![c]!;
    }
    // load_scene fija bd26=bd27=9 → la cortina se re-cierra al eje y vuelve a abrir.
    revLo = CURTAIN_CENTER;
    revHi = CURTAIN_CENTER;
    revToggle = false;
  };

  // Recompón la capa visible: fondo + moongate/settile ya viven en bg/display overlay;
  // los ACTORES se pintan encima en cada frame (scene_tick 0x0312-0x0340). El blit de
  // celda (FONT 0x02a2) mapea el tile del actor al BANCO DE MÓVILES sumándole 0x100
  // (0x02e3: ah=0; ah+=1 → tile|0x0100) — por eso el byte 0x4c del guion es el sprite
  // 0x14c (Avatar con escudo), 0xfc→0x1fc (Shadowlord azul), y el 0x16 de slot9 es
  // 0x116 = el CÍRCULO DE INVOCACIÓN gris de "The Summoning" (witness f070). El +0x100
  // vale para TODO actor, incluido 0x16 (op7/op8 dibujan origtile|0x100 vía 0x2e88).
  const composite = (): { tiles: number[]; terrain: number[] } => {
    // TERRENO = display DINÁMICO (con las mutaciones de SETTILE: puertas abiertas 0x44,
    // moongate plantada), SIN actores. `tiles` = terreno + actores encima. Ambos con la
    // MISMA cortina. El terreno es lo que hay bajo cada actor (para el shader transparente).
    const terrain = display.slice();
    const tiles = display.slice();
    for (const a of actors) if (a.active && a.col < cols && a.row < rows) {
      tiles[idx(a.col, a.row)] = a.tile + 0x100; // banco de móviles (sprite = byte | 0x100)
    }
    // Aplica la cortina: columnas fuera de [revLo,revHi] ocultas (-1) en ambas capas.
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
      if (c < revLo || c > revHi) {
        tiles[idx(c, r)] = -1;
        terrain[idx(c, r)] = -1;
      }
    }
    return { tiles, terrain };
  };

  // FX de píxel pendientes para el PRÓXIMO frame emitido (dissolve/beam). Se adjuntan y
  // se limpian tras cada frame (el efecto los repone en cada paso).
  let pendingFx: DemoFx[] | null = null;

  // scene_tick(n, mode): corre n frames, emitiendo cada uno un DemoFrame.
  const sceneTick = (n: number, mode: 0 | 2 | 3): void => {
    for (let i = 0; i < n; i++) {
      let sfx: DemoSfx | null = null;
      // Cortina: abre 1 col/lado en frames alternos (toggle bd28), hasta [0,cols-1].
      if (revToggle) {
        if (revLo > 0) revLo--;
        if (revHi < cols - 1) revHi++;
      }
      revToggle = !revToggle;
      // Modo 2 = trueno (una vez, al inicio del tick de moongate).
      if (mode === 2 && i === 0) sfx = "thunder";
      // Modo 3 = moongate: frame 0..7, chime en 0 y 4.
      if (mode === 3) {
        moonFrame = (moonFrame + 1) & 7;
        if (moonFrame === 0 || moonFrame === 4) sfx = "chime";
      }
      const { tiles, terrain } = composite();
      const f: DemoFrame = { scene, tiles, terrain, sfx };
      if (pendingFx) f.fx = pendingFx;
      frames.push(f);
    }
  };

  // Dissolve pixelado de un actor (0x2e88): ANIM7 dir='in' (aparecer), ANIM8 'out'
  // (desaparecer). Durante el efecto el actor NO lo pinta composite (inactivo); lo pinta
  // el fx revelando `shown` píxeles del sprite. Al aparecer queda activo; al desaparecer,
  // inactivo (el ERASE del guion lo confirma).
  const dissolve = (slot: number, dir: "in" | "out"): void => {
    const s = actors[slot];
    if (!s || !s.active) { sceneTick(1, 0); return; }
    const sprite = s.tile + 0x100;
    const col = s.col, row = s.row;
    s.active = false;
    for (let k = 1; k <= DISSOLVE_STEPS; k++) {
      const frac = dir === "in" ? k : DISSOLVE_STEPS - k;
      pendingFx = [{ kind: "dissolve", col, row, tile: sprite, shown: Math.round((256 * frac) / DISSOLVE_STEPS) }];
      sceneTick(1, 0);
    }
    pendingFx = null;
    if (dir === "in") s.active = true;
  };

  const setTile = (tile: number, col: number, row: number): void => {
    if (col < cols && row < rows) { bg[idx(col, row)] = tile; display[idx(col, row)] = tile; }
  };

  // Actualiza la capa visible desde el fondo en una celda (ERASE/MOVE restauran fondo).
  const restoreBg = (col: number, row: number): void => {
    if (col < cols && row < rows) display[idx(col, row)] = bg[idx(col, row)] ?? 0;
  };

  // Copia inicial de display desde bg tras cada load (scene_tick lo hace por celda).
  const syncDisplay = (): void => { for (let k = 0; k < display.length; k++) display[k] = bg[k] ?? 0; };

  // ---- intérprete ----
  let pc = 0;
  let loopCount = 0;
  let loopReturn = 0;
  let guard = 0;
  const dcol = data.dirs.dcol;
  const drow = data.dirs.drow;

  for (;;) {
    if (pc >= script.length) break;
    if (++guard > 100000) break; // salvaguarda anti-bucle (no debería activarse)
    const op = script[pc]!;
    if (op > 15) { pc++; continue; }
    const a = (k: number) => script[pc + 1 + k]!;
    switch (op as Op) {
      case Op.PLACE: {
        const s = actors[a(0)]!;
        s.tile = a(1); s.col = a(2); s.row = a(3); s.active = true;
        pc += 5; break;
      }
      case Op.ERASE: {
        const s = actors[a(0)]!;
        restoreBg(s.col, s.row); s.active = false; s.tile = 0;
        pc += 2; break;
      }
      case Op.MOVE: {
        const s = actors[a(0)]!, d = a(1);
        restoreBg(s.col, s.row);
        s.col += dcol[d] ?? 0; s.row += drow[d] ?? 0;
        pc += 3; break;
      }
      case Op.TICK: { sceneTick(a(0), 0); pc += 2; break; }
      case Op.MGRISE: {
        moonCol = a(0); moonRow = a(1);
        // 15 frames de APERTURA (FONT 0x0651-0x0674, bucle si=1..0xf con `call 0x2f32`
        // = kernel 0x1112 = blit parcial del moongate del juego): la puerta SE REVELA
        // por filas DESDE ABAJO. El fx lo pinta sobre el fondo; el tile lleno se planta
        // al final (FONT 0x0683 al=0xdc), equivalente a la etapa 16.
        for (let k = 1; k <= MOONGATE_STEPS; k++) {
          pendingFx = [{ kind: "moongate", col: moonCol, row: moonRow, stage: k }];
          sceneTick(1, 0);
        }
        pendingFx = null;
        setTile(MOONGATE_TILE, moonCol, moonRow); // moongate completo, plantado
        sceneTick(2, 2); // trueno
        pc += 3; break;
      }
      case Op.MGFALL: {
        // CIERRE en la MISMA posición del último MGRISE (FONT 0x0694, bucle si=0xf..1):
        // el moongate SE OCULTA por filas hacia abajo (inverso del RISE, mismo 0x1112).
        setTile(5, moonCol, moonRow); // el fondo bajo el moongate = tile 5 (FONT 0x06db)
        for (let k = MOONGATE_STEPS - 1; k >= 1; k--) {
          pendingFx = [{ kind: "moongate", col: moonCol, row: moonRow, stage: k }];
          sceneTick(1, 0);
        }
        pendingFx = null;
        sceneTick(2, 2); // trueno
        pc += 1; break;
      }
      case Op.SCENE: {
        loadScene(a(0)); syncDisplay(); pc += 2; break;
      }
      case Op.ANIM7: {
        // op7 = APARECER: dissolve-in del sprite propio del actor (origtile|0x100). Para
        // slot9 (0x16→0x116) es el círculo de invocación materializándose.
        dissolve(a(0), "in");
        pc += 2; break;
      }
      case Op.ANIM8: {
        // op8 = DESAPARECER: dissolve-out (el actor se disuelve hacia el fondo).
        dissolve(a(0), "out");
        pc += 2; break;
      }
      case Op.RESTART: {
        // Fin del ciclo: el original reinicia PC=0x200. Devolvemos un ciclo completo.
        return frames;
      }
      case Op.SETTILE: { setTile(a(0), a(1), a(2)); pc += 4; break; }
      case Op.SUMMON: {
        // Invocación (op11): BEAM/proyectil de 5 pasos (bucle 0x07f0, di+=9/si+=3) que se
        // mueve en diagonal + sonido + scene_tick(3) modo moongate. Cada paso emite un
        // frame con el segmento en su posición (band-local px; base (128,152)-(137,155),
        // origen de banda = pantalla y 120).
        for (let k = 0; k < SUMMON_BEAM_STEPS; k++) {
          const dx = 9 * k, dy = 3 * k;
          pendingFx = [{ kind: "beam", x0: 128 + dx, y0: 32 + dy, x1: 137 + dx, y1: 35 + dy }];
          sceneTick(1, 0);
        }
        pendingFx = null;
        {
          const { tiles, terrain } = composite();
          frames.push({ scene, tiles, terrain, sfx: "summon" });
        }
        sceneTick(3, 3);
        pc += 3; break;
      }
      case Op.CLEAR: {
        for (const s of actors) { s.active = false; s.tile = 0; s.col = 0; s.row = 0; }
        pc += 1; break;
      }
      case Op.WALK: {
        const s = actors[a(0)]!, d = a(1);
        restoreBg(s.col, s.row);
        s.col += dcol[d] ?? 0; s.row += drow[d] ?? 0;
        sceneTick(7, 0); // paso VISIBLE (0x0919 scene_tick(7))
        pc += 3; break;
      }
      case Op.LOOP: { loopCount = a(0); loopReturn = pc + 2; pc += 2; break; }
      case Op.NEXT: {
        if (--loopCount > 0) pc = loopReturn; else pc += 1;
        break;
      }
      default: pc++; break;
    }
  }
  return frames;
}
