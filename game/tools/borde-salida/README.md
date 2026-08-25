# Instrumentos del BORDE DE SALIDA del cross-slide (piel shader)

Miden, sobre los PÍXELES del navegador, cómo se comporta el borde que queda ATRÁS durante el
tween de un paso. Nacieron del reporte del usuario del 07-08-2026 («detrás, las tiles que se van
ocultando no lo hacen suave») y son los que produjeron las cifras que cita
`motion.ts › outgoingGatedMaskV0`.

Todos hablan con un dev-server propio: `U5_PORT` (por defecto 5205). **Nunca el 5199**, que es el
del usuario (REGLA 3 del CLAUDE.md). Se lanzan desde `game/`.

```bash
npx vite --port 5205 --strictPort &            # servidor propio
node tools/borde-salida/negrura.mjs "skin=shader&nointro&loc=22&floor=0&x=15&y=6&hour=0" ArrowDown > /tmp/n.json
node tools/borde-salida/pop.mjs /tmp/n.json            # la CIFRA del defecto
node tools/borde-salida/negrura-informe.mjs /tmp/n.json # el mapa 11×11 por fotograma
```

| fichero | qué mide |
|---|---|
| `negrura.mjs` | por fotograma de rAF, la FRACCIÓN de píxeles casi negros de cada celda 11×11 del viewport, más el REPOSO previo (`pre`) y el asentado. Es la materia prima. |
| `pop.mjs` | la cifra que nombra el defecto: incremento de negrura vs el reposo previo, por fotograma, separando **borde trasero** del resto. Un «pop» alcanza su máximo en f1-f2; un ocultamiento suave rampa hasta el último fotograma. |
| `negrura-informe.mjs` | el mismo dato en forma de mapa legible (`.` claro → `#` negro) por fotograma. |
| `barrido.sh` | busca posiciones y direcciones donde el borde trasero salta pronto y fuerte. Así se encontraron los 8 testigos de Paws. |
| `espaciotiempo.mjs` | diagrama ESPACIO-TIEMPO (una scanline por fotograma, apiladas): las diagonales continuas prueban que el TERRENO desliza suave — fue lo que descartó al terreno como causa. |
| `tiras.mjs`, `fotogramas.mjs` | recortes de los bordes / del viewport por fotograma, para mirar con los ojos. |

🔴 Un aviso sobre lo que NO sirvió, para que nadie lo repita: la primera versión medía el
desplazamiento por CORRELACIÓN de scanlines contra el reposo. Sobre terreno repetitivo (hierba)
el ajuste es ambiguo y sale NO MONÓTONO — daba `s` = 50, 59, 39 en fotogramas consecutivos. Se
descartó: sobre esa medida no se puede firmar nada. El diagrama espacio-tiempo respondió la misma
pregunta sin ajustar ningún parámetro.
