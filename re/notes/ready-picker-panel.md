# El panel de (R)eady — derivación completa, y el estado de su FAMILIA

> Derivación del PANEL del comando (R)eady: cabecera, name-table del equipo, columna de
> cuenta con su modo real, separador y alcance rúnico. Sujeto = BINARIO. Offsets =
> `re/disasm/{ZSTATS,CMDS,SHOPPES3}.OVL.asm` y `re/disasm/ULTIMA.EXE.asm`; cadenas =
> volcado de `DATA.OVL` (`fileoff = DS + 0x10`).
>
> Origen: el carril `usepicker-fidelidad` (#149) derivó el panel de (U)se y dejó UN CABO
> apuntando aquí — «el `--` es INALCANZABLE en el picker de (U)se … es del picker de
> (R)eady, que pasa un índice de PJ como modo» (`use-picker-panel.md` §3). Esta nota
> cierra ese cabo derivando el hermano entero, y de paso el estado de la FAMILIA de
> paneles que comparten el panel derecho (§7).
>
> ★ Todos los `call` pelados con destino ≥ tamaño del overlay están resueltos con
> `re/tools/dispatch_table.py` (base ZSTATS `0xE1E0`, CAST `0xBF80`, CMDS `0xBF80`,
> SHOPPES3 `0xE1E0`). Control positivo del corpus: `ZSTATS 0x3abe → 0x1c9e`, el kernel
> del thunk de fuente que #149 ya había acreditado.

## 1. `cmd_ready` (ZSTATS.OVL 0x1296) — quién pinta qué

```
129c: sub ax,ax / push ax / call 0        ; select_party_member → consola "Player: " (0x96b4)
12a5: or ax,ax / jl 0x130b                ; ESC/None → no abre nada
12a9: push 0xffff / push 0x30 / push 0x57c0 / push [bp-4]
12b8: call 0x5a4                          ; find_next_owned(charIdx, 0x57c0, 48, -1)
12be: cmp ax,0xffff / jne 0x12cc
12c3:   push 0x997e / call 0x3670         ; "Thou art empty-\nhanded!\n" → CONSOLA, y SALE
12cc: push 0x9998 / call 0x3670           ; "Item: "  → CONSOLA
12dd: ax = [bp-4]<<5 + 0x55a8             ; ★ el REGISTRO del PJ (32 B, empieza por el nombre)
12e8: call 0x6c70                         ; = ULTIMA.EXE 0x4e50 draw_panel_banner
12eb: push 8 / call 0x45e                 ; draw_list_frame(8) → 7 filas de contenido
12f2: push start / push [bp-4] / push 0x52 ; ★ el MODO es el índice de PJ
12fc: call 0xf2e                          ; item_page_controller, modo 'R'
```

★★ **La CABECERA del panel de (R)eady es el NOMBRE DEL PJ, y sale por LA MISMA rutina
que pinta «Items:» en (U)se.** `ZSTATS 0x6c70` y `CAST 0x8ed0` resuelven los dos a
`ULTIMA.EXE 0x4e50` (con sus bases 0xE1E0 y 0xBF80): centra la cadena en la banda
superior del panel y la enmarca en `►…◄` (`4e63 sub ax,0x1e / 4e66 neg ax` = col
`30 − len/2`; los dos remates con `call 0xaa6`; el texto con `set_active_window(0)` +
`set_cursor(row 0, col)` + `call 0x1850`). Mismo banner, distinto texto — y en (R)eady el
texto es un DATO, no una cadena de DATA.OVL.

## 2. `item_page_controller` 0x0f2e — los argumentos que cambia el modo

```
0f40: cmp [bp+4], 0x52 ('R')
0f46:   sí → qty=0x57c0, count=0x30       ; tabla de EQUIPO, 48 entradas
0f54:   no → qty=0xb9ee, count=0x26       ; tabla EXTENDIDA de (U)se, 38
…
0f87: push 0x1962   ← name-table de EQUIPO      (rama 'R', vía 0x0f7c/0x0f81)
0f96: push 0x1916   ← name-table de (U)se       (rama 'U')
0f9e: call 0x5e2    ← print_list_row, EL MISMO para los dos
```

⇒ (R)eady y (U)se **no son dos rutinas de fila: son el mismo `call 0x5e2` con distintos
argumentos**. La única diferencia que se decide POR FILA es el separador (§3).

## 3. ★★ El separador — lo que (R)eady tiene y nadie más

```
104b: 837e0452  cmp word ptr [bp + 4], 0x52     ; ¿modo 'R'?
104f: 7403      je 0x1054
1051: e93cff    jmp 0xf90                       ; modo 'U' → sep FIJO 0x20
1054: ff7606    push word ptr [bp + 6]          ; charIdx
1057: ff76f0    push word ptr [bp - 0x10]       ; itemIdx
105a: e8bbf4    call 0x518                      ; is_item_equipped
105f: 7503      jne 0x1064
1061: e918ff    jmp 0xf7c                       ; NO equipado → sep = 0x20
1064: 8b5ef0    mov bx, word ptr [bp - 0x10]
1067: 8a87e81a  mov al, byte ptr [bx + 0x1ae8]  ; ★ EQUIPADO → sep = GLIFO DE CLASE
106d: 8946f6    mov word ptr [bp - 0xa], ax
```

Y en `print_list_row` el separador tiene **su propia rama de fuente**, que hasta ahora
nadie ejercía:

```
0615: 837e0420  cmp word ptr [bp + 4], 0x20
0619: 7307      jae 0x622                  ; ≥0x20 → tal cual, en IBM.CH
061b: b80100    mov ax, 1
061f: e89c34    call 0x3abe                ; set_font(RUNES.CH)
0622: ff7604    push word ptr [bp + 4]
0625: e8b22e    call 0x34da                ; putchar(sep)
0628: 2bc0      sub ax, ax
062b: e89034    call 0x3abe                ; set_font(IBM.CH)
```

Volcada la tabla `DS 0x1ae8` (48 bytes) sale:

```
01 01 01 01 02 02 02 02 02 03 03 03 03 03 03 03 04 05 06 07 04 08 09 0b
0c 1e 0f 17 10 17 0b 11 12 13 14 15 16 15 17 15 15 15 18 18 18 19 1a 1b
```

**TODOS entre 0x01 y 0x1e** ⇒ `< 0x20` sin excepción ⇒ **el marcador de equipado de
(R)eady sale de RUNES.CH SIEMPRE, y sale por la rama @0x0615 de `print_list_row`, no por
una regla propia de (R)eady.** Agrupada por clase en la cabeza (4 cascos → 0x01, 5
escudos → 0x02, 7 armaduras → 0x03) y con glifo propio por arma.

★ Esto CIERRA por el crudo lo que #149 §8 sólo pudo cerrar con un testigo: la fila
`--♥Chain` de la captura DOS. Chain = id 0x0d y `0x1ae8[0x0d] = 0x03`; ♥ es
`RUNES.CH[0x03]` y `IBM.CH[0x03]` es un triángulo. El testigo y la tabla dicen lo mismo.

**Los otros dos llamadores no ejercen la rama**: `render_item_list` @0x0765 empuja `0x2d`
y el picker de (U)se @0x0f9a empuja `0x20`. Por eso el calco del port (`listRowCells`) no
la tenía: estaba LATENTE. Es el patrón de #149 otra vez — una rama del `print_list_row`
que sólo un llamador toca, y ese llamador estaba escrito aparte.

## 4. La columna de cuenta — los tres estados, y cuál toca aquí

`print_list_row` @0x05f5 tiene tres estados: `0xff` ⇒ NI número NI separador (cero
celdas); `0` ⇒ `--` (DS 0x9778); resto ⇒ 2 dígitos con pad ESPACIO.

★★ **En (R)eady el estado `0xff` es INALCANZABLE, exactamente como el `--` lo es en
(U)se.** La tabla 0x57c0 la topan sus TRES escritores en `0x63` = 99:

| sitio | instrucciones |
|---|---|
| SJOG.OVL 0x1693 | `inc byte [bx+0x57c0]` / `1697: cmp byte [bx+0x57c0],0x64` / `169e: mov byte [bx+0x57c0],0x63` |
| SHOPPES.OVL 0x0a5e | `cmp byte [si+0x57c0],0x63` / `0ac1: mov byte [si+0x57c0],0x63` |
| ZSTATS.OVL 0x0ccd | `cmp byte [bx+0x57c0],0x63` / `0cd2: jae` / `0cd4: inc byte [bx+0x57c0]` |

⇒ el byte vive en `[0, 99]` y nunca vale `0xff`. **Toda fila de (R)eady gasta las 3
celdas de la columna** (2 dígitos + separador) y el nombre arranca en la celda 3.

Y el `--` **sí** es alcanzable, por el modo: `find_next_owned` @0x05a4 acepta un índice
de cuenta 0 cuando el modo no es 0xff y el ítem está equipado —

```
05ba: 803800    cmp byte ptr [bx + si], 0
05bd: 750f      jne 0x5ce                  ; cuenta ≠0 → aceptado
05bf: 81ffff00  cmp di, 0xff               ; ¿modo = 0xff (el de (U)se)?
05c3: 74ea      je 0x5af                   ;   sí → SALTA (por eso allí no hay `--`)
05c5: 57 56     push di / push si
05c7: e84eff    call 0x518                 ; is_item_equipped(charIdx, itemIdx)
05cc: 74e1      je 0x5af                   ; no equipado → salta
```

— y `is_item_equipped` @0x0518 compara el itemIdx contra los **SEIS** slots del registro
del PJ, offsets `[bx+0x19]`..`[bx+0x1e]` (`052d`, `0537`, `053f`, `0547`, `054f`, `0557`).

## 5. La name-table de equipo (DS 0x1962, 48 punteros WORD), volcada

`Leath Helm · Chain Coif · Iron Helm · Spkd. Helm · Sm. Shield · Lg. Shield · Spkd. Shld
· Mag. Shld · Jewel Shld · Cloth · Leather · Ring Mail · Scale · Chain · Plate · Myst.
Armr · Dagger · Sling · Club · Flame Oil · Main Gauch · Spear · Thrwng Axe · Sht. Sword ·
Mace · Morn. Star · Bow · Arrows · Crossbow · Quarrels · Long Sword · 2H Hammer · 2H Axe ·
2H Sword · Halberd · Chaos Swrd · Magic Bow · Silver Swd · Magic Axe · Glass Swrd · Jewel
Swrd · Myst. Swrd · Inv. Ring · Prot. Ring · Regen Ring · Am/Turning · Sp. Collar · Ankh`

★ **El ancho DICTA las abreviaturas**, igual que en la tabla de (U)se pero con otro tope:
la fila mide 14 celdas y arranca en la col 1 del marco ⇒ 13 de contenido; como la columna
de cuenta nunca se oculta (§4), al nombre le quedan **10**. Ninguno se pasa y **22 miden
10 justas**. (En (U)se el tope es 13 porque allí la columna sí desaparece — misma
aritmética, distinto resultado, y las dos tablas encajan exactas en la suya.)

★★ **NINGUNO de los 48 lleva sigilo `*`/`!`/`(`** (censo del volcado, 0 de 48). Las tres
ramas de sigilo de `print_list_row` —las que encienden RUNES.CH sobre el NOMBRE— no se
ejercen jamás en (R)eady. **Lo único rúnico de una fila de (R)eady es el separador.**

## 6. ★★ `0xfd` NO es un glifo: es el toggle de VÍDEO INVERSO del `putchar`

El `putchar` del kernel (`0x16ba`) desvía todo `> 0x7f` a una tabla de CINCO códigos de
control, y ninguno pinta celda ni avanza el cursor:

```
16cd: cmp dl,0x7f / 16d0: jbe 0x16d5 / 16d2: jmp 0x176e   ; ruta de CONTROL
176e: cmp dl,0xff / je 0x17bb    ; borrar ventana + home
1773: cmp dl,0xfe / je 0x17b0    ; xor [0x53a4],1  → SUBRAYADO
1778: cmp dl,0xfd / je 0x17a5    ; xor [0x53a8],1  → ★ VÍDEO INVERSO
177d: cmp dl,0xfc / je 0x1799    ; centrado ON
1782: cmp dl,0xfb / je 0x178d    ; centrado OFF
17a5: 8336a85301  xor word ptr [0x53a8], 1
17aa: 80740704    xor byte ptr [si + 7], 4
17ae: ebb7        jmp 0x1767     ; → pop/ret: NI pinta NI avanza
```

y `[0x53a8]` se consume en el blit del glifo invirtiendo su bitmap:

```
182f: 833ea85300  cmp word ptr [0x53a8], 0
1834: 7419        je 0x184f
1845: 26f715      not word ptr es:[di]      ; ← el vídeo inverso, por construcción
1848: 83c702      add di, 2
184b: e2f8        loop 0x1845
```

Esto resuelve DOS cosas de golpe:

1. **La barra de selección de (R)eady/(U)se es un par ON/OFF simétrico alrededor de la
   fila del cursor**: `0x103e putchar(0xfd)` ANTES de imprimirla y `0x0fb5 putchar(0xfd)`
   DESPUÉS (tras `set_cursor(fila, 1)` @0x0fa9, con `get_row()-1 == [bp-0xe]` como
   predicado). Como el contenido se imprime desde la col 1 (`set_cursor(1,1)` @0x0f6d) y
   `print_list_row` rellena hasta la col 14 (@0x06b9-0x06d7), **la barra cubre exactamente
   las cols 1..13 de la fila seleccionada** — que es lo que el port ya pintaba.
2. **La marca de (M)ix estaba mal leída** (§7).

## 7. Estado de la FAMILIA de paneles del panel derecho

| panel | rutina del binario | ¿`print_list_row`? | ¿marco? | ¿banner 0x4e50? | ¿rúnico? | estado |
|---|---|---|---|---|---|---|
| (U)se | CAST 0x1792 → ZSTATS 0x0f2e modo 'U' | **sí** (sep 0x20) | sí, 7 filas | «Items:» DS 0x48b8 | sí (sigilos) | fiel desde #149 |
| **(R)eady** | ZSTATS 0x1296 → 0x0f2e modo 'R' | **sí** (sep = glifo) | sí, 7 filas | **nombre del PJ** | sólo el separador | **corregido aquí** |
| Ztats «Items» | ZSTATS 0x06e8/0x0765 | **sí** (sep 0x2d) | sí, 7 filas | título del eje | sí (sigilos) | fiel |
| tienda «Arms» | SHOPPES 0x0c80 `list_wares` | no (propia) | sí, 4 filas | «Arms» | no | fiel (carril buy-herrero) |
| **(M)ix** | CMDS 0x18be `mix_reagent_select` | no (propia) | **NO** | «Reagents:» DS 0x8f64 | **no** | **corregido aquí** |
| posada «GUEST REGISTER» | SHOPPES3 0x04e6 | no (propia, marco inline) | sí, 7 filas | **ninguno** | no | fiel; 1 bug de conducta corregido |

### 7.1 (M)ix — tres correcciones

**(a) NO lleva pergamino.** Negativa fuerte con la ventana cubriendo el fenómeno: en las
**189 instrucciones** del cuerpo de `mix_reagent_select` (0x18be `push bp` .. 0x1a6f
`ret`) no hay UN solo `putchar` de glifo de caja (0x10..0x17) — los únicos inmediatos de
esa banda son las COORDENADAS de los dos `set_text_window` (0x18/0x26/0x27 @0x18f0,
0x18f8, 0x190e, 0x1916) — y su **único** llamador (`cmd_mix` @0x1b5d, censado sobre el
binario entero) tampoco pinta marco antes de entrar: sus `putchar` de 0x18/0x19/0x1a/0x1b
@0x1b41-0x1b53 son las CUATRO FLECHAS del pie de instrucciones, cada una seguida de una
coma (0x2c). Lo que Mix pinta es `putchar(0xff)` = borrar-ventana+home (@0x1903), el
puente del panel (@0x1921 → kernel 0x4efc) y el banner `►Reagents:◄` (@0x1924 → 0x4e50); y
luego un FLUJO de texto.

★ **La aritmética lo confirma sola** — y de paso cierra el cabo (b) que `mix-flow-acta.md`
dejó abierto («el panel corta el 8º reagente … hace falta medir el testigo»). La ventana
es (24,1)-(39,9) = 9 filas; el bucle emite `\n` ANTES de cada fila, así que los reagentes
caen en las filas rel 1..8 y el octavo da `8 + top(1) = 9 ≤ bot(9)`, sin disparar el
scroll del emisor (@0x174f `cmp al,[si+3] / 1752: jle`). **Los 8 caben EXACTOS — sin
marco. Con marco sólo caben 7**, que era el síntoma. La cota y el marco eran el mismo bug
visto por dos sitios.

**(b) La marca de selección ocupa UNA celda, no tres.** El port escribía
`cells[3]=0xfd; cells[4]=0x0f; cells[5]=0xfd` — metía el byte de control como glifo y se
comía las dos primeras letras del nombre («Blk. Pearl» → «k. Pearl»). Por §6, la
secuencia @0x19ee-0x1a2c es **inverso ON · UNA celda (`0x0f` marcado / `0x20` no) ·
inverso OFF**, en la col 3 (`0x1a02 mov ax,3` + `0x1a06 lea ax,[si+1]` → `set_cursor`).
El nombre no se toca.

**(c) El origen de la fila es la col 0 de la ventana**, no la col 1: el `putchar(0x20)`
@0x1939 es el primer carácter del flujo, no el margen de un marco.

🔴 **Y una trampa que me mordió al portarlo**: la barra del cursor del binario es un
rectángulo **XOR** del driver, así que sobre ella la celda invertida se ve NORMAL — las
dos inversiones se componen. La barra del port es un relleno blanco OPACO, de modo que la
composición hay que hacerla a mano y **en las dos direcciones**; escrita como un solo
`black = !black`, la marca SOBRE la barra salía blanca sobre blanco = invisible. No lo vi
en la primera captura porque el fotograma que miré **no tenía ningún reagente marcado** —
el estado que instancia la diferencia. Las dos capturas que lo cierran son «marcado en la
fila del cursor» (compone a positivo: fondo negro, ☼ blanco) y «marcado fuera de la
barra» (compone a negativo: bloque blanco con el ☼ en hueco), con los nombres intactos en
las dos. La composición se verificó MIRANDO; el canal del modelo (`inverseCols`) sí tiene
guarda automática.

*(No modelado, declarado:* el binario no repinta la marca al mover el cursor, así que un
reagente des-marcado deja un **espacio invertido** —celda sólida— y uno marcado del que
el cursor ya se fue se ve en inverso. El port recompone la vista en cada publicación, así
que muestra el estado limpio. Clase C.*)*

### 7.2 Posada — fiel de estructura, con un bug de CONDUCTA

Derivada instrucción a instrucción (`SHOPPES3 0x04e6`, con control positivo de la
resolución cross-overlay sobre seis destinos acreditados), la ventana del port CASA: 15×9
(`set_text_window(1,0x18,1,0x26,9)` @0x0530), 7 filas de contenido con el marco emitido
INLINE (@0x0565-0x05d1, misma salida que `draw_list_frame(8)`), cabeceras `    GUEST` /
`  REGISTER:\n\n` (DS 0x4fc0/0x4fca) en (col 1, filas 1 y 2), nombres en la col 4 desde la
fila 4, barra XOR del driver (@0x064d → 0x0b86, `stc`), **sin banner** (`draw_panel_banner`
no se llama NUNCA desde SHOPPES3: 0 ocurrencias, con control positivo de 5 en ZSTATS) y
**sin un solo `set_font`** (0 en todo SHOPPES3, con control positivo de 7 en ZSTATS).

🔴 **Bug corregido**: con más huéspedes que huecos el port pintaba siempre los 4 primeros
y devolvía `barIndex: null` en cuanto el cursor pasaba del 4º; `drawInnRegister` hace
`if (barIndex == null) return`, así que **la barra desaparecía y el Enter cobraba a un
huésped sin marcar**. El original nunca la pierde (@0x06c3 `add di, 8`) y su ventana SÍ se
desplaza. Ahora la ventana de 4 se desplaza con el cursor.

🔴 **Premisa falsa corregida en su sitio**: la nota del port decía que «el 6º dispara el
scroll». Lo dispara el CRLF que sigue al **QUINTO** (@0x061c/0x0620 → @0x1742-0x1754:
9+top(1)=10 > bot(9)). Erraba por uno y hacía leer 5 como el techo sin daño cuando es 4.

### 7.3 Lo que queda SIN carear, y por qué

- **La geometría de la «ventana 2»** de la conversación de la posada (@0x062e
  `set_active_window(2)`): sé que es la ventana donde caen `"Who will check out?"`
  (DS 0x4fa7) y `No one` (DS 0x4fd8), pero no he trazado su `set_text_window` de
  inicialización. En esta nota «CONSOLA» significa *la ventana de la conversación*, no un
  rectángulo medido.
- **El aspecto exacto del original con ≥5 huéspedes** en la posada: está demostrado que el
  scroll DISPARA; no he simulado el resultado en píxeles.
- **El puente del filo del panel** (kernel 0x4efc pinta y56..63; el port pinta y57..62):
  probablemente equivalente porque y56/y63 ya son borde por los marcos vecinos, pero no lo
  he medido píxel a píxel. **No lo doy por cerrado.**
- **Cuentas ≥100 en (M)ix**: `[0x5850+i]` es un byte (0..255) y `print_number` con ancho 2
  no trunca — con 3 dígitos el nombre se correría una columna. El port topa en 99. No he
  censado si los escritores de reagentes topan como los de 0x57c0 (§4), así que **no
  adjudico** si el caso es alcanzable.

## 8. Qué se corrigió en el port

1. **Una sola rutina de fila**: la variante `ready` de `readyRowCells` **delega en
   `listRowCells`** (= `print_list_row`), como ya hacía `use` desde #149. Antes duplicaba
   el layout — la misma duplicación que dejó divergir (U)se durante meses.
2. **La rama de fuente del separador** (@0x0615) entra en `listRowCells`, que es donde el
   binario la tiene. `< 0x20` ⇒ RUNES.CH. Con control positivo a un byte del umbral.
3. **Afirmación rancia corregida** en `core/readyPicker.ts`: decía que los glifos de
   0x1ae8 «son códigos CP437 … el original los imprime con REALCE». Las dos mitades eran
   falsas y compartían raíz — el rótulo `set_highlight` que #149 refutó y que sobrevivió
   aquí porque este fichero no se tocó.
4. **(M)ix**: fuera el pergamino, marca de UNA celda en vídeo inverso, filas desde la col 0.
5. **Posada**: la ventana se desplaza con el cursor (la barra no se pierde nunca); y dos
   comentarios rancios corregidos con tachado-documentado (el «6º dispara el scroll», y el
   «⚠ NO portado» de `shop-console.ts` que el propio método contradice 40 líneas más abajo
   desde #283).

Guardas: `game/tests/ready-picker-panel-fiel.test.ts` (20 casos, esperados en crudo) +
los casos nuevos de `fiel-ready.test.ts` (Mix sin marco, con su control positivo) e
`inn-register-283.test.ts` (la barra nunca se pierde, con su control positivo). Los cinco
mutantes correspondientes se corrieron y los cinco mueren.
