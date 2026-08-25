# ACTA #174 (banda PEGAJOSA) — TANDA 9, SUB-TANDA 7: los CINCO últimos, y la celda `DIVERGE` CERRADA 64/64

> Rama `re/sueltos-174`, worktree `.claude/worktrees/sueltos-174`, base **main `f07730f3`**.
> Toda cifra medida en ese árbol. RETENIDA: aterriza el lead.
> Continúa `sueltos-174-t6-acta.md` §4 (la cola de 5, toda de presentación).

---

## 0. VEREDICTO — y el CIERRE de la celda

**5 pares · 5 (a) exacta · 0 (b) · 0 (c) · 0 (d)**, con **5 lecturas**.

| par | fichero del port | veredicto |
|---|---|---|
| `DUNGEON.OVL:0x14aa` | `skin/fiel/dungeon-decor.ts:9` | **(a)** — las DOS ternas de argumentos, literales |
| `ENDGAME.OVL:0x00d6` | `skin/fiel/endgame-frame.ts:267` | **(a)** — SEIS inmediatos, seis aciertos |
| `FONT.OVL:0x03aa` | `skin/fiel/skin.ts:1315` | **(a)** en sus límites — el offset es el discriminador (§2.3) |
| `INTRO.OVL:0x0dec` | `ui/faithful-intro.ts:1428` | **(a)** — el «default» escribe la tecla a mano |
| `ULTIMA.EXE:0x31f4` | `main.ts:953` | **(a)** — la «rama loc≠0», literal, y con regalo cruzado |

★★ **Con estos cinco, la celda `DIVERGE × (FORZADA + LIMPIA)` queda CERRADA 64/64** (§3), y con ella
la última celda adjudicable de la banda pegajosa.

## 1. RE-ANCLA: séptima medida, séptima vez idéntica

`main = f07730f3`, `git diff 258f6fcb..main -- game/src` **VACÍO**, 345 pares @ `65d1c168`, 3
controles verdes. La celda no se ha movido en las siete sub-tandas.

## 2. Las cinco lecturas

### 2.1 `DUNGEON.OVL:0x14aa` — la CRUZ, con sus dos ternas de argumentos

La cita afirma *«CRUZ 3×3 en (x,y) — hline `0x8acc(x−1,y,x+1)` + vline `0x8b22(x,y−1,y+1)` — color
`[0x13b2]`»*.

| call-site | instrucción | término |
|---|---|---|
| `DUNGEON.OVL:0x14aa`, | `push word ptr [g_unk_13b2]` / `call 0x88a0` | el COLOR, de `[0x13b2]` ✓ |
| `DUNGEON.OVL:0x14b1`, | `mov ax, word ptr [bp + 0xa]` / `dec ax` / `push ax` | `x − 1` ✓ |
| `DUNGEON.OVL:0x14b6`, | `push word ptr [bp + 8]` | `y` ✓ |
| `DUNGEON.OVL:0x14b9`, | `mov ax, word ptr [bp + 0xa]` / `inc ax` / `push ax` | `x + 1` ✓ |
| `DUNGEON.OVL:0x14be`, | `call 0x8acc` | el `hline` ✓ |
| `DUNGEON.OVL:0x14c1`, | `push word ptr [bp + 0xa]` | `x` ✓ |
| `DUNGEON.OVL:0x14c4`, | `mov ax, word ptr [bp + 8]` / `dec ax` / `push ax` | `y − 1` ✓ |
| `DUNGEON.OVL:0x14c9`, | `mov ax, word ptr [bp + 8]` / `inc ax` | `y + 1` ✓ |

★ **Las dos ternas, término a término.** Y lo que hace la CRUZ demostrable no es que la cita lo diga:
es que **`[bp+0xa]` (la x) se dec/inc-rementa en la horizontal y `[bp+8]` (la y) en la vertical**, y
el otro eje va tal cual en cada llamada. Cruzar los ejes daría otra figura; aquí no están cruzados.
**(a) exacta.**

### 2.2 `ENDGAME.OVL:0x00d6` — seis inmediatos, seis aciertos

La cita afirma *«página 0 (0x00d6-0x0110) = The(0) en (216,0) + Homecoming(4) en (152,28)»*.

| call-site | instrucción | valor de la cita |
|---|---|---|
| `ENDGAME.OVL:0x00d9`, | `sub ax, ax` / `push ax` | sub-lámina **0** («The») ✓ |
| `ENDGAME.OVL:0x00dc`, | `mov ax, 0xd8` / `push ax` | **216** ✓ |
| `ENDGAME.OVL:0x00e0`, | `sub ax, ax` / `push ax` | **0** ✓ |
| `ENDGAME.OVL:0x00e4`, | `call 0x6abc` | la llamada de blit ✓ |
| `ENDGAME.OVL:0x00ea`, | `mov ax, 4` / `push ax` | sub-lámina **4** («Homecoming») ✓ |
| `ENDGAME.OVL:0x00ee`, | `mov ax, 0x98` / `push ax` | **152** ✓ |
| `ENDGAME.OVL:0x00f2`, | `mov ax, 0x1c` / `push ax` | **28** ✓ |
| `ENDGAME.OVL:0x00f9`, | `call 0x6abc` | la segunda llamada ✓ |
| `ENDGAME.OVL:0x0100`, | `mov al, byte ptr [bx + 0x3dee]` | la tabla `0x3dee` que la cita nombra ✓ |

★ **Seis números afirmados y seis inmediatos que los sostienen**, en el orden de los `push`
(`0xd8`=216, `0x98`=152, `0x1c`=28). Es la cita más DENSA en cifras de todo el carril y no falla
ninguna. De regalo, el `0x0100`, que lee la tabla `0x3dee` que la misma cabecera declara dos líneas
más arriba. **(a) exacta.**

### 2.3 `FONT.OVL:0x03aa` — (a) en sus LÍMITES, y se dice cuáles
> ⚠ **BANNER 2026-07-30 — la ATRIBUCIÓN de este par ya no la sostiene la banda (ruling
> #204/#217).** Con `sower_upper` encendido por omisión, `FONT.OVL:0x03aa,` SALE de la
> banda pegajosa: `skin/fiel/skin.ts` nunca nombra `FONT.OVL` en MAYÚSCULAS, así que el
> único aval de la atribución era un token en minúsculas. Es el control positivo del
> criterio (`pegajosa-instrumento-217-acta.md` §4) y el caso que `generos-194-acta.md`
> §3.2 ya había marcado como **cerrado DOS VECES sobre el cuerpo equivocado**. Lo que
> sigue se conserva como REGISTRO; no se re-adjudica aquí. El arreglo constructivo no es
> revertir el criterio: es nombrar el overlay en mayúsculas en el docblock del port.


La cita es corta: *«(U)se Spyglass de noche: vista de zodíaco (look_sky NIGHT, `0x03aa`)»*.

| call-site | instrucción | destino |
|---|---|---|
| `FONT.OVL:0x03aa`, | `cmp word ptr [bp + 4], 0` / `je 0x3b7` | `0x03b7` |
| `FONT.OVL:0x03b0`, | `mov ax, 1` / `push ax` / `call 0x3f1a` | — |
| `FONT.OVL:0x03b7`, | `cmp byte ptr [0xbd29], 2` / `jne 0x3d0` | `0x03d0` |

Lo verificable es que `0x03aa` **es** el discriminador de la rutina: una guarda de dos brazos sobre
el argumento, con el brazo no-cero haciendo trabajo extra antes de reunirse. Eso encaja con una
rutina de cielo con modo día/noche y con un `0x03aa` que señala el modo.

⚠ **Lo que NO se ha derivado, y por eso el veredicto va acotado**: que `[bp+4]` sea el flag de NOCHE.
Se adjudica que el offset citado es el discriminador de esa rutina; **no** que el brazo citado sea el
nocturno. Mismo trato que `BLCKTHRN.OVL:0x091f` en la tanda 7. **(a) en sus límites.**

> ★★ **RETRACTACIÓN DE ESTE §2.3 — #194, 2026-07-29. Este par NO EXISTE: la cita de
> `skin.ts:1315` no es a FONT.** El overlay se lo puso la política PEGAJOSA, que heredó
> el token `font` del parámetro TypeScript `font: FaithfulFont` de `skin.ts:1276` — un
> HOMÓGRAFO en minúsculas del nombre de overlay, 39 renglones más arriba. Lo que la cita
> nombra es `look_sky`, y el ledger la sitúa como `look_sky_sun_or_stars` en
> **`LOOKOBJ.OVL`**, entrada `0x0366`, tamaño 412 ⇒ contiene `0x03aa`. Y allí `0x03aa`
> **sí** es la rama de NOCHE, por el gate de la hora que salta a ella:
>
> | offset | instrucción | efecto |
> |---|---|---|
> | `LOOKOBJ.OVL:0x036e`, | `cmp byte ptr [g_hour], 6` / `jb 0x3aa` | antes de las 6 → noche |
> | `LOOKOBJ.OVL:0x0375`, | `cmp byte ptr [g_hour], 0x12` / `jae 0x3aa` | 18:00 o más → noche |
> | `LOOKOBJ.OVL:0x037c`, | `mov ax, 0x72f0` / `call 0x75c0` | día → «the sun!» |
> | `LOOKOBJ.OVL:0x03ea`, | `mov word ptr [bp - 4], 0x50` | noche → 80 estrellas |
>
> La cabecera de `skin.ts:1315` era **correcta desde el principio**; lo rancio era la
> atribución de este acta. Se retira el veredicto «(a) en sus límites» sobre este par:
> no hay par. El hallazgo de `sueltos-b-174-t2 §4.3` sobre el cuerpo de FONT (que
> `[bp+4]` es un CONTADOR de repeticiones) **sigue en pie** — lo que se cae es su
> vínculo con el docblock del port. Detección y control positivo:
> `python3 re/tools/cita_rama_hermana.py --rancio` (eje B).

### 2.4 `INTRO.OVL:0x0dec` — el «default» del timeout escribe la tecla A MANO

| call-site | instrucción | destino | qué es |
|---|---|---|---|
| `INTRO.OVL:0x0de6`, | `mov byte ptr [bp - 0xe], al` / `jmp 0xdce` | `0x0dce` | vía normal: la tecla LEÍDA |
| `INTRO.OVL:0x0dec`, | `mov byte ptr [bp - 0xe], 0x52` / `jmp 0xdce` | `0x0dce` | vía del timeout: `'R'` FORZADA |

★ **«Default» aquí no es una figura retórica**: el `0x0dec`, con su `mov`, deja el inmediato `0x52` en la MISMA
variable donde la vía normal deja la tecla leída, y salta al MISMO despacho de `0x0dce`. El menú no
distingue «el usuario pulsó R» de «venció el temporizador» — recibe la misma letra por el mismo
sitio. Y `0x52` es `'R'`, la inicial de la entrada *Return to the View* que la cita nombra.

⇒ la afirmación *«es además el default del timeout ocioso, 0x0dec»* es exacta, y además explica por
qué el port lo modela como el mismo `case "view"`. **(a) exacta.**

### 2.5 `ULTIMA.EXE:0x31f4` — la «rama loc≠0», y un regalo cruzado

| call-site | instrucción | destino | qué es |
|---|---|---|---|
| `ULTIMA.EXE:0x31f4`, | `cmp byte ptr [g_location], 0` / `jne 0x3210` | `0x3210` | **la rama `loc ≠ 0`** ✓ |
| `ULTIMA.EXE:0x31fb`, | `cmp byte ptr [g_sail_dir], 0` / `je 0x3210` | `0x3210` | en exterior: ¿navegando? |
| `ULTIMA.EXE:0x3202`, | `mov ax, 0xa122` / `push ax` / `call 0x1850` | — | el mensaje del OTRO brazo |

La cita —*«Space = Pass (kernel 0x31F4 rama loc≠0)»*— es **literal**: el offset es el `cmp` sobre
`g_location` y el `jne` de la línea siguiente es el brazo que la cita reclama.

★ **Y el regalo cruzado**: el docblock de `dungeon.ts:425`, adjudicado en la sub-tanda 4 de este
mismo carril, decía que *«la rama "Sheets in irons!" es sólo navegando»*. Aquí se ve **por qué**: la
única vía que llega al mensaje de `0x3202`, la del `push`, pide `g_location == 0` **y** `g_sail_dir != 0`, o sea
exterior y con velas izadas. **Dos citas de dos ficheros distintos, adjudicadas en dos sub-tandas
distintas, se explican la una a la otra sin que ninguna invoque a la otra.** **(a) exacta.**

## 3. ★★ CIERRE DE LA CELDA — la aritmética, por MIEMBROS

| | pares |
|---|---|
| población @ `65d1c168` | 345 |
| `DIVERGE × (FORZADA + LIMPIA)` | **64** |
| (d) por #188 / #190, antes de este carril | 4 |
| adjudicados por el carril `diverge-174` (sub-tandas 1-4) | 14 |
| adjudicados por ESTE carril (sub-tandas 1-7) | **46** |
| **VIVOS** | **0** |

`4 + 14 + 46 = 64` ✓ — y la lista de los 46 se derivó **por miembros** en cada sub-tanda, con `diff`
contra el volcado de la celda, no por resta de conteos. **La celda `DIVERGE` queda CERRADA 64/64.**

### 3.1 Balance del carril

| | |
|---|---|
| pares | **46** |
| lecturas | **40** (ritmo 0,87) |
| **(a) exacta** | **44** |
| **(b)** cita imprecisa | **1** — `MAINOUT.OVL:0x0312` |
| **(d)** par fabricado | **1** — `ULTIMA.EXE:0x535e` |
| defectos de MECÁNICA del port hallados al lado | **1** — Rel Tym en combate (#203) |

Ritmo por sub-tanda: **0,63 · 0,78 · 0,86 · 1,00 · 1,00 · 1,00 · 1,00**. La serie es monótona y con
una sola variable explicativa —cuántos pares comparten RUTINA—; el estimador de 1,0 para sueltos se
pre-registró en la sub-tanda 3 y se cumplió **cuatro veces seguidas**.

### 3.2 Lo que este carril deja escrito como método

1. **Los hermanos se agrupan por DOCBLOCK, no por línea.** El censo por línea de la tanda 8 era cota
   inferior y partía docblocks dentro de una sub-tanda, entre sub-tandas y **entre carriles**
   (`SJOG.OVL:0x119e`).
2. **Agrupar por FICHERO es un PROXY del ahorro, no el ahorro.** Sólo rinde cuando los pares caen en
   la misma rutina; a 150-1700 líneas de distancia el ahorro es cero.
3. **Antes de cobrar una enumeración incompleta, hay que leer QUÉ DICE ENUMERAR.** El único (b) del
   carril cayó porque su lista enumeraba SALIDAS y se dejaba una; la de `turn.ts` enumeraba CONSUMOS
   DE RNG y lo que le faltaba no consume.
4. **Las marcas de DATO también viven en la PROSA.** «tabla», «descriptor», «runtime» delatan un
   offset de dato igual que el prefijo `DS` o el corchete, y **no dejan rastro en la notación**.
5. **Un aterrizaje que toca `game/src` no implica que la banda se mueva.** El disparador es necesario
   y no suficiente; el conteo igual tampoco basta — hay que comparar MIEMBROS.

## 4. Lo que este carril NO ha hecho

- **No ha tocado `game/src` ni `re/tools`** en ninguna de las siete sub-tandas.
- **No ha verificado la CONDICIÓN** (#144) de forma sistemática: se adjudica que la cita describe el
  tramo. Donde además se comprobó que el port modela los dos brazos, está dicho en su sub-tanda.
- **No ha tocado la celda `LEJANA + AMBIGUA`** (78 pares en `DIVERGE`), que sigue fuera de la mitad
  adjudicable: la atribución va primero.
- Cabos declarados y sin dueño, por si el lead quiere tarjeta: la salida SILENCIOSA de
  `MAINOUT.OVL:0x031e` (y qué devuelve `0xffffb4be`), el CUARTO argumento del spawn de
  `ULTIMA.EXE:0x6b85`, `[bp-4]` de `CMDS.OVL:0x1ac6`, y el flag de `FONT.OVL:0x03aa` de §2.3.

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

Al final por el ctx pegajoso de #84. Overlays nombrados: `BLCKTHRN.OVL`, `CMDS.OVL`, `DUNGEON.OVL`,
`ENDGAME.OVL`, `FONT.OVL`, `INTRO.OVL`, `MAINOUT.OVL`, `SJOG.OVL`, `ULTIMA.EXE`.
