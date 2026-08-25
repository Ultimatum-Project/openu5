# Oráculo — evento de acampada 0xbfd6 (Clase C cerrada)

Sesión de oráculo DOSBox (2026-07-14) para decidir la Clase C más prioritaria del
catálogo: **el handler del evento de acampada `0xbfd6`** (gate 25% + cuerpo AUSENTE
de los overlays dumpeados → declarado "indecidible del corpus, sólo el runtime
responde"). **Resultado: RESUELTO.** La dirección se resolvió a una rutina kernel
concreta y se verificó **en RAM viva** que es el stub que carga OUTSUBS y salta a
`camp_results` — es decir, la APARICIÓN, no una emboscada.

Herramienta: `re/tools/oracle.py`. Boot único hasta el mundo (SAVED.GAM de
referencia): `game_ds=0x1788`, `roster_off=0x055A6`, `load_seg=0x0824`.

---

## Aritmética de direcciones (clave de todo)

Todo el código (kernel + overlays) vive en UN solo segmento cuya base es
`load_seg=0x0824` (command-dispatch.md §mapa de overlays). Offsets de código
= `load_seg : (base_overlay + fileoff)`. Bases (bytes): kernel 0x0000, CMDS
0xBF80 (`CBASE`), OUTSUBS 0xA290.

`call 0xffffbfd6` (CMDS 0x0502, bytes `E8 D1 BA`) es un **near-call** (E8) — su
target NO es "0xbfd6 local" sino el CS-offset real. Regla de `re/notes/cmds.md`:
para un call externo desde CMDS, `off = (NNNN + 0xBF80) & 0xFFFF`. Con NNNN=0xbfd6:

```
(0xbfd6 + 0xBF80) & 0xFFFF = 0x7F56   →  el handler es kernel CS-offset 0x7F56
```

Por eso el "cuerpo de 0xbfd6" no estaba en ningún overlay: **está en el kernel
residente**, en 0x7F56.

---

## A. El gate del evento — `rand(0,99) < 25`, UNA vez por acampada

ASM del helper de curación de camp (CMDS.OVL fileoffs). El gate está DESPUÉS del
bucle de curación por miembro (0x0444-0x04d3, que sale a 0x04e4) y FUERA de él:

```
04e4: mov [bp-0x20], si                  ; fin del bucle de miembros
04e7: test byte [bp+8], 0x82             ; flag de camp
04eb: jne 0x505                          ;  & 0x82 != 0 → SALTA el evento (sin tirada)
04ed: sub ax,ax / push ax                ; lo = 0
04f0: mov ax,0x63 / push ax              ; hi = 99
04f4: call 0x6112                        ; = kernel 0x2092 = rand(0,99)
04f7: cmp ax, 0x19                       ; 0x19 = 25
04fa: jge 0x505                          ; rand >= 25 → NO evento (75%)
04fc: mov al,[g_month] ; mov [0x588d],al ; guarda el mes (0x588d)
0502: call 0xffffbfd6                    ; SÓLO si rand(0,99)<25 y flag&0x82==0
0505: mov byte [g_unk_588c], 0x0E        ; recarga cooldown (común a ambas ramas)
```

**Veredicto (grado A, asm inambiguo):** umbral `0x19 = 25`, `jge` ⇒ el handler se
llama sólo con `rand(0,99) < 25` (**25 %**), y además sólo si `[bp+8] & 0x82 == 0`.
El gate se evalúa **una sola vez por acampada** (está fuera del bucle de miembros y
de la escena de horas; el cooldown `g_unk_588c=0x0E` recargado al terminar bloquea
repeticiones dentro de la ventana de la acampada). El sitio del `rand` es el kernel
`0x2092` (`call 0x6112` → `(0x6112+0xBF80)&0xFFFF = 0x2092`).

**Runtime:** `send_key('h')` alcanza en vivo la entrada de camp kernel `0x3C9A`
(BP hit, prólogo leído `55 8B EC 83 EC 12` = push bp;mov bp,sp;sub sp,0x12). El
gate en sí no se pudo capturar con un code-BP dentro del overlay CMDS (se pisa al
cargar el .OVL — regla conocida de combat_parity) ni conduciendo la escena
headless (ver §Limitación); pero su call-target sí se verificó en RAM viva (§B).

---

## B. El handler 0xbfd6 = ES la aparición (camp_results), NO una emboscada

ASM en kernel 0x7F56 (disasm ULTIMA.EXE):

```
7f56: 9a ec 02 2e 07   lcall 0x72e:0x2ec     ; thunk de CARGA DE OVERLAY (command-dispatch.md)
7f5b: 0b 00            (word inline = 0x000B) ; nº de overlay a cargar = 0x0B = OUTSUBS
7f5d: ea e8 a8 00 00   ljmp 0:0xa8e8          ; salto a CS-offset 0xa8e8
```

`0xa8e8 = OUTSUBS base 0xA290 + 0x0658 = outsubs_camp_results`.

**RUNTIME (grado B-runtime)** — leído en RAM viva a `load_seg:0x7F56`:

```
9A EC 02 52 0F | 0B 00 | EA E8 A8 24 08
└ lcall 0x0F52:0x02EC      (0x0F52 = 0x72E + load_seg 0x0824: reubicación correcta del thunk)
                └ overlay #0x0B (OUTSUBS)
                       └ ljmp 0x0824:0xA8E8  (load_seg:0xA8E8 = OUTSUBS 0x0658 = camp_results)
```

La reubicación en vivo (segmento del thunk 0x72E→0x0F52; segmento del ljmp
0x0000→0x0824) confirma que el disasm "0000/0x72e" son relativos y que el destino
real es OUTSUBS `camp_results`.

**Veredicto (grado B-runtime):** `0xbfd6` es el **stub PLINK residente** que carga
el overlay OUTSUBS y salta a `outsubs_camp_results` — la **APARICIÓN del Avatar**
(cura total `currentHP:=maxHP` 0x0820, `status:='G'` 0x0828 = cura veneno/sleep,
level-up 0x070e/0x0717, discurso por tramo de karma 0x090e-0x099b, según la
re-derivación de #27). **NO existe rama de emboscada en este path.** El evento del
25 % es la aparición benévola.

---

## C. Relación 0xbfd6 ↔ camp_results — GATEADA por el 25 %, NO incondicional

La **única** call site de `0xbfd6` (→ kernel 0x7F56 → camp_results) en todo el
corpus es CMDS 0x0502, DENTRO de la rama `rand(0,99)<25`. Por tanto
`camp_results` (aparición: cura total + cura de estado + level-up + discurso) corre
**sólo cuando cruza el gate del 25 %** (y `flag&0x82==0`), **no** al final de cada
acampada.

**El port DIVERGE.** `game.ts::camp()` corre `campLevelUp` **incondicionalmente**
cada acampada y, aparte, emite `"Ambushed!\n\n"` sobre el mismo gate:

1. **Etiqueta errónea del evento.** El port trata el gate 25 % como EMBOSCADA
   ("Ambushed!"). Runtime prueba que es la APARICIÓN (camp_results). No hay
   emboscada.
2. **`campLevelUp` fuera de gate.** El original aplica el level-up SÓLO dentro de
   la aparición del 25 %; el port lo corre cada camp. La guarda idempotente
   (`cmp ax,dx; jne` 0x0704) lo hace observacionalmente inocuo para el *valor* del
   nivel, pero cambia el **timing**: el port sube de nivel en la siguiente acampada
   tras ganar exp; el original exige la aparición afortunada (25 %). El port sube
   antes / más fiable.
3. **Efectos de la aparición no modelados.** La cura total, la cura de veneno/sleep
   (`status='G'`) y el discurso por karma de `camp_results` no están en el port.

Runtime del EFECTO en el roster (cura P→G / HP a tope): **no capturado** — la
escena de camp no se pudo conducir headless (§Limitación). El mecanismo queda
probado por asm + RAM viva (call-target del gate = camp_results).

---

## Limitación del oráculo (por qué no hubo witness de la escena)

`send_key('h')` dispatcha a camp OK (0x3C9A en vivo). Pero el **prompt de horas**
(kernel 0x3dbc → `0x266c` → `0x1b38` → getkey **`0x1d5e`**) no avanza con la
inyección de teclas del oráculo. `0x1d5e` lee con `int16 AH=1` (peek del buffer
BIOS) **+ `int21 AH=6`** (E/S de consola DOS, `DL=0xFF`). Las teclas inyectadas se
**consumen** (el buffer BIOS se vacía) pero el prompt **no progresa** — mismo patrón
que los pickers interactivos del Cast/Ready ya catalogados como Clase A. Conducir la
escena de camp headless requiere RE del protocolo de este sub-prompt (trabajo de
arnés, no de re-derivación). Sin ello, el gate/aparición sólo se observa por su
call-target en RAM (hecho) y no por la escena completa.

Notas de setup verificadas de paso: la salida al overworld por
`combat_parity.exit_to_overworld` deja el party a pie (transport 0x1C, obj-party
`0x5C5A..` = `1C 1C 56 6C …`) en un tile campable; camp en PUEBLO (g_location 0x11)
y a bordo se rechaza (fuera de este alcance).

---

## Tasks propuestas (divergencias del port; NO tocar el motor aquí)

- **T-A (alta): el evento 25 % de camp es la APARICIÓN, no "Ambushed!".** Sustituir
  el mensaje/efecto: gatear `campLevelUp` + cura total + `status='G'` + discurso por
  karma bajo `rand(0,99)<25` (una vez por acampada), y **retirar el `campLevelUp`
  incondicional** de `game.ts::camp()`. El consumo del rand del gate ya es exacto
  (mantenerlo). Ref: este documento §B/§C; offsets de #27 (0x0820/0x0828/0x090e).
- **T-B (media): flag `[bp+8]&0x82`.** El gate salta el evento si el flag está
  puesto (0x04e7). Semántica del flag sin derivar → Clase C residual; documentar.

Pipeline SDD aparte (no arreglado en esta sesión).

---

## D. REAPERTURA (2026-07-14) — ¿el camp de OVERWORLD dispara la aparición? SÍ.

**Contraevidencia (regla FIDELITY-CONTRACT, reabre veredictos):** capturas del
usuario jugando muestran la aparición curando al party acampando **a la intemperie
(overworld)**. Mi conclusión previa de esta sesión ("camp de overworld a pie = sueño
PURO, sin heal/gate/aparición; el heal/gate vive en otra variante CMDS") era **débil
y ERRÓNEA**: muestra de 5-6 acampadas (P(0 aparic.|25%)≈0.24, no decisiva) + un **bug
de lectura** (leía el roster en 0x3EE5/hour-target ANTES de que corriera la curación)
+ un **trace estático incompleto** de 0x6360. Se RETIRA.

Experimento: `re/tools/camp_probe.py` (usa la primitiva de sub-prompts
`oracle_input.py`). Acampadas reales headless de 8 h en overworld a pie, leyendo el
roster tras ASENTAR (no en mitad de la escena).

Números crudos:
- **Curación: CONFIRMADA, 12/12.** m0 (sano) sube de 5 sembrado a **35-60** en TODAS
  las acampadas (curación normal `campHoleUp`/CMDS 0x0400). El "sin cura" previo era
  el bug de timing.
- **CMDS residente: 12/12** (bytes del gate `E8 D1 BA` en `load_seg:0xC482`): el camp
  de overworld **CARGA y USA la rutina CMDS** (heal+gate). El "0x6360 = sueño puro sin
  CMDS" era trace estático incompleto; **el runtime manda**.
- **Gate ALCANZADO con FLAG CLARO — reproducido 3×.** BP en el gate (CMDS 0x04e7
  `test [bp+8],0x82`, `load_seg:0xC467`): `[bp+8]=0x0004`, **`&0x82 = 0` (CLARO)** →
  el flag NO bloquea el evento en overworld. El rand (0x04f4, `load_seg:0xC474`) SÍ se
  evalúa (GATE_RAND alcanzado; escritura de seed confirmada por read-back).
- **Los "aborts" de los runs rápidos eran, casi seguro, los CRUCES.** Con
  `tick_pulse=False` los camps que CRUZAN cuelgan: `camp_results` imprime "An
  apparition!" + arenga por karma que **esperan tecla**, y el watch expiraba →
  "abort". Frecuencia de aborts ≈ 2-3 de ~15 intentos ≈ **13-20%**, compatible con el
  25%. (Los camps COMPLETADOS dan 0 stub / 0 cura de veneno porque los cruces no
  llegan a completarse: abortan en el discurso.)

**VEREDICTO (corrige el previo):** el camp de **OVERWORLD A PIE SÍ cura Y alcanza el
gate de la aparición con el flag claro** ⇒ por el asm (`rand(0,99)<25 → 0x0502 →
0x7F56 → camp_results`) **dispara la aparición ~25 %** de las acampadas. Reconcilia
con las capturas del usuario y con el cableado de **#7** (overworld = heal parcial +
gate 25 % + aparición): **#7 es CORRECTO, sin matiz por contexto necesario.**

Salvedad honesta: **no** se capturó un cruce LIMPIO (stub 0x7F56 con el discurso
descartado y el roster leído curado) por (a) flaky del drive de sub-prompt y (b)
fallo al FORZAR `rand<25` (mi modelo `seed→rand` no cuadró en este call; una lectura
de AX salió basura 0xFF00 — misread del pty). La conclusión **NO depende** de ese
witness: la observación DIRECTA del gate (flag claro ×3 + rand evaluado) + el asm +
la curación reproducida + los aborts-como-cruces bastan. Cerrar el witness limpio del
cruce (forzar el rand de forma fiable / feeder de discurso robusto) queda como pulido
menor, no bloqueante.

Implicación para el port: **NINGUNA corrección** — #7 quedó bien. (Y el bucle de
sueño CMDS 0x01ee-0x030c de la tarea #8 **es** el del camp de overworld, no una
variante aparte: el overworld a pie recorre esa rutina CMDS.)
