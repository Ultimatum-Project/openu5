# `cmd_xit` (CMDS.OVL:0x0EB4) — la fragata SE CONSERVA en las TRES ramas de salida

Ficha #270. Pregunta: al botar el esquife en mar abierto, ¿el binario **conserva** el objeto
fragata en el agua, o lo **consume**? Respuesta: **LO CONSERVA**, igual que en la rama de
tierra. El puerto sólo lo modela en la rama de tierra, y el comentario que lo justificaba
queda **REFUTADO** (ver §5).

## 1. La estructura: tres ramas, UNA cola

El despacho por clase de transporte está en 0x0EE8-0x0F11 (`and ax,0xFC` sobre
`g_transport_tile`). La clase 0x24 (fragata, velas ARRIADAS) entra en 0x0F9C. Ahí, tras
imprimir 0x43D2, llama al predicado de tierra adyacente (`land_nearby_pred`, CMDS.OVL:0x073E,
fila sellada — sondea las CUATRO ortogonales de la ventana y devuelve 1 si alguna es tierra) y
bifurca en tres:

| dónde | condición | `[bp-2]` ← | `g_transport_tile` ← | `[bp-8]` ← |
|---|---|---|---|---|
| 0x0FAA | hay tierra | `g_transport_tile` (**la fragata**) | 0x1C (a pie) | esquifes, **sin decrementar** |
| 0x0FC1 | sin tierra · esquifes>0 | `g_transport_tile` (**la fragata**) | `+4` (0x24→0x28, facing intacto) | esquifes **−1** |
| 0x0FDD | sin tierra · esquifes=0 · alfombras>0 | `g_transport_tile` (**la fragata**) | 0x14 (alfombra) | esquifes, **sin decrementar** (salta a 0x0FB5) |
| 0x0FEE | ninguna | — | — | — (imprime 0x43D9 y sale por 0x0ECC) |

**Las tres ramas que salen guardan el MISMO valor en `[bp-2]`: el byte de la fragata.** Y las
tres caen en la MISMA cola, 0x0FF4.

## 2. La cola 0x0FF4 — lo que hace con `[bp-2]`

```
0ff4: call 0x7964          ; → [bp-4] = índice de RANURA
0ffa: mov al, [bp - 2]     ; ⭐ el tile guardado por la rama
0fff: mov si, ax
1001: push si / push si / push g_party_x / push g_party_y / push g_floor
100f: push byte [0x5c5f]   ; el campo +5 del actor (casco, en la convención de #231)
1013: push [bp - 4]        ; la ranura
1016: call 0x7af4          ; ← coloca el objeto
1019: mov bx, [bp-4] · shl bx,3      ; ranura × 8 = desplazamiento en la tabla de actores
1023: mov [bx + 0x5c61], al          ; ⭐ escribe el campo +7 con [bp-8]
```

`0x5C5A` con stride 8 es la tabla de actores del mundo ya documentada en el corpus
(`camp-scene.md:45`, `frontera-infer-acta.md` §Fase 3). `0x5C61 = 0x5C5A + 7` y
`0x5C5F = 0x5C5A + 5`: la cola indexa **esa misma tabla** por la ranura obtenida y le escribe
el campo +7. Eso es evidencia DIRECTA, en el cuerpo, sin resolver ningún `call`.

⇒ **La fragata se emite como objeto del mundo en la casilla de la party, con su casco y sus
esquifes, EN LAS TRES RAMAS.** El argumento no depende de nombrar `0x7af4`: sea lo que sea,
hace lo MISMO para las tres, porque las tres llegan con `[bp-2]` cargado igual. Y la rama de
tierra es justo la que el puerto ya modela como «re-atracar la nave» — luego las otras dos
re-atracan también.

## 3. 🔴 Los `call` de esta cola NO están resueltos, y el atajo da un nombre FALSO

El disasm de CMDS.OVL abarca `0x0000-0x1D0E`; `0x7964`, `0x7AF4`, `0x58D0`, `0x8482`, `0x6980`
y `0x6CCC` son llamadas NEAR **fuera** de ese rango (al kernel). Leerlas como desplazamientos
crudos de `ULTIMA.EXE` produce disparates comprobables: `0x58D0` (que aquí IMPRIME un mensaje)
caería dentro de `viewport_compose_11x11`, y `0x6CCC` (un test de casilla) dentro de
`combat_spawn_encounter`; `0x7AF4` y `0x8482` ni siquiera tienen fila (el kernel llega a
0x76B4). Es la familia #110/#81: **sin el mapa acreditado, el nombre que sale del atajo es de
OTRO sujeto.** Por eso arriba se nombran por su ROL leído en el cuerpo, no por el ledger, y el
veredicto se apoya sólo en evidencia in-body.

## 4. La contabilidad de esquifes va AL OBJETO, no al jugador

`[bp-8]` es lo que acaba en el campo +7 del objeto creado:
- tierra → **todos** los esquifes (0x0FB5, sin `dec`);
- esquife → **esquifes − 1** (0x0FCF `dec al`): el que te llevas puesto;
- alfombra → **todos** los esquifes, y lo que se decrementa es `g_carpets` (0x0FDD).

Es decir: el original **mueve el inventario de la nave a la nave amarrada**. Familia #231
(casco y esquifes son del OBJETO, no estado global del jugador).

## 5. Careo con el puerto — DOS divergencias y un comentario refutado

`game/src/core/world/transport.ts::exitTransport`, rama `TILE_FRIGATE_SAILS_DOWN`:

| rama | binario | puerto | veredicto |
|---|---|---|---|
| tierra | emite objeto fragata | `parkedShipTile: transport` | **FIEL** |
| esquife | emite objeto fragata | `transportTile: transport + 4`, **sin** `parkedShipTile` | **DIVERGE** — la fragata se evapora |
| alfombra | emite objeto fragata | `transportTile: TILE_CARPET`, **sin** `parkedShipTile` | **DIVERGE** — ídem |

Y el docblock de `game/src/core/game.ts` sobre el bloque de re-atraque afirma: «Sólo la rama
fragata→tierra fija `parkedShipTile` (skiff/alfombra convierten el vehículo activo, no dejan
nave)». La segunda mitad —el paréntesis, que es la que da la RAZÓN— **es falsa**: en el binario
las tres dejan nave. La frase se escribió sin cita porque no había derivación; ésta es.

Esto explica el fotograma 11 del vídeo del usuario (#264): X-it en mar abierto → el barco
desaparece. No era render ni importación: es esta rama.

## 6. Cabo NUEVO, sin adjudicar: `[bp-8]` sin inicializar en las ramas NO navales

`[bp-8]` tiene **un solo escritor** en toda la rutina (0x0FD1), alcanzable **sólo** desde las
ramas de la fragata. Llegan a la cola 0x0FF4 sin pasar por él:

- caballo (0x0F60 → 0x0F43 → 0x0FF4),
- alfombra sobre tierra (0x0F20 → 0x0F38-0x0F48),
- esquife → tierra (0x0F90 → 0x0F6C → 0x0F43 → 0x0FF4),
- y el `default` de clase (0x0F11), que además llega con `[bp-2]` **tampoco** escrito.

`sub sp,8` no limpia el marco ⇒ esas cuatro rutas escriben **pila sin inicializar** en
`slot·8 + 0x5C61`. ~~Y ese campo no es indiferente: `frontera-infer-acta.md` §Fase 3 lo
describe inicializado a **0xFF** por el asignador de ranura, y §Fase 4 documenta una limpieza
de **enlaces huérfanos** que lo usa como índice. Escribir basura ahí es escribir en un campo
de enlace.~~ **CORREGIDO por #273** ([xit-pila-273.md](xit-pila-273.md) §3): para un objeto
de transporte del SOBREMUNDO el +7 **no es un campo de enlace** — la semántica de enlace es
de los actores de small-map/combate; el +7 del aparcado no-naval no tiene ningún lector en
el sobremundo (censo de los 18 accesos a 0x5C61 en los 28 disasm).

~~🔴 Dos cautelas, las dos por escrito: (a) **no he medido la alcanzabilidad** — puede que el
asignador re-escriba +7 después, o que ninguna partida real llegue al `default`; (b) hay una
**contradicción de corpus abierta** sobre qué ES el campo +7 — «esquifes» (#231 y el puerto)
frente a «enlace, centinela 0xFF» (`frontera-infer-acta` §Fase 3). Pueden ser el mismo byte
con dos semánticas por CLASE de objeto, que es la familia de «el atributo con el nombre de mi
concepto puede ser de otro sujeto», pero **no lo adjudico aquí**: hace falta leer el asignador
de ranura con el mapa resuelto (§3).~~ **RESUELTAS las dos por #273** (`xit-pila-273.md`):
(a) el `default` es inalcanzable salvo corrupción (§1) y el +7 basura de los otros tres no lo
re-escribe nadie — pero tampoco lo LEE nadie en el sobremundo (§4), solo viaja en el `.GAM`;
(b) adjudicada: el +7 es **polimórfico por clase** — esquifes (fragata), contador de deriva
(clase 0x2C), enlace 0xFF (actores) — las dos notas eran ciertas cada una de su sujeto (§3).

## 7. Qué habilita esto

El bloqueo que declaró #264 sobre la desaparición (f11) queda **levantado por derivación**: no
era decisión de modelo, era una rama sin derivar. El arreglo es fijar el equivalente de
`parkedShipTile` en las ramas de esquife y alfombra de `exitTransport`, con los esquifes que
van al objeto según §4, y reescribir el comentario de `game.ts` citando esta nota.

**No lo arreglo en esta entrega**: el encargo era derivar. El fix toca `transport.ts`, que es
mecánica de estado — va con su propia guarda y su careo de la contabilidad de §4.
