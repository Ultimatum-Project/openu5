# El «techo del disasm» como coartada — familia de diferimientos FALSOS

> Barrido de citas (B), 2026-07-25, carril `re/frontera-verify`. Hallado al resolver
> citas del port; NO es una nota de proceso: cada fila es una derivación que estaba
> declarada imposible y no lo era.

## El error, en una frase

`re/disasm/ULTIMA.EXE.asm` cubre **offsets de FICHERO 0x0000–0x86EE**. Un
`call 0xffffXXXX` que imprime el disasm de un overlay es un **destino near-call CRUDO**,
no una dirección. Comparar el crudo contra `0x86EE` mezcla dos sistemas de coordenadas y
produce la conclusión falsa «está por encima del techo del disasm ⇒ seg2 ⇒ no resoluble
estáticamente ⇒ Clase C / hace falta testigo».

La resolución correcta es la de `overlay-load-layout.md §3`:
`CS = (near_call_base(banda) + crudo) & 0xFFFF`, y si el CS cae en `[0x7A16,0x81C6)`
hay un segundo salto por el stub kernel→overlay.

`summon-gate-resolved.md:94` ya lo diagnosticó una vez («era el label file-relativo, no
el destino»), pero la lección no se propagó y volvió a aplicarse al menos tres veces.

## Casos encontrados

| dónde | crudo | conclusión que sostenía | destino REAL |
|---|---|---|---|
| `witness-9cb6-bonus.md` (cabecera «BLOQUEADO») | `0x9cb6` | «0x9cb6>0x86ee → seg2 … defiero a witness vivo» | **COMBAT.OVL:0x120e `random_board_cell`** (banda 4 → CS 0x7E96 → stub). CERRADO: 2 tiradas `rand_range(0x0f)`, x antes que y |
| `fixture-combat-cast.md:54` | `0x9cb6` | «seg2, sobre el techo del disasm … cluster de ret0» | idem |
| `game/src/core/sfx.ts:166` + `game/src/skin/fiel/speaker.ts:476` | `0x8de2` | «los params acústicos exactos son Clase C, calibrados al testigo» | **ULTIMA.EXE:0x3072 `screen_shake_fx`** (BLCKTHRN, banda 2 → CS 0x3072). Legible entera: alterna `gfx_bar_sweep` 0x71ca/0x7200 con tonos de `rand_range` + `set_tone` 0x22e2. Los params NO son Clase C |
| `game/src/core/dungeon/dungeon.ts:319` + `endgame/use-tools.ts:255` | `0xffffc126` | «kernel residente sin resolver estáticamente … la lectura conservable es la única defendible sin testigo vivo» | **CAST2.OVL:0x07bc `an_grav_dispel_field`** (CAST, banda 3 → CS 0x80A6 → stub). Ver §1 |

## §1 — `an_grav_dispel_field` (CAST2.OVL:0x07bc, 302 B) leída entera

**Rama MAZMORRA** (`g_location < 0x80`, 0x07c4-0x0863):

```
07db: dir = g_dng_facing ; dx = [dir*2 + 0x24d6] ; dy = [dir*2 + 0x24de]
07f2: ptr = 0x595a + g_floor*64 + g_party_y*8 + g_party_x      ; LA CELDA PROPIA
081a: if (*ptr & 0xf0) != 0x80 →                                ; no hay campo bajo los pies
0822:    ptr = 0x595a + g_floor*64 + ((y+dy)&7)*8 + ((x+dx)&7)  ; entonces la ENCARADA (con wrap)
0840: if (*ptr & 0xf0) == 0x80 → *ptr &= 8 ; print DS 0x954c "Field destroyed!\n" ; return -1
085e: else return 0
```

- ⛔ **La «lectura conservable = celda encarada» del port es INCOMPLETA.** La rutina mira
  **primero la celda en la que ESTÁ la party** y sólo si ahí no hay campo pasa a la
  encarada. Estar DENTRO de un campo y usar el Cetro lo disuelve; el port no lo haría.
- ✅ **Singular** (un solo campo por uso) — eso el port lo tenía bien.
- Detalle: el borrado es `*ptr &= 8`, es decir conserva **sólo el bit 3** (iluminado) y
  tira el resto del tile.
- Las coordenadas de la celda encarada **wrapean** con `and 7` en ambos ejes (planta 8×8).
- ⚠ **RESIDUAL PRECISO, no cerrado:** la propia rutina imprime **«Field destroyed!»**
  (DS 0x954c), mientras que `dungeon.ts:319` atribuye al LLAMANTE un «Field dissolved!»
  (DS 0x496f). No he leído el llamante (CAST.OVL 0x1a04), así que no sé si el jugador ve
  un mensaje o los dos. Queda declarado.

**Rama NO-MAZMORRA** (`g_location >= 0x80`, 0x0866+): recorre los 32 objetos de mundo
(`0x5c5a`, stride 8) buscando `tile & 0xfc == 0xE8` — los campos **In\*Grav 0xE8-0xEB** —
en `(g_cmb_scratch_x, g_cmb_scratch_y)`; al encontrarlo pone `[bp-6]=1` y borra el slot
(`call 0x5894` con 7 args a 0). Toca de lleno el supuesto abierto de
`arena-fields-encoding` (los objetos-campo que el port descarta).
