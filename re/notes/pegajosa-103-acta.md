# ACTA #174 (banda PEGAJOSA) — TANDA 3: la re-ancla que NO reproduce, y la celda cabecera leída

> Rama `re/pegajosa-103`, worktree `.claude/worktrees/pegajosa-103`, base **main `7355c909`**.
> Toda cifra medida en ese árbol. RETENIDA: aterriza el lead.
> Continúa `pegajosa-174-acta.md` §7 (el corte declarado de aquel carril).

---

## 0. RE-ANCLA: la partición NO reproduce, y el delta está adjudicado entero

La regla 1 del encargo es re-anclar antes de tocar nada. Sale **329**, no 325:

```
BANDA PEGAJOSA #174 — ATRIBUCIÓN × FORMA @ 7355c909 — 329 pares
  forma               FORZADA   LIMPIA   LEJANA  AMBIGUA   TOTAL
  clase2                    3       49       19       36     107
  PREFIJO-efecto            5       13       12       11      41
  PREFIJO-bifurca           1        3        3        5      12
  BACKEDGE                  3        9        5       15      32
  DIVERGE                   8       54       25       46     133
  PREFIJO-inerte            0        1        0        3       4
  TOTAL                    20      129       64      116     329
```

Los 3 controles del módulo, verdes; el positivo `SJOG.OVL:0x158e`, en la celda de siempre.

**El delta se adjudica por CONTENIDO, no por diferencia de conteo.** Se re-mide la población
en un worktree de sólo lectura anclado en `e8c05db8` (el árbol donde el carril anterior la
fijó; allí reproduce **325** exacto) y se diffean los dos volcados `--json` par a par:

| | pares |
|---|---|
| ALTAS | 6 |
| BAJAS | 2 |
| neto | **+4** ⇒ 325 → 329 ✓ |

```
+ TALK.OVL:0x064e  AMBIGUA  clase2           game/src/core/dialogue/effects.ts:45
+ TALK.OVL:0x1166  LIMPIA   DIVERGE          game/src/core/dialogue/conversation.ts:539
+ TALK.OVL:0x117d  LIMPIA   clase2           game/src/core/dialogue/conversation.ts:543
+ TOWN.OVL:0x15e9  AMBIGUA  PREFIJO-bifurca  game/src/core/game.ts:1905
+ TOWN.OVL:0x160d  AMBIGUA  PREFIJO-efecto   game/src/core/game.ts:1908
+ TOWN.OVL:0x1686  AMBIGUA  PREFIJO-efecto   game/src/core/game.ts:1903
- TOWN.OVL:0x10ac  AMBIGUA  DIVERGE          game/src/core/world/loops/turn.ts:40
- TOWN.OVL:0x10ba  LIMPIA   clase2           game/src/core/world/loops/turn.ts:394
```

Las **seis** celdas que se mueven cuadran una a una con el delta (clase2 LIMPIA +1−1=0 ·
clase2 AMBIGUA +1 · DIVERGE LIMPIA +1 · DIVERGE AMBIGUA −1 · PREFIJO-efecto AMBIGUA +2 ·
PREFIJO-bifurca AMBIGUA +1). Productores: las altas de TALK las mete `33dd9b7b` (#180, las
tres ramas de apertura de conversación); la baja de `TOWN.OVL:0x10ba` la produce `85b30250`
(#179, la lava), que reescribió la línea de cita.

### 0.1 ★ El conteo de clase-2 LIMPIA CUADRA y la composición NO

`clase2 × LIMPIA` vale **49 en los dos árboles**. Es la trampa: no son los mismos 49.
`TOWN.OVL:0x10ba` (que era uno de **los 45 cerrados** de la tanda 1) SALIÓ, y
`TALK.OVL:0x117d` ENTRÓ. Quien hubiera leído sólo la tabla habría dado por cubierto un par
que nadie ha adjudicado nunca. Familia `prediccion-numerica-cuadra-por-casualidad`: la cifra
sola no es dato; hay que cotejar los MIEMBROS.

Los dos se clasifican con el criterio de #172 (`cita_hermana_emitida.classify`, importado, con
el positivo y el de capacidad verdes en ESTE árbol):

- `TOWN.OVL:0x10ba` → **EMITIDA** medido en `e8c05db8` ⇒ era, en efecto, uno de los 45; se va
  de la población, no se retracta.
- `TALK.OVL:0x117d` → **EMITIDA** medido en `7355c909` ⇒ **CERRADO aquí** por el mismo
  criterio: **(a) SIN CANDIDATO**, con la misma limitación declarada que los 45 (cerrado por
  PRESENCIA de la cadena, no por su CONDICIÓN — #144).

### 0.2 ★ La advertencia del acta anterior sobre las NOTAS es falsa, y su control no podía fallar

`pegajosa-174-acta` §0 dice que la población «incluye las citas de `game/src` **y de las
notas**, que crecen cuando cualquier carril aterriza prosa», y §7 presenta como dato que sus
dos commits de prosa en `re/notes/` no movieron la partición.

El corpus del extractor es **`SRC = ROOT / "game" / "src"`** y el barrido es
`SRC.rglob("*.ts")` (`re/tools/cita_rama_hermana.py:82` y `:218`). `re/notes/` **no es fuente
de la población**. Corroborado por el lado del dato: los **8** cambios del delta salen los 8
de `game/src`, ninguno de una nota.

⇒ Aquel control era **degenerado**: verificaba que una prosa que no puede mover la población
no la movía. Estaba garantizado a pasar (familia `control-positivo-degenerado`).
La regla operativa se ESTRECHA, no se retira: **re-anclar sigue siendo obligatorio, pero el
disparador es un aterrizaje que toque `game/src`, no «cualquier carril que aterrice prosa».**
Un acta de esta cola —esta incluida— no puede mover el denominador.

## 1. ★ El eje de MÁXIMA confianza es ciego al SEGMENTO: 4 pares no son citas a código

`FORZADA` se define como «un solo overlay del disasm tiene **instrucción** en ese offset ⇒ la
herencia no pudo equivocarse», y la partición lo declara «adjudicable sin revisar». La
premisa se cae si la cita **no era a código**.

**MECANISMO, derivado del propio extractor.** Las dos regex admiten el prefijo de segmento y
lo **tiran** — está fuera del grupo de captura:

```
CITE_RE  = ...  [^0-9\n]{0,24}?(?:CS:|DS:)?0x([0-9a-f]{3,5})\b     (:96-99)
BARE_OFF = re.compile(r"(?:CS:|DS:)?0x([0-9a-f]{3,5})\b", re.I)    (:183)
```

Aguas abajo, `DS:0x5164` y `CS:0x5164` son indistinguibles. `sweep4` sólo pregunta si el
offset es destino de salto condicional en el segmento de CÓDIGO — y un offset de DATO casi
siempre cae encima de ALGUNA instrucción, así que el par sale **plausible**. Segundo tramo
del mecanismo: **`DATA.OVL` no tiene `.asm` en el corpus** (28 ficheros, ninguno DATA.OVL) ⇒
`resolve_overlay("DATA.OVL")` falla, la cita no puede atribuirse a quien el autor nombró, y
la política pegajosa se la cose **al último overlay de CÓDIGO** que resolvió.

**MEDIDA, sobre la población fijada de 329** (se re-mira LA MISMA línea que el extractor usó,
el campo `texto` de cada fila, con el prefijo capturado; dos grafías, `DS:` y `DS ` — la
segunda es la del ejemplo canónico del propio docblock de `collect_cites`):

| grafía | pares |
|---|---|
| sin prefijo | 325 |
| `DS:` o `DS ` | **4** |

Los 4, y **los 4 caen en la mitad FORZADA+LIMPIA** (la que se adjudica sin resolver
atribución):

```
FORZADA  PREFIJO-efecto   ULTIMA.EXE:0x5164   game/src/core/creation/gypsy.ts:51
FORZADA  BACKEDGE         ULTIMA.EXE:0x5887   game/src/skin/fiel/moongate.ts:5
LIMPIA   DIVERGE          DUNGEON.OVL:0x13b2  game/src/skin/fiel/dungeon-decor.ts:10
LIMPIA   DIVERGE          SJOG.OVL:0x17f6     game/src/core/world/commands.ts:471
```

**Las cuatro citas son CORRECTAS tal y como sus autores las escribieron.** Lo fabricado es el
PAR `(overlay, offset)`, y lo fabrica el instrumento:

- `gypsy.ts:51` — `INT DS:0x5164 (fileoff 0x5174)`, bajo la cabecera «Tablas de **DATA.OVL**
  (mapeo DS→fileoff = DS + 0x10; verificado contra el binario)». Hay modelo de paridad que
  las relee de DATA.OVL (`re/tools/gypsy_parity.py`, con test).
- `moongate.ts:5` — `g_moongate_anim (DS 0x5887)`, global del segmento de datos. El mismo
  docblock cita código de verdad a renglón seguido (`0x475a`, `0x4775`, `0x4786-0x4798`,
  `0x56e6-0x5709`): el autor distingue perfectamente, el extractor no.
- `dungeon-decor.ts:10` — `color [0x13b2] = 1 (**DATA.OVL** DS:0x13b2, azul EGA)`.
- `commands.ts:471` — `tabla DS 0x17F6 (**DATA.OVL** 0x1806)`.

★ **Corroboración independiente de que son offsets de DATO**: dos ficheros sin relación
(`gypsy.ts` y `commands.ts`) registran la MISMA convención DS→fileoff `+0x10`, y las dos
cuentas cuadran (`0x5164+0x10 = 0x5174` ✓ · `0x17F6+0x10 = 0x1806` ✓).

★ **Y el caso peor enseña que FORZADA cortocircuita a sus propios avisos.** En
`ULTIMA.EXE:0x5164` los otros dos ejes estaban gritando: `tokens_ventana = 2` (habría sido
AMBIGUA) y `distancia = 17` (habría sido LEJANA). El partidor evalúa `candidatos == 1`
PRIMERO y devuelve FORZADA, tapando ambos. Familia `guarda-disyuncion-vs-prioridad`: la
cadena de prioridad decide, y aquí decide a favor del eje que no aplica.

**ADJUDICACIÓN de los 4: (d) NO APLICA** — la cita no es a destino de salto; no hay nada que
carear contra el binario de código y no hay defecto del port ni de la nota.

**NO se toca el instrumento.** Capturar el prefijo y descartar los `DS:` cambiaría la
POBLACIÓN de una herramienta aterrizada que otros carriles están usando en vuelo; eso lo
decide el lead, no este carril. Queda la forma exacta del arreglo y su impacto medido (−4
pares, todos en FORZADA+LIMPIA) en §4.

## 2. TANDA — la celda cabecera `FORZADA × PREFIJO-efecto` (5), leída par a par

Es la cabeza del orden de ataque de §4 del acta anterior: el perfil exacto de #133. Cada par
se lee del `cmp` citado a su punto de reunión, tramo completo.

| par | veredicto |
|---|---|
| `ULTIMA.EXE:0x5164` | **(d) NO APLICA** — es `DS:`, ver §1 |
| `ULTIMA.EXE:0x5a66` | **(a) CORRECTA** |
| `ULTIMA.EXE:0x66a6` | **(a) CORRECTA en sus límites** |
| `ULTIMA.EXE:0x6a0d` | **(a) CORRECTA**, exacta |
| `ULTIMA.EXE:0x6ccf` | **(a) CORRECTA**, exacta |

**Cero defectos del port en la celda.** La única anomalía era del instrumento.

### 2.1 `ULTIMA.EXE:0x5a66` — el `inc` está en el camino COMÚN (a)

Cita (`visibility.ts:15`): sitúa el `inc` en **0x5a66**, y de ahí deriva —literal— *«umbral
efectivo light+1, i.e. VISIBLE ⇔ radial ≤ light_level»*. Tramo:

```
5a4e: cmp word ptr [bp + 0x10], 0
5a52: jg 0x5a57                      ; radio <= 0 ⇒ 5a54 jmp 0x5d01 (SALIDA)
5a57: cmp word ptr [bp + 0xa], -0x6f
5a5b: jne 0x5a66
5a5d: mov word ptr [bp + 0xa], 0     ] RAMA HERMANA
5a62: inc word ptr [bp - 0x20e]      ]
5a66: inc word ptr [bp + 0x10]       ; ← la cita
```

La hermana **no toca `[bp+0x10]`**, y `0x5a66`, a la vez destino del `jne` y caída de la
hermana ⇒ el `inc` corre por las dos vías. Confirmado contra su consumidor: `5bd9: cmp ax,
[bp+0x10]` tras `5bd6: call 0x6ff0` (distancia radial) ⇒ con `[bp+0x10] = light+1`, la
condición «radial < light+1» es exactamente «radial ≤ light_level». **La afirmación se
sostiene tal cual.**

★ **RESIDUO NOMBRADO, no adjudicado** (no es la cita; es lo que la lectura destapó al lado).
`[bp-0x20e]` que enciende la hermana es un **SELECTOR DE MODO** de un flood-fill
**COMPARTIDO**, y la nota no lo menciona. Derivado de sus dos únicos call-sites:

- `0x5d61` → ARGS `(buf=0xab02, stride=0x20, 0, **0xff91**, …, radio=[bp+0xa])`. Pasa el
  centinela ⇒ la hermana corre ⇒ **flag = 1**. `0xab02` = `g_vis_buffer`.
- `0x5f57` → ARGS `(buf=0xad14, stride=0x20, …, arg4 = coordenada real, radio=0xa)`. **flag = 0**.
  `0xad14` es el buffer de FUENTES DE LUZ que la propia nota nombra en otra línea.

Sus dos consumidores discriminan de verdad: `5b5f: cmp [bp-0x20e],0 / jne 0x5b90` — con
flag=0 (pasada de LUCES) el bloque `5b66-5b8e` **lee y ESCRIBE `g_vis_buffer`**
(`[bx+di-0x54fe]`, y `-0x54fe`, como desplazamiento con signo, **es** `0xab02`), poniéndole
ceros con una cota `> 0x1f`; con flag=1 sólo mira `[si] == 0xff`. Y `5be1: cmp [bp-0x20e],0 /
jne 0x5beb`, decide si se consulta la opacidad (`call 0x5dfe`) o se salta a `0x5c9c`.
⇒ **la misma rutina hace dos cosas distintas y la nota documenta una.** Si el port modela la
segunda pasada (luces, radio 10, con escritura de vuelta sobre `g_vis_buffer`) NO está
verificado aquí. Va a tarjeta, no se arregla (§4).

### 2.2 `ULTIMA.EXE:0x66a6` — cadena de CASOS, no guarda (a, en sus límites)

Cita (`combat.ts:729`): *«sólo recibe entrada en la tabla de objetos `0x5c5a` con su sprite
CRUDO, X, Y y planta (`0x66a6-0x66b8`)»*.

```
669a: cmp cx, 1
669d: jne 0x66a6        ; ← el "salto" que mete el par en la banda
669f: mov bx, dx        ] cuerpo del caso cx==1
66a3: mov [bx + 4], al  ]
66a6: cmp cx, 2         ; ← la cita: CABEZA del caso siguiente
66a9: jne 0x66bb
66ab: … 66b8: mov [bp - 6], si     ; cuerpo del caso cx==2, ÚLTIMA instrucción
66bb: …                            ; caso siguiente
```

`0x66a6`, ojo, no es «la otra orilla de una guarda»: es la **cabeza del caso siguiente** de un
switch por `cmp` encadenados, y el rango citado, `0x66a6-0x66b8`, va de la cabeza del caso a su
última instrucción — **límites exactos**. La forma `PREFIJO-efecto` aquí es lo que un switch
es por construcción (la «hermana» es el cuerpo del caso anterior), no un efecto omitido.

⚠ **Lo que este carril NO verifica, dicho**: que los cuatro campos que la prosa nombra
(«sprite CRUDO, X, Y y planta») mapeen uno a uno a las escrituras de ese bloque. El bloque
`66ab-66b8` hace tres escrituras; el resto vendría del cuerpo de `0x6506` completo, que no se
ha leído. Se adjudica el **límite** de la cita, no el reparto de campos.

### 2.3 `ULTIMA.EXE:0x6a0d` — el gate ANTES del `rand_range` (a, exacta)

Cita (`game.ts:5979`): *«sólo consume rand por miembro que lleve el anillo 42 o 44 (el gate
0x6a0d está ANTES del `call rand_range`), así que un party sin esos anillos NO mueve el
stream»*.

```
69f0: cmp byte ptr [bx + 0x55c5], 0x2a   ; 42
69f5: jne 0x69fb
69f7: mov byte ptr [bp - 0xe], 0x2a
6a02: cmp byte ptr [bx + 0x55c5], 0x2c   ; 44
6a07: jne 0x6a0d
6a09: mov byte ptr [bp - 0xe], 0x2c      ] RAMA HERMANA
6a0d: cmp byte ptr [bp - 0xe], 0         ; ← la cita
6a11: je 0x6a4f                          ; sin 42 ni 44 ⇒ SALTA el rand
6a13: sub ax,ax / push ax                ; min = 0
6a16: mov ax,0xf / push ax               ; max = 15
6a1a: call 0x2092                        ; rand_range(0, 15)
```

Exacta en las dos mitades: el `je` de `0x6a11` **se salta el `call 0x2092`**, y la hermana
(`0x6a09`, el caso 0x2c) es justo el «o 44» que la prosa ya enumera. Nada omitido.
(Orden de argumentos por `rand-range-arg-order`: el PRIMER push es el MIN.)

### 2.4 `ULTIMA.EXE:0x6ccf` — punto de REUNIÓN, con las 4 ramas documentadas (a, exacta)

Cita (`encounters.ts:284`): *«1. COUNT (`0x6c5d-0x6ccf`)»*. Ese `0x6ccf`, ojo, es el **final EXCLUSIVO**
del rango: es la primera instrucción tras el bloque, y las **cuatro** ramas condicionales
convergen en él.

```
6c8e: cmp [bp-4], 8    / 6c92: je 0x6ccf     ]
6c94: cmp [bp-4], 0x10 / 6c98: je 0x6ccf     ] → prosa: «base ∈ {1, 8, 0x10} → EXACTO»
6c9a: cmp [bp-4], 1    / 6c9e: je 0x6ccf     ]
6ca0: push 1 / push [bp-4] / call 0x2092     → prosa: «count = rand(1, base)»
6cad: cmp [0x5959],0 / 6cb2: je 0x6cc1
6cb4: push 1 / push [bp-4] / call 0x2092     → prosa: «si [0x5959]!=0 → rand(1,count)»
6cc4: cmp [bp-4], 0x19 / 6cc8: jle 0x6ccf    ]
6cca: mov [bp-4], 0x1a                       ] → prosa: «Clamp > 0x19 → 0x1a (defensivo…)»
6ccf: mov bx, [bp - 0x26]                    ; ← fuera del bloque
```

Las cuatro ramas de entrada a `0x6ccf`, todas, tienen su renglón en la prosa, **incluido el clamp de
la hermana** (`0x6cca`). Es el contraejemplo útil de la celda: mismo perfil `PREFIJO-efecto`
que #133 y aquí el autor SÍ documentó el efecto de la hermana.

## 3. Estado de la cola, con las cuentas cuadradas @ `7355c909`

Mitad adjudicable (FORZADA + LIMPIA) = 20 + 129 = **149**.

| | pares |
|---|---|
| clase-2 cerrados (44 heredados vivos + `TALK.OVL:0x117d` de §0.1) | **45** |
| clase-2 SIN-TEXTO, sin medir (los 7 nombrados en `pegajosa-174-acta` §3.1) | 7 |
| `PREFIJO-efecto` — **CERRADA en §2** | **5** de 18 |
| `PREFIJO-efecto` restantes (×LIMPIA) | 13 |
| `PREFIJO-bifurca` | 4 |
| `PREFIJO-inerte` (NO auto-adjudicable) | 1 |
| `BACKEDGE` | 12 |
| `DIVERGE` | 62 |

45 + 7 + 5 + 13 + 4 + 1 + 12 + 62 = **149** ✓

**Vivos al cerrar: 99** (eran 103; +1 por el DIVERGE nuevo `TALK.OVL:0x1166`, −5 por §2).
De esos 99, **3 ya están adjudicados como (d) NO APLICA** por §1 (`ULTIMA.EXE:0x5887`
BACKEDGE · `DUNGEON.OVL:0x13b2` y `SJOG.OVL:0x17f6` DIVERGE) ⇒ **96 piden lectura de binario**.

Los **180** LEJANA+AMBIGUA (64 + 116) siguen fuera: atribución primero.

## 4. Lo que este carril NO ha hecho, y lo que deja con dueño

- **No ha tocado `game/src`.** Ningún fix, ningún test nuevo. Cero defectos del port hallados.
- **No ha tocado `re/tools/`.** El defecto de §1 está medido y NO arreglado, a propósito:
  cambia la población de un instrumento en uso por otros carriles. **Forma exacta del
  arreglo, para quien lo decida**: capturar el prefijo en `CITE_RE`/`BARE_OFF` (moverlo
  DENTRO del grupo) y excluir del barrido de código las citas marcadas `DS`. **Impacto
  medido: −4 pares**, los 4 en FORZADA+LIMPIA (2 FORZADA + 2 LIMPIA), 329 → 325.
  Control natural del cambio: los 4 nombrados en §1 tienen que desaparecer y **ninguno más**.
- **No ha adjudicado el residuo de §2.1** (el selector de modo `[bp-0x20e]` del flood-fill
  compartido `0x5a28`, y si el port modela la segunda pasada de LUCES). Va a tarjeta propia.
- **No ha resuelto ninguna atribución.** Los 180 LEJANA+AMBIGUA siguen como estaban.
- **La CONDICIÓN de los (a) sigue sin verificarse**, igual que en #172 §3.2 y
  `pegajosa-174-acta` §5: «la cita es correcta» ≠ «el port la modela bajo la condición
  correcta» (#144). Los (a) de §2 se cierran por LECTURA DEL BINARIO en el tramo citado.

⚠ **CORTE DECLARADO.** Se para con la celda cabecera cerrada y el delta adjudicado, no a
mitad de un par. Lo que queda (96 con lectura de binario) es exactamente el trabajo largo que
los cuatro precedentes cortaron; se deja la cola con las cuentas cuadradas y dos hallazgos
con dueño en vez de bajar el listón.

## 5. Gates (EXIT por separado, sin pipes, re-corridos tras el `git add`)

```
python3 re/tools/cita_pegajosa_forma.py             EXIT=0   (3 controles verdes)
python3 re/tools/cita_pegajosa_forma.py --clase2    EXIT=0   (positivo + capacidad verdes)
python3 re/tools/cita_pegajosa_atribucion.py        EXIT=0
python3 re/tools/seed_gate.py                       EXIT=0
python3 -m pytest re/tools/test_frontier.py         EXIT=0
python3 -m pytest re/tools/test_genero.py           EXIT=0
python3 re/tools/genero.py                          EXIT=0
```

`game/src` no se ha tocado ⇒ no aplican tsc ni vitest. Nada de e2e/playwright (mutex ajeno).
`routine-census.json` NO regenerado (EMBARGO). `pytest re/tools` COMPLETO no corrido (contiene
un test de oráculo EN VIVO); los test-files se corren por nombre.

---

## 6. Nombres de overlay usados en las correcciones (sección FINAL a propósito)

Va al final del fichero por el ctx pegajoso de la tarjeta #84: un nombre de overlay escrito
arriba re-atribuye los offsets desnudos que vengan detrás dentro de la ventana de 40 líneas.
Este fichero está en `re/notes/`, que —medido en §0.2— **no** es fuente de la población del
extractor, así que aquí es una precaución, no una necesidad. Se mantiene la disciplina porque
la misma prosa puede acabar copiada a un docblock de `game/src`, donde sí lo sería.

Overlays citados en este acta: `ULTIMA.EXE` (§1, §2), `DUNGEON.OVL` y `SJOG.OVL` (§1, los dos
como atribución EQUIVOCADA — su cita real es a `DATA.OVL`), `TALK.OVL` y `TOWN.OVL` (§0, el
delta). `DATA.OVL` no tiene desensamblado en el corpus: ése es medio mecanismo de §1.
