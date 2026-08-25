# FASE 3h — RESULTADO: el plegado es SEGURO y casi INERTE, y la guarda se ganó el sueldo

> Ejecución del pre-registro `espejo-3h-prerregistro.md` (commit e0052f74, fijado ANTES de medir).
> Censo de clases cerrado en 6ca19f63, también antes. Rama `espejo/3h-ocr-tardio`. 2026-07-27.
> 100% offline, sellados intactos, cero playwright.

---

## 0. VEREDICTO

**FRACASO contra P1** (0,6% frente a la banda 5-15%), con las otras tres predicciones **en
verde**: el canario no se movió, no hay colisiones nuevas y no hay ni un match fabricado.

> ## ⛔ ERRATA (2026-07-28) — EL «HALLAZGO MULTIPLICATIVO» DE ESTA ACTA ESTÁ **REFUTADO**
>
> La corrida #45 (`corrida-45-resultado.md`, main @f9b1e633) midió la palanca
> **apples-to-apples** sobre material REAL —mismo replay, mismas rutas, lo único que cambia es el
> perfil— con el verbo de transporte ya aterrizado en main:
>
> | perfil | conf | matched / comparable |
> |---|---|---|
> | `lp1` (sin plegado) | 13,7 % | **422** / 3 091 |
> | `lp1-tardío` (con plegado 3h) | 15,8 % | **423** / 2 676 |
>
> **El numerador se mueve +1 en diez partes**, no +203. La subida de 2,1 puntos es **enteramente
> encogimiento del denominador**. ⇒ **`lp1-tardío` se acredita como LIMPIADOR DE DENOMINADOR, no
> de numerador**, y la frase «las dos palancas son multiplicativas» **no debe citarse**.
>
> **POR QUÉ ME SALIÓ +203 — el defecto es mío y es instructivo.** El brazo «CON verbo» de §2 no
> usaba salida real del port: **inyectaba una línea ideal por CADA eco del LP**, o sea asumía que
> el port había dado **todos** los pasos del LP. Pero mi propio hallazgo de 3f dice que el arnés
> conduce el **21,8%** del movimiento — así que el brazo D medía «plegado + replay perfecto», no
> el plegado. Lo etiqueté «TECHO» en el docstring de la herramienta y **aun así ascendí el número
> a titular de mecanismo** («son multiplicativas») en el acta, el commit, la tarjeta y el reporte
> al lead, sin arrastrar el caveat. Es el género que este mismo carril lleva catalogando:
> **una cota superior promovida a afirmación causal**. La medición era correcta sobre su material;
> la extrapolación no.
>
> Lo que de esta acta SIGUE EN PIE: el FRACASO contra P1, el canario limpio (numerador 125→125),
> las 0 colisiones, los 0 matches con transcript vacío, y el veredicto de la guarda sobre `g→s`.
> Lo que CAE: §0 «multiplicativas», la tabla 2×2 de §2 como evidencia de mecanismo, y el ≈2,1%
> como expectativa para #45 (que además resultó **no medible**: la re-segmentación de #77 cambió
> la unidad de bloque — 4 413 frente a 21 891).

~~Y el hallazgo que ordena la cola: **las dos palancas (verbo de transporte y plegado del OCR) son
MULTIPLICATIVAS, no aditivas** — ninguna funciona sola, y juntas dan 2,1%. Ninguna de las dos es
acreditable sobre el material congelado.~~ **(REFUTADO — ver la errata de arriba.)**

## 1. LOS NÚMEROS

### 1.1 P1 — `part09-18` (banda pre-registrada 5-15%)

| perfil | conformidad |
|---|---|
| identidad `lp1` (antes de 3f) | 0,5% (80/15 236) |
| **ANTES** = `lp1-3f` (lo que hay en main) | 0,6% (80/13 627) |
| **DESPUÉS** = `lp1-tardío` | **0,6% (88/13 626)** |

**Δ = +0,1 puntos. Numerador 80 → 88 (+8 bloques en 13 626.)**

⚠ **Defecto de instrumento cazado en la primera corrida**: `LP1_TARDIO_PROFILE` extiende el
perfil de 3f, así que comparar contra la identidad mezclaba DOS palancas y el canario «fallaba»
por +0,69 puntos… **con el numerador intacto (125→125)**. La subida era denominador de 3f, no
fabricación de 3h. Línea base corregida al estado inmediatamente anterior, como
`AD_PRE3C_PROFILE`.

### 1.2 P3 — CANARIO `part01-06`

| | |
|---|---|
| material disponible | **part04, part05 — 2 de las 6 previstas** |
| ANTES | 20,1% (125/621) |
| DESPUÉS | 20,2% (125/619) |
| **Δ** | **+0,07 puntos** (umbral de fracaso: 0,5) ⇒ **OK** |

**El numerador del canario NO se movió: 125 → 125.** Sobre OCR limpio el plegado no fabricó ni
un match. Es la evidencia más fuerte de que las clases aceptadas son seguras.
**Cobertura declarada**: sólo existen offline part04 y part05 (`.espejo-3c-lp1`); un canario
completo exigiría material que no está y que sólo se obtiene con ventana de replay.

### 1.3 Guardas duras

- **Colisiones nuevas** introducidas por el conjunto aceptado: **0** (censo cerrado antes de medir).
- **Auto-absolución PROBADA** (match con transcript del port VACÍO): **0** en las 18 partes.
- **Simetría (P4)**: por construcción — `collapseWith` se aplica a los dos lados del diff.

## 2. ~~★ EL HALLAZGO: LAS DOS PALANCAS SON MULTIPLICATIVAS~~ — **REFUTADO, ver la errata de §0**

> ⛔ **Esta sección entera es una COTA SUPERIOR, no un mecanismo.** El brazo «CON verbo» inyecta
> una línea ideal por cada eco del LP, es decir asume un replay perfecto; con salida real del port
> la palanca aporta **+1 match**, no +203 (corrida #45). Se conserva el texto para que el error
> sea auditable, pero **nada de aquí se cita como hallazgo**.

Diseño factorial 2×2 sobre `part09-18` (el «CON verbo» inyecta la línea que el port arreglado
emitiría, ya que los transcripts son ANTERIORES al fix del verbo):

| | sin verbo | CON verbo |
|---|---|---|
| **sin plegado** (3f) | 0,6% — 80 | 0,7% — 89 |
| **con plegado** (3h) | 0,6% — 88 | **2,1% — 283** |

El verbo solo aporta **+9** matches. El plegado solo aporta **+8**. **Juntos aportan +203.**

La razón es mecánica y quedó verificada: los transcripts sellados son de un port que **todavía no
imprimía el verbo**, así que un bloque «F]v Nvrth» no puede casar contra «North» por mucho que se
pliegue la ortografía — falta la palabra. Y con el verbo pero sin plegado, «F]v Nvrth» tampoco
casa «Fly North», porque `fivnvrth ≠ fiynorth`. **Cada palanca desbloquea a la otra.**

**Consecuencia para la cola: 3h NO era la precondición que yo mismo diagnostiqué.** La
precondición de acreditar CUALQUIERA de las dos es **una corrida nueva del replay con el fix del
verbo ya aterrizado** — y eso es ventana de playwright, no trabajo offline. La estimación honesta
para esa corrida es **≈2,1%**, no 5-15%.

## 3. ★ LO QUE COSTÓ LA GUARDA — y por qué es exactamente lo que debía costar

| brazo | conformidad `part09-18` |
|---|---|
| 3h aceptado + verbo | 2,1% (283/13 626) |
| **3h + `g→s` (RECHAZADA) + verbo** | **11,6% (1 579/13 627)** |

Con `g→s` la fase **habría caído dentro de la banda pre-registrada**. `g→s` es la clase que hace
falta para casi todos los rumbos del corpus (`Eagt`=East, `Wegt`=West, `gouth`=South), y es
justamente la que la guarda rechaza porque colapsa **`"\nSold!\n"` ≡ `"{} gold!"`** (y `"G:"` ≡
`"S\n\n"`): en una tienda, un bloque «Sold!» del LP podría casar contra un «5 gold!» que el port
dijo por otra razón.

**Este es el escenario para el que existía la guarda**: la clase que sube el número es la
insegura. Si el censo se hubiera cerrado DESPUÉS de medir —el orden que el lead corrigió— habría
visto 11,6%, habría estado dentro de la banda, y la tentación de conservar `g→s` habría sido
enorme. **No se reabre**: reabrirlo ahora, habiendo visto el 11,6%, es exactamente la
contaminación que el orden de operaciones existe para impedir.

Queda como **propuesta para una fase futura, con su propio pre-registro y su propia guarda**: una
variante ESTRECHA de `g→s` (por ejemplo, plegar la `g` sólo cuando no hay dígitos en el bloque,
que es lo que distingue «Sold!» de «{} gold!»). No se decide aquí.

## 4. ADJUDICACIÓN CONTRA EL PRE-REGISTRO

| predicción | resultado | veredicto |
|---|---|---|
| **P1** `part09-18` → banda 5-15% | **0,6%** | ✗ **FRACASO** (por debajo incluso del umbral del 2%) |
| **P2** numerador sube, auditable clase a clase | +8, todo de clases aceptadas | ✓ |
| **P3** canario `part01-06` ≤ 0,5 puntos | **+0,07** (numerador 125→125) | ✓ |
| **P4** simetría del plegado | por construcción | ✓ |
| AA sospechada > 25% | 0,6% | no aplica |
| AA **probada** (match con transcript vacío) | **0** | ✓ limpio |

Y sobre la aritmética del pre-registro: el ancla baja calculada era 7,0% suponiendo que se
recuperaban los ecos con verbo «al ritmo ya visto» del 29,2%. **Ese 29,2% se había obtenido con
`g→s`**, que la guarda rechazó — lo cual estaba declarado en el commit del censo antes de medir.
Con el conjunto seguro, el ritmo real sobre los mismos ecos es mucho menor, y el ancla baja se
queda en la zona del 2%. **La predicción no falló por optimismo: falló porque su insumo venía de
una clase que la guarda tumbó.**

## 5. QUÉ QUEDA

1. **La precondición real es una corrida nueva del replay** con el fix del verbo en main. Sólo
   ahí se pueden acreditar juntas las dos palancas (≈2,1% esperado).
2. **La DERIVA sigue intacta** y sigue siendo la causa dominante: el arnés conduce el 21,8% del
   movimiento que el LP jugó (3f §4.2). Ni 3h ni el verbo la tocan.
3. **Variante estrecha de `g→s`**, si el lead la quiere, como fase propia pre-registrada.
4. **Canario completo** (part01-03, part06) si alguna vez hay material.

**Aterrizable de esta fase**: la guarda de colisiones (instrumento reutilizable por cualquier
recalibración futura), el perfil `lp1-tardío` (seguro, inerte hoy, útil tras la corrida nueva) y
estas actas. `LP1_PROFILE` queda INTACTO.
