# ACTA #207 — SUB-TANDA 1 DE LECTURA (los 37): 10 pares, 4 lecturas

> Rama `re/liston-207`, worktree `.claude/worktrees/liston-207`, base **main `994d4fc2`**.
> Continúa `liston-207-acta.md` (HITO 1, `f9471ecd`), que enumeró la celda y derivó los 37.
> Nombre `-t2` por la convención del encargo; es la **primera** sub-tanda de LECTURA.

---

## 0. VEREDICTO

**10 pares · 10 (a) · 0 (b) · 0 (c) nuevo · 0 (d)** — con **4 lecturas** (ritmo **0,40**), porque
ocho de los diez salen de dos rutinas (§2). Y tres cosas declaradas que no son veredicto:

| | qué |
|---|---|
| **1 imprecisión de NOTACIÓN** | `CMDS.OVL:0x1b78`: la cita dice `jle` y el binario tiene `or ax,ax` + `jg` (§3.1) |
| **1 «no verificado»** | `COMBAT.OVL:0x0d08`: la ASIGNACIÓN de semántica a los dos entradas de salida (§3.3) |
| **1 disputa VIVA con tarjeta** | *«Mix NO toca RNG»* del mismo docblock — es de **#105**, y **no se puede resolver desde aquí** (§3.1.1) |

| par | fichero del port | veredicto |
|---|---|---|
| `CMDS.OVL:0x1b78` | `main.ts:2717` | **(a)** en sustancia; imprecisión de notación declarada (§3.1) |
| `CMDS.OVL:0x1b81` | `main.ts:2718` | **(a)** exacta — el print ESTÁ en el offset citado |
| `CMDS.OVL:0x1bf6` | `main.ts:2719` | **(a)** exacta — el «se gastan igual» probado por ORDEN |
| `COMBAT.OVL:0x0d08` | `core/combat/combat.ts:1082` | **(a)** exacta — y el port modela ADEMÁS el latch |
| `LOOKOBJ.OVL:0x0a2a` | `core/game.ts:5356` | **(a)** exacta — string, coords y «empate pierde» |
| `OUTSUBS.OVL:0x076e` | `core/quest/lordbritish.ts:69` | **(a)** exacta — STR, roster+0x0C |
| `OUTSUBS.OVL:0x07be` | `core/quest/lordbritish.ts:69` | **(a)** exacta — DEX, roster+0x0D |
| `OUTSUBS.OVL:0x07d2` | `core/quest/lordbritish.ts:70` | **(a)** exacta — INT, roster+0x0E |
| `OUTSUBS.OVL:0x07b6` | `core/quest/lordbritish.ts:170` | **(a)** exacta — la comparación de `'M'` |
| `OUTSUBS.OVL:0x07e6` | `core/quest/lordbritish.ts:170` | **(a)** exacta — la copia +0x0e → +0x0f |

★★ **Y un CONTROL POSITIVO que salió solo de la tanda** (§4): la base del roster, `DS 0x55a8`, queda
derivada **por dos overlays independientes que no se citan entre sí** y las dos derivaciones
coinciden. No se buscaba; es lo que hace que estas diez lecturas se sostengan unas a otras.

## 1. RE-ANCLA de esta sub-tanda, sobre LA BANDA ENTERA

```
git log -1 main                → 994d4fc2   (sin cambios desde el HITO 1)
cita_pegajosa_forma.py         → matriz idéntica, 3 controles verdes   EXIT=0
cita_pegajosa_atribucion.py    → 345 pares, 3 controles verdes          EXIT=0
clase2 F+L                     → 3 + 50 = 53, y los 53 MIEMBROS reproducen los del HITO 1
```

Comparado **por miembros y sobre la banda entera**, no por conteo de la celda propia — la lección
de `sueltos-174-cierre-acta` §2. Cero altas, cero bajas, cero movidos.

## 2. Los diez pares agrupan en CUATRO lecturas

| lectura | pares | rutina del binario | rutina del port |
|---|---|---|---|
| §3.1 | `CMDS.OVL:0x1b78` + `:0x1b81` + `:0x1bf6` | cola de Mix, `CMDS.OVL:0x1b60-0x1c1f` | `askMixQuantity` |
| §3.2 | `OUTSUBS.OVL:0x076e` + `:0x07be` + `:0x07d2` + `:0x07b6` + `:0x07e6` | aparición de campamento, `OUTSUBS.OVL:0x0740-0x07fb` (+ `0x08fc`) | `campApparition` |
| §3.3 | `COMBAT.OVL:0x0d08` | cola del bucle de combate, `COMBAT.OVL:0x0cb0-0x0d1f` | `over` / `maybeLatchVictory` |
| §3.4 | `LOOKOBJ.OVL:0x0a2a` | bola de cristal, `LOOKOBJ.OVL:0x09f6-0x0a3e` | `crystalBall` |

★ **El agrupamiento por FICHERO del port volvió a ser agrupamiento por RUTINA**, como midió
`sueltos-174-acta` §2. Aquí es más fuerte todavía: **el grupo de `OUTSUBS` son 5 pares en UNA
lectura** (dos docblocks distintos del mismo fichero describiendo la misma rutina del binario).

## 3. Las cuatro lecturas

### 3.1 `CMDS.OVL:0x1b60-0x1c1f` — la cola de Mix, leída entera

| call-site | instrucción | destino | qué es |
|---|---|---|---|
| `CMDS.OVL:0x1b6b`, | `call 0x1a70` | — | el `How much?` (DS 0x8f72), lee el número |
| `CMDS.OVL:0x1b71`, | `or ax, ax` / `jg 0x1b78` | `0x1b78` | N > 0 ⇒ sigue |
| `CMDS.OVL:0x1b75`, | `jmp 0x1c11` | `0x1c11` | **N ≤ 0 ⇒ al epílogo, SIN imprimir** |
| `CMDS.OVL:0x1b78`, | `cmp word ptr [bp - 2], 0` / `jne 0x1b81` | `0x1b81` | máscara ≠ 0 ⇒ hay reagentes |
| `CMDS.OVL:0x1b7e`, | `jmp 0x1c0a` | `0x1c0a` | máscara VACÍA |
| `CMDS.OVL:0x1b81`, | `mov ax, 0x8ff0` / `push ax` / `call 0x58d0` | — | **imprime `Mixing...`** |
| `CMDS.OVL:0x1b9f`, | `mov cx, 0x80` / `sub si, si` | — | bit alto primero, 8 reagentes |
| `CMDS.OVL:0x1baa`, | `test cx, di` / `je 0x1bb4` | `0x1bb4` | ¿reagente marcado? |
| `CMDS.OVL:0x1bb0`, | `sub byte ptr [si + 0x5850], al` | — | **consume N del reagente si** |
| `CMDS.OVL:0x1bb7`, | `cmp si, 8` / `jl 0x1baa` | `0x1baa` | 8 vueltas exactas |
| `CMDS.OVL:0x1bc2`, | `cmp word ptr [bp - 4], 0` / `jl 0x1bf6` | `0x1bf6` | sin hechizo elegido ⇒ falla |
| `CMDS.OVL:0x1bcb`, | `mov al, byte ptr [bx + 0x1cc0]` | — | máscara REQUERIDA, tabla `0x1cc0` |
| `CMDS.OVL:0x1bd1`, | `cmp ax, word ptr [bp - 2]` / `jne 0x1bf6` | `0x1bf6` | **no casa ⇒ falla** |
| `CMDS.OVL:0x1bd6`, | `mov ax, 0x8ffc` / `push ax` / `call 0x58d0` | — | imprime `Done!` |
| `CMDS.OVL:0x1be3`, | `add byte ptr [bx + 0x57f0], al` | — | **la CARGA (+N)** |
| `CMDS.OVL:0x1be7`, | `cmp byte ptr [bx + 0x57f0], 0x63` / `jbe 0x1c11` | `0x1c11` | tope 99 |
| `CMDS.OVL:0x1c0a`, | `mov ax, 0x9004` / `push ax` / `call 0x58d0` | — | imprime `Nothing to mix!` |

Cadenas cotejadas byte a byte contra `DATA.OVL` (fileoff = DS + 0x10):

| DS | bytes | la cita dice |
|---|---|---|
| `0x8f72` | `'How much? '` | ✓ y el port hace `hud.echo("How much? ")`, **con el espacio final** |
| `0x8ff0` | `'Mixing...\n'` | ✓ |
| `0x8ffc` | `'\nDone!\n'` | ✓ |
| `0x9004` | `'\nNothing to mix!\n'` | ✓ |
| `0x8f7e` | `'Insufficient reagents!\n\n'` | ✓ |

**`CMDS.OVL:0x1b81` — (a) exacta.** El `print` está literalmente EN el offset citado, no cerca.

**`CMDS.OVL:0x1bf6` — (a) exacta, y el *«se gastan igual sin carga»* queda probado por ORDEN, no
por impresión**: el bucle de consumo (`0x1b9f-0x1bba`) corre **antes** del cotejo de máscara
(`0x1bc2`/`0x1bd1`), y las dos ramas de fallo saltan a `0x1bf6`, que está **después** del
`add [bx+0x57f0]` de `0x1be3`. Los reagentes ya están restados y la carga no se suma. Es el mismo
patrón de prueba-por-orden que `sueltos-174-acta` §3.2.

**`CMDS.OVL:0x1b78` — (a) en su sustancia, con imprecisión de NOTACIÓN declarada.** La cita escribe
*«N<=0 aborta en silencio (`0x1b71` `jle`)»*. En el binario el `0x1b71` es **`or ax, ax`** y el salto es
**`jg 0x1b78`** en `0x1b73`: el aborto es la **caída** del `jg`, no un `jle`. El offset es correcto
(es el inicio del test), el mecanismo es correcto y el *«en silencio»* se sostiene **por
enumeración**: entre el `0x1b75` y el `ret` de `0x1c1f` no hay ni un `push` de inmediato de cadena ni
una llamada al impresor `0x58d0`. Lo que sobra es el mnemónico. **Misma resolución que el precedente
`sueltos-174-acta` §3.4**: (a) en sustancia con la imprecisión escrita, no (b) — no hay derivación
que acercar.

#### 3.1.1 ⚠ *«Mix NO toca RNG»* — de la misma cabecera, y NO adjudicable desde aquí

El docblock cierra con *«Mix NO toca RNG»*. **No es lo que cita ninguno de los tres pares**, pero
la regla dice leer la cabecera entera antes de cobrar nada, así que se mira — y lo que se ve es que
**la afirmación no se puede resolver en este overlay**:

| call-site | instrucción | por qué no cierra |
|---|---|---|
| `CMDS.OVL:0x1bf6`, | `mov ax, 0xa` / `push ax` / `call 0x573a` | destino **fuera** de `CMDS.OVL` |
| `CMDS.OVL:0x1bfd`, | `call 0x7a7c` | destino **fuera** de `CMDS.OVL` |
| `CMDS.OVL:0x1c04`, | `push word ptr [g_cmb_scratch_x]` / `call 0x7050` | destino **fuera** de `CMDS.OVL` |

`CMDS.OVL` termina en **`0x1d0e`** (medido: última línea del `.asm`). Los tres destinos —`0x573a`,
`0x7a7c`, `0x7050`— están muy por encima ⇒ son **llamadas inter-segmento al kernel**, y su
resolución es exactamente el problema abierto de **#95** (`resolve_near_call` en la banda de
arranque) y la trampa de `ultima-exe-disasm-ceiling` (los labels de overlay son file-relativos y
mienten). **Probé a leer `ULTIMA.EXE` en esos tres offsets literales y sale basura desalineada** —
no es que no haya rand, es que **el offset literal no es la rutina**. ⇒ **No firmo ni «hay rand» ni
«no hay rand».**

⇒ Va **a #105**, que existe justo para esto (*«Mix con reagentes INCORRECTOS lanza la rutina de
TRAMPA (0x2FD0) — y cmds.md §12 “0 rand” es un defecto del censo»*) y que **ha cerrado mientras
se escribía esta acta**, dejando #214 como su cola de arreglo. **No es un (c) nuevo de esta tanda**, y esta acta **no lo re-adjudica**. Lo que sí aporta,
y no estaba escrito, es el dato de alcance: **la rama de fallo, la de `0x1bf6`, NO es un no-op**, hace tres
llamadas, y el docblock del port la describe como si sólo omitiera la carga.

★ **CORROBORACIÓN CRUZADA, llegada mientras se escribía esta acta.** El carril de #105 ha abierto
**#214** (*«Cablear la TRAMPA de Mix (CMDS 0x1c04 → chestTrap) — BLOQUEADA por el embargo de
`main.ts` + mueve el stream RNG»*), y nombra **exactamente el tercero de mis tres call-sites**,
`CMDS.OVL:0x1c04`. Las dos lecturas son independientes —yo llegué por leer la cola de Mix entera
sin saber de esa tarjeta, y me detuve declarando que no podía resolver el destino— y **coinciden en
el mismo call-site**. Eso convierte mi «no firmo ni sí ni no» en el resultado correcto por la razón
correcta: **el destino sí era resoluble, pero no desde `CMDS.OVL`**, y quien lo resolvió tenía la
pieza que a mí me faltaba. ⇒ el docblock de `main.ts:2719` queda con un defecto CONFIRMADO por otro
carril (*«Mix NO toca RNG»* es falso) y **con tarjeta viva y dueño (#214)**; esta acta **no lo
toca**, y la única corrección de alcance que aporta es que el defecto no está en la rama de éxito
sino en la de fallo, la que arranca en `0x1bf6`.

### 3.2 `OUTSUBS.OVL:0x0740-0x07fb` — la aparición del campamento, cinco pares de una vez

| call-site | instrucción | destino | qué es |
|---|---|---|---|
| `OUTSUBS.OVL:0x0752`, | `mov ax, 1` / `push` / `mov ax, 3` / `push` / `call 0x7e02` | — | **`rand(1,3)`**, primer push = MIN |
| `OUTSUBS.OVL:0x075d`, | `cmp ax, 1` / `je 0x76e` | `0x076e` | 1 ⇒ STR |
| `OUTSUBS.OVL:0x0762`, | `cmp ax, 2` / `je 0x7be` | `0x07be` | 2 ⇒ DEX |
| `OUTSUBS.OVL:0x0767`, | `cmp ax, 3` / `je 0x7d2` | `0x07d2` | 3 ⇒ INT |
| `OUTSUBS.OVL:0x076c`, | `jmp 0x78b` | `0x078b` | ninguno ⇒ **sin subir atributo** |
| `OUTSUBS.OVL:0x076e`, | `mov ax, 0x77c0` / `push` / `call 0x75c0` | — | imprime `stronger!` |
| `OUTSUBS.OVL:0x077c`, | `add ax, 0x55b4` | — | **roster + 0x0C** (STR) |
| `OUTSUBS.OVL:0x0784`, | `mov ax, 0x1e` / `push` / `call 0xffff9c60` | — | `add_capped`, **tope 30** |
| `OUTSUBS.OVL:0x07be`, | `mov ax, 0x77ca` / `push` / `call 0x75c0` | — | imprime `quicker!` |
| `OUTSUBS.OVL:0x07cc`, | `add ax, 0x55b5` / `jmp 0x77f` | `0x077f` | **roster + 0x0D** (DEX) |
| `OUTSUBS.OVL:0x07d2`, | `mov ax, 0x77d4` / `push` / `call 0x75c0` | — | imprime `wiser!` |
| `OUTSUBS.OVL:0x07e0`, | `add ax, 0x55b6` / `jmp 0x77f` | `0x077f` | **roster + 0x0E** (INT) |
| `OUTSUBS.OVL:0x07a3`, | `mov al, byte ptr [bx + 0x55b2]` | — | letra de clase, **roster + 0x0A** |
| `OUTSUBS.OVL:0x07a9`, | `cmp ax, 0x41` / `je 0x7e6` | `0x07e6` | `'A'` |
| `OUTSUBS.OVL:0x07ae`, | `cmp ax, 0x42` / `jne 0x7b6` | `0x07b6` | no es `'B'` ⇒ sigue probando |
| `OUTSUBS.OVL:0x07b3`, | `jmp 0x8fc` | `0x08fc` | `'B'` ⇒ la rama del `shr` |
| `OUTSUBS.OVL:0x07b6`, | `cmp ax, 0x4d` / `je 0x7e6` | `0x07e6` | **`'M'`** |
| `OUTSUBS.OVL:0x07bb`, | `jmp 0x7f5` | `0x07f5` | otra letra ⇒ **sin escritura** |
| `OUTSUBS.OVL:0x07e6`, | `mov si, [bp-6]` / `shl si, 5` | — | índice × 32 |
| `OUTSUBS.OVL:0x07ed`, | `mov al, byte ptr [si + 0x55b6]` | — | lee **+0x0E** (INT) |
| `OUTSUBS.OVL:0x07f1`, | `mov byte ptr [si + 0x55b7], al` | — | escribe **+0x0F** (MP) |
| `OUTSUBS.OVL:0x0909`, | `shr ax, 1` / `jmp 0x7f1` | `0x07f1` | `'B'` ⇒ **INT>>1, reusando el STORE** |

Cadenas, byte a byte:

| DS | contenido | la cita dice |
|---|---|---|
| `0x77c0` | `'stronger!'` | ✓ *«fileoff 0x77d0»* = `0x77c0 + 0x10` ✓ |
| `0x77ca` | `'quicker!'` | ✓ *«fileoff 0x77da»* ✓ |
| `0x77d4` | `'wiser!'` | ✓ *«fileoff 0x77e4»* ✓ |
| `0x77b8` | `', and\n'` | ✓ (el compuesto de la arenga) |
| `0x77dc` | `'" '` | ✓ (el cierre de comillas del compuesto) |

**Los cinco pares, (a) exacta.** Y el port los calca: `LEVELUP_STAT_WORDS = ["stronger!",
"quicker!", "wiser!"]` indexado por `roll-1`, con `strength`/`dexterity`/`intelligence` en ese mismo
orden y `addByteCapped(..., 1, 30)`; y `recomputeApparitionMp` con `'A'`/`'M'` → `INT`, `'B'` →
`INT >> 1`, resto intacto.

⚠ **Un detalle de la rama `'B'` que la cabecera grande sí tiene y la pequeña no**: `0x08fc` **no
salta a `0x07e6`, sino a `0x07f1`** — reusa la instrucción de ESCRITURA y se salta la de lectura,
porque ya trae el valor en `al`. La cabecera de `recomputeApparitionMp` (`:167-172`) cierra el rango
en `0x0909` (el `shr`) y la grande (`:113`) en `0x090b` (el `jmp`); la segunda es la buena. Es
diferencia de UN offset entre dos docblocks del mismo fichero, sin consecuencia de conducta.

⚠ **No verificado**: la cabecera da el rango de `recomputeApparitionMp` como *«0x079c-0x07b6»*, y
el cuerpo real llega a `0x07f5` más el trampolín de `0x08fc`. Es **abreviatura del DESPACHO** (la
cadena de comparaciones de letra) con los cuerpos citados aparte en la misma frase, no error. Se
declara por el precedente de `sueltos-174-acta` §3.3, donde la misma forma se resolvió igual.

### 3.3 `COMBAT.OVL:0x0cb0-0x0d1f` — por qué limpiar el bando enemigo NO cierra el combate

| call-site | instrucción | destino | qué pasa |
|---|---|---|---|
| `COMBAT.OVL:0x0cca`, | `call 0xffffdbee` / `inc ax` / `jne 0xd08` | `0x0d08` | ¿queda alguien? sí ⇒ **sigue el bucle** |
| `COMBAT.OVL:0x0cd3`, | `cmp byte ptr [g_cmb_victory_flag], 0` / `jne 0xcbc` | `0x0cbc` | ya latcheada ⇒ sale |
| `COMBAT.OVL:0x0cda`, | `mov ax, 0x6eee` / `push` / `call 0x75c0` | — | imprime `\nBATTLE IS LOST!` |
| `COMBAT.OVL:0x0ced`, | `cmp word ptr [g_cmb_scratch_x], 0` / `jne 0xd08` | `0x0d08` | ⇒ **sigue el bucle** |
| `COMBAT.OVL:0x0cf4`, | `cmp byte ptr [g_cmb_victory_flag], 0` / `jne 0xd08` | `0x0d08` | ya latcheada ⇒ **sigue el bucle** |
| `COMBAT.OVL:0x0cf6`, | `mov ax, 0x6f00` / `push` / `call 0x75c0` | — | **imprime `\nVICTORY!\n`** |
| `COMBAT.OVL:0x0cfd`, | `mov byte ptr [g_cmb_victory_flag], 1` | — | **el LATCH** |
| `COMBAT.OVL:0x0d08`, | `inc byte ptr [g_cmb_actor]` | — | **el avance de actor: el bucle SIGUE** |
| `COMBAT.OVL:0x0d0c`, | `cmp byte ptr [g_cmb_actor], 0x20` / `jae 0xcc1` | `0x0cc1` | 32 actores por vuelta |
| `COMBAT.OVL:0x0d13`, | `jmp 0xbcf` | `0x0bcf` | **cabeza del bucle** |

★ La afirmación *«el bucle SIGUE (fall-through …)»* —con el offset elidido para no sembrar— es
**literal**: el `0x0d08` es el
`inc [g_cmb_actor]` y de ahí sólo se sale por `0x0cc1`/`0x0bcf`, que son **el bucle**, no el
epílogo. Las **tres** ramas hermanas que apuntan a `0x0d08` (`0x0cce`, `0x0ced`, `0x0cf4`) hacen lo
mismo: saltarse el bloque de VICTORY y avanzar el actor. **(a) exacta.**

★ **Y el port modela ADEMÁS lo que la cita no pide**: el `0x0cfd`, que pone `g_cmb_victory_flag = 1`, y el
port lleva `victoryLatched` con `maybeLatchVictory()` idempotente y `get victory()` devolviendo el
latch — con su propio docblock explicando que **antes** se computaba «enemigos vacíos AHORA» y eso
dejaba de ser cierto al salir la party. Es la misma mecánica del `jne` de `0x0cf4` (no re-imprimir
si ya está latcheada). Cuadra `get over()` = `ended || !anyActiveOnSide("party")` con la salida por
`0x0cb7`/`0x0cbc`.

⚠ **NO VERIFICADO, y se dice**: la cabecera etiqueta las dos entradas de salida como *«0x0cb7
(muerte total) o 0x0cbc (party fuera)»*. Las dos entradas **existen** de verdad —`0x0cb7` cae desde
`0x0cb5`, y `0x0cbc` es destino de `0x0cd8` y `0x0ce6`— y se distinguen por el valor que dejan en
`[bp-2]` (0 en la primera, 1 o preservado en la segunda). Lo que **no** se deriva desde aquí es
**cuál de las dos es cuál**: el discriminante es `g_cmb_scratch_x` (`0x0cb0`), un nombre-marcador
cuya semántica no está establecida, y el `\nBATTLE IS LOST!` sale por la ruta de `0x0cbc`, que es la
que la cita llama *«party fuera»*. **No se re-etiqueta** (haría falta derivar la global) y **ninguna
conducta del port depende de la asignación** — `get over` usa la regla, no las etiquetas.

### 3.4 `LOOKOBJ.OVL:0x09f6-0x0a3e` — la bola de cristal

| call-site | instrucción | destino | qué es |
|---|---|---|---|
| `LOOKOBJ.OVL:0x0a08`, | `mov cl, byte ptr [bx + 0x55b6]` / `sub ch, ch` | — | **roster + 0x0E** = INT |
| `LOOKOBJ.OVL:0x0a0e`, | `cmp cx, ax` / `ja 0xa2a` | `0x0a2a` | **gana si INT > tirada** |
| `LOOKOBJ.OVL:0x0a12`, | `mov ax, 0x74fa` / `push` / `call 0x75c0` | — | `Death vision!` |
| `LOOKOBJ.OVL:0x0a20`, | `push [bp-0xa]` / `mov ax,1` / `push` / `call 0x87c2` | — | daño 1 |
| `LOOKOBJ.OVL:0x0a2a`, | `mov ax, 0x750a` / `push` / `call 0x75c0` | — | **`Strange vision!`** |
| `LOOKOBJ.OVL:0x0a31`, | `mov al, [g_party_x]` / `sub ah,ah` / `push ax` | — | arg 1 |
| `LOOKOBJ.OVL:0x0a37`, | `mov al, [g_party_y]` / `push ax` | — | arg 2 |
| `LOOKOBJ.OVL:0x0a3b`, | `call 0x10fc` | — | la vista aérea |

**(a) exacta**, y con las tres piezas comprobadas por separado:

1. **La cadena**: `DS 0x750a` = `'Strange vision!\n'` byte a byte ✓, y el `\n` podado por el port es
   la convención declarada de #108, no una decisión nueva.
2. **El «empate PIERDE»** de la cabecera es consecuencia mecánica de que `0x0a10` sea **`ja`** (sin
   signo, estrictamente mayor) y no `jae`. Se deriva, no se cree.
3. **El orden de los argumentos**, que era el punto con más riesgo por el precedente #70 (zodíaco
   transpuesto) y su barrido #72: el binario empuja **`g_party_x` primero y `g_party_y` después**, y
   la cita escribe `gem_view(g_party_x, g_party_y)`. **Coincide con la convención declarada del
   propio repo** — la misma cabecera escribe `rand_range(min=1, max=30)` para el `push 1` / `push
   0x1e` de `0x09f6`, o sea **primer push = primer argumento** (`rand-range-arg-order`). ⇒ **no hay
   eje cruzado aquí**; se comprobó explícitamente en vez de darlo por bueno.

⚠ Detalle sin consecuencia, para constancia — el `0x0a37`, que hace `mov al, [g_party_y]` y `push ax` **sin
volver a poner `ah` a cero** — funciona porque el `sub ah, ah` de `0x0a34` lo dejó limpio. Es
economía del compilador, no un bug, y no cambia nada del port (que ni siquiera pasa coordenadas:
`buildGemView` las saca del estado).

## 4. ★★ EL CONTROL POSITIVO QUE SALIÓ SOLO: la base del roster, por dos vías independientes

No se buscaba. Al leer dos rutinas de overlays distintos aparecen offsets absolutos de DS que sólo
cuadran con **una** base de roster, y las dos lecturas dan la misma:

| overlay | offset absoluto leído | lo que la cabecera del port llama | base implícita |
|---|---|---|---|
| `OUTSUBS.OVL:0x077c`, | `0x55b4` (STR) | roster + `0x0C` | **`0x55a8`** |
| `OUTSUBS.OVL:0x07cc`, | `0x55b5` (DEX) | roster + `0x0D` | **`0x55a8`** |
| `OUTSUBS.OVL:0x07e0`, | `0x55b6` (INT) | roster + `0x0E` | **`0x55a8`** |
| `OUTSUBS.OVL:0x07a3`, | `0x55b2` (clase) | roster + `0x0A` | **`0x55a8`** |
| `OUTSUBS.OVL:0x07f1`, | `0x55b7` (MP) | roster + `0x0F` | **`0x55a8`** |
| `LOOKOBJ.OVL:0x0a08`, | `0x55b6` (INT) | roster + `0x0E` | **`0x55a8`** |

**Seis offsets, dos overlays que no se citan entre sí, una sola base consistente**, y el paso
(`shl 5` = 32 B por registro) idéntico en los dos. ⇒ las traducciones «roster+0xNN» de estas
cabeceras **no son convención heredada: son derivables y derivadas**. Es el tipo de control que
`control-resolucion-mismo-overlay` pide y que aquí salió gratis por leer dos pares del mismo lote.

## 5. Estado de la cola

| | pares |
|---|---|
| celda `clase2` F+L @ `994d4fc2` | 53 |
| nombrados en actas de tandas 1-7 (HITO 1) | 16 |
| **no leídos al empezar** | **37** |
| **leídos en esta sub-tanda** | **10** |
| **VIVOS** | **27** |

Balance: **10 pares por 4 lecturas** (ritmo 0,40), **10 (a)**, cero (b), cero (c) nuevo, cero (d).

⚠ **CORTE EN FRONTERA DE GRUPO**: los grupos de `CMDS`, `OUTSUBS`, `COMBAT` y `LOOKOBJ` quedan
ENTEROS y no se ha abierto el siguiente. Ningún par partido por la mitad.

**Orden recomendado para la sub-tanda 2**: el grupo de `MAINOUT.OVL` (10 pares — `0x0129`, `0x0152`,
`0x016a`, `0x01dc` del rumbo de transporte · `0x050e`, `0x0592` de la vela · `0x1120` de la
alfombra · `0x1c01`, `0x1c0b` de hazards · `0x1c37`), que es un solo overlay y al menos tres
sub-grupos por rutina. Ahí caen **3 de los 7 pares sin rastro alguno en `re/notes/`** (§2.3 del
HITO 1) y **1 de los 2 `kernel` declarados** (`0x1c0b`).

## 6. Lo que esta sub-tanda NO ha hecho

- **No ha tocado `game/src` ni `re/tools`.** Cero líneas.
- **No ha adjudicado** *«Mix NO toca RNG»* (§3.1.1): es de #105, tiene dueño y **no es resoluble
  desde `CMDS.OVL`** porque los tres destinos caen fuera del overlay.
- **No ha re-etiquetado** las dos salidas de `COMBAT.OVL:0x0cb0` (§3.3): haría falta derivar
  `g_cmb_scratch_x`, que es trabajo nuevo.
- **No ha aplicado** el token `kernel` de `SHOPPES3.OVL:0x01ca` (#199); el otro (`MAINOUT.OVL:0x1c0b`)
  cae en la sub-tanda 2 y se tratará igual: declarar, no aplicar.
- **No ha verificado la CONDICIÓN** (#144) de los 10: se adjudica que la cita describe el tramo. En
  `COMBAT.OVL:0x0d08` y `LOOKOBJ.OVL:0x0a2a` sí se comprobó ADEMÁS que el port modela los dos
  destinos del fork.
- **No ha leído** los 27 restantes.

## 7. Gates (EXIT por separado, sin pipes, re-corridos tras el `git add`)

```
python3 re/tools/seed_gate.py                        EXIT=0
python3 -m pytest re/tools/test_frontier.py -q       EXIT=0
python3 -m pytest re/tools/test_genero.py -q         EXIT=0
python3 -m pytest re/tools/test_cita_segmento.py -q  EXIT=0
python3 re/tools/genero.py                           EXIT=0
python3 re/tools/cita_pegajosa_forma.py              EXIT=0   (3 controles verdes)
python3 re/tools/cita_pegajosa_atribucion.py         EXIT=0   (3 controles verdes)
```

`game/src` no se ha tocado ⇒ no aplican `tsc` ni `vitest`. Sin e2e (mutex ajeno).
`routine-census.json` NO regenerado (EMBARGO). `pytest re/tools` COMPLETO no corrido.

---

## 8. Nombres de overlay usados aquí (sección FINAL a propósito)

Al final por el ctx pegajoso de #84. Overlays nombrados: `CMDS.OVL`, `COMBAT.OVL`, `LOOKOBJ.OVL`,
`MAINOUT.OVL`, `OUTSUBS.OVL`, `SHOPPES3.OVL`, `ULTIMA.EXE`.
