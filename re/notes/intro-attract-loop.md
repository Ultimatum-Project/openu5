# El bucle de ATTRACT/título de INTRO.OVL — derivación (0x0aa1–0x0c97)

Derivado desensamblando INTRO.OVL con `re/tools/disasm.py` (capstone 16-bit, code_offset=0;
binario en `original/u5/ultima5/INTRO.OVL`). Cierra qué hace el "demo autónomo" del título y
REFUTA dos hipótesis previas sobre el attract.

## TL;DR

El attract de INTRO.OVL = **componer el logo del título + caminar 4 FIGURAS sobre él → menú**.
NO hay habitación, NO hay moongate, NO hay llamada a FONT.OVL en el bucle. La habitación
top-down + moongate que se ve en `video-P` f61–87 (rótulo "The Summoning") es OTRO mecanismo
(el scene-engine de FONT.OVL, mismo que las 21 escenas del ítem G), no el attract de BRITISH.PTH.

## BRITISH.PTH = 4 rutas de figuras (no scripts ni tile-map) — prueba dura

Histograma de los 2783 bytes de `original/u5/ultima5/BRITISH.PTH`: 4 valores dominan —
`0x10`(Δ=abajo), `0x90`(arriba), `0x01`(derecha), `0x09`(izquierda) = los 4 pasos cardinales
de 1 casilla del codec `path_walk_anim` — y hay **sólo 4 bytes `0x00`** (terminadores de ruta).
⇒ 4 rutas de figuras andantes, confirmando `extractor/src/parsers/pth.ts`. NO es un tile-map
(sería un espectro de tile-ids) ni scripts de escena.

## El bucle (INTRO.OVL 0x0aa1–0x0c97, offsets citados)

| offset | instrucción | qué hace |
|---|---|---|
| 0x0bd4 | `call 0x8e84` | blit del logo del título (TITLE.BIT) |
| 0x0bde | `call 0x8dae` | blit-flip (compone BRITISH.BIT sobre el título) |
| 0x0be1 | `push 0x14; call 0x94e` | espera tecla **20 ticks** (`read_key_timed`). Con tecla → sale al menú (0x0c49) |
| 0x0bfc | `mov [0xbb18], 0` | resetea el cursor de ruta (0x55A6[0xbb18++]) |
| 0x0c07–0x0c3f | 4× `call 0x50` | `path_walk_anim` para las 4 figuras, con starts empujados antes de cada call |
| 0x0c42 | `push 1; call 0x8a62` | flip de página |
| 0x0c49–0x0c7d | `call 0x8e84/0x8dae` ×2 | recompone regiones (restaura lo que pisaron las figuras / marco) |
| 0x0c97–0xca0 | `call 0x8e1c` ×2 | dispone los sprites cargados (TITLE.BIT, BRITISH.BIT) |
| 0x0ca3 | `mov byte [0x5893], 0x40` | `g_location=0x40` → transición al menú |

### `path_walk_anim` (0x0050) — codec confirmado
- `[bp-4]=0x55a6` (buffer de rutas); cursor `[0xbb18]`.
- `[0x5356]` se fija a **0x113** (=275) = el TILE del sprite de la figura; se blitea con `call 0x8aa4`.
- Por byte `b` de ruta: `Δx=b&7` (neg si `b&8`), `Δy=(b>>4)&7` (neg si `b&0x80`); `b==0` termina.
- Cada llamada aborta si hay tecla (poll); las 4 comparten el cursor `[0xbb18]` avanzando ruta a ruta.

### Tile `0x113` — CONFIRMADO como jinete, y la reconciliación con el witness (2026-07-16)
La lectura del predecesor es **CORRECTA, no un misread**: `[0x5356]` es el global "tile a
blitear", y `path_walk_anim` lo fija a `0x113` en `006d: mov word [0x5356],0x113` (guarda el
previo en `[bp-2]` en `0067` y lo restaura en `0101/0140`); el título hace lo mismo en
`0d6d`. Es un TILE del tileset de juego: **`0x113`=275=`RidingHorseLeft`** (TileData.json) =
una figura **A CABALLO** (jinete), no un peatón. Así que el attract-de-TÍTULO del asm SÍ son
jinetes.

**PERO** el witness `video-P` — lo que el usuario VE y a lo que reacciona — NO muestra esos
jinetes: el TÍTULO va **ESTÁTICO** (f048 = logo gótico + subtítulo de fuego, CERO figuras) y
el "demo de la caja" (f061–f093) muestra el cuarto top-down con **~1 figura PERSONA a pie**
(f082), no un jinete sobre el logo. El cuarto-demo es una **vista/DEMO del motor de juego**
(return-to-view, ver `intro-summoning-scene-engine.md §5`), un mecanismo DISTINTO del
attract-de-título-con-jinetes de INTRO 0x0aa1. Es decir: el asm 0x113 y el witness son **dos
presentaciones distintas** — el jinete-sobre-el-título es código real de INTRO **no ejercitado
en la captura video-P** (por qué el título queda estático ahí = abierto; quizá un idle más
largo o config de DOSBox lo dispara).

**Decisión del port (task #19, reporte "dos caballos dando vueltas"):** el clon calca el
WITNESS, no el path-de-jinetes no visto — figura **PERSONA** (`284`=BasicAvatar, el Avatar
summoned) caminando por el cuarto, título estático, sin jinetes. Las RUTAS BRITISH.PTH
(dato firme, `british-path.json`) se conservan; sólo cambia sprite+coreografía para casar
f048/f082. El `0x113`-jinete queda documentado aquí como el sprite del attract-de-título del
asm (real pero no-witnessed), para que esta nota quede coherente.

### Posiciones de arranque de las 4 figuras (pushes en 0x0c07–0x0c3b)
`(0x2c,0x44) (0x40,0x5e) (0x8f,0x4e) (0xa7,0x69)` = con el mapeo del parser (x = 2º push, y = 1º):
figuras en **x=68/94/78/105, y=44/64/78/105**. **OJO:** las figuras 0 y 1 arrancan en y44/y64 =
sobre el LOGO gótico (no dentro de una caja). Detalle a validar contra el vídeo.
(Confirmado contra `video-P`: el título va ESTÁTICO en la captura ⇒ estas rutas-sobre-el-título
no se pintan en el port; sólo las de la caja, y como PERSONA — ver subsección de tile 0x113.)

## Implicaciones (adjudicadas con el team-lead)

1. El painter de 4 tiras `0x0010` (subimg 1–4 @Y=0/50/100/150 vía `0x8b8c`) que se sospechaba
   pintaba la habitación **no lo llama el attract** — lo llaman 0x0636/0x093c/0x0fdc (otras
   pantallas). Es la composición de la portada de esas pantallas, no el demo.
2. La habitación+moongate del usuario ⇒ **derivar la escena de attract de FONT.OVL** (ver
   `intro-scene-tables.md`, engine `load_scene 0x0418`/`scene_tick 0x02fc`): ¿escena extra del
   set de la Summoning? ¿tabla/modo de attract aparte? Fondo = lámina `.16` o composición de
   tiles (ambos extraíbles).
3. El attract real es probablemente un **CICLO** (título+figuras → demo habitación → menú/vuelta);
   el orden/duraciones se derivan del propio `video-P`. Las 4 figuras son SU fase del ciclo, no un
   overlay sobre el layout actual.
