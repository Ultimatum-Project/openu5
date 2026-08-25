# DNGLOOK.OVL — raster de la vista de mazmorra (spec para E1-S9)

Scout de las **primitivas de raster** de la vista first-person + gema de mazmorra.
Insumo del cableado de la task #29 (E1-S9). La **lógica** (raycast/visibilidad,
diccionario de tiles, orientación) YA está derivada en `re/notes/dungeon.md`
(§0.2, §3) y `re/verified/dungeon.md`; **aquí NO se re-deriva** — se documenta el
PIXELADO: qué rutina pinta qué, con qué primitiva, en qué buffer, y qué tablas de
geometría alimentan cada profundidad.

Direcciones = offset de fichero dentro de `DNGLOOK.OVL` (= offset del listing;
verificado: `xxd -s 0x0670 DNGLOOK.OVL` == bytes del `.asm`). Rebase de calls near:
`true_CS = (target + 0xA290) & 0xFFFF` (DNGLOOK load_seg·16 = 0xA290,
`re/notes/dungeon.md` §rebase). El clon de la piel vive en `game/src/skins/` y
consume `CoreView`; el core ya expone `dungeonState` (planta + facing + celdas
visibles).

---

## 0. Reconciliación (importante — corrige el rótulo de `dungeon.md §13`)

`DNGLOOK.OVL` **no es sólo "Look"**: es la **librería de raster de mazmorra**. El
fichero son 5040 B (0x13B0); TODO es código (0x0000..0x13AC). Las tablas de
geometría (0x24xx), sprites (0x38xx) y punteros de gráfico (0x13bx/0x25f2) **NO
están en el .OVL** — son **DS-relativas** (segmento de datos compartido = DATA.OVL,
`fileoff = DS + 0x10`, misma convención que `lookobj.md`). Las primitivas
(`0x6880`, `0x742a`, `0x75c0`, `0x67e0`…) tampoco: son rutinas **co-residentes**
(COMSUBS/kernel) mapeadas en el CS único de 64K.

**Grafo de llamadas interno** (grep `call` en el .asm) → separa ENTRADAS
(llamadas cross-overlay desde `DUNGEON.OVL`) de helpers internos:

| offset | rol | quién lo llama |
|--------|-----|----------------|
| **0x0000** | `dnglook_look` — describe tile (TEXTO, no raster) | DUNGEON dispatch (cmd Look) |
| **0x06A8** | `dnglook_view_gem` — mapa 8×8 de la planta (icónico) | DUNGEON dispatch (Peer gem) |
| **0x0D3E** | **build first-person 11×11** (el raster de pasillo) | **entrada** (DUNGEON:0x1A90 `dng_render_corridor`) |
| **0x117E** | overlay de **sprites** (party/monstruo) en el pasillo | entrada (tras 0x0D3E) |
| **0x0FDA** | mover party en mazmorra (dec/inc x/y + wrap + facing) | entrada (DUNGEON move) |
| **0x109E** | cargar gráficos de muro-variante (tabla ptr 0x25F2) | entrada (init de vista) |
| **0x1130** | liberar esos gráficos | entrada (teardown) |
| **0x0844** | marcar celda visitada (bitmap 0x58E0) | entrada |
| **0x093A** | limpiar marcadores "consumidos" del grid | entrada |
| 0x0284 | 8-líneas (campo mágico) — helper de 0x0340 | 0x0340 |
| 0x0340 | **drawer icónico por celda del gem-map** (jump-table 16) | 0x06A8 |
| 0x08D4 | test bit visitado | 0x097E/0x093A |
| 0x097E/0x0A48/0x0AEE | rellenos de celda (marcadores de suelo) | 0x0B9E |
| 0x0B9E | despacha relleno por hi-nibble del tile bajo party | 0x0C6C |
| 0x0C6C | limpia el buffer 11×11 + dibuja el marco base suelo/muro | 0x0D3E |

**Conclusión:** el pipeline first-person que S9 necesita = **0x0D3E → 0x0C6C →
0x0B9E → {0x097E,0x0A48,0x0AEE}** (marco) **+ tablas 0x2452–0x24C6** (muros en
perspectiva) **+ 0x117E** (sprites). El raycast que decide QUÉ celdas son visibles
está en DUNGEON (§3 de `dungeon.md`) y ALIMENTA este builder — no se re-deriva.

---

## 1. Buffers y viewport

| símbolo | dir | tamaño | uso |
|---------|-----|--------|-----|
| **view buffer 11×11** | DS:**0xAD14** | 11 cols × 11 filas, **stride 0x20** (0xAD14..0xAE74 = 0x160) | grid de **tile-ids** (1 byte = 1 tile de 16px). 0xFF = transparente/vacío |
| gem scratch A/B | DS:0xA528 / 0xA628 | 256 B c/u | endpoints de los 8 rayos del gem-view (0x06A8) |
| party sprite grid | DS:0x5C5C / 0x5C5D | fila de 8 | formación de la party que escribe 0x117E |
| visited bitmap | DS:0x58E0 | bits | celdas visitadas por planta (0x0844 set, 0x08D4 test) |

**Viewport**: la ventana de blit se fija con `push 8;push 8;push 0xB7;push 0xB7;
call 0x6816` (0x06BB, 0x0837) = región (8,8)–(0xB7,0xB7) = **176×176 px** = 11 tiles
× 16 px. **Es la MISMA ventana 11×11 del overworld** (task E1-S8b), reutilizada.

**El grid es COMPOSICIÓN DE TILES, no vectores**: los muros en perspectiva
(trapecios) están **horneados en los bitmaps de tile** de un tileset de vista de
mazmorra (ids 0x00..0x0A); el builder sólo COLOCA qué tile-id va en cada celda
según profundidad/facing. Sólo las *features* (escaleras, cofres, fuentes) y los
*sprites* de monstruo se dibujan con líneas/plots o blits de sprite encima.

---

## 2. Pipeline first-person — `dng_build_view` @ 0x0D3E (instrucción→regla)

> ⚠ **CORRECCIÓN 30-07 (#275, refutada por #248 + #269):** la rutina 0x0D3E NO es el
> pipeline de la vista first-person — es el **CONSTRUCTOR SINTÉTICO del registro .CBT**
> de campamento/emboscada. Las «4 columnas/aristas» de los pasos 5-6 son las
> **posiciones de ENTRADA de los 6 miembros** (filas 1..4 col 11..16 = X, 17..22 = Y del
> formato .CBT — corroborado al byte por extractor/src/parsers/combatmap.ts) y los
> «muros lejanos» del paso 6 son las **coordenadas de las 16 UNIDADES** (filas 6/7).
> `g_unk_58A1 & 4` no es «sala/ciego»: es la bandera **CAMPAMENTO** del encuentro
> (parámetro de run_combat_encounter 0x5f86, escrita por camp_command 0x3e65 con 6;
> lectores: este constructor y combat_actor_sleep 0x6908). Fichas: g_unk_2452 /
> g_unk_2476 / g_cbt_room_record del ledger. La prosa de abajo se conserva como
> testimonio del error, NO como derivación vigente.

1. **0x0D46** — rellena TODO el 11×11 con `g_unk_bb15` (tile de techo/void):
   `si=0xAD14; rep 11 bytes = bb15; add si,0x20; cmp si,0xAE74; jb`.
2. **0x0D6A** — si `g_unk_58A1 & 4` → `g_unk_ADB9 = 0xB3` (flag de estado "sala/
   ciego": cambia el tile de suelo-feature).
3. **0x0D76** — `call 0x0C6C` = dibuja el **marco base** (suelo + techo + muros
   laterales cercanos), ver §2a.
4. **0x0D7B** — pone a 0xFF (transparente) dos filas del **punto de fuga** lejano
   (`[si-0x51D9]`, `[si-0x51E1]`, si 0..7).
5. **0x0D8E–0x0DF1** — **PAREDES EN PERSPECTIVA, mitad cercana** (2 bucles si 0..5).
   4 columnas del grid: di=0xAD7F, [bp-8]=0xAD5F, [bp-4]=0xAD9F, [bp-0xC]=0xAD3F
   (offsets 0x3F/0x5F/0x7F/0x9F desde 0xAD00 = las 4 "aristas" izq-ext/izq-int/
   der-int/der-ext). Con `g_unk_58A1 & 4` usa la tabla **0x2452/0x2458**; sin él,
   las tablas diagonales **0x245E/0x2464/0x246A/0x2470**. Cada byte leído se
   escribe como tile-id en la columna.
6. **0x0E53–0x0EAF** — **muros lejanos dependientes de FACING** (bucle si 0..15):
   selecciona pares de tabla por `g_dng_facing` (0/1/2/3):
   - `58A1&4` → 0x24B6/0x24C6
   - facing 0 (N) → 0x2476/0x2496
   - facing 1 (E) → 0x2486/0x24A6
   - facing 2 (S) → 0x24A6/0x2486  (par invertido)
   - facing 3 (O) → 0x2496/0x2476  (par invertido)
   (0x0E7E switch sobre facing; 0x0EB2/0x0EC2/0x0ED2 las ramas 1/2/3.)
7. ~~**0x0EEE–0x0F3A** — shuffle Fisher-Yates → jitter del titileo de la antorcha~~
   **[SUPERADO 2026-07-25 — dungeon-wanderer.md §7]**: este rango es el barajado de
   los 16 SLOTS DE MONSTRUO de la arena procedural de combate (0x0D3E = builder de
   la arena .CBT, no del render de pasillo). No hay «puntos de luz» en el original;
   el flickerMotes del port que se apoyaba aquí era una FABRICACIÓN (retirado;
   careo video-N f010-f049 = 0 píxeles amarillos).
8. ~~**0x0F3F–0x0FD3** — estampa tile 0x40+facing·4 … textura/moteado de pared~~
   **[SUPERADO — mismo careo]**: estampa `0x40 + tipo·4` (el `[bp-0x30]` viene de
   `g_char_anim_states+13` = 0x5C5A+13 = TIPO del errante) en los slots barajados de
   la arena; ver dungeon-wanderer.md §7.

**Salida**: 0x0D3E NO presenta; deja el buffer 0xAD14 listo. El blit del buffer a
EGA lo hace el llamador DUNGEON (0x1BE0 `dng_redraw`) tile-a-tile por el driver.

### 2a. Marco base — `0x0C6C`
- 0x0C74/0x0C8A: rellena fila 0xAD34 y 0xAE34 (11 B) con `g_unk_bb14` (**tile de
  suelo**).
- 0x0CA3: bucle poniendo `g_unk_bb14` en columnas (di=0xAD15, si=0xAD1D, +0x20,
  hasta 0xAE7D) = laterales.
- 0x0CBC: pone 0xFF en 0xAE5E/0xAE54/0xAD1E/0xAD14 (esquinas transparentes).
- 0x0CCA: lee el tile bajo la party; si hi ∈ 0x1..0x7 → `[bx+0x244A]` (tabla de
  suelo-feature por variante, **{00,c8,c9,c8,dc,d8,00,00}**) → `g_unk_ADB9`; si
  hi==0x3 → `g_unk_bb16=1` + `call far 0xCD2C`.
- 0x0D29: `call 0x0B9E` ×4 (si 0..3) = 4 marcadores de suelo (§2b).

### 2b. Rellenos de suelo — `0x0B9E` → `{0x097E, 0x0A48, 0x0AEE}`
0x0B9E lee el tile a `party+paso[dir]` (dir=arg), aísla hi-nibble:
- hi < 0xA0 → `call 0x0AEE` (marcador de pasillo abierto)
- hi ∈ {0xB0,0xC0,0xD0} → dibuja el tile del muro frontal exacto (`&0xF0`) vía
  `call 0x097E`
- resto → `call 0x0A48`
`0x097E/0x0A48/0x0AEE` son rellenos parametrizados por `dir` (0..3): cada uno
escribe `0xFF`/`g_unk_bb15`/tile en un patrón de celdas del grid con paso
`col<<5 + row` sobre base `[bx-0x52EC]` (= 0xAD14 en el segmento de trabajo). Son
las "cuñas" de suelo/techo que abren o cierran el pasillo según haya paso o muro.

---

## 3. Tablas de geometría — LOCALIZADAS + volcadas (DS, en DATA.OVL @ DS+0x10)

Todas indexadas por `[si+base]`, `si` = paso de profundidad. **Los VALORES
(0x00–0x0A) son tile-ids del tileset de vista de mazmorra**; el mapeo tile-id→
bitmap→píxel es **Clase C** (necesita el tileset gráfico + pixel-diff, §9). Volcado
verbatim para que S9/extractor los tenga (re-dump: `xxd -s <DS+0x10> DATA.OVL`):

```
DS 0x2452:  05 06 05 04 04 06 04 05  06 05 04 06 05 04 06 03   (near L/R, si 0..5)
DS 0x2462:  05 07 06 07 07 08 08 08  04 03 03 02 02 02 05 04
DS 0x2472:  06 03 05 07 05 04 06 03  07 02 08 05 02 08 03 07
DS 0x2482:  02 04 06 08 08 08 07 07  06 06 09 08 08 09 09 ..   (0x2486 = 16-tab far)
DS 0x2492:  0a 0a 0a 0a 02 02 02 03  03 04 04 01 02 02 01 01   (0x2496 = 16-tab far)
DS 0x24a2:  00 00 00 00 05 04 06 03  07 02 08 05 02 08 07 03   (0x24a6 = 16-tab far)
DS 0x24b2:  02 04 06 08 02 02 02 03  03 03 04 05 05 06 07 07   (0x24b6 = 16-tab far)
DS 0x24c2:  07 08 08 08 ...                                    (0x24c6 = 16-tab far)
```

Mapa de acceso (offset → bucle → columna/uso):

| tabla | len | leída en | rol |
|-------|-----|----------|-----|
| 0x244A | 8 | 0x0CFF, 0x0D02 | suelo-feature por variante de muro `{00,c8,c9,c8,dc,d8,00,00}` |
| 0x2452, 0x2458 | 6 | 0x0DAE/0x0E07 (`58A1&4`) | aristas cercanas (modo sala/ciego) |
| 0x245E,0x2464,0x246A,0x2470 | 6 | 0x0DD4/0x0DDD/0x0DCB/0x0DC2 | 4 aristas diagonales cercanas |
| 0x2476,0x2486,0x2496,0x24A6,0x24B6,0x24C6 | 16 | 0x0E6D..0x0EDB | muros LEJANOS por facing (§2 paso 6) |
| 0x24D6 / 0x24DE | 4·w | (compartida) | **dx=[0,+1,0,−1] / dy=[−1,0,+1,0]** (verif. words) |

---

## 4. Drawer icónico del gem-map — `0x0340` (jump-table de 16)

`0x0340(col,row)` dibuja el ICONO de UNA celda del mapa 8×8 en pantalla, ancla =
`(col<<3)+8, (row<<3)+8` (0x03DA: `shl 3; add 8` → grid de 8 px). Despacha por
**hi-nibble** del tile vía `jmp cs:[bx-0x5700]`, bx=hi·2. **Jump-table @0x0670
volcada** (16 words, +0xA290 = loaded; file = −0xA290):

| hi | tile | target(file) | qué pinta |
|----|------|-------------|-----------|
| 0x0 | pasillo | 0x040E | nada (chequea bit8 secreto) |
| 0x1 | escalera↑ | 0x043E | **tile glyph 0x2E** |
| 0x2 | escalera↓ | 0x0452 | **0x2D** |
| 0x3 | escalera↕ | 0x0466 | **0x2F** |
| 0x4 | cofre | 0x047A | **0x70** |
| 0x5 | fuente | 0x048E | vector (líneas 0x6880 + plots 0x69D4) |
| 0x6 | foso | 0x0554 | 0x19/0x71/0x72/**0x12** según 0x60/0x61/0x68/0x69 |
| 0x7 | cofre abierto | 0x0690 | nada |
| 0x8 | campo mágico | 0x05BA | `call 0x0284` (8 líneas en forma de X) |
| 0x9 | marcador | 0x0690 | nada |
| 0xA | sala | 0x05C6 | **0x73** (puerta) |
| 0xB | muro | 0x05DA | **0x7F**/0x74 (según 0xB0) |
| 0xC | muro especial | 0x0610 | **0x75** |
| 0xD | secreto | 0x062E | **0x76** (gate `g_unk_52C8`) |
| 0xE | puerta | 0x065C | **0x77** |
| 0xF | sala | 0x05C6 | **0x73** |

Estos son **ids de símbolo del tileset del MAPA de mazmorra** (distintos del
tileset de perspectiva 0x00–0x0A). Directamente reutilizables para la vista de
gema fiel en la piel.

---

## 5. Sprites de pasillo (party/monstruo) — `0x117E`

Overlay de sprites tras el builder. Lee `g_party_size` (0x11C9) y por cada miembro
escribe su sprite en `0x5C5C/0x5C5D` posicionado por facing (`[bp-2]=4` def, o
3/2/1 según `g_dng_facing`, 0x119E switch). Segundo bloque (0x1291+): recorre el
grid `[bx-0x524C]` y por cada celda con contenido calcula **tamaño/escala del
sprite por profundidad**:
- `& 0xFC == 0xB4` o `0xE8` → tamaño 2 (grande, cercano)
- rango 0x40+ → `(id-0x40)>>2` = índice de criatura → tamaño por tablas
  **0x383F** (sprite-id −1) + **0x384D** (offset), `si` 0..15
- estampa en `[bx+0x5C5F]` (grid de sprites de 8).

Tablas (DATA.OVL @ DS+0x10, volcadas):
```
DS 0x383A: 50 5b 41 46 4b 4c   (6 location-ids → índice de mazmorra; [0x3840]=6 = count)
DS 0x383F: 4c 06 00 08 08 04 …  (tabla de sprite-id base por criatura, si 0..15; DNGLOOK)
DS 0x384D: 01 08 00 00 00 1e …  (tabla de offset de tamaño por criatura; DNGLOOK)
DS 0x385E: ...                 (usada en 0x1281, tamaño cercano)
DS 0x13C2: 03 14 0f 14 0a 04 …  (anim-state: 8 B por estado, campo [+0])
DS 0x173C: 14 15 16 17 18 19 1c 1b  (secuencia de frames de anim)
```
El **escalado de criaturas por profundidad** = tabla, no cálculo: id→(sprite,
tamaño) por 0x383F/0x384D/0x385E. Clase C el pixel exacto de cada sprite (→ pack de
tiles + pixel-diff).

---

## 6. Vista de GEMA de mazmorra — `0x06A8`

Peer-at-gem DENTRO de mazmorra (distinta de la gema de overworld, §11). Fija
ventana (8,8)-(0xB7,0xB7); limpia buffer 0xAD14 (0x2E0 B=0xFF); traza **8 rayos**
(jump-table @0x0770 volcada → 8 stubs 0x0758–0x076F que ajustan di/si ±1 = las 8
direcciones), llamando `0x0340` (§4) por celda visible; tinte por `g_unk_52C8`
(0..3, nivel de luz); presenta con `call far 0xD966`. Consume 1 gema en el llamador
(DUNGEON), no aquí (`dungeon.md §11`).

Jump-table de 8 direcciones (file offsets, −0xA290):
`[0]0x0758 [1]0x0759 [2]0x075C [3]0x0760 [4]0x0764 [5]0x0768 [6]0x0769 [7]0x076C`.

---

## 7. Iluminación

- **Gate duro** (Look 0x0013, y el raycast DUNGEON §3 0x1AD6): `torch==0 &&
  light_spell==0` → oscuridad total (Look imprime "darkness."; el render salta todo
  el raycast). Con luz, DUNGEON raytraza **4 celdas de profundidad**
  (0x150A/0x1682/0x1952). **Ya derivado — no se re-deriva.**
- ~~**Titileo por frame**: 2×`rand(0,100)` (DUNGEON 0x111E)…~~ **[SUPERADO
  2026-07-25]**: 0x111E es el tick de ANIMACIÓN del errante (dungeon-wanderer.md
  §9, attr 0x1744, máquina 0x117A-0x120D) — ya modelado en drawMonster; y el
  «jitter de §2 paso 7» era el barajado de slots de la arena (ver arriba). No
  existe titileo cosmético de antorcha en el original.
- ~~`g_unk_52C8` (0..3) = nivel/tinte de luz usado por el gem-view (0x0730) y la
  mirada al foso.~~ **[CORREGIDO 2026-07-28, heredados-b tanda 7: es el MODO DE
  VÍDEO, no un nivel de luz.]** Dos vías, y la primera es el offset que esta misma
  línea citaba como respaldo:
  **(a)** en `0x0730` el cuerpo hace `cmp word ptr [g_unk_52c8], 3` / `jne` — una
  comparación contra **el valor único 3**, no un rango `0..3`; y lo que guarda es
  **una llamada de más al fijador de atributo**, no un tinte graduado. Ni rampa ni
  gradación.
  **(b)** el bloque que inicializa la paleta (`INTRO.OVL` `0x09ee`-`0x0a17`) está
  **guardado** por `0x09e0`-`0x09ec`, que lo salta si esa global vale 0 o 3, de modo
  que en esos dos modos valen los estáticos de `DATA.OVL` — y esos estáticos son
  1, 2 y 3, o sea los tres índices no-fondo de una paleta de cuatro colores.
  Encaja con que `set_color` enmascare con `&0xf` o `&0x3` según ella
  (`kernel-render-sweep.md:116`).
  No borro la frase original: era una lectura razonable del papel de la global en
  el render, y la corrección se sostiene sola al lado. `g_unk_58A1 & 4` = estado "sala/ciego" que cambia las tablas de
  muro (§2). Sin globals nuevos compartidos con el core más allá de los ya
  derivados (`g_torch_mins@0x58A7`, `g_light_spell_mins@0x58A6`).

---

## 8. Buffer destino y driver

DNGLOOK **compone en el buffer de tiles 0xAD14** (no pinta directo). El volcado a
píxeles va por las primitivas co-residentes (COMSUBS/kernel) que a su vez emiten
selectores al driver `lcall [0x5350]` (`drivers-drv.md §1`). Primitivas
observadas (semántica por uso; nombres exactos en COMSUBS, no leído):

| addr | args | rol inferido |
|------|------|--------------|
| 0x6816 | (x,y,x2,y2) | fijar ventana/región offscreen (sel 0x18 blit-rect) |
| 0x67E0 / 0x7A3A / 0x7C96 | (handle) | seleccionar patrón/bitmap por handle `g_unk_13bx` |
| 0x7A0E | (0/1) | flag de modo de dibujo (XOR/on-off) |
| 0x7962 | (x,y) | move-to (pen) |
| 0x69D4 | (x,y) | plot punto |
| 0x6880 | (x0,y0,x1,y1) | **línea** |
| 0x742A | (tile-id) | estampar tile/glyph en la posición actual |
| 0x7904 | (0/1/2) | seleccionar página/plano |
| 0x7E02 | (lo,hi) | **rand(lo,hi)** (confirmado: easter-egg 0xC0 + shuffle) |
| 0x75C0 | (strptr) | imprimir string (texto de Look) |
| far 0xD966 | — | presentar/flip del viewport |

**Paleta**: EGA 16 colores; el driver escribe el índice crudo como valor de plano
(`drivers-drv.md §2.5`), la LUT índice→RGB la carga el BIOS de una tabla de 17 B
kernel-side (**Clase C**, ya conocida como tal). El índice 6 = oliva #AAAA00 (task
#25, fuente única del clon). Los tiles de mazmorra usan esa misma paleta.

---

## 9. Qué queda CLASE C (→ pixel-diff / retake del usuario, task #26)

1. **Bytes de las tablas 0x2452–0x24C6 → píxel**: son tile-ids de un tileset de
   perspectiva (0x00–0x0A). Falta el **pack gráfico** de esos tiles y validar el
   mapeo id→celda por pixel-diff contra un screenshot real de pasillo.
2. **Sprites de criatura por profundidad** (0x383F/0x384D/0x385E + 0x13C2/0x173C):
   la tabla de escalado está localizada; los **bitmaps** y el pixel exacto → pack +
   diff.
3. **Glyphs del gem-map** (0x2D–0x2F, 0x70–0x77, 0x12, 0x19, 0x73): ids concretos
   (§4) pero su dibujo exacto → pack + diff.
4. **Vectores de features** (fuente 0x048E, campo mágico X 0x0284): coordenadas de
   línea exactas → extraer del asm si se quiere calcar al píxel (opcional; se puede
   aproximar con las primitivas fill/line de la piel).

El resto (arquitectura, buffer 11×11, tablas localizadas, jump-tables volcadas,
gate de luz, escalado por tabla) es **Clase A/B**: cableable con spec.

---

## 10. Spec de cableado para E1-S9

**El snapshot (CoreView) necesita** (el core ya tiene `dungeonState`):
- `floor` (0..7), `facing` (0=N,1=E,2=S,3=O), y **la rejilla de celdas visibles**
  hasta profundidad 4 delante+laterales (el raycast DUNGEON §3 ya la produce; el
  core debe exponer, por celda visible, `{hiNibble, subType, spriteId?}`).
- flags de luz: `torchOn||lightSpell` (gate), y opcional `lightLevel` (0..3 →
  `g_unk_52C8`) para el tinte.
- `blindOrRoom` (= `g_unk_58A1 & 4`) para elegir tablas de muro de sala.

**Primitivas de la piel** (ya en `frame.ts`): la piel puede (a) **componer un grid
11×11 de tiles** replicando 0x0D3E (recomendado: fiel al binario) y blitear un pack
de tiles de perspectiva, o (b) aproximar los trapecios con fill/line si el pack no
está listo. Las features/sprites van encima con blit de tile por id (§4/§5).

**A extraer** (bloqueante de fidelidad 100%, NO de un primer montaje):
- pack de tiles de perspectiva (ids 0x00–0x0A) + gem-map (§4) + sprites (§5) desde
  los gráficos del original (equivalente a los packs de E1-S3).
- opcional: coordenadas exactas de los vectores de fuente/campo (§9.4).

**Estimación de cableado S9**: **M** (media). El grid 11×11 + selección de tablas
por facing/depth + gate de luz + gem-view icónica son **directos** con esta spec
(Clase A/B). El coste real está en el **pack de tiles de perspectiva** y el
**pixel-diff** (Clase C, depende de task #26 y del catálogo AV #4). Recomendación:
montar la vista con el grid 11×11 fiel + placeholders de tile, y cerrar el pixel
con el retake del usuario.

---

## 11. LOOKOBJ — gema de overworld (confirmación)

La gema del **overworld** es `LOOKOBJ.OVL gem_view @0x10FC` (doble bucle **32×32**
del chunk, marcador parpadeante, sin RNG, sin tocar `g_gems`) — **ya pixel-exacta
en el port** (`re/notes/lookobj.md`). **Nada más que derivar ahí para la piel**: es
un renderer puro 32×32 ya cubierto; S9 sólo reusa su patrón para la gema de
mazmorra (§6, que es 8×8 e icónica, distinta).
