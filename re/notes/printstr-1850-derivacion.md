# El impresor del kernel: cuerpo entero de 0x1850 y aritmética de filas

**Carril:** printstr-108 · **Fecha:** 2026-07-28 · **Método:** lectura pura del disasm
(sin e2e, sin DOSBox, sin navegador).

**Encargo:** cerrar el LADO DEL ORIGINAL de la tarjeta #108 (`pushConsole` mete una fila en
blanco de más por cada cadena terminada en `\n`). El lado del port está triple-confirmado;
el del original estaba A CERO porque nadie había trazado el bucle.

## ⚠ CUSTODIA: qué sabía yo ANTES de leer una sola instrucción

Otro carril derivó esta misma zona en paralelo. Declaro ítem por ítem lo que traía puesto,
en vez de una etiqueta global de «ciego» o «no ciego», que sería justo la respuesta
ambigua. Léase el resto del acta con estos pesos.

| Ítem | ¿Lo sabía antes? | Origen |
|---|---|---|
| Contenido de la tarjeta #108 | La leí como PRIMER paso, antes de abrir el disasm. **NO contenía regla derivada del original**: decía «LADO DEL ORIGINAL: A CERO», «el bucle NO está trazado», preguntas abiertas y vía recomendada | TaskGet |
| Que el modelo es de CURSOR, y que 0x1f12 devuelve la columna | **SÍ** | briefing del lead («lo ya derivado que no re-derivas») |
| Que existe un flag en `[bp-2]` consumido en 0x189a | **SÍ** — la ubicación, no la semántica | briefing, atribuido al carril ready-flow |
| ★ Las cifras esperadas de la pregunta 1 («el MODELO cursor predice 1 y 2») | **SÍ** | briefing |
| Punteros al material: DS 0x997e, la envoltura de ZSTATS 0x0bee, las cifras del port | **SÍ** | tarjeta + briefing |
| El camino instrucción a instrucción del cuerpo | NO | — |
| El emisor 0x16ba y la instrucción que decide el avance de fila | NO | — |
| Respuestas a las preguntas 2, 3, 4 y 5 | NO | — |

### Adjudicación del custodio (peso POR PREGUNTA, sin etiqueta global)

El lead adjudicó esta declaración y añadió dos precisiones que quedan aquí para que el acta
se lea sola:

- **La TARJETA está limpia como canal.** La leí antes de la ventana de contaminación; lo que
  recibí coincide con el estado «A CERO» previo a la fuga.
- **El vector parcial fue el BRIEFING DEL PROPIO CUSTODIO**, redactado horas antes de que se
  decidiera el doble ciego. Un testigo reclutado ANTES del embargo nunca es ciego respecto a
  su propio encargo. No es un defecto de este carril ni de la tarjeta: es un canal que no
  estaba censado.

| Pregunta | Peso adjudicado |
|---|---|
| 1 — aritmética de `«Pass\n»` y `«Ready...\n\n»` | **VERIFICACIÓN CON VALOR ESPERADO CONOCIDO.** Vale como confirmación instrucción a instrucción —el estándar failing-first funciona así—, **pero NO como segundo descubrimiento** |
| 2 — cursor fuera de la columna 0 | DERIVACIÓN INDEPENDIENTE, peso pleno |
| 3 — colapso de blancos consecutivos | DERIVACIÓN INDEPENDIENTE, peso pleno |
| 4 — **SEMÁNTICA** del flag (conocía su EXISTENCIA, no qué hace) | DERIVACIÓN INDEPENDIENTE, peso pleno |
| 5 — wrap horneado vs fin de entrada | DERIVACIÓN INDEPENDIENTE, peso pleno |
| El camino instrucción a instrucción del cuerpo entero | INDEPENDIENTE |

El único remedio real del sesgo de la pregunta 1 es el testigo de §8, que va pre-registrado
justo para eso.

**Fuentes citadas** (todas leídas con Python, nunca con `grep -r` — los `.asm` del worktree
son symlinks):

| Fichero | Rango leído |
|---|---|
| `re/disasm/ULTIMA.EXE.asm` | 0x1850–0x1a3b, CUERPO ENTERO; además 0x16ba–0x17f3, 0x1bf2, 0x1cee, 0x1f12, 0x1f77, 0x4a3a |
| `re/disasm/ZSTATS.OVL.asm` | 0x004d, 0x0bee |
| `original/u5/ultima5/DATA.OVL` | cadenas por DS (`fileoff = DS + 0x10`) |

El cuerpo tiene **201 instrucciones**, no ~120 como estimaba la tarjeta. Se leyó ENTERO,
incluido el sub-bucle de reflujo anidado.

---

## 0. Resumen ejecutivo (lo que responde la tarjeta)

El original **NO** es un modelo de líneas: es un **cursor (fila, columna)** sobre una ventana
de texto, y `0x0a` hace `inc` de la fila **SIN NINGUNA CONDICIÓN**. La consecuencia directa:

- **`«Pass\n»` desde columna 0 ⇒ UNA fila de contenido.** El `\n` final no crea fila: solo
  deja el cursor en la columna 0 de la fila siguiente. El port hace 2. **Sobra 1.**
- **`«Ready...\n\n»` desde columna 0 ⇒ UNA fila de contenido + UNA fila en blanco = 2.**
  El port hace 3. **Sobra 1.**
- **NO colapsa blancos consecutivos.** Dos `0x0a` seguidos = dos `inc` de fila = una fila
  realmente vacía.
- El flag diferido `[bp-2]` **NO es lo que la tarjeta suponía**: no tiene NADA que ver con
  los `\n` literales. Es exclusivo del reflujo blando (word-wrap) y se pone en un único
  sitio. La hipótesis del «`\n` diferido» queda **REFUTADA**.
- El `\n` de wrap horneado y el `\n` de fin de entrada **son el mismo byte y reciben el
  mismo trato**: el impresor no los distingue y no re-procesa el horneado.

Y un hallazgo que la tarjeta no pedía y que cambia el alcance del arreglo: **la lógica de
«no gastes una fila si ya estás en columna 0» existe, pero vive en los CALL-SITES, no en el
impresor** (kernel 0x4a3d y ZSTATS 0x004d, ver §4). Un port que solo hace `split("\n")` no
puede reproducirla porque no tiene noción de columna.

---

## 1. El marco de pila y la ventana de texto

```
1850: push bp
1851: mov bp, sp
1853: sub sp, 0x42          ; 66 B de locales
1856: push di
1857: push si
```

Mapa de locales (deducido de cada uso, no supuesto):

| Dirección | Papel |
|---|---|
| `[bp+4]` | argumento: puntero a la cadena (`ret 2` al final) |
| `[bp-0x40]`…`[bp-1]` | **búfer de línea de 64 bytes** (indexado `[bp+si-0x40]`) |
| `[bp-0x42]` | ANCHO de la ventana = `derecha - izquierda` |
| `[bp-2]` | flag de **salto pendiente** (diferido) |
| `[bp-4]` | flag «he roto línea a lo bruto» (dispara el recorte de blancos de cabeza) |
| `[bp-6]` | índice de LECTURA en la cadena de entrada |
| `[bp-8]` | flag de FIN (se puso el NUL) |
| `[bp-0xa]` | longitud del segmento y, tras ajuste, ÚLTIMO ÍNDICE a imprimir |
| `[bp-0xc]` | índice final tras imprimir (escrito en 0x1a2a, no vuelve a leerse) |
| `[bp-0xe]` | **RESTANTE** = ancho − columna actual |
| `[bp-0x10]` | puntero al registro de ventana |
| `[bp-0x12]` | índice de ARRANQUE dentro del búfer (salto de blancos de cabeza) |
| `[bp-0x14]`, `[bp-0x16]` | copias de respaldo de `[bp-6]` y `[bp-0xa]` para deshacer el reflujo |
| `[bp-0x18]` | flag de CENTRADO (bit 1 del byte de flags de la ventana) |

Inicialización y la salida temprana que ya decide algo:

```
1858: mov word ptr [bp - 6], 0        ; índice de lectura = 0
185d: mov word ptr [bp - 8], 0        ; fin = 0
1862: mov word ptr [bp - 2], 0        ; salto pendiente = 0
1867: mov bx, word ptr [bp + 4]
186a: cmp byte ptr [bx], 0
186d: jne 0x1872
186f: jmp 0x1a36                      ; ★ CADENA VACÍA -> no imprime NADA y sale
```

★ **Primera respuesta útil:** la cadena vacía no produce fila ni mueve el cursor. Un
`split("\n")` que empuje `""` ya diverge aquí.

La ventana:

```
1872: mov ax, word ptr [0x5386]       ; índice de ventana activa
1875: mov cl, 3
1877: shl ax, cl                      ; x8 -> registros de 8 bytes
1879: add ax, 0x535e                  ; base de la tabla de ventanas
187c: mov word ptr [bp - 0x10], ax
187f: mov bx, ax
1881: mov al, byte ptr [bx + 7]       ; byte de flags
1886: and ax, 2                       ; bit 1 = CENTRAR
1889: mov word ptr [bp - 0x18], ax
188c: mov al, byte ptr [bx + 2]       ; columna DERECHA
1891: mov cl, byte ptr [bx]           ; columna IZQUIERDA
1895: sub ax, cx
1897: mov word ptr [bp - 0x42], ax    ; ANCHO = derecha - izquierda
```

Registro de ventana de 8 bytes, **corroborado por dos lectores independientes** (este
cuerpo lo lee por `[bx+N]`; el emisor de 0x16ba lo lee por `[si+N]` a través del puntero
cacheado en `0x539a`):

| Desplazamiento | Contenido |
|---|---|
| +0 | columna izquierda (origen X) |
| +1 | fila superior (origen Y) |
| +2 | columna derecha |
| +3 | fila inferior |
| +4 | **COLUMNA del cursor** (relativa al origen) |
| +5 | **FILA del cursor** (relativa al origen) |
| +6 | atributo de color |
| +7 | flags (bit 1 = centrar) |

Que +4 sea la columna no es una suposición: 0x1f12 devuelve exactamente ese byte (§4), y
este mismo cuerpo lo consulta en 0x1981 para decidir si le hace falta un salto.

---

## 2. El bucle exterior: una pasada por SEGMENTO

Cada vuelta procesa un segmento (el texto hasta el próximo `0x0a`, `0x0d`, NUL o borde de
fila). La cabeza del bucle es 0x189a y el pie es 0x1a2d.

### 2.1 Cabeza: consumo del salto DIFERIDO

```
189a: cmp word ptr [bp - 2], 0
189e: je 0x18a7
18a0: mov ax, 0xa
18a3: push ax
18a4: call 0x16ba                     ; emite 0x0a AQUÍ, no donde se decidió
```

Este es el punto que la tarjeta señalaba. Ver §3.4 para su semántica exacta: **no es un
`\n` de la entrada**, es la deuda del reflujo blando de la vuelta anterior.

### 2.2 Medición de la columna viva

```
18a7: sub ax, ax
18a9: mov word ptr [bp - 0x12], ax    ; arranque = 0
18ac: mov word ptr [bp - 4], ax       ; rompí-línea = 0
18af: mov word ptr [bp - 2], ax       ; pendiente = 0
18b2: mov si, ax                      ; si = índice de ESCRITURA en el búfer
18b4: call 0x1f12                     ; ax = COLUMNA actual del cursor
18b7: mov cx, word ptr [bp - 0x42]
18ba: sub cx, ax
18bc: mov word ptr [bp - 0xe], cx     ; RESTANTE = ancho - columna
18bf: mov di, cx
```

★ El impresor **remide la columna en cada vuelta**. Es un cursor, no un modelo de líneas.
El `call 0x1f12` va DESPUÉS del salto pendiente: el orden importa, y por eso el salto se
difiere (§3.4).

### 2.3 Copia al búfer, hasta terminador o hasta llenar la fila

```
18c1: mov dx, word ptr [bp + 4]       ; base de la cadena
18c4: mov cx, word ptr [bp - 6]       ; índice de lectura
18c7: jmp 0x18eb
18ca: mov bx, cx / add bx, dx
18ce: cmp byte ptr [bx], 0xd
18d1: je 0x18f4                       ; CR -> corta
18d3: mov bx, cx / add bx, dx
18d7: cmp byte ptr [bx], 0
18da: je 0x18f4                       ; NUL -> corta
18dc: cmp si, di
18de: jg 0x18f4                       ; ★ búfer/fila llenos -> corta
18e0: mov bx, cx / add bx, dx
18e4: mov al, byte ptr [bx]
18e6: mov byte ptr [bp + si - 0x40], al
18e9: inc cx
18ea: inc si
18eb: mov bx, cx / add bx, dx
18ef: cmp byte ptr [bx], 0xa
18f2: jne 0x18ca                      ; LF -> cae a 0x18f4 y corta
18f4: mov word ptr [bp - 0xa], si     ; LONGITUD del segmento
18f7: mov word ptr [bp - 6], cx
```

Cuatro condiciones de corte: `0x0a`, `0x0d`, NUL y `si > RESTANTE`. El índice de lectura
queda APUNTANDO al terminador (no lo consume).

### 2.4 Segmento VACÍO: la rama que decide todo lo de la tarjeta

```
18fa: or si, si
18fc: jne 0x191c                      ; hay contenido -> §2.5
18fe: mov bx, cx
1900: mov si, word ptr [bp + 4]
1903: cmp byte ptr [bx + si], 0
1906: je 0x1916
1908: inc word ptr [bp - 6]           ; consume el terminador
190b: mov al, byte ptr [bx + si]      ; ...que es 0x0a o 0x0d
190f: push ax
1910: call 0x16ba                     ; ★★★ LO EMITE VERBATIM
1913: jmp 0x1a2d
1916: inc word ptr [bp - 8]           ; era NUL -> FIN
1919: jmp 0x1a2d
```

★★★ **Núcleo de la respuesta.** Cuando el segmento sale vacío —es decir, cuando el
carácter en curso YA es un `\n`— el impresor lo manda **tal cual** al emisor y vuelve al
principio. No lo agrupa, no lo cuenta, no lo colapsa. Cada `0x0a` de la entrada pasa por
aquí **exactamente una vez** y produce **exactamente una** llamada al emisor.

### 2.5 Segmento con contenido: ¿cabe?

```
191c: mov ax, word ptr [bp - 0xe]     ; RESTANTE
191f: cmp word ptr [bp - 0xa], ax     ; LONGITUD
1922: jg 0x1927                       ; no cabe -> reflujo (§3)
1924: jmp 0x19d2                      ; cabe -> ajustar y pintar
...
19d2: dec word ptr [bp - 0xa]         ; longitud -> ÚLTIMO ÍNDICE
```

El `dec` convierte cuenta en índice inclusivo, porque el bucle de pintado de 0x1a26 usa
`jle`. Con `«Pass»`: longitud 4, último índice 3, pinta `[0..3]`.

### 2.6 Pintado y pie del bucle

```
19fd: cmp word ptr [bp - 4], 0        ; ¿rompí línea a lo bruto?
1a01: je 0x1a14
1a03: mov cx, word ptr [bp - 0x12]    ; sí -> saltar blancos de cabeza
1a08: inc cx
1a09: mov si, cx
1a0b: cmp byte ptr [bp + si - 0x40], 0x20
1a0f: je 0x1a08
1a11: mov word ptr [bp - 0x12], cx
1a14: mov si, word ptr [bp - 0x12]    ; arranque
1a17: mov di, word ptr [bp - 0xa]     ; último índice
1a1a: jmp 0x1a26
1a1c: mov al, byte ptr [bp + si - 0x40]
1a21: push ax
1a22: call 0x16ba                     ; emite carácter a carácter
1a25: inc si
1a26: cmp si, di
1a28: jle 0x1a1c
1a2a: mov word ptr [bp - 0xc], si
1a2d: cmp word ptr [bp - 8], 0        ; ¿FIN?
1a31: jne 0x1a36
1a33: jmp 0x189a                      ; otra vuelta
1a36: pop si / pop di / mov sp, bp / pop bp
1a3b: ret 2
```

El pintado es inclusivo `[arranque … último]`. Si el último índice queda por debajo del
arranque no pinta nada.

---

## 3. El reflujo anidado, 0x1927–0x19d0

Solo se entra aquí cuando el segmento **no cabe** en lo que queda de fila.

### 3.1 Respaldo y búsqueda hacia atrás de un espacio

```
1927: mov ax, word ptr [bp - 0xa]
192a: mov word ptr [bp - 0x16], ax    ; respaldo de la longitud
192d: mov ax, word ptr [bp - 6]
1930: mov word ptr [bp - 0x14], ax    ; respaldo del índice de lectura
1933: mov si, word ptr [bp - 0xa]
1936: mov dx, word ptr [bp + 4]
1939: mov cx, ax
193b: jmp 0x195f
193e: or si, si
1940: je 0x1968                       ; agotado -> no hay espacio
1942: cmp byte ptr [bx], 0xa
1949: je 0x1968
194b: cmp byte ptr [bx], 0
1952: je 0x1968
1954: cmp byte ptr [bx], 0xd
195b: je 0x1968
195d: dec si
195e: dec cx
195f: mov bx, cx / add bx, dx
1963: cmp byte ptr [bx], 0x20
1966: jne 0x193e                      ; no es espacio -> sigue retrocediendo
1968: mov word ptr [bp - 0xa], si     ; corte en el espacio
196b: mov word ptr [bp - 6], cx
```

Retrocede en paralelo por la cadena (`cx`) y por el búfer (`si`) buscando un `0x20`.

### 3.2 No hay espacio: la ÚNICA condición de columna del impresor

```
196e: or si, si
1970: jne 0x1996
1972: mov ax, word ptr [bp - 0x16]    ; deshace el respaldo
1978: mov ax, word ptr [bp - 0x14]
197e: mov bx, word ptr [bp - 0x10]    ; registro de ventana
1981: cmp byte ptr [bx + 4], 0        ; ★ ¿COLUMNA == 0?
1985: je 0x19ca                       ;   sí -> NO gastes un salto
1987: mov ax, 0xa
198a: push ax
198b: call 0x16ba                     ;   no -> rompe a la fila siguiente
198e: mov word ptr [bp - 4], 1        ; y marca para comerse los blancos de cabeza
1993: jmp 0x19ca
```

★ `[bx+4]` es la **columna del cursor**, no un flag de configuración. Este es el **único**
punto de todo el cuerpo donde el impresor evita gastar una fila por estar ya en columna 0
— y solo aplica a palabras más largas que la fila, **jamás a un `\n` de la entrada**.

### 3.3 Sí hay espacio: recorte de blancos de cola

```
1996: mov cx, word ptr [bp - 0xa]
1999: dec cx
199a: mov si, cx
199c: cmp byte ptr [bp + si - 0x40], 0x20
19a0: je 0x1999
19a2: cmp byte ptr [bp + si - 0x40], 0xd
19a6: je 0x1999
19a8: cmp byte ptr [bp + si - 0x40], 0xa
19ac: je 0x1999
19ae: mov word ptr [bp - 0xa], cx     ; último índice = último NO blanco
19b1: mov bx, word ptr [bp - 6]
19b7: cmp byte ptr [bx + si], 0
19ba: je 0x19bf
19bc: inc word ptr [bp - 6]           ; consume el espacio del corte
```

*Nota de lectura honesta:* las pruebas de `0x0d`/`0x0a` de 0x19a2 y 0x19a8 parecen
inalcanzables para contenido recién copiado (el bucle de copia corta ANTES de meter esos
bytes en el búfer). No he derivado un camino que las active; las dejo señaladas, no
explicadas. Tampoco tiene cota inferior el bucle de 0x1999: con un búfer todo blancos,
`cx` baja de cero y lee por debajo del búfer. Es un desbordamiento real del original, no
lo modelo.

### 3.4 ★ El flag diferido `[bp-2]`: qué es DE VERDAD

```
19bf: mov ax, word ptr [bp - 0xe]     ; RESTANTE
19c2: cmp word ptr [bp - 0xa], ax     ; último índice
19c5: jge 0x19ca
19c7: inc word ptr [bp - 2]           ; ★★ ÚNICA escritura del flag en todo el cuerpo
19ca: mov ax, word ptr [bp - 0xe]
19cd: cmp word ptr [bp - 0xa], ax
19d0: jle 0x19d5
19d2: dec word ptr [bp - 0xa]
```

**Censo completo del flag** (`[bp-2]`, marco local, muere en el `ret`):

| Sitio | Operación |
|---|---|
| 0x1862 | inicializa a 0 |
| 0x18af | pone a 0 en cada vuelta |
| **0x19c7** | **única puesta a 1 — dentro del reflujo con espacio encontrado** |
| 0x189a | única lectura — lo consume en la cabeza de la vuelta siguiente |

**Semántica derivada:** *«esta línea la corté por reflujo blando y NO llegó al borde
derecho, así que debo un `0x0a` explícito».* Cuando el último índice **iguala** el
restante, la línea llega justo al borde y el propio emisor la envuelve solo (auto-wrap de
0x1735–0x1740), así que no se apunta deuda alguna.

**Por qué se difiere:** la decisión se toma en 0x19c7, que ocurre **antes** del pintado del
segmento actual, 0x1a14. Emitir el salto ahí partiría la línea antes de escribirla. El
flag es una nota-a-sí-mismo que cruza el paso de pintado y se cobra en 0x189a, ya con el
segmento en pantalla y antes de remedir la columna en 0x18b4.

**Lo que NO es** — y esto refuta directamente la pregunta 4 de la tarjeta: **no tiene
ninguna relación con los `\n` de la entrada.** Un `\n` literal jamás pasa por 0x19c7; va
siempre por 0x1910, que lo emite en el acto. La hipótesis de «`\n` diferido que explicaría
la diferencia con el `split()` del port» queda **descartada por censo de escrituras**.

Además: el flag **siempre se cobra**. Tras 0x19c7 el camino llega a 0x1a2d con el flag de
FIN a cero, así que siempre vuelve a 0x189a. Dentro de una misma llamada, diferir no cambia
CUÁNTOS `0x0a` salen, solo su ORDEN respecto al pintado y a la medición de columna.

### 3.5 Centrado

```
19d5: cmp word ptr [bp - 0x18], 0
19d9: je 0x19fd
19db: mov ax, word ptr [bp - 0x42]    ; ancho
19de: cmp word ptr [bp - 0xa], ax
19e1: jle 0x19ea
19e3: mov ax, 0xa / push ax
19e7: call 0x16ba                     ; línea de ancho completo -> salta primero
19ea: mov ax, word ptr [bp - 0xe]
19ed: sub ax, word ptr [bp - 0xa]
19f0: cdq
19f1: sub ax, dx
19f3: sar ax, 1                       ; (restante - último) / 2, truncando hacia cero
19f5: push ax
19f6: call 0x1cee                     ; devuelve la FILA actual
19f9: push ax
19fa: call 0x1bf2                     ; fija el cursor (columna, fila)
```

Idioma de compilador clásico: `fija_cursor(mitad_del_hueco, fila_actual())`. La rutina de
0x1cee devuelve `[si+5]` y sale con `ret` (no limpia su argumento); lo limpia el `ret 4` de
0x1bf2, que recibe la columna en `[bp+6]` y la fila en `[bp+4]`. Solo aplica a ventanas con
el bit de centrado; la ventana de la consola no lo usa en los casos de esta tarjeta.

---

## 4. Los callees (leídos, no supuestos)

### 4.1 El emisor de un carácter, 0x16ba — **aquí está la aritmética de filas**

```
16d5: cmp dl, 0xa
16d8: je 0x1742                       ; LF
16da: cmp dl, 0xd
16dd: je 0x1745                       ; CR
...
172e: cmp word ptr [0x538e], 0
1733: je 0x1767                       ; cursor congelado -> ni avanza
1735: inc byte ptr [si + 4]           ; columna++
1738: mov al, byte ptr [si + 4]
173b: add al, byte ptr [si]
173d: cmp al, byte ptr [si + 2]       ; ¿pasa del borde derecho?
1740: jle 0x1767                      ; no -> listo
1742: inc byte ptr [si + 5]           ; ★★★ FILA++  (entrada del LF, y auto-wrap)
1745: mov byte ptr [si + 4], 0        ; ★★★ COLUMNA = 0  (entrada del CR)
1749: mov al, byte ptr [si + 5]
174c: add al, byte ptr [si + 1]
174f: cmp al, byte ptr [si + 3]       ; ¿pasa del borde inferior?
1752: jle 0x1767
1754: call 0x1f77                     ; sí -> desplaza la ventana
1757: dec byte ptr [si + 5]
```

★★★ **La instrucción que responde las preguntas 1, 2 y 3 es una sola: `1742: inc byte
ptr [si + 5]`.** No hay comparación previa, no hay guarda de columna, no hay memoria del
carácter anterior. **Todo `0x0a` avanza una fila, siempre.**

Consecuencias inmediatas y todas derivadas de esa única instrucción:

- Un `0x0a` en columna 0 **quema una fila entera en blanco**.
- Dos `0x0a` seguidos = dos `inc` = **una fila realmente vacía**. Sin colapso.
- `0x0d` entra en 0x1745 y **solo** pone la columna a 0: retorno de carro sin avance.
- El auto-wrap del borde derecho cae en el MISMO 0x1742, así que llenar la fila y escribir
  un `0x0a` producen el mismo avance (y por eso 0x19c7 no apunta deuda cuando la línea
  llega justa al borde).

Detalles menores del emisor, para que nadie los redescubra: los códigos 0xfb–0xff son
control (0xff hace home + limpieza, los otros conmutan flags de la ventana); cualquier otro
byte por encima de 0x7f se enmascara con `and dl, 0x7f` en 0x1787 y se reprocesa.

### 4.2 Consultas de cursor: COLUMNA en 0x1f12, FILA en 0x1cee

```
1f12: push bp / mov bp, sp / push si / push di / push ds
1f18: mov si, word ptr [0x539a]
1f1c: mov al, byte ptr [si + 4]       ; COLUMNA
1f1f: xor ah, ah
1f25: ret
```

```
1cee: ...
1cf4: mov si, word ptr [0x539a]
1cf8: mov al, byte ptr [si + 5]       ; FILA
1d01: ret
```

Confirmado el modelo de cursor que la tarjeta daba por ya derivado: 0x1f12 devuelve la
columna. Ambas leen el registro de ventana por el puntero cacheado en `0x539a`, el mismo
que el impresor calcula como `0x535e + 8 * [0x5386]`.

### 4.3 ★ El idioma «no gastes fila» vive en los CALL-SITES

Kernel, 0x4a3a:

```
4a3a: call 0x1850                     ; imprime la cadena
4a3d: call 0x1f12                     ; ¿en qué columna quedé?
4a40: or ax, ax
4a42: je 0x4a12                       ; columna 0 -> NO saltes
4a44: mov ax, 0xa
4a47: push ax
4a48: call 0x16ba                     ; columna > 0 -> cierra la fila
```

ZSTATS, 0x004d — **el mismo idioma, byte por byte**, a través de los thunks del overlay:

```
004a: call 0x3670                     ; -> impresor del kernel
004d: call 0x3d32                     ; -> consulta de columna
0050: or ax, ax
0052: je 0x5b
0054: mov ax, 0xa / push ax
0058: call 0x34da                     ; -> emisor de carácter
```

**Sesgo de los thunks del overlay, derivado y verificado con tres puntos** (la trampa
conocida: las etiquetas de `call` cercano en los OVL son relativas al fichero y mienten).
Con sesgo `+0xE1E0 (mod 0x10000)`:

| Etiqueta en ZSTATS | Destino real en el kernel |
|---|---|
| 0x3670 | 0x1850 (el impresor) |
| 0x34da | 0x16ba (el emisor) |
| 0x3d32 | 0x1f12 (la columna) |

Los tres cuadran con la MISMA constante, que es lo que convierte la coincidencia en
derivación. (`ZSTATS.OVL.asm` solo llega a 0x130f, así que los cuerpos de destino no están
en ese fichero: **límite declarado**, resuelto por sesgo y no por lectura del cuerpo.)

★ **Por qué importa para el port:** el original SÍ tiene un «no metas fila en blanco si ya
estás al principio de una», pero es una decisión **del que llama**, tomada **midiendo la
columna**. Un port que solo parte por `\n` no tiene columna que medir y no puede
reproducirlo.

---

## 5. El control positivo servido por la tarjeta: la envoltura de ZSTATS 0x0bee

```
0bee: push bp / mov bp, sp
0bf1: mov ax, 0x97d4 / push ax / call 0x3670
0bf8: push word ptr [bp + 4] / call 0x3670
0bfe: mov ax, 0x97d8 / push ax / call 0x3670
0c05: pop bp
0c06: ret 2
```

Cadenas leídas del binario (`original/u5/ultima5/DATA.OVL`, `fileoff = DS + 0x10`):

| DS | Bytes |
|---|---|
| 0x97d4 | `"\n\n"` |
| 0x97d8 | `"\n\nItem: "` |
| 0x97ce | `"Done\n"` |
| 0x997e | `"Thou art empty-\nhanded!\n"` |
| 0x4603 | `"Spell name:\n:"` |
| 0x6e2e / 0xa1f0 | `"Ready...\n\n"` |
| 0x6e60 / 0x84ec / 0x952c / 0xa134 / 0xa2a0 | `"Pass\n"` |
| 0x6cc6 | `"Pass\n\n"` |
| 0x6eb0 / 0xa1a8 | `"Look"` (sin salto alguno) |

*Corrección de la tarjeta:* el orden real es `"\n\n"` → argumento → `"\n\nItem: "`. Las
cadenas de `"\n\n"` puro son un control positivo aún mejor del que se pedía: el impresor
recibe una entrada **que es solo saltos**.

> ### ⚠ ADENDA 2026-08-05 (carril `printstr-reconc`) — la traza es correcta, el DOMICILIO no
>
> La tabla de arriba llama a `"\n\nItem: "` (DS 0x97d8) el control positivo servido por la
> tarjeta, y §8.5 punto 5 lo atribuye a «la pantalla de inventario (`Item: `)». **Esa
> atribución es FALSA.** Hay **TRES** cadenas `Item: ` en DATA.OVL:
>
> | DS | Bytes | Quién la empuja |
> |---|---|---|
> | **0x9998** | **`b'Item: \x00'`** (pelado) | `cmd_ready` @0x12cc — **el prompt del Ready** |
> | 0x97d8 | `b'\n\nItem: \x00'` | **sólo** la envoltura 0x0bee, único llamador 0x0d30: *«Thou hast no ammunition for that weapon!»* — es el **re-prompt tras un RECHAZO** |
> | 0x48b1 | `b'Item: \x00'` (pelado) | el flujo `(U)se` |
>
> **La aritmética de la traza de abajo NO cambia** (a media fila: 1 blanco; desde columna 0:
> 2). Lo que cambia es dónde verla: **nunca en la pantalla normal del Ready**.
> Ver `printstr-108-reconciliacion.md` §1 y §4.

**Traza de `"\n\nItem: "` desde columna C > 0** (el caso a media fila):

| Vuelta | Estado | Camino | Efecto |
|---|---|---|---|
| 1 | col = C | 0x18eb ve `0x0a` → longitud 0 → 0x1910 | emite `0x0a`: fila++, col = 0 — **cierra la fila abierta** |
| 2 | col = 0 | ídem | emite `0x0a`: fila++, col = 0 — **fila EN BLANCO** |
| 3 | col = 0 | copia 6 caracteres, corta en NUL | pinta `Item: `, col = 6 |
| 4 | — | NUL en 0x1903 → 0x1916 | FIN, sale |

**Desde columna 0** el mismo literal da **DOS** filas en blanco (la primera ya no cierra
nada). Es exactamente la asimetría que un `split("\n")` no puede expresar.

---

## 6. LA TABLA DE RESPUESTAS

| # | Pregunta de la tarjeta | Respuesta derivada | Instrucción que la decide |
|---|---|---|---|
| 1a | `«Pass\n»` desde columna 0, ¿cuántas filas? | **1 fila de contenido.** El `\n` final avanza el cursor a la columna 0 de la siguiente, pero **no crea fila**. Port = 2 ⇒ **sobra 1**. | `1910: call 0x16ba` (emite el `0x0a` una vez) + `1742: inc byte ptr [si + 5]` |
| 1b | `«Ready...\n\n»` desde columna 0, ¿cuántas? | **2: una de contenido + una EN BLANCO.** Port = 3 ⇒ **sobra 1**. | dos pasadas por `1910`, dos `1742: inc byte ptr [si + 5]` |
| 1c | El MODELO cursor predecía 1 y 2 | **El modelo acierta.** La lectura lo confirma; deja de ser modelo. | `18b4: call 0x1f12` remide la columna en cada vuelta |
| 2 | ¿Y si el cursor NO está en columna 0? | El primer `0x0a` **cierra la fila abierta** (no deja blanco); a partir del segundo, cada `0x0a` deja una fila en blanco. `"\n\nItem: "` a media fila ⇒ 1 blanco; desde columna 0 ⇒ 2 blancos. | `1742` no tiene guarda: `inc` incondicional. La asimetría la produce el estado previo de `[si+4]`, no una rama |
| 3 | ¿COLAPSA blancos consecutivos? | **NO.** Cada `0x0a` = un `inc` de fila. Dos seguidos = una fila realmente vacía. No hay memoria del carácter anterior en ninguna parte. | `1742: inc byte ptr [si + 5]`, sin `cmp` previo |
| 4 | Semántica del flag `[bp-2]` | **NO es un `\n` diferido de la entrada.** Censo completo: única escritura a 1 en `19c7`, dentro del reflujo blando, cuando la línea cortada **no llegó al borde derecho**. Significa «debo un `0x0a` explícito». Se difiere porque la decisión se toma ANTES de pintar el segmento; se cobra en `189a` ya pintado. Dentro de una llamada siempre se cobra ⇒ no cambia el número de saltos, solo su orden. **Hipótesis de la tarjeta REFUTADA.** | `19c7: inc word ptr [bp - 2]` (única) y `189a: cmp word ptr [bp - 2], 0` (única lectura) |
| 5 | `\n` de wrap horneado vs `\n` de fin de entrada | **El impresor NO los distingue: son el mismo byte por el mismo camino.** El horneado no se re-procesa; se emite verbatim. El reflujo vivo es independiente y solo actúa si un segmento EXCEDE lo que queda de fila, así que en ventana estrecha los dos efectos **se suman**. Con `"Thou art empty-\nhanded!\n"` en 16 columnas: `Thou art empty-` cabe justo (15), salto, `handed!`, salto ⇒ **2 filas de contenido, 0 blancos**. | `18ef: cmp byte ptr [bx], 0xa` corta el segmento igual sea cual sea su origen; `191f/1922` es lo único que puede disparar reflujo |

**Extra no pedido (y necesario para el arreglo):** el idioma «no gastes fila si ya estás en
columna 0» **existe en el original pero vive en los que llaman** (0x4a3d, ZSTATS 0x004d), y
se implementa **midiendo la columna**. El impresor solo lo aplica en un caso propio y
distinto: palabra más larga que la fila (0x1981).

---

## 7. LA REGLA para el arreglo de la consola del port

Formulada para que quien implemente #108 **no tenga que interpretar**. Esta sección
describe qué debe hacer el port; **este carril NO ha tocado `game/src`**.

### 7.1 El modelo fiel, en una frase

Mantén **una fila abierta** (un búfer de texto) y un **estado abierta/cerrada**. El texto se
acumula en la fila abierta; **cada `\n` VUELCA la fila abierta al log y deja el estado en
cerrado**. Volcar una fila cerrada vuelca una fila **vacía**. Nada más.

```
volcar():            log.push(filaAbierta ?? "");  filaAbierta = null
emitirTexto(t):      filaAbierta = (filaAbierta ?? "") + t
emitir(s):
    if (s === "") return                    // 186f: la cadena vacía no hace NADA
    for (cada trozo y cada '\n' de s en orden):
        texto  -> emitirTexto(texto)
        '\n'   -> volcar()
```

Equivalente sobre `split`, para quien prefiera esa forma:

```
partes = s.split("\n")
partes[0]                        -> emitirTexto  (CONTINÚA la fila abierta, no abre otra)
cada parte siguiente:            -> volcar() ANTES, luego emitirTexto(parte)
```

La fila abierta **no se vuelca al terminar la llamada**: se queda abierta esperando a la
siguiente.

### 7.2 Qué corrige exactamente, caso por caso

| Entrada | Estado previo | Original (derivado) | Port hoy | Con la regla |
|---|---|---|---|---|
| `"Pass\n"` | cerrada | 1 fila `Pass` | 2 (`Pass` + blanco) | 1 ✔ |
| `"Ready...\n\n"` | cerrada | `Ready...` + 1 blanco | 3 | 2 ✔ |
| `"Look"` | cerrada | 0 volcadas; fila `Look` ABIERTA | 1 volcada ya | fila abierta ✔ |
| `"Spell name:\n:"` | cerrada | 1 volcada + `:` abierta | 2 volcadas | 1 + abierta ✔ |
| `"\n\nItem: "` | **abierta** | cierra + 1 blanco | 3 | cierra + 1 blanco ✔ |
| `"\n\nItem: "` | cerrada | **2 blancos** | 3 | 2 blancos ✔ |
| `"Thou art empty-\nhanded!\n"` | cerrada | 2 filas, 0 blancos | 3 | 2 ✔ |

### 7.3 Las tres trampas, explícitas

1. **NO basta con «quitar el último elemento si la cadena acaba en `\n`».** Funciona para
   `"Pass\n"` y `"Ready...\n\n"`, pero rompe los dos casos de `"\n\nItem: "`: sin fila
   abierta el port no puede saber si el primer `\n` cierra algo o deja un blanco. **Hace
   falta el estado de fila abierta**, que es el equivalente de línea de la columna del
   cursor.
2. **La regla NO es «acaba en `\n`»** (como avisaba la tarjeta). Es *«cada `\n` vuelca, y no
   se vuelca al final de la llamada»*, y con eso el `\n` horneado de DS 0x997e sale bien
   **sin necesidad de distinguirlo**: el original tampoco lo distingue.
3. **Los blancos interiores son REALES.** No des-duplicar, no colapsar, no recortar: un
   `"\n\n"` en medio produce una fila vacía de verdad y debe verse.

### 7.4 Fuera de alcance de esta regla (declarado)

- **Auto-wrap por ancho** (0x1735–0x1740) y **reflujo por palabras** (§3): el original
  quiebra a `derecha - izquierda` columnas y corta por espacios. Si la consola del port
  reflowea por CSS, el recuento de filas divergirá en cadenas largas por un camino distinto
  al de esta tarjeta.
- **Desplazamiento de ventana** al pasar del borde inferior (0x1754).
- **Centrado** (§3.5) y **códigos de control 0xfb–0xff** (§4.1).
- El idioma «consulta la columna y salta solo si no es 0» de §4.3: con fila abierta el port
  ya puede expresarlo (`if (filaAbierta !== null) volcar()`), pero **ningún call-site del
  port lo usa hoy** y no he auditado cuáles deberían.

---

## 8. Predicción falsable para el testigo DOSBox (opcional)

Si algún día se cuenta filas en el original, esto es lo que se verá. Cualquier desviación
**refuta esta acta**, no la matiza.

1. **Tres `(P)ass` seguidos**, consola arrancando en columna 0: las tres palabras `Pass` en
   **tres filas CONSECUTIVAS, sin ninguna fila en blanco entre ellas**. Si aparece un
   blanco entre `Pass` y `Pass`, esta acta está mal.
   *(El port hoy muestra `Pass`, blanco, `Pass`, blanco, `Pass`, blanco.)*
2. **Un `(R)eady`**: la fila `Ready...` seguida de **exactamente UNA fila en blanco** antes
   del siguiente contenido. Ni cero ni dos.
3. **Contraste que separa las dos hipótesis** (colapso vs no colapso): tras el `Ready...` +
   blanco, si el original colapsara blancos, un segundo mensaje que empezara por `\n`
   pegaría sin dejar blanco extra. **Predicción: NO colapsa**, así que el blanco se acumula.
4. **`(L)ook`**: `Look` **no cierra su fila**; lo que se imprima a continuación aparece
   **en la MISMA fila, pegado**. Si el original lo pone en fila propia, el modelo de cursor
   es falso y toda §7 cae.
5. **La pantalla de inventario (`Item: `)**: entre el objeto listado y el siguiente prompt
   hay **exactamente una fila en blanco** si el cursor venía a media fila, y **dos** si
   venía de columna 0. Este es el discriminante más fino: es el único que distingue el
   modelo de cursor de un modelo de líneas puro.

   > **🔴 ADENDA 2026-08-05 (`printstr-reconc`) — ESTA PREDICCIÓN ESTÁ MAL DIRIGIDA. NO USARLA.**
   > Se corrió (`printstr-108-testigo-dosbox.md` §4-ter) y dio **0 blancos**, lo que se leyó
   > como contradicción del modelo. **No lo era.** La pantalla del Ready imprime DS 0x9998
   > (`"Item: "` PELADO, `cmd_ready` @0x12cc), no DS 0x97d8; el único `0x0a` lo pone el
   > idioma de cierre del call-site en ZSTATS 0x004d–0x0058 — el mismo de §4.3 de esta acta.
   > Con las cadenas reales, **el modelo de cursor y el de líneas puro predicen LO MISMO
   > (0 blancos)**: la pantalla elegida tiene **poder discriminante NULO**, así que el
   > experimento no podía refutar ni confirmar nada. Se nombró una PANTALLA cuando el sujeto
   > era una CADENA, y nadie comprobó que aquélla imprimiera ésta.
   > **Reemplazo con discriminante real** (arco sin flechas ⇒ 0x0bee): 1 blanco a cada lado
   > del mensaje de rechazo si el modelo de cursor vale, 2 si vale el de líneas.
   > Ver `printstr-108-reconciliacion.md` §5 y §7.
6. **`Thou art empty-handed!`** en su ventana de 16 columnas: **dos filas, sin blanco entre
   ellas** (`Thou art empty-` / `handed!`), y el cursor cerrando la segunda.

---

## 9. Estado de la tarjeta #108 tras esta acta

- **Lado del original: CERRADO por lectura del cuerpo entero** (201 instrucciones,
  0x1850–0x1a3b, más los cuatro callees). Ya no es inferencia ni modelo.
- **El defecto del port queda confirmado con instrumento independiente**: la afirmación
  «sobra una fila en blanco por cada cadena terminada en `\n`» ya no se apoya en medir el
  port contra sí mismo.
- **Alcance del arreglo AMPLIADO respecto a lo que decía la tarjeta**: no basta con podar el
  elemento vacío del `split`; hace falta el estado de fila abierta (§7.3, trampa 1), o los
  casos a media fila seguirán divergiendo.
- **NO tocado:** `game/src`. La implementación es tarjeta aparte (choke de todo el log en la
  vista de la piel + `t()` + posible radio en el arnés del espejo ⇒ re-sello en ventana).
- **Pendiente opcional y barato:** el testigo DOSBox de §8, ahora con predicciones
  numéricas pre-registradas.
