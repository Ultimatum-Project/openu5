# #103 (Hythloth r7 / cm103) — RESUELTO EN ESTÁTICO: son DRAGONES MÓVILES. Ni victoria fabricada, ni paradoja

**La pregunta del lead**: «con la tabla fiel no queda NINGÚN mecanismo conocido por el que esa
sala se gane. Y se gana.» Sus tres opciones: (1) el port sigue disparando a través de `0x42`;
(2) el censo de movilidad se equivoca; (3) un mecanismo no enumerado.

**Respuesta: la (2), y con el propio dato del censo contradiciéndolo. La (1) está muerta.**

## Opción 1 — MUERTA, verificada en el código QUE CORRIÓ (no «la guarda dice»)

En `.claude/worktrees/landing/game` (el worktree del resello):

- `src/core/combat/combat.ts` → `isRangedPathClear` consulta **`blocksSpellLine(t)`**. El fix está
  presente en el código que corrió.
- Y el valor, no sólo el cableado: evaluando `LOS_OPACITY_BITMAP` de `areaSpellTables.ts` sobre
  los 256 tiles → **46 opacos / 210 transparentes** (casa con la derivación), y
  **`0x42` BLOQUEA**. (De paso: `0xff` ATRAVIESA — confirma mi lectura de `0x3FB4`; `0x46` bloquea;
  los 16 `ShadowlordBoundary` `0x70-0x7f` bloquean.)
- Único bypass del raycast en `canReach` es `isPolearm(weaponId)` →
  `POLEARM_WEAPONS = {0x19 Morning Star, 0x22 Halberd}`. **ch26 equipa `0x24` (Magic Bow)** ⇒ no aplica.

⇒ **El port no puede disparar a través de `0x42`.** La victoria no vino de ahí.

## La geometría: la caja es real (mi derivación acertaba en eso)

`combatmaps.json` **posición 103** (campo `index`=87 — la trampa de índice de siempre):

```
      0   1   2   3   4   5   6   7   8   9  10
y3   4d  4d   5  42  42  42  42  42   5  4d  4d
y4    5   5   5  42  40  40  40  42   5   5   5
y5    5   5   5  42  40  40  40  42   5   5   5
y6    5   5   5  42  40  40  40  42   5   5   5
y7   4d  4d   5  42  42  42  42  42   5  4d  4d
```

Caja CERRADA de `0x42` con interior `0x40`. `TileData`: `0x42 WoodFloorShipTie
IsWalking_Passable=false`, `0x40 WoodFloor1 =true`. Los `playerStarts` de los 4 grupos están
todos FUERA. Así que: la party **ni dispara dentro** (`0x42` opaco) **ni entra andando**
(`0x42` impasable). Hasta aquí, mi lectura era correcta.

## Lo que el modelo estático NO miró: QUIÉN está dentro

`units` de la posición 103 — **6 registros, pero 5 enemigos**:

| sprite | celdas |
|---|---|
| `1` | (5,5) — **NO es enemigo**: la conversión es `tile = 64 + i*4` (i∈0..47) ⇒ rango 64..252. El 1 (Water1) queda fuera del filtro. **Mi «6/6 enemigos» contaba uno de más.** |
| `220` ×5 | (4,4) (6,4) (6,5) (4,6) (5,6) |

`220 → i = (220−64)/4 = 39`. Y el dato de `data.json` + `AdditionalEnemyFlags[39]`:

```
name: Dragon1/DRAGONS      stats: [str30, dex25, int25, arm10, dmg30, hp99, max2, tr30]
attackRange: 9             DoNotMove: FALSE          ActivelyAttacks: TRUE
CanFlyOverWater: true      CanPassThroughWalls: false
```

<!-- [MOVILIDAD t#27, 07-27 — re/notes/redux-flags-movilidad-barrido.md] Del volcado de arriba, dos
campos NO describen al port: `CanPassThroughWalls` y `ActivelyAttacks` son CÓDIGO MUERTO (asignados
en enemies.ts, leídos por nadie). El `CanPassThroughWalls: false` del Dragón no lo distingue de
nada — en el port NINGÚN enemigo cruza muros. `DoNotMove` y `CanFlyOverWater` SÍ están cableados, y
son justamente los que sostienen el veredicto de esta nota, que queda INTACTO. -->

**Son DRAGONES: móviles, agresivos y con alcance 9.** El campo `DoNotMove` del propio censo dice
`false`. ⇒ **la clasificación «estático» de #103 es falsa, y el dato que la desmiente estaba en la
tabla que el censo ya usa.** No hace falta ningún mecanismo nuevo: el mecanismo es la movilidad,
que mi modelo declara no cubrir.

## Y hay un segundo mecanismo fiel, ya implementado, que tampoco miré

Los `triggers` de la posición 103 (los dos últimos):

```
{sprite:64, at:(9,1), pos1:(5,3), pos2:(3,5)}
{sprite:64, at:(9,1), pos1:(7,5), pos2:(5,7)}
```

`(5,3) (3,5) (7,5) (5,7)` son **exactamente los cuatro puntos medios de las paredes de la caja**,
y `sprite 64 = 0x40` = el suelo del interior. **Pisar (9,1) abre cuatro puertas en la caja.** Y las
otras 5 placas, con `at:(7,3)`, preparan esa zona (escriben `5` en (8,1), `137` en (9,1)…).

`Combat.fireTriggers` (combat.ts:998) está **implementado y cableado en 5 call-sites**, incluido el
move del ENEMIGO (combat.ts:3072) — «aplica a AMBOS bandos». Matiz honesto: `at` (7,3) es `0x42` y
(9,1) es `0x4d`, **ambos impasables para la party** — la propia docstring dice que una placa con
`at` impasable no la dispara nadie… *salvo quien sí pueda ocupar esa celda*, y los enemigos usan
otro bitmap de clase. **No afirmo que esta sea la vía; afirmo que es un mecanismo fiel, presente
en el dato y en el código, que mi barrido no enumeró.** La movilidad basta por sí sola.

## Veredicto

**#103 NO es una victoria fabricada. El sello VICTORY se sostiene** y la predicción
«VICTORY → DEADEND» del plan de resello era mía y era **incorrecta**, por la razón ya
cuantificada: el modelo asume enemigos inmóviles y aquí hay cinco dragones móviles.

**Consecuencia para la 2ª pasada**: #103 **deja de ser el caso urgente**. Su discriminador
(«¿baja con tirador no adyacente y `0x42` en el segmento?») ya está contestado en estático:
**no puede ocurrir**, porque `0x42` bloquea en el código que corrió. Si la telemetría lo mostrara,
acusaría al motor, no a la sala.

## Método — la reincidencia, dicha entera

Esta mañana el lead nombró la patología «el hallazgo que no se propaga a las conclusiones que
dependían del supuesto corregido». **La he repetido dentro de la misma sesión**: en #29/ch16b
encontré las placas y las declaré el mecanismo que el resolvedor no modela… y **no volví a mirar
si había placas en las otras tres salas en riesgo**. La posición 103 tenía siete, dos de ellas
abriendo la caja. Y el mismo barrido contó 6 enemigos donde hay 5.

Regla operativa que saco, más estrecha que «re-correr lo que dependía del supuesto»:
**cuando encuentres un mecanismo no modelado en UNA sala, el barrido de las demás no está
terminado — hay que re-correrlo buscando ESE mecanismo, no sólo el que lo motivó.**
