# ACTA — #157: el «OUCH!» del cactus a pie

> Rama `fix/cactus-157`, worktree `.claude/worktrees/cactus-157`, retenida.
> GATES sin pipe: `npx vitest run` desde `game/` **EXIT 0** (290 ficheros, 3732 pasados,
> 1 skipped) · `npx tsc --noEmit` **EXIT 0**. CERO e2e.

## §1 — Por qué esta tarjeta no era un careo

El cruce doble-testigo de #117 RECHAZÓ elevarlo (0 apariciones en las 25 rutas AD; el «1»
del primer barrido era `touch` dentro de «Don't touch th», falso positivo confesado). Pero
el hueco no necesitaba testigo: **el port lo declaraba de sí mismo** en dos sitios
(`game.ts` y `sfx.ts`), con acuse de recibo y sin dueño. Esto se cierra por DERIVACIÓN.

## §2 — La derivación, y el hallazgo que reencuadra la tarjeta

> ⚠ **CORRECCIÓN DE NOMENCLATURA (#178, 2026-07-30)**: esta acta escribía `move_try` para
> la rutina MAINOUT.OVL 0x01fe+342. **Ese nombre lo acuñó ESTA acta y no existe en
> `re/ledger/frontier.json`**, que la tiene como `ship_try_move` (`MAINOUT.OVL`, start
> `0x01fe`, size 342, status IDENT). Corregido abajo; el ledger manda.

`ship_try_move` (MAINOUT.OVL **0x01FE**) **no es «la rutina del barco»**: es UNA sola rutina
para todos los modos. Su discriminador a-pie/vehículo es `cmp [g_transport_tile],0x20 /
jb` (0x0312), y su **cola de BLOQUEO, MAINOUT 0x0312-0x0347, la comparten pie y barco**:

```
0322  print DS 0x29ae = "Blocked!\n"      ← SIEMPRE, sea cactus o no
0329  cmp word ptr [bp-6], 0x2f           ← ¿el TILE DESTINO es cactus?
032f    print DS 0x29b8 = "OUCH!\n"
0336    call 0xffffa8d8 → CS 0x2AA8 = kernel_party_random_damage  (rand(1,8)/miembro vivo)
033c  else: beep(0xa5,0xc8)               ← el bump de pared normal
0347  (cola común)
```

★ **El beep y el OUCH son ramas EXCLUYENTES del mismo `if`.** El port ya afirmaba «el bump
por cactus NO suena», pero lo decía como coartada de su propio hueco; el `else` de 0x033c
es lo que de verdad lo sostiene. La afirmación era correcta y ahora está derivada.

★ **Y explica el hueco**: el port modeló la rutina 0x01FE como `shipTryMove` — sólo naval —
citando ESTE MISMO bloque (en `transport.ts` están citados tanto el `cmp` del cactus como
la rutina de daño 0xA8D8). O sea, **la lógica del
cactus ya estaba portada, pero archivada bajo «barco»**, así que la vía a pie nunca la
alcanzaba. No era mecánica ausente: era mecánica mal enrutada.

## §3 — Cadenas, verificadas byte a byte

DATA.OVL, `fileoff = DS + 0x10`:
- DS 0x29ae → `b'Blocked!\n'`
- DS 0x29b8 → `b'OUCH!\n'`

Coinciden con el **testigo independiente LP1** (part07-g12, ocrLn=917): «Blocked! 0UCH!»,
en el orden 0x0322 → 0x032f. El port imprimía «Blocked!» y se comía el OUCH.

## §4 — El fix

- `StepGeometry` gana `onCactus` (mismo patrón que `onBridge`/`onSwamp`: un flag derivado
  del TILE DESTINO), puesto en la rama de bloqueo de `resolveStep`.
- `TILE_CACTUS` pasa a exportarse desde `transport.ts` — fuente única para las dos vías,
  que en el binario son la misma rutina.
- El call-site del bloqueo en `game.ts` bifurca como 0x0329: cactus → «OUCH!» +
  `partyRandomDamage`; si no → el beep de siempre.
- El comentario de `sfx.ts` deja de ser coartada y pasa a citar el `else`.

## §5 — Impacto de STREAM (declarado: SÍ tira)

Antes: chocar con un cactus a pie consumía **0 tiradas**. Ahora consume **una `rand(1,8)`
por miembro vivo** (`kernel_party_random_damage` 0x2AA8, el mismo barrido que el hambre y
que el cactus naval). Es un consumo NUEVO en cualquier cadena que roce un cactus a pie.

Lo que NO cambia: el cactus sigue siendo intransitable (la party no se mueve) y el coste de
turno del bloqueo es el de antes (exterior 0 min, pueblo 1 min) — el bloque 0x0312-0x0347
va después de esa decisión.

## §6 — Impacto e2e DECLARADO (nada corrido)

- Cualquier ruta que choque con un cactus a pie: **dos líneas de consola** donde había una,
  **HP del party** distinto y **el seed movido**.
- El pool de rutas AD medido en #117 daba **0 apariciones**, así que el radio esperado es
  pequeño; pero el testigo LP1 prueba que la situación ocurre en juego real.
- Los cues de sonido cambian en ese caso concreto: donde había `move-blocked`, ahora no hay
  cue (rama excluyente).

## §7 — Failing-first (evidencia)

Corrido contra el código PRE-FIX (revirtiendo sólo `game/src` con un parche y volviendo a
aplicarlo): **4 rojos de 7**, y los mensajes son el defecto literal:

```
expected [ 'Blocked!' ] to include 'OUCH!'
expected 0 to be greater than or equal to 1              (no había daño)
expected [ 'move-blocked' ] to not include 'move-blocked' (sonaba el beep)
```

⚠ **Detalle de método**: la primera versión del test importaba `TILE_CACTUS`, y pre-fix
fallaba por `undefined` (error de IMPORT) en vez de por la aserción — un rojo que no
demuestra nada. Se cambió a literal `0x2f` (con su cita del ASM) **más un candado que compara
la constante exportada contra el literal**, para que la duplicación no derive en silencio.
Con eso el rojo pasa a ser conductual.

**Controles que pasan ANTES y DESPUÉS** (no son ruido, son el límite del cambio): contra
montaña sigue habiendo «Blocked!» + beep sin OUCH ni daño; un paso libre no imprime nada;
y la party no se mueve en ninguno de los dos modelos.
