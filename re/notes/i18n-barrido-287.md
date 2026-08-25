# #287 — el canal «literal por CONSTANTE» está LIMPIO, y me costó tres defectos de instrumento llegar a saberlo

Continuación directa del lote de hoy (#213 negativa → #160 y #16 reales). Aquel barrido sólo
veía literales **pasados directamente** a `t()`/`tf()`; esta ficha ataca el otro canal: los
que entran por una **constante** (`t(SHOP_UI.algo)`, `t(REAGENT_NAMES[i])`, …).

## 1. Resultado

**21 constantes · 226 valores · 5 sin entrada en `es.json`.** De esos 5:

| valor | veredicto |
|---|---|
| `Avatar` | identidad correcta — se escribe igual en español; familia `CLASS_NAMES` 8/9 con entrada |
| `\n"` · `!"\n\n` · `?\n\n` · `?" ` | fragmentos de PUNTUACIÓN del compositor de `SHOPPE.DAT`; sin palabras que traducir |

⇒ **cero fugas de inglés por este canal.** Las dos fugas reales de hoy —el par «odd key» y
los verbos de transporte— venían del canal de literal DIRECTO, no de éste.

## 2. ★★ Los TRES defectos del instrumento, en orden, y lo que cada uno hacía

Esto es lo que de verdad merece quedar escrito: la cifra de «sin entrada» fue **27 → 10 → 5**
sin que el repositorio cambiara. Los 22 que se cayeron eran míos.

**(a) Comentarios tragados.** El emparejador de llaves recorre el cuerpo entero de la
constante, y los comentarios de dentro llevan comillas. Salían «cadenas» como
`', //  shoppe.json 119 '` y `"', // MISCMSG rec1 (DS 0xb24b) + virtud + ?"`. Arreglo: podar
comentarios ANTES, con un podador que respete las comillas (si no, se come medio fichero).

**(b) Raíz no filtrada.** Aceptaba cualquier identificador antes del punto, así que variables
locales como `ev` o `beat` entraban como si fueran tablas de UI y aportaban `'message'`,
`'sfx'`, `'dungeon-zap'` —discriminadores de evento, no texto— a la lista de «fugas».
Arreglo: exigir raíz EN MAYÚSCULAS, que es la convención de las constantes del repo.

**(c) ★ Sólo comilla DOBLE.** El más traicionero. `SHOP_UI` usa comilla SIMPLE justo para las
cadenas que llevan comillas dobles dentro: `'\n"I thank thee!"\nsays $.\n'`. Mi regex casaba
el `"I thank thee!"` de DENTRO y lo presentaba como una cadena ausente del corpus. **La clave
real —la cadena entera— sí está**. Lo mismo se llevaba por delante las tres plantillas de
interrogatorio de Blackthorn, que también figuraban como ausentes y también están.

**Lo que lo destapó** fue ir a comprobar UNA de las supuestas fugas antes de traducirla:
`grep "I thank thee!"` devolvió la línea del fichero y la cadena real no era la que yo tenía.
Si llego a traducir las diez sin mirar, habría metido diez claves que nadie consulta y habría
declarado arreglada una fuga inexistente.

## 3. Lo que este barrido SIGUE sin ver (cota declarada)

- Constantes cuya raíz no es mayúscula o que no se declaran como `const NAME = {…}` / `[…]`.
- Valores construidos (concatenación, `template literal` con interpolación).
- Cadenas que llegan a `t()` a través de una **función** que devuelve un conjunto cerrado —
  `partOfDayWord()` es el caso canónico y hoy quedó cubierto sólo porque #213 lo nombraba.

⇒ **226 es cota inferior de la población y 5 cota inferior de los fallos.** No se puede
concluir «i18n limpia»; sí se puede concluir «el canal de constante, tal como lo mide este
instrumento, no tiene fugas».

## 4. Regla que se lleva

Antes de traducir una cadena que un barrido declara ausente, **búscala en su fichero y
compárala con lo que el barrido dice que es**. Tres de mis tres defectos producían el mismo
síntoma —una cadena plausible que «falta»— y ninguno se veía desde la lista de resultados.
Hermana de [[cita-equivocada-peor-que-ninguna]]: una traducción de una clave que no existe es
peor que no traducir, porque además parece trabajo hecho.
