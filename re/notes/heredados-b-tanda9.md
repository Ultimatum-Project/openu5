# heredados-b · TANDA 9 — dos tablas que se solapan, y un verbo que no se sostiene

Carril `heredados-b` · 2026-07-28 · rama `re/heredados-b`.
Contador `verified_inherited_without_cite`: **105 → 103**.

> Verificada con `seed_gate.py`: 0 sembradas, 0 cambiadas.

| # | rutina | nombre | veredicto |
|---|---|---|---|
| 1 | `ENDGAME.OVL:0x28c` | `spell_cardinal (…)` | ACREDITADA — ★★ las dos tablas comparten una palabra |
| 2 | `INTRO.OVL:0x2024` | `draw_transfer_frame (U4 import)` | sello SÍ, **`naming_verified` NO** — ★ la parte que parecía dibujar, no dibuja |

---

## 1. ★★ El deletreador: dos tablas que se solapan a propósito

Deletrea un cardinal en palabras. Por debajo de 21 indexa directo una tabla de punteros; de
21 en adelante divide por diez, imprime la decena desde una **segunda** tabla, y si el resto
no es cero añade un separador y la unidad desde **la primera**.

**Lo que importa para un porte:** las dos tablas **no son independientes**. La distancia
entre sus bases es de 18 palabras, así que la entrada de decenas para el cociente 2 cae en
la **misma dirección** que la entrada 20 de la primera tabla — comprobado por aritmética.
**«Veinte» es una sola palabra compartida por las dos.**

Y la consecuencia práctica: las entradas 0 y 1 de la tabla de decenas son en realidad las
palabras 18 y 19 de la primera, y **nunca son alcanzables** como decenas, porque un número
≥ 21 tiene cociente ≥ 2. Quien extraiga «la tabla de decenas» desde su base se lleva
`[dieciocho, diecinueve, veinte, treinta, …]` y la indexará mal si no descuenta ese solape.

⚠ Menor: la división se calcula **dos veces** sobre el mismo operando. Redundante, sin
efecto observable.

---

## 2. ★ El «frame» que no dibuja — y por qué leí una rutina que no era mía

`draw_transfer_frame` tenía tres llamadas a una primitiva de cinco argumentos que eran el
candidato obvio al «frame». **Podía haber declarado el hueco y seguir. Leí la primitiva —
57 bytes— y resultó que no dibuja nada:** guarda un rectángulo, ya recortado y normalizado
sobre la rejilla de texto, en una ranura de una tabla de **cuatro** registros; si la ranura
se pasa de cuatro, no hace nada. Es decir, **define regiones de texto**.

Las tres que define esta rutina, en coordenadas de esa rejilla: **(0,0)-(19,18)**,
**(21,0)-(39,18)** y **(3,21)-(37,21)** — dos paneles verticales y una banda inferior.
Después fija color dos veces, coloca el cursor y emite **un espacio**.

Por eso concedo el sello y **no** `naming_verified`: **la parte que parecía dibujar el
marco no dibuja**. Y lo que *no* cierro va dicho para que nadie lo lea como cerrado —
quedan **dos callees sin nombre** que no he leído, y el término «frame» podría sostenerse
ahí. Lo que está establecido es dónde **no** está.

«(U4 import)» es contexto de `intro.md` y de su hermana `draw_transfer_stat`, no algo que
fije este cuerpo. Y la rutina **no tiene prólogo**: es la hoja que `intro.md:291` ya contaba
aparte al censar los prólogos del overlay.

---

## 3. Estado

**28 filas adjudicadas**; contador **128 → 103**.

Van **tres filas seguidas** en las que el cuerpo sostiene el sustantivo pero no el
calificativo —`present_reward`, `frame`, y antes `road`—. No es casualidad del muestreo:
los nombres del barrido de 2026-07-25 se construyeron con el contexto del llamador delante,
así que **el sustantivo suele venir del cuerpo y el calificativo del entorno**. Declararlo
por fila sale más barato que renombrar, y deja el recorte para quien tenga el testigo.

**Cola:** los fuertes por tamaño, empezando por `BLCKTHRN.OVL:0x54a` (196 B, `interrogate`,
que además es el único llamador de la fila que adjudiqué en la tanda 8).
