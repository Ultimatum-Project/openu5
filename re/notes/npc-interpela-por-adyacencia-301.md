# El NPC que INICIA la conversación por adyacencia — mecanismo derivado (#301)

Sujeto: el BINARIO. Todas las lecturas de esta acta son de primera mano sobre
`re/disasm/NPC.OVL.asm`, `re/disasm/TOWN.OVL.asm` y `re/disasm/TALK.OVL.asm`, con los
call cross-overlay resueltos por instrumento (`re/tools/dispatch_table.py`), no por el
destino impreso del desensamblador.

Motivo: el guardia del TEJADO del castillo de Lord British interpela al grupo **sin que
el jugador pulse (T)alk**. La maquinaria ya estaba derivada A MEDIAS en
`blackthorn.md` §2.1a/§2.1b y `talk-031e-resolucion.md` §3, pero las dos actas la leen
como «la cadena de la CAPTURA del Palacio». Esta la lee como lo que es: **el camino
general por el que CUALQUIER NPC de aiType 4/5 arranca su conversación al quedarse
pegado al grupo**, del que la captura es sólo el caso `dlgNum == 0xFF`.

## §1 — El disparador: adyacencia MANHATTAN, en la pasada de NPCs

`NPC.OVL:0x06e4` (fast-path del paso de IA, un NPC por llamada):

```
071d: call 0x6a0        ; dist = dist_manhattan(party.x, party.y, npc.x, npc.y)
0723: cmp ax, 1
0726: jne 0x75a         ; != 1  → bucle de MOVIMIENTO (b); no arma nada
0728: cmp [bp-2], 3     ; aiType del tramo horario, byte [bx+si+0x5d5e]
072c: jle 0x75a         ; aiType 0..3 → bucle de movimiento
072e/0734: aiType 4 o 5 → 0x73d
  0740: cmp word [rt+0xa], 0 ; dlgNum
  0744: je 0x75a             ; dlgNum 0 → no arma
  0746: mov byte [g_npc_attack_tile 0x65be], 0x74   ; 't'
073a: aiType >= 6      → 0x7be
  07be: mov byte [g_npc_attack_tile 0x65be], 0x61   ; 'a'
074b: mov al, [bp+6]   ; ambos convergen aquí
074e: mov byte [0x65bf], al                        ; = índice del NPC
```

★★ **`g_npc_attack_tile` no es un tile: es un CÓDIGO DE ACCIÓN en ASCII** — `0x74`='t'
de talk, `0x61`='a' de attack. El nombre del ledger induce a leerlo como un tile de
sprite y no lo es. (Su tercera escritura, `0x0dc1`, es el reset del prólogo de
`npc_tick_all`; con `0x0dc6` para `[0x65bf]` — vida de UN turno, ya medido en
`blackthorn.md` §2.1c.)

### §1.1 ★★ La distancia es MANHATTAN PELADA, y eso EXCLUYE la diagonal

`NPC.OVL:0x06a0` (68 B, cuerpo entero leído, 0x06a6-0x06da): resta las dos coordenadas,
toma el valor absoluto de cada una (`jge`/`neg`, 0x06b8-0x06d1) y **las SUMA**
(`add word ptr [bp-2], ax`, 0x06d7). Es `|Δx| + |Δy|`, **sin envolvimiento**.

Con `dist == 1` como única puerta, el conjunto que dispara son las **cuatro celdas
ortogonales**: la diagonal vale 2 y cae al bucle de movimiento. Coherente con el
stepper de vecinos `NPC.OVL:0x0632`, que sólo enumera 4 direcciones (E/N/O/S, con
recorte a 0..0x20).

🔴 **`object_proximity_activate` (MAINOUT 0x007a) NO es este mecanismo** y quien lo
herede de #32 se equivoca de rutina en tres ejes a la vez: mira **un solo actor**
(`si = 0x5c62` constante, el registro 1), en caja de **Chebyshev 11×11** (`|Δx|<6` y
`|Δy|<6`, dos comparaciones con 6 en 0x00be/0x00c4) y su efecto es **pitar**
(`asm100-censo-acta` §59.2). Ni el sujeto, ni la métrica, ni el efecto coinciden.
La discrepancia de #32 (toro vs `|Δ|` pelado) es entre `pick_spawn_coords` y
`object_proximity_activate`; **ésta es una TERCERA medida de distancia**, leída en su
propio cuerpo, y no se pronuncia sobre aquella adjudicación.

## §2 — El consumidor: `npc_engine` despacha por el código de acción

`TOWN.OVL:0x1352 npc_engine`, invocado al cerrar el turno de pueblo desde `0x1683`
(gate `0x1671`: `[0x65bf] != 0` ∨ `result == 2`), con arg = `result − 1`:

```
1379: cmp byte [g_npc_attack_tile], 0x61 ; jne 0x13b4   ; ¿'a'? no → rama de TALK
13b4: cmp word [bp+4], 0 ; jne 0x13d6                   ; result==2 → captura DIRECTA
13ba: si = [0x65bf]
13c7: cmp word [rt+0xa 0x5f68], 0 ; je 0x13dc           ; dlgNum 0 → nada
13ce: call 0xfffff912  → kernel 0x7AE2 (PLINK, overlay 17) → TALK 0x031E
13d2: or ax,ax ; je 0x13dc                              ; ret 0 → NO hay captura
13d6: call 0x12ae                                       ; captura/arresto
```

La resolución del `call 0x13cf` a `TALK 0x031E talk_converse_dispatch` está hecha con
instrumento y documentada en `talk-031e-resolucion.md` §1; no la repito.

## §3 — Dentro de TALK 0x031E: el `dlgNum` PARTE el comportamiento en dos familias

De `talk-031e-resolucion.md` §2, que leyó 0x031E entero:

| `dlgNum` | rama | retorno |
|---|---|---|
| `< 0x80` | `0x0396` → `run_scripted_conversation` (TALK 0x127e) | **0 siempre** (0x3a3→0x38e) |
| `0x80..0xFC` | gate horario → tienda o «Come see me at my shoppe…» | 0 |
| `0xFD` | «Don't hurt me!…» | 0 |
| `0xFE` | far 0xbb02 | 0 |
| `0xFF` | `call 0x1e2` `guard_demand` | **única que propaga ≠0** → captura |

★★ **La conclusión que ninguna de las dos actas previas escribe junta**: como la rama
`< 0x80` devuelve 0 SIEMPRE, el binario **corre la conversación completa del `.TLK` y
después no hace nada más**. Ese «no hace nada más» es exactamente lo que un port puede
confundir con «no pasa nada»: el efecto de la rama **es la conversación**, no su
retorno.

## §4 — Qué NPC es el del tejado, y cuántos más hay

Los `.NPC` se leen con el parser del extractor (`extractor/src/parsers/npc.ts`: 8
pueblos × 576 B; `+0x000` 32 horarios de 16 B con `aiTypes[3] x[3] y[3] z[3] times[4]`,
`+0x200` tipo, `+0x220` `dialogNumber`).

- **Castillo de Lord British (loc 17): un único slot con aiType 4/5 — el 27**, con
  `aiTypes = [0,4,0]`, `z = [1,2,1]`, `type = 0x70` (tile de guardia) y **`dlgNum = 8`**.
  El tramo cuyo aiType es 4 es justo el que lo coloca en la **planta 2, el tejado**.
  `dlgNum = 8 < 0x80` ⇒ rama guionizada ⇒ conversación completa, retorno 0, **sin
  captura**. Es el guardia del reporte, y explica que en el vídeo el grupo se marche
  andando al terminar.

- **Censo completo** sobre los 4 ficheros (1024 slots; control: 33 + 991 = 1024):
  **33 NPCs** tienen aiType 4 o 5 en algún tramo. De ellos **13 con `dlgNum 0xFF`** (el
  guardia hardcoded) y **20 con conversación de datos**, que se parten en **6
  guionizados** (`dlgNum < 0x80`) y **14 TENDEROS** (`0x80..0xFC`).

★ Consecuencia derivada que conviene tener escrita: **plantarse al lado de un tendero
de aiType 4 entra por esta misma vía** y cae en el gate horario de TALK 0x031E — o sea,
la tienda puede abrirse (o el tendero remitir a su tienda) **sin (T)alk**. Es mecánica
del binario, no efecto de borde.

## §5 — RNG en el camino

Censo por instrumento de los call a `rand_range` (kernel `0x2092`) desde TALK.OVL:
**tres** sitios — `0x1153`, `0x11ce`, `0x126e`.

- `0x11ce` y `0x126e` viven en `TALK 0x1180`, detrás de
  `cmp byte [g_shadowlord_here_idx 0x5958], 0 / je` (0x1187). El valor de reposo de esa
  global es **0xFF** (TOWN 0x02b6 y 0x122e la escriben así), no 0 ⇒ **el cuerpo no está
  en el camino normal** de una conversación.
- `0x1153` **SÍ**: `run_scripted_conversation` llama a `0x111c`, que imprime «You see »
  (DS 0x94c4) más la sección 1 del `.TLK` —la descripción— y **sólo si
  `test_npc_met(idx)` (TALK 0xd7a) devuelve 0**, es decir la PRIMERA vez que se habla
  con ese NPC (`0x113e`-`0x1143`), tira **una `rand_range(1,0)`**: una moneda que decide
  si el NPC se autopresenta. Con el NPC ya conocido el binario ni llega al `call`.

⚠ Y dos instrucciones antes, `0x1145`-`0x1149` **RE-SIEMBRA desde el reloj de pared**
(familia de la re-siembra ya censada): la moneda no sale del stream, y de paso lo
reemplaza. La paridad de stream a partir de ahí es **imposible por construcción**, no
meramente incumplida — que es justo lo que el port ya declara en
`game/src/core/dialogue/conversation.ts` (docblock de `selfIntroRoll`).

**Cota, para quien cablee**: como máximo **una tirada por NPC en toda la partida**, y
**cero** a partir de la segunda interpelación del mismo NPC.

### §5.1 — PREDICCIÓN ANCLADA (ventana de sellos, 2026-08-14)

Escrita ANTES de cablear y repetida en el mensaje del commit del cableado, para que sea
auditable después y no dependa de ningún canal de conversación:

> **Sólo se desplaza el stream en la PRIMERA intercepción de cada NPC no conocido; la
> segunda intercepción del mismo NPC consume 0.**

Se sostiene sobre el gate `test_npc_met` de `0x113e`-`0x1143`: con el NPC ya conocido el
binario **no llega** al `call` de `0x1153`. Y la conversación que abre la intercepción es
la MISMA que abre el comando (T)alk —convergen en `talk_converse_dispatch`—, así que el
cableado no estrena mecanismo de RNG: estrena **ocasiones** de uno que ya existía.

### §5.2 ★ Dónde se marca «met», que NO es donde uno lo buscaría

`mark_npc_met` (TALK `0xd42`) tiene **un solo llamador en todo el overlay: `0x0f02`**,
dentro del handler de **AskName** (`0x0e78`-`0x0f32`). O sea: un NPC pasa a «conocido»
cuando aciertas su reto de nombre, **no** al saludarte ni al salir la moneda de
autopresentación.

Consecuencia para #301, que era la duda razonable al cablear: como la intercepción y el
comando (T)alk **convergen en `talk_converse_dispatch`**, el momento del marcado es el
mismo por construcción — no hay una vía que marque antes que la otra, y no hay
divergencia que declarar. El clon lo calca en `game/src/core/dialogue/conversation.ts`
(op `AskName` → `this.met = true`), y quien conduce la conversación llama a
`markNpcMet` con el mismo criterio por las dos vías.

## §6 — El hueco del PORT y su forma

Toda la maquinaria del disparador ya estaba calcada en
`game/src/core/world/guard-encounters.ts` (`checkGuardTribute`): manhattan == 1, aiType
> 3, el «pisa» por slot ascendente, el gate `dlgNum != 0`. Lo que faltaba era el efecto:

```ts
if (npc.dialogNumber !== 0xff) return null;   // ANTES: modelaba el RETORNO (0) y tiraba la conversación
```

★★ **La clase**: se había portado el *valor de retorno* de una rama cuyo contenido ES un
efecto. Que `run_scripted_conversation` devuelva 0 SIEMPRE es justo lo que la hace
parecer un no-op al leerla desde el llamador — el llamador no distingue «no hizo nada»
de «hizo la conversación entera y no capturó a nadie». El discriminante no está en el
retorno: está en el CUERPO de la rama.

Medición del hueco antes del fix, con control positivo (mismo arnés, mismo turno, mismo
NPC adyacente; lo único que cambia es `dialogNumber`): `0xFF` → `["guard-tribute-prompt"]`
· `8` → `[]`. Cero eventos, cero mensajes.
