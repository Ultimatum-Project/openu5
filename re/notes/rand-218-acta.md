# ACTA #218 — la familia «0 rand contando sólo el CUERPO»

Carril `rand-218`, rama `re/rand-218` (RETENIDA). Worktree partido de `main` **67696ac6**.
`main` en el momento de abrir la pieza: **3dad9615**. CERO e2e, CERO código de `game/`.
Sólo se miden y se corrigen NOTAS.

> **Esta §0 se escribió y se commiteó ANTES de medir nada de la población.** El commit que
> la trae no contiene ni un solo resultado: es la pre-registración, no el informe.

---

## 0. PREDICCIÓN PRE-REGISTRADA

### 0.1 Lo que ya está medido cuando escribo esto (y sólo esto)

| dato | valor |
|---|---|
| SHA del árbol medido | `67696ac6` |
| unidad | **una LÍNEA de nota que declara un conteo de RNG** (no una rutina, no un fichero) |
| corpus | `re/notes/` + `re/verified/` + `re/parity/`, `.md` y `.json`, menos `routine-census.json` (es artefacto generado, no prosa) |
| declaraciones totales | **309** |
| — familia CERO (`0 rand`, `sin RNG`, `no consume`…) | **188** |
| — familia N (`1 rand30`, `exactamente UNA tirada`…) | **121** |
| con ANCLA (`FICHERO:0xNNNN` en la línea o a ±3) | **109** = 61 CERO + 48 N |
| sin ancla (NO adjudicables: no hay tramo que medir) | 200 |

Las 200 sin ancla **no son absueltas ni condenadas**: quedan fuera del denominador y se
declaran como tales. Una afirmación de conteo sin tramo citado no es medible por este
método; convertirlas en medibles es trabajo de derivación, no de censo.

### 0.2 Predicción sobre las **61 CERO con ancla** (rangos, no cifras)

| bucket | criterio mecánico | predicción |
|---|---|---|
| **CONFIRMADA** | 0 tiradas alcanzables a profundidad 4 **y** 0 calls indirectos en toda la clausura | **55-75 %** → 34-46 |
| **★ NO ABSUELTA por CALLEE** | el cuerpo no tira pero la clausura alcanza `0x2092`/`0x3aae`/`0x3abe` en L≥1 | **15-35 %** → 9-21 |
| **ABIERTA por INDIRECTO** | hay `call` no resoluble estáticamente en la clausura | **5-20 %** → 3-12 |
| **ANCLA MALA** | el ancla no cae en el fichero, o el ±3 pegó un offset de otra frase | **5-15 %** → 3-9 |

### 0.3 Predicción sobre las **48 N con ancla**

- **SUELO detectado** (la clausura alcanza MÁS tiradas de las declaradas, como la parcial de
  #105 que dijo «exactamente UNA»): **20-40 %** → 10-19.

### 0.4 Predicciones cualitativas (falsables, y más informativas que los números)

1. **El defecto se concentra en declaraciones sobre FLUJOS, no sobre HOJAS.** Un tramo hoja
   (pintor, impresor, comparador) no tiene callees donde esconder la tirada. Predicción: de
   las NO ABSUELTAS, **la mayoría** cita un handler de comando o un flujo de turno
   (`cmds.md`, `combat*.md`, `dungeon*.md`, `transport.md`), y **ninguna o casi ninguna**
   cita un pintor de `kernel-render-sweep.md` / `kernel-sweep-*.md`.
2. **Habrá ≥3 instancias NUEVAS sustantivas** (fuera de las 3 ya conocidas: #104 0x1578,
   `cmds.md` §12 Mix, la parcial de #105).
3. **Si salen 0 nuevas ⇒ el instrumento está mal, no el corpus.** Con 61 anclas y tres
   instancias ya confirmadas a mano en tres carriles distintos, un cero limpio es más
   verosímil como fallo de medición que como salud del corpus. En ese caso: revisar el
   instrumento antes de publicar nada (regla del repo: «resultado inverosímil ⇒ revisa el
   instrumento»).
4. **Riesgo declarado de FALSO POSITIVO, y por eso el bucket se llama NO ABSUELTA y no
   REFUTADA.** La alcanzabilidad a profundidad 4 es una **COTA SUPERIOR**: que exista un
   camino hasta `rand_range` no prueba que el flujo lo recorra (puede vivir tras una guarda
   que el caso declarado nunca toma). Promover esa cota a mecanismo es exactamente el error
   que el repo ya tiene fichado. Sólo pasa a **REFUTADA** la declaración cuyo camino se lee
   instrucción a instrucción y resulta alcanzable en el caso que la nota describe.

---

## 1. EL INSTRUMENTO Y SU CONTROL POSITIVO

### 1.1 Qué mide

Dado `(fichero, offset)`: delimita la rutina que lo contiene, enumera sus `call`, los
resuelve **POR BANDA** (`routine_census.resolve_near_call`) y repite hasta profundidad 4,
buscando las tres primitivas de tirada del ledger:

| offset | nombre (ledger `coverage.json`) | papel |
|---|---|---|
| `0x2092` | `rng_rand_range` | la única que avanza `g_rng` |
| `0x3aae` | `kernel_rand0` | envoltura → `0x2092` |
| `0x3abe` | `kernel_rand30` | envoltura → `0x3aae` |
| `0x207e` | `rng_srand` | **NO cuenta**: re-siembra, no consume |
| `0x2056` | `rng_time_hash` | **NO cuenta**: re-siembra, no consume |

Nunca por `grep 'call 0x2092'` sobre los `.asm`: el operando que imprime el desensamblador
es FILE-relativo y **miente entre overlays** (familia #173). Un censo de callees por texto
está mal por construcción.

### 1.2 Dos errores MÍOS, declarados

**(a) Le di un offset del KERNEL a un OVERLAY.** Mi primera corrida del control pidió
`CMDS.OVL:0x2fd0`. `0x2fd0` es `ULTIMA.EXE:0x2fd0` (el acta de #105 lo deriva por banda:
`near_call_base` de CMDS = 0xbf80, `call 0x7050` → 0x2fd0 del kernel). CMDS.OVL mide
0x1d10 bytes enteros, así que el offset ni existe ahí. El instrumento **no protestó**: mi
`extent` devolvía la última rutina del fichero y habría publicado una medida de un tramo
que no era el pedido. Corregido: ahora un offset fuera de rango sale como `FUERA DE RANGO`.
La lección es la de siempre en este repo — una cita de offset sin segmento es ambigua, y el
instrumento tiene que negarse, no adivinar.

**(b) Delimité rutinas sin el mapa GLOBAL de destinos de call.** `function_starts` sin
`extra_targets` no ve las entradas del kernel que **sólo** se llaman desde overlays; esas
entradas quedan FUNDIDAS con su predecesora, la extensión se infla y el tramo hereda
tiradas ajenas — un generador de **falsos positivos** justo del signo que esta pieza busca.
Corregido replicando el pase 0+1 de `census()`: mapa global de `call` primero, límites
después.

### 1.3 Control positivo — las 3 instancias conocidas, en verde

| instancia | tramo | CUERPO | CALLEES | veredicto del control |
|---|---|---|---|---|
| #104 `overworld-ai-rng.md` «Helpers (sin rand)» | `MAINOUT.OVL:0x1578`, extensión 0x1578-0x16fc (388 B) | **2** `rng_rand_range` | 0 | ✔ el instrumento reencuentra el defecto |
| #105 parcial «exactamente UNA tirada» | `ULTIMA.EXE:0x2fd0`, extensión 0x2fd0-0x3072 (162 B) | **3** (`rand30` + `rand_range`) | 1 | ✔ era un SUELO, no una cuenta |
| #105 `cmds.md` §12 «0 rand» para Mix | `CMDS.OVL:0x1ad8`, el handler de Mix, extensión 0x1ad8-0x1c20 (328 B) | **0** | **10** | ✔ **la forma exacta del defecto**: cero en el cuerpo, tiradas en la clausura |

El tercero es el control que de verdad importa: es el único de los tres cuyo cuerpo está
LIMPIO y cuyo defecto **sólo** se ve bajando un nivel. Sin él, un instrumento que mirara
únicamente el cuerpo también saldría «verde» en los otros dos.

Camino medido desde el handler de Mix hasta la tirada. Cadena de callees y primitiva
alcanzada, en celdas separadas:

| nivel | callee 1 | callee 2 | callee 3 | primitiva alcanzada |
|---|---|---|---|---|
| L1 | 0x2fd0 | — | — | `rng_rand_range` y `kernel_rand30` |
| L2 | 0x2fd0 | 0x2aa8 | — | `rng_rand_range` |
| L3 | 0x3ae6 | 0x5910 | 0x4552 | `rng_rand_range` |
| L3 | 0x3ae6 | 0x5910 | 0x2f62 | `rng_rand_range` |

(todos los callees son del kernel `ULTIMA.EXE`)

Los L3 pasan por el flash/beep de presentación: son exactamente el material que **no** se
puede promover a mecanismo sin leer el camino, y por eso el bucket es NO ABSUELTA.

---

*(§2 en adelante: medición de la población. Se añade en un commit POSTERIOR a éste.)*

---

## 2. LO MEDIDO — y por qué el titular mecánico NO vale

### 2.1 El primer resultado, y la razón de no publicarlo

Corrida del instrumento sobre las 109 con ancla, tomando en cada una el ancla más
cercana y clasificando por los buckets de §0.2:

| bucket | CERO (n=61) | % | predicho |
|---|---|---|---|
| NO ABSUELTA por CALLEE | 42 | 69 % | 15-35 % |
| CONFIRMADA | 11 | 18 % | 55-75 % |
| el CUERPO citado tira | 8 | 13 % | (sin bucket) |
| ABIERTA por INDIRECTO | 0 | 0 % | 5-20 % |
| ANCLA MALA | 0 | 0 % | 5-15 % |

**Las cuatro celdas caen fuera de su rango.** Por la regla que yo mismo pre-registré
(§0.4.3), eso obliga a revisar el instrumento antes que el corpus. Lo revisé, y el
titular «69 % de los censos 0 rand están mal» **es falso**. Tiene tres causas, y
ninguna es del corpus.

### 2.2 Causa 1 — SATURACIÓN por profundidad (control que faltaba: la TASA BASE)

Nunca medí qué fracción de una rutina CUALQUIERA alcanza una tirada a profundidad 4.
Medido ahora sobre las **886 rutinas del corpus entero**:

| profundidad | rutinas que alcanzan rand | % |
|---|---|---|
| 1 | 114 | 12,9 % |
| 2 | 207 | 23,4 % |
| 3 | 262 | 29,6 % |
| 4 | 311 | **35,1 %** |
| 5 | 326 | 36,8 % |

A profundidad 4, **una de cada tres rutinas del binario alcanza el generador**. Un
detector con esa tasa base no distingue un defecto de un camino cualquiera: el 69 %
es el doble del ruido de fondo, no una plaga. Ésta es la forma exacta del error
«cota superior promovida a mecanismo» que el repo ya tiene fichado, y lo cometí yo
al elegir profundidad 4 sin medir antes qué significaba un positivo a esa distancia.

Re-cortando la población por la profundidad MÍNIMA a la que aparece la tirada:

| estrato | CERO (n=61) | lectura |
|---|---|---|
| L0 — el cuerpo citado tira | 21 | contradicción directa o claim de SUB-RAMA |
| L1 — callee directo | 18 | señal real (base 12,9 %) |
| L2 | 6 | apenas sobre la base (23,4 %) |
| L3 | 5 | **por debajo** de la base (29,6 %) — ruido |
| sin rand alcanzable | 11 | CONFIRMADA |

### 2.3 Causa 2 — mi ventana de ±3 pega el ancla de OTRO sujeto

El bucket «ANCLA MALA» dio 0, y eso era un artefacto de mi definición: sólo contaba
anclas **irresolubles**, nunca anclas **del sujeto equivocado**. Dos casos leídos:

| declaración | ancla que pegó el ±3 | el sujeto REAL de la frase |
|---|---|---|
| `re/verified/cmds.md:78` «Sin RNG → sin paridad de stream» | SJOG 0x0646, del bullet SIGUIENTE | **Push**, CMDS 0x161A |
| `re/notes/loops.md:83` «Sin RNG propio» | OUTSUBS 0x05fc, del encabezado §1.5 dos líneas abajo | **troll_toll**, OUTSUBS 0x1B3E |

En los dos casos la nota es CORRECTA y el que se equivocó fue mi extractor. Restringir
a anclas **en la propia línea** deja 31 declaraciones (13 CERO + 18 N) — el único
subconjunto cuyo sujeto es cierto sin leer.

### 2.4 Causa 3 — la mayoría de los «0 rand» son claims de ALCANCE, no de rutina

La nota habla de una RAMA; el instrumento mide la RUTINA. Tres ejemplos leídos, los
tres correctos:

| declaración | por qué el detector la marca y aun así está bien |
|---|---|
| `transport.md:104` «La deriva NO consume RNG — solo el wind-tick (§4)» | la propia frase acota el alcance y remite al sitio que sí tira |
| `interactions-piano-fire-audit.md:250` «0 rands de RNG (food>0, hora estable)» | condicionada explícitamente; con food==0 sí entra en 0x2aa8 — familia #157 |
| `combat-spells.md:155/158` «inmunidad-tipo (sin RNG)» | acota el sub-paso; la MISMA fila declara su «1 rand30» |

**Conclusión de §2: el barrido mecánico no adjudica esta familia. Ordena la lectura.**
Lo único que adjudica es leer el camino, y eso es lo que hace §3.

---

## 3. LAS DOS INSTANCIAS NUEVAS (leídas instrucción a instrucción)

### 3.1 ★ `cmds.md` §11 — Search en MUNDO sí tira, y el callee citado no era el que decía

Dos defectos encadenados, y el segundo causaba el primero. El offset que la sección
daba como «revelador de puerta secreta» es en realidad una rutina de TRAMPA que
arranca con una tirada; al archivarlo como revelado determinista, el «CERO rand
(mundo)» salía solo.

**(a) El revelado vive en el propio cuerpo**, no en ningún callee — tramo
0x0b40-0x0b63 de SJOG.OVL 0x095c, con el discriminador de #150 intacto:
`cmp byte [0x5895], 0x80` · `jae` → rama de mazmorra · `mov byte [bx], 0xb9` (mundo)
/ `0xb8` (mazmorra).

**(b) El callee de la rama probe `==0x1F`** — su call-site es 0x0a63 — es SJOG.OVL 0x01f2, y
su **primera acción** es `rand_range(0,7)` en 0x01fd; si sale ≠0 (7 de cada 8) se va
por 0x028e — **con la tirada ya gastada**. En la rama 1/8 tira otra vez, `rand(0,0x1f)`
en 0x021c, y si vale 0x13 envenena (`[bx+0x55b3]=0x50`, DS 0x8606); si no, un
`rand(0,3)` en 0x0256 reparte entre cuatro salidas. Seis llamadas a la primitiva en
ese cuerpo.

La confusión es de DÍGITOS: el **valor** de probe `0x1F` y el **offset** del callee
`0x01f2`. Corregido en la nota, con las dos tablas de instrucciones al lado.

**Por qué importa**: (S)earch es un comando de jugador, y el port declara la rama de
puerta secreta portada (`revealSecretDoor`). Si el original gasta ≥1 tirada ahí y el
port no, el stream se desalinea en cada Search sobre puerta secreta. **Va a tarjeta,
no lo arreglo aquí** (esta pieza no toca código).

### 3.2 ★ `transport.md` §3b — la decisión es determinista, MOVERSE cuesta una tirada

La cadencia por acumulador que la sección deriva es exacta y no tira. Lo que la
sección no vio es que su propio «→ mover» es una **llamada**: 0x1a55 `call 0x17d4`,
alcanzado por dos saltos: `je 0x1a4e`, con umbral 4, y `jbe 0x1a4e`, con el acumulador por debajo del umbral.

Y MAINOUT 0x17d4 gasta **siempre** una `rand_range(0,1)` en 0x18b5 — cara o cruz del
EJE que se intenta primero (`cmp ax,1` en 0x18b8). Es incondicional: los cuatro
caminos de los gates de signo — 0x1833, 0x186f, 0x1891, y la caída de 0x18a3/0x18ee —
confluyen en 0x18ae antes de nada. No hay rama que la esquive.

Además 0x17d4 desemboca en MAINOUT 0x1578 — alcanzado en 0x192a y vía 0x197d —, que es **la
compuerta de terreno de los actores de #104**: una tirada más en 13 de 28 tiles.

⇒ la cuenta correcta de §3b no es 0 sino **1 + (0 ó 1) por nave NPC de vela que se
mueve, por turno de mundo**. Enlaza directamente con **#128** (esa compuerta sigue
sin portar), y refuerza su cifra: los actores que la pagan no son sólo los monstruos.

### 3.3 Lo que NO son instancias, y conviene que quede escrito

- `mix-trap-105-acta.md:186` y `:277` salen marcadas por el detector: son el acta de
  #105 **citando las declaraciones que ella misma ya corrigió**. Reencontrarlas es
  control positivo, no hallazgo. Ninguna nota se toca por ellas.
- `combat-spells.md:155/158`, `transport.md:104`, `interactions-piano-fire-audit.md:250`:
  claims de ALCANCE, correctos (§2.4).

---

## 4. VEREDICTO CONTRA LA PREDICCIÓN — dos aciertos y dos fallos

| predicción (§0) | resultado | juicio |
|---|---|---|
| 0.2 CONFIRMADA 55-75 % | 18 % con el criterio publicado | **FALLA** — el criterio saturaba (§2.2) |
| 0.2 NO ABSUELTA 15-35 % | 69 % bruto; **18/61 a L1**, sobre base 12,9 % | **FALLA en bruto**, plausible ya estratificado |
| 0.2 ANCLA MALA 5-15 % | 0 por definición mía; **existen y las leí** (§2.3) | **FALLA — bucket mal especificado** |
| 0.3 SUELO en las N 20-40 % | 4 L1 + 2 L2 de 48 = 12,5 % | **FALLA por poco** |
| 0.4.1 el defecto vive en FLUJOS, no en HOJAS | las 2 instancias son (S)earch y el mover de actores; **cero** en pintores de `kernel-render-sweep` / `kernel-sweep-*` | **ACIERTA** |
| 0.4.2 habrá ≥3 instancias nuevas | **2** | **FALLA por una** |
| 0.4.3 resultado inverosímil ⇒ revisar instrumento | se activó y era correcta: las 3 causas de §2 son mías | **ACIERTA, y es la que salvó la pieza** |

**Lectura honesta.** La familia #218 **existe y es rara**: 2 instancias nuevas en 61
declaraciones ancladas, no 42. Publicar el 69 % habría sido publicar la tasa base de
un grafo de llamadas con una etiqueta alarmista encima. Lo que esta pieza deja de
verdad no es un porcentaje: es (a) las dos instancias derivadas y corregidas, (b) la
tasa base 12,9/23,4/29,6/35,1 % que cualquier futuro censo de alcanzabilidad tiene
que restar antes de llamar defecto a un positivo, y (c) el aviso de que un ancla a
±3 líneas cambia de sujeto.

---

## 5. COLA — medida, con dueño y sin cerrar

1. **Tarjeta de paridad (S)earch** — el original gasta ≥1 `rand_range(0,7)` en la
   rama de puerta secreta; el port declara esa rama portada. Cotejo del stream
   pendiente. NO tocado aquí (esta pieza no toca `game/`).
2. **#128 gana un consumidor más** — las naves NPC de vela pagan la compuerta de
   terreno de #104. La cifra de #128 debe contarlas.
3. **Las 200 declaraciones SIN ancla** siguen fuera del denominador. Hacerlas
   medibles es derivación, no censo.
4. **Los 21 L0 y los 16 L1 no leídos** quedan como cola ORDENADA por el estrato, no
   como veredictos. Se leen o no se citan.
5. **Los 47 `call` indirectos en 40 rutinas** (el detector de indirectos SÍ funciona:
   control corrido) son un techo que ninguna profundidad resuelve.
