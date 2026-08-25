# FASE 3g — RESULTADO PARCIAL: guardas VERDES, entregable principal BLOQUEADO por material

> Ejecuta el prerregistro `espejo-3g-prerregistro.md` (2884f076 + errata 01cbced0, los dos
> fijados antes de tocar el material). Rama `espejo/3g-movere`. 2026-07-27. Cero playwright.

---

## 0. LO PRIMERO: EL BLOQUEO

**No se pueden regenerar las rutas de `part07-24`. El material de entrada NO EXISTE.**

`segment.mjs` consume `original/av-referencia/yt/clips/full-part-logs/partNN.ocrlog.txt`. Ese
directorio **no existe** en el checkout. Lo único presente es el corpus AD
(`full-part-logs-ad/ad_epNN.ocrlog.txt`, 25 ficheros).

⇒ **El entregable «rutas re-segmentadas paralelas» es imposible offline.** No lo he fabricado ni
he tocado las rutas existentes (que son artefactos sellados). Reporto en vez de regenerar, que es
la regla. Lo que hace falta para desbloquearlo va en §4.

## 1. LO QUE SÍ SE HA PODIDO MEDIR, Y POR QUÉ ES UN PROXY

`segment.mjs` **consume** las líneas de movimiento: las convierte en ops de `nav` del `script` y
**no las deja en `expect`**. Por eso los bloques de `expect` son, por construcción, *exactamente
lo que el clasificador viejo NO reconoció*. Verificado en `part12-g24`: 34 pasos de nav en el
script y 456 bloques en expect, con los ecos de movimiento entre estos últimos.

Eso hace que aplicar el clasificador NUEVO sobre los `expect` mida algo bien definido: **cuántos
ecos de movimiento se le escaparon al viejo y recupera el nuevo**. No es la re-segmentación, pero
es su cota.

| | part09-18 | part01-08 (canario) |
|---|---|---|
| bloques de `expect` | 21 891 | 2 881 |
| clasificados `move` por el VIEJO | **0** (por construcción, ver arriba) | **0** |
| clasificados `move` por el NUEVO | **5 771** | **4** |
| Δ sobre sus bloques | — | **0,14%** |

## 2. LAS GUARDAS (P2′) — las que mandan

| guarda | resultado | veredicto |
|---|---|---|
| **P2′.1** `typed`/mantra que pasan a `move` | **0** | ✓ |
| **P2′.1** anclas de costura alteradas | **0** (`fuzz` intacta; el plegado vive sólo en el reconocedor de movimiento) | ✓ |
| **P2′.2** formas ajenas que caen en el vocabulario | **0 de 175 formas distintas** | ✓ |
| retirados (eran `move` y dejan de serlo) | **0** | ✓ |
| **P3** canario `part01-08` ≤ 2% | **0,14%** (4 bloques) | ✓ |

**Censo P2′.2 completo, auditado forma a forma**: las 175 son ecos de movimiento sin excepción —
`8outh`, `Nvrth`, `Wcgt`, `gouth`, `Eagt`, más los compuestos con verbo (`F]v`/`F]y`/`Flv`/`Fly`,
`Hcad`/`Head`/`Heod`/`Heud`, `Row`/`Rvw`). Casos límite que también son correctos: los que
arrastran la segunda pasada del OCR (`Hcad"Eagt"""""`, `~Row"N6rEh"""""`) y los de cola espuria
(`Nvrth_`, `Wegt_`). **Ni una palabra ajena.** El censo íntegro está en el commit.

⇒ `g→s` **pasa la guarda de ESTA fase**, aunque 3h la rechazara para casar. Es lo que el
prerregistro §4 anticipaba: guardas distintas para usos distintos, cada una decide en su terreno.
Aquí el vocabulario destino son 4 rumbos × 4 verbos, no 827 mensajes.

## 3. P1 — NO SE PUEDE ADJUDICAR, Y NO VOY A FORZARLO

P1 decía «pasos de `nav` conducidos de 21,8% a la banda 55-85%». **No es adjudicable**, por dos
razones que declaro en vez de elegir el denominador que me convenga:

1. **Sin re-segmentación no hay «pasos de nav»**: el número real exige regenerar las rutas, y el
   material no está (§0). Lo medido son BLOQUES recuperados, no pasos.
2. **El denominador del prerregistro se queda corto.** El 21,8% salía de los 4 918 ecos que
   contaba `moveShape` (3f). El reconocedor nuevo encuentra **5 771** sólo entre lo que el viejo
   descartó, o sea **más de lo que `moveShape` contaba como total**. Metido en la fórmula vieja
   daría >100% — por encima incluso del umbral de SOSPECHA (>95%). Eso no es un éxito
   espectacular: es que **las dos cifras no miden lo mismo** y compararlas sería un artefacto.

**Veredicto honesto de P1: INDETERMINADO por material y por definición de la métrica.** Se
adjudica cuando se pueda re-segmentar, con el denominador redefinido a la salida real del
segmentador.

## 4. QUÉ HACE FALTA PARA DESBLOQUEAR

1. **Los `partNN.ocrlog.txt` de LP1** (part07-24). Son el OCR crudo del LP; están gitignored y no
   se han encontrado en el árbol. Si existen en otra máquina o en el material del usuario, con
   ellos 3g se completa **offline y sin ventana**.
2. Si no existen: 3g queda como *cambio de código verificado por guardas* pero **sin rutas
   nuevas**, y entonces la corrida #45 no puede probar 3g (sólo verbo + plegado).

## 5. ESTADO DEL CÓDIGO

`tools/segment.mjs`: `moveFuzz` (plegado del corpus tardío) + `MOVE_SPELLINGS`/`VEH_SPELLINGS`
como **tabla de datos** de la que se genera el regex — se declara «esto lo vi escrito así», no un
regex a mano. **`fuzz` queda INTACTA** y con ella la semántica de anclas, keywords y texto.
Ningún artefacto sellado tocado; ninguna ruta regenerada.
