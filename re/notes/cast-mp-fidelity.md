# Cast sin MP suficiente: la carga SE CONSUME — FIEL (cierre de observación móvil)

**Observación (suite móvil, 2026-07-24)**: castear con un miembro sin MP suficiente
imprime «M.P. too low!» + «Failed!» y ADEMÁS la carga mezclada del hechizo
desaparece del inventario. ¿Bug del port?

**VEREDICTO: (A) PORT FIEL.** El original decrementa la carga mezclada ANTES de
comprobar el maná. Un intento sin maná gasta el hechizo igualmente. No hay fix.

## Derivación (re/disasm/CAST.OVL.asm, dispatcher del Cast 0x0dba)

Orden exacto verificado instrucción a instrucción (offsets file-relativos del .asm):

```
0ebb: cmp byte [bx+0x57f0], 0     ; g_spell_qty[idx] == 0 ?
0ec0: jne 0xec8                   ;   no → sigue
0ec2: mov ax, 0x463a              ;   sí → "None mixed!" (DS 0x463A)
0ec5: jmp 0xdf7                   ;   ... y sale SIN consumir
0ec8: dec byte [bx+0x57f0]        ; ★ CONSUME la carga — INCONDICIONAL
0ed3: mov al, byte [bx+0x55b7]    ; MP del caster (bx = slot<<5)
0ed9: cmp ax, word [bp-8]         ; MP vs CÍRCULO (coste)
0edc: jae 0xeee                   ;   suficiente → sigue a 0ef8
0ede: mov ax, 0x4647              ;   insuficiente → "M.P. too low!" (DS 0x4647)
0ee2: call 0x58d0                 ;   PRINT
0ee5: mov word [bp-0xa], 0        ;   result = 0
0eea: jmp 0x11a6                  ;   → TAIL común → "Failed!" (DS 0x4660)
0ef8: sub byte [si+0x55b7], al    ; MP -= círculo (solo si pasó el gate)
```

- El `dec` de 0x0ec8 se ejecuta ANTES del load/compare de MP (0x0ed3-0x0edc) y
  NO tiene rama de restauración: cuando el gate de maná falla (0x0ede-0x0eea) la
  carga ya está gastada y el flujo salta directo al tail sin re-incrementarla.
- El único gate que sale SIN consumir es «None mixed!» (0x0ebb-0x0ec5), porque
  precede al `dec`.
- Tail común 0x11a6: result==0 → «Failed!». El fallo de maná imprime por tanto
  DOS líneas: «M.P. too low!» (0x0ede) + «Failed!» (tail). Exactamente lo que
  observó la suite móvil.
- Strings verificados en DATA.OVL (re/notes/magic.md §0): 0x463A="None mixed!",
  0x4647="M.P. too low!", 0x4660="Failed!".

## Careo con el port

`game/src/core/magic/cast.ts::castSpell` reproduce el orden calcado:

1. ventana temporal → «Not here!» (sin consumir)
2. `spellQuantities[idx] <= 0` → «None mixed!» (sin consumir)
3. **`state.spellQuantities[idx] = known - 1`** (paso 3, cita CAST:0x0ec8)
4. `currentMp < circle` → `{ok:false, message:"M.P. too low!", consumed:true}`
   (paso 4, cita CAST:0x0ed3/0x0ede); el «Failed!» del tail lo emite el llamador
   (main.ts) con `!ok && consumed` — patrón tail 0x11a6.

Coincide 1:1 con el binario. La derivación completa del dispatcher ya estaba en
re/notes/magic.md §0 (divergencia «Consumo ANTES del maná», portada a propósito);
esta nota la re-verifica sobre el disasm crudo y cierra la observación de la
suite móvil como COMPORTAMIENTO FIEL, no bug.
