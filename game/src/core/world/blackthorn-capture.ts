/**
 * Captura de Blackthorn — BLCKTHRN.OVL 0x060e / TOWN 0x12ae (F1.7-T2), extraída
 * de la clase Game (TRAMO 3 del refactor estructural, auditoría ARQ-3). El MOTOR
 * puro (blackthornCapture/pickInterrogationShrine/mantraMatches…) ya vivía en
 * world/blackthorn.ts; aquí va la ORQUESTACIÓN de la escena (trigger, monólogo
 * del trono, rondas del interrogatorio, depósito) con un contexto estrecho.
 * Game delega (fachada, firmas intactas) y posee el holder del interrogatorio
 * en curso. Comentarios-cita transplantados ÍNTEGROS.
 */
import type { GameState } from "../state.js";
import { effectiveName } from "../party.js";
import type { GameEvent } from "../game.js";
import type { NpcManager } from "../npc/manager.js";
import { tf } from "../../i18n/index.js";
import { scheduleIndex } from "../time.js";
import { advanceClock, type RandFn, type SkyRefreshCtx } from "./survival.js";
import {
  PALACE_GUARD_TYPE,
  blackthornCapture,
  blackthornGuardCaptureTriggers,
  countLiving,
  mantraMatches,
  pickInterrogationShrine,
  type GuardActor,
  type InterrogationResult,
  TIME_SPELL_BADGE,
} from "./blackthorn.js";
import {
  blackthornOnStage,
  buildBlackoutIntroScript,
  buildBlackthornEntryScript,
  buildBlackthornExitScript,
  buildChainedPauseScript,
  buildFinaleScript,
  buildGuardReleaseScript,
  buildHourglassScript,
  buildSacrificeScript,
  buildThroneMountScript,
  buildWarningScript,
  initCaptureScene,
  sacrificeVictimCell,
  type CaptureSceneScript,
  type CaptureSceneState,
  type CaptureSceneTiles,
} from "./blackthorn-scene.js";

/**
 * Interrogatorio EN CURSO: `shrine/virtue/mantra` son del santuario interrogado
 * (el primero con byte 0); `numLiving` fija las ramas (Avatar solo vs party);
 * `responses` acumula lo tecleado. El motor (`blackthornCapture`) corre al
 * completar. null fuera del interrogatorio.
 */
export interface PendingInterrogation {
  shrine: number;
  virtue: string;
  mantra: string;
  numLiving: number;
  responses: string[];
}

/** Holder mutable del interrogatorio (lo posee Game; el módulo lo arma/limpia). */
export interface InterrogationHolder {
  current: PendingInterrogation | null;
}

/**
 * Holder mutable del ESTADO DE ESCENA de la captura (#324): posiciones de los objetos
 * de la sala del trono entre segmentos (los guiones del VM mutan sobre él). Lo posee
 * Game junto al interrogatorio; presentación pura — no se persiste.
 */
export interface CaptureSceneHolder {
  current: CaptureSceneState | null;
}

export interface CaptureCtx {
  state: GameState;
  npcManager?: NpcManager | null;
  /** data.shrines del boot (virtudes/mantras DATA.OVL). */
  shrines?: { virtues?: string[]; mantras?: string[] };
  pending: InterrogationHolder;
  /**
   * T-A — arma el reto de password de la INTERCEPCIÓN y devuelve su prompt. Lo
   * inyecta Game (la máquina de prompts vive en guard-encounters.ts); ausente en los
   * contextos que no tienen capa de prompt, donde la intercepción cae a la captura
   * directa como antes.
   */
  challengePassword?: () => GameEvent[];
  /**
   * #288 — stream VIVO para el `advance_clock(2)` de la escalada del interrogatorio
   * (BLCKTHRN 0x05b4): sólo importa si el avance cruza medianoche (re-sorteo de
   * Shadowlords, kernel 0x4FF5). Los arneses puros lo omiten (sin re-roll).
   */
  rand?: RandFn;
  /** #288 — contexto del latch de fases lunares de la cola de advance_clock (#176). */
  sky?: SkyRefreshCtx;
  /**
   * #324 — rejilla 11×11 de la sala del trono (MISCMAPS.DAT[0:176], asset
   * `shrine-scene.json` clave `capture`). AUSENTE = la captura corre SIN escena (sólo
   * texto, sin esperas de tecla): la degradación previa a #324, no una rotura — y el
   * discriminante que mantiene intactos los arneses puros existentes.
   */
  captureTiles?: CaptureSceneTiles;
  /** #324 — holder del estado de escena (posiciones de la sala entre segmentos). */
  scene?: CaptureSceneHolder;
}

/**
 * #324 — marcador de ESPERA DE TECLA (kernel `getkey_with_redraw` 0x266C). La captura
 * tiene CINCO llamadas propias: 0x0894 (tras el saludo), 0x08CD (tras el «Wait!»),
 * 0x053F (aviso, tras el « die!" »), 0x04F6 (tras el « is sliced in half! ») y 0x0510
 * (traición/mazmorra, antes del guion final). Mismo kind que las once del rito (#294):
 * el pacer de UI (`ShrineKeyPacer`) es genérico — aparca el resto del turno hasta una
 * tecla. Objeto NUEVO por llamada (el corte del bucle usa identidad, ver main.ts).
 */
function keyWait(): GameEvent {
  return { kind: "shrine-key-wait" };
}

/** Evento de un segmento de escena (#324). */
function sceneEvent(script: CaptureSceneScript): GameEvent {
  return { kind: "blackthorn-scene", blackthornScene: script };
}

/**
 * #324 — la EXPLOSIÓN del sacrificio (`explosion_fx_at_cell` kernel 0x3522, llamada
 * ÚNICA en sacrifice_member 0x041E sobre las coords del slot 1). Mismo canal que #201:
 * `cellFx` con la celda como DESPLAZAMIENTO respecto al centro de la ventana 11×11 —
 * y el centro de la escena ES (5,5), así que dx/dy = celda − 5. Una llamada = 1 burst,
 * sin pausa previa propia (la pausa(10) y la sirena son beats del segmento anterior).
 */
function sacrificeExplosionEvent(scene: CaptureSceneState): GameEvent {
  const at = sacrificeVictimCell(scene);
  return {
    kind: "cell-explosion",
    cellFx: { dx: at.x - 5, dy: at.y - 5, bursts: 1, preDelayUnits: 0 },
  };
}

/**
 * Preguntas del interrogatorio (BLCKTHRN `print_question` 0x0278), byte-exactas
 * de MISCMSG.DAT (records cargados en runtime a DS 0xB21E; el fichero NO se
 * commitea). Las variantes 0..2 concatenan el nombre de la virtud (DATA.OVL
 * 0x1F4E) y cierran con `?"` (DATA.OVL 0x6F6E) — aquí como PLANTILLA posicional
 * `{}` (tf en call-site: el choke i18n t() lookea el compuesto entero, y el tf
 * traduce plantilla + virtud). La ronda `si` (0..3) del bucle 0x054a elige la
 * variante `si`; la variante 3 (autónoma) vive en BLCKTHRN_MISCMSG.
 */
const INTERROGATION_QUESTION_TEMPLATES: readonly string[] = [
  '"What is the Mantra of the Mystic Shrine of {}?"', // MISCMSG rec0 (DS 0xb21e) + virtud + ?"
  '"Now tell me, what is the Mantra of {}?"', // MISCMSG rec1 (DS 0xb24b) + virtud + ?"
  '"Resistance is futile! Thou must yield the truth unto me! Tell me, what is the Mantra of {}?"', // rec2 (0xb270) + virtud + ?"
];
/**
 * Strings FIJOS de MISCMSG.DAT del interrogatorio/captura. Agrupados en una
 * constante-display allowlistada (DISPLAY_CONSTS de extract-user-strings.mjs):
 * viajan por retornos cross-función que los sinks del barrido NO ven — sin el
 * allowlist quedarían fuera del manifiesto/corpus y la capa i18n no podría
 * traducirlos (guarda anti-fabricación).
 */
const BLCKTHRN_MISCMSG = {
  /** rec3 (DS 0xb2ca): 4ª pregunta, autónoma (sin virtud, sin cierre `?"`). */
  finalQuestion: '"My patience with thee has worn away! SPEAK UNTO ME THE MANTRA, NOW!',
  /** rec5: cede el mantra con party>1 → un compañero ejecutado (sacrifice_member(0)). */
  mercifulDeath:
    '"I thank thee, my friend! As a token of my esteem for thine honesty, I will grant thy companion a merciful death!"',
  /** rec9: cede el mantra estando el Avatar solo → perdón, sin sacrificio (con espacio final). */
  rewardedLife: '"I sense Truth in thee.  This will be rewarded with thy life!" ',
  /** rec10: el Avatar solo falla → a la mazmorra, sin caída de santuario (con espacio final). */
  toDungeon: '"A child would catch thee in thy lies, foolish one! To the dungeon with thee!" ',
  /** rec7: primer fallo con party>1 → aviso (warned=1, BLCKTHRN 0x51c). */
  warning: '"Make not the mistake of laughing at me, simple one!"',
  /** rec4: 4º fallo con party>1 → el péndulo cae (sacrifice_member(1) 0x03bc). */
  pendulum: "With a wave of Blackthorn's hand, the pendulum blade falls!",
  /** rec6: acompaña al péndulo — "treachery" (con "\n\n" inicial). */
  treachery:
    '\n\n"None call me unfair! I have shown thee every kindness in the world and thou hast lied to me! Thy friend hath paid for thy treachery!"',
  /** rec11 (DS 0xb54a) @0x08ca: "Wait!" + petición de Avatarhood (con espacio final). */
  interrogationIntro:
    '\n\n"Wait!"\n\n"Since I myself seek Avatarhood as once did thee, mayhap thou couldst aid me in my Quest by answering a question." ',
} as const;

// Escena de captura / monólogo de apertura del interrogatorio (BLCKTHRN 0x060e,
// #23). Strings de DATA.OVL vía kernel print (fileoff = DS_off + 0x10) salvo rec11,
// que es MISCMSG (DS 0xb54a). Orden de prints 0x0652→0x08ca (re/notes/blackthorn.md
// §3.1). Los sprites del trono (0xbe @0x3702/0x370e) y las pausas (0x83dc) son L3/UI,
// no texto. La venda (0x0652) precede al bucle de santuarios → aparece también en la
// vía de depósito directo (0x0665 salta a 0x08e7).
/** DATA.OVL 0x6fbc @0x0652: venda (impresa antes de elegir santuario). */
const CAPTURE_BLINDFOLD = "\nThou art subdued and blindfolded!";
/** DATA.OVL 0x6fe0 @0x06b0: arrastre (sólo en la vía de interrogatorio). */
const CAPTURE_DRAG = "\n\nStrong guards drag thee away!";
/** DATA.OVL 0x7024 @0x07dc: cadenas. */
const CAPTURE_CHAINED = "\n\nThou hast been chained and manacled!";
/** DATA.OVL 0x704c @0x07ea: pasos. */
const CAPTURE_FOOTSTEPS = "\n\nFootsteps!";
/**
 * Saludo de Blackthorn como PLANTILLA posicional `{}` (tf en call-site): el
 * binario compone prefijo DATA.OVL 0x705a (@0x0883) + nombre del Avatar
 * (DS 0x55a8) + sufijo DATA.OVL 0x7074 (@0x0891). En 'en' tf es identidad
 * byte-exacta con esa concatenación.
 */
const CAPTURE_GREET_TEMPLATE = `\n\nBlackthorn says:\n\n"Ah, {}!\n'Tis indeed an honour to meet thee at last! `;
/**
 * Orden a la guardia como PLANTILLA posicional `{}`: prefijo DATA.OVL 0x70a4
 * (@0x089b) + palabra de género + cierre DATA.OVL 0x70ce (@0x08bc). tf traduce
 * también el ARG string (t(gender)), lo que permite la concordancia española
 * («buen hombre» / «buena dama»).
 */
const CAPTURE_GUARD_TEMPLATE = '\n\nGUARD! Release this good{}at once!"';
/** DATA.OVL 0x70c8 @0x08b5: género masculino (g_party_records+9==0x0b). */
const CAPTURE_GENDER_MALE = "man ";
/** DATA.OVL 0x70c0 @0x08b1: género femenino (g_party_records+9==0x0c). */
const CAPTURE_GENDER_FEMALE = " lady ";

/**
 * Guardias del Palacio (type 0x70, npcs.json loc 18 slots 8-15) en la planta del
 * party, tal como los expone el gestor de NPCs. Alimenta el trigger real de captura
 * (`blackthornGuardCaptureTriggers`): el ataque que dispara `blackthorn_capture`
 * (npc_engine 0x13a7 `cmp byte[bx],0x70`) exige un guardia atacante. Vacío fuera de
 * loc 0x12 o sin gestor de NPCs.
 */
function palaceGuards(ctx: CaptureCtx): GuardActor[] {
  const pos = ctx.state.position;
  if (!ctx.npcManager) return [];
  // ⚠ NO se filtra por `type === 0x70` (#59). El binario no arma el slot «el guardia
  // más cercano»: lo arma el ÚLTIMO candidato del barrido ascendente de índices, sea
  // guardia o no. Si aquí se descartan los no-guardias, el desempate se pierde ANTES
  // de que el predicado pueda verlo, y la captura SOBRE-DISPARA. Van todos, con su
  // slot y su aiType, y `palaceGuardAdjacent` decide quién gana y si es guardia.
  const hora = ctx.state.time.hour;
  return ctx.npcManager.npcsAt(pos.location, pos.floor).map((n) => ({
    x: n.x,
    y: n.y,
    type: n.type,
    floor: n.z,
    slot: n.slot,
    // El `aiType` es el de la RANURA HORARIA (#64): `scheduleIndex` calca el selector
    // `NPC.OVL 0x12e0,` que el binario alimenta con `g_hour` (`TOWN.OVL 1668,`).
    // Un NPC sin horario resuelve a 0 = NO arma, el MISMO defecto conservador que
    // `guard-encounters.ts:checkGuardTribute`. Antes esta capa dejaba `undefined` para
    // caer en un `?? 4` (armado) que la otra no tenía: esa asimetría era el defecto.
    aiType: n.aiTypes ? n.aiTypes[scheduleIndex(n.times ?? [0, 0, 0, 0], hora)] : 0,
    dialogNumber: n.dialogNumber,
  }));
}

/**
 * ¿Se dispara la captura de Blackthorn este turno? (npc_engine TOWN 0x1352 →
 * 0x12ae). Devuelve los eventos de la escena si dispara (un prompt de
 * interrogatorio que PAUSA el turno, o el depósito directo si los 8 santuarios ya
 * cayeron), o `null` si no dispara.
 *
 * TRIGGER (F1.7-T5, sustituye el gate POR-TURNO aproximado de T2): la captura la
 * lanza el ATAQUE de un guardia ADYACENTE, no el mero hecho de estar en el Palacio.
 * ADYACENCIA NECESARIA (asm-derivada): npc_engine (0x1352) sólo corre para un NPC
 * activo `[0x65bf]`, que sólo se fija por el fast-path de adyacencia manhattan==1
 * (0x06E4 0x0723; `[0x65bf]` = 2 escrituras en NPC.OVL). Luego 0x12ae re-gatea loc
 * 0x12 + `party_conscious_state >= 0`. ⇒ hay que estar ADYACENTE a un guardia.
 *
 * SUFICIENCIA (30-07, re/notes/talk-031e-resolucion.md): B-RUNTIME por testigo
 * (2026-07-14) y ahora DERIVADA — la rama npc_engine 0x13b4 con `result==1` llama al
 * ex-«opaco 0x1912», resuelto: TALK 0x031E → guard_demand 0x1e2, que sin insignia
 * devuelve ret 1 SILENCIOSO → 0x12ae. El clon (adyacencia sola ⇒ captura) calca el
 * caso sin-insignia; el reto-en-la-intercepción CON insignia es la tarjeta T-A. El
 * loop de persecución no-adyacente (0x083d `rand(0,0x3f)`) es MOVIMIENTO aparte
 * (Clase C, `manager.ts:fleeStep`). Determinista, sin RNG.
 */
export function checkBlackthornCapture(ctx: CaptureCtx): GameEvent[] | null {
  // T-B (2026-07-30): AQUÍ VIVÍA `blackthornPassGranted`, un pase PERMANENTE que
  // cortaba la re-captura. Retirado: el binario no escribe pase alguno — las únicas
  // escrituras de estado global de TALK 0x01e2 son `g_gold` (0x0225, 0x029d), y
  // «Pass, friend!» (DS 0x913a → `jmp 0x22b`, `sub ax,ax`) sólo devuelve 0 para ESA
  // interacción. El turno siguiente la pasada de NPCs vuelve a armar `[0x65bf]` y el
  // reto se repite. Ver re/notes/tc-result-producer.md §3.
  if (!blackthornGuardCaptureTriggers(ctx.state, palaceGuards(ctx))) return null;
  // T-A: la intercepción no captura a ciegas — EJECUTA `guard_demand` (TALK 0x01e2)
  // entera. En loc 0x12 su primer gate es la insignia (0x02a4 `cmp
  // [g_time_spell],0x1d`): sin ella `jmp 0x216` = ret 1 SILENCIOSO → captura (la vía
  // de abajo). CON ella el binario imprime el reto (0x02ae) y hace `getstring`
  // (0x02d2) DENTRO de la intercepción; el veredicto lo da `submitGuardPassword`.
  if (ctx.state.timeSpell === TIME_SPELL_BADGE && ctx.challengePassword) return ctx.challengePassword();
  return runCaptureScene(ctx);
}

/**
 * La ESCENA de captura sin el trigger (0x12ae ya adjudicado): interrogatorio del
 * trono, o depósito directo si los 8 santuarios cayeron. Se invoca desde el trigger
 * de adyacencia y desde la ESCALADA del reto de password fallado en la intercepción
 * (T-A: ret 1 de TALK 0x01e2 → npc_engine 0x13d6 → 0x12ae).
 */
export function runCaptureScene(ctx: CaptureCtx): GameEvent[] {
  const shrine = pickInterrogationShrine(ctx.state);
  if (shrine === null) {
    // Los 8 santuarios cayeron (BLCKTHRN 0x0665: si>=8): sin interrogatorio, sólo
    // deposita. La venda (0x0652) SÍ se imprime (precede al bucle de santuarios);
    // luego 0x0665 salta a 0x08e7 sin trono. El motor confisca las llaves y (10,7).
    blackthornCapture(ctx.state, [], ctx.shrines?.mantras ?? []);
    return finishCaptureDeposit(ctx, [CAPTURE_BLINDFOLD]);
  }
  ctx.pending.current = {
    shrine,
    virtue: ctx.shrines?.virtues?.[shrine] ?? "",
    mantra: ctx.shrines?.mantras?.[shrine] ?? "",
    numLiving: countLiving(ctx.state),
    responses: [],
  };
  // Monólogo del trono (BLCKTHRN 0x060e, prints 0x0652→0x08ca) ANTES de la 1ª
  // pregunta (interrogate 0x054a se llama en 0x08d0).
  const texts = captureSceneMonologue(ctx);
  const msg = (i: number): GameEvent => ({ kind: "message", text: texts[i] ?? "" });
  // #324 — CON la rejilla del asset, el chorro se parte en sus BEATS: los prints del
  // binario van intercalados con el apagón de la venda, el montaje de la sala, los
  // guiones del VM y dos esperas de tecla (orden y offsets en cada builder). SIN
  // rejilla, la degradación es el chorro previo (sólo texto) — mismos textos, mismo
  // prompt, cero eventos nuevos.
  if (ctx.captureTiles && ctx.scene) {
    const scene = initCaptureScene(
      ctx.state.characters.slice(0, ctx.pending.current.numLiving).map((c) => c.class),
    );
    ctx.scene.current = scene;
    const events: GameEvent[] = [
      msg(0), // venda (0x0652)
      sceneEvent(buildBlackoutIntroScript()), // pausa(2) + 5 arrastres (0x0672-0x06ae)
      msg(1), // «Strong guards drag thee away!» (0x06b0)
      sceneEvent(buildThroneMountScript(scene, ctx.captureTiles)), // 18 arrastres + sala (0x06b9-0x07d1)
      msg(2), // «chained and manacled!» (0x07dc)
      sceneEvent(buildChainedPauseScript()), // pausa(0x32) (0x07df)
      msg(3), // «Footsteps!» (0x07ea)
      sceneEvent(buildBlackthornEntryScript(scene)), // guardias + Blackthorn (0x07ed-0x0878)
      msg(4), // saludo con el nombre (0x087f-0x0891)
      keyWait(), // 0x0894
      msg(5), // «GUARD! Release…» (0x0897-0x08bc)
      sceneEvent(buildGuardReleaseScript(scene)), // guion 0x370e (0x08bf)
      msg(6), // rec11 «Wait!…» (0x08c6)
      keyWait(), // 0x08cd
      { kind: "blackthorn-interrogation-prompt", text: interrogationQuestion(ctx, 0) },
    ];
    return events;
  }
  const events: GameEvent[] = texts.map((text) => ({ kind: "message", text }));
  events.push({ kind: "blackthorn-interrogation-prompt", text: interrogationQuestion(ctx, 0) });
  return events;
}

/**
 * Textos de la escena del trono impresos entre la captura y la 1ª pregunta
 * (BLCKTHRN 0x060e, vía de interrogatorio). El saludo intercala el NOMBRE del
 * Avatar (DS 0x55a8 = g_party_records[0].name, 0x088a) y la orden a la guardia la
 * palabra de GÉNERO del Avatar (g_party_records+9: 0x0c→" lady ", 0x0b→"man ",
 * otro→sin palabra), ambos cosméticos (no estado). Los sprites y las pausas de la
 * escena son L3/UI, no texto.
 */
function captureSceneMonologue(ctx: CaptureCtx): string[] {
  const avatar = ctx.state.characters[0];
  // Nombre EFECTIVO (core/party.effectiveName, fuente ÚNICA del fallback): el
  // binario imprime DS 0x55a8 crudo, pero su creación no admite nombre vacío
  // (FONT.OVL 0x0bcf re-gate), así que aquí no hay conducta original que calcar.
  // Sin él, el saludo salía «"Ah, !» (vídeo del usuario, 24-08) mientras el panel
  // decía «Avatar»: mismo dato, dos caras — la clase que la fuente única cierra.
  const name = effectiveName(avatar?.name);
  const gender =
    avatar?.gender === 0x0c
      ? CAPTURE_GENDER_FEMALE
      : avatar?.gender === 0x0b
        ? CAPTURE_GENDER_MALE
        : "";
  return [
    CAPTURE_BLINDFOLD,
    CAPTURE_DRAG,
    CAPTURE_CHAINED,
    CAPTURE_FOOTSTEPS,
    tf(CAPTURE_GREET_TEMPLATE, name),
    tf(CAPTURE_GUARD_TEMPLATE, gender),
    BLCKTHRN_MISCMSG.interrogationIntro,
  ];
}

/** Texto de la pregunta de la ronda `round` (0..3) del interrogatorio en curso. */
function interrogationQuestion(ctx: CaptureCtx, round: number): string {
  const p = ctx.pending.current;
  if (!p || round >= 3) return BLCKTHRN_MISCMSG.finalQuestion;
  // COMPUESTO → tf() en call-site: plantilla + virtud (t(virtud) la traduce; en 'en'
  // es identidad byte-exacta con la concatenación prefijo+virtud+`?"` del binario).
  return tf(INTERROGATION_QUESTION_TEMPLATES[round]!, p.virtue);
}

/**
 * Resuelve una ronda del interrogatorio de captura (BLCKTHRN 0x054a). Añade la
 * respuesta tecleada y, si el interrogatorio no ha terminado, devuelve la
 * siguiente pregunta (con el aviso rec7 si fue el primer fallo con party>1). Al
 * completar, corre el motor `blackthornCapture` (traición/mazmorra/péndulo +
 * depósito) y emite los mensajes de MISCMSG. Espejo de resolveTrollToll /
 * submitShrineRestore. Idempotente sin interrogatorio activo (devuelve []).
 */
export function submitInterrogationResponse(ctx: CaptureCtx, response: string): GameEvent[] {
  const p = ctx.pending.current;
  if (!p) return [];
  p.responses.push(response.trim());
  const round = p.responses.length - 1;
  const missed = !mantraMatches(p.responses[round] ?? "", p.mantra);
  // #288 — BLCKTHRN 0x05aa-0x05b4: fallo con `warned` ya armado → `push 2 ; call
  // 0xffffacec` (kernel 0x4F7C rebasado, §0 blackthorn.md) = advance_clock(2). Los
  // gates del asm, calcados: numLiving>=2 (0x059e `cmp [bp+4],2 ; jge` — el Avatar
  // solo sale por la mazmorra SIN reloj) y warned!=0 (0x05aa — el PRIMER fallo sólo
  // avisa, 0x05f4). Como el bucle 0x054a sólo continúa fallando (el match retorna en
  // 0x0595), `warned` se arma siempre en la ronda 0 ⇒ `round >= 1` ≡ warned!=0.
  // Corre también en la ronda del péndulo (si=3: 0x05b4 precede al switch cuyo caso
  // 3 llama sacrifice_member(1), 0x05ea). El match NUNCA llega aquí (0x056e je 0x59e
  // es la rama del fallo). Total observable: +2 min por ronda fallada 1..3 (máx 6).
  if (missed && round >= 1 && p.numLiving > 1) {
    advanceClock(ctx.state, 2, ctx.rand, ctx.sky);
  }
  if (!interrogationComplete(ctx)) {
    const events: GameEvent[] = [];
    const scene = ctx.captureTiles && ctx.scene ? ctx.scene.current : null;
    // Primer fallo con party>1: aviso DOBLE (warned=1, BLCKTHRN 0x05f4 → call 0x51c):
    // rec7 (buf 0xb447 = MISCMSG 0x229) + rec8 (buf 0xb47d = MISCMSG 0x25f) + nombre del
    // compañero (DS 0x55c8 FIJO = roster slot 1, print 0x0531) + DS 0x6fac ' die!" '
    // (fileoff 0x6fbc) + DS 0x6fb4 '\n\n'. #324: ENTRE rec7 y rec8 corre anim_vm(0x36da)
    // (0x0523) — el guardia arrastra al compañero a la mesa de tortura y el reloj de
    // arena se monta LLENO — y tras el « die!" » hay espera de tecla (0x053f). El '\n\n'
    // final de 0x6fb4 va POST-tecla en el binario pero aquí sigue fundido en la
    // plantilla (corpus i18n intacto): divergencia de SOLO BLANCOS, declarada.
    if (missed && round === 0 && p.numLiving > 1) {
      events.push({ kind: "message", text: BLCKTHRN_MISCMSG.warning });
      if (scene) events.push(sceneEvent(buildWarningScript(scene)));
      events.push({
        kind: "message",
        // COMPUESTO → tf() en call-site (choke i18n); nombre = slot 1 del roster (0x55c8).
        text: tf(
          '\n\n"I will ask thee until the sand has fallen. And then will {} die!" \n\n',
          ctx.state.characters[1]?.name ?? "",
        ),
      });
      if (scene) events.push(keyWait()); // 0x053f
    }
    // #324 — escalada (fallo con warned, rondas 1-2): la ARENA CAE — interrogate
    // 0x05da (si==1 → 0xEB) / 0x05e2 (si==2 → 0xE8). El advance_clock(2) ya corrió
    // arriba (#288). El caso si==0 → 0xEA (0x05d2) es inalcanzable (ver el módulo).
    if (scene && missed && round >= 1 && p.numLiving > 1) {
      const hourglass = buildHourglassScript(round);
      if (hourglass) events.push(sceneEvent(hourglass));
    }
    events.push({
      kind: "blackthorn-interrogation-prompt",
      text: interrogationQuestion(ctx, round + 1),
    });
    return events;
  }
  // Terminó: corre el motor con TODAS las respuestas (deriva santuario/vivos igual,
  // el estado no cambió durante los prompts) y deposita. El nombre de la víctima del
  // péndulo se lee ANTES de que el motor compacte el roster (sacrifice_member 0x0438
  // saca el 2º miembro vivo; el mismo que `sacrificeFirstCompanion`).
  ctx.pending.current = null;
  const victimName = secondLivingName(ctx.state);
  const scene = ctx.captureTiles && ctx.scene ? ctx.scene.current : null;
  const result = blackthornCapture(ctx.state, p.responses, ctx.shrines?.mantras ?? []);
  const r = result.interrogation;
  // #324 — CON escena montada, los mensajes del desenlace se intercalan con sus
  // segmentos: el sacrificio (pausa+sirena+explosión+mesa, sacrifice_member 0x03ae),
  // las esperas de tecla (0x04f6 / 0x0510) y los guiones de salida (0x369e o, tras el
  // péndulo y sólo si Blackthorn sigue en pie —0x08d9—, 0x3716).
  if (scene && r) {
    const events: GameEvent[] = [];
    if (r.outcome === "betrayal") {
      if (r.rewardedWithLife) {
        // Avatar solo: perdón sin sacrificio (0x058e), luego 0x0510.
        events.push({ kind: "message", text: BLCKTHRN_MISCMSG.rewardedLife });
      } else {
        // rec5 se imprime DENTRO de sacrifice_member(0) ANTES de la sirena (0x03c2).
        events.push({ kind: "message", text: BLCKTHRN_MISCMSG.mercifulDeath });
        events.push(sceneEvent(buildSacrificeScript(scene)));
        events.push(sacrificeExplosionEvent(scene));
      }
      events.push(keyWait()); // 0x0510 (primer gesto de la cola común)
      events.push(sceneEvent(buildFinaleScript(scene))); // anim_vm(0x369e)
    } else if (r.outcome === "dungeon") {
      events.push({ kind: "message", text: BLCKTHRN_MISCMSG.toDungeon });
      events.push(keyWait()); // 0x0510
      events.push(sceneEvent(buildFinaleScript(scene))); // anim_vm(0x369e)
    } else {
      // Péndulo (mode=1): rec4 (0x03bc) · escena del sacrificio · «\n\n{} is sliced in
      // half! » (0x04e1-0x04f3) · tecla (0x04f6) · rec6 (0x04f9). El putchar('\n') de
      // 0x0500 va fundido en el flujo textual previo (sin cambio de corpus).
      events.push({ kind: "message", text: BLCKTHRN_MISCMSG.pendulum });
      events.push(sceneEvent(buildSacrificeScript(scene)));
      events.push(sacrificeExplosionEvent(scene));
      events.push({ kind: "message", text: tf("\n\n{} is sliced in half! ", victimName) });
      events.push(keyWait()); // 0x04f6
      events.push({ kind: "message", text: BLCKTHRN_MISCMSG.treachery });
      if (blackthornOnStage(scene)) {
        events.push(sceneEvent(buildBlackthornExitScript(scene))); // anim_vm(0x3716)
      }
    }
    if (ctx.scene) ctx.scene.current = null;
    return finishCaptureDeposit(ctx, [], events);
  }
  const messages = r ? interrogationMessages(r, victimName) : [];
  return finishCaptureDeposit(ctx, messages);
}

/**
 * ¿Ha terminado el interrogatorio tras la última respuesta? Réplica de la
 * terminación del bucle 0x054a: acierto (traición), Avatar solo que falla
 * (mazmorra), o 4ª ronda con party>1 (péndulo). Sin mutación.
 */
function interrogationComplete(ctx: CaptureCtx): boolean {
  const p = ctx.pending.current;
  if (!p) return true;
  const round = p.responses.length - 1;
  if (mantraMatches(p.responses[round] ?? "", p.mantra)) return true; // traición
  if (p.numLiving < 2) return true; // mazmorra (Avatar solo, fallo)
  return round >= 3; // péndulo (4ª ronda)
}

/**
 * Mensajes observables del resultado del interrogatorio (MISCMSG). El péndulo
 * nombra a la víctima entre la caída de la hoja y la acusación de traición
 * (sacrifice_member(1) 0x04db-0x04f3); la muerte "misericordiosa" de la traición
 * NO la nombra (rama mode=0, 0x04df je 0x500).
 */
function interrogationMessages(r: InterrogationResult, victimName: string): string[] {
  if (r.outcome === "betrayal") {
    return [r.rewardedWithLife ? BLCKTHRN_MISCMSG.rewardedLife : BLCKTHRN_MISCMSG.mercifulDeath];
  }
  if (r.outcome === "dungeon") return [BLCKTHRN_MISCMSG.toDungeon];
  // Péndulo: rec4 + (DS:0x6F92 "\n\n" + nombre de la víctima [slot 15, DS:0x5788] +
  // DS:0x6F96 " is sliced in half! ", como PLANTILLA tf — compuesto → call-site) + rec6.
  return [
    BLCKTHRN_MISCMSG.pendulum,
    tf("\n\n{} is sliced in half! ", victimName),
    BLCKTHRN_MISCMSG.treachery,
  ];
}

/**
 * Nombre del 2º miembro VIVO (status != 'D') sobre party_size — la víctima que
 * `sacrificeFirstCompanion`/sacrifice_member (BLCKTHRN 0x0438) saca. "" si no hay
 * un 2º vivo. Se lee ANTES de que el motor compacte el roster.
 */
function secondLivingName(state: GameState): string {
  const n = state.partySize ?? state.characters.length;
  let living = 0;
  for (let i = 0; i < n; i++) {
    if (state.characters[i]?.status !== "D") {
      living++;
      if (living === 2) return state.characters[i]?.name ?? "";
    }
  }
  return "";
}

/**
 * Cierre común de la escena de captura: emite los mensajes de resultado +
 * map/party-changed. El motor `blackthornCapture` ya fijó el destino ENTERO:
 * llaves=0, (10,7), loc 0x12 y **planta −1** (g_floor=0xff, BLCKTHRN 0x08e7 =
 * el sótano con la celda; derivación completa en `blackthornCaptureDeposit`).
 *
 * AQUÍ VIVÍA la ex-Clase C «planta del depósito»: este cierre re-fijaba
 * `floor = 0` («conducta observable segura») y encastraba al party dentro del
 * muro sur del almacén de barriles — (10,7) en z=0 es tile 79, muro — con
 * «¡Bloqueado!» en las cuatro direcciones (vídeo del usuario, 24-08). Retirado:
 * la planta la escribe el motor, igual que x/y/keys/location.
 */
function finishCaptureDeposit(
  ctx: CaptureCtx,
  messages: string[],
  pre: GameEvent[] = [],
): GameEvent[] {
  const events: GameEvent[] = [...pre, ...messages.map((text): GameEvent => ({ kind: "message", text }))];
  events.push({ kind: "map-changed" });
  events.push({ kind: "party-changed" });
  return events;
}
