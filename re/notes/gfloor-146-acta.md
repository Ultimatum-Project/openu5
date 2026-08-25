# ACTA #146 — los dos selectores de `g_floor` discrepan en 1..0x7F, y ese rango es INALCANZABLE en exterior: REFUTADA

Carril `fix-146`, rama `fix/146-selectores-gfloor`. Sujeto: **el binario** (`ULTIMA.EXE`
y overlays; datos `DUNGEON.DAT`). Todas las direcciones de overlay son offsets de
fichero del `.asm` correspondiente; las del kernel, offsets de imagen de `ULTIMA.EXE`.
`g_floor` = DS `0x5895` (`re/ledger/globals.json`, addr 22677).

**Veredicto**: la discrepancia EXISTE en el código tal como la enuncia la ficha, pero el
rango que discrimina (`g_floor` ∈ 1..0x7F **con `g_location == 0`**) no lo produce
ningún camino del juego con los datos distribuidos. El único acuñador posible —la cadena
del pozo en planta-byte 7— está **muerto por datos**: 0 pozos en la planta-byte 7 de las
8 mazmorras. La discrepancia es benigna. De propina queda derivado lo que la ficha pedía
como hueco: **el ciclo completo de lectura/escritura de los `.OOL`**.

---

## 1. Los dos selectores, leídos en crudo

| rutina | predicado | rama ≤/== | rama >/!= |
|---|---|---|---|
| `outdoor_viewport_chunk_load`, `OUTSUBS.OVL:0x01e1` | `803e95587f cmp byte [g_floor],0x7f` / `7608 jbe 0x1f0` | ≤0x7f → DS `0x3980` **BRIT.DAT** | >0x7f → DS `0x3976` **UNDER.DAT** |
| `outsubs_world_filename`, `OUTSUBS.OVL:0x036e` | `803e955800 cmp byte [g_floor],0` / `7507 jne 0x37c` | ==0 → DS `0x3989` **BRIT.OOL** | !=0 → DS `0x3992` **UNDER.OOL** |

(Cadenas resueltas con `dispatch_table._resolve_string`.) Coinciden en {0, 0xFF} y
discrepan en todo 1..0x7F: terreno de Britannia con fichero de actores del Underworld.

Un tercer predicado de la misma familia, para la luz: kernel `0x50ba`
`cmp byte [g_floor],0x7f / ja` (Underworld = oscuridad), estilo `>0x7f`. Y un cuarto,
el del sextante (`use-merchants.md:65`, `g_floor<=0x7f`). El binario mezcla los dos
estilos por todo el código; sólo son equivalentes si el dominio es {0, 0xFF}.

## 2. El ciclo de vida de los `.OOL` — la lectura que faltaba

Censo COMPLETO por dos vías que cierran una a la otra: (a) las 17 referencias a cadenas
`*.OOL` de DATA.OVL (`0x323f/0x3249/0x3252/0x3266/0x334e/0x3641/0x3989/0x3992/0x39de/
0x39e7/0x39fb/0x967a/0x9684/0x968e/0x96a2/0xa0c2/0xa0cc`, grep de cada offset sobre los
28 `.asm` — 17/17 localizadas); (b) los llamadores de `outsubs_world_filename` (stub
`0x7a22`): **SIETE**, no los dos del acta madre (§5).

La tabla viva de actores del exterior es DS `0x5c5a` (32 ranuras × 8 B = 0x100), que
viaja DENTRO de la ventana de SAVED.GAM (`[0x55a6,0x6606)`). Los `.OOL` son el aparcadero
en disco del mundo en el que NO estás:

**Lecturas hacia `0x5c5a`** (rutina kernel `read_file_block_with_disk_retry 0x256e`):

- **kernel `0x012d`→`0x013c`** — el bucle de despacho de contexto (`0x00b8-0x0177`): al
  VOLVER de un overlay de pueblo o mazmorra, espera BRIT.DAT (DS `0x1393`), llama
  `world_filename(g_floor)` y lee `0x100` B en `0x5c5a`. **Toda salida de
  pueblo/mazmorra al exterior recarga la tabla con el predicado `==0`.** Si además
  `g_location==0 && g_floor!=0` (exterior del Underworld), `0x015f`→`0x016b` re-escribe
  esa tabla al UNDER.OOL del disco 5 (selector de volumen `0x251e(5)` + espera de
  UNDER.DAT DS `0x139c`).
- **kernel `0x4889`→`0x4898`** — teleport de moongate exterior→exterior
  (`nueva g_location==0 && vieja==0`, gate en `0x487c-0x4887`): `world_filename` con el
  g_floor NUEVO (escrito en `0x4856` desde la tabla de destinos `[bx+0x5848]`, valores
  0/0xFF) y lectura a `0x5c5a`; después stub `0x7b7e` → `MAINOUT:0x0` (reinit exterior).
  Antes, en `0x4823`→`0x482f`, había ESCRITO la tabla al `.OOL` del g_floor VIEJO.
- **`OUTSUBS.OVL:0x0538`** — la catarata (`0x0458`, «F-A-L-L-S!!!» DS `0x39b5`): escribe
  `g_floor=0xFF` (`0x0515`), vuelca la tabla a **BRIT.OOL cableado** (DS `0x39de`,
  `0x0526`), lee **UNDER.OOL cableado** (DS `0x39e7`) en `0x5c5a`, y tras la espera de
  UNDER.DAT (disco 5) re-escribe UNDER.OOL (DS `0x39fb`, `0x0559`). Aquí NO usa el
  selector: nombres cableados, porque escribe el mundo viejo DESPUÉS de mutar `g_floor`.

**Escrituras desde `0x5c5a`** (kernel `write_whole_file_with_disk_retry 0x25d8`, 3 args):

- `OUTSUBS.OVL:0x040c`→`0x0418` — entrar a localización por coordenadas (`0x0388`):
  vuelca la tabla al `.OOL` del mundo actual ANTES de `g_location=idx+1` (`0x0420`) y
  `g_floor=0` (`0x0423`).
- `MAINOUT.OVL:0x0857`→`0x0863` — entrar a mazmorra: ídem antes del cambio.
- `MAINOUT.OVL:0x0ae1`→`0x0aed` — rama `resultado==-1` del bucle exterior.
- kernel `0x4823` (moongate, mundo viejo) y `0x015f` (espejo a disco 5), ya citados.

**Empaquetado** — `SAVED.OOL` = 512 B = bloque BRIT (256) ++ bloque UNDER (256), como
derivó `oracle-pending-sweep.md` §B; aquí quedan leídos sus DOS extremos:

- `INTRO.OVL:0x0f26-0x0f89` (Journey Onward): lee SAVED.OOL (0x200 → buffer `0xb21e`),
  escribe las mitades a BRIT.OOL (`0xb21e`) y UNDER.OOL (`0xb31e`); si el save está en
  exterior con `g_floor!=0` (predicado `==0` otra vez, `0x0f64`), re-escribe UNDER.OOL
  al disco 5 (`0x0f7d-0x0f89`).
- `CAST2.OVL:0x113e-0x11a3` (guardar, «Saving...» DS `0x966a`): lee UNDER.OOL→`0xb31e` y
  BRIT.OOL→`0xb21e`, escribe SAVED.GAM (`0x55a6`, `0x1060` B — la tabla viva viaja ahí) y
  SAVED.OOL (`0xb21e`, `0x200`).
- `FONT.OVL:0x0de7/0x0e1f` (partida nueva): siembra desde INIT.OOL (DS `0xa0c2`) a
  SAVED.OOL (DS `0xa0cc`).

## 3. Censo de escritores de `g_floor` — quién puede acuñar 1..0x7F en exterior

24 instrucciones con `[g_floor]` como DESTINO en los 28 `.asm` (grep de
`mov/inc/dec/add byte ptr [g_floor]`; el resto de las ~190 refs son lecturas —
verificado clasificando los 11 overlays lectores: sólo `mov al/bl/dl/si,` y `cmp`).

Vías que aterrizan en `g_location==0`, y qué `g_floor` dejan:

| vía | escritor | valor |
|---|---|---|
| salir de pueblo (Y a la pregunta, `TOWN:0x07b9`) | `TOWN:0x07d3` / `0x07e1` | 0xFF si `g_location==0x19`, si no 0 |
| salir de mazmorra (`dng_exit`, `DUNGEON:0x1d08`) | `0x1d2c` / `0x1d36` | `g_floor!=0` → 0xFF; `==0` → 0 |
| klimb en escalera de mazmorra fuera de rango | `DNGLOOK:0x1089`, `DUNGEON:0x1dce` | llaman `dng_exit` (stub `0x7c9e`) → 0/0xFF |
| moongate | kernel `0x4856` | tabla `[0x5848]`: 0/0xFF (globals.json) |
| remolino | `MAINOUT:0x12b2` | 0xFF |
| catarata | `OUTSUBS:0x0515` | 0xFF |
| retorno de combate/escena | kernel `0x608e`, y `g_location` en `0x6094` | RESTAURA el par guardado (pre-combate) |
| cárcel (despertar a las 8) | `TOWN:0x1337` | 0 |

Los inc/dec/add están todos acotados al dominio de su contexto: mazmorra
`change_level DUNGEON:0x1c8d` (delta>0 y piso 7 ⇒ ret 1 sin tocar; delta<0 y 0 ídem),
escaleras `DUNGEON:0x1dbf/0x1df3` (fuera de rango ⇒ `dng_exit`), `DNGLOOK:0x1070/0x1082`
(ídem), pueblo `TOWN:0x0548/0x0566/0x103c` (dominio de pueblo, y la salida lo pisa).
`BLCKTHRN:0x0c0e` escribe 1 — planta 1 del palacio, contexto `g_location!=0`.

**El único que rompe la cota**: `dng_pit_fall`, `DUNGEON.OVL:0x0a4c` — celda `0x61`/`0x69`
(pozo) con `g_floor<8` (`0x0a6e`) ⇒ `inc g_floor` (`0x0aa4`); desde planta-byte 7 deja 8,
y `0x0af0-0x0af7` (`cmp g_floor,8` ⇒ `g_location=0`) expulsa del bucle de mazmorra
(`0x0f47/0x0f87`) **sin pasar por `dng_exit`** — sin normalizar a 0xFF.

## 4. La cadena del pozo está muerta POR DATOS: 0 pozos en planta-byte 7

Derivación del formato desde el propio código: `MAINOUT:0x0879-0x0884` lee
`DUNGEON.DAT` a `0x595a` con offset `(idx<<9)-0x4000` y tamaño `0x200` ⇒ 8 mazmorras ×
512 B; el indexado de celda es `planta<<6 + y<<3 + x` (`DUNGEON:0x0a8f-0x0a9f`, y ≥12
sitios más según globals.json) ⇒ 8 plantas × 64 celdas × 1 B. El predicado de pozo es
**exacto** (`0x0a5f-0x0a69`: `cmp 0x61 / je · cmp 0x69 / je`), y el runtime no puede
acuñar uno: las únicas mutaciones del mapa vivo son `and 0xf8` (`0x0a9f` — 0x61→0x60) y
`or 8` (`0x0abd` — sólo re-marca un 0x61 ya existente como 0x69).

Censo sobre `original/u5/ultima5/DUNGEON.DAT` (4096 B), celdas ∈ {0x61,0x69} por
mazmorra y planta-byte:

| mazmorra (loc) | p0 | p1 | p2 | p3 | p4 | p5 | p6 | **p7** |
|---|---|---|---|---|---|---|---|---|
| Deceit (0x21) | 10 | 7 | 6 | 5 | 1 | 2 | 4 | **0** |
| Despise (0x22) | 4 | 1 | 1 | 2 | 0 | 0 | 0 | **0** |
| Destard (0x23) | 0 | 0 | 0 | 0 | 0 | 0 | 0 | **0** |
| Wrong (0x24) | 0 | 4 | 0 | 0 | 0 | 2 | 0 | **0** |
| Covetous (0x25) | 0 | 0 | 0 | 0 | 0 | 0 | 0 | **0** |
| Shame (0x26) | 0 | 2 | 0 | 1 | 0 | 0 | 0 | **0** |
| Hythloth (0x27) | 0 | 0 | 0 | 0 | 0 | 0 | 0 | **0** |
| Doom (0x28) | 0 | 0 | 0 | 6 | 0 | 0 | 7 | **0** |

**Columna p7 = 0 en las ocho.** El encadenado (caer varios pozos seguidos) no ayuda:
cada salto exige pozo en la celda de ATERRIZAJE, y llegar a 8 exige pozo EN la planta 7.
⇒ `g_floor=8` no ocurre; ningún otro escritor produce 1..0x7F con `g_location=0`
(tabla de §3). **La ficha queda REFUTADA: discrepancia real, rango muerto.**

Nota de alcance: esto también deja **muerta por datos** la «cadena de alcanzabilidad
del pozo del Underworld» cuyo censo de datos pedía la ficha **#145** (mismo censo,
misma columna p7). Lo adjudica el lead sobre esa ficha.

La conducta que HABRÍA con `g_floor=8`, para el registro (derivada, no especulada): al
salir la mazmorra el bucle de despacho recarga actores con `world_filename(8)` ⇒
**UNDER.OOL** (kernel `0x013c`), y el viewport pide `8<=0x7f` ⇒ **BRIT.DAT**
(`OUTSUBS:0x01e1`): exactamente el mundo mezclado del enunciado, con luz de día
(kernel `0x50ba`: `8>0x7f` falso).

## 5. Correcciones al acta madre (`moonstone-loc-y-pozo-doom.md` §2.4)

- «Los dos llamadores de `outsubs_world_filename` que hay… son ESCRITURAS»: el censo con
  `near_calls_to_kernel` sólo veía overlays. Son **SIETE** llamadores: los 2 de MAINOUT
  + 1 near interno (`OUTSUBS:0x040c`, ya señalado por `oracle-pending-sweep.md`) + **4
  del kernel** (`0x012d`R, `0x015f`W, `0x4823`W, `0x4889`R), invisibles a ese censo
  porque el kernel llama al stub `0x7a22` con `call` near propio.
- «No he leído el sitio de LECTURA de los `.OOL`, así que no afirmo qué pasa al
  recargar»: superado — §2 y §4 lo dejan leído y adjudicado.

## 6. Careo del port — semántica canónica, coincidente en todo lo alcanzable

El port usa UN predicado (`floor === 0xff` ⇔ Underworld) y dominio exterior {0, 0xFF}:

- terreno: `game/src/core/world/map.ts:61-64` (`getActiveMap`, `isUnderworld = floor === 0xff`);
- actores/objetos: match exacto de planta — `game/src/core/game.ts:1218`
  (`worldObjectAt`), `:1235` (`lootAt`), `:3255-3257` (moongates por `z===0xff`),
  `game/src/core/world/actorPool.ts:207-` (`composeWorldPool` recibe el floor vivo);
- escritores exteriores: catarata `game/src/core/game.ts:1999` (`pos.floor = 0xff`,
  cita `OUTSUBS 0x0515`), remolino `game/src/core/world/loops/hazards.ts:185`
  (`WHIRLPOOL_UNDERWORLD.floor = 0xff`, coords 0x22,0x12 = `MAINOUT:0x12b7-0x12bc`),
  moongates `game/src/core/game.ts:3135/3197` (`dest.z === 0xff ? 0xff : 0` = tabla
  `0x5848`), salida de mazmorra `game/src/core/dungeon/dungeon-cmds.ts:441-465`
  (`exitDungeonTo`, `floor: underworld ? 0xff : 0` = `DUNGEON:0x1d25-0x1d3b`).
- El caso muerto del pozo el port lo CANONIZA: caer más allá del fondo emite
  `exit-underworld` (`game/src/core/dungeon/dungeon.ts:1500-1505`) ⇒ `floor=0xff` — la
  semántica del `dng_exit`, no el `g_floor=8` crudo del binario. Divergencia
  **inobservable** (el disparador tiene población 0 en los datos, §4): no se toca.

No hay fix que hacer: el port coincide con el binario en todo el dominio alcanzable y
no reproduce (ni necesita reproducir) el estado fantasma de un camino muerto.

## 7. Residuo declarado (NO derivado aquí)

El **remolino** (`MAINOUT:0x126e-0x12c4`) muta `g_floor=0xFF` y reinicializa el modo
exterior (`call 0` = `MAINOUT:0x0`) **sin volcar/recargar los `.OOL` en el propio
sitio**, al contrario que la catarata (§2). Si el flujo no vuelve por el bucle de
despacho del kernel antes del siguiente uso de la tabla, la tabla viva seguiría siendo
la de Britannia bajo `g_floor=0xFF` (y el primer volcado la escribiría sobre
UNDER.OOL). Queda como cabo: derivar el camino de retorno del remolino y carear si el
binario intercambia la tabla — candidato a ficha propia si alguien lo confirma.
