/**
 * Definiciones de los 48 enemigos de Ultima V — portadas de
 * `References/MapUnits/NonPlayerCharacters/EnemyReference.cs`, que es **Ultima5Redux**
 * (reimplementación de terceros), NO el binario. «Port de Redux» no es un aserto de
 * fidelidad al original: este mismo encabezado documenta abajo un bug de Redux que hay
 * que NO seguir, y la procedencia de cada campo es desigual (ver «Fuentes de datos»).
 *
 * Fuentes de datos — POR PROCEDENCIA (lo derivado del binario y lo que no):
 *  DEL BINARIO (tablas de DATA.OVL extraídas, `docs/formats/combat-dungeons.md` §1.9):
 *  - `ENEMY_STATS` (8 bytes × 48) = `data.enemyStats`  → str/dex/int/armour/damage/hp/maxPerMap/treasure
 *  - `ENEMY_FLAGS` (2 bytes × 48) = `data.enemyFlags`  → bitmap de habilidades (§1.9)
 *  - `ENEMY_ATTACK_RANGE`         = `data.enemyAttackRange`
 *
 *  DE REDUX, SIN DERIVAR (no salen de ninguna tabla del binario):
 *  - `AdditionalEnemyFlags.json`  → XP al morir, pesos por era, y flags de terreno
 *    (agua/arena/vuela sobre agua/atraviesa muros/no se mueve/ataca activamente).
 *    La tabla de movilidad DERIVADA (`re/notes/combat.md:445-461`, DS 0x153C) **no tiene
 *    bit «atraviesa muros»**, y `deliberate-divergences.md:572` declara el bitmap de clase
 *    de movimiento SIN DERIVAR. No apoyar veredictos de fidelidad en estos flags (es el
 *    defecto que la tanda 2 del barrido prosa-autofiel adjudicó en `ch24:41` cm66).
 *
 * Las habilidades se decodifican con la TABLA DE MÁSCARAS autoritativa del doc §1.9
 * (`docs/formats/combat-dungeons.md`), NO con el enum desplazado de Redux (bug
 * documentado). Los 2 bytes se combinan big-endian: `mask = (byte0 << 8) | byte1`.
 */

/** Sprite base del atlas para el enemigo `i`: 320 + i*4 (KeyTileReference de Redux,
 *  `N_FIRST_SPRITE=320`, `N_FRAMES_PER_SPRITE=4`). Verificado: Fighter(2)→328,
 *  Guard(12)→368, Rat(20)→400, Gargoyle(30)→440, Daemon(38)→472, ShadowLord(47)→508. */
const N_FIRST_SPRITE = 320;
const N_FRAMES_PER_SPRITE = 4;
/** Índice del barco pirata; Redux le fuerza el sprite PirateShip_Up (300). */
export const PIRATE_SHIP_NUMBER = 8;
const PIRATE_SHIP_SPRITE = 300;

/** Habilidades de un enemigo (§1.9). Cada bit del bitmap de 16 bits. */
export interface EnemyAbilities {
  bludgeons: boolean; // 0x8000
  possessCharm: boolean; // 0x4000
  undead: boolean; // 0x2000
  divideOnHit: boolean; // 0x1000
  immortal: boolean; // 0x0800
  poisonAtRange: boolean; // 0x0400
  stealsFood: boolean; // 0x0200
  noCorpse: boolean; // 0x0100
  rangedMagic: boolean; // 0x0080
  ranged: boolean; // 0x0040  (ataques a distancia — bit que el enum de Redux omite)
  teleport: boolean; // 0x0020
  disappearsOnDeath: boolean; // 0x0010
  invisibility: boolean; // 0x0008
  gatesInDaemon: boolean; // 0x0004
  poison: boolean; // 0x0002
  infectWithPlague: boolean; // 0x0001
}

export interface EnemyDef {
  index: number;
  name: string;
  /** Nombre de GRUPO (MAYÚSCULA plural, monsterNamesUpper[index]) — la línea de
   * identificación de la entrada a combate ("GIANT RATS"). "" si es un hueco. */
  groupName: string;
  str: number;
  dex: number;
  int: number;
  armour: number;
  damage: number;
  hp: number;
  maxPerMap: number;
  treasure: number;
  attackRange: number;
  abilities: EnemyAbilities;
  /** ☠️ CAMPO MUERTO para el juego: ningún camino concede esta XP (§1 del acta). Sólo lo
   *  leen 3 `expect` de `combat.test.ts` — verdes por construcción, incapaces de cazar
   *  una regresión de comportamiento porque no hay comportamiento que romper. */
  experience: number;
  tile: number;
  /**
   * ★ CLASE DE MOVIMIENTO (0-10, o 255) — el modelo del BINARIO, y desde #54 pieza 1 la
   * ÚNICA fuente de la pasabilidad de un enemigo en combate (`combat.ts::tilePassableFor`).
   * VERBATIM de DATA.OVL 0x5504[16+i]; ver `ENEMY_MOVE_CLASS` para la derivación completa.
   *
   * Es EXCLUYENTE, no una combinación de booleanos: el binario no tiene «vuela» + «acuático»
   * + «atraviesa muros», tiene UNA clase por mover y una jump-table de 11 handlers
   * (0x2C4C @0x2d60). Los tres booleanos de abajo vienen de una reimplementación de
   * terceros (Redux) y difieren de la clase en 8 casos enumerados
   * (`re/notes/mapeo-enemigo-mover.md` §5) — por eso ya NO deciden movilidad.
   */
  moveClass: number;
  // --- flags de terreno / comportamiento (de AdditionalEnemyFlags.json) ---
  /**
   * Sólo transita/aparece en agua (serpientes, calamares, tiburones...).
   * ⚠ YA NO decide la pasabilidad en combate (la decide `moveClass`); sobrevive porque lo
   * consumen la SIEMBRA del overworld (`world/enemies.ts`) y `saveNative.ts`, que son otra
   * cosa. Diverge de la clase 1 del binario en 2: Redux marca además 8 Pirates y
   * 43 Whirlpool.
   */
  isWater: boolean;
  /** Aparece en arena (Sand Trap). */
  isSand: boolean;
  /** Nunca se mueve ni huye (Reaper, Mimic, campos, Shard). */
  doesNotMove: boolean;
  /**
   * ⚠ YA NO decide movilidad (la decide `moveClass`). Se conserva como DATO de Redux para
   * el careo, y porque diverge de la clase 2 del binario en 5 de 9: sólo en el binario
   * 13 Apparation, 15 LordBritish y 38 Daemon; sólo en Redux 23 Ghost (que es clase 4) y
   * 37 Wisp (que es clase 0). Esa divergencia era la sospecha que el propio port se había
   * escrito en `combat.ts` («no copiar el name-matching de Redux a ciegas») — confirmada.
   */
  canFlyOverWater: boolean;
  /**
   * ⚠ YA NO decide movilidad (la decide `moveClass`); y ya NO es campo muerto por el otro
   * lado: el mecanismo EXISTE y desde #54 pieza 1 está cableado vía la clase 4.
   *
   * Se conserva como dato de Redux, que aquí se queda CORTO: la clase 4 del binario es
   * {23 Ghost, **47 Shadow Lord**} y Redux sólo marca al Ghost. El Shadow Lord
   * atravesando muros es además coherente con que sea incorpóreo.
   * El bloqueo que este campo declaraba («el mapeo enemigo→clase NO está derivado») quedó
   * LEVANTADO por la tarea #30 (`re/notes/mapeo-enemigo-mover.md`, 3 anclas independientes).
   */
  canPassWalls: boolean;
  /** ☠️ CAMPO MUERTO — ningún consumidor (ídem §1). La intención documentada era: si
   *  false, no entra en la cola de iniciativa (campos de veneno, dex 0). */
  activelyAttacks: boolean;
}

/** Decodifica el bitmap de 16 bits a habilidades con la tabla de máscaras del doc §1.9. */
export function decodeAbilities(mask: number): EnemyAbilities {
  const has = (m: number): boolean => (mask & m) !== 0;
  return {
    bludgeons: has(0x8000),
    possessCharm: has(0x4000),
    undead: has(0x2000),
    divideOnHit: has(0x1000),
    immortal: has(0x0800),
    poisonAtRange: has(0x0400),
    stealsFood: has(0x0200),
    noCorpse: has(0x0100),
    rangedMagic: has(0x0080),
    ranged: has(0x0040),
    teleport: has(0x0020),
    disappearsOnDeath: has(0x0010),
    invisibility: has(0x0008),
    gatesInDaemon: has(0x0004),
    poison: has(0x0002),
    infectWithPlague: has(0x0001),
  };
}

/** Datos de `AdditionalEnemyFlags.json` (una entrada por enemigo). */
export interface AdditionalEnemyFlag {
  Name: string;
  Experience: number;
  IsWaterEnemy: boolean;
  IsSandEnemy: boolean;
  DoNotMove: boolean;
  CanFlyOverWater: boolean;
  CanPassThroughWalls: boolean;
  ActivelyAttacks: boolean;
  Era1Weight: number;
  Era2Weight: number;
  Era3Weight: number;
}

/** Subconjunto de `data.json` que necesita `buildEnemyDefs`. */
export interface EnemyDataInput {
  enemyStats: number[][]; // 48 × 8
  enemyFlags: number[][]; // 48 × 2
  enemyAttackRange: number[]; // 48
  monsterNamesMixed: string[]; // 44 (con 4 huecos, ver hack de índice)
  /** Nombres de GRUPO en MAYÚSCULA PLURAL (48, índice DIRECTO por defIndex; "x"=hueco).
   * Los usa la línea de identificación de grupo de la entrada a combate ("GIANT RATS",
   * monsterNamesUpper[41]='TROLLS'). DATA.OVL MONSTER_NAMES_UPPER. */
  monsterNamesUpper: string[];
}

/**
 * Nombre singular mixed-case del enemigo. Port del "gross hack" de Redux
 * (`EnemyReference.cs:150`): la lista de nombres singulares omite 4 entradas, así
 * que hay que desplazar el índice. Los índices 8/9/42/43 no tienen nombre singular.
 */
function enemyName(i: number, af: AdditionalEnemyFlag, mixed: string[]): string {
  if (i !== PIRATE_SHIP_NUMBER && i !== 9 && i !== 42 && i !== 43) {
    let idx = i;
    if (i > 8) idx -= 2;
    if (i > 41) idx -= 2;
    const name = mixed[idx];
    if (name) return name;
  }
  // Fallback para los 4 huecos: nombre "clave" de AdditionalEnemyFlags sin dígitos.
  const [key = "", disp = ""] = af.Name.split("/");
  if (disp && disp !== "x") {
    return disp.charAt(0) + disp.slice(1).toLowerCase(); // "PIRATES" → "Pirates"
  }
  return key.replace(/\d+$/, "");
}

/**
 * CLASE DE MOVIMIENTO de cada uno de los 48 enemigos — VERBATIM de la tabla de 64 bytes
 * de DATA.OVL (fileoff 0x5504 = DS 0x54F4), leída byte a byte. NO es una interpretación:
 * son los bytes del fichero.
 *
 * La cadena que lleva de «enemigo i» a este índice está derivada en
 * `re/notes/mapeo-enemigo-mover.md` (tarea #30) y es, resumida:
 *   mover = `byte [0x5C5A + 8·objSlot]` = el TILE del objeto (SJOG 0x20D8 @0x2111)
 *   mover = **0x40 + 4·i**  ⇒  índice de clase = `mover >> 2` = **16 + i**
 *   `kernel_tile_passable` 0x2C4C @0x2c4f-0x2c56: `bx = mover >> 2` (dos `sar`),
 *   `al = [bx + 0x54F4]`, y `cmp ax,0x0a / ja` manda todo >10 a FALSE.
 * Anclada por TRES testigos preexistentes del repo (rata i=20 → 0x90, Ghost i=23 → 156,
 * Whirlpool i=43 → 236) — 3/3, ninguno escrito para esto.
 *
 * Las clases NO-CERO, con el nombre del enemigo (i = índice en la tabla de 48):
 *   1 (sólo agua)      16 Seahorse · 17 Squid · 18 SeaSerpent · 19 Shark
 *   2 (agua ∪ tierra)  13 Apparation · 15 LordBritish · 21 Bat · 28 Gazer ·
 *                      38 Daemon · 39 Dragon · 44 MongBat
 *   4 (ATRAVIESA MUROS) 23 Ghost · 47 ShadowLord
 *   7 (sólo tile 4)    46 RotWorm      8 (sólo tile 5)  45 Corpser
 *   9 (sólo tile 1)    43 Whirlpool   10 (sólo tile 7)  40 SandTrap
 * 255 (siempre bloqueado) 42 PoisonField
 * Todo lo demás es clase 0 (bitmap de a pie).
 */
export const ENEMY_MOVE_CLASS: readonly number[] = [
  /* i= 0..11 */ 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
  /* i=12..23 */ 0, 2, 0, 2, 1, 1, 1, 1, 0, 2, 0, 4,
  /* i=24..35 */ 0, 0, 0, 0, 2, 0, 0, 0, 0, 0, 0, 0,
  /* i=36..47 */ 0, 0, 2, 2, 10, 0, 255, 9, 2, 8, 7, 4,
];

/** Construye las 48 definiciones de enemigo combinando data.json + AdditionalEnemyFlags. */
export function buildEnemyDefs(
  data: EnemyDataInput,
  additionalFlags: AdditionalEnemyFlag[],
): EnemyDef[] {
  const defs: EnemyDef[] = [];
  for (let i = 0; i < 48; i++) {
    const stats = data.enemyStats[i];
    const flags = data.enemyFlags[i];
    const af = additionalFlags[i];
    if (!stats || stats.length < 8) throw new Error(`enemyStats[${i}] inválido`);
    if (!flags || flags.length < 2) throw new Error(`enemyFlags[${i}] inválido`);
    if (!af) throw new Error(`AdditionalEnemyFlags[${i}] ausente`);

    const mask = ((flags[0]! << 8) | flags[1]!) & 0xffff;
    const tile =
      i === PIRATE_SHIP_NUMBER
        ? PIRATE_SHIP_SPRITE
        : N_FIRST_SPRITE + i * N_FRAMES_PER_SPRITE;

    defs.push({
      index: i,
      name: enemyName(i, af, data.monsterNamesMixed),
      groupName: data.monsterNamesUpper?.[i] ?? "", // índice directo (troll 41='TROLLS')
      str: stats[0]!,
      dex: stats[1]!,
      int: stats[2]!,
      armour: stats[3]!,
      damage: stats[4]!,
      hp: stats[5]!,
      maxPerMap: stats[6]!,
      treasure: stats[7]!,
      attackRange: data.enemyAttackRange[i] ?? 1,
      abilities: decodeAbilities(mask),
      experience: af.Experience,
      tile,
      moveClass: ENEMY_MOVE_CLASS[i] ?? 0,
      isWater: af.IsWaterEnemy,
      isSand: af.IsSandEnemy,
      doesNotMove: af.DoNotMove,
      canFlyOverWater: af.CanFlyOverWater,
      canPassWalls: af.CanPassThroughWalls,
      activelyAttacks: af.ActivelyAttacks,
    });
  }
  return defs;
}
