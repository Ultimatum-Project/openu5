/**
 * Aplicación de los efectos de conversación (núcleo puro, sin DOM).
 *
 * Reglas EXACTAS del intérprete de opcodes TLK (TALK.OVL, re/notes/npc.md §9):
 *  - KarmaPlusOne  (0x89): `karma = min(karma+1, 99)`, cap 99
 *    (kernel 0x7F70 [= CS 0x3ef0 → ULTIMA.EXE:0x3ef0 add_byte_clamped_ceiling]).
 *  - KarmaMinusOne (0x8A): `karma = max(karma-1, 0)` — DERIVADO (#283): el call
 *    `0x7FB6` de TALK es target CRUDO (base de TALK 0xBF80, seg propio 0xBF8) y
 *    resuelve a ULTIMA.EXE:0x3f36 `byte_sub_saturating`: si valor <= decremento,
 *    `mov byte ptr [bx], 0` (0x3f4c) — FLOOR 0 por escritura literal, sin wrap;
 *    si no, `sub [bx], al` (0x3f48). El clamp a 0 del clon es byte-fiel. ⚠ El
 *    «kernel 0x7FB6» de la nota vieja era la MISMA convención de offset crudo que
 *    el 0x7F70 de arriba (que sí llevaba su resolución entre corchetes) — y ese
 *    número coincide por azar con un stub PLINK del kernel, la pista falsa que
 *    retrasó esta derivación (medición completa en la tarjeta #283).
 *  - gold-demand   (§9.1, 0x05B5): el NPC pide una cantidad concreta; cobra sólo
 *    si `g_gold >= n`, si no responde `"Thou hast not enough gold!"` y NO cobra
 *    (rama 0x0652: char 0x22 + DS 0x9328 → DATA.OVL fileoff 0x9338 + char 0x22
 *    + DS 0x9344 `\n\n`; el «Thou hast not enough!» previo era FABRICADO, de la
 *    nota truncada npc.md §9.1).
 *  - JoinParty     (§9.2, 0x080A): máx 6; si está llena el clon responde "Thy
 *    party is full." (el binario dice "Thou hast no room!" — mismo efecto).
 *  - CallGuards    (0x8B): SIN mensaje (0x0958 no imprime) y sin cerrar la charla
 *    (0x0ffb `jmp 0xf5e`); señala `alarm` y la materializa `Game.talkCallGuards`.
 *    ⚠ La línea vieja («marca hostilidad (mensaje aquí; spawn en Task 3.9/3.10)»)
 *    era rancia por los dos lados: el mensaje se retiró en 2026-07-22 por fabricado
 *    y la hostilidad no se marcaba en ninguna parte — ver `EffectResult.alarm`.
 *  - giveItem      (§9.3): regalo de ítem por código TLK — `grant_item` 0x0682. Lane de
 *    equipo (code<0x40 → equipmentQuantities) + jump table A..K (food/gold/keys/gems/
 *    torches/skull-keys + flags sextante/catalejo/insignia). F (garfio)=carril ch16.
 *    ⚠ La frase «G (alfombra, sin contador) queda sin cablear» quedó RANCIA: el contador
 *    existe y `applyGiveItem` case 6 lo cablea (state.magicCarpets, dead-in-data — 0 NPCs
 *    lo emiten, pero mapeado); la línea 154 ya lo decía y ésta no se actualizó. Ver
 *    `applyGiveItem`.
 *
 * `Conversation` sólo EMITE los efectos; su aplicación al estado del juego vive
 * aquí para poder testearla sin la capa de UI (main.ts la invoca).
 */
import type { GameState } from "../state.js";
import { joinByName } from "../party.js";
import { addByteCapped, addWordCapped } from "../counters.js";
import type { DialogueEffect } from "./conversation.js";

export interface EffectResult {
  /** Mensajes a mostrar al jugador (0..n). */
  messages: string[];
  /** true si el efecto terminó la conversación (JoinParty exitoso, End). */
  ended: boolean;
  /**
   * JoinParty (bug 1 talk-celda-paginacion): el NPC hablado debe DESAPARECER del mapa —
   * el calco de la cola de la vía found del binario (TALK 0x0916 `push [0xbcdc]; call
   * 0xbb86` = TOWN 0x0052 `npc_dead_bit_set` + 0x091d `call 0xbb92` = TOWN 0x00B0
   * `npc_clear_slot`). Este módulo es núcleo puro sin NpcManager: aquí sólo se SEÑALA;
   * lo materializa la capa que conoce al NPC vivo (talk-console → Game.despawnJoinedNpc).
   */
  despawnNpc?: boolean;
  /**
   * CallGuards (0x8B): la ALARMA DEL PUEBLO debe sonar — TALK.OVL 0x0ff8
   * `e85bab call 0xffffbb56` [= CS 0x7ad6 → TOWN.OVL 0x0958 `town_alarm_all_npcs`],
   * verificado en crudo; el cuerpo entero, en npc.md §9.bis. Núcleo puro sin
   * NpcManager: aquí sólo se SEÑALA; lo materializa talk-console →
   * Game.talkCallGuards (mismo patrón que despawnNpc). Sin esto, el «Guards! Seize
   * this infidel!» de Blackthorn era prosa hueca: la charla seguía y NADA pasaba
   * (reporte del usuario, 25-08).
   */
  alarm?: boolean;
}

const KARMA_MIN = 0;
const KARMA_MAX = 99;

/**
 * D10 — LIMOSNA AL MENDIGO (TALK.OVL 0x05f9-0x064e, la rama hermana de `05f7: jg 0x652`).
 * Tras COBRAR el oro, el binario recorre TRES guardas antes de tocar el karma:
 *
 *   0603-0613: bx = [0xbcdc]<<4 → [bx+0x5f6a]<<3 → al = [bx + 0x5c5a]   (tile del actor)
 *   0617: and al, 0xfc  / 0619: cmp al, 0x6c / 061b: jne 0x64e   ← ¿MENDIGO? (0x6c..0x6f)
 *   061d: cmp byte ptr [g_turn_count], 0x64 / 0622: jb 0x64e     ← ★ COOLDOWN ≥ 100 turnos
 *   0624: mov byte ptr [g_turn_count], 0                          ← y lo REINICIA
 *   0629-0635: push &g_karma(0x5888) / push 1 / push 0x63 / call → CS 0x3ef0
 *              `add_byte_clamped_ceiling`  ⇒ karma += 1, techo 99
 *   0638: cmp word ptr [g_gold], 0 / 063d: jne 0x64e
 *   063f-064b: mismo add con delta 2       ⇒ +2 MÁS si el oro quedó EXACTAMENTE a 0
 *
 * ⚠ La seña heredada (pool-174-acta §4.1 D10) listaba el sprite, el reset del contador y
 * los dos `call 0x7f70`, pero SE DEJABA el `cmp [g_turn_count],0x64 / jb` que los gatea.
 * Sin esa guarda el karma se farmea: una limosna por turno sube karma sin límite. Es la
 * guarda la que convierte la limosna en un acto con coste temporal.
 *
 * `g_turn_count` (DS 0x588b) = `state.turnsSinceStart`, que el port SÍ avanza en vivo
 * (`survival.ts` turnHousekeeping) con una divergencia ya declarada allí: el original
 * satura a 255 y el clon no. Para este gate (≥100) la saturación no cambia el veredicto.
 */
const BEGGAR_TILE_BASE = 0x6c; // 0x0619 `cmp al, 0x6c` tras `and al, 0xfc` ⇒ 0x6c..0x6f
const ALMS_KARMA_COOLDOWN = 0x64; // 0x061d `cmp byte ptr [g_turn_count], 0x64` = 100 turnos

function applyBeggarAlmsKarma(state: GameState, npcTile: number | undefined): void {
  if (npcTile === undefined) return; // sin tile no se puede evaluar 0x0619; no se inventa
  if ((npcTile & 0xfc) !== BEGGAR_TILE_BASE) return; // 0x0619/0x061b
  if (state.turnsSinceStart < ALMS_KARMA_COOLDOWN) return; // 0x061d/0x0622
  state.turnsSinceStart = 0; // 0x0624
  state.karma = addByteCapped(state.karma, 1, KARMA_MAX); // 0x0635
  // 0x0638: el +2 extra sólo si la limosna dejó el oro EXACTAMENTE a cero.
  if (state.gold === 0) state.karma = addByteCapped(state.karma, 2, KARMA_MAX); // 0x064b
}

/**
 * Aplica un efecto de diálogo al estado. `npcName` es el nombre del NPC con quien se
 * habla (para JoinParty, que busca el record por nombre); `npcTile` es su byte de sprite
 * (NpcRuntime.type), que sólo mira el gate de mendigo de D10.
 */
export function applyDialogueEffect(
  state: GameState,
  effect: DialogueEffect,
  npcName: string,
  npcTile?: number,
): EffectResult {
  switch (effect.kind) {
    case "karma": {
      // +1 con cap 99 (0x89); −1 con floor 0 (0x8A).
      state.karma = Math.max(KARMA_MIN, Math.min(KARMA_MAX, state.karma + effect.delta));
      return { messages: [], ended: false };
    }

    case "gold": {
      // Extorsión/donación: cobra la cantidad concreta sólo si hay fondos.
      const amount = Math.max(0, effect.amount | 0);
      if (state.gold >= amount) {
        state.gold -= amount;
        // D10 (TALK 0x0603-0x064e): la limosna a un MENDIGO da karma, con cooldown.
        applyBeggarAlmsKarma(state, npcTile);
        return { messages: [], ended: false };
      }
      // TALK 0x0652-0x0670: putchar '"' (0x0657 `mov ax,0x22` → 0x573a) + print DS
      // 0x9328 + putchar '"' (0x0665) + print DS 0x9344 '\n\n' (espaciado de consola).
      // ⚠ ERRATA CORREGIDA (#37): este comentario decía que las comillas «van en el
      // literal». NO van: DATA.OVL fileoff 0x9338 es `Thou hast not enough gold!` PELADO
      // — los dos glifos son putchars. El port los pliega dentro de la key del corpus, y
      // eso es SEGURO aquí porque la key lleva los DOS (la traducción provee `«` y `»`):
      // no queda ningún glifo que componga el código, así que no entra en la familia de
      // `quoteOpen()`/`quoteClose()`.
      return { messages: ['"Thou hast not enough gold!"'], ended: false };
    }

    case "joinParty": {
      // TALK 0x080a. Las salidas del binario, cada una con SU efecto sobre el flujo:
      //  · "full"     (0x081d) → DS 0x9348 + DS 0x9372 y `ret 0`  ⇒ LA CONVERSACIÓN SIGUE
      //  · "no-match" (0x08a4) → DS 0x93A8            y `ret 1`  ⇒ TERMINA (sin despawn:
      //    esa vía salta a 0x0933 sin pasar por los calls de 0x0916/0x091d)
      //  · "joined"   (0x08c8) → sin texto propio     y `ret 1`  ⇒ TERMINA + DESPAWN del
      //    NPC del mapa (0x0916 npc_dead_bit_set + 0x091d npc_clear_slot, vía [0xbcdc])
      //  · "already"  (port; en el binario cae en la vía found 0x08c8 — ver JoinOutcome)
      //    → sin texto y `ret 1` ⇒ TERMINA + DESPAWN, sin calcar el swap corrupto.
      // Las líneas viajan SEPARADAS (una clave de corpus cada una) — ver JoinResult.
      const result = joinByName(state, npcName);
      return {
        messages: [...result.messages],
        ended: result.outcome !== "full",
        despawnNpc: result.outcome === "joined" || result.outcome === "already",
      };
    }

    case "callGuards":
      // SIN mensaje (ruling 2026-07-22, la mitad que SOBREVIVE al careo de §9.bis:
      // cero prints en los 99 bytes de TOWN 0x0958 — el «The guards have been
      // called!» era QoL fabricado y sigue retirado). Pero «SOLO flag» quedó
      // REFUTADO en §9.bis: el handler TALK 0x0ff8 llama a `town_alarm_all_npcs`
      // (guardias {0xfc,0xd8,0x70} → aiType 6/7 HOSTIL con horario borrado; cada
      // NPC normal presente → 1 rand(0,255) SIEMPRE y con r<0x80 → aiType 3 huida
      // + dialogNumber 0xFD) y la charla SIGUE (0x0ffb jmp 0xf5e — el cierre lo
      // pone el EndConversation del guion). Se señala `alarm` y lo materializa
      // Game.talkCallGuards → NpcManager.arrestAlarm, que es el port de ESA rutina
      // (0x0958) y ya servía a otras dos vías: ver el docstring de talkCallGuards.
      return { messages: [], ended: false, alarm: true };

    case "giveItem":
      return applyGiveItem(state, effect.item);

    case "end":
      return { messages: [], ended: true };

    default:
      return { messages: [], ended: false };
  }
}

/**
 * Regalo de ítem por NPC — TALK.OVL `grant_item` 0x0682. El código es el BYTE crudo del
 * opcode `Change` del TLK. NO imprime mensaje (la prosa "thou dost receive…" va en el
 * TEXTO del propio NPC, no en el dispatcher). Dos lanes del binario:
 *  - **code < 0x40** (0x068b): +1 al slot de EQUIPO `equipmentQuantities[code]`, cap 99
 *    (kernel byte-capped 0x7f70 [= CS 0x3ef0 → ULTIMA.EXE:0x3ef0]). NPCs: Thrud (data=8, data=28).
 *  - **code ≥ 0x41** (0x06a2): índice `code−0x41` en la jump table A..K (11 entradas,
 *    file 0x070e). Cada uno suma a su contador/flag del port (offsets DS 0x57A8-0x57BE,
 *    que espejan .gam 0x202-0x218). Tabla completa en re/notes/npc.md §9.3.
 * Fuera de rango (>K) = no-op (el binario cae por 0x0724). El clon emitía `giveItem`
 * pero effects.ts lo dejaba en NO-OP ("Task 3.6+") → TODO regalo por Talk estaba muerto.
 * SELLOS: ningún capítulo del Grand Tour dispara un `Change` A..K (ch08 EVITA la trampa
 * 'key' de Jeremy), así que cablearlo no altera sellos.
 *
 * TODOS los códigos con campo en el port van cableados (A..K salvo el inexistente).
 * G (carpet) → `state.magicCarpets++` (dead-in-data: ningún NPC lo emite, pero la
 * alfombra SÍ tiene contador — corregida la nota previa de "sin campo"). F (garfio) →
 * `state.grapple=true` (Lord Michael, Empath Abbey).
 */
function applyGiveItem(state: GameState, code: number): EffectResult {
  if (code < 0x40) {
    // Lane de equipo (0x068b): equipmentQuantities[code] += 1, cap 99.
    if (code >= 0 && code < state.equipmentQuantities.length) {
      state.equipmentQuantities[code] = addByteCapped(state.equipmentQuantities[code] ?? 0, 1);
    }
    return { messages: [], ended: false };
  }
  switch (code - 0x41) {
    case 0: state.food = addWordCapped(state.food, 1); break;       // A — food 0x57A8 (word, cap 9999)
    case 1: state.gold = addWordCapped(state.gold, 1); break;       // B — gold 0x57AA (word, cap 9999)
    case 2: state.keys = addByteCapped(state.keys, 1); break;       // C — keys 0x57AC (byte, cap 99)
    case 3: state.gems = addByteCapped(state.gems, 1); break;       // D — gems 0x57AD
    case 4: state.torches = addByteCapped(state.torches, 1); break; // E — torches 0x57AE
    case 5: state.grapple = true; break;                           // F — grapple 0x57AF (Lord Michael, Empath Abbey)
    case 6: state.magicCarpets = addByteCapped(state.magicCarpets, 1); break; // G — carpet 0x57B0 (dead-in-data: 0 NPCs lo emiten, pero mapeado)
    case 7: state.specialItems.sextant = true; break;              // H — sextant flag 0x57BC
    case 8: state.specialItems.spyglass = true; break;             // I — spyglass flag 0x57BA
    case 9: state.specialItems.blackBadge = true; break;           // J — black badge flag 0x57BE
    case 10: state.skullKeys = addByteCapped(state.skullKeys, 1); break; // K — skull keys 0x57B1
    default: break; // >K (fuera de rango) o F/G: no-op
  }
  return { messages: [], ended: false };
}
