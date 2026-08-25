# careo-visual — careo FOTOGRAMA a FOTOGRAMA contra el vídeo de referencia

El espejo (`e2e/espejo-tour`) compara **texto contra texto**: es ciego a todo lo que no se
escribe — sprites, posiciones, orden de pintado, paneles, y **lo que no pasa**. Esto mira la
PANTALLA.

## Dos regímenes, dos arneses

- **RÉGIMEN 1 (ordinario)** — un par antes/después por compás. Sirve donde entre turnos la
  pantalla es una imagen quieta. `captura-port.pw.ts` + `captura.config.ts`.
- **RÉGIMEN 2 (ceremonias)** — fotograma a fotograma, porque **el contenido ES la
  animación**: una ceremonia se ve idéntica antes y después y un par no la mide.
  `captura-densa.pw.ts` (aparición del campamento, clase PALETA) y
  `captura-densa-moongate.pw.ts` (cruce de puerta lunar, clase GEOMETRÍA), con
  `densa.config.ts` / `densa-moongate.config.ts`.
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

- `captura-port.pw.ts` — conduce la piel FIEL por una lista de compases y vuelca, tras cada uno,
  el canvas **lógico 320×200 sin escalar** (`.faithful-skin canvas` + `toDataURL`, el patrón de
  `tools/pixeldiff/capture-port.pw.ts`; `querySelector("canvas")` devuelve un ornamento 8×8).
  Lleva dentro el **control positivo**.
- `captura.config.ts` — config Playwright standalone. **Sin default al 5199** (REGLA 3): desde un
  worktree ese puerto fotografía `main` y no tu rama, sin fallar ni avisar.
- `compases-*.json` — **gitignored**: el guion lleva los ecos de consola VERBATIM del binario de
  EA, igual que `e2e/espejo-tour/routes*/` desde #376. Se regenera desde el vídeo.

## Uso

```bash
# desde game/ — puerto propio 52xx censado antes con `lsof -ti :PUERTO`
CAREO_PORT=5243 CAREO_OUT=<dir> npx playwright test -c tools/careo-visual/captura.config.ts

# control positivo: divergencia VISUAL PURA (un cofre en el mapa, consola idéntica)
CAREO_PORT=5243 CAREO_SIEMBRA=cofre-dentro CAREO_OUT=<dir> npx playwright test -c …
```

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

El material (censo de los 33 episodios, hoja de careo, fotogramas) vive fuera del repo, en
`~/PROYECTS/OpenU5-videos/careo-visual/ceremonias/`.
