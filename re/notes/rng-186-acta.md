# ACTA #186 — los `rng_time_hash` restantes: dónde la paridad de stream es IMPOSIBLE

> Encargo: auditar los **3** `rng_time_hash` que `rng.md` dejaba sin adjudicar (TOWN ×1,
> CMDS ×1, TALK ×1), tras el hallazgo de D6 (`defectos-d3d6d7-acta.md §4`).
>
> **Resultado: no son 3, son 4** — el censo de `rng.md` estaba INCOMPLETO y además
> afirmaba en positivo una ausencia falsa («la re-siembra … **no en INTRO**»). El cuarto
> está en **INTRO.OVL 0x0CC9**, en el camino al menú de portada, y refuta la premisa que
> sostiene la derivación de la gitana (`gypsy.md`) y un comentario de `game/src`.

---

## 0. TL;DR

| # | sitio | evento disparador | ¿lo modela el port? | ¿lo declara? |
|---|---|---|---|---|
| 1 | `TALK.OVL 0x1145/0x1149` | abrir conversación con NPC **desconocido** | sí (stream propio) | **SÍ** — D6, #180 |
| 2 | `TALK.OVL 0x11AB/0x11AF` | **fin de CADA conversación** con Faulinei en la ciudad | **NO** (rutina entera sin portar) | no |
| 3 | `TOWN.OVL 0x02A1/0x02A5` | **entrar a un pueblo** con CUALQUIER Shadowlord presente | **NO** (la marchitación no existe en el port) | no |
| 4 | `CMDS.OVL 0x022B/0x022F` | **emboscada de acampada** (tras acertar el 1/64) | mecánica sí, re-siembra no | **NO — y está MAL DECLARADO** como «escena/alarma» |
| 5 | `INTRO.OVL 0x0CC9/0x0CCD` ★ | **llegar al menú de portada** (todo arranque) | **NO** | **NO — y `gypsy.md` afirma que no existe** |

Los cinco son el mismo par: `ax = rng_time_hash()` (CS 0x2056, `int 21h AH=2Ch`) ⇒
`rng_srand(ax)` (CS 0x207E) ⇒ `g_rng_seed` (DS 0x5420) queda con 12 bits del **reloj de
pared**. Desde ahí no hay nada que igualar: la paridad no se incumple, **deja de existir**.

**El techo estructural más temprano no es ninguno de los cuatro de juego: es el #5.** El
menú de portada re-siembra **antes de que el jugador toque una tecla**, así que la partida
del original **nunca** corre desde `g_rng_seed = 0`.

---

## 1. Método y controles

**Instrumento:** `dispatch_table.near_calls_to_kernel(overlay, target)` — el mismo que fijó
el censo de `rand_range` en `rng.md`. Corrido sobre **los 18 overlays**, no sobre los tres
que ya se sabían, más un escaneo `e8 rel16` byte a byte dentro de `ULTIMA.EXE` para los
call-sites internos del kernel.

**Resultado del censo (reproducible):**

```
rng_time_hash (CS 0x2056):  TOWN 0x2a1 · CMDS 0x22b · TALK 0x1145,0x11ab · INTRO 0xcc9   = 5
rng_srand     (CS 0x207e):  TOWN 0x22a,0x2a5 · CMDS 0x22f · TALK 0x1149,0x11af · INTRO 0xccd = 6
kernel interno (e8 rel16):  0x2056 ⇒ 0 hits · 0x207e ⇒ 0 hits · 0x2092 ⇒ 22 hits
```

Los 22 de `rand_range` **reproducen exactamente** la cifra publicada en `rng.md:131-134`:
ése es el **control positivo** del instrumento — el mismo escaneo que da 5 y 6 arriba
reproduce dígito a dígito un número ya fijado por otra vía. El censo de `rng.md` para
time_hash/srand no era un cero en falso de instrumento; era **un censo que sólo miró tres
overlays y publicó el resultado como si hubiera mirado todos**.

**Verificación byte a byte de los 11 call-sites** (bytes del fichero original, no del
listado lineal; `CS = (fileoff + 3 + rel16 + base) & 0xFFFF`):

| overlay | base | fileoff | bytes | destino CS |
|---|---|---|---|---|
| TOWN.OVL | 0x81d0 | 0x022a | `e8 81 9c` | 0x207e |
| TOWN.OVL | 0x81d0 | 0x02a1 | `e8 e2 9b` | 0x2056 |
| TOWN.OVL | 0x81d0 | 0x02a5 | `e8 06 9c` | 0x207e |
| CMDS.OVL | 0xbf80 | 0x022b | `e8 a8 5e` | 0x2056 |
| CMDS.OVL | 0xbf80 | 0x022f | `e8 cc 5e` | 0x207e |
| TALK.OVL | 0xbf80 | 0x1145 | `e8 8e 4f` | 0x2056 |
| TALK.OVL | 0xbf80 | 0x1149 | `e8 b2 4f` | 0x207e |
| TALK.OVL | 0xbf80 | 0x11ab | `e8 28 4f` | 0x2056 |
| TALK.OVL | 0xbf80 | 0x11af | `e8 4c 4f` | 0x207e |
| INTRO.OVL | 0x81c0 | 0x0cc9 | `e8 ca 91` | 0x2056 |
| INTRO.OVL | 0x81c0 | 0x0ccd | `e8 ee 91` | 0x207e |

Control de la base de INTRO (es el único overlay del lote con `nreloc=2`, así que su base
podría estar mal descontada): con esa misma base, `INTRO 0x0abd call 0xffff9b9e` resuelve a
**CS 0x1D5E = `kernel_getkey`**, identidad independiente ya fijada en
`dispatch_table.arrow_table()`. La base es correcta.

**Único escritor de `g_rng_seed`:** `grep g_rng_seed re/disasm/*.asm` da **3 hits, todos en
`ULTIMA.EXE`** — `0x2087` (dentro de `srand`) y `0x209b/0x20aa` (dentro de `rand_range`).
No hay ningún `mov [0x5420], …` fuera de esas dos rutinas ⇒ **las 6 llamadas a `srand` son
la lista COMPLETA de re-siembras del juego**. Nada más puede mover la semilla salvo
consumirla.

> ⚠ **Gotcha de censo reincidente.** `grep` del hex `0x5958` en `re/disasm/*.asm` ⇒ **0 hits**; el disasm
> imprime el **símbolo** (`g_unk_5958`), no el hex. Con el símbolo salen 11. Es la firma
> exacta de `censo-global-hex-y-simbolo`, y esta vez el cero en falso habría ocultado el
> reset de `TOWN 0x122E` que decide §3.2. Censar SIEMPRE por hex **y** símbolo.

---

## 2. Sitio 1 — TALK 0x1145 (ya adjudicado, se resume por completitud)

Apertura de conversación, rama de NPC **desconocido**: `srand(reloj)` + `rand(0,1)` decide
si el NPC se autopresenta («`"I am called `», DS 0x94CE) o calla. Derivación entera en
`defectos-d3d6d7-acta.md §3-§4`; decisión del port declarada en `game.ts:4498` y
`conversation.ts:93`: **el port conserva su determinismo** (`rollTalkSelfIntro`), porque
reproducir el `srand(reloj)` volvería no-determinista todo el port desde la primera charla.
Ése es el **precedente** contra el que se adjudican los otros cuatro.

---

## 3. Sitio 3 — TOWN 0x02A1: la MARCHITACIÓN del pueblo del Shadowlord

*(se adjudica antes que el 2 porque el 2 depende del mismo gate)*

### 3.1 El tramo completo — `TOWN.OVL 0x0212`

Rutina, la de `0x0212`, llamada desde `town_place_shadowlord 0x02AE` (0x02E7) y desde el
cargador de MAPA `0x0408`, en su 0x0514:

```
0212: push bp / mov bp,sp / sub sp,0xc / push di / push si
021a: cmp byte [g_shadowlord_here_idx, DS 0x5958], 0xff
021f: jne 0x224
0221:   jmp 0x2a8                       ; ningún Shadowlord aquí ⇒ SALE SIN TOCAR NADA
0224: al = [g_day, DS 0x587e] ; push ax
022a: call CS 0x207e  ⇒ srand(g_day)    ; ★ SIEMBRA DETERMINISTA POR DÍA
022d: [bp-4]=0x20 ; [bp-0xc]=0          ; base de fila
0237: si = 0                            ; columna
0242: bx = [bp-0xa]
0245: al = [bx+si+0x6608]               ; ← tile del mapa pequeño (32×32, tile_addr, CS 0x44a8)
024b: cmp ax,0x2d ; je 0x274            ; 0x2D = WheatInField
0250: cmp ax,0x2e ; jne 0x26b           ; 0x2E = Tree
0255:   push 0 / push 7 / call rand(0,7)
025f:   or ax,ax ; je 0x26b             ; 1/8: NO convierte
0263:   [bx+si+0x6608] = 0x2b           ; ⇒ DeadTree
026b: inc si ; cmp si,0x20 ; jge 0x28e ; jmp 0x242
0274:   push 0 / push 7 / call rand(0,7)
027e:   or ax,ax ; je 0x26b             ; 1/8: NO convierte
0286:   [di+si+0x6608] = 0x2c           ; ⇒ PlowedField
0291: [bp-0xc] += 0x20 ; cmp [bp-0xc],0x400 ; jl 0x237   ; 32 filas × 32 = 1024 tiles
029c: or byte [g_unk_24e6], 2           ; flag de turno consumido
02a1: call CS 0x2056  ⇒ rng_time_hash() ; ★★ RE-SIEMBRA CON EL RELOJ DOS
02a4: push ax
02a5: call CS 0x207e  ⇒ srand(ax)
02a8: pop si / pop di / mov sp,bp / pop bp / ret
```

**Qué es:** el Shadowlord **marchita la vegetación del pueblo**. `Tree ⇒ DeadTree`,
`WheatInField ⇒ PlowedField`, con probabilidad **7/8 por tile**, sobre el búfer del mapa
pequeño `DS 0x6608` (`tile_addr` 0x44A8 — ⚠ fórmula TRANSPUESTA aquí, corregida en §12).
Nombres de tile de `TileData.json` (0x2B DeadTree · 0x2C PlowedField · 0x2D WheatInField ·
0x2E Tree): el par origen⇒destino es semánticamente exacto en las dos ramas, lo que
confirma la lectura.

**Gates, en orden:**
1. `g_shadowlord_here_idx != 0xFF` (hay un SL en esta ciudad — CUALQUIERA de los tres, no
   sólo Faulinei).
2. El caller `0x02AE` añade `g_party_y != 4` (0x02BB): en el tick de entrada estándar la
   detección se salta y se re-ejecuta al paso siguiente (quirk ya registrado en
   `shadowlord-urban.md §1`).

**La re-siembra es INCONDICIONAL dentro de la rutina**: una vez pasado el gate del §1, se
llega a `0x02A1` por todos los caminos (no hay salto que lo evite; el único `jmp` previo,
`0x0221`, sale ANTES de la siembra por día).

### 3.2 La orquestación: por qué NO se re-siembra dos veces por entrada

`0x0212`, que tiene **dos** callers. En `town_setup`, en `0x11F0`, el orden es:

```
122e: mov byte [g_shadowlord_here_idx], 0xff   ← RESET
1233: push [bp+4] / 1236: call 0x408           ← carga de mapa; dentro, 0x0514 llama a 0x212
                                                 …que ve 0xFF y sale sin hacer nada  ✔
1239: call 0x2ae                               ← detecta el SL; si lo hay ⇒ 0x2e7 call 0x212  ★
1275/1294: anuncio, en 0x11b8, + efecto, en 0x1156,
```

⇒ por entrada normal a pueblo: **exactamente 1 re-siembra**.

**Pero el otro caller de `0x0408` no resetea el flag.** `TOWN 0x09BC` (retorno de combate
urbano: `call 0xffffdf80` ⇒ `call 0xb0` ⇒ `call 0x408` ⇒ `call 0x2ae`) llega a `0x0514`
con el índice **del pueblo anterior al combate**, así que ahí `0x0212`, corre **dos veces**
⇒ **2 re-siembras y 2×N tiradas**. No es un bug observacionalmente inerte: la segunda
pasada corre sobre un mapa ya marchito, donde quedan menos tiles elegibles.

### 3.3 Cuántas tiradas consume — MEDIDO, no estimado

`N` = nº de tiles `0x2D` + `0x2E` en el nivel cargado. Medido sobre
`game/assets/maps/smallmaps.json` (piso 0 · piso 1), sólo las 8 ciudades de la virtud (las
únicas que el re-sorteo de medianoche `rand(1,8)` puede elegir) + Stonegate:

| g_location | ciudad | N piso 0 (árbol/trigo) | N piso 1 |
|---|---|---|---|
| 1 | Moonglow | **0** (0/0) | 0 |
| 2 | Britain | 22 (22/0) | 29 (3/26) |
| 3 | Jhelom | 3 (3/0) | 3 |
| 4 | Yew | **0** (0/0) | 3 (3/0) |
| 5 | Minoc | 4 (4/0) | 4 |
| 6 | Trinsic | 3 (3/0) | 3 |
| 7 | Skara Brae | 29 (29/0) | 29 |
| 8 | New Magincia | 47 (2/45) | 47 |
| 29 | Stonegate | 8 (8/0) | — |

> ★ **Moonglow y Yew (piso 0) dan N = 0.** Ahí el tramo consume **CERO tiradas** y aun así
> **re-siembra dos veces**. Cualquier sonda que mida «¿cuántos rands gasta entrar a un
> pueblo con Shadowlord?» y elija Moonglow como caso obtiene **0 y concluye que no pasa
> nada** — el caso degenerado del que ya avisa `control-positivo-degenerado`. El control
> que discrimina es **New Magincia** (47) o **Skara Brae** (29): allí el efecto es visible
> a ojo, 45 parcelas aradas / 29 árboles muertos.

### 3.4 Determinismo por DÍA — y por qué importa

`srand(g_day)` a la cabeza es una siembra **reproducible**: el mismo día produce la misma
marchitación. Y como el terreno de mapa pequeño es **volátil** (se relee del disco byte a
byte en cada entrada — `#113`/`#121`, `smallmap-terrain-volatile`), entrar y salir del
mismo pueblo el mismo día da **exactamente el mismo patrón**. Ése es el diseño: la ciudad
marchita es estable durante el día y cambia al pasar la medianoche.

⇒ **La primera mitad del tramo SÍ es portable con paridad exacta.** Sólo la cola
(`0x02A1`) es imposible. Es el único de los cinco sitios donde `srand` no es del reloj:
`rng.md` lista «`rng_srand`: TOWN ×2» sin distinguir que **uno de los dos es determinista**.

### 3.5 Adjudicación

**MECÁNICA AUSENTE, no divergencia de stream.** El port no marchita nada:
`git grep -E "DeadTree|PlowedField"` en `game/src` ⇒ sólo `TileData.json` (el catálogo),
**cero escritores**. `shadowlord-urban.ts` documenta anuncio, sprite y posesión, y omite
la marchitación por completo.

Y su nota lo sella con una tabla que dice lo contrario de lo derivado aquí —
`shadowlord-urban.md §8`:

| lo que dice §8 | lo derivado |
|---|---|
| «Detección + spawn físico, el de `0x2ae` … **0** (slot libre = scan)» | **N tiradas + 2 srand**, N∈[0,47] |
| «El único consumo es la posesión: **32 rands del stream vivo**» | los 32 se sacan de un stream **recién sembrado con el reloj** dos pasos antes (0x02E7 precede a 0x12A4) |
| línea 35: «`02e7: call 0x212 ; (redibujo/aux)`» | no es redibujo: es la marchitación + la re-siembra |

⇒ los 32 rand(0,1) de posesión que el port reproduce fielmente **no son reproducibles en el
original**: cuando se tiran, la semilla ya la puso `int 21h AH=2Ch`.

---

## 4. Sitio 2 — TALK 0x11AB: el robo de Faulinei al cerrar cada charla

### 4.1 El tramo completo — `TALK.OVL 0x1180`

```
1180: push bp / mov bp,sp / sub sp,2 / push si
1187: cmp byte [g_shadowlord_here_idx, DS 0x5958], 0
118c: je 0x1191 ; jmp 0x1278             ; SÓLO con Faulinei (índice 0) en la ciudad
1191: ax=0x94dc ; call print             ; "\nSomething was stolen!\n"
1198-11a8: call CS 0x43ae (0x32,1,0x7d0,0x320)   ; glide de PC-speaker (presentación)
11ab: call CS 0x2056 ⇒ rng_time_hash()   ; ★★ RE-SIEMBRA CON EL RELOJ DOS
11ae: push ax
11af: call CS 0x207e ⇒ srand(ax)
11b2: ax = g_keys|g_gems|g_torches ; je 0x1210
11c7:   rand(0,2) ⇒ 0=llaves, DS 0x57ac · 1=gemas, DS 0x57ad · 2=antorchas, DS 0x57ae
11e2/11f8/1204: si la categoría sorteada está a 0 ⇒ VUELVE a 0x11c7 (re-tira)
11e9:   byte_sub_saturating(ptr, 1)  [CS 0x3f36] ; ret
1210: si=0x2f⇒0 : g_equip_qty[si]  (0x57c0, 48)  ⇒ roba 1 del índice MÁS ALTO no vacío
1232: si=7⇒0    : g_potion_qty[si] (0x5828, 8)
124a: si=7⇒0    : g_scroll_qty[si] (0x5820, 8)
1262: g_gold, DS 0x57aa, −= rand(1,15), con suelo 0  [sub_word_clamped_floor0 CS 0x3f54]
1275: call CS 0x2900 (housekeeping) / ret
```

**Disparador:** `run_scripted_conversation 0x127E` llama a `0x1180` en **0x1305, de forma
incondicional**, al salir de la conversación — pase lo que pase dentro (el `call 0x111c` de
la apertura D6, el bucle de palabras clave, o nada). ⇒ **cada (T)alk en la ciudad de
Faulinei termina en un robo.**

**La re-siembra es incondicional** una vez pasado el gate del Shadowlord: está antes de
toda bifurcación y no hay ninguna tirada previa. Todo el sorteo del botín sale del reloj.

### 4.2 Adjudicación

**RUTINA ENTERA SIN PORTAR.** El único rastro en el port es el comentario
`shadowlord-urban.ts:16` («"Something was stolen!" al fin de cada charla (TALK 0x1180)»);
`git grep stolen -- game/src` no encuentra emisor. Ya está censado como huérfano
(`orphan-strings.json`: «La rutina NO está portada … es flujo entero sin portar, del carril
del Shadowlord urbano (#52)»), con la cadena viva en `es.json:4674` sin productor.

**Defecto de derivación colateral:** `frontier.json` / `frontier-manual.json` tienen el
tramo derivado entero y **exacto** salvo por un hueco — el texto salta de «`+ sfx
0x842e(...)`» a «`y roba UNA cosa por cascada: si keys|gems|torches !=0 sortea rand(0,2)`»,
**omitiendo los dos calls de en medio**. La derivación describe la mecánica bien y borra
justo lo que hace la mecánica no reproducible. ⇒ **Tarjeta T3** (§7): no lo edito aquí
porque `frontier*.json` es artefacto con gate y semillas pegajosas (#84).

---

## 5. Sitio 4 — CMDS 0x022B: la emboscada de acampada, MAL DECLARADA

### 5.1 El tramo

Dentro del bucle de sueño de `camp()` (`CMDS.OVL 0x0000-0x054E`), en cada **cruce de hora**:

```
021d: push 0 / push 0x3f / call rand(0,0x3f)
0224: or ax,ax ; jne 0x30c              ; 63/64 ⇒ sigue durmiendo
022b: call CS 0x2056 ⇒ rng_time_hash()  ; ★★ RE-SIEMBRA CON EL RELOJ DOS
022e: push ax
022f: call CS 0x207e ⇒ srand(ax)
0232: push 0 / push 7 / call rand(0,7)  ; ← ESTA tirada ya sale del reloj
023e: al = [bx+0x1734]                  ; enemyType = AMBUSH_TABLE[rand(0,7)]
0247: print "Ambushed!\n\n"  (DS 0x41e0)
…    combat-setup + retorno temprano ax=1
```

⇒ **el roll 1/64 que decide SI hay emboscada es del stream normal; el roll que decide QUÉ
enemigo es del reloj, y todo lo posterior también.** La re-siembra está *dentro* de la rama
de acierto: sólo dispara cuando la emboscada ocurre (~10,5 % por acampada de 8 h), pero
cuando dispara parte el stream para el resto de la partida.

### 5.2 ★ El defecto: los dos calls estaban catalogados como PRESENTACIÓN

Tres sitios del repo declaran estos mismos dos calls como escena:

| fichero | texto |
|---|---|
| `camp-ambush-spec.md:37` | `` `call 0x60d6` (0x022b) │ 0x2056 │ escena/alarma de emboscada (presentación) `` |
| `camp-ambush-spec.md:38` | `` `call 0x60fe` (0x022b) │ 0x207e │ escena/alarma de emboscada (presentación) `` |
| `camp-ambush-spec.md:103,105,289` | `; escena/alarma (presentación, Clase C)` |
| `deliberate-divergences.md:585` | «Clase C / residuales: (1) la ESCENA visual (**alarma 0x2056/0x207e**, …) ⇒ AV/#28» |

La **traducción del offset era correcta** (0x60d6+0xBF80 = 0x2056 ✔) — lo que falló fue la
**identidad de la rutina de destino**: nadie cruzó 0x2056/0x207E contra `rng.md`, que las
nombra desde la Task 1.3. El efecto de la etiqueta es material, no cosmético: convierte el
residual de «**paridad imposible por construcción**» en «**escena pendiente, Clase C, va al
carril de AV**», que es una cola donde nunca se resolverá.

Corregidos en esta rama (§6). `deliberate-divergences.md:585` mantiene íntegra su
conclusión operativa (la emboscada sigue **excluida del set seed-exacto**) — sólo cambia el
motivo: no es que el bucle interno consuma rands que el port no rueda, es que **ahí no hay
stream que igualar**.

### 5.3 Adjudicación

**El port decide bien y NO lo declara.** `camp.ts:campSleepStep` hace
`if (h < hours-1 && ctx.rand(0,63) === 0) { const type = AMBUSH_TABLE[ctx.rand(0,7)]! … }`:
conserva su propio stream, exactamente el precedente D6. Pero entre las dos tiradas hay,
en el binario, una re-siembra que el JSDoc del port **no menciona** — cita la tabla
(«`rand(0,7)` (0x0239, AMBUSH_TABLE)») y salta el 0x022B, igual que la spec.
⇒ **Tarjeta T4** (§7): declararlo en el call-site, como ya se hizo en `game.ts:4498` para D6.

---

## 6. ★★ Sitio 5 — INTRO 0x0CC9: el techo está en el MENÚ DE PORTADA

### 6.1 Lo que dice `rng.md` y lo que hay

`rng.md:149-151`:

> «`rng_srand` (0x207E): TOWN ×2, CMDS ×1, TALK ×2.
> `rng_time_hash` (0x2056): TOWN ×1, CMDS ×1, TALK ×2 — la re-siembra con la hora DOS ocurre
> en eventos de TOWN/CMDS/TALK, **no en INTRO**.»

`INTRO.OVL` fileoff **0x0CC9** = `e8 ca 91` ⇒ CS **0x2056**; **0x0CCD** = `e8 ee 91` ⇒ CS
**0x207E**. Bytes del fichero, base validada con un control positivo (§1). La frase «no en
INTRO» es **falsa**, y es una afirmación de ausencia que nunca se midió (`ausencia-no-se-prueba-con-head`).

### 6.2 El tramo — `intro_main_controller`, en 0x0986

```
0986:  prólogo del controlador de portada
0a49-0a9f:  créditos (bucle de impresión con poll de tecla, 0x1D02)
0abd:  call CS 0x1D5E  kernel_getkey       ← PRIMER poll real de teclado
0ac1:  call CS 0x2032  to_upper
0ac7:  cmp ax,'J' ; jne 0xb06
0afd:    [g_location]=0x41 ; 0b02: jmp 0xcc9      ← camino A (saltarse el attract)
0b06:  [bp-8]=1 …  bucle de ATTRACT (0x0aa1-0x0c97 · fin del attract: logo + 4 jinetes BRITISH.PTH)
0ca3:  [g_location]=0x40
0cbb:  if [bp-8]!=0 ⇒ 0cc1 call CS 0x7CDA (return-to-view / demo)
0cc4:  [bp-8]=1                                    ← camino B (fall-through)
0cc9:  call CS 0x2056 ⇒ rng_time_hash()   ; ★★ RE-SIEMBRA
0ccd:  push ax / call CS 0x207e ⇒ srand(ax)
0cd0:  … pinta el menú (0x1C22 ×3) …
0d4d-0e44: bucle de tecla del menú
0e47:  dispatch  'A'⇒0xff4 · 'C'⇒0xfa8 (CS 0x7CCE) · 'J'⇒0xe7c · 'R'⇒0x100a · 'T'⇒0xf9c · 'U'⇒0xfe8
0e79:  tecla no válida ⇒ jmp 0xcd0                 ← re-pinta SIN volver a sembrar
```

**Los dos únicos caminos que llegan al menú pasan por `0x0CC9`.** Los seis `jmp 0xcd0` del
OVERLAY (0x0e79, 0x0f22, 0x0fe5, 0x0ff1, 0x1006, 0x100d) entran **después** de la siembra
⇒ se siembra **exactamente una vez por llegada al menú**, y siempre antes de la primera
tecla que elige opción.

`'C'` = *Create a character* ⇒ `0x0FA8 call CS 0x7CCE`. La gitana vive en **FONT.OVL**
(`pick_virtue`, en 0x0998, único `rand` del overlay en 0x09A6).

### 6.3 Consecuencia: la premisa de `gypsy.md` está REFUTADA

`gypsy.md:91-92` y `game/src/core/creation/gypsy.ts:24-25` dicen lo mismo:

> «Como al arrancar `g_rng_seed=0` y **nada re-siembra** entre el boot y la gitana (rng.md:
> **0 sitios srand/time_hash en INTRO/FONT** — los que re-siembran — e INTRO con 0 rand …),
> el bracket es **determinista** desde seed 0.»

De las tres cláusulas, **dos se confirman y una es falsa**:

| cláusula | veredicto |
|---|---|
| «INTRO con 0 rand» | ✔ **CONFIRMADA** — `near_calls_to_kernel('INTRO.OVL', 0x2092)` ⇒ `[]` |
| «FONT: el único rand es `pick_virtue`, en 0x9a6» | ✔ **CONFIRMADA** — FONT ⇒ `['0x9a6']`, y FONT tiene 0 srand/time_hash |
| «0 sitios srand/time_hash en **INTRO**» | ✘ **FALSA** — INTRO 0x0CC9/0x0CCD |

**El testigo vivo no rescata la conclusión: mide en el sitio equivocado.**
`test_gypsy_parity.py::test_seed_zero_at_title_live` lee la semilla en
`s.wait_kbd_poll()` = «el PRIMER sondeo de teclado del título». Por el trazado de §6.2 el
primer poll es el de los créditos/attract (`0x0ABD`, o el `read_key_timed` de `0x0BE1`),
**upstream de 0x0CC9**. El test mide un hecho verdadero (`g_rng_seed == 0` durante el
título) y lo extrapola a un punto que está **detrás de la re-siembra**. Es la firma de
`instrumento-equivocado-peor-que-ninguno`: el verde es real y no prueba lo que su docstring
dice que prueba.

**Lo que SÍ queda establecido y lo que NO:**

- **ESTABLECIDO (estático, byte-exacto):** en todo camino al menú de portada se ejecuta
  `srand(rng_time_hash())`; entre ese punto y `pick_virtue` no hay ningún otro escritor de
  `g_rng_seed` (§1: los únicos escritores son `srand` y `rand_range`) y **no hay ninguna
  otra llamada a `srand`** en INTRO ni en FONT.
- **NO ESTABLECIDO:** que la gitana observe una semilla distinta de 0 *en una corrida real*.
  Falta el testigo. `time_hash()` devuelve 12 bits, así que **1 de cada 4096** arranques
  daría 0 por casualidad; y no descarto que la pantalla de creación pase por algún camino
  que no he trazado.
- **Corrobora, no sostiene:** en Ultima V el emparejamiento de virtudes de la gitana **varía
  entre partidas** — conducta de jugador ampliamente conocida, incompatible con un bracket
  fijo. Lo anoto como coherencia, no como evidencia.

**Predicción falsable, pre-registrada:** una sonda que lea `g_rng_seed` **con un BP en la
entrada de `pick_virtue` (FONT `0x0998`)**, o en `INTRO 0x0CD0`, en **dos arranques a
minutos distintos**, dará **dos valores distintos, ambos en [0, 0x0FFF]**, y el bracket de
ronda 1 **NO** será `Valor–Sacrifice · Spirituality–Humility · Honesty–Justice ·
Compassion–Honor` salvo coincidencia. Si sale 0 las dos veces, mi derivación está mal y hay
que buscar el camino al menú que no pasa por 0x0CC9. ⇒ **Tarjeta T1**.

**NO toco `gypsy.ts` ni el bracket del port.** Cambiar la creación de personaje a un stream
sembrado por reloj es una decisión de diseño del lead con el mismo dilema que D6
(determinismo del port vs. calco), y además rompería arneses. Lo que hago es marcar la
premisa como refutada en `gypsy.md` y dejar la tarjeta.

---

## 7. Tabla de TECHOS — desde qué acción deja de haber paridad

| # | acción del jugador que lo dispara | condición exacta | desde ese punto |
|---|---|---|---|
| 5 | **arrancar el juego** (llegar al menú de portada) | ninguna: incondicional | **toda** la partida del original corre desde una semilla de reloj. El «seed 0» sólo vale durante el título/attract |
| 3 | **entrar a un pueblo** con un Shadowlord dentro | `g_shadowlord_locs[i] == g_location` ∧ `g_party_y != 4` | +2 re-siembras (día, luego reloj) y +N tiradas, N medido en §3.3. Los 32 rand(0,1) de posesión quedan aguas abajo |
| 2 | **hablar con cualquiera** en la ciudad de Faulinei | `g_shadowlord_here_idx == 0`; se llama al SALIR de toda conversación (0x1305) | +1 re-siembra **por conversación**, más el sorteo del botín |
| 1 | **hablar con un NPC desconocido** | bit `npcMet` limpio (TALK 0x113E) | +1 re-siembra **por conversación**; ya adjudicado (#180) |
| 4 | **acampar** y que salte la emboscada | `rand(0,63)==0` en un cruce de hora (~10,5 % / 8 h) | +1 re-siembra; el TIPO de enemigo ya es del reloj |

**Orden de aparición en una partida:** #5 antes de la primera tecla ⇒ #1 en la primera
charla ⇒ #3 la primera vez que se pisa la ciudad ocupada ⇒ #2 en cuanto esa ciudad es la de
Faulinei ⇒ #4 la primera emboscada. **El techo lo pone #5 y es total**: los otros cuatro
son re-siembras sucesivas de un stream que ya era del reloj.

### 7.1 Qué significa esto para los ESPEJOS — y qué NO

> ⚠ **Aviso de categoría, para que nadie promueva esta acta a explicación de un techo
> medido.** El espejo es un comparador de **TEXTO** (OCR del LP contra la consola del port),
> no un comparador de stream. Una re-siembra **no** vuelve un bloque no-comparable por sí
> misma. Lo que estos cinco puntos acotan es **qué LÍNEAS pueden coincidir alguna vez**, no
> el porcentaje global de conformidad. El cuello documentado de la conformidad es la
> **deriva posicional** (#117: la party del replay no está donde estaba la del LP;
> `Blocked!` = 14,1 % de las líneas en AD y 20,0 % en LP1) y esta acta **no lo toca**.

Lo que sí se puede afirmar, contado sobre las rutas de `game/e2e/espejo-tour` (grep literal
del texto del evento; incluye posibles duplicados por línea):

| familia (proxy del sitio) | LP1 | primera | AD | primera |
|---|---|---|---|---|
| «I am called» ⇒ sitio 1 | 51 | **part02** | 97 | **ad01** |
| «An air of» ⇒ sitio 3 | 38 | part06 | 51 | ad03 |
| «Ambushed!» ⇒ sitio 4 | 8 | part15 | 6 | ad04 |
| «Something was stolen» ⇒ sitio 2 | **0** | — | **0** | — |

Lecturas honestas:

1. **El sitio 2 no está atestiguado en ningún espejo.** Cero ocurrencias en los dos.
2. **El sitio 3 sí lo está, y desde part06 / ad03.** «An air of» es un *proxy*, no el
   evento: el anuncio, en 0x11B8, y la marchitación, en 0x02E7, comparten gate y orquestador,
   pero en **Stonegate** el anuncio se emite ×3 sin que haya marchitación (allí
   `g_shadowlord_here_idx` sigue 0xFF). El conteo es por tanto **cota superior**.
3. **La marchitación es material y OBSERVABLE**, no un detalle de stream: en New Magincia
   el original ara 45 parcelas de trigo y en Skara Brae mata 29 árboles. **El port pinta el
   pueblo intacto.** Eso sí es un divergente de píxel y de `(L)ook`, y explicaría
   divergencias en bloques de mirada sobre vegetación en las partes con Shadowlord — es una
   **hipótesis medible**, no un resultado: hay que contarla contra las rutas antes de
   afirmarla. ⇒ **Tarjeta T2**.
4. **El sitio 5 no acota nada del espejo** — el espejo empieza con la partida ya cargada.
   Acota los arneses **seed-exactos** y la creación de personaje.

**El techo real que fija esta acta es sobre el conjunto seed-exacto, no sobre el espejo.**
Ninguna corrida seed-exacta puede cruzar una entrada a pueblo con Shadowlord, una charla en
la ciudad de Faulinei, una charla con desconocido, ni una emboscada de acampada. La
emboscada ya estaba excluida (`deliberate-divergences.md:585`); las otras tres **no estaban
declaradas como exclusiones**.

---

## 8. Correcciones aplicadas en esta rama

Sólo prosa; **cero valores de aserción, cero código del port, cero artefactos con gate**.

| fichero | qué |
|---|---|
| `re/notes/rng.md` | censo corregido (5 time_hash / 6 srand, con INTRO), retirada la frase «no en INTRO», y declarado que **TOWN 0x022A es `srand(g_day)`, determinista**, no del reloj |
| `re/notes/camp-ambush-spec.md` | 4 puntos, en los que `0x2056`/`0x207E` se llamaban «escena/alarma de emboscada (presentación)» ⇒ su identidad real |
| `re/notes/shadowlord-urban.md` | `0x2e7 call 0x212` deja de ser «(redibujo/aux)»; §8 pasa de «0 rands» a la cuenta real + la advertencia sobre los 32 de posesión |
| `re/notes/gypsy.md` | premisa marcada como REFUTADA con la cita byte-exacta; la conclusión queda **abierta a testigo**, no invertida |
| `re/verified/gypsy.md` | ★ el tier *verified* llevaba la MISMA premisa refutada; corregida, y su Task F.2 (cierre runtime) pasa de opcional a única vía |
| `re/notes/rng.md` (2ª parte) | §nueva **«Techos de paridad — REGISTRO ÚNICO»**: la lista vive AHÍ, no en comentarios dispersos (decisión del punto 4, §10.1) |
| `re/deliberate-divergences.md` | fila del camp: «alarma» aplicada a CS 0x2056/0x207e ⇒ re-siembra; la exclusión del set seed-exacto se mantiene, cambia el motivo |

## 9. Tarjetas (señas, sin arreglar aquí)

- **T1 — ★★ Testigo de la semilla en la gitana.** BP en FONT `0x0998`, la de `pick_virtue`, o en
  INTRO `0x0CD0`; leer `g_rng_seed` en **dos arranques separados en el tiempo**. Predicción
  pre-registrada en §6.3. Cierra o refuta el bracket determinista del port. **Precondición
  del ítem siguiente.**
- **T2 — Marchitación del Shadowlord: mecánica AUSENTE.** Portar `TOWN 0x0212` (gate,
  `srand(g_day)` — que **sí** es reproducible —, 7/8 por tile, `0x2E⇒0x2B` / `0x2D⇒0x2C`
  sobre el mapa volátil). Cifras de control en §3.3; casos degenerados Moonglow/Yew (N=0),
  controles buenos New Magincia (47) / Skara Brae (29).
- **T3 — Hueco en `frontier.json` / `frontier-manual.json`, entrada TALK 0x1180.** El texto
  salta del `sfx 0x842e` al `rand(0,2)` omitiendo `0x11AB call 0x2056` + `0x11AF call
  0x207e`. Insertar entre ambos. No lo toco: artefacto con gate y semillas pegajosas (#84).
- **T4 — Declarar la re-siembra en `camp.ts`.** `campSleepStep` decide bien y calla; el
  JSDoc debe decir lo que dice `game.ts:4498` para D6. One-liner de comentario.
- **T5 — Robo de Faulinei (TALK 0x1180): flujo entero sin portar.** Ya censado como
  huérfano; §4.1 tiene la cascada completa (equipo 47⇒0 · pociones 7⇒0 · pergaminos 7⇒0 ·
  oro `rand(1,15)`). Depende de la decisión de #52.
- **T6 — Doble re-siembra en el retorno de combate urbano.** ★ DERIVADO 30-07, y la
  población es **3, no 1**. `call 0x408` tiene CUATRO call-sites en TOWN.OVL —`0x0574`,
  `0x09dc`, `0x1044`, `0x1236`— y sólo el ÚLTIMO resetea el flag antes de llamar
  (`0x122e mov byte ptr [g_unk_5958], 0xff`). Los otros TRES entran con el valor que
  quedara, así que la colocación de `0x0212`, la del Shadowlord urbano, corre dos veces por
  esas tres vías,
  no sólo por la que citaba esta acta. Sigue haciendo falta ORÁCULO para decidir si se
  calca el quirk; lo derivable ya está.
  ⚠ **Y el censo casi da CERO EN FALSO**: el disasm NO usa el nombre del ledger
  (`g_shadowlord_here_idx`) sino el marcador `g_unk_5958`, que además **no lleva prefijo
  `0x`** — así que ni buscar por nombre-de-ledger ni buscar `0x5958` encuentra nada. Hay
  que buscar por el símbolo QUE IMPRIME EL DISASM. Es la tercera variante de la familia
  hex-vs-símbolo, y la desincronización nombre-ledger↔nombre-disasm es lo que #81 va a
  arreglar al regenerar.

  ★ **RADIO MEDIDO** (mismo SHA, sobre las 219 fichas del ledger × los 28 .asm): las
  globales cuyo nombre de ledger **no existe** en el disasm y que éste llama `g_unk_XXXX`
  son **CINCO**, y son exactamente la lista de riesgo de este cero en falso:

  | dirección | nombre en el ledger | nombre en el disasm |
  |---|---|---|
  | `0x5958` | `g_shadowlord_here_idx` | `g_unk_5958` |
  | `0x65be` | `g_npc_attack_tile` | `g_unk_65be` |
  | `0xabc7` | `g_vis_tile_south` | `g_unk_abc7` |
  | `0xb114` | `g_shoppe_id` | `g_unk_b114` |
  | `0xb118` | `g_shop_accum` | `g_unk_b118` |

  (`0xabc7` es justo la que #75 dejó BLOQUEADA «por acoplamiento disasm-símbolo»: misma
  causa, ahora con la población entera al lado.) Cualquier censo de esas cinco hecho por
  el nombre del ledger firma CERO EN FALSO. ⚠ Y una cifra que NO se publica: el mismo
  barrido dejaba 106 fichas «sin acceso por ninguna de las dos formas», y es ARTEFACTO —
  se comprobaron 6 al azar y todas tienen accesos en hex crudo (`0x15fc`, `0x17f6`…):
  son datos locales de overlay que el disasm no simboliza, no globales huérfanas.

## 10. Los dos puntos del encargo que faltaban (añadido tras el re-envío de #186)

### 10.1 Punto 4 — ¿declaración en sitio único o en cada call-site? **SITIO ÚNICO.**

Decidido: **`rng.md` §«Techos de paridad — REGISTRO ÚNICO»** es la fuente; los
call-sites del port llevan **un puntero de una línea**, jamás su propia derivación.

El argumento no es de estilo, es de lo que ya pasó. El par `time_hash`+`srand` se
re-interpretó de cero en **cuatro** sitios independientes y las cuatro veces salió mal
(«escena/alarma», «redibujo/aux», omisión limpia). Cada derivación local es un intento
más de esa tirada. Además, una lista dispersa en comentarios **no se puede censar**:
no hay forma de preguntar «¿cuántos techos hay y cuáles?» ni de detectar que falta uno
—que es literalmente el defecto que abrió esta tarjeta—.

Matiz sobre el precedente: D6 declaró en el call-site (`game.ts:4498`), y eso **se
queda**. Lo que cambia es el reparto: el call-site dice *qué decide el port ahí y por
qué*, el registro dice *cuál es el conjunto de techos*. El call-site apunta al
registro; el registro no repite la decisión de cada sitio.

### 10.2 Punto 2 — alcanzabilidad en el TOUR (faltaba; sólo había medido los espejos)

**El grandtour es un arnés SOLO-PORT: no compara stream con el original, así que no
tiene paridad que perder.** Verificado: `git grep -l 'oracle|dosbox|seedExact|g_rng_seed'`
sobre `game/e2e/grandtour` da README, `mirror.py` y **`ch01-creation.spec.ts`** — ningún
capítulo de juego. Los tres techos de partida (pueblo/charla/acampada) **no acotan el
tour**, aunque el tour sí los recorre: visita las 8 ciudades de la virtud (ch03-ch09,
ch12) y hace (T)alk en todas. `camp`/`Hole up` **no aparece en ningún spec del tour**
(sólo en `commands.spec.ts` y en las rutas del espejo).

**★ Pero ch01 sí queda tocado, y es la cabeza de la cadena.** `ch01-creation.spec.ts`
afirma en su cabecera «los stats resultantes son el bracket determinista seed-0
**re-derivado del binario** en `re/verified/gypsy.md`», y exporta el checkpoint que
siembra ch02. Consecuencias, separadas con cuidado:

- **El tour NO se rompe** y no hay que tocarlo: el port es autoconsistente, sus stats
  salen de su propio stream desde su propia semilla 0, y los asertos siguen pasando.
- **Lo que cae es la palabra «re-derivado del binario»**: es una apelación a FIDELIDAD
  cuyo respaldo estático está refutado. Como descripción del PORT sigue siendo exacta.
- **`re/verified/gypsy.md` llevaba la misma premisa** —y está en el tier *verified*, no
  en notas—. Corregida en esta rama. Su propia nota ya declaraba el hueco («**NO medido
  en el primer pick**»); lo que falló fue el censo que lo tapaba. ⇒ **el cierre runtime
  de su Task F.2 deja de ser opcional**: es la única vía que sostiene o tumba el bracket.

Esto es, además, el ejemplo limpio de por qué el registro va en sitio único: la premisa
falsa vivía **en cuatro copias** (`rng.md`, `re/notes/gypsy.md`, `re/verified/gypsy.md`,
`gypsy.ts`) más una apelación en el spec del tour, y ninguna sabía de las otras.

## 11. La regla que deja esta tarjeta

> **`time_hash` + `srand` juntos NO son presentación.** El par se leyó como escena/alarma en
> `camp-ambush-spec.md` y en `deliberate-divergences.md`, como «redibujo/aux» en
> `shadowlord-urban.md`, y se omitió sin más en `frontier.json` y en la nota de la gitana.
> Cuatro autores distintos, el mismo punto ciego: **dos calls seguidos sin argumentos y sin
> retorno visible se archivan como ruido de presentación.** Son la frontera de la paridad.
> Al leer un tramo, resolver SIEMPRE la identidad de todo `call` a CS 0x2056/0x207E/0x2092
> contra `rng.md` antes de etiquetarlo.
>
> **Corolario de censo:** un censo por overlay que sólo mira los overlays donde ya se sabía
> que había algo **no puede publicarse como censo**. `rng.md` dio 3 overlays y escribió «no
> en INTRO»; correr el mismo instrumento sobre los 18 dio el cuarto y el quinto sitio. El
> control positivo (los 22 `rand_range` del kernel, que reproducen la cifra publicada)
> costaba una línea del mismo script.

---

## 12. OVERLAY DE CORRECCIONES (posterior al cierre de #186)

Sección de anexo: el cuerpo del acta se deja como se escribió y las correcciones se
acumulan aquí, para no desplazar el texto ya citado por otras notas (#84).

### 12.1 ★ §3.1 — la fórmula de `tile_addr` estaba TRANSPUESTA (por #195)

§3.1 escribía «`tile_addr` kernel `0x44A8`: `(x<<5)+y+0x6608`». **El binario hace
`(y<<5)+x+0x6608`.** La rutina es `tile_addr` en ULTIMA.EXE 0x4402; su rama de mapa
pequeño, en ULTIMA.EXE 0x449e-0x44a8, resuelve la dirección con la forma
`addr = ([bp+4] << 5) + [bp+6] + 0x6608`, y **`[bp+4]` es la `y`**, por dos vías
independientes. Una fila por sitio:

| vía | offset | qué dice |
|---|---|---|
| rama de overworld de la propia rutina | ULTIMA.EXE 0x442a, | `[bp+6]` se resta contra la global `g_chunk_origin_x` |
| rama de overworld de la propia rutina | ULTIMA.EXE 0x443b, | `[bp+4]` se resta contra la global `g_chunk_origin_y` |
| call-site de argumentos inequívocos | MAINOUT.OVL 0x06fe, | `mov al,[g_party_x]` ⇒ **primer** push |
| call-site de argumentos inequívocos | MAINOUT.OVL 0x0704, | `mov al,[g_party_y]` ⇒ **segundo** push |
| call-site de argumentos inequívocos | MAINOUT.OVL 0x0708, | `e827bb call 0xffffc232` ⇒ CS 0x4402 |

En cdecl el **último** push es el que queda en `bp+4`.

**Alcance del error.** No cambia ninguna cifra publicada por #186 (N por ciudad es un
conteo, invariante a la transposición) ni ninguna de sus adjudicaciones. Lo que cambia es
el **ORDEN DE BARRIDO** de `TOWN 0x0212`: el índice externo (que avanza de 0x20 en 0x20)
es la FILA, no la columna, así que el barrido es `for y: for x:`. Y el orden es
load-bearing porque el `rand(0,7)` se consume **sólo en los tiles elegibles**: con los ejes
al revés, para el mismo `g_day` cada elegible recibe otra tirada ⇒ muere **otro conjunto de
tiles**. Es decir, la nota transpuesta habría producido un port que acierta la
estadística (7/8) y falla el conjunto exacto — precisamente lo que la tarjeta T2 prometía
como su valor («paridad EXACTA reproducible»).

Derivación completa, controles y test dedicado en `re/notes/shadowlord-urbano-acta.md §1.2`.

### 12.2 Estado de las tarjetas de §9

| tarjeta | estado |
|---|---|
| T1 — testigo de la semilla en la gitana | **abierta** (no la toca #195/#196) |
| **T2 — marchitación** | **CERRADA** por #195 (`shadowlord-urbano-acta.md §1`) |
| T3 — hueco de `frontier*.json` en TALK 0x1180 | **abierta**, encolada como #197 (con #84 delante) |
| T4 — declarar la re-siembra en `camp.ts` | **abierta**, encolada como #197 |
| **T5 — robo de Faulinei** | **CERRADA** por #196 (`shadowlord-urbano-acta.md §2`) |
| T6 — doble re-siembra en TOWN 0x09BC | **abierta**, encolada como #197 |
