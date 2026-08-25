# SONDA `0xec` — pasos exactos (para correr en TU DOSBox)

**Qué contesta**: qué coloca el original para la familia de sprite `0xEC` (el «remolino») en las
salas de mazmorra. Hoy el port no coloca nada ahí — está derivado que el original **no** usa el
índice 43, pero **no** qué usa en su lugar, porque lo lee de 4 bytes de pila que la rutina nunca
escribe. Esto **desbloquea el veredicto de fidelidad de 4 salas** y el ticket #25.

**Tiempo**: ~10 min. **Escenario ya instalado**: `covetous-r1-remolinos`.

---

## 0. Arrancar (copia y pega)

```bash
u5save
```
Elige **`covetous-r1-remolinos`** en el menú y acepta lanzar DOSBox.

> Quedas en **Covetous, planta 0, celda (0,2)**, justo al lado de la sala. Party de 6.

---

## 1. ⚠ PRIMERO ENTRA EN LA MAZMORRA, LUEGO PON EL BREAKPOINT

**Esto es lo que más tiempo puede hacerte perder.** `DNGLOOK.OVL` es un **overlay**: su código
**no está en memoria** hasta que el juego lo carga. Si pones el breakpoint desde el menú o desde
Britannia, apuntará a bytes de otro overlay y **no parará donde toca** (o parará en basura).

El save ya te deja DENTRO de Covetous, así que el overlay estará cargado. Aun así, **da un paso
cualquiera primero** (una vuelta sobre ti mismo con ← o →) antes de abrir el debugger.

---

## 2. Abrir el debugger y poner el breakpoint

Abre el debugger de DOSBox-X (menú **Debug → Start DOSBox-X Debugger**, o `Alt+Pausa`).

En la consola del debugger:

```
BPM B587
```

**De dónde sale `B587`**: la regla de banda del proyecto —
`near_call_base(DNGLOOK) 0xA290 + file-offset 0x12F7 = 0xB587`. Es la instrucción
`mov al,[bx-6]`, la que LEE los 4 bytes que queremos.

**Si `BPM B587` no para** (o el debugger de tu build usa otra sintaxis), usa el plan B —
busca el patrón de bytes, que es único e inequívoco:

```
SEARCH 0 FFFF 81 E3 03 00 03 DD 8A 47 FA
```

Son `and bx,3` + `add bx,bp` + `mov al,[bx-6]`. Pon el breakpoint en la dirección que te dé
**+6** (el `8A 47 FA` empieza 6 bytes después del inicio del patrón).

---

## 3. Provocar la parada

Vuelve al juego y:

1. Gira hasta mirar al **OESTE** (con ← / →).
2. Pulsa **↑** (un paso).

> La sala está al oeste **por el borde** (la rejilla 8×8 da la vuelta), así que ese paso te mete
> en el combate de la sala **r1 / combatmap 65** — la que tiene la familia entera: **6 unidades
> `sprite 236` + 6 `sprite 237`** + 1 Ghost.

El breakpoint debería saltar **al cargar la sala**, antes de que veas la arena.

---

## 4. Qué volcar en CADA parada (esto es el dato)

En la consola del debugger, con el programa parado:

```
R
D SS:BP-6 L 4
```

Y apunta **cuatro cosas**:

| qué | cómo obtenerlo |
|---|---|
| **los 4 bytes** `SS:BP−6 .. SS:BP−3` | el `D` de arriba |
| **el sprite** que se está procesando | `D SS:BP-8 L 1` (un byte: será `EC`, `ED`, `EE` o `EF` = 236-239) |
| **BP** | sale en el `R` |
| **cuántas veces para** | pulsa continuar (`F5` o `G`) y cuenta — debería parar **12 veces** (6+6 unidades de la familia) |

Con `G` sigues hasta la siguiente parada. **Anota los 4 bytes de cada una** (o al menos de las
primeras 4-6, y dime si cambian entre paradas o son siempre los mismos).

---

## 5. Las TRES corridas (esto es lo que decide)

La pregunta de fondo es **si ese valor es estable o basura variable**:

1. **Corrida A** — la que acabas de hacer.
2. **Corrida B** — **sin salir de DOSBox**: sal de la sala (huye o gana), vuelve a la celda (0,2)
   y **entra otra vez** a la misma sala. Mismos volcados.
3. **Corrida C** — **cierra DOSBox del todo, vuelve a arrancar** con `u5save` →
   `covetous-r1-remolinos`, y repite una vez.

**Lo que buscamos**:
- si A = B = C ⇒ el valor es **determinista** y lo calcamos tal cual;
- si A ≠ C (o B difiere de A) ⇒ **depende del estado de carga del overlay** ⇒ el original es
  no-determinista ahí y el port declara divergencia en vez de calcar.

---

## 6. Dónde pegar el resultado

Cualquiera de las dos:
- **responde al email** del hilo, o
- pega el volcado en bruto en `re/notes/sonda-0xec-RESULTADO.txt` (lo interpreto yo).

No hace falta que interpretes nada: **pega los bytes tal cual**, aunque parezcan ruido. Que
parezcan ruido **es** parte de la respuesta.

---

## 7. Lo que NO he podido verificar (para que no pierdas tiempo si falla)

- **La sintaxis exacta del debugger de tu build de DOSBox-X.** `BPM`, `D`, `SEARCH` y `R` son las
  habituales, pero no las he ejecutado yo (no toco tu DOSBox). Si alguna no existe, el menú
  **Debug** del propio DOSBox-X lista las disponibles, y el plan B del §2 no depende de `BPM`.
- **Que el breakpoint pare exactamente 12 veces.** Es lo que predice el dato del `.CBT`; si para
  muchas más (o ninguna), dímelo — sería información igual de útil.

---

## OPCIONALES — «si te sobran 5 minutos»

### A. Campanada del reloj (derivado, le falta testigo) — **sí es un test de jugar**

El reloj tiene dos sonidos y sólo tenemos cableado el tic/tac. **Juega en un interior con reloj
hasta que cambie la hora** y dime: ¿suena una **campanada** distinta del tic/tac?, y si suena,
**¿cuántas veces seguidas** (¿tantas como la hora en formato 12h?) y **cada cuánto**. Con eso se
cierra sin re-derivar (`re/notes/ambient-audio-audit.md` §5.1).

### B. Clavicémbalo de LB — **qué muro se abre** (G2b)

En el **Castillo de Lord British, planta 2**, siéntate en la silla junto al clavicémbalo y tócalo.
Sabemos que abre un pasadizo (`StoneBrickWall 0x4F → BrickFloor 0x44`) pero **no cuál de los 13
muros candidatos**. Si al tocarlo ves que se abre un hueco: **dime dónde** (una captura, o «a la
izquierda de la sala, 2 casillas al norte»). Eso fija la celda y cierra G2b.

### C. Viento de la nave (#37) — **NO incluido a propósito**

No he localizado su spec en `re/notes/`, así que **no invento pasos**. Si me dices dónde está
apuntado el ticket, preparo la tarjeta.
