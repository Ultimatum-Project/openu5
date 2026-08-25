# #217 — Romper el ESPEJO escribe 0x9F al MAPA: derivación del binario (SIN portar)

Fecha: 2026-08-14. Carril: espejo-camp-217. Estado: **DERIVACIÓN COMPLETA, PORT SIN TOCAR.**
Familia #33 (en el binario dibujar/interactuar NO es sólo-lectura).

## 1. El sitio exacto: `TOWN.OVL:0x09e6` = `town_attack_cmd` (el comando **(A)ttack**)

La rutina empieza en `09e6` (`push bp / mov bp,sp / sub sp,0x10 / push si`) y el ledger
(`re/ledger/frontier.json`) la tiene sellada como `town_attack_cmd` (verified). El
disparador es por tanto **(A)ttack con dirección**, no (U)se ni (L)ook.

Cuerpo leído, en orden:

| dir | instrucción | qué hace |
|---|---|---|
| `09f2` | `mov ax,0x26e0; call 0xffff9680` | imprime el rótulo del comando (DS 0x26e0) |
| `09f9-0a03` | `g_party_x`,`g_party_y` → `call 0xffffc232` | resuelve el puntero al tile DE LA PARTY |
| `0a08` | `cmp byte ptr [bx],4; jae 0xa24` | tile de la party ≥ 4 ⇒ sigue |
| `0a0d` | `cmp byte ptr [g_transport_tile],0x1c; je 0xa24` | excepción de transporte |
| `0a14-0a20` | imprime DS 0x26e8, `[bp-4]=0`, salta al epílogo | RECHAZO |
| `0a24` | `call 0xffffb41c` | pide la DIRECCIÓN; 0 ⇒ aborta |
| `0a2e-0a43` | `party + g_cmb_scratch_{x,y}` | celda OBJETIVO |
| `0a4a-0a4f` | `call 0xffffc232`; `cmp byte ptr [bx],0x9d` | ¿el objetivo es **espejo (0x9D)**? |
| `0a54-0a5f` | re-resuelve el puntero y **`mov byte ptr [bx],0x9f`** | 🔴 **ESCRIBE 0x9F AL MAPA** |
| `0a62` | `mov ax,0x26f2; call 0xffff9680` | mensaje de rotura (DS 0x26f2) |
| `0a69-0a80` | `si=0x7d0`; `call 0xffffa06c(0x28,0x78,si)`; `si+=0x3e8`; `while si<0x4e20` | **barrido ascendente 2000→19000 en pasos de 1000** (18 tonos): el cristal roto |
| `0a85` | `or byte ptr [g_unk_24e6],2` | pide REPINTADO (el mismo `g_unk_24e6` del protocolo de dos ramas de 0x5910, ver `visibility.ts`) |

⚠️ La rama del espejo **RETORNA AHÍ** (`jmp 0xb79`): romper el espejo NO cae al resto
del ataque. Lo demás (`0a8e`…) es la rama de objetivo-no-espejo.

## 2. Lo que la derivación NO dice (y por tanto nadie debe suponer)

* **No hay restauración.** En el cuerpo leído no aparece ninguna escritura que devuelva
  0x9F→0x9D. Si el espejo se repara en algún sitio, está FUERA de esta rutina y sin medir.
* **El texto de DS 0x26f2 NO está transcrito aquí**: la dirección está leída, la CADENA no.
  Quien porte el mensaje lo extrae del pool y lo carea byte a byte (patrón #315-a).
* **Alcanzabilidad sin censar**: cuántos espejos 0x9D hay en los mapas pequeños, y en
  cuáles, no se ha contado.

## 3. El PORT: la mecánica NO existe (medido)

`grep -rniE "0x9d|mirrorbroken|mirror" game/src --include='*.ts'` no devuelve NINGÚN
consumidor de juego: los aciertos de «mirror» son el bracket de la intro
(`ui/intro-shader.ts`, `ui/shell/originalFrame.ts`, `skin/fiel/skin.ts:507` = espejado
horizontal de un glifo) y los de `0x9d` son direcciones DS en comentarios de sfx/tiendas.
El espejo es hoy **decorado estático**: atacarlo no escribe al mapa, no suena y no repinta.

🔴 Y la palabra «espejo» en este repo es un FALSO AMIGO: casi todas las `re/notes/espejo-*`
(y `caja-espejo-93.md`, cuyo sujeto es la fila del pasillo 3D) hablan del ARNÉS de careo
port↔original, no del objeto del juego. Quien busque por el nombre encuentra el sujeto
equivocado — la nota hermana que el encargo citaba NO es pariente de 0x9F.

## 4. Cabo para la familia sidecar (#227/#238) — DECLARADO, no arreglado

Si el 0x9F escrito al mapa debe SOBREVIVIR al guardado, cae en la discusión de qué viaja
al `.GAM` nativo y qué al sidecar: el mapa pequeño mutado no es hoy parte del save nativo.
No se toca aquí; se cita para que la tanda de saves lo decida con el resto.

## 5. Estado de entrega

~~DERIVACIÓN entregada; **port sin tocar, sin tests, batería NO corrida**. Esta rama NO es
aterrizable tal cual: es el insumo para que el fix se escriba sin volver a leer el ASM.~~
**SUPERADO el 14-08 por el carril `espejo-camp-2`: CABLEADO. Ver §6-§12.**

---

# SEGUNDA PASADA (14-08, carril espejo-camp-2): las tres cosas que faltaban, y el cableado

## 6. La CADENA: DS 0x26f2 = **"Broken!\n"** (extraída y careada, ya no «sin transcribir»)

Delta DS → fileoff de DATA.OVL = **+0x10**. DS 0x26f2 → fileoff 0x2702, y ahí viven
`42 72 6f 6b 65 6e 21 0a 00` = `"Broken!\n"`.

El delta NO se supone: se acredita con TRES controles del propio corpus, que caen
exactos sobre su cadena ya publicada — DS 0x2ca8 `"Ouch!\n"`, DS 0x2caf
`"Electric field!\n"`, DS 0x2d53 `"Sleep spell!\n"`. Vecinas del mismo comando:
DS 0x26e0 `"Attack-"` y DS 0x26e8 `"On foot!\n"`.

## 7. 🔴 El BARRIDO no es una rampa de tonos — es la trampa de #137 en su forma más pura

§1 lo llamó «barrido ascendente 2000→19000 (18 tonos)». La cuenta de 18 es correcta;
**la palabra «tonos» no**, y quien porte una rampa limpia con esa lectura reproduce
exactamente el defecto que #137 existe para impedir.

`noise_burst` es `ULTIMA.EXE:0x223c`, cuerpo leído:
* `0x2268-0x2275`: `bx=0x64`; `cx = [bp+4] - bx + 1`; `div cx`; `dx += bx` ⇒ sortea un
  valor uniforme en **[100, [bp+4]] cerrado**, con el PRNG **LOCAL** `[0x545c]`
  (0x2255-0x2265), no con `rand_range`.
* `0x227b-0x2287`: `dx:ax = 0x1234DE`, `div cx`, `out 0x42` ⇒ el valor sorteado ES la
  frecuencia (0x1234DE es el reloj del PIT; el cociente es el CONTADOR).
* `0x2290-0x22b0`: acumulador `+= [bp+8]` por vuelta, repite mientras acumulador
  `< [bp+6]` ⇒ **nº de tonos por ráfaga = [bp+6] / [bp+8]**.

🔴 **ORDEN DE ARGUMENTOS.** Los pushes del sitio son `(0x28, 0x78, si)` y en cdecl el
ÚLTIMO empujado es el PRIMER argumento ⇒ en C es `noise_burst(si, 0x78, 0x28)` =
`(band, dur, step)`. La notación del corpus es la de PUSH — `(step, dur, band)` —
careada contra el sitio ya documentado del campo eléctrico (DUNGEON 0x4b9, pushes
`1/0x1f4/0x4e20` glosados como «step 1, duración 500, techo 20000»).

⇒ **`si` es el TECHO DE BANDA, no una frecuencia.** El bucle da 18 ráfagas
(`si = 2000,3000,…,19000`) y cada una sortea `0x78/0x28 = 3` tonos en `[100, si]`:
**54 tonos aleatorios cuya banda se ensancha**. Eso es un cristal rompiéndose, no una
sirena. Se CALCA — el port ya tiene la primitiva fiel (`noiseBurst`), así que aquí no
hace falta Clase-C: la trampa de #137 se evita usando la primitiva correcta, no
declarando.

## 8. 🔴 NO HAY RESTAURACIÓN — ahora es un negativo MEDIDO sobre el corpus COMPLETO

§2 lo decía acotado al cuerpo leído («si el espejo se repara, está FUERA y sin medir»).
Censo sobre los **28 `.asm`** del corpus del inmediato `0x9d` en CUALQUIER forma
(inmediato-a-memoria y vía registro): **NINGUNA instrucción del binario escribe 0x9d**.
Los únicos sitios que lo mencionan son comparaciones: TOWN 0x0a4f (ésta), CAST 0x025f y
TALK 0x04b3 (que no son tiles), y ULTIMA.EXE 0x5339 (§9).

CONTROL POSITIVO del mismo censo: sí encuentra las escrituras vecinas que existen —
`mov byte [bx],0x9f` en TOWN 0x0a5f y `mov byte [bx+si-0x551e],0x9e` en el kernel. El
predicado ve una escritura de esta familia cuando la hay. ⇒ **el espejo roto se queda
roto** mientras viva el búfer.

## 9. HALLAZGO NUEVO: `ULTIMA.EXE:0x5339` es el RENDERIZADOR, y explica el 0x9E

Tercer sitio que la primera pasada no tenía. **No es una restauración**: es la rutina de
composición del viewport. En `0x531a-0x5324` trata 0x9D y 0x9E juntos, y en
`0x532c-0x5353` lee la celda de ARRIBA (`[bp+6]-1`) y, si es 0x9D, escribe **0x9E** en
un plano de overlay (`mov byte [bx+si-0x551e],0x9e`).

La tabla de (L)ook del original cierra la lectura (`game/assets/look2.json`, índices
157/158/159): **0x9D "a mirror" · 0x9E "a tired adventurer" · 0x9F "a broken mirror"**.
0x9E es el REFLEJO — lo que ves en el espejo eres tú. Y **lo genera el renderizador, no
el mapa**: por eso el censo de datos da cero 0x9E (§10).

## 10. ALCANZABILIDAD (censada, ya no «sin censar»)

`game/assets/maps/smallmaps.json`, 32 mapas: **14 celdas 0x9D**, en 13 plantas —
Lycaeum ×2 (plantas 1 y 2) y una en Moonglow, Britain, Yew, Minoc, Lord British's
Castle, Palace of Blackthorn, Paws, Ararat, Farthing, Empath Abbey y Serpent's Hold.
**CERO 0x9E y CERO 0x9F** en los datos: el espejo roto y el reflejo sólo existen como
mutación en tiempo de ejecución, nunca de fábrica.

## 11. RNG: CERO, y por qué

La rama llama a `get_tile_ptr`, `print_string` y `noise_burst`. Ninguna es
`rand_range`, y `noise_burst` sortea con su PRNG LOCAL `[0x545c]` (§7). ⇒ romper
espejos **no desplaza el stream** y esta entrega **no necesita ventana de sellos**.
Guardado por aserto en `game/tests/mirror-break.test.ts` (`liveSeed()` antes/después).

## 12. El cableado

`Game.breakMirrorAt` (game/src/core/game.ts), llamado desde `attack()` ANTES de
bifurcar por localización, porque en el binario la comprobación va tras el getdir y su
rama RETORNA. Escribe con `setVolatileTerrain` — la MISMA primitiva de `useSkullKey`, y
por tanto la misma vida útil que el búfer de mapa del original (TOWN 0x0408 lo repuebla
al recargar). Cue `mirror-break` en `core/sfx.ts` + `skin/fiel/speaker.ts`.

Gate por localización: **sólo pueblo/interior**, y es medido — `MAINOUT cmd_attack`
0x06ec no compara 0x9d en ningún punto (§8).

**PERSISTENCIA AL GUARDAR: declarada, no tocada.** El 0x9F vive en el búfer volátil y
no viaja al save, igual que la puerta desmagificada. Si debe sobrevivir, lo decide la
familia sidecar **#227/#238**; aquí sólo se cita.
