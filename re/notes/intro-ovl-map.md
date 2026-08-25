# intro-ovl-map.md — mapa de derivación de INTRO.OVL + censo de binarios (Task #13, scout)

Fecha 2026-07-14. Scout de solo-lectura. Cierra el "gap del scout UI" (ui-render-map
§8 fila 2 / §11 punto 5) y el censo de binarios pendiente del mandato "nada sin leer"
(task #16). **No** re-deriva byte a byte; entrega el MAPA para trocear la lectura al
100% y los puntos de entrada por pantalla para la piel fiel (E1-S13).

> **ACTUALIZADO 2026-07-14 (lectura 100%):** la derivación fina completa está en
> **`re/notes/intro.md`** (barrido total task #16). Ese documento **corrige** dos
> conclusiones de este scout: (1) INTRO **sí** secuencia "The Summoning" (`play_introduction`
> 0x14e, 21 escenas STORY1.16); (2) `0x132a` es la pantalla de **Transfer from Ultima IV**,
> no la hoja de Journey Onward. Los §3/§4/§6 de abajo quedan como el mapa estructural;
> para la verdad derivada, ver `intro.md`.

---

## 0. Corrección de encuadre — el mito de los "131 KB"

El tasking (task #13, ui-render-map §8/§11) describe INTRO.OVL como **"131 KB, sin
derivar"**. Ambas mitades son inexactas:

- **Tamaño real: `INTRO.OVL` = 8.400 bytes (0x20D0).** Los "131 KB" son el tamaño del
  **texto del disasm** `re/disasm/INTRO.OVL.asm` (133.729 B) — un fichero de líneas
  `offset: bytes  mnemónico`, no el binario. El disasm ya existe (generado 2026-07-10
  con el resto).
- **Ya está cubierto a nivel de partición**: `re/tools/intro_catalog.py` (Task F.1) lo
  parte en 18 funciones + preámbulo + padding, con `gaps==[]`; el ledger lo marca al
  100%. Y `re/notes/gypsy.md §"Mapa de funciones de INTRO.OVL"` (Task 3.11) ya nombró
  los 17 prólogos con su rol.

Lo que **falta** no es "abrir INTRO.OVL" sino **derivar en fino** las ~9 funciones
helper que el catálogo dejó como "rol por nombre" y confirmar el reparto de trabajo de
la intro (abajo). El gap es real pero mucho más estrecho de lo anunciado.

**Corrección de fondo (reparto de la intro):** INTRO.OVL **NO** contiene la cinemática
"The Summoning" ni la gitana. Es el **menú de portada interactivo + ruta de
transferencia de Ultima IV + hoja de personaje**. Ver §3.

---

## 1. Censo de binarios (Task 0) — ¿qué código EJECUTABLE no está en el corpus RE?

Listado completo de `original/u5/ultima5/` contrastado contra `re/COVERAGE.md` +
`re/ledger/coverage.json`. Clasificación por tipo.

### 1.1 Motor del juego — CUBIERTO al 100% (ledger F.1)
`ULTIMA.EXE` (kernel) + 24 overlays + `DATA.OVL` = 202.800 B, todo en `coverage.json`.
No hay ningún overlay/EXE del motor fuera del ledger. **INTRO.OVL entra aquí** (cubierto).

### 1.2 Código NO cubierto — hallazgos del censo

| Fichero | Bytes | Qué es | ¿En scope? | Nota |
|---|---:|---|---|---|
| **`CHOICE.EXE`** | 49.152 | **PE32 console (Win)**, utilidad Microsoft `CHOICE` | ❌ NO | No es código de U5. Es el `choice` que usa `run.bat` para el menú DOSBox 1/2/3. Cabecera `MZ…This program cannot be run in DOS mode` + `.text/.data/.reloc` PE. Descartar. |
| **`CGA.DRV`** | 8.135 | Driver de vídeo CGA (8086, jump-table `e9 …` al inicio) | ◐ código real del juego, **sin RE** | Driver de gráficos; el kernel lo carga por far-call. ABI de jump-table. |
| **`EGA.DRV`** | 11.654 | Driver de vídeo EGA | ◐ **sin RE** | El modo real de la versión que jugamos. |
| **`HER.DRV`** | 9.087 | Driver de vídeo Hercules | ◐ **sin RE** | |
| **`T1K.DRV`** | 7.733 | Driver de vídeo Tandy 1000 | ◐ **sin RE** | |
| `upgrade/` (subdir, 195 ficheros) | — | **Reedición 1996 "updated version"** (MIDI/DPMI) | ❌ NO | Es la rama `ultima5.com` de `run.bat` (opción 2). Contiene copias de los overlays + extras de terceros (ver 1.3). Distribución aparte, fuera del mandato "original". |

### 1.3 `upgrade/` — desglose (por si el usuario pregunta; todo fuera de scope)
- `ULTIMA5.COM` (592 B) — stub lanzador de la reedición.
- `CWSDPMI.EXE` (21 KB) — host DPMI (DOS extender, **third-party**).
- `SETM.EXE` (42 KB), `u5cfg.exe` (77 KB), `u5data.exe` (76 KB) — setup/config de la reedición.
- `*MIDPAK.COM` (C/M/P/S/T, ~13 KB c/u), `mid.drv` — **Miles Sound System** (middleware MIDI, third-party).
- Copias de los 24 overlays + 4 `.DRV` (algunos difieren en bytes del original, p.ej.
  `ENDGAME.OVL` upgrade 2.864 vs original 2.800). **No** son el binario de referencia.

### 1.4 Datos (ya parseados por el extractor, no son código)
`*.DAT/.TLK/.NPC/.16/.4/.CBT/.BIT/.PTH/.OOL/.CH/.HCS/.PCS/.GAM` = assets. `QUESTION.DAT`,
`STORY*.16/.DAT`, `CREATE.16/.4`, `STARTSC.16/.4`, `TITLE.BIT` son los assets de la intro
(→ §4). Fuera del alcance "código".

**Veredicto del censo:** el único código **del motor** relevante y sin derivar en fino
son los **4 drivers de vídeo `*.DRV`** (~36 KB en total). No aportan lógica de juego —
son primitivas de dibujo por hardware que la piel fiel **no** reproduce (el original
compone en buffer de tile-ids, ui-render-map §11.1). Valor de RE bajo salvo para
cadencias/paleta exactas (que de todos modos son 🎥 catálogo AV). `CHOICE.EXE` y
`upgrade/` son ruido de la distribución, no de U5. **INTRO.OVL NO era el "único gap
grande": ya estaba disasm+catalogado; el gap grande de código sin tocar son los .DRV,
y son de bajo valor.**

---

## 2. INTRO.OVL — estructura (formato + segmentos)

- **Formato:** overlay PLINK86 estándar, igual que los otros 23. **Sin** cabecera MZ
  propia (es un overlay, no un EXE): empieza directo en un preámbulo de datos de 16 B y
  luego prólogos Phoenix-C `55 8B EC` (`push bp; mov bp,sp`). Los `call 0xffffXXXX` del
  disasm lineal son **near-calls a wrap negativo** = llamadas al segmento kernel (p.ej.
  `call 0xffff8a62` → kernel `0x8a62` [= CS 0x0c22 → ULTIMA.EXE:0x0c22 gfx_select_render_target_sel0f]); INTRO comparte el layout de segmento del kernel
  y llama a sus helpers por dirección conocida.
- **Preámbulo `[0x0000, 0x0010)`** — `data`: 2 dwords + ceros (el disasm lineal lo
  decodifica como basura). El 1er prólogo real `55 8bec` está en **0x0010** (enmascarado
  en el disasm porque el preámbulo lo precede).
- **Cuerpo `[0x0010, 0x20C7)`** — 18 funciones (17 prólogos visibles + el de 0x0010).
  Verificado F.1: **todo decodifica como código coherente**, 0 runs de ceros ≥6 B
  intermedios, 0 tablas de datos inline. La "jump-table de clase" `jmp word ptr
  cs:[bx-0x6b7e]` @0x1288 referencia una tabla **externa** (DGROUP kernel), no inline.
- **Padding `[0x20C7, 0x20D0)`** — `inert`: 9 B de ceros del linker.

Reparto: **8.375 B code · 16 B data · 9 B inert · 20 segmentos.**

---

## 3. Mapa de rutinas (18 funciones) — con tamaño y profundidad de RE

Enumeración exacta (prólogos verificados contra `re/disasm/INTRO.OVL.asm`; tamaño = al
siguiente prólogo). ✅ = derivada; ◐ = rol conocido, cuerpo no derivado en fino.

| # | fileoff | tam | nombre (intro_catalog) | rol | RE |
|---|---|---:|---|---|---|
| 1 | `0x0010` | 64 | `intro_screen_setup` | setup pre-menú (loop si=0..3; kernel 0x8a62 [= CS 0x0c22 → ULTIMA.EXE:0x0c22 gfx_select_render_target_sel0f]/0x94fa/0x8b8c pintan 4 filas del título) | ◐ |
| 2 | `0x0050` | 254 | `title_region_hittest` | recorre roster-window `0x55A6` = tile-map de la portada; hit-test de región | ◐ |
| 3 | `0x014E` | 752 | `title_helper_1` | helper grande de composición de portada | ◐ **deriva** |
| 4 | `0x043E` | 162 | `draw_menu_box` | caja/realce de menú centrado (stub 0x7CC2, filas 0xC0..0xC7) | ◐ |
| 5 | `0x04E0` | 208 | `menu_draw_helper` | helper de menú/dibujo | ◐ |
| 6 | `0x05B0` | 198 | `intro_helper_2` | helper de dibujo | ◐ |
| 7 | `0x0676` | 70 | `intro_helper_3` | helper corto | ◐ |
| 8 | `0x06BC` | 114 | `intro_helper_4` | helper | ◐ |
| 9 | `0x072E` | 544 | `intro_helper_5` | helper grande (composición) | ◐ **deriva** |
| 10 | `0x094E` | 56 | `read_key_timed` | input de tecla / temporización (retorno cmp 1) | ◐ |
| 11 | `0x0986` | 1680 | **`intro_main_controller`** | **menú de portada**: imprime opciones (DGROUP `0x3182/0x318a/0x3194/0x319b/0x31a4`), lee tecla (`0x9b42` getkey), dispatch Journey Onward / Create / Transfer; carga SAVED.GAM a `0x55A6` | ◐ **núcleo, leído parcial** |
| 12 | `0x1016` | 724 | `u4_transfer_setup` | commit de nombre + setup transfer U4; `jmp cs:[bx-0x6b7e]` @0x1288 (dispatch por clase, tabla externa) | ◐ |
| 13 | `0x12EA` | 64 | `u4_stat_rescale` | reescala stats U4→U5 (`v<10→v; 10≤v<30→10+(v-9)/2; v≥30→20+(v-30)/4`) | ✅ (gypsy.md §Transfer) |
| 14 | `0x132A` | 2808 | `character_sheet` | hoja de personaje / ZSTATS-like en "Journey Onward"; deriva level/HP de exp (`level=1; cx=exp/100; while cx>0{level++;cx>>=1}; HP=maxHP=30·level`) | ◐ **la más grande** |
| 15 | `0x1E22` | 64 | `finalize_draw_helper` | helper de finalize/dibujo | ◐ |
| 16 | `0x1E62` | 196 | `intro_helper_6` | helper | ◐ |
| 17 | `0x1F26` | 362 | `intro_helper_7` | helper | ◐ |
| 18 | `0x2090` | 55 | `intro_music_start` | música intro START (stub 0x7CF2): `mov [g_snd_driver_fn],0x69; lcall` | ✅ (localizada) |

**Qué comparte con el motor:** todo su trabajo pesado lo hace **el kernel** por
near-call (print `0x9b42/0x9690`, getkey, gfx `0x86b8 kernel_fn_0878`/`0x86d2
gfx_clip_cluster` — confirmado en `ULTIMA.EXE.seg2.md`, blit `0x94fa`, `0x8b8c`). INTRO
no tiene DS propio de escena: usa la roster-window `0x55A6` y DGROUP del kernel. La
tabla de dispatch por clase (@0x1288) vive en DGROUP.

---

## 4. Reparto REAL de la intro/creación (corrige ui-render-map §8 filas 1–3)

La secuencia de arranque de U5-DOS está repartida en **3 binarios distintos + assets**.
INTRO.OVL es solo el trozo interactivo:

| Momento | Driver de código | Assets | Estado RE |
|---|---|---|---|
| **Título + llama (FLAMES)** | `FLAMES.OVL` (thunk 17 B) + animador kernel/FONT | `TITLE.BIT`, atlas de tiles | ✅ `endgame.md §FLAMES`; cadencia 🎥 |
| **"The Summoning" (cinemática)** | **`FONT.OVL` scene engine** — `load_scene 0x0418`, `scene_tick 0x02fc`, `draw_scene_cell 0x02a2`, `font_scene_init 0x04a4` (overlay compartido INTRO/ENDGAME, `font.md:7`) | `STORY*.16/.4`, `STORY.DAT`, `STARTSC.16/.4` (tabla de escenas `[0x515c+idx*2]`) | ✅ engine (`font.md`); **script/timings de escena = data-driven** ◐ + 🎥 |
| **Menú de portada** (Journey/Create/Transfer) | **`INTRO.OVL` `intro_main_controller 0x0986`** | strings DGROUP `0x3182+` | ◐ leído parcial (§3) |
| **Gitana / creación (quiz)** | **`FONT.OVL` [0x0998,0x0E52)** (`pick_virtue`/`matchup`/`create_character_main`) | `QUESTION.DAT`, `CREATE.16/.4` | ✅ `gypsy.md` (Task 3.11), portado a `gypsy.ts` |
| **Transfer de U4** (opcional) | `INTRO.OVL` `u4_transfer_setup 0x1016` + `u4_stat_rescale 0x12ea` | — | ✅ reescala; el clon no importa U4 |
| **Hoja de personaje** ("Journey Onward") | `INTRO.OVL` `character_sheet 0x132a` | — | ◐ derivar (§3 #14) |

**Consecuencia para la piel fiel:** NO esperes que INTRO.OVL contenga el guion de "The
Summoning" — ahí solo está el menú. El guion vive en el **scene engine de FONT (✅) + los
datos STORY** (assets a extraer, timings 🎥). La gitana **ya está** (FONT+gypsy.md). El
"gap grande" del ui-scout (§11.5 "cinemática de creación/summoning") es en realidad
**engine-ya-derivado + assets-a-extraer**, no código de INTRO por abrir.

---

## 5. Troceo propuesto para leer INTRO.OVL al 100% (nivel derivado)

4 lotes por afinidad de rol (cada uno cabe en una sesión de lectura tipo kernel-sweep;
formato de nota `fileoff: instrucción → regla`):

- **Lote I1 — Menú de portada (núcleo interactivo).** `intro_screen_setup 0x0010`,
  `title_region_hittest 0x0050`, `read_key_timed 0x094e`, `intro_main_controller 0x0986`
  (1.680 B, el más importante — completar el dispatch de las 3 rutas), `draw_menu_box
  0x043e`, `intro_music_start 0x2090`. ≈2,3 KB. **Es lo que necesita la pantalla de
  título/menú de la piel fiel.** Prioridad ALTA.
- **Lote I2 — Helpers de composición de portada.** `title_helper_1 0x014e` (752 B),
  `intro_helper_5 0x072e` (544 B), `menu_draw_helper 0x04e0`, `intro_helper_2/3/4`
  (0x05b0/0x0676/0x06bc), `finalize_draw_helper 0x1e22`, `intro_helper_6/7`
  (0x1e62/0x1f26). ≈2,4 KB. Cómo se pinta el tile-map de la portada + cajas.
- **Lote I3 — Hoja de personaje.** `character_sheet 0x132a` (2.808 B, la más grande;
  cruza con `zstats.md`). Deriva level/HP de exp. ≈2,8 KB. Prioridad MEDIA (la muestra
  "Journey Onward").
- **Lote I4 — Transfer de U4.** `u4_transfer_setup 0x1016` + `u4_stat_rescale 0x12ea`
  (jump-table de clase externa @0x1288). ≈0,8 KB. Prioridad BAJA (el clon no importa U4;
  reescala ya en gypsy.md).

Aparte, **fuera de INTRO** pero parte de "leer la intro al 100%": extraer/derivar los
timings de las escenas STORY (data del scene engine de FONT, Lote FONT-scenes) y los 4
`*.DRV` si el usuario exige literalmente "todos los binarios" (bajo valor, §1).

---

## 6. Qué necesita cada pantalla de la piel fiel (E1-S13, parte intro)

Puntos de entrada por pantalla cinemática relacionada con la intro (numeración de
ui-render-map §8):

- **S1 Título/FLAMES** → `FLAMES.OVL` + `INTRO.OVL:intro_screen_setup 0x0010`
  (pinta las 4 filas del título vía kernel `0x8b8c` [= CS 0x0d4c → ULTIMA.EXE:0x0d4c gfx_drv_sel4b_wrapper]) + `title_region_hittest 0x0050`
  (composición del tile-map de portada en `0x55A6`). Assets: `TITLE.BIT` + atlas.
  Cadencia de la llama 🎥.
- **S2 "The Summoning"** → **NO INTRO.** `FONT.OVL:load_scene 0x0418`/`scene_tick 0x02fc`
  + assets `STORY*.16` + tabla de escenas `[0x515c]`. Engine ✅; layout/timings 🎥.
- **S3 Gitana/creación** → **NO INTRO.** `FONT.OVL [0x0998,0x0E52)` + `gypsy.md` (✅) +
  arte `CREATE.16/.4`. La piel solo pinta cartas+preguntas; lógica ✅.
- **Menú de portada** (no numerado en §8 pero necesario para S1) →
  `INTRO.OVL:intro_main_controller 0x0986` (opciones, teclas, dispatch). **Lote I1.**
- **Hoja "Journey Onward"** → `INTRO.OVL:character_sheet 0x132a`. **Lote I3.**

**Entregable neto:** la piel fiel de la intro necesita de INTRO.OVL **solo** el Lote I1
(menú) y opcionalmente I3 (hoja). El grueso visual (Summoning, gitana, título animado)
sale de FONT (engine ✅) + assets STORY/CREATE/TITLE + cadencias 🎥 — no de abrir más
INTRO.OVL.

---

## Apéndice — verificación
```
grep -cE "^[0-9a-f]{4}: 55 +push bp" re/disasm/INTRO.OVL.asm   # 17 (+1 enmascarado @0x0010 = 18)
python3 re/tools/intro_catalog.py                              # 20 segmentos, 8400 bytes, gaps=[]
ls -l original/u5/ultima5/INTRO.OVL                            # 8400 B (no 131 KB)
file original/u5/ultima5/CHOICE.EXE                            # PE32 (Windows) — no es U5
```
