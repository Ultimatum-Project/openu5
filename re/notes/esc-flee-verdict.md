# ESC en combate — VEREDICTO FINAL (probes dirigidos, carril esc-flee-borde)

**2026-07-20 · banco del lead (el carril murió tras las corridas; scripts en re/tools/probe_esc_*.py, resultados en escflee-evidence/)**

## Veredicto (vivo, concluyente)
1. **MID-COMBAT (enemigos vivos): ESC = NO-OP TOTAL.** Interior Y en borde: no huye, no mueve,
   **no consume turno** (esc_border2 probes 3/4/5: fled=false, turnConsumed=false; esc_border3
   A-D int + A/B edge: ídem, keyDrained=true — la tecla se traga sin efecto). Refuta la
   hipótesis de reconciliación «ESC huye en borde».
2. **La huida real = CAMINAR fuera del borde** (esc_border2 probe 2: walk-off oeste →
   fled=true, slot desactivado, turno consumido). Igual que el enemigo (combat.md §8.2).
3. **POST-VICTORIA: UN ESC saca a TODO el party de golpe y CIERRA el combate**
   (esc_victory: playersBefore=3 → playersAfter=0, allLeftAtOnce=true, combatClosed=true).
   Testigo del usuario confirmado.

## Divergencias del port a cablear
- `playerEscapeQuick` (ESC = salida rápida individual a media pelea) → INFIEL: mid-combat
  ESC debe ser no-op puro (ni turno). La salida por borde caminando ya está cableada (batch 9).
- Post-victoria: ESC debe retirar a TODOS a la vez y cerrar la escena (hoy: uno a uno).

## Contexto estático previo
COMBAT.OVL 0x0864 (ESC) → 0x9dc call 0xffffdafe → jmp 0x974. La rutina del stub decide por
estado victory: con enemigos vivos = no-op; con victoria = retirada total. (Offset SJOG del
stub sigue Clase-C — irrelevante para el calco: la semántica vivida es la de arriba.)
