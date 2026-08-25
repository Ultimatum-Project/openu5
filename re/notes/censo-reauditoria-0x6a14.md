# Re-auditoría ESTÁTICA del censo de salas con la tabla correcta (0x6a14)

**Carril:** bancos-residuales · **2026-07-25** · Autorizada por el lead tras la refutación
del #44 (`re/notes/proyectil-los-0x6a14-derivacion.md`). Script reproducible:
`re/tools/audit_ranged_0x6a14.py`.

> **El marco, sin suavizar:** el binario **para la flecha** en los tiles que el port deja
> pasar. Una sala sellada por barrera que hoy ganemos a distancia es una **VICTORIA
> FABRICADA**. Si de aquí salen victorias que retirar, se retiran.

## Método

Por cada sala con diferencia real de bloqueo (excluyendo `0xff` fuera-de-tablero):

1. BFS a pie desde los `playerStarts` de **cada** entrada poblada, con la pasabilidad del
   party (`IsWalking_Passable`, = bitmap de a pie 0x54D4, `combat.ts::isWalkable`).
2. Por cada enemigo del `.CBT`, tres preguntas: ¿melé (adyacente a celda alcanzada)?
   ¿LOS con la tabla del **PORT** (`ALWAYS_OPAQUE`)? ¿LOS con la tabla del **BINARIO**
   (`0x6a14`)? El raycast replica `isRangedPathClear` (muestreo `Math.round`, celda destino
   excluida — que además es el detalle fiel `0x1434-0x1444`).
3. Se marca **SOLO-PORT** el enemigo con `melé=NO · LOS-port=SÍ · LOS-binario=NO`: sólo es
   alcanzable por la sobre-permisividad del port.

## Resultado: 9 salas con al menos un enemigo SOLO-PORT

| sala | | SOLO-PORT (peor entrada) | tiles culpables | veredicto EN EL CENSO HOY | riesgo |
|---|---|---|---|---|---|
| #103 | Hythloth r7 | **6/6** | `0x42`×16 | **VICTORY** | 🔴 **ALTO** |
| #125 | Doom r13 | **14/16** (sur) | `0x7X`×8 | **VICTORY** | 🟠 medio (ver Cetro) |
| #115 | Doom r3 | 3/9 | `0x7X`×3 | VICTORY-**por-descenso** | 🟡 bajo |
| #97 | Hythloth r1 | 2/16 | `0x42`×4 | DEADEND-fiel | ✅ ninguno |
| #107 | Hythloth r11 | 16/16 | `0x42`×12 | DEAD-END FIEL | ✅ se **refuerza** |
| #116 | Doom r4 | 3/9 | `0x7X`×3 | DEAD-END FIEL | ✅ se refuerza |
| #117 | Doom r5 | 10/10 | `0x7X`×52 | DEAD-END fiel | ✅ se refuerza |
| #120 | Doom r8 | 6/10 | `0x7X`×18 | DEAD-END FIEL | ✅ se refuerza |
| #122 | Doom r10 | 6/12 | `0x7X`×14 | DEADEND-STUCK | ✅ se refuerza |

**Sólo DOS salas registran VICTORY y dependen de la tabla equivocada.** Las seis con
veredicto de dead-end **salen reforzadas**: con la tabla fiel están *más* selladas, así que
su sello es más sólido que cuando se escribió.

## 🔴 #103 Hythloth r7 — el caso fuerte

- **6 de 6 enemigos** dejan de ser alcanzables con la tabla fiel; ninguno lo es por melé.
- Los tiles culpables son **`0x42 WoodFloorShipTie` ×16** — y `0x42` **no es una barrera del
  Shadowlord**: el Cetro **no lo disuelve**. No hay mecanismo legítimo de reserva.
- Es exactamente la clase que el #44 «abrió» con su afirmación invertida («las cajas de lava
  parecían selladas y NO lo están»). Están selladas.

⇒ **Candidato nº 1 a victoria fabricada.** Si el run la gana disparando a través de `0x42`,
la VICTORY se retira y la sala pasa a dead-end fiel [PROSA-AUTOFIEL: sin derivación citada por
sala — barrido tanda 2, 07-27. Lo DERIVADO aquí es la tabla 0x6a14 y su alcance; que el original
tampoco gane la sala NO se sigue de ello].

## 🟠 #125 Doom r13 — VICTORY con vía de escape legítima

14/16 SOLO-PORT desde la entrada sur, pero los tiles son **`0x7X` ShadowlordBoundary**, que el
**Cetro SÍ disuelve** — y el censo registra que este capítulo usa Cetro («CETRO, 8 tiles
0x7X»). Tras la disolución los tiles cambian y mi análisis estático (que lee el `.CBT` crudo)
**no modela ese estado**. Su VICTORY puede ser perfectamente legítima. **Verificable**: ¿las
bajas ocurren antes o después del (U)se Cetro?

## 🟡 #115 Doom r3 — no gana matando

Su VICTORY es **por DESCENSO** (Cetro disuelve la barrera → klimb-descend a N4), no por
limpiar el bando. La LOS no interviene en el veredicto.

## Límites de este análisis — leerlos antes de actuar

1. **Asume enemigos INMÓVILES.** El censo tiene la categoría «winnable por enemigo móvil»
   (19 salas, incluidas #115/#116/#120): un enemigo que se acerca acaba en rango y la
   victoria es legítima sin LOS de largo alcance. Mi barrido no lo modela. Por eso el
   veredicto del censo manda sobre mi columna, y por eso las 6 de dead-end quedan intactas.
2. **No modela la disolución por Cetro** (`0x7X` → pasable). Afecta a #125 y a las de Doom.
3. **No modela los triggers de sala** (que abren muros `0x4F→0x44`).
4. `#112 Doom r0` aparecía en el triaje de tiles pero **tiene 0 unidades** en el `.CBT`:
   sin enemigos no hay nada que auditar. Anomalía de dato, anotada.

## Qué hay que hacer con esto

1. **#103**: discriminador en el run — ¿alguna baja se produce con un `0x42` en la línea de
   tiro y sin contacto melé? Si sí, retirar la VICTORY. Es el único de los dos sin vía de
   escape legítima.
2. **#125**: comprobar si las bajas son posteriores al (U)se Cetro. Si lo son, legítima.
3. **Las 6 de dead-end**: nada que hacer salvo actualizar la cita (hoy se apoyan en 0x6a86;
   la conclusión no cambia, el argumento sí).
4. Al re-derivar `isRangedPathClear` contra 0x6a14, estas 9 son las salas cuyo digest se
   moverá; el resto del censo no debería inmutarse.

---

# ADDENDUM 2 — las dos condiciones del lead, cerradas

## A. Robustez frente a `0xff` — el veredicto NO depende de él

Condición del lead: «si alguna de las 33 acaba dependiendo de `0xff`, se lee `0x3FB4` antes de
decidir». Comprobado corriendo el barrido **dos veces**, con `0xff` atravesando (lectura del
bitmap) y con `0xff` bloqueando (conservador):

```
0xff ATRAVIESA : [97, 103, 107, 115, 116, 117, 120, 122, 125]
0xff BLOQUEA   : [97, 103, 107, 115, 116, 117, 120, 122, 125]
```

**Idéntico.** Ninguna de las 9 depende de `0xff` ⇒ **no hace falta leer `0x3FB4`** para
sostener este veredicto. La duda queda abierta pero deja de ser bloqueante.
Script: `re/tools/audit_ranged_robustez.py`.

## B. Dirección «PORT APRIETA» — riesgo de DEAD-END FABRICADO

Reportada aparte, como pidió el lead: una victoria fabricada y un callejón fabricado son
errores distintos. Aquí se cuentan los enemigos que el **binario alcanza** y el **port no**
(el port es MÁS restrictivo ⇒ puede declarar dead-end donde el original deja ganar).

**6 salas**, y al cruzarlas con el veredicto del censo:

| sala | enemigos solo-binario | tiles | veredicto hoy | ¿fabricado? |
|---|---|---|---|---|
| **#65 Covetous r1** | **7** | `0xd0`-`0xd3` | **SELLADA: DEADEND-fiel** | 🔴 **CANDIDATO** |
| #25 Deceit r9 | 11 | `0x97` | SIN-ENTRADA-fiel (sello geométrico) | ✅ no — no se puede ni entrar |
| #66 Covetous r2 | 8 | `0xd0`,`0xd1` | winnable-móvil | ✅ no — ya se gana |
| #64 Covetous r0 | 7 | `0xd0`-`0xd3` | entrada-SUR-N/A (sin veredicto) | ⚪ pendiente |
| #67 Covetous r3 | 4 | `0xd0`,`0xd1` | entrada-SUR-N/A | ⚪ pendiente |
| #79 Covetous r15 | 5 | — | entrada-SUR-N/A | ⚪ pendiente |

### 🔴 #65 Covetous r1 — el candidato a dead-end fabricado

El censo la sella así: *«la party HUYE por un borde; sellos ESTRUCTURALES (roca opaca `0x4d`/
void), 0 flips P0a»*. Verificado tile a tile:

| tile | binario | port |
|---|---|---|
| `0x4d` (la roca del sello citado) | **BLOQUEA** | BLOQUEA |
| `0xd0`-`0xd3` CornerStructure | **deja pasar** | **BLOQUEA** |

⇒ El sello **citado** (`0x4d`) aguanta; pero el port bloquea ADEMÁS las cuatro
`CornerStructure`, que en el binario **no bloquean**. Con la tabla fiel, **7 enemigos pasan a
ser alcanzables a distancia** desde donde la party llega a pie. Si esa sala se selló como
dead-end porque la party «no alcanzaba a nadie», el sello puede ser un **DEAD-END FABRICADO**:
el original sí deja ganarla a arco.

**Simetría honesta con #103**: allí retiraríamos una victoria; aquí habría que retirar un
dead-end. Los dos son el mismo error de medir con la tabla equivocada, en direcciones
opuestas — y el segundo es más incómodo porque un dead-end sellado *parece* conservador.

## Estado consolidado

| dirección | salas | con veredicto en riesgo |
|---|---|---|
| port AFLOJA → victoria fabricada | 9 | **#103** (sin coartada) · #125 (coartada del Cetro) |
| port APRIETA → dead-end fabricado | 6 | **#65** |

**Tres salas** para el resello, no treinta y tres.

---

# ADDENDUM 3 — #65 Covetous r1 CERRADO: el dead-end **ES FABRICADO**. Y una corrección mía

## ⚠ Primero, retiro una afirmación de mi Addendum 2

Escribí «el veredicto NO depende de `0xff`». **Eso era cierto sólo para la dirección
AFLOJA**, que es la única que había medido. Al cerrar #65 comprobé la otra y la dirección
APRIETA **sí dependía por completo** de `0xff`:

```
0xff ATRAVIESA : [25, 64, 65, 66, 67, 79]
0xff BLOQUEA   : [25]
```

Cinco de las seis se caían. Generalicé un resultado medido en una dirección a las dos, que
es exactamente el error que este carril lleva todo el día persiguiendo. Corregido: **había
que leer `0x3FB4`** — la condición que puso el lead — y se ha leído.

## `0x3FB4` LEÍDO: la duda de `0xff` queda cerrada por lectura, no por argumento

`ULTIMA.EXE 0x3fb4-0x4008` es **sólo un convertidor píxel→celda con guarda de tablero**:

```
3fb7  cmp [bp+6], 8   ; jl  0x3fd1      ┐ fuera de 8..0xb7 en X o Y →
3fbd  cmp [bp+6], 0xb7; jg  0x3fd1      │ scratch = -1 (0x12DE termina en 0x13ad)
3fc4  cmp [bp+4], 8   ; jl  0x3fd1      │
3fca  cmp [bp+4], 0xb7; jle 0x3fdc      ┘
3fdc  scratch_x = (px − 8) >> 4         ; con el idioma cdq/xor/sub (shift con signo)
3ff3  scratch_y = (py − 8) >> 4
```

8..183 con celdas de 16 px = celdas **0..10 exactas**: la guarda recorta al tablero 11×11 y
**NO filtra por contenido del tile**. Una celda con tile `0xff` está DENTRO del tablero, pasa
la guarda, y su opacidad la decide `0x3F6E` sobre `0x6a14`, donde `0xff` tiene el bit
**PUESTO = atraviesa**.

⇒ **En el original los proyectiles VUELAN a través de las celdas vacías `0xff`.** Ya no es
una suposición.

## El veredicto de #65

La sala es un reloj de arena: dos cámaras (norte y sur) unidas por un pasillo este, y un
**bolsillo oeste** (x1-3, y4-6) lleno de vacío `0xff` con **10 de los 16 enemigos dentro**.
La party entra por el **este**.

El bolsillo tiene una sola abertura hacia el este: **(4,5) = `0x8a` StoneHeadstone**.

| | ¿la party puede ANDAR? | ¿la flecha PASA (binario)? | ¿pasa (port)? |
|---|---|---|---|
| `0x8a` lápida (4,5) | **NO** | **SÍ** | sí |
| `0xff` vacío del bolsillo | **NO** | **SÍ** | **NO** |
| `0x4f` muro (4,4) y (4,6) | no | no | no |

Y los 8 triggers de la sala —que convertirían todo el bolsillo de vacío a `0x44 BrickFloor`,
abriéndolo— tienen **todos su placa `at` en (4,5)**, la lápida **no pisable**: nunca disparan.
(#65 ya está en la lista «anomalía trigger-`at`-no-pisable» del censo, 35 salas.)

**Trazado real desde celdas que la party alcanza a pie** (54 celdas, spawn este):

```
sprite 236 @(3,5)  ← desde (5,5); ruta: (4,5)=8a
sprite 236 @(2,5)  ← desde (5,5); ruta: (4,5)=8a (3,5)=ff
sprite  30 @(1,5)  ← desde (5,5); ruta: (4,5)=8a (3,5)=ff (2,5)=ff
… los 10 del bolsillo, todos con línea de tiro
```

⇒ **El sello de dead-end de #65 es FABRICADO.** No lo sella la geometría del original: lo
sella el port bloqueando `0xff`, que el binario deja pasar. En el original se dispara por el
hueco de la lápida y a través del vacío, y la sala **se gana a arco**.

El censo lo justificaba con «sellos ESTRUCTURALES (roca opaca `0x4d`/void)». La mitad es
correcta —`0x4d` bloquea en ambas tablas— pero **el «void» no sella**: es transparente.

## Nota importante: el fix YA ATERRIZADO cambia esta sala

`isRangedPathClear` ya usa `0x6a14` (main `e217ace4`), donde `0xff` pasa. ⇒ **#65 va a
flipar de DEADEND a (probable) VICTORY en el resello.** No es una regresión: es el fix
haciendo su trabajo. Conviene que el resello lo espere en vez de leerlo como rojo.

Y por simetría, las otras cuatro de la dirección APRIETA (#64, #66, #67, #79) también verán
más enemigos alcanzables; tres están sin veredicto («entrada-SUR-N/A») y #66 ya era
winnable-móvil, así que sólo #65 cambia un sello escrito.

## Estado final de la re-auditoría

| dirección | salas | sello que cambia |
|---|---|---|
| port AFLOJA → victoria fabricada | 9 | **#103** (sin coartada) · #125 (coartada del Cetro) |
| port APRIETA → dead-end fabricado | 6 | **#65 — CERRADO: fabricado** |

**Tres sellos a revisar en el resello: #103, #125, #65.**
