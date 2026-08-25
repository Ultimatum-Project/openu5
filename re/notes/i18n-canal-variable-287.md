# ACTA #287 — el canal «por VARIABLE», barrido por AST: DOS huecos reales, y los dos invisibles a cualquier cifra

> Carril `deriva-libre`, rama **`re/deriva-libre`**, base main **`9a92024f`**.
> Continuación de `i18n-barrido-287.md`, que cerró el canal de CONSTANTE y dejó éste
> declarado como no visto (§3 de aquella ficha).

---

## 0. VEREDICTO

| | |
|---|---|
| **Población del canal** | **263** llamadas `t()`/`tf()` cuyo primer argumento **no** es un literal |
| **Resolubles en su fichero** | **27** (34 valores distintos) |
| **Sin entrada en el corpus** | **2** — `"Int="` y `"  Ex:"`, las dos en `skin/fiel/ztats.ts` |
| **Qué son** | ★★ **hueco de FAMILIA INCOMPLETA**: 8 etiquetas de Ztats en el port, **6 traducidas y revisadas, 2 sin entrada** |
| **Por qué nadie las vio** | las dos se escriben **igual en castellano** ⇒ sin síntoma en pantalla y sin síntoma en `t(k) === k` |
| **Cota declarada** | **230 PARAMETRO + 6 COMPUESTA** que este barrido NO cierra |
| ⚠ **Un cero mío que era del 100%** | la primera corrida dio **35 ausentes** y eran **todos** artefacto: comparaba contra la raíz de `es.json` en vez de contra `es.json.strings` (§4) |

## 1. El método: por qué AST y no regex

La ficha previa **descartó por escrito** el barrido por regex sobre el texto fuente, y no de
palabra: con la cifra que produjeron sus tres defectos. §2 de `i18n-barrido-287.md` documenta
que la cuenta de «sin entrada» fue **27 → 10 → 5 sin que el repositorio cambiara**, y que los
22 que se cayeron eran del instrumento:

| defecto medido allí | por qué el AST no lo tiene |
|---|---|
| (a) comentarios tragados (llevan comillas dentro) | los comentarios son *trivia*: no son nodos de expresión |
| (b) raíz sin filtrar (`ev`, `beat` entraban como tablas de UI) | la raíz es un símbolo con su declaración, no un identificador cualquiera antes de un punto |
| (c) ★ sólo comilla DOBLE — partía por la mitad las cadenas escritas con comilla simple | un `StringLiteral` trae `.text` ya des-escapado, sea cual sea la comilla |

⇒ Repetir la técnica habría repetido los tres. El barrido nuevo
(`re/tools/i18n_canal_variable.mjs`) usa el parser de TypeScript, y el defecto (c) tiene
**control propio** en la batería, porque es el que más caro salió.

★ Y de paso queda medido que la técnica descartada seguía siendo tentadora: un
`grep -E "\bt\(\s*IDENT"` sobre el mismo corpus devuelve 68 «llamadas» entre las que hay
`t(uffix`, `t(orry`, `t(old` — colas de palabras. La población real es **263**.

## 2. Las clases, y qué significa cada una

| clase | n | qué es |
|---|---|---|
| `RESUELTA` | 27 | el argumento es un `const` local con literal, o un conjunto CERRADO (ternario de literales, objeto/array de literales). Se puede cruzar con el corpus |
| `PARAMETRO` | 230 | el valor viene de fuera de la función o de una llamada. **No es una fuga: es lo que este instrumento no puede cerrar** |
| `COMPUESTA` | 6 | plantilla con interpolación o `??` sobre tabla: no hay clave fija |

**188 de los 230 `PARAMETRO` viven en `ui/shop-console.ts`** — un solo fichero es el 82% de
la cota. Quien quiera cerrar el canal entero tiene ahí el trabajo concentrado, y no repartido.

## 3. ★★ El hallazgo: la familia de etiquetas de Ztats está 6/8

`skin/fiel/ztats.ts` declara ocho etiquetas del panel, cada una con su offset del binario al
lado, y las ocho pasan por `t()`:

| const | valor | corpus |
|---|---|---|
| `LV_PREFIX` | `" Lv-"` | `" Nv-"` ✓ revisada |
| `L_STR` | `"Str="` | `"Fue="` ✓ revisada |
| `L_HP` | `"  HP:"` | `"  PV:"` ✓ revisada |
| **`L_INT`** | **`"Int="`** | ★ **SIN ENTRADA** |
| `L_HM` | `"  HM:"` | `"  VM:"` ✓ revisada |
| `L_DEX` | `"Dex="` | `"Des="` ✓ revisada |
| **`L_EX`** | **`"  Ex:"`** | ★ **SIN ENTRADA** |
| `L_MAGIC` | `"Magic:"` | `"Magia:"` ✓ revisada |

Las seis presentes están además marcadas `reviewed: true`. **Alguien tradujo esta familia, la
revisó, y se dejó dos miembros** — y las dos ausencias caen **alternadas** entre las presentes,
en las líneas 198 y 199, entre vecinas que sí están.

### 3.1 Por qué esto no lo cazaba nada

Tres instrumentos distintos son ciegos a este hueco, y por tres motivos distintos:

1. **Cualquier cifra agregada.** «6 de 8 miembros presentes» no existe como número en ningún
   sitio: el corpus tiene 4003 claves y estas dos no aparecen ni como falta ni como sobra.
   Es literalmente `familia-incompleta-invisible-a-cifras`.
2. **`t(clave) === clave`.** `t()` sin entrada devuelve la clave, así que el panel muestra
   `Int=` y `  Ex:`. Y en castellano **eso es exactamente lo que hay que mostrar** —
   *Inteligencia* y *Experiencia* se abrevian igual—, así que el predicado no distingue
   «traducida a sí misma» de «no traducida». Es la trampa del `Ginseng`.
3. **La pantalla.** No hay síntoma visible. El panel de Ztats en castellano se lee bien.

⇒ **El hueco es real y no tiene un solo síntoma.** La única vía que lo encuentra es la que
pregunta al CORPUS por la familia COMO CONJUNTO, que es lo que hace este barrido al resolver
las ocho constantes del mismo fichero.

### 3.2 Lo que NO adjudico

No traduzco las dos ni las añado al corpus. Añadir `"Int=" → "Int="` y `"  Ex:" → "  Ex:"` es
una decisión de política de i18n (si la identidad se declara explícitamente, como se hizo con
`Avatar` en la ficha previa, o si se deja fuera a propósito), y esa política tiene dueño. Lo
que este acta aporta es que **el hueco existe, es de familia, y no lo enseña ninguna cifra**.

⚠ Seña lateral sin adjudicar: la línea 108 anota el offset como `("\nInt=")` — con salto de
línea delante— mientras la constante es `"Int="` sin él. No lo toco: es materia de la cita,
no del corpus.

## 4. ⚠ Mi primera corrida dio 35 ausentes y eran 35 artefactos

La primera ejecución publicó **35 valores «sin entrada en `es.json`»** — el **100%** de lo
resuelto. El motivo: `es.json` no es un mapa de claves, es `{ meta, strings }`, y yo comparaba
contra la **raíz**. Todo estaba ausente por construcción.

Lo peor no es el fallo: es que **el control de corpus lo dejó pasar en verde**. Preguntaba
*«¿tiene entradas?»* y la raíz tiene dos, así que respondía OK. Y el control NEGATIVO usaba
`Object.keys(corpus)[0]` como testigo de «clave presente», que con la raíz equivocada valía
`"meta"` — **presente en el corpus equivocado**, con lo que también pasaba.

**Dos controles verdes sobre un corpus que era el objeto equivocado.** Lo destapó el
`(2 claves)` que el propio informe imprime al lado del OK: una cifra que no encajaba con nada.

Arreglado en el instrumento, y con el arreglo escrito en el código:
- el corpus es `esJson.strings`;
- el control de corpus ya no pregunta «¿hay entradas?» sino **«¿está dentro un testigo FIJO
  que sabemos que existe (`"Arms"`)?»**, que es lo único que discrimina el nivel correcto del
  incorrecto.

⇒ Familia `set-de-json-ajeno-necesita-dos-controles`: un control que sólo mide el CARDINAL de
una estructura ajena no comprueba que sea la estructura que crees. Y hermana del cero falso de
`kernel-token-199-acta.md` §12, del mismo carril y del mismo día: **el segundo instrumento
propio que falla en una sesión, y los dos los cazó una cifra secundaria que no cuadraba.**

## 5. Cota declarada — lo que este barrido NO ve

- Los **230 `PARAMETRO`** y los **6 `COMPUESTA`**: 236 llamadas cuyo conjunto de valores no se
  cierra en el fichero. **236 es cota, no fallo.**
- **No sigue imports**: una constante importada de otro módulo sale `PARAMETRO`.
- **No evalúa llamadas**: `t(furnitureSearchProse(tile))` y `t(lootOpenLine(id))` son conjuntos
  cerrados en la práctica y aquí no se abren. Es el caso que la ficha previa nombró con
  `partOfDayWord()`, todavía vivo.
- **No mira el otro sentido**: claves del corpus que ya no consume nadie.

⇒ **27 resueltas es cota inferior de la población y 2 cota inferior de los huecos.** No se
concluye «el canal por variable está limpio»: se concluye que **de lo que este instrumento
puede cerrar, falla una familia y falla por dos miembros**.

## 6. Controles (`node re/tools/i18n_canal_variable.mjs`, EXIT=0)

| control | qué prueba | resultado |
|---|---|---|
| **CORPUS** | `es.json.strings` con el testigo FIJO `"Arms"` dentro — no «¿tiene entradas?» (§4) | **OK** (4003 claves) |
| **POSITIVO** | un `const` con una cadena inexistente sale `RESUELTA` **y ausente**: sin esto, un informe de cero ausencias no vale nada | **OK** |
| **NEGATIVO** | un `const` con clave presente **no** sale como ausente | **OK** |
| **COMILLAS** | una cadena en comilla SIMPLE que contiene comillas DOBLES se lee ENTERA — control del defecto (c) ya medido | **OK** |

Los controles corren **antes** del informe y, si alguno falla, el módulo sale con `EXIT=1` y no
publica cifras.

## 7. Lo que este acta NO hace

- **No toca `game/src`** ni `es.json`: no añade las dos claves ni traduce nada.
- **No cierra #287**: cierra el subcanal RESOLUBLE y deja las 236 con su cota.
- **No re-mide** el canal de CONSTANTE de la ficha previa.
- **No abre tarjeta nueva**: los dos huecos y la cota caben en #287.

## 8. Reproducción

```
base                        main 9a92024f
node re/tools/i18n_canal_variable.mjs                  EXIT=0
poblacion                   263 llamadas no-literales
  RESUELTA                   27  (34 valores distintos)
  PARAMETRO                 230  (188 de ellas en ui/shop-console.ts)
  COMPUESTA                   6
sin entrada en el corpus      2  (skin/fiel/ztats.ts:198 y :199)
corpus                     4003 claves en es.json.strings
```
