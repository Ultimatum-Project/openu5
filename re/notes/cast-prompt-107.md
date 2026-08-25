# Acta #107 — el prompt de (C)ast son DOS filas, y el port pintaba UNA

Carril: `cola-e2e` · rama `e2e/cola-desbloqueada` · base `main@9a92024f` · 30-07-2026

## 0. Qué era la ficha

La cola la traía en cinco palabras: «#107 (prompt de 2 filas de Cast)». Sin acta propia y
sin puntero. La reconstrucción salió de `re/notes/cast-input.md`, que ya tenía la cita
buena y la dejó anotada sin cablearla.

## 1. El original: UNA cadena con el salto DENTRO

`cast-input.md` línea 96, ya lo decía:

> Prompt Cast = 0x4603 **"Spell name:\n:"**. Prompt Mix = 0x8fac **"For what spell?\n:"**.

Las dos cadenas de DATA.OVL llevan el `\n` horneado. El `\n` abre fila y el `:` es el
CURSOR del getstring, así que lo TECLEADO se ecoa en esa segunda fila:

```
Spell name:
:IN LOR▓
```

Y no es una lectura solitaria: el mismo modelo está cableado desde hace días en (Y)ell
(`"what?\n:"`) y en Talk, los dos usando la misma constante de cursor.

**Testigo del original** (`original/av-referencia/`, gitignored, no viaja):
`active-player/ORIG_set-active-plr-y-cast-directo.png` muestra las tres filas — eco del
comando, etiqueta, y la fila del `:` con el cursor. Coincide con la cadena byte a byte.

## 2. El defecto era del CALL-SITE, no del motor

Esto es lo que hace la ficha barata, y conviene que quede escrito: **el renderer ya sabía
partirlo**. Control positivo que ya existía y ya estaba verde,
`game/tests/skin-coreview.test.ts`: volcar la cadena entera por consola produce las dos
filas `["Spell name:", ":"]`.

El que pintaba una sola fila era `pickSpellTyped` (`game/src/ui/pickers.ts`), con un único
`hud.echo(prefix)` y sin fila de cursor. Y el eco de las sílabas colgaba de la ETIQUETA
(`prefix + syllables`), produciendo `"Spell name: IN LOR"` de 18 columnas en una fila,
donde el original tiene `"Spell name:"` y `":IN LOR"`.

## 3. El fix

Failing-first: tres tests nuevos en `game/tests/pickers-unit.test.ts`, los tres ROJOS
antes de tocar código (el viejo sello `expect(echoes).toEqual(["Spell name: "])` era
justamente el que ratificaba la fila única).

`pickSpellTyped` ahora emite la etiqueta, abre la fila del cursor y cuelga el eco de las
sílabas de ESA fila. Cubre Cast y Mix por el mismo camino.

### ⚠ Por qué se recorta el espacio final del `prefix`

Los cuatro llamadores viven en `main.ts`, **bajo embargo**, y pasan la etiqueta con un
ESPACIO final (`"Spell name: "`) como sustituto del `\n` del binario. Ese espacio es
relleno de la fila única vieja, no texto del original: al abrir la fila del cursor deja de
tener a qué separar. Se recorta en el picker, y así el fix entero cabe fuera del embargo.
La traducción NO se toca: el corpus sigue teniendo su clave con el espacio.

Si algún día se levanta el embargo, lo limpio es que los llamadores pasen la etiqueta sin
el relleno y el recorte desaparezca. Queda anotado como deuda, no como diseño.

## 4. Verificación

- `tsc` EXIT 0 — y **sin tocar `main.ts`**: su objeto de hud ya exponía la fila de cursor,
  así que el tipo nuevo del picker encajó sin cambiar un llamador.
- Suite unitaria completa: **314 ficheros / 4002 tests verdes**, 1 skipped.
- e2e en el 5204: `magic-ready` + `active-player` + `cmd-prompts` = **14/14 verdes**.
  Ninguno se rompió porque todos cruzan el prompt con `includes`, no por igualdad.

## 5. Lo que NO cierra — el cabo adyacente

`cast-input.md` línea 49 deriva, además, un **wrap a 13 columnas** dentro del eco rúnico:
el binario, antes de ecoar cada palabra, mide la columna y si `cursor + len > 13` imprime
un salto. Eso **sigue sin portar**: el gestor de prompts concatena las sílabas sin mirar
la longitud.

No lo he metido aquí a propósito — la ficha dice «prompt de 2 filas» y eso es lo que se ha
cerrado. El wrap es conducta distinta, necesita su propio failing-first y probablemente su
propia ficha. Lo dejo nombrado para que no se pierda, que es como se pierden.
