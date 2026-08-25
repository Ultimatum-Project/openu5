# Layout de las páginas de Ztats para la piel fiel (E1-S11 prep)

> Derivación del **layout de pantalla** (posiciones de ventana/cursor, orden de
> campos, glifos de caja) de las páginas de Ztats en `ZSTATS.OVL`, para que la
> piel fiel (E1-S11) sea cableado puro: pintar los campos del snapshot en sus
> celdas con IBM.CH. La LÓGICA (qué campos, tablas, Ready) ya está en
> `re/notes/zstats.md`; esto añade el DÓNDE. Offsets = fichero `ZSTATS.OVL.asm`.
>
> Autoridad: asm verbatim. Coords en CELDAS de carácter (8×8 px), como el
> descriptor de texto del kernel (`re/notes/ui-text-layer.md §3`).

## 0. Mapa de thunks → kernel (K = (T − 0x1e20) mod 0x10000)

ZSTATS llama al kernel por far-thunks. Verificado con la fórmula K de
`zstats.md §K`:

| Thunk | Kernel | Función |
|-------|--------|---------|
| `0x3670` | `0x1850` | `print_string(char*)` — imprime label/valor con wrap |
| `0x34da` | `0x16ba` | `putchar(c)` — glifo suelto (0xff reset, 0x20 space, glifos de caja, control 0xfb/0xfc) |
| `0x385e` | `0x1a3e` | `print_number(val, digits, pad)` — nº justificado |
| `0x3a12` | `0x1bf2` | `set_cursor(col, row)` — offset dentro de la ventana activa |
| `0x3a42` | `0x1c22` | `set_text_window(index, left, top, right, bot)` — configura el descriptor `index` de la tabla `0x535e` |
| `0x3abe` | `0x1c9e` | **`set_font(flag)`** — 1 = fuente RÚNICA (`RUNES.CH`), 0 = `IBM.CH`. ~~`set_highlight`~~ (ver §5.3) |
| `0x3b0e` | `0x1cee` | `get_cursor_col()` — devuelve la columna actual (paginación/relleno) |
| `0x448c` | — | `get_extended_key()` — tecla con códigos extendidos (flechas 1-4, PgUp/PgDn 0xd5/0xd6, etc.) |
| `0x39b4` | — | `set_active_window(index)` — conmuta descriptor activo (1=panel, 2=línea de comando) |
| `0x6c70` | — | imprime la **cabecera/título** de la página (string ptr) |
| `0x6bca` / `0x6d1c` | — | limpieza/preparación del panel |

**Consecuencia clave:** todas las páginas de Ztats se pintan en el
**descriptor de texto `index 1`** = el **panel derecho**, con
`left=0x18 (24), top=1, right=0x26/0x27 (38/39), bot=9` (celdas). Es decir cols
24..39, filas 1..9 — encaja con el panel del marco (`paint_screen_frame`, x≥0xc0
= col 24; `re/notes/ui-text-layer.md §8`).

## 1. `draw_stat_page 0x0082` — página 1 (atributos)

Record del personaje: `base 0x55a8 + charIndex*32` (`shl 5`), stride 32
(coincide con `zstats.md §Layout`). Secuencia:

1. `set_text_window(1, 0x18, 1, 0x26, 9)` + `putchar(0xff)` (reset/clear del
   panel) → `set_text_window(1, 0x18, 1, 0x27, 9)` (0x00a2-0x00d0).
2. **Cabecera (fila 1):** clase = tabla `0x96c6[record+0xa]`, status = tabla
   `0x96d0[record+0xb]` (vía `0x6b96` lookup); género = `putchar(record+9)`
   (CP437 ♂/♀, 0x0125); label `0x96d6` + `print_number(record+0x16, 1, 0x20)`
   (0x0138) — **el NIVEL (+0x16 byte, 1 díg., pad espacio 0x20) va en la CABECERA**.
3. `set_cursor(0, 3)` + `putchar(0xfb)` (centrado OFF) — arranca el bloque de
   stats en la **fila 3** (0x01aa-0x01b8).
4. **7 líneas de stat** (label `print_string` + valor `print_number`), en el
   orden e interleave 2/4-dígitos del binario. Los CAMPOS del record salen de
   `docs/formats/tlk-npc-dataovl-gam.md §4` (autoridad; `+0x0e`=int(=maxMP),
   `+0x0f`=**currentMP**, `+0x10`=currentHP, `+0x12`=**maxHP**, `+0x14`=exp,
   `+0x16`=nivel):

   | # | label ptr | record off | ancho·pad | campo |
   |---|-----------|-----------|-----------|-------|
   | 1 | `0x96dc` | `+0x0c` | 2 · 0x30 | **Str** |
   | 2 | `0x96e2` | `+0x10` (word) | 4 · 0x20 | **currentHP** |
   | 3 | `0x96e8` | `+0x0e` | 2 · 0x30 | **Int** (= maxMP) |
   | 4 | `0x96ee` | `+0x12` (word) | 4 · 0x20 | **maxHP** |
   | 5 | `0x96f4` | `+0x0d` | 2 · 0x30 | **Dex** |
   | 6 | `0x96fa` | `+0x14` (word) | 4 · 0x20 | **Exp** |
   | 7 | `0x9700` | `+0x0f` | 2 · **0x20** | **currentMP** (pad ESPACIO, no '0' — asm `0x0268`) |

   (Corrección de la 1ª lectura: `+0x12`=maxHP —no "Magic Pts"— y `+0x0f`=MP —no
   el nivel—; el nivel es `+0x16` y va en la cabecera. Ver §4 del formato y
   `re/notes/magic.md §3`.) Los atributos de 2 díg. usan `pad=0x30` ('0'), los
   words de 4 díg. `pad=0x20` (espacio). Las columnas exactas de cada label están
   EMBEBIDAS en las cadenas `0x96dc..0x9700` (espacios/CR) del **DGROUP compartido**
   (no en el OVL de 4880 B; DS = imagen DATA.OVL) → Clase C acotada; el
   orden/fila/offset/campo ya es derivado.

## 1b. `cmd_zstats 0x0a3a` — bucle de teclas (comando Z)

Entry del comando Z. Bucle interactivo (`0x0a3a-0x0bec`): lee una tecla en
`[bp-4]` (getkey `0x0acf`) y despacha. `[bp-2]` = índice del **EJE DE PÁGINAS**
(ver §2), `[bp-6]` = miembro resuelto. Conducta REAL:

| Tecla | Código | Efecto | Sitio |
|-------|--------|--------|-------|
| **SPACE** | 0x20 | **cierra** | `0x0a78 → 0xbd6` |
| **ESC** | 0x1b | **cierra** (igual que Space) | `0x0a81 → 0xbd6` |
| **flechas** | 1/2/3/4 (getkey `0x448c`) | ciclan **CIRCULAR** el eje de páginas, **sin cerrar** | 1,3→prev `0x0aa6`; 2,4→next `0x0aea` |
| **'1'-'6'** | 0x31-0x36 | **salta directo a la página de STATS del miembro** (digit−1), acotado a `g_party_size` | `0x0b12` |
| **'0'** | 0x30 | **salta a la página de provisiones** (índice 0xc) | `0x0b37 → 0xaf7` |
| **'Z'** | — | **NO se lee dentro del bucle** (sólo ABRE) | (sin `cmp` de 'z') |

**Nunca cierra por navegar** — sólo Space/ESC cierran. Las páginas de LISTA
(0xd-0x10) tienen su PROPIO sub-bucle de teclas dentro de `render_item_list`
(§3): consumen PgUp/PgDn/scroll ahí y sólo **devuelven** a `cmd_zstats` las
teclas de salida (Space/ESC/'0'-'6'/flecha-de-página), que éste re-despacha
(`0xb9a call 0x6e8` → `0xb69 mov [bp-4],al` → vuelve a `0xa78`).

**Port fiel (E1-S11):** `ztatsKeyReducer` en `game/src/skin/fiel/ztats.ts`. S11
sólo tiene la página de stats por miembro → el ciclo se acotó a MIEMBROS
(circular); el eje COMPLETO (equipo/magia impar + provisiones + 4 listas) se
deriva aquí (§2) para el siguiente incremento. La piel usa listener en
**captura** para tragar la tecla antes del juego mientras el modal está abierto
(F9 se deja pasar para el hot-swap).

## 2. El EJE DE PÁGINAS completo (`[bp-2]` en `cmd_zstats`)

`[bp-2]` recorre un eje **GLOBAL de 17 slots (0x00..0x10)**. Los 12 primeros son
por-miembro (6 × 2 páginas), luego 5 páginas globales. El despacho está en
`0x0ad2-0x0bcf`:

| Idx `[bp-2]` | Página | Rutina · sitio | Notas |
|---|---|---|---|
| **par 0,2,4,6,8,10** | **Stats del miembro** (§1) | `draw_stat_page 0x0082` · `0xb4a` (`member = idx>>1`) | 6 miembros |
| **impar 1,3,5,7,9,11** | **Equipo + hechizario del miembro** | `draw_magic_or_equipment_panel 0x02a8` · `0xad8` (`member = idx>>1`) | equipo slots +0x19..+0x1e + spellbook |
| **0xc (12)** | **Provisiones** (globales) | rutina headerless `0x039c` · `0xb5c` | food/gold/keys/gems/torches (+grapple si `g_grapple≠0`) |
| **0xd (13)** | **Lista 1 — Reactivos** (8) | `render_item_list 0x06e8` · `0xb8a` | title `0x97ac`, count `8`, qty `0x5850` (=`g_reagent_qty`, cf. `shops.md`), names `0x19d2` |
| **0xe (14)** | **Lista 2** (48) | `render_item_list` · `0xba0` | title `0x97b6`, count `0x30`, qty `0x57f0`, names `0x19e2` — categoría exacta a confirmar (Clase C) |
| **0xf (15)** | **Lista 3 — Ítems de quest** (38) | `render_item_list` · `0xbb2` | title `0x97be`, count `0x26`, qty `0xb9ee` (tabla aplanada por `build_extended_item_table 0x099a`), names `0x1916` |
| **0x10 (16)** | **Lista 4 — Equipo (armas+armaduras, 48)** | `render_item_list` · `0xbc4` | title `0x97c4`, count `0x30`, qty `0x57c0` (=`g_equip_qty`, cf. `shops.md`), names `0x1962` — misma data que el picker de Ready |

**Orden del ciclo (flecha next, key 2/4, `0xaea`):**
`0 → 1 → 2 → … → (party*2−1) → 0xc → 0xd → 0xe → 0xf → 0x10 → 0` (wrap).
El wrap salta el hueco `party*2 .. 0xb`: en `party*2−1` → `0xc` (`0xaf7`); en
`0x10` → `0` (`0xb0a`). **Prev (key 1/3, `0xaa6`):** de `0xc` → `party*2−1`
(`0xaac`); de `0` → `0x10` (`0xac6`); si no, `dec`. El ring es simétrico y NUNCA
entra en `party*2..0xb`.

**Provisiones (0x039c, página 0xc):** headerless (tail-call, sin prólogo
`55 8bec`; no está nombrada aparte en el ledger de `zstats.md` — referenciar por
offset). Imprime en el panel index 1 (reset `0xff`), cabecera vía `0x6c70`
(`0x9724`), luego, cada una con label `print_string` + `print_number`:
`g_food` (4·0x20, label `0x972e`), `g_gold` (4·0x20, `0x9738`), `g_keys`
(2·0x20, `0x9742`), `g_gems` (2·0x20, `0x9752`), `g_torches` (2·0x20, `0x9760`);
y si `g_grapple≠0` imprime el string `0x976e` (`0x044f-0x045c`).

**Equipo/hechizario (0x02a8, páginas impares):** reset `0xff` + control
`0xfc`/`0xfe`, cabecera `0x970e`, luego los **6 slots de equipo** (+0x19 helm,
+0x1a armor, +0x1b armaA, +0x1c armaB, +0x1d ring, +0x1e amulet) vía
`print_padded_string 0x0278` (name-table DS `0x1962`, idx*2; devuelve 0 si el
slot es 0xff). Si TODOS los slots están vacíos (`jne 0x37e` tras sumar) imprime
`0x9716` en fila 4 ("Nothing" / hechizario) — la 2ª mitad de la página es el
libro de hechizos.

## 3. `render_item_list 0x06e8` — visor de las 4 listas (0xd-0x10)

Firma (4 args, `ret 8`): `render_item_list(names, qty, count, title)`
(push en orden `title, count, qty, names` → callee `[bp+4]=names,
[bp+6]=qty, [bp+8]=count, [bp+0xa]=title`). Flujo:

1. `0x6c70(title)` imprime la cabecera; `draw_list_frame(8)` (§4) → marco de 8
   filas de contenido.
2. `find_next_owned(names?, count, qty, 0xffff)` (`0x05a4`) → primer índice con
   `qty[idx]>0`. Si NO hay ninguno (`0xffff`): redibuja marco, `set_cursor(1,4)`,
   `print_string(0x9794)` ("Nothing!"), `getkey`, y **devuelve** (lista vacía).
3. **Bucle de render (0x746):** por cada índice con `qty>0` (avanzando con
   `find_next_owned`), `print_list_row(idx, qty, names, 0x2d)` (§5). Cuenta filas
   con `get_cursor_col`; para en **`fila==8`** ⇒ **7 filas de contenido** (página
   llena). (Corrección: re-derivado instrucción a instrucción — el corte es en 8 =
   la fila del borde inferior, así que se pintan 7 ítems, no 8.)
4. **Sub-bucle interactivo (0x7d0):** prepara los índices de la página prev/next
   (con `find_prev_owned 0x056c` / `find_next_owned 0x05a4`) y lee tecla
   (`0x448c`):
   > **Códigos de tecla (get_extended_key, kernel 0x266c; tabla keypad 0x26fe):**
   > `1`=IZQ, `2`=DCHA, `3`=ARRIBA, `4`=ABAJO; `0xd3`=Home, `0xd4`=End,
   > `0xd5`=PgUp, `0xd6`=PgDn. (Re-derivado 2026-07-15; corrige la lectura previa
   > que rotulaba `0xd3/0xd4` como "flecha arriba/abajo" y decía "flechas 1-4
   > salen" — el dispatch REAL de `0x07d0` es el de abajo.)
   - **`3` (ARRIBA) / `4` (ABAJO)** = SCROLL de 1 ítem: `3`→`0x81c` (find_prev,
     step 1 salvo raw 0xd5), `4`→`0x86c` (find_next, step 1 salvo raw 0xd6). NO
     salen del sub-bucle.
   - **`0xd5 / 0xd6`** = PgUp / PgDn → mismos `0x81c`/`0x86c` pero step LITERAL 7
     (`mov [bp-2],7`).
   - **`0xd3` (Home) / `0xd4` (End)** = saltos de borde: `0xd3`→`0x8d6`
     (find_next desde 0xffff = primera página), `0xd4`→`0x8ec` (find_prev ×6 =
     cerca del fondo).
   - **`1` (IZQ) / `2` (DCHA)** → SALEN del sub-bucle (`0x948`, `[bp-6]≠0`) para
     **cambiar de página del eje §2**; NO scrollean.
   - **0x20 (Space) / 0x1b (ESC) / '0'-'6' (0x30-0x36)** → ponen `[bp-6]≠0` y
     **devuelven la tecla** (`0x990 → ax=[bp-0xc]`); `cmd_zstats` la re-despacha
     (cerrar / saltar a miembro / a provisiones).
   El realce/paginación reutiliza `set_active_window(2)` para la línea de
   comando y `set_active_window(1)` para el panel.

**item_page_controller 0x0f2e ≠ este visor.** `0x0f2e` es el **PICKER
interactivo de Ready/uso** (lo llama `cmd_ready` con `[bp+4]='R'`=0x52): misma
maquinaria de marco+filas+PgUp/PgDn, pero con selección (cursor `0xfd`
resaltado, ENTER→equipar). Dos configs internas: `'R'` → qty `0x57c0`, count
`0x30`, names `0x1962` (equipo, = lista 4); otro → qty `0xb9ee`, count `0x26`,
names `0x1916` (ítems de quest, = lista 3). Para S11 (visor Ztats) sólo hace
falta `render_item_list`; el picker es de la fase de Ready (Task F/3.13).

## 4. `draw_list_frame 0x045e` — marco de caja

`draw_list_frame([bp+4] = filas_de_contenido)`. Dibuja en el panel `index 1`:
`set_text_window(1, 0x18, 1, 0x26, filas+1)` + reset `0xff`, luego
`set_text_window(1, 0x18, 1, 0x27, 9)` (restaura ancho pleno). El marco ocupa
**15 celdas de ancho (cols 0..0x0e de la ventana) × (filas+2) de alto**; contenido
útil = 13 celdas (cols 1..13). Glifos de caja de IBM.CH (¡el horizontal SUPERIOR
e INFERIOR son glifos DISTINTOS!):

| Glifo | Rol | Sitio |
|-------|-----|-------|
| `0x10` | esquina sup-izq `┌` | 0x049c |
| `0x11` | horizontal SUPERIOR `─` (×13) | 0x04ab (loop si=0xd) |
| `0x13` | esquina sup-der `┐` | 0x04b5 |
| `0x17` | vertical `│` (col 0 y col 0x0e, filas 1..N vía `set_cursor`) | 0x04c4-0x04e4 |
| `0x14` | esquina inf-izq `└` | 0x04f0 |
| `0x15` | horizontal INFERIOR `─` (×13) | 0x04ff (loop si=0xd) |
| `0x16` | esquina inf-der `┘` | 0x0509 |

Patrón: fila 0 = `0x10` + 13×`0x11` + `0x13`; filas 1..N = `0x17` en col 0 y col
14 (`set_cursor(0,fila)` / `set_cursor(0xe,fila)`); fila N+1 = `0x14` + 13×`0x15`
+ `0x16`. (Corrige la 1ª lectura: 0x15 = horizontal inferior, 0x16 = esquina
inf-der; no hay 0x12.) `render_item_list` lo llama con arg **8** = la fila del
BORDE INFERIOR ⇒ **N=7 filas de contenido** (barras verticales en si=1..7, borde
inferior en la fila 8): caja de cols 24..38, filas 1..8. El arg NO es el nº de
filas de contenido sino `contentRows+1`; PgUp/PgDn fija literalmente 7
(`mov [bp-2],7`, 0x081c/0x086c). Corrige la 1ª lectura ("8 filas").

## 5. `print_list_row 0x05e2` — una fila de la lista

`print_list_row(idx, qty, names, sep=0x2d)` (`[bp+0xa]=idx, [bp+8]=qty,
[bp+6]=names, [bp+4]=sep`). Estructura de la fila:

1. `al = qty[idx]` (`[bp+8]+idx`). Si `qty==0xff` → salta la columna de cantidad
   (0x62e). Si `qty==0` → imprime string `0x9778` (relleno) en vez del número;
   si no → `print_number(qty, 2, 0x20)` (2 díg., pad espacio).
2. Salvo `qty==0xff`: `putchar(sep=0x2d)` (separador entre cantidad y nombre;
   con realce si `sep<0x20`, aquí no).
3. **Nombre + prefijo**: `ptr = names[idx*2]` (tabla de punteros WORD en DGROUP).
   `print_list_row` ramifica según el **PRIMER BYTE de la cadena de nombre**
   (embebido en DATA.OVL):

   | `name[0]` | Rama (asm) | Comportamiento REAL derivado |
   |-----------|-----------|------------------------------|
   | `0x2a` `*` | `0x0638` | `set_font(1)`; imprime `0x977c` + `name+1` (nombre sin el sigilo) — **los dos en rúnicas**; `set_font(0)` @0x0652 |
   | `0x21` `!` | `0x0664` | `set_font(1)`; imprime `0x9782`; `set_font(0)` @0x0677; **y sólo entonces** `[si+0x19b2]` = la cadena-lado (colores de poción DS `0x19c2` para las filas 8-15) — el color sale LATINO |
   | `0x28` `(` | `0x068e` | imprime `0x9788` (`"Moonstone "`, latino); `set_font(1)`; `putchar(name[1])` = **un glifo suelto** rúnico (el dígito de la fase) |
   | otro | `0x06ac` | imprime la cadena tal cual (`print_string(name)`) |

   > ⚠️ **Nombres de los prefijos:** el asm SÓLO muestra que `*`/`!`/`(` son
   > sigilos de FORMATO embebidos como primer byte del string en DATA.OVL, con la
   > conducta de render de arriba. La lectura anterior los rotulaba
   > `*`=readied / `!`=cursed / `(`=numérico: **no confirmado por el asm** (el
   > estado "equipado" real lo calcula `is_item_equipped 0x0518`, que NO se
   > consulta aquí). El significado semántico exacto requiere volcar las cadenas
   > de DATA.OVL → **Clase C**. Conservo los rótulos como hipótesis, anotados.
   >
   > 🔴 **`0x3abe` NO era «realce»: es `set_font`** (carril `usepicker-fidelidad`,
   > 2026-08-25). Las decoraciones son `0x977c` = `1c 20 2b 20` y `0x9782` =
   > `1d 20 2b 20`; ese `2b` es un `'+'`, pero en el DOSBox esa celda pinta una
   > BARRA y las siglas del pergamino no son latinas. Reconstruidas las celdas de
   > 8×8 del careo side-by-side y careadas contra los ficheros de fuente del juego,
   > casan exactamente con **`RUNES.CH`** (`0x1c`, `0x2b` —barra en la rúnica—,
   > `'I'` y `'S'` de `*IS`) y con NINGÚN glifo de `IBM.CH` ni de `IBM.HCS`. El
   > alcance por rama está en la tabla de arriba. Detalle y evidencia:
   > `re/notes/use-picker-panel.md` §5.

4. **Relleno + salto:** `get_cursor_col`; si col < 0xe (14), rellena con espacios
   hasta la celda 14; `putchar(0x0a)` (newline). → toda fila mide 14 celdas.

**Origen de los NOMBRES:** cada lista tiene su PROPIA tabla de punteros en el
DGROUP (DATA.OVL): reactivos `0x19d2`, lista-0xe `0x19e2`, quest `0x1916`,
equipo `0x1962`; más la 2ª tabla `0x19b2` para los ítems con prefijo `!`. Son
**distintas** de las tablas de nombres del Get/loot (`0x419C/0x41AC/0x17F6`,
`objects.md §O-loot`). Todas caen en la imagen DATA.OVL (`fileoff = DS + 0x10`)
→ un volcado las fija (Clase C); el layout (marco, columnas qty/sep/nombre,
paginación) ya es derivado.

## 6. Qué necesita el cableado (piel fiel) y qué queda Clase C

**Derivado (listo para pintar), añadido sobre S11:**
- El **eje de páginas** completo (§2): 6×2 por-miembro + provisiones (0xc) + 4
  listas (0xd-0x10), con su orden circular y los gates de wrap. El reducer de
  teclas puede replicar el ring exacto.
- Geometría del marco de lista (§4): 15×(8+2) celdas en cols 24..38, filas 1..9,
  con los 7 glifos de caja del atlas IBM.CH (0x10/0x11/0x13/0x14/0x15/0x16/0x17,
  ya extraídos en S8a).
- Formato de fila (§5): columna de cantidad (2 díg. / relleno `0x9778` / oculta
  si 0xff), separador `0x2d`, nombre con las 4 ramas de prefijo, relleno a 14
  celdas + newline.
- Paginación de `render_item_list` (§3): 7 filas por página, PgUp/PgDn
  (0xd5/0xd6), scroll de 1 (0xd3/0xd4), salida por Space/ESC/'0'-'6'/flechas.

**Contrato (extensión propuesta, SOLO lo visible):** el snapshot ya expone
`PartyMemberView`. Para las sub-páginas hace falta un `inventoryView` global con
las 4 listas visibles — cada una = `[{ idx, name, qty, prefix }]` filtrada a
`qty>0` (lo que el original enseña), más las provisiones
(food/gold/keys/gems/torches/grapple) y, por miembro, los 6 slots de equipo +
el hechizario. Computarlo en `coreview.ts` desde los mismos campos del record
que ya lee draw_stat_page/draw_magic_or_equipment_panel (info visible del
original → legítimo, como `sky` en S8b). Exponer SÓLO lo visible, no el array
crudo de 48.

**Componentes de la piel:** la capa de texto de S8a (print_string/putchar/
number con las mismas coords de celda) + los glifos de caja ya en el atlas. No
requiere assets nuevos.

**Tests:** reducer del eje de páginas (ring circular incl. gates de wrap
`party*2−1→0xc`, `0x10→0`, `0→0x10`, `0xc→party*2−1`); '0'→provisiones,
'1'-'6'→stats del miembro; paginación (7 por página, PgUp/PgDn); filtrado
`qty>0`; render de las 4 ramas de prefijo; lista vacía → "Nothing!".

**Clase C (píxel-diff / volcado de cadenas DATA.OVL):**
- Los **títulos** de las 4 listas y de provisiones (`0x97ac/0x97b6/0x97be/0x97c4`
  y `0x9724/0x970e`), los strings de relleno/prefijo (`0x9778/0x977c/0x9782/
  0x9788/0x9794`) y las columnas exactas de labels (`0x96dc..0x9700`).
- ~~Las **tablas de nombres** de ítems y la categoría de la lista 0xe~~ —
  **CERRADO (carril cobertura-medias, ítem name-tables-dataovl)**: las 4 tablas
  VOLCADAS byte a byte — reactivos `0x19d2` (abreviados: "Sp. Silk"/"Blk.
  Pearl"/"Mandrake"; cableados en coreview.ts) · **lista 0xe `0x19e2` = HECHIZOS**
  (48 nombres truncados a 10 celdas: "An Xen Cor"/"In Xen Man"/"Mani"…; qty
  `0x57f0` = mezclas — categoría CONFIRMADA) · quest `0x1916` (ya en
  buildQuestList) · equipo `0x1962` (= shortEquipNames.json). **⚠ `0x19b2` NO es
  una tabla propia**: son los últimos 8 ptrs de `0x1962` ("Jewel Swrd"…); la rama
  `!` de print_list_row hace `push word [fila*2 + 0x19b2]` (índice = FILA de la
  lista) y para las filas de poción 8-15 aterriza en los **colores DS `0x19c2`**
  (Blue..White, entre 0x1962 y 0x19d2).
- El **significado semántico** de los prefijos `*`/`!`/`(` — derivado en la
  práctica: `*`=scroll (glifo 0x1c + código rúnico), `!`=poción (glifo 0x1d +
  color por fila), `(`=moonstone (glifo por `name[1]`); ver §5 y
  skin/fiel/ztats.ts listRowCells.
Todo encaja con el catálogo AV (F5.0) y el arnés píxel-diff (#26): un volcado
del DGROUP los fija; el orden/fila/geometría ya está derivado.

## 7. Estado del port (E1-S11b, cableado)

CABLEADO (commit `port(e1): ztats-listas`): el eje COMPLETO (§2) y las 4 listas.
- **Contrato** `InventoryView` en el snapshot (`game/src/skin/api.ts`): provisiones,
  equipo+hechizario por miembro, y las 4 listas ya filtradas a `qty>0`.
- **Adaptador** (`game/src/skin/coreview.ts`): las computa de los mismos campos que
  lee el original; nombres de `InventoryDetails.json` (= shops/search). Lista 0xf
  (quest) sintetizada de los flags discretos del port; lista 0xe mapeada a las
  mezclas de hechizo por adyacencia de tablas (0x57c0→0x57f0).
- **Piel** (`game/src/skin/fiel/ztats.ts`): `ztatsKeyReducer` con el ring circular
  y los 4 gates de wrap (§2); `drawListFrame` (§4), `listRowCells` (§5, 4 ramas de
  prefijo + realce), `renderItemListPage` (marco+título+7 filas+scroll+Nothing!),
  provisiones/equipo, y el despacho `layoutZtatsPage`. `skin.ts` guarda `ZtatsState`
  (página del eje + scroll) y traga las teclas en captura (F9 pasa para el hot-swap).

SIGUE Clase C (§6, para el píxel-diff #26): las cadenas EXACTAS de títulos/labels/
prefijos, las name-tables de DATA.OVL, la categoría precisa de la lista 0xe, el
significado semántico de `*`/`!`/`(`, y la interacción exacta título↔borde del
marco (aquí: título centrado en el borde superior). El hechizario impar se muestra
como lista de hechizos conocidos; su layout de sílabas exacto es Clase C.

## 8. RONDA 2 — presentación REAL (re-lectura + cadenas EXTRAÍDAS del binario)

> El calco de S11 tenía los OFFSETS y el eje bien, pero la PRESENTACIÓN se quedó
> corta (lista plana label/valor). Esta sección la corrige contra las 7 capturas
> del DOSBox del usuario (`original/av-referencia/ztats-refs/01..07`) y contra la
> re-lectura instrucción a instrucción de `draw_stat_page`/`draw_arms_page`/
> `draw_provisions`/`select_player`. **Todas las cadenas se EXTRAJERON verbatim del
> DGROUP de DATA.OVL** (`fileoff = DS + 0x10`); no hay nada a mano.

### 8.0 SELECCIÓN de jugador PRIMERO (`select_player` 0x0000)

`cmd_zstats` NO abre directo: en `0x0a40` llama a `select_player(1)` (rutina
0x0000). En overworld imprime el prompt **`"Player: "`** (0x96b4) y entra en el
picker interactivo del kernel (0x4b9a): el roster pasa a la cabecera **`►Select:◄`**
con la flecha `→` (0x1a) en el candidato, y la caja Food/Gold sigue visible (ref
01). Al elegir, ECHOa el nombre del miembro (`"Player: Elwood"`) y **`0x0a5f`
imprime `"\nStatus: "` (0x97a2)** — la línea Status con el cursor de ola queda
visible durante TODO el ztats (ref 07). En combate (g_location>0x80) auto-elige el
actor activo sin prompt. Tras elegir, arranca en `page = member*2` (stats).

### 8.1 STATS (`draw_stat_page` 0x0082) — DOS COLUMNAS

Banner **`►name◄`** (0x6c70, puntero al record cuyo primer campo es el nombre).
Panel (cols 24..39, filas 1..9), con estas cadenas del DGROUP:

| Fila | Contenido | Fuente |
|---|---|---|
| 0 | `[indent]♂ Lv-N Clase` | género=record+9 (♂=0x0b/♀=0x0c); `" Lv-"`=**0x96d6**; nivel=record+0x16 (1 díg); clase=tabla ptr **0x1a44** por letra record+0xa (`Avatar/Mage/Bard/…`); indent=tabla **0x1a58** por clase (`[1,2,2,1,1,1,1,1,0]`) |
| 1 | estado de salud, **centrado** (0xfc) | tabla ptr **0x1a6a** por letra record+0xb: `Good Health/Poisoned/Dead/Asleep/Charmed` |
| 3 | `Str=NN  HP:  NNNN` | `"Str="`=**0x96dc** (2·'0') · `"  HP:"`=**0x96e2** (HP +0x10, 4·' ') |
| 4 | `Int=NN  HM:  NNNN` | `"\nInt="`=**0x96e8** · `"  HM:"`=**0x96ee** (maxHP +0x12, 4·' ') |
| 5 | `Dex=NN  Ex:  NNNN` | `"\nDex="`=**0x96f4** · `"  Ex:"`=**0x96fa** (Exp +0x14, 4·' ') |
| 7 | `    Magic: NN` | `"\n\n    Magic:"`=**0x9700** (MP +0x0f, 2·**' '**) |

O sea `HM` = maxHP y `Ex` = Exp; `Magic:` = currentMP. Corrige la lista plana
"Str/HP/Int/MaxHP/Dex/Exp/MP" de S11.

### 8.2 ARMAS (`draw_arms_page` 0x02a8) — SÓLO armas (no hechizario)

Banner `►name◄` + título **`"Arms"`** subrayado y centrado (`"Arms\n\n"`=0x970e,
con 0xfc centrado y 0xfe subrayado). Luego los 6 slots +0x19..+0x1e (helm/armor/
manoA/manoB/anillo/amuleto) por NOMBRE (name-table 0x1962, `print_padded_string`
0x0278: `" "+nombre+"\n"`, se saltan los 0xff). Si TODOS vacíos → **`"(None ready)"`**
(0x9716). **NO hay hechizario aquí** — la nota previa (§2) lo inventó; el asm
0x02a8 sólo pinta los 6 slots. (`e.spells` del contrato queda sin usar.)

### 8.3 PROVISIONES (`draw_provisions` 0x039c)

Banner **`►Equipment◄`** (0x9724). Filas: `" Food: "`(0x972e)+food(4·' '),
`" Gold: "`(0x9738)+gold(4·' '); tras línea en blanco, `" Keys......."`(0x9742,
7 puntos)+keys(2·' '), `" Gems......."`(0x9752)+gems, `" Torches...."`(0x9760,
4 puntos)+torches; `" Grapple"`(0x976e) sólo si g_grapple≠0. Los puntos de relleno
alinean la columna de valor a la celda 14.

### 8.4 LISTAS (`render_item_list` 0x06e8) — con PERGAMINO

El TÍTULO es el BANNER (0x6c70), NO va dentro del marco. Títulos EXACTOS:
`0x97ac`=**Reagents**, `0x97b6`=**Spells**, `0x97be`=**Items**, `0x97c4`=**Armaments**
(corrige "Items/Quest Items/Equipment" de §2). Lista vacía → **`"(None owned!)"`**
(0x9794), NO "Nothing!". Decoraciones de prefijo (§5) con sus cadenas reales:
`*`→`0x977c` (glifo 0x1c+`" + "`), `!`→`0x9782` (glifo 0x1d+`" + "`), `(`→`0x9788`
(`"Moonstone "`); qty==0→`0x9778` (`"--"`).

### 8.5 Matriz de teclas FINAL (con la semántica del usuario)

- **CERRADO:** sólo `Z` abre → modo SELECT (candidato 0).
- **SELECT:** ↑/← y ↓/→ mueven el candidato (circular en la party); `1`-`6` eligen
  directo; Enter/Space confirman → ficha de stats (member*2); ESC cierra. (El asm
  del picker 0x4b9a vive en el kernel; la matriz de SELECT es conducta observada —
  ground truth del usuario, ref 01/07.)
- **PAGE (eje §2):** Space/ESC cierran; en páginas SIN pergamino (stats/armas/
  provisiones) las **4 flechas ciclan** el eje; en páginas CON pergamino (4 listas)
  ←/→ **cambian de página** y ↑/↓ **scrollean SÓLO si hay overflow** (si todo cabe,
  ↑/↓ ciclan el eje como fuera de una lista — refina §3); PgUp/PgDn=7, Home/End a
  los bordes; `1`-`6`→ficha de miembro, `0`→provisiones. (Verificado contra el
  dispatch 0x0a8f/0xaa6/0xaea y 0x81c/0x86c.)

Implementación: `game/src/skin/fiel/ztats.ts` (renderStatPage/renderArmsPage/
renderProvisionsPage/renderItemListPage/ztatsBannerText/ztatsKeyReducer con modo
select+page) y el banner/select en `skin.ts`.

### 8.6 Consola del comando Z (RUTA CORE) + ola persistente

La línea de consola del comando Z sale por el **flujo normal de consola del juego**
(`pushConsole`), como en el original — no es overlay de piel. Como la piel fiel
intercepta Z en su propio keyHandler (captura), el comando NO pasa por el dispatcher
del core; para que las líneas sean output real en cualquier piel, la piel las emite
por un `Intent` nuevo `{type:"console",text,kind}` (api.ts) que el sink de main.ts
enruta al mismo `pushConsole`:
- Abrir (→select): eco **`"Z-stats..."`** (cmd-strings 0xa28c).
- Elegir jugador (select→page): **`"Player: <nombre>"`** (0x96b4) + **`"Status: "`**
  (0x97a2). La OLA (`CONSOLE_CURSOR_WAVE`) se pinta tras "Status:" toda la pantalla de
  ztats (gate `showWave = promptActive || ztats!=null`, ztats-refs/07). Verificado
  contra ref 07.

**Pendiente (menor):** (a) la línea transitoria `"Player: "` DURANTE la selección
(ref 01) — el `pushConsole` es append-only y no puede actualizar la línea in situ al
elegir; necesitaría un primitivo "reemplaza última línea" en el CoreView; ahora en
select la ola queda tras "Z-stats...". (b) El subrayado real de "Arms" (0xfe) — el
modelo de rejilla de glifos no tiene canal de atributo; necesitaría un modo de
subrayado en la capa de fuente/blit. Todo lo demás es píxel-fiel a las refs 01-07.
