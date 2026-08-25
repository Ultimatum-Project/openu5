# La familia de TECLAS DE CONTROL de los bucles de contexto — tabla derivada entera

> Sujeto: **el binario**. Deriva el despacho de códigos `< 0x20` de los tres bucles de
> contexto (MAINOUT / TOWN / DUNGEON), la **base de carga de los overlays** que hacía
> ilegible su tabla de saltos, y el formato EXACTO con que `Ctrl-K` imprime el karma.
>
> Supera a `command-dispatch.md` §5, que ya sabía que la tabla existía y enumeraba los
> códigos `0x05 / 0x0B / 0x13 / 0x16`, pero **no decía qué hace 0x0B** («0x0B, 0x13
> (toggle), 0x16 (versión)») ni resolvía la tabla. Aquí 0x0B queda nombrado: **karma**.

## 1. El problema de instrumento: `cs:[bx - 0x7272]` no se lee de memoria

```
MAINOUT.OVL
0b14: e881fa            call 0x598              ; tick_and_getkey
0b17: 8846fc            mov byte ptr [bp - 4], al
0b1a: 3c20              cmp al, 0x20
0b1c: 7203              jb 0xb21                ; < 0x20 ⇒ familia de control
0b1e: e9cd00            jmp 0xbee               ; ≥ 0x20 ⇒ dígitos / kernel_cmd_dispatch
0b21: 2ae4              sub ah, ah
0b23: 3d1600            cmp ax, 0x16
0b26: 7603              jbe 0xb2b               ; 0x00..0x16 ⇒ tabla (0x17 entradas)
0b28: e98d00            jmp 0xbb8               ; > 0x16 ⇒ "What?\n"
0b2b: 03c0              add ax, ax
0b2d: 93                xchg bx, ax
0b2e: 2effa78e8d        jmp word ptr cs:[bx - 0x7272]
```

`-0x7272 & 0xFFFF = 0x8D8E`, y **el overlay entero mide 0x1CB0** (7 344 B,
`MAINOUT.OVL` = 0x0000..0x1CAF, todo código). O sea: el desplazamiento del `jmp` **no es
un offset dentro del overlay**. Es un offset del **segmento de código completo**, y el
overlay está cargado en `CS:B` con `B ≠ 0`. Sin `B` la tabla no se puede leer, y el
disasm la enseña como basura plausible:

```
0bbe: c88c7a8d          enter 0x7a8c, -0x73     ; ← esto NO es código: son las 23 words
0bc2: 7a8d              jp 0xb51
0bc8: 188d888d          sbb byte ptr [di - 0x7278], cl
```

(La nota `globals-desplazamiento-negativo.md` ya avisaba de esta clase: 12 de sus «40
direcciones invisibles» eran **tablas de saltos con override `cs:`**, no globales de DS.)

## 2. Derivación de la base `B` — candidato ÚNICO, sin suponer nada

No se adivina `B`: se resuelve por **consistencia interna**. Si la tabla vive en el
offset de overlay `T`, entonces `B + T ≡ 0x8D8E (mod 0x10000)`, y las 23 entradas, que
son destinos DENTRO del propio overlay, deben cumplir `(E_i − B) & 0xFFFF < 0x1CB0`.
Se barren los 0x1CB0 valores posibles de `T`:

```python
d = open('original/u5/ultima5/MAINOUT.OVL','rb').read()          # 0x1cb0 B
for T in range(0, len(d) - 2*0x17 + 1):
    B    = (0x8D8E - T) & 0xFFFF
    ents = [struct.unpack_from('<H', d, T+2*i)[0] for i in range(0x17)]
    if all(((e - B) & 0xFFFF) < len(d) for e in ents):
        print(hex(T), hex(B))
```

Salida: **una sola solución** — `T = 0x0BBE`, **`B = 0x81D0`**.

### Cuatro controles positivos, independientes entre sí

1. **Los cinco `call` cruzados caen en prólogo.** Con `B = 0x81D0`, los destinos
   «externos» del bloque (`0x986e`, `0x9680`, `0x94ea`, `0xa49c`, `0x8124`) resuelven a
   `0x1A3E`, `0x1850`, `0x16BA`, `0x266C`, `0x02F4` de `ULTIMA.EXE`, y **los cinco**
   empiezan por `55 8b ec` (`push bp; mov bp,sp`). Tres de ellos ya tienen nombre en
   `routine-census.json`: `print_string` (0x1850), `emisor` (0x16BA) y
   `getkey_with_redraw` (0x266C).
2. **`0x81D0` es una frontera ya medida por otro carril**: `globals-negdisp-adjudicacion`
   sitúa la tabla PLINK del kernel en `[0x7780, 0x81D0)`. El área de overlays empieza
   justo donde acaba.
3. **TOWN.OVL da la MISMA base por su cuenta** (§4): su tabla, resuelta con el mismo
   barrido sobre otro fichero y otro desplazamiento (`cs:[bx-0x68de]`), sale también
   `B = 0x81D0`, candidato único.
4. **El mapeo de flechas cierra el círculo** (§3.1): los códigos 1–4 que la tabla manda a
   `move_party` coinciden uno a uno, en orden y en signo, con la tabla de traducción de
   scancodes de `kernel_getkey` (DS 0x540E→0x5416) — un dato que NO entró en la
   derivación.

## 3. La tabla de MAINOUT.OVL, entera

Tabla en `MAINOUT.OVL:0x0BBE` (23 words = 46 B, `0x0BBE..0x0BEB`), indexada por el
código de tecla × 2.

| código | tecla | destino | qué hace |
|---|---|---|---|
| `0x00` | (sin tecla) | `0x0AF8` | no-op: `[bp-8] = 0`, el turno **no** avanza |
| `0x01` | **←** | `0x0BAA` → `move_party(1)` | mover **West** (`x--`), imprime `"West\n"` |
| `0x02` | **→** | `0x0BAA` → `move_party(2)` | mover **East** (`x++`), imprime `"East\n"` |
| `0x03` | **↑** | `0x0BAA` → `move_party(3)` | mover **North** (`y--`), imprime `"North\n"` |
| `0x04` | **↓** | `0x0BAA` → `move_party(4)` | mover **South** (`y++`), imprime `"South\n"` |
| `0x05` | **Ctrl-E** | `0x0B48` | `"Exit to DOS? "` + `getkey_with_redraw`; `Y` ⇒ sale; si no, `"N\n"` |
| `0x06`–`0x0A` | — | `0x0BB8` | `"What?\n"` |
| `0x0B` | **Ctrl-K** | `0x0B34` | **imprime el KARMA** (§3.2) |
| `0x0C`–`0x12` | — | `0x0BB8` | `"What?\n"` |
| `0x13` | **Ctrl-S** | `0x0B80` | `"Sound "` + `"On\n"`/`"Off\n"`, y **toggle** del flag |
| `0x14`, `0x15` | — | `0x0BB8` | `"What?\n"` |
| `0x16` | **Ctrl-V** | `0x0B6E` | imprime `"1.16"` (versión) + `'\n'` |
| `> 0x16` | — | `0x0BB8` (por `0x0B28`) | `"What?\n"` |

Las cadenas se resuelven sobre `DATA.OVL` con la fórmula canónica de
`dataovl-strings.md`, **`fileoff = DS + 0x10`** (control positivo de la fórmula:
`DS 0xA142` → `"Cast...\n"`):

| DS | fileoff | contenido |
|---|---|---|
| `0x2B3E` | `0x2B4E` | `"Exit to DOS? "` |
| `0x2B4C` | `0x2B5C` | `"N\n"` |
| `0x2B4F` | `0x2B5F` | `"1.16"` |
| `0x2B54` | `0x2B64` | `"Sound "` |
| `0x2B5B` | `0x2B6B` | `"Off\n"` |
| `0x2B60` | `0x2B70` | `"On\n"` |
| `0x2B64` | `0x2B74` | `"What?\n"` |

Mnemónicos: **E**xit, **K**arma, **S**ound, **V**ersion.

### 3.1 Los códigos 1–4 son las FLECHAS (no «Ctrl-A..Ctrl-D»)

`kernel_getkey` (`ULTIMA.EXE:0x1D5E`) traduce el scancode extendido por dos tablas
paralelas de 8 bytes, `DS 0x540E` (scancodes) y `DS 0x5416` (códigos):

```
0x4B ←  -> 0x01      0x47 Home -> 0xD3
0x4D →  -> 0x02      0x4F End  -> 0xD4
0x48 ↑  -> 0x03      0x49 PgUp -> 0xD5
0x50 ↓  -> 0x04      0x51 PgDn -> 0xD6
```

y `move_party` (`MAINOUT.OVL:0x0490`) despacha `1→West`, `2→East`, `3→North`, `4→South`
(`dec [bp-4]` / `inc [bp-4]` / `dec [bp-6]` / `inc [bp-6]` con las cadenas
`DS 0x29EF/0x29E9/0x29DB/0x29E2`). **Coinciden**. Que Ctrl-A..Ctrl-D produzcan los
mismos bytes es un efecto colateral del teclado, no una intención del diseño.

### 3.2 `Ctrl-K` — qué imprime EXACTAMENTE

```
0b34: a08858            mov al, byte ptr [g_karma]   ; DS 0x5888, byte
0b37: 2ae4              sub ah, ah                   ; extensión CERO (nunca negativo)
0b39: 50                push ax                      ; arg3 = valor
0b3a: b80100            mov ax, 1
0b3d: 50                push ax                      ; arg2 = ancho de campo = 1
0b3e: b82000            mov ax, 0x20
0b41: 50                push ax                      ; arg1 = carácter de relleno = ' '
0b42: e8298d            call 0xffff986e              ; → ULTIMA.EXE:0x1A3E
0b45: eb2e              jmp 0xb75
...
0b75: b80a00            mov ax, 0xa
0b78: 50                push ax
0b79: e86e89            call 0xffff94ea              ; emisor('\n')
0b7c: e979ff            jmp 0xaf8                    ; [bp-8] = 0  ⇒ NO consume turno
```

`ULTIMA.EXE:0x1A3E` es `print_number_padded(padchar, width, value)` (`ret 6`, y el
llamador **no** ajusta `sp` — control positivo de que son 3 args):

- `width` se recorta a `≤ 0x27`;
- si `value < 0` pone `'-'` (irrelevante aquí: `sub ah,ah` deja `0..255`);
- cuenta dígitos contra `DS 0x5404..0x540B` = `{10, 100, 1000, 10000}`, y emite dividiendo
  por `DS 0x5400 + 2·ndígitos` sobre la tabla `{0, 1, 10, 100, 1000, 10000}` ⇒ **decimal**;
- rellena `width − ndígitos` con `padchar`. Con **`width = 1`** el relleno es siempre
  `≤ 0` ⇒ **cero relleno**;
- termina en NUL y llama a `print_string`.

⇒ **`Ctrl-K` imprime el karma como decimal PELADO, sin rótulo, sin relleno, sin signo, y
un salto de línea detrás. Y no consume turno.** El `>` que se ve delante en pantalla es el
prompt que el propio bucle emite antes de leer la tecla (`tick_and_getkey`
`MAINOUT.OVL:0x05C6-0x05D7`: `emisor('\n')` + `call 0x4C2A`), no lo pone este handler.

El karma es un byte `0..99`: `CAST2.OVL` recorta a `0x63` en sus tres sumadores
(`0x0B95`, `0x0C90`, `0x0D0A`) y `SJOG`/`CMDS` saturan por abajo a 0.

### 3.3 `Ctrl-S` — el toggle, y en qué sentido

```
0b87: cmp byte ptr [g_unk_a9ce], 0
0b8c: je 0xb94
0b8e: mov ax, 0x2b5b        ; "Off\n"   ← flag ≠ 0
0b94: mov ax, 0x2b60        ; "On\n"    ← flag == 0
...
0b9b: cmp byte ptr [g_unk_a9ce], 1
0ba0: sbb ax, ax
0ba2: neg ax
0ba4: mov byte ptr [g_unk_a9ce], al     ; flag = (flag == 0) ? 1 : 0
```

`sbb ax,ax; neg ax` tras `cmp flag,1` da `1` si `flag == 0` y `0` si no ⇒ toggle limpio.
El mensaje anuncia el **estado NUEVO**: con `flag = 0` (sonido apagado) dice `"On"` y pasa
a 1. ⇒ **`g_unk_a9ce = 1` es sonido ENCENDIDO**, y `INTRO.OVL:0x098E` lo arranca en 1.
Lo leen además `BLCKTHRN`, `CMDS`, `COMBAT`, `DUNGEON`, `TOWN` y cuatro sitios del kernel
(21 refs en total): es el interruptor global de efectos.

### 3.4 El «`>`» de delante NO lo pone el handler

En pantalla la fila se lee `>92`, no `92`. Ese `>` es el **prompt del bucle**, y el orden
que lo produce está en `tick_and_getkey`:

```
MAINOUT.OVL
05c6: cmp byte ptr [0x5956], 0
05cb: je 0x5d7
05cd: mov ax, 0xa / push / call 0xffff94ea    ; emisor('\n')  ← cierra la fila anterior
05d4: e883c4  call 0xffffca5a                 ; → ULTIMA.EXE:0x4C2A: pinta el prompt
05d7: mov byte ptr [0x5956], 1
...
06dc: e8bd9d  call 0xffffa49c                 ; getkey_with_redraw ← la tecla se lee AQUÍ
```

Salto de línea → prompt → **después** se lee la tecla → el handler imprime. Como ningún
handler de la familia emite un `'\n'` **delante** de su texto, lo que imprimen cae
**sobre la fila del prompt**, detrás del `>`. Es decir: en el modelo de consola del port,
esa fila es de **COMANDO (`echo`)**, no de mensaje.

Y el prompt **sí se emite como carácter**, sólo que no es `'>'`: dentro de `0x4C2A`,

```
4c7a: b80200            mov ax, 2
4c7d: 50                push ax
4c7e: e839ca            call 0xffff16ba        ; emisor(2)  ← el glifo del prompt
```

es decir **el código 0x02 de la fuente del juego**, que es el triangulito ► que se lee
como `>` en pantalla. Eso es exactamente lo que el port ya modela:
`game/src/skin/fiel/console.ts` — `export const CONSOLE_BULLET_CODE = 0x02;` («Glifo del
BULLET ► de eco de comando (IBM.CH code 0x02)»). ⇒ la fila de la familia Ctrl es una fila
`kind:"echo"` del port **por derivación**, no por parecido.

🔴 Detalle de instrumento, porque el atajo obvio da el veredicto invertido: buscar quién
emite el carácter `'>'` (**0x3E**) por el corpus devuelve **un solo sitio, y es un falso
positivo** — `ULTIMA.EXE:0x4F4F` `mov ax,0x3e` dentro de `box_border_painter`, donde 0x3E
es una **coordenada** (62), no un carácter. Quien cense por el ASCII del glifo que ve en
pantalla concluye «nadie imprime el prompt» y se lo atribuye al pintor de filas. El glifo
en el que hay que buscar es el de la FUENTE (0x02), no el de ASCII. Quien concluya «nadie imprime `>`» desde
ese grep se lleva el veredicto invertido.

## 4. La MISMA familia en los otros dos bucles

`command-dispatch.md` §5 dice «mismo patrón en los tres». Medido:

**TOWN.OVL** — tabla en `0x1552`, `jmp word ptr cs:[bx - 0x68de]` (= `CS:0x9722`), con
`sub ax,1` delante ⇒ **0x16 entradas para los códigos 1..0x16**. Barrido idéntico al de
§2: candidato **único**, y la base sale **`0x81D0` otra vez**.

| código | destino | qué |
|---|---|---|
| `0x01`–`0x04` | `0x1532` | movimiento |
| `0x05` | `0x14CC` | `"Exit to DOS? "` (`DS 0x2898`) |
| `0x0B` | `0x14B8` | **karma** — `push karma; push 1; push 0x20; call 0x986E` (idéntico) |
| `0x13` | `0x1508` | sonido |
| `0x16` | `0x14F8` | versión (`DS 0x28A9`) |
| resto | `0x1544` | `"What?\n"` |

**DUNGEON.OVL** — no usa tabla sino cadena de `cmp` (`0x06C4`):
`0x0B → 0x06F2` (**karma**, mismo trío de argumentos y `emisor('\n')` detrás),
`1..4 → 0x0744` (movimiento), `0x05 → 0x0710` (salir), `0x0D → 0x0744`,
`0x13 → 0x0776` (sonido), `0x16 → 0x073A` (versión), `0x2E → 0x0744`,
`'0'..'9' → 0x07CB`, resto → `0x07A0` (dispatcher del kernel).

⇒ **`Ctrl-K` funciona en exterior, en poblado y en mazmorra.** No es una tecla del mapa
grande: es de los tres bucles de contexto.

## 4-bis. SON CUATRO BUCLES, y el cuarto NO tiene la misma familia

La frase «los tres bucles de contexto» (uno por overlay de nivel 1) es de
`command-dispatch.md` §5 y es correcta **para lo que ella describe**. Pero el **combate**
también lee teclas, con su bucle propio (`COMBAT.OVL:0x063E`, `getkey` en `0x0838`), y
ahí la familia **no está entera**. El despacho es una cadena de `cmp`, no una tabla:

```
0838: call 0x83dc            ; getkey
084a: cmp ax,0x4a  → 'J'     0x097a
0857: cmp ax,0x41  → 'A'     0x08e0
0864: cmp ax,0x1b  → ESC     0x09dc
0871: cmp ax,1   jae →
0879:   cmp ax,4  jbe → 0x0a14   ; 1..4 = movimiento
0881:   cmp ax,0x13 je → 0x08b6  ; ← Ctrl-S (Sound), lo ÚNICO de la familia
0886:   jmp 0x0ab7                ; ← TODO LO DEMÁS: "What?\n" (DS 0x6ee6)
```

Su handler de sonido (`0x08B6`) es el mismo mecanismo palabra por palabra —
`cmp a9ce,0` para elegir el rótulo, `cmp a9ce,1; sbb ax,ax; neg ax` para conmutar— sobre
**copias** del pool: `"Sound "` `DS 0x6DE4`, `"Off\n"` `0x6DEC`, `"On\n"` `0x6DF2`
(texto idéntico al de MAINOUT).

**Ctrl-K NO existe en combate**, y el discriminante es un censo, no una lectura: `g_karma`
(`DS 0x5888`) tiene **cero referencias en todo `COMBAT.OVL`**, frente a las de
`MAINOUT 0x0B34` / `TOWN 0x14B8` / `DUNGEON 0x06F2`. Ctrl-K, Ctrl-V y Ctrl-E en combate
caen en `0x0AB7` = `"What?\n"`.

La base de carga de `COMBAT.OVL` **no es 0x81D0**: sus dos tablas de letras
(`cs:[bx-0x52a2]` en `0x0ACE` para `'B'..'I'`, `cs:[bx-0x5278]` en `0x0AF8` para
`'K'..'Q'`) resuelven **las dos con `B = 0xA290`**, y el control positivo es externo:
con esa base el índice 6 de la segunda tabla da `'Q' → 0x0A78`, que es exactamente lo
que ya citaba el port (`main.ts`, rama F5 de combate) derivado por otro carril.

## 5. Testigo en material de EA (mirado, no supuesto)

Let's play español, episodio 17 del canal (`[16] - Infiltrándonos…`). El jugador pulsa la
tecla dos veces y lee el número en voz alta; el log del juego enseña, en su propia línea:

- **`>84`** en `00:04:47` — justo tras liberar al primer prisionero
  («*liberado hemos liberado a un hombre esto mejora nuestro karma*», 04:47).
- **`>92`** en `00:25:18` — tras el segundo
  («*liberarlo con esto me sube el Karma a 92*», 25:15→25:19).

Las dos líneas son **el número solo**, sin rótulo, detrás del `>` del prompt — que es
exactamente lo que predice §3.2. (Los fotogramas no se commitean: REGLA 4.)

## 6. Estado en el port, y qué corrigió este carril

**La familia ya estaba portada** (`handleCtrlKey`, `game/src/main.ts`, commit `8b11f5d1`)
para los TRES bucles de mapa, con las citas correctas de handler y de string. Lo que esta
derivación destapó y quedaba mal:

1. **El bucle de COMBATE no tenía guard de `Ctrl` NINGUNO.** `handleCtrlKey` se llamaba
   desde `handleGameKey` y `handleDungeonKey`, y `handleCombatKey` se quedó fuera. Como
   ese bucle llamaba a `preventDefault()` incondicionalmente y sus ramas miran
   `key.toLowerCase()`, **doce** comandos de combate quedaban secuestrados por su combo:
   Ctrl+A (A)ttack, Ctrl+C (C)ast, Ctrl+R (R)eady, Ctrl+U, Ctrl+K, Ctrl+Q, Ctrl+G,
   Ctrl+O, Ctrl+J, Ctrl+S, Ctrl+P, Ctrl+Y — varios **consumiendo turno**, y con los
   atajos del navegador robados de paso (Ctrl+R no recargaba). Es el mismo hijack de
   Ctrl+K→Klimb que `8b11f5d1` arregló en los otros dos y aquí no llegó.
2. **Faltaba Ctrl-S en combate** — el único miembro de la familia que ese bucle sí tiene
   (§4-bis). Ahora `handleCtrlKey` toma un `ctx`, y en `"combat"` atiende Ctrl-S y nada
   más; K/V/E devuelven `false` porque en 1988 tampoco están ahí.
3. **Los cuatro imprimían en fila de MENSAJE, no de COMANDO** (§3.4): el port sacaba
   `92` en fila nueva, sin bullet, donde el original saca `>92`. Corregido a `hud.echo` /
   `hud.echoAppend` para los cuatro. El careo de capturas port↔EA de este carril es lo
   que lo enseñó: los asertos de conducta no ven la fila.

Divergencia **declarada** que se conserva: para un `Ctrl`+letra que no es de la familia,
el binario contesta `"What?\n"` y el port calla (y no le roba el atajo al navegador). Es
la política ya escrita en los otros dos bucles; queda igual en el tercero, con su cita.

## 7. Qué queda fuera

- **`Ctrl-E` (salir a DOS)**: el port lo modela como recarga de página (no hay DOS al que
  salir; la rama `Y` del binario llama a `0x02F4`/`0x0878` del kernel = teardown del
  proceso). Sigue sin test e2e en ningún contexto, precisamente porque su rama `Y`
  recarga.
- **Códigos 1–4 = flechas**: portados como movimiento desde siempre. Que `Ctrl-A..Ctrl-D`
  produzcan esos mismos bytes en un teclado de 1988 **no** se porta: es un efecto del
  teclado, no del juego, y en un navegador Ctrl+A es del navegador.
- El `"What?\n"` de los códigos de control sobrantes (arriba). Y la pregunta hermana, más
  ancha que este carril y **sin medir aquí**: si el `"What?\n"` de las teclas
  IMPRIMIBLES (que hoy sale por `hud.message`) debería salir también en fila de comando
  por el mismo argumento de §3.4. No lo he tocado: su población son muchos call-sites y
  no tengo fotograma que lo atestigüe.
