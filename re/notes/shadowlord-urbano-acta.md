# ACTA — el PAR del Shadowlord urbano: marchitación (#195) y robo de Faulinei (#196)

> Encargo: portar las **dos mecánicas ausentes** de la familia del Shadowlord urbano que
> dejó abiertas `rng-186-acta.md` (sus tarjetas T2 y T5), con la **decisión #52** delante
> (propuesta A ratificada: el port modela la COLOCACIÓN FÍSICA, y el flag
> `state.shadowlordHere` es el byte del que cuelgan merma, TALK y posesión).
>
> Método: cada tramo **re-derivado del `.asm`** antes de teclear. Las señas del acta de
> #186 orientan; la derivación manda. Esta vez la derivación **corrigió una de las señas**
> y la corrección era load-bearing (§1.2).

---

## 0. TL;DR

| # | mecánica | estado antes | estado ahora |
|---|---|---|---|
| 195 | marchitación del pueblo, TOWN 0x0212 | **ausente** (cero escritores de DeadTree/PlowedField en `game/src`) | **portada con paridad EXACTA** por día |
| 196 | robo de Faulinei al cerrar charla, TALK 0x1180 | **ausente** (cadena viva en `es.json` sin productor) | **portada**; el sorteo, del stream del port |

★ **El hallazgo que no estaba en el encargo:** la fórmula de `tile_addr` publicada en
`rng-186-acta.md §3.1` está **TRANSPUESTA** (`(x<<5)+y` donde el binario hace `(y<<5)+x`).
Con los ejes al revés el barrido de la marchitación visita los tiles elegibles en otro
orden ⇒ para el mismo día muere **otro conjunto de tiles**. Derivación y corrección en §1.2.

---

## 1. #195 — LA MARCHITACIÓN (TOWN.OVL 0x0212)

### 1.1 El tramo, re-verificado byte a byte

`re/disasm/TOWN.OVL.asm`, una fila por sitio:

| offset | bytes / instrucción | qué |
|---|---|---|
| 0x021a | `803e5859ff cmp byte [g_unk_5958], 0xff` | gate: ¿hay Shadowlord COLOCADO aquí? |
| 0x021f | `7503 jne 0x224` | sí ⇒ sigue |
| 0x0221 | `e98400 jmp 0x2a8` | no ⇒ **sale sin tocar nada y SIN sembrar** |
| 0x0224 | `a07e58 mov al, byte [g_day]` | `g_day` @ DS 0x587e, leído como BYTE |
| 0x0227 | `2ae4 sub ah, ah` | zero-extend ⇒ semilla ∈ [0,255] |
| 0x022a | `e8819c call 0xffff9eae` | ★ `srand(g_day)` — CS 0x207E, ver §1.4 |
| 0x0232 | `c746f40000 mov word [bp-0xc], 0` | base de FILA |
| 0x0237 | `2bf6 sub si, si` | COLUMNA a 0 |
| 0x0245 | `8a800866 mov al, byte [bx+si+0x6608]` | tile del búfer vivo |
| 0x024b | `3d2d00 cmp ax, 0x2d`, | WheatInField |
| 0x024e | `7424 je 0x274` | ⇒ rama trigo |
| 0x0250 | `3d2e00 cmp ax, 0x2e`, | Tree |
| 0x0253 | `7516 jne 0x26b` | ni uno ni otro ⇒ siguiente tile, **sin tirar** |
| 0x0255 | `2bc0 sub ax,ax` / `50 push ax` | primer push = **min** = 0 |
| 0x0258 | `b80700 mov ax,7` / `50 push ax` | segundo push = **max** = 7 |
| 0x025c | `e8639c call 0xffff9ec2` | `rand(0,7)` — CS 0x2092 |
| 0x025f | `0bc0 or ax,ax` / `7408 je 0x26b` | r==0 (1/8) ⇒ **NO** convierte |
| 0x0266 | `c68008662b mov byte [bx+si+0x6608], 0x2b` | ⇒ DeadTree |
| 0x027b | `e8449c call 0xffff9ec2` | idem `rand(0,7)` en la rama trigo |
| 0x0286 | `c68708662c mov byte [bx+0x6608], 0x2c` | ⇒ PlowedField |
| 0x0291 | `8346f420 add word [bp-0xc], 0x20` | siguiente fila |
| 0x0295 | `817ef40004 cmp word [bp-0xc], 0x400` | 32 filas × 32 = 1024 tiles |
| 0x029c | `800ee62402 or byte [g_unk_24e6], 2` | flag de turno consumido |
| 0x02a1 | `e8e29b call 0xffff9e86` | `rng_time_hash()` — CS 0x2056 |
| 0x02a5 | `e8069c call 0xffff9eae` | `srand(reloj)` — CS 0x207E, **techo de paridad** |

**Identidad de los tres kernels, resuelta por aritmética propia** (base de TOWN.OVL =
0x81D0; `CS = (fileoff + 3 + rel16 + base) & 0xFFFF`):

| call-site | rel16 | destino de fichero | + base | CS | rutina |
|---|---|---|---|---|---|
| 0x022a, | 0x9c81 | 0x9eae | 0x1207E | **0x207E** | `rng_srand` |
| 0x025c, | 0x9c63 | 0x9ec2 | 0x12092 | **0x2092** | `rand_range` |
| 0x02a1, | 0x9be2 | 0x9e86 | 0x12056 | **0x2056** | `rng_time_hash` |
| 0x02a5, | 0x9c06 | 0x9eae | 0x1207E | **0x207E** | `rng_srand` |

⇒ el par `time_hash`+`srand` del final es el de la regla de #186: **no es presentación**.

Callers (verificados con la misma aritmética): 0x0514, `e8fbfc` ⇒ 0x0212 (desde el
cargador de mapa 0x0408) y 0x02E7 (desde `town_place_shadowlord` 0x02AE, que a su vez se
llama desde 0x1239, `e872f0` ⇒ 0x02AE, y desde 0x09DF, `e8ccf8` ⇒ 0x02AE).

### 1.2 ★ La corrección: los ejes estaban TRANSPUESTOS en la nota heredada

`rng-186-acta.md §3.1` escribe: «identificado por `tile_addr` kernel `0x44A8`:
`(x<<5)+y+0x6608`». **Es al revés.** `tile_addr` (ULTIMA.EXE 0x4402) hace, en su rama de
mapa pequeño:

```
449e: 8b4604   mov ax, word [bp + 4]
44a1: b105     mov cl, 5
44a3: d3e0     shl ax, cl
44a5: 034606   add ax, word [bp + 6]
44a8: 050866   add ax, 0x6608          ⇒ addr = ([bp+4] << 5) + [bp+6] + 0x6608
```

Falta saber **cuál de los dos argumentos es la `y`**. Dos vías independientes, ambas dan
lo mismo. Una fila por sitio:

| vía | offset | qué dice |
|---|---|---|
| rama de overworld de la propia rutina | ULTIMA.EXE 0x442a, | `[bp+6]` se resta contra la global `g_chunk_origin_x` |
| rama de overworld de la propia rutina | ULTIMA.EXE 0x443b, | `[bp+4]` se resta contra la global `g_chunk_origin_y` |
| call-site de argumentos inequívocos | MAINOUT.OVL 0x06fe, | `mov al,[g_party_x]` ⇒ **primer** push |
| call-site de argumentos inequívocos | MAINOUT.OVL 0x0704, | `mov al,[g_party_y]` ⇒ **segundo** push |
| call-site de argumentos inequívocos | MAINOUT.OVL 0x0708, | `e827bb call 0xffffc232` ⇒ CS 0x4402 |

En cdecl el **último** push es el que queda en `bp+4` ⇒ `[bp+4] = g_party_y`.

⇒ **`addr = (y << 5) + x + 0x6608`**, que es lo que ya decía —correctamente—
`game/src/core/game.ts` en el doc del campo `volatileTerrain`. Aplicado a 0x0212: el
índice externo (`[bp-0xc]`, que avanza de 32 en 32 y recorre los 1024 bytes del búfer) es
**la FILA**, y `si` (0..31) **la COLUMNA** ⇒ el barrido es `for y: for x:`.

**Por qué importa y no es cosmético.** El rand se consume **sólo en los tiles elegibles**,
en el orden en que el barrido los encuentra. Transponer los ejes reordena esa secuencia,
así que para el mismo `g_day` cada tile elegible recibe **otra tirada** ⇒ muere **otro
conjunto de tiles**. Como la promesa de esta tarjeta es «paridad EXACTA, misma semilla ⇒
mismos tiles muertos», una nota transpuesta habría producido un port que cumple la
estadística (7/8) y falla el conjunto — el peor modo de fallo, porque ningún test de tasa
lo ve. Hay test dedicado: `shadowlord-wither.test.ts`, «el barrido es POR FILAS».

Corrección registrada en `rng-186-acta.md` (marca en §3.1 + §12 al final del fichero).

### 1.3 N por ciudad — MEDIDO por mí, no copiado

Instrumento propio sobre `game/assets/maps/smallmaps.json` (contar 0x2D + 0x2E por planta).
Reproduce **dígito a dígito** la tabla de `rng-186-acta.md §3.3` — ése es el control
positivo del instrumento:

| g_location | ciudad | N piso 0 (árbol/trigo) | N piso 1 |
|---|---|---|---|
| 1 | Moonglow | **0** (0/0) | 0 |
| 2 | Britain | 22 (22/0) | 29 (3/26) |
| 3 | Jhelom | 3 (3/0) | 3 (3/0) |
| 4 | Yew | **0** (0/0) | 3 (3/0) |
| 5 | Minoc | 4 (4/0) | 4 (4/0) |
| 6 | Trinsic | 3 (3/0) | 3 (3/0) |
| 7 | Skara Brae | 29 (29/0) | 29 (29/0) |
| 8 | New Magincia | 47 (2/45) | 47 (2/45) |
| 29 | Stonegate | 8 (8/0) | — |

**El caso degenerado tiene test propio.** Moonglow (N=0) da cero conversiones con el
Shadowlord presente: quien sondee ahí concluye «no pasa nada». El test lo hace
discriminante exigiendo que el **sprite 0xFC SÍ esté colocado** — es decir, que el gate se
haya abierto — y aun así no muera vegetación.

**Y Stonegate es un caso aparte, no un tercer degenerado**: tiene 8 elegibles y tampoco
marchita nunca, pero por otra razón — allí `g_shadowlord_here_idx` se queda en 0xFF porque
`g_shadowlord_locs[i]` sólo toma valores 1..8 y Stonegate es 0x1D. Los tres SL vivos se
**anuncian** (TOWN 0x1275) sin que ninguno esté «colocado». Test propio.

### 1.4 Qué es portable y qué no

| pieza | veredicto |
|---|---|
| `srand(g_day)` (0x022a) | **PORTABLE con paridad EXACTA** — es la única siembra reproducible del juego |
| barrido + 7/8 + los dos pares origen⇒destino | **PORTADO** |
| `srand(rng_time_hash())` (0x02a1/0x02a5) | **IMPOSIBLE** — el port conserva su stream (precedente D6) |

El port usa un `OriginalRng` **propio** sembrado con `g_day`, no el stream vivo: en el
binario la marchitación pisa `g_rng_seed`, pero reproducir eso volvería no-determinista
todo lo que venga después. La divergencia es la de siempre y está en el registro único
(`re/notes/rng.md §Techos de paridad`, fila TOWN 0x02A1); el call-site del port lleva un
puntero de una línea a esa tabla, no su propia derivación (decisión #186 §10.1).

### 1.5 Consecuencia que se hereda y NO se toca aquí

Los **32 rand(0,1) de la posesión** (TOWN 0x1156 → 0x10f2, ya portados) se tiran, en el
binario, **después** de la re-siembra por reloj de 0x02A1 — `0x1239 call 0x2ae` precede a
`0x12a4`. Es decir: el port los reproduce fielmente de su propio stream y en el original
salen de una semilla de reloj. No es un defecto nuevo ni algo que esta tarjeta arregle; es
la misma imposibilidad de §1.4 vista desde el otro lado. Queda dicho para que nadie lea
«32 rands del stream vivo» como una promesa de paridad.

### 1.6 Cableado en el port

- `game/src/core/world/shadowlord-wither.ts` — **NUEVO**. Función pura
  `witherTownVegetation(day, tileAt)`: devuelve las conversiones en orden de barrido. El
  gate del Shadowlord NO vive aquí (lo pone el call-site, que es quien tiene el flag).
- `game/src/core/game.ts` — `applyUrbanShadowlord` llama a `witherTown()` **antes** del
  sprite, calcando 0x02E7 (que precede al scan de slot de objeto de 0x02EF-0x03FC), y sólo
  con `shadowlordHereIndex(state) >= 0` — el flag físico de #52, no la consulta lógica.
- **Lee** del mapa base (`getActiveMap(...).tileAt`), porque el binario corre sobre el
  búfer que 0x0408 acaba de reescribir desde el .DAT; **escribe** en `setVolatileTerrain`,
  porque `tile_addr` apunta al búfer vivo y 0x6608 cae fuera de SAVED.GAM [0x55A6,0x6606)
  (#113/#119). Orden dentro de `loadSmallMap`: `clearVolatileTerrain()` primero (= la
  re-lectura de disco), marchitación después.

### 1.7 Failing-first MEDIDO

`game/tests/shadowlord-wither-live.test.ts` importa **sólo módulos que ya existían en
`main`** (`Game`), justo para no caer en la trampa del import: antes del fix fallaba por la
**aserción**, no por resolución de módulo. Medido:

```
× MUEREN árboles ...................... expected 47 to be less than 47
× el canal es VOLÁTIL ................. expected 0 to be greater than 0   (precondición)
× MISMO DÍA ⇒ mismo patrón ............ expected '' not to be ''
✓ CONTROL NEGATIVO (sin Shadowlord)
✓ caso DEGENERADO (Moonglow)
✓ STONEGATE
                                        Tests  3 failed | 3 passed (6)
```

Los tres verdes de la primera corrida son los controles que **no deben cambiar** con el
fix: prueban que el arnés llega al código y que el rojo era conductual. Tras el fix: 6/6.

### 1.8 Lo que esta tarjeta NO cierra

- ~~**El segundo caller de la colocación, 0x09DF (cambio de planta), sigue sin modelar**~~
  🔴 **RETIRADO por #201.** Este párrafo era FALSO y el error es mío: heredé la etiqueta
  «cambio de planta» de `shadowlord-merma-52.md §1.2` sin re-derivarla, y de aquí pasó al
  texto de la tarjeta #201. `TOWN 0x09BC` (que contiene el 0x09DF) es la **entrada a
  COMBATE URBANO** — `[bp+4]` es un slot de NPC, y uno de sus dos llamadores imprime
  `"\nAttacked!\n"` justo antes. **No hay caller de la colocación en un cambio de planta**,
  así que el «hueco» que describí no existe: el port no lo hace porque el binario tampoco.
  Lo que sí vive en 0x09BC es la doble marchitación (falta el reset de
  `g_shadowlord_here_idx` antes del cargador), que es la **T6 de #186** y ya estaba en
  #197. Derivación en `shadowlord-residuos-acta.md §1`.
- **La doble re-siembra del retorno de combate urbano** (TOWN 0x09BC no resetea el flag
  antes de `call 0x408` ⇒ 0x0212 corre dos veces) sigue abierta: es la T6 de #186, ya
  encolada como #197. El port no modela el retorno de combate urbano por esa vía, así que
  hoy no hay dónde calcarlo.
- **Testigo de oráculo**: no lo hay. Todo lo de §1.1-§1.4 es estático (bytes del `.asm` y
  del `.json` de mapas). La predicción falsable está en §3.

---

## 2. #196 — EL ROBO DE FAULINEI (TALK.OVL 0x1180)

### 2.1 El tramo, re-verificado byte a byte

`re/disasm/TALK.OVL.asm`, una fila por sitio:

| offset | bytes / instrucción | qué |
|---|---|---|
| 0x1187 | `803e585900 cmp byte [g_unk_5958], 0` | gate: ¿el colocado aquí es la FALSEDAD? |
| 0x118c | `7403 je 0x1191` | sí ⇒ roba |
| 0x118e | `e9e700 jmp 0x1278` | no ⇒ sale, **sin tocar el stream** |
| 0x1191 | `b8dc94 mov ax, 0x94dc` / `50 push ax` | puntero a la cadena |
| 0x1195 | `e83847 call 0x58d0` | print — CS 0x1850 |
| 0x11a8 | `e88372 call 0x842e` | sfx, con `(0x32,1,0x7d0,0x320)` — CS 0x43ae, AV/Clase C |
| 0x11ab | `e8284f call 0x60d6` | `rng_time_hash()` — CS 0x2056 |
| 0x11af | `e84c4f call 0x60fe` | `srand(ax)` — CS 0x207E, **techo de paridad** |
| 0x11b2 | `a0ac57 mov al, byte [g_keys]` | DS 0x57ac |
| 0x11b7 | `8a0ead57 mov cl, byte [g_gems]` | DS 0x57ad |
| 0x11bf | `8a0eae57 mov cl, byte [g_torches]` | DS 0x57ae |
| 0x11c5 | `7449 je 0x1210` | los TRES a cero ⇒ cascada larga |
| 0x11c7 | `2bc0 sub ax,ax` / `push ax` | primer push = **min** = 0 |
| 0x11ca | `b80200 mov ax,2` / `push ax` | segundo push = **max** = 2 |
| 0x11ce | `e8414f call 0x6112` | `rand(0,2)` — CS 0x2092 |
| 0x11e2 | `803eac5700 cmp byte [g_keys],0` | rama 0 |
| 0x11e7 | `74de je 0x11c7` | ★ vacía ⇒ **RE-TIRA** (salto HACIA ATRÁS) |
| 0x11f1 | `e8c26d call 0x7fb6` | `byte_sub_saturating(ptr,1)` — CS 0x3f36 |
| 0x11f8 | `803ead5700 cmp byte [g_gems],0` / `74c8 je 0x11c7` | rama 1, idem re-tirada |
| 0x1204 | `803eae5700 cmp byte [g_torches],0` / `74bc je 0x11c7` | rama 2, idem |
| 0x1210 | `be2f00 mov si, 0x2f` | equipo: arranca en el índice **47** |
| 0x122c | `4e dec si` / `79e4 jns 0x1213` | …y BAJA hasta 0 |
| 0x1232 | `be0700 mov si, 7` | pociones, DS 0x5828 |
| 0x124a | `be0700 mov si, 7` | pergaminos, DS 0x5820 |
| 0x1262 | `b8aa57 mov ax, 0x57aa` / `push ax` | puntero a `g_gold` |
| 0x1266 | `b80100 mov ax,1` / `push ax` | min = 1 |
| 0x126a | `b80f00 mov ax,0xf` / `push ax` | max = 15 |
| 0x126e | `e8a14e call 0x6112` | `rand(1,15)` |
| 0x1272 | `e85f6d call 0x7fd4` | `sub_word_clamped_floor0` — CS 0x3f54 |
| 0x1275 | `e80857 call 0x6980` | repintado de panel — CS 0x2900 |

**Identidad de los kernels** (base de TALK.OVL = 0xBF80; los labels que imprime el
disasm son FILE-relativos y hay que sumarles la base): 0x60d6+0xbf80 ⇒ CS **0x2056**;
0x60fe ⇒ **0x207E**; 0x6112 ⇒ **0x2092**; 0x7fb6 ⇒ **0x3F36**; 0x7fd4 ⇒ **0x3F54**;
0x842e ⇒ **0x43AE**; 0x58d0 ⇒ **0x1850**; 0x6980 ⇒ **0x2900**.

Las dos rutinas de resta, leídas: CS 0x3f36 (`[bp+6]`=puntero byte, `[bp+4]`=cantidad;
`jbe` ⇒ 0, si no `sub`) y CS 0x3f54 (igual sobre word). **Las dos saturan en 0.**

### 2.2 El disparador es INCONDICIONAL

`run_scripted_conversation` 0x127E llama a 0x1180 en **0x1305**, y ahí convergen los tres
caminos del cuerpo: 0x12f9 `jne 0x1305`, 0x1300 `jne 0x1305`, y la caída de 0x1302. Es la
última llamada antes del epílogo, en TALK 0x1308. ⇒ **no hay charla que no robe** en la ciudad de
Faulinei: ni despedirse, ni marcharse, ni que el guion no llegue a ninguna palabra clave.

### 2.3 ★ Detalle que la nota heredada aplanaba: la re-tirada, y el panel asimétrico

Dos cosas que `rng-186-acta.md §4.1` deja implícitas y que cambian la conducta:

1. **La rama de llaves/gemas/antorchas RE-TIRA, no cae a la siguiente categoría.** Los
   tres `je` de 0x11e7/0x11fd/0x1209 saltan **hacia atrás**, a 0x11c7. Con sólo antorchas,
   el original puede gastar 1, 2, 3… tiradas antes de robar. Un port que en vez de
   re-tirar eligiese «la siguiente no vacía» robaría **lo mismo** y consumiría **otra
   cantidad de stream** — invisible para cualquier test de «se robó algo». Test propio.
2. **El repintado de panel — TALK 0x1275, CS 0x2900 — cuelga SÓLO de la rama del oro.** Los otros
   cinco caminos hacen `jmp 0x1278` y se lo saltan. Leída, esa rutina redibuja los 6
   miembros y las cifras de comida/oro — coherente: sólo el oro está en el panel; llaves,
   gemas y antorchas viven en (Z)stats. Es presentación (Clase C), no se modela, pero
   queda anotado para que nadie lo lea como descuido.

### 2.4 La cascada completa, en orden

| prioridad | qué | de dónde | tiradas |
|---|---|---|---|
| 1 | llaves · gemas · antorchas | DS 0x57ac / 0x57ad / 0x57ae | `rand(0,2)` **por intento** (re-tira si vacía) |
| 2 | equipo, índice MÁS ALTO no vacío | DS 0x57c0, 48 slots, `si=0x2f` bajando | 0 |
| 3 | pociones, índice más alto | DS 0x5828, 8 slots | 0 |
| 4 | pergaminos, índice más alto | DS 0x5820, 8 slots | 0 |
| 5 | oro | DS 0x57aa | `rand(1,15)`, suelo 0 |

Las tres arrays se recorren **de arriba abajo** (`dec si / jns`). Es el detalle que un port
ingenuo invierte y que ningún aserto de «bajó algo» detecta: hay test dedicado.

### 2.5 Adjudicación de paridad

`srand(rng_time_hash())` en 0x11AB **antes de toda tirada** ⇒ el sorteo del botín del
original sale del reloj de pared y **no hay nada que igualar**. El port conserva su stream
(precedente D6) y lo declara por puntero al registro único `rng.md §Techos de paridad`,
fila TALK 0x11AB. Lo que SÍ es fiel y verificable: el gate, el orden de la cascada, la
re-tirada, los rangos de las dos tiradas y los suelos.

### 2.6 Cableado en el port

- `game/src/core/world/faulinei-theft.ts` — **NUEVO**. `applyFaulineiTheft(state, rand)`:
  gate + cascada; muta y devuelve lo robado, para poder afirmar sobre la CASCADA y no
  sólo sobre el saldo.
- `game/src/core/game.ts` — `faulineiTheftOnTalkEnd()`: engancha el stream vivo.
- `game/src/ui/talk-console.ts` — `end()` es el embudo del 0x1305 y llama al core. Es el
  único punto por el que se cierra una charla en el port, y le llegan tanto el fin normal
  (`render` sin prompt) como el ESC del getstring (`cancel`) — los dos con test.
- **i18n**: la cadena ya vivía en `es.json:4674` (huérfana, sin productor); ahora la emite
  el core por el impresor fiel `hud.message → pushConsole → t()`, que es la vía de
  contenido. **No hace falta clave nueva**; sí entrada en `approved-strings.json` con su
  cita `[D] DS 0x94dc` (el gate del manifiesto de strings la exigió, y con razón).
- `re/ledger/orphan-strings.json`: la entrada se marca CERRADA conservando su veredicto
  (`hueco-del-port` era correcto — era flujo ENTERO sin portar, no una rama suelta).

### 2.7 Failing-first MEDIDO

`game/tests/faulinei-theft-live.test.ts` importa sólo `Game` y `TalkConsole`, que ya
existían. Medido antes del fix:

```
✓ CONTROL NEGATIVO: sin Shadowlord
✓ CONTROL NEGATIVO: con ASTAROTH (el gate es == 0, no «hay alguno»)
× con FAULINEI toda charla acaba en robo ... expected [ 'You see a guard', …(2) ] to include '\nSomething was stolen!\n'
× también al cerrar con ESC ............... expected [ 'You see a guard', 'Your interest?' ] to include …
× el robo es POR CONVERSACIÓN ............. expected 5 to be 3
× FONDO DE LA CASCADA: el ORO ............. expected 100 to be less than 100
                                            Tests  4 failed | 2 passed (6)
```

Tras el fix: 6/6, más 11 de la cascada pura en `faulinei-theft.test.ts`.

### 2.8 Lo que esta tarjeta NO cierra

- **El sfx de 0x11A8 no se emite.** ⚠ **Matizado por #202**: la razón que di —«no hay
  entrada de catálogo para ese cue»— era **falsa**, y es otra afirmación de ausencia que no
  medí. La primitiva está censada (`pcspeaker_glide` CS 0x43AE, `sfx-catalog.md:41`) y la
  piel ya tiene TRES cues de esa familia. Los params del robo están derivados:
  `glide(800, 2000, 1, 50)`. Lo que falta es el CANAL — `TalkConsoleDeps` no tiene bus de
  sfx. Especificado en `shadowlord-residuos-acta.md §2`.
- **El repintado de panel de 0x1275** (§2.3) — presentación, declarado y no modelado.
- **La entrada de `frontier.json` / `frontier-manual.json` sigue con su hueco**: el texto
  del tramo salta del `sfx 0x842e` al `rand(0,2)` omitiendo los dos calls de la re-siembra.
  Es la T3 de #186, ya encolada como #197, y no se toca aquí (artefacto con gate y semillas
  pegajosas, #84).
- **No hay testigo de oráculo.** Predicciones en §3.

---

## 3. Predicciones falsables PRE-REGISTRADAS

Antes de cualquier corrida de oráculo, y para que se puedan cobrar:

1. **P1 (marchitación, día fijo).** Un save colocado en New Magincia con Faulinei en la
   ciudad, entrado dos veces el MISMO `g_day` sin pasar medianoche, muestra **el mismo
   conjunto exacto** de parcelas aradas las dos veces. Si difieren, `srand(g_day)` no es la
   siembra efectiva y §1.4 está mal.
2. **P2 (marchitación, día+1).** El mismo save tras pasar medianoche muestra un conjunto
   **distinto**. Si sale idéntico, la semilla no es el día.
3. **P3 (el eje).** El conjunto de tiles muertos del original coincide con el que produce
   `witherTownVegetation(day, …)` **con el barrido por filas**, y NO con el del barrido
   transpuesto. Es el cobro de §1.2: si gana el transpuesto, mi derivación de `tile_addr`
   está mal y hay que revisar también el doc de `volatileTerrain` en `game.ts`.
4. **P4 (conteo).** Entrar a Moonglow o a Yew (piso 0) con un Shadowlord **no cambia ni un
   tile**, pese a que el anuncio suena y el sprite aparece.
5. **P5 (robo, disparo).** En la ciudad de Faulinei, DIEZ conversaciones seguidas producen
   **diez** «Something was stolen!» y **diez** piezas menos de inventario. Si alguna charla
   no roba, el 0x1305 no es incondicional y §2.2 está mal.
6. **P6 (robo, orden de la cascada).** Con el inventario vaciado de llaves, gemas y
   antorchas y con equipo en dos slots (uno bajo y uno alto), el original se lleva **el del
   índice ALTO**. Si se lleva el bajo, el barrido va al revés y §2.4 está mal.
7. **P7 (robo, prioridad del oro).** Con llaves > 0 el oro **no baja**; con las tres
   categorías a cero y sin objetos, baja entre 1 y 15. Si baja el oro habiendo llaves, la
   cascada no es una cadena de prioridad sino una elección.
8. **P8 (robo, ESC).** Abrir una charla y cerrarla con ESC sin teclear nada roba igual. Es
   el mismo predicado que P5 por otro camino, y el que más fácilmente falla si alguien
   engancha el robo a la despedida en vez de al cierre.
