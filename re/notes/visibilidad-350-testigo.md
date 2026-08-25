# Acta #350 — testigo de ORÁCULO del puente de visibilidad (cabo declarado de #256 §5)

> Cerrada el 20-08 ~04h30 con el batch de seis posiciones y el trace de aristas.
> (El banner de borrador del commit protector queda retirado.)

Carril fix-350, noche del 2026-08-19/20. Pregunta de la ficha: **«¿el halo de una
antorcha sólo extiende la visión si TOCA el disco de la party?»** — la consecuencia
semántica que el acta #256 §1 derivó del ASM y dejó SIN testigo empírico (§5: «el
modelo de referencia es una TRANSCRIPCIÓN del desensamblado, no un testigo de DOSBox»).

Instrumentos (todos en el árbol, con su derivación en los mensajes de commit):
`re/tools/visibility_bridge_probe.py` (testigo de ventana) ·
`game/tests/visibility-bridge-350.oracle-expected.ts` +
`re/tools/visibility_bridge_expected.json` (predicción ANCLADA antes de la corrida) ·
`re/tools/visibility_bridge_v2_sim.py` (simulador de la semántica re-leída) ·
`re/tools/visibility_flood_trace_probe.py` (trace de aristas del flood).

## §1 — El experimento

Sótano de Lord British (loc 0x11, z=−1 ⇒ `lightLevel()`=2 por `0x50BA cmp
[g_floor],0x7f; ja`, sin depender de la hora), party sembrada en (17,26) por la vía
soportada del espejo (ch02.gam parcheado: floor 0xFF, x/y, obj0, luz rel 0x2FF=2,
antorcha/hechizo a 0; seed + Journey Onward — NUNCA pokes de `g_location`, trampa
documentada en shadowlord-av-243.md §4). Paseo hacia el este por la fila y=26, hacia
el sconce 0xB0 de (27,24). En cada posición, con el BP en `ULTIMA.EXE:0x598A` (la
instrucción tras `5987 call 0x5D0A`: emisores y pase de party recién escritos, ningún
fotograma incremental ha pisado 0xAB02, y `g_unk_24e6` aún NO limpiado):

- `g_vis_buffer` 0xAB02 (352 B, 11 filas × zancada 32): oculta = 0xFF.
- máscara de luces 0xAD14 (1024 B, índice global `(fila<<5)+col`): iluminada ≠ 0.

Predicción del modelo transcrito (commit a26b4199, ANTES de la corrida): en
x=17..19 hasta 21 celdas iluminadas dentro de la ventana con CERO visibles (halo sin
tocar el disco); en x=20 se enciende UN muro iluminado (asimetría opaca); en x=21 el
halo toca el disco vía (22,27) y la ventana salta de 10 a 41 visibles.

## §2 — Cinco trampas de instrumento, medidas y neutralizadas

1. **La navegación del oráculo no estaba rota: estaba MAL DETECTADA — y además el
   emulador cambió.** Dos capas, adjudicadas por separado:
   (a) mecanismo (carril de #138, citado): `_find_roster()` busca los primeros 0x20
   bytes de SAVED.GAM y el juego los MUTA al cargar — el guion declara fracaso
   estando YA en el mundo, y sus teclas sobrantes se consumen como COMANDOS.
   (b) versión (este carril, discriminante medido): con dosbox-x **2026.07.02** el
   MISMO guion de serie encuentra el roster y llega al mundo en 78 s; con
   **2026.08.02** (el instalado: /Applications del 03-08, cask del 16-08; la caché
   del oráculo se reconstruyó el 19-08 al vaciarse /private/tmp — el día exacto en
   que xit-pila-273 §6 midió sus 4 intentos fallidos) no lo encuentra nunca.
   Remedio adoptado (patrón de #138): navegación por Enters + detección por GLOBALS
   EN CRUDO contra el save sembrado (0x5893/0x5895/0x5896/0x5897) — válida bajo las
   DOS versiones; mundo en 70 s con 3 Enters.
2. **El falso POSITIVO de `at_code_bp` (EV rancio, regla 6 de oracle.md).** Una
   «lectura en el BP» trajo ceros en g_vis_buffer que el ASM de 0x5D0A hace
   imposibles en el BP genuino (5d12-5d31 re-siembra 11×11 a 0xFF; 5d76-5d8a
   convierte 0→0xFF). Validador barato que no existía: en la pausa genuina
   `g_unk_24e6 ≠ 0` (el BP cae ANTES del `mov` que lo limpia), más IP leído dos
   veces y doble lectura idéntica de la ventana.
3. **El falso NEGATIVO del mismo validador.** Un misread transitorio descarta la
   pausa genuina; si el paso del paseo exige la posición OBJETIVO exacta, el retry
   empuja a la party más allá y el careo muere. Remedio: el paso se declara por
   CAMBIO de posición, el careo usa la posición REAL, y `g_unk_24e6=1` se re-fuerza
   cada 25 reanudas (el recálculo es idempotente: fabrica nuevas oportunidades).
4. **La tabla de actores vacía desmintió al «NPC bloqueador»**: el fallo del paseo
   de la corrida v3 era el punto 3, no un actor (0x5C5A: sólo el avatar).
5. **El primer simulador de la semántica re-leída SE COLGÓ — y el cuelgue fue
   evidencia**: un push incondicional de indecisos no termina nunca; el binario
   termina porque el camino de fallo escribe 0xFF también en [bp-0x214] y 0xFF ES
   opaca para el push (0x5DFE la tiene en tabla) — el truco del 0xFF-como-tile.

## §3 — La semántica VERDADERA de 0x5A28 (modo party), leída instrucción a instrucción

Lo que el testigo obligó a re-leer, con las citas crudas:

- **Gate de evaluación** (`5b90 cmp [si],0xff / je`): una celda sólo se evalúa si su
  byte destino es 0xFF. Las columnas 11..31 de la zancada NO se re-siembran ⇒ fuera
  del encuadre mandan los bytes RANCIOS del buffer.
- **Radial 0x6FF0**: coords locales ≥ 11 (fila o columna) devuelven **0** (`703b xor
  ax,ax`) — todo lo evaluable fuera del encuadre está «dentro del radio»; 6..10 se
  pliegan (`7015 mov ax,10 / xchg / sub` = 10−v); tabla 6×6 en DS:0x6AA8.
- **Dentro del radio** (`5bd9 cmp ax,[bp+0x10]`, umbral light+1 por el inc de 5a66):
  visible, escribe el tile (5c93); empuja si transparente.
- **Opaca fuera del radio** (5c52): clamp GLOBAL 0..31 (5c59/5c68/5c6a/5c6f) y
  visible ⟺ la PROPIA celda en 0xAD14 (5c8c) — SIN mirar al padre. Confirmada en
  crudo la asimetría del acta #256 §1.
- **Transparente fuera del radio — el PUENTE** (5c05): visible ⟺ **padre ≠ 0**
  (`5c14 cmp byte [bx+di],0 / je` — ¡el 0xFF INDECISO también pasa!) **Y** padre en
  0xAD14 (5c29) **Y** propia en 0xAD14 (5c40). Si falla: escribe 0xFF (reintentable)
  y NO propaga (§2.5).
- **Cola**: semilla única (5,5) (5a69-5a82); el pop (5abc) fija padre=celda; sólo
  empujan las transparentes VISIBLES.

Diferencias contra la transcripción de #256 (`visibility-original-referencia.model.ts`):
el modelo acota el flood a la ventana 11×11 y exige padre VISIBLE; el binario acota a
0..31 GLOBAL, deja pasar como padre a lo indeciso y lo rancio (≠0), y su radial
degenera a 0 fuera del marco local de 11. Dentro del encuadre sin fuentes de borde,
ambas coinciden — por eso la sonda de #256 (modelo vs port) no podía ver esta capa.

## §4 — Lo medido (corridas v3/v4 del testigo, dosbox-x 2026.07.02, pausas validadas)

Batch de UN BOOT POR POSICIÓN (la vía que funcionó 4/4 donde el paseo por flechas
murió 3/3 bajo confound de pty), seis posiciones, todas con luz=2 y pausa validada:

| px | visibles RAM | visibles modelo | mismatches | halo en 0xAD14 |
|----|----|----|----|----|
| 17 | 11 | 9  | 2  | 7/7 |
| 19 | 19 | 9  | 10 | 21/21 |
| 20 | 32 | 10 | 22 | 30/30 |
| 21 | 41 | 41 | **0** | 40/40 |
| 22 | 49 | 49 | **0** | 50/50 |
| 25 | 57 | 57 | **0** | 64/64 |

- **Cota de la divergencia, medida sobre las 726 celdas-posición**: 34 mismatches en
  total; los 34 son celdas ILUMINADAS en 0xAD14 (no-lit = 0) y los 34 son
  SOBRE-revelado del original (sub = 0: el original jamás enseña menos que el
  modelo). El sobre-revelado crece al acercarse (2→10→22) y se APAGA de golpe en el
  contacto: desde px=21 (el punto exacto donde la predicción anclada ponía la
  transición del puente) la coincidencia es celda a celda, TRES posiciones seguidas.
- px=17 en detalle: 7/7 celdas del halo presentes en 0xAD14 (control positivo) y
  cero puentes del modelo visibles — la sala iluminada NO se ve… salvo el ISLOTE
  (22,27) suelo 0x44 + (22,28) muro 0x4F, reproducido en CUATRO corridas
  independientes bajo pausa validada.
- TRACE de aristas (BP en 0x5C93, dos fases, dobles lecturas): el pase de la party
  escribe primero el disco (8 aristas desde (5,5), en el orden exacto del anillo de
  la tabla de saltos 5b16) y luego el islote con sus padres nombrados:
  **(22,27) ← (21,27)** y **(22,28) ← (22,27)**. La celda (21,27) NO está iluminada
  en la máscara final (byte 00) y NO recibió escritura visible — y aun así actuó de
  CELDA DE COLA: con la mecánica de §3 tal como está leída, nada la encola. Los
  hits posteriores del trace (valor 0xFF, coords erráticas) son del BARRIDO DE
  EMISORES del redraw siguiente (modo 0 con tiles basura de emisores cuyo marco se
  sale del mapa, p. ej. (25,2)), no del pase de la party.
- Los volcados pre/post del buffer refutan además el paseo-fuera-del-encuadre como
  vía: columnas 11..31 TODO CEROS antes y después (el flood jamás escribió fuera), y
  la relectura de la tabla de saltos lo sella en frío: el clamp del paseo es
  **0..10** (5b2b-5b40), la ventana — el 0..31 de 5c59/5c6a es solo para los
  consultas globales de 0xAD14.
- Los JSON de las corridas viven en el scratch de la sesión y NO se commitean a
  propósito: llevan rejillas de tiles (material EA, la misma razón por la que
  smallmaps.json está gitignored — ficha #307). Los probes commiteados los
  regeneran.

## §5 — VEREDICTO sobre la pregunta de #350

**«¿El halo de una antorcha sólo extiende la visión si TOCA el disco de la party?»**

- **En régimen de CONTACTO: SÍ, y EXACTO.** Desde el primer px donde la predicción
  anclada ponía la transición (px=21), el conjunto revelado por el original coincide
  celda a celda con el puente transcrito de #256 — tres posiciones, 363 celdas,
  cero mismatches. El modelo de referencia y el calco de #256 quedan ACREDITADOS
  EMPÍRICAMENTE en este régimen (lo que el acta #256 §5 declaraba pendiente).
- **A DISTANCIA: NO como regla absoluta.** Con el halo sin tocar el disco, el
  original revela ADEMÁS un subconjunto de las celdas iluminadas (2→10→22 según
  cercanía en esta escena), que ni el puente transcrito ni el port revelan. La
  divergencia está ACOTADA por los datos: sólo celdas EN 0xAD14, sólo en la
  dirección original>port, nunca al revés. Es exactamente la brecha que el docblock
  de visibility.ts declaraba a ciegas («aproximación CONSERVADORA: nunca revela más
  que el original») — ahora MEDIDA por primera vez, con su magnitud y su forma.
- Para el jugador: en 1988 una sala con antorchas RESPLANDECE parcialmente desde
  más lejos de lo que el port enseña hoy; al acercarse (halo tocando el disco) las
  dos versiones convergen a la casilla.
- El MICRO-MECANISMO de la vía lejana queda ABIERTO y acotado (ficha nueva, §6): el
  trace nombra a (21,27) como celda de cola sin encolador conocido; la semántica de
  §3 (leída en crudo y verificada por el simulador V2, que reproduce el régimen de
  contacto) no lo produce. El instrumento para cerrarlo ya está en el árbol.

## §6 — Colaterales para el panel

- FICHA NUEVA (resplandor a distancia): el original revela parte del halo SIN que
  toque el disco (§4: 34 celdas medidas, cota estricta = subconjunto de 0xAD14,
  siempre original>port). 🔴 La primera hipótesis mecánica de esta acta (paseo
  fuera del encuadre por rancios+radial-0) quedó REFUTADA por tres vías (pre/post
  ceros en cols 11..31, clamp 0..10 leído en frío, sim V2 con rancios reales) — el
  encolador de (21,27) sigue sin nombre. Quien la retome: correr
  visibility_flood_trace_probe con BP adicional en el PUSH (5cc4/5cd4) para ver
  QUIÉN escribe la cola, no solo quién escribe celdas. Hasta cerrar el mecanismo,
  NO portar el resplandor (sería calcar una conducta sin derivación); la dirección
  del defecto del port (sub-revelado conservador declarado) queda registrada.
- FICHA NUEVA (oráculo): `_find_roster`/guion de serie rotos bajo dosbox-x 2026.08.02
  (capa a de §2.1, mecanismo de #138) — oracle.py tiene dueño (REGLA 4): el remedio
  vive hoy en los probes; decidir si el dueño lo sube a `send_keys_until_main_menu`.
- La caché del oráculo en /private/tmp muere con cada reboot y se reconstruye del
  /Applications VIGENTE: un upgrade de dosbox-x cambia el emulador de TODOS los
  carriles sin que nadie lo pida (así se rompió el 19-08).
