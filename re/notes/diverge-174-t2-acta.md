# ACTA #174 (banda PEGAJOSA) — TANDA 8, SUB-TANDA 2: tres grupos de hermanos, 6 pares por 3 lecturas

> Rama `re/diverge-174`, worktree `.claude/worktrees/diverge-174`, base **main `b13e38a1`**.
> Toda cifra medida en ese árbol. RETENIDA: aterriza el lead.
> Continúa `diverge-174-acta.md` §6 (el corte en frontera de par de la sub-tanda 1).

---

## 0. VEREDICTO

**6 pares, 6 (a) exacta, 0 (b), 0 (c), 0 (d)** — y con **3 lecturas**, porque los seis salen del
barrido de hermanos-de-fork que la sub-tanda 1 dejó preparado. El ahorro anunciado se cobra.

| par | qué se verificó |
|---|---|
| `TOWN.OVL:0x0d3e` | la rama X negativa fija el tile de facing 0x11 |
| `TOWN.OVL:0x0d46` | la rama Y **no toca** el tile — la asimetría, literal |
| `MAINOUT.OVL:0x13b3` | primer gate de rango 3; fuera de rango salta a `return 0` ANTES del rand |
| `MAINOUT.OVL:0x13bc` | segundo gate de rango 3, mismo destino |
| `SJOG.OVL:0x1192` | el corte por id14, con su cadena y su destino de reintento |
| `SJOG.OVL:0x11bc` | el destino del id1, alcanzado por caída desde el gate de cuenta |

## 1. RE-ANCLA: no aplica, y se dice con la medida

Main avanzó a `b13e38a1` (mi sub-tanda 1, aterrizada) y `833edef7` (corrección del lead), los dos
de prosa. `git diff e24b53f5..main -- game/src` sigue **VACÍO** ⇒ el corpus no se ha movido y la
población sigue en **338 @ `b13e38a1`**, con los 3 controles verdes. Cola: **56 vivos** al empezar.

## 2. `TOWN.OVL` — la asimetría de facing, que es justo lo que un DIVERGE pregunta

El fork del eje manda a dos brazos que **no hacen lo mismo**, y ahí está la gracia:

| call-site | instrucción | brazo | ¿toca el tile de facing? |
|---|---|---|---|
| `TOWN.OVL:0x0d34`, | `or ax, ax` / `jle 0xd3e` | X, signo > 0 ⇒ `0x0d36` | SÍ, `mov word [bp-0xc], 0x10` |
| `TOWN.OVL:0x0d34`, | (caída) | X, signo ≤ 0 ⇒ `0x0d3e` | SÍ, `mov word [bp-0xc], 0x11` |
| `TOWN.OVL:0x0d46`, | `sub ax,ax` / `push` / `push 1` / `call` rand | Y | **NO** — cae a `0x0d55` sin escribir |

Los dos brazos de X saltan a `0x0d55`; el brazo Y **cae** al mismo sitio sin haber tocado
`[bp-0xc]`. La cita (`core/world/loops/guards.ts:19`) lo dice exactamente así: *«el binario sólo
fija el tile de facing en la rama X …; la rama Y salta sin tocar el tile ⇒ mantiene el facing
previo»*. **Exacta**, y el signo también: `shl ax,1 / dec ax` es `2·r − 1` ✓, con `rand(0,1)`
(primer push 0 = min, segundo 1 = max).

★ **Y el port modela LOS DOS destinos, no sólo el citado** — que es la pregunta propia de esta
celda. `guards.ts:76-82`: la rama de eje X asigna `tile = sign > 0 ? 0x10 : 0x11`, y la de Y
lleva el comentario *«mueve SIN re-facing — conserva el tile previo»*. La asimetría está
portada A PROPÓSITO, no por olvido.

## 3. `MAINOUT.OVL` — dos gates, un mismo `return 0`, y el rand que NO se consume

La cita (`core/world/enemies.ts:304`) afirma que fuera del rango 3 **no se tira el dado**:
*«Fuera de rango 3 → SIN rand (0x13B3/0x13BC saltan a return 0 antes del rand)»*.

| call-site | instrucción | destino si falla |
|---|---|---|
| `MAINOUT.OVL:0x13b7`, | `cmp word [bp-4], 3` / `jle 0x13bc` | `0x13b9 jmp 0x1478` |
| `MAINOUT.OVL:0x13c0`, | `cmp word [bp-6], 3` / `jle 0x13c5` | `0x13c2 jmp 0x1478` |

Y `0x1478` **es** `return 0`: `sub ax, ax` seguido del epílogo (`pop si` / `mov sp, bp` /
`pop bp` / `ret 2`). El rand vive en `0x13cc`, **después** de los dos gates ⇒ «sin rand fuera de
rango» es literal y demostrable, no una impresión. El dado es `rand(0,7)` (pushes 0 y 7) con
`or ax,ax` en `0x13cf` ⇒ el 1/8 de la cita ✓.

★ **La otra mitad de la cita se cierra por una derivación que la cita no da**: dice *«SÓLO Sea
Serpent (def 18) y Dragon (def 39)»*, y el gate son dos comparaciones de TILE, no de índice —
`0x13a2 cmp [bp-0xa], 0x88` y `0x13a9 cmp [bp-0xa], 0xdc`, las dos con `je 0x13b3`. Cuadran con
la correspondencia estándar `tile = 0x40 + def·4`: def 18 ⇒ `0x40 + 0x48` = `0x88` ✓ y def 39 ⇒
`0x40 + 0x9c` = `0xdc` ✓. **Dos criaturas, exactamente las dos que la cita nombra.**

## 4. `SJOG.OVL` — un fork de TRES destinos sin reunión corta, el caso de libro de `DIVERGE`

Cita (`core/game.ts:985`): *«por slot+0 abre id1 (0x1181 `cmp byte[bx],1` ⇒ 0x11bc) o corta con
id14=0x0e (0x1192 `cmp byte[si],0xe` ⇒ "Can't!" 0x8b64); cualquier otro id ⇒ `add di,8` =
siguiente slot, en 0x119e»*. Los tres destinos, leídos:

| call-site | instrucción | destino | qué pasa |
|---|---|---|---|
| `SJOG.OVL:0x1181`, | `cmp byte ptr [bx], 1` / `jne 0x1192` | caída a `0x1186` ⇒ `0x11bc` | ABRE el cofre |
| `SJOG.OVL:0x1192`, | `cmp byte ptr [si], 0xe` / `jne 0x119e` | `0x1197` | carga `0x8b64` = «Can't!» |
| `SJOG.OVL:0x1195`, | (no coincide) | `0x119e` | `add di, 8` = siguiente slot |

**Los tres, exactos**, incluido el detalle de que el id1 no salta: **cae** a `0x1186`, el gate de
cuenta de slot, y de ahí a `0x11bc`. Y el barrido cuadra con lo que la cita declara: la cota
`0x5d5a` está literal en `0x11b3`, y el paso es `add 8` en los cinco punteros paralelos.

★ Un matiz que la cita ya traía escrito con precisión y que conviene subrayar porque es raro:
*«casa la celda (X/Y[/floor])»* — **el corchete del `floor` es real**. La comparación de planta
(`0x1174-0x117c`) está encerrada entre dos guardas de `g_location` (`0x1166 ja 0x117e` y
`0x116d jae 0x119e`), así que sólo se exige en una banda de localización. El autor puso el
corchete porque el binario lo tiene condicional, no por vaguedad.

## 5. Estado de la cola

| | pares |
|---|---|
| VIVOS al empezar la sub-tanda 2 | 56 |
| adjudicados aquí | **6** |
| **VIVOS** | **50** |

De los 50, **4 siguen en grupos de hermanos** (2 grupos: `CAST.OVL` `0x206a`/`0x2148` y
`SHOPPES.OVL` `0x1684`/`0x16eb`) ⇒ 2 lecturas los cierran. Es por donde debe empezar la
sub-tanda 3.

Balance de las dos sub-tandas de este carril: **8 pares por 4 lecturas**, todos (a) exacta. El
cabo de hermanos-de-fork ha rendido **el doble** de lo que costó censarlo.

⚠ **CORTE EN FRONTERA DE GRUPO**, con los tres grupos enteros cerrados y el cuarto sin abrir.
Ningún par partido por la mitad.

## 6. Lo que esta sub-tanda NO ha hecho

- **No ha tocado `game/src` ni `re/tools`.** Cero arreglos: los 6 estaban bien.
- **No ha leído** los otros 50 pares, ni los 2 grupos de hermanos que quedan.
- **No ha verificado la CONDICIÓN** de ninguno de los 6 (#144): se adjudica que la cita describe
  el tramo. En `TOWN.OVL` sí se comprobó ADEMÁS que el port modela los dos brazos, porque era la
  pregunta propia de la celda; en los otros dos grupos no se ha ido más allá de la cita.
- **No ha vuelto a pasar la lente `kernel`**: el censo de la sub-tanda 1 sigue vigente (1 sola
  candidata en la celda, y benigna).

## 7. Gates (EXIT por separado, sin pipes, re-corridos tras el `git add`)

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

## 8. Nombres de overlay usados aquí (sección FINAL a propósito)

Al final por el ctx pegajoso de #84. Overlays nombrados: `CAST.OVL`, `MAINOUT.OVL`,
`SHOPPES.OVL`, `SJOG.OVL`, `TOWN.OVL`.
