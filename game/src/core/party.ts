/**
 * Reglas de party (núcleo puro, sin DOM): quién viaja con el Avatar y cómo se
 * une un NPC reclutable. `partyStatus` sigue el byte original de SAVED.GAM:
 * 0x00 = en la party, 0xFF = no unido, otro valor = descansando en una posada.
 */
import type { CharacterState, GameState } from "./state.js";
import { tf } from "../i18n/index.js";

export const MAX_PARTY = 6;

/**
 * Las DOS salidas de texto de `join_party` (TALK.OVL:0x080a), verbatim de DATA.OVL.
 * Verificadas leyendo los bytes de `original/u5/ultima5/DATA.OVL` (fileoff = DS + 0x10),
 * no del corpus extraído, y las tres ya viven traducidas en `game/src/i18n/es.json`.
 *  · DS 0x9348 + DS 0x9372 — grupo lleno (0x0824-0x0837). Van SEGUIDAS, en ese orden,
 *    y la primera lleva su espacio final: el binario las imprime con dos `print_string`
 *    consecutivos sin separador.
 *  · DS 0x93A8 — sin coincidencia (0x08b2). Es un rótulo de error de DESARROLLADOR que
 *    EA dejó en el juego publicado; se conserva como está, igual que las erratas de §3.
 */
const PARTY_FULL: readonly string[] = [
  '"Thou hast no room for me in thy party! ', // DS 0x9348
  "Seek me again if one of thy members doth leave\nthee.", // DS 0x9372
];
const NO_MATCH: readonly string[] = ["\nSystem Error -\nNo Match!"]; // DS 0x93A8

/**
 * Etiquetas legibles de clase. El binario usa la string "AMBFDTPRS" (ZSTATS
 * draw_stat_page @0x0082, DATA.OVL DS 0x9812) — 9 clases indexadas por la
 * letra del byte `class` del record:
 *   A=Avatar M=Mage B=Bard F=Fighter D=Druid T=Tinker P=Paladin R=Ranger S=Shepherd.
 */
export const CLASS_LABELS: Record<string, string> = {
  A: "Avatar",
  M: "Mage",
  B: "Bard",
  F: "Fighter",
  D: "Druid",
  T: "Tinker",
  P: "Paladin",
  R: "Ranger",
  S: "Shepherd",
};

/** Orden canónico de clases del binario ("AMBFDTPRS"). */
const CLASS_ORDER = "AMBFDTPRS";

/** Etiquetas legibles de estado (G/P/C/S/D). */
// Etiquetas de display de la tabla Ztats del binario (DATA.OVL DS 0x1a6a, líneas
// "Good Health"/"Poisoned"/"Dead"/"Asleep"/"Charmed"). VERBATIM — la piel fiel
// (skin/fiel/ztats.ts) ya usaba estas formas; se alinea el core (antes G:"Good"/
// S:"Sleeping", divergentes, sólo consumidas por el Ztats dev-DOM). El status CHAR
// 'G'/'S'/'D' de la SERIALIZACIÓN es otra cosa y NO se toca (carril guard-hardening,
// 8ª caza — staleness alineada, adjudicación del lead).
export const STATUS_LABELS: Record<string, string> = {
  G: "Good Health",
  P: "Poisoned",
  C: "Charmed",
  S: "Asleep",
  D: "Dead",
};

/**
 * ────────────────────────────────────────────────────────────────────────────
 * CONTIGÜIDAD FÍSICA DEL ROSTER (#124)
 * ────────────────────────────────────────────────────────────────────────────
 * El roster son 16 records de 32 bytes (`saveNative`: CHAR_RECORD_COUNT=16,
 * CHAR_RECORD_SIZE=32, base DS 0x55a8). El binario mantiene el invariante «los
 * `g_party_size` primeros slots SON el party» MOVIENDO LOS RECORDS, no marcando
 * flags: los bucles que recorren el party iteran slots 0..N-1 y dependen de eso
 * (catarata OUTSUBS 0x04b6, aparición 0x07fb). El clon sólo cambiaba
 * `partyStatus`, así que esos bucles golpeaban a quien se quedó en la POSADA.
 *
 * Los tres movimientos, derivados de sus cuerpos ENTEROS. En el binario cada uno
 * es un `repne movsw` de `cx=0x10` = 16 words = **los 32 bytes del record
 * COMPLETO**; el equipo (helmet/armor/weapon/shield/ring/amulet, offsets
 * +0x19..+0x1E) vive DENTRO de ese record, así que VIAJA CON EL PERSONAJE. En el
 * clon el record es el objeto `CharacterState`, de modo que mover la referencia
 * en el array es la traducción exacta (el equipo va solo).
 *
 * El array conserva SIEMPRE longitud 16: `serializeCharacter` recorre los 16
 * slots y el .GAM los escribe en orden, así que la re-indexación cambia bytes del
 * save — es el efecto pretendido, no un daño colateral.
 */

/**
 * (J)oin — TALK.OVL 0x08c8-0x0912. NO es un desplazamiento: es un SWAP a tres
 * bandas entre el que se une y el slot `g_party_size` (el primer libre):
 *   08cf  `mov byte [si+0x55c7],0`   → record[idx].partyStatus = 0  (ANTES del swap)
 *   08d6  TEMP = record[idx]                     (a la pila, ss:[bp-0x26])
 *   08f7  record[idx] = record[party_size]
 *   0908  record[party_size] = TEMP
 *   0912  `inc [g_party_size]`
 * Con el roster ya contiguo, `idx == party_size` y el swap es un no-op sobre sí
 * mismo — que es justo por lo que el defecto podía pasar desapercibido.
 */
export function rosterJoinSwap(state: GameState, idx: number): void {
  const chars = state.characters;
  const dest = state.partySize;
  const rec = chars[idx];
  if (!rec) return;
  rec.partyStatus = 0; // 0x08cf
  if (idx !== dest) {
    const other = chars[dest];
    if (other) {
      chars[dest] = rec;
      chars[idx] = other;
    }
  }
  state.partySize += 1; // 0x0912
}

/**
 * (L)eave en posada — SHOPPES3 0x03dd-0x0472. COMPACTA el roster ENTERO y manda
 * al que se queda al ÚLTIMO slot:
 *   03dd-0x0400  RE-INDEXA `g_active_char`: si idx == activo → 0xFF; si
 *                idx < activo (y activo != 0xFF) → `dec`. Es mecánica, no adorno:
 *                el índice del activo apunta a un slot que se va a mover.
 *   040f  record[idx].partyStatus = g_location
 *   0413  record[idx].monthsAtInn = 0            (+0x17)
 *   0418  TEMP = record[idx]
 *   0431-0463  bucle `15 - idx` veces: record[i] = record[i+1]  (desplaza ABAJO
 *              TODO el roster, no sólo el party)
 *   0465  record[15] = TEMP     (0x5788 = 0x55a8 + 15·32) — el hospedado al final
 *   0472  `dec [g_party_size]`
 * En array: `splice(idx,1)` (desplaza abajo) + `push` (lo deja en el índice 15).
 * La longitud 16 se conserva.
 */
export function rosterLeaveCompact(state: GameState, idx: number, location: number): void {
  const chars = state.characters;
  const rec = chars[idx];
  if (!rec) return;
  // 0x03dd-0x0400 — el activo se re-indexa ANTES de mover nada.
  const active = state.activeCharacter;
  if (active === idx) state.activeCharacter = 0xff;
  else if (active !== 0xff && idx < active) state.activeCharacter = active - 1;
  rec.partyStatus = location; // 0x040f
  rec.monthsAtInn = 0; // 0x0413
  chars.splice(idx, 1); // 0x0431-0x0463
  chars.push(rec); // 0x0465 — al slot 15
  state.partySize -= 1; // 0x0472
}

/**
 * (P)ickup en posada — SHOPPES3 0x07be-0x083a. Es la INVERSA del leave, con el
 * desplazamiento en el otro sentido:
 *   07c5  TEMP = record[idx]
 *   07e6-0x081d  bucle `idx - party_size` veces: record[i] = record[i-1]
 *                (desplaza ARRIBA, abriendo hueco en `party_size`)
 *   0829  record[party_size] = TEMP
 *   083a  `inc [g_party_size]`
 *   084c  record[party_size_viejo].partyStatus = 0   (DESPUÉS de moverlo)
 * En array: `splice(idx,1)` + `splice(partySize,0,rec)`.
 *
 * ⚠ ASIMETRÍA FIEL, no un olvido del port: el pickup **NO** re-indexa
 * `g_active_char` (no hay equivalente del bloque 0x03dd-0x0400 en este cuerpo),
 * aunque su desplazamiento también mueve slots. Se calca bug-for-bug.
 */
export function rosterPickupInsert(state: GameState, idx: number): void {
  const chars = state.characters;
  const rec = chars[idx];
  if (!rec) return;
  const dest = state.partySize;
  chars.splice(idx, 1); // 0x07e6-0x081d
  chars.splice(dest, 0, rec); // 0x0829
  state.partySize += 1; // 0x083a
  rec.partyStatus = 0; // 0x084c
}

/** Miembros que viajan con el Avatar, en orden de registro y como máximo 6. */
export function partyMembers(state: GameState): CharacterState[] {
  return state.characters.filter((c) => c.partyStatus === 0).slice(0, MAX_PARTY);
}

/**
 * Índice del PRIMER miembro consciente ('G'ood o 'P'oison) — la mitad de kernel
 * **0x39fc `party_conscious_state`** que el binario deja en `g_cmb_scratch_x`
 * (DS 0x5876, escrito en 0x3a32). Recorre `si = 0 .. g_party_size−1`. Devuelve −1
 * si no hay ninguno.
 *
 * 🔴 **ESA RUTINA PRODUCE DOS COSAS Y EL PORT LAS TENÍA EN FICHEROS DISTINTOS**, cada
 * uno con la mitad que su caller necesitaba y ninguno exportando la otra:
 *   · el **valor de retorno** (0 / 1 / −1) → `world/blackthorn.ts::partyConsciousState`;
 *   · el **índice** (`g_cmb_scratch_x`) → copia PRIVADA en `world/loops/hazards.ts`
 *     (`firstConsciousIndex`, peaje del troll del puente).
 * Ésta es la del índice, exportada, para que el tercer caller (#105, la trampa de Mix)
 * no fabricase una TERCERA copia. Las dos existentes **no son idénticas** —una acota
 * con `partySize ?? characters.length`, la otra con `partySize` y tope 6— así que NO se
 * unifican aquí: cambiar cualquiera movería el observable de su carril, y eso pide
 * su propia medida. Queda declarado, no arreglado a escondidas.
 */
export function firstConsciousIndex(state: GameState): number {
  const n = Math.min(state.partySize, MAX_PARTY); // si = 0..g_party_size−1, tope 6
  for (let i = 0; i < n; i++) {
    const s = state.characters[i]?.status;
    if (s === "G" || s === "P") return i; // 0x3a32: g_cmb_scratch_x = si
  }
  return -1;
}

/**
 * Nombre EFECTIVO de un registro del roster: el almacenado, o «Avatar» si está
 * VACÍO. FUENTE ÚNICA del fallback — todo consumidor (paneles, ecos de selección,
 * saludos de conversación Y el comparador de AskName) debe pasar por aquí, para que
 * lo que el jugador VE sea exactamente lo que CASA al teclearlo.
 *
 * Es ROBUSTEZ del port, no fidelidad: en 1988 este estado NO EXISTE — INIT.GAM trae
 * el registro 0 con el campo de nombre a ceros (medido: bytes 0x02-0x0a = 00×9),
 * pero el estado es INALCANZABLE en juego: la creación teclea el nombre DIRECTO al
 * registro (FONT.OVL 0x0bc4-0x0bcc `getstring(0x55a8, max 8)`) y si queda vacío
 * ABORTA (0x0bcf `cmp byte [0x55a8],0` / 0x0bd6 salta fuera), y la propia intro usa
 * ese byte como predicado de «hay personaje» (INTRO.OVL 0x0ec9: nombre vacío ⇒
 * «No active game» y no sale del menú). En el port sí:
 * `createNewGame(init)` sin `creation` (game.ts:1010, ?nointro, demo) copia la
 * plantilla verbatim. Sin fuente única, el bucle del trono de Blackthorn (24-08):
 * el panel decía «Avatar» (fallback de display) y el comparador careaba contra ""
 * — nada casaba jamás y el label 4 re-preguntaba el nombre PARA SIEMPRE.
 */
export function effectiveName(name: string | undefined): string {
  return name?.trim() || "Avatar";
}

/** Nombre del Avatar (record de clase 'A'), con fallback si aún no tiene nombre. */
export function avatarName(state: GameState): string {
  const avatar = state.characters.find((c) => c.class === "A") ?? state.characters[0];
  return effectiveName(avatar?.name);
}

/**
 * Nombres EFECTIVOS del grupo en orden de ranura — el contexto del reto de AskName
 * (TALK 0x0eb0 recorre 0..g_party_size). Vive aquí y no inline en talk-console para
 * que el testigo (blackthorn-trono-nombre.test) ejercite el MISMO constructor que
 * la conversación viva consume.
 */
export function partyEffectiveNames(state: GameState): string[] {
  return partyMembers(state).map((c) => effectiveName(c.name));
}

/**
 * Desenlace del alistamiento, CALCADO de las salidas de `join_party`
 * (TALK.OVL:0x080a-0x0938). El binario sólo tiene TRES, y dos de ellas se
 * distinguen por algo más que el texto: **si la conversación sigue o termina**.
 *
 *  - `"full"`     — 0x081d `cmp byte [g_party_size],6` / `jne`: imprime DS 0x9348 +
 *                   DS 0x9372 y **devuelve 0 ⇒ LA CONVERSACIÓN SIGUE**. Es la única
 *                   de las tres que no la corta.
 *  - `"no-match"` — 0x08a4-0x08c5: emite `"` + `\n`, imprime DS 0x93A8 y **devuelve 1
 *                   ⇒ TERMINA**. Es un mensaje de error de desarrollador que viaja en
 *                   el juego publicado; se conserva verbatim (registro §2.7 hermano).
 *  - `"joined"`   — 0x08c8-0x0930: hace el swap y **devuelve 1 ⇒ TERMINA**, y ★ NO
 *                   IMPRIME NADA PROPIO. El texto de despedida, si lo hay, lo pone el
 *                   guion del `.TLK`, no el handler.
 *  · `"already"`  — el NPC YA está en la party (bug 1, carril talk-celda-paginacion).
 *                   En el binario esta vía toma el camino FOUND (el barrido 0x086d-0x08a2
 *                   recorre las ranuras 15..1 SIN mirar partyStatus, y un miembro alistado
 *                   vive en 1..partySize−1 ⇒ lo encuentra): swap corrupto (Clase C, ver
 *                   joinByName) + `ret 1` SIN texto propio + despawn del NPC del mapa
 *                   (0x0916 `push [0xbcdc]; call 0xbb86` = TOWN 0x0052 npc_dead_bit_set ·
 *                   0x091d `call 0xbb92` = TOWN 0x00B0 npc_clear_slot). El port calca los
 *                   OBSERVABLES (silencio, fin de conversación, despawn) y NO la
 *                   corrupción del roster. La salida «no-match» que había aquí imprimía
 *                   DS 0x93A8 «System Error - No Match!» en una vía donde el binario NO
 *                   lo imprime jamás (evidencia: captura carcel-talk-error.jpeg — Gorn
 *                   reclutado, celda de Blackthorn, T→yes → System Error).
 */
export type JoinOutcome = "joined" | "full" | "no-match" | "already";

export interface JoinResult {
  ok: boolean;
  outcome: JoinOutcome;
  /**
   * Las líneas a emitir por consola, UNA POR CADENA DEL BINARIO. 🔴 Van separadas a
   * propósito: DS 0x9348 y DS 0x9372 son DOS claves distintas del corpus de traducción
   * (`game/src/i18n/es.json`), y concatenarlas dejaría el compuesto sin casar el choke
   * `t()` — la trampa del composite-choke que ya mordió en `seeCompose`. El binario
   * también las imprime con dos `print_string` consecutivos, así que separarlas es
   * además lo fiel. Vacío en el caso de éxito: el handler no imprime nada propio.
   */
  messages: readonly string[];
  /** Forma de una línea, SÓLO para diagnóstico (el arnés del espejo la interpola en
   *  `resyncs`, que es bookkeeping del runner y no la transcripción comparada). */
  message: string;
}

/**
 * Intenta unir a la party al character llamado `name` (case-insensitive).
 *
 * 🔴 LAS CADENAS SON LAS DEL BINARIO. Antes emitía cuatro frases inventadas
 * («{}? I know of no such person.», «{} is already in thy party.», «Thy party is
 * full.», «{} joins thee!») y **las cuatro dan CERO ocurrencias en un barrido
 * binario sobre los 125 ficheros de `original/u5/ultima5/`**; la del binario
 * (`no room for me`) sí aparece, en DATA.OVL. Eran texto fabricado, y además
 * inventaban una RAMA («ya está en tu grupo») que el binario no tiene.
 * Registro: `docs/bugs-del-original.md` §2.7 (hermano del huevo de pascua).
 *
 * ⚠ CLASE C DECLARADA — la rama «ya está en la party». El binario NO la tiene: su
 * barrido va por las ranuras 15..1 y un miembro ya alistado vive en 1..partySize−1,
 * así que **lo encontraría** y haría el swap contra la ranura `partySize`,
 * duplicando su record y perdiendo el de destino. Es un defecto latente del
 * original que NO se calca: corromper el roster no es fidelidad observable, es
 * pérdida de datos. Se guarda, **sin inventar texto** — sale por `already` (silencio +
 * fin, los observables de la vía found del binario). ~~sale por `no-match`~~ — TACHADO
 * (bug 1 talk-celda-paginacion): esa elección imprimía DS 0x93A8 «System Error» en una
 * vía donde el binario no lo imprime (su no-match exige nombre AUSENTE del roster), y
 * era alcanzable en vivo porque el port no despawneaba al NPC alistado (captura
 * carcel-talk-error.jpeg: Gorn reclutado seguía en su celda).
 */
export function joinByName(state: GameState, name: string): JoinResult {
  const key = name.trim().toLowerCase();
  const record = state.characters.find((c) => c.name.toLowerCase() === key);
  // TALK 0x08a4: sin coincidencia en el roster → DS 0x93A8 y la conversación TERMINA.
  if (!record) {
    return { ok: false, outcome: "no-match", messages: NO_MATCH, message: NO_MATCH[0]! };
  }
  if (record.partyStatus === 0) {
    // Ver Clase C arriba y el bloque de `"already"` en JoinOutcome: el binario ENCUENTRA
    // al miembro (su barrido 0x086d no filtra por partyStatus) y sale por la vía found
    // (`ret 1`, sin texto, con despawn del NPC del mapa) — la corrupción del swap NO se
    // calca; el «System Error» (DS 0x93A8) que salía aquí era texto que el binario no
    // imprime en esta vía (bug 1 talk-celda-paginacion, captura carcel-talk-error.jpeg).
    return { ok: false, outcome: "already", messages: [], message: "" };
  }
  // TALK 0x081d: grupo lleno → las dos cadenas y la conversación SIGUE.
  if (partyMembers(state).length >= MAX_PARTY) {
    return { ok: false, outcome: "full", messages: PARTY_FULL, message: PARTY_FULL.join("") };
  }
  // El binario no marca un flag: hace el SWAP físico al slot `g_party_size` para
  // conservar la contigüidad (TALK 0x08c8-0x0912). Ver rosterJoinSwap (#124).
  const idx = state.characters.indexOf(record);
  rosterJoinSwap(state, idx);
  // TALK 0x08c8-0x0930: el handler NO imprime nada propio al alistar. Lo que se lee
  // en pantalla lo pone el guion del .TLK antes de ejecutar el opcode.
  return { ok: true, outcome: "joined", messages: [], message: "" };
}
