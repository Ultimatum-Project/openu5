/**
 * Pickers de PJ + getstring rúnico — los selectores FIELES compartidos por los
 * comandos (Cast/Ready/Search/New Order/curandero…), extraídos de boot()
 * (TRAMO 2 del refactor estructural, auditoría MANT-1/ARQ-2). Las máquinas
 * PURAS viven en core (`startPartyMemberPicker`, reductores); aquí va el
 * CABLEADO a hud/view/prompts con deps inyectadas (patrón shop-console.ts).
 * `createPickers` devuelve las mismas cinco funciones que antes eran closures.
 */
import { startPartyMemberPicker } from "../core/partyMemberPicker.js";
import { effectiveName } from "../core/party.js";
import { CAST_TARGET_UI, COMMAND_CHAR_DISABLED, READY_UI, TALK_UI } from "../core/world/cmd-strings.js";
import { t, tf } from "../i18n/index.js";
import type { Game } from "../core/game.js";
import type { PendingPrompt } from "./prompt-manager.js";

export interface PickersDeps {
  game: Game;
  hud: {
    message(text: string): void;
    messageAppend(text: string): void;
    echo(text: string): void;
    /** Abre la fila del cursor del getstring (`:`), sin bullet. Ver `pickSpellTyped`. */
    echoCursor(text: string): void;
  };
  view: { setSelectCursor(idx: number | null): void };
  /** Prompt vivo (PromptManager): party-select / rune se arman aquí. */
  prompts: { current: PendingPrompt | null };
  refreshAwaiting: () => void;
}

export interface Pickers {
  pickMember: (title: string, cb: (charIdx: number) => void, onCancel?: () => void) => void;
  pickCaster: (cb: (charIdx: number) => void) => void;
  pickCommandChar: (cb: (charIdx: number) => void) => void;
  pickCastTarget: (cb: (charIdx: number) => void) => void;
  /**
   * getstring rúnico. El prompt va SIEMPRE en las DOS filas del original: etiqueta +
   * fila de cursor `:` (Cast DS 0x4603, Mix DS 0x8fac). Ver #107 en la implementación.
   */
  pickSpellTyped: (prefix: string, submit: (initials: string) => void) => void;
}

export function createPickers(deps: PickersDeps): Pickers {
  const { game, hud, view, prompts, refreshAwaiting } = deps;

  // Picker de miembro FIEL (kernel `select_party_member` 0x2d7a, COMPARTIDO por
  // Ztats/Ready/Give/Cast/… en el binario): navega el ROSTER con el cursor en VÍDEO
  // INVERSO (más la flecha `→` fija en el activo) — la misma primitiva que el guardia
  // del Camp (dictamen del vídeo del camp). Sustituye al popup DOM `selector.show`:
  // el original NO abre lista aparte, elige sobre el roster. `title` va a la consola
  // (como "Who will stand guard?"); flechas mueven, 1-N elige directo, Enter/Space/0
  // confirma el cursor, ESC cancela (sin cb). El índice devuelto (0-based en el party)
  // es el índice de personaje (el party son characters[0..partySize-1]).
  const pickMember = (
    title: string,
    cb: (charIdx: number) => void,
    onCancel?: () => void,
  ): void => {
    startPartyMemberPicker(title, {
      print: (t2) => hud.message(t2),
      setSelectCursor: (idx) => view.setSelectCursor(idx),
      setPrompt: (p) => {
        prompts.current = p;
        refreshAwaiting(); // el prompt cambió → re-deriva el gate del cursor (F-G)
      },
      partySize: () => game.state.partySize,
      onSelect: (idx) => cb(idx),
      onCancel,
    });
  };

  // Prompt de OBJETIVO-PJ de los hechizos curativos — CAST2.OVL 0x009e (carril
  // cadenas-presentacion; diff-2, 83 testigos OCR «On who: Min»): imprime
  // `On who: ` (DS 0x94f4), abre el select de roster (kernel 0x4cae [= CS 0x2e8e →
  // ULTIMA.EXE:0x2e8e select_party_member_default], sin eco
  // propio) y COMPLETA la fila con el NOMBRE del registro elegido
  // ([idx·0x20+0x55a8] → «On who: Min») o con `None!` (DS 0x94fe) al cancelar.
  // Callers del binario (thunk 0xffffc1aa = stub 0x812a → CAST2 0x9e): awaken
  // 0x011c · cure 0x01b5 · heal 0x0200 · resurrect 0x08b3/0x10ec — es el picker
  // de TODOS los cast con objetivo-PJ, en combate y fuera. El «sin prompt
  // impreso» del lote cast-echo era un falso negativo (la función vive en CAST2
  // y sólo se alcanza vía stub); el «Player: » (DS 0x96b4) es de Ready/Ztats.
  // Selección de PJ de COMANDO con gate del activo — kernel resolve_command_char
  // 0x4988 (player-select-selectors.md §2), caller nuevo verificado: (S)earch
  // (SJOG 0x09a0 `call 0xffff8a08` → base SJOG 0xBF80 + 0x8a08 = kernel 0x4988).
  // Gate: activo→directo (@0x49b2), ≤1 elegible 'G'/'P'→auto (@0x49fa); ≥2 → prompt
  // "Player: " (DS 0xa3c4, @0x4a02) + NOMBRE en la misma fila (@0x4a30-0x4a3a; testigo
  // LP P08 E11 «Player: Min»); cancel → "None!" (DS 0xa3da, @0x4a65). El miembro
  // elegido es el PERCEPTOR del trap-check del cofre (game.search searcherIdx).
  // Es también el resolvedor del (C)ast: ver `pickCaster` abajo, que delega aquí
  // porque en el binario los dos comandos llaman al MISMO 0x4988.
  const pickCommandChar = (cb: (charIdx: number) => void): void => {
    const st = game.state;
    if (st.activeCharacter !== 0xff && st.activeCharacter < st.partySize) {
      cb(st.activeCharacter);
      return;
    }
    const eligible: number[] = [];
    for (let i = 0; i < st.partySize; i++) {
      const s = st.characters[i]?.status;
      if (s === "G" || s === "P") eligible.push(i);
    }
    if (eligible.length <= 1) {
      if (eligible.length === 1) {
        cb(eligible[0]!);
        return;
      }
      // CERO elegibles → «None!». No es una rama aparte en el binario: `[bp-8]` conserva
      // el 0xFFFF que le puso @0x4990 (el bucle 0x49dc-0x49f2 sólo escribe `di` ahí
      // cuando encuentra 'G'/'P'), el `cmp [bp-6],1` / `jle 0x4a5f` de @0x49fa-0x49fe
      // salta la vía que pregunta, y el EPÍLOGO COMÚN la imprime:
      //   4a5f: 837ef8ff  cmp word ptr [bp - 8], -1
      //   4a63: 7509      jne 0x4a6e
      //   4a65: b8daa3    mov ax, 0xa3da   ; DATA.OVL fileoff 0xa3ea = b'None!\n\x00'
      //   4a69: e8e4cd    call 0x1850
      // Es EL MISMO print que la cancelación (que llega ahí con `[bp-8]` = si < 0), por
      // eso comparten cadena. Fila propia: en esta rama no se imprimió el prompt de
      // @0x4a02, así que `hud.message` y no `messageAppend`.
      hud.message(t(READY_UI.none));
      return;
    }
    // BUCLE DE RE-PREGUNTA (@0x4a00-0x4a57). `di` arranca a 0 (@0x4a00 `sub di,di`) y
    // sólo las SALIDAS lo ponen a 1 (@0x4a12, alcanzado desde la cancelación @0x4a10 y
    // desde el final del camino bueno @0x4a42/@0x4a4b); el `or di,di / je 0x4a02` de
    // @0x4a55-0x4a57 vuelve al prompt mientras siga a 0. La ÚNICA vía que lo deja a 0 es
    // @0x4a2e: el elegido cuyo byte de estado `[si·0x20 + 0x55b3]` no es 'G' (0x47) ni
    // 'P' (0x50) cae en @0x4a4e, imprime DS 0xa3ce = b'Disabled!\n\n' y RE-PREGUNTA.
    // El nombre NO se ecoa en esa vía: el `jne 0x4a4e` salta por delante del print de
    // @0x4a30-0x4a3a. El predicado del estado es el MISMO byte y los MISMOS dos valores
    // que el censo de elegibles de @0x49dc-0x49e4 — por eso aquí se reusa `eligible`.
    const ask = (): void => {
      pickMember(tf(READY_UI.player), (idx) => {
        const status = game.state.characters[idx]?.status;
        if (status !== "G" && status !== "P") {
          hud.messageAppend(t(COMMAND_CHAR_DISABLED)); // @0x4a4e, DS 0xa3ce
          ask(); // @0x4a55/@0x4a57: di == 0 ⇒ el prompt de @0x4a02 otra vez
          return;
        }
        hud.messageAppend(effectiveName(game.state.characters[idx]?.name));
        cb(idx);
      }, () => {
        hud.messageAppend(t(READY_UI.none));
      });
    };
    ask();
  };

  // Caster-select de (C)ast. Es LA MISMA rutina del binario que resuelve el PJ del
  // (S)earch: `CAST.OVL:0x0dd5 call 0x8a08` → (base CAST 0xBF80) → kernel
  // `resolve_command_char` **0x4988**, el mismo destino que SJOG 0x09a0. Un solo
  // cuerpo en el binario ⇒ un solo cuerpo aquí: `pickCaster` DELEGA en
  // `pickCommandChar` en vez de duplicar el gate con otra cadena.
  //
  // 🔴 CORRECCIÓN (carril fix-cast-selector, 22-08). El cuerpo duplicado que vivía aquí
  // acertaba el GATE y erraba las TRES SALIDAS de la vía que pregunta:
  //   ✗ imprimía «Cast & who?» — cadena FABRICADA. La única vía que pregunta
  //     (0x4a00-0x4a57) tiene UN solo print de prompt: `4a02 mov ax,0xa3c4` /
  //     `4a05 push ax` / `4a06 call 0x1850`, y DS 0xa3c4 es **"Player: "** (volcado
  //     de DATA.OVL con fileoff = DS+0x10: b'Player: \x00'). NO hay emisión
  //     carácter-a-carácter en la rutina —que era la explicación con la que
  //     `cast-input.md` §9 salvaba el que "who?" tenga 0 hits en DATA.OVL/OVLs.
  //   ✗ no apendaba el NOMBRE: `4a30-4a3a` empuja `si·0x20 + 0x55a8` (el registro de
  //     roster elegido) al MISMO print_string ⇒ la fila queda «Player: Min».
  //   ✗ no imprimía «None!» al cancelar: `4a12` deja `[bp-8]` en 0xFFFF y el epílogo
  //     `4a5f cmp [bp-8],-1` / `4a65 mov ax,0xa3da` imprime DS 0xa3da = b'None!\n'.
  // Medida que lo adjudica (corpus OCR de 49 rutas de LPs del ORIGINAL, routes/ +
  // routes-ad/): **70** líneas «Cast... Player: <nombre> Spell name:» —y dos
  // «Cast... Player: None!» (part09-g11 ocrLn 1210, part13-g03 ocrLn 298), que sólo
  // puede emitir la vía de cancelación de arriba— frente a **0** líneas con «Cast &
  // who?» (censo con control positivo: 622 líneas contienen "who", todas «On who: »,
  // «Who will stand guard?» o prosa TLK). El testigo pixel de §9,
  // `av-referencia/command-prompts/ORIG_cast_yell_log.png`, YA NO EXISTE en disco
  // (censo: av-referencia tiene 6 directorios, ninguno command-prompts).
  //
  // Los TRES residuos que este comentario declaró abiertos, cerrados el 22-08 por el
  // carril `cast-completo` (dos fixes arriba + una REFUTACIÓN):
  //   · ~~0 elegibles debería imprimir «None!» (mismo epílogo 0x4a5f) y no lo hace.~~
  //     CIERTO y ARREGLADO: `pickCommandChar` lo imprime (rama `eligible.length === 0`).
  //   · ~~falta el bucle de re-pregunta con «Disabled!» (`4a4e`, DS 0xa3ce).~~ CIERTO y
  //     ARREGLADO: `ask()` recursivo, cita instrucción a instrucción en el cuerpo.
  //   · ~~falta la vía 1 del binario (`4995 cmp [g_location],0x80` / `499a jbe`): en
  //     combate y MAZMORRA el lanzador es `g_cmb_actor` y NO se pregunta nunca — ficha
  //     abierta en `resolve-command-char-178c-acta.md`, afecta a doDungeonCast.~~
  //     **REFUTADO en sus dos mitades** (`re/notes/resolve-command-char-178c-acta.md §6`):
  //     (a) MAZMORRA — `g_location` en el pasillo NO es 0xFF sino 0x21..0x28
  //         (`MAINOUT.OVL:0x0887-0x088c` escribe índice+1 y acto seguido `cmp al,0x28` +
  //         init de mazmorra; `DUNGEON.OVL:0x003a sub ax,0x21` lo usa como índice de mapa;
  //         el 0xFF de `DUNGEON.OVL:0x00a8` es de la SALA —lleva a `COMBAT.OVL:0x0b94`— y
  //         se restaura en 0x00d8/0x0109). Con ≤0x80 el `jbe` de @0x499a toma la vía que
  //         PREGUNTA ⇒ `doDungeonCast`/(S)earch de mazmorra ya son fieles. Control
  //         independiente: la máscara DS 0x1C90 de Uus Por / Des Por vale 0x02 (bit
  //         MAZMORRA, sin bit combate) y sólo se testea en 0x21≤loc≤0x7f (CAST 0x0e74).
  //     (b) COMBATE — la rama SÍ existe y es alcanzable (`COMBAT.OVL:0x08f0` 'C' →
  //         `0x095e` → CAST.OVL:0x0dba → 0x0dd5 → 0x4988 con `g_location`=0xFF), pero el
  //         port YA la implementa: el (C)ast de combate no llama a `pickCaster`, toma el
  //         actor del turno (`main.ts` ~2819 `cur.charIdx` = `g_cmb_actor`).
  const pickCaster = (cb: (charIdx: number) => void): void => pickCommandChar(cb);

  const pickCastTarget = (cb: (charIdx: number) => void): void => {
    pickMember(tf(CAST_TARGET_UI.onWho), (idx) => {
      // Nombre en la MISMA fila (CAST2 0x00c4: print del registro tras el select).
      hud.messageAppend(effectiveName(game.state.characters[idx]?.name));
      cb(idx);
    }, () => {
      // Cancel (ax<0, CAST2 0x00b5): `None!` en la misma fila y el cast queda
      // en el tail silencioso (ret -1). messageAppend no pasa el choke → t().
      hud.messageAppend(t(CAST_TARGET_UI.none));
    });
  };

  // getstring RÚNICO fiel para Cast/Mix (CAST2.OVL 0x00de vía thunk CS 0x808e): el
  // jugador TECLEA la inicial de cada sílaba y se ecoa la palabra rúnica en
  // MAYÚSCULAS. `submit` recibe las iniciales ("" = vacío/ESC). Corre EN EL MISMO
  // PUNTO que el antiguo scroller (al confirmar), así que el orden de RNG de
  // cast/mix no cambia. Ver `re/notes/cast-input.md`.
  //
  // #107 — el prompt son DOS FILAS, y el binario las trae en UNA SOLA cadena con el
  // salto dentro: Cast = DATA.OVL DS 0x4603 "Spell name:\n:" y Mix = DS 0x8fac
  // "For what spell?\n:". El `\n` abre fila y el `:` es el CURSOR del getstring; lo
  // tecleado se ecoa en ESA segunda fila, no pegado a la etiqueta:
  //     Spell name:
  //     :IN LOR▓
  // Es el mismo modelo ya cableado en (Y)ell ("what?\n:") y en Talk, y el renderer ya
  // sabía partirlo (control positivo en `skin-coreview.test.ts`: pushConsole de la
  // cadena entera da ["Spell name:", ":"]). El defecto vivía SÓLO aquí, en el call-site.
  //
  // ⚠ Por qué se recorta el final del `prefix` en vez de pedir la cadena partida: los
  // llamadores viven en `main.ts`, que está bajo embargo, y pasan la etiqueta con un
  // ESPACIO final ("Spell name: ") como sustituto del `\n` del binario. Ese espacio es
  // relleno de la fila única vieja, no texto del original — al abrir la fila del cursor
  // deja de tener a qué separar y se va. La traducción no se toca (el corpus sigue
  // teniendo la clave con su espacio).
  const pickSpellTyped = (prefix: string, submit: (initials: string) => void): void => {
    // Fila 1: etiqueta (DS 0x4603 / 0x8fac). La imprime `print_string` (kernel 0x1850),
    // NO el eco del despachador ⇒ fila PLANA: sin bullet ► y sin abrir grupo. Careo #341
    // contra el único testigo de vídeo (Lord Fenton, 5 casts de Vas Rel Por en lf29/lf30/
    // lf31): «Cast... / Spell name: / :VAS REL POR» consecutivos — «Spell name:» sin ► y
    // sin línea en blanco delante. `echoCursor` = eco `cont` (console.ts:115); el label
    // llega ya traducido de los call-sites (tf/t), que es lo que el choke habría hecho.
    hud.echoCursor(prefix.replace(/\s+$/, ""));
    hud.echoCursor(TALK_UI.cursor); // fila 2: ':' del getstring, fila de eco viva
    // El eco de las sílabas cuelga del CURSOR (prompt-manager: `prefix + syllables`).
    prompts.current = {
      type: "rune",
      prefix: TALK_UI.cursor,
      initials: "",
      syllables: [],
      max: 4,
      submit,
    };
    refreshAwaiting();
  };

  return { pickMember, pickCaster, pickCommandChar, pickCastTarget, pickSpellTyped };
}
