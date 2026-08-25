# LOTE E — corrección de etiqueta 0x198c, verificación 0xd8c, y residuales estáticos

> Carril `re/asm-frontier`. Cierra los residuales estáticos del plan
> ([[asm-frontier-plan]]) + las 2 micro-tareas que adjudicó el lead tras LOTE B/C:
> (1) renombrar `MAINOUT 0x198c` (etiqueta engañosa), (2) verificar que el port no
> omite `party_terrain_time_class` (MAINOUT 0xd8c), y (3) los residuales de LOTE E
> (primitivas ráster DNGLOOK/LOOKOBJ + tablas DATA.OVL con refs débiles).

## 1. Corrección de etiqueta — `MAINOUT.OVL 0x198c`

**El ledger lo tenía como `npc_ship_wind_drift`; es un nombre ENGAÑOSO** (una rama por
la función entera). La etiqueta venía de `inferible-sweep-f1.md:124` (canal verificado
#39), pero **dos notas ya lo llamaban bien** `move_one_actor` (`overworld-ai-rng.md §46`,
`top21-triage.md:45`).

**Derivación del cuerpo (198c-19fe, `re/disasm/MAINOUT.OVL.asm`):** despachador de
movimiento POR ACTOR. `mov si,[bp+4]; shl si,3` → base del registro del actor; lee la
**clase de sprite/tile** en `[si+0x5c5a]`, hace `and al,0xfc` y ramifica por clase:
- `0xec` (remolino/whirlpool): `xor [si+0x5c5f],1` (toggle de fase) → deriva aleatoria
  `call 0x16fc` (`actor_random_wander_step`). **ESTA rama es la "ship/wind drift"** que
  dio nombre —erróneamente— a toda la función.
- `0xfc`: `call 0x14ea` (`actor_radial_viewport_gate`) + persecución (`0x17d4`
  `actor_seek_party_step`, contador `[si+0x5c5f]` tope 0x14).
- otras clases: otros movimientos.

⇒ **Nombre correcto: `move_one_actor`** (mover general del overworld que despacha por
clase de tile; la deriva de barco es sólo UNA rama). Cotejado con los hijos derivados en
[[asm-frontier-lote-b]] (persecución/wander) y con [[overworld-ai-rng]] §46.

Línea canónica (la toma `build_name_seeds` de `routine_census.py` ANTES que el
verified-label, así que corrige el nombre sin editar el JSON de #39):

MAINOUT.OVL 0x198c = move_one_actor

## 2. Verificación — `spawn_threshold` (MAINOUT 0xd8c) vs el port → **NO OMITIDO**

FLAG#1 de LOTE B: el índice 6-vías terreno×día/noche de `0xd8c`. **Verificado contra el
port: NO es una omisión, es un port bit-a-bit.** El clon lo tiene como `spawnThreshold`
en `game/src/core/world/loops/spawn.ts`, con cabecera que cita explícitamente `0x0D8C`:

- `if (floor > 0x7f) return 3;` ≡ `0x0d92` (underworld salta el resto).
- `tile ∈ [WATER_LO,WATER_HI] → 0` ≡ tiles 0x20-0x26 (agua/océano).
- `tile === 4 || tile ∈ [9,0x0f] → 2` ≡ pantano / montañas-colinas.
- else → 1.
- `if (hour >= 0x20 || hour < 5) base += 3;` ≡ bonus nocturno (conserva incluso la rama
  muerta `hour>=0x20`, imposible con hour∈0..23).

El umbral alimenta el gate de spawn (`rollSpawnGate`: `rand(1,30)`; spawn si
`threshold > roll`), tal como `world_turn` 0x1a9f→0x0fc4. Corroborado por
[[overworld-ai-rng]] §2. Consecuencia fiel notable ya capturada en el port: en terreno
normal de DÍA (threshold=1) NUNCA hay spawn (roll≥1); sólo pantano/montaña (2),
underworld (3) o noche (+3) spawnean.

**Veredicto: cerrado, sin acción. No hay hueco F-0.** Corrección de nombre asociada:
`0xd8c` era `party_terrain_time_class` (describe el retorno); renombrado a
`spawn_threshold` (describe el propósito; alinea con el port y con `overworld-ai-rng.md`).

## 3. Residuales estáticos de LOTE E (primitivas ráster + tablas DATA.OVL)

### 3a. Primitivas de ráster DNGLOOK/LOOKOBJ — ya IDENT, diferidas por diseño

No son hueco de la frontera: son **código de JUEGO ya IDENTIFICADO** (sus overlays
están al 100% en el censo tras #39 + LOTE B; `dungeon_view_cell_dispatch` 0xb9e se
derivó en LOTE B). Lo que queda pendiente es su lectura a NIVEL DE PÍXEL (raster de la
vista 3D de mazmorra / vista de gema), y eso está **diferido DELIBERADAMENTE** hasta el
carril de piel fiel de mazmorra/gema (render por pantalla, no reglas) — así lo fija
[[asm-frontier-plan]] §LOTE E y `coverage-depth.md §8sexies`. **No cuentan como "sin
explicar": están entendidas como subsistema, sólo falta el 1:1 de píxel cuando toque el
render.** Sin acción en este lote.

### 3b. Tablas DATA.OVL con refs débiles — dato atribuido, no código

Las ~8 tablas marcadas "sin refs directas en el censo" (p. ej. `table_unk_3db6`
0x3db6/48B `words 11×0x0140…`; `0x1d00` 21 words simétricos; `0x1f22` 6 filas
triangulares) **NO son ASM sin mapear**: son **DATOS** con 100% de atribución de bytes
(`re/COVERAGE.md`, `ledger.py` 202800/202800) y nota de contenido en `coverage.json` +
`dataovl-tables.md`. Su "ref débil" es una **limitación del análisis estático**: se
acceden por direccionamiento **calculado/indexado** (`[bx+si+base]` con base runtime)
que el censo de referencias inmediatas no resuelve — no que estén sin identificar.

Cerrar su semántica EXACTA (qué precio/tarifa/aspecto es cada word) requiere **witness de
runtime** (poner BP en la base y ver quién indexa) → es material del **carril oracle
(LOTE D)**, no estático. Régimen: no se fabrica la identificación por conjetura
(los patrones `11×0x0140` sugieren tarifas por-pueblo, pero sin el consumidor es
especulación). **Anotado para la cola del oráculo; 0 código ASM afectado.**

### Cierre de LOTE E

- Frontera de CÓDIGO ASM: **cerrada** (0 sin explicar; ver `frontier.json`).
- Ráster DNGLOOK/LOOKOBJ: IDENT, 1:1 de píxel diferido a piel fiel (por diseño).
- Tablas DATA.OVL débiles: datos atribuidos al 100%; semántica fina → cola del oráculo (LOTE D).
- Correcciones de ledger de este lote: `0x198c` → `move_one_actor`, `0xd8c` →
  `spawn_threshold`; FLAG#1 (spawn terreno×noche) **verificado NO omitido** en el port.
