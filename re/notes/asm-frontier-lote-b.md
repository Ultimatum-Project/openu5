# LOTE B — derivación de los 17 leaf-helpers de juego

> Carril `re/asm-frontier`. Cierra el LOTE B del plan ([[asm-frontier-plan]]): los
> leaf-helpers de código de JUEGO que quedaban con nombre-offset crudo (SIN-ID o
> INFERIBLE por vecino). Cada uno leído instrucción-a-instrucción del disasm real
> (`re/disasm/<OVL>.asm`) y nombrado. Al nombrarlos, `routine_census.py` los sube a
> IDENTIFICADA (regla `strong()`: tener nombre = evidencia fuerte).
>
> Método: lectura directa del cuerpo `[entry, siguiente entry)`, citando offsets del
> propio `.asm` (régimen `disasm-completo-vs-segments`). NO se derivó de resúmenes.

## Nombres canónicos (bloque autoritativo — leído por routine_census.py)

Una línea por rutina `FICHERO 0xoff = nombre` (offset padded a ≥3 dígitos para el
lexer del censo; 0x04a≡0x4a, 0x00e≡0xe). Este bloque precede a toda prosa, así que
gana el `setdefault` de `build_name_seeds` sobre cualquier adyacencia accidental.

- MAINOUT.OVL 0x17d4 = actor_seek_party_step
- MAINOUT.OVL 0x16fc = actor_random_wander_step
- MAINOUT.OVL 0x14ea = actor_radial_viewport_gate
- MAINOUT.OVL 0x1482 = actor_can_enter_tile
- MAINOUT.OVL 0x14c8 = tile_is_just_vacated
- MAINOUT.OVL 0x0d8c = spawn_threshold
- TALK.OVL 0x099a = talk_seek_response_field
- TALK.OVL 0x0728 = talk_scan_to_sentinel_byte
- TALK.OVL 0x07be = talk_skip_to_next_string_and_run
- TALK.OVL 0x07e4 = talk_emit_canned_string
- COMSUBS.OVL 0x0e26 = compute_line_cell_path
- COMSUBS.OVL 0x0458 = sum_of_squared_deltas
- DNGLOOK.OVL 0x0b9e = dungeon_view_cell_dispatch
- CMDS.OVL 0x0788 = tile_terrain_class_lookup
- TOWN.OVL 0x0c4a = tile_is_a2_or_43_pred
- OUTSUBS.OVL 0x04a = match_hibyte_return_flag
- FLAMES.OVL 0x00e = plink_get_return_offset_thunk

## Titular

**Ninguno esconde un comando/feature no portado.** Son plumbing (predicados de tile,
scanners de buffer, geometría) de rutinas ya entendidas — salvo **3 con conducta
observable** (dungeon 3D cell, canned-string de diálogo, y el índice terreno×hora)
que ya están cubiertos por sus subsistemas. Tres FLAGS de verificación al final.

## MAINOUT.OVL — familia de IA de actores del mundo (padre `MAINOUT.OVL 0x198c`)

**MAINOUT.OVL 0x17d4 (actor_seek_party_step)** — IA de PERSECUCIÓN. Calcula el delta
toroidal con signo actor(rec+0x5c5c/0x5c5d)→party(g_party_x/y) en 0x17f5/0x180a, lo
reduce a paso unidad por eje ([bp-2]/[bp-4] en 0x1836/0x1880), tira RNG (call 0x18ae)
para elegir eje X-o-Y primero, y mueve un paso si la celda pasa `actor_can_enter_tile`
(call 0x1482 en 0x18cd) y no es la recién-desocupada (call 0x14c8 en 0x18db), vía
move_actor (0x1578); si ningún eje sirve cae a wander aleatorio (call 0x16fc en 0x1980).
Observable: criaturas hostiles avanzan hacia el jugador cada turno. Confianza: alta.

**MAINOUT.OVL 0x16fc (actor_random_wander_step)** — paso aleatorio. Precomputa los 4
vecinos ortogonales ([bp-8..bp-0xe] en 0x1722-0x173b), y en bucle de reintento (di≤3,
0x17c0) tira dirección (call 0x1748) y da un paso pasable vía `actor_can_enter_tile`
(call 0x1482) + move_actor (call 0x1578 en 0x1776). Observable: deambular idle de NPC/
monstruo, un paso pasable por turno. Confianza: alta.

**MAINOUT.OVL 0x14ea (actor_radial_viewport_gate)** — distancia envuelta |dx|,|dy|
actor↔party (trucos cdq/xor/sub + wrap 256 en 0x1504-0x1544); retorna 0 si |dx|≥6 o
|dy|≥6 (0x1547/0x154d), si no `byte[0x2c18 + |dy|*11 + |dx|]` (stride 11 = ancho del
viewport overworld 11×11). Observable: culla actores fuera de radio 5 y lee tabla
radial — gate de activación/proceso del actor cercano. Confianza: media (semántica
exacta de la tabla no leída; el culling y la correlación del stride-11 sí firmes).

**MAINOUT.OVL 0x1482 (actor_can_enter_tile)** — predicado de movimiento. get_tile_ptr
(call 0x1499) → `tile_property_query_dispatch` de pasabilidad (call 0x14a3, 0 si
impasable) → `find_actor_at` de ocupación (call 0x14ba, 0 si ocupada); retorna 1 sólo
si pasable y libre. Observable: NONE (predicado puro). Confianza: alta.

**MAINOUT.OVL 0x14c8 (tile_is_just_vacated)** — compara (x,y) candidato contra
[0xa526]/[0xa527] (0x14cb-0x14db), que move_actor escribe con la X/Y pre-movimiento del
último actor (stores 0x16bd/0x16c4); retorna 0 si es la casilla recién-desocupada.
Observable: guard anti-retroceso en la IA de persecución (evita re-entrar la celda
recién dejada). Confianza: alta.

**MAINOUT.OVL 0xd8c (spawn_threshold)** — retorna 3 si g_floor>0x7f (0x0d92);
si no, tile bajo el party vía get_tile_ptr (call 0x0da8) bucketizado: 0 para tiles
0x20-0x26, 2 para tile 4 o 9-0x0f, si no 1 (0x0db4-0x0de0); +3 si g_hour<5 (noche)
(0x0de5-0x0dfc). Índice 6-vías terreno×hora consumido por world_turn. Observable: ver
FLAG 1. Confianza: media (flujo e inputs ciertos; el significado del índice 0-5 inferido).

## TALK.OVL — helpers del intérprete de conversación (padres 0xf32/0x9d8/0x75a)

**TALK.OVL 0x99a (talk_seek_response_field)** — resetea el cursor de parse a base de
registro 0xb21e (0x099e), calcula nº de campos = idx*2+5 (0x09a7 shl, 0x09a9 add 5) y
llama al scanner 0x728 esas veces (0x09b5-0x09cb) para saltar N campos delimitados por
0x90; 1 ok / 0 si se pasa. Observable: NONE (posicionamiento de cursor). Confianza: alta.

**TALK.OVL 0x728 (talk_scan_to_sentinel_byte)** — carga cursor global 0xbcde (0x072f),
escanea byte a byte (0x0736): retorna 1 si == target [bp+6] (0x073e), 0 si == terminador
[bp+4] (0x074e), guardando el cursor avanzado en 0xbcde (0x0741). Scanner genérico de dos
centinelas sobre el buffer de talk. Observable: NONE. Confianza: alta.

**TALK.OVL 0x7be (talk_skip_to_next_string_and_run)** — avanza el cursor (0x07bf inc),
salta relleno 0x00 hasta el primer no-cero (0x07cb), camina hasta pasar el siguiente
0x00 (0x07d4-0x07d9), y tail-call a talk_run_until_stop 0x788 (0x07df). Handler de opcode
que reposiciona a la siguiente string y reanuda. Observable: continúa el diálogo desde
otra posición (indirecto). Confianza: media.

**TALK.OVL 0x7e4 (talk_emit_canned_string)** — si a la string fija en base 0x55a8
(0x07eb), y por cada char lo OR-ea con 0x80 (0x07f6, flag de char literal) y lo pasa a
talk_process_byte 0xf32 (0x07f9) hasta el 0x00. Observable: imprime una frase enlatada
(desde 0x55a8) en la salida del diálogo — efecto de presentación real. Confianza: alta.

## COMSUBS.OVL — geometría del proyectil (padres 0x12de/0x48a)

**COMSUBS.OVL 0xe26 (compute_line_cell_path)** — lista de celdas de la línea recta entre
dos extremos para la animación de proyectil. Pendiente fixed-point ×100 dX*100/dY
(0x0e45-0x0e59, sentinel 0x4b00 si dY=0 en 0x0e5e), pasos de signo ±1 (0x0e79/0x0e86),
camina la línea emitiendo una coord por paso a dos buffers ([bp+4]=X, [bp+6]=Y) tope
0x148=328 puntos (0x0e38), terminando ambos con 0xff (0x0f39/0x0f3f). Observable: NONE
(rellena buffers). Confianza: alta.

**COMSUBS.OVL 0x458 (sum_of_squared_deltas)** — dy=[bp+0xa]-[bp+6], dx=[bp+8]-[bp+4]
(0x045e/0x0467), los eleva al cuadrado (imul 0x0473/0x047a), suma (0x047c) y retorna
dx²+dy² en ax (0x0481). Distancia euclídea al cuadrado que su padre isqrt 0x48a convierte
en distancia. Observable: NONE. Confianza: alta.

## Otros overlays

**DNGLOOK.OVL 0xb9e (dungeon_view_cell_dispatch)** — dir arg [bp+4] (0=N/1=E/2=S/3=W)
da un paso desde el party e indexa la rejilla 8×8 por-planta `[bx+si+0x595a]`
(si=(y&7)<<3+(x&7), bx=floor<<6; 0x0be0-0x0bf4). Según el nibble alto del vecino enruta
el ráster 1ª persona: <0xA0→floor_wedge_A (call 0x0aee); {B0,C0,D0}→wall-face (call 0x097e);
si no→floor_wedge_B (call 0x0a48). Observable: dibuja una celda de profundidad de la vista
3D de mazmorra (corredor abierto / cara de muro / cierre). Confianza: alta.

**CMDS.OVL 0x788 (tile_terrain_class_lookup)** — clasificador de tile en 2 etapas para el
predicado de salida. Indexa `[bx+si-0x54fe]` (si=[bp+6]<<5, bx=[bp+4]; 0x0794); si ≠0
tail-dispatch `0x6ccc(0x1c, valor)` (0x07a6). Si no, 2ª tabla `[bx+si-0x539c]` (si=[bp+6]<<4;
0x07b5) y retorna 1 si el id ==0x1b, o (id&0xfc) ∈ {0x1c,0x24,0x10,0x28} (0x07d0-0x07eb).
Observable: gatea si un tile cuenta como tierra caminable para X-it. Confianza: media (ver FLAG 2).

**TOWN.OVL 0xc4a (tile_is_a2_or_43_pred)** — get_tile_ptr([bp+4],[bp+6]) y retorna 1 si
el byte del tile ==0xa2 (0x0c58 je) O, en 2ª llamada idéntica, ==0x43 (0x0c68 jne→0).
Predicado de dos ids (re-fetch redundante). Observable: influye el random-walk de NPC de
pueblo (trata 0xa2/0x43 como especial/bloqueado). Confianza: media.

**OUTSUBS.OVL 0x4a (match_hibyte_return_flag)** — desplaza el arg >>8 (byte alto dx,
0x0058), escanea la tabla de 8 en 0x386e buscando == dx (0x0063-0x008c); en match idx si
retorna 1 sii el byte paralelo `[si+0x58d8]` >0x7f (bit7; 0x006d-0x007c), si no 0.
Observable: flag booleano por-entrada usado al componer el viewport 16×16 (tile especial).
Confianza: media.

**FLAMES.OVL 0xe (plink_get_return_offset_thunk)** — `pop ax / push ax / ret`
(0x000e-0x0010): carga la dirección de retorno en ax dejándola en la pila; el caller 0x0
lo llama para obtener su propio offset de código. Thunk PIC del linker PLINK, no lógica de
juego (bytes ≥0x11 = relleno cero). Observable: NONE. Confianza: alta.

## FLAGS de verificación (para el lead / carril oráculo)

1. **`party_terrain_time_class` (MAINOUT 0xd8c)** — el índice 6-vías **terreno×día/noche**
   alimenta world_turn (spawn de encuentros del overworld). Verificar que el port no está
   dejando caer una conducta de spawn dependiente del terreno o de la hora. Ya cubierto
   por [[overworld-ai-rng]] a nivel de subsistema; conviene un cotejo puntual. → cola de
   FLAGS de combate/spawn, no bloqueante.

2. **`tile_terrain_class_lookup` (CMDS 0x788)** — el conjunto de ids {0x10,0x1c,0x24,0x28}
   y 0x1b es load-bearing para qué cuenta como tierra caminable en X-it. Verificar contra
   la tabla de tiles del port. Confianza media.

3. **Discrepancia de nombre del padre 0x198c** — su etiqueta en el ledger es
   `npc_ship_wind_drift`, pero sus hijos 0x17d4/0x16fc son **IA de persecución/wander de
   actores** genérica, no deriva de barco por viento. El nombre del padre puede ser un
   legado engañoso; NO lo toqué (está IDENT, fuera de alcance de LOTE B). Anotado para que
   el lead decida si renombrarlo. La conducta ya está en [[overworld-ai-rng]] / task #37.
