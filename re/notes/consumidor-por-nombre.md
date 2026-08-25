# El consumidor POR NOMBRE: cuatro tablas del clon parecen muertas y no lo están

**Sujeto:** el port (símbolos exportados y quién los lee de verdad).
**Fecha:** 2026-08-06 · **Carril:** bugs-original.
**Origen:** cayó de un barrido del género «planeado y nunca cableado», que salió de la ficha
de la fragata (#13). El género resultó ser pequeño; **la trampa que apareció de camino es lo
que vale**.

---

## 1. El mecanismo

`game/tools/extract-user-strings.mjs` extrae las cadenas de cara al usuario para i18n. Entre
sus fuentes tiene una **lista blanca de NOMBRES**, `DISPLAY_CONSTS`, que es una regex:

```js
const DISPLAY_CONSTS =
  /^(DIR_NAMES|DIR_WORDS|WIND_NAMES|WIND_BAND_LABELS|WOUND_LABELS|HUD_FAITHFUL_LABELS|…)$/;
```

No importa esas tablas: **las reconoce comparando el identificador contra la regex**. Para
cualquier herramienta que razone sobre el grafo de imports —un linter de «unused export», un
barrido de símbolos sin lector, o una persona con `grep`— ese consumo **no existe**.

Y no es un descuido del análisis: **es invisible por construcción**. Es la misma forma que ya
tenemos fichada en el otro lado del proyecto, donde un near-call resuelto por banda da cero al
grep del texto del disasm: el consumidor no nombra al consumido de la manera que la
herramienta sabe mirar.

## 2. Las cuatro, con nombre

De un barrido de **513** `export const` en MAYÚSCULAS sobre 247 ficheros de `game/src`,
enumerando lectores en `src` + `tests` + `e2e`, salieron **8** «sin lector». **Cuatro de esos
ocho los lee esta lista blanca**:

| tabla | fichero |
|---|---|
| `CLASS_LABELS` | `game/src/core/party.ts` |
| `STATUS_LABELS` | `game/src/core/party.ts` |
| `HUD_FAITHFUL_LABELS` | `game/src/core/world/hud-labels.ts` |
| `WIND_BAND_LABELS` | `game/src/core/world/wind.ts` |

**Borrarlas o renombrarlas rompe la extracción de cadenas de i18n EN SILENCIO**, y el fallo
aparece lejos del cambio: no en el fichero tocado, sino en la siguiente extracción. Aviso
puesto en el propio `.mjs`, encima de la regex, para que se lea desde el sitio donde se
tomaría la decisión de limpiar.

## 3. Cómo se llegó: el censo se equivocó DOS veces, cada una por una omisión distinta

Esto es la mitad transferible de la ficha.

| cifra publicada | población que usé | por qué estaba mal |
|--:|---|---|
| 24 | `game/src`, tests excluidos | **16** los leen los TESTS. «Sin lector en producción» ≠ muerto |
| 8 | `src` + `tests` + `e2e` | **4** tienen consumidor en `game/tools/`, banco que no enumeré |
| **3** | + `game/tools/`, comentarios descontados | sobre 513 = **0,6 %** |

Dos reglas salen de ahí:

1. **Enumera los BANCOS DE LECTORES antes de contar.** Cada banco omitido infla el «muerto».
   Y el denominador es lo que deshace el espejismo: tres coincidencias en la misma zona del
   código hacían ver un patrón donde hay ruido de fondo.
2. **Descuenta los comentarios antes de contar.** Una MENCIÓN no es un USO — es exactamente
   lo que convirtió la fila de la fragata en una afirmación falsa hasta que se corrigió.

## 4. Lo que sí quedó muerto — ANOTADO, no limpiado

Limpiar exports es una decisión aparte y no urge; se dejan escritos para que la siguiente
persona no repita el barrido.

| símbolo | fichero | estado |
|---|---|---|
| `REFLOW_VIEW_WINDOW` | `game/src/skin/portrait/layout.ts:568` | **muerto**: es un alias (`= VIEW_WINDOW`) sin ningún lector en ningún banco |
| `HMS_CAPE_GAM_OFFSET` | `game/src/core/saveNative.ts:251` | **muerto**: su única otra aparición es una mención en un comentario diez líneas antes |
| `SHIP_REPLACEMENT_PRICE` | `game/src/core/shops/shop-tables.ts:62` | **muerto**, ya documentado en el registro público (§1.4) |
| `NIVELES` | `game/src/web/consentimiento.ts:25` | **CANDIDATO, no muerto**: sin lector dentro de `game/`, pero es un módulo web y **no he descartado consumidor fuera de `game/`**. No se cuenta hasta mirarlo |

## 5. Grados

- **MEDIDO**: el mecanismo de la lista blanca (leído en el `.mjs`), las cuatro tablas que
  contiene y sus ficheros, las tres cifras del censo con su población declarada, y los tres
  símbolos muertos con su banco de lectores vacío.
- **NO MEDIDO**: si `NIVELES` tiene consumidor fuera de `game/`. Por eso es candidato.
- **NO ADJUDICADO**: si conviene limpiar los muertos. Es decisión de otro, y esta ficha sólo
  deja el terreno enumerado.
