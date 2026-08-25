# UNA sola causa detrás de #64, #74, #65 y Wrong r1 — y mi fix NO la arregla

Encargo (a): adjudicar la anomalía de `ch23` y el flip de `r10` (#74) desde
`resello2-telemetria.jsonl`. **Sin ventana, lectura pura.** El resultado va mucho más allá del
encargo, e incluye **una corrección a lo que yo mismo afirmé**.

## 0. Precisión de nomenclatura

El encargo dice «ch23/r10 (#74)». Son dos cosas distintas y las trato por separado:
**`#74` = `cm74` = Covetous r10 = `ch24`** (Wrong es base 48; Covetous base 64). La anomalía de
metraje era de **`ch23` = Wrong**. Adjudico las dos.

## 1. Método: identificar episodios por HUELLA de celdas iniciales

Igual que en `#125`: se casan las `enemyCells` de la ronda 1 contra las unidades-enemigo del `.CBT`.
**Las tres repeticiones de cada capítulo son byte-idénticas**, lo que da control gratuito.
Para no contaminar con el combate siguiente, cada episodio se **recorta** en el primer punto donde
el conteo SUBE (eso ya pertenece al combate siguiente).

## 2. Lo medido

| sala | rondas propias | enemigos | bajas | veredicto |
|---|---|---|---|---|
| **cm64 = r0 Covetous (`#64`)** | 188 | 5→5 | **0** | DEADEND |
| **cm74 = r10 Covetous (`#74`)** | 188 | 8→8 | **0** | DEADEND |
| **cm49 = r1 Wrong (ch23)** | 181 | 3→3 | **0** | DEADEND |
| cm71 = r7 Covetous | 12 | 16→**0** | 16 | **VICTORY** |
| cm72 = r8 | 22 | 11→**0** | 11 | **VICTORY** |
| cm73 = r9 | 34 | 6→**0** | 6 | **VICTORY** |

**Victorias de `ch24` en el resello-2 = exactamente `[7,8,9]` = EL BASELINE SELLADO.**

### ⇒ Adjudicación de los dos flips: NO REPRODUCEN

`#64` (r0) y `#74` (r10) salieron VICTORY en el **resello-1** y aquí, en el run definitivo **con
telemetría y ×3 determinista**, dan **0 bajas en 188 rondas**. **Los dos flips eran transitorios y
no reproducen.** El digest vuelve al sello. Y de paso **se resuelve el 3-contra-3 de r0**: en el run
definitivo `ch24` y `ch24b` **coinciden** (ambos DEADEND) — el outlier era la pasada-1.

### ⇒ Adjudicación de la anomalía de ch23: es ATASCO, no huida temprana

Mi propio discriminador, contestado: **181 rondas con 0 bajas** no es «la party intenta, no alcanza
y huye pronto». Es un **atasco largo**. El guard lo confirma: en `cm64` el contador `stuck` sube
hasta **60** (su tope) y ahí para — **no** se agota `maxRounds` (600).

## 3. ★ LA CAUSA ÚNICA — y es nuestra

Composición del roster (tras mi fix) de cada sala:

| sala | roster | placeholders 0-stats |
|---|---|---|
| cm64 r0 | 4 `Whirpool1/x` + 1 Ghost | **4/5** |
| cm74 r10 | 5 `Whirpool1/x` + 2 Ghost + 1 Skeleton | **5/8** |
| cm49 r1 Wrong | 3 `Whirpool1/x` | **3/3** |
| cm65 r1 (`#65`) | 6 `Whirpool1/x` + 1 Ghost | **6/7** |
| **cm71 r7 (VICTORY 12 rondas)** | **16 Ghost** | **0/16** |

**El contraste es perfecto: TODA sala con remolinos se atasca; la única sin ellos gana en 12
rondas.** `Whirpool1/x` (i=43) tiene **stats todo a cero** y `ActivelyAttacks: false`: no se le
puede matar ni ataca. Como el veredicto se calcula con `enemiesAlive === 0`, **esa condición es
inalcanzable por construcción** ⇒ el resolvedor no progresa ⇒ `stuck` llega a 60 ⇒ **DEADEND por
CONTABILIDAD**.

⇒ **`#65`, `#64`, `#74` y Wrong r1 son EL MISMO DEFECTO DEL CORE.** No son cuatro adjudicaciones:
es una.

## 4. ⚠ CORRECCIÓN: mi fix del roster NO los arregla

Dije —y está en el ledger como «el flip esperado del lote»— que con el fix «los 6 remolinos de #65
salen del roster ⇒ 1 enemigo real ⇒ la sala pasa a ser ganable». **Es FALSO.**

`isArenaObjectSprite` excluye `<0x40`, familia `0xb4` y familia `0xe8`. **El remolino base es el
sprite 236 = familia `0xec`**, que **no** está en la lista — y además **pasa el `% 4`**
(`(236−64) % 4 = 0`). Medido: **84 «enemigos» placeholder siguen entrando al roster tras mi fix**, y
**4 salas quedan con un roster 100% placeholder** (cm49, cm50, cm68, cm69) = DEADEND permanente por
construcción.

**Ninguna de las cuatro salas se arregla con el lote tal como está.**

## 5. Y sin embargo, la salida SÍ está derivada

El argumento que faltaba lo da la rutina que ya leí entera: para la familia `0xec`, **DNGLOOK
`0x12ea-0x12fc` SUSTITUYE el índice** (`si`) por la lectura de la tabla local. Es decir:

> **El original NO usa el índice 43 para estos sprites — lo sobrescribe.** Sea cual sea el valor de
> esa tabla, **no es `(sprite−0x40)>>2`**. El port calcula 43 y lo usa, que es exactamente lo que el
> binario se molesta en NO hacer.

⇒ **«El remolino no es el enemigo 43» está DERIVADO**, aunque «qué es» siga sin estarlo. Excluir la
familia `0xec` del roster es **más fiel que dejarla como enemigo 43**, y arregla las 4 salas más
`#65`. Es un cambio de una línea sobre el fix ya escrito.

**NO lo aplico**: hay congelación de aterrizaje y el lote está cerrado con el lead. Queda como
**propuesta** para que la decida él.

## 6. Lo que esto NO dice

- **No** identifica qué coloca el original para `0xec` (sigue el residual de la tabla sin
  inicializar y su probe de oráculo).
- **No** convierte los DEADEND en VICTORY por sí solo: quitar los remolinos deja rosters reales
  (Ghost/Skeleton) que hay que jugar. Lo único derivado es que **el tablero de hoy está mal
  poblado**, no cuál será el veredicto con el tablero correcto.
- **No** toca `#125` ni `#103`, cuyos rosters no tienen placeholders.

---

## FIX ESCRITO (GO del lead) — en rama, aterrizaje CONGELADO

`combat.ts`: corte propio para la familia `0xEC` en el bucle de unidades, con el punto de
sustitución **aislado** en `Combat.ecFamilyEnemyIndex(sprite)`, que hoy devuelve `null`.

**Por qué un corte propio y no ampliar la lista de objetos**: lo derivado NO es «el remolino es
un objeto» — es «**el original NO usa el índice 43 para esta familia, lo SUSTITUYE**»
(`DNGLOOK 0x12e5-0x12fc`). Meterlo en `isArenaObjectSprite` habría mezclado dos derivaciones
distintas y perdido esa distinción. El corte separado la conserva y **deja el hueco exacto** donde
irá la respuesta del oráculo.

**Cuando el oráculo responda** (probe en `re/notes/0xec-basura-de-pila-origen.md`, BP en f-off
`0x12f7`): se toca **ese único método** — devolver el índice real o mapear `sprite & 3` a la tabla
medida. Una línea, no una re-excavación.

### Guardas (`tests/cbt-unit-classification.test.ts`, 15/15)

- el sprite base **236 pasa el `%4` y no es objeto** — prueba de por qué hacía falta el corte;
- **las 4 salas 100 % placeholder quedan sin combatientes fantasma** (cm49, cm50, cm68, cm69);
- **NO-REGRESIÓN de cm71**: sus **16 Ghost siguen intactos** (la sala que sí se gana);
- las mixtas pierden **sólo** los remolinos: cm64 → 1 (Ghost), cm65 → 1 (Ghost), cm74 → 3;
- y una guarda de que el punto de sustitución sigue **aislado y citado**.

### Gates

`tsc` **EXIT=0** · **10 ficheros / 129 tests VERDES** (bloque de combate/salas + las guardas).

### ⚠ Límite, repetido aquí porque es fácil de olvidar al ver el verde

**Quitar los remolinos NO convierte esos DEADEND en VICTORY.** Quedan rosters reales (Ghost,
Skeleton) que hay que **jugar**. Lo derivado es que **el tablero de hoy está mal poblado**; el
veredicto con el tablero correcto **se re-adjudica corriendo**, no suponiendo — y eso ocurre
cuando el lote aterrice, no antes.

### Cola de aterrizaje (decisión del lead)

Congelado hasta que la cadena del espejo cierre `part24`. Va **junto** a `#17` (extractor `(0,0)`)
y `#18` (knob de escenas): **los tres tocan determinismo** ⇒ un solo re-sello de baselines, no tres.

---

## RE-ADJUDICACIÓN sobre el árbol de 2026-08-16 (carril cabos-353, tras aterrizar #353)

Los veredictos de arriba estaban doblemente pendientes: por el roster `0xEC` (la
sustitución del pool aterrizó después de esta nota — `dnglook-117e-body.md`,
`rollEcGroupPool` en `combat.ts`) y porque la siembra de #353 (main `ef914dd9`) movió el
stream RNG de estas salas (`siembra-objetos-cbt-353.md` §6). Veredicto por afirmación,
re-medido (réplica Python del rand_range validada con control positivo contra los
esperados sellados de cm25, y tests en `siembra-objetos-cbt-353.test.ts` §cabo cm64/cm65):

1. **§2 (los flips #64/#74 no reproducen; ch23 es atasco, no huida) — EN PIE.** Son
   adjudicaciones de AQUELLAS corridas (resello-1/2), no del árbol: nada de hoy las toca.
2. **§3 (causa única = placeholder incontabilizable) — EN PIE como diagnóstico del árbol
   VIEJO, y el mecanismo ya NO puede construirse en el de hoy**: la familia `0xEC` entra
   al roster por `pool[tile&3]` sobre la tabla `DATA.OVL 0x386e` = enemigos REALES.
   MEDIDO (seed 0x1234): cm64 = 11 enemigos (4×GiantRat + 6×Slime + Ghost), cm65 = 13,
   cero índice-43, todo HP>0 — y con CUALQUIER seed el roster sale del conjunto
   {20,21,22,24,31,33,34} ∪ {Ghost 23} (test de barrido de seeds).
3. **La tabla de composición de §3 queda SUPERADA POR PARTIDA DOBLE**: además del
   placeholder, el filtro viejo TIRABA EN SILENCIO la mitad `0xed` de la familia por el
   resto `%4`. Composición real de familia (volcado): cm64 = **10** (0xec×4 + 0xed×6), no
   4; cm65 = **12** (6+6), no 6; cm74 = **10** (5+5), no 5. Los rosters de hoy son MÁS
   GRANDES que los que esta nota midió: cm64 5→11, cm65 7→13, cm74 8→13.
4. **§4 («mi fix NO los arregla») y la propuesta de §5 (EXCLUIR la familia) — SUPERADAS**:
   la decisión final no fue excluir sino SUSTITUIR (el mecanismo derivado después). Las
   «4 salas 100 % placeholder» (cm49/50/68/69) no quedan vacías: su bando enemigo ENTERO
   sale del pool (guardas en `cbt-unit-classification.test.ts`).
5. **Los DEADEND de cm64/cm74/cm49 (y el #65 de cm65) quedan VACANTES, no volteados**:
   se midieron sobre OTRO tablero y OTRO stream (#353 añade 4 rands de siembra en el
   registro 48 y 1 en el 49, y la familia restaurada consume 10/12 rands de velocidad
   donde antes 4/6). El veredicto con el tablero correcto exige una corrida NUEVA de la
   cadena del espejo (arnés de ese carril, no de éste); sus baselines pre-#353 están
   caducados por declaración y los banners de los specs afectados (ch24b/ch32/ch37b/ch47)
   se corrigen en este mismo commit — la premisa «pila sin inicializar» que aún citaban
   está refutada por cuerpo.
6. **§6-residual («no identifica qué coloca el original para 0xec») — RESUELTO fuera**:
   lo identifica `dnglook-117e-body.md` (pool de 4 tiradas contra `DS 0x385e`); el probe
   de oráculo de `0xec-basura-de-pila-origen.md` quedó sin objeto.
