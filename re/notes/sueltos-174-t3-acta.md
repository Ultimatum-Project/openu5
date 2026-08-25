# ACTA #174 (banda PEGAJOSA) — TANDA 9, SUB-TANDA 3: `turn.ts` · `camp.ts` · `conversation.ts`, 7 pares

> Rama `re/sueltos-174`, worktree `.claude/worktrees/sueltos-174`, base **main `258f6fcb`**.
> Toda cifra medida en ese árbol. RETENIDA: aterriza el lead.
> Continúa `sueltos-174-t2-acta.md` §4 (el corte en frontera de grupo de la sub-tanda 2).

---

## 0. VEREDICTO

**7 pares · 7 (a) exacta · 0 (b) · 0 (c) · 0 (d)** — con **6 lecturas**.

| par | fichero del port | veredicto |
|---|---|---|
| `MAINOUT.OVL:0x0b14` | `turn.ts:159` | **(a)** — el viento, primero, y sólo en el exterior |
| `MAINOUT.OVL:0x0c64` | `turn.ts:164` | **(a)** — «pantano **a pie**»: las DOS mitades, literales |
| `TOWN.OVL:0x10d0` | `turn.ts:504` | **(a)** — el housekeeping FUERA del bucle, y corroborado por su gemelo |
| `CMDS.OVL:0x0306` | `camp.ts:258` | **(a)** en sustancia; «epílogo» es palabra floja (§3.3) |
| `OUTSUBS.OVL:0x0940` | `camp.ts:337` | **(a)** — la división por 20 y el `0x29f`, con los dos extremos del rango |
| `TALK.OVL:0x1166` | `conversation.ts:539` | **(a)** — las CUATRO sub-afirmaciones, todas literales |
| `TALK.OVL:0x0ad3` | `conversation.ts:613` | **(a)** — la comilla de cierre, y su hermana de apertura |

★ **Tercera instancia de `caso-canonico-ya-compensado`** (§3.2), y la más instructiva de las tres:
la lista del port se salta un bloque entero del binario **con un motivo de diseño correcto**.

## 1. RE-ANCLA: medida al abrir, y esta vez sin disparador

```
main = 258f6fcb
git diff fb6c8eef..main -- game/src            → VACÍO
cita_pegajosa_atribucion.py → 345 pares @ 598eb301, 3 controles verdes
diff  {los 64 de la sub-tanda 1}  {los 64 de ahora}  → VACÍO
```

Los 64 de la celda reproducen **por MIEMBROS** por tercera sub-tanda consecutiva. Cola al empezar:
**29 vivos**.

## 2. ⚠ CORTE A LAS 7, y el motivo es una MEDIDA que desmiente el plan

El plan de la sub-tanda 2 proponía 9 pares: `loops/turn.ts` (3) + tres grupos de 2. Se cierran
**7** y se declara por qué: **los «grupos de 2 por fichero» que quedan NO son grupos por RUTINA**,
que es de donde salía todo el ahorro de las sub-tandas 1 y 2.

| grupo por fichero | líneas | ¿mismo docblock? |
|---|---|---|
| `core/world/camp.ts` | 258 · 337 | NO (79 líneas) — **cobrado igual, son vecinos** |
| `core/dialogue/conversation.ts` | 539 · 613 | NO (74 líneas) — **cobrado igual, son vecinos** |
| `skin/fiel/skin.ts` | 1315 · 2184 | **NO — 869 líneas** |
| `main.ts` | 953 · 2716 | **NO — 1763 líneas** |
| `core/dungeon/dungeon.ts` | 425 · 577 | **NO — 152 líneas** |

⇒ **La agrupación por fichero es un PROXY del ahorro, no el ahorro.** Rindió 0,63 y 0,78 mientras
los pares del mismo fichero cayeron en la misma rutina; en estos tres grupos están a 150-1700
líneas y cada uno es una lectura entera. Ritmo de esta sub-tanda: **0,86** (7 pares / 6 lecturas),
y para los 22 que quedan hay que contar **1,0**, que es lo que el relevo decía desde el principio.

**Corte en frontera de grupo**, con `turn.ts`, `camp.ts` y `conversation.ts` cerrados enteros.

## 3. Las seis lecturas

### 3.1 `MAINOUT.OVL:0x0a84` — el orden del turno exterior, punto por punto

La cita es una lista numerada con un offset por paso. Verificados los que la enmarcan:

| call-site | instrucción | destino | paso de la lista |
|---|---|---|---|
| `MAINOUT.OVL:0x0b0a`, | `cmp byte ptr [g_location], 0` / `je 0xb14` | `0x0b14` | 1. VIENTO, sólo en el exterior |
| `MAINOUT.OVL:0x0c30`, | `cmp word ptr [bp - 8], 0` / `jne 0xc39` | `0x0d14` | 2. BLOCKED ⇒ fin, salta todo |
| `MAINOUT.OVL:0x0c39`, | `mov ax, 2` / `push ax` / `call 0xffffcdac` | — | 3. `advance_clock(2)`, el 2 literal |
| `MAINOUT.OVL:0x0c56`, | `mov al, byte ptr [bp - 0x10]` / `and al, 0xfe` / `cmp al, 0x6a` | `0x0c5f` | 4. puente ⇒ emboscada de troll |
| `MAINOUT.OVL:0x0c64`, | `cmp word ptr [bp - 0x10], 4` / `jne 0xc7e` | `0x0c7e` | 5. pantano: el TILE |
| `MAINOUT.OVL:0x0c6a`, | `cmp byte ptr [g_transport_tile], 0x1c` / `jne 0xc7e` | `0x0c7e` | 5. pantano: el **a pie** |
| `MAINOUT.OVL:0x0c7e`, | `cmp word ptr [bp - 0x10], 0x8f` / `jne 0xc8a` | `0x0c85` | 5b. LAVA ⇒ «Burning!» |
| `MAINOUT.OVL:0x0cd0`, | `call 0xa60` | — | 6. `underworld_hazard` |
| `MAINOUT.OVL:0x0cd3`, | `call 0xffffa918` | — | 7. `turn_housekeeping` |

★ **«pantano a pie» son DOS comparaciones, y la cita las comprime en una frase que resulta ser
exacta**: el `0x0c64`, sobre el tile 4, y el `0x0c6a`, sobre el transporte `0x1c` (a pie).
Si sólo estuviera la primera, un jinete envenenaría igual. Los dos gates saltan al MISMO destino.

★ Y el docblock vecino de `burning` (`turn.ts:148-150`) dice que en el asm la LAVA está en `0x0c85` y el
HAZARD en `0x0cd0`, para justificar por qué el mensaje va en campo propio — el `0x0c85` es la `call` de la
lava y el `0x0cd0` el destino común ✓ — **el orden de impresión que afirma se sostiene en el orden de
los offsets**. Los dos pares, **(a) exacta**.

### 3.2 ★ El bloque que la lista SE SALTA, y por qué no es un hueco

Entre el paso 5b (`0x0c7e`) y el 6 (`0x0cd0`) hay un bloque entero que la lista numerada no
menciona:

| call-site | instrucción | qué es |
|---|---|---|
| `MAINOUT.OVL:0x0c8a`, | `cmp byte ptr [g_party_x], 0xe9` / `jne 0xcd0` | coordenada X fija |
| `MAINOUT.OVL:0x0c91`, | `cmp byte ptr [g_party_y], 0xeb` / `jne 0xcd0` | coordenada Y fija |
| `MAINOUT.OVL:0x0c98`, | `cmp byte ptr [g_floor], 0` / `jne 0xcd0` | sólo planta 0 |
| `MAINOUT.OVL:0x0c9f`, | `cmp byte ptr [g_location], 0` / `jne 0xcd0` | sólo exterior |
| `MAINOUT.OVL:0x0ca6`, | `mov ax, 0x2b6b` / `push ax` / `call 0xffff9680` | imprime |
| `MAINOUT.OVL:0x0cad`, | `cmp byte ptr [g_shrine_quest_bitmap], 0` / `je 0xcbe` | bifurca por la búsqueda |
| `MAINOUT.OVL:0x0ccc`, | `inc byte ptr [g_party_y]` | y **mueve a la party** |

Parecía el mismo defecto que el (b) de la sub-tanda 2: una enumeración que no agota. **No lo es, y
por partida doble.**

1. **Está PORTADO**, en otro fichero: `game/src/core/world/shrine-ceremonies.ts:158` contiene
   literalmente `pos.floor === 0 && pos.x === 0xe9 && pos.y === 0xeb`. Los cuatro gates, calcados.
2. **Y su ausencia de la lista es CORRECTA por el criterio de la propia lista.** El docblock se
   titula *«ORDEN EXACTO de RNG»* y numera **consumidores de RNG**. En todo el bloque
   `0x0c8a-0x0ccc` **no hay ni una `call` al generador** — es determinista. ⇒ no pertenece a esa
   lista, y omitirlo no es olvido sino aplicar el criterio anunciado.

⇒ Tercera instancia de `caso-canonico-ya-compensado`, y **la primera en que la compensación no es
sólo «está escrito en otro sitio» sino «el criterio declarado de la lista lo excluye»**. La
lección operativa se afina: antes de cobrar una enumeración incompleta, **hay que leer qué dice
enumerar** — el (b) de la sub-tanda 2 cayó porque allí la lista enumeraba SALIDAS y se dejaba una
salida; aquí enumera CONSUMOS DE RNG y lo que falta no consume.

### 3.3 `TOWN.OVL:0x10d0` — el housekeeping FUERA del bucle, con un gemelo que lo confirma

| call-site | instrucción | destino | papel |
|---|---|---|---|
| `TOWN.OVL:0x10c7`, | `cmp word ptr [bp - 2], 0` / `je 0x10d0` | `0x10d0` | la COLA del bucle |
| `TOWN.OVL:0x10cd`, | `jmp 0xf48` | `0x0f48` | el retro-salto a la cabeza |
| `TOWN.OVL:0x10d0`, | `call 0xffffa918` | — | el housekeeping, UNA vez |
| `TOWN.OVL:0x10d3`, | `pop si` / `pop di` / `mov sp, bp` | — | epílogo inmediatamente después |

La cita dice *«la COLA 0x10c7 hace `cmp [bp-2],0 / jne → jmp 0xf48`»* y que el cierre de turno de `0x10d0`
va después de la cola y corre UNA vez, se haya caído o no. **Las dos, exactas**: el `je 0x10d0`
sobre el `jmp 0xf48` es la forma que el compilador da a ese `jne`, y `0x10d0` está fuera del
retro-salto, con el epílogo pegado detrás.

★ **Corroboración que no costó nada y que la cita no invoca**: el mismo callee, `0xffffa918`,
aparece en `MAINOUT.OVL:0x0cd3`, que es el paso 7 de la lista de §3.1. **Dos bucles distintos —el de
pueblo y el exterior— llaman a la misma rutina de cierre de turno**, lo que sostiene la etiqueta
`turn_housekeeping` desde dos sitios que no se hablan. **(a) exacta.**

### 3.4 `CMDS.OVL:0x0306` — el retorno temprano de la emboscada

| call-site | instrucción | destino | qué pasa |
|---|---|---|---|
| `CMDS.OVL:0x02fd`, | `cmp word ptr [bp - 0x1c], -1` / `jg 0x306` | `0x0306` | hubo emboscada (índice ≥ 0) |
| `CMDS.OVL:0x0303`, | `jmp 0x3ea` | `0x03ea` | NO hubo ⇒ sigue al despertar |
| `CMDS.OVL:0x0306`, | `mov ax, 1` / `jmp 0x549` | `0x0549` | devuelve 1 y sale |

La afirmación de la cita —*«Sólo corre si NINGÚN roll de `campSleepStep` acertó (la emboscada
retorna temprano)»*— es **exacta**, y el `jg` con signo sobre `-1` es justo el centinela «sin
índice». El port lo calca: `return { events, ambush: true }` corta antes de `campWake`. **(a)**.

⚠ **Palabra floja, declarada**: la cita llama a `0x0306` «epílogo», y `0x0306` es el **stub de
retorno-1**; el epílogo de verdad está en `0x0549`, adonde salta. No cambia el veredicto —lo que la
cita afirma es que ahí se sale— pero el término no es el del binario.

### 3.5 `OUTSUBS.OVL:0x0940` — la división por 20, y un rango con los dos extremos exactos

| call-site | instrucción | destino | término de la cita |
|---|---|---|---|
| `OUTSUBS.OVL:0x0915`, | `mov al, byte ptr [g_karma]` | — | inicio de `0x0915-0x091c` ✓ |
| `OUTSUBS.OVL:0x091a`, | `mov cl, 0x14` / `div cl` | — | `index = g_karma/20` ✓ literal |
| `OUTSUBS.OVL:0x0923`, | `cmp ax, 4` / `jge 0x940` | `0x0940` | el fork por índice ✓ |
| `OUTSUBS.OVL:0x0939`, | `push word ptr [bx + 0x1a74]` | — | tabla DS `0x1a74`, recs 0-3 ✓ |
| `OUTSUBS.OVL:0x094c`, | `mov ax, 0x29f` / `push ax` | — | offset FIJO `0x29f` ✓ |
| `OUTSUBS.OVL:0x0950`, | `call 0x82de` | — | la REUNIÓN de los dos brazos |

**Todo literal**: el divisor `0x14` = 20, la tabla, el offset fijo y el `jge`. Y el rango declarado
`0x0940-0x094f`, y acaba justo en el `push ax` previo a la llamada compartida ⇒ **los dos
extremos, exactos**. El port modela AMBOS destinos (`if (idx < 4) … return CAMP_KARMA_MESSAGES[0]`),
que es la pregunta de la celda. **(a) exacta.**

⚠ No derivado: los dos brazos empujan un PRIMER argumento distinto (`0x77e4` frente a `0x77ee`) a
la misma rutina de carga, y la cita no lo menciona. No es contradicción —no toca al índice ni al
record— pero queda anotado sin adjudicar.

### 3.6 `TALK.OVL:0x1166` y `0x0ad3` — dos forks de sección del `.TLK`

**El primero, con sus CUATRO sub-afirmaciones verificadas una a una:**

| call-site | instrucción | destino | la cita dice |
|---|---|---|---|
| `TALK.OVL:0x113e`, | `call 0xd7a` | — | el test del bitmap `npcMet` ✓ |
| `TALK.OVL:0x1143`, | `or ax, ax` (en `0x1141`) / `jne 0x1166` | `0x1166` | el reparto, con su mnemónico ✓ |
| `TALK.OVL:0x1166`, | `call 0x4da` / `mov ax, 2` | — | comilla + sección **2** = GREETING ✓ |
| `TALK.OVL:0x1145`, | `call 0x60d6` / `push` / `call 0x60fe` | — | `srand(reloj DOS)` ✓ |
| `TALK.OVL:0x114f`, | `push 0` / `push 1` / `call 0x6112` | — | `rand(0,1)` ✓ |
| `TALK.OVL:0x1158`, | `or ax, ax` / `je 0x117d` | `0x117d` | r==0 ⇒ ni una línea ✓ |
| `TALK.OVL:0x115a`, | `mov ax, 0x94ce` / `push` / `call 0x58d0` | — | DS `0x94ce` ✓ |
| `TALK.OVL:0x1163`, | `sub ax, ax` (en `0x1161`) / `jmp 0x116c` | `0x116c` | sección **0** = NAME ✓ |

★ **Los dos brazos se reúnen en `0x116c push ax / call 0x7aa`, y lo ÚNICO que los distingue es el
valor de `ax`: 2 o 0.** El número de sección ES la bifurcación — no hay dos llamadas distintas,
hay una llamada con dos argumentos. Es la forma más limpia que puede tener un `DIVERGE`, y la cita
la describe exactamente así. **(a) exacta.**

**El segundo, la comilla de cierre:**

| call-site | instrucción | destino | qué es |
|---|---|---|---|
| `TALK.OVL:0x0aa8`, | `mov ax, 0x93c2` / `push` / `call 0x58d0` | — | `"My name is ` DS `0x93c2` ✓ |
| `TALK.OVL:0x0ab7`, | `or ax, ax` (en `0x0ab5`) / `je 0xad3` | `0x0ad3` | el fork citado ✓ |
| `TALK.OVL:0x0ad3`, | `call 0x4da` | — | la comilla de CIERRE ✓ |

★ **La misma rutina `0x4da` que en `0x1166` ponía la comilla de APERTURA pone aquí la de cierre** —
dos pares de esta sub-tanda, de docblocks distintos, se corroboran entre sí sobre el mismo callee.
Y el *«en la MISMA fila; el nombre continúa»* se sostiene por ausencia local: en el tramo que va del `0x0aac` (la
impresión del prefijo) al `0x0ab2` (el procesado de la sección) **no hay emisión de salto de línea**.
**(a) exacta.**

## 4. Estado de la cola

| | pares |
|---|---|
| población @ `598eb301` | 345 |
| `DIVERGE` F+L | 64 |
| ya (d) por #188/#190 | 4 |
| adjudicados por los carriles anteriores | 14 |
| sub-tanda 1 | 8 |
| sub-tanda 2 | 9 |
| adjudicados aquí | **7** |
| **VIVOS** | **22** |

Balance del carril: **24 pares por 18 lecturas (0,75)** — 23 (a) · 1 (b) · 1 (c) · 0 (d).

**Para la sub-tanda 4**: los 22 restantes NO tienen ahorro estructural conocido (§2), así que
**8 pares por sub-tanda a 1,0 lecturas/par**. Sin orden preferente por agrupación; se recomienda
el criterio de la sub-tanda 1 —abrir por lo que esté más caliente— o simplemente por overlay.

## 5. Lo que esta sub-tanda NO ha hecho

- **No ha tocado `game/src` ni `re/tools`.** Los 7 estaban bien.
- **No ha leído** los 22 restantes ni los tres grupos de §2 que resultaron no serlo.
- **No ha derivado** el primer argumento de los dos brazos de §3.5 (`0x77e4` / `0x77ee`).
- **No ha verificado la CONDICIÓN** (#144) más allá de lo dicho; en `OUTSUBS.OVL` y en
  `TALK.OVL:0x1166` sí se comprobó que el port modela los dos brazos.
- Ninguna de las 7 citas lleva el token `kernel`.

## 6. Gates (EXIT por separado, sin pipes, re-corridos tras el `git add`)

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

## 7. Nombres de overlay usados aquí (sección FINAL a propósito)

Al final por el ctx pegajoso de #84. Overlays nombrados: `CMDS.OVL`, `MAINOUT.OVL`, `OUTSUBS.OVL`,
`TALK.OVL`, `TOWN.OVL`.
