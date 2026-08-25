# Gate de (C)ast en combate — `COMBAT.OVL:0x08F0` · bit 0x80 = miembro de party

Cierra **#68** (semántica del bit 0x80 del actor, "Can't!") y adjudica la **rama-b de #44**
(por qué teclear `c,i,v,p,y` no casteaba en las 6 iteraciones de captura previas).
Fuente: `re/disasm/COMBAT.OVL.asm` + testigo de RAM del oráculo (headless propio, 2026-07-18).

## 1. Los tres gates PRE-getstring (asm, `0x08F0`–`0x0964`)

El handler de (C)ast en combate corre ANTES del getstring rúnico (`CAST2:0x00DE`). Orden:

```
08f0: mov ax,0x6df6 ; push ; call 0x75c0     ; eco del comando
08f7: mov word [bp-2], 1                       ; result = 1 (fallo por defecto)
08fc: mov al,[g_cmb_actor] ; si=ax
0903: bx=si ; shl bx,3                          ; bx = actorSlot*8
0909: test byte [bx-0x45ea], 0x80              ; *** bit 0x80 del registro +0 del actor activo
                                               ;     ([bx-0x45ea] = actorSlot*8 + 0xba16)
090e: je 0x0964                                 ; bit 0x80 CLARO -> "Can't!"
0910: push si ; call 0xffffdb52 ; or ax,ax
0916: je 0x091b ; else jmp 0x7ba               ; sub-check: aborta el turno si ax!=0
091b: g_cmb_is_magic=g_cmb_is_spell=1 ; [bp-2]=0
0928: cmp [g_time_spell],0x4e ; je 0x093d       ; negate-magic (In An 'N') -> Absorbed
092f: cmp [g_crown],0 ; jne 0x95e
0936: cmp [g_unk_5894],0x12 ; jne 0x95e         ; Blackthorn (loc 0x12) SIN corona -> Absorbed
093d: ...call 0x7f02 (caja) DS 0x6e00 "Absorbed!\n" ; -> 0x7ba (turno consumido, NO castea)
095e: call 0xffffdbca                           ; GETSTRING rúnico (cast procede) -> despacho
0964: mov ax,0x6e0c ; jmp 0x9e5                 ; DS 0x6e0c "Can't!\n" ; -> 0x7ba (turno consumido)
```

Registro de combate: tabla `0xba16`, stride 8 (`combat-spells.md:94`); byte +0 = tile/flag.
`[bx-0x45ea]` = `actorSlot*8 + 0xba16` (`0x10000-0x45ea = 0xba16`).

Tres formas de consumir el turno SIN castear:
- **(a) bit 0x80 claro** (`0x090e`) → `"Can't!\n"` (DS `0x6e0c`).
- **(b) Absorbed** (`0x0928`/`0x0936`) → `"Absorbed!\n"` (DS `0x6e00`) — negate-magic o Blackthorn
  sin corona. Ya modelado en el port (`combat.ts` `combatCastAbsorbed`).
- **(c) sub-check** `0x0910 call 0xffffdb52; or ax,ax; jnz 0x7ba`.

## 2. Semántica del bit 0x80 — TESTIGO DE RAM (cierra #68)

El port declaraba la deuda explícitamente (`game/src/core/combat/combat.ts:254-255`):
> "NO cubre el gate 'Can't!\n' (DS 0x6e0c, bit 0x80 del registro de actor en 0x08F0 @0x090e):
> la semántica exacta de ese bit queda pendiente de derivar."

Volcado del registro de combate en vivo (oráculo, escena de combate real, `0xba16` stride 8):

```
PRE  actorSlot=0 rec0=0x80 bit80=True qty30=9
records (byte +0): slot0 PJ=0x80 · slot1 PJ=0x80 · slot2 PJ=0x80 · slots6-11 enemigo=0x40
```

⇒ **bit 0x80 del registro +0 = combatiente de la PARTY (PJ); bit 0x40 = enemigo.** El gate
`0x0909` bloquea con `"Can't!"` el (C)ast de cualquier actor activo que NO sea party
(enemigo/invocado/encantado ocupando el slot activo). Semántica derivada del asm y
CONFIRMADA por lectura de RAM. **#68 cerrado.**

## 3. Adjudicación de la rama-b de #44 — NO era el gate ni la fidelidad del lote 1

En la escena reproducida el actor activo (slot 0) ES party (`bit80=True`) → el gate "Can't!"
NO dispara. Las 6 iteraciones previas fallaban (`[QUAKE?]=NINGUNO`, §9.4) por un **bug de
tecla del arnés**, no por el port:

- `re/tools/combat_parity.py:299` (`cast_spell_at_turn`) hacía `send_key("RETURN")`, pero el
  oráculo no tiene scancode `"RETURN"` (Enter = `"\n"` = 0x1c, `oracle.py` `SCANCODES`).
  El submit del getstring nunca llegaba → el hechizo no se enviaba. (Arreglado por el lead
  en main, commit `1ac9849`: `'RETURN'`→`'\n'`.)

Con la tecla Enter correcta el cast DISPARA:

```
POST-ENTER qty30=8  fired=True   (In Vas Por Ylem, idx 30: g_spell_qty 9 -> 8)
```

⇒ **Hipótesis (ii) [fidelidad del lote-1 del port] RECHAZADA. Causa = hipótesis (i), bug de
tecla del arnés.** El flujo `c`→getstring rúnico del port NO está implicado.

## 4. Estado de #44 [EMPÍRICO]

`[STATIC]` (asm §3) + `[EMPÍRICO-REPLAY]` (smoke) ya estaban. Novedad en vivo:
- **Disparo del cast CONFIRMADO EN VIVO**: `g_spell_qty[30]` decrementa 9→8 al teclear
  `c,i,v,p,y,Enter` (Enter válido `"\n"`). Robusto: reproducido en v2, v3 y v4. Esto es lo
  que exculpa al port (rama-b = bug de tecla, no fidelidad del lote 1).
- **Secuencia de rolls `(0,60)→(1,20)` NO capturada aún.** v4 (BP en `RAND_RANGE 0x2092` +
  inyección de teclas por el bucle de resume) dio `fired=True` pero **0 rolls**; v3 (300
  ticks) dio HP enemiga sin cambio (campo poco fiable, ver caveat §5). DOS lecturas, sin
  concluir: (a) la escena sembrada de 1 enemigo no presentó target válido a la puerta de
  targetabilidad del terremoto (`0x091e` → `call kernel 0x5646`), o (b) artefacto de timing
  del bucle (la inyección de teclas compite con la captura de rolls). **NO se concluye que el
  terremoto no dañe** — el orden de tiradas sigue `[STATIC]`+`[EMPÍRICO-REPLAY]`; falta una
  iteración con escena de varios enemigos vivos confirmados para sellar `[EMPÍRICO]` la
  secuencia. Trabajo abierto del carril de captura (v5).

## 5. Caveat del arnés de lectura (para futuros probes)

`combat_parity.parse_records()["hp"]` (byte +0 del registro `0xBA14`, stride 8) **NO es el HP
vivo**: en las capturas los 3 PJs leen `hp=0` estando vivos ⇒ es una copia estática/de-spawn.
Para daño en vivo usar el HP del roster (`0x55B8`, `read_roster_combat`) o el BP de tiradas,
no este campo. (El byte que SÍ es fiable de ese registro es +2 = flags: 0x80 party / 0x40
enemigo — el que gatea el "Can't!", §2.)

## Evidencia

Probes (scratchpad del carril, oráculo headless propio, run-dir
`/private/tmp/<oracle-rundir>-batch-446857`, jamás `original/u5/play`):
- `probe_combat_cast_gate.py` (v1): PRE-cast dump → bit 0x80 = party (0x80 PJ / 0x40 enemigo).
- `probe_combat_cast_v2.py` (Enter correcto): `POST-ENTER qty30=8 fired=True`.
- `probe_combat_cast_v3.py` (300 ticks): `fired=True, damage_landed=False` (campo HP no fiable).
- `probe_combat_cast_v4_rolls.py` (BP RAND_RANGE): `fired=True`, `ROLLS(0)`.
