# Acta #136 (fase 1) — el binario NO tiene un writer de la tabla de objetos: tiene un VOLCADO DE VENTANA

Carril `export-writer`, fase de DERIVACIÓN (sin tocar código del port). Rama
`re/export-writer` sobre main `3505c0f2`.

**Veredicto: la pregunta del encargo —«¿qué slots barre el writer y qué escribe en cada
campo?»— no tiene respuesta porque no tiene sujeto.** Al guardar, el original no recorre la
tabla de objetos ni escribe campo a campo: hace **una sola llamada a DOS 0x40 (write) con
`cx = 0x1060` y `dx = 0x55A6`**, o sea vuelca 4192 bytes contiguos de la ventana viva de
DGROUP a un fichero recién creado. La tabla de objetos vive DENTRO de esa ventana
(`0x5C5A − 0x55A6 = 0x6B4`, que es exactamente su file-offset), así que se persiste
**verbatim, tal y como la dejó el juego**.

Esto no es un matiz de implementación: **invierte la forma del contrato**. El port
reconstruye la región 1..23 desde una lista tipada; el binario la PRESERVA. Y la pregunta
por el caso frontera del pirata se disuelve: en el writer no hay clases, sólo bytes.

---

## 1. El escritor de partida — `CAST2.OVL 0x10FE`, handler de (Q)uit, leído entero

```
10fe  push bp / mov bp,sp / sub sp,4
1104  push 0x9658 ; call 0x3670           ; prompt "Quit & Save?"
110b  call 0x448c                          ; getkey, bucle hasta 'Y' (0x59) o 'N' (0x4E)
1119  cmp [bp-2],0x4e / jne 0x1126         ; 'N' -> imprime 0x9666 y SALE SIN GUARDAR
1126  push 0x966a ; call 0x3670            ; "Saving..."
112d  al = [g_unk_a9bd] ; [bp-4] = al      ; grupo de overlays vivo (se restaura al final)
1133  cmp al,5 / je ... / push 1 ; call 0x433e   ; conmuta a grupo 1
113e  push 0x967a ; push 0xb31e ; push 0x100 ; push 0 ; call 0x438e    ; LEE  (4 args)
1150  push 1 ; call 0x433e
1157  push 0x9684 ; push 0xb21e ; push 0x100 ; push 0 ; call 0x438e    ; LEE  (4 args)
1169  cmp [bp-4],1 / je 0x117e
116f  push 0x968e ; push 0xb31e ; push 0x100          ; call 0x43f8    ; ESCRIBE (3 args)
117e  push 3 ; call 0x433e                 ; conmuta a grupo 3
1185  push 0x9698                          ; ★ nombre = "SAVED.GAM"
1189  push 0x55a6                          ; ★ origen  = base de la ventana
118d  mov ax,0x6606 / sub ax,0x55a6 / push ax   ; ★ 0x1060, la ventana entera
1194  call 0x43f8                          ; ★ ESCRIBE (3 args)
1197  push 0x96a2 ; push 0xb21e ; push 0x200 ; call 0x43f8   ; ESCRIBE el .OOL (512 B)
11a6  push [bp-4] ; call 0x433e            ; restaura el grupo de overlays
11af  push 0x96ac ; call 0x3670 ; ret
```

★ **Entre el «Y» del usuario y el volcado no hay una sola escritura a la ventana.** Lo único
que ocurre en medio son: impresiones, conmutaciones de grupo de overlay, y E/S de fichero
contra los búferes `0xb21e` y `0xb31e`, que están **fuera** del rango `[0x55A6, 0x6606)`. No
hay normalización, ni barrido, ni limpieza de ranuras, ni reconstrucción desde ninguna lista.

**Discriminante lector/escritor (vale para todo el censo de §4):** el lector empuja CUATRO
argumentos (nombre, destino, longitud, desplazamiento) y el escritor **TRES** (nombre,
origen, longitud). Es un discriminante de aridad, no de nombre, y por eso se puede aplicar a
sitios cuyo callee aún no se ha resuelto.

## 2. Resolución de los near-call, con control de prólogo

Base de near-call de `CAST2.OVL` = `0xE1E0`. Los cuatro destinos, resueltos y **verificados
uno a uno contra su prólogo** (`push bp / mov bp,sp`), que es el control de no-circularidad
de [[near-call-overlay-resolve]]:

| en el overlay | + base | kernel | qué es | prólogo |
|---|---|---|---|---|
| `0x3670` | 0xE1E0 | `0x1850` | impresión | — |
| `0x433e` | 0xE1E0 | `0x251E` | conmutar grupo de overlays | ✔ |
| `0x438e` | 0xE1E0 | `0x256E` | leer fichero entero, 4 args | ✔ |
| `0x43f8` | 0xE1E0 | `0x25D8` | escribir fichero entero, 3 args | ✔ |
| `0x448c` | 0xE1E0 | `0x266C` | leer tecla | ✔ |

Control cruzado de la base, INDEPENDIENTE del prólogo: `0x251E`, resuelto aquí, es el mismo
destino que `dungeon-map-buffers.md §2.4` documenta para `ULTIMA.EXE 0x0104` («conmuta al
grupo de overlays 2»), y `0x256E` es el mismo cargador que usa la ruta *Journey Onward*. Dos
anclas ajenas coincidentes ⇒ la base no es una conjetura. (Ficha #110 avisa de que una base
equivocada resuelve a OTRA rutina; por eso se ancla, no se supone.)

## 3. `write_whole_file` y el único AH=40h

`0x25D8`, reenvía sus tres argumentos y envuelve el reintento de disco:

```
25e0  [bp-2] = 0
2628  push [bp+8] ; push [bp+6] ; push [bp+4] ; call 0x7296
2642  or di,di / jne 0x264c        ; si falló -> 0x2614 re-pide disco y REINTENTA
2646  si = [bp+8]                  ; el nombre, para el aviso de disco
```

Y el fondo del pozo, `0x7296`, es donde ocurre la escritura de verdad:

```
7296  push bp / mov bp,sp / push si / push di / push ds
729c  dx = [bp+8]        ; nombre
729f  cx = 0
72a1  ah = 0x3C ; int 0x21     ; CREATE  (trunca)
72a5  bx = ax                  ; handle
72a9  cx = [bp+4]              ; ★ LONGITUD
72ac  dx = [bp+6]              ; ★ ORIGEN
72af  ah = 0x40 ; int 0x21     ; ★ WRITE — UNA vez, cx bytes desde ds:dx
72b5  ah = 0x3E ; int 0x21     ; CLOSE
72d2  ret 6
```

**Un solo `AH=0x40`. Sin bucle, sin transformación, sin filtro.** `ds` se apila en `0x729B` y
se desapila en `0x72CE` sin recargarse nunca, así que el segmento sigue siendo DGROUP del
juego: `dx = 0x55A6` apunta a la ventana VIVA.

Aritmética de la ventana, comprobada a mano por si la base estuviera mal leída: la longitud,
`0x6606 − 0x55A6 = 0x1060 = 4192`, que es el tamaño exacto de `SAVED.GAM`; y la tabla de
objetos `0x5C5A − 0x55A6 = 0x6B4`, que es exactamente el file-offset por el que la lee el
port. La tabla entera cabe dentro: `0x5C5A + 0x100 = 0x5D5A`, y `0x5D5A < 0x6606`.

## 4. Censo CERRADO de quien toca la ventana del save

Población = **todo** sitio de cualquier overlay que carga `0x55A6` como argumento (barrido
sobre los 28 ficheros de `re/disasm`). Son SIETE, y se clasifican por aridad (§1):

| sitio | args | rol | fichero destino |
|---|---|---|---|
| `INTRO.OVL 0x0B2F` | 4 | LEE | (creación de personaje) |
| `INTRO.OVL 0x0EB8` | 4 | LEE | `SAVED.GAM` — *Journey Onward* |
| `INTRO.OVL 0x1352` | 4 | LEE | — |
| `INTRO.OVL 0x1DFD` | 3 | **ESCRIBE** | — |
| `FONT.OVL 0x0B45` | 4 | LEE | — |
| `FONT.OVL 0x0E32` | 3 | **ESCRIBE** | — |
| `CAST2.OVL 0x1189` | 3 | **ESCRIBE** | `SAVED.GAM` — (Q)uit&Save (§1) |

**Cuatro lectores y tres escritores, y los tres escritores tienen la MISMA forma**: mismo
origen `0x55A6`, misma longitud calculada con la misma resta, mismo `write_whole_file`. Los
tres van además acompañados de la escritura de 512 B desde `0xb21e` (§8). ⇒ el contrato es
uniforme: **no existe ninguna ruta de guardado que trate la tabla de objetos de otra manera**,
porque no existe ninguna que la trate en absoluto.

Esto cierra el censo: la afirmación «el binario preserva la tabla» ya no depende de haber
leído *un* escritor y suponer los demás.

## 5. Las cuatro preguntas del encargo

| pregunta | respuesta derivada |
|---|---|
| ¿qué ranuras barre el writer? | **Ninguna.** No hay barrido. Hay un `memcpy` a fichero de 4192 B. |
| ¿qué escribe en cada campo? | Nada campo a campo: escribe **lo que haya en RAM**, byte a byte. |
| ¿los objetos NO-actor se preservan o se reconstruyen? | **Se preservan verbatim.** No hay «estado vivo» separado desde el que reconstruirlos: la tabla ES el estado vivo (pool único, ficha #103). |
| ¿el caso frontera del pirata (0x2C-0x2F)? | **No existe tal caso.** El escritor no distingue clases. La distinción actor/objeto es una noción del LECTOR, y en el port nace de tener tres estructuras donde el binario tiene una. |

Corolario que conviene decir en voz alta: **el epíteto «el writer que falta» de
`overworld-ai-rng.md` describe bien el hueco del port y mal el binario.** Al port no le falta
un writer: le falta la VENTANA. El binario no tiene que decidir qué persistir porque nunca
tuvo las cosas separadas.

## 6. CONTRATO para la fase 2 (código; NO se implementa en este acta)

Lo que el fix debe cumplir, enunciado como propiedades comprobables:

1. **La imagen de 32×8 que va al `.GAM` se COMPONE, no se reconstruye.** Toda ranura cuyo
   contenido no proceda de la estructura que se está volcando debe sobrevivir intacta. El
   defecto de hoy es que `writeEnemyTable` pone a cero 1..23 antes de escribir, y esa
   limpieza no tiene contrapartida en el binario.
2. **La región de limpieza legítima es la que el port PUEDE reconstruir**, y sólo ésa. Como
   el port parte el pool en tres (ficha #103), la composición tiene tres aportantes y el
   arbitraje entre ellos es la decisión de diseño real del fix.
3. **Campos por clase, ya derivados en la ficha #131**: caballo `+5/+6/+7 = 0`; naves
   `+5 = casco`, `+7 = esquifes`; y `+6` es sub-estado de mover, que el port deja a cero por
   decisión declarada (witness O1, §5 de `witness-o1-0x6b4.md`).
4. **El pirata NO es un caso frontera del escritor.** Si el fix necesita distinguirlo, la
   razón vivirá en el modelo del port, no en fidelidad — y hay que declararlo como tal.
5. **Criterio de éxito observable**: importar un `.GAM` ajeno y volver a exportarlo debe
   devolver la tabla de objetos byte a byte, salvo en los campos que el port declara no
   modelar. Hoy ese round-trip pierde la fragata del slot 1 y el caballo del slot 2.

## 7. Ventana de RNG (fase 1)

Ninguna. La derivación no toca código, y la ruta del binario que documenta —crear, escribir,
cerrar— no consulta el generador. La medición de la ventana del FIX es tarea de la fase 2, tal
y como pide el encargo.

## 8. Cabo derivado de paso: el escritor de `SAVED.OOL` cae del mismo sitio

Los tres escritores de partida van acompañados de una escritura de **0x200 bytes desde
`0xb21e`**. Y los dos búferes que la rodean son CONTIGUOS: `0xb21e + 0x100 = 0xb31e`. En el
handler de (Q)uit se leen por separado (`0x113E` a `0xb31e`, `0x1157` a `0xb21e`) y se
escriben juntos como un bloque de 512 B. Eso confirma, desde el escritor, la estructura que
`buildNativeOol` del port ya modela: **dos bloques de 0x100 contiguos, y el que se escribe
primero es el de `0xb21e`**. No lo cableo aquí; queda anotado para quien cierre el ítem
`saved-ool-no-generado`, con el matiz de que la asignación bloque→mundo exige resolver los
nombres de fichero de DATA.OVL, que este acta no ha resuelto.

## 9. Limitaciones declaradas

- **Los nombres de fichero no se han resuelto.** Los argumentos `0x9698`, `0x967A`, `0x9684`,
  `0x968E` y `0x96A2` son punteros a DATA.OVL; la atribución «`0x9698` es SAVED.GAM» se hereda
  de `dungeon-map-buffers.md §2.5`, no se re-verificó byte a byte aquí. Lo que SÍ es propio de
  este acta y no depende de esa atribución es la forma del escritor: ventana, longitud y el
  único AH=40h. Si el nombre estuviera mal atribuido, cambiaría a QUÉ fichero va el volcado, no
  QUÉ se vuelca.
- **Derivación estática.** No se ha corrido el oráculo para observar un guardado en vivo. El
  witness previo (`witness-o1-0x6b4.md §2`) ya aportó la mitad empírica —el `.GAM` de disco
  reproduce la tabla viva— y este acta aporta el mecanismo que aquella correlación no podía
  probar: la nota INFERÍA «copia directa» de que los bytes coincidían; aquí está el código que
  la hace.
- **La cadena de llamada se leyó desde el handler de (Q)uit hacia abajo.** Los otros dos
  escritores se clasificaron por aridad y por su argumento de origen, no leyendo sus cuerpos
  enteros; para lo que este acta afirma —que ninguno normaliza la tabla— basta con que los tres
  desemboquen en el mismo `write_whole_file`, que es lo verificado.
