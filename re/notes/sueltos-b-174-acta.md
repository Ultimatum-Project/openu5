# ACTA #174 (banda PEGAJOSA) — TANDA 9, SUB-TANDA 5: los 7 SUELTOS de `core` de la cola final

> Rama `re/sueltos-b-174`, worktree `.claude/worktrees/sueltos-b-174`, base **main `3dd2fea4`**.
> Toda cifra medida en ese árbol. RETENIDA: aterriza el lead.
> Continúa `sueltos-174-t4-acta.md` §4 (el relevo de los 16 y el estimador de ritmo 1,0).

---

## 0. VEREDICTO

**7 pares · 7 (a) exacta · 0 (b) · 0 (c) · 0 (d)** — con **7 lecturas**.

★ **La predicción de ritmo se cumple por segunda vez consecutiva**: la sub-tanda 4 pre-registró
1,0 lecturas/par para los 16 restantes y salen **7 por 7**. Serie completa del carril:
0,63 · 0,78 · 0,86 · 1,00 · **1,00**.

| par | fichero del port | veredicto |
|---|---|---|
| `CMDS.OVL:0x1ac6` | `main.ts:2716` | **(a)** — el «bucle 0x1ac6» es LITERALMENTE la cabeza del bucle |
| `DNGLOOK.OVL:0x0013` | `dungeon/dungeon.ts:577` | **(a)** — «NO pregunta dirección» probado por el DESTINO del salto |
| `MAINOUT.OVL:0x0468` | `world/movement.ts:56` | **(a)** — el «1-2 ×» contado, y el rango con sus dos extremos |
| `SHOPPES.OVL:0x1596` | `world/cmd-strings.ts:386` | **(a)** — y 8 hermanas del mismo docblock verificadas de balde |
| `SHOPPES2.OVL:0x0194` | `shops/shops.ts:825` | **(a)** — los DOS rangos exactos y el «sólo si» por topología |
| `TOWN.OVL:0x0204` | `world/townHourTiles.ts:19` | **(a)** — y el «fila+1, no al este» CORROBORADO desde otro overlay |
| `ZSTATS.OVL:0x1230` | `itemPageController.ts:8` | **(a)** — ★★ la divergencia ES el parámetro del módulo |

## 1. RE-ANCLA: medida al abrir, quinta vez consecutiva idéntica

```
main = HEAD = 3dd2fea4
git diff 258f6fcb..HEAD -- game/src            → VACÍO   (SHA-base de la sub-tanda 4)
cita_pegajosa_atribucion.py → 345 pares @ 3dd2fea4, 3 controles verdes
cita_pegajosa_forma.py      → DIVERGE × (FORZADA 9 + LIMPIA 55) = 64, 3 controles verdes
```

★ **Y la cola de 16 NO se hereda del encargo: se REPRODUCE desde el partidor por aritmética de
conjuntos**, volcando la celda con `--celda FORZADA DIVERGE` y `--celda LIMPIA DIVERGE` y cruzando
por MIEMBROS (no por conteo — esta cola lleva tres casos de conteo-que-cuadra-con-miembros-distintos):

| comprobación | resultado |
|---|---|
| miembros de la celda `DIVERGE` F+L | 64 |
| ¿los 16 del encargo están todos en los 64? | **SÍ** (diferencia vacía) |
| ¿los 30 de las sub-tandas 1-4 están todos en los 64? | **SÍ** (diferencia vacía) |
| ¿solape entre esos 30 y estos 16? | **VACÍO** |
| resto (64 − 30 − 16) = ya-(d) de #188/#190 + carriles previos | **18** = 4 + 14 ✓ |

⇒ la partición **30 + 16 + 18 = 64** cierra con los tres bloques disjuntos y todos dentro de la
celda. La lista de 16 del encargo queda **derivada**, no aceptada.

## 2. Las siete lecturas

### 2.1 `CMDS.OVL:0x1a70` — la cantidad del Mix, y un «bucle» que es un bucle literal

La cita (`main.ts:2713-2720`) es una lista de seis afirmaciones con offset. La rutina entera cabe
en el tramo, `0x1a70-0x1ad4`, y se leyó completa; también su llamador, `0x1b5d-0x1c1f`:

| call-site | instrucción | la afirmación que cumple |
|---|---|---|
| `CMDS.OVL:0x1a78`, | `mov word ptr [bp - 4], 1` | siembra el flag «ok» — **destino del bucle** |
| `CMDS.OVL:0x1a7d`, | `mov ax, 0x8f72` / `push` / `call 0x58d0` | «How much? » DS `0x8f72` ✓ |
| `CMDS.OVL:0x1a84`, | `mov ax, 2` / `push` / `call 0x7c1e` | «getnum 0x7c1e, 2 dígitos → 99» ✓ literal |
| `CMDS.OVL:0x1a97`, | `test word ptr [bp + 4], di` (`di`=0x80, `si`=0) | recorre los 8 bits de la SELECCIÓN |
| `CMDS.OVL:0x1a9c`, | `mov al, byte ptr [si + 0x5850]` / `cmp ax, [bp-2]` / `jae 0x1abc` | ¿alcanza el reagente MARCADO? |
| `CMDS.OVL:0x1aa7`, | `mov ax, 0x8f7e` / `push` / `call 0x58d0` | «Insufficient reagents!» DS `0x8f7e` ✓ |
| `CMDS.OVL:0x1aae`, | `mov word ptr [bp - 4], 0` | borra el flag «ok» |
| `CMDS.OVL:0x1ac6`, | `cmp word ptr [bp - 4], 0` / `je 0x1a78` | ★★ **el bucle** |
| `CMDS.OVL:0x1b71`, | `or ax, ax` / `jg 0x1b78` (en `0x1b73`) | N≤0 ⇒ `jmp 0x1c11`, sin imprimir |
| `CMDS.OVL:0x1b78`, | `cmp word ptr [bp - 2], 0` / `jne 0x1b81` | máscara vacía ⇒ `0x1c0a` |
| `CMDS.OVL:0x1c0a`, | `mov ax, 0x9004` / `push` / `call 0x58d0` | «Nothing to mix!» DS `0x9004` ✓ |
| `CMDS.OVL:0x1b81`, | `mov ax, 0x8ff0` / `push` / `call 0x58d0` | «Mixing...» DS `0x8ff0` ✓ |
| `CMDS.OVL:0x1bb0`, | `sub byte ptr [si + 0x5850], al` (`al`=N) | consume N de cada MARCADO |
| `CMDS.OVL:0x1bcb`, | `mov al, byte ptr [bx + 0x1cc0]` / `cmp ax, [bp-2]` / `jne 0x1bf6` | ¿casa la máscara requerida? |
| `CMDS.OVL:0x1bd6`, | `mov ax, 0x8ffc` / `push` / `call 0x58d0` | «Done!» DS `0x8ffc` ✓ |
| `CMDS.OVL:0x1be3`, | `add byte ptr [bx + 0x57f0], al` / `cmp …, 0x63` | la carga, con tope 99 |

★★ **«RE-PREGUNTA (bucle 0x1ac6)» no es una paráfrasis**, `0x1ac6` es el `cmp`/`je` cuyo destino es
`0x1a78`, y `0x1a78` es la instrucción inmediatamente anterior al `push` de «How much? ». El
bucle empieza y acaba en los dos offsets que la cita nombra. Y la otra rama del `DIVERGE`
—`0x1a90 je 0x1ac6`, con N==0— llega a `0x1ac6` con el flag todavía en 1, así que **no** entra al
bucle y devuelve 0: los dos brazos existen y hacen cosas distintas.

★ **Y el «se gastan igual sin carga» sale del ORDEN**: el bucle de consumo (`0x1b9f-0x1bba`) está
ENTERO por delante de la comprobación de máscara de `0x1bcb`, así que el `jne 0x1bf6` no puede
deshacer lo restado. **(a) exacta.**

⚠ **Imprecisión de NOTACIÓN, declarada**: la cita escribe que N≤0 aborta en silencio, y da como
señas ese mismo punto, 0x1b71, con el mnemónico jle. En CS `0x1b71` la instrucción es `or ax, ax` y el
salto es un `jg 0x1b78` en `0x1b73`; la CONDICIÓN de aborto es exactamente «≤ 0» y el offset es
exacto, pero el mnemónico que la cita nombra es el complementario del que hay. Mismo género que
las imprecisiones de notación declaradas en las sub-tandas 1 y 3.

⚠ **No adjudicado, y con dueño VIVO**: la frase final del mismo docblock, *«Mix NO toca RNG»*
(`main.ts:2720`), es materia de la tarjeta **#105**, que declara defecto de censo el «0 rand» de
`cmds.md` §12. Lo que sí se puede dejar medido aquí: en el tramo, `0x1a70`—`0x1c1f`, hay **13 llamadas de
13 destinos distintos** y **ninguna** es el generador; si hay consumo, está dentro de un callee
(`0x573a`, `0x7a7c`, `0x7050`…), no en este cuerpo. ★ Y una seña para el dueño de #105: la tarjeta
nombra `cmds.md` §12, pero **la misma afirmación vive también en `game/src/main.ts:2720`**, que la
tarjeta no cita.

### 2.2 `DNGLOOK.OVL:0x0013` — el gate de luz, y una AUSENCIA probada por el destino del salto

| call-site | instrucción | destino | qué es |
|---|---|---|---|
| `DNGLOOK.OVL:0x0007`, | `call 0xffffa6f8` | — | el selector de miembro (paso 1 de la cita) |
| `DNGLOOK.OVL:0x000d`, | `inc ax` / `jne 0x13` | `0x0010` si ax era −1 | ret −1 ⇒ ABORTA ✓ |
| `DNGLOOK.OVL:0x0010`, | `jmp 0x27e` | `0x027e` | el aborto, en el offset que la cita da |
| `DNGLOOK.OVL:0x0013`, | `cmp byte ptr [g_torch_mins], 0` / `jne 0x28` | `0x0028` | ¿antorcha? ⇒ sí pregunta |
| `DNGLOOK.OVL:0x001a`, | `cmp byte ptr [g_light_spell_mins], 0` / `jne 0x28` | `0x0028` | ¿hechizo de luz? ⇒ sí pregunta |
| `DNGLOOK.OVL:0x0021`, | `mov ax, 0x752e` / `jmp 0xdf` | `0x00df` | **darkness** DS `0x752e` ✓ |
| `DNGLOOK.OVL:0x0028`, | `mov al, [g_dng_facing]` / `push` / `call 0xffffdcae` | — | el prompt «Dir-» ✓ literal |
| `DNGLOOK.OVL:0x0031`, | `or ax, ax` / `jne 0x38` | `0x027e` si 0 | aborto de dirección ✓ |
| `DNGLOOK.OVL:0x0038`, | `mov ax, [g_cmb_scratch_x]` … `[g_cmb_scratch_y]` | — | la celda DESCRITA ✓ |
| `DNGLOOK.OVL:0x0046`, | `and si, 7` (y `and ax, 7` en `0x0051`) | — | el wrap `&7` ✓ |

★★ **«a oscuras … NO pregunta dirección» es un aserto de AUSENCIA y se prueba con el DESTINO, no
con una impresión**: la rama oscura de `0x0021`, con su `jmp 0xdf`, salta POR ENCIMA del `0x0028`
donde vive la única llamada al prompt de dirección de la rutina. Y el «ANTES del Dir-» es
aritmética de offsets, `0x0013 < 0x0028`, sin nada en medio que reordene. **(a) exacta.**

★ **La lente `kernel` de #199, aplicada y DECLARADA (no aplicada al veredicto)**: la cabecera de
este mismo docblock (`dungeon.ts:567`) escribe *«DNGLOOK.OVL 0x0000 (kernel 0x3310 rama … → stub
0x7F32…)»*. El overlay heredado es `DNGLOOK.OVL` —o sea, NO es `ULTIMA.EXE`— que es justo la
condición con la que #199 predice fabricación. **Aquí no la hay, y el motivo es nuevo**:
`DNGLOOK.OVL` se acaba en `0x13ae`, así que `0x3310` y `0x7F32` **caen fuera de la extensión del
overlay** y no hay instrucción que atribuir; ninguno de los dos aparece en la población. ⇒ seña
para #199: **la fabricación no depende sólo de qué overlay se hereda, sino de que el offset ATERRICE
dentro de él**; con overlays cortos el token es inofensivo por construcción.

⚠ No adjudicado (materia #81/#191): que `0xffffa6f8` sea `resolve_display_char` y que el gate de
`0x0013` sea «el mismo de la vista 3D» son identificaciones de nomenclatura y de otra rutina.

### 2.3 `MAINOUT.OVL:0x0468` — el terreno lento: el «1-2 ×» CONTADO y el rango con sus dos extremos

| call-site | instrucción | destino | qué es |
|---|---|---|---|
| `MAINOUT.OVL:0x041a`, | `mov word ptr [bp - 4], 1` | — | clase 1 |
| `MAINOUT.OVL:0x0440`, | `mov word ptr [bp - 4], 2` | — | clase 2 |
| `MAINOUT.OVL:0x0422`, | `cmp ax, 1` / `je 0x448` | `0x0448` | despacho de clase 1 |
| `MAINOUT.OVL:0x0427`, | `cmp ax, 2` / `je 0x468` | `0x0468` | despacho de clase 2 |
| `MAINOUT.OVL:0x042c`, | `jmp 0x48c` | `0x048c` | sin clase ⇒ epílogo, sin turnos extra |
| `MAINOUT.OVL:0x0448`, | `call 0x1a60` / `add [bp-2], ax` / `call 0x7a` | — | **UNA** vez |
| `MAINOUT.OVL:0x0457`, | `mov ax, 0x29bf` / `push` / `call 0xffff9680` | — | «Slow progress!» |
| `MAINOUT.OVL:0x045e`, | `mov ax, 2` / `push` / `call 0xffffcdac` | — | `advance_clock(2)`, DESPUÉS |
| `MAINOUT.OVL:0x0468`, | `call 0x1a60` / `add [bp-2], ax` / `call 0x7a` | — | primera de **DOS** |
| `MAINOUT.OVL:0x0471`, | `call 0x1a60` / `add [bp-2], ax` / `call 0x7a` (`0x0477`) | — | segunda; **cierre del rango** |
| `MAINOUT.OVL:0x0480`, | `mov ax, 0x29cf` / `push` / `call 0xffff9680` | — | «Very slow!» |
| `MAINOUT.OVL:0x0487`, | `mov ax, 4` / `jmp 0x461` | `0x0461` | `advance_clock(4)`, DESPUÉS |

★ **El «1-2 ×» de la cita es una CUENTA, no una constante**: en `0x0448` hay una sola `call 0x1a60`
y en `0x0468-0x0477` hay dos, y el rango declarado empieza en la primera y **acaba exactamente en
el `call 0x7a` de `0x0477`** que cierra la segunda ⇒ los dos extremos, exactos.

★ **Y el «ANTES del advance_clock extra» se demuestra por topología, no por confianza**: las dos
clases se REÚNEN en el `push`/`call 0xffffcdac` de `0x0461-0x0462` —la clase 1 cayendo desde
`0x045e`, la clase 2 saltando desde `0x0487`—, y las dos han ejecutado ya sus `call 0x1a60`.
**(a) exacta.**

### 2.4 `SHOPPES.OVL:0x1596` — el eco de 'C', y ocho hermanas verificadas de balde

| call-site | instrucción | destino | la entrada del catálogo |
|---|---|---|---|
| `SHOPPES.OVL:0x157f`, | `cmp ax, 0x43` / `je 0x1596` | `0x1596` | la tecla 'C' |
| `SHOPPES.OVL:0x1596`, | `mov ax, 0x8106` / `push` / `call 0x75c0` | — | `healerCuring` DS `0x8106` ✓ |
| `SHOPPES.OVL:0x1584`, | `cmp ax, 0x48` / `jne` … `jmp 0x1622` | `0x1622` | `healerHealing`, OFFSET 0x1622 ✓ |
| `SHOPPES.OVL:0x158c`, | `cmp ax, 0x52` / `jne` … `jmp 0x169a` | `0x169a` | `healerResurrectEcho` (0x169a) ✓ |
| `SHOPPES.OVL:0x1577`, | `cmp ax, 0x20` / `jne` … `jmp 0x170e` | `0x170e` | `healerNothing` — el Space |
| `SHOPPES.OVL:0x1572`, | `jne 0x1577` … `jmp 0x170e` | `0x170e` | `healerNothing` — el CR |
| `SHOPPES.OVL:0x159d`, | `call 0x137c` | — | el picker, CALLEE 0x137c ✓ |
| `SHOPPES.OVL:0x15cd`, | `cmp byte ptr [bx + 0x55b3], 0x50` / `je 0x15de` | `0x15de` | estado ≠ 'P' ⇒ no hace falta |
| `SHOPPES.OVL:0x15d4`, | `mov ax, 0x3d5a` / `push` / `call 0x26` | — | `healerNoNeed` DS `0x3d5a`, OFFSET 0x15d4 ✓ |
| `SHOPPES.OVL:0x15de`, | `mov ax, 0x810e` / `push` / `call 0x75c0` | — | el `\n\n"` DS `0x810e` ✓ |
| `SHOPPES.OVL:0x15e5`, | `cmp byte ptr [g_location], 5` / `jne 0x15f6` | `0x15f6` | la location **5** ✓ literal |
| `SHOPPES.OVL:0x15ec`, | `mov ax, 0x8112` / `push` / `call 0x75c0` | — | `healerLight` DS `0x8112`, OFFSET 0x15ec ✓ |
| `SHOPPES.OVL:0x15f6`, | `mov ax, 0x812a` / `push` / `call 0x75c0` | — | `healerCurePitch` DS `0x812a`, OFFSET 0x15f6 ✓ |
| `SHOPPES.OVL:0x15b4`, | `mov ax, 0x81c8` / `push` (+ `0x81f2` en `0x15bb`) | — | `healerAnyOther` DS `0x81c8`+`0x81f2`, OFFSETS 0x15b4+0x15bb ✓ |

★ **Trece filas del catálogo con su offset y su DS, y las trece literales en un solo tramo.** La
del par —`healerCuring` en `0x1596`— es exacta, y de camino salen ocho hermanas del mismo bloque de
`cmd-strings.ts` sin coste. Detalle que la cita comprime bien: *«Space/CR en el nature-of-need
(0x170e)»* — **las dos teclas comparten destino**, `0x170e`, que es lo que autoriza a darles una
sola entrada. **(a) exacta.**

### 2.5 `SHOPPES2.OVL:0x0194` — el plato, con su ORDEN, y los dos rangos exactos

| call-site | instrucción | destino | qué es |
|---|---|---|---|
| `SHOPPES2.OVL:0x0160`, | `push g_party_x` / `mov al, [g_party_y]` / `dec ax` / `push` | — | **NORTE** (`y-1`) — inicio del rango |
| `SHOPPES2.OVL:0x016b`, | `call 0x6222` / `mov bx, ax` | — | el puntero al tile |
| `SHOPPES2.OVL:0x0170`, | `cmp byte ptr [bx], 0x95` / `jne 0x194` (en `0x0173`) | `0x0194` | **¿hay mesa?** — cierre del rango |
| `SHOPPES2.OVL:0x0185`, | `mov byte ptr [bx], 0x9b` | — | el plato del NORTE = `0x9b` ✓ |
| `SHOPPES2.OVL:0x0194`, | `push g_party_x` / `mov al, [g_party_y]` / `inc ax` / `push` | — | **SUR** (`y+1`) — inicio del rango |
| `SHOPPES2.OVL:0x01a4`, | `cmp byte ptr [bx], 0x95` / `jne 0x1c8` (en `0x01a7`) | `0x01c8` | tampoco hay ⇒ nada — cierre |
| `SHOPPES2.OVL:0x01b9`, | `mov byte ptr [bx], 0x9a` | — | el plato del SUR = `0x9a` ✓ |
| `SHOPPES2.OVL:0x01c2`, | `jmp 0x18e` | `0x018e` | los dos brazos se REÚNEN en `call 0x7730` |
| `SHOPPES2.OVL:0x01c4`, | `inc word ptr [0xbd20]` | — | `g_cups_served` (rama party muerta) ✓ |

★ **Los dos rangos de la cita tienen sus CUATRO extremos exactos**: `0x0160-0x0173`, que empieza en
el primer `push` del norte y acaba en su `jne`; y `0x0194-0x01a7`, que empieza en el primer `push`
del sur y
acaba en el suyo. El `y-1`/`y+1` son literalmente un `dec ax` y un `inc ax`, y los tiles `0x9b`/
`0x9a` son dos inmediatos distintos ✓.

★ **Y el «sólo si ahí no hay mesa» es TOPOLOGÍA**: al bloque del sur **sólo se llega por el `jne
0x194` de `0x0173`**, o sea por la rama negativa del norte. No es una prioridad declarada, es la
única arista de entrada. **(a) exacta.**

★ **La trampa del nombre propio, comprobada en la dirección que manda**: el `.asm` escribe
`[0xbd1a]` / `[0xbd20]` **a pelo**, sin símbolo, y la cita del port los llama `g_alive_a` /
`g_cups_served` afirmando que *«el ledger ya los tenía nombrados así en globals.json»*. Cotejado:
`globals.json` tiene `g_alive_a` @ **48410 = 0xBD1A**, `g_alive_b` @ 48412, `g_cups_served` @
**48416 = 0xBD20** ✓✓. **El `.asm` es el que va por detrás**; la cita es correcta y su afirmación
sobre el ledger, verificable y verificada.

### 2.6 `TOWN.OVL:0x0204` — el puente levadizo, y el eje CORROBORADO desde otro overlay

| call-site | instrucción | destino | qué es |
|---|---|---|---|
| `TOWN.OVL:0x017c`, | `push di` / `push si` / `call 0xffffc232` | — | FASE 1 — inicio del rango |
| `TOWN.OVL:0x0183`, | `cmp byte ptr [bx], 0x87` / `jne 0x195` | `0x0195` | el arco `0x87` ✓ |
| `TOWN.OVL:0x0188`, | `push di` / `lea ax, [si + 1]` / `push` / `call 0xffffc232` | — | ★ el vecino con la **2ª** coordenada +1 |
| `TOWN.OVL:0x0192`, | `xor byte ptr [bx], 0xdd` | — | el `xor 0xdd` ✓ literal |
| `TOWN.OVL:0x01a4`, | `mov word ptr [bp - 2], di` | — | cierre del rango de la FASE 1 |
| `TOWN.OVL:0x01b8`, | `and al, 0xfe` / `cmp al, 0x48` / `je 0x207` (en `0x01bc`) | `0x0207` | ★ el SALTO de fase 2 |
| `TOWN.OVL:0x01be`, | `sub si, si` | — | **inicio del rango de la FASE 2** |
| `TOWN.OVL:0x01d3`, | `mov byte ptr [bx], 3` | — | estampa `0x03` (foso) ✓ |
| `TOWN.OVL:0x01df`, | `cmp ax, cx` / `jae 0x204` (en `0x01e1`) | `0x0204` | **cierre del rango de la FASE 2** |
| `TOWN.OVL:0x01e3`, | `cmp byte ptr [g_hour], 5` / `jne 0x1c2` | `0x01c2` | la hora **5** ✓ literal |
| `TOWN.OVL:0x01fb`, | `mov al, byte ptr [si + 0x592e]` / `mov byte ptr [bx], al` | — | **restaura el tile original** ✓ |
| `TOWN.OVL:0x0207`, | `or byte ptr [g_unk_24e6], 2` | — | la REUNIÓN: adonde salta el SALTO |

★ **El rango de la FASE 2, `0x01be-0x0204`, es exacto por los dos extremos**: `0x01be` es el `sub si, si` que
inicializa el bucle de la fase 2 (la instrucción inmediatamente posterior al gate de salto) y
`0x0204` es el destino de salida del bucle. Y el SALTO que la cita describe está en el offset y con
el mnemónico que dice (`0x01bc` `je`), saltando a `0x0207`, **por encima del bucle entero** ⇒ «se
salta la fase 2 COMPLETA» es una ausencia probada por el destino ✓. La fase 1 (`0x017c-0x01a4`)
también cuadra con sus dos extremos, y **no** cuelga del salto: está por delante ⇒ «La reja (fase 1)
NO se salta» ✓.

★★ **El «fila+1, no al este» — el paréntesis más arriesgado de la cita — queda corroborado desde
OTRO overlay, en esta misma sub-tanda.** La cita afirma que `get_tile_ptr` indexa `fila*32+col` y
que **el segundo `push` es la fila**, y de ahí que `lea ax, [si+1]` sea el vecino del SUR. En
`0x0188` los argumentos son (`di`, `si+1`), o sea el segundo. La confirmación viene de §2.5: en
`SHOPPES2.OVL:0x0160` y `0x0194` la misma pareja de argumentos se empuja como (`g_party_x`,
`g_party_y ∓ 1`) — **el segundo `push` es inequívocamente la Y**, y de ese signo depende que el
plato caiga al norte o al sur. Dos overlays que no se hablan usan el mismo orden de argumentos.
Es la pregunta que costó el zodíaco transpuesto de #70, y aquí está resuelta con material medido.
**(a) exacta.**

★ **«SIN consumo de RNG» — por ENUMERACIÓN**: en el cuerpo entero, `0x0170-0x0211`, hay **exactamente 5 `call`, y
las cinco al MISMO destino** (`0xffffc232`). Si hubiera RNG estaría dentro de ese callee, no en
este cuerpo. ⚠ La cita lo llama `get_tile_ptr 0x4402` y el disasm escribe `0xffffc232`: rebase de
nomenclatura, materia #81/#191, no adjudicada — la SUSTANCIA («sólo llama a get_tile_ptr») sí es
derivable, y se deriva.

⚠ **No verificado, con su motivo**: *«En los 28 arcos del juego ese vecino sur es SIEMPRE 0x44»* es
un aserto sobre `assets/maps/smallmaps.json`, no sobre este tramo; el docblock declara haberlo
validado contra los 20 mapas. No se re-mide aquí.

### 2.7 ★★ `ZSTATS.OVL:0x1230` — cuando la DIVERGENCIA es exactamente el parámetro del módulo

| call-site | instrucción | destino | qué es |
|---|---|---|---|
| `ZSTATS.OVL:0x1258`, | `cmp ax, 0x1b` / `je 0x1238` | `0x1238` | ESC `0x1b` ✓ |
| `ZSTATS.OVL:0x125d`, | `cmp ax, 0x20` / `je 0x121c` | `0x121c` | Space `0x20` ⇒ **misma vía que RETURN** ✓ |
| `ZSTATS.OVL:0x121c`, | `cmp word ptr [bp + 4], 0x52` / `jne 0x1230` (en `0x1220`) | `0x1230` | **el gate de MODO** ('R') |
| `ZSTATS.OVL:0x1222`, | `push [bp+6]` / `push [bp-0x18]` / `call 0xc5c` | — | Ready: **equipa in situ** ✓ |
| `ZSTATS.OVL:0x122b`, | `mov word ptr [bp - 6], ax` | — | el flag de salida = el RESULTADO del equipar |
| `ZSTATS.OVL:0x1230`, | `mov word ptr [bp - 6], 1` | — | Use: flag de salida = **1 fijo** ✓ |
| `ZSTATS.OVL:0x1238`, | `cmp word ptr [bp + 4], 0x52` / `jne 0x1244` | `0x1244` | ESC: elige mensaje por MODO |
| `ZSTATS.OVL:0x123e`, | `mov ax, 0x9970` (y `0x9976` en `0x1244`) | — | las dos cadenas del ESC |
| `ZSTATS.OVL:0x1250`, | `mov word ptr [bp - 0x18], 0xffff` | — | ESC ⇒ id = −1 |
| `ZSTATS.OVL:0x1282`, | `cmp word ptr [bp - 6], 0` / `jne 0x128b` | `0x0f62` si 0 | **la cabeza del bucle** |
| `ZSTATS.OVL:0x128b`, | `mov ax, word ptr [bp - 0x18]` / `ret 6` | — | **devuelve el id** ✓ |

★★ **«Use devuelve el id y cierra (@0x1230)» se demuestra por la SALIDA COMPARTIDA.** `0x1230`
escribe el único valor que hace que el `cmp` de `0x1282` NO caiga al retro-salto `jmp 0xf62`; y la
instrucción a la que entonces llega, `0x128b`, es literalmente `mov ax, [bp-0x18]` = el id. La rama
gemela, `0x1222`, pone en ese mismo flag el **resultado** de `call 0xc5c` (el equipar), que puede
ser 0 ⇒ el bucle SIGUE, que es lo que quiere decir «equipa in situ».

⇒ **las dos ramas del `DIVERGE` se distinguen exactamente en si el bucle continúa**, y eso es lo
único que `itemPageController.ts` parametriza. Es el caso más limpio de la celda: el módulo del
port existe *porque* esta bifurcación existe, y modela los dos brazos por construcción.
**(a) exacta.**

⚠ **Ambigüedad declarada (género #194, sin veredicto)**: la línea vecina `itemPageController.ts:40`
dice *«ESC (0x1b) → cierre (@0x1244; el caller imprime "Done"/"None!" según modo)»*. En el binario
el mensaje lo imprime **el propio controller** (`0x1247 push ax` / `0x1248 call 0x3670`), no su
llamador, y la elección por modo está en `0x1238`. Si «el caller» se lee como el llamador de TS
—que es lo que el docblock viene describiendo— la frase es correcta y no es aserto de fidelidad; si
se lee como el binario, es falsa. No se adjudica: no es el par, y la lectura benigna es la que el
contexto del fichero sostiene. Se deja escrito con offsets para quien re-rotule.

## 3. Estado de la cola

| | pares |
|---|---|
| población @ `3dd2fea4` | 345 |
| `DIVERGE` F+L | 64 |
| ya (d) por #188/#190 | 4 |
| adjudicados por los carriles anteriores | 14 |
| sub-tandas 1-4 del carril `sueltos-174` | 30 |
| adjudicados aquí | **7** |
| **VIVOS** | **9** |

Balance de la banda entera: **51 de 64 adjudicados**, y los 9 vivos son los **8 de `skin` + 1 de
`ui`** de la sub-tanda 6: `DUNGEON.OVL:0x14aa`, `ENDGAME.OVL:0x00d6`, `FONT.OVL:0x03aa`,
`ULTIMA.EXE:0x31f4`, `0x535e`, `0x56e6`, `0x6b7e`, `ZSTATS.OVL:0x0a81` y `INTRO.OVL:0x0dec`.

⚠ **CORTE EN FRONTERA DE CAPA**: `core` queda ENTERO cerrado; ningún par de `skin`/`ui` abierto.

## 4. Lo que esta sub-tanda NO ha hecho

- **No ha tocado `game/src` ni `re/tools`.** Los 7 estaban bien.
- **No ha leído** los 9 restantes.
- **No ha resuelto** el «Mix NO toca RNG» (dueño vivo: #105) más allá de la enumeración de §2.1.
- **No ha verificado la CONDICIÓN** (#144) más allá de lo dicho; en `CMDS`, `SHOPPES2`, `TOWN` y
  `ZSTATS` sí se comprobó que el port modela los DOS brazos.
- **No ha cotejado contra el catálogo** los símbolos que el disasm deja en rebase (`0xffffc232` vs
  `0x4402`, `0xffffa6f8`): materia #81/#191. Sí se cotejó `0xbd1a`/`0xbd20` (§2.5) porque la cita
  hacía una afirmación explícita SOBRE el ledger.
- **Una** de las 7 citas lleva el token `kernel` (§2.2) y se declara BENIGNA con motivo medido.

## 5. Gates (EXIT por separado, sin pipes, re-corridos tras el `git add`)

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

## 6. Nombres de overlay usados aquí (sección FINAL a propósito)

Al final por el ctx pegajoso de #84. Overlays nombrados: `CMDS.OVL`, `DNGLOOK.OVL`, `DUNGEON.OVL`,
`ENDGAME.OVL`, `FONT.OVL`, `INTRO.OVL`, `MAINOUT.OVL`, `SHOPPES.OVL`, `SHOPPES2.OVL`, `TOWN.OVL`,
`ULTIMA.EXE`, `ZSTATS.OVL`.
