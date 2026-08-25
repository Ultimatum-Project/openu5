/**
 * Parser de la ESCENA DEL DEMO del attract (task #46 Stage 3) — el cine-guion que
 * el motor reproduce en el hueco del menú de la portada ("secuencia de demos de las
 * historias" del recuerdo del usuario). Derivado byte a byte de FONT.OVL
 * `font_scene_init` 0x04a4 + `load_scene` 0x0418 + el intérprete de 16 opcodes
 * (jump table FONT fileoff 0x94a); ver `re/notes/demo-scene-data.md`.
 *
 * FUENTE (FONT 0x04f7): el motor hace `open("MISCMAPS.DAT"); LSEEK(0x2c0=704);
 * READ(2000)` al buffer de escena (kernel_load_dat_record 0x256e = open+lseek+read,
 * cuerpo real en ULTIMA.EXE 0x7234). MISCMAPS.DAT mide 1871 B, así que lee los 1167
 * disponibles desde el byte 704. Layout del buffer resultante:
 *   - buffer[0..511]   = 4 tile-maps de 128 B (escenas 0..3). `load_scene(idx)` copia
 *                        una banda de 4 filas × 19 cols desde `buffer[idx*128 + row*32 + col]`.
 *   - buffer[512..]    = SCRIPT (bytecode del intérprete 0x04a4). PC inicial = 0x200.
 * El script cierra EXACTO en el último byte del fichero (opcode 9 RESTART @ EOF).
 *
 * Este parser extrae SÓLO datos (mapas + bytes de script + tablas de dirección). La
 * semántica de los 16 opcodes vive en el intérprete del juego (`skin/fiel/demo-scene.ts`),
 * único dueño del formato — reutilizable por el endgame #20 (mismo motor, g_location=0x42).
 * Ningún byte de EA viaja a ficheros tracked: sólo este JSON derivado.
 */

/** Offset del LSEEK dentro de MISCMAPS.DAT (FONT 0x0503 push 0x2c0). */
export const DEMO_SEEK = 0x2c0; // 704
/** PC inicial del intérprete dentro del buffer (FONT 0x0527 [bp-0xc]=0x200). */
export const SCRIPT_START = 0x200; // 512 en el buffer
/** Dimensiones de la banda que copia load_scene (0x0483 cmp 0x13 = 19 cols; 4 filas). */
export const SCENE_COLS = 19;
export const SCENE_ROWS = 4;
/** Nº de escenas (los 4 títulos del cluster; el script hace LOAD_SCENE 0..3). */
export const SCENE_COUNT = 4;

/** Datos de la escena del demo (lo que consume el intérprete del juego). */
export interface DemoSceneData {
  /** Fichero de origen (traza). */
  source: "MISCMAPS.DAT";
  /** LSEEK aplicado (704). */
  seek: number;
  /** Ancho/alto de la banda de tiles. */
  cols: number;
  rows: number;
  /** 4 tile-maps [escena][fila][col] = índice de tile del atlas. */
  maps: number[][][];
  /** Bytecode del script (desde buffer 0x200 hasta EOF); el intérprete lo decodifica. */
  script: number[];
  /** Tablas de delta de dirección N/E/S/W (DATA.OVL fo 0x24e6/0x24ee, stride 2). */
  dirs: { dcol: number[]; drow: number[] };
  /**
   * Rótulos por escena que `load_scene` (0x0425 push [scene*2+0x515c]) pasa al labeler:
   * los 4 títulos del cluster (DATA.OVL 0xa020..). El demo los muestra bajo el recuadro
   * = "la secuencia de las historias" (The Summoning/Journey/Arrival/Welcoming).
   */
  titles: string[];
}

/**
 * Extrae la escena del demo de MISCMAPS.DAT (+ DATA.OVL para las tablas de dirección).
 * Reproduce el LSEEK(704)+READ del motor y trocea el buffer en mapas + script.
 */
export function parseDemoScene(miscmaps: Uint8Array, dataOvl: Uint8Array): DemoSceneData {
  // Reproduce open+lseek+read: buffer = MISCMAPS.DAT[704 .. 704+2000] (recorte a EOF).
  const buf = miscmaps.subarray(DEMO_SEEK, DEMO_SEEK + 2000);

  // 4 mapas de 4 filas × 19 cols: cell(r,c) = buf[scene*128 + r*32 + c].
  const maps: number[][][] = [];
  for (let scene = 0; scene < SCENE_COUNT; scene++) {
    const rows: number[][] = [];
    for (let r = 0; r < SCENE_ROWS; r++) {
      const row: number[] = [];
      for (let c = 0; c < SCENE_COLS; c++) row.push(buf[scene * 128 + r * 32 + c] ?? 0);
      rows.push(row);
    }
    maps.push(rows);
  }

  // Script = buffer[0x200 .. fin del buffer disponible].
  const script = Array.from(buf.subarray(SCRIPT_START));

  // Tablas de dirección: DS 0x24d6 (dcol) / 0x24de (drow) → DATA.OVL fo +0x10, stride 2,
  // 4 direcciones (N/E/S/W). Byte con signo.
  const s = (b: number) => (b > 127 ? b - 256 : b);
  const dcol: number[] = [];
  const drow: number[] = [];
  for (let dir = 0; dir < 4; dir++) {
    dcol.push(s(dataOvl[0x24e6 + dir * 2] ?? 0));
    drow.push(s(dataOvl[0x24ee + dir * 2] ?? 0));
  }

  // Rótulos de escena (DATA.OVL: 4 títulos ASCIIZ del cluster 0xa020..).
  const titleAt = (fo: number): string => {
    let e = fo;
    while (e < dataOvl.length && dataOvl[e] !== 0) e++;
    return new TextDecoder("latin1").decode(dataOvl.subarray(fo, e));
  };
  const titles = [0xa020, 0xa02e, 0xa03a, 0xa046].map(titleAt);

  return { source: "MISCMAPS.DAT", seek: DEMO_SEEK, cols: SCENE_COLS, rows: SCENE_ROWS, maps, script, dirs: { dcol, drow }, titles };
}
