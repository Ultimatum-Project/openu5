# ACTA #121 — la sonda de RECARGA, EN VIVO: el terreno se relee del disco byte a byte

**VEREDICTO: CONFIRMA.** El cargador de mapa REESCRIBE el búfer de terreno vivo desde el
`.DAT` en cada carga, y al volver a la misma planta el búfer queda **byte a byte idéntico**
al de la primera carga. Y la consecuencia de jugabilidad que #119 daba por supuesta —
«puerta forzada re-trabada al reentrar»— está ahora **MEDIDA con la mecánica real**, no
argumentada.

Oráculo DOSBox headless PROPIO, run-dir propio. NO se tocó `original/u5/play` ni ningún
proceso del usuario (`pgrep dosbox` vacío antes de arrancar).

---

## 1. Lo que faltaba, y cómo se desbloqueó

tpk-112 dejó la mitad viva de la sonda parada por el **bloqueo de teclas**: `send_key()`
inyecta en el búfer de teclado de la BIOS **estando en pausa**, y ese búfer tiene 16
huecos; mandar teclas seguidas sin reanudar lo llena y no se consume ninguna.

**Protocolo de oro** (el que `send_keys_until_main_menu` ya usaba por dentro), envuelto en
un helper `press()`:

```
send_key(k) → wait_kbd_poll()   [= RUN hasta que el juego sondea INT 16h]
            → key_consumed()    [buffer BIOS vacío ⇒ la tecla entró]
            → unos sondeos más para que el turno asiente
```

Control positivo en el primer run: 3 teclas `LEFT`, 3 pasos, uno por tecla
(`(15,26) → (14,26) → (13,26) → (12,26)`). Con eso la conducción de gameplay quedó abierta.

**Instrumentos derivados de los BYTES del disasm**, no de un mapa de símbolos:

| global | offset | byte que lo fija |
|---|---|---|
| `g_location` | DS 0x5893 | TOWN `803e93587f cmp byte [g_location],0x7f` |
| `g_floor` | DS 0x5895 | TOWN `8a0e9558 mov cl,byte [g_floor]` |
| `g_party_x` | DS 0x5896 | CAST 0x19b0 `8a0e9658` |
| `g_party_y` | DS 0x5897 | CAST 0x19b9 `a09758` |
| búfer de terreno | DS 0x6608 | `tile_addr` ULTIMA.EXE 0x4402 (`add ax,0x6608`) |

Y la **pasabilidad para el BFS de ruta** NO se inventó: sale de la tabla canónica del
binario, DATA.OVL fileoff 0x54e4 (32 bytes, máscara `0x80>>(tile&7)`, bit puesto =
bloquea), verificada aquí contra 3 anclas (hierba pasa · agua bloquea · desierto pasa) y
contra el recuento que declara el port (182 bloquean). Con una lista de tiles «a ojo» la
primera ruta ya falló.

## 2. El ciclo que se usó — y por qué NO es el `loc=17→0→17` del encargo

El save arranca en el **sótano** del castillo de LB (loc 17, `g_floor` 0xFF), y desde ahí
no hay borde de mapa al overworld. El **cambio de planta corre EL MISMO CARGADOR**: TOWN
0x052E → 0x0408, derivado en tpk-113 §1.3 y escrito en el propio port (`game.ts:3057` y
`:3090`). Se usó entonces el ciclo planta→planta'→planta, que además es **más fuerte** que
salir y reentrar: se vuelve a la MISMA celda de la MISMA planta, así que el terreno tiene
que volver byte a byte, no sólo «cambiar».

Ruta: escala `0xC8` LadderUp + `(K)limb` (TOWN 0x0B82: tile bajo el party 0xC8 → sube;
0xC9/0x86 → baja; no pide dirección).

**Por qué no se cerró también el ciclo de location** (queda como cola, §5): desde el
sótano las 4 escalas van a las 4 **torres de esquina**, y la planta 0 de una torre son 24
casillas cerradas por una `0xB9 LockedDoor` — que necesita llave o (J)immy. El ciclo de
salida al overworld quedó sin medir; la RE-ENTRADA, en cambio, es ese mismo 0x0408 ya
sellado aquí.

## 3. Resultado 1 — la marca sintética (sonda del encargo, versión debugger)

Marca de `0xAB` sobre las 1024 celdas **menos la de la escala** (ver §4), y `(K)limb`:

```
[MARCADO]  0xAB en 1023/1024 bytes; celda de la escala (29,29) preservada a 0xC8
[KLIMB]    floor 0xFF -> 0x00   quedan 8/1024 bytes 0xAB
[VUELTA]   floor 0x00 -> 0xFF   sha 1813e6e2c8061774 == sha de la PRIMERA carga
```

- **Sube**: de los 1023 marcados sobreviven 8 — y no son residuo, son celdas cuyo valor
  legítimo en la planta nueva ES `0xAB` (`LeftBed`; el histograma del sótano ya traía dos).
- **Baja**: el búfer vuelve **byte a byte** (`sha3 == sha0`), reproducido en dos runs
  independientes.

## 4. ★ La guarda anti-falso-refutado DISPARÓ DE VERDAD, y sobre un caso mío

El primer intento marcó las **1024** celdas, la de la escala incluida. Resultado:

```
[KLIMB] floor 0xff -> 0xff  (¿cambió?: False)   sha1 == shaM   (marca intacta)
```

Leído a lo bruto, eso es «**la marca sobrevivió ⇒ el terreno PERSISTE**» — la conclusión
**contraria a la verdad**, y habría PARADO #119 con un refutado falso. La guarda lo
declaró NO CONCLUYENTE porque no hubo cambio de planta.

La causa es instructiva y merece nombre propio: **la marca destruyó el dato que el
experimento necesita leer**. TOWN 0x0B82 decide si hay escala leyendo el tile bajo el
party **del búfer vivo**; al pisarlo con `0xAB` ya no había `0xC8`, el (K)limb no hizo
nada y nadie llamó al cargador. Arreglo: respetar esa única celda; las otras 1023 siguen
midiendo lo mismo.

## 5. Resultado 2 — ★ la sonda (a) del encargo, con la MECÁNICA REAL

Lo anterior usa una marca escrita con el debugger. Ésta usa el juego:

```
[PUERTA] party en (5,20), puerta 0xB8 (RegularDoor) en (6,20) hacia el este
[OPEN]   tile de la puerta en el BÚFER: 0xB8 -> 0x44   (el (O)pen SÍ escribe terreno)
[CICLO]  floor 0xFF -> 0x00 -> 0xFF
[PUERTA] tras el ciclo: 0xB8   ← CERRADA otra vez
         y el búfer entero vuelve a 1813e6e2c8061774
```

Dos hechos, los dos nuevos:

1. **El (O)pen del original ESCRIBE EN EL BÚFER DE TERRENO**: la celda pasa de `0xB8`
   RegularDoor a `0x44` BrickFloor. No es una capa aparte: es el mismo canal `DS:0x6608`.
2. **Y no sobrevive a la recarga**: tras el ciclo la puerta está otra vez `0xB8`.

⇒ «puerta forzada re-trabada al reentrar» deja de ser una consecuencia ASUMIDA del modelo
y pasa a ser observación directa. Es, literalmente, la mecánica de la tanda 2 de #119.

**Aviso para quien haga la tanda 2**: el port NO modela esto como escritura de terreno,
sino como un tracker de puertas aparte (`doors.effectiveTile` + `doors.reset()` en la
carga de mapa). El OBSERVABLE coincide —abierta mientras dura, cerrada al recargar—, pero
el CANAL no es el mismo. Que nadie lea esta acta como que el tracker está mal: lo que dice
es que el original mete la apertura en el búfer volátil, y que el reset del port cae en el
sitio correcto por la razón correcta.

## 6. Qué queda SIN medir (declarado, no escondido)

- **El ciclo de LOCATION** (`17 → 0 → 17`) y con él la ruta de SALIDA al overworld: la
  re-entrada es el 0x0408 ya sellado, pero que salir al exterior recargue los chunks del
  overworld **no se ha observado**. Bloqueo concreto: torres de esquina cerradas por
  `0xB9 LockedDoor` (necesita llave o (J)immy).
- **La sonda (b) del trigo**: no se hizo. Pide un pueblo con trigo; el save arranca en el
  castillo de LB.
- **La caché de 4 chunks del overworld y su muerte por scroll**: fuera del alcance de esta
  sonda (todo el experimento vive en small map).

## 7. Artefactos re-ejecutables

En el scratchpad de la sesión (no versionados):
`probe121.py` (recon + control positivo de teclas) · `probe121c.py` (ciclo de planta con
marca sintética) · `probe121d.py` (intento del ciclo de location, con el diagnóstico de
frontera que localizó el bloqueo) · `probe121e.py` (**la sonda (a): puerta real**).
Todos importan `re/tools/oracle.py` en SOLO LECTURA (Regla 4) y arrancan su propia
instancia con run-dir propio.
