# Los dos cabos de la re-auditoría: `#112` vacía y el cruce con «winnable por enemigo móvil»

**Carril:** bancos-residuales · **2026-07-25** · Encargo del lead sobre dos límites que yo
mismo declaré en `re/notes/censo-reauditoria-0x6a14.md`. Layout del `.CBT` verificado contra
una sala conocida antes de usarlo: registro de **352 B**, **fila 5 = sprite · fila 6 = x ·
fila 7 = y**, columnas 11-26 (16 ranuras). Comprobado con la sala 49 (9 unidades, casa exacto).

---

# 1. `#112 Doom r0` — vacía DE VERDAD, y **no está sola**

Leída del `DUNGEON.CBT` crudo por posición (`base=(N−16)*352`): las filas 5/6/7 están **a
cero enteras**, mientras las filas 1-4 sí llevan datos. **No es un fallo de extracción: la
sala no tiene unidades en el dato original.**

Y el censo de las 112 encuentra **tres**:

| sala | |
|---|---|
| `#19` | Deceit r3 |
| `#80` | Shame r0 |
| `#112` | Doom r0 |

**Qué hace el original al entrar** — sin resolver, declarado. La condición de salida del
bucle de sala (`COMBAT.OVL 0x0B94 @0x0ca9-0x0cb7`) es «bando del party vacío del tablero»,
y con cero enemigos `g_cmb_scratch_x` ya vale 0 desde `0x0bb2`, así que
`g_cmb_victory_flag` se pone a **1 al entrar** (0x0bb9). No he leído qué se imprime ni si
hay un atajo de salida. **Pendiente**; ninguna de las tres está entre mis 15 señaladas.

---

# 2. ★ SAPO DE DATOS: el extractor descarta las unidades de la celda `(0,0)` ★

Buscando lo anterior salió otra cosa. **Regla confirmada exactamente en los 128 mapas**:

> `combatmaps.json[N].units` = ranuras crudas **menos toda ranura con `(x,y) == (0,0)`**

No es una hipótesis: se predijo la lista del JSON desde el crudo con esa sola regla y **casa
en los 128**, sin una sola excepción.

## Por qué la regla es incorrecta

El marcador de ranura vacía del formato **NO es la posición, es `sprite == 0`**. Lo prueba
`#59 Wrong r11`: sus ranuras 4-16 tienen `sprite = 0` pero conservan **x,y con basura viva**
—(6,4), (4,5), (6,5)…—, y el extractor **las mantiene todas**. Es decir: el extractor filtra
por posición y **el port filtra por sprite** (`combat.ts:648`, `spriteToEnemyIndex(...) ===
null → continue`). Dos criterios distintos para lo mismo.

Y la evidencia de que `(0,0)` es una posición **legítima**: en `#43` la ranura descartada es
`(0x9c, 0, 0)` acompañada de `(0x9c,0,10) (0x9c,10,0) (0x9c,10,10)` — **las cuatro esquinas
del tablero con el mismo sprite**. Descartar (0,0) rompe una colocación deliberadamente
simétrica. Igual en `#71`, con tres juegos de cuatro esquinas.

## Coste medido

**6 unidades REALES perdidas** (sprite ≠ 0), más ranuras de colocación:

| fichero | sala | pierde |
|---|---|---|
| DUNGEON.CBT | `#43` Destard r11 | 1 × `0x9c` |
| DUNGEON.CBT | `#71` Covetous r7 | **3 × `0x9c`** |
| DUNGEON.CBT | `#126` Doom r14 | 1 × `0xd4` |
| BRIT.CBT | `#0` CampFire | 1 (sprite ≠ 0) |
| BRIT.CBT | `#9` Basement | 16 ranuras (todas sprite 0) |

### Dos impactos distintos

1. **Salas de mazmorra — plantilla incompleta.** `#71` está censada como *winnable-móvil* con
   **13 (Ghost)** y el crudo trae **16**: el port pelea contra 3 Ghosts menos. `#126` igual con
   1 menos. Una VICTORY contra una plantilla incompleta es **más fácil que en el original**.
2. **Encuentros — deriva de RNG.** `placeEnemies` (combat.ts:612) hace
   `map.units.map(...)` → `shuffle()`, y `shuffle` consume `crng.rand0(i)` **una vez por
   elemento**. Si la lista es más corta, **se consume distinto RNG**. `#0 CampFire` pierde 1
   ranura y `#9 Basement` 16. Esto toca determinismo, no sólo dificultad.

## Lo que NO cierro

**Si el cargador del ORIGINAL coloca o no una unidad en `(0,0)`.** La evidencia del dato
apunta fuerte a que sí (esquinas simétricas + `sprite==0` como marcador real), pero **no he
leído la rutina que carga las unidades del `.CBT`**. Hasta leerla, esto es **un sapo de datos
FUNDADO, no confirmado** — y el arreglo (filtrar por `sprite==0` en el extractor) exige esa
lectura, porque re-introduce 6 enemigos y cambia el conteo de ranuras.

---

# 3. Cruce con «winnable por enemigo móvil» (19 salas)

| conjunto | intersección |
|---|---|
| mis 9 **AFLOJA** | **{115, 116, 120}** |
| mis 6 **APRIETA** | **{66}** |
| mis 3 sellos en riesgo (**#103, #125, #65**) | **VACÍA** |
| las 3 salas con unidades perdidas | {71, 126} — y **∅** con mis 15 |

**La respuesta a tu pregunta: ninguno de los tres sellos en riesgo tiene doble fuente de
legitimidad.** `#103`, `#125` y `#65` **no** están en la lista de movilidad ⇒ su veredicto
depende de una sola cosa y mi columna aplica limpia. El discriminador de cada uno decide sin
ambigüedad.

Los cuatro que sí solapan ya estaban resueltos por otra vía y **ninguno cambia**: `#115`
gana por descenso, `#116` y `#120` son DEAD-END fiel [PROSA-AUTOFIEL: sin derivación citada POR
SALA — barrido tanda 2, 07-27; léase «DEAD-END del PORT»] (y salen reforzados), `#66` ya estaba
clasificado *winnable-móvil* y por eso lo descarté como riesgo.

**Y las 3 salas con unidades perdidas no tocan mi análisis de riesgo** (intersección vacía
con las 15) — pero sí tocan el censo, porque dos de ellas llevan veredicto *winnable-móvil*
medido con plantilla incompleta.

---

# ADDENDUM — el origen del sapo, localizado; el cargador del binario, NO

## El origen: está en el parser, y es una asunción escrita

`extractor/src/parsers/combatmap.ts:111-117`:

```ts
// 16 map-units: sprite (fila 5), X (fila 6), Y (fila 7). (0,0) = vacío.
for (let u = 0; u < 16; u++) {
  const x = at(6, 11 + u);
  const y = at(7, 11 + u);
  if (x === 0 && y === 0) continue;      // ← LA REGLA
  units.push({ sprite: at(5, 11 + u), x, y });
}
```

El comentario **afirma** `(0,0) = vacío` como premisa; no hay derivación detrás.

## Y la inconsistencia está DENTRO DEL MISMO FICHERO, diez líneas más abajo

`combatmap.ts:120-124`, los **triggers** del mismo `.CBT`:

```ts
const sprite = at(0, 11 + t);
if (sprite === 0) continue; // sprite 0 = trigger vacío
```

**Los triggers se filtran por `sprite === 0`; las unidades por `(x,y) === (0,0)`.** Dos
criterios distintos para la misma pregunta —«¿está esta ranura vacía?»— en el mismo parser,
sobre el mismo formato, separados por diez líneas. Y el port, aguas abajo, filtra las
unidades **por sprite** (`combat.ts:648`). O sea que el criterio del port coincide con el de
los triggers y **discrepa del de las unidades**.

Eso es lo que explica que nadie lo viera: desde el port todo cuadra (filtra por sprite),
desde el extractor todo cuadra (filtra por posición), y la pérdida ocurre **en la frontera**.

## Lo que NO he podido cerrar: el cargador del ORIGINAL

Sigue sin saberse si el binario coloca una unidad en `(0,0)`. **Documento dónde NO está**,
para que el siguiente no repita las tres búsquedas:

| busqué | resultado |
|---|---|
| Desplazamientos de campo dentro del registro (`171/203/235` = `0xab/0xcb/0xeb`) | sin coincidencias útiles |
| Consumidores del búfer del registro `0xAD14` | **`DNGLOOK.OVL 0x0d3e`** — pero es el **constructor de arena SINTÉTICA** de campamento/emboscada (`test [g_unk_58a1], 4`), que **escribe** posiciones desde tablas por `g_dng_facing`; **no** lee el bloque de unidades de la sala |
| Montajes de la tabla de actores en COMBAT.OVL (`0xba14/16/18/1a`) | **`COMBAT.OVL 0x006f`** — recorre la tabla de **objetos del mundo `0x5C5A`** (stride 8) buscando por (x,y); no es el spawner del `.CBT` |

Sí está localizado el **cargador del registro**: `DUNGEON.OVL 0x004b-0x007b` calcula
`dungIdx*0x1600 + roomNo*0x160`, limpia 0x160 bytes en **`0xAD14`** y lee el registro ahí
(`call 0xffffa39e`). Lo que falta es **quién consume `0xAD14 + 171/203/235`** para crear los
combatientes.

⇒ **Sigue siendo sapo FUNDADO, NO CONFIRMADO.** No se toca.

---

# ADDENDUM 2 — la pista del lead CONFIRMA el sapo para BRIT/encuentros

El lead probó un ángulo que no estaba en mi tabla: buscar las **direcciones resueltas**
(`0xADDF`, `0xADFF`) en vez de los **desplazamientos** (`+203`, `+235`). El ensamblador ya
tiene la suma hecha ⇒ buscar `+203` nunca encuentra `0xADDF`. Es mi propia lección aplicada
a mi propia búsqueda: **el barrido tiene que poder ver lo que busca.**

## `ULTIMA.EXE 0x60EC` = `load_combat_map(index)` de **BRIT.CBT**

Identificada del todo: el puntero de fichero que empuja es `DS 0xa3f0`, y en `DATA.OVL`
fileoff `0xa400` está literalmente **`"BRIT.CBT"`**. Callers: `0x633d` y `0x6366`.

```
60f4  push 0xa3f0            ; "BRIT.CBT"
60f8  push 0xad14            ; búfer destino
60fc  ax = 0x160 ; imul [bp+4] ; push ax   ; offset = index * 352
6104  call 0x256e            ; lectura del registro
610c  cx=3 ; di=0x1724 ; si=0xad7f ; rep movsw   ; 6 B  ← fila 3 col 11 = X de arranque de party
611c  cx=3 ; di=0x172c ; si=0xad85 ; rep movsw   ; 6 B  ← fila 3 col 17 = Y de arranque
612d  cx=8 ; di=0x1704 ; si=0xaddf ; rep movsw   ; 16 B ← fila 6 = X de LAS 16 UNIDADES
6138  cx=8 ; di=0x1714 ; si=0xadff ; rep movsw   ; 16 B ← fila 7 = Y de LAS 16 UNIDADES
6143  [bp-2] += 0x10
```

**Copia las dieciséis ranuras con `rep movsw` y CERO comparaciones.** No filtra por `(0,0)`,
ni por sprite, ni por nada.

### El hueco de la fila 5 (sprite) NO es un hueco: es coherencia

La fila del sprite (`+171 = 0xADBF`) **no se copia**, y no debe copiarse: en los mapas de
Britannia **el tipo de enemigo lo decide el ENCUENTRO, no el sprite del `.CBT`** — el port
modela justo eso (`combat.ts` `placeEnemies`, rama de encuentro: `map.units.map(u => ({x,y}))`,
«El tipo lo decide el encuentro, no el sprite»). ⇒ En BRIT las 16 ranuras son **posiciones
puras**, y por eso el cargador se lleva sólo X e Y.

## Veredicto para el camino de ENCUENTRO: **CONFIRMADO**

El original toma **las 16 posiciones**; el extractor descarta las de `(0,0)`. Y como en BRIT
el sprite es irrelevante, **las 17 ranuras descartadas son todas ranuras reales**:

| mapa | ranuras crudas | en el JSON | perdidas | efecto en el shuffle |
|---|---|---|---|---|
| `#0` CampFire | 16 | 15 | **1** | 15 rands en vez de 16 ⇒ **1 de deriva** |
| **`#9` Basement** | 16 | **0** | **16** | 0 rands en vez de 15 ⇒ **★ el port NO COLOCA NINGÚN ENEMIGO ★** |

(`#9` tiene las 16 ranuras a `(0,0,0)` de verdad; el original las copia igual y apilaría en
`(0,0)`, el port se queda con lista vacía y `takeSlot` devuelve `null`.)

`shuffle` consume `crng.rand0(i)` una vez por elemento ⇒ **distinto número de ranuras =
distinto consumo de RNG**. **El sapo queda CONFIRMADO para la ruta de encuentros.**

## Lo que SIGUE abierto: el camino de SALA de mazmorra

`0x60EC` es específico de BRIT (nombre de fichero cableado). Las salas cargan por
`DUNGEON.OVL 0x004b-0x007b` (DUNGEON.CBT → mismo búfer `0xAD14`) y siguen por
`DUNGEON.OVL 0x00b9 → DNGLOOK.OVL 0x117E` (stub `0x7C3E`).

Y ahí **el sprite SÍ importa** (enemigos fijos, no encuentro), así que tiene que haber un
consumidor de la fila 5. **No lo he encontrado.** Añado a la tabla de «dónde NO está»:

| busqué | resultado |
|---|---|
| `kernel 0x2900` y `0x1B16` (las dos llamadas del arranque de `COMBAT.OVL 0x0B94`) | ninguna es cargadora |
| `0xADBF` (fila 5 resuelta) | **sin coincidencias en ningún `.asm`** ⇒ el sprite se lee por puntero calculado |

⇒ **Ruta de encuentros: CONFIRMADO. Ruta de salas de mazmorra (las 5 unidades perdidas):
sigue FUNDADO, NO CONFIRMADO.** El siguiente paso concreto es leer `DNGLOOK.OVL 0x117E`.


---

# ADDENDUM 3 — `DNGLOOK 0x117E` leída: es el COLOCADOR DE PARTY. Y da la clave que faltaba

## Qué es `0x117E`

**No carga unidades: coloca a la PARTY.** Lee las filas de `playerStarts` del propio registro
`.CBT` eligiéndolas por `g_dng_facing` (0/1/3/5 → fila 3 ó 4 vía `[bp-2]`), con **columna 11 =
X** y **columna 17 = Y**, y escribe cada par en la tabla de actores (`0xba1a`/`0xba1b`) y en la
de objetos del mundo (`0x5c5c`/`0x5c5d`), avanzando 8 por miembro.

Es la rutina que `monster-3d` ya había tocado (el «opuesto del facing, estático»): confirma
esa derivación desde el otro lado y **cierra la mitad de party del formato**.

⇒ **Va a la tabla de «dónde NO está» el cargador de unidades.**

## ★ La clave que desbloquea la búsqueda ★

`0x117E` direcciona el búfer así:

```
11fa:  mov al, byte ptr [bx - 0x52ec]      ; 0x10000 − 0x52EC = 0xAD14
```

**El código NO usa la dirección literal `0xAD14`: usa el desplazamiento NEGATIVO
`[bx - 0x52ec]`.** Por eso fallaron todas mis búsquedas por `0xAD14`, `0xADBF`, `0xADDF`…
Es la tercera variante del mismo error del día: **el barrido tiene que poder ver lo que
busca** — primero el desplazamiento vs la dirección resuelta, ahora la dirección resuelta vs
la forma negativa.

## Censo COMPLETO de accesos al búfer `.CBT` (`grep 0x52ec`, 20 sitios)

| sitio | qué hace |
|---|---|
| `COMBAT.OVL 0x0c36 · 0x16aa · 0x17d1 · 0x1b4c` | leen **el TILE bajo un combatiente** (`bx = y*32 + x` con x,y del actor) ⇒ el búfer es **el mapa VIVO de la arena** |
| `COMBAT.OVL 0x11a2 · 0x11d3` | **escrituras del handler de triggers** (0x111A) |
| `DNGLOOK 0x11fa · 0x1207` | **el colocador de party** (filas 3/4, cols 11 y 17) |
| `DNGLOOK 0x09e8 · 0x0ab6 · 0x0b59` | escrituras |
| `ULTIMA.EXE 0x5c29 · 0x5c40 · 0x5c8c` | `cmp [bx+di-0x52ec], 0` — **sin identificar** |
| `ULTIMA.EXE 0x7091` | escritura |
| `BLCKTHRN 0x0135/0x073d/0x099f · CAST2 0x0f1f · ENDGAME 0x0697` | montajes de puntero |

**Ningún sitio del censo lee las filas 5/6/7 en columnas 11-26** (el bloque de unidades),
salvo el colocador de party que lee las filas 3/4.

## Estado: sigue FUNDADO, NO CONFIRMADO — y ahora la duda es más precisa

Con el censo completo, la pregunta deja de ser «¿dónde está el cargador?» y pasa a ser:

> **¿Consume el original el bloque de unidades del `.CBT` en las salas de mazmorra, o los
> enemigos fijos entran por otra vía?**

Los tres `cmp ..., 0` de `ULTIMA.EXE 0x5c29-0x5c8c` son el único candidato sin identificar del
censo. **Ese es el siguiente sitio a mirar**, y con eso el ángulo queda agotado: si tampoco
son, la respuesta no está en accesos por `[- 0x52ec]` y hay que buscar por otro mecanismo
(p.ej. el búfer copiado antes a otra tabla, como hace `0x60EC` en BRIT con `0x1704`/`0x1714`).

## Cierre del ángulo `[- 0x52ec]`: AGOTADO

El último candidato del censo —`ULTIMA.EXE 0x5c29 · 0x5c40 · 0x5c8c`— está dentro de
**`ULTIMA.EXE 0x5A28`, el flood de visibilidad del VIEWPORT** (usa `g_chunk_origin_x/y`,
coordenadas de mundo; ya documentado en `kernel-flood-0x5a28.md`). Usa `0xAD14` como **su
propio búfer de trabajo**, no como registro `.CBT`.

⇒ `0xAD14` es un **scratch COMPARTIDO** (por eso el cargador de `DUNGEON.OVL 0x0061` lo
limpia con `repne stosb` antes de cada carga).

⇒ **Ningún sitio del binario lee el bloque de unidades (filas 5/6/7, cols 11-26) por
`[- 0x52ec]`.** El ángulo está agotado y **no volverá a dar nada**: quien lo retome que no
lo repita.

**Hipótesis viva para el siguiente intento** (no verificada): igual que `0x60EC` hace en BRIT
—copiar el bloque a **tablas de trabajo** (`0x1704` X / `0x1714` Y) y consumir desde ahí—, la
ruta de sala probablemente copie también, y el consumo real esté sobre esas tablas. El
siguiente barrido debería ir por **`0x1704`/`0x1714`** (y sus vecinas), no por el búfer.

---

# ★ ADDENDUM 4 — SAPO **CONFIRMADO**: el original filtra por `sprite == 0`, no por `(0,0)` ★

Encontrado el cargador de unidades de SALA. Está en la **segunda mitad de `DNGLOOK.OVL 0x117E`**
—la misma rutina cuya primera mitad coloca a la party—, y por eso se me escapó: la leí hasta
`0x1217` y el bucle de unidades empieza en `0x1291`.

## El bucle, y el criterio de vacío

```asm
1270:  mov word ptr [bp-2],  0xb        ; índice = 11 (columna 11)
1291:  mov word ptr [bp-0xe], 0x10      ; 16 iteraciones
...
12a1:  mov bx, word ptr [bp-2]
12a4:  mov al, byte ptr [bx - 0x524c]   ; 0x10000−0x524C = 0xADB4 = fila 5 col 0  → +11 = SPRITE
12ab:  or al, al
12ad:  jne 0x12b2
12af:  jmp 0x1385                       ; ★ sprite == 0  ⇒  SALTA LA RANURA ★
...
1305:  mov al, byte ptr [bx - 0x522c]   ; 0xADD4 = fila 6 col 0  → X
130f:  mov al, byte ptr [bx - 0x520c]   ; 0xADF4 = fila 7 col 0  → Y
```

**El único descarte de ranura es `sprite == 0`.** No hay ninguna comparación contra `(0,0)`,
ni contra la posición en absoluto: X e Y se leen **después** del filtro y se usan tal cual.

⇒ **Una ranura con sprite real en `(0,0)` SE COLOCA.** El filtro del extractor
(`if (x === 0 && y === 0) continue`) **descarta enemigos que el original sí crea.**

## SAPO CONFIRMADO — en sus dos mitades

| ruta | veredicto | prueba |
|---|---|---|
| **Encuentros (BRIT)** | **CONFIRMADO** | `ULTIMA.EXE 0x60EC` copia las 16 ranuras con `rep movsw`, sin comparaciones |
| **Salas de mazmorra** | **CONFIRMADO** | `DNGLOOK 0x117E @0x12ab` filtra **sólo** por `sprite == 0` |

**Coste real: 6 unidades** (`#43` ×1, `#71` ×3, `#126` ×1, BRIT `#0` ×1) **+ 17 ranuras de
posición** en BRIT — con la deriva de RNG que eso arrastra en el `shuffle`.

## Por qué se resistió tanto: **cada FILA tiene su propia base**

La razón de que fallaran cuatro barridos seguidos:

```
fila 5 (sprite) → [bx - 0x524c]   (0xADB4)
fila 6 (X)      → [bx - 0x522c]   (0xADD4)
fila 7 (Y)      → [bx - 0x520c]   (0xADF4)
```

**El compilador plegó `base_del_búfer + fila*32` en una constante distinta por fila.** Así que
no existe *ninguna* mención de `0xAD14`, ni de `0xADBF`, ni de `-0x52ec` en el código que lee
las unidades. Los cuatro ángulos que probamos —desplazamiento, dirección resuelta, forma
negativa del búfer base, tablas de trabajo— **no podían encontrarlo por construcción**.

Quinta vez hoy que el instrumento no podía ver lo que buscaba, y la más instructiva: aquí ni
siquiera bastaba con «buscar la forma negativa», **había que buscar las TRES bases plegadas**.
La pregunta que lo habría acortado: *si el compilador pliega constantes, ¿cuántas formas
distintas puede tomar la dirección que busco?*

## Lo que habilita

El arreglo del extractor pasa a estar **derivado, no supuesto**: cambiar
`if (x === 0 && y === 0)` por `if (sprite === 0)` — que además **unifica el criterio con el de
los triggers diez líneas más abajo** y con el del port (`combat.ts:648`).

Sigue **sin aplicarse**: re-introduce 6 enemigos y 17 ranuras ⇒ mueve dificultad **y** RNG.
Va detrás del resello y del espejo, junto al de la Falsedad.
