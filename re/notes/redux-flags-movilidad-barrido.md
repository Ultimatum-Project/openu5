# Movilidad de enemigos sobre flags de Redux — censo de consumidores, derivación y radio de sellos

Cola destapada por la tanda 3 del barrido prosa-autofiel (`prosa-autofiel-tanda3.md` §7.1):
`game/src/core/combat/enemies.ts` alimenta la movilidad de enemigos con
`AdditionalEnemyFlags.json`, que es de **Ultima5Redux** y no está derivado del binario.
Nadie había barrido **qué consume cada flag** ni **qué sellos dependen de ellos**.

---

## 1. ★★ HALLAZGO PRINCIPAL: tres flags son CÓDIGO MUERTO

`enemies.ts:192-199` asigna nueve campos. **Tres no los lee nadie** (grep de todo el repo,
incluidos `skin/`, `tools/` y `e2e/`):

| campo del port | origen Redux | consumidores | estado |
|---|---|---|---|
| **`canPassWalls`** | `CanPassThroughWalls` | **NINGUNO** | ☠️ **MUERTO** |
| **`activelyAttacks`** | `ActivelyAttacks` | **NINGUNO** | ☠️ **MUERTO** |
| **`experience`** | `Experience` | **ninguno de juego** (sólo 3 `expect` en `combat.test.ts:93/102/122`) | ☠️ **MUERTO** (con tests que no pueden cazar nada) |
| `isWater` | `IsWaterEnemy` | `combat.ts:1138`, `world/enemies.ts:132`, `encounters.ts:114`, `saveNative.ts:380` | VIVO |
| `canFlyOverWater` | `CanFlyOverWater` | `combat.ts:1139` (⚠️ auto-declarado aproximación) | VIVO |
| `isSand` | `IsSandEnemy` | `encounters.ts:108/114` (siembra); **NO** en `tilePassableFor` | PARCIAL |
| `doesNotMove` | `DoNotMove` | `combat.ts:3110` | VIVO |
| pesos por era | `Era*Weight` | siembra de encuentros | VIVO |

### 1.1 La consecuencia que importa

**En el port, NINGÚN enemigo atraviesa muros — el flag no se consulta jamás.** La única
mención viva de `canPassWalls` fuera de su asignación es un comentario en
`combat.ts:1127` que dice *«flag de muros, ajeno a esta regla de agua; **fuera de
alcance**»*. `tilePassableFor` (`combat.ts:1129-1141`) tiene exactamente tres ramas:

```
if (isPlayer || !def) return info.walkable;                                  // clase 0
if (def.isWater)       return info.waterEnemyPassable;
if (def.canFlyOverWater) return info.landEnemyPassable || info.waterEnemyPassable;  // ⚠️
return info.landEnemyPassable;                                               // terrestre
```

Ninguna deja pasar un muro. ⇒ **Todo razonamiento del repo que prediga comportamiento del
port a partir de `CanPassThroughWalls` es inválido, en los dos sentidos** (§4).

---

## 2. Derivación: el binario SÍ tiene clases de movimiento, y son ONCE

`kernel_tile_passable(mover, tile)` = **ULTIMA.EXE 0x2C4C** (`re/disasm/ULTIMA.EXE.asm`
4938+):

```
2c4f: bx = [bp+6] >> 2                  ; bp+6 = MOVER (transporte / sprite)
2c56: al = [bx + 0x54f4]                ; CLASE  ← tabla DATA.OVL fileoff 0x5504, 64 B
2c5c: cmp ax,0x0a ; ja 0x2ca9           ; clase > 10 → BLOQUEADO
2c64: jmp cs:[bx*2 + 0x2d60]            ; jump-table INLINE de 11 handlers
```

**Polaridad** (verificada contra `carpet-b2.md:26`): `0x2d3d` (`ax=1`) = **PASABLE**;
`0x2ca9` (`ax=0`) = **BLOQUEADO**.

Jump-table `0x2d60` reconstruida de los bytes (el desensamblador la decodifica como
instrucciones porque es DATA):
`6a2c 762c 802c ae2c ca2c dc2c 342d 422d 4e2d 542d 5a2d` → 11 destinos, y a continuación
`c2 04 00` = `ret 4` (fin de rutina).

| clase | handler | predicado | quién es |
|---|---|---|---|
| 0 | `0x2c6a` | bitmap de a pie `0x54D4` (kernel `0x2BD4`) | party a pie, skiff, la mayoría |
| 1 | `0x2c76` | PASABLE **sólo si es agua** | acuático puro |
| 2 | `0x2c80` | agua rápida `0x60-0x6F` ∪ agua ∪ `walkable` | **alfombra** |
| 3 | `0x2cae` | `walkable` **menos** tile 4 y tile `0x8F` | **caballo** (ni Swamp ni Lava) |
| 4 | `0x2cca` | PASABLE **si NO es agua** — ★ **sin consultar `0x54D4`** | ★ **la clase que ATRAVIESA MUROS** |
| 5 | `0x2cdc` | sub-bitmap propio `0x5510` para tiles `0x34-0x37`; si no, agua/tierra | especial |
| 6 | `0x2d34` | PASABLE sólo si tile ≤ 2 | **fragata** (agua profunda) |
| 7 | `0x2d42` | sólo tile 4 | mono-tile |
| 8 | `0x2d4e` | sólo tile 5 | mono-tile |
| 9 | `0x2d54` | sólo tile 1 | mono-tile |
| 10 | `0x2d5a` | sólo tile 7 | mono-tile |

**Contraste doble que valida la lectura** (no es una interpretación suelta):
- Los 5 transportes que `carpet-b2.md:23` ya había derivado casan **uno a uno** con la
  tabla extraída: caballo `0x10`→3, alfombra `0x14`→2, skiff `0x18`→0, a pie `0x1C`→0,
  fragata `0x20/0x24`→6.
- La clase 3 (caballo) excluye **tile 4 = Swamp** y **tile 0x8F = Lava** en la numeración
  de tiles del juego. Un caballo que no entra en pantano ni en lava es exactamente la
  regla de U5.
- `es_agua` (`0x2C2E`) = `tile<4 ∨ (tile&0xf0)==0x60` — idéntico a lo ya derivado en
  `carpet-b2.md:33`.
- La clase **255** cae en `ja → BLOQUEADO` y le toca a los movers `0xE8-0xEB`, la familia
  de los **campos** (`arena-fields-encoding`): un campo bloquea siempre. Coherente.

### 2.1 Veredicto de derivación, por flag

| flag Redux | ¿existe en el binario? | clasificación |
|---|---|---|
| `IsWaterEnemy` | sí — **clase 1** | **DERIVADO-COINCIDE** (en concepto) |
| `CanFlyOverWater` | **no como flag**: no hay clase «tierra ∪ agua» salvo la 2 (alfombra) | **DERIVADO-DIFIERE** — el port ya se auto-declara ⚠️ en `combat.ts:1120-1124` |
| `CanPassThroughWalls` | **sí — clase 4** (pasable si no-agua, ignora el bitmap de a pie) | ★ **DERIVADO-DIFIERE**: el mecanismo EXISTE en el binario y el port **no lo implementa en absoluto** |
| `IsSandEnemy` | no hay clase de arena | **SIN-DERIVAR** (inocuo hoy, `combat.ts:1125`) |
| `DoNotMove` | no visto en esta rutina (es de IA, no de pasabilidad) | **SIN-DERIVAR** aquí |
| `ActivelyAttacks`, `Experience`, `Era*Weight` | fuera de alcance de 0x2C4C | **SIN-DERIVAR** (y los 2 primeros, muertos) |

★ **El modelo del binario NO es un juego de flags booleanos: es UNA clase por mover
(0-10), excluyentes.** El port lo aproxima con tres booleanos independientes leídos de una
reimplementación de terceros. La divergencia es **estructural**, no de valores.

---

## 3. ⛔ EL ESLABÓN QUE FALTA — y por qué NO lo he cerrado

Para decir **qué enemigos** son clase 4 hace falta el mapeo `enemigo → índice de mover`, y
**no lo he derivado**. Lo dejo explícito porque es justo donde es fácil fabricar:

- La tabla `0x5504` mide **64 bytes** (idx 0-63 ⇒ movers `0x00-0xFF`). Lo verifiqué
  leyendo más allá: a partir del byte 96 empiezan **strings ASCII** (`"Select:"`,
  `"Calm "`, `"North"`, `"South"`…), o sea que ahí ya no hay tabla.
- La clase 4 le toca a los índices **39** (movers `0x9C-0x9F`) y **63** (movers
  `0xFC-0xFF`).
- `combat.md:498` afirma que en combate el índice es el sprite del combatiente y que «las
  ratas (`0x90`) son clase 0» — y la tabla lo confirma (`t[0x90>>2] = t[36] = 0`). Pero el
  espacio de sprites de combate **no es** el de `TileData.json`.

**Trampa en la que caí y dejo señalizada:** probé el mapeo «sprite = 320 + i·4» (el
`KeyTileReference` de Redux que usa `enemies.ts:17`) ⇒ idx = 80+i. Eso da índices 80-127,
que **caen fuera de la tabla, dentro de los strings** — y aun así produce una tabla de
resultados con pinta perfectamente creíble (Ghost→clase 0, Daemon→clase 117…). **Es
basura.** Cualquiera que repita este barrido va a generar ese mismo cuadro plausible; no
vale. Igualmente estuve a punto de invertir la polaridad (leí `0x2ca9`=pasable) y lo que
lo cazó fue **cruzar con `carpet-b2.md`, que ya había derivado los 5 transportes**.

⇒ **PROBE APUNTADO (lote-D o disasm):** derivar el mover de combate. Vía sugerida:
`COMBAT.OVL:0x0000` (el pasabilidad de arena) llama `0xffffa172` y `0xffff89bc` con el
sesgo `(x+0x81D0)&0xFFFF`; el segundo recibe el **tile leído del mapa de arena** y es el
candidato a resolver sprite→clase. Sin eso, **no se puede afirmar que el Ghost atraviese
muros en el original** (ni lo contrario).

---

## 4. RADIO DE SELLOS — quién razona sobre un flag que el port no lee

**No re-adjudico ninguno** (regla del encargo). Tabla para que el lead decida.

| sitio | qué afirma | estado |
|---|---|---|
| `ch24-salas-covetous.spec.ts:195` + `covered.ch24…json:8` | cm66 «DEAD-END FIEL patrón-#29: Slimes (id-24, **CanPassThroughWalls=false**) varados … la hipótesis winnable-móvil es FALSA **por movilidad real**» | ⚠️ **la razón dada es inoperante**: en el port ningún enemigo cruza muros, valga `false` o `true`. El dead-end MEDIDO puede seguir en pie, pero **no por ese motivo**. La tanda 2 ya le quitó el «patrón-#29» (sello retirado por fabricado); ahora se le cae también la pata de movilidad |
| `rebarrido-65-125-y-ch16b-5-5.md:61` | Ghost «**`CanPassThroughWalls: TRUE`** (atraviesa muros ⇒ **viene a ti**)» | ⚠️ **FALSO PARA EL PORT**: el Ghost no viene a ti a través de muros — el port no lo implementa. Predicción de comportamiento sobre código inexistente |
| `rebarrido-65-125-y-ch16b-5-5.md:29` | Headless «se mueven, sólo que están emparedados (`CanPassThroughWalls: false`)» | ⚠️ misma familia: el `false` no explica nada (todos lo están) |
| `sprite-frame-drop-tercer-sapo-cargador.md:169` | «la sala tendría **1 enemigo real (el Ghost, `CanPassThroughWalls`)** y **sería ganable**» | ⚠️ **conclusión de ganabilidad** apoyada en movilidad no implementada |
| `prep-ventana-aterrizaje-lote.md:63` | «Ghost `CanPassThroughWalls` y `cm65` son las que más probablemente **pasen a VICTORY**» | ⚠️ predicción sobre la misma base |
| `103-hythloth-r7-dragones-moviles.md:56` | lista `CanFlyOverWater: true / CanPassThroughWalls: false` como datos de movilidad | informativo; el segundo campo es inerte en el port |

**Patrón común:** todos usan el flag para predecir **si un enemigo alcanza a la party**, y
por tanto si una sala es ganable. Como el port nunca lee el flag, esas predicciones no
describen al port; y como el binario **sí** tiene el mecanismo (clase 4) pero no sabemos a
quién se lo aplica, tampoco describen al original. **Quedan sin suelo por ambos lados.**

---

## 5. Por qué NO hay commit de fix en esta tanda

El punto 4 del encargo («si un DERIVADO-DIFIERE es calcable ya, escribe el fix») **no se
cumple todavía**: el `DERIVADO-DIFIERE` está identificado (clase 4 existe; el port no
modela clases) pero **calcarlo exige el mapeo enemigo→mover del §3**, que no está
derivado. Escribir hoy `if (def.canPassWalls) return true` sería cambiar comportamiento —
y potencialmente flipar sellos de sala — **sobre la palabra de Redux**, que es exactamente
el defecto que este barrido vino a documentar. Se apunta como probe, no se cablea.

## 6. Colas

1. **PROBE**: mapeo enemigo→índice de mover (§3). Desbloquea el fix calcado y el
   re-veredicto de cm66 / Ghost / #65.
2. **3 campos muertos** (`canPassWalls`, `activelyAttacks`, `experience`): decidir entre
   purgar o cablear. `experience` además tiene 3 `expect` que **no pueden cazar ninguna
   regresión** porque ningún camino de juego lo consume — un test verde por construcción.
   > **RULING DEL LEAD (07-27): NO PURGAR TODAVÍA.** Se resuelven CON el probe #30: si el
   > mapeo enemigo→mover llega, se **cablean derivados** (y entonces los campos dejan de
   > estar muertos); si no llega, se **purgan con acta**. Purgarlos ahora tiraría la única
   > señal que queda de que el mecanismo existe en el binario y el port no lo modela.
3. **`canFlyOverWater`** ya está auto-declarado ⚠️ aproximación en `combat.ts:1120`; con
   la tabla de clases en la mano, la rama «tierra ∪ agua» sólo existe como **clase 2
   (alfombra)**, lo que refuerza que la fila voladora no está derivada.
4. Los 6 sitios del §4, para el carril de sellos.
