# (K)limb — derivación completa del comando y la rama de montaña+garfio

Tarea #35. Reporte del usuario: con el garfio (Grapple) en el inventario, en el
overworld `K` no permitía escalar montañas pequeñas. Este documento deriva el
comando ENTERO del asm (todas las ramas), audita el port y explica el fix.

Disasm: `re/disasm/{CMDS,TOWN,DUNGEON}.OVL.asm`, `command-dispatch.md`,
`overlay-load-layout.md §3` (thunks inter-overlay). CBASE(CMDS/SJOG)=0xBF80.

---

## 1. Dispatcher del kernel para 'K'

`command-dispatch.md` L233:

| Tecla | Nombre | Kernel | Eco | Handler por contexto |
|-------|--------|--------|-----|----------------------|
| K | Klimb | 0x32E8 | `"Klimb-"` | **exterior (g_location==0)** → CMDS:0x1C20 (thunk 0x809A) · **pueblo/small map** → TOWN:0x0B82 (0x7ACA) · **mazmorra** → DUNGEON:0x1E10 (0x7C86) |

El dispatcher imprime el prefijo `"Klimb-"` ANTES de bifurcar, en los tres
contextos. La bifurcación es por `g_location` (0 = overworld/underworld;
0x01–0x20 = town/castle/dwelling; 0x21–0x28 = dungeon).

---

## 2. Rama EXTERIOR — Klimb-con-garfio sobre montaña (CMDS 0x1C20) `cmd_klimb_grapple`

Transcripción de `CMDS.OVL.asm` 0x1c20–0x1d0a:

```
1c28: cmp [g_grapple 0x57AF],0 ; ¿tiene garfio?
1c2d: jne 1c3a                 ;   sí → sigue
1c2f: ax=0x9016 ("With what?") ;   no → imprime (0x58d0) y FIN (1d05). sin turno.
1c3a: cmp [g_transport_tile 0x587C],0x1c ; ¿a pie? (tile del avatar-a-pie = 0x1C)
1c3f: je  1c46                 ;   sí → sigue
1c41: ax=0x9022 ("On foot!")   ;   no (montura/barco/…) → imprime y FIN. sin turno.
1c46: call 0x766c (getdir)     ; PIDE DIRECCIÓN
1c49: or ax,ax; jne 1c50       ;   dir≠0 → sigue
1c4d: jmp 1d05                 ;   dir==0 (cancelado) → FIN, SIN mensaje y SIN turno.
1c50..1c71: celda objetivo = (g_party_x+dx, g_party_y+dy)   ; dx,dy = g_cmb_scratch_{x,y}
1c74: call 0x8482(nx,ny) → bx  ; puntero al tile; al=[bx] = tile RAW del mapa
1c84: cmp ax,0x0D; je "Impassable!" (0x902c) → imprime y FIN. sin cruzar, sin turno.
1c8e: cmp [tile],0x0C; jne "Not climbable!" (0x903a) → imprime y FIN. sin turno.
      ; ── tile == 0x0C (SmallMountains): ESCALAR ──
1c9a: bp-2 = 0
1c9f: si loop 0..g_party_size:
1cb3:   cmp status[0x55B3+i·0x20],0x44('D'); je skip   ; muertos NO tiran
1cc0:   rand(1,30) → ax                                 ; (kernel 0x6112)
1cca:   cmp DEX[0x55B5+i·0x20], ax; jae skip            ; DEX >= roll → sube sin daño
1cce:   ax=0x904a ("Fell!"); print                      ; DEX < roll → cae
1cde:   rand(1,5) → daño;  1ce2: call 0x6ad2 apply_damage(member=si, dmg) ; clamp
1ce5: di+=0x20; bp-0x10+=0x20; inc si; si<size → 1cb3
1cfc: call 0xBBC6 (move party over) con (dx,dy)          ; la party CRUZA la montaña
1d05: FIN
```

Reglas exactas:
- **Gate garfio** (1c28): `g_grapple` en 0x57AF (byte 0x209 del SAVED.GAM). Sin él,
  `"With what?"`, sin dirección ni turno.
- **Gate a-pie** (1c3a): `g_transport_tile==0x1C`. Montura/barco/carpet → `"On foot!"`.
- **getdir** (1c46, kernel 0x766c): pide dirección. Cancelar (=0) → FIN silencioso
  **sin turno** (1c4d). ≠ el (K)limb de pueblo, que sí cobra el minuto al cancelar.
- **Tile objetivo** (via 0x8482 = tile RAW del mapa):
  - `0x0D` (TallMountains) → `"Impassable!"`, sin cruzar, sin turno.
  - `≠0x0C` → `"Not climbable!"`, sin cruzar, sin turno.
  - `0x0C` (SmallMountains) → **único escalable**.
- **Tirada por miembro** (orden de roster, crítico para el stream RNG):
  muertos (`status=='D'`) se saltan ANTES de tirar; `rand(1,30)`; `DEX>=roll` sube
  sin daño; si no, `"Fell!"` + `rand(1,5)` de daño con clamp. Orden de consumo:
  `dexRoll(m0)[,dmg(m0)], dexRoll(m1)[,dmg(m1)], …`
- **Cruce** (1cfc): la party se mueve a la casilla de la montaña **siempre** (aunque
  alguien caiga). El world-turn / passtime lo dispara la rutina de movimiento 0xBBC6.

Strings (CMDS data): 0x9016 `"With what?"`, 0x9022 `"On foot!"`, 0x902c
`"Impassable!"`, 0x903a `"Not climbable!"`, 0x904a `"Fell!\n"` (sin nombre).

Tileset del clon (`game/src/core/data/TileData.json`): idx **12 = SmallMountains**
(escalable), **13 = TallMountains** (intransitable). Calzan exacto con 0x0C/0x0D.

---

## 3. Rama PUEBLO / small map (TOWN town_klimb 0x0B82) — ya en el port

`town-klimb.md §2`. Prefijo `"Klimb-"` + submensaje:
- a caballo (`g_transport_tile&0xFE==0x12`) → `"-On foot!"` y sale.
- tile bajo la party 0xC8 LadderUp → sube · 0xC9 LadderDown / 0x86 Grate → baja.
- otro tile → getdir 0xB41C; mira party+dir: 0x4C roca baja / 0xCA·0xCB valla → la
  party se encarama (sin RNG, cruza, cobra turno); cualquier otro → `"What?"`.
- **cancel del getdir COBRA 1 turno** (0x0C3E, `[bp-2]=1`) — validado byte a byte;
  contrasta con `"Klimb-What?"` (target inválido, 0x0C38) que NO cobra.

Nota: las escaleras (0xC4–0xC7) NO son casos de Klimb en pueblo — su transición de
planta es AUTOMÁTICA al pisarlas (`stair_transition 0x052E`, `applyStairStep`).

## 4. Rama MAZMORRA (DUNGEON dng_klimb 0x1E10) — YA en el port (verificado)

Dispatcher enruta K en dungeon a DUNGEON:0x1E10 (0x7C86). **No pasa por game.klimb()**:
la UI, con `game.dungeonState` vivo, enruta la tecla a `handleDungeonKey` → `game.
dungeonCommand("klimb")` → `DungeonState.klimb()` (dungeon.ts:256). Verificado contra el
asm (1e10–1f4a) y `dungeon.md §4.4`:

```
1e2c: tilehi = 0x10dc(x,y) & 0xF0             ; nibble alto de la celda ACTUAL (ladder)
1e52: lit = [0x595a + floor·64 + y·8 + x] & 8 ; bit 0x08 raw = variante ILUMINADA
canUp  (bp-2) = tilehi∈{0x10,0x30}  OR  (lit≠0 AND g_grapple≠0)    ; 1e5e-1e74
canDown(bp-4) = tilehi∈{0x20,0x30,0x60}                            ; 1e79-1e8b (0x60=hoyo)
```
- Escalera UP hi 0x1, DOWN hi 0x2, ambas hi 0x3; **hoyo 0x6 = sólo DOWN** (bajas por él).
- up+down → prompt `"Klimb-U/D-"` (0x6cba, getkey 0xa49c: U/↑ sube, D/↓ baja, Space →
  `"Pass"` 0x6cc6 sin moverse; otra tecla se ignora y sigue esperando) — **PORTADO (#40)**;
  sólo-up → sube; sólo-down → baja.
- al tope (planta 0 + up) SALE a Britannia; planta más honda + down SALE al Underworld.
- **NO** hay trampa de escalera: subir/bajar no daña (el clon previo lo inventaba; ya
  corregido en el port).
- Strings de fallo (`0x595a`/`DATA.OVL` delta +0x10; `"Klimb-"` va incluido en el string):
  - ni sube ni baja y **lit≠0** (techo escalable) → **`"Klimb-\nWith What?"`** (0x6cd6):
    ves el techo pero te falta el garfio.
  - ni sube ni baja y **lit==0** → **`"Klimb-what?"`** (0x6cea).

El bit 0x08 = variante iluminada del tile: `0x10dc` lo enmascara (`&0xf7`) para tiles
<0x90, pero el read crudo de 1e52 lo conserva. Vive ESTÁTICO en los datos (109 celdas de
`dungeons.json` con `sub&8`, entre ellas las Room 0xF_ y las escaleras/hoyos ya lit) y
además se PRODUCE al limpiar un campo (`&=8`, p.ej. un sleep-field despejado queda
`Nothing|0x08`). En el port ya vive en `cell.sub` (`LIT_BIT=0x8`), preservado por los
`setCell(..., sub & LIT_BIT)` → **no hace falta un flag "visitada" aparte**.

### 4.1 Rama de garfio en mazmorra — PORTADA (tarea #38)
`dungeon.ts` `klimb()` ahora: `canUp = ladderUp || (lit && state.grapple)`; y en el brazo
sin-salida devuelve `"Klimb-\nWith What?"` si `lit`, `"Klimb-what?"` si no. Reachability
real: tras despejar un sleep-field (celda `Nothing|0x08`), Klimb sin garfio da "With
What?" y con garfio sube. Tests discriminantes en `dungeon.test.ts` (garfio+lit→sube ·
lit sin garfio→"With What?" · no-lit con garfio→"what?" · escalera independiente del bit).

### 4.2 Prompt "Klimb-U/D-" (escalera arriba Y abajo) — PORTADO (tarea #40)
Cuando la celda ofrece AMBAS vías (LadderUpDown, o LadderDown/hoyo + techo-lit con garfio)
el original abre el prompt `"Klimb-U/D-"` (0x6cba) y lee la elección (1e9c-1ee6). Port:
- `DungeonState.klimbNeedsChoice(state)` = `canUp && canDown` (pura, sin efectos); `klimb`
  acepta `dir` = `"up"|"down"|"pass"`. `Game.dungeonKlimbNeedsChoice()` la expone.
- `main.ts handleDungeonKey`: al pulsar K con ambas vías, NO despacha (el getkey del asm es
  libre → K no cuesta turno); muestra `"Klimb-U/D-"` y arma el prompt. La siguiente tecla:
  U/↑ → `dungeonCommand("klimb","up")`; D/↓ → `"down"`; Space/Esc → `"pass"` (imprime
  `"Pass"`, sin moverse). Otra tecla se ignora y el prompt sigue (como el bucle de getkey).
  El turno lo cobra la resolución (dungeonCommand corre `advanceTurn`), igual que el asm
  retorna 1 en U/D/Pass. (Esc = añadido ergonómico; el asm sólo usa Space para "Pass".)
- Tests: `dungeon.test.ts` (ambas→needsChoice true · una sola→false · "up"→sube · "down"→
  baja · "pass"→"Pass" sin moverse · garfio compone LadderDown+lit→ambas).

Balance de garfio: en TODO el juego hay **dos** brazos de Klimb gateados por `g_grapple`
— (1) montaña del overworld (CMDS 0x1C20, #35) y (2) techo iluminado en mazmorra (DUNGEON
0x1e6e, #38) — **ambos portados**. El prompt U/D (#40) completa el `dng_klimb` fiel.

---

## 5. Auditoría del port (antes del fix)

- `game/src/core/world/commands.ts`: `klimbGrapple(members, rand)` — función PURA de
  las tiradas por miembro. **Correcta** y con tests de stream (commands.test.ts) +
  parity (`__parity__/cmds-run.ts`). Constantes `KLIMB_MOUNTAIN_TILE=0x0C`,
  `KLIMB_IMPASSABLE_TILE=0x0D`. **Correctas.**
- `game/src/core/game.ts` `klimb()`: bifurca por `location===0` → `klimbGrapple` (glue)
  vs `klimbTown`. Los gates garfio / a-pie / Impassable / Not-climbable / cruce+tirada
  estaban **bien cableados**.
- **BUG (causa del reporte):** el brazo `!dir` de `klimbGrapple` (glue) emitía
  `{message:"What?"}` en vez de `{needs-direction}`. Como el getdir del original se pide
  TRAS validar garfio+a-pie, la UI **nunca** recibía la señal para pedir dirección → el
  jugador pulsaba K, veía "What?" (o "With what?") y la montaña quedaba **inalcanzable
  desde teclado**. La mecánica existía pero era código muerto por la UI.
- **BUG 2 (turno en cancel):** `klimbCancel()` cobraba SIEMPRE 1 turno. Correcto para
  pueblo (0x0C3E) pero NO para el overworld-garfio, cuyo getdir-cancel termina sin
  passtime (1c4d). Al reactivar el prompt en overworld, había que exceptuar loc 0.
- Datos del garfio: `saveNative.ts` lee/escribe `grapple` en `gam[0x209]`; `state.ts`
  lo lleva en `GameState.grapple`; Ztats imprime `" Grapple"` sólo si `grapple≠0`
  (`skin/fiel/ztats.ts`). El ítem se MODELA y persiste; obtenerlo en el mundo (Get de
  la tumba de Grendel, etc.) es flujo de objetos aparte, fuera de esta tarea.

## 6. Fix aplicado (rama `fiel/klimb`)

`game/src/core/game.ts`:
1. `klimbGrapple` glue, brazo `!dir`: emite `{kind:"needs-direction", command:"klimb"}`
   (antes `{message:"What?"}`). La UI (main.ts:719) ya sabía pedir dirección para klimb
   (lo usaba el pueblo) y re-despacha `game.klimb(dir)`.
2. `klimbCancel()`: si `location===0` retorna sin turno (getdir-cancel del garfio, 1c4d);
   fuera del overworld conserva el cobro del minuto del pueblo (0x0C3E).

Tests: 7 casos de wiring en `game/tests/game.test.ts` (describe "Klimb-con-garfio en el
overworld"): sin-garfio/`With what?`, a-caballo/`On foot!`, sin-dir/pide-dirección,
montaña-12/cruza+turno, montaña-13/`Impassable!`, hierba/`Not climbable!`, cancel-sin-turno.
Los tests de la función pura (commands.test.ts) siguen cubriendo el stream de tiradas.

## 7. Pureza / RNG

- La función pura `klimbGrapple` y su orden de tiradas **no se tocaron** → el corpus de
  parity de CMDS no cambia.
- `klimbCancel()` en overworld ahora consume **cero** RNG (antes corría un
  `runContextTurn` = viento/spawn/housekeeping). Es corrección hacia el asm (1c4d no hace
  passtime). No lo ejercita `__parity__/cmds-run.ts`. **La corre el orquestador al
  aterrizar**, no yo.
