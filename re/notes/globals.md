# Diccionario de globals del kernel (Task 1.2 — la piedra Rosetta)

Los 24 overlays referencian las variables globales del kernel por
dirección absoluta DS-relativa (operandos `[0x5xxx]` en el asm). El
diccionario `re/ledger/globals.json` da nombre, tamaño, significado y
**evidencia** a esas direcciones; `re/tools/globals_map.py` lo carga y
`disasm.to_asm(file, globals_map.GLOBALS)` anota los desensamblados
(`npm run re:disasm`).

## Por qué funciona: SAVED.GAM se carga verbatim y ES el estado vivo

El kernel copia `SAVED.GAM` (4192 B = 0x1060) tal cual a RAM al elegir
"Journey Onward". El oráculo (Task 0.3) localiza ese bloque en cada boot
(`Session.roster_off`); con la config determinista cae SIEMPRE en:

```
game_ds   = 0x1788          (DS del kernel)
roster_off = 0x55A6         (DS-relativo; ventana 0x55A6..0x6605)
```

Verificado en vivo (sonda del 2026-07-09): 4183/4192 bytes de la ventana
idénticos al fichero justo tras cargar (los 9 restantes son contadores
que ya evolucionaron durante la estabilización: 0x2DE-0x2E0, 0x2FF,
0x3B2, 0x6B4-0x6B7), y el juego **usa ese mismo bloque como estado
vivo**: el minuto (+0x2DB), el contador de turnos (+0x2E5), las
coordenadas (+0x2F0/+0x2F1) y la hora (+0x2D9) cambian ahí al jugar.

De ahí el método (1) del mapeo: **cada campo documentado del layout de
SAVED.GAM (docs/formats/tlk-npc-dataovl-gam.md §4) es un global del
kernel en `roster_off + offset`**. La tabla `ROSTER_LAYOUT` de
`globals_map.py` codifica ese layout; `build_roster_entries(0x55A6)`
genera las entradas correspondientes de globals.json.

## Método (resumen)

1. **Mapeo por roster** (el grueso): layout documentado del save +
   `roster_off` ⇒ nombre inmediato para ~50 campos/arrays (party
   records, inventario, reloj, karma, posición, bitmaps de NPC...).
2. **Censo de referencias cross-overlay**: se desensamblan los 23
   overlays de código + el kernel (capstone, `disasm.py`) y se cuentan
   los operandos absolutos `[0xADDR]` por dirección y por fichero. Las
   direcciones más compartidas son los globals de verdad del kernel.
   El censo VALIDA el mapeo: las direcciones más calientes caen exactas
   sobre campos documentados (p.ej. `0x5893` = roster+0x2ED =
   `g_location`, referenciada por 20 de 24 ficheros; `0x585B` =
   +0x2B5 = `g_party_size`, 16 ficheros; `0x587F` = +0x2D9 = `g_hour`).
3. **Confirmación en vivo (oráculo DOSBox)**: acciones controladas y
   lectura de RAM anclada a eventos emulados:
   - mover al party ⇒ cambia la coordenada (g_party_x/g_party_y);
   - pasar turnos (Space) ⇒ avanza g_minute +1/turno y g_turn_count;
   - cruzar el rollover del minuto 59→0 ⇒ incrementa g_hour;
   - un movimiento BLOQUEADO consume turno (minuto+1) sin mover — por
     eso las sondas de posición se anclan al minuto, no a la coordenada.
4. **Lo no identificado NO se bautiza**: direcciones referenciadas por
   ≥3 ficheros sin campo documentado ni observación concluyente entran
   como `g_unk_<addr>` con meaning "pendiente" (mejor sin nombre que con
   un nombre especulativo: un global mal nombrado corrompería cada
   fórmula re-derivada del asm que lo use).

## Evidencia de cada entrada

Cada entrada de globals.json lleva su cadena de evidencia:

- `"roster_off(0x55A6)+0xNNN per docs/formats/tlk-npc-dataovl-gam.md §4"`
  — derivada del layout documentado del save (copia verbatim verificada).
- `"observed: ..."` — confirmación en vivo (sonda DOSBox, con fecha).
- `"referenciada por N ficheros (...)"` — censo de refs (entradas g_unk).

## Cómo extender el mapa

1. **Nuevo campo del save documentado**: añadir la fila a
   `ROSTER_LAYOUT` en `globals_map.py`, regenerar la entrada
   (`build_roster_entries`) y actualizar globals.json.
2. **Dar semántica a un `g_unk_XXXX`**: diseñar una sonda (acción
   controlada en el oráculo + lectura antes/después, o lectura del asm
   que la usa), renombrar la entrada y REEMPLAZAR la evidencia por la
   observación. No cambiar el nombre sin evidencia.
3. Regenerar los asm anotados: `npm run re:disasm`.
4. `cd re/tools && python3 -m pytest -q test_globals.py` (valida el mapa
   estáticamente: núcleo nombrado, sin solapes, sin duplicados).

Las sondas usadas (dumps DS completos por etapa + diffs) viven en el
scratchpad de la sesión de Task 1.2; el log de la sonda está resumido en
el informe `.superpowers/sdd/task-1.2-report.md`.

Ejemplo (Task 3.4, vía asm): renombrados desde `g_unk_*` con evidencia de
DUNGEON/DNGLOOK — `g_dng_facing@0x6603` (0=N,1=E,2=S,3=O), `g_dng_anim_dir@0x6602`,
`g_dng_wall_variant@0x6604`, y añadido `g_dng_map@0x595A` (mapa 8×8×8, 512 B, en
la ventana SAVED.GAM). Citas en `re/notes/dungeon.md §0`.

Ejemplo (Task 3.5, vía asm NPC.OVL): región de NPCs de small map —
`g_npc_sched@0x5D5E` (horarios, 16 B/NPC), `g_npc_rt@0x5F5E` (structs runtime,
16 B/NPC), `g_npc_pathbuf@0x615E` (buffer de ruta 32×16×2), `g_npc_path@0x655E`
(puntero de ruta word/NPC), `g_npc_type_tbl@0x659E` (sprite type), `g_npc_stuck@0x65C2`
(contador atasco), `g_npc_attack_tile@0x65BE`, y `g_npc_passable_bitmap@0x367E`
(bitmap de transitabilidad, `bit = 0x80>>(tile&7)`). Citas en `re/notes/npc.md §0/§3`.

Task 3.7 (transporte/náutica) confirmó/bautizó vía asm MAINOUT/CMDS/kernel:
`g_wind@0x5892` (0=Calm,1=N,2=S,3=E,4=O; único escritor set_wind kernel 0x2EA2),
`g_wind_drift_ctr@0x5883` (cadencia de deriva, reset en set_wind 0x2EA5),
`g_wind_enabled@0x5891` (gate del wind-tick en el world-turn; Time-stop→0),
`g_sail_dir@0x5955` (rumbo 0=parado,1=O,2=E,3=N,4=S), `g_ship_dock_x/y@0x5953/0x5954`
(muelle del shipwright), `g_hms_cape@0x57BB` (gate `>0x7F` = mitad de coste naval),
`g_cape_toggle@0xA524` (alterna el world-turn naval con el Cape), y la tabla de
objetos del mundo `g_world_objects@0x5C5A` (stride 8) con el vehículo activo en
`g_hull@0x5C5F` (obj+5, casco 0..99) y `g_skiffs@0x5C61` (obj+7). Citas en
`re/notes/transport.md §0/§4`.

Task 3.6 (tiendas) añadió al diccionario los scratch de SHOPPES: `g_shoppe_id@0xB114`
(índice de ciudad dentro del tipo), `g_shop_accum@0xB118` (regateo b118),
`g_shop_qty@0xB11A`, `g_shop2_type@0xBD16`, `g_cups_served@0xBD20` (servicios
comida+bebida), `g_ship_flags@0x6605`, `g_drunk_timer@0x5957`,
`g_shadowlord_here_idx@0x5958` (índice del Shadowlord presente en la ciudad; gate de
la merma 0x019A con ==0 = Falsehood) y `g_shadowlord_locs@0x58C8` (localización de
los 3 Shadowlords, lo escribe TOWN.OVL). Citas en `re/notes/shops.md §0/§7/§Globals`.

## Límites conocidos

- Las direcciones son válidas para ESTA config determinista del oráculo
  (mismo DOS, misma memoria). `roster_off` es estable entre boots
  (verificado en Task 0.3 y re-verificado aquí); si algún día cambiara
  la config de arranque, basta re-derivar `roster_off` y regenerar.
- Los offsets NO documentados de la ventana del save (p.ej. +0x2D0,
  +0x2D2, +0x2F2..+0x2FF) son estado vivo real que el original usa
  intensamente; están como `g_unk_*` hasta que una sonda o el asm los
  identifique (candidatos: transporte/facing/viento/flags de turno).
- Fuera de la ventana del save quedan globals del BSS del kernel
  (0x13xx, 0xA9xx, 0xB1xx...) también como `g_unk_*`.
