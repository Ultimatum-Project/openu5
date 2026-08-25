# #249 — La hora de destino del sueño en cama: el original NO cuenta horas, GIRA hasta la hora

Fecha: 2026-07-30. Estado: **derivado y ejecutable**; falta un solo dato de grano (§4).

## 1. El port y el original no difieren en un número: difieren en la FORMA del bucle

`core/world/camp.ts:233` hace `for (h = 0; h < hours; h++) advanceClock(state, 60, …)` —
suma **60 minutos exactos** por vuelta, `hours` veces.

El original hace otra cosa. Cuerpo del bucle, verbatim de `re/disasm/CMDS.OVL.asm`:

```
0627: a07f58    mov al, byte ptr [g_hour]      ; hora ACTUAL
062a: 2ae4      sub ah, ah
062c: 8bf8      mov di, ax                     ; guarda la hora de INICIO
062e: 8b76fa    mov si, word ptr [bp - 6]      ; hora DESTINO (ver §2)
0631: eb08      jmp 0x63b                      ; ★ entra POR EL TEST, antes del 1er paso
0633: 90        nop
0634: b80100    mov ax, 1
0637: 50        push ax
0638: e83f5b    call 0x617a                    ; UN PASO
063b: 8bc6      mov ax, si                     ; destino
063d: 8a0e7f58  mov cl, byte ptr [g_hour]      ; hora AHORA
0641: 2aed      sub ch, ch
0643: 3bc1      cmp ax, cx
0645: 744b      je 0x692                       ; ★ SALE cuando el reloj IGUALA el destino
```

⇒ Es un **`while (g_hour != destino)`**, no un `for (N horas)`. Y el `jmp 0x63b` de entrada
hace que con el reloj YA en la hora de destino no se dé ni un paso.

## 2. ★ La resta de 23, confirmada al byte

La tarjeta arrastraba «el original resta 23 (no 24)» sin respaldo. Existe:

```
05a8: 8946fa    mov word ptr [bp - 6], ax
…
05b0: 836efa17  sub word ptr [bp - 6], 0x17     ; ★ 0x17 = 23 decimal
```

y entre las dos hay una guarda (~`0x05ab`) que decide si resta. `[bp-6]` es exactamente la
palabra que §1 carga en `si` como destino ⇒ **éste es su productor**, sin intermediarios.

## 3. Qué cambia para el jugador — el «filo de hora»

Con el reloj en **10:37** y destino la **13**: el original para **al marcar las 13**; el port
suma 3×60 y acaba a las **13:37**. La diferencia no es cosmética: el reloj gobierna horarios
de NPC, fases lunares y el gate de día/noche.

## 4. Lo que falta antes de tocar código (uno solo)

Si `call 0x617a` con argumento 1 avanza **un minuto** o **una hora**. Decide el GRANO del
giro y, con él, el consumo de RNG del sueño entero. Sin ese dato el fix se puede escribir
con la forma correcta pero no con el paso correcto.

## 5. Alcance del fix, y lo que NO se toca

- **SÍ**: la forma del bucle en `camp.ts:233` y portar el cómputo del destino con su resta.
- **NO**: el resto de `bedSleep`. El snap de NPCs (#158), el gate de «Thrown out of bed!»
  (#230/#241), la ida y vuelta `G`↔`S` y el `+1` de `party_x` (#250) están calcados **con su
  cita** y son correctos. Un fix que los toque está tocando de más.

⚠ Moverá el stream de RNG y con él los digests e2e ⇒ entra en lo que la ventana de **#222**
debe re-sellar. Declarado, no supuesto.

## 6. ★★ CORRECCIÓN de §1: el «paso» NO avanza el reloj — es un RETARDO

Resuelto el hueco que §4 dejaba abierto, y sale al revés de como yo lo había escrito.
`near_calls_to_kernel('CMDS.OVL', …)` identifica el destino de `0638: call 0x617a`:

> **`delay_ticks_int1c`** — kernel `0x20FA`, 114 B, **IDENT** en el ledger.

Es un **retardo por ticks del temporizador**, no un avance de reloj. En §1 lo llamé «UN
PASO» dando por hecho que empujaba la hora, y **eso era una suposición mía, no una lectura**:
el bucle real es

```
while (g_hour != destino) { delay_ticks(1); }
```

o sea una **espera activa sobre el reloj**, con el reloj avanzando por OTRA vía (el tick del
juego / la interrupción), no por el cuerpo del bucle.

### Qué cambia, y qué NO

- **El veredicto de §1 se mantiene y hasta se refuerza**: el original **no cuenta N horas**,
  espera a que el reloj MARQUE el destino. El «filo de hora» de §3 sigue siendo correcto.
- **La forma del fix, NO.** El port no puede limitarse a «girar»: hay que saber **quién
  empuja `g_hour`** durante esa espera y a qué ritmo, porque de eso depende cuánto tiempo de
  juego pasa y cuánto RNG se consume. Portar un `while` vacío sobre un reloj que en el clon
  no avanza solo sería un **cuelgue**, no un calco.
- ⇒ §4 se reescribe: lo que falta **no es «el grano del paso»**, es **el productor del avance
  del reloj dentro de la espera**. Es una pregunta distinta y más grande.

★ La lección, que ya me mordió hoy en #286 §8: **nombrar una llamada por lo que encaja con
mi hipótesis, en vez de resolver a qué rutina va, mete la suposición dentro de la
derivación**. La resolución cuesta un comando y la tenía a mano desde el principio.

⇒ **#249 vuelve a estar bloqueada por lectura**, no por decisión. Y su fix es MÁS grande de
lo que §5 decía: no es cambiar la forma de un bucle, es modelar una espera sobre un reloj
que avanza por fuera.

## 7. ★★ Por qué la tarjeta decía «23, NO 24»: hay un 24 al lado, y es OTRA cosa

Censados los escritores de `g_hour` en TODO el corpus (28 `.asm`). Son **tres**:

| dónde | instrucción | qué es |
|---|---|---|
| kernel `0x4FE2` | `inc byte ptr [g_hour]` | el avance de `advance_clock` |
| kernel `0x4FF0` | `mov byte ptr [g_hour], 0` | su envolvimiento a medianoche |
| CMDS `0x01FF` | **`sub byte ptr [g_hour], 0x18`** | ★ resta **24**, en OTRO flujo |

⇒ **La advertencia de la tarjeta se explica sola.** Hay dos restas parecidas y NO son la
misma operación:

- `CMDS 0x01FF` resta **24 (0x18)** **a la hora VIVA** — es un envolvimiento de medianoche.
- `CMDS 0x05B0` resta **23 (0x17)** **a `[bp-6]`, que es la hora DE DESTINO** (§2), una
  variable local que nunca es el reloj.

Distinto operando, distinto momento y distinta constante. Copiar el 24 del envolvimiento
sobre el cómputo del destino sería el error exacto que la tarjeta anticipaba sin poder
citarlo — y ahora está citado por los dos lados.

### Y acota el hueco de §6 a UN candidato

Como los únicos escritores son esos tres y **ninguno está dentro del bucle de espera**, quien
empuja la hora durante el `while` tiene que ser **`advance_clock` llamado desde fuera** (el
tick del juego). No lo afirmo como derivado: lo MEDIDO es que en el cuerpo del bucle no hay
ningún escritor, y eso reduce §6 de «alguna vía desconocida» a **un candidato nombrado** que
se verifica leyendo quién invoca `advance_clock` durante la espera.

## 8. El «cero» de 0x20FA era un PRÓLOGO OCULTO por pad-byte — familia #80 confirmada

En §6 dejé un cabo: `grep '^20fa:'` sobre el disasm daba **cero**, y avisé de que hasta
resolverlo el nombre de la rutina de retardo era prestado del ledger. Resuelto, y el ledger
tiene razón. La vecindad, verbatim:

```
20f6: c20400    ret 4              ; ← fin de la rutina ANTERIOR
20f9: 00558b    add byte ptr [di - 0x75], dl   ; ★ decodificación FALSA
20fc: ec        in al, dx
20fd: 56        push si
20fe: 57        push di
```

El byte de 0x20F9 es un **relleno `00`**, y el desensamblador lo consume como opcode: se
traga los tres bytes siguientes —`55 8b ec`, que son **`push bp` / `mov bp, sp`**— dentro de
una instrucción inventada. Es decir, **0x20FA SÍ es cabeza de rutina**; lo que falta es su
prólogo, comido por el pad.

⇒ Instancia de manual de la familia de **#80** (`asm-prologos-ocultos-pad-byte`). Y el
corroborante: hay **tres `call 0x20fa`** en ULTIMA.EXE (`1b84`, `3b0e`, `4924`), o sea la
rutina se llama tres veces aunque su cabecera sea invisible al grep.

★ La lección práctica: **«el grep de la cabecera da cero» NO desmiente al ledger** en este
corpus — es uno de los síntomas conocidos. La forma correcta de refutar una ficha es por los
BYTES (`55 8b ec`) o por sus llamadores, no por la línea del disasm. Mi aviso de §6 queda
retirado: el nombre `delay_ticks_int1c` se sostiene, y con él la corrección de §6.

## 9. El cuerpo del retardo NO toca el reloj — y eso deja UNA hipótesis con su prueba

Leído el cuerpo de la rutina de retardo (desde `0x2100`, ya sabiendo dónde empieza por §8):
usa **`int 0x21`** (servicios DOS) en tres puntos y varios bucles `loop`, y **no hay ni una
llamada a `advance_clock`** en él. Es un retardo por tiempo REAL, coherente con el `int1c`
de su nombre (el tick del temporizador de la BIOS).

⇒ Junta esto con el censo de §7 —los únicos escritores de `g_hour` son `advance_clock` y el
envolvimiento de CMDS, y ninguno está dentro del bucle ni dentro del retardo— y queda **una
sola explicación en pie**: el reloj lo empuja un **manejador de interrupción** enganchado al
tick, fuera del flujo que se lee siguiendo `call`s.

⚠ **Eso es HIPÓTESIS, no derivación.** Lo medido es negativo: *nadie del camino visible toca
la hora*. Y un negativo no nombra al culpable.

**Cómo se prueba** (y por qué no lo hago ahora): hay que buscar quién **instala** el vector
de interrupción —`int 0x21` con AH=0x25 (set vector) sobre 0x1C— y leer ese manejador. Es
una vía distinta de todas las que este acta ha usado (nadie llega ahí por `call`), y por eso
la dejo nombrada en vez de tirar de ella con el contexto justo.

★ Y hay una consecuencia para el PORT que sí se puede afirmar ya: si el reloj del original
avanza por interrupción durante una espera, **el sueño en cama del original transcurre en
tiempo real**, y el clon —que no tiene interrupciones— tendrá que modelarlo con un bucle
determinista. Eso NO es «calcar el bucle»: es elegir una equivalencia, y toda equivalencia
elegida se declara. Motivo de más para que #249 no se despache como un cambio de forma.

## 10. ★★★ CIERRE — el bucle SÍ avanza el reloj: `advance_clock(10)`. Se cae la hipótesis de §9

Tercera corrección mía sobre esta ficha, y la que la cierra. Leí el bucle **hasta el salto de
salida** y di por hecho que ahí acababa el cuerpo. **No acaba: si el `je` no salta, la
ejecución CAE.** Y lo que hay debajo es esto:

```
0634: b80100    mov ax, 1
0638: e83f5b    call …               ; delay_ticks(1) — retardo de ANIMACIÓN
063b: 8bc6      mov ax, si
063d: 8a0e7f58  mov cl, byte ptr [g_hour]
0643: 3bc1      cmp ax, cx
0645: 744b      je 0x692              ; ¿el reloj marca el destino? ⇒ SALE
0647: b80a00    mov ax, 0xa           ; ★ DIEZ
064a: 50        push ax
064b: e8ae89    call …                ; ★ advance_clock  (resuelto: kernel 0x4F7C, IDENT)
```

⇒ **El propio bucle empuja el reloj de DIEZ EN DIEZ MINUTOS**, con un tick de retardo por
vuelta para que la espera se vea. No hay espera pasiva, no hace falta ninguna interrupción.

### Lo que esto tumba y lo que confirma

- **§9 se cae ENTERA.** La hipótesis del manejador de interrupción era innecesaria, y ya
  venía debilitada por su propia medición: los únicos `set vector` del binario son para
  `INT 00h` (`mov ax, 0x2500` ×2), ninguno para el tick.
- **§6 se cae a medias**: la llamada de `0x0638` sí es un retardo —eso era correcto— pero
  **no es el cuerpo del bucle**, sólo su primera línea.
- **§1 y §2 se mantienen intactas y ahora se explican**: el «filo de hora» sale de que se
  avanza a saltos de **10 minutos** hasta que el CONTADOR DE HORAS cambia al valor pedido.
  Por eso nunca se aterriza en `:37` — se aterriza en el primer múltiplo de 10 de la hora
  destino.

### #249 queda DERIVADA del todo

| pieza | valor |
|---|---|
| forma | `while (g_hour != destino) { delay(1); advance_clock(10); }` |
| grano | **10 minutos** por vuelta |
| destino | `[bp-6]`, con `sub …, 0x17` (**23**) y su guarda |
| el 24 vecino | otra operación (envolvimiento de la hora VIVA) |

El port hace `for (h<hours) advanceClock(60)`: difiere en la **forma**, en el **grano** y en
el **destino**. Ya no queda nada que leer.

★ **El patrón de mis tres errores en esta ficha es el mismo**: parar de leer donde mi
hipótesis quedaba satisfecha — el nombre de una llamada sin resolver, un retorno de una rama
inalcanzable, y un bucle cortado en su salto de salida. **El binario contestaba las tres
veces; yo dejaba de preguntar.**
