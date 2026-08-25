# intro.md — derivación 100% de INTRO.OVL (Task #13, barrido total #16)

Fecha 2026-07-14. Lectura completa a nivel derivado de los 8.400 B de `INTRO.OVL`
(`re/disasm/INTRO.OVL.asm`, 3.615 líneas). Formato de cita `fileoff: instrucción →
regla`. Complementa el mapa estructural `intro-ovl-map.md` (que este documento
**corrige** en dos puntos, ver §9) y `gypsy.md` (la creación/gitana, que vive en
FONT.OVL — INTRO solo la invoca).

INTRO.OVL es el **menú de portada de Ultima V**: título animado + los 6 comandos del
menú (Journey / Create / Transfer / Introduction / Acknowledgements / Return). Todo su
trabajo gráfico lo hace el kernel por near-call (los `call 0xffffXXXX` son wrap
negativo a direcciones del segmento kernel); INTRO no tiene renderer propio.

Mapeo de datos: los strings/tablas viven en **DATA.OVL**, `DGROUP = fileoff − 0x10`
(verificado: "Journey Onward" en DS 0x310c = DATA.OVL fo 0x311c).

---

## 1. Inventario de funciones (20 reales; el catálogo F.1 marcó 18)

`intro_catalog.py` particiona en 18 segmentos `code` (cobertura correcta). La lectura
fina encuentra **2 funciones más** embebidas en la cola de dos segmentos (leaf sin
prólogo / prólogo enmascarado); se listan como 18a/19a. Byte-marking del ledger intacto.

| # | off | tam | nombre derivado | rol |
|---|---|---:|---|---|
| 1 | `0x0010` | 64 | `title_sprite_setup` | pinta 4 filas del título (loop si=0..3, kernel 0x8b8c [= CS 0x0d4c → ULTIMA.EXE:0x0d4c gfx_drv_sel4b_wrapper]) |
| 2 | `0x0050` | 254 | `path_walk_anim` | anima 1 sprite por una ruta empaquetada (BRITISH.PTH en 0x55A6) |
| 3 | `0x014E` | 752 | **`play_introduction`** | secuenciador de "Ultima V Introduction" = **The Summoning** (21 escenas) |
| 4 | `0x043E` | 162 | `draw_menu_titlebar` | barra/realce del título del menú (filas 0xC0..0xC7) |
| 5 | `0x04E0` | 208 | `draw_menu_border` | marco ornamental del menú (tiles de caja 0x7B..0x7F) |
| 6 | `0x05B0` | 198 | `show_logo_screen` | muestra ULTIMA.16 (logo) + música; opcional wait-key |
| 7 | `0x0676` | 70 | `print_menu_line` | imprime 1 opción del menú (resalta si idx==sel) |
| 8 | `0x06BC` | 114 | `draw_main_menu` | dibuja las 6 líneas del menú (sel resaltada) |
| 9 | `0x072E` | 544 | `play_acknowledgements` | "Acknowledgements": STARTSC.16 + animación de cortina |
| 10 | `0x094E` | 56 | `read_key_timed` | poll de tecla con timeout (N ticks) |
| 11 | `0x0986` | 1680 | **`intro_main_controller`** | título animado + bucle de menú + dispatch |
| 12 | `0x1016` | ~610 | `u4_transfer_load` | lee party.sav (U4), valida, mapea clase, copia stats |
| 12b | `0x1278` | ~112 | `print_class_name` | leaf: clase (records+10) → string vía jump-table 0x1288 |
| 13 | `0x12EA` | 64 | `u4_stat_rescale` | reescala 1 stat U4→U5 (ver §6) |
| 14 | `0x132A` | 2808 | **`transfer_character`** | pantalla "Transfer from Ultima IV" (import+confirm+edit+save) |
| 15 | `0x1E22` | 64 | `draw_transfer_stat` | imprime 1 par label/valor del sheet (tablas 0x3656/0x3666) |
| 16 | `0x1E62` | 196 | `draw_frame_row` | fila de marco (box tiles) del transfer sheet |
| 17 | `0x1F26` | ~254 | `draw_transfer_panel` | sub-panel con bordes+título del transfer sheet |
| 17a | `0x2024` | 108 | `draw_transfer_frame` | leaf: monta el marco completo del transfer sheet |
| 18 | `0x2090` | 30 | `intro_music_start` | START música (clc; `[g_snd_driver_fn]=0x69; lcall`) |
| 18a | `0x20AE` | 25 | `intro_music_cmd` | 2ª entrada música (stc; arg [bp+4]) — prólogo enmascarado por 1 B |

---

## 2. El menú de portada (6 opciones) — la pieza central

**Etiquetas** (DATA.OVL) y **tabla de acción** `0x3270` = `"JCTUAR"` (6 letras, índice
0..5 → letra de comando):

| idx | etiqueta (DS) | letra | acción (dispatch en intro_main_controller) |
|---|---|---|---|
| 0 | `0x310c` "Journey Onward" | **J** | carga SAVED.GAM y arranca el juego (§4) |
| 1 | `0x311b` "Create New Character" | **C** | `lcall 0xfb0e` → creación (FONT.OVL, `gypsy.md`) |
| 2 | `0x3130` "Transfer from Ultima IV" | **T** | `call 0x132a` `transfer_character` (§5) |
| 3 | `0x3148` "Ultima V Introduction" | **U** | `call 0x14e` `play_introduction` = Summoning (§3) |
| 4 | `0x315e` "Acknowledgements" | **A** | `call 0x72e` `play_acknowledgements` |
| 5 | `0x316f` "Return to the View" | **R** | `lcall 0xfb1a` = relanza el DEMO del attract («the View», kernel `font_scene_init`, ver `intro-demo-scene.md §5`) y `0x100d jmp 0xcd0` **vuelve al bucle del menú** — NUNCA arranca el juego (es además el default del timeout ocioso, 0x0dec) |

**Navegación** (`intro_main_controller` 0x0d75-0x0e79):
- Bucle de espera de tecla con música: `si=0..0xc8` (200 ticks); cada tick `0x9978`
  poll + `0x9e72` traduce → `[bp-0xe]`; si no hay tecla, sigue sonando la música
  (`call 0x2090`). (0x0d75)
- Flechas: teclas **1/3 → `dec di`**, **2/4 → `inc di`** con wrap 0..5 (0x0dc4/0x0dd8);
  redibuja `draw_main_menu(di)`.
- **Enter (0x0d) / Space (0x20)**: `[bp-0xe] = [di + 0x3270]` — mapea la selección a su
  letra (0x0de2). Es la indirección clave: la selección resaltada se traduce a comando
  vía la tabla `"JCTUAR"`.
- **Hotkeys directas**: 'J'/'C'/'T'/'U'/'A'/'R' saltan directo a su acción
  (traductor 0x0e16-0x0e42). Tecla 0/timeout → 'R' (0x0dec).
- **Select prompt**: "Select: " (`0x31dd`) impreso con el resalte 0xca6a/0xcb0e
  (wrappers de color) (0x0d58).

**Dispatch final** (0x0e47): sobre la letra en `[bp-0xe]`, `jmp` a cada handler
(0x41→0xff4, 0x43→0xfa8, 0x4a→0xe7c, 0x52→0x100a, 0x54→0xf9c, 0x55→0xfe8).

---

## 3. Título animado + "The Summoning" (screens S1 + S2)

### Título (intro_main_controller 0x0aa1-0x0c97)
1. Lee tecla previa (0x9e72). Si == **0x4a** (scancode especial) salta directo al menú.
2. Carga sprites: `[0x25ee]`=**TITLE.BIT** → `[bp-0x10]`, `[0x25ec]`=**BRITISH.BIT** →
   `[bp-0x12]` (0x0b0b-0x0b28).
3. Carga **BRITISH.PTH** (`0x31b5`) en la roster-window `0x55A6` (0x0b2b, `call 0xa3ae`
   = read-file) — datos de **rutas** de las figuras.
4. Blitea TITLE.BIT + BRITISH.BIT (0x8e84/0x8bb2/0x8dae flip) componiendo la portada.
5. **4 figuras andantes**: `call 0x50 path_walk_anim` desde 4 posiciones —
   (0x2c,0x44),(0x40,0x5e),(0x8f,0x4e),(0xa7,0x69) (0x0c07-0x0c3c). Cada llamada camina
   un sprite por deltas empaquetados leídos de `0x55A6[0xbb18++]`.

**`path_walk_anim` (0x0050)** — el codec de ruta (por byte del path):
- bits 0-2 = |dx| (>2 ⇒ sin snap de color), bit 3 = signo de dx (`neg`).
- bits 4-6 = |dy|, bit 7 = signo de dy. (0x00af-0x00ee)
- `[bp+4]+=dx; [bp+6]+=dy`, blit, `0x9b9e` poll (tecla aborta), byte 0 = fin de ruta.
- cada 0x1f pasos: tick `0x9f3a` (0x0110).

### The Summoning — `play_introduction` (0x014E), opción **U**
Secuenciador **propio de INTRO** (no es el scene-engine genérico de FONT; usa el kernel
+ el texto proporcional). Estructura:
- `g_location=0x40`; carga `[0x25ea]`=**PROPORT.PCS** (la fuente proporcional, la misma
  `FONT DS 0x50ca`) (0x0156-0x016c).
- Carga `[0x260c]`=**TEXT.16** → `[bp-2]`, `[0x260e]`=**STORY1.16** → `[bp-4]`
  (0x01a2-0x01bf).
- **Bucle de 21 escenas** `[bp-8]=0..0x14` (0x0384). Cada escena lee sus parámetros de
  **tablas paralelas en DATA.OVL** indexadas por el nº de escena:
  - byte-tables `0x30da,0x30c4,0x3098,0x30f0,0x30ae,0x3040,0x3056,0x306c,0x3082`
    (posiciones/tiles/flags de escena),
  - word-tables `0x2f98` (par de bytes → `g_unk_5146/48`), `0x2fc2` (`g_unk_514c/4e`),
    `0x3016` (arg de texto).
  - Blit de la lámina (`0x8b8c`), texto proporcional justificado vía **`call 0xfb26`**
    (thunk externo al renderer de FONT), sprites según `[bx+0x30f0]` (0/1/2/3/4).
  - `g_unk_5146/48/4c/4e/50/52/56/58` = registros de layout de la escena actual.
- El texto de las escenas (el guion de la Summoning) vive en **STORY.DAT** (21
  registros delimitados por **NUL**, uno por escena; `'{'` = control de SANGRÍA, no
  separador de página; `'_'` = guion discrecional) indexado por la tabla `0x3016`, +
  las **6 láminas STORY1-6.16** (recargadas en el bucle por `0x30ae`) y las tablas de
  escena `0x2f98-0x30f0`. Semántica COMPLETA de las 12 tablas + la firma de blit
  `(flags, Y=0x30da, X=0x30c4, subimg=0x3098, buf)` derivada en
  **`re/notes/intro-scene-tables.md`** (scout). Los *timings* dependen de DOSBox (🎥).

**`show_logo_screen` (0x05B0)** — muestra `[0x261e]`=**ULTIMA.16** (logo), música
(`call 0x20ae`), opcional wait-key `[bp+4]`. Encadena tras varias opciones del menú.

**Rama WD.BIT — condición de visibilidad DERIVADA (auditoría de cobertura, ítem
wd-bit-logo):** con `[bp+4]≠0` (wait) la rutina corre la ventana temporizada
`0x8d86(0x64, 0x13f)` y sondea el teclado con `call 0x9b9e` (0x060f) — la MISMA
primitiva "¿hay tecla?" del wait-key de 0x0851 (≠0 = tecla disponible). La
polaridad en 0x0612 es `cmp ax,1; sbb cx,cx; neg cx` ⇒ `[bp+4] = (ax==0)`:
**queda armada SOLO si el usuario NO pulsó tecla**. Entonces (0x0640 `jne` con
[bp+4]≠0) carga `[0x3105]`=**WD.BIT** (bucle de reintento 0x0646-0x0651), lo pasa
a `call 0x20ae` (el motor del subtítulo/música del cartón — el mismo que anima el
"Warriors of Destiny" en llamas) y lo libera (0x8e1c). Es decir: WD.BIT (máscara
1bpp del subtítulo) SOLO se ve en el logo-idle del attract, cuando nadie
interrumpe con una tecla; una pulsación durante la ventana lo salta. El port ya
modela ese efecto con las capas `ultima:1-4` (subtítulo de fuego) → no requiere
extracción propia; queda documentado como equivalente-cubierto.

**`play_acknowledgements` (0x072E)**, opción **A** — carga `[0x2620]`=**STARTSC.16**;
animación de "cortina" (bucle si de blits expansivos 0x8b8c/0x890e desde el centro),
luego `draw_main_menu(4)` y wait-key. Son los créditos.

---

## 4. "Journey Onward" (opción J, 0x0e7c)
1. `lcall 0xe1be` + `0xacd6` (carga el estado / SAVED.GAM). Compone la ventana de juego.
2. Carga `[0x25f0]`=**TILES.16** (0x0e9d), lee `0x31e6`=**SAVED.GAM** contexto.
3. **Gate de personaje**: `cmp byte[g_party_records],0` (0x0ec9). Si el 1er byte del
   nombre del reg 0 es 0 (**sin personaje**): imprime `0x31f2`="No active game. " +
   `0x3203`="Please create a character " + `0x321e`="or transfer one from Ultima IV. ",
   y **vuelve al menú** (0x0ed0-0x0f22).
4. Si hay personaje: imprime el nombre (`0x323f`=SAVED.OOL...), carga los .OOL
   (SAVED/BRIT/UNDER), y si `g_location==0 && g_floor!=0` toca UNDER.DAT (subsuelo).
   Fija `g_unk_52be=8` y `jmp 0x1010` (**sale del controller → el kernel arranca el
   juego**).

Overworld vs subsuelo se resuelve por los .OOL (`SAVED.OOL 0x3249`, `BRIT.OOL 0x3252`,
`UNDER.OOL/DAT 0x325c/0x3266`).

---

## 5. "Transfer from Ultima IV" — `transfer_character` (0x132A), opción T

La pantalla de importación de un personaje de Ultima IV. (En `intro-ovl-map.md` estaba
etiquetada como "hoja de personaje de Journey Onward" — **es la de Transfer**, §9.)

Flujo:
1. Carga fondo `0x3345`=**INIT.GAM** en 0x55A6, `0x334e`=**INIT.OOL** (0x134e-0x1372).
2. Imprime cabecera `0x3357`="Transfer Character from Ultima IV",
   `0x3379`="Please insert the Ultima IV Player Disk", `0x33a1`="and press drive
   letter", `0x33b8`="or press <Esc> to abort transfer" (0x139d-0x13d8).
3. Lee tecla de unidad; **ESC (0x1b) aborta** → restaura g_location, sale (0x13f5).
4. `call 0x1016 u4_transfer_load`. Si devuelve ≠0 (fallo de lectura) reintenta (0x141b).
5. Muestra lo encontrado: `0x33d9`="Found:", `0x33e1`="a level ", sexo
   (`0x33ea`=" Male "/`0x33f1`=" Female " según `records+9`==0xb), clase
   (`print_class_name`), STR/DEX/INT (`records+12/13/14`), nombre (`0x55A8`), y
   "an Avatar."/"not an Avatar" según `[0x3304]` (0x143b-0x1534).
6. Confirmaciones **Y/N** (bucles 0x9e72 hasta 0x59/0x4e):
   - "Keep this name?" (`0x345e`) → N: "Enter new name: " (`0x346e`), input `0x9c78`
     máx 8 a `0x55A8`, no vacío (0x16f2).
   - "Keep same sex?" (`0x3495`) → toggle Male/Female, `records+9`=0xb/0xc (0x17f5).
7. **Conversión de stats** (0x1959-0x1d49), con narración:
   - **Exp**: `records+20 /= 10` ("Experience has been converted"; U4 exp ÷10) (0x195c).
   - **Level**: `records+22=1; cx=exp/100; while cx>0 {level++; cx>>=1}` →
     level = 1+1+⌊log2(exp/100)⌋ ("Level has been converted") (0x1a16-0x1a36).
   - **HP=maxHP=30·level**: `records+18=records+16 = 0x1e * level` (0x1a39).
   - **STR** (records+12): `u4_stat_rescale`, **suelo 20** ("was (50), now (30)") (0x1b04-0x1b0e).
   - **DEX** (records+13): `u4_stat_rescale` (sin suelo) (0x1bfb).
   - **INT** (records+14): `u4_stat_rescale`; **MP = INT** (`records+15=records+14`) (0x1ce6-0x1cec).
   - Clase → Avatar: si `[0x3304]` (transfer válido) `records+10=0x41` ('A') (0x142f);
     "Thou art now an Avatar" / "Class remains intact".
8. **Guarda**: limpia buffer `0xb21e` (0x100 B), escribe `0x3641`=**SAVED.OOL** y
   `0x364b`=**SAVED.GAM** (`call 0xa418` write-file) → "Conversion complete, saving..."
   (0x1ddc-0x1e08). Sale.

**`u4_transfer_load` (0x1016)** — el parser del save de U4:
- Lee `0x3278`="party.sav" a `0xbc88` (0x1046).
- **Validación** (0x1058-0x108a): stats `[0xbc8e/90/92] ≤ 0x46`(70), exp
  `[0xbc8c/88/8a] ≤ 0x270f`(9999), `[0xbcad] ≤ 7`; si excede → inválido → mensaje
  `0x3282`="Error: Your Ultima IV game" + `0x32b4`="Unable to continue transfer." +
  `0x32d4`="Press any key..." y return 1 (0x10ce).
- Escanea 8 slots buscando char activo (`[bx+di+0x14]` entre 1..0x1f) (0x1099).
- Copia nombre (≤8, buffer+0x14), sexo (`+9`=0xb/0xc según buffer+0x24==0xb),
  **mapeo de clase U4→letra** (buffer+0x25, 0..7) vía jump-table `0x116b`
  (`jmp cs:[bx-0x6c80]`): 0→'M'(Mage) 1→'B'(Bard) 2→'F'(Fighter) 3→'D'(Druid)
  4→'T'(Tinker) 5→'P'(Paladin) 6→'R'(Ranger) 7→'S'(Shepherd) (0x1170-0x11bd).
- Level = stat/100 (`div 0x64`, 0x1203). Si `0xbb22..0xbb30` todo 0 → `[0x3304]=1`
  (gate "transfer disponible / es Avatar") (0x126a).

**`print_class_name` (0x1278)** — leaf: `records+10 − 0x42`, jump-table `0x1288`
(`jmp cs:[bx-0x6b7e]`, tabla en 0x12c2) → strings `0x3306` "Mage".."Shepherd" (`0x333b`).

---

## 6. `u4_stat_rescale` (0x12EA) — reescala U4→U5 (confirmado vs gypsy.md)
```
v = [bp+4]
if v < 10:            return v
elif v >= 30:         return 20 + (v-30)/4     ; sar 2
else (10..29):        return 10 + (v-9)/2      ; sar 1
```
Idéntica a la ruta de transfer documentada en `gypsy.md §Transfer`. STR aplica suelo 20
DESPUÉS (en el llamador 0x1b0a), no aquí.

---

## 7. Assets EGA(.16) vs CGA(.4) — el parche de nombres
La tabla `0x25ea` lista TODOS los ficheros gráficos en su variante **.16 (EGA/Tandy 16
color)**: PROPORT.PCS, BRITISH.BIT, TITLE.BIT, TILES.16, ITEMS.16, DNG1-3.16, MON0-7.16,
TEXT.16, STORY1.16, ULTIMA.16, STARTSC.16, …

`intro_main_controller` 0x0a1a-0x0a46 (rama tomada si `g_unk_52c8 ∈ {0,3}` = modo de
display CGA): recorre la tabla y **reescribe la extensión**: busca el '.' (0x2e), si el
carácter siguiente es '1' (0x31) lo cambia a '4' (0x34) y pone NUL → ".16"→".4". Así el
resto de INTRO abre las láminas de 4 colores. (Modos EGA/Tandy: `g_unk_52c8 ∈ {1,2}` →
en su lugar fija registros de paleta 0x13ae-0x13ba.)

---

## 8. Música / sonido
Dos entradas al driver de sonido (`g_snd_driver_fn @0x5350`, función 0x69):
- `intro_music_start` (0x2090): `clc; [0x5350]=0x69; lcall [0x5350]` — arranca el tema.
  Se re-llama en cada tick del bucle de menú (0x0d83) para mantenerlo sonando.
- `intro_music_cmd` (0x20ae): `arg=[bp+4]; stc; lcall` — 2ª orden (carry set = comando
  con parámetro; usada por `show_logo_screen`). El mapeo carry→acción vive en el driver
  (fuera de INTRO). Nota de honestidad: no derivo el opcode del driver (es otro binario;
  ver censo `.DRV` en `intro-ovl-map.md §1`).

---

## 9. Correcciones a notas previas
1. **`intro-ovl-map.md §3/§4/§6` y `ui-render-map §8`**: decían que la cinemática "The
   Summoning" **no** vive en INTRO. **Corrección**: sí — `play_introduction` (0x14e) es
   el secuenciador de las 21 escenas ("Ultima V Introduction", opción U del menú),
   leyendo STORY1.16 + tablas de escena de DATA.OVL y usando la fuente proporcional
   PROPORT.PCS vía el thunk `0xfb26` (renderer de FONT). FONT aporta el *primitivo de
   texto*; la *secuencia* es de INTRO. (El scene-engine genérico de FONT `0x02fc/0x0418`
   lo usa el ENDGAME, no esta intro.)
2. **`0x132a`** estaba etiquetada "hoja de personaje / ZSTATS en Journey Onward". **Es
   la pantalla de "Transfer from Ultima IV"** (`transfer_character`): importa party.sav,
   reescala, confirma nombre/sexo y escribe SAVED.GAM. Journey Onward (opción J) NO usa
   0x132a — solo carga el save y arranca (§4).
3. **Recuento de funciones**: 20 reales (18 del catálogo + `draw_transfer_frame 0x2024`
   leaf + `intro_music_cmd 0x20ae` prólogo enmascarado). El ledger no cambia (siguen
   siendo bytes `code` dentro de sus segmentos; es una distinción de derivación).

---

## 10. Mapa de entrada por pantalla para la piel fiel (E1-S13)
| Pantalla | Driver en INTRO.OVL | Assets | Notas |
|---|---|---|---|
| **Título** (S1) | `intro_main_controller` 0x0aa1 + `path_walk_anim` 0x50 | TITLE.BIT, BRITISH.BIT, BRITISH.PTH | 4 figuras andantes; "Copyright 1988 Lord British" |
| **Menú de portada** | `draw_main_menu` 0x6bc + `draw_menu_border` 0x4e0 + nav 0x0d75 | strings 0x310c.. + tabla "JCTUAR" 0x3270 | 6 opciones, flechas+hotkeys |
| **The Summoning** (S2) | `play_introduction` 0x14e | STORY1.16, TEXT.16, PROPORT.PCS + tablas escena 0x2f98-0x30f0 | 21 escenas; texto proporcional (FONT primitive); timings 🎥 |
| **Acknowledgements** | `play_acknowledgements` 0x72e | STARTSC.16 | créditos + cortina |
| **Logo** | `show_logo_screen` 0x5b0 | ULTIMA.16 | + música |
| **Transfer U4** | `transfer_character` 0x132a (+ 0x1016 parser) | INIT.GAM/OOL, party.sav | opcional; el clon no importa U4 |
| **Gitana/creación** (S3) | — (opción C llama a FONT vía `lcall 0xfb0e`) | CREATE.16, QUESTION.DAT | lógica en `gypsy.md` (FONT) ✅ |

**Para la piel fiel de la intro** el trabajo real es: (1) título+menú (0x0986/0x6bc/0x4e0,
tabla JCTUAR); (2) la Summoning (0x14e + STORY1.16 + tablas de escena — extraíbles);
(3) la creación ya está (gypsy.md). Coordenadas exactas px y cadencias = 🎥 catálogo AV.

## Apéndice — verificación
```
grep -cE "^[0-9a-f]{4}: 55 +push bp" re/disasm/INTRO.OVL.asm   # 17 visibles (+0x0010, +0x20ae = 19 con prólogo; +0x2024 leaf = 20)
python3 - <<'PY'  # tabla de menú y assets
d=open('original/u5/ultima5/DATA.OVL','rb').read()
print(d[0x3270+0x10:0x3276+0x10])          # b'JCTUAR'
print(d[0x310c+0x10:0x311a+0x10])          # b'Journey Onward'
PY
```

---

## 11. Decoders de imagen/fuente de la intro (.16 / .BIT / .PCS) — ASM-CITADO (E1-S13c)

Portados en el extractor (`pic16.ts`, `bit.ts`, `proport.ts`) y cableados en la piel
fiel. La **cita completa del blit/unpack** la resolvió el scout: ver
**`re/notes/intro-blit-formats.md`** (rutinas reales, base de carga de INTRO `0x81C0`).
Resumen:

- **Cargador (citado):** `kernel_load_dat_record` (kernel `0x256e`, INTRO `call
  0xffffa3ae`) carga+LZW-descomprime; el mismo contenedor LZW para los tres formatos.
- **Blitters (citados):** `gfx_cmd_sel4b` (`0x8b8c`→`0x0d4c`, SEL 0x4b, láminas .16 de
  escena), `gfx_blit_sel66` (`0x8d86`→`0x0f46`, SEL 0x66, pantallas completas 4bpp),
  `gfx_blit_sel4e` (`0x8e84`→`0x1044`, SEL 0x4e → EGA.DRV `0x190e`, máscaras .BIT). El
  "far fantasma >0x8200" era la MISMA clase de #15 (near-call sin base); con base
  `0x81C0` los 17 targets caen en entradas kernel censadas.
- **.16** = `[u16 count][count×u32 offset]`, sub-imagen `[u16 w][u16 h][4bpp, FILAS a
  stride `ceil(w/8)·4` B]`. ⚠️ El STRIDE de fila era el bug de `pic16.ts` (leía filas
  contiguas → sólo `w%8==0`); con stride, los símbolos de virtud (CREATE img2-9) y el
  logo gótico **ULTIMA.16** (319×61) decodifican limpios. Verificado `span ==
  ceil(w/8)·4·h` en 22/22 sub-imágenes.
- **.BIT** = `[u16 count][count×u16 offset]`, sub-imagen `[u16 w][u16 h][1bpp máscara]`.
  El blitter (EGA.DRV `0x190e`) pinta la máscara en **BLANCO sólido (índice 15)** en los
  4 planos, sin color-arg → el render blanco del port es FIEL; Clase C es sólo el FONDO
  detrás (fill_rect / asset 4bpp de la ruta SEL 0x66), no el color de la máscara.
- **.PCS** = `[u16 count=91][u16 offset]`, glifo FIJO 12 B `[u16 w][u16 h=8][8 filas
  1bpp]`, char = `0x20 + idx` → fuente PROPORCIONAL (avance = width). Renderer en
  FONT.OVL (thunk `0xfb26`).
- **Corrección al brief (adjudicada):** TITLE.BIT/BRITISH.BIT NO son el gótico "Ultima
  V" — son los logos de arranque (ORIGIN SYSTEMS + "Lord British", video-diff E1). El
  gótico "Ultima V" es **ULTIMA.16 img0 (319×61)**, ahora decodificado con el stride.
