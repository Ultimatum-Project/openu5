# ACTA #174 (banda PEGAJOSA) — TANDA 8, SUB-TANDA 4: las DOS ALTAS NUEVAS, leídas en caliente

> Rama `re/diverge-174`, worktree `.claude/worktrees/diverge-174`, base **main `4e4769e9`**.
> Toda cifra medida en ese árbol. RETENIDA: aterriza el lead.
> Continúa `diverge-174-errata.md` §5, que es quien las descubrió.

---

## 0. VEREDICTO, y por qué ESTOS dos y no otros

**2 pares, 2 (a) exacta.** Son las dos altas que la errata destapó: nacieron con el aterrizaje
de #195 y **nunca las había leído nadie**. Se atacan primero por la razón que la propia errata
dio: **citan código de HOY**, así que leerlas es carear una cita con horas de vida en vez de
arqueología — y el careo salió más barato que cualquier par viejo.

| par | atribución | veredicto |
|---|---|---|
| `TOWN.OVL:0x0224` | LIMPIA | **(a)** exacta — el fork de «hay Shadowlord o no», con sus dos destinos |
| `ULTIMA.EXE:0x449e` | FORZADA | **(a)** exacta — la fórmula de dirección, las CUATRO instrucciones |

## 1. RE-ANCLA: medida OTRA VEZ, que es la lección de la errata

Se re-corre en ESTA sub-tanda, no se hereda:

```
git diff e24b53f5..main -- game/src   → 4 ficheros, 289 inserciones (#195 y #196)
python3 re/tools/cita_pegajosa_forma.py → 345 pares @ 4e4769e9, 3 controles verdes
```

`DIVERGE` F+L = **64**, menos 4 ya-(d) por #188/#190 = **60**, menos 12 adjudicados en las
sub-tandas 1-3 = **48 vivos** al empezar ésta. Las cifras son las de la errata, re-medidas.

## 2. `TOWN.OVL:0x0224` — el fork de la marchitación, y sus DOS destinos

La cita (`core/world/shadowlord-wither.ts:9`) es un bloque de desensamblado comentado. La
primera línea es el fork, y es la pregunta de la celda en su forma más limpia:

| call-site | instrucción | destino | qué pasa |
|---|---|---|---|
| `TOWN.OVL:0x021a`, | `cmp byte ptr [0x5958], 0xff` | — | ¿hay Shadowlord colocado aquí? |
| `TOWN.OVL:0x021f`, | `jne 0x224` | `0x0224` | SÍ ⇒ marchita |
| `TOWN.OVL:0x0221`, | `jmp 0x2a8` | `0x02a8` | NO ⇒ **sale sin tocar nada** |

Los dos brazos van a sitios lejanos y **sin reunión corta** — `0x02a8` es la salida de la
rutina. Y el cuerpo del brazo vivo cuadra instrucción a instrucción con lo que la cita escribe:

| call-site | instrucción | la cita dice |
|---|---|---|
| `TOWN.OVL:0x0224`, | `mov al, byte ptr [g_day]` | `mov al,[g_day, DS 0x587e]` ✓ |
| `TOWN.OVL:0x0227`, | `sub ah, ah` | `sub ah,ah` ✓ |
| `TOWN.OVL:0x0229`, | `push ax` | `push ax` ✓ |
| `TOWN.OVL:0x0232`, | `mov word ptr [bp - 0xc], 0` | «base de FILA» ✓ |
| `TOWN.OVL:0x0237`, | `sub si, si` | «COLUMNA» ✓ |

**¿Modela el port AMBOS destinos?** El docblock declara el brazo muerto explícitamente
(«ningún SL colocado ⇒ SALE SIN TOCAR NADA»), que es el rasgo que un `DIVERGE` mal portado
suele perder. La CONDICIÓN en el código no se ha verificado aquí (#144) y se declara en §5.

★ Nota de nomenclatura, RESUELTA: el desensamblado llama a esa global `g_unk_5958` y la cita
la nombra `g_shadowlord_here_idx`. Comprobado contra el catálogo, la cita está AL DÍA y el
`.asm` RANCIO — `re/ledger/globals.json` tiene `g_shadowlord_here_idx` en 0x5958 con
`old_names: ['g_unk_5958']`, y el símbolo viejo sigue apareciendo 9 veces en `TOWN.OVL.asm`.

⇒ **Segunda instancia del mismo patrón en este carril**, tras el `g_shop_accum` de la
sub-tanda 2. Las dos veces la sospecha apuntaba al autor de la cita y las dos veces el rancio
era el desensamblado. Es materia de #81 (las globales desincronizadas), y el canal `old_names[]`
sostiene el puente en ambas. **No hay nada que carear con el autor.**

## 3. `ULTIMA.EXE:0x449e` — la fórmula, literal, y una CORRECCIÓN ajena confirmada

La cita (`shadowlord-wither.ts:33`) afirma que `tile_addr` resuelve en `0x449e-0x44a8` la
dirección `addr = ([bp+4] << 5) + [bp+6] + 0x6608`. Las **cuatro** instrucciones del rango:

| call-site | instrucción | término |
|---|---|---|
| `ULTIMA.EXE:0x449e`, | `mov ax, word ptr [bp + 4]` | el primer operando |
| `ULTIMA.EXE:0x44a1`, | `mov cl, 5` / `shl ax, cl` | el `<< 5` |
| `ULTIMA.EXE:0x44a5`, | `add ax, word ptr [bp + 6]` | el segundo operando |
| `ULTIMA.EXE:0x44a8`, | `add ax, 0x6608` | la base del búfer |

**Exacta, término a término, y los extremos del rango también.**

★ **Y la parte que vale**: la cita no se queda en la fórmula, deriva **qué es cada operando**, y
lo hace por el call-site. Verificado:

| call-site | instrucción | consecuencia |
|---|---|---|
| `MAINOUT.OVL:0x06fe`, | `mov al, [g_party_x]` / `push ax` | primer push |
| `MAINOUT.OVL:0x0704`, | `mov al, [g_party_y]` / `push ax` | **último** push |
| `MAINOUT.OVL:0x0708`, | `call` | — |

El último valor empujado es el que queda en `[bp+4]` — eso es mecánico y no depende de cómo se
llame la convención. ⇒ **`[bp+4]` es la `y`**, luego `addr = (y << 5) + x + base` y **el índice
que avanza de 0x20 en 0x20 es la FILA**. La cita lo dice y lo demuestra.

★★ **Esto CONFIRMA una corrección ajena hecha el mismo día.** El docblock declara que
`rng-186-acta.md §3.1` publicaba la fórmula **transpuesta** (`(x<<5)+y`) y que el autor la
corrigió allí, avisando de que es **load-bearing**: con los ejes al revés, el conjunto de tiles
marchitados para un día dado es OTRO. Mi lectura, hecha por el mismo camino pero de forma
independiente, da la forma corregida. **Es una re-verificación de una corrección con horas de
vida**, que es exactamente para lo que sirve leer las altas en caliente.

## 4. Estado de la cola

| | pares |
|---|---|
| población @ `4e4769e9` | 345 |
| `DIVERGE` F+L | 64 |
| ya (d) por #188/#190 | 4 |
| adjudicados por este carril | **14** |
| **VIVOS** | **46** |

Los 46 son **todos pares SUELTOS y VIEJOS**: el barrido de hermanos está agotado y las dos
altas nuevas ya están leídas. Balance del carril: **14 pares por 8 lecturas**, todos (a) exacta,
cero (b), cero (c), cero (d).

⚠ **CORTE DECLARADO POR COSTE REAL, no por cuota** — que es la frontera que el encargo delega
en el carril. Estas dos entraron porque eran baratas y estaban calientes; los 46 que quedan son
el perfil caro (≈1 lectura por par, sin agrupación que lo amortice), y abrirlos aquí sería
empezar una sub-tanda que no cabe entera. Se para en frontera de par, con la sub-tanda 5
preparada y su orden recomendado en §6.

## 5. Lo que esta sub-tanda NO ha hecho

- **No ha tocado `game/src` ni `re/tools`.** Los 2 estaban bien.
- **No ha verificado la CONDICIÓN** (#144) de ninguno de los dos: se adjudica que la cita
  describe el tramo, no que el port lo ejecute bajo la guarda correcta. En `TOWN.OVL` el
  docblock declara el brazo muerto, pero **no se ha leído el cuerpo del port** que lo implementa.
- **No ha leído** los 46 sueltos.

## 6. Orden recomendado para la sub-tanda 5, medido

De los 46, **32 comparten fichero del port** en 10 grupos. No es el ahorro de un hermano-de-fork
(que era 2 pares por 1 lectura), pero amortiza entender la rutina y el docblock una sola vez:

| pares | fichero del port |
|---|---|
| 8 | `core/combat/combat.ts` |
| 5 | `core/game.ts` |
| 4 | `core/world/transport.ts` |
| 3 | `core/world/loops/turn.ts` |
| 2 | `core/world/camp.ts` · `main.ts` · (y 4 grupos más de 2) |

**Sugerencia: abrir por `combat.ts` (8)**, que es el grupo mayor. Y ritmo medido para calibrar:
par de hermanos ≈ **0,5** lecturas; par suelto ≈ **1,0**. 46 sueltos ≈ 46 lecturas ⇒ sub-tandas
de **8-10** mantienen la profundidad; una de 15 la sacrifica, y la profundidad es lo que hizo
aparecer el único defecto de las ocho tandas.

## 7. Gates (EXIT por separado, sin pipes, re-corridos tras el `git add`)

```
python3 re/tools/seed_gate.py                       EXIT=0
python3 -m pytest re/tools/test_frontier.py -q      EXIT=0
python3 -m pytest re/tools/test_genero.py -q        EXIT=0
python3 re/tools/genero.py                          EXIT=0
python3 re/tools/cita_pegajosa_forma.py             EXIT=0
python3 re/tools/cita_pegajosa_atribucion.py        EXIT=0
```

`game/src` no se ha tocado ⇒ no aplican `tsc` ni `vitest`. Sin e2e. `routine-census.json` NO
regenerado.

---

## 8. Nombres de overlay usados aquí (sección FINAL a propósito)

Overlays nombrados: `MAINOUT.OVL`, `TOWN.OVL`, `ULTIMA.EXE`.
