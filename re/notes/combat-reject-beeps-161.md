# Los dos beeps del rechazo de comando en la arena (SJOG 0x1f26) — ficha #161

> Carril fix-161, 2026-08-17. Deriva del binario los dos tonos del funnel de rechazo
> de COMBAT.OVL y los porta como cue `combat-reject`. Cierra #161.

## 1. El funnel 0x1f26 leído entero (SJOG.OVL.asm:3204-3241)

```
1f26: push bp; mov bp,sp
1f29: push [bp+6]          ; puntero a la cadena del comando ("Quit-", …)
1f2c: call 0x58d0          ; print (kernel 0x1850 con base 0xBF80)
1f2f: ax=[bp+4]            ; CÓDIGO del rechazo
      1 → 1f44: ax=0x8f12  ; " what?"            (B Board, X X-it)
      2 → 1f6a: ax=0x8f1a  ; "-Not here"         (E,F,H,I,L,M,N,Q,V)
      3 → 1f70: ax=0x8f24  ; "-Funny, no response!" (T Talk)
      default → 1f4b       ; (sin cadena extra)
1f47: call 0x58d0          ; print de la cadena del código
1f4b: push 0xa; call 0x573a    ; putchar('\n') — kernel 0x16ba. NO es una pausa.
1f52: push 0xdc; push 0x96; call 0x6340   ; beep #1
1f5d: push 0x96; push(×2) ; call 0x6340   ; beep #2
1f65: ax=1; ret 4          ; ret 1 = re-prompt del MISMO actor, sin turno
```

Los tres códigos y el default **confluyen en 0x1f4b**: el `\n` y los dos beeps suenan
para TODO rechazo del funnel, no solo para Quit. Llamador de la arena: tabla de saltos
COMBAT.OVL 0x0af8 índice 6 ('Q') → 0x0a78 → funnel con código 2 (censo completo de las
tres clases de teclas en `game/src/ui/touch.ts`, bloque COMBAT_BUTTONS).

## 2. Resolución cross-overlay CON CONTROLES (doctrina de la memoria del 15-08)

Nada se leyó crudo en el residente. `dispatch_table.overlay_near_call_base(SJOG)` =
**0xBF80**:

| call SJOG | + 0xBF80 mod 2^16 | rutina | acreditación |
|---|---|---|---|
| 0x6340 | **0x22c0** | `beep` | speaker-audit.md:25 (set_tone+delay+off) |
| 0x573a | **0x16ba** | putchar | cuerpo leído: `cmp dl,0xa / je` — ruta de '\n' |
| 0x58d0 | **0x1850** | print | consistente con los tres prints del funnel |

**Control positivo de la base** (destino ya acreditado del corpus): SJOG `0x766c` →
`0x35ec` = `prompt_direction`, la fila verificada de `citas-sesgo-overlay.md:19`.

## 3. La convención de args, adjudicada por call-site acreditado — y la pareja INVERTIDA

`beep` 0x22c0 (cuerpo leído): `set_tone([bp+6])` + `delay_via_timer 0x20c8([bp+4], 1)` +
speaker-off `0x230e`. `set_tone` 0x22e2 hace `div 0x1234DE / [bp+4]` y sale al PIT ⇒ su
argumento es **Hz directos**. Con la convención C (último push = [bp+4]), `[bp+6]` es el
**PRIMER push**.

**Control**: el call-site kernel 0x4299 empuja `0xbb8` y luego `3` = beep(3000 Hz, 3) —
el TIC del reloj, acreditado en speaker-audit.md:72 y en el port (`ambient-clock-tick`).

⇒ En el funnel:

- 0x1f52: push `0xdc`, push `0x96` ⇒ **beep(freq=0xdc=220 Hz, dur=0x96)**
- 0x1f5d: push `0x96` ×2 ⇒ **beep(freq=0x96=150 Hz, dur=0x96)**

🔴 **El comentario que #161 heredaba en main.ts estaba invertido**: decía
«beep(0x96,0xdc) + beep(0x96,0x96) — dos pitidos de 150 Hz medidos». Con la convención
adjudicada, el primer beep es de **220 Hz**, no de 150: es un «bip-bop» DESCENDENTE de
dos alturas, no dos pitidos iguales. El comentario queda corregido en el mismo commit
(no maquillado: la corrección se declara ahí mismo).

**Separación**: ninguna. Cada beep termina en el speaker-off de su propio cuerpo y el
segundo `call` arranca al retornar el primero — no hay `delay` entre ambos. (El
`0x573a(0xa)` que precede a los beeps es el `putchar('\n')` del texto, no una pausa —
la nota de `cmd-strings.ts:414` ya lo tenía bien.)

## 4. El port

- `core/sfx.ts`: SfxId **`combat-reject`** (derivación resumida en el docblock).
- `skin/fiel/speaker.ts`: `"combat-reject": () => [beep(0xdc, 0x96), beep(0x96, 0x96)]`
  (contiguos: sin segmento de silencio). Duración renderizada: 139,5 ms + 139,5 ms.
- `main.ts`: los DOS emisores del rechazo portado — tecla Q en `handleCombatKey` y F5
  (guardar) con `game.combat` — emiten el cue por `view.emitSfx` directo (el canal de
  los caminos de combate sin turno atómico, docblock de `CoreViewImpl.emitSfx`).
  El resto del funnel (B/X/E/F/H/I/L/M/N/V/T) sigue sin portar; el día que se porte,
  reutiliza este cue.

## 5. Tests (lección de #371: el CAMINO además de emisión+catálogo)

- **Crudo** (`fiel-speaker.test.ts`): 2 segmentos tono, 220 Hz y 150 Hz literales (el
  aserto de 220 AFIRMA el rasgo que la pareja invertida negaría), misma dur, y
  byte-igual a `beep(0xdc,0x96)`/`beep(0x96,0x96)`.
- **CAMINO** (`e2e/combat-reject-beeps-161.spec.ts`): censo WebAudio de #371
  (tono/ruido por WaveShaper), control positivo de pisadas EN la corrida (paso a pie =
  2 ruidos), combate real (esqueletos sembrados, patrón combat-pacer), Q en el turno
  del PJ ⇒ **exactamente 2 tonos** (ni 0 = hueco, ni 4 = doble enrutado), consola
  «Quit-Not here», **negativo** (la arena sigue viva, sin turno) y **repetible** (2ª Q
  ⇒ total 4).
  - ⚠ Hallazgo del arnés: bajo webdriver `combeat` default = 0 y el AUTO-ARRANQUE de
    la tanda enemiga de apertura NO corre solo — el encuentro enemy-initiated se queda
    en `cur=enemy / awaiting=true` y la PRIMERA tecla se consume drenando la tanda (así
    se perdió una Q en la primera corrida). El spec usa `combeat=1` (el mecanismo que
    combat-pacer.spec.ts verifica a 400 ms) y espera el reposo del prompt del PJ.
- **Mutantes** (muertos y restaurados, verde re-verificado tras cada restauración):
  - M1: pareja del primer beep invertida (el error histórico) ⇒ test crudo ROJO.
  - M2: `emitSfx` de la Q retirado ⇒ spec de camino ROJO (2 tonos esperados, 0).

## 6. Muestra

`renderCue({id:"combat-reject"})` → WAV 44,1 kHz en `/tmp/fix161-combat-reject.wav`
(0,28 s: 220 Hz 139,5 ms + 150 Hz 139,5 ms). Segmentos:
`[{tone 220→220, 139.5ms}, {tone 150→150, 139.5ms}]`.

## 7. Citas rancias actualizadas en el mismo commit

- `main.ts` (bloque de la Q): «DOS TONOS NO PORTADOS» + pareja invertida → corregido.
- `tests/fixtures/approved-strings.json` («Quit-Not here\n»): «ficha #161, abierta» →
  portados como `combat-reject`.
- `core/combat/combat.ts:1379`: el ejemplo «como los beeps de #161» (pendientes) →
  anotado que ya están portados; el tono de 0x2218 sigue declarado-pendiente.
