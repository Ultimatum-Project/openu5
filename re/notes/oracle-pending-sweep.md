# Barrido de pendientes del oráculo — scout `oracle-pending-sweep`

Cierre de los pendientes del espejo por estado (F3-T2) que esperaban "ventana del
usuario". Objetivos: (A) ascender los 7 PENDING_BP de `re/tools/mirror_globals.py`,
(B) derivar el formato de `SAVED.OOL`, (C) witnesses menores.

**Nota de arnés — RUNTIME:** al primer intento había un **dosbox-x del USUARIO vivo**
(`MOUNT C .../original/u5/play`) y se PARÓ (regla original). El lead luego autorizó tratar el
dosbox del usuario como **confound de CPU** (no abortar; retry×1, si persiste declarar
INTENTADO "confound"). Con eso se corrió runtime sin flakiness:
- **Espejo headless sancionado 2/2 PASS vs engine real de 1988** (186 s, `U5RE_MIRROR_ALLOW_FOREIGN=1`,
  `original/` symlinkeado al worktree y ya retirado): validó el ascenso de `shadowlordSummoned`
  (rel 0x325) end-to-end — `shadowlordSummoned exp(gam)=255` ✓ (DS==.GAM, round-trip por el
  loader), + `shipHull=99` ✓, `shipSkiffs=2` ✓ y los DS_RUNTIME previos.
- **Índices de color del chrome (Objetivo C) leídos en vivo del DS** (1 boot).
El resto (Objetivo A estático + B) se cerró por derivación (disasm + `re/notes/` + `saveNative.ts`
+ diff de ficheros). Único residual: la emboscada "attacks!" (INTENTADO, ver Objetivo C).

Contexto clave: **F3-T2 aterrizó en `main`** ya con la review §P1 aplicada. El barrido
CORROBORÓ esa reclasificación de forma independiente y cerró los 3 PENDING honestos (→ 0).

---

## OBJETIVO A — los 7 PENDING_BP

Estado tras el barrido + reclasificación final (decisión del lead): **PENDING_BP = 0
reales**. 3 ascendidos a DS_RUNTIME (shipHull/shipSkiffs por review §P1 + shadowlordSummoned
por este scout), 2 a EXCLUSIÓN por review §P1 (windDriftCtr/hmsCapeToggle), y los 2 últimos
reclasificados a **CLONE_ONLY** (doomBits = cubierto-por-WINDOW/alias; blackthornPass =
derivado de timeSpell). Además `wind` se movió DS_RUNTIME → EXCLUSIÓN (ver abajo).

| campo | veredicto | offset / evidencia |
|---|---|---|
| `windDriftCtr` | **LOGRADO → EXCLUSIÓN #16** (ya en main) | `g_wind_drift_ctr` 0x5883 (transport.md:24,§3): contador de cadencia de la deriva de viento por idle = la divergencia declarada #16. |
| `shipHull` | **LOGRADO → DS_RUNTIME** (ya en main) | `g_hull` 0x5C5F = obj0+5 (objects.md:11, transport.md:32,250; MAINOUT 0x0D7B), rel **0x6B9** dentro de la ventana. |
| `shipSkiffs` | **LOGRADO → DS_RUNTIME** (ya en main) | `g_skiffs` 0x5C61 = obj0+7 (transport.md:33,250; MAINOUT 0x0D45), rel **0x6BB**. |
| `hmsCapeToggle` | **LOGRADO → EXCLUSIÓN** (ya en main) | `g_cape_toggle` [0xA524] (transport.md §5): fase de turno transitoria FUERA del bloque (0x6606 < 0xA524), no persistida. (La posesión persistente del Cape ya es el campo WINDOW `special.hmsCape` rel 0x215 = `g_hms_cape` 0x57BB.) |
| `shadowlordSummoned` | **LOGRADO → DS_RUNTIME + CONFIRMADO EN VIVO** (este scout) | `g_shadowlord_here` **0x58CB** = rel **0x325**, dentro de la ventana. El ritual lo escribe (`[0x58cb]=idx`, CAST 0x10bd; shadowlord-ritual.md:66) y lo relee como gate de destrucción (0x16c9). El port fija `state.shadowlordSummoned = res.idx` (game.ts:2385). **La nota vieja citaba 0x5958, el global EQUIVOCADO** — shadowlord-ritual.md:132-133 lo distingue expresamente (`g_shadowlord_here_idx` 0x5958 = presencia en CIUDAD/merma de tienda, no el ritual). **Engine real:** gate headless leyó `shadowlordSummoned exp(gam)=255` ✓ (DS[0x58CB]==.GAM[0x325]). |
| `shadowlordDoomBits` | **LOGRADO → CLONE_ONLY** (cubierto-por-WINDOW/alias) | OR de doom-bits 0x02/0x04/0x08 en word **[0x5bca]** (CAST 0x171d; shadowlord-ritual.md:88). 0x5bca **ALIASA** `g_npc_dead_bitmap` (rel 0x624, DENTRO del campo WINDOW `npcDead` 0x5b4+128; shadowlord-ritual.md:135-138): comparar el byte suelto duplicaría bits de npcDead → cubierto por `npcDead`. No hay byte doom independiente. |
| `blackthornPassGranted` | **LOGRADO → CLONE_ONLY** (derivado de `timeSpell`) | Gate del peaje del Palacio (TALK 0x02a4) = `cmp g_time_spell,0x1d ; je pass` (blackthorn.md:272,347). Predicado de `g_time_spell` (0x587A, ya espejado como `timeSpell`); el original re-evalúa el disfraz Black Badge cada vez, NO persiste un flag "pass granted". Flag de conveniencia del clon sin byte propio (game.ts:2573,3115). |
| `wind` (extra) | **LOGRADO → EXCLUSIÓN** (GT-ch01 FAIL FLAKY) | `g_wind` 0x5892: el ESPEJO REAL de GT-ch01 probó que el original **re-tickea el viento con RNG de reloj de pared AL BOOTEAR** (DS=3 en un boot, =0 en otro, con el .GAM guardando 0 correcto) → comparar la dirección VIVA da FAIL FLAKY. Se compara sólo lo guardado (.GAM); la deriva viva se excluye (análogo a #16/#17, spec §3.3/§3.5). Movido DS_RUNTIME → EXCLUSIONS. |

**Ediciones aplicadas a `mirror_globals.py` / `test_mirror_globals.py` (este scout):**
- `shadowlordSummoned` **PENDING_BP → DS_RUNTIME** `rel=_abs(0x58CB)` (0x325), con nota que
  cita CAST 0x10bd/0x16c9 y corrige el candidato equivocado 0x5958. Cotejo como los
  existentes: añadido a `_DS_RUNTIME_FROM_NOTES` (offset derivado en notas, no en
  globals.json — igual patrón que shipHull/shipSkiffs). Es DS_RUNTIME **condicional**: en un
  save típico sin SL invocado la clave está ausente → SKIP; con un save real con SL
  invocado, DS[0x58CB] debe == sidecar (un FAIL sería HALLAZGO, p.ej. residuo tras destruir).
- `shadowlordDoomBits` / `blackthornPassGranted`: **PENDING_BP → CLONE_ONLY** (decisión del
  lead). doomBits = cubierto-por-WINDOW (alias en `npcDead`, size 0, no comparado); blackthorn
  = derivado de `timeSpell` (size 0). Con esto **PENDING_BP = 0 reales**. NO se inventa offset.
- `wind`: **DS_RUNTIME → EXCLUSIÓN** (segunda ronda del lead; GT-ch01 FAIL FLAKY, ver tabla).
  El espejo ya no compara la dirección viva; se cita en EXCLUSIONS con `sidecar_key="wind"`.
- Conteos finales: `window` 53, **`ds-runtime` 8** (salió wind), **`pending-bp` 0**,
  **`clone-only` 9** (+doomBits +blackthornPass). Tests offline **19/19** (+1 skip por av-saves
  gitignored). **Headless gate 2/2 PASS vs engine real** (corrido con el ascenso de
  shadowlordSummoned; la reclasificación posterior sólo QUITA comparaciones → no puede
  introducir FAIL nuevo, validado offline).

**Confirmado en vivo:** el gate headless leyó el byte 0x58CB del engine real (DS==.GAM). La
corroboración por ritual (USE Shard en la sala del SL → leer DS 0x58CB == idx invocado) queda
como confirmación semántica OPCIONAL — el ascenso ya está validado (offset derivado + engine).

---

## OBJETIVO B — formato de `SAVED.OOL`

**LOGRADO por derivación estática** (comparación de ficheros + disasm; sin boot).

- **`SAVED.OOL` = 512 B = bloque OVERWORLD (256 B, offset 0x000) ++ bloque UNDERWORLD
  (256 B, offset 0x100).** Confirmado: en el save recién iniciado `play/`, `SAVED.OOL[0:256]`
  ≡ `BRIT.OOL` y `SAVED.OOL[256:512]` ≡ `UNDER.OOL` byte a byte. `BRIT.OOL`/`UNDER.OOL`/
  `INIT.OOL` son 256 B cada uno = plantillas de siembra de cada bloque.
- **Cada bloque de 256 B = 32 registros × 8 B** — MISMO stride que la tabla de objetos del
  SAVED.GAM (`g_char_anim_states`/`g_world_objects` 0x5C5A, 32×8). En el save `ultima5/` el
  bloque underworld muestra 5 registros de monstruo de libro de texto:
  `29 29 0E F2 FF 00 00 00`, `1E 1E 67 E2 FF 00 00 00` (×4 más) en 0xB8,0xC0,0xC8,0xD0,0xD8.
- **Layout del registro (8 B)** = el de la tabla de objetos (transport.md §6/§7, objects.md):
  `+0/+1` par de tiles (sprite + frame de animación), `+2` X, `+3` Y, `+4` floor/flag
  (0xFF en los monstruos underworld), `+5` casco/contador, `+6` ?, `+7` skiffs/acumulador.
  El registro 0 del bloque overworld es el **avatar/party** (`1C 1C 56 6B …` = tile avatar,
  x=0x56, y=0x6B). En `ultima5/` los registros overworld 1..16 tienen sólo `+6` poblado
  (0x10/0x20/0x30/0x42/0x70/0x80…): unidades del overworld en estado dormido (tile 0) con un
  contador `+6` — semántica exacta de `+5/+6/+7` para monstruos dormidos pendiente de un diff
  con overworld poblado.
- **Disasm del writer:** el guardado (INTRO 0x1e00-ish) limpia un buffer 0x100 en `0xb21e` y
  escribe `SAVED.OOL` (string 0x3641) + `SAVED.GAM` (0x364b) vía write-file `0xa418`
  (intro.md:183). El loader del Journey Onward carga `SAVED.OOL` (0x3249) y las plantillas
  `BRIT.OOL`/`UNDER.OOL` (0x3252/0x325c); `outsubs_world_filename` (`OUTSUBS.OVL:0x0368`,
  el censo la llama `map_table_ptr_by_floor`) devuelve
  `BRIT.OOL`/`UNDER.OOL` (DS 0x3989/0x3992) según `g_floor` (kernel-survival.md:282).

  > CORRECCIÓN (barrido de citas de notas): decía «kernel 0x0368», y no es del kernel —
  > la propia prosa ya lo delataba al llamarla `outsubs_`. `OUTSUBS.OVL:0x0368` es inicio
  > de rutina del censo (prólogo `55 8b ec` tras el `ret 4` de 0x0364), se llama INTERNA
  > desde OUTSUBS:0x040c, y su primera instrucción es `cmp byte ptr [g_floor], 0` — que
  > es exactamente el criterio que esta línea describe. DISCREPANCIA ABIERTA, no
  > resuelta aquí: el censo la nombra `map_table_ptr_by_floor` y esta nota
  > `outsubs_world_filename`; uno de los dos nombres sobra.

Relación con el port (`overworldEnemies` en el sidecar, CLONE_ONLY): el clon modela los
enemigos del overworld aparte; **NO se cargan al hacer Journey Onward** (el espejo de estado
los excluye por diseño, §3.3). Con esta derivación, si en algún momento se persiste
`SAVED.OOL`, el formato objetivo es el de arriba (2×256, 32×8).

**PENDIENTE (refinamiento, no bloqueado):** diff de `SAVED.OOL` antes/después de un save real
EN OVERWORLD con monstruos activos, para fijar la semántica exacta de `+5/+6/+7` de los
registros de monstruo overworld (el ejemplo estático los tiene dormidos). El formato (2×256,
32×8) ya está derivado; esto sólo afina los 3 últimos campos del registro.

---

## OBJETIVO C — witnesses menores

- **Índices de color runtime del chrome (0x13b0/0x13b2…): LOGRADO (lectura en vivo).**
  Son `g_unk_13b0/13b2/13b8/13ba` (globals.json), **words LE** (0..15 EGA) que el driver
  escribe en runtime (drivers-drv.md §2.4: "qué número 0..15 escribe" es lo único no derivable
  estáticamente; kernel-sweep-2.md:95 `set_color([13b2])`). Leídos del DS tras Journey Onward:

  | offset | valor | EGA | offset | valor | EGA |
  |---|---|---|---|---|---|
  | 0x13B0 | **15** | blanco | 0x13B6 | **5** | magenta |
  | 0x13B2 | **1** | azul | 0x13B8 | **14** | amarillo |
  | 0x13B4 | **2** | verde | 0x13BA | **7** | gris claro |

  Dump `0x13B0..0x13BB`: `0F 00 01 00 02 00 05 00 0E 00 07 00`. Insumo directo para cotejar
  la paleta del chrome de la piel fiel (`FRAME_FILLS`, ui-text-layer.md).
- **"attacks!" tras "Ambushed!" en la emboscada de acampada (0xdf80): INTENTADO.** Witness
  Clase C conocido (camp-ambush-resolution.md punto 4): "Ambushed!" (DS 0x41e0) se imprime en
  CMDS 0x0247 ANTES del spawn; lo pendiente es si la rutina de combate residente 0xdf80 AÑADE
  "{name} attacks!". No es leíble por `screen_text()` (modo gráfico EGA, no texto) → exige
  **instrumentar con BP el print de 0xdf80 durante una rama de emboscada forzada** — experimento
  enfocado fuera del presupuesto de esta sesión (gate probabilístico + confound). Único residual.

---

## Qué queda de verdad para el usuario / próximas ventanas de oráculo

1. **"attacks!" de la emboscada de camp (Objetivo C):** único residual de runtime — exige un
   BP en el print de 0xdf80 durante una rama de emboscada forzada (ver arriba). Sesión de camp
   enfocada; corre como confound, no necesita ventana limpia.
2. **`SAVED.OOL` (Objetivo B, refinamiento):** diff con overworld POBLADO de monstruos para
   cerrar la semántica exacta de `+5/+6/+7` de los registros de monstruo overworld (el formato
   512 B = 2×(32×8) ya está derivado).

**Cerrado por este scout (no queda pendiente):** los 3 PENDING honestos (shadowlordSummoned →
DS_RUNTIME confirmado en vivo; doomBits/blackthornPass → CLONE_ONLY por decisión del lead);
`wind` → EXCLUSIÓN (GT-ch01); índices de color del chrome (lectura en vivo). **PENDING_BP = 0.**
