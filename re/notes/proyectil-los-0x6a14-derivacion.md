# LOS del proyectil de combate — CERRADO POR LECTURA: es `0x6a14`, no `0x6a86`

**Carril:** bancos-residuales · **2026-07-25** · Cierra el residual que yo mismo declaré en
`re/notes/wrong-sala1-victory-alcanzable.md §4` y **corrige el ticket #44** (`359c83f1`).

## Respuesta a la pregunta del encargo

> ¿Hay un test de terreno en el vuelo del proyectil, sí o no?

**SÍ LO HAY.** Está en `COMSUBS.OVL 0x142a`, y consulta el bitmap **`DS 0x6a14`** a través del
kernel **`0x3F6E`**. No es `0x6a86` ni `0x5DFE`.

## Corrección de mi propio descarte

En la nota anterior descarté `0x12DE` como «la animación». **Eso era falso y lo retiro**: leí
sólo su cabecera (el montaje Bresenham a los buffers `0xa728`/`0xa872`) y no llegué al bucle.
`0x12DE` **devuelve un valor** y contiene el test. La señal que me debería haber parado estaba
en su propio caller: `COMSUBS 0x08b8` guarda el retorno de `0x12DE` y ramifica con él.

## La cadena completa

```
COMSUBS 0x0a68            ataque a distancia del PJ
   @0x0b7e  call 0x822    → resolvedor del vuelo
COMSUBS 0x0822
   @0x08b5  call 0x12de   → RECORRIDO REAL DEL PROYECTIL (devuelve 0/1)
   @0x08b8  [bp-0xc] = ax
   @0x08bb  or ax,ax ; je 0x8ca
   @0x08ca  ax==0 → el impacto se RELOCALIZA a g_cmb_scratch_x/_y (donde se detuvo)
   @0x08e5  call 0x748(x,y) → ¿quién ocupa la celda de impacto?
```

Bucle de celdas de `0x12DE` (0x1393-0x144f):

```
1393  cmp byte [si], 0xff ; je 0x13b4        ; fin de la lista de celdas
13aa  call 0x5dd4                            ; → kernel 0x3FB4: límites de píxel 8..0xb7
13ad  cmp [g_cmb_scratch_x], -1 ; jne 0x13be ; fuera de pantalla → termina
13be-140e  dibuja el sprite del proyectil en esa celda (0xf4a, retardo 0x3ee8, blit 0x28ee)
1411  si/di += paso                          ; avanza a la celda siguiente
1417  cmp si, 0xa872 ; ja 0x13b4             ; agotó el buffer
141d  cmp byte [si], 0xff ; je 0x13b4        ; fin de lista
1422  push [g_cmb_scratch_x] ; push [g_cmb_scratch_y]
142a  call 0x5d8e            ; ★ TEST DE TERRENO ★
142d  or ax,ax ; je 0x1434   ; ax!=0 (transparente) → 0x1393, sigue volando
1434  ax==0: ¿la celda es el OBJETIVO ([bp+0xc],[bp+0xa])? → sí: sigue igualmente
1447  no: sub ax,ax          → RETORNA 0 = PROYECTIL DETENIDO AQUÍ
1452  (camino de llegada)    → RETORNA 1
```

**Detalle fiel que conviene no perder:** el bloqueo se salta **si la celda opaca es la celda
objetivo** (0x1434-0x1444). Es decir: se puede disparar a un enemigo que esté *encima* de un
tile opaco; lo que no se puede es atravesarlo de paso.

## El test, resuelto con la regla de la casa

`call 0x5d8e` es near-call de COMSUBS ⇒ `near_call_base(COMSUBS.OVL) = 0xe1e0`;
`(0xe1e0 + 0x5d8e) & 0xFFFF` = **CS `0x3F6E`** (residente, fileoff ULTIMA.EXE `0x476E`).

```
3f6e  push bp; mov bp,sp; sub sp,2; push si
3f75  si = [bp+4]  (y) ; shl si,5          ; y*32
3f7c  bx = [bp+6]  (x)
3f7f  al = [bx + si - 0x54fe]              ; tile del mapa (stride 32, base 0xab02)
3f88  ax = 0x80 ; cl = tile & 7 ; sar ax,cl ; máscara del bit (MSB-first)
3f96  bx = tile >> 3
3f9d  cl = [bx + 0x6a14]                   ; ★ byte del bitmap 0x6a14 ★
3fa3  and ax,cx
3fa7  cmp cx,1 ; sbb ax,ax ; inc ax        ; ⇒ 1 si el bit está PUESTO, 0 si limpio
3fb1  ret 4
```

Y en `0x142d` un **0 detiene** el proyectil ⇒ **bit PUESTO = ATRAVIESA**. (Coincide con la
polaridad ya anotada para 0x6a14: bit set = transparente.)

Args verificados: `0x1422` empuja x y luego y ⇒ `[bp+4]=y`, `[bp+6]=x`, que es justo lo que
`0x3f6e` asume (`si=y<<5`, `bx=x`). ✔

## Censo de consumidores (con `dispatch_table.near_calls_to_kernel`)

| rutina | call-sites |
|---|---|
| kernel `0x3F6E` (tabla 0x6a14) | **2**: `CAST.OVL 0x1c28` (hechizos de campo) · **`COMSUBS.OVL 0x142a` (proyectil de combate)** |
| kernel `0x5DFE` (tabla 0x6a86) | 2: `0x5bfe` y `0x5cb4`, **ambos del flood del viewport** |
| tabla `0x6a86` | 1 mención en todo el desensamblado: `ULTIMA.EXE 0x5e38`, dentro de `0x5DFE` |

⇒ Dos afirmaciones previas quedan **retiradas por no sostenerse**:
1. `los-passability-audit.md`: «0x6a14 … en UN solo sitio: el aplicador de hechizos de campo,
   **ÚNICO caller**». Son dos; el segundo es el proyectil de combate.
2. `combat-spells.md §6` / #44: «el trazado de combate usa 0x5D8E/0x5dfe (bitmap 0x6a86) — y
   **NO cablear 0x6a14 al combate (sería la tabla equivocada)**». Está **invertido**: `0x5d8e`
   *es* el nombre del near-call que resuelve a `0x3F6E`, y `0x3F6E` lee **0x6a14**. La tabla
   equivocada es la que se cableó.

## Consecuencia para el port: `isRangedPathClear` usa la tabla que no es

`combat.ts::isRangedPathClear` bloquea con `ALWAYS_OPAQUE` (los 19 bytes de 0x6a86). El
binario bloquea con el bitmap de 0x6a14 (46 tiles opacos de 256). **Difieren en 49 tiles.**

### 38 que el BINARIO bloquea y el port DEJA PASAR

`0x12` Keep · `0x13` Village · `0x14` SmallCastle · `0x15` LargeCastle · `0x19` Shrine ·
`0x1a` BrokenShrine · `0x1b` Lighthouse · `0x3a`-`0x3f` CastleBritian1-5+Entrance ·
`0x42` WoodFloorShipTie · `0x46` DryStone · `0x50`-`0x55` CastleParapet1-6 ·
**`0x70`-`0x7f` ShadowlordBoundary1-16** · `0xdf` BlockEntrance

### 11 que el port bloquea y el BINARIO DEJA PASAR

`0x09`/`0x0a` Forest3/4 · `0x97` MagicLockDoor · `0xbc` Fireplace · `0xd0`-`0xd3`
CornerStructure1-4 · `0xf8` SignWarning · `0xfe` WhiteSquare · **`0xff` BlackSquare**

**Los 16 `ShadowlordBoundary` son lo urgente**: son las barreras que disuelve el Cetro
(ch34-doom-r8-sceptre, ch47-covetous-cetro-nav) y las que sellan varios bolsillos del censo.
En el binario **paran la flecha**; en el port no. Una sala sellada por barrera que hoy se gana
a distancia sería una **victoria fabricada**. Es la comprobación que toca hacer al censo.

Nota de paso: el #44 justificó su cambio diciendo «0xff: el port lo dejaba pasar, el binario
lo OPACA». Es al revés — `0xff` tiene el bit **puesto** en 0x6a14.

## El «medio 0x5DFE» del port: NO aplica a proyectiles

El hueco que señalé (la rama radial-1 de `0x5DFE` para `{0x4a,0x4b,0xba,0xbb,0x98}`, que
`visibility.ts` modela y `isRangedPathClear` no) **queda resuelto y descartado para el
proyectil**: `0x5DFE` no está en el camino del proyectil en absoluto. La regla del proyectil es
un bitmap plano, **sin componente radial**. ⇒ `isRangedPathClear` **no debe ganar
`WINDOWED_TILES`**: debe cambiar de tabla. El radial-1 sigue siendo correcto y necesario donde
ya está, en la visibilidad del viewport.

## Wrong sala 1: veredicto CONFIRMADO, y ahora probado

Los tiles del divisor, leídos del bitmap real:

| tile | | bit 0x6a14 | proyectil |
|---|---|---|---|
| `0x4b` | StoneGlassWindow | 1 | **atraviesa** |
| `0x98` | MagicLockDoorWithView | 1 | **atraviesa** |
| `0xbb` | LockedDoorView | 1 | **atraviesa** |
| `0x4f` | StoneBrickWall | 0 | se detiene |

⇒ La lectura de **galería de tiro** era correcta y ya no es inferencia: se dispara por las
ventanas y las puertas-con-visor, y los muros macizos paran. El veredicto de
`wrong-sala1-victory-alcanzable.md` **se mantiene**, y el discriminador `ay < 4` sigue siendo
el modo de cerrar el ticket.

## Qué queda

- **Re-derivar `isRangedPathClear` contra 0x6a14** (cambio de core: mueve digests de combate a
  distancia ⇒ ventana + resello, decisión del lead).
- **Re-auditar el censo de bolsillos sellados** con la tabla correcta, empezando por las salas
  con `ShadowlordBoundary`.
- No he leído los helpers `0x9fc` y `0x504` de `0x0a68` (gates previos de arma/munición, no del
  vuelo) ni la rama `0x1434` con objetivo sobre tile opaco en vivo. Ninguno afecta al veredicto.

## Evidencia

- `re/disasm/COMSUBS.OVL.asm` **0x0a68 @0x0b7e**, **0x0822 @0x08b5/@0x08b8/@0x08ca/@0x08e5**,
  **0x12de** completo (bucle 0x1393-0x144f; retorno 0 en 0x1447, 1 en 0x1452), **0x142a**.
- `re/disasm/ULTIMA.EXE.asm` **0x3f6e-0x3fb1** (el test), **0x3fb4** (límites), **0x5dfe-0x5e47**
  (la otra rutina, la del viewport), **0x5e38**.
- `original/u5/ultima5/DATA.OVL` fileoff `0x6a24` (bitmap 0x6a14, 32 bytes):
  `fff3c38fffffffc0ddf803dfffff0000ffffffffffffff3ffffffffeffffffff`.
- `re/tools/dispatch_table.py`: `overlay_near_call_base('COMSUBS.OVL')=0xe1e0`,
  `near_calls_to_kernel(*, 0x3f6e)`.

---

# ADDENDUM — triaje del radio de impacto (P0, 27 specs)

Añadido el mismo día a petición del lead, que escaló esto a P0 y planteó dos preguntas
concretas. Ambas contestadas, más un hallazgo que no esperaba.

## A. El LOS gobierna TAMBIÉN el disparo del enemigo — confirmado

`isRangedPathClear` tiene **dos** consumidores en `combat.ts`: `:1115` (vía `canReach`, el
disparo del PJ) y **`:2925`** (el disparo del ENEMIGO, dentro del brazo de IA a distancia de
`0x014E`). ⇒ El diff de 49 tiles se aplica **simétricamente**: hay salas que pueden volverse
más difíciles, no sólo más fáciles. Corregir la tabla no «afloja» — mueve en los dos sentidos.

## B. `ch16b-deceit-dead-end` — el dead-end SOBREVIVE, y sale REFORZADO

Era la preocupación mayor: sella una **imposibilidad** apoyada en la cita retirada. Verificado:

- El muro portante son los `StoneBrickWall 0x4f` que sellan a los 9 Headless. En `0x6a14` el
  bit de `0x4f` está **limpio ⇒ BLOQUEA**, igual que en la lista de 0x6a86. **El argumento
  aguanta con la tabla correcta.** El propio spec ya se cubría: «el muro portante 0x4f es
  opaco en AMBAS tablas».
- Y hay margen extra a favor: su sala (combatmap **29** = Deceit r13) contiene además
  `0x46 DryStone ×10`, que el **port deja pasar y el binario BLOQUEA** ⇒ con la tabla fiel la
  sala está **más** sellada, no menos.

⇒ **Veredicto de ch16b: se mantiene.** No hay fabricación ahí.

## C. HALLAZGO NUEVO — el #44 también invirtió `0x42` y `0x46`, y de ahí cuelga ch18

El commit del #44 justificó su cambio así (texto conservado en la memoria del carril):

> «**0x42** (WoodFloorShipTie/«lava») y **0x46** (DryStone) el port los OPACABA y el binario
> deja PASAR (las «cajas de lava» de Doom parecían selladas y NO lo están — la sala de
> dragones pasa de LOS 0/5 a 5/5, **casa con la victoria a arco de ch18**)»

Leído del bitmap real:

| tile | | `0x6a14` |
|---|---|---|
| `0x42` | WoodFloorShipTie | **BLOQUEA** |
| `0x46` | DryStone | **BLOQUEA** |
| `0xff` | BlackSquare | atraviesa |

**Las tres afirmaciones del #44 están invertidas.** Las «cajas de lava» **sí** están selladas
en el original. Y como la victoria a arco de ch18 se declaró *coherente con* esa apertura,
**ch18 es candidato a victoria fabricada** y hay que re-mirarlo con la tabla correcta. No lo
afirmo: lo señalo como el segundo capítulo a revisar después de los de barrera.

## D. Triaje: de 112 salas, **33** tienen diferencia real

Barrido de `combatmaps.json` (índices 16-127) comparando bloqueo binario (`0x6a14`) vs port
(`ALWAYS_OPAQUE`). **Excluyendo `0xff`**, que aparece en 111 salas pero es fuera-de-tablero y
además el vuelo lleva antes un recorte de límites (`0x13aa call 0x5dd4` → kernel `0x3FB4`,
rango 8..0xb7) — inerte salvo prueba en contrario.

**Port AFLOJA** (binario bloquea, port deja pasar) ⇒ riesgo de **VICTORIA FABRICADA**:

| salas | tiles |
|---|---|
| **Doom r0, r3, r4, r5, r8, r10, r13** (#112,115,116,117,120,122,125) | **`0x70`-`0x7f` ShadowlordBoundary** ★ |
| Hythloth r0,r1,r2,r7,r8,r11,r13 · Deceit r8 · Shame r7 | `0x42` |
| Deceit r11,r12,r13,r14 · Covetous r2,r3,r12 | `0x46` |
| Deceit r10 | `0x50`-`0x53` CastleParapet |

**Port APRIETA** (port bloquea, binario deja pasar) ⇒ riesgo de **DEAD-END FABRICADO**:

| salas | tiles |
|---|---|
| Deceit r3, r10 · Covetous r0,r1,r2,r4 | `0xd0`-`0xd3` CornerStructure |
| Deceit r9 | `0x97` MagicLockDoor |
| Wrong r8, r15 | `0xbc` Fireplace |
| Deceit r10 · Wrong r11,r12 · Covetous r4 | `0xfe` WhiteSquare |

Las 7 de barrera del Cetro son la prioridad (ch27, ch34, ch47 y ch37-doom-cola); ch18 va
detrás por (C); y **ch16b queda descartado como riesgo** por (B).

## E. Lo que sigue SIN leer, dicho otra vez

`0x9fc` y `0x504` de `0x0a68` son gates de arma/munición previos al vuelo, no del vuelo. El
recorte de límites `0x3FB4` lo he tratado como inerte para `0xff` **por argumento, no por
lectura completa** — si alguien quiere apoyar una decisión en el comportamiento de `0xff`,
que lo lea antes.
