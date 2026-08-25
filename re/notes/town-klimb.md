# TOWN.OVL — Klimb de pueblo y stairs automáticas (0x0B82 / 0x52E)

> **Estado**: ✅ PORTADA (fix #46, 2026-07-12). El catálogo marcaba "Klimb ✅"
> cubriendo solo garfio exterior (CMDS 0x1C20) y mazmorra (DUNGEON 0x1E10) — ver
> `re/verified/cmds.md`. La variante de pueblo quedó como aproximación del clon
> con stairs INVENTADAS (jugador atrapado en el tejado del castillo de LB, hallazgo
> 2026-07-11). Implementada en `game/src/core/game.ts` (`applyStairStep` para la
> transición automática al caminar; `klimbTown`/`klimbLadder` para el K de pueblo)
> + `main.ts` (evento `needs-direction`). Tests: `game/tests/town-stairs.test.ts`
> (20 unit, 4 orientaciones × dir) + `game/e2e/town-stairs.spec.ts` (castillo LB:
> subir/bajar z0↔z1 en (15,8) sólo caminando; K sobre stair → "Klimb-What?").
> Strings verificadas en DATA.OVL: 0x265a "Up!", 0x265f "Down!", 0x2723 "Klimb-",
> [t#57: 0x265a/0x265f CORRECTAS y usadas por TOWN.OVL. El censo de citas las marca
>  porque delante de `Up!\n` hay una TABLA DE PUNTEROS DS (`26 26 30 26 3d 26 48 26`
>  = 0x2626/0x2630/0x263d/0x2648) cuyos bytes son ASCII imprimible por casualidad, así
>  que la guarda la pega a la cadena y `Up!` parece caer 8 bytes dentro. Limitación
>  conocida del detector, no defecto de la cita.]
> 0x272a "-On foot!", 0x2735 "What?".

## 1. Dispatch

`command-dispatch.md:233` — K en pueblo → **TOWN:0x0B82** (0x7ACA).

## 2. `town_klimb` — TOWN:0x0B82

Desensamblado en `re/disasm/TOWN.OVL.asm:1151-1232`:

1. Imprime 0x2723 ("Klimb-"). Si `g_transport_tile&0xFE == 0x12` (a caballo)
   → msg 0x272A y sale.
2. Lee el tile BAJO el party:
   - `0xC8` LadderUp → `call 0x52E(0xC4, 0)` — sube (stair falsa orientada a favor).
   - `0xC9` LadderDown o `0x86` **Grate** → `call 0x52E(0xC4, 2)` — baja.
   - Otro → pide dirección (0xB41C) y mira party+dir:
     - `0x4C` SmallRockWall, `0xCA`/`0xCB` Fence → **el party se encarama**:
       `party_x += dx; party_y += dy` (0x0C19-0x0C2C), sin RNG.
     - Otro → msg 0x2735 ("What?").

**Las stairs (0xC4-0xC7) NO son tiles de Klimb en pueblo.**

## 3. `stair_transition` — TOWN:0x052E (la rutina compartida)

```
0x52E(tile, dir):                      ; dir: 0=N 1=E 2=S 3=W
  if (tile & 0xFC) != 0xC4: return     ; solo StairsN/E/S/W
  orient = tile - 0xC4
  if orient == dir:       g_floor++ ; "Up!"   (0x265A)
  elif orient == (dir^2): g_floor-- ; "Down!" (0x265F)
  else: nada
  push 1; call 0x408                   ; recarga de planta
```

## 4. Trigger REAL de las stairs: el movimiento (TOWN:0x0810)

Segundo call-site de 0x52E (`TOWN.OVL.asm:812-814`): el handler de paso aplica
`party += delta` y llama `0x52E(tile_destino, dir_del_paso)`. Es decir:

- Las stairs se activan **automáticamente al caminar** sobre ellas.
- Subes si entras EN el sentido de la orientación del tile; bajas si entras en
  contra. `StairsEast`: caminar al este → sube; al oeste → baja.
- La geometría del mapa (muros) impide las aproximaciones sin sentido.

## 5. Divergencia del clon (game/src/core/game.ts, klimb())

El clon metió las stairs en `klimb()` con la regla "si existe planta superior →
sube; si no → baja" (`game.ts` rama `STAIRS_NORTH..STAIRS_WEST`), y el
movimiento no las procesa en absoluto. Consecuencias verificadas en el castillo
de LB (location 17):

| Sitio | Original | Clon |
|---|---|---|
| z0 (12,7) StairsE | entrar al oeste → BAJA al sótano (2ª entrada al tesoro) | K te sube a un cuarto de la planta 1 |
| z1 (15,8) StairsN | solo puede bajar (muro al sur) | K te sube a z2 (15,8) = Roof2 intransitable → **jugador atrapado en el tejado** |
| Pisar cualquier stair | transición automática | no pasa nada |
| K sobre Grate 0x86 | baja | nada |
| K + dir sobre valla/roca | te encaramas | nada |

## 6. Spec del fix

1. `move()` en pueblo: tras pisar, si el tile destino es stair → regla de 0x52E
   (orientación vs dirección del paso), con recarga de planta y "Up!"/"Down!".
2. `klimb()` en pueblo: quitar la rama de stairs; mantener ladders; añadir
   Grate 0x86 (baja) y encaramarse a 0x4C/0xCA/0xCB con K+dir; bloquear a
   caballo.
3. Regresión E2E: castillo LB — caminar al oeste sobre z0 (12,7) baja al
   sótano; K sobre esa stair responde "What?"; imposible acabar en Roof2.
