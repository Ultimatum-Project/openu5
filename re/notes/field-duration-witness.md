# In Flam Grav (overworld) — DURACIÓN y estructura del campo · witness vivo (oráculo, 2026-07-18)

> 🔴🔴 **SU CONCLUSIÓN QUEDÓ REFUTADA EL 2026-08-08, y este testigo SE CONSERVA ENTERO.**
> Un testigo posterior con oráculo headless propio mide que *In Flam Grav* **no pasa el gate
> de ubicación** (`CAST.OVL 0x0e8e`) ni en pueblo ni en exterior: no consume hechizo mezclado
> ni maná, con control positivo (In Lor) consumiendo en las dos bandas. Y la máscara
> `DS:0x1C90` de los cuatro In\*Grav vale `0x03` = mazmorra+combate, leída del volcado
> estático **y de la RAM viva**. ⇒ **el cast en OVERWORLD que esta nota describe no puede
> haber llegado a `cast_field_wall`.** Ver `field-grav-gate-testigo-20260808.md`.
>
> Lo que esta nota MIDIÓ (escrituras en `DS:0xb19e`, celdas `0x3a-0x3f` en el compositor
> `0xab02`) sigue siendo un dato bueno **cuya atribución al campo está ABIERTA** — su propio
> volcado registra el buffer de terreno en HIERBA y ninguna escritura en la rejilla `0x595a+`.
> Re-atribuirlo es ficha aparte. **No se corrige ni se borra nada de abajo**: dos testigos
> fechados conservan la discrepancia; uno «corregido» la borraría.
>
> ---
>
> ## 🔴🔴 DEGRADADA A **NO CONCLUYENTE** EL 2026-08-09 (ficha #107)
>
> No se re-atribuye: se retira la conclusión y se nombra por qué, que es lo que el estado de
> la evidencia permite hoy. **Todo lo de abajo se conserva palabra por palabra.**
>
> **EL DEFECTO DE MÉTODO, que es lo reutilizable.** La sonda diffeó el segmento de datos
> ANTES y DESPUÉS de **lanzar el hechizo** — y lanzar consume un TURNO. En ese diff cae, por
> construcción, **todo lo que cambia por turno**, haya campo o no. La propia nota aplica ese
> discriminante a TRES de sus cuatro búferes y los descarta uno a uno con buen criterio: los
> dos slots nuevos son el spawn-gate (§a), los globales de `0x5876` en adelante son
> contabilidad de turno (§b), el búfer de terreno se re-rellena en el redibujo (§b). **Al
> cuarto no se lo aplica — y el cuarto es justo el que concluye que «ES el campo».**
>
> Y el propio §c da el rasgo que lo delata: el registro de `0xb19e` **alterna sus dos pares
> CADA TURNO**. Alternar por turno es la firma de un registro de fase de animación, no de un
> campo recién creado. Un registro que cambia en todos los turnos aparece en un diff de un
> turno **exista o no el hechizo**.
>
> **CORROBORACIÓN ESTÁTICA (canal independiente, hecha hoy):** ni una sola instrucción de
> todo el corpus desensamblado referencia el rango `0xb19e`-`0xb1a1` como dirección absoluta
> — cero ocurrencias en los 28 `.asm`. La escritura llega por registro base, que es la forma
> de una TABLA recorrida por puntero. Compatible con «registro de fase de tiles animados»;
> incompatible con «lo escribe la rama de campo de `cast_field_wall`», que además el testigo
> del 08-08 demuestra que no se alcanza en sobremundo.
>
> **RECONSTRUCCIÓN MÁS PARSIMONIOSA (hipótesis, marcada como tal):** el lanzamiento fue
> RECHAZADO por el gate, la pulsación consumió el turno igual, y los cuatro búferes del diff
> son los cuatro efectos de ese turno. El «campo» descrito sería la fase de animación de
> tiles ordinarios más su composición en pantalla.
>
> 🔴 **LO QUE ESTA RECONSTRUCCIÓN NO EXPLICA, y por eso no se adopta:** las celdas
> `0x3a`-`0x3f` del compositor formando un arreglo **3×2 orientado al NORTE**, o sea hacia
> donde se apuntó. Hierba animada no produce una figura direccional. O el gate sí dejó pasar
> algo, o esa figura tiene otro origen (¿el cursor de apuntado? ¿un remapeo del compositor?).
> **Sin resolver.** Dejarlo dicho es la diferencia entre degradar y tapar.
>
> **EL CONTROL QUE LO DECIDE, y que nunca se corrió:** repetir la sonda ejecutando SÓLO la
> parte compartida — un turno de Pass **sin lanzar nada** — y diffear igual. Si el registro y
> las celdas del compositor aparecen idénticos, la atribución al campo muere y la §c pasa a
> ser el hallazgo bueno de esta nota (el registro de fase de animación, aún sin catalogar).
> Si NO aparecen, el gate dejó pasar algo y lo que hay que revisar es el testigo del 08-08.
> ★★ **Un diff alrededor de una acción necesita un control que haga sólo lo compartido.**
> Sin ese control, el diff no puede separar el efecto de la acción del efecto del turno.
>
> **QUÉ SIGUE EN PIE Y QUÉ NO:**
> · CAE la sección «TL;DR» entera (duración, no-decaimiento, persistencia): las tres cuelgan
>   de que el registro sea el campo. · CAE la línea de la spec «Duración overworld: persiste».
> · SIGUE EN PIE, por ser independiente del gate: la tabla `FIELD_WALL_TILE` validada contra
>   el volcado estático, y que los tiles 0x80-0x83 son de 2 frames en TileData.
> · SIGUE ABIERTO el hallazgo de §c como candidato a «registro de fase de tiles animados» —
>   ahora SIN atribución al campo, que es lo que lo hacía sospechoso.
>
> ---
>
> ## ✅ EL CONTROL DE #138, ADJUDICADO EL 2026-08-20 — en ESTÁTICO, canal más fuerte que la sonda
>
> La atribución al campo **MUERE**, por el criterio que este mismo testigo dejó escrito
> («si el registro y las celdas aparecen idénticos sin cast»): ambos sujetos aparecen sin
> cast **por construcción**, derivado del binario en `remap-anim-b11e-castillo-138.md`.
> · `0xb19e-0xb1a1` son las entradas 0x80-0x83 de `tile_anim_remap[256]` @ DS:0xB11E —
>   inicializada a IDENTIDAD por INTRO.OVL `0x0993` (los `[80 81 82 83]` están ahí desde
>   el arranque, no los escribió el cast) y toggled por el reloj maestro ULTIMA.EXE
>   `0x44b8` (`xor …,1` sobre si=0x80..0x83, sin una sola condición de hechizo). El §c
>   pasa a ser el hallazgo bueno, ya CATALOGADO.
> · Las celdas `0x3a-0x3f` del compositor son **el Castillo de Britannia**: el mapa crudo
>   (BRIT.DAT + índice DATA.OVL:0x3886) tiene `3a 3b 3c / 3d 3e 3f` en (85-87,106-107),
>   con la entrada 0x3e EXACTA en la posición del party (86,107) — el shape medido
>   `3a 3b 3c / 3d _ 3f` es el castillo con el avatar plantado en su puerta. La «figura
>   3×2 orientada al norte» que la reconstrucción del 08-09 no explicaba era el castillo.
> · El testigo del 08-08 queda EN PIE sin revisar. Y el control vivo TAMBIÉN se corrió
>   (mismo 20-08, `re/tools/probe_field_pass_control.py`, party plantado en (86,107) con
>   CERO casts): `0xb19e = 81 80 83 82` y 4 celdas `0x3a-0x3f` en el viewport ANTES de
>   tocar nada — VEREDICTO PASA. El diff del turno de Pass (63 B) trae además `0x6a7e`
>   (fase del reloj, +1) y `0xb1f2-0xb1f9` (= remap de cascadas/fuentes 0xd4-0xdb):
>   la estructura del reloj, confirmada en vivo pieza a pieza.

Desbloquea la feature In*Grav del carril los-audit. Witness en oráculo headless propio
(run-dir `/private/tmp/<oracle-rundir>-fielddur`, sin dosbox ajeno). Cast de In Flam Grav (spell
idx 14, arg 0 = fuego) en OVERWORLD apuntando UP, seguido de 30 turnos de (Space)=Pass en el
sitio, releyendo memoria tras cada turno. Probe: `probe_field_dur.py` (scratchpad del carril),
patrón = diff del segmento de datos ANTES/DESPUÉS del cast para localizar TODO lo que escribe.

## TL;DR — respuestas a las 3 preguntas del brief

1. **Turnos de vida:** **≥30 turnos SIN decaer, Y PERSISTE al salir/volver del área.** 30 turnos
   quieto + 9 turnos (2º shape settled) sin expiración; el registro 0xb19e mantuvo sus 4 entradas
   incluso con el campo fuera de pantalla (leave/return CONFIRMADO — ver §"Persistencia al moverse").
   NO expira ni por-celda ni en-bloque. El único cambio por turno es el **swap de frame de
   animación** (ver §c). Cap duro >30 = no medido (ver abiertos).
2. **Decae por-celda o en-bloque:** **NINGUNO — no decae en 30 turnos.** El cambio por turno es
   animación, no decaimiento. (Si hay cap duro, está más allá de 30; a demanda una corrida larga.)
3. **Tile crudo sembrado + reconciliación de buffers:** el campo se siembra como los tiles
   **0x80-0x83** (registro DS:0xb19e), que **valida la tabla del port** `FIELD_WALL_TILE =
   [0x82,0x81,0x80,0x83]` (tables.ts:59, DS:0x4596; In Flam Grav=arg0→0x82). El `0x3a-0x3f`
   que vio el retirado en el mapbuf **0xab02 es el buffer de DISPLAY** (composite de tiles), un
   remapeo de presentación — NO el tile lógico. Misterio del retirado CERRADO: leyó el buffer
   de display, no el de tipo. Los tiles 0x80-0x83 están marcados `IsPartOfAnimation, 2 frames`
   en TileData (Redux) → el port YA tiene el dato de que animan.

## Los cuatro buffers que toca el cast (diff del segmento, 1189 bytes)

| DS addr | qué es | qué le pasa al castear |
|---|---|---|
| **0xb19e-0xb1a1** | **registro de tiles de campo (los 4 tipos), 2-frame anim** | el cast escribe `[0x80,0x81,0x82,0x83]`; **toggle de pares cada turno** (ver §c). ES el campo. |
| **0xab02** (mapbuf) | buffer de tiles de DISPLAY (compositor 0x5910 copia 0x160 words `[0xad14]→[0xab02]`, ui-render-map:96) | las celdas de campo aparecen como `0x3a-0x3f` (6 celdas, arreglo fijo 3×2 al N). Remapeo de presentación. |
| **0x5C5A** slots 1-2 | tabla de objetos/actores (32×8) | **2 slots NUEVOS — pero son SPAWNS de overworld, NO el campo** (ver §a). |
| **0x670a+** (~42 B) | buffer de terreno/viewport (fuera de la ventana roster 0x55A6-0x6605) | se re-rellena a terreno (0x05 hierba / 0x06 / 0x08) por el redibujo del world-turn. No es el campo. |

## (a) SLOTS ↔ CELDAS — los 2 slots NO son el campo, son spawns coincidentes con el turno

**Corrección al volcado en crudo:** los 2 slots nuevos NO son las celdas de campo.
```
slot1 (0x5C62): 98 98 48 68 00 00 10 00  → tile=0x98 (MagicLockDoorWithView) @ (72,104)
slot2 (0x5C6A): bc bf 5d 65 00 00 30 00  → tile=0xbc (Fireplace) @ (93,101)
```
Tres evidencias de que son SPAWNS de overworld, no el campo:
1. **Tiles ≠ campo:** 0x98/0xbc no son tiles de campo (el campo lógico es 0x80-0x83); ni son
   `IsEnemy`/`IsNPC` en la tabla, son los map-tiles de sprite del actor.
2. **Posición ≠ campo:** el campo se siembra al NORTE del party (86,107) ⇒ ~(85-87,105-106).
   Los slots están en (72,104) y (93,101), FUERA del viewport 11×11 (±5) — no son las celdas.
3. **Mecánica documentada:** cada turno de overworld corre el **spawn-gate** `rand_range(1,30)`
   → `pick_spawn_coords 0x0F4E = 2×rand(0,31)` (overworld-ai-rng.md §2, ya portado en
   `loops/spawn.ts`). El cast consumió un turno ⇒ el gate sembró 2 errantes. Coincidencia
   temporal, no causal.

⇒ **El campo NO vive en la tabla de objetos 0x5C5A.** Vive en el registro 0xb19e (tipos/frame)
+ el composite de display (0xab02 como 0x3a-0x3f). El modelo del port ("escribe un tile de campo
en la celda de enfrente", tables.ts:57) es correcto en espíritu (tile de mapa, no objeto),
aunque siembra >1 celda (6 en display). **Relación slots↔celdas: ninguna** — 2 slots = 2 spawns;
6 celdas de display = 1 muro de campo; 4 bytes en 0xb19e = los 4 tipos de campo animados.

## (b) Writes en 0x5876-0x58ca y 0x670a+ = efectos del TURN-ADVANCE, no el campo

- **0x5876-0x58ca:** bloque de globals de estado/entorno que el world-turn actualiza al gastar
  el turno del cast. Identificados: `g_wind@0x5892` (04→02, O→S; el world-turn re-rolla viento
  rand(0,63), ui-render-map:96 / globals.md:99), `g_wind_drift_ctr@0x5883`, y varios contadores
  de reloj/fase. **Bookkeeping de turno, no almacenamiento de campo.**
- **0x670a+:** buffer de terreno del viewport (fuera de la ventana del save 0x55A6-0x6605); el
  redibujo del world-turn lo re-rellena con el terreno overworld del sitio (0x05/0x06/0x08). El
  campo NO está aquí (es hierba) ⇒ el campo se compone en la capa de display/tipo, no en el
  terreno crudo.

## (c) Mecanismo del swap de animación — registro 0xb19e

Cada turno, 0xb19e alterna sus 2 pares:
```
turnos pares:  b19e..b1a1 = 80 81 82 83
turnos impares: b19e..b1a1 = 81 80 83 82     (0x80↔0x81 y 0x82↔0x83 intercambian)
```
Es un **registro de "frame actual" por tipo de campo animado**: (0x80,0x81) = los 2 frames de
un grupo, (0x82,0x83) = los 2 frames del otro. Redux confirma `0x80-0x83 = IsPartOfAnimation,
TotalAnimationFrames=2`. Las celdas de campo colocadas referencian su tipo desde este registro;
al togglear, todas re-renderizan con el frame alterno ⇒ el parpadeo del campo. **Cadencia
observada: 1 toggle por TURNO de juego** (muestreé por turno; si además togglea en redibujos
sub-turno no lo distingo con este muestreo). Estructura 0xb19e = NO catalogada antes; hallazgo
nuevo de este witness (candidato al "registro de frame de tiles de campo").

## Spec accionable para el carril In*Grav (intro-i18n-implementer)

- **Tile lógico por tipo:** `FIELD_WALL_TILE=[0x82,0x81,0x80,0x83]` (ya en el port) — VALIDADO.
- **Duración overworld:** el campo **persiste** (≥30 turnos, sin decay por-turno). Modelar como
  semi-permanente en la visita, NO con contador de turnos que lo borre. (Confirmar cap/persistencia-
  al-moverse si la feature lo necesita — corrida larga / mover-y-volver, a demanda.)
- **Animación:** 2 frames alternando **cada turno** (el port ya tiene `IsPartOfAnimation` para
  0x80-0x83; basta ciclar fase por turno).
- **Presentación:** el display encodea el campo como 0x3a-0x3f (6 piezas, arreglo fijo 3×2
  direccional); si el port compone por celda lógica, mapear tipo→pieza por posición.

## Persistencia al MOVERSE (leave/return) — PERSISTE · el 6→3 fue ARTEFACTO DE LECTURA, no decay

Segundo boot (probe_field_persist): cast → alejarse (fuera del viewport) → volver al origen
EXACTO. Veredicto: **el campo PERSISTE** (origin restored, celdas de campo de vuelta). Clave:
`0xb19e` retuvo sus 4 entradas TODO el rato, **incluso con el campo fuera de pantalla** (while-away:
0 celdas en el mapbuf de display, pero 0xb19e = `80 81 82 83` intacto) ⇒ el campo vive en un
registro persistente, no sólo en el composite de display. Modelar como persistido (worldObjects/
save-backed), NO como overlay efímero.

**Adjudicación del 6→3** (la sonda de leave/return leyó 6 celdas post-cast y 3 al volver): es un
**ARTEFACTO DE LECTURA (viewport mid-composite)**, NO decay. Prueba (tercer boot, probe_field_anim,
lecturas CON settle de 12 ticks): estacionario 9 turnos → **ncells ESTABLE = 5 los 9 turnos**, en
AMBOS frames de animación (banim alternando `81 80 83 82` ↔ `80 81 82 83`). El shape estable real =
`3a 3b 3c` (fila frontal) + `3d _ 3f` (fila del party, con el avatar en el centro). El conteo NO
oscila con el frame. Las cifras 6 y 3 de la sonda leave/return venían de lecturas SIN settle (el
composite viewport 0xad14→0xab02 aún a medio pintar tras el paso). ⇒ **el campo NO decae: ni
por-celda ni en-bloque; conteo estable en 30 turnos (0xb19e) + 9 turnos (mapbuf settled).**

## Abiertos (a demanda del lead — no bloquean la spec)

1. **Cap duro de duración** (>30 turnos): corrida larga de Pass hasta que 0xb19e se limpie
   (los 30+9 turnos medidos no mostraron decay; el cap, si existe, está más allá).
2. **Duración en COMBATE** (objetivo #4 del brief original): los campos de combate (arma-hechizo
   0x33-0x36, combat.ts:237, buffer de arena 0x595a — espacio DISTINTO al overworld) probablemente
   SÍ decaen finito — no medido. Es el caso de gameplay más común; witness dedicado si la feature
   cubre combate. (intro-i18n-implementer lo deriva aparte del binario: COMSUBS 0x0C52.)

## Evidencia
- Probe: `probe_field_dur.py` (scratchpad); salida cruda `fielddur_out.txt`.
- Port: `game/src/core/magic/tables.ts:57-60` (FIELD_WALL_TILE/COMBAT_WEAPON), `cast.ts:144-149`.
- Estático: `overworld-ai-rng.md §2` (spawn-gate), `ui-render-map.md:96-100/121` (compositor
  0x5910, mapbuf 0xab02←0xad14, g_char_anim_states 0x5C5A), `globals.md:99` (g_wind 0x5892),
  `magic.md §2` (fieldWall). TileData 0x80-0x83 = anim 2-frame.
