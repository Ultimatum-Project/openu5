# ACTA #174 (banda PEGAJOSA) — TANDA 8, SUB-TANDA 1: el mapa de la celda `DIVERGE`, y el primer grupo

> Rama `re/diverge-174`, worktree `.claude/worktrees/diverge-174`, base **main `4713eeaf`**.
> Toda cifra medida en ese árbol. RETENIDA: aterriza el lead.
> Continúa las DOS actas de la tanda 7 (`pegajosa-backedge-acta.md` y `backedge-174-acta.md`),
> que cerraron `BACKEDGE` por separado y en paralelo — ver §4.

---

## 0. QUÉ TRAE ESTA SUB-TANDA

La celda `DIVERGE` es la última de la banda y la más grande. Antes de leer un solo par se
hacen los dos barridos BARATOS que el método reserva para el principio, porque los dos cambian
el plan de las sub-tandas siguientes. Y se adjudica el primer grupo.

**Adjudicados aquí: 2 pares** (`SHOPPES.OVL:0x0394` y `SHOPPES.OVL:0x03b8`), los dos **(a)
exacta**, con UNA sola lectura. Quedan **56**.

## 1. RE-ANCLA: NO hace falta, y se dice con la medida

Entre la tanda 7 y ésta, main avanzó dos commits (`12539166` y `4713eeaf`), los dos de prosa.
La regla es re-anclar **sólo si un aterrizaje tocó `game/src`**. Medido:

```
git diff e24b53f5..main -- game/src     → VACÍO
```

⇒ el corpus no se ha movido. La partición reproduce: **338 pares @ `4713eeaf`**, con los tres
controles del módulo verdes y el positivo `SJOG.OVL:0x158e` en su celda de siempre.

**La cola reproduce EXACTA**: `DIVERGE × (FORZADA+LIMPIA)` = **62**, menos los **4** ya
adjudicados (d) por #188/#190 (`DUNGEON.OVL:0x13b2`, `SJOG.OVL:0x17f6`, `ULTIMA.EXE:0x52d2`,
`ULTIMA.EXE:0x5356`) = **58 vivos**, que es la cifra que la tanda 7 dejó declarada.

## 2. ★ BARRIDO 1 — la lente «kernel» sobre la celda: UNA candidata, y es BENIGNA

La tanda 7 derivó que la palabra `kernel` en una cita es un **selector de overlay** hacia
`ULTIMA.EXE` que el extractor tira (tarjeta #199, sin aplicar). Aplicada como LENTE —declarar,
no filtrar— sobre los 58 vivos:

| par | línea del port | ¿la lente muerde? |
|---|---|---|
| `ULTIMA.EXE:0x31f4` | `game/src/main.ts:953` | **NO** — ver abajo |

**Total: 1 de 58.** Y ★ **la única candidata sale BENIGNA por una razón que conviene dejar
escrita**: el par ya está atribuido a `ULTIMA.EXE`, que es exactamente adonde el token apunta.
El selector y la política pegajosa **coinciden**, así que aquí no hay par fabricado. El caso de
la tanda 7 (`EGA.DRV:0x0aa6`) era dañino porque el token decía `ULTIMA.EXE` y la política había
colgado la cita de OTRO fichero.

⇒ **La lección para #199, medida y no supuesta: el token `kernel` sólo fabrica par cuando el
overlay heredado NO es `ULTIMA.EXE`.** Eso acota el daño del defecto de instrumento a un
subconjunto comprobable, y da al que implemente el criterio un predicado barato para el
control. En esta celda el daño potencial es **cero**; queda por medir en las otras.

## 3. ★ BARRIDO 2 — hermanos-de-fork: 6 grupos, 12 pares, 6 lecturas de ahorro

El §15.1 de `pegajosa-96-acta` pide barrer los hermanos-de-fork **antes** de estimar lo que
resta. Criterio mecánico y conservador: pares distintos que apuntan a la MISMA línea del port.

| línea del port | pares | overlay |
|---|---|---|
| `core/shops/shops.ts:733` | `0x0394` · `0x03b8` | `SHOPPES.OVL` |
| `core/combat/combat.ts:2413` | `0x206a` · `0x2148` | `CAST.OVL` |
| `core/game.ts:985` | `0x1192` · `0x11bc` | `SJOG.OVL` |
| `core/world/enemies.ts:304` | `0x13b3` · `0x13bc` | `MAINOUT.OVL` |
| `core/world/loops/guards.ts:19` | `0x0d3e` · `0x0d46` | `TOWN.OVL` |
| `skin/fiel/speaker.ts:413` | `0x1684` · `0x16eb` | `SHOPPES.OVL` |

**12 pares en 6 grupos ⇒ 6 lecturas de ahorro, un 10% de la celda**, y ninguno cruza de
overlay: los seis grupos son intra-fichero, lo que hace la lectura conjunta barata de verdad.
Es el mismo rendimiento que el cabo dio en `BACKEDGE` (2 por 1) pero SEIS veces.

⚠ **Cota honesta del criterio**: «misma línea del port» es SUFICIENTE, no necesario. Dos brazos
del mismo fork documentados en líneas distintas del mismo docblock NO los ve este barrido — que
es justo lo que pasó en la tanda 6 (`0x4775` / `0x4786` cayeron en celdas distintas). El 12 es
una **cota inferior** de los hermanos que hay, no el censo.

## 4. Nota de proceso: `BACKEDGE` se cerró DOS VECES, en paralelo

La tanda 7 tiene **dos actas independientes** en main, de dos carriles que leyeron los mismos
12 pares sin saber el uno del otro (`12539166` y `4713eeaf`). No es redundancia: **se cierran
mutuamente los «no verificado»** (una dejó abierto el nombre del fichero de
`BLCKTHRN.OVL:0x091f` y el eco de `SHOPPES.OVL:0x0478`, que la otra deriva) y **sólo una de las
dos alcanzó el defecto del port** de la tarjeta #200, porque su lectura del tramo de
`CMDS.OVL:0x1932` siguió hasta el tercer argumento de la llamada y la otra paró en los dos
`putchar`. Las dos coinciden en el (d) y en el veredicto 11+1.

⇒ Se deja anotado como dato de método, no como reproche: en esta cola, **la profundidad a la
que se corta un tramo decide si un defecto aparece o no**, y dos lecturas honestas del mismo
par pueden diferir en eso sin que ninguna mienta. Familia `colision-add-add-de-actas`, en su
variante benigna (nadie borró nada porque se aterrizaron las dos).

## 5. LA PRIMERA LECTURA — grupo `SHOPPES.OVL`, los dos pares del switch del gremio

Cita (`core/shops/shops.ts:733`): *«entra al switch del ítem (0x0394/0x03b8/0x03c2, con
add_byte_capped sobre DS 0x57ac/0x57ad/0x57ae con 3/4/5 y tope 0x63)»*.

El fork y sus tres destinos, leídos enteros:

| call-site | instrucción | destino | ítem | cuerpo |
|---|---|---|---|---|
| `SHOPPES.OVL:0x0384`, | `or ax, ax` / `je 0x394` | `0x0394` | llaves | `push 0x57ac` / `push 3` |
| `SHOPPES.OVL:0x0388`, | `cmp ax, 1` / `je 0x3b8` | `0x03b8` | gemas | `push 0x57ad` / `push 4` |
| `SHOPPES.OVL:0x038d`, | `cmp ax, 2` / `je 0x3c2` | `0x03c2` | antorchas | `push 0x57ae` / `push 5` |

**Las tres globales, exactas; los tres incrementos, exactos; el tope también**: en `0x039c` se
empuja `0x63`, y en `0x03a0` está la llamada a `add_byte_capped`. ★ Y el detalle que hace la cita verificable de
verdad: los casos de gemas y antorchas **no repiten el tope** — saltan a `0x039b`, que es la
COLA del caso de las llaves, para compartir el `push 0x63 / call`. Por eso el `0x63` aparece
UNA vez para tres casos.

**La pregunta propia de un `DIVERGE` —¿el port modela AMBOS destinos o sólo el citado?—
se responde que SÍ**: el docblock enumera los tres lotes (`keys +3 / gems +4 / torches +5`) con
su cap 99, y la reunión existe y está en `0x039b`.

Veredicto: `SHOPPES.OVL:0x0394` **(a) exacta** · `SHOPPES.OVL:0x03b8` **(a) exacta**.

★ Corroboración de tercera vía: `pegajosa-96-acta` §11.3 ya había verificado este MISMO switch
entrando por el par `0x03c2` (que era suyo, de la celda clase-2). Tres lecturas independientes,
por tres entradas distintas, mismo resultado.

## 6. Estado de la cola

| | pares |
|---|---|
| `DIVERGE` F+L en la partición | 62 |
| ya (d) por #188/#190 | 4 |
| VIVOS al empezar | **58** |
| adjudicados en esta sub-tanda | **2** |
| **VIVOS** | **56** |

De los 56, **10 están en grupos de hermanos** (5 grupos) ⇒ 5 lecturas los cierran.

⚠ **CORTE EN FRONTERA DE PAR**, con el grupo entero cerrado y sin abrir el siguiente. Los
barridos de §2 y §3 quedan hechos y son lo que la sub-tanda 2 debe usar para ordenarse: atacar
primero los 5 grupos de hermanos que quedan (10 pares por 5 lecturas).

## 7. Lo que esta sub-tanda NO ha hecho

- **No ha tocado `game/src` ni `re/tools`.** Ni un arreglo, ni un cambio de criterio. La lente
  de §2 se APLICA COMO AVISO y se declara; #199 sigue sin implementar.
- **No ha leído** los otros 56 pares.
- **No ha verificado la CONDICIÓN** de los 2 (a) (#144): se adjudica que la cita describe el
  tramo, no que el port lo modele bajo la condición correcta.
- **No ha censado los hermanos-de-fork por docblock**, sólo por línea — la cota de §3 es
  inferior y así se declara.

## 8. Gates (EXIT por separado, sin pipes, re-corridos tras el `git add`)

```
python3 re/tools/seed_gate.py                       EXIT=0
python3 -m pytest re/tools/test_frontier.py -q      EXIT=0
python3 -m pytest re/tools/test_genero.py -q        EXIT=0
python3 re/tools/genero.py                          EXIT=0
python3 re/tools/cita_pegajosa_forma.py             EXIT=0   (3 controles verdes)
python3 re/tools/cita_pegajosa_atribucion.py        EXIT=0   (3 controles verdes)
```

`game/src` no se ha tocado ⇒ no aplican `tsc` ni `vitest`. Nada de e2e (mutex ajeno).
`routine-census.json` NO regenerado (EMBARGO). `pytest re/tools` COMPLETO no corrido.

---

## 9. Nombres de overlay usados aquí (sección FINAL a propósito)

Al final por el ctx pegajoso de #84. Overlays nombrados: `CAST.OVL`, `CMDS.OVL`,
`DUNGEON.OVL`, `EGA.DRV`, `MAINOUT.OVL`, `SHOPPES.OVL`, `SJOG.OVL`, `TOWN.OVL`, `ULTIMA.EXE`.
