# ACTA #174 (banda PEGAJOSA) — TANDA 9, SUB-TANDA 1: el grupo de `combat.ts`, 8 pares

> Rama `re/sueltos-174`, worktree `.claude/worktrees/sueltos-174`, base **main `48832bec`**.
> Toda cifra medida en ese árbol. RETENIDA: aterriza el lead.
> Continúa `diverge-174-t4-acta.md` §6 (el relevo con el orden recomendado y el ritmo medido).

---

## 0. VEREDICTO

**8 pares · 8 (a) exacta · 0 (b) · 0 (d)** — con **5 lecturas**, porque tres de los ocho salen
en PAREJA del mismo docblock (§2). Y **★ UN (c)**: un hueco de mecánica REAL que destapa la lectura
de `COMBAT.OVL:0x0422` (§4), documentado en prosa pero **huérfano de tarjeta viva** (§4).

| par | fichero del port | veredicto |
|---|---|---|
| `COMSUBS.OVL:0x09b8` | `combat.ts:2053` | **(a)** — arrojadizas a dist > 1, y el «se PIERDE» probado por CONTRASTE |
| `COMSUBS.OVL:0x09f7` | `combat.ts:2074` | **(a)** — el epílogo, y el «sin push de string ni print» por enumeración |
| `CAST.OVL:0x20a1` | `combat.ts:2429` | **(a)** — la inmunidad por tipo, sus 3 valores y el ORDEN respecto al saving |
| `COMBAT.OVL:0x0422` | `combat.ts:3053` | **(a)** la cita — ★ y el (c) de §4 al lado |
| `COMBAT.OVL:0x0446` | `combat.ts:3051` | **(a)** — el wake-roll, sus dos extremos y el 1/17 |
| `COMSUBS.OVL:0x01ca` | `combat.ts:3095` | **(a)** en sustancia; imprecisión de NOTACIÓN declarada (§3.1) |
| `COMSUBS.OVL:0x023e` | `combat.ts:3096` | **(a)** — el `jge` del fallo y el `ret 0` del final de cadena |
| `ULTIMA.EXE:0x2ca9` | `combat.ts:1222` | **(a)** — y su justificación vecina COMPROBADA (§5) |

## 1. RE-ANCLA: medida, no heredada

Se re-corre en ESTA sub-tanda, que es la lección de `diverge-174-errata` §4:

```
git diff e24b53f5..HEAD -- game/src   → 4 ficheros, 289 inserciones (#195 y #196)
git diff 4e4769e9..HEAD -- game/src   → VACÍO   (3 commits desde la sub-tanda 4, ninguno de game/src)
python3 re/tools/cita_pegajosa_atribucion.py  → 345 pares @ 48832bec, 3 controles verdes
python3 re/tools/cita_pegajosa_forma.py       → DIVERGE × (FORZADA 9 + LIMPIA 55) = 64
```

⇒ **CERO altas** desde la sub-tanda 4. 64 − 4 ya-(d) por #188/#190 − 14 adjudicados = **46 vivos**
al empezar, y la lista reproduce **por MIEMBROS**, no por conteo.

★ **Corrección de una cifra del relevo**: `diverge-174-t4-acta` §6 dice *«32 de los 46 agrupan por
fichero del port en 10 grupos»*. Medido @ `48832bec`: son **30 en 9 grupos** (8 `combat.ts` · 5
`game.ts` · 4 `transport.ts` · 3 `loops/turn.ts` · cinco grupos de 2: `skin/fiel/skin.ts`,
`main.ts`, `camp.ts`, `dungeon/dungeon.ts`, `dialogue/conversation.ts`). El grupo de cabecera —los
**8** de `combat.ts`— sí cuadra exacto, que es el que esta sub-tanda ataca. Es una discrepancia de
contabilidad, no de composición: los 46 son los mismos.

## 2. ★ EL REGALO QUE EL RELEVO ANTICIPÓ: hermanos por DOCBLOCK, no por línea

El barrido de hermanos de la sub-tanda 1 censaba «pares que apuntan a la MISMA línea del port» y
se declaró **cota INFERIOR**. Aquí se cobra la diferencia: **tres grupos de 2 pares en LÍNEAS
DISTINTAS del mismo docblock**, invisibles a aquel censo y cerrados con una lectura cada uno.

| grupo | líneas | rutina del port | rutina del binario |
|---|---|---|---|
| `COMSUBS.OVL:0x09b8` + `0x09f7` | 2053 · 2074 | `consumeAmmo` | `COMSUBS.OVL:0x097c` |
| `COMBAT.OVL:0x0446` + `0x0422` | 3051 · 3053 | `enemyTurn` | `COMBAT.OVL:0x03f4` |
| `COMSUBS.OVL:0x01ca` + `0x023e` | 3095 · 3096 | `enemySpecial` | `COMSUBS.OVL:0x00f4` |

**8 pares por 5 lecturas** (ritmo 0,63), contra el 1,0 que el relevo estimaba para pares sueltos.
⇒ **El «suelto» del censo no es suelto en el código**: agrupar por FICHERO llevó a agrupar por
RUTINA sin buscarlo. Es dato de método para las sub-tandas siguientes, no una casualidad de ésta.

## 3. Las cinco lecturas

### 3.1 `COMSUBS.OVL:0x097c` — el consumo de munición, y una negativa probada por CONTRASTE

La rutina entera cabe en 0x097c-0x09f7 y se leyó completa. El despacho por id de arma:

| call-site | instrucción | destino | qué es |
|---|---|---|---|
| `COMSUBS.OVL:0x097f`, | `cmp byte ptr [g_cmb_is_spell], 0` / `jne 0x9f7` | `0x09f7` | hechizo ⇒ no gasta |
| `COMSUBS.OVL:0x098c`, | `cmp ax, 0x16` / `jg 0x9e8` | `0x09e8` | > 0x16 ⇒ cadena de arcos |
| `COMSUBS.OVL:0x0991`, | `cmp ax, 0x15` / `jge 0x9b8` | `0x09b8` | {0x15, 0x16} ⇒ arrojadizas |
| `COMSUBS.OVL:0x0996`, | `cmp ax, 0x10` / `je 0x9b8` | `0x09b8` | 0x10 Dagger ⇒ arrojadizas |
| `COMSUBS.OVL:0x0998`, | `jmp 0x9f7` | `0x09f7` | cualquier otra ⇒ SALE |
| `COMSUBS.OVL:0x09bc`, | `cmp word ptr [bp + 4], 1` / `jle 0x9f7` | `0x09f7` | dist ≤ 1 ⇒ no gasta |
| `COMSUBS.OVL:0x09c6`, | `cmp byte ptr [bx + 0x57c0], 0` / `je 0x9ce` | `0x09ce` | sin reserva ⇒ se pierde |
| `COMSUBS.OVL:0x09eb`, | `cmp ax, 0x1a` / `je 0x99c` | `0x099c` | bow ⇒ Arrows |
| `COMSUBS.OVL:0x09f0`, | `cmp ax, 0x1c` / `je 0x9b2` | `0x09b2` | crossbow ⇒ Quarrels |
| `COMSUBS.OVL:0x09f5`, | `cmp ax, 0x24` / `je 0x99c` | `0x099c` | magic bow ⇒ Arrows |

★ El conjunto `{0x10, 0x15, 0x16}` que la cita da **NO está en una sola instrucción**: el `jge` de
`0x0991` cubriría todo ≥ 0x15, y lo que lo acota por arriba es el `jg 0x9e8` de `0x098c`, tres
instrucciones antes. La cita da el conjunto correcto; la derivación son **dos comparaciones**, y
el port las tiene resueltas como conjunto explícito (`THROWN_WEAPONS = {0x10, 0x15, 0x16}` en
`equip.ts:159`) con Sling 0x11 y Flaming Oil 0x13 excluidos **a propósito y con motivo escrito** —
los dos caen por el `jmp 0x9f7` de `0x0998` en el binario ✓.

★★ **La negativa «se PIERDE (09ce, sin devolver)» se prueba por CONTRASTE con su hermano**, que es
la forma buena de un aserto de ausencia:

| call-site | instrucción | ¿devuelve al pack? |
|---|---|---|
| `COMSUBS.OVL:0x09a2`, | `push [bp+6]` / `call 0xffff9e2a` (desequipar) | — |
| `COMSUBS.OVL:0x09ab`, | `add byte ptr [bx + 0x57c0], al` | **SÍ** (munición agotada) |
| `COMSUBS.OVL:0x09e2`, | `push ax` / `push [bp+6]` / `call 0xffff8c80` | — |
| `COMSUBS.OVL:0x09e5`, | `jmp 0x9f7` | **NO** — no hay `add`, se va al epílogo |

Y **`COMSUBS.OVL:0x09f7`** es literalmente `pop bp` / `ret 4` ⇒ «epílogo» exacto. El *«sin push de
string ni print»* se sostiene por **enumeración de la rutina entera**: los únicos `push` de
`0x097c-0x09f7` son `[bp+6]` (dos veces) y `ax`; no hay ni un inmediato de cadena ni una llamada
de impresión. Los dos pares, **(a) exacta**.

⚠ **No verificado**: el gate `g_cmb_is_spell` de `0x097f` no tiene contraparte dentro de
`consumeAmmo`; el port lo satisface por ESTRUCTURA (sus dos únicos call-sites, `combat.ts:1912` y
`:2001`, están en la vía física). Se declara, no se adjudica.

### 3.2 `CAST.OVL:0x20a1` — el orden saving → inmunidad, en los DOS modos

La cita afirma que la inmunidad por tipo se consulta **DESPUÉS** del saving *«(0x20a1/0x210b): la
tirada ya se consumió aunque el objetivo resulte inmune»*. Los dos modos, en paralelo:

| call-site | instrucción | papel |
|---|---|---|
| `CAST.OVL:0x2097`, | `call 0xffffc19e` (saving, args `di`/`si`/`0`) | modo 1 — la TIRADA, primero |
| `CAST.OVL:0x209c`, | `or ax, ax` / `je 0x20a1` | pasa el saving ⇒ sigue |
| `CAST.OVL:0x20a2`, | `push si` / `call 0` | modo 1 — la INMUNIDAD, después |
| `CAST.OVL:0x2103`, | `call 0xffffc19e` (saving) | modo 4 — la TIRADA, primero |
| `CAST.OVL:0x210b`, | `push si` / `call 0` | modo 4 — la INMUNIDAD, después |

⇒ el «ya se consumió» es **consecuencia mecánica del orden**, no una impresión. Y la rutina
llamada, `CAST.OVL:0x0000`, cuadra con la cita término a término:

| call-site | instrucción | la cita dice |
|---|---|---|
| `CAST.OVL:0x0006`, | `mov bx, word ptr [bp + 4]` / `mov cl, 3` / `shl bx, cl` | `slot*8` ✓ |
| `CAST.OVL:0x000d`, | `mov al, byte ptr [bx - 0x45e9]` | `[slot*8-0x45e9]` ✓ literal |
| `CAST.OVL:0x0016`, | `cmp ax, 0x2f` / `je 0x25` | Shadow Lord ✓ |
| `CAST.OVL:0x001b`, | `cmp ax, 0xe` / `je 0x25` | Blackthorn ✓ |
| `CAST.OVL:0x0020`, | `cmp ax, 0xf` / `jne 0x2a` | Lord British ✓ |
| `CAST.OVL:0x002c`, | `mov sp, bp` (epílogo) | cierre exacto de `0x0006-0x002c` ✓ |

El *«Sin RNG»* es **demostrable por enumeración**: entre `0x0000` y su `ret 2` de `0x002f` no hay
ni una sola `call`. **(a) exacta**, y el port modela los dos destinos del FORK — `0x20a1`, seguir;
y `0x209e jmp 0x2132`, pasar al siguiente objetivo del abanico.

### 3.3 `COMBAT.OVL:0x03f4` — el turno de la IA: la cita, exacta; y el hueco al lado (→ §4)

| call-site | instrucción | destino | qué pasa |
|---|---|---|---|
| `COMBAT.OVL:0x0418`, | `cmp byte ptr [g_time_spell], 0x54` / `jne 0x422` | — | ¿An Tym ('T')? |
| `COMBAT.OVL:0x041f`, | `jmp 0x540` | `0x0540` | SÍ ⇒ turno ENTERO perdido |
| `COMBAT.OVL:0x0422`, | `cmp byte ptr [g_time_spell], 0x51` / `jne 0x43a` | `0x043a` | ¿Rel Tym ('Q')? |
| `COMBAT.OVL:0x0430`, | `push 0` / `push 1` / `call 0x7e02` | — | **rand(0,1)** — ver §4 |
| `COMBAT.OVL:0x0435`, | `or ax, ax` / `jne 0x43a` | `0x043a` | ≠0 ⇒ el enemigo SÍ juega |
| `COMBAT.OVL:0x0437`, | `jmp 0x540` | `0x0540` | ==0 ⇒ turno perdido |
| `COMBAT.OVL:0x0446`, | `test byte ptr [bx + 2], 8` / `je 0x46a` | `0x046a` | ¿dormido? |
| `COMBAT.OVL:0x044f`, | `push 0` / `push 0x10` / `call 0x7e02` | — | `rand(0,16)` |
| `COMBAT.OVL:0x0456`, | `cmp ax, 0x10` / `je 0x45e` | `0x045e` | ==16 ⇒ despierta |
| `COMBAT.OVL:0x0467`, | `jmp 0x540` | `0x0540` | cierre exacto de `0x0446-0x0467` |

`COMBAT.OVL:0x0540` es `mov sp, bp` / `pop bp` / `ret` ⇒ el *«RETea»* de la cita es **literal**.
El *«ANTES de cualquier tirada»* se demuestra por enumeración: entre la CABEZA de `0x03f4` y el
`0x0418` no hay ninguna `call`; la primera del cuerpo es la de `0x0430`. Y el 1/17 sale de que
`rand(0,16)` tiene 17 resultados, con el port calcándolo como `crng.rand0(0x10) === 0x10` ✓.

⚠ **Imprecisión de notación, declarada**: la cita llama a `0x0446` *«el wake-roll»*, y `0x0446` es
el `test` de la bandera de dormido — la TIRADA está en `0x0453`. Dos líneas más abajo el mismo
docblock da el RANGO de `0x0446-0x0467`, que sí la contiene, así que es abreviatura y no error. Los
dos pares, **(a) exacta**.

### 3.4 `COMSUBS.OVL:0x00f4` — la cadena de especiales, y su FALL-THROUGH de tres eslabones

La cita afirma que la cadena cae de eslabón en eslabón y que, si ninguno se ejecuta, devuelve 0:

| call-site | instrucción | destino | eslabón |
|---|---|---|---|
| `COMSUBS.OVL:0x0131`, | `test byte ptr [bx + 0x153c], 0x40` / `jne 0x13b` | `0x01ca` (por `0x0138`) | sin la habilidad ⇒ cae |
| `COMSUBS.OVL:0x0142`, | `push 0` / `push 0x1f` / `call 0x3eb2` | — | **rand(0,31) ANTES de validar** |
| `COMSUBS.OVL:0x0157`, | `test byte ptr [bp - 4], 0x80` / `je 0x1ca` | `0x01ca` | no es PJ ⇒ cae |
| `COMSUBS.OVL:0x015d`, | `test byte ptr [bp - 4], 0x3d` / `jne 0x1ca` | `0x01ca` | PJ «sucio» ⇒ cae |
| `COMSUBS.OVL:0x01cf`, | `test word ptr [bx + 0x153c], 0x800` / `je 0x23e` | `0x023e` | sin invisibilidad ⇒ cae |
| `COMSUBS.OVL:0x01de`, | `push 0` / `push 0xff` / `call 0x3eb2` | — | `rand(0,255)` |
| `COMSUBS.OVL:0x01e4`, | `cmp ax, 0x20` / `jge 0x23e` | `0x023e` | falla la tirada ⇒ cae |
| `COMSUBS.OVL:0x0243`, | `test word ptr [bx + 0x153c], 0x400` / `jne 0x24e` | `0x0127` (por `0x024b`) | sin daemon ⇒ fin |
| `COMSUBS.OVL:0x0127`, | `sub ax, ax` / `jmp 0x30a` | — | **`ret 0`** ✓ |

**Los dos destinos citados y el final de cadena, exactos.** Y el port lo calca con un comentario
de caída en cada eslabón (`combat.ts:3136`, `:3143`), incluida la parte que más importa para la
paridad: **el `rand(0,31)` se consume ANTES de comprobar si el slot vale**, y `combat.ts:3103`
hace `this.crng.rand0(0x1f)` antes de las guardas ✓ — mismo orden, mismo consumo.

⚠ **Imprecisión de NOTACIÓN, declarada**: la cita escribe *«(0x157/0x15d je 0x1ca)»* y el segundo
es un **`jne`**, no un `je` (`0x015b` es `je`, `0x0161` es `jne`). El destino, los dos offsets y el
mecanismo son correctos; lo que agrupa mal es el mnemónico. Se adjudica **(a) en su sustancia**
con la imprecisión escrita, no (b): no hay derivación que acercar, hay una letra que sobra.

⚠ **No verificado**: qué cadena es `0x99c2` y cuál `0x99ce` en el toggle de invisibilidad
(`0x0201`/`0x021e`). La estructura toggle-con-dos-mensajes sí cuadra con el port; la ASIGNACIÓN de
cada cadena a «disappears»/«reappears» es correspondencia con el catálogo, y estos pares son de
flujo.

### 3.5 `ULTIMA.EXE:0x2ca9` — el `default` de la jump-table, y la tabla leída entera

| call-site | instrucción | destino | qué es |
|---|---|---|---|
| `ULTIMA.EXE:0x2c56`, | `mov al, byte ptr [bx + 0x54f4]` | — | la CLASE, de `[0x54f4 + mover>>2]` |
| `ULTIMA.EXE:0x2c5c`, | `cmp ax, 0xa` / `ja 0x2ca9` | `0x2ca9` | clase > 10 ⇒ el `default` citado |
| `ULTIMA.EXE:0x2c64`, | `jmp word ptr cs:[bx + 0x2d60]` | tabla | 11 handlers |
| `ULTIMA.EXE:0x2ca9`, | `sub ax, ax` / `jmp 0x2d76` | `0x2d76` | **return 0 = bloqueado** |
| `ULTIMA.EXE:0x2d76`, | `pop bp` / `ret 4` | — | el epílogo |

La cita (*«clase > 0x0A (255 Poison Field): `ja 0x2ca9` ⇒ bloqueado SIEMPRE»*) es **(a) exacta**:
el `ja` es sin signo sobre un byte extendido, así que cubre `{11..255}`, y `0x2ca9` devuelve 0.

## 4. ★★ EL (c): Rel Tym ('Q') en combate — hueco REAL, huérfano de tarjeta, y que MUEVE EL STREAM

Al adjudicar la cita de `COMBAT.OVL:0x0422`, salta el vecino. El docblock del port
(`combat.ts:3053-3054`) lo declara con honradez: *«La rama de Rel Tym quickness 'Q'/0x51 de 0x0422
es un gap aparte, no modelado — fuera de #42»*. **La declaración es cierta y el hueco también.**

**Qué hace el binario** (tabla de §3.3): bajo Rel Tym, CADA turno de enemigo tira `rand(0,1)` en
`0x0430` y con resultado 0 salta el turno entero. **Qué hace el port**: `git grep '"Q"'` sobre
`game/src/core/combat/` devuelve **cero** — `enemyTurn` sólo mira la `'T'`.

Consecuencias, las dos:

1. **Mecánica ausente**: con Rel Tym activo los enemigos nunca pierden turno en combate.
2. **★ Paridad de RNG, NO declarada en ninguna parte**: el port se salta un `rand` **por turno de
   enemigo** mientras dure el hechizo. `re/notes/combat.md` §12 lista, en su censo de rands, el
   `COMBAT.OVL:0x0430` (Quickness 50%), y §8 documenta la mecánica — pero **nadie une las dos mitades**: que el port
   la omita mueve el stream. Familia de #128 / #157 / #179.

**Estado de dueño, medido**: `re/notes/content-audit.md:174` lo archiva como
*«[BAJA] Rel Tym (quickness Q) en combate (An Tym time-stop SÍ modelado). #42.»* — y **la tarjeta
#42 no existe en la lista de tareas** (va del #41 al #43). ⇒ **hueco documentado en prosa y
huérfano de tarjeta viva.** Va a tarjeta con estas señas; **NO se arregla aquí** (el encargo es
adjudicar, y esto es mecánica que mueve el stream).

★★ **Y la trampa que hay que dejar escrita para quien lo arregle**: el port YA modela Rel Tym en
otros dos sitios, y en los dos como **TOGGLE DETERMINISTA** —
`game.ts:2213` (`outdoorWorldTurnRuns`, cita MAINOUT 0x1A7A-0x1A9D, `quicknessPhase ^= 1`) y
`dungeon.ts:1375` (`worldAdvances`, cita DUNGEON 0x0F1E-0x0F34, `quicknessToggle ^= 1`).
**El de combate NO es un toggle: es una moneda al aire**: `push 0` / `push 1` / `call 0x7e02`, en
el `COMBAT.OVL:0x0430` de la tabla de §3.3. Copiar el patrón vecino daría una mecánica plausible, determinista y **falsa**, y
además **no consumiría el rand**. Firma exacta de #133: media guarda portada con la cita al lado.

## 5. ★ Un defecto que NO lo era: el `default` de `tilePassableFor`

Merece constancia porque el camino corto llevaba a firmar un (c) falso. La jump-table de
`ULTIMA.EXE:0x2d60`, leída **byte a byte** (es dato mal desensamblado), tiene **11 entradas**:

| clase | 0 | 1 | 2 | **3** | 4 | **5** | **6** | 7 | 8 | 9 | 10 |
|---|---|---|---|---|---|---|---|---|---|---|---|
| destino | `0x2c6a` | `0x2c76` | `0x2c80` | **`0x2cae`** | `0x2cca` | **`0x2cdc`** | **`0x2d34`** | `0x2d42` | `0x2d4e` | `0x2d54` | `0x2d5a` |

El `switch` del port tiene casos para 0,1,2,4,7,8,9,10 y manda **3, 5 y 6 al `default: return
false`** — y las tres tienen handler REAL en el binario, o sea que NO son «bloqueado siempre»:

| call-site | instrucción | qué hace |
|---|---|---|
| `ULTIMA.EXE:0x2cae`, | `call 0x2bd4` / `cmp word ptr [bp + 4], 0x8f` / `cmp word ptr [bp + 4], 4` | mapa de a pie menos Lava y Swamp |
| `ULTIMA.EXE:0x2cdc`, | `and al, 0xfc` / `cmp al, 0x34` / `mov cl, byte ptr [bx + 0x5510]` | sub-mapa propio para la banda 0x34 |
| `ULTIMA.EXE:0x2d34`, | `cmp word ptr [bp + 4], 2` / `jle 0x2d3d` | pasable si el tile es ≤ 2 |

Parece un (c) de manual.

**No lo es, y el propio port lo tenía compensado**: su cabecera (`combat.ts:1176-1178`) enumera las
tres con su offset y su semántica y declara *«no la usa ningún enemigo»*. **Comprobado contra la
tabla que la cabecera invoca**, `ENEMY_MOVE_CLASS` (`enemies.ts:221-226`, 48 entradas VERBATIM):
los valores presentes son `{0, 1, 2, 4, 7, 8, 9, 10, 255}` — **ni un 3, ni un 5, ni un 6**. El
`default` recoge `{3,5,6,255}` y sólo el 255 ocurre, que es justo el caso que el `ja 0x2ca9` del
binario cubre.

⇒ Familia `caso-canonico-ya-compensado`. La lección operativa: **la cabecera hay que leerla entera
ANTES de cobrar el defecto**, y la justificación que da hay que comprobarla contra el artefacto que
nombra — aquí la comprobación fue barata (una tabla de 48 números) y convirtió un (c) falso en un
control positivo de la cabecera.

## 6. Estado de la cola

| | pares |
|---|---|
| población @ `48832bec` | 345 |
| `DIVERGE` F+L | 64 |
| ya (d) por #188/#190 | 4 |
| adjudicados por los carriles anteriores | 14 |
| adjudicados en esta sub-tanda | **8** |
| **VIVOS** | **38** |

Balance de esta sub-tanda: **8 pares por 5 lecturas**, todos (a) exacta, cero (b), cero (d), y
**un (c)** — el segundo defecto de mecánica de las nueve tandas, tras el de #200.

⚠ **CORTE EN FRONTERA DE GRUPO**: el grupo de `combat.ts` queda ENTERO cerrado y no se ha abierto
el siguiente. Ningún par partido por la mitad.

**Orden recomendado para la sub-tanda 2**, con las cifras re-medidas de §1: `core/game.ts` (5) +
`core/world/transport.ts` (4) = 9 pares, que es el tamaño que §2 sugiere ahora que el ritmo medido
baja a **0,63 lecturas/par** si los grupos por fichero siguen siendo grupos por rutina.

## 7. Lo que esta sub-tanda NO ha hecho

- **No ha tocado `game/src` ni `re/tools`.** El (c) de §4 va a TARJETA, no a fix.
- **No ha verificado la CONDICIÓN** (#144) de los 8: se adjudica que la cita describe el tramo. En
  `CAST.OVL:0x20a1`, `COMSUBS.OVL:0x01ca/0x023e` y `ULTIMA.EXE:0x2ca9` sí se comprobó ADEMÁS que el
  port modela los dos destinos, porque es la pregunta propia de la celda.
- **No ha leído** los 38 pares restantes.
- **No ha re-corrido la lente `kernel`** (§2 de `diverge-174-acta` sigue vigente: 1 candidata en la
  celda, benigna). **Ninguna de las 8 citas de esta sub-tanda contiene el token.**
- **No ha resuelto** las dos «no verificado» de §3.1 y §3.4 (gate `g_cmb_is_spell`; asignación de
  `0x99c2`/`0x99ce`).

## 8. Gates (EXIT por separado, sin pipes, re-corridos tras el `git add`)

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
`routine-census.json` NO regenerado (EMBARGO). `pytest re/tools` COMPLETO no corrido (contiene un
test de oráculo EN VIVO); los test-files se corren por nombre.

---

## 9. Nombres de overlay usados aquí (sección FINAL a propósito)

Al final por el ctx pegajoso de #84. Overlays nombrados: `CAST.OVL`, `COMBAT.OVL`, `COMSUBS.OVL`,
`DATA.OVL`, `DUNGEON.OVL`, `MAINOUT.OVL`, `ULTIMA.EXE`.
