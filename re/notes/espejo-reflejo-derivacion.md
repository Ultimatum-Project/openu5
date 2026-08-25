# El REFLEJO del espejo — derivación completa (ficha #199)

Sujeto: **el binario**. Qué hace Ultima V cuando hay una figura delante de un espejo de
pueblo, y por qué el port no pintaba nada.

## 0. El reporte

12-08-2026, reporte del usuario con captura: plantado delante de un espejo, el clon no
enseña reflejo. Medido en el port antes de tocar nada: `MirrorAvatar` (tile 158) **no tenía
un solo consumidor** en `game/src` — el único uso de la familia era el tile 157 como
decoración estática de la sala de invocación (`skin/fiel/summoning-room.ts:57`). No era un
reflejo mal pintado: no existía.

## 1. Los tiles

`TileData.json` da el bloque contiguo `0x9d Mirror` · `0x9e MirrorAvatar` ·
`0x9f MirrorBroken`, los tres `IsUpright`, ninguno caminable.

## 2. El único escritor de `0x9e` en TODO el desensamblado

🔴 El censo hay que enunciarlo con la unidad correcta, porque el token engaña: `grep -oE
'0x9e\b'` sobre los 28 `.asm` da **nueve** aciertos, y **siete no son el tile** — cinco
`je 0x9e` (destinos de salto en SJOG y SHOPPES2) y dos `[bp - 0x9e]` (desplazamientos de
pila en CAST). Como **inmediato de un byte de tile**, `0x9e` aparece **dos veces**, las dos
en `ULTIMA.EXE`, y sólo una es escritura — dentro de `ULTIMA.EXE:0x51b8` (el colocador de
UN actor en la ventana visible):

```
531a: 3d9e00     cmp ax, 0x9e            ; despacho por el TERRENO bajo el actor
531f: 3d9d00     cmp ax, 0x9d
5327: 3d9300     cmp ax, 0x93
532c: ff7608     push word ptr [bp + 8]  ; X
532f: 8b4606     mov ax, word ptr [bp + 6]
5332: 48         dec ax                  ; ← Y − 1: la celda del NORTE
5334: e8cbf0     call 0x4402             ; get_tile_ptr(y, x)
5339: 803f9d     cmp byte ptr [bx], 0x9d ; ¿el vecino del norte es Mirror VACÍO?
533c: 7532       jne 0x5370
533e: 837e0a00   cmp word ptr [bp + 0xa], 0
5342: 742c       je 0x5370               ; fila 0 de la ventana ⇒ no hay dónde pintar
5344: 8b760a     mov si, word ptr [bp + 0xa]
5347: b105       mov cl, 5
5349: d3e6       shl si, cl              ; fila·32
534b: 8b5e0c     mov bx, word ptr [bp + 0xc]   ; columna
534e: c680e2aa9e mov byte ptr [bx + si - 0x551e], 0x9e   ; ← ESCRIBE MirrorAvatar
```

La llama el bucle de actores `ULTIMA.EXE:0x5394` (`call 0x51b8` en `0x55fe`), que recorre
las ranuras de `g_char_anim_states` de arriba abajo; la ranura 0 es el party y se pinta la
última (sus campos se rellenan en `53a6-53be` desde `g_party_x/y`, `g_floor`,
`g_transport_tile`).

## 3. 🔴 Qué coordenada es cuál — leerlo al revés invierte la regla entera

Dos lecturas independientes dan lo mismo:

1. **Por el probe.** `get_tile_ptr` (`0x4402`) multiplica su PRIMER argumento por 32 en las
   dos ramas (`4414: shl ax, 5` para `g_location > 0x7f`, `44a3: shl ax, 5` para pueblo,
   mapa 32×32 en `DS:0x6608`) ⇒ ese argumento es la FILA. El llamador empuja `[bp+8]` y
   luego `[bp+6]−1`; el último empujado es el primer parámetro ⇒ **`[bp+6]` = Y**.
2. **Por el destino de la escritura.** `-0x551e` es `-0x54fe − 0x20`: el mismo búfer con la
   misma `si = fila·32` y el mismo `bx = columna`, **una fila más arriba**. `-0x54fe` es
   `DS:0xAB02` = `g_vis_buffer`, el búfer de TERRENO visible de stride 32
   (`re/notes/kernel-sweep-2.md:113`; la capa de actores es la otra, `DS:0xAC64` stride 16).

⇒ **El disparador es estar en la celda de DEBAJO; lo que cambia es la celda DEL ESPEJO.**

La ventana es 11×11: el mismo bucle acota `cmp [bp-6], 0xa` / `cmp [bp-8], 0xa` (`54a7` /
`54b0`) tras restar `party−5`. Es el `VIEW_WINDOW = 11` del port.

## 4. Qué actores reflejan — la puerta de `0x51bf`

`[bp+4]` es el índice de sprite **menos 0x100** (los sprites de actor viven en `0x100-0x1ff`
y el búfer es de bytes). La descodificación se comprueba sola en las otras ramas de la misma
rutina: terreno `0x84`/`0x85` → sprite `0x60+r`/`0x64+r` = `PersonStocks`/`WallPrisoner`
(cepo y grilletes), y silla `0x92` con comida al norte → `0x34+r` = `SitChairDownEat`.

```
51bf: cmp [bp+4], 0x1c ; je  → PASA      0x11c BasicAvatar
51c5: cmp [bp+4], 0x12 ; jl  → 51d1
51cb: cmp [bp+4], 0x16 ; jl  → PASA      0x112-0x115 caballo y alfombra CON jinete
51d1: cmp [bp+4], 0x40 ; jge → PASA      0x140-0x1ff todo NPC y criatura
51d7: cmp [bp+4], 0x28 ; jge → 51e0
51dd: jmp 0x5370       ; RECHAZA         < 0x28
51e0: cmp [bp+4], 0x2c ; jl  → PASA      0x128-0x12b esquife
51e6: jmp 0x5370       ; RECHAZA         0x12c-0x13f
```

Lo que sale es **refleja la FIGURA ERGUIDA**: el Avatar a pie, montado, en alfombra y en
esquife, y todos los NPC y criaturas. Quedan fuera los objetos (`0x101-0x10f`), el caballo
SIN jinete (`0x110/0x111`), los barcos (`0x120-0x127`), los piratas (`0x12c-0x12f`), y las
poses de **sentado** (`0x130-0x13b`) y **tumbado** (`0x11a SleepingInBed`) — sentarse en la
silla de delante del espejo apaga el reflejo. También queda fuera `0x13c-0x13f
LordBritishMirror`, así que un reflejo no engendra otro.

## 5. 🔴 NO hay excepción de Shadowlord — negativo MEDIDO

La ficha #199 daba la excepción por hecha («es TRAMA: los Shadowlords no se reflejan»). Es
**falsa en el binario**: los Shadowlords son `0x1fc-0x1ff`, byte bajo `0xfc-0xff`, y caen de
lleno en el `jge 0x40` que PASA. Y no puede existir en otra parte: el censo de §2 (inmediato
de tile, no token) da **un** escritor de `0x9e` en los 28 `.asm` y es éste. En el original,
un Shadowlord plantado bajo un espejo lo pone en `MirrorAvatar` igual que cualquiera.

Lo que SÍ queda fuera, por caer en la banda rechazada `0x116-0x127`, es **`0x11d
Apparition`**: la aparición no se refleja. Se registra como pertenencia MEDIDA a la banda,
no como intención acreditada del autor de 1988 — la banda entera es «cosas que no son una
figura de pie», y la aparición está dentro de ella junto a la luna, las escaleras y los
barcos.

## 6. El reflejo NO escribe el mapa — el espejo ROTO sí

La escritura de `0x9e` va a `g_vis_buffer`, que se reconstruye cada fotograma: el reflejo es
presentación. El caso hermano es distinto y conviene no confundirlos — romper el espejo
escribe el byte del MAPA a través del puntero de `get_tile_ptr`:

```
TOWN.OVL 0a4a: call 0xffffc232      ; get_tile_ptr sobre (party + scratch)
         0a4f: 803f9d  cmp byte ptr [bx], 0x9d
         0a5f: c6079f  mov byte ptr [bx], 0x9f    ; ← MirrorBroken, EN EL MAPA
         0a62: mov ax, 0x26f2 / call 0xffff9680   ; mensaje
         0a6c-0a80: barrido de tono 0x7d0→0x4e20 paso 0x3e8 (el cristal)
         0a85: or byte ptr [g_unk_24e6], 2
```

Eso es de la familia de la ficha #33 («dibujar no es sólo-lectura» / escribir el byte del
mapa) y **el port tampoco lo tiene** — cabo abierto, no tocado por esta ficha.

Los OTROS lectores del tile del espejo, para quien busque por `0x9d` (censo con la misma
unidad: 6 aciertos del token, de los que `ENDGAME 0x00a6 je 0x9d` es un destino de salto y
no cuenta ⇒ **5 sitios** que sí leen el tile):

| sitio | qué hace |
|---|---|
| `ULTIMA.EXE:0x531f` y `0x5339` | el despacho y el probe del reflejo (§2) |
| `TOWN.OVL:0x0a4f` | romper el espejo (arriba) |
| `TALK.OVL:0x04b3` | hablarle a un espejo → `\nNo response!\n` (DS 0x91F6) |
| `CAST.OVL:0x025f` | el espejo entra en un tramo de decisión del objetivo de hechizo, junto a `0x5b` — SIN derivar en esta ficha, sólo se deja anotado para que nadie lo lea como «no hay más lectores» |

## 7. Alcanzabilidad, medida sobre los datos del port

`game/assets/maps/smallmaps.json` tiene **14 celdas** `Mirror` en pueblo (Moonglow,
Britain, Yew, Minoc, castillo de Lord British, palacio de Blackthorn, Paws, Ararat,
Farthing, Lycaeum ×3, Empath Abbey, Serpent's Hold) y en **las 14** el vecino del sur es
`68 BrickFloor`, caminable. La regla se dispara en el 100 % de los espejos del juego; no es
un camino raro. Hay una 15ª celda en `combatmaps.json[127]`, arena de combate: el binario
comparte la rutina para `g_location ≥ 0x80`, así que también valdría allí.

## 8. Qué se hizo en el port

`game/src/render/mirror-reflection.ts` (predicado puro, con la puerta y los dos tiles
re-derivados por NOMBRE) + tres llamadas desde `skin/coreview.ts:bakeMapWindow` — una por
entidad y una por el party, escribiendo en `window` y en `terrainWindow`, que son las dos
capas de terreno que consumen la piel fiel y el compositado del shader.

Guarda: `game/tests/mirror-reflection.test.ts`, 13 asertos. Cuatro mutantes del predicado
(vecino, fila 0, puerta de sprites, excepción de Shadowlord inventada) y **un quinto del
CABLEADO** — borrar las llamadas de `coreview` deja el predicado impecable y el espejo
muerto otra vez, que es exactamente el estado que reportó el usuario.
