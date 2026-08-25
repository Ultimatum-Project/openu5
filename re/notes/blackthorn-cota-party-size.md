# La cota del roster en el flujo de Blackthorn — DERIVADA: el port ya es fiel

Ficha #41-bis. Encargo: `blackthorn.ts` usa `state.partySize ?? state.characters.length` y
nadie había leído su ASM; la sospecha era que fuera la ficha #41 (la trampa de cofre que
barría el ROSTER en vez del GRUPO) repetida en otro sitio. **No lo es.** Derivado y MEDIDO
sobre `BLCKTHRN.OVL.asm` y `ULTIMA.EXE.asm`: los seis sitios del port son correctos y **no
se toca nada**.

## 1. El patrón del binario en este flujo — MEDIDO, cinco bucles

Los cinco bucles que recorren el roster en este flujo tienen la **misma forma**, y la cota
es `g_party_size` (`DS:0x585b`) **a secas**:

    kernel 0x39fc  party_conscious_state        (ULTIMA.EXE)
      3a0e: mov al,[g_party_size] / 3a13: or ax,ax / 3a15: je 0x3a5e   <- 0 => ni entra
      3a17: mov [bp-8],ax        ; el LÍMITE
      3a1a: mov di,0x55b3        ; base del roster
      3a26: mov cl,[di] ... 3a28: cmp cl,0x47 ('G') / 3a2d: cmp cl,0x50 ('P') -> 0
                              3a44: cmp cl,0x53 ('S') / 3a49: inc dx
      3a4a: add di,0x20 / 3a4d: inc si / 3a50: cmp ax,[bp-8] / 3a53: jb 0x3a26
      salida: 3a5e: cmp [bp-6],0 -> 3a64: ax=1 (había dormidos) | 3a6a: ax=0xffff (-1)

    BLCKTHRN 0x0438  sacrifice_member
      0438: mov al,[g_party_size] / 043d: or ax,ax / 043f: je 0x46c / 0441: mov di,ax
      044c: cmp byte [si],0x44 ('D') / 0451: inc cx / 0452: cmp cx,2 -> víctima
      0460: add si,0x20 / 0463: inc dx / 0466: cmp ax,di / 0468: jae
      04d4: dec byte [g_party_size]          <- y DECREMENTA la cota

    BLCKTHRN 0x0620  count_living
      0620: mov al,[g_party_size] / 0625: or ax,ax / 0627: je 0x64a / 0629: mov di,ax
      0634: cmp byte [si],0x44 / 0639: inc dx / 063a: add si,0x20 / 063d: inc cx
      063e: mov ax,cx / 0640: cmp ax,di / 0642: jne 0x634

    BLCKTHRN 0x0b54..0x0baa  party_refuge
      0b54: mov al,[g_party_size] / 0b59: or ax,ax / 0b5b: je 0xbb6
      0baa: mov al,[g_party_size] / 0baf: cmp si,ax / 0bb1: jb 0xb68

**En NINGUNO de los cinco hay un `cmp si,6`.** La única cota es `g_party_size`, más un
early-out `or ax,ax / je` para el caso 0.

## 2. Por qué NO es la ficha #41 — el binario mismo usa DOS convenciones

Esto es lo que hay que retener, porque invita al error contrario:

| | cota en el binario |
|---|---|
| trampa de cofre — BOMB 0x2aa8, GAS 0x3054 | `g_party_size` **Y** `cmp si,6` (@0x2ada / @0x3062) |
| blackthorn + kernel 0x39fc (los 5 de arriba) | `g_party_size` **y nada más** |

Las dos convenciones vivas del port (`min(partySize,6)` en `hazards.ts` / `partySize` en
`blackthorn.ts`) **no son una incoherencia que haya que unificar: son el reflejo fiel de dos
familias de bucles distintas del original**. Unificarlas rompería una de las dos:

- meter el `6` en blackthorn = inventar un tope que el binario no tiene;
- quitarlo de las trampas = perder el `cmp si,6`, que ahí sí existe.

⇒ **La coherencia que hay que perseguir es con el ASM de CADA rutina, no entre ficheros del
port.** (En #41 el `6` de las trampas es real: el roster del original son SEIS ranuras de
0x20 B desde `DS:0x55b3`, y esos bucles lo recorren entero filtrando por `g_party_size`.)

## 3. El `?? characters.length` — inerte, no divergencia

`partySize` está declarado **no opcional** (`partySize: number`, `state.ts:146` y `:406`) y
el validador de estado exige `1 <= partySize <= characters.length` (`state.ts:548-552`). El
`??` sólo dispararía con `partySize === undefined`, que es un estado que el validador
rechaza. Es código defensivo **inalcanzable**, no una cota alternativa viva. Nótese además
que `0` no es nullish: con `partySize === 0` el `??` NO dispara y el bucle no entra — que es
exactamente el `or ax,ax / je` del asm.

Los seis sitios (`blackthorn.ts:84,272,448,486` · `blackthorn-capture.ts:368` y el
`state.partySize = max(0, n-1)` de `:287`, que es el `dec [g_party_size]` @0x04d4) usan todos
la misma `n`, y **no queda ningún recorrido del roster sin acotar** en los dos ficheros
(censado con grep sobre `characters.length|forEach|map|filter|some|every|find|slice`).

## 4. Lo único que sí chirría: una PROSA que dice más que el código

`partyRefuge` está bien acotado (`i < n`), pero su prosa dice otra cosa:

- el docblock: «currentHp := maxHp para **TODOS los miembros**»
- `RefugeResult.revived`: «Miembros revividos (**todos los del roster**)»

El código —y el binario @0x0b54— recorren `g_party_size`, no el roster. Con roster de 16 y
grupo de 6, «todos los del roster» es sencillamente falso. No lo he tocado porque el encargo
era derivar, y porque es una corrección de PROSA sin cambio de comportamiento: si el lead
quiere, va en un commit aparte y no necesita gate de sellos.

## 5. Veredicto

**Sin fix.** El port es fiel en los seis sitios. No hay failing-first que escribir porque no
hay defecto que reproducir — y un test que fijara `min(partySize,6)` aquí estaría fijando
una coincidencia falsa ([[no-fijes-una-coincidencia-como-invariante]]).
