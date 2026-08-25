# Presentación de combate — spec de cableado para E1-S12 (SCOUT)

> **Qué es esto:** derivación de SOLO-PRESENTACIÓN del combate táctico
> (`COMBAT.OVL` + `COMSUBS.OVL` + kernel), punto por punto del sub-inventario
> de la task #28, para que S12 se cablee con spec en vez de a ojo. La LÓGICA ya
> está portada con paridad (`re/verified/combat.md`, `re/notes/combat.md`) — esta
> nota NO la re-deriva: enlaza y añade únicamente las rutinas de **pintado /
> animación / cursores** y qué de eso es información de juego (va al snapshot) vs.
> **Clase C** (cadencias/timbres finos → catálogo AV / píxel-diff, task #4/#26).
>
> **Convención de offsets** (idéntica a combat.md): `COMBAT.OVL`/`COMSUBS.OVL` =
> fileoff del OVL; `kernel 0xNNNN` = offset de imagen de `ULTIMA.EXE.asm`. Nombres
> reconciliados contra el ledger (`re/ledger/coverage.json` + `globals.json`) ANTES
> de citarlos — no bautizo nada nuevo salvo lo marcado `(scout, nuevo)`.
>
> **Autoridad:** asm/datos verbatim > capturas. Toda cadencia en Hz, nº de flashes
> percibidos, px/frame de un proyectil → **Clase C** (medir en vídeo D / píxel-diff),
> NO derivable del estático.

---

## 0. Encuadre: cómo compone el combate (igual que el mundo)

El combate reutiliza el **buffer lógico de tile-ids** del kernel (11×11, DGROUP
`[-0x54FE]` / `0xAB02`) descrito en `re/notes/ui-render-map.md §0.1`: el motor
escribe tile-ids y una rutina de blit los vuelca a VRAM. Dos rutinas de kernel
(cuerpo en el **segmento far**, XREF fiable, `ui-render-map §0.2`) hacen todo el
repintado de la pantalla de combate:

- **`kernel 0x7886` — redibujo de la ARENA** (viewport de combate 11×11 →
  pantalla). Se llama en el arranque del bucle (`combat_main_loop` 0x0bac), tras
  "VICTORY!" (0x0d05) y tras un trigger `.CBT` que cambia tiles (0x0d1f). Es el
  único "barrido" de la arena: un volcado del buffer, **sin animación de entrada**
  (§6).
- **`kernel 0x8670` [= CS 0x2900 → ULTIMA.EXE:0x2900 draw_status_panel] — redibujo del PANEL DE PARTY** (nombres/HP/estado, banda
  derecha). Ya inventariado en `ui-render-map §1` (XREF ×4 desde COMBAT). Es donde
  se refleja el **miembro activo** (§1).

**Regla dura #2:** S12 replica el buffer de tile-ids + visibilidad + estados de
combatiente (eso ES la información de juego); el pixelado (atlas EGA) es libre.

---

## 1. Recuadro/cursor del combatiente ACTIVO — `combat_player_turn` (COMBAT:0x063E)

**Mecanismo (no es parpadeo por tick de anim; es por TURNO):** el bucle de
iniciativa (`combat_main_loop` 0x0B94) barre los 32 slots decrementando countdowns
**en silencio** (sin dibujar nada; `re/notes/combat.md §2`). Sólo cuando un slot
llega a 0 arranca su turno, y ahí se "ilumina" al activo:

- `g_cmb_actor` (DS 0x589E) = índice del combatiente activo (`combat.md §1`).
- `combat_player_turn` copia la celda del activo a `g_party_x/y`
  (0x0651-0x065e) → **la "cámara"/foco se centra en el activo**.
- `kernel 0x8670` [= CS 0x2900 → ULTIMA.EXE:0x2900 draw_status_panel] repinta el panel de party (0x06e9) marcando al miembro cuyo
  turno es (info de juego: nombre/HP/estado).
- `combat_player_turn` llama `kernel 0x742a(0xa)` (0x06f4) y `kernel 0xDB0A [= CS 0x7d9a → COMSUBS.OVL:0x0094 print_combatant_name](actor)`
  (0x06fe) — rutinas de cursor/foco sobre la celda activa (cuerpo en segmento far;
  XREF fiable). Luego imprime el **nombre + prompt** del PJ activo
  (`comsubs_print_combatant_name`, string DS 0x6DA4 vía `kernel 0x75c0`, 0x0717).

**Al snapshot (info de juego):** `activeCombatant` = índice/id del combatiente cuyo
turno es, y su celda (x,y). El resto —**si el recuadro parpadea y a qué cadencia**—
es Clase C. La piel dibuja el recuadro/cursor sobre `activeCombatant.cell` con su
propio reloj de anim (F-A, el mismo de antorchas).

---

## 2. Proyectiles — EL STEPPER REAL: `comsubs_projectile_flight` (COMSUBS:0x12DE)

**Corrección al sub-inventario:** `0x43ae` = `pcspeaker_glide` (SÓLO sonido). El
stepper que recorre celdas y pinta el misil es **`comsubs_projectile_flight`
(COMSUBS:0x12DE)** (ledger `comsubs_projectile_flight`), y quien pinta el glifo por
celda es **`comsubs_projectile_anim` (COMSUBS:0x0F4A)**.

Mecánica exacta (leída 0x12de-0x1452):

1. **Precalcula la trayectoria en PÍXELES.** Dos buffers de 256 bytes en DGROUP
   (`DS:0xA728` = lista X, `DS:0xA872` = lista Y), rellenos a `0xFF` (centinela de
   fin). Convierte las celdas origen/destino a píxel: `coord*16 + 16` (tiles de
   16px, +16 = origen del viewport) (0x1311-0x133c) y llama al **rasterizador de
   línea `COMSUBS.OVL:0x0E26 compute_line_cell_path`** (Bresenham) que llena ambos
   buffers con el camino píxel a píxel (0x1351).

   > CORRECCIÓN (barrido de citas de notas): esto decía «`kernel 0xE26` (Bresenham,
   > cuerpo far)» y las dos cosas eran falsas. El call de 0x1351 es `e8 d2 fa` = near
   > rel16, **no far**, y su destino es el propio COMSUBS: `0x0E26` es el inicio EXACTO
   > de `compute_line_cell_path` en el censo (prólogo `55 8b ec`, precedido del `ret 4`
   > de `player_attack_all_slots` en 0x0e23) y está pegado a `projectile_draw_frame`
   > (0x0F4A), que esta misma nota ya cita bien dos párrafos más arriba. El número era
   > correcto; sobraba la palabra «kernel». Aplicar la regla de banda a un destino
   > INTERNO lo mandaba a `CAST2.OVL:0x0e26`, en mitad de la ceremonia del Códice.
2. **Paso por frame** = `[bp-0xa]`: **13 px** por defecto; **6 px** si
   `0 < g_location < 0x21` (mapas confinados: pueblo/mazmorra) (0x135e-0x1371);
   **8 px** si el proyectil (`[bp+4]`) == 7 (0x1374-0x137a). (px/frame observados;
   la equivalencia px→ms es Clase C.)
3. **Bucle de vuelo** (0x1393-0x1452): por cada punto del camino
   - contador de frame de sprite `[bp-8]` cicla 0..3 (`and 3; inc`, 0x1398-0x13a1)
     → animación de **4 fotogramas** del misil;
   - `comsubs_projectile_anim(x_px, y_px, frame, thing, si, di)` **dibuja el
     glifo** del misil en ese píxel (0x13ce);
   - **`kernel 0x3ee8(0x28, 1)` = espera/cadencia** (0x28=40) — el "reloj" del
     proyectil (0x13d9). ← el nº exacto es Clase C.
   - **borra** el misil repintando el rectángulo (x±8, y±8..+0xf) vía
     `kernel 0x28ee` (0x140e);
   - `si/di += paso` (0x1411-0x1414);
   - **para** si: se acabó el buffer (`si>0xA872` o `[si]==0xFF`), la celda es
     **opaca** al proyectil (`kernel 0x5D8E`, `combat.md §14`, 0x142a) o se alcanzó
     la celda objetivo (`[bp+0xc]/[bp+0xa]`, 0x1434-0x1442).

`comsubs_projectile_anim` (0x0F4A) es una **tabla de saltos por tipo de proyectil**
(`[bp+8]`, 0..7+; `2effa7...` en 0x0fb0) con variante por dirección (`[bp+0xa]`
1..4 = N/S/E/W) que traza líneas/píxeles con `kernel 0x2930`; la rama de
**explosión/impacto** (tail 0x1214-0x12c4) consume **4 rands de chispas por frame**
(`combat.md §12`, `0x125B/0x1268/0x1275/0x1282`) — SÓLO presentación pero el arnés
de paridad los consume para no desalinear el stream.

**Quién invoca el vuelo:** PJ a distancia `comsubs_ranged_attack_exec`
(COMSUBS:0x0A68); enemigo `comsubs_projectile_resolve` (COMSUBS:0x0822). El **hit se
rola ANTES de volar**; si falla, el proyectil aterriza en celda aleatoria adyacente
al objetivo (fuego amigo) — `combat.md §7/§8.1`. `enemyRangeThing[type]` (DS 0x15CC)
/ `spellAttackRange` (glifo del arma) elige el tile del misil.

**Al snapshot:** un evento efímero `projectile { fromCell, toCell, thing/tileId,
hit:bool, landCell }`. La piel anima el recorrido celda-a-celda (o píxel, libre) con
su reloj. Los 13/6/8 px, los 4 frames, el delay `0x3ee8` y las chispas son **Clase
C** (medir en vídeo D).

---

## 3. Flash/inversión del OBJETIVO al impactar — `kernel 0x3564`
(ledger `kernel_combat_hit_flash`)

Se llama tras un golpe que ACIERTA (melee `comsubs_melee_strike_exec`
COMSUBS:0x0BF8; y a distancia). Leído 0x3564-0x35e8:

- Resuelve la celda del objetivo desde su registro (rec+4 → objeto → x,y en
  `0x5C5C/0x5C5D`) y **dibuja/invierte el tile del objetivo** con `blit_tile`
  (`kernel 0x10E0`, 0x359f).
- **Beep** según bando: si el objetivo es **jugador** (`flag 0x80`) tono
  `pcspeaker_noise_burst(0x1f4,0xbb8,0x28)` (freq 500) rodeado de sound-on/off
  (`kernel 0x2a28`); si **enemigo/no-combate** tono `(0x7d0,0xbb8,0xa)` (freq 2000,
  dur 10) (0x35b2-0x35de).
- **Restaura** el tile llamando al tick de anim `kernel 0x5910`
  (`kernel_wind_anim_tick`, que repinta) (0x35e1).

Es **un ciclo invert→beep→restore por golpe**, NO un bucle multi-flash. (El nº de
frames que el invert permanece visible = Clase C.) Distinto del **flash de pantalla
completa** `kernel_flash` (0x3AE6, `combat.md:21`, n flashes+beep) que se usa para
daño de terreno/eventos, no para el impacto puntual.

**Al snapshot:** evento efímero `hitFlash { cell, targetKind }`. La piel invierte/
resalta esa celda un instante; **cadencia y color = Clase C**. El SFX ya está en el
catálogo (`re/notes/sfx-catalog.md`, task #3).

---

## 4. Efecto de MUERTE (cadáver / sangre / desvanecimiento) — `combat_apply` (COMBAT:0x1574)

Ya derivado en `combat.md §6` (esto es sólo el **resultado visible** en el buffer de
tiles, ergo info de juego → snapshot):

- Jugador muerto: su objeto pasa a **tile 0x1E (cadáver)**; status 'D'; si era el
  activo, `active=0xFF` (0x15c5-0x1604).
- Enemigo muerto, según flags/suelo:
  - flag `0x1000` → **"vanishes!"** y **tile 0x16** (sin resto) (0x1782).
  - flag `0x0001` (noCorpse) → se retira **sin cadáver ni sangre** (0x16b5).
  - Gazer (0x1C) → deja **Insect Swarm** (spawn tipo 0x1F) en su celda.
  - Gargoyle (0x1E) → la celda del mapa pasa a **tile 0x4C** (sin cofre).
  - suelo agua (0x87 o <4) → sin cofre.
  - `rand30 ≤ treasure` → objeto = **COFRE (tile 1)** (`|0x80` si trampa);
    si no → **tile 0x1F (charco de sangre)** (0x172c-0x177a).

**Al snapshot:** el tile-id del objeto en esa celda (0x1E cadáver / 0x1F sangre /
1 cofre / 0x16 vanish / 0x4C gargoyle) YA es información de juego y sale en el buffer
11×11. No hay animación de muerte propia: es un **cambio de tile** que el barrido
`kernel 0x7886` repinta. La piel dibuja el sprite EGA correspondiente.

---

## 5. Layout de mensajes de combate / iniciativa

Todos los mensajes de combate salen por la **consola de texto** (`re/notes/
ui-text-layer.md`), impresos con `kernel 0x75c0` (print string) al ring de líneas:

- Nombre del combatiente activo + prompt: `comsubs_print_combatant_name`
  (COMSUBS, PJ del roster o monstruo de la tabla DS 0x1856).
- Resultado del golpe: `comsubs_hit_message` (COMSUBS:0x0312) + `combat_enemy_wound`
  (COMBAT:0x1A5C) — `combat.md §6`: al enemigo "critical!/heavily/lightly/barely
  wounded!"; al PJ sólo " hit!"; " missed!"/"Failed!" al fallar; "killed!",
  " grazed!", " slept!", " dragged under!", "<name> is poisoned!", "VICTORY!",
  "BATTLE IS LOST!", " escapes!", " teleports!", "<name> divides!", "gates in a
  daemon!", "A <name> stole some food!".
- Iniciativa: **no hay barra ni indicador numérico** — el orden es emergente del
  countdown silencioso (`combat.md §2`); lo único visible es de quién es el turno
  (§1, panel + prompt).

**Al snapshot:** las líneas de mensaje ya viajan por el modelo de consola existente
(ring 12 líneas del spike, `ui-render-map §1`). S12 no añade capa nueva: reutiliza
la consola fiel. **Cadencia de scroll/cursor de consola = Clase C.**

---

## 6. Barrido de ENTRADA a la arena y colocación

**No anima.** Las posiciones iniciales ya están fijadas en los `CombatMaps` (party
en celdas fijas, enemigos según el `.CBT`; `combat.md §1`). El arranque de
`combat_main_loop` (0x0B94) hace, UNA vez:

- `kernel 0xB680` [= CS 0x5910 → ULTIMA.EXE:0x5910 viewport_redraw] (setup, 0x0ba6), `kernel 0x8670` [= CS 0x2900 → ULTIMA.EXE:0x2900 draw_status_panel] (panel, 0x0ba9),
  **`kernel 0x7886` (volcado de la arena, 0x0bac)**, `kernel 0xDBFA` [= CS 0x7e8a → SJOG.OVL:0x1b6c sum_flee_edges] (recuento de
  vivos → `g_cmb_scratch_x`, 0x0baf).

> **CORRECCIÓN (task #37, cita `combat-light-adjudication.md §2`):** el "volcado de
> la arena" atribuido aquí a **`0x7886`** era un mislabel — `0x7886` resuelve a
> **`kernel 0x1B16` = flush del buffer de teclado BIOS** (0x40:[0x1A]/[0x1C]=0x1E),
> no un redibujo; sus 3 call-sites (0x0bac/0x0d05/0x0d1f) descartan input en las
> fronteras del bucle. **El redibujo REAL de la arena es `kernel 0xB680 [= CS 0x5910 → ULTIMA.EXE:0x5910 viewport_redraw] → 0x5910`**
> (el compositor con LOS del mundo, gate `g_location<0x80` → flood 0x5A28 centrado
> en el combatiente activo, radio = `g_light_level`). Confirmación independiente: el
> flash de impacto `0x3564` restaura la arena con `call 0x5910` (0x35E1). La
> conclusión de "sin animación de entrada" NO cambia (0x5910 pinta de golpe); sólo
> se reasigna qué llamada hace el volcado. La censura por luz de la arena (radio =
> luz ambiental, centro = activo) está portada en `skin/coreview.ts::combatVisField`.

Es un **único repintado del buffer** (los combatientes "aparecen" ya colocados). No
hay marcha de entrada ni barrido animado que derivar. (Si el vídeo D mostrara un
fade/wipe al entrar, sería Clase C del compositor, no del binario.)

**Al snapshot:** el buffer 11×11 inicial con combatientes colocados + roster. La piel
lo pinta de golpe (o con su propia transición, libre).

---

## 7. Cursores de targeting (A)ttack / hechizos — `comsubs_aim_cursor` (COMSUBS:0x0504)

Ya mapeado en `combat.md §14` (fix #44); aquí el detalle del cursor leído
0x0504-0x0720:

- `g_cmb_aim_active` (DS 0x5898) = 1 mientras se apunta.
- **Objetivo inicial** = enemigo VIVO más cercano **dentro de alcance** (`bp+4` =
  `ATTACK_RANGE_VALUES[w]`); si no hay, la propia celda del actor (0x0511-0x0568).
  `g_cmb_aim_x/y` (DS 0x5899/0x589A) = celda del cursor.
- **Bucle de input** (`kernel 0x448c` getkey, 0x063d): flechas 1/2/3/4 = mover el
  cursor en cardinal (si/di ±1, 0x066c-0x0686), acotado por **alcance** (dist
  `COMSUBS.OVL:0x048A isqrt` ≤ `bp+4`, 0x05f8) **y** por la rejilla 0..10 (0x0600-0x0616); ENTER
  (0x0d) confirma; ESC (0x1b) cancela (0x06ea).
- **Confirmar** dispara `kernel 0x34da(0xa)` (flash/beep del cursor, 0x06be) y, si es
  hechizo (`g_cmb_is_spell`), un tono derivado `(0x320 + is_spell*0x640)`
  (`kernel 0x405c`, 0x06de).

**Divergencia del clon ya vigente** (`combat.md §14`, fix #44): el cursor libre del
binario se MAPEA a dos controles — **click** apunta a cualquier celda en alcance;
**`A`+flecha** recorre la línea cardinal hasta el primer enemigo dentro del alcance
(`playerAttackDir`). El motor ya modela alcance + línea de tiro.

**Al snapshot:** cuando `aimActive`, exponer `aim { cell, rangeCells[] }` (celdas
legales). La piel dibuja la retícula sobre `aim.cell` y opcionalmente resalta las
celdas alcanzables. Interacción libre; **parpadeo de la retícula = Clase C**.

---

## 8. Spec de cableado para S12 (core↔piel)

### Qué expone el SNAPSHOT (SÓLO lo visible; info de juego, regla dura #2)

`combatView` (presente sólo en `location == combat`):

> **SIN campo `visibility` (veredicto `combat-light-verdict.md`, task #33/#37).** La
> reserva original de una máscara `visibility` 11×11 se RETIRA: el combate corre con
> `g_location = 0xFF (≥0x80)`, así que el compositor `kernel 0x5910` toma la **copia
> CRUDA** de la arena (`0x59f8`, `rep movsw` de `0xAD14`→`0xAB02`, sin máscara) y la
> rama LOS/flood (`0x5910`→`0x5D0A`→`0x5A28`, sólo `loc<0x80`) **nunca se alcanza en
> combate**. La arena y TODOS los combatientes se ven **siempre** (día, noche,
> mazmorra), sin radio de luz ni rombo negro nocturno. El intento de portar un
> `floodFOV`/`combatVisField` (task #37, `669c4bc`) se **revirtió** (`f01d68b`) por
> sobre-censurar la arena de día con el activo descentrado. El snapshot de combate
> deja la visibilidad TODA-VISIBLE (estado pre-#37).

| campo | contenido | fuente |
|---|---|---|
| `tiles` | buffer 11×11 de tile-ids del combate (incluye cadáveres 0x1E/sangre 0x1F/cofres 1/vanish 0x16 ya resueltos) | buffer `[-0x54FE]`, blit `kernel 0x7886` |
| `combatants[]` | por combatiente VIVO/visible: `{ id, cell{x,y}, tileId, kind: party\|enemy, hpBucket?, flags visibles: sleeping/charmed/invisible/fleeing }` | regs `DS:0xBA14` (`combat.md §1`) — exponer sólo lo pintable, NO hp exacta del enemigo |
| `activeCombatant` | id + cell del combatiente cuyo turno es | `g_cmb_actor` (§1) |
| `party[]` | panel derecho: nombre/HP/estado por miembro (marca el activo) | roster + `kernel 0x8670` [= CS 0x2900 → ULTIMA.EXE:0x2900 draw_status_panel] |
| `aim?` | si `g_cmb_aim_active`: `{ cell, rangeCells[] }` | `comsubs_aim_cursor` (§7) |
| `messages[]` | ring de líneas de consola (reutiliza la consola fiel) | `ui-text-layer` (§5) |

**Eventos efímeros** (one-shot, la piel los anima con su reloj F-A; el core sólo
señala QUÉ pasó y DÓNDE, no cadencia):

- `projectile { fromCell, toCell, thing/tileId, hit, landCell }` (§2)
- `hitFlash { cell, targetKind }` (§3)
- `screenFlash { n }` (daño de terreno/evento, `kernel_flash` 0x3AE6)
- (muerte no es evento: es cambio de tile en `tiles`, §4)

### Qué pinta la PIEL (con el reloj de anim F-A)

1. **Arena**: `combatView.tiles` ENTERA con el atlas EGA (viewport/frame S8b), **sin
   máscara de visibilidad** — el combate no censura por luz (copia cruda `0x5910`,
   `combat-light-verdict.md`). Combatientes = sus `tileId` en `cell`.
2. **Cursor del activo**: recuadro/blink sobre `activeCombatant.cell` (cadencia
   libre → Clase C).
3. **Retícula de Aim**: sobre `aim.cell`, resaltando `rangeCells` (opcional).
4. **Proyectil**: interpola `fromCell→toCell` (celda o píxel, libre); glifo = el
   `thing`; explosión/impacto en `landCell`.
5. **Impacto**: invertir/parpadear `hitFlash.cell`.
6. **Panel de party** + **consola**: componentes ya existentes (S8a/S8b).
7. **SFX**: swing/impacto/aim/muerte ya en el catálogo PC-speaker (task #3,
   `sfx-catalog.md`); disparar en los eventos correspondientes.

### Qué es CLASE C (píxel-diff / catálogo AV — task #4/#26, medir en vídeo D)

- Cadencia del **parpadeo del recuadro** del activo y de la **retícula de Aim**.
- **px/frame** del proyectil (13/6/8 observados) y el delay `kernel 0x3ee8(0x28,1)`
  → nº de frames/velocidad percibida; nº de fotogramas del misil (4).
- **Duración** del invert de `hitFlash` y nº de flashes de `kernel_flash`.
- **Chispas** de la explosión (`comsubs_projectile_anim` tail): forma/nº exacto de
  píxeles (los 4 rands son de RNG, pero el patrón visual es cosmético).
- Timbres exactos de los beeps (freq/dur ya derivados en §3/§7 — el catálogo AV
  confirma el sonido percibido).
- Transiciones de entrada/salida de la arena (si el vídeo muestra fade/wipe).

### Estimación de cableado

**Tamaño M.** El motor (`game/src/core/combat/`) ya calcula TODO (hit/daño/muerte/
proyectil/aim, con paridad). El trabajo de S12 es:

1. **Snapshot**: añadir `combatView` (el core ya tiene el buffer 11×11 y los regs;
   es proyectar a la vista SÓLO-visible) + emitir los 3-4 eventos efímeros en los
   puntos donde el motor ya resuelve proyectil/hit/flash. **S** (mapear estado
   existente).
2. **Piel** (`game/src/skins/fiel/`): componente de arena que reusa el compositor
   de mundo (viewport S8b) + overlays de cursor activo / retícula / proyectil /
   flash con el reloj F-A. **M** (varios overlays nuevos, todos con estado ya dado).
3. **Cadencias Clase C**: dejar constantes de animación configurables y calibrarlas
   contra vídeo D en task #26 (píxel-diff). **No bloquea** el cableado inicial.

Ningún hallazgo de mecánica nueva → **sin entrada en `deliberate-divergences.md`**.
El único ajuste conceptual es la corrección del stepper (`0x43ae` es sonido; el real
es `comsubs_projectile_flight` COMSUBS:0x12DE + painter `comsubs_projectile_anim`
0x0F4A), ya reflejado en el ledger.
