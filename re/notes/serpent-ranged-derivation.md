# Sea Serpent / Dragon — ataque a distancia en overworld (MAINOUT 0x131A) — CABLEADO

**Carril:** SCOUT (flota del lead) · 2026-07-18 · **Rama:** `fiel/serpent-ranged`.
Cierra el §1 de `overworld-b34-regalia.md` (decisión (A) del lead: cablear lo derivado,
encolar lo medible). Autoridad = ASM (`re/disasm/`), doctrina `disasm-mata-resumen`.

---

## 1. Compuerta — MAINOUT.OVL.asm 0x131A (100% del ASM)

`sub_131A(actor_idx)` = acción especial pre-movimiento (corre ANTES de `0x198C` move):

```
1328: base tile del actor (byte+0) → [bp-0xa]
1331-137b: [bp-4]=|dx|, [bp-6]=|dy| (abs + wrap toroidal 256)
137e-1394: (|dx|,|dy|)∈{(1,0),(0,1)} → MELÉ (0x1248), return 1, SIN rand
13a2: cmp [bp-0xa],0x88 / je 13b3   ; 0x88 = Sea Serpent (def 18)
13a9: cmp [bp-0xa],0xdc / je 13b3   ; 0xDC = Dragon    (def 39)
13ae: else jmp 0x1440               ; pirata (broadside 0x1168) / nada → return 0 (mueve)
13b3: cmp [bp-4],3 / jle 13bc  else jmp 1478  ; |dx|>3 → return 0 (mueve), SIN rand
13bc: cmp [bp-6],3 / jle 13c5  else jmp 1478  ; |dy|>3 → return 0 (mueve), SIN rand
13c5: push 0 ; push 7 ; call rand_range → rand(0,7)   ; ← EL rand, sitio 0x13CC
13cf: je 13d6  else jmp 1478         ; ==0 (1/8) → ATACA ; !=0 → return 0 (mueve)
13d6: <pipeline de ataque §3> ... jmp 0x139c (ax=1) ; return 1, OMITE el move
```

`def.tile = 0x140 + defIndex*4`; byte+0 = `def.tile−0x100` ⇒ 0x88→18 (Sea Serpent),
0xDC→39 (Dragon). Orden: melé → **rand(0,7) sólo en rango 3** → (fire 1/8 | move). Fuera
de rango: SIN rand. Empíricamente el sitio 0x13CC nunca se ejerció en las capturas del
oráculo (no había actor ranged) → derivación estática, con gate de paridad.

## 2. Pipeline del disparo — 0x13D6

```
13d6: call 0x5910   ; REFRESCO de viewport (NO daño — ver §5, errata)
13e9: call 0x43ae   ; sonido del disparo (no portado)
13ec-141b: coords del proyectil (actor−party+5)
1420: call 0x7bea   ; lcall 0x72E:0x2EC — anim/trace del proyectil (OPACO, §4 Clase-C)
142d: call 0x3522   ; dibuja impacto
143a: call 0x109e   ; ← DAÑO
```

## 3. Daño — MAINOUT 0x109E = daño al CASCO de la fragata

```
10a4: al = g_transport_tile ; and 0xf8 ; cmp 0x20 ; jne 0x1160 (redibuja, SIN daño ni rand)
      ; ⇒ SÓLO daña si el party navega en FRAGATA (tile 0x20-0x27 = transport "ship")
10b0: rand_range(1,30)                     ; ← daño al casco
10be: cmp dmg, g_char_anim_states+5 (HULL) ; 
10c8: si dmg < hull → hull -= dmg ; return ; el casco aguanta
10d6: si dmg ≥ hull → hunde/degrada: string 0x6ada + skiff→carpet(+rand(0,1) facing)→ahogo
      ; el casco NO se toca al hundir (damage_ship deja g_hull; transport.md §7E)
```

Es el «Sea Serpent mece/ataca el barco» del Book of Lore: **rand(1,30) al casco**
(`shipHull`), hundimiento si iguala/supera el casco. A pie/caballo/skiff = SIN daño ni
rand (rama 0x1160). El Dragon a pie: 0x109E no daña; su «fireball» a pie, si existe,
viviría en 0x7bea (§4, Clase-C).

## 4. CLASE-C precisa — el residuo opaco `0x7bea`

`0x7bea` = `lcall 0x72E:0x2EC`: far-call cuyo **segmento se reubica en carga**, opaco al
disasm estático. Es un thunk usado por TODO ULTIMA.EXE (bloque 0x7A22+). **ASUNCIÓN del
cableo actual:** NO consume rand del stream de MOVIMIENTO (candidato a render/animación
del proyectil — un consumidor SEPARADO ya modelado por `tileprog.ts`, ver
`overworld-ai-rng.md` §animación). El orden de rand cableado en `fireRangedAtParty` es:
`rand(0,7)` (compuerta) → `rand(1,30)` (casco, sólo fragata) → `rand(0,1)` (facing de
alfombra, SÓLO si hunde a alfombra). Si el witness (abajo) mide que 0x7bea consume rand
de movimiento, su consumo se inserta ENTRE la compuerta y el daño de casco.

## 5. ERRATA al §1 de `overworld-b34-regalia.md` — `0x5910` NO es el daño

La nota previa decía «call 0x5910 = rutina de ataque a distancia». **FALSO**: `0xFFFFD740`
mapea a ULTIMA.EXE `0x5910` (bias +0x81D0, verificado con el mapeo conocido de rand_range),
pero `0x5910` **reconstruye el viewport 11×11** alrededor del party (get_tile_ptr 0x4402),
no aplica daño. El daño real está en `0x109E` (§3). Errata aplicada al censo.

## 6. Cableo (esta rama) + cotejo con el port

`world/enemies.ts::moveActor` ya implementaba el melé de 0x131A y el dispatch de 0x198C
(#37, RNG de movimiento). Se añadió la rama RANGED entre ambos (mismo punto que 0x131A
antes de 0x198C): compuerta def 18/39 + rango 3 + `rand(0,7)`; on-fire →
`fireRangedAtParty` (casco `rand(1,30)` en fragata, hundimiento vía `sinkPlayerShip`), y
OMITE el move. Los mensajes de hundimiento se drenan en `outdoorWorldTurn`
(`takeRangedFireMessages`) porque el disparo no inicia combate. **RNG-neutro** para los
fixtures de paridad (#37): ninguno tiene def 18/39 → la rama nunca ejecuta; overworld-ai
20/20 + suite 2236 verdes. Tests: `game/tests/serpent-ranged.test.ts` (6).

---

## WITNESS BRIEF (para el carril de oráculo — serpent-fire, cola tarea #11)

1. **Escenario:** party en FRAGATA en mar abierto, seed fija, UN Sea Serpent (tile 0x188)
   sembrado a dist 2-3 del party; sin otros actores errantes (limpiar slots 1..31).
2. **BPs:** `rand_range` kernel 0x2092 en los SITIOS: `0x13CC` (compuerta 0,7), `0x10B0`
   (casco 1,30), y el `0x1111` (facing alfombra 0,1) si se fuerza hundimiento (hull bajo).
3. **Medir:** entre el `rand(0,7)` de 0x13CC y el `rand(1,30)` de 0x10B0, ¿hay ALGUNA
   `call 0x2092` intermedia (la atribuible a `0x7bea`/0x72E:0x2EC)? Registrar `(caller_ret,
   lo, hi, seed_before)` en orden.
4. **Veredicto:** si 0 rands intermedios → la ASUNCIÓN Clase-C se confirma (cableo actual
   correcto). Si ≥1 → anotar rango+orden y añadir su consumo en `fireRangedAtParty` entre
   compuerta y casco.
5. **Bonus barato:** confirmar que a PIE (transport≠fragata) el 0x109E no tira `rand(1,30)`
   (rama 0x1160) — valida el gate de fragata del cableo.
