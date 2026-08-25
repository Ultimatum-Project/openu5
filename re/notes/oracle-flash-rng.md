# Oráculo #17 — RNG en la ruta de render: ¿desalinea el stream del juego?

> Dictamen del oráculo sobre los consumidores de `rand_range` (`0x2092`, EL rng del
> juego, seed global `g_rng_seed`=DS:`0x5420`) que viven en la ruta de RENDER, no en
> la lógica de turno. Origen: barrido lotes 1-2 (`kernel-render-sweep.md §2`,
> `kernel-sweep-2.md §6`). Medido en vivo con `re/tools/flash_rng_probe.py` y
> `re/tools/render_rng_probe.py` (oráculo dosbox-x, 2026-07-14).

## 0. TL;DR — veredicto

Hay **tres** consumidores de RNG en la ruta de render, **todos** escriben el seed
global `0x5420` (via `call 0x2092`), confirmado por el asm y por el censo de
`rng.md`:

> **⚠ CORRECCIÓN (Task #20):** la fila 1 (`0x2f62`) NO es un
> "sprite_frame_randomizer": el disasm de `0x2E96` (`mov [g_wind(0x5892)],al`)
> prueba que `0x2f62` es **`maybe_change_wind`** (el label de
> `test_transport_parity` era el correcto). No cambia el veredicto de
> indeterminismo (sigue siendo un consumidor incondicional del seed en el timer
> de render), sólo su SEMÁNTICA. Re-derivación en `re/notes/transport.md §4.1`.

| # | Rutina | Tirada | Cuándo dispara | Cadencia |
|---|--------|--------|----------------|----------|
| 1 | `0x2f62` `maybe_change_wind` (→`0x2E96` set_wind) | `rand(0,63)` (+extra 1/64 cambia viento) | **CADA tick de animación** (único caller: `0x5910`/`0x5944`) | **tiempo real** (frame timer) |
| 2 | `0x6bc2` `render_animated_tile` | `rand(1,frames)` +2ª si `[0x5959]`≠0 (+Fisher-Yates `rand(0,15)`×16 si flag&4) | por **cada tile animado** (frames∉{1,8,16}) del viewport | por redibujo completo `0x5f86` (per-move) |
| 3 | `0x6936` flash de status | `rand(0,15)` por miembro con glyph `[i*0x20+0x55C5]`=='*'/',' | miembro afligido, sólo donde el party se pinta como sprites | per-redibujo completo |

**VEREDICTO GLOBAL: los tres son DIVERGENCIA DELIBERADA (INDETERMINISTA).** La
cadencia depende de **tiempo real** (el timer de animación, `0x2f62`) y del
**contenido de pantalla** (`0x6bc2`), no de eventos de turno deterministas. El seed
global del binario **avanza continuamente mientras la pantalla se muestra** — medido:
en overworld QUIETO (sin tecla) el seed avanzó con el flash a 0 hits (§2). Por tanto
**el clon NO puede ser seed-exacto byte-a-byte contra un DOSBox vivo en ninguna escena
que anime el mundo** (es decir, casi todas). El clon **no** emite estos rands (correcto)
y la paridad se sostiene por otras vías (§4, reconciliación).

**No es una contradicción con F.2**: la verificación viva de la órbita del world-tick
es **inmune por construcción** a estos consumidores (§4).

## 1. Estático — el call target (pregunta 1 del brief)

Los tres sitios son `call 0x2092` **near** al generador del juego (no otro rng):
- Flash: `0x6a1a: e8 75 b6  call 0x2092` — listado en el censo de `rng.md` (22 sitios
  near del kernel). Guardado por `[bp-0xe]!=0` (glyph `*`/`,`); si sale `0xb` imprime
  el string `0xa422` + tono `0x43ae`.
- `render_animated_tile`: `0x6bc2` rola en `0x6c…` (frame de arranque) y baraja.
- `maybe_change_wind` (NO "sprite_frame_randomizer", ver corrección §4): `0x2f62`
  rola en `0x2f70`/`0x2f81`/`0x2f90` (rejection-sampling); VOID (`ret` en `0x2fa4`),
  63/64 no cambia. En el hit 1/64 llama `0x2E96` = set_wind (`mov [g_wind],al`).

`0x2092` reescribe `g_rng_seed` (DS:`0x5420`) en cada llamada (`0x20aa: mov
[g_rng_seed], ax`, `rng.md`). ⇒ **los tres tocan el stream global.** Pregunta 1
del brief para el flash: **va al generador del juego, no a otro.**

## 2. Runtime — el flash (`0x6936`/`0x6a1a`) es INERTE en overworld

`re/tools/flash_rng_probe.py` (roster_off=0x55A6 confirma flash `0x55C5`=roster+0x1F):

| Fase | flash hits (0x6a1a) | seed |
|------|--------------------:|------|
| SANITY (glyph m0='*' sobrevive redibujo; 1 paso) | 0 / 40 ticks | — |
| A IDLE 1-afligido, 120 resumes SIN tecla | **0** | 98AC→AC30 (**avanzó**) |
| B MOVING 1-afligido, 1 paso | **0** | AC30→8F7F |
| C MOVING 2-afligidos, 1 paso | **0** | 7681→3589 |

Clave: el flash **no dispara en overworld** (el party viaja como UN solo avatar, no
como sprites individuales; `party_anim_build` no pinta miembros ahí). PERO el seed
**avanza** en idle sin flash y sin tecla ⇒ **otro consumidor de render mueve el seed en
tiempo real** (es `0x2f62`, §3). El flash sólo importa donde el party se pinta como
sprites (combate/pueblo/mazmorra); ahí es un consumidor más de la misma familia de
animación, ya neutralizada por el arnés de combate (§5).

## 3. Runtime — cuantificación de los consumidores de render

`re/tools/render_rng_probe.py` (overworld, `[0x5959]`=01 en juego normal ⇒ la 2ª
tirada de `render_animated_tile` SÍ está activa):

| Fase | resumes | BIOS ticks | rand_total (0x2092) | sprite (0x2f62) | animtile (0x6bc2) | flash (0x6a1a) | seed |
|------|--------:|-----------:|--------------------:|----------------:|------------------:|---------------:|------|
| IDLE-1 (sin tecla) | 150 | 76 | 110 | 38 | 0 | 0 | 3E18→BC64 |
| IDLE-2 (sin tecla) | 150 | 74 | 108 | 40 | 0 | 0 | BC64→F265 |
| STEP 1 paso ↓ | 60 | 30 | 42 | 14 | 0 | 0 | F265→724E |
| STEP 1 paso → | 60 | 29 | 43 | 14 | 0 | 0 | 724E→5933 |

Lecturas:
- **`0x2f62` (`maybe_change_wind`, ver §4) es el consumidor DOMINANTE e INCONDICIONAL**: ~38-40
  invocaciones por 150 resumes idle, y el seed drena **~1.45 rands/BIOS-tick** de forma
  continua **sin tecla** (idle). No depende de status raro ni de contenido de pantalla:
  el tick de animación lo llama siempre (`0x5910`/`0x5944`). **Éste es el que mueve el
  seed en overworld idle** (§2), no el flash.
- **`animtile` (`0x6bc2`) = 0 en esta pantalla** (posición 86,108), incluso al dar un
  paso: este viewport no tiene tiles con frames∉{1,8,16} (el agua/tiles de aquí usan
  1/8/16 frames → sin tirada). Su consumo es **content-dependent**; su cuenta viva en
  una costa quedó como **cuantificación opcional no corrida** (el veredicto no depende de
  ella — ver abajo). `[0x5959]=01` en juego normal ⇒ cuando SÍ dispare, rola **doble**.
- **`flash` (`0x6a1a`) = 0** en todas las fases (confirma §2: inerte en overworld).
- El total `rand_total` incluye además los rands de **lógica de world-tick**
  (viento/npc/housekeeping) que también corren en idle; `0x2f62` es ~35% del total y el
  resto es world-tick — ambos avanzan el mismo seed global.

**Conclusión de la cuantificación:** el seed global del binario avanza en tiempo real de
forma **incondicional** (≥1 rand/tick por `0x2f62`) siempre que la pantalla de juego se
muestra. El flash y el tile animado son consumidores ADICIONALES (condicionales a
status / contenido). El veredicto de indeterminismo **no depende** de la cuenta exacta de
`0x6bc2`: ya es indeterminista sólo por `0x2f62`.

## 4. Reconciliación con la verificación F.2 de la órbita (pregunta GORDA)

**Cómo pasó la verificación viva del world-tick si el binario consume rands de render
que el clon no emite.** Discriminación de hipótesis del brief:

- **(b) "el redibujo no avanza el seed global / usa copia" → FALSO.** Los tres
  consumidores llaman a `0x2092`, que reescribe `g_rng_seed` `0x5420`. Medido: el seed
  avanza en idle en overworld (§2). No hay seed de render aparte.
- **(a) "se midió sin tiles animados ni afligidos" → NO es el mecanismo.** `0x2f62`
  dispara en CADA tick idle pase lo que pase en pantalla; el seed se mueve siempre.
- **(c) "la órbita ya incluía esos rands / el modelo compensaba" → CORRECTO, afinado.**
  La verificación viva **nunca afirmó alineación byte-a-byte del stream vivo** contra
  DOSBox. Está escrito así en `re/verified/loops.md`: *"el valor byte-a-byte del stream
  vivo completo … NO se cierra aquí"*. Lo que SÍ se verificó en vivo es **inmune por
  construcción** a los rands de render:
  - `test_world_tick_rng_orbit_live` (`re/tools/test_npc_parity.py`): exige que cada
    transición de seed observada sea alcanzable en **1..MAXSTEPS pasos-FORWARD de la
    órbita**. Los rands de render sólo AÑADEN pasos-forward: cada seed sigue en la
    órbita, dentro de la tolerancia. **Tolera los consumidores extra a propósito.**
  - `test_rng_parity`: pertenencia ordenada (no-decreciente) a la órbita — verifica la
    FÓRMULA del generador, no el orden del stream vivo.
  - `test_wind_value_live` (`re/tools/test_transport_parity.py`): **FUERZA** `g_rng_seed`
    en la entrada del consumidor antes de leer el resultado ⇒ re-siembra, el consumo
    previo de render es irrelevante.
  - Paridad de COMBATE: **parchea** los consumidores de animación (`patch_sprite_rand`
    `0x2f62`→ret; `patch_anim_rand` `0x4625/0x466D/0x469F`→`mov ax,0xff`) para poder
    comparar el stream de lógica. El flash `0x6a1a` **NO** está en ese set (lo pasó por
    alto porque sus escenarios nunca tuvieron un miembro afligido) → SDD (§6).

  ⇒ La paridad seed-exacta real del clon es **model↔clon (nivel 2)**, no vs DOSBox vivo,
  y ésta NUNCA ve rands de render. **No hay contradicción.**

### ✅ Discrepancia RESUELTA (Task #20) — el label de transporte era el CORRECTO
Esta nota afirmó que `test_transport_parity.py`, al etiquetar `WIND_TICK = 0x2F62`
como *"maybe_change_wind"*, era **incorrecto** (creía `0x2F62` un
`sprite_frame_randomizer` cosmético). **Ese diagnóstico era el equivocado.** El
disasm lo zanja: `0x2F62`, en el hit 1/64, llama a `0x2E96`, que hace `mov
[g_wind(0x5892)],al` (escribe el viento) y redibuja el indicador de rumbo — **NO
dibuja un sprite; ES el cambio de viento.** ⇒ `test_transport_parity` tenía razón.

`test_wind_value_live` pasa **por MECANISMO, no por coincidencia**: fuerza el seed en
la entrada de `0x2F62` (= el rand del propio consumidor del viento), que escribe
g_wind; el valor leído casa con el predicho porque `0x2F62` ES ese consumidor. **No
hay consumidor de viento oculto:** el rand del viento y su escritor son `0x2F62 →
0x2E96`. Re-derivación completa en `re/notes/transport.md §4.1`. La única corrección
es la SEMÁNTICA de `0x2F62` (viento, no sprite); el veredicto de indeterminismo de
esta nota **no cambia** (`0x2F62` sigue siendo un consumidor incondicional del seed
global en el timer de render, cualquiera que sea su efecto).

## 5. Implicación para el ESPEJO F3

**Ningún checkpoint del espejo puede ser seed-exacto byte-a-byte contra DOSBox** en una
escena que anime el mundo (agua/fuego en viewport, o cualquier idle con `0x2f62`), que
es prácticamente toda pantalla de juego. El seed del binario se mueve por reloj de pared.
El espejo debe anclar en:
- **pertenencia-forward a la órbita** (como `test_world_tick_rng_orbit_live`), o
- **estado de juego** (posiciones, HP, resultado del turno), no el valor crudo del seed, o
- **re-siembra** en cada punto de decisión medido.

El subconjunto "party-afligido" NO es especial: **toda** la ruta de render es
indeterminista vs reloj de pared. Esto **generaliza** (no crea) la postura ya existente
de "sin stream vivo byte-exacto".

## 6. Task SDD propuesta — CERRADA en Task #20

1. ✅ **Set de neutralización completado**: `combat_parity.patch_render_rand` neutraliza
   el flash `0x6a1a` (`mov ax,0xFF` → nunca flashea, `0xFF!=0xB`) y las 3 tiradas de
   `0x6bc2` (Fisher-Yates `0x6C23`→0, frames `0x6CA7`/`0x6CBB`→1, consts inocuos por
   uso del retorno). Se invoca en `capture_trace` junto a `patch_sprite_rand`. Se dejó
   FUERA de `patch_anim_rand` a propósito (flash_combat_probe.py lo aísla).
2. **Documentar** los tres consumidores de render como una única fila de divergencia en
   `deliberate-divergences.md` (hecho) y enlazar desde `rng.md`.
3. ✅ **Transporte RESUELTO**: la etiqueta `WIND_TICK=0x2F62` era la CORRECTA; era ESTA
   nota la que mal-etiquetaba `0x2F62` como sprite_frame_randomizer. `0x2F62 → 0x2E96`
   escribe g_wind; `test_wind_value_live` es válido por mecanismo (§4, `transport.md §4.1`).
