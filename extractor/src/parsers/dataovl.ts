/**
 * Parser de DATA.OVL de Ultima V (MS-DOS).
 *
 * Los offsets y formatos provienen de docs/formats/tlk-npc-dataovl-gam.md §3,
 * contrastados con la fuente primaria reference/Ultima5Redux/.../DataOvlReference.cs
 * (AddDataChunk(formato, desc, offset, longitud, valueModifier, nombre)).
 *
 * Formatos:
 *   - StringList: strings ASCII \0-terminadas consecutivas dentro de [offset, offset+len).
 *   - ByteList:   bytes crudos.
 *   - UINT16List: little-endian.
 *   - valueModifier (vm): se SUMA a cada valor leído.
 */

import { u16le, stringList } from "./binary.js";

/**
 * Clase de un chunk de DATA.OVL:
 *  - "string-pool":   pool de strings ASCII \0-terminadas (texto real del juego).
 *  - "data-table":    tabla numérica/binaria (sus bytes pueden ser imprimibles
 *                     por coincidencia; no es texto).
 *  - "data-table" (cont.): forma inferida del censo de accesos del disasm
 *                     (re/tools/dataovl_census.py, re/notes/dataovl-tables.md).
 *  - "runtime-state": ventana del DGROUP (= imagen de DATA.OVL en RAM): valores
 *                     iniciales de estado mutable en ejecución. Ver
 *                     re/notes/command-dispatch.md §4 y re/notes/dataovl-strings.md.
 *  - "header":        cabecera MZ-overlay del fichero (no se carga en RAM).
 *  - "inert":         relleno/ceros jamás referenciados por el código.
 */
export type DataOvlChunkKind =
  | "string-pool"
  | "data-table"
  | "runtime-state"
  | "header"
  | "inert";

export interface DataOvlChunk {
  /** offset en el fichero DATA.OVL */
  offset: number;
  /** longitud en bytes */
  length: number;
  kind: DataOvlChunkKind;
  /** nombre funcional del chunk */
  name: string;
  /** nota descriptiva */
  note: string;
  /** si true, parseDataOvl vuelca sus strings en `stringPools` */
  emitStrings?: boolean;
}

/**
 * Catálogo COMPLETO de DATA.OVL (Task 2.2): PARTICIÓN de los 48464 bytes del
 * fichero — cada byte pertenece a exactamente un chunk nombrado, sin huecos
 * ni solapes. Fuente de verdad para
 * `extractor/tests/dataovl-coverage.test.ts` (todo run de ≥4 bytes
 * imprimibles debe caer dentro de algún chunk) y réplica exacta de
 * re/tools/dataovl_catalog.py (que lo marca en el ledger).
 *
 * Evidencia de las tablas numéricas: censo de accesos DS del disasm
 * (re/tools/dataovl_census.py; detalle por chunk en
 * re/notes/dataovl-tables.md). Fuente secundaria: Ultima5Redux
 * DataOvlReference.cs ("Redux").
 *
 * SINCRONÍA: re/tools/test_dataovl_catalog.py exige igualdad de (offset,
 * length, kind, name) entre ambas listas Y cobertura del 100 %; las `note`
 * son prosa y quedan FUERA de la comparación.
 */
export const DATAOVL_CHUNKS: DataOvlChunk[] = [
  { offset: 0x0000, length: 0x10, kind: "header", name: "ovlRelocHeader", note: "cabecera MZ-overlay: 3 entradas de reubicación (words de segmento de los far ptrs DS:0x5216/0x52AA/0x5396); no se carga en RAM (fileoff = DS+0x10)" },
  { offset: 0x0010, length: 0x8, kind: "inert", name: "nullPtrGuard", note: "DS:0x0000-0x0007 a cero, sin ninguna referencia en el censo: guarda del puntero nulo del runtime C" },
  { offset: 0x0018, length: 0x38, kind: "string-pool", name: "crtCopyright", note: "artefacto MSC: \"MS Run-Time Library - Copyright (c) 1988, Microsoft\"" },
  { offset: 0x0050, length: 0x2, kind: "data-table", name: "wordUnk0050", note: "word 0x0011 tras el copyright; sin refs mem fiables en el censo (los hits a DS:0x40 son inmediatos aritméticos)" },
  { offset: 0x0052, length: 0xa6, kind: "string-pool", name: "longArmour", note: "nombres largos de armadura" },
  { offset: 0x00f8, length: 0x81, kind: "string-pool", name: "weaponNames", note: "nombres de arma" },
  { offset: 0x0179, length: 0x5a, kind: "string-pool", name: "ringsAmulets", note: "anillos y amuletos" },
  { offset: 0x01d3, length: 0x158, kind: "string-pool", name: "monsterNamesMixed", note: "nombres de monstruo (mixed case)" },
  { offset: 0x032b, length: 0x165, kind: "string-pool", name: "monsterNamesUpper", note: "nombres de monstruo (mayúsculas)" },
  { offset: 0x0490, length: 0x23, kind: "string-pool", name: "scrollSpellCodes", note: "códigos de sílabas de los 8 scrolls con prefijo '*': *VL (Vas Lor), *RH (Rel Hur), *IS, *IA, *IQW, *KXC, *IMC, *AT (An Tym); gemelos sin prefijo en scrollShortforms (0x8C2D)", emitStrings: true },
  { offset: 0x04b3, length: 0x10, kind: "string-pool", name: "bangStrings", note: "8 strings '!' consecutivos (uno por scroll, tras scrollSpellCodes)" },
  { offset: 0x04c3, length: 0x2b, kind: "string-pool", name: "specialItemNames", note: "objetos especiales" },
  { offset: 0x04ee, length: 0x18, kind: "string-pool", name: "parenDigitStrings", note: "8 strings '(0'..'(7' (glifo '(' + dígito; Redux: \"(x where x goes from 0 to 7\"); sin refs directas en el censo", emitStrings: true },
  { offset: 0x0506, length: 0x29, kind: "string-pool", name: "shards", note: "fragmentos (shards)" },
  { offset: 0x052f, length: 0x43, kind: "string-pool", name: "specialItemNames2", note: "objetos especiales 2" },
  { offset: 0x0572, length: 0x77, kind: "string-pool", name: "shortArmour", note: "nombres cortos de armadura" },
  { offset: 0x05e9, length: 0xa2, kind: "string-pool", name: "weaponNamesShort", note: "nombres cortos de arma (Flame Oil, Main Gauche, ...)", emitStrings: true },
  { offset: 0x068b, length: 0x1, kind: "inert", name: "pad068b", note: "byte 0x00 entre pools; sin refs" },
  { offset: 0x068c, length: 0x30, kind: "string-pool", name: "potions", note: "pociones" },
  { offset: 0x06bc, length: 0x4d, kind: "string-pool", name: "reagents", note: "reagentes" },
  { offset: 0x0709, length: 0x1bb, kind: "string-pool", name: "spells", note: "hechizos (48)" },
  { offset: 0x08c4, length: 0x7c, kind: "string-pool", name: "classAndStatusNames", note: "clases/títulos (Avatar..Shepherd) + estados (Good Health, Poisoned, Dead, Asleep)", emitStrings: true },
  { offset: 0x0940, length: 0x1, kind: "inert", name: "pad0940", note: "byte 0x00 entre pools; sin refs" },
  { offset: 0x0941, length: 0x64, kind: "string-pool", name: "spellRunes", note: "sílabas rúnicas de hechizo" },
  { offset: 0x09a5, length: 0xa8, kind: "string-pool", name: "spellMnemonicCodes", note: "48 códigos-abreviatura de hechizo, uno por entrada de `spells` en el mismo orden (IL=In Lor, GP=Grav Por, ..., AT=An Tym); engloba el antiguo spellReagentCodes (0x0A07)", emitStrings: true },
  { offset: 0x0a4d, length: 0x14b, kind: "string-pool", name: "locationNames", note: "nombres de localización" },
  { offset: 0x0b98, length: 0x48, kind: "string-pool", name: "virtues", note: "virtudes" },
  { offset: 0x0be0, length: 0x1e, kind: "string-pool", name: "mantras", note: "mantras" },
  { offset: 0x0bfe, length: 0x2fc, kind: "string-pool", name: "storeNames", note: "nombres de tienda" },
  { offset: 0x0efa, length: 0x152, kind: "string-pool", name: "shoppeKeeperNames", note: "nombres de tenderos" },
  { offset: 0x104c, length: 0x24e, kind: "string-pool", name: "talkCompressedWords", note: "palabras comprimidas de los .TLK" },
  { offset: 0x129a, length: 0x11b, kind: "string-pool", name: "assetFilenames1", note: "nombres de fichero gráfico/datos (PROPORT.PCS, BRITISH.BIT, TITLE.BIT, ...)", emitStrings: true },
  { offset: 0x13b5, length: 0x9, kind: "data-table", name: "townTable13b5", note: "9 bytes (00 04 09 0F 08 11 0A 0B 0A) leídos solo por TOWN.OVL:0x377 `mov al,[si+0x13A5]`" },
  { offset: 0x13be, length: 0xe, kind: "runtime-state", name: "dgroupVars13be", note: "7 words de estado inicializado (2,3,1,1,2,3,3) = g_unk_13ae..g_unk_13ba del diccionario de globals; push/mov word desde 12+ ficheros (parámetros de ventana/vídeo)" },
  { offset: 0x13cc, length: 0x180, kind: "data-table", name: "enemyStats", note: "48×8 stats de enemigo" },
  { offset: 0x154c, length: 0x60, kind: "data-table", name: "enemyFlags", note: "48×2 flags de enemigo" },
  { offset: 0x15ac, length: 0x30, kind: "data-table", name: "enemyAttackRange", note: "alcance de ataque" },
  { offset: 0x15dc, length: 0x30, kind: "data-table", name: "enemyRangeThing", note: "48 bytes, 1/enemigo (Redux ENEMY_RANGE_THING); COMBAT.OVL:0x167 y COMSUBS byte [bx+0x15CC]" },
  { offset: 0x160c, length: 0x37, kind: "data-table", name: "attackValues", note: "valores de ataque" },
  { offset: 0x1643, length: 0x1, kind: "inert", name: "pad1643", note: "byte 0x00 entre attackValues y defenseValues" },
  { offset: 0x1644, length: 0x2f, kind: "data-table", name: "defenseValues", note: "valores de defensa" },
  { offset: 0x1673, length: 0x1, kind: "inert", name: "pad1673", note: "byte 0x00 entre defenseValues y attackRangeValues" },
  { offset: 0x1674, length: 0x37, kind: "data-table", name: "attackRangeValues", note: "valores de alcance" },
  { offset: 0x16ab, length: 0x2, kind: "data-table", name: "pad16ab", note: "2 bytes 0x00; el 2º (0x16AC) es base del acceso 1-based de COMBAT.OVL:0x1421 `cmp [bx+0x169C],8` a spellAttackRange" },
  { offset: 0x16ad, length: 0x37, kind: "data-table", name: "spellAttackRange", note: "alcance de hechizo" },
  { offset: 0x16e4, length: 0x30, kind: "data-table", name: "enemyFriends", note: "48 bytes, 1/enemigo (Redux ENEMY_FRIENDS); kernel byte [bx+0x16D4]" },
  { offset: 0x1714, length: 0x30, kind: "data-table", name: "spawnCoordPairs_1704", note: "48 B = CUATRO tablas que forman DOS PARES de coordenadas de SPAWN, no «tablas byte sueltas» (#279). Patrón IDÉNTICO en los dos consumidores: un solo índice en bx lee las dos tablas del par y las empuja JUNTAS al mismo callee `kernel_spawn_actor` (ULTIMA.EXE 0x6506, IDENT) con cinco pushes (arg, 0|1, tablaA[i], tablaB[i], g_floor). · PAR 1 (16+16 entradas): DS 0x1704 + DS 0x1714, leídas en render_animated_tile (0x6bc2 IDENT) en 0x6cd2/0x6cd9 con bx=[bp-0x26] → call 0x6cf4. Segundo call-site del mismo par en 0x6d47/0x6d4e con di. · PAR 2 (8+8 entradas): DS 0x1724 + DS 0x172C, leídas en party_anim_build (0x6936 IDENT) en 0x6a52/0x6a59 con bx=[bp-4] → call 0x6a73. ⚠ NO se declara CUÁL de cada par es x y cuál y: eso lo fija la firma de kernel_spawn_actor y NO se ha leído (regla: el ancla del índice fija el mapeo de pushes; el orden C invierte). Los DATOS lo sugieren —la primera varía rápido (02 05 08 04 06 01…) y la segunda crece por bloques (00 00 00 01 01 02 02 02 03 03…), que es la firma de columna vs fila— pero eso es INFERENCIA, no derivación, y se deja marcada como tal. · El byte suelto DS 0x1707 que citaba la ficha vieja NO es una quinta base: su único acceso (ULTIMA.EXE 0x7cdc `add ch, byte ptr [0x1707]`) cae DENTRO del par 1 (0x1704+3) y es un acceso escalar a un elemento, no a una tabla nueva. La extensión TESELA exacta: 16+16+8+8 = 48 = 0x30" },
  { offset: 0x1744, length: 0x18, kind: "data-table", name: "campAmbushEnemies_1734", note: "3 tablas de 8 bytes. ★ La PRIMERA está DERIVADA Y PORTADA (#279; spec entera en re/notes/camp-ambush-spec.md §tabla): DS 0x1734 = los 8 TIPOS DE ENEMIGO de la EMBOSCADA AL ACAMPAR — CMDS.OVL 0x0239 `push 0 / push 7 / call 0x6112` (rand_range(0,7)) y 0x023e `mov al, byte ptr [bx+0x1734]`, seguido de `mov ax,0x41e0 / call 0x58d0` que imprime «Ambushed!\\n\\n» (DS 0x41E0), dentro de camp_sleep_scene (CMDS 0x0000, IDENT). Bytes 0x29,0x14,0x15,0x18,0x16,0x19,0x24,0x14 = Troll/Giant Rat/Bat/Slime/Giant Spider/Gremlin/Headless/Giant Rat ⇒ Giant Rat sale DOBLE (idx 1 y 7) = 25%. El port lo modela en camp.ts:354 (AMBUSH_TABLE). La etiqueta «propósito pendiente» era RANCIA. Las OTRAS DOS del chunk siguen SIN derivar y se declaran aquí para no perderlas: DS 0x173C (0x14,0x15,0x16,0x17,0x18,0x19,0x1c,0x1b — secuencia casi consecutiva, consumidores DNGLOOK/DUNGEON [bx+0x173C]) y DS 0x1744 (0x60,0xa0,0x00,0x90,0x80,0x60,0x00,0x00 — múltiplos de 0x10 con ceros, huele a coordenadas o máscaras; consumidor DUNGEON [bx+0x1744]). Ninguna de las dos tiene rand delante: NO son hermanas de la emboscada por construcción, solo por vecindad de chunk" },
  { offset: 0x175c, length: 0xa8, kind: "string-pool", name: "equipmentNames", note: "nombres de equipo indexados por equipIndexes (Chain Coif, Iron Helm, Dagger, ...)", emitStrings: true },
  { offset: 0x1804, length: 0x2, kind: "inert", name: "pad1804", note: "2 bytes 0x00 antes de equipIndexes; sin refs" },
  { offset: 0x1806, length: 0x60, kind: "data-table", name: "equipIndexes", note: "índices de string por equipo" },
  { offset: 0x1866, length: 0x14, kind: "data-table", name: "monsterNamePtrs1866", note: "8 offsets DS crecientes (0x01C3..0x01F5 → monsterNamesMixed) + 2 words 0; COMBAT/COMSUBS `push [bx+0x1856]` (imprimir nombre de enemigo)" },
  { offset: 0x187a, length: 0x1ee, kind: "data-table", name: "textIndexes187a", note: "tabla de índices de texto (Redux \"Text index (+0x10)\"); sub-bases del censo: kernel [bx+0x18B6], SHOPPES/ZSTATS [bx+0x1962], ZSTATS [si+0x19B2]/[bx+0x1A44], CMDS [bx+0x19D2]" },
  { offset: 0x1a68, length: 0x2a, kind: "data-table", name: "zstatsTables1a68", note: "tablas de ZSTATS: 8 words (1,2,2,1,1,1,1,1), 5 offsets DS a los health-text (fileoff 0x0918..) y 4 offsets de sección de equipo; [bx+0x1A7E] compara con '0'" },
  { offset: 0x1a92, length: 0x26, kind: "data-table", name: "tileArtGlyphs", note: "datos de arte/glifos; bytes imprimibles coincidentes (no es texto)" },
  { offset: 0x1ab8, length: 0x6, kind: "data-table", name: "table_unk_1ab8", note: "6 bytes 02 02 02 04 04 04 antes de reqStrengthEquip; sin refs en el censo" },
  { offset: 0x1abe, length: 0x2f, kind: "data-table", name: "reqStrengthEquip", note: "fuerza requerida por equipo" },
  { offset: 0x1aed, length: 0x1, kind: "inert", name: "pad1aed", note: "byte 0x00; sin refs" },
  { offset: 0x1aee, length: 0x1e8, kind: "data-table", name: "numericTables1aee", note: "CONTENEDOR de 488 B con SIETE sub-tablas particionadas POR CONSUMIDOR (#279; la «partición fina pendiente» queda hecha). Todas las bases se midieron exigiendo acceso a DS: · DS 0x1ADE — byte indexado, BLCKTHRN.OVL 0x07b4 (4 accesos, también ENDGAME/OUTSUBS). · DS 0x1AE8 — byte, ZSTATS.OVL 0x1067. · DS 0x1B7A — WORDS: tabla de PUNTEROS a los glifos de RUNA indexada por letra×2, leída por el picker de hechizos getstring_rune_spell_name (CAST2.OVL 0x011f/0x0146/0x019e `push word ptr [bx+0x1b7a]`) para pintar cada sílaba tecleada — derivado en #280. · DS 0x1BC8 — byte, ULTIMA.EXE 0x459f. · DS 0x1C30 — tabla de NOMBRES de hechizo contra la que el mismo picker compara las iniciales ya ORDENADAS (CAST2.OVL 0x0241/0x0246 la cargan como puntero base del bucle de comparación). · DS 0x1C90 — FLAGS por hechizo: CAST.OVL 0x0e24 `test byte ptr [bx+0x1c90], 8` y 0x0e36 `test ..., 1`, los dos gates de contexto del despachador de (C)ast (g_location==0 exterior usa el bit 8; g_location>0x7f usa el bit 1) ⇒ un byte de permisos por hechizo, 5 accesos. · DS 0x1CC0 — byte, CMDS.OVL 0x1bcb. 🔴 TRAMPA MEDIDA Y DECLARADA (no repetirla): un grep del rango en todo el disasm devuelve ~44 direcciones más, y CASI TODAS SON BASURA — son accesos `cs:[0x1bXX]` de EGA.DRV/CGA.DRV/HER.DRV/T1K.DRV, es decir VARIABLES EN EL SEGMENTO DE CÓDIGO DE LOS DRIVERS que coinciden numéricamente con este rango de DS; más un `[bp+di-0x1c9d]` que es desplazamiento negativo. Sin filtrar por segmento, esta ficha habría atribuido media tabla a los drivers de vídeo (clase de basura ya conocida: el partidor es ciego al override cs:)" },
  { offset: 0x1cd6, length: 0x2a, kind: "data-table", name: "table_unk_1cd6", note: "42 bytes de aspecto bit-packed (88 A0 88 02 11 61 ...); sin refs directas en el censo" },
  { offset: 0x1d00, length: 0x2a, kind: "data-table", name: "table_unk_1d00", note: "21 words simétricos 10,12,14,16,20,25,35,50,80,190,2000,190,...,10; sin refs directas en el censo" },
  { offset: 0x1d2a, length: 0x100, kind: "data-table", name: "lookTileTable1d2a", note: "256 bytes, 1 por tile (valores 1..16 en grupos de 4): LOOKOBJ.OVL:0xF88 `mov al,[bx+0x1D1A]` con bx=tile; su último byte (0x1E29) es además la base 1-based de TOWN.OVL:0x441 [si+0x1E19] sobre initialFloorTowne" },
  { offset: 0x1e2a, length: 0x8, kind: "data-table", name: "initialFloorTowne", note: "planta inicial (towne)" },
  { offset: 0x1e32, length: 0x8, kind: "data-table", name: "initialFloorDwelling", note: "planta inicial (dwelling)" },
  { offset: 0x1e3a, length: 0x8, kind: "data-table", name: "initialFloorCastle", note: "planta inicial (castle)" },
  { offset: 0x1e42, length: 0x8, kind: "data-table", name: "initialFloorKeep", note: "planta inicial (keep)" },
  { offset: 0x1e4a, length: 0x50, kind: "data-table", name: "locationNameIndexes", note: "índices de nombre de localización" },
  { offset: 0x1e9a, length: 0x28, kind: "data-table", name: "locationsX", note: "X de localizaciones" },
  { offset: 0x1ec2, length: 0x28, kind: "data-table", name: "locationsY", note: "Y de localizaciones" },
  { offset: 0x1eea, length: 0x38, kind: "data-table", name: "moonPhases", note: "fases lunares" },
  { offset: 0x1f22, length: 0x30, kind: "data-table", name: "table_unk_1f22", note: "6 filas de 8 bytes: {4},{4,5},{4,5},{4,5,3},{4,5,2,1},{4,5,3,2,1} (padding 0); sin refs directas en el censo" },
  { offset: 0x1f52, length: 0xc, kind: "data-table", name: "blckthrnTables1f52", note: "2 tablas de 6 bytes (00 01 09 0A 03 07 / 01 01 01 01 05 05) leídas por BLCKTHRN.OVL:0x792/0x799 [bx+0x1F42]/[bx+0x1F48]" },
  { offset: 0x1f5e, length: 0x20, kind: "data-table", name: "virtueMantraIndex", note: "índice virtud+mantra" },
  { offset: 0x1f7e, length: 0x8, kind: "data-table", name: "shrineX", note: "X de santuarios" },
  { offset: 0x1f86, length: 0x8, kind: "data-table", name: "shrineY", note: "Y de santuarios" },
  { offset: 0x1f8e, length: 0x200, kind: "data-table", name: "relCoordLists1f8e", note: "16 registros de 32 B: listas de pares (dx,dy) en byte con signo terminadas en 00 00 (oclusión/línea de visión por dirección); el kernel carga el ptr 0x2020 (imm)" },
  { offset: 0x218e, length: 0xa, kind: "runtime-state", name: "dgroupVars218e", note: "vars inicializadas a 0xFF: g_unk_217e/g_unk_2180 + words 0x2182/0x2184 + byte 0x2186 (COMBAT las escribe 0xFF; OUTSUBS/TOWN/kernel mov word)" },
  { offset: 0x2198, length: 0x42, kind: "data-table", name: "comsubsCoordPairs2198", note: "pares (dx,dy) byte con signo; COMSUBS carga los punteros DS 0x2188/0x2198/0x21BA (imm) — posiciones de despliegue en combate" },
  { offset: 0x21da, length: 0x100, kind: "data-table", name: "storeNameOffsets21da", note: "128 words: offsets DS crecientes (0x0BEE.. → storeNames); TALK.OVL:0x16C `mov ax,[si+0x21CA]` (entrada a tienda)" },
  { offset: 0x22da, length: 0x100, kind: "data-table", name: "shoppeKeeperNameOffsets22da", note: "tabla word paralela a la anterior (TALK.OVL:0x173 [si+0x22CA]); offsets de texto de tendero" },
  { offset: 0x23da, length: 0x80, kind: "data-table", name: "shoppeKeeperTownes23da", note: "8 listas con stride 0x10 de índices de towne por tipo de tienda; Redux SHOPPE_KEEPER_TOWNES_* (taberna 0x23EA, caballos 0x23FA, barcos 0x240A, reagentes 0x241A, provisiones 0x242A, curación 0x243A, posada 0x244A); TALK cmp [bx+0x23CA], SHOPPES push [bx+0x23EA]" },
  { offset: 0x245a, length: 0x8c, kind: "data-table", name: "dnglookTables245a", note: "tablas byte de DNGLOOK.OVL (bases [bx+0x244A], [si+0x2452..0x2476] stride 6, [si+0x2486..0x24C6] stride 0x10): mazmorra/Look" },
  { offset: 0x24e6, length: 0x10, kind: "data-table", name: "dirDeltaWords24e6", note: "8 words 0,1,0,-1,-1,0,1,0: deltas (dx,dy) por dirección; CAST/CAST2/DUNGEON/FONT leen [si+0x24D6]/[si+0x24DE]" },
  { offset: 0x24f6, length: 0x2, kind: "runtime-state", name: "dgroupVars24f6", note: "g_unk_24e6 (byte, 58 refs desde 10 ficheros: flags or/and) + byte 0x24E7 (DUNGEON mov 0)" },
  { offset: 0x24f8, length: 0x13e, kind: "data-table", name: "talkWordPtrTable24f8", note: "159 words: offset DS de cada string del pool 0x104C..0x13B5 (palabras comprimidas .TLK + assetFilenames1), 0x0000 en los huecos de índice; TALK.OVL:0x104B `mov bx,[bx+0x24E8]` (expansión de tokens) e INTRO/FONT/ENDGAME/DNGLOOK push [0x25EA..0x2622] (ptr de filename)" },
  { offset: 0x2636, length: 0xa2f, kind: "string-pool", name: "mapFilesDungeonNames", note: "ficheros de mapa (TOWNE/DWELLING/CASTLE/KEEP.DAT) + verbos de movimiento + nombres de salas de mazmorra", emitStrings: true },
  { offset: 0x3065, length: 0x8d, kind: "data-table", name: "introTables3065", note: "tablas de ESCENA de play_introduction (The Summoning; NO creación de personaje): 9 bases byte stride 0x16 ([bx+0x3056]..[bx+0x30DA]) = subimg/X/Y/tipo/STORYn/bandas de texto; semántica en re/notes/intro-scene-tables.md" },
  { offset: 0x30f2, length: 0x75e, kind: "string-pool", name: "introMenuU4Transfer", note: "menú principal (Journey Onward, Create New Character, Transfer from Ultima IV) + texto de transferencia de U4 + ficheros de fuente", emitStrings: true },
  { offset: 0x3850, length: 0x26, kind: "data-table", name: "dnglookTables3850", note: "tablas byte de DNGLOOK.OVL: [0x3840] directo, [si+0x384D], [bx+0x385E]" },
  { offset: 0x3876, length: 0x10, kind: "data-table", name: "outsubsTables3876", note: "2 tablas de 8 bytes de OUTSUBS.OVL ([si+0x3866]/[si+0x386E])" },
  { offset: 0x3886, length: 0x100, kind: "data-table", name: "britOverlayChunks", note: "overlay de chunks de BRIT.DAT" },
  { offset: 0x3986, length: 0x90, kind: "string-pool", name: "mapDataFilenames", note: "ficheros de datos de mapa (UNDER.DAT, BRIT.DAT, BRIT.OOL, ...)", emitStrings: true },
  { offset: 0x3a16, length: 0xb, kind: "data-table", name: "shardSpawnTable", note: "coords de siembra de los 3 shards en el Underworld: 3 columnas byte paralelas (stride 4, índice-3 sin usar) X=[si+0x3A06], Y=[si+0x3A0A], Z=[si+0x3A0E] (DS; fileoff = DS+0x10), leídas por el sembrador OUTSUBS.OVL:0x0566 (si=0..2). Orden 0/1/2 = Falsehood/Hatred/Cowardice; z=0xF0/F1/F2 = metadato de slot (cf. amuleto cableado z=0xF3 en 0x0598), NO floor" },
  { offset: 0x3a21, length: 0x13, kind: "string-pool", name: "statusBurningPoisoned", note: "strings de estado 'Burning!\\n' + 'Poisoned!' (el 2º sin NUL propio: lo termina el chunk siguiente) que caían dentro del antiguo mapDataFilenames", emitStrings: true },
  { offset: 0x3a34, length: 0xe, kind: "data-table", name: "outsubsSceneNums_3a24", note: "7 words (0x000A, 0x0A3C×3, 0x0E74, 0x0F3C, 0x1040) = los NÚMEROS que imprime en caja una escena de OUTSUBS. ★ CALLER HALLADO (lote-E §1, adjudicado en la tarjeta #279): OUTSUBS.OVL:0x0683 `mov si, 0x3a26` (= &tabla[+1], salta la word[0]) y bucle 0x0686-0x069b `push [si] / call 0x7f02` (el impresor-en-caja) con `add si,2 / cmp si,0x3a32 / jb` ⇒ recorre words[1..6]; la word[0] 0x000A NO se imprime. NO son precios: es data de esa pantalla (escalas imm 5000/10000 en el código de alrededor). El censo del kernel no la veía porque el caller está en un OVERLAY y carga el ptr como INMEDIATO" },
  { offset: 0x3a42, length: 0x28, kind: "data-table", name: "reagentBasePrices", note: "precios base de reagentes" },
  { offset: 0x3a6a, length: 0x28, kind: "data-table", name: "reagentQuantities", note: "cantidades de reagentes" },
  { offset: 0x3a92, length: 0x60, kind: "data-table", name: "equipmentBasePrices", note: "precios base de equipo" },
  { offset: 0x3af2, length: 0x48, kind: "data-table", name: "weaponsSoldByMerchants", note: "armas vendidas por herrero" },
  { offset: 0x3b3a, length: 0x2e, kind: "data-table", name: "shoppesTable3b3a", note: "words leídos por SHOPPES.OVL:0x1D4 `push [bx+si+0x3B2A]` (tienda de armas); Redux 0x3B3A Unknown" },
  { offset: 0x3b68, length: 0x22c, kind: "data-table", name: "priceTables3b68", note: "tablas numéricas de precios con runs imprimibles coincidentes (+1 mensaje embebido en 0x3D6C); sub-bases word de SHOPPES en [bx(+si)+0x3B6A..0x3D52] (censo)" },
  { offset: 0x3d94, length: 0x2, kind: "inert", name: "pad3d94", note: "2 bytes 0x00 antes de healPrices; sin refs" },
  { offset: 0x3d96, length: 0x8, kind: "data-table", name: "healPrices", note: "precios heal" },
  { offset: 0x3d9e, length: 0x8, kind: "data-table", name: "curePrices", note: "precios cure" },
  { offset: 0x3da6, length: 0x10, kind: "data-table", name: "resurrectPrices", note: "precios de resurrección" },
  { offset: 0x3db6, length: 0x30, kind: "data-table", name: "endgameData_3da6", note: "words tras resurrectPrices (0x00AC, 11×0x0140, 0x009A…) = bloque de datos/punteros de la SECUENCIA DE ENDGAME, familia de endgameTables3de6 (contiguo). ★ CALLER HALLADO (lote-E §2, adjudicado en #279): ENDGAME.OVL:0x005e-0x0072 carga CINCO punteros inmediatos que caen dentro del rango (0x3da6/0x3da7/0x3db2/0x3db4/0x3dca) a [bp-0xe..-0x16] y el bucle de 0x0077 los consume. La hipótesis vieja «¿precios/tarifas sin usar?» queda RETIRADA. Invisible al censo por la misma causa que su hermana 0x3A34: caller en overlay + punteros como inmediatos" },
  { offset: 0x3de6, length: 0xa2, kind: "data-table", name: "endgameTables3de6", note: "tablas de ENDGAME.OVL: bytes stride 6 en [bx+0x3DD6..0x3E06], words [bx+0x3E0A/0x3E18/0x3E2E/0x3E40], bytes [bx+0x3E5A/0x3E60]; + SJOG [si+0x3E66/0x3E6A/0x3E6E]; incluye el run '~~' (ex priceTableTail)" },
  { offset: 0x3e88, length: 0x72, kind: "data-table", name: "searchObjId", note: "objetos ocultos: id" },
  { offset: 0x3efa, length: 0x72, kind: "data-table", name: "searchObjQuality", note: "objetos ocultos: calidad" },
  { offset: 0x3f6c, length: 0x72, kind: "data-table", name: "searchObjLocation", note: "objetos ocultos: localización" },
  { offset: 0x3fde, length: 0x72, kind: "data-table", name: "searchObjFloor", note: "objetos ocultos: planta" },
  { offset: 0x4050, length: 0x72, kind: "data-table", name: "searchObjX", note: "objetos ocultos: X" },
  { offset: 0x40c2, length: 0x72, kind: "data-table", name: "searchObjY", note: "objetos ocultos: Y" },
  { offset: 0x4134, length: 0xb0, kind: "data-table", name: "sjogTables4134", note: "tablas de SJOG.OVL (Search/Get): bytes stride 8 en [si+0x4124..0x413C], [si+0x416C], [si+0x41BC..0x41CC]; words [bx+0x419C]/[bx+0x41AC] con offsets DS a scrollShortforms (0x8C2E..)" },
  { offset: 0x41e4, length: 0x2c7, kind: "string-pool", name: "campRestTransportMsgs", note: "mensajes de acampar/descansar/transporte (Zzzz, Ambushed, Party rested, horse, ...)", emitStrings: true },
  { offset: 0x44ab, length: 0x2, kind: "string-pool", name: "nlString44ab", note: "string suelto '\\n\\0' tras campRestTransportMsgs" },
  { offset: 0x44ad, length: 0x3a, kind: "string-pool", name: "wordsOfPower", note: "words of power (8)" },
  { offset: 0x44e7, length: 0x1, kind: "string-pool", name: "nlString44e7", note: "string '\\n' (sin NUL propio: lo termina el chunk siguiente); referenciado por CMDS.OVL vía inmediato mov ax,0x44D7" },
  { offset: 0x44e8, length: 0x75c, kind: "string-pool", name: "spellPushEffectMsgs", note: "mensajes de hechizo/word-of-power/empujar-tirar/efectos (FURL/HOIST, Pushed, ...)", emitStrings: true },
  { offset: 0x4c44, length: 0xa8, kind: "data-table", name: "shoppes2Tables4c44", note: "tablas word de SHOPPES2.OVL (taberna/posada): contadores, precios de posada (10..30), offsets de texto DS 0x1188.. (talkCompressedWords) y 0x9CD4.. stride 6 (textItemsWearUse); bases [bx+0x4C36..0x4CA8]" },
  { offset: 0x4cec, length: 0x1a, kind: "data-table", name: "barKeepGossipMap", note: "mapa localización→cotilleo del tabernero (Redux BAR_KEEP_GOSSIP_MAP); SHOPPES2.OVL:0x627 `mov bl,[bx+0x4CDC]`" },
  { offset: 0x4d06, length: 0x80, kind: "data-table", name: "shoppes2Tables4d06", note: "más tablas word/byte de SHOPPES2 (bases [bx+0x4CF6..0x4D6E], la última stride 8); posada/tarifas" },
  { offset: 0x4d86, length: 0x4, kind: "data-table", name: "docksX", note: "X de docks" },
  { offset: 0x4d8a, length: 0x4, kind: "data-table", name: "docksY", note: "Y de docks" },
  { offset: 0x4d8e, length: 0x9, kind: "data-table", name: "shoppes3Table4d8e", note: "9 bytes 02 03 02 03 02 03 0A 0A 00; SHOPPES3.OVL:0x99 [bx+0x4D7E] ×3" },
  { offset: 0x4d97, length: 0xf1, kind: "string-pool", name: "innNoRoomMsgs", note: "diálogo de posada: sin habitación disponible", emitStrings: true },
  { offset: 0x4e88, length: 0x2, kind: "data-table", name: "innDescriptionIndexTail", note: "últimos 2 bytes de INN_DESCRIPTION_INDEXES (Redux 0x4E7E+0xC; el resto cae en la cola de innNoRoomMsgs); sin refs directas" },
  { offset: 0x4e8a, length: 0x6, kind: "data-table", name: "innBedsX", note: "X de camas de posada" },
  { offset: 0x4e90, length: 0x6, kind: "data-table", name: "innBedsY", note: "Y de camas de posada" },
  { offset: 0x4e96, length: 0x263, kind: "string-pool", name: "innGuestRegisterDialog", note: "diálogo de posada: registro de huéspedes (stay/check-out/rest)", emitStrings: true },
  { offset: 0x50f9, length: 0x5d, kind: "data-table", name: "fontGlyphWidths50f9", note: "anchos de glifo (valores 2..8, ~91 = ASCII imprimible); FONT.OVL:0xA9 lee [0x50F7] y suma con [0x5154]" },
  { offset: 0x5156, length: 0x16, kind: "runtime-state", name: "dgroupVars5156", note: "g_unk_5146..g_unk_5158 + 3 words más: estado de vídeo/dibujo escrito por ENDGAME/FONT/INTRO (mov word [0x5146..0x515A])" },
  { offset: 0x516c, length: 0xa0, kind: "data-table", name: "fontTables516c", note: "tablas de FONT.OVL: [bx+0x515C] word, bytes stride 8 [bx+0x5164/0x516C/0x5174], [bx+si+0x517C] word; al final 2 filas de 8 words crecientes (0x0B2D..0x1D87 / 0x0C11..0x1D87: offsets en fichero de fuente)" },
  { offset: 0x520c, length: 0x3a0, kind: "runtime-state", name: "dgroupRuntimeWindow", note: "ventana de estado runtime del DGROUP (=imagen DATA.OVL en RAM): C_FILE_INFO, nombres de driver de sonido (T1K/HER.DRV, DS:0x5340), tablas de traducción de teclado (DS:0x540E/0x5416), words de segmento de los 3 far ptrs (DS:0x5216/0x52AA/0x5396); ver command-dispatch.md §4" },
  { offset: 0x55ac, length: 0x106a, kind: "runtime-state", name: "savedGamWindow", note: "ventana SAVED.GAM: el save se copia en DS:0x55A6 (fileoff 0x55B6, 0x1060 B, hasta 0x6616) — roster, inventario, reloj, NPCs (globals g_party_records..g_npc_sprites); los 10 bytes previos (0A 00 00 00 00 01 01 02 02 03) también son estado (kernel [bx+0x559E]); ~3200 refs mem desde los 24 ficheros" },
  { offset: 0x6616, length: 0x484, kind: "runtime-state", name: "dgroupScratch6616", note: "buffers/estado tras la ventana del save: punteros imm DS 0x6606/0x6608 (CAST2/FONT/INTRO/OUTSUBS/TOWN), tablas de FONT [si+0x6708], flags del kernel 0x6A18..0x6A58; cero en fichero salvo la cola 0x6A7D.. (tablas byte del kernel, p.ej. 02 05 0A 14 22 31 en 0x6A90, [bx+0x6A80])" },
  { offset: 0x6a9a, length: 0x1a23, kind: "string-pool", name: "textWorldCombatDungeon", note: "pool principal 1: mundo/combate/mazmorra/señales/movimiento (Ship sunk, trolls, dungeon rooms, Klimb, ...)", emitStrings: true },
  { offset: 0x84bd, length: 0x21, kind: "string-pool", name: "yesNoResponses84bd", note: "respuestas '!\"', Yes/No ×2 entre los pools 1 y 2; ENDGAME las carga por inmediato (6 ptrs)", emitStrings: true },
  { offset: 0x84de, length: 0x74f, kind: "string-pool", name: "textShopLookGather", note: "pool principal 2: diálogo de tienda + resultados de Look/Get (We stock, chest, sack of gold, ...)", emitStrings: true },
  { offset: 0x8c2d, length: 0x21, kind: "string-pool", name: "scrollShortforms", note: "códigos cortos de los 8 scrolls sin '*' (VL,RH,IS,IA,IQW,KXC,IMC,AT; Redux \"scroll shortforms\"); apuntados por los words de sjogTables4134 (DS 0x8C2E..)", emitStrings: true },
  { offset: 0x8c4e, length: 0x1394, kind: "string-pool", name: "textItemsWearUse", note: "pool principal 3: nombres de objeto + mensajes Wear/Ready/Use + colores", emitStrings: true },
  { offset: 0x9fe2, length: 0x3e, kind: "string-pool", name: "barKeepYesNo9fe2", note: "respuestas del tabernero: sir / ?\" / Yes / No (variantes); SHOPPES2 las carga por inmediato (14 ptrs)", emitStrings: true },
  { offset: 0xa020, length: 0x50d, kind: "string-pool", name: "textCreateCharCmdsCrt", note: "pool principal 4: creación de personaje (The Summoning...) + respuestas de comando del dispatcher (Pass/Board/Cast.../What?) + errores del runtime C (R6000...)", emitStrings: true },
  { offset: 0xa52d, length: 0x3, kind: "string-pool", name: "crtCrlf", note: "string '\\r\\n\\0': cola CRLF de los mensajes de error del runtime C" },
  { offset: 0xa530, length: 0x1820, kind: "runtime-state", name: "dgroupBss", note: "BSS-en-imagen (Redux \"Nil\"): 3 bytes 0xFF + ceros hasta el final del fichero; ~500 refs mem desde los 24 ficheros (g_unk_a9bd/a9ce/aafe/abc7/adb9/b114/b118/bb15/bb16 del diccionario de globals); estado runtime a cero, NO inerte" },
];

/** Un pool de strings genérico extraído de un chunk (offset + strings). */
export interface DataOvlStringPool {
  name: string;
  offset: number;
  strings: string[];
}

/**
 * Un par (ids, weights) de la tabla de spawn de errantes del world-turn
 * (`weighted_pick` MAINOUT 0x0E04 sobre punteros hardcoded de `tile_to_monster`
 * 0x0E4E). `weighted_pick` tira `rand(0,255)` y resta pesos hasta `peso>roll`,
 * devolviendo el índice; el caller lee `ids[índice]` (id = tile de sprite − 0x100).
 * Cada tabla de pesos suma EXACTAMENTE 256 (= confirma `rand(0,255)`); `ids` tiene
 * la misma longitud. Fuente: DATA.OVL (offsets DS citados abajo), oracle-eras.md §1/§3.
 */
export interface SpawnTable {
  /** ids de monstruo (tile de sprite − 0x100), 1 por entrada. */
  ids: number[];
  /** pesos por entrada; suman 256. */
  weights: number[];
}

/**
 * Las 4 tablas FIJAS de spawn de errantes, seleccionadas por terreno × profundidad
 * en `tile_to_monster` (MAINOUT 0x0E4E). Nombradas por el CONTENIDO real de sus ids
 * (verificado: agua = serpientes/kraken/piratas; tierra = orcos/troles/etc.), no por
 * la etiqueta invertida del volcado preliminar.
 */
export interface SpawnTables {
  /** Superficie, terreno de agua (0eb4: pesos DS 0x2BF0, ids DS 0x2BD4). */
  waterSurface: SpawnTable;
  /** Underworld, terreno de agua (0ec6: pesos DS 0x2BF6, ids DS 0x2BDA). */
  waterUnderworld: SpawnTable;
  /** Superficie, terreno de tierra (0f28: pesos DS 0x2BDC, ids DS 0x2BC0). */
  landSurface: SpawnTable;
  /** Underworld, terreno de tierra (0f38: pesos DS 0x2BE8, ids DS 0x2BCC). */
  landUnderworld: SpawnTable;
}

/**
 * Una entrada de la tabla de siembra de shards del Underworld (`shardSpawnTable`
 * DS 0x3A06, fileoff 0x3A16). El sembrador OUTSUBS.OVL:0x0566 la lee por columnas
 * (si=0..2) y escribe el slot-objeto [0xB4,0xB4,x,y,0xFF,z]. Orden 0/1/2 =
 * Falsehood/Hatred/Cowardice.
 */
export interface ShardSpawn {
  /** X en el mapa del Underworld (0..255) — [si+0x3A06]. */
  x: number;
  /** Y en el mapa del Underworld (0..255) — [si+0x3A0A]. */
  y: number;
  /**
   * 6º byte del slot-objeto — [si+0x3A0E]; 0xF0/0xF1/0xF2. NO es floor (el
   * Underworld es planta 0): es metadato de slot coherente con el amuleto,
   * cableado a z=0xF3 en OUTSUBS 0x0598. Semántica **DERIVADA**
   * (`re/notes/oracle-underworld-z.md`, grado A estático): `z = 0xF0 | idx` y el único
   * lector hace `and si,3` (SJOG 0x16b9) ⇒ `z & 3` = índice de shard, que es
   * load-bearing porque los 3 shards comparten el tile 0xB4; el nibble alto 0xF0 no lo
   * lee nadie.
   */
  z: number;
}

export interface SearchObject {
  /** tipo de objeto (tile − 0x100, tal como se almacena) */
  id: number;
  /** calidad: tipo de poción, nº de gemas, etc. */
  quality: number;
  /** número de localización (ver "Party Location") */
  location: number;
  /** planta */
  floor: number;
  x: number;
  y: number;
}

export interface DataOvl {
  // --- StringLists ---
  /** Nombres largos de armadura (13) — 0x0052 */
  longArmour: string[];
  /** Nombres de armas (10) — 0x00F8 */
  weaponNames: string[];
  /** Anillos y amuletos (5) — 0x0179 */
  ringsAmulets: string[];
  /** Nombres de monstruos, mixed case — 0x01D3 */
  monsterNamesMixed: string[];
  /** Nombres de monstruos, mayúsculas — 0x032B */
  monsterNamesUpper: string[];
  /** Special item names (5) — 0x04C3 */
  specialItemNames: string[];
  /** Shards (3) — 0x0506 */
  shards: string[];
  /** Special item names 2 (6) — 0x052F */
  specialItemNames2: string[];
  /** Nombres cortos de armadura — 0x0572 */
  shortArmour: string[];
  /** Pociones (8) — 0x068C */
  potions: string[];
  /** Reagentes (8) — 0x06BC */
  reagents: string[];
  /** Hechizos (48 en el fichero real) — 0x0709 */
  spells: string[];
  /** Sílabas rúnicas de hechizo — 0x0941 */
  spellRunes: string[];
  /** Nombres de localización (mayúsculas) — 0x0A4D */
  locationNames: string[];
  /** Virtudes (8) — 0x0B98 */
  virtues: string[];
  /** Mantras (8) — 0x0BE0 */
  mantras: string[];
  /** Nombres de tiendas — 0x0BFE */
  storeNames: string[];
  /** Nombres de tenderos — 0x0EFA */
  shoppeKeeperNames: string[];
  /** Palabras comprimidas usadas por los .TLK — 0x104C */
  talkCompressedWords: string[];

  // --- ByteList / UINT16List numéricos ---
  /** ENEMY_STATS: 48 filas × 8 bytes — 0x13CC */
  enemyStats: number[][];
  /** ENEMY_FLAGS: 48 filas × 2 bytes — 0x154C */
  enemyFlags: number[][];
  /** ENEMY_ATTACK_RANGE — 0x15AC */
  enemyAttackRange: number[];
  /** ENEMY_RANGE_THING: 48 bytes, 1/enemigo (Redux) — 0x15DC */
  enemyRangeThing: number[];
  /** ENEMY_FRIENDS: 48 bytes, 1/enemigo (Redux) — 0x16E4 */
  enemyFriends: number[];
  /** ATTACK_VALUES (55 armas) — 0x160C */
  attackValues: number[];
  /** DEFENSE_VALUES — 0x1644 */
  defenseValues: number[];
  /** ATTACK_RANGE_VALUES — 0x1674 */
  attackRangeValues: number[];
  /** SPELL_ATTACK_RANGE — 0x16AD */
  spellAttackRange: number[];
  /** EQUIP_INDEXES: índices de string por equipo (uint16, +0x10) — 0x1806 */
  equipIndexes: number[];
  /** Fuerza requerida por equipo — 0x1ABE */
  reqStrengthEquip: number[];
  /** Índice de planta-inicial por fichero de mapa (8 bytes c/u) — 0x1E2A/32/3A/42 */
  initialFloorIndexes: {
    towne: number[];
    dwelling: number[];
    castle: number[];
    keep: number[];
  };
  /** LOCATION_NAME_INDEXES (uint16, +0x10) — 0x1E4A */
  locationNameIndexes: number[];
  /** LOCATIONS_X (40) — 0x1E9A */
  locationsX: number[];
  /** LOCATIONS_Y (40) — 0x1EC2 */
  locationsY: number[];
  /** MOON_PHASES (28 pares = 56 bytes) — 0x1EEA */
  moonPhases: number[];
  /** Índice virtud+mantra (byte, +0x10) — 0x1F5E */
  virtueMantraIndex: number[];
  /** SHRINE_X_COORDS (8) — 0x1F7E */
  shrineX: number[];
  /** SHRINE_Y_COORDS (8) — 0x1F86 */
  shrineY: number[];
  /** Overlay de chunks de BRIT.DAT (256; 0xFF = agua) — 0x3886 */
  britOverlayChunks: number[];
  /** Precios base de reagentes — 0x3A42 */
  reagentBasePrices: number[];
  /** Cantidades de reagentes — 0x3A6A */
  reagentQuantities: number[];
  /** Precios base de equipo (uint16) — 0x3A92 */
  equipmentBasePrices: number[];
  /** Armas vendidas por herrero: 9 ciudades × 8 — 0x3AF2 */
  weaponsSoldByMerchants: number[][];
  /** Precios de curación (heal) — 0x3D96 */
  healPrices: number[];
  /** Precios de cura (cure) — 0x3D9E */
  curePrices: number[];
  /** Precios de resurrección (uint16) — 0x3DA6 */
  resurrectPrices: number[];
  /** Objetos ocultos buscables (0x72 = 114 entradas, 6 tablas paralelas) — 0x3E88..0x40C2 */
  searchObjects: SearchObject[];
  /** WORDS_OF_POWER (8) — 0x44AD */
  wordsOfPower: string[];
  /** X de docks (Jhelom, Minoc, E.Brittany, Bucc.Den) — 0x4D86 */
  docksX: number[];
  /** Y de docks — 0x4D8A */
  docksY: number[];
  /** X de camas de posada (6) — 0x4E8A */
  innBedsX: number[];
  /** Y de camas de posada (6) — 0x4E90 */
  innBedsY: number[];
  /** Las 4 tablas fijas de spawn de errantes (weighted_pick 0x0E04) — DS 0x2BC0..0x2BF6 */
  spawnTables: SpawnTables;
  /** Coords de siembra de los 3 shards en el Underworld (OUTSUBS 0x0566) — DS 0x3A06 (fileoff 0x3A16) */
  shardSpawns: ShardSpawn[];

  /**
   * Pools de strings catalogados en Task 2.1 (extractor genérico offset+strings).
   * Uno por chunk de DATAOVL_CHUNKS con `emitStrings: true`. Fase 3 los consume
   * (p.ej. respuestas de comando en textCreateCharCmdsCrt).
   */
  stringPools: DataOvlStringPool[];
}

/** Lee `length` bytes crudos como number[]. */
function byteList(data: Uint8Array, offset: number, length: number): number[] {
  const out: number[] = [];
  for (let i = 0; i < length && offset + i < data.length; i++) {
    out.push(data[offset + i]!);
  }
  return out;
}

/** Lee `length` bytes como lista de uint16 LE, sumando `vm` a cada valor. */
function u16List(
  data: Uint8Array,
  offset: number,
  length: number,
  vm = 0,
): number[] {
  const out: number[] = [];
  for (let i = 0; i + 1 < length; i += 2) {
    out.push(u16le(data, offset + i) + vm);
  }
  return out;
}

/** Offset DS→fichero de la imagen DATA.OVL: fileoff = DS_off + 0x10. */
const DS_TO_FILE = 0x10;

/**
 * Lee un par (ids, weights) de tabla de spawn. La longitud se DERIVA del dato:
 * se acumulan pesos hasta que la suma alcanza 256 (el binario garantiza que cada
 * tabla suma 256 exacto, con un terminador 0 que `rand(0,255)` nunca alcanza).
 * `ids` toma la misma cantidad de entradas. Lanza si la suma no cierra en 256.
 */
function spawnTable(
  data: Uint8Array,
  weightsDs: number,
  idsDs: number,
): SpawnTable {
  const wOff = weightsDs + DS_TO_FILE;
  const weights: number[] = [];
  let sum = 0;
  // Guarda de ingeniería (32) contra un dato degenerado sin cierre en 256.
  for (let i = 0; i < 32 && sum < 256; i++) {
    const w = data[wOff + i]!;
    weights.push(w);
    sum += w;
  }
  if (sum !== 256) {
    throw new Error(
      `tabla de spawn DS ${weightsDs.toString(16)}: pesos suman ${sum}, no 256`,
    );
  }
  const ids = byteList(data, idsDs + DS_TO_FILE, weights.length);
  return { ids, weights };
}

/** Trocea un number[] plano en filas de `cols` columnas. */
function chunkRows(flat: number[], cols: number): number[][] {
  const rows: number[][] = [];
  for (let i = 0; i < flat.length; i += cols) {
    rows.push(flat.slice(i, i + cols));
  }
  return rows;
}

export function parseDataOvl(bytes: Uint8Array): DataOvl {
  // Objetos buscables: 6 tablas paralelas de 0x72 (114) bytes.
  const SEARCH_COUNT = 0x72;
  const soId = byteList(bytes, 0x3e88, SEARCH_COUNT);
  const soQuality = byteList(bytes, 0x3efa, SEARCH_COUNT);
  const soLocation = byteList(bytes, 0x3f6c, SEARCH_COUNT);
  const soFloor = byteList(bytes, 0x3fde, SEARCH_COUNT);
  const soX = byteList(bytes, 0x4050, SEARCH_COUNT);
  const soY = byteList(bytes, 0x40c2, SEARCH_COUNT);
  const searchObjects: SearchObject[] = [];
  for (let i = 0; i < SEARCH_COUNT; i++) {
    searchObjects.push({
      id: soId[i]!,
      quality: soQuality[i]!,
      location: soLocation[i]!,
      floor: soFloor[i]!,
      x: soX[i]!,
      y: soY[i]!,
    });
  }

  // Shards del Underworld: 3 columnas byte paralelas (stride 4, índice-3 sin
  // usar) leídas por el sembrador OUTSUBS.OVL:0x0566 con si=0..2.
  // DS 0x3A06/0x3A0A/0x3A0E → fileoff 0x3A16/0x3A1A/0x3A1E.
  const SHARD_COUNT = 3;
  const shX = byteList(bytes, 0x3a16, SHARD_COUNT);
  const shY = byteList(bytes, 0x3a1a, SHARD_COUNT);
  const shZ = byteList(bytes, 0x3a1e, SHARD_COUNT);
  const shardSpawns: ShardSpawn[] = [];
  for (let i = 0; i < SHARD_COUNT; i++) {
    shardSpawns.push({ x: shX[i]!, y: shY[i]!, z: shZ[i]! });
  }

  return {
    longArmour: stringList(bytes, 0x0052, 0xa6),
    weaponNames: stringList(bytes, 0x00f8, 0x81),
    ringsAmulets: stringList(bytes, 0x0179, 0x5a),
    monsterNamesMixed: stringList(bytes, 0x01d3, 0x158),
    monsterNamesUpper: stringList(bytes, 0x032b, 0x165),
    specialItemNames: stringList(bytes, 0x04c3, 0x2b),
    shards: stringList(bytes, 0x0506, 0x29),
    specialItemNames2: stringList(bytes, 0x052f, 0x43),
    shortArmour: stringList(bytes, 0x0572, 0x77),
    potions: stringList(bytes, 0x068c, 0x30),
    reagents: stringList(bytes, 0x06bc, 0x4d),
    spells: stringList(bytes, 0x0709, 0x1bb),
    spellRunes: stringList(bytes, 0x0941, 0x64),
    locationNames: stringList(bytes, 0x0a4d, 0x14b),
    virtues: stringList(bytes, 0x0b98, 0x48),
    mantras: stringList(bytes, 0x0be0, 0x1e),
    storeNames: stringList(bytes, 0x0bfe, 0x2fc),
    shoppeKeeperNames: stringList(bytes, 0x0efa, 0x152),
    talkCompressedWords: stringList(bytes, 0x104c, 0x24e),

    enemyStats: chunkRows(byteList(bytes, 0x13cc, 0x180), 8),
    enemyFlags: chunkRows(byteList(bytes, 0x154c, 0x60), 2),
    enemyAttackRange: byteList(bytes, 0x15ac, 0x30),
    enemyRangeThing: byteList(bytes, 0x15dc, 0x30),
    enemyFriends: byteList(bytes, 0x16e4, 0x30),
    attackValues: byteList(bytes, 0x160c, 0x37),
    defenseValues: byteList(bytes, 0x1644, 0x2f),
    attackRangeValues: byteList(bytes, 0x1674, 0x37),
    spellAttackRange: byteList(bytes, 0x16ad, 0x37),
    // C#: 0x1806, longitud 0x2F*2+2 = 0x60 (48 uint16), valueModifier +0x10.
    equipIndexes: u16List(bytes, 0x1806, 0x60, 0x10),
    reqStrengthEquip: byteList(bytes, 0x1abe, 0x2f),
    initialFloorIndexes: {
      towne: byteList(bytes, 0x1e2a, 0x8),
      dwelling: byteList(bytes, 0x1e32, 0x8),
      castle: byteList(bytes, 0x1e3a, 0x8),
      keep: byteList(bytes, 0x1e42, 0x8),
    },
    locationNameIndexes: u16List(bytes, 0x1e4a, 0x50, 0x10),
    locationsX: byteList(bytes, 0x1e9a, 0x28),
    locationsY: byteList(bytes, 0x1ec2, 0x28),
    moonPhases: byteList(bytes, 0x1eea, 0x38),
    // C# aplica valueModifier +0x10 a este índice virtud+mantra.
    virtueMantraIndex: byteList(bytes, 0x1f5e, 0x20).map((v) => v + 0x10),
    shrineX: byteList(bytes, 0x1f7e, 0x8),
    shrineY: byteList(bytes, 0x1f86, 0x8),
    britOverlayChunks: byteList(bytes, 0x3886, 0x100),
    reagentBasePrices: byteList(bytes, 0x3a42, 0x28),
    reagentQuantities: byteList(bytes, 0x3a6a, 0x28),
    equipmentBasePrices: u16List(bytes, 0x3a92, 0x60),
    weaponsSoldByMerchants: chunkRows(byteList(bytes, 0x3af2, 0x48), 8),
    healPrices: byteList(bytes, 0x3d96, 0x08),
    curePrices: byteList(bytes, 0x3d9e, 0x08),
    resurrectPrices: u16List(bytes, 0x3da6, 0x10),
    searchObjects,
    wordsOfPower: stringList(bytes, 0x44ad, 0x3a),
    docksX: byteList(bytes, 0x4d86, 0x4),
    docksY: byteList(bytes, 0x4d8a, 0x4),
    innBedsX: byteList(bytes, 0x4e8a, 0x6),
    innBedsY: byteList(bytes, 0x4e90, 0x6),
    spawnTables: {
      waterSurface: spawnTable(bytes, 0x2bf0, 0x2bd4),
      waterUnderworld: spawnTable(bytes, 0x2bf6, 0x2bda),
      landSurface: spawnTable(bytes, 0x2bdc, 0x2bc0),
      landUnderworld: spawnTable(bytes, 0x2be8, 0x2bcc),
    },
    shardSpawns,

    stringPools: DATAOVL_CHUNKS.filter((c) => c.emitStrings).map((c) => ({
      name: c.name,
      offset: c.offset,
      strings: stringList(bytes, c.offset, c.length),
    })),
  };
}
