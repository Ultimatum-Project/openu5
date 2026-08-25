# `routes-sint/` — CORPUS SINTÉTICO del espejo (y el único que VIAJA)

**Todo lo que hay aquí dentro está inventado por nosotros.** Ni una palabra sale del juego
de EA: ni de sus ficheros TLK, ni de una captura, ni de un OCR. El «vado de latón», el búho
de bronce, el silbato de estaño, `LANTERN PIT`, `KETTLE DEEP`, Vela, Torbin, Quilla, Ferrer,
Sinta — todos son nuestros, escritos para este directorio.

## Por qué existe

Los tres corpus reales del espejo (`routes/` = LP1, `routes-ad/` = LP2 Alex Diener,
`routes-lf/` = LP3 Lord Fenton) llevan **la prosa TLK de EA verbatim** en sus bloques
`expect[].text`: 17.030 palabras en 1.677 rachas de ≥8 palabras, medidas el 17-08 con el
predicado de la casa (`re/tools/companion_ngram_overlap.rachas`) contra un techo aprobado de
cita corta de 61 palabras. Desde #376 esos tres directorios están **fuera del índice**
(`.gitignore:28-30`, guarda `re/tools/test_rutas_espejo_sin_prosa_tlk_ea.py`) y desde el tren
#145 el génesis tampoco los copia al árbol público (`docs/publicacion/genesis-publico.sh`,
tres `--exclude` por nombre).

La consecuencia fue **17 ficheros de test fuera del CI público**. Y al mirarlos uno a uno se
vio que para la mayoría de sus bloques **el sujeto no es la prosa: es el CURADOR** — que un
segmento `skip` planifique nav-only, que un `recruit` viaje como op sancionada, que la costura
de salida al Underworld cierre el interior, que el derivador esté en su punto fijo, que
`insertAt` coloque la ráfaga del overlay donde el artefacto la tiene. Todo eso es una
propiedad de la HERRAMIENTA y se puede instanciar sobre rutas con la misma FORMA y prosa
distinta. Eso es este directorio.

## Qué NO es

**No es un tercer walkthrough.** No mide conformidad de nada: no hay un original contra el que
carear estos textos, y ningún test le pregunta a este corpus «¿coincide con la pantalla?».
Los bloques que SÍ examinan la conformidad del corpus real contra el LP —los censos por
identidad, los cardinales calibrados (63 campos, 2637 claves, 310 ops, los 16 del Underworld,
las 7 anclas de transacción)— **no se han movido aquí y no deben moverse**: sobre un corpus
que escribimos nosotros serían tautológicos. Esos siguen corriendo en NUESTRO árbol, acotados
con `describeSiViaja` (`game/tests/assets-opcionales.ts`), y se saltan con motivo visible en el
público.

## Forma

Mismo esquema exacto que los corpus reales (`Route`/`Segment`/`Op`/`ExpectBlock` de
`e2e/espejo-tour/runner.ts`, resumido en el README del espejo §«Formato del route.json»).
Seis partes encadenadas por `entry.checkpoint`, `sint01` (con `boot:"fresh"`) → `sint06`, 28
segmentos, con sus `overlays/`. Cada ruta se declara con `"sintetico": true` y un `source` que
lo dice.

🔴 **FIDELIDAD, no sólo forma.** Un corpus sintético infiel es una trampa futura: quien lea un
aserto que pasa aquí creerá que describe el corpus real. Dos ejemplos ya corregidos, y los dos
los cazó la propia batería, no una revisión: `sint06-g02` llevaba `openedBy:"3d-neutro"` sobre
un `ctx:"dungeon"` (la etiqueta nombra una ranura NEUTRA — hoy dice `3b`), y un `ctx:"dungeon"`
nuevo quedó ni abierto ni cerrado, que es un estado que el corpus real no tiene (rojo de
`espejo-dungeon-ops`: «ningún segmento CERRADO de ctx dungeon pierde su razón declarada»). Si
inventas un segmento, pásalo por el derivador y deja que ÉL escriba `skip`/`skipReason`/
`openedBy`: son suyos, no tuyos.

Lo que instancia, a propósito:

| rasgo | dónde |
|---|---|
| cadena contigua por `entry.checkpoint`, primera con `boot:"fresh"` + `normalizeAvatarName` | las 6 |
| `enter.loc` en los BORDES del rango de location (1 y 40) | `sint01-g02` (1) · `sint04-g02` (40) |
| `enter.loc` fuera del rango de mazmorra, como control negativo | `sint03-g04` (23) |
| segmentos `skip:"pendiente-runner"` con `script` mixto (`nav`+`key`+`todo`) | `sint01-g05`, `sint02-g04`, `sint02-g05`, `sint03-g04`, `sint04-g05` |
| `openedBy` en sus cuatro fases (`3b`, `3c`, `3d`, `3d-neutro`) | `sint02-g02`/`sint06-g02` (3b) · `sint04-g02` (3c) · `sint02-g03` (3d) · `sint05-g03` (3d-neutro, y es `ctx:"resume"` — la etiqueta nombra una RANURA NEUTRA, así que no puede colgar de un `ctx:"dungeon"`) |
| costura CARRYOVER con `dungeonFrom` | `sint02-g03`, `sint05-g03` |
| el TERCER veredicto del probe de interior, `INDETERMINABLE`: una visita cuya `dungeon-enter` deja una `loc` que no es mazmorra (23), y detrás dos `post-combat` que por eso no resuelven | `sint02-g05` (la visita) → `sint02-g06`, `sint02-g07` |
| un `skip` declarado en la CAPA OVERLAY, no sólo en la ruta (el pin de #32 vive en las dos) | `overlays/sint02.json` → `sint02-g04` |
| costura de SALIDA al Underworld, y la segunda consecutiva | `sint04-g03`, `sint04-g04` |
| `recruit` / `dismiss` como ops sancionadas por overlay | `sint01-g03`, `sint05-g02` |
| DOS anclas `insertOps` distintas en el MISMO segmento (la forma de `ad13-g21`) | `sint05-g02` (12 y 20) |
| un bloque `insertOps` con `at:"first"` | `sint03-g02` (ancla 28) |
| ops de arnés: `seedGold`, `seedInt`, `seedStr`, `wait` con `src:"overlay-timing"` | `sint01-g03`, `sint03-g02` |
| `enterLoc` en los BORDES de su rango (1 y 32) y `exitOverworld` en sus DOS capas | `sint04-g04`/`sint04-g03` y `sint04-g03`/`sint03-g03` |
| ancla de transacción `{kind:"npc", expectDelta}` con ráfaga de teclas detrás cortada por un op sin `key` | `sint03-g02` |
| ancla de transacción resolviendo en el mapa grande (`loc` 0) | `sint03-g03` |
| ops de pasillo 3D (`dng`) con eco limpio y eco corrupto, con `Dir-` legible y sin él | `sint02-g02`, `sint04-g02`, `sint06-g02` |
| una parte MUDA: cero pasos de `nav` en toda la ruta (la clase de `ad02`) | `sint06` |

## Régimen: es PUNTO FIJO de las tres herramientas, y eso se comprueba

El corpus se escribió a mano y después se pasó por el pipeline hasta converger. Hoy:

```bash
node e2e/espejo-tour/tools/curate.mjs --check --routes routes-sint sint01 … sint06
node e2e/espejo-tour/tools/derive-dungeon-ops.mjs --all --routes routes-sint
node e2e/espejo-tour/tools/apply-ledger-overlay.mjs --verify --routes routes-sint sint01
```

no mueven un byte, no reportan DERIVA, ni claves RANCIAS, ni huérfanas, ni campos perdidos.
`tests/espejo-desfase-derivador.test.ts` y `tests/espejo-curate-cablear.test.ts` lo asientan
como aserto, así que **el corpus no se puede pudrir en silencio**: si alguien lo edita a mano
y lo saca del punto fijo, esos tests se ponen rojos nombrando la parte.

🔴 **Si tocas este corpus, vuelve a pasarlo por las tres herramientas.** Y si añades prosa,
que siga siendo tuya: `docs/publicacion/guarda_prosa_ea.py` barre este directorio con las tres
agujas TLK y `re/tools/test_rutas_espejo_sin_prosa_tlk_ea.py` vigila el árbol. Medido el 25-08
sobre los 13 ficheros de aquí con el predicado caro (`companion_ngram_overlap.rachas` contra el
corpus EA entero): **0 rachas a n=8 y 0 a n=5**; a n=4 la única coincidencia es `"from": 1,
"to": 6`, que es sintaxis JSON, no prosa.

🔴 **Y ESTE DIRECTORIO TIENE QUE ESTAR EN EL ÍNDICE** — es el único corpus del espejo con esa
polaridad, y no basta con que esté en disco: `re/tools/sonda_pure_publico.sh` salió VERDE con el
corpus entero UNTRACKED, porque el génesis copia con `rsync` del árbol de trabajo. La sonda
contesta «¿está en el árbol publicado?», no «¿está en el commit?». La segunda la contesta
`test_el_corpus_SINTETICO_si_esta_en_el_indice`.
