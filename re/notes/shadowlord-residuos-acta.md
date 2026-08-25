# ACTA — residuos del Shadowlord urbano: #201 (TOWN 0x09BC) y #202 (sfx del robo)

> Encargo: cerrar los dos cabos que dejó abiertos el acta `shadowlord-urbano-acta.md`.
>
> **Resultado: la premisa de #201 es FALSA.** `TOWN 0x09DF` no está en «la rutina corta de
> cambio de planta»: está en la **entrada a COMBATE URBANO**. La etiqueta venía de
> `shadowlord-merma-52.md §1.2`, la heredé yo en mi acta §1.8 sin re-derivarla, y de ahí
> pasó al texto de la tarjeta. Es el mismo defecto que corregí en #195 con `tile_addr`,
> cometido esta vez **por mí**.

---

## 1. #201 — qué es de verdad `TOWN.OVL 0x09BC`

### 1.1 El cuerpo entero (una fila por sitio)

| offset | instrucción | qué |
|---|---|---|
| 0x09bc | `55 push bp` / `8bec mov bp,sp` | prólogo; **un** argumento en `[bp+4]` |
| 0x09bf | `ff7604 push word [bp+4]` | |
| 0x09c2 | `e88df6 call 0x52` | helper que valida `0 <= arg <= 0x1f` y lee `g_npc_type_tbl` |
| 0x09c5 | `8b5e04 mov bx,[bp+4]` | |
| 0x09c8 | `b104 mov cl,4` / `d3e3 shl bx,cl` | **bx = arg × 16** = paso de `g_npc_rt` |
| 0x09cc | `ffb76a5f push word [bx+0x5f6a]` | campo `+0x0C` del registro de NPC (npc.md §0.4) |
| 0x09d0 | `e8add5 call 0xffffdf80` | kernel CS 0x6150 |
| 0x09d3 | `ff7604 push word [bp+4]` | |
| 0x09d6 | `e8d7f6 call 0xb0` | |
| 0x09d9 | `2bc0 sub ax,ax` / `50 push ax` | empuja **0** |
| 0x09dc | `e829fa call 0x408` | ★ cargador de MAPA |
| 0x09df | `e8ccf8 call 0x2ae` | ★ colocación del Shadowlord |
| 0x09e3 | `c20200 ret 2` | |

**`[bp+4]` es un SLOT DE NPC, no una planta.** Lo fija el `shl bx,4` de 0x09c8: 16 bytes es
el paso de `g_npc_rt` (DS 0x5F5E), y `0x5f6a` es ese mismo array +0x0C. Una planta no
indexa una tabla de NPCs.

### 1.2 Los DOS llamadores, y los dos son COMBATE

Censo dentro de TOWN: `call 0x9bc` da exactamente **2** hits.

| llamador | qué empuja | contexto |
|---|---|---|
| TOWN 0x0b3a, | `[bp-2]` (slot) | tras leer el tile de destino con `tile_addr` en 0x0b0e y descartar los tiles especiales 0x84/0x85/0x9f/0xab — es el **jugador que entra en la casilla de un NPC** |
| TOWN 0x1408, | `[0x65bf]` (NPC activo) | inmediatamente después de 0x13fb `mov ax,0x2881` + 0x13ff `call` de impresión — y **DS 0x2881 = `"\nAttacked!\n"`** |

Volcado de la cadena, byte a byte, sobre `original/u5/ultima5/DATA.OVL`
(fileoff = DS + 0x10 = 0x2891): `b'\nAttacked!\n'`.

⇒ `0x09BC` es **entrar en combate urbano contra el NPC del slot N**, por las dos vías
(el jugador embiste / el NPC ataca), y al volver **recarga el mapa y re-coloca al
Shadowlord**. Coincide con lo que ya decía `rng-186-acta.md §3.2` («retorno de combate
urbano») y **contradice** `shadowlord-merma-52.md §1.2` («rutina corta de cambio de
planta»).

⚠ **Control de banda, para no repetir el cero-en-falso de siempre.** Busqué llamadores
fuera de TOWN con `call 0xffff8b8c` y salieron 20 hits en INTRO.OVL. **No son
llamadores**: INTRO tiene base 0x81c0, no 0x81d0, así que ahí ese mismo destino de
fichero resuelve a CS 0x0D4C, no a 0x0D5C. Descartados. (Y en rigor un overlay no puede
llamar a una rutina de otro por near call; la pregunta estaba mal planteada de origen.)

### 1.3 Adjudicación de #201

**NO hay ningún caller de la colocación en un cambio de planta.** La colocación tiene
exactamente DOS llamadores, uno por fila:

| llamador | qué es |
|---|---|
| TOWN 0x1239, | la carga de pueblo, dentro de `town_setup` |
| TOWN 0x09df, | el retorno de combate urbano (§1.1-1.2) |

El «hueco preexistente de #52» que describí en `shadowlord-urbano-acta.md §1.8` —«subir o
bajar una planta no re-coloca»— **no existe tal como lo enuncié**: el port no lo hace
porque el binario **tampoco lo hace**.

Lo que sí sigue vivo en 0x09BC es **otra cosa, y ya estaba carderada**: la rutina llega al
cargador **sin resetear** `g_shadowlord_here_idx` (a diferencia de `town_setup`, que lo
pone a 0xFF en 0x122e antes de cargar), así que la marchitación se ejecuta **dos veces** —
una desde TOWN 0x0514, dentro del cargador, y otra desde TOWN 0x02e7, dentro de la
colocación. Es exactamente la **T6 de #186**, encolada en **#197**. No es hallazgo nuevo
de esta tarjeta y no lo duplico.

**Veredicto: #201 se cierra SIN CÓDIGO.** La premisa era falsa; el defecto real ya tiene
dueño. Lo que aporta esta tarjeta es la corrección de la etiqueta en las tres notas que
la arrastraban.

### 1.4 Qué queda dicho para el port (y por qué NO lo cablé)

El port no modela el retorno de combate urbano por la vía de 0x09BC, así que hoy **no hay
dónde calcar** ni la recarga ni la doble marchitación. Cuando #197 aterrice la T6, el
sitio será ése y no un cambio de planta. Mi orden de `loadSmallMap`
(`clearVolatileTerrain()` → marchitar) **no se toca**: sigue siendo correcta para la
entrada normal, que es el único camino que el port tiene.

---

## 2. #202 — el sfx del robo (TALK 0x11A8)

### 2.1 La llamada y la rutina

`TALK.OVL 0x11a8`, con bytes `e88372`, es un `call 0x842e`. Base de TALK = 0xBF80 ⇒ 0x842e + 0xBF80 = 0x143AE
⇒ **CS 0x43AE**. Argumentos empujados justo antes, en orden de pila:

| offset | empuja | posición en el marco | valor |
|---|---|---|---|
| 0x1198 | `0x320` | `[bp+0xa]` | 800 |
| 0x119c | `0x7d0` | `[bp+8]` | 2000 |
| 0x11a0 | `1` | `[bp+6]` | 1 |
| 0x11a4 | `0x32` | `[bp+4]` | 50 |

### 2.2 Qué hace CS 0x43AE — leída, no supuesta

```
43b6: ax=[bp+6] → [bp-8]                    ; paso
43bc: ax=[bp+8] − [bp+0xa]                  ; (fin − inicio)
43c2: imul [bp-8] / 43cc: idiv [bp+4]       ; delta = (fin−inicio)·paso / cuenta
43d1: si=[bp+0xa]  (inicio) · 43d4: di=0
43d8: push si / call 0x22e2                 ; set_tone(si)
43dc: push 1 / push [bp+6] / call 0x20c8    ; retardo
43e6: si += delta · 43e9: di += [bp+6]
43ec: cmp di,[bp+4] / jl 0x43d8             ; mientras di < cuenta
43f7: call 0x230e                           ; cierre
```

⇒ es un **glissando lineal**: `(2000−800)·1/50 = 24 Hz` por paso, 50 pasos, de **800 Hz a
2000 Hz**. Un barrido ASCENDENTE.

Y no es una rutina nueva: `re/notes/sfx-catalog.md:41` ya la tiene censada como
**`pcspeaker_glide`** (`ret 8`, 4 args), con la corrección a `seg2.md` —que la había
clasificado como «interpolador DDA de movimiento»— documentada en su §1.3.

### 2.3 El port SÍ tiene la familia — la tarjeta lo suponía al revés

Mi acta §2.8 dijo «no hay entrada de catálogo para ese cue». **Medido: la familia existe y
está en uso.** `game/src/skin/fiel/speaker.ts` tiene tres cues sobre la misma primitiva:

| cue | params | origen |
|---|---|---|
| `cannon-fire` | `glide(1000, 200, 5, 300)` | broadside (F), CMDS 0x9d5 |
| `combat-escape` | `glide(1200, 2000, 1, 40)` | huida del arena, SJOG 0x1c37 |
| `ring-vanishes` | `glide(1200, 2000, 1, 40)` | anillo consumido, ZSTATS 0xe42 |

La convención de `glide(...)` en la piel es `(inicio, fin, paso, cuenta)` — se lee de que
`cannon-fire` documenta «GL (1000→200, 5, 300)» sobre `glide(1000, 200, 5, 300)`.

⇒ el cue del robo sería **`glide(800, 2000, 1, 50)`**. Los cuatro números salen de §2.1-2.2,
ninguno se inventa: **esto NO es un sonido aproximado, es la tupla del binario**.

### 2.4 Por qué lo dejo DERIVADO y NO cableado

Lo que falta no es el timbre: es el **canal**. Los cues se emiten empujando un `GameEvent`
de kind `"sfx"` en el array que devuelve la acción (así lo hace `applyUrbanShadowlord` con
`sfxEvent("shadowlord-announce")`). Pero el robo se dispara desde `TalkConsole.end()`, y
`TalkConsoleDeps` **no tiene bus de sfx**: sólo `hud.message` / `hud.echoCursor`. Cablearlo
pide (a) un `SfxId` nuevo, (b) la entrada en la piel, y (c) **una dependencia nueva en
TalkConsole y su construcción en `main.ts`**.

(a) y (b) son triviales y están derivados aquí. (c) es plomería de UI que toca `main.ts`, y
**meter un `SfxId` que nadie emite crearía un cue huérfano** — justo el género que los
detectores de este repo persiguen. Así que o se hace entero o no se hace: lo dejo
especificado al detalle y sin código, que es la única salida honesta.

**Lo que hay que hacer, exacto:**
1. `game/src/core/sfx.ts`: `| "faulinei-theft"` con el comentario de derivación de §2.1-2.2.
2. `game/src/skin/fiel/speaker.ts`: `"faulinei-theft": () => [glide(800, 2000, 1, 50)],`.
3. `TalkConsoleDeps` gana `sfx: (id: SfxId) => void`; `main.ts` lo inyecta donde ya
   despacha los `GameEvent` de kind `"sfx"`; `end()` lo llama junto al `hud.message`.
   El orden del binario es **mensaje primero** (0x1195 print) **y sonido después**
   (0x11a8), no al revés.

⇒ **#202 queda DERIVADA y ESPECIFICADA, no cerrada.** Que decida el lead si el paso (3)
entra aquí o en el carril de audio.

---

## 3. La regla que deja este par

> **Una etiqueta heredada de una nota es una hipótesis, no un dato — aunque la repita tu
> propia acta.** «Rutina corta de cambio de planta» viajó de `shadowlord-merma-52.md` a mi
> acta de #195 y de ahí al texto de la tarjeta #201, ganando autoridad en cada salto sin
> que nadie volviera al `.asm`. Costaba **dos greps**: los llamadores de la rutina y la
> cadena que uno de ellos imprime. En #195 cacé este mismo género en una nota ajena
> (`tile_addr` transpuesta) y a las pocas horas lo cometí en la mía. El antídoto no es
> desconfiar de las notas ajenas: es **re-derivar el tramo que vas a tocar, siempre, aunque
> la seña la hayas escrito tú**.

Corolario para el catálogo: **«el port no tiene esa familia» también es una afirmación de
ausencia** y se mide igual que cualquier otra (§2.3). La mía era falsa.
