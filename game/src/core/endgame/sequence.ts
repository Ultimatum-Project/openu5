/**
 * EMISOR del `endgameSequence` (core) — carril endgame-visual, H1.
 *
 * Calca el patrón RefugeScript (`game.ts` buildRefugeScript / resolveRefuge): el core
 * emite un GUIÓN PURO de beats ORDENADOS; la piel los pacea (escena modal, tecla por
 * beat) y difiere la mutación terminal. NO hay lógica de presentación aquí.
 *
 * Las FASES mapean 1:1 a las piezas derivadas del disasm (re/notes/endgame-derivation.md):
 *   - `greenScene`     GAP 2 — re-tinte VERDE del trono + re-add del party + LB de pie.
 *   - `dialogue`       GAP 3 — diálogo de LB (11 páginas de ENDMSG.DAT) + fork de la caja.
 *   - `orbMoongate`    GAP 4 — orb rojo al suelo + moongate + salida uno-a-uno.
 *   - `dissolve`       GAP 5 — disolución de píxeles a pantalla completa.
 *   - `storyHouse`     GAP 6 — pantalla de historia 1 (END1.16 + páginas END.DAT).
 *   - `storyDream`     GAP 6 — pantalla de historia 2 «The Dream» (END2.16 + END.DAT).
 *   - `scroll`         GAP 7 — pergamino final (ENDSC.16 + fecha/informe de la quest).
 *   - `terminalFreeze` GAP 9 — estado terminal de VICTORIA: frame congelado, sin input.
 *   - `terminalPrison` GAP 3b/10 — desenlace VARADO: sala verde jugable pero sin salida.
 *
 * El fork victoria/stranded lo decide la caja de sándalo (woodenBox) en el binario
 * (ENDGAME 0x08b9/0x08c2 `cmp ans,'Y' && woodenBox`); aquí llega YA resuelto en `ending`
 * (lo fija `rescueLordBritish`, como hoy). La rama varada comparte prólogo (green+diálogo)
 * y diverge en el desenlace: sin orb/moongate, sin disolución, sin historia, sin pergamino.
 *
 * ⚠️ H1 fija la ESPINA de fases + el fork. Los beats de TEXTO (páginas byte-exactas de
 * ENDMSG/END.DAT, vía el choke i18n de la piel), los CUES de sonido (censo GAP 8) y las
 * DURACIONES (medidas del testigo) los rellenan los hitos siguientes, un beat por página/
 * evento. El remate Clase-B de la disolución NO se fabrica: usa el orden LFSR derivado +
 * duración del testigo. La «fanfarria» quedó REFUTADA (adenda fanfarria-re 2026-07-22):
 * no existe en el binario — el pergamino y el freeze terminal son MUDOS.
 */
import type { SfxCue } from "../sfx.js";

export type EndgamePhase =
  | "greenScene"
  | "dialogue"
  | "orbMoongate"
  | "dissolve"
  | "storyHouse"
  | "storyDream"
  | "scroll"
  | "terminalFreeze"
  | "terminalPrison";

export type EndgameEnding = "victory" | "stranded";

/**
 * Un BEAT del guión del endgame: la FASE visual que la piel fija, y opcionalmente una
 * línea byte-exacta (pasa por el choke i18n de la piel), un cue de sonido, y una pausa
 * en unidades crudas de `delay` (la piel las convierte a ms). Igual que `RefugeBeat`.
 */
export interface EndgameBeat {
  /** Fase visual del endgame que este beat FIJA/avanza. */
  phase: EndgamePhase;
  /** Línea de consola byte-exacta (ENDMSG/END.DAT). Traducida por el choke i18n de la piel. */
  message?: string;
  /**
   * Auto-respuesta anexa a un beat «You reply: » (DATA.OVL DS 0x84b4=`Yes` / 0x84ba=`No`).
   * La fija el inventario (woodenBox), NO un prompt (ENDGAME 0x08b9). La piel la LOCALIZA
   * y la concatena — se lleva aparte del `message` para no romper el choke i18n fijo→key.
   */
  reply?: "Yes" | "No";
  /** Cue de sonido a emitir en este beat (censo GAP 8; duración/beep del PC-speaker). */
  sfx?: SfxCue;
  /** Pausa tras el beat en UNIDADES crudas de `delay`. La piel las convierte a ms. */
  delayUnits?: number;
  /**
   * Página de END.DAT de un beat de HISTORIA (storyHouse/storyDream): índice 0-5. La piel
   * lo usa para elegir la LÁMINA de fondo — el careo del atlas endgame-scenes confirma
   * UNA sub-imagen por página en orden de fichero (END1.16:0-2 = págs 0-2, END2.16:0-2 =
   * págs 3-5; extractor parseEndgameArts). Ausente fuera de las fases de historia.
   */
  page?: number;
}

/**
 * Texto derivado del endgame, INYECTADO (no duplicado): las páginas byte-exactas que el
 * extractor ya saca de ENDMSG.DAT/END.DAT (parseEndgameDialogue/parseEndgameNarration).
 * El core las estructura en beats; la fuente de verdad sigue siendo el fichero extraído.
 */
export interface EndgameText {
  /** Registros de ENDMSG.DAT en ORDEN DE FICHERO (parseEndgameDialogue.records, 11 páginas). */
  dialogue: readonly string[];
  /** Páginas de END.DAT (parseEndgameNarration.pages) — para las pantallas de historia (hito posterior). */
  narration?: readonly string[];
}

/** GUIÓN completo del endgame — beats ordenados por fase para que la piel los pacee. */
export interface EndgameScript {
  ending: EndgameEnding;
  beats: readonly EndgameBeat[];
}

/**
 * Cola de la VICTORIA (con caja): gate rojo → disolución → historia → pergamino → freeze.
 *
 * NOTA de ALTITUD (core vs piel): la ANIMACIÓN de estas fases es PRESENTACIÓN de la piel
 * (H2), como las fases de escena de RefugeScript — el core sólo marca la FASE:
 *   - `orbMoongate`: la piel anima orb→gate + salida uno-a-uno, y emite del censo GAP 8 los
 *     15 beeps ASC (open), el ping por miembro y los 15 DESC (close). Un beat de fase basta.
 *   - `dissolve` (CLASE-B, rutina-pintora SIN identificar): la piel reusa `visualLfsr.ts`
 *     (orden derivado byte-exacto) a pantalla COMPLETA, con la DURACIÓN medida del testigo
 *     (~3 s, frames 101-104). **PENDIENTE**: la rutina residente exacta que la dispara (los
 *     near-calls positivos del tail de ENDGAME.OVL sin resolver limpiamente; NO inventar).
 *   - `scroll`: reusa el pergamino existente (questScroll/formatQuestReport) sobre ENDSC.16;
 *     la «FANFARRIA» quedó REFUTADA (adenda fanfarria-re §6: el audio 139-153 s del testigo
 *     es POST-FREEZE, artefacto del host; entre el último print y el freeze 0x4f9 no hay
 *     NINGUNA llamada) → el pergamino y el estado terminal son MUDOS. Nada pendiente.
 * Las DURACIONES crudas (delayUnits) de las fases temporizadas se fijan en H2 contra los
 * frames del testigo (ventana de validación frame-a-frame propia del final).
 */
const VICTORY_TAIL: readonly EndgamePhase[] = [
  "orbMoongate",
  "dissolve",
  "storyHouse",
  "storyDream",
  "scroll",
  "terminalFreeze",
];

/**
 * Índices de página de ENDMSG.DAT por rama (guion table GAP 3):
 *   - VICTORY: beats 1-2 (rec 0,1) + rama Yes (rec 3-9 = beats 4-10) → GAP 4.
 *   - STRANDED: beats 1-2 (rec 0,1) + 2ª pregunta (rec 2 = beat 3) + terminal (rec 10 = beat 11).
 * (rec 2 y rec 10 son EXCLUSIVOS de la rama No; rec 3-9 exclusivos de la Yes.)
 */
const DIALOGUE_VICTORY = [0, 1, 3, 4, 5, 6, 7, 8, 9] as const;
const DIALOGUE_STRANDED = [0, 1, 2, 10] as const;

/**
 * Páginas de END.DAT por pantalla de historia (GAP 6, careo del testigo con los arts):
 *   - `storyHouse` (fondo END1.16): pág 0 (círculo de piedras + casa desierta) + pág 1
 *     (el interior — «Much time has passed… TV set, stereo… not yet at an end»).
 *   - `storyDream` (fondo END2.16): pág 2 (dormir → sueño) + págs 3-5 (sala del trono de
 *     Blackthorn, el Orb, la puerta roja, «I offer thee a choice», Blackthorn cruza el gate).
 * Sólo en la VICTORIA (la rama varada no llega a las pantallas de historia).
 */
const STORY_HOUSE_PAGES = [0, 1] as const;
const STORY_DREAM_PAGES = [2, 3, 4, 5] as const;

/**
 * Construye el guión de beats del endgame para el desenlace dado, inyectando el `text`
 * derivado. La fase `dialogue` se expande por rama (H1b); las pantallas de historia en un
 * beat por página (con su lámina, `page`); el resto es espina de 1 beat que la piel anima.
 *
 * `avatarName` (H2c): el record 0 de ENDMSG.DAT termina en `"Well met,\n` (byte-exacto:
 * 0x0a 0x00 en el fichero) — el NOMBRE + `!"` los ensambla endgame_main en runtime
 * (derivation guion-table beat 1: `¶Lord British says:¶¶"Well met,`<nombre>`!"`). Con
 * nombre presente el beat 0 lleva la página COMPLETA; sin él (tests H1) el record crudo.
 *
 * SONIDO del censo GAP 8 — CORREGIDO (adenda fanfarria-re 2026-07-22, re/notes/
 * fanfarria-endgame-espectral.md §3/§7): `0xffff9856` → 0x3ae6 NO es un beep, es
 * RUN-N-FRAMES (pausa MUDA de n ticks ≈ n·55 ms; en la sala del endgame el ambiente
 * del tick es mudo). Por tanto el guión NO hornea cues de beep:
 *   - llegada a la escena verde: pump 0x28=40 ticks MUDO (ENDGAME 0x06f2) → un beat
 *     greenScene con `delayUnits: 0x28` (los antiguos «beeps durs 2 y 3» 0x0502/0x050c
 *     eran los ticks INTERNOS de la rutina de PASO 0x04fe, no del re-tinte).
 *   - pumps de PÁGINA (dur 0x28; 0x0830/0x0922): pausas mudas de 2.3 s tras cada
 *     pantalla — los beats de historia/pergamino van SIN sfx (el paceo por tecla /
 *     timer de la piel ya cubre la espera; dibujo de página instantáneo y mudo).
 *   - rama varada: el pump 0x28 del «pull up a chair» (0x0a81) también es pausa muda.
 * Los del moongate (15 «tonos» asc/desc = 15 FRAMES mudos de animación, tick(4) LB y
 * tick(1) por miembro = pacing mudo) tampoco suenan: la piel sólo ANIMA la fase
 * `orbMoongate` (frames del timeline, ver skin/endgameScene.ts) y emite `move-step`
 * por cada paso de sprite (0x04fe→0x433e) — un solo beat de espina en el guión.
 */
export function buildEndgameScript(
  ending: EndgameEnding,
  text: EndgameText,
  avatarName?: string,
): EndgameScript {
  // Re-tinte verde: el beat que FIJA la escena + el pump de LLEGADA (0x06f2) como
  // pausa MUDA de 0x28=40 ticks (run-n-frames; adenda fanfarria-re §3 — sin beep).
  const beats: EndgameBeat[] = [{ phase: "greenScene", delayUnits: 0x28 }];
  // Rama del diálogo (GAP 3): beats 1-2 siempre; luego Yes(victoria) o No(stranded).
  const reply: "Yes" | "No" = ending === "victory" ? "Yes" : "No";
  const dialogueIdx = ending === "victory" ? DIALOGUE_VICTORY : DIALOGUE_STRANDED;
  for (const i of dialogueIdx) {
    // Beat 1 (rec 0): página ensamblada en runtime — rec0 + nombre + `!"` (ver cabecera).
    const message =
      i === 0 && avatarName ? `${text.dialogue[0] ?? ""}${avatarName}!"` : text.dialogue[i];
    const beat: EndgameBeat = { phase: "dialogue", message };
    // Los records «You reply: » auto-responden por woodenBox: rec 1 (1ª pregunta, ambas
    // ramas) y rec 2 (2ª pregunta, sólo rama No). El resto son discurso sin respuesta.
    if (i === 1 || i === 2) beat.reply = reply;
    // Rama varada, registro terminal (rec 10 «pull up a chair»): el pump 0x28 de
    // 0x0a81 es una PAUSA MUDA (run-n-frames, adenda fanfarria-re §3) — sin cue.
    if (ending === "stranded" && i === 10) beat.delayUnits = 0x28;
    beats.push(beat);
    // F2-T8 (espejo): entre el rec 3 («…carefully opens the box...») y el rec 4
    // («An artifact…») el binario imprime la string ESTÁTICA de DATA.OVL DS 0x84cc
    // `\n\nHe says:\n\n` con pump 0x28 previo y paceo por tecla (ENDGAME.OVL
    // 0x091e-0x092c: 0x3ae6(0x28) + print 0x84cc + getkey 0x83dc). No está en
    // ENDMSG.DAT — por eso faltaba en los records. Testigo P24:1647. El «beep»
    // 0x3ae6 es RUN-N-FRAMES (refutación fanfarria §3) ⇒ PAUSA MUDA delayUnits.
    if (ending === "victory" && i === 3) {
      beats.push({
        phase: "dialogue",
        message: "\n\nHe says:\n\n",
        delayUnits: 0x28,
      });
    }
  }
  if (ending === "victory") {
    for (const phase of VICTORY_TAIL) {
      // Las pantallas de historia se expanden en un beat por PÁGINA de END.DAT (GAP 6),
      // cada una con su lámina (`page` → sub-imagen del atlas endgame-scenes); las demás
      // fases son espina (1 beat; la piel las anima). Los pumps de página (dur 0x28;
      // 0x0830/0x0922) son PAUSAS MUDAS (run-n-frames, adenda fanfarria-re §3/§5: el
      // dibujo de página es instantáneo y mudo; los «rumbles» del testigo eran el
      // artefacto del host sobre el spin) — ningún beat lleva cue de beep.
      if (phase === "storyHouse") {
        STORY_HOUSE_PAGES.forEach((p) =>
          beats.push({ phase, message: text.narration?.[p], page: p }),
        );
      } else if (phase === "storyDream") {
        STORY_DREAM_PAGES.forEach((p) =>
          beats.push({ phase, message: text.narration?.[p], page: p }),
        );
      } else {
        beats.push({ phase });
      }
    }
  } else {
    beats.push({ phase: "terminalPrison" });
  }
  return { ending, beats };
}
