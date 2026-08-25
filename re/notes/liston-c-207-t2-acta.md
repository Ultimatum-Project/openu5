# ACTA #207 — SUB-TANDA 5, LA ÚLTIMA: `SHOPPES3` + `TALK` + `TOWN`, 7 pares, y la tarjeta CERRADA

> Rama `re/liston-c-207`, worktree `.claude/worktrees/liston-c-207`, base **main `ed79e793`**.
> Continúa `liston-c-207-acta.md` (SUB-TANDA 4, `56853217`, **no aterrizada**).
> Ejecuta el orden que la sub-tanda 3 §5 recomienda: *«1º SHOPPES3 (3) · 2º TALK (3) · 3º TOWN (1)»*.
> RETENIDA: aterriza el lead. **Con esta sub-tanda los 37 quedan leídos y #207 está COMPLETA.**

---

## 0. VEREDICTO

**7 pares · 7 (a) exacta · 0 (b) · 0 (c) · 0 (d)** — en **4 lecturas** (ritmo 0,57).

| par | fichero del port | veredicto |
|---|---|---|
| `SHOPPES3.OVL:0x01ca` | `core/shops/shops.ts:428` | **(a)** exacta — y el token `kernel` **RESUELVE** (§3.1.1) |
| `SHOPPES3.OVL:0x01ef` | `core/shops/shops.ts:426` | **(a)** exacta — el pre-bucle de 12×5, probado por enumeración |
| `SHOPPES3.OVL:0x0378` | `ui/shop-console.ts:2091` | **(a)** exacta — el *«rate·10»* **derivado del shift-and-add** |
| `TALK.OVL:0x0a78` | `core/dialogue/conversation.ts:598` | **(a)** exacta — y las *«palabrotas (≥5)»* salen de la CAÍDA, no de la rama (§3.2) |
| `TALK.OVL:0x0b0f` | `core/dialogue/conversation.ts:599` | **(a)** exacta — el offset es la CABEZA del bucle, elegida a propósito |
| `TALK.OVL:0x1191` | `core/world/faulinei-theft.ts:9` | **(a)** exacta — transcripción de 3 instrucciones, literal |
| `TOWN.OVL:0x10c7` | `core/game.ts:2007` | **(a)** exacta — el rango es el CUERPO del bucle, cerrado por su propio `jmp` |

★★★ **Y el hallazgo grande de esta sub-tanda no es un veredicto: es que la parada de la sub-tanda 2
§3.4.1 SE PUEDE LEVANTAR, y con el instrumento del propio repo** (§4.1). La identidad que aquella
acta declaró *«NO verificada»* y mandó a #95 —`MAINOUT.OVL:0x1c0b` → `kernel 0x5910`— **se resuelve
en tres líneas** con `re/tools/dispatch_table.py`, y la resolución pasa un control independiente que
la aritmética no puede fabricar. Lo mismo vale para el token `kernel` de #199 que caía en esta
tanda.

★ **Catorce cadenas más cotejadas byte a byte** contra `DATA.OVL` (25 en el carril), incluidas las
tres del panel de la posada con sus espacios finales y el `Thy friend` + `'s'` + ` will not leave
thee!` que el port anota con corchete.

## 1. RE-ANCLA

```
git log -1 main   (al abrir la tanda)   → ed79e793   = HEAD de esta rama (tras el incidente §1.2 de la sub-tanda 4)
git diff main -- game/src                → VACÍO
cita_pegajosa_atribucion.py              → 341 pares, 507 citas, 3 controles verdes   EXIT=0
cita_pegajosa_forma.py                   → matriz completa, 3 controles verdes        EXIT=0
clase2 × (FORZADA + LIMPIA)              → 3 + 50 = 53, POR MIEMBROS: 0 bajas · 0 altas · 53/53
```

Las líneas de los 7 se re-anclaron al partidor de hoy, no a la tabla del HITO 1: **las siete
coinciden** con las del hito (a diferencia de la sub-tanda 4, donde dos se habían movido). El
partidor se re-corrió después del commit de la sub-tanda 4 y la celda no se movió.

### 1.1 🔴 SEGUNDO INCIDENTE: un carril AJENO adoptó este worktree y duplicó la tanda 4

El `merge main` sin dueño que la sub-tanda 4 §1.2 declaró tiene autor. A mitad de esta tanda apareció
en `re/notes/` un fichero que yo no escribí, **staged en MI índice**, cuya cabecera dice:
*«Carril `liston-d-207`. Worktree `.claude/worktrees/liston-c-207` ADOPTADO, rama `re/liston-c-207`»*
y *«Ejecuta el orden recomendado por la sub-tanda 3 §5: 1º SJOG.OVL (5)»*. Es **el mismo encargo y
los mismos 5 pares** que yo cerré en `56853217`.

**Lo que he hecho, y sobre todo lo que NO:**

| | |
|---|---|
| su fichero | **INTACTO** en disco y en el índice. Ni `restore`, ni `checkout`, ni `rm`, ni una lectura más allá de su cabecera |
| mi commit | con **pathspec** (`git commit -- <mi ruta>`), para no arrastrar su trabajo dentro de un commit mío |
| sus veredictos | **no los he mirado**, a propósito: si el lead decide fusionar, quiere dos lecturas independientes, no una contaminada por la otra |

⚠ **La colisión add/add de actas** tiene nombre en este proyecto y su modo de fallo es
«me quedo con la más completa», que borra lo único que aportaba la otra. Mi acta cubre 12 pares y la
suya 5; **eso no la hace peor**, y la decisión es del lead. Queda avisado por mensaje, con las señas.

⚠ Y el riesgo estructural, dicho para el acta y no sólo para el chat: **dos agentes compartiendo un
índice es una bomba**. Un `git add -A` de cualquiera de los dos se lleva el trabajo del otro dentro
de su commit sin que nada chirríe. El pathspec me protege a mí; no protege al que venga después.

## 2. Los siete pares agrupan en CUATRO lecturas

| lectura | pares | rutina del binario | rutina del port |
|---|---|---|---|
| §3.1 | `:0x01ca` + `:0x01ef` | la NOCHE de la posada, `SHOPPES3.OVL:0x01b5-0x01f4` | `innNightPass` |
| §3.1.2 | `:0x0378` | el check-out de la posada, `SHOPPES3.OVL:0x032f-0x03d5` | `innLeaveChosen` |
| §3.2 | `:0x0a78` + `:0x0b0f` | el despachador de palabra clave, `TALK.OVL:0x0a60-0x0b7c` | `answerKeyword` |
| §3.3 | `:0x1191` + `:0x10c7` | robo de Faulinei `TALK.OVL:0x1180` · peligros del suelo `TOWN.OVL:0x0f48-0x10cd` | `faulinei-theft` · `townTurn` |

⚠ §3.3 junta dos rutinas de dos overlays por economía de acta, no porque compartan flujo: son las
dos últimas y cada una se lee sola. Se dice para que nadie lea una relación que no existe.

## 3. Las cuatro lecturas

### 3.1 `SHOPPES3.OVL:0x01b5-0x01f4` — la noche de la posada, instrucción a instrucción

| call-site | instrucción | destino | qué es |
|---|---|---|---|
| `SHOPPES3.OVL:0x01b5`, | `mov word ptr [bp - 8], 0xc` | — | el contador, 12 |
| `SHOPPES3.OVL:0x01ba`, | `mov si, 0xc` | — | y su copia en registro |
| `SHOPPES3.OVL:0x01bd`, | `mov ax, 5` / `push ax` / `call 0x6d9c` | — | **el paso de 5 minutos** |
| `SHOPPES3.OVL:0x01c4`, | `dec si` / `je 0x1ef` | `0x01ef` | **agotadas las 12 ⇒ al check de hora** |
| `SHOPPES3.OVL:0x01c7`, | `jmp 0x1bd` | `0x01bd` | y si no, otra vuelta |
| `SHOPPES3.OVL:0x01ca`, | `mov ax, 1` / `push ax` / `call 0x5906` | — | **el par: llamada de un argumento** |
| `SHOPPES3.OVL:0x01d1`, | `call 0x5e2c` | — | regeneración de anillos |
| `SHOPPES3.OVL:0x01d4`, | `call 0x4720` | — | repintado del panel |
| `SHOPPES3.OVL:0x01d7`, | `mov ax, 9` / `push ax` / `call 0x6d9c` | — | **el paso de 9 minutos** |
| `SHOPPES3.OVL:0x01de`, | `cmp byte ptr [g_hour], 0x14` / `je 0x1ec` | `0x01ec` | hora 20 |
| `SHOPPES3.OVL:0x01e5`, | `cmp byte ptr [g_hour], 5` / `jne 0x1ef` | `0x01ef` | hora 5, y si no, salta la llamada |
| `SHOPPES3.OVL:0x01ec`, | `call 0xffff98ba` | — | la transformación horaria de tiles |
| `SHOPPES3.OVL:0x01ef`, | `cmp byte ptr [g_hour], 6` / `jne 0x1ca` | `0x01ca` | **el bucle: repite hasta la hora 6** |

**`:0x01ef` — (a) exacta.** La cita dice *«PRE-bucle: `advance_clock(5)` ×12 = 60 min, SIN comprobar
la hora ni tocar nada más; sale por `dec si / je 0x1ef` DIRECTO al check de hora»*. Las cuatro
piezas están: el contador 12, el paso de 5 (12×5 = 60 ✓), el `dec si / je` **literal** en su offset,
y el DESTINO, `0x01ef`, que **es** el `cmp` de la hora. Y el *«SIN comprobar la hora ni tocar nada
más»* queda probado **por ENUMERACIÓN**: ENTRE `0x01bd` y el `jmp` de `0x01c7` sólo hay el push, la
llamada, el `dec` y el `je` — ni un acceso a `g_hour` ni ninguna otra llamada. Es el mismo patrón de
prueba-por-enumeración de la sub-tanda 1 §3.1.

**`:0x01ca` — (a) exacta en su FORMA, y esta vez también en su IDENTIDAD** (§3.1.1). La cita
describe el cuerpo del bucle beat a beat y los cinco beats están, en ese orden y en esos offsets:
la llamada de un argumento en `0x01ca`, la de anillos en `0x01d1`, el repintado en `0x01d4`, el paso
de 9 en `0x01d7` y el par de comparaciones de hora en `0x01de`/`0x01e5`. ★ Y el *«si `g_hour` quedó
en 0x14 (20) ó en 5»* es una **disyunción** derivada de una pareja `je`/`jne` con destinos cruzados,
no de dos ramas iguales: `0x14` salta A la llamada, `5` salta a saltársela — leerlo al revés es el
error fácil y la cita no lo comete.

Cadenas del flujo, byte a byte: DS `0x4e44` = `b'Zzzzzz....\n\n'` · DS `0x4e51` = `b'Morning!\n'`.

#### 3.1.1 ★★ El token `kernel` de #199 — DECLARADO, no aplicado, pero esta vez además RESUELTO

La cita del par contiene el **segundo y último token `kernel` del HITO 1** (el otro cayó en la
sub-tanda 2). Régimen del encargo cumplido al pie: **se declara y NO se aplica**, la celda no se
re-adjudica por él y el instrumento no se toca. Lo que sí se puede hacer —y no se había hecho— es
**medir si la cita acierta**:

| paso | medida |
|---|---|
| operando crudo del `call` de `0x01ca` | `0x5906` (REL16 `0x5735` desde IP `0x01d1`) |
| base de near-call del overlay | `0xe1e0`, de `dispatch_table.overlay_near_call_base()` |
| resultado | `(0x5906 + 0xe1e0) & 0xFFFF` = **`0x3ae6`** |
| lo que la cita dice | **`0x3ae6`** ✓ |

Y lo mismo, con la MISMA base, para los otros tres destinos que la cabecera nombra:

| offset del `call` | crudo | resuelto | la cabecera dice |
|---|---|---|---|
| `SHOPPES3.OVL:0x01d1`, | `0x5e2c` | `0x400c` | `0x400c` ✓ |
| `SHOPPES3.OVL:0x01d4`, | `0x4720` | `0x2900` | `0x2900` ✓ |
| `SHOPPES3.OVL:0x01c1` y `:0x01db`, | `0x6d9c` | `0x4f7c` | `0x4F7C` ✓ |

⚠ **Y aquí hay una trampa que casi me como.** Reproducir esos cuatro números **NO es verificarlos**:
la cabecera del port dice explícitamente que aplica esa base, así que comprobar la aritmética sólo
comprueba la aritmética. Es la familia `exclusion-circular-corpus-del-catalogo` — el asunto es que
el «resultado» y la «fuente» son el mismo cálculo. **El control tiene que venir de fuera**, y hay
uno barato: si la base es correcta, los destinos deben caer en **PRÓLOGOS** de `ULTIMA.EXE`; si está
desplazada, caerán en mitad de una instrucción o en un sitio cualquiera.

| base probada | prólogos sobre los 4 destinos |
|---|---|
| `0xe1dc` · `0xe1de` · `0xe1df` | **0/4** |
| **`0xe1e0`** (la del instrumento) | **4/4** |
| `0xe1e1` · `0xe1e2` · `0xe1e4` | **0/4** |

★ Control **positivo y negativo** en la misma corrida, con seis bases vecinas fallando. «Ser el
comienzo de una rutina en `ULTIMA.EXE`» es una propiedad del OTRO binario que ninguna aritmética
sobre el operando puede producir, así que el control es independiente.

⇒ **La cita del par es correcta.** Esto **no cierra #199** —que va del extractor tirando el token, no
de si el token acierta— pero le da un dato que la tarjeta pedía: en el único caso de esta celda que
se puede medir, el `kernel NNNN` de la cita **es** el offset del kernel, y la vía de comprobación es
mecánica y re-ejecutable.

★ **Corroboración semántica, de propina**: `ULTIMA.EXE:0x4f7c`, que la cita llama `advance_clock`,
empieza con marco de pila y el bucle lo llama con 5 y con 9 — coherente. Y `0x3ae6`, `0x400c` y
`0x2900` son las tres rutinas que el bucle llama sin argumentos o con uno, en el orden que la
cabecera enumera.

★ **Y los `call 0xffffNNNN` del mismo bucle son STUBS, resueltos por el instrumento:**

| offset | crudo | kernel | el instrumento dice | la cabecera dice |
|---|---|---|---|---|
| `SHOPPES3.OVL:0x01ec`, | `0x98ba` | `0x7a9a` | stub → `TOWN.OVL`, ENTRY `0x0170` | *«`TOWN.OVL 0x0170`»* ✓ |
| `SHOPPES3.OVL:0x01fd`, | `0x98ae` | `0x7a8e` | stub → `TOWN.OVL`, ENTRY `0x1694` | (no citado) |

La primera fila cierra la afirmación más larga de esa cabecera —*«el crudo 0x98ba → CS 0x7a9a, que
cae en la banda de stubs [0x7a16,0x81c6) y su `ljmp` va a TOWN.OVL 0x0170»*— y la cierra **por dos
vías**: leyendo el `ljmp` a mano (apunta a lineal `0x8340`) y preguntándole a `dispatch_table.stubs()`,
que devuelve el mismo destino con su número de overlay. **La banda de stubs que la cita declara es
la que el instrumento tiene codificada, `[0x7A16, 0x81C6)`, literal.**

#### 3.1.2 `SHOPPES3.OVL:0x032f-0x03d5` — el check-out, y un `×10` que hay que derivar

| call-site | instrucción | destino | qué es |
|---|---|---|---|
| `SHOPPES3.OVL:0x0318`, | `mov ax, 0x4ea0` / `push` / `call` · `mov word ptr [bp + 4], 0xfffe` | — | **nadie se queda ⇒ retorno −2** |
| `SHOPPES3.OVL:0x032f`, | `cmp word ptr [bp - 0x28], 0` / `jne 0x35a` | `0x035a` | **¿es el Avatar?** |
| `SHOPPES3.OVL:0x0335`, | `mov ax, 0x4eac` / `push` / `call` | — | `Thy friend` |
| `SHOPPES3.OVL:0x033c`, | `cmp byte ptr [g_party_size], 2` / `jbe 0x34a` | `0x034a` | **con más de 2, plural** |
| `SHOPPES3.OVL:0x0343`, | `mov ax, 0x73` / `push` / `call 0x34da` | — | ★ **la `'s'` suelta** |
| `SHOPPES3.OVL:0x034a`, | `mov ax, 0x4eb7` / `push` / `call` | — | ` will not leave thee!` |
| `SHOPPES3.OVL:0x0361`, | `cmp byte ptr [bx + 0x55b3], 0x44` / `jne 0x378` | `0x0378` | **`'D'` = muerto** |
| `SHOPPES3.OVL:0x0368`, | `mov ax, 0x2723` / `push` / `call` · `mov word ptr [bp + 4], 0xffff` | — | el texto de la morgue ⇒ retorno −1 |
| `SHOPPES3.OVL:0x0378`, | `mov bx, word ptr [g_unk_b114]` / `mov al, byte ptr [bx + 0x4d7e]` | — | **la tarifa base** |
| `SHOPPES3.OVL:0x0382`, | `mov cx, ax` / `shl ax, 1` / `shl ax, 1` / `add ax, cx` / `shl ax, 1` | — | ★ **×2, ×2, +1, ×2 = ×10** |
| `SHOPPES3.OVL:0x038f`, | `mov ax, 0x64` / … / `call 0x2262` / `call 0x22b6` | — | el 100 y la aritmética larga del regateo |
| `SHOPPES3.OVL:0x03a9`, | `add word ptr [g_unk_b118], ax` | — | **el último paso de la tarifa** |
| `SHOPPES3.OVL:0x03ad`, | `mov ax, 0x4ecf` / `push` / `call` | — | la primera cadena del panel |
| `SHOPPES3.OVL:0x03cf`, | `cmp byte ptr [bp - 0x24], 0x59` / `je 0x3d8` | `0x03d8` | **`'Y'`** |

**(a) exacta**, y el detalle que la eleva es que **`rate·10` no está escrito en el binario**: hay que
derivarlo del *shift-and-add* con que el compilador multiplica por 10 (`r*4 + r = r*5`, luego `×2`).
La cita lo dice en una palabra y la palabra es correcta. El rango `@0x378-0x3a9` CIERRA **exacto en
sus dos extremos**: `0x0378` es la carga de la tarifa y `0x03a9` es la última instrucción que la
toca, justo antes de que `0x03ad` EMPIECE a imprimir. Y las tres cadenas del panel salen byte a
byte, con sus espacios finales:

| DS | bytes |
|---|---|
| `0x4ecf` | `b'"The rate for\nour most comfortable room will be '` |
| `0x4f00` | `b'% gold per month, due at check-out.'` |
| `0x4f24` | `b'\nWilt thou take\nit?" '` |

★ **Y el corchete de la cita es una lectura fina, no una comodidad tipográfica.** Escribe
*«`Thy friend[s] will not leave thee!` DS 0x4eac/0x4eb7»*, y en el binario son **dos** cadenas
—`b'Thy friend'` y `b' will not leave thee!\n\n'`— con una `'s'` suelta (`0x73`) empujada en medio
**sólo si la party pasa de 2**. El corchete describe exactamente eso. Las otras: DS `0x4e86` =
`b'$ asks,\n"Who will\nstay?" '` (con el `$` del expansor) · DS `0x4ea0` = `b'Nobody\n\n'` ·
DS `0x4ea9` = `b'\n\n'`. Y los dos retornos que la cita nombra son literales: `0xfffe` = −2 en
`0x031f` y `0xffff` = −1 en `0x036f`.

⚠ **Lo que NO firmo**: el *«shoppe.json[192]»*. El binario empuja el puntero `0x2723` a un impresor
que resuelve a `SHOPPES.OVL:0x017a` (por el mismo instrumento de §3.1.1); **que ese puntero sea la
entrada 192 del asset extraído es una afirmación sobre la EXTRACCIÓN, no sobre el binario**, y
comprobarla es otro trabajo. El puntero sí está donde la cita dice.

### 3.2 `TALK.OVL:0x0a60-0x0b7c` — el despachador de palabra clave, y una caída que no es una rama

| call-site | instrucción | destino | qué es |
|---|---|---|---|
| `TALK.OVL:0x0a60`, | `or ax, ax` / `je 0xa9c` | `0x0a9c` | índice 0 = NAME |
| `TALK.OVL:0x0a64`, | `cmp ax, 1` / `jb 0xa78` | `0x0a78` | ⚠ **rama MUERTA** (§3.2.1) |
| `TALK.OVL:0x0a69`, | `cmp ax, 2` / `jbe 0xabe` | `0x0abe` | índices 1-2 = JOB/WORK |
| `TALK.OVL:0x0a6e`, | `cmp ax, 3` / `jb 0xa78` | `0x0a78` | ⚠ **rama MUERTA** |
| `TALK.OVL:0x0a73`, | `cmp ax, 4` / `jbe 0xae0` | `0x0ae0` | ★ **índices 3 Y 4 = BYE y THANK** |
| `TALK.OVL:0x0a78`, | `mov ax, 0x93d0` / `push` / `call` | — | **el par: la respuesta enlatada** |
| `TALK.OVL:0x0a7f`, | `call 0x4da` | — | el cierre `"` |
| `TALK.OVL:0x0a82` y `:0x0a85`, | `call 0x4d2` (dos veces) | — | **2×CR** |
| `TALK.OVL:0x0a88`, | `sub si, si` | — | el contador del tramo sin modelar |
| `TALK.OVL:0x0af4`, | `cmp si, 0x1c` / `jge 0xa94` | `0x0a94` | ★ **0x1c = 28 vueltas** |
| `TALK.OVL:0x0af9`, | `jmp 0xa8a` | `0x0a8a` | cierra ese bucle |
| `TALK.OVL:0x0b04`, | `push bp` / `mov bp, sp` / `sub sp, 8` | — | **prólogo del LLAMADOR** |
| `TALK.OVL:0x0b0f`, | `mov byte ptr [0x4af2], 0` | — | **el par: la cabeza del bucle de pregunta** |
| `TALK.OVL:0x0b14`, | `mov ax, 0x9408` / `push` / `call` | — | la pregunta |
| `TALK.OVL:0x0b78`, | `or di, di` / `je 0xb0f` | `0x0b0f` | **la re-pregunta** |

Cadenas, byte a byte: DS `0x93d0` =
`b'"With language like that, how did you become an Avatar?'` · DS `0x93c2` = `b'"My name is '` ·
DS `0x9408` = `b'Your interest?\n:'` · DS `0x9420` = `b'"I cannot help thee with that.'`.

**`:0x0a78` — (a) exacta, y con cuatro afirmaciones comprobadas una a una.** La cadena está EN el
offset citado; el *«cierre `"` (0x4da)»* es la llamada inmediatamente siguiente y su offset es el que
dice; el *«2×CR»* son **dos llamadas idénticas** consecutivas a la misma rutina, no una repetición
retórica; y el *«NO termina»* se ve porque la rama sigue al tramo de `0x0a88` y sale por el epílogo
de la rutina en vez de por el cierre de conversación.

★ Y el paréntesis —*«El TRAMO, 0xa88-0xaf9 — bucle de 28 iteraciones sobre llamadas kernel sin
strings … queda sin modelar»*— sale **entero**: `0x0a88` es el `sub si, si`, `0x0af9` es el `jmp`
que cierra el bucle, el tope es `0x1c` = **28** y dentro no hay ni un `mov ax, <puntero de cadena>`.
Es una declaración de hueco **con sus dos extremos y su cuenta medidos**, que es la forma cara de
declarar un hueco y la única que sirve.

★★ **Y el mapa de índices sale 5/5**, que es lo que hace esta cita difícil de dar por buena sin
mirar: `0` → NAME, `1`-`2` → JOB/WORK, `3`-`4` → BYE **y THANK al mismo destino**, `≥5` → el par. La
cita afirma exactamente eso (*«THANK (índice 4) despacha al MISMO handler que BYE (TALK 0xae0)»* y
*«las palabrotas (≥5)»*), y las dos mitades salen del mismo `cmp ax, 4 / jbe 0xae0`.

#### 3.2.1 ⚠ La rama hermana que el partidor eligió NO SE PUEDE EJECUTAR

El partidor ancla este par en dos RAMAS: `0x0a67` `jb 0xa78` y `0x0a71` `jb 0xa78`. **Ninguna de las
dos puede dispararse.** En `0x0a67` la condición es `ax < 1`, y `ax == 0` ya se fue a `0x0a9c` en
`0x0a60`; en `0x0a71` la condición es `ax < 3`, y a esa altura `ax > 2` por el `jbe` de `0x0a6c`.
Son las comparaciones redundantes que el compilador de C emite al bajar un `switch` a un árbol.
**A `0x0a78` se llega por la CAÍDA del último `jbe`**, no por ninguna rama.

⇒ Consecuencia para el instrumento, declarada y **sin tocarlo**: la «rama hermana» del par existe en
el desensamblado pero no en la ejecución, así que la FORMA `PREFIJO-bifurca` que el partidor le
asigna describe el layout, no la conducta. **No invalida el par ni el veredicto** —la cita habla del
handler, y el handler es alcanzable y correcto—, pero es la misma familia que
`backedge-no-es-bucle`: *sólo 4 de 11 iteraban; el resto es layout del compilador*. Aquí, de dos
ramas hermanas, **cero** se ejecutan. Material para quien recalibre la FORMA; **no** propongo
recalibrarla desde un caso.

**`:0x0b0f` — (a) exacta, y el offset está elegido con criterio.** La cita dice *«el bucle
re-pregunta "Your interest?" (0xb0f)»*. En `0x0b0f` no está la cadena: está el `mov byte [0x4af2], 0`
que **encabeza** el bloque de pregunta, y la cadena se carga cinco bytes más abajo. Pero `0x0b0f`
**es el destino del `je` de `0x0b78`**, o sea el punto exacto por el que el bucle vuelve a preguntar
— que es literalmente lo que la frase afirma. CITAR `0x0b14` habría nombrado la cadena y perdido el
punto de reentrada. Es lo contrario de una imprecisión: la afirmación es sobre el BUCLE y el offset
es el del bucle. ★ Y el prólogo de `0x0b04` CONFIRMA que `0x0b0f` VIVE en la rutina LLAMADORA, no en
la del handler, que es lo que hace verdadero el *«NO termina»* de la línea de arriba.

### 3.3 Las dos últimas: el robo de Faulinei y los peligros del suelo

| call-site | instrucción | destino | qué es |
|---|---|---|---|
| `TALK.OVL:0x1180`, | `push bp` / `mov bp, sp` / `sub sp, 2` | — | **el prólogo** ⇒ la rutina empieza ahí ✓ |
| `TALK.OVL:0x1187`, | `cmp byte ptr [g_unk_5958], 0` / `je 0x1191` | `0x1191` | el gate del Shadowlord |
| `TALK.OVL:0x118e`, | `jmp 0x1278` | `0x1278` | no es Faulinei ⇒ fuera |
| `TALK.OVL:0x1191`, | `mov ax, 0x94dc` / `push` / `call` | — | **el par: el aviso del robo** |
| `TOWN.OVL:0x0f48`, | `mov word ptr [bp - 2], 0` | — | **la cabeza del bucle** |
| `TOWN.OVL:0x0f57`, | `push` / `push` / `call` (dirección de tile) / `mov al, byte ptr [bx]` | — | ★ **la RE-LECTURA del tile** |
| `TOWN.OVL:0x10ac`, | `cmp word ptr [bp - 8], 0xbc` / `je 0x10ba` | `0x10ba` | chimenea |
| `TOWN.OVL:0x10b3`, | `cmp word ptr [bp - 8], 0x8f` / `jne 0x10c7` | `0x10c7` | lava, y si no **al par** |
| `TOWN.OVL:0x10c1`, | `mov ax, 0x2780` / `push` / `call` | — | el aviso |
| `TOWN.OVL:0x10c4`, | `call` (daño a la party) | — | el último de los beats citados |
| `TOWN.OVL:0x10c7`, | `cmp word ptr [bp - 2], 0` / `je 0x10d0` | `0x10d0` | **el par: la condición del bucle** |
| `TOWN.OVL:0x10cd`, | `jmp 0xf48` | `0x0f48` | ★ **y vuelve a la cabeza** |

**`TALK.OVL:0x1191` — (a) exacta.** La cita es una **transcripción de tres instrucciones**
(`1187 cmp / 118c je 0x1191 / 118e jmp 0x1278`) y las tres coinciden en offset, mnemónico y
operando; el par es el destino del `je`, y en él está el `mov` de la cadena que la línea siguiente
anuncia. DS `0x94dc` = `b'\nSomething was stolen!\n'`, byte a byte ✓, con sus dos saltos de línea.
Y el prólogo de `0x1180` SOSTIENE la cabecera: la rutina empieza donde dice.

⚠ Declarado, no adjudicado: la cita llama a `DS 0x5958` **`g_shadowlord_here_idx`**, y ni
`globals.json` ni el desensamblado le dan ese nombre (sale como `g_unk_5958`). El **uso** que la
cita describe —comparar contra 0 para saber si el Shadowlord presente es el índice 0— es lo que hace
el binario, así que la cita no miente; lo que hay es un **nombre propuesto en prosa que el catálogo
no tiene**. Es material de **#191** (corroborar la banda contra el catálogo), gemelo exacto del
`g_hull` que la sub-tanda 2 §4.3 encontró: **el port acierta y el ledger no lo cubre.** Segundo caso
del mismo género en el mismo carril.

**`TOWN.OVL:0x10c7` — (a) exacta, y el rango es el mejor cerrado de la tanda.** La cita dice
*«Bucle de peligros del SUELO, (0x0f48-0x10c7): el tile se RE-LEE por vuelta porque caer por una
trampilla cambia de planta»*. Los dos extremos son **estructurales**, no APROXIMADOS: `0x0f48` es el
destino del `jmp 0xf48` de `0x10cd` (o sea, la cabeza del bucle **definida por su propio salto
hacia atrás**) y `0x10c7` es la comparación que decide si se da otra vuelta. Y el *«se RE-LEE por
vuelta»* está **derivado**: la lectura de coordenadas y la llamada que devuelve la dirección del
tile viven **dentro** del rango, en `0x0f4d-0x0f5c`, así que cada iteración vuelve a leer el mapa.
No es una descripción: es lo único que puede pasar.

★ Y el bloque vecino que la misma función cita —*«Fireplace 0xBC / Lava 0x8F … 10ac-10c4, →
rand(1,8)/miembro»*— sale entero: los dos inmediatos son `0xbc` y `0x8f` en `0x10ac`/`0x10b3`, el
rango cierra en `0x10c4`, DS `0x2780` = `b'Burning!\n'` byte a byte, y la tirada **está en el
callee**: la llamada de `0x10c4` RESUELVE (misma vía de §3.1.1, base de `TOWN.OVL` = `0x81d0`) a
`ULTIMA.EXE:0x2aa8`, que es un prólogo, recorre la party con stride `0x20` saltándose a los muertos
(`cmp byte ptr [di], 0x44`) y empuja **`1` y luego `8`** a la rutina de tirada. **`rand(1,8)` por
miembro, literal** — y con el orden de argumentos que la regla `rand-range` fija (el primer push es
el mínimo).

⚠ Anotado: la tirada **no está en el rango citado**, está en el callee. La cita lo escribe como
efecto del rango y eso es correcto como descripción del comportamiento, pero es exactamente la
configuración que **#218** vigila (*«censos 0 rand que sólo cuentan el CUERPO y no sus CALLEES»*).
Aquí no hay defecto —la cita atribuye la tirada, no la niega—, pero el caso vale como control
POSITIVO para esa tarjeta: un rango cuyo consumo de RNG vive una llamada más abajo.

## 4. Lo declarado, que no es veredicto

### 4.1 ★★★ La parada de la sub-tanda 2 §3.4.1 SE LEVANTA — y con el instrumento del repo

Aquella acta escribió, sobre `MAINOUT.OVL:0x1c0b`: *«Lo que no [queda verificado]: que el destino sea
la rutina que la cita nombra. El operando es un desplazamiento cuyo destino cae muy por encima del
fin de `MAINOUT.OVL` … y su resolución es el problema abierto de #95.»* Y añadió, con razón, que el
censo de 17 call-sites que había hecho **no** era un control positivo.

**El destino se resuelve, y la resolución pasa el mismo control independiente de §3.1.1:**

| paso | medida |
|---|---|
| bytes en `MAINOUT.OVL:0x1c0b` | `e8 32 bb` ⇒ `rel16 = −17614`, destino base-0 `0xd740` |
| base de near-call de `MAINOUT.OVL` | `0x81d0`, de `dispatch_table.overlay_near_call_base()` |
| resultado | `(0xd740 + 0x81d0) & 0xFFFF` = **`0x5910`** |
| lo que la cita decía | **`0x5910`** ✓ |

| base probada | ¿prólogo en `ULTIMA.EXE`? |
|---|---|
| `0x81cc` · `0x81ce` · `0x81cf` | no (media instrucción, un `ret`, un `nop`) |
| **`0x81d0`** | **`push bp` / `mov bp, sp` / `sub sp, 0xa`** — y la instrucción anterior es un `ret` ⇒ frontera de rutina limpia |
| `0x81d1` · `0x81d2` · `0x81d4` | no |

★ **Y hay una corroboración SEMÁNTICA que no buscaba**: la rutina de `0x5910` arranca comparando
`g_time_spell` contra `0x54` = `'T'`, que es el gate de **An Tym** documentado en #177 (*«An Tym
congela terreno/fuego/banderas/viento»*). Una rutina cuyo primer acto es preguntar por el hechizo de
parar el tiempo **es** un tick de mundo, que es justo lo que la cita afirmaba. Tres vías —aritmética
del instrumento, control de prólogo con seis bases fallando, y semántica del cuerpo— y las tres
coinciden.

⚠ **Lo que esto NO es.** **No cierra #95**, y quiero que quede escrito con precisión: #95 va de la
banda de **BOOTSTRAP** (`CS ≥ 0x81D0`), donde `resolve_near_call` miente *en tiempo de arranque*.
Los destinos de §3.1.1 y de aquí caen en `0x2900`-`0x5910`, muy por debajo de esa banda, así que
**nunca necesitaron #95**: la sub-tanda 2 mandó a una tarjeta abierta un caso que la tarjeta no
cubría. La lección es de método y es incómoda: **antes de archivar algo como «bloqueado por la
tarjeta X», comprobar que el caso cae dentro del alcance de X.** Familia
`cota-superior-promovida-a-mecanismo`, en su variante «bloqueo heredado más ancho que su motivo».

⚠ **Y tampoco re-adjudico el par de la sub-tanda 2.** Aquel par ya está cerrado como **(a) en su
forma** y su acta está en main; lo que aporto es que **su «no verificado» puede retirarse**, y la
decisión de retirarlo es del lead, no mía. Se deja la medida y las tres vías, no se toca el veredicto
ajeno.

### 4.2 Balance del carril contra las tarjetas que toca

| tarjeta | qué le deja este carril | ¿la cierra? |
|---|---|---|
| **#199** | el 2º token `kernel` **declarado y no aplicado**, y **medido correcto** por vía re-ejecutable (§3.1.1) | **No** — va del extractor, no del acierto |
| **#95** | que dos de los tres «bloqueados por #95» de este carril **no caían en su alcance** (§4.1) | **No**, y se acota su alcance |
| **#191** | segundo caso de «el port nombra una global que el ledger no tiene» (`g_unk_5958`, tras `g_hull`) | **No** — material |
| **#217/#84** | el par `SJOG.OVL:0x0ee4`, primer `LIMPIA` con overlay equivocado y sus cifras (sub-tanda 4 §3.3) | **No** — material |
| **#184** | que la banda `g_location >= 0x7f` **no es mazmorra**, derivado por la cabecera de la rutina (sub-tanda 4 §3.2) | **No** — acota |
| **#218** | un control POSITIVO: rango citado cuyo `rand(1,8)` vive en el callee (§3.3) | **No** — material |
| **#150** | tercera instancia de la familia, ahora sobre `g_location` (sub-tanda 4 §3.2) | **No** — material |

## 5. ★ CIERRE DE #207 — el balance de los 37, compuesto de las cinco actas

| sub-tanda | acta | pares | lecturas | (a) | (b) | (c) | (d) |
|---|---|---|---|---|---|---|---|
| 1 | `liston-207-t2-acta.md` | 10 | 4 | 10 | 0 | 0 | 0 |
| 2 | `liston-b-207-sub2-acta.md` | 10 | 4 | 10 | 0 | 0 | 0 |
| 3 | `liston-b-207-sub3-acta.md` | 5 | 3 | 5 | 0 | 0 | 0 |
| 4 | `liston-c-207-acta.md` | 5 | 3 | 3 | 1 | 0 | 1 |
| **5** | **esta** | **7** | **4** | **7** | **0** | **0** | **0** |
| **TOTAL** | | **37** | **18** | **35** | **1** | **0** | **1** |

**Ritmo del conjunto: 0,49 lecturas por par** — o sea que los 37 pares se leyeron en **18** lecturas,
porque agrupar por fichero del port agrupó por rutina del binario **en las cinco sub-tandas, sin una
sola excepción**. Ésa es, medida, la razón por la que la lectura par a par de una celda entera cabe
en un carril y no en cinco.

**Y la pregunta que la tarjeta hacía tiene respuesta.** #207 decía: *«de los 76 pares leídos par a
par salieron 2 defectos de mecánica + 1 (b) + 1 (d); de los 37 automáticos, nada — lo esperable de un
criterio que no mira el binario»*. Leídos los 37:

| | leídos par a par (los 76 de #174) | los 37 de #207 |
|---|---|---|
| defectos de MECÁNICA (c) | **2** | **0** |
| (b) | 1 | **1** |
| (d) | 1 | **1** |

⇒ **El criterio automático de #172 no ocultaba ningún defecto de mecánica en esta celda.** Los 35
(a) confirman su cierre en bloque. Pero **no salió «nada»**: salieron un (b) y un (d), y los dos son
**del mismo tipo que sólo la lectura puede ver** —una etiqueta semántica refutada por la cabecera de
su propia rutina, y un par cuyo overlay es el equivocado—, porque los dos son **correctos byte a
byte** y ningún criterio que mire la forma de la rama hermana puede distinguirlos de un (a).

★★ **El rendimiento real de este carril no está en la columna de veredictos.** Está en los **nueve
declarados** que la lectura destapó de paso y que ninguna tanda automática habría producido: el
contraejemplo del eje `LIMPIA`, la resolución de los near-calls que dos actas habían dado por
bloqueada, los dos avisos al catálogo de globales, las tres imprecisiones de puntero medidas contra
frontera de instrucción, la rama hermana inejecutable, y los dos errores propios declarados. Un
carril de lectura paga en **hallazgos sobre los instrumentos**, no en veredictos.

### 5.1 Lo que #207 deja ABIERTO, con dueño

- **#217/#84** — barrer la banda buscando más `LIMPIA` con overlay ajeno. La firma está descrita
  (fichero cuyo overlay de casa no aparece en la ventana + una referencia cruzada cerca) y **no la
  he barrido**: 12 pares no son un censo.
- **#199** — sigue siendo del extractor. Los dos tokens de la celda quedan declarados y uno medido.
- **#191** — dos casos (`g_hull`, `g_unk_5958`) esperando que la tarjeta decida cómo se usa el aviso.
- **decisión del LEAD** — si el «no verificado» de `liston-b-207-sub2-acta.md` §3.4.1 se retira a la
  vista de §4.1. **Yo no toco acta ajena.**

## 6. Lo que esta sub-tanda NO ha hecho

- **No ha tocado `game/src`, `re/tools` ni `re/ledger`.** Cero líneas. Sólo `re/notes/`.
- **No ha aplicado** el token `kernel` (§3.1.1): declarado y medido, jamás aplicado.
- **No ha repetido** el censo de call-sites del destino que la sub-tanda 2 midió que no valía.
- **No ha re-adjudicado** ningún par de las sub-tandas 1-3, ni ha editado sus actas (§4.1).
- **No ha cerrado** #95, #199, #191, #217, #184 ni #218; a las seis les deja material.
- **No ha barrido** la banda ni ha tocado la política pegajosa.
- **No ha abierto tarjeta nueva.**

## 7. Gates (EXIT por separado, sin pipes, re-corridos tras el `git add`)

```
python3 re/tools/seed_gate.py                        EXIT=0
python3 -m pytest re/tools/test_frontier.py -q       EXIT=0   (44 passed)
python3 -m pytest re/tools/test_genero.py -q         EXIT=0   (45 passed)
python3 -m pytest re/tools/test_cita_segmento.py -q  EXIT=0   (8 passed)
python3 re/tools/genero.py                           EXIT=0
python3 re/tools/cita_pegajosa_forma.py              EXIT=0   (3 controles verdes)
python3 re/tools/cita_pegajosa_atribucion.py         EXIT=0   (3 controles verdes, 341 vs 341)
```

`game/src` no se ha tocado ⇒ no aplican `tsc` ni `vitest`. Sin e2e (mutex ajeno).
`routine-census.json` NO regenerado (EMBARGO). `pytest re/tools` COMPLETO no corrido (REGLA 3).

---

## 8. Nombres de overlay usados aquí (sección FINAL a propósito)

Al final por el ctx pegajoso de #84. Overlays nombrados: `DATA.OVL`, `MAINOUT.OVL`, `SHOPPES.OVL`,
`SHOPPES3.OVL`, `SJOG.OVL`, `TALK.OVL`, `TOWN.OVL`, `ULTIMA.EXE`.
