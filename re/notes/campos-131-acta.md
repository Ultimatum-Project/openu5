# ACTA campos-131 — el 0xEB no era un cabo suelto: es el campo que NO daña por diseño

Tarea #131. Carril `campos-131`, rama `re/campos-131`. Fecha 2026-07-28. CERO e2e.

**VEREDICTO EN UNA LÍNEA:** el castigo del interrogatorio **es PINTURA, no daño** — y por
dos razones independientes, cada una suficiente; y el `0xEB` que la tanda 7 de
`heredados-168` dejó como anomalía **no es una anomalía**: es el cuarto hechizo de campo,
cuya función es BLOQUEAR, no dañar. La nota se cierra en positivo.

---

## 0. Sesgo verificado antes de citar

`BLCKTHRN.OVL` → **base near-call 0xA290**, no supuesta: leída de la tabla de overlays del
binario: SEGMENTO DE CARGA 0x0a29, y cero entradas de reubicación ⇒ sin cabecera que
descontar.
Coincide con el valor que traía el encargo.

## 1. El cuerpo del castigo (BLCKTHRN 0x054a, `interrogate`)

Bucle de cuatro preguntas, `ret 4`. Por vuelta imprime la pregunta y evalúa la respuesta.
Interesa la rama de **NO ceder** con dos o más vivos:

- Primera negativa (`[bp-4] == 0`): pone el flag a 1 y dispara **sólo la amenaza**.
- Negativas siguientes: `advance_clock(2)` → redibujo del panel de personajes → y entonces
  un `switch` sobre el índice de pregunta que escribe un byte en **DS 0xAE39**.

Ese destino es fijo y absoluto (no indexado). Con la base del búfer que usa la arena,
`0xAE39 − 0xAD14 = 0x125 = 293`, y con el paso 32 eso es **fila 9, columna 5** — confirmado
el dato del encargo.

### 1.1 ★ La primera de las tres escrituras es INALCANZABLE

El `switch` tiene cuatro brazos: índice 0 → `0xEA`, 1 → `0xEB`, 2 → `0xE8`, 3 → una llamada
a la rutina de sacrificio (la misma que usa la rama de ceder, con el otro argumento).

Pero el flag `[bp-4]` **nace a 0 en el prólogo y su ÚNICO escritor es la rama de la
amenaza**, que corre en la primera negativa. En la pregunta 0, por tanto, una negativa toma
siempre la amenaza, y el brazo 0 del `switch` **no puede ejecutarse jamás**. El índice sólo
crece.

⇒ **Los códigos realmente escribibles son DOS, no tres: `0xEB` (pregunta 1) y `0xE8`
(pregunta 2).** El `0xEA` es código muerto. La tanda 10 enumeró los tres brazos como si los
tres ocurrieran; la enumeración es correcta, la alcanzabilidad no se había contado.

## 2. ¿Castiga o es pintura? — DOS razones independientes, ambas suficientes

**(a) La maquinaria de campos NO PUEDE correr en esta escena.** La fase de fin de turno que
aplica terreno y campos vive en `COMBAT.OVL`. Leída del binario, la tabla de overlays da
`COMBAT.OVL` y `BLCKTHRN.OVL` **en la MISMA ranura de carga** — SEGMENTO 0x0a29, junto con
FLAMES, NPC, LOOKOBJ, DNGLOOK, OUTSUBS, SHOPPES y ENDGAME. Overlays de una misma ranura son
**mutuamente excluyentes**: con la escena de Blackthorn residente, el código de la fase de
campos no está en memoria. No hay que suponer nada sobre el intérprete de la cutscene.

**(b) Aunque corriera, no vería el byte.** Leí la fase de fin de turno entera. Tiene dos
mitades y **ninguna** puede ver un código de campo puesto en ese búfer:

- La mitad de TERRENO sí lee ese búfer (con el mismo paso 32), pero **sólo compara `0x8F`,
  `0xBC` y `0x04`**. Un `0xE8`/`0xEA`/`0xEB` ahí no casa con nada.
- La mitad de CAMPOS sí compara `0xEA`/`0xE8`/`0xE9`, pero **NO lee ese búfer**: recorre las
  32 ranuras de estados de animación y mira el byte +0 de cada ranura, exigiendo además que
  las coordenadas de la ranura casen con las del registro de combate.

**Búfer equivocado para una mitad, código equivocado para la otra.** Escribir un código de
campo en la casilla (9,5) del mapa de la escena no puede dañar a nadie **por construcción**,
corra lo que corra.

**Lo que sí hace:** ese búfer es el mapa de tiles que el motor devuelve como puntero de tile
cuando la localización es alta, o sea **lo que se DIBUJA**. La propia escena lo rellena antes
de las preguntas (expande un bloque 11×11 desde un búfer compacto de paso 16) y la celda
(9,5) cae dentro de ese bloque. ⇒ **el castigo estampa un tile visible en el escenario**, y
esa es toda su consecuencia: 2 minutos de reloj, un repintado del panel y un cambio de
gráfico. Es la puesta en escena de la tortura, no su mecánica.

## 3. ★ Y el `0xEB` de la tanda 7 queda CERRADO, en positivo

La tanda 7 anotó: «existe, ocupa slot y se disipa, pero **no** produce efecto de fin de
turno», con el «pero» de quien ha encontrado un cabo suelto. **No lo es.**

Censé el literal `0xEB` como operando inmediato en TODO el corpus: **cinco** apariciones, de
las que dos no son tiles (una compara la Y de la party, otra un argumento). Las que importan:

- **COMSUBS 0x08eb-0x0907 — el PRODUCTOR.** Un despacho sobre el identificador de
  hechizo/arma coloca un campo: `0x13`→`0xEA`, `0x33`→`0xE8`, `0x34`→`0xE9`, `0x35`→`0xEA`,
  **`0x36`→`0xEB`**. Cuatro identificadores CONSECUTIVOS (0x33..0x36) producen los cuatro
  tiles consecutivos de la familia. ⇒ **el `0xEB` se castea en partida normal**; no era un
  valor sin origen, y el castigo de Blackthorn no es su único escritor (sólo el único que lo
  pone en el mapa de una escena).
- **COMBAT (fase de fin de turno) — el CONSUMIDOR**, que atiende `0xE8`, `0xE9` y `0xEA` y
  **no** `0xEB`.

Y la explicación la da el propio libro de hechizos del juego: describe In Flam Grav, In Nox
Grav e In Zu Grav como «**one of three energy field spells**» —fuego, veneno y sueño, los
tres que hacen algo a quien pisa— y de In Sanct Grav dice que «su azul reluciente **no puede
ser atravesado**», que sirve para «bloquear pasillos por completo». **Tres campos que dañan
+ uno que sólo bloquea.** Los recuentos casan uno a uno con los tres códigos que tienen
manejador y el que no lo tiene.

⇒ **El `0xEB` sin efecto de fin de turno no es una laguna del binario: es la implementación
CORRECTA de un campo-barrera**, cuya función entera es ser impasable. La observación de la
tanda 7 era exacta; el marco («pero») era el equivocado.

**Lo que NO cierro y declaro:** la igualdad nominal `identificador 0x36 = In Sanct Grav`. La
derivación sostiene «cuatro ids consecutivos → cuatro tiles consecutivos» y el recuento
3+1 casa con el libro de hechizos, pero la tabla id→nombre no la he leído. Lo que cierra la
nota es el **rol** (barrera sin efecto por turno), no el nombre; para el nombre hace falta
esa tabla.

## 4. CAREO con el port

**El port modela el interrogatorio, y bien.** `runInterrogation` (game/src/core/world/
blackthorn.ts) reproduce las cuatro rondas, el santuario cedido y el castigo de karma, el
sacrificio con más de un vivo frente al mensaje de clemencia, la salida con menos de dos
vivos, **la amenaza en la primera negativa y el castigo a partir de la segunda**, los **2
minutos por castigo** (`clockMinutes += 2`) y el sacrificio de la cuarta ronda. Es una
correspondencia fiel del cuerpo que acabo de leer.

**Lo que el port no reproduce es la escritura del tile.** Y, por §2, **eso NO es un hueco de
mecánica**: el original tampoco obtiene efecto alguno de esa escritura. Es un hueco de
**presentación** —falta el gráfico estampado en la celda (9,5) del escenario— y sólo aplica
si algún día se porta la escena como mapa de tiles; el port la resuelve por texto.

⇒ **No propongo fix.** Un fix que «modelara el castigo» con efecto sería FABRICAR una
mecánica que el original no tiene. Queda anotado como presentación, con el mecanismo
derivado, para quien porte la escena visual.

## 5. Hallazgo colateral (defecto de ledger, NO tocado)

La fila del clasificador de terreno de la party en `frontier.json` dice que ese flujo «cierra
con `0xffffcdac(2)/(4)` (**redibujado**)». **Es falso: esa rutina es el reloj**
(`kernel_advance_clock`) — leído su cuerpo, suma el argumento a los minutos, arrastra a horas
y respeta Stop Time y Quickness. O sea que la fila **etiquetó como redibujado justo el
mecanismo que estaba describiendo** (los +2/+4 minutos del terreno lento). El port lo tiene
bien en tres sitios. Es el **segundo** defecto de esa misma fila (el primero, el hueco del
tile 5, lo dejé anotado en la tarea #104). Ambos, a la ventana del disasm; no los toco.

## 6. Predicciones falsables

1. Una partida que se niegue a las cuatro preguntas estampará `0xEB` y luego `0xE8` en (9,5),
   **nunca** `0xEA`.
2. Ningún estado del party cambia por esas escrituras: sólo reloj (+2 por castigo) y sacrificio
   en la cuarta.
3. Un campo `0xEB` casteado en arena bloqueará el paso y **no** producirá mensaje ni daño de
   fin de turno; los otros tres sí.
4. Si alguien porta la fase de campos leyendo el mapa de la arena en vez de las ranuras de
   animación, los campos dejarán de funcionar: viven en las ranuras.

## 7. Verificación

- Base de overlay y ranura de carga: leídas de la tabla del binario.
- Cuerpo del interrogatorio, fase de fin de turno y productor de campos: leídos enteros del
  listado, con los near-call resueltos con la base verificada.
- Censo de `0xEB` como operando inmediato: 5 en todo el corpus, clasificadas una a una.
- Gates: ver el mensaje al lead.
