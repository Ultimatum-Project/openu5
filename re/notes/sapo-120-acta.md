# #120 (2ª mitad) — Lectura de los flujos «hueco en rutina portada»

Precondición cumplida por el lead: el **defecto E ya está arreglado y re-censado** (main
`f3c6dbd5`), así que la población a leer bajó de 41 a **38** (las 3 del santuario salieron
al reclasificarse como emisión por plantilla). Este acta cubre la **primera lectura
completa** y deja el método montado para el resto.

## 1. El puente: el port cita los offsets del ASM

No hace falta adivinar qué función portada corresponde a cada rutina emisora: **el port se
cita a sí mismo**. Indexando los comentarios de `game/src/**/*.ts` por `OVERLAY + 0xoffset`
y cruzando con el `rutina` que devuelve `orphan_emitters --hermanos`, 18 de las 19 rutinas
con huérfanas dentro tienen su función portada localizada por cita propia. Ejemplos:
`SJOG 0x646` → `dungeon.ts:78`; `SJOG 0x1458` → `items.ts:30`/`search.ts:83`;
`CMDS 0x7f6` → `transport.ts:442`; `SJOG 0x1bb2` → `combat.ts:2560`.

Es barato, es re-ejecutable y convierte «leer 38 flujos» en «abrir 19 funciones concretas».

## 2. ★ Hallazgo verificado: la guarda de cabecera de `SJOG 0x1bb2`

**Cadena:** `'\nStay with ship!\n'` (DS 0x8e76). **No es un mensaje suelto: es una GUARDA de
mecánica**, y el port no la tiene.

### 2.1 El original

```
1bb2: push bp / mov bp,sp
1bb5: mov al, byte ptr [g_transport_tile]
1bb8: and al, 0xf8
1bba: cmp al, 0x20
1bbc: jne 0x1bca                      ; ← si NO es 0x20-0x27, sigue el flujo normal
1bbe: mov ax, 0x8e76                  ; "\nStay with ship!\n"
1bc1: push ax
1bc2: call 0x58d0                     ; print_string (kernel 0x1850)
1bc5: sub ax, ax                      ; ★ RETORNA 0
1bc7: jmp 0x1c52                      ;   = salida DENEGADA
```

`g_transport_tile` **no es un índice de `TileData`** sino un código de transporte; el ledger
lo tiene documentado (`re/ledger/globals.json`, addr 22652). El `and 0xf8` recorta a
**0x20-0x27**.

> ⚠ **RECTIFICACIÓN (2026-07-29, carril calcados-lote / #129).** Esta sección decía
> «0x20-0x27 = **barco + esquife**», copiando la `meaning` del ledger de entonces
> («0x20-0x2F barco (rumbo), 0x24-0x27 skiff (censo parcial)»). **Las dos son falsas.**
> El esquife **no** es 0x24-0x27: es **0x28-0x2B**, y lo fija `CMDS.OVL CS:0x0917`
> `and al,0xfc / cmp al,0x28` (el contador de esquifes estibados al desembarcar,
> `0x091d inc word ptr [bp-6]`), dos instrucciones después de la alfombra en la misma
> rutina (`CS:0x090a and al,0xfe / cmp al,0x14` → `inc g_carpets`). 0x24-0x27 es la
> **fragata con las velas arriadas**: `MAINOUT.OVL CS:0x0208 and al,0xfc / cmp al,0x24`
> imprime `"Rowing!\n"` (DS 0x2982), y `CS:0x0499 cmp al,0x20` (velas izadas) mira
> `g_sail_dir`. ⇒ **la guarda de 0x1bb5 cubre la FRAGATA y sólo la fragata.** El ledger
> ya está corregido con estas citas; el port lo tenía bien desde antes
> (`transport.ts:33-87`, `isFrigate = (tile & 0xf8) === 0x20`).
>
> Importa para el fix: con la lectura vieja se habría escrito `isFrigate(t) || isSkiff(t)`
> y el port habría **denegado** una huida que el original permite.

⚠ **Cómo casi lo cuento mal.** Mi primera lectura fue «familia de tile 0x20 = barco» y la
fui a comprobar contra `TileData.json`, donde 0x20-0x27 son `Path1..Path7/Roof1`: caminos.
La conclusión habría sido un disparate. El acierto no fue la intuición, fue **ir a la tabla
que manda** — `g_transport_tile` ya estaba censado en el ledger de globales. Dos tablas
distintas con el mismo rango numérico es exactamente el perfil de una cita equivocada.

⇒ **En el original, a bordo de barco o esquife NO puedes salir del combate por el borde.**
Se imprime «Stay with ship!» y la salida se deniega.

### 2.2 El port

`game/src/core/combat/combat.ts:2548` `playerEscape(dir)` **es** esa rutina — se cita a sí
misma como `SJOG 0x1bb2` y modela dos de sus tres ramas:

- la guarda de salida única (`0x1c04` → `"All must use the same exit!"`), con su condición
  correcta (`g_unk_58a1 & 0x80`, sólo combate de sala);
- el reparto `Leave!` / `Escape!` (`0x1bf4` DS 0x8ea6 / `0x1c20` DS 0x8eae) según queden
  enemigos vivos.

Y **no modela la guarda de cabecera**: `combat.ts` no menciona `transport`, `ship`, `skiff`
ni `frigate` **ni una sola vez** (barrido del fichero entero). No es que la resuelva de otra
forma: el estado de transporte no entra en el módulo de combate.

### 2.3 Veredicto

**NO es un sapo.** El port no imprime otra cosa en su lugar: nunca llega a esa rama. Es
`hueco-del-port` / **rama sin cablear dentro de rutina portada**, pero de una subclase que
merece nombre propio: **la rama que falta es una GUARDA, no un mensaje**. El efecto no es
que falte una línea de texto, es que en el port **se puede hacer algo que el original
prohíbe**.

Familia conocida: es el mismo género que **#33** (guarda no documentada a la cabeza de
`DNGLOOK 0x0844`) y **#73** (gate no documentado de `cbt_scene_populate`). Tres veces ya:
**las guardas de cabecera de una rutina portada son el punto donde el calco se cae**, y no
las detecta ningún gate actual porque no cambian ningún mensaje que alguien compare.

## 2.bis ★★ PRIMER SAPO DEL CAPÍTULO — `'"Nay!"\n'` (CMDS 0x07F6, (B)oard)

Y viene en **tres capas**, cada una peor que la anterior.

### Capa 1 — el original

`(B)oard` sobre un **caballo** (`0x0832: and al,0xfe / cmp al,0x10`). Si estamos en un
pueblo (`g_location != 0`), resuelve el slot del actor y comprueba su dueño:

```
0856: cmp word ptr [bx + 0x5f68], 0
085b: je  0x862                      ; sin dueño → sigue el abordaje normal
085d: mov ax, 0x425e                 ; ★ CON dueño
0860: jmp 0x80d                      ;   → print + return 1 = abordaje DENEGADO
```

`DATA.OVL` fileoff `0x426e` = `b'"Nay!"\n'` — **con las comillas literales** y el `\n`.

### Capa 2 — el port dice OTRA COSA (esto es el sapo)

`core/world/transport.ts:475` tiene la rama:

```ts
if (horseOwned) return { ok: false, message: "Nay!" }; // 0x0856, antes del gate a pie
```

El **valor** de ese literal es `Nay!`: sin comillas y sin `\n`. El corpus tiene la clave
fiel `'"Nay!"\n'`, **traducida y revisada** («¡No!»\n), y es justo ésa la huérfana. Es el
perfil exacto del sapo de #39: el corpus sabe lo correcto y el código imprime otra cosa.

Y no vale la excusa de «el port recorta comillas por convención»: otros rechazos las
**conservan** (`'\n"I thank thee!"\n'` se emite con las suyas). Es una divergencia, no un
estilo.

### Capa 3 — la rama es INALCANZABLE, y hay un test que lo tapa

`horseOwned` tiene **exactamente tres ocurrencias en todo el repo**: el comentario que lo
documenta, el parámetro con `= false`, y el `if`. `Game.board()` (`game.ts:3317`) llama

```ts
const res = boardVehicle(this.state, worldTile, fromTile);   // TRES argumentos
```

⇒ **nadie pasa `true` en producción**: la rama está muerta.

Y el arnés no lo detecta porque **mide por dentro**:
`game/tests/transport-exact.test.ts:311` hace
`expect(board(st, 0x10, TILE_FOOT, true)).toEqual({ ok: false, message: "Nay!" })`,
pasando el flag **directo a la función pura** y saltándose el cableado. Resultado: test en
verde, lógica sellada, característica muerta — **y el mismo test sella el texto
equivocado**. Es el género «lógica sellada ≠ cableado sellado» (el TapGate con 9 tests y
`bindTap` cero), agravado: aquí el arnés no sólo no cubre el cableado, además **ratifica la
divergencia**.

### Veredicto

`hueco-del-port` en el censo (la cadena sigue sin emitirse), pero la etiqueta útil es
**SAPO + cableado ausente**. Tres cosas que arreglar, y en este orden: (1) cablear
`horseOwned` desde `Game.board()` leyendo el dueño del slot; (2) corregir el texto a
`"Nay!"` con comillas y `\n`; (3) mover el test al nivel del cableado, no de la función
pura.

**No lo arreglo aquí**: toca `game.ts` y un test ajeno, y este carril es de adjudicación.

## 2.ter ★★ SAPO nº2 — `' odd key'` (SJOG 0x1568): el port porta UN lado del `cmp` y cita ese offset

```
1568: cmp word ptr [bp+6], 0x7f
156c: jle 0x158e
156e: and word ptr [bp+6], 0x7f      ; ← quita el bit alto
      …imprime el número…
1581: mov ax, 0x8caa                 ; DS 0x8caa = " odd key"
158e: …                              ; DS 0x8cb4 = " key"
15b1: cmp word ptr [bp+6], 1         ; DS 0x8cba "!\n" / DS 0x8cbe "s!\n"
```

Composición del original: `<n>` + `" odd key"|" key"` + `"!\n"|"s!\n"`.

El port, `core/world/commands.ts:497`:

```ts
case 7: return qty === 1 ? tf("{} key!", qty) : tf("{} keys!", qty); // 0x158E, 0x8CB4/0x8CBE
```

Porta **sólo el lado `<=0x7f`** — y **cita exactamente el offset del lado que portó** (`0x158E`).
El lado `0x1581` no existe. Es un patrón de cita que engaña: la referencia es correcta y
verificable, pero **acredita media rama**.

Y hay un detalle que lo agrava: `game.ts:4018` declara que `applySearchGrant` «decodifica el
bit alto de `quality`» para llaves skull/normal. O sea que **el estado sí distingue** los dos
tipos de llave; lo que no distingue es el **nombre**.

**Alcanzable, y en un sitio único.** `data.json searchObjects` tiene **exactamente un** objeto
`id=7` con el bit alto: `{id:7, quality:133 (0x85), location:5, floor:0, x:2, y:2}` — y
`location 5 = TRINSIC`. Como `0x85 & 0x7f = 5`, ahí el original dice **«5 odd keys!»** y el
port dice **«5 keys!»**.

**Veredicto: SAPO** (género de #39 — el port no calla, dice otra cosa). Más barato que #130:
aquí no falta cableado, el flujo corre; falta el lado del `cmp`.

## 2.quater `'Boarded!\n'` (CAST 0x1862, (U)se alfombra) — hueco en la rama de ÉXITO

El original, tras pasar los tres gates (no-mazmorra, tile≠0x0c, **a pie**):

```
188b: mov ax, 0x48c8 / push / call 0x58d0    ; "Boarded!\n"
1899: call rand(0,1)
189c: add al,0x14 / mov [g_transport_tile],al
18a1: dec byte ptr [g_carpets]
```

El port (`core/endgame/use-tools.ts:99 useMagicCarpet`) modela **el flujo entero**: el gate de
location con su `"Not here!"` (DS 0x48f3), el de barco con `"X-it ship first!"` (0x48d2), el de
a-pie con `"Only on foot!"` (0x48e4), el `0x14 + rand(0,1)` y el `dec g_carpets`. Y en la rama de
**éxito** hace la mutación de estado **sin empujar ningún mensaje**.

O sea: **las tres ramas de FALLO se emiten con su DS citado, y la de ÉXITO no**.

**No es sapo** — no dice otra cosa, no dice nada. Es el caso (i) de la taxonomía. Pero es el
**camino normal**, no un borde: cada vez que el jugador usa una alfombra estando a pie, el
original dice «Boarded!» y el port se queda callado.

★ **Síntoma diagnóstico del género**: la derivación del propio port (el docblock de :88-97)
enumera los DS de las tres ramas de fallo y **no menciona 0x48c8**. El hueco no entró al escribir
el código: entró al **derivar**. Quien derivó siguió los gates y se saltó el mensaje de la salida
feliz — que es justo el que un jugador ve siempre.

## 3. Lo que este acta NO cierra

- **34 flujos sin leer.** Tengo el puente y la lista, no la lectura. Leí **4 de 38** — y el
  segundo ya dio sapo, así que el capítulo NO cierra con cero.
- **No propongo el fix.** Portar la guarda toca `Combat` (que hoy no conoce el transporte) y
  el contrato de `playerEscape`; es decisión del orquestador, y probablemente del carril de
  combate, no de éste.
- **No sé si es observable hoy**: para entrar en combate a bordo hace falta un encuentro
  marítimo; si el port no genera ese encuentro, la guarda es inalcanzable y el hueco es
  teórico. **No lo he medido** (cero e2e por el mutex).

## 4. Predicción falsable

Si alguien cablea la guarda, `'\nStay with ship!\n'` sale del censo de huérfanos por la vía
`emitido_exacto` y el recuento baja de 126 a 125. Si bajara de otra forma —o bajaran dos—,
el cableado no es el de esta rama.

## 5. Cola, con el trabajo ya troceado

Las 18 rutinas restantes, por orden de tamaño: `SHOPPES3 0x4e6` (7 huérfanas, posada),
`TALK 0x31e` (4), `SJOG 0x646` (4, búsqueda de mazmorra — su port está en `dungeon.ts:78` y
emite las ramas vecinas), `ENDGAME 0x648` (3), `CAST 0x1792` (3, `(U)se`), `SJOG 0x1458` (2,
`get_special_item` — `The plans for the HMS Cape!`), `SJOG 0xd4a` (2, Jimmy),
`LOOKOBJ 0x99c` (2, visiones), y 10 rutinas con 1 cada una.

Prioridad sugerida por perfil-de-guarda (no por tamaño): las que, como ésta, están a la
CABEZA de la rutina o detrás de un `cmp`/`test` que decide si el comando procede —
`CMDS 0x7f6` (`"Nay!"` en (B)oard), `SJOG 0x1458` (`' odd key'`), `CAST 0x1792`
(`Boarded!`). Las de diálogo (posada, taberna, TALK) casi seguro son texto y no mecánica.
