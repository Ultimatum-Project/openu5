# #223 — el consumo del FLAG, verificado; y el cableado NO es tan barato como decía la tarjeta

La ficha daba la derivación por «cerrada al 100%» y el cableado por casi gratis. Lo primero es
cierto y ahora está además **verificado en su tramo clave**; lo segundo **no se sostiene**, y
por una razón que hay que corregir antes de que alguien cablee.

## 1. Cómo se consume el FLAG (leído, no supuesto)

La ficha daba la matriz que produce el FLAG en `[bp-2]` y el veredicto de pasabilidad, pero no
el tramo que los une. Leído entero:

```
0288: mov si, [bp+4] / shl si,5
028f: mov bx, [bp+6]
0292: mov al, [bx+si-0x5459]     ; tile de DESTINO
0298: mov [bp-6], ax
029b: cmp word ptr [bp-2], 0
029f: je 0x2b4                   ; ★ sin objeto-candidato ⇒ salta al ax=0
02a1: mov al, [g_transport_tile] / push
02a5: push word ptr [bp-6]
02a8: call …                     ; → ULTIMA.EXE 0x2C4C (la rutina de clase de #48)
02ab: or ax, ax / je 0x2b4       ; veredicto 0 ⇒ ax=0
02af: mov ax, 1
02b4: sub ax, ax                 ; (la otra rama)
02b6: mov [bp-2], ax
02b9: or ax, ax / je 0x2c0
02bd: jmp 0x34a                  ; ★ BLOQUEADO
```

⇒ **Bloquea si y sólo si hay objeto-candidato Y el veredicto de 0x2C4C sobre el tile de
destino es distinto de cero.** Los dos `je 0x2b4` son las dos puertas: cualquiera de ellas
abierta deja `ax=0` y el movimiento sigue. Esto confirma al pie de la letra el aviso de la
ficha —«NO cablear un bloqueo plano si hay objeto»— y ahora con la cadena de saltos delante.

Y tiene sentido físico: lo que el objeto bloquea es una casilla **por la que si no
navegarías**. Donde el tile ya es impasable, el bloqueo lo resuelve `ship_try_move` por sus
otras salidas (atraque, colisión, breakup).

## 2. ★ La corrección: `objectOrNpcAt` NO es el equivalente de `find_object_at_xy`

La ficha decía que «las DOS piezas ya existen» y que sólo faltaba llamar al buscador y escribir
la matriz. **La primera pieza no está.**

`game.ts:2551` — `objectOrNpcAt(x, y, floor): boolean`. Devuelve **si hay ocupante**, no
**cuál**. Recorre `state.worldObjects` con un `.some(...)` y añade el NPC.

Pero la matriz de la ficha **entra toda por el TIPO** del objeto: bandas `[0x24,0x2C)` y
`[0x24,0x28)`, más `== 0x1B` y `(tipo & 0xFE) == 0x10`. Con un booleano no se puede evaluar
ni una sola de sus ramas.

⇒ Cablear con lo que hay obligaría exactamente al **bloqueo plano** que la propia ficha
prohíbe. Lo que falta no es «(a) llamar + (b) escribir la matriz», sino, antes de las dos, un
buscador que **devuelva el tipo** y —esto es lo que hay que medir— la **correspondencia** entre
los códigos de tipo del binario y lo que guardan los registros de `worldObjects` del port. Esa
correspondencia **no está verificada**, y es justo donde se fabrica sin querer.

## 3. Estado

- Derivación del binario: **completa** (matriz de la ficha + el tramo de §1).
- Cableado: **BLOQUEADO por una precondición nueva**, no por la ventana e2e — hace falta el
  buscador por tipo y el careo de códigos.
- Cuando se cablee sigue en pie el aviso de la ficha: cambia dónde puede navegar la nave,
  reordena rutas del tour y por tanto entra en la lista de re-sello de #222.
