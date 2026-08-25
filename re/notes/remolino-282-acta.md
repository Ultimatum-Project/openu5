# La nave NO entra en la casilla del remolino — `ship_try_move` resuelve el ACTOR antes que el terreno

Ficha #282. Sujeto: **el binario** (MAINOUT `ship_try_move` 0x01FE, su llamador
`outdoor_move` 0x0514, y el turno del remolino 0x1248). Cuerpos leídos enteros.

## 0. La premisa del encargo, corregida

El encargo relayado decía: «el original: la nave que toca el remolino **ENTRA** en su
casilla (teleport al Underworld / daño / consumo de turnos)». **Es la lectura invertida
del título de la ficha.** El título («la nave ENTRA en la casilla del remolino») describe
**lo que hace EL PORT**, que es el defecto; el docblock del que salió la ficha
(`transport.ts`) ya lo decía con todas las letras: «un VEHÍCULO que empuja contra un
remolino **se bloquea SIN mensaje**… hoy la nave ENTRA en la casilla del remolino».

Medido en el binario (§1): **el original BLOQUEA, y en silencio.** El teleport al
Underworld existe, pero es del **turno del remolino** (§3), no del intento de paso — y el
port ya lo tenía portado. Lo que faltaba era exactamente el bloqueo.

## 1. `ship_try_move` (MAINOUT 0x01FE) es EL resolvedor de destino, y corre SIEMPRE

Censo de llamadores: `grep -n 'call 0x1fe' MAINOUT.OVL.asm` → **UNO**, en `0x0514`. Y las
cuatro ramas de dirección de `outdoor_move` convergen en `0x050e` (push de las dos
coordenadas) antes de llamar. ⇒ **no es un helper para «tiles especiales»: se invoca en
cada paso al aire libre**, y lee el terreno él mismo en `0x0292`.

Esto refuta de paso la frase del docblock del port «NO decide passability: el caller solo
la invoca para tiles especiales o no navegables» — cierta del PORT, falsa del binario.
Esa asimetría es justamente la causa del defecto (§4).

## 2. El actor manda sobre el terreno — `[bp-2]` entra valiendo 1

```
01fe: push bp …
0215: c746fe0100   mov word ptr [bp-2], 1      ; ← DEFAULT: «se mueve»
0230: a09558       mov al, [g_floor]
0236: e885b2       call 0xffffb4be              ; find_object_at_xy(x,y,floor) → tile del actor
0239: 8946fc       mov word ptr [bp-4], ax
023c: 0bc0         or ax, ax
023e: 7448         je 0x288                     ; 0 = no hay actor → sigue por terreno
0240: c746fe0000   mov word ptr [bp-2], 0       ; ← HAY actor: el paso falla POR DEFECTO
0245..0283         (ventana de ABORDAJE: sólo un transporte abordable devuelve [bp-2]=1)
029b: 837efe00     cmp word ptr [bp-2], 0
029f: 7413         je 0x2b4                     ; con actor no abordable, el test de
02a1..02a8         terreno (call 0xffffaa7c) NI SE LLAMA
02bb: 7403         je 0x2c0                     ; → cae a la cola de choque/bloqueo
```

⇒ **cualquier actor no abordable bloquea el paso sea cual sea el terreno.** El centinela
de «no hay actor» es el 0 (0x023c).

La ventana de abordaje (0x0245-0x0283), por modo del jugador `t = g_transport_tile`:

| régimen | rama | abordable |
|---|---|---|
| `t ≥ 0x30` **o** `t < 0x20` (a pie / montura / alfombra) | 0x0253 | `0x24 ≤ a < 0x2c` (fragata, esquife) · `a == 0x1b` (caballo) · `(a & 0xFE) == 0x10` (alfombra) |
| `0x20 ≤ t < 0x28` (FRAGATA) | 0x0270 `jb 0x288` | **nada** |
| `0x28 ≤ t < 0x30` (ESQUIFE) | 0x0277-0x0281 | sólo `0x24 ≤ a < 0x28` (volver a la fragata) |

Nótese que `0x2c` queda FUERA por un byte: la **nave pirata** (clase 0x2C) no se aborda.

## 3. La cola de bloqueo y su ÚNICA salida muda

```
0312: 803e7c5820   cmp byte ptr [g_transport_tile], 0x20
0317: 7209         jb 0x322                     ; A PIE → «Blocked!» normal
0319: 8a46fc       mov al, byte ptr [bp-4]      ; tile del actor del destino
031c: 24fc         and al, 0xfc
031e: 3cec         cmp al, 0xec                 ; ¿REMOLINO?
0320: 7428         je 0x34a                     ; ← al EPÍLOGO: ni print ni beep
0322: b8ae29       mov ax, 0x29ae               ; «Blocked!» (DS 0x29ae)
…
033c: b8a500       …                            ; beep(0xa5,0xc8)
034a: 8b46fe       mov ax, word ptr [bp-2]      ; devuelve 0 ⇒ NO avanza
```

El `je 0x320` salta **por delante** del print Y del beep. Y está guardado por el umbral de
vehículo de 0x0312: **a pie el remolino no tiene salida propia** y cae al «Blocked!»
normal. Cero llamadas entre 0x0312 y 0x034a ⇒ **el camino mudo no consume RNG**.

Esta rama sólo se alcanza con `g_sail_dir == 0` (0x02c0 `je 0x312`). **NAVEGANDO** el
mismo bloqueo por actor cae en 0x02c7, donde se ramifica por el TERRENO: agua profunda no
es 3 ni 0x47 ⇒ **«COLLISION!» + `damage_ship` rand(1,30)**.

## 4. El turno del remolino (0x1248) — lo que el port YA tenía

`monster_hits_special_tile`: si el actor es del grupo 0xEC (0x125a, mismo gate), se BORRA
de la tabla (0x1277/0x127b), imprime `"\nWHIRLPOOL!\n"` (DS 0x6b04, 0x127f), pone
`g_transport_tile=0xEC` para la animación y lo RESTAURA (0x1289/0x12ac), llama
`damage_ship` (0x12af) y teletransporta: `g_floor=0xFF`, `g_party_x=0x22`,
`g_party_y=0x12` (0x12b2-0x12bc). ~~Todo eso ya estaba portado (`whirlpoolRelocate` +
`hazards.ts`, cableado en `game.ts`).~~ **La ficha no lo tocó.**
[CORREGIDO por careo-fragata, 20-08: «todo portado» era FALSO para el `damage_ship`
de 0x12af — `whirlpoolRelocate` sólo escribe posición y nadie llamaba al daño
(refutado JUGANDO: hull 99 intacto tras la succión; el testigo de #343 midió 99→75).
Mensaje/teleport/borrado sí estaban. Portado en careo-fragata-343.md §2-bis.]

## 5. Lo medido en el PORT, y el fix

`resolveNavalStep` (game.ts) cortocircuitaba con `isPassable(destTile, transport)` y sólo
llamaba a `shipTryMove` cuando el terreno NO era navegable. Un remolino se posa sobre agua
profunda —navegable— ⇒ la rama de bloqueo **era inalcanzable para él**. Censo de consultas
de ocupación en la vía de movimiento antes del fix: **cero** (`npcAtTarget` devuelve null
con `location===0`, y nadie consultaba `overworldEnemies` al mover).

Consecuencia jugable: el jugador podía **empujar la nave contra el remolino y meterse él
solo en el Underworld** — en 1988 eso no se puede provocar; el remolino tiene que
alcanzarte.

Fix: `isBoardableActorTile()` (§2 transcrito) + parámetro `actorTile` en `shipTryMove` +
outcome `blocked-silent`; y en `resolveNavalStep` la consulta del actor va **DELANTE** del
atajo de `isPassable`, como en el binario.

## 6. Alcance — lo que este fix NO hace

- **Sólo la vía NAVAL.** El bloque 0x0312 lo comparten pie y barco (el discriminante es
  0x0312 mismo); la vía a pie del sobremundo (`resolveStep`) sigue **sin** consultar la
  ocupación por actores del exterior. Es la otra mitad del mismo bloque del binario y
  queda como ficha aparte (§7).
- No toca el turno del remolino (§4), ya portado.
- No toca combate: los actores siguen iniciándolo al alcanzar a la party.

## 7. Cabos para el lead (fuera de alcance, medidos)

1. **La vía A PIE del sobremundo no modela ocupación** — mismo bloque MAINOUT
   0x0312-0x0347, rama `jb 0x322`. Hoy la party a pie atraviesa la casilla de un actor
   del exterior. Ficha nueva.
2. **Bajo VELA, chocar con un actor cuesta casco** (§3, «COLLISION!» + rand(1,30)). El fix
   habilita esa rama por primera vez en el port: es **la** tirada de RNG que este cambio
   puede añadir. Ver §8.

## 8. Stream

- El camino del remolino (el de la ficha) es **MUDO y sin RNG** (§3): cero tiradas.
- Pero el fix **cambia si la party avanza o no**, y el sorteo de aparición del sobremundo
  depende de la POSICIÓN (#31). ⇒ **MUEVE STREAM** por vía indirecta.
- Y añade una tirada `rand(1,30)` **nueva** en el caso «navegando contra un actor»
  (COLLISION), que antes no se alcanzaba.

⇒ Se entrega **con ventana de sellos declarada**.

## 9. Testigo empírico (#343, 20-08)

La derivación de esta acta era de LECTURA. El binario VIVO la confirmó letra a
letra — bloqueo sin avance con retorno 0, camino 0x0322 jamás ejecutado en el
empuje (con control positivo del BP a pie), y reubicación por el TURNO del
remolino a `g_floor=0xFF`, (0x22,0x12) con WHIRLPOOL! y daño de casco:
[testigo-remolino-343.md](testigo-remolino-343.md)
(`re/tools/whirlpool_witness_probe.py`).
