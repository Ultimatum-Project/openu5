# ESC / huida del jugador en combate — item (d)

**Carril:** re/oracle-3 · **Fecha:** 2026-07-20 · Encargo: trazar la rutina de huida del jugador (0xffffdafe) — ¿por qué borde saca al miembro? ¿respeta «same exit»?

## Entrada estática (COMBAT.OVL) — CONFIRMADA
El lector de tecla del turno del PJ está en `0x0838` (`call 0x83dc`→AL) con árbol de comparación binario. **ESC (0x1b)** cae en `0x0864` (`cmp ax,0x1b; jne 0x86c`) → `0x0869 jmp 0x9dc`. El handler:
```
09dc: e81fd1   call 0xffffdafe     ; rutina de huida (relay de overlay → SJOG)
09df: eb93     jmp 0x974           ; guarda AX en [bp-2] y vuelve al bucle de comando (0x7ba)
```

## Test vivo 1 — ESC SOLO a media arena = NO-OP
`probe_esc_flee.py` (sin seed fijado): turno del líder **slot0 @(5,7) flags=0x80**; party `[(0,5,7),(1,6,8),(2,4,8)]`; enemigos `[(6,@5,2),(7,@3,3),(8,@7,3)]`. Pulsar ESC UNA vez → **trayectoria del líder = `[(5,7,0x80)]` (SIN movimiento)**, **combat_ended=False**, flags sin cambio. Pantalla en modo gráfico EGA (sin texto legible). ⇒ **ESC a media arena no auto-elige borde ni desplaza al miembro.**

## Test vivo 2 — walk-off-edge (1 paso capturado)
`probe_flee_edge.py DOWN` (sin seed fijado): líder **slot0 @(5,7) fl=0x80**; party ys=`[7,8,8]` xs=`[5,6,4]` (pegado al borde SUR = su borde de entrada); enemigos `[(5,2)]` (al norte). **step0: caminar DOWN movió al líder (5,7)→(5,8)**, `live=True inrecords=True` (un paso hacia el borde sur; el probe se cortó aquí por el rescate de contexto). ⇒ el miembro SÍ se desplaza al caminar, hacia el borde que camina.

## Interpretación + reconciliación con el port
El modelo de huida del jugador en U5 NO es «ESC = retirada automática por un borde». Es el mismo que el enemigo (combat.md §8.2): **caminar al miembro FUERA del mapa** por un borde; al salir se marca «escapes» y se retira del combate. **El borde por el que sale = aquel hacia el que se camina** (no hay auto-selección). Cuando no queda ningún combatiente del party en el tablero, `combat_escape_check` (CMDS.OVL 0x17EC — escanea los 0x20 registros; si no hay player activo, hace el teardown: quita combatientes vía 0xffffbe02, barre la tabla de entorno 0x5c5a) **cierra el combate** y devuelve el party al overworld.

**Reconciliación probable (estático relevo-4 + port playerEscapeQuick):** ESC solo huye («Escape!») si el miembro está EN un borde (x o y ∈ {0,10}); si NO, **pasa turno** (sin mover, sin cerrar combate). El vivo-1 lo respalda: el líder en (5,7) NO está en borde → ESC fue no-op (= pasar turno). El `playerEscapeQuick` del port («ESC = salida rápida con Escape!») sería correcto SOLO en el sub-caso de-borde; a media arena debería pasar turno, no salir. **Punto exacto para cerrar la reconciliación:** probe dirigido = líder EN un borde (p.ej. y=10) y ESC → ¿«Escape!» y sale? vs líder en interior → ¿pasa turno? Eso decide si `playerEscapeQuick` debe gatearse por «miembro en borde».

## Residual fino (Clase-C)
- ~~(i) offset SJOG exacto de `0xffffdafe`~~ **CERRADO 2026-07-25** (carril bancos-residuales,
  `re/notes/esc-sala-derivacion.md` §1): no era SJOG sino **`CMDS.OVL 0x17ec`**, vía el stub
  del kernel `0x7d8e` — `(near_call_base(COMBAT)=0xa290 + 0xdafe) & 0xFFFF = 0x7d8e`,
  `dispatch_table.stubs()[0x7d8e]`. Y ahí está la **rama de SALA** (gate `0x1822`
  `test [g_unk_58a1],0x80`, colocado ANTES del de victoria `0x183a`): en sala el ESC imprime
  `-Not here!` y NO retira NUNCA, ni con la sala ganada.
- (ii) confirmar «same exit» (reaparición en overworld por el lado de entrada) con un walk-off completo por cada borde.
- (iii) el probe dirigido ESC-en-borde de la reconciliación de arriba.

## Evidencia
- `re/disasm/COMBAT.OVL.asm` 0x0838/0x0864/0x09dc; `re/disasm/CMDS.OVL.asm` 0x17EC.
- Probes del carril (worktree ya limpiado): `probe_esc_flee.py`, `probe_flee_edge.py`. Logs vivos en `/private/tmp/<oracle-rundir>-3/{esc,flee}.log`.
- `re/notes/combat.md` §8.2 (escape del enemigo off-map = mismo mecanismo).
