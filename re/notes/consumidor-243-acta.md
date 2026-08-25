# ACTA #243 — la vía del CONSUMIDOR sobre los supervivientes verbatim de #236

> Rama `re/consumidor-243`, worktree `.claude/worktrees/consumidor-243`, base **main `a140f19d`**.
> Sucesora de #236 (acta `re/notes/instr-236-calibracion.md`, en main `5c69bd43`), que MIDIÓ Y
> DESACONSEJÓ la vía mecánica sobre notación.

---

## 0. PRE-REGISTRO (escrito ANTES de reconstruir la cola y ANTES de leer un solo par)

### 0.1 ★ La cola de #236 NO está enumerada en ninguna parte — hay que RECONSTRUIRLA

Primer hallazgo del carril, y condiciona todo lo demás. El acta de #236 describe sus 34
supervivientes (§4.quinquies: «VERBATIM 111 · PARÁFRASIS 33 · SUPERVIVIENTES 34») pero **no los
lista**, y su §5 declara explícitamente *«No ha cableado nada en `re/tools/`»*: el commit
`5c69bd43` toca **un solo fichero**, el acta. La rama `re/instr-236` ya no existe. Verificado:

```
git show --stat 5c69bd43  →  re/notes/instr-236-calibracion.md | 10 ++++++++++
git branch -a | grep 236  →  (vacío)
```

⇒ El instrumento de #236 **no es recuperable**. La cola priorizada que el encargo me manda leer
hay que re-derivarla desde su acta, que sí describe el criterio con precisión suficiente.

**Esto NO es construir un instrumento nuevo** (el encargo lo prohíbe, y con razón): es
regenerar una LISTA DE LECTURA. El juicio de esta tarjeta no lo emite ningún predicado
mecánico — lo emito yo leyendo el disasm. El script sólo dice QUÉ leer.

### 0.2 CONTROL DE RECONSTRUCCIÓN, declarado antes de correrlo

La reconstrucción se considera fiel **sólo si reproduce las cuatro cifras publicadas por #236**:

| magnitud | cifra de #236 | reproducida |
|---|---|---|
| población (cita entrecomillada en la misma línea) | **146** | se rellena en §1 |
| VERBATIM | **111** | se rellena en §1 |
| PARÁFRASIS (no comparables) | **33** | se rellena en §1 |
| SUPERVIVIENTES | **34** | se rellena en §1 |

Si NO cuadran, la cola que lea **no es la de #236** y hay que declararlo en el titular: sería
una cola *parecida*, y las cifras de #236 no se le pueden pegar encima. No se ajusta el script
hasta que cuadre por prueba y error sobre el resultado — se declara la discrepancia y se lee lo
que salga, diciendo qué es.

### 0.3 PREDICCIÓN PRE-REGISTRADA — cuántas MIS-ATRIBUCIONES REALES de los 34

Registro ÍTEMS y criterio, no sólo una cifra (regla del repo: una cifra sola cuadra por
casualidad).

**Predigo: entre 2 y 6 mis-atribuciones reales de los 34.**

Razonamiento explícito, para que se pueda auditar el razonamiento y no sólo el número:
- #236 catalogó SEIS familias benignas y cada pasada suya descubría otra ⇒ la tasa base de
  «benigno» en esta cola es alta, y la mayoría de los 34 serán convenciones más.
- Pero el caso fundacional (`docblock-194b`, `MAINOUT.OVL:0x04d0` → `OUTSUBS.OVL:0x04d0`)
  demuestra que la clase EXISTE y produjo al menos un ejemplar real en este repo.
- La vía del consumidor mira SEMÁNTICA, así que puede cazar mis-atribuciones que la vía de la
  grafía dejaba pasar (ej.: cita correcta de instrucción, semántica atribuida falsa).

**CONDICIÓN DE FRACASO, escrita antes de leer:**
- Si salen **0**, se publica **0** — con las convenciones nuevas catalogadas, y sin re-encuadrar
  el cero como «los 34 están limpios» (T1/T2 de #236 eran «no desmentidos», nunca «absueltos»).
  Reserva de #236 heredada: **cero cifras infladas**.
- Si salen **más de 10**, sospecho de mí mismo antes que del corpus: significaría que mi lectura
  está clasificando como mis-atribución lo que es una séptima convención, y el acta tiene que
  enseñar los ejemplares uno a uno antes de que nadie se crea la cifra.

### 0.4 MATERIAL HEREDADO que uso y NO re-mido

- Taxonomía por convención de offset: **entrada de rutina** (`push bp`) ⇒ ámbito = la rutina;
  **offset interior** ⇒ ámbito = ventana de 4 instrucciones.
- Las **6 familias** de #236 como stoplist (entrada-de-rutina · mnemónico-palabra-inglesa ·
  mnemónico desnudo · near-call sin resolver · placeholder-como-registro · `push CONST` ·
  operandos incompletos).
- Conversión canónica de near-call: `dispatch_table.overlay_near_call_base`. El comentario puede
  llevar el operando CRUDO y el disasm el RESUELTO — **eso NO es mis-atribución** (familia #173).

---

## 1. RECONSTRUCCIÓN de la cola — el control declarado en §0.2, ADJUDICADO

| magnitud | #236 | reconstruido | |
|---|---|---|---|
| citas totales del extractor | 2021 | **2032** | deriva de main (base distinta), esperada |
| población (cita entrecomillada en la misma línea) | 146 | **144** | dentro de la deriva |
| VERBATIM | 111 | **110** | dentro de la deriva |
| PARÁFRASIS (no comparables) | 33 | **34** | dentro de la deriva |
| SUPERVIVIENTES | 34 | **51** | ★ **FUERA de la deriva** |

★ **DECLARADO, y no lo ajusto a ojo hasta que cuadre**: mi comparación es MÁS ESTRICTA que la de
#236, y la causa está identificada y medida abajo (§3, familia F8: la elisión de `byte ptr` /
`word ptr`). #236 evidentemente la normalizaba y yo no. **No he tocado el criterio para aterrizar
en 34** — eso sería ajustar el instrumento contra la cifra que quiero, que es justo el vicio que
#236 documentó. Leo los 51.

**Es la MISMA población**, no una cola parecida: los ejemplares que #236 nombra por su nombre
salen todos en mi lista — el `or byte ptr [si-0x45ea],4` de §4, los `sub [g_gold]`, el
`cmp raw,0xb0`, los `push` de constante, el `call 0x2f32` y el `call 0xdcae` de §4.quinquies.
Mis 17 de más son un SUPERCONJUNTO por notación, no una cola distinta.

---

## 2. ★★ EL RESULTADO — 51 de 51 adjudicados, **CERO mis-atribuciones reales**

| veredicto | n |
|---|---|
| **MIS-ATRIBUCIÓN REAL** (offset o semántica equivocados) | **0** |
| **CITA CORRECTA** con convención de citación no enumerada | **49** |
| **CITA CORRECTA con defecto de NOTACIÓN** (grafía que nombra una instrucción inexistente) | **2** |
| SIN-DERIVAR | 0 |

**Mi predicción de §0.3 (entre 2 y 6) FALLA**, y falla a la baja. Aplico la cláusula que escribí
antes de leer: **se publica 0**, con las convenciones nuevas catalogadas, y **sin** re-encuadrar
el cero como «el corpus de citas está limpio». Lo que está medido es más estrecho y se dice en §5.

### 2.1 Por qué el cero es un cero CON DIENTES y no la ceguera de #236 §2.3

El fallo que hundió a #236 fue publicar un cero producido por un predicado incapaz de disparar.
Aquí el juez no es un predicado: **soy yo leyendo el disasm**, y el cero se apoya en verificación
POSITIVA par a par, no en la ausencia de una señal. Las comprobaciones que SÍ podían haber salido
mal y no salieron:

- **Cinco conversiones de near-call**, todas recalculadas con `dispatch_table.overlay_near_call_base`
  y todas cuadrando con el destino que el propio comentario declara:
  `0xb680`+`0xa290` → `0x5910`, `0xbd12`+`0xbf80` → `0x7c92`, `0x8482`+`0xbf80` → `0x4402`,
  `0x7b9c`+`0xbf80` → `0x3b1c`, `0x3ee8`+`0xe1e0` → `0x20c8`, `0x2f32`+`0xe1e0` → `0x1112`.
- **Cinco stubs PLINK86 resueltos** con `dispatch_table.stubs()`, y los cinco aterrizan donde el
  comentario dice: `0x7f3e` → SJOG.OVL 0x006c · `0x7c92` → DUNGEON.OVL 0x1c6a ·
  `0x808e` → CAST2.OVL 0x00de · `0x7d9a` → COMSUBS.OVL 0x0094 · `0x7fda` → SHOPPES.OVL 0x019a.
- **Una afirmación CONTABLE reproducida a ciegas**: `shop-console.ts:1183` afirma «11 call-sites
  (5 en SHOPPES.OVL + 4 en SHOPPES2 + 2 en SHOPPES3)» de la merma. Censado de nuevo: **5 · 4 · 2,
  total 11**. Exacto.
- **Una afirmación NEGATIVA verificada sobre el cuerpo entero**: el mismo comentario sostiene que
  el rumor del tabernero (SHOPPES2.OVL 0x0508) hace `sub [g_gold]` y **NO** llama a la merma.
  Recorrida la rutina entera (142 instrucciones, 0x0508..0x066b): `sub word ptr [g_gold], ax` en
  0x0611, y **ningún** `call 0xffff9dfa` en todo el cuerpo. La afirmación negativa se sostiene.
- **Dos aritméticas de contenido**: el `xor byte ptr [0x67b9], 0xb` del clavicémbalo — 0x4F ^ 0x0B
  = 0x44, el muro se vuelve el suelo que el comentario declara. Y el eje de `tile_addr`: el ÚLTIMO
  push del call-site MAINOUT.OVL 0x06fe es `g_party_y`, luego cae en `[bp+4]`, luego la fórmula es
  `(y<<5)+x` — que es lo que el comentario deriva y lo contrario de lo que publicaba la nota
  heredada que él mismo corrige.

Si el corpus tuviera mis-atribuciones de esta clase, estas diez comprobaciones eran el sitio
donde aparecían.

---

## 3. ★ LAS CUATRO CONVENCIONES NUEVAS (las familias 7-10, que #236 no tenía)

Son el producto reutilizable del carril: documentan cómo cita de verdad este repo.

### F7 — MULTI-PAR EN LA MISMA LÍNEA (la dominante: ~20 de 51)

**La línea nombra DOS o más offsets, y la instrucción entrecomillada pertenece a uno DISTINTO del
que el extractor emparejó.** El comentario declara la atribución correcta con todas las letras; es
el extractor —que empareja por línea— quien cruza los cables.

Ejemplar limpio, `combat.ts:166`: la línea dice que el flag lo ENCIENDE COMSUBS.OVL 0x03e0 con
`or byte ptr [si-0x45ea],4` y lo LEE la cabecera de turno de COMBAT.OVL 0x07d7. El par que sale es
(COMBAT.OVL 0x07d7 ↔ la instrucción `or`), y en 0x07d7 hay un `test`. Parece mis-atribución y no lo
es: en COMSUBS.OVL 0x03e0 está el `or` **verbatim**, y en COMBAT.OVL 0x1cc9 el `and ...,0xfb` que el
mismo comentario cita como el que lo apaga. Los tres sitios existen y hacen lo que dice.

⇒ **Regla para cualquier instrumento futuro**: emparejar por línea NO es emparejar. Con dos offsets
en la línea, la atribución hay que leerla de la PROSA, no de la proximidad.

### F8 — ELISIÓN DE `byte ptr` / `word ptr` (~17 de 51, y es la que explica 51 contra 34)

El comentario escribe `mov al,[bx+0x385e]` y el disasm imprime `mov al, byte ptr [bx + 0x385e]`.
Misma instrucción, mismo offset, misma semántica. Es NOTACIÓN, y es la fuente entera de mi delta
con #236.

### F9 — CITA FUSIONADA de dos instrucciones (2 de 51) — la única grafía que ENGAÑA

El comentario toma el mnemónico de una instrucción y el operando de su vecina, y el resultado
nombra una instrucción que **no existe en el binario**. Los dos ejemplares:

| dónde | dice | el binario tiene | por qué engaña |
|---|---|---|---|
| `core/game.ts:422` | `jge 0x80` | `cmp word ptr [bp-2], 0x80` en TALK.OVL 0x0396 + `jge 0x3a6` en 0x039b | 0x80 es el valor COMPARADO, no el destino del salto; quien lo lea busca un salto a 0x80 y no lo hay |
| `core/quest/lordbritish.ts:30` | `imul 0x1e` | `mov ax, 0x1e` en OUTSUBS.OVL 0x0712 + `imul dx` en 0x0715 | el 8086 no tiene `imul` de inmediato ahí; el 0x1e llega por `ax` |

**En los dos casos la SEMÁNTICA es correcta** (la cota de mercaderes es 0x80 y el multiplicador de
HP es 30), y por eso NO son mis-atribución y no los corrijo en sitio: el encargo reserva la
corrección para la mis-atribución real. Quedan **declarados**, con propuesta de tarjeta en §6.

### F10 — CITA AL OFFSET DEL BLOQUE (4 de 51)

Hermana de la familia entrada-de-rutina de #236, pero para cabeceras que **no** son prólogo: el
offset nombra el arranque de un bucle o de un bloque que el propio comentario delimita
(«FONT.OVL 0x0651-0x0674», «SHOPPES.OVL 0x0546-0x064b»), y la instrucción citada cae unas pocas
más abajo, DENTRO de ese rango declarado.

### Las SEIS de #236, todas re-avistadas y ninguna refutada

entrada-de-rutina (7 casos) · `push CONST` (5) · near-call sin resolver (5) ·
placeholder-como-registro (1, el `cmp raw,0xb0` de la gema) · operandos incompletos (9, casi todos
`sub [g_gold]`) · mnemónico desnudo y mnemónico-palabra-inglesa (0 aquí: los filtra mi M4).

---

## 4. ★ EL VEREDICTO SOBRE EL MÉTODO — la vía del consumidor SÍ converge

#236 cerró con dos predicciones fallidas en la misma dirección y **sin señal de convergencia**: cada
regla nueva subía la precisión un poco y destapaba otra familia. La vía del consumidor se comporta
al revés:

- **51 de 51 con veredicto definitivo. Residuo cero.** No queda ni un par en «no lo sé».
- Las familias nuevas aparecen, pero **ya no cambian el veredicto**: son explicaciones de por qué
  la GRAFÍA difiere, y la lectura del cuerpo resuelve el caso igual.
- El coste real fue ~1 tanda, como la tarjeta estimaba.

⇒ La diferencia no es de esfuerzo: es que **la grafía de la cita es un lenguaje informal y el
cuerpo de la rutina no**. Preguntarle al consumidor tiene respuesta; preguntarle a la notación, no.

★ Y el resultado de fondo, que es el que importa para el port: **en la cola donde ningún filtro
benigno explicaba la discrepancia, el corpus de citas de docblock resultó semánticamente sólido**.
No es que las citas se parezcan a lo que hay en el binario — es que la instrucción estaba, verbatim,
en el offset que el comentario le atribuye, incluso cuando ese offset no era el que el extractor
había emparejado.

---

## 5. LO QUE ESTE CARRIL **NO** ESTABLECE (la reserva, y va antes que el titular)

- **No es «todas las citas del port son correctas».** Lo medido son 51 pares de los 110 verbatim.
  Los ~60 verbatim que CASABAN nunca fueron sospechosos y **no los he leído**: siguen siendo «no
  desmentidos por el predicado», que es la advertencia simétrica que el lead impuso a #236, y no
  una absolución.
- **Las 34 PARÁFRASIS siguen FUERA DE ALCANCE.** Una paráfrasis también puede mis-atribuir; este
  carril tampoco puede juzgarlas, exactamente igual que #236.
- **No he tocado `game/src`.** Cero correcciones en sitio, porque no hubo mis-atribución que
  corregir. Los 2 defectos de notación de F9 quedan declarados, no editados.
- **No he cableado nada en `re/tools/`.** El script de reconstrucción vive en el scratchpad y su
  único producto es la lista de lectura; el juicio es humano y está en este acta.
- **Mi reconstrucción no es byte-idéntica a la de #236** (51 contra 34) y el acta lo dice en §1 en
  vez de esconderlo detrás de la cifra de #236.

---

## 6. CABOS (con dueño propuesto, ninguno adjudicado aquí)

1. **`0x5bca` — el ledger se come una dirección que no le consta.** `CAST.OVL 0x171d` es el
   **único** acceso a esa dirección en TODO el desensamblado (censado por hex y por símbolo), y es
   la escritura del bit de doom al destruir un Shadowlord. El disasm la imprime como
   `g_npc_dead_bitmap+112` sólo porque el ledger declara esa entrada con `size=128`
   (0x5b5a..0x5bd9) y 0x5bca cae dentro. El comentario de `state.ts:290` la llama «bitmap de doom
   de trama» y **no está desmentido**: no hay ni un acceso más que respalde que ese word pertenezca
   al bitmap de NPC muertos. Emparenta con #252 y con el alta pendiente de #160.
2. **La premisa `ah=0` de `cmp [g_keys], ah`** (`world/search.ts:238`, SJOG.OVL 0x055d). La cita es
   exacta; la afirmación de que el registro vale 0 exige flujo de datos más allá de la ventana y
   **no la he verificado**. El comentario ya se auto-marca Clase C ahí.
3. **Los 2 defectos de notación de F9** (§3): `jge 0x80` y `imul 0x1e`. Arreglo de una palabra cada
   uno, con la derivación ya escrita arriba; toca `game/src` ⇒ gates de suite.
4. **La elisión de `byte ptr` (F8) merece entrar en la stoplist** de cualquier comparador futuro de
   citas, antes que ninguna regla nueva: sola explicaba 17 de mis 51 supervivientes.

---

## 7. ANEXO — los 51 pares, uno a uno

Familias: **F1** entrada-de-rutina · **F2** `push CONST` · **F3** near-call sin resolver ·
**F4** placeholder-como-registro · **F5** operandos incompletos (las cinco de #236) · **F7**
multi-par en la misma línea · **F8** elisión de `byte ptr` / `word ptr` · **F9** cita fusionada
(defecto de notación) · **F10** cita al offset del bloque (las cuatro NUEVAS).

| # | par | cita | dónde lo afirma el port | familia | nota |
|---|---|---|---|---|---|
| 1 | `COMBAT.OVL` 0x07d7 | `or byte ptr [si-0x45ea],4` | `core/combat/combat.ts`:166 | F7 | el `or` vive en COMSUBS.OVL 0x03e0, verificado; 0x07d7 es el `test` que el comentario le asigna |
| 2 | `DNGLOOK.OVL` 0x1281 | `mov al,[bx+0x385e]` | `core/combat/combat.ts`:306 | F8 |  |
| 3 | `ULTIMA.EXE` 0x5910 | `call 0xffffb680` | `core/combat/combat.ts`:439 | F7·F3·F1 | `0xb680`+`0xa290` = 0x5910, el destino que el comentario declara |
| 4 | `CAST2.OVL` 0x0594 | `cmp [bp+4],0; jne 0x5c0` | `core/combat/combat.ts`:2583 | F8 |  |
| 5 | `COMBAT.OVL` 0x0418 | `cmp [g_time_spell],0x54 / jmp 0x540` | `core/combat/combat.ts`:3051 | F8 |  |
| 6 | `COMSUBS.OVL` 0x0822 | `or ax,ax; jl 0x21c` | `core/combat/combat.ts`:3291 | F7·F1 |  |
| 7 | `COMBAT.OVL` 0x120e | `call 0x9cb6` | `core/combat/formulas.ts`:319 | F7·F1 |  |
| 8 | `SJOG.OVL` 0x0672 | `call 0xdcae` | `core/dungeon/dungeon.ts`:544 | F7·F3 | stub `0x7f3e` → SJOG.OVL 0x006c = el MISMO callee que el otro call-site alcanza directo |
| 9 | `DUNGEON.OVL` 0x1c6a | `call 0xffffbd12` | `core/dungeon/dungeon.ts`:718 | F7·F3·F1 | stub `0x7c92` → DUNGEON.OVL 0x1c6a, tal cual dice |
| 10 | `CAST.OVL` 0x0fd2 | `cmp g_location,0x28; jmp 0xee5` | `core/dungeon/dungeon.ts`:721 | F8 |  |
| 11 | `ULTIMA.EXE` 0x4402 | `call 0x8482` | `core/endgame/use-tools.ts`:317 | F7·F3 | `0x8482`+`0xbf80` = 0x4402; el cuerpo hace `(y<<5)+x` |
| 12 | `TALK.OVL` 0x0396 | `jge 0x80` | `core/game.ts`:422 | ★F9 | `jge 0x80` NO existe: es `cmp ...,0x80` + `jge 0x3a6`. Semántica correcta |
| 13 | `TOWN.OVL` 0x0e9e | `xor [0x67b9],0xb` | `core/game.ts`:865 | F8 |  |
| 14 | `MAINOUT.OVL` 0x0ccc | `inc [g_party_y]` | `core/game.ts`:1575 | F8 |  |
| 15 | `DUNGEON.OVL` 0x0fef | `push 1` | `core/game.ts`:2295 | F7·F2 | la ventana es DUNGEON.OVL 0x0f2e, con `mov ax,1` + `push ax` + la llamada al reloj |
| 16 | `TOWN.OVL` 0x0e9e | `xor [0x67b9],0xb` | `core/game.ts`:2359 | F8 |  |
| 17 | `LOOKOBJ.OVL` 0x0583 | `and 0xfc; cmp 0xd8` | `core/game.ts`:5276 | F5 |  |
| 18 | `SJOG.OVL` 0x1464 | `cmp ax,0x1b` | `core/quest/items.ts`:38 | F7 |  |
| 19 | `OUTSUBS.OVL` 0x0712 | `imul 0x1e` | `core/quest/lordbritish.ts`:30 | ★F9 | `imul 0x1e` NO existe: es `mov ax,0x1e` + `imul dx`. Semántica correcta |
| 20 | `OUTSUBS.OVL` 0x08db | `mov [bp-0xc],1` | `core/quest/lordbritish.ts`:44 | F8 |  |
| 21 | `CAST.OVL` 0x170b | `mov [bx+0x58c8],0xff` | `core/quest/ritual.ts`:14 | F8 |  |
| 22 | `TOWN.OVL` 0x0e9e | `xor [0x67b9],0xb` | `core/sfx.ts`:66 | F8 |  |
| 23 | `MAINOUT.OVL` 0x0329 | `cmp [bp-6],0x2f` | `core/sfx.ts`:122 | F8 |  |
| 24 | `SHOPPES3.OVL` 0x0164 | `mov al,[bx + 0x4e7a]` | `core/shops/shop-tables.ts`:114 | F8 |  |
| 25 | `SHOPPES.OVL` 0x0a5e | `cmp 0x63` | `core/shops/shops.ts`:628 | F5 |  |
| 26 | `SHOPPES.OVL` 0x0546 | `cmp 0x63` | `core/shops/shops.ts`:670 | F5·F10 |  |
| 27 | `CAST.OVL` 0x171d | `or [0x5bca],ax` | `core/state.ts`:290 | F8 | dirección exacta; su ÚNICO acceso en todo el corpus. Ver cabo 1 |
| 28 | `CMDS.OVL` 0x0d2e | `mov [bx],0x44` | `core/world/cannon.ts`:59 | F8 |  |
| 29 | `CMDS.OVL` 0x121a | `push 0xf` | `core/world/cmd-strings.ts`:113 | F2 |  |
| 30 | `SHOPPES2.OVL` 0x0368 | `sub [g_gold]` | `core/world/cmd-strings.ts`:406 | F7·F5 |  |
| 31 | `MAINOUT.OVL` 0x032f | `cmp [bp-6],0x2f` | `core/world/movement.ts`:260 | F7 |  |
| 32 | `SJOG.OVL` 0x0587 | `cmp [g_equip_qty+39], 0` | `core/world/search.ts`:223 | F8 |  |
| 33 | `SJOG.OVL` 0x055d | `cmp [g_keys], ah` | `core/world/search.ts`:238 | F8 | cita exacta; la premisa del registro a cero NO verificada. Ver cabo 2 |
| 34 | `TOWN.OVL` 0x1275 | `cmp g_location,0x1d` | `core/world/shadowlord-urban.ts`:35 | F8 |  |
| 35 | `MAINOUT.OVL` 0x06fe | `push g_party_x` | `core/world/shadowlord-wither.ts`:34 | F2 | el ÚLTIMO push es la `y` ⇒ fija el eje de la fórmula, y corrige la nota heredada |
| 36 | `MAINOUT.OVL` 0x0312 | `cmp [g_transport_tile],0x20 / jb 0x322` | `core/world/transport.ts`:351 | F8 |  |
| 37 | `LOOKOBJ.OVL` 0x099c | `mov ax,0x2d; call 0x16ba` | `main.ts`:182 | F7·F1 | la instrucción vive en ULTIMA.EXE 0x3332, verbatim |
| 38 | `COMBAT.OVL` 0x06f1 | `push 0xa; call 0x742a` | `main.ts`:1223 | F2 | `0x742a`+`0xa290` = 0x16ba (putchar); y stub `0x7d9a` → COMSUBS.OVL 0x0094 |
| 39 | `CAST2.OVL` 0x00de | `call 0xffffc10e` | `main.ts`:2777 | F7·F3·F1 | stub `0x808e` → CAST2.OVL 0x00de |
| 40 | `COMSUBS.OVL` 0x13d9 | `push 0x28` | `skin/fiel/combat.ts`:72 | F7 | `0x3ee8`+`0xe1e0` = 0x20c8 |
| 41 | `FONT.OVL` 0x0651 | `call 0x2f32` | `skin/fiel/demo-scene.ts`:357 | F10 |  |
| 42 | `DNGLOOK.OVL` 0x05ee | `cmp raw,0xb0` | `skin/fiel/gemmap.ts`:38 | F4 | `raw` es el hueco del operando de memoria; las dos ramas hacen lo descrito |
| 43 | `TOWN.OVL` 0x0e34 | `push [bx+0x2746]` | `skin/fiel/speaker.ts`:245 | F1·F8 |  |
| 44 | `FONT.OVL` 0x0bc8 | `push 8` | `ui/creation.ts`:7 | F2 |  |
| 45 | `FONT.OVL` 0x0651 | `call 0x2f32` | `ui/faithful-intro.ts`:2551 | F10 | `0x2f32`+`0xe1e0` = 0x1112, la aritmética que el propio comentario escribe |
| 46 | `SHOPPES.OVL` 0x0bcc | `cmp ax,0xd` | `ui/shop-console.ts`:147 | F7·F10 |  |
| 47 | `SHOPPES2.OVL` 0x0508 | `sub [g_gold]` | `ui/shop-console.ts`:1183 | F1·F5 | cuerpo ENTERO recorrido: resta oro y NO llama a la merma. Y el conteo 5+4+2 = 11 reproduce |
| 48 | `SHOPPES2.OVL` 0x0361 | `sub [g_gold]` | `ui/shop-console.ts`:1884 | F7·F5 |  |
| 49 | `SHOPPES3.OVL` 0x07b3 | `sub [g_gold]` | `ui/shop-console.ts`:1921 | F7·F5 |  |
| 50 | `SHOPPES3.OVL` 0x0121 | `sub [g_gold]` | `ui/shop-console.ts`:2028 | F7·F5 |  |
| 51 | `SHOPPES2.OVL` 0x0147 | `sub [g_gold]` | `ui/shop-console.ts`:2259 | F7·F5 |  |