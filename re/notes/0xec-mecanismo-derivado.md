# 0xEC — el mecanismo, derivado por cuerpo (cierra `ecFamilyEnemyIndex`)

Nota de la **saga 0xEC**. Actas hermanas: `sonda-0xec-testigo-yt.md` (testigo YT pixel-a-byte),
`sonda-0xec-experimento-entrada.md` y `sonda-0xec-testigo-visual.md` (quimera cm64 cerrada).
Derivación completa del cuerpo en [dnglook-117e-body.md](dnglook-117e-body.md); aquí va lo que
la saga necesita, más el gate de la tarjeta #73 — que **no confirma** la hipótesis con la que
se abrió.

Sitio: `cbt_scene_populate` (antes `corridor_sprite_overlay`), **DNGLOOK.OVL 0x117E**
(real 0xb40e, sesgo 0xA290).

---

## 1. El mecanismo

> Familia **0xEC** (tiles 236-239): los **2 bits bajos del tile** eligen uno de **4 índices de
> enemigo PRE-TIRADOS al montar la escena**. Cada uno es un `rand` independiente sobre el rango
> **0..7** contra la tabla **DS 0x385e** (fileoff 0x386e) = `14 15 16 22 21 18 1f 18`.

```
1273: 2bf6        sub si,si
1275: push 0 / push 7 / call rand_range      ; rango 0..7
1281: 8a875e38    mov al, byte ptr [bx + 0x385e]
1285: 8842fa      mov byte ptr [bp + si - 6], al   ; escribe [bp-6+si]
1288: inc si ; cmp si,4 ; jl 0x1275               ; CUATRO veces
...
12ee: 8a5ef8      mov bl, byte ptr [bp-8]     ; el tile
12f1: 81e30300    and bx,3                    ; 2 bits bajos
12f5: 03dd        add bx,bp
12f7: 8a47fa      mov al, byte ptr [bx-6]     ; = [bp + (tile&3) - 6]
```

⇒ `236→pool[0]`, `237→pool[1]`, `238→pool[2]`, `239→pool[3]`. **Enemigos distintos por diseño**,
re-tirados en cada montaje de escena. Es el «Random enemy groups» del wiki, con tabla y dado.
Esto **explica los rolls del testigo YT** (237→6 Giant Rats y 236→4 Bats en cm64: dos tiles de
la misma familia dando criaturas distintas) sin hipótesis auxiliares.

⚠ Los 8 valores son **índices de enemigo** (mismo espacio que `(tile-0x40)>>2` de la rama
normal). Traducirlos a nombres exige el mapeo índice→nombre, que es de otro carril: **no se
sella aquí**.

**El «valor de `ecFamilyEnemyIndex` SIN derivar» deja de estarlo**: no es un valor, es una
tirada — y por eso ninguna búsqueda de constante lo encontraba.

## 2. La cita del port que lo tapaba, REFUTADA

`game/src/core/combat/combat.ts:757-765` afirmaba, sellando la divergencia como
«DELIBERADAMENTE NO ARREGLADA», que esos 4 bytes «la rutina NUNCA inicializa (verificado por
exhaustión sobre listado re-desensamblado)». Falso, por el §1.

**Control que lo vuelve firme** (leer el cuerpo no bastaba): censados TODOS los destinos de
salto de 0x117E-0x13A1, la única arista que entra al bucle (0x12A1) es **0x1393, la propia
arista de retorno del bucle**, aguas abajo de la escritura. Las únicas entradas a 0x1267 son el
gate (0x125C/0x1262) y a 0x1275 el bucle de las 4 tiradas. **No hay camino al consumo que evite
la escritura.**

La rutina **sí** tiene lectura de pila cruda, pero es otra variable: `0x129b: mov di,[bp-0x10] /
mov si,[bp-0x14]`, locales que solo se escriben al final en 0x1396. Atribución cruzada.

⇒ **Pieza para el lote #54** (no aplicada aquí): el port trata el 237 igual que el 236 y en el
original sacan enemigos distintos; la retirada de la cita falsa va DENTRO de esa pieza para que
código y comentario cambien juntos.

## 3. Tarjeta #73 — el gate `arg2 > 0xef`: derivado, pero **NO confirma** la hipótesis

**Hipótesis con la que se abrió la tarjeta** (orquestador): si `arg2` es el VALOR DE CELDA del
mapa de mazmorra, un gate `>0xef` dejaría fuera exactamente a las salas despejadas (0xA0-0xAF),
y sería el mecanismo POR CUERPO del no-combate que la quimera mostró por testigo.

**Lo que SÍ queda derivado — `arg2` es, en efecto, el byte de celda:**

```
DUNGEON.OVL dng_enter_room:
  0087: 2ae4      sub ah, ah          ; AH = 0 ...
  ...                                  ; (nada entre 0x0089 y 0x00b4 escribe AH:
  00ad: 8826a058  mov [g_unk_58a0], ah ;  el movsw no la toca y esto la LEE)
  00b1: 8a4604    mov al, byte ptr [bp+4]   ; ... AX = 0x00nn, byte limpio
  00b4: 50        push ax                    ; -> arg2 de cbt_scene_populate
```
y ese mismo `[bp+4]` es el que en 0x001f-0x0024 se enmascara con `and ax,0xf` para sacar **el
número de sala** que indexa el `.CBT` ⇒ es el valor de celda (0xFn viva / 0xAn despejada).

Condición exacta del gate (0x1248-0x1264): el bloque de contenido corre si
`arg1 > 0 && (arg1 < 3 || (arg1 == 3 && arg2 > 0xef))`. Desde `dng_enter_room` (arg1=3) se
reduce a **`celda > 0xEF`**.

**PERO la predicción choca con el acta, y hay que decirlo.** El gate no distingue enemigos de
mobiliario: apaga el bloque B **entero**. Y las fuentes (237) son **map-units**, no tiles del
mapa 11×11 — medido sobre los 112 mapas de `DUNGEON.CBT`:

| tile | como TILE de la rejilla 11×11 | como MAP-UNIT (fila 5) |
|---|---|---|
| 236 | 0 | 84 |
| **237** | **0** | **56** |
| 238 | 0 | 3 |
| 239 | 0 | 1 |

⇒ Si la celda fuera `0xAn`, en una sala despejada **tampoco habría fuentes**. El acta
`sonda-0xec-testigo-visual.md` sostiene lo contrario: «237=FUENTES se renderizan incluso en sala
despejada (mobiliario decorativo)», con las fuentes en posiciones exactas del `.CBT`.

**Las dos ramas, y la que las separa:**
- **(A)** La celda de aquella sala **no** estaba en 0xA0-0xAF al entrar ⇒ el gate es correcto
  pero **no** es lo que produjo el no-combate del testigo, y la hipótesis de la tarjeta cae:
  habría que buscar el no-combate en otro sitio (candidato: la guarda `DS:0x383a` de
  DNGLOOK 0x0844, ya fichada en #33/#43).
- **(B)** La celda sí era `0xAn` ⇒ entonces el acta se equivoca al atribuir las fuentes a esa
  entrada, o llegan por una vía que no he leído.

**Experimento decisivo, barato y de bytes** (no de testigo): leer el **byte de celda en la
posición de entrada** dentro del save de aquella sesión y compararlo con 0xF0. Un solo byte
decide entre (A) y (B). Hasta entonces **#73 queda ABIERTA**: lo derivado es qué compara el
gate, no que el gate explique el testigo.

## 4. Lo que esta nota NO cierra

- **#73**, por lo anterior: falta el byte de celda del save.
- La traducción de los 8 índices de DS 0x385e a nombres de criatura.
- Las tablas DS 0x383f / 0x384d (tiles de animación de la familia 0xb4/0xe8), leídas de pasada.
- El arreglo 236/237 en el port: es del dueño del carril, va al lote #54.
