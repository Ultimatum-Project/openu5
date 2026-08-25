# ACTA #189 — el selector de modo de `0x5a28`, las dos pasadas, y el cruce con #68

Pieza 3 del encargo de derivación. Rama `re/derivaciones-152`, base `994d4fc2`; `main` al
abrir la pieza: `5bc150b1`. Cero ficheros de `game/src` tocados.

**Titular en tres**: (a) el selector **no es un argumento**, es un local que la rutina
deduce de un **valor centinela** en el cuarto argumento; (b) la topología está
**CRUZADA** — cada pasada consulta el búfer que la otra usa como destino, y la de luces
corre **ANTES** que la de la party, dentro del mismo repintado; (c) `0xAD14` está
**DOBLEMENTE CONTABILIZADO**: la pasada de luces lo limpia como **1024 bytes** y el
ledger lo ficha como un registro de **352**.

---

## 1. El selector: un CENTINELA, no un parámetro

`re/disasm/ULTIMA.EXE.asm`, cabecera de 0x5a28:

| offset | instrucción | lectura |
|---|---|---|
| 5a48 | `mov word ptr [bp - 0x20e], 0` | el selector nace a cero |
| 5a4e | `cmp word ptr [bp + 0x10], 0` / `jg` | el radio tiene que ser positivo o sale |
| 5a57 | `cmp word ptr [bp + 0xa], -0x6f` | ★ el cuarto argumento contra el centinela |
| 5a5b | `jne 0x5a66` | si no es el centinela, el selector se queda a cero |
| 5a5d | `mov word ptr [bp + 0xa], 0` | ★ el centinela se sustituye por cero |
| 5a62 | `inc word ptr [bp - 0x20e]` | ★ y el selector pasa a uno |
| 5a66 | `inc word ptr [bp + 0x10]` | el radio efectivo es el pasado MÁS UNO |

`-0x6f` como word sin signo es `0xff91`. ⇒ **el modo no se pide: se deduce.** El llamador
que quiere el modo 1 pasa el centinela en el sitio donde el otro pasa una coordenada, y
la rutina lo traduce a «origen cero en ese eje» más «modo 1».

## 2. El mapa de argumentos, verificado en los DOS llamadores

Por orden de `push` (el último empujado es el primero del marco):

| ranura | qué es | llamador A (0x5d61) | llamador B (0x5f57) |
|---|---|---|---|
| `[bp+4]` | base del búfer de destino | `0xab02` | `0xad14` |
| `[bp+6]` | 32 | `0x20` | `0x20` |
| `[bp+8]` | origen en el eje que va crudo | `0` | `[bp-0xa]` del llamador |
| `[bp+0xa]` | origen en el eje que va por 32, **o el centinela** | `0xff91` ★ | `[bp-0xc]` del llamador |
| `[bp+0xc]` | segundo origen (eje crudo) | `[bp-8]` del llamador | `[bp-0xa]` del llamador |
| `[bp+0xe]` | segundo origen (eje por 32) | `[bp+6]-5` del llamador | `[bp-0xc]` del llamador |
| `[bp+0x10]` | RADIO | `[bp+0xa]` del llamador | `0xa` |

⇒ **A corre con selector 1, B con selector 0.**

★ **`[bp+6]` NO SE LEE NUNCA en el cuerpo.** Los dos llamadores empujan 32, y el paso de
32 está **cableado** en la rutina como `shl` de 5 (0x5b4f, 0x5b6a, 0x5c09, 0x5c20, 0x5c37,
0x5c85). Es un argumento **muerto**: coincide con el paso real, pero no lo causa. Quien
documente esto no debe escribir «stride = 0x20» como si la rutina lo obedeciera —
obedece al `shl`.

## 3. Qué hace cada pasada: la topología está CRUZADA

Los dos sitios que discriminan:

| offset | instrucción | con selector 1 | con selector 0 |
|---|---|---|---|
| 5b5f | `cmp word ptr [bp - 0x20e], 0` / `jne 0x5b90` | va a 0x5b90 | cae a 0x5b66 |
| 5be1 | `cmp word ptr [bp - 0x20e], 0` / `jne 0x5beb` | va a 0x5beb | salta a 0x5c9c |

**Selector 1** (base `0xab02`), en 0x5b90: `cmp byte ptr [si], 0xff` — sigue expandiendo
sólo si la celda de su propio búfer aún vale 0xFF. Y en 0x5beb-0x5c45 consulta la
opacidad (`call 0x5dfe`) y, si la celda es transparente, mira **`0xAD14`** dos veces:

| offset | instrucción |
|---|---|
| 5c29 | `cmp byte ptr [bx + di - 0x52ec], 0` |
| 5c40 | `cmp byte ptr [bx + di - 0x52ec], 0` |

(`-0x52ec`, leído como desplazamiento con signo, es `0xad14`.)

**Selector 0** (base `0xad14`), en 0x5b66-0x5b8e, mira y toca **`0xAB02`**:

| offset | instrucción | lectura |
|---|---|---|
| 5b70 | `cmp byte ptr [bx + di - 0x54fe], 0` | si la celda vale cero, deja de expandir |
| 5b7e | `cmp ax, 0x1f` / `jg` | y si el origen más el desplazamiento pasa de 31, también |
| 5b89 | `mov byte ptr [bx + di - 0x54fe], 0` | ★ **PONE A CERO esa celda de `g_vis_buffer`** |

(`-0x54fe` es `0xab02`.)

⇒ **cada pasada consulta el búfer que la otra usa como destino.** Y la de selector 0 no
sólo consulta: **borra**.

**Lo que las DOS hacen en común** (el cuerpo compartido) es lo que da sentido a la
rutina: en 0x5bc3 pide el puntero al terreno (`call 0x4402`, el mismo `tile_addr` de
#119), lee el tile en 0x5bc8, y en 0x5c97 `mov byte ptr [si], al` lo **escribe en el
búfer de destino**. No es «una rutina de visibilidad»: es un **constructor de ventana de
tiles por inundación**, parametrizado por destino, origen y radio.

## 4. ★ El ORDEN, que es lo que decide qué significa el borrado

> ### ★ CORRECCIÓN EN SITIO (30-07-2026, carril #219) — §4 REFUTADO
>
> **Qué se refuta:** el «protocolo entre fotogramas» de esta sección — la idea de que el
> `mov 0` de `0x5b89`, en el fotograma N, cayera sobre el `g_vis_buffer` **del fotograma
> anterior**, y que la pasada de luces fuera **gastando** la máscara vieja como dominio.
> **Es falso.** El llamador
> re-siembra `0xAB02` a 0xFF (121 celdas, 11 filas × 11 B, paso 32) **DENTRO del bucle POR
> EMISOR** — `0x5f23-0x5f3d`, cuatro instrucciones antes del `call 0x5a28` de `0x5f57` que
> esta acta sí citó, con la cabeza del bucle en `0x5efe` y el cierre `jl 0x5efe` en
> `0x5f63`. `0xAB02` es un **rascadero POR EMISOR**, no la máscara del fotograma anterior,
> y el cero es la **marca de VISITADO** que el brazo de luces necesita porque su destino
> (`0xAD14`) **acumula** entre emisores mientras el dedupe del otro brazo (`0x5b90 cmp
> byte ptr [si], 0xff`) mira el destino.
>
> **Qué NO se refuta:** el ORDEN medido en esta sección (la pasada de luces corre en
> `0x594e`, antes del `0x5987`), que se ha reproducido y sigue en pie; ni §1-§3, ni §5, ni
> §6. Y la pregunta que esta sección declaró **sin firmar** («no he leído si 0x5d0a repone
> 0xab02 entero») era la correcta y está contestada: repone **121 celdas** y **sólo en la
> rama de recálculo**, así que el borrado **sí es observable** — su consumidor es
> `0x59ad`, la rama incremental del mismo repintado.
>
> Derivación completa: `re/notes/deriv-219-acta.md` §5-§7. Alcance observable derivado en
> `re/notes/deriv-220-acta.md` §6.


Las dos pasadas cuelgan del MISMO cuerpo, el repintado de la ventana 11x11 (0x5910):

| offset | instrucción | qué lanza |
|---|---|---|
| 594e | `call 0x475a` | el recolector de emisores; dentro, en 0x47df, hay un `call 0x5e4a` → pasada de selector 0 |
| 5987 | `call 0x5d0a` | el constructor de la ventana de la party → pasada de selector 1 |

⚠ **Los dos párrafos que siguen están REFUTADOS** — ver la corrección en sitio al inicio de
esta §4. Se conservan porque el ORDEN que miden sigue en pie; la INFERENCIA que sacan de él,
no.

**La de luces corre ANTES.** Con eso, el `mov byte ptr [bx + di - 0x54fe], 0` de 0x5b89
cae sobre el `g_vis_buffer` **del fotograma anterior**, no sobre uno recién construido:
la pasada de luces usa la máscara vieja como dominio de propagación y la va **gastando**
a medida que avanza. Es coherente con el resto (por eso 0x5b70 trata el cero como
«hasta aquí»), pero es un protocolo entre fotogramas, no un cálculo dentro de uno.

**No firmo el protocolo completo**: no he leído si 0x5d0a repone `0xab02` entero antes de
su propio recorrido, y de eso depende si el gasto de la pasada de luces tiene o no efecto
observable en el fotograma siguiente. Es la pregunta afilada que le queda a quien porte
esto, y la dejo planteada en vez de resuelta.

## 5. ★ `0xAD14` está DOBLEMENTE CONTABILIZADO — y la tarjeta hereda una etiqueta sin cita

La tarjeta llama a `0xAD14` «buffer de FUENTES DE LUZ». Esa etiqueta no viene del binario:
viene del **docblock del propio port** (`visibility.ts`), y de ahí saltó al enunciado.
Mientras tanto, el ledger ficha `0xAD14` como el **registro de mapa de combate** cargado
plano, 352 bytes, paso 32 — y el port **también** lo cita así en otro fichero
(`combat.ts`, «COMBAT.OVL 0x111A escribe el buffer 0xAD14»). Dos dueños, dos nombres,
la misma dirección, en el mismo repositorio.

Y el binario dice que las **extensiones tampoco coinciden**. La cabecera del recolector
de emisores:

| offset | instrucción |
|---|---|
| 5e59 | `mov word ptr [bp - 2], 0xad14` |
| 5e5e | `mov cx, 0x400` |
| 5e61 | `mov di, 0xad14` |
| 5e68 | `mov ax, 0xff` |
| 5e6b | `repne stosb byte ptr es:[di], al` |

**1024 bytes** puestos a 0xFF desde `0xAD14`, no 352. (El mismo tamaño reaparece en
0x5f68.) O sea que la pasada de luces trata esa dirección como un rascadero de 1 KiB y el
combate como un registro de 352 B.

⇒ **no es que la etiqueta esté mal: es que hay dos usos y nadie los ha separado.** Esto
es exactamente la familia de #68 —extensión declarada contra extensión real— repitiéndose
en el búfer de al lado, y merece tarjeta propia: hoy `globals.json` publica un solo dueño
y una sola extensión para una dirección que tiene dos de cada.

## 6. El cruce con #68, que sale confirmado por tercera vía

La tarjeta pedía comprobar si la extensión de 352 B la explica la pasada de luces.
**No la explica: la confirma, y por el otro lado.** Lo que fija los 352 es la geometría de
la inundación, no la pasada:

- los desplazamientos se acotan en 0x5b26-0x5b40 a `[0, 0xa]` en los dos ejes ⇒ **11 x 11**;
- el índice sobre `0xab02` es `(dy << 5) + dx` (0x5b6a con `cl = 5`) ⇒ **paso 32**;
- 11 filas x 32 = **352**.

★ Y de paso explica **por qué** 352 con sólo 11 columnas ocupadas, que es lo que #68 dejó
como «paso no escrito»: el paso es 32 porque el desplazamiento es de 5 bits, cableado; no
porque haya 32 columnas de nada. La cola de 21 bytes por fila no está reservada para
datos, es el resto de una potencia de dos.

Tercera vía independiente para #68: la primera fue el censo del propio #68, la segunda el
paso 0x20 que empujan los llamadores (que resulta ser el argumento muerto de §2 — o sea,
**una corroboración más débil de lo que parecía**), y ésta es la aritmética del cuerpo,
que es la que manda.

## 7. Careo con el port — las tres preguntas de la tarjeta

**1) ¿Modela la segunda pasada?** **SÍ, y con más detalle del que la tarjeta suponía.**
`visibility.ts` la tiene documentada y portada: la tabla de tiles emisores (10 bytes,
`EMITTER_TILES`), el recorrido del chunk por 0x475A→0x5E4A, el radio 10
(`EMITTER_LIGHT_RADIUS`, citando `mov ax,0xa` en 0x5f3f) y la consulta desde el pase de la
party en 0x5c29/0x5c40. La premisa del enunciado —«si no la modela, es mecánica ausente»—
**no se cumple**.

**2) ¿Bajo la condición correcta (#144)?** El port **declara** que no: dice que el merge
exacto es «una aproximación CONSERVADORA declarada (nunca revela más que el original)» y
enumera sus dos recortes (sólo emisores dentro de la ventana; contigüidad posiblemente
corta). Eso es honesto y está en el sitio. **Lo que NO aparece por ninguna parte del
docblock es la escritura de vuelta**: que la pasada de luces ponga a cero celdas de
`g_vis_buffer` (0x5b89) no está ni modelado ni declarado como no-modelado. Es el hueco
real de esta tarjeta, y es de la clase peligrosa —una omisión que nadie ha declarado—,
aunque su efecto depende del protocolo entre fotogramas de §4, que sigue sin cerrar.

**3) ¿Documentar el selector en el docblock?** Es edición de `game/src` y este carril no
toca código. Queda derivado y listo para quien lo aterrice: **el selector es
`[bp-0x20e]`, no se pasa, nace a cero en 0x5a48 y sube a uno en 0x5a62 sólo cuando el
cuarto argumento llega con el centinela `0xff91`, que además se sustituye por cero.**
Con esa frase, los dos `cmp` de §3 dejan de parecer arbitrarios.

★ Corrección menor que el docblock sí pide: la línea que dice «el bloque 5c19-5c45 es la
consulta al buffer de FUENTES DE LUZ 0xAD14» está **en el lado correcto pero con el
nombre discutido** (§5), y omite que la relación es recíproca — la otra pasada escribe en
`0xab02`.

## 8. Lo que este carril NO ha hecho

- No se ha leído 0x5d0a entero, así que §4 deja abierto si `0xab02` se repone por
  completo en cada fotograma. Sin eso no se puede decir si el borrado de la pasada de
  luces es observable.
- No se ha adjudicado quién es el dueño legítimo de `0xAD14` ni con qué extensión: §5
  documenta el choque, no lo resuelve.
- No se ha tocado `visibility.ts`.
