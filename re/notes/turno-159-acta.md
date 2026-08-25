# ACTA turno-159 — el turno de mazmorra cuesta 1 MINUTO, y el censo que lo respalda está VACÍO POR FALTA DE INSTRUMENTO

> Carril `reltym-c-159` (relevo de `reltym-b-159`, muerto por error 500 con 4 ficheros
> SIN COMMITEAR en su worktree). Rama `fix/turno-159`, worktree
> `.claude/worktrees/reltym-b-159`, base **main `ed79e793`**. Toda cifra medida en ese
> árbol. RETENIDA: aterriza el lead.
> Rescate: los 4 sucios del caído eran el fix ya escrito + su candado; nada descartado.

---

## 1. LA DERIVACIÓN — por qué el paso normal NO es gratis

El bucle DUNGEON **no tiene un `advance_clock` propio**. Tiene UNO solo, el de 0x0F2F,
y está físicamente dentro del bloque del hechizo de Quickness — pero el camino sin
hechizo temporal **salta a ese mismo `push`/`call`** en vez de tener el suyo:

| offset | mnemónico | lectura |
|---|---|---|
| `0x0FD0` | `cmp [bp-0xe],0` / `jne 0xf93` | sólo se cobra si el despachador devolvió 0 |
| `0x0FD6` | `cmp [g_time_spell],0x54` / `je 0xf1e` | 'T' An Tym |
| `0x0FE0` | `cmp [g_time_spell],0x51` / `je 0xf1e` | 'Q' Rel Tym |
| `0x0FEA` | `mov di,1` | sin hechizo: di = 1 |
| `0x0FED` | `mov ax,di` | ax = 1 = el argumento |
| `0x0FEF` | `jmp 0xf2e` | **entra en el bloque de 'Q', en su `push ax`** |
| `0x0F2E` | `push ax` | |
| `0x0F2F` | `call 0x4F7C` | `advance_clock(1)` |

**Salto verificado byte a byte**: `e9 3c ff` en 0x0FEF ⇒ 0x0FF2 + (−196) = 0x0F2E.

**El destino del `call` se acredita por CONTROL POSITIVO, no por su etiqueta** — en
overlay las etiquetas son file-relativas y mienten (el disasm lo renderiza como
`call 0xffffcdac`). Los dos `advance_clock` que el repo YA tenía bautizados por vía
independiente rinden byte a byte el MISMO destino:

| call-site | bytes | destino renderizado | ya documentado como |
|---|---|---|---|
| TOWN `0x15D4` | `e8 d5 b7` | `0xffffcdac` | `advance_clock(1)`, kernel-survival §5.1 |
| MAINOUT `0x0C3D` | `e8 6c c1` | `0xffffcdac` | `advance_clock(2)`, kernel-survival §5.2 |
| DUNGEON `0x0F2F` | `e8 7a be` | `0xffffcdac` | **éste** |

Los tres comparten además el patrón `mov ax,N` / `push ax` / `call`. Regímenes hermanos,
descritos y **NO modelados**: 'Q' (Rel Tym) cobra 1 minuto **cada DOS** turnos (0x0F25
`xor di,1` / 0x0F29 `je 0xf36`); 'T' (An Tym) cae en 0x0F34 `sub di,di` y **no llama**.
Offsets accesorios cotejados: 0x0E2E es `push bp` (prólogo del bucle), 0x0F84
`call 0xc76` (housekeeping), cola 0x0E1F/0x0E22.

**De dónde salía el error.** Un censo de call-sites ve UN solo `advance_clock` en
DUNGEON.OVL, lo encuentra bajo el `cmp 'Q'` de 0x0F1E, y concluye que el paso normal es
gratis. Esa conclusión es un artefacto de **contar `call` en vez de seguir el `jmp`** — y
es exactamente lo que estaba escrito en las dos notas que este commit rectifica.

---

## 2. ★ EL ARNÉS-ESPEJO: dos lados con el MISMO defecto se validan mutuamente

Este es el hallazgo que transfiere más allá de #159, y lo dejó apuntado el carril caído.

El test AUD-A2 (`dungeon-effective-location.test.ts`) compara el juego vivo contra un
**arnés de referencia** construido a mano, y sella `expect(game.state.time).toEqual(refState.time)`.
Su referencia hacía:

```ts
advanceTurn(refState, undefined, refRand);   // ← ANTES
```

Es decir: la referencia pasaba el coste **sin fijar**, caía en
`minutesPerAction(refState.position.location)` y —como el arnés deja esa location en 0,
igual que el clon bajo tierra— **cobraba los 2 minutos de EXTERIOR, exactamente el mismo
defecto que estaba midiendo**. La igualdad salía **VERDE POR COINCIDENCIA DE BUG**.

Un test así no es débil: es **ciego por construcción**. No hay valor del coste que pueda
ponerlo rojo, porque los dos lados de la igualdad leen la misma fuente equivocada. Es la
familia [detector que no discrimina] en su forma más pura, y la firma que la delata es
estructural, no numérica: **el arnés de referencia obtiene el dato en discusión por la
misma vía que el sujeto**. Cuando eso pasa, la referencia ha dejado de ser referencia.

Regla que se lleva: en un careo clon-vs-referencia, el lado de referencia debe tomar el
valor en litigio **del binario** (literal + cita), nunca de la misma función que el
sujeto. Aquí la referencia pasa ahora `MINUTES_PER_ACTION_DUNGEON`, cuyo valor está
clavado al literal 1 con la cita ASM (§3).

Prueba de que el arreglo es load-bearing: al medir el rojo transitorio (§4), AUD-A2 se
puso **roja de propina**, sin haberla tocado para eso.

---

## 3. ★ CONTROL DE SENSIBILIDAD POR VALOR ABSURDO (nombre para citar)

**La pregunta no es «¿pasa el fix?» sino «¿EXISTE el instrumento que lo mediría?».**

El procedimiento, de una línea: se pone la constante bajo prueba en un **valor absurdo**
—uno que ninguna derivación defendería— y se corre la suite entera. Lo que se ponga rojo
ES el instrumento; lo que siga verde no mide nada.

Aplicado aquí, `MINUTES_PER_ACTION_DUNGEON = 7` (turno de mazmorra a 7 minutos):

| corrida | ficheros | tests | failed | EXIT |
|---|---|---|---|---|
| main (sin fix, coste 2) | 309 | 3945 passed, 1 skipped | 0 | 0 |
| con el fix (coste 1) | 309 | 3945 passed, 1 skipped | 0 | 0 |
| **control absurdo (coste 7)** | **309** | **3945 passed, 1 skipped** | **0** | **0** |

⇒ **NINGUNA de las 309 unidades mide el reloj de mazmorra a valor absoluto.** El censo de
impacto de este fix es **VACÍO POR AUSENCIA DE INSTRUMENTO, no por inocuidad**: cero
relojes sellados que mover, cero cruces de medianoche ejercitados por un turno de
mazmorra. Ni la marchitación (#195, por `g_day`), ni las re-siembras (`rng.md §Techos`),
ni el latch lunar (#176) pasan por esta vía en unit — todos tienen cobertura, pero
ninguno la tiene *a través de un turno de mazmorra*.

Sin este control, «309/309 verde» se habría reportado como «el fix no mueve nada», que es
una **falsa paz**: la afirmación correcta es «no hay con qué medirlo aquí». Es
cero-emisiones ≠ cero-capacidad ejercido con un experimento barato, y por eso se le pone
nombre: **control de sensibilidad por valor absurdo**.

---

## 4. TRINQUETES — los dos rojos MEDIDOS, no declarados

El árbol rescatado traía el test declarando «estaba ROJO antes del fix» **sin evidencia**.
No se hereda un failing-first de palabra: se reproduce revirtiendo temporalmente los
call-sites (con copia de respaldo y verificación de byte-identidad al restaurar).

| trinquete | reversión | resultado medido |
|---|---|---|
| los 4 comandos (`forward/left/right/back`) | call-sites → sin fijar | **`expected 2 to be 1`** en los cuatro · 2 failed / 5 passed |
| ★ propina: AUD-A2 | (la misma) | **roja también** — confirma §2 |
| Uus/Des Por (5º call-site) | sólo su call-site | **`expected 2 to be 1`** · 1 failed / 7 passed |

★ **Y el propio control de §3 cazó que el candado rescatado era CIRCULAR**: hacía
`expect(mins()-t0).toBe(MINUTES_PER_ACTION_DUNGEON)`, o sea leía la constante para
comprobar la constante. Con la constante en 7, **el test bendecía 7**. Sella «los
call-sites consumen la constante» (que ya cubre `tsc`), jamás «el coste es 1».
Reescrito contra el **LITERAL 1** con la cita ASM al lado, más
`expect(MINUTES_PER_ACTION_DUNGEON).toBe(1)` y el control contra `OUTDOORS === 2`.

---

## 5. EL FIX — son CINCO call-sites, no cuatro

El clon pasaba el coste sin fijar y caía en `minutesPerAction(position.location)`; como
deja esa location en 0 bajo tierra (#123, `Game.effectiveLocation`), salía la rama de
EXTERIOR y el turno costaba **2 minutos, el doble**.

Censo completo por `grep -rn "advanceTurn(" game/src` (no muestra):

| # | sitio | antes | ahora |
|---|---|---|---|
| 1 | `game.ts:2275` (comando de mazmorra) | sin fijar → 2 | `MINUTES_PER_ACTION_DUNGEON` |
| 2 | `game.ts:2411` (gemelo, turno consumido) | sin fijar → 2 | idem |
| 3 | `dungeon-cmds.ts` `dungeonCommand` | sin fijar → 2 | idem |
| 4 | ★ `dungeon-cmds.ts` `dungeonMagicChangeLevel` | sin fijar → 2 | idem |
| 5 | `dungeon-cmds.ts` `dungeonSpellTurn` | sin fijar → 2 | idem |

★ **El 4 lo destapó el censo y el caído no lo tenía**: `dungeonMagicChangeLevel` es
Uus Por / Des Por en la vista 3D (DUNGEON 0x1C6A mode=1), vuelve al MISMO bucle y cobra
su misma cola de reloj. **Se adjudica sin derivación nueva porque su propio docblock ya
lo declaraba**: «aquí sólo se cobra el turno de mazmorra ... como `dungeonCommand`» —
mientras pasaba el coste sin fijar y cobraba 2. El port se contradecía a sí mismo entre
su cabecera y su cuerpo.

**Los dos `advanceTurn` de `__parity__/run.ts` SE QUEDAN sin fijar**, y el porqué está
medido, no supuesto: es un arnés de estado puro, `dungeon-run.ts` no llama a
`advanceTurn`, y **cero** escenarios de paridad usan location 0x21-0x28.

---

## 6. PROSA RECTIFICADA — tres sitios, uno más de los dos previstos

| sitio | decía | dice |
|---|---|---|
| `re/notes/dungeon.md §1` | «NO hay `advance_clock(n)` por paso normal ... el reloj sólo avanza vía eventos» | la derivación con la tabla de §1 y el byte-check |
| `re/notes/kernel-survival.md §9` | «llama advance_clock(1) **solo** en el toggle de Quickness» | tachado en su sitio + rectificación: es ese mismo call, alcanzado por `jmp` |
| ★ `game/src/core/game.ts` (`effectiveLocation`) | «cambiarlo movería el reloj de todos los turnos de mazmorra **sin derivación que lo respalde**» | la derivación ahora EXISTE; y la vía elegida **no** fue tocar `minutesPerAction` sino pasar el coste explícito en los cinco call-sites |

El tercero no estaba en el encargo: lo encontró el censo de `minutesPerAction`. Es la
advertencia que #159 justamente levanta, y dejarla habría dejado el repo diciendo que
esto sigue sin derivar.

---

## 7. ⚠ PENDIENTE DE RESELLO — lo único que este acta NO puede cerrar

**Los digests e2e de capítulos de mazmorra quedan PENDIENTES DE RESELLO en la próxima
ventana: este fix mueve el reloj de TODOS los turnos de mazmorra (2 → 1 minuto) y es
ESPERADO que se muevan.** No se ha corrido un solo playwright (HOLD vigente); son el
único sitio donde el cambio puede morder, precisamente porque §3 demuestra que el unit no
lo mide. Si un digest de mazmorra cambia tras aterrizar, **eso no es una regresión: es
este fix**.

---

## 8. GATES — EXIT leídos por separado, sin pipes, TRAS el `git add`

| gate | EXIT | nota |
|---|---|---|
| `tsc --noEmit` | **0** | |
| `vitest` COMPLETO | **0** | 309 ficheros, 3946 passed, 1 skipped |
| `seed_gate.py` | **0** | validó las actas tocadas |
| `pytest test_frontier + test_genero + test_cita_segmento -q` | **0** | 97 passed |
| `genero.py` | **0** | |
| `cita_pegajosa_forma.py` | **0** | controles 3/3 OK, población 348 |
| `cita_pegajosa_atribucion.py` | **0** | |

Conflicto con las ramas del GO, medido contra el **merge-base** (no contra `main..rama`,
que sólo refleja que main se movió): de siete ramas, sólo `skin/mobile-preview` y
`skin/movil-cmds-fixes` tocan `game.ts`, y ambas sólo en el hunk de la línea ~1851. Las
tres ediciones de este commit caen en 2270 / 2410 / 3838. **Sin solape textual.**
