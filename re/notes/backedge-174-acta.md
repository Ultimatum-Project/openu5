# ACTA #174 (banda PEGAJOSA) — TANDA 7: la celda `BACKEDGE` CERRADA 12/12

> Rama `re/backedge-174`, worktree `.claude/worktrees/backedge-174`, base **main `e24b53f5`**.
> Toda cifra medida en ese árbol. RETENIDA: aterriza el lead.
> Continúa `pegajosa-96-acta.md` §16 (el corte declarado de aquel carril, en frontera de celda).

---

## 0. VEREDICTO, primero

| par | veredicto |
|---|---|
| `BLCKTHRN.OVL:0x091f` | **(a)** en sus límites — la mitad con offset, exacta (§5.1) |
| `CMDS.OVL:0x1932` | **(a)** exacta en sus 5 afirmaciones — ★ y con un **DEFECTO del port al lado** (§3) |
| `CMDS.OVL:0x19ee` | **(a)** exacta — los 3 glifos, el gotoxy y los DOS extremos del rango |
| `EGA.DRV:0x0aa6` | ★★ **(d) NO APLICA** — el par lo fabrica el extractor: `kernel` es un SELECTOR (§4) |
| `SHOPPES.OVL:0x0478` | **(a)** exacta — y las DOS aristas de vuelta distintas, derivadas (§5.2) |
| `SHOPPES2.OVL:0x0030` | **(a)** exacta — el `g_shop_accum` del disasm está RANCIO, la cita no (§5.3) |
| `SJOG.OVL:0x1706` | **(a)** exacta ┐ los DOS por UNA lectura: hermanos-de-fork (§2) |
| `SJOG.OVL:0x1712` | **(a)** exacta ┘ |
| `TOWN.OVL:0x017c` | **(a)** exacta — 32×32, y el EJE del vecino derivado por el 2º `push` |
| `ULTIMA.EXE:0x4912` | **(a)** exacta — y su «ÚNICO bucle» es DEMOSTRABLE por enumeración (§5.4) |
| `ULTIMA.EXE:0x6e80` | **(a)** exacta — cola compartida de 4 slots; cabo en el 5º (§6.1) |
| `ZSTATS.OVL:0x0b12` | **(a)** exacta — «acotado a la party» es literal (`cmp ax, cx` / `jae`) |

**11 (a) · 0 (b) · 0 (c) · 1 (d)** sobre las CITAS. **DEFECTOS DE MECÁNICA DEL PORT: UNO**
(§3, el primero de las siete tandas de esta banda) — y no lo delata la cita, que es correcta,
sino el TERCER ARGUMENTO de una llamada que la cita nombra sin desglosar.

## 1. RE-ANCLA: NO hace falta, y se dice con la medida

Regla 1 del encargo: re-anclar **sólo si un aterrizaje tocó `game/src`**. Medido:

```
git diff e24b53f5..main -- game/src     → VACÍO (main ES e24b53f5)
```

La partición reproduce en este árbol, con los 3 controles del módulo verdes y el positivo
`SJOG.OVL:0x158e` en su celda de siempre (`clase2 × LIMPIA`): **338 pares @ `e24b53f5`**,
celda a celda idéntica a la tabla de la tanda 4.

### 1.1 ★ La celda mide 13 y la cola dice 12: las DOS cifras son correctas

`BACKEDGE × (FORZADA+LIMPIA)` = 3 + 10 = **13** pares. La cola de `pegajosa-96-acta` §16 dice
**12**. No hay error: `ULTIMA.EXE:0x5887` está EN la celda y **ya estaba adjudicado (d)** por
dos vías independientes (`pegajosa-103-acta` §1 por el prefijo `DS`, `corchete-190-acta` §2 por
el corchete). 13 − 1 = 12 vivos. Se comprueba que la aritmética hermana también cuadra por
MIEMBROS y no por casualidad:

| celda | en la partición | ya (d) por #188/#190 | vivos | cola declarada |
|---|---|---|---|---|
| `BACKEDGE` F+L | 13 | 1 (`ULTIMA.EXE:0x5887`) | **12** | 12 ✓ |
| `DIVERGE` F+L | 62 | 4 (`0x13b2`, `0x17f6`, `0x52d2`, `0x5356`) | **58** | 58 ✓ |

⚠ **Pero la COMPOSICIÓN de mi celda ha cambiado desde la tanda 1**, y el conteo lo tapa: en
`e06b4b9f` los 12 incluían `ULTIMA.EXE:0x5887` y NO incluían `SHOPPES2.OVL:0x0030` (un ALTA de la
tanda 4, listada en su §1); hoy es al revés. **12 = 12 con dos miembros distintos.** Es la
TERCERA aparición del fenómeno en esta cola (tanda 3 §0.1 en `clase2 × LIMPIA`, tanda 4 §1.1 en
`DIVERGE × LIMPIA`, ésta) ⇒ familia `prediccion-numerica-cuadra-por-casualidad`, ya consolidada
como propiedad de la banda y no como anécdota.

## 2. ★ EL CABO DE HERMANOS-DE-FORK RINDE: 2 pares por 1 lectura

`pegajosa-96-acta` §15.1 pide barrer los pares hermanos-de-fork antes de estimar lo que resta.
En esta celda hay un caso limpio: `SJOG.OVL:0x1706` y `SJOG.OVL:0x1712` **comparten la MISMA
línea del port** (`core/game.ts:4738`) y son dos brazos de la MISMA cadena de despacho. Una
lectura del tramo los cierra los dos.

`apply_item_grant` despacha por el tile del objeto, con la cadena de `cmp` ABAJO y los cuerpos
ARRIBA:

| call-site | instrucción | destino | ítem | efecto del cuerpo |
|---|---|---|---|---|
| `SJOG.OVL:0x175e`, | `cmp ax, 0xb4` / `jne` / `jmp 0x16b6` | `0x16b6` | shard | `mov byte [si + 0x57b6], 0xff`, `si = arg & 3` |
| `SJOG.OVL:0x1766`, | `cmp ax, 0xb5` / `jne` / `jmp 0x16e6` | `0x16e6` | corona | `mov byte [g_crown], 0xff` |
| `SJOG.OVL:0x176e`, | `cmp ax, 0xb6` / `je 0x1706` | `0x1706` | cetro | `mov byte [g_sceptre], 0xff` |
| `SJOG.OVL:0x1773`, | `cmp ax, 0xb7` / `je 0x1712` | `0x1712` | amuleto | `mov byte [g_amulet_lb], 0xff` |

La cita afirma que el despacho va por el tile, en el rango 0xB4-0xB7, a cuatro ramas de trama
—una por ítem, con su offset— y que cada una fija «el flag de tomado». Da los CUATRO destinos,
que son los de la columna «destino» de arriba, emparejados con los ítems de la columna «ítem».
**Los cuatro pares tile⇒rama, exactos**; el «fijando el flag» es literal en las cuatro (`0xff`). Corroboración
independiente por el catálogo, que la cita NO invoca: `g_amulet_lb` 0x57B3 · `g_crown` 0x57B4 ·
`g_sceptre` 0x57B5 en `re/ledger/globals.json`, contiguos y en el orden que el ASM escribe.

La otra mitad de la cita, *«SJOG Get 0x18ce ⇒ 0x1458»*: `0x18ce` es cabeza de rutina
(`push bp` / `mov bp, sp`) y las DOS llamadas a `0x1458` están en `0x18ab` y `0x199f`; entre
`0x18ce` y `0x199f` **no hay ni otro prólogo ni un `ret`**, así que la del `0x199f` es de esa
rutina. La cadena de la cita se sostiene.

## 3. ★★ EL DEFECTO: la cuenta de reagentes de Mix va con relleno ESPACIO y el original la pone con CERO

La cita de `CMDS.OVL:0x1932`, en `skin/fiel/ready.ts:149`, es **exacta en las cinco cosas que
afirma** — y por eso el defecto no se ve leyéndola:

| afirmación de la cita | call-site | verificado |
|---|---|---|
| LF | `CMDS.OVL:0x1932`, | `mov ax, 0xa` / `call` putchar ✓ |
| ESPACIO (0x1939) | `CMDS.OVL:0x1939`, | `mov ax, 0x20` ✓ |
| cuenta 2 díg. (0x5abe @cols 1-2) | `CMDS.OVL:0x1954`, | ancho **2** en `[bp+6]` ✓ |
| ESPACIO (0x1957 @col 3) | `CMDS.OVL:0x1957`, | `mov ax, 0x20` ✓ |
| nombre (@col 4+) | `CMDS.OVL:0x1962`, | `push [bx + 0x19d2]` / `call` print ✓ |

**Lo que la cita no desglosa es el TERCER argumento de esa llamada**, y ahí está el defecto:

```
1950: b83000            mov ax, 0x30        ← '0'
1953: 50                push ax
1954: e86741            call 0x5abe         ; destino real: ULTIMA.EXE 0x1a3e
                                          ; SESGO 0x4080 (el de la banda del overlay)
```

**`[bp+4]` es el CARÁCTER DE RELLENO**, no una constante ni un modo — se escribe literalmente
en cada posición de padding:

```
1ab2: 8a4604            mov al, byte ptr [bp + 4]
1ab5: 8842d8            mov byte ptr [bp + si - 0x28], al     ; una por hueco
1ab8: 41                inc cx / 1ab9: cmp cx, dx / 1abb: jne 0x1ab0
```

★ **Control positivo de que es un relleno POR CALL-SITE y no un literal del compilador**: censo
de **63 call-sites** de `ULTIMA.EXE:0x1a3e` en los 28 ficheros del corpus — el argumento **varía**
(57× `0x20`, 6× `0x30`). Los seis con `0x30` son `ULTIMA.EXE:0x29e3`, `CAST.OVL:0x1b17`,
`CMDS.OVL:0x1954`, `LOOKOBJ.OVL:0x05db`, `ZSTATS.OVL:0x01d3`, `ZSTATS.OVL:0x0206` y
`ZSTATS.OVL:0x0239`. Si fuera constante, no habría dos valores.

**Y el tramo es, sin duda, el selector de reagentes de Mix**: `0x18be` es cabeza de rutina y su
PRIMERA instrucción de cuerpo lee `[si + 0x5850]`, que el catálogo nombra **`g_reagent_qty`**
(size 8). El bucle `0x1932-0x196d` imprime UNA fila por reagente.

**EN EL PORT**: `skin/fiel/ready.ts:155` hace `qty2(item.qty)` y `qty2` (`:112`) rellena con
**ESPACIO**. ⇒ el original pinta `01`…`09` y el clon ` 1`… ` 9`. **Observable**: la lista sólo
incluye reagentes con cantidad > 0 (gate `0x18ca`, `cmp byte [si + 0x5850], 0` / `je`), así que
las cuentas de un dígito son el caso corriente.

★ **Y `qty2` NO está mal escrita — está REUTILIZADA fuera de su sitio.** Su docblock dice
*«print_number 0x385e, pad 0x20»* y **es correcto**: `0x385e` es la notación de near-call
relativa a `ZSTATS.OVL` para ESA MISMA rutina del kernel (`resolve_near_call(ZSTATS.OVL,
0x385e)` ⇒ `ULTIMA.EXE:0x1a3e`), y los call-sites de `ZSTATS.OVL`/Ready sí empujan `0x20`. El
espacio del picker de Ready está además calibrado contra el testigo medido (clip #31, citado en
`ready.ts:180-186`). **El defecto es que la variante `mix` hereda el relleno de la variante
`ready`, y sus dos overlays no coinciden en ese argumento.** Firma exacta de #133: media
llamada portada con la cita correcta al lado.

⚠ **SELLADO POR UN TEST**: `game/tests/fiel-ready.test.ts:63` afirma
`expect(...).toBe(" 4")` con el comentario *«cuenta 2-díg space-pad»*. La prosa declara un
relleno que nadie derivó, pegada a cuatro offsets que sí lo están.

**NO SE ARREGLA AQUÍ, y se dice por qué.** El encargo autoriza el arreglo sólo si es un
one-liner con test, y no lo es: pide un `qty2` parametrizado (o un segundo ayudante), tocar el
call-site de `mix`, y **cambiar el valor de una aserción existente** — que es justo lo que esta
cola no hace de pasada. Va a tarjeta con las señas de arriba.

## 4. ★★ `EGA.DRV:0x0aa6` — (d): el token `kernel` es un SELECTOR DE OVERLAY, y el extractor lo tira

La cita (`skin/fiel/frame.ts:6`) dice *«fill_rect(x0,y0,x1,y1) **kernel** 0x0aa6
(x0=[bp+0xa]..y1=[bp+4])»*. El partidor la ancló a `EGA.DRV`. Ahí cae dentro del
bucle de planos de un lector de píxel (`out dx, al` al 0x3ce, `0abe: jge 0xaa6`) — un
retro-salto plausible, sin marco `bp` y sin nada que ver con un `fill_rect`.

**En `ULTIMA.EXE:0x0aa6` está exactamente lo que la cita describe:**

```
0aa6: 55 / 0aa7: 8bec       push bp ; mov bp, sp      ← cabeza de rutina
0aac: 8b460a                mov ax, word ptr [bp + 0xa]      ← x0, literal
0aaf: 8b5e08 / 0ab2: 8b4e06 / 0ab5: 8b5604                   ← y0, x1, y1 = [bp+4]
0aca: c20800                ret 8                            ← 4 argumentos word
```

★ **Corroboración independiente, y llega de otro par de esta misma tanda.** El mismo docblock
cita `glyph(code)@cursor kernel 0x16ba` y `set_cursor(col,row) 0x1bf2`. Resolviendo las
near-calls de `CMDS.OVL` para el par de §3 —sin mirar `frame.ts`— salieron **`0x573a` ⇒
`ULTIMA.EXE:0x16ba`** (el putchar del selector de Mix) y **`0x5c72` ⇒ `ULTIMA.EXE:0x1bf2`** (su
gotoxy). Dos rutas que no se hablan dan los mismos dos offsets ⇒ **el autor de `frame.ts`
escribe offsets VERDADEROS de `ULTIMA.EXE` y marca el fichero con la palabra `kernel`.**

⇒ **La cita es correcta. El par `(EGA.DRV, 0x0aa6)` lo fabrica el instrumento.** Es la CUARTA
marca de la familia, tras el prefijo `DS` (#188) y el corchete (#190), y tiene tarjeta propia
abierta (**#199**) por otro carril; esto es una instancia concreta, hallada por lectura y no por
barrido de notación. **No se toca el instrumento** (mismo criterio que #188/#190: cambiaría la
población y le toca su control).

## 5. Los otros (a), y lo que costó cada uno

### 5.1 `BLCKTHRN.OVL:0x091f` — la cadena de DATO cerrada por una derivación de OTRO carril

Cita (`core/game.ts:5132`): *«El refuge carga BRIT.DAT (0x091f)»*. En `0x091f` se empuja
`0x70d8` y se llama al cargador; `0x0928 je 0x91f`, que REINTENTA mientras devuelva 0.

`0x70d8` es un offset de DATO y **no cae en `BLCKTHRN.OVL`** (el overlay mide 0xc70 y no
contiene la cadena). Resuelto con el mapeo que `pegajosa-103-acta` §1 ya había derivado y
verificado contra el binario para las tablas de la gitana — **`DS ⇒ fileoff = DS + 0x10`**:
`0x70d8 + 0x10 = 0x70e8`, y en `DATA.OVL` el offset de fichero `0x70e8` es literalmente
`BRIT.DAT`. **Exacta**, por una derivación ajena reutilizada tal cual.

**(a) en sus límites**: la segunda mitad de la frase («y aterriza en el castillo (small map)»)
va SIN offset y es resumen; se adjudica lo citado, no lo resumido — mismo trato que
`SHOPPES.OVL:0x061c` en `pegajosa-96-acta` §11.3.

### 5.2 `SHOPPES.OVL:0x0478` — dos aristas de vuelta, dos conductas, las dos en la cita

La cita (`ui/shop-console.ts:1770`) afirma tres cosas sobre la tecla 'D': que dispara el
easter-egg `shoppe.json[164]`, que el eco de la `d` va DENTRO de ese registro, y que después
RE-LISTA, con su offset entre paréntesis — el `0x478` de la tabla de abajo. Y añade una cuarta
sobre las teclas inválidas: que RE-LEEN en silencio.

| call-site | instrucción | vuelve a | conducta |
|---|---|---|---|
| `SHOPPES.OVL:0x048f`, | `cmp ax, 0x44` / `je 0x478` | `0x0478` ⇒ `0x046a` ⇒ **`0x0404`** | re-imprime las 4 líneas = **re-lista** |
| `SHOPPES.OVL:0x0491`, | (inválida) `mov byte [bp-2], 0` | `0x046a` ⇒ `0x0470` ⇒ **`0x0429`** | salta el listado, va al getkey = **re-lee en silencio** |

Las dos frases de la cita son **dos aristas de vuelta DISTINTAS**, y el discriminador es
`[bp-2]` (la tecla) en `0x046a`. Y *«el eco `d` va DENTRO del registro»* se confirma **por
ausencia local**: la rama a-c hace el eco a mano (`0x0445 or al, 0x20` / `0x0448 call` putchar)
y la rama 'D' **no lo hace** ⇒ la `d` minúscula tiene que venir en la propia cadena que se
imprime ahí. Exacta.

⚠ **No re-verificado aquí**: el índice `shoppe.json[164]` (y el `160+item` de la línea de
arriba). Es una correspondencia con el asset, no con el flujo, y el par es de flujo.

### 5.3 `SHOPPES2.OVL:0x0030` — y el símbolo RANCIO que casi parece un error de la cita

Cita (`core/shops/shops.ts:806`): *«recorre el roster (0x55b3, stride 0x20) y por cada miembro
con estado ≠ 'D' (0x0030, `cmp byte ptr [si],0x44` / `je 0x3e`) incrementa `g_alive_a`/`g_alive_b`
y suma el precio a `g_shop_accum`»*. Base `0x55b3` en `0x0022` ✓, `cmp` y `je` literales ✓,
`add si, 0x20` en `0x003e` ✓, los dos contadores en `0x0035`/`0x0036` (leídos de `[0xbd1a]` y
`[0xbd1c]`, devueltos en `0x0049`/`0x004d`) ✓.

★ El acumulador aparece en el desensamblado como **`g_unk_b118`**, no como `g_shop_accum` — que
leído deprisa parece un nombre inventado por la cita. **Lo es al revés**: el catálogo tiene
`g_shop_accum` en 0xB118 con `old_names: ['g_unk_b118']`. **El `.asm` está rancio y la cita al
día** (la desincronización que #81 tiene fichada). El canal `old_names[]` hace su trabajo.

### 5.4 `ULTIMA.EXE:0x4912` — un «ÚNICO» que se demuestra, no se afirma

Cita (`skin/fiel/moongate.ts:43`): *«El ÚNICO bucle de animación del cruce es 0x4912-0x492b y es
DESCENDENTE: blit parcial 0x1112(anim,5,5) + delay(2) (0x20fa) + dec [0x5887] ⇒ etapas 15→1»*.
La SIEMBRA, en `0x490d`, es `mov byte [0x5887], 0xf` = 15 ✓; el cuerpo empuja `anim`, `5` y `5` a `0x1112` ✓;
en `0x4920` se empuja `2` a `0x20fa` ✓; `0x4927 dec` ✓; el `jne` cierra en `0x492b` ✓ — los dos
extremos del rango, exactos. Sale con la global en 0, así que las etapas pintadas son 15…1 ✓.

★ El «ÚNICO» y el «NO existe un segundo bucle de llegada» **se demuestran por enumeración**, no
por inspección: en la rutina entera (`0x48a8`, cabeza, hasta su `ret` en `0x4986`) el ÚNICO
salto hacia atrás es el `0x492b`; los otros siete son todos hacia delante. Es la forma correcta
de la familia `ausencia-no-se-prueba-con-head`.

## 6. ★ Lo que esta celda enseña, y que sirve para la siguiente

### 6.0 «BACKEDGE» NO quiere decir «bucle»: sólo 4 de 12 lo son

El encargo anticipa que *«la pregunta típica es si el port modela el BUCLE (iteraciones,
condición de salida, efectos por vuelta)»*. Medido sobre los 12, esa pregunta **aplica a una
minoría**:

| forma real del retro-salto | pares | miembros |
|---|---|---|
| ITERACIÓN de verdad | **4** | `ULTIMA.EXE:0x4912` · `TOWN.OVL:0x017c` · `SHOPPES2.OVL:0x0030` · `CMDS.OVL:0x1932` |
| DESPACHO con los cuerpos ARRIBA de la cadena de `cmp` | **5** | `SJOG.OVL:0x1706` · `SJOG.OVL:0x1712` · `ULTIMA.EXE:0x6e80` · `ZSTATS.OVL:0x0b12` · `CMDS.OVL:0x19ee` |
| RE-LISTA de menú | **1** | `SHOPPES.OVL:0x0478` |
| REINTENTO hasta éxito | **1** | `BLCKTHRN.OVL:0x091f` |
| (par fabricado, §4) | 1 | `EGA.DRV:0x0aa6` |

⇒ **En 7 de los 11 pares reales no hay iteración que portar**: el retro-salto es una decisión de
LAYOUT del compilador (cuerpo colocado antes que su guarda), no una mecánica. Quien herede
`DIVERGE` puede usar el dato para no gastar lectura buscando un bucle que no existe — y, del
otro lado, para exigir el modelo COMPLETO en los pocos que sí iteran, que es donde salió el
único defecto (§3, un bucle de verdad).

### 6.1 Cabo con dueño: el 5º slot de `unequip` lleva un efecto que la cola compartida no lleva

`ULTIMA.EXE:0x6e80` es la cola COMPARTIDA que limpia el slot (`mov byte [si], 0xff`), a la que
saltan hacia atrás cuatro comparaciones (`0x6e98`, `0x6ea8`, `0x6eb8`, `0x6f06`) sobre las bases
`0x55c1`…`0x55c6`, stride `0x20` — los 6 slots, en el orden que el port tiene en
`RECORD_SLOT_ORDER`. La cita (`core/equip.ts:221`, *«0x6e80 — sin retorno al inventario»*) es
**exacta**: de `0x6e80` se va por `jmp 0x6f0e` al epílogo sin acreditar nada.

★ Pero la quinta base, `0x55c5` (la del anillo), **no usa esa cola**: tiene su propio borrado en `0x6eca` y
detrás un efecto extra, con TRES guardas:

| call-site | instrucción | papel |
|---|---|---|
| `ULTIMA.EXE:0x6ecd`, | `cmp word [bp+4], 0x2a` | sólo el anillo 42 (`RING_INVIS` en el port) |
| `ULTIMA.EXE:0x6ed3`, | `cmp byte [g_location], 0x7f` / `jbe` | sólo con `g_location` > 0x7f |
| `ULTIMA.EXE:0x6eda`, | `cmp byte [g_cmb_actor], 0x20` / `jae` | sólo actor < 0x20 |
| `ULTIMA.EXE:0x6eeb`, | `and byte [bx - 0x45ea], 0xef` | apaga el bit 4, indexado por `g_cmb_actor`, stride 8 |

El port declara la equivalencia por DERIVACIÓN (`core/game.ts:6161`: *«combat.ts deriva
`invisible` de `record.ring`, así que al poner el slot a 0xFF el actor deja de estar invisible
sin código extra»*). **No se adjudica aquí** —está fuera del tramo de mi par, que es la cola
compartida— pero se deja con señas porque la equivalencia declarada es **incondicional** y la
del binario **no**: sólo limpia dentro de la banda `g_location > 0x7f`, y sólo para el anillo
`0x2a` (no para el `0x2c`, que sí es hermano suyo en el gate de equipar, `equip.ts:416`). Dueño
natural: quien lleve #67 / la invisibilidad en combate.

## 7. Estado de la cola, con las cuentas cuadradas

| | pares |
|---|---|
| Población de la banda @ `e24b53f5` | **338** |
| VIVOS al cerrar la tanda 6 | 70 |
| cerrados aquí | **12** |
| **VIVOS** | **58** |

Restante en la mitad adjudicable: **`DIVERGE` 58** — la última celda, y la más grande. Los 189
LEJANA+AMBIGUA siguen fuera (atribución primero).

Balance acumulado de las siete tandas: **25 + 45 + 5 + 7 + 12 = 94 pares adjudicados** por cinco
carriles. Defectos de MECÁNICA del port: **UNO** (§3), tras seis tandas de cero.

⚠ **CORTE en FRONTERA DE CELDA**, con la celda entera cerrada y sin abrir `DIVERGE`. Sin partir
ningún par. Séptimo precedente de esta cola.

## 8. Lo que esta tanda NO ha hecho, declarado

- **No ha tocado `game/src`.** El defecto de §3 va a tarjeta, no a fix: no es one-liner y
  obligaría a cambiar el valor de una aserción viva.
- **No ha tocado `re/tools`.** El par fabricado de §4 se adjudica (d) y se deja; el criterio del
  token `kernel` es de #199 y le toca su propio control.
- **No ha verificado la CONDICIÓN** de ninguno de los 11 (a) (#144): se adjudica que la cita
  describe el tramo, no que el port lo modele bajo la condición correcta. §6.1 es un ejemplo
  vivo de esa distinción, dejado abierto a propósito.
- **No ha re-verificado** los índices de `shoppe.json` de §5.2 ni ha leído `DIVERGE` (58).
- **No ha barrido** el resto de la banda buscando más pares con el token `kernel`: la medida de
  §4 es UNA instancia leída, no un censo. #199 es quien lo debe censar.

## 9. Gates (EXIT por separado, sin pipes, re-corridos tras el `git add`)

```
python3 re/tools/seed_gate.py                       EXIT=0
python3 -m pytest re/tools/test_frontier.py -q      EXIT=0
python3 -m pytest re/tools/test_genero.py -q        EXIT=0
python3 re/tools/genero.py                          EXIT=0
python3 re/tools/cita_pegajosa_forma.py             EXIT=0   (3 controles verdes)
python3 re/tools/cita_pegajosa_atribucion.py        EXIT=0   (3 controles verdes)
```

`game/src` no se ha tocado ⇒ no aplican `tsc` ni `vitest`. Nada de e2e/playwright (mutex ajeno).
`routine-census.json` NO regenerado (EMBARGO); `routine_census` se ha IMPORTADO como módulo para
`resolve_near_call`, que sólo lee. `pytest re/tools` COMPLETO no corrido (contiene un test de
oráculo EN VIVO); los test-files se corren por nombre.

---

## 10. Nombres de overlay usados aquí (sección FINAL a propósito)

Al final por el ctx pegajoso de #84: un nombre de overlay escrito arriba re-atribuye los offsets
desnudos que vengan detrás dentro de su ventana. `re/notes/` no es corpus del extractor (medido
en `pegajosa-103-acta` §0.2), así que aquí es disciplina, no necesidad.

Overlays nombrados: `BLCKTHRN.OVL`, `CAST.OVL`, `CMDS.OVL`, `DATA.OVL`, `EGA.DRV`, `LOOKOBJ.OVL`,
`SHOPPES.OVL`, `SHOPPES2.OVL`, `SJOG.OVL`, `TOWN.OVL`, `ULTIMA.EXE`, `ZSTATS.OVL`.
