# ACTA — Rutinas SIN MARCO (#90): los tres censos, reconciliados

Tarea **#90**, familia hermana de #80. Fecha **2026-07-28**. Carril `prologos-80`.
Origen: barrido-72, §A9 de `re/notes/barrido-gfx-consumidores.md` (en main).
Encargo del lead: *«probablemente POBLACIONES SOLAPADAS: reconciliar los censos antes de
sumar agujeros»*.

Instrumentos: `re/tools/hidden_prologues.py` (#80) y el campo `orphan_call_targets` que
`routine_census.py` emite desde C.3. Canal de cita: bytes crudos de
`original/u5/ultima5/ULTIMA.EXE` (el offset de fichero es el de kernel desplazado en `0x800`).

---

## RESUMEN

**No se solapan: son DISJUNTOS, y además por construcción.** De los 42 sin-marco-llamados,
**41 ya tienen fila** de censo; el que falta (`0x84DD`) **no** está en los 24
`orphan_call_targets`, y la intersección de las dos poblaciones es **cero**. El motivo no
es la suerte: los 42 candidatos caen **todos** en frontera de instrucción (42/42) y los
huérfanos del kernel **ninguno** (0/5). Cada criterio es ciego justo donde el otro ve.
La suma honesta de filas que faltan **no** es 1+19+2+42: es **23** (las 22 de #80 más
`0x84DD`).

Y aparece una **cuarta familia** que ninguna de las dos tarjetas contemplaba: el
**bootstrap** del kernel (CS ≥ `0x81D0`) tiene rutinas reales y llamadas reales que los dos
instrumentos maltratan, y por su culpa **dos de los cinco «artefactos» que declaré en #80
§A.3 estaban mal adjudicados**. Corregido en sitio.

---

## 1 · Reproducción del criterio de barrido-72, y el 41-vs-42

Criterio de §A9.1, re-implementado: primera instrucción **no-`nop`** después de un `ret`,
que **no** sea `push bp`, y a la que **alguien llame**.

| medida | barrido-72 | esta acta |
|---|---:|---:|
| candidatos sin marco (kernel) | 136 | **136** ✔ |
| de ellos, realmente llamados | 42 | **41** por el canal A, **42** por el canal B |

Los cinco controles positivos de barrido-72 salen **clavados**, con sus cifras de llamadas:
`0x4DAA` 9 · `0x4E20` 6 · `0x4EFC` 5 · `0x08E6` 8 · `0x0B2D` 2.

**La diferencia es de UN caso y tiene causa exacta.** El canal A (grafo de llamadas del
flujo decodificado, vía `resolve_near_call`) da 41; el canal B (barrido de bytes `E8` con la
base por overlay, que es el que usó barrido-72) da 42. El que sólo ve B es **`0x84DD`**, y
no es un falso positivo de B: es un **falso negativo de A**. Ver §3.

## 2 · La reconciliación de los tres censos

| población | n | ¿con fila de censo? |
|---|---:|---|
| sin-marco llamados (#90) | 42 | **41 sí**, 1 no (`0x84DD`) |
| `orphan_call_targets` (#80 C.3) | 24 | 0 por definición |
| de esos 24, entradas reales adjudicadas (#80 §A.3) | 19 | 0 |

**Intersección `{42} ∩ {24}` = 0.** Y es estructural, no casual:

| | cae en frontera de instrucción |
|---|---|
| los 42 sin-marco | **42 de 42** |
| los 5 huérfanos del kernel | **0 de 5** |

El criterio de barrido-72 sólo puede nominar candidatos que **estén** en el flujo
decodificado (busca «la instrucción siguiente a un `ret`»); y un destino llamado que esté
en frontera y sea hoja **ya recibe fila** por la pata de terminador de frontera-27, así que
no puede ser huérfano. Los huérfanos son exactamente los que **no** caen en frontera, y a
esos el criterio de #90 no llega a proponerlos siquiera.

**Testigo del género, `ULTIMA.EXE 0x230E`** (apagar el altavoz, 5 llamadores en 3 módulos):
no está entre los 136 candidatos, porque el byte de relleno de `0x230D` hace que el barrido
lineal emita el fantasma `add ah, ah` cubriendo `0x230D`–`0x230E`, y ahí no hay ninguna
«instrucción siguiente a un `ret`» que proponer. Es la misma mecánica de #80, actuando
ahora sobre una hoja sin marco en vez de sobre un prólogo.

⇒ **Regla para el acervo**: enumerar rutinas por el flujo decodificado y enumerar por
destinos-de-llamada son dos censos con **puntos ciegos complementarios**. Ninguno acota al
otro y sus cifras **no se suman**: hay que unirlos por offset y luego contar.

## 3 · ★ Cuarta familia: el BOOTSTRAP (CS ≥ 0x81D0), maltratado por los dos instrumentos

`0x84DD` no tiene fila, no está en los 24, y es una rutina **real**. Cuerpo entero (bytes,
offset de fichero `0x84DD` + `0x800`):

```
84dd  b400    mov  ah, 0
84df  9c      pushf
84e0  cd1a    int  0x1a        ; BIOS: leer el contador de ticks
84e2  9d      popf
84e3  c3      ret
```

Frameless, termina en `ret`, y la llaman **dos veces**: una en `0x8429` y otra en `0x848E`. El código
de alrededor de `0x8429` es aritmética coherente sobre el contador (`cmp al,0 / add dx,0xb0 /
sub dx, cs:[0x316] / sub cx, cs:[0x314]`): no es tabla leída como código.

**Por qué se le escapa a cada instrumento:**
- **Canal A / el censo**: `resolve_near_call` manda todo CS ≥ `0x81D0` a la **banda de
  overlays**, así que la llamada de `0x8429` a `0x84DD` se contabiliza como si apuntara a
  `TOWN.OVL 0x030D`. Es correcto **en runtime** (ahí ya vive el overlay) y **falso en
  tiempo de arranque**, que es cuando esa llamada ocurre de verdad.
- **El censo**, además, colapsa todo lo que hay por encima de `0x7780` en **una sola fila**
  de `kind = plink-data`, así que ninguna rutina del bootstrap puede tener fila propia.

### 3.1 · CORRECCIÓN a mi propia acta de #80 (§A.3)

En #80 declaré 5 de los 24 huérfanos «artefactos», y de dos di una razón **equivocada**:

| dije en #80 | lo correcto |
|---|---|
| `TOWN.OVL 0x0210` y `TOWN.OVL 0x030D` son artefactos porque su call-site cae en la banda PLINK y «no es un `call`, es la tabla de stubs leída como código» | El **veredicto se sostiene** (no son entradas de TOWN.OVL), pero **la razón era falsa**: los call-sites `0x83C3` y `0x8429` son **código de bootstrap real**, y sus destinos reales son las rutinas de bootstrap `0x83E0` (descifra un rango con `xor 0xDC`) y `0x84DD` (tick del BIOS). Lo que falla no es el call-site: es la **proyección** de CS ≥ `0x81D0` al espacio de overlay. |

Es decir, mi filtro `clean_calls` acertó **por el motivo equivocado**, y como criterio
general **no vale**: descarta llamadas del bootstrap que son reales. Queda anotado en la
propia §A.3 de `prologos-ocultos-80.md`.

## 4 · Predicciones pre-registradas, y qué falló

Escritas **antes** de medir:

| # | predicción | resultado |
|---|---|---|
| P1 | ≥ 35 de los 42 ya tienen fila | ✔ **41 de 42** |
| P2 | los sin-marco sin fila serán un **subconjunto** de los 24 huérfanos | ✘ **FALLA**: el único (`0x84DD`) **no** está en los 24, porque el canal que produce los huérfanos no puede verlo |
| P3 | los 42 y mis 19 se solapan sin contenerse | ✔ en la forma (42 sólo kernel, 14 de mis 19 en `.DRV`), pero la intersección resultó **0**, más fuerte de lo que predije |
| P4 | el total NO es 1+19+2+42; sigue en 22 | ~ casi: es **23**, las 22 de #80 **+ `0x84DD`** |

**P2 es el fallo útil**: yo asumía que un censo acotaba al otro, y la medida dice que son
disjuntos con puntos ciegos complementarios. Si hubiera «reconciliado» sin medir, habría
escrito que los 42 estaban contenidos en los 24 y la cifra habría quedado mal en la
dirección cómoda.

## 5 · Denominador, actualizado

| familia de entrada que el censo no ve | filas |
|---|---:|
| prólogo oculto sin llamador (`0x2316`, #80) | 1 |
| hoja sin marco fuera de frontera, con llamador (#80 §A.3) | 19 |
| manejador instalado por vector de INT (#80 §A.4) | 2 |
| **rutina del bootstrap CS ≥ 0x81D0 (`0x84DD`, esta acta)** | **1** |
| **total** | **23** |

885 publicadas ⇒ **~908 reales**. Los 42 sin-marco de #90 **no añaden 42**: añaden **1**.

## 6 · LO QUE ESTA ACTA **NO** CIERRA

- **No adjudica las 41 con fila.** Tienen fila y límite; sus veredictos de contenido no se
  han tocado. La retractación de §4 de barrido-72 (`0x4DAA`/`0x4EFC` eran rutinas reales y
  cotejo-51 las había nombrado bien) ya está en su acta; aquí sólo se confirma que tienen
  fila.
- **No propone admitir el bootstrap al censo.** Que CS ≥ `0x81D0` sea «código que los
  overlays pisan» es una decisión de modelo anterior a esta tarjeta y con consecuencias en
  todo el ledger; cambiarla es una tarjeta propia, no un efecto colateral. Lo que sí queda
  es que **la banda tiene código real** y que el filtro `clean_calls` no debe usarse como
  criterio de artefacto.
- **No re-adjudica los otros 3 «artefactos»** de #80 §A.3 (`TOWN.OVL 0x11DC`,
  `SJOG.OVL 0x1478`, `NPC.OVL 0x0D6F`). Sus call-sites están en zonas de datos de overlay,
  que es un mecanismo distinto del de la banda de bootstrap; su veredicto de artefacto sigue
  en pie con su razón original, pero merecen la misma lectura fina que acabo de hacerle a
  los dos de TOWN.
