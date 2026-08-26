# careo-visual — careo FOTOGRAMA a FOTOGRAMA contra el vídeo de referencia

> ## ⚠ ANTES DE CAREAR NADA: LAS DOS PIEZAS QUE HACEN QUE ESTO NO MIENTA
>
> El modo de fallo peor de este careo no es equivocarse: es **quedarse ciego en silencio**.
> Un instrumento estropeado sigue emitiendo su hoja, y su informe sigue diciendo «cero
> divergencias» — que es exactamente lo que dice un careo limpio.
>
> 1. **Registro de artefactos conocidos** → `re/notes/careo-artefactos-conocidos.md`.
>    Cada avería del INSTRUMENTO ya cazada, con su **firma medible** y el control que la
>    descarta. **Antes de escribir «el port diverge», ejerce el control de esa clase**:
>    varias de esas averías costaron un carril entero persiguiendo una divergencia que no
>    existía.
> 2. **Batería de regresión del método** → `test_careolib.py` (24 controles, 1,6 s, en la
>    batería de aterrizaje) y `regresion-metodo.pw.ts` + `adjudica.py` (las escenas, con el
>    port vivo). Responde a UNA pregunta: **¿sigue el método cazando lo que una vez cazó?**
>    Cada control declara su CANAL y su RÉGIMEN, y **se estrena en cada corrida** contra el
>    instrumento roto de la manera en que históricamente se rompió.
>
> Los instrumentos que DECIDEN viven ahora en `careolib.py`, en el árbol. Lo que sigue
> fuera del repo es la decodificación del vídeo y el OCR (tocan material de EA).

El espejo (`e2e/espejo-tour`) compara **texto contra texto**: es ciego a todo lo que no se
escribe — sprites, posiciones, orden de pintado, paneles, y **lo que no pasa**. Esto mira la
PANTALLA.

## Dos regímenes, dos arneses

- **RÉGIMEN 1 (ordinario)** — un par antes/después por compás. Sirve donde entre turnos la
  pantalla es una imagen quieta. `captura-port.pw.ts` + `captura.config.ts`.
- **RÉGIMEN 2 (ceremonias)** — fotograma a fotograma, porque **el contenido ES la
  animación**: una ceremonia se ve idéntica antes y después y un par no la mide.
  `captura-densa.pw.ts` (aparición del campamento, clase PALETA),
  `captura-densa-moongate.pw.ts` (cruce de puerta lunar, clase GEOMETRÍA) y
  `captura-densa-hechizo.pw.ts` (ceremonia de CONJURO, `CAST2:0x0000` — la que el corpus
  repite 137 veces), con `densa.config.ts` / `densa-moongate.config.ts` /
  `densa-hechizo.config.ts`.
  🔴 El **control positivo del régimen 1 NO vale en el régimen 2**: un cofre sembrado en el
  mapa lo caza también un par antes/después. El del régimen 2 son las siembras
  `CAREO_SIEMBRA=pulso-corto` (cambia la DURACIÓN del pulso) y `orden-cambiado` (cambia el
  ORDEN de las dos fases, con la misma duración total) de `captura-densa.pw.ts`: ambas dan
  **0 tiles** en el par ralo y se ven a gritos en el denso. Se aplican reescribiendo el
  módulo que sirve vite (`page.route`), así que **no tocan el árbol** y no pueden quedarse
  puestas.
  🔴 Y hace falta el **control de determinismo** (dos corridas base): el fotograma de
  «después» da 28 tiles distintos entre base y siembra… y **los mismos 28 entre base y
  base2**. Son los tiles de AGUA, que el port anima a reloj de pared. Sin ese control se
  lee como «el ralo sí la caza» y se descartan dos siembras buenas.

## Qué hay aquí

- `careolib.py` — **el núcleo de instrumentos**, en el árbol: remuestreo NEAREST, diferencia
  por celda, adjudicador contra el suelo de no-determinismo, tren de pulsos con bimodalidad
  declarada, escalera de etapas, censo de animados, segmentador por eco (ficha F1),
  disparador de columna derecha con máscara (ficha F2 + overlay) y guarda de siembra
  (ficha F4). Los instrumentos **rotos** que lleva dentro (`muestrea_area`,
  `veredicto_siembra_ingenuo`, `segmenta_por_silencio`, `brillo_margen`,
  `es_ceremonia_por_extension`) NO se usan en ningún careo: existen para que la batería
  pueda ver enrojecer sus controles.
- `test_careolib.py` — la batería de regresión **del método**. Corre en la de aterrizaje.
- `regresion-metodo.pw.ts` + `regresion.config.ts` — las ESCENAS sembradas, con el port
  vivo (`base`/`base2`/`cofre`/`cofre-muro`). Lleva su propio mutante:
  `CAREO_MUTANTE=sin-siembra` corre `cofre` **sin cofre** y la cadena entera debe salir 1.
- `adjudica.py` — el veredicto de las escenas, con `careolib` como único instrumento para
  los dos regímenes. **Sale con 1 si algún control no cazó — y también si no hay nada que
  adjudicar** (un adjudicador vacío que saliera con 0 sería indistinguible de uno que lo
  encontró todo verde). Su mutante: `CAREO_MUTANTE=ralo` adjudica las capturas densas
  mirando sólo los dos instantes del par ralo.
- `captura-port.pw.ts` — conduce la piel FIEL por una lista de compases y vuelca, tras cada uno,
  el canvas **lógico 320×200 sin escalar** (`.faithful-skin canvas` + `toDataURL`, el patrón de
  `tools/pixeldiff/capture-port.pw.ts`; `querySelector("canvas")` devuelve un ornamento 8×8).
  Lleva dentro el **control positivo**.
- `captura.config.ts` — config Playwright standalone. **Sin default al 5199** (REGLA 3): desde un
  worktree ese puerto fotografía `main` y no tu rama, sin fallar ni avisar.
- `compases-*.json` — **gitignored**: el guion lleva los ecos de consola VERBATIM del binario de
  EA, igual que `e2e/espejo-tour/routes*/` desde #376. Se regenera desde el vídeo.

🔴 **Estos arneses los typechequea `game/tsconfig.tools.json`, NO `game/tsconfig.json`.** El
`npx tsc --noEmit -p game/tsconfig.json` que manda CLAUDE.md deja `game/tools/` FUERA y sale
verde con un fichero de aquí roto; la batería lo caza aparte (guarda de #267, `EXIT 64`). Antes
de pedir aterrizaje, corre también `(cd game && npx tsc --noEmit -p tsconfig.tools.json)`.
Trampa concreta ya mordida: un `import("/src/skin/fiel/speaker.ts")` dentro de un
`page.evaluate` es una URL que resuelve VITE en el navegador, no un módulo del proyecto — con
el especificador LITERAL, tsc lo intenta resolver y da `TS2307`. Va en una variable.

## Uso

```bash
# desde game/ — puerto propio 52xx censado antes con `lsof -ti :PUERTO`
CAREO_PORT=5243 CAREO_OUT=<dir> npx playwright test -c tools/careo-visual/captura.config.ts

# control positivo: divergencia VISUAL PURA (un cofre en el mapa, consola idéntica)
CAREO_PORT=5243 CAREO_SIEMBRA=cofre-dentro CAREO_OUT=<dir> npx playwright test -c …
```

### Variables (todas opcionales; sin ellas el arnés hace lo que hacía en el ch01)

| variable | para qué |
|---|---|
| `CAREO_GUION` | ruta del guion. El ch01 lo llevaba **cableado** a `compases-lf01.json`: un segundo episodio no se podía conducir sin editar el arnés. |
| `CAREO_ENTRADA` | cola del deep-link DEV con el **estado de entrada declarado**. El ch02 entra por `&loc=0&x=81&y=106&hour=9` (casilla de overworld de Britain) y deja que el propio port resuelva el `(E)nter towne`. |
| `CAREO_TIMEOUT` | el timeout es función del TAMAÑO del guion: 180 s bastaban para 14 compases y no para 1072. |
| `CAREO_SIEMBRA_TRAS` | siembra el cofre **tras ese compás**, no al arrancar. Sin esto, el control positivo del ch02 caería en el overworld y no en el mapa que se carea. |
| `CAREO_CORRECCIONES` | correcciones de posición **medidas contra el vídeo** en una pasada anterior. Arnés de estado declarado: cada una viaja en su fila. |

### Tres guardas que el ch02 obligó a poner (y por qué)

1. **No teclear si el port no está en diálogo.** Si el `(T)alk` no encuentra PNJ, las letras
   de la palabra siguiente entran como COMANDOS: la `U` abre `(U)se item`, el prompt `Item:`
   se cuelga y **se pierde todo lo que viene detrás**. Pasó con ~1000 compases y el log no
   decía nada raro.
2. **Prompt colgado ⇒ Escape.** `(Z)stats` pide jugador y deja `Player: ` esperando. 🔴 El
   predicado NO es «acaba en dos puntos»: `Dost thou wish to leave? ` también cuelga. Lo que
   distingue un prompt es el **espacio final**, no el signo.
3. **Resync de movimiento**, y **siempre después de la captura**: un paso que el port bloquea
   y el original no desfasa la posición para siempre (medido: de 12 a 97 casillas distintas en
   un compás). Si el resync fuera antes del volcado, taparía la divergencia que lo motivó.
## Batería de regresión del método

```bash
# 1) mitad de INSTRUMENTOS — barata, sin navegador, ya en la batería de aterrizaje
python3 -m pytest game/tools/careo-visual/test_careolib.py -q          # 24 en ~1,6 s

# 2) mitad de ESCENAS — con el port vivo (puerto propio 52xx CENSADO antes con lsof -ti)
cd game
CAREO_PORT=5247 CAREO_OUT=<dir> npx playwright test -c tools/careo-visual/regresion.config.ts
python3 tools/careo-visual/adjudica.py <dir>                           # exit 1 si algo no cazó

# 3) los MUTANTES (el rojo es el resultado esperado: así se estrena la cadena entera)
CAREO_MUTANTE=sin-siembra CAREO_PORT=5248 CAREO_OUT=<dir2> npx playwright test -c …
python3 tools/careo-visual/adjudica.py <dir2>        # DEBE salir 1: «cofre … NO CAZÓ»
CAREO_MUTANTE=ralo python3 tools/careo-visual/adjudica.py <dir-densa>  # DEBE salir 1
# la guarda de la ficha F4 en el arnés ordinario: (−3,−3) bajo la etiqueta `cofre`
CAREO_MUTANTE=siembra-en-muro CAREO_SIEMBRA=cofre CAREO_PORT=5249 npx playwright test -c …
#   → «SIEMBRA INVÁLIDA en (-3,-3): el tile destino 0x4d es OPACO…»
# el mensaje del guion ausente (artefacto A12): quítalo y vuelve a ponerlo
mv tools/careo-visual/compases-lf01.json /tmp/ && npx playwright test -c … ; mv /tmp/compases-lf01.json tools/careo-visual/
```

**Medido el 26-08 en este árbol** (los tres estrenos, con el port vivo):

| control | canal · régimen | veredicto |
|---|---|---|
| `base` vs `base2` (interior loc 13) | negativo · ralo | SUELO = **5 celdas / 42 px** — los 5 apliques 0xb0/0xb1/0xbf |
| `cofre` (+2,0) | visual puro · ralo | **CAZADA**: brutas 6, suelo 5, **netas 1** en `(7,6)` |
| `cofre-muro` (−3,−3) | negativo · ralo | **RECHAZADA por la guarda**: destino `0x4d` ∈ `ALWAYS_OPAQUE` |
| aparición `base` | cadencia · denso | pulsos 2187/2203/2213 · huecos 463/433 · dispersión 26 ms |
| aparición `pulso-corto` | cadencia · denso | pulsos 1196/1182/1200 · **Δmediana 1007 ms** vs umbral derivado 52 |
| **mutante** `sin-siembra` | — | `cofre` → **SUELO, netas 0** ⇒ NO CAZÓ, exit 1 ✅ |
| **mutante** `ralo` sobre las densas | — | **SIN BIMODALIDAD** ⇒ NO CAZÓ, exit 1 ✅ |

La aritmética del suelo replica de forma independiente la de la ficha F4 (6 = 1 cofre + 5
apliques), y el mutante `ralo` demuestra **sobre datos reales del port** que el régimen ralo
es ciego al canal de cadencia — no por argumento, por medida.

## Formato del guion (`compases-<ep>.json`)

```jsonc
{
  "fuente": "…webm + tramo de juego",
  "entrada": "Journey Onward (INIT)",
  "estado_declarado": { "igualado": ["…"], "NO_igualado": ["…"] },
  "pasos": [ { "id": "c01", "keys": ["ArrowUp"], "eco": "<eco>", "video_t": 1398.97 } ]
}
```

`video_t` es el instante del **desenlace** del compás en el vídeo, para parear los fotogramas.

## Lo que hace que no mienta (no saltarse ninguno)

1. **Control positivo obligatorio**: sin él, «cero divergencias» y «el método no ve» son
   indistinguibles. `CAREO_SIEMBRA=cofre-dentro` mete una diferencia de **un tile** que **no**
   toca la consola; la hoja debe cazarla. `CAREO_SIEMBRA=xshift` **no** vale para esto:
   medido, también cambia el texto.
2. **Control de determinismo**: dos corridas base deben dar **0 tiles** de diferencia, o lo que
   midas es ruido y no la siembra.
3. **Estado declarado**: lo que no se pueda igualar (p. ej. un avatar transferido de Ultima IV)
   se escribe en `estado_declarado`, o la mitad de las diferencias serán de estado.
4. **Muestreo del vídeo**: caja calibrada + **NEAREST**, nunca promediado — el vídeo es un
   reescalado nearest de un búfer 320×200 y promediar destruye el detalle de 1 px (medido:
   línea blanca del marco, 100 % con nearest frente a 0 % con `area`).
5. **Cuantizar a EGA en `int32`**: en `int16` el cuadrado de la diferencia desborda e **invierte
   negro y blanco**. Control: cada color EGA puro debe cuantizar a sí mismo.

Método completo, cifras y fichas abiertas: `~/PROYECTS/OpenU5-videos/careo-visual/ch01/`
(fuera del repo: lleva fotogramas de EA).

## Régimen 2 — lo que hace que no mienta (además de lo de arriba)

6. **Instrumento por CLASE de ceremonia.** La aparición se mide por el BRILLO del viewport
   (tren de pulsos de inversión); la puerta lunar por la ALTURA del rectángulo (escalera de
   etapas). Usar el instrumento de una en la otra no mide nada: el cruce de la puerta no
   toca la paleta y la aparición no cambia de geometría.
7. **Bimodalidad declarada.** El detector de inversión imprime la separación entre las dos
   modas del brillo antes de decidir; si es menor de 20 niveles dice «SIN BIMODALIDAD» en
   vez de inventar un tren.
8. **Muestreo por FASE relativa, no por milisegundos absolutos**, cuando las duraciones
   difieren: a los mismos ms la tabla sólo repetiría el desfase y escondería la estructura.
9. **Máscara o casado de fase para los tiles animados.** Medido: el sobremundo y los
   pueblos con agua animan en el sitio (en el original Y en el port), así que dos capturas
   del mismo estado difieren ahí. Ver `re/notes/ceremonias-cadencia-medida.md` §3.
10. 🔴 **La diferencia de FOTOGRAMAS CRUDOS satura: no puede ser el veredicto.** Corolario
    del punto 9, medido por el carril `ceremonias-serie` en (82,108): base vs base2 da **48
    tiles / 6182 px**, y base vs siembra da **exactamente los mismos 48 / 6182**. Un
    criterio de «cuántos fotogramas difieren» sale «184 de 184» en los dos casos y firma
    «la siembra NO sirve» sobre dos siembras que sí sirven. El veredicto lo da el TREN
    (duración del pulso y su arranque), que es paramétrico y tiene suelo medido de ±4 ms.
11. **La ausencia de una ceremonia se mide con su control positivo AL LADO**, en la misma
    sesión y con el mismo instrumento. `captura-densa-hechizo.pw.ts` captura el pergamino
    An Tym (separación de brillo **192,3** niveles) junto a los `(C)ast` y la poción
    (**0,08**): sin el An Tym, «no hay destello» no distingue «el port no lo pinta» de «mi
    instrumento no lo ve».

El material (censo de los 33 episodios, hoja de careo, fotogramas) vive fuera del repo, en
`~/PROYECTS/OpenU5-videos/careo-visual/ceremonias/`.
