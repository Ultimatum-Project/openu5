# ACTA — carril `aud-relojes` (#122 AUD-A1 + #123 AUD-A2)

> Rama `fix/aud-relojes`, worktree `.claude/worktrees/aud-relojes`, retenida (aterriza el lead).
> Las dos tarjetas son «el turno/reloj equivocado corre», y las dos MUEVEN EL STREAM RNG.
> CERO e2e en este carril: el re-sello va en ventana aparte; §5 lista qué se moverá.
>
> GATES leídos por separado, sin pipe: `npx vitest run` desde `game/` **EXIT 0**
> (285 ficheros, 3678 pasados, 1 skipped) · `npx tsc --noEmit` **EXIT 0**.

---

## §0 — Herramienta de resolución usada en las dos tarjetas

Los `call 0xffffXXXX` de los overlays se resolvieron con la receta canónica de
`overlay-load-layout.md §3` (`CS = (near_call_base(overlay) + crudo) & 0xFFFF`), con
`re/tools/dispatch_table.py` como fuente de la tabla, NO a ojo:

| overlay | banda | `near_call_base` |
|---|---|---|
| SHOPPES3.OVL | 4 | `0xe1e0` |
| MAINOUT.OVL / DUNGEON.OVL / TOWN.OVL | 1 | `0x81d0` |

**Control positivo dentro del propio material**: en el bucle de posada el crudo `0x6d9c`
resuelve a CS `0x4f7c` = `advance_clock`, que es exactamente la rutina que nombraba la
tarjeta #122. Si la base fuera otra, ese ancla no cuadraría.

---

## §1 — #122: el bucle nocturno de la posada (SHOPPES3 0x01b5-0x01f4)

### 1.1 El defecto

`game/src/ui/shop-console.ts` cerraba la noche con
`s.time = advanceMinutes(tm, minutesToMorning)`. `advanceMinutes` (`core/time.ts:21`) es
aritmética de calendario pura: bucles `while` sobre minuto/hora/día/mes y nada más.

El binario llama por iteración a `advance_clock` (kernel `0x4F7C`), que el port YA TENÍA
FIEL como `advanceClock` (`core/world/survival.ts`). Resultado medido antes del fix: una
noche entera con **la antorcha intacta**, **los Shadowlords sin reubicar**, **cero
tiradas de RNG** y **la capa horaria de reja/puente sin fichar**.

### 1.2 El bucle, leído instrucción a instrucción

```
01b5  mov [bp-8],12 ; mov si,12
01bd  PRE-bucle:  push 5 ; call 0x6d9c (advance_clock) ; dec si ; je 0x1ef   → 12×5 = 60 min
01ca  bucle NOCHE, por iteración:
        01ca  call 0x3ae6  beep_ticks(1)        presentación (gated por [0x58a4]); SIN RNG
        01d1  call 0x400c  kernel_ring_regen    → ringRegenSweep
        01d4  call 0x2900  draw_status_panel    presentación
        01d7  push 9 ; call advance_clock       → 9 min
        01de  cmp [g_hour],0x14 / je · cmp [g_hour],5 / jne  → call 0x7a9a
01ef  cmp [g_hour],6 / jne 0x1ca
```

### 1.3 Las TRES derivaciones que la tarjeta dejaba abiertas

**(1) El pre-bucle `12 × advance_clock(5)` NO es un `advance_clock(60)`.** Suma los
mismos 60 minutos, pero con Quickness cada llamada se parte por separado (`0x4f8d`, `shr`
con mínimo 1): 12×(5>>1)=**24 min** frente a 60>>1=**30 min**. Además sale por `je`
DIRECTO al `cmp g_hour,6` de `0x1ef`, saltándose el check de las 20/5 de esa vuelta.

**(2) El minuto de despertar es VARIABLE (0-8).** El paso es `advance_clock(9)` y la
salida es `cmp g_hour,6`: se sale al PRIMER aterrizaje dentro de la hora 6. Tabla medida:

| entrada | pasos de 9 | despertar | min. totales |
|---|---|---|---|
| 17:00 | 80 | 06:00 | 780 |
| 19:00 | 67 | 06:03 | 663 |
| 21:00 | 54 | 06:06 | 546 |
| 21:05 | 53 | 06:02 | 537 |
| 23:00 | 40 | 06:00 | 420 |
| 09:00 | 134 | 06:06 | 1266 |

**Caso degenerado real y con test propio**: entrando a las **05:30** el pre-bucle deja las
06:30, el `cmp g_hour,6` ya casa y el bucle de 9 **no da ni un paso** — el minuto de
despertar NO cae en [0,8]. Es la prueba de que el pre-bucle corre ANTES del primer check.

**(3) `call 0x7a9a` = `town_time_tile_transform`, y YA ESTABA PORTADO.** El crudo `0x98ba`
del disasm → CS `0x7a9a`, que cae en la banda de stubs kernel→overlay `[0x7a16,0x81c6)`;
el stub es `lcall 0x72e:0x2ec ; dw 1 ; ljmp 0:0x8340` y `dispatch_table.stubs()` lo tabula
como `Stub(overlay='TOWN.OVL', entry_file_off=368)` = **TOWN.OVL:0x0170**. Esa rutina es
`town_time_tile_transform` (reja + puente levadizo por hora), portada en
`game/src/core/world/townHourTiles.ts` y expuesta como `Game.refreshHourTiles`.

### 1.4 La CUARTA, derivada de paso y NO cableada (tarjeta #158)

El `call 0x98ae` de `0x01fd`, justo tras «Morning!», resuelve a CS `0x7a8e` → stub →
**TOWN.OVL:0x1694**, o sea `npc_activate_all_town` del ledger. Su cuerpo (bucle 0x16c9-0x171b) recorre los
31 slots vivos, calcula el índice de horario para `g_hour` y **SNAPEA** cada NPC a su
posición programada (tablas `0x5d61`/`0x5d64`/`0x5d67`), marcándolo activo.

Equivalente portado: `NpcManager.enterMap`. **El clon no lo llama al despertar**, así que
los NPC amanecen donde estaban a las 21:00 y caminan a su sitio de las 6:00 un paso por
turno. **Sin impacto de stream** (ni el binario ni `enterMap` tiran rand) ⇒ es divergencia
POSICIONAL pura. Se declara y se deja con tarjeta propia en vez de colarla en este lote.

### 1.5 El fix

`innNightPass(state, rand, onHourTiles)` en `core/shops/shops.ts` calca el bucle.
`Game.innSleepUntilMorning()` lo cablea al stream VIVO y a `refreshHourTiles` — vive en
`Game` y no en el conductor de tienda porque el bucle necesita exactamente esas dos cosas.
`shop-console.ts` sólo cambia a QUÉ rutina llama (la nota del verificador era correcta: el
problema no era dónde vive).

### 1.6 Dos cosas DECLARADAS, no arregladas

- **Guarda de puerto `INN_NIGHT_MAX_STEPS = 1000`**, que NO es del binario. Con Time-stop
  (`'T'`) `advance_clock` retorna sin avanzar y la única salida del bucle es `hora==6`: el
  ORIGINAL se cuelga. El clon corre en un navegador y no puede. La cota es holgada — el
  peor caso real es Quickness (paso de 4 min) = 360 iteraciones por vuelta de día.
- **Divergencia de modelo overlay-vs-mutación, que este fix NO crea.** El binario llama a
  la transformación en CADA iteración cuya hora resultante sea 20 ó 5 (≈7 veces por hora)
  y su fase 1 es un `xor 0xdd` sobre el buffer vivo — un TOGGLE cuyo resultado depende de
  la PARIDAD de las llamadas. El clon modela la capa como OVERLAY recalculado desde el
  mapa estático, luego repetir la llamada es idempotente. Ya lo documenta
  `townHourTiles.ts`; portar el bucle no lo agrava.

### 1.7 Visto de paso y NO tocado

`camp.ts` hace `advanceClock(60)` + 12 `ringRegenSweep`, mientras el bucle de acampada
de CMDS (0x01ee) hace 12 × (`advance_clock(5)` + `ring_regen`). Mismo total salvo con
Quickness. No es esta tarjeta.

---

## §2 — #123: la guarda muerta `loc >= 0x21`

### 2.1 La derivación que decide el diseño: el binario SÍ escribe `g_location`

La tarjeta pedía elegir entre (a) derivar la condición de `dungeonState` o (b) escribir el
location real al entrar, DERIVANDO antes qué hace el original. Lo hace: **escribe**.

`MAINOUT.OVL` `mainout_enter_location` (0x0790-0x08de, 334 B) — la rutina de (E)ntrar
a una localización, cuya rama de mazmorra es ésta:

```
07a0-07d6  bucle si = 0x20..0x27 buscando (g_party_x,g_party_y) en las tablas de
           localización DS 0x1e8a (x) / 0x1eb2 (y); al casar → [bp-2] = si
0887       mov al, [bp-2]
088a       inc al
088c       mov byte ptr [g_location], al        ⇒ g_location = si+1 = 0x21..0x28
```

y el bucle de `DUNGEON.OVL` lo RELEE dos veces de forma independiente:
`0eff  cmp byte ptr [g_location],0x20 / jbe` y `0f47  cmp byte ptr [g_location],0x21 / jae`.

Censo de escritores de `g_location` en TODO el disasm (16 sitios, 12 ficheros): el único
del camino de entrada a mazmorra es ese `0x088c`.

**La banda `0x21..0x28` de las guardas del port es, por tanto, CORRECTA y derivada.** Lo
que faltaba era el valor.

### 2.2 Por qué NO se porta la escritura (y qué se hace en su lugar)

El clon deja `state.position` en el tile de SUPERFICIE de la entrada A PROPÓSITO: ahí
aterriza la salida de la mazmorra, y `dungeon-cmds.ts` lo declara por escrito. Escribir
0x21..0x28 en `position.location` rompería el camino de salida y arrastraría a todos los
consumidores de `position.location` (carga de mapa, `activeMap`, `smallMaps.has`, save…),
que en el binario ni se alcanzan porque la mazmorra es OTRO bucle principal.

Se cablea el puente en su lugar: **`Game.effectiveLocation`** devuelve el valor DERIVADO
(`dungeonState.pos.dungeon`, que ya ES 0x21..0x28) cuando hay mazmorra viva. Generaliza el
apaño puntual que el (C)ast de mazmorra ya hacía a mano en `main.ts`. Convertir el modelo
a la escritura real es una tarjeta aparte, mucho mayor.

### 2.3 CENSO OBLIGADO — todos los `loc >= 0x21` sobre `position.location` en `game/src`

⚠ **Trampa de instrumento encontrada al hacerlo**: `git grep -nE '…' -- 'game/src/**/*.ts'`
devolvió **CERO escritores** de `.location`; `grep -rn --include='*.ts'` devolvió 3. El
pathspec con `**` de `git grep` no casa como uno espera. El censo de abajo se hizo con
`grep -rn`. (Familia de `grep-r-symlink-falso-cero` / `git grep -E '\b'` (cero-en-falso).)

| # | sitio | ¿alcanzable en mazmorra? | efecto ANTES | veredicto |
|---|---|---|---|---|
| 1 | `game.ts` `ignite()` (rama de turno) | **SÍ** (`handleDungeonKey` → `'i'`) | corría `outdoorTurn`+`outdoorWorldTurn`: rand de viento + gate de spawn `rand(1,30)` | **ARREGLADO** |
| 2 | `game.ts` `gemViewTurn()` | **SÍ** (`handleDungeonKey` → `'v'`) | idem | **ARREGLADO** |
| 3 | ★ `survival.ts` `igniteTorch` | **SÍ**, MISMO comando que (1) | antorcha de 240 min fijos en vez de `112+rand(0,15)` ⇒ **una tirada de menos por (I)gnite** | **ARREGLADO** — *el auditor encontró 2; ésta es la tercera y estaba dentro del mismo comando* |
| 4 | `game.ts` `useSkullKey` | **SÍ** (`(U)se` se despacha en el bucle de mazmorra) | caía al camino de overworld y **desmagificaba una puerta del mapa de SUPERFICIE** en las coords de la entrada | **ARREGLADO** |
| 5 | `use-tools.ts` `useMagicCarpet` | **SÍ** vía `(U)se` | la alfombra se desplegaba DENTRO de la mazmorra (+1 `rand(0,1)` del facing) | **ARREGLADO** |
| 6 | `use-tools.ts` `useSpyglass` | **SÍ** vía `(U)se` | el catalejo enseñaba estrellas en la mazmorra | **ARREGLADO** |
| 7 | `use-tools.ts` `useMoonstone` | **SÍ** vía `(U)se` | la moonstone se enterraba en el mapa de SUPERFICIE | **ARREGLADO** |
| 8 | `main.ts` → `applyPotionEffect` | **SÍ** vía `(U)se` | poción Blanca: el gate `location < 0x21` (0x1514) se cumplía EN FALSO y revelaba mapa desde el interior | **ARREGLADO** |
| 9 | `game.ts` `runContextTurn` (`inDungeon`) | sí, por (1)/(2) | la noción interna del motor de turno estaba muerta | **ARREGLADO** (defensa en profundidad) |
| 10 | `game.ts` `fireCannon` | sí | **NEUTRO**: con `loc===0` ya entraba por el primer disyuntor y daba el mismo «What?» | **ARREGLADO por consistencia**, sin cambio de comportamiento |
| 11 | `survival.ts` `minutesPerAction` | sí | coste de turno de mazmorra | **NO SE TOCA — ver §4** |
| 12 | `ui/music.ts` `contextFor` (`location >= 33`) | sí (`main.ts` `updateMusic`) | perfil de música: en mazmorra devuelve «overworld» | **DECLARADO, no tocado**: presentación, y ya hay un `music.play("dungeon")` explícito al entrar. Tarjeta suya si se quiere |
| 13 | `skin/coreview.ts` ×2 | gates de PINTADO de la piel | dentro de la mazmorra se pinta la vista 3D, no este camino | **DECLARADO, no tocado**: es capa de piel, no mecánica |
| 14 | `dungeon.ts:1551` (`location - 0x21`) | — | su `location` es un ID de mazmorra de parámetro, no `position.location` | **NO APLICA** |
| 15 | `main.ts` (Rel Hur, `loc < 0x21`) | vía pergamino | mismo género que (8) | **DECLARADO**: no verificada la alcanzabilidad del pergamino en mazmorra; queda para la tarjeta de barrido |

### 2.4 El fix

Un solo accesor `Game.effectiveLocation` + su gemelo local `effectiveLocation(ctx)` en
`use-tools.ts` (el `UseToolsCtx` YA llevaba `dungeonState`, no hubo que ampliar contexto) +
un parámetro opcional `location` en `igniteTorch` (los 3 callers restantes conservan el
default y no cambian).

---

## §3 — Impacto de STREAM declarado

**#122 — por noche de posada.** ANTES: **0 tiradas**. AHORA:
- N barridos de `kernel_ring_regen` (N = pasos de 9 de la tabla §1.3). Cada barrido tira
  `rand(0,7)` **sólo por miembro con el Ring of Regeneration equipado** (`[0x55C5]==0x2C`)
  ⇒ con el party del Grand Tour son **0 tiradas** y los sellos no se mueven por esa vía.
- **1 re-sorteo de Shadowlords por cruce de medianoche**: ≥3 `rand(1,8)` más los reintentos
  del bucle de colisión. **Sí** mueve el stream en cuanto haya un Shadowlord con loc<0x80.

**#123 — por comando dentro de la mazmorra.** El signo va en las dos direcciones:
- `(I)gnite` y `(V)iew gem` DEJAN de tirar el rand de viento y el gate de spawn `rand(1,30)`
  del turno de overworld ⇒ **menos** consumo.
- `(I)gnite` EMPIEZA a tirar el `rand(0,15)` de la antorcha de mazmorra ⇒ **más** consumo.
- `(U)se` alfombra deja de tirar su `rand(0,1)` de facing dentro de la mazmorra.

Neto: el stream dentro de la mazmorra cambia en CUALQUIER cadena que use (I)gnite, (V)iew
o (U)se ahí dentro. Medido en el test: con la misma semilla, `ignite()` en mazmorra daba
seed `21824` antes y `17185` después.

---

## §4 — Hueco ABIERTO que este carril NO cierra (y por qué)

**El coste en minutos del turno de mazmorra.** `advanceTurn(state, undefined, rand)` usa
`minutesPerAction(state.position.location)`, que con `location===0` devuelve **2** (coste
de exterior). Es el mismo valor que ya usan los demás comandos de mazmorra
(`dungeon-cmds.ts`), así que el fix de §2 **no introduce** divergencia nueva: deja
(I)gnite/(V)iew CONSISTENTES con el resto del bucle de mazmorra.

Enrutar `minutesPerAction` por `effectiveLocation` daría **1** — y eso movería el reloj de
TODOS los turnos de mazmorra. **No se hace**, porque el valor correcto no está derivado:
en `DUNGEON.OVL` hay **una sola** llamada a `advance_clock` y está **dentro de la rama de
Quickness** (`0x0f1e cmp [g_time_spell],0x51` → `0x0f2b advance_clock(1)`), o sea un tick
EXTRA de cadencia alterna, no el coste base del paso. El coste base debe venir de otro
sitio que no he localizado. Queda declarado como pregunta abierta con la evidencia exacta;
**quien lo cierre debe derivarlo, no inferirlo de este `1`.**

---

## §5 — IMPACTO E2E DECLARADO (para la ventana de re-sello; NO se ha corrido nada)

Especificaciones y digests que la ventana debe re-sellar o, como mínimo, mirar:

**Por #122** — cualquier cadena que duerma en una posada:
- specs de tienda/posada del Grand Tour (flujo `R` → `Y` de posada) — el texto no cambia,
  pero **el reloj de salida sí**: hora 6 con minuto ≠ 0.
- cualquier digest/checkpoint que capture `time` o el `seed` DESPUÉS de una posada.
- los checkpoints del espejo que crucen una noche de posada (el re-sorteo de Shadowlords
  puede reubicarlos ⇒ cambia dónde aparecen).
- **NO** debería moverse nada que no duerma en posada: el fix está confinado a `innRestYes`.

**Por #123** — cualquier cadena que dentro de una mazmorra use (I)gnite, (V)iew a gem o
(U)se:
- `dungeon_parity` y los capítulos de salas/mazmorra que enciendan antorcha dentro
  (la duración de la antorcha pasa de 240 a 112+r ⇒ **la luz se acaba antes**; una cadena
  larga a oscuras puede cambiar de resultado).
- cualquier digest de seed tomado dentro de mazmorra tras uno de esos tres comandos.
- **NO** debería moverse nada de overworld/pueblo: los dos controles positivos del test
  nuevo fijan que fuera de la mazmorra el comportamiento es idéntico.

---

## §6 — Failing-first (evidencia, no promesa)

- **#122**: 7 rojos antes del fix (6 nuevos + el `minute===0` de `inn-flow.test.ts`
  apretado a 6) → 20/20 verdes. El 7º test es **control negativo** (entrada a la 1:00, sin
  cruzar medianoche): verde ANTES y DESPUÉS, y prueba que el fix no inventa tiradas.
- **#123**: el fichero nuevo `dungeon-effective-location.test.ts` se corrió contra el
  código PRE-FIX (revirtiendo sólo `game/src` y volviendo a aplicar el parche): **5 rojos
  de 6**, incluida la divergencia de seed `21824` vs `17185`. El 6º es **control positivo**
  (Skull Key en el overworld): verde en las dos corridas.

No hizo falta ningún trinquete de aserto invertido: los dos fixes van en el mismo commit
que sus tests, así que `main` nunca queda rojo.
