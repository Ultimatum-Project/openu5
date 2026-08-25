# Barrido de rutinas INFERIBLES — Fase 2 (resto de overlays de juego)

Tarea #39, fase 2. Continúa [[inferible-sweep-f1]] con los 16 overlays de JUEGO
restantes (los 6 más oscuros ya se cerraron en fase 1). Mismo método: leer el
cuerpo del `.asm`, CONFIRMAR/REFUTAR la inferencia del censo, y dar veredicto de
cobertura del port (CUBIERTA / PARCIAL / AUSENTE). 7 subagentes en paralelo por
dominio; consolidado aquí. **Estático puro** — sin dosbox, sin servidor, sin
editar binarios.

Método de resolución de calls: se aplicó **REGLA A** (post-mortem
`quake-harpsichord.md`): los operandos de near-call difieren por banda de carga
del overlay; los callers/callees vienen ya resueltos banda-correctos por el censo
(`resolve_near_call`), y toda resolución manual usó `overlay-load-layout.md §3`
con la banda propia de cada fichero.

## Resumen ejecutivo

| Fichero | INFERIBLE | CONFIRM | REFUT | CUBIERTA | PARCIAL | AUSENTE |
|---|---:|---:|---:|---:|---:|---:|
| DUNGEON.OVL  | 12 | 12 | 0 | 1 | 8 | 3 |
| CAST.OVL     | 10 | 10 | 0 | 2 | 7 | 1 |
| CAST2.OVL    |  7 |  7 | 0 | 4 | 2 | 1 |
| SJOG.OVL     |  8 |  8 | 0 | 4 | 2 | 2 |
| TOWN.OVL     |  7 |  7 | 0 | 3 | 2 | 2 |
| NPC.OVL      |  5 |  5 | 0 | 2 | 1 | 2 |
| ZSTATS.OVL   |  6 |  6 | 0 | 6 | 0 | 0 |
| SHOPPES.OVL  |  2 |  2 | 0 | 0 | 1 | 1 |
| SHOPPES2.OVL |  2 |  2 | 0 | 1 | 0 | 1 |
| SHOPPES3.OVL |  3 |  3 | 0 | 1 | 2 | 0 |
| ENDGAME.OVL  |  4 |  4 | 0 | 1* | 1 | 2 |
| INTRO.OVL    |  3 |  3 | 0 | 1 | 0 | 2 |
| BLCKTHRN.OVL |  4 |  4 | 0 | 3 | 1 | 0 |
| FLAMES.OVL   |  1 |  1 | 0 | 1 | 0 | 0 |
| CMDS.OVL     |  2 |  2 | 0 | 2 | 0 | 0 |
| OUTSUBS.OVL  |  5 |  5 | 0 | 5 | 0 | 0 |
| **TOTAL**    | **81** | **81** | **0** | **37** | **27** | **17** |

\* ENDGAME 0x028c cuenta como CUBIERTA-con-divergencia-declarada (el port
numeriza la fecha del pergamino en vez de deletrearla — ya documentado en
`re/verified/endgame.md`).

**Titular: 0 refutaciones en 81 (155/155 acumulado con fase 1).** El heurístico
del censo vuelve a resultar 100% fiable. El grueso de PARCIAL/AUSENTE es material
YA RASTREADO (magia-en-combate #42/#44, movimiento de actores #37, pathfinding
caminado de NPC, cinemática de endgame #20, render-plumbing) o cosmético. Salen
**5 gaps nuevos accionables** + un puñado de refinamientos de nota.

## Gaps NUEVOS accionables (no rastreados antes)

1. **DUNGEON 0x1a90 — la luz de hechizo NO ilumina la vista 3D + profundidad 3 vs 4. PARCIAL.**
   El binario abre el corredor a profundidad **4** (`cmp si,4; jge`) y considera
   iluminado si `g_light_spell_mins≠0 O g_torch_mins≠0`. El port
   (`game/src/core/dungeon/light.ts:16`) devuelve profundidad **3** y **sólo**
   mira `torchTurns` — el aporte de la luz por hechizo (In Lor / Light spell,
   `g_light_spell_mins`) no cuenta. Consecuencia: un grupo iluminado sólo por el
   hechizo de Luz ve NEGRO en la vista de mazmorra, y el corredor se dibuja una
   celda más corto que el original. Fix localizado en `light.ts`/`dungeon3d.ts`.
   **Accionable, valor alto.**

2. **DUNGEON 0x1c0c — Uus Por / Des Por (ascenso/descenso mágico) son eventos MUERTOS. AUSENTE.**
   `cast.ts:169-172` emite `dungeonAscend`/`dungeonDescend` pero **ningún handler
   los consume** en `game.ts`. Además la rutina de aterrizaje (`dng_landing_ok`)
   exige, en modo hechizo (mode≠0), que la celda destino tenga **nibble alto == 0**
   (pasadizo vacío) — coincide con el texto del propio ítem ("Only effective when
   going from empty corridor to empty corridor", `InventoryDetails.json:636`). El
   port no cablea ni el cambio de planta por hechizo ni ese gate. (El Klimb normal
   usa mode==0 = siempre-OK, y ese sí está cubierto en `dungeon.ts:256`.)
   **Accionable.** Corrección de nota: `dungeon.md §4.2` debe decir "bloquea
   cualquier nibble-alto ≠ 0 en mode≠0", no la lista `{0xB,0xC,0xD,0xE}`.

3. **TOWN 0x0170 — transformación de tiles de poblado por HORA del día. AUSENTE.**
   En cada carga de mapa de poblado (+ camp) recorre el mapa y conmuta elementos
   por la hora: al vecino Este de un `0x87 BrickWallArchway` le hace `xor 0xdd`, y
   estampa `0x03 WaterCoast` sobre una lista de coordenadas (tablas
   `0x58ee/0x590e/0x592e`) salvo si el party está sobre `0x48 WoodFloor`,
   restaurando el tile original **a la hora 5**. Perfil = puentes levadizos /
   rejas / fosos de castillo que cambian de noche. El port no tiene tile-gating
   horario en poblado (sólo `spawn.ts` mira la hora). Impacto bajo-medio: elementos
   de castillo quedan estáticos de noche. **Accionable, prioridad media-baja.**

4. **CAST2 0x0e76 (+ cue 0x0e64) — handler de hechizo "espectáculo" NO identificado. AUSENTE.**
   Salva `g_location`→`0xbd15`, fuerza `g_location=0xff` y `g_cmb_actor=0xff`
   (modo "sin ubicación"), snapshotea la tabla de objetos `0x5c5a` a `0xa9fc`, lee
   el tile del party y llama al invocador table-driven `0x0914`; el cue emite
   effect1 + tono zap (`sfx-catalog.md:249`) + effect4. Candidatos: mass-summon /
   gate spectacle / In Vas Por Ylem. No modelado en el port. **Impacto medio si es
   un hechizo visible** (el modo `location=0xff` + el cue son observables). Merece
   una mini-derivación para nombrarlo antes de decidir.

5. **CAST2 0x0768 vs In Ex Por (#26) — tensión de atribución de dispatch. INVESTIGAR.**
   `0x0768` ABRE puertas mágicamente selladas (0x97→0xB8, 0x98→0xBA) — cubierto en
   el port por `game.ts::useSkullKey`. PERO es callee del dispatcher de Cast
   (`CAST.OVL:0x0dba`) además de `0x1792`, lo que sugiere que **algún índice de
   hechizo llega a abrir puertas**. El port modela In Ex Por (#26) como
   `castAnimOnly` (nada), atribuyendo la apertura sólo a (U)se→Skull Key. Si el
   jump-table `0x0dba` enruta un hechizo a `0x0768`, `castAnimOnly` se queda corto.
   No refuta la rutina (su comportamiento está CONFIRMADO); es una pregunta de
   atribución a reconciliar con #26.

   ✅ **CONFIRMADO EL 2026-08-07, y esta entrada ACERTÓ DE PLENO.** El jump-table de
   `0x0dba` **sí** enruta un hechizo a `0x0768`: la entrada **26** de la tabla (fileoff
   `0x1146`) apunta a `0x1026`, cuya primera instrucción es `call 0xffffc16e` → stub
   `0x80ee` → `CAST2.OVL:0x0768`. **`castAnimOnly` se queda corto, exactamente como aquí
   se anticipó.** Derivación completa y controles: `inexpor-dos-llamadores-acta.md`.

   🔴 **Y la lección de proceso es más cara que el hallazgo**: esta entrada estaba marcada
   **INVESTIGAR**, con el razonamiento correcto y el discriminante correcto escrito
   —«si el jump-table enruta un hechizo a `0x0768`…»—, y **nadie la investigó**. Mientras
   tanto el corpus siguió publicando lo contrario en CINCO sitios, uno de ellos en inglés
   en el repo público. **Un «INVESTIGAR» sin dueño es una contradicción viva dentro del
   corpus**: la duda estaba planteada, bien planteada, y su coste fue el de no estarlo.

Menor / UX: **SHOPPES 0x0c58** — el menú SELL del herrero, si no posees nada
vendible, ni se abre (gate up-front `party_owns_any_equipment`); el port cubre el
per-item ("Thou hast none to sell!") pero no el gate de entrada. Trivial.

## Refinamientos de nota (correcciones de documentación)

- `npc.md §0.4`: el campo runtime del NPC `+0x0C` NO es "contador" sino el
  **objIdx** (enlace al slot de sprite visible `0x5c5a`); `+0x0E` = schedIdx.
  (De TOWN 0x1726 `npc_place`.)
- `dungeon.md §4.2`: la regla de aterrizaje mágico es "nibble-alto ≠ 0 bloquea"
  (mode≠0), no la lista de tiles. (De DUNGEON 0x1c0c.)
- ENDGAME 0x028c confirma que `spell_cardinal` DELETREA el número; el port
  numeriza a propósito (divergencia ya declarada en `endgame.ts:88`).

## Detalle por dominio — sólo filas PARCIAL / AUSENTE

### DUNGEON.OVL — motor de mazmorra 3D (CUBIERTA 1 · PARCIAL 8 · AUSENTE 3)
- `0x10dc` dng_get_tile — CUBIERTA (`dungeon.ts:167` cellAt + `:108` LIT_BIT).
- `0x1a90` dng_render_corridor — PARCIAL → **gap #1** (luz de hechizo + profundidad).
- `0x1c0c` dng_landing_ok — AUSENTE → **gap #2** (Uus/Des Por).
- `0x104c` inscripción de muro por-location — AUSENTE (cosmético; muros subtipo 0xB_ con texto/gráfico por mazmorra; el port dibuja muro plano).
- `0x127e` sparkle de campo mágico — AUSENTE (el campo estático SÍ se dibuja; el destello rand por-frame no — scope render §3).
- `0x03d6` dng_getkey / `0x134a` blit de muro / `0x150a` raytrace fwd / `0x1682` raytrace lateral / `0x1786` fuente / `0x1952` overlay de feature / `0x1be0` dng_redraw — PARCIAL: el pipeline ráster está reimplementado geométricamente (`render/dungeon3d.ts` + `skin/fiel/dungeon.ts`), funcionalmente completo pero no byte-exacto a las tablas de perspectiva — hueco Clase-C ya catalogado (`dnglook-raster-spec §9`). Ausencias reales dentro: el flicker rand de antorcha por-frame y la mutación de mapa de estalactita durante el render (scope `dungeon.md §3`, el core puro consume 0 RNG de render).

### CAST.OVL / CAST2.OVL — motor de magia (CUBIERTA 6 · PARCIAL 9 · AUSENTE 2)
Patrón dominante: los **parámetros** de cada hechizo están verificados y portados
(tipos de invocación, modos/longitudes de línea, roll de Kal Xen, tipo 0x1f de
enjambre), pero la **aplicación a los actores del tablero de combate no existe**
en el port — se devuelve descriptor y sólo se resuelven los de objetivo-PJ, viento,
luz, time-status y sellar-puerta. Todo esto = **YA RASTREADO #42/#44** (integración
de hechizos en combate, saving-throw INT vía COMSUBS 0x0000, confusión, time-stop).
- CUBIERTA: `0x01fa` Mani, `0x0846` An Ex Por (sella puerta), CAST2 `0x03c2` Mani-apply, `0x040a` Rel Hur (viento), `0x08ea` luz, `0x08f8` time-status.
- PARCIAL (parámetros portados, aplicación en combate ausente): `0x043e` An Xen Corp (repel undead + INT-save), `0x04a4` In Wis (peer; falta imprimir lat/long), `0x04b0` Kal Xen, `0x07b4` In Bet Xen, `0x0afe` self-transform, `0x0c98` In Quas Corp (mass fear + INT-save), `0x1c36` hechizo de línea; CAST2 `0x0768` (abre puerta mágica → gap #5), `0x0914` invocador table-driven.
- AUSENTE: `0x074c` des-transforma actores (par de 0x0afe; flag 0x10 no modelado); CAST2 `0x0e64`/`0x0e76` → **gap #4** (handler espectáculo sin identificar).

### SJOG.OVL — Search/Jimmy/Open/Get + upkeep de combate (CUBIERTA 4 · PARCIAL 2 · AUSENTE 2)
- CUBIERTA: `0x1040` loot_fixed, `0x10b8` loot_random (`commands.ts:463-485`, rolls exactos), `0x1b6c` sum_flee_edges, `0x20d8` combat_cell_blocked.
- `0x1b34` count_party_ready — AUSENTE (munición por-miembro; el port usa pool compartido = divergencia consciente #51, `deliberate-divergences.md §2`).
- `0x2012` combat_turn_upkeep — AUSENTE (disipación de campos + countdown del time-spell; ambas mitades pendientes = #37 campos / #42 time-spell, declaradas en `combat.ts:13`).
- `0x203e` end_combat_cleanup — PARCIAL (resultados cubiertos en `game.ts:4671`; backup/restore de array de objetos y `g_location` son compensación arquitectónica; único gap sustantivo = el hook `ENDGAME:0x0648` con `g_unk_58a0=='M'` → territorio #20).
- `0x2148` combat_actor_surrounded — PARCIAL (el gate de teleport de la IA usa adyacencia-al-objetivo en vez de "4 vecinos bloqueados"; frecuencia de teleport ligeramente distinta, bajo #42).

### TOWN.OVL / NPC.OVL — poblado + actores NPC (CUBIERTA 5 · PARCIAL 3 · AUSENTE 4)
- CUBIERTA: TOWN `0x011e` find_npc, `0x10f2` shadowlord-possess (`shadowlord-urban.ts`), `0x1694` activate-all (`npc/manager.ts:167`); NPC `0x0b9e` can_move, `0x0d00` ai_step (jump-table 0..7, `manager.ts:255-282`).
- `0x0170` town_time_tile_transform — AUSENTE → **gap #3** (tiles por hora).
- `0x0c78` town_objactor_randomwalk — AUSENTE (**familia #37**, variante poblado; los object-actors se hidratan inertes).
- `0x09bc` town_attack/engine_commit — PARCIAL (glue de recarga+recolocación desde Attack-poblado/npc_engine, no calcado 1:1).
- `0x1726` npc_place — PARCIAL (coloca pos + hidrata sprite; binding objIdx↔slot y máscara de ocultación por-location aproximados; refina `npc.md §0.4`).
- NPC `0x01a0` npc_seek — PARCIAL, `0x04ac` npc_path_backtrace — AUSENTE, `0x0a4a` npc_on_stairs_for_floor — AUSENTE: el mismo hueco YA DOCUMENTADO — el port teletransporta el cambio de planta y usa A* en vez del escáner voraz + seek-a-escalera del binario (`npc.md §13.9/§13.10`). No nuevo.

### ZSTATS.OVL — pantalla Ztats (CUBIERTA 6 · 0 · 0)
Los 6 (print_padded_string, is_item_equipped, find_prev/next_owned,
build_extended_item_table, hand_state) están CUBIERTOS byte-fieles en
`game/src/core/**/ztats.ts`/`equip.ts`/`coreview.ts`. Cero huecos.

### SHOPPES / SHOPPES2 / SHOPPES3 — tiendas (CUBIERTA 2 · PARCIAL 3 · AUSENTE 2)
- CUBIERTA: SHOPPES2 `0x01d2` serve_tavern_round, SHOPPES3 `0x0000` count_guests_here.
- AUSENTE sin impacto: SHOPPES `0x0000` strcpy_append (plumbing Borland; el port arma strings en JS); SHOPPES2 `0x0664` barkeep greeting (selector RNG de saludo cosmético; los rumores económicos SÍ están portados).
- PARCIAL (restricción semántica en el core, ciclado prev/next es UI): SHOPPES `0x0c58` gate up-front de SELL (menor, ver arriba); SHOPPES3 `0x0494`/`0x04b6` picker prev/next de huéspedes de la posada (`innPickup` valida pertenencia pero recibe el índice ya resuelto).

### ENDGAME / INTRO / BLCKTHRN / FLAMES — cinemática/misc (CUBIERTA 6 · PARCIAL 2 · AUSENTE 4)
- CUBIERTA: INTRO `0x0676` print_menu_line (vídeo-inverso `intro.ts:145`); BLCKTHRN `0x0000` beep_delay, `0x0278` print_question, `0x054a` interrogate (`blackthorn.ts:227-325` byte-exacto); FLAMES `0x0000` thunk PLINK inerte; ENDGAME `0x028c` spell_cardinal (divergencia numérica declarada).
- AUSENTE: ENDGAME `0x04fe` frame_present_leaf + `0x05a2` wander_sprite (componentes de la cutscene del trono = **YA RASTREADO #20**, motor de tile-cinematics); INTRO `0x1e22` draw_transfer_stat + `0x2024` draw_transfer_frame (pantalla Transfer-from-U4; el clon no importa U4 — `intro.md §10`, opcional).
- PARCIAL: ENDGAME `0x023a` text_accum_char (wrap a 39 col; contenido portado, primitivo de wrap es render); BLCKTHRN `0x0510` present_reward_cutscene (lógica del interrogatorio portada; la cutscene de bytecode es Clase-C AV).

### CMDS.OVL / OUTSUBS.OVL — comandos + subrutinas outdoor (CUBIERTA 7 · 0 · 0)
- CMDS `0x073e` land_nearby (helper de X-it, `game.ts:2691`), `0x14ba` is_pushable_tile (`commands.ts:113`, rango exacto) — CUBIERTA.
- OUTSUBS `0x0098`/`0x01b4`/`0x02c8`/`0x0368` = subsistema de viewport exterior (buffer DS:0x6608, composición 16×16, scroll, selector de tabla por planta) — CUBIERTA-estructural (el port renderiza directo del mapa; los rare-globals `g_unk_217e/2180` son internos a ese esquema, inertes). `0x0566` seed_underworld_plot — CUBIERTA byte-a-byte (`quest/underworld-seed.ts`, amuleto + 3 shards con sus gates).

## Clasificación (para priorizar)

- **NUEVO ACCIONABLE:** #1 luz de hechizo en 3D + profundidad (DUNGEON 0x1a90);
  #2 Uus/Des Por muertos (DUNGEON 0x1c0c); #3 tiles de poblado por hora (TOWN
  0x0170); #4 handler espectáculo CAST2 0x0e76 (identificar); #5 tensión dispatch
  0x0768 vs In Ex Por #26. Menor: gate up-front SELL (SHOPPES 0x0c58).
- **YA RASTREADO** (no duplicar): #42/#44 magia-en-combate (toda la familia CAST
  PARCIAL + saving-throws + time-stop); #37 movimiento de actores (TOWN 0x0c78,
  SJOG campos); #20 cinemática de endgame (ENDGAME 0x04fe/0x05a2, hook SJOG
  0x203e); #51 munición (SJOG 0x1b34); pathfinding caminado de NPC
  (`npc.md §13.9/13.10`); render Clase-C del 3D (§9).
- **COSMÉTICO / OPCIONAL:** inscripción de muro (DUNGEON 0x104c), sparkle de campo
  (0x127e), saludo del tabernero (SHOPPES2 0x0664), Transfer-from-U4 (INTRO
  0x1e22/0x2024), primitivos de wrap/cutscene AV.

## Re-etiquetado del censo

Las 81 quedan verificadas. Anexo `re/notes/inferible-sweep-f2-verified.json`
(mismo formato que fase 1). `routine_census.py::load_verified_labels()` ya glob-ea
`inferible-sweep-*-verified.json`, así que este anexo se recoge automáticamente:
tras regenerar, **IDENTIFICADA 606→687, INFERIBLE 164→83** (155 verificadas
acumuladas: fase1 75 + fase2 81; nota: 1 offset de fase-1 se recuenta por la
deriva de otras notas). Quedan 83 INFERIBLE: 26 del kernel ULTIMA.EXE + resto
disperso — candidatas a **fase 3**. Los drivers `.DRV` (57 inferibles) están fuera
de alcance (primitivas de hardware, el port no las reimplementa).
