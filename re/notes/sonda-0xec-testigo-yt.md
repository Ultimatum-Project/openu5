# Sonda 0xEC — TESTIGO ARCHIVADO YT (aulddragon Part 20, peinado 27-07)

Carril yt-covetous sobre `aulddragon Part 20 — The Final Shard!` (descenso entero de
Covetous, 0:00–22:00). Frames-evidencia en scratchpad de sesión (no tracked, material EA).
Del repo solo se LEYÓ extractor/src/parsers/combatmap.ts y original/u5/ultima5/DUNGEON.CBT.

## RESPUESTA (lo que el acta del 27-07 dejaba abierto)

En el original DOS, entrando a la familia de la sala 1 de Covetous por pasillo normal:
**SÍ se montan grupos de enemigos aleatorios y SÍ hay botín en el cuartito oculto.**
Sala A del censo (2:15–5:15, L5, cm64, llegada por borde oeste): 6 Giant Rats + 4 Bats
en las posiciones EXACTAS del .CBT; VICTORY! a 4:48; cuartito con espada+2 bolsas+2
escudos, saqueado en vivo (2H Sword!, Spiked Shield!, sack of gold…).

## VERIFICACIÓN PÍXEL-A-BYTE (16 superposiciones, error cero, sobre re-encode 576×360)

- 6 playerStarts[west] de cm64 (2,5)(1,6)(1,4)(0,5)(0,7)(0,3) → los 6 del grupo.
- 6 unidades sprite **237** (8,1)(7,2)(4,1)(8,8)(7,9)(4,9) → **seis GIANT RATS**.
- 4 unidades sprite **236** (7,4)(7,5)(7,6)(8,5) → **cuatro BATS**, dentro del cuartito.
- `at` de los 8 triggers (6,5) → la LÁPIDA.

⇒ **236/237 NO son decoración: el original los materializa en enemigos reales, casilla a
casilla.** (En el testigo en vivo del 27-07, las 237 aparecían como FUENTES y no hubo
combate — ver §anomalía.) El elenco (Rats/Bats) es UNA instancia del roll aleatorio del
canon («Random enemy groups»): el VALOR/tabla de `ecFamilyEnemyIndex` sigue SIN derivar.

## ESTRUCTURA (leída del .CBT): la sala 1 es una FAMILIA espejada

Bloque Covetous = idx 48..63 = combatmaps 64..79. Bancos poblados por slot:
`cm64 solo west ↔ cm65 solo east` (espejo horizontal EXACTO salvo variantes de esquina
d0↔d1/d2↔d3 y antorcha b0↔b1) · `cm66 south ↔ cm67 north` · cm70/71, cm72/73, cm74/75
parejas · cm68 (E,W) · cm69 (S,N) · cm74 (4) · cm76 (E,W) · cm77 (E,W,S) · cm78 (S) · cm79 (E).
El mapa canónico del wiki `U5-Covetous-Room-01.png` corresponde byte a byte a cm65.

★ **Semántica confirmada en las 4 entradas del vídeo**: la etiqueta de dirección del
playerStarts es **EL BORDE DONDE APARECE EL GRUPO** (viajando al este apareces por el
borde oeste y se usa el slot `west`). Coherente con P0a del port (opposite-of-facing).

⇒ **LA PREMISA «BANCO DEGENERADO» SE DISUELVE**: el (0,0)×6 de cm65[west] no es una
entrada rota — es el slot que cm65 NUNCA usa (las llegadas por el oeste las sirve cm64).
La entrada del testigo en vivo (andando al oeste ⇒ borde ESTE de cm65) usaba un banco
POBLADO.

## Censo de salas del vídeo

| sala | t | nivel | cm | borde llegada | ¿combate? | ¿botín? |
|---|---|---|---|---|---|---|
| A | 2:15–5:15 | L5 | 64 | oeste | SÍ → VICTORY 4:48 | SÍ (cuartito) |
| B | 5:38–8:55 | L5 | 67 | norte | SÍ (slimes, ghost) | poción, llave, antorchas, comida |
| C | 9:35–15:40 | L6 | 76 | oeste | SÍ (dragones, reapers, ghosts) | ballesta, escudo, oro, llaves, pergamino |
| D | 15:44–16:42 | L6 | 77 | oeste | SÍ (dragones) | BATTLE IS LOST 16:42 |

Las 4 entradas por pasillo normal ⇒ 4/4 con combate.

## El cuartito y el trigger (hallazgo con pregunta nueva)

Se abre a las 2:21, ~2 turnos tras entrar, **por un IMPACTO A DISTANCIA** (proyectil de
Magic Axe aterrizando en la casilla de la lápida (6,5)): nadie la empujó ni la pisó. Al
fotograma siguiente, exactamente lo que declaran los 8 triggers de cm64 (5× sprite 68
suelo sobre el bloque + 3× sprite 79 muro en x=10). ⇒ el disparador NO es solo Push:
queda ABIERTO si es «casilla recibe ataque», «unidad ocupa casilla» o «lápida destruida»
— revisar qué modela Combat.fireTriggers (COMBAT 0x111A) para impactos a distancia.

## ANOMALÍA VIVA (lo que este testigo NO cierra)

El testigo en vivo del 27-07 (sala r1/cm65, save virgen, entrada andando al oeste POR EL
WRAP TOROIDAL del grid 8×8 desde (0,2) a (7,2) de la planta 0) vio: SIN combate, 237
como fuentes, cuartito vacío. Con la premisa del banco disuelta, la hipótesis viva pasa a:
**la entrada por WRAP toroidal se salta la inicialización** (las 4 entradas con combate
del vídeo fueron por pasillo normal). Experimento discriminante: tarjeta
`sonda-0xec-experimento-entrada.md` (REVISADA con brazo W).

## Límites declarados

1. cm65 NO se juega en el vídeo (que la llegada por el oeste la sirva cm64 es derivación
   del .CBT, no observación).
2. El disparador exacto del trigger queda abierto (solo se vio la vía impacto-a-distancia).
3. alexdiener E23/E24 sin mirar (segunda instancia disponible si hace falta).
