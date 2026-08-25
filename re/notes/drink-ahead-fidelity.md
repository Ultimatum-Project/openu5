# Drink de fuente en PASILLO de mazmorra — auditoría de fidelidad de eventos

**Origen**: un refactor anotó que `dungeonDrinkAhead` (game.ts) filtra solo eventos
`message|damage` de `drinkFountain`, descartando posibles cues `sfx` o eventos de
salida que la vía `dungeonCommand("drink")` sí traduce. ¿Hueco real?

**Veredicto corto**: **(B) matizado** — el FILTRO en sí no descarta nada HOY (el
original no teleporta ni sale por beber; ambas vías son equivalentes para el set de
eventos que `drinkFountain` puede emitir). Pero hay UNA divergencia real compartida
por LAS DOS vías: la rama "Bad taste." del original aplica el daño con el kernel
`0x2a52`, que **suena** (noise-burst del PC-speaker) y flashea el panel del miembro;
el `drinkFountain` del port no emite ningún `sfx`. Y el filtro de `dungeonDrinkAhead`
es una **trampa latente**: en cuanto se añada ese cue, la vía del Look lo tragaría.
Ticket mínimo abajo (§4), a ejecutar sobre el módulo nuevo `dungeon-cmds.ts` del
refactor aparcado.

## 1. Las dos vías del port (estado actual)

`drinkFountain` (`game/src/core/dungeon/dungeon.ts:880-906`) puede emitir EXACTAMENTE:

| rama | eventos |
|---|---|
| no-fuente | 1× `message` "No fountain here." (atajo QoL, sin equivalente ASM: el original ni pregunta fuera de fuente) |
| `sub=0` cure | 1× `message` "Cured!" |
| `sub=1` heal | 1× `message` "Healed!" + 1× `damage {amount:0, charIdx}` (SIN text; señal interna de refresh) |
| `sub=2` poison | 1× `message` "Poisoned!" |
| default (Bad taste) | 1× `message` "Bad taste." + 1× `damage {amount:rand(0,7), charIdx}` (SIN text, vía `applyDamage` dungeon.ts:1251) |

Es decir: **solo `message` y `damage`**. Jamás `sfx`, `exit-overworld`,
`exit-underworld`, `combat-room`, `moved`, `turned` ni `floor-changed`.

Los dos consumidores en `game/src/core/game.ts`:

- **`dungeonDrinkAhead`** (game.ts:5516-5526, resolución del prompt del Look):
  `if ((e.kind === "message" || e.kind === "damage") && e.text) push message`.
  Sin `advanceTurn` (el turno lo cobró el Look — fiel, kernel ret 1 por comando) y
  sin traducción de `sfx`/exits/`combat-room`. Cierra con `checkRefuge()` (sin
  `checkDoomRescue`, irrelevante: beber no mueve).
- **`dungeonCommand("drink")`** (game.ts:5584-5619, atajo QoL 'd'):
  `advanceTurn` + traducción completa: `message|damage` con text → message; `sfx` →
  `sfxEvent`; exits → `exitDungeonTo`; `combat-room` → `startDungeonRoomCombat`.

**Equivalencia HOY**: los eventos `damage` de `drinkFountain` no llevan `text`, así
que AMBAS vías los descartan igual (dungeonCommand también filtra por `e.text` en
message|damage). Para el set actual de eventos, las dos vías producen exactamente lo
mismo. La divergencia del filtro es puramente LATENTE.

## 2. Derivación ASM — DNGLOOK.OVL, rutina Look/fuente

Rebase de calls near de DNGLOOK: `true = (target + 0xA290) & 0xFFFF`
(load_seg·16 = 0xA290, `re/notes/dnglook-raster-spec.md:12`,
`re/notes/overlay-load-layout.md:44`). Strings DS → fichero DATA.OVL: delta +0x10
(verificado: DS 0x7700 "Will you drink?\n" está en DATA.OVL fichero 0x7710).

La ÚNICA vía del original para beber de fuente en pasillo es el (L)ook encarando la
fuente (no existe un (D)rink de pasillo aparte; el 'd' directo del port es QoL):

- `re/disasm/DNGLOOK.OVL.asm 0x012f-0x0142`: tile encarado `and 0xf0; cmp 0x50` →
  print DS 0x7700 "Will you drink?\n" (`call 0x75c0` → kernel 0x1850 print) y
  `jmp 0x1f0`.
- `0x01ea-0x01f8`: bucle getkey (`call 0xffff83dc` → kernel **0x266c**
  `getkey_with_redraw`, re/notes/kernel-sweep-3.md) que solo rompe con 'Y' (0x59)
  o 'N' (0x4e). ESC no decodificado.
- `0x01fa-0x0203`: 'N' → print DS 0x7712 "No.\n" y salir. (El port lo imprime en la
  piel, main.ts:924/1124 — cubierto.)
- `0x0206-0x020a`: 'Y' → print DS 0x7718 "Yes.  Gulp!\n" (piel, main.ts:921/1121 —
  cubierto, dos espacios verificados en DATA.OVL 0x7728).
- `0x020d-0x021f`: switch por el TILE COMPLETO (word, así 0x58-0x5B con bit lit caen
  al default — el port lo calca con el low-nibble, dungeon.ts:891):
  - `0x0222-0x0235` (tile 0x50): print DS 0x7726 "Cured!\n"; `[bx+0x55b3] = 0x47`
    ('G'). Sin sonido, sin kernel de daño.
  - `0x0238-0x024e` (0x51): print DS 0x772e "Healed!\n"; `hp = maxHp`
    (`[si+0x55ba] → [si+0x55b8]`, escritura directa). Sin sonido, sin kernel.
  - `0x0250-0x0263` (0x52): print DS 0x7738 "Poisoned!\n"; `[bx+0x55b3] = 0x50`
    ('P') INCONDICIONAL. Sin sonido.
  - `0x0266-0x027b` (default): print DS 0x7744 "Bad taste.\n"; `rand(0,7)`
    (`call 0x7e02` → kernel **0x2092** rand_range); daño vía `call 0xffff87c2` →
    kernel **0x2a52** apply_damage(charIdx, amount).
- `0x027e-0x0282`: epílogo y `ret`. **No hay NINGUNA otra llamada**: ni movimiento,
  ni cambio de planta, ni salida, ni teleport. El kernel devuelve 1 = turno.

### Kernel 0x2a52 (apply_damage) — lo que el port se calla

`re/disasm/ULTIMA.EXE.asm 0x2a52-0x2aa5`:

1. `0x2a56 call 0x2a28` — invierte/flashea la línea de estado del miembro.
2. `0x2a5c-0x2a68`: push 0xa, 0x640, 0x7d0 → **`call 0x223c` =
   `pcspeaker_noise_burst`** (re/notes/kernel-sweep-3.md §6) — el "blip" de daño.
3. `0x2a6b call 0x2a28` — des-flashea.
4. `0x2a74-0x2a8c`: `hp -= amount`; si ≤ 0 → hp=0, status `0x44` ('D').
5. `0x2a91-0x2a9b`: si el muerto era `g_active_char` → `g_active_char = 0xff`.
6. `0x2aa0 call 0x2900` — `kernel_status_redraw` (re/notes/kernel-sweep-2.md).

Es el MISMO kernel que el port ya cita (y sonoriza con `sfx "combat-damage"`) en la
vía de hazards/campos de pasillo (`dungeon.ts:1223-1224`, «kernel 0x2a52 @0x2a68»).

## 3. Respuestas a las preguntas del encargo

- **¿Emite sonido?** SÍ, pero SOLO en la rama "Bad taste." (vía kernel 0x2a52 →
  noise_burst 0x223c). Cure/Heal/Poison mutan los stats con escrituras directas y
  NO pasan por 0x2a52: sin sonido, fiel al silencio del port en esas ramas.
- **¿Puede mover/teleportar al jugador?** NO. La rutina 0x012f-0x0282 solo escribe
  status/hp e imprime; termina en ret. Eventos exit/moved son IMPOSIBLES en esta vía.
- **¿Solo mensaje+efecto?** Sí salvo lo anterior: mensaje + efecto + (solo en Bad
  taste) blip sonoro + flash de panel + muerte con limpieza de `g_active_char` +
  redraw de la línea de estado.

## 4. TICKET (fix mínimo, sobre el futuro `dungeon-cmds.ts` — NO implementado aquí)

1. **`drinkFountain`, rama default**: emitir `{ kind: "sfx", sfx: "combat-damage" }`
   inmediatamente tras el evento `damage` (cita: DNGLOOK 0x027b →
   kernel 0x2a52 @0x2a68 → noise_burst 0x223c(0x7d0,0x640,0xa); mismo cue que ya usa
   la vía de hazards, dungeon.ts:1224). Solo esa rama: Cure/Heal/Poison son mudas en
   el ASM.
2. **`dungeonDrinkAhead`**: sustituir el filtro local `message|damage` por el MISMO
   traductor de eventos que usa `dungeonCommand` (message/damage-con-text → message;
   sfx → sfxEvent; exits/combat-room por completitud defensiva aunque hoy sean
   inalcanzables desde drinkFountain). Sin esto, el cue del punto 1 sonaría por la
   vía 'd' QoL pero NO por la vía fiel del Look — al revés de lo deseable.
3. **Observación colateral (fuera de alcance, mismo kernel)**: el `applyDamage` del
   port (dungeon.ts:1251-1260) marca 'D' pero NO limpia `activeCharacter` cuando el
   muerto era el activo (ASM 0x2a91-0x2a9b `g_active_char = 0xff`). Afecta también a
   la vía de hazards que comparte el helper. Merece ticket propio si no está cubierto
   en otro sitio. El flash 0x2a28 y el redraw 0x2900 son presentación (carril piel /
   audio-costuras).

## 5. CIERRE (carril fix-badtaste, 20-08-2026) — el guión 0x2a52 ENTERO por el bus

Estado al abrir el carril: §4.1 y §4.2 EJECUTADOS (el cue sonaba por las dos vías,
traductor unificado en `dungeon-cmds.ts::translateDungeonEvents`) y el colateral
§4.3 también cubierto (`applyDamage` limpia `activeCharacter`, dungeon.ts). Pero el
mecanismo de §4.1 (sfx pelado) quedó SUPERADO por #328: `kernel_apply_damage`
0x2a52 es daño Y presentación — flash XOR de la fila del roster (0x2a28 @0x2a59,
des-flash @0x2a6e) ANTES Y DESPUÉS del blip 0x223c — y el sfx suelto entregaba el
audio sin el flash. #328 dejó el bus exacto para ese guión: evento core
`damage-script {slots}` → traductor → `poison-tick` (#213) → paceador `PoisonTick`
(flash `setDamageFlash` + cue `combat-damage` por slot, espaciado `POISON_BLIP_MS`).

Re-derivación con la disciplina cross-overlay de #328 (`re/tools/dispatch_table.py
overlay_near_call_base`, control positivo del corpus CMDS 0x7B9C → 0x3B1C
reproducido ANTES): DNGLOOK base near-call 0xA290 (nreloc=0, load_seg 0xA29);
0x87C2→0x2A52 apply_damage · 0x75C0→0x1850 print · 0x7E02→0x2092 rand_range ·
0x83DC→0x266C getkey — las cuatro coinciden con la aritmética del §2. El slot que
0x027b pasa al kernel es `push [bp-0xc]` (0x026d) = el MISMO índice de miembro del
resto del switch. "Bad taste.\n" verificado en DATA.OVL fileoff 0x7754 (DS 0x7744).

Fix: `drinkFountain` rama default emite `{kind:"damage-script", slots:[idx]}` EN
LUGAR del sfx (el bus emite el cue él mismo — mantener ambos duplicaría el blip).
Cure/Heal/Poison siguen sin sfx NI damage-script (0x0222/0x0238/0x0250: escrituras
directas, jamás 0x2a52). Tests estrenados en rojo (dungeon-dispatch.test.ts:
esperado EN CRUDO `["message","damage","damage-script"]` + `slots:[0]`; vía Look =
vía 'd' incluido el poison-tick) y DOS mutantes muertos sobre base commiteada
(volver al sfx pelado · slot+1). Paridad intacta (test_dungeon_parity 27 passed:
fountain-bad-taste diffea estado/semilla/mensajes, no kinds).
