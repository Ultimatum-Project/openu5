# `DNGLOOK.OVL:0x117E` — cuerpo entero: NO es un pasillo, y el 0xEC no lee basura

Origen: cabo suelto del §8 de [ring-expiry-derivation.md](ring-expiry-derivation.md). Al leer
el cuerpo entero para adjudicar el nombre del ledger aparece un segundo hallazgo, más gordo
que el renombre, que toca el **carril 0xEC**.

**DOS VEREDICTOS:**
1. El nombre `corridor_sprite_overlay` es **insostenible**: no hay pasillo, no hay overlay de
   sprites y no es per-frame. La rutina **monta la escena de una sala de combate**.
2. `game/src/core/combat/combat.ts:757-765` afirma que la rama 0xEC «SUSTITUYE el índice por
   una lectura de 4 bytes de pila que la rutina NUNCA inicializa (verificado por exhaustión)».
   **REFUTADO por cuerpo**: esos 4 bytes se inicializan con 4 tiradas de dado contra una tabla,
   en la única vía de entrada al bucle. El 0xEC es un **grupo aleatorio de enemigos**, derivado.

---

## 1. Anatomía (0x117E-0x13A1, `ret 4` ⇒ 2 argumentos)

Direcciones **file-relativas de DNGLOOK**; sesgo de overlay **0xA290** (real = file + 0xA290).
El sesgo está confirmado por bytes, no por convención: el stub del kernel `0x7c3e` es
`9a ec02 2e07 / dw 0x000a / ea 0eb4 0000` = «asegura overlay 10 (DNGLOOK)» + `ljmp 0:0xb40e`,
y 0xb40e = 0x117e + 0xA290.

### Bloque A — coloca al PARTY (0x1195-0x1247). Corre si `arg1 != 1`.

```
1195: cmp word ptr [bp+4],1 / jne 0x119e ; arg1==1 => SALTA todo el bloque A
119e: mov al, byte ptr [g_dng_facing]    ; lado de entrada
      facing 1 -> [bp-2]=2 · facing 3 -> 1 · facing 0 o 5 -> 3 · resto -> 4
11c1: call 0x6936                        ; KERNEL party_anim_build (<- la tirada del anillo)
11f5: bucle sobre g_party_size:
      X_i = [0xAD14 + dir*32 + 0x0b + i]   (bx-0x52ec)
      Y_i = [0xAD14 + dir*32 + 0x11 + i]
      -> escribe 0x5c5c/0x5c5d (tabla de actores de mundo 0x5C5A, stride 8)
      -> escribe 0xba1a/0xba1b (g_combat_actor_records +6 X / +7 Y, stride 8)
```

`0xAD14` es exactamente el búfer donde `dng_enter_room` (DUNGEON.OVL:0x0000) acaba de cargar
los 0x160 bytes del mapa de `dungeon.cbt` (`mov di,0xad14` + `repne stosb` de 0x160 + lectura).
Dos anclas independientes, ninguna de convención.

⇒ **El bloque A son los `playerStarts` del .CBT indexados por el LADO DE ENTRADA.** Los 6 slots
(X en +0x0b..+0x10, Y en +0x11..+0x16) son el tamaño máximo del party. Es el mecanismo P0a
(«spawn = opposite-of-facing») ya sellado en el repo, aquí visto desde su propio cuerpo.

### Bloque B — puebla las 16 MAP-UNITS (0x1248-0x1399)

Corre si `arg1 > 0` **y** (`arg1 < 3` **o** (`arg1 == 3` **y** `arg2 > 0xef`)).

```
1267: [bp-0xa]=[bp-0xc]=[bp-2]=0x0b        ; columna 11 = inicio de la zona de unidades
1273-128c: ★ 4 tiradas: rand sobre 0..7 -> [bx + 0x385e] -> [bp+si-6], si=0..3
1291: [bp-0x20]=0x10                        ; 16 ranuras
12a1: bucle x16:
      sprite = [0xADB4 + 0x0b + i]          (bx-0x524c)   ; fila 5
      12ab: or al,al / 12af: jmp 0x1385     ; ★ sprite==0 => RANURA VACIA, salta
      clasificacion:
        tile<0x40, o (tile&0xfc)==0xb4, o (tile&0xfc)==0xe8  -> [bp-0x12]=2, si=tile CRUDO
        resto                                                -> [bp-0x12]=0, si=(tile-0x40)>>2
      12e5: if (tile&0xfc)==0xec -> si = [bp + (tile&3) - 6]  ; ★ EL GRUPO ALEATORIO
      1318: call 0x6506 kernel_spawn_actor(g_floor, Y, X, [bp-0x12], si)
            X = [0xADD4 + 0x0b + i] (fila 6) · Y = [0xADF4 + 0x0b + i] (fila 7)
      si [bp-0x12]==2: fija el tile de animacion en [slot*8 + 0x5c5f]
            si==1 -> g_floor*3+7 · si==2 -> rand + (g_floor*10+0xa)
            si<0x10 -> rand sobre 0..([si+0x383f]-1) sumado a [si+0x384d]
```

**El repo ya sabía esto y lo cita bien**: `extractor/src/parsers/combatmap.ts:97-140` documenta
filas 1-4 = `playerStarts` con `+11` X / `+17` Y, y fila 5/6/7 = sprite/X/Y de las 16 unidades,
citando `DNGLOOK.OVL 0x117E` por dirección. El nombre del ledger contradice a un consumidor
derivado del propio repo.

## 2. ★ El 0xEC: la cita del port, REFUTADA por cuerpo

`combat.ts:763-765` dice, y de ahí cuelga un «DELIBERADAMENTE NO ARREGLADA»:

> «la rama `0xec` de DNGLOOK (`0x12ea-0x12fc`) SUSTITUYE el índice por una lectura de 4 bytes
> de pila que la rutina NUNCA inicializa (verificado por exhaustión sobre listado
> re-desensamblado).»

Los 4 bytes son `[bp-6]`..`[bp-3]`, y se escriben en 0x1285:

```
1273: 2bf6            sub si,si
1275: 2bc0 50         push 0                          ; \ rand sobre el rango 0..7
1278: b80700 50       push 7                          ; /  (16 salidas -> no: 8)
127c: e8836b          call rand_range
127f: 8bd8            mov bx,ax
1281: 8a875e38        mov al, byte ptr [bx + 0x385e]  ; tabla de 8 entradas
1285: 8842fa          mov byte ptr [bp + si - 6], al  ; ESCRIBE [bp-6+si]
1288: 46 / 83fe04 / 7ce7   inc si ; cmp si,4 ; jl 0x1275
```

y el consumo en 0x12ee-0x12fc lee **esos mismos 4 bytes**:

```
12ee: 8a5ef8      mov bl, byte ptr [bp-8]   ; el tile
12f1: 81e30300    and bx,3                  ; 2 bits bajos
12f5: 03dd        add bx,bp
12f7: 8a47fa      mov al, byte ptr [bx-6]   ; = [bp + (tile&3) - 6]
```

**CONTROL DE ALCANCE (lo que decide la refutación).** Censados TODOS los destinos de salto
dentro de 0x117E-0x13A1: el único que entra al bucle (0x12A1) es **0x1393, la propia arista de
retorno del bucle**, que está aguas abajo de la inicialización. Las únicas entradas a 0x1267
son 0x125C/0x1262 (el gate), y a 0x1275 es 0x128C (el bucle de las 4 tiradas). **No existe
arista que alcance el consumo sin pasar por la escritura.** La inicialización es
incondicional.

### Mecanismo derivado del 0xEC

> Familia **0xEC** (tiles 236-239): los **2 bits bajos del tile** eligen uno de **4 índices de
> enemigo pre-tirados al montar la escena**. Cada uno es un `rand` independiente sobre el rango
> 0..7 contra la tabla **DS 0x385e** (fileoff 0x386e) = `14 15 16 22 21 18 1f 18`.

Es el «Random enemy groups» del wiki, con tabla y dado. Y **explica el testigo vivo del
usuario** (enemigos REALES saliendo de celdas 0xEC) sin necesidad de la hipótesis de la entrada
degenerada: el original no lee basura, tira dados.

⚠ Los 8 valores de la tabla son **índices de enemigo** (mismo espacio que `(tile-0x40)>>2`). Su
traducción a nombres NO la sello aquí: exige cruzar el mapeo índice→nombre, que es de otro
carril. Lo que está derivado es la tabla, su tamaño, su dado y su indexado.

### Consecuencia para el port (NO aplicada aquí)

La divergencia declarada («trata el 237 igual que el 236») deja de ser cosmética: en el
original **236 y 237 sacan enemigos DISTINTOS** (`pool[0]` vs `pool[1]`), y son 60 unidades en
los combatmaps según el propio comentario del port. El motivo declarado para no arreglarla se
cae. **Retirada ≠ refutación** para lo demás que cuelgue de esa cita: aquí solo se afirma que
este cuerpo dice otra cosa.

### Cómo se produjo el error (para el género)

La rutina **sí** tiene una lectura de pila sin inicializar, pero es **otra**:
`0x129b: mov di,[bp-0x10] / mov si,[bp-0x14]`, locales que solo se escriben al final en 0x1396.
La hipótesis más caritativa —y la más útil— es atribución cruzada: se vio el patrón de pila
cruda y se colgó del `[bp-6]`, que es justo el que sí está inicializado. Es «instrumento
equivocado peor que ninguno» otra vez, y esta vez con un **«verificado por exhaustión»** encima:
la fórmula de confianza no protegió del error de atribución.

## 3. Renombre propuesto (NO aplicado — el pin es del orquestador)

| | |
|---|---|
| nombre actual | `corridor_sprite_overlay` (IDENT, verified=true) |
| propuesto | **`cbt_scene_populate`** — alternativa: `dng_room_build_scene` |
| razón | los dos bloques leen el búfer del `.CBT` en 0xAD14 y **pueblan la escena**: party por lado de entrada (A) + 16 map-units (B). Sirve a salas de mazmorra Y a encuentros. No toca nada de «pasillo». |

**Prueba de que NO es repintado per-frame** (el argumento del §8 de la nota de anillos, ahora
medido): en los 28 .asm hay **un solo stub** que apunta a 0xb40e (barridos los 164 del pool
[0x7A16,0x81C6), la cifra que documenta `dispatch_table.py`), y ese stub tiene **2 call-sites**:
`dng_enter_room` (arg1=3) y `run_combat_encounter` (arg1=2). Si fuera per-frame o per-paso, un
anillo de los del §67 se evaporaría en ~16 pasos.

**Contrato de argumentos** (útil para quien aplique el renombre):

| arg1 | bloque A (party) | bloque B (unidades) |
|---|---|---|
| 0 | corre | NO (exige arg1>0) |
| 1 | NO | corre |
| 2 | corre | corre |
| 3 | corre | solo si `arg2 > 0xef` |

⇒ desde `dng_enter_room` (arg1=3) **el contenido de la sala solo se puebla si su propio arg > 0xef**.
Ese gate no está documentado en ninguna parte del corpus y merece tarjeta propia.

## 4. Lo que esta nota NO cierra

- El renombre en sí: propuesto, **no aplicado**. El pin de la capa manual y el ledger son del
  orquestador, y mover un nombre cablea la guarda anti-huérfanos.
- La traducción de los 8 índices de DS 0x385e a nombres de criatura.
- El gate `arg2 > 0xef` del bloque B (§3): identificado, sin derivar su significado.
- Las tablas DS 0x383f / 0x384d (tiles de animación de la familia 0xb4/0xe8): leídas de pasada,
  no derivadas.
- Si arreglar el 236/237 en el port: decisión del dueño del carril 0xEC, no de esta nota.
