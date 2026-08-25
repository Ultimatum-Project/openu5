# ACTA #174 (banda PEGAJOSA) — TANDA 9, SUB-TANDA 2: `transport.ts` + `game.ts`, 9 pares

> Rama `re/sueltos-174`, worktree `.claude/worktrees/sueltos-174`, base **main `fb6c8eef`**.
> Toda cifra medida en ese árbol. RETENIDA: aterriza el lead.
> Continúa `sueltos-174-acta.md` §6 (el corte en frontera de grupo de la sub-tanda 1).

---

## 0. VEREDICTO

**9 pares · 8 (a) exacta · 1 (b) · 0 (c) · 0 (d)** — con **7 lecturas**.

★ **El primer (b) de la celda `DIVERGE` en nueve tandas.** Las 24 adjudicaciones anteriores
fueron todas (a); ésta no lo es, y no por un offset mal puesto sino por una **enumeración que no
agota** y un rótulo que **su propia nota ya había corregido** (§3.2).

| par | fichero del port | veredicto |
|---|---|---|
| `MAINOUT.OVL:0x010a` | `transport.ts:131` | **(a)** — la tabla de verbos, clase a clase |
| `MAINOUT.OVL:0x0130` | `transport.ts:132` | **(a)** — ídem (regalo: mismo docblock) |
| `MAINOUT.OVL:0x02c0` | `transport.ts:338` | **(a)** — el fork de régimen y las 3 salidas de NAVEGANDO |
| `MAINOUT.OVL:0x0312` | `transport.ts:344` | **★ (b)** — rótulo RANCIO + un «otro» que deja fuera una salida SILENCIOSA |
| `CMDS.OVL:0x0c2c` | `game.ts:4252` | **(a)** — «hasta 4 celdas» DERIVADO de un contador de 5 |
| `MAINOUT.OVL:0x0986` | `game.ts:5493` | **(a)** — el caso 0x11 y su cadena, literales |
| `SJOG.OVL:0x119e` | `game.ts:988` | **(a)** — las CINCO aristas de «siguiente slot» |
| `TOWN.OVL:0x0c38` | `game.ts:3245` | **(a)** — el contraste cobra/no-cobra, probado por el salto |
| `ULTIMA.EXE:0x344a` | `game.ts:2353` | **(a)** — la cadena de 3 saltos del bug-for-bug, entera |

## 1. RE-ANCLA: medida DOS veces, y la segunda es la que vale

Al abrir la sub-tanda, main había avanzado y **había tocado `game/src`** (el fix de #200 sobre
`skin/fiel/ready.ts`), que es el disparador de re-ancla. Se rebasó y se volvió a medir:

```
git rebase main          → «skipped previously applied commit e2215c38» (el lead ya aterrizó la sub-tanda 1)
HEAD = main = fb6c8eef
git diff 48832bec..HEAD -- game/src            → 1 fichero, 13 ins. (skin/fiel/ready.ts, #200)
cita_pegajosa_atribucion.py → 345 pares @ fb6c8eef, 3 controles verdes
cita_pegajosa_forma.py      → DIVERGE × (FORZADA 9 + LIMPIA 55) = 64, 3 controles verdes
diff  {los 64 de la sub-tanda 1}  {los 64 de ahora}  → VACÍO
```

★ **Un aterrizaje que TOCÓ `game/src` y NO movió la banda: cero altas, cero bajas, cero movidos**,
comprobado **por MIEMBROS** y no por conteo. Es el caso que faltaba en el expediente de la errata:
allí el disparador se activó y la población creció 7; aquí se activa y la población no se mueve.
⇒ **el disparador es NECESARIO pero no suficiente**, y la única forma de saberlo es re-medir. Un
conteo igual (345 vs 345) tampoco habría bastado — la familia `prediccion-numerica-cuadra-por-
casualidad` lleva tres apariciones en esta cola de conteos que cuadran con miembros distintos.

## 2. Ritmo: 9 pares por 7 lecturas, con el regalo de la sub-tanda 1 confirmado

| grupo | líneas del port | rutina del port | rutina del binario |
|---|---|---|---|
| `MAINOUT.OVL:0x010a` + `0x0130` | 131 · 132 | `faceVerb` | `MAINOUT.OVL:0x00da` |
| `MAINOUT.OVL:0x02c0` + `0x0312` | 338 · 344 | `shipTryMove` | `MAINOUT.OVL:0x01fe` |

Dos grupos más de hermanos-por-DOCBLOCK invisibles al censo por línea. Ritmo **0,78** (peor que el
0,63 de la sub-tanda 1, mejor que el 1,0 estimado).

★★ **Y el fenómeno CRUZA CARRILES.** `SJOG.OVL:0x119e`, que apunta a `game.ts:988`, una línea por
debajo de `game.ts:987`, que es donde viven `SJOG.OVL:0x1192` y `0x11bc` — **adjudicados por el
carril anterior en su sub-tanda 2**. Es el mismo docblock y el mismo tramo: aquel acta llegó a
NOMBRAR el `0x119e` en su tabla de destinos («cualquier otro id ⇒ siguiente slot») y aun así el par siguió en la
cola, porque el censo agrupaba por LÍNEA y éste caía en la de al lado. ⇒ el censo por línea no sólo
parte docblocks dentro de una sub-tanda: **los parte entre carriles y entre tandas.**

## 3. Las siete lecturas

### 3.1 `MAINOUT.OVL:0x00da` — la tabla de verbos, y el destino de cada clase

| call-site | instrucción | destino | clase |
|---|---|---|---|
| `MAINOUT.OVL:0x00ea`, | `and ax, 0xfc` | — | normaliza a CLASE |
| `MAINOUT.OVL:0x00ed`, | `cmp ax, 0x10` / `je 0x10a` | `0x010a` | caballo |
| `MAINOUT.OVL:0x00f2`, | `cmp ax, 0x14` / `je 0x130` | `0x0130` | alfombra |
| `MAINOUT.OVL:0x00f7`, | `cmp ax, 0x20` / `je 0x16a` | `0x016a` | fragata (izadas) |
| `MAINOUT.OVL:0x00fc`, | `cmp ax, 0x24` / `je 0x16a` | `0x016a` | fragata (arriadas) |
| `MAINOUT.OVL:0x0101`, | `cmp ax, 0x28` / `je 0x152` | `0x0152` | esquife |
| `MAINOUT.OVL:0x0106`, | `jmp 0x129` | `0x0129` | resto (a pie) |
| `MAINOUT.OVL:0x010a`, | `mov ax, 0x2946` / `push` / `call` | — | `"Ride "` ✓ |
| `MAINOUT.OVL:0x0130`, | `mov ax, 0x294c` / `push` / `call` | — | `"Fly "` ✓ |
| `MAINOUT.OVL:0x0152`, | `mov ax, 0x2951` / `push` / `call` | — | `"Row "` ✓ |
| `MAINOUT.OVL:0x0186`, | `mov ax, 0x2956` / `push` / `call` | — | `"Head "` ✓ |

**Las cinco filas de la tabla de la cita, exactas**, incluidos los cuatro DS y el par `0x20`/`0x24`
compartiendo destino. Y el *«resto (0x1C a pie) — no imprime»* se prueba así: el `0x0129` es
`mov ax, [bp-2]` con `[bp-2]` sembrado a 0 en `0x00e0`, y ENTRE `0x0106` y `0x0129` no hay nada.

★ **La ASIMETRÍA DE LA FRAGATA, literal**: `0x0181 cmp word ptr [bp - 4], ax` / `0x0184 je 0x1dc`
salta la impresión de `0x0186`, porque el facing nuevo (calculado en `0x0172-0x017e`, o sea
`(tile&0xfc)+[bp+4]`) coincide con el viejo. La cita lo dice con ese offset y ese destino ✓.

★ **PERO la frase «devuelve 1, que aborta el paso» es la mitad de la historia — y la otra mitad
YA está derivada 130 líneas más abajo, en el MISMO fichero.** Hay **dos** escrituras del 1:

| call-site | instrucción | condición |
|---|---|---|
| `MAINOUT.OVL:0x01ad`, | `mov ax, 1` / `mov word ptr [bp - 2], ax` | el facing CAMBIÓ (viró) |
| `MAINOUT.OVL:0x01dc`, | `cmp byte ptr [g_transport_tile], 0x24` / `jb 0x1e6` | facing IGUAL ⇒ sólo velas izadas |
| `MAINOUT.OVL:0x01e6`, | `cmp byte ptr [g_wind], 0` / `je 0x1f0` | ⇒ y sólo en calma |
| `MAINOUT.OVL:0x01f0`, | `mov word ptr [bp - 2], 1` | BECALMADA: no avanza, sin imprimir nada |

Y el docblock de `shipFacingStep` (`transport.ts:267` y `:272`) **ya lo tiene escrito**, incluido el
aviso literal *«Hay DOS escrituras de 1, no una»*, y nombra las dos con sus offsets.
⇒ **No es hueco: es una derivación repartida entre dos docblocks del mismo fichero.** Segunda
instancia en dos sub-tandas de `caso-canonico-ya-compensado`, y la primera en que la compensación
no está en la cabecera de la propia función sino en la de una hermana. Los dos pares, **(a)**.

### 3.2 ★ `MAINOUT.OVL:0x01fe` — NAVEGANDO exacta, REMANDO **(b)**

**La rama de NAVEGANDO, `MAINOUT.OVL:0x02c0`, es (a) exacta en sus tres salidas:**

| call-site | instrucción | destino | salida |
|---|---|---|---|
| `MAINOUT.OVL:0x02c0`, | `cmp byte ptr [g_sail_dir], 0` / `je 0x312` | `0x0312` | el FORK de régimen, primero ✓ |
| `MAINOUT.OVL:0x02c7`, | `cmp word ptr [bp - 6], 3` / `jne 0x2d2` | — | tile 3 ⇒ `0x298b` «BREAKING UP!» ✓ |
| `MAINOUT.OVL:0x02d8`, | `mov ax, 0x2999` | — | otro sólido ⇒ «COLLISION!» ✓ |
| `MAINOUT.OVL:0x02df`, | `cmp word ptr [bp - 6], 0x47` / `jne 0x2f4` | `0x02e5` | 0x47 ⇒ `0x29a5` «Docked!» ✓ |
| `MAINOUT.OVL:0x02ec`, | `add byte ptr [g_transport_tile], 4` | — | el auto-FURL ✓ |
| `MAINOUT.OVL:0x0303`, | `call 0x109e` | — | `damage_ship`, compartido por breakup y collision ✓ |
| `MAINOUT.OVL:0x0306`, | `mov byte ptr [g_sail_dir], 0` | — | en la cola COMPARTIDA ✓ |
| `MAINOUT.OVL:0x030b`, | `mov byte ptr [0x5956], 1` | — | cierre exacto de `0x02C0-0x030B` ✓ |

**La rama de REMANDO, `MAINOUT.OVL:0x0312`, NO lo es, y por dos motivos distintos:**

| call-site | instrucción | destino | qué pasa |
|---|---|---|---|
| `MAINOUT.OVL:0x0312`, | `cmp byte ptr [g_transport_tile], 0x20` / `jb 0x322` | `0x0322` | **< 0x20 = A PIE** ⇒ «Blocked!» |
| `MAINOUT.OVL:0x0319`, | `mov al, byte ptr [bp - 4]` / `and al, 0xfc` | — | ≥ 0x20 = vehículo: mira OTRA entrada |
| `MAINOUT.OVL:0x031e`, | `cmp al, 0xec` / `je 0x34a` | `0x034a` | **★ SALIDA SILENCIOSA — sin mensaje** |
| `MAINOUT.OVL:0x0322`, | `mov ax, 0x29ae` / `push` / `call` | — | «Blocked!» ✓ |
| `MAINOUT.OVL:0x0329`, | `cmp word ptr [bp - 6], 0x2f` / `jne 0x33c` | `0x033c` | cactus vs beep ✓ |
| `MAINOUT.OVL:0x0336`, | `call 0xffffa8d8` | — | el daño del cactus ✓ |
| `MAINOUT.OVL:0x0347`, | `call 0xffff9946` | — | cierre exacto de `0x0312-0x0347` ✓ |

**DEFECTO 1 — el rótulo «REMANDO» está RANCIO, y lo dice su propia nota.** `re/notes/transport.md`
lleva una CORRECCIÓN §7E/§2 (de #169) que declara literalmente que el `jb` de `0x0312` es el
discriminador **a-pie/vehículo**, no navegando/remando, y que la COLA `0x0312-0x0347` **la comparten
pie y barco**. El docblock del port sigue rotulando ese bloque como «REMANDO (0x0312-0x0347)»,
que es la etiqueta cuyo estrechamiento **escondió la mecánica del cactus durante meses** (#157).
Género #194: cabecera contradicha por la nota que ella misma cita.

**DEFECTO 2 — el «otro (sólido) → Blocked!» NO agota el complemento.** Hay una TERCERA salida:
para un vehículo (`g_transport_tile ≥ 0x20`), si la segunda entrada de la rutina cumple
`& 0xfc == 0xec`, se salta a `0x034a` **sin imprimir absolutamente nada**. La palabra «otro» hace
una afirmación universal sobre el complemento y el complemento tiene tres partes, no dos.

⇒ **(b): la derivación existe y es correcta en lo que enumera; lo que falla es el alcance.** El
arreglo es de PROSA (re-rotular el bloque y nombrar la tercera rama), no de código.

⚠ **Y lo que NO se afirma, con su motivo**: `[bp-4]` es el resultado de
`MAINOUT.OVL:0x0236 call 0xffffb4be` con `(g_party_x+dx, g_party_y+dy, g_floor)`, distinto del
`[bp-6]` que la cita llama `destTile` (ése sale de `0x0292`, del búfer de stride 0x20). **No se ha
derivado** qué devuelve `0xffffb4be` ni qué es `0xec` en ese dominio, así que **no se adjudica
defecto de MECÁNICA**, sólo de cita. Dato estructural que sí se puede afirmar: la firma del port
—`shipTryMove(destTile, transportTile, sailing, hull, rand)`— **no recibe esa segunda entrada**, así
que la rama silenciosa es hoy inexpresable dentro de esa función. Cabo con señas, sin dueño.

### 3.3 `CMDS.OVL:0x0c2c` — «hasta 4 celdas» es un número DERIVADO, no copiado

| call-site | instrucción | destino | papel |
|---|---|---|---|
| `CMDS.OVL:0x0c15`, | `mov word ptr [bp - 0x16], 5` | — | siembra el contador a 5 |
| `CMDS.OVL:0x0c23`, | `cmp word ptr [bp - 0x18], 0` / `je 0xc2c` | `0x0c2c` | sigue sólo si aún no impactó |
| `CMDS.OVL:0x0c2c`, | `dec word ptr [bp - 0x16]` | — | PRE-decremento |
| `CMDS.OVL:0x0c2f`, | `cmp word ptr [bp - 0x16], 0` / `jg 0xc38` | `0x0c38` | test `> 0`, literal |

Siembra 5, decrementa ANTES de comparar, y sigue mientras `> 0` ⇒ pasa con 4, 3, 2, 1 y para en 0:
**cuatro celdas**. La cita da los dos offsets, la siembra, el pre-decremento y el `>0`, y el «4»
sale de ahí — **no es una constante repetida, es una cuenta**. Y el fork de `0x0c23` (`0x0c29 jmp
0xcee`, salir) modela la otra mitad: la bola se para en la primera celda con ocupante. **(a)**.

### 3.4 `TOWN.OVL:0x0c38` — el contraste cobra/no-cobra, probado por los SALTOS

| call-site | instrucción | destino | qué pasa |
|---|---|---|---|
| `TOWN.OVL:0x0c14`, | `cmp ax, 0xcb` / `jne 0xc38` | `0x0c38` | target inválido |
| `TOWN.OVL:0x0c38`, | `mov ax, 0x2735` / `jmp 0xba0` | `0x0ba0` | carga «Klimb-What?» |
| `TOWN.OVL:0x0ba0`, | `push ax` / `call 0xffff9680` / `jmp 0xc43` | `0x0c43` | imprime; NO pasa por 0x0c3e |
| `TOWN.OVL:0x0c2f`, | `jmp 0xc3e` | `0x0c3e` | la vía que SÍ pasa por ahí |
| `TOWN.OVL:0x0c3e`, | `mov word ptr [bp - 2], 1` | — | marca «cobra turno» |
| `TOWN.OVL:0x0c43`, | `mov ax, word ptr [bp - 2]` | — | la REUNIÓN de las dos vías |

★ **El contraste que la cita afirma se demuestra por la topología, no por confianza**: las dos vías
se reúnen en `0x0c43`, y la ÚNICA diferencia entre ellas es si se ejecutó `0x0c3e`. La rama de
«Klimb-What?» **no puede** salir con 1 salvo que el prólogo lo sembrara. **(a) exacta.**

⚠ No verificado: que el prólogo siembre `[bp-2]` a 0 (una instrucción, fuera del tramo citado). La
afirmación sostenida aquí es la RELATIVA —una vía marca y la otra no—, que es la que la cita hace.

### 3.5 `MAINOUT.OVL:0x0986` — el caso 0x11, literal

| call-site | instrucción | destino | qué es |
|---|---|---|---|
| `MAINOUT.OVL:0x0919`, | `cmp ax, 0x11` / `je 0x986` | `0x0986` | el caso citado ✓ |
| `MAINOUT.OVL:0x0986`, | `mov ax, 0x2a89` / `push` / `call 0xffff9680` | — | DS `0x2a89` ✓ |
| `MAINOUT.OVL:0x098d`, | `jmp 0x968` | `0x0968` | cola compartida |

La cita escribe «0x91c→0x986» y `0x091c` es exactamente el `je` ✓. **(a) exacta** en lo citado.

⚠ No verificado, y se declara: el ORDEN de composición «DS 0x2a6f + 0x2a89» (aquí sólo se ve
imprimirse el `0x2a89`; el `0x2a6f` tendría que salir antes del despacho) y el *«DIRECTO a la
ceremonia (call 0xfffff89a, sin getkey)»*, que vive en `0x0968`, fuera del tramo del par.

### 3.6 `SJOG.OVL:0x119e` — las CINCO aristas que caen al siguiente slot

| call-site | instrucción | destino | por qué no casa |
|---|---|---|---|
| `SJOG.OVL:0x1157`, | `cmp ax, word ptr [bp + 8]` / `jne 0x119e` | `0x119e` | X distinta |
| `SJOG.OVL:0x1161`, | `cmp ax, word ptr [bp + 6]` / `jne 0x119e` | `0x119e` | Y distinta |
| `SJOG.OVL:0x116d`, | `cmp byte ptr [g_location], 0x80` / `jae 0x119e` | `0x119e` | fuera de la banda |
| `SJOG.OVL:0x117c`, | `cmp ax, word ptr [bp + 4]` / `jne 0x119e` | `0x119e` | planta distinta |
| `SJOG.OVL:0x1195`, | (id ≠ 0x0e) `jne 0x119e` | `0x119e` | ni cofre ni caja |
| `SJOG.OVL:0x119e`, | `add di, 8` | — | **siguiente slot** ✓ |

Y el resto de la cita, verificado de camino — el `0x112c` es cabeza de rutina (`push bp`/`mov bp, sp`/
`sub sp, 0x14`) ✓ · `0x113e mov di, 0x5c64` ✓ · `0x11b3 cmp si, 0x5d5a` ✓ · el paso es `add 8` en
**cinco** punteros paralelos (`0x119e`, `0x11a1`, `0x11a5`, `0x11a9`, `0x11ad`) ✓ · y el recorrido
es ASCENDENTE (`add`, no `sub`) ✓. El corchete del `[/floor]` también: la comparación de planta de
`0x1174-0x117c` está encerrada ENTRE `0x116b ja 0x117e` y `0x1172 jae 0x119e`, las dos sobre
`g_location`. **(a) exacta**, por lectura propia y coincidente con la del carril anterior.

### 3.7 `ULTIMA.EXE:0x344a` — la cadena del bug-for-bug, los tres saltos

| call-site | instrucción | destino | qué es |
|---|---|---|---|
| `ULTIMA.EXE:0x341a`, | `mov ax, 0xa258` / `push` / `call 0x1850` | — | «View a gem!» ANTES del gate ✓ |
| `ULTIMA.EXE:0x3421`, | `cmp byte ptr [g_gems], 0` / `je 0x344a` | `0x344a` | el fork citado ✓ |
| `ULTIMA.EXE:0x3428`, | `dec byte ptr [g_gems]` | — | consume ANTES de pintar ✓ |
| `ULTIMA.EXE:0x342c`, | `cmp byte ptr [g_location], 0x21` / `jae 0x3444` | `0x3444` | mazmorra vs resto ✓ |
| `ULTIMA.EXE:0x344a`, | `mov ax, 0xa266` | — | «You have none!» ✓ |
| `ULTIMA.EXE:0x344d`, | `jmp 0x33ea` | `0x33ea` | cierre exacto de `0x341A-0x344D` ✓ |
| `ULTIMA.EXE:0x33ea`, | `push ax` / `call 0x1850` / `jmp 0x31ee` | `0x31ee` | imprime y va al retorno por DEFECTO |

★ **El «bug-for-bug» se verifica ENTERO, salto a salto**: la CADENA `0x344a → 0x33ea → 0x31ee` que
la cita escribe existe literalmente, y `0x33ea` no toca `[bp-2]`, así que la rama sin gemas sale
por el mismo retorno que las demás ⇒ **cobra turno igual**. Y la rama sin gemas **no alcanza** ni
`0x3433` ni `0x3444` ⇒ «NO abre vista» ✓. **(a) exacta.**

## 4. Estado de la cola

| | pares |
|---|---|
| población @ `fb6c8eef` | 345 |
| `DIVERGE` F+L | 64 |
| ya (d) por #188/#190 | 4 |
| adjudicados por los carriles anteriores | 14 |
| adjudicados en la sub-tanda 1 | 8 |
| adjudicados aquí | **9** |
| **VIVOS** | **29** |

Balance del carril: **17 pares por 12 lecturas** (0,71), 16 (a) · 1 (b) · 1 (c) · 0 (d).

⚠ **CORTE EN FRONTERA DE GRUPO**: `transport.ts` y `game.ts` cerrados enteros, el siguiente sin
abrir, ningún par partido.

**Orden recomendado para la sub-tanda 3**: `core/world/loops/turn.ts` (3) + los cinco grupos de 2
(`skin/fiel/skin.ts`, `main.ts`, `camp.ts`, `dungeon/dungeon.ts`, `dialogue/conversation.ts`) = 13
pares; con el ritmo medido caben 8-9 en una sub-tanda, así que `turn.ts` + tres grupos de 2.

## 5. Lo que esta sub-tanda NO ha hecho

- **No ha tocado `game/src` ni `re/tools`.** El (b) de §3.2 pide un arreglo de PROSA (el rótulo y
  la tercera rama) que **no se hace aquí**: toca un docblock de `game/src` y este encargo adjudica.
- **No ha derivado** qué devuelve `MAINOUT.OVL:0x0236 call 0xffffb4be` ni qué es `0xec` en ese
  dominio ⇒ el defecto de §3.2 es de CITA, no de mecánica, y así se declara.
- **No ha verificado la CONDICIÓN** (#144) de los 9 más allá de lo dicho en cada apartado.
- **No ha leído** los 29 pares restantes.
- Las dos «no verificado» de §3.4 y §3.5 quedan abiertas con sus señas.
- Ninguna de las 9 citas lleva el token `kernel`.

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

Al final por el ctx pegajoso de #84. Overlays nombrados: `CMDS.OVL`, `MAINOUT.OVL`, `SJOG.OVL`,
`TOWN.OVL`, `ULTIMA.EXE`.
