# Dispatch del (G)et de tesoro en combate (item c / pendiente-usuario #24)

> ⚠️ **SUPERSEDED (2026-07-24, lote audit-fixes).** El veredicto de este documento
> («la apertura acredita DIRECTAMENTE, "Thou dost find …", sin piezas al suelo») es
> **FALSO**: se derivó parando en la frontera del stub sin resolver 0xffffdb76. La
> resolución completa (dispatch_table.py + lectura byte-a-byte de SJOG 0x112C/0x0F88/
> 0x1458/0x179E) está en **`re/notes/combat-commands.md`** — §Resolución de stubs,
> nota de fidelidad 1 (Opción A: el (O)pen derrama el botín AL SUELO con "Found:" y
> cada (G)et recoge UNA pieza) y **§RESIDUALES CERRADOS** (formato "Trapped!" en dos
> líneas, turno de early-exits, y el caso pasillo 3D donde el (G)et sí ACREDITA vía
> 0x1458 — get_dungeon 0x179E, sin loot_place). La cadena de dispatch de teclas de
> las secciones 1-2 de este doc sigue siendo válida; el veredicto de botín NO.

**Carril:** re/oracle-3 · **Fecha:** 2026-07-19 · Encargo: ¿el (G)et de tesoro de combate acredita
oro directo («Thou dost find N gold!») o deja piezas en el suelo («Found:») para un 2º Get?

## La cadena estática (COMBAT.OVL + combat.md)

**1. Al morir un enemigo** (handler de daño COMBAT `0x165f-0x1763`, ya documentado en
`re/notes/combat.md §muerte`): si el suelo no es agua/0x87 y `kernel_rand30() <= loot_rating`
(`loot_rating = ENEMY_STATS[type].treasure`, stats+7), se coloca un **COFRE (tile 1)** en la
celda de muerte con `contenido = loot_rating`; si además `rand30() < loot_rating`, `contenido |=
0x80` (**cofre con trampa**). Si el gate falla → tile 0x1F (sangre), sin cofre. **⇒ el botín de
combate NO son piezas sueltas: es un COFRE en la celda.**

**2. La tecla (G) en combate** (dispatch verificado en `COMBAT.OVL.asm`):
- Lector de tecla en `0x0838` (`call 0x83dc` → AL), árbol de comparación binario.
- 'G'=0x47 cae en la jump-table `0x0abe` (`sub ax,0x42; jmp cs:[bx-0x52a2]`, teclas 0x42..0x49;
  rebase de tabla = **delta 0xA290**, verificado porque 'C'=0x43 aterriza EXACTO en el handler de
  Cast 0x8f0). 'G' (idx 5) → word 0xabfa → **file 0x96a**.
- `0x96a`: `push str 0x6e14; push 0 (code); call 0x544`. La rutina `0x544` imprime el nombre del
  comando y despacha `code` (0..5) a thunks de overlay: code 0 → **`call 0xffffdb76`**.
- Ese thunk es el **(G)et de SJOG** (el MISMO Get del overworld): `combat.md` cierra
  «G/J/O/R/S/U/Z/B/… vía overlays» y «el oro exacto al abrirlo lo resuelve **SJOG (G)et, Task
  3.3**». ⇒ **el (G)et de combate NO tiene lógica propia de botín; delega en SJOG**, que abre el
  cofre igual que en el mundo.

## Respuesta a #24 (derivación)

El botín de combate es un **COFRE (tile 1)** en la celda del enemigo muerto, y el (G)et lo
resuelve **SJOG** abriendo el cofre. La apertura de cofre de U5 acredita el oro/ítem
DIRECTAMENTE («Thou dost find …»), no deja piezas «Found:» en el suelo para un segundo Get (ese
patrón «Found:» es del saqueo de cadáver de MONSTRUO en el overworld, no del cofre de combate).
⇒ **(G)et de combate = un solo Get, crédito directo de oro al abrir el cofre.**

<!-- CONFIRMACIÓN VIVA — pendiente (sembrar cofre tile 1 en celda de combate + (G) encima) -->

## Evidencia
- `re/disasm/COMBAT.OVL.asm`: 0x0838 (getkey), 0x0abe (jump-table teclas B-I, delta 0xA290),
  0x096a ((G)→0x544 code 0), 0x0544 (funnel→thunk 0xffffdb76 = SJOG Get).
- `re/notes/combat.md`: handler de muerte 0x165f-0x1763 (cofre tile 1, loot_rating, trampa 0x80),
  «SJOG (G)et Task 3.3», «G/… vía overlays».
