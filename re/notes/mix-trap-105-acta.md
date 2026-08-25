# #105 — la trampa de Mix: ACTA COMPLETA (cierra la cola de `mix-trap-105-parcial.md`)

> **Estado:** los cinco puntos del relevo (a)…(e) hechos. La rutina queda atada a Mix por
> el call-site; las 4 cadenas leídas byte a byte; los 4 efectos derivados; el port careado.
>
> ✅ **Y EL FIX DE MECÁNICA YA ESTÁ CABLEADO** (carril `mix-trampa`, ver §9). Cuando se
> escribió el cuerpo de esta acta no lo estaba, por el embargo de `main.ts`; §5.2 y §7
> describen ese estado y **se leen en pasado**. Se dejan literales a propósito —son el
> registro de por qué el hueco sobrevivió a dos carriles— pero §9 manda sobre ellos.
>
> Este acta **sustituye** a `re/notes/mix-trap-105-parcial.md` y **corrige DOS afirmaciones
> suyas** (§6). La parcial no se borra: se marca como superada, porque la corrección de su
> premisa (b) es en sí un hallazgo.

---

## 1. (a) EL CALL-SITE DE MIX — probado

Lo que ata la rutina a la tarjeta. Resuelto **por banda**, no por texto: `near_call_base`
de `CMDS.OVL` = **0xbf80**, así que `call 0x7050` → `(0x7050 + 0xbf80) & 0xFFFF` = **0x2fd0**.

Instrumento: `re/tools/callers_por_banda.py 0x2fd0`, con su control positivo obligatorio en
verde (re-encuentra el par de #158, 3 callers donde el grep ve 0).

| overlay | offset | destino | qué lo dispara |
|---|---|---|---|
| CMDS.OVL | 0x1c04 | ULTIMA.EXE:0x2fd0 | ★ **Mix** |
| SJOG.OVL | 0x1222 | ULTIMA.EXE:0x2fd0 | cofre del mundo |
| SJOG.OVL | 0x1323 | ULTIMA.EXE:0x2fd0 | cofre de mazmorra |

`grep "call 0x2fd0"` sobre los `.asm`: **0 de 3**. El cero era de notación (familia #173).

La rama que lo dispara, dentro de `cmd_mix` (**CMDS.OVL:0x1ad8**, 328 B, acaba en 0x1c20 —
tamaño del ledger, así que 0x1c04 cae DENTRO por construcción, no por vista):

| offset | instrucción | qué |
|---|---|---|
| 0x1bc2 | `cmp word [bp-4], 0` / `jl 0x1bf6` | índice de hechizo negativo → trampa |
| 0x1bc8 | `mov bx,[bp-4]` / `mov al,[bx+0x1cc0]` | receta REQUERIDA del hechizo |
| 0x1bd1 | `cmp ax,[bp-2]` / `jne 0x1bf6` | ★ **máscara marcada ≠ requerida → TRAMPA** |
| 0x1bd6 | `mov ax,0x8ffc` / `call 0x58d0` | (rama buena) "Done!" |
| 0x1bf6 | `mov ax,0xa` / `call 0x573a` | `putchar('\n')` — kernel 0x16ba |
| 0x1bfd | `call 0x7a7c` | `party_conscious_state` — kernel 0x39fc |
| 0x1c00 | `push [g_cmb_scratch_x]` | el miembro elegido (DS 0x5876) |
| 0x1c04 | `call 0x7050` | ★ **`chest_trap_trigger`** — kernel 0x2fd0 |

El consumo de reagentes, 0x1baa `sub byte [si+0x5850], al`, ocurre **antes** del gate: se
gastan igual, acierte o no. Eso el port ya lo calca.

### 1.1 Quién come la trampa

`party_conscious_state` (kernel **0x39fc**) recorre el roster (di=0x55b3, paso 0x20,
si=0..g_party_size−1) y en el **primer** miembro con estado `'G'`(0x47) o `'P'`(0x50)
escribe `g_cmb_scratch_x = si` y devuelve 0 (0x3a32). Si no hay ninguno, cuenta los `'S'`
(0x53) y devuelve 1 ó 0xFFFF.

★ **Cabo declarado, no resuelto:** `cmd_mix` **ignora el valor de retorno** y empuja
`g_cmb_scratch_x` a pelo. Si ningún miembro es G/P, esa global **no se escribe** en esta
llamada y la trampa cae sobre el índice que hubiera quedado de un uso anterior. No lo cierro
como «bug del original» ni como «imposible»: para afirmar cualquiera de las dos cosas hace
falta saber si Mix es alcanzable con la party entera dormida/muerta, y eso no lo he medido.

---

## 2. (b) LAS 4 CADENAS — leídas, y la premisa de la parcial REFUTADA

La parcial dejó esto abierto diciendo «la conversión DS→fileoff de ULTIMA.EXE no es el +0x10
de DATA.OVL». **La premisa era falsa por mal planteamiento del problema**: `DS` es el
segmento de datos COMPARTIDO, y lo que se carga ahí es DATA.OVL. Que la rutina que empuja el
puntero viva en el kernel no mete la cadena en el fichero del kernel. La regla de siempre
(`fileoff = DS + 0x10`, DATA.OVL) aplica sin cambio.

Derivado **sin conjeturar el texto**: barrido de los dos binarios buscando una base donde
cuadre a la vez la huella estructural entera — cuatro cadenas ASCII NUL-terminadas en los
desplazamientos relativos 0/+7/+16/+23 **y** la tabla de 8 bytes con valores <4 en +29.

- `ULTIMA.EXE`: **0 candidatos**.
- `DATA.OVL`: el candidato con sesgo **0x10** es el único bien formado (los otros 6 son
  desplazamientos de un carácter que parten palabras, `'CID!'`, `'.DRV'`…).

| DS | fileoff DATA.OVL | texto |
|---|---|---|
| 0x5581 | 0x5591 | `ACID!\n` |
| 0x5588 | 0x5598 | `POISON!\n` |
| 0x5591 | 0x55a1 | `BOMB!\n` |
| 0x5598 | 0x55a8 | `GAS!\n` |
| 0x559e | 0x55ae | tabla de tipos: `00 00 00 01 01 02 02 03` |

**Control cruzado independiente:** `re/ledger/frontier-manual.json` (entrada de 0x2fd0) y
`re/notes/cmds.md §8` ya nombraban ACID/POISON/BOMB/GAS **sin** el volcado de bytes. Las dos
vías coinciden. Lo que faltaba no eran las direcciones —el port ya las cita en
`combat.ts` y `game.ts`— sino el texto verificado, y ahora lo está.

★ **La tabla es una DISTRIBUCIÓN, no una permutación.** En la banda baja los tipos NO son
equiprobables: **ACID 3/8 · POISON 2/8 · BOMB 2/8 · GAS 1/8**. Quien modele «rand(0,3)»
tendrá los cuatro tipos con la frecuencia equivocada aunque consuma la misma tirada.

---

## 3. (c) LOS EFECTOS DE LOS 4 CASOS — derivados

Cuerpo del despachador (ULTIMA.EXE 0x2fd0-0x306e, 162 B, `ret 2` = un argumento):

| offset | instrucción | qué |
|---|---|---|
| 0x2fe3 | `call 0x223c` con (0x1f4, 0xbb8, 0x28) | `noise_burst` — el golpe de apertura |
| 0x2fe6 | `cmp byte [g_location], 0x7f` / `jbe 0x2ffa` | ★ gate por banda |
| 0x2ff4 | `call 0x2092` con (0, 1) | banda >0x7f: `rand(0,1)` = el tipo, CRUDO |
| 0x3001 | `call 0x2092` con (0, 7) | banda ≤0x7f: `rand(0,7)`… |
| 0x3006 | `mov al,[bx+0x559e]` | …indexando la tabla de §2 |
| 0x300f-0x3020 | `or/cmp 1/cmp 2/cmp 3` | despacho de 4 casos; ≥4 → 0x306a, sin efecto |
| 0x3024 | `mov ax,0x5581` / `call 0x1850` | **caso 0 ACID**: imprime |
| 0x302b | `push [bp+4]` / `call 0x3abe` / `push ax` / `call 0x2a52` | ACID: daño al que abre |
| 0x3038 | `mov ax,0x5588` / `call 0x1850` / `call 0x2fa6` | **caso 1 POISON** al que abre |
| 0x3048 | `mov ax,0x5591` / `call 0x1850` / `call 0x2aa8` | **caso 2 BOMB** a la party |
| 0x3054 | `mov ax,0x5598` / `call 0x1850` | **caso 3 GAS**: imprime… |
| 0x305d | bucle si=0..5: `push si` / `call 0x2fa6` | …y envenena a los SEIS slots |

Los callees, leídos:

- **0x3abe** (`rand30`): `call 0x3aae(0x3c)` = `rand0(60)` = `rand_range(0,60)`, luego
  `cdq / sub ax,dx / sar ax,1` (mitad) y si sale 0 lo sube a 1 ⇒ **daño ∈ [1,30]**.
- **0x2a52**: el ledger lo tiene como `party_char_take_damage` (§6.1). `[bp+6]`=índice,
  `[bp+4]`=daño; el orden de pushes de 0x302b/0x3032 cuadra con esa firma.
- **0x2fa6** (`party_set_poisoned`): guarda propia — `idx < g_party_size`, 0x2faf, **y**
  estado ≠ `'D'`, 0x2fbf; sólo entonces escribe `'P'` (0x50) y repinta el panel. Por eso
  el bucle de GAS puede recorrer los 6 slots a ciegas: **el filtro está en el callee**.
- **0x2aa8** (`party_random_damage`): si=0..5, salta, 0x2abd, si `si ≥ g_party_size` o
  estado `'D'` (0x2ac1); si no, `rand_range(1,8)` y daño. `si` se empuja UNA vez y lo
  reusan las dos llamadas, 0x2ac6.

---

## 4. (e) LA CORRECCIÓN DEL CENSO — «0 rand» es falso, y «1 tirada» TAMBIÉN se queda corto

`cmds.md §12` decía **«0 rand»** para Mix. Falso: la rama de reagentes incorrectos entra en
0x2fd0 y ahí se tira. Pero la parcial lo corrigió a **«exactamente UNA tirada en las dos
ramas»**, y eso es un **suelo, no un conteo** — se le escaparon los callees, que es
exactamente el defecto que la tarjeta denunciaba, cometido un nivel más abajo.

Cuenta real, por caso:

| rama | tiradas |
|---|---|
| tipo (siempre) | 1 — `rand(0,1)` en banda alta, `rand(0,7)` en banda baja |
| + ACID | +1 (`rand_range(0,60)` de 0x3abe) |
| + POISON | +0 |
| + BOMB | +1 **por miembro** con `idx < g_party_size` y estado ≠ `'D'` (0..6) |
| + GAS | +0 |

⇒ **de 1 a 7 tiradas**, no una. Y el rango de la primera cambia con la banda. Cualquier
paridad de stream que apunte «1 rand» se sale de órbita en cuanto salga ACID o BOMB.

---

## 5. (d) CAREO CON EL PORT

### 5.1 La rutina SÍ está portada, y bien

`game/src/core/world/commands.ts:288 chestTrap(location, opener, members, rand)` calca
todo lo de §2 y §3: gate `location > 0x7f`, `TRAP_TYPE_TABLE = [0,0,0,1,1,2,2,3]`, los
cuatro casos, `rand(0,60) >> 1` con el bump a 1, `rand(1,8)` por vivo, y hasta el conteo de
`damageBlips` para el carril de audio. **Cero defectos de mecánica encontrados en ella.**

### 5.2 ★ EL DEFECTO: Mix no la llama

`main.ts:2739` hace `const { correct } = mixSelected(...)` y, si `correct` es falso, **no
hace nada más** — comentario en la línea siguiente: «Reagentes INCORRECTOS: ya se gastaron,
sin carga ni mensaje», y cierra con una cita, 0x1bf6, que es precisamente el offset
donde el original salta A LA TRAMPA: la cita es correcta y la conclusión que le cuelga es
la contraria.

`mix.ts::mixSelected` ¶3 dice lo mismo («los reagentes ya se gastaron, pero NO hay carga ni
mensaje de éxito, 0x1bf6, rama sin "Done!"»).

**No lo arreglo, y el motivo es de régimen, no de derivación:** un fix fiel exige emitir
`\n`, elegir el miembro (§1.1), llamar a `chestTrap` con el stream vivo y publicar mensaje +
sfx. `mixSelected` no recibe ni `rand` ni el roster, así que el cableado cae en el
call-site — **`main.ts`, EMBARGADO post-GO**. Además **mueve el stream de RNG**, que es la
misma razón por la que el carril `mix-flow` no lo hizo. Tarjeta con relevo, §7.

### 5.3 La afirmación falsa vive en TRES capas, no en dos

El encargo citaba `cmds.md §12` y `main.ts:2720`. El censo real:

| sitio | texto | acción |
|---|---|---|
| `re/notes/cmds.md` §12 | «SIN RNG … **0 rand**» | CORREGIDO en esta rama |
| `re/ledger/frontier.json` (rutina CMDS 0x1ad8) | «…acertar la receta [idx+0x1cc0], **0 rand**» | CORREGIDO |
| `re/ledger/frontier-manual.json` (misma cita) | idem | CORREGIDO |
| `game/src/main.ts:2720` | «Mix NO toca RNG.» | **DECLARADA, no tocada** (embargo) |
| `game/src/main.ts:2753` | «→ mixSelected. **SIN RNG**.» | **DECLARADA, no tocada** — 2ª instancia que el encargo no citaba |

### 5.4 ★★ Hallazgo NO pedido: el port se contradice a sí mismo sobre la banda 0x7f

Cuatro sitios del port describen el MISMO gate `location > 0x7f` de dos maneras opuestas:

| sitio | dice |
|---|---|
| `commands.ts` (cabecera de la tabla) | «En **mazmorra** (loc>=0x80): sólo ACID/POISON» |
| `commands.ts` (docblock de `chestTrap`) | «`location` = g_location (>0x7f = **mazmorra**)» |
| `combat.ts:2889` | «(>0x7f **mazmorra** = sólo ACID/POISON)» |
| `dungeon.ts:1035` | «g_location de mazmorra (0x21-0x28) ≤ 0x7f ⇒ TABLA COMPLETA; la restricción a ACID/POISON **sólo aplica en COMBATE**» |

`dungeon.ts` es el que tiene razón, y se apoya en #123 (el original escribe g_location
0x21..0x28 en mazmorra — **por debajo** de la frontera). Los otros tres etiquetan la banda
alta como «mazmorra», que es justo la localización que NO cae en ella. Es la familia de #150
(«el discriminador no es lo que su nombre dice») y de #194 (docblock contradicho por un
hermano). Corregidos los dos de `commands.ts` y el de `combat.ts` (§8); `dungeon.ts` no se
toca porque ya está bien **y** porque colisiona con dos ramas retenidas (§8).

### 5.5 Qué ES la banda alta — medido, y con el límite puesto

Censo de escrituras a `g_location` en los 28 `.asm`: 30 sitios. De los que escriben un
**inmediato**, el único valor > 0x7f es **0xFF**, en cuatro overlays: `BLCKTHRN 0x06fc` y
`0x0951`, `CMDS 0x0332`, `CAST2 0x0ea4`, `DUNGEON 0x00a8`. Y en los tres que he leído
aparece el mismo patrón: **guardar la localización real y poner 0xFF encima**.

- `DUNGEON 0x00a8`, que escribe 0xFF, hace la escena, y en `0x00d8` **restaura** desde `g_unk_5894`.
- `CAST2 0x0ea4`, que copia `g_location` a `[0xbd15]`, pone 0xFF, y acto seguido `g_cmb_actor = 0xFF`.
- `CMDS 0x0332`: al revés — restaura `g_unk_5894` para una llamada y **vuelve a poner 0xFF**,
  o sea 0xFF era el valor en reposo mientras corre ese tramo.

⇒ 0xFF no es un lugar: es **«localización suspendida»** mientras hay una escena encima, con
la de verdad aparcada en otra global. Eso explica que la banda alta reduzca la trampa a
ACID/POISON y respalda a `dungeon.ts`.

**LÍMITE, declarado:** esto acota los inmediatos, **no** los ocho `mov [g_location], al/ah`
del censo, cuyo valor no está acotado por esta medida. Así que digo «el único inmediato
>0x7f es 0xFF», no «el único valor». La etiqueta exacta de la banda es de **#184**, que ya
la tiene abierta; aquí sólo aporto el censo y el patrón, y **no** la cierro.

---

## 6. ★ ERRORES DE LA NOTA PARCIAL, corregidos aquí

### 6.1 El nombre de 0x2a52 que el gate «arregló» estaba RANCIO

La parcial cuenta que escribió `party_member_take_damage` copiándolo de un comentario de
`sfx.ts`, que `seed_gate` la avisó de que pisaba el nombre del ledger, y que lo corrigió a
**`combat_actor_take_damage`**. Ese es el nombre **viejo**: #59 lo renombró a
**`party_char_take_damage`** por lectura de cuerpo (el cuerpo indexa `g_party_records` con
paso 32, no `g_combat_actor_records` con paso 8), y así está hoy en `frontier.json` y en
`frontier-manual.json` con `naming_verified: true`. Lo que quedaba de
`combat_actor_take_damage` son cachés dentro de bloques `kernel_refs` de citas ajenas, no el
registro canónico.

La lección no es «el gate falló» — el gate hizo su trabajo. Es que **un gate que sólo
comprueba colisión no comprueba vigencia**: sacó a la parcial de un nombre inventado y la
dejó en uno superado, y las dos cosas se ven igual desde fuera (verde). Al aceptar la
corrección de un gate de nombres hay que ir al registro canónico, no al primer sitio del
repo donde aparezca la forma que el gate sugiere.

### 6.2 «Exactamente una tirada» era un suelo

Ver §4. La parcial contó las tiradas del cuerpo de 0x2fd0 y no las de sus callees — la misma
figura que la tarjeta denunciaba en `cmds.md §12` (contar el cuerpo y no el callee), repetida
un nivel más abajo. Corregido a 1..7.

---

## 7. LO QUE QUEDA — con dueño

**Tarjeta nueva (#214): cablear la trampa de Mix.** Bloqueada por el embargo de `main.ts` y
por mover el stream de RNG. Todo lo que necesita está derivado aquí: el punto de inserción es
la rama `!correct` de `main.ts:2739`; la secuencia fiel es `putchar('\n')` → elegir el primer
miembro `'G'`/`'P'` (§1.1) → `chestTrap(location, opener, members, this.rand)` → mensaje +
`sfx 'dungeon-trap'`, igual que hacen ya `game.ts:3102` y `dungeon.ts:1065`. Y las dos
declaraciones de `main.ts` (§5.3) se corrigen en el mismo pase.

**Para #184:** el censo y el patrón de 0xFF de §5.5, con su límite.

**Cabo abierto (§1.1):** el retorno ignorado de `party_conscious_state`.

---

## 8. QUÉ SE TOCA EN ESTA RAMA

- `re/notes/cmds.md` §12 (reescrita) y §8 (etiqueta de banda + Mix como tercer caller).
- `re/ledger/frontier.json` y `frontier-manual.json`: la cita «0 rand» de CMDS 0x1ad8.
- `game/src/core/world/commands.ts` y `game/src/core/combat/combat.ts`: **sólo comentarios**,
  la etiqueta de banda de §5.4. Cero valores, cero aserciones, cero mecánica.
- Esta acta, y la cabecera de la parcial marcándola superada.

**Medición de conflicto previa** (obligatoria antes de tocar `game/src`): de todas las ramas
del repo, las únicas que tocan alguno de mis ficheros objetivo son `skin/mobile-preview` y
`skin/movil-cmds-fixes`, y **sólo `dungeon.ts`** — que por eso queda fuera. `commands.ts`,
`combat.ts`, `mix.ts`, `cmds.md` y los dos ledgers: **cero ramas**.

**NO se toca:** `main.ts` (embargo), `dungeon.ts` (colisión), ninguna aserción de test,
`routine-census.json` (prohibido regenerar).

---

## 9. ✅ EL FIX, CABLEADO (carril `mix-trampa`, 2026-08-05)

Levantado el embargo de `main.ts`, se ejecuta el plan de §7. Lo que se hizo y lo que se
midió — **failing-first**, los tres tests escritos y vistos ROJOS antes de tocar el port
(«Cannot read properties of undefined (reading 'result')» ×2 y «expected undefined to be
null» ×1: fallan por FUNCIÓN AUSENTE, no por typo).

### 9.1 Dónde vive el cableado, y por qué NO en `main.ts`

El plan decía «el punto de inserción es la rama `!correct` de `main.ts`». **Se movió, y por
una razón medida:** `Game.rand` es `private` (`game.ts:634`), así que cablearlo en la capa
de UI habría exigido **exponer el stream vivo** — un precio muy alto para ahorrar un método.

| capa | qué hace ahora |
|---|---|
| `core/party.ts::firstConsciousIndex` | kernel **0x39fc**, la mitad del ÍNDICE (`g_cmb_scratch_x`) |
| `core/magic/mix.ts::mixSelected` | mecánica: consumo + carga + **la trampa**; `rand` OBLIGATORIO |
| `core/game.ts::mixReagents` | compone con `this.rand` (stream vivo) y emite los eventos |
| `main.ts` | sólo presenta (`applyEvents`) — dejó de tener mecánica |

### 9.2 🔴 Hallazgo NO pedido: kernel 0x39fc estaba clonado DOS veces, y por mitades

`party_conscious_state` produce **dos cosas** (un retorno 0/1/−1 y un índice en
`g_cmb_scratch_x`) y el port tenía una réplica por cada mitad, en ficheros distintos, sin
que ninguna exportase la otra:

| sitio | mitad que expone | acotación |
|---|---|---|
| `world/blackthorn.ts::partyConsciousState` | el **retorno** | `partySize ?? characters.length` |
| `world/loops/hazards.ts::firstConsciousIndex` (PRIVADA) | el **índice** | `partySize`, tope 6 |

El tercer caller —esta trampa— necesitaba la mitad no exportada. Se añade
`party.ts::firstConsciousIndex` (índice, `min(partySize, MAX_PARTY)`) para **no fabricar una
tercera copia**, y **NO se unifican las dos existentes**: sus acotaciones difieren, así que
tocarlas movería el observable de sus carriles y eso pide su propia medida. Declarado, no
arreglado a escondidas.

### 9.3 🔴🔴 DEFECTO PRE-EXISTENTE EN `chestTrap` — MEDIDO, y NO arreglado aquí

Al buscar cuántas tiradas consume la trampa apareció esto, que **no es mío y afecta a los
tres callers que ya existían**: `chestTrap` recorre `members` ENTERO y **nunca acota por
`g_party_size`**, pero el binario sí (BOMB 0x2aa8 salta si `si ≥ g_party_size`, tope
`si=0..5`; GAS 0x305d recorre 6 y el callee 0x2fa6 filtra por `idx < g_party_size`).

Medido sobre el estado inicial (`partySize = 3`, `characters.length = 16`):

| caso | port | original |
|---|---|---|
| BOMB, tiradas totales | **17** (1 tipo + 16) | ≤ 4 (1 tipo + 3) |
| BOMB, `damageBlips` | **16** | 3 |
| GAS, envenenados | **16 de 16** | 3 |

⇒ el «de 1 a 7 tiradas» de §4 es lo que hace **el original**; el port, hoy, llega a 17.
**Deliberadamente NO se arregla en esta rama**, y el motivo es de método: mover el stream
por DOS causas a la vez (cablear Mix + reacotar `chestTrap`) deja el criterio A/B de los
sellos **sin poder adjudicar cuál de las dos movió cada sello**. Va con tarjeta propia.

### 9.4 Desviación declarada y ACOTADA (el cabo de §1.1)

Si nadie está consciente, 0x39fc no escribe `g_cmb_scratch_x` y `cmd_mix` —que ignora el
retorno— empuja el valor rancio. Esa global no se modela: el port usa el slot 0. **El
alcance está medido, no supuesto:** el índice del que abre **no cambia ni una tirada**
(ACID tira 1 sea quien sea, BOMB tira por miembro vivo, POISON/GAS no tiran), así que la
desviación sólo puede cambiar QUIÉN come el daño, nunca el stream.

### 9.5 El `\n` de 0x1bf6 — lo único de presentación

No se emite como evento propio: en el original cierra la línea de "Mixing…" (que no lleva
`\n`), y en el clon cada `{kind:"message"}` ya ocupa su fila. Inventar una fila en blanco
habría sido fabricar. **Declarado para el espejo**, no adjudicado.

### 9.6 Baterías

`tsc` 0 · motor **5387** · pura **3934** · `re:parity:all` **273 passed** — con el límite
puesto: es el bloque **PURO**; el bloque LIVE contra DOSBox queda fuera sin `U5RE_LIVE=1`.
La puerta de los 5 sellos va aparte (mueve el stream: ver §9.3).

**Censo de colisión, re-hecho sobre las ramas VIVAS de hoy** (el de §8 caducó): `mix.ts`,
`party.ts` y `magic.test.ts` → **cero ramas**; `game.ts` → `re/cama-241`, `re/colas-224`,
`re/loteria-diag`, `skin/mobile-preview`; `main.ts` → `fix/intro-teclas`,
`skin/mobile-preview`. Las dos últimas filas son textuales, no semánticas, pero el
aterrizaje las tiene que ver.
