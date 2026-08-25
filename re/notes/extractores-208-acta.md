# ACTA #208 — extensiones hardcodeadas: CERO puntos ciegos en el instrumento, y el motivo NO es suerte

> Rama `re/extractores-208`, worktree `.claude/worktrees/extractores-208`, base **main `f2f60924`**.
> Toda cifra medida en ese árbol. RETENIDA: aterriza el lead.
> Nace de la seña de `sueltos-b-206-cotejo-86.md` §4.

---

## 0. VEREDICTO

**Barridos `re/tools` (139 ficheros) y el repo entero. CERO puntos ciegos vivos.** El género existe
en **un solo sitio del repo: mi propio acta de #206**, donde está documentado como defecto. Las tres
exclusiones que el barrido encuentra en instrumentos son **DELIBERADAS y correctas**, y se documentan
aquí.

**Y el resultado no se firma como negativo pelado.** La ausencia se prueba por el lado positivo:
`frontier.json` publica **163 rutinas `.DRV`** repartidas por los **cuatro** drivers. Los drivers no
están «no excluidos»: están **presentes a granel** en el artefacto versionado.

| | |
|---|---|
| ficheros barridos en `re/tools` | 139 |
| ficheros `.py` fuera de `re/tools` alcanzados por el barrido | 71 |
| hits del género `(OVL\|EXE)` en TODO el repo | **3**, los tres en el acta de #206 que lo describe |
| puntos ciegos en instrumentos | **0** |
| exclusiones deliberadas documentadas | **3** |
| instrumentos tocados | **0** |

## 1. ★ Por qué el instrumento es INMUNE por construcción (no por acierto)

La razón es estructural y merece quedar escrita, porque es lo que hace que el resultado sea fiable
y no una casualidad:

**(a) Los censos NO enumeran extensiones de binario: globean `*.asm`.**

| call-site | construcción | efecto |
|---|---|---|
| `cita_rama_hermana.py:92`, | `OVERLAYS = sorted(p.stem for p in DISASM.glob("*.asm"))` | los **28**, drivers incluidos |
| `cita_rama_hermana.py:165`, | `for p in sorted(DISASM.glob("*.asm"))` | ídem |
| `globals_negdisp.py:164`, | `DISASM_DIR.glob("*.asm")` | ídem |
| `globals_negdisp.py:170`, | `DISASM_DIR.glob("*.asm")` | ídem |

El filtro es por la extensión del **artefacto de desensamblado** (`.asm`), no por la del binario
⇒ **añadir un binario nuevo de cualquier extensión entra solo**. Ésa es exactamente la propiedad
que a mi patrón ad-hoc le faltaba.

**(b) `.DRV` no es un residuo tolerado: es una CATEGORÍA de primera clase, con predicado propio,
ramas propias y tests que la asertan.**

| call-site | qué hace |
|---|---|
| `frontier.py:42`, | `is_driver(fname) = fname.endswith(".DRV")` — el predicado |
| `frontier.py:360`, | rama propia de driver |
| `frontier.py:400`, | `drv = [r for r in out_routines if r["file"].endswith(".DRV")]` |
| `frontier.py:468`, | filtro complementario |
| `verify_cites.py:180`, | rama de driver + kernel |
| `verify_cites.py:273`, | ídem |
| `verify_index.py:50`, | rama de driver |
| `globals_negdisp.py:158`, | predicado propio |
| `test_frontier.py:64`, | **asserta** que todo hardware-driver vive en un `.DRV` |
| `test_frontier.py:77`, | asserta el complemento |
| `test_frontier.py:87`, | asserta el `role` de los driver |

**(c) Los DOS regex del repo que sí enumeran extensiones YA incluyen `DRV`:**

| call-site | patrón |
|---|---|
| `routine_census.py:384`, | `_FILE_TOKEN = re.compile(r"\b([A-Z][A-Z0-9]*\.(?:OVL\|DRV\|EXE))\b")` |
| `verify_strcites.py:215`, | `(?:[A-Z0-9]{3,8}\.(?:OVL\|EXE\|DAT\|CBT\|DRV))` |

⇒ el género que me mordió **no tiene ni un representante vivo en el instrumento versionado**.

## 2. Las TRES exclusiones deliberadas, adjudicadas y documentadas

### 2.1 `binfiles.py` — el POOL del ledger: 25 ficheros, sin drivers, con TOTAL DE BYTES declarado

Es la *fuente de verdad* del inventario y **no lista los cuatro drivers**. No es olvido: su propio
docstring fija el alcance con una cifra que sólo cuadra sin ellos.

> *«El pool total debe sumar exactamente 202800 bytes: 34544 (kernel) + 119792 (23 overlays de
> código) + 48464 (DATA.OVL)»*

⇒ El pool es **kernel + 23 overlays + DATA.OVL = 25**, y su control es un **total de bytes**, que es
justamente la clase de control que #206 echó de menos. **Exclusión deliberada, con control propio.
No se toca.**

### 2.2 `recon.py:overlays()` — una función cuyo nombre ES su alcance

`recon.py:76` hace `if not f.endswith(".OVL"): continue` dentro de una función llamada
`overlays()`. Un driver no es un overlay y el kernel se reconoce por otra vía. **Deliberada por
alcance declarado en el nombre. No se toca.**

### 2.3 `diff-ocr-masivo.py:201` — extensiones que LLEVAN TEXTO

`TEXT_EXT = {'.OVL', '.DAT', '.TLK', '.EXE', '.NPC'}`, sin `.DRV`. Ese instrumento busca cadenas de
juego dentro de ficheros de datos para cotejarlas contra OCR; **los drivers de vídeo no llevan texto
de juego**. **Deliberada por dominio. No se toca.**

⚠ Las listas de nombres de overlay de `recon.py:118`, `test_dispatch.py:144/181/204/210` y
`test_globals_negdisp.py:24` **no son censos**: son fixtures y comprobaciones puntuales sobre
overlays concretos (`assert {...} >= {...}`). No afirman cobertura, así que no pertenecen al género.

## 3. ★★ EL HALLAZGO QUE TRANSFIERE: no era «se olvidó .DRV», eran DOS CORPUS

Reconstruido el defecto de #206 con el instrumento delante, el diagnóstico cambia de forma y mejora:

| corpus | qué es | cuántos | ¿lleva drivers? | control propio |
|---|---|---|---|---|
| **POOL del ledger** | lo que la RE se compromete a cubrir | **25** | **NO**, por diseño | total de **202800 bytes** |
| **CORPUS DE CITAS** | aquello que el port llega a citar | **28** | **SÍ** | la matriz del partidor |

Mi patrón no «olvidó» una extensión: **importó al corpus de CITAS una suposición con forma de
POOL**. Las dos exclusiones son correctas cada una en su corpus, y el error sólo aparece al cruzar
la frontera entre ambos — que es precisamente lo que hace un cotejo de banda.

★ **Regla operativa que deja**: antes de escribir un extractor, **di sobre cuál de los dos corpus
opera**, y si es el de citas, no enumeres extensiones: derívalas del directorio. Es hermana de la
lección de #206 (*«hay que declarar sobre qué CONJUNTO se compara»*) y de la de #188 (*el eje
FORZADA es ciego al SEGMENTO*): la familia entera es **suposiciones de alcance heredadas sin
declarar**.

## 4. Controles del propio barrido

Un barrido que devuelve «cero» sin control es un cero en falso a la espera, así que éste lleva tres:

| control | qué prueba | resultado |
|---|---|---|
| **POSITIVO** | el barrido SABE encontrar el género: mi patrón malo está documentado en `sueltos-b-206-cotejo-86.md` | lo encuentra, **3 líneas** ✓ |
| **DE ALCANCE** | el barrido no está acotado a `re/tools` | alcanza **71** `.py` fuera de ahí ✓ |
| **POSITIVO del PIPELINE** | los drivers no están sólo «no excluidos», están presentes | `frontier.json`: **163 rutinas `.DRV`** en los 4 drivers ✓ |

`frontier.json` por extensión: **OVL 493 · EXE 229 · DRV 163**.

★ **Y el barrido tropezó con la misma trampa de shell que el otro carril de #206**: un `grep` con
`--include=*.py` **sin comillas** en `zsh` no expandió a nada y devolvió *«no matches found»*. Aquí
fue ruidoso (el comando falló); en el caso de #206 fue **silencioso** porque el patrón sin comillas
llegaba como un único argumento. Mismo shell, dos formas de morder. Con los globs entrecomillados el
barrido corre y da los 3 hits de §0.

## 5. Lo que este acta NO hace

- **No toca ni un instrumento.** Cero defectos ⇒ cero cambios; no se arregla lo que no está roto, y
  no se añade un guarda contra un defecto inexistente sin que alguien lo decida (§6).
- **No toca `game/src`** ni ninguna población: la banda sigue en 345 pares y `frontier.json`
  intacto. No se ha corrido nada que reescriba artefactos.
- **No audita** las exclusiones deliberadas por su MÉRITO (¿debería el pool cubrir los drivers?):
  eso es una decisión de alcance del proyecto, no de este barrido.
- **No barre** ficheros de datos ni assets: el encargo es instrumentos.

## 6. Recomendación ÚNICA, para que decida el lead (no ejecutada)

El instrumento es inmune hoy **por una propiedad que nadie asserta**: que los censos globean
`*.asm`. Si mañana alguien cambia un `glob("*.asm")` por una lista de extensiones, nada se pondría
rojo. Un guarda barato sería un test que fije **28 ficheros de disasm = 23 OVL + 1 EXE + 4 DRV**, de
modo que cualquier estrechamiento futuro choque contra un total.

**No lo he añadido** porque añade instrumento sin defecto que lo motive, y el encargo pide parar
antes de tocar nada que pueda mover poblaciones. Queda propuesto con su justificación.

## 7. Gates (EXIT por separado, sin pipes, re-corridos tras el `git add`)

```
python3 re/tools/seed_gate.py                        EXIT=0
python3 -m pytest re/tools/test_frontier.py -q       EXIT=0
python3 -m pytest re/tools/test_genero.py -q         EXIT=0
python3 -m pytest re/tools/test_cita_segmento.py -q  EXIT=0
python3 re/tools/genero.py                           EXIT=0
python3 re/tools/cita_pegajosa_forma.py              EXIT=0   (3 controles verdes)
python3 re/tools/cita_pegajosa_atribucion.py         EXIT=0   (3 controles verdes)
```

`game/src` no se ha tocado ⇒ no aplican `tsc` ni `vitest`. Sin e2e (mutex ajeno).
`routine-census.json` NO regenerado (EMBARGO). `pytest re/tools` COMPLETO no corrido.

---

## 8. Nombres de overlay usados aquí (sección FINAL a propósito)

Al final por el ctx pegajoso de #84. Nombrados: `CGA.DRV`, `DATA.OVL`, `EGA.DRV`, `HER.DRV`,
`T1K.DRV`, `ULTIMA.EXE`.
