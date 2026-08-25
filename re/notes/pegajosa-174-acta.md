# ACTA #174 (banda PEGAJOSA) — TANDA 1: el mapa de ataque, y los 45 primeros cerrados

> Rama `re/pegajosa-174`, worktree `.claude/worktrees/pegajosa-174`, base **main `e06b4b9f`**.
> Toda cifra medida en ese árbol. RETENIDA: aterriza el lead.
> Continúa `pool-174-acta.md` §6.1 (el corte declarado de aquel carril).

---

## 0. Lo primero: EL REPARTO DEL ENCARGO ESTABA MAL ANCLADO

La tarjeta reparte la banda «@`6430be1e`: FORZADA 20 · LIMPIA 128 · LEJANA **63** · AMBIGUA
**114**». Ese ancla no puede sostener esa medida:

```
git log --oneline --diff-filter=A -- re/tools/cita_pegajosa_atribucion.py
  → c0aacf1f                       (el instrumento se AÑADIÓ ahí)
git cat-file -e 6430be1e:re/tools/cita_pegajosa_atribucion.py
  → fatal: path ... exists on disk, but not in '6430be1e'
```

El partidor se auto-etiqueta con `git HEAD` (`sha()`), así que corrido en el worktree del
carril anterior **antes de commitear la propia herramienta** firmó un ancla de un árbol donde
no existía. Nadie mintió: **el instrumento firmó el ancla falso solo.**

**Reparto REAL, reproducido en TRES árboles** (`8a5516b8` · `c0aacf1f` · `e06b4b9f`), idéntico
en los tres, con los 3 controles del partidor verdes en todos:

| | FORZADA | LIMPIA | LEJANA | AMBIGUA | TOTAL |
|---|---|---|---|---|---|
| pares | 20 | 128 | **64** | **113** | 325 |

Una fila se mueve respecto al encargo (AMBIGUA→LEJANA). No la causó el carril `cielo-176`:
medido en `8a5516b8`, su propia base, ya salía 64/113.

★ **Consecuencia operativa, que vale más que la fila:** esta partición **no es estable entre
aterrizajes** — la población incluye las citas de `game/src` y de las notas, que crecen cuando
cualquier carril aterriza prosa. Quien siga esta cola **re-ancla en SU árbol y re-mide antes de
reclamar cobertura**, o adjudica contra un denominador que no puede reproducir. Familia de
`cifra-censo-sin-sha-es-foto`, con la variante nueva del **ancla huérfana**.

Regla que se propone para los instrumentos de esta familia: antes de firmar `@SHA`, verificar
que el propio fichero existe en el árbol de HEAD y que el árbol está limpio; si no, etiquetar
«SIN ANCLA (árbol sucio)» en vez de un SHA que no reproduce.

## 1. El mapa: ATRIBUCIÓN × FORMA (`re/tools/cita_pegajosa_forma.py`, nuevo)

Decidir el orden de ataque mirando sólo la atribución tira la mitad de la información. Un par
FORZADA cuya hermana es `DIVERGE` es lectura larga; uno FORZADA cuya hermana es
`PREFIJO-efecto` es el perfil exacto de #133, donde el género ha dado defectos. **Manda la
celda, no el eje.** El módulo nuevo cruza los dos reutilizando `cita_pegajosa_atribucion`,
`cita_clase4_efecto.clasifica` y `cita_rama_hermana` — sin escáner paralelo ni criterio nuevo.

```
BANDA PEGAJOSA #174 — ATRIBUCIÓN × FORMA @ e06b4b9f — 325 pares
  forma               FORZADA   LIMPIA   LEJANA  AMBIGUA   TOTAL
  clase2                    3       49       19       35     106
  PREFIJO-efecto            5       13       12        9      39
  PREFIJO-bifurca           1        3        3        4      11
  BACKEDGE                  3        9        5       15      32
  DIVERGE                   8       53       25       47     133
  PREFIJO-inerte            0        1        0        3       4
  TOTAL                    20      128       64      113     325
```

Controles del módulo, los tres verdes: el positivo `SJOG.OVL:0x158e`, con forma `clase2` · población
== la del partidor de atribución (325) · **disjunta del pool ESTRICTO ya adjudicado
(solapes = 0)** — o sea que esto es cobertura NUEVA, no re-adjudicación de #172/#174.

★ **Un dato del mapa que contradice al pool estricto:** `PREFIJO-inerte` —el único bucket
auto-adjudicable— salió **VACÍO** en el pool estricto (`pool-174-acta` §2.1, tras corregir su
definición con `salidas()`). Aquí tiene **4 miembros**. No se auto-adjudican: precisamente
porque aquel bucket escondió un caso con rama alternativa entera cuando su control estaba en
verde, estos 4 van a lectura como todos los demás. Queda anotado como el primer sitio donde
mirar si alguien quiere volver a poner a prueba la definición de «inerte».

## 2. ★ La banda pegajosa TIENE el control positivo que el pool estricto no pudo tener

`pool-174-acta.md` §2.2 declara, con razón, que clase-4 se quedó sin control positivo de
defecto: los casos del género ya arreglados (#133 odd key, #140 HMS Cape) son **clase-2** y no
caen en su población. Pero `SJOG.OVL:0x158e` —el odd key de #133, defecto **confirmado y
arreglado en main**— **vive en esta banda** y es clase-2.

⇒ Sobre los 106 clase-2 de la pegajosa, el criterio de #172 **se puede calibrar por el lado del
acierto**, que es la primera vez en esta familia de tarjetas. Es la razón de atacar esa celda
primero y no la más numerosa.

## 3. TANDA 1 — los 106 clase-2, corridos con el criterio de #172

`cita_pegajosa_forma.py --clase2` aplica `cita_hermana_emitida.classify` (el partidor de #172,
importado, no reimplementado) a los clase-2 de esta banda.

```
POSITIVO   #133 odd key SJOG.OVL:0x158e → EMITIDA   OK
CAPACIDAD  con el corpus del port VACÍO → NO-EMITIDA 95/95   OK

CLASE-2 de la banda pegajosa @ e06b4b9f — 106 pares
  EMITIDA        95
  NO-EMITIDA      0
  SIN-TEXTO      11
```

★ **El CERO de NO-EMITIDA lleva su control de CAPACIDAD, y sin él no valdría nada.** El
positivo de #133 demuestra que el clasificador acierta el estado EMITIDA — no que la ALARMA
pueda sonar. Un cero de alarmas sólo es informativo si se prueba que la alarma alcanza a la
población (`cero-emisiones-no-es-cero-capacidad`). Se re-corre el MISMO clasificador con el
corpus del port **vacío**: los 95 pares con texto decodificable caen entonces en NO-EMITIDA,
**95/95**. El bucket es alcanzable para toda la población con texto ⇒ el cero significa algo.

### 3.1 Desglose por atribución, y por qué NO se cierran los 106

| atribución | EMITIDA | NO-EMITIDA | SIN-TEXTO |
|---|---|---|---|
| FORZADA | 2 | 0 | 1 |
| LIMPIA | 43 | 0 | 6 |
| LEJANA | 17 | 0 | 2 |
| AMBIGUA | 33 | 0 | 2 |

⚠ **El resultado clase-2 NO es independiente de la atribución, y por eso sólo se cierran los de
atribución no discutible.** El criterio pregunta «¿la cadena de LA RAMA HERMANA está en el
port?», y la rama hermana se deriva del par `(overlay, offset)`. Con la atribución equivocada,
la respuesta es correcta **sobre el código equivocado**. Un `EMITIDA` en un par AMBIGUA no dice
que la cita esté bien: dice que cierta rama de cierto overlay emite. Cerrarlos sería
exactamente la mis-atribución silenciosa contra la que avisa la tarjeta.

**CERRADO en esta tanda: los 45 clase-2 FORZADA+LIMPIA con texto** (2 + 43) →
**(a) SIN CANDIDATO** por el criterio de #172, con positivo y capacidad verdes.

**NO cerrado, y con nombre:**
- **7 SIN-TEXTO de FORZADA/LIMPIA** — el puntero de la hermana no decodifica a cadena, así que
  el criterio no se pronuncia. No son «sin defecto», son **sin medir**:
  `ULTIMA.EXE:0x4786` · `CAST2.OVL:0x0a0c` · `MAINOUT.OVL:0x1c56` · `SHOPPES.OVL:0x0374` ·
  `SHOPPES.OVL:0x03c2` · `SHOPPES.OVL:0x061c` · `SHOPPES.OVL:0x0e1d`.
- **54 clase-2 LEJANA+AMBIGUA** — dan EMITIDA, pero bajo una atribución sin verificar. Su
  adjudicación empieza por resolver la ATRIBUCIÓN, no por el binario.

## 4. Estado de la cola, con las cuentas cuadradas

| | pares |
|---|---|
| Población total de la banda | **325** |
| CERRADOS en esta tanda (clase-2 FORZADA+LIMPIA con texto) | **45** |
| Sin medir por SIN-TEXTO (FORZADA/LIMPIA) | 7 |
| Clase-2 bloqueados por atribución (LEJANA+AMBIGUA) | 54 |
| Formas de clase-4, sin tocar | **219** |

219 + 54 + 7 + 45 = 325. ✓

**Orden de ataque propuesto para la tanda 2**, por rendimiento esperado y no por tamaño:
1. `PREFIJO-efecto` × FORZADA+LIMPIA (**18**) — perfil exacto de #133; es donde el género ha
   dado defectos reales en los dos carriles anteriores.
2. Los **7 SIN-TEXTO** de arriba — baratos, y su residuo es un límite del criterio, no del port.
3. `PREFIJO-bifurca` + `PREFIJO-inerte` × FORZADA+LIMPIA (**5**) — pocos, y los 4 inertes son
   el punto de prueba de la definición corregida de §2.1 del acta anterior.
4. `BACKEDGE` × FORZADA+LIMPIA (12) y `DIVERGE` × FORZADA+LIMPIA (61) — lectura larga.
5. Los 177 LEJANA+AMBIGUA — **atribución primero**, binario después.

## 5. Lo que este carril NO ha hecho, declarado

- **No ha adjudicado ni una forma de clase-4.** 219 pares intactos.
- **No ha resuelto ninguna atribución.** Los 177 LEJANA+AMBIGUA siguen como estaban.
- **No ha tocado `game/src`.** Ningún defecto arreglado; esta tarjeta adjudica.
- **La CONDICIÓN de los (a)** sigue sin verificarse, igual que en #172 §3.2 y `pool-174-acta`
  §6.3: «el efecto está modelado» ≠ «modelado bajo la condición correcta» (contraejemplo #144,
  el defecto en la envoltura). Los 45 de esta tanda están cerrados por PRESENCIA de la cadena,
  que es el criterio de #172 — no por su condición.

## 6. Gates (EXIT por separado, sin pipes, re-corridos tras el `git add`)

```
python3 re/tools/cita_pegajosa_forma.py             EXIT=0   (3 controles verdes)
python3 re/tools/cita_pegajosa_forma.py --clase2    EXIT=0   (positivo + capacidad verdes)
python3 re/tools/cita_pegajosa_atribucion.py        EXIT=0   (3 controles verdes)
python3 re/tools/cita_clase4_efecto.py              EXIT=0   (#174 estricto intacto)
python3 re/tools/cita_hermana_emitida.py            EXIT=0   (#172 intacto)
python3 re/tools/cita_rama_hermana.py --calibrar    EXIT=0
python3 re/tools/verify_pool174_claims.py           EXIT=0
python3 re/tools/seed_gate.py                       EXIT=0
python3 re/tools/genero.py                          EXIT=0
```

`game/src` no se ha tocado ⇒ no aplican tsc ni vitest. Nada de e2e/playwright (mutex ajeno).
`routine-census.json` NO regenerado (EMBARGO). `pytest re/tools` COMPLETO no corrido (contiene
un test de oráculo EN VIVO); los test-files se corren por nombre.

---

## 7. CARRIL `re/pool-148` — condiciones del GO, cumplidas; y el corte declarado

Rama `re/pool-148`, **branchada de `re/pegajosa-174`** (no de main) porque el instrumento de
§1 vive ahí. Orden de pick para el lead: `26c2b94e` primero, `e8c05db8` después.

**Condición 1 — re-anclar y re-medir en el árbol propio: HECHO.** Medido en `e8c05db8`, la
partición sale **idéntica** a la de `e06b4b9f` (20 · 128 · 64 · 113) y el cruce ATRIBUCIÓN ×
FORMA reproduce celda a celda. Es un dato, no un trámite: los dos commits de este carril
añaden prosa a `re/notes/`, que es una de las fuentes de la población — y no la movieron.

**Condición 2 — arreglar el auto-etiquetado: HECHO** (`e8c05db8`). `anchor_sha(producer)` vive
en el módulo COMPARTIDO `cita_rama_hermana.py`, no en las tres copias, y exige dos cosas antes
de firmar: que el productor exista en el árbol de HEAD y que ese fichero esté limpio. Si falla
cualquiera, `SIN ANCLA (árbol sucio)`; nunca un SHA inventado.

★ **El fix se verifica por el viaje de ida y vuelta, que es su control natural:** con las tres
herramientas modificadas y sin commitear, imprimen literalmente `@ SIN ANCLA (árbol sucio)` —
o sea, el defecto original ya no puede ocurrir; commiteadas y con el árbol limpio, vuelven a
firmar (`@ e8c05db8`). Sin cambios de criterio ni de población: los conteos son idénticos
antes y después.

**Condición 3 — el corte, declarado.** De los 148 FORZADA+LIMPIA:

| | pares | estado |
|---|---|---|
| clase-2 con texto | 45 | **CERRADOS** en la tanda 1 |
| clase-2 SIN-TEXTO | 7 | sin medir, nombrados en §3.1 |
| `PREFIJO-efecto` | 18 | **cola viva** — cabeza del orden de ataque |
| `PREFIJO-bifurca` | 4 | cola viva |
| `PREFIJO-inerte` | 1 | cola viva (y ver el aviso de §1) |
| `BACKEDGE` | 12 | cola viva |
| `DIVERGE` | 61 | cola viva |
| **total 148** | | 45 cerrados · **103 vivos** |

Los **177 LEJANA+AMBIGUA** quedan explícitamente FUERA de este carril: son los del fallo
silencioso y van a carril fresco, con la atribución antes que el binario.

**Los 5 `PREFIJO-efecto` de atribución FORZADA**, volcados y sin adjudicar, para que el
siguiente no repita el listado: `ULTIMA.EXE:0x5164` · `0x5a66` · `0x66a6` · `0x6a0d` ·
`0x6ccf`. Se listan con `cita_pegajosa_forma.py --celda FORZADA PREFIJO-efecto`, que ya vuelca
guarda, ramas y línea del port de cada uno.

⚠ **PARADA DECLARADA, y por la razón que la propia tarjeta prescribe.** La adjudicación de los
103 vivos es lectura de binario par a par — el trabajo donde muerde la mis-atribución
silenciosa. Este carril llega con dos tandas encima y **no la empieza**: prefiere dejar la cola
preparada y el instrumento arreglado a firmar veredictos con el listón bajado. No es un
bloqueo: es el corte honrado del §6 de la tarjeta.
