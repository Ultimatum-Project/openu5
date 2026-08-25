# In Quas Xen (idx 38) — derivación completa y los cinco cruces resueltos (ficha #340)

Sujeto: el BINARIO. Continúa y **corrige** `hechizos-inertes-319.md §5-bis`, que dejó el
hechizo como PARCIAL con «tres cruces sin resolver». Son **cinco**, y están los cinco
resueltos aquí. Rutina: `in_quas_xen_clone_creature`, **CAST.OVL:0x0b28 → `ret` en 0x0c97**.

## 0. 🔴 La lectura de #319 se cortó a media rutina, y por eso su veredicto de RNG es falso

El acta de #319 declara «91 filas, `ret` en `0x0c01`». **`0x0c01` no es un `ret`**: es
`lea di, [bx + 0x5c5a]`, a media rutina. El cuerpo entero son **154 filas** (0x0b28-0x0c97,
prólogo `push bp` de la siguiente en 0x0c98).

Lo que delata el corte con aritmética, no con opinión: el censo de llamadas del acta son
**cuatro**, y cuatro son EXACTAMENTE las que caben en 0x0b28-0x0c01. El cuerpo completo
tiene **seis**. Las dos que faltaban (`0xffffbf16` y `0xffffbdf6`) son las que deciden el
veredicto de stream.

⇒ Su «RNG: ninguna llamada DIRECTA a `rand_range` en las 91 filas» es cierto **del tramo**
y engañoso **de la rutina**: no hay llamada directa en ningún punto, pero el tramo no leído
llama al picker de tablero, que sí tira. Familia de
`leido-completo-es-verdad-del-tramo-y-falso-de-la-fila`: la aritmética (`fin − inicio` vs
el `ret` real) es el control que faltaba.

## 1. Los CINCO cruces, resueltos con `dispatch_table`

Base near-call de CAST.OVL = `0xbf80` (`overlay_near_call_base`), y
`resuelto = (destino + base) mod 0x10000` (§LA FÓRMULA de #319, con su envolvimiento):

| en CAST.OVL | kernel | destino | qué es |
|---|---|---|---|
| `call 0x58d0` | `0x1850` | — (kernel) | **print string** → emite DS `0x45dc` |
| `call 0xffffc1c2` | `0x8142` | stub → COMSUBS.OVL:`0x0504` | **cursor de apuntado** |
| `call 0xffffc186` | `0x8106` | stub → CAST2.OVL:`0x0000` | jingle 7 |
| `call 0xffffc1ce` | `0x814e` | stub → COMSUBS.OVL:`0x0748` | busca actor en (x,y) |
| `call 0xffffbf16` | `0x7e96` | stub → COMBAT.OVL:`0x120e` | **picker de tablero** |
| `call 0xffffbdf6` | `0x7d76` | stub → COMBAT.OVL:`0x0000` | test de celda libre |

**CUATRO CONTROLES POSITIVOS**, cada uno acreditado por una vía ajena a esta aritmética:

| control | resuelve a | quién lo acredita aparte | |
|---|---|---|---|
| `0xffffc186` (jingle) | CAST2.OVL:`0x0000` | el propio #319 §2-quater: despachador de jingle | ✓ |
| `0x58d0` | kernel `0x1850` | #319 §2-quinquies ya llamaba `0x1850` print string | ✓ |
| `0xffff89bc` (desde COMBAT) | kernel `0x2c4c` | ficha #18: `kernel_tile_passable` | ✓ |
| `0xffff981e` (desde COMBAT) | kernel `0x3aae` | `combat-exact.test.ts:52`: es `rand0` | ✓ |

Los dos últimos usan la base de **COMBAT.OVL** (`0xa290`), así que acreditan la segunda
banda además de la primera.

**Cadena:** DS `0x45dc` → DATA.OVL fileoff `0x45ec` = **`"Creature: "`**. Corroboración por
vía ajena al trampolín, la misma que usó #319 para In Wis/An Grav: la cadena siguiente en
DATA.OVL es `"To phase: "`, la de Vas Rel Por (ficha #341) — los prompts de los dos
hechizos del bloque son contiguos.

## 2. 🔴 El `0xf` NO es un predicado sobre el lanzador

#319 §5-bis lo lee como «guarda 1 — el actor lanzador no cumple el predicado `0xf`».
**Falso.** `COMSUBS.OVL:0x0504` (`ret 4`, args `bp+6`=`g_cmb_actor`, `bp+4`=`0xf`):

- pone `g_cmb_aim_active` = 1 al entrar y 0 al salir (`0x050c` / `0x0726`);
- corre un bucle de `getkey` (`call 0x448c`) con flechas (1..4 y extendidas `0xd3`-`0xd6`),
  acotando el cursor a `0 ≤ v < 0xb` — la reja 11×11 de la arena;
- `0xf` es el **ALCANCE máximo** que compara contra su helper de distancia `0x048a`, que es
  una **raíz entera** (bucle de sumas de impares en `0x04b8`-`0x04bf`);
- **devolver 0 es ESC** (`0x06ea` pone `[bp-0xc]=1`; el epílogo `0x0731` imprime `\n` y hace
  `sub ax,ax`). Enter/espacio/`A` confirman.

⇒ El brazo `or ax,ax / jne` de `0x0b44` distingue **«el jugador canceló»**, no un fallo del
hechizo. Y con alcance 15 sobre reja 11×11 **la cota no puede rechazar jamás**: la distancia
máxima del tablero es ⌊√(10²+10²)⌋ = 14.

★★ La lección de #319 §2-quinquies-bis aplicada a su propio texto: leer «`0xf`» como un
predicado plausible sobre el actor encaja con el código que se ve, y aun así es falso. Lo
que decide es abrir el callee.

## 3. La secuencia completa

```
0b30  print "Creature: "                     ; DS 0x45dc
0b41  cursor de apuntado(actor, alcance 15)  ; COMSUBS:0x0504
      └─ 0 (ESC) → ret -1, SIN efecto        ; 0x0b48
0b52  jingle 7                               ; CAST2:0x0000
0b5f  idx = actor_en(aim_x, aim_y)           ; COMSUBS:0x0748
      └─ idx < 0 → [bp-6]=0 y sale EN SILENCIO ; jge de 0x0b67
0b82  busca ranura libre de POOL  (0x5c5a, paso 8, 32)
0ba3  busca ranura libre de ACTOR (0xba16, paso 8, 32)
0bdd  movsw×4  registro de ACTOR del objetivo → ranura nueva (base 0xba14)
0c09  movsw×4  registro de POOL  del objetivo → ranura nueva (base 0x5c5a)
0c2f  BUCLE SIN COTA:
        randomBoardCell()                    ; COMBAT:0x120e — 2 rand0(15) SIEMPRE
        if fuera de reja (>10) → re-tira
        test de celda libre(0x1c, x, y)      ; COMBAT:0x0000 — 1 = LIBRE
        if ocupada → re-tira
0c6e  escribe x,y en los DOS registros del clon
0c97  ret 1
```

`COMSUBS.OVL:0x0748` barre las 32 ranuras comparando `byte[0xba1a+i*8]`/`[0xba1b+i*8]` con
la coordenada apuntada; devuelve el índice o `0xffff`.

`COMBAT.OVL:0x0000` (`ret 6`) devuelve **1 = celda admisible** (barrido completo sin
bloqueador, `0x00f6` → `0x0020`) y **0 = bloqueada**. Fuera de `0..10` también devuelve 1,
pero ese caso no le llega: el picker ya filtra.

## 4. MUEVE STREAM, y el cardinal NO está acotado

`COMBAT.OVL:0x120e` tira `rand0(0xf)` **dos veces siempre** (`call 0xffff981e` ×2 → kernel
`0x3aae` → `rand_range(0, n)` en `0x2092`) y rechaza si alguna sale > 10.

El bucle del hechizo **no lleva contador de intentos** — a diferencia del retry-8 del summon
(`SUMMON_MAX_ATTEMPTS`). El salto de vuelta es `or si,si / je 0xc2f` en `0x0c88`, sin cota.

⇒ **2 tiradas por intento, número de intentos no acotado.** Aquí sólo se acredita QUE
consume; el cardinal por lanzamiento **no es constante y no se estima** (familia #31/#101).
Medido en el port con tres semillas: 4, 20 y 4 tiradas — la de 20 son **10 intentos**, por
encima del tope 8 del summon.

La copia **no pasa por `kernel_spawn_actor`**, así que el clon **no gasta** el `rand0(7)` de
velocidad que sí gasta un spawn: por eso el total de tiradas es siempre PAR.

## 5. Qué es el clon

Una **copia del registro del OBJETIVO**, no una criatura nueva ni una imagen del lanzador:
dos `movsw`×4 duplican los 8 bytes del registro de actor y los 8 del registro de pool. El
byte +2 viaja en la copia, **bit de bando incluido** (`0x01` = bando party, según la cita de
`castSummon`), de modo que el clon queda en el bando del clonado.

## 6. Lo que queda SIN derivar (declarado)

- **El filtro de ranura de `COMSUBS.OVL:0x0748`** (`0x0791`-`0x07a2`): exige
  `byte[0x5c5b + slot*8] != 0xf4`, `(al & 0xc0) != 0`, `(al & 0x20) == 0` y `(al & 0x04) != 0`
  sobre `al = byte[0xba16 + i*8]`. **No decodificado.** El bit de bando (`0x01`) NO aparece
  en él, así que **no se puede afirmar si el original deja apuntar a un miembro del grupo**.
  El port clona sólo lo que tiene `enemyDef` y lo declara.
- **Lectura de pila sin inicializar (defecto del original, alcanzabilidad NO medida):** si el
  barrido de pool o el de actor agotan las 32 ranuras, los brazos `0x0b98` y `0x0bb9`
  devuelven `[bp-6]` **sin haberlo escrito nunca** en ese camino (sólo se escribe en `0x0b69`,
  que es la otra rama, y en `0x0c8c`). Familia del cabo #273. Requiere el pool lleno.
- **El cuelgue del bucle sin cota:** si ninguna celda del tablero admite a la criatura, el
  original gira para siempre tirando dados. El port lo evita con una comprobación previa que
  **no existe en el binario** y que no consume RNG (declarada en `castIllusion`).

## 7. Port

Cableado en `game/src/core/combat/combat.ts` (`castIllusion`, consumido por `playerCast`),
con el cursor de apuntado abierto desde `main.ts` como hace el binario. Antes de esto
`{ kind: "illusion" }` era uno de los cinco huérfanos del censo de #278/#319: producido y
sin consumidor. Tests: `game/tests/illusion-quas-xen-340.test.ts` (6, con celda y cuenta de
tiradas en crudo por replay independiente; 4 mutantes muertos).
