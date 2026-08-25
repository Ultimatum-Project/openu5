# ACTA #242 — el QUINTO canal EXISTE y NO está vacío: **0xAB02 tiene 5 cargas y 0xAD14 tiene 9**

> Rama `re/quinto-242`, worktree `.claude/worktrees/quinto-242`, base **main `5c69bd43`**.
> RETENIDA: aterriza el lead. Ejecuta la tarjeta #242, abierta por #240 tanda 1.

---

## 0. VEREDICTO, primero

**El quinto canal existe, es medible, y las cifras de #68 y #219 NO aguantan como censo completo.**

| dirección | cargas en registro | de ellas en registro-puntero | con uso `[reg]` cerca |
|---|---|---|---|
| **0xAB02** (`g_vis_buffer`, #68) | **5** | 4 | 2 |
| **0xAD14** (#219) | **9** | 6 | 5 |

Los dos búferes que #240 marcó «canal indexado VACÍO» —y que por ser búferes hacían sospechar—
tienen **población invisible a los cuatro canales anteriores**. La sospecha de la tarjeta era
correcta y ahora está medida, no argumentada.

⚠ **Y la reserva, en la misma frase**: esto **no dice que las cifras de #68/#219 estén mal**.
Dice que **su columna «este defecto no le aplica» no era «censo completo»**, que es exactamente
lo que la tarjeta pedía comprobar. Las cifras publicadas quedan **NO DESMENTIDAS pero tampoco
confirmadas**: para adjudicar haría falta leer los 14 sitios, y eso es trabajo nuevo.

---

## 1. EL CONTROL POSITIVO, buscado ANTES de construir nada

El encargo lo pedía explícito, y con razón: si no existiera ningún `mov reg, 0xAB02` real, el
cero habría que declararlo con método en vez de asumirlo. **Existe, y con holgura:**

```
ULTIMA.EXE:0x59fb   mov di, 0xab02
ULTIMA.EXE:0x5d17   mov si, 0xab02
ULTIMA.EXE:0x5d5d   mov ax, 0xab02
```

Y el positivo conocido de #240, `g_world_objects` 0x5C5A, da **29** cargas — el canal ve lo que
tiene que ver antes de que se le pregunte nada.

---

## 2. ★ LA PARTICIÓN DE BASURA, declarada ANTES de publicar y DERIVADA del ISA

La tarjeta avisaba: un inmediato que coincide con una dirección **no es** una referencia. La
partición no se elige a ojo — **la da el 8086**:

**Sólo `BX`, `SI`, `DI` y `BP` pueden direccionar memoria indirectamente** (`[bx]`, `[si]`,
`[di]`, `[bp]`). `AX`, `CX` y `DX` **no pueden**: un `mov ax, DIR` no desreferencia ahí.

| clase | cae en el ledger | fuera del ledger |
|---|---|---|
| **PTR** (`bx`/`si`/`di`/`bp`) | **193** ← candidatos | 486 |
| **NO-PTR** (`ax`/`cx`/`dx`) | 144 | 2241 |
| | | **población bruta 3.064** |

De los **193 candidatos**, **133** tienen un uso `[reg]` en las **10** instrucciones siguientes
(ventana DECLARADA, aproximación de flujo) y **60 no lo tienen**.

⚠ **La partición NO es «bueno contra basura»**, y decirlo así sería el error: un `mov ax, DIR`
puede ser un **puntero pasado como argumento** (`push ax`), que es un acceso por dirección
aunque no desreferencie ahí. Las dos clases responden a **preguntas distintas**: PTR = «puede
desreferenciar aquí mismo»; NO-PTR = «se pasa o se copia». Los 144 NO-PTR en ledger **no se
descartan**: quedan fuera del alcance de esta aproximación.

### 2.1 Los cuatro controles

| control | resultado | |
|---|---|---|
| POSITIVO `0x5C5A` (`g_world_objects`, el pin de #240) | 29 cargas · 19 PTR · 15 con uso | ✅ |
| POSITIVO `0xAB02` (`g_vis_buffer`, #68) | 5 · 4 · 2 | ✅ |
| NEGATIVO `0x270f` = 9999, el tope de comida de #238 | 14 cargas, **0 PTR**, **fuera del ledger** | ✅ |
| NEGATIVO `0x0100`, constante redonda | 39 cargas, 2 PTR, **fuera del ledger** | ✅ |

De los dos negativos el que tiene dientes es el primero: **14 cargas de un valor que ya sabemos que es un NÚMERO**
(derivado en #238 por `cmp word ptr [g_food], 0x270f`). El canal no lo confunde con una
dirección porque no está en el ledger — y las 0 PTR lo confirman por el otro eje.

---

## 3. ★ CANDIDATOS, NO ACCESOS — y por qué la distinción no es cosmética

**Sin seguimiento de flujo real, este instrumento produce CANDIDATOS.** El registro puede
reasignarse entre la carga y el uso; la ventana de 10 es una aproximación, no una prueba. Las
cifras de este acta se leen así **en todas partes**:

- «5 cargas de `0xAB02`» = **cinco sitios donde el binario mete esa dirección en un registro**.
- **NO** = «cinco accesos a `g_vis_buffer`».

Lo que **sí** está probado es lo que la tarjeta necesitaba: **el canal no está vacío**, así que
«canal indexado vacío» nunca fue «censo completo».

---

## 4. LA REGLA que deja la tarjeta, confirmada por su propio resultado

**«Canal X vacío» no es «censo completo»: es «este defecto no aplica».** La lista de canales
conocidos es **ella misma una cota superior**, y cada canal nuevo la reabre. Van cinco:
(1) hex desnudo · (2) símbolo `g_x+N` decimal · (3) desplazamiento negativo · (4) indexado
(#240) · (5) **dirección en registro** (éste). Nada garantiza que no haya un sexto — y la
manera de saberlo no es razonar, es que aparezca un caso que ninguno vea.

---

## 5. Lo que este carril NO ha hecho

- **No ha leído los 14 sitios** de 0xAB02/0xAD14: son candidatos sin adjudicar, no accesos.
- **No ha corregido ninguna cifra** de #68, #219, #189, #220 ni #225. Quedan **no desmentidas**.
- **No ha tocado `re/tools`**: la medida corre sobre el extractor compartido `cita_rama_hermana`
  y el ledger; cablearla pide su propia tanda con partición-idéntica.
- **No ha tocado `game/src`.** Nada de e2e, censos embargados intactos.

## 6. Cabos

1. **Leer los 14 candidatos** de 0xAB02 y 0xAD14 y adjudicar si las cifras de #68/#219 cambian.
2. **Los 60 candidatos PTR sin uso cercano**: o la ventana de 10 se queda corta, o son punteros
   guardados para después. Sin medir.
3. **Los 144 NO-PTR en ledger**: la pregunta «¿se pasa como argumento?» está sin abrir.

## 7. Overlays nombrados aquí (sección FINAL a propósito)

`ULTIMA.EXE`, `DNGLOOK.OVL`, `DUNGEON.OVL`.
