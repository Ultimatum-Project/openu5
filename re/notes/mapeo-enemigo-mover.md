# Mapeo enemigo → índice de mover → clase de movimiento — DERIVADO (tarea #30)

Cierra el eslabón que `redux-flags-movilidad-barrido.md §3` dejó abierto. **Estático puro:
no hizo falta probe de DOSBox.** El mapeo se deriva del disasm y se valida con TRES anclas
independientes ya existentes en el repo + la coherencia semántica de las 11 clases.

---

## 1. La cadena, eslabón a eslabón

### 1.1 ★ Primero hubo que arreglar el SESGO de las llamadas near

`redux-flags-movilidad-barrido.md §3` proponía resolver las llamadas de `COMBAT.OVL:0x0000`
con el sesgo `(x + 0x81D0) & 0xFFFF`. **Ese sesgo es de DUNGEON/TOWN/MAINOUT, no universal**:
cada overlay tiene su propia base de carga (campo +A de la tabla PLINK86). Aplicándolo a
COMBAT salían `0x2342` y `0x0b8c`, que **no son entradas de rutina** (caen a media
instrucción; 0x0b8c está dentro de código de sonido, con `lcall [g_snd_driver_fn]`). El aviso
de la memoria del sesgo —«verificar QUÉ es»— hizo su trabajo.

La base correcta la da el propio repo: `re/tools/dispatch_table.py::overlay_near_call_base()`
= `(load_seg*16 − reloc_header) & 0xFFFF`.

| overlay | load_seg | base de call near |
|---|---|---|
| TOWN / MAINOUT / DUNGEON | 2077 | `0x81D0` |
| **COMBAT / DNGLOOK** | **2601** | **`0xA290`** |
| SJOG | 3064 | `0xBF80` |
| COMSUBS | 3614 | `0xE1E0` |

Con `0xA290`, las llamadas de `COMBAT:0x0000` resuelven a rutinas reales:
`0x002f → 0x4402` (puntero a celda del mapa) y **`0x0039 → 0x2C4C`** — la propia
`kernel_tile_passable`. ⇒ **`COMBAT:0x0000` ES el consumidor de la tabla de clases.**

### 1.2 Los tres `push` y la convención `pascal`

```
0026: push [bp+8]          ; ← 1er arg de kernel_tile_passable (pascal: izq→der)
0029: push [bp+6]          ; \ args de map_cell_ptr
002c: push [bp+4]          ; /
002f: call 0x4402          ;   map_cell_ptr(y,x) — RET 4: limpia SÓLO sus 2
0032: mov bx,ax
0034: mov al,[bx]          ; el TILE de la celda
0038: push ax              ; ← 2º arg
0039: call 0x2c4c          ;   kernel_tile_passable(mover, tile) — ret 4
```

El desajuste aparente (3 push, callee de 2 args) se resuelve al leer que `0x4402` es
**`ret 4`**: limpia dos words y **el tercero sobrevive**, y es justo el `[bp+6]` que `0x2C4C`
lee como MOVER. Es el idiom de la convención `pascal` de Borland (empuje izquierda→derecha,
callee limpia). ⇒ **el mover de `0x2C4C` = el 1er parámetro de `COMBAT:0x0000`.**

### 1.3 ★★ De dónde sale el mover: `SJOG:0x20D8`

```
20e3: ax = [bp+4]          ; índice de COMBATIENTE
20e8: ax <<= 3             ; ×8
20ea: ax += 0xba14         ; → registro del combatiente (8 B c/u, DS:0xBA14)
...
2108: bx = ax
210a: bl = [bx + 4]        ; ★ CAMPO +4 del registro = slot de OBJETO
210f: bx <<= 3             ; ×8
2111: al = [bx + 0x5c5a]   ; ★ byte +0 de la entrada del array de objetos (DS:0x5C5A)
2117: push ax              ; ← el MOVER
2118: push [bp+8]          ; y      (y luego x, y call a COMBAT:0x0000)
```

⇒ **mover = `byte [DS:0x5C5A + 8·objSlot]` = el TILE del objeto** (`0x5C5A` ya está
documentado en el repo como el array de objetos/botín, 8 B por entrada).

### 1.4 ★ La refutación de `320 + 4·i`, por ARITMÉTICA

`al = **byte** ptr [bx + 0x5c5a]` — el mover **es un byte**. El `tile = 320 + i·4` del port
(`enemies.ts`, `KeyTileReference` de Redux) vale 320..508: **no cabe en un byte para NINGÚN
i**. La hipótesis que la tanda #27 marcó como trampa no es sólo «da índices fuera de la
tabla»: es **imposible por anchura**. El `tile` del port es su índice de atlas, otro espacio.

---

## 2. La fórmula, y sus TRES anclas independientes

**`mover = 0x40 + 4·i`** ⇒ **`idx de clase = mover >> 2 = 16 + i`** (i = 0..47 ⇒ idx 16..63,
**dentro** de la tabla de 64; la hipótesis vieja daba 80..127, fuera, sobre strings ASCII).

| ancla | fuente (preexistente, no de esta tanda) | predicho | observado |
|---|---|---|---|
| Rata `i=20` | `combat.md:498` «ratas (**0x90**) son clase 0» | `0x90` | `0x90` ✓ |
| Ghost `i=23` | `rebarrido-65-125-y-ch16b-5-5.md:61` «1× **sprite 156** = i=23 Ghost» | `156` | `156` ✓ |
| Whirlpool `i=43` | `rebarrido-65-125…:60` «6× **sprite 236** = i=43 Whirpool1» | `236` | `236` ✓ |

**3/3.** Ninguna de las tres se escribió para esto: son testigos anteriores del repo.

> ★ **Y de paso cierra un nombre que el proyecto arrastraba**: la «familia **0xEC**» es
> `0xEC = 236 = i=43 = Whirpool1`. El 0xEC no era un código misterioso: es **el sprite del
> remolino**.

---

## 3. El mapeo completo (48 enemigos)

| clase | qué hace | enemigos |
|---|---|---|
| **0** a pie, bitmap `0x54D4` | 33 | Wizard, Bard, Fighter, Avatar, Villager, Merchant, Jester, BardPlaying, Pirates, WallPrisoner, Child, Beggar, Guard, Blackthorn, **Rat**, Spider, Slime, Gremlin, Mimic, Reaper, Shard, Gargoyle, Insects, Orc, Skeleton, Snake, Ettin, Headless, **Wisp**, Troll |
| **1** SOLO agua | 4 | Seahorse, Squid, SeaSerpent, Shark |
| **2** tierra ∪ agua (incl. rápida) | 7 | Apparation, Lord British, **Bat**, Gazer, **Daemon**, Dragon, MongBat |
| **4** ★ no-agua, **IGNORA el bitmap ⇒ ATRAVIESA MUROS** | **2** | **Ghost (i=23)** · **Shadow Lord (i=47)** |
| **7** sólo tile 4 (Swamp) | 1 | RotWorm |
| **8** sólo tile 5 (Grass) | 1 | Corpser |
| **9** sólo tile 1 (Water1) | 1 | **Whirlpool** |
| **10** sólo tile 7 (Desert1) | 1 | **Sand Trap** |
| **255** > 0x0A ⇒ **siempre bloqueado** | 1 | **Poison Field** |

### 3.1 La coherencia semántica es la 4ª validación
Ninguna de estas la impuse: salen de cruzar la tabla con los handlers ya derivados en #27.
- **Whirlpool → sólo Water1**, y **Poison Field → siempre bloqueado** (un campo no se mueve).
- **Sand Trap → sólo Desert1**. Esto CONFIRMA por derivación el comentario del port
  (`combat.ts:1125`): *«el único isSand vive solo en Desert»*.
- **RotWorm → sólo Swamp.**
- **Los 4 acuáticos de clase 1 = exactamente los 4 `IsWaterEnemy` marinos de Redux.**
- ★ **Ghost → clase 4**, y Redux lo marca `CanPassThroughWalls=TRUE` **de forma
  independiente**. El único enemigo que Redux declara atraviesa-muros cae, él solo, en la
  única clase del binario que atraviesa muros. Corroboración cruzada limpia.

---

## 4. ADJUDICACIÓN pedida: los Bats del cuartito de cm64

**Los Bats (i=21) son CLASE 2**, cuyo handler (`0x2C80`) es
`agua rápida ∨ es_agua ∨ **walkable(0x54D4)**` — la tercera rama **sí** consulta el bitmap
de a pie ⇒ **un muro los bloquea**.

⇒ **Los Bats NO atraviesan muros.** Por tanto, si el testigo YT los vio DENTRO del cuartito
cerrado de cm64, **spawnearon dentro**; no entraron. Queda adjudicado por derivación, no
asumido. (Las únicas dos criaturas que podrían haber entrado son Ghost y Shadow Lord.)

---

## 5. Careo con los flags de Redux: 8 divergencias enumeradas

| conjunto | binario (derivado) | Redux (`AdditionalEnemyFlags.json`) | divergencia |
|---|---|---|---|
| agua | clase 1 = {16,17,18,19} | `IsWaterEnemy` = +{**8 Pirates**, **43 Whirlpool**} | 2 de más en Redux |
| volador | clase 2 = {13,15,21,28,38,39,44} | `CanFlyOverWater` = {21,23,28,37,39,44} | **sólo en el binario**: 13 Apparation, 15 Lord British, **38 Daemon** · **sólo en Redux**: **23 Ghost**, **37 Wisp** |
| atraviesa muros | clase 4 = {**23 Ghost**, **47 Shadow Lord**} | `CanPassThroughWalls` = {23 Ghost} | **47 Shadow Lord falta en Redux** |

★ Esto **confirma la sospecha que el propio port se había escrito** en `combat.ts:1120-1124`
(«la fila voladora del bitmap de clase sigue SIN derivar … no copiar el name-matching de
Redux a ciegas»): el conjunto volador de Redux **no es** la clase 2 del binario — difieren en
**5 de 9**. El Shadow Lord atravesando muros es además coherente con que sea incorpóreo.

---

## 6. Consecuencias para el port (NO cableadas aquí)

Entregable separado por indicación del lead. Lo que el mapeo desbloquea:

1. **`canPassWalls` deja de ser indervivable**: la clase 4 = {Ghost, Shadow Lord}. Cablearlo
   es ahora calcable **sin la palabra de Redux** — y con una corrección: el Shadow Lord
   también.
2. **`canFlyOverWater` es reemplazable por la CLASE**, no por un booleano: 3 enemigos que el
   port no trata como voladores lo son (Apparation, Lord British, Daemon) y 2 que sí, no
   (Ghost —es clase 4—, Wisp —es clase 0—).
3. **Aparecen 4 clases que el port no modela en absoluto**: 7/8/9/10 (mono-tile) y 255.
   Hoy Whirlpool, Sand Trap, RotWorm, Corpser y Poison Field caen todos al bucket terrestre.
4. **Radio de sellos**: el Ghost SÍ atraviesa muros en el original ⇒ los veredictos de sala
   con Ghost (cm64/cm65 de Covetous, #65) **cambian de premisa**. NO re-adjudicados aquí.

## 7. Censo de llamadores de `0x2C4C` — el mapeo es la historia COMPLETA

Barrido de **las 5.756 llamadas near** de los 28 `.asm`, resolviendo cada `e8 rel16` con la
base de carga de SU overlay (no con una global — el error del §1.1). **Control positivo
incluido en la corrida**: el barrido debe ver el `call` conocido de `COMBAT.OVL:0x0039`, y lo
ve. Sin ese control, un corpus incompleto habría dado el mismo cuadro con menos filas.

| overlay | sitios |
|---|---|
| **COMBAT.OVL** | `0x0039` ← **el único del lado COMBATE** |
| MAINOUT.OVL | `0x02a8`, `0x14a3` | 
| TOWN.OVL | `0x0788`, `0x0d77` |
| CMDS.OVL | `0x07ad`, `0x0f31` |

Las 6 de MAINOUT/TOWN/CMDS son el movimiento del PARTY (mover = tile de TRANSPORTE, que es la
familia que `carpet-b2.md` ya había derivado). **No hay una tercera familia**, y `DUNGEON.OVL`
no llama a `0x2C4C` en absoluto. ⇒ para enemigos, `COMBAT:0x0000` es el consumidor único y el
mapeo de §3 es completo, no una muestra.

## 8. Gates
Sólo notas: **ningún `.ts` tocado** ⇒ tsc no aplica (declarado). Cero playwright.
Sin probe de DOSBox pendiente: **el estático alcanzó**.
Corpus verificado antes de firmar: **28/28 `.asm` legibles** + 2 controles positivos
(`0x2c4c` en ULTIMA.EXE, `0x20d8` en SJOG) — la lección del corpus incompleto de #24.
