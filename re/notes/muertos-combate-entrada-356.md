# #356 — Quién entra al combate: el predicado es el STATUS del roster, y el muerto no deja rastro

Derivación 2026-08-16 (carril fix-356). Insumos: `re/disasm/ULTIMA.EXE.asm` (kernel
0x6936 / 0x68ae / 0x6800), `re/disasm/COMBAT.OVL.asm` (0x0B94, 0x139A, 0x1574),
`re/notes/combat.md` (§§1-3, 6). Convención kernel: offsets pool de ULTIMA.EXE.

## 1. Colocador del party — kernel 0x6936 (llamado por combat_spawn_encounter 0x6bc2 si !(flags&4))

Bucle `[bp-4] = slot 0 .. g_party_size−1` (@0x6b71 `cmp [bp-4], [g_party_size 0x585B]`):

| asm | efecto |
|---|---|
| 0x69e1 `cmp byte [slot*32+0x55b3], 0x44` / 0x69e8 `jmp 0x6b6e` | roster status **'D' → `inc slot` y NADA más**: ni spawn 0x6506, ni objeto 0x5C5A, ni cadáver. |
| 0x6a4f-0x6a5d | X = `[slot+0x1724]`, Y = `[slot+0x172c]` — la tabla de posiciones se indexa por **SLOT**, no por índice compactado ⇒ el hueco del muerto queda vacío en la formación. |
| 0x6a60-0x6a73 | `kernel_spawn_actor 0x6506(slot, kind=1, X, Y, g_floor)`. |
| 0x6a8c-0x6b02 | sprite por CLASE (switch sobre roster+0x0A `0x55b2`, tabla de saltos @0x6b04 → tiles 0x4C/0x48/0x40/0x44…). |
| 0x6b59 `cmp byte [slot*32+0x55b3], 0x53` / 0x6b63 `call 0x68ae` | roster **'S' → entra DORMIDO** (ver §2). En esta rama **NO corre 0x6794** (@0x6b66 `jmp 0x6b6e`). |
| 0x6b68 `call 0x6794` | rama else: status-pass del PJ (Ring of Invisibility 0x2A → flag 0x10 + tile 0x1D @0x67d1, regen, …). |

⇒ **La ficha #356 tal como se declaró («planta el cadáver 0x1E del que entra muerto»)
queda REFUTADA**: el binario EXCLUYE al 'D' sin rastro. El predicado correcto es
`status == 'D'` del roster — 0x6936 no lee la HP en ningún punto.

## 2. Dormir / despertar — kernel 0x68ae / 0x6800 (cuerpos completos)

`0x68ae(idx)` rama jugador (flag 0x80, @0x68c4): exención 'D' @0x68d9 (epílogo, sin
efectos — ya corregida en #349); si no: status ← 'S' @0x68de, flag 8 @0x68e1, **tile de
render obj+1 ← 0x1E @0x68ee**, **g_active_char ← 0xFF si el dormido era el activo
@0x68f3-0x68fb**, g_cmb_result_flags = 4 @0x6900. Rama enemigo @0x6912: flag 8 +
obj+6 ← 0xFF (sprite dormido).

`0x6800(idx)` (despertar): no-op sin flag 8 (@0x6816). Jugador: roster 'S'→'G' @0x682b;
**restaura el tile de render** @0x6832-0x685a — 0x1D si flag invisible 0x10, si no
`obj+1 ← obj+0` (sprite base). Enemigo: obj+6 ← 0 @0x6869. Limpia flag 8 @0x6871.

⇒ El «al party nadie le restaura el tile» de la nota del renderTile del port era RANCIO:
el despertar SÍ restaura. (Los escritores de poción tocan también obj+0, así que la
restauración les es transparente.)

## 3. La red del barrido de turnos — COMBAT:0x0bfa-0x0c1f (dentro de 0x0B94)

Tras los skips por flags (0x0be3-0x0bf3: ni 0xC0 → skip; 0x20 → skip), para un JUGADOR
(0x80): @0x0c03 `cmp byte [slot*32+0x55b3], 0x44` — roster ya 'D' con combatiente aún
activo → @0x0c0a `or [si+2],0x20` + @0x0c1f `call 0x1574(idx, 0x63)` y sigue el barrido
(@0x0c22). La rama de jugador de 0x1574 (@15c5-1604): HP ← 0 @15da, flags|=0x20 @15e0,
status ← 'D' @15e4, **tile 0x1E en obj+0 Y obj+1 @15f2-15f8**, active ← 0xFF @15fc-1604.
Sin mensaje, sin XP. Vía alcanzable: mutación directa del roster (p. ej. la trampa de un
cofre de la arena — SJOG no toca el registro de combate).

## 4. Cabo hermano (0x139A → 0x14D6) — CONFIRMADO y ya acotado

`COMBAT:0x139A(idx)` (dex defensiva): devuelve **1** si flags&8 (dormido, @13cb→@13b2),
si tipo 0x1A, o si enemigo bajo Time-stop 'T' (@139d-13b0); si no `rec+1` (@13d7).
Alimenta la tirada 0x14D6 vía el selector 0x13E2 (call @147b, sel −2 = DEX del defensor).
**No exige roster-'D'** (eso decía la ficha, de oídas): se alcanza con CUALQUIER dormido —
'S' al entrar (§1) o dormido en combate (Gazer/In Zu/passes-out). El port ya lo modelaba
(`defenseStat`: `if (c.sleeping) return 1`); lo que faltaba era la VÍA de entrada 'S'.

## 5. Port (carril fix-356)

`game/src/core/combat/combat.ts`: `placePlayers` — skip por `status === "D"` (hueco
preservado por índice de slot) y entrada 'S' → `putToSleep`; `putToSleep` completa 0x68ae
(tile 0x1E + clear del activo — antes el tile lo ponía sólo `collapsePossessed` y el clear
nadie); `wakeUp` restaura el tile del sueño (0x6800); red del barrido en `findNextActor` +
`resyncPartyHpFromRoster` vía `killByRosterDeath` (0x1574(99): sin mensaje, con cadáver).
Suite: `game/tests/muertos-combate-356.test.ts` (9 asertos, esperados en crudo; mutante
hp>0 verificado rojo a mano).

Límite declarado: el pase 0x6794 es POR TURNO en el binario (invisibilidad del anillo
re-aplicada ~~al empezar~~ **al CERRAR** cada turno del PJ — COMBAT:0x0b85, cola de la
rutina de turno); el port lo fija al montar la arena y, tras un despertar, en `wakeUp`
— ~~un Wis Quas enemigo sobre el portador no se re-oculta hasta que el port modele el
pase por turno~~ (cabo, no alcanzado por esta ficha).

> **CABO CERRADO (carril fix-invis, 2026-08-20)** — derivación completa en
> `invisibilidad-pase-turno-6794.md`. Dos correcciones a este párrafo: el pase corre al
> **final** del turno (0x0b85, y como turno entero del no-activo en 0x067c), no al
> empezar; y el ejemplo del «Wis Quas enemigo» era de oídas y queda **REFUTADO** — el
> censo cerrado de escritores del bit 0x10 no tiene ningún camino enemigo que limpie a
> un jugador (el Wis Quas de CAST:0x077f excluye party); el único apagado mid-combate
> de un PJ es retirar el anillo 42 (unequip_item 0x6e60 @0x6eeb). El port ya modela el
> pase por turno (`perTurnStatusPass`, `combat.ts`).
