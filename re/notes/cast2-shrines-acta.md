# CAST2.OVL — `prompt_direction_seed_target` y `enter_shrine_scene_dispatch`

Banda del lead sobre `main = ea0033eb` (guarda del reparto: 0 represadas). Eran **tres**
filas; entrego **dos**, y la tercera **no la he empezado** — §3.

| fila | B decl. | B reales | línea EN el start | estado |
|---|---|---|---|---|
| `CAST2.OVL:0x0306` `prompt_direction_seed_target` | 188 | 188 | sí | ✅ cuerpo entero |
| `CAST2.OVL:0x0e76` `enter_shrine_scene_dispatch` | 648 | 648 | sí | ✅ cuerpo entero |
| `CAST2.OVL:0x0966` `shrine_visit` | 958 | — | — | ❌ **NO LEÍDA** |

---

## 1. `0x0306` `prompt_direction_seed_target` — y la pregunta abierta, cerrada con más precisión de la que tenía la sospecha

`[0x0306, 0x03c2)`. El nombre es exacto **en sus dos mitades, y el orden importa: primero
SIEMBRA, después PREGUNTA.**

```
030e  g_location > 0x7f (combate)  ⇒ si = g_cmb_actor<<3
        g_cmb_scratch_x = byte[si-0x45e6] ; g_cmb_scratch_y = byte[si-0x45e5]
032e  si no (<= 0x7f)              ⇒ g_cmb_scratch_x/_y = g_party_x / g_party_y
033e  print_string(DS 0x9504 "Direction-")
0347  bucle: ax = getkey_with_redraw()
        1 → "West\n"  (0x9526) + dec x        3 → "North\n" (0x9510) + dec y
        2 → "East\n"  (0x9518) + inc x        4 → "South\n" (0x951e) + inc y
        0x20 ESPACIO → "Pass\n" (0x952c) y di = 0
        otra tecla   → si = 0 ⇒ VUELVE A PREGUNTAR (0x0377 `or si,si / jne`)
03ba  devuelve di = 1..4, o 0 si se pasó       ([bp-4] y [bp-2] son almacenes MUERTOS)
```

### 1.1 La pregunta que dejó abierta `bugs-original`, respondida

Su formulación fue: *«si al cancelar deja `g_cmb_scratch_x/_y` rancio — estructuralmente
sugerido pero NO medido»*, y pidió que no se publicara como consecuencia hasta que alguien
leyera esta rutina. **Leída: la respuesta es NO, y es más precisa que la sospecha.**

No quedan **rancios de una invocación anterior**: quedan **bien definidos, en la celda del
propio lanzador**. La siembra de `0x030e-0x033b` es **incondicional** y ocurre **antes** del
prompt, y el camino de ESPACIO (`0x03a8`) no toca ninguna de las dos coordenadas.

### 1.2 🔴 Pero la consecuencia compuesta es PEOR que «rancio», y es observable

El worker `magic_door_open_worker` (CAST2 `0x0768`, sellada por otro carril — cuerpo releído
aquí para poder componer) hace:

```
076e  call 0x306
0771  or ax,ax / jne 0x77a
0775  ax = 0xFFFF ; salir          ← CANCELADO devuelve 0xFFFF
077a  get_tile_ptr(g_cmb_scratch_x, g_cmb_scratch_y) → bx
0793  *bx == 0x97 → *bx = 0xB8 ; g_unk_24e6 |= 2 ; devuelve 1
0798  *bx == 0x98 → *bx = 0xBA ; idem
079d  ninguno              → devuelve 0
```

Y el llamador de la Skull Key (`CAST.OVL:0x18dd`) lee ese retorno con `or ax,ax / jne` — la
**ceguera complementaria** que ya está fichada. Componiendo:

> **Pasar (ESPACIO) en el prompt de dirección de la Skull Key gasta la llave Y dispara el
> efecto de celda SOBRE LA CASILLA DEL PROPIO GRUPO.**

Porque `0xFFFF != 0` ⇒ el `jne` de `0x18e5` continúa; `0x18ea` deja pasar cuando
`g_location < 0x80`; y `0x18f4` empuja `g_cmb_scratch_x/_y` —que valen la celda del
lanzador— a `explosion_fx_at_cell` (kernel `0x3522`). El jugador ve «Skull Key», el efecto
en su propia casilla, y **ningún mensaje de error**: `[bp-0xa]` sigue en 1, así que la cola
del despachador tampoco emite «Failed!».

⚠️ **Alcance declarado**: no he abierto `explosion_fx_at_cell` (kernel `0x3522`), así que
digo «efecto de celda» y no describo qué pinta. Lo que está medido es **a qué coordenadas se
lo pasan**.

**Port-check (verificado, no inferido)**: `game/src/core/game.ts` `useSkullKey` hace
`if (!dir) return events;` **después** del `skullKeys--` y **sin** efecto. O sea: el clon
gasta la llave —fiel— pero **no dibuja nada** —divergencia—. Es presentación pura y **no
mueve stream**. No la arreglo: es conducta observable y la decide el lead.

---

## 2. `0x0e76` `enter_shrine_scene_dispatch` — la deuda de `cola-sellos`, cerrada por los DOS extremos

`[0x0e76, 0x10fe)`. `cola-sellos` rechazó esta fila porque la cita cubría el **respaldo** y no
la **restauración** (`0x1075-0x10fd`: rampa, los 32 slots y `g_location`). Los dos pares están
ahora leídos por sus dos extremos:

| par | respaldo | restauración |
|---|---|---|
| **32 slots de actor** | `0x0eae-0x0ed0`: 8 B de `0x5c5a` → `0xa9fc`, **y pone a 0 el slot vivo** (`mov byte [si],0`, `0x0ec3`), hasta `si >= 0x5d5a` ⇒ **(0x5d5a−0x5c5a)/8 = 32** | `0x10cb-0x10e5`: `0xa9fc` → `0x5c5a` hasta `si >= 0xaafc` ⇒ los mismos 32 |
| **localización** | `0x0e9e`: `byte[0xbd15] = g_location`; luego `g_location = 0xFF` y `g_cmb_actor = 0xFF` | `0x10e7`: `g_location = byte[0xbd15]` |

El `0xFF` no es decorativo: es lo que pone a `spectacle_cue` (CAST2 `0x0e64`, cuyo propio
nombre en el ledger declara «location=0xff spell handler») en su régimen, y se le llama cinco
veces desde aquí (`0x0f83`, `0x0fa1`, `0x1060`, `0x10a0`, `0x10b9`).

### 2.1 El tile bajo el grupo es el DISCRIMINANTE de toda la rutina

`[bp-4]` = tile bajo `(g_party_x, g_party_y)` (`0x0e8d`, `get_tile_ptr`). Se compara con
**`0x11`** en **cinco** sitios (`0x0ed2`, `0x0f69`, `0x0fa4`, `0x103c`, `0x1066`), y el
destino final lo adjudica sin ambigüedad:

- tile **≠ 0x11** → `0x106c` `call 0x966` = **`shrine_visit`** ⇒ **santuario**
- tile **= 0x11** → `0x1072` `call 0xd24` = **`codex_read_lesson_ceremony`** ⇒ **Codex**

Y el mismo bit gobierna todo lo demás: el **offset del fichero de escena** (`MISCMAPS.DAT`,
0xb0 B a `0xac64`, **offset `0xb0` santuario / `0x160` Codex**), la cadena que se imprime, el
bloque de urnas, y el número de fotogramas de bajada (**4 santuario / 7 Codex**).

### 2.2 ⚠️ TRAMPA DE ARTEFACTO: dos «cadenas» que NO están en DATA.OVL

`0x0f6f`/`0x0f74` pasan `0xb8cc` / `0xb8f9` a `print_string`. Descodificadas contra
`DATA.OVL` con el mapa habitual (`+0x10`) dan **cadena VACÍA** — que se lee como «no imprime
nada» y es **falso**. Son punteros al búfer `0x b21e..0xb9ee` que la propia rutina acaba de
llenar desde **`MISCMSG.DAT`** (`0x0f09`: 0x7d0 B a `0xb21e`, offset 0x3ab).

**Regla**: antes de descodificar un `DS:0x....` contra `DATA.OVL`, comprueba si la rutina ha
cargado un fichero en ese rango. Es la familia de esta noche —descodificar contra el
artefacto equivocado— con un disfraz nuevo: aquí el resultado no es basura, es **vacío**, que
parece un hallazgo.

### 2.3 Singular/plural, medido

`0x0f49-0x0f5e` cuenta las entradas de `0x55e7` a `0x57c7` (stride `0x20`) cuyo byte vale
`0x7f` → `[bp-6]`. En la rama Codex, si la cuenta es > 0: imprime DS `0x9624`
«Thou dost see» y luego **DS `0x9636` «an urn marked:» si vale 1, DS `0x9648`
«urns marked:» si vale más**. Cero RNG en todo el cuerpo.

---

## 3. Lo que NO he leído — declarado, no insinuado

**`CAST2.OVL:0x0966` `shrine_visit` (958 B): NO LA HE EMPEZADO.** No está medio leída ni
«leída por encima»: no la he abierto. La dejo entera para quien la coja, y **no firmo nada
sobre su contenido** — ni siquiera lo que se podría inferir de que `0x0e76` la llame en la
rama de santuario.

Otras, con el estado del ledger al lado (misma forma que el §7 corregido de
`skullkey-alcanzabilidad.md`, para que el filtro no se despegue del resultado):

| rutina | ¿la he leído YO? | ledger |
|---|---|---|
| `CAST2.OVL:0x0966` `shrine_visit` | **no** | ⬜ `verified=false` — **es mi fila pendiente** |
| `CAST2.OVL:0x0d24` `codex_read_lesson_ceremony` | no | (no comprobado) |
| `CAST2.OVL:0x0e64` `spectacle_cue` | no | (no comprobado) |
| `CAST2.OVL:0x0914` `table_driven_summoner` | no | (no comprobado) |
| `ULTIMA.EXE:0x3522` `explosion_fx_at_cell` | no | (no comprobado) |
| `CAST2.OVL:0x0768` `magic_door_open_worker` | **sí, releída aquí** para poder componer §1.2 | ✅ `verified=true` (sellada por otro carril) |
