# Reverificación — ¿anima la COSTA su agua? (2026-07-17, carril fiel/water-anim-set)

**Pregunta del usuario**: los tiles con parte de TIERRA (costa/orilla) NO animan su
agua en el port; sólo el mar abierto. Testigo empírico del usuario en su DOSBox: **el
agua de las costas SÍ se mueve en el original**. ¿Cuál es el set exacto animado por el
binario, coincide el del port, y hay bug de fidelidad?

**Respuesta corta**: (1) El binario anima la costa — derivado ENTERO del disasm, tabla
abajo. (2) El set del port **calca el del binario, sin faltar ningún tile**. (3)
Empíricamente el port YA anima la costa en AMBAS pieles en main tip (heatmap traza los
canales). ⇒ **el set del port no tiene un tile de costa muerto**; si el usuario ve la
costa quieta, el origen NO es un id ausente del set (ver §3: por reconciliar).

---

## 1. TABLA EXACTA del set animado por fn32 — leída ENTERA del disasm

`re/disasm/EGA.DRV.asm`, rutina `fn32` (sel 0x60 → `0x1f98`), región de agua
`0x1fe6–0x23b7`. Leída bloque a bloque. Cada tile-id = offset_atlas / 0x80.

### Mecanismo B — SCROLL vertical circular 1 fila/pasada (`0x1fe6–0x20b0`)
Cuatro sub-bloques idénticos (salva fila 15 → `rep movsw std` filas 0-14→1-15 →
restaura en fila 0), uno por `si`:

| `si` (offset atlas) | tile | nombre |
|---|---|---|
| `0x80`   | **0x01** | Water1 |
| `0x100`  | **0x02** | Water2 |
| `0x180`  | **0x03** | WaterCoast (además FUENTE del mecanismo C) |
| `0x4780` | **0x8f** | Lava |

### Mecanismo C — COMPOSITE (agua 0x03 scrolleada enmascarada en el canal)
Por tile: `bank = dst AND notMask`; `dst = (fuente AND mask) OR bank` (blit enmascarado
`lodsb·and[bx]·or[di]·stosb` en `0x211e`/`0x22c3`/`0x2372`). `mask` = plano-3 (bit
intensidad) del tile-máscara. `si`=dst, `di`=máscara, `dx`=fuente, `cx`=nº tiles:

| bloque | `si`→dst | `di`→máscara | `dx`→fuente | `cx` | tiles (dst) | overworld |
|---|---|---|---|---|---|---|
| `0x20b2` | `0x3000`→0x60 | `0x3800`→0x70 | `0x180`→0x03 | 16 | **ríos 0x60-0x6f** ← 0x70-0x7f | SÍ (1358 celdas) |
| `0x214d` | `0x8400`→0x108 | `0x8000`→0x100 | `0xf580`→**ruido RNG** | 1 | ext 0x108 (ItemGem) | NO (combate) |
| `0x21d3` | `0xda00`→0x1b4 | `0x8000`→0x100 | `0xf480`→**ruido RNG** | 1 | ext 0x1b4 (Shard) | NO (combate) |
| `0x2259` | `0x1a00`→0x34 | `0x6800`→0xd0 | `0x180`→0x03 | 4 | **costa 0x34-0x37** ← 0xd0-0xd3 | SÍ (1784 celdas) |
| `0x2308` | `0x7200`→0xe4 | `0x6800`→0xd0 | `0x180`→0x03 | 4 | esquinas 0xe4-0xe7 ← 0xd0-0xd3 | NO (0 celdas mundo) |

**SET COMPLETO (overworld) = scroll {0x01,0x02,0x03,0x8f} + composite {0x34-37, 0x60-6f,
0xe4-e7}.** Los bloques 0x214d/0x21d3 componen RUIDO (no agua 0x03) en tiles de combate
extendidos → fuera de alcance overworld.

### Comparación con el SET DEL PORT (game/src/render/waterfn32.ts)
- `WATER_SCROLL_TILES = {0x01,0x02,0x03,0x8f}` → **idéntico** al mecanismo B. ✓
- `WATER_COMPOSITE_MASKS = {0x60-6f→0x70-7f, 0x34-37→0xd0-d3, 0xe4-e7→0xd0-d3}` →
  **idéntico** al mecanismo C overworld (mismos dst, mismas máscaras, misma fuente 0x03). ✓

**El set del port está COMPLETO y calca el binario. NO falta ningún tile de costa/orilla.**

## 2. El port ya lo implementa (#62) y funciona en main tip

- `render/waterfn32.ts`: `compositeChannel` + `channelMaskFromTile` (plano-3).
- `skin/fiel/skin.ts`: `WaterAnimLayer` (build @1150, tick @1330, blit @726) regenera el
  canvas de cada tile de canal por pasada del animador (~110 ms) y lo blitea.
- Piel **shader** envuelve la fiel y copia su canvas al viewport (present @265) → hereda
  la animación.

### Verificación EMPÍRICA (dev server propio :5252, delta de ríos overworld x=124 y=41)
Diff por-celda del viewport (px que cambian en 400 ms), por clase de tile:

| clase | celdas | animan | chg medio/celda |
|---|---|---|---|
| SEA 0x01-03 | 11 | **11** | 135 |
| COSTA 0x34-37 | 11 | **11** | 73 |
| RÍO 0x60-6f | 40 | **39** | 52 |
| tierra | 59 | **0** | 0 |

- Idéntico patrón en la piel **shader** (canvas visible 640×400). Heatmap temporal
  (`agua/port-coast-heatmap.png`): lo que cambia traza EXACTAMENTE los canales de agua y
  el mar; el bosque es negro.
- Cobertura de máscara: costa 0x34-37 = 136/256 px; ríos 116-166 (0x6a-6f más finos,
  36-70). Ninguna vacía. (Un 0x68 dio 0 chg en 400 ms: artefacto del patrón disperso del
  0x03, no tile muerto — su máscara es 158/256.)

### Segunda verificación — COSTA OCEÁNICA (x=107 y=233, costa+mar sin ríos)
En una ventana de 400 ms la animación es MUY sutil (costa 30/30 celdas animan, avg 12.5
px; mar 61/61, avg 15.9): el scroll avanza ~1 fila/110 ms de un patrón disperso, así que
una ventana corta infravalora. En una ventana LARGA (~1.2 s, 10 frames), el heatmap
(`port-oceancoast-heatmap.png`) muestra TODO el campo de agua blanco — costa y mar por
igual — y sólo la tierra en negro. ⇒ la costa oceánica también anima el ciclo completo,
indistinguible del mar abierto; sólo es más LENTA/sutil de percibir en un vistazo corto.

Evidencia: `original/av-referencia/shader-evolution/agua/` → `port-coast-heatmap.png`
(delta de ríos), `port-oceancoast-heatmap.png` (costa oceánica, ciclo completo),
`port-coast-anima.gif`, `shader-coast-124-41.png` (gitignored).

## 3. Reconciliación con el testigo del usuario (POR CERRAR antes de tocar nada)

El testigo del usuario prueba que el ORIGINAL anima la costa — coincide con la ASM. Pero
en main tip el PORT también la anima (medido). El "port con costa muerta" **no se
reproduce** en el commit que probé. Antes de tocar código o goldens hay que pinchar la
discrepancia (no fabricar un fix de un bug que la evidencia no confirma):

1. **¿La build del usuario == main tip?** Su :5199 sirve el checkout principal. Si su
   bundle está cacheado/viejo (previo a #62 o a algún fix), vería la costa quieta aunque
   main la anime. → confirmar con recarga dura / hash.
2. **Ubicación/tile EXACTOS** donde ve la costa quieta. Si el original la anima, el tile
   está en {0x34-37, 0x60-6f} (los únicos mixtos que el binario compone) → que el port
   ya anima. Un id fuera de ese set no anima en el original TAMPOCO (sería fiel).
3. **¿Es un gap de INTENSIDAD, no de existencia?** La costa del port anima ~la mitad de
   vívida que el mar abierto (73 vs 135 px/celda): el 0x03 compuesto es más disperso y va
   contra la tierra. Si la costa del DOSBox riela MÁS, sería una divergencia de
   vividez/cadencia (sutil), no "muerta" — a comparar con un clip del original.

**Estado**: derivación (§1) y verificación (§2) cerradas. NO se han tocado goldens (no
hay bug confirmado; se respeta el aviso de pixeldiffs). Pendiente: los 3 puntos de §3 con
el usuario para decidir si hay algo que arreglar y qué.
