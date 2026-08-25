# Barrido de rutinas INFERIBLES — Fase 3 (kernel ULTIMA.EXE) — ÚLTIMA MILLA

Tarea #39, fase 3. Cierra el barrido: las 26 rutinas INFERIBLE del **residente
(ULTIMA.EXE)** — las primitivas compartidas del kernel (render, E/S de fichero,
strings, RNG, propiedad de tiles, actores, aritmética saturada) que todos los
overlays invocan. Continúa [[inferible-sweep-f1]] y [[inferible-sweep-f2]]. Mismo
método (leer el cuerpo, CONFIRMAR/REFUTAR, veredicto de cobertura), 2 subagentes
por rango de offset. **Estático puro.** REGLA A: en el kernel los near-call
resuelven dentro del propio residente (banda 0).

## Resumen ejecutivo

| Lote | rutinas | CONFIRM | REFUT | CUBIERTA | PARCIAL | AUSENTE |
|---|---:|---:|---:|---:|---:|---:|
| 1 (0x1588–0x3f54) | 13 | 13 | 0 | 13 | 0 | 0 |
| 2 (0x3f6e–0x76ac) | 13 | 13 | 0 | 12 | 1 | 0 |
| **TOTAL** | **26** | **26** | **0** | **25** | **1** | **0** |

(CUBIERTA incluye "CUBIERTA-estructural": primitivas de render/E-S/DOS que el
port reimplementa con renderer moderno + loaders de assets, sin equivalente 1:1
pero con el comportamiento observable cubierto — 18 de las 25.)

**Titular: 26/26 CONFIRMED, 0 REFUTED.** Cero funciones ausentes. Un único
PARCIAL de bajo impacto (`0x3f6e`, opacidad de LOS). Con esto, **las 26 quedan
verificadas y NO queda ninguna rutina de CÓDIGO DE JUEGO en estado INFERIBLE**:
las 57 INFERIBLE restantes son todas de los drivers `.DRV` (CGA 17 / T1K 15 /
EGA 13 / HER 12), fuera de alcance por diseño (primitivas de hardware que el port
no reimplementa — usa un renderer moderno). La frontera de calco queda cerrada.

## Único fleco (PARCIAL) — verificar en combate

**ULTIMA.EXE 0x3f6e — test de OPACIDAD de línea-de-visión (bitmap DS:0x6a14). PARCIAL, bajo impacto.**
Predicado por-tile que lee el bit `0x80>>(v&7)` del bitmap de 32 bytes en
`DS:0x6a14`, indexado por el valor de tile `-0x54fe` (coincide con
`kernel-sweep-4.md §7`). CONFIRMADO como el "parar en la primera celda opaca" del
animador de proyectil (`COMSUBS:0x12de`) y usado también por CAST.OVL. El port
tiene passability y los proyectiles/cañones ya paran en muros, pero **no se
localizó un predicado de OPACIDAD separado de la passability**: opacidad ≠ paso
(p. ej. una reja bloquea la vista pero podría no bloquear el paso igual). Si el
port usa passability donde el original usa el bitmap `0x6a14`, podría haber
divergencia en QUÉ tiles detienen un proyectil o un hechizo de línea. Fleco de
verificación de combate; sin fix. (Encaja como sub-punto del pack #42/#44 de
fidelidad de combate.)

## Matiz de nota (no gap del primitivo)

**ULTIMA.EXE 0x6f1e — `stristr` (matcher de keyword de conversación). CUBIERTA con matiz.**
El primitivo del kernel casa la subcadena en CUALQUIER posición (case-insensitive,
máscara 0x7f7f, uppercase `and 0x5f`). El port
(`game/src/core/dialogue/conversation.ts:268-274 getQuestionKey`) usa
`input.toLowerCase().startsWith(keyword)` — PREFIJO, no subcadena-en-cualquier-
posición. La función está cubierta; el matiz prefijo-vs-substring es una posible
diferencia de fidelidad de matching de conversación (una respuesta con la keyword
en medio de la frase casaría en el original y no en el port). Anótese como fleco
menor de diálogo, no gap del kernel.

## Detalle — las 26 rutinas por rol

### Lote 1 — tile-property / render-E/S / aritmética (13, todas CUBIERTA)
- `0x1588` keyword_lookup_ci — búsqueda case-insensitive en tabla de punteros a strings.
- `0x1649` dos_read_file — wrapper INT21 AH=3Fh (el port carga assets por loaders).
- `0x1c5b` clamp_normalize_rect — clampa/ordena coords a la rejilla de texto 40×25.
- `0x2bd4` tile_flag_bit — test de bit de passability con overrides (triage #17).
- `0x2c2e` tile_classifier_water — clase agua (tile<4 o 0x6x) (triage #18).
- `0x2c4c` tile_property_query_dispatch — DESPACHADOR maestro de propiedad de tile (jump-table de 11 casos, 0x2d60); el port lo colapsa en isPassable + TileData (triage #16).
- `0x2e96` set_wind + draw_wind_status — escribe g_wind + dibuja "<Dir> Winds" (`world/wind.ts`, documentado como kernel 0x2E96).
- `0x3702` find_actor_at / is_occupied — recorre la tabla de 32 actores 0x5c5a (`npc/manager.ts:373 isOccupied`).
- `0x39cc` set_map_tile — override de tile en town/keep (`game.ts:638 mapOverrides`).
- `0x3a74` set_actor_record — vuelca 6 bytes en el slot de sprite 0x5c5a (el port modela actores como objetos).
- `0x3b9e` read_decimal_input — lectura de número decimal con signo por teclado (cantidades de tienda/gitana).
- `0x3ef0` add_byte_clamped_ceiling — suma saturada con techo (el port hace Math.min inline).
- `0x3f54` sub_word_clamped_floor0 — resta saturada con suelo 0 (el port hace Math.max(0,…) inline).

### Lote 2 — LOS / render de texto / DOS file-I/O (13; 12 CUBIERTA + 1 PARCIAL)
- `0x3f6e` test_tile_opacity — **PARCIAL** (ver fleco arriba).
- `0x4dea` draw_char_boxed — render de char en caja (Ztats; `kernel-sweep-3.md §11`).
- `0x4f3c` box_border_painter — painter de bordes de caja UI (`kernel-sweep-3.md §8.2`).
- `0x6f1e` stristr — matcher de keyword de conversación (CUBIERTA, matiz prefijo arriba).
- `0x71aa` clock_driver_notify — pasa hora/minuto al driver por tick de reloj overworld (despacho a `.DRV`; el port usa renderer moderno para cielo/luz y no tiene driver de audio de fondo en el perfil 1988).
- `0x72f0` dos_set_int_vector / `0x72f5` dos_get_int_vector — thunks INT21 AH=25h/35h (5 B).
- `0x72fa` install_int_handler — getvect+setvect (guarda vector viejo, instala nuevo).
- `0x7315` io_buffer_cache_sweep — housekeeping/LRU de buffers de fichero.
- `0x737f` data_file_open — apertura de `.DAT` de acceso aleatorio (INT21 AH=3Dh + segmento loader 0x72e).
- `0x73da` data_file_lseek — lseek con offset paragraph→byte (×16, INT21 AH=42h).
- `0x76a1` reset_file_io_state — init del estado del lector (11 B).
- `0x76ac` loader_farcall_trampoline — trampolín far preserva-flags al segmento loader (8 B).

El cluster DOS/C-runtime `0x72f0–0x76ac` (8 rutinas) es el subsistema de E/S de
fichero de datos sobre `int 21h` + segmento loader 0x72e. No hay `int 21h` en
navegador; el port carga assets con loaders modernos → todas CUBIERTA-estructural,
ninguna con gameplay visible ausente.

## Cierre del barrido #39 — cifra final de la frontera

| Fase | Ficheros | Rutinas | CONFIRM | REFUT |
|---|---|---:|---:|---:|
| 1 | 6 overlays oscuros | 75 | 75 | 0 |
| 2 | 16 overlays de juego | 81 | 81 | 0 |
| 3 | kernel ULTIMA.EXE | 26 | 26 | 0 |
| **TOTAL** | **23 ficheros de código de juego** | **182** | **182** | **0** |

**182/182 inferencias CONFIRMADAS, 0 refutadas.** El heurístico del censo
(caller/callee/cita identificados) resultó 100% fiable en todo el espacio de
código de juego. Estado final del censo: **IDENTIFICADA 713 · INFERIBLE 57 (=
sólo drivers `.DRV`) · SIN IDENTIFICAR 76**. Toda rutina de código de juego del
binario está ahora VERIFICADA por lectura directa; los `.DRV` quedan fuera por
diseño (documentado). Los gaps accionables surgidos están todos repartidos en
tareas (#37, #41–#48, #44) o son cosméticos/estructurales. Barrido cerrado.
