/**
 * Copy VERBATIM de los nombres de comando que imprime el dispatcher del kernel
 * (kernel_cmd_dispatch, pool 0x3178) leídos de DATA.OVL. El dispatcher hace
 * `mov ax,<DS_off>; call kernel_print` con el puntero al string; en RAM DS es el
 * segmento de carga de DATA.OVL, de modo que `fileoff = DS_off + 0x10`
 * (re/notes/dataovl-strings.md §"DATA.OVL = imagen del DGROUP").
 *
 * Verificado byte a byte contra `original/u5/ultima5/DATA.OVL` (dump con la
 * fórmula +0x10). Los comandos DIRECCIONALES imprimen "<Cmd>-" y luego el overlay
 * pide la dirección con su propio getdir (0x766c/0xB41C) — NO hay prompt
 * "— which way?" en el original; esa cadena era copy propio del clon (QoL) y se
 * sustituye por el copy fiel (contrato de fidelidad L6, decisión F1.8).
 *
 * "Attack-" NO lo imprime el dispatcher (el kernel imprime "" en el case A,
 * 0x3216): lo pone el overlay destino — MAINOUT overworld (DS 0x29fe) y TOWN
 * (DS 0x26e0), ambos = "Attack-", verificados igual.
 *
 * ⚠ CITAS: los offsets de este módulo son los del DESPACHADOR (ULTIMA.EXE 0x3178).
 * Los overlays que NO pasan por él tienen copias BYTE-IDÉNTICAS con otro offset:
 * COMBAT.OVL 0x6df6-0x6ee6 (arena), DUNGEON.OVL 0x6cba/0x6cce (Klimb del pasillo),
 * TOWN 0x2723, SJOG 0x8ede. Reusar estas constantes fuera del despachador es
 * correcto (mismos bytes); CITAR este offset desde ahí, NO — cita el del overlay
 * emisor. Mapa completo: re/notes/combat-commands.md y re/notes/citas-109-acta.md.
 */
export const CMD_STRINGS = {
  pass: "Pass\n", // DS 0xa134
  attack: "Attack-", // MAINOUT 0x29fe / TOWN 0x26e0 (el kernel imprime "")
  board: "Board ", // DS 0xa13a (con espacio final)
  cast: "Cast...\n", // DS 0xa142
  fire: "Fire-", // DS 0xa164
  get: "Get-", // DS 0xa16a
  ignite: "Ignite torch!\n", // DS 0xa188
  jimmy: "Jimmy-", // DS 0xa198
  klimb: "Klimb-", // DS 0xa1a0
  look: "Look", // DS 0xa1a8 (el guión NO va en la DS; lo imprime el despachador con putchar('-') 0x3332 → el call-site en main.ts añade "-" para "Look-North")
  mix: "Mix Reagents\n\n", // DS 0xa1b4
  newOrder: "New Order", // DS 0xa1c4
  open: "Open-", // DS 0xa1ce
  push: "Push-", // DS 0xa1e4
  quit: "Quit:", // DS 0xa1ea
  ready: "Ready...\n\n", // DS 0xa1f0
  search: "Search-", // DS 0xa1fc (overworld/pueblo; en mazmorra el case usa "Search..." 0xa204)
  talk: "Talk-", // DS 0xa210
  use: "Use item\n\n", // DS 0xa24c
  view: "View a gem!\n", // DS 0xa258
  xit: "X-it ", // DS 0xa280
  yell: "Yell ", // DS 0xa286
  ztats: "Z-stats...\n", // DS 0xa28c
  // (N)úmero 1-9/0: SET ACTIVE PLAYER. Los bucles (MAINOUT 0xc06, TOWN vía piano
  // 0xe34) enrutan '0'-'9' al handler del kernel 0x4080, que SIEMPRE imprime este
  // eco antes del nombre / "None!" / "Invalid!". DS 0xa396 = "Set Active Plr:\n"
  // (el \n = separación de línea; el port lo emite como eco sin el \n, el nombre
  // cae en la fila siguiente por el modelo de consola). QA #69.
  setActive: "Set Active Plr:", // DS 0xa396 ("Set Active Plr:\n")
} as const;

/**
 * Cadenas de la UI del comando READY (ZSTATS.OVL `cmd_ready` @0x1296), verbatim de
 * DATA.OVL (imagen del DGROUP, `fileoff = DS + 0x10`; volcadas con `dd` byte a byte).
 * NO son ecos del dispatcher (ese es `CMD_STRINGS.ready` = "Ready...\n\n", DS 0xa1f0);
 * son los prompts que imprime el propio handler mientras conduce la selección de
 * jugador + el picker de ítems:
 *   · `player`  "Player: " (DS 0x96b4) — prompt de `resolve_display_char` @0x002e antes
 *     del roster ►Select:◄; al elegir se le añade el NOMBRE del PJ ("Player: Elwood").
 *   · `item`    "Item: " (DS 0x9998) — prompt antes de abrir el picker (@0x12cc); al
 *     salir se le añade "Done" ("Item: Done").
 *   · `done`    "Done" (DS 0x9970) — sufijo al cerrar el picker con ESC (@0x123e).
 *   · `empty`   "Thou art empty-handed!" (DS 0x997e) — el PJ no tiene nada equipable
 *     (@0x12c3); el handler sale sin abrir el picker.
 *   · `none`    "None!" (DS 0x96be) — el jugador canceló la selección (ret -1, @0x0061).
 *   · `status`  "Status: " (DS 0x97a2) — prompt de la ficha Ztats (el MISMO overlay
 *     ZSTATS): tras elegir jugador se imprime "Player: <nombre>\nStatus: ". Lo renderiza
 *     la piel fiel (skin.ts), fuera del alcance del extractor → se declara aquí para que
 *     la guarda/corpus lo vean y sea traducible por `t()`.
 * (Las cadenas llevan el `\n`/`--` de control fuera; el modelo de consola parte líneas.)
 */
export const READY_UI = {
  player: "Player: ", // DS 0x96b4
  item: "Item: ", //    DS 0x9998
  done: "Done", //      DS 0x9970 ("Done\n")
  empty: "Thou art empty-handed!", // DS 0x997e ("Thou art empty-\nhanded!\n")
  none: "None!", //     DS 0x96be ("None!\n")
  status: "Status: ", // DS 0x97a2 (ficha Ztats, "Player: <nombre>\nStatus: ")
} as const;

/**
 * «Disabled!» — cadena PROPIA de `resolve_command_char` (kernel `ULTIMA.EXE:0x4988`), la
 * rutina que resuelve el PJ del (C)ast y del (S)earch. No la comparte con nadie:
 *
 * ```
 * 4a18: 8bde     mov bx, si            ; si = índice elegido en el roster
 * 4a1a: b105     mov cl, 5             ; stride 0x20 del registro de roster
 * 4a1e: 80bfb35547  cmp byte ptr [bx + 0x55b3], 0x47   ; ¿estado 'G'ood?
 * 4a23: 740b        je 0x4a30
 * 4a29: 80bfb35550  cmp byte ptr [bx + 0x55b3], 0x50   ; ¿estado 'P'oisoned?
 * 4a2e: 751e        jne 0x4a4e                          ; ni 'G' ni 'P' ⇒
 * 4a4e: b8cea3      mov ax, 0xa3ce                      ;   ← ESTA cadena
 * 4a51: 50          push ax
 * 4a52: e8fbcd      call 0x1850        ; print_string
 * 4a55: 0bff        or di, di          ; di sigue 0 (sólo las SALIDAS lo ponen a 1)
 * 4a57: 74a9        je 0x4a02          ; ⇒ RE-PREGUNTA: reimprime "Player: "
 * ```
 *
 * Volcado de `original/u5/ultima5/DATA.OVL` con `fileoff = DS + 0x10`: `0xa3ce` →
 * `b'Disabled!\n\n\x00'`. El `\n\n` cierra la fila y deja la blanca que separa de la
 * re-pregunta (mismo modelo de líneas que `readyRejectLines`).
 *
 * ⚠ No confundir con el trío homónimo de (R)eady/Ztats (`READY_UI`, DS 0x96xx): mismo
 * texto en «Player: »/«None!», DOS tablas distintas — 0x4988 usa DS 0xa3c4/0xa3ce/0xa3da.
 */
export const COMMAND_CHAR_DISABLED = "Disabled!";

/**
 * Envoltura de RECHAZO del picker de (R)eady — ZSTATS.OVL @0x0bee, la rutina por la
 * que pasan TODOS los rechazos de `try_equip_or_unequip` (@0x0c5c: cada rama hace
 * `jmp 0xd2f`, y 0xd2f es `push ax; call 0xbee`):
 *
 *   0bee  print DS 0x97d4 = "\n\n"        ← separación
 *   0bf8  print [bp+4]                    ← el mensaje de rechazo
 *   0bfe  print DS 0x97d8 = "\n\nItem: "  ← separación + RE-PROMPT (el picker sigue abierto)
 *
 * Es decir: el original NO imprime el mensaje pelado. Lo enmarca en líneas en blanco y
 * vuelve a poner el prompt «Item: », de modo que el «Done» del ESC posterior (DS 0x9970,
 * @0x123e) cae sobre ESE re-prompt y se lee «Item: Done». El clon imprimía sólo el
 * mensaje ⇒ el log pegaba líneas y perdía el re-prompt (bug del usuario 2026-07-28, con
 * capturas del original: «Item:» → «Remove first thy present helm!» → blanco → «Item: Done»).
 *
 * Traducción del modelo DOS (cursor) al modelo del port (líneas): en el binario el
 * cursor queda a media fila tras «Item: », así que el primer `\n` CIERRA esa fila y el
 * segundo deja UNA línea en blanco; idem tras el mensaje. Por eso cada `"\n\n"` de la
 * envoltura vale exactamente una fila vacía aquí.
 *
 * NO pasan por esta envoltura (print directo por 0x3670, verificado en el disasm):
 * «Ring vanishes!» (0x0e1f, DS 0x995e — y el controller SALE), «Thou art empty-handed!»
 * (0x12c7, DS 0x997e), «Item: » inicial (0x12d0) y «Done» (0x1248).
 *
 * @param message rechazo ya resuelto por `equipItem`; vacío = rechazo SILENCIOSO del
 *   binario (munición 0x0c82, ítem no equipable 0x0db2-default) → sin envoltura.
 */
export function readyRejectLines(message: string): string[] {
  if (!message) return [];
  return ["", message, "", READY_UI.item];
}

/**
 * Prompts del getstring de CONVERSACIÓN (TALK.OVL) — verbatim de DATA.OVL, chunk
 * PHRASES_CONVERSATION ("Common talking responses", fileoff 0x9338, len 0x1cc;
 * StringList null-terminada, `fileoff = DS + 0x10`). El binario NO abre ventana: tras
 * el saludo del NPC imprime el prompt por `print_string` (kernel 0x1850) y lee la
 * keyword INLINE con getstring (máx 0xF chars, TALK.OVL 0xa33), ecoando lo tecleado
 * tras el ':' — igual que Yell. Índices del chunk (volcados byte a byte del DATA.OVL):
 *   · [0x0c] "Your interest?\n:"  → prompt de keyword tras cada respuesta.
 *   · [0x11] "You respond-\n:"    → prompt cuando el NPC hace una PREGUNTA (label con
 *     defaults) o pide el nombre (AskName; el original antepone "\n" en [0x15], mismo
 *     texto). El '\n:' es la 2ª línea: el ':' es el cursor del getstring, y la keyword
 *     tecleada continúa en esa MISMA fila de eco (":job"). El modelo de consola parte
 *     el prompt en su línea y el ':' arranca la fila de eco viva (echoSetLast).
 * El DialoguePanel DOM (piel dev) no imprimía estos prompts (mostraba un <input>); la
 * piel fiel/shader los usa para calcar la consola del marco EGA (censo-ui-flujos §2).
 */
export const TALK_UI = {
  interest: "Your interest?", // DATA.OVL PHRASES_CONVERSATION[0x0c] ("Your interest?\n:")
  respond: "You respond-", //   DATA.OVL PHRASES_CONVERSATION[0x11] ("You respond-\n:")
  cursor: ":", //               getstring cursor (2ª línea de los prompts anteriores)
} as const;

/**
 * Prompt del getstring de (Y)ell en TIERRA (CMDS.OVL 0x1418, rama no-fragata). El
 * dispatcher ecoa "Yell " (CMD_STRINGS.yell, DS 0xa286, con espacio final sin \n) y el
 * handler imprime `"what?\n:"` (DATA.OVL DS 0x4529, verificado byte a byte) ANTES de
 * leer la palabra con getstring (kernel 0x7b9c [= CS 0x3b1c → ULTIMA.EXE:0x3b1c
 * input_string], máx **0x1E = 30** — `1463: mov ax,0x1e`, buffer `[bp-0x20]`, llamada en
 * 0x1467).
 * 🔴 Esta línea decía «máx 0xF — el `push 0xf` está en CMDS 0x121a y 0x125a», y las DOS
 * mitades eran falsas a la vez, que es lo que la hacía creíble: 0x121a/0x125a NO son del
 * Yell sino de `shrine_restore` (CMDS 0x1202 — lee virtud DS 0x4450 + mantra×3 DS 0x4479,
 * compara contra la tabla 0x1f4e y escribe el tile 0x19 en 0x12ad), y su 0xF es la cota
 * DE ESE rito. El Yell vive en 0x1418 y su rama de tierra empieza en 0x1458. Una cita con
 * dirección concreta se lee como medición; ésta mandaba a OTRA RUTINA y de paso truncaba
 * el buffer del jugador a la mitad. Medido el 14-08 leyendo los dos cuerpos (ficha #268).
 * `:` es el cursor del getstring y la palabra tecleada continúa en esa MISMA fila de eco
 * (":VERAMOCOR"), como el Talk. Render fiel (testigo usuario, verdicts/yell-prompt):
 *   ►Yell what?
 *   :VERAMOCOR▓
 * El `what?` (w minúscula) y el `:` se emiten POR PIEZA (t() de cada uno; el compuesto
 * no es key del corpus, = patrón "Attack-Aim!"). Se reutiliza `TALK_UI.cursor` para el
 * `:` (mismo cursor del getstring). Ver `re/notes/death-resurrection-audit.md §S1`.
 */
export const YELL_UI = {
  what: "what?", // DATA.OVL DS 0x4529 ("what?\n:") — handler CMDS 0x1418 tras "Yell "
  max: 0x1e, //    getstring CMDS 0x1463 `mov ax,0x1e` → 30 chars (buffer [bp-0x20])
} as const;

/**
 * Prompts de TEXTO del santuario. Los dos ritos son rutinas DISTINTAS con literales
 * DISTINTOS, y el port usaba una sola cadena para ambos:
 *   · VISITA a santuario vivo — CAST2.OVL 0x0966 `shrine_visit`. Pregunta la virtud con
 *     MISCMSG.DAT 0x743 ("Upon what virtue dost thou meditate?\n\n:", buffer DS 0xb5b6
 *     cargado desde el offset de fichero 0x3ab; impresa en 0x09ba) y lee 12 caracteres
 *     (0x09c5 `mov ax,0xc`, buffer DS 0xbd08).
 *   · RESTAURAR santuario destruido — CMDS.OVL 0x1202 `shrine_restore`. Pregunta con
 *     DATA.OVL DS 0x4450 (fileoff 0x4460), que es el MISMO texto PARTIDO EN TRES FILAS
 *     y con salto inicial, y lee 15 (0x121a `mov ax,0xf`, buffer [bp-0x10]).
 * El "\nMantra:" es común a los dos (DS 0x958e en CAST2 0x0a0c · DS 0x4479 en CMDS
 * 0x124f — cadenas byte-idénticas), y en ambos se pide TRES veces en bucle.
 *
 * ⚠ El `:` de "Mantra:" NO va detrás de un salto de línea: lo tecleado se ecoa en LA
 * MISMA fila ("Mantra:AHM"), a diferencia del `\n\n:` de la pregunta de la virtud, donde
 * el `:` abre fila propia. Por eso viaja como PREFIJO del eco y no como línea impresa.
 */
export const SHRINE_UI = {
  virtueVisit: "Upon what virtue dost thou meditate?", //  MISCMSG.DAT 0x743
  virtueRestore: "\nUpon what virtue\ndost thou\nmeditate?", // DATA.OVL DS 0x4450
  mantra: "Mantra:", //                                    DATA.OVL DS 0x958e / 0x4479
  maxVisit: 0xc, //                                        CAST2 0x09c5 / 0x0a17
  maxRestore: 0xf, //                                      CMDS 0x121a / 0x125a
} as const;

/**
 * Prompt de texto del POZO de deseos (LOOKOBJ.OVL 0x0042). Tras el "Drop a coin?" y la
 * moneda gastada (0x0086 `dec [g_gold]`), 0x007f imprime DS 0x722c y 0x0092 lee 12
 * caracteres. ⚠ El literal NO lleva `:`: la fila de lectura va SIN cursor de prompt.
 */
export const WELL_UI = {
  wish: "\nThy wish?", // DATA.OVL DS 0x722c (fileoff 0x723c), + '\n' final = la fila del getstring
} as const;

/**
 * Línea de respuesta del INTERROGATORIO de Blackthorn (BLCKTHRN `check_mantra` 0x02ea):
 * tras cada pregunta del MISCMSG, 0x02f2 imprime DS 0x6f7a y 0x0301 lee 14 caracteres.
 * El gemelo del guardia del palacio (TALK 0x02c3, DS 0x9128) dice lo MISMO pero SIN el
 * `:` final, y por eso no comparte constante: ese reto llega entero por `e.text`
 * (GUARD_PASSWORD_CHALLENGE) desde `world/guard-encounters.ts`.
 */
export const BLACKTHORN_UI = {
  response: "\n\nYour response?", // DATA.OVL DS 0x6f7a (fileoff 0x6f8a), + "\n:" = fila del getstring
} as const;

/**
 * Cadenas de la UI del comando (U)se (CAST.OVL `cmd_use_item` @0x1792), verbatim de
 * DATA.OVL. El (U)se REUSA el mismo overlay de pergamino que Ready: llama a ZSTATS
 * `item_page_controller` @0x0f2e con **modo 'U' (0x55)** en vez de 'R' (0x52), lo que
 * cambia la tabla de ítems a la EXTENDIDA (`build_extended_item_table` @0x099a → tabla
 * 0xB9EE, 38 entradas) y hace que ENTER DEVUELVA el id elegido y CIERRE el picker (no
 * equipa in situ). Cadenas (resueltas por thunks PLINK86 CAST→ZSTATS, ver
 * overlay-load-layout.md):
 *   · `item`    "Item: " (CAST 0x17c8 imprime DS 0x48b1) — prompt antes de abrir el
 *     picker; al usar un ítem su rutina ecoa el NOMBRE en la misma fila ("Item: Spyglass").
 *   · `none`    "None!" (item_page_controller @0x1244, DS 0x9976) — ESC cierra el picker
 *     (mode 'U' imprime "None!\n"; el mode 'R' de Ready imprime "Done\n" 0x9970 ahí).
 *   · `noItems` "No usable items!" (CAST 0x17bd, DS 0x489f) — `find_next_owned` @0x05a4
 *     con charIdx=0xff devolvió 0xffff (no hay ningún usable con count≥1): sale sin picker.
 * (El nombre de comando "Use item\n\n" que ecoa el dispatcher es `CMD_STRINGS.use`, DS
 * 0xa24c.) ~~El header exacto del marco ("Items:" DS 0x48b8, dibujado por @0x8ed0) es
 * Clase C: la piel reusa el banner de Ready con el título "Use item".~~ **CERRADO**
 * (carril usepicker-fidelidad, careo side-by-side D2): ya no es Clase C — la cadena
 * está volcada de DATA.OVL y el banner es `USE_UI.banner` (abajo). Poner ahí el eco del
 * dispatcher era la divergencia que se veía en el fotograma t=48.
 */
/**
 * Prompt de OBJETIVO-PJ de los hechizos curativos — CAST2.OVL **0x009e** (carril
 * cadenas-presentacion, derivación instrucción a instrucción):
 *   00a4  print DS 0x94f4 `On who: `
 *   00ab  call kernel select (0x4cae) → idx o -1
 *   00b5  idx<0 → print DS 0x94fe `None!` · idx≥0 → print NOMBRE del registro
 *         ([idx·0x20+0x55a8]) — «On who: Min» en la MISMA fila
 *   00c8  newline condicional (columna ≠ 0)
 * Callers (thunk 0xffffc1aa = stub 0x812a → CAST2 0x9e, resuelto con
 * dispatch_table.py): CAST.OVL awaken 0x011c · cure 0x01b5 · heal 0x0200 ·
 * resurrect 0x08b3/0x10ec · scroll-resurrect 0x12e6 (sólo fuera de combate) ·
 * 0x138e — es el picker de TODOS los cast con objetivo-PJ, en combate y fuera.
 * El «Player: » (DS 0x96b4) es de Ready/Ztats (resolve_display_char) — NO de Cast.
 */
/**
 * Prompt de Vas Rel Por (ficha #341) — `CAST.OVL:0x0cff push 0x45e7; call 0x58d0`.
 * Verbatim de DATA.OVL (`fileoff = DS + 0x10` → `0x45f7`), CON su espacio final y SIN
 * `\n`: la tecla del `getkey` se ecoa detrás, en la misma fila.
 *
 * ★ Corroboración por vía ajena al trampolín (la misma que usó #319 para In Wis/An Grav):
 * la cadena ANTERIOR en DATA.OVL es `"Creature: "` (DS 0x45dc, el prompt de In Quas Xen
 * derivado en #340) y son CONTIGUAS — 0x45dc + 10 caracteres + NUL = 0x45e7 exacto. Los
 * dos hechizos del mismo bloque de CAST.OVL tienen sus prompts pegados en los datos.
 */
export const GATE_TRAVEL_PROMPT = "To phase: "; // DS 0x45e7 = file 0x45f7

export const CAST_TARGET_UI = {
  onWho: "On who: ", // DS 0x94f4
  none: "None!", //    DS 0x94fe ("None!" del cancel, mismo texto que READY_UI.none)
} as const;

export const USE_UI = {
  item: "Item: ", //          DS 0x48b1 (= texto de READY_UI.item, distinto offset)
  none: "None!", //           DS 0x9976 ("None!\n")
  noItems: "No usable items!", // DS 0x489f ("No usable items!\n")
  /**
   * BANNER del pergamino del picker (la cabecera ►Items:◄ del panel derecho), DS
   * 0x48b8. `cmd_use_item` (CAST.OVL 0x1792) imprime DOS cadenas seguidas y son
   * DISTINTAS: @0x17c8 empuja 0x48b1 `"Item: "` a la CONSOLA (0x58d0) y @0x17d9
   * empuja 0x48b8 `"Items:"` a la rutina de CABECERA del panel (0x8ed0), justo
   * antes de `draw_list_frame(8)` @0x17e0. Están pegadas en el DGROUP
   * (`…Item: \0Items:\0Carpet\n\n\0…`), que es como se confunden.
   * 🔴 El port ponía aquí "Use item" — el eco del DISPATCHER (CMD_STRINGS.use,
   * DS 0xa24c), que va a la consola y NO es el banner. Divergencia D2 del careo
   * side-by-side contra DOSBox (carril usepicker-fidelidad).
   */
  banner: "Items:", //        DS 0x48b8
} as const;

/**
 * Cadenas de la UI del comando (M)ix — `cmd_mix` (CMDS.OVL @0x1AD8), verbatim de
 * DATA.OVL (imagen del DGROUP, `fileoff = DS + 0x10`; volcadas byte a byte).
 * NO son el eco del dispatcher (ese es `CMD_STRINGS.mix` = "Mix Reagents\n\n",
 * DS 0xa1b4): son los prompts que imprime el propio handler.
 *
 * ORDEN DERIVADO del cuerpo de `cmd_mix` (re/disasm/CMDS.OVL.asm), que es la
 * CADENA DE PRESENTACIÓN completa del comando:
 *   1. @0x1ae0-0x1af0 suma los 8 contadores `[si+0x5850]`; si 0 → @0x1afc imprime
 *      `noReagents` (DS 0x8f98) y SALE (antes de preguntar nada).
 *   2. @0x1b06 `print_string(0x8fac)` = "For what spell?\n:" → DOS filas: la
 *      pregunta y, debajo, el `:` que es el CURSOR del getstring (mismo patrón que
 *      `TALK_UI.cursor`, de ahí que se reutilice ese `:`).
 *   3. @0x1b0d getstring rúnico (→ CAST2 0x00de; `re/notes/cast-input.md §7`).
 *      Retorno -1 (vacío/ESC) → @0x1b18 `none` (DS 0x8fbe) y sale.
 *   4. ★ @0x1b1e-0x1b5a PIE DE INSTRUCCIONES: `putchar(0x0a)` y luego los CUATRO
 *      glifos de flecha CP437 separados por comas, uno a uno con `putchar` (0x573a)
 *      — 0x1b `←`, 0x2c `,`, 0x1a `→`, 0x2c, 0x18 `↑`, 0x2c, 0x19 `↓` — y a
 *      continuación `print_string(0x8fc6)` = " to move,\nRETURN selects.\nType M to
 *      mix:". Se imprime ANTES de `call 0x18be` (@0x1b5d), o sea antes de abrir el
 *      panel "Reagents:" — va a la CONSOLA, no a la ventana del panel.
 *   5. @0x1b5d `mix_select_reagents` (0x18be) — panel `reagents` (DS 0x8f64).
 *   6. @0x1b6b `mix_prompt_quantity` (0x1a70) — `howMuch` (DS 0x8f72), y
 *      `insufficient` (DS 0x8f7e) con RE-PREGUNTA en bucle @0x1ac6.
 *   7. @0x1b78 selección vacía → `nothingToMix` (DS 0x9004); si no, @0x1b81
 *      `mixing` (DS 0x8ff0) y, si la máscara casa con la receta [bx+0x1cc0],
 *      @0x1bd6 `done` (DS 0x8ffc).
 *
 * ⚠ CORRECCIÓN de `re/notes/cast-input.md §6`: esa nota atribuyó 0x8fc6 al
 * «selector de CANTIDAD de Mix». Es del selector de REAGENTES: se imprime en
 * 0x1b1e-0x1b5a, ANTES del `call 0x18be`, mientras que la cantidad (0x1a70) no se
 * llama hasta 0x1b6b. Lo que §6 sí acertó (y era su objeto) es que NO es el
 * selector de HECHIZO. Ver `re/notes/mix-flow-acta.md §2`.
 */
export const MIX_UI = {
  forWhatSpell: "For what spell?", // DS 0x8fac, 1ª fila de "For what spell?\n:"
  cursor: ":", //                    DS 0x8fac, 2ª fila (= TALK_UI.cursor, el getstring)
  none: "None!", //                  DS 0x8fbe ("\nNone!\n"), vacío/ESC en el nombre
  noReagents: "No reagents owned!", // DS 0x8f98 ("…!\n"), precheck @0x1af8
  reagents: "Reagents:", //          DS 0x8f64, rótulo del panel (@0x1924)
  toMove: " to move,", //            DS 0x8fc6 fila 1 (tras los 4 glifos de flecha)
  returnSelects: "RETURN selects.", // DS 0x8fc6 fila 2
  typeMToMix: "Type M to mix:", //   DS 0x8fc6 fila 3
  howMuch: "How much? ", //          DS 0x8f72, prompt de cantidad (@0x1a7d)
  insufficient: "Insufficient reagents!", // DS 0x8f7e (@0x1aa7), re-pregunta
  nothingToMix: "Nothing to mix!", // DS 0x9004 (@0x1b78 → 0x1c0a)
  mixing: "Mixing...", //            DS 0x8ff0 (@0x1b81)
  done: "Done!", //                  DS 0x8ffc (@0x1bd6)
} as const;

/**
 * Los CUATRO glifos de flecha del pie de instrucciones de Mix, con sus comas — tal
 * como los emite `cmd_mix` uno a uno con `putchar` (CMDS.OVL @0x1b1e-0x1b53):
 * `0x1b ← , 0x2c , 0x1a → , 0x2c , 0x18 ↑ , 0x2c , 0x19 ↓`.
 *
 * Van como CÓDIGOS CP437 CRUDOS (0x1b/0x1a/0x18/0x19), NO como flechas
 * Unicode: la piel fiel indexa el atlas de IBM.CH por `charCodeAt` directo
 * (`skin/fiel/font.ts::drawGlyph`), donde las celdas 0x18-0x1b SON esas flechas.
 * Un `←` U+2190 apuntaría a la celda 8592 (inexistente). NO es texto traducible:
 * son glifos, y por eso quedan fuera de `MIX_UI` (que sí pasa por `t()`).
 */
export const MIX_ARROW_GLYPHS = "\u001b,\u001a,\u0018,\u0019";

/**
 * Palabras de dirección que ECOA `getdir` (kernel 0x35EC) tras leer la flecha:
 * verbatim de DATA.OVL (DS 0xa2a6/a2ae/a2bc/a2b6, "North\n"/"South\n"/"East\n"/
 * "West\n"). getdir es COMPARTIDO por los comandos direccionales (Open SJOG:0x139f,
 * Get 0x18ea, Search 0x097e, Jimmy 0x0d78, Push CMDS:0x1632, Klimb 0x1c46, Attack
 * MAINOUT:0x0732, Look LOOKOBJ:0x099c — todos resuelven a kernel 0x35EC): imprime
 * "Cmd-" (el dispatcher/overlay) y a continuación esta palabra en la MISMA fila
 * ("Open-North"), sin \n intermedio, antes del resultado. QA usuario (eco de dir).
 */
export const DIR_WORDS: Record<"north" | "south" | "east" | "west", string> = {
  north: "North", // DS 0xa2a6
  south: "South", // DS 0xa2ae
  east: "East", //  DS 0xa2bc
  west: "West", //  DS 0xa2b6
} as const;

/**
 * Ecos sueltos que escapaban a la guarda (QA usuario ES 2026-07-19): iban como
 * const suelto / ternario inline, invisibles para el extractor. Como MAPA entran
 * por DISPLAY_CONSTS. Citas: attack (MAINOUT 0x2a10 / TOWN 0x26fb); terreno lento
 * DS 0x29bf `Slow progress!\n` (MAINOUT 0x0457 `mov ax,0x29bf; push ax`) y DS 0x29cf
 * `Very slow!\n` (MAINOUT 0x0480), vía clase de terreno.
 * [CORREGIDO t#57: el par decía «0x29c3/0x29cf». El segundo era correcto; el primero
 *  no es inicio de nada en ninguna convención y el binario empuja 0x29bf. De paso
 *  queda dicho CUÁL es cuál.]
 * [CORREGIDO t#104: la coletilla de t#57 añadía «el port solo modela `Slow progress!`,
 *  no `Very slow!`», y era FALSO ya entonces — `movement.ts` emite los dos por clase de
 *  terreno (1 → slowProgress, 2 → verySlow) y `verySlow` está dos líneas más abajo en
 *  este mismo mapa. Frase retirada.]
 */
export const MISC_ECHO_STRINGS = {
  attackNothing: "Nothing to attack!\n",
  // Ataque player-initiated en pueblo (TOWN 0x09e6, carril gargolas-residuales):
  // DS 0x270f (0x0b46, sólo Blackthorn 0x78 indefenso) y DS 0x2718 (0x0b4c, golpe
  // a un actor sobre Stocks/Manacles/cama — ver Game.attack). Byte-exactas de
  // DATA.OVL (fileoff = DS+0x10).
  attackMissed: "Missed!\n",
  attackMurdered: "Murdered!\n",
  slowProgress: "Slow progress!",
  verySlow: "Very slow!",
  // Fugas i18n del soak de mazmorras 2026-07-20 (compuestos que el choke t() no
  // casaba): fallo de Ignite (CMDS 0x0D98) + anuncios de trampa de cofre
  // (TRAP_NAMES+'!', kernel 0x2FD0 — el call-site compone `${name}!` dinámico,
  // invisible al extractor; entran aquí como literales del corpus).
  noneOwned: "None owned!",
  trapAcid: "ACID!",
  trapPoison: "POISON!",
  trapBomb: "BOMB!",
  trapGas: "GAS!",
} as const;

/** Mensaje "no hay nada que atacar" del overlay de Attack (alias legado del mapa). */
export const ATTACK_NOTHING = MISC_ECHO_STRINGS.attackNothing;

/**
 * Cadenas del overlay de COMBATE (COMBAT.OVL / COMSUBS.OVL), verbatim de DATA.OVL
 * (verificadas por byte-offset con `grep -aob`). El eco del comando A en combate es
 * `CMD_STRINGS.attack` ("Attack-") + `COMBAT_STRINGS.aim` ("Aim! ") = "Attack-Aim! ",
 * como muestra el vídeo-O (">Attack-Aim!"); la consola antepone el bullet ►/>.
 * ("Leave!" al salir de la arena, fileoff 36534, se imprime como literal en
 * game.ts::endCombat, junto a VICTORY!/BATTLE IS LOST!.)
 */
export const COMBAT_STRINGS = {
  aim: "Aim! ", // DATA.OVL fileoff 39566 (cursor de Aim, COMSUBS:0x0504)
  // (N)úmero en combate: SET ACTIVE PLAYER (COMBAT:0x063E 0x09ec/0x09fe). El
  // prefijo es la cadena DS 0x6e66 "Set active plr:\n" (minúscula, distinta de la
  // de overworld "Set Active Plr:"), seguida del NOMBRE / "None!" / "Invalid!" que
  // añade `Game.combatActivePlayer`. QA usuario (teclas 1-6 en combate).
  setActive: "Set active plr:\n", // DS 0x6e66 (verbatim de DATA.OVL)
  /**
   * (Q)uit & Save EN LA ARENA — RECHAZO, no guardado (ficha #154 F2, derivación propia).
   *
   * En combate la Q **sí tiene entrada en la tabla de saltos** (COMBAT.OVL:0x0af3
   * `jmp word ptr cs:[bx-0x5278]`, tabla de 7 entradas K..Q en fileoff 0x0af8; Q=0x51 es
   * el índice 6, DENTRO de rango) y esa entrada apunta a un rechazo dedicado:
   * `COMBAT.OVL:0x0a78 mov ax,0x6ec4` (DS = "Quit") → `0x0a4d` empuja el código **2** →
   * `SJOG.OVL:0x1f26 combat_reject(nombre, código)`, cuya rama del 2 (`0x1f6a`) imprime
   * DS 0x8f1a = "-Not here", y luego `0x1f4b push 0xa; call putchar` = el `\n`.
   * Retorna 1 ⇒ **re-prompt del mismo combatiente, sin gastar turno** (0x0974 → 0x07ba →
   * 0xb56 → 0x6f1).
   *
   * 🔴 NO ES EL DEFAULT «What?» DE LA ARENA, aunque lo parezca: ése es otro sitio y otra
   * cadena (`COMBAT.OVL:0x0ab7 mov ax,0x6ee6` = DS 0x6ee6 "What?\n"), y la Q no pasa por
   * ahí nunca. Confundirlos daría el texto equivocado con la misma pinta de derivado.
   *
   * 🔴 Y OJO CON EL GEMELO: este "Quit" es **DS 0x6ec4**, copia PROPIA de COMBAT.OVL — no
   * el `CMD_STRINGS.quit` de arriba, que es DS 0xa1ea "Quit:" (con dos puntos) y pertenece
   * al despachador del KERNEL. La arena no pasa por el kernel y tiene sus propias cadenas;
   * citar 0xa1ea desde aquí sería una cita falsa que cuadra a la vista.
   */
  quitReject: "Quit-Not here\n", // DS 0x6ec4 + DS 0x8f1a + putchar('\n') @SJOG 0x1f4b
} as const;

/**
 * Rechazo por vehículo/terreno del Attack, ANTES del getdir (MAINOUT 0x724 / TOWN
 * 0xa14). Ambos overlays imprimen el mismo string: MAINOUT DS 0x2a06 / TOWN DS
 * 0x26e8 = "On foot!\n", verificados byte a byte. Sólo salta sobre AGUA (tile de la
 * casilla de la party <4): overworld → skiff (0x28-0x2b) o alfombra (0x14/0x15);
 * pueblo → cualquier transporte ≠ a pie (≠0x1c).
 */
export const ATTACK_ON_FOOT = "On foot!\n";

/**
 * ROMPER EL ESPEJO con (A)ttack (#217) — TOWN.OVL 0x0a62 `mov ax,0x26f2` +
 * print_string. EXTRAÍDO DEL POOL Y CAREADO BYTE A BYTE, no transcrito de oído:
 * DS 0x26f2 → DATA.OVL fileoff 0x2702 (delta DS→fichero = +0x10) y ahí viven
 * `42 72 6f 6b 65 6e 21 0a 00` = "Broken!\n". El delta se acreditó con TRES
 * controles del corpus que caen exactos sobre su cadena ya publicada: DS 0x2ca8
 * "Ouch!\n", DS 0x2caf "Electric field!\n" y DS 0x2d53 "Sleep spell!\n".
 * Vecinas del mismo comando en el pool: DS 0x26e0 "Attack-" y DS 0x26e8 "On foot!\n".
 */
export const MIRROR_BROKEN_MSG = "Broken!\n";

/**
 * Cadenas de la UI de las TIENDAS por CONSOLA (piel fiel/shader). El binario NUNCA
 * abre ventana: el mercader es una CONVERSACIÓN dentro del marco EGA — se entra por
 * (T)alk (ret 2 del dispatcher, SHOPPES*.OVL) y el mercader saluda + ofrece un menú
 * POR TECLA impreso con print_string (0x1850); el ShopPanel DOM es QoL sólo-dev
 * (censo-ui-flujos §3). Igual que TALK_UI/USE_UI, este objeto se referencia por
 * ACCESO A PROPIEDAD (`SHOP_UI.x`) desde el shell, así que el extractor del manifiesto
 * no lo alcanza (queda citado aquí, patrón de TALK_UI).
 *
 * Fuentes (cita): DS = DATA.OVL (fileoff = DS+0x10, dump del original) · idx =
 * game/assets/shoppe.json (pool de flavor de SHOPPES, extraído). El flujo por TECLA
 * y las teclas exactas están en re/notes/shops.md §1-7. El MENÚ (verbo) es fiel; el
 * layout fino (retrato en el viewport + selección lujosa de item con las líneas de
 * pitch de shoppe.json, saludo/despedida ALEATORIOS 1-de-4) es Clase C → requiere
 * testigo DOSBox (documentado en el censo). Aquí se calca el MECANISMO consola-por-
 * tecla; el pitch de cada ítem se resume a "<Nombre> — <precio> gp".
 */
export const SHOP_UI = {
  // Prompt de menú por tipo de mercader (verbo + teclas). Citas del asm/DS en
  // re/notes/shops.md; los offsets DS los pinó el censo de flujos.
  blacksmith: "Wouldst thou Buy or Sell?", //   DS 0x7F48 (Blacksmith, B/S; rand 1-de-2 con 0x7F70)
  guild: "Buy Keys, Gems, or Torches?", //       DS 0x78D4/78E4/78F4 (a/b/c) + 0x7906 "Thy concern?"
  // TICKET-002 corpus yt: forma FIEL completa (comillas EN el literal, DS 0x80aa); el
  // acortado previo "Cure, Heal, or Resurrect?" era divergencia sin ruling.
  // [CORREGIDO t#57: decía 0x80bb y 0x80eb, que son el FILEOFF de cada cadena MÁS UNO
  //  (parten `"|We have` y `s|ays $.`) y no aparecen en ningún .asm. El binario empuja
  //  las dos seguidas: SHOPPES 0x1542 `mov ax,0x80aa; push ax` y 0x1549 `mov ax,0x80da`.
  //  Este mismo repo ya las citaba bien en shop-console.ts:475/476 — la contradicción
  //  vivía a 300 líneas de distancia.]
  healer: "\"We have powers to Cure, Heal, or Resurrect.\"", // DS 0x80aa (SHOPPES 0x1542)
  healerSays: "says {}.", //                      DS 0x80da `says $.` — atribución ({}=keeperName)
  inn: "Rest, Leave, or Pick up a companion?", // DS 0x5066/0x508E (R/L/P)
  // TICKET-004 + carril saludos-shoppe: el Y/N del saludo del MagicSeller (SHOPPES
  // 0x75e). Tras el saludo (que acaba en pregunta), 'Y' imprime la string COMPLETA
  // DS 0x7a2c `Yes\n\n"Fine! We sell:\n\n` (eco + framing en UNA string del binario;
  // la rodaja post-eco de T-004a queda superada) y entra a la lista 0x666.
  reagentsSell: 'Yes\n\n"Fine! We sell:\n\n', // DS 0x7a2c (comilla EN el literal)
  // 'N'/Space en el Y/N: eco `No` (DS 0x7a44) y despedida (SHOPPES 0x7a2→0x202).
  reagentNo: "No", //                            DS 0x7a44
  reagentInterest: '\nThy interest?" ', //       DATA.OVL 0x7a2a (prompt de letra TRAS la lista, SHOPPES 0x6da)
  horse: "A fine steed! Art thou interested?", // HorseSeller pitch + Y/N (shoppe.json 92-95/104)
  ship: "Frigate or Skiff?", //                  shoppe.json 119 "We sell ocean-going Frigates and small, light Skiffs."
  // Sub-prompts de selección de item / miembro (lista por letra en la consola).
  whom: "For whom?", //       elegir miembro (curandero / posada)
  // ── FLUJO BUY DEL HERRERO (carril buy-herrero; derivación completa en
  // shoppe-greetings.ts § FLUJO BUY — dispatcher 0x12b2 rama 'B' + 0x0b30 + 0x09ac).
  // Piezas fijas alrededor de los pools rand(0,3) y del pitch por-ítem. Las rodajas
  // sin letras (`\n\n` 0x7c44/0x7b62, `...` 0x7c48) van como literales técnicos en el
  // conductor; `" ` (0x7c4c/0x7b66) reusa sellQuoteClose y `\n\n"` (0x7b5e) reusa
  // farewellQuoteOpen (mismos bytes).
  buyEcho: 'Buy\n\n"', //          DS 0x8046 — eco de la tecla B + comilla de apertura (0x1306)
  buyNo: "No\n\n", //              DS 0x7b6a — eco de 'N' en el pitch (0x0a44)
  buyYes: "Yes\n", //              DS 0x7b70 — eco de 'Y' (0x0a57)
  buyFull: '\n"Thou canst not carry any more!"\n', // DS 0x7b76 — qty==99 (0x0a5e)
  buyFullSays: "says $.\n\n", //   DS 0x7b9a — atribución del aviso (call 0x26 expande $; 0x0a70)
  buyBrokeOpen: '\n"', //          DS 0x7ba4 — comilla del insulto sin oro (0x0a81)
  buyBrokeYells: '"\nyells $.\n', // DS 0x7ba8 — cierre + atribución del insulto (0x0aa1)
  buySold: "\nSold!\n", //         DS 0x7bb4 — pago hecho (0x0ad9)
  buyAnythingElse: '"Anything else,\n', // DS 0x7bbc — epílogo del pitch (0x0afa)
  buyThen: "then?", //             DS 0x7bdc — cola sin compra en la sesión (0x0b1e)
  buySir: "sir?", //               DS 0x7bd6 — cola con compra, negociador varón (0x0b18)
  buyMilady: "milady?", //         DS 0x7bce — cola con compra, hembra ([·+0x55b1]==0x0c, 0x0b0c)
  // ── CHARLA DEL SELL-FLOW DEL HERRERO (carril sell-chatter; derivación completa en
  // shoppe-greetings.ts, flujo SHOPPES 0x0f64) ─────────────────────────────────────
  // Eco de la tecla 'S' + apertura de comilla (dispatcher 0x1352). Sustituye al
  // acortamiento [C] previo "Sell which?" — el prompt fiel es 1-de-4 (BLACKSMITH_
  // SELL_PROMPTS, tabla DS 0x3d2e) entre este eco y sellQuoteClose.
  sellEcho: 'Sell\n\n"', //          DS 0x804e
  sellQuoteClose: '" ', //           DS 0x7ef0 (prompt de apertura) / 0x7f0a (What else…)
  sellByeClose: '"\n', //            DS 0x7f12 (cierra el Good-bye; el `says $.` va aparte)
  // ── OFERTA + Deal? Y/N de sell_one_item (SHOPPES 0x0e76; carril sell-offers,
  // derivación completa en shoppe-greetings.ts § BLACKSMITH_SELL_OFFER_INDEX). La
  // comilla de apertura de la oferta (DS 0x7d64 `\n\n"`) reusa farewellQuoteOpen
  // (mismos bytes). Estas cuatro son las piezas fijas alrededor de la plantilla.
  sellDealPrompt: '\n\nDeal?" ', //  DS 0x7d68 — prompt Y/N tras la oferta (0x0f05)
  sellDealYes: 'Yes\n\n"Done!"\nsays $.', // DS 0x7d76 — eco de 'Y' ($ = tendero, call 0x26 @0x0f2a)
  // Eco de 'N' (DS 0x7d72, print crudo 0x75c0 @0x0f20): mismos bytes que reagentNo — reusado.
  // Munición usada (items 0x1b/0x1d, gate 0x0e7d): growls y la sesión CIERRA con el
  // epílogo suprimido (ret 1 → [bp-0x10]≠0 @0x126c; la despedida general ya iba en
  // silencio por blacksmithFlow==='sell').
  sellAmmo: '\n\n"We don\'t deal in used ammunition!"\ngrowls $.\n', // DS 0x7d32
  // PRECIO BASE 0 (gate 0x0ea2 `cmp word ptr [si + 0x3a82], 0` → 0x0f54): el herrero
  // rechaza el ítem y devuelve **0** (0x0f5b `sub ax, ax`), o sea la sesión SIGUE y
  // se re-lista — al revés que la munición, que devuelve 1 y CIERRA. La guarda va
  // ANTES del precio (0x0eac) y del rand de la oferta (0x0eec `rand(0,7)`), así que
  // este camino no consume tirada ni llega a imprimir `Deal?`. La comilla de apertura
  // (DS 0x7d64 `\n\n"`) la imprime 0x0e96 ANTES de la guarda: va delante de la frase.
  // Son 7 los ítems con base 0 en la tabla real (fileoff 0x3a92, 48 words): 0x08, 0x0f,
  // 0x23, 0x27, 0x28, 0x29 y 0x2f. `$` = tendero (expansor call 0x26 @0x0f58).
  sellCannotBuy: 'That, I cannot buy from thee."\nsays $.', // DS 0x7d8c
  // Sin nada que vender (0xc58==0 @0x0f6c, ANTES del rand): cierra la comilla del eco
  // y la sesión termina. `$` = tendero (expansor call 0x26).
  sellNothing: 'Thou hast nothing to sell!"\ngrowls $.\n', // DS 0x7f20
  // Despedida al salir (Space) — emisor SHOPPES 0x0202 (carril i18n-restos): `\n\n"` +
  // registro shoppe.json[tabla 0x3b6a/0x3baa][rand(0,3)] + `says $.` (DS 0x785c; misma
  // string que healerSays). La fija "Come again!" queda SOLO como degradación sin asset
  // (patrón legacyHeader del saludo). Derivación en shoppe-greetings.ts.
  farewell: "Come again!", // shoppe.json[6] — fallback sin pool/nombres
  farewellQuoteOpen: "\n\n\"", // DS 0x7854 / 0x7858 (ambas = `\n\n"`)
  // ── SALUDO del HERRERO (carril saludos-shoppe) ──────────────────────────────
  // El Blacksmith NO usa el emisor de tabla 0x01b6 (su fila en DS 0x3b2a es 0x0000×4):
  // su entrada propia (SHOPPES 0x12b2) imprime DS 0x8018 con el expansor de $/#/@,
  // luego DS 0x8036, una de DOS preguntas por rand(0,1) (tabla DS 0x3d46 → 0x7f48 /
  // 0x7f70) y cierra con DS 0x8042. Derivación: re/notes/shoppe-greetings-witness.md
  // + disasm SHOPPES.OVL 0x12b2-0x12e6 (verificado en este carril contra DATA.OVL).
  blacksmithWelcome: '"Good @, and welcome to #!"', // DS 0x8018 (`@`/`#` expandidos)
  blacksmithSays: '\n$ says,\n"', //                   DS 0x8036 (`$` = tendero)
  // Las DOS preguntas llevan el cierre `" ` (DS 0x8042) DENTRO del literal (regla
  // i18n comillas-dentro-del-literal: el value ES cierra con `» `; una key sin
  // letras no puede entrar al corpus).
  blacksmithAsk1: 'Hail, friend! Wouldst thou Buy or Sell?" ', //                    DS 0x7f48 + 0x8042
  blacksmithAsk2: 'Greetings, traveller! Wish ye to Buy, or hast thou wares to Sell?" ', // DS 0x7f70 + 0x8042
  // Comilla de APERTURA del saludo (putchar 0x22, SHOPPES 0x01b7). SIN t(): una key
  // sin letras no es corpus-legal — en ES la línea abre con `"` y cierra con `»`
  // (misma costura ya aceptada por el corpus: los values de plantilla terminan en »).
  greetQuoteOpen: '"',
  // ── CADENA DE COMPRA DEL MAGIC SELLER (carril cadenas-presentacion; derivación
  // completa en shoppe-greetings.ts § MAGIC_SELLER_PITCH_INDEX — SHOPPES 0x666+0x502).
  // La comilla de apertura del pitch (DS 0x7952 `\n\n"`) reusa farewellQuoteOpen y el
  // eco de 'Y' (DS 0x7982 `Yes\n`) reusa buyYes (mismos bytes).
  reagentNeed: ' Is this thy need?" ', //   DS 0x7956 — prompt Y/N tras el pitch (0x5cf)
  reagentDealNo: 'No\n\n"What else?\n\n', // DS 0x7970 — eco de 'N' (0x5f5)
  reagentThanks: '\n"I thank thee!"\nsays $.\n', // DS 0x7988 — pago hecho (expansor $, 0x63d)
  reagentAnythingElse: '"Anything else?\n\n', // DS 0x79a2 — tras el thanks (0x644)
  reagentFull: '\n\n"Thou canst not carry any more!"\n\n', // DS 0x792c — qty==99 (0x550) + getkey de pausa
  // ── CADENA DEL GREMIO (derivación en shoppe-greetings.ts § GUILD_PITCH_INDEX —
  // SHOPPES 0x4a2+0x3f6+0x2ba). `No` del gate (DS 0x7928) reusa reagentNo; `Yes\n`
  // del Interested (DS 0x789a) reusa buyYes; `\n\n"` (DS 0x786e) reusa farewellQuoteOpen.
  guildYes: 'Yes\n\n"We sell:\n\n', //      DS 0x7916 — eco de 'Y' del gate (0x4cd)
  guildRowKeys: "a.........Keys\n", //      DS 0x78d4 — fila fija de la lista (0x40d)
  guildRowGems: "b.........Gems\n", //      DS 0x78e4 (0x414)
  guildRowTorches: "c......Torches\n\n", // DS 0x78f4 (0x41b)
  guildConcern: 'Thy concern?" ', //        DS 0x7906 — prompt de letra (0x422)
  guildInterested: '\n\nInterested?" ', //  DS 0x7872 — Y/N tras el pitch (0x32c)
  guildDealNo: 'No\n\n"What else, then?\n\n', // DS 0x7882 — eco de 'N' (0x347)
  guildSold: '\n"Sold!"\nsays $.\n\n"What else, \n', // DS 0x78a0 — pago (expansor $, 0x3a6)
  guildMlady: "m'lady", //                  DS 0x78c0 — negociador hembra (0x3b2)
  guildMlord: "m'lord", //                  DS 0x78c8 — negociador varón (0x3cc)
  guildQtail: "?\n\n", //                   DS 0x78d0 — cola del What else (0x3d3)
  // ── CADENA DEL ESTABLO (derivación en shoppe-greetings.ts § HORSE_PITCH_INDEX —
  // SHOPPES 0x7be). `No` (DS 0x7ab2/0x7a74) reusa reagentNo; el `\n\nDeal?" `
  // (DS 0x7a6a) reusa sellDealPrompt (mismos bytes que 0x7d68).
  stablesClosed: "The stables are closed.\n", // DS 0x7a48 — sin hueco de establo (0x83e), SIN saludo ni despedida
  horseYesOpen: 'Yes\n\n"', //              DS 0x7a62 — eco de 'Y' del gate (0x8f1)
  horseYesExcl: "Yes!", //                  DS 0x7a78 — eco de 'Y' del Deal (0x924)
  horseBroke: '\n\n"Thou couldst not afford to feed it!"\nyells $.\n', // DS 0x7a7e+0x7a9e (0x934+0x93b, expansor $)
  // ── CADENA DEL CURANDERO (SHOPPES 0x14f8 entrada + 0x137c picker + 0x146a pago;
  // derivación instrucción a instrucción en este carril). El saludo del pool (165-168)
  // TERMINA en pregunta → gate Y/N (0x1510). `\n\n"` (0x810e/0x8150/0x8188) reusa
  // farewellQuoteOpen.
  healerGateYes: "Yes\n\n", //              DS 0x80a4 — eco de 'Y' del gate (0x1526)
  healerSaysNature: 'says $.\n\n"What is the nature of thy need?" ', // DS 0x80da (expansor $, 0x1549)
  healerCuring: "Curing", //                DS 0x8106 — eco de 'C' (0x1596)
  healerHealing: "Healing", //              DS 0x8148 — eco de 'H' (0x1622)
  healerResurrectEcho: "Resurrect", //      DS 0x817e — eco de 'R' (0x169a)
  healerNothing: "Nothing", //              DS 0x81c0 — Space/CR en el nature-of-need (0x170e)
  healerWho: '\n\n"Who needs my aid?" ', // DS 0x805a — picker con party>1 (0x1390)
  healerNoOne: "No one", //                 DS 0x8072 — cancel del picker (0x13a2)
  healerNoNeed: '\n\n"Thou hast no need of this art!"\nsays $.', // DS 0x3d5a (expansor $, 0x15d4)
  healerLight: 'Receive now the Light!"', //DS 0x8112/0x8154 — cura/heal GRATIS en location 5 (0x15ec/0x165c)
  healerCurePitch: "I can cure thy poisoned body ", // DS 0x812a (0x15f6)
  healerHealPitch: "I can heal thee ", //    DS 0x816c (0x1666)
  healerResPitch: "I can raise this unfortunate person from the dead ", // DS 0x818c+0x81b6 (0x16c6+0x16cd)
  healerPay: 'for % gold.\n\nWilt thou\npay?" ', // DS 0x807a — %=precio (expansor, 0x1471)
  healerPayYes: "Yes", //                   DS 0x8098 — eco de 'Y' del pay (0x1482)
  healerAnyOther: '\n\n"Is there any other way in which I may\naid thee?" ', // DS 0x81c8+0x81f2 (0x15b4+0x15bb)
  // ── GATES Y/N DE SALUDO restantes (C4): taberna (SHOPPES2 0x66c), astillero
  // (SHOPPES2 0xabc) y posada (SHOPPES3 0x8b4) — sus 4 saludos del pool terminan en
  // pregunta; 'N'/Space ecoa `No` y va a la despedida 0x202 (pool de despecho:
  // «Hmph. Well, later then...» E09). Los `No` (0x9f8e/0xa00c/0x505f) reusan reagentNo.
  tavernYesOpen: 'Yes\n\n"', //             DS 0x9f92 (gate 0x6aa) = 0x9fba (re-visita 0x7b8) — eco 'Y' + comilla
  // ── Cadena de RACIONES + epílogo de la taberna (F2-T10 espejo; SHOPPES2 0x380/0x767) ──
  // Pago de una COPA de vino (SHOPPES2 0x0368): tras `sub [g_gold]` (0x035d), la merma
  // (0x9dfa) y el `inc [g_cups_served]` (0x0364), el flujo empuja DS 0x9c40 al impresor
  // 0x3670 — ÚNICO emisor de esta cadena (los otros 3 call-sites citados históricamente
  // —ENDGAME 0x0783, SHOPPES 0x140e/0x1422— empujan 0x9c40 como NÚMERO 40000 al barrido
  // de sonido 0x7f02, no como puntero; carril enjoy-146). Antes aquí había una frase
  // FABRICADA («Here thou art!», cero ocurrencias en DATA.OVL) — task #147.
  wineEnjoy: '\nEnjoy!"', //                DS 0x9c40 — copa servida (SHOPPES2 0x0368)
  // ── AVISO DE BORRACHERA (#325) — SHOPPES2 0x020a-0x0260, la CUARTA emisión ──────
  // Va en la opción de BEBIDA y ANTES del discriminante `'W'` de 0x027c, así que
  // alcanza a la carta de vinos Y a la ronda de la casa. Dispara con el contador
  // EXACTAMENTE en 3 (`cmp word ptr [g_cups_served], 3` / `jne`), no con «3 o más».
  // Composición, en orden:
  //   0x0211  DS 0x9b22  '\n\n"I beg thy\npardon, '
  //   0x0218  call 0x00ac                    ← sir / milady
  //   0x021b  DS 0x9b38  ',"\nsays '
  //   0x0222  push [g_unk_aafe]              ← nombre del tendero
  //   0x0229  DS 0x9b42  '.\n"But haven\'t\nye had enough\nto drink?" '
  //   0x0230  getkey ─┬─ 'Y' → DS 0x9b6c 'Yes\n\n' y RET 0 sin servir ni cobrar
  //                   ├─ 'N' → DS 0x9b72 'No!' + timer 25 + karma −1, y CONTINÚA
  //                   └─ otra tecla → 0x0230, vuelve a leer
  // ★ La rama 'Y' devuelve 0, o sea CUENTA COMO SERVICIO (desbloquea el chat y elige
  //   la despedida «con compra») sin haber servido nada — la asimetría del §41 de
  //   asm-shoppes-acta, hermana del §30.2 del curandero.
  drunkPardon: '\n\n"I beg thy\npardon, ', //  DS 0x9b22 (0x0211)
  drunkSays: ',"\nsays ', //                   DS 0x9b38 (0x021b)
  drunkEnough: '.\n"But haven\'t\nye had enough\nto drink?" ', // DS 0x9b42 (0x0229)
  drunkYes: "Yes\n\n", //                      DS 0x9b6c (0x023a) — eco de 'Y'
  drunkNo: "No!", //                           DS 0x9b72 (0x024c) — eco de 'N'
  // ── CARTA DE VINOS (#325) — SHOPPES2 0x0286-0x036f, cuerpo leído entero ──────────
  // Sólo se llega aquí con la letra del subtipo == 'W' (0x027c, #21). La cabecera es
  // TRES emisiones seguidas, con el trato por género EN MEDIO — el mismo `call 0x00ac`
  // que ya usa el anuncio de precio (`tavernSir`/`tavernMilady`):
  //   0x0286  DS 0x9b76  '"Our wine list,\n'
  //   0x028d  call 0x00ac                      ← sir / milady
  //   0x0290  DS 0x9b88  '.\n\n'
  //   0x0294…0x02c5  las SEIS líneas de la carta (WINE_MENU_LINES, shop-tables.ts)
  //   0x02c1  DS 0x9bfa  'Thy choice?" '
  // Verificado byte a byte contra DATA.OVL (convención del repo: fileoff = DS + 0x10).
  wineListOpen: '"Our wine list,\n', //     DS 0x9b76 (0x0286)
  wineListAfterName: ".\n\n", //            DS 0x9b88 (0x0290) — puntuación tras el trato
  wineThyChoice: 'Thy choice?" ', //        DS 0x9bfa (0x02c1)
  // Eco de la elección (0x0302-0x0319): putchar de la letra TAL COMO LA LEYÓ el getkey
  // (mayúscula: el gate de 0x02f6/0x02fc es `'A'`..`'F'`), luego esta cadena, luego el
  // trato por género otra vez (`call 0x00ac` @0x0312) y un putchar('.') (0x0315).
  wineFineChoice: '\n\n"Ah, a fine\nchoice, ', // DS 0x9c08 (0x030b)
  // Sin oro (0x0330-0x034f, tras `cmp [bx+0x4c48], ax` / `jle`): esta cadena ABRE con la
  // comilla que cierra el «Ah, a fine choice, sir.» anterior, y termina en `yells ` para
  // que le siga el nombre del tendero (DS 0xAAFE) + putchar('.') + putchar('\n').
  // Devuelve 1 ⇒ te ECHAN sin despedida, igual que la ronda (0x00dc).
  wineCantPay: '"\n\n"CAN\'T PAY?\nBeat it!"\nyells ', // DS 0x9c20 (0x0330)
  // ── ANUNCIO DE PRECIO de la ronda (SHOPPES2 0x00dc-0x0111) — ficha #17 ──────────
  // Va ANTES del gate de oro (0x0114 `cmp [g_gold]`) ⇒ el tabernero canta el precio
  // AUNQUE no puedas pagarlo, y sólo después te echa. Composición EXACTA, en orden:
  //   0x00dc  putchar('"')                     ← ABRE la comilla que cierra `roundEnjoy`
  //   0x00e3  DS 0x9ace  'That will be '
  //   0x00ea  print_number([g_unk_b118] = precio TOTAL, width 1, pad ' ')  (call 0x385e)
  //   0x00f9  DS 0x9adc  ' gold for the '
  //   0x0100  call 0x006a                      ← la PALABRA del nº de vivos (ver
  //                                              `tavernAliveWord` en shops.ts)
  //   0x0103  DS 0x9aec  ' of ye,\n'
  //   0x010a  call 0x00ac                      ← trato por género
  //   0x010d  putchar('.')
  // La comilla de 0x00dc explica por qué `roundEnjoy` termina en `"` sin abrirla: son
  // los dos extremos de UNA cita. Sin este anuncio el clon imprimía un cierre huérfano.
  // La comilla de 0x00dc NO se funde aquí: es un `putchar` aparte, y el conductor la
  // pide con `quoteOpen()` (la primitiva tipográfica del idioma). Fundirla daría un
  // literal del port con `"` que el string del binario no tiene — el género
  // «comilla-literal» de #142, que su trinquete caza. Aquí va DS 0x9ace VERBATIM.
  tavernThatWillBe: "That will be ", //     DS 0x9ace (0x00e3)
  tavernGoldForThe: " gold for the ", //    DS 0x9adc (0x00f9)
  tavernOfYe: " of ye,\n", //               DS 0x9aec (0x0103)
  // Trato por género — SHOPPES2 0x00ac, `bx = 0<<5` ⇒ SIEMPRE la ranura 0 (el Avatar).
  // ⚠ La polaridad es `== 0x0b → sir`, `!= 0x0b → milady`: CUALQUIER byte que no sea
  // 0x0b cae en «milady», no sólo el 0x0c femenino. Se transcribe la de ESTE sitio; el
  // astillero comprueba `== 0x0c` (otra polaridad, ficha #11) — no se unifican.
  tavernSir: "sir", //                      DS 0x9ac2 (0x00ca) — género 0x0b
  tavernMilady: "milady", //                DS 0x9ac6 (0x00d0) — cualquier otro
  tavernPriceClose: ".", //                 putchar 0x2e (0x010d)
  // RONDA DE COMIDA servida (SHOPPES2 0x01c8, impresor 0x3670, tras el `inc` del
  // contador de servicios en 0x01c4). Es una entrada DISTINTA de la del vino aunque
  // la frase se parezca: DS 0x9b16 cierra con `\n\n` y DS 0x9c40 no. Dos ocurrencias
  // separadas en DATA.OVL, cada una con su emisor.
  roundEnjoy: '\nEnjoy!"\n\n', //           DS 0x9b16 — ronda servida (SHOPPES2 0x01c8)
  tavernHowMany: '\n\nHow many wouldst\nthou like?" ', // DS 0x9c4a — tras el pitch (0x40a); cantidad por getstring de 2 dígitos (0x59be)
  tavernHrumph: '\n\n"Hrumph."', //         DS 0x9c6a — cantidad 0 (0x422; ret 2 = NO desbloquea el chat)
  tavernNoNeed: '"Thou hast\nneither gold nor\nneed! Out!"\n', // DS 0x9c7a — sin oro y comida>=3 (0x4b2)
  tavernYells: "yells ", //                 DS 0x9ca4 — atribución (+ nombre [0xaafe] + '.' DS 0x9cac)
  tavernAffordOnly: '"Thou canst\nafford only ', // DS 0x9cb0 — compra PARCIAL (0x4d6; + N + cierre)
  tavernAffordClose: '!"\n\n', //           DS 0x9cca — cierre del afford-only (0x4e9)
  tavernAnythingElse: '"Anything else\nfor thee?" ', // DS 0x9f9a — epílogo tras servir (0x79a); Y = menú re-visita / N = despedida
  // ── RUMOR DE TABERNA (#320; SHOPPES2 0x0508, cuerpo entero 0x0508-0x0663). Los
  // saltos duros son los de DATA.OVL. La secuencia completa está en
  // re/notes/rumor-taberna-320.md §2; aquí sólo las piezas FIJAS (los registros
  // variables —precio, formulación, sin-oro— salen de shoppe.json).
  rumorAskOpen: '\n\n"', //                 DS 0x9efc — tras el eco de la letra de la opción (0x0520)
  rumorAsk: "Of what wouldst\nthou hear my\nlore, ", // DS 0x9f00 (0x052a) + sir/milady
  rumorRespond: '?"\n\nYou respond:\n', //  DS 0x9f24 (0x0534) — y detrás el getstring de 15
  rumorAfterInput: "\n\n", //               DS 0x9f36 (0x0546)
  rumorUnknown: '"That, I cannot help thee with.\n\n', // DS 0x9f3a (0x0591) — y VUELVE a preguntar
  rumorFairNuff: "\n\nFair 'nuff?\" ", //   DS 0x9f5c (0x05b9) — cierra la comilla del registro 84
  rumorNo: "No\n\n", //                     DS 0x9f6c — eco de 'N' (0x05dc); rechazar CUENTA como servicio
  rumorYes: "Yes\n\n", //                   DS 0x9f72 — eco de 'Y' (0x05e6)
  rumorSorry: '"Sorry, ', //                DS 0x9f78 — sin oro (0x05f6) + sir/milady + registro 91
  rumorSays: "\nsays ", //                  DS 0x9f82 — atribución del chisme (0x064b) + [0xaafe]
  rumorSaysClose: ".\n\n", //               DS 0x9f8a — cierre (0x0659)
  shipYes: "Yes", //                        DS 0xa008 — eco de 'Y' del gate del astillero (0xae6)
  // ── Cadena de venta del astillero (F2-T3 espejo; SHOPPES2 0x08a8) ──
  shipEchoF: "F\n\n", //                    DS 0x9fe4 — eco de la tecla F (0x8f0)
  shipEchoS: "S\n\n", //                    DS 0x9ffa — eco de la tecla S (0x9d4)
  shipTakeYes: "Yes\n\n", //                DS 0x9ff0 (frigate 0x9a8) = 0x9ffe (skiff 0xa47)
  shipYells: "yells $.\n", //                DS 0x9fc2 — atribución del insulto sin oro (0x7f4, expansor $)
  shipElseClose: '?" ', //                  DS 0x9fd8 — cierre del «anything else, sir/milady» (0x86d)
  innYes: "Yes", //                         DS 0x5062 — eco de 'Y' del gate de posada (0x8f8)
  // Menú fiel de la posada (SHOPPES3 0x917-0x922): `$ asks,` + pregunta R/L/P con los
  // saltos duros del literal (wrap a 16 cols HORNEADO en DATA.OVL).
  innMenu: '\n\n$ asks,\n"Art thou here\nto Pick up or\nLeave a\ncompanion, or\nto Rest for the\nnight?" ', // DS 0x5066+0x508e (expansor $)
  innMore: '"Is there\nanything more\nI can do for\nthee?" ', // DS 0x50bd — epílogo tras Leave/Pickup (0x99e)
  // ── Cadenas REST/LEAVE de la posada (F2-T2 espejo; SHOPPES3 0x0072/0x02ae).
  // Todas verbatim de DATA.OVL (fileoff = DS+0x10, dump verificado).
  innSorry: '"I am sorry,\n', //             DS 0x4d87 — posada llena (helper 0x2c @0x4c)
  innMilady: "milady", //                    DS 0x4d95 (sorry @0x53) = DS 0x4e2c (pleasant @0x134), género 0x0c
  innSir: "sir", //                          DS 0x4d9c (sorry @0x5e) = DS 0x4e33 (pleasant @0x13a), género 0x0b
  innSorryClose: ', but we\nhave no room\navailable."\n\n', // DS 0x4da0 (0x65)
  innWiltTake: '\nWilt thou take\nit?" ', // DS 0x4dca (rest @0xe2) = DS 0x4f24 (leave @0x3bb), mismos bytes
  innBroke: '"Highwaymen!\nCheap, at that!\nOUT!" ', // DS 0x4de3 — sin oro (0x108)
  innBrokeScreams: "screams\n$.\n", //       DS 0x4e07 — atribución del insulto (0x10f, expansor $)
  innPleasant: '"Have a pleasant\nnight, ', // DS 0x4e13 — pago hecho (0x127)
  innPleasantClose: '!"\nsays $.\n\n', //    DS 0x4e37 — cierre + atribución (0x141, expansor $)
  innZzz: "Zzzzzz....\n\n", //               DS 0x4e44 — la noche (0x1ae)
  innMorning: "Morning!\n", //               DS 0x4e51 — despertar a las 6:00 (0x1f6)
  innPassedAway: " has\npassed away.\n", //  DS 0x4e5b — envenenado muere durmiendo (0x253; tras '\n'+nombre)
  innWhoStay: '$ asks,\n"Who will\nstay?" ', // DS 0x4e86 — prompt del Leave (0x306, expansor $)
  innNobody: "Nobody\n\n", //                DS 0x4ea0 — picker cancelado (0x318)
  // Elegir al Avatar en el Leave: DS 0x4eac 'Thy friend' + putchar 's' si party>2
  // (0x343) + DS 0x4eb7 ' will not leave thee!\n\n'. Compuesto AQUÍ en 2 variantes
  // enteras (choke i18n: las piezas sueltas no traducen el plural).
  innFriendWont: "Thy friend will not leave thee!\n\n", //  0x4eac+0x4eb7 (party==2)
  innFriendsWont: "Thy friends will not leave thee!\n\n", // 0x4eac+'s'+0x4eb7 (party>2)
  innRateOpen: '"The rate for\nour most comfortable room will be ', // DS 0x4ecf (0x3ad)
  innRateMonthly: "% gold per month, due at check-out.", // DS 0x4f00 (0x3b4, % = tarifa mensual)
  innThank: '"I thank thee."\nsays $.\n\n', // DS 0x4f3d — leave confirmado (0x479, expansor $)
  // ── Cadena PICK UP de la posada (SHOPPES3 0x04e6) — la familia MULTI-MENSAJE de #145.
  // El cobro y su desenlace son TRES emisiones seguidas cuyas comillas se cruzan: la de
  // apertura la pone `innPickupPay` (acaba en `\n\n"`) y la de cierre viene DENTRO del
  // fragmento siguiente (`innPickupDied` / `innPickupEnjoy`), que a su vez remata con la
  // atribución aparte (`innPickupSays`). Trocearlas es del binario, no del port.
  innPickupFull: "\n\nOne must first be left behind!\n\n", // DS 0x4f57 — party de 6 (0x4fb)
  innPickupNobody: '\n\n"No one here is from thy party!"\nsays $.\n\n', // DS 0x4f7a (0x50c, expansor $)
  innWhoCheckOut: '\n\n"Who will\ncheck out?" ', // DS 0x4fa7 — prompt del registro (0x51f)
  innPickupNoOne: "No one\n\n", //           DS 0x4fd8 — ESC en el registro (0x6c8)
  innPickupPay: '\n\n"That will be % gold, please."\n\n"', // DS 0x4fe1 (0x789, expansor %)
  innPickupDied: 'Thy friend has died, by the way."\n', // DS 0x5005 — el huésped era 'P' (0x85f)
  innPickupEnjoy: 'I hope thou hast found thy stay enjoyable,"\n', // DS 0x5028 — sano (0x888)
  innPickupSays: "says $.\n\n", //           DS 0x5055 — atribución del cobro (0x88f, expansor $)
} as const;

/**
 * NUMERALES del anuncio de precio de la taberna — `print_alive_count_word`
 * (SHOPPES2 0x006a), un switch sobre `[0xbd1c]` (= `g_alive_b`, el nº de vivos):
 * ```
 * 006a  mov ax,[0xbd1c]
 * 006d  cmp ax,2 / je 0x88 → DS 0x9aa8   ·  0x72 cmp 3 / je 0x92 → DS 0x9aac
 * 0077  cmp ax,4 / je 0x98 → DS 0x9ab2   ·  0x7c cmp 5 / je 0x9e → DS 0x9ab8
 * 0081  cmp ax,6 / je 0xa4 → DS 0x9abe   ·  0x86 jmp 0xaa
 * 00aa  ret                              ← 1, 0 y >6 SALEN SIN IMPRIMIR NADA
 * ```
 * El `1` NO tiene entrada: con el Avatar solo el original imprime «gold for the  of
 * ye,» con DOBLE ESPACIO. Es el bug de EA de la ficha #17 — bytes verificados sobre
 * DATA.OVL con `fileoff = DS+0x10` (la convención acreditada de este repo, ver
 * `re/notes/command-dispatch.md §4` y su `test_command_strings_resolve_from_data_ovl`).
 * La tabla lleva SÓLO lo que el binario tiene; el remedio del `1` vive en
 * `tavernAliveWord` (shops.ts), etiquetado como arreglo y no como transcripción.
 */
export const TAVERN_ALIVE_WORD: Readonly<Record<number, string>> = {
  2: "two", //   DS 0x9aa8
  3: "three", // DS 0x9aac
  4: "four", //  DS 0x9ab2
  5: "five", //  DS 0x9ab8
  6: "six", //   DS 0x9abe
};
