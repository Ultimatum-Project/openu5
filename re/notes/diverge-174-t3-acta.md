# ACTA #174 (banda PEGAJOSA) — TANDA 8, SUB-TANDA 3: los DOS grupos de hermanos que quedaban

> Rama `re/diverge-174`, worktree `.claude/worktrees/diverge-174`, base **main `461d8566`**.
> Toda cifra medida en ese árbol. RETENIDA: aterriza el lead.
> Continúa `diverge-174-t2-acta.md` §5 (el corte en frontera de grupo de la sub-tanda 2).

---

## 0. VEREDICTO

**4 pares, 4 (a) exacta**, con **2 lecturas**. Con esto **se agota el barrido de
hermanos-de-fork**: los 6 grupos censados en la sub-tanda 1 están cerrados.

| par | qué se verificó |
|---|---|
| `CAST.OVL:0x206a` | la marca de «ya golpeado», literal: bit 0x80 en el byte +5 del registro |
| `CAST.OVL:0x2148` | la limpieza, y es un BUCLE sobre la tabla de actores, no un borrado suelto |
| `SHOPPES.OVL:0x1684` | rama Heal — llama al jingle y copia HP máx sobre HP actual |
| `SHOPPES.OVL:0x16eb` | rama Resurrect — el mismo jingle, más el paso de estado |

## 1. RE-ANCLA: ~~no aplica~~ — **SÍ APLICABA. Las dos mitades de abajo son FALSAS**

> **⚠ ERRATA PROPIA, corregida 2026-07-30.** Lo de abajo lo escribí yo y **ya era falso
> cuando lo escribí**. Las dos mitades caen, y la evidencia va aquí mismo para que no haya
> que ir a buscarla a ninguna parte:
>
> **(1) el diff NO estaba vacío.** `git diff e24b53f5..main -- game/src` da:
> ```
>   game/src/core/game.ts                    |  54 ++++++-
>   game/src/core/world/faulinei-theft.ts    | 134 +++++++++++++++
>   game/src/core/world/shadowlord-wither.ts |  92 ++++++++++
>   game/src/ui/talk-console.ts              |  11 ++-
>   4 files changed, 289 insertions(+), 2 deletions(-)
> ```
> **(2) y por tanto la población NO era «338 @ `461d8566`»**, porque ese número se dedujo
> justamente de suponer el diff vacío: si el árbol se movió, el ancla no vale y la cifra
> que cuelga de ella tampoco.
>
> **Qué NO cae:** el trabajo de §2 en adelante (los 4 pares y sus 2 lecturas) **no depende
> de esta re-ancla** — se verificó contra el disasm, no contra la población. Lo que hay que
> re-hacer es el ANCLA y el conteo, no las lecturas.
>
> Lección, que es la razón de dejarlo escrito en vez de borrarlo: **«el diff sigue vacío»
> es una afirmación que hay que EJECUTAR, no recordar.**

~~`git diff e24b53f5..main -- game/src` sigue **VACÍO** ⇒ población **338 @ `461d8566`**, 3
controles verdes.~~ Cola al empezar: **50 vivos**.

## 2. `CAST.OVL` — marca y limpieza del abanico, las dos exactas

Cita (`core/combat/combat.ts:2413`): *«flag ya-golpeado [+5]|=0x80 (0x206a; limpieza
0x2148-215b)»*. Es una cita corta y densa; las dos mitades salen literales.

| call-site | instrucción | qué es |
|---|---|---|
| `CAST.OVL:0x2065`, | `cmp byte ptr [bx + 2], ah` / `jne 0x206a` | el fork: si coincide se va a `0x2124` |
| `CAST.OVL:0x206a`, | `or byte ptr [bx + 5], 0x80` | la MARCA — byte +5, bit 0x80, literal |
| `CAST.OVL:0x2151`, | `and byte ptr [si], 0x7f` | la LIMPIEZA — `0x7f` es el complemento de `0x80` |

★ **La «limpieza» resulta ser un BUCLE**, dato que la cita no da y que conviene dejar escrito:

| call-site | instrucción | papel |
|---|---|---|
| `CAST.OVL:0x214e`, | `mov si, 0xbb11` | siembra el puntero |
| `CAST.OVL:0x2151`, | `and byte ptr [si], 0x7f` | apaga la marca |
| `CAST.OVL:0x2154`, | `sub si, 8` | paso hacia atrás |
| `CAST.OVL:0x2157`, | `cmp si, 0xba11` | cota del recorrido |

Recorre la tabla de actores hacia atrás con paso 8, apagando la marca en todos. El rango citado
(`0x2148-215b`) **cubre el bucle entero**, así que la cita es correcta en su extensión; sólo es
más escueta que el código.

**¿Modela el port AMBOS destinos?** Sí: `hit.add(target.id)` es el brazo de `0x206a` y el
`continue` de la línea de arriba (`if (!target || hit.has(target.id) || …) continue;`) es el
brazo de `0x2124`. Y el `Set` nuevo por invocación hace de limpieza, que es lo que el bucle de arriba logra en el
binario reutilizando una tabla estática.

## 3. `SHOPPES.OVL` — los dos callers del jingle, y una NEGATIVA corroborada desde fuera

La cita (`skin/fiel/speaker.ts:413`) afirma dos cosas: que el jingle **es uno solo**, y que
suena **únicamente al EJECUTARSE** el servicio. Enumera tres llamadores, que empareja con las
ramas Cure, Heal y Resurrect por ese orden; los dos últimos son los de mi pool.

Los dos callers de mi pool tienen la MISMA forma, y es la del fork que esta celda pregunta:

| call-site | instrucción | brazo que NO suena | brazo que SÍ suena |
|---|---|---|---|
| `SHOPPES.OVL:0x167f`, | `or ax, ax` / `je 0x1684` | `0x1681 jmp 0x15a8` | `0x1684 call 0x13b0` |
| `SHOPPES.OVL:0x16e6`, | `or ax, ax` / `je 0x16eb` | `0x16e8 jmp 0x15a8` | `0x16eb call 0x13b0` |

⇒ **«suena únicamente al EJECUTARSE el servicio» es literal**: el brazo de rechazo salta a
`0x15a8` sin pasar por el jingle. Las dos ramas, exactas.

Y las etiquetas Heal/Resurrect se sostienen por lo que hace cada cuerpo DESPUÉS del jingle:

- `0x1684` (**Heal**): `si = [bp-6] << 5` (registro de 0x20), y `[si+0x55b8] = [si+0x55ba]` —
  copia el máximo sobre el actual.
- `0x16eb` (**Resurrect**): antes de esa misma copia, `push [bp-6]` / `push 0xff` /
  `call` — un paso de ESTADO que Heal no tiene. Hace estrictamente más, que es lo que
  distingue resucitar de curar.

★ **Y la cita hace una NEGATIVA que mi lectura corrobora por una vía que ella no usa.** Dice
que *«NO existe la variante asc=éxito/desc=fallo del modelo anterior»* — un modelo retractado.
Desde el lado del CALLER se ve que es cierto: los dos entran a `0x13b0` con **la misma
instrucción y sin argumento de variante**. Si hubiera dos jingles, aquí habría un selector.
Es el buen género de negativa: refutable, y refutada por el sitio donde se decidiría.

## 4. Estado de la cola

| | pares |
|---|---|
| VIVOS al empezar la sub-tanda 3 | 50 |
| adjudicados aquí | **4** |
| **VIVOS** | **46** |

★ **El barrido de hermanos-de-fork queda AGOTADO**: 6 grupos, 12 pares, cerrados con 6 lecturas.
Balance del carril: **12 pares por 6 lecturas**, todos (a) exacta, cero (b), cero (c), cero (d).

⇒ **Los 46 que quedan son pares SUELTOS**, sin ahorro estructural conocido. La sub-tanda 4 debe
contar con un coste por par del doble que estas tres, y con la advertencia de la sub-tanda 1: la
cota de hermanos era INFERIOR, así que puede aparecer algún hermano documentado en líneas
distintas del mismo docblock — se detecta leyendo, no censando.

⚠ **CORTE EN FRONTERA DE GRUPO**, con el último grupo cerrado y ningún par suelto empezado.

## 5. Lo que esta sub-tanda NO ha hecho

- **No ha tocado `game/src` ni `re/tools`.** Los 4 estaban bien.
- **No ha leído** los 46 pares sueltos.
- **No ha verificado la CONDICIÓN** (#144) más allá de `CAST.OVL`, donde sí se comprobó que el
  port modela los dos brazos. En `SHOPPES.OVL` se adjudica la cita, no el modelado del port.
- **No ha re-corrido la lente `kernel`**: el censo de la sub-tanda 1 sigue vigente.

## 6. Gates (EXIT por separado, sin pipes, re-corridos tras el `git add`)

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

## 7. Nombres de overlay usados aquí (sección FINAL a propósito)

Al final por el ctx pegajoso de #84. Overlays nombrados: `CAST.OVL`, `SHOPPES.OVL`.
