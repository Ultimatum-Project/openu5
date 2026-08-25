# Censo de tiles animados del original (U5) y diff contra el port

Objetivo: enumerar TODO lo que el original anima en el viewport de mundo/pueblo,
con id · nº de frames · mecanismo · divisor de tick, y diferenciarlo contra lo que
`game/src/render/tileanim.ts` anima hoy. Insumo del rework del reloj (55 ms base) y
de la tarea de banderas.

Fuentes: `re/notes/kernel-sweep-4.md §2` (reloj maestro `0x44b8`), `re/notes/kernel-sweep-3.md §1`
(animador de bytecode `0x4552`), disasm `re/disasm/ULTIMA.EXE.asm 0x44b8–0x4550`,
medición AV (video-B agua ~117 ms, video-H cursor 18.2 Hz), `original/u5/*/TILES.16`.

---

## 0. El reloj: tick base y divisores

- **Tick BASE = timer BIOS a 18.2 Hz (~55 ms).** Medido en `video-H` por autocorrelación
  del cursor de consola (mediana 50 ms / media 54 ms sobre 45 frames). Coincide con el
  "18 Hz antorchas" de `ui-render-map §4` (INT 1Ch, `0x20fa delay_via_timer` escribe `[0x5448]`).
- **El reloj de animación de tiles `advance_tile_anim_frames 0x44b8` corre a la MITAD de
  ese ritmo (~110 ms = 2 ticks base).** El agua avanza 1 frame por llamada (video-B ~117 ms
  cuadra). ⇒ los ciclos de 4 frames van a **divisor 2** (2 ticks base).
- Dentro de `0x44b8` los **toggles de 2 frames** están gateados por el contador de fase
  `[0x6a7e]&1` (0x80..83) y `&2` (0xfa..fd) ⇒ avanzan **cada 2 llamadas del reloj = ~220 ms =
  divisor 4**.
- El **cursor de consola** cablea al tick base puro ⇒ **divisor 1 (~55 ms)**.

El port confundía el tick base con el ritmo del agua (`ANIM_TICK_MS=110`): el cursor iba a
110 ms (lento) y los toggles a 110 ms (rápidos). Fix: base a 55 ms + divisor por grupo.

---

## 1. Reloj maestro `0x44b8` (DETERMINISTA) — la "tabla del reloj", citada entera

Muta la tabla de remapeo `DS:0x4ee2` (que indexa `viewport_compose` como `remap[tile]`).
`0x4ee2` sólo lo escribe esta rutina (grep verificado). Lectura íntegra `0x44b8–0x4550`:

| ids | nombre (Redux) | frames | mecanismo | avance | divisor (55 ms) |
|---|---|---|---|---|---|
| `0xd4–0xd7` | Waterfall (olas agua A) | 4 | ciclo de tiles `inc`, wrap `0xd8→0xd4` | cada llamada | **2** (~110 ms) |
| `0xd8–0xdb` | Fountain (olas agua B / fuente) | 4 | ciclo de tiles `inc`, wrap `0xdc→0xd8` | cada llamada | **2** |
| `0xec–0xef` | SnakeSign (rótulo serpiente) | 4 | ciclo de tiles `inc`, wrap `0xf0→0xec` | cada llamada | **2** |
| `0x80–0x83` | Torture (2 pares) | 2+2 | toggle `xor bit0`, gate `[0x6a7e]&1` | cada 2 llamadas | **4** (~220 ms) |
| `0xfa–0xfd` | Clock / Bellows (2 pares) | 2+2 | toggle `xor bit0`, gate `[0x6a7e]&2` | cada 2 llamadas | **4** |

`inc [0x6a7e]` al final (contador de fase; sus bits bajos gatean los toggles). **Sin RNG.**
Las "dos variantes de olas según el fondo" (dato del usuario) son `0xd4–d7` y `0xd8–db`.

## 2. Animador de bytecode `0x4552` (per-actor, ⚠ con RNG) — el OTRO sistema

Intérprete de programas de 16 B en `DS:0x1b18`, indexados por `DS:0x1bc8[(base−0x34)>>2]`.
Anima **actores** del entorno (registro `0x5c5a`, 32 slots). Guarda: **salta cualquier
base < 0x34** ⇒ las estructuras de overworld (0x12 Keep … 0x1b Lighthouse) NO entran aquí.
Opcodes 1–4 = frame `base+op−1`; op>7 = delay (`timer=op−0x80`); 5/6 = bifurcación RNG
(parpadeo aleatorio). Confirmado que gobierna las **animaciones de criaturas/NPC 0x134–0x1ff**
(ciclo de andar de 4 frames) y, según `kernel-sweep-3 §1`, "antorchas titilando" por RNG.

**MAPA RESUELTO — offset `DATA.OVL` delta 0, NO +0x10** (el `+0x10` de `exe_layout` era el
mismo error de clase reloc/base que arregló #36). Correcta: mapa `DS:0x1bc8` → fileoff `0x1bc8`
y programas `DS:0x1b18` → fileoff `0x1b18`, con **`progid 0` = ESTÁTICO** (los 16 B previos a
prog1 no son un programa real; nunca se indexan). Verificación de coherencia (delta 0 vs +0x10):
con delta 0 los tiles ESTÁTICOS (mesa 0x94, cartel 0xa0, puerta 0xb8) → 0 y los ANIMADOS →
programa; con +0x10 TODO salía ≠0 (mesa=1, puerta=10) = incoherente. Además 21 criaturas
comparten `progid 9` (andar común) sólo con delta 0.

**Programas `0x1b18` (progs 1..10, opcodes 1–7=frame `base+op−1`, `0x8x`=delay `op−0x80` ticks):**
`p1`=`02 03 04 05` · `p2`=`01 02 03 04` · `p3`=`01 02 03 04 03 04 01 02` (ping-pong) ·
`p4`=`01 02 03 04 87` · `p5`=`01 8f 02 03 04` (frame0, **delay 15**, 1-2-3) ·
`p6`=`02 84 03 84 04 84 05` (delays 4) · `p7`=`01 02 01 02 03 04 02 03 04` ·
`p8`=`02 03 04 03 02 05` · `p9`=`01 8f 02 03 04 07` · `p10`=`02 82 03 82 04 82 06 01`.
Criaturas usan `progid 9` (común) o programas propios en una 2ª región >0x1e00 (progids 49..137).

**Mapa de decoración — CORREGIDO por dump EN VIVO del oráculo** (el scout de píxel-mask;
el mapa estático delta 0 aún erraba el progid de algunas familias): 0x38/0x3c CastleBritian→
`p2/p3`; **antorchas/braseros 0xb0 = `01 02 03 04 87`** (frames 0-3 + delay 7); **hoguera 0xdc =
`02 03 04 03 02 05`**; 0xd8 fuente→`p6`; 0xe8 hourglass→`p4`; 0xf0 signs→`p3`.
**Hallazgo clave:** CastleBritian (0x38–0x3f, base≥0x34) **SÍ es ciclo de tiles** ⇒ **el castillo
de LB (L3) se anima por bytecode, NO pixel-mask** (a diferencia de las estructuras de 1 tile
0x12-0x15/0x1b, base<0x34).

**⚠ EL FUEGO ES ALEATORIO (rectifica mi §previa "determinista"):** el dump en vivo confirma que en
`0x4552`, toda base ≠0x5c/≠0xa8 pasa un **GATE RNG del 50 % por llamada** (`0x461e`: `rand≥0x80`
vía `0x2092`) y los **opcodes 5/6 son probabilísticos** (5: `rand<0x40`→frame "apagado"+timer 6;
6: `rand≥0xc0`→avanza). La fuente es el `g_rng` GLOBAL (0x5420) ⇒ **render-RNG excluido (#17): el
port usa un PRNG LOCAL de vista declarado** (`ViewPrng`, no el stream). Esto explica el flicker
IRREGULAR de L5/L7. ⚠ PENDIENTE (scout, BP en vivo): la SECUENCIA real de tile-ids por familia.
**REFINADO (pixel-diff de SÓLO las filas del montaje, y14-15):** 0xb0 vs 0xb1 = **0/32 idénticas**
(mismo montaje, sólo cambia la llama) ⇒ **antorcha de pared = par COHERENTE de 2 frames
0xb0↔0xb1**; 0xb2 (brasero) y 0xb3 (hoguera, con leños en la fila 15) son **objetos DISTINTOS**
(montaje difiere 7/32 y 15/32). ⇒ el programa `01 02 03 04 87` que cicla los 4 MORFEARÍA
antorcha→brasero→hoguera; la antorcha real (L7) sólo alterna 2 llamas. **HIPÓTESIS para el
scout:** cada fuego (sconce/brasero/hoguera) es un OBJETO separado en `0x5c5a` (=`g_world_objects`)
con su tile propio, y cada uno anima su PAR (¿el programa recorre sólo 2 frames por el gate/opcodes,
o el actor arranca en su tile y el ciclo es corto?). El scout debe loguear la secuencia de `[reg+1]`
de UN sconce concreto (¿0xb0,0xb1,0xb0,… o 0xb0,0xb1,0xb2,0xb3?). Hasta confirmarlo cada familia
queda DESHABILITADA en el intérprete (`ENABLED_PROGRAM_BASES` vacío).

**IMPLEMENTACIÓN (no hecha aquí):** estos programas (delays + secuencias no uniformes + ping-pong)
NO caben en el modelo `divisor` de tileanim; requieren un **mini-intérprete de bytecode** (PC+timer
por tile visible) portado de `0x4552`. Es un subsistema nuevo, no un cambio de una línea → lo dejo
DERIVADO y documentado para el scout/seguimiento, sin implementar a medias.

---

## 3. Diff contra `game/src/render/tileanim.ts` (columna port)

> **⚠ REFUTACIÓN (task #62, `water-anim-audit.md`): la fila `0x01–02` de abajo — "no en reloj
> maestro; caso ya-correcto" — era FALSA.** El agua de superficie NO se anima por ciclo de tile-id:
> su animación es un **SCROLL vertical circular de 1 fila/pasada** que hace `fn32` del EGA.DRV
> (@0x1fe6, mecanismo B), la MISMA capa que muta banderas/fuego in-place. El ciclo 0x01↔0x02 que el
> port hacía (por el flag Redux `IsPartOfAnimation`) era el **"mar no es fiel"** del usuario:
> ondulación continua vs parpadeo de 2 tiles. Además `fn32` COMPONE el agua 0x03 scrolleada en el
> canal de ríos 0x60-0x6f / costa 0x34-0x37 / esquinas 0xe4-0xe7 (mecanismo C) = la **"costa/ríos
> muertos"**. Ambos DETERMINISTAS. PORTADOS y verificados en `render/waterfn32.ts` + `WaterAnimLayer`;
> 0x01/0x02 retiradas del ciclo-de-id de `tileanim`. Detalle exacto: `re/notes/water-anim-audit.md`.

El port deriva grupos de `TILE_INFO.IsPartOfAnimation` (dato Redux) y los cicla con la fase.

| ids | qué es | original anima | port anima | port: sí/no/mal |
|---|---|---|---|---|
| `0xd4–d7` | olas agua A | sí (div 2) | sí | **sí** ✓ |
| `0xd8–db` | olas agua B / fuente | sí (div 2) | sí | **sí** ✓ |
| `0xec–ef` | SnakeSign | sí (div 2) | **no** | **no → AÑADIDO** (inyectado en tileanim) |
| `0x80–83` | Torture | sí (div 4, ~220 ms) | sí pero a 110 ms | **mal → ARREGLADO** (divisor 4) |
| `0xfa–fd` | Clock/Bellows | sí (div 4, ~220 ms) | sí pero a 110 ms | **mal → ARREGLADO** (divisor 4) |
| `0x01–02` | agua superficie | **SCROLL fn32 1 fila/pasada** (NO ciclo de id — ver banner) | ciclaba id (mal) | **mal → ARREGLADO** (#62: scroll fn32, fuera del ciclo) |
| `0x03,0x8f` | costa base / lava | **SCROLL fn32** (mecanismo B) | no | **no → AÑADIDO** (#62 `waterfn32`) |
| `0x60–6f,0x34–37,0xe4–e7` | ríos / costa / esquinas | **COMPOSITE fn32** (agua 0x03 scrolleada en canal) | no | **no → AÑADIDO** (#62 `waterfn32`) |
| `0xe8–eb` | Hourglass | no vía reloj maestro (¿bytecode?) | sí (110 ms) | **? Clase C** (se deja; verificar) |
| `0xc0–c2` | ScaryBlackThing | no vía reloj maestro (¿bytecode?) | sí (110 ms) | **? Clase C** (se deja; verificar) |
| `0x134–1ff` | criaturas/NPC | sí (bytecode `0x4552`) | sí (actores) | **sí** ✓ |
| cursor consola | — | 55 ms (tick base) | 110 ms | **mal → ARREGLADO** (base 55 ms) |

### Implementado en este carril (render/tileanim + skin base clock)
- `ANIM_TICK_MS` 110 → **55 ms** (tick base). Cursor de consola → 55 ms automático.
- `AnimGroup.divisor` derivado del reloj: 4-frame = 2, toggles 0x80/0x82/0xfa/0xfc = 4.
  `animatedFrame` escala `floor(phase/divisor)` (agua/criaturas quedan a 110 ms, invariante).
- Inyectado el grupo **SnakeSign `0xec–0xef`** que `TILE_INFO` (Redux) no marcaba.
- Mazmorra y combate reciben `phase>>1` en skin.ts para conservar su ritmo de ~110 ms
  (combat.ts asume `phase&1`=220 ms; dungeon motes calibrados a 110 ms).
- **INTÉRPRETE de bytecode `0x4552`** (`render/tileprog.ts`): motor por-celda (PC+timer,
  opcodes 0-7 + delays + gate RNG 50 % + opcodes 5/6) con **PRNG LOCAL** (`ViewPrng`, no el
  stream #17). CABLEADO en skin.ts pero con `ENABLED_PROGRAM_BASES` **VACÍO — y así QUEDA**:
  la adjudicación del scout (`anim-composition-adjudication.md`) confirmó que NINGUNA decoración
  se anima por bytecode en el juego real (el "actor bytecode" que se midió antes era artefacto
  de sembrado forzado; el fuego se coloca ESTÁTICO y titila por fn32, ver abajo). La infra
  queda para criaturas/futuro. Tests: `fiel-tileprog.test.ts` (12).
- **PÍXEL-SWAP de banderas — SEGUNDO mecanismo, `fn32` del EGA.DRV** (`render/flagswap.ts`):
  el DRV muta el BITMAP del tile en el atlas por swap de filas gateado por un bit de RNG LOCAL.
  Implementado: **0x12 Keep (filas 0↔2, bit0), 0x14 SmallCastle (media fila 2↔4, bit1), 0x15
  LargeCastle (filas 0↔2, bit2), 0x3e gallardete de Lord British (filas 0↔2, bit3)**; Village
  0x13, faro 0x1b y el resto del mosaico de LB (0x3a-0x3f) ESTÁTICOS. VALIDADO byte-a-byte vs
  ground-truth del scout (0 px). PRNG local `ror3(seed+0x9248)^0x9248+0x11`. Landed a3bed46+45be64e.
- **RUIDO DE LLAMA del fuego — TERCER mecanismo, `fn32` @0x23ba** (`render/firenoise.ts`): el
  fuego se coloca ESTÁTICO y titila SÓLO por fn32: por pasada, incondicional,
  `fuego[p] ^= (ruidoPRNG[p] & máscara[p])` en índice EGA (máscara de llama estática 0xc0-c3
  etc.). PROCEDURAL (no frames). Implementado: antorchas/braseros **0xb0-b3, 0xbc-bf, 0xde
  (BlueFlame)** con máscaras 0xc0-c3/0xcc-cf/0xc2. `FireNoiseLayer` regenera el bitmap por pasada.
  PRNG local (#17). Validado por parecido visual con L7 (titila 12/12 frames, candelabro fijo).
  Landed 734e492. (0xdc NO es hoguera → es el MOONGATE, ver §4.)

---

## 4. Estado FINAL de las familias (todo RESUELTO; adjudicado por el scout)

Las 3 mecánicas del original ya están todas portadas y verificadas. Doctrina de composición
final (`anim-composition-adjudication.md`): las decoraciones NO se animan por bytecode `0x4552`
(el "actor bytecode" medido antes era artefacto de sembrado); van por el reloj maestro o por
`fn32` del DRV.

- **✅ Banderas de estructura (0x12/0x14/0x15) — `fn32` swap, LANDED, validado byte-a-byte (0 px).**
  Village 0x13 y faro 0x1b ESTÁTICOS (el "faro que anima" de L4 es el HAZ DE LUZ 0x2A, #10).
- **✅ Gallardete de Lord British (0x3e) — `fn32` swap filas 0↔2 bit3, LANDED (45be64e).** El
  resto del mosaico 0x3a-0x3f es ESTÁTICO (son partes distintas del castillo: gárgola, torres,
  muro, puerta; ciclarlas morfearía — el bytecode de 0x38/0x3c NO es capa visible). Swap validado
  byte-a-byte (nota: el atlas on-disk guarda 0x3e en el estado "gallardete-arriba" = frame B del
  scout; el gate bit3 fluctúa ~50% entre ambos estados reales, invisible).
- **✅ Fuego (antorchas/braseros 0xb0-b3, 0xbc-bf, BlueFlame 0xde) — `fn32` ruido de llama, LANDED
  (734e492).** SÓLO fn32-scramble (no bytecode; testigo del scout: 19 antorchas de mapa, ninguna
  actor). Procedural (40 pasadas→40 estados). Validado por parecido con L7.
- **✅ Fuente (0xd4-d7 / 0xd8-db) — reloj maestro (`0x44b8`), divisor 2.** Ya animaba (casa con L8);
  se DEJA en el reloj (el "actor bytecode con gate RNG" no tiene testigo limpio — dato de método).
- **✅ "Hoguera 0xdc" = MISLABEL — es el MOONGATE.** `0xdc` = Moongate (`MOONGATE_TILE=220`),
  animado por su carril (`fiel/moongate.ts`, blit parcial `0x1112` + contador `[0x5887]`), NO fuego.
  La llama azul que el scout asoció (`0xde` BlueFlame) SÍ es fn32 y ya está en `firenoise.ts`.
  ⇒ nada que implementar aquí; residual disuelto.
- **Hourglass (0xe8–eb)** → mapa RESUELTO: usa `p4`. Se anima por bytecode. El port ya lo
  cicla (Redux) — coherente. **ScaryBlackThing (0xc0–c2):** progid del mapa a confirmar;
  el port lo anima, sin regresión.
- **Patrón fino de los toggles gateados (derivado exacto):**
  - `0x80–83` (tortura, gate `[0x6a7e]&1`): flip en TODA llamada impar ⇒ **toggle SIMÉTRICO
    cada 2 llamadas (~220 ms)**. Mi `divisor 4` lo reproduce EXACTO. ✓
  - `0xfa–fd` (reloj/fuelle; L6 confirma = Bellows 0xfc/0xfd, no fragua): gate `[0x6a7e]&2`
    ⇒ flip en llamadas `N&2` (N mod 4 ∈ {2,3}). El frame mostrado sale A,A,**B**,A,A,A,**B**,A…
    = **B durante 1 tick (~110 ms) cada 4 (~440 ms)** — un "soplido" ASIMÉTRICO, no un 50/50.
    Mi `divisor 4` lo aproxima como toggle simétrico 220/220; el soplido fiel necesitaría una
    función de fase a medida (fuera del modelo divisor). **Divergencia menor conocida** en 2
    tiles raros (reloj de tienda, fuelle de herrería); no vale el caso especial hoy.

---

## 5. Catálogo de vídeos de calibración (`original/av-referencia/anims/`)

8 clips del DOSBox del usuario, un tile animado por clip (crop apretado). Identificados por
comparación con el atlas. **Caveat de medición:** los `.mov` son VFR (contenedor ~119 fps con
frames duplicados sobre ~23–27 fps reales) → las cadencias en ms son DIRECCIONALES, no exactas;
un capture a tasa fija haría falta para cifras firmes. Método: extracción de frames + diff +
autocorrelación de la señal de cambio.

| vídeo | anima | tile(s) | mecanismo | port | cadencia (direccional) |
|---|---|---|---|---|---|
| L1 | bandera LargeCastle | 0x15 | pixel-mask (base<0x34) | no (Clase C→scout) | ~poses lentas |
| L2 | bandera SmallCastle | 0x14 | pixel-mask | no (Clase C→scout) | ~ondea cada tick |
| L3 | castillo de LB (gallardete azul) | 0x3a–3f | ¿bytecode? base≥0x34 | no (verificar, scout) | ~lento |
| L4 | faro (luz) | 0x1b | pixel-mask (base<0x34) | no (Clase C→scout) | — |
| L5 | brasero | 0xb2? | bytecode RNG (flicker) | no (Clase C) | ~irregular, duty ~16% |
| L6 | **fuelle** (herrería) | 0xfc–fd | toggle maestro `fa-fd` (gate &2) | sí (div 4, aprox) | soplido asimétrico (§4) |
| L7 | antorcha de pared | 0xb0/b1 | bytecode RNG (flicker) | no (Clase C) | ~irregular |
| L8 | **fuente** | 0xd8–db | **ciclo de tiles (reloj maestro)** | **sí** ✓ | ~100 ms/frame ≈ divisor 2 |

**Validación clave:** L8 (fuente) mide ~100 ms/frame → confirma el `divisor 2` (~110 ms) que
implementé para los ciclos de 4 frames del reloj maestro. L2 (SmallCastle) confirma que la
bandera SÍ ondea en el original (refuerza la vía (A) del scout). L5/L7 (fuego) confirman patrón
IRREGULAR (RNG), no toggle fijo. L3 es el único candidato a ciclo-de-tiles entre las "banderas"
(base≥0x34) — dato para el scout de pixel-mask.

Pendiente de scout/calibración: (a) rutina pixel-mask de banderas 1-tile (L1/L2/L4) + faro; (b)
verificar si L3 es ciclo de tiles; (c) programa RNG de fuego (L5/L7). L6 = fuelle 0xfc-fd
CERRADO (§4: el divisor 4 es una aproximación simétrica del soplido asimétrico, divergencia
menor aceptada).
