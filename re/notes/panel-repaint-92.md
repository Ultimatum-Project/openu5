# #92 — La capa de repintado del panel: los 36 sitios ATRIBUIDOS y el corchete borra/pinta

Fecha: 2026-07-30. Estado: **derivación hecha**; la adjudicación queda reducida a UNA
pregunta del lado del port (§5). Todas las cifras de este acta son re-ejecutables con
`dispatch_table.near_calls_to_kernel` + `re/ledger/frontier.json`.

## 1. Censo, y DOS ceros en falso propios por el camino

**(a)** Primer intento: buscar `call 0x4daa` (y las otras cuatro) como texto en los `.asm`.
Dio **3 sitios**. Falso: desde un overlay el near-call al kernel **no lleva la dirección
cruda**, así que sólo salían los tres de `ULTIMA.EXE`. Con `near_calls_to_kernel`, que
resuelve por la base del overlay, salen **33 más**.

**(b)** Al atribuir cada sitio a su rutina, TODOS los dueños salieron `?`. La causa era mía:
`frontier.json` es un **dict** con la lista colgando de `routines`, y yo lo iteré directo —
iterar un dict devuelve sus **3 claves**, no las 885 rutinas. Índice vacío ⇒ «no lo sé»
disfrazado de «no está». Es la misma familia de siempre, ahora en la capa del *nivel del
JSON*: [[censo-global-hex-y-simbolo]] y [[set-de-json-ajeno-necesita-dos-controles]].

| pintor | kernel | sitios |
|---|---|---:|
| plaquita | `0x4DAA` | 9 |
| banda partida | `0x4E50` | 8 |
| pinta | `0x4F3C` | 6 |
| banda superior | `0x4E20` | 5 |
| borra (fill negro) | `0x4EFC` | 5 |
| | **total** | **33 overlay + 3 kernel = 36** |

Los 3 del kernel, leídos en el disasm: `2a18 call 0x4f3c` · `2db6 call 0x4e50` ·
`2e80 call 0x4e20`.

## 2. ★ Los 36 sitios caen en 15 rutinas, y TODAS son TOMAS DEL PANEL

Atribución **EXACTA** (dentro de `[start, start+size)`, ningún sitio por precedencia) y las
15 con estado `IDENT` en el ledger:

| overlay | rutina | sitios |
|---|---|---|
| ZSTATS | `draw_stat_page` | `008a` plaquita · `009b` banda-partida |
| ZSTATS | `draw_magic_or_equipment_panel` | `02ae` plaquita · `02bf` banda-partida |
| ZSTATS | `draw_provisions` | `039c` plaquita · `03a3` banda-partida |
| ZSTATS | `render_item_list` | `06f1` banda-partida · `0735` plaquita · `07d0` plaquita |
| ZSTATS | `cmd_zstats` | `0a69` borra · `0bd6` plaquita · `0bd9` banda-sup · `0bdc` pinta |
| ZSTATS | `item_picker_loop` | `1074` plaquita |
| ZSTATS | `cmd_ready` | `12d3` borra · `12e8` banda-partida · `12ff` plaquita · `1302` banda-sup · `1305` pinta |
| CAST | `use_item_command_dispatch` | `17cf` borra · `17dd` banda-partida · `17f8` plaquita · `17fb` banda-sup · `17fe` pinta |
| CMDS | `mix_select_reagents` | `1921` borra · `1928` banda-partida |
| CMDS | `cmd_mix` | `1c11` banda-sup · `1c14` pinta |
| SHOPPES | `blacksmith_sell_window` | `0f96` banda-partida · `1269` banda-sup |
| SHOPPES | `equipment_sell_scroll_list` | `0e46` pinta |
| SHOPPES3 | `inn_pick_up_companion` | `052d` borra · `0703` pinta |
| ULTIMA.EXE | `draw_status_panel` | `2a18` pinta |
| ULTIMA.EXE | `select_party_member` | `2db6` banda-partida · `2e80` banda-sup |

**Ni un llamante de fondo ni del bucle de juego**: las 15 son comandos que se APODERAN del
área del panel para mostrar otro contenido (stats, magia/equipo, provisiones, listas de
objeto, reactivos de Mix, listas de tienda, acompañantes de posada, elección de personaje).
⇒ La capa **no repinta por tiempo ni por evento del mundo, sino al TOMAR y al DEVOLVER**.

## 3. ★★ `borra` → contenido → `pinta` es un CORCHETE

Los cinco `borra` tienen cada uno su `pinta` en el mismo flujo:

| flujo | borra | pinta |
|---|---|---|
| `cmd_zstats` | `ZSTATS 0x0a69` | `ZSTATS 0x0bdc` |
| `cmd_ready` | `ZSTATS 0x12d3` | `ZSTATS 0x1305` |
| `use_item_command_dispatch` | `CAST 0x17cf` | `CAST 0x17fe` |
| Mix — abre el callee, cierra el caller (ver abajo) | `CMDS 0x1921` | `CMDS 0x1c14` |
| `inn_pick_up_companion` | `SHOPPES3 0x052d` | `SHOPPES3 0x0703` |

⇒ **`borra` = ENTRAR (limpiar el área), `pinta` = SALIR (devolver el chrome).** Los otros
tres pintores son el CONTENIDO del chrome dentro del corchete.

★ El de Mix cruza DOS rutinas, y eso sólo vale si una llama a la otra: **verificado**,
`cmd_mix` llama a `mix_select_reagents` en `CMDS 0x1b5d`, y el `pinta` de `0x1c14` está
DESPUÉS de esa llamada. O sea **el callee abre y el caller cierra** — mismo corchete,
repartido en dos marcos.

## 4. La asimetría que NO cuadra, declarada

`pinta` sale **6** veces y `borra` sólo **5**. El sexto es `SHOPPES 0x0e46`
(`equipment_sell_scroll_list`), y **en SHOPPES.OVL no hay ni un `borra`**: ese flujo
*devuelve* el chrome sin haberlo *limpiado* antes por esta vía. Lo dejo declarado sin
explicar: puede ser que la limpieza la haga otra rutina de tienda por otro camino, o que
el listado se pinte encima sin necesidad de fondo. **No lo he derivado, y no lo cuento
como parte del patrón.** Mismo trato para `draw_status_panel 0x2a18`, un `pinta` suelto.

## 5. Lo que queda: UNA pregunta, no 36

El port pinta el marco una vez y compone encima. Con §3 en la mano, la equivalencia se juega
en una sola cosa: **¿re-renderiza el port el panel al CERRAR un modal que se apoderó del
área?** Si el compositor lo repinta cada fotograma (o al cerrarse el modal), el corchete
`borra…pinta` está cubierto por construcción y esto es EQUIVALENCIA, no hueco. Si algún
modal puede cerrarse dejando residuo, ahí está el hueco — y sería visible.

⚠ Eso **no se resuelve leyendo más ASM**: es una comprobación del port y, con el HOLD de e2e
vivo, no la ejecuto. Lo que queda establecido y no hay que volver a derivar: los 36 sitios,
sus 15 rutinas, y que el patrón es un corchete de toma/devolución con la asimetría de §4.

★ Y se confirma la nota de alcance que la tarjeta arrastraba: **«0x637E FIEL» cubre el marco
INICIAL**. Los repintados son OTRAS cinco rutinas con 36 call-sites; titular «chrome FIEL»
sin distinguirlas sería citar de más.
