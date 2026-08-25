/**
 * Encuentros con GUARDIAS — password del Palacio (TALK.OVL 0x01e2/0x02a4, F1.7-T3)
 * + tributo/arresto en pueblo (TALK 0x01e2 / TOWN 0x12ae, F2-T4) — extraídos de
 * la clase Game (TRAMO 3 del refactor estructural, auditoría ARQ-3). El MOTOR
 * puro (guardDemand/guardArrestJail/guardTributeAmount…) ya vivía en
 * world/blackthorn.ts; aquí va la ORQUESTACIÓN (trigger de adyacencia, prompts,
 * resolución Y/N) con contexto estrecho. Game delega (fachada, firmas intactas)
 * y posee el holder de prompts pendientes. Comentarios-cita ÍNTEGROS.
 */
import type { GameState } from "../state.js";
import type { GameEvent } from "../game.js";
import type { NpcManager, NpcRuntime } from "../npc/manager.js";
import type { RandFn } from "./survival.js";
import { scheduleIndex } from "../time.js";
import { SHOP_CLOSED_MESSAGE, shopIsOpen } from "./shop-hours.js";
import {
  LOC_BLACKTHORN,
  LOC_MINOC,
  PALACE_GUARD_TYPE,
  guardArrestJail,
  guardDemand,
  guardTributeAmount,
  TIME_SPELL_BADGE,
} from "./blackthorn.js";
import { isPersonType } from "./shadowlord-urban.js";

/** Prompts de guardia pendientes (los posee Game; el módulo los arma/consume). */
export interface GuardPromptHolder {
  /**
   * Reto de password de un guardia del Palacio pendiente de respuesta (TALK 0x02a4).
   * Máquina de una sola ronda (patrón Words of Power / interrogatorio) que
   * `submitGuardPassword` consume; `null` fuera del reto. El ORIGEN importa porque
   * decide qué pasa al FALLAR:
   *  - `"talk"` — lo armó el comando (T)alk sobre el guardia.
   *  - `"interception"` — lo armó la pasada de NPCs (T-A): el guardia adyacente
   *    ejecutó `guard_demand` y el fallo ESCALA a captura (ret 1 → npc_engine
   *    0x13d6 → TOWN 0x12ae).
   */
  password: null | { from: "talk" | "interception" };
  /**
   * Demanda de tributo/caridad de un guardia de pueblo pendiente de Y/N (F2-T4,
   * TALK 0x01e2 vía npc_engine TOWN 0x13ce). Se arma cuando un guardia extorsionador
   * (dialogNumber 0xFF, aiType 4/5 del tramo horario) queda ADYACENTE al party en un
   * pueblo (loc != 0x12); `resolveGuardTribute` lo consume. null fuera del prompt.
   * `npcSlot` = el `[0x65bf]` de ese turno (el guardia activo): la escalada lo
   * arrastra al prompt de arresto, porque el tail de npc_engine (0x13dc) ataca con
   * ESE índice si el arresto se rehúsa.
   */
  tribute: { kind: "tribute" | "charity"; npcSlot?: number } | null;
  /**
   * Arresto pendiente de respuesta Y/N — «Wilt thou come quietly?» (F2-T4, TOWN
   * 0x12ae rama pueblo, 0x12d8-0x1346). Se arma cuando la demanda escala (ret 1 del
   * handler TALK 0x01e2: rehúsas o aceptas sin oro) o cuando un guardia YA HOSTIL
   * (aiType 6/7, rama npc_engine 0x13a4 tile 0x70) alcanza al party.
   * `resolveGuardArrest` lo consume. false fuera del prompt.
   * `npcSlot` = el guardia activo (`[0x65bf]`), o null si el prompt llegó por una
   * vía que no lo conoce: el 'N' dispara el tail de ataque de npc_engine (0x13dc)
   * contra ESE guardia — «\nAttacked!\n» + combate + ranura fuera (0x09BC).
   */
  arrest: false | { npcSlot: number | null };
}

export interface GuardCtx {
  state: GameState;
  npcManager?: NpcManager | null;
  rand: RandFn;
  targetCoord(dir: string): { nx: number; ny: number };
  prompts: GuardPromptHolder;
  /**
   * T-A — corre la ESCENA de captura del Palacio (TOWN 0x12ae) cuando el reto de la
   * intercepción se falla. Lo inyecta Game; sin él, el fallo se queda sin escalada.
   */
  runCapture?: () => GameEvent[];
  /**
   * #301 — ¿este NPC tiene rama de CONVERSACIÓN GUIONIZADA (0 < dlgNum < 0x80, TALK
   * 0x0396 `run_scripted_conversation`)? Lo inyecta Game con el MISMO `talkScriptFor`
   * que sirve al comando (T)alk: el gate por dlgNum es UNO, no una copia por vía.
   * Ausente ⇒ la intercepción no abre conversaciones (comportamiento previo a #301).
   */
  talkScriptFor?: (npc: NpcRuntime) => boolean;
  /**
   * #304 — la guarda del caballo del mercader (TALK 0x00ed; la ficha #170 del port),
   * inyectada por Game con la MISMA pieza que sirve al comando (T)alk. Va inyectada y
   * no escrita aquí porque su predicado es sobre el TRANSPORTE, no sobre el encuentro.
   * `null` ⇒ el mercader atiende (vas a pie, o es el HorseSeller 0x83, la excepción).
   * Ausente ⇒ la intercepción no aplica la guarda; un test que no la pase está
   * declarando que la party va a pie.
   */
  mountedMerchantRefusal?: (npc: NpcRuntime) => GameEvent[] | null;
  /**
   * El ATAQUE de un NPC hostil — el tail `[bp-2]=1` de npc_engine (TOWN 0x13dc-0x1414):
   * «\nAttacked!\n» (DS 0x2881, CON su \n de cabecera — ≠ el 0x2882 del sobremundo) +
   * `town_attack_engine_commit` 0x09BC = combate contra el actor (`enter_combat_vs_actor`
   * ULTIMA.EXE 0x6150) y su ranura FUERA. Lo inyecta Game (necesita startCombat).
   * Ausente ⇒ el hostil no-guardia no ataca (la conducta previa al fix — el softlock
   * de las gárgolas del Palacio).
   */
  hostileNpcAttack?: (npc: NpcRuntime) => GameEvent[];
}

/**
 * Reto del guardia (DS 0x90fc, entre comillas 0x2ae/0x2bc + "Your response?"
 * 0x9128), byte-exacto de DATA.OVL (fileoff = DS+0x10). "bearer of the Badge!"
 * confirma que el gate del handler (g_time_spell==0x1d, 0x587a) es el Black Badge.
 */
const GUARD_PASSWORD_CHALLENGE =
  '"Give now the\npassword, bearer\nof the Badge!"\n\nYour response?';
/** Acierto: DS 0x913a "Pass, friend!" (entre comillas 0x2f9/0x307). */
const GUARD_PASS_FRIEND = '"Pass, friend!"';

/**
 * #304 — la familia de TENDEROS en el reparto por `dlgNum` de TALK 0x031E. Los dos
 * extremos son DERIVADOS, no elegidos: el bajo es el `cmp word ptr [bp-2],0x80 / jge`
 * de 0x0396 (por debajo van los scripts .TLK, #301), y el alto es el ÚLTIMO valor que
 * no reclaman los tres handlers propios de arriba — 0xFD «Don't hurt me!» (0x03a6),
 * 0xFE el poseído (0x03cc) y 0xFF el guardia (0x03d8). Lo que sobra, 0x80..0xFC, cae
 * en 0x03e4 = la rama de tienda. Mismo par de cotas que censa `#315`.
 *
 * ⚠ El rango es MÁS ANCHO que los ocho tipos que el port sabe abrir (`SHOP_TYPES`,
 * 0x81-0x88) y lo es TAMBIÉN en el binario: `0xe6` hace `ax = dlgNum − 0x81` y sale
 * por `cmp ax,7 / ja 0x1da` sin abrir nada. O sea que 0x80 y 0x89..0xFC atraviesan el
 * gate horario y la guarda del caballo y NO abren tienda — y ésa es la conducta fiel.
 * En los datos de hoy no existe ninguno (censo: los 46 tenderos son 0x81-0x88).
 */
const SHOPKEEPER_LO = 0x80;
const SHOPKEEPER_HI = 0xfc;

/** DS 0x281b (DATA.OVL fileoff 0x282b): eco 'Y' + inconsciencia (TOWN 0x12fa). */
const ARREST_UNCONSCIOUS = "Yes\n\nThe guard strikes thee unconscious!\n";
/** DS 0x2845 (fileoff 0x2855): despertar (TOWN 0x1307), antes del teletransporte. */
const ARREST_AWAKEN = "\nThou dost awaken to...\n";
/** DS 0x285e (fileoff 0x286e): eco 'N' + desafío (TOWN 0x133c) — dispara la alarma 0x958. */
const ARREST_DEFEND = 'No\n\n"Then defend thyself, rogue!"\n';

/**
 * Comando (T)alk sobre un GUARDIA del Palacio (TALK 0x01e2, dialogNum 0xFF). Los
 * guardias NO tienen TLK script: los sirve el handler hardcodeado. En loc 0x12
 * (Palacio) retan por el password (0x02a4) — la vía de escape del bucle de
 * captura. Devuelve el prompt de texto (patrón Words of Power) y arma la máquina
 * `password`, o `null` si no hay guardia adyacente / no es el Palacio
 * (los guardias de Minoc/tributo, misma tabla, quedan sin cablear — piezas aparte).
 *
 * Gate previo (#277): `g_time_spell==0x1d` = Black Badge PUESTA (único escritor:
 * (U)se Badge, CAST.OVL 0x1b47 tras "Badge worn!"). El cmp (TALK 0x02a4) corre
 * ANTES del print del reto (0x2ae): sin insignia `jmp 0x216` = `mov ax,1 / ret` —
 * ret 1 SILENCIOSO, el guardia ni pregunta. Aquí se devuelve `[]`: talk consumido
 * (el handler corrió), nada impreso, máquina sin armar; la hostilidad del caller
 * ante ret 1 es opaca y no se fabrica, igual que en el password fallido. El
 * caller de UI llama esto ANTES de `talkTarget`.
 */
export function tryTalkGuard(ctx: GuardCtx, dir: string): GameEvent[] | null {
  const pos = ctx.state.position;
  if (pos.location !== LOC_BLACKTHORN || !ctx.npcManager) return null;
  const { nx, ny } = ctx.targetCoord(dir);
  const npc = ctx.npcManager.npcAt(pos.location, pos.floor, nx, ny);
  // 🔴 `!== 0xff`, NO `< 0xfd`. El binario reparte los TRES dialogNumber altos en tres
  // handlers distintos (TALK.OVL, re/notes/talk-031e-resolucion.md:34): 0xFD → «Don't hurt
  // me!», 0xFE → far 0xbb02, y sólo 0xFF → `call 0x1e2`, el guardia. Un `< 0xfd` acepta los
  // tres y le roba a 0xFD/0xFE su handler. Es el MISMO predicado que ya usa la otra vía de
  // este fichero (:253 `npc.dialogNumber !== 0xff`) — eran dos formas para una pregunta.
  if (!npc || npc.dialogNumber !== 0xff) return null;
  // #277 residuo (capa de PROMPT): TALK 0x02a4 sin badge → jmp 0x216, ret 1 sin
  // imprimir. El reto sólo existe llevando la insignia puesta.
  if (ctx.state.timeSpell !== TIME_SPELL_BADGE) return [];
  ctx.prompts.password = { from: "talk" };
  return [{ kind: "blackthorn-guard-password-prompt", text: GUARD_PASSWORD_CHALLENGE }];
}

/**
 * Resuelve el reto de password (TALK 0x02a4). `response` es lo tecleado; el motor
 * puro `guardDemand` lo trunca a 4 chars (0x02dc `buf[4]=0`) y compara con "IMPE".
 *
 * Acierto → ret 0 y "Pass, friend!" (DS 0x913a → `jmp 0x22b`, `sub ax,ax`). **NO
 * concede pase alguno** (T-B): el binario no escribe flag — las únicas escrituras de
 * estado global de TALK 0x01e2 son `g_gold` (0x0225, 0x029d). Sólo evita la captura
 * de ESA interacción; el turno siguiente, con el guardia aún pegado, se re-reta.
 *
 * Fallo → ret 1 = escalada, y qué significa depende de QUIÉN retó:
 *  - intercepción → el caller es npc_engine, que con ret != 0 salta a 0x13d6 →
 *    TOWN 0x12ae: CAPTURA (T-A).
 *  - (T)alk → aquí no se fabrica nada; ver el residuo declarado abajo.
 *
 * ★ APLICADO (ruling del lead 2026-07-30): fallar el password HABLANDO con el guardia
 * ARRESTA igual. Cadena: `guard_demand` ret 1 → lo propaga TALK 0x031E, en 0x03e2 →
 * lo vuelve a propagar TALK 0x041c, en 0x04c8 → el dispatcher escribe el 2 (kernel
 * 0x3403, único literal 2) → TOWN 0x1678 pasa por el segundo término de la
 * disyunción → npc_engine(1) → 0x13b4 `jne` → 0x12ae.
 *
 * ¿Son el MISMO camino las dos escaladas? El DESTINO sí (0x12ae, y allí el gate
 * `loc==0x12 ∧ party_conscious_state>=0` se re-evalúa para ambas). Upstream NO, y la
 * diferencia está derivada:
 *  1. con `[bp+4]==1` (vía (T)alk) npc_engine salta de 0x13b4 a 0x13d6 SIN releer
 *     `dlgNum` (0x13c7) y SIN volver a llamar a TALK: la demanda ya corrió durante el
 *     comando. Con `[bp+4]==0` (intercepción) la demanda corre DENTRO de npc_engine y
 *     la captura queda condicionada a su retorno. En ambos casos la demanda corre
 *     EXACTAMENTE UNA VEZ.
 *  2. el turno de `result==2` **NO corre la pasada de NPCs**: TOWN 0x1662
 *     `cmp [bp-0xa],2 / jge 0x1671` se salta el `call` del stub 0x7ab2. En el turno de
 *     la intercepción esa pasada SÍ corrió. ⚠ Hoy esa diferencia es INOBSERVABLE en el
 *     port por un hueco APARTE y preexistente: el comando (T)alk del clon no consume
 *     turno de mundo (main.ts:2381 aplica los eventos y vuelve). Queda declarado como
 *     residuo propio, no tapado por este cambio.
 *
 * Idempotente sin reto activo.
 */
export function submitGuardPassword(ctx: GuardCtx, response: string): GameEvent[] {
  const pending = ctx.prompts.password;
  if (!pending) return [];
  ctx.prompts.password = null;
  const result = guardDemand(ctx.state, response, false);
  if (result.ret === 0) return [{ kind: "message", text: GUARD_PASS_FRIEND }];
  // ret 1 = ESCALADA, y las DOS vías acaban en la misma rutina, TOWN 0x12ae:
  //  · intercepción — npc_engine con [bp+4]==0 llega a 0x13ba, llama a TALK 0x031E y
  //    salta a 0x13d6 sólo si el retorno es != 0;
  //  · (T)alk — el dispatcher escribe result=2 (kernel 0x3403) y npc_engine entra con
  //    [bp+4]==1, así que 0x13b4 `jne` salta a 0x13d6 DIRECTAMENTE, sin releer dlgNum
  //    y sin volver a correr la demanda (ya corrió durante el comando).
  // El origen no cambia el destino; lo que cambia está upstream (ver el docblock).
  return ctx.runCapture?.() ?? [];
}

/**
 * T-A — arma el reto de password de la INTERCEPCIÓN (no del comando (T)alk). Lo
 * invoca `checkBlackthornCapture` vía `CaptureCtx.challengePassword` cuando el
 * trigger de adyacencia dispara en loc 0x12 CON la insignia puesta: el binario, en
 * esa misma vía, imprime el reto (TALK 0x02ae) y hace `getstring` (0x02d2). El
 * prompt PAUSA el turno igual que el del interrogatorio.
 */
export function challengeGuardPassword(ctx: GuardCtx): GameEvent[] {
  ctx.prompts.password = { from: "interception" };
  return [{ kind: "blackthorn-guard-password-prompt", text: GUARD_PASSWORD_CHALLENGE }];
}

/**
 * ¿Un guardia de pueblo intercepta al party este turno? (pasada de NPCs +
 * npc_engine TOWN 0x1352, fuera del Palacio). **Reescrito por T-C
 * (`re/notes/tc-result-producer.md`): el mecanismo REAL, sin limitador.**
 *
 * El ciclo completo cabe en unas pocas instrucciones y dura UN TURNO:
 *  1. `npc_tick_all` (NPC.OVL 0x0db4, stub 0x7ab2) limpia `[0x65be]` y `[0x65bf]`
 *     en su PRÓLOGO (0x0dc1/0x0dc6) — no hay memoria entre turnos;
 *  2. recorre idx ASCENDENTE 1..0x1f y por cada NPC llama al fast-path 0x06e4, que
 *     sólo arma con `manhattan == 1` (0x0723). aiType <= 3 → no arma (0x0728);
 *     aiType 4/5 exige además `dlgNum != 0` (0x0740) y pone marcador 0x74 (0x0746);
 *     aiType 6/7 pone 0x61 (0x07be) SIN mirar dlgNum. Ambos escriben `[0x65bf] = idx`
 *     (0x074e), así que **cada candidato PISA al anterior: gana el de índice MAYOR**;
 *  3. TOWN 0x1671 lee `[0x65bf]` tres instrucciones después y despacha npc_engine,
 *     que ramifica por el marcador de ESE NPC (0x1379 `cmp [0x65be],0x61`).
 *
 * Consecuencia que el modelo conservador ocultaba: **la demanda dispara TODOS los
 * turnos que pases adyacente al guardia.** No había contador en ninguna capa (ni en
 * TALK 0x031E ni en 0x01e2 ni en el productor de `result`); la rareza en el corpus de
 * LPs es que no se suele circular pegado a un guardia. Retirados por eso el gate
 * `guardTributeTrigger.enabled` y la marca por-NPC `tributeDemanded`.
 *
 * ⚠ Otro NPC de **aiType > 3** de índice mayor **absorbe** el slot: arma `[0x65bf]`
 * igual y su despacho corre su TLK (ret 0), suprimiendo la demanda del guardia de
 * índice menor. Absorben DOS clases y sólo dos: otro guardia 4/5 con `dlgNum != 0`
 * (marcador 0x74, `NPC.OVL 0x0746,`) y un HOSTIL 6/7 (marcador 0x61, `0x07be,`, que
 * cae en el mismo `mov byte ptr [0x65bf], al` por el `jmp 0x74b` de `0x07c3,`).
 * Es mecánica derivada, no efecto de borde.
 *
 * 🔴 ERRATA CORREGIDA (bolsa #39): esta prosa decía «un NPC **NORMAL** de índice
 * mayor absorbe el slot», y el binario lo NIEGA. Un NPC normal es `aiType <= 3` y
 * sale por `NPC.OVL 0x072c,` (`cmp word ptr [bp - 2], 3` / `jle 0x75a`) al bucle de
 * MOVIMIENTO **sin tocar `[0x65bf]` jamás**. El CÓDIGO de abajo siempre estuvo bien
 * (`:if (ai <= 3) continue;` calca ese mismo `jle`); mentía la prosa, que es
 * justamente lo que el siguiente lector se cree sin abrir el disasm.
 *
 * POBLACIÓN de la absorción, medida: el slot es UN byte y el bucle `NPC.OVL 0x0db4,`
 * recorre **31 índices (1..0x1F)** en orden ASCENDENTE (`0x1267,` `cmp` con `0x20`),
 * limpiando `[0x65be]`/`[0x65bf]` en el prólogo (`0x0dc1,`/`0x0dc6,`). Cada candidato
 * PISA al anterior ⇒ gana el de índice mayor. Y no hay nada específico del Palacio:
 * el censo de las dos globales sobre los 28 overlays da escrituras SÓLO en NPC.OVL,
 * lecturas en TOWN.OVL y CMDS.OVL, y **CERO en BLCKTHRN.OVL** — el corte palaciego
 * vive aguas abajo (`TOWN.OVL 0x12ae,`), no en la absorción.
 */
export function checkGuardTribute(ctx: GuardCtx): GameEvent[] | null {
  const pos = ctx.state.position;
  // 🔴 TACHADO-DOCUMENTADO (gárgolas del Palacio): esta guarda decía
  // `pos.location === LOC_BLACKTHORN → return null` — cortaba el npc_engine ENTERO
  // en loc 18. El binario NO tiene ese corte: npc_engine (TOWN 0x1352) corre en
  // todos los pueblos, y lo palaciego vive AGUAS ABAJO (el gate `loc==0x12` está
  // DENTRO de 0x12ae, 0x12b9) — el censo de bolsa-39 («CERO accesos a 0x65be/0x65bf
  // en BLCKTHRN.OVL») ya lo decía. La rama 'a' de un hostil NO-guardia (0x13ac →
  // 0x13dc «Attacked!» + combate) no mira la localización jamás: las gárgolas de la
  // azotea (slots 17/18, ai=6) atacan EN el Palacio. El corte total las dejaba
  // persiguiendo sin dientes = el softlock del reporte del usuario.
  // El gate de Blackthorn queda donde el binario lo tiene: en las ramas que
  // desembocan en 0x12ae (la captura la conduce checkBlackthornCapture, que el
  // caller ya ejecutó ANTES — mismo orden que el gate interno).
  if (pos.location === 0 || !ctx.npcManager) return null;
  if (ctx.prompts.tribute || ctx.prompts.arrest) return null;
  // Paso 2: el ÚLTIMO candidato en orden de índice se queda `[0x65bf]`/`[0x65be]`.
  let active: { npc: NpcRuntime; marker: 0x61 | 0x74; schedIdx: number } | null = null;
  for (const npc of [...ctx.npcManager.npcsAt(pos.location, pos.floor)].sort(
    (a, b) => a.slot - b.slot,
  )) {
    const dist = Math.abs(npc.x - pos.x) + Math.abs(npc.y - pos.y);
    if (dist !== 1) continue; // 0x0723 `cmp ax,1 / jne`
    const schedIdx = scheduleIndex(npc.times ?? [0, 0, 0, 0], ctx.state.time.hour);
    const ai = npc.aiTypes?.[schedIdx] ?? 0;
    if (ai <= 3) continue; // 0x0728 `cmp [bp-2],3 / jle`
    if (ai === 4 || ai === 5) {
      if (!npc.dialogNumber) continue; // 0x0740 `cmp word [bx+0xa],0 / je`
      active = { npc, marker: 0x74, schedIdx }; // 0x0746 + 0x074e (PISA)
    } else {
      active = { npc, marker: 0x61, schedIdx }; // 0x07be + 0x074e (PISA)
    }
  }
  if (!active) return null; // `[0x65bf]` quedó a 0 → TOWN 0x1671 no despacha
  const { npc, marker, schedIdx } = active;
  if (marker === 0x61) {
    // ═══ RAMA 'a' (npc_engine 0x1380-0x13b1 + tail 0x13dc-0x1414) — COMPLETA. ═══
    // 🔴 TACHADO-DOCUMENTADO: aquí decía «Exige además tile de guardia (0x13a7
    // `cmp byte[bx],0x70`)» y para el resto hacía `return null`. Ese «exige» leía
    // el `je 0x13d6` como GATE de la rama entera y TIRABA el else: el binario, con
    // tile != 0x70, hace `[bp-2]=1` (0x13ac) y cae al tail 0x13dc — «\nAttacked!\n»
    // (DS 0x2881, 0x13fb) + `town_attack_engine_commit` 0x09BC = COMBATE contra el
    // actor y su ranura FUERA. La adjudicación de 0x09BC como entrada a combate
    // urbano estaba en el corpus desde #201 (shadowlord-residuos-acta.md §1) y
    // nadie re-censó este consumidor de la lectura vieja. Derivación completa:
    // re/notes/gargolas-hostiles-palacio.md.
    // NO pasa por `talk_converse_dispatch` ⇒ NO normaliza el aiType (ver abajo).
    const tile = npc.type & 0xff;
    if (npc.dialogNumber === 0xfe) {
      // 0x138a `cmp [rt+dlg],0xfe / jne 0x13a4` → 0x1392: el POSEÍDO de Astaroth
      // ataca — TOWN 0x10da `town_possessed_npc_attack`: imprime DS 0x278a
      // «"Begone,\nvermin!"» + `call 0x8d4 town_possess_fear(self)` = el propio
      // NPC pasa a poseído-Nosfentor (dialog 0xFD + aiTypes [3,3,3] = huida).
      // SIN combate. (El `call 0xffff94ea(0xa)` previo y el `0xffffa8d8` del
      // cuerpo son presentación no adjudicada — pausa/beep; no se modelan.)
      const events: GameEvent[] = [{ kind: "message", text: '"Begone,\nvermin!"\n' }];
      const hasSchedule = npc.times.some((t) => t !== 0); // 0x08e8-0x08fa
      if (isPersonType(tile) && (npc.dialogNumber === 0xfe || hasSchedule)) {
        npc.dialogNumber = 0xfd; // 0x0917 je → 0x092f
        npc.aiTypes = [3, 3, 3]; // 0x093d-0x094b
      }
      return events;
    }
    if (tile === PALACE_GUARD_TYPE) {
      // 0x13a4 `cmp byte[bx],0x70 / je 0x13d6` → 0x12ae. Dentro, 0x12b9 re-gatea
      // `loc == 0x12`: en el Palacio es la CAPTURA (la conduce
      // checkBlackthornCapture, que el caller corre antes); fuera, el arresto.
      if (pos.location === LOC_BLACKTHORN) return null;
      ctx.prompts.arrest = { npcSlot: npc.slot };
      return [{ kind: "guard-arrest-prompt" }];
    }
    if (tile >= 0x40) {
      // 0x13ac `[bp-2]=1` → 0x13dc con actor >= 0x40 (0x13f4 `cmp ...,0x40 / jb`):
      // el ATAQUE — «\nAttacked!\n» + combate + ranura fuera (via Game.startCombat).
      return ctx.hostileNpcAttack?.(npc) ?? null;
    }
    // 0x140e (actor < 0x40 = objeto-actor: caballos 0x10/0x11, naves…): `call 0xb0`
    // npc_clear_slot A SECAS — sin mensaje ni combate. Inalcanzable con los datos
    // de fábrica (ningún NPC de tile < 0x40 lleva aiType > 3; censo npcs.json) —
    // se calca por forma.
    ctx.npcManager.clearSlot(pos.location, npc.slot, ctx.state);
    return null;
  }
  // marker 0x74 ('t'): en el Palacio la vía es la captura (checkBlackthornCapture,
  // ya corrida por el caller) — el reparto por dlgNum de abajo es de pueblo.
  if (pos.location === LOC_BLACKTHORN) return null;
  // ⚑ #304 — LA NORMALIZACIÓN DEL aiType, y va ANTES del reparto por `dlgNum` porque en
  // el binario vive en el PRÓLOGO de `talk_converse_dispatch`, no en ninguna de sus ramas:
  //
  //   0348: mov bx, [bp-4]         ; rt = 0x5f5e + idx*16
  //   034b: mov si, [bx+0xe]       ; índice de tramo ALMACENADO
  //   034e: add si, ax             ; ax = 0x5d5e + idx*16 ⇒ si = &aiTypes[tramo]
  //   0350: cmp byte ptr [si], cl  ; cl = 4
  //   0352: jne 0x36a
  //   0354: mov byte ptr [si], 1   ; ← aiType 4 pasa a 1, EN LA TABLA VIVA
  //
  // Es lo que impide que el original te vuelva a abordar en el turno siguiente: el 4 es
  // justamente lo que arma el fast-path de `NPC.OVL 0x06e4` (0x0728 `jle 3`), así que
  // degradarlo a 1 DESARMA el disparador. Sin esto la mecánica de #304 no es una mecánica
  // sino un cepo: MEDIDO en este árbol antes del fix, `npc-initiates-shop` salía en el
  // turno 1 Y en el turno 2 con la party quieta — la consola de la tienda reabriéndose
  // cada turno mientras no te alejes.
  //
  // 🔴 Alcance EXACTO, y las tres cotas son derivadas, no elegidas:
  //  (a) Sólo el 4. El 5 NO se toca (`cmp` con `cl`=4 es igualdad). En los datos de hoy
  //      es una distinción sin diferencia para los tenderos —los 14 son aiType 4, CERO
  //      llevan 5 (censo sobre npcs.json)— pero la guarda se escribe por el binario.
  //  (b) Sólo por ESTA vía. `talk_converse_dispatch` tiene UN llamador en los 28 overlays
  //      (TOWN 0x13cf, resuelto con `dispatch_table.near_calls_to_kernel(_,0x7AE2)` y
  //      control positivo); el comando (T)alk no entra aquí y por tanto NO normaliza.
  //  (c) Para TODO `dlgNum`, no sólo tenderos: el prólogo corre antes de 0x0396/0x03e4/
  //      0xFD/0xFE/0xFF. El guardia del tributo y el NPC guionizado de #301 también
  //      quedan degradados tras su primera intercepción — que es la conducta de 1988.
  //
  // ⚠ MUEVE STREAM (declarado, con su ventana en el commit): el aiType elige rama en
  // `npcManager.tick` — el 4 persigue-o-vagabundea según distancia al puesto y el 1
  // vagabundea siempre, y las dos ramas consumen `rand` distinto. La divergencia empieza
  // en el turno SIGUIENTE a la primera intercepción de cada NPC de aiType 4.
  if (npc.aiTypes && npc.aiTypes[schedIdx] === 4) {
    npc.aiTypes[schedIdx] = 1; // 0x0354
  }
  // rama 0x13b4 → 0x13ba: dlgNum != 0 → TALK 0x031E. Sólo dlgNum 0xFF es el guardia
  // hardcodeado; cualquier otro CORRE SU TLK y devuelve 0 (sin demanda ni captura).
  //
  // 🔴 #301 — aquí vivía un `return null` que modelaba el RETORNO (0 = sin captura) y
  // TIRABA EL EFECTO, que es la conversación entera. El binario, en `0x13ce`, llama a
  // `TALK 0x031E talk_converse_dispatch(idx)`, y con `0 < dlgNum < 0x80` eso ES
  // `run_scripted_conversation` (0x0396) — el interrogatorio del guardia del tejado
  // del castillo (loc 17, dlgNum 8) sin que el jugador pulse (T)alk. Que la rama
  // devuelva 0 SIEMPRE (0x3a3→0x38e) es justo lo que la hacía parecer un no-op.
  // La conversación la conduce la UI con la MISMA consola del comando (T)alk.
  if (npc.dialogNumber !== 0xff) {
    // #304 — la rama de TENDEROS del MISMO despachador (TALK 0x0396 `cmp [bp-2],0x80 /
    // jge 0x3a6`, y 0x03a6/0x03cc/0x03d8 apartan 0xFD/0xFE/0xFF): `0x80..0xFC` cae en
    // 0x03e4 y con el tramo abierto hace `call 0xe6` = LA TIENDA, sin (T)alk. El
    // ORDEN de abajo es el de 0x03e4-0x0401 y está DERIVADO, no elegido: el gate
    // horario va ANTES de `0xe6` y la guarda del caballo DENTRO ⇒ a un tendero fuera
    // de tramo se le oye «Come see me…», NO el insulto del caballo, aunque llegues
    // montado.
    if (npc.dialogNumber >= SHOPKEEPER_LO && npc.dialogNumber <= SHOPKEEPER_HI) {
      // 0x03e7 + 0x03fa: las DOS pruebas de paridad del índice de tramo. En el port
      // colapsan en UNA (el índice se recomputa; ver shop-hours.ts §«las dos pruebas»).
      // MISMA pieza que la vía de (T)alk — segundo llamador, no una copia.
      if (!shopIsOpen(npc, ctx.state.time.hour)) {
        return [{ kind: "message", text: SHOP_CLOSED_MESSAGE }]; // 0x0406 + 0x040d
      }
      const mounted = ctx.mountedMerchantRefusal?.(npc); // 0x00ed, ya dentro de 0xe6
      if (mounted) return mounted;
      return [{ kind: "npc-initiates-shop", initiatesShop: { npc } }];
    }
    if (!ctx.talkScriptFor?.(npc)) return null; // dlgNum 0, 0xFD/0xFE, o sin script en el .TLK
    return [{ kind: "npc-initiates-talk", initiatesTalk: { npc } }];
  }
  const charity = pos.location === LOC_MINOC; // 0x01f3 `cmp [g_location],5`
  // `npcSlot` = `[0x65bf]`: la escalada (ret 1 → arresto → 'N') acaba en el tail de
  // ataque de npc_engine contra ESTE guardia (0x13dc con [0x65bf] intacto).
  ctx.prompts.tribute = { kind: charity ? "charity" : "tribute", npcSlot: npc.slot };
  return [
    {
      kind: "guard-tribute-prompt",
      charity,
      ...(charity ? {} : { toll: guardTributeAmount(ctx.state) }),
    },
  ];
}

/**
 * Resuelve el Y/N de la demanda («Dost thou pay?», TALK helper 0x00ac). El motor
 * puro `guardDemand` aplica el cobro exacto (tributo=10·vivos con gate de oro;
 * Minoc `gold/2`). ret 0 (pagado) → el guardia queda satisfecho, SIN texto (el
 * binario sólo llama al jingle 0x6980, sin print). ret 1 (rehusar, o aceptar SIN
 * oro — el GOTCHA del testigo arrest-ep3) → escalada: el caller (npc_engine
 * 0x13d6) invoca TOWN 0x12ae, que fuera del Palacio imprime el arresto
 * (DS 0x27e2/0x27fe) y espera el segundo Y/N.
 */
export function resolveGuardTribute(ctx: GuardCtx, pay: boolean): GameEvent[] {
  if (!ctx.prompts.tribute) return [];
  const { npcSlot } = ctx.prompts.tribute;
  ctx.prompts.tribute = null;
  const result = guardDemand(ctx.state, "", pay);
  if (result.ret === 0) return [{ kind: "party-changed" }]; // oro mermado (0x225/0x29d)
  ctx.prompts.arrest = { npcSlot: npcSlot ?? null }; // `[0x65bf]` viaja a la escalada
  return [{ kind: "guard-arrest-prompt" }];
}

/**
 * Resuelve el Y/N del arresto («Wilt thou come quietly?», TOWN 0x12ae 0x12e6):
 *  - 'Y' (0x12fa-0x133a): inconsciencia + despertar en la CELDA DE YEW — pueblo
 *    caminable, sin cutscene de celda (mutación exacta en `guardArrestJail`:
 *    loc 4, (25,4), planta 0, llaves confiscadas, reloj a las 8).
 *    ★ #328 — EL «FADE» ERA UNA PREMISA RANCIA, cerrada por derivación: el
 *    `call 0x88a0(0)` de 0x1301-0x1304 resuelve (near-call base TOWN 0x81d0,
 *    dispatch_table; control CMDS 0x7b9c→0x3b1c) al residente 0x0a70 =
 *    `set_color(0)` A SECAS — la MITAD del par-apagón de #296/#303, SIN su
 *    `fill_rect`. El par completo existe en este mismo overlay como control
 *    interno (TOWN 0x0fa0-0x0fb0: set_color(0) + fill_rect(8,8,0xb7,0xb7),
 *    la escena de loc 0x1d), y en el camino del arresto NADIE consume el color
 *    colgante: el bucle de espera hasta las 8 (0x132b → advance_time 0x4f7c)
 *    no contiene ningún fill_rect (0 llamadas a 0xaa6 en su cuerpo) y el print
 *    0x1850 pinta con sus ventanas propias, no con [0x52da] («Thou dost awaken
 *    to...» se imprime DESPUÉS del set_color(0) y se ve). ⇒ el original NO
 *    funde a negro al arrestar: texto + CORTE DURO a la celda. El clon, que
 *    encadena mensajes y cambia de mapa, ya es fiel — no falta presentación.
 *  - 'N' (0x133c-0x1346): «Then defend thyself, rogue!» + alarma del pueblo
 *    (TOWN 0x958): guardias hostiles permanentes, ~50% de civiles en pánico
 *    (dialog 0xFD + huida). Consume 1 rand por slot no-guardia presente.
 */
export function resolveGuardArrest(ctx: GuardCtx, quietly: boolean): GameEvent[] {
  const pending = ctx.prompts.arrest;
  if (!pending) return [];
  ctx.prompts.arrest = false;
  if (quietly) {
    const events: GameEvent[] = [
      { kind: "message", text: ARREST_UNCONSCIOUS },
      { kind: "message", text: ARREST_AWAKEN },
    ];
    guardArrestJail(ctx.state);
    events.push({ kind: "map-changed" });
    events.push({ kind: "party-changed" });
    return events;
  }
  const events: GameEvent[] = [{ kind: "message", text: ARREST_DEFEND }];
  ctx.npcManager?.arrestAlarm(ctx.state.position.location, ctx.rand);
  // 'N' devuelve 1 (TOWN 0x1346 `[bp-4]=1` — LA ÚNICA salida ≠0 de 0x12ae) →
  // npc_engine 0x13d9 `[bp-2]=ax` → tail 0x13dc: el guardia activo (`[0x65bf]`,
  // tile 0x70 >= 0x40) ATACA — «\nAttacked!\n» + combate (def 12 GUARD; en pueblo
  // rollEncounterGroup da count=8, la excepción `cmp [bp+4],0xc` de 0x6c6b) y su
  // ranura FUERA (0x09BC). El orden es el del binario: rogue (0x1340) → alarma
  // 0x958 (0x1343) → ret 1 → «Attacked!» (0x13fb). Sin slot conocido (vía vieja de
  // save) el tail se omite — degradación declarada, no un gate del binario.
  const slot = pending.npcSlot;
  if (slot !== null && ctx.hostileNpcAttack && ctx.npcManager) {
    const pos = ctx.state.position;
    const npc = ctx.npcManager
      .npcsAt(pos.location, pos.floor)
      .find((n) => n.slot === slot);
    if (npc) events.push(...ctx.hostileNpcAttack(npc));
  }
  return events;
}
