# Mapa de derivación de las rutinas de UI/render del binario (Task #11 — SCOUT)

> **Qué es esto:** inventario sistemático y de SOLO LOCALIZACIÓN de las rutinas de
> PRESENTACIÓN de ULTIMA.EXE + overlays, para alimentar las tasks de la **piel fiel**
> (E1-S8..S13, ver `docs/superpowers/specs/2026-07-14-ui-estrategia-interview.md` §3).
> **NO deriva de cero** lo ya hecho en otras notas: enlaza. Cada entrada lleva
> `offset · qué hace · evidencia · a qué pantalla fiel alimenta · estado`.
>
> **Convención de offsets:** salvo que se diga "OVL", los `0xNNNN` son **offsets de
> imagen del kernel** en `re/disasm/ULTIMA.EXE.asm` (= offsets CS-relativos que los
> overlays invocan por far-call; `re/notes/loops.md §1` explica la aritmética
> load_seg). Los `OVL:0xNNNN` son offsets dentro del `.OVL` correspondiente.
>
> **Autoridad (spec #11):** asm/datos verbatim > capturas. Cadencias finas (Hz de
> animación, nº de flashes percibidos) → **catálogo AV / píxel-diff** (task #4),
> NO derivables del estático.
>
> **Estados usados:** `✅ derivado` (ya en nota X) · `◐ derivable` (localizado, RE
> pendiente) · `⚙ requiere runtime/oráculo` · `🎥 catálogo AV / píxel-diff` ·
> `🧩 segmento far` (cuerpo fuera de la ventana de near-disasm; ver §0.2).

---

## 0. Arquitectura de render del original (hallazgo de encuadre)

### 0.1 El kernel NO usa EGA planar directo — hay un back-buffer de tile-ids
`0xA000` aparece **una sola vez** en TODO el corpus (kernel img `0x0e16`) y es la
**autodetección de adaptador** (scan de firma en VRAM, no dibujo). No hay `out 0x3C4/
0x3CE` reales (los dos `out dx,al` en img `0x270c`/`0x6b28` son tablas de punteros
mal-desensambladas: bytes `6b 2c` repetidos alrededor). **Implicación fuerte para la
piel fiel:** el original compone en un **buffer lógico de tile-ids** (11×11, en el
DGROUP a `0xAB02` / índice `[-0x54fE]`) y una rutina de blit vuelca ese buffer a VRAM
según el adaptador. La piel fiel debe reproducir el **buffer de tile-ids + visibilidad**
(eso ES la información de juego, regla dura #2), y el pintado de píxeles es libre
(atlas EGA del pack). El corte core→piel del spike (snapshot 11×11) coincide con la
frontera del propio binario. → alimenta E1-S2/S8.

### 0.2 Autodetección de adaptador y modo de vídeo — kernel `0x0dfc–0x0e8b`
- `int 0x10 / AH=0x12 BL=0x10` (img `0x0e3c`) = "Get EGA info"; `AH=0x0F` (img
  `0x08b0`, `0x0e60`) = get current mode; `AH=0x00` con `[0x5304]` (img `0x088b`) =
  **set mode** (el modo vive en `[0x5304]`, −1 = sin fijar).
- `[0x52ca]` = **tipo de adaptador** (valores 2/3/6 = EGA/CGA/Tandy-Herc según rama).
- Salida/limpieza: `mov ax,0x0003; int 0x10` (img `0x124a`, dentro de un ISR) = volver
  a modo texto 80×25.
- Estado: `◐ derivable`. Para la fiel basta saber **EGA 320×200 16-color** (spec #11:
  "320×200 lógico, aspect 4:3"); el detalle CGA/Tandy es **fuera de alcance** (la fiel
  es solo EGA). Los `.DRV` (`EGA.DRV`, `CGA.DRV`, `HER.DRV` en `ultima5/`) son los
  drivers de vídeo cargables — no hace falta portarlos.
- **`🧩 segmento far`:** varias rutinas objetivo de far-call (p.ej. `0x8670`, ver §6)
  caen >`0x8200` y en la ventana lineal de `ULTIMA.EXE.asm` aparecen como padding de
  ceros — viven en el 2º segmento de código del modelo grande (`segments.md`). Su
  cuerpo exacto necesita un **disasm segment-aware**; el XREF (quién las llama) sí es
  fiable y basta para el scout.

---

## 1. Composición de pantalla / chrome EGA

| Rutina | Qué hace | Evidencia | Alimenta | Estado |
|---|---|---|---|---|
| adaptador+modo `0x0dfc–0x0e8b` | detecta EGA/CGA, fija modo en `[0x5304]`, tipo en `[0x52ca]` | §0.2, `int 0x10` sites | marco base (modo EGA) | ◐ derivable |
| marco/borde de pantalla | dónde se pinta el chrome fijo (bordes, separadores de ventana/panel/consola) | **no localizado como rutina aislada**: el borde es tiles del atlas pintados junto al mundo; los glifos de caja `0x10/0x11/0x13–0x16` de IBM.CH son las esquinas/líneas (ver ZSTATS `draw_list_frame` OVL:0x045e, `re/notes/zstats.md`) | chrome EGA (E1-S8) | 🎥/◐ — **el layout de coordenadas se calca por captura+píxel-diff**; los glifos de caja son derivados |
| geometría de la ventana de juego | 11×11 centrado en party; centro = celda 5,5 | kernel `0x5d0a` resta 5 a x/y (img `0x5d36`,`0x5d3f`); `0x5910` idem (img `0x59c0`,`0x59cd`) | viewport 11×11 (regla #5) | ✅ derivado (spike + aquí) |

**Nota de coordenadas:** el original es 320×200. Distribución canónica U5 (a confirmar
por píxel-diff, task #4): ventana de juego ~176×176 px (11 tiles × 16) arriba-izq,
banda de cielo encima, panel de party a la derecha, consola de texto abajo. Las
**coordenadas exactas en px** son `🎥 catálogo AV / píxel-diff` — el binario las tiene
horneadas en las rutinas de blit del segmento far, más caro de derivar que de medir.

---

## 2. Fuente y texto

| Rutina/dato | Qué hace | Evidencia | Alimenta | Estado |
|---|---|---|---|---|
| **IBM.CH** (1024 B) | fuente de juego **8×8 mono, 1 byte/fila, 8 filas/glifo, 128 glifos** | dump: glifo `'A'`(0x41)@off 0x208 = `1E 36 66 7E 66 66 C6 00`; glifo 0 = blanco; 1–2 = mitades de símbolo especial | toda la capa de texto fiel | ✅ dump aquí (extractor trivial en E1-S8) |
| IBM.HCS (3072 B) | 2ª charset (256×12 ó 128×24; cabecera a ceros) — probable fuente alta/runa | `xxd` cabecera; tamaño | rótulos especiales (si aplica) | ◐ derivable |
| **`print_string` kernel `0x1850`** | impresor a la ventana de texto activa; descriptor de ventana en `[0x5386]*8 + 0x535e` (campos: [bx]=izq, [bx+7]&2=flag, [bx+2]=…) | img `0x1850` leído; ZSTATS lo llama como `K=0x3670→0x1850` (`re/notes/zstats.md §K`) | consola + todos los textos | ◐ derivable (semántica de ventana clara) |
| **FONT.OVL** (motor cinemático) | `render_justified_text` 0x0000 (justificación completa, anchos proporcionales `DS 0x50ca`), `scene_tick` 0x02fc (animador), `load_scene` 0x0418, `blit_text_buffer` 0x0e52 | **✅ `re/notes/font.md`** (Task 3.12, catálogo `font_catalog.py` 100%) | intro/endgame/gitana/pergaminos | ✅ derivado |
| consola: scroll/wrap/prompt/cursor | ring de líneas; el modelo del spike ya lo tiene (`CoreViewImpl` ring 12) | spike §1.2; el parpadeo de cursor/timer NO está en el estático | consola fiel | 🎥 cadencia de cursor por catálogo AV; wrap/scroll ◐ derivable de `0x1850` |

**Anchos de glifo:** el juego usa **8×8 fijo** para IBM.CH (mono), pero FONT.OVL usa
**anchos proporcionales** (`DS 0x50ca + char`) para los textos cinemáticos justificados
(intro/endgame). Son dos sistemas de texto distintos: consola de juego = IBM.CH mono;
cinemáticas = FONT.OVL proporcional. La piel fiel necesita ambos.

---

## 3. Ventana de juego (world/town) — el corazón del render

Pipeline confirmado leyendo `0x5910`→`0x5d0a`→`0x5a28` y los painters:

| Rutina | Qué hace | Evidencia | Estado |
|---|---|---|---|
| **`0x5910` compositor+tick** | dispatcher del redibujo del mundo. Gatea por `g_unk_58a4` (flag de turno) y por `g_location` (<0x80 pueblo / ≥0x80 mundo). Rama pueblo con `g_unk_24e6` set → llama al LOS `0x5d0a`. Rama mundo (`0x59f8`): copia 0x160 words `[0xad14]→[0xab02]` (buffer de tiles) y llama a los **painters** `0x5394`, `0x56ac`, `0x4102`. Al final marca `[0x5891]=1` (first-draw done). **También es el world-turn** (viento rand(0,63)+npc_tick, ver `loops.md`) | img `0x5910`–`0x5a27` leído; `loops.md §1/§2` | ✅ (tick) / ◐ (paint) |
| **`0x5d0a` build-visible-buffer** | rellena el buffer 11×11 de tile-ids en `[0xAB02]`/`[-0x54fE]`; primero pone 0xFF, invoca el raycaster `0x5a28` con `(g_light_level, dx, dy, 0x0b=radio 11)`, y llena tiles vía `0x4402` (fetch de tile por x,y de mundo). Args: (light, party_x−origin_x, party_y−origin_y, 11) | img `0x5d0a`–`0x5dfa` leído; `0x5910` lo llama en img `0x5987` con `g_light_level` | ◐ derivable (LOS) |
| **`0x5a28` raycaster/LOS** | 0x218 B de locals; recorre rayos hasta `radio=bp+0x10`, consulta opacidad de cada tile (via `0x4402`) y marca visibilidad en `[-0x204]`. **ESTA es la censura de "negro"**: celdas no alcanzadas por el rayo quedan sin pintar (fondo) | img `0x5a28`+; llamada desde `0x5d0a` img `0x5d61` | ◐ derivable — **clave para task #9/#10** |
| `0x4402` tile-fetch | (x,y mundo) → puntero al byte de tile en el chunk cargado | img `0x5dd1`,`0x5aa1` lo llaman con coords+origin | ✅ (implícito en el port del mundo) |
| **`0x5394` painter A** | vuelca `g_transport_tile`/`party_x`/`party_y`/`floor` a `g_char_anim_states@0x5C5A` (estado de animación de sprites del entorno) y pinta la capa de personajes | img `0x5394`+ leído; escribe `[0x5c5a..0x5c5e]` | ◐ derivable |
| **`0x56ac` painter B** | recorre el buffer `[-0x54fE]` (tile-id) en paralelo con `[-0x539C]` (= **0xAC64** = g_vis_tile_window, con ficha desde #267; `(-0x539C) & 0xFFFF = 0xAC64`, corregido por #267: decía 0x5C64, que es OTRA dirección viva —el campo X del registro de `0x5C5A`, con 16 accesos propios— arrastrada desde la fila de arriba; derivación en globals-negdisp-adjudicacion.md §4) comparando contra `0x16`; decide por celda qué blitear (0 = no visible → negro) | img `0x56ac`+ leído | ◐ derivable |
| `0x4102` painter C | pintado condicionado por `[0x5891]` (solo si ya hubo first-draw); ramas por `g_location` | img `0x4102`+ | ◐ derivable |

**Orden de capas** (derivado del flujo): (1) fetch de terreno+objetos+NPCs al buffer de
tile-ids (`0x5d0a`/`0x4402`); (2) censura por LOS/luz (`0x5a28`); (3) blit de la capa de
personajes/party y transporte (`0x5394` vía `g_char_anim_states`); (4) volcado a VRAM
(`0x56ac`/`0x4102`). El **sprite de transporte** (barco/caballo/globo/carpet/skiff) se
resuelve por `g_transport_tile` escrito en `g_char_anim_states[0]/[1]` (img `0x53b8`).

**Globals de render confirmados** (`re/ledger/globals.json`):
`g_light_level@0x58A5` (radio 2..50; ≥0x33 = centinela "no recalcular", mazmorras),
`g_char_anim_states@0x5C5A` (256 B, "animation states de los characters del entorno"),
`g_unk_24E6` (flag 'turno consumido'), `g_unk_58A4` (flag de turno de pueblo).

---

## 4. Animación

| Qué | Evidencia | Estado |
|---|---|---|
| **driver de tiles animados** (familia fuego/agua/etc.) | `g_char_anim_states@0x5C5A` guarda el estado por sprite; el avance de frame lo hace el ciclo de redibujo. **No se localizó un ISR de INT 1Ch** en el kernel (grep sin hits); la cadencia la marca el bucle de turno + un contador de frame | ◐ (mecanismo) / 🎥 (cadencia) |
| **18 Hz de antorchas** (medido por el usuario) | NO derivable del estático (depende de ciclos DOSBox `cycles=fixed 3000` + bucle) | 🎥 catálogo AV |
| flicker de tile lejano en mazmorra | `2×rand(0,100)` umbral 0x32 por frame (DUNGEON:0x111E) | ✅ `re/notes/dungeon.md §3` (excluido del núcleo puro) |
| animador de escena cinemática | marquee 0xbd26/27/28 + 7 fases de tono | ✅ `re/notes/font.md` (scene_tick 0x02fc) |
| animación de sprites de combate | ~12 rands/frame vía kernel `0x2F70`; chispas de impacto | ✅ `re/notes/combat.md §13` (patch_anim_rand) |

**Para la fiel:** las **cadencias** (Hz) son insumo del **catálogo AV (task #4)**; el
**mecanismo** (qué tiles animan y con cuántos frames) es derivable de las familias de
tiles del atlas + `g_char_anim_states`. Regla dura #2: la fiel anima con las cadencias
reales medidas, no inventadas.

---

## 5. Banda celeste (sol/luna/estrellas)

| Qué | Evidencia | Estado |
|---|---|---|
| posición de sol/luna por hora/fase | **NO localizado como rutina aislada** en el kernel near-disasm; probablemente vive en el painter del marco (segmento far) o en MAINOUT como parte del redibujo del borde superior | 🧩/🎥 |
| datos de fase lunar | `g_moonstone_*@0x5830..0x5848` son destinos de moongate, NO la fase visual; la fase de las 2 lunas (Trammel/Felucca) se deriva del reloj (`g_hour`/día) | ◐ (fórmula de fase derivable del reloj) |

**Recomendación:** la banda celeste es candidata #1 a **calco por captura + píxel-diff**
(el usuario tiene capturas por hora/fase). Derivar la fórmula sol/luna del reloj es
factible, pero el **layout de píxeles** de la banda es más barato de medir que de
extraer del segmento far. → task E1-S8 (chrome) con insumo AV.

---

## 6. Panel derecho (roster / party)

| Rutina | Qué hace | Evidencia | Estado |
|---|---|---|---|
| **`0x8670` redraw del panel de party** | repinta nombres/HP/status de los miembros (el panel derecho) | **XREF fiable**: `call 0x8670` desde COMBAT(×4), SHOPPES(×3), BLCKTHRN, LOOKOBJ, ENDGAME | 🧩 cuerpo en segmento far (near-disasm = padding); XREF = ✅ |
| **`0x2900` status_redraw** | redibujo de la línea/indicadores de estado (llama a `0x1b94`) | img `0x2900` leído; `re/notes/kernel-survival.md §43` (`kernel_status_redraw`) | ◐ derivable |

**Qué redibuja cuándo:** `0x8670` se invoca tras cada acción que cambia HP/status
(combate, comer, daño). El panel es información de juego pura (nombre/HP/estado, sin
barras enemigas — regla dura #6). El spike ya expone esto en `PartyMemberView`
(name/hp/maxHp/status). → E1-S8: pintar `PartyMemberView` con IBM.CH en las coords del
panel (coords por píxel-diff).

---

## 7. Ztats / inventario

**✅ Totalmente derivado en `re/notes/zstats.md`** (Task 3.12, ZSTATS.OVL mapeado 100%).
Puntos de entrada de layout para la fiel:

| Rutina OVL | Layout | 
|---|---|
| `draw_stat_page` 0x0082 | clase `"AMBFDTPRS"`, status `"GPDSC"`, género (CP437 ♂/♀), Str/HP/Int/MagicPts/Dex/Exp |
| `draw_magic_or_equipment_panel` 0x02a8 | 2ª pantalla: equipo slots +0x19..+0x1E / spellbook / consumibles |
| `draw_list_frame` 0x045e | **marco de lista con glifos de caja `0x10/0x11/0x13/0x14/0x15/0x16`** (= el chrome de caja de IBM.CH) |
| `print_list_row` 0x05e2 | `'*'`=readied, `'!'`=cursed, `'('`=numérico; qty right-pad |
| `render_item_list` 0x06e8 | renderer genérico de las 4 sub-páginas + picker de Ready |
| `cmd_zstats` 0x0a3a / `cmd_ready` 0x1296 | entradas Z / R |

Layout del record de personaje: base `0x55A8`, stride 32 (`zstats.md §Layout`).
**Estado: ✅ derivado — la fiel solo tiene que pintar estos campos con IBM.CH.**

---

## 8. Las 13 pantallas especiales (inventario Task #1)

| # | Pantalla | Dónde vive el código | Estado del RE | Para calcarla hace falta |
|---|---|---|---|---|
| 1 | **Título / FLAMES** | `FLAMES.OVL` (32 B, thunk 17 B; la llama la mueven datos de tiles + animador kernel/FONT) | ✅ `re/notes/endgame.md §FLAMES` | atlas título + animador de fuego (cadencia 🎥) |
| 2 | **Intro "The Summoning"** | `INTRO.OVL` (8,4 KB) — `play_introduction` 0x14e secuencia 21 escenas (STORY1.16 + tablas DATA.OVL 0x2f98-0x30f0); texto proporcional PROPORT.PCS vía primitivo de FONT | ✅ `re/notes/intro.md` (task #13/#16) | extraer STORY1.16 + tablas de escena; timings 🎥 |
| 3 | **Gitana / creación** | `FONT.OVL` [0x0998,0x0E52) (3 funcs) + `re/notes/gypsy.md` | ✅ `gypsy.md` (Task 3.11) + `CREATE.16`/`CREATE.4` (arte) | pintar cartas + preguntas (lógica ✅; layout 🎥) |
| 4 | **Lore / Codex** | texto en DATA.OVL/pools; render por FONT justificado | ◐ (texto derivable; pool 0x6A9A+) | FONT engine + pool de texto |
| 5 | **Ceremonias de santuario** | `re/notes/shrines.md` (mantras/mecánica) | ✅ lógica; ◐ presentación | animación de santuario (tile+FONT) |
| 6 | **Acampada + aparición (=level-up #27)** | `re/notes/oracle-camp-event.md` + CMDS | ✅ evento (task #5/#7 cerradas) | escena de campfire (arte + 🎥) |
| 7 | **Trono (interrogatorio Blackthorn)** | `BLCKTHRN.OVL` — `anim_vm` bytecode 0x00be, escena 0x0718 (MISCMAPS/sprites), redraw `g_floor=0xFF` centinela 0x08e7 | ✅ `re/notes/blackthorn.md` | intérprete de cutscene-bytecode + MISCMAPS.DAT |
| 8 | **Refuge visual** | (parte de mapas especiales) | ⚙ sin nota específica de render | localizar en TOWN/mapas |
| 9 | **Apertura de mazmorra sellada** | `re/notes/dungeon.md §8` (muro especial 0xC0) | ◐ parcial | efecto de apertura + 🎥 |
| 10 | **Endgame** | `ENDGAME.OVL` — `endgame_throne_scene` 0x0000 (sprites party 0x5c5a, texto FONT, 6 filas), `move_sprite_toward` 0x0510 | ✅ `re/notes/endgame.md` (Task 3.12) | cutscene + FONT (hecho) |
| 11 | **Vista de gema (View gem)** | DNGLOOK / `g_unk_57AD`; "sólo render" | ✅ `re/notes/dungeon.md §11` (marcado hecho por el brief) | pintar el mapa-gema completo |
| 12 | **Moongate** | `re/notes/shrines.md` (moongates + teleport) | ✅ lógica | animación de portal (🎥) |
| 13 | **Combate** (sub-inventario) | `COMBAT.OVL` / `COMSUBS.OVL` | ✅ `re/notes/combat.md` muy completo | ver §9 abajo |

**Combate — sub-inventario (auditar contra COMBAT.OVL, `re/notes/combat.md`):**
- recuadro/cursor de turno activo: `g_cmb_aim_x/y@0x5899/0x589A` (cursor Aim!, COMSUBS:0x0504) ✅
- proyectiles: `enemyRangeThing[type]` vuela (COMBAT:0x0822); hit rolado ANTES de volar ✅
- flash de impacto: `kernel_flash` `0x3AE6` (n flashes+beep, sin RNG); melee hit → kernel `0x3564` ✅
- chispas de impacto: COMBAT 0x125B/0x1268/0x1275/0x1282 ✅
- muerte / aparición: flag 0x10 + sprite on/off (" appears!/disappears!") ✅
- iniciativa/mensajes, entrada de arena, cursores de targeting: ✅ mecánica en combat.md
- **cadencias de animación de proyectil/flash: 🎥 catálogo AV.**

---

## 9. Efectos de driver

| Efecto | Rutina | Evidencia | Estado |
|---|---|---|---|
| **flash de pantalla** (impacto/evento) | kernel **`0x3AE6`** `kernel_flash(n)` — n flashes + beep, gateado por `g_unk_58a4` | img `0x3ae6` leído; `combat.md:21` | ◐ derivable (nº de flashes exacto ✅; cadencia 🎥) |
| **PC speaker** | kernel **`0x21af`** `out 0x42, al` (PIT ch2), freq div en `[0x5454]` | img `0x21ac`–`0x21b3` leído | ✅ localizado → **task #3 (SFX speaker)** |
| **pulsos de la Llama del ritual** | `0x70f2` (×3 pulsos) + `0x75a2` (×7 flash sobre la casilla) + SFX `0x7b66` | ✅ `re/notes/shadowlord-ritual.md §79-84` | ✅ derivado (cadencia 🎥) |
| **flash de cofre / botín** | (G)et de cofre; no localizado como flash aislado | `re/notes/objects.md`/`sjog.md` (lógica de botín ✅) | ⚙ efecto visual pendiente |
| **faro (lighthouse)** | fuente de luz ambiental | → **task #10** (visibilidad: antorchas/braseros/faro) | ⚙ requiere §3 LOS + tabla de emisores |
| fade in/out | `g_floor=0xFF` centinela de redraw antes de fade (blackthorn 0x08e7, endgame) | ✅ `blackthorn.md`/`endgame.md` | ◐ derivable |

---

## 10. Propuesta de troceo E1-S8+ (cada task con su punto de entrada)

Ordenadas por dependencia (S8 primero = base para todas):

- **E1-S8a — Extractor IBM.CH + capa de texto fiel.** Punto de entrada: dump §2 (8×8
  mono, 128 glifos) + printer `0x1850`. Entrega: atlas de fuente + blit de glifo/línea.
  Tamaño S. **Base de todo lo demás.**
- **E1-S8b — Chrome/marco EGA + geometría 320×200.** Entrada: §0.2 (modo EGA), §1
  (glifos de caja `draw_list_frame` OVL:0x045e), coords por **píxel-diff** (task #4).
  Incluye banda celeste (§5, calco por captura). Tamaño M. **🎥 dependiente del AV.**
- **E1-S9 — Ventana de juego 11×11 + LOS/censura.** Entrada: §3 (`0x5910`→`0x5d0a`→
  `0x5a28`, painters `0x5394/0x56ac`, buffer `[-0x54fE]`). **Solapa con task #9/#10**
  (la LOS del snapshot). Orden de capas de §3. Tamaño M-L. **El grueso.**
- **E1-S10 — Animación de tiles (mecanismo) + cadencias AV.** Entrada: §4
  (`g_char_anim_states@0x5C5A`, familias del atlas). Cadencias del catálogo AV. Tam M.
- **E1-S11 — Panel derecho + Ztats/inventario.** Entrada: §6 (`0x8670`) + §7 (ZSTATS
  ✅ derivado, solo pintar). Tamaño S-M. **Barato (lógica ya derivada).**
- **E1-S12 — Combate fiel.** Entrada: §8 sub-inventario + `re/notes/combat.md`
  (recuadro turno, proyectiles, flash `0x3AE6`, cursores Aim `0x5899`). Tam M.
- **E1-S13 — Pantallas cinemáticas** (título/FLAMES, intro Summoning, gitana, lore,
  ceremonias, campada, trono, refuge, mazmorra sellada, endgame, view-gem, moongate).
  Entrada: §8 tabla — **mayoría con lógica ✅**; el gap real es **INTRO.OVL** (sin nota)
  y los layouts de cutscene (FONT engine ✅ + MISCMAPS.DAT). Tam L (troceable por
  pantalla). Insumo AV pesado.
- **Transversal — SFX PC speaker (task #3 ya existe).** Entrada: §9 (`0x21af` out 0x42).

---

## 11. Las 5 sorpresas más relevantes

1. **No hay EGA planar en el disasm.** El original compone en un **buffer de tile-ids**
   (`0xAB02`/`[-0x54fE]`) y blitea aparte. La frontera del binario coincide EXACTAMENTE
   con el corte core→piel del spike (snapshot 11×11). La piel fiel reproduce el buffer,
   no el modo de vídeo. (§0.1)
2. **La censura de "negro" ES el raycaster `0x5a28`**, no un post-proceso: las celdas
   que el rayo no alcanza (por `g_light_level@0x58A5`, radio 2..50) simplemente no se
   pintan. Esto es directamente lo que necesitan task #9 (LOS en snapshot) y #10 (luces).
   (§3)
3. **IBM.CH es 8×8 mono de solo 128 glifos** (1024 B), pero las cinemáticas usan otra
   fuente **proporcional** (FONT.OVL `DS 0x50ca`). Son dos sistemas de texto: la fiel
   necesita ambos. (§2)
4. **Varias rutinas de UI viven en un 2º segmento de código** (`0x8670` panel de party,
   painters del marco) que la ventana lineal de `ULTIMA.EXE.asm` muestra como padding de
   ceros. Los XREF son fiables; el cuerpo exacto necesita disasm segment-aware. Es la
   mayor deuda de derivación de render. (§0.2, §6)
5. ~~**El gap real de las 13 pantallas es INTRO.OVL** (131 KB, sin nota de RE)~~
   **[RESUELTO 2026-07-14, task #13/#16 → `re/notes/intro.md` + `intro-ovl-map.md`].**
   INTRO.OVL son **8,4 KB** (los "131 KB" eran el tamaño del `.asm`), ya derivado al
   100%: es el **menú de portada** (6 opciones J/C/T/U/A/R). La cinemática "The
   Summoning" la secuencia INTRO (`play_introduction` 0x14e, 21 escenas); la
   creación/gitana está en FONT (`gypsy.md` ✅); el transfer de U4 (`0x132a`) también
   derivado. No queda nada grande de código por abrir en la intro — solo extraer assets
   (STORY1.16/CREATE.16) y cadencias 🎥. (§8, `intro.md`)

**Zonas honestamente 🎥 (píxel-diff, no derivables del estático):** coordenadas exactas
en px del chrome/banda celeste, cadencias de animación (18 Hz antorchas, nº de flashes
percibidos), parpadeo del cursor de consola. Todo eso es insumo del **catálogo AV
(task #4)** y del arnés píxel-diff contra DOSBox — encaja con el gate de la spec #11.
