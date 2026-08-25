# ACTA #203 — Rel Tym ('Q') en COMBATE: la mecánica ausente, PORTADA

> Rama `fix/reltym-203`, worktree `.claude/worktrees/reltym-203`, base **main `994d4fc2`**.
> Toda cifra medida en ese árbol. RETENIDA: aterriza el lead.
> Hallazgo (c) de `re/notes/sueltos-174-acta.md` §4. NO se corrió e2e (HOLD).

---

## 0. VEREDICTO

El binario, bajo Rel Tym, tira `rand(0,1)` UNA vez por turno de enemigo y con
resultado 0 le quita el turno **entero**. El port no lo modelaba: doble defecto
(mecánica ausente **y** una tirada por turno sin consumir). **Portado**, con la
tirada dentro del gate: con el hechizo inactivo el stream queda **byte-idéntico**
(candado medido, verde antes y después).

La premisa del encargo se sostiene **re-derivada de cero**, con dos precisiones que
el encargo no traía: (1) la identidad de la rutina no había que darla por buena —
la fija el caller; (2) la mitad «moneda 1» **no se puede medir por si el enemigo
actúa**, y creerlo casi me deja un test mal especificado (§4).

## 1. La rutina es el turno de IA, y lo dice su CALLER (no la prosa)

`COMBAT.OVL:0x03f4` es la rutina; que sea el turno de ENEMIGO no se hereda de la
nota, se lee en el punto donde se decide:

| call-site | instrucción | término |
|---|---|---|
| `COMBAT.OVL:0x0c84`, | `push ax` (= `g_cmb_actor`) / `call 0xffffb3b6` | predicado sobre el actor vivo |
| `COMBAT.OVL:0x0c89`, | `je 0xc90` | falso ⇒ … |
| `COMBAT.OVL:0x0c90`, | `call 0x63e` | … turno de **PJ** |
| `COMBAT.OVL:0x0c8b`, | `call 0x3f4` | cierto ⇒ turno de **IA** ← la rutina de este acta |

Hay un segundo caller, `COMBAT.OVL:0x06c1`, que entra por la vía del actor
POSEÍDO (fija `g_active_char = 0xFF` antes de llamar). Es decir: la moneda alcanza
también al PJ poseído. En el port eso ya sale gratis, porque el gate va dentro de
`enemyTurn` y `tickEnemyTurns` la invoca con `cur.kind === "enemy" || cur.charmed`.

## 2. El tramo, instrucción a instrucción

| offset | instrucción | destino | lectura |
|---|---|---|---|
| `COMBAT.OVL:0x0418`, | `cmp byte ptr [g_time_spell], 0x54` | — | `'T'` An Tym |
| `COMBAT.OVL:0x041d`, | `jne 0x422` | `0x0422` | |
| `COMBAT.OVL:0x041f`, | `jmp 0x540` | `0x0540` | turno perdido (ya portado) |
| `COMBAT.OVL:0x0422`, | `cmp byte ptr [g_time_spell], 0x51` | — | **`'Q'` Rel Tym** |
| `COMBAT.OVL:0x0427`, | `jne 0x43a` | `0x043a` | ★ **inactivo: no llega al `call`** |
| `COMBAT.OVL:0x0429`, | `sub ax, ax` / `push ax` | — | min = 0 |
| `COMBAT.OVL:0x042c`, | `mov ax, 1` / `push ax` | — | max = 1 |
| `COMBAT.OVL:0x0430`, | `call 0x7e02` | CS `0x2092` | **`rand_range(0, 1)`** |
| `COMBAT.OVL:0x0433`, | `or ax, ax` | — | |
| `COMBAT.OVL:0x0435`, | `jne 0x43a` | `0x043a` | ≠0 ⇒ el turno SIGUE |
| `COMBAT.OVL:0x0437`, | `jmp 0x540` | `0x0540` | ==0 ⇒ turno perdido ENTERO |
| `COMBAT.OVL:0x0540`, | `mov sp, bp` / `pop bp` / `ret` | — | epílogo |

Tres cosas que se **derivan** de la tabla y que no estaban resueltas en el encargo:

1. **Rango del rand**: `push 0` primero, `push 1` después ⇒ `rand_range(min=0, max=1)`,
   ambos inclusive (convención ya fijada del kernel `0x2092`, y el thunk citado, `0x7e02`, está
   adjudicado a ese destino en `re/notes/citas-pool-adjudicacion.md` §6).
2. **Gate de activación**: el byte `g_time_spell` (DS `0x587a`), valor `0x51`. No hay
   duración propia: la lleva `g_time_spell_turns` (DS `0x588e`), común a los cinco
   efectos, y el housekeeping ya portado la decrementa y limpia el byte
   (`game/src/core/world/survival.ts:362-365`). **No hay estado nuevo**.
3. **Qué se pierde**: el `jmp 0x540` va al epílogo, así que se salta el turno entero —
   incluido el despertar del dormido, `0x0446`, que está DETRÁS. Y no consume nada
   más: entre los dos extremos del tramo citado, `0x0422`, y `0x0437`, la única `call`
   es la de `0x0430`, y no hay ninguna otra.

★ El punto que el encargo pedía asegurar antes de tocar nada: **con `g_time_spell`
distinto de `0x51` el `jne` de `0x0427` se come el `call`**. El binario NO tira
inactivo ⇒ el fix no puede mover los sellos, y el requisito de seguridad se cumple
por construcción, no por suerte.

## 3. El fix

`game/src/core/combat/combat.ts`, en `enemyTurn`, inmediatamente debajo del gate de
An Tym (mismo orden que el binario):

```ts
if (this.opts.state.timeSpell === "Q" && this.crng.rand0(1) === 0) return [];
```

El `&&` **es** el `jne` de `0x0427`: el cortocircuito garantiza que sin `'Q'` no se
llama al generador. Y `rand0(1)` es `rng.next(0, 1)`, el mismo par que el `push
0`/`push 1` de `0x0429`-`0x042c`.

★ **La trampa del encargo, esquivada y por qué**: el port ya modela Rel Tym en
overworld (`outdoorWorldTurnRuns`, `MAINOUT.OVL:0x1a7a`) y en mazmorra
(`worldAdvances`, `DUNGEON.OVL:0x0f1e`), y en los DOS es un `xor` de un flag de
fase — determinista. Copiar ese patrón habría dado una mecánica plausible, alterna
y falsa. Un test lo discrimina explícitamente (§4, el de «es una MONEDA, no el
TOGGLE»): la partición observada de turnos perdidos debe coincidir **semilla a
semilla** con el predicado del rand, cosa que ninguna alternancia puede hacer.

También se retiró la prosa RANCIA que el propio port tenía al lado: el docblock de
An Tym decía que la rama de `'Q'` era «un gap aparte, no modelado — fuera de #42».

## 4. ★ El error propio: `acted` NO mide «el turno siguió»

Escribí la mitad «moneda 1» del test como *el enemigo actúa*. Rojo tras el fix, en
la semilla 27. **No era el fix**: con `'Q'` y moneda 1 el turno corre entero, pero
el stream va adelantado una tirada, y con ese stream corrido hay semillas en las
que el turno no produce acción visible. Medido:

| corrida (semilla 27) | semilla final | ¿acción? |
|---|---|---|
| sin hechizo | `0xbdc2` | sí |
| con `'Q'` | `0xbdc2` | **no** |
| sin hechizo, arrancando en la semilla +1 tirada | `0xbdc2` | **no** |

Las dos últimas filas son **idénticas** ⇒ el turno SÍ corrió. El discriminante
correcto no es «actuó» sino la **equivalencia exacta** con el mismo turno sin Rel
Tym arrancado desde la semilla adelantada, que es literalmente lo que dice el `jne`
de `0x0435`: cae en `0x043a`, el mismo sitio al que salta el caso inactivo. Así
está escrito ahora. (Nota de método, hermana de
`instrumento-equivocado-peor-que-ninguno`: el rojo era del INSTRUMENTO, y comprobar
la hipótesis antes de tocar el fix costó una sonda de tres líneas.)

Del mismo tropiezo salió un segundo cuidado: hay semillas (1, 4, 10, 18, 24, 28,
30, 31, 34, 38 de las 40 barridas) en las que, **sin hechizo ninguno**, el enemigo
ya no actúa y ya gasta exactamente una tirada. Usarlas como caso de «turno perdido»
habría dado un **control degenerado** —verde sin que el fix hiciera nada—, así que
están excluidas del arnés y la exclusión tiene su propio test de precondición.

## 5. Gates y sellos

- `npx tsc --noEmit` — **EXIT 0**.
- `npx vitest run` (suite COMPLETA) — **EXIT 0**: 308 ficheros, 3940 pasados, 1 saltado.
- Failing-first verificado sustituyendo `combat.ts` por el de main: **4 rojos, todos
  CONDUCTUALES** (`expected true to be false`, `expected [] to deeply equal [2,3,…]`),
  ninguno de import. Con el fix, los 7 verdes.
- **Candado de stream**: 12 semillas × 2 (sin hechizo y con `'P'`) con su semilla final
  literal medida en main `994d4fc2`. **Verde antes y después.** Es lo que se pondría
  rojo si alguien metiera una tirada en la vía inactiva.
- e2e: **NO corrido** (HOLD). Ningún spec ni test pone `timeSpell` a `'Q'` en combate
  (censo hecho sobre `game/src`, `game/tests` y `game/e2e`), así que las salas selladas
  no pasan por la rama nueva ni siquiera al re-sellar.

## 6. Cola

- `re/notes/combat.md` §8 y §12 ya describían bien el tramo y el call-site: **no se tocan**.
  El hueco era exactamente el que decía el hallazgo (c): nadie unía las dos mitades.
- `re/notes/content-audit.md`:174 archivaba esto contra la tarjeta **#42, que no existe**
  (la lista salta del #41 al #43). Corregida la referencia a #203 y marcada portada.
- Emparenta con #128 (lote de PARIDAD). Aquí NO hace falta esa ventana: el stream sólo
  se mueve **con el hechizo activo**, que es justo lo que el binario hace.
