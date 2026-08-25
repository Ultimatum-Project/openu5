# Barrido de rutinas INFERIBLES — Fase 1 (overlays oscuros)

Tarea #39. Verificación una-a-una de las rutinas que el censo
(`re/notes/routine-census.json`) etiquetó **INFERIBLE** — clasificadas sólo por
contexto (callers/vecinos/citas) sin que nadie leyera el cuerpo. Cada inferencia
se ha **CONFIRMADO o REFUTADO** leyendo el desensamblado, y se le ha dado un
veredicto de **cobertura del port** (CUBIERTA / PARCIAL / AUSENTE).

Método: `re/tools/disasm.py` genera el `.asm` anotado con globals; se leyó el
cuerpo de cada rutina, se resolvieron callers/callees vía el censo y
`overlay-load-layout.md §3`, y se cotejó contra `game/src`. 6 subagentes en
paralelo (uno por fichero), consolidado aquí. **Estático puro** — sin dosbox,
sin servidor, sin editar binarios.

## Resumen ejecutivo

| Fichero | INFERIBLE | CONFIRM | REFUT | CUBIERTA | PARCIAL | AUSENTE |
|---|---:|---:|---:|---:|---:|---:|
| DNGLOOK.OVL | 11 | 11 | 0 | 2 | 5 | 4 |
| LOOKOBJ.OVL | 15 | 15 | 0 | 2 | 1 | 12 |
| TALK.OVL    | 18 | 18 | 0 | 15 | 3 | 0 |
| MAINOUT.OVL | 13 | 13 | 0 | 5 | 4 | 4 |
| COMBAT.OVL  | 10 | 10 | 0 | 5 | 3 | 2 |
| COMSUBS.OVL |  8 |  8 | 0 | 5 | 2 | 1 |
| **TOTAL**   | **75** | **75** | **0** | **34** | **18** | **23** |

**Titular: 0 refutaciones.** Los 75 rótulos inferidos por contexto resultaron
correctos al leer el cuerpo — el heurístico del censo (caller/callee/cita
identificados) es fiable en estos ficheros. El grueso de las AUSENTE es
**cosmético** (LOOKOBJ: 12 de 12 son glifos de dibujo del zodíaco y el mapa-gema)
o **ya rastreado** (#37 piratas/movimiento por tile; campos de combate y
step-triggers .CBT ya marcados `combat.ts:13`). Quedan **6 gaps nuevos no
cosméticos** listados abajo.

## Gaps NUEVOS no cosméticos (accionables)

1. **DNGLOOK 0x0844 + 0x093a — bitmap de celdas VISITADAS de mazmorra (DS:0x58E0). AUSENTE.**
   0x0844 (llamado desde `dng_enter_room`) marca un bit en un bitmap por-mazmorra
   en 0x58E0, índice `((g_location-0x21)<<4 + celda)`. 0x093a (desde el bucle
   principal) recorre los 512 bytes del mapa y, para cada Room de nibble-alto 0xF
   cuyo bit visitado está puesto, hace `&0xAF` — degrada Room viva (0xF) a Room
   rota (0xA). El port **no tiene** ese bitmap (el único `58xx` de visitados es
   `shrineVisitedBitmap@0x58CE`, sin relación); `onEnterCell`
   (`game/src/core/dungeon/dungeon.ts:517/606`) trata 0xA y 0xF igual. **Es el
   primitivo compartido detrás del garfio-por-techo #38** (subir por celda ya
   visitada) → conviene implementarlo una vez para ambos. Impacto directo hoy
   bajo, estructural alto.

2. **COMSUBS 0x0000 — tirada de resistencia (saving throw) por INT del bando CAST. PARCIAL.**
   Contest `(INT_def − INT_atk + 30)/2 > rand30()` con guard por spell-id `[bp+4]`
   (ids 0x30/0x31/≥0x33 no tiran). 5 callers en CAST.OVL. El port replica el
   contest **sólo** para la posesión enemiga (`combat.ts:1476-1492`); no existe un
   `resist()` genérico en `game/src/core/magic/`. **Impacto: hechizos de
   jugador/NPC que deberían permitir salvación por INT no tiran resistencia.**
   → avisar al dueño del port de magia/CAST.

3. **COMBAT 0x0d30 — reversión de objetivo por Confusión ('C'). PARCIAL.**
   La selección de objetivo (más cercano del bando opuesto, skip-invisible con
   excepción Shadow Lord) está CUBIERTA (`combat.ts:1407`), pero falta la rama
   0d5d-0d79: con `g_time_spell=='C'` (0x43) y `rand30() > INT(actor)`, el binario
   invierte el test de bando y el actor confundido ataca a su propio bando. No hay
   lógica de confusión en `combat.ts`. **Impacto: el efecto Confusión (In Quas
   Corp) sobre el targeting no se reproduce.**

4. **COMBAT 0x139a — DEX efectiva = 1 del defensor bajo Time-stop. PARCIAL.**
   `defenseStat` (`combat.ts:711`) cubre dormido→1 y Mimic→1 pero omite la tercera
   rama: un ENEMIGO bajo Time-stop (`g_time_spell=='T'` 0x54 && flag 0x40) también
   tiene DEX efectiva 1. **Time-stop no está modelado en el port de combate**
   (sin match de `0x54`/`'T'`). **Impacto: con Time-stop activo los enemigos
   congelados deberían ser trivialmente golpeables (dex 1); el clon usa su dex
   real.**

5. **MAINOUT 0x007a — activación por proximidad de objeto de mundo. AUSENTE.**
   Tras cada `world_turn` en terreno lento (0x03e0) y desde el campamento, calcula
   `|party − obj_slot1|` y si ambos deltas < 6, mismo piso, objeto no nulo, llama
   `kernel 0x3ae6(1)` (retorno descartado → puro efecto lateral). El port no tiene
   hook de proximidad por-objeto en el passtime lento/camp. Impacto bajo si
   0x3ae6 es cosmético; requiere disasm del kernel u oráculo para resolver 0x3ae6.
   Vecino de #37.

6. **MAINOUT 0x0a1a — clamp de luz a 0 en tile 0xFF (oscuridad). PARCIAL.**
   Si el tile bajo el party es 0xFF y no hay hechizo de Luz activo
   (`g_time_spell≠0xE`), fuerza `g_light_level=0` + refresh. El modelo de luz del
   port (`survival.ts::lightLevel`, radio 2..50) no tiene el caso especial del
   tile 0xFF que anula el radio. Divergencia estrecha (un tile de blackout
   concreto), no el modelo general día/antorcha.

## Detalle por fichero — filas PARCIAL / AUSENTE

### DNGLOOK.OVL (motor de vista 3D primera persona) — CUBIERTA 2 · PARCIAL 5 · AUSENTE 4
- `0x06a8` gem-view 8×8 iconic floor map — CONFIRMED — **CUBIERTA** (`world/gem-view.ts:47` + `skin/fiel/gemmap.ts`).
- `0x0844` mark_visited_cell (bitmap DS:0x58E0) — CONFIRMED — **AUSENTE** → gap #1 (comparte con #38).
- `0x093a` clear_consumed_markers (Room 0xF→0xA por visitado) — CONFIRMED — **AUSENTE** → gap #1.
- `0x097e` floor_wedge_A (apertura de corredor por dir) — CONFIRMED — **PARCIAL** (frames de perspectiva `skin/fiel/dungeon.ts:270`, no el wedge literal 11×11).
- `0x0a48` floor_wedge_B (cierre de corredor, tile void/techo) — CONFIRMED — **PARCIAL** (`skin/fiel/dungeon.ts:225`).
- `0x0c6c` base_frame (filas suelo/techo + columnas laterales + esquinas) — CONFIRMED — **PARCIAL** (`skin/fiel/dungeon.ts:160`, no relleno literal por filas de tile).
- `0x0d3e` build_first_person_11x11 (tablas de perspectiva 0x2452-0x24c6 por facing + shuffle Fisher-Yates + mote de pared iluminada 0x40+facing·4) — CONFIRMED — **PARCIAL** (renderizado por `render/dungeon3d.ts` HD y `skin/fiel/dungeon.ts:122`; ninguno compone el buffer de tile-ids exacto vía tablas — hueco pixel Clase-C, spec §9).
- `0x0fda` move_party_dungeon (switch g_unk_58a0 1..6: x/y ±wrap toroidal + facing; 5/6 piso±1 con salida 0/7) — CONFIRMED — **CUBIERTA** (`dungeon.ts:211` step + `:256` klimb).
- `0x109e` load_wall_variant_gfx (gate [0xbb17], tabla ptr 0x25F2[g_dng_wall_variant]) — CONFIRMED — **PARCIAL** (`DungeonWallPack` en skin sí; renderer HD usa COLOR_WALL plano; ciclo lazy-load no replicado). Bajo impacto.
- `0x1130` free_wall_variant_gfx (teardown de handles) — CONFIRMED — **AUSENTE** (housekeeping; Pixi gestiona lifecycle — sin impacto).
- `0x117e` corridor_sprite_overlay (sprites de party/criaturas escalados por profundidad en el corredor) — CONFIRMED — **AUSENTE** (ningún renderer dibuja party/monstruos en la vista 3D). Moot hoy: depende del sistema de monstruos errantes (dungeon.md §9), tampoco portado. Gap latente de fidelidad.

**Nota:** el pipeline ráster (0x097e/0x0a48/0x0c6c/0x0d3e) es la brecha S9 ya
conocida (fidelidad pixel-exacta del 3D diferida). No es nuevo.

### LOOKOBJ.OVL ((L)ook + render de gema/cielo) — CUBIERTA 2 · PARCIAL 1 · AUSENTE 12
Los 15 son helpers de **dibujo gráfico**, no lógica de descripción de objeto.
Todo AUSENTE aquí es **cosmético (L3)**:
- `0x01ac` draw_zodiac_star + `0x024c` draw_zodiac_lines — CONFIRMED — **AUSENTE** (mirar de noche = sólo texto "the stars." `game.ts:341`, Clase D declarada). El original dibuja campo de 80 estrellas + constelación del zodíaco por `año/mes/día`.
- `0x0a9c` gem_cell_origin (coord·4+0x20) — CONFIRMED — **CUBIERTA** (`gem-view.ts:71`).
- `0x0abe/0x0b60/0x0b98/0x0bd0/0x0c36/0x0c9c/0x0cf4/0x0dda/0x0e16/0x0e7a` — 10 glifos-hoja del mapa-gema (puntos/trazos/terreno dithered/contorno de muro+puerta) — CONFIRMED — **AUSENTE** (el View-a-gem del port pinta bloque de color sólido por celda `viewgem.ts:58-72`, no los glifos iconográficos por categoría).
- `0x0f7e` draw_gem_map_tile DISPATCHER (categoría = `byte[tile+0x1d1a]` → jump-table) — CONFIRMED — **PARCIAL** (el bucle "un draw por tile" sobrevive; el mapeo categoría→símbolo no).
- `0x10fc` gem_view (render 32×32 View-a-gem, marcador parpadeante, cerrar con tecla) — CONFIRMED — **CUBIERTA** (`gem-view.ts` + `main.ts:1550`, salvo los glifos delegados a 0x0f7e).

### TALK.OVL (motor de conversación NPC) — CUBIERTA 15 · PARCIAL 3 · AUSENTE 0
Cobertura casi total; el port `game/src/core/dialogue/*` reimplementa el motor
`TalkScript` (Redux) a mayor abstracción, no byte-a-byte.
- `0x04d2` / `0x04da` — trampolines de 4 insns que inyectan bytes constantes 0x8d (LF) y 0xa2 (comilla, con de-dupe) en el intérprete 0x0f32 — CONFIRMED (thunks) — **PARCIAL** (el port formatea líneas y comillas por `conversation.ts` textBuf/flushLine; no reproduce la inyección literal de bytes — divergencia cosmética de cadencia/comillas).
- `0x0f32` talk_process_byte — el intérprete de opcodes TLK (jump-table 0x81-0x88, karma 0x89/0x8a, guards 0x8b, oro 0x8c, pausa 0x8f, question 0x91-0x9f, prompt 0xff) — CONFIRMED — **PARCIAL** (el port implementa los *efectos* vía script-ops de Redux `conversation.ts`/`effects.ts`, no la capa literal `opcode|0x80` — divergencia aceptada, npc.md §13.1).
- (resto CUBIERTA — flush/emit/word-wrap, seek/say section, question/answer match, read_input, `mark_npc_met`/`test_npc_met` bitmap 0x5bd6/0x5bd8 = `game.ts:3105/3111`, `run_scripted_conversation` = `registry.ts`+`conversation.ts`).
- Refinamiento de rótulo: `0x127e` que el censo llama `load_talk` en realidad **conduce toda la conversación** (carga .TLK + name-gate 0x111c + bucle keyword 0xb04 + despedida 0xa3c + check de robo 0x1180) — no es sólo "load". Ambas mitades CUBIERTAS. No es refutación, es un nombre corto.

### MAINOUT.OVL (bucle overworld + comandos) — CUBIERTA 5 · PARCIAL 4 · AUSENTE 4
- `0x0354` move_party, `0x0598` tick_and_getkey (viento+coste naval), `0x0d22` spawn_purchased_ship, `0x0f4e` pick_spawn_coords, `0x198c` npc_ship_wind_drift — CONFIRMED — **CUBIERTA**.
- `0x007a` object_proximity_activate — CONFIRMED — **AUSENTE** → gap #5.
- `0x0a1a` darkness_tile_tick (0xFF → luz 0) — CONFIRMED — **PARCIAL** → gap #6.
- `0x0e04` weighted_pick + `0x0fc4` spawn_monster — CONFIRMED — **PARCIAL** (colocación RNG stream-exacta `spawn.ts`, pero la selección de TIPO de monstruo — weighted_pick rand(0,255) + tile_to_monster — está abstraída tras un callback `picker`, no consume rands idénticos; decisión de scope documentada, no bug).
- `0x105c` is_npc_ship_tile, `0x1168` npc_ship_attacks_party, `0x1578` move_world_object (mover genérico por CLASE de tile con jump-table) — CONFIRMED — **AUSENTE** (**YA RASTREADO #37**).
- `0x1a60` world_turn — CONFIRMED — **PARCIAL** (mitad spawn CUBIERTA stream-exacta `loops/turn.ts`; mitad movimiento conduce 0x1578/0x1168 → sólo aproximado, cae en #37).

### COMBAT.OVL (motor táctico) — CUBIERTA 5 · PARCIAL 3 · AUSENTE 2
- `0x05b6` "armed with <weapon>", `0x120e` randomBoardCell (2 rands), `0x13e2` selector STR/DEX/INT, `0x14d6` tirada de impacto `(def−atk+30)/2`, `0x1a5c` clasificación de herida — CONFIRMED — **CUBIERTA** (`combat.ts`/`formulas.ts`).
- `0x0d30` AI target selection — CONFIRMED — **PARCIAL** → gap #3 (falta reversión Confusión).
- `0x139a` DEX efectiva del defensor — CONFIRMED — **PARCIAL** → gap #4 (falta rama Time-stop).
- `0x1236` clear object/sprite slot (tabla 0x5C5A) — CONFIRMED — **PARCIAL** (muerte cubierta; limpieza de objetos-campo pendiente, mismo hueco que campos).
- `0x111a` .CBT floor triggers (stamp tile al pisar celda-trigger) — CONFIRMED — **AUSENTE** (`combat.ts:13` marca pendiente).
- `0x1b1e` daño de terreno/campo fin-de-turno (lava/fuego→fuego, pantano/veneno→veneno, campo-sueño→dormir) — CONFIRMED — **AUSENTE** (`combat.ts:13` pendiente).

### COMSUBS.OVL (subrutinas de combate compartidas) — CUBIERTA 5 · PARCIAL 2 · AUSENTE 1
- `0x0094` print name, `0x048a` isqrt, `0x04d4` distancia euclídea, `0x0748` occupantAt, `0x097c` consumeAmmo — CONFIRMED — **CUBIERTA**.
- `0x0000` saving-throw por INT — CONFIRMED — **PARCIAL** → gap #2.
- `0x12de` animación de proyectil (vuelo por la línea, para en primera celda opaca, fija celda de aterrizaje) — CONFIRMED — **PARCIAL** (path/landing CUBIERTO `combat.ts:690`; la animación frame-a-frame reducida a raycast por celdas — divergencia deliberada declarada `combat.ts:16`, sin gap de resultado).
- `0x0056` disipación de campos por ronda (E8-EB, 1/16) — CONFIRMED — **AUSENTE** (campos no portados aún, `combat.ts:13`).

## Clasificación de las AUSENTE/PARCIAL (para priorizar)

- **YA RASTREADO** (no duplicar): #37 (MAINOUT 0x105c/0x1168/0x1578/0x1a60); campos
  de combate + step-triggers .CBT + daño de terreno (`combat.ts:13`:
  COMBAT 0x111a/0x1b1e/0x1236-parcial, COMSUBS 0x0056); fidelidad pixel del 3D
  spec §9 (DNGLOOK 0x097e/0x0a48/0x0c6c/0x0d3e); garfio-techo #38 (DNGLOOK
  0x0844/0x093a comparten el primitivo).
- **COSMÉTICO / L3** (baja prioridad): LOOKOBJ zodíaco nocturno + 10 glifos del
  mapa-gema; DNGLOOK 0x109e variante de muro / 0x1130 teardown / 0x117e sprites
  de corredor (moot sin §9); TALK 0x04d2/0x04da/0x0f32 (capa literal de opcodes,
  divergencia aceptada).
- **NUEVO ACCIONABLE**: los 6 gaps listados arriba (bitmap visitados #1,
  saving-throw CAST #2, Confusión #3, Time-stop #4, proximidad de objeto #5,
  clamp-luz 0xFF #6).

## Re-etiquetado del censo

Las 75 rutinas quedan **verificadas** (inferencia confirmada). El anexo
`re/notes/inferible-sweep-f1-verified.json` lista cada `(fichero, offset)` con su
rol confirmado y veredicto de cobertura, en formato consumible.

`routine_census.py` deriva el veredicto por fuerza de evidencia, así que editar
el JSON a mano se perdería al regenerar. Recomendación para promover estas 75 de
INFERIBLE a IDENTIFICADA de forma estable: que `routine_census.py` cargue un
**allowlist de offsets verificados** (este anexo) y trate su presencia como
evidencia FUERTE (equivalente a `strong()==True`), análogo a como `top21-triage`
resolvió las SIN-IDENTIFICAR. No implementado aquí (fuera de scope estático;
tocaría la herramienta) — documentado para el orquestador.
