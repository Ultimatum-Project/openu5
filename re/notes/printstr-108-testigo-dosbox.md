# #108 — el ORIGINAL, observado: `"Ready...\n\n"` a media fila deja UNA fila en blanco

**Carril:** oracle-108 · **Fecha:** 2026-08-05 · **Método:** dosbox-x headless propio
(`re/tools/oracle.py` + `re/tools/oracle_capture.py`), captura planar del front buffer
EGA en modo 0x0D, conteo de filas por bandas de 8 px sobre la ventana de consola.

**Encargo:** dar al lado del ORIGINAL de la tarjeta #108 un testigo por EJECUCIÓN, no
sólo por lectura de ASM.

---

## 0. Veredicto

**El original sigue el MODELO DE CURSOR, y ahora está OBSERVADO.** Con el cursor a media
fila, `"Ready...\n\n"` deja **exactamente UNA** fila en blanco. Un modelo de líneas puro
(el `split("\n")` que el port tenía antes de #108) dejaría **DOS**.

La derivación de `printstr-1850-derivacion.md` **queda confirmada por un tercer camino**,
independiente de los dos anteriores: no es lectura de código del port, ni lectura del
disasm — es el binario corriendo.

## 1. 🔴 ALCANCE — lo que esto NO es

**Esto NO adjudica el residuo §3 de `printstr-108-impl.md`.** Hay que decirlo antes que el
resultado, porque el resultado invita a estirarlo:

| | |
|---|---|
| Lo que mide este acta | `"Ready...\n\n"` (DS 0x6e2e) emitido DENTRO de una llamada, con la fila abierta por el propio `>` + texto de esa misma llamada |
| Lo que pide §3 | `"\n\nItem: "` (DS 0x97d8) con la fila abierta por una llamada **ANTERIOR** (`messageAppend`) |

Son **el mismo mecanismo** (un `\n` sobre fila abierta la cierra sin dejar blanco), pero
**no el mismo caso**: el port ya acierta el caso de este acta —`pushConsole` abre y cierra
su fila dentro de la llamada— y sólo diverge cuando la columna viene de **otra** llamada,
que es justo lo que el port no arrastra. **El discriminante cruzado sigue sin observar.**

Lo que este acta aporta es la **regla**, no el residuo: la aritmética de filas del
original deja de ser inferencia.

## 2. La medición

Ventana de consola del original, localizada sobre la captura (nativo 320×200): marco azul
en `x=185..190` y `x=313..318`; borde blanco en `x=191` e `y=87` ⇒ **área de texto
`x 192..312`, `y 88..199`** = 14 filas de 8 px. Se cuenta como «fila con texto» la que
tiene algún píxel de índice EGA 15 (blanco); el marco es azul (1) y el fondo negro (0),
así que el filtro por blanco excluye bordes sin depender de dónde caigan.

Tras pulsar `R` en el mundo:

```
fila 10  >Ready...
fila 11  (en blanco)          ← UNA, no dos
fila 12  Player: ▂            ← el prompt, con cursor
```

Mapa de ocupación de las 14 filas (`#` = glifos, `.` = vacía): `..........#.#.`

**Predicción del modelo de cursor: 1 blanco. Predicción del modelo de líneas: 2. Observado: 1.**

## 3. Réplica, y de qué es la diferencia

Dos arranques **independientes** del emulador (dos `oracle.boot()` distintos, run-dirs
distintos). Comparadas las capturas nativas tras `R`:

- diferencia total: **32 píxeles**, todos dentro de la consola,
- todos en las filas de píxel **96..103**, que es la fila de texto **12** — la del prompt,
  donde parpadea el cursor,
- **filas 10 y 11: byte-idénticas** entre arranques. El dato que sostiene el veredicto es
  el que no se mueve.

## 4. Lo que NO se pudo montar, y se declara

- ~~La pantalla `Item: `~~ → **ALCANZADA. Ver §4-ter, y el resultado NO cuadra.** (La
  tecla era **Enter**; el `1` que probé de verdad no hace nada — verificado también por
  columnas, no sólo por filas.)
- ~~El falsador de `(L)ook`~~ → **CORREGIDO: sí se midió. Ver §4-bis.** Lo que escribí
  aquí primero («ninguna tecla se registró, arranque degenerado») era **falso**, y el
  error era de mi instrumento, no del emulador.

## 4-bis. 🔴 EL FALSADOR DE `(L)ook`: CORRIDO, Y EL MODELO SOBREVIVE

**Corrección de mi propio §4.** Di por «arranque degenerado» un arranque que había
funcionado: la `l` SÍ se registró y el original SÍ imprimió. No lo vi porque **mi
instrumento contaba FILAS OCUPADAS**, y lo que `Look` hace es justamente escribir en una
fila que YA estaba ocupada — el mapa de filas no puede distinguir «no pasó nada» de
«se pegó texto a la fila de abajo». Medí la ocupación cuando la pregunta era el contenido.

Re-medido sobre las MISMAS capturas, contando columnas con glifo en la fila 12:

| Captura | Columnas con tinta en la fila 12 | Extensión |
|---|---|---|
| antes de `L` | 14 | x 0..15 (`>` + cursor) |
| tras `L` | **45** | x 0..55 (`>Look-` + cursor) |

Y la pantalla lo confirma: **`>Look-` está en la MISMA fila que el prompt**, sin abrir
una nueva.

**Predicción de §8.5 punto 4:** *«`Look` no cierra su fila; lo que se imprima a
continuación aparece en la MISMA fila, pegado. Si el original lo pone en fila propia, el
modelo de cursor es falso y toda §7 cae.»*

**Observado: NO abre fila propia. El modelo de cursor SOBREVIVE a su falsador.**

Esto vale más que la confirmación de §2: aquel experimento sólo podía confirmar; éste
podía **refutar** —y no lo hizo—. Un modelo que sólo acumula confirmaciones no ha sido
puesto a prueba.

*Por qué las teclas siguientes «no hacían nada»:* `Look-` es un prompt **modal de
dirección**. Ni `\n` ni `r` son direcciones, así que el juego las descartó y la pantalla
quedó congelada — que es exactamente lo que un observador apresurado lee como «el arnés
está roto». Las capturas 12/20/21/22 son **byte-idénticas** entre sí: 0 píxeles de
diferencia. No era el arnés.

## 4-ter. 🔴 EL DISCRIMINANTE CRUZADO, OBSERVADO — Y CONTRADICE LA PREDICCIÓN

> ### ✅ ADENDA 2026-08-05 (carril `printstr-reconc`) — RECONCILIADO: tus cifras valen, la predicción no
>
> **Las dos mediciones de esta sección son CORRECTAS y siguen en pie.** Lo que caía no era
> el modelo de cursor: era la **dirección** de la predicción que te mandaron comprobar.
>
> **Adjudicada tu candidata (3), «el prompt llega por otra ruta»**, en forma más fuerte: la
> pantalla del Ready **no imprime `"\n\nItem: "`**. Imprime **DS 0x9998 = `b'Item: \x00'`**,
> pelado (`cmd_ready` @0x12cc). El único `0x0a` que ves lo emite el **idioma de cierre del
> call-site** en ZSTATS `004d–0058` (mide la columna; como el nombre la dejó en 14, salta
> una vez). `"\n\nItem: "` (DS 0x97d8) vive en otra parte: la envoltura de **rechazo**
> 0x0bee, único llamador 0x0d30, *«Thou hast no ammunition for that weapon!»*.
>
> Con la cadena correcta el modelo **reproduce tu captura fila por fila, las cuatro**,
> incluido el desplazamiento de una fila respecto a §2 — que resulta ser la firma del scroll
> (`mov si, 0xfff8` = −8 px = 1 fila) al rebasar ese `0x0a` el borde inferior. Tus dos
> capturas, juntas, **derivan `N = 1`**: el scroll conserva los blancos, así que 2 saltos
> darían 1 blanco pase lo que pase.
>
> **Tus candidatas (1) y (2) quedan descartadas:** `1742` es un `inc` incondicional, y el
> nombre SÍ deja el cursor donde creías (columna 14) — es justo lo que dispara la guarda.
>
> **Se retira** de esta sección la lectura de «contradicción» y la consecuencia que anotaba
> en *«Qué queda tocado»*: la cifra «original: 1 blanco» de `printstr-108-impl.md` §3
> **NO queda contradicha** —describe `"\n\nItem: "`, que existe y se imprime en 0x0bee— y la
> divergencia del port **NO es «2 contra 0»: sigue siendo «2 contra 1»**. En el caso que
> mediste, el port ya es **fiel** (`main.ts:3103` cita DS 0x9998 y da 0 blancos).
>
> **Tu decisión de no elegir mecanismo fue la correcta y evitó un daño real:** la candidata
> buena estaba entre las tres, y «la que sonara mejor» habría corregido a la baja una cifra
> que era correcta.
>
> Detalle, citas y el experimento de reemplazo (con poder discriminante real, al contrario
> que §8.5 punto 5): **`printstr-108-reconciliacion.md`**.

Alcanzada la pantalla de `(R)eady` (`r` → Enter). La consola queda así:

```
fila  9   >Ready...
fila 10   (en blanco)
fila 11   Player: Elwood
fila 12   Item: ▂
```

**Entre `Player: Elwood` y `Item: ` hay CERO filas en blanco.**

| | Predice | Observado |
|---|---|---|
| §8.5 / §3 — `"\n\nItem: "` a media fila | **1 blanco** | **0** |
| §3 — el port, en el mismo caso (cifra del acta, no re-medida aquí) | 2 blancos | — |

**Réplica:** dos arranques independientes, perfil de columnas por fila **idéntico**
(`…,44,0,73,35,0`). No es un transitorio.

**La cadena no es el error.** Leída byte a byte de `original/u5/ultima5/DATA.OVL`
(`fileoff = DS + 0x10`): `DS 0x97d8` → `b'\n\nItem: \x00'`. La tabla de
`printstr-1850-derivacion.md` §«Cadenas leídas del binario» está **bien**.

### 🔴 Lo que NO voy a hacer: inventar el mecanismo

Tengo dos observaciones del MISMO binario que no encajan bajo la misma regla tal como
está escrita en §8.5:

| Caso | Emitido desde | Blancos observados | §8.5 predice |
|---|---|---|---|
| `"Ready...\n\n"` | media fila | **1** | 1 ✔ |
| `"\n\nItem: "` | media fila (tras el nombre) | **0** | 1 ✘ |

La diferencia entre los dos es **dónde caen los `\n` respecto al texto** (detrás en el
primero, delante en el segundo). Se me ocurren reconciliaciones —que «cerrar» no avance
fila, que el nombre no deje el cursor donde creo, que el prompt `Item: ` venga por otra
ruta— **y no tengo evidencia para elegir entre ellas.** Escribir aquí la que suene mejor
sería exactamente [[linea-que-afirma-una-causa-que-no-observa]].

**Lo que este acta afirma:** las dos cifras, medidas y replicadas. **Lo que no afirma:**
por qué difieren. La reconciliación exige volver al ASM con esta observación delante — y
es trabajo de quien tenga el cuerpo de 0x1850 en la cabeza, no un párrafo mío.

### Qué queda tocado

- El **modelo de cursor** sobrevive donde se probó (§2 y §4-bis).
- La **cifra «original: 1 blanco»** de `printstr-108-impl.md` §3, que hasta hoy era
  derivación sin testigo, **queda contradicha por observación**. Si se confirma, la
  divergencia del port en ese caso no es «2 contra 1» sino **«2 contra 0»** — mayor que
  la declarada. 🔴 Y una cota declarada de menos es peor que ninguna: apaga la sospecha
  (ver [[cota-declarada-de-menos-desactiva-la-sospecha]], del mismo día).
- **No se ha tocado código.** El encargo era observar y reportar.

## 5. Trazabilidad — dos actas del mismo día que no se citaban

Este acta existe porque la ficha del encargo citaba un aviso **caducado**, y conviene
dejar cerrado el hueco:

| Hora (28-07) | Documento | Qué dice |
|---|---|---|
| 11:24 | `mix-flow-acta.md` (`98da7697`) | «nadie ha contado filas en DOSBox… falta la mitad del careo» |
| 13:09 | `printstr-1850-derivacion.md` (`7fb53109`) | *«cerrar el LADO DEL ORIGINAL… estaba A CERO»* — **la respuesta, 1 h 45 min después** |
| 18:55 | `printstr-108-impl.md` (`4f7483cc`) | «acta actualizada al estado MERGEADO» |

`grep printstr-1850 mix-flow-acta.md` → **0**. El aviso quedó fosilizado en el acta
citable mientras su respuesta se publicaba en otra, y todo el que citó la primera heredó
un hueco que ya estaba cubierto. **El aviso de `mix-flow-acta.md` §5 debe leerse con esta
fecha al lado.**

## 6. Evidencia

Las capturas son **frames del juego de EA**: por REGLA 4 no viajan en ficheros trackeados.
Viven en el scratch de la sesión (`<scratch>/ready-shots2/`, `ready-shots3/`), y lo que
esta acta publica es la **medición derivada** —el mapa de filas y el conteo—, que es
nuestra. Reproducible con `<scratch>/ready_rows2.py`: boot → `send_keys_until_main_menu`
→ `r` → `run_ticks` hasta `key_consumed` → `oracle_capture.capture_idx`.

🔴 **Dos trampas, para el siguiente. Las dos me costaron una lectura falsa:**

1. **`send_keys` inyecta en el buffer BIOS EN PAUSA**; sin `run_ticks` después, el juego
   nunca lee la tecla y la captura sale idéntica a la anterior. Mi primer intento midió
   dos veces la misma pantalla y parecía «la tecla no hace nada».
2. **Un mapa de FILAS OCUPADAS no ve un `append` a la fila en curso.** Es ciego
   precisamente al fenómeno que este acta estudia —el modelo de cursor consiste en
   escribir sin abrir fila— así que el instrumento obvio es el que no puede medirlo. Para
   `Look` hay que comparar **columnas con tinta dentro de la fila**, o los píxeles.
   Con el mapa de filas concluí «no se registró ninguna tecla»; con las columnas, la
   misma captura dice «se registró y el modelo sobrevive».
