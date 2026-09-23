/**
 * TalkConsole — conversación por CONSOLA (piel fiel/shader), extraída de boot()
 * (TRAMO 2 del refactor estructural, auditoría MANT-1/ARQ-2).
 *
 * El binario NUNCA abre ventana — **VIGENTE, y MEDIDO en #327** (el mismo absoluto es FALSO
 * para TIENDA y se retiró allí; aquí resiste, así que se confirma en vez de tacharse):
 * TALK.OVL da CERO llamadas a `set_text_window` (kernel 0x1c22) y CERO glifos de marco,
 * contra 2 y siete de SHOPPES/SHOPPES3 en el mismo censo. Acotación del sujeto: lo que no
 * abre ventana es la CONVERSACIÓN — la rama de MERCADER sale de TALK a SHOPPES (ret 2), y
 * ésa sí la abre. La conversación entera ocurre en la CONSOLA del
 * marco EGA (TALK.OVL 0x041c → texto del NPC por print_string 0x1850; la keyword se
 * TECLEA inline con getstring, ecoada tras ':'). El DialoguePanel DOM (chat con
 * historial + chips clicables) era QoL EXCLUSIVO de la piel dev (jubilada). Aquí se
 * conduce la MISMA `Conversation` (core intacto) por el printer fiel
 * (hud→pushConsole→t(), correcto para contenido) + un getstring `text` inline
 * (precedente: el Yell de main.ts). censo-ui-flujos §2.
 *
 * Deps inyectadas (patrón shop-console.ts): el prompt vivo se arma vía
 * `prompts.current` (PromptManager) y el gate del cursor se re-deriva con
 * `refreshAwaiting` — misma semántica que los closures originales.
 */
import { Conversation, type DialogueOutput, type DialoguePassage } from "../core/dialogue/conversation.js";
import { applyDialogueEffect } from "../core/dialogue/effects.js";
import { avatarName, partyEffectiveNames } from "../core/party.js";
import { TALK_UI } from "../core/world/cmd-strings.js";
import { getLang, t, tf } from "../i18n/index.js";
import { aliasesForKeywordEs } from "../i18n/keyword-alias-es.js";
import type { Game } from "../core/game.js";
import type { PendingPrompt } from "./prompt-manager.js";

/** Objetivo de (T)alk resuelto por el core (NPC + su TLK script). */
export type TalkTarget = NonNullable<ReturnType<Game["talkTarget"]>>;

/**
 * Auto-avance del op `Pause` (0x83) del TLK — DERIVADO, no calibrado sobre vídeo: el ASM
 * fija el CONTEO (TALK 0x0fae `cmp si, 0x1c` = 28 vueltas de `delay(1)`, 0x617a → kernel
 * 0x20fa) y la unidad es el tick del INT 1Ch del BIOS (18,2 Hz ≈ 54,9 ms — la constante
 * de hardware citada en re/notes/camp-bard-anim.md). 28 / 18,2 Hz ≈ 1538 ms. Cualquier
 * tecla lo corta antes (el bucle sondea 0x5dde en cada vuelta), igual que aquí.
 */
const TALK_PAUSE_MS = 1538;

export interface TalkConsoleDeps {
  game: Game;
  hud: {
    message(text: string, rune?: boolean): void;
    /** Fila MIXTA (#364-c): tramos {text,rune} — el habla rúnica de TALK en UNA fila. */
    messageSegments(segments: readonly { text: string; rune: boolean }[]): void;
    echoCursor(text: string): void;
  };
  /** Prompt vivo (PromptManager): la consola arma aquí su getstring `text`. */
  prompts: { current: PendingPrompt | null };
  refreshAwaiting: () => void;
  /**
   * `true` bajo automatización (mismo discriminante que ShrineKeyPacer, #294:
   * `TROLL_UNIT_MS === 0`): las pausas del guion NO aparcan y el volcado drena síncrono
   * — el orden de eventos, los digests del espejo y los sellos e2e quedan IDÉNTICOS al
   * previo a esta ficha. Las pausas son sólo para el jugador humano.
   */
  instant: () => boolean;
}

export class TalkConsole {
  private conversation: Conversation | null = null;
  private talkingTo: TalkTarget | null = null;
  /**
   * Diario de la conversación recién cerrada y su identidad, para que la
   * plataforma alcance a persistir las últimas líneas (p. ej. la despedida)
   * ya con `active:false`. `start()` lo limpia al abrir la siguiente charla.
   */
  private lastPassages: readonly DialoguePassage[] = [];
  private lastIdentity: { source: string | null; npc: string } = { source: null, npc: "" };
  /**
   * VOLCADO APARCADO en una pausa del guion (bug 2, carril talk-celda-paginacion): el
   * resto de outputs pendientes tras una línea con `pause`, + la fase (efectos sí/no) y
   * la CLASE de la espera. Mismo patrón que ShrineKeyPacer (#294) — mismo kernel, además:
   * el KeyWait del TLK (0x8F → TALK 0x1010 `call 0x66ec`) espera en `getkey 0x266c`,
   * la misma rutina de los once keywaits del rito. `Pause` (0x83) es la variante
   * CRONOMETRADA (TALK 0x0f92-0x0fb3: 28 ticks INT 1Ch ≈ 1,54 s, una tecla la corta).
   */
  private parked: { rest: DialogueOutput[]; inputPhase: boolean; kind: "key" | "timed" } | null =
    null;
  /** Temporizador del auto-avance de `Pause` (sólo kind="timed"). `setTimeout` PELADO
   *  (globalThis, no `window.`): los tests de vitest corren en entorno node. */
  private pauseTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(private readonly deps: TalkConsoleDeps) {}

  /** ¿Conversación abierta? (gate del cursor F-G + hook e2e dialogueOpen). */
  get active(): boolean {
    return this.conversation != null;
  }

  /**
   * Identidad ESTABLE del interlocutor vivo (`location:slot`), o null fuera de
   * charla. El host de plataforma la usa como clave del diario de temas
   * descubiertos: sobrevive al guardado y no depende del nombre mostrado.
   */
  get sourceId(): string | null {
    const npc = this.talkingTo?.npc;
    return npc ? `${npc.location}:${npc.slot}` : null;
  }

  /** Nombre mostrado del interlocutor vivo (vacío fuera de charla). */
  get partnerName(): string {
    return this.npcName();
  }

  /**
   * Keywords ya preguntadas en ESTA conversación, en orden. Read-only; el host
   * las acumula por interlocutor para las sugerencias de temas descubiertos.
   */
  get askedTopics(): readonly string[] {
    return this.conversation?.askedKeywords ?? [];
  }

  /**
   * Temas que el host puede OFRECER como botones: keywords válidas que el NPC ya
   * ha pronunciado, más las implícitas y `bye`. Nunca enumera el .TLK entero.
   */
  get discoveredTopics(): readonly string[] {
    return this.conversation?.discoveredTopics ?? [];
  }

  /**
   * Diario de conversación para la plataforma: las líneas habladas por el NPC
   * (vivas o de la charla recién cerrada) con su tema, hablante e identidad
   * estable. El host las persiste con el lugar para una búsqueda posterior.
   */
  get journal(): readonly (DialoguePassage & { source: string | null; npc: string })[] {
    const source = this.sourceId ?? this.lastIdentity.source;
    const npc = this.conversation ? this.npcName() : this.lastIdentity.npc;
    const passages = this.conversation?.passages ?? this.lastPassages;
    return passages.map((passage) => ({ ...passage, source, npc }));
  }

  /**
   * ¿Volcado aparcado esperando tecla? — el keydown de main.ts enruta aquí la PRIMERA
   * tecla (cualquiera vale: el `getkey 0x266c` del KeyWait descarta el retorno, y el
   * bucle del Pause corta con el primer sondeo positivo de 0x5dde). Cubre las DOS
   * clases: también la cronometrada se corta con tecla, como en el binario.
   */
  get keyWaiting(): boolean {
    return this.parked !== null;
  }

  /**
   * ¿La espera lleva el cursor animado en la fila viva? SÓLO el KeyWait: su espera es el
   * bucle de `getkey 0x266c`, que parpadea el cursor en cada iteración (0x267f
   * `call 0x1b38` — la clase derivada en el cabo #341 §7.2 / awaiting-gate.ts). El
   * bucle del Pause (TALK 0x0f92) NO pasa por 0x266c ⇒ sin cursor.
   */
  get cursorWaiting(): boolean {
    return this.parked?.kind === "key";
  }

  /** Tecla recibida con el volcado aparcado: reanuda. (Cualquier tecla, ver keyWaiting.) */
  consumeKey(): void {
    this.resume();
  }

  /**
   * Reanuda el volcado aparcado. `parked` se limpia ANTES de re-entrar en `render` —
   * el guion encadena pausas (el compañero de celda de Blackthorn lleva CUATRO KeyWaits
   * seguidos) y el render puede volver a aparcar en el acto: si no, la segunda espera
   * escribiría sobre un campo que este retorno iba a borrar (la lección de ShrineKeyPacer).
   */
  private resume(): void {
    const parked = this.parked;
    if (!parked) return;
    this.parked = null;
    if (this.pauseTimer !== null) {
      clearTimeout(this.pauseTimer);
      this.pauseTimer = null;
    }
    this.deps.refreshAwaiting();
    this.render(parked.rest, parked.inputPhase);
  }

  private npcName(): string {
    return (
      this.talkingTo?.script.name
        .map((it) => (it.kind === "text" ? it.text : ""))
        .join("")
        .trim() ?? ""
    );
  }

  /**
   * Cierra la conversación de consola y devuelve el control al mapa (reactiva el cursor).
   *
   * Éste es el embudo del `0x1305` del binario: `run_scripted_conversation` TALK 0x127E
   * llama al ROBO DE FAULINEI ahí, incondicionalmente, y a este `end()` llegan igual el
   * fin normal (`render` sin prompt armado) y el ESC del getstring (`cancel`). La mecánica
   * vive en el core (`Game.faulineiTheftOnTalkEnd` → `world/faulinei-theft.ts`); aquí sólo
   * se rinde el mensaje por el impresor fiel, como el resto del contenido de la charla.
   */
  private end(): void {
    for (const m of this.deps.game.faulineiTheftOnTalkEnd()) this.deps.hud.message(m);
    // La charla cierra: se conserva su diario (con la despedida incluida) hasta
    // que empiece otra, para que la plataforma lo persista con `active:false`.
    if (this.conversation) this.lastPassages = this.conversation.passages;
    this.conversation = null;
    this.talkingTo = null;
    // Higiene del aparcamiento (bug 2): un cierre con volcado aparcado (no debería
    // ocurrir — la tecla que cierra la habría consumido el keyWaiting — pero un start()
    // re-entrante pasaría por aquí) no puede dejar un timer vivo apuntando a un render
    // de una conversación muerta.
    this.parked = null;
    if (this.pauseTimer !== null) {
      clearTimeout(this.pauseTimer);
      this.pauseTimer = null;
    }
    this.deps.refreshAwaiting();
  }

  /**
   * Prompt de keyword del getstring fiel: imprime la línea de prompt ("Your interest?"
   * tras cada respuesta; "You respond-" cuando el NPC PREGUNTA / pide el nombre) y arma
   * la fila de eco viva con el cursor ':'. La keyword tecleada se ecoa tras él
   * (echoSetLast, en el reductor `text` del PromptManager); Enter la envía al
   * intérprete; Enter en vacío = "bye" (el core lo trata como despedida); ESC /
   * vaciar+backspace cierra la charla.
   */
  private armPrompt(question: boolean): void {
    const { hud, prompts, refreshAwaiting } = this.deps;
    hud.message(question ? TALK_UI.respond : TALK_UI.interest);
    hud.echoCursor(TALK_UI.cursor); // ':' → fila de getstring SIN bullet (cont), con cursor
    prompts.current = {
      type: "text",
      prefix: TALK_UI.cursor,
      buffer: "",
      max: 0xf, // getstring TALK.OVL 0xa33 (15 chars)
      resolve: (word) => this.input(word),
      // Régimen FIEL del getstring del kernel (0x3b1c): ESC borra la línea y el
      // prompt SIGUE — en 1988 la conversación no tiene válvula de ESC (el trono
      // de Blackthorn te retiene en el label 4 hasta dar un nombre del grupo; la
      // salida en «Your interest?» es Enter-vacío → bye). El ESC-cancelaba-la-
      // conversación de antes era divergencia (reporte usuario 24-08).
      escKernel: true,
      // `cancel` queda para teardown programático (hoy sin llamador: handleKey ya
      // no lo alcanza con escKernel; se conserva por el contrato del tipo).
      cancel: () => this.end(),
    };
    refreshAwaiting();
  }

  /**
   * Rinde a la consola los outputs del intérprete EN ORDEN (líneas del NPC, efectos con
   * sus mensajes, y el prompt). En cuanto emite un prompt, arma el getstring y SUSPENDE;
   * sin prompt, la conversación terminó (bye / EndConversation / JoinParty) → cierra.
   * `inputPhase` reproduce EXACTO el reparto del DialoguePanel para no divergir del sello
   * del Grand Tour: el saludo se sirve con `render(start())` (sólo líneas — sin
   * `applyDialogueEffect`), y sólo `onInput()` aplica efectos.
   */
  private render(outputs: DialogueOutput[], inputPhase: boolean): void {
    const { game, hud } = this.deps;
    const npcName = this.npcName();
    let armed = false;
    for (let i = 0; i < outputs.length; i++) {
      const out = outputs[i]!;
      if (out.kind === "line") {
        // pushConsole/pushConsoleSegments parten \n + t(). Una línea MIXTA (#364-c,
        // habla rúnica de TALK) viaja por tramos: la palabra rúnica queda en SU fila,
        // con su fuente, sin el partido en tres filas del flushLine antiguo; el flag
        // por-línea (`rune`) cubre la línea homogénea rúnica (TALK 0x500/0x56b).
        if (out.text.trim().length > 0) {
          if (out.segments) hud.messageSegments(out.segments);
          else hud.message(out.text, out.rune);
        }
        // ── PAUSA del guion (bug 2, carril talk-celda-paginacion) ────────────────────
        // El TLK viene sembrado de KeyWait/Pause justo porque el kernel de texto NO
        // pagina solo (el intérprete 0x0f32 imprime carácter a carácter sin contar
        // líneas): sin honrarlos, la charla del compañero de celda volcaba sus seis
        // secciones de golpe (captura carcel-talk-error.jpeg). Se aparca el RESTO del
        // volcado — el orden lineal del guion se conserva: los efectos pendientes
        // viajan en `rest` y se aplican al reanudar, como en 1988, donde el opcode
        // posterior al keywait no corre hasta que el jugador suelta la espera.
        // Bajo automatización (`instant`) no se aparca nada (ver TalkConsoleDeps).
        if (out.pause && !this.deps.instant()) {
          this.parked = { rest: outputs.slice(i + 1), inputPhase, kind: out.pause };
          if (out.pause === "timed") {
            // 0x83 Pause: auto-avance a los 28 ticks INT 1Ch (TALK 0x0fae `cmp si,0x1c`
            // × ~54,9 ms/tick, camp-bard-anim.md) ≈ 1538 ms; una tecla lo corta antes.
            this.pauseTimer = setTimeout(() => {
              this.pauseTimer = null;
              this.resume();
            }, TALK_PAUSE_MS);
          }
          this.deps.refreshAwaiting();
          return; // NI end() NI markNpcMet: el volcado sigue vivo, sólo aparcado.
        }
      } else if (out.kind === "prompt") {
        this.armPrompt(out.question);
        armed = true;
        break;
      } else if (out.kind === "effect" && inputPhase) {
        // D10: el handler necesita el TILE del NPC para el gate de mendigo (TALK 0x0619
        // `and al,0xfc / cmp al,0x6c` sobre [bx+0x5c5a]). NpcRuntime.type es ese byte.
        const res = applyDialogueEffect(game.state, out.effect, npcName, this.talkingTo?.npc.type);
        for (const m of res.messages) hud.message(m);
        // Bug 1: JoinParty con éxito (o con el NPC ya alistado) despawnea al NPC hablado
        // — TALK 0x0916/0x091d (npc_dead_bit_set + npc_clear_slot); ver Game.despawnJoinedNpc.
        if (res.despawnNpc && this.talkingTo) game.despawnJoinedNpc(this.talkingTo.npc);
        // CallGuards (0x8B): suena la ALARMA del pueblo — TALK 0x0ff8 → TOWN 0x0958,
        // guardias hostiles + civiles al 50% en fuga; ver Game.talkCallGuards. La charla
        // SIGUE (0x0ffb jmp 0xf5e): el cierre lo pone el EndConversation del guion.
        if (res.alarm) game.talkCallGuards();
      }
    }
    if (this.conversation?.metAvatar && this.talkingTo) game.markNpcMet(this.talkingTo.npc);
    if (!armed) this.end();
  }

  /**
   * Reanuda la conversación de consola con la keyword tecleada (gemelo del onInput del
   * DialoguePanel, pero renderizado por consola).
   */
  private input(text: string): void {
    if (!this.conversation) return;
    this.render(this.conversation.input(text), true);
  }

  /** Abre la conversación con el objetivo ya resuelto (game.talkTarget). */
  start(target: TalkTarget): void {
    const { game } = this.deps;
    this.talkingTo = target;
    // Nueva charla: se descarta el diario y la identidad de la anterior.
    this.lastPassages = [];
    this.lastIdentity = { source: `${target.npc.location}:${target.npc.slot}`, npc: this.npcName() };
    this.conversation = new Conversation(target.script, {
      // Nombre EFECTIVO (core/party.effectiveName): el binario imprime/compara el
      // registro CRUDO (0x55a8), pero su creación no admite nombre vacío (FONT.OVL
      // 0x0bcf re-gate) — el estado sin bautizar es sólo-port, y aquí DEBE regir la
      // misma política que el display: sin ella el trono de Blackthorn (label 4,
      // AskName→IfElseKnowsName→label 4) re-preguntaba el nombre PARA SIEMPRE
      // mientras el panel mostraba «Avatar» (bucle del 24-08).
      avatarName: avatarName(game.state),
      // TALK 0x0eb0: el reto de AskName recorre TODO el grupo, no sólo al Avatar —
      // y compara lo que el panel MUESTRA (nombre efectivo), no el campo crudo.
      partyNames: partyEffectiveNames(game.state),
      npcKnowsAvatar: game.npcKnowsAvatar(target.npc),
      // Moneda de la autopresentación a un desconocido (TALK 0x1153). Sólo la consulta
      // la rama de NPC no conocido, así que con un NPC ya conocido NO se consume nada
      // — igual que el binario, que ni llega al `call`.
      selfIntroRoll: () => game.rollTalkSelfIntro(),
      // Alias de keywords por idioma (i18n §3.1): con lang=es el jugador puede teclear
      // la palabra española ("estrella"→"star"); en `en` es `[]` → sólo inglés (invariante
      // byte-idéntico). El core no importa i18n; se inyecta aquí (getLang + tabla + npcKey).
      aliasFor: (keyword) =>
        getLang() === "es"
          ? aliasesForKeywordEs(keyword, `${target.npc.location}:${target.npc.slot}`)
          : [],
      // Descripción del NPC ("You see {}"): el compuesto entero no pasa el choke t()
      // de la consola (composite-choke, como look2 «Thou dost see {}»), así que se
      // compone POR PIEZAS aquí — plantilla posicional traducida + cuerpo por t().
      // En 'en' `tf` es identidad ⇒ "You see " + body, byte-idéntico.
      seeCompose: (body) => tf("You see {}", body),
      // Traductor de pieza (C8): las comillas del intérprete se componen DESPUÉS
      // de traducir (trampa-del-entrecomillado). En 'en' identidad; la 2ª pasada
      // del choke t() de pushConsole sobre el compuesto ya es identidad.
      tr: (s) => t(s),
    });
    // Conversación por CONSOLA del marco EGA (getstring inline), como el binario
    // (censo-ui-flujos §2).
    this.render(this.conversation.start(), false);
  }
}
