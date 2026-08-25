# Acta #256 — las TRES omisiones de visibilidad, adjudicadas juntas

Derivación del 2026-08-16 sobre `re/disasm/ULTIMA.EXE.asm` (cuerpos leídos: `0x5910`
redibujo, `0x5A28` flood, `0x5D0A` pase de la party, `0x5E4A` barrido de emisores).
Sujeto: el binario. Las tres omisiones que el docblock de `game/src/core/world/visibility.ts`
declaraba comparten el buffer `0xAD14`, y por eso se decidieron en una sola tanda.

## §0 — EL SUJETO DE `0xAD14`: la contradicción se DISUELVE, no se resuelve a favor de uno

La ficha llegó ampliada con una contradicción de sujeto que hay que adjudicar **antes** de
creerse nada de lo de abajo: esta ficha llama a `0xAD14` «el buffer de luces» y
`get_tile_ptr` (kernel `0x4402`) lo indexa como buffer de **TILES**. Las dos lecturas son
CIERTAS, y no compiten: son **dos dueños exclusivos por FASE**, con el mismo discriminante
—`g_location` contra `0x7f`/`0x80`— comprobado en tres sitios que he leído:

| cita | comprobación | qué hace |
|---|---|---|
| `4408` | `cmp byte ptr [g_location], 0x7f` · `jbe 0x4420` | régimen ALTO (`> 0x7f`): `440f-441c` calcula `(fila<<5) + col + 0xad14` ⇒ `0xAD14` **es el mapa**. Régimen bajo: se va a la ruta de chunk/mapa pequeño y no lo toca |
| `5947` | `cmp byte ptr [g_location], 0x80` · `jae 0x5954` | en régimen ALTO **se salta el barrido de emisores** (`594e call 0x475a`) ⇒ nadie escribe luces en `0xAD14` |
| `5954` | `cmp byte ptr [g_location], 0x80` · `jb 0x595e` | en régimen ALTO salta a `59f8`, que copia **0x160 = 352 bytes** de `0xAD14` a `0xAB02` (= 11 filas × 32 de zancada: la ventana, verbatim). Sólo si es BAJO se llega a `595e`, y de ahí a `5987 call 0x5D0A` |

**La consecuencia para esta ficha, que es lo que había que adjudicar:** el pase de la party
—y por tanto el PUENTE de `5c05-5c45`— **sólo es alcanzable con `g_location < 0x80`**,
porque su único llamador (`0x5D0A`) cuelga de la rama `jb` de `5954`. En toda fase en la que
el puente se ejecuta, `0xAD14` **es** el buffer de luces. La premisa de la ficha SE
SOSTIENE y el calco de §1 no cambia.

★ Y la lección que deja, que es más ancha que esta ficha: dos lecturas de la MISMA dirección
no se refutan la una a la otra mientras exista un **discriminante** que las separe. Antes de
declarar una errata, búscalo — aquí estaba a la vista en tres comparaciones del mismo byte, y
el docblock de `visibility.ts` ya lo tenía escrito desde #219 («dos dueños EXCLUYENTES POR
FASE»). Lo que faltaba no era el dato sino **comprobar que la rama del puente cae del lado
bueno del discriminante**, que es lo que se mide arriba.

## §1 — El PUENTE (5c05-5c45): mecánica, CALCADA

`0x5A28` en modo party clasifica cada vecino en tres ramas, en este orden:

| condición | cita | resultado |
|---|---|---|
| radial ≤ light (umbral light+1 por el `inc` de 5a66) | `5bd9 cmp ax,[bp+0x10]` | visible; propaga si transparente |
| fuera del radio, OPACA | `5c52-5c91`, decide en `5c8c` | visible ⟺ la PROPIA celda está en `0xAD14`; si no, `5c74` escribe 0 = oculta |
| fuera del radio, TRANSPARENTE | `5c05-5c45` | visible ⟺ el PADRE es visible (`5c14`) **Y el PADRE está en `0xAD14`** (`5c29`) **Y la PROPIA está en `0xAD14`** (`5c40`) |

La tercera rama es el PUENTE. Si falla cualquiera de sus tres condiciones, `5c47` escribe
`0xFF`, que es el centinela de **NO DECIDIDA**, no de oculta: sólo `5c74` (0) y `5c93` (el
tile) deciden, así que la celda puede volver a intentarse desde OTRO vecino. Modelar eso
exige TRES estados; con dos, la primera visita fallida la cierra para siempre.

**Consecuencia semántica** (la que hay que tener en la cabeza al mirar una captura): el
halo de una antorcha sólo extiende la visión de la party si TOCA su propio disco — la
cadena de puentes tiene que arrancar de una celda que esté a la vez dentro del radio y en
`0xAD14`. Una sala iluminada al fondo de un pasillo oscuro no se ve hasta acercarse.

**Asimetría que conviene no perder**: la rama OPACA *no* mira al padre. Un muro fuera del
radio se ve con sólo estar él en el buffer. Es el único observable que aísla el alcance
del emisor del puente, y por eso la sonda de `EMITTER_REACH` usa un muro.

## §2 — La ESCRITURA DE VUELTA (a) y el PROTOCOLO DE DOS RAMAS (b): defecto, NO calcado

- El pase de LUCES (modo 0) usa `g_vis_buffer` (`0xAB02`) como marca de visitados y lo
  pone a CERO celda a celda: `5b89 mov byte ptr [bx+di-0x54fe], 0`. Su índice es
  `(fila<<5)+col` en coordenadas LOCALES del marco del emisor — **sin** el origen, que
  sí llevan las escrituras al destino (`5b48-5b5c`). Dos convenciones de índice distintas
  dentro de la misma rutina.
- El llamador re-siembra las 121 celdas a `0xFF` **antes de cada emisor**
  (`5f23-5f3d`, dentro del bucle `5efe..5f63`) ⇒ sólo sobreviven los ceros del ÚLTIMO.
- `0x5910` reparte por `g_unk_24e6` (`595e`): RECÁLCULO (`5987 → 0x5D0A`) o INCREMENTAL
  (`5992-59f4`), que recorre las 121 y reescribe con terreno crudo **sólo las que valen
  CERO** (`59ad`).

★ **La pieza que cierra la adjudicación**, y que no estaba escrita en ningún sitio: tras
el flood, `0x5D0A` recorre las 121 y convierte los CEROS en `0xFF`
(`5d76-5d8a: cmp byte ptr [si],0 ; jne ; dec byte ptr [si]`). Después de un recálculo
**no queda ni un cero** en `g_vis_buffer` ⇒ el `== 0` de la rama incremental no puede
casar con nada escrito por el pase de la party: **la única fuente de ceros del sistema es
`5b89`**. Un fotograma incremental repinta con terreno crudo exactamente la huella de
visitados del último emisor, y como esa huella está en coordenadas locales, cae **sobre la
ventana de la party** aunque el emisor esté en la otra punta del chunk.

**Alcanzabilidad** (lo que faltaba para poder decidir): la rama incremental no es un caso
raro. `0x10d0` llama a `0x5910` **32 veces por invocación** — bucle `0x1070`, `test di,7`
cada 8 vueltas del driver de sonido — sin ningún evento de juego en medio, y `g_unk_24e6`
se pone a 0 en el primer recálculo (`598a`): 31 de esas 32 pasadas van por la incremental.

**Decisión: NO se calca.** No es mecánica que al port le falte, es un defecto del original
(buffer de trabajo compartido con dos convenciones de índice), y reproducirlo costaría
estado mutable entre fotogramas en un módulo hoy puro más el reparto por `g_unk_24e6`,
para obtener un parpadeo de terreno mal colocado. Va al registro de bugs del original,
según la directriz del 05-08 (los bugs claros del original se arreglan y se registran).

## §3 — Cifras del calco (sonda sobre mapas reales)

Modelo de referencia = `game/tests/visibility-original-referencia.model.ts` (transcripción
de `0x5A28` con tablas propias, no importadas del port). Escenas: `smallmaps.json` de
Blackthorn (loc 18, z=−1), sótano de Lord British (loc 17, z=−1) y Cove (loc 23, z=0),
las 1024 posiciones de party de cada mapa × los cinco regímenes de luz (2 · 5 · 10 · 18 · 50).
«sobre» = celdas que el port revela y el original no; «sub» = al revés.

| escena | régimen | sobre ANTES | sobre DESPUÉS | sub (antes y después) |
|---|---|---|---|---|
| Blackthorn z=−1 | los 5 | 0 | 0 | 0 |
| LB z=−1 | 2 / 5 / 10 / 18 / 50 | 1649 / 868 / 438 / 109 / 0 | 0 en los cinco | 0 |
| Cove z=0 | 2 / 5 / 10 / 18 / 50 | 1086 / 932 / 621 / 261 / 0 | 0 en los cinco | 0 |

De día (radio 50) la ventana entera cae dentro del disco y el puente no se ejecuta nunca:
por eso las dos versiones ya coincidían. El defecto vivía en los regímenes oscuros, en
**46-70 de las 1024 posiciones** de cada mapa, y donde pegaba pegaba fuerte: el peor caso
es el sótano de LB con la party en (22,24) y luz 2 — **11 casillas visibles en el original,
65 en el port**.

## §4 — Mutantes (sobre base commiteada)

| mutante | qué se rompe | resultado |
|---|---|---|
| M1 | quitar `padreEnBuffer &&` del puente (la regla anterior a #256) | ROJO |
| M2 | colapsar NO-DECIDIDA y OCULTA en dos estados (perder el reintento de `5c47`) | ROJO — **551 celdas en 82 posiciones** de la sala de §3, cifra del test |
| M3 | exigir el padre TAMBIÉN en la rama opaca | ROJO |
| M4 | volver al orden de vecinos NO-perímetro | VERDE — control NEGATIVO de la independencia de orden |

🔴 LA CIFRA DE M2 CAMBIÓ DE 472 A 551, y conviene saber por qué antes de citarla. El 472
salió de una sonda de scratchpad que **reimplementaba** el barrido de emisores para poder
mutar el flood del port; el 551 lo mide el test contra el MODELO TRANSCRITO, sobre la misma
escena y las mismas posiciones que el bloque de igualdad, y es el que vive en el árbol
(`visibility-original-referencia.test.ts`). Las 82 posiciones coinciden en las dos medidas —
lo que cambió es el conteo de celdas, no el fenómeno. ★ Una cifra medida sobre una copia
del sujeto no es la cifra del sujeto: la que se cita es la que un test puede volver a sacar.

M4 es el que respalda la afirmación «el conjunto alcanzable no depende del orden del
anillo» que el código declara: si enrojeciera, la afirmación sería falsa.

## §5 — Lo que este acta NO acredita

El modelo de referencia es una TRANSCRIPCIÓN del desensamblado, no un testigo de DOSBox.
Que el port coincida con él celda a celda acredita fidelidad **al ASM leído**, no una
observación del juego corriendo. El calco reduce visiblemente lo que el jugador ve en
interiores oscuros (ver §3), así que si alguna captura del usuario contradice esta
semántica, lo que hay que re-mirar es la transcripción — hay un testigo de oráculo
pendiente y declarado como tal: **ficha #350**, abierta por el lead el 16-08 al tomar la
decisión de aterrizar — la pregunta que tiene que contestar es exactamente «¿el halo de una
antorcha sólo extiende la visión si TOCA el disco de la party?».
