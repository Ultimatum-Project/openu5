# aiType 4 — persigue, no huye (#82). El cuarto y último de la familia

Cierra la serie abierta por #52 (el 6) y #78 (el 5 y el 7). El clon mandaba el aiType 4 a
`fleeStep`; el binario lo manda a la rama de acercarse.

## §1 — El despachador: ocho entradas, cinco destinos, y el 4 es el único con handler propio

La tabla de salto de `npc_ai_step` vive EN MEDIO de la rutina y el desensamblado la imprime
como instrucciones absurdas. Se resuelve sola: el salto es
`jmp word ptr cs:[bx - 0x4fd4]` con `bx = aiType*2`, luego la dirección efectiva es
`aiType*2 + 0xb02c`; la tabla se imprime en el offset 0x0d9c del fichero, así que la base de
banda es `0xb02c - 0x0d9c = 0xA290`. Restándola a las ocho palabras:

| aiType | palabra | destino | qué hace |
|---|---|---|---|
| 0 | 0xb03c | 0x0dac | epílogo: nada |
| 1 | 0xaff0 | 0x0d60 | wander radio 3 |
| 2 | 0xafc8 | 0x0d38 | wander sin límite |
| 3 | 0xb006 | 0x0d76 | puerta de distancia, luego 0x06e4 |
| **4** | 0xafd0 | **0x0d40** | **handler propio** |
| 5 | 0xb021 | 0x0d91 | 0x06e4 sin puerta |
| 6 | 0xb006 | 0x0d76 | = el 3 |
| 7 | 0xb021 | 0x0d91 | = el 5 |

Las ocho caen sobre inicio de instrucción real ⇒ **confirmación independiente de la base de
banda por la vía de DATOS**, distinta de las anclas de llamada.

★ **Ocho entradas, CINCO destinos.** El 3 y el 6 comparten handler; el 5 y el 7 también. Ésa
es la razón mecánica de que el defecto de etiqueta se repitiera cuatro veces: **compartir
handler invitaba a compartir etiqueta**, y la etiqueta era la del primero de cada par.

## §2 — La puerta del 4 (offset 0x0d40)

```
0d40: si = [bp+4] + [bp-4]          ; registro de horario del NPC
0d46: push g_party_x  ·  0d4c: push g_party_y
0d50: push byte [si+3] ·  0d54: push byte [si+6]
0d58: call 0x6a0                    ; manhattan_distance
0d5b: cmp ax, 4
0d5e: jl 0xd91                      ; dist < 4  ->  0x06e4
0d60: ...                           ; dist >= 4 ->  npc_wander(3)
```

El orden de los argumentos está verificado en el cuerpo de `manhattan_distance` (`ret 8`,
`[bp+0xa] - [bp+6]` y `[bp+8] - [bp+4]`), no supuesto: **el campo +3 es la X y el +6 la Y**.

## §3 — El discriminante: una comparación, dos signos

Dentro de `0x06e4` el aiType viaja intacto — `0703: mov al, [bx+si+0x5d5e]` con
`bx = [bp+4]` y `si = idx<<4` es el byte +0 del registro, y queda en el local `[bp-2]`.
La bifurcación está en el offset 0x0824:

| rama | quién entra | criterio | efecto |
|---|---|---|---|
| 0x082a | **sólo el aiType 3** | `[bp-4]` = distancia actual; `jle` descarta ⇒ exige candidata **MAYOR** | **alejarse** |
| 0x0884 | 4, 5, 6, 7 | mismo `[bp-4]`; `jge` descarta ⇒ exige candidata **MENOR** | **acercarse** |

## §4 — Coste: el 4 no toca el generador

Censo de **las tres** llamadas al helper de rango dentro de `0x06e4`-`0x0938` (enumeradas,
no muestreadas): la de 0x083d cuelga de la rama del aiType 3; las de 0x08a5 y 0x08d4 cuelgan
de la cola de erratismo, que abre `cmp [bp-2],5 / je` y `cmp [bp-2],7 / jne` ⇒ **exclusiva del
5 y el 7**. El aiType 4 **no ve ninguna**.

`npc_wander` gasta exactamente una (`push 0` / `push 0xff` ⇒ rango 0..255, mínimo primero).

⇒ Un actor aiType 4 cuesta **1 tirada si está lejos y 0 si está cerca**, y el fix **no cambia
ese reparto** porque no toca la puerta. Cambia la POSICIÓN.

⚠️ Eso NO es «no mueve el stream» en sentido fuerte: no consumir es de las instrucciones, y
mover el stream es del estado que queda. Una posición distinta cambia quién queda adyacente,
qué bloquea y qué encuentro sale. Lo medido es el punto de llamada; la propagación por estado
de mundo no está medida aquí.

## §5 — El denominador, que es el titular de toda la familia

Censo sobre los datos de NPC (1024 slots · 3072 ranuras crudas; 327 · 981 aplicando las
exclusiones de slot 0 y slot vacío — el reparto no cambia porque los excluidos son todos
aiType 0):

```
aiType:  0:2795   1:101   2:54   3:4   4:42   6:40   7:36
```

- El aiType 4: **33 NPC · 42 ranuras · 14 localizaciones**
  (1:3 · 2:3 · 3:2 · 4:2 · 5:3 · 6:3 · 17:1 · 18:13 · 21:1 · 22:1 · 24:4 · 25:2 · 29:3 · 30:1).
- El aiType 5 no aparece: **cero ocurrencias**.

★ **El único que huye de verdad, el 3, sale 4 veces de 981. Los tres que el clon mandaba a
huir suman 118.** El error no era un caso raro con tres primos: **era la regla, y lo correcto
era la excepción.** Ninguna de las tres fichas anteriores lo dijo, porque describían el
mecanismo y ninguna midió el denominador.

⚠️ HEREDADO, no medido: la afirmación de que esas 14 localizaciones «incluyen todas las de los
cinco sellos». Determinarlo exige leer los saves binarios o correr el tour — la ruta en JSON no
lo dice y el sidecar trae la posición vacía. La atribución se hace *post hoc* con la tabla por
localización de arriba.

## §6 — Alcance: es un defecto de PUEBLO, no del sobremundo

El sobremundo no usa este despachador: usa el mover general de MAINOUT, que reparte por
familia de tile. Contra el bestiario de 48 entradas (suponiendo la fórmula de tile
`0x40 + 4*índice`, acreditada para dos criaturas invocadas y **no** para spawns de sobremundo
— eso lo falsaría un actor de sobremundo con tile que no sea múltiplo de 4 sobre 0x40):

```
genérico (persigue) ... 46      remolino ... 1 (índice 43)      especial/rango ... 1 (índice 47)
```

⇒ 46 de 48 = **96 %** viaja por la rama de perseguir, con esa condición encima.

🔴 Y la familia de la **nave pirata** NO está en el bestiario: su tile cae **fuera** del rango
que generan los 48 índices, así que esa rama del despacho se alimenta de otra tabla. Es la
otra cara del hallazgo del barco pirata (naves y criaturas conviven en la misma tabla de
objetos del binario mientras el clon las parte en dos listas): en el **despacho de movimiento**
también son familias distintas.

## §7 — Lado del port

`game/src/core/npc/manager.ts`, `case AI_MERCHANT`: llamaba a `fleeStep`. Corregido a
`chaseStep`.

🔴 **El comentario de la constante ya describía bien el binario** («si party a <4 de su PUESTO
entra en 0x06e4, si no wander 3») tres líneas encima del `fleeStep`. **Comentario correcto
sobre código incorrecto es peor que un comentario rancio**: el rancio miente y se caza leyendo
el código; el correcto ACREDITA que alguien ya lo miró, y desactiva la sospecha de quien pasa
por ahí. Pasó cuatro veces.

## §7 — Por qué los cinco sellos salieron INTACTOS, y por qué eso NO acredita inocuidad

La ventana de sellos de este fix dio **los cinco intactos**. Eso NO es «el fix es inocuo»:
es que **el instrumento no podía verlo**, y la razón está medida. Se documenta aquí porque
la inferencia contraria —«los cinco intactos, luego confirmado»— llegó a publicarse para el
aiType 6 y es exactamente lo que esta seccion refuta.

**Cadena, con el grado de cada eslabon:**

| # | eslabon | grado |
|---|---|---|
| 1 | el universo comparado del espejo es TEXTO (bloques OCR) mas los deltas de oro anclados; nada posicional entra en `matched/comparable` | leido |
| 2 | la excepcion es el ANCLA DE TRANSACCION, que exige que la party acabe plantada junto al mercader ⇒ SI depende de una posicion | leido |
| 3 | pero el teleport del ancla pasa por `enterMap`, que **reconstruye cada NPC en su celda de HORARIO** (`x: s.x[idx]`, `y: s.y[idx]`, `z: normZ(s.z[idx])`) y **descarta la deriva** ⇒ el fix no puede alterar el enganche | **MECANISMO, verificado en el cuerpo** |
| 4 | el residuo: `miss` y `ambiguo` se emiten ANTES del teleport, con posiciones derivadas — ahi la deriva SI podria colarse | leido |
| 5 | ese residuo NO se ejercio: **0 `NPC-ANCHOR-MISS` y 0 `npc-anchor-ambiguo`** en los cinco sellos | **MEDIDO** |
| 6 | y el fix no consume el generador en la rama de persecucion (§4) ⇒ tampoco hay canal de stream | **MEDIDO** |

⚠️ **ACOTACION DEL «0 MISS», y va literal porque sin ella la cifra se malinterpreta:**
**«0 MISS» significa que ninguna ancla que CORRIO fallo. Un ancla cuyo beat nunca se
alcanzara no dejaria linea. Es COTA, no censo.** No esta comprobado que las 19 anclas
declaradas en las cinco rutas engancharan.

⚠️ **Y la cita del reset se busca por el NOMBRE `enterMap`, no por numero de linea.** La
primera version de esta derivacion se cito como `manager.ts:186-199` y en el arbol donde se
verifico estaba en la 211, porque este mismo carril habia anadido lineas por encima. Leer
ese rango literalmente lleva al constructor y al RNG, y de ahi a concluir que el mecanismo
no existe. **Una linea sin arbol es una foto, igual que una cifra sin SHA.**

### El canal SI existe para esta fila — no es ceguera por construccion

El enunciado fuerte «el espejo es ciego a los movimientos de NPC» seria FALSO. Medido:

```
aiType 4:  33 NPC  →  14 SON MERCADERES (dialogNumber 0x81-0x88) = diana de ancla
                      Barkeeper 4 · Blacksmith 3 · Shipwright 3 · InnKeeper 2 · Healer 1 · MagicSeller 1
aiType 6:  14 NPC  →   0 mercaderes
aiType 7:  12 NPC  →   0 mercaderes
```

★ **El aiType 4 ES la IA de los mercaderes** — la constante del port se llama `AI_MERCHANT`
y el nombre resulta literal. Y las cinco rutas selladas declaran **19 anclas de NPC** que
cubren **cinco de los seis tipos** que lleva esta fila. **El canal existe y esta ejercido.**
Lo que lo neutraliza no es la ausencia de canal: es el reset del eslabon 3.

★ Para el 6 y el 7 la conclusion es de otra naturaleza y **no depende de la localizacion**:
su poblacion **no intersecta el canal en absoluto**, asi que ningun sello podia verlos
nunca, en ninguna ciudad y a ninguna hora.

#### 🔴 La premisa que ese eslabon llevaba SIN ENUNCIAR, y que ahora esta MEDIDA

El argumento «ningun aiType 6/7 es mercader ⇒ ninguno puede ser diana de ancla» daba por
supuesto, sin decirlo, que **todas las anclas identifican por tipo de mercader**. Es falso
como generalidad: `anchors.ts` admite **TRES** formas de identidad, no una:

| forma | como casa |
|---|---|
| `shop:<Type>` | via `shopTypeOf(dialogNumber)`, o sea 0x81-0x88 — la unica que yo habia censado |
| **`d<N>`** | **dialogNumber EXACTO**, y el comentario del propio fichero dice «guardias de peaje» |
| substring | contra `name` / `type` (el ejemplo del docstring es «troll») |

⇒ **un ancla `d<N>` o substring sobre un NPC NO mercader se escapaba entera de mi censo**, y
un guardia de peaje o un troll no tienen por que ser ajenos al aiType 6 o 7. El dato habria
seguido siendo cierto y la inferencia que colgaba de el, falsa.

**Censado por `invisible-12` en vez de razonado, y se sostiene:**

```
TODAS las rutas:   72 anclas de NPC  →  72 `shop:<Type>`  ·  0 `d<N>`  ·  0 substring
Las CINCO escenas: 19 anclas          →  ad06 6 · ad09 1 · ad21 6 · part04 1 · part05 5
```

⇒ el censo de mercaderes **SI era exhaustivo — pero ahora esta MEDIDO, no supuesto**. Y esa
es toda la diferencia: **un censo correcto por casualidad y uno correcto por medicion se leen
igual y valen distinto.** El mio habria aguantado hasta que alguien anadiera la primera ancla
`d<N>`, y entonces habria fallado **sin que nada se pusiera rojo**, porque la premisa no
estaba escrita en ningun sitio donde pudiera romperse.

🔴 **CONDICION QUE LO INVALIDA, nombrada para que pueda ponerse rojo:** el dia que una ruta
declare un ancla de forma **`d<N>`** o **substring**, este eslabon deja de valer y hay que
re-censar cruzando por esa via. Que hoy sean 72 de 72 `shop:` es un hecho del corpus de hoy,
no una propiedad del disenno.

**Replica independiente:** `invisible-12` rehizo la tabla por su cuenta y sale identica
(`6 → 14/0 · 7 → 12/0 · 4 → 33/14`). Dos derivaciones, dos manos.

**Criterio del censo, declarado porque FORTALECE el cero:** un NPC cuenta como aiType *T* si
*T* aparece en **cualquiera** de sus ranuras horarias — la lectura mas inclusiva posible. Un
cero que sobrevive al criterio mas generoso es un cero de verdad.
⚠️ Las ranuras de `aiTypes` son **TRES** (el campo `times`, que lleva los umbrales de hora,
si tiene cuatro). Empiricamente da igual —las dos derivaciones coinciden exactas, luego
ningun NPC cae en la diferencia— pero quien replique esto no debe buscar una cuarta ranura
que no existe y concluir que el censo estaba mal.

### Lo que esto deja abierto

No esta medido **en tiempo de ejecucion** que el camino del aiType 4 se ejecutara durante
las cinco corridas. La sonda `game/src/core/npc/ai-probe.ts` existe para contestarlo y
quedo **apagada**: #82 se cerro por el mecanismo de arriba, que es mas fuerte que un
contador — un contador diria «se ejecuto», y el mecanismo dice «aunque se ejecutara, el
sello no podia verlo».
