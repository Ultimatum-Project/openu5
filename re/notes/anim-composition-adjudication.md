# Composición fn32 (píxel-mask DRV) × bytecode 0x4552 — adjudicación por familia

Encargo del lead tras el hallazgo del píxel-swap fn32 (ver `flag-fire-anim-runtime.md`).
Decide, por familia, qué mecanismo produce el titileo visible y qué puede entrar en
`ENABLED_PROGRAM_BASES` del intérprete del port (#46) sin morphing. Medido por oráculo
(loc 0x11, un pueblo; atlas_seg=0x8CA2) + comparación de shapes en `tiles-ega.png`.

## Los DOS sistemas (independientes)

- **A) Bytecode `0x4552`** (por-actor, tabla `0x5c5a`): SELECCIONA qué tile-id se muestra
  (`[bx+1]`), ciclando `base..base+3` según el programa. **Solo corre para tiles registrados
  como ACTORES.** Escribe un id, NO toca píxeles.
- **B) `fn32` del EGA.DRV** (@0x1f98, cada pasada del animador vía `0x6fd6`): MUTA los BYTES
  del bitmap del tile EN EL ATLAS. Dos submodos: *scramble* RNG-local (llama, tiles ~0x1e8 y
  0xb0-b3/0xde) y *swap de filas* (banderas 0x12/0x14/0x15, gallardete LB 0x3e). Corre GLOBAL
  sobre el atlas, **da igual si el tile está en pantalla o es actor**.

## Q1 — ¿el titileo del fuego es A, B, o ambos? → **B en la práctica; A+B solo si es actor**

Log SIMULTÁNEO (por pasada: id elegido por bytecode + hash del bitmap vivo de ESE id), con
actores de fuego **sembrados** (el pueblo no tenía ninguno natural):
- torch 0xb0 (p3): bytecode cicló 0xb0,0xb1,0xb3; y CADA id mutó su bitmap (id 0xb0 mostrado
  4× → **4 bitmaps distintos**; 0xb1 → 2). ⇒ las dos capas se superponen SI el tile es actor.
- hoguera 0xdc (p7): bytecode cicló 0xdd,0xde,0xdf; solo 0xde muta su bitmap (3 distintos) —
  coincide con el set fn32 (0xde sí, 0xdd/0xdf no).

**PERO la tabla de actores natural del pueblo NO tenía ningún tile de fuego ni de castillo**
(`bases: 0x1c 0x1e 0x48 0x50 0x54` — fuego/castillo: NINGUNO). La capa A que medí fue
**forzada por mi sembrado**. ⇒ en el juego real, el fuego se coloca como TILE ESTÁTICO de mapa
y su titileo lo produce **solo la capa B (fn32 scramble)** sobre el bitmap compartido del atlas.
Eso casa con "el vídeo muestra montaje constante": el objeto no cambia de id, solo se
scramblean los píxeles de su llama.

## Q2 — ¿0xb0-b3 son 4 POSES o 4 OBJETOS? → **objetos distintos; NO ciclar**

La similitud estática de shapes NO decide (actores NPC legítimos —0x48/0x54, que el juego SÍ
cicla— también bajan a 40-50%). Decide el runtime + semántica:
- Fuego (0xb0-b3, 0xdc) **no es actor** (Q1) ⇒ no se cicla; su animación es fn32 scramble.
- `TileData` los nombra objetos distintos (RightSconce/LeftSconce/…) y el píxel-diff del lead
  da b2≠b3; `0xdc` vs `0xdd` = 0% similar (0xdc = base "apagada", 0xdd-df = llama).
- **Fuente 0xd8-db = 85% similares entre sí = 4 POSES reales** de un objeto, y anima por el
  **reloj maestro** (`0x44b8`, remap 0xd8-db), atlas estático. Ciclo seguro.

⇒ **`ENABLED_PROGRAM_BASES`: NO metas fuego (0xb0/0xdc/0x70/0x8c/0x98) por ciclo de tile-id**
(morfea entre objetos distintos). Modela el fuego como **fn32 scramble** (ruido RNG-local en el
bitmap del tile colocado) o, si es caro, un parpadeo sutil de 2 frames. La **fuente 0xd8** sí es
un ciclo de 4 poses seguro (de hecho ya la cubre el reloj maestro).

## Q3 — ¿castillo de LB 0x3e = bytecode + fn32, o solo fn32? → **solo fn32 (swap del gallardete)**

`0x3a-0x3f` son **6 tiles DISTINTOS de un mosaico** (33-43% similares entre sí = partes de la
imagen del castillo, no frames). Ciclarlos rompe el castillo. `fn32` ondea **solo 0x3e** (el tile
del gallardete) por swap de filas (bit3 del seed local). El `prog0` que `0x1bc8` asigna a
0x38/0x3c es un **default que NO corre** (el castillo de LB es estructura estática, no actor —
igual que las banderas de 1 tile). ⇒ en el port: castillo LB = mosaico estático + **swap fn32 en
0x3e** (mismo mecanismo que las banderas 0x12/0x15). NO habilitar prog0 para 0x38/0x3c.

## Tabla mecanismo-por-familia (resumen accionable)

| familia | tiles | mecanismo REAL | ¿ciclar id? | port |
|---|---|---|---|---|
| bandera estructura | 0x12/0x14/0x15 | B swap filas | no | swap filas (#47) |
| aldea/faro | 0x13, 0x1b | ninguno | no | estáticos |
| **fuente** | 0xd8-db | reloj maestro (4 poses) | **SÍ (seguro)** | ciclo / remap |
| antorcha/sconce/brasero | 0xb0-b3 | **B scramble** (no actor) | **NO (morfea)** | scramble fn32 |
| hoguera | 0xdc + 0xdd-df | B scramble en 0xde (+blit especial 0x1112) | NO | scramble fn32 |
| castillo LB | 0x3a-3f + 0x3e | B swap en 0x3e | NO | mosaico + swap 0x3e |
| agua/olas | 0x01-03, 0xd4-d7, 0xec-ef | reloj maestro (remap) | ya portado | — |
| criaturas/NPC | 0x134+ y actores (0x48…) | A bytecode (poses reales) | sí | ya via actores |

## Residual (para cerrar al 100%, carril #46)
- Confirmar en un INTERIOR con antorchas (castillo/posada) que el fuego nunca se registra como
  actor en `0x5c5a` (mi evidencia es un pueblo). Si en algún mapa SÍ fuera actor, entonces ahí
  se sumaría el ciclo A — pero seguiría morfeando salvo que esos 4 ids sean poses, que no lo son.
- Confirmar que el castillo de LB no es actor en el overworld de Britannia (dump de `0x5c5a` allí).
Ambos exigen navegación; los dejo señalados. La recomendación de arriba es robusta sin ellos.

Scripts (fuera del repo): `scratchpad/compose.py`, `atlas_map.py`, `bp_seq.py`.
