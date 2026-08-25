# #202 — los TRES cues del carril audio, derivados. Uno de ellos NO es un cue

La tarjeta pedía, para cada uno de los tres: derivar la forma exacta del ASM, dar de alta en
el catálogo y cablear la emisión. **Lo derivable está los tres hecho.** Uno cambia de
naturaleza, otro ya estaba catalogado, y el cableado queda como resto explícito.

## 1. Robo de Faulinei — TALK.OVL, rutina 0x1180

Cuerpo entero de la cabecera, leído:

```
1187: cmp byte ptr [g_unk_5958], 0
118c: je 0x1191                       ; sin Shadowlord presente ⇒ sigue
118e: jmp 0x1278                      ; con Shadowlord ⇒ al ret, sin robo ni sonido
1191: mov ax, 0x94dc / push / call    ; imprime la cadena DS 0x94dc
1198: push 0x320    (800)             ; → arg inicio
119c: push 0x7d0    (2000)            ; → arg fin
11a0: push 1                          ; → arg paso
11a4: push 0x32     (50)              ; → arg total
11a8: call …                          ; → kernel 0x43AE, pcspeaker_glide
```

⇒ **`glide(inicio 800 → fin 2000, paso 1, 50 pasos)`: un glissando ASCENDENTE**, pendiente
+24 por paso según la fórmula del propio cuerpo del glide. Suena DESPUÉS de imprimir el
mensaje y ANTES de elegir qué te roba.

★ **Y no es un sonido nuevo: son los MISMOS cuatro argumentos que el «Key broke!» del jimmy
de cofre-objeto**, ya catalogado en `sfx-catalog.md §4.8` como
`glide(0x320→0x7d0, 1, 0x32) = 800→2000 asc`. El original reutiliza el cue. Para el port eso
significa que no hay que inventar nada: es el mismo sonido que ya se emite en otro sitio.

⚠ **Un pico más del género que cerré hoy en #69**: el disasm imprime aquí
`11a8: call 0x842e`, y 0x842e **no es una dirección de nada** — es la suma en espacio de
overlay. Con la base de TALK (0xbf80) resuelve a kernel 0x43AE. Quien lea esta rutina y cite
«0x842e» estará citando el mismo tipo de número que la cita de la catarata.

## 2. Brazo de VELA — MAINOUT.OVL 0x0300

```
02f4: push 0x64   (100)
02f8: push 0x7d0  (2000)
02fc: push 0x12c  (300)
0300: call …                          ; → kernel 0x223C, noise_burst
0303: call 0x109e
0306: mov byte ptr [g_sail_dir], 0
```

⇒ `noise_burst(300, 2000, 100)`. **Este ya ESTÁ en el catálogo**: `sfx-catalog.md §4.7b` lo
lista como «MAINOUT noise 0x300 (step=300, dur=2000, band=100)». La tarjeta lo daba por «sin
entrada de catálogo» y eso es lo único suyo que no se sostiene: **lo que falta no es el alta,
es la EMISIÓN en el port** (residuo declarado del cierre de #224 en
`colas-224-colas-bloqueo.test.ts:33`).

## 3. ★ Handler de profanidad — TALK 0x0a88-0x0af9: **NO ES UN CUE**

La tarjeta pedía explícitamente «verificar si es cue o sólo pacing antes de catalogar».
Verificado: **es pacing**, y la respuesta es NO catalogar.

```
0a8a: call …                          ; (efecto/lectura de entrada)
0a8d: call 0x5dde
0a90: or ax, ax / je 0xaec            ; ¿nada aún? → a la espera
...
0aec: push 1
0af0: call …                          ; → kernel 0x20FA, delay_ticks_int1c
0af3: inc si
0af4: cmp si, 0x1c                    ; 28
0af7: jge 0xa94                       ; agotadas las 28 vueltas ⇒ sale del sondeo
0af9: jmp 0xa8a                       ; si no, otra vuelta
```

Es un **bucle de espera de hasta 28 vueltas**, cada una un tick de retardo, sondeando. La
llamada de 0x0af0 es el mismo `delay_ticks_int1c` que aparece en el bucle del sueño de #249
—donde también se confundió con otra cosa hasta resolverla— y un retardo **no emite sonido**.

⇒ **VEREDICTO NEGATIVO sobre el tercer cue: no existe.** Al port no le falta ningún sonido
aquí; le falta, si acaso, el pacing, que es otra clase de cosa y no es de este carril.

## 4. Estado de #202 tras esto

| cue | forma derivada | catálogo | emisión en el port |
|---|---|---|---|
| Faulinei | glide 800→2000, paso 1, 50 pasos (ASC) | reutiliza la entrada del «Key broke!» | **falta** |
| vela | noise_burst(300, 2000, 100) | **ya estaba** (§4.7b) | **falta** |
| profanidad | — | NO PROCEDE | NO PROCEDE |

Lo que queda de la tarjeta es **cableado**, no derivación: emitir los dos cues reales en sus
sitios. Eso toca el flujo de eventos del port y por tanto se mide con la suite entera antes
de aterrizar, como cualquier cambio que pueda mover sellos.
