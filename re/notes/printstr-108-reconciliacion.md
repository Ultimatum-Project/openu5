# #108 — RECONCILIACIÓN: el prompt `Item: ` del Ready es DS 0x9998 (pelado), no DS 0x97d8

**Carril:** printstr-reconc · **Fecha:** 2026-08-05 · **Método:** lectura del disasm
(`ZSTATS.OVL.asm`, `ULTIMA.EXE.asm`) + lectura de cadenas de `DATA.OVL` por byte, con la
observación del carril `oracle-108` delante. **Sin DOSBox, sin e2e, sin navegador.**

**Encargo:** `printstr-108-testigo-dosbox.md` §4-ter observó, replicado en dos arranques,
**0 filas en blanco** donde la derivación de `printstr-1850-derivacion.md` predecía **1**, y
dejó —correctamente— tres candidatas sin elegir. Adjudicar cuál, o derivar una cuarta que
explique **los dos** casos.

---

## 0. Veredicto

**Adjudicada la candidata (3), «el prompt llega por otra ruta» — y en una forma más fuerte
que la enunciada: la cadena que el flujo Ready imprime NO es la que la predicción suponía.**

| | |
|---|---|
| Lo que §8.5 punto 5 mandó observar | la pantalla `Item: ` del Ready, esperando `"\n\nItem: "` (DS 0x97d8) |
| Lo que el Ready imprime de verdad | **DS 0x9998 = `b'Item: \x00'`** — **pelado, sin un solo `0x0a`** (`cmd_ready` @0x12cc) |
| De dónde sale el único `\n` observado | del **idioma de cierre del CALL-SITE** en `ZSTATS 0x004d–0x0058`, ya documentado en la derivación §4.3 |

**El modelo de cursor no queda contradicho en nada.** Con la cadena correcta reproduce la
pantalla observada **fila por fila, las cuatro** (§2), incluido el desplazamiento de una fila
que separa las dos capturas del acta del oráculo. La contradicción era **de dirección**, no de
mecanismo: la predicción apuntó el testigo a una pantalla que no imprime la cadena bajo
estudio.

**Consecuencia para el residuo §3 de `printstr-108-impl.md`: NO se corrige. La cifra
«original: 1 blanco» sigue en pie**, porque describe `"\n\nItem: "` —que existe y se imprime,
pero en OTRO sitio (§4)—. La contingencia «2 contra 0» que temía el encargo **no se dispara**.

---

## 1. Las dos citas que cierran el caso

### 1.1 `cmd_ready` imprime la cadena PELADA

`re/disasm/ZSTATS.OVL.asm`, `cmd_ready` @0x1296:

```
129c: 2bc0              sub ax, ax
129e: 50                push ax
129f: e85eed            call 0                 ; ★ selector de jugador (§1.2)
12a2: 8946fc            mov word ptr [bp - 4], ax
12a5: 0bc0              or ax, ax
12a7: 7c62              jl 0x130b              ; abortado -> fin
12b5: ff76fc            push word ptr [bp - 4]
12b8: e8e9f2            call 0x5a4             ; busca ítem equipable (MUDO, §3)
12bb: 8946fe            mov word ptr [bp - 2], ax
12be: 3dffff            cmp ax, 0xffff
12c1: 7509              jne 0x12cc
12c3: b87e99            mov ax, 0x997e         ;   sin ítems: "Thou art empty-\nhanded!\n"
12c7: e8a623            call 0x3670
12ca: eb3f              jmp 0x130b
12cc: b89899            mov ax, 0x9998         ; ★★★ con ítems: DS 0x9998
12cf: 50                push ax
12d0: e89d23            call 0x3670            ; -> impresor 0x1850
```

Leído de `original/u5/ultima5/DATA.OVL` (`fileoff = DS + 0x10`):

| DS | Bytes | Quién la empuja |
|---|---|---|
| **0x9998** | **`b'Item: \x00'`** | `cmd_ready` @0x12cc — **el prompt observado** |
| 0x97d8 | `b'\n\nItem: \x00'` | **sólo** la envoltura 0x0bee (§4) |
| 0x48b1 | `b'Item: \x00'` | el flujo `(U)se` (el port ya lo cita, `main.ts:3245`) |

**Hay TRES cadenas `Item: ` en DATA.OVL, no una.** La derivación §5 sólo censó la de 0x97d8
—que era la que servía a su control positivo— y §8.5 punto 5 le atribuyó una pantalla que
la imprime otra.

### 1.2 El único `0x0a`: el idioma de cierre del call-site

El selector de jugador es la rutina en el offset **0** del overlay — **la misma que la
derivación §4.3 ya citaba en 0x004d como «el idioma, byte por byte»**, sin conectarla con
este caso:

```
002e: b8b496            mov ax, 0x96b4         ; "Player: "   (DS 0x96b4)
0032: e83b36            call 0x3670
0035: ff7604            push word ptr [bp + 4]
0038: e85f4b            call 0x4b9a            ; selector de tecla (MUDO, §3)
003b: 8946fe            mov word ptr [bp - 2], ax
003e: 0bc0              or ax, ax
0040: 7c19              jl 0x5b                ; cancelado -> ni nombre ni cierre
0042: b105              mov cl, 5
0044: d3e0              shl ax, cl             ; idx * 32
0046: 05a855            add ax, 0x55a8         ; -> registro del personaje = su NOMBRE
004a: e82336            call 0x3670            ; imprime "Elwood"
004d: e8e23c            call 0x3d32            ; -> 0x1f12: ¿en qué COLUMNA quedé?
0050: 0bc0              or ax, ax
0052: 7407              je 0x5b                ;   columna 0 -> NO gastes fila
0054: b80a00            mov ax, 0xa
0057: 50                push ax
0058: e87f34            call 0x34da            ; ★★★ -> 0x16ba: UN SOLO 0x0a
005b: 837efeff          cmp word ptr [bp - 2], -1
005f: 7509              jne 0x6a               ; selección válida -> ni "None!" ni el 2º \n
```

Para una selección válida (índice 0..5) el camino emite **exactamente un `0x0a`**: el de
0x0058. Las ramas de 0x0061 (`"None!\n"`, DS 0x96be) y de 0x0070 (un segundo `putchar`) son
para `-1` y `-2`, y quedan saltadas.

---

## 2. La pantalla observada, reconstruida fila por fila

Estado de partida = el que el propio acta del oráculo midió en su §2 (tras `R`, antes de
`Enter`): `>Ready...` en la fila 10, blanco en la 11, cursor en la **fila 12, columna 0**.

| # | Instrucción | Efecto sobre el cursor | Pantalla |
|---|---|---|---|
| 1 | `0032` imprime `"Player: "` | fila 12, col 0 → 8 | `Player: ` en la 12 |
| 2 | `0038` selector de tecla | **nada** (§3) | — |
| 3 | `004a` imprime `"Elwood"` | fila 12, col 8 → 14 | `Player: Elwood`, **misma fila** |
| 4 | `004d` mide: col = 14 ≠ 0 ⇒ `0058` emite `0x0a` | `1742: inc [si+5]` → fila 13 · `1745: [si+4]=0` | fila 13 **rebasa el borde inferior** ⇒ **SCROLL de una fila** (§2.1) y `1757: dec [si+5]` deja el cursor en la 12 |
| 5 | `12b8` busca el ítem | **nada** (§3) | — |
| 6 | `12d0` imprime `"Item: "` (0x9998) | fila 12, col 0 → 6 | `Item: ` en la 12 |

Resultado predicho:

```
fila  9   >Ready...          (era la 10; subió una por el scroll)
fila 10   (en blanco)        (era la 11)
fila 11   Player: Elwood     (era la 12)
fila 12   Item: ▂
```

**Es exactamente la captura de §4-ter, las cuatro filas, incluido el desplazamiento de una.**
Blancos entre `Player: Elwood` e `Item: `: **CERO** — porque sólo se emitió **un** `0x0a`, y
un `0x0a` sobre fila abierta la cierra sin quemar nada.

### 2.1 El scroll mueve UNA fila — y por qué eso no puede esconder un blanco

`ULTIMA.EXE.asm`, cola del emisor 0x16ba:

```
1749: 8a4405            mov al, byte ptr [si + 5]
174c: 024401            add al, byte ptr [si + 1]
174f: 3a4403            cmp al, byte ptr [si + 3]     ; ¿rebasa el borde inferior?
1752: 7e13              jle 0x1767
1754: e82008            call 0x1f77                   ; geometría en PÍXELES de la ventana
1757: fe4c05            dec byte ptr [si + 5]
175a: bef8ff            mov si, 0xfff8                ; ★ -8 PÍXELES = UNA fila de 8 px
175d: c70650532700      mov word ptr [g_snd_driver_fn], 0x27
1763: ff1e5053          lcall [g_snd_driver_fn]       ; el blit lo hace el DRIVER, fn 0x27
```

`0x1f77` no desplaza nada: es un ayudante sin prólogo que convierte el rectángulo de la
ventana a píxeles (`ax=izq*8, bx=sup*8, di=der*8+7, dx=inf*8+7`) y `ret`ea en 0x1f9e. El
desplazamiento real lo hace la llamada indirecta al driver de vídeo con `si = 0xfff8`.

★ **Corolario que hacía falta para leer la observación:** desplazar es visualmente idéntico
a avanzar de fila cuando ya estás en la última. Por eso **el scroll conserva el número de
blancos**: `N` saltos dejan `N-1` blancos haya scroll o no, y sólo cambian la posición
absoluta. Con `N = 2` habría **un** blanco pase lo que pase. Que se observen **0** exige
`N = 1`, y `N = 1` es lo que el ASM de §1.2 emite.

*(Este párrafo es lo que convierte la observación en un instrumento: el desplazamiento de
una fila entre las dos capturas del oráculo NO es ruido, es la firma de que exactamente un
`0x0a` rebasó el borde.)*

---

## 3. Censo: entre el nombre y el prompt no se imprime NADA

Las dos rutinas que corren entre el `0x0a` de 0x0058 y el `"Item: "` de 0x12d0:

| Rutina | Qué es | Censo |
|---|---|---|
| `0x4b9a` → kernel **0x2d7a** (sesgo +0xE1E0 de la derivación §4.3) | selector de tecla de personaje, **114 instrucciones** (0x2d7a..0x2e95) | llama a `0x266c`, `0x2a28`, `0x3f14`, `0x3f54`, `0x4e20`, `0x4e50` — **cero llamadas a 0x1850 y cero a 0x16ba** |
| **`0x5a4`** (local del overlay, 0x5a4..0x5df) | busca el siguiente ítem equipable; sólo llama a `0x518` | **cero llamadas a 0x3670 y cero a 0x34da** en 0x518..0x5a4 (censo completo del overlay abajo) |

Censo exhaustivo del overlay: **38** `call 0x3670` (impresor) y **34** `call 0x34da`
(emisor). Ninguno cae en 0x518..0x5a4 ni en el cuerpo del selector de tecla. Sólo **2**
`call 0x3d32` (consulta de columna) en todo `ZSTATS.OVL`: 0x004d y 0x06b9.

---

## 4. Quién es DUEÑO de `"\n\nItem: "`: la envoltura de RECHAZO 0x0bee

```
0bee: 55                push bp
0bf1: b8d497            mov ax, 0x97d4 -> "\n\n"
0bf5: e8782a            call 0x3670
0bf8: ff7604            push word ptr [bp + 4]        ; el MENSAJE de rechazo
0bfb: e8722a            call 0x3670
0bfe: b8d897            mov ax, 0x97d8 -> "\n\nItem: "
0c02: e86b2a            call 0x3670
0c06: c20200            ret 2
```

**Único llamador en todo el overlay** (`call 0xbee` aparece 1 vez):

```
0d0c: 837e041a          cmp word ptr [bp + 4], 0x1a   ; arco
0d12: 837e0424          cmp word ptr [bp + 4], 0x24   ; ballesta
0d18: 803edb5700        cmp byte ptr [g_equip_qty+27], 0   ; ¿flechas?
0d1f: 837e041c          cmp word ptr [bp + 4], 0x1c
0d25: 803edd5700        cmp byte ptr [g_equip_qty+29], 0
0d2c: b81c98            mov ax, 0x981c -> "Thou hast no ammunition for that weapon!"
0d30: e8bbfe            call 0xbee
```

`0x0bee` es un **«mensaje de rechazo + REIMPRIME el prompt»** dentro del validador de
equipamiento (rutina 0x0c5c). Sus vecinas en DATA.OVL lo confirman: `"Armaments"`,
`"Done\n"`, `"Thou canst not change armour in heated battle!"`, `"\n\nRing vanishes!\n"`.

★ **Por qué se rodea de `"\n\n"` por los dos lados:** no puede saber en qué columna quedó el
mensaje anterior, así que emite el par «cierra lo que haya + una en blanco» a ambos flancos.
Es el idiotismo defensivo del que no mide la columna — el opuesto exacto del de 0x004d, que
la mide y por eso emite **uno** o **ninguno**. **Los dos conviven en el mismo binario**, y
confundirlos es lo que produjo la contradicción.

**La aritmética de la derivación §5 para `"\n\nItem: "` es CORRECTA** (a media fila: 1 blanco;
desde columna 0: 2). Lo único equivocado era **su domicilio**.

---

## 5. 🔴 Por qué el experimento no podía salir bien: discriminante NULO por construcción

`printstr-1850-derivacion.md` §8.5 punto 5 se vendía como *«el discriminante más fino: es el
único que distingue el modelo de cursor de un modelo de líneas puro»*. Con las cadenas reales
en la mano:

| Hipótesis | Qué predice para la pantalla del Ready |
|---|---|
| Modelo de **cursor** | `"Player: "` + nombre, un `0x0a` de cierre, `"Item: "` ⇒ **0 blancos** |
| Modelo de **líneas puro** | fila `Player: Elwood`, fila `Item: ` ⇒ **0 blancos** |

**Las dos predicen lo mismo.** La pantalla elegida no tiene **ningún** poder discriminante:
el `0x0a` de 0x0058 se emite con la columna a 14, y ahí un modelo de líneas también cierra
fila. El experimento no fue mal medido ni mal replicado —lo estuvo, dos veces— sino
**apuntado a un régimen donde el fenómeno no puede aparecer**, exactamente el género de
[[barrido-fuera-del-regimen-es-un-negativo-preordenado]] y
[[gate-falso-por-construccion-testigo-equivocado]].

Y el fallo aguas arriba es de la propia predicción: nombró una PANTALLA
(«la pantalla de inventario») cuando el sujeto era una CADENA. Nadie comprobó que esa
pantalla imprimiera esa cadena — [[testigo-sin-el-termino-no-es-testigo]].

**Mérito del observador, que conviene no perder:** su §4-ter se negó a elegir mecanismo sin
evidencia y dejó las tres candidatas abiertas. La correcta estaba entre ellas. Si hubiera
escrito «la que sonara mejor», habría corregido a la baja una cifra que era **correcta** y
habría metido en el port un arreglo contra un defecto inexistente.

---

## 6. Lo que se corrige y lo que NO

| Documento | Veredicto |
|---|---|
| **`printstr-108-impl.md` §3** (residuo: `"\n\nItem: "` a media fila ⇒ original 1 blanco, port 2) | ✅ **EN PIE, sin cambio.** Describe DS 0x97d8, que se imprime en 0x0bee. La contingencia «2 contra 0» **no se dispara** |
| El test DETECTOR de `game/tests/skin-coreview.test.ts:506` | ✅ **CORRECTO ya hoy**: su comentario dice *«re-prompt de la envoltura ZSTATS 0x0bee»*. Nada que tocar |
| El port en el caso OBSERVADO (`main.ts:3103`) | ✅ **FIEL ya hoy**: cita DS 0x9998 y hace `hud.message(READY_UI.item)` ⇒ 0 blancos, como el original |
| **`printstr-1850-derivacion.md` §5** (traza de `"\n\nItem: "`) | ⚠️ aritmética correcta, **domicilio equivocado**: no es la pantalla del Ready. Adenda puesta |
| **`printstr-1850-derivacion.md` §8.5 punto 5** (predicción falsable) | ❌ **MAL DIRIGIDA y sin poder discriminante.** Adenda puesta, con el reemplazo de §7 |
| **`printstr-108-testigo-dosbox.md` §4-ter** | ⚠️ las dos cifras **siguen siendo válidas como medición**; su lectura como contradicción del modelo, retirada. Adenda puesta |
| `game/src` | **NO TOCADO** (el encargo lo excluye; y no hay nada que arreglar aquí) |

---

## 7. El experimento que SÍ discrimina (pre-registrado, no corrido)

Para quien tenga el oráculo montado. **Régimen:** equipar un **arco o ballesta** (item 0x1a /
0x24) en un personaje con **0 flechas** (`g_equip_qty+27 == 0`) ⇒ dispara 0x0d2c → 0x0bee.

Partiendo de `Item: <nombre>` con la columna > 0, el modelo de cursor predice, con la ventana
de ~15 columnas que el propio `"Thou art empty-\nhanded!"` ya exhibió:

```
Item: Bow
                        <- UN blanco (el 1er \n de 0x97d4 cierra la fila viva)
Thou hast no
ammunition for
that weapon!
                        <- UN blanco (el 1er \n de 0x97d8 cierra la fila viva)
Item:
```

- **Modelo de cursor: 1 blanco a cada lado.** **Modelo de líneas puro: 2 a cada lado.**
- **Refuta esta acta** cualquier resultado distinto de 1+1 en los blancos.
- Es el mismo mecanismo del residuo §3 y **con poder discriminante real**, al revés que
  §8.5 punto 5.

*Trampa declarada:* el mensaje **reflowea** (40 caracteres en ~15 columnas), así que el
número de filas de TEXTO depende del ancho exacto de la ventana; **lo que se mide son los
BLANCOS**, que el reflujo no altera (§3.4 de la derivación: el reflujo blando sólo apunta
deuda cuando la línea no llega al borde, y esa deuda se cobra siempre dentro de la llamada).

---

## 8. Etiquetado de cada afirmación

| Afirmación | Estatus |
|---|---|
| Las dos pantallas de `oracle-108` (1 blanco tras `Ready...`; 0 entre `Player:` e `Item:`) | **MEDIDO** por `oracle-108`, replicado ×2. **No re-medido aquí** |
| `cmd_ready` @0x12cc empuja DS 0x9998; DS 0x9998 = `b'Item: \x00'` | **MEDIDO** (bytes de DATA.OVL) + **DERIVADO** (disasm) |
| El único `0x0a` del flujo sale de ZSTATS 0x0058, guardado por la columna en 0x004d | **DERIVADO** (lectura instrucción a instrucción, §1.2) |
| Selector de tecla y buscador de ítem no imprimen | **DERIVADO** por censo exhaustivo de `call 0x3670` / `0x34da` en el overlay (§3) |
| El scroll mueve exactamente 8 px = 1 fila | **DERIVADO** (`mov si, 0xfff8` + geometría ×8 de 0x1f77) |
| `"\n\nItem: "` pertenece a la envoltura de rechazo 0x0bee, único llamador 0x0d30 | **DERIVADO** (censo de llamadores) + **MEDIDO** (DS 0x981c) |
| La reconstrucción de las 4 filas de §2 | **DERIVADO**, y **casa con lo MEDIDO sin parámetros libres** |
| Que el borde inferior de la ventana de consola sea la fila 12 de la rejilla del oráculo | **INFERIDO** del desplazamiento observado + el `N=1` derivado. **No leído** del registro de ventana (se rellena en tiempo de ejecución). Predicción barata que lo falsaría: la fila 13 de esa rejilla debe estar **siempre vacía** en toda captura de consola |
| Los blancos predichos en §7 | **PREDICHO**, no observado |

---

## 9. Estado de la tarjeta #108 tras esta acta

- **La contradicción de §4-ter queda ADJUDICADA** y disuelta: candidata (3), en su forma
  fuerte (cadena distinta, no ruta distinta del mismo texto). Las candidatas (1) —«cerrar
  fila no avanza fila»— y (2) —«el nombre no deja el cursor donde se cree»— quedan
  **descartadas**: `1742` es un `inc` incondicional y el nombre deja la columna en 14, que
  es justo lo que hace saltar la guarda de 0x0050.
- **El modelo de cursor acumula un tercer régimen donde predice y acierta**, éste con
  aritmética de scroll incluida.
- **Nada que arreglar en el port por esta vía.** El residuo §3 sigue siendo el residuo §3,
  con su cifra intacta y su detector bien puesto.
- **Deuda que esta acta abre:** el experimento de §7, que es el que §8.5 punto 5 debió ser.
