# PRE-REGISTRO DE LA MEDIDA DE 3d — escrito ANTES de correr, a petición del lead

Este fichero se escribe **antes** de tener la ventana playwright. Su función es que el número de
3d no se pueda leer a conveniencia: si el resultado cae donde predije, la predicción lo respalda;
si cae fuera, la sorpresa es un dato y no una excusa. Todo lo de aquí sale de material congelado
ya medible offline, así que es verificable ahora mismo.

---

## 0. Una corrección a mi propio informe, antes de predecir nada

Dije que «conducir el interior vale ~×2» comparando 9.2%→21.4% (3b) y 10.9%→19.8% (3c). **Esa
comparación estaba mal hecha**: no eran los mismos segmentos. El 9.2% son 8 segmentos de
`.espejo-r3b` y el 21.4% es **un solo** segmento (ad17-g03) de `.espejo-3c`. Comparar dos
poblaciones distintas y llamarlo «efecto de conducir» es exactamente el tipo de número que este
carril no reporta.

**La comparación PAREADA** — mismos segmentos, sin conducir en `.espejo-r3b` vs conducidos en
`.espejo-3c` — es ésta:

| segmento | sin conducir | conducido |
|---|---|---|
| ad14-g21 `[3c]` | 1/28 (3.6%) | **11/28 (39.3%)** |
| ad17-g03 `[3b]` | 19/168 (11.3%) | **36/168 (21.4%)** |
| ad17-g13 `[3c]` | 7/45 (15.6%) | **3/45 (6.7%)** ← ⚠ EMPEORA |
| ad24-g05 `[3c]` | 8/52 (15.4%) | **11/53 (20.8%)** |
| **TOTAL** | **35/293 = 11.9%** | **61/294 = 20.7%** |

**El factor real es ×1.74, no ×2** — y con dos avisos que el número agregado escondía:
1. **n=4 segmentos.** La varianza es enorme (de ×0.43 a ×11).
2. **Uno de los cuatro EMPEORA al conducirlo** (ad17-g13). Eso ya dice que conducir no es
   monótonamente bueno, y es la primera cosa que miraré segmento a segmento en 3d.

## 0b. EL PROBLEMA GORDO: el ruido de cadena es MAYOR que el efecto que busco

Los MISMOS 8 segmentos de 3d de ad17, sin conducir, medidos en dos runs distintos:

| | matcheados / comparables | conf |
|---|---|---|
| `.espejo-r3b` | 33/538 | **6.1%** |
| `.espejo-3c` | 66/538 | **12.3%** |

Mismo denominador exacto (538: el `expect` es el mismo), numerador ×2. Lo comprobé en todo el
material a la vez (`tools/calib-paired.ts`, nuevo), aislando los segmentos que **ningún** run
condujo — o sea, con CERO conducción de por medio:

```
27 segmentos SIN CONDUCIR en ninguno de los dos runs
  r3b   90/1118 =  8.1%
  3c   178/1106 = 16.1%
  factor = ×2.00   ← esto es RUIDO DE CADENA PURO
```

**El ruido run-a-run es ×2.00. El «efecto de conducir» que medí es ×1.74.** El ruido es MAYOR que
el efecto. Conclusión dura, y es lo que este pre-registro existe para evitar:

> **Comparar «3d conducido (run nuevo)» contra «3d sin conducir (run viejo)» NO PUEDE demostrar
> que conducir funcione.** Los dos runs difieren en el estado de la cadena Y en la conducción, y
> el primer término es más grande que el segundo. El ×1.74 de §0 está confundido por lo mismo.

Con esto, la línea base 8.4%/16.1% que fijé en el informe anterior **no es un listón**: son dos
tiradas de una distribución ruidosa, y su diferencia ES el ruido.

## 0c. El diseño que SÍ lo aísla — y sale gratis

El ruido de §0b viene de que `.espejo-r3b` era una corrida de CADENA (reescribía los checkpoints)
y `.espejo-3c` corrió aislada con `NO_EXPORT` desde otros checkpoints. Pero entre `.espejo-3c` y
hoy, **los checkpoints no se han tocado**:

```
saves/ad13.gam 14:44 · ad16.gam 14:49 · ad19.gam 14:55 · ad23.gam 15:54   (git: limpios)
run .espejo-3c                                          16:59 – 17:05
```

Y la suite ya demostró que un run repetido desde el mismo checkpoint reproduce su reporte **byte a
byte** (ad21 del relevo-4). Además, lo que he cambiado desde entonces sólo puede afectar a los
segmentos 3d: la palanca de `sala-diferida` es de MEDICIÓN (`diffSegment` es puro, se aplica
offline sobre el transcript) y la costura `carryover` sólo se ejecuta en segmentos `carryover`.

**Por tanto `.espejo-3c` es un BRAZO A válido** para ad14/ad17/ad24: mismo checkpoint, mismas
teclas hasta el primer segmento 3d, y la única diferencia es la conducción. No hay que correrlo.

- **Experimento LIMPIO** (prioridad): re-correr **ad14 + ad17 + ad24** con 3d abierto y parear
  contra `.espejo-3c`. Son **27 segmentos / 1106 comparables** — justo la fila «3d sin conducir
  178/1106» del banco. 3 runs, estimación del efecto sin ruido de cadena.
- **Cobertura** (después, si hay ventana): ad15 + ad25 + ad18 (16 segmentos más). **No tienen brazo
  A**, así que aportan material y divergencias, pero **no** estimación limpia del efecto. Lo diré así.

**VALIDACIÓN INTERNA, incorporada al run**: en cada parte del experimento limpio, los segmentos
ANTERIORES al primer 3d deben reproducir `.espejo-3c` **byte a byte**. Si lo hacen, el pareado es
limpio y está demostrado, no supuesto. **Si NO lo hacen, el confundido sigue ahí y lo reporto como
tal en vez de dar un factor.** Es la primera comprobación que haré, antes de mirar ningún %.

## 1. Por qué espero MENOS de ×1.74 en 3d (y no más)

La costura de 3d es **estrictamente más débil** que la de 3b/3c, y justo en el mecanismo que hace
funcionar el modelo:

| | 3b / 3c | 3d (`carryover`) |
|---|---|---|
| celda de arranque | la de ENTRADA, **fijada** por `setDungeonPos` | **desconocida**: donde la deriva dejara a la party |
| facing de arranque | `south`, **fijado** | desconocido |
| planta | 0, conocida | la VIVA del port (no la del LP) |

El argumento central del diseño (§0b.3) es que *«reproducir la secuencia relativa **desde el mismo
estado de entrada** reproduce la ruta EXACTA»*. **3d no tiene el mismo estado de entrada.** Le
queda la parte relativa del argumento sin el ancla que la hacía morder. Así que espero mejora
—las teclas son las del LP y el port responde a ellas— pero **más pequeña**: predigo **×1.2–×1.5**.

Si sale ×1.74 o más, no lo celebro: lo trato como sospechoso y voy a §3.

## 2. Predicción por tramo

Sólo el experimento limpio (§0c) admite predicción de factor; los de cobertura van sin ella.

| parte | segs 3d | brazo A | base sin conducir | **predicción (banda)** |
|---|---|---|---|---|
| ad17 | 8 | ✅ `.espejo-3c` | 12.3% (66/538) | **13–19%** |
| ad24 | 15 | ✅ `.espejo-3c` | 14.8% (59/399) | **15–22%** |
| ad14 | 4 | ✅ `.espejo-3c` | 31.4% (53/169) | **32–45%** |
| **limpio** | **27** | | **16.1%** (178/1106) | **17–24%** |
| ad15 / ad25 / ad18 | 16 | ✗ sin brazo A | — | *sin predicción de factor* |

Predicciones secundarias, más informativas que el porcentaje porque no dependen del ruido:

- **`comparable` se queda PLANO o sube ligeramente.** El `expect` es idéntico entre runs, así que
  el denominador sólo se mueve si cambian los veredictos. Y conducir mejor sólo puede mover
  bloques de `divergent` a `match` (que **no** cambia comparables) o quitarle trabajo al
  `combat-rng` del fondo (que **sube** comparables). En el pareado: 293 → 294. **Predigo ±3%.**
- **`combatRng` baja o se queda igual** (los bloques que ahora casan ya no llegan al fondo).
- **La costura declinará en bastantes segmentos.** `carryoverInteriorLive` es estricto y la party
  llega donde la deriva la deje. **Predigo 20–50% de los segmentos con la costura declinada**
  (`dngOps=0`). Es el modo de fallo más probable, y lo reportaré como número de primera clase.

## 3. Qué me haría sospechar del INSTRUMENTO y no del port

Ordenados por probabilidad. Ninguno se lee del porcentaje: todos son comprobaciones directas.

1. **`comparable` CAE de forma material (>10%) respecto a la medida sin conducir de los mismos
   segmentos.** Sería conformidad comprada encogiendo el denominador — el pecado que 3c evitó a
   propósito. Comprobación: la tabla pareada comparable-a-comparable, no el %.
2. **Conformidad AGREGADA por encima de ~30%.** Está fuera de lo que la costura débil de 3d puede
   justificar. Primero miraría (1); si el denominador está sano, entonces es un resultado real y
   habría que explicar POR QUÉ el arranque desconocido no penaliza — probablemente que los
   pasillos son cortos y el LP re-ancla solo.
3. **Conformidad POR DEBAJO de la base sin conducir.** Conducir estaría haciendo daño: las teclas
   se están pulsando en un estado equivocado. Comprobación: `dngOps` vs ops derivadas, y el
   `INTERIOR-SIN-MAZMORRA` del log.
4. **Vocabulario 2D en el transcript de un pasillo** («Slow progress!», «Very slow!», «Blocked!»
   junto a rumbos de brújula, «Exit to Britannia!»). Es la firma de las roturas nº1/nº2 de 3b.
   **Ésta es la comprobación que 3b enseñó: se mira el TRANSCRIPT, no el porcentaje.** Con una
   sola aparición, el número del segmento no vale nada.
5. **`salaOpsSkipped` >> `dngOps`.** Estaríamos midiendo un segmento del que conducimos una
   minoría de las ops; el % sería sobre material mayoritariamente no ejercitado.
6. **`PLANTA-DESCONOCIDA` en muchos segmentos.** La secuencia de Klimb saca a la party del 3D →
   la planta viva de arranque no era compatible con la del LP.
7. **Casi todos los segmentos con la costura declinada** (>80%). Entonces «la medida de 3d» sería
   la medida sin conducir con otra etiqueta, que es justo la trampa que ya cacé en el banco.

## 3b. CRITERIO DE CONTAMINACIÓN POR CAMBIO DE CORE AJENO (escrito el 2026-07-25, a raíz del LOS)

El brazo A (`.espejo-3c`) se grabó con una versión del core. Si entre medias aterriza un fix que
cambia la **MECÁNICA** —no el instrumento del espejo— el brazo A y el B dejan de ser comparables.
Es **el mismo confundido del ruido de cadena, introducido desde fuera del carril**, y es peor
porque no se ve en ninguna métrica del espejo.

**Caso que lo motivó**: `isRangedPathClear` cambió de tabla (`ALWAYS_OPAQUE` 0x6a86 →
`blocksSpellLine` 0x6a14, main `e217ace4`), 49 tiles de diferencia, y afecta al disparo del PJ **y
del enemigo** (`combat.ts:2925`).

### La regla, en tres pasos

1. **¿Toca la superficie que yo mido?** No basta con «cambió el core». Hay que localizar por dónde
   podría entrar. Para el espejo de interiores la superficie es una sola: **los segmentos donde el
   port RESOLVIÓ COMBATE** (`combatRounds > 0` en el reporte congelado). Fuera de ahí, un fix de
   combate es inerte por construcción.
2. **Cuantificar la exposición, no describirla.** Comparables que viven en segmentos con combate,
   como fracción del total. Medido para el LOS: **265 de 321 = 83%** del interior del brazo A.
   «Probablemente no me toca» no es una respuesta; 83% sí lo es.
3. **Decidir con el validador, no con la intuición.** `verify-arm-a.ts` ya lo contesta: si los
   segmentos previos al primer 3d reproducen byte a byte **con el core nuevo**, el fix fue INERTE
   ahí y el pareado se sostiene. Lo que quede fuera de esa cobertura se DECLARA y **no entra en el
   factor**.

### Aplicado al fix de LOS (números reales)

| | comparables | % del interior de brazo A |
|---|---|---|
| total de interior en brazo A | 321 | 100% |
| en segmentos **con combate** (superficie expuesta) | **265** | 83% |
| · que `verify-arm-a` **sí** cubre (ad17-g03, ad24-g05) | **220** | 69% |
| · que **nadie** cubre (ad17-g13: va DESPUÉS del primer 3d) | **45** | 14% |

Y el combate no es nominal: `ad24-g05` trae `Attack-Aim!`, muertes y fallos — o sea **ataques a
distancia**, justo lo que el fix cambia. `ad17-g03`/`g13` traen `Entering room…` → `BATTLE IS
LOST!`, y el fix mueve también el disparo ENEMIGO, así que el desenlace puede cambiar.

**Decisión: no se re-corre el brazo A a ciegas.** Sale gratis dejar que el validador lo conteste:
si los 220 reproducen, el fix fue inerte y el factor vale para ellos; los 45 de `ad17-g13` se
declaran fuera pase lo que pase. Si NO reproducen, se declara el confundido y **no se da factor**,
que es la preferencia del lead y la mía.

### Generalización, para la próxima (que la habrá)

> Antes de medir contra un brazo A grabado: `git log` del core desde su fecha. Por cada cambio,
> **nombrar la superficie** por la que entraría, **contar** los comparables expuestos, y dejar que
> la identidad byte a byte decida. Un brazo A no caduca por el tiempo: caduca por un cambio que
> toque su superficie — y eso se comprueba, no se supone.

## 4. Qué contaría como éxito, dicho antes

- **Éxito claro**: agregado en 13–17%, `comparable` plano, costura declinada <50%, y **cero**
  apariciones del punto 4. Con eso, los 7 465 bloques nuevos entran en la métrica con derecho.
- **Éxito parcial**: mejora sobre la base pero con un subconjunto de segmentos que empeora (como
  ad17-g13 en 3c). Entonces el entregable no es el %, sino **la caracterización de qué distingue
  a los que mejoran de los que empeoran** — que es lo que haría falta para 3e.
- **Fracaso honesto**: sin mejora sobre la base, o punto 4 presente. Se reporta como tal, el
  material se deja abierto pero DECLARADO como no-medible con la costura actual, y la conclusión
  es que el `post-combat` necesita el ancla de la GEMA (§3e) antes de poder medirse — que
  encajaría con lo que ya sé: el arranque desconocido es el agujero, y la gema es lo que lo tapa.

---

*Escrito con la ventana ocupada por el carril `videos`; ninguna de estas cifras viene de un run
nuevo. Todo lo de §0/§0b es reproducible ahora con `tools/calib-interior.ts` y los transcripts
congelados de `.espejo-3c/` y `.espejo-r3b/`.*

---

# RESULTADO (2026-07-26) — medido, y leído en el orden pre-registrado

## Paso 1: el VALIDADOR, antes de ningún porcentaje

```
ad14: ❌ 3/21 segmentos previos DIFIEREN (g13, g15, g17)  → pareado INVÁLIDO
ad17: ✅ 3 segmentos previos BYTE-IDÉNTICOS               → pareado VÁLIDO
ad24: ❌ 2/5 segmentos previos DIFIEREN (g02, g05)        → pareado INVÁLIDO
```

**Factor SÓLO para ad17.** ad14 y ad24 se declaran confundidas y **no dan factor**, como estaba
fijado antes de correr. No se busca el subconjunto favorable.

### La contaminación del LOS se materializó EXACTAMENTE donde estaba predicho

| segmento | combate en brazo A | ¿reproduce? |
|---|---|---|
| ad17-g03 (168 comp.) | `Entering room…`/`BATTLE IS LOST!` | **SÍ, byte a byte** ⇒ el LOS fue INERTE ahí |
| ad24-g05 (52 comp.) | **`Attack-Aim!`** = ataques a DISTANCIA | **NO** (688 → 856 líneas) |

El fix movió el segmento con **ataques a distancia** y dejó intacto el que no los tenía. La
predicción de superficie acertó al segmento.

### Pero hay una SEGUNDA causa, y no es el LOS

`ad14-g15` (6→4 líneas) y `ad14-g17` (70→71) **difieren SIN combate**. Ninguna de mis cuatro
superficies lo explica. Sospecha principal: **pacers a RELOJ DE PARED** (tarea abierta de la flota),
que hacen la captura no reproducible. Consecuencia metodológica, declarada y no resuelta aquí:
**la identidad byte a byte puede romperse por ruido de captura, no sólo por mecánica** — así que el
validador es CONSERVADOR (puede declarar inválido un pareado que sólo tenía jitter). Prefiero ese
sesgo al contrario.

## Paso 2: el número (ad17, único pareado válido)

| | matcheados/comparables | conf |
|---|---|---|
| 3d **sin conducir** (brazo A) | 66/538 | **12.3%** |
| 3d **conducido** (brazo B) | 77/536 | **14.4%** |
| | | **factor ×1.17** |

Los 8 segmentos mejoran o empatan; **ninguno empeora**. Denominador **plano**: 538 → 536 (−0.4%).

**POR DEBAJO DE MI PREDICCIÓN.** Predije ×1.2–×1.5 y agregado 17–24%; salió **×1.17 y 14.4%**. La
DIRECCIÓN del razonamiento fue correcta (predije menos que el ×1.74 de 3b/3c, por el arranque de
celda y facing desconocidos) pero el tamaño se quedó corto. Se reporta como salió.

## Paso 3: criterios de sospecha del instrumento

| # | criterio | veredicto |
|---|---|---|
| 1 | denominador cae >10% | **PASA** (−0.4%) |
| 4 | vocabulario 2D en pasillo | **PASA**: 0 en las 3 partes — las roturas nº1/nº2 de 3b NO reaparecen |
| 5 | `salaOpsSkipped` >> `dngOps` | **FIRMA**: 3.1×–5.5× (ad17 748 vs 239). Declarado: se mide un segmento del que se conduce una MINORÍA de las ops |
| 7 | costura declinada | 0 de 12 — muy por debajo del 20–50% que predije |

## ad14: material INVÁLIDO por una razón estructural, independiente del pareado

La party queda **sellada en la escalera (1,1) f0 de Hythloth**: tipo `3` (LadderUpDown) con **muro
en los cuatro lados**. Transcript: **14 `Advance`, 17 `Blocked!`, 0 `Klimb`**. La única salida de esa
celda es klimb, y el LP no lo hace ahí porque el LP **no estaba ahí** — estaba dentro de la mazmorra.

**El port se comporta correctamente; el instrumento es el que no puede medir.** Es la debilidad
estructural que el pre-registro §1 anticipó (celda y facing de arranque desconocidos) manifestada en
su forma extrema: no «menos mejora», sino party inmóvil. Sus 197 comparables **no miden navegación**
y quedan fuera de todo número.

Contraste que lo confirma: Deceit (1,1) f0 tiene el sur abierto — y ad17 sí se mueve y sí desciende
(plantas f3/f5, 14 casadas / 4 resyncs / 0 desconocidas).
