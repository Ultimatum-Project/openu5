# MAQUETA DE RULING — `ch31-deceit-bolsillos.spec.ts` (el skip que reconoce no tener ruling)

> **ADJUDICADO 2026-07-27: el lead eligió la OPCIÓN C (retirar).** El spec ya no existe; el acta
> vive en `re/notes/acta-ch31-bolsillos-deceit.md` con las coordenadas para recuperarlo (blob
> `9b15c95c`). Este documento se conserva como EXPEDIENTE — el análisis de las cuatro opciones y
> cómo se llegó al ruling. Todo lo que sigue está redactado ANTES de la decisión; léelo como tal.

**Estado original: NO ADJUDICADO. Esto era la maqueta, no la decisión.** El carril de sellos la
preparó; el lead eligió A, B, C o D. Cada opción trae el texto exacto a aplicar, para que
adjudicar fuera decir una letra.

Origen: auditoría de cierre 2026-07-27, §sellos-verdes-en-falso, finding [MEDIA] «describe.skip de
ch31 reconoce en su propio comentario que *el skip permanece sin ruling del lead*».

---

## 1. Qué asertaba (literal, `ch31-deceit-bolsillos.spec.ts:117-139`)

`test.describe.skip("FASE 2b — ch31 bolsillos de Deceit r9/r11 (continuo, veredicto ABIERTO)")`
con **dos** tests:

| test | aserto | qué significa |
|---|---|---|
| «r9 y r11 se abren al conquistar el bolsillo de cima y RESUELVEN limpio» | `for (const n of [9,11]) expect(["VICTORY","DEADEND","DEADEND-STUCK"]).toContain(outcomes[n])` | los DOS objetivos resuelven sin FAIL/THROW. **No fija el veredicto**: VICTORY y DEADEND son ambos verdes |
| «determinismo ×2» | `expect(b.digest).toBe(a.digest)` | el digest de las 10 salas es byte-idéntico bajo `reseed(0)` |

El motor es el **modelo CONTINUO**: `runDeceitBolsillos` entra a Deceit una vez y recorre las 10
salas de `ROOMS` en un **bucle hasta punto fijo** (`while (progress)`), reintentando las que
lanzan. Las 8 primeras son el bolsillo de cima; las 2 últimas (r9 f6(7,5), r11 f7(7,4)) son los
OBJETIVOS.

## 2. Por qué se skipeó (cronología, hashes verificados)

- `6e65b8cc` — nace el spec, «veredicto ABIERTO» por diseño (no se pre-aserta resultado).
- **VENTANA 2026-07-21** — corrido: el bolsillo de cima resuelve limpio (5 VICTORY r4,7,10,12,14
  + 3 DEADEND-fiel r5,6,8) pero **r9 y r11 AMBOS THROW**: `"dungeonDescendTo: sin plan desde
  (7,0,5)"`. Es decir, el aserto del spec **falla**.
- `93efe427` — «ch30/ch31 landing-ready: `test.skip` ANOTADO (PENDIENTE-ARNÉS)». El skip se pone
  para NO aterrizar un rojo, con la lectura de entonces: *«su entrada real es FONDO/foso dedicado,
  a derivar en estático en lote-2»* y *«se REACTIVA en lote-2 con rutas FONDO/ascenso derivadas»*.
- **LOTE-2 resolvió los dos objetivos, pero POR OTRA VÍA y con otro resultado**:
  - **r9 = SIN-ENTRADA-fiel** — `ch33-deceit-r9-seal.spec.ts`, sello geométrico ×2 (cima Y fondo),
    clase VEREDICTO-DE-FIDELIDAD. Hashes: `8bf5c619` / `eafb0422`, derivación `48d4220d` («ni
    FONDO ni ascenso lo abren»). ⇒ **la reactivación prometida es imposible: no hay ruta que
    derivar**.
  - **r11 = VICTORY ×2** — `ch36-deceit-r11-arriba.spec.ts` (`1d82f203`), por la ENTRADA-POR-ARRIBA
    f7(7,3), FRESCA desde la cima. Y ch36 **explica el THROW de ch31**: no era falta de ruta, era
    el **ORDEN del fixpoint** — ch31 ataca r11 la última, con la party ya VARADA en el bolsillo
    f7{(1,4),(1,5)} tras conquistar r12/r14.
- `da10ef32` (barrido-stale) — se anota el bloque `[HISTÓRICO 2026-07-25: superado …]` que termina
  con la frase que disparó el finding: **«El skip permanece sin ruling del lead.»**

## 3. El estado contradictorio, exacto

El comentario de encima dice **superado, no se reactiva**; el título del describe, dos líneas
abajo, sigue diciendo **«veredicto ABIERTO»**. Mismo bloque, dos estados. (Es el mismo género de
fleco que el título de ch34, anotado hoy en su cabecera.)

## 4. Cobertura única HOY: **cero salas**

Comprobado fichero contra fichero, no de memoria:

- Las **8 salas del bolsillo de cima** de `ch31:ROOMS` (r4 f5(1,1) east · r5 f5(1,5) north ·
  r6 f5(7,3) south · r7 f5(7,7) west · r8 f6(4,3) south · r10 f7(1,3) north · r12 f7(0,4) west ·
  r14 f7(0,5) west) están en `ch20-salas-deceit.spec.ts:39-49` con **celda y `approachDir`
  idénticos**. El propio ch31 lo dice: «DEDUP: re-confirmación de la pasada-1 ch20, NO salas
  nuevas».
- **r9** → cubierta y SELLADA por ch33. **r11** → cubierta por ch36.

Lo único que ch31 tiene en exclusiva es el **modelo continuo con fixpoint sobre Deceit** — y lo que
ese modelo produce sobre r9/r11 es precisamente el artefacto (party varada) que ch36 ya diagnosticó
y documentó.

## 5. Consecuencia dura: reactivar HOY sale ROJO

No es una hipótesis. Con el arnés tal cual, r9/r11 vuelven a THROW (r9 porque no hay ruta —ch33 lo
selló—; r11 por el orden del fixpoint), y `THROW:…` no está en `["VICTORY","DEADEND",
"DEADEND-STUCK"]`. **Y el rojo sería correcto**: el spec afirma algo que hoy sabemos falso («r9 y
r11 se abren al conquistar el bolsillo de cima»). Tocar el aserto para que pase verde sería
re-baselinear un DETECTOR contra el port — prohibido por el RULING 07-26.

---

## 6. Opciones

### A · RE-ACTIVAR tal cual (quitar el `.skip`)
- **A favor**: nada queda dormido; el tour vuelve a ejercitar el modelo continuo sobre Deceit.
- **En contra**: **rojo garantizado y permanente** por §5. Aterriza una regresión falsa en el tour.
  Además cuesta caro: dos tests de `chapterTimeout(900_000)`, el segundo con DOS pasadas completas.
- **Veredicto**: descartable sin más análisis.

### B · RE-CLASIFICAR: sigue skipeado, pero deja de mentir en el título
Mantener `test.describe.skip`, re-titular y cerrar el bloque de comentario con un ruling explícito.
- **A favor**: coste ~cero; el acta se queda donde la buscará quien llegue a ch31; reversible; es
  lo que ya se hizo con `ch37-wrong-campos` y `shell-theme` (los dos skips que la auditoría dio por
  BUENOS).
- **En contra**: ch37-wrong-campos y shell-theme cumplen el estándar de *skip-anotado* porque tienen
  **condición de salida** («quitar el skip solo con presupuesto de CI dedicado», «si el usuario
  decide…»). **ch31 no puede tener condición de salida: está superado, no aplazado.** Deja código
  muerto que `tsc:e2e` sigue compilando ⇒ cada cambio de firma de `conquerRoomAt`/`nav.ts` obliga a
  mantener un fichero que nunca corre (y que nadie valida al mantener).
- **Texto exacto si el lead elige B**:
  ```ts
  // RULING <fecha>: ACTA HISTÓRICA. No se reactiva — no hay condición de salida: r9 quedó
  // SIN-ENTRADA-fiel (ch33, sello geométrico ×2) y r11 VICTORY por la entrada-de-arriba (ch36).
  // El THROW de esta corrida era el ORDEN del fixpoint (party varada en f7{(1,4),(1,5)}), no
  // falta de ruta — diagnosticado en la cabecera de ch36. Se conserva como acta del hallazgo
  // «bolsillos aislados NO se abren por top-continuo» (converge con ch30, ver #13).
  test.describe.skip(
    "FASE 2b — ch31 bolsillos de Deceit r9/r11 — ACTA HISTÓRICA (SUPERADA por ch33/ch36, no se reactiva)",
    () => {
  ```
  (y borrar «veredicto ABIERTO» del título, que es la mentira concreta que reportó la auditoría).

### C · RETIRAR el fichero (borrarlo), trasladando el acta a `re/notes`
- **A favor**: cobertura única = **cero** (§4); no hay condición de reactivación; se acaba el código
  muerto que compila; `git` conserva el fichero entero (`6e65b8cc`, `93efe427`) y el acta sustantiva
  ya vive **por duplicado** en sitios que sí se leen: la cabecera de ch36 (con el diagnóstico *más
  preciso*, el del bolsillo f7{(1,4),(1,5)}), el sello de ch33, la memoria
  `isolated-pockets-need-fondo-not-top-continuo` y `docs/guias/doom/CENSO-COMBATMAPS.md`.
- **En contra**: borra un acta buscable con `grep` en el árbol vivo; el repo tiene cultura de no
  borrar derivación. Si alguien re-abre el modelo continuo sobre Deceit tendrá que rescatar del
  historial. Y es irreversible en la práctica (nadie mira el reflog meses después).
- **Requisito si el lead elige C**: que el borrado vaya en el MISMO commit que una nota
  `re/notes/acta-ch31-bolsillos-deceit.md` con los §1-§5 de aquí y el hash del fichero borrado.

### D · RE-PROPÓSITO: convertirlo en CAPACIDAD-DE-ARNÉS que FIJA la limitación conocida
En vez de asertar que r9/r11 resuelven, asertar lo contrario: que bajo el modelo top-continuo
r9/r11 **THROW con `sin plan`** y que el bolsillo de cima da 5V+3D. Pasa de rojo-permanente a
verde-que-guarda-un-hallazgo (el de #13: «los bolsillos aislados NO se abren por top-continuo»).
- **A favor**: es la única opción que le devuelve un trabajo real; el hallazgo #13 pasaría a estar
  vigilado por un test y no solo por prosa.
- **En contra**: **carísimo** — dos corridas completas del fixpoint (900 s de presupuesto ×2) para
  vigilar un hallazgo ya sellado por otras vías; y fija comportamiento del ARNÉS que lote-2
  superó, así que cualquier mejora futura del pather lo pondría rojo por avanzar. Sería el único
  spec del tour que se rompe cuando el arnés MEJORA.
- **Veredicto**: honesto pero mal cambio de coste; solo si el lead quiere blindar #13 en runtime.

---

## 7. Recomendación del carril (razonada, no ejecutada)

**C, con B como caída si el lead prefiere no borrar.**

El argumento decisivo no es la limpieza, es el estándar que la propia auditoría fijó al ABSOLVER
los otros dos skips duros: un skip es aceptable cuando lleva **razón + condición de salida**.
ch31 tiene razón pero **no puede tener condición de salida** — no está aplazado, está superado, y
lo está por un sello (ch33) que dice que la ruta que este spec esperaba **no existe**. Un test que
nunca podrá volver a correr no es un test dormido: es un documento con `import`s. Y como documento
está peor escrito que su sustituto — el diagnóstico bueno del THROW (el orden del fixpoint, la
party varada en f7{(1,4),(1,5)}) está en la cabecera de **ch36**, no aquí.

Contra C solo pesa la cultura de no borrar derivación; por eso la condición que pongo es que el
borrado no viaje solo, sino con el acta en `re/notes` en el mismo commit. Si aun así el lead
prefiere el árbol vivo, **B es correcta y barata** y arregla lo que la auditoría reportó de verdad
(el título que dice «veredicto ABIERTO» sobre un veredicto cerrado). Lo que **no** debe pasar es
que se quede como está: hoy el fichero afirma dos cosas incompatibles a dos líneas de distancia.

**Lo que el carril NO ha tocado**: ni el `.skip`, ni el título, ni un solo aserto de ch31. Está
exactamente como lo dejó `da10ef32`.
