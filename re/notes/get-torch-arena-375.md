# #375 — El fallback por TILE de `cmd_get` corre EN LA ARENA: antorchas de pared («Borrowed!»), platos y trigo

**Carril `fix-375`** · 2026-08-20 · Citas: `re/disasm/SJOG.OVL.asm` (cmd_get `0x18ce`,
leído ENTERO `0x18ce-0x1b33`), `re/disasm/ULTIMA.EXE.asm` (getdir `0x35ec`), strings
DATA.OVL (`fileoff = DS + 0x10`). Origen: divergencia declarada por cabos-353 en
`siembra-objetos-cbt-353.md` §7 («documentado aquí, no arreglado»).

## 1. La estructura de cmd_get, y por qué el fallback alcanza a la arena

`SJOG:0x18ce` es el MISMO Get del overworld y del combate (funnel COMBAT.OVL `0x0544`
code 0 → thunk CS `0x7e06`, tabla ya resuelta en `combat-commands.md §Resolución`):

```
18d6: loc ∈ [0x21,0x29) → call 0x179e (variante de pasillo de mazmorra) y RET
18ea: call 0x766c (getdir kernel 0x35ec); 0 = cancelado → RET
1900-1917: target = g_party_x/y + delta   ; en arena party_x/y = actor de turno (0x063e)
193d-19bd: BARRIDO de la tabla de objetos 0x5c62 (slots 1..31): casa (x,y[,floor
           sólo con loc<0x80 — 0x1950/0x1955]) y kind aceptado (<0x10 · 0x19 ·
           0x1b · familia 0xb4, 0x196a-0x197d) → get_item_switch 0x1458 y RET
19b7: cmp si,0x5d5a — barrido AGOTADO → slot 0x20 → 0x1982 jge 0x19c0
19c0: FALLBACK POR TILE: call 0x8482(x,y) → tile; switch 0x19cf + 0x1b0e
```

El switch del fallback **no mira `g_location` en ninguna rama**. El único gate de
location de todo el bloque es el repintado `call 0xffff9eca` de la rama antorcha,
saltado con `loc>=0x80` (`0x19fb cmp byte [g_location],0x80 / jae 0x1a05`) — y en
combate `g_location = 0xFF` (centinela ya derivado, `COMBAT_LOCATION_SENTINEL`).
⇒ **el fallback corre en la arena tal cual**, con el repintado fuera y todo lo demás
dentro.

## 2. La rama ANTORCHA (0x1b1b → 0x19e8-0x1a27), instrucción a instrucción

```
1b1b: cmp ax,0xb0 / jl 0x1b28 ; cmp ax,0xb1 / jg 0x1b28 → jmp 0x19e8
19e8: call 0x8482(x,y) → bx                ; puntero al tile en el búfer VIVO
19f3: mov byte [bx],0x44                   ; antorcha → suelo de ladrillo
19f6: mov byte [g_unk_24e6],1             ; marcador del overworld (turno/redraw)
19fb: cmp [g_location],0x80 / jae 0x1a05  ; arena (0xFF): SALTA el call 0x9eca
1a05: mov byte [g_torch_mins],0x64        ; ASIGNACIÓN a 100 — ni suma ni max
1a0a: push 0x8de8 ; call 0x58d0           ; "Borrowed!\n"
1a11-1a21: push 0x320,0x7d0,1,0x32 ; call 0x842e   ; glide 800→2000, paso 1, dur 50
1a24: call 0x9990                          ; viewport_redraw
1a27: jmp 0x1b2e                           ; exit — NI karma NI comida NI antorchas+1
```

Sin gate de dirección (a diferencia de los platos): la antorcha se descuelga desde
cualquier lado. Todas las llamadas de la rama estaban YA adjudicadas en pool (control
positivo: la misma convención produce los efectos conocidos en sus otros llamadores):

| call | destino | fuente de la adjudicación |
|---|---|---|
| `0x766c` | kernel 0x35EC `prompt_direction` | citas-sesgo-overlay.md (control +) |
| `0x8482` | kernel 0x4402 `get_tile_ptr` (`(y<<5)+x`) | consumidor-243-acta.md fila 11 |
| `0x58d0` | print | corpus (uso universal) |
| `0x842e` | kernel 0x43AE `pcspeaker_glide` | absorcion-179-acta.md (misma dirección, testigo OUTSUBS 0x0482) |
| `0x9990` | `viewport_redraw` | plaga-323-acta.md (vía absorcion-179 §102) |
| `0x7f94` (platos) | kernel 0x3f14 `counter_add` cap 0x270f | combat-spells.md:157 · cmds.md:304 |

**RNG: CERO** — ninguna de esas rutinas toca `g_rng` ⇒ el fix no mueve ningún stream
ni caduca digest alguno. **Turno**: en arena lo consume el funnel SIEMPRE
(`combat_cmd 0x0544` descarta el retorno, `sub ax,ax` @0x05b0; bucle `[bp-4]=1`
@0x083e) — incluso los rechazos («Can't reach plate!», «Nothing to get!»). El
no-consumo de los early-exits es exclusivo del overworld (marcador `0x24e6`).

## 3. Las ramas hermanas del switch (mismo fallback, misma arena)

- **0x2D trigo** (`0x19df → 0x1a2a`): tile→`0x2C`, `or [24e6],2`, "Crops picked!\n"
  (DS 0x8df4), comida `counter_add(+1, cap 9999)` (0x1a44-0x1a50), karma−1 si ≠0
  (`0x1a58 cmp/jne → 0x1a62 dec`).
- **0x9A plato mitad alta** (`0x19d2 → 0x1a6a`): gate `dy==+1` (`cmp [bp-0xe],1`) →
  tile→`0x95` + "Mmmmm...!\n" (DS 0x8e04) + comida/karma; si no → "Can't reach
  plate!\n" (DS 0x8e10).
- **0x9B mitad baja** (`0x1b0e → 0x1a92`): gate `dy==−1`; strings 0x8e24/0x8e30.
- **0x9C dos mitades** (`0x1b16 → 0x1aca`): `dx==±1` → rechazo (0x8e44); con `dy==+1`
  deja `0x9B` y con `dy==−1` deja `0x9A` (`0x1adc-0x1b01`) — te llevas la mitad de tu
  lado; string éxito 0x8e58.
- **default** (`0x1b28`): "Nothing to get!\n" (DS 0x8e64) — la adjudicación de
  decorados de cabos-353 (§7) queda intacta: el decorado no casa el barrido y el
  fallback lee el TERRENO que hay debajo.

## 4. getdir 0x35EC NO tiene diagonales (derivado aquí; mata un testigo falso)

`ULTIMA.EXE 0x35ec` (leído `0x35ec-0x368d`): el bucle de tecla sólo sale con los
códigos **1/2/3/4** (`0x3600-0x3616`) o ESC/Space (`0x363b-0x3643` → eco "Pass\n"
DS 0xa2a0, devuelve 0). Deltas: 1→`dec x` (West, 0x3675) · 2→`inc x` (East, 0x3683)
· 3→`dec y` (North, 0x3657) · 4→`inc y` (South, 0x3667). **No existe un Get
diagonal en 1988** — el tipado de 4 direcciones del port (`EntryDirection`) es fiel,
y fue `tsc` quien cazó el testigo diagonal que este carril había escrito de más.

## 5. Población (MEDIDA sobre `game/assets/maps/combatmaps.json`, 128 mapas)

- **24/128 con antorchas 0xB0/0xB1** — todos de territorio dungeon, registros:
  3(×8) 8 9 15 32 33 34 35 36 37(×2) 40(×2) 48(×2) 49(×2) 50(×2) 53 54 55 56 57
  60(×2) 63(×2) 89 90 111 (×4 salvo anotado). Confirma el «24 de los 128» del acta.
- **UN plato 0x9A**: dungeon registro 111, celda (8,5) — **inalcanzable**: sus 4
  vecinos cardinales son mesa impasable (0x92/0x90/0x94/0x96) y no hay getdir
  diagonal (§4). Cero 0x9B/0x9C/0x2D en los 128 mapas.
- **Ningún trigger** de sala siembra tiles de esta familia (censo de sprites de
  trigger: el único tile escribible relevante es 0x44 ×109).

## 6. Port (con citas simétricas)

`game/src/core/combat/combat.ts` `resolveBoardGet` (fallback tras el barrido de
cofre/pila, mismo orden que 0x193d→0x19c0): antorcha → `liveTiles[y][x]=0x44` (el
mismo búfer vivo que Jimmy 0x0e0e escribe en arena) + `state.torchTurns=0x64` +
"Borrowed!"; platos/trigo con el gate por delta y `food` cap 9999 + karma. El cue
`torch-borrowed` (GL 800→2000,1,50, ya en catálogo por el carril get-torch) se emite
en arena vía `sfxForCombatEvent` por texto — el glide `0x842e` es INCONDICIONAL en
la rama (el único gate es el repintado 0x9eca, §2). Tests:
`game/tests/get-torch-arena-375.test.ts` (17, esperados en crudo, estrenados en
rojo 10/16 sobre el código revertido; 7 mutantes muertos, punto fijo re-verificado).
El lado overworld de la MISMA rama ya estaba calcado en `game.get()` (game.ts,
carril get-torch, hallazgo #52 de sfx-catalog) — este carril NO lo toca.
