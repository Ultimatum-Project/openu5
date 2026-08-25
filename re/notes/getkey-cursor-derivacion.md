# El cursor parpadeante del getkey — derivación, censo y re-adjudicación de #329 (cabo #341 §7.2)

Sujeto: el BINARIO. Cierra el cabo 1 de `vas-rel-por-341-derivacion.md §7.2` («el cursor
del getkey no parpadea en el port»), carril cursor-getkey.

## 1. El cursor vive DENTRO del bucle de espera, no en el print del prompt

`getkey_with_redraw` (`ULTIMA.EXE:0x266c`) es un bucle de sondeo:

```
267f  call 0x1b38          ; poll_key_blink_cursor — CADA iteración
2682  push ax / call 0x2032 ; to_upper
2688  or si,si / jne 0x269d ; hubo tecla → sale
268c  cmp [g_location],0x21 / jb 0x269a
2693  cmp [g_location],0x7f / jbe 0x269d
269a  call 0x5910          ; redraw (sobremundo/pueblo y >0x7f)
269d  or si,si / je 0x267f ; sin tecla → repite
```

y `poll_key_blink_cursor` (`0x1b38`, cuerpo ya leído en `kernel-sweep-2.md §5`) es el
cursor ANIMADO:

```
1b3e  salva [0x538e] y lo pone a 0        ; avance de texto APAGADO durante el gesto
1b4a  ax = [0x5390] + [0x540c]            ; glifo base + fase de la animación
1b51  inc [0x540c]                        ; avanza la fase
1b57  putchar(ax)  (0x16ba)               ; PINTA el cursor en la posición de texto actual
1b5b  call 0x1d5e → [bp-4]                ; ¿hay tecla?
1b61  [0x540c] envuelve en [0x5392]       ; periodo del ciclo
1b70  con tecla: putchar(0x20)            ; BORRA el cursor con espacio
      sin tecla: 0x20fa(1)               ; espera 1 tick
```

⇒ **Todo llamador de `0x266c` parpadea el cursor**, en la posición donde el texto quedó.
El prompt («To phase: », «Player: »…) lo imprime `print_string` SIN cursor; el cursor lo
pone y lo quita el propio bucle de espera. `[0x5390]`/`[0x5392]` no tienen escritores en
código (grep en los 30 .asm): son datos estáticos del DS — el glifo y el periodo no
cambian por contexto, no hay ningún subconjunto de getkeys «sin cursor».

## 2. Censo de llamadores (cross-overlay por `dispatch_table`, con control positivo)

`resuelto = (destino + overlay_near_call_base) mod 0x10000` (la fórmula de #319/#341).
Control positivo: aparecen CAST.OVL:`0x0d06` (`call 0x66ec`, el de Vas Rel Por, sellado
en `vas-rel-por-341-derivacion.md §1`) y COMSUBS (`call 0x448c`, sellado en #340 §2).

**100 call-sites** de `0x266c`:

| módulo | n | | módulo | n |
|---|---|---|---|---|
| SHOPPES.OVL | 20 | | MAINOUT.OVL | 3 |
| CAST2.OVL | 15 | | SHOPPES3.OVL | 3 |
| SHOPPES2.OVL | 12 | | TALK.OVL | 3 |
| ENDGAME.OVL | 10 | | CMDS.OVL | 2 |
| BLCKTHRN.OVL | 6 | | DUNGEON.OVL | 2 |
| ULTIMA.EXE | 6 | | LOOKOBJ.OVL | 2 |
| TOWN.OVL | 4 | | OUTSUBS.OVL | 2 |
| ZSTATS.OVL | 4 | | SJOG.OVL | 2 |
| CAST.OVL | 1 | | COMBAT.OVL · COMSUBS.OVL · DNGLOOK.OVL | 1+1+1 |

Los 6 del kernel: `0x2dca` (dentro de `select_party_member` `[0x2d7a,0x2e8e)` — el
«Player: » del Cast parpadea), `0x3618`, `0x3b30`, `0x3bc3`, `0x3dbc` (getkey del menú de
Camp), `0x3e42`.

## 3. El testigo (Lord Fenton), extraído y careado a ojo

Fotogramas ffmpeg de las tres rutas del censo de `fenton-curacion.md §6`; la ANIMACIÓN se
verificó por diff de píxeles del recorte de la celda del cursor entre fotogramas a 300 ms:

| episodio | t (s) | fila | cursor | animación (diff del recorte) |
|---|---|---|---|---|
| lf29 (Hythloth) | ≈1656 | `:▓` (getstring rúnico tras «Spell name:») | ✓ | ✓ (1656.9 vs 1657.2) |
| lf30 (Shadowlords) | ≈374 | `To phase: ▓` (getkey pelado) | ✓ | ✓ (374.3 vs 374.6) |
| lf31 (Destard) | ≈1253 | `Player: ▓` (select_party_member) | ✓ | ✓ (1253 vs 1253.6) |

lf31 es oro aparte: el cursor parpadea **con el picker de jugador abierto** (banda
`►Select:◄` arriba) — la espera del picker es el mismo `0x266c` (§2).

## 4. Re-adjudicación del gate `promptOpen` de #329

El criterio ★ de `awaiting-gate.ts` («NO entra si el motor está parado esperando una
tecla — ahí el cursor es exactamente el mensaje correcto») **tenía razón también para los
prompts modales**: la justificación de la fila `promptOpen` («él gestiona el input» ⇒
cursor apagado) queda TACHADA en el fichero. Pero la fila NO se poda del OR: lo que
`isModalOpen` gobierna de verdad es la **fila ► de comando nuevo** (y la ola sobre ella),
y el testigo muestra «To phase: ▓» SIN fila ► debajo — con prompt abierto no se abre fila
►. El cursor del prompt va por el canal paralelo de FILA VIVA que el port ya tenía para
los getstrings (`awaitingGetstring`, «:VERAMOCOR▓»), ahora extendido a la clase entera.

## 5. Port (cableado en este carril)

- `promptCursorOnLiveRow` + `PROMPT_TYPES_CURSOR_ON_LIVE_ROW` (`ui/awaiting-gate.ts`):
  la población EN CRUDO — `yesno-esc`, `yesno`, `digit`, `party-select`, `text`,
  `number`, `rune`, `getkey`, `shop`. EXCLUIDO `ready-picker`: su ola ya la pinta la
  rama `readyPicker` de `showWave` (fiel/skin.ts) y la cadena de espera de
  `item_page_controller` (0x0f2e) no está derivada aquí.
- `refreshAwaiting` (main.ts) publica el flag por `setAwaitingGetstring` — un solo
  embudo, y los prompts armados fuera de un keydown (que ya llaman `refreshAwaiting`)
  también refrescan el cursor.
- La POSICIÓN de la ola es la del layout de la consola (final de la fila viva) — calco
  del «putchar en la posición de texto actual» de `0x1b38`. Si un call-site del port
  deja el cursor de texto en otra fila (un LF que el binario no tenía), esa divergencia
  es del canal de eco de ese prompt (familia del fix §7.1 de #341), no del cursor.
- Guardas: `tests/awaiting-gate.test.ts` (población en crudo + exhaustividad por tipo
  vía tsc + tachado del enunciado rancio). Mutante: podar `"getkey"` (o cualquier tipo)
  del set enrojece su guarda; revertir el flag a la terna text/number/rune enrojece la
  guarda de población.
