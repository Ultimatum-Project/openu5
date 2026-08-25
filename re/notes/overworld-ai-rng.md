# Movimiento de actores de overworld — DERIVACIÓN ESTÁTICA DEL ORDEN RNG (task #37, etapa 1)

Gap del triaje #34: el port mueve todos los enemigos errantes con persecución
codiciosa uniforme y **sin consumir RNG**, pero el binario despacha por clase de tile y
**consume rand_range en casi todos los sub-caminos**. Aquí está el mapa RNG estático
del world-turn completo, derivado instrucción a instrucción de `re/disasm/MAINOUT.OVL.asm`.
Es la ETAPA 1 (estática); el orden EXACTO por-actor se cierra con testigo del oráculo
(etapa 2, coordinar ventana de dosbox con el lead — regla un-solo-dosbox).

**rand del juego** = `rng_rand_range(lo,hi)` @ kernel **0x2092**, ambos inclusive
(`re/notes/rng.md`). Todas las llamadas del clúster son `call 0xffff9ec2` = MAINOUT
near_call_base 0x81d0 → kernel 0x2092. Orden de args en pila: `push lo; push hi`
(verificado: whirlpool `push 0; push 3` → [0,3]; axis `push 0; push 1` → [0,1]).

## world_turn — `MAINOUT 0x1a60` (el bucle de turno del overworld)

Orden de consumo de RNG por turno del jugador en mapa grande:

1. **Gates de cadencia (sin rand):** si `g_time_spell==0x54` (Stop Time) → return, NADA.
   Si `==0x51` (Quickness?) → toggle `[0x2c55]`, salta turnos alternos. Si transporte es
   0x12/0x14 (montura/¿?) → toggle `[0x2c57]`, salta alternos.
2. **SPAWN GATE (0x1a9f):** `rand_range(1,30)` → roll. `call 0x0d8c` (umbral por bioma/
   noche) ; si `umbral > roll` → `call 0x0fc4` spawn_monster (que consume MÁS rand:
   pick_spawn_coords 0x0F4E = 2×rand(0,31) + re-rolls). **Ya portado** en
   `game/src/core/world/loops/spawn.ts` (`rollSpawnGate` + `pickSpawnCoords`).
   ⇒ 1× rand(1,30) + el placement.
3. **BUCLE DE MOVIMIENTO (0x1ab6):** recorre los 32 slots de actor **de índice 31→1
   DESCENDENTE** (di = 0x5d52 = record 31, baja de 8 en 8; si = 0x1f..1; índice 0 = party,
   excluido). Registro de 8 B en la tabla **DS:0x5c5a** (base tile en +0, x en +2=0x5c5c,
   y en +3=0x5c5d, phase/counters en +5/+7). Por cada slot ACTIVO (`call 0x105c`≠0, sin
   rand):
   - **a) `call 0x131a(idx)` — acción especial pre-movimiento:**
     - Si el actor está ORTOGONALMENTE adyacente al party (|dx|,|dy| == (1,0) o (0,1)):
       `call 0x1248` = **ATAQUE MELÉ al party**, return 1 → el world-turn OMITE el
       movimiento de este actor. **SIN rand.**
     - Si no, y el tile base ∈ {0x88, 0xdc} (tipos de ATAQUE A DISTANCIA) y |dx|≤3 y
       |dy|≤3: **`rand_range(0,7)`**; si ==0 → `call 0xffffd740` = ataque a distancia
       (1/8). return 1 si atacó. ⇒ **1× rand(0,7) SOLO para tipos ranged en rango 3.**
     - Resto: return 0, sin rand → se mueve (b).
   - **b) `call 0x198c(idx)` — move_one_actor (si 0x131a no atacó):** despacho por
     `base & 0xfc` (ver §Movers). Consume rand según clase.

4. Segundo bucle (0x1ae0, `call 0xffffb8a4`): colocación de sprites en el viewport. **Sin
   rand.**

## Movers — `MAINOUT 0x198c` despacho por clase de tile

| clase (base&0xfc) | qué es | rama | rand consumido |
|---|---|---|---|
| `0xec` | **REMOLINO** | phase-bit `[+5]` toggle: turno OFF → nada; turno ON → `rand(0,1)`: ==1 → 0x17d4 (chase), ==0 → 0x16fc (deriva) | ON: 1×rand(0,1) + el del sub-mover |
| `0xfc` | actor especial (rango) | `0x14ea` gate de rango ≤6 (SIN rand) → siempre 0x17d4 | el de 0x17d4 |
| `0x2c` | **NAVE PIRATA** | si `g_wind==0` no mueve (SIN rand); si no, cadencia por tabla `0x2bf6[(base-0x2c)<<3 + wind<<1]` con contador `[+7]` (SIN rand); si le toca mover → 0x17d4 | el de 0x17d4 (0 si no le toca) |
| else | **monstruo genérico** | 0x17d4 | el de 0x17d4 |

### `0x17d4` — chase genérico (el sub-mover común)
1. Calcula dx,dy al party (wrap 256 con signo) y los pasos preferidos hacia el party.
2. **`rand_range(0,1)`** en 0x18b5 → elige ORDEN DE EJE: ==1 prueba **X primero**, ==0
   prueba **Y primero** (¡NO "eje mayor primero" como el port!).
3. Prueba el paso hacia el party en el eje elegido (`0x1482` pasabilidad+ocupación +
   `0x14c8` guarda de casilla reservada). Si libre → al ejecutor
   del movimiento (MAINOUT 0x1578), que **puede consumir 1 tirada más de terreno** — §Terreno-que-frena. Si bloqueado,
   prueba el otro eje. **Si AMBOS bloqueados → `call 0x16fc`** (deriva ortogonal aleatoria
   = +1× rand(0,3)).
   ⇒ **1× rand(0,1) SIEMPRE, +1× rand(0,3) si ambos pasos hacia el party bloqueados,
   +1× tirada de terreno si el paso elegido cae en tile de clase 1 o 2.**

### `0x16fc` — deriva ortogonal aleatoria (remolino / fallback de 0x17d4)
- **`rand_range(0,3)`** en 0x1748 → 0=N,1=E,2=S,3=O (ortogonal, NO diagonal). Prueba
  `0x1482`; si libre → al ejecutor del movimiento (MAINOUT 0x1578), que **puede consumir
  1 tirada más de terreno**; si no, no mueve (el bucle di-retry es CÓDIGO MUERTO: rand∈[0,3] cubre
  el switch, el default nunca se alcanza).
  ⇒ **1× rand(0,3) + 1× tirada de terreno si la casilla elegida es de clase 1 o 2.**

### `0x14ea` — gate de rango del 0xfc (SIN rand)
|dx|,|dy| wrap; si ambos <6 → lookup en tabla `0x2c18`; devuelve código, si no 0.

### Helpers (sin rand): `0x1482` pasabilidad(get_tile_ptr 0x4402)+ocupación · `0x14c8`
guarda de casilla.

> ~~`0x1578`, ejecutor del movimiento (actualiza x,y en 0x5c5c/5d)~~ — **AFIRMACIÓN
> RETIRADA (tarea #104, 2026-07-28).** Estaba en la lista de «Helpers (sin rand)» y es
> FALSA: el ejecutor del movimiento tira UNA VEZ en 13 de las 28 clases de tile de
> destino. Ver §Terreno-que-frena abajo y el acta `rng-104-acta.md`. El error venía de
> leerle solo la cola (el commit de x,y) sin bajar por la tabla de saltos.

### Terreno-que-frena — el ejecutor del movimiento (tarea #104)

**El ejecutor NO es un helper mudo: es la compuerta de terreno de los ACTORES**, y es el
gemelo del frenado de la party. Firma `(idx, dx, dy)`, `ret 6`, sin valor de retorno.

Antes de comprometer x,y hay dos vías de escape SIN tirada: la familia pirata
(`base & 0xfc == 0x2c`, que además fija el sprite de rumbo) y las bases `0xdc`, `0x94`,
`0xd8`, `0xf0`. Después, con `t` = tile de DESTINO: si `t - 4` supera 0x1b sin signo →
paso libre. Si no, tabla de saltos de **28 entradas** (una por `t` = 0x04..0x1F):

| clases de `t` | destino | qué hace | tiles |
|---|---|---|---|
| 6 entradas | rama A | `rand_range(0,1)`; mueve si **≠0** ⇒ **1/2** | 0x04, 0x06, 0x07, 0x08, 0x1E, 0x1F |
| 7 entradas | rama B | `rand_range(0,2)`; mueve si **==2** ⇒ **1/3** | 0x09 … 0x0F |
| 15 entradas | commit | paso libre, sin tirada | 0x05, 0x10 … 0x1D |

⇒ **13 de 28 CONSUMEN UNA TIRADA** que este documento no contaba. Y si la tirada sale
perdedora, el actor **no se mueve pero la tirada ya está gastada**: las dos salidas caen
en el mismo epílogo sin valor de retorno, así que **quien llamó no puede distinguirlo** de
un movimiento realizado — no hay reintento ni segundo eje.

**Es EXACTAMENTE la partición del frenado de la party** (el clasificador de terreno del
overworld, MAINOUT 0x03e0, que reparte clase 1 / clase 2 / normal): mismos seis tiles en
la clase 1, mismos siete en la clase 2, y el mismo hueco para el tile 0x05, que aquel
clasificador descarta de entrada antes que ningún otro. Un solo mapa tile→clase con **dos
consumidores distintos**: la party paga MINUTOS y turnos extra de mundo (con
«Slow progress!» / «Very slow!»); los actores pagan PROBABILIDAD DE NO MOVERSE. La
simetría es exacta — clase 1 = 1 turno extra ↔ 1 de cada 2; clase 2 = 2 turnos extra ↔
1 de cada 3.

**Cuántas de las 13 son alcanzables**: la tirada solo ocurre después de que la pasabilidad
haya dicho que sí, así que las entradas de tiles no pasables son código muerto para esa
clase de movilidad. Con el bitmap a pie (DATA.OVL 0x54e4, MSB-first, bit puesto =
bloqueado; bytes leídos del fichero real, idénticos al volcado de `dungeon.md`) los tiles
0x0C y 0x0D están BLOQUEADOS ⇒ **11 de 13 vivas** para las clases que consultan el bitmap,
y las 13 solo para la clase que lo IGNORA (Ghost y Shadow Lord, ver
`mapeo-enemigo-mover.md`). Consecuencias por clase de movilidad, todas derivadas de ese
mismo mapeo: **RotWorm** (solo Swamp) y **Sand Trap** (solo Desert1) tiran **en CADA
movimiento** — van a media velocidad por construcción; **Corpser** (solo Grass) no tira
**nunca**; ninguna clase acuática tira jamás (sus tiles son clase normal).

> **Higiene del sembrador de nombres (tarea #84), leer antes de editar aquí:** el párrafo
> de arriba nombra ficheros de overlay, y el censo arrastra ese nombre como CONTEXTO
> PEGAJOSO para todas las líneas siguientes hasta el próximo que aparezca — medido en este
> carril: al insertar esta sección, una línea de la Etapa 2 que lleva meses intacta cambió
> de dueño sola y puso rojo el gate de semillas. Esta línea menciona el kernel a propósito
> para devolver el contexto al que el resto del documento da por supuesto. **No la
> borres** sin volver a correr `seed_diff.py` sobre este fichero.

## Resumen del consumo RNG por actor activo (por turno)

```
0x131a: melé-adyacente → 0 rand (y OMITE move)
        ranged(0x88/0xdc) en rango≤3 → 1× rand(0,7)   [si ==0 ataca y OMITE move]
        resto → 0 rand
0x198c (si no atacó):
        remolino OFF-turn → 0 rand
        remolino ON-turn  → 1×rand(0,1)  + (chase: rand del 0x17d4 | deriva: 1×rand(0,3))
        pirata sin viento/no-le-toca → 0 rand
        genérico/pirata-mueve/0xfc → 0x17d4 = 1×rand(0,1) [+1×rand(0,3) si bloqueado]

TERRENO (tarea #104, faltaba en este presupuesto): CADA vez que un actor llega al
        ejecutor del movimiento con un paso ya declarado pasable, si el tile de DESTINO
        es de clase 1 → +1×rand(0,1) ; si es de clase 2 → +1×rand(0,2).
        Se gasta ANTES de saber si el actor se mueve, y se gasta igual si pierde.
        Sube el techo por actor que se mueve de 2 a 3 tiradas.
        Pirata y bases 0xdc/0x94/0xd8/0xf0 están EXENTAS (escapan antes de la tabla).
```

**Divergencia con el port** — ESTADO ACTUALIZADO 2026-07-28 (tarea #104):

- ~~`game/src/core/world/enemies.ts tick` consume **0 rand** en el movimiento y usa "eje
  mayor primero" determinista~~ — **YA NO**. Ese párrafo describía el port de antes del
  #37: hoy `enemies.ts` consume el eje al 50/50, la deriva, la cadencia del remolino y la
  compuerta del ranged, en el orden derivado aquí. Se conserva tachado porque el resumen
  de abajo se escribió sobre él.
- **Lo que SIGUE divergiendo es el terreno.** El port no modela la compuerta de terreno de
  los actores en NINGUNA forma: su clasificador de terreno tiene exactamente dos
  consumidores y los dos son de la party (`movement.ts`), ninguno en `enemies.ts`, y tanto
  el chase como la deriva comprometen x,y sin condición una vez la casilla es pasable.
  ⇒ (a) el stream RNG se desincroniza en 1 tirada por cada paso de actor a tile de clase
  1 o 2, y (b) **conducta visible**: en el original los monstruos se atascan en
  pantano/bosque/colinas y en el port cruzan a velocidad plena. Detalle, impacto y por qué
  NO se arregla en este carril: `rng-104-acta.md`.

## Lección de tooling del oráculo (para cualquier probe futuro)

**Bajo BPINT8 (tick-pulse), TODA lectura de registros en pausa es INTERMITENTEMENTE
ilegible** — el comando `EV` del debugger devuelve respuesta rancia/vacía bajo la carga
de pausas del timer. Medido en este carril: `SP` ilegible mató run1, `CS:IP` ilegible
mató run4 (dentro de `oracle.at_code_bp`). Regla: **envolver toda lectura de registro en
pausa con reintento** (`reg_retry`: captura `OracleError`, `_pump(0.25)`, reintenta N), y
si tras N sigue ilegible tratar la pausa como no-clasificable (log + seguir), NUNCA morir.
`oracle.py` es read-only (Regla 4) → el retry va en el código del probe, no en el oráculo.
Además: leer CS:IP UNA vez por pausa y clasificar por dirección física contra los BPs
precomputados es más rápido y robusto que llamar `at_code_bp` una vez por BP.

## Etapa 2 — CAPTURA 1 (run3, 2026-07-16): confirmaciones + refinamiento

Primer volcado real (`overworld_ai_capture.json`, seed fija 0x1234, escenario
remolino idx5 + pirata idx9 + genérico idx12). **Confirmado empíricamente:**
- **Orden de iteración 31→1 DESCENDENTE**: los `0x131a`/move dispararon en orden de
  índice **12 → 9 → 5** (genérico, pirata, remolino) — cuadra con el bucle `si=0x1f..1`.
- **Chase genérico = 1× rand para elegir EJE**: caller exacto MAINOUT `0x18b8` (el
  `call` de `0x17d4`), el genérico persiguió al party (se movió 1 hacia él). ✓
- **Tabla de viento 0x2bf6 volcada**: 4 facings × 4 words = cadencia {2,3,4} por
  (facing, wind); 4 = "mueve siempre" (cuadra con `cmp ax,4` del ASM); sentinela 0x8080
  en facing0/calm.

**Límites de la captura 1 (por eso hay CAPTURA 2):**
- Remolino y pirata NO se movieron ese turno (phase-bit OFF / viento en contra) → no se
  vio su rand de movimiento. → **multi-turno**.
- Armar la ENTRADA de rand_range (0x2092) capturó **201 rands de 79 callers del kernel**
  (animación de tiles/refresco) = ruido. Los seeds saltaban → o es otro seed o mi lectura
  race; NO parece parte del stream determinista del turno (los tests de paridad del port
  pasan sin modelarlo). → filtrar por **sitio de llamada**.
- Marcadores move_one/spawn no registraron con 3 BPs simultáneos armados.

**Refinamiento (CAPTURA 2, probe ya actualizado):** en vez de la entrada compartida
0x2092, armar los **SITIOS EXACTOS de `call rand_range` dentro de los movers** — sólo
ejecutan durante el movimiento, cero ruido, y el rango lo da el sitio:
`0x18b5`=axis(0,1) · `0x1748`=drift(0,3) · `0x13cc`=ranged(0,7) · `0x1aa7`=spawn(1,30).
Multi-turno (alterna DOWN/UP, 12 turnos) para cazar remolino+pirata en movimiento.

## ¿La animación de tiles consume el g_rng_seed? — SÍ, pero YA está portado (no es gap)

Pregunta de primer orden que abrió la captura 1 (parecían 79 callers / 201 rands de
"animación"). Respuesta estática (fiable, sin oráculo):

- **El dato de 79 callers era RUIDO DE MEDICIÓN**: la captura 1 armó la ENTRADA compartida
  de rand_range (0x2092) y leía SS:SP+mem en CADA una de 200+ pausas bajo carga de
  BPINT8 → lecturas racy. Hay **sólo 22 sitios `call 0x2092` en el kernel** (no 79); la
  región 0x166x-0x174x a la que apuntaban mis callers **no tiene NINGUNA `call 0x2092`**
  (sólo `lcall [0x5394]`, `call 0x17f4`, `lcall [g_snd_driver_fn]`). Los caller_ret/seed
  de la captura 1 son basura; sólo son fiables lo leído UNA vez (tabla de viento,
  actors_after).
- **PERO el fenómeno es real y CONOCIDO**: `render_animated_tile` (kernel **0x6bc2**,
  = `kernel_rand0` = `rand_range(0,n)`) SÍ consume el stream del juego — 3 sitios
  (0x6c23/0x6ca7/0x6cbb). Documentado en `kernel-sweep-3.md` ("3er consumidor de RNG en
  render/tick tras 0x6936 y 0x6bc2"; "el bucle rola el frame con rand0, no dibuja") y
  `kernel-render-sweep.md:33` ("consumen el stream de rands del juego"). Igual el flash
  de estado (0x6936/0x6a1a, task #17).
- **YA está modelado en el port**: `game/src/render/tileprog.ts:8` — "cada tile animado
  lleva un PC+timer y el avance está gateado por RNG (50%/llamada)". Así que NO es un
  desync sistemático sin modelar: es una preocupación resuelta y portada.

**Implicación para #37**: el rand de MOVIMIENTO ocurre en la lógica del world_turn
(0x1a60), ANTES del redibujo (0x5f86→0x6bc2). El churn de animación es posterior y
separado (y ya portado). El fix de movimiento vive en el stream pre-render que el port ya
modela y testea → **no lo afecta**. Y la captura 2 (BPs en los SITIOS de call de los
movers) evita el ruido de render por construcción (render llama por 0x6c23/6ca7/6cbb/6a1a,
NO por mis 0x18b5/1748/13cc/1aa7). Cierro la pregunta: no folletín, no rabbit-hole.

## Etapa 2 — CAPTURA 2 (run5, LIMPIA: 43 eventos, 0 pausas ilegibles) — CONFIRMADO

Escenario: remolino idx5 (88,107) + pirata idx9 (86,110) + genérico idx12 (88,105),
party (86,107), wind=3, seed 0x1234. Multi-turno (12, alterna DOWN/UP).

**CONFIRMADO (dato limpio):**
- **Orden por turno = spawn `rand(1,30)` → luego, por actor genérico activo: `axis`
  rand(0,1) [+ `drift` rand(0,3) SI el paso hacia el party está bloqueado]**. Se ve
  turno a turno: turnos con sólo `axis` = el genérico avanzó a la 1ª; turnos con
  `axis+drift` = bloqueado → fallback de deriva ortogonal. El genérico (idx12) persiguió
  al party toda la corrida.
- **Los rands DENTRO de un turno ENCADENAN por el LCG** (`nxt(seed_n)==seed_{n+1}`):
  axis→drift dan `chainOK`. **PERO el encadenado se ROMPE en la frontera de turno**
  (spawn del turno siguiente no encadena con el último rand del turno previo) →
  **prueba empírica de que el redibujo (render_animated_tile) consume el seed ENTRE
  turnos, no dentro**. Cierra la pregunta de animación: es un consumidor SEPARADO del
  stream de movimiento intra-turno. El fix de movimiento vive en el tramo que encadena.
- Seed-chain validador: LCG `x=(s+0x9248); ror16(x,3); x^=0x9248; x=(x+0x11)` = el de
  `game/src/core/rng-original.ts` (independiente de lo,hi).

**NO cubierto por esta captura (para completar):**
- Remolino idx5 y pirata idx9 **no se movieron en 12 turnos** (bloqueados/en calma) →
  no se ejerció su rand de movimiento. Además el probe **NO instrumenta 0x19be** (el
  rand(0,1) de selección de modo del remolino, DENTRO de 0x198c) — sólo los 4 sitios de
  los sub-movers. La selección de modo del remolino queda por DERIVACIÓN ESTÁTICA (sólida).
- Ranged rand(0,7) (0x13cc): no había actor ranged en el escenario → nunca disparó.
- Interleave de orden con VARIOS actores móviles: sólo el genérico se movió aquí (idx5/9
  estáticos); el orden 12→9→5 lo dio la captura 1 (marcadores special).

**Suficiente para el fix del caso genérico** (el 95%: cualquier monstruo de tierra/mar).
Remolino/pirata/ranged por derivación estática, con gate de paridad. Captura 3 opcional
(instrumentar 0x19be + escenario que fuerce pirata en movimiento) si se quiere cerrar
empíricamente esas 3 ramas.

## Asignación de SLOT en spawn (REQUISITO 1 del lead — DERIVADO CON CITA)

Decisión de diseño: **slot fijo** (el .gam ya es tabla de 32 slots; el port import/export
es byte-exacto → la posición de tabla existe en la frontera de persistencia). El campo
`slot` es EL identificador; la lista `overworldEnemies` es sólo la vista.

**Búsqueda de hueco (derivada, no asumida):**
- `spawn_monster` = MAINOUT `0x0FC4` (llamado desde el world_turn en `0x1AB3`). Elige
  coords (retry ≤128 por tile válido, `0x1005-0x1018`) y llama al allocator
  `call 0xffffb714` → **kernel `0x38E4`** (`alloc_actor_slot`).
- `0x38E4` delega en el ESCÁNER **kernel `0x3868`** con clases de prioridad:
  1º `0x3868(lo=0,hi=0,flag=0)` = primer slot con tile==0 (**VACÍO**); si no hay,
  cae a clases de EVICCIÓN por rango de tile con gate de distancia (`0x3868(1,0xF,1)`,
  `(0x80,0xFF,1)`, `(0x10,0x11,1)`, `(0x30,0x7F,1)`, …) — evicta un actor de baja
  prioridad CERCANO al party.
- **`0x3868` escanea slots 1→23 ASCENDENTE** (`cx=1; cmp cx,0x18; jl` → 1..23;
  `si=0x5c62` = slot1.tile, stride 8) y devuelve el PRIMER match. Cita:
  `re/disasm/ULTIMA.EXE.asm` 0x3868 (bucle) + 0x38E4 (clases).
- **Iteración del turno = slots 31→1 DESCENDENTE** (MAINOUT `0x1AB6`: `di=0x5d52`
  stride −8, `si=0x1f..1`), saltando vacíos (`0x105C` activo).

**Consecuencia (el corazón del fix):** al morir un monstruo su slot queda VACÍO (tile 0);
el siguiente spawn rellena el **primer hueco ascendente** (ese slot bajo liberado), NO el
final de una lista. Por eso (a) es obligatorio: el append de lista divergiría tras muertes.
Pool de spawn = slots **1..23**; los altos (24..31) y el 0 son de otros actores
(party/NPC/transporte) — el move-loop los recorre pero spawn no los toca.

## Persistencia (REQUISITO 3) — mapeo DS↔.gam + seal-check + hallazgo de scope

**Mapeo DS↔file-offset (derivado, cita):** la tabla de objetos del .gam está en
file-offset **0x6B4** (stride 8, 32 slots, obj0=avatar con X/Y en 0x6B6/0x6B7,
`saveNative.ts:47-49 OBJ0_X_OFFSET=0x6b6`). En DS el escáner del kernel usa slot1.tile
en **0x5c62** → slot0.tile en **0x5c5a**. Delta = `0x5c5a − 0x6B4 = 0x55A6`: el bloque
del .gam se copia a DS en 0x55A6, así que **file 0x6B4 ≡ DS 0x5c5a** (y file 0x6B6 ≡ DS
0x5c5c = slot0.x — cuadra con OBJ0_X). ⇒ slot n: file `0x6B4+n*8`, DS `0x5c5a+n*8`.

**Seal-check (gate del lead — PASA):** en los 7 .gam sellados del Grand Tour
(`game/e2e/grandtour/saves/ch0*.gam`) la región de slots **1..23** de la tabla 0x6B4
está **TODA A CEROS** (0 bytes no-cero; sólo slot0=avatar poblado). Como los capítulos
son towns SIN enemigos de overworld, escribir overworldEnemies en 0x6B4 **no cambia esos
bytes** → **BYTE-NEUTRO para la cadena, sin re-sello**. ✅

**HALLAZGO DE SCOPE:** el port hoy guarda `overworldEnemies` en el SIDECAR
(`saveNative.ts:127`, categoría "estado sin hueco en SAVED.GAM"), NO en la tabla nativa
0x6B4 — aunque el binario SÍ persiste los monstruos errantes ahí. obj0=avatar sí se
escribe a 0x6B4; slots 1..23 quedan sin usar por el port (vacíos en todos los seals). Es
un gap de fidelidad de persistencia real (un save nativo del DOS con monstruos en overworld
no round-trip-ea por el port). Dos flavores de req 3: (i) round-trip NATIVO (mover enemies
del sidecar a 0x6B4 en export + leerlos en import) — cierra el gap; (ii) MÍNIMO (slot +
orden + rand, enemies siguen en sidecar). Decisión del lead (afecta tamaño y el worldObjects
adyacente, que también usa 0x6B4/sidecar).

## PLAN DE IMPLEMENTACIÓN / HANDOFF (resumible tras reset)

Estado: derivación + captura 2 limpia HECHAS (commits 12a460f..5e82d6e en rama
`fiel/overworld-ai`, worktree `.claude/worktrees/overworld-ai`). Falta: modelo de
paridad + fix de `enemies.ts` + tests. Aterriza TODO junto (lo pide el lead).

Pasos:
1. **Modelo de paridad Python** `re/tools/overworld_ai_parity.py` (patrón loops_parity.py):
   dado (seed, actores, party, wind, floor), emite la traza de rand esperada usando el
   LCG. Orden: spawn rand(1,30); por actor idx 31→1 activo: si adyacente-orto → melé (sin
   rand); elif ranged(0x88/0xdc) en rango≤3 → rand(0,7); else move: genérico/pirata/0xfc →
   axis rand(0,1) [+drift rand(0,3) si bloqueado], remolino 0xec → phase-bit; on-turn
   rand(0,1) modo (chase|drift). Validar contra `re/notes/captures/overworld_ai_capture2_run5.json`
   (el genérico debe encadenar intra-turno).
2. **TS runner** `game/src/core/__parity__/overworld-ai-run.ts` (patrón loops-run.ts):
   replica el enemies.ts NUEVO con OriginalRng, emite traza, cruza con el Python.
3. **Fix `game/src/core/world/enemies.ts tick`**: la fase de movimiento (líneas ~122-143)
   debe CONSUMIR rand del stream vivo (`this.rand`, ya pasado) por actor en orden 31→1
   (mapear el orden de la lista a slots), sustituyendo el "eje mayor primero" determinista
   por **axis rand(0,1)** + **drift rand(0,3) si bloqueado**; remolino = phase-bit +
   rand(0,1) modo; pirata = cadencia por tabla de viento 0x2bf6 (capturada). El hueco YA
   está reservado (turn.ts:174-175).
4. **Gate**: caso de paridad nuevo + los existentes (loops-run, transport-run) verdes; el
   lead corre la paridad final. Datos de anclaje: la tabla de viento y el escenario están
   en el JSON de captura preservado.

Ramas por derivación estática (no ejercidas en captura 2): modo-remolino 0x19be,
cadencia-pirata, ranged 0x13cc. Si el gate chirría ahí, captura 3 dirigida.

## Etapa 2 — probe del oráculo (andamiaje LISTO, a la espera de ventana)

Script: `re/tools/overworld_ai_probe.py` (guardado por `oracle._foreign_dosbox()` →
ABORTA si el dosbox del usuario está vivo; sólo corre en instancia headless propia tras
ventana del lead). Mapa de memoria confirmado (DS del juego):

| dir | qué |
|---|---|
| `0x5C5A` | tabla de actores errantes: 32 registros × 8 B. +0 base tile, +2 x, +3 y, +5 phase-bit/contador, +7 contador de viento |
| `0x5892` | `g_wind` | `0x5893` g_location · `0x5895` g_floor · `0x5896/97` party x/y · `0x585B` party_size · `0x587F` g_hour · `0x5420` g_rng_seed |
| `0x2BF6` | tabla de cadencia por viento del pirata (word `[(base-0x2C)<<3 + wind<<1]`) — el probe la vuelca cruda |
| código | rand_range=kernel `0x2092`; MAINOUT en CS `0x81D0+file_off`: move_one_actor `0x198C`, special `0x131A`, world_turn `0x1A60` |
| `0x105C` | predicado "slot activo" = tile movible (ships 0x2C-0x2F, criaturas ≥0x80 salvo [0xB4,0xB7] y [0xE8,0xEB]) |

Escenario del probe: limpia los 32 slots, siembra 1 remolino (0xEC) + 1 pirata (0x2C,
g_wind fijo) + 1 genérico (0x90) a distancias conocidas del party, fija seed, envía UNA
tecla de movimiento, y con BPs en 0x2092/0x198C/0x131A registra el stream EN ORDEN:
`(caller_ret, lo, hi, seed_before)` por rand + `actor_idx` por move/special. Vuelca
`re/tools/logs/overworld_ai_capture.json`.

### Lo que el volcado confirma/mide
1. Orden de iteración de slots (¿31→1? ¿lo mapea al orden de `overworldEnemies`?).
2. Secuencia exacta de rand por actor y clase (atribución por `caller_ret`).
3. La tabla de viento 0x2BF6 (para portar la cadencia del pirata).
4. Que 0x1248 (melé) / 0xffffd740 (ranged) no meten rand extra al stream del turno.

## Pendiente para etapa 2 (oráculo)
Confirmar EMPÍRICAMENTE contra el oráculo, en un mapa con actores controlados:
1. El orden exacto 0x131a→0x198c y el índice de iteración 31→1 (vs cómo ordena el port su
   lista `overworldEnemies`).
2. Que `0x1248` (melé) y `0xffffd740` (ranged) no consumen rand adicional relevante al
   stream del turno (o cuantificarlo).
3. Los args reales de `spawn_monster 0x0fc4` ya modelados en spawn.ts siguen cuadrando
   con el nuevo bucle de movimiento intercalado.
4. Caso de paridad nuevo: loop de N turnos con 1 remolino + 1 pirata + 1 genérico contra
   el volcado de rand del oráculo (estilo outdoor-underworld-night).

## Superficie de integración en el port (plan de implementación)

El hueco YA está reservado en el diseño del stream:
- `game/src/core/game.ts:1338 outdoorWorldTurn` corre `rollSpawnGate` (spawn rand(1,30)) y
  luego `this.overworldEnemies.tick(state, map, { picker, rand: this.rand, shouldSpawn })`
  — el tick YA recibe el stream vivo `this.rand`.
- `game/src/core/world/loops/turn.ts:174-175` (esqueleto) dice literalmente: *"El burst de
  spawn_monster y el move-loop de monstruos los ejecuta el caller (overworldEnemies) — su
  RNG va a continuación en el stream."* Es decir: el move-loop DEBE consumir rand aquí,
  pero `enemies.ts tick` (fase de movimiento, líneas 122-143) hoy consume **0 rand**. Es un
  placeholder conocido.

Cambio a hacer (tras confirmar orden con oráculo):
1. En `enemies.ts tick`, la fase de movimiento debe iterar en el ORDEN del binario
   (slots de actor 31→1) — mapear el orden de la lista `overworldEnemies` al orden de slot
   del binario es LO CRÍTICO a confirmar con el oráculo (de ahí depende el orden de
   consumo de rand).
2. Por enemigo: acción especial (rand(0,7) si ranged en rango) → move despachado por clase:
   genérico/pirata/0xfc = 0x17d4 [rand(0,1) eje + rand(0,3) fallback], remolino = phase-bit
   + rand(0,1) + (chase|deriva). Sustituir el "eje mayor primero" determinista actual por
   el eje aleatorio rand(0,1).
3. Gate: caso de paridad nuevo + los existentes (loops-run, transport-run) deben seguir
   verdes — el cambio ALTERA el stream del turno de overworld con monstruos, así que hay
   que regenerar/confirmar cualquier fixture que tenga actores activos.
