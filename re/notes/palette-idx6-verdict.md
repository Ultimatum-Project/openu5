# Adjudicación paleta idx6 — ¿MARRÓN u OLIVA? (regresión de #25)

> Pregunta binaria con witness runtime: ¿el índice EGA 6 del original se ve
> **MARRÓN `#AA5500`** u **OLIVA `#AAAA00`** en pantalla?
> Contexto: task #25 (`f344a60`) cambió el extractor a OLIVA basándose en la
> tabla de DATA.OVL @0x52ee (drivers-drv.md §2.5). El usuario notó el cambio de
> color de puertas/barriles jugando; el carril de banderas midió el asta MARRÓN.

## VEREDICTO: **MARRÓN `#AA5500`**. #25 es una REGRESIÓN. **Revertir.**

El original, renderizado por el emulador de referencia del proyecto (el DOSBox‑X
del usuario, el espejo contra el que se calibra TODA la fidelidad), pinta el
índice 6 como **marrón `#AA5500`**, con la paleta EGA canónica **CON** brown‑fix.
No hay ni un solo píxel oliva.

---

## Evidencia decisiva — píxeles de frames REALES (ground truth)

Los únicos artefactos que capturan lo que el emulador **realmente pinta** son las
grabaciones de la ventana real de DOSBox‑X (no reconstruidas por nuestro tooling):

| Artefacto | Resolución | `#AA5500` (marrón, idx6) | `#AAAA00` (oliva) |
|---|---|---:|---:|
| `original/av-referencia/par-iolohut-original.png` | 1286×798 | **16160 px** | **0** |
| `original/av-referencia/shot-original-2342-44.png` | 1290×876 | **4016 px** | **0** |

- **Marrón presente en miles de píxeles; oliva CERO** (ni exacto ni vecino
  cercano — barrido de candidatos oliva = ∅ en ambas imágenes).
- Muestra de coordenadas de marrón en `par-iolohut-original.png` (madera de la
  cabaña de Iolo — exactamente puertas/vigas, lo que el usuario notó):
  `(297,159) (300,159) (303,159) (306,159) (309,159) (312,159)` = `(170,85,0)`.
- El resto de colores de esas grabaciones son el IRGB EGA canónico exacto
  (`#0000AA`, `#00AA00`, `#AA0000`, `#AAAAAA`, `#FF5555`, `#FFFF55`, blanco,
  grises…). Es la **paleta EGA estándar con brown‑fix**: idx6 = marrón.

**Por qué son ground truth y no circulares:** su resolución NO es múltiplo entero
de 320×200 (320×4=1280 ≠ 1286; aspecto no uniforme) y contienen colores de borde
antialias (`(28,30,35)`, `(59,62,65)`) — huella de escalado de vídeo/ventana, no
de una captura nativa nearest‑neighbor. Son grabaciones de la ventana real del
juego original (DATA.OVL intacto; #25 solo tocó el extractor del PORT, nunca el
binario ni el emulador → estas grabaciones son atemporales para el original).

## La TRAMPA que enmascaró la regresión (por qué el arnés no la vio)

El arnés píxel‑diff (task #26) compara frames "orig" que **NO son ground truth**:
son reconstrucciones de `re/tools/oracle_capture.py`, que reconstruye índices
EGA correctos desde la VRAM pero los pinta con una **paleta hardcodeada donde
idx6 = oliva** (la misma tabla baked que el port). Resultado: compara
oliva‑contra‑oliva y **pasa**, ocultando el fallo.

| Frame nativo (oracle_capture, 320×200) | `#AA5500` | `#AAAA00` |
|---|---:|---:|
| `_pixeldiff/samestate/orig/overworld_02.png` | 0 | 625 |
| `_pixeldiff/samestate/orig/town_04.png` | 0 | 962 |
| `_pixeldiff/samestate/port/overworld_02.png` | 0 | 692 |
| `_pixeldiff/samestate/port/town_04.png` | 0 | 991 |

Ambos lados oliva por construcción → falso PASS. **La captura nativa reconstruye
el índice bien, pero NO es testigo del color** (el color lo inyecta la tabla
baked). El color sólo puede venir de un frame realmente renderizado.

## Witness runtime de registros — intentado, NO concluyente (documentado)

Boot headless propio (oracle.py; modo de vídeo confirmado `0x0D`, 320×200 EGA
planar). Lectura del Attribute Controller reg 6 vía puertos del debugger:
`INP 3DA` (reset flip‑flop) → `OUTP 3C0 06` → `INP 3C1` devuelve `Result: ff`
(open‑bus): DOSBox‑X **no emula de forma fiable el puerto de lectura de datos del
ATC (3C1) con la CPU en pausa** — el mismo quirk de `INP` ya anotado en
`pixeldiff-headless-spike.md`. Por eso el registro no se puede leer limpio por el
pty. **No hace falta:** el frame renderizado integra el estado real end‑to‑end
(ATC + DAC) y es estrictamente más autoritativo que un registro — y muestra
marrón. (Nota adicional: había 1 dosbox‑x del usuario vivo → confound del pty;
no se tocó, boot propio con precedente de confound.)

## Por qué #25 se equivocó — "tabla leída ≠ paleta aplicada"

La derivación estática de #25 (`drivers-drv.md §2.5`) es real en su lectura de
bytes: DATA.OVL @0x52ee = `00 01 02 03 04 05 06 07 38 39 3a 3b 3c 3d 3e 3f`, y el
decode EGA 6‑bit de `0x06` = `#AAAA00` (oliva) es **correcto** (el brown‑fix del
BIOS es `0x14` = `#AA5500`). El error NO está en leer ni decodificar la tabla:
está en **asumir que esa tabla se ESCRIBE al ATC reg 6 en runtime**. Nunca se
witnessó esa escritura (la propia nota marca los índices runtime como "Clase C,
falta witness"). El frame renderizado prueba que la paleta APLICADA tiene idx6 =
marrón: o U5 no reprograma el reg 6 por esa vía en el mode‑set VGA (usa el default
BIOS con brown‑fix), o la tabla @0x52ee tiene otro propósito. Sea cual sea el
mecanismo, en la plataforma de referencia **idx6 se pinta marrón**. Corroboran:
(a) el usuario notó la anomalía oliva jugando; (b) U5 en EGA/VGA es conocido por
usar el marrón EGA estándar para madera/suelo.

---

## ¿Revertir #25? SÍ. Sitios a devolver a marrón `#AA5500` (idx6 = `[0xAA,0x55,0x00]`)

**No lo revierto yo (adjudicación pura).** El fix debe:

1. **`extractor/src/parsers/tiles.ts`** — `EGA_PALETTE[6]` → `[0xaa,0x55,0x00]`
   (FUENTE ÚNICA de los assets de tiles) + saneo del comentario/cita.
2. **`extractor/tests/tiles.test.ts`** — el test "índice 6 es amarillo‑oliva"
   se INVIERTE a `expect(EGA_PALETTE[6]).toEqual([0xaa,0x55,0x00])`.
3. **Regenerar assets** — `npm run extract` (el atlas volverá a marrón; el
   commit de #25 reportó "10098 px oliva, 0 px marrón" → debe invertirse).
4. **`game/src/skin/fiel/dungeon.ts`** — `EGA[6]` / `DOOR_COL` (comentario
   "puerta oliva" → marrón).
5. **`game/tools/pixeldiff/pdlib.py`** `PALETTE[6]` + `test_pdlib.py`
   `test_idx6_is_olive` (invertir) — **crítico**: mientras esté oliva, el arnés
   sigue comparando oliva‑contra‑oliva y no detecta la regresión.
6. **`re/tools/oracle_capture.py`** `EGA_PALETTE[6]` (embebida) — para que las
   capturas nativas dejen de inyectar oliva (fuera del árbol del port pero
   necesario para que el arnés vuelva a ser testigo válido).
7. **Docs**: `docs/formats/tiles-lzw.md`, `re/notes/drivers-drv.md §2.5`,
   `docs/superpowers/specs/2026-07-15-pixel-diff-harness.md` — corregir la
   afirmación "idx6 = oliva sin brown‑fix" y anotar que el runtime la contradice.

Revisar también los otros usos que grepearon idx6/oliva en `pic16.ts`,
`dngtiles.ts`, `cli.ts`, `skin/fiel/skin.ts` por si consumen la constante (la
textura de mazmorra "dng1 = oliva" es un nombre de variante distinto, no el idx6
EGA — verificar antes de tocar).

## Método (reproducible)

```
python3 -c "from PIL import Image,ImageColor as C;from collections import Counter as K; \
im=Image.open('original/av-referencia/par-iolohut-original.png').convert('RGB'); \
c=K(im.getdata()); print('BROWN',c[(170,85,0)],'OLIVE',c[(170,170,0)])"
# → BROWN 16160  OLIVE 0
```
