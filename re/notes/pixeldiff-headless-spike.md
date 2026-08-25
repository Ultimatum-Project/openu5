# Spike: capturas headless del original para el arnés píxel-diff (task #26 fase 2)

> Fecha: 2026-07-15. Pregunta: ¿se pueden obtener CAPTURAS de la pantalla del
> Ultima V original corriendo en el dosbox-x **headless** del oráculo
> (`re/tools/oracle.py`), sin la ventana del usuario? Motivo: la fase 2 del
> arnés (`docs/superpowers/specs/2026-07-15-pixel-diff-harness.md §5`) necesita
> el gemelo exacto —mismo estado— del shot Playwright del port, y el bloqueo
> declarado era "necesita ventana DOSBox".

## VEREDICTO: **VIABLE**

Se obtiene un **PNG nativo 320×200 pixel-exacto** del frame que el original
está mostrando, dentro del dosbox-x headless del oráculo, sin abrir ninguna
ventana. Probado en vivo: boot del oráculo → mundo → captura → PNG con el
chrome EGA completo, paneles (roster, F/G, fecha), consola con prompt `>` y el
sprite del avatar, todo con los colores EGA correctos.

## Vía ganadora: leer la VRAM EGA por el debugger (OUTP + MEMDUMPBIN)

Ultima V en EGA usa el **modo 0Dh** (320×200, 16 col, 4 planos planares en
A000; `drivers-drv.md §1`, confirmado en vivo `video_mode()==0x0D`). El
descubrimiento clave: **el debugger integrado de dosbox-x expone comandos de
puerto I/O y de volcado de memoria** que el oráculo ya puede teclear por el
pty (build 2026.07.02, extraídos de la ayuda del debugger en el binario):

```
IN[P|W|D]  [port]          - I/O port read byte/word/dword.
OUT[P|W|D] [port] [data]   - I/O port write byte/word/dword.
MEMDUMPBIN [s]:[o] [len]   - Write memory to file memdump.bin.
VRD                        - Redraw video.
```

Procedimiento (en pausa, reloj emulado congelado → lectura no destructiva):

1. Para cada plano `p` en 0..3, fijar el **Read Map Select** del Graphics
   Controller: `OUTP 3CE 04` (índice reg 4) + `OUTP 3CF <p>`.
2. Volcar ese plano: `MEMDUMPBIN A000:0000 1F40` (8000 B = 320·200/8) — lo
   hace `oracle.Session.read_mem(0xA000, 0, 0x1F40)` tal cual.
3. Combinar bit a bit: el plano `p` aporta el bit `p` del índice EGA (MSB de
   cada byte = píxel más a la izquierda). → índices 0..15 (200×320).
4. Mapear con la paleta EGA real de U5 (idx6 oliva) → RGB → PNG.

**Por qué funciona:** la lectura del CPU a A000 pasa por el handler de VGA de
dosbox-x en read mode 0, así que `MEMDUMPBIN` devuelve EXACTAMENTE los bytes
del plano seleccionado por el Read Map Select. Verificado: con la selección de
plano los 4 volcados **difieren** (`page0: 4 planos identicos? False`) y
reconstruyen la pantalla real; sin ella darían el mismo plano 4 veces.

**Front buffer = A000:0000.** U5 hace doble búfer con el offscreen en A800
(= A000:8000, `drivers-drv.md` selector 0x06). En reposo el offscreen está en
blanco (`page1 histograma: [64000,0,...]` = todo negro) y el front tiene el
frame (`page0`: 7897 px azul del marco + 2464 blancos de texto + rojo/oliva
del suelo). El módulo lee la página 0 por defecto.

## Prueba hecha: SÍ — captura de calidad pixel-exacta

- Script del spike (scratch, no commiteado):
  `<scratch>/capture_spike.py`
- Captura de prueba (scratch, no commiteada):
  `<scratch>/cap_page0.png` (escala ×3).
- Estado capturado: mundo cargado desde el `SAVED.GAM` de referencia
  (`original/u5/ultima5`; party Elwood/Shamino/Iolo, F:71 G:717, fecha
  4-10-139). El chrome, los tres paneles, el texto y el sprite del avatar
  salen **idénticos a como los pinta DOSBox** (comparado a ojo con
  `original/av-referencia/par-iolohut-port.png`, que es una captura DOSBox de
  otra escena). Los colores EGA son exactos (marco azul idx1, texto blanco,
  ladrillo rojo/amarillo, avatar verde).
- Caveat de estado observado: el **viewport salió casi en negro** salvo el
  entorno inmediato del avatar. No es defecto de la captura: el oráculo
  (`send_keys_until_main_menu`) pausa en cuanto se estabiliza la región del
  roster (0x200 B), que se asienta ANTES de que el juego termine el primer
  repintado completo del viewport (flood LOS). Para la fase 2 hay que **asentar
  el frame** antes de capturar (abajo).

## Módulo entregado + test

- `re/tools/oracle_capture.py` — captura sobre una `oracle.Session` ya navegada
  al mundo: `capture_idx(sess)` (→ índices 200×320), `save_png`, `idx_to_rgb`,
  y `capture_to_png(out)` de conveniencia (boot completo → PNG). **No modifica
  `oracle.py`** (usa sus primitivas públicas + `_send`/`_pump` para los OUTP).
  La paleta EGA va embebida (misma tabla que `pdlib.PALETTE`) para que
  `re/tools` sea autónomo.
- `re/tools/test_oracle_capture.py` — 10 tests de la reconstrucción planar pura
  (orden de bits MSB, pesos de plano, stride de fila, paleta). **Corre sin
  dosbox** (`python3 -m pytest re/tools/test_oracle_capture.py -q` → 10 passed).

## Qué falta para integrarlo en el arnés de #26

1. **Asentar el frame antes de capturar.** Tras cargar el save, avanzar 1 turno
   (o unos ticks) para que el viewport termine su repintado, y opcionalmente
   emitir `VRD`, antes de `capture_idx`. Definir el punto de captura canónico
   (p.ej. "un turno consumido en reposo") para que port y original comparen el
   MISMO instante lógico.
2. **Cargar los saves AV mismo-estado.** `oracle.boot()` copia el juego de
   `original/u5/ultima5` y usa su `SAVED.GAM`. Para capturar un estado concreto
   (los 15 `original/av-saves/SAVED.GAM.*`, `plan-sesion-av §9`) hace falta
   sembrar ese save en el `run_dir/game/SAVED.GAM` que `boot()` crea. Opciones:
   (a) añadir a `oracle.boot()` un parámetro `save_path` (toca oracle.py —
   ahora sucio de otra sesión, coordinar); (b) un `capture-original.py` que
   prepare el run dir. El emparejado nombre-de-shot → save lo define el arnés.
3. **Escala entera al lado del arnés.** La captura ya es nativa 320×200
   (píxel cuadrado, sin el ×1.2 del port): `pdlib.normalize()` la ingiere
   directamente y el `aspect_mismatch` de fase 1 desaparece solo cuando el port
   pase a píxel cuadrado (F-0). Con mismo-estado, las regiones de cromo/panel/
   consola pasan a `mode: strict` y `border_rule` (1px) se resuelve.
4. **Selección de página robusta (menor).** Hoy se asume front = A000:0000
   (evidencia: offscreen A800 en blanco en reposo). Si algún estado capturara
   mid-flip, leer el CRTC Start Address (reg 0x0C/0x0D del CRTC, `OUTP 3D4` +
   `INP 3D5`) para elegir página. Nota: el `INP` imprime en la UI curses del
   debugger y su salida hay que parsearla con cuidado (en el spike se mezcló con
   un redibujado del panel de registros); por eso el default fijo a 0 es lo
   fiable ahora.

## Vías descartadas

- **Screenshot nativo de dosbox-x (`scrshot`/`rawscrshot`).** Existen (generan
  PNG real, "Saved screenshot to the file:"), pero se disparan por el **mapper**
  (eventos de tecla SDL). El oráculo inyecta teclas en el buffer de la BIOS
  (`0040:001E`), por DEBAJO del mapper, así que no puede dispararlas headless.
  No hay comando de debugger ni de config para un one-shot de screenshot.
- **`VRD` (redraw video).** Fuerza un repintado de la surface SDL; con
  `SDL_VIDEODRIVER=dummy` no produce fichero. Útil solo como paso previo para
  asentar el frame (punto 1), no como captura.
