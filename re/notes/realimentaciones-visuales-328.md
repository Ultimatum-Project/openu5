# #328 — Tres realimentaciones visuales que el port calculaba y no enseñaba

Carril `fix-328`, 19-08-2026. Sujeto: **el binario** (TOWN.OVL, ULTIMA.EXE,
COMSUBS.OVL, COMBAT.OVL, EGA.DRV). Nace de #278 (el censo del canal visual:
`escenas-video-piloto-278.md` demostró que el espejo de consola es ciego a lo que
se PINTA). Las tres derivaciones de abajo están verificadas en crudo sobre
`re/disasm/*.asm`; toda resolución cross-overlay va por `re/tools/dispatch_table.py`
(`overlay_near_call_base`), con el control positivo del corpus **CMDS 0x7B9C →
0x3B1C `input_string`** reproducido antes de nombrar ninguna rutina (regla de
`hechizos-inertes-319.md`: jamás leer el destino crudo en el asm del residente).

Resoluciones usadas aquí (todas con esa base medida, no aritmética casera):

| overlay | call crudo | base near-call | residente |
|---|---|---|---|
| CMDS (control) | 0x7B9C | 0xBF80 | **0x3B1C** input_string ✓ |
| TOWN | 0x88A0 | 0x81D0 | **0x0A70** set_color |
| TOWN | 0x88D6 | 0x81D0 | **0x0AA6** fill_rect |
| COMSUBS | 0x5906 | 0xE1E0 | **0x3AE6** run-n-frames |
| COMSUBS | 0x3670 | 0xE1E0 | **0x1850** print |
| COMSUBS | 0x61CE | 0xE1E0 | **0x43AE** pcspeaker_glide |

## 1. ARRESTO — el «fundido» era una premisa RANCIA: es un CORTE DURO

La rama 'Y' del arresto («Wilt thou come quietly?», TOWN 0x12AE, rama 0x12FA):

```
12fa: mov ax, 0x281b / call print      ; "Yes\n\nThe guard strikes thee unconscious!\n"
1301: sub ax, ax
1303: push ax
1304: call 0x88a0                      ; = residente 0x0A70 set_color(0)  ← LA CITA DE LA FICHA
1307: mov ax, 0x2845 / call print      ; "\nThou dost awaken to...\n"
130e: g_location=4 · (0x19,4) · g_unk_24e6=1
1324: push 0x14 / call 0xffffcdac      ; = residente 0x4F7C advance_time(20 min)
132b: cmp [g_hour], 8 / jne 0x1324     ; bucle hasta las 8:00 (sin delay: gira a máquina)
1332: g_keys=0 · g_floor=0             ; llaves confiscadas
```

**`set_color(0)` está COLGANTE.** El apagón de #296/#303 es un PAR:
`set_color(0)` + `fill_rect(8,8,0xb7,0xb7)` (cama: CMDS 0x0614-0x0624). El
control interno vive en ESTE MISMO overlay: TOWN 0x0FA0-0x0FB0 (escena de la
loc 0x1D) hace `call 0x88a0(0)` **seguido de** `call 0x88d6(8,8,0xb7,0xb7)` —
set_color(0) + fill_rect, el par completo. En el arresto el fill NO existe, y
nadie consume el color colgante antes del redraw de la celda:

- `advance_time` 0x4F7C (cuerpo 0x4F7C-0x50A1): **0 llamadas** a fill_rect
  0x0AA6 — sus calls son 0x3F36 (×3), 0x2900 (redraw de panel) y 0x2092.
- el print 0x1850 pinta desde sus estructuras de ventana (0x535E+idx·8), no lee
  el color ambiente [0x52DA] — y el observable lo confirma: «Thou dost awaken
  to...» se imprime DESPUÉS del set_color(0) y es un texto que todo jugador ve.
- `set_color` 0x0A70 (cuerpo leído): masca el arg con 0xF (EGA) o 3 (CGA), lo
  deja en [0x52DA] y llama al driver fn 0x2D. Sólo fija estado; no pinta.

⇒ **El original NO funde a negro al arrestar.** La secuencia visible es: diálogo
en consola → «strikes thee unconscious!» → «Thou dost awaken to...» → corte duro
a la celda de Yew a las 8:00 con las llaves confiscadas. Un port que encadena los
mensajes y cambia de mapa ya es fiel; la única deuda era este acta (el comentario
del port llamaba «fade» a 0x1304 — corregido en `guard-encounters.ts`).

## 2. TRAMPA DE COFRE — el flash de fila del roster es PARTE del daño

`kernel_apply_damage` ULTIMA.EXE 0x2A52 es daño Y presentación, en este orden:

```
2a56: push [bp+6]            ; slot
2a59: call 0x2a28            ; INVIERTE la fila del roster del slot
2a5c-2a68: NB(10,1600,2000)  ; el blip del golpe (0x223C)
2a6e: call 0x2a28            ; DES-invierte (XOR: la 2ª llamada restaura)
2a7b: sub [si+0x55b8], ax    ; y SÓLO ENTONCES resta el HP
```

`flash_roster_line` 0x2A28 (cuerpo leído):

```
2a2c: push [0x13b0] / call 0xa70      ; set_color(color de texto vigente)
2a36: si = slot << 3
2a3a-2a49: push 0xc0 / si+8 / 0x137 / si+0xf
2a4a: call 0xb86                      ; rect XOR x∈[0xC0,0x137] · y∈[idx·8+8, idx·8+0xF]
```

**Que 0x0B86 es XOR está derivado, no supuesto:** 0x0AA6 (fill) y 0x0B86
(invert) son la MISMA fn 0x3F del driver, con la ÚNICA diferencia `clc`/`stc`
(0x0ABB vs 0x0B9B). En EGA.DRV fn21 (entry 0x1180) la entrada hace `jae 0x119a`
(= salta con carry LIMPIO); con carry PUESTO programa el Graphics Controller
reg 3 = 0x18 → function select = **XOR** (0x1183-0x1197). Y la estructura lo
exige: la segunda llamada de 0x2A52 restaura la fila PORQUE el op es involutivo.

El rect casa con el ROSTER de la piel fiel: x 0xC0..0x137 = 192..311 px = cols
24..38; y idx·8+8..+0xF = la fila de texto idx+1. El port ya tenía este flash
portado para el tick de veneno (#213: bus "poison-tick", `setDamageFlash`,
`damageFlashIdx`) — lo que faltaba era EMITIRLO desde las trampas de cofre, que
llaman a 0x2A52 por el mismo camino: ACID = 1 golpe al que abre (0x302B-0x3032
`push [bp+6]`); BOMB = un golpe por miembro VIVO del grupo, en orden de bucle
(0x2AA8, check 'D' @0x2AC1); POISON/GAS = 0 golpes (sólo status, sin 0x2A52).
Portado como `TrapResult.damageSlots` (`world/commands.ts`) + evento
"poison-tick"/"damage-script" en los tres callers (mix 0x1C04, cofre-mundo,
cofre-mazmorra 0x1323).

## 3. CORPSER — la víctima DESAPARECE bajo tierra (render-tile 0) y reaparece al escapar

El golpe no letal de un Corpser a un PJ (COMSUBS 0x03B4-0x03F9, dentro de 0x0312):

```
03b8: cmp byte [bx-0x45e9], 0x2d      ; atacante tipo 0x2D = CORPSERS
03bf: DS 0x9A10 " dragged under!\n"   ; print (0x3670 → 0x1850)
03c6-03d6: call 0x61CE(0x4b0,0x7d0,1,0x28)  ; = 0x43AE pcspeaker_glide
03e0: or byte [si-0x45ea], 4          ; flag 4 (#143, ya portado)
03e5: bl = [si-0x45e8]                ; nº de actor de la víctima
03ed: mov byte [bx+0x5c5b], 0         ; ★ RENDER-TILE 0: la víctima DESAPARECE
03f2: push 4 / call 0x5906            ; = 0x3AE6 run-n-frames(4): pausa de 4 fotogramas
```

**Semántica de tile 0 = «ranura sin nada que pintar»**: es el valor con que se
inicializa la tabla de actores 0x5C5A (TOWN 0x0FED la borra entera; FONT 0x08B1
ranura a ranura), y el par de invisibilidad enemiga del MISMO fichero lo usa
igual (COMSUBS 0x0222-0x0236 « disappears!» → `mov [bx+0x5c5b], 0`; su inversa
0x0201-0x0218 « reappears!» → `+1 ← +0`). El draw no consulta flags: pinta lo
que hay en +1, y 0 es nada.

**La pausa**: 0x3AE6(4) = 4 × [0x5910 + delay_ticks(1)] — cuatro fotogramas que
separan la desaparición del resto de la tanda. El span 0x3AE6-0x3B18 y el de
0x5910 (0x5910-0x5A30) no contienen NINGUNA escritura al búfer BIOS 0x40:0x1A/1C
(eso es el vaciado 0x1B16 de la fanfarria, #212): lo tecleado durante la pausa
se conserva. En ms es Clase C: el ASM fija FOTOGRAMAS; el port usa la unidad
compartida de las pausas 0x3AE6 (55 ms, `PAUSE_UNIT_MS`).

**El escape** («regurgitated!», COMBAT 0x1C66, la tirada de #143) restaura:

```
1cc9: and byte [si-0x45ea], 0xfb      ; flag fuera (#143, ya portado)
1cd8: mov al, [di+0x5c5a]             ; tile BASE (+0)
1cdc: mov [di+0x5c5b], al             ; ★ +1 ← +0: REAPARECE
```

Restauración INCONDICIONAL al base — sin reimponer flags (a diferencia del
despertar 0x6800 @0x6841, que re-escribe 0x1D desde el flag 0x10; ver #356).
Portado con el modelo de UN campo de #356: escribir 0 en `renderTile` al
arrastrar (`combat.ts::applyDamage`), filtro `renderTile !== 0` en el render
(`coreview.ts::entities`), limpiar el override al escapar
(`combat.ts::playerDraggedTurn`), y pausa 4×55 ms sin vaciar teclas
(`main.ts::routeCombatFx` → `CombatPacer.armBlockingPause(ms, flushKeys=false)`).

## Alcance y régimen

- Verificado leyendo los cuerpos citados en `re/disasm/` (TOWN, ULTIMA.EXE,
  COMSUBS, COMBAT, EGA.DRV); no se ha medido vídeo para esta acta — #278 aporta
  el mandato (el canal visual no se audita solo) y #296/#303/#213/#356 los
  mecanismos hermanos ya derivados.
- Pendiente conocido, FUERA de esta ficha: la fuente «Bad taste.» de mazmorra
  también pasa por 0x2A52 (DNGLOOK 0x027B) y hoy sólo emite el cue — el mismo
  bus "damage-script" le valdría. **EJECUTADO** (carril fix-badtaste, 20-08):
  ver `re/notes/drink-ahead-fidelity.md §5`.
