# DETECTOR «string CATALOGADO pero NUNCA EMITIDO» (tarea #47) — 2026-07-27

Instrumento: `re/tools/detect_orphan_strings.py` (reutilizable, sin dependencias).
Origen: la veta de #39 — `es.json` tenía «Mmmmm...!» y «Can't reach plate!» traducidos y
**revisados** mientras `game.ts` imprimía «Borrowed!» en su lugar.

## 1. De 3124 huérfanos de ruido a 12

El intento de #40 §5 dio **3124** y se declaró no concluyente. Con las tres
normalizaciones y la exclusión mecánica:

| categoría | n |
|---|---|
| total catalogado (`es.json`) | 3998 |
| emitido EXACTO (tras normalizar) | 1190 |
| emitido por SUBCADENA (compuestos) | 1633 |
| sale de DATOS (está en `game/assets`) | 1163 |
| **HUÉRFANOS REALES** | **12** |
| …de ellos con clase+cita en `approved-strings.json` | **0** |

**Ruido eliminado: 99,6 %.** Y el dato que más importa: **ningún string con clase + cita
queda sin emitir**, que era la pregunta cara — un string que alguien declaró user-facing
del core y que nadie imprime es el perfil exacto del sapo de #39.

## 2. Las tres causas de ceguera (la tercera no estaba en la receta)

1. **Normalización `\n`/espacios.** Las claves guardan el string EXACTO del binario; el
   código emite el texto recortado. Sin esto, `'Nothing to get!\n'` sale huérfano aunque se
   emite.
2. **Composición.** `'North\n'` se emite como `"Fly " + "North\n"` ⇒ hace falta comparar
   por SUBCADENA en las dos direcciones.
3. **★ PLANTILLAS — la que faltaba.** El corpus guarda las plantillas en forma POSICIONAL
   (`${algo}` → `{}`). El PRIMER disparo del detector marcó `'Hull now {}!\n\n'` como
   huérfano **con clase + cita** — parecía el hallazgo del carril — y era falso: `camp.ts:319`
   lo emite como `` `Hull now ${r.hull}!\n\n` ``. Colapsar la interpolación a `{}` lo
   disolvió, y con él el único candidato «con cita» que tenía el censo.
   **Lección:** el primer positivo del instrumento era del instrumento. Sin verificarlo
   contra el código habría reportado un sapo inexistente.

**Exclusión de familias de datos: MECÁNICA, no lista a mano.** En vez de enumerar
«ítems / plurales de enemigo / .TLK», el detector marca `de_datos` todo string que aparezca
en `game/assets`. Se re-calcula sola cuando cambian los assets y no hay que mantenerla.

## 3. Adjudicación de los 12

| bucket | n | strings | veredicto |
|---|---|---|---|
| **Ruido de la guarda de longitud** | 9 | `Two` `Six` `Ten` `Bat` `Ah.` `Oh.` `Oh. ` `Hi,  ` ` AM.` | **RUIDO.** Los 9 **sí están en `game/assets`**; se colaron porque la comprobación `de_datos` sólo se aplica a strings de >3 caracteres (guarda contra subcadenas espurias). Comprobado uno a uno. |
| **Sin origen localizable** | 3 | `Ring Invisibility` `Ring Protection` `Ring Regeneration` | **RAMA SIN CABLEAR** (no sapo). No están en el código NI en los assets. La mecánica de anillos sí existe (`equip.ts:330`, «Ring vanishes!» 1/16 para ids 42/44), pero sus NOMBRES no se emiten por ninguna vía. |

**Cero sapos.** Ninguno de los 12 es un caso «el core imprime otra cosa en su lugar», que
es lo que buscábamos. El sapo de #39 existía; su familia, en este corpus, está vacía.

**Por qué eso es un resultado y no un fracaso:** el detector responde la pregunta que #40
dejó abierta —«¿hay más Borrowed! ahí fuera?»— con un **no** medido y reproducible, en vez
de con un silencio. Y deja el instrumento montado para que la respuesta se recalcule cuando
el corpus o el código cambien.

## 4. Limitaciones DECLARADAS (para que nadie lea el 12 como exacto)

- **Guarda de 3 caracteres**: `de_datos` no se aplica a strings cortos, y por eso 9 de los
  12 son ruido conocido. Bajarla dispararía falsos «de_datos» por subcadena (`Two` aparece
  dentro de mil palabras). Se deja documentada en vez de tuneada a ojo.
- **Sólo `game/src`**: no barre `game/e2e` ni `game/tests`. Un string emitido únicamente
  desde un test contaría como huérfano (ninguno de los 12 lo es).
- **Literales, no tablas construidas**: un nombre compuesto en runtime desde trozos que no
  son literales puede escapar. Es exactamente el caso de los 3 anillos, y por eso su
  veredicto es «rama sin cablear» y no «sapo»: no se puede distinguir sin leer el consumidor.
- El detector **no juzga**: dice qué está catalogado y no emitido. La adjudicación
  (sapo / rama sin cablear / ruido) la hace una persona, como aquí.

## 5. Uso

```bash
python3 re/tools/detect_orphan_strings.py            # censo + los 12
python3 re/tools/detect_orphan_strings.py --json out.json --limit 40
```
