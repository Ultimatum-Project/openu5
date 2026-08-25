# CORRECCIÓN a `overworld-b34-regalia.md` §3a — el Cetro NO disuelve campos 0x80-0x83

**Carril:** SCOUT (relevo) · 2026-07-18 · **Rama:** `fiel/sceptre-dissolve`.
Verificación independiente del §3a de `overworld-b34-regalia.md` (ya en main, e829490e)
releyendo `re/disasm/CAST.OVL.asm` 0x1966 instrucción a instrucción (doctrina
`disasm-mata-resumen`). **El spec de cableo del §3a es materialmente incorrecto** en 3
puntos. El propio comentario del port (`game.ts::useSceptre` 3778-3789) arrastra el mismo
error. Esta nota fija la derivación correcta.

---

## Lo que el §3a (y el comentario del port) afirman — INCORRECTO

> «El Cetro disuelve los campos de fuerza/energía (In Flam/Nox/Zu/Sanct Grav) de las celdas
> contiguas: "Field dissolved!" por cada uno … tiles ∈ {0x80,0x81,0x82,0x83} → restaurar el
> suelo base.»

Tres errores:
1. **Rango de tiles equivocado.** El barrido NO toca 0x80-0x83 (los campos elementales de
   In Flam Grav; en `TileData.json` 0x80-0x83 son `TortureChair/TortureTable`, y el
   `FIELD_WALL_TILE` del port los usa como campos). El binario dissuelve **0x70-0x7F**.
2. **No hay string «Field dissolved!» por celda.** El bucle es SILENCIOSO (sólo SFX).
3. **Falta la compuerta de ubicación y el destino de restauración** (grass=5; skip en
   mazmorras 0x21-0x28).

## Derivación correcta — `CAST.OVL.asm` 0x1966 (handler del (U)se Cetro)

Confirmado que 0x1966 ES el Cetro: empuja str 0x4950 «Sceptre», 0x495a+0x4a84 «Wielding the
Sceptre of Lord British…», y el `useSceptre` del port cita exactamente esos offsets.

```
1966-197a: print "Sceptre" / "Wielding the Sceptre of Lord British..."
197b-198f: call 0x6212            ; efecto/sonido de blandido
1992: [bp-2] = 0                   ; contador de barreras disueltas
1997: cmp g_location, 0x21
199c: jb 0x19a5                    ; location < 0x21 (overworld/town) → HACER barrido
199e: cmp g_location, 0x28
19a3: jbe 0x19fb                   ; 0x21..0x28 (las 8 MAZMORRAS) → SALTAR barrido
                                   ; (location > 0x28 también barre)
; ---- barrido 3×3 alrededor del party (dx,dy ∈ -1..+1, INCLUYE la celda central) ----
19a5: [bp-0xc]=dx=-1
19aa: si=dy=-1
19c1: call 0x8482                  ; puntero al tile en (party_x+dx, party_y+dy)
19c6: al = *tile ; and 0xf0 ; cmp 0x70   ; ← nibble alto == 0x70  ⇒ tiles 0x70-0x7F
19cc: jne 0x19e6                   ; no-barrera → siguiente celda
19ce: *tile = 5                    ; ← restaura a GRASS (tile 5)
19d1: call 0x9990                  ; redibuja la celda
19d4-19e0: call 0x62bc(0xa,0xbb8,0x7d0)   ; SFX (sin texto)
19e3: inc [bp-2]                   ; barreras++
19e6-19ea: inc dy ; while dy<=1
19f2-19f9: inc dx ; while dx<=1
; ---- cierre ----
19fb: cmp [bp-2], 0
19ff: je 0x1a04                    ; si NINGUNA disuelta → rama 0x1a04
1a01: jmp 0x1b8a                   ; si ≥1 disuelta → FIN SILENCIOSO (ni "No effect")
1a04: sub ax,ax ; call 0xFFFFC126  ; (rama alterna: mazmorra/Shadowlord — sin derivar)
1a0d: cmp ax,1 ; je → print 0x496f
1a18: cmp [bp-8],0 ; je → 1a21
1a21: print 0x4981 = "No effect!"
```

### Identidad de los tiles 0x70-0x7F
En `TileData.json`: 0x70-0x73 = **ShadowlordBoundary1-4** (`IsWalking_Passable=false`).
Son las **barreras de fuerza / muros mágicos**, NO los campos elementales. Esto encaja con
el clue-book («Sceptre cuts any magical/ethereal barrier») — «barrera», no «campo de
hechizo». El destino de restauración es **Grass (tile 5)**, incondicional.

## Reachability — por qué el port «acierta» por accidente

Búsqueda de tiles 0x70-0x7F en los mapas del port:
- `overworld.json`, `smallmaps.json`, `dungeons.json`, `underworld.json`: **NINGUNO**.
- `combatmaps.json`: sí (0x70-0x7f como muros de arena) — pero el Cetro NO se (U)sa en
  combate, y además el barrido salta las mazmorras.

⇒ En juego normal **no hay ninguna ShadowlordBoundary adyacente alcanzable** en una
ubicación donde el Cetro barra. Por eso lo observable es SIEMPRE «No effect!» (rama 0x1a04),
que es lo que el port hardcodea. El port es **infiel en el mecanismo** (nunca escanea) pero
**coincide en el resultado observable** en todos los mapas reales.

## Veredicto corregido §3a

**DIVERGE (mecanismo), pero PRÁCTICAMENTE INERTE.** El port hardcodea «No effect!»; el
binario hace un barrido 3×3 de tiles 0x70-0x7F→grass(5) (silencioso, +SFX), salta las
mazmorras 0x21-0x28, y tiene una rama alterna 0x1a04 (mazmorra/Shadowlord vía 0xFFFFC126,
sin derivar aquí). Como 0x70-0x7F no aparece en ningún mapa no-combate del port, **cablear
el barrido no cambia nada observable en juego normal**.

### Recomendación
- **NO cablear con el spec del §3a** (0x80-0x83 + «Field dissolved!»): es erróneo y
  dissolvería los campos elementales de In Flam Grav, comportamiento que el binario NO
  tiene aquí. Cablearlo sería introducir una infidelidad nueva.
- Si el lead quiere fidelidad de mecanismo (baja prioridad, sin efecto visible): usar el
  spec CORREGIDO — barrido 3×3 de `(tile&0xf0)==0x70`→5 vía `mapOverrides` (como
  `fieldSpell`/`doors`), silencioso, gate `location∉[0x21,0x28]`, «No effect!» sólo si 0
  disueltas. Pendiente: derivar 0xFFFFC126 (rama de mazmorra/Shadowlord) antes de un
  cableo completo.
- **Corregir el comentario de `game.ts::useSceptre`** (hoy dice «disuelve In Flam/Nox/Zu/
  Sanct Grav … campos 0x80-0x83») y el §3a del censo/nota en main.

## Nota sobre los otros ítems del `overworld-b34-regalia.md`
Los §1 (Sea Serpent/Dragon ranged), §2 (Mimic), §3c (Corona CONFIRMA / Amuleto negate) NO
los re-verifiqué en esta pasada; el §3a era el único marcado «cable-ready» y resultó tener
el spec roto. Recomiendo una relectura del §1 (el daño 0x5910 sigue sin derivar y toca el
stream de RNG de paridad de overworld — no cablear sin witness) antes de tocarlo.
