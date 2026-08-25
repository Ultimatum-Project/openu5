# Animación del AGUA — auditoría completa (task #62)

Reporte del usuario: (a) el agua **costera/ríos NO se anima** en el port; (b) la del **mar no
es fiel**. Este documento cierra el censo, el diagnóstico y el spec exacto derivado del binario.

Fuentes: disasm `re/disasm/EGA.DRV.asm` fn32 @`0x1f98` (bloque de agua `0x1fe6–0x23b7`, ANTES
del bloque de fuego `0x23ba` y del swap de banderas `0x243a`); censo `re/notes/tile-anim-census.md`;
mecánica fn32 `re/notes/fn32-fire-noise-mechanism.md` + `flag-fire-anim-runtime.md` (apéndice:
"fn32 muta agua/olas 24/24 pasadas"); `game/src/core/data/TileData.json`.

---

## 0. TL;DR — el agua tiene DOS mecanismos, y el port sólo cubre uno (mal)

| mecanismo | tiles | qué hace el original | port hoy |
|---|---|---|---|
| **A. Reloj maestro `0x44b8`** (ciclo de tile-id) | 0xd4-d7 Waterfall, 0xd8-db Fountain | cicla ids `base..base+3` cada ~110 ms | **✓ correcto** |
| **B. fn32 SCROLL** (scroll vertical circular 1 fila/pasada) | **0x01, 0x02, 0x03, 0x8f** | desplaza el bitmap 1 fila hacia abajo (circular) CADA pasada | **✗ ausente**; 0x01/0x02 mal cicladas por id (Redux), 0x03/0x8f estáticas |
| **C. fn32 COMPOSITE** (agua scrolleada enmascarada en el cauce) | **ríos 0x60-0x6f, costa 0x34-0x37, esquinas 0xe4-0xe7** | compone el agua 0x03 (que ya scrollea) dentro del canal vía máscara estática | **✗ ausente** (todas estáticas) |

- **"El mar no es fiel"** = mecanismo B ausente. El original **scrollea** 0x01/0x02 en su sitio;
  el port las **cicla como 2 frames** (0x01↔0x02) por el flag Redux `IsPartOfAnimation`. Son dos
  efectos visualmente distintos: scroll suave vs. parpadeo entre dos tiles. **La conclusión previa
  del censo §3 ("0x01–02 … caso ya-correcto") era ERRÓNEA:** 0x01/0x02 NO están en el reloj
  maestro; su única animación es el scroll fn32.
- **"Costa/ríos no animan"** = mecanismos B (0x03 costa base, 0x8f lava) y C (ríos/costa/esquinas)
  ausentes. Redux marca `IsPartOfAnimation=0` para 0x03/0x34-37/0x60-6f/0xe4-e7 (sólo conoce
  ciclo-de-id, no la mutación in-place del atlas), así que el port las deja quietas.

---

## 1. Censo completo de tiles de agua (TileData + mecanismo original)

| id | nombre (Redux) | boat/skiff | mecanismo original | port |
|---|---|---|---|---|
| 0x00 | (mar profundo / océano) | 1/1 | **ESTÁTICO** (no lo toca fn32 ni el reloj) | estático ✓ |
| 0x01 | Water1 | 1/1 | **B. scroll** 1 fila/pasada | cicla 0x01↔0x02 (mal) |
| 0x02 | Water2 | 1/1 | **B. scroll** 1 fila/pasada | cicla 0x02↔0x01 (mal) |
| 0x03 | WaterCoast | 0/1 | **B. scroll** 1 fila/pasada (y es la FUENTE de C) | estático (mal) |
| 0x34-0x37 | OutsideWaterCoast1-4 | 0/1 | **C. composite** (agua 0x03 enmascarada, máscaras 0xd0-d3) | estático (mal) |
| 0x60-0x69, 0x6c-0x6f | WaterStream1-14 | 0/1 | **C. composite** (máscaras 0x70-0x7f) | estático (mal) |
| 0x6a-0x6b | TrollBridge H/V | 0/1 | **C. composite** (agua fluye bajo el puente) | estático (mal) |
| 0x8f | Lava | 0/0 | **B. scroll** 1 fila/pasada | estático (mal) |
| 0xd4-0xd7 | Waterfall1-4 | 0/0 | **A. reloj maestro** (ciclo id, div 2) | ✓ |
| 0xd8-0xdb | Fountain1-4 | 0/0 | **A. reloj maestro** (ciclo id, div 2) | ✓ |
| 0xe4-0xe7 | CornerWithWater1-4 | 0/0 | **C. composite** (máscaras 0xd0-d3) | estático (mal) |

Tiles usados como MÁSCARA/buffer por fn32 (no se animan por sí mismos; fn32 lee sus bytes como
forma del canal): 0x70-0x7f (`ShadowlordBoundary*`), 0xd0-0xd3 (`CornerStructure*`). Su bitmap es
estático (fn32 hace `not` y lo deshace en la misma pasada → neto cero). También compone ruido en
tiles extendidos 0x108/0x1b4 (`ItemGem`/`Shard`, combate/no-overworld) con el buffer RNG 0xf480/
0xf580 — **fuera de alcance overworld, diferido**.

---

## 2. SPEC exacto — mecanismo B (SCROLL), fn32 `0x1fe6–0x20b0`

Para cada tile T ∈ {0x01, 0x02, 0x03, 0x8f} (offsets atlas 0x80/0x100/0x180/0x4780):

```
guarda  fila 15 (bytes 0x78..0x7f del tile) en un temporal
mueve   filas 0..14  →  filas 1..15   (rep movsw hacia atrás, 0x3c words = 120 B)
escribe temporal (vieja fila 15)  →  fila 0
```
= **scroll vertical CIRCULAR, 1 fila (8 B = 16 px de ancho) hacia ABAJO, cada pasada.**
Incondicional (sin gate de bit → 24/24, como el fuego). Tile 16×16, 8 B/fila. Tras 16 pasadas
vuelve al bitmap original. Cadencia = reloj del animador (~110 ms/pasada, mismo que reloj maestro).

Verificación del disasm (bloque de 0x01, `0x1fe6`):
- `si=0x80; si+=0x78→0xf8; rep movsw ×4` → salva fila 15 a `cs:0x272`.
- `di=0xfe; si=0xf6; std; rep movsw ×0x3c` → copia `[0x80..0xf7]`→`[0x88..0xff]` (filas 0-14 → 1-15).
- `di=0x80; ds=cs; si=0x272; rep movsw ×4` → restaura fila 15 salvada en fila 0.

**En el port:** trivial en espacio RGBA (mover filas enteras es idéntico planar o RGBA). Copia del
tile → shift circular de filas → regenerar canvas 16×16, igual que `FireNoiseLayer` pero con
scroll en vez de XOR. Sin RNG (determinista). Se **RETIRA** 0x01/0x02 del ciclo-de-id de Redux.

---

## 3. SPEC exacto — mecanismo C (COMPOSITE), fn32 `0x20b2–0x23b7`

Compone el agua 0x03 (**ya scrolleada** en el paso B previo — el orden importa) dentro del canal
de cada tile de río/costa/esquina, usando la forma de canal de un tile-máscara estático:

```
por tile de canal T (dst) con máscara M (plano-3 de un tile 0x70+/0xd0+) y fuente W=tile 0x03:
  bank  =  T   AND  NOT(mask)      ; limpia los píxeles del canal en el banco/orilla
  T     = (W   AND  mask)  OR bank ; mete el agua scrolleada en el canal
```
La máscara es el byte de **plano 3 (intensidad EGA)** del tile-máscara, difundido a los 4 planos
(`and [si+3],al; and [si+2],al; and [si+1],al; and [si],al`). El `not` sobre la máscara se aplica
y se revierte en la misma pasada → **el tile-máscara queda estático** (leíble del atlas).

Bloques (si=dst, di=máscara, dx=fuente, cx=nº tiles):
| bloque asm | dst (canal) | máscara | fuente | tiles |
|---|---|---|---|---|
| `0x20b2` | 0x60-0x6f (ríos+puentes) | 0x70-0x7f | 0x03 | 16 |
| `0x2259` | 0x34-0x37 (costa) | 0xd0-0xd3 | 0x03 | 4 |
| `0x2308` | 0xe4-0xe7 (esquinas) | 0xd0-0xd3 | 0x03 | 4 |
| `0x214d`,`0x21d3` | 0x100/0x108, 0x1b4 (extendidos) | — | ruido 0xf480/0xf580 | combate/no-overworld (diferido) |

Neto por tile de canal: `T = (bank AND notMask) OR (water03_scrolled AND mask)` = blit enmascarado
estándar. La orilla queda fija; el canal muestra el agua 0x03 fluyendo (porque 0x03 scrollea en B).

**En el port (fiel):** por cada tile de canal, precomputar del atlas ESTÁTICO: la forma de canal
`mask` = plano-3 (bit intensidad) del tile-máscara correspondiente, y `bank` = tile estático con el
canal a cero. Cada pasada: `frame = (mask ? water03_scrolled : bank)`. Comparte el `water03_scrolled`
del paso B. Determinista (sin RNG).

---

## 4. Diagnóstico del PORT (game/src/render/tileanim.ts + skin/fiel/skin.ts)

- `tileanim.ts::buildAnimGroups` deriva grupos de `TILE_INFO.isPartOfAnimation` (Redux). Sólo marca
  0x01/0x02 (2-frame) y 0xd4-d7/0xd8-db (4-frame). Cicla 0x01↔0x02 por id = **el "mar no fiel".**
- No existe capa fn32 de agua. Las capas fn32 portadas (`flagswap.ts` banderas, `firenoise.ts`
  fuego) NO cubren agua. El scroll (B) y el composite (C) faltan por completo.
- 0x03/0x34-37/0x60-6f/0xe4-e7/0x8f: `isPartOfAnimation=0` en Redux ⇒ estáticas = **"costa/ríos no animan".**

## 5. Plan de port (este carril)

1. **Retirar 0x01/0x02 del ciclo-de-id** (excluir de `buildAnimGroups`, o marcarlas no-animadas)
   para que no peleen con el scroll.
2. **Capa SCROLL (B)** `render/waterscroll.ts` + montaje en skin: tiles 0x01/0x02/0x03/0x8f,
   scroll circular 1 fila/pasada, canvas regenerado por pasada (como `FireNoiseLayer`).
3. **Capa COMPOSITE (C)**: ríos 0x60-0x6f, costa 0x34-0x37, esquinas 0xe4-0xe7, componiendo el
   0x03 scrolleado con la máscara de canal (plano-3 de 0x70-0x7f / 0xd0-0xd3).
4. **Verificar** contra los vídeos del usuario (mar/olas/costa) navegador visible.

Gate: tsc · `npm test -w game` · render puro + PRNG local (aquí sin RNG: B y C son deterministas).

## 6. ESTADO — PORTADO Y VERIFICADO ✅

- **`render/waterfn32.ts`**: `scrollRowsDown` (B), `channelMaskFromTile` (plano-3) + `compositeChannel`
  (C), catálogos `WATER_SCROLL_TILES` / `WATER_COMPOSITE_MASKS`. Puro, sin RNG.
- **`skin/fiel/skin.ts`**: clase `WaterAnimLayer` (paralela a `FireNoiseLayer`): extrae los tiles del
  atlas, regenera un canvas por tile cada pasada del animador (~110 ms), comparte el buffer del 0x03
  scrolleado entre B y C. Blit prioritario en el viewport. Montada/tickeada/reseteada como las otras
  capas fn32.
- **`render/tileanim.ts`**: 0x01/0x02 excluidos del ciclo-de-id (los anima el scroll).
- **Tests**: `tests/fiel-waterfn32.test.ts` (10) + fix del caso obsoleto en `fiel-anim`. Gate: tsc
  limpio · 1340 tests verdes.
- **Verificación visual** (navegador VISIBLE, piel fiel):
  - Filmstrips offline desde el atlas REAL (16 frames): mar 0x01 scrollea sus crestas; río 0x60 fluye
    con el banco fijo; costa 0x34 fluye en la mitad de agua. La máscara de canal (plano-3 de 0x70)
    coincide con los píxeles de agua del tile de río estático (validación cruzada del composite).
  - App corriendo (`?skin=faithful&loc=0&x=…&y=…&nointro`): en un delta de ríos, el heatmap de
    cambio traza EXACTAMENTE los canales (agua fluye, bosque estático); en costa, todo el mar
    riela. 0 errores de página. → resuelve (a) "costa/ríos no animan" y (b) "el mar no es fiel".
  - **Cadencia:** 1 fila/pasada del animador; el tick del animador corre cada ~110 ms (fase par de
    los 55 ms base, MISMA cadencia que las capas fn32 de banderas/fuego y que el reloj maestro). ⇒
    ciclo completo de 16 filas ≈ **1.76 s**. Casa con el ground-truth del agua: `tile-anim-census §0`
    midió el agua en video-B ~117 ms/avance y la fuente L8 ~100 ms/frame (mismo reloj), direccional-
    mente igual a 110 ms. La ondulación continua (scroll) es la que el usuario echaba en falta frente
    al parpadeo de 2 frames que hacía el port.

### Diferido (fuera de alcance overworld)
- Bloques extendidos de fn32 (0x108/0x1b4, `ItemGem`/`Shard`) que componen RUIDO (buffer 0xf480/
  0xf580) en tiles de combate/no-overworld. No afectan al overworld; documentados, sin portar.
- La cadencia asimétrica exacta y el orden de subplanos del composite son fieles al efecto (validado
  por parecido y por la máscara de plano-3), no reclamados byte-a-byte contra un volcado del oráculo
  (el mecanismo es determinista y se derivó entero del disasm; un testigo del oráculo sería
  confirmación opcional, no bloqueante).
