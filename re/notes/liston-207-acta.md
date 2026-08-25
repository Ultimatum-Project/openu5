# ACTA #207 — LA CELDA `clase2` F+L, ENUMERADA (53), y los 13 SIN-TEXTO con motivo DERIVADO

> Rama `re/liston-207`, worktree `.claude/worktrees/liston-207`, base **main `994d4fc2`**.
> Toda cifra medida en ese árbol. RETENIDA: aterriza el lead.
> Ejecuta la tarjeta #207 (cola natural de `sueltos-174-cotejo-86.md` §6 y de
> `sueltos-b-206-cotejo-86.md` §3, que declaró esta celda **no cotejable por miembros**).

---

## 0. VEREDICTO DE ESTE PRIMER HITO

**La lista existe.** El defecto estructural del cierre en bloque de la tanda 1 no era el criterio:
era **no haber dejado lista contra la que cotejar**. Este hito la publica y la parte:

| | pares |
|---|---|
| `clase2 × (FORZADA + LIMPIA)` @ `994d4fc2` | **53** |
| de ellos, **NOMBRADOS** en las 9 actas de tandas 1-7 | **16** |
| de ellos, **NO LEÍDOS por nadie** (objeto de las sub-tandas de este carril) | **37** |

★ Los 16 y los 37 **particionan** la celda: `37 ∩ 16 = ∅` y `37 ∪ 16 = 53`, comprobado por conjuntos
(§2.2). Y el reparto **NO es arbitrario**: §3 muestra que **los 7 SIN-TEXTO de la mitad F+L caen los
7 dentro de los 16 nombrados** ⇒ los 37 no leídos son **todos EMITIDA**, es decir todos dentro del
alcance del criterio de #172, no fuera de él.

Y un hallazgo que el encargo no pedía y que cambia cómo hay que leer el residuo SIN-TEXTO:

> ★★ **«SIN-TEXTO» no es un motivo, son CUATRO.** El precedente (`e9907e6f`) archivó sus 7 como
> «7/7 límite del decodificador». Medidos los 13 de hoy uno a uno (§3), el bucket se parte en:
> **9 punteros a zona de ceros** —de los cuales **5 son globales CATALOGADAS del ledger** pasadas
> por referencia—, **1 tabla de punteros**, **2 inmediatos NUMÉRICOS que no son punteros de nada**,
> y **2 cadenas REALES** que el decodificador rechaza por su regla de «al menos una letra».
> Sólo los 2 últimos son «límite del decodificador» en el sentido en que el precedente lo usó.

## 1. RE-ANCLA: medida en este árbol, y sobre LA BANDA ENTERA

Se re-corre sobre **toda** la banda, no sólo sobre `clase2` — es la lección de
`sueltos-174-cierre-acta.md` §2 (un `diff` de la celda propia es ciego a movidos adyacentes).

```
git log -1 main            → 994d4fc2
cita_pegajosa_atribucion.py → 345 pares, 512 citas, 3 controles verdes   EXIT=0
cita_pegajosa_forma.py      → matriz completa, 3 controles verdes        EXIT=0
```

| forma | FORZADA | LIMPIA | LEJANA | AMBIGUA | TOTAL | F+L | #206 decía (@ `05772436`) |
|---|---|---|---|---|---|---|---|
| `clase2` | 3 | 50 | 20 | 38 | 111 | **53** | 53 ✓ |
| `PREFIJO-efecto` | 4 | 12 | 14 | 11 | 41 | 16 | 16 ✓ |
| `PREFIJO-bifurca` | 1 | 3 | 4 | 5 | 13 | 4 | 4 ✓ |
| `BACKEDGE` | 3 | 9 | 6 | 16 | 34 | 12 | 12 ✓ |
| `DIVERGE` | 9 | 55 | 30 | 48 | 142 | 64 | 64 ✓ |
| `PREFIJO-inerte` | 0 | 1 | 0 | 3 | 4 | 1 | 1 ✓ |
| **TOTAL** | **20** | **130** | **74** | **121** | **345** | **150** | 150 ✓ |

⇒ **Cero movidos entre `05772436` y `994d4fc2`** por conteo de celda. ⚠ Eso es una condición
NECESARIA y no suficiente —es exactamente el modo de fallo de `BACKEDGE` en #206, donde 12=12 con
intersección 11—; lo que sí queda **cotejado por MIEMBROS** aquí es la mitad que importa: los 16
nombrados de `clase2` reproducen **exactos** contra las actas (§2.1), y ése es el conjunto que el
reparto de §2 usa.

## 2. ★ LA LISTA — `clase2 × (FORZADA + LIMPIA)`, los 53, miembro a miembro

Entregable por sí solo: **es la lista que la tanda 1 nunca publicó** y sin la cual #206 no pudo
cotejar esta celda. Volcado de `cita_pegajosa_forma.py --celda {FORZADA,LIMPIA} clase2` @ `994d4fc2`.
Columna **L** = ✓ si alguna de las 9 actas de tandas 1-7 lo NOMBRA.

| # | par | fichero del port | L |
|---|---|---|---|
| 1 | `CAST2.OVL:0x0a0c` | `core/world/shrines.ts:136` | ✓ |
| 2 | `CMDS.OVL:0x0978` | `core/game.ts:4184` | ✓ |
| 3 | `CMDS.OVL:0x1b78` | `main.ts:2717` | |
| 4 | `CMDS.OVL:0x1b81` | `main.ts:2718` | |
| 5 | `CMDS.OVL:0x1bf6` | `main.ts:2719` | |
| 6 | `COMBAT.OVL:0x0d08` | `core/combat/combat.ts:1082` | |
| 7 | `DUNGEON.OVL:0x067c` | `core/dungeon/dungeon.ts:361` | ✓ |
| 8 | `LOOKOBJ.OVL:0x0a2a` | `core/game.ts:5356` | |
| 9 | `MAINOUT.OVL:0x0129` | `core/game.ts:1752` | |
| 10 | `MAINOUT.OVL:0x0152` | `core/game.ts:1773` | |
| 11 | `MAINOUT.OVL:0x016a` | `core/world/transport.ts:134` | |
| 12 | `MAINOUT.OVL:0x01dc` | `core/game.ts:1772` | |
| 13 | `MAINOUT.OVL:0x02df` | `core/world/transport.ts:341` | ✓ |
| 14 | `MAINOUT.OVL:0x050e` | `core/world/transport.ts:254` | |
| 15 | `MAINOUT.OVL:0x0592` | `core/world/transport.ts:253` | |
| 16 | `MAINOUT.OVL:0x0cd0` | `core/world/loops/turn.ts:150` | ✓ |
| 17 | `MAINOUT.OVL:0x1120` | `core/world/transport.ts:421` | |
| 18 | `MAINOUT.OVL:0x1c01` | `core/world/loops/hazards.ts:89` | |
| 19 | `MAINOUT.OVL:0x1c0b` | `core/world/loops/hazards.ts:90` | |
| 20 | `MAINOUT.OVL:0x1c37` | `core/game.ts:1286` | |
| 21 | `MAINOUT.OVL:0x1c56` | `core/game.ts:1288` | ✓ |
| 22 | `OUTSUBS.OVL:0x076e` | `core/quest/lordbritish.ts:69` | |
| 23 | `OUTSUBS.OVL:0x07b6` | `core/quest/lordbritish.ts:170` | |
| 24 | `OUTSUBS.OVL:0x07be` | `core/quest/lordbritish.ts:69` | |
| 25 | `OUTSUBS.OVL:0x07d2` | `core/quest/lordbritish.ts:70` | |
| 26 | `OUTSUBS.OVL:0x07e6` | `core/quest/lordbritish.ts:170` | |
| 27 | `SHOPPES.OVL:0x0374` | `core/shops/shops.ts:732` | ✓ |
| 28 | `SHOPPES.OVL:0x03c2` | `core/shops/shops.ts:733` | ✓ |
| 29 | `SHOPPES.OVL:0x061c` | `core/shops/shops.ts:672` | ✓ |
| 30 | `SHOPPES.OVL:0x083e` | `core/game.ts:3752` | |
| 31 | `SHOPPES.OVL:0x0e1d` | `core/shops/shopArmsPicker.ts:9` | ✓ |
| 32 | `SHOPPES.OVL:0x0f2a` | `core/world/cmd-strings.ts:318` | |
| 33 | `SHOPPES.OVL:0x1352` | `core/shops/shoppe-greetings.ts:116` | |
| 34 | `SHOPPES.OVL:0x1390` | `core/world/cmd-strings.ts:390` | |
| 35 | `SHOPPES.OVL:0x1510` | `core/world/cmd-strings.ts:382` | |
| 36 | `SHOPPES2.OVL:0x01c4` | `core/shops/shops.ts:810` | ✓ |
| 37 | `SHOPPES3.OVL:0x01ca` | `core/shops/shops.ts:428` | |
| 38 | `SHOPPES3.OVL:0x01ef` | `core/shops/shops.ts:426` | |
| 39 | `SHOPPES3.OVL:0x0378` | `ui/shop-console.ts:2091` | |
| 40 | `SJOG.OVL:0x0ad4` | `core/world/search.ts:42` | |
| 41 | `SJOG.OVL:0x0ae8` | `core/world/search.ts:36` | |
| 42 | `SJOG.OVL:0x0b6e` | `core/world/commands.ts:775` | |
| 43 | `SJOG.OVL:0x0e42` | `core/game.ts:3548` | |
| 44 | `SJOG.OVL:0x0ee4` | `core/combat/combat.ts:3381` | |
| 45 | `SJOG.OVL:0x158e` | `core/game.ts:4707` | ✓ |
| 46 | `TALK.OVL:0x0a78` | `core/dialogue/conversation.ts:598` | |
| 47 | `TALK.OVL:0x0b0f` | `core/dialogue/conversation.ts:599` | |
| 48 | `TALK.OVL:0x117d` | `core/dialogue/conversation.ts:543` | ✓ |
| 49 | `TALK.OVL:0x1191` | `core/world/faulinei-theft.ts:9` | |
| 50 | `TOWN.OVL:0x10c7` | `core/game.ts:2007` | |
| 51 | `ULTIMA.EXE:0x4786` | `skin/fiel/moongate.ts:10` | ✓ |
| 52 | `ULTIMA.EXE:0x6a4b` | `core/game.ts:6199` | ✓ |
| 53 | `ULTIMA.EXE:0x6c5d` | `core/combat/encounters.ts:284` | ✓ |

**3 FORZADA** (`ULTIMA.EXE:0x4786`, `:0x6a4b`, `:0x6c5d`) + **50 LIMPIA** = 53 ✓, contra el 3 + 50
de la matriz de §1. ★ El total contra el que chocar es el control que en #206 §4 cazó un extractor
roto; aquí cuadra al primer intento y **con el patrón sin extensiones enumeradas**
(`^[A-Z0-9]+\.[A-Z0-9]+:0x`), que es la lección de #206/#208 aplicada, no repetida.

### 2.1 Cómo se derivó la columna **L** — y el juego de actas, re-derivado

El encargo hereda de `sueltos-174-cotejo-86.md` que los nombrados son **16** contra «las 9 actas de
tandas 1-7», pero **aquella acta sólo nombró 7 de las 9** (su tabla de densidad). **No se hereda: se
re-deriva.** Barrido de presencia del offset (con sus variantes de escritura: con y sin ceros a la
izquierda, mayúsculas/minúsculas, y `\b` por delante para no casar dentro de un hex más largo):

| juego de actas | nombrados |
|---|---|
| las 7 de la tabla de densidad de #174 + `citas-pool-adjudicacion.md` | 14 |
| **+ `segmento-188-acta.md`** (aporta `DUNGEON.OVL:0x067c` y `ULTIMA.EXE:0x6a4b`) | **16** ✓ |
| + `corchete-190-acta.md` | 16 (aporta 0) |

⇒ El juego de 9 es: `pegajosa-174` · `pegajosa-96` · `pegajosa-103` · `pegajosa-backedge` ·
`backedge-174` · `pool-174` · `pool-resto-b` · **`segmento-188`** · **`corchete-190`**. Las dos que
faltaban en la tabla de densidad son precisamente **las dos actas de (d)** (#188 y #190), que no
adjudican por lectura sino por instrumento — de ahí que no estuvieran en un ranking de «offsets que
nombra». La cifra **16 se reproduce exacta**, y ahora con el conjunto declarado.

⚠ **Presencia del offset ≠ lectura par a par.** La columna **L** dice «alguien lo nombró», que es
la cota SUPERIOR de lo leído. Los 37 son, por tanto, **cota inferior** de lo no leído: si alguna de
las 16 menciones fuese de pasada, el número real de no-leídos sería mayor, nunca menor.

### 2.2 Controles del barrido de presencia

| control | esperado | obtenido |
|---|---|---|
| POSITIVO — `SJOG.OVL:0x158e` (el de #133, que 5 actas discuten) | aparece | **5 actas** ✓ |
| POSITIVO — `SHOPPES.OVL:0x061c` (3 actas de banda) | aparece | **3 actas** ✓ |
| NEGATIVO — `0x9e7f`, el offset inventado de #174 | NO aparece | ✓ en el juego de 9 |
| partición | `37 ∩ 16 = ∅` y `37 ∪ 16 = 53` | ✓ ambos |

★ **Y el control NEGATIVO se ha ENVENENADO en el repo, sin que nadie lo tocara.** Barrido el mismo
`0x9e7f` contra **los 402 ficheros de `re/notes/`** (no contra las 9), aparece — en
`sueltos-174-cotejo-86.md`, que lo publicó **como su propio control negativo**. Un valor centinela
elegido por ser inexistente deja de serlo en cuanto el acta que lo usa se commitea. No invalida
nada aquí (mi barrido corre sobre las 9), pero es un modo de fallo con nombre para quien reutilice
la técnica: **un centinela publicado caduca; el siguiente carril que reuse `0x9e7f` obtendrá un
falso positivo y creerá que su barrido funciona cuando lo que ha encontrado es el acta anterior.**

### 2.3 El otro censo, para dimensionar

Los mismos 53 barridos contra **`re/notes/` entero** (402 ficheros): **46 con mención, 7 sin
aparecer en ningún fichero**. `sueltos-174-cotejo-86.md` §2 midió **6** en su árbol; hoy son 7.
Los 7 sin rastro alguno en las notas:
`MAINOUT.OVL:0x050e` · `MAINOUT.OVL:0x0592` · `MAINOUT.OVL:0x1c01` · `OUTSUBS.OVL:0x076e` ·
`OUTSUBS.OVL:0x07d2` · `SHOPPES.OVL:0x1390` · `SHOPPES.OVL:0x1510` — los 7 están entre los 37.

## 3. ★★ LOS 13 SIN-TEXTO, con motivo DERIVADO uno a uno

Población: los **111** `clase2` de la banda (las cuatro columnas de atribución), que es donde el
criterio de #172 se corre. Corrida @ `994d4fc2`, con sus dos controles:

```
python3 re/tools/cita_pegajosa_forma.py --clase2                       EXIT=0
  POSITIVO  #133 odd key SJOG.OVL:0x158e → EMITIDA            OK
  CAPACIDAD con el corpus del port VACÍO → NO-EMITIDA 98/98   OK
  EMITIDA 98 · NO-EMITIDA 0 · SIN-TEXTO 13
```

El mecanismo del bucket es el mismo para los 13: `cita_hermana_emitida.pointers()` recoge **todo
inmediato `mov ax, 0x???`** en la ventana de 8 instrucciones tras la rama hermana, y `text_at_lax()`
lo intenta resolver a prosa en `DATA.OVL`. `SIN-TEXTO` = **ninguno de esos inmediatos resolvió**.
Pero **por qué no resolvió es distinto en cada familia**, y eso es lo que el precedente no separó:

| # | par | atrib | inmediato | qué hay REALMENTE ahí | familia |
|---|---|---|---|---|---|
| 1 | `SHOPPES2.OVL:0x04b2` | AMBIGUA | `0x57a8` | **`g_food`** (ledger, 2 B) | **A** puntero a GLOBAL |
| 2 | `TALK.OVL:0x064e` | AMBIGUA | `0x5888` ×2 | **`g_karma`** (ledger, 1 B) | **A** |
| 3 | `ULTIMA.EXE:0x4786` | FORZADA | `0x5887` | **`g_moongate_anim`** (ledger, 1 B) | **A** |
| 4 | `TALK.OVL:0x11c7` | LEJANA | `0x57ac` | **`g_keys`** (ledger, 1 B) | **A** |
| 5 | `SHOPPES.OVL:0x03c2` | LIMPIA | `0x57ac` | **`g_keys`** (ledger, 1 B) | **A** |
| 6 | `SHOPPES.OVL:0x0e1d` | LIMPIA | `0x57c0` | **`g_equip_qty`** (ledger, 48 B) | **A** |
| 7 | `CAST2.OVL:0x0a0c` | LIMPIA | `0xb5de` | zona de ceros, sin entrada de ledger | **B** búfer sin catalogar |
| 8 | `SHOPPES.OVL:0x061c` | LIMPIA | `0xb6e2` | zona de ceros, sin entrada de ledger | **B** |
| 9 | `SHOPPES.OVL:0x0374` | LIMPIA | `0x21e6` | relleno de la **tabla con STRIDE** de §3.1-C | **C** tabla |
| 10 | `SHOPPES.OVL:0x0404` | AMBIGUA | `0x2215` | relleno de **la misma tabla**, fila siguiente | **C** |
| 11 | `COMBAT.OVL:0x052e` | LEJANA | `0x04b0`, `0x07d0` | **números**: 1200 y 2000 | **D** inmediato numérico |
| 12 | `SHOPPES.OVL:0x0aaa` | LEJANA | `0x7ba4` | cadena REAL `'\n"'` | **E** cadena sin letras |
| 13 | `MAINOUT.OVL:0x1c56` | LIMPIA | `0x6b9c` | cadena REAL `'\n\n'` | **E** |

**A = 6 · B = 2 · C = 2 · D = 1 · E = 2 = 13** ✓

⚠ **Corrección de mi propia primera pasada, declarada.** Clasifiqué `0x2215` como «zona de ceros»
(familia B) por mirar sólo los 16 bytes del destino. Al volcar la región entera se ve que **no es
relleno suelto sino la misma tabla que `0x21e6`**, y pasa a C. La lección es la de siempre en esta
cola: **un volcado de 16 bytes no distingue «zona muerta» de «hueco DENTRO de una estructura»**;
hay que abrir la ventana hasta ver el patrón. Familia `desplazamiento-no-es-direccion-de-objeto`.

### 3.1 Las tres familias, derivadas (no inferidas del nombre)

★ **A — el inmediato es la DIRECCIÓN DE UNA GLOBAL, pasada por referencia.** No es una conjetura de
`globals.json`: se lee en el ASM del hermano. Dos casos, leídos enteros:

| call-site | instrucción | qué es |
|---|---|---|
| `SHOPPES.OVL:0x0394`, | `mov ax, 0x57ac` / `push ax` | `&g_keys` — **argumento 1** |
| `SHOPPES.OVL:0x0398`, | `mov ax, 3` / `push ax` | cuánto sumar |
| `SHOPPES.OVL:0x039c`, | `mov ax, 0x63` / `push ax` | tope **99** |
| `SHOPPES.OVL:0x03a0`, | `call 0xffff9c60` | `add_byte_capped(&dst, n, cap)` |
| `SHOPPES.OVL:0x0e0c`, | `mov ax, 0x57c0` / `push ax` | `&g_equip_qty` — **argumento 2** |
| `SHOPPES.OVL:0x0e10`, | `mov ax, 0xff` / `push ax` | centinela 0xFF |
| `SHOPPES.OVL:0x0e14`, | `call 0xffffdd02` | barrido del array de cantidades |

⇒ En la familia A **el decodificador acierta al negarse**: no hay cadena que buscar porque el
inmediato nunca fue un puntero de texto. Y esas direcciones **están en el catálogo del ledger**, o
sea que el aviso podía haberse dado sin leer una sola línea de ASM. Es material directo para **#191**
(«corroborar la banda contra el CATÁLOGO de globales… como AVISO, nunca como filtro»): aquí el
catálogo habría etiquetado **6 de los 13** en frío.

★ **D — el inmediato es un NÚMERO.** El caso más limpio de que el bucket mezcla cosas:

| call-site | instrucción | qué es |
|---|---|---|
| `COMBAT.OVL:0x04e6`, | `mov ax, 0x4b0` / `push ax` | **1200** |
| `COMBAT.OVL:0x04ea`, | `mov ax, 0x7d0` / `push ax` | **2000** |
| `COMBAT.OVL:0x04ee`, | `mov ax, 1` / `push ax` | 1 |
| `COMBAT.OVL:0x04f2`, | `mov ax, 0x28` / `push ax` | 40 |
| `COMBAT.OVL:0x04f6`, | `call 0xffffa11e` | 4 args numéricos (perfil de tono) |

El regex `LOADS = ^mov ax, 0x([0-9a-f]{3,4})$` no puede distinguir 2000 de un offset de DS, y no
tiene por qué: **es `text_at_lax` quien filtra**, y filtra bien. Lo que no está bien es **contarlo
como «sin texto»** junto a los de la familia E.

★ **C — el destino cae DENTRO de una tabla con stride, en su relleno.** Volcado de la región:

| offset | bytes | qué es |
|---|---|---|
| `0x21f0` | `00×10` · `91 0c a1 0c b5 0c c7 0c dc 0c ee 0c 03 0d 12 0d 24 0d` | fila: 10 B de relleno + 9 punteros LE |
| `0x2210` | `00×10` · `33 0d 41 0d 51 0d` | fila siguiente, **stride 0x20** |
| `0x2230` | `00×10` · `65 0d 78 0d 88 0d` | fila siguiente, mismo stride |

Los dos inmediatos (`0x21e6`→`0x21f6` y `0x2215`→`0x2225`) caen en los **10 bytes de relleno** de
dos filas consecutivas. Es decir: **el inmediato es la BASE de una fila de la tabla**, y el `+0x10`
del decodificador (que convierte offset-DS en offset-de-fichero) lo deja apuntando al relleno.
Lo que el hermano hace con esa base es indexar, no imprimir.

★ **E — los ÚNICOS que son «límite del decodificador»** en el sentido del precedente. Las dos
cadenas existen y el impresor las emite; caen por la regla explícita de `text_at_lax` de exigir
**al menos una letra** (`if not any(65 <= (b & 0xDF) <= 90 …): return None`):

| par | bytes en `DATA.OVL` | contexto inmediato |
|---|---|---|
| `SHOPPES.OVL:0x0aaa` | `0a 22 00` = `'\n"'` | justo tras `…ys $.\n\n\0` ⇒ **el cierre de comillas de un grito** |
| `MAINOUT.OVL:0x1c56` | `0a 0a 00` = `'\n\n'` | justo antes de `'Trolls evade'` ⇒ **separador de líneas** |

⚠ **No se toca el umbral.** La regla de «al menos una letra» está ahí a propósito (su docblock la
justifica) y bajarla convertiría el bucket EMITIDA/NO-EMITIDA en ruido: `'\n\n'` casa con cualquier
cosa. Se declara el límite, **no se cambia el instrumento** — (d) de método, sin tarjeta de arreglo.

### 3.2 Lo que este censo SÍ y NO dice del residuo

`sueltos-b-206-cotejo-86.md` §3.1 declaró el crecimiento **7 → 13** como *«la banda fuera del
alcance del criterio es mayor que la que aquellas actas declararon»*, y lo mandó a #207. Medido:

- **Fuera de alcance de verdad hay 2** (familia E), no 13. Las familias A/C/D (8 pares) están
  **dentro** del alcance del criterio: el criterio los mira y **acierta al no encontrar texto**,
  porque no hay texto. La familia B (3) es indeterminada sin más lectura y se declara así.
- ⚠ **Y no se puede afirmar que el residuo «casi se dobló» sea deterioro.** No hay lista de los 7
  de la tanda 1 contra la que cotejar los 13 de hoy — el mismo defecto que esta tarjeta existe para
  arreglar. Lo que sí queda hecho es que **a partir de hoy la lista existe** (tabla de §3).
- ★ **Ninguno de los 13 cae entre los 37 no leídos**: los 7 SIN-TEXTO que están en F+L
  (`ULTIMA.EXE:0x4786`, `CAST2.OVL:0x0a0c`, `SHOPPES.OVL:0x0374`, `:0x03c2`, `:0x061c`, `:0x0e1d`,
  `MAINOUT.OVL:0x1c56`) son **los 7 dentro de los 16 nombrados**. No es casualidad: son justo los
  que el criterio automático **no pudo cerrar solo**, y por eso alguien los miró.
  ⇒ **Los 37 de las sub-tandas son 37/37 EMITIDA.**

## 4. Lo que este hito NO hace

- **No lee** ninguno de los 37 — eso son las sub-tandas siguientes de este mismo carril.
- **No re-adjudica** ninguno de los 16 nombrados, ni los 13 SIN-TEXTO.
- **No toca el instrumento.** El umbral de «al menos una letra» de §3.1-E se declara y se deja.
- **No toca `game/src`.**
- **No corrige** la cifra de #174 ni la de #206: las dos se reproducen (16 y 53). Lo que se corrige
  es el **juego de actas** con el que se derivó el 16 (§2.1), que aquella acta no llegó a enumerar.
- **No aplica** el token `kernel` de #199 — pero **sí lo declara, porque lo hay** (§4.1). Mi primera
  redacción de esta línea decía «ninguna de las 53 citas lo contiene»; era **falsa**, y la cazó el
  `grep -ci` que corrí para respaldarla. Se deja escrito el error: **una negativa que no se ha
  medido no vale aunque suene razonable**, y aquí la negativa habría pasado inadvertida porque el
  token vive en dos citas de las 53 y ninguna es llamativa.

### 4.1 ★ Los DOS `kernel` de esta celda — DECLARADOS, no aplicados (#199)

`grep -ci kernel` sobre el volcado completo de la celda: **2 ocurrencias, las dos en LIMPIA**, las
dos en pares que están **entre los 37 no leídos**:

| par | cita (fragmento literal, con el offset propio elidido a `…`) | offset que el token selecciona |
|---|---|---|
| `MAINOUT.OVL:0x1c0b` | *«world_turn KERNEL 0x5910 (tick de viento/anim, NO el 0x1A60). […]»* | `0x5910` |
| `SHOPPES3.OVL:0x01ca` | *«…, `beep_ticks(1)` (kernel 0x3ae6 — presentación: gated por…»* | `0x3ae6` |

⚠ En la segunda fila el offset propio del par va **elidido** a propósito: reproducirlo pegado al
nombre en minúsculas —tal como está en el port— **siembra un nombre de rutina** y el `seed_gate` lo
rechaza. Lo cazó el gate en la primera corrida de este hito; el texto del port no se ha tocado.

**Predicado de #199 evaluado, sin tocar nada**: en los dos casos el overlay del par ≠ `ULTIMA.EXE`,
que es la primera mitad del predicado. **Pero la consecuencia práctica es NULA en esta celda**, y
está medido: barrida la banda entera (`--cola`, 345 pares), **no existe ningún par con offset
`0x5910` ni `0x3ae6`** — ni bajo el overlay del par ni bajo ningún otro. ⇒ el token no ha fabricado
aquí ninguna atribución falsa; selecciona un offset que el extractor nunca llegó a promover a par.

⇒ **Los dos van a #199 como material, con las señas exactas**, y esta celda **no se re-adjudica por
ellos**. Es la regla del encargo aplicada al pie: declarar, jamás aplicar.

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

Al final por el ctx pegajoso de #84. Overlays nombrados: `CAST2.OVL`, `CMDS.OVL`, `COMBAT.OVL`,
`COMSUBS.OVL`, `DUNGEON.OVL`, `LOOKOBJ.OVL`, `MAINOUT.OVL`, `OUTSUBS.OVL`, `SHOPPES.OVL`,
`SHOPPES2.OVL`, `SHOPPES3.OVL`, `SJOG.OVL`, `TALK.OVL`, `TOWN.OVL`, `ULTIMA.EXE`.
