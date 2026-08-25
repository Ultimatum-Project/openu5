# FASE 3e — DISEÑO Y PRE-REGISTRO (escrito antes de tener datos de 3d, a petición del lead)

> **Titular, y va contra mi propia recomendación**: la **GEMA NO SIRVE como ancla**. Lo propuse
> yo y el lead lo aprobó; al derivarlo en firme se cae. Lo que sí sirve —y estaba delante todo el
> rato— es el **filtro de localización sobre la secuencia de `Blocked!`**. Sección §1 y §2.

---

## 1. La gema: por qué NO sirve. Las dos mitades, verificadas

### Mitad PORT — sólo emite el eco, y el mapa es GRÁFICO

`game.ts:1929` `view()`, calco del dispatcher kernel **ULTIMA.EXE 0x341A-0x344D**:

```
0x341e  print "View a gem!\n"      (DS 0xa258, verbatim) — SIEMPRE, antes del gate
0x3421  cmp [g_gems],0 ; je 0x344a → sin gemas
0x344a  print "You have none!\n"   (DS 0xa266) — NO abre vista
0x3428  dec [g_gems]               → consume 1 gema SIEMPRE, antes de pintar
0x342c  cmp [g_location],0x21 ; jae → mazmorra (DNGLOOK 0x06a8) vs resto (LOOKOBJ 0x10fc)
```

Con gemas, el port emite `{kind:"gem-view", gemView: buildGemView(...)}` — un **descriptor
gráfico**. **Cero texto** más allá del eco. El canal que el espejo compara es el log de consola:
la gema no escribe nada en él.

### Mitad LP — el OCR tampoco trae posición. Y la cadena que el diseño esperaba NO EXISTE

`design-interiores.md §4` propone comparar «el eco **“You are on level N”**». Buscado en el
corpus entero:

- **`You are on` → 0 apariciones** en AD y en LP1.
- `level <N>` → 36 apariciones, y **las 36 son texto de SANTUARIO**: «Thou art now **level 5**,
  and wiser!» — el nivel de EXPERIENCIA del personaje tras meditar, no la planta de la mazmorra.

O sea: la cadena sobre la que se apoyaba el plan de 3e **no está en el juego**. Lo que el OCR trae
en un beat de gema es el eco `View a gem!` y, a continuación, material sin relación (`Rowing!`,
`X-it ship!`, `Blocked!`, `Board What?` — muchos de los 338 son gemas de OVERWORLD, no de mazmorra).

### Y conducirla no es gratis: QUEMA ESTADO

`0x3428 dec [g_gems]` consume una gema **siempre**, y el turno se cobra al cerrar la vista. Son
**338 beats** en AD. Además: **`You have none!` aparece 0 veces en el corpus del LP** ⇒ el LP nunca
se quedó sin gemas, así que **cualquier `You have none!` que imprima el port sería un artefacto que
introducimos nosotros** al conducir con un contador de gemas que no es el del LP. Divergencia
fabricada por el instrumento, del tipo exacto que este carril no reporta.

### Veredicto

| lo que la gema aporta | valor |
|---|---|
| ancla de POSICIÓN | **ninguno** (el mapa es gráfico; el texto no lo lleva) |
| ancla de PLANTA | **ninguno** (`You are on level N` no existe) |
| bloques comparables | ~338 `pending` → comparables, **de 1 bloque cada uno** (el eco) |
| coste | 1 gema + 1 turno × 338, y riesgo de `You have none!` fabricado |

**La gema sólo sería un ancla por PIXEL-DIFF contra el frame del vídeo** (protocolo
`tools/evidence.sh` + corpus gitignored). Eso es un instrumento distinto —no el canal de texto—
y queda como línea futura, no como 3e.

**Corrijo mi recomendación anterior**: conté 116 beats «ya conducibles» y los presenté como
material de ancla. Conté **ecos de comando**, no información de posición. El error fue mío y el
lead lo aprobó sobre mi conteo.

## 2. Lo que SÍ sirve: filtro de localización sobre `Blocked!`

El interior 3D es un problema clásico de **localización de robot**: mapa estático conocido,
secuencia de movimientos relativos conocida, y observaciones binarias de pared. Todo eso ya lo
tenemos y **no hace falta corpus nuevo**.

### Los tres ingredientes, ya en casa

1. **Mapa estático, offline y committeado**: `game/assets/maps/dungeons.json` — 8 mazmorras × 8
   plantas × **8×8 celdas** (`dungeon.ts:212`, `const N = 8`). Espacio de estados por planta:
   64 celdas × 4 facings = **256**. Minúsculo: se puede filtrar por fuerza bruta.
2. **Secuencia de movimientos**: es justo lo que 3b/3c/3d ya derivan (`advance`/`turnLeft`/
   `turnRight`/`back`/`klimb`), relativa al facing — que es la forma que el filtro necesita.
3. **Observaciones**: censo de lo que el OCR trae en segmentos ABIERTOS:

   | observación | en abiertos | total | invertible |
   |---|---|---|---|
   | **`Blocked!`** | **116** | 505 | sí: la celda de delante es muro |
   | `You find:` | 96 | 133 | parcial |
   | `Nothing of note` | 63 | 264 | sí (Marker 0x9_) |
   | `A hidden door!` | 31 | 73 | sí y MUY discriminante (SecretDoor 0xd_) |
   | `Pit Trap!`/`Falling` | 18 | 30 | sí (Trap 0x6_) |
   | descripciones de `Look` 3D | **13** | 57 | sí, pero escasísimas |
   | `Attacked from the <dir>!` | **5** | 10 | facing, pero escasísimas |
   | `View a gem!` | 132 | 338 | **no** |

   El (L)ook 3D **sí** es invertible —`LOOK_DESC` (dungeon.ts:162, DNGLOOK 0x0102-0x01e1, DS
   0x7618-0x76f0) nombra el tipo de la celda vecina: «a passage» / «an up ladder» / «a wooden
   chest» / «a wall» / «a heavy door»— pero el LP casi no usa Look dentro: **13 beats**. Mismo
   problema que el oráculo de facing. `Blocked!` es el único abundante.

### ⚠ CORRECCIÓN AL IMPLEMENTARLO: mi primera tabla usaba un modelo INSANO

La tabla que publiqué en la primera versión de este documento (256 → mediana 5 con 20 avances)
salía de un filtro que trataba **`Blocked!` como muro**. Al derivar el predicado exacto contra el
core para implementarlo, resultó que eso **no es sano**:

> `dungeon.ts:357` emite `Blocked!` cuando `isPassable` es falso — pero `dungeon.ts:363` emite
> **la misma cadena** (DS 0x2D23, dng_move 0x067c-0x0691) cuando hay un **ERRANTE** en el destino.
> En la partida del LP el errante estaba VIVO. Así que un `Blocked!` suyo **no demuestra muro**, y
> excluir por él puede tirar la celda verdadera.

Cuantificado con el propio test: con el modelo insano y el errante al 5%, la verdad se pierde en
**202 de 512** paseos; al 15%, en **386**; al 40%, en **470**. Al 0% no se pierde ninguna — que es
justo la prueba de que el culpable es el errante.

Segunda corrección del mismo tipo: la **puerta secreta** (0xD) tampoco excluye. `isPassable` la
deja pasar si fue revelada por Search (`dungeon.ts:291`) y el conjunto de reveladas del LP no es
reconstruible. Sólo excluye lo que bloquea SIEMPRE: `Wall` (0xB) y `SpecialWall` (0xC).

### FEASIBILIDAD REAL (modelo SANO) — 64 plantas reales, errante simulado

Sólo informan: **avance con ÉXITO**, `Ouch!/Electric field!` (tile exacto 0x83), `Not in doorway!`
(puerta normal 0xE, rarísima) y el giro que sí ocurrió. `Blocked!` se cuenta y no informa.

| pasos | errante 0% | errante 5% | errante 15% | verdad perdida |
|---|---|---|---|---|
| 20 | mediana 30 | 30 | 32 | **0** |
| 40 | mediana 10 | 10 | 12 | **0** |
| 80 | mediana **4** | 4 | 5 | **0** |

**El precio de la sanidad es real**: donde el modelo insano prometía 5 candidatas con 20 avances,
el sano necesita ~80 pasos (≈50 avances) para llegar a 4-5. **Se paga y no se discute**: es la
diferencia entre reducir el espacio de búsqueda y teletransportar la party a una celda falsa.

Lo que NO cambia, y es lo que importa: **verdad perdida = 0 en todos los regímenes**, incluido el
errante al 40%. Esa es la propiedad de aceptación, y está blindada en
`tests/espejo-dungeon-filter.test.ts` (barrido de las 64 plantas × 8 paseos × 4 tasas de errante).

### Presupuesto real por VISITA (lo que decide si esto es viable)

559 avances en 22 visitas, muy desigualmente repartidos:

```
ad17-g03 dng33  advances=106  klimb=13     ad24-g05 dng38  advances=43  klimb=15
ad18-g12 dng33  advances= 64  klimb=25     ad23-g02 dng34  advances=35  klimb= 3
ad23-g11 dng34  advances= 48  klimb= 7     ad15-g02 dng39  advances=34  klimb= 0
```

Con el modelo SANO el listón sube (`MIN_BUDGET = 40` observaciones informativas):

- **Sólo ad17-g03 (106 avances) y ad18-g12 (64) tienen holgura de sobra.** ad23-g11/g12 (48) y
  ad24-g05 (43) están justo en el umbral.
- **Las 17 visitas restantes NO llegan** → `no-budget`, declarado, sin anclar. (Misma doctrina que
  `ambiguous`: mejor sin ancla que con una falsa.)

O sea: al ser sano, el filtro pasa de «sirve en 10 de 22 visitas» a **«sirve en 2-4 de 22»**. Es
mucho menos de lo que prometí, y es el número honesto.

**Y hay un premio doble**: metiendo la PLANTA en el espacio de estados (2 048 por mazmorra, sigue
siendo trivial) y usando los `klimb` como transiciones observables, el mismo filtro ataca el
problema que `--visits` dejó abierto — la planta absoluta, que hoy 3d **no afirma**. Los grandes
tienen 13-25 klimbs, que es señal de sobra.

## 3. Qué asimetrías de CONDUCCIÓN cierra cada cosa — y la respuesta sobre la FUSIÓN

Las cuatro que fijé, una por una:

| # | asimetría | gema | filtro `Blocked!` | errante vivo |
|---|---|---|---|---|
| 1 | sólo se conducen ops `{dng}` (las de SALA no) | no | no | no |
| 2 | sin ancla de CELDA | **no** | **parcial** (256→~5, con cercanía) | no |
| 3 | planta RELATIVA, no absoluta | **no** | **sí** (klimb como transición) | no |
| 4 | errante CONGELADO | no | no | **sí** |

**Respuesta explícita a la pregunta del lead: NO, con 3e-gema no se puede fusionar. Y con
3e-filtro tampoco.** La asimetría **nº1 no la toca ninguna de las tres palancas**: dentro de un
interior seguimos sin conducir el material de SALA (`salaOpsSkipped`), así que el denominador del
interior sigue siendo un replay conducido a medias frente a un smallmap conducido entero.

Corrijo por tanto la condición que di y que quedó como ruling («se fusiona al cerrar 3e»):

> **La fusión necesita cerrar la nº1, que es una fase aparte** — conducir el combate de SALA
> dentro del interior. Llámese 3f. 3e (filtro + errante) cierra 2, 3 y 4, pero no la 1.

Prefiero decirlo ahora, como pediste, que descubrirlo al final.

## 4. Orden interno y criterio de paso

**3e-a — FILTRO primero** (no la gema, que se retira; no el errante). Razón: es lo único que da
ancla dentro, es offline y determinista, y **no toca el stream RNG** — o sea, es medible con el
errante todavía congelado, sin mezclar dos fuentes de deriva.

**3e-b — ERRANTE VIVO después.** Criterio de paso, medible y fijado ahora:

> Se suelta el errante cuando el filtro dé **≤4 candidatos en ≥50% de los segmentos anclables**
> y la conformidad de interior **no baje** al activarlo. Con el ancla dentro, la deriva que
> introduzca el errante es atribuible; sin ella, se repite el estreno de AD.

Y con el aviso que ya está medido: el oráculo de facing del diseño (`Attacked from the <dir>!`)
son **10 beats en 25 partes**. Al soltar el errante **no hay con qué re-anclar el facing**, así
que 3e-b depende de que 3e-a funcione. Si 3e-a no converge, **3e-b no se hace**.

## 5. PRE-REGISTRO de 3e-a (mismo rigor que `PREDICCION-3d.md`)

### 5.1 ¿Cuál es el ruido de cadena en ESTA comparación?

La pregunta que el lead exige, y la respuesta es **peor que en 3d**: en 3d el ruido medido fue
**×2.00** sobre segmentos que ningún run condujo. 3e-a **no puede parear contra un run viejo**,
porque el filtro cambia el resync y por tanto el transcript desde el primer ancla. Así que:

- **Brazo A obligatorio: el propio run de 3d** (`.espejo-3d`, el que aún no he corrido), con
  checkpoints intactos y `NO_EXPORT`. Mismo truco que hizo válido a `.espejo-3c`.
- **Corolario duro: 3e-a NO se puede medir hasta que 3d esté corrido.** El brazo A de 3e es el
  resultado de 3d. Esto fija el orden y no es negociable.
- Validación idéntica: los segmentos anteriores al primer ancla deben reproducir `.espejo-3d`
  byte a byte (`verify-arm-a.ts --a .espejo-3d --b .espejo-3e`).

### 5.2 Predicción, con su razonamiento

Sobre las **10 visitas con ≥20 avances** (donde el filtro da mediana 5):

- **Conformidad de interior: +1 a +3 puntos** sobre lo que mida 3d. **Rebajada** desde el +2/+6 de
  la primera versión, por la corrección del modelo insano: el filtro ancla en **2-4 visitas de
  22**, no en 10-15. Razón: no da la celda, da ~4-5 candidatas y sólo donde hay ≥40 observaciones
  informativas; con cercanía acertará a veces y otras no.
- **Anclas resueltas: 2-4 de 22 visitas.** El resto, `no-budget` declarado.
- **Y una posibilidad real que hay que admitir de antemano: efecto INDISTINGUIBLE DE CERO.** Con
  2-4 visitas ancladas sobre un corpus de 89 interiores, el efecto puede quedar por debajo del
  ruido de cadena (que en 3d medí en ×2.00). Si sale así, **el veredicto es que 3e-a no compensa**,
  y se dice — no se busca un subconjunto favorable donde luzca.
- **`floorUnknown` → baja o a 0** en las visitas con klimbs (es la nº3, la que el filtro sí cierra).
- **Denominador PLANO ±3%** (misma lógica que en 3d: el `expect` no cambia).

**Si sale más de +6 puntos, sospecho del instrumento**, por la misma regla que el lead ratificó:
un resultado que supera lo que la palanca puede justificar es una alarma hasta que se demuestre
lo contrario.

### 5.3 Criterios de sospecha-del-instrumento (ninguno leído del porcentaje)

1. **El filtro excluye la celda verdadera.** Es imposible por construcción (sólo excluye estados
   inconsistentes) — así que si el resync teleporta a una celda desde la que el siguiente
   `advance` del LP resulta `Blocked!` cuando el LP pasó, el filtro tiene un BUG. Guarda directa:
   tras cada resync, la siguiente observación debe ser consistente.
2. **Candidatos = 0.** Significa que el mapa vivo no casa con el estático (celdas mutadas:
   secretos revelados, cofres abiertos, hoyos). Es un dato real, no un fallo — pero si pasa mucho,
   el modelo de mutación está mal y hay que declararlo, no forzarlo.
3. **Denominador cae >10%** → conformidad comprada encogiendo (idéntico a 3d).
4. **Vocabulario 2D en el transcript de un pasillo** → rotura nº1/nº2 de 3b.
5. **Anclas resueltas ≈ 22/22.** Con el presupuesto medido eso es imposible: 7 visitas no tienen
   observaciones suficientes. Si el filtro dice que sí, está adivinando.

### 5.4 Qué contaría como fracaso, dicho antes

Si el filtro no baja de ~20 candidatos en las visitas grandes, o si el ancla no mejora la
conformidad, **3e-a se reporta como fracaso y el interior se queda con la costura de 3d**. En ese
caso la conclusión sería que el interior es medible pero **no anclable** con el canal de texto, y
que el siguiente paso real es el **pixel-diff contra el vídeo** (que sí daría la gema entera) —
otro instrumento, otro encargo.

---

## 6. ⚠ AVISO A QUIEN GREPEE ESTO DENTRO DE SEIS MESES

Este documento **añade apariciones de la cadena que declara inexistente**. Ahora mismo:

```
"You are on level"  en game/e2e/espejo-tour/*.md   → 5   (design-interiores 2, DISENO-3e 2, README 1)
"You are on level"  en routes*/*.json (EL CORPUS)  → 0   ← el único conteo que significa algo
```

Es exactamente la trampa en la que cayó `design-interiores §4`: la cadena existía **sólo en el
documento que proponía el plan**, y un grep descuidado la habría «confirmado». Así que la regla,
que vale para cualquier plan futuro de este carril:

> **Antes de aprobar un plan que se apoya en una cadena del testigo, cuéntala EN EL CORPUS
> (`routes*/*.json`), no en el repo. Un `.md` no es corpus.** Y cuenta la alternativa en el mismo
> grep: lo que hundió a la gema no fue su 0, fue que `Blocked!` tenía 1 384.

*Todo lo cuantitativo de este documento es reproducible offline ahora mismo: los censos salen de
`routes-ad/`, el espacio de estados de `game/assets/maps/dungeons.json`, y la tabla de
feasibilidad de una simulación exhaustiva sobre las 64 plantas reales. Ningún número viene de un
run de playwright.*
