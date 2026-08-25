# Invisibilidad — TESTIGO DOSBox: el tile 0x1d no es un puente, es una APARICIÓN; y el binario tiene DOS invisibilidades

Carril `re/invis-testigo` (ficha #42) · 2026-08-05 · base `896d8a10`.
Cierra el §4 («el experimento que cierra esto, barato, no lo he hecho») de
[`invisibilidad-port-hueco.md`](invisibilidad-port-hueco.md), que dejó las dos
preguntas abiertas. Sonda: `re/tools/invis_probe.py` (commiteada con esta acta).

**Veredicto en dos líneas:**

1. **El actor invisible SE SIGUE DIBUJANDO, y no como un puente.** El campo +1 se
   blitea con el **banco alto** de sprites, así que `0x1d` es el tile **`0x11D`**: una
   **silueta humanoide hueca de contorno cian**. La lectura «`0x1d` = Bridge» del hueco
   §3 era del banco de TERRENO, por el que ese byte no pasa nunca.
2. **La asimetría del §3.1 está CONFIRMADA en vivo**, y además es MÁS ESTRECHA de lo que
   parecía: el binario usa **dos representaciones distintas** de «invisible», y el port
   modela siempre la segunda. Acierta en el enemigo y falla en el party.

---

## 1. Qué se midió, y con qué

Instancia headless propia (`oracle.boot()`, run-dir propio; nunca el DOSBox del
usuario). Combate montado con `combat_parity.enter_combat` (rata inyectada + Ataque),
party de 3 PJ (Avatar `A`, Fighter `F`, Bard `B`) contra ratas.

Observables — **todo RAM, cero conteo de píxeles**:

| global | qué es |
|---|---|
| `DS:0x5C5A` | tabla de actores de mundo, 32×8: **+0 tile BASE · +1 tile RENDER** |
| `DS:0xBA14` | registros de combatiente, 32×8: +2 flags (`0x80` party, `0x10` invisible), +4 ranura en `0x5C5A`, +6 X, +7 Y |
| `DS:0xAC64` | **capa de SPRITES** del viewport 11×11, stride 16 |
| `DS:0xAB02` | capa de TERRENO del viewport 11×11, stride 32 |
| `DS:0x57F0` | `g_spell_qty[idx]` — `CAST:0x0ec8` lo decrementa: testigo de «el cast llegó» |

**La capa de sprites es el punto de medida correcto**: es lo ÚLTIMO que el juego decide
antes de mandar el índice al driver. Y el discriminante «¿se dibuja?» **no** es el byte
que quede en `0xAC64` (puede ser rancio), sino el byte de TERRENO de esa celda: la propia
estampa lo pone a 0 (`ULTIMA.EXE:0x5542`) y el compositor lo lee como marca
(`0x56ca: cmp byte ptr [bx+si-0x54fe], 0` → `jne` = ahí no hay sprite).

## 2. Q1 — qué PINTA el `0x1d`. La cadena completa, medida

**(a) MEDIDO en vivo.** Tras el Sanct Lor del PJ, `+0` queda intacto en `0x4c`, `+1`
pasa a `0x1d`, y **`0xAC64[y=7][x=5] = 0x1d`** con la celda marcada como celda de sprite.
El `0x1d` llega íntegro a la capa que se blitea.

**(b) MEDIDO en el ASM — el byte cambia de BANCO al salir.** `ULTIMA.EXE:0x56ac`,
compositor del viewport, trata las dos capas distinto:

```
; ACTOR   (capa de sprites)
56db: 8a8064ac    mov al, byte ptr [bx + si - 0x539c]   ; el tile de render, CRUDO
56df: 2ae4        sub ah, ah
56e1: 80c401      add ah, 1                             ; ← BANCO ALTO: ax = 0x100 | tile

; TERRENO
570c-5715: mov bl,[bx+si-0x54fe] ; mov al, byte ptr [bx - 0x4ee2]  ← LUT 0xB11E
5719: 2ae4        sub ah, ah                            ; banco 0
```

y el driver convierte ese `ah` en aritmética real — `EGA.DRV` `sel 0x51 → fn27`:

```
1642: b107        mov cl, 7
1644: d3e3        shl bx, cl        ; bx = (banco<<8 | tile) * 128 bytes/tile
```

⇒ **el tile de render de un actor NUNCA pasa por la tabla de terreno** (ésa es la LUT
`0xB11E`, la de animación de tiles). `0x1d` en `+1` se dibuja como el sprite **`0x11D`**.

**(c) MEDIDO — el mapeo `+0x100` queda comprobado 5 de 5 en la misma corrida.** Los tiles
base que el propio juego escribió durante el combate, contra el catálogo:

| clase / criatura | `+0` medido en vivo | `0x100 \| +0` | nombre |
|---|---|---|---|
| Avatar (`A`) | `0x4c` | `0x14C` | Avatar1 |
| Fighter (`F`) | `0x48` | `0x148` | Fighter1 |
| Bard (`B`) | `0x44` | `0x144` | Bard1 |
| rata (render ciclando) | `0x90`–`0x93` | `0x190`–`0x193` | Rat1–Rat4 |

Cinco aciertos sobre bytes que no elegí yo: el `+0x100` no es una conjetura de lectura.

**(d) MEDIDO — la FORMA.** Recortado el tile `0x11D` del tileset del propio juego
(extracción 1:1 de `TILES.16`): es una **silueta humanoide hueca, sólo contorno, en cian
brillante**, sobre fondo negro. Es reconociblemente «un fantasma con la forma del que
estaba ahí», no un hueco ni un puente. Los cuatro controles del cuadro (c) recortados a
la vez salieron correctos, así que el índice del atlas no está desplazado.
*(El NOMBRE «Apparition» sale de `TileData.json`, que es catálogo de la comunidad y **no**
material del binario: lo MEDIDO es el bitmap; el nombre sólo lo etiqueta. Los frames en
sí no viajan a ningún fichero tracked.)*

> **⇒ Respuesta a Q1: no desaparece, no parpadea, no es un puente. Se dibuja como una
> silueta espectral.** La duda del hueco §3 nacía de leer `0x1d` en el banco de terreno;
> el byte no visita ese banco.

## 3. Q2 — la asimetría party/enemigo, confirmada en vivo

Corrida: el PJ activo (Avatar, ranura de roster 0) lanza **Sanct Lor**.

```
ANTES     rec 0  party=True  inv=False  base=0x4c  render=0x4d  (5,7)  sprite=0x4d  dibujado=True
DESPUÉS   rec 0  party=True  inv=True   base=0x4c  render=0x1d  (5,7)  sprite=0x1d  dibujado=True
```

**MEDIDO**: `CAST.OVL:0x0afe` le aplica el tile al **miembro del party** que lo lanza, sin
mirar el bit `0x80`; el `+0` queda intacto; y el `0x1d` **persiste** frame a frame
mientras los otros dos PJ siguen ciclando su animación (`0x48→0x4a→0x4b`) — o sea que la
rutina de animación del party **respeta** el flag en vez de pisarlo
(`ULTIMA.EXE:0x6800`: si `flags & 0x10` reescribe `0x1d`, si no copia `+0 → +1`).

En el port, `game/src/core/combat/combat.ts:2273` sí pone `cur.invisible = true` a ese
mismo PJ, pero los dos filtros de dibujo son
`game/src/skin/coreview.ts:860` y `:1519` — `!(c.kind === "enemy" && c.invisible)` —
así que **el PJ se sigue dibujando exactamente igual que antes**. Ni silueta, ni cambio.

## 4. El hallazgo que NO estaba previsto: el binario tiene DOS invisibilidades

Y sólo una de las dos es «no dibujar». Las dos ponen el mismo flag `0x10`.

| vía | qué escribe en `+1` | ¿se dibuja? | quién |
|---|---|---|---|
| **A — tile de aparición** | `0x1d` | **SÍ**, como `0x11D` | Sanct Lor (`CAST.OVL:0x0b12`), anillo de invisibilidad y despertar (`ULTIMA.EXE:0x67d1`, `0x6841`) — **rutas del PARTY** |
| **B — centinela cero** | `0` | **NO** | habilidad innata de monstruo en combate (`COMSUBS.OVL:0x0236`) — **ruta del ENEMIGO** |

El centinela de la vía B es el gate de entrada del propio compositor, **MEDIDO**
(`ULTIMA.EXE`, bucle de actores; `[bp-0x16]` es el puntero a `+1`, fijado en `0x5443`):

```
54b9: 8b5eea      mov bx, word ptr [bp - 0x16]
54bc: 803f00      cmp byte ptr [bx], 0
54bf: 7503        jne 0x54c4
54c1: e93d01      jmp 0x5601          ; ← salta a la siguiente entrada: NO SE DIBUJA
```

Y la vía B entera, con sus dos mensajes (`COMSUBS.OVL:0x01fa`–`0x0236`): tirada de 12,5 %
por turno para los tipos con el bit `0x800` de habilidad, y

```
01fa: cmp byte ptr [si + 0x5c5b], 0    ; ¿ya oculto?
0214: mov al, byte ptr [si + 0x5c5a]   ; +0 BASE
0218: mov byte ptr [si + 0x5c5b], al   ; → +1   (reaparece)
...
0236: mov byte ptr [bx + 0x5c5b], 0    ; +1 := 0 (desaparece)
```

Strings verificados leyendo `DATA.OVL` (`fileoff = DS + 0x10`):
**`0x99c2` = `" reappears!"`** · **`0x99ce` = `" disappears!"`**.

**Comprobación en vivo de las dos vías, lado a lado**, sembrando en RAM la misma huella
que deja cada rutina y dejando que el compositor del binario decida:

```
enemigo rec 6  flags|=0x10  +1 := 0x1d   →  sprite=0x1d   dibujado=True
enemigo rec 7  flags|=0x10  +1 := 0      →  sprite=0x90*  dibujado=False   (* byte rancio)
```

El `0x90` de la fila de abajo es exactamente el señuelo contra el que se construyó el
discriminante del §1: la capa de sprites conserva el byte viejo y **sólo el byte de
terreno dice la verdad**. Quien mire `0xAC64` a secas concluye que el enemigo sigue
dibujado.

## 5. Wis Quas: la exclusión del party, medida

Mismo combate, tras dejar a un PJ y dos enemigos invisibles, un PJ lanza **Wis Quas**:

```
rec 0  party=True   inv=True  → inv=True   render=0x1d   (SIGUE INVISIBLE)
rec 6  party=False  inv=True  → inv=False  render=0x90   (revelado)
rec 7  party=False  inv=True  → inv=False  render=0x92   (revelado)
```

**MEDIDO**: `CAST.OVL:0x074c` salta las entradas con `[si]&0x80`, así que un PJ invisible
**no se revela con Wis Quas** — ni el suyo propio. Y revela por igual a los enemigos de
las dos vías (§4), porque lo que hace es copiar `+0 → +1` sin mirar qué había.
El port hace lo mismo: `combat.ts:2651` `if (c.kind !== "player" && c.invisible)`.
**Esta parte del port está bien y ahora está confirmada contra el original, no sólo leída.**

## 6. Adjudicación de divergencia del port — FICHA, sin arreglar

Regla del encargo: una causa por rama; el arreglo va aparte y después del testigo.

**El port acierta en el enemigo y falla en el party.** No es «el port oculta y el binario
no»: es que el port aplica la **vía B a todo** cuando el binario reserva la B para los
enemigos y usa la **A** para el party.

| caso | binario (MEDIDO) | port | ¿diverge? |
|---|---|---|---|
| enemigo con la habilidad innata de combate | `+1 := 0` ⇒ **no se dibuja** | `enemy.invisible = !enemy.invisible` (`combat.ts:3195`) + filtro de `coreview` ⇒ no se dibuja, y con los mismos dos mensajes (`combat.ts:3200`) | **NO** ✔ |
| **PJ que lanza Sanct Lor** | `+1 := 0x1d` ⇒ **se dibuja como `0x11D`** | `cur.invisible = true` (`combat.ts:2273`) y **se sigue dibujando IGUAL** (`coreview.ts:860`, `:1519` filtran sólo `kind === "enemy"`) | **SÍ** |
| **PJ con el anillo de invisibilidad** | `ULTIMA.EXE:0x67d1` ⇒ **se dibuja como `0x11D`** | `combat.ts:597` / `:2208` `invisible = record.ring === RING_INVIS`, mismo filtro ⇒ **se sigue dibujando IGUAL** | **SÍ** |
| Wis Quas | excluye al party, copia `+0 → +1` | `combat.ts:2651`, idéntico | **NO** ✔ |

**Cifra de la divergencia**: 2 rutas (conjuro + anillo; la poción negra de
`usePotion.ts:116` llega al mismo flag y heredaría lo mismo, **no medida aquí**), 1 tile
(`0x11D`), 0 miembros del party dibujados como aparición en el port contra los que el
binario dibuja así siempre que el flag esté puesto.

**Lo que el arreglo necesitaría** (no lo hago): el port no tiene campo de tile de render
separado del tile base — modela la invisibilidad como un booleano que el pintor consulta.
La vía A pide un tile de presentación distinto del tile de identidad. **Es un cambio de
modelo de datos, no un cambio de filtro**, y por eso no cabe en esta rama.

## 7. La trampa que produjo un falso negativo, y que merece quedar escrita

**La primera corrida buena dio «Sanct Lor no hace nada»** — y era mentira del arnés.
`g_spell_qty[36]` bajó de 9 a 8 y el maná del lanzador de 99 a 92 (−7 = el círculo de
Sanct Lor): el dispatcher **sí** había corrido. Lo que lo tumbaba estaba una instrucción
más allá:

```
0f01: si LEVEL[caster*32 + 0x55BE] < CIRCLE → result = 0, jmp TAIL   ; GATE DE NIVEL
0f17: jmp cs:[idx*2 - 0x2f3a]                                        ; ← la jump table, nunca alcanzada
```

El party del arranque es **nivel 1** y Sanct Lor es **círculo 7**: el hechizo se consume,
el maná se cobra, sale `"Failed!"` y `0x0afe` **no llega a ejecutarse**. Un observable de
salida («¿cambió el tile?») lee eso como «la rutina no hace lo que dices». Lo que lo
partió fue instrumentar **lo que el dispatcher DECIDE** (`g_spell_qty`, maná) y no sólo lo
que sale. Con `LEVEL := 8` sembrado, la misma corrida da el resultado del §3.

*(Y antes de eso hubo un falso negativo aún más tonto y del mismo género: la fixture
`combat_parity.cast_spell_at_turn` avanza `run_ticks` fijos entre teclas y su propio
docstring se declara sin calibrar — «bug que dejó 6 capturas de #44 sin submit». La sonda
de aquí ancla cada tecla a su CONSUMO real (`wait_kbd_poll` + `key_consumed`) y avisa por
pantalla si alguna no se consumió.)*

## 8. Lo que esta acta NO hace, y sus reservas

- **No arregla la divergencia.** Ficha en §6, con citas y cifras; el arreglo va en otra
  rama y toca el modelo de datos del port.
- **No mide la poción negra** (`usePotion.ts:116`) ni el overworld: todo lo de arriba es
  la arena de combate. La vía A del anillo la mido por su ASM (`0x67d1`), no en vivo.
- **No llega al framebuffer.** La cadena está medida hasta la capa de sprites en vivo y de
  ahí al banco alto por ASM; el bitmap del `0x11D` está medido sobre el tileset del juego.
  **No he comparado los píxeles de la pantalla EGA contra ese bitmap** — es la última
  milla y no la he andado. Si alguien quiere cerrarla, el punto de comparación es un
  bloque de 16×16 en `A000:` contra el tile decodificado, byte a byte; no cuente píxeles.
- **Confound declarado**: había OTRO `dosbox-x` vivo (de otro carril de la flota) durante
  las tres corridas; el propio oráculo avisa de que degrada el pty. No lo maté (REGLA 3).
  Mitigación: los números de §3/§4/§5 salieron **iguales en dos corridas independientes**
  y son internamente coherentes (los 5 aciertos del cuadro §2c, y el par
  qty/maná del §7 cuadrando con el círculo de cada hechizo).
- **Un dato de siembra, no de juego**: los enemigos invisibles del §4 los sembré yo en
  RAM con la huella de cada rutina. Lo que mide la corrida es **qué hace el compositor del
  binario con esa huella**, que es justo la pregunta; no mide con qué frecuencia el juego
  la produce sola.
