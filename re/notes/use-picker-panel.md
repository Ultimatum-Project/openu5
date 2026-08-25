# El panel de (U)se item — derivación completa del pergamino

> Derivación del PANEL del comando (U)se: cabecera, cadenas de cada fila, columna de
> cantidad y fuente de cada glifo. Sujeto = BINARIO. Offsets = ficheros
> `re/disasm/{CAST,ZSTATS}.OVL.asm`; cadenas = volcado de `DATA.OVL`
> (`fileoff = DS + 0x10`); fuentes = `IBM.CH` / `RUNES.CH` del juego.
>
> Origen: el carril `sbs-dosbox` grabó un side-by-side «original ⇄ port» con el MISMO
> save y su fotograma t=48 s pilló el panel diciendo cosas distintas en los dos lados
> (su divergencia **D2**). Esta nota deriva el panel entero **del crudo**; la captura
> sólo dice dónde mirar. Lo que se corrigió en el port está en §7.

## 1. Quién pinta qué (`cmd_use_item`, CAST.OVL 0x1792)

```
17a2: push 0xffff / push 0x26 / push 0xb9ee / push 0xff
17b2: call find_next_owned          ; ¿hay algún usable?
17bb: si 0xffff → 17bd: print(0x489f)="No usable items!\n" y SALE sin abrir nada
17c8: push 0x48b1 / call 0x58d0     ; "Item: "  → CONSOLA
17d9: push 0x48b8 / call 0x8ed0     ; "Items:"  → CABECERA del panel
17e0: push 8 / call draw_list_frame ; marco de 7 filas de contenido
17ee: push 0x55 ('U') / push 0xff / push start / call item_page_controller (ZSTATS 0x0f2e)
```

★ **Son DOS cadenas distintas y contiguas en el DGROUP** — `…Item: \0Items:\0Carpet\n\n\0…`
—, una a la consola y otra a la cabecera. Y ninguna de las dos es `"Use item"`, que es el
eco del DISPATCHER (DS 0xa24c) y ya está impreso más abajo: en el fotograma se ven **las
tres a la vez**, cada una en su sitio.

El `0xff` de `[bp+6]` es el MODO que llega a `find_next_owned`. En (R)eady ese hueco lleva
el índice del PJ (ZSTATS 0x12f2), y de ahí sale toda la diferencia de §3.

## 2. `item_page_controller` 0x0f2e — la fila y su separador

```
0f40: cmp [bp+4], 0x52 ('R')
0f46:   sí → qty=0x57c0, count=0x30       ; tabla de EQUIPO
0f54:   no → qty=0xb9ee, count=0x26       ; tabla EXTENDIDA (38 entradas)
…
0f90: push idx / push 0xb9ee / push 0x1916 / push 0x20   ; ★ separador = 0x20
0f9e: call print_list_row (0x05e2)
0fb5: putchar(0xfd) en la fila del cursor
0fbf: cmp ax, 8 → corta la página        ; 7 filas de contenido
```

★★ **El separador del PICKER es `0x20` (espacio), no el `0x2d` del visor de Ztats.** El
`0x2d` lo empuja `render_item_list` @0x0765, que es OTRO llamador de la misma rutina de
fila. Confundirlos pinta `1-Magic Crpt` donde el original pinta ` 1 Magic Crpt`.

## 3. `print_list_row` 0x05e2 — la columna de cantidad

```
05f0: al = qty[idx]
05f5: cmp al,0xff / je 0x62e   ; ★ 0xff ⇒ NI número NI separador: CERO celdas
05fb: or al,al / je 0x60e      ;   0    ⇒ print(0x9778) = "--"
0600: push ax/2/0x20 / call print_number ; resto ⇒ 2 díg. justificados, pad ESPACIO
0622: putchar(sep)
…
06b9: col = get_cursor_col(); mientras col<0xe → putchar(' ')   ; ★ fila de 14 celdas
06dd: putchar('\n')
```

Tres estados, no dos. Y **el `--` es INALCANZABLE en el picker de (U)se**: con modo `0xff`,
`find_next_owned` @0x05ba sólo devuelve índices con byte **≠ 0**, así que un `0` nunca
llega a pintarse. El `--` es del picker de (R)eady, que pasa un índice de PJ como modo y
por eso puede listar un ítem con cuenta 0 **porque está equipado** (`is_item_equipped`
@0x0518, consultado sólo en esa rama).

### 3.1 Quién vale 0xff — CENSO, no intuición

`build_extended_item_table` @0x099a aplana el estado en la tabla 0xB9EE **copiando el byte
crudo**, con dos únicas normalizaciones a flag:

| ids | fuente | qué guarda |
|---|---|---|
| 0x00-0x07 pergaminos | `[0x5820+i]` | byte crudo (CUENTA) |
| 0x08-0x0f pociones | `[0x5828+i]` | byte crudo (CUENTA) |
| 0x10 alfombra · 0x11 llaves | `g_carpets` / `g_skull_keys` | byte crudo (CUENTA) |
| 0x12-0x14 regalia · 0x1d-0x1f shards · 0x20 catalejo · 0x22 sextante · 0x23 reloj · 0x24 insignia · 0x25 caja | byte crudo | ver abajo |
| 0x15-0x1c gemas lunares | `[0x5840+i]==0xff ? 0xff : 0` | **NORMALIZA** (@0x09b4) |
| 0x21 planos HMS | `g_hms_cape != 0 ? 0xff : 0` | **NORMALIZA** (@0x0a0a) |

Para los «byte crudo» la respuesta la da **quién escribe la variable**. Censo completo del
corpus de disasm (cada variable tiene UNA sola instrucción de escritura; ninguna otra la
menciona salvo lecturas y comparaciones):

| variable | escritor | valor |
|---|---|---|
| `g_amulet_lb` | SJOG.OVL 0x1712 | **0xff** |
| `g_crown` | SJOG.OVL 0x16e6 | **0xff** |
| `g_sceptre` | SJOG.OVL 0x1706 | **0xff** (y ULTIMA.EXE 0x6224 lo LIMPIA a 0) |
| shards `[0x57b6+i]` | SJOG.OVL 0x16bd | **0xff** (y SJOG 0x1710 limpia a 0) |
| gemas `[0x5840+i]` | SJOG.OVL 0x1496 | **0xff** |
| `g_spyglass` | TALK.OVL 0x06f8 | **0xff** |
| `g_sextant` | TALK.OVL 0x06f0 | **0xff** |
| `g_black_badge` | TALK.OVL 0x0700 | **0xff** |
| `g_wooden_box` | SJOG.OVL 0x14f7 | **0xff** |
| `g_hms_cape` | SJOG.OVL 0x15d4 | **0xff** (+ `or 0x80` CAST 0x1a86) |
| `g_carpets` | `inc` CMDS 0x0910 / SJOG 0x14a5, `dec` CAST 0x18a1 / CMDS 0x0fdd / MAINOUT 0x1106 | CUENTA |
| `g_skull_keys` | `dec` CAST 0x18c4 | CUENTA |

⇒ **en una partida de EA, TODO lo que no sea pergamino, poción, alfombra o llave de
calavera sale SIN columna de cantidad.** El nombre arranca en la primera celda de
contenido, una a la izquierda de donde arrancan los nombres de los contables.

🔴 **Trampa medida**: los saves de `original/u5/saves-lib/` dicen otra cosa —
`puertas-doom-con-caja/SAVED.GAM` tiene la caja a **1**— y esa lectura llegó a estar
escrita en el port (`buildQuestList` daba número a catalejo/sextante/insignia/caja
citando ese save). **Ese `1` no es de EA: lo escribió el port.** Se ve en el propio censo
de la biblioteca: en los 13 saves, amuleto/corona/cetro/reloj —que EA ya traía a 0xff—
siguen a 0xff, y sólo lo que el port ENCENDIÓ vale 1 (era `writeBoolPreserve`, que ponía
`v ? 1 : 0`). **Un byte de un save que nuestro código ha reescrito no es testimonio del
binario**, y aquí el byte VIAJA A LA PANTALLA: un save nuestro cargado en el original
pintaba « 1 Black Badge» donde EA pinta «Black Badge». Es exactamente lo que enseña el
fotograma t=48 del careo, que corría sobre un save escrito por el port.

## 4. Las cadenas — name-table DS 0x1916, volcada

38 punteros WORD; entre corchetes el DS del destino. Las que llevan sigilo de formato en
el primer byte se marcan aparte (§5).

| id | entrada | render |
|---|---|---|
| 0x00-0x07 | `*VL` `*RH` `*IS` `*IA` `*IQW` `*KXC` `*IMC` `*AT` [0x0480…0x049f] | sigilo `*` |
| 0x08-0x0f | `!` a secas [0x04a3…0x04b1] | sigilo `!` |
| 0x10 | `Magic Crpt` [0x04b3] | tal cual |
| 0x11 | `Skull Keys` [0x04be] | tal cual |
| 0x12 | `Amulet` [0x04c9] | tal cual |
| 0x13 | `Crown` [0x04d0] | tal cual |
| 0x14 | `Sceptre` [0x04d6] | tal cual |
| 0x15-0x1c | `(0`…`(7` [0x04de…0x04f3] | sigilo `(` |
| 0x1d | `Shard/Falsehd` [0x04f6] | tal cual |
| 0x1e | `Shard/Hatred` [0x0504] | tal cual |
| 0x1f | `Shard/Cowrdce` [0x0511] | tal cual |
| 0x20 | `Spyglass` [0x051f] | tal cual |
| 0x21 | `HMS Cape Plan` [0x0528] | tal cual |
| 0x22 | `Sextant` [0x0536] | tal cual |
| 0x23 | `Pocket Watch` [0x053e] | tal cual |
| 0x24 | `Black Badge` [0x054b] | tal cual |
| 0x25 | `Wooden Box` [0x0557] | tal cual |

★ **Las abreviaturas están DICTADAS por el ancho**, no son capricho: la fila mide 14
celdas (§3) y arranca en la col 1 del marco ⇒ **13 celdas de contenido**. `Shard/Cowrdce`
y `HMS Cape Plan` miden **13 justas**; `Magic Crpt` y `Skull Keys` miden 10, que con los 2
dígitos y el separador vuelven a dar 13. Cualquier nombre largo (`Shard of Falsehood` = 18)
sencillamente NO cabe. Que la tabla encaje exacta en las dos formas es, de paso, la
confirmación de que la lectura del ancho es la buena.

Cadenas de apoyo, también volcadas: `0x9778` = `--` · `0x977c` = `1c 20 2b 20` ·
`0x9782` = `1d 20 2b 20` · `0x9788` = `Moonstone ` · `0x9794` = `(None owned!)` ·
`0x48b1` = `Item: ` · `0x48b8` = `Items:` · `0x489f` = `No usable items!\n`.

## 5. ★★ `0x3abe` es `set_font(RUNES.CH)`, NO un «realce»

`print_list_row` ramifica por el PRIMER byte del nombre y en las tres ramas llama a
`0x3abe(1)` … `0x3abe(0)`. La nota `ztats-layout.md` lo rotulaba `set_highlight`. **Es un
conmutador de FUENTE**, y lo cierran las dos puntas de la evidencia:

- **Bytes**: las decoraciones son `1c 20 2b 20` y `1d 20 2b 20`. Ese `2b` es un `'+'`.
- **Píxeles**: en el fotograma t=48 esa celda **no** es un `'+'` (no tiene el trazo
  vertical) sino una barra horizontal, y la sigla del pergamino no es latina.
  Reconstruidas las celdas de 8×8 del DOSBox y careadas contra los ficheros de fuente del
  juego, casan **exactamente** con `RUNES.CH`: `0x1c` (sigilo de pergamino), `0x2b` (que en
  la rúnica es una barra y en IBM.CH una cruz), y `'I'`/`'S'` de `*IS`. En `IBM.CH` no casa
  ninguno; en `IBM.HCS` tampoco.

El **alcance** de la fuente rúnica lo fija cada rama, y las tres son distintas:

| sigilo | asm | rúnico | latino |
|---|---|---|---|
| `*` pergamino | 0x0638: font(1) → `0x977c` → **nombre** → font(0) @0x0652 | decoración **y** sigla | — |
| `!` poción | 0x0664: font(1) → `0x9782` → font(0) @0x0677 → cadena-lado | sólo la decoración | el COLOR |
| `(` gema | 0x068e: `0x9788` → font(1) → `putchar(name[1])` → font(0) | sólo el dígito | `Moonstone ` |

Por eso en la captura «Yellow» sale en latinas y `IS` no: el apagado va **antes** del
color y **después** de la sigla. La cadena-lado de `!` es `[fila*2 + 0x19B2]`, que para las
filas 8-15 aterriza en los colores DS `0x19C2` (`Blue`…`White`, volcados).

## 6. La fila, en una línea

```
[cuenta 2 díg. pad ESPACIO][sep 0x20]   ← ausentes por completo si el byte es 0xff
[decoración de sigilo, en RUNES.CH]     ← sólo si el nombre lleva * ! (
[nombre]                                ← rúnico con *, latino con ! y (
[relleno de espacios hasta la celda 14][\n]
```

## 7. Qué se corrigió en el port (rama `usepicker-fidelidad`)

1. **Cabecera** `Use item` → `Items:` (`USE_UI.banner`, DS 0x48b8).
2. **Cadenas** de `USE_ITEM_NAMES` → la name-table 0x1916 verbatim (§4), y los pergaminos
   /pociones/gemas pasan a emitir su entrada CODIFICADA (`*IS`, `!Yellow`, `(3`).
3. **Cantidad**: los flags pasan de `qty 0` (que la piel pintaba `--`) a `USE_QTY_HIDDEN`
   = 0xff ⇒ sin columna. Con el censo de §3.1 detrás.
4. **Una sola rutina de fila**: la variante `use` del picker delega en `listRowCells`, que
   ya calcaba `print_list_row` para la lista «Items» de Ztats; la única diferencia
   derivada —el separador— viaja como argumento. La duplicación era lo que dejó divergir
   las dos superficies del mismo `print_list_row`.
5. **Fuente rúnica** (§5): `listRowCells` devolvía un booleano de fila que su consumidor
   descartaba; ahora devuelve las COLUMNAS rúnicas y el blit las pinta con RUNES.CH — la
   piel ya sabía hacerlo (lo hacía para el glifo de clase de (R)eady), sólo faltaba
   decirle qué celdas. Arregla también la lista «Items» de Ztats.
6. **`buildQuestList`** (Ztats): catalejo/sextante/insignia/caja pasan a «sin número».
7. **`saveNative`**: los flags de posesión se graban **0xff** como el binario
   (`writeFlagPreserve`), no `1`. Es lo que hacía que un save nuestro pintara distinto
   **en el original**.

Guarda: `game/tests/use-picker-panel-fiel.test.ts` (esperados en crudo, con el control
positivo del `--` de (R)eady al lado) + `fiel-ztats.test.ts` (alcance rúnico por rama).

## 8. Dos apuntes de proceso que salieron del mismo tirón

**El kernel ya lo tenía derivado, y el resumen lo enterró.** `re/ledger/frontier.json`
(entrada de `0x1c9e`, el kernel del thunk `0x3abe`) dice, textual: «indexa la tabla de
segmentos de **banco de fuente** DS:0x539c … `[0x5398]` es exactamente el ES del que el
putchar lee el glifo» — y remata «ZSTATS lo usa como `set_highlight` (fuente realzada,
ztats-layout.md:24)». La derivación de abajo era correcta y la coletilla la reconcilia con
el rótulo equivocado de la nota de arriba, que es la que todo el mundo lee. Se puede
comprobar en el residente sin salir del disasm: `1cae cmp word [bx+0x539c],0` /
`1cb5 mov ax,[bx+0x539c]` / `1cb9 mov [0x5398],ax`, contra `16f0 mov es,[0x5398]` del
putchar. ⇒ el rótulo `set_highlight` vivió meses encima de su propia refutación.
(La entrada del ledger conserva la coletilla: no la toco desde aquí, queda para el lead.)

**El testigo que ya decidía y al que nadie preguntó.** El mismo hallazgo estaba en una
captura del repo desde hace semanas: `original/av-referencia/ready-ui/
ORIG_3_picker-equipado-marcadores.png`, la fila `--♥Chain` del picker de (R)eady. Ese
corazón es `RUNES.CH[0x03]`; `IBM.CH[0x03]` es un TRIÁNGULO. El testigo se usaba para
decidir OTRA cosa (que el glifo no va en vídeo inverso) y de paso fijaba el banco, pero
como la pregunta no se le hizo, el comentario que lo cita explicaba el mecanismo mal
—«un flag: imprime este byte de control como su glifo CP437 literal»— mientras el código
de al lado ya pintaba con la rúnica. Efecto correcto, mecanismo falso: y con el mecanismo
falso no había forma de saber de qué banco sale el glifo, que es justo lo que hacía falta
para el (U)se.
