# `ch16b` (combatmap 29): el dead-end es **FABRICADO** — y retiro mi propia confirmación

**Carril:** bancos-residuales · **2026-07-25** · Pregunta del lead antes del resello: ch16b
sella el combatmap 29 como dead-end y `ch91-conquer-plates:79` dice que **se gana** con
`resolveArenaCombat({plates:true})`. ¿Compatibles?

**No lo son. El sello de ch16b se cae.**

## ⚠ Primero: retiro mi propia confirmación de ch16b

En `censo-reauditoria-0x6a14.md` §Addendum escribí que **ch16b «SOBREVIVE y sale REFORZADO»**.
Esa frase respondía a *«¿cambia el veredicto con la tabla 0x6a14?»* — y a esa pregunta la
respuesta sigue siendo **no**, `0x4f` bloquea en ambas tablas. **Pero el veredicto no se
apoyaba en la LOS.** Comprobé una pata del sello y di por bueno el sello entero.

Es el mismo error de alcance del día, cuarta vez: **contesté la pregunta que sabía hacer, no
la que sostenía la conclusión.**

## La geometría (combatmap 29 = Deceit r13)

11 unidades: **2× sprite 220** (los Dragones) en (9,1) y (8,1), y **9× sprite 208** (los
Headless) apiñados en el bolsillo oeste — (1,4), (1,5)×6, (1,6), (2,5).

**Los 8 triggers tienen su `at` en la MISMA celda: `(5,5)`.** Y `(5,5)` es **`0x44
BrickFloor` — PISABLE**. Lo que hacen:

| sprite del trigger | convierte | efecto |
|---|---|---|
| **68 (`0x44` BrickFloor)** | (1,4)(2,4) · (1,5)(2,5) · (1,6)(2,6) · (3,4)(3,6) · (3,5) | **ABRE el bolsillo de los Headless** |
| 79 (`0x4F` muro) | (0,3)(0,4) · (0,5)(0,6) · (0,7) | tapia la columna 0 |

## Reachability medida — desde las TRES entradas pobladas

```
entrada south : 70 celdas · ¿(5,5) alcanzable? SÍ · ¿Headless a melé sin placa? NO
entrada east  : 70 celdas · ¿(5,5) alcanzable? SÍ · ¿Headless a melé sin placa? NO
entrada north : 70 celdas · ¿(5,5) alcanzable? SÍ · ¿Headless a melé sin placa? NO
```

⇒ **La placa es alcanzable a pie desde cualquier entrada**, y sin pisarla **ningún Headless es
alcanzable**. Las dos mitades encajan: por eso el resolvedor **sin** `plates` se atasca, y por
eso `ch91` **con** `plates` la gana.

## Veredicto

**El dead-end de ch16b es FABRICADO.** La sala se gana: caminar a `(5,5)`, la placa dispara,
el bolsillo se abre, y los 9 Headless pasan a ser alcanzables a melé.

Y **la causa no es la tabla de LOS**: es que el capítulo midió con un resolvedor que **no
modelaba las placas**. El argumento del sello —«los Headless están tras `StoneBrickWall 0x4f`,
opaco en ambas tablas»— es **cierto pero irrelevante**: la sala no se gana disparando a través
del muro, se gana **quitando el muro** con un trigger que la party alcanza.

`ch91-conquer-plates:79` ya lo decía con todas las letras: *«el dead-end de ch16b era del
resolver»*. Estaba escrito y nadie cruzó los dos capítulos.

**Clase distinta a #65**: allí el defecto era una tabla equivocada; aquí es una **mecánica del
juego no modelada por el resolvedor de ese capítulo**. Mismo resultado —afirmar que el juego
no deja ganar cuando sí deja— por otra vía.

## Consecuencia para el resello

La lista de sellos a revisar sube de **3 a 4**:

| # | sala | dirección | causa |
|---|---|---|---|
| #103 | Hythloth r7 | victoria fabricada | LOS permisiva (`0x42`) |
| #125 | Doom r13 | victoria con coartada | LOS + Cetro |
| #65 | Covetous r1 | **dead-end fabricado** | LOS restrictiva (`0xff`) |
| **#29** | **Deceit r13 (ch16b)** | **dead-end fabricado** | **placa no modelada** |

**Discriminador de #29** — no necesita instrumentación nueva: `enemyCells` ya graba las
celdas. *¿Desaparece alguna celda con `x ≤ 2` y `4 ≤ y ≤ 6` (el bolsillo)?* Si sí, los
Headless murieron ⇒ la sala se gana y el sello se retira.

**Ojo al ámbito**: ch16b **no sella `.gam` ni encadena**, así que retirarlo no arrastra
capítulos aguas abajo. Lo que hay que rehacer es su aserción, no la cadena.
