# #94 — DERIVA RUTA/PRODUCTOR: población MEDIDA (19 de 49), y el instrumento era CIEGO

Fecha: 2026-07-30. Estado: **medida, NO regenerada** (a propósito — ver §4).

## 1. El defecto del instrumento, que es lo primero

La tarjeta describía la deriva como algo descubierto **por accidente**: al correr `curate.mjs`
sin `--check`, el productor ESCRIBIÓ en tres artefactos y el diff reveló que la ruta
commiteada no era su salida.

Eso no era mala suerte: era la única vía que quedaba, porque **`--check` no comparaba nada**.
Su cuerpo hacía

```js
if (!check) writeFileSync(routePath, JSON.stringify(route, null, 2) + "\n");
```

es decir, con `--check` calculaba la ruta entera en memoria y **la tiraba**. Lo que censaba
—`RANCIAS` y `huérfanas`— son propiedades del OVERLAY, no de la ruta. Por eso las 24 rutas
de LP1 dan `0 RANCIAS, 0 huérfanas` y aun así **cinco están derivadas**: el instrumento
medía un eje que no es el del defecto.

Es la firma de [[instrumento-equivocado-peor-que-ninguno]]: un `--check` que pasa en verde
se lee como «el artefacto está al día», y aquí no decía nada de eso.

**Arreglo:** `--check` ahora serializa la ruta producida y la compara **por bytes** contra
el fichero en disco, e informa `DERIVA` con los dos tamaños.

## 2. Población MEDIDA (SHA 427d69d3, corpus completo, sin escribir)

| Corpus | Rutas | Derivadas | Cuáles |
|---|---:|---:|---|
| `routes` (LP1) | 24 | **5** | part04 part05 part19 part20 part22 |
| `routes-ad` (AD) | 25 | **14** | ad08 ad09 ad10 ad12 ad13 ad14 ad15 ad16 ad17 ad18 ad22 ad23 ad24 ad25 |
| **TOTAL** | **49** | **19** | |

La tarjeta decía «≥3 rutas». Son **19**. La cota de la tarjeta salía de las tres que el
accidente tocó, no de un censo.

## 3. QUÉ cambia exactamente — leído par a par, no inferido del tamaño

★ **CORRECCIÓN de la primera versión de este acta** (misma sesión, tras leer los pares): la
partí en «sustitución» vs «inserción» según el TAMAÑO del fichero. El tamaño no es el dato.
Leídos los 19 pares campo a campo, el reparto real es:

| Qué cambia | Cuántos | Detalle |
|---|---:|---|
| Clave `skip` que el producido AÑADE a un segmento | **104 segmentos** | el commiteado no la lleva |
| `script` con distinto valor | **2 segmentos** | y es **PERMUTACIÓN**: mismo multiconjunto de ops, otro ORDEN |
| Claves que el producido QUITA | **0** | — |
| Segmentos que aparecen o desaparecen | **0** | mismos IDs, mismo número |

Y el `script`, sumado sobre las 19 rutas, es **permutación pura en las 19**: se comparó el
multiconjunto de ops serializadas (`json.dumps(op, sort_keys=True)`) y sale idéntico en
todas — 803 ops en `part05`, 2.933 en `ad25`, etc. **Ninguna op se pierde ni se añade.**

⇒ Regenerar **AÑADIRÍA 104 `skip`** y **reordenaría el script de 2 segmentos**. No borraría
nada. Eso es el caso (a) de la tarjeta —«el overlay pedía un skip que la ruta no llevaba»—
confirmado y CUANTIFICADO; y el caso (b) («sustituiría `{seedGold:2000}` por `{wait:350}`»)
resulta ser esa permutación: las dos ops existen en las dos versiones, en distinto sitio.

★ **Lo que casi escribo y era falso.** El primer hunk que leí de `part05` mostraba
`- seedGold:2000 / + wait:350` y de `part04` un bloque de 68 líneas sólo en el commiteado
—incluido un `anchor` con `expectDelta:-954` del ledger numérico—. De ahí infería que
regenerar DESTRUIRÍA anclas del ledger, que es una conclusión alarmante y equivocada: el
hunk muestra el desplazamiento, no el balance. El multiconjunto lo desmintió. Es la misma
trampa de [[fragmento-truncado-acusa-en-falso]]: **un hunk no es el conjunto de datos**.

## 4. Por qué NO se regenera aquí

Regenerar es un `curate.mjs` sin `--check` y estaría hecho en un minuto. No se hace:

1. **La decisión conservadora de reocr está RATIFICADA en la propia tarjeta** (no regenerar
   part19-24 ni part07/08).
2. **Una ruta puede llevar decisiones humanas que el productor de hoy no reproduce** — es
   exactamente lo que costó #85: cinco decisiones de skip perdidas al re-generar. Sobre-
   escribir 19 rutas a ciegas es re-abrir esa herida a escala.
3. Y sobre todo, tras §3: lo que regenerar haría es **añadir 104 `skip`**, y un `skip` hace
   que el runner SALTE ese segmento. Aplicarlos NO es un saneamiento, es **bajar la cobertura
   del espejo en 104 sitios**. Esa es una decisión de alcance, no de higiene, y no la toma
   un `--check`.

Por eso el gate **informa y NO rompe** (`exit 0` medido por separado, con y sin deriva): con
19 preexistentes, ponerlo en rojo sólo enseñaría a la gente a pasar `--allow-stale`.

## 5. Cola que deja este carril

1. ~~Leer los 19 diffs~~ — **HECHO** (§3). Lo que queda NO es medir, es **decidir**:
   ¿deben aplicarse los 104 `skip`? Un `skip` hace que el runner SALTE ese segmento, así que
   aplicarlos **baja la cobertura del espejo** en 104 sitios. Que el overlay los pida no
   basta: hay que saber si esos skips son decisiones vigentes o el residuo de una tanda de
   calibración vieja. Esa es la pregunta, y NO se responde con el diff.
2. **La causa común de las 14 de AD**: identificar la tanda de overlay que introdujo los
   skips. Con §3 en la mano el candidato es UNA sola tanda (los 104 son todos de la misma
   clave, y el corpus AD deriva entero).
3. Las 2 permutaciones de `script` (`part04-g03` + una de `part05`): decidir si el ORDEN
   del commiteado o el del productor es el correcto. Aquí sí puede haber decisión humana.
4. Cuando (1)-(3) estén adjudicados, decidir si el gate pasa a ROJO.

## 6. Cabo (2) — la población de `skip`, y una cifra mía que NO cuadra

Medido en el mismo SHA:

- **290** segmentos con `skip` ya aplicado en las 49 rutas commiteadas (conteo a nivel de
  segmento, que es donde el runner lo lee).
- **+104** que el productor añadiría en las 19 derivadas (§3).
- ⇒ el total producido sería **394**.

Y aquí una cifra mía que **no cuadra y la dejo declarada en vez de maquillarla**: un barrido
rápido de los overlays me dio «318 skips declarados», que con 290 aplicados sugeriría sólo
28 pendientes — la mitad de la mitad de los 104 medidos par a par. La discrepancia es del
INSTRUMENTO: ese barrido recorre el JSON del overlay entero y cuenta **cualquier** objeto que
lleve una clave `skip`, incluidos los anidados dentro de `insertOps` y demás, así que es una
**COTA, no una población**. La cifra buena es la de §3 (104), que sale de comparar segmento
contra segmento.

★ Y por eso NO se afirma aquí la conexión tentadora: el goal del proyecto habla de «abrir los
~319 segmentos SKIP», y mi cota daba 318 — parecía la misma población y encaja demasiado
bien. **Puede serlo o no**: mi 318 no es una población, así que la coincidencia no prueba
nada. Cruzarlo exige un censo de skips por segmento en el lado del overlay, y es cola.

Lo que sí se sostiene, y cambia el sentido de la decisión: si esos ~300 `skip` son la
LISTA DE PENDIENTES que el proyecto quiere ELIMINAR (abrir los interiores), entonces
aplicar los 104 que faltan es avanzar **en la dirección contraria** al objetivo. Esa es la
pregunta que hay que resolver antes de tocar una sola ruta.
