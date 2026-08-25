# Verificado: Creación de personaje — la gitana (Task 3.11)

Reglas re-derivadas del asm con citas (`re/notes/gypsy.md`) y portadas al clon
(`game/src/core/creation/gypsy.ts`; integración en `core/state.ts:createNewGame`).
El arnés `re/tools/test_gypsy_parity.py` cruza dos modelos INDEPENDIENTES: la
predicción asm-derivada en Python (`gypsy_parity.py`, que relee las tablas de
DATA.OVL y reproduce el RNG del kernel) y la reproducción del core del clon
(`game/src/core/__parity__/gypsy-run.ts`). El quiz **sí consume RNG** (el
`rand_range` del kernel, `OriginalRng`), pero desde `g_rng_seed=0` el bracket es
determinista, así que la paridad es de VALOR dado `(seed, respuestas)`.

## Convención de fidelidad

- ✅✅ **RUNTIME-VERIFICADO** en DOSBox (valor byte-a-byte en vivo).
- ✅ **asm-directo** (regla leída de las instrucciones, con cita) y/o cruce
  modelo↔clon verde.
- ⚠️ pendiente / gap.

## Estado de la verificación (2026-07-11)

VERDE:
- `re/tools/test_gypsy_parity.py` — 11 passed (unidades del modelo: tablas de
  DATA.OVL, RNG del kernel, bracket determinista, finalize + 6 escenarios
  cruzados clon↔modelo) + 1 live opt-in (`U5RE_LIVE=1`, EJECUTADO Y VERDE).
- `npm test -w game` — 484 passed (incluye `tests/gypsy.test.ts` 14 tests:  <!-- F.1 2026-07-11: total de la suite completa (484) -->
  tablas de virtud, bracket seed-0, vectores fijos all-A/all-B, MP=INT, suelo STR,
  emparejamiento par→pregunta, asset QUESTION.DAT, integración con el Avatar) +
  extractor 107 passed (incluye `parseQuestions`).
- Suite RE base — sin regresiones (`pytest re/tools -k "not live"`, verde).

## ✅✅ RUNTIME-VERIFICADO en DOSBox (ejecutado 2026-07-11, opt-in U5RE_LIVE=1)

- **Semilla del título == 0** (`test_gypsy_parity.py::test_seed_zero_at_title_live`):
  arranca el oráculo, espera al primer sondeo de teclado del título (tras la
  animación de intro, antes de elegir menú) y lee `g_rng_seed` (DS:0x5420) vía
  `EV DS` + `read_mem`. **Observado: 0x0000.** Esto es LO ÚNICO medido en vivo.
- **Alcance exacto del ✅✅**: lo verificado es que la semilla es 0 en el título.
  Que siga siendo 0 en el PRIMER `pick_virtue` NO está medido, y su respaldo
  estático ESTÁ REFUTADO — ver el aviso de abajo.

> 🔴 **REFUTADO por #186** (`re/notes/rng-186-acta.md §6`; `re/notes/gypsy.md` lleva el
> desarrollo). El respaldo estático de este ✅✅ decía: «se apoya en el censo estático de
> rng.md: **0 sitios srand/time_hash en INTRO/FONT** (los que RE-siembran), e INTRO con 0
> rand; FONT tiene exactamente 1 sitio rand — el propio `pick_virtue` (0x9a6) … Por tanto
> nada re-siembra ni consume RNG antes del quiz.»
>
> Dos de esas tres cláusulas se CONFIRMAN («INTRO con 0 rand» ✔; «FONT tiene exactamente
> 1 sitio rand» ✔, y además 0 srand/time_hash). La tercera es **FALSA**: `INTRO.OVL`
> tiene `rng_time_hash` en 0x0CC9 y `rng_srand` en 0x0CCD (bytes `e8 ca 91` / `e8 ee 91`,
> base 0x81C0 validada con el control positivo `0x0ABD ⇒ CS 0x1D5E kernel_getkey`), en
> `intro_main_controller`, y **los dos únicos caminos al menú de portada pasan por ahí**.
> El quiz se elige con 'C' EN ese menú ⇒ la cadena «semilla 0 en el título ⇒ semilla 0 en
> el primer pick» está cortada por una re-siembra con el reloj de pared.
>
> La propia nota ya declaraba el hueco («**NO medido en el primer pick**»); lo que falló
> fue el censo que lo tapaba. **El cierre runtime de Task F.2 (BP en `pick_virtue`
> `load_seg:0x9a6` + leer la semilla antes del primer rand) deja de ser opcional: es la
> ÚNICA vía que puede sostener o tumbar el bracket seed-0.** Hacerlo en DOS arranques a
> horas distintas (predicción pre-registrada: dos valores distintos en [0,0x0FFF]).
>
> ⚠ Alcance: esto NO invalida la paridad de VALOR dado `(seed, respuestas)`, que es lo
> que mide el grueso de esta nota. Invalida el respaldo de que **el seed del original sea
> 0**, y con él «bracket determinista» como afirmación de FIDELIDAD (sigue siendo cierta
> como descripción del PORT). Consumidor afectado:
> `game/e2e/grandtour/ch01-creation.spec.ts`, cuya cabecera dice «el bracket determinista
> seed-0 re-derivado del binario en `re/verified/gypsy.md`» y que exporta el checkpoint
> que siembra ch02 — el tour no se rompe (el port es autoconsistente), pero esa frase es
> hoy una apelación a fidelidad sin respaldo.
- Contra-medida registrada: navegar a "Journey Onward" (ruta al mundo) deja
  `g_rng_seed=0x9079` porque el bucle del mundo consume RNG — pero eso es
  IRRELEVANTE para la gitana, que corre por "Create New Character" (ruta
  pre-mundo). Por eso el test lee en el título, no tras cargar el mundo.

## ✅ asm-directo (reglas leídas de FONT.OVL/DATA.OVL, con cita)

Todas verificadas byte a byte contra `re/disasm/FONT.OVL.asm` y `DATA.OVL`, y
cruzadas modelo↔clon en verde:

- **Tablas virtud→atributo** STR/DEX/INT (DATA.OVL, mapeo DS+0x10):
  `[0,0,2,0,1,1,1,0]`/`[0,2,0,1,1,0,1,0]`/`[2,0,0,1,0,1,1,0]` — el mapeo canónico
  de Ultima. Releídas del binario en `gypsy_parity.load_virtue_tables`.
- **Bracket 4+2+1 = 7 preguntas** (driver 0x0cd0); cada ronda empareja las
  virtudes vivas; entre rondas se limpia "usada-esta-ronda", "eliminada" persiste.
- **pick_virtue** = `rand_range(0,7)` con rechazo usada/eliminada (0x0998).
- **matchup**: 'A'→gana la virtud de índice menor, 'B'→la mayor; perdedora
  eliminada; la posición A/B es solo presentación (0x0ac6-0x0afb).
- **Puntuación**: la virtud GANADORA suma sus (STR,DEX,INT) a los acumuladores
  (0x0ae3-0x0af7), que parten de la base del registro (INIT.GAM 15/15/15, 0x0ca2).
- **Finalize** (0x0dc8): `INT=acc_int`, `MP=INT`, `DEX=acc_dex`,
  `STR=max(acc_str,20)` (suelo 20 solo en STR).
- **HP/maxHP/exp/level/clase/equipo intactos** de INIT.GAM (la gitana no los toca).
- **Sexo**: 'M'→[+9]=0x0B, 'F'→[+9]=0x0C (0x0be8-0x0c1b); no toca stats.

Vectores fijos (seed 0): all-A → STR20/DEX18/INT22/MP22; all-B → STR20/DEX17/INT18/MP18.
Bracket ronda 1: Valor–Sacrifice · Spirituality–Humility · Honesty–Justice · Compassion–Honor.

## ✅ Nombre y pantalla de creación (cableado)

- **Input de nombre** (FONT 0x0bab-0x0bcc): prompt "By what name shalt thou be
  known?" (DGROUP 0xa06a) → rutina de input `push 0x55a8` (buffer del nombre del
  reg 0), `push 8` (0x0bc8: **máx 8 caracteres**, citado), `call 0x3c58`.
- **Nombre vacío = ABORTA sin guardar** (FONT 0x0bcf: `cmp byte[name],0`;
  `0bd4 jne` continúa, `0bd6 jmp 0xe40` salta al final sin escribir SAVED.GAM).
  El clon lo replica: nombre vacío → `onCancel`, vuelve al título sin partida.
- **Pantalla cableada** (`game/src/ui/creation.ts`, botón "Create New Character"
  del título): nombre → género (M/F) → 7 preguntas con los textos REALES de
  QUESTION.DAT (`game/assets/questions.json`, extractor `parseQuestions`) →
  `applyGypsyCreation`. Par→pregunta vía `questionIndexForPair` (fórmula
  `k=28−(8−i)(7−i)/2+(j−i)`, verificada contra los 28 pares).

## ⚠️ Gaps conocidos

- **Ruta de TRANSFER de Ultima IV** (INTRO.OVL 0x132a, reescala 0x12ea):
  derivada y documentada en `re/notes/gypsy.md`, pero NO portada (el clon no
  importa personajes de U4). Formulada con citas; ⚠️ hasta que exista import U4.
  La muestra "Elwood 20/24/17/17" de drafts previos venía de esta ruta (imposible
  desde el bracket seed-0), no del quiz.
