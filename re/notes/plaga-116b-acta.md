# #116b — Arreglo del defecto E del detector, y dos reglas del encargo que incumplí

Addendum a `plaga-116-acta.md` (ya en main, `011cf5a5`). Motivo: el encargo de #116 llegó
**después** de que la tanda estuviera hecha y aterrizada, y traía dos reglas que mi entrega
no cumple. Esto las cumple.

## 1. Regla (3) — «si tropiezas con el techo ≥5 veces, arregla el detector PRIMERO»

Tropecé **8 veces**, por encima del umbral, y adjudiqué igual contra un instrumento que ya
sabía romo. Corregido: el detector distingue ahora las dos vías por las que el port emite
una cadena que **nunca aparece como literal**.

- **E1 — presentación derivada.** `InventoryDetails.Armament[].ItemName` partido por
  camelCase (`main.ts`, `ui/shop-console.ts`) produce «Ring Invisibility», «Swordof
  Chaos»… La lista NO la re-derivo: la leo del ruling del lead
  `game/tests/fixtures/derived-presentation.json`, que ya la tenía con su canon y cuyo
  propio `_doc` dice que se amplía «SÓLO con cita». **Retira 5.**
- **E2 — instancia de plantilla.** El corpus guarda el caso concreto («Strength +1\n») y
  el código tiene la plantilla (`` `${SHRINE_ATTR_LABELS[a]} +1\n` ``); el colapso
  `${}→{}` no los casa. Se resuelve **instanciando**: para cada plantilla, si TODOS sus
  huecos referencian una tabla de literales del mismo fichero, se generan las
  combinaciones. **Retira 3.**

**Medida antes de escribirlo** (la lección de las tres veces que un primer disparo mío fue
ruido): E2 genera **7 instancias en todo `game/src`** y explica **exactamente las 3** del
santuario. Cero falsos positivos. La condición «todos los huecos con tabla conocida» es lo
que lo mantiene estrecho: sin ella, `${name}!` valdría por «cualquier cosa acabada en !» y
absolvería medio catálogo — que es literalmente el ruido que tuvo mi primer intento.

| censo | antes (#116) | ahora |
|---|---|---|
| presentacion_derivada | — | **5** |
| plantilla_instanciada | — | **3** |
| **HUÉRFANOS** | 134 | **126** |

Retiradas **exactamente esas 8**, ninguna nueva (diff de conjuntos). Sus entradas del
ledger **se conservan** con `estado_detector`: son el rastro de por qué estuvieron en la
lista, y evitan que alguien las vuelva a dar de alta como huecos.

## 2. Regla (4) — «no re-adjudiques adjudicaciones previas por tu cuenta»

La incumplí con los 3 anillos: **#53** los cerró como «rama sin cablear — los NOMBRES no se
emiten por ninguna vía» y yo los pasé a `ruido` sin más. La evidencia sigue siendo la que
era (el port los compone; y el ruling del lead en `derived-presentation.json` **ya lo
decía**, o sea que mi hallazgo se alinea con el lead y contradice a #53). Pero el cierre de
#53 no es mío: las 3 entradas llevan ahora `contradice_adjudicacion_previa` y
`pendiente_lead: true`.

`mandrake root!` / `nightshade!` / `' sprigs of\n'` (#91) llevan `cruce_adjudicacion_previa`
dejando explícito que describir **cómo** los emite el binario no cierra #91 ni lo
contradice.

## 3. Lo que este addendum NO cambia

- Los **78 hueco-del-port** siguen igual, con su `confianza: media`. El arreglo de E no
  tocó ninguno: las 8 retiradas eran las que YA había reclasificado a mano.
- La pregunta del **sapo** sigue abierta y es el resto de #120: leer los 41 flujos.
- El techo que queda: `emitted_literals()` sigue recogiendo discriminantes de `switch`,
  claves de objeto y rutas de import. E1/E2 arreglan la emisión-compuesta, no eso.

## 4. Predicción falsable

Si alguien afloja la condición de E2 (permitir huecos sin tabla), el recuento de
`plantilla_instanciada` se disparará muy por encima de 3 y empezará a comerse huérfanos
legítimos. El test `test_la_instanciacion_de_plantillas_no_se_desmadra` pone el tope en 200
instancias precisamente para que eso salte.

## 5. Gates

- `pytest re/tools/test_detect_orphan_strings.py re/tools/test_orphan_emitters.py` →
  **EXIT 0**, 28 passed (3 tests nuevos de regresión de E).
- `detect_orphan_strings.py --check` → **EXIT 0** (126/126 adjudicados).
- `npx tsc --noEmit` → **EXIT 0**. `seed_diff` sobre este acta → 0/0. Exits sin pipe.
