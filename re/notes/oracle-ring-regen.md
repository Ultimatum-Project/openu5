# kernel_ring_regen (0x400c) — VERIFICACIÓN (task #21)

> Verifica la hipótesis que destapó el barrido total (`re/notes/kernel-sweep-4.md §3`):
> `0x400c` era el único consumidor de RNG de GAMEPLAY por turno con etiqueta sin
> confirmar ("ring_regen" era una conjetura; `[0x55c5]==0x2c` se leyó como un "status
> secundario" `','` en el sweep-4 y como glyph de sleep en el flash-probe). **Este
> documento la CONFIRMA por derivación estática triple-cruzada: `0x400c` ES la
> regeneración del Ring of Regeneration.** El clon YA lo porta y es FIEL.

## TL;DR — VEREDICTO

- **`0x400c` = regeneración de HP del Ring of Regeneration.** Una vez por turno,
  para cada miembro **no muerto** que lleve equipado el anillo **0x2c** (item id 44),
  rola `rand(0,7)` y con `==7` (1/8) hace **`HP = min(HP+1, MaxHP)`**.
- **La etiqueta "ring_regen" es CORRECTA.** `[0x55c5+i*0x20]` **NO** es un "status
  secundario": es el **slot de ANILLO** del record de personaje (record + 0x1D). El
  valor `0x2c` es el **item-id del anillo equipado**, no un glyph ASCII `','`.
- **`0x3f14` = `add_with_cap(ptr, delta, cap)`** → `*ptr = min(*ptr+delta, cap)`; en
  `0x400c` se invoca con `ptr=&HP`, `delta=1`, `cap=MaxHP`. Es un `+1 HP` con techo.
- **Orden en el turno:** es el **ÚLTIMO** paso de `kernel_turn_housekeeping`
  (`0x2ae8`), tras veneno → comida/hambre → contador de turno → tick del time-spell.
- **El clon `game/src/core/world/survival.ts:219-227` lo implementa EXACTO** y está
  **cableado** al bucle de turno vivo con el stream de RNG real. **CERO divergencia.**
- **Runtime NO ejecutado a propósito:** había un **dosbox-x ajeno = la sesión de
  juego EN VIVO del usuario** (`original/u5/play`, alias `ult`). El mandato prohíbe
  matarlo o arrancar un emulador que compita (confound del pty freewheel). La
  derivación estática es concluyente por triple cruce, así que runtime no es
  necesario para el veredicto (a diferencia de un consumidor de RNG de CADENCIA
  temporal como el flash render #17, aquí el efecto es determinista por turno).

## 1. El helper `0x3f14` = add_with_cap (HP += 1 con techo MaxHP)

```
3f14: push bp; mov bp,sp
3f17: mov bx,[bp+8]        ; bx = ptr           (arg #3, último push)
3f1a: mov ax,[bx]          ; ax = *ptr
3f1c: add ax,[bp+6]        ; ax = *ptr + delta  (arg #2)
3f1f: cmp ax,[bp+4]        ; cmp con cap        (arg #1, primer push)
3f22: jge 0x3f2c           ; si *ptr+delta >= cap → clamp
3f24: mov ax,[bp+6]; add [bx],ax ; else *ptr += delta
3f2c: mov ax,[bp+4]; mov [bx],ax ; then  *ptr  = cap
3f32: ret 6
```
→ `*ptr = min(*ptr + delta, cap)`. Nombre del ledger `kernel_counter_add_i16` correcto.

## 2. `0x400c` instrucción a instrucción

```
400c: push bp; mov bp,sp; sub sp,0xa; push di; push si
4014: mov [bp-2],0                 ; i = 0
4019: al=[g_party_size]; or ax,ax; je 0x407a   ; party vacío → fin
4022: mov si,0x55b3                 ; si = &status[0]   (record +0x0B)
4025: mov di,0x55c5                 ; di = &ring[0]     (record +0x1D)
4028: mov [bp-8],0x55b8             ; = &HP[0]          (record +0x10)
402d: mov [bp-0xa],0x55ba           ; = &MaxHP[0]       (record +0x12)
; --- loop @4032, por miembro ---
4032: cmp byte [si],0x44; je 0x405f ; status=='D'(muerto) → skip
4037: cmp byte [di],0x2c; jne 0x405f; ring != 0x2c        → skip
403c: push 0; push 7; call 0x2092   ; rand_range(0,7)   ← RAND consumido
4046: cmp ax,7; jne 0x405f          ; sólo ==7 (1/8) surte efecto
404b: push [bp-8]                   ; ptr = &HP[i]       (arg #3)
404e: push 1                        ; delta = 1          (arg #2)
4052: mov bx,[bp-0xa]; push [bx]    ; cap = MaxHP[i]     (arg #1)
4057: call 0x3f14                   ; HP[i] = min(HP[i]+1, MaxHP[i])
405a: mov byte [g_unk_a9fa],1       ; flag "hay que redibujar zstats"
405f: add si,0x20; add di,0x20; add [bp-8],0x20; add [bp-0xa],0x20
406d: inc [bp-2]; cmp con g_party_size; jb 0x4032
407a: ret
```

**Clave — el RAND se consume por CADA miembro que califica (no muerto ∧ ring==0x2c),
INCONDICIONAL de su HP.** El `cmp ax,7` y el techo de `0x3f14` gatean el EFECTO, no el
ROLL. → rands/turno = |{miembros no-'D' con ring==0x2c}|.

**`0x400c` IGNORA su argumento `[bp+4]`** (el índice que le pasa el caller de combate):
siempre recorre TODO el party. Es un barrido de party, no un "regen del miembro N".

## 3. `[0x55c5]` es el slot de ANILLO — no un glyph de status (triple cruce)

Roster DS base = **0x55A6** (`re/verified/zstats.md:66`, fileoff 0x55B6). Record de
personaje = roster + `CHAR_BASE`(0x02) = **0x55A8**; stride `0x20`. Campos:

| campo | offset record | abs (miembro 0) | prueba |
|---|---|---|---|
| status letra | +0x0B | 0x55B3 | `re/tools/parity.py:107`; kernel `si` en 0x4022 |
| **HP** (u16) | +0x10 | **0x55B8** | `parity.py:108`; **cross:** `0x2a52` (daño) hace `[si+0x55b8]-=dmg`, muerte si ≤0 |
| **MaxHP** (u16) | +0x12 | **0x55BA** | `parity.py:109`; el `cap` de `0x3f14` |
| weapon-hand | +0x1B | 0x55C3 | `re/verified/zstats.md:32-33` |
| shield-hand | +0x1C | 0x55C4 | idem |
| **RING** | **+0x1D** | **0x55C5** | `parity.py:110 CHAR_RING`; **slot contiguo** tras weapon/shield |
| amulet | +0x1E | 0x55C6 | `game/src/core/equip.ts:8-12` (slots +0x19..+0x1e) |

Las tres pruebas independientes de que 0x55C5 = slot de anillo:
1. **`parity.py:110`** lo mapea `CHAR_RING = 0x1D`.
2. **`re/verified/zstats.md:30-37`**: la tabla de TIPOS (DATA.OVL DS 0x1a7e) da
   `0x02 = ring`; el equip escribe el item-id en el slot de anillo; y el
   **"Ring vanishes!"** (`0x0e01`) actúa **exactamente sobre items 0x2a/0x2c** →
   0x2a y 0x2c SON los dos item-ids de anillo equipables.
3. **Contigüidad de slots**: weapon(+0x1B), shield(+0x1C), **ring(+0x1D)**,
   amulet(+0x1E) — layout de equipo, no un campo de estado transitorio.

⇒ **0x2c es el Ring of Regeneration por DEFINICIÓN de lo que `0x400c` hace** (regenera
HP a quien lo lleva). El otro anillo, 0x2a, es el otro tipo (ver §5). El
`ULTIMA.EXE` no escribe 0x55C5: sólo lo LEE (regen 0x400c, status-tick 0x6794, flash
0x6936). El ESCRITOR es el comando (R)eady en `ZSTATS.OVL` (`0x0e2d` init a 0xff = sin
anillo; el equip pone el item-id).

## 4. Orden en el turno — `kernel_turn_housekeeping` (0x2ae8)

`0x400c` se llama **una vez por turno** al final de `0x2ae8` (ledger:
`kernel_turn_housekeeping`, confirmado `+1/turno` en vivo por el turn-counter 0x588b).
Secuencia de la función:

1. **Veneno** (bucle party 0x2b0b): por miembro `'P'` → `apply_damage(i, 1)` (0x2a52).
   Daño FIJO 1, **sin rand**. `'D'`/`'S'` no sufren ni cuentan como comensal.
2. **Bloque horario** (sólo si `g_hour != g_prev_hour`, 0x2b5d):
   - `g_food==0` → imprime "Starving!" (str 0x54c8) + `party_random_damage` (0x2aa8):
     **`rand(1,8)` de daño por miembro vivo → 1 RAND (0x2092)** antes del regen.
   - si no, a las horas 6/12/18 → `food -= comensales` (0x3f54, sin rand).
3. `g_prev_hour = g_hour` (0x2b99).
4. `turn_count++` sat 0xFF (0x2b9f, `0x588b`).
5. Tick del time-spell Q/T (0x2bae-0x2bc2): decrementa `g_time_spell_turns`.
6. **`call 0x400c` — RING REGEN (0x2bca), el último paso.**

⇒ Orden de rands del turno: **[hambre `rand(1,8)`×vivos si starving-y-cambió-hora]
ANTES de [regen `rand(0,7)` por miembro con ring 0x2c].** Ambos del mismo seed
(`g_rng_seed@0x5420`).

**Segundo call-site (COMBAT):** `0x6794 actor_status_effect_tick` (llamado desde
0x6b6b, por actor de combate) llama `0x400c` cuando el personaje que controla al actor
lleva ring 0x2c (0x67ee). Como 0x400c barre TODO el party, en combate puede dispararse
varias veces por tick de actor. Modelado de combate = COMBAT.OVL (fuera del alcance de
este turno; anotar para la paridad de combate).

## 5. El otro anillo (0x2a) y el flash de render — NO es este consumidor

`[0x55c5]==0x2a` (el otro anillo) tiene efectos propios, ajenos al regen:
- **status-tick 0x6794** (0x67bf): ring 0x2a → escribe tile `0x1d` en el tile del actor
  (0x5c5b) + `flag|=0x10`.
- **flash 0x6936** (0x69f0/0x6a02): tanto 0x2a COMO 0x2c hacen **parpadear** el sprite
  del miembro y rolan `rand(0,15)` (0x6a1a), con `==0xb` → un beep. **Ése es un
  consumidor de RNG de RENDER (task #17, el clon lo OMITE, Clase 3), NO el de gameplay.**
  Es decir: llevar el Ring of Regeneration además hace titilar al miembro y consume un
  rand de la órbita de redibujo — irrelevante para el regen, catalogado en #17.

## 6. El clon YA lo porta — FIEL, cero divergencia

`game/src/core/world/survival.ts:219-227` (`turnHousekeeping`):
```ts
for (let i = 0; i < state.partySize && i < 6; i++) {
  const ch = state.characters[i];
  if (!ch || ch.status === "D") continue;          // ✓ skip 'D' (0x4032)
  if (ch.ring !== RING_OF_REGENERATION) continue;  // ✓ RING_OF_REGENERATION=44=0x2c (0x4037)
  if (rand(0, 7) === 7) {                           // ✓ rand(0,7)==7, 1/8 (0x403c/0x4046)
    ch.currentHp = Math.min(ch.currentHp + 1, ch.maxHp); // ✓ +1 cap MaxHP (0x3f14)
  }
}
```
Coincidencia byte-a-byte con la spec derivada, incluyendo:
- El roll se consume **por cada miembro que califica, incondicional del HP** (el `if
  (rand...)` va antes del efecto, igual que el asm) → misma cuenta de rands por turno.
- **Orden correcto**: es el último bloque de `turnHousekeeping`, tras el veneno y el
  `partyRandomDamage` del hambre (survival.ts:193/201), con el MISMO `rand` inyectado.
- **Cableado vivo**: `turnHousekeeping(state, rand)` se llama en el bucle de turno real
  (`world/loops/turn.ts:167` y `:281`, `world/movement.ts:129`) con el stream de RNG del
  juego.
- **Equip**: `equip.ts` (`slotForEquip` → "ring", `setSlot(char,"ring",id)`) pone
  `ch.ring = 44` al hacer (R)eady del anillo 0x2c. El campo persiste (es equipo, sólo lo
  cambian Ready y el "Ring vanishes!" 1/16).

Divergencia respecto a #21: **NINGUNA**. El "no modelado" de la conclusión del barrido
era del ledger del kernel (0x400c aún sin verificar), no del clon: `survival.ts` ya lo
tenía portado desde Task 3.1. Esta verificación cierra el hueco del ledger.

## 7. Spec para la fase SDD (si hiciera falta re-portar)

```
por-turno, dentro de turnHousekeeping, DESPUÉS de veneno + hambre/comida + turn++ +
tick time-spell, como ÚLTIMO paso:
  para i en 0..partySize-1:
    if char[i].status == 'D': continue        # muerto no regenera
    if char[i].ring != 0x2C:  continue        # 0x2C = Ring of Regeneration (id 44)
    r = rand_range(0, 7)                       # SIEMPRE se consume si califica
    if r == 7:                                 # 1/8
        char[i].hp = min(char[i].hp + 1, char[i].maxHp)
```
RNG = mismo stream que hambre/mundo (`g_rng_seed@0x5420`, `rand_range` kernel 0x2092).
Notas de paridad: (a) el rand se consume aunque HP ya esté al máximo; (b) rands/turno =
nº de miembros vivos con el anillo; (c) NO hay barrido de combate en este path (ése es
el 2º call-site 0x6794, competencia de COMBAT.OVL).
</content>
</invoke>
