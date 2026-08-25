# El mapa de mazmorra en memoria — búferes, momentos y offsets (REFERENCIA CANÓNICA)

**Encargo**: resolver la «contradicción de dos búferes» (la gema pintando el mapa de DOOM
arrastrado por los saves-escenario mientras el movimiento parecía obedecer al Covetous
real). **Método**: derivación del binario con offsets, más censo EXHAUSTIVO de la E/S de
fichero del juego entero (control positivo antes de firmar un cero). Sin suposiciones.

**VEREDICTO EN UNA LÍNEA**: **hay UN SOLO búfer** (`g_dng_map` @ `DS:0x595A`, 512 B). La
gema y el movimiento leen los MISMOS bytes con el MISMO indexado. **Nada relee
`DUNGEON.DAT` salvo pulsar (E)nter sobre la entrada en el mundo exterior.** Por tanto la
candidata (a) del acta —«la gema lee la copia del save y el movimiento un búfer recargado
del disco»— queda **REFUTADA**: no existe el segundo búfer ni la recarga. La contradicción
se disuelve: la sesión-testigo del 27-07 caminó sobre el mapa de DOOM de principio a fin
(§5), en concordancia con la re-adjudicación `31d5910b` de `main`.

---

## 1. El búfer

```
g_dng_map @ DS:0x595A, 512 B contiguos = 8 plantas × 8×8 celdas (1 byte/celda)

    tile(x, y, floor) = [DS:0x595A + (floor<<6) + (y<<3) + x]      x,y,floor ∈ 0..7
```

- Está **DENTRO de la ventana SAVED.GAM**: `roster_off = 0x55A6`, luego el offset de
  fichero es `0x595A − 0x55A6 = 0x3B4`. La ventana entera es `[0x55A6, 0x6606)` =
  `0x1060` = 4192 B = el tamaño exacto de `SAVED.GAM`/`INIT.GAM`.
- Es **la mazmorra ENTERA, no la planta actual**. Por eso cambiar de planta no toca disco.
- Nibble ALTO = tipo, nibble BAJO = subtipo (diccionario en `dungeon.md §0.2`).
- **Bit 0x08 = celda «iluminada/visible»**. NO es puro estado de partida: `DUNGEON.DAT`
  virgen ya trae 109 de 4096 celdas con el bit puesto. Lo escribe en runtime la caída por
  foso (DUNGEON `0x0abd or [bp+4],8` sobre la celda de aterrizaje) y lo preservan los
  «consumos» (`and celda, 8`).

**No hay ningún otro búfer de mapa de mazmorra.** El censo del corpus da 41 accesos a
`0x595a` repartidos en CAST, CAST2, CMDS, DNGLOOK, DUNGEON, MAINOUT y SJOG, y todos usan
la misma dirección base y el mismo indexado `(floor<<6)+(y<<3)+x`.

---

## 2. Quién lo puebla y CUÁNDO

### 2.1 ★ (E)nter andando — EL ÚNICO LECTOR DE `DUNGEON.DAT` DE TODO EL JUEGO

`MAINOUT.OVL 0x0790` = `mainout_enter_location(msgPtr)`. Recorre `si = 0x20..0x27`
buscando en las tablas de entradas del mundo exterior (`X` en `DS:0x1E8A`, `Y` en
`DS:0x1EB2`) la que coincide con la posición de la party (0x07a0-0x07d6). Con `si` en mano:

```
086d: mov ax, 0x2a53      ; -> DATA.OVL file 0x2a63 = "DUNGEON.DAT"   (DS = file − 0x10)
0871: mov ax, 0x595a      ; destino = g_dng_map
0875: mov ax, 0x200       ; 512 bytes
0879: mov ax,[bp-2]; shl ax,9; sub ax,0x4000    ; offset = (si−32)*512 = dungIdx*512
0884: call 0xffffa39e     ; +0x81D0 -> kernel 0x256E = read_file_block(name,dest,len,off)
0887: mov al,[bp-2]; inc al; mov [g_location], al       ; g_location = si + 1
```

Mapeo derivado (tabla de nombres en `DS:0x1E3A + idx*2`):

| `si` | `g_location` | mazmorra | offset en `DUNGEON.DAT` |
|------|--------------|----------|-------------------------|
| 0x20 | 0x21 | DECEIT   | 0x0000 |
| 0x21 | 0x22 | DESPISE  | 0x0200 |
| 0x22 | 0x23 | DESTARD  | 0x0400 |
| 0x23 | 0x24 | WRONG    | 0x0600 |
| 0x24 | 0x25 | COVETOUS | 0x0800 |
| 0x25 | 0x26 | SHAME    | 0x0A00 |
| 0x26 | 0x27 | HYTHLOTH | 0x0C00 |
| 0x27 | 0x28 | DOOM     | 0x0E00 |

Colocación inicial (0x088f-0x08c9): si `g_floor != 0` y `g_location != 0x28` ⇒ entras por
ARRIBA con `g_floor=7`, facing 3 (Oeste), `(x,y) = (7,7)`; si no, `g_floor=0`, facing 1,
`(x,y) = (1,1)`. (Doom es la excepción: siempre entra por la planta 0.)

**Cadena de llamadores — CERRADA**: `MAINOUT 0x0790` tiene **un solo** llamador,
`MAINOUT 0x08de`; y `0x08de` tiene **un solo** llamador, el despachador de comandos del
kernel `0x3178` con la tecla **`E`** (stub 0x7b66). Es decir: la única forma de que
`DUNGEON.DAT` llegue a RAM es que el jugador pulse `E` sobre la entrada.

> Extra derivado de paso (no pedido): entrar en DOOM (`si == 0x27`) exige que
> `g_shadowlord_locs[0] & [1] & [2] >= 0x80` (0x07de-0x07f4). Si no, imprime
> `"\nAttacked at entrance!\n"` y monta combate (`[bx+0x5c5a] = 0xFC`, `bx = ret<<3`).

### 2.2 Cambiar de planta — NO toca el búfer

`DUNGEON.OVL 0x1C6A` = `dng_change_level(arg, delta)` — **cuerpo entero leído**:

- imprime `"Down!\n"` (`DS:0x6c6c`) si `delta > 0`, `"Up!\n"` (`0x6c74`) si no;
- tope duro: `delta>0 && g_floor==7` ⇒ devuelve 1 (0x1c8d); `delta<0 && g_floor==0` ⇒ 1;
- llama `dng_landing_ok(arg, g_floor+delta)` (0x1C0C). Si OK: `g_floor += delta`
  (0x1cc1), `g_dng_anim_dir = 5` (bajando) o `4` (subiendo), `call 0x0134(1)`,
  `dng_redraw` (0x1BE0). Si no: `"Failed!\n"` (`0x6c7a`) + `sound(0x32,1,0x7d0,0x320)`.
- **Cero accesos a `0x595a`.** Las 8 plantas ya están en RAM; cambiar de planta es mover
  un índice.

### 2.3 Salir de la mazmorra — NO limpia el búfer ★

`DUNGEON.OVL 0x1D08` = `dng_exit()` — **cuerpo entero leído** (0x42 bytes):

```
si = g_location
g_party_x = [si + 0x1E89] ; g_party_y = [si + 0x1EB1]   (las mismas tablas de 2.1,
                                                         desplazadas 1 porque loc = si+1)
imprime "\nExit to "                                            (DS:0x6c84)
if (g_floor != 0) { g_floor = 0xFF; "Underworld!\n\n" }         (DS:0x6c8e)
else              { g_floor = 0x00; "Britannia!\n\n"  }         (DS:0x6c9c)
g_location = 0
```

**No borra ni reinicia `g_dng_map`.** El mapa de la última mazmorra en la que entraste
andando se queda en RAM indefinidamente — y por tanto en TODOS los saves posteriores,
estés donde estés. **Este es el origen exacto del «mapa arrastrado» de los
saves-escenario.**

### 2.4 ★ Cargar una partida DENTRO de la mazmorra — restaura la copia del save, NO relee disco

Carga: `INTRO.OVL 0x0EB4` (ruta *Journey Onward*; base near-call de INTRO = **0x81C0**,
no 0x81D0 — tiene cabecera de reloc):

```
0eb4: push 0x31e6   ; DATA.OVL file 0x31f6 = "SAVED.GAM"
0eb8: push 0x55a6   ; destino = base de la ventana
0ebc: push 0x6606-0x55a6 = 0x1060
0ec3: push 0        ; offset 0
0ec6: call ...      ; +0x81C0 -> kernel 0x256E
```

Un solo bloque de 4192 B ⇒ `g_dng_map` queda con lo que hubiera en el fichero en `0x3B4`.

Y el arranque de la sesión de mazmorra **no repara nada**. Despacho del bucle principal
del kernel (`ULTIMA.EXE 0x00D1`):

```
00d1: if (g_location == 0)    goto 0x16e        ; exterior / underworld
00db: if (g_location >= 0x21) goto 0x104        ; MAZMORRA
      ... (rama de pueblo: stubs 0x7a46 / 0x7a52)
0104: push 2; call 0x251E                        ; conmuta al grupo de overlays 2
010b: push [bp-2]; call 0x7a16                   ; stub -> DUNGEON.OVL 0x0E2E
```

`DUNGEON.OVL 0x0E2E` (stub `0x7a16`, la PRIMERA entrada de la tabla de stubs; único
llamador = `ULTIMA.EXE 0x0000`) es la entrada de la sesión de mazmorra. **Ninguna carga de
fichero en toda la ruta.** Lo primero que hace (0x0e4a, incondicional) es:

`DNGLOOK.OVL 0x093A` = `clear_consumed_markers` — barre los **512 bytes** del búfer
(`si=0x595A`, `di=0x200`); para cada byte con nibble alto `0xF0` toma el nibble bajo como
nº de sala, consulta el bit de sala-despejada (`0x08D4`, indexado por el **`g_location`
ACTUAL**) y, si está puesto, hace `and byte ptr [si], 0xAF` ⇒ `0xFn → 0xAn`.

> ⚠ **Corolario del confound**: con un save que dice Covetous pero lleva los bytes de
> Doom, este barrido aplica los bits de sala-despejada **de Covetous** sobre el mapa **de
> Doom**. Es monótono (sólo 0xF→0xA, nunca al revés). En los escenarios auditados era
> inocuo porque Covetous estaba entero virgen en `g_dng_room_cleared` (@0x33A).

### 2.5 Guardar — persiste el búfer verbatim

`CAST2.OVL 0x10FE` es el handler de `Q`uit (despachador 0x3178). En `0x1194`:

```
push 0x9698 (= DATA.OVL file 0x96a8 = "SAVED.GAM"); push 0x55a6; push 0x1060
call 0x43f8   ; +0xE1E0 -> kernel 0x25D8 = write_whole_file(name, buf, len)
```

`kernel 0x25D8` envuelve `kernel 0x7296` = `create(AH=3Ch) + write(AH=40h) + close(3Eh)`
⇒ **escritura**. Se vuelca la ventana entera desde RAM, `g_dng_map` incluido, al offset
0x3B4 del fichero. Otros dos escritores de `SAVED.GAM` (mismo bloque de 0x1060):
`INTRO 0x1E08` y `FONT 0x0E3D`.

### 2.6 Mutaciones del búfer en runtime (censo de escritores)

| sitio | operación | lectura |
|-------|-----------|---------|
| `DUNGEON 0x00F5` | `and celda, 0xAF` ⇒ `0xFn→0xAn` | sala GANADA: degrada la celda de entrada al combate (el bit persistente lo pone `DNGLOOK 0x0844` en `0x00DE`) |
| `DNGLOOK 0x096E` | `and celda, 0xAF` | el barrido de 2.4, sobre las 512 |
| `DUNGEON 0x0A9F` | `and celda, 0xF8` | foso disparado: borra el subtipo (0x6n→0x60) |
| `DUNGEON 0x0ADC` | `mov celda, al` con `al = celdaAbajo \| 8` | aterrizaje del foso: marca «vista» la celda de la planta inferior |
| `DUNGEON 0x09DA`, `0x0DF3` | `and celda, 8` | consumo de celda (conserva sólo el bit de luz) |
| `SJOG 0x07B0/0x089A/0x0D21/0x1351`, `0x07FA`, `0x181A` | `mov` / `and ,8` | (G)et/(S)earch/(O)pen sobre cofres, puertas secretas y trampas — **censados, no derivados uno a uno en este pase** |

---

## 3. Los DOS lectores en disputa leen el MISMO byte

### Movimiento — `DUNGEON.OVL 0x0502` (`dng_move`), cuerpo leído

```
newX = party_x + dx[facing]*step         ; dx @ DS:0x24D6 = [0,+1,0,−1] para N,E,S,O
if (newX < 0) newX = 7                   ; 0x057e   ← WRAP TOROIDAL
if (newX > 7) newX = 0                   ; 0x0589
   (idéntico para newY con dy @ DS:0x24DE, 0x05ac/0x05b7)
si  = (newY<<3) + newX
bx  = g_floor << 6
al  = [bx + si + 0x595a]                 ; 0x05D0
```

Luego `hi = tile & 0xF0`; `hi > 0xA0 && hi < 0xE0` ⇒ bloqueado; y marcha ATRÁS
(`step == −1`) contra `0xA0`/`0xF0` también se rechaza (0x060b-0x061b).

### Gema — `DNGLOOK.OVL 0x06A8` (`View a gem`, stub 0x7f4a) → celda por `0x0340`

Rejilla de vista 22×22 (cotas `0..0x15` en 0x0353/0x035f), bitmap de visitados en
`DS:0xAD14` (0x2E0 B, borrado con `repne stosb 0xFF` en 0x06e4), relleno por inundación
con cola doble en `DS:0xA528`/`DS:0xA628`. Por celda (0x0388-0x03C1):

```
cellX = (viewX + party_x − 11) & 7       ; 0x0396
cellY = (viewY + party_y − 11) & 7       ; 0x03a8
al    = [ (g_floor<<6) + (cellY<<3) + cellX + 0x595a ]      ; 0x03C1
```

**Mismo búfer, misma planta, mismo indexado, mismo wrap.** El despacho de glifo va por
tabla de salto de 16 entradas en `CS:0xA900` (= DNGLOOK file 0x670), indexada por el
nibble alto:

| nibble | handler | dibuja |
|--------|---------|--------|
| 0x0 pasillo | 0x040E | **sólo si bit 0x08 puesto** (`test [celda],8` @0x0422); si no, nada |
| 0x1 / 0x2 escaleras | 0x043E / 0x0452 | glifos 0x2E / 0x2D, incondicional |
| 0xA y 0xF sala | 0x05C6 (compartido) | glifo 0x73, incondicional |
| 0xB muro | 0x05DA | glifo 0x7F si el byte es exactamente `0xB0`, si no 0x74; **corta la inundación** |
| 0x7 / 0x9 | 0x0690 | nada |

⇒ **La gema es una lectura inmediata y fiable de la GEOMETRÍA del búfer** (muros, salas,
escaleras, fuentes). Sólo los pasillos dependen del bit de luz, y ése viene casi todo de
fábrica (109/4096 celdas en `DUNGEON.DAT` virgen).

---

## 4. Control positivo: censo EXHAUSTIVO de la E/S por bloque

Barrido de todo el corpus (26 `.OVL` + `ULTIMA.EXE`) resolviendo cada near-call con la
base por overlay y resolviendo el nombre de fichero del inmediato contra `DATA.OVL`
(`DS = file − 0x10`, calibrado con 4 mensajes cuyo texto casa con la lógica del sitio):

- **64 sitios** de lectura/escritura de bloque en todo el juego.
- **Exactamente 1** nombra `DUNGEON.DAT`: `MAINOUT 0x0884`.
- **Exactamente 1** tiene `0x595A` como destino: el mismo.
- Ningún puntero de `DATA.OVL` contiene el valor `0x2A53` (búsqueda de la palabra
  `53 2A` en los 48 448 B del fichero: 0 apariciones) ⇒ tampoco se llega por tabla.

Los demás destinos son búferes distintos y ajenos: `0x5C5A` (`g_char_anim_states`, 256 B),
`0xB21E`/`0xB31E` (scratch de texto/OOL), `0xAD14`, `0x5D5E` (`g_npc_sched`), `0x6608`
(caché de chunks), `0x55A6` (la ventana del save).

> Curiosidad del censo, no perseguida: `INTRO 0x0B3D` carga **`BRITISH.PTH`** sobre la
> ventana del save (`0x55A6`, 0x1060 B) — el modo demo del intro pisa el area de partida.

---

## 5. Adjudicación de la contradicción

> ⚠ **CORRECCIÓN DE MI PROPIA §5 (misma noche)**. La primera redacción de esta sección
> (comm. 28ce531f / 0af18196) se escribió contra `sonda-0xec-testigo-visual.md` en su
> estado de las 18:53 y **sostenía que el testigo entró a cm65 y que por tanto la RAM
> tenía el Covetous auténtico**. `main` incorporó a las 19:20 la **re-adjudicación final**
> (`31d5910b`) que corrige el dato base: la sala fue **cm64, no cm65**. Con el dato bueno,
> mi propia derivación apunta al revés. Se reescribe entera y se deja el error visible.
>
> Cómo pasó, para el acta de método: tomé el número de sala de un acta que ya estaba
> siendo re-adjudicada en paralelo, y construí sobre él tres inferencias. La derivación
> del mecanismo (§1-§4) no dependía de ese dato y no cambia; la adjudicación sí. **Antes
> de razonar sobre una observación de otro carril, comprobar el tip de `main`.**

**Lo que el mecanismo cierra (sellado, independiente de cualquier acta):**

- (a) «la gema lee la copia del save y el movimiento un búfer recargado del disco» —
  **REFUTADA**. No hay segundo búfer y no hay recarga posible: un solo lector de
  `DUNGEON.DAT`, colgando por cadena única de la tecla `E`. (Coincide con la derivación
  previa de frontera-25 por censo de las referencias a `0x595a`; este pase la corrobora
  por una vía distinta —el censo de E/S de fichero— y añade el resto de la cadena.)
- (c) «difiere cargar-dentro vs entrar-andando» — **CIERTA, y es la única asimetría del
  sistema**: entrar andando SOBRESCRIBE el búfer con el mapa auténtico; cargar dentro NO.
  Es el único acto del juego que cambia la geometría en RAM.

**Cómo cierra la sesión-testigo del 27-07** (veredicto de `31d5910b`, que este mecanismo
**confirma** en vez de contradecir):

El testigo respondió que jugó «todo seguido desde la carga, **sin salir ni re-entrar**».
Como `(E)nter` es el ÚNICO evento que reescribe el búfer y el testigo no lo ejecutó, el
búfer **no pudo cambiar en toda la sesión**: fue el mapa de DOOM arrastrado, de principio
a fin. Todo lo observado encaja con eso:

| observación | bajo el mapa de Doom arrastrado |
|-------------|--------------------------------|
| Sala jugada = **cm64** | Doom planta 0 tiene UNA sala, en `(1,1)`, con valor **`0xA0`** = `roomNo 0` **ya despejada**. Con `g_location` = Covetous ⇒ combatmap `64 + 0` = **64** ✔ |
| Sin combate, re-entrada libre | la celda es `0xA0`, no `0xF0`: sala despejada. La despejadez viaja **en la celda del mapa del save**, no sólo en el bitmap `0x33A` — exactamente el `&0xAF` de `DUNGEON 0x00F5` |
| Party en la columna izquierda | colocación P0a normal con el banco OESTE de cm64 ⇒ el «mecanismo de colocación de respaldo no derivado» queda **RETIRADO** |
| Party dentro de roca (`(0,2)` = `0xB0`) con el 3D pintando puertas en las 4 direcciones | estado imposible-por-diseño, **observado** por el testigo (`a48f142e`). No es una anomalía del mapa: es la consecuencia directa de parchear la posición sin parchear el mapa |

Mi §5 anterior usaba precisamente esos dos últimos hechos **como evidencia en contra** del
mapa de Doom («la party estaría dentro de un muro, eso se habría notado»). Se notó, y está
documentado: es evidencia **a favor**.

**La frase del usuario, adjudicada como pedía el encargo**: «Covetous P1 tiene salas de una
entrada con criptas y tesoros, sin sala central como Doom L1» describe con exactitud los
**datos auténticos de ambas** mazmorras (Covetous planta 0: 8 puertas de sala colgando de
pasillos + 2 fuentes `0x51` + escalera arriba en `(1,1)` y abajo en `(1,7)`; Doom planta 0:
1 sola sala en `(1,1)` + 4 escaleras abajo). Es decir: **es una descripción del mapa de
REFERENCIA que el carril estaba consultando, no de lo que el juego tenía en pantalla** —
que era la planta 0 de Doom. Esa distancia entre lo consultado y lo renderizado **es** el
confound, y explica por qué costó tanto verlo.

**Lo que NO es evidencia (comprobado y descartado, para que nadie lo re-use):**

- `original/u5/play/SAVED.GAM` es **byte-idéntico** al escenario `covetous-r1-remolinos`
  pre-parche ⇒ el juego nunca lo re-guardó; no dice nada de la RAM.
- `saves-lib/_backups/SAVED.GAM.20260727-184120` (loc=Covetous, planta 0, `(0,1)`) parecía
  un guardado en vivo: **no lo es**. Difiere del escenario en **UN solo byte**
  (`0x2F1: 2→1`, `g_party_y`), sin avance de reloj ni de contadores ⇒ variante parcheada a
  mano. **Regla**: antes de usar un `.GAM` como testigo de la RAM, diffearlo entero contra
  el escenario del que salió.

**Discriminador barato para el futuro** (20 s, sin instrumentación): al cargar un escenario,
pulsar **`V`iew a gem ANTES de mover**. La gema pinta muros, salas y escaleras
incondicionalmente (§3), así que delata la geometría del búfer al instante:
**Doom planta 0 = UNA sala** · **Covetous planta 0 = OCHO salas + dos fuentes**.

### Anexo de datos (planta 0, `tile[y][x]`, hex)

```
COVETOUS (DUNGEON.DAT 0x0800)        DOOM arrastrado (=DUNGEON.DAT 0x0E00, 3 bytes)
y=0: b0 b0 b0 c0 c0 c0 c0 c0         y=0: b0 00 b0 00 b0 20 b0 b0
y=1: b0 10 b0 b0 b0 c0 b0 b0         y=1: 00 a0 00 00 b0 b0 b0 00     <- (1,1)=0xA0 = cm64
y=2: 00 00 00 f0 b0 c0 b0 f1         y=2: b0 00 b0 b0 b0 20 b0 00     <- (0,2)=0xB0 = roca
y=3: 00 b1 00 b0 b0 c0 b0 b0         y=3: b0 00 00 00 b0 00 00 00
y=4: 00 00 00 f0 b0 c0 b0 f1         y=4: b0 b0 b0 00 b0 b0 b0 b0
y=5: b0 00 b0 b0 b0 b0 b0 b0         y=5: 20 b0 20 00 b0 20 b0 00
y=6: 51 00 51 f4 f0 b0 f1 f4         y=6: b0 b0 b0 b0 b0 b0 b0 00
y=7: b0 20 b0 b0 b0 b0 b0 b0         y=7: 00 00 b0 00 00 00 b0 00
```

Salas (0xF/0xA) por planta — COVETOUS: 8, 7, 7, 11, 12, 18, 4, 15 · DOOM: 1, 1, 3, 1, 1,
2, 4, 3.

Los 3 bytes en que el bloque arrastrado difiere de `DUNGEON.DAT` Doom virgen (y que
**confirman por bytes reales** la regla `&0xAF` derivada en 0x00F5):

| celda | virgen | en el save | lectura |
|-------|--------|------------|---------|
| f0 (1,1) | `0xF0` | `0xA0` | sala 0 de Doom despejada — **es la que jugó el testigo** |
| f2 (5,1) | `0xF3` | `0xA3` | sala 3 de Doom despejada |
| f2 (3,4) | `0xD0` | `0xE0` | puerta secreta revelada |

---

## 6. El port

`game/src/core/dungeon/dungeon.ts` **no arrastra copia de mapa**: `DungeonState` guarda un
`Map<location, DungeonData>` clonado de los datos de `DUNGEON.DAT` y sirve toda celda por
`dungeonCellAt(d, floor, x, y)` — fuente única compartida por `cellAt`, `buildGemView` y el
selector de teleport. Encima aplica `applyClearedRooms` (calco de `DNGLOOK 0x093A`) y los
`overrides` persistidos. **Consecuencia**: el port SIEMPRE usa la geometría auténtica de la
mazmorra donde estás; es estructuralmente inmune al confound del save-escenario, y por eso
un careo port↔original sobre un escenario envenenado divergiría por el instrumento, no por
el port. Las capturas `docs/verdicts/gem-glyphs/PORT_gem-doom-f6-*.png` son del **port en
Doom planta 6** (20-07, veredicto de glifos) y **no** son testigo de este asunto.

---

## 7. ★ El mecanismo EXACTO de la quimera: `dng_enter_room` (DUNGEON.OVL 0x0000)

La re-adjudicación `31d5910b` estableció que la sesión-testigo jugó «geografía de Doom +
contenido de Covetous». **Aquí está la derivación instrucción a instrucción de por qué eso
es posible**, leyendo el cuerpo entero de `DUNGEON.OVL 0x0000` (308 B):

```
0008: imprime DS:0x2c58 "Entering room...\n"
000f: g_dng_facing = [DS:0x2c76 + g_dng_anim_dir]   ; tabla = 0,1,2,3,0,2
                                                     ; (anim_dir 4=subir→N, 5=bajar→S)
0024: roomNo  = arg & 0x0F                          ; ← viene de la CELDA DEL MAPA
0032: g_active_char = g_cmb_actor = 0xFF            ; (guarda el previo en bp-2)
003a: dungIdx = g_location − 0x21                   ; ← viene de g_location
0043:           if (dungIdx >= 1) dungIdx--         ;   ★ el COLAPSO Deceit≡Despise
004b: cbtOff  = dungIdx*0x1600 + roomNo*0x160
005e: pone a cero 0x160 B en DS:0xAD14
006c: carga DUNGEON.CBT[cbtOff .. +0x160] en DS:0xAD14     ; DS:0x2c6a = "dungeon.cbt"
007e: g_unk_5894 = g_location ; salva x/y y 8+8 B de 0x5C62/0x5C6A en locales
00a8: g_location = 0xFF ; g_unk_58a0 = 0            ; centinela de combate
00b1: monta la arena (stub, args roomNo y 3) + 0xffffd740 ; g_unk_58a1 = 0x82
00c4: corre el combate ; si retorna 0 (victoria):
00de:    DNGLOOK 0x0844 → pone el bit de sala-despejada
00f5:    g_dng_map[celda de ENTRADA] &= 0xAF        ; 0xFn → 0xAn
0100: restaura x/y, g_location y los dos bloques de 8 B ; 0x0125 restaura g_active_char
```

★ **Las dos mitades del registro de sala vienen de fuentes DISTINTAS**: el **`roomNo` sale
del nibble bajo de la celda del mapa** (o sea, del búfer, o sea, del save envenenado) y el
**`dungIdx` sale de `g_location`** (o sea, de la etiqueta parcheada). Con un save que dice
Covetous y lleva los bytes de Doom, la sala `(1,1)` de Doom (`roomNo` 0) se combina con
`dungIdx` 3 (Covetous) y da el registro 48 = **combatmap 64**. La quimera no es un fallo:
es la composición literal de las dos fuentes.

**Corroboración independiente por el tamaño del fichero** (control positivo del colapso):
`DUNGEON.CBT` mide **39 424 B = exactamente 112 registros de 0x160** = **7 × 16**, no 8×16
(que necesitaría 45 056 B). Y el último offset alcanzable con la fórmula (Doom, sala 15)
termina en `0x9A00` = el tamaño exacto del fichero. ⇒ **el colapso Deceit≡Despise es DE
DISEÑO, no un bug del binario**: las dos mazmorras comparten físicamente los 16 registros
de sala. Esto confirma por datos lo que `dungeon.md §14.1.1` afirmaba por lectura de asm.

> ⚠ **Corrige una cita del propio ledger**: la entrada `DUNGEON.OVL:0` de
> `frontier-naming-sweep-20260725` da el offset como `(loc−0x21)*0x1600 + roomNo*0x160`,
> **sin el colapso**. Con esa fórmula Covetous daría base de combatmap 80; la medida de
> ch24 es 64. El `cmp ax,1 / jl / dec` de 0x0043-0x0048 está ahí y va ANTES del `imul`.
> (Segunda corrección menor: la tabla `DS:0x2c76` no es «la IDENTIDAD [0,1,2,3]» sino
> `[0,1,2,3,0,2]` — las dos últimas entradas importan porque `dng_change_level` pone
> `g_dng_anim_dir` a 4/5.)

Tabla derivada (`combatmap = 16 + dungIdx*16 + roomNo`), que cuadra con los carriles de
salas ya cerrados (ch22 Destard `32+roomNo`, ch24 Covetous `64+roomNo`):

| location | mazmorra | `dungIdx` | base de combatmap |
|----------|----------|-----------|-------------------|
| 0x21 | DECEIT | 0 | 16 |
| 0x22 | DESPISE | **0** (colapsada) | 16 |
| 0x23 | DESTARD | 1 | 32 |
| 0x24 | WRONG | 2 | 48 |
| 0x25 | COVETOUS | 3 | **64** |
| 0x26 | SHAME | 4 | 80 |
| 0x27 | HYTHLOTH | 5 | 96 |
| 0x28 | DOOM | 6 | 112 |

---

## Procedencia

Todo lo de §1-§4 y §7 leído de `re/disasm/` (cuerpos enteros, no resúmenes). Bases near-call por
overlay vía `re/tools/dispatch_table.overlay_near_call_base` (MAINOUT/DUNGEON 0x81D0,
**INTRO 0x81C0** por su cabecera de reloc, DNGLOOK 0xA290, CAST2 0xE1E0). Bytes de
`original/u5/ultima5/{DUNGEON.DAT,DATA.OVL,ULTIMA.EXE}` y de los `.GAM` de
`original/u5/saves-lib/` (sólo lectura). Ventana del save y `roster_off` de
`re/ledger/globals.json`.

---
## NOTA HISTÓRICA (orquestadora)

Entre las 19:40 y las 19:55 convivieron aquí DOS adjudicaciones de la §5: una adenda de
la orquestadora (d48405e3, escrita contra la §5 original) y la corrección en sitio del
propio carril (7244a420). Dicen lo mismo; se conserva la del carril (más completa, con
la corrección visible) y esta nota reemplaza a la adenda. Único dato que aportaba la
adenda y ya está integrado arriba: 0xD0→0xE0 = puerta secreta revelada (tabla de §6).
