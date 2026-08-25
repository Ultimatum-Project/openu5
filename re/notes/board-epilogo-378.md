# El epílogo 0x093E de `cmd_board` NO deja g_hull/g_skiffs a 0 — la cadena fragata→caballo→a pie CONSERVA

Ficha #378 (cabo declarado de [trama-nativa-238-231.md](trama-nativa-238-231.md) §3,
refinado por [xit-pila-273.md](xit-pila-273.md) §4). La premisa a medir: «el binario
dejaría hull/skiffs a 0 vía el epílogo de board 0x093E». Derivación ESTÁTICA sobre
`re/disasm/{CMDS.OVL,ULTIMA.EXE}.asm` con la cadena cross-overlay resuelta por
`verify_cites.resolve` (nunca a ojo — familia #110/#81), y MEDIDA EN VIVO contra el
binario real (`re/tools/probe_board_chain_378.py`, 20-08, 9/9 esperados en crudo).
**Veredicto: la premisa es FALSA — la cadena conserva.**

## 1. `cmd_board` (CMDS.OVL 0x07F6-0x0960) cuerpo a cuerpo: quién escribe g_hull/g_skiffs

Despacho por el byte +0 del objeto bajo el party (finder `call 0x770e` ⇒ kernel 0x368E;
la ranura encontrada queda en `g_cmb_scratch_x` → `[bp-4]`, 0x082C):

| rama | camino | escribe 0x5C5F/0x5C61 (g_hull/g_skiffs)? |
|---|---|---|
| caballo (0x10/0x11) | 0x083B dueño → 0x0862 gate a pie → 0x0870 `add al,2` → 0x0875 store tile → `jmp 0x93E` | **NO** — ninguna instrucción de 0x083B-0x0878 los toca |
| alfombra (0x1B) | 0x087C → 0x0890 tile=0x14 → `jmp 0x93E` | **NO** |
| esquife (0x28-0x2B) | 0x0898 → 0x08B2 tile TAL CUAL → `jmp 0x0875` → `jmp 0x93E` | **NO** |
| fragata (0x24-0x27) | 0x08B8 → 0x08C4 gate 0x70C → 0x08D5-0x0939 → cae al 0x93E | **SÍ — la única**: 0x08DC `[bx+0x5C5F]`→`[bp-8]`→0x08F4 `mov [0x5C5F],al` (con aviso <10 en 0x08E5) y 0x08FE `[bx+0x5C61]`→`[bp-6]`→0x0936 `mov [0x5C61],al` (con `inc` si vienes de esquife 0x0919, alfombra estibada 0x090A, aviso ==0 en 0x0920) |

Es decir: el volcado registro→slot0 que #231 atribuía a «board» en general es
**EXCLUSIVO de la rama fragata** — la corrección exacta que ya anticipaba
xit-pila-273.md §4 para g_skiffs, ahora verificada también para g_hull.

## 2. El epílogo 0x093E: seis ceros a la ranura ABORDADA, que nunca es la 0

```
093e: sub ax,ax          ; 0
0940-0945: push ax ×6    ; seis ceros
0946: push [bp-4]        ; la RANURA del objeto abordado (finder 0x368E)
0949: call 0x7af4        ; write_object_record
094c: or [g_unk_24e6],2
```

- `0x7af4` resuelto con `dispatch_table`/`verify_cites`: RESIDENTE ULTIMA.EXE,
  file_off **0x3A74** (control positivo de la base: el mismo resolver da
  0x6CCC→kernel 0x2C4C, el caso ya acreditado en xit-pila-273.md §7.2).
- El cuerpo de 0x3A74 (0x3A74-0x3AAB, `ret 0xE`): escribe `[si+0x5C5A..0x5C5F]`
  = **+0..+5** del registro `ranura·8` desde los 6 args. **+6 y +7 NO se escriben
  jamás** — el `+7` de una ranura borrada queda con su valor anterior (residuo en el
  `.GAM`, sin lector: familia del §4-§5 de xit-pila-273.md, no se imita).
- La ranura es **≥1 por construcción**: el finder 0x368E arranca en `dx=1`,
  `si=0x5C62` (= ranura 1) y barre hasta `0x5D5A` (ranuras 1..31; 0x36F3 devuelve 0
  = «nada» si no casa). La ranura 0 (0x5C5A-0x5C61: el registro del AVATAR, cuyos
  +5/+7 SON g_hull/g_skiffs) es inalcanzable para el epílogo.

⇒ El epílogo borra del mundo el objeto que acabas de abordar. **No puede** poner
g_hull/g_skiffs a 0: ni escribe la ranura 0, ni escribe +7 de ninguna ranura.

## 3. La cadena, medida en vivo (probe 20-08, dos boots, party plantado sobre el objeto)

Centinelas 0x37/0x05 sembrados en obj0+5/+7 (modelan el residuo de la «última
fragata»); control positivo en ambas fases = el transporte DEBE cambiar de 0x1C.

| fase | siembra slot1 | POST medido | adjudica |
|---|---|---|---|
| F1 re-abordar fragata | `25 25 x y 00 2A 00 03` | transport=25 · g_hull=**2A** · g_skiffs=**03** · slot1=`00×6 .. 03` | el restore lee el REGISTRO (los centinelas mueren pisados por 2A/03); epílogo borra +0..+5; **+7 del slot muerto queda 0x03** (0x3A74 no lo escribe) |
| F2 abordar caballo | `10 10 x y 00 00 00 00` | transport=12 · g_hull=**37** · g_skiffs=**05** · slot1=`00×8` | la rama caballo NO toca los globales (centinelas INTACTOS); mismo epílogo |

Cadena completa fragata→caballo→a pie→re-abordar: al salir de la fragata, `cmd_xit`
escribe su registro (+5 = g_hull, cola 0x100F-0x1016; +7 = esquifes calculados,
0x1020-0x1023); el board del caballo no toca los globales (F2) y su epílogo solo borra
el registro del caballo; al volver, la rama fragata restaura del registro amarrado
(F1). **hull/skiffs se conservan de punta a punta.**

## 4. Careo del port (#378)

- **Conducta: YA FIEL, sin cambios.** `game.ts board()` siembra slot0 desde el objeto
  abordado solo si es nave (el equivalente de la exclusividad de la rama fragata) y
  `transport.ts board()`/`exitTransport()` conservan `shipHull/shipSkiffs` a través
  del caballo — guarda `game/tests/board-chain-378.test.ts` (cadena a nivel Game, con
  la diferencia registro≠estado instanciada con dos naves para que el mutante sin
  siembra enrojezca).
- **Divergentes (corregidos): los DOS escritores de export que seguían la premisa
  refutada** «board vuelca el registro del objeto abordado a slot0» escribiendo 0 con
  caballo/alfombra/esquife activos en el overworld, donde el binario conserva los
  globales (§1: nadie los escribe fuera de la rama fragata; #231: nadie los borra al
  desembarcar): `saveNative.ts` obj0+5/+7 (`conservaResiduo`) y `buildNativeOol`
  registro 0 (que además no llevaba ni el fix a-pie de #231). Interior sigue a 0
  (memset MAINOUT 0x0857; el +7=6 de interior sigue SIN DETERMINAR y no se imita).
  El import ya adoptaba los bytes en overworld para cualquier transporte — sin cambio.
- **No imitado, declarado**: el `+7` rancio de las ranuras borradas por el epílogo
  (§2). El port elimina el objeto entero; imitar el byte muerto sería fabricar basura
  (la adjudicación del §5 de xit-pila-273.md, misma familia).
