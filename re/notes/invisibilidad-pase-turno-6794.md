# El status-pass 0x6794 es POR TURNO — cadena de llamada, cuerpo y quién apaga el bit

Carril `fix-invis` · 2026-08-20 · main `6f98e2e5`. Cierra el cabo declarado en
`muertos-combate-entrada-356.md` §5 («el pase 0x6794 es POR TURNO en el binario y el port
lo fija al montar la arena»). Insumos: `re/disasm/ULTIMA.EXE.asm`, `COMBAT.OVL.asm`,
`SJOG.OVL.asm`, `ZSTATS.OVL.asm`, `re/tools/dispatch_table.py`;
`re/notes/ring-expiry-derivation.md` (unequip 0x6e60) y `oracle-ring-regen.md` (0x400c).

## 1. Cadena de llamada — resuelta con la herramienta, no con el crudo

`0x6794` tiene **un solo** call near en el kernel (`0x6b6b`, dentro del colocador
`party_anim_build 0x6936`) y **cero** words literales `0x6794` (sin tabla de punteros).
Los callers cross-overlay se censaron con `dispatch_table.near_calls_to_kernel` sobre los
24 overlays (regla del descuento de base; jamás la dirección cruda en el .asm ajeno):

- **control positivo**: `0x68ae` (dormir) ← COMBAT 0x19c8/0x19e7/0x1c0f + CAST ×2;
  `0x6800` (despertar) ← COMBAT 0x464/0x826 + CAST ×2 + CMDS 0x2a2. El instrumento ve.
- **`0x6794` ← SJOG.OVL:0x2018, y NADIE más.**

`SJOG:0x2012` es un gancho de tres líneas:

```
2012: mov al,[g_cmb_actor]           ; el actor del turno EN CURSO
2017: push ax
2018: call 0x6794                    ; (0xa814 + base SJOG 0xbf80) mod 2^16
201b: call kernel_0x8022
201e: dec  g_time_spell_turns …      ; tick de An Tym
```

y a `SJOG:0x2012` se entra por el **stub 0x7c16→0x7d16** desde exactamente dos sitios de
COMBAT.OVL (censo de callers del stub, kernel + 24 overlays):

| caller | contexto | cuándo corre |
|---|---|---|
| `COMBAT:0x0b85` | cola de la rutina de turno de actor de party `0x063e` (tras el gancho absorb 0x0b6a-0x0b76 y el skip de teclas '0'..'6' @0x0b79) | **al FINAL de cada turno** del bando party |
| `COMBAT:0x067c` | cabecera de `0x063e`: `g_active_char≠0xFF` ∧ actor jugador ∧ no es el activo → call + `jmp 0xb8e` (ret) | el turno **auto-pasado** del PJ no-activo bajo Set Active Player ES el pase y nada más |

Tercer sitio: el colocador `0x6936 @0x6b68` (montaje de arena; también lo reusa la
acampada — CMDS:0x0000 llama a 0x6936 en `0x5e`; que la escena de campamento del PORT
corra o no este pase queda como cabo declarado FUERA de este carril — el encargo era la
arena de combate). La rama de turno ENEMIGO (0x03f4) no
tiene esta cola: el bando lo filtra el clasificador del bucle (0x0c84 → kernel 0x5646),
así que un PJ poseído NO recibe el pase en sus turnos de bando enemigo.

## 2. Cuerpo de 0x6794 (registro combatiente = idx*8 + 0xba14)

```
67aa: test [bx+2],0x80 / je fin     ; sólo JUGADORES
67b0: test [bx+2],0x28 / jne fin    ; ni dormido (8) ni caído (0x20)
67bf: cmp  [slot*32+0x55c5],0x2a    ; anillo del roster == 42 (Invisibility)
67d1:   mov [obj*8+0x5c5b],0x1d    ;   tile de RENDER ← 0x1D (silueta)
67d8:   or  [bx+2],0x10            ;   flag invisible — RE-APLICADO cada turno
67ee: cmp  [slot*32+0x55c5],0x2c    ; si no: == 44 (Regeneration)
67f5:   push si / call 0x400c      ;   barrido kernel_ring_regen (el push se ignora:
                                    ;   0x400c no lee args, itera el ROSTER entero)
```

- La rama 42 **no consume RNG**; la rama 44 consume `rand(0,7)` por miembro del roster
  no-'D' con anillo 44 (0x400c @0x4032/0x4037 gatea ANTES del rand; +1 HP con ==7, techo
  maxHp vía add_with_cap 0x3f14, escrito en el ROSTER 0x55b8 — no en el registro de
  combate).
- **El pase sólo AÑADE.** No hay rama de limpieza: censo cerrado de escritores del bit
  0x10 sobre registros de combate en los 28 .asm (`and …,0xef` / `or …,0x10`):
  ponen CAST:0x0b17 (Sanct Lor), CAST:0x14ee (poción negra), COMSUBS:0x022c (parpadeo de
  monstruo, flag de tipo 0x800) y ULTIMA:0x67d8 (este pase); apagan CAST:0x077f (Wis Quas
  del jugador — **excluye party**), COMSUBS:0x020f (parpadeo) y ULTIMA:0x6eeb (abajo).
  ⇒ **no existe un Wis Quas enemigo que limpie a un jugador**: el único apagado
  mid-combate de un PJ es quitarse el anillo 42.

## 3. Quién apaga el bit al cambiar equipo — unequip_item 0x6e60

`ZSTATS` (picker del Ready) llama a `0x6e60` en el toggle-off (`0x0cc7 call 0x8c80` =
(0x8c80+0xE1E0) mod 2^16). Dentro:

```
6eca: mov [si],0xff                 ; slot de anillo ← nada
6ecd: cmp word [bp+4],0x2a / jne    ; ¿lo retirado es el anillo 42?
6ed3: cmp [g_location],0x7f / jbe   ; en combate (>0x7f)
6eda: cmp [g_cmb_actor],0x20 / jae  ; hay actor de combate (<32)
6eeb: and [g_cmb_actor*8+0xba16],0xef   ; APAGA el bit 0x10
```

El predicado es **QUÉ se retiró** ([bp+4]==0x2a), no «qué anillo lleva ahora»: cambiar
otro equipo no toca una invisibilidad de Sanct Lor. Y **no restaura el tile de render**:
el `+1` se queda en 0x1D hasta que otro escritor lo pise (p. ej. despertar 0x6800 sin
flag copia `+0→+1`). El encendido tras EQUIPAR el 42 tampoco es inmediato: lo hace este
pase al cerrar el turno del Ready ('R' consume el turno → 0x0b85 corre justo después).

## 4. Careo del port (game/src/core/combat/combat.ts) — lo corregido en este carril

| conducta del binario | port ANTES | port AHORA |
|---|---|---|
| pase al cerrar cada turno de party (0x0b85) | no existía; anillo 42 fijado sólo al montar | `perTurnStatusPass(closing)` en `advanceTurn`, gate `sideOf==="party"` |
| turno auto-pasado del no-activo = pase (0x067c) | `continue` pelado (ni pase ni regen) | pase antes del `continue` en `findNextActor` |
| regen 44 en combate (0x6794→0x400c) | colgado del COMIENZO del turno del portador (RNG desplazado) y con status leído de la ARENA (huido contaba 'D' y no tiraba) | al CERRAR el turno, roster-fiel (status/HP del roster; refleja al combatiente) |
| regen 44 en el MONTAJE (0x6b68 corre el pase entero) | omitido (0 rands en mount) | el placer llama al mismo `perTurnStatusPass` |
| clear al retirar el anillo 42 (0x6ecd) | `invisible = ring===42` recomputado en CUALQUIER sync de equipo — borraba una invisibilidad de Sanct Lor | clear sólo si `removedItemId===0x2a` |

Divergencia declarada (Clase C, orden de RNG): el binario INTERLEAVA por slot la tirada
de rotura 1/16 (0x69f0-0x6a4b) con el pase del mismo slot; el port tira todas las
roturas antes del constructor (`game.ringExpiryEvents`) y pasa después. Sólo distingue
con ≥2 portadores de anillo 42/44 en el party.

**Ventana de RNG censada** (los cambios mueven el stream sólo con anillo 44, o 42 en
mount+turnos): los 49 saves de los tours del espejo (98 ficheros, 16 registros × 32 B,
anillo en rec+0x1d) tienen **cero** portadores de 42/44 — control positivo del offset:
49 llevan el 43 (Protección), que está EXENTO del pase por omisión explícita (dos cmp,
ninguno 0x2b). Ventana = 0 combates de tour; la guarda de cierre es la batería espejo.

Suite: `game/tests/invisibilidad-pase-turno.test.ts` (10 asertos en crudo; estrenada
6-en-rojo contra el código anterior; 5 mutantes muertos: sin-pase-0x0b85, sin-pase-0x067c,
gate-0x28-invertido, regen-en-rama-42, recompute-viejo-en-syncPlayerEquip).
