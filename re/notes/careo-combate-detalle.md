# Careo a todo detalle: combate normal — port vs material original

**Carril:** careo-combate (docs/careo-combate) · 2026-07-22 · CAREO PURO (cero fixes).

## Material y método

| Fuente | Qué es | Uso |
|---|---|---|
| `original/av-referencia/endgame/doom-n6-combate-20260721.mov` | «Nivel 6 combate» del usuario (DOSBox, 9:16, party 6, dragones+daemons, sala Doom N6) | log denso, casts, huida («BATTLE IS LOST!») |
| `original/av-referencia/video-J-combate-overworld.mov` | Combate overworld completo (86 s): party 3 (javier/Shamino/Iolo, **mismo INIT que el port**) vs ORCS; entrada→victoria→botín→salida | careo línea a línea + medidas |
| `original/av-referencia/video-O-combate-ratas-ui.mov` | Combate ratas con UI (74 s) | contraste del parpadeo + strings |
| Port vivo | worktree careo-combate2 @ main 47896cfc, vite :5252, `?skin=faithful&nointro&fresh&x=60&y=60`, orco (def 32) sembrado vía `__u5test`, combate ENEMY-INITIATED (Pass) | transcripciones `consoleLines()` + canvas |

Medidas de tiempo del original: extracción de frames con pts nativos (ffmpeg) + conteo de
píxeles por región (signalstats / PIL). Los .mov son VFR con frames al cambio (~10-17 ms de
granularidad): las duraciones de fase son fiables.

Capturas: scratchpad de la sesión (`n6-sheet*.png`, `j-*.png`, `o-full-t20.png`,
`j-blink-sheet.png`, `port-combat-board.png`).

**Suerte de careo:** la party INIT del port (javier 60G / Shamino 5G / Iolo 90G, mismas armas)
es byte-idéntica a la del vídeo-J → careo 1:1 de las líneas con la MISMA situación.

## Tabla por dimensión

Veredictos: **(a)** = calca verificada · **(b)** = divergencia con evidencia · **(c)** = sin verificar / pendiente de testigo.

### 1. Entrada

| Aspecto | Original (evidencia) | Port | Veredicto |
|---|---|---|---|
| Pre-línea enemy-init | `▷North` → `Attacked!` impresa AÚN en overworld (vídeo-J t≈1.7-1.9) | `Attacked!` | (a) |
| Identificación de grupo | `      ORCS` centrada (ancho 16) | idéntico | (a) |
| Banner | `✦✦✦ CONFLICT ✦✦✦` EN UNA LÍNEA (16 chars exactos) | **se parte en `*** CONFLICT` + `***`** | **(b) → T6 (wrap)** |
| Transición | corte instantáneo overworld→tablero, TODO colocado de golpe (≤50 ms, sin wipe ni aparición escalonada) | corte instantáneo | (a) |
| Prompt 1er turno | `Shamino, armed with Short Sword:` ~150-250 ms tras el corte | idéntico (texto) | (a) |
| Nº de enemigos | **4 orcos** vs party de 3 (vídeo-J); 6+ en n6 | **SIEMPRE 1** (`game.ts:5292` `count: 1`) | **(b) → T4** |
| Formación party | triángulo sur (3 PJ) | triángulo sur (5,7)/(6,8)/(4,8) | (a) |

### 2. Indicador de activo

| Aspecto | Original (MEDIDO) | Port | Veredicto |
|---|---|---|---|
| Fila del roster en inverso | fija SÓLIDA durante el await (683 ms continuos en J; sigue al actor por turno) | sólida, sigue al actor | (a) |
| Recuadro blanco del activo en tablero | **PARPADEA**: vídeo-J 2.5-3.15 s ON≈49 ms/OFF≈60 ms; vídeo-O 18.5-19.3 s ON≈52 ms/OFF≈60 ms (9 ciclos limpios) → **ciclo ≈110 ms ≈ 9 Hz** (≈3.5-4 frames VGA 70 Hz por fase). Alterna sprite-normal ↔ sprite-con-marco (j-blink-sheet.png) | **SÓLIDO** — `skin/fiel/combat.ts:361-370` lo dejó fijo citando «en el vídeo-O … no parpadea a ojo»; **esa cita queda falsificada por la medición del propio vídeo-O** | **(b) → T3** |
| Retícula de aim (cruz doble partida) | forma = calca (frames del vídeo-J con cruz sobre el orco); cadencia de parpadeo sin testigo limpio (el usuario apunta rápido) | parpadea ~4-5 Hz (fase 100-125 ms medida en canvas), forma ASM 0x5813 | forma (a) · cadencia (c) → T12 |
| Nota | en vídeo-O hay un tramo 19.30-19.87 s con el recuadro FIJO 575 ms (¿estado de aim/resolución?) — refinar con testigo si se implementa T3 | | (c) |

### 3. Log — careo línea a línea

Turnos equiparables (mismo INIT, orco(s), melee):

| Situación | Original (vídeo-J/n6, literal) | Port (transcripción viva) | Veredicto |
|---|---|---|---|
| Banner de turno | `Shamino, armed with Short Sword:` / `Iolo, armed with **Main Gauche, Short Sword**:` / n6: `Geoffrey, armed with **Spiked Helm, Mace, Spiked Shield**:` | `Iolo, armed with **Main Gauche**:` — solo la mano principal (`main.ts:952-960`, `rec.weapon`) | **(b) → T5** |
| Eco de movimiento | `▷North` / `▷South` / `▷East` en CADA paso (docenas en ambos vídeos) | **NADA** (mueve sin eco) | **(b) → T2** |
| Eco de ataque | `▷Attack-Aim!` | `►Attack-Aim!` (chevron ✓) | (a) |
| Melé sin objetivo | `Nothing!` | `Nothing!` | (a) |
| Paso bloqueado | `Blocked!` | `Blocked!` | (a) |
| Fallo del PJ (melé) | `Orc missed!` (nombra al OBJETIVO) | **SILENCIO** (evento `attacked` con texto, `combatOut` solo imprime `kind==="message"` — main.ts:1466-1471) | **(b) → T1** |
| Roce | `Orc grazed!` / n6 `Daemon grazed!` | **SILENCIO** (mismo motivo, combat.ts:1183-1237) | **(b) → T1** |
| Herida | `Orc barely/lightly/heavily wounded!`, `Dragon critical!` | idéntico (labels exactos, `message` ✓) | (a) |
| Muerte | `Orc killed!` / `Giant Rat killed!` (vídeo-O) | **SILENCIO** (evento `died` no impreso; combat.ts:1364-1372) | **(b) → T1** |
| Golpe enemigo a PJ | `javier hit!` / `Iolo hit!` / n6 `Geoffrey hit!` | **SILENCIO TOTAL** (hp baja sin línea; además el texto interno del evento es `"Orc hits javier for 7."` — formato FABRICADO que el original no usa jamás) | **(b) → T1** |
| Fallo melé de la IA | silencio (ningún vídeo muestra línea) | silencio (fiel por ASM 035b-035f) | (a) |
| Pass | (sin testigo de Space en los vídeos) | `Pass` | (c) |
| Victoria | `VICTORY!` | `VICTORY!` | (a) |
| Prompt+cursor del await | `▷` + cursor parpadeante bajo el banner (j-full-t3) | **ausente en combate** (en overworld SÍ existe) | **(b) → T8** |

### 4. Cadencias

| Aspecto | Original (MEDIDO) | Port | Veredicto |
|---|---|---|---|
| Acciones/líneas de turno enemigo | **~380-430 ms entre líneas** durante las tandas enemigas (n6 t=30-42 s, serie de log-changes: 34.27/34.65/35.08/35.46/35.78/36.32/36.65…) | **instantáneo** — `pumpCombat` resuelve TODOS los turnos enemigos en un while sin pausa (main.ts:1483-1495) | **(b) → T11** |
| Estallido de impacto (8 puntas) | **≈200 ms** (una medida limpia: yellow-jump 22.044→22.240 s en vídeo-J; corrobora el sheet a 8 fps: 2 frames) | 120 ms (`HIT_FLASH_MS`, skin/fiel/combat.ts:81) | **(b) → T10** |
| Parpadeo recuadro activo | ciclo ≈110 ms (≈9 Hz) | n/a (sólido) | → T3 |
| Proyectiles | sin testigo medido en estos vídeos | 55 ms/celda (`PROJECTILE_MS_PER_CELL`) | (c) |

### 5. Detalles

| Aspecto | Original | Port | Veredicto |
|---|---|---|---|
| Roster HP+status | `60G` (HP+letra), inverso de fila completa | idéntico | (a) |
| Chevron de eco | `▷` banderín azul-blanco (j-exit-sheet) | `►` equivalente | (a) |
| Sangre al morir | mancha roja persistente en la celda | mancha roja (tile 0x1F, roll rand30 vs treasure) | (a) |
| Cofre de botín | cofre en celda de muerte cuando el roll da tesoro (vídeo-J: 2 cofres de ~6 orcos); `Open-North → Trapped! ACID! → Found: some food! some torches! a ring of keys! a sack of gold! a weapon!`; `Get-West → 3 gold! / 2 keys! / 1 food! / Nothing to get!` | mecanismo derivado idéntico (chestRoll + chestContents; este orco tiró sangre — resultado RNG plausible). Get/Open de arena con eco de dirección (`pendingCombatDir`) | mecanismo (a) · strings de Open/Get de arena **(c)** — sin careo vivo esta sesión |
| Salida post-victoria | `▷South / Leave!` por miembro (j-exit-sheet; SIN «Escape!») | `Escape!` por miembro + `Leave!` final | **(b) → T9** |
| Huida pre-victoria | `Escape!` por miembro + `All must use the same exit!` + `BATTLE IS LOST!` (n6) | `Escape!` + `BATTLE IS LOST!` observados; same-exit en código | (a) |
| Chrome del viewport en combate | **banner de vientos** (`>East  Winds<`) **y astro** siguen visibles en TODOS los frames de combate (ambos vídeos; en mazmorra `Dir: South`) | **desaparecen** al entrar en combate (reaparecen al salir) | **(b) → T7** |
| Animación idle de sprites | sí (espada arriba/abajo, ~2 fps, independiente del parpadeo) | sí | (a) |

### 6. Fuera de guion (observado de paso)

- n6: cast XEN CORP / scroll Negate-time → **flash blanco de tablero completo** (frame t≈120 s
  del overview) — pertenece al carril cast/fx, anotado como testigo disponible.
- n6: `Dragon gates in a daemon!` (invocación), `X-it what?` (eco de comando inválido),
  `Failed!` de cast — strings ya en corpus de otros carriles.
- Port: `Welcome to Britannia!` como línea 1 del boot fresco (sin careo aquí).

## Tickets candidatos (rankeados)

| # | Título | Evidencia | Gravedad |
|---|---|---|---|
| **T1** | **Resultados de combate silenciados**: `X killed!`, `X missed!` (ataque PJ), `X grazed!`, `<PJ> hit!` (golpe enemigo) no se imprimen — `combatOut` (main.ts:1466) solo imprime `kind==="message"`; los eventos `attacked`/`died` llevan el texto pero se descartan; el texto interno del hit enemigo (`"{} hits {} for {}."`, combat.ts:1290) es además un formato fabricado | transcripciones vivas + vídeo-J/O/n6 (docenas de líneas) | ALTA — el log de combate del original es en su mayoría ESTO |
| **T2** | **Eco de dirección de movimiento ausente** (`▷North`…) en cada paso de combate | vídeos (docenas) vs transcripción viva | ALTA |
| **T3** | **El recuadro del activo debe PARPADEAR ~9 Hz** (fase ON≈50 ms/OFF≈60 ms); el port lo dejó sólido citando vídeo-O «no parpadea a ojo» — medición del MISMO vídeo lo falsifica | medidas J+O (este doc §2) · skin/fiel/combat.ts:361-370 | ALTA (visual constante) |
| **T4** | **Encuentro spawnea 1 solo enemigo** (`count: 1`, game.ts:5292); original: 4 orcos vs party 3 | vídeo-J entrada · n6 | ALTA (estructura del combate; mecanismo de count SIN derivar → oráculo/ASM) |
| **T5** | **«armed with» solo lista la mano principal**; original enumera todo lo ready con ataque (2ª mano, Spiked Helm/Shield) | `Iolo, armed with Main Gauche, Short Sword:` (mismo INIT) · n6 Geoffrey 3 items · main.ts:952-960 | MEDIA |
| **T6** | **Word-wrap off-by-one en líneas de 16 chars exactos** (`*** CONFLICT ***`, `Iolo, armed with`) — se parten; en el original caben | capturas port vs frames | MEDIA |
| **T7** | **Vientos + astro desaparecen del chrome en combate**; el original los mantiene (y `Dir:` en mazmorra) | todos los frames de combate vs captura port | MEDIA |
| **T8** | **Falta `▷`+cursor parpadeante en el await de combate** (sí existe en overworld) | j-full-t3 vs capturas port | MEDIA |
| **T9** | **Salida post-victoria imprime `Escape!` por miembro**; original imprime `Leave!` (por miembro que sale; `Escape!` es solo de la huida pre-victoria) | j-exit-sheet vs transcripción | MEDIA |
| **T10** | **Estallido de impacto 120 ms → ~200 ms** | medida §4 · HIT_FLASH_MS | BAJA (1 medida limpia; tomar 2ª antes de tocar) |
| **T11** | **Turnos enemigos sin cadencia** (resolución instantánea); original ~0.4 s por acción | serie n6 §4 · main.ts:1483 | BAJA-MEDIA |
| **T12** | Cadencia de la retícula de aim (port 4-5 Hz) sin testigo original limpio | §2 | BAJA (Clase C, conseguir testigo con aiming largo) |

## Calcas confirmadas (para no re-litigar)

Secuencia de entrada (pre-línea/grupo centrado/CONFLICT — contenido y orden), corte
instantáneo, formación sur, roster inverso estable + formato `HP+status`, `Blocked!`,
`Nothing!`, `Attack-Aim!` con chevron, labels de herida exactos, silencio del fallo melé
de la IA, `VICTORY!`, sangre/cofre por roll, `Escape!`+`BATTLE IS LOST!` en huida,
`All must use the same exit!`, `Leave!` al cerrar, glifo del chevron, idle-anim de sprites,
cruz de aim (forma).
