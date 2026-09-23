/**
 * Intérprete de conversaciones .TLK de Ultima V (núcleo puro, sin DOM).
 *
 * Portado de la semántica real de Ultima5Redux:
 *   reference/Ultima5Redux/Ultima5Redux/Dialogue/Conversation.cs
 *     (BeginConversation, ProcessLine, ProcessMultipleLines, TextProcessItem)
 *   reference/Ultima5Redux/Ultima5Redux/References/Dialogue/TalkScript.cs
 *     (SplitIntoSections L928-1032, InitScript, GetQuestionKey L630-639)
 *
 * Consume la salida ESTRUCTURADA del extractor (TalkScript[] serializado en
 * game/assets/talk/*.json). Los tipos del TLK se redefinen aquí para que el core
 * no dependa del paquete `extractor`.
 *
 * Modelo de ejecución: la conversación es una corrutina (generator). Emite
 * `DialogueOutput`s a un buffer y se SUSPENDE en cada punto que requiere input
 * del jugador (el prompt "Your interest?", una pregunta del NPC, o AskName).
 * `start()`/`input()` reanudan la corrutina y devuelven lo emitido desde la
 * última suspensión.
 *
 * Desviación FIEL al binario respecto a Redux (documentada abajo en detalle):
 *  - El matching de keyword NO es `startsWith` (como Redux GetQuestionKey), sino
 *    la subcadena anclada a frontera de palabra del motor DOS (ULTIMA.EXE 0x6f1e
 *    stristr + gate TALK.OVL 0b5b-0b64). Ver `keywordMatches` / `stristrIndex`.
 *    Tarea #50.
 *
 * Desviaciones conscientes respecto a Redux (documentadas):
 *  - [RETIRADA 2026-08-06] Decía: «no se emite la introducción aleatoria "I am
 *    called <name>"… se omite para tener salida reproducible». ERA UN SEÑUELO: este
 *    mismo fichero SÍ la emite (ver `selfIntroRoll` y la rama de NPC desconocido en
 *    `script_`), con su tirada inyectada y su testigo del espejo. Alguien arregló el
 *    código y dejó la declaración, de modo que quien leía la cabecera creía que
 *    faltaba algo que está. La desviación REAL respecto al binario —que la moneda
 *    sale del stream propio y no del reloj de pared— está documentada donde se
 *    aplica, en `ConversationContext.selfIntroRoll`.
 *  - [RETIRADA 2026-08-06] Decía: «JoinParty siempre se acepta… el caller de más alto
 *    nivel gestionará el rechazo». Ya no: se calcan las TRES salidas de
 *    `join_party` (TALK.OVL:0x080a) CON SU EFECTO sobre el flujo — con el grupo lleno
 *    el binario devuelve 0 y la conversación SIGUE. Ver `core/party.joinByName` y
 *    `docs/bugs-del-original.md` §2.7.
 *  - Las líneas compuestas sólo por separadores (NewLine) no emiten output
 *    (se descartan las líneas en blanco); la separación de párrafos ya la da
 *    cada `line` independiente.
 */
import { quoteOpen, quoteClose } from "../../i18n/index.js";

// ─── Tipos del TLK (espejo de extractor/src/parsers/tlk.ts) ──────────────────

export type ScriptItem =
  | { kind: "text"; text: string }
  | { kind: "op"; op: string; data?: number };

export type ScriptLine = ScriptItem[];

export interface QA {
  keywords: string[];
  answer: ScriptLine[];
}

export interface TalkLabel {
  label: number;
  initialLine: ScriptLine;
  defaultAnswers: ScriptLine[];
  qa: QA[];
}

export interface TalkScript {
  npcIndex: number;
  name: ScriptLine;
  description: ScriptLine;
  greeting: ScriptLine;
  job: ScriptLine;
  bye: ScriptLine;
  qa: QA[];
  labels: TalkLabel[];
}

// ─── API pública ─────────────────────────────────────────────────────────────

export type DialogueEffect =
  | { kind: "joinParty" }
  | { kind: "gold"; amount: number } // el NPC PIDE oro (extorsión/donación)
  | { kind: "giveItem"; item: number }
  | { kind: "karma"; delta: 1 | -1 }
  | { kind: "callGuards" }
  | { kind: "end" };

export type DialogueOutput =
  | {
      kind: "line";
      text: string;
      rune?: boolean;
      /** Línea MIXTA (#364-c): tramos {text,rune} cuando la fuente cambia A MITAD de la
       *  línea — el habla rúnica de TALK decide fuente POR CARÁCTER con el bit 7
       *  (TALK 0x4fc-0x55e). INVARIANTE: `text` === concatenación de los tramos. */
      segments?: readonly { text: string; rune: boolean }[];
      /**
       * PAUSA del guion TLK tras esta línea — los DOS opcodes del binario, distinguidos
       * porque sus esperas son de clase distinta (derivación bug 2, carril
       * talk-celda-paginacion):
       *  · "key"   = 0x8F KeyWait: `call 0x66ec` (TALK 0x1010) = kernel getkey `0x266c`
       *    — BLOQUEA hasta CUALQUIER tecla (el retorno se descarta), con el cursor
       *    animado del bucle (0x267f `call 0x1b38`, la clase de #341 §7.2).
       *  · "timed" = 0x83 Pause: bucle TALK 0x0f92-0x0fb3 — hasta 0x1c (28) ticks de
       *    `delay(1)` (0x617a → kernel 0x20fa, tick INT 1Ch ≈ 54,9 ms) sondeando el
       *    teclado (0x5dde): una tecla lo CORTA, y sin tecla avanza solo (~1,54 s).
       *    NO pasa por 0x266c ⇒ sin cursor.
       * El core sólo MARCA; la espera la materializa la capa de UI (talk-console).
       */
      pause?: "key" | "timed";
    }
  | { kind: "prompt"; question: boolean } // question=true: pregunta del NPC / AskName; false: "Your interest?"
  | { kind: "effect"; effect: DialogueEffect };

/**
 * Un tramo HABLADO del NPC ya emitido, para el diario de conversaciones de la
 * plataforma: el texto (sin las comillas del intérprete) y la keyword que lo
 * provocó (`topic`), o `null` para el saludo, la autopresentación y demás habla
 * no ligada a un tema. Es el equivalente U5 de las «passages» que la plataforma
 * persiste con hablante y lugar.
 */
export interface DialoguePassage {
  text: string;
  topic: string | null;
}

/**
 * #364-c — Inserta un texto LATINO en una lista de tramos en el offset `at` (medido
 * sobre la concatenación), partiendo el tramo que lo contenga si hace falta. Mantiene
 * la forma canónica (funde con el tramo latino adyacente). Lo usa `endSpeech` para
 * colar la comilla de cierre en una línea mixta sin romper text === concat(segments).
 */
function insertLatinAt(
  segs: readonly { text: string; rune: boolean }[],
  at: number,
  insert: string,
): { text: string; rune: boolean }[] {
  const out: { text: string; rune: boolean }[] = [];
  let pos = 0;
  let placed = false;
  const push = (text: string, rune: boolean): void => {
    if (text === "") return;
    const last = out[out.length - 1];
    if (last && last.rune === rune) last.text += text;
    else out.push({ text, rune });
  };
  for (const s of segs) {
    const end = pos + s.text.length;
    if (!placed && at >= pos && at <= end) {
      const cut = at - pos;
      push(s.text.slice(0, cut), s.rune);
      push(insert, false);
      push(s.text.slice(cut), s.rune);
      placed = true;
    } else {
      push(s.text, s.rune);
    }
    pos = end;
  }
  if (!placed) push(insert, false);
  return out;
}

export interface ConversationContext {
  avatarName: string;
  npcKnowsAvatar: boolean; // state.npcMet
  /**
   * Tirada de la AUTOPRESENTACIÓN a un NPC que no te conoce — TALK 0x1153
   * `call rand_range(0,1)` / 0x1158 `je 0x117d`. Con 0 el NPC no dice NADA al abrir;
   * con 1 suelta `"I am called <nombre>"`. Sólo se consulta en la rama de DESCONOCIDO
   * (0x1143 `jne 0x1166`): con el NPC ya conocido el binario NI SIQUIERA llega al `call`.
   *
   * ⚠ DIVERGENCIA DECLARADA, no un descuido. El binario NO tira de su stream: en
   * 0x1145-0x1149 hace `srand(rng_seed_from_dos_clock())` — CS 0x2056 es un
   * `int 21h AH=2Ch` (hora/min/seg/centésimas → 12 bits) y CS 0x207e SOBRESCRIBE
   * g_rng_seed. O sea, la moneda sale del RELOJ DE PARED y de paso REEMPLAZA la
   * semilla global. Eso hace que la paridad de stream a partir de aquí sea IMPOSIBLE
   * por construcción, no sólo incumplida. El port elige mantener su determinismo y
   * tirar de su propio stream (el call-site vivo inyecta `game.rollTalkSelfIntro`).
   *
   * Ausente ⇒ rama r=1 (se presenta): es la rama OBSERVABLE y la que fijan los
   * testigos del espejo (`"I am called Greyson"`, ad01). Los arneses puros no
   * inyectan tirada y quedan deterministas en esa rama.
   */
  selfIntroRoll?: () => number;
  /**
   * Nombres de los miembros del GRUPO, en orden de ranura, para el reto de AskName
   * (TALK.OVL:0x0e78). El binario NO compara sólo contra el Avatar: recorre de 0 a
   * `g_party_size` (0x0eb0-0x0eb8, 0x0f12 avanza 0x20 por vuelta) sobre los registros
   * de grupo. Ausente ⇒ `[avatarName]`, que es el comportamiento anterior y mantiene
   * deterministas los arneses puros que no inyectan el grupo.
   */
  partyNames?: readonly string[];
  /**
   * Alias de idioma para una keyword (i18n §3.1). Devuelve prefijos ALTERNATIVOS que
   * también casan esa keyword (p.ej. "star" → ["estr"] en español). El motor prueba
   * SIEMPRE la keyword inglesa (invariante lang=en byte-idéntico) y ADEMÁS estos alias.
   * Ausente o `() => []` = sólo inglés (comportamiento fiel del binario). Lo inyecta
   * main.ts leyendo el idioma + `keyword-alias-es`; el core NO importa i18n (DI pura).
   */
  aliasFor?: (keyword: string) => readonly string[];
  /**
   * Compone la línea de descripción ("You see {}") a partir del cuerpo. El compuesto
   * ENTERO ("You see a young girl.") no casa el choke `t()` de la consola (patrón
   * composite-choke look2), así que main.ts inyecta `body => tf("You see {}", body)`:
   * la plantilla posicional se traduce y el cuerpo pasa por `t()` (ya vive en
   * `<lang>.json`). Ausente = `"You see " + body`, byte-idéntico al binario (y a 'en').
   */
  seeCompose?: (body: string) => string;
  /**
   * Traductor de PIEZA (main inyecta `t`; ausente = identidad, byte-exacto en 'en').
   * Necesario por C8: las comillas del intérprete se añaden DESPUÉS de traducir —
   * si viajaran en el compuesto, el choke t() de pushConsole dejaría de casar las
   * keys del .TLK (trampa-del-entrecomillado, i18n-quote-wrap-guard-blindspot).
   */
  tr?: (s: string) => string;
}

/**
 * Strings de conversación de DATA.OVL (chunk PHRASES_CONVERSATION). El bundle
 * de assets del juego no incluye este chunk, así que se fijan aquí con los
 * valores reales del Ultima V en inglés (verificados contra los dumps de
 * reference/.../ScriptWork/*.txt).
 */
export const PHRASES = {
  YOU_SEE: "You see",
  // C8 (carril cadenas-presentacion): la comilla de apertura va EN el literal del
  // binario — DS 0x93c2 `"My name is ` (emisor TALK 0xaa8, keyword-clase NAME).
  MY_NAME_IS: '"My name is',
  // D6 (TALK 0x115a `mov ax,0x94ce`): la AUTOPRESENTACIÓN con que el NPC abre cuando
  // NO te conoce. Byte-verificado DS 0x94ce = DATA.OVL fileoff 0x94de = `"I am called `.
  // Comilla de apertura EN el literal (por eso 0x1163 salta a 0x116c SIN pasar por el
  // putchar '"' de 0x4da, a diferencia de la rama de NPC conocido en 0x1166).
  I_AM_CALLED: '"I am called',
  // C7: el handler AskName (TALK 0xe78) imprime putchar '"' (0x4da @0xe85) +
  // DS 0x9468 `What is thy name?"\n` ANTES del `\nYou respond-\n:` (DS 0x947c).
  // La comilla de APERTURA se compone en el call-site TRAS tr() (la key es el DS).
  WHATS_YOUR_NAME: 'What is thy name?"\n',
  // Byte-exactos DS 0x948c/0x94b0 (`\n\n"If you say so...`) y DS 0x94a0
  // (`\n\n"A pleasure!`): comilla de apertura EN el literal, SIN cierre.
  IF_SAY_SO: '\n\n"If you say so...',
  PLEASURE: '\n\n"A pleasure!',
  // Canon verificado contra DS 0x9420 = fileoff 0x9430 (TALK.OVL) (adyacente a "Your interest?\n:"
  // [CORREGIDO t#57: decía fileoff 0x9433, tres bytes DENTRO — se come justo el `"I `
  //  cuya comilla esta misma línea dice estar citando]
  // y "BYE" — el bucle TLK): comilla de apertura EN el literal y orden "…with that.".
  // El texto previo "That I cannot help thee with." NO existe en DATA.OVL (aprox. del
  // port) y fugaba en INGLÉS bajo es (sin key; cazado por el soak, carril sell-chatter).
  // El CIERRE `"` lo añade el intérprete (TALK 0xb8a `call 0x4da` tras el no-match) —
  // ver el flushLine del no-match (C8).
  CANNOT_HELP: '"I cannot help thee with that.',
  // Re-pregunta cuando la respuesta viene VACÍA — DS 0x9450 (DATA.OVL fileoff
  // 0x9460) = b'\n\n"What didst thou say?': comilla de apertura EN el literal y
  // SIN cierre, igual que sus hermanas de arriba. Emisor TALK 0x0c99
  // `mov ax,0x9450` / `call 0x58d0` (print_string LLANO), dentro del bucle
  // 0x0c7d-0x0ca5 que repite mientras `[0xbcf8]` siga a 0. #142.
  WHAT_YOU_SAY: '\n\n"What didst thou say?',
  // Respuesta a palabrota — DS 0x93d0 (DATA.OVL fileoff 0x93e0), handler TALK
  // 0xa78 (índice ≥5 de la tabla especial 0x4aa8): comilla de apertura EN el
  // literal, SIN cierre — el intérprete añade `"` (0xa7f call 0x4da) + 2×CR
  // (0xa82/0xa85) y re-pregunta "Your interest?" (0xb0f). es.json:4699.
  PROFANITY: '"With language like that, how did you become an Avatar?',
} as const;

/**
 * Cola de la tabla especial de keywords (DS 0x4aa8; bucle TALK 0x0b40-0x0bab con
 * gate de frontera de palabra 0x0b5b-0x0b64): índices 5..33 — **29 palabrotas**,
 * de FUCK a MOTHERFUCKER — despachan al handler 0xa78 (respuesta enlatada, la
 * conversación NO termina). Strings verbatim de DATA.OVL fileoff 0x925E-0x9337
 * (en el port: data.json stringPools[19].strings[170..221]).
 * Los índices 0-4 de la tabla son NAME/JOB/WORK/BYE/THANK: 0-3 ya van primeros
 * en qaKeys (mismo orden) y THANK (4) despacha al handler de BYE (0xae0).
 *
 * 🔴 NO AÑADIR `ELECTRONIC ARTS`. Estuvo aquí y se retiró: es la entrada **34**
 * de la tabla del binario (que tiene 35, no 34), y **el binario NUNCA la prueba**
 * — sus DOS únicos consumidores, TALK 0x0b43 y 0x0cb4, topan igual con
 * `cmp byte ptr [bp-2],0x22` (=34) COMPARADO TRAS INCREMENTAR (0x0bab, 0x0d15),
 * así que recorren 0..33. La cadena DS 0x9318 no tiene ninguna otra referencia
 * en los 28 .asm: es dato muerto. Responderla es AÑADIR contenido que EA nunca
 * publicó, no calcarlo. Registrado en docs/bugs-del-original.md §2.7.
 * Este comentario decía «índices 5..33 — 28 palabrotas + ELECTRONIC ARTS», y de
 * esa cuenta desplazada (5..33 son 29 huecos, los 29 palabrota) salió la entrada
 * de más: el port heredó el error de la cita, no al revés.
 */
const PROFANITY_KEYWORDS: readonly string[] = [
  "FUCK", "SHIT", "DAMN", "DICK", "PRICK", "PUSSY", "CUNT", "ASS", "BUTT",
  "BOOGER", "PISS", "JACK OFF", "MASTURBATE", "SUCK", "FART", "TITS", "BOOB",
  "MELONS", "BLOW", "PENIS", "BREAST", "CLIT", "BALLS", "SCROTUM", "NUTS",
  "BULLSHIT", "CUM", "CROTCH", "MOTHERFUCKER",
];

/**
 * Caracteres que compara el reto de AskName. NO es un número redondo elegido: es el
 * `cx = 2` del `repne movsw` de TALK.OVL:0x0ecb (dos palabras = cuatro bytes) con el
 * terminador escrito a mano en la quinta posición (0x0edd).
 */
const ASK_NAME_MATCH_CHARS = 4;

/**
 * Cota del diario de conversación: el host de plataforma persiste los últimos
 * tramos hablados de la charla viva (o recién terminada). Basta un puñado para
 * el diario; un guion largo no puede hacer crecer la instantánea sin límite.
 */
const MAX_PASSAGES = 64;

// ─── Utilidades sobre líneas/ítems ───────────────────────────────────────────

function isOp(item: ScriptItem | undefined, op: string): boolean {
  return !!item && item.kind === "op" && item.op === op;
}

// ─── Matching de keywords (FIEL al binario DOS, no a Redux) ───────────────────
// El motor DOS casa la keyword del TLK como SUBCADENA de la entrada tecleada,
// case-insensitive y anclada a frontera de palabra (no `startsWith` como Redux):
//   ULTIMA.EXE 0x6f1e   stristr(haystack = input@0xbcf8, needle = keyword)
//   TALK.OVL   0xb04    bucle "Your interest?" + gate de frontera (0b5b-0b64)
//   TALK.OVL   0x9d8    bucle de sub-preguntas de label (mismo gate, 0a0c-0a15)
// El buffer de entrada se lee con máx 15 chars (TALK.OVL 0xa33 `mov ax,0xf`);
// admite espacios y NO se trunca a 4. Reglas derivadas del disasm:
//  - Case-fold por char: (c & 0x7f); si >0x60 -> (& 0x5f) [mayúscula ASCII].  6f5c-6f6b
//  - Si len(keyword) > len(input): no casa.                                    6f37
//  - Avance-en-fallo (BUG del original): start += chars_casados + 1, no +1.    6f75-6f7d
//  - Gate de frontera: acepta el match sólo si idx==0 o input[idx-1]==' '.     0b5b-0b64
//    No hay frontera final -> "job" casa "jobs".
//  - Gana la primera keyword de la tabla en casar.                            bucle 0b48

/** Pliegue de char idéntico a ULTIMA.EXE 0x6f5c-0x6f6b (mask 0x7f + upcase >0x60). */
function foldChar(code: number): number {
  const c = code & 0x7f;
  return c > 0x60 ? c & 0x5f : c;
}

/**
 * stristr fiel a ULTIMA.EXE 0x6f1e: índice de la 1ª ocurrencia de `needle`
 * dentro de `haystack` (case-insensitive vía foldChar), o -1. Replica el
 * avance-en-fallo del original (`start += casados + 1`), que puede saltarse
 * ocurrencias que un indexOf naíf encontraría — comportamiento intencional.
 */
function stristrIndex(haystack: string, needle: string): number {
  const len2 = needle.length;
  const len1 = haystack.length;
  if (len2 > len1) return -1; // 6f37: jg -> 0xffff
  const maxStart = len1 - len2; // 6f3d/6f41
  let start = 0; // bx
  while (start <= maxStart) {
    // 6f47 / 6f7e
    let matched = 0;
    while (
      matched < len2 &&
      foldChar(needle.charCodeAt(matched)) === foldChar(haystack.charCodeAt(start + matched))
    ) {
      matched++; // 6f71: loop
    }
    if (matched === len2) return start; // 6f73: match completo -> devuelve bx
    start += matched + 1; // 6f75-6f7d: avance-en-fallo del binario
  }
  return -1; // 6f84
}

/**
 * ¿Casa `keyword` dentro de `input` según el motor DOS? Subcadena
 * case-insensitive anclada a frontera de palabra (inicio del input o justo
 * tras un espacio). Gate de TALK.OVL 0b5b-0b64.
 */
function keywordMatches(input: string, keyword: string): boolean {
  if (keyword.length === 0) return false;
  const idx = stristrIndex(input, keyword);
  if (idx < 0) return false; // 0b56: -1 -> siguiente keyword
  return idx === 0 || input.charCodeAt(idx - 1) === 0x20; // 0b5b / 0b5f: frontera
}

function lineContainsOp(line: ScriptLine, op: string): boolean {
  return line.some((it) => it.kind === "op" && it.op === op);
}

/** Ops que en Redux inician una nueva "sección" aislada (un único ítem). */
const ISOLATING_OPS = new Set(["IfElseKnowsName", "DoNothingSection", "Label", "Change", "Gold"]);

/**
 * Divide una ScriptLine en secciones replicando TalkScript.SplitIntoSections.
 * - StartNewSection abre una sección nueva.
 * - IfElseKnowsName/DoNothingSection/Label(goto)/Change/Gold quedan aislados en
 *   su propia sección de un solo ítem, y fuerzan que el siguiente ítem "normal"
 *   empiece otra sección (forceSplitNext).
 * - StartLabelDefinition arrastra al Label que le sigue (prefijo de definición).
 */
function splitIntoSections(line: ScriptLine): ScriptLine[] {
  const sections: ScriptLine[] = [];
  let cur: ScriptLine = [];
  let forceSplitNext = false;

  const pushCur = (): void => {
    sections.push(cur);
    cur = [];
  };

  for (let i = 0; i < line.length; i++) {
    const item = line[i]!;

    if (isOp(item, "StartNewSection")) {
      pushCur();
      forceSplitNext = false;
      continue;
    }

    if (isOp(item, "StartLabelDefinition")) {
      pushCur();
      const section: ScriptLine = [item];
      const next = line[i + 1];
      if (next && isOp(next, "Label")) {
        section.push(next);
        i++;
      }
      sections.push(section);
      forceSplitNext = true;
      continue;
    }

    if (item.kind === "op" && ISOLATING_OPS.has(item.op)) {
      pushCur();
      sections.push([item]);
      forceSplitNext = true;
      continue;
    }

    // Ítem normal (texto u op no aislante).
    if (forceSplitNext) {
      forceSplitNext = false;
      pushCur();
    }
    cur.push(item);
  }
  pushCur();

  return sections.filter((s) => s.length > 0);
}

// ─── Instrucciones de salto (ProcessMultipleLines) ───────────────────────────

const enum Skip {
  DontSkip,
  SkipNext,
  SkipAfterNext,
}

interface SectionResult {
  skip: Skip;
  goto?: number; // nº de label al que saltar (GotoLabel)
}

// ─── Conversación ────────────────────────────────────────────────────────────

export class Conversation {
  private readonly script: TalkScript;
  private readonly avatarName: string;
  private readonly partyNames?: readonly string[];
  /** ¿El NPC conoce al Avatar? (ctx inicial o puesto a true por AskName). */
  private knows: boolean;
  /** true si AskName ha reconocido al Avatar durante ESTA conversación. */
  private met = false;
  /**
   * Keywords YA preguntadas por el jugador en ESTA conversación (rama "Your
   * interest?"), en orden de primera consulta. Es la señal que el host de
   * plataforma consume para la ayuda de temas descubiertos: NUNCA enumera el
   * .TLK entero (eso revelaría temas no descubiertos), sólo lo que el jugador
   * ya ha probado. `bye` se excluye porque cierra la charla.
   */
  private readonly askedKeys: string[] = [];
  private readonly askedSeen = new Set<string>();
  /**
   * Palabras que el NPC (o su descripción) YA ha pronunciado en ESTA
   * conversación, normalizadas. Es el espejo de `TopicJournal.observe` de
   * Ultima IV: un tema sólo se OFRECE si el jugador lo ha oído, de modo que
   * nunca se enumera el .TLK entero ni se revela un tema no descubierto.
   * Teclear sigue disponible para palabras que no se han pronunciado.
   */
  private readonly heardWords = new Set<string>();
  /**
   * Tema de la línea hablada en curso: la keyword que el jugador acaba de
   * preguntar (QA del .TLK o sub-pregunta de label). `null` fuera de respuesta,
   * para que el saludo/descripción no queden etiquetados con un tema ajeno.
   */
  private speakingTopic: string | null = null;
  /**
   * Líneas ya emitidas por el NPC en ESTA conversación, en orden y con su tema.
   * El host de plataforma las persiste como diario de conversaciones (hablante,
   * lugar, tema). Acotado a las últimas `MAX_PASSAGES`.
   */
  private readonly passageLog: DialoguePassage[] = [];

  private _ended = false;
  private buffer: DialogueOutput[] = [];
  private gen: Generator<void, void, string> | null = null;

  /** Estado de acumulación de texto de la línea que se está emitiendo. */
  private textBuf = "";
  private pendingPrefix = "";
  /** El próximo `flushLine` es la descripción → se compone con `seeCompose`. */
  private pendingSee = false;
  private runeMode = false;
  /**
   * #364-c — TRAMOS ya cerrados de la línea en curso: cada op "Rune" cierra el tramo
   * acumulado en `textBuf` con SU fuente y conmuta `runeMode`, SIN volcar la línea
   * (el binario cambia de fuente por carácter DENTRO de la misma fila, TALK 0x4fc-0x55e;
   * el flushLine() que había aquí partía «…chanting AHM!» en TRES filas).
   */
  private runeSegs: { text: string; rune: boolean }[] = [];
  /** Compositor de la línea "You see {}" (i18n DI); default = prefijo inglés. */
  private readonly seeCompose: (body: string) => string;
  /** Traductor de pieza (i18n DI, C8); default = identidad (byte-exacto en 'en'). */
  private readonly tr: (s: string) => string;

  /** Mapa de keyword -> línea-respuesta (incl. name/job/work/bye implícitos). */
  private readonly qaKeys: string[] = [];
  private readonly qaMap = new Map<string, ScriptLine>();
  /** Alias de idioma por keyword (i18n §3.1); `() => []` = sólo inglés. */
  private readonly aliasFor: (keyword: string) => readonly string[];
  /** Tirada de la autopresentación (TALK 0x1153). Ver `ConversationContext`. */
  private readonly selfIntroRoll: () => number;

  constructor(script: TalkScript, ctx: ConversationContext) {
    this.script = script;
    this.avatarName = ctx.avatarName;
    this.partyNames = ctx.partyNames;
    this.knows = ctx.npcKnowsAvatar;
    this.selfIntroRoll = ctx.selfIntroRoll ?? (() => 1);
    this.aliasFor = ctx.aliasFor ?? (() => []);
    this.seeCompose = ctx.seeCompose ?? ((body) => PHRASES.YOU_SEE + " " + body);
    this.tr = ctx.tr ?? ((s) => s);
    this.buildQuestionAnswers();
  }

  get ended(): boolean {
    return this._ended;
  }

  /** true si el NPC ha llegado a conocer al Avatar en esta conversación. */
  get metAvatar(): boolean {
    return this.met;
  }

  /** Keywords ya preguntadas en esta conversación, en orden de primera consulta. */
  get askedKeywords(): readonly string[] {
    return this.askedKeys;
  }

  /** Líneas habladas por el NPC en esta conversación, con su tema, para el diario. */
  get passages(): readonly DialoguePassage[] {
    return this.passageLog;
  }

  /**
   * Temas ofrecibles: las keywords válidas del NPC que el jugador ha oído
   * pronunciar (o que son implícitas: name/job/work), más `bye` al final como
   * despedida. Es el equivalente U5 de `TopicJournal::choices`: nunca incluye
   * una keyword del .TLK que no se haya pronunciado.
   */
  get discoveredTopics(): readonly string[] {
    const implicit = new Set(["name", "job", "work"]);
    const topics: string[] = [];
    let hasBye = false;
    for (const raw of this.qaKeys) {
      const key = raw.toLowerCase();
      if (key === "bye") { hasBye = true; continue; }
      if (!implicit.has(key) && !this.wordWasHeard(key)) continue;
      if (!topics.includes(key)) topics.push(key);
    }
    if (hasBye) topics.push("bye");
    return topics;
  }

  /** ¿Se oyó la keyword (soporta keywords de varias palabras)? */
  private wordWasHeard(keyword: string): boolean {
    return keyword.split(/\s+/).filter(Boolean).every((word) => this.heardWords.has(word));
  }

  private observeHeard(text: string): void {
    let word = "";
    for (const character of text.toLowerCase()) {
      if (character >= "a" && character <= "z") word += character;
      else if (word) { this.heardWords.add(word); word = ""; }
    }
    if (word) this.heardWords.add(word);
  }

  private recordAsked(keyword: string): void {
    if (keyword === "bye" || this.askedSeen.has(keyword)) return;
    this.askedSeen.add(keyword);
    this.askedKeys.push(keyword);
  }

  /** Guarda una línea hablada del NPC con el tema en curso (diario de plataforma). */
  private recordPassage(text: string): void {
    this.passageLog.push({ text, topic: this.speakingTopic });
    while (this.passageLog.length > MAX_PASSAGES) this.passageLog.shift();
  }

  /** ¿Conoce el NPC al Avatar ahora mismo? (ctx || AskName exitoso). */
  private get npcKnowsAvatar(): boolean {
    return this.knows || this.met;
  }

  // ── Arranque / input ──

  /** Emite la description ("You see ..."), el saludo y el primer prompt. */
  start(): DialogueOutput[] {
    this.buffer = [];
    this.gen = this.script_();
    this.gen.next();
    return this.buffer;
  }

  /** Procesa la respuesta del jugador (keyword o respuesta a una pregunta). */
  input(text: string): DialogueOutput[] {
    this.buffer = [];
    if (this._ended || this.gen === null) return this.buffer;
    this.speakingTopic = null; // cada respuesta arranca sin tema heredado
    this.gen.next(text);
    return this.buffer;
  }

  // ── Construcción de Q&A ──

  private buildQuestionAnswers(): void {
    // Keywords implícitas del motor (mismo orden de inserción que Redux):
    // name -> línea Name, job/work -> Job, bye -> Bye.
    this.addQA("name", this.script.name);
    this.addQA("job", this.script.job);
    this.addQA("work", this.script.job);
    this.addQA("bye", this.script.bye);

    for (const qa of this.script.qa) {
      const answer = qa.answer[0] ?? [];
      for (const kw of qa.keywords) this.addQA(kw, answer);
    }
  }

  private addQA(keyword: string, answer: ScriptLine): void {
    const key = keyword.trim();
    if (key.length === 0 || this.qaMap.has(key)) return; // gana la primera (Redux)
    this.qaKeys.push(key);
    this.qaMap.set(key, answer);
  }

  /**
   * Casa la entrada del jugador contra las keywords en orden de inserción;
   * gana la primera. FIEL al binario: subcadena anclada a frontera de palabra
   * (ver `keywordMatches`), no `startsWith` de Redux. Diferencia observable:
   * la keyword casa en CUALQUIER palabra de la frase ("give me a job" casa
   * "job"); para entradas de una sola palabra el resultado es idéntico a
   * `startsWith`.
   */
  private getQuestionKey(input: string, keys: string[]): string | undefined {
    for (const key of keys) {
      // La keyword INGLESA se prueba SIEMPRE (invariante lang=en byte-idéntico).
      if (keywordMatches(input, key)) return key;
      // Alias de idioma (i18n §3.1): prefijos ALTERNATIVOS que también casan esta
      // keyword. Se casan por el MISMO stristr sobre el MISMO input (truncado a 15,
      // frontera de palabra) → la truncación fiel aplica igual. `() => []` = sólo inglés.
      for (const alias of this.aliasFor(key)) {
        if (keywordMatches(input, alias)) return key;
      }
    }
    return undefined;
  }

  // ── Emisión ──

  private emit(output: DialogueOutput): void {
    this.buffer.push(output);
  }

  // ── Comillas del intérprete (C8, carril cadenas-presentacion) ──
  // El binario ENVUELVE el discurso del NPC en comillas: putchar de TLK-char 0xa2
  // (&0x7f = '"') vía TALK 0x4da ANTES de imprimir la sección hablada y DESPUÉS de
  // que termine con normalidad — derivado en: saludo (0x1166 `"` + sección 2 + `"`
  // + 2×CR), respuesta de keyword (0xbb4 `"` + sección + 0xb8a `"` + 2×CR),
  // clase NAME (0xaa8 `"My name is ` + sección 0 + 0xad3 `"`), no-match (0xb83
  // `"I cannot help thee with that.` + 0xb8a `"`). Los datos del .TLK NO llevan
  // comillas (towne.json 0 valores con `"` — presentación del intérprete, los
  // values no cambian). Si la sección termina en un op de transferencia (el 0x7aa
  // retorna ≠0: JoinParty/End/Goto), el CIERRE se salta (0xbc5 jne).
  // NO derivado (queda sin comillas, honesto): initialLine/defaults de labels
  // (máquina de preguntas 0xd7a-land, emisor sin trazar).
  private speechActive = false;
  private speechOpen = false;
  private lastSpeechLine: (DialogueOutput & { kind: "line" }) | null = null;

  /** Abre un tramo HABLADO: la próxima línea no vacía arranca con `"`. */
  private beginSpeech(): void {
    this.speechActive = true;
    this.speechOpen = true;
    this.lastSpeechLine = null;
  }

  /** Cierra el tramo hablado añadiendo la comilla de cierre a la última línea emitida
   *  (0x4da). El cierre entra ANTES de los `\n` finales (el putchar del binario cae
   *  pegado al último char impreso; los saltos duros van después).
   *
   *  El GLIFO lo pone `quoteClose()`, no un literal: 0x4da emite el char 0xa2 del
   *  TLK-charset, que en el idioma activo puede no ser `"` (#37). En 'en' es `"` ⇒
   *  calco byte-idéntico. */
  private endSpeech(): void {
    const line = this.lastSpeechLine;
    if (this.speechActive && line) {
      const closeGlyph = quoteClose();
      const tail = /\n+$/.exec(line.text)?.[0] ?? "";
      const body = tail ? line.text.slice(0, -tail.length) : line.text;
      if (!body.endsWith(closeGlyph)) {
        line.text = body + closeGlyph + tail;
        // #364-c — línea MIXTA: la comilla (prosa latina) se inserta en los TRAMOS en la
        // misma posición (fin del cuerpo, antes de los \n finales) para conservar el
        // invariante text === concat(segments).
        if (line.segments) line.segments = insertLatinAt(line.segments, body.length, closeGlyph);
      }
    }
    this.speechActive = false;
    this.speechOpen = false;
    this.lastSpeechLine = null;
  }

  /** Abandona el tramo SIN cierre (op de transferencia: 0x7aa ret ≠0 → 0xbc5 salta el `"`). */
  private abandonSpeech(): void {
    this.speechActive = false;
    this.speechOpen = false;
    this.lastSpeechLine = null;
  }

  private flushLine(pause: false | "key" | "timed" = false): void {
    // La descripción ("You see …") es narración, no habla del NPC: no entra al
    // diario de conversaciones. Se captura ANTES de consumir el flag.
    const wasSee = this.pendingSee;
    // #364-c — recoge los TRAMOS de la línea: los cerrados por op "Rune" + el resto de
    // `textBuf` con la fuente vigente. Sin toggles mid-line esto es UN tramo y el camino
    // de abajo reproduce byte a byte el comportamiento por-línea de siempre.
    const rawSegs = [...this.runeSegs];
    this.runeSegs = [];
    if (this.textBuf !== "") rawSegs.push({ text: this.textBuf, rune: this.runeMode });
    const joined = rawSegs.map((s) => s.text).join(""); // == el textBuf histórico
    this.observeHeard(joined); // temas descubiertos: sólo lo pronunciado (espejo U4)
    const mixed = rawSegs.some((s) => s.rune) && rawSegs.some((s) => !s.rune);
    // tr() POR PIEZA antes de componer comillas/prefijos (C8): así el choke t() de
    // pushConsole (que vería el compuesto entrecomillado y no casaría la key .TLK)
    // recibe texto ya traducido — segunda pasada identidad. En una línea MIXTA la pieza
    // es el TRAMO no-runa (la MISMA granularidad que tenían esos textos cuando cada
    // toggle volcaba la línea); los tramos rúnicos van verbatim (runas, sin key).
    let segs: { text: string; rune: boolean }[] | null = null;
    let text: string;
    if (this.pendingSee) {
      text = this.seeCompose(joined);
      if (mixed) {
        // Composición con prefijo ("You see " + cuerpo): el cuerpo se re-ancla para
        // repartir el prefijo como tramo latino. Si el compositor reescribió el cuerpo
        // de forma irreconocible, la línea cae al camino por-fila (sin tramos).
        const at = text.indexOf(joined);
        if (at >= 0) {
          segs = [];
          if (at > 0) segs.push({ text: text.slice(0, at), rune: false });
          segs.push(...rawSegs.map((s) => ({ ...s })));
          if (at + joined.length < text.length) {
            segs.push({ text: text.slice(at + joined.length), rune: false });
          }
        }
      }
    } else if (mixed) {
      segs = rawSegs.map((s) => (s.rune ? { ...s } : { text: this.tr(s.text), rune: false }));
      const prefix = this.tr(this.pendingPrefix);
      if (prefix !== "") segs.unshift({ text: prefix, rune: false });
      text = segs.map((s) => s.text).join("");
    } else {
      text = this.tr(this.pendingPrefix) + this.tr(joined);
    }
    this.pendingSee = false;
    this.pendingPrefix = "";
    this.textBuf = "";
    if (text.trim().length === 0) {
      if (pause) this.emit({ kind: "line", text: "", pause });
      return;
    }
    // Diario de conversaciones: se registra el texto ANTES de que el intérprete
    // añada la comilla de apertura/cierre, para guardar la prosa limpia.
    if (!wasSee) this.recordPassage(text);
    if (this.speechActive && this.speechOpen) {
      // Comilla de APERTURA del discurso (TALK 0x4da). Si el literal ya la trae
      // (`"My name is `, `"I cannot…`), se consume el estado sin duplicarla. El glifo
      // sale de `quoteOpen()` por lo mismo que el cierre (#37): en 'en' es `"` y el
      // calco no se mueve; en otro idioma el literal ya vino traducido y su apertura
      // es la del idioma, así que la comparación tiene que ser contra ESE glifo.
      const openGlyph = quoteOpen();
      if (!text.startsWith(openGlyph)) {
        text = openGlyph + text;
        if (segs) {
          // La comilla es prosa latina: se funde con el primer tramo latino o abre uno.
          const first = segs[0];
          if (first && !first.rune) first.text = openGlyph + first.text;
          else segs.unshift({ text: openGlyph, rune: false });
        }
      }
      this.speechOpen = false;
    }
    const line: DialogueOutput & { kind: "line" } = { kind: "line", text };
    // Homogénea: el flag POR LÍNEA de siempre (rawSegs vacío = solo prefijo → runeMode,
    // el criterio histórico). Mixta: viajan los tramos y el flag de línea no aplica.
    const allRune = rawSegs.length > 0 ? rawSegs.every((s) => s.rune) : this.runeMode;
    if (segs) line.segments = segs;
    else if (allRune) line.rune = true;
    if (pause) line.pause = pause;
    if (this.speechActive) this.lastSpeechLine = line;
    this.emit(line);
  }

  // ── Corrutina principal (BeginConversation) ──

  private *script_(): Generator<void, void, string> {
    // Descripción = narración sin comillas: 0x111c imprime DS 0x94c4 "You see " y
    // 0x1123 `push 1` procesa la SECCIÓN 1 del .TLK.
    yield* this.processConversationLine(this.script.description, true);
    // ★ D6 — la apertura HABLADA no es siempre el saludo. TALK 0x113e llama al test
    // del bitmap npcMet (0x0d7a: máscara 1<<npcIdx contra la palabra doble
    // [g_location*4 + 0x5bd6]; devuelve 1 si el bit está PUESTO) y 0x1143 `jne 0x1166`
    // reparte en dos ramas que emiten SECCIONES DISTINTAS del .TLK:
    //   · CONOCIDO  → 0x1166 `call 0x4da` (comilla) + `push 2` = sección 2 = GREETING
    //   · DESCONOCIDO → 0x1145-0x1158: srand(reloj DOS) + rand(0,1);
    //         r==0 → 0x117d `sub ax,ax; ret` — NI UNA LÍNEA, directo al prompt
    //         r!=0 → 0x115a DS 0x94ce `"I am called ` + `push 0` = sección 0 = NAME
    // El port emitía SIEMPRE la sección 2, así que a un desconocido le enseñaba el
    // saludo del NPC ya conocido y NUNCA la autopresentación. Testigo del espejo
    // (routes-ad/ad01): «You see a noble fighting bard. "I am called Greyson"».
    // Se lee `this.knows` (el bit tal cual estaba al abrir) y no el getter
    // `npcKnowsAvatar`, porque el binario consulta el bitmap UNA vez en 0x113e,
    // antes de que ningún AskName de esta conversación pueda cambiarlo.
    if (this.knows) {
      this.beginSpeech();
      yield* this.processConversationLine(this.script.greeting, false);
      this.endSpeech();
    } else if (this.selfIntroRoll() !== 0) {
      // La comilla de apertura viaja EN el literal (por eso 0x1163 no pasa por 0x4da):
      // se abre el tramo hablado pero se marca la comilla como ya puesta, igual que la
      // rama `"My name is ` de la keyword NAME.
      this.pendingPrefix = PHRASES.I_AM_CALLED + " ";
      this.beginSpeech();
      this.speechOpen = false;
      yield* this.processConversationLine(this.script.name, false);
      this.endSpeech();
      this.pendingPrefix = "";
    }

    while (!this._ended) {
      this.emit({ kind: "prompt", question: false });
      const response = yield;
      yield* this.handleUserInterest(response ?? "");
    }
  }

  /**
   * ¿La respuesta al «What is thy name?» acredita al Avatar? — CALCO de
   * `talk_ask_thy_name` (TALK.OVL:0x0e78-0x0f31). Son TRES cosas que se suman, y el
   * clon sólo hacía una (igualdad exacta contra el Avatar), de modo que RECHAZABA lo
   * que el original acepta:
   *
   *  1. **Recorre TODO el grupo**, no sólo al Avatar (0x0eb0-0x0eb8 compara el índice
   *     contra `g_party_size`; 0x0f12 `add di,0x20` avanza al siguiente registro).
   *     Decir el nombre de CUALQUIER compañero marca al NPC como conocido.
   *  2. **Compara sólo los CUATRO primeros caracteres**: el `repne movsw` de
   *     0x0ecb-0x0ed4 lleva `cx = 2` (dos palabras = 4 bytes) a un local de pila, y
   *     0x0edd escribe el terminador en la QUINTA posición. La aguja del comparador
   *     es el nombre TRUNCADO A 4.
   *  3. **Es SUBCADENA con frontera de palabra**, no igualdad — el mismo comparador
   *     (0x0ee9) y el mismo gate del carácter anterior (0x0ef7) que las keywords, así
   *     que se reutiliza `keywordMatches` en vez de duplicar la lógica.
   *
   * Con Mariah en el grupo, el original acepta «MARI», «MARIAH» y «SOY MARIAH».
   * Registro: `docs/bugs-del-original.md` §4 (fila de la corrupción de roster, hermana).
   */
  private answersToPartyName(response: string): boolean {
    const names = this.partyNames ?? [this.avatarName];
    return names.some((n) => {
      const needle = n.trim().slice(0, ASK_NAME_MATCH_CHARS);
      return needle.length > 0 && keywordMatches(response, needle);
    });
  }

  /** Procesa una línea de conversación (description/greeting) con su goto. */
  private *processConversationLine(line: ScriptLine, isDescription: boolean): Generator<void, void, string> {
    if (isDescription) this.pendingSee = true;
    const sections = splitIntoSections(line);
    const res = yield* this.processSections(sections);
    if (res.goto !== undefined && !this._ended) yield* this.labelLoop(res.goto);
  }

  /** Maneja la respuesta al prompt "Your interest?". */
  private *handleUserInterest(rawResponse: string): Generator<void, void, string> {
    let response = rawResponse;
    if (response.trim().length === 0) response = "bye"; // vacío -> bye (Redux)

    // Tabla especial DS 0x4aa8 (TALK 0x0b40): tras NAME/JOB/WORK/BYE (índices
    // 0-3, ya primeros en qaKeys en el MISMO orden) el binario prueba THANK (4)
    // y las palabrotas (≥5) ANTES de las keywords del .TLK — se replican aquí,
    // en su posición del bucle. Gana el índice menor: sólo si NINGUNA de las 4
    // estándar casó (p.ej. "BYE FUCK" → BYE).
    if (this.getQuestionKey(response, ["name", "job", "work", "bye"]) === undefined) {
      if (keywordMatches(response, "THANK")) {
        // THANK (índice 4) despacha al MISMO handler que BYE (TALK 0xae0 →
        // call 0xa3c): despedida del .TLK + fin de conversación.
        response = "bye";
      } else if (PROFANITY_KEYWORDS.some((k) => keywordMatches(response, k))) {
        // Handler 0xa78: respuesta enlatada DS 0x93d0 + cierre `"` (0x4da) +
        // 2×CR; NO termina — el bucle re-pregunta "Your interest?" (0xb0f).
        // (El tramo 0xa88-0xaf9 — bucle de 28 iteraciones sobre llamadas kernel
        // sin strings, probablemente pacing/beep — queda sin modelar.)
        this.beginSpeech();
        this.speechOpen = false; // la comilla de apertura viaja en el literal
        this.textBuf = PHRASES.PROFANITY;
        this.flushLine();
        this.endSpeech();
        return;
      }
    }
    const lower = response.toLowerCase();

    // Sólo el "name" EXACTO antepone el prefijo (TALK 0xaa8: `"My name is ` DS
    // 0x93c2 en la MISMA fila; el nombre continúa y el cierre `"` lo pone 0xad3).
    const isName = lower === "name";
    if (isName) {
      this.pendingPrefix = PHRASES.MY_NAME_IS + " ";
    }

    const key = this.getQuestionKey(response, this.qaKeys);
    if (key !== undefined) {
      this.recordAsked(key);
      const answer = this.qaMap.get(key)!;
      // Respuesta de keyword = HABLADA (TALK 0xbb4 `"` + sección + 0xb8a `"`).
      const previousTopic = this.speakingTopic;
      this.speakingTopic = key; // etiqueta del diario para las líneas de esta respuesta
      this.beginSpeech();
      if (isName) this.speechOpen = false; // la comilla ya viaja en el prefijo
      yield* this.processAnswer(answer);
      this.endSpeech();
      this.speakingTopic = previousTopic;
      if (isName) this.pendingPrefix = ""; // respuesta sin texto: no arrastrar el prefijo
      // La línea Bye lleva un EndConversation implícito (InitScript L303).
      if (key === "bye" && !this._ended) {
        this.emit({ kind: "effect", effect: { kind: "end" } });
        this._ended = true;
      }
    } else {
      // No-match (TALK 0xb83): el literal trae la comilla de apertura y el
      // intérprete añade el CIERRE (0xb8a call 0x4da) — `…with that."` — que se
      // compone TRAS tr() (endSpeech sobre la línea ya traducida).
      this.pendingPrefix = "";
      this.beginSpeech();
      this.speechOpen = false; // la comilla de apertura ya viaja en el literal
      this.textBuf = PHRASES.CANNOT_HELP;
      this.flushLine();
      this.endSpeech();
    }
  }

  /** Procesa una línea-respuesta completa; si termina en goto, entra al label. */
  private *processAnswer(line: ScriptLine): Generator<void, void, string> {
    const sections = splitIntoSections(line);
    const res = yield* this.processSections(sections);
    if (res.goto !== undefined && !this._ended) yield* this.labelLoop(res.goto);
  }

  /** ProcessMultipleLines: procesa secciones con la lógica de saltos. */
  private *processSections(sections: ScriptLine[]): Generator<void, SectionResult, string> {
    let skipCounter = -1;
    for (let i = 0; i < sections.length; i++) {
      if (skipCounter === 0) {
        skipCounter--;
        continue;
      }
      const section = sections[i]!;
      // Línea con <AvatarsName> pero el NPC no conoce al Avatar -> se salta.
      if (lineContainsOp(section, "AvatarsName") && !this.npcKnowsAvatar) continue;

      const res = yield* this.processSection(section);
      if (skipCounter !== -1) skipCounter--;
      if (this._ended) return { skip: Skip.DontSkip };
      if (res.goto !== undefined) return res;

      switch (res.skip) {
        case Skip.SkipAfterNext:
          skipCounter = 1;
          break;
        case Skip.SkipNext:
          i++;
          break;
        default:
          break;
      }
    }
    return { skip: Skip.DontSkip };
  }

  /** ProcessLine: evalúa los ítems de una sección. Puede suspender (AskName). */
  private *processSection(section: ScriptLine): Generator<void, SectionResult, string> {
    // AskName ya conocido -> la sección no hace nada (Conversation.cs L176).
    if (lineContainsOp(section, "AskName") && this.npcKnowsAvatar) {
      return { skip: Skip.DontSkip };
    }

    for (let i = 0; i < section.length; i++) {
      const item = section[i]!;

      if (item.kind === "text") {
        this.textBuf += item.text;
        continue;
      }

      switch (item.op) {
        case "AvatarsName":
          this.textBuf += this.avatarName;
          break;
        case "NewLine":
          this.textBuf += "\n";
          break;
        case "Rune":
          // #364-c — el toggle de fuente NO vuelca la línea: cierra el tramo acumulado
          // con su fuente y sigue en la MISMA fila (TALK 0x4fc-0x55e conmuta por
          // carácter con el bit 7; el flushLine() que había aquí era la clase del
          // residuo #108: «…chanting AHM!» caía partido en tres filas).
          if (this.textBuf !== "") {
            this.runeSegs.push({ text: this.textBuf, rune: this.runeMode });
            this.textBuf = "";
          }
          this.runeMode = !this.runeMode;
          break;
        case "Pause":
          // 0x83: espera CRONOMETRADA saltable por tecla (TALK 0x0f92-0x0fb3, 28 ticks).
          this.flushLine("timed");
          break;
        case "KeyWait":
          // 0x8F: espera de TECLA (TALK 0x1010 `call 0x66ec` = kernel getkey 0x266c).
          this.flushLine("key");
          break;
        case "Gold":
          this.flushLine();
          this.emit({ kind: "effect", effect: { kind: "gold", amount: item.data ?? 0 } });
          break;
        case "Change":
          this.flushLine();
          this.emit({ kind: "effect", effect: { kind: "giveItem", item: item.data ?? 0 } });
          break;
        case "JoinParty":
          this.flushLine();
          this.abandonSpeech(); // transferencia: 0x7aa ret ≠0 → sin cierre (0xbc5)
          this.emit({ kind: "effect", effect: { kind: "joinParty" } });
          this.emit({ kind: "effect", effect: { kind: "end" } });
          this._ended = true;
          return { skip: Skip.DontSkip };
        case "KarmaPlusOne":
          this.flushLine();
          this.emit({ kind: "effect", effect: { kind: "karma", delta: 1 } });
          break;
        case "KarmaMinusOne":
          this.flushLine();
          this.emit({ kind: "effect", effect: { kind: "karma", delta: -1 } });
          break;
        case "CallGuards":
          this.flushLine();
          this.emit({ kind: "effect", effect: { kind: "callGuards" } });
          break;
        case "EndConversation":
          this.flushLine();
          this.abandonSpeech(); // transferencia: sin cierre de comilla (0xbc5)
          this.emit({ kind: "effect", effect: { kind: "end" } });
          this._ended = true;
          return { skip: Skip.DontSkip };
        case "IfElseKnowsName":
          // Bifurca: si conoce -> procesa la sección siguiente y salta la de
          // después; si no -> salta la siguiente y procesa la de después.
          return { skip: this.npcKnowsAvatar ? Skip.SkipAfterNext : Skip.SkipNext };
        case "AskName": {
          this.flushLine();
          // C7: el handler AskName (TALK 0xe78) imprime `"` (0x4da @0xe85) +
          // `What is thy name?"` (DS 0x9468) ANTES del prompt `\nYou respond-\n:`
          // (DS 0x947c). La sección hablada en curso queda SIN cierre (el op se
          // llevó el control — patrón transferencia).
          // ★ El par está PARTIDO entre las dos capas: la APERTURA es el putchar
          // (⇒ `quoteOpen()`) y el CIERRE viaja dentro del literal (⇒ lo pone la
          // traducción). Componer aquí un `'"'` crudo dejaba `"…nombre?»` bajo `es`.
          this.abandonSpeech();
          this.emit({ kind: "line", text: quoteOpen() + this.tr(PHRASES.WHATS_YOUR_NAME) });
          this.emit({ kind: "prompt", question: true });
          const nameResponse = yield;
          if (this.answersToPartyName(nameResponse ?? "")) {
            this.met = true;
            this.textBuf = PHRASES.PLEASURE; // DS 0x94a0 `\n\n"A pleasure!` (sin cierre)
          } else {
            this.textBuf = PHRASES.IF_SAY_SO; // DS 0x948c/0x94b0 `\n\n"If you say so...`
          }
          this.flushLine();
          break;
        }
        case "Label":
          // GotoLabel: detenemos la sección y señalamos el salto. La sección
          // hablada queda sin cierre (transferencia, 0x7aa ret ≠0).
          this.flushLine();
          this.abandonSpeech();
          return { skip: Skip.DontSkip, goto: item.data ?? 0 };
        case "StartLabelDefinition":
          // Prefijo de definición de label: consume el <Label:N> que le sigue
          // para que NO se interprete como un GotoLabel a sí mismo.
          if (isOp(section[i + 1], "Label")) i++;
          break;
        // Estructurales / ya procesados por el extractor: no-ops.
        case "DefineLabel":
        case "DoNothingSection":
        case "EndScript":
        case "Or":
        case "StartNewSection":
        case "Unknown":
          break;
        default:
          break;
      }
    }

    this.flushLine();
    return { skip: Skip.DontSkip };
  }

  /** Maneja un label: initialLine + (si tiene defaults) pregunta del NPC. */
  /**
   * Máquina de labels ITERATIVA: un GotoLabel reemplaza el puntero de script
   * (como el motor original), nunca recursa. Los ciclos entre labels sin
   * input del usuario se cortan a los 16 saltos (el original no puede
   * expresarlos de forma útil; FIDELITY: verificado que evita cuelgues).
   */
  private *labelLoop(startLabel: number): Generator<void, void, string> {
    let next: number | undefined = startLabel;
    let jumpsSinceInput = 0;

    while (next !== undefined && !this._ended) {
      if (++jumpsSinceInput > 16) return;
      const label = this.script.labels.find((l) => l.label === next);
      next = undefined;
      if (label === undefined) return;

      // Si la initialLine usa <AvatarsName> y no conoce al Avatar, se salta el
      // label entero (Conversation.cs L630).
      if (lineContainsOp(label.initialLine, "AvatarsName") && !this.npcKnowsAvatar) {
        return;
      }

      const res = yield* this.processSections(splitIntoSections(label.initialLine));
      if (this._ended) return;
      if (res.goto !== undefined) {
        next = res.goto;
        continue;
      }

      // ContainsQuestions() == DefaultAnswers.Count > 0. Sin defaults: el label
      // era sólo la initialLine; volvemos al prompt principal.
      if (label.defaultAnswers.length === 0) return;

      // Pregunta del NPC. Reintenta si la respuesta es vacía (emitiendo
      // "What didst thou say?" a partir del segundo intento).
      const labelKeys: string[] = [];
      const labelMap = new Map<string, ScriptLine>();
      for (const qa of label.qa) {
        const answer = qa.answer[0] ?? [];
        for (const kw of qa.keywords) {
          const key = kw.trim();
          if (key.length > 0 && !labelMap.has(key)) {
            labelKeys.push(key);
            labelMap.set(key, answer);
          }
        }
      }

      let response: string;
      let first = true;
      do {
        if (!first) {
          this.textBuf = PHRASES.WHAT_YOU_SAY;
          this.flushLine();
        }
        first = false;
        this.emit({ kind: "prompt", question: true });
        response = yield;
        jumpsSinceInput = 0;
      } while ((response ?? "").trim().length === 0);

      const key = this.getQuestionKey(response, labelKeys);
      if (key !== undefined) {
        const previousTopic = this.speakingTopic;
        this.speakingTopic = key; // etiqueta del diario para la respuesta del label
        const r = yield* this.processSections(splitIntoSections(labelMap.get(key)!));
        this.speakingTopic = previousTopic;
        if (r.goto !== undefined && !this._ended) {
          next = r.goto;
          continue;
        }
      } else {
        for (const def of label.defaultAnswers) {
          const r = yield* this.processSections(splitIntoSections(def));
          if (this._ended) break;
          if (r.goto !== undefined) {
            next = r.goto;
            break;
          }
        }
        if (next !== undefined) continue;
      }
    }
  }
}
