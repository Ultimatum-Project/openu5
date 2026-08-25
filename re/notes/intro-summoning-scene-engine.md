# intro-summoning-scene-engine.md — el cuarto+moongate del attract es un TILE-CINEMATIC (FONT.OVL)

Derivado 2026-07-16 desensamblando `FONT.OVL` con `re/tools` (binfiles+disasm, mapa de
globals). Resuelve el **PUZZLE del handoff (punto 4)**: por qué la habitación top-down +
moongate del attract ("The Summoning", video-P f061–f093) NO está entre las 21 láminas
STORY que pinta `play_introduction` (ítem G). **No es una lámina: es una ESCENA DE TILES
guionizada por el scene-engine de FONT.OVL** (el mismo del ENDGAME), con el moongate
colocado y animado por el script — por eso no es un `.16`.

Formato de cita `fileoff: instr → regla` sobre el disasm de FONT.OVL. Complementa
`intro-attract-loop.md` (que refutó que el attract-LOOP de INTRO pintara el cuarto) y
`intro-scene-tables.md` (las 21 láminas, que son OTRA cosa).

## 1. El scene-engine de FONT.OVL (3 piezas)

- **`load_scene` (0x0418)** — carga la escena `[bp+4]`:
  - `0420: bx=[bp+4]<<1; 0425: push [bx+0x515c]; 0429: call 0x9ae2` → pasa el puntero
    `0x515c[scene]` al cargador/rotulador (ver §2: son los TÍTULOS de capítulo).
  - `0431: ax=[bp+4]<<7` (scene·128) → offset en el buffer de mapa `0xb21e`; copia 19
    filas (`0483: cmp [bp-2],0x13`) al doble grid de tiles `0x6608`/`0x6708` (stride 0x20
    = 32 celdas/fila = la rejilla de pantalla).
  - `0489: [0xbd27]=[0xbd26]=9; 0491: [0xbd28]=0; 0499: [0xbd29]=scene` → fija el MODO de
    escena (`0xbd29`) y los contadores de fundido de cortina (`0xbd26/27` = 9).
- **`scene_tick` (0x02fc)** — un frame de la escena:
  - Recorre la tabla de OBJETOS/actores `0x5c5a` (stride 8: `[+0]`=flag, `[+1]`=tile,
    `[+2]`=col, `[+3]`=fila) y los coloca en el grid: `031e: idx=(fila<<5)+col`,
    `0335: [idx+0x6688]=tile` (celda = fila·32+col). (0x0312–0x0340)
  - Pinta las 4 sub-filas del grid llamando `0x2a2` por celda ≠ `0xfe` (0x0350–0x036c).
  - **Cortina** (`0xbd26/27/28`): abre/cierra la banda de revelado por columnas
    (0x037e–0x039b) — el mecanismo del descubrimiento del cuarto (f061→f070).
  - **Despacho por MODO `0xbd29`** (0x03b7):
    - `==2`: `noise_burst(20,60,10000)` = el TRUENO de la summoning (`sfx-catalog §4.10`).
    - `==3`: **animación del MOONGATE** — `03d7: inc [0x515a]` (contador 0..7 con wrap),
      y a los frames 0 y 4 toca el chime (`0xbb8`/`0x7d0` → `call 0x40e0`). (0x03d0–0x0403)
- **Intérprete de SCRIPT (0x04a4)** — sin caller interno (entra por thunk externo). Lee
  opcodes de un script (byte `[PC + 0xB21E]`, `PC=[bp-0xc]`) y:
  - coloca el **MOONGATE = tile `0xdc` (=220)** en el grid: `0683: al=0xdc;
    88840867 [si+0x6708]=al` (0x0679–0x068d) y lo hace SUBIR/BAJAR con bucles que llaman
    `scene_tick` frame a frame (`si=1..0x10` subiendo 0x0657–0x0674; `si=0xf..0` bajando
    0x06b6–0x06cc) — el moongate que se abre.
  - `06ed: call 0x418` `load_scene(script_byte)` → cambia de capítulo.
  - `0704: ax=(script_byte<<3)+0x5c5a` → escribe en la tabla de objetos (coloca mobiliario/
    actores).

## 2. La tabla de escenas `0x515c` = los 4 capítulos del ENDGAME

`0x515c[0..3]` (DATA.OVL fo `0x516c`) = punteros DGROUP a los strings:
`"The Summoning"`, `"The Journey"`, `"The Arrival"`, `"The Welcoming"`
(DATA.OVL `0xa010/0xa01e/0xa02a/0xa036`). **Son los 4 capítulos del ENDGAME de Ultima V.**

⇒ El cuarto+moongate del ATTRACT es la escena **"The Summoning"** de este tile-cinematic
(capítulo 0), REUTILIZADA como demo de portada. Coincide todo: el rótulo "The Summoning"
del witness, el moongate que se abre en el centro (`scene_tick` modo 3 + el `0xdc` del
script), el trueno (modo 2), y la cortina de revelado. **No es un `.16` porque es un mapa
de TILES guionizado, no una ilustración.**

## 3. Dónde viven los mapas de tiles (para extracción EXACTA — PENDIENTE)

`load_scene` copia el mapa desde el buffer `0xb21e` (donde `0x9ae2` deja el fichero de la
escena). Candidato fuerte: **`MISCMAPS.DAT`** (1871 B) — denso en suelo `0x44`(204×) y muro
`0x4f`(77×), y SIN `0xdc` (coherente: el moongate lo pone el SCRIPT, no el mapa). `END.DAT`
(3698 B) tiene los textos/estructura del endgame.

**Clase C restante (timebox del lead alcanzado):** el formato exacto de `MISCMAPS.DAT`
(ancho/cabecera/compresión) NO se cracó en esta pasada — renderizado como rejilla cruda a
ancho 19 sale ruidoso (rayas regulares ⇒ hay cabecera o el ancho es otro). Extraer el
cuarto EXACTO exige: (a) cracar `MISCMAPS.DAT` + su indexado por `scene·128`; (b) leer el
SCRIPT (buffer del intérprete 0x04a4) para las posiciones del mobiliario/moongate; (c)
confirmar que el attract de INTRO invoca ESTA escena (vía qué thunk). Es una derivación de
horas sobre datos del ENDGAME.

## 4. Estado del port (task #19)

La implementación actual (`game/src/skin/fiel/summoning-room.ts` +
`renderSummoningRoom`) **CALCA** el cuarto del witness f070 (estructura muro/suelo
derivada por emparejamiento de tiles; mobiliario a nivel de rasgo) con el moongate como
óvalo dorado que crece + cortina + rótulo — **fiel al witness y pre-aprobado por el
timebox**. Esta nota deja el camino para SUSTITUIRLO por el mapa exacto si se cráca
`MISCMAPS.DAT`. Nota de fidelidad ya confirmada por la derivación: el moongate real es el
tile `0xdc`(220) animado (8 frames, `scene_tick` modo 3); el óvalo dorado del port es una
aproximación de su "apertura" (el tile 220 crudo del atlas es un recuadro azul liso).

## 5. CORRECCIÓN (2ª pasada) — INTRO NO llama al scene-engine de FONT; el timeout va a 'R'

Desensamblado el controlador de menú de INTRO.OVL (scratchpad `INTRO.OVL.asm`):

- **Timeout del menú (punto 3 del handoff) = 200 ticks, y va a 'R', NO al Summoning.**
  Bucle de espera `0x0d75–0x0d91`: `0d73: si=0`; poll (`9978`/`9e72`) → `[bp-0xe]`=tecla;
  sin tecla toca música (`2090`); `0d86: inc si; 0d87: cmp si,0xc8`(=200) `jge` sale.
  Al salir con tecla=0 (timeout): `0daa: or ax,ax; je 0xdec` → `0dec: [bp-0xe]=0x52`('R').
  La 'R' despacha en `0x100a: call 0xfb1a` (return-to-view) `; jmp 0xcd0` (REDIBUJA el
  menú y vuelve al bucle). ⇒ el menú ocioso hace timeout a 'R' y **se queda en el menú**;
  no auto-lanza ninguna cinemática desde INTRO.
- **INTRO.OVL NO invoca el scene-engine de FONT (0x0418/0x02fc/0x04a4).** Los ÚNICOS
  thunks de INTRO a FONT son `0xfb26` (texto proporcional, lo usa play_introduction para
  las 21 láminas), `0xfb0e` (creación/gitana) y `0xfb1a` (return-to-view / 'R'). No hay
  thunk al scene-engine ni bucle de blit de tiles en el attract. La única `call 0x14e`
  (play_introduction) está en el dispatch 'U' del menú (`0x0fe8`) y pinta las 21 LÁMINAS.
- **⇒ El renderizador del cuarto del attract NO está en INTRO.OVL** (corrige la implicación
  del §1-2 de que el attract usaba el scene-engine de FONT). El cuarto+moongate llega por
  **`0xfb1a` return-to-view** → el KERNEL/motor de juego muestra la vista top-down; en
  arranque sin partida eso reproduce una VISTA/DEMO de juego (tiles reales + moongate tile
  `0xdc`), no la cinemática de láminas ni la del endgame. El scene-engine de FONT (§1) +
  MISCMAPS (§3) es el ENDGAME ("The Summoning/Journey/Arrival/Welcoming"), un mecanismo
  HERMANO pero distinto del attract. Cuál de los dos (demo de juego vs cinemática endgame)
  produce EXACTAMENTE los frames video-P f061-093 exige seguir `0xfb1a` en el kernel + el
  posible save/estado de demo → **fuera del alcance de INTRO.OVL; es trabajo de la task #20**
  (motor de tile-cinematics / demo).
- **Punto 2 (puzzle) CERRADO:** el cuarto NO es una lámina del ítem G, y NINGUNA de las 21
  se renderiza mal por esto — es una vista de TILES (otro subsistema), por eso nunca estuvo
  entre las láminas. No hay bug latente de la cinemática U por este lado.
- **MISCMAPS.DAT (formato, 1ª luz):** filas de 32 B con DOS mapas de **11 de ancho** lado a
  lado (cols 0-10 y 16-26, con `0x00` de relleno en 11-15 y 27-31); `0xff` = celda
  transparente/borde. Renderizados a 32-de-ancho salen CUARTOS de ladrillo reconocibles
  (grises muros `0x4f`, suelo `0x44`, mobiliario, puertas `0xbb/0xb9`). Es la fuente de los
  mapas del ENDGAME (11×11, tamaño estándar U5). Nota: `load_scene` (§1) lee 19-de-ancho de
  un buffer de 32-stride — NO cuadra con el 11-de-ancho de MISCMAPS crudo ⇒ hay una
  transformación/índice intermedio (o el buffer se rellena de otra fuente). Reconciliar
  eso + confirmar qué escena es "The Summoning" = task #20.

**Veredicto para task #19:** el calco del witness (aterrizado `0b189cb`) es fiel al VISUAL
y queda como la representación del cuarto. La extracción del mapa EXACTO depende de resolver
el renderizador real (demo de juego vs endgame) y el formato de su mapa — trabajo de #20, no
un simple swap. Esta nota deja el árbol de decisión trazado.

## 6. VEREDICTO del timebox (MISCMAPS crackeado, pero NO es el cuarto del attract)

Formato de **MISCMAPS.DAT RESUELTO**: filas de 32 B = mapa de **11 de ancho** (cols 0-10)
+ relleno + un 2º carril (cols 16-26); `0xff` = celda transparente. Renderizado limpio a
11-de-ancho × 58 filas sale un **MAPA DE JUEGO conectado grande**: cuartos de ladrillo
amueblados arriba (mesas, sillas, camas, estantería), luego bosque/hierba, luego
montaña/agua. NO es el cuarto ~19-de-ancho aislado del attract (f070, el estudio del
Avatar con cama+clavicémbalo+planta). ⇒ **MISCMAPS.DAT es un mapa de juego (endgame/misc),
no el cuarto del attract.**

Cruzado con §5 (INTRO no llama al scene-engine; el cuarto llega por return-to-view), el
**cuarto del attract es una VISTA/DEMO del motor de juego** (el estudio del Avatar en
Britannia renderizado como vista top-down), no un registro extraíble de MISCMAPS ni la
cinemática de láminas ni (directamente) el scene-engine del endgame. Extraer el mapa EXACTO
del attract = encontrar el estado/save de la DEMO + la localización del mapa + seguir
`0xfb1a` en el kernel — derivación de kernel/demo, **fuera del alcance de #19**.

**Cierre #19 (timebox del lead alcanzado):** el calco del witness (aterrizado `0b189cb`,
brief #20 en `a8dcc18`) queda como el cuarto, **fiel al visual**. No hay swap trivial: el
renderizador real es el motor de juego (demo), no una tabla de tiles cinemática. Lo que SÍ
queda derivado y de regalo para #20: el scene-engine de FONT (§1), el moongate=`0xdc`
scripteado (§1), los 4 títulos del endgame (§2), y **el formato de MISCMAPS.DAT (§3+§6)**.
El INTÉRPRETE de guiones completo (0x04a4) sigue pendiente para #20.

## Apéndice — reproducción
```
cd re/tools && python3 -c "import binfiles,disasm; open('/tmp/FONT.asm','w').write(disasm.to_asm(binfiles.get('FONT.OVL'), disasm.globals_map.GLOBALS))"
python3 -c "d=open('original/u5/ultima5/DATA.OVL','rb').read();
print([d[p+0x10:d.index(0,p+0x10)] for p in (0xa010,0xa01e,0xa02a,0xa036)])"  # 4 títulos del endgame
python3 -c "d=open('original/u5/ultima5/MISCMAPS.DAT','rb').read();
print(len(d), d.count(0x44), d.count(0x4f), d.count(0xdc))"                    # 1871 204 77 0
```
