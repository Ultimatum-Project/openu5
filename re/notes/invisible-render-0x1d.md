# Invisibilidad del PARTY — el ARREGLO, y las dos correcciones al testigo que lo pedía

Carril `re/invisible-12` · 2026-08-06 · sobre main `d0542dac`.

Convención de redacción, igual que las actas hermanas: los nombres de rutina y de global
van en tabla o en backticks aislados y nunca pegados a un desplazamiento; los
desplazamientos van en la forma `FICHERO.OVL:0x…`, que el sembrador de identidades no
puede leer como propuesta de nombre.

**Origen:** reporte del usuario JUGANDO — «si se ve invisibilidad». Es exactamente la
divergencia que [`invisibilidad-testigo.md`](invisibilidad-testigo.md) §6 dejó FICHADA y
sin arreglar («una causa por rama»). Esta rama la arregla.

**Lo que aporta esta ficha, y lo que NO:** el testigo DOSBox ya midió EN VIVO que el actor
invisible del party se sigue dibujando y que `0x1d` es el sprite `0x11D`. **Eso no lo
descubro yo: lo confirmo por otra vía y lo doy por bueno.** Lo nuevo son tres cosas: la
PRECEDENCIA (medida, y contraria a lo que yo mismo iba a publicar), **dos correcciones al
testigo**, y el arreglo con su testigo de regresión.

---

## 1. Confirmación independiente del decode (no es hallazgo nuevo)

Llegué al mismo `0x11D` por un camino distinto del testigo —él midió la capa de sprites en
vivo y el compositor del viewport; yo el compositor de la tabla de actores y el
sincronizador del party— y coincide. Vale como réplica, no como descubrimiento:

- **Compositor de la tabla:** `FONT.OVL:0x02fc` recorre las 32 ranuras con paso 8 y por
  cada una con `+0` distinto de 0 escribe el `+1` en la capa de actores
  (`FONT.OVL:0x0332`), tras derivar el índice de `+3`·32 + `+2` (Y y X).
- **Banco alto:** su lector `FONT.OVL:0x02a2` blitea esa capa con `ah = 1`
  (`FONT.OVL:0x02e5`) ⇒ `sprite = byte | 0x100`. Mismo mecanismo que el testigo midió en
  `ULTIMA.EXE:0x56ac`, en otro compositor.
- **El banco queda anclado por los globales del party:** fuera de combate
  (`ULTIMA.EXE:0x53a6`) la ranura 0 se rellena con X, Y, planta y **`+0` y `+1` := el byte
  de transporte** (`ULTIMA.EXE:0x53b8`, `ULTIMA.EXE:0x53bb`, `ULTIMA.EXE:0x53be`), donde
  `0x1c` = party a pie. `0x1d` es su vecino. Por eso `isOnFoot` del clon ya aceptaba los
  dos: el party invisible sigue yendo a pie.
- **El gráfico**, recortado del atlas EGA del clon (32 columnas, celda `n%32`,`n/32`).
  Son índices de TILE, no desplazamientos de código:

  | tile del atlas | qué se ve |
  |---|---|
  | `0x11c` | la figura acorazada del party |
  | `0x11d` | la MISMA silueta en contorno azul hueco |
  | `0x190` | rata gigante (control) |
  | `0x90` | una silla de madera (control del banco BAJO) |

## 2. 🔴 CORRECCIÓN 1 al testigo — el port SÍ tenía campo de tile de presentación

`invisibilidad-testigo.md` §6, última línea: «*el port no tiene campo de tile de render
separado del tile base — modela la invisibilidad como un booleano… Es un cambio de modelo
de datos, no un cambio de filtro, y por eso no cabe en esta rama.*»

**Es falso, y el coste fue sobrestimar el arreglo.** El campo existía desde el lote de las
pociones: `polymorphTile` en el combatiente, escrito por la poción púrpura y consultado por
el pintor. Es exactamente un override de tile de presentación; sólo le faltaba que la
invisibilidad lo escribiera. El arreglo era una rama pequeña, no un cambio de modelo.

*(No es reproche al testigo: su §6 se escribió sin abrir esa parte del clon, y lo dice.
Queda anotado porque la frase, tal cual, desanima a quien fuera a arreglarlo.)*

## 3. PRECEDENCIA — y 🔴 CORRECCIÓN 2: `ULTIMA.EXE:0x6800` no es un animador por frame

Polimorfia e invisibilidad escriben las dos en el `+1`. ¿Hace falta modelar el par
base/render por separado, y quién gana si coinciden?

**(a) Los escritores directos, y la cola compartida de las pociones:**

```
CAST.OVL:0x14ca   mov al, 0x90        ; púrpura (rata)
CAST.OVL:0x14cc   mov [si+1], al      ;   +1
CAST.OVL:0x14cf   jmp 0x1510
CAST.OVL:0x150b   mov al, 0x1d        ; negra (invisible)
CAST.OVL:0x150d   mov [di+1], al      ;   +1
CAST.OVL:0x1510   mov [bx], al        ; COLA COMPARTIDA →  +0   (las dos)
```

Las dos pociones tocan `+0` **y** `+1`. Sanct Lor (`CAST.OVL:0x0b12`) y el anillo
(`ULTIMA.EXE:0x67d1`) tocan sólo `+1`. Con esto solo, la regla sería «gana la última
escritura».

**(b) Pero hay un re-imponedor, y lo manda el FLAG.** El testigo lo citó en su §3 como
«la rutina de animación del party respeta el flag en vez de pisarlo». Leído el cuerpo,
`ULTIMA.EXE:0x6800` **no es un animador y no corre por frame**:

```
6816: test byte ptr [bx + 2], 8     ; ← PESTILLO: si el bit 0x08 está bajo, no hace NADA
681a: je   0x6875
681c: test byte ptr [bx + 2], 0x80  ; ¿es del party?
6820: je   0x6860                   ;   no → [ranura+6] := 0 y fuera
682b: mov  byte ptr [bx + 0x55b3], 0x47   ; estado del roster := despierto
6832: test byte ptr [bx + 2], 0x10  ; ¿invisible?
6841: mov  byte ptr [bx + 0x5c5b], 0x1d   ;   SÍ → +1 := 0x1d   (descarta el +0)
6856: mov  al, byte ptr [si + 0x5c5a]     ;   NO → copia
685a: mov  byte ptr [si + 0x5c5b], al     ;        +0 → +1
6871: and  byte ptr [bx + 2], 0xf7   ; ← y CONSUME el pestillo
```

Es un **disparo único** gobernado por el bit `0x08`, que ponen el montaje de la arena
(`ULTIMA.EXE:0x65c1`, si el miembro no entra en estado normal) y la caída/derribo
(`ULTIMA.EXE:0x68e1`, `ULTIMA.EXE:0x6915`). O sea: la rutina es el **despertar/revivir**, y
al hacerlo **re-deriva el tile DESDE EL FLAG**.

El efecto que el testigo observó en vivo (el `0x1d` persiste mientras los otros PJ ciclan)
es correcto; lo que no es correcto es su explicación implícita —que algo lo re-escriba cada
frame—: persiste porque nadie lo pisa.

**(c) Consecuencia, que es la respuesta a la pregunta abierta:** para un PJ, la verdad
duradera es **el flag `0x10`**, no el byte. Nadie le copia `+0`→`+1` estando invisible
(Wis Quas, `CAST.OVL:0x0793`, excluye al party con `test [si],0x80` en `CAST.OVL:0x0775`), y
en cuanto el pestillo `0x08` dispara, el flag re-impone `0x1d` sobre cualquier `+0`.
⇒ **NO hace falta separar base/render en el clon: basta un campo de presentación más la
regla «para un PJ, invisible manda».**

**Reserva honesta, declarada:** hay una ventana en la que binario y clon difieren. Si un PJ
YA invisible bebe la poción púrpura, el binario muestra la rata (`0x90` recién escrito) hasta
que el pestillo dispare, y ahí vuelve a la silueta; el clon muestra la silueta desde el
principio. El clon reproduce el estado ESTABLE, no el transitorio. Alcanzar esa ventana pide
las dos pociones en el mismo combate y en ese orden. Elegido a conciencia, no por descuido.

## 4. El ENEMIGO no entra aquí — y el filtro del clon era fiel

Confirmado (el testigo ya lo tenía en su §4, y coincide): la habilidad de combate se
resuelve en `COMSUBS.OVL:0x01d7` y escribe `+1 := 0` (`COMSUBS.OVL:0x0236`), no `0x1d`; la
rama inversa restaura `+1` desde `+0` (`COMSUBS.OVL:0x0214`, `COMSUBS.OVL:0x0218`). Cero es
el valor con que se borra la tabla (`TOWN.OVL:0x0fed` entera, `FONT.OVL:0x08b1` por ranura)
y el compositor lo usa de centinela. ⇒ el enemigo invisible **no se pinta**, el filtro del
clon se queda, y el comentario que lo acompañaba —que lo daba por válido para TODOS— queda
acotado al enemigo.

Enemigos con esa habilidad, censados sobre la tabla del juego
(`(flags[0]<<8)|flags[1] & 0x0008`): **3** — los grupos `BLACKTHORN`, `GHOSTS`,
`SHADOW LORD`.

## 5. El arreglo, y un defecto hermano del mismo banco

En `re/invisible-12`:

- El campo pasa a llamarse `renderTile` (semántica del `+1`) y lo escriben los TRES
  caminos del party: Sanct Lor, anillo (al montar la arena y en el pase de estado) y poción
  negra.
- El pintor resuelve el tile de un PJ como: invisible ⇒ silueta; si no, `renderTile` si lo
  hay; si no, el sprite de su clase.
- **Defecto hermano encontrado de paso, y arreglado:** el `renderTile` entraba CRUDO en la
  ventana, sin el `+0x100`. El atlas `0x90` es una **silla**: el PJ polimorfiado por la
  poción púrpura salía silla en vez de rata (`0x190`). Estaba vivo en `main` desde el lote
  de las pociones.

**No mueve RNG.** Los escritores son asignaciones de byte; Sanct Lor y Wis Quas ya estaban
declarados sin RNG en el clon; la única tirada del vecindario es la puerta
`rand0(0xff) < 0x20` de la habilidad del enemigo, intacta. Cambio de PRESENTACIÓN.

**Testigo de regresión** (`game/tests/invisible-render-tile.test.ts`, 9 casos + 4 en el de
pociones), validado con **siete mutantes**, cada uno matando su aserto: quitar la lectura
del campo en el pintor · quitar el `+0x100` · quitar la dominancia del flag · quitar el tile
en Sanct Lor · en el anillo · en la poción negra · (y el `+0x100` en la variante nueva).

**Alcanzabilidad, medida sobre `game/assets/initial-state.json`:** poción negra 0 unidades,
conjuro 36 con 0 cargas, y ningún miembro del grupo inicial con el anillo `0x2A` (el único
anillo de fábrica es `0x2b`, y lo lleva un personaje fuera del grupo). Los tres caminos son
ADQUIRIBLES pero no de salida: el usuario llegó con material recogido en partida y este
censo **no puede decir por cuál de los tres**. El camino del enemigo sí es de salida (3
grupos) y no estaba roto.

## 6. Lo que esta ficha NO hace

- **No mide en vivo.** Todo lo de aquí es lectura de ASM, del atlas y del clon. La parte en
  vivo la aporta `invisibilidad-testigo.md`, que no repito.
- **No mide el transitorio de la reserva del §3**, ni con qué frecuencia dispara el pestillo
  `0x08` en juego real: he leído sus tres escritores, no contado sus disparos.
- **No toca el overworld.** Los tres caminos son de arena en el clon; que el `0x1d` de la
  ranura 0 llegue o no al sobremundo no lo he comprobado.
- **No cierra el censo de escritores del `+1`.** Cota INFERIOR, sólo sobre la forma literal
  del desplazamiento (`grep -c '0x5c5b\|g_char_anim_states+1\b' re/disasm/*.asm`): **48
  líneas en 11 ficheros**. Es cota y no censo: los accesos por puntero en registro
  (`mov [di+1],al` — justo la forma de la poción negra) NO entran en ese predicado.
