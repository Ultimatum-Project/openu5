/**
 * Gate del CURSOR de consola: qué estados de UI cuentan como «modal abierto» y por tanto
 * APAGAN el cursor, y cuáles son espera-de-input y lo dejan encendido.
 *
 * Vivía como un `const modalOpen = a || b || …` dentro de `refreshAwaiting`, que a su vez
 * vive dentro de `boot()` (main.ts) — y `boot()` no se exporta, así que el predicado NO
 * era alcanzable por un test (misma medición que #237: 5.376 líneas en una función, cero
 * importadores posibles). #329 lo saca aquí SIN cambiar su semántica salvo la fila que la
 * ficha manda cambiar, para que la guarda pueda existir y el mutante del gate signifique
 * algo. Es el primer mordisco —minúsculo— del troceado que pide #237.
 *
 * ★ EL CRITERIO, que es lo que hay que leer antes de tocar la lista: el cursor dice «el
 * motor espera algo TUYO». Un estado entra en esta lista si durante él NO se espera nada
 * del jugador (una escena que avanza sola, una tanda enemiga paceada, un panel que ya
 * gestiona su propio input). NO entra si el motor está parado esperando una tecla — ahí el
 * cursor es exactamente el mensaje correcto.
 *
 * ★★ RE-ADJUDICACIÓN de `promptOpen` (carril cursor-getkey, cabo de #341 §7.2): el
 * criterio de arriba TENÍA RAZÓN también para los prompts modales — en el binario TODA
 * espera de tecla del kernel (`getkey_with_redraw`, ULTIMA.EXE:`0x266c`) pinta el CURSOR
 * ANIMADO en cada iteración del bucle (`0x267f call 0x1b38` = `poll_key_blink_cursor`,
 * kernel-sweep-2.md §5: putchar de `[0x5390]+[0x540c]` en la posición de texto actual,
 * borrado con espacio al llegar la tecla). El embudo es ÚNICO (el cursor vive DENTRO de
 * 0x266c), así que sus 100 call-sites parpadean todos — censo y testigo en
 * re/notes/getkey-cursor-derivacion.md. Lo que `isModalOpen` decide de verdad NO es «el
 * cursor», sino la fila ► de COMANDO NUEVO (y la ola sobre ella): con un prompt abierto
 * NO se abre fila ► (el testigo muestra «To phase: ▓» sin fila ► debajo) — por eso
 * `promptOpen` SIGUE en el OR. El cursor de los prompts llega por el canal paralelo de
 * fila viva (`promptCursorOnLiveRow` → `setAwaitingGetstring`), abajo.
 */
export interface AwaitingGateFlags {
  /**
   * Prompt Y/N/dígito/texto del original vivo. ~~«el modal REAL: él gestiona el input»
   * ⇒ cursor apagado~~ — TACHADO (cabo #341 §7.2): esa justificación leía «gestiona su
   * propio input» como si el prompt trajera otro indicador, y no trae ninguno; el binario
   * parpadea el cursor exactamente ahí (0x1b38 dentro de 0x266c; testigo Fenton lf29/
   * lf30/lf31). La fila se queda porque gobierna la fila ► de comando nuevo (ver la
   * cabecera); el cursor del prompt va por `promptCursorOnLiveRow`.
   */
  promptOpen: boolean;
  /** Consola de diálogo con NPC abierta. */
  talkActive: boolean;
  /** Consola de tienda abierta. */
  shopOpen: boolean;
  /** Acampada en curso (avanza sola). */
  camping: boolean;
  /** Sueño en cama en curso (avanza solo). */
  sleeping: boolean;
  /** Refugio en curso. */
  refuging: boolean;
  /**
   * Pacer del desenlace. SIGUE contando como modal: alterna beats de tecla con FASES DE
   * ANIMACIÓN por temporizador, y su espera usa otra rutina (`getkey 0x83dc`) cuyo cuerpo
   * NO está derivado. No se armoniza con el rito por simetría — #329.
   */
  endgamePacing: boolean;
  /** Cinemática del troll del puente (avanza sola). */
  trollSneaking: boolean;
  /** Escena del santuario paceada (avanza sola). */
  shrineScenePacing: boolean;
  /** Segmento de la escena de la captura de Blackthorn paceado (#324, avanza solo).
   *  Sus esperas de tecla van por `shrineKeyWaiting` (no-modal, mismo kernel 0x266c). */
  blackthornScenePacing: boolean;
  /**
   * ★ Rito APARCADO esperando tecla (#294). NO es modal — y ésa es la corrección de #329.
   * Su rutina es `getkey_with_redraw` (CAST2 `call 0x448c` → kernel 0x266c), un BUCLE DE
   * SONDEO que redibuja por iteración sin tecla (`0x269a call 0x5910`): en 1988 la pantalla
   * sigue viva y el motor SÍ espera una tecla del jugador. Se declara en la interfaz para
   * que quien lea la lista vea que su ausencia del OR es deliberada, no un olvido.
   */
  shrineKeyWaiting: boolean;
  /** Tanda enemiga paceada (el prompt ► sólo vive en el await del PJ). */
  combatPacing: boolean;
  /** Selector Cast/Ready/… visible (gestiona su propio input). */
  selectorVisible: boolean;
}

/**
 * Tipos de `PendingPrompt` cuya espera pasa, en el binario, por el getkey del kernel
 * (`ULTIMA.EXE:0x266c`) leyendo en la CONSOLA — y por tanto llevan el cursor animado al
 * final de la fila viva («To phase: ▓»). Lista EN CRUDO (no derivada del sujeto): quien
 * añada un tipo de prompt a `PendingPrompt` cae en la guarda hasta clasificarlo.
 *
 * Derivación (re/notes/getkey-cursor-derivacion.md): el bucle de 0x266c llama a
 * `poll_key_blink_cursor` (0x1b38) en CADA iteración — el cursor es del BUCLE DE ESPERA,
 * no del print del prompt —, así que la población es «todo prompt que espere por 0x266c»:
 *  · getkey       — CAST.OVL:0x0d06 (Vas Rel Por «To phase:»); testigo lf30@374.
 *  · digit        — kernel 0x3dbc (menú de Camp) entre otros.
 *  · yesno/-esc   — getkeys de TOWN/MAINOUT/CMDS (peajes, «Dost thou pay?», …).
 *  · party-select — kernel 0x2d7a espera en 0x2dca → 0x266c; testigo lf31@1253
 *                   («Player: ▓» parpadeando con el picker abierto).
 *  · text/number/rune — getstrings de consola: ya llevaban el cursor (fix previo,
 *                   «:VERAMOCOR▓»); testigo lf29@1656 (fila «:▓» del rúnico).
 *  · shop         — SHOPPES/2/3 suman 35 call-sites de 0x266c y la tienda del port
 *                   escribe en la MISMA consola (hud.message→pushConsole).
 * EXCLUIDO `ready-picker`: su ola ya la pinta la rama `readyPicker` de `showWave`
 * (fiel/skin.ts) con el overlay abierto, y la cadena de espera de
 * `item_page_controller` (0x0f2e) no está derivada aquí — incluirlo no cambiaría nada
 * visible y firmaría una derivación que no se hizo.
 */
export const PROMPT_TYPES_CURSOR_ON_LIVE_ROW = [
  "yesno-esc",
  "yesno",
  "digit",
  "party-select",
  "text",
  "number",
  "rune",
  "getkey",
  "shop",
] as const;

/**
 * `true` si el prompt vivo (por su `type`) debe mantener el cursor animado al final de
 * la fila de eco viva — el calco del `poll_key_blink_cursor` (0x1b38) del bucle getkey.
 * `null` (sin prompt) = false: sin prompt el cursor lo gobierna `isModalOpen` (fila ►).
 */
export function promptCursorOnLiveRow(type: string | null): boolean {
  return type != null && (PROMPT_TYPES_CURSOR_ON_LIVE_ROW as readonly string[]).includes(type);
}

/**
 * `true` si hay un modal que debe APAGAR el cursor de la fila ► de comando nuevo.
 * `shrineKeyWaiting` NO participa: es espera de input, no modal (#329). Con `promptOpen`
 * el cursor NO desaparece del todo: se muda a la fila viva del prompt vía
 * `promptCursorOnLiveRow` (re-adjudicación del cabo #341 §7.2, ver cabecera).
 */
export function isModalOpen(f: AwaitingGateFlags): boolean {
  return (
    f.promptOpen ||
    f.talkActive ||
    f.shopOpen ||
    f.camping ||
    f.sleeping ||
    f.refuging ||
    f.endgamePacing ||
    f.trollSneaking ||
    f.shrineScenePacing ||
    f.blackthornScenePacing ||
    f.combatPacing ||
    f.selectorVisible
  );
}
