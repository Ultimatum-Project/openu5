# Decoración procedural del pasillo 3D (careo decor-mazmorra, 2026-07-25)

Derivación del paquete «decoración 3D de mazmorra»: careo visual wf_8648a9bf
(frames curados en `original/av-referencia/decor-mazmorra/`, gitignored) +
re-disasm instrucción a instrucción de DUNGEON.OVL (ndisasm sobre el overlay
crudo; offsets FILE = los citados). Implementado en
`game/src/skin/fiel/dungeon-decor.ts` + ops de plan en `dungeon.ts`.

## 1. Arte estático: las estalactitas/charcos van HORNEADOS en las rodajas 0xC

Los muros especiales (nibble 0xC) usan las rodajas de ALCOBA (laterales 20-23,
`sideBase` 0xC→0x14) y FRONTAL especial (25-27, `frontBase` 0xC→0x18) de
DNG*.16 — ya cableado y correcto. Por variante: DNG1 = estalactita + charco,
DNG2 = derrumbe, DNG3 = esqueleto encadenado. Densidad 0xC: Despise 104 celdas
(~20% del mapa), Destard 81, **Doom 0** (allí jamás se ven).

## 2. Lo VIVO: máquina de la gota `0x145c(prof, estado, y, x)`

- `estado==5` (0x145f-0x1486): sin dibujo; SFX `call 0xc1de(0xc80, 0xdac, 1,
  0x14−8·prof)` y **reset INCONDICIONAL a 0**.
- estados 0-4 (0x14aa-0x14ce): cruz 3×3 — hline `0x8acc(x−1,y,x+1)` + vline
  `0x8b22(x,y−1,y+1)` — color `[0x13b2]` (DATA.OVL DS:0x13b2 = **1**, azul).
  Estado 4 (0x148a-0x14a4): color 3 si `[0x52c8]∈{0,3}` (CGA/Tandy), si no
  **0xB cian brillante** (EGA: `52c8∈{1,2}`, re/notes/intro.md + kernel-sweep-4
  `select_video_params` 0x0e94).
- estados 0-3 (0x14d1-0x14e7): píxel central `0x8a94(x,y)` color `[0x13b2]+8`=9.
  El splash (4) NO lleva centro.
- avance (0x14ea-0x14ff): **el `rand(0,64)<4` (0x9ec2) gatea SOLO el estado 0**
  (`cmp [bp+6],0 / jnz inc`); estados 1-4 incrementan CADA redibujo. (La nota
  del careo original «avance rand por redibujo» era imprecisa — la gota cuelga
  en 0, la caída es un estado por frame.)
- Persistencia: el original escribe el estado en los **3 bits bajos del tile**
  del mapa vivo (write-back 0x15aa-0x15d4 frontal / 0x1738-0x1762 lateral,
  buffer 0x595a). El port lo guarda en la PIEL (Map `floor:x:y`); RNG de render
  = divergencia sancionada clase monster-anim (dungeon.md §12.11).

## 3. Disparos (variante 1 = DNG1, tile&0xf0 == 0xC0)

- **Frontal** (`fn_150a` @0x155f-0x15d6, tras el par de blits del muro):
  prof∈{1,2} ∧ `[0x6604]==1` ∧ 0xC0. X=0x5f=95;
  Y=`[0x2e8b + prof·5 + estado] + 14` (DATA.OVL DS+0x10):
  prof1=[54,61,80,114,160], prof2=[60,64,76,96,123]. Verificación empírica:
  el LP a 10 fps (`drip-montage-10fps.png`) mide y={54,62,80,114} + splash
  156-164 = la tabla prof1.
- **Lateral** (`fn_1682` @0x16d7-0x1764, dentro del case 0xC0 del switch):
  prof∈{0,1} (corta en `prof≥2` @0x16d7). X: prof0=0x21=33, prof1=0x43=67;
  lado derecho espejado `X=0xBE−X` (@0x170a) → 157/123.
  Y=`[0x2e9a + prof·5 + estado] + 14`: prof0=[28,37,64,112,173],
  prof1=[54,59,74,98,133].

## 4. Destello del esqueleto (DNG3, `fn_150a` @0x15fa-0x165c)

`[0x6604]==3` ∧ 0xC0 frontal ∧ prof==1 ∧ rand(0,64)<4 → 4 hlines color
`[0x13ae]+8` = 2+8 = **10 (verde brillante)** en (92-93,87), (91-93,88),
(97-98,87), (97-99,88). Transitorio (un redibujo), sin estado persistido.

## 5. Colores del subsistema procedural (DATA.OVL, DS+0x10)

`DS:0x13ae=2, 0x13b2=1, 0x13b4=1, 0x13b6=2` — son COLORES (no handles), la
paleta compartida de 0x145c (gota), 0x127e (chispas de campo mágico, selector
por sub 0-3 @0x1292) y fn_1786 (chorro de fuente). Corrige dungeon3d-audit
§8b.4 (que los tenía por handle de banco de sprites).

## 6. TICKETS anotados (fuera de este paquete)

1. **Inscripciones de muro** `0x104c` (fn_150a @0x15df-0x15f5): muros 0xB con
   nibble≠0 a prof 1 → texto por tablas per-location 0x2dc7/0x2dcf/0x2e10
   (frame testigo `p19-inscripcion-runica-muro.png`).
2. **Chorro procedural de la fuente** `fn_1786` @0x1786: ~8 gotas por tablas
   0x2ea4/0x2ed4/0x2ef2/0x2f0a (pares x,y), píxeles 0x8a94 con [0x13b2]/+8,
   reloj [0x2f26] 0→1→2→0 por redibujo. (Barato tras §5 — sin sprites.)
3. **SFX de la gota**: cue `0xc1de(0xc80, 0xdac, 1, 0x14−8·prof)` en el reset
   del estado 5 — exige derivar la primitiva del thunk 0xc1de y un SfxId nuevo
   en el catálogo (core/sfx.ts + speaker.ts). Hook comentado en
   `DungeonDecorState.stepDrip`.
4. **Campo mágico 3D** (kind 8): subsistema de chispas `0x127e` (rand por
   tablas 0x2e42-0x2e5a, colores §5 +8) — el port mantiene la primitiva.
