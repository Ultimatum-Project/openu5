# ACTA #209 · PASO 2 — la medición REFUTA mi propio §3, y destapa un hueco de CORPUS

> Rama `re/title-209`, worktree `.claude/worktrees/title-209`, base **main `5dd5abf8`**.
> Toda cifra medida en ese árbol, corriendo el extractor **modificado en local y revertido después**.
> RETENIDA: aterriza el lead. Continúa `title-209-acta.md` §5, paso 2.

---

## 0. VEREDICTO

El sink por propiedad aflora **2 cadenas, no 9-10**. Y el motivo no es el que yo di: **las 11 que
faltan no las pierde el sink — las pierde el CORPUS**, porque el extractor **nunca lee el fichero
donde viven**.

| medida | valor |
|---|---|
| baseline, extractor intacto | **867** cadenas |
| con `title`/`label`/`day` añadidos a la lista-sink | **869** |
| **DELTA** | **+2** — `Arms` y `Reagents:` |
| cadenas perdidas por el cambio | **0** |

★ **Mi predicción pre-registrada falla, y por tercera vez en el mismo eje por SOBREESTIMAR**:
predije **9 ó 10** razonando el mecanismo de `resolve()` (acceso indexado ⇒ array entero, `??` ⇒
ambas ramas). El mecanismo que leí es correcto — **pero nunca llega a ejecutarse**, porque el
fichero no entra al barrido. Leí la función y no el ALCANCE.

## 1. ★★★ LA CAUSA REAL: el corpus del shell es una LISTA A MANO

| call-site | qué es |
|---|---|
| `extract-user-strings.mjs:426`, | `SHELL_FILE_RELPATHS = [ … ]` — **once rutas escritas a mano** |
| `extract-user-strings.mjs:441`, | `shellFiles = (srcDir) => SHELL_FILE_RELPATHS.map(…)` |
| `gen-string-manifest.mjs:65`, | `extractUserStrings(CORE, SHELL)` — sólo `src/core` **+ esas once** |

**Medido**: `src/ui/` tiene **28 ficheros `.ts`** y la lista nombra **10** (más `main.ts`). De los
19 no escaneados, **tres tienen texto que pasa por el choke i18n**:

| fichero NO escaneado | llamadas `t()`/`tf()` |
|---|---|
| `ui/shop-console.ts`, | **197** |
| `ui/selector.ts`, | 4 |
| `ui/faithful-intro.ts`, | 1 |
| **TOTAL** | **202** |

⇒ **La interfaz de tiendas entera está fuera de la guarda anti-fabricación.** No por el sink, no
por `t()`: porque su fichero no está en una lista de once.

★ **Y es EXACTAMENTE el género de #208**: una **lista enumerada donde hacía falta una derivada**.
Allí eran extensiones de binario (`(OVL|EXE)` tirando `.DRV`); aquí son rutas de fichero. La regla
que dejó #208 —*«no enumeres: deriva del directorio»*— aplica sin cambiar una palabra.

## 2. Lo que esto CORRIGE de mi propio acta anterior

`title-209-acta.md` §3 daba esta tabla, y **dos de sus tres filas razonaban mal**:

| caso | lo que dije | lo que la medición dice |
|---|---|---|
| `title: t("Arms")` | «la aflora el sink» | ✓ **correcto**, aflora |
| `label: t(REAGENT_NAMES[slot] …)` | «quizá, por resolución de refs locales» | ✗ **no**, y no por el array: **su fichero no se lee** |
| `day: t(partOfDayWord(hour))` | «no, la llamada cross-módulo se poda» | ✗ conclusión correcta, **razón equivocada**: tampoco se lee |

Atribuí a la MECÁNICA del extractor lo que era un problema de ALCANCE. La conclusión práctica de
aquel acta («no anunciar +12») se sostiene y hasta se refuerza —el sink sólo da +2— pero **el porqué
estaba mal, y quien implemente necesita el porqué correcto**: añadir propiedades al sink no toca a
las 11; hay que meter el fichero en el corpus.

## 3. La sorpresa que confirma un punto ciego que YO había declarado

De las 2 afloradas, una no estaba en mis 12: **`Reagents:`** (`main.ts:2666`, `title: "Reagents:"`,
con su cita `DS 0x8f64 @0x1924`). Es un `title:` con **literal PLANO, sin `t()`**.

Mi censo de #209 miró propiedades que reciben `t()`/`tf()`, y en §6 declaré sin medir el eje de
«propiedades que reciben literales pelados». **La medición lo confirma en el primer intento**: ese
eje tiene población, y `Reagents:` es su primer miembro conocido.

## 4. ★ Cuarto defecto de instrumento del día, otra vez mío y otra vez cazado por el RESULTADO

Al barrer los `ui/` no escaneados, el primer bucle salió **mudo** — cero ficheros con `t()` —
cuando yo **ya había medido** `shop-console.ts:432` y `:988` con mis propios ojos. Un cero que
contradice una medida anterior es la señal más barata que hay.

**Causa**: `grep -c` devuelve **exit 1** cuando cuenta cero, y dentro de mi `&&` eso abortaba la
rama entera antes de imprimir. Con el conteo hecho en Python el barrido da 3 ficheros y 202
llamadas.

Van **cuatro** en la jornada —`(OVL|EXE)`, `zsh` sin comillas, `t\("` sin frontera y este `grep -c`
con exit 1— y **los cuatro los cazó un juicio sobre el RESULTADO**, ninguno una lectura del código.
Esta vez, además, lo cazó **contradecir una medida previa mía**, que es el control más fuerte de los
cuatro: no hacía falta ni saber si la cifra era plausible, bastaba con que chocara con otra.

## 5. ⛔ NADA APLICADO

- El extractor se modificó **en local, se corrió, y se REVIRTIÓ**: `git status` limpio, cero
  cambios en `tools/`. El script de medición se borró.
- **El manifiesto NO se ha tocado ni regenerado.** El delta se midió sobre la salida del extractor
  en memoria, no escribiendo `approved-strings.json`.
- Cero `game/src`, cero `es.json`.

**Relevo para el implementador post-GO, en el orden que la evidencia impone:**
1. **Primero el CORPUS, no el sink**: `SHELL_FILE_RELPATHS` debe derivarse (glob de `src/ui/*.ts`)
   o, si hay motivo para excluir, declararlo con su criterio — como `binfiles.py` declara su pool
   con un total de bytes (#208 §2.1).
2. Sólo después, las propiedades al sink: aportan **+2** sobre el corpus actual, y sobre el corpus
   ampliado habrá que **volver a medir** (no extrapolar: es la lección de esta acta).
3. El eje de **literales pelados en propiedad** (§3) sigue **sin censar**.
4. Predicción falsable para el paso 1: al derivar el corpus, el manifiesto crece **mucho más de
   +2** — con 202 llamadas `t()`/`tf()` entrando de golpe, y por eso ese paso es el que de verdad
   choca con el gate del manifiesto y con el GO.

## 6. Gates (EXIT por separado, sin pipes, re-corridos tras el `git add`)

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
