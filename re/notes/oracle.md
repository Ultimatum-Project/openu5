# Oráculo DOSBox (Task 0.3)

El oráculo (`re/tools/oracle.py`) arranca el Ultima V original dentro de
dosbox-x, headless y determinista, y permite inyectar teclas y leer la RAM
del juego en vivo. Es el "ground truth" contra el que se verifica cada
regla portada (arnés de paridad, Task 0.4 en adelante).

## Cómo funciona

```
oracle.boot()                      -> Session (pausado en el entry point)
Session.send_keys_until_main_menu() -> navega intro/menú hasta el mundo
Session.read_mem(seg, off, n)       -> bytes de RAM física
Session.read_mem_gameseg(off, n)    -> bytes del segmento de datos del juego
Session.send_keys("j\n")            -> teclas al juego
Session.savestate(slot)/loadstate   -> instantáneas de los 640K
Session.quit()                      -> mata el emulador y limpia
```

### Arranque headless

- Binario: `/Applications/dosbox-x.app` (v2026.07.02, build macOS ARM SDL1).
  **Gatekeeper**: el binario instalado conserva `com.apple.quarantine` /
  `com.apple.provenance` y, lanzado desde CLI (proceso no-GUI), el exec se
  queda colgado para siempre en `_dyld_start` (syspolicyd lo rechaza:
  `spctl -a` → "rejected", firma adhoc). Ni siquiera `xattr -dr
  com.apple.quarantine` lo desbloquea una vez rechazado. Solución: el
  oráculo cachea una copia del .app **sin xattrs** (tar --no-xattrs) en
  `<scratch>/dbx/` y ejecuta esa copia, que corre sin problema.
- **Scratch fuera del Escritorio**: todo lo que el oráculo escribe o
  ejecuta (caché del .app, run dirs con la copia del juego, slots,
  failed-boot.log) vive en `/private/tmp/<oracle-rundir>-scratch/`
  (override: env var `U5RE_ORACLE_SCRATCH`). Motivo: ejecutar dosbox-x
  desde una ruta bajo `~/Desktop` dispara la heurística de <AV-local>,
  que revoca el acceso del terminal a la carpeta Desktop durante
  ~30-90 min. El oráculo ya no crea nada bajo `re/`.
- Headless real con `SDL_VIDEODRIVER=dummy` + `SDL_AUDIODRIVER=dummy`
  (build SDL1; no se abre ninguna ventana). `-nogui` además evita menús.
- El juego nunca se ejecuta desde `original/` (solo lectura): cada sesión
  copia los ficheros a `<scratch>/run-XXXX/game/` y monta eso como C:.
  Si faltara `SAVED.GAM` se copia `INIT.GAM` en su lugar.
- Config determinista (`re/tools/dosbox.conf`): `machine=ega`,
  `memsize=1`, `core=normal`, `cycles=fixed 3000`, sin sonido. Con el
  video dummy la emulación corre "freewheel" (~10-20x tiempo real), lo
  que acelera el arranque sin afectar al determinismo (los ciclos por
  milisegundo emulado son fijos).
- **`[dosbox] quit warning=false`**: sin él, cualquier salida con un
  programa corriendo (ULTIMA.EXE bajo DEBUGBOX: siempre) dispara el
  diálogo GUI "Quit DOSBox-X warning — Are you sure to quit anyway
  now? No/Yes", que aparece en la pantalla del usuario y BLOQUEA la
  salida (incluso el `exit` del shell DOS se queda colgado en él).
  `Session.quit()` mata el proceso con SIGKILL (`proc.kill()`), así que
  el proceso muere igualmente, pero el diálogo aparecía visualmente en
  el cierre por otras vías. Verificado en la build 2026.07.02: la clave
  es `quit warning` en la sección `[dosbox]` (default `auto` = avisar
  si hay un programa corriendo; posibles: true/false/1/0/auto/autofile;
  se obtuvo con `config -all -wc <fichero>` desde el propio dosbox-x).

### El debugger integrado por pty

`[autoexec]` monta el juego y ejecuta `DEBUGBOX ULTIMA.EXE` con
`debuggerrun=debugger` ([log]): el debugger integrado pausa en el entry
point. En la build SDL1 el debugger es una UI curses en el terminal; el
oráculo lanza dosbox-x bajo un **pty** y habla con él por ahí.

Reglas de oro descubiertas (evidencia en `.superpowers/sdd/task-0.3-report.md`):

1. **Solo procesa comandos en PAUSA.** Lo tecleado mientras corre queda
   bufferizado hasta la siguiente pausa. No hay pausa asíncrona.
2. Por tanto **nunca se reanuda sin un breakpoint armado**. Los fiables
   son los de interrupción: `BPINT 8` (IRQ0 del timer: pulso universal,
   18.2 Hz emulados) y `BPINT 16` (el juego sondea el teclado).
3. **`BPM` (breakpoint de memoria) dispara en falso al armarse** (old
   value mal inicializado) sin avanzar el reloj: inutilizable como pulso.
4. La detección de pausa fiable es mandar una sonda barata (`EV CS IP`)
   y esperar su respuesta `EV of ...`: si contesta, está en pausa.
5. `HELP` pagina y se traga los comandos siguientes; no usarlo por script.
6. **Respuestas EV rancias** (paridad de combate, 2026-07-10): una respuesta
   `EV of X is: …` de una pausa previa que quedó sin leer en el buffer del pty
   se toma como PRIMERA coincidencia de la lectura siguiente → devuelve el
   valor de OTRA pausa (CS/IP rancios = falso `at_code_bp`; SS/SP rancios =
   se lee una pila equivocada → words basura). `_read_reg` **drena el pty
   antes de enviar** y toma la ÚLTIMA coincidencia (la respuesta a ESTE
   comando). Aun así, para leer la pila en un BP con garantías conviene exigir
   que DOS lecturas coincidan (los misreads residuales son transitorios y no se
   repiten; ver `combat_parity._stack_words`).
7. **Un solo dosbox-x a la vez** (2026-07-11): el oráculo asume un único
   emulador. Otro dosbox-x vivo —run huérfano de una sesión muerta sin
   `quit()`, o el de otro agente en paralelo— comparte CPU en modo freewheel
   y degrada el canal pty de ESTE boot: pausas/lecturas perdidas → paridad
   flaky (medido: agrava los huecos de muestreo del test de RNG). Por eso
   `boot()` AVISA por stderr (no aborta, para no romper runs concurrentes
   legítimos) listando pid+cmdline de cualquier dosbox-x ya en marcha
   (`oracle._foreign_dosbox`). Los agentes deben tratar ese aviso como señal
   de confound: `pgrep -fl dosbox-x`, matar los huérfanos (`kill -9`) y
   repetir la medición.

### Lectura de memoria

`MEMDUMPBIN seg:off len` escribe `MEMDUMP.BIN` en el cwd de dosbox-x (el
directorio de la sesión). Sirve cualquier rango físico (`0:0 A0000` = los
640K completos; offsets >64K funcionan). `read_mem()` espera a que el
fichero alcance el tamaño pedido. Como solo se lee en pausa, la lectura
no perturba el estado emulado.

### Escritura de memoria y breakpoints de código (Task 1.3)

- `write_mem(seg, off, data)` / `write_mem_gameseg(off, data)`: escriben
  RAM con el comando `SM` del debugger (el mismo mecanismo de la
  inyección de teclas), en pausa. Sirven para sembrar globals del juego
  (p.ej. `g_rng_seed` en el test de paridad del RNG).
- `arm_code_bp(seg, off)`: breakpoint de CÓDIGO (`BP seg:off`), que en
  esta build dispara por dirección física y persiste entre hits. Por
  defecto arma ADEMÁS `BPINT 8` como red de seguridad: si el código
  nunca pasa por ahí, la sesión sigue pausando en cada tick y no se
  vuelve inalcanzable. Tras `resume()`, `at_code_bp(seg, off)` distingue
  (vía `EV CS`/`EV IP`) si la pausa es el hit del BP o un tick.
  Verificado en vivo en Task 1.3 (paridad del RNG: hits repetidos en
  `load_seg:0x2092` con lectura de `g_rng_seed` en cada hit).

### Teclas

U5 (con esta config) **no hookea INT 9 ni INT 16**: los vectores quedan
en la BIOS (F000:E987 / F000:CF40) y el bucle del título sondea INT 16h.
Así que `send_keys()` inyecta pares ascii+scancode directamente en el
buffer circular del teclado de la BIOS (BDA `0040:001E`, tail en
`0040:001C`) con el comando `SM` del debugger, en pausa. Equivale a
pulsar la tecla y queda anclado al tiempo emulado.

(Se intentó la inyección "hardware" por el 8042 — `OUT 64h D2h` +
`OUT 60h scancode` — pero esta build no la implementa: nunca llega IRQ1.)

### Navegación hasta el mundo

`send_keys_until_main_menu()`:

1. `wait_kbd_poll()` — corre con `BPINT 16` hasta que el juego consulta
   el teclado (título ya cargado).
2. Guion `\n \n \n j \n ...`: Enter salta las pantallas del título, `j`
   elige "Journey Onward" en el menú (strings del menú en DATA.OVL:
   "Journey Onward / Create New Character / ... / Select:"). Tras cada
   tecla espera a que se consuma (buffer BIOS vacío) y sigue sondeando.
3. Detector de "mundo cargado": los primeros 0x20 bytes de `SAVED.GAM`
   (roster del grupo, "Elwood...") aparecen en RAM (escaneo de 192K desde
   la base de carga).
4. `game_ds` = registro DS real del kernel, leído con `EV DS` en esa
   pausa (estamos parados en código del juego justo tras su sondeo
   INT 16h); `roster_off` = dirección física del roster − (DS<<4).
   Fallback si no cuadra: párrafo del roster.
5. Espera de estabilización: la región de estado (0x200 bytes) debe ser
   idéntica en dos lecturas consecutivas.

## Segmentos observados (config fija)

| Qué | Valor | Fuente |
|-----|-------|--------|
| PSP de ULTIMA.EXE | `0x0814` | `DOS MCBS` del debugger |
| Base de carga (PSP+0x10) | `0x0824` | ídem |
| Entry point | `1041:0000` | pausa de DEBUGBOX (= 0x0824 + entry_cs 0x081D de recon.json) |
| Segmento de datos del juego (`game_ds`) | se descubre en cada boot: DS del kernel vía `EV DS` + firma del roster (`roster_off`) | `_find_roster()` + `_read_reg("DS")` |

## savestate / loadstate

Los savestates nativos de dosbox-x solo se disparan por menú/hotkey (no
hay comando DOS ni CLI), imposible headless. El oráculo implementa:

- `savestate(slot)`: volcado completo de los 640K de RAM convencional +
  historial de teclas a `<scratch>/slots/`. Es lo que el
  arnés de paridad necesita para comparar estado.
- `loadstate(slot)`: devuelve esos bytes para comparación offline. **No
  restaura** el estado dentro del emulador: el mecanismo de "volver a un
  punto" es el replay determinista (boot + misma secuencia de teclas).

## Determinismo

- Máquina fija (`machine=ega`), ciclos fijos (`cycles=fixed 3000`),
  `core=normal`, sin sonido: la ejecución emulada es reproducible.
- Los breakpoints congelan el reloj emulado: leer RAM no perturba.
- Las teclas se inyectan en pausas ancladas a eventos emulados (sondeos
  INT 16h del propio juego), no a tiempo del host.
- El test de determinismo compara estado EVOLUCIONADO por ejecución, no
  la copia del fichero: cada boot ejecuta dos movimientos a la derecha
  anclados a eventos emulados (`wait_gameseg_change` sobre la coordenada
  X del avatar) + 8 ticks fijos, y compara posición, flag y contador de
  movimiento entre boots (además exige X == X0+2: ninguna tecla perdida
  ni duplicada). Puede fallar en un emulador no determinista.
- Matiz: el instante exacto (en ticks desde la carga) en que se inyecta
  una tecla puede variar en ±1 sondeo entre boots; por eso el ancla de
  comparación es el evento observable (el movimiento ya ejecutado), no
  el tiempo de host ni el contador BIOS absoluto (que dosbox-x siembra
  con la hora del host). La sincronía exacta a nivel de instrucción
  llegará con breakpoints sobre direcciones del kernel (Task 1.x).
- Offsets de estado (relativos a `roster_off`; semántica confirmada por
  el mapa de globals de Task 1.2 y re-derivada en Task 3.1,
  `re/ledger/globals.json` + `re/notes/kernel-survival.md`):
  `UNK_2DA_OFF=0x2DA` = **g_prev_hour** (snapshot de la hora; el
  0x00→0x08 observado era la hora inicial 8), `CLOCK_MINUTE_OFF=0x2DB`
  (minuto del reloj: +1 por turno EN PUEBLO, +2 en exterior) y
  `TURN_COUNT_OFF=0x2E5` (**u8 saturante a 255**, no u16; 0x2E6 es otro
  contador horario). Los antiguos nombres provisionales
  POS_X_OFF/MOVE_CNT_OFF eran engañosos y se retiraron.
- `game_ds` no admite fallback silencioso: si `EV DS` no es legible o el
  roster no cae en ese segmento, `send_keys_until_main_menu` aborta con
  OracleError (nada se re-basa a escondidas).

## Modo ventana (watch mode) — `U5RE_ORACLE_GUI=1`

Opt-in para VER el juego mientras corre un test de paridad. Con la env
var `U5RE_ORACLE_GUI` a un valor distinto de vacío/"0", `boot()` lanza
dosbox-x **con ventana de video real**: no fija `SDL_VIDEODRIVER=dummy`
(SDL elige el driver nativo) y no pasa `-nogui`. Todo lo demás es
idéntico: mismo pty, misma config, mismo `SDL_AUDIODRIVER=dummy`
(silencio). Sin la variable, el comportamiento headless es byte a byte
el de siempre — el camino de tests automatizados no cambia.

- **El debugger sigue funcionando igual**: en esta build (SDL1) el
  debugger es la UI curses del terminal, no una ventana propia, así que
  sigue hablando por el pty y `read_mem`/`send_keys`/breakpoints
  funcionan exactamente igual con la ventana abierta (verificado en
  vivo: boot + menú + lectura del reloj del juego con ventana visible).
- **No tocar la ventana durante un test.** Las teclas se inyectan en el
  buffer BIOS por el debugger; pulsar teclas dentro de la ventana
  inyectaría entrada real y rompería el determinismo/paridad. La
  ventana puede además robar el foco al abrirse: es solo para mirar.
- Sin el video dummy la emulación ya no corre en "freewheel": va a
  velocidad de reloj SDL normal, así que el boot y los pulsos tardan
  algo más que en headless.

Ejemplos:

```bash
# Un test de paridad en vivo, mirando la ventana:
U5RE_ORACLE_GUI=1 python3 -m pytest re/tools/test_parity.py -q -k <test_en_vivo>

# Sesión manual:
U5RE_ORACLE_GUI=1 python3 -c "
import sys; sys.path.insert(0, 're/tools'); import oracle
s = oracle.boot(); s.send_keys_until_main_menu()
print(s.read_mem_gameseg(0x587F, 1)); s.quit()  # g_hour: 0x08 al arrancar"
```

## Limitaciones conocidas

- Cada `wait_kbd_poll`/tick es un round-trip por el pty (~1 s de host,
  limitado por la tasa de refresco de la UI curses del debugger): un
  boot completo hasta el mundo tarda ~1-2 minutos, no segundos.
- `loadstate` no restaura en vivo (ver arriba).
- El debugger no permite pausar de forma asíncrona: si se reanudara sin
  breakpoint armado la sesión quedaría inalcanzable (el oráculo nunca lo
  hace).
- Los tests del oráculo (`re/tools/test_oracle.py`) se skipean sin
  dosbox-x o sin `original/u5/ultima5/`; en esta máquina CORREN.
