# Oráculo — camino de entrada de teclado y por qué los sub-prompts no se conducían

Derivación del asm (2026-07-14, SIN dosbox — av-saves-generator ocupando el
emulador) del camino de lectura de teclado de U5, para romper la limitación que
bloqueó dos veces la conducción de sub-prompts (escena de camp, pickers Cast/Ready).
Diseño de la primitiva: `re/tools/oracle_input.py`.

## 1. TODO el teclado del juego pasa por UN solo getkey: kernel 0x1d5e

Evidencia dura:
- `int 0x16` (BIOS teclado) aparece en **EXACTAMENTE 2 sitios** en todo
  `ULTIMA.EXE.asm`: `0x1d6c` (AH=1, peek) y `0x1dcd` (AH=2, flags de shift) —
  **ambos dentro de `0x1d5e`**. `grep -c cd16` = 2.
- `int 0x16` en los overlays: **CERO** (`grep -rln cd16 re/disasm/*.OVL.asm` → vacío).
- ⚠ **CORREGIDO por #173:** aquí ponía «el único caller de `0x1d5e`». Son **DIECISÉIS**
  (ENDGAME ×2 · FONT ×4 · INTRO ×7 · TALK ×2 · más el intra-kernel), medido con
  `re/tools/callers_por_banda.py` en `99c07474`. El «único» era un uno-en-falso del censo
  por GREP: sólo veía el intra-kernel porque los otros quince están en overlays, donde el
  mismo destino se codifica con otro literal. La lectura de abajo sobre ese sitio concreto
  sigue valiendo; lo que no vale es la EXCLUSIVIDAD.
- Un caller de `0x1d5e` —el intra-kernel— está en CS 0x1b5b, dentro de `0x1b38` (wrapper "parpadea
  cursor + getkey"), que a su vez lo envuelve `0x266c` (getkey bloqueante que
  hace loop hasta tecla no-nula, `0x269f je 0x267f`).

⇒ **el dispatcher principal de comandos, el prompt de horas del camp, el getdir, y
los pickers de los overlays (Cast/Ready) leen TODOS por `0x266c → 0x1b38 →
0x1d5e`.** No hay dos mecanismos de lectura: es uno.

Corolario clave: como `send_key` del oráculo inyecta en el ring buffer del teclado
de la BDA (`0x40:0x1E`, tail en `0x40:0x1C`) y `0x1d5e` lee de ahí, `send_key` YA
alimenta este camino — probado en vivo: `send_key('h')` alcanza la entrada de camp
kernel `0x3C9A`. La hipótesis "los sub-prompts usan otro lector" queda **refutada**.

## 2. El getkey 0x1d5e, instrucción a instrucción

```
1d64: mov [g_key_shifted], 0
1d6a: mov ah,1 ; int 0x16          ; PEEK del ring BDA (no consume). ZF=1 vacío.
1d6e: jne 0x1d86                    ; hay tecla → leerla
1d70: xor ax,ax ; ...ret            ; vacío → return 0 (NO pasa por 0x1d77)
1d86: mov dl,0xff ; mov ah,6 ; int 0x21   ; DOS AH=06 (consola directa) → AL=ascii
1d8c: xor ah,ah ; or al,al ; jne 0x1dc2   ; ascii != 0 → tecla normal
1d92: mov dl,0xff ; mov ah,6 ; int 0x21   ; ascii==0 → tecla extendida: 2ª lectura=scancode
1d98: je 0x1d70                     ;   sin 2ª → return 0
1d9a..1da6: F1..F10 (scancode 0x3b-0x44) → al += 0x8e ; jmp 0x1d77
1da8..1dc0: tabla de 8 [0x540e] → al=[bx+0x5416], g_key_shifted++ ; jmp 0x1d77
1dc2: cmp al,0x31 ; jb 0x1d77 ; cmp al,0x39 ; ja 0x1d77   ; dígitos '1'..'9':
1dca:   push ax ; mov ah,2 ; int 0x16 ; and al,0x23 ; (si shift/numlock) g_key_shifted++
1dd7:   pop ax ; jmp 0x1d77
1d77: cmp [g_kbd_buffer_on],0 ; je 0x1d81 ; call 0x1b24   ; ← ver §3
1d81: ...ret                       ; return ax = tecla
```

Notas: la lectura REAL del carácter es `int 21h AH=06 DL=0xFF` (consola directa
de DOS), tras un peek `int 16h AH=01`. Las extendidas (flechas/F-keys) exigen DOS
lecturas AH=06 (ascii 0 + scancode). Los dígitos '1'-'9' pasan tal cual (sólo se
mira shift). El char se devuelve; nada lo intercepta.

## 3. LA CAUSA RAÍZ: flush del buffer tras CADA tecla (0x1b24)

```
1b24: push ds ; mov ds,0x40
1b2a: mov word [0x1A], 0x1E        ; BDA head = 0x1E
1b30: mov word [0x1C], 0x1E        ; BDA tail = 0x1E   → RING VACIADO
1b36: pop ds ; ret
```

`0x1d5e` llama a `0x1b24` en `0x1d7e` **en cada lectura exitosa** (porque
`g_kbd_buffer_on` = `[0x538c]` = **1**, fijado en el init `0x00a7`). Es decir:
**tras leer una tecla, el juego BORRA todo el ring buffer del teclado de la BDA**
(descarta el type-ahead). `0x1b16` es el wrapper público `flush_kbd_buffer()` (mismo
0x1b24). `g_kbd_buffer_on` se puede alternar (toggle en `0x31cd`: `cmp 1;sbb;neg` =
1↔0), asociado a un ajuste (string 0xa11a).

**Por qué esto explica el bloqueo:**
- Inyección de UNA tecla (bucle de comandos principal): tras leerla, el flush vacía
  un buffer que ya estaba vacío → inocuo. Por eso `send_key('h')`, movimiento,
  ataque de combate SIEMPRE funcionaron.
- Inyección PRE-BUFFERIZADA de varias (p.ej. `'1'` horas + `'n'` guardia del camp):
  el prompt de horas lee `'1'`, `0x1b24` **descarta `'n'`**, y el prompt de guardia
  se queda esperando en `0x266c` para siempre → la escena de camp nunca corre.
  Reproduce EXACTO el fallo de `camp_bp.py` (pre-buffericé '1' y 'n').

(La causa raíz probada es el flush para el caso pre-buffer. El intento adaptativo
`camp_v2.py` —una tecla por sondeo— tampoco completó la escena; queda por confirmar
en vivo si era una carrera contra el flush, el conteo del prompt de guardia, o un
cancel de estado del camp. El test de §5 lo desambigua.)

## 4. Implicaciones para la primitiva

No hace falta un mecanismo de inyección DISTINTO (el BDA es el correcto y único).
Hace falta **sincronizar la inyección con el flush**. Dos vías, ambas en
`re/tools/oracle_input.py` (módulo NUEVO; NO se toca `oracle.py`, sucio de otra
sesión):

- **Vía A — desactivar el flush (una escritura).** `set_typeahead(session, True)`
  escribe `g_kbd_buffer_on = 0` (`write_mem_gameseg(0x538C, 0)`). Con eso `0x1d77`
  hace `je 0x1d81` y **NO** llama a `0x1b24`: el type-ahead sobrevive y se pueden
  pre-bufferizar varias teclas que se leen en orden. Restaurar a 1 al terminar.
  Es un tweak de arnés benigno: sólo afecta al descarte de type-ahead, NO a la
  lógica del juego ni al RNG.
- **Vía B — feeder sincronizado por BP (no muta estado).** BP de código en kernel
  `0x1b24` (residente; dispara EXACTAMENTE cuando el juego acaba de consumir una
  tecla, justo antes de vaciar): inyectar UNA tecla, `resume` hasta el hit de
  `0x1b24` (= leída), inyectar la siguiente. Inmune al flush sin tocar globals.

**Recomendación de estándar** (CONFIRMADA en vivo 2026-07-14 — ambas vías PASS, §5):
- **B (`feed_key_synced`) por defecto en experimentos de PARIDAD sensibles** — no
  muta ningún global del juego, así que no arriesga contaminar un stream de RNG ni
  el estado observado. Cuesta un round-trip de BP por tecla (aceptable para cadenas
  cortas de sub-prompt: horas, guardia, getdir, Y/N).
- **A (`set_typeahead`) para conducción LARGA tipo witness de escenas** — una sola
  escritura habilita el type-ahead y se pre-bufferiza toda la secuencia de golpe
  (más rápido); se restaura `g_kbd_buffer_on` al terminar. Úsese cuando el
  experimento no dependa de la pureza del stream (p.ej. sólo leer el efecto final
  en el roster). Se pueden combinar (A para navegar, B para el punto sensible).

Direcciones (segmento = `load_seg`, hoy 0x0824):
- `g_kbd_buffer_on` = gameseg `0x538C` (DS-relativo; `write_mem_gameseg`).
- flush `0x1b24`, wrapper `flush_kbd_buffer` `0x1b16`, getkey `0x1d5e`,
  lectura int21 `0x1d86`, getkey bloqueante `0x266c` (todos code-offset en load_seg).

## 5. Validación en vivo — EJECUTADA 2026-07-14 ✅ AMBAS VÍAS DESBLOQUEAN

Setup: boot → `send_keys_until_main_menu` → `combat_parity.exit_to_overworld` → 1
paso (loc=0, a pie, transport 0x1C). Señal de "escena corrió" independiente del
gate: BP en el retorno resid. de la escena `0x3EE5` (sólo se alcanza tras
`call 0x6360`; los cancels saltan a 0x3EEA) + stub `0x7F56` + BPINT8 de red.

- **Vía A (`set_typeahead(True)` + `prebuffer_keys(h,N,n)`): PASS.** Con
  `g_kbd_buffer_on=0` la escena de camp CORRE: el reloj avanzó 17→00→01→02→03→04 en
  5 acampadas seguidas (hours=1). Multi-tecla pre-bufferizada sobrevive ⇒ **flush
  0x1b24 CONFIRMADO como la causa** del bloqueo.
- **Vía B (`feed_key_synced` / `drive_prompt_keys`, SIN mutar globals): PASS.** Con
  el default `g_kbd_buffer_on=1`, sincronizando por BP 0x1b24: la escena corrió
  (`SCENE_RAN=True`, hit de 0x3EE5) a hours=6. No muta ningún global.

⇒ **la limitación de input queda ROTA por ambas vías**; media cola del oráculo
(todo lo que conduce sub-prompts: Cast/Ready pickers, getdir, prompts Y/N, horas de
camp) queda desbloqueada.

**Aviso de arnés (control del emulador):** en `watch_*` NUNCA usar
`tick_pulse=False` con sólo code-BPs: si ningún BP dispara (p.ej. un camp que se
cancela y vuelve al getkey bloqueante), el `RUN` queda sin pausa y **se pierde el
control del emulador para siempre** (el debugger sólo acepta comandos en pausa).
Armar SIEMPRE BPINT8 de red. (Medido en vivo: un `tick_pulse=False` colgó la
sesión.)

**Witness de camp_results (aparición):** ⚠️ **CORRECCIÓN 2026-07-14** — la conclusión
inicial de esta nota ("el camp de overworld a pie es sueño PURO, sin heal/gate; el
heal/gate vive en otra variante CMDS") era **ERRÓNEA** (bug de lectura: leía el roster
ANTES de que corriera la curación, + trace estático incompleto de 0x6360). Con
lectura tras asentar y ≥12 acampadas de 8 h: el camp de **overworld a pie SÍ cura**
(m0 5→35-60, 12/12), **CMDS SÍ está residente** (12/12), y el **gate se alcanza con el
flag `[bp+8]&0x82=0` CLARO** (reproducido 3×) ⇒ **dispara la aparición ~25 %**. Ver el
veredicto completo y los números en **`re/notes/oracle-camp-event.md §D`**. El port de
#7 (overworld = heal + gate 25 % + aparición) queda VINDICADO.

## 6. Alcance / riesgos

- `set_typeahead` sólo cambia el descarte de type-ahead; el resto de `0x1d5e`
  (peek int16 + read int21 + mapeos) es idéntico. No altera RNG ni turnos.
- Pendiente de confirmar en vivo si `int21 AH=06` bajo el pty del debugger lee del
  ring BDA en todos los casos (el flush prueba que SÍ lo consumía en el caso de
  `send_key('h')`; el test §5 lo re-confirma para la cadena de prompts).
- `g_kbd_buffer_on` también se lee/escribe en 0x3b26/0x3b2c/0x3b92 (save/restore
  alrededor de alguna operación); `set_typeahead` restaura el valor previo para no
  interferir.
