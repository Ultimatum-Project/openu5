# Oráculo relevo-5 — RESUELTO: `0xffffc192` (stub summon de CAST.OVL) + el "gate" del summon

**Carril:** re/oracle-5 · **Fecha:** 2026-07-20 · Cierra el ítem 1 del paquete CAST que relevo-4
dejó abierto ("0xffffc192 opaco, relocado; 0x6506 nunca corre; bail antes del kernel").

## TL;DR

`0xffffc192` **NO es un call relocado opaco**: es un **near call** dentro del universo CS único
(CS = base de carga 0x824) que aterriza en un **stub kernel→overlay** en offset `0x8112`. Ese stub
(`lcall 0x72E:0x2EC ; dw 18 ; ljmp 0:0xe6a2`) pagina el **overlay #18 = CAST2.OVL** y salta a su
entry `0xe6a2` = **CAST2.OVL:0x4c2**, la rutina de summon. El "segundo gate" de relevo-3/4 **no
existe como precondición-flag**: la rutina hace un **bucle de hasta 8 intentos** que sortea una celda
al azar y solo llama a `kernel_spawn_actor 0x6506` si encuentra una celda **dentro de la reja,
pasable y desocupada**; si los 8 intentos fallan, **bail en CAST2:0x542 sin tocar 0x6506** — que es
exactamente el 0-hits que midió relevo-4. **`0x6506` SÍ es la primitiva de spawn del summon** (no
está "saltado por un gate"): simplemente el sorteo de celda no cuaja en la arena.

## Cómo se resolvió `0xffffc192` (en vivo + estático)

1. **En vivo** (`probe_summon_resolve.py`): disparé el cast en combate para cargar CAST.OVL, volqué
   los 640K y busqué la firma del stub `e8 8c b0 e9 36 fe` (CAST.OVL 0x1103 `call` + 0x1106 `jmp`).
   - Firma en físico **0x152c3** ⇒ CAST.OVL corre en linear base **0xbf80** dentro de CS=0x824
     (0x152c3−0x8240 = 0xd083 = 0xbf80+0x1103; el "0xBF80" que relevo-4 apuntó como caveat).
2. **Aritmética del near call** (clave, y donde relevo-4 se quedó): `e8 8c b0` = `call rel16`,
   rel16=0xb08c. El destino **envuelve** el offset de 16 bits:
   `IP_next(0xd086) + 0xb08c = 0x18112 & 0xFFFF = 0x8112`. Físico = 0x8240+0x8112 = **0x10352**
   (= P−0x4F71, NO P+0xB08F: mi primer volcado a +0xB08F cayó en una tabla de strings — rama sin
   envolver — y me avisó de que el offset envuelve).
3. **0x8112 es un stub kernel→overlay** (pool PLINK86 [0x7A16,0x81C6), `dispatch_table.stubs()`):
   `Stub(addr=0x8112, overlay_num=18, overlay='CAST2.OVL', entry_linear=0xe6a2, entry_file_off=0x4c2)`.

⇒ **`0xffffc192` = CAST2.OVL:0x4c2** (la 2ª mitad del engine de CAST, cargada bajo demanda).

## La rutina de summon (CAST2.OVL:0x4c2, `ret 2` = 1 arg, el `push 0` del stub)

Traza (offsets CAST2.OVL; **los labels near-call de la .asm de overlay son FILE-relativos y están
MAL** — hay que re-resolverlos con la base de overlay + wrap; ver §caveat):

```
04c2  push bp; ... ; mov [bp-8],0                 ; result=0
04cf  cmp [bp+4],0 ; je 04da                       ; arg=0 (combat cast) -> ax=8 (radio/idx)
04de  push ax ; call 0                             ; init intra-overlay
04e1  mov [bp-6],0                                 ; j=0  (contador de intentos)
04ec  LOOP: call picker  (label '0x9cb6' -> REAL 0x7e96 = COMBAT.OVL:0x120e via stub)
04ef  or ax,ax ; je 0518                           ; picker devolvió 0 -> reintenta
04f7  push 0xd8 ; push scratch_x ; push scratch_y ; call validity (label '0x9b96' -> REAL 0x7d76 = COMBAT.OVL:0x0)
0502  or ax,ax ; je 0518                           ; celda inválida (no pasable/ocupada) -> reintenta
0506  push scratch_x ; push scratch_y ; call 0x6222 (label -> REAL 0x4402) ; cmp byte[cell],0xff ; jne 0524
0518  inc j ; cmp j,8 ; jge 0542                    ; agotados 8 intentos -> BAIL
051b  jmp 04ec
0524  push 0x26;0;scratch_x;scratch_y;g_floor ; call SPAWN (label '0x8326' -> REAL 0x6506 = kernel_spawn_actor)
053e  or di,di ; jge 054c                           ; di<0 (spawn falló) -> 0542 bail
054c  ... setup del actor invocado (sprite 0x16, tile, anim) ...
0594  cmp [bp+4],0 ; jne 05c0                        ; arg==0 (combat): chequeo extra
059a  push g_cmb_actor ; push 0xffff ; call (0x9ce6) ; call 0x58de ; cmp ; jl 05c0
05b2  push 0x9532 ; call print ; mov [bp-8],0xffff ; jmp 0542   ; FALLO combate (msg 0x9532), result=-1
05c0  or byte[bx-0x45ea],1 ; mov [bp-8],1 ; jmp 0542 ; ÉXITO, result=1
0542  ... ; ret 2
```

- **Picker** = COMBAT.OVL:0x120e (stub 0x7e96): sortea `scratch_x=rand(0..15)`, `scratch_y=rand(0..15)`
  y devuelve 1 sólo si **ambos ≤ 10** (reja 11×11 = 0..10); si no, 0 (⇒ reintento).
- **Validity** = COMBAT.OVL:0x0 (stub 0x7d76): bounds 0..0xa + puntero de celda (`0xa172`) +
  pasabilidad (`0x89bc`) + `cmp [cell],0xff` (ocupada) + vecinos (0x5c5a..0x5c5f / 0xba1a). Devuelve
  ax=0 para celda **no pasable/ocupada** (⇒ reintento en el caller).
- **Spawn** = kernel `0x6506` (la .asm de CAST2 lo etiqueta `0x8326`; el real, tras +base+wrap, es
  0x6506). Sólo se alcanza con celda válida.

## Veredicto del ítem 1

- **Corrección a relevo-3/4:** no hay "segundo gate/precondición-flag" antes de 0x6506. El summon
  **usa** 0x6506; el 0-hits de relevo-4 es porque el **bucle de sorteo de celda (8 intentos) no
  encontró celda válida** en la arena ⇒ bail en CAST2:0x542 antes del spawn. `probe_summon_reach.py`
  ponía BP en 0x6506 y en 0x674c pero **nunca en el bucle picker**, así que no podía ver el bail.
- **La "precondición" real** es *disponibilidad de celda de summon en la arena*: pasable, dentro de
  la reja 11×11, desocupada (`!=0xff`) y con vecindad válida. Si el sorteo aleatorio no da con una en
  8 tiros, el hechizo se consume (MP baja) pero no aparece daemon — comportamiento fiel del original.

## Implicación para el PORT (para el lead — NO cableo)

Antes de tocar el clon, hay que comparar la lógica del port del summon en combate contra ESTA:
bucle de **8 intentos** de celda aleatoria en [0,15]² aceptada si ≤10, pasable, `!=0xff`; spawn sólo
si cuaja; consumo de MP aunque falle. Si el clon garantiza el spawn (o usa otro criterio de celda),
diverge. Cita ASM: `CAST2.OVL:0x4c2` (bucle 0x4ec–0x521, bail 0x542, spawn call 0x539→kernel 0x6506).

## ⚠ CAVEAT TRANSVERSAL (afecta a TODO el RE de overlays)

Los **labels de `call`/`jmp` near en las .asm de overlay (`re/disasm/*.OVL.asm`) son FILE-relativos y
NO son la dirección real de ejecución.** El destino real es
`(base_linear_overlay + IP_next_file + rel16) & 0xFFFF` dentro de CS=0x824. Ej.: CAST2.OVL 0x4ec
etiqueta `call 0x9cb6` pero ejecuta `0x7e96`; 0x539 etiqueta `0x8326` pero ejecuta `0x6506`. Bases:
CAST.OVL=0xbf80, CAST2.OVL=0xe1e0, COMBAT.OVL=0xa290 (de `dispatch_table.overlay_table()`/`stubs()`).
Esto explica por qué "0x9cb6 picker" (memoria [[ultima-exe-disasm-ceiling]]) parecía estar sobre el
techo del disasm: era el label file-relativo, no el destino.

## Evidencia
- `re/notes/probe_summon_resolve.py` + `oracle5-evidence/summon_resolve.json` (stub@0x152c3,
  target@0x20352 [rama +0xB08F = strings, descartada], resolución final a 0x8112).
- `re/notes/probe_summon_branch.py` + `oracle5-evidence/summon_branch.json` (confirmación viva de la
  ruta de bail: picker×N, spawn 0, bail).
- `re/notes/disasm_summon.py` (desensamblador del volcado).
- Estático: `CAST.OVL.asm` 0x1103; `ULTIMA.EXE.asm` 0x8112 (stub) / 0x6506 (spawn); `CAST2.OVL.asm`
  0x4c2 (summon); `COMBAT.OVL.asm` 0x0 (validity) / 0x120e (picker); `re/tools/dispatch_table.py`.
- Contexto previo: `combat-summon-gate-and-esc-flee.md` (relevo-4), `combat-summon-second-gate.md`
  (relevo-3, corregido aquí).
