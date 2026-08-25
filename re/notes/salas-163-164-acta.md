# ACTA — #163 (bisect ch26) + #164 (movimiento silencioso en salas) · 2026-07-29

> Carril `salas-163-164`, rama `e2e/salas-163-164` desde `main` **0712b5ca**, worktree propio,
> retenida (aterriza el lead). Mutex de e2e en mano. Puerto **5254**, cache dir propio.
> Continuación de la ventana #161 (`re/notes/resello-e2e-acta.md`).

**Titular: #163 NO se re-sella — PARO CON SEÑA.** El bisect pinnea el commit, pero lo que
encontró no es un flip de veredicto: son **dos salas que dejaron de poder resolverse**.
**#164 sí cierra**, y con un defecto de instrumento más grave que el que la abrió.

---

## §1 — #163: el mover de ch26 está PINNEADO, y el hallazgo es otro

Una sola sonda lo cerró (`13b46ee6`, el commit de la familia 0xEC), porque el punto anterior
ya estaba medido en la ventana #161.

| commit | digest de ch26 (Hythloth) | recuento |
|---|---|---|
| `eefb8de3` (índice 90, ANTES del 0xEC) | `0:V 1:D 2:V **3:V** **4:D** **5:D** 6:mur 7:V 8:V 9:V 10:V **11:V** 12:mur **13:V** 14:V 15:V` | 11V · 3D · 2mur · **0 THROW** |
| `13b46ee6` (índice 91) | `0:V 1:D 2:V **3:D** **4:THROW** **5:THROW** 6:mur 7:V 8:V 9:V 10:V **11:D** 12:mur **13:D** 14:V 15:V` | 8V · 4D · **2 THROW** · 2mur |
| **HEAD** (`0712b5ca`) | **idéntico a 13b46ee6, carácter a carácter** | idem |

⇒ **`13b46ee6` movió CINCO salas de ch26 de un golpe**, no una. Y el sello commiteado del spec
(9V/5D, r13 en DEADEND) **no coincide con ninguno de los dos**: es un tercer estado, más viejo
todavía.

### 1.1 ★ Por qué esto NO se re-sella: dos salas pasaron a THROW

r4 y r5 no cambiaron de veredicto — **dejaron de tener veredicto**. El mensaje, completo:

```
dungeonDescendTo: el resolvedor de combate se atascó      (nav.ts:3075)
```

Lo lanza `nav.ts` cuando `resolveArenaCombat(page)` devuelve `false`. Y el arnés **sí tiene**
un código para «sala sellada e irresoluble, sin huida»: es `DEADEND-STUCK`, y no es esto. Un
THROW es el arnés incapaz de terminar la pelea.

La cabecera del propio ch26 lo dice sin ambigüedad:

> «la cola “DURA/PENDIENTE” está CERRADA — Fase 2b terminada, 112/112 selladas;
> **un THROW residual hoy sería regresión, no pendiente**.»

### 1.2 Adjudicación contra el marco pre-registrado del lead

El marco dice: *commit derivado ⇒ re-sello citando SU derivación; commit sin derivación ⇒
posible regresión, parar con seña.* Aquí el commit **sí es derivado** (`13b46ee6`, #54 pieza 14,
con su cita DNGLOOK) — pero el marco presupone que el efecto es **un veredicto que se mueve**,
y este efecto **no es un veredicto**. Sellar `4:THROW|5:THROW` como baseline sería fijar un
estado en el que el arnés no funciona, y perder la señal para siempre.

⇒ **`ch26` se queda ROJO y SIN TOCAR.** Ni el flip de r3, ni los de r11/r13, ni los THROW.
La casilla que le corresponde no está en el marco; la propongo abajo.

### 1.3 Lo que sí queda establecido de #163

- El mover **está pinneado**: `13b46ee6`, sin ambigüedad (90 limpio, 91 con las cinco).
- Es **el mismo commit** que liberó Shame r14 en la ventana #161, con el signo que le impone el
  modelo: en censo POR SALA más enemigos reales = una sala más ganable; en **cadena CONTINUA**
  = más peleas reales en ruta = desgaste = salas que caen. Mecanismo único, dos signos.
- **Lo que el mecanismo NO explica es el THROW.** Que una sala se gane menos por desgaste es el
  modelo funcionando; que el resolvedor **se atasque** es otra cosa, y es lo que hay que mirar.

### 1.4 Pregunta acotada para quien lo coja (no la contesto aquí)

¿Por qué `resolveArenaCombat` devuelve `false` en cm100/cm101 (Hythloth r4/r5) con el roster
0xEC resuelto a enemigos reales? Dos hipótesis, distinguibles y baratas:
**(a)** el roster nuevo incluye alguna unidad inalcanzable/inmatable por el resolvedor (mismo
patrón que el DEADEND-por-contabilidad, pero ahora dentro del resolvedor); **(b)** el resolvedor
agota su presupuesto de rondas porque la pelea es más larga. Se separan mirando si quedan
enemigos vivos al agotarse, o subiendo `maxRounds` en una sonda.

---

## §2 — #164: la auditoría encuentra un defecto MAYOR que el que la abrió

La tarjeta buscaba movimiento silencioso por el canal RESEAL (artefactos reescritos en verde).
Lo que hay es peor y más simple: **dos specs no comprueban qué sala gana.**

### 2.1 Censo de cobertura de aserción (análisis estático, coste cero)

| spec | qué aserta | ¿ve un flip VICTORY↔DEADEND? |
|---|---|---|
| ch20 Deceit | pertenencia al conjunto `{VICTORY,DEADEND,DEADEND-STUCK}` + **recuento** | **NO** |
| ch27 Doom | pertenencia a `{VICTORY,DEADEND}` + **recuento** + `game-won=false` | **NO** |
| ch22 Destard | arrays `victories` / `deadends` explícitos | sí |
| ch23 Wrong | `expect(outcomes[n])` sala por sala | sí |
| ch24 Covetous | arrays `victories` / `deadends` explícitos | sí |
| ch21 Despise | censo (Despise no tiene salas) | n/a |

★ **Y el test de «determinismo ×2» no tapaba el hueco**: compara `b.digest` con `a.digest`,
las **dos pasadas de la MISMA corrida**. Prueba determinismo, **no** estabilidad contra un
sello. O sea que ch20 y ch27 no tenían NINGUNA comparación contra un baseline.

### 2.2 Lo que estaba escondido: ch20 r14, prosa contra medida

El propio ch20 documenta en su bloque de re-sello que **la sala 14 pasó a `DEADEND-STUCK`**.
Medida de hoy: **`14:VICTORY`**. Y no es reciente — es VICTORY también en `ffe5ba19` (24-07),
que es el **suelo del instrumento** (por debajo el arnés llama a `ds.wandererAt`, ausente del
core viejo).

⇒ el paso `DEADEND-STUCK → VICTORY` es **anterior a la ventana medible** y queda **SIN
ATRIBUIR**: con este método no se le puede colgar a ningún commit. Se corrige la prosa (que
llevaba tiempo describiendo un estado que ya no existía) y se marca el párrafo como HISTÓRICO.

### 2.3 Lo que NO se movió (medido, no supuesto)

Digests **idénticos carácter a carácter** en los tres puntos disponibles:
- **ch20**: `ffe5ba19` = `13b46ee6` = `HEAD`.
- **ch27**: `13b46ee6` = `HEAD`.

⇒ ni `7dd45fbe` (clase de movimiento) ni `13b46ee6` (0xEC) movieron un solo veredicto de ch20
o ch27. El par de commits que reventó ch25 y ch26 **no tocó** estas dos mazmorras.

### 2.4 El fix: PIN por sala en los dos specs ciegos

Se añade a ch20 y ch27 la aserción que les faltaba —los conjuntos VICTORY y DEADEND
explícitos—, etiquetada como **BASELINE MEDIDO, no veredicto de fidelidad**, que es la forma
que ya usan ch22 y ch24. A partir de ahora un flip sale ROJO y se adjudica como cualquier otro.

No es re-baselinear citando al port: **no había baseline que mover**. Es crear el detector que
la clase del spec (DETECTOR-DE-REGRESIÓN, «baselines calibrados tras medir») exige tener, y
apoyado en 3 puntos de medida para ch20 y 2 para ch27, no en una corrida suelta.

---

## §3 — Propuesta de CASILLA 3 para el marco de adjudicación

El marco del lead tiene dos casillas (commit derivado ⇒ re-sello; commit sin derivación ⇒
seña). ch26 no cabe en ninguna: el commit **es** derivado y aun así **no se puede sellar**.
Propongo la que falta:

> **Casilla 3 — commit derivado, efecto NO-VEREDICTO.** Cuando el resultado de un fix derivado
> no es un veredicto distinto sino la **pérdida de la capacidad de emitir veredicto** (THROW,
> timeout, arnés atascado), NO se re-sella aunque el commit tenga acta: sellarlo congela un
> instrumento roto. Va a tarjeta con la pregunta acotada, y el spec se queda rojo.

Es la lección de la ventana #161 —«acotar no es pinnear»— con el siguiente escalón: **pinnear
tampoco basta si lo que se pinneó no es un veredicto**.

---

## §4 — Estado y gates

| item | estado |
|---|---|
| #163 ch26 | **ROJO, sin tocar.** Mover pinneado (`13b46ee6`), pregunta acotada en §1.4 |
| #164 ch20 | **PIN añadido** (5 VICTORY / 3 DEADEND) + prosa caducada de r14 corregida |
| #164 ch27 | **PIN añadido** (4 VICTORY / 2 DEADEND) |
| #164 ch22/ch23/ch24 | ya protegidos, verdes en la ventana #161 ⇒ genuinamente quietos |
| `tsc --noEmit -p tsconfig.e2e.json` | **EXIT 0** |

Coste: **3 corridas** de playwright (sonda de 3 specs en `13b46ee6`, sonda de ch20 en
`ffe5ba19`, verificación de los pines) — el resto salió del análisis estático y de los digests
que la ventana #161 ya había dejado medidos.
