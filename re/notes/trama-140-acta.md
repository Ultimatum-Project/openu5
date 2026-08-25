# ACTA del carril trama-140 — #140 (planos del HMS Cape) y #148 (cepo/grilletes)

Rama `fix/trama-140`, worktree `.claude/worktrees/trama-140`, desde main `59071846`.
Dos fixes de TRAMA emparejados por perfil: rama muerta con el estado ya modelado (el
género #130). Cero e2e. Gates leídos por separado: `tsc --noEmit` EXIT 0 y `vitest run`
completo desde `game/` EXIT 0 (286 ficheros, 3681 tests, 1 skip).

---

## 1. #140 — Los planos del HMS Cape

### 1.1 El defecto

`apply_item_grant` (SJOG 0x1458) despacha el id de objeto por la jump-table
`cs:[bx-0x2962]`. El id 4 (pergamino) aterriza en **0x15C6**, que abre con
`cmp word ptr [bp+6], 0xff` y tiene DOS salidas. El port portaba **sólo el destino del
`jne`** (0x15DC, «A scroll: <runa>»), así que con quality 0xFF emitía «A scroll: AT!»
(0xff & 7 = 7) y no concedía nada. Es el mismo género que la odd key de #133, a ~90 bytes
en la misma rutina.

```
15c6: 817e06ff00  cmp word ptr [bp + 6], 0xff
15cb: 750f        jne 0x15dc              ← lo único portado
15cd: b8c28c      mov ax, 0x8cc2 ; push ; call 0x58d0
15d4: c606bb57ff  mov byte ptr [g_hms_cape], 0xff
15d9: e99e01      jmp 0x177a
```

**Decodificación de la jump-table** (no estaba escrita en ningún sitio): base
`CS:0xD69E` = file 0x171E con sesgo SJOG 0xBF80; 8 words para ax-1 = 0..7:

| id | 1 | 2 | 3 | **4** | 5 | 6 | **7** | 8 |
|---|---|---|---|---|---|---|---|---|
| destino | 0x1482 | 0x1620 | 0x163c | **0x15C6** | 0x1670 | 0x1670 | **0x1568** | 0x153c |

★ CONTROL POSITIVO de la decodificación: el id 7 sale 0x1568, que es exactamente la rama
keys que el port ya tenía derivada e independientemente citada en `search.ts`. La tabla no
se leyó «a ojo».

**DS 0x8CC2 leída byte a byte** de DATA.OVL (fileoff = DS+0x10):
`b'The plans for the HMS Cape!\n'`.

### 1.2 Alcanzabilidad — medida, no supuesta

`data.json searchObjects[12]` = `{id:4, quality:255, location:21, floor:0, x:15, y:2}` —
East Britanny, The Oaken Oar. **Es el único objeto del juego con quality 0xFF**: la tabla
tiene 21 entradas con id 4 y las otras **20** llevan quality 1..7 (pergaminos de verdad).
Los índices 88/89/90 son pergaminos normales en (13,2)/(14,2)/(16,2) de la misma
estantería, así que la fila de estanterías es el control natural.

Antes de este fix `specialItems.hmsCape` era un **consumidor entero sin productor**: sólo
entraba cargando un .GAM.

### 1.3 El valor tiene que LLEGAR (lección de #133/#130)

El call-site del (G)et ya pasa `quality` crudo a `lootItemName` (lo arregló #133 para la
odd key), así que el nombre estaba servido. Lo que faltaba era el **grant**:
`applySearchGrant` recibe `{id, quality}` sin enmascarar y ahora tiene la rama
`tile === 0x104 && quality === 0xFF → specialItems.hmsCape = true`. Hay un test por cada
lado (nombre y grant) **más** el ciclo entero a nivel `Game` (Search → objeto visible →
Get), que es el único que prueba que los dos cuelgan del mismo valor.

### 1.4 Fichero tocado y prosa auto-infiel

- `game/src/core/world/commands.ts` — `lootItemName` case 4 partido en las dos ramas;
  `LOOT_GRANT_STRINGS.hmsCapePlans` (allowlist DISPLAY_CONSTS, mismo patrón que
  `sandalwood`: un `return` de switch no es sink del barrido AST).
- `game/src/core/world/search.ts` — la rama del grant + **la prosa corregida**. Decía:
  *«Sólo el ItemKey está portado»* (falso: la moonstone también, y ahora los planos) y
  *«Devuelve la cantidad concedida (para la línea del (G)et, lootItemName) […]
  lootItemName lo ignora ("An item!")»* — un contrato que **ya no existe** desde #133,
  porque el (G)et nombra con el `quality` crudo, no con el retorno.

### 1.5 ★ CITA EQUIVOCADA encontrada de paso (dos sitios)

El comentario del case 4 y la entrada `"A scroll: {}!"` de `approved-strings.json` citaban
**DS 0x8CF0** como «A scroll: » y **0x8CFC** como el sufijo «!». Leído de DATA.OVL:

| DS | contenido real |
|---|---|
| 0x8CE0 | `'A scroll: '` ← el bueno |
| 0x8CEC | `'!\n'` ← el bueno |
| 0x8CF0 | `' gold!\n'` (rama id 2) |
| 0x8CFC | `' potion!\n'` (rama id 3) |

Las dos citas apuntaban a las cadenas de **otras ramas de la misma rutina**. Corregidas en
ambos sitios.

### 1.6 ADJUDICACIÓN del byte de dos significados (el encargo (c))

**Censo completo de `g_hms_cape` (DS 0x57BB) en los 25 binarios: 5 accesos, y sólo DOS
escriben.**

| offset | acceso | papel |
|---|---|---|
| SJOG 0x15d4 | `mov byte ptr [g_hms_cape], 0xff` | **escritor** — el (G)et de los planos |
| CAST 0x1a86 | `or byte ptr [g_hms_cape], 0x80` | **escritor** — el (U)se a bordo |
| MAINOUT 0x0670 | `cmp byte ptr [g_hms_cape], 0x7f` / `jbe` | lector — coste de paso naval |
| MAINOUT 0x0696 | `cmp byte ptr [g_hms_cape], 0x80` / `jae` | lector |
| ZSTATS 0x0a0a | `cmp byte ptr [g_hms_cape], 0` | lector — posesión |

**Conjunto alcanzable.** Partiendo de 0x00: `mov 0xFF` → 0xFF; `or 0x80` sobre 0xFF → 0xFF;
`or 0x80` sobre 0x00 → 0x80. ⇒ **{0x00, 0xFF} y a lo sumo 0x80**. Ningún escritor puede
producir **0x01..0x7F**. Sobre ese conjunto, «!=0» (posesión) y «>=0x80» (aparejado) son
**el mismo predicado**.

★ Y hay un segundo argumento independiente: **ZSTATS 0x0a0f normaliza el byte él mismo** —
`cmp [g_hms_cape],0 / je → al=0 / else al=0xFF / mov [0xba0f],al`. El propio original
colapsa el byte a booleano antes de exponerlo al panel/picker.

**VEREDICTO: el colapso booleano del port es EXACTO, no una aproximación**, y
`navalStepCost` leyendo posesión **no es una divergencia**. La tarjeta suponía que
divergían; divergen sólo ante un valor que el juego no puede escribir. Se documenta el
colapso + **detector**: `hmsCapeByteIsUnreachable(b)` en `saveNative.ts` marca la banda
0x01..0x7F, cuya única entrada posible es un .GAM ajeno o editado a mano. No se cablea a
la carga porque ese módulo no tiene canal de avisos y no me invento uno.

★ **Hallazgo lateral sobre el JUEGO**: como el (G)et escribe 0xFF (≥0x80), la fragata queda
a doble velocidad **en el momento de recoger los planos**; el `or 0x80` del (U)se es un
no-op sobre un byte que ya vale 0xFF, y «Ship rigged for double speed!» (DS 0x49C2) es
presentación, no mecánica. El gate de posesión del (U)se vive aguas arriba (el picker se
alimenta del 0x00/0xFF normalizado de ZSTATS); dentro de CAST 0x1a76 el único gate es
`g_transport_tile & 0xf8 == 0x20` (estar a bordo), con DS 0x49E1 «Only usable on
shipboard!» en el else.

### 1.7 Hueco declarado, NO tocado

Las **20** entradas id-4 con quality 1..7 son alcanzables por (S)earch y `applySearchGrant`
sigue sin acreditarlas en `scrollQuantities` — es el hueco **O3** ya declarado en
`deliberate-divergences.md`. Fuera del alcance de la tarjeta; queda medido (20 entradas)
por si alguien lo quiere cerrar.

---

## 2. #148 — Cepo/grilletes: la tercera familia del (J)immy

### 2.1 El defecto

`(J)immy` (SJOG 0x0D4A) despacha TRES familias por el tile (0x0daa-0x0dc4): puertas
0xB9/0xBB → 0x0DC8, cerraduras mágicas 0x97/0x98 → 0x0E1C, y **cepo/grilletes 0x84/0x85 →
0x0E22**. El port TENÍA la lógica (`jimmyLock` case "prisoner", bien derivada y citada)
pero `Game.jimmy()` sólo despachaba 'door'/'magic': Stocks/Manacles caían al else
«No lock!». Lógica sellada, cableado cero — tercera instancia del género #130.

### 2.2 Los tres gates (dos de la tarjeta + el que quedaba abierto)

**GATE 1 — ocupante (0x0E22-0x0E3F).** `cmp [g_location],0x80 / jae 0xe42` salta el chequeo
en mazmorra; en pueblo `call 0x770e(x, y, floor)` y con 0 imprime «No one is there!\n»
(DS 0x8AFE) y retorna por 0x0d70 — **sin la tirada de 0x0E54 y sin tocar g_keys**.

★ `0x770e` = **ULTIMA.EXE 0x368E** (resuelto con `verify_cites.py resolve SJOG.OVL 0x770e`).
Barre `g_world_objects` (0x5C5A, stride 8, 32 slots: +0 tipo, +2 x, +3 y, +4 z) y **escribe
el índice de slot encontrado en g_cmb_scratch_x (0x5876)** — `mov [0x5876],dx` @0x36D8. Es
un **out-param**, y sin verlo el flujo no se entiende: 0x5876 venía siendo el delta de
dirección (0x0d87 lo suma a g_party_x) y 0x770e lo **pisa** con el slot, que es lo que
0x0E42 recoge en `[bp-2]` para pasárselo al resolutor de NPC.

**GATE 2 — resolución del NPC (0x0E7D-0x0E8C, sólo pueblo).** `call 0xffffbb9e` = stub
kernel **0x7B1E** → **TOWN.OVL 0x011E `find_npc_by_objIdx`** (SJOG es banda 3,
`near_call_base` 0xBF80; `dispatch_table.stubs()`). Compara el campo **+0x0C** de
`g_npc_rt` (0x5F5E, stride 0x10) contra el slot-objeto; 0xFFFF → «Couldn't find this
npc\n\n» (DS 0x8B1C) y **retorno sin karma**.

**GATE 3 — el que la tarjeta dejaba abierto: `call 0xffffbb7a` @0x0EA7.** Resuelve a stub
**0x7AFA → TOWN.OVL 0x0000**, que el ledger ya tenía **verificada cuerpo a cuerpo** como
`npc_dead_bit_test`: lee el bit `1 << slot` de la máscara de 32 bits
`[0x5B56 + g_location*4]` = **el bitmap npcDead** (SAVED.GAM 0x5B4 = `state.npcDead`). Si
el bit YA está puesto (`jne 0xeda`) se saltan el agradecimiento, el karma y los tres bytes
de horario: **es el anti-farmeo**. Y 0x0EDD llama a `0xffffbb86` = TOWN.OVL 0x0052
`npc_dead_bit_set` **en ambos caminos** → el slot queda consumido.

★ CONTROL POSITIVO de que ese par es el bitmap npcDead y no otra cosa: la rama de la
**CORONA** (SJOG 0x16E6) usa exactamente las mismas dos llamadas para retirar su slot del
.NPC tras el (G)et. Y el censo de llamantes en los 25 binarios da: el **test** tiene UN
solo call-site en todo el corpus (este), el **set** tiene cuatro (SJOG 0x0EDD, SJOG 0x16F9,
CMDS 0x0D7C, TALK 0x091A).

### 2.3 Efecto, turno y RNG

- **Efecto por localización** (0x0E76 `cmp [g_location],0x7f` / jae): ≥0x7F → 0x0EE4 escribe
  tile 0x44 + «Unlocked!\n» (DS 0x8B48); si no, libera al NPC (limpia el dialogNumber
  `[npc*16+0x5F68]`, la infraestructura de #130, y karma +2 con `add_capped` a 0x63).
- ★ **Los dos umbrales NO son el mismo**: el ocupante usa **0x80** y el efecto **0x7F**.
  En `loc == 0x7f` se comprueba el ocupante pero se libera como en mazmorra. (En esa rama
  `[bp-2]` lleva el delta rancio, pero nunca se usa: no hay bug.)
- **TURNO**: la rama de mazmorra marca turno consumido (0x0EF2 `or [g_unk_24e6],2`); la de
  **PUEBLO no** — en 0x0E90-0x0EDD no hay ningún `or [g_unk_24e6],2`. El fallo tampoco
  (igual que la puerta). Portado tal cual.
- **RNG — impacto de stream declarado**: `rand(0,29)` @0x0E54, **UNA** tirada, **convergente**
  para pueblo y mazmorra (el gate de 0x0E22 sólo se salta el chequeo de ocupante, no la
  tirada). Antes de este cableado estos tiles consumían **CERO**. ⇒ toda partida que haga
  (J)immy sobre un cepo desplaza el stream un paso respecto a main. La ruta del gate 1
  («No one is there!») sigue consumiendo cero, y eso también es fiel.

### 2.4 Divergencias declaradas (no disimuladas)

1. **Los gates 1 y 2 COLAPSAN en el clon.** En el binario son dos consultas encadenadas
   sobre la MISMA tabla 0x5C5A. El clon parte esa tabla en dos capas (`worldObjects` y
   `NpcManager`) y, encima, un `worldObject` **sobreescribe el tile compuesto**: una
   casilla con objeto encima ya no lee 0x84/0x85 y ni siquiera entra al (J)immy de cepo.
   ⇒ el único ocupante que un cepo puede tener en el clon es un NPC, y la rama de
   «Couldn't find this npc» queda **estructuralmente inalcanzable**. Se porta igualmente
   (es el comportamiento derivado), pero **nadie la lea como cubierta**. Hay un test que
   SELLA el colapso en vez de fingir que lo cubre.
2. **El gate 3 es defensivo.** `NpcManager.enterMap` ya filtra los slots con npcDead
   puesto, así que por la vía normal un prisionero marcado no existe como runtime y caería
   antes en el gate 2. Se porta porque es lo derivado, no porque haga falta hoy. El test lo
   fuerza poniendo el bit **después** del spawn, y lo dice.
3. **La COMILLA LITERAL sigue puesta.** El binario imprime `'\n"I thank thee!"\n'`
   (DS 0x8B36, con comillas y saltos) y el port emite `"I thank thee!"`. Es un caso del
   género de la tarjeta **#142**, y **no lo toco**: el mensaje es preexistente y arreglarlo
   aquí alteraría en silencio la población que #142 está censando. Lo que SÍ cambia es que
   antes esa cadena era código muerto y ahora es **alcanzable** ⇒ el defecto pasa de latente
   a visible. Para #142.

### 2.5 Ficheros tocados

- `game/src/core/game.ts` — despacho de 0x84/0x85 en `jimmy()` + método nuevo
  `jimmyPrisoner()` con los tres gates y el docblock de derivación.
- `game/tests/jimmy-prisoner.test.ts` — 10 tests, failing-first **por gate**.

★ Los tests de éxito se escribieron primero con DEX 20 y un `if (!msgs.includes(...)) return`
para el caso de tirada perdida: **cuatro tests que se auto-anulaban** (verdes sin comprobar
nada). Reescritos con DEX 30 (`dex > rand(0,29)` siempre cierto) y DEX 0 (siempre falso)
para que sean deterministas y sin condicionales.

---

## 3. Cadenas que SALEN de huérfanas — para quien re-censa

`re/ledger/orphan-strings.json` **NO** se ha editado (el estado:RESUELTO lo pone otro).
Al cablear estos dos flujos, las cadenas quedan así:

| cadena | DS | estado tras este carril |
|---|---|---|
| `The plans for the HMS Cape!\n` | 0x8CC2 | **EMITIDA** — `lootItemName(4, 0xFF)` |
| `No one is there!\n` | 0x8AFE | **EMITIDA** — gate 1 de `jimmyPrisoner` |
| `\n"I thank thee!"\n` | 0x8B36 | **EMITIDA** (con la salvedad de la comilla, §2.4.3) |
| `Couldn't find this npc\n\n` | 0x8B1C | **SIGUE HUÉRFANA** — rama portada pero inalcanzable (§2.4.1) |

⚠ El port emite las formas **sin el `\n` final** (convención de `lootItemName`/`jimmyLock`;
el salto lo pone el impresor, #108). El detector normaliza espacios (`re.sub(r"\s+"," ").strip()`)
así que las tres casan igual.

### 3.1 ★ GATE ROJO, con baseline medida — decisión del lead

`re/tools/test_detect_orphan_strings.py::test_ningun_hueco_VIVO_puede_estar_fuera_del_censo`
falla en esta rama. **Medido en un worktree PRISTINO de main `59071846`, no supuesto:**

| dónde | entradas que fallan |
|---|---|
| main `59071846` (pristino) | **2** — `'\nEnjoy!"'`, `'\nEnjoy!"\n\n'` |
| `fix/trama-140` | **5** — las 2 anteriores **+** `The plans for the HMS Cape!\n`, `No one is there!\n`, `Couldn't find this npc\n\n` |

⇒ **El gate YA ESTABA ROJO antes de tocar nada**; las 2 de `Enjoy!` son cola del carril
enjoy-146 y no son mías. Mi delta son **3**, y son exactamente el efecto esperado de
cablear los dos flujos: el detector marca «etiquetada hueco-del-port pero el port ya la
emite; añade `estado: RESUELTO` + `resuelto_por`».

**NO he editado `orphan-strings.json`** porque el encargo lo prohíbe explícitamente
(«estado:RESUELTO lo pone otro»). Queda para quien re-censa, con el dato que el propio
gate pide y que no se puede saber hasta que la rama aterrice: `resuelto_por` = **el hash
del merge de `fix/trama-140`**.

⚠ Matiz que hay que leer antes de marcar la tercera: `Couldn't find this npc\n\n` aparece
como «emitida» sólo porque el **literal existe** en `game.ts`; la rama que lo imprime es
**inalcanzable** hoy (§2.4.1). Marcarla RESUELTA sería registrar una cobertura que no hay.
Mi recomendación: RESUELTO para las dos primeras y una etiqueta propia (o seguir como
hueco, con nota) para ésta.

**i18n**: `es.json` tenía la clave CRUDA `'The plans for the HMS Cape!\n'`; se ha añadido la
**trimada** `'The plans for the HMS Cape!'` (la que emite el port), que es la convención ya
existente para `Unlocked!`/`Key broke!`/`No Keys!` — el corpus lleva **ambas** formas.
`'I thank thee!'` y `'Unlocked'` ya estaban. Faltan `'No one is there!'` y
`"Couldn't find this npc"` en su forma trimada (ver §4).

---

## 4. Cabos para el lead (NO arreglados aquí)

1. ★ **Fuga de inglés de #133**: las plantillas `'{} odd key!'` y `'{} odd keys!'` que
   introdujo `de4996aa` **no están en es.json**. Bajo `lang=es` la línea de la skull key de
   Trinsic sale en inglés. Es cola de #133, no de esta tarjeta; 2 claves.
2. `'No one is there!'` y `"Couldn't find this npc"` (formas trimadas) tampoco están en
   es.json — mismas dos líneas de trabajo que el punto 1. Las crudas con `\n` sí están.
3. El hueco **O3** medido: 20 entradas id-4 de `searchObjects` conceden pergamino y el port
   no las acredita (§1.7).
4. `0x5B56` no tiene nombre en `re/ledger/globals.json` pese a estar verificada su pareja de
   accesores; candidata a `g_npc_dead_bitmap`.
