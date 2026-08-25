# Auditoría video-N — puerta secreta, dungeon ROOMS, combate de sala, escape (Task #50)

Ground truth: `original/av-referencia/video-N-dungeon-secreta-escalera-dragones.mov`
+ frames 1fps `original/av-referencia/video-N-frames/f001..f079.png`. Strings
byte-exactos de `original/u5/ultima5/DATA.OVL` (offsets abajo). Autoridad = asm
(FIDELITY-CONTRACT): calco bug-for-bug, cero fabricación.

## Veredicto de alcance

**Las dungeon ROOMS EXISTEN en el port de punta a punta** — NO es feature grande.
El pipeline ya está: tile `Room` (hi 0xA/0xF) en `onEnterCell`
(`game/src/core/dungeon/dungeon.ts:394`) emite `combat-room` con
`roomCombatMapIndex()`; `game.ts:4150` lo enruta a `startDungeonRoomCombat`
(`game.ts:4187`), que abre un `Combat` con `enemies:{fixedFromMap:true}` leyendo
el mapa `.CBT`. Los **112 mapas de sala** están en
`game/src/core/data/CombatMaps.json` → `Dungeon[]` (16 salas × 7 mazmorras sin
Despise), aplanados en `/assets/maps/combatmaps.json` (16 Britannia + 112 Dungeon
= 128), indexados por `roomCombatMapIndex = 16 + orden·16 + room`. La vista
top-down (ladrillo rojo, gárgolas fijas, escaleras, banda de agua del frame f050)
se pinta con la arena de combate real (mapa `.CBT`). Los enemigos fijos, los
turnos por combatiente, "killed!" y " escapes!" ya funcionan.

Por tanto los gaps son **strings byte-exactos + comportamiento de detalle**, no
una vista nueva. Divididos en: (A) minor en mi carril (dungeon-core) → aplicables
directos; (B) cross-domain (combate / comando Enter) → coordinar; (C) handler
`search_dungeon` completo → estructural, plan + aprobación.

## Offsets DATA.OVL (ultima5/DATA.OVL) de las strings del vídeo
| off | string |
|-----|--------|
| 0x2a7f | `Enter ` (prefijo del comando Enter) |
| 0x2ac7 | `dungeon` (label → "Enter dungeon") |
| 0x2c68 | `Entering room...` |
| 0x86ef / 0x8704 / 0x8dde | `You find:` |
| 0x890e | `A hidden door!` |
| 0x8722 | `Nothing hidden on the ladder.` |
| 0x8774 | `Nothing hidden on the fountain.` |
| 0x885e / 0x891e | `Nothing hidden on the door.` |
| 0x887c | `Nothing hidden on the wall.` |
| 0x889a | `Nothing in the caved in passage.` |
| 0x88bc | `Nothing on the stalactite.` |
| 0x88d8 | `Nothing hidden on the skeleton.` |
| 0x88fa | `It crumbles away.` |
| 0x6db4 | `, armed with ` (banner de turno) |
| 0x6dc2 | `bare hands` |
| 0x8ebe | `Escape!` |
| 0x6eff | `BATTLE IS LOST!` |
| (n/a) | `VICTORY!` (mayúsculas) |

## Secuencia por secuencia (port HOY vs ORIGINAL)

### 1. Banner de entrada de mazmorra (f010) — GAP cross-domain (B)
Original: tras el yell, pisar la entrada imprime `Enter dungeon` (echo del comando
Enter, `game.ts:3628` ENTER_LINES ya correcto) y **debajo el nombre de la mazmorra
centrado**: `    DECEIT`. No hay más líneas antes de la vista first-person.
Port: `enterDungeon()` añade además `Thou dost descend into ${dungeon.name}...`
(`game.ts:4100`) — **string FABRICADA, no existe en DATA.OVL**. Y el nombre
centrado de la localización NO se imprime (el comentario de `loadSmallMap`
`game.ts:3655` dice que el original no imprime el nombre del pueblo — pero para
MAZMORRA el frame f010 muestra `DECEIT` centrado).
Fix propuesto: retirar la línea `Thou dost descend into...` y emitir el nombre de
la mazmorra centrado. **Cruza con el comando Enter** (`enter-command-implementer`):
hay que derivar del asm si el print del nombre centrado es específico de mazmorra o
compartido con towns (posible regresión en towns). → coordinar antes de tocar.

### 2. SEARCH first-person → puerta oculta (f025-f035) — GAP (A minor + C estructural)
Original (f030): `>Advance ×3 → Blocked!`; luego `>Search... / Dir-Ahead / You
find: / A hidden door!` y la PUERTA aparece renderizada en la pared de delante.
- `Blocked!` ✓ (`dungeon.ts:230`).
- El render de la puerta revelada ✓: `skin/fiel/dungeon.ts:190` pinta
  `SecretDoor` revelado como puerta (STRIP_END). No requiere trabajo.
- Search: `search_dungeon` (SJOG 0x0646, `re/notes/cmds.md §11`) es **DIRECCIONAL**
  (celda party+dir; aquí = Ahead) y siempre imprime `You find:` + o bien
  `A hidden door!` (reveal) o `Nothing hidden on the <objeto>.` según el tile.
- Port (`dungeon.ts:292`): escanea los **4 vecinos** (no direccional), revela
  `SecretDoor` con `A hidden door!` (sin prefijo `You find:`) y en el no-find
  imprime `Naught here.` — **string FABRICADA**.
- Además `search_dungeon` completo consume `rand(1,30)` (detección de trampa,
  threshold `(floor·2−DEX+0x1E)>>1`), revela alijo 0x62, `0x61→0x60`, y el crumble
  del muro especial 0xC (`It crumbles away.`). **No portado** (documentado
  ⚠️→formulado en `re/verified/dungeon.md §8`; el port usa `DungeonState`).
Fix minor (A): direccional-ahead + prefijo `You find:` + `Nothing hidden on the
<objeto>.` por tile. Fix estructural (C): portar `search_dungeon` con su `rand`
(afecta el stream) — requiere escenario de paridad + aprobación.

### 3. Klimb-Down → "Entering room..." → sala top-down (f045-f055) — GAP (A minor) ✅ APLICADO
Original (f050): `>Klimb-Down!` (echo) → `Entering room...` → cambia a vista
top-down de sala. Port emitía `The room is guarded!` (`game.ts:4210`) — **string
FABRICADA**. `startDungeonRoomCombat` es el único emisor.
Fix: `The room is guarded!` → `Entering room...` (0x2c68). Byte-exacto, sin tests
que lo referencien. APLICADO en esta rama.

### 4. Combate de sala — turnos por combatiente (f060-f075) — GAP cross-domain (B)
Original: cada turno de PJ imprime `<name>, armed with <weapon>:` (0x6db4
`, armed with ` + tabla de nombres de equipo COMBAT 0x17F6/0x1806;
`re/notes/combat.md §9`) y debajo la acción (`>East`, `>Klimb-Up!`…). `Gorn
killed!` ✓ (`combat.ts:884`). ` escapes!` ✓ (`combat.ts:1517`).
Port: **NO** renderiza el banner `, armed with `. No existe en `game/src`.
→ Presentación de combate (dominio task #28 / `combat.ts` + `skin/fiel/combat.ts`).
Coordinar; el banner requiere el arma equipada del combatiente activo.

### 5. Escape de sala → "Escape!" → "BATTLE IS LOST!" (f070-f078) — GAP cross-domain (B)
Original (f075): un PJ hace `>Klimb-Up!` sobre escalera de la sala → `Escape!`
(0x8ebe); cuando el combate termina por huida → `BATTLE IS LOST!` (0x6eff) y vuelta
a first-person un nivel arriba. Derivación: `combat.md §86` (0cca-0ce6) — al cerrar
turno con `enemigos==0` llama `SJOG:0x21CE`; si devuelve −1 → `BATTLE IS LOST!` y
sale. La huida en sala se hace por **Klimb** sobre escalera del mapa de sala.
Port: `playerEscape` sale por el **borde** del mapa y emite `${name} flees the
battle!` (`combat.ts:1215`) — **string FABRICADA**; y al cerrar emite
`Defeat!`/`The battle is over.` (`combat.ts:529/4230`), nunca `BATTLE IS LOST!`.
También `Victory!` debería ser `VICTORY!` (mayúsculas).
→ Dominio combate. Coordinar: (a) `Escape!` en vez de `flees the battle!`,
(b) `BATTLE IS LOST!` como resultado de huida, (c) Klimb como vía de escape en
sala de mazmorra, (d) `VICTORY!` mayúsculas.

## Tabla resumen de gaps

| # | Secuencia | Port hoy | Original | Clase | Dueño |
|---|-----------|----------|----------|-------|-------|
| 1 | Banner entrada | `Thou dost descend into X...` | `Enter dungeon` + `DECEIT` centrado | B | enter-command + yo |
| 2a | Search msg | `Naught here.` | `You find:` + `Nothing hidden on the <X>.` | A | yo |
| 2b | Search dir | 4 vecinos | Dir-Ahead (party+dir) | A | yo |
| 2c | search_dungeon | no portado | rand(1,30)+threshold+crumble+alijo | C | yo (plan) |
| 3 | Entrada sala | `The room is guarded!` | `Entering room...` | A ✅ | yo |
| 4 | Banner turno | (ausente) | `<name>, armed with <weapon>:` | B | combate |
| 5a | Escape sala | `flees the battle!` | `Escape!` | B | combate |
| 5b | Fin por huida | `Defeat!` | `BATTLE IS LOST!` | B | combate |
| 5c | Vía de escape | borde | Klimb sobre escalera de sala | B | combate |
| 5d | Victoria | `Victory!` | `VICTORY!` | B | combate |

## Plan por etapas (para aprobación del lead)

- **E0 (aplicado)**: #3 `Entering room...` (byte-exacto, cero riesgo).
- **E1 (minor, mi carril, pido OK)**: #2a/#2b — search direccional-ahead + `You
  find:` + `Nothing hidden on the <objeto>.`. Sin `rand` (mantiene la divergencia
  de alcance actual del search del port). Tests de `dungeon.ts` a actualizar.
- **E2 (cross-domain, coordinar)**: #1 banner de entrada — derivar del asm el print
  del nombre centrado (¿mazmorra-only o compartido con towns?) con
  `enter-command-implementer`.
- **E3 (cross-domain, coordinar con combate)**: #4 banner `armed with`, #5a-d
  `Escape!`/`BATTLE IS LOST!`/Klimb-escape/`VICTORY!`. Task #28 está "done" pero con
  estos gaps; requiere no debilitar la paridad de combate.
- **E4 (estructural, plan + aprobación)**: #2c `search_dungeon` completo (rand +
  threshold + crumble 0xC + alijo). Afecta el stream vivo → escenario de paridad.

---

## Estado de implementación (2026-07-15)

- **E0** ✅ `Entering room...` (aterrizado en main aeb3136→4d3218e).
- **E1** ✅ Search direccional (Ahead) + `You find:` + `Nothing hidden on the <X>.`
  (07aa4cb→landed). Ramas con rand (cofre/foso) + crumble 0xC → E4.
- **E3a** ✅ `VICTORY!` / `BATTLE IS LOST!` / `Escape!` byte-exactos (7255405→landed).
- **E3b** ✅ banner de turno `<nombre>, armed with <arma>:` desde el driver de
  combate (main.ts; NO toca combat.ts/paridad) (24a2f3f→landed). Verificado en
  navegador (puerto propio 5197/5233).
- **fix e2e** ✅ `playwright.config` default a puerto propio 5197 + reuse sólo con
  `U5_E2E_PORT` explícito (fe3e129). Evita testear contra el server 5199 del usuario.

### E3c — Klimb-escape de sala de mazmorra → PLAN (balloonea, cross-OVL)

**Por qué NO es contenido.** dng_enter_room (DUNGEON:0x0000) carga el .CBT, corre el
combate (0x00c4) y al volver (0x00de-0x0109) **restaura party_x/y y NO toca g_floor**
(`and [.+0x595a],0xAF` sólo marca la sala como despejada). El "un piso arriba" del
vídeo (f078: I3→I2) ⇒ el cambio de piso ocurre **dentro** del combate: la huida por
Klimb sobre escalera muta `g_floor` y señaliza escape, y dng_enter_room retorna al
first-person en el piso nuevo. El `Combat` del port es un modal PURO desacoplado del
estado de piso de mazmorra → hace falta puente COMBAT↔DUNGEON.

**Puntos a derivar en la implementación (abiertos):**
1. Trigger combate: ¿comando Klimb ('K') en el bucle de combate, o andar sobre un
   tile de escalera del .CBT que auto-escapa con label "Klimb-Up!"? (ver dispatch de
   teclas de COMBAT.OVL + move-onto-tile).
2. ID del tile de escalera arriba/abajo en los mapas .CBT de sala.
3. Dirección de piso: escalera-arriba → `g_floor-1`, escalera-abajo → `g_floor+1`
   (confirmar contra el vídeo I3→I2 = arriba).
4. Consumo de rand del escape (si lo hay) → escenario de paridad.

**Plan de implementación (3 etapas, tras aprobación):**
- **E3c-1** Core: `Combat.playerKlimbEscape()` — si el PJ activo está sobre tile de
  escalera, marca `status="fled"`, emite `Escape!`, y expone un `escapeFloorDelta`
  (−1/+1) en el resultado del combate. Sin tocar el stream de ataque/iniciativa.
- **E3c-2** Integración: `game.startDungeonRoomCombat` marca el combate como "de
  sala"; `endCombat`, si terminó por huida con `escapeFloorDelta`, aplica
  `dungeonState.pos.floor += delta` y deja al party en el first-person (BATTLE IS
  LOST! ya lo da E3a). Ladder-escape sólo habilitado en combate de sala.
- **E3c-3** UI: tecla 'K' en modo combate → `playerKlimbEscape`; label "Klimb-Up!"/
  "Klimb-Down!" según el tile. Tests: unidad (core escape+delta) + e2e (entrar sala,
  Klimb, volver al first-person un piso arriba) en puerto propio.

Riesgo: medio. No debería tocar la paridad de combate (comando nuevo, no altera
iniciativa/ataque). Requiere datos de tile de escalera del .CBT (verificar extractor).

### E3c — DERIVADO + IMPLEMENTADO ✅

Puntos abiertos resueltos (condiciones del lead):
- **(a) Trigger = COMANDO** (no pisar escalera). El movimiento de combate
  (SJOG:0x1C56 @ 0x1c98) imprime SIEMPRE la dirección (North/South/East/West,
  DATA.OVL 0x8eb8-0x8ece) antes de mover; el vídeo (f065) muestra `>Klimb-Up!` SIN
  línea de dirección → no puede ser un move. Es un comando que lee el tile bajo el
  PJ (precedente del Klimb de pueblo, TOWN.OVL:1151-1232). En el port: tecla `k` en
  `handleCombatKey` (aislada del Klimb de mazmorra y del cancel de Aim).
- **(b) Tile de escalera = 0xC8 (arriba) / 0xC9 (abajo)** — mismos IDs que pueblo
  (`re/notes/town-klimb.md §2`). DATO verificado en los .CBT: 12×0xC8 / 18×0xC9 en
  28 de las 112 salas.
- **(c) 0 rand.** El Klimb-escape es determinista (lee tile, marca huida, imprime).
  Test unitario asevera `combat.finalSeed` invariante a través de `playerKlimbEscape`.

Implementación: `Combat.playerKlimbEscape()` (combat.ts) fija `escapeFloorDelta`
(−1/+1) + `Klimb-Up!/Down!` + `Escape!`; `game.endCombat` aplica el delta a
`dungeonState.pos.floor` SÓLO en combate de sala (gate `dungeonState`) y SÓLO si el
party huyó (no victoria); subir desde planta 0 → Britannia, bajar desde 7 →
Underworld. Tecla `k` en `main.ts`. Tests: 4 unit (combat.test) + 3 integración
(refuge-live) + 1 e2e (dungeon-room-escape). Gate: 1292 unit + parity 25/2skip + e2e
en puerto propio 5197.

---

## E4 — PLAN: portar `search_dungeon` completo (SJOG 0x0646) [estructural, afecta stream]

E1 portó la parte SIN rand (direccional-ahead + `You find:` + mensajes por tile +
revelado de puerta secreta). E4 porta las ramas que E1 DEFIRIÓ: selección de
miembro, gate de luz, threshold, y las detecciones de trampa con `rand` + la
mutación de derrumbe. **Afecta el stream vivo** (el search del port hoy consume 0
rand) → escenario de paridad OBLIGATORIO antes de aterrizar (estándar del lead).

### Derivación (SJOG 0x0646, ya leída)
1. **Selección de miembro** (0x0648, `call 0x8a08`): elige PJ; si −1 → aborta.
2. **Gate de luz** (0x065a-0x0672): si `g_torch_mins==0 && g_light_spell_mins==0`
   → imprime mensaje de oscuridad y aborta (sin buscar).
3. **Celda AHEAD** (0x0672, `g_dng_facing`) — ya en E1.
4. **Threshold** (0x06b7-0x06d1): `thr = (g_floor*2 − DEX + 0x1e) >> 1`, DEX del PJ
   seleccionado (`[bx*0x20 + 0x55b5]`). Sin rand.
5. **`You find:`** (0x06d4) — ya en E1.
6. Dispatch por nibble alto (0x06db) — no-rand ya en E1; PENDIENTES
   [HISTÓRICO 2026-07-25: las tres ramas ya EN MAIN — cofre/bomba en E4-2
   ca1cd1a0, crumble muro 0xC en E4-3 6dc9cbf1 (dungeon.ts search)]:
   - **Cofre 0x4 / 0x7** (0x0710): `rand(1,30)` (0x0718) vs `thr`; según el resultado,
     `rand(1,8)` (0x073c) clasifica → `No trap`/`A simple trap`/`A complex trap`
     (DATA 0x8732/0x873c/0x874c/0x875c). Revela el cofre (para Get/Open).
   - **Foso 0x6** (0x0766): dispatch 0x60/0x61/0x62 → detección análoga →
     `in the pit.`/`A pit!`/`A bomb trap!`; revela `0x61→0x60`, alijo `0x62`.
   - **Muro especial 0xC** (0x0856): `g_dng_wall_variant` 1→`Nothing on the
     stalactite.`, 2→`Nothing in the caved in passage.` (mensajes, sin rand); ELSE →
     MUTA la celda a `0xB0|(cell&8)` + `It crumbles away.` (estructural, cambia
     conectividad — el clon no trackea `g_dng_wall_variant` por celda todavía).

### Etapas
- **E4-1**: selección de miembro + gate de luz + threshold. La luz exige que
  `DungeonState.search` lea `g_torch_mins`/`g_light_spell_mins` del estado; el PJ y
  su DEX ya accesibles. Sin rand nuevo aún (sólo el gate). Test: sin luz → mensaje
  de oscuridad, no busca.
- **E4-2**: detección de trampa de cofre (0x4/0x7) y foso (0x6): `rand(1,30)` +
  `rand(1,8)` con el threshold. **NUEVO escenario de paridad** en `re/parity/dungeon/`
  (KernelRng↔OriginalRng), como los de trampa/campo/foso. Orden de rands EXACTO
  a re-derivar de 0x0710-0x0766 (cuál tira primero, semántica del `jle thr`).
- **E4-3**: crumble del muro 0xC: trackear `g_dng_wall_variant` por celda (o derivar
  la variante del subtipo) + mutación `0xB0|(cell&8)` + `It crumbles away.`. Sin rand.

### Riesgo / gate
Medio-alto (toca el stream vivo). Gate de aterrizaje: dungeon parity con el NUEVO
escenario + unit tests de las ramas + los 1295 actuales + e2e. Strings nuevos al
manifiesto con cita: `No trap`/`A simple trap`/`A complex trap`/`in the pit.`/
`A pit!`/`A bomb trap!`/`It crumbles away.`/`Nothing on the stalactite.`/`Nothing in
the caved in passage.` (todos byte-exactos de DATA.OVL, offsets ya localizados).

### E4 — respuestas a las preguntas del lead (derivadas de SJOG 0x0646)

- **Threshold — ¿de quién?** Del **PJ QUE BUSCA** (miembro seleccionado), NO el líder.
  `0x064e call 0x8a08` (selección de miembro) → `0x0651 [bp-0xe]=idx`; el threshold
  `0x06b7 bx=[bp-0xe]; 0x06be al=[bx+0x55b5]` lee la DEX de ESE miembro. `thr =
  (g_floor·2 − DEX_buscador + 0x1e) >> 1`. (Confirmar en impl si 0x8a08 es el activo
  o un prompt; el clon ya tiene `activeChar`.)
- **Crumble del muro 0xC — ¿estado persistente?** SÍ, mapa vivo Y guardado. `0x0856`
  muta `[.+0x595a]` = `g_dng_map` @ DS:0x595A, que está DENTRO de la ventana
  SAVED.GAM (dungeon.md §0.1 "se guarda"). El clon ya lo modela: `DungeonState.setCell`
  + `overrides` (serializados). NO hace falta mecanismo nuevo — es el mismo mapa
  vivo/persistente que usan cofre-abierto y foso-disparado.
- **"Alijo" 0x62 — ¿tabla de loot?** NO. Corrijo la nota de cmds.md: **0x62 es un
  BOMB TRAP**, no un cache. La rama de foso (0x0766) despacha por tile COMPLETO:
  - `0x60` (0x077c): "in the pit." — determinista, SIN roll.
  - `0x61` pitfall (0x0782): determinista, SIN roll → revela a `0x60` (`(tile&8)+0x60`)
    y, si floor<7, marca el tile de ABAJO (`[.+0x599a] |= 8`, la fila del piso
    siguiente).
  - `0x62` bomb (0x07c6): **rand(1,30)** vs thr → si detecta, mensaje de bomba +
    DESARMA (`&= 8` → 0x00/0x08). Sólo 0x62 tira.
  Y el **cofre 0x40** (0x0710): **rand(1,30)** + condicional **rand(1,8)** →
  `No trap`/`A simple trap`/`A complex trap`; revela el cofre. Así que los ÚNICOS
  consumidores de rand del search son **cofre 0x40** (2 tiradas posibles) y **bomb
  0x62** (1 tirada). Todo lo demás (E1 + pit 0x60/0x61 + crumble) es 0 rand.
- **Escenario de paridad propuesto.** Nuevo `re/parity/dungeon/search-*.json` (patrón
  de los de trampa/campo/foso): siembra un grid con (a) cofre `0x40` delante y (b)
  bomb `0x62` delante, con `g_floor` y DEX del buscador FIJOS (el threshold depende de
  ambos). El modelo Python (`KernelRng`) predice `rand(1,30)`[+`rand(1,8)`] y el clon
  (`dungeon-run.ts`) lo reproduce; se exige mismos mensajes + mutación de tile +
  **semilla final** idéntica. Cubrir los dos lados del `cmp thr` (detecta / no detecta)
  variando DEX. El member-select (0x8a08) y el gate de luz NO tiran → fuera del stream.
