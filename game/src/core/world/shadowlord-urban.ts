/**
 * Shadowlords urbanos — presencia de un Shadowlord en un pueblo (F1.10-T6).
 *
 * Reglas EXACTAS del binario (TOWN.OVL + consumidores en TALK.OVL), NO una
 * aproximación. Derivación completa con citas en `re/notes/shadowlord-urban.md`.
 * Los tres Shadowlords vagan por las 8 ciudades de la virtud (g_location 1..8);
 * `shadowlordLocs[i]` (g_shadowlord_locs @ 0x58C8) = la location donde está el SL
 * i, o >= 0x80 = destruido/ausente. Al entrar a un pueblo con un SL presente:
 *
 *  1. ANUNCIO (TOWN 0x11b8): "An air of <falsehood|hatred|cowardice> doth surround
 *     thee..." + un pitido (AV). En Stonegate (loc 29 = 0x1d), su guarida, se
 *     anuncian los TRES vivos (TOWN 0x1275), sin posesión ni merma.
 *  2. SPRITE FÍSICO (TOWN 0x2ae): un actor tile 0xFC en (15, SL_SPAWN_Y[loc]).
 *  3. EFECTO por SL:
 *     - Faulinei/Falsehood (0): merma de oro en tiendas (F1.7-E, ya portada) +
 *       "Something was stolen!" al fin de cada charla (TALK 0x1180). NO posee NPCs.
 *     - Astaroth/Hatred (1): posee ~50% de los NPC-persona → dialogNumber 0xFE
 *       (hostiles: atacan / talk = ataque) + aiType 7.
 *     - Nosfentor/Cowardice (2): posee ~50% → dialogNumber 0xFD (huyen; talk =
 *       "Don't hurt me! Please go away!") + aiType 3.
 *  La posesión consume EXACTAMENTE 32 rand(0,1) del stream vivo (1 por slot, para
 *  los 32 slots) SÓLO con Astaroth o Nosfentor presente (TOWN 0x1156 → 0x10f2).
 */

import type { GameState } from "../state.js";
import type { NpcSlot } from "../npc/manager.js";
import type { RandFn } from "./survival.js";
import { shadowlordPresentIndex } from "./blackthorn.js";

/** Cualidad (string DS 0x279d/0x27a7/0x27ae) por índice de Shadowlord. */
const SHADOWLORD_QUALITIES = ["falsehood", "hatred", "cowardice"] as const;
/** Nombre propio por índice (referencia; el anuncio usa la cualidad). */
const SHADOWLORD_NAMES = ["Faulinei", "Astaroth", "Nosfentor"] as const;

/** g_location de Stonegate, la guarida (TOWN 0x1275 `cmp g_location,0x1d`). */
export const STONEGATE_LOCATION = 29;

/** El .NPC siempre tiene 32 slots; la posesión recorre los 32 (TOWN 0x1156). */
export const NPC_SLOT_COUNT = 32;

/** dialogNumber que marca el NPC poseído, por SL presente (0 = no posee). */
export const POSSESSED_DIALOG: Readonly<Record<number, number>> = { 1: 0xfe, 2: 0xfd };
/** aiType impuesto al NPC poseído (TOWN 0x85e→7 / 0x8d4→3). */
export const POSSESSED_AITYPE: Readonly<Record<number, number>> = { 1: 7, 2: 3 };

/** Columna fija del sprite del SL (TOWN 0x362: object[+2] = 0x0f). */
export const SHADOWLORD_SPRITE_X = 15;
/** Tile del sprite del Shadowlord (TOWN 0x3a1: object tile = 0xFC → atlas 0x1FC). */
export const SHADOWLORD_TILE = 0xfc;

/**
 * Fila de aparición del sprite por g_location (DATA.OVL DS:0x13a5 + loc; TOWN 0x377
 * `al = [si + 0x13a5]`, si = g_location). Indexada por g_location (1-based).
 * Volcada byte a byte de original/u5/ultima5/DATA.OVL (fileoff 0x13b5 + loc).
 */
export const SHADOWLORD_SPRITE_Y: readonly number[] = [
  /* 0*/ 0, /* 1 Moonglow*/ 4, /* 2 Britain*/ 9, /* 3 Jhelom*/ 15, /* 4 Yew*/ 8,
  /* 5 Minoc*/ 17, /* 6 Trinsic*/ 10, /* 7 Skara Brae*/ 11, /* 8 New Magincia*/ 10,
  /* 9*/ 2, /*10*/ 0, /*11*/ 3, /*12*/ 0, /*13*/ 1, /*14*/ 0, /*15*/ 1, /*16*/ 0,
  /*17*/ 2, /*18*/ 0, /*19*/ 3, /*20*/ 0, /*21*/ 3, /*22*/ 0, /*23*/ 10, /*24*/ 15,
  /*25*/ 20, /*26*/ 0, /*27*/ 15, /*28*/ 10, /*29*/ 3, /*30*/ 20, /*31*/ 15, /*32*/ 20,
];

/** Texto exacto del anuncio (TOWN 0x11b8, strings DS 0x27b8/nombre/0x27c4). */
export function announceText(idx: number): string {
  return `\nAn air of\n${SHADOWLORD_QUALITIES[idx]} doth surround thee...\n`;
}

/**
 * Índices de Shadowlord a anunciar al entrar (TOWN 0x1275 tail):
 *  - Stonegate (loc 29): los TRES vivos (shadowlordLocs[i] < 0x80), orden 2→1→0
 *    (bucle `si=2; dec; jns`). SIN posesión.
 *  - resto: el único presente (shadowlordPresentIndex), o ninguno.
 */
export function shadowlordEntryAnnouncements(state: GameState): number[] {
  const locs = state.shadowlordLocs ?? [];
  if (state.position.location === STONEGATE_LOCATION) {
    const out: number[] = [];
    for (let i = 2; i >= 0; i--) if ((locs[i] ?? 0xff) < 0x80) out.push(i);
    return out;
  }
  const idx = shadowlordPresentIndex(state);
  return idx >= 0 ? [idx] : [];
}

/** Un `type` (=tile−0x100) es person-tile si ∈ [0x40,0x74) (TOWN 0x112a/0x112f). */
export function isPersonType(type: number): boolean {
  return type >= 0x40 && type < 0x74;
}

/**
 * Gate de posesión de UN slot (TOWN 0x10f2 `town_possess_gate`). **SIEMPRE consume
 * 1 rand(0,1)** (0x1139, antes del `return`): por eso los 32 slots consumen 32
 * rands aunque estén vacíos.
 *
 * 🐛 **BUG-FOR-BUG del original (TOWN 0x111f-0x1121).** El chequeo de "person-tile"
 * NO lee el tipo del slot evaluado, sino `g_npc_type_tbl[4]` — un tipo **CONSTANTE**
 * (el del slot #4 del pueblo). El índice es `mov bx,cx` con `cx` = el contador del
 * bucle interno YA AGOTADO (=4, tras `for j=0..3`), no el slot: `si` se destruyó en
 * 0x1103 (`shl si,4`). Contraste que confirma que es un bug y no la intención:
 * `0x85e`/`0x8d4` SÍ recargan `[bp+4]` para su propio chequeo de tipo; sólo `0x10f2`
 * usa el contador. ⇒ el gate de tipo es el MISMO para los 32 slots: si el slot #4 es
 * persona pasa para todos; si no, falla para todos.
 *
 * @param present      el slot tiene horario (times != 0) — chequeo per-slot (0x1109)
 * @param slot4IsPerson `g_npc_type_tbl[4] ∈ [0x40,0x74)` — CONSTANTE del pueblo (el bug)
 */
export function possessGateRoll(present: boolean, slot4IsPerson: boolean, rand: RandFn): boolean {
  const r = rand(0, 1); // 0x1139: rand SIEMPRE, incluso para slot vacío/no elegible
  return r === 0 && present && slot4IsPerson; // 0x1145: r!=0 → 0; else presente ∧ slot4-persona
}
