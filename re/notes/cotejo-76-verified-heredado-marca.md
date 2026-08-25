# #76 — `verified_heredado`: marca, guarda y triaje de las 168

Carril `cotejo-51` (continuación) · 2026-07-28 · rama `re/frontera-verified-26`.
Implementa el ruling del lead sobre el punto (d) de [[cotejo-51-verified-heredado]]: **no
se invalidan las 182 filas de golpe**, se marcan con el patrón `pin_only` y el hueco baja
por adjudicación.

---

## 1. La cifra es 168, MEDIDA — no las «~173» de la tarjeta

De las 182 filas del anexo, **14 ya estaban acreditadas a mano**: las 9 de #51 y **cinco
que otros carriles habían cerrado por su cuenta sin que nadie lo cruzara**
(`COMSUBS:0x12de`, `ENDGAME:0x23a`, `OUTSUBS:0x368`, `TALK:0xf32`, `ULTIMA.EXE:0x71aa`).

Calculada llamando a la **misma función que usa el gate**, que es la lección que dos
prerregistros seguidos aprendieron por las malas.

## 2. Qué se implementó

- `routine_census.load_verified_labels()` devuelve además `cite`, y **su docstring queda
  corregida**: decía «presencia aquí == evidencia FUERTE (lectura directa)», y eso no es
  cierto tal cual — la fila tiene tres campos, sin cita ni offsets, y encima siembra el
  `name`. Ahora hay dos clases de fila y `cite` las separa.
- `frontier.py` marca `evidence.verified_heredado` cuando el `verified` sale de una fila
  **sin cita** y **nadie lo acreditó a mano**, y lo propaga como
  `summary.verified_inherited_without_cite`.
- El cargador del anexo se **importa**, no se re-implementa: un criterio con dos copias
  diverge en silencio (es el motivo de que `PIN_CITE_RE` sea único).
- **NO se regenera `routine-census.json`.** Es un artefacto curado y regenerarlo destruye
  los nombres — es literalmente el motivo de que exista `pin_only`.

## 3. ★ Mi primera guarda no vigilaba nada, y la tumbó mi propio control

La puse sobre el **contador derivado**. Inyecté una fila de tres campos en el anexo y los
40 tests siguieron **verdes**.

El motivo: `frontier.build()` lee `verified` de `routine-census.json`, que **no se
regenera en los gates**. Una fila nueva no sella nada hasta que alguien regenere — y para
entonces el trinquete llegaría tarde y con un diff de miles de líneas encima.

Movida la guarda **al anexo** (las filas sin `cite` no pueden crecer), el mismo control la
pone roja.

> **Lección, escrita también en el test:** un trinquete sobre una cifra DERIVADA de un
> artefacto que no se regenera **no vigila nada**. Ponlo sobre la fuente.

Y es la forma económica de cumplir el (4): una fila nueva sin `cite` rompe el trinquete
por construcción, así que para sellar un `verified` nuevo hay que traer cita — y entonces
ya no es una fila de tres campos. **La guarda es el mecanismo, no una comprobación aparte
que alguien pueda olvidarse de correr.**

### Controles ejecutados, no razonados
1. Fila nueva de 3 campos → `test_el_anexo_NO_puede_crecer_...` **ROJO**. Restaurada → verde.
2. `cite` añadida a una fila existente → el contador **baja 168 → 167**. Restaurada → 168.

## 4. Los dos extras del lote

### 4.1. `0x2c4c` renombrada (acto SEPARADO del sello, como manda la regla)
`tile_property_query_dispatch` → **`kernel_tile_passable (11-case jump table por CLASE del
móvil)`**. El cuerpo (leído en #51) manda: despacha por la clase del **móvil** y los 11
handlers convergen en `ax=1`/`ax=0` ⇒ **booleano de pasabilidad**. Reconcilia el ledger
con las 5+ notas del corpus que ya lo llamaban así. Se precisa «por CLASE del móvil»
porque el índice **no** es el tile destino — es el error de lectura más fácil de cometer.

### 4.2. `kernel_fn_6794` cerrada — y vuelve a aparecer el género de #51
Cuerpo entero leído (108 B, 44 insn, `ret 2`): para un actor, aplica los pasivos del
**anillo equipado**. Dos ramas sobre el byte `[slot*0x20 + 0x55c5]`:
- `0x2a` (=42, **Ring of Invisibility**) → tile de render `0x1d` + bit `0x10` de invisible;
- `0x2c` (=44, **Ring of Regeneration**) → `call 0x400c` = `kernel_ring_regen`.

⇒ **`kernel_actor_ring_effects (invis 42 / regen 44)`**, `verified`.

Y otra vez lo mismo: **`kernel-sweep-4.md:144-159` ya lo tenía derivado desde el 18-07**,
citando el mismo `0x67bf`. La derivación existía; el ledger no la tenía; la rutina se
quedó con nombre-marcador. Era la tercera llamada de `SJOG:0x2012` que #51 dejó apuntada.

**Matiz declarado:** el byte `0x55c5` aparece en el corpus con **dos lecturas** —«marcador
de status (0x2a = envenenado)» en `kernel-sweep-3.md:357` y `camp-scene.md:49`, y «anillo
equipado» en `kernel-sweep-4.md:39` (corrección del 18-07)—. Mi cuerpo respalda la
segunda: la rama `0x2c` llama literalmente a `kernel_ring_regen`, que sólo tiene sentido
si el byte es el anillo. Las notas viejas no se han actualizado. **Lo dejo declarado y no
las toco** — no es este el carril.

## 5. Triaje de las 168: la cola, priorizada (`re/tools/triage_heredados.py`)

El género no es sólo «falta la lectura»: dos veces ya ha sido **«la lectura existe y nadie
la cruzó»**. Así que antes de mandar a nadie a releer 168 cuerpos, se mide cuántas tienen
ya rastro en el corpus.

| clase | n | qué significa |
|---|---:|---|
| **CANDIDATO FUERTE** | **56** | el offset aparece citado junto al fichero y con pistas de cuerpo ⇒ empezar por aquí, es lo barato |
| MENCIÓN DÉBIL | 86 | el offset aparece suelto; puede ser ruido (un `0x748` cualquiera) |
| **SIN RASTRO** | **26** | nadie lo ha citado nunca ⇒ lectura fresca obligada |

Las 26 sin rastro se reparten: `ULTIMA.EXE` 11 · `LOOKOBJ` 5 · `SHOPPES3`/`TALK`/`TOWN` 2
c/u · `CAST`/`CAST2`/`MAINOUT`/`NPC` 1 c/u.

**Sensibilidad vs especificidad, declarada:** un offset corto aparece en muchos ficheros,
así que la señal amplia es sensible y poco específica; la estrecha exige que el fichero se
nombre a ±3 líneas **y** haya pistas de cuerpo. `ULTIMA.EXE` va aparte porque el corpus
cita sus offsets **desnudos** («kernel 0x2c4c») y ahí la señal estrecha subestima.

**CONTROL con respuesta conocida, dentro del propio script** (`control()`): sobre las 14 ya
acreditadas, las **4** que #51 dejó escritas como «tenían derivación en el corpus»
(`0x2c2e`, `0x2c4c`, `0x2e96`, `CAST 0x1c36`) salen las 4 como candidato fuerte. Si no
salieran, el 56 no valdría. **Este control existe porque hoy dos instrumentos míos pasaron
por buenos hasta que los probé** (el detector de citas perdidas de #51 y la primera guarda
del anexo).

> Un candidato **no** es una acreditación: hay que abrir la nota, comprobar que habla del
> cuerpo y no de pasada, y **leer el cuerpo igual**. Lo que el triaje ahorra es la
> búsqueda, no la lectura.

## 6. Lo que este carril NO hizo

- **No adjudicó ninguna de las 168.** La cola queda arrancada y priorizada, no trabajada.
- No tocó las notas con la lectura vieja de `0x55c5` (§4.2).
- No regeneró el censo (§2), a propósito.
