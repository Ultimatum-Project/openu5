# Banderas de estructura por PÍXEL-MASK — resuelto por oráculo (runtime)

Scout de oráculo. **Alcance final (recortado por el lead):** SOLO la animación de las
5 estructuras de 1 tile del overworld (0x12 Keep, 0x13 Village, 0x14 SmallCastle,
0x15 LargeCastle, 0x1b Lighthouse). El castillo de LB y el fuego van por el carril del
censo (bytecode 0x4552, tarea #46). Aquí queda además un **apéndice de hallazgos
colaterales** (fuego/LB) que salieron del mismo volcado, como heads-up para ese carril.

Método: `re/tools/oracle.py` (dosbox-x headless), boot a partida cargada (SAVED.GAM de
`original/u5/ultima5`, cayó en **g_location=0x11**, un pueblo), volcado de la RAM viva.
Confound tolerado (el DOSBox del usuario corriendo; avisos ignorados por precedente).
`game_ds=0x1788`, `drv_seg=0x9D26`, `atlas_seg=0x8CA2`.

---

## VEREDICTO (A): la bandera SÍ es píxel-mask, y la hace el DRIVER de vídeo

**El bytecode `0x4552` y el reloj maestro `0x44b8` NO tocan las estructuras** (base<0x34,
confirmado). Pero el bitmap del tile **SÍ muta en el atlas cargado en RAM**, y el que lo
muta es una rutina del **EGA.DRV** (`fn32`, selector 0x60, entry `0x1f98`), llamada en CADA
pasada del animador vía el kernel `0x6fd6` (la cola de `0x4552`: `...call 0x44b8; call 0x6fd6`).
`0x6fd6` invoca `lcall [0x5350]` con selector 0x60 → `fn32` del driver.

### El atlas de tiles vive en el DRV y el blit lo lee crudo (sin transformar)
- `fn27` (sel 0x51, `0x1637`) es el blit de tile: copia 128 B desde
  `atlas_seg:(tileid*128)` a pantalla `A000` plano a plano, **sin XOR/shift/fase/RNG**.
  ⇒ un tile SIEMPRE se dibuja igual para un id dado y un contenido de atlas dado; no hay
  mutación "en el dibujado".
- `atlas_seg` = `word[drv_seg:0x206]` (el DRV lo guarda ahí; se lo fija el kernel por
  `fn24`/sel 0x48). El atlas son los 512 tiles de TILES.16 descomprimidos (64 KB,
  planar EGA, 128 B/tile).
- ⇒ la única vía para que la bandera "ondee" es que **cambien los bytes del atlas**. Y
  cambian: medido en vivo.

### La rutina de la bandera: `fn32` @ `0x243a–0x24d5` (swap de píxeles gateado por RNG)
```
2435: mov ds, cs:[0x206]              ; ds = atlas
243a: test word cs:[0x1f94], 1        ; bit0 de la SEMILLA RNG LOCAL del driver
2441: je  ...                          ; si el bit está a 0, NO ondea esta pasada
2443: mov si, 0x900 ; call 0x24d0      ; 0x12 Keep      (swap 8 B)
2452: mov si, 0xa10 ; call 0x24b4      ; 0x14 SmallCastle (swap 4 B)  [bit1]
2461: mov si, 0xa80 ; call 0x24d0      ; 0x15 LargeCastle (swap 8 B)  [bit2]
2470: mov si, 0x1f00; call 0x24d0      ; 0x3e (torre de LB, ver apéndice) [bit3]
247f..24ac: 0x9088/0x9188/0x9688/0x9788 (tiles 0x121/0x123/0x12d/0x12f, criaturas) [bits 4/5/6/0]

; helper de swap (0x24b4): intercambia 2 words en si con 2 words en si+0x10
24b4: ax=[si]; bx=[si+2]; cx=[si+0x10]; dx=[si+0x12]
      [si]=cx; [si+2]=dx; [si+0x10]=ax; [si+0x12]=bx ; ret        ; = swap de 4 B
24d0: call 0x24b4 ; then si+=4 ; jmp 0x24b4                        ; = swap de 8 B
```

**Mecanismo, en una frase:** cada pasada, si el bit asignado de la semilla local está a 1,
el driver **intercambia dos bloques de 4/8 B del bitmap del tile en el atlas** (los píxeles
del gallardete entre dos posiciones) ⇒ la bandera parpadea/ondea. Es un swap (auto-inverso):
la bandera va y viene según el bit.

**Casa byte-a-byte con lo medido.** El swap de `0x15` (si=0xa80, 8 B) intercambia
bytes `[0:8) ↔ [16:24)` del tile → las 2 frames observadas en vivo son EXACTAMENTE ese
swap. `0x14` (si=0xa10, 4 B) intercambia `[16:20) ↔ [32:36)` → frames observadas difieren
en bytes `[17,18,19]/[33,34,35]`. Confirmado.

### Fuente de aleatoriedad: RNG LOCAL del driver (NO el global de gameplay)
La semilla es `cs:0x1f94` (privada del EGA.DRV). Se avanza en la MISMA pasada, en el bloque
de "ruido de llama" de `fn32` (`0x1fa8`): `seed = ((ror3(seed+0x9248)) xor 0x9248) + 0x11`
— idéntico algoritmo al RNG del kernel (`0x2092`) pero **semilla separada**. ⇒ estas
animaciones del driver **NO consumen ni desalinean `g_rng_seed` (DS:0x5420)**; son
render-seguras. El port puede replicarlas con un PRNG local declarado (coherente con #17).

### Cadencia
`fn32` corre una vez por pasada del animador (misma cadencia base que el reloj maestro,
~110 ms/tick según el censo). Cada bandera hace swap cuando su bit de semilla = 1 (~50 %/
pasada) ⇒ **flutter irregular**, compatible con L1/L2 ("ondea cada tick / poses").

---

## QUÉ estructuras animan (medido: volcado del atlas completo, 24 ticks)

| tile | nombre | ¿anima? | mecanismo | gate |
|---|---|---|---|---|
| 0x12 | Keep | **SÍ** | swap 8 B en 0x900 | seed bit0 |
| 0x13 | Village | **NO (estática)** | — | — |
| 0x14 | SmallCastle | **SÍ** | swap 4 B en 0xa10↔0xa20 | seed bit1 |
| 0x15 | LargeCastle | **SÍ** | swap 8 B en 0xa80 | seed bit2 |
| 0x1b | Lighthouse | **NO (estática)** | — | — |

Tasa de cambio medida (24 ticks): 0x12 → 15/24, 0x14 → 10/24, 0x15 → 12/24 (≈50%, el gate
de 1 bit); 0x13 y 0x1b → 0/24. **Village y Lighthouse NO tienen gallardete animado.**

**Reconciliación con los vídeos:** L1 (0x15) y L2 (0x14) ✓ animan. **L4 (faro 0x1b): el
tile del faro es ESTÁTICO**; lo que anima cerca del faro es el HAZ DE LUZ (0x2A, sistema de
emisores ya portado, tarea #10), no el bitmap de la estructura. El censo §4 asumía que las
5 eran píxel-mask "Clase C sin resolver" — **falso: solo 3, y la vía es el DRV, no un reloj**.

### Validación (descarta artefactos del confound)
- **Doble lectura en la MISMA pausa = idéntica** ⇒ las lecturas no las corrompe el confound;
  los cambios entre ticks son evolución real del juego.
- **Las 5 estructuras NO están en pantalla en este pueblo** (mapa visible 11×11 = solo ids
  0x00/0x44/0xff) y aun así 0x12/0x14/0x15 mutan ⇒ es el ATLAS global animándose, no
  contenido de pantalla.
- `atlas_seg` validado: los 5 tiles son bitmaps reales, distintos y no-cero; agua 0xd4/0xd5
  densas y casi iguales entre sí (frames contiguos), como se espera.

---

## Impacto en el port (para la piel fiel)
El port deriva "animado" de `TileData.IsPartOfAnimation` (Redux), que **NO marca** 0x12/0x14/
0x15 (ni sconces ni faro) — Redux solo conoce animación por SWAP-DE-ID, no la mutación
in-place del atlas. Por eso el port hoy **no ondea ninguna bandera**. Para fidelidad:
implementar el swap de bloques por tile (0x12: 8B, 0x14: 4B, 0x15: 8B) gateado por un PRNG
local (1 bit/tile/pasada), a la cadencia del reloj de tiles. Village y faro se dejan
estáticos (fiel).

---

## Apéndice — colaterales para el carril del censo/fuego (#46), NO parte de A

Del mismo `fn32` (@0x1f98) y del bytecode `0x4552` salió esto (heads-up, no mi entrega):

1. **`fn32` es el motor de mutación in-place del atlas** para MUCHOS tiles, no solo banderas.
   Volcado del atlas (24 ticks) → set animado (ids 0x00-0xff): `01 02 03 12 14 15 34 35 36 37
   3e 60-6f 8f b0 b1 b2 b3 bc bd be bf de e4 e5 e6 e7`. Los de 24/24 (agua/olas/llama/sconces)
   mutan cada tick; las banderas, parcial. Buena parte de esto NO está en `IsPartOfAnimation`.
   - Bloque de ruido de llama (`0x1f9d`): escribe bytes RNG (semilla local `cs:0x1f94`) en el
     atlas ~tiles 0x1e8+ (FLAMES). RNG LOCAL, no global.
   - Torchas 0xb0-b3 mutan 24/24 vía `fn32` (atlas), ADEMÁS de tener programa bytecode
     (0x1bc8[31]=prog3). El titileo visible del fuego bien podría ser esta mutación del DRV,
     no (solo) el ciclo de frames del bytecode. **Revisar antes de portar fuego como bytecode puro.**
2. **`0x3e` (parte del castillo de LB 0x3a-0x3f) lo ondea `fn32`** (bit3 del mismo seed),
   por PÍXEL-SWAP en el DRV — no (solo) por ciclo de tiles del bytecode. El gallardete de LB
   (L3) tiene ESTA vía además de la del bytecode.
3. **Dos RNG distintos en render:** (a) bytecode `0x4552` usa el RNG GLOBAL (kernel `0x2092`,
   seed `DS:0x5420`) para su gate 50 %/pasada + opcodes 5/6 (mismo stream que gameplay ⇒
   excluir per #17, PRNG local en el port); (b) `fn32` del DRV usa un RNG LOCAL propio
   (`cs:0x1f94`). Volcado en vivo del mapa 0x1bc8/programas 0x1b18 = **coincide byte a byte
   con el censo (delta 0)**.

---

## Apéndice B — SECUENCIAS REALES de tile-ids del bytecode (encargo del lead, BP-log)

Resuelve la contradicción de "morphing" que paró al carril del censo. Método: BP de código
en las DOS escrituras de `[bx+1]` del animador `0x4552` (`0x465d` = display de frame
opcodes 1-4; `0x467c` = rama "off" del opcode 5), en `load_seg:off` (load_seg=0x0824,
confirmado por hits). Como el pueblo (loc 0x11) no tiene fuego/castillo, **SEMBRÉ actores
sintéticos** (write_mem al registro `0x5c5a`: `[base, base, 0,0,0,0, 0,0]`) para cada
familia y logueé qué tile-id ESCRIBE el intérprete. 154 hits de código / 240 resumes.

| familia (base) | programa (0x1b18) | ids mostrados (medido en vivo) |
|---|---|---|
| antorcha 0xb0 | p3 `01 02 03 04 87` | **0xb0,0xb1,0xb2,0xb3** + delay 7 ticks, loop |
| hoguera 0xdc | p7 `02 03 04 03 02 05` | **0xdd,0xde,0xdf,0xde,0xdd** + off 0xdc (ping-pong) |
| fuente 0xd8 | p1 `01 02 03 04` | **0xd8,0xd9,0xda,0xdb** (4 frames) |
| castillo LB A 0x38 | p0 `02 03 04 05` | **0x39,0x3a,0x3b** + off 0x38 |
| castillo LB B 0x3c | p0 `02 03 04 05` | **0x3d,0x3e,0x3f** + off 0x3c |
| 0x70 | p5 `02 84 03 84 04 84 05` | 0x71,0x72,0x73 (con delays de 4) |
| 0x8c | p9 `02 82 03 82 04 82 06 01` | 0x8d,0x8e,0x8f + off 0x8c |
| 0x98 | p6 `01 02 01 02 03 04 02 03 04` | 0x98,0x99,0x98,0x99,0x9a,0x9b,0x99,0x9a,0x9b (patrón exacto ✓) |

Naturales del pueblo (prog0, para referencia): 0x48→{49,4a,4b}+off, 0x50→{51,52,53}+off,
0x54→{55,56,57}+off. (Un outlier `0x50→0xd8` = misread transitorio del confound; 1/154.)

**CONCLUSIÓN (cierra el intérprete y la contradicción):** cada familia cicla los **tile-ids
CONSECUTIVOS `base..base+3`** (o subconjunto según su programa; prog0 muestra base+1..+3 y
el opcode 5 muestra base como "off"). ⇒ **0xb0-0xb3, 0xd8-0xdb, 0xdc-0xdf son los 4 FRAMES de
UN objeto, no 4 objetos distintos.** El "morphing antorcha→brasero→hoguera" es un artefacto de
que `TileData` nombra cada id como objeto separado; en el original son frames. NO hay morphing.

**OJO — doble capa de animación del fuego:** el bytecode cambia QUÉ tile-id se muestra
(base..base+3) Y `fn32` del DRV muta el BITMAP de cada uno de esos tiles en el atlas
(0xb0-b3 = 24/24 en el mapa). El titileo visible es la SUMA de las dos. Al portar fuego,
modelar ambas o el resultado no casará con el vídeo.

Cadencia real: irregular por el gate RNG del 50 %/pasada (0x461e) + delays de los programas
(p3 delay 7, p5/p9 delays 4/2) + opcodes probabilísticos 5/6. Fuente RNG = GLOBAL
(kernel 0x2092, seed DS:0x5420) ⇒ excluir en el port (PRNG local, per #17).

---

Scripts del scout (fuera del repo): `scratchpad/atlas_map.py`, `validate_atlas.py`, `bp_seq.py`.
