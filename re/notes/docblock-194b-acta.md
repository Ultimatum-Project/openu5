# #194 · EJE A — careo de HERMANOS: censo re-medido, criterio calibrado y 6 rancios arreglados

Carril `docblock-194b`, rama `re/docblock-194b`, árbol base `main@e5272915`.
Residuo de la parte 1 (`generos-194-acta.md`, aterrizada en `f985dcbb`), que dejó el eje A
censado y **sin leer**.

**Titular**: el eje A tenía un criterio de ordenación —`asimetrico`, «un hermano retracta y
otro no»— y **no discrimina**: medido en los dos únicos árboles con verdad conocida, vale
`True` con el rancio canónico VIVO y `True` con el rancio ya ARREGLADO. Se sustituye por un
criterio con el MECANISMO del género dentro (la corrección que no barrió el fichero deja
rastro en el blame), que en esos mismos dos puntos **marca y limpia**. Con él en la mano, la
cabeza de la cola da **rancios reales al primer intento**: 6 sitios corregidos, y **el cabo
`MAINOUT.OVL:0x0d0e`, adjudicado** (era una atribución generalizada de más).

---

## 1. Lo que NO heredé: el censo, re-medido

La parte 1 publicó «387 pares» del eje A ancladas en `main@994d4fc2`. **No reproduce hoy**, y
por eso la regla de la casa es que una cifra de censo sin SHA es una foto:

| eje A, política ESTRICTA | `994d4fc2` (parte 1) | `e5272915` (hoy) |
|---|---|---|
| citas en `game/src` | 1957 | **2007** |
| pares `(overlay, offset)` | 999 | **1024** |
| **pares con ≥2 docblocks** | 387 | **398** |
| · con retractación asimétrica | 133 | **142** |
| eje B (atribución contradicha) | 0 | **0** |
| eje C (offset corregido en notas y aún citado) | 34 | **36** |

Reproducible: `python3 re/tools/cita_rama_hermana.py --rancio --estricta --blame`.

### 1.1 Mi propia hipótesis de partida, REFUTADA

Entré suponiendo que 398 pares serían muchas menos LECTURAS, porque dos pares que caen en los
mismos dos docblocks son un solo careo. **Falso, y por mucho**: 398 pares → **393 lecturas**
distintas (389 lecturas aportan 1 par, 3 aportan 2, 1 aporta 3). El colapso es del 1,3%. La
cifra de pares y la de trabajo humano son, aquí, prácticamente la misma.

### 1.2 ★ Lo que sí estaba mal en la premisa del encargo: el eje A NO es intra-fichero

El encargo (y la tarjeta) describen «pares de docblocks del MISMO fichero/módulo». El eje A,
como está implementado, agrupa por par `(overlay, offset)` **sin mirar el fichero**, y medido:

- **95** de las 393 lecturas son INTRA-fichero.
- **298** CRUZAN ficheros.

O sea que el 76% de la población no es lo que el encargo describía. No es un defecto —es la
cobertura BUENA, y es la que #207 pedía a gritos («agrupar por FICHERO del port vuelve a
agrupar por RUTINA del binario, cruzando ficheros»)— pero cualquiera que planifique «~387
careos de hermanos del mismo fichero» está planificando sobre una población que no existe.
Las dos cifras van ahora en la salida del instrumento, con nombre.

---

## 2. ★★ El criterio de ordenación del eje A no discriminaba, y está MEDIDO

El eje A traía `asimetrico` como orden de lectura. Hay UN caso con verdad conocida —el
canónico de la tarjeta, `COMSUBS.OVL:0x0504`, con el hermano que retracta en
`combat.ts:872-890` y el acusado en `playerAttackDir`— y hay dos árboles: `a3efe440^` (rancio
VIVO) y `main` (arreglado en `a3efe440`). El criterio tiene que dar distinto. No lo da:

| árbol | `asimetrico` | contenido real del hermano acusado |
|---|---|---|
| `a3efe440^` | **True** | «el cursor original arranca ya fijado sobre el enemigo más cercano» |
| `main` (hoy) | **True** | «⚠ El cursor original NO arranca sobre el enemigo más cercano…» |

**La causa es estructural, no un regex mal afinado**: el hermano que retracta conserva su «era
fabricación» PARA SIEMPRE —es el registro de la corrección—, así que el léxico de retractación
sigue en el fichero mucho después de que el rancio muera. Un criterio que vale lo mismo antes
y después del arreglo sirve para ordenar y **no puede usarse como progreso ni como trinquete**.
Queda dicho en la salida del instrumento, para que nadie lea los 142 como «142 por arreglar».

### 2.1 El criterio que sí discrimina: DELTA DE BLAME

El género nace de una corrección que no barrió el fichero. Eso tiene huella: **el docblock que
retracta es más NUEVO que el hermano que sigue afirmando lo retractado**, y el arreglo del
hermano pone su fecha al día. Control de DOS PUNTOS, `--control` (EXIT 0 = discrimina):

| punto | gap (retractor − hermano atrasado) | veredicto | esperado |
|---|---|---|---|
| POSITIVO, rancio VIVO (`a3efe440^`) | **+234,2 h** | MARCA | MARCA ✓ |
| NEGATIVO, rancio ARREGLADO (`HEAD`) | **−171,8 h** | LIMPIA | LIMPIA ✓ |

Población con el criterio nuevo: **88** de 398 (el orden de lectura de este acta).

### 2.2 Límites del criterio, declarados — y uno se materializó EN ESTA MISMA TANDA

1. La fecha es del último toque a CUALQUIER línea del docblock. **Un movimiento o reformateo en
   bloque iguala las fechas y deja el criterio CIEGO** (no ruidoso: ciego).
2. Líneas sin commitear no tienen `committer-time` y quedan fuera.
3. Sigue sin ser veredicto: dice qué hermano mirar primero y en qué dirección.

★ El límite (1) NO es teórico: el racimo de santuarios de §4 tiene cinco sitios, y **dos de
ellos son invisibles para mi criterio** porque el refactor de extracción del 23-07 movió la
prosa rancia en bloque a un fichero nuevo y le puso fecha nueva. El racimo entró por el sitio
que sí conservaba su fecha vieja (`shrines.ts`, 11-07). Es decir: el criterio encontró el
racimo, pero **no habría encontrado a sus dos miembros peores**, que son justo los que se
contradicen dentro del mismo fichero a doce líneas de distancia. Cualquier cota que alguien
saque de los 88 hereda esta ceguera.

---

## 3. El cabo del acta origen, ADJUDICADO: `MAINOUT.OVL:0x0d0e`

`pegajosa-96-acta.md §8.3` lo dejó «nombrado, no leído». Dos cosas, y la segunda es un rancio:

**(a) El offset no está en la población del eje A** — ni en estricta ni en pegajosa. Lo que hay
es `0x0d11`, y sólo en pegajosa. Buscarlo por donde el acta lo dejó no lo encuentra.

**(b) Leído, el port lo tiene ya derivado… y lo atribuye MAL.** `game.ts` (cabecera de
`checkWaterfall`) decía: «CATARATA (OUTSUBS 0x0458, llamada desde MAINOUT 0x05bb/0x0d0e cuando
el tile al SUR de la party — g_unk_abc7 — es una catarata)». Verificado POR CONTENIDO (no por
confianza en el carril gemelo): `call 0xfffff972` tiene **exactamente dos** ocurrencias en todo
MAINOUT, y son las dos que el port nombra. Pero el byte discriminado **no es el mismo**:

| call-site | guarda | byte discriminado |
|---|---|---|
| `MAINOUT.OVL:0x05bb`, | `0x05b2-0x05b9` (`and al,0xfc` / `cmp al,0xd4`) | `[g_unk_abc7]` — el tile al SUR ✓ |
| `MAINOUT.OVL:0x0d0e`, | `0x0d05-0x0d0c`, la misma máscara | el LOCAL `[bp - 0x10]` ✗ |

Y `[bp - 0x10]` tiene, en toda la rutina (arranca en `0x0a84`, `ret` en `0x0d20`), **UN SOLO
escritor**: `0x0c53`, alimentado por una lectura POR PUNTERO (`0x0c4a call 0xffffc232` →
`mov al,[bx]`) cuyos dos argumentos son `[g_party_x]` y `[g_party_y]` **sin ±1 en ninguno**
(`0x0c40-0x0c49`). Así que ahí el tile no es el del sur: es el de la propia casilla de la party,
y la atribución del port estaba generalizada de un call-site al otro. Corregido en sitio con la
tabla de arriba.

**Cabo que NO cierro y declaro**: qué coordenada compone exactamente `0xffffc232` (y por tanto
si en ejecución ese tile coincide con el del sur después del `inc [g_party_y]` de `0x0ccc`) no
está derivado. No he supuesto la convención de pushes — la regla de #211 y del zodíaco #70 es
que el ancla del índice la fija un argumento de papel inconfundible, y aquí no lo hay.

---

## 4. ★★ El racimo de SANTUARIOS: CINCO sitios de una sola corrección sin barrer

`F2-T6` (22-07, `game.ts:5526-5533`) derivó que la ceremonia de santuario vivo y del Codex
**cuelga del (E)nter, no del paso**: `cmd_enter` (MAINOUT `0x08de`) casa los tiles 0x19/0x11
(`0x9da→0x936` / `0x91c→0x986`) y llama `0xfffff89a`, que entra por CAST2 `0x0e76`; ése lee el
tile bajo la party (`0x0e83-0x0e96`, puntero `0x6222`) y despacha, en `0x106c`/`0x1072`, a las
dos rutinas de ceremonia: CAST2 `0x0966`, la visita a santuario vivo, y CAST2 `0x0d24`, el
peregrinaje al Codex. Con testigo P09 («>Enter the shrine of Compassion» ANTES
de «Thou dost approach…»). Y el código de hoy lo cumple: `checkShrineEntry` **sólo** conserva
la rama del santuario DESTRUIDO.

La corrección barrió el sitio que la derivó y dejó CUATRO afirmando lo contrario:

| sitio | fecha | qué decía | estado |
|---|---|---|---|
| `shrine-ceremonies.ts:113-119` | 23-07 | docblock de un campo `pendingShrine` **que ya no existe**: «meditación pendiente de respuesta Y/N», «se decide al pisar la casilla», «se ejecuta al confirmar» | ARREGLADO |
| `shrine-ceremonies.ts:203` | 23-07 | «Corre la ceremonia de santuario/Codex **AL PISAR**» | ARREGLADO |
| `shrines.ts:5-6` | 11-07 | «Santuario VIVO: **al pisar** la casilla de un santuario en pie» | ARREGLADO |
| `game.ts:389` | 15-07 | «que el port **sigue disparando ON-STEP** vía checkShrineEntry» | ARREGLADO |
| `main.ts:1537-1540` | 22-07 | «la ceremonia de santuario/Codex **corre AL PISAR**» | ⛔ EMBARGO post-GO → §6 |

★ Los dos peores están **en el mismo fichero**: `shrine-ceremonies.ts:203` dice «AL PISAR»
**doce líneas debajo** del comentario de `checkShrineEntry` que dice «ya NO corre al pisar». Y
el de `:113-119` es la variante extrema del género: **prosa que sobrevive al campo que
describía**, sentada justo encima del comentario que explica que ese campo se retiró.

Ninguna de las cinco es un valor de aserción: es prosa. Los offsets citados por el port en este
racimo los verifiqué contra el disasm y están BIEN (CAST2 `0x0e76` es efectivamente la rutina de
entrada que despacha a `0x966`/`0xd24`); lo rancio era el DISPARADOR, no la cita.

---

## 5. El sexto rancio: `LOOKOBJ.OVL:0x0132`, el callee retractado que sobrevivió

Cabeza de la cola por gap (+457 h) y rancio de libro:

- `wishingwell.ts:18` (11-07) decía: «llama a **kernel_spawn_object (0x97e4)**».
- `deriv-211-acta.md §6` (#211) dice literalmente que `0x97e4` es el **operando crudo** del
  near-call (`call 0xffff97e4` en LOOKOBJ `0x014e` — verificado en el disasm), no un
  desplazamiento del kernel, y que el callee es **ULTIMA.EXE `0x3A74` `set_actor_record`**
  (familia #188).
- #211 declara a quién barrió: la cabecera de `spawnWishHorse` y **dos** filas de
  `re/deliberate-divergences.md`. Censo del canal hoy: el único sitio de `game/src` que
  conservaba el nombre retractado era `wishingwell.ts:18`. Corregido con la cita del `call`.

---

## 6. Lo que dejo SIN cerrar (y por qué)

1. **`main.ts:1537-1540`** — quinto miembro del racimo de §4, bajo embargo post-GO. Es sólo
   prosa; hay que barrerlo cuando se abra la ventana de `main.ts`.
2. **La coordenada de `0xffffc232`** (§3), sin derivar. No la invento.
3. **305 de las 393 lecturas del eje A sin leer** (y 88−6 = 82 de la cola priorizada). Esto es
   una cabeza de cola leída, no un capítulo cerrado. La cola queda ordenada y reproducible.
4. **La ceguera del criterio ante movimientos en bloque** (§2.2). Lo barato y monótono sería
   seguir la prosa con `git log --follow`/`-M` en vez de `blame` plano; es cambio de
   instrumento con re-medición, no un ajuste.
5. **El discriminador «instrucción entrecomillada»** de §7(b): identificado y NO implementado,
   con población sin medir.

## 7. ★★ El efecto lateral de la parte 1, REPRODUCIDO — y una MIS-ATRIBUCIÓN cazada por él

La parte 1 (§7) midió que editar SÓLO comentarios mueve la banda pegajosa. Vuelve a pasar, y
esta vez lo medí contra un control PRISTINO de `main@e5272915` en lugar de contra una foto:

| corrida | FORZADA | LIMPIA | LEJANA | AMBIGUA | TOTAL |
|---|---|---|---|---|---|
| control pristino | 20 | 130 | 71 | 128 | **349** |
| mis fixes, primera versión | 20 | 130 | 71 | 130 | **351** |

El gate es un trinquete de no-crecimiento y estaba **EXIT 0**, así que nadie se habría
enterado. Diferencia por pares: **+11 altas, −1 baja**. Y las dos puntas dicen algo:

**(a) Mis 8 citas nuevas entraron por la ventana PEGAJOSA** (distancia 3-9) y con
`tokens_ventana=2`, o sea atribución AMBIGUA: mi propio docblock nombraba MAINOUT y OUTSUBS, y
las citas heredaban «la última que pasó». Apliqué la defensa que la parte 1 dejó escrita
—nombrar el overlay EN LA MISMA LÍNEA del offset— y ahora las 8 son `d=0`, `tokens=1`, es decir
política ESTRICTA. La banda vuelve a **349**, la baja se convierte en un cambio de overlay, y
mis citas dejan de depender de la distancia.

**(b) ★ La BAJA era una MIS-ATRIBUCIÓN viva en main.** El par que se caía era
`MAINOUT.OVL:0x04d0`, sembrado por la cabecera de `checkWaterfall`; el comentario, en
`game.ts`, dice «`0x04d0` `cmp cx,ax; ja` = esquiva». Leído el disasm:

| overlay | qué hay en `0x04d0` |
|---|---|
| MAINOUT.OVL | `mov word ptr [bp - 4], ax` — no se parece |
| OUTSUBS.OVL | `cmp cx, ax` y en `0x04d2` `ja 0x4dc` — **la instrucción EXACTA que el comentario entrecomilla** |

El comentario tenía razón y la atribución era falsa: es OUTSUBS (la rutina de catarata que ese
mismo docblock dice estar describiendo, OUTSUBS `0x0458`), no MAINOUT. Al añadir `OUTSUBS` en su
línea, el par pasa a `OUTSUBS.OVL:0x04d0` por la vía estricta.

★★ **Lo que esto añade al expediente del eje B**: el eje B caza mis-atribuciones cuando la línea
nombra una RUTINA en snake_case que el ledger sitúa en otro overlay. Aquí la prueba de que la
atribución es falsa **no es un nombre de rutina: es la INSTRUCCIÓN ENTRECOMILLADA**. `cmp cx,ax`
casa con OUTSUBS `0x04d0` y no con MAINOUT `0x04d0`, y eso es verificable mecánicamente contra
el disasm. Es un discriminador NUEVO para el mismo género, más barato que el ledger y sin
depender de que el port use el nombre canónico. Lo dejo apuntado como cabo de instrumento —**no
lo he implementado**, y su población está SIN MEDIR (no digo cuántas más hay, porque no lo sé).

## 8. ★★ ADENDA — el caso de `words.ts` (#149) MIDE mi criterio, y lo suspende

Aviso del lead: el carril `geometria-149` aterrizó en `211b4e7d` (padre = `e5272915`, mi propia
base) una corrección **de este género**: `quest/words.ts` decía «el yell es DIRECCIONAL … las
celdas ADYACENTES (party+dir)» y se contradecía a doce líneas con «las **4** celdas adyacentes
al party». Es un caso REAL del género hallado por LECTURA de otro carril, sin mi instrumento —
o sea, un control positivo INDEPENDIENTE que yo no había pedido. Lo corrí, y el resultado es
malo para mi criterio. Tres medidas, ninguna favorable:

**(a) El par SÍ está en mi población.** `CMDS.OVL:0x12c8` está en el eje A estricto con SEIS
docblocks (`dungeon-cmds.ts:84`, `game.ts:844/4109/4113/5580`, `words.ts:53-70`).

**(b) Mi criterio NO lo prioriza: se ABSTIENE.** `asimetrico=False`, `gap=None`,
`rancio_candidato=False` ⇒ **fuera de la cola de 88**. Cayó en las 305 sin leer.

**(c) Y la razón es estructural, no de umbral.** Las dos frases que se contradicen viven en el
MISMO docblock (`words.ts:53-70`; verificado: `docblock_at(:59)` y `docblock_at(:67)` devuelven
la misma clave `53-70`). Mi unidad de lectura **colapsa las dos en una sola entrada**, así que
un párrafo que se contradice consigo mismo **no puede formar par por construcción**. Y el
criterio de blame necesita un hermano que retracte y otro que no: cuando nadie escribió nunca
la retractación —el texto simplemente se contradice solo— **no hay gap que medir**.

★ **Cota de la abstención, medida**: de los 398 del eje A, el criterio de blame **se abstiene en
253 (64%)**, marca 92 y limpia 53. Es decir: mi ordenación sólo dice algo sobre un tercio de la
población, y el tercio del que calla incluye **la mitad entera del género que la tarjeta nombra**
—«contradicha por … SU PROPIO CUERPO»—, que el eje A no puede ver con la unidad DOCBLOCK.

**Lo que esto corrige de mi propio titular de §2**: el criterio nuevo discrimina donde
`asimetrico` no discriminaba, y eso sigue en pie; pero **no es un detector del género, es un
detector de la variante ENTRE HERMANOS con retractación escrita**. La variante intra-docblock
necesita otra señal (contraposición léxica dentro del mismo párrafo: «DIRECCIONAL/party+dir» vs
«las 4 celdas»), que hoy sólo encuentra la lectura humana. No la he implementado y su población
está SIN MEDIR. Cabo, no cifra.

⚠ **Y una advertencia sobre la propia cifra 92**: eran 88 antes de mis fixes, sobre la misma base
y el mismo disasm. El delta es MÍO por eliminación: mi prosa de corrección introduce léxico de
retractación («⚠ … RETIRADA», «corregido en #194») y citas estrictas nuevas, que crean
asimetrías donde no había. Es el fenómeno de la parte 1 («el detector se lee a sí mismo»)
repetido en el eje A: **92 no es crecimiento de defectos, es mi propio texto entrando en el
corpus.** Quien vigile esta cifra tiene que restar los carriles de prosa antes de leer tendencia.

## 9. TRAMO 2 de lectura — la PRECISIÓN del criterio, medida en la cabeza de la cola

Encargo del lead: seguir con las 305. Leídas **6 posiciones de cabeza** (las de mayor gap), con
sus dos matices aplicados. El resultado importa más como calibración que como cosecha:

| # | par | gap | veredicto |
|---|---|---|---|
| 1 | `LOOKOBJ.OVL:0x0132` | +457 h | **RANCIO** → 1 fix (§5) |
| 2 | `CMDS.OVL:0x1202` | +457 h | **RANCIO** → destapa el racimo de 5 sitios (§4) |
| 3 | `CMDS.OVL:0x12a2` | +456 h | (a) sin contradicción |
| 4 | `COMSUBS.OVL:0x0312` | +456 h | (a) sin contradicción |
| 5 | `CMDS.OVL:0x0d98` | +451 h | (a) sin contradicción |
| 6 | `MAINOUT.OVL:0x01fe` | +434 h | (a) con nota, no rancio |

★ **PRECISIÓN MEDIDA: 2 de 7 en la CABEZA de la cola** (la 7ª en §9.3) (donde el criterio es más fuerte). Y el
modo de fallo es SIEMPRE el mismo y es estructural, no de umbral: **en este repo casi cada
arreglo deja un hermano que dice «X era FABRICADO»**, y ese léxico es justo lo que el criterio
mide. Así que `gap > 0` se dispara en cuanto CONVIVE una corrección documentada con cabeceras
que hablan de otra cosa del mismo offset — sin que ninguna esté rancia. Ejemplos leídos:
`0x0312` (el hermano retracta el formato `"{} hits {} for {}."` de #143 mientras los otros dos
describen quién imprime qué, sin conflicto) y `0x0d98` (el hermano retracta el «Torch ignited!»
fabricado mientras otro habla del COSTE DE TURNO y otro de la DURACIÓN de la antorcha: tres
temas distintos del mismo offset).

**Consecuencia para quien siga**: el criterio sirve para ORDENAR y su rendimiento en cabeza es
~1 rancio cada 3 lecturas. No es una tasa que justifique leer los 92 a ciegas; conviene el
paso previo de mirar SI los hermanos hablan del MISMO ASPECTO del offset (mensaje vs coste vs
duración), que hoy hace el humano en la primera ojeada.

### 9.1 Los dos matices del lead, anotados y aplicados

**(a) Cruce de ficheros sin derivación en ninguno de los dos lados = SIN-DERIVAR, no rancio.**
No se ha dado en este tramo (las 6 tenían derivación en al menos un lado), pero queda como
regla de adjudicación para las 298 lecturas que cruzan ficheros: si los dos lados afirman cosas
distintas y ninguno cita derivación, **se declara y no se elige bando**.

**(b) El delta-de-blame ORDENA, no ABSUELVE.** Por la ceguera a movimientos-en-bloque (§2.2:
el refactor del 23-07 re-fechó los dos peores del racimo de santuarios), **la cola baja no está
limpia: está sin medir**. Nadie debe leer «los últimos 100 son limpios» ni tratar el orden como
un ranking de gravedad. Dicho aquí porque es la lectura que la cifra invita a hacer.

### 9.2 `MAINOUT.OVL:0x01fe` — por qué (a) y NO rancio, aunque lo roce

El hermano atrasado (`transport.ts:296-298`, 11-07) es un rótulo de sección:
«ship_try_move (MAINOUT 0x01FE) — atraque/colisión/BREAKING UP/cactus/bloqueo». Sus hermanos
nuevos (arreglados en la parte 1 y en #178) avisan de que ese nombre **no describe su dominio**
y que la cola de bloqueo la COMPARTEN pie y vehículo. El rótulo no AFIRMA lo contrario: enumera
alcance. Es la «etiqueta de ALCANCE heredada» de la que ya avisa el docblock vecino, no una
afirmación contradicha. **No lo edito**: convertir un rótulo en cita sería inventar un defecto,
y cada edición de prosa mueve el corpus (§7). Queda anotado por si el barrido de #178 lo quiere.

### 9.3 ★ La advertencia del 88→92, ahora como INSTANCIA MEDIDA: `MAINOUT.OVL:0x0a84`

Séptima lectura, y la cabeza de cola tras adjudicar las 6 anteriores. Veredicto: **(a) sin
contradicción, y el candidato lo FABRIQUÉ YO**. Sus dos docblocks son:

- `core/__parity__/master-run.ts:1-24` (11-07, el «atrasado»): «outdoor×K turnos del bucle
  exterior (MAINOUT 0x0A84: viento→hazard→housekeeping→spawn)».
- `core/game.ts:1561-1596` (**30-07 — mi propio fix del cabo de §3**), que cita
  `MAINOUT 0x0a84` al derivar de dónde sale `[bp - 0x10]`.

Las dos afirmaciones son compatibles entre sí: `0x0a84`, la rutina del turno exterior, contiene
en su cola la comprobación de catarata. No hay nada rancio. El par **no existía en main**: lo
creé al escribir la cita `MAINOUT 0x0a84`, y sube a candidato porque mi texto lleva léxico de
retractación («★ corregido en #194», «no supongas la convención») y es más nuevo que el
docblock de 2026-07-11.

★ Esto convierte la advertencia abstracta de §2 —«92 no es crecimiento de defectos, es mi propio
texto entrando en el corpus»— en un **caso concreto y nombrado**: al menos 1 de los 4 candidatos
nuevos es un artefacto de mi propia corrección. Quien vigile la cifra debe restar los carriles
de prosa, y quien lea la cola debe saber que **las posiciones fechadas HOY pueden ser del propio
carril que las está leyendo**.

## 9.4 PRE-FILTRO de «MISMO ASPECTO» — la REGLA, escrita ANTES de aplicarla

GO del lead (opción i) con cuatro condiciones. Ésta es la (1): la regla queda fijada aquí antes
de correrla, para que no sea el enésimo criterio calibrado a posteriori contra su propia salida.

### La regla, y de dónde sale

El modo de fallo medido en §9 es referencial, no temático: un hermano **retracta** algo
(«X era FABRICADO») y el otro habla de **otro aspecto** del mismo offset. La observación que lo
convierte en regla es más simple que una taxonomía de temas:

> **Una retractación sólo puede dejar RANCIO a un hermano que MENCIONE lo retractado.**
> Si el hermano atrasado no habla del objeto que la retractación retira, no puede estar
> afirmándolo, y el par no es del género por más que el gap sea alto.

Así que el filtro es una prueba **REFERENCIAL**, no de tópico:

1. Del docblock que retracta se extraen las **FRASES de retractación** (las que casan
   `RETRACT_RE`), no el docblock entero — el resto del docblock habla de otras cosas y
   contaminaría la comparación.
2. De esas frases se sacan los **TOKENS DISTINTIVOS**: offsets hex (`0x…`), identificadores
   `snake_case`, fragmentos entre comillas/«» y palabras de contenido de ≥5 letras fuera de una
   stoplist.
3. El par **SOBREVIVE** si el hermano atrasado contiene **al menos un** token distintivo de la
   retractación. Si no comparte ninguno, se **DESCARTA** por aspecto distinto.

**Por qué unigramas de contenido y no sólo bigramas**: el control positivo del racimo de
santuarios comparte «pisar» pero **no** comparte ningún bigrama de contenido («corre pisar» vs
«pisar casilla»). Con bigramas el filtro suspendería su propio control ⇒ por la condición (2)
del GO no se podría aplicar. El precio es que el filtro es **conservador**: retiene falsos
positivos cuyo solape es el NOMBRE DEL SUJETO (en `CMDS.OVL:0x0d98` los dos hermanos dicen
«torch» aunque uno habla del coste de turno y el otro de una cadena fabricada). Descarta poco y
seguro, en vez de mucho y a ciegas — es la dirección correcta del error para un filtro que se
aplica ANTES de leer.

### Lo que el filtro NO afirma (condición 3 del GO, escrita donde se lee la cifra)

**DESCARTADO ≠ LIMPIO.** El filtro no adjudica: aparta pares en los que la retractación y el
hermano no hablan del mismo objeto, con una heurística de una ojeada y sobre TEXTO, no sobre
binario. Un descartado puede seguir siendo rancio por otra vía (p. ej. su cuerpo lo desmiente,
que es la mitad de #239, o la retractación está en una NOTA y no en un hermano). La cifra de
descartados mide **cuánta lectura ahorra**, no cuánta prosa está sana. Se hereda además la
ceguera del delta-de-blame (§2.2): esto filtra DENTRO del tercio que el criterio ve.

## 9.5 El filtro, CALIBRADO y MEDIDO — y su control cazó un defecto mío antes de aplicarlo

### Condición (2): los TRES positivos SOBREVIVEN — `--control-filtro` EXIT 0

| positivo | árbol donde el rancio VIVÍA | resultado | solape |
|---|---|---|---|
| `LOOKOBJ 0x0132`, con el callee que #211 retractó | `e5272915` | SOBREVIVE | `0x97e4` |
| `CMDS 0x1202` (racimo de santuarios) | `e5272915` | SOBREVIVE | `pisar`, `santuario` |
| `COMSUBS 0x0504` (canónico de la tarjeta) | `a3efe440^` | SOBREVIVE | `cursor`, `enemigo`, `cercano`… |

★★ **Dos cosas que el control descubrió, y ninguna la habría visto yo leyendo mi propio código:**

**(a) Un rancio ARREGLADO se cae de la cola, así que el control hay que medirlo en el árbol
histórico.** Mi primera versión del control miraba HEAD y falló con
«`LOOKOBJ 0x0132` no está en la cola de candidatos». No era un fallo del filtro: es que **mi
propio fix lo limpió** — al poner la retractación TAMBIÉN en el hermano, ya no queda hermano «sin
retractar» y el delta-de-blame se abstiene. Es una **segunda confirmación independiente de que el
criterio de §2.1 discrimina**: aclaró tras un arreglo real hecho por mí, que es exactamente lo
que `asimetrico` no hacía. Y obliga a anclar cada positivo a su propio rev (`POSITIVOS_FILTRO`).

**(b) El filtro suspendía su propio control por partir mal las frases.** Partía también por
`\n`, y en un comentario ENVUELTO eso corta la frase en dos: en `0x0132` el objeto retractado
(`0x97e4`) quedaba en una línea y la marca («cita corregida aquí») en la siguiente, así que la
frase de retractación salía sin el token que la identifica y el par se **descartaba**. Arreglado
desenvolviendo el docblock antes de partir (`_desenvolver`). **Sin la condición (2) del GO habría
aplicado un filtro que aparta uno de mis dos rancios confirmados.**

### La medida (ancla `main@cba82e40` + esta rama)

| | pares |
|---|---|
| candidatos del delta-de-blame | **92** |
| **SOBREVIVEN** al filtro (a leer) | **43** |
| **DESCARTADOS** por aspecto distinto | **49 (53%)** |

### Careo del filtro contra mis 7 lecturas a mano — coincide, y falla donde predije

| par | mi lectura | filtro | ¿de acuerdo? |
|---|---|---|---|
| `CMDS.OVL:0x1202` | RANCIO | sobrevive | ✓ |
| `CMDS.OVL:0x12a2` | (a) | descarta | ✓ |
| `COMSUBS.OVL:0x0312` | (a) | descarta | ✓ |
| `MAINOUT.OVL:0x0a84` | (a), fabricado por mí | descarta | ✓ |
| `MAINOUT.OVL:0x01fe` | (a) con nota | sobrevive | conservador (borderline) |
| `CMDS.OVL:0x0d98` | (a) | **sobrevive** | ✗ **el fallo PREDICHO**: solape `torch`, el nombre del sujeto |
| `LOOKOBJ.OVL:0x0132` | RANCIO (arreglado) | fuera de cola | n/a |

O sea: **de las cinco decisiones de descarte evaluables acierta cuatro**, y la que falla es
literalmente el caso que §9.4 anticipó al elegir unigramas de contenido para no suspender el
control. Un filtro especificado antes de correr, cuyo control caza un defecto propio y cuyo único
fallo estaba pre-declarado, es lo más cerca que he llegado de calibrar de verdad.

### ⚠ Reserva de la cifra (condición 3 del GO)

**Los 49 descartados NO están limpios: están APARTADOS.** El filtro dice «la retractación de este
par no habla del objeto del que habla el hermano atrasado», y eso es todo. Un descartado puede ser
rancio (i) por su propio CUERPO —la mitad de #239, invisible aquí—, (ii) porque la retractación
viva en una NOTA y no en un hermano (eje C), o (iii) porque el solape exista con palabras que mi
stoplist se come. Y todo esto ocurre **dentro del tercio que el delta-de-blame ve**: los 253 pares
en los que el criterio se abstiene (64%) no los toca ni el filtro. La cifra mide **lectura
ahorrada**, no prosa sana.

## 9.6 CONDICIÓN 5 (AUTO-ARTEFACTO) — y la cola real del eje A: 38, no 92

Quinta condición del GO, que sale del hallazgo de §9.3: **un par cuya RETRACTACIÓN es prosa de
este carril no es un hallazgo, es un artefacto de nuestra propia escritura**; se aparta de la cola
y **no cuenta en la precisión**.

**Implementado por SHA, no por fecha.** «Fechado hoy» depende del reloj, de cuándo se relea el
acta y de si hubo rebase; la pertenencia a `e5272915..HEAD` es exacta y reproducible. La marca la
pone la línea **más nueva** del docblock que retracta — la que fija su fecha y por tanto crea el
gap.

⚠ **Error propio, declarado y re-medido**: mi primera versión exigía que **todos** los SHAs del
docblock fueran del carril (`⊆`), y eso da **CERO** — un docblock que yo amplío conserva líneas
ajenas, así que la condición no se cumple casi nunca y **dejaba pasar su propio ejemplar
canónico** (`MAINOUT.OVL:0x0a84`). Corregido a «SHA de la línea más nueva ∈ carril».

### La cola real, medida

| | pares |
|---|---|
| candidatos del delta-de-blame | **92** |
| **AUTO-ARTEFACTO** (condición 5) | **8** |
| DESCARTADOS por otro aspecto (condición 1) | **46** |
| **COLA REAL A LEER** | **38** |

De los 8 auto-artefacto, **5 habrían sobrevivido al filtro de aspecto** y habrían llegado a
lectura: ése es el valor medido de la condición 5, **5 lecturas ahorradas** que además habrían
contaminado la precisión con prosa mía.

### ★★ Las condiciones 2 y 5 se CONTRADICEN sobre el mismo par, y las dos tienen razón

`CMDS.OVL:0x1202` —el racimo de santuarios— sale **AUTO-ARTEFACTO** en HEAD **y** es uno de los
tres positivos que la condición 2 exige que **sobrevivan**. No es una incoherencia: **miran
árboles distintos**, y las dos lecturas son correctas.

- En el **material histórico** (`e5272915`) el hermano que retracta NO era mío ⇒ era un rancio
  real, el filtro debe conservarlo, y la condición 2 lo comprueba ahí.
- En **HEAD**, tras mi fix, el hermano que retracta **es mi prosa** ⇒ volver a leerlo sería leer
  mi propio arreglo, y la condición 5 lo aparta.

★ La regla que esto deja: **una condición sobre «de quién es la prosa» sólo tiene sentido con el
ÁRBOL declarado al lado.** Quien mezcle los dos árboles concluirá que el filtro está roto — y no
lo está: es que un rancio arreglado cambia de dueño.

### Precisión, recalculada con la condición 5

De mis 7 lecturas del tramo 2, `MAINOUT.OVL:0x0a84` es auto-artefacto y **sale del denominador**:
**2 rancios de 6 lecturas evaluables**. La cifra que hay que llevarse no es esa, sino la de la
cola nueva: 38 pares por leer, con la reserva de §9.5 intacta (los 46 descartados están
APARTADOS, no limpios, y los 253 de abstención no los toca nada de esto).

## 9.7 TRAMO 3 (condición 4) — primer superviviente leído: RANCIO REAL sobre CONSUMO DE RNG

Primera lectura entera de la cola nueva de 38. `SJOG.OVL:0x0e22` (+428 h, solape `0x84`/`0x85`).

**Los dos hermanos**, y el atrasado verificado ANTES de tocarlo contra `main@ac5a929b`
(byte-idéntico al de mi base, así que no hay deriva):

- `core/game.ts:3564-3612` (28-07, #148) — describe TRES gates de `SJOG 0x0E22`, y dice del
  primero: en pueblo sin ocupante «imprime «No one is there!» (DS 0x8AFE) y retorna por 0x0d70
  — **SIN la tirada de 0x0E54**… si entrara después, el stream RNG ya se habría movido».
- `core/world/commands.ts:236-239` (atrasado) — «pueblo y mazmorra convergen en la tirada:
  `rand(0,29)` **SIEMPRE** (0e54)».

**El binario decide, y da la razón al nuevo** (`SJOG.OVL`, leído entero):

| offset | instrucción | qué hace |
|---|---|---|
| `0x0e22`, | `cmp byte ptr [g_location], 0x80` / `jae 0xe42` | mazmorra ⇒ salta el check de ocupante |
| `0x0e35`, | `call 0x770e` | pueblo: busca ocupante |
| `0x0e38`, | `or ax, ax` / `jne 0xe42` | si HAY ocupante, sigue |
| `0x0e3c`, | `mov ax, 0x8afe` / `jmp 0xd70` | si NO hay: «No one is there!» y **RETORNA** |
| `0x0e54`, | `sub ax,ax` / `mov ax,0x1d` / `call 0x6112` | la tirada `rand(0,29)` — **inalcanzable por esa vía** |

⇒ el «SIEMPRE» es **FALSO como propiedad del binario**: la vía pueblo-sin-ocupante retorna en
`0x0e3f` sin consumir tirada. Y no es una imprecisión inocua: es una afirmación sobre **consumo
de RNG**, que en este puerto es el eje de paridad más sensible.

**Matiz que sí concedo, y por eso el fix es de ALCANCE y no de borrado**: el comentario vive
DENTRO de `jimmyLock`, a la que el caller sólo llega tras superar el gate. «Siempre» es cierto
*dado que has llegado aquí*. Lo que estaba mal era enunciarlo como propiedad del binario citando
el offset. El texto nuevo mantiene la afirmación **acotada** («una vez superado ese gate»),
nombra la vía que retorna antes con sus tres instrucciones y remite a la cabecera de #148 que
explica por qué el gate vive en `game.ts` ANTES de `jimmyLock`.

★ **Séptimo rancio del carril, y el primero que sale de la cola FILTRADA** — es decir, el filtro
de §9.4 lo puso en cabeza y la lectura lo confirmó. Precisión de la cola nueva: **1 de 1**
(muestra de tamaño 1: no es una tasa, es un dato).

## 9.8 TRAMO 4 — dos (a) más, y una FORMA del hermano atrasado que se repite

| par | gap | hermano atrasado | veredicto |
|---|---|---|---|
| `MAINOUT.OVL:0x04d3` | +403 h | `transport.ts:157` (**1 línea**) | (a) — y el nuevo CITA al viejo |
| `BLCKTHRN.OVL:0x0910` | +377 h | `blackthorn.ts:389-391` (**3 líneas**) | (a) — rótulo de sección |

**`0x04d3`** es un caso que merece nombre propio: el atrasado es
`/** turn_arg por dirección (MAINOUT 0x04D3): N→0, E→1, S→2, O→3. */`, y el hermano nuevo
(`transport.ts:193-220`, la derivación del sprite de caballo/alfombra) **se apoya en él
explícitamente**: «Con N=0/E=1/S=2/O=3 (MAINOUT 0x04D3, el `TURN_ARG` de arriba)». No es que no
se contradigan: es que uno es la **fuente** del otro. Un par así no puede ser rancio salvo que la
fuente esté mal, que es otra investigación.

**`0x0910`** repite la forma de `MAINOUT.OVL:0x01fe` (§9.2): el atrasado es un **rótulo de
sección** —una línea que dice «Refuge / party-wipe» y nombra la rutina— entre los 17 docblocks
del par. Un rótulo enumera alcance, no afirma. Sin editar, por lo mismo de §9.2.

⚠ **Cuarta vez que `seed_gate` me para en este carril**, y esta con causa distinta y que vale
apuntar: **citar prosa ajena VERBATIM re-siembra**. Al transcribir el rótulo con su nombre de
rutina pegado al offset, el gate lo leyó como una atribución MÍA — no puede distinguir «estoy
citando» de «estoy afirmando». Reescrito. Para quien redacte actas: al copiar un rótulo o un
comentario que nombre rutina junto a offset, **parafrasea o separa**, no pegues el literal.

### ★ La forma se repite: MIDO en vez de seguir a ciegas

Los cuatro casos leídos de la cola filtrada se parten limpio por el **tamaño del hermano
atrasado**: los dos (a) tienen atrasado de **1 y 3 líneas** (rótulo o doc de constante) y los dos
RANCIOS lo tienen de **4 y 18** (prosa con tesis). Medido sobre los 37 supervivientes vivos:

| forma del hermano atrasado | pares |
|---|---|
| **≤3 líneas** (rótulo / una-línea / doc de constante) | **14** |
| **≥4 líneas** (prosa con tesis) | **23** |

⚠ **NO lo aplico como filtro**, y es deliberado: `n = 4` no es una calibración, y un rótulo
*podría* mentir (si nombrara mal la rutina, que es justo el género de #178). Lo uso sólo como
**ORDEN**: leer primero los 23. Si alguien lo quiere como filtro, necesita el mismo trato que el
de §9.4 — regla escrita antes, controles positivos que sobrevivan, y la reserva de que apartar
no es limpiar.

### Tercera vez que un rancio ARREGLADO abandona la cola

Tras el fix de §9.7, `SJOG.OVL:0x0e22` **sale de los supervivientes** (38 → 37): al ponerse al día
el hermano atrasado, el gap deja de existir. Es la tercera confirmación independiente —tras
`0x0132` y el par canónico— de que el criterio **aclara tras un arreglo real**, y la razón por la
que las cifras de esta cola bajan solas según se trabaja.

## 9.9 TRAMO 5 — `SJOG.OVL:0x1458`: (a) en lo disputado, pero destapa TRES NOMBRES VIVOS

**Veredicto del careo: (a).** El hermano que retracta (`game.ts:4810-4825`, «CORREGIDO t#63»)
retira dos cosas —que la antorcha colgara de la rama de SJOG `0x148c`, y que marcara
`[bx+0x5840]`— y las
reasigna a la PIEDRA LUNAR (kind 0x19) y a `g_torches`. El atrasado (`items.ts:67-80`) habla de
**otras ramas**: tiles 0xB4/0xB5/0xB6, las de SJOG `0x16b6`, `0x16e6` y `0x1706`, y los flags
0x57B6/0x57B4/0x57B5.
Ningún solape con lo retractado ⇒ nada rancio. (El filtro lo retuvo por `objeto`/`nombre`/`0xff`,
otro solape por vocabulario de dominio, como el `torch` de §9.5.)

### ★ Pero la lectura destapa un hallazgo de la ENFERMEDAD HERMANA (#178)

Censo mecánico sobre `game/src`, excluyendo las citas de `0x1458` que son de **CMDS.OVL** —el
prompt del (Y)ell, otra rutina en otro overlay— y que son 2:

| nombre usado en el port para `SJOG.OVL:0x1458` | sitios | ¿en `frontier.json`? |
|---|---|---|
| `get_item_switch` | **4** | **SÍ** — el nombre del ledger; su ficha da size 838 |
| `apply_item_grant` | **8** | **NO** |
| `get_special_item` | **6** | **NO** |

**Dieciocho sitios, TRES nombres, y el ledger conoce UNO.** Los dos huérfanos no están tampoco
en `old_names`, así que **un censo por SÍMBOLO de cualquiera de los dos da CERO EN FALSO** — que
es exactamente el canal que `old_names[]` existe para tapar. Es la misma enfermedad que la parte 1
de este carril encontró en `MAINOUT.OVL:0x01fe`, donde convivían un nombre acuñado en un acta y
el del ledger, y que #178 está
curando.

**NO lo renombro, y es decisión, no pereza**: son 14 sitios en 6 ficheros, el renombre en prosa
mueve semillas de nombre (`seed_gate`) y la banda pegajosa, y **el dueño del género es #178**.
Además mi encargo vigente es cerrar el eje A, no abrir un lote de renombre. Va como **cabo con
censo hecho** —los 14 sitios están listados arriba, así que quien lo tome no repite la medida— y
como **propuesta de tarjeta al lead**, sin auto-asignarme.

⚠ Y una precisión que evita un cero en falso a quien lo recoja: **ese mismo número de offset existe
en DOS overlays**.
En CMDS.OVL es el prompt de palabra del (Y)ell. Cualquier barrido por offset desnudo los mezcla;
hay que filtrar por overlay, como hace la tabla de arriba.

### ⚠ Y la ironía, medida: escribí la regla en §9.8 y la rompí CINCO veces en §9.9

El tramo 4 cerró con la causa nueva del `seed_gate` («citar prosa ajena verbatim re-siembra;
parafrasea o separa»). Al redactar ESTA sección la rompí **cinco veces seguidas** —
`move_try`, `sconce`, `ramas`, y dos formas distintas junto al offset del ítem— porque para
explicar un hallazgo de NOMBRES hay que escribir nombres al lado de offsets, que es exactamente
la forma prohibida. No es descuido aislado: **la sección que documenta el género es la que más
tiende a incurrir en él**. Reescritas las cinco; el gate quedó en EXIT 0. Lección práctica que
añado a la de §9.8: cuando el tema del párrafo SEA la nomenclatura, escribe los nombres en
CELDA DE TABLA o entre backticks aislados, nunca en prosa corrida pegados al offset.

## 9.10 TRAMO 6 — `SJOG.OVL:0x18ce`: (a), y la variante «fuente-del-otro» por SEGUNDA vez

Racimo de 14 docblocks. El atrasado (`game.ts:966-972`, 13-07; **byte-idéntico en el main del
momento**, verificado antes de mirarlo) deriva un orden LIFO: la colocación llena ranuras de
arriba abajo y el (G)et barre de abajo arriba, así que recoge la última colocada.

Los dos hermanos nuevos **no lo contradicen, y por razones distintas**:

- `combat.ts:2804-2811` (24-07) afirma **lo mismo** y además **cita al atrasado como acuerdo**
  («mismo modelo que game.lootAt #13»). Es la segunda aparición de la variante **fuente-del-otro**
  de §9.8: un hermano que se apoya en el atrasado en vez de contradecirlo. Con dos casos ya no es
  anécdota; conviene que el catálogo del género la lleve.
- `game.ts:4899-4910` (27-07, la más nueva y la que crea el gap) habla del **gate de dirección de
  los platos** (#39): otro aspecto del mismo offset, sin relación con el orden de ranuras. Tercer
  ejemplar del modo de fallo conservador de §9.5.

**Veredicto: (a).**

---

## 10. ESTADO DEL EJE A al cerrar este carril

| | |
|---|---|
| pares del eje A (estricta), `main@cba82e40` | **398** en 393 lecturas (95 intra-fichero · 298 cruzando) |
| criterio de blame: MARCA · LIMPIA · **SE ABSTIENE** | 92 · 53 · **253 (64%)** |
| de los 92: auto-artefacto · descartados · **cola real** | 8 · 46 · **38** |
| leídos y adjudicados en este carril | **12** (11 evaluables tras auto-artefacto) |
| **rancios corregidos** | **7 sitios** (racimo de santuarios ×4 + `wishingwell` + cabo de la catarata + `commands.ts` §9.7) |
| cabo del acta origen | `MAINOUT.OVL:0x0d0e` **adjudicado** |
| mitad INTRA-DOCBLOCK del género | **fuera de alcance**, remitida a **#239** |

**Lo que NO queda cerrado, en una lista**: las 38 de la cola real · los 253 de abstención (que no
son «limpios»: son **no medidos**) · `main.ts:1537-1540` (embargo) · la coordenada de
`0xffffc232` · el discriminador de instrucción-entrecomillada (**#236**) · la mitad
intra-docblock (**#239**).

## 11. ⚠ HALLAZGO COLATERAL PARA LA FLOTA: un ROJO EN FALSO que todo worktree hereda

`game/tests/i18n-corpus-inventory.test.ts` sale **ROJO en cualquier worktree que symlinkee
`game/assets` por entradas**, y VERDE en el checkout principal. Mismo commit, misma suite:

| árbol | resultado |
|---|---|
| worktree con `game/assets` symlinkeado POR ENTRADAS (el mío **y** un control PRISTINO de `main@e5272915`) | 1 failed \| 308 passed |
| checkout principal (`game/assets` real) | **5 passed**, EXIT 0 |

### ⚠ CORRECCIÓN DE MI PROPIO TESTIMONIO (la firma que publiqué era PARCIAL)

Publiqué `gaps.stale = ["talk/keep.json", "talk/towne.json"]`. **Son NUEVE, no dos**:
`maps/combatmaps.json`, `maps/dungeons.json`, `maps/overworld.json`, `maps/smallmaps.json`,
`maps/underworld.json`, `talk/castle.json`, `talk/dwelling.json`, `talk/keep.json`,
`talk/towne.json`. **Error mío de LECTURA, no del instrumento**: leí la COLA del diff de vitest
en vez del bloque entero, y la cola cortaba justo en las dos últimas. Es el género «un informe
de lectura es TESTIMONIO» aplicado a mí mismo, y lo cazó otro carril (#187 §6bis) al notar que
el mecanismo predecía CUATRO bajo `talk/` y mi firma traía DOS. Tenía razón: hay 4 `.json` bajo
`talk/` y los 4 están en el inventario.

### Mecanismo COMPLETO, y la TOPOLOGÍA es lo que decide

`game/tools/i18n-corpus.mjs:217-219` recorre con `readdirSync(..., {withFileTypes: true})` y
sólo desciende `if (ent.isDirectory())`, que es FALSE para un symlink. Pero eso **sólo afecta a
los subdirectorios**: los ficheros se recogen por el sufijo `.json` del nombre, sin exigir
`isFile()`, así que un symlink-a-FICHERO entra igual. Medido en mi árbol: `game/assets` tiene 42
entradas, 39 resuelven a fichero (21 `.json` en el tope, todos VISIBLES) y 3 a directorio
(`maps/` 5 + `talk/` 4 = **los 9 invisibles**).

Experimento propio de tres brazos (`readdirSync` recursivo sobre las tres topologías):

| topología | `.json` vistos | bajo `maps/` | bajo `talk/` |
|---|---|---|---|
| `assets` REAL | 30 | 5 | 4 |
| **UN solo symlink al PADRE** `assets` | **30** | **5** | **4** |
| symlink POR ENTRADAS (hijos) | 1 | 0 | 0 |

★ **Con el padre symlinkeado el resultado es IDÉNTICO al árbol real**, porque `readdirSync`
resuelve el symlink final de la ruta y sus hijos vuelven a ser dirents normales. O sea que el
rojo **no lo causa «symlinkear assets»: lo causa symlinkear ENTRADA POR ENTRADA**, que es
justamente la receta que traía mi encargo. Corrobora la lectura de topología de #187 §6bis, por
vía independiente.

**Vía barata para la flota** (y es un cambio de RECETA, no de código): symlinkear `game/assets`
como UN solo enlace al padre. ⚠ LÍMITE DECLARADO: he verificado que eso arregla ESTE walker; **no**
he comprobado que no rompa otra cosa (vite, build, otros tests), así que no lo propongo como
regla hasta que alguien lo mida. La otra vía es el fix del walker (`statSync` o
`{recursive:true}`).

★ El peligro no es el rojo: es que alguien lo tome por real y **«arregle» el inventario**
borrando entradas vivas, que es corrupción de `main` desde un artefacto de worktree.
Tarjeta #235 abierta por el lead (lleva mi cifra vieja: **avísese de que son 9**).

**Mis gates de vitest se leen con esto delante** (con la firma corregida de 9 arriba): mi corrida y la del control pristino son
IDÉNTICAS en conjunto y en conteo (1 failed | 308 passed · 3949 passed | 1 skipped), así que
mis ediciones añaden CERO fallos.

---

## 12. RELEVO — la cola SERVIDA, y por qué la sirvo en vez de seguir

### 12.1 El criterio fino, aplicado a mí mismo

La pregunta no es «¿estoy cansado?» sino **«¿mis fallos recientes son del tipo que ESTA tarea
detecta?»**. Inventario honesto de esta sesión:

| fallo mío | ¿del tipo que la tarea detecta? | ¿quién lo cazó? |
|---|---|---|
| `seed_gate` ×7 (forma de cita) | de FORMA, no de contenido | el gate, 7 de 7 |
| el `⊆` de la condición 5, que daba CERO | **sí** (instrumento que pasa su propio caso) | mi control, antes de aplicar |
| el partidor por `\n` que suspendía el control del filtro | **sí** | la condición 2, antes de aplicar |
| **publicar 2 `stale` cuando eran 9** | **sí, y es el peor** | **otro carril, NO yo** |

Los tres primeros están dentro de la red. El cuarto **no**: publiqué una lectura PARCIAL como si
fuera completa, y lo cazó la predicción de otro carril. Ése es exactamente el fallo que esta
tarea detecta y el único que se me escapó.

### 12.2 El dato que decide, y no es la fatiga

Lo que queda es **17 lecturas** (20 pares; cuatro comparten el atrasado `movement.ts:256-269`,
así que son UNA lectura) de racimos grandes — hasta 28 líneas de atrasado y 7 docblocks. Y **los
gaps han colapsado**: la cola empezó en +457 h y lo que resta va de **+275 h a +2 h**. Un gap de
+2 h no es señal: es ruido de commits del mismo día. O sea que **el resto de la cola es
precisamente donde el criterio tiene MENOS poder discriminante**, y coincide con el punto donde mi
único fallo no-cazado (leer un bloque grande y publicarlo como completo) es más probable y **menos
verificable por otros** — nadie re-lee un racimo de 7 docblocks para comprobar que lo leí entero.

Sumado al rendimiento medido (1 rancio en las últimas 6 lecturas, frente a 2 en las 6 primeras),
la conclusión no es «no puedo seguir» sino **«seguir yo aquí es la peor relación entre valor y
riesgo de la sesión»**. Sirvo la cola.

### 12.3 La cola, SERVIDA (relevo barato)

Reproducible: `python3 re/tools/cita_rama_hermana.py --rancio --estricta --blame --filtro`.
Los **11 restantes con atrasado ≤3 líneas** (rótulos) van DESPUÉS: dos leídos de esa forma dieron
(a) las dos veces.

| par | gap | hermano atrasado | líneas | docblocks |
|---|---|---|---|---|
| `SHOPPES.OVL:0x0e76` | +275 h | `shops/shops.ts:150-154` | 5 | 3 |
| `DNGLOOK.OVL:0x0844` | +234 h | `dungeon/dungeon.ts:1172-1178` | 7 | 6 |
| `OUTSUBS.OVL:0x0658` | +183 h | `world/commands.ts:743-770` | 28 | 5 |
| `CMDS.OVL:0x17ec` | +164 h | `sfx.ts:92-95` | 4 | 4 |
| `COMSUBS.OVL:0x12de` | +159 h | `combat/combat.ts:211-214` | 4 | 4 |
| `COMSUBS.OVL:0x0c52` | +154 h | `combat/combat.ts:1434-1440` | 7 | 7 |
| `SHOPPES.OVL:0x0202` | +132 h | `world/cmd-strings.ts:327-330` | 4 | 4 |
| `MAINOUT.OVL:0x0d22` | +56 h | `world/transport.ts:824-829` | 6 | 3 |
| `CAST2.OVL:0x04c2` | +38 h | `main.ts:3234-3242` (⛔ embargo) | 9 | 6 |
| `CAST.OVL:0x1966` | +22 h | `dungeon/dungeon.ts:312-324` | 13 | 3 |
| `TOWN.OVL:0x05ed` | +20 h | `game.ts:1432-1438` | 7 | 3 |
| `ULTIMA.EXE:0x3ef0` | +20 h | `counters.ts:1-16` | 16 | 5 |
| `SJOG.OVL:0x02ea` | +19 h | `world/traps.ts:1-28` | 28 | 2 |
| `MAINOUT.OVL:0x032f` · `0x0312` · `0x0347` · `0x033c` | +6 h | `world/movement.ts:256-269` | 14 | 2-4 |
| `SHOPPES.OVL:0x0c80` | +6 h | `skin/api.ts:306-313` | 8 | 7 |
| `SJOG.OVL:0x045a` | +5 h | `world/survival.ts:308-317` | 10 | 6 |
| `TOWN.OVL:0x057c` | +2 h | `game.ts:1384-1394` | 11 | 4 |

### 12.4 Lo que el relevo debe saber, en cinco líneas

1. **Las 5 condiciones del GO siguen vigentes** (regla antes de aplicar · positivos que
   sobrevivan o no se aplica · «apartado ≠ limpio» donde se lea la cifra · supervivientes enteros ·
   auto-artefacto fuera de cola y de cifras).
2. **Verifica cada atrasado contra el main del momento ANTES de corregir** — hay carriles moviendo
   prosa cada hora.
3. **Los tres modos de (a) ya catalogados**: rótulo de sección · fuente-del-otro · hermanos que
   hablan de OTRO ASPECTO del mismo offset. Con reconocer el tercero se descarta la mayoría en una
   ojeada.
4. **`main.ts` sigue bajo embargo** — `CAST2.OVL:0x04c2` tiene su atrasado ahí; se lee, no se toca.
5. **Los 253 pares de abstención (64%) NO son limpios: son no medidos.** Y la mitad
   intra-docblock del género es **#239**, fuera de este eje por construcción.
