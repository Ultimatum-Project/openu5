# ACTA #219 — `0xAD14`: dos dueños SÍ, dos extensiones NO; y el borrado de `0x5b89` SÍ es observable

Pieza 1 del encargo triple. Rama `re/deriv-219`, base `67696ac6`; `main` al abrir la pieza:
`3dad9615`. Fuente: `re/disasm/ULTIMA.EXE.asm` (14309 líneas), `DUNGEON.OVL.asm`,
`CAST2.OVL.asm`, `re/ledger/globals.json`. Antecedente: `re/notes/derivaciones-189-acta.md`.

**Titular en cuatro**:

1. `0xAD14` tiene **dos dueños reales** y son **mutuamente excluyentes POR FASE**. El
   discriminador no hay que suponerlo: es el **mismo predicado** `g_location` contra
   `0x80`/`0x7f` en **tres** sitios, uno de ellos dentro de `tile_addr`.
2. Las **dos extensiones no se contradicen**: 352 ⊂ 1024. El búfer es direccionable a
   **32×32 = 1024 B** (probado por los acotados del propio cuerpo del flood), y los
   **352 B** son el **registro `.CBT`** que vive en sus primeros 352 bytes. El ledger no
   ficha «mal» la extensión: ficha la del registro y calla la del búfer.
3. La pregunta acoplada de #189 se cierra: **`0x5d0a` SÍ repone `0xab02`** — pero **121
   celdas, no 352**, y **sólo en la rama de recálculo**.
4. ★ Y por eso el veredicto de #220 **no** es «omisión benigna»: el borrado de `0x5b89`
   **tiene consumidor vivo en el mismo fotograma** (`0x59ad`). Además **§4 del acta #189
   queda REFUTADA**: no es un protocolo entre fotogramas.

---

## 1. El discriminador de fase, derivado (no supuesto)

| offset | instrucción | lectura |
|---|---|---|
| 4408 | `cmp byte ptr [g_location], 0x7f` / `jbe 0x4420` | ★ dentro de `tile_addr` (0x4402) |
| 440f | `mov ax, word ptr [bp + 4]` | fila |
| 4412 | `shl ax, 5` | ×32 |
| 4416 | `add ax, word ptr [bp + 6]` | + columna |
| 4419 | `add ax, 0xad14` | ★ **en fase ≥0x80 el TERRENO se lee de `0xAD14`** |
| 5947 | `cmp byte ptr [g_location], 0x80` / `jae 0x5954` | la pasada de luces (`call 0x475a`, 594e) **sólo corre en <0x80** |
| 5954 | `cmp byte ptr [g_location], 0x80` / `jb 0x595e` | y si es ≥0x80 salta a 0x59f8 |

Y el puente literal entre los dos nombres, en la rama ≥0x80 del repintado:

| offset | instrucción |
|---|---|
| 59f8 | `mov cx, 0x160` |
| 59fb | `mov di, 0xab02` |
| 59fe | `mov si, 0xad14` |
| 5a05 | `shr cx, 1` / `repne movsw` (+ `adc cx,cx` / `repne movsb`) |

**352 bytes copiados de `0xAD14` a `0xAB02`.** O sea: en mazmorra/arena la «ventana de
vista» no se calcula, **se copia** del registro de mapa. Los dos dueños no conviven: se
turnan, y el turno lo reparte `g_location`.

## 2. La extensión: 1024 y 352 no se contradicen

El **1024** no es un número suelto del recolector: es la extensión **direccionable** del
destino del flood.

| offset | instrucción | lectura |
|---|---|---|
| 5b48-5b5c | `mov si,[bp+0xa]` / `add si,[bp-0x212]` / `shl si,cl` (cl=5) / `add si,[bp+8]`+`[bp-0x210]` / `add si,[bp+4]` | destino = base + ((origen_fila + a)<<5) + origen_col + b |
| 5b7e | `cmp ax, 0x1f` / `jg` | fila acotada a 0..31 |
| 5c6a | `cmp ax, 0x1f` / `jg` | columna acotada a 0..31 |
| 5c6f | `cmp di, 0x1f` / `jle` | fila acotada a 0..31 |
| 5e5e | `mov cx, 0x400` + `repne stosb` 0xff desde `0xad14` | limpieza de 1024 |
| 5f68 | `mov word ptr [bp-4], 0x400` / `mov cx,0x400` | y el post-pase recorre los mismos 1024 |

⇒ índice de 5+5 bits = **32×32 = 1024 B**. La limpieza no es «un rascadero de 1 KiB»
elegido a ojo: es **exactamente** el rango que el índice puede alcanzar.

Y los **352** son el registro `.CBT`, que se carga en la misma dirección:

| offset (DUNGEON.OVL) | instrucción |
|---|---|
| 004b-005b | `mov ax,0x1600` / `imul` / `mov ax,0x160` / `imul` / `add` → offset de registro dentro del fichero |
| 005e | `mov cx, 0x160` |
| 0061 | `mov di, 0xad14` |
| 006a | `repne stosb` (con `ax=0`) |
| 0074 | `mov ax, 0x160` (longitud de lectura) |

16 registros × 352 = 0x1600 por fichero, que es la aritmética de 004b. El registro es de
352; **el búfer que lo aloja es de 1024**.

★ **AVISO, no filtro** (#191): `0xAD14 + 0x400 = 0xB114`, y `0xB114` es justo la siguiente
global del catálogo (`g_shoppe_id`). El tramo `0xAD14..0xB113` no tiene otro dueño
fichado. Corrobora; no prueba (lo que prueba es el acotado a 0x1f).

## 3. Qué es `0xAD14` en la fase <0x80: la MÁSCARA DE CELDAS ILUMINADAS

No son «las fuentes de luz». Recorrido de `0x5e4a`:

| offset | qué hace |
|---|---|
| 5e5e-5e6b | pone los 1024 B a 0xFF |
| 5e72-5ee9 | doble bucle **32×32** (`cmp si,0x20` en 5ed6, `cmp [bp-6],0x20` en 5ee5): por celda, `call 0x4402` (terreno) y `call 0x402` contra la tabla de **10** entradas `0x6a9a` |
| 5eb0-5ec8 | si es emisor, apila el par **(y, x)** en el array local `[bp-0x8c]` |
| 5ec9-5ed0 | y escribe el tile en `0xAD14` en el índice lineal de la celda |
| 5efe-5f63 | por CADA emisor: re-siembra `0xAB02` y llama al flood con base `0xad14`, origen `(y-5, x-5)`, **radio 0xa** (5f3f) |
| 5f65-5f78 | post-pase sobre los 1024: `0xFF` → `0x00` |

Ese último pase es el que fija la convención que consulta el pase de la party
(`cmp byte ptr [bx+di-0x52ec], 0` en 5c29 / 5c40 / 5c8c): **cero = no iluminada**.

★ Tercer escritor, y confirma la lectura: el **haz del faro** estampa celdas en el mismo
búfer — `7091 mov byte ptr [bx + di - 0x52ec], al`, con la forma leída de la tabla
`0x1f7e` (16 pares) — y su cabecera `70bc` pone `g_unk_24e6 = 1`.

⇒ el contenido de `0xAD14` en esta fase son las **celdas iluminadas** (valor de tile donde
llega la luz, 0 donde no). La etiqueta del port, «buffer de FUENTES DE LUZ», nombra la
**entrada** del cálculo, no el **contenido** del búfer.

★ El barrido de emisores es de **chunk entero (32×32)**, no de la ventana 11×11. Eso
sostiene —y agranda— la aproximación que el port ya declara.

## 4. `0x5d0a` entero: la pregunta acoplada de #189

**Sí repone, y menos de lo que la pregunta suponía.** Cabecera, incondicional:

| offset | instrucción | lectura |
|---|---|---|
| 5d17 | `mov si, 0xab02` | |
| 5d1a/5d1d | `mov di, 0xb` / `mov cx, 0xb` | 11 filas, 11 bytes |
| 5d2a | `repne stosb` con `ax=0xff` | |
| 5d2d | `add si, 0x20` | paso 32 |
| 5d31 | `jne 0x5d1d` | |

**121 celdas** (11×11 dentro de un paso de 32), no 352 ni 1024. Y es **completa respecto
al dominio**: el flood acota sus dos desplazamientos a `[0, 0xa]` (5b26-5b40) y el
llamador de la party entra con origen `(0,0)` — el centinela `0xff91` se sustituye por
cero en 5a5d y `[bp+8]` es `0` (5d56-5d58) —, así que ninguna celda que el flood pueda
leer se queda sin re-sembrar.

**Tri-estado por el radio** `[bp+0xa]`, que es `g_light_level` (5965: `mov al, byte ptr
[g_light_level]`, primer push):

| radio | camino | efecto |
|---|---|---|
| `> 0` | 5d45 `jg` → flood (5d61) + post-pase 5d64-5d8c | ventana por LOS |
| `== 0` | 5d49 `jle` → 5d8f; 5d93 `jge` → 5df5 | sólo la siembra de 0xFF: **todo negro** |
| `< 0` | 5d93 no salta → 5d95-5df3 | **copia cruda** de las 121 celdas desde `tile_addr` |

Post-pase de la rama `>0`, sobre las mismas 121 celdas:

| offset | instrucción |
|---|---|
| 5d7c | `cmp byte ptr [si], 0` |
| 5d7f | `jne 0x5d83` |
| 5d81 | `dec byte ptr [si]` → 0 pasa a 0xFF |

★ **`[bp+4]` es ARGUMENTO MUERTO, y esta vez con prueba mecánica**: el cuerpo no lo lee, y
los dos llamadores **discrepan** en su valor — `0x5983 mov ax,0xb` frente a `CAST2
0x0491 mov ax,0x20`. Es la hermana del `[bp+6]=32` de `0x5a28` (§2 del acta #189), pero
aquí la discrepancia entre llamadores lo cierra sin necesidad de leer el cuerpo.

★ **Defecto de evidencia en el ledger, de paso**: la entrada `g_vis_buffer` dice que la
llamada con `-1` (X-Ray, `CAST2 0x046c`, `0473 mov ax,0xffff` como primer push) «hace
repne stosb 0xFF (5d12-5d31) saltando el raycast». Eso es medio camino: tras saltarse el
raycast **cae en 5d95-5df3 y copia el terreno crudo**. El efecto no es una ventana en
negro, es la ventana **entera revelada**, muros incluidos — que es lo que un X-Ray hace.
Corregido en esta rama.

## 5. ★ El borrado de `0x5b89` SÍ es observable: su consumidor es `0x59ad`

El repintado no tiene una rama, tiene dos, y las reparte `g_unk_24e6`:

| offset | instrucción | lectura |
|---|---|---|
| 595e | `cmp byte ptr [g_unk_24e6], 0` / `je 0x5992` | |
| 5987 | `call 0x5d0a` | rama de **recálculo** (bandera puesta) |
| 598a | `mov byte ptr [g_unk_24e6], 0` | y la consume |
| 5992-59f4 | bucle 11×11 con paso 0x20 | rama **incremental** (bandera a cero) |
| 59ad | `cmp byte ptr [bx - 0x54fe], 0` / `jne 0x59e0` | ★ **sólo toca las celdas que valen CERO** |
| 59d1/59dc | `call 0x4402` / `mov byte ptr [bx - 0x54fe], al` | y les escribe el terreno crudo |

Las celdas a cero de `g_vis_buffer` las produce **la pasada de luces** (`5b89`), que corre
antes en el mismo fotograma (594e). En la rama de recálculo el post-pase `5d81` las
convierte en 0xFF, así que tras un recálculo **no queda ninguna**; en la rama incremental
son exactamente el conjunto que se refresca.

⇒ **el borrado no es inobservable**. Tiene un consumidor vivo, en el mismo fotograma, a
menos de 60 bytes de distancia. La hipótesis de trabajo de #220 («si `0x5d0a` repone
entero, la omisión del port es benigna») **no se cumple**, y #220 no puede cerrarse por
esa vía.

## 6. ★ REFUTACIÓN de §4 del acta #189 — no hay protocolo entre fotogramas

§4 de #189 escribió: «el `mov 0` de 0x5b89 cae sobre el `g_vis_buffer` **del fotograma
anterior** […] la pasada de luces usa la máscara vieja como dominio de propagación y la va
gastando […] es un protocolo entre fotogramas». El acta declaró no firmarlo. **Es falso**,
y lo desmiente el propio llamador, cuatro instrucciones antes del `call` que #189 sí citó:

| offset | instrucción |
|---|---|
| 5f23 | `mov si, 0xab02` |
| 5f26/5f29 | `mov di, 0xb` / `mov cx, 0xb` |
| 5f36 | `repne stosb` con `ax=0xff` |
| 5f39 | `add si, 0x20` |
| 5f3d | `jne 0x5f29` |
| 5f57 | `call 0x5a28` |

Está **dentro del bucle por emisor** (cabeza 5efe, cierre `jl 0x5efe` en 5f63): `0xAB02`
se re-siembra a 0xFF **antes de cada emisor**. No es la máscara del fotograma anterior: es
un **rascadero por emisor**.

Y con eso la función del cero se deriva sola: es la **marca de VISITADO** del flood de
luces. El brazo de selector 1 deduplica mirando su propio destino (`5b90 cmp byte ptr
[si], 0xff`), pero para la pasada de luces eso sería incorrecto —`0xAD14` **acumula**
entre emisores y un emisor previo frenaría al siguiente—, así que necesita un array de
visitados aparte y reutiliza `0xAB02`.

## 7. ★ El índice del borrado NO lleva el origen

| destino (5b48-5b5c) | `si = [bp+4] + (([bp+0xa] + a) << 5) + [bp+8] + b` |
|---|---|
| `0xAB02` (5b66-5b6c, 5b83-5b89) | `bx + di = (a << 5) + b` — **sin** `[bp+0xa]` ni `[bp+8]` |

Para el llamador de la party (origen `(0,0)`) los dos índices coinciden. Para la pasada de
luces (origen `emisor − 5`) **no**: los ceros que sobreviven al último emisor caen en la
ventana de la party en **offsets relativos al emisor**. El guarda de 5b7e sí usa la
coordenada desplazada (`[bp+0xa] + a` contra 0x1f) mientras la escritura de 5b89 usa la
cruda — asimetría medida, no interpretada.

**Predicción falsable (P1)**, para quien tenga oráculo: en un fotograma **sin** recálculo
(bandera `g_unk_24e6` a cero) y con al menos un emisor en el chunk, la rama incremental
revela terreno en un parche con la **forma** del halo del **último** emisor pero colocado
en coordenadas **locales** de la ventana. No lo he visto en DOSBox; lo dejo apuntado en
vez de afirmado.

## 8. Veredicto de la tarjeta

- **¿Solapamiento real por fase o extensión mal fichada?** → **Solapamiento real por
  fase**, con discriminador derivado (§1). Y la extensión no está «mal fichada»: está
  **incompleta** — el catálogo publica los 352 del registro y no publica los 1024 del
  búfer ni el segundo dueño (§2). Corregido en `globals.json` en esta rama: se mantiene
  `size: 352` (que es el registro y su nombre) y se declaran en la entrada la extensión
  real del búfer, el segundo uso y el discriminador.
- **¿`0x5d0a` repone `0xab02` entero?** → **Repone las 121 celdas útiles** (no los 352 de
  la extensión), y **sólo en la rama de recálculo** (§4, §5).
- **¿Es observable el borrado de la pasada de luces?** → **SÍ** (§5). Con eso, #220 entra
  por la puerta de «tarjeta de mecánica», no por la de «declararla y a otra cosa».

## 9. Lo que este carril NO ha hecho

- **No he cerrado la alcanzabilidad de `0x5e4a` en fase ≥0x80.** Tiene otros dos
  llamadores (`6350`, `6376`, los dos tras `call 0x5f86`, carga de chunk) sin gate de
  `g_location` en su propio marco, y no he trazado sus llamadores hasta la raíz. Lo que sí
  tengo es un argumento de **coherencia**, no de alcanzabilidad: en fase ≥0x80 `tile_addr`
  lee de `0xAD14`, así que `0x5e4a` —que borra `0xAD14` y acto seguido llama a
  `tile_addr` 1024 veces— se leería a sí mismo recién borrado. Sólo tiene sentido en
  <0x80. **Un argumento de coherencia no es una prueba de alcanzabilidad**: queda como
  residuo con dueño.
- **No he adjudicado si la rama incremental es visible para el jugador** (P1 necesita
  oráculo).
- **`g_unk_24e6`**: el ledger lo ficha como «flag turno consumido» de los handlers de
  comando. El repintado lo **lee** (595e) y lo **borra** (598a). Si el cobro del turno
  depende de él, el orden entre repintado y dispatcher importa. No trazado — residuo.
- No he tocado `visibility.ts` en esta pieza (va en #220).

## 10. Predicciones falsables

- **P1** (§7): parche revelado con forma de halo y posición local, en fotogramas sin
  recálculo.
- **P2** (§4): X-Ray (`Wis An Ylem`) revela el 11×11 **completo**, muros incluidos, y no
  deja la ventana en negro.
- **P3** (§2): quien vuelque `0xAD14` **en combate** verá el registro `.CBT` íntegro y
  **no** verá relleno 0xFF más allá de los 352 primeros bytes; quien lo vuelque **en
  exterior** verá 1024 bytes de máscara, con ceros donde no llega la luz.
