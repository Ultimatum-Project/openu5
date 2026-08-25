# Consola con fuente POR-TRAMO — el binario conmuta text_set_font A MITAD DE FILA (#364-c)

Derivación del cabo #364-c (fuente rúnica a mitad de fila). Censo de llamadores de
`text_set_font` (kernel 0x1c9e) por `re/tools/dispatch_table.py::near_calls_to_kernel`
sobre los 19 overlays + los 2 call directos del residente (58 sitios; método y tabla
completa en el informe de medición del carril, citas re-careadas aquí sobre el asm).
Control positivo del mapeo: en CAST2 el thunk es `call 0x3abe` y en SJOG/TALK
`call 0x5d1e` — los pares de abajo están leídos del listado, no de oídas.

## Las TRES clases de consola con cambio de fuente DENTRO de la fila

### 1 · ALAKAZAM de la donación — CAST2 0x0ba1-0x0bb9

```
0ba1: b80100  mov ax, 1
0ba4: 50      push ax
0ba5: e8162f  call 0x3abe        ; set_font(1) — RUNES.CH
0ba8: b8aa95  mov ax, 0x95aa     ; "ALAKAZAM"
0bac: e8c12a  call 0x3670        ; print_string
0baf: 2bc0    sub ax, ax
0bb2: e8092f  call 0x3abe        ; set_font(0) — IBM.CH
0bb5: b8b495  mov ax, 0x95b4     ; "!\n"
0bb9: e8b42a  call 0x3670
```

La palabra va en font 1 y el «!» de la MISMA fila en font 0. (El resto de la escena —
inversión + barridos — está en shrine-donation-364.md.)

### 2 · Scroll pickup — SJOG 0x15dc-0x1604 (apply_item_grant, id 4)

```
15dc: b8e08c      mov ax, 0x8ce0       ; "A scroll: "
15e0: e8ed42      call 0x58d0          ; print
15e3: b80100      mov ax, 1
15e7: e83447      call 0x5d1e          ; set_font(1)
15ea: 8b5e06      mov bx, [bp+6]
15ed: 81e30700    and bx, 7
15f1: d1e3        shl bx, 1
15f3: ffb7ac41    push [bx + 0x41ac]   ; tabla DS 0x41AC: VL·RH·IS·IA·IQW·KXC·IMC·AT
15f7: e8d642      call 0x58d0          ; nombre rúnico
15fa: 2bc0        sub ax, ax
15fd: e81e47      call 0x5d1e          ; set_font(0)
1600: b8ec8c      mov ax, 0x8cec       ; "!\n"
```

Frecuente: cada cofre con scroll. El nombre de la tabla 0x41AC se imprime en font 1
entre dos tramos latinos de la misma fila.

### 3 · Habla rúnica de TALK — 0x04fc-0x056b (fuente POR CARÁCTER)

```
04fc: b80100      mov ax, 1
0500: e81b58      call 0x5d1e          ; set_font(1) al entrar en un run rúnico
0503: 8a84e4bc    mov al, [si - 0x431c] ; buffer g_talk_word (0x4af1 rel DS)
0507: 247f        and al, 0x7f          ; el glifo impreso es el char SIN el bit 7
...
051a: 803ef34a0f  cmp byte [g_talk_column], 0xf  ; wrap propio por palabra, col 15
...
0555: f684e4bc80  test byte [si - 0x431c], 0x80  ; ¿el SIGUIENTE char es rúnico?
055a: 74a0        je 0x4fc                       ; no → vuelve por set_font(1)… 
055c: 2bc0        sub ax, ax                     ; (rama contraria: ax=0)
055e: eb9f        jmp 0x4ff                      ; …sí → set_font(0/1) por ITERACIÓN
0568: 2bc0        sub ax, ax
056b: e8b057      call 0x5d1e          ; set_font(0) al salir
```

El bit 7 de cada byte del buffer decide la fuente DE ESE carácter: la conmutación es
por-carácter dentro de la misma fila. En los datos (.TLK → game/assets/talk/*.json,
ops "Rune" con vecinos de texto en la misma línea) hay 26 líneas mixtas repartidas en
~15 NPCs (Malifora «chanting AHM !», Grendel «REL XEN BET», Smith, Temme, Sindar,
Sin'Vraal, Gardner, Hassad, Greyson, Annon, Thorne, Chamfort, Felespar, Fiona, Wartow…).

## Los que NO son mid-row (por qué el por-fila les bastaba)

- ENDGAME 0x3e2/0x3f6: conmuta en frontera de fila («[E@QUE_@OF@[E@AVATAR\n» 0x83ee,
  «IS@FOREVER\n\n\n\n» 0x8404) — página entera rúnica.
- CAST2 profecía 0x0e06-0x0e58 (8 sitios): 4 páginas enteras, set_font(0) pegado al getkey.
- CAST2 In Wis 0x6f0/0x75d: tras set_font(0) solo imprime LF (técnico, no visual).
- DUNGEON 0x1095/0x10bc: banner entero rúnico invertido, posicionado (0,0).
- LOOKOBJ/DNGLOOK (28 sitios): carteles — per-celda, otra vía (sign-box).
- ZSTATS 0x61f-0x69e (7 sitios): ventana propia, no consola (fichado aparte, #372).

## Qué modela el port (opción a del cabo)

`ConsoleLine.segments: {text,rune}[]` — tramos, no offsets (t() por tramo no-runa puede
cambiar longitudes sin romper anclas). El render ya era por-celda en las dos pieles
(`cellRune` en textwindow + blit por celda; sink per-glifo para la shader): el cambio
termina en el modelo + una variante de `printString` con flag por carácter
(`printStringSegments`; ambas fuentes monoespaciadas de 8 px ⇒ la métrica de wrap no
cambia; los delimitadores consumidos por fila llena —careo T6— avanzan el índice de
flags con el texto, así que no hay desalineación). INVARIANTE: `text` === concat de los
tramos (historial/espejo/e2e leen `text`). Productores migrados: donación (ALAKAZAM),
loot id 4 (tramos derivados re-anclando el código en la plantilla traducida) y el op
"Rune" de conversation, que deja de volcar la línea (el flushLine() por toggle era lo
que partía «…chanting AHM !» en tres filas).
