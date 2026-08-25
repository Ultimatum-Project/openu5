/**
 * CONTRATO CORE↔PIEL (E1-S1, producción — deriva del spike task #6).
 *
 * Una PIEL es un frontend COMPLETO e intercambiable en caliente sobre el core
 * vivo. Tres costuras (spec 2026-07-14-ui-estrategia-interview.md §2):
 *
 *  1. SKIN — un frontend desmontable/montable sin recargar. No posee estado de
 *     juego: todo lo que pinta sale de `CoreView`.
 *  2. CORE VIEW — la única ventana piel→core (solo lectura). Expone EXACTAMENTE
 *     la información que el original enseña (regla dura #2 de la interview):
 *     ventana 11×11 YA censurada por visibilidad, consola de texto, stats
 *     visibles del roster, reloj. Nada que el original oculte (sin barras de
 *     vida enemigas, sin %, sin orden de turnos).
 *  3. INTENT — la capa intención→comando. Pieles y dispositivos producen
 *     `Intent`s; un único sink (fuera de la piel) los traduce a comandos del
 *     dispatcher original. El input compone con cualquier piel (regla dura #4).
 *
 * Turno atómico (decisión #13): el core ejecuta el turno completo de forma
 * síncrona y publica los `GameEvent`s vía `ViewListener.onTurn`. La piel fiel
 * pinta "en seco" (estado final); una piel moderna puede diferir la
 * presentación. El core nunca espera al render.
 *
 * SEPARACIÓN CORE/PIEL: este fichero (el contrato) importa del core SOLO TIPOS
 * (type-only: GameEvent/RefugeScenePhase/SfxCue/GemView/ZodiacView/
 * ReadyPickerRow — cero runtime). El adaptador `coreview.ts` es el único de
 * skin/ que lee el core en runtime; las pieles sólo hablan con este contrato.
 * El guard CI (`skin-import-guard.test.ts`) lo impone.
 */
import type { GameEvent, RefugeScenePhase } from "../core/game.js";
import type { ReadyPickerRow } from "../core/readyPicker.js";
import type { InnRegisterView } from "./fiel/innRegister.js";
import type { SfxCue } from "../core/sfx.js";
import type { GemView } from "../core/world/gem-view.js";
export type { GemView } from "../core/world/gem-view.js";
import type { ZodiacView } from "../core/world/zodiac-view.js";
export type { ZodiacView } from "../core/world/zodiac-view.js";

/** Lado de la ventana de juego original (11×11 lógico SIEMPRE, decisión #5). */
export const VIEW_WINDOW = 11;

/** Media ventana (5): la party siempre está en el centro (5,5). */
export const VIEW_HALF = Math.floor(VIEW_WINDOW / 2);

/**
 * Sentinels de `ViewSnapshot.window` (ambos se pintan a NEGRO). Distinguirlos
 * es opcional para la piel; se mantienen separados para diagnóstico y para que
 * una piel futura pueda decorar el borde del mapa distinto del "oculto".
 */
/** Casilla fuera de los límites de un mapa que no hace wrap (borde). */
export const TILE_OFFMAP = -1;
/**
 * Casilla DENTRO del mapa pero NO visible: censurada por la visibilidad del
 * original (fuera del radio de luz / tras un muro opaco). La aplica el core en
 * el snapshot (regla dura #2); la piel jamás recibe el mapa crudo de noche o
 * tras un muro. Ver `core/world/visibility.ts` (E1-S2).
 */
export const TILE_HIDDEN = -2;

/**
 * Stats VISIBLES del roster (el panel derecho del original). Justificación de
 * cada campo = lo que el marco EGA del original imprime por personaje:
 *  - `name`   : nombre del personaje (columna izquierda del panel).
 *  - `hp`     : puntos de vida actuales (número que el original muestra).
 *  - `maxHp`  : vida máxima (el original la enseña junto a la actual).
 *  - `status` : letra de estado del original (G/P/S/D…), única señal de estado.
 * NO hay % ni barras: el original no las tiene (decisión #6).
 */
export interface PartyMemberView {
  name: string;
  hp: number;
  maxHp: number;
  status: string;
}

/**
 * Reloj/cabecera tal y como lo enseña el original (fecha + hora de Britannia).
 * Es información visible: el original imprime la hora y el juego la usa para
 * horarios NPC y luz. Ningún dato oculto.
 */
export interface ClockView {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
}

/**
 * Una celda VISIBLE de la planta de mazmorra (censurada por la luz, regla dura
 * #2), en coordenadas absolutas de la planta (0..7). `type` = nibble ALTO del
 * tile (muro/escalera/cofre/puerta…, dict DNGLOOK re/notes/dungeon.md §0.2),
 * `sub` = nibble BAJO (subtipo: efecto de fuente, tipo de campo…).
 */
export interface DungeonCellView {
  x: number;
  y: number;
  type: number;
  sub: number;
  /** Puerta secreta ya revelada por (S)earch — deja de ocultar/bloquear. */
  secretRevealed: boolean;
}

/**
 * Vista mazmorra first-person (E1-S9): TODO lo que una piel necesita para
 * componer el pasillo, y NADA que el original oculte. El core ya tiene el
 * `dungeonState`; el adaptador expone aquí sólo el cono ILUMINADO. La geometría
 * en perspectiva la deriva la piel de este dato (spec re/notes/dnglook-raster-spec.md).
 */
export interface DungeonViewInfo {
  /** Planta actual (0..7). */
  floor: number;
  /** Orientación de la party. */
  facing: "north" | "east" | "south" | "west";
  /** Posición de la party en la planta (0..7). */
  pos: { x: number; y: number };
  /**
   * Profundidad iluminada del cono (DNGLOOK gate de luz, core/dungeon/light.ts):
   * 0 = oscuridad total (sólo la celda actual), 3 con antorcha.
   */
  lightDepth: number;
  /** ¿Hay luz? (antorcha/hechizo). Con `false` la vista es negra (gate duro §7). */
  lit: boolean;
  /**
   * (El campo `blindOrRoom` que vivía aquí fue RETIRADO en #275: `g_unk_58A1 & 4`
   * resultó ser la bandera CAMPAMENTO del encuentro — parámetro de
   * run_combat_encounter, escrito por camp_command y leído por el constructor del
   * .CBT sintético y combat_actor_sleep —, no un modo de la vista 3D; la lectura
   * «sala/ciego» de dnglook-raster-spec §2 quedó refutada por #248/#269 y ningún
   * pintor consumía el campo.)
   */
  /**
   * Variante de tileset de muro (`g_dng_wall_variant` 1/2/3, DUNGEON:0x0e7b-0x0ec4):
   * determinista por mazmorra (idx=loc−0x20): {Deceit,Wrong,Covetous}→3 (DNG3 gris),
   * {Shame,Hythloth}→2 (DNG2 rojo), {Despise,Destard,Doom}→1 (DNG1 oliva). La piel
   * mapea variante V → índice de pack V−1.
   */
  wallVariant: number;
  /**
   * Celdas VISIBLES del cono (censuradas por la luz), coords absolutas de la
   * planta (0..7). Es lo que el original raytraza y muestra; nada fuera del cono.
   * El compositor las coloca en el grid 11×11 según facing/profundidad. Las
   * casillas no presentes se tratan como muro (borde del cono).
   */
  cells: readonly DungeonCellView[];
  /**
   * Monstruo ERRANTE 3D visible (slot 1, re/notes/dungeon-wanderer.md §9): posición
   * absoluta de la planta + banco de sprite MON0-7. `ceiling` = flag +15 (araña/
   * slime 51%): el render lo dibuja en la FILA-TECHO de la tabla Y (0x2E32 fila 1),
   * acechando desde arriba — NO es invisibilidad. `null` si inactivo u otra planta.
   */
  monster?: { x: number; y: number; bank: number; ceiling: boolean } | null;
}

/**
 * Banda celeste (sol/lunas) — sólo la información VISIBLE que el original enseña
 * en la barra superior del overworld: las dos fases lunares del día (0..7). La
 * piel deriva la POSICIÓN (por hora) y el glifo; el core sólo aporta las fases
 * (dato del reloj/día, `re/notes/shrines.md`). `null` cuando la banda no aplica
 * (interiores/mazmorra/combate/underworld), como el gate `0x4b5d` del kernel.
 */
export interface SkyBand {
  /** Fase de Felucca hoy (0..7). */
  felucca: number;
  /** Fase de Trammel hoy (0..7). */
  trammel: number;
}

/**
 * Ficha completa de un personaje para la página de Ztats (comando Z) — la
 * información VISIBLE del record que `draw_stat_page` (ZSTATS.OVL 0x0082) imprime
 * en el panel derecho (re/notes/ztats-layout.md). Es lo mismo que el original
 * enseña al pulsar Z; no hay datos ocultos. El roster en reposo (`PartyMemberView`)
 * sigue mostrando sólo name/hp; esto es la página desplegada.
 */
export interface ZtatsMemberView {
  name: string;
  /** Letra de clase del record (+0xA: 'A'..'S', "AMBFDTPRS"). */
  charClass: string;
  /** Letra de estado (+0xB: G/P/C/S/D). */
  status: string;
  /** "M" / "F" (byte +9: 0x0B=M, 0x0C=F). */
  gender: string;
  /** Str (+0x0c), Dex (+0x0d), Int (+0x0e): atributos de 2 dígitos. */
  str: number;
  dex: number;
  int: number;
  /** currentHP (+0x10, word) / maxHP (+0x12, word) / currentMP (+0x0f, byte). */
  hp: number;
  maxHp: number;
  mp: number;
  /** Exp (+0x14, word). */
  exp: number;
  /** Nivel (+0x16, byte) — va en la cabecera de la ficha. */
  level: number;
}

/**
 * Una fila de una de las 4 LISTAS de inventario de Ztats (reactivos/ítems/quest/
 * equipo — `render_item_list` 0x06e8, re/notes/ztats-layout.md §2-3). Es EXACTAMENTE
 * lo que el original enseña al paginar la lista: el ítem, su nombre y su cantidad.
 * El adaptador ya FILTRA a `qty>0` (la lista sólo muestra lo poseído, §3 paso 2/3),
 * así que toda fila recibida es de un ítem en posesión.
 *
 * El `name` puede portar como PRIMER carácter un sigilo de formato `*`/`!`/`(`
 * (embebido en la name-table de DATA.OVL, §5): la capa de blit lo interpreta
 * (`printListRow`) — realce y variante de render. El adaptador del port emite
 * nombres SIN sigilo (los sigilos exactos por-ítem son Clase C, pendientes del
 * volcado del DGROUP); la maquinaria de sigilo vive y se testea en la piel.
 */
export interface InventoryListItem {
  /** Índice del ítem en su tabla (orden estable del original: Equipment/Reagent/…). */
  idx: number;
  /** Nombre visible del ítem (name-table; la cadena EXACTA es Clase C, §5-6). */
  name: string;
  /** Cantidad poseída (col. de 2 díg. del original). Siempre >0 en las filas visibles. */
  qty: number;
}

/**
 * Provisiones globales de la party — la página `0xc` de Ztats (rutina headerless
 * 0x039c, re/notes/ztats-layout.md §2). Es lo que el panel imprime: comida, oro,
 * llaves, gemas, antorchas, y el gancho (grapple) sólo si se posee. Info visible.
 */
export interface InventoryProvisions {
  food: number;
  gold: number;
  keys: number;
  gems: number;
  torches: number;
  /** El original imprime la línea del gancho SÓLO si `g_grapple≠0` (§2, 0x044f). */
  grapple: boolean;
}

/**
 * Equipo VISIBLE de un miembro — la mitad de equipo de la página impar
 * (`draw_magic_or_equipment_panel` 0x02a8, re/notes/ztats-layout.md §2): los 6
 * slots +0x19..+0x1e con el nombre del ítem puesto, o `null` si el slot está vacío
 * (0xff). Más los hechizos que el miembro conoce (la 2ª mitad = hechizario), como
 * lista `qty>0`. Todo es lo que el original enseña en esa página; nada oculto.
 */
export interface InventoryMemberEquip {
  helmet: string | null;
  armor: string | null;
  /** Mano A (+0x1b) — arma empuñada. */
  weapon: string | null;
  /** Mano B (+0x1c) — escudo/segunda arma. */
  shield: string | null;
  ring: string | null;
  amulet: string | null;
  /** Hechizos conocidos (qty>0) — la 2ª mitad de la página (hechizario). */
  spells: readonly InventoryListItem[];
}

/**
 * Vista de INVENTARIO para las sub-páginas de Ztats (comando Z, §2-6). Reúne lo
 * que las páginas del eje muestran, computado en `coreview.ts` desde los MISMOS
 * campos del record/estado que lee el original — regla dura #2: sólo lo visible,
 * ya filtrado a `qty>0`, nunca el array crudo de 48.
 *
 * Las 4 listas (§2) por su tabla de cantidades del original:
 *  - `reagents` (0xd): g_reagent_qty (8).
 *  - `items`    (0xe): tabla adyacente al equipo (0x57f0); categoría inferida
 *                (mixturas/hechizos) — a confirmar por volcado (Clase C, §2).
 *  - `quest`    (0xf): ítems de trama/especiales (tabla aplanada 0xb9ee).
 *  - `equipment`(0x10): armas+armaduras (g_equip_qty, = picker de Ready).
 */
export interface InventoryView {
  provisions: InventoryProvisions;
  /** Por miembro (índice = miembro de la party): sus 6 slots + hechizario. */
  members: readonly InventoryMemberEquip[];
  reagents: readonly InventoryListItem[];
  items: readonly InventoryListItem[];
  quest: readonly InventoryListItem[];
  equipment: readonly InventoryListItem[];
}

/**
 * Una fila del picker de READY (overlay de pergamino, `item_page_controller` @0x0f2e
 * modo 'R'). El original pinta `[cuenta 2 díg. | "--"][glifo/espacio][nombre]`: la
 * cuenta sale de `g_equip_qty`, y si el ítem está EQUIPADO la separación lleva su
 * glifo de clase realzado (testigo "--♥Chain").
 *
 * DERIVADO del tipo del core (`ReadyPickerRow`, core/readyPicker.ts) con `Omit` en
 * vez de duplicado a mano (auditoría MANT-6): la vista curada esconde `equipId`
 * (dato interno, no presentación) y un campo nuevo del core aparece aquí — o rompe
 * la compilación — en vez de divergir en silencio.
 */
export type ReadyPickerRowView = Omit<ReadyPickerRow, "equipId">;

export type { InnRegisterView };

/**
 * Estado del comando READY para las pieles — MODAL transitorio que fija main.ts
 * (`setReadyPicker`), o `null` fuera de Ready. Dos fases (calco de `cmd_ready`
 * @0x1296):
 *   · `"select"`: eligiendo jugador sobre el ROSTER (banner ►Select:◄ + cursor en
 *     vídeo inverso, que ya viaja en `selectCursor`). No hay overlay todavía.
 *   · `"pick"`: overlay de pergamino sobre el panel con `rows`, la barra de selección
 *     en `cursor` y el primer ítem visible en `scroll`; el banner es el nombre del PJ.
 */
export interface ReadyPickerView {
  phase: "select" | "pick";
  /** Banner del panel: "Select:" en `select`, nombre del PJ en `pick`. */
  title: string;
  /** Filas del picker (sólo en `pick`). */
  rows: readonly ReadyPickerRowView[];
  /** Índice absoluto del ítem bajo la barra de selección (sólo `pick`). */
  cursor: number;
  /** Primer ítem visible en la ventana de 7 filas (sólo `pick`). */
  scroll: number;
  /**
   * Formato de fila. `"ready"` (default): cuenta + glifo de clase + nombre. `"mix"`:
   * el selector de reagentes de (M)ix (CMDS.OVL 0x18be) → " NN <marca 0xfd> NAME",
   * la marca de selección con brackets 0xfd. `"shop"`: la ventana «Arms» de VENTA
   * del herrero (SHOPPES.OVL `list_wares` 0x0c80) → fila ` N-Abbrev` (cuenta 2
   * celdas space-pad + '-' + nombre CORTO 0x1972), página de 4 filas (rel 1..4: el
   * corte real es `cmp ax,5` @0x0d9d; el `cmp si,5` @0x0dd6 es el bucle de RELLENO
   * y se leyó como «5 filas» por error — corrección buy-herrero, ver la nota de
   * SHOP_ARMS_VISIBLE_ROWS en shops/shopArmsPicker.ts y el testigo clip #31) y
   * banda ▲/▼/↕ una fila bajo el marco. `"use"`: el picker del comando (U)se
   * (`item_page_controller` modo 'U' 0x55, abierto por `cmd_use_item` CAST.OVL
   * 0x1792) → MISMA rutina de fila que la lista «Items» de Ztats (name-table
   * 0x1916 + tabla 0xB9EE + sigilos `*`/`!`/`(` + ocultar-columna con qty 0xff),
   * con separador 0x20 en vez de 0x2d. Ver `readyRowCells`.
   */
  variant?: "ready" | "mix" | "shop" | "use";
}

/**
 * Un TRAMO de una fila de consola: texto contiguo impreso con UNA fuente (rúnica o
 * latina). Modelo por-tramo del cambio de fuente a mitad de fila (#364-c). Se eligen
 * tramos (no offsets) para que la traducción por tramo no-runa pueda cambiar longitudes
 * sin romper anclas.
 */
export interface ConsoleSegment {
  text: string;
  rune: boolean;
}

/**
 * Una línea de la consola de texto + su METADATA de presentación (F-G): `kind`
 * distingue el ECO de un comando del jugador (`►North`, lleva bullet) de un
 * MENSAJE del juego (`Blocked!`, sin bullet). El original marca esa distinción
 * (video-diff §A-bis punto 6); es metadata de PRESENTACIÓN — el texto del core
 * no cambia (la guarda CI de strings no se mueve).
 */
export interface ConsoleLine {
  text: string;
  kind: "echo" | "message";
  /** Impresa con la FUENTE RÚNICA (RUNES.CH): profecía del Codex (ceremonia de las 8
   *  virtudes, set_font(1) del binario). La piel fiel la pinta con `runes` en vez de IBM.CH. */
  rune?: boolean;
  /**
   * TRAMOS de la fila cuando la fuente cambia A MITAD DE FILA (#364-c): el binario
   * conmuta text_set_font (kernel 0x1c9e) entre caracteres de la MISMA fila — ALAKAZAM
   * de la donación (CAST2 0xba5/0xbb2), «A scroll: <runa>!» (SJOG 0x15e7/0x15fd) y el
   * habla rúnica de TALK, que decide fuente POR CARÁCTER con el bit 7 (TALK 0x4fc-0x55e).
   * SOLO presente en filas MIXTAS (hay tramos rúnicos Y latinos): las filas homogéneas
   * conservan su forma `{text,kind[,rune]}` exacta (varios tests las comparan con toEqual
   * estricto, y así el pintado por-fila existente no se toca). INVARIANTE: `text` ===
   * concatenación de `segments[].text` (el historial/e2e/espejo leen `text`; los tramos
   * son solo metadata de presentación, como `signCells`).
   */
  segments?: readonly ConsoleSegment[];
  /**
   * CONTINUACIÓN de un getstring de CONSOLA (Yell/Talk): la 2ª línea del prompt, la
   * fila del cursor «:» donde se teclea (DS 0x4529 "what?\n:"; TALK_UI.cursor). Es
   * de kind "echo" para que `echoSetLast` la reescriba en vivo, PERO no lleva bullet
   * ► ni abre grupo: el ► sólo marca el ECO del comando (1ª línea, "Yell what?"), no
   * la fila del getstring — el original imprime «:» sin bullet en línea nueva (testigo
   * usuario `>Yell what?` / `:VERAMOCOR`, verdicts/yell-prompt).
   */
  cont?: boolean;
  /**
   * FILA DE UN CARTEL (L)ook: celdas pre-compuestas (marco RUNES.CH + cuerpo rúnico, ya
   * centradas en el ancho de consola) que la piel fiel blitea VERBATIM en vez de word-
   * wrapear `text`. El DOS dibuja el cartel en el flujo del log (no en un overlay); esto
   * lo modela. `text` conserva el cuerpo LATÍN para el historial y la detección e2e
   * (vacío en las filas de marco). Cada celda: `{code, rune}`. Ver skin/fiel/sign-box.ts.
   */
  signCells?: readonly { code: number; rune: boolean }[];
}

/**
 * Un combatiente VISIBLE de la arena, para los overlays de la piel (spec S12 §1).
 * Los TILES de la arena YA viajan compuestos en `ViewSnapshot.window` (en combate
 * `activeMap` ES la arena 11×11 y las entidades se componen encima, igual que el
 * mundo); esto es sólo la METADATA de celda que el tile-id NO porta: quién la
 * ocupa, de qué bando y su estado pintable. Regla dura #2: nada oculto — sin HP
 * exacta del enemigo, sin orden de turnos, y los invisibles NO se exponen (el
 * original no los pinta salvo al Shadowlord, fuera de esta vista de jugador).
 */
export interface CombatantView {
  id: number;
  x: number;
  y: number;
  kind: "party" | "enemy";
  /** Dormido (letra 'S' / no reacciona) — señal visible del original. */
  sleeping: boolean;
  /** Poseído/charmed (lucha para el otro bando) — señal visible. */
  charmed: boolean;
}

/**
 * Cursor de Aim (comando A / hechizo) mientras el jugador elige objetivo — el
 * `comsubs_aim_cursor` del binario (spec §7). `cell` = celda del cursor móvil (la
 * piel dibuja una CRUZ blanca ahí; el original no resalta las celdas en alcance).
 * Sólo presente mientras se apunta. El PARPADEO/estilo de la cruz = Clase C (#26).
 */
export interface CombatAimView {
  cell: { x: number; y: number };
}

/**
 * Estado de COMBATE específico para los overlays de la piel (spec S12). NO
 * reproduce lo que el snapshot ya expone: los TILES de la arena (con cadáveres/
 * sangre/cofres ya resueltos, spec §4) van en `window`, el roster en `party`, los
 * mensajes en `console`. Aquí van las TRES cosas que el tile-buffer no porta:
 * quién ocupa cada celda, DE QUIÉN es el turno (recuadro del activo, spec §1) y la
 * retícula de apuntado (spec §7). `null` fuera de combate.
 */
export interface CombatView {
  combatants: readonly CombatantView[];
  /** Celda del combatiente cuyo TURNO es (recuadro del activo, §1), o null. */
  active: { id: number; x: number; y: number } | null;
  /** Retícula de apuntado (§7), o null si no se está apuntando. */
  aim: CombatAimView | null;
}

/**
 * Un miembro del party COLOCADO en la escena de acampada (kernel `party_anim_build`
 * 0x6936): su celda de FORMACIÓN en la ventana 11×11 + el tile de su clase. Regla
 * dura #2: es lo que el original PINTA al acampar (el party estalla como actores
 * individuales sobre el mapa, no un dato oculto). Ver `re/notes/camp-scene.md` §2.
 */
export interface CampSceneMember {
  /** Índice de roster (0-based) del miembro, para correlación con el panel. */
  charIdx: number;
  /** Columna en la ventana 11×11 (tabla DATA.OVL fo 0x1734, indexada por roster). */
  col: number;
  /** Fila en la ventana 11×11 (tabla DATA.OVL fo 0x173c). */
  row: number;
  /**
   * Tile a pintar: el de GUARDIA va DE PIE con el sprite de COMBATE de su clase
   * (`party_anim_build` jump-table 0x6b04 → 0x140/0x144/0x148/0x14c); el DURMIENTE va
   * TUMBADO (SleepingInBed 0x11a, finalize 0x68ae). Ambos confirmados por el vídeo del
   * usuario (CAMP.mov). buildCampScene ya resuelve cuál según `guard`.
   */
  tile: number;
  /**
   * ¿Este miembro está de GUARDIA (despierto, RONDANDO el fuego)? Los demás DUERMEN
   * tumbados. Se deriva del guardIdx del flujo de camp. En el original el guardia queda
   * 'G' y los durmientes 'S' (el port no persiste ese status transitorio).
   */
  guard: boolean;
  /**
   * ¿El guardia es un BARDO tocando el laúd? (easter egg: Iolo, clase 'B' → 0x15c). La
   * piel puede acompañarlo con música (Clase C, sin testigo de la melodía). Falso para
   * durmientes y guardias no-bardo.
   */
  bard: boolean;
  /**
   * Tile DE PIE con el que este miembro DESPIERTA durante la escena de la aparición
   * (OUTSUBS 0x0868-0x0874: strchr de la clase en "AMBFDTPRS" DS 0x7760 → tabla de
   * bytes DS 0x1ade = [4c,40,44,48,4c,4c,4c,4c,4c], banco alto ⇒ A→0x14c Avatar,
   * M→0x140 Wizard, B→0x144 Bard, F→0x148 Fighter, resto→0x14c). La piel fiel lo
   * blitea sobre el durmiente cuando el pulso de la aparición alcanza a este miembro
   * (members[i] despierta en el pulso i — bucle 0x07fb en orden de roster, vivos).
   */
  awakeTile: number;
}

/**
 * Escena de ACAMPADA (H)ole up & camp — la presentación que el original monta al
 * dormir a la intemperie en el OVERWORLD a pie (kernel 0x6936 vía flags 0x0004,
 * flag&2=0): explota el party en formación de semicírculo alrededor de una hoguera.
 * `null` fuera de la escena (sin acampar, en combate, en pueblo o en mazmorra — el
 * camp de mazmorra usa la otra vía, arena de terreno 0x7C3E, no modelada aquí).
 *
 * Es presentación PURA derivada del estado (regla #71: pintar no muta el core). El
 * único `rand` del montaje del original está gateado por status '*'/',' y un party
 * sano no lo consume ⇒ 0-RNG en el caso normal. Ver `re/notes/camp-scene.md`.
 *
 * La FIGURA de la aparición (25%) NO va aquí: su posición/tile no está derivada
 * (Clase C, fase 2); sus SFX + discurso ya viajan como eventos/consola del turno.
 */
export interface CampSceneView {
  /**
   * Miembros VIVOS colocados en su celda de formación (los muertos, status 'D', se
   * OMITEN — 0x69e1 skip — dejando su hueco vacío). Orden = roster (0..partySize-1).
   */
  members: readonly CampSceneMember[];
  /** Hoguera: celda ~(5,5) (spawn 0x6b7e x=5,y=5) + tile CampFire (0xb3=179). */
  fire: { col: number; row: number; tile: number };
}

/**
 * ESCENA de MUERTE + RESURRECCIÓN de Lord British (party-wipe / refuge, BLCKTHRN 0x0910).
 * Cuando está montada, coreview ya HORNEA el viewport negro + el Avatar solo + las figuras
 * de la fase en `window` (la piel lo pinta por el bucle normal, negativos = negro). Este
 * descriptor sólo LLEVA la fase para que la piel añada, si quiere, el destello de "Vertigo"
 * (Clase C). `null` fuera de la escena. Ver `skin/refugeScene.ts` y `core/game.ts` (RefugeScript).
 */
export interface RefugeSceneView {
  /** Fase visual actual (main.ts la avanza al pacear el guión). Ver `RefugeScenePhase`. */
  phase: RefugeScenePhase;
}

/**
 * ESCENA del santuario / cámara del Codex (#277) — un FOTOGRAMA del guión: la rejilla
 * 11×11 del mapa de MISCMAPS.DAT (constante durante el rito) y dónde está el Avatar
 * ahora (`null` = escena vacía, los cuatro cues de apertura y de cierre).
 */
export interface ShrineSceneView {
  /** `tiles[row][col]` = índice de tile del atlas (MISCMAPS.DAT, 11×11). */
  tiles: readonly (readonly number[])[];
  /** Avatar en coords de la rejilla, con su tile del banco alto (0x11c pie / 0x16c rodilla). */
  avatar: { col: number; row: number; tile: number } | null;
}

/**
 * ESCENA de la CAPTURA de Blackthorn (#324, BLCKTHRN 0x060e + anim_vm 0x00be) — el
 * estado visual VIVO que el pacer (`ui/blackthorn-scene-pacer.ts`) mantiene entre
 * segmentos: el apagón de la venda (viewport negro, 0x0676/0x0689) o la sala del trono
 * (rejilla de MISCMAPS.DAT[0:176] con los parches del VM ya aplicados) más las figuras
 * (party engrilletada, guardias, Blackthorn). coreview la HORNEA en `window` como las
 * demás escenas; persiste durante los prompts del interrogatorio.
 */
export interface BlackthornSceneView {
  phase: "blackout" | "throne";
  /** Rejilla 11×11 con parches acumulados; `null` durante el apagón. */
  tiles: readonly (readonly number[])[] | null;
  /** Figuras en coords de la rejilla, tiles del atlas (banco alto ya sumado). */
  figures: { col: number; row: number; tile: number }[];
}

/** Prefijo de id de los actores de la escena de la captura (#324): `bt:<slot>`. La
 *  fiel los filtra en `buildActorFrames` (ya vienen horneados en `window`, como los de
 *  camp/shrine); el shader los compone con transparencia por la vía terreno+actores. */
export const BLACKTHORN_ACTOR_ID_PREFIX = "bt:";

/** ¿Es un actor de la escena de la captura? (filtro de la piel fiel, patrón camp). */
export function isBlackthornActorId(id: string): boolean {
  return id.startsWith(BLACKTHORN_ACTOR_ID_PREFIX);
}

/** Un actor de la escena del ENDGAME (sprite en coordenadas de sala 11×11). */
export interface EndgameActorView {
  tile: number;
  col: number;
  row: number;
}

/**
 * ESCENA del ENDGAME (#34) — el descriptor que main.ts fija al pacear el guión
 * (`EndgameScript`, patrón RefugeScript). En las fases de SALA (greenScene/dialogue/
 * orbMoongate/terminalPrison) coreview HORNEA `room`+`actors` en `window` (como el
 * refuge) y la piel re-tiñe de VERDE + pinta gate/orb encima; en las fases de PANTALLA
 * COMPLETA (dissolve, storyHouse/storyDream, scroll, terminalFreeze) la piel fiel toma
 * el frame entero. `null` fuera del cierre. Ver `core/endgame/sequence.ts`.
 */
export interface EndgameSceneView {
  /** Fase del guión en curso (main.ts la avanza). */
  phase:
    | "greenScene"
    | "dialogue"
    | "orbMoongate"
    | "dissolve"
    | "storyHouse"
    | "storyDream"
    | "scroll"
    | "terminalFreeze"
    | "terminalPrison";
  /** Rejilla 11×11 de la sala del trono (MISCMAPS.DAT[528:704], endgame.json scene). */
  room?: ReadonlyArray<readonly number[]> | null;
  /** Sprites vivos de la escena (LB + party); coreview los hornea sobre `room`. */
  actors?: readonly EndgameActorView[];
  /** Etapa del moongate ROJO (tile 0xdc) en la celda (5,4): 1..16, o null sin puerta. */
  moongate?: number | null;
  /** Celda del ORB rojo parpadeando en el suelo (GAP 4 paso 2), o null. */
  orb?: { col: number; row: number } | null;
  /** Página de END.DAT del beat de historia en curso (0-5 → lámina del atlas). */
  storyPage?: number | null;
  /** Texto de la página de historia en curso (byte-exacto de END.DAT; la piel lo pinta). */
  storyText?: string | null;
  /** Progreso de la disolución de píxeles 0..1 (fase dissolve). */
  dissolve?: number;
  /** Orden de píxeles de la disolución (permutación 0..N-1; lo computa main.ts). */
  dissolveOrder?: Uint32Array;
  /** Líneas del pergamino final (fase scroll; core questScroll). `rune` = línea impresa
   *  con la fuente RÚNICA (RUNES.CH; bytes codificados como la profecía del Codex);
   *  `below` = línea FUERA del pergamino (el informe «Report now…» va en blanco bajo el
   *  arte ENDSC, testigo w140). */
  scrollLines?: readonly { text: string; rune?: boolean; below?: boolean }[];
  /** Nº de líneas del pergamino ya reveladas (animación de estampado). */
  scrollReveal?: number;
  /** Planta de mazmorra bajo la escena (bandas ►L8◄ del testigo). Lo enriquece coreview. */
  dungeonLevel?: number;
  /** Facing bajo la escena (banda ►Dir:◄). Lo enriquece coreview. */
  dungeonFacing?: "north" | "east" | "south" | "west";
}

/**
 * EVENTO EFÍMERO de combate (one-shot): el core señala QUÉ pasó y DÓNDE; la piel
 * lo anima con su reloj (F-A) y su cadencia (Clase C, #26). Espejo del bus de sfx
 * (`onSfx`): NO viaja en el snapshot (es un pulso, no estado). Lo emite el
 * adaptador desde la raíz de composición (main.ts) en los MISMOS puntos donde ya
 * rutea el sonido — el motor (`combat.ts`, que porta el RNG) no se toca.
 */
export type CombatFx =
  | {
      /** Vuelo de proyectil (spec §2): del atacante al objetivo, celda→celda. */
      kind: "projectile";
      from: { x: number; y: number };
      to: { x: number; y: number };
      /** true si el disparo acierta (informativo; la piel decide la presentación). */
      hit: boolean;
    }
  | {
      /** Flash/inversión de la celda del objetivo al impactar (spec §3). */
      kind: "hitFlash";
      x: number;
      y: number;
      targetKind: "party" | "enemy";
    }
  | {
      /**
       * Flash de pantalla completa (daño de terreno/evento).
       * 🔴 ATRIBUCIÓN CORREGIDA (#201/#203): este comentario decía «`kernel_flash` 0x3AE6» y
       * es FALSO. `ULTIMA.EXE:0x3ae6` (54 B, cuerpo leído) NO flashea: bajo el gate
       * `[g_unk_58a4]` hace un bucle `viewport_redraw` + espera calibrada, **n veces** — una
       * PAUSA medida en fotogramas. El propio port ya lo modela bien en dos sitios
       * (`core/game.ts:1354` «run-n-frames 0x3AE6(10) (pausa muda)» y `core/sfx.ts:220`);
       * esta línea era el único artefacto que lo llamaba flash.
       * Sólo se corrige la ATRIBUCIÓN: el `kind` y sus emisores se quedan como están, porque
       * cambiarlos es una pregunta CONDUCTUAL — ¿los call-sites que el port modeló como
       * `screenFlash` llaman también a 0x3AE6 (⇒ el flash es un efecto INVENTADO donde el
       * original pausa) o llaman a otra rutina que sí flashea (⇒ sólo mentía el comentario)?
       * Eso pide censar los emisores uno a uno y es la ficha **#203**, no ésta.
       */
      kind: "screenFlash";
      n: number;
    }
  | {
      /** Sacudida de la ventana de combate (In Vas Por Ylem, kernel 0x3072). La
       *  piel la enruta a su `QuakeShake` (la misma del overworld, #29/#36); no la
       *  pinta `paintOne` (se intercepta en `onCombatFx`). */
      kind: "quake";
    }
  | {
      /** ABANICO de rayos de un hechizo de línea (In Zu / In Nox Hur / In Flam Hur /
       *  In Vas Grav Corp) — calco de CAST.OVL 0x1c36: 21 rayos píxel a píxel desde
       *  el borde del caster, ya TRAZADOS (recortados por LOS 0x6a14 y viewport) por
       *  el adaptador (main.ts, que sí puede leer el core). `rays[i]` = polilínea en
       *  píxeles de ARENA (0..175); `color` = CSS del índice EGA brillante del
       *  hechizo (tabla g_unk_13ae/b2/b4/b6 + 8, INTRO.OVL 0x09ee / CAST 0x1c88). */
      kind: "lineSpray";
      rays: readonly (readonly { x: number; y: number }[])[];
      color: string;
    };

/**
 * Una moongate activa visible, como OVERLAY sobre la ventana (seam B). El core
 * expone su celda (col,row de la ventana 11×11) y el tile de TERRENO que hay
 * DEBAJO (`under`) — porque `window` en esa celda lleva la puerta llena horneada
 * (la piel dev la pinta así, sin animar). La piel fiel repinta el terreno + la
 * puerta PARCIAL según su etapa de subida/bajada (`g_moongate_anim` 0..16), que
 * computa con su reloj (Clase C, sin impacto en parity). Sólo celdas visibles.
 */
export interface MoongateCell {
  col: number;
  row: number;
  /** Tile de terreno bajo la puerta (para repintar antes de la puerta parcial). */
  under: number;
}

/**
 * Un actor visible del viewport con IDENTIDAD estable (piel shader motion, eje 3):
 * el shader lo desliza de su celda vieja a la nueva (por `id`) y funde su ciclo de
 * animación. Aditivo/output-neutral: la fiel no lo usa (sigue horneando el actor en
 * `window`). `col`/`row` son celda del viewport (0..10); `tile` es el tile base.
 */
export interface ActorView {
  id: string;
  tile: number;
  col: number;
  row: number;
}

/**
 * Snapshot de vista: TODO lo que una piel necesita para pintar un frame, y NADA
 * que el original oculte. Es un VALOR (arrays copiados, sin referencias vivas al
 * core), recomputable en cualquier momento; las pieles no cachean estado.
 */
export interface ViewSnapshot {
  /** Modo actual (marco/cámara distintos). Info del original: se ve en pantalla. */
  mode: "world" | "dungeon" | "combat";
  /**
   * Ventana 11×11 row-major (121 tiles compuestos: terreno + objetos +
   * entidades + party encima), YA CENSURADA por la visibilidad del original
   * (E1-S2). Valores negativos = negro: `TILE_OFFMAP` (borde) o `TILE_HIDDEN`
   * (no visible). En modo `dungeon` la ventana no aplica (ver `dungeon`).
   *
   * Justificación: es exactamente lo que el kernel de dibujo del original
   * compone y blitea en su ventana de juego (11×11), con su misma censura de
   * línea de visión / oscuridad. La piel NUNCA ve más de lo que vería el
   * jugador del original.
   */
  window: Int16Array;
  /**
   * Ventana de TERRENO 11×11 SIN los actores horneados (piel shader motion, eje 3):
   * la base del scroll suave — el mundo-sin-actores atraviesa el pipeline del shader
   * (xBR + agua) y los `actors` se componen encima. ADITIVO/output-neutral: sólo se
   * puebla en modo `world`; `undefined` en otros modos → el shader hace SNAP (sin tween).
   * La fiel lo ignora (sigue usando `window` con actores horneados; byte-idéntica).
   *
   * NIEBLA (scroll-shadows): este terreno va SIN censurar por visibilidad — la máscara de
   * LOS viaja aparte en `visMask` para que el shader la aplique FIJA A PANTALLA (pegada al
   * Avatar) y la sombra NO barra con el mundo durante el paso. `window` sí sigue censurada.
   */
  terrainWindow?: Int16Array;
  /**
   * Máscara de NIEBLA/LOS por celda de la ventana 11×11 (piel shader motion): `1` =
   * visible (pinta el terreno), `0` = oculta (el shader la ennegrece). Va APARTE de
   * `terrainWindow` (que es terreno crudo) para que el shader la aplique FIJA A PANTALLA
   * tras el cross-slide — la sombra queda pegada al Avatar (centro), no se desliza con el
   * terreno. Sólo en modo `world`; `undefined` en otros modos. La fiel/dev la ignoran
   * (usan la censura ya horneada en `window`). Ver `re/notes` E1-S2.
   */
  visMask?: Uint8Array;
  /**
   * DISCO DE LUZ de la party (radio ambiental/antorcha PURO, sin muros ni emisores): `1`
   * dentro del radio, `0` fuera. Center-anchored (pegado al Avatar). Va junto a `visMask`
   * para que el shader DESCOMPONGA la niebla durante el tween: ancla a pantalla la caída del
   * radio (halo pegado al Avatar) y desliza con el terreno sólo la sombra por OCLUSIÓN de
   * muros (`visMask=0 ∩ visRadius=1`). Así el disco no hace bulge/snap al pasar y las sombras
   * de edificios siguen deslizando (7044b7b7). Sólo en modo `world` con motion; la fiel lo
   * ignora (compone la censura ya horneada en `window`). Ver `world/visibility.computeRadiusMask`.
   */
  visRadius?: Uint8Array;
  /** Actores visibles con identidad estable (motion). Sólo en modo `world`. */
  actors?: readonly ActorView[];
  /** Centro de la ventana en coords de mapa (posición party; en combate, 5,5). */
  center: { x: number; y: number };
  /** Últimas líneas de la consola (scrollback corto), con su `kind` (eco/mensaje). */
  console: readonly ConsoleLine[];
  /**
   * HISTORIAL largo de consola (carril log-scroll, QoL de shell): las MISMAS líneas
   * que `console` pero retenidas hasta CONSOLE_HISTORY (500) en vez de 12. La piel
   * pinta `console` por defecto (fidelidad intacta); SÓLO el modo scrollback opcional
   * (rueda/gesto sobre el área de consola) lee de aquí. Aditivo y opcional: un
   * snapshot sin él (mocks de tests) simplemente no ofrece historial.
   */
  consoleHistory?: readonly ConsoleLine[];
  /**
   * ¿El juego espera un COMANDO en el prompt de consola? (F-G): el cursor
   * parpadeante ES el indicador de "esperando input" del original — info visible
   * (no viola #6). Alto sólo cuando el bucle de main está en el prompt de comando
   * (sin diálogo/selector/prompt Y-N abierto) Y NO hay combate. El combate lo
   * deriva el adaptador de `game.combat`; los modales de UI los fija main.ts.
   */
  awaitingInput: boolean;
  /**
   * ¿El BUCLE DE COMANDO está esperando una tecla (sin getstring/getnum/getYN de
   * piel abierto)? Igual que `awaitingInput` PERO sin apagarse en combate: el
   * combate también tiene su bucle de comando (COMBAT.OVL 0x0838), donde (Z)stats
   * es una tecla real (thunk 0x9ce→dba6) — a diferencia del cursor de consola, que
   * el original NO pinta en combate. La piel usa esto SÓLO para el gate del comando
   * Z (abrir Ztats): en overworld coincide con `awaitingInput`; en combate deja
   * abrir Ztats en el turno del PJ pero NO durante un getstring rúnico de Cast (An
   * Zu) — ahí `this.awaiting` es false igual que en el overworld.
   */
  awaitingCommand: boolean;
  /**
   * ¿El bucle espera una DIRECCIÓN (getdir) tras el eco de un comando direccional?
   * La piel pinta entonces el cursor de la ola JUNTO al comando en la fila de eco
   * viva ("Look-ζ"), sin abrir una fila de prompt aparte. `awaitingInput` sigue alto.
   */
  awaitingDirection: boolean;
  /**
   * ¿Hay un prompt de CONSOLA esperando input (getstring Yell/Talk/getnum/rúnico Y
   * también los de UNA tecla: getkey/dígito/Y-N/party-select/tienda)? A diferencia de
   * `awaitingInput` (que se APAGA con un prompt abierto), esto sigue ALTO durante la
   * espera para que la piel pinte el cursor de la ola AL FINAL de la fila de eco viva
   * («:VERAMOCOR▓», «To phase: ▓»). En el binario ese cursor lo pinta el propio bucle
   * getkey del kernel (0x266c → 0x1b38) para TODOS sus llamadores — cabo #341 §7.2,
   * derivación en re/notes/getkey-cursor-derivacion.md. La población exacta la decide
   * `promptCursorOnLiveRow` (ui/awaiting-gate.ts).
   */
  awaitingGetstring: boolean;
  party: readonly PartyMemberView[];
  /**
   * Índice del miembro ACTIVO (`g_active_char` DS 0x587b): quién ejecuta los
   * comandos que lo usan (Open/Get/Search/Jimmy…) y a quién marca la flecha `→`
   * del roster (col fija 9). 0xFF = ninguno (Set Active Plr con '0'). El panel lo
   * usa en reposo; durante el select del ztats la flecha sigue al cursor.
   */
  activeCharacter: number;
  /**
   * Cursor del picker `select_party_member` (0x2d7a) mientras está ABIERTO — p.ej. la
   * guardia del Camp ("Who will stand guard?"): índice 0-based del miembro bajo el cursor,
   * o `null`/omitido si no hay picker. Cuando no es `null`, la piel pinta ese miembro en
   * VÍDEO INVERSO (negativo) — CORREGIDO por el vídeo del usuario (CAMP.mov): el marcador
   * del select es el inverso, NO la flecha; la `→` se queda en `activeCharacter`.
   */
  selectCursor?: number | null;
  /**
   * ★ #213 — Fila del roster que está AHORA en VÍDEO INVERSO por el FLASH DE DAÑO
   * (`kernel_apply_damage` 0x2a52 → `0x2a28` @0x2a59, des-invertida en 0x2a6e), o
   * `null` si no hay flash vivo. Es la MISMA primitiva de inversión de fila que marca
   * el cursor del picker (`selectCursor`) y el actor de combate — por eso comparte
   * pintado y no lleva estilo propio. La emite el paceador `PoisonTick` de main.ts a
   * reloj de pared: presentación pura, sin core ni RNG. Tiene PRIORIDAD sobre los
   * otros dos marcadores mientras dura, porque en el original la inversión del daño
   * se pinta ENCIMA de lo que hubiera (es un XOR del rectángulo).
   */
  damageFlashIdx?: number | null;
  /**
   * Índice de fila (charIdx) del PJ cuyo TURNO de COMBATE es ahora, o `null` fuera
   * de combate / turno de enemigo. Su fila del roster va en VÍDEO INVERSO
   * (draw_roster_row control 0xfd @0x2867, marcador `g_cmb_actor` — EXCLUSIVO de
   * combate, distinto de la flecha `→` de `activeCharacter`). Vídeo-O f045/f050.
   */
  combatActiveCharIdx: number | null;
  clock: ClockView;
  /** Comida de la party (el panel F/G del original la muestra: `F:19`). */
  food: number;
  /** Oro de la party (panel F/G: `G:8803`). Info visible del original. */
  gold: number;
  /** Nombre del mapa/localización visible (cabecera del original). */
  locationName: string;
  dungeon: DungeonViewInfo | null;
  /**
   * Bandas de MAZMORRA (►L#◄ / ►Dir:◄) durante el COMBATE DE SALA (careo-combate
   * T7): el original conserva el chrome de nivel/rumbo en todos los frames de
   * combate (n6: "Dir: South"), pero `dungeon` se anula en combate (la vista es la
   * arena). Este campo lleva SOLO la metadata de las bandas, como hace la escena
   * del endgame con dungeonLevel/dungeonFacing. `null` fuera de combate de sala.
   */
  dungeonBands?: { floor: number; facing: "north" | "east" | "south" | "west" } | null;
  /**
   * Estado de combate para los overlays de la piel (recuadro del activo §1 +
   * retícula de apuntado §7 + metadata de combatientes), o `null` fuera de
   * combate. Los TILES de la arena siguen en `window` (regla dura #2: una sola
   * fuente censurada); esto NO los duplica.
   */
  combatView: CombatView | null;
  /**
   * Escena de ACAMPADA activa (formación del party + hoguera), o `null` fuera de
   * ella. La fija main.ts al dormir a la intemperie en overworld (`setCampScene`);
   * el adaptador deriva las posiciones de las tablas de formación. Los TILES de la
   * escena NO se hornean en `window` (el snapshot no censura por acampar): la piel
   * los pinta ENCIMA leyendo esto, como los overlays de combate. Ver `CampSceneView`.
   */
  campScene: CampSceneView | null;
  /**
   * ★ #296 — CORTINA NEGRA del sueño en CAMA de pueblo. El original, tras poner el roster
   * a dormir e imprimir «Zzzzzzz...», hace `set_color(0)` + `fill_rect(8,8,0xb7,0xb7)`
   * (CMDS.OVL 0x0614-0x0624) = el interior 176×176 de la ventana de juego, y NO lo repinta
   * durante toda la noche (el bucle de 0x0634 sólo toca reloj, roster y panel) ⇒ el viewport
   * está a negro hasta salir de la cama. Cielo/luna (fila 0) y la banda de vientos (fila 23,
   * y=184) quedan FUERA del rectángulo 8..183 por construcción.
   *
   * 🔴 Es ESTADO, no un pulso, y CADA PIEL lo pinta LA ÚLTIMA. El original puede pintar una
   * vez y olvidarse porque nada le repinta el viewport; el port redibuja el frame entero en
   * cada evento del sueño (el reloj del panel cambia 6 veces por hora), así que sin
   * precedencia explícita la cortina duraría un frame. Ausente/false = viewport normal.
   */
  bedBlackout?: boolean;
  /**
   * ★ #295 — INVERSIÓN SOSTENIDA del interior de la ventana durante el «WELL DONE» del
   * Altar. El original hace `set_color([g_unk_13b0]=15)` + `rect(8,8,0xb7,0xb7)` con `stc`
   * (CAST2.OVL 0x0c34-0x0c41): el carry programa el Graphics Controller en función XOR, así
   * que cada píxel pasa a `índice ^ 15`. Chrome y paneles quedan fuera del rectángulo.
   *
   * 🔴 Es ESTADO y no un pulso por la MISMA razón que `bedBlackout`, pero por un mecanismo
   * distinto que conviene no confundir: aquí el rect XOR está **SUELTO** — nadie lo
   * des-invierte. Lo que restaura el viewport es el `kernel_flash(10)` de 0x0d1a, y entre
   * uno y otro sólo corren los dos barridos de altavoz de 0x0c44-0x0c85. (El otro régimen
   * del mismo idiom, el del pergamino de tiempo, sí está PAREADO —CAST2 0x0031/0x007a— y
   * por eso vive como ventana de reloj en la piel fiel y no aquí.)
   *
   * 🔴 Y por eso NO puede coincidir con `bedBlackout`: son dos modales excluyentes (el rito
   * cuelga del (E)nter en el sobremundo, la cama de un tile de pueblo). Las dos pieles
   * pintan la inversión ANTES de la cortina para que la cortina conserve la última palabra
   * que #296 le dio; si algún día coincidieran, el XOR sobre negro daría BLANCO.
   *
   * ⚠ Clase C DECLARADA: el port lo pinta con `difference` blanco, que NO es `índice ^ 15`
   * sobre la paleta — divergen los índices 6 y 9 por el brown-fix EGA (medición de #317, y
   * el detalle en el docblock de `invertViewportInterior`). Ausente/false = viewport normal.
   */
  ritualInvert?: boolean;
  /**
   * Escena de MUERTE + RESURRECCIÓN (party-wipe / refuge, BLCKTHRN 0x0910) activa, o
   * `null` fuera de ella. La monta main.ts al detectar el evento `{kind:"refuge"}` y va
   * avanzando su fase al pacear el guión. El viewport negro + figuras YA vienen horneados
   * en `window`; esto sólo lleva la fase (para el destello de "Vertigo"). Ver `RefugeSceneView`.
   */
  refugeScene: RefugeSceneView | null;
  /**
   * ESCENA del santuario / cámara del Codex activa (#277), o `null` fuera del rito. La
   * monta main.ts al pacear el guión de `core/world/shrine-scene.ts`. La rejilla 11×11 de
   * MISCMAPS.DAT y el Avatar en su celda YA vienen horneados en `window` (como el refuge);
   * esto lleva la SEÑAL + los datos crudos para quien quiera leerlos (tests, capturas).
   */
  shrineScene: ShrineSceneView | null;
  /**
   * Escena de la CAPTURA de Blackthorn activa (#324), o null/ausente fuera de ella. La
   * conduce el pacer (`setBlackthornScene`); coreview hornea apagón/sala + figuras en
   * `window` (manda sobre el modo, como las demás escenas). Ver `BlackthornSceneView`.
   */
  blackthornScene?: BlackthornSceneView | null;
  /**
   * Escena del ENDGAME (#34) activa, o ausente/null fuera del cierre. La monta y avanza
   * main.ts al pacear el guión (`setEndgameScene`); en las fases de sala coreview hornea
   * la sala verde + sprites en `window` (manda sobre mazmorra/combate, como el refuge);
   * en las de pantalla completa la piel fiel pinta el frame entero. Ver `EndgameSceneView`.
   */
  endgameScene?: EndgameSceneView | null;
  /**
   * Vista aérea de (V)iew-a-gem ABIERTA, o `null`. Es un modal transitorio (lo
   * fija main.ts al abrir/cerrar la vista). La piel fiel pinta la variante de
   * MAZMORRA (mapa 8×8 icónico, DNGLOOK 0x06a8/§4) en el viewport; el resto
   * (overworld/pueblo 32×32) lo sigue sirviendo el panel DOM (ya pixel-exacto, §11).
   */
  gemView: GemView | null;
  /** Vista de zodíaco del catalejo nocturno, o `null`. La fija main.ts al usar el catalejo;
   *  la piel la pinta en el viewport (starfield + constelación) y se cierra con cualquier tecla. */
  zodiacView?: ZodiacView | null;
  /** Fases lunares para la banda celeste, o `null` si no aplica (ver `SkyBand`). */
  sky: SkyBand | null;
  /**
   * Dirección del viento ("North"/"South"/"East"/"West") para el indicador
   * `>… Winds<` del borde inferior del viewport (F-C), o `null` si no aplica
   * (calma, interior, mazmorra, combate). Info visible del original.
   */
  wind: string | null;
  /**
   * An Tym (parar el tiempo) ACTIVO ahora (`g_time_spell=='T'`/0x54, DS:0x587A). El
   * original NO procesa a las criaturas mientras dura (`move_all_monsters` MAINOUT
   * 0x1a60 retorna en seco con este valor) → sus SPRITES SE CONGELAN. La piel lo usa
   * para NO avanzar el contador por-turno de los actores de banco alto (criaturas/NPCs/
   * party) mientras esté puesto; el TERRENO (agua/fuente/antorchas) sigue animando —
   * su reloj `advance_tile_anim_frames` 0x44b8 NO está gateado por el hechizo. Sólo se
   * expone en el snapshot de MAPA (overworld/pueblos); ausente/false = animación normal.
   * Ver `re/notes/antim-freeze.md`.
   */
  timeStopped?: boolean;
  /**
   * Moongates activas visibles como OVERLAY (seam B): la piel fiel las anima
   * SOBRE su terreno (ver `MoongateCell`); la piel dev las ignora y muestra la
   * puerta llena ya horneada en `window`. Opcional/ausente = ninguna.
   */
  moongates?: readonly MoongateCell[];
  /**
   * ¿Las moongates están ACTIVAS en el mundo ahora? (de noche hay puerta —
   * `g_moongate_anim` es un contador GLOBAL que sube al anochecer, no por
   * visibilidad). La piel usa el FLANCO de este booleano para animar la subida
   * SÓLO en la aparición (anochecer) y mantener la puerta llena mientras siga
   * activa; NO re-anima cuando un gate ya alzado entra en pantalla. Independiente
   * de si hay un gate on-screen (`moongates`) o de la localización.
   */
  moongateActive?: boolean;
  /** Fichas completas de la party para la página de Ztats (comando Z). */
  ztats: readonly ZtatsMemberView[];
  /**
   * Inventario VISIBLE para las sub-páginas de Ztats (provisiones + equipo por
   * miembro + las 4 listas, §2-6). Como `ztats`, es lo que el original despliega
   * al pulsar Z y navegar el eje de páginas; ya censurado a lo poseído (qty>0).
   */
  inventory: InventoryView;
  /**
   * Estado del comando READY (selección de jugador + overlay del picker de ítems), o
   * `null`/ausente fuera de Ready. Lo fija main.ts (`setReadyPicker`); la piel fiel lo
   * pinta sobre el panel derecho (banner + marco de pergamino + filas + cursor). Es
   * modal transitorio, como `gemView`/`campScene`. Ver `ReadyPickerView`.
   */
  readyPicker?: ReadyPickerView | null;
  /**
   * Ventana «GUEST REGISTER» de la posada (#283), o `null`/ausente fuera del (P)ick up
   * con dos o más huéspedes. Lo fija main.ts (`setInnRegister`); las pieles la pintan
   * ENMARCADA sobre el panel derecho, como el binario (SHOPPES3 0x052a-0x06c7), en vez
   * de listar letras por consola. Modal transitorio, hermano de `readyPicker`.
   * Ver `skin/fiel/innRegister.ts`.
   */
  innRegister?: InnRegisterView | null;
}

/** Suscripción de la piel al flujo del core. Todos los callbacks opcionales. */
export interface ViewListener {
  /**
   * Turno atómico terminado: eventos consumibles del turno (mensaje, moved,
   * map-changed, combate…). La piel decide su presentación: la fiel pinta
   * seco; la moderna puede animar. El core YA avanzó — no se puede vetar.
   */
  onTurn?(events: readonly GameEvent[]): void;
  /** La consola de texto cambió (nueva línea o repoblada tras swap). */
  onConsole?(lines: readonly ConsoleLine[]): void;
  /** Estado visible cambió sin turno completo (refresh de reloj/stats). */
  onDirty?(): void;
  /**
   * Una acción disparó un sonido del PC-speaker (task #3): la piel decide su
   * timbre (la fiel lo sintetiza como el speaker de 1988; una moderna podría
   * mapearlo a XMI/SFX). El core emite el cue LÓGICO (core/sfx.ts); nunca Hz.
   * Emitido por cada punto de emisión — incluidos los caminos que no pasan por
   * `onTurn` (combate, casting) — vía el adaptador (`CoreViewImpl.emitSfx`).
   *
   * ★ #208 — `leadMs`: espera de FASE del cue dentro de su lote (ms desde ahora), la
   * proyección de audio de `planTurnPhase` (los visuales que lo preceden en el lote
   * empujan su arranque, como el hilo único de 1988). 0 en todos los caminos sin lote
   * (combate, casting, ambiente). Hoy lo consume el sink de audio (`SpeakerAudio`,
   * main.ts); las pieles pueden ignorarlo — ningún cue con efecto visual propio
   * (time-spell, shop-transaction, apparition) viaja hoy con lead ≠ 0 (censo en
   * `fase-audio-208.test.ts`).
   */
  onSfx?(cue: SfxCue, leadMs?: number): void;
  /**
   * Un punto de combate resolvió un efecto EFÍMERO (proyectil/impacto/flash): la
   * piel lo anima con su reloj (F-A). Espejo de `onSfx`; lo emite `emitCombatFx`
   * desde la raíz de composición (main.ts) en los mismos puntos donde ya rutea el
   * sonido de combate. El core no conoce cadencias (Clase C).
   */
  onCombatFx?(fx: CombatFx): void;
  /**
   * ★ #373 — FX del PREFIJO CONSUMIDO de un turno CORTADO. Las cinco ramas terminales de
   * `applyEvents` (refuge, troll-sneak, shrine-scene, shrine-key-wait, endgame) saltan el
   * `notifyTurn` del final con `return`, así que los kinds de presentación que viajan en
   * el batch y sólo se enrutan en `onTurn` (quake, cell-explosion, cell-projectile) morían
   * detrás del corte — el gemelo VISUAL del hueco de audio de #371. `flushEventPrefix`
   * (main.ts) publica aquí el prefijo ya recorrido; la piel lo presenta con la MISMA
   * `planTurnPhase` que usa `onTurn` (por eso recibe el prefijo entero, sfx incluidos:
   * los cues bloqueantes del lote deciden CUÁNDO arranca cada visual). A diferencia de
   * `onTurn`, esto NO es un turno completo: nada de bookkeeping por-turno (el avance de
   * frame de actores, «un TURNO = un avance», sigue viviendo SOLO en `onTurn`).
   */
  onTurnFx?(events: readonly GameEvent[]): void;
  /**
   * Cruce de moongate: el core avisa (vía CoreView) cuando el party ya está SOBRE
   * la puerta y aún NO ha teleportado, pasando el snapshot de ORIGEN
   * (party-sobre-la-puerta, centrado). La piel congela ese frame, corre la
   * disolución + cierre de la puerta (kernel_moongate_enter 0x48a8) y DIFIERE el
   * pintado del destino hasta que termine. Presentación pura (Clase C). Se dispara
   * dentro del turno, ANTES del `onTurn` con el `map-changed` del destino.
   * `teleport` = false en el edge de medianoche (00:00-00:09): el binario cierra la
   * puerta sobre el party pero NO teleporta (0x494d salta el teleport). En ese caso
   * la piel corre SÓLO el cierre (`depart`), sin la fase de llegada al destino.
   */
  onMoongateTransit?(origin: ViewSnapshot, teleport: boolean): void;
}

/**
 * CORE VIEW — la única ventana de las pieles hacia el core. Solo lectura; solo
 * información que el original enseña. La piel no muta el core por aquí.
 */
export interface CoreView {
  snapshot(): ViewSnapshot;
  subscribe(listener: ViewListener): () => void;
  /**
   * Getter BARATO del gate de comando (== `snapshot().awaitingCommand`) para pre-gates
   * de teclado (PERF-5, auditoría rendimiento): el keyHandler de la piel fiel corría un
   * ViewSnapshot COMPLETO en cada keydown (incl. auto-repeat) sólo para leer este flag.
   * Opcional: los mocks/adaptadores sin él caen al snapshot() (misma semántica).
   */
  awaitingCommand?(): boolean;
  /**
   * main.ts publica el estado del comando READY (fase `select`/`pick`, filas, cursor)
   * a las pieles, o `null` al cerrarlo. Modal transitorio de presentación (no toca el
   * core ni el turno): la piel fiel lo pinta como overlay sobre el panel. Repinta.
   */
  setReadyPicker(view: ReadyPickerView | null): void;
  /**
   * main.ts publica la ventana REGISTER de la posada (huéspedes + cursor de la barra
   * XOR), o `null` al cerrarla. Modal de presentación pura; las pieles la pintan sobre
   * el panel derecho. Repinta. Ver `InnRegisterView`.
   */
  setInnRegister(view: InnRegisterView | null): void;
  /**
   * main.ts publica el CARTEL de un letrero (L) IMPRIMIÉNDOLO EN EL FLUJO DE LA CONSOLA
   * (como el DOS: la caja va en el log de texto, no en un overlay). Empuja una fila de
   * consola por cada fila de la caja (marco + cuerpos rúnicos), conservando el cuerpo
   * latín en `.text` para el historial y la detección e2e. `bodyLines` son las líneas
   * legibles del cartel (ya traducidas). Ver skin/fiel/sign-box.ts.
   */
  pushSignBox(bodyLines: readonly string[], raw?: readonly number[]): void;
  /**
   * AMBIENTE por proximidad (`ambient_sfx_tick` 0x4102). La piel lo llama cada tick
   * de su reloj de animación con la `phase` [0x6a34] (0..7): el adaptador lee los
   * tiles CRUDOS del viewport (como el asm, sin censura de luz), elige el animado
   * más cercano al party, EMITE su cue por el bus de sonido (`onSfx`, el mismo que
   * el resto de SFX) y lo devuelve (o `null`, p.ej. en mazmorra o sin animado cerca).
   * Devolverlo es sólo para tests; el sonido ya salió. re/notes/ambient-audio-audit.md.
   */
  ambientSfx(phase: number): SfxCue | null;
}

/**
 * INTENT — intención de usuario, independiente de dispositivo y de piel.
 *
 *  - `key`: tecla cruda del original (hoy: teclado; la botonera táctil ya
 *    sintetiza teclas). Nivel 0 de compatibilidad.
 *  - `tap-tile`: tap/click en una casilla del MAPA (coords de mapa, no de
 *    pantalla — cada piel hace su conversión pantalla→tile). Mañana el sink lo
 *    traduce contextualmente (NPC=Talk, puerta=Open, suelo=A*).
 */
export type Intent =
  | { type: "key"; key: string }
  | { type: "tap-tile"; x: number; y: number }
  /**
   * Salida de CONSOLA del juego que una piel produce por sí misma (no vía el
   * dispatcher de comandos del core). Lo usa el modal de Ztats de la piel fiel:
   * el comando Z se intercepta DENTRO de la piel (su keyHandler en captura), así
   * que no pasa por el "manejo del comando" del core; para que las líneas
   * "Z-stats..."/"Player: <nombre>"/"Status:" sean OUTPUT REAL del juego (persisten
   * en el buffer, scrollean, y aparecen en cualquier piel), la piel las emite por
   * aquí y el sink las enruta al MISMO `pushConsole` que usa el resto del juego
   * (RUTA CORE — es lo que hace el original al pulsar Z). `kind` = eco de comando
   * (con bullet ►) o mensaje.
   */
  | { type: "console"; text: string; kind?: "echo" | "message" };

/** El traductor intención→comando del dispatcher original (vive FUERA de la piel). */
export interface IntentSink {
  dispatch(intent: Intent): void;
}

/**
 * SKIN — un frontend completo e intercambiable en caliente.
 *
 * Contrato:
 *  - `mount` construye TODO su DOM/canvas bajo `root`, se suscribe a `view` y
 *    reporta la entrada de puntero como `Intent`s en `intents`.
 *  - `unmount` deshace TODO: DOM, listeners, timers, texturas. Tras unmount la
 *    piel no retiene referencias vivas (el core sigue intacto).
 *  - Una piel NUNCA muta el estado de juego ni llama métodos del core: solo
 *    `view` (lectura) e `intents` (escritura indirecta).
 *
 * Ciclo de vida (banco present()/mount() — semántica que el SkinManager asume):
 *  - `unmount` es TOLERANTE A MOUNT PARCIAL: puede llamarse sin mount previo, tras
 *    un mount que lanzó a medias, o dos veces seguidas, sin lanzar (todo teardown
 *    con guardas de null). El manager lo usa para limpiar una piel cuyo mount
 *    falló antes de re-montar la anterior (rollback R4).
 *  - Si `mount` lanza, la piel puede dejar DOM/listeners parciales bajo `root`;
 *    quien montó (el manager) DEBE llamar `unmount()` para recogerlos.
 *  - La PRESENTACIÓN (cadencia de repintado) es interna de cada piel — la fiel
 *    repinta por evento + reloj ~9 Hz (`render()`); la shader compone por rAF con
 *    gate de suciedad (`present()`). Ambas la arrancan al final de `mount` y la
 *    paran en `unmount` (y en `visibilitychange` oculto, por batería).
 */
export interface Skin {
  readonly id: string;
  mount(
    root: HTMLElement,
    view: CoreView,
    intents: IntentSink,
  ): void | Promise<void>;
  unmount(): void;
  /**
   * ¿Hay un efecto AV TRANSITORIO pintándose en ESTA piel? (#207).
   *
   * OPCIONAL a propósito: una piel puede no tener capas de fx (la `dev`, el prototipo
   * portrait). `undefined` significa «esta piel no lo declara», que NO es lo mismo que
   * `false` — quien lo consuma tiene que poder distinguirlos. El `SkinManager` lo propaga
   * como `null` y el grabador ABORTA con él; degradarlo a `false` reconstruiría en silencio
   * el defecto que #207 arregla.
   */
  readonly transientFxActive?: boolean;
}
