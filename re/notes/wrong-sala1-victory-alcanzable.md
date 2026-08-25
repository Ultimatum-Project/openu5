# ¿Es alcanzable en el ORIGINAL la VICTORY de la sala 1 de Wrong? — adjudicación

**Carril:** bancos-residuales · **2026-07-25** · Encargo del lead a raíz del rojo
`ch23-salas-wrong:117` (`Expected "DEADEND", Received "VICTORY"`). La pregunta NO es por qué
cambió el resultado (eso lo explica el stream RNG: candidato `ffe5ba19`), sino si el
resultado NUEVO es FIEL.

**Veredicto: SÍ, una victoria ahí es alcanzable sin fabricar nada — pero SÓLO a distancia.
Una victoria por cuerpo a cuerpo sería IMPOSIBLE y delataría un defecto.**

---

## 1. La sala: combatmap 49 (= `DUNGEON.CBT[33]`)

Wrong = loc 36 → orden 2 saltando Despise (`roomCombatMapIndex`, dungeon.ts:1498) ⇒
`16 + 2·16 + roomNo(1)` = **49**. Coincide con el ancla del propio spec («sala 3 = #51»).

```
      x0 x1 x2 x3 x4 x5 x6 x7 x8 x9 x10
 y 0  4f 4f 4f 4f 4f 4f 4f 4f 4f 4f 4f
 y 1  4f 44 44 44 44 4f 44 44 44 44 4f   ← cámara NO (x1-4)  |  cámara NE (x6-9)
 y 2  4f 44 44 44 44 4f 44 44 44 44 4f
 y 3  4f b1 44 44 44 4f 44 44 44 b0 4f
 y 4  4f 4f 4b 98 4b 4f 4b bb 4b 4f 4f   ← ★ DIVISOR ★
 y 5  ff 4f 44 44 44 44 44 44 44 4f ff
 y 6  ff 4f b1 44 44 44 44 44 b0 4f ff   ← (2,6) = placa del trigger, sobre un SCONCE
 y 7  ff 4f 4f 44 44 44 44 44 4f 4f ff
 y 8  ff ff 4f 44 44 44 44 44 4f ff ff   ← la party spawnea aquí (y8-y10)
 y 9  ff ff 4f 44 44 44 44 44 4f ff ff
 y10  ff ff 4f 44 44 44 44 44 4f ff ff
```

| tile | nombre (TileData) | `IsWalking_Passable` |
|---|---|---|
| `0x44` | BrickFloor | ✅ |
| `0x4f` | StoneBrickWall | ❌ |
| `0x4b` | StoneGlassWindow | ❌ |
| `0x98` | MagicLockDoorWithView | ❌ |
| `0xbb` | LockedDoorView | ❌ |
| `0xb0/0xb1` | Right/LeftSconce | ❌ |
| `0xff` | BlackSquare (fuera de tablero) | ❌ |

**Los 9 enemigos están TODOS al norte del divisor** (`units`: 2× sprite 1 y 4× sprite 237 en
la cámara NO; 3× sprite 236 en la NE, todos en y1-y3). **La party spawnea al SUR**: los
`playerStarts` de la sala sólo tienen poblada la entrada **south** — (5,8) (6,9) (4,9) (5,10)
(7,10) (3,10); east/west/north son todo (0,0). Y el spawn fiel P0a la manda ahí:
`approachDir: "north"` ⇒ facing north ⇒ entrada = opuesto = **south**. ✔ consistente.

### La fila y4 es infranqueable, y el trigger no la abre

Las únicas seis celdas no-`0x4f` del divisor son 4 ventanas `0x4b` y las dos puertas
`0x98` (mágica) y `0xbb` (con llave). **Ninguna es transitable.** Y el único trigger de la
sala no ayuda:

```
trigger: sprite 78 (0x4E StoneBrickWallSecret), at (2,6), pos1=pos2 (5,2)
```

Dos razones independientes por las que es letra muerta:
1. **La placa no se puede pisar**: (2,6) es `0xb1` LeftSconce, `IsWalking_Passable=false`.
   El handler fiel (COMBAT 0x111A, `re/notes/room-triggers.md`) dispara *tras un movimiento
   con éxito* sobre la celda `at` — que aquí es inalcanzable.
2. **Aunque disparara, no abriría nada**: convertiría (5,2) —hoy muro `0x4f`— en `0x4E`
   StoneBrickWallSecret, que TAMBIÉN es impasable; y (5,2) está *dentro* de la mitad norte
   (separa las dos cámaras de enemigos), no en el divisor.

⇒ **La mitad norte es inalcanzable a pie. Una VICTORY por melé es IMPOSIBLE en esta sala.**

---

## 2. Entonces la victoria sólo puede ser a distancia. ¿Lo permite el original?

El capítulo siembra `MAGIC_BOW 0x24` + flechas + anillo de invisibilidad (`seedLoadout`), así
que la party dispara. La pregunta se reduce a: **¿bloquea el original un disparo de combate
por los muros/ventanas intermedios?**

### 2.1 El cursor de puntería NO tiene ningún gate de tile

`COMSUBS.OVL 0x05c8-0x0621` es el bucle de movimiento del cursor de aim. Valida EXACTAMENTE
dos cosas antes de aceptar la celda:

```
05f2  call 0x48a              ; distancia de combate (la diagonal cuenta 1)
05fb  cmp [bp-0x12], ax ; jg 0x624      → RECHAZA si excede el alcance del arma
0600  cmp [bp-2],0 ; jl / cmp [bp-2],0xb ; jge   → RECHAZA fuera de 0..10 en x
060c  cmp [bp-4],0 ; jl / cmp [bp-4],0xb ; jge   → RECHAZA fuera de 0..10 en y
0618  g_cmb_aim_x/_y = la celda                  → ACEPTA
```

**No hay lectura de tile, ni tabla de opacidad, ni raycast.** Alcance + límites del tablero y
nada más. Y la resolución del disparo (`COMSUBS 0x0a68 @0x0b20`) hace
`call 0x748(aim_x, aim_y)`, que es un **buscador de ocupante** (escanea los 0x20 registros
comparando x/y y devuelve el índice o 0xFFFF) — tampoco mira el terreno.

### 2.2 La tabla 0x6a86 NO es alcanzable desde ningún camino de combate

Esto contradice la cita que hoy lleva el port y conviene dejarlo escrito:

- `0x6a86` aparece **UNA sola vez en todo el desensamblado**: `ULTIMA.EXE.asm 0x5e38
  mov ax,0x6a86`, dentro de `0x5DFE`.
- `0x5DFE` tiene **dos callers**, `0x5bfe` y `0x5cb4`, ambos dentro del flood de visibilidad
  del viewport.

⇒ La afirmación de `combat.ts::isRangedPathClear` («el trazado de proyectil de combate corta
por la tabla de opacidad-de-luz 0x6a86 … la MISMA que el flood del viewport», ticket #44,
main 359c83f1) **no sobrevive a la comprobación del grafo de llamadas**. Sustituyó una
aproximación Clase-D (`rangeWeaponPassable`) por otra atribución no verificada.

### 2.3 Y aunque 0x5DFE FUERA la regla, el port implementa sólo la mitad

`0x5DFE` (leído entero, `ULTIMA.EXE.asm 0x5dfe-0x5e47`) devuelve **1 = transparente** y tiene
DOS ramas:

```
5e01-5e1d   ¿tile ∈ {0x4b, 0x4a, 0xba, 0xbb, 0x98}?   ← los tiles CON VISOR
5e1f          → transparente SÓLO si radial == 1 (adyacente); si no, OPACO
5e2e-5e3c   resto → busca en la tabla 0x6a86 (0x13 = 19 entradas) vía 0x402
```

`visibility.ts` modela las dos ramas (`ALWAYS_OPAQUE` + `WINDOWED_TILES` con la regla
radial-1) — correcto. Pero `combat.ts::isRangedPathClear` consulta **sólo `ALWAYS_OPAQUE`** y
nunca aplica la rama del visor.

**Y esta sala es justo el caso que las separa**: su divisor entero está hecho de tiles con
visor (`0x4b` ×4, `0x98`, `0xbb`) — ninguno está en `ALWAYS_OPAQUE`. Bajo la regla del port
el divisor es transparente a cualquier distancia; bajo `0x5DFE` sería opaco para todo disparo
desde y8-y10 (radial ≫ 1) y la sala quedaría sellada.

---

## 3. Veredicto y cómo comprobarlo

**La VICTORY es alcanzable en el original**: la evidencia del camino de puntería/resolución
(§2.1) no muestra ningún bloqueo por terreno, y la sala está *diseñada* como galería de tiro
— nueve enemigos encerrados tras ventanas y dos puertas cerradas, con la party a salvo al
sur. Disparar a través de las ventanas es la lectura natural de esa geometría. **No hay que
fabricar nada para ganarla.**

**El discriminador que decide el ticket, y que se puede comprobar en el propio run:**

- Si en el run que dio VICTORY **ningún miembro cruzó y4** (todas las bajas por disparo) ⇒
  la VICTORY es FIEL y lo que toca es **re-baselinear el spec** citando este documento. El
  DEADEND anterior era un artefacto del stream RNG viejo (tiradas de disparo fallidas /
  atasco del resolvedor), no un sello estructural.
- Si algún miembro **apareció al norte de y4** ⇒ hay un defecto REAL de pasabilidad o de
  spawn, porque esa mitad no es alcanzable a pie. Eso sí sería fabricación.

Telemetría disponible sin instrumentar nada nuevo: `recordCombatRound` (nav.ts) ya graba
`ax/ay` del actor por ronda — basta mirar si algún `ay < 4`.

## 4. Residual — ★ CERRADO el mismo día ★

**Ya no es residual**: ver `re/notes/proyectil-los-0x6a14-derivacion.md`. Y con dos
correcciones a lo que decía este apartado:

1. **`0x12DE` NO es «la animación»** — lo descarté leyendo sólo su cabecera. **Devuelve un
   valor** y contiene el bucle con el test de terreno. Retirado.
2. **SÍ hay test de terreno** en el vuelo: `COMSUBS 0x142a call 0x5d8e` → kernel **`0x3F6E`**
   → bitmap **`DS 0x6a14`** (bit puesto = atraviesa). No es 0x6a86 ni 0x5DFE.

**El veredicto de §3 NO cambia: se CONFIRMA y pasa de inferencia a prueba.** Los tres tiles
del divisor tienen el bit PUESTO en 0x6a14 (`0x4b` ventana, `0x98` y `0xbb` puertas-con-visor
= la flecha pasa) y `0x4f` muro macizo lo tiene limpio (la para). La galería de tiro es
literal. El discriminador `ay < 4` sigue siendo el modo de cerrar el ticket.

**Ticket que dejo abierto (independiente de esta sala):** la cita de `isRangedPathClear` es
incorrecta y el gap #44 **no está cerrado** — hay que re-derivar qué bloquea (si algo) un
proyectil de combate, y decidir si `WINDOWED_TILES` debe entrar. Afecta al censo de bolsillos
sellados, que comparte esa fuente.

## 5. Evidencia

- `game/assets/maps/combatmaps.json` índice 49 (tiles, units, triggers, playerStarts).
- `game/src/core/dungeon/dungeon.ts:1498` `roomCombatMapIndex`.
- `game/src/core/data/TileData.json` (pasabilidad de 0x44/0x4b/0x4e/0x4f/0x98/0xb0/0xb1/0xbb).
- `re/disasm/COMSUBS.OVL.asm` **0x05c8-0x0621** (cursor de aim: sólo alcance + límites),
  **0x0748** (buscador de ocupante), **0x0a68 @0x0b20** (resolución del disparo),
  **0x12de** (animación del vuelo).
- `re/disasm/ULTIMA.EXE.asm` **0x5dfe-0x5e47** (las dos ramas), **0x5e38** (única mención de
  0x6a86 del binario), **0x5bfe** y **0x5cb4** (los dos únicos callers de 0x5DFE).
- `re/notes/room-triggers.md` (handler COMBAT 0x111A, gate `g_unk_58a1 & 0x82`).
