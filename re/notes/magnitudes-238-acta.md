# ACTA #238 — ¿cuántos «punteros a cadena» del partidor son MAGNITUDES? **1 de 206 (0,5 %)**

> Rama `re/inmediato-232` (commits encima de 80daa552, ya en main como `f16b76b7`), worktree
> `.claude/worktrees/inmediato-232`, base **main `05e3e178`**. RETENIDA: aterriza el lead.
> Ejecuta la tarjeta #238, que abrí yo desde `re/notes/inmediato-232-acta.md` §3.2.

---

## 0. VEREDICTO, primero — y es un resultado NEGATIVO

**El mecanismo que encontré en #232 es un caso AISLADO, no un agujero sistémico.** De los **206**
inmediatos que el decodificador resuelve a prosa en la población pegajosa, exactamente **1** es
una magnitud disfrazada de puntero: `0x270f` = 9999, el que ya había leído. **0,5 %.**

Dos discriminadores independientes convergen en el **mismo único miembro** (§2), con positivo y
dos negativos byte-verificados en verde. ⇒ **el partidor de cadenas es mucho más fiable de lo que
sugería mi instancia única**, y decirlo así es el entregable: la tarjeta pedía la cifra, la cifra
es pequeña, y una cifra pequeña bien medida vale igual que una grande.

**Cota, en la dirección correcta:** los discriminadores encuentran **≥1** `EMITIDA` sostenido por
un número ⇒ la fiabilidad del partidor por este mecanismo es **como máximo 205/206 = 99,5 %**. Es
una cota SUPERIOR. La inferior sigue sin conocerse, porque los dos discriminadores comparten un
punto ciego declarado en §3.

---

## 1. ★ CORRECCIÓN DE MI PROPIA TARJETA: el decodificador NO se inventa nada

El título que le puse a #238 —«`text_at_lax` decodifica NÚMEROS como cadenas»— **está mal
encuadrado**, y encuadrarlo así habría llevado a «arreglar» un decodificador que funciona.
Medido, byte a byte:

```
DS 0x270f -> fileoff 0x271f: b'Missed!\n\x00Mur'   text_at_lax = 'Missed!\n'
DS 0x9b16 -> fileoff 0x9b26: b'\nEnjoy!"\n\n\x00\x00'  text_at_lax = '\nEnjoy!"\n\n'
```

**`DATA.OVL` SÍ tiene los bytes `'Missed!\n'` en `0x270f`.** El decodificador lee lo que hay. El
problema es otro y es del corpus, no del instrumento: **el binario reutiliza el mismo valor de 16
bits como MAGNITUD y como offset válido de cadena**, y el partidor no puede saber cuál quiso el
call-site. `DATA.OVL` es lo bastante grande como para que casi cualquier valor de 4 dígitos
apunte a *algo*.

⇒ **El discriminador tiene que mirar el USO en el corpus, no el destino.** Toda la tarjeta
depende de esa distinción, y la tenía invertida al abrirla.

---

## 2. LOS DOS DISCRIMINADORES, con sus controles

Ambos preguntan lo mismo por vías distintas: *¿el corpus trata este valor como una magnitud en
algún sitio?* Ninguno mira el destino.

**D1 — `cmp <GLOBAL CATALOGADA>, valor`.** Comparar una variable de estado del juego contra el
valor sólo tiene sentido si el valor es una magnitud en las unidades de esa global. Es la firma
que destapó el caso: `SHOPPES2.OVL:0x0462  cmp word ptr [g_food], 0x270f`. Cobertura del corpus:
**55** valores distintos comparados contra alguna global catalogada.

**D2 — `cmp <cualquier cosa>, valor`** (registro o memoria, sin exigir que la global esté
catalogada). Más ancho a propósito, para tapar parte del punto ciego de D1. Cobertura: **48**
valores distintos.

| | positivo `0x270f` | negativo `0x9b16` (`'\nEnjoy!"'`) | negativo `0x2780` (lava) | marcados de los 206 |
|---|---|---|---|---|
| **D1** | firma `g_food` ✅ | sin firma ✅ | sin firma ✅ | **1** = 0,5 % |
| **D2** | firma ×4 ✅ | sin firma ✅ | sin firma ✅ | **1** = 0,5 % |

Los dos negativos son **cadenas REALES verificadas por bytes** en `DATA.OVL`, que es lo que les da
dientes: si el discriminador marcara una de ellas, estaría llamando número a una cadena.

**El único marcado, y es el mismo en los dos:**

```
SHOPPES2.OVL:0x01c4   inm=0x270f (= 9999)   estado=EMITIDA   texto='Missed!\n'   cmp contra ['g_food']
```

**CONTROL DE ESPECIFICIDAD:** la misma señal sobre los 48 inmediatos que **no** resuelven a prosa
da **0 de 48**. No marca por marcar.

⚠ **Convergencia, no confirmación independiente.** D1 y D2 comparten el mecanismo (`cmp`), así que
coincidir no multiplica la evidencia: acota el punto ciego por un lado y lo deja intacto por el
otro. Lo digo porque «dos discriminadores dan lo mismo» se lee fácil como «doble verificación», y
no lo es.

---

## 3. ★ EL PUNTO CIEGO, declarado por delante

Los dos discriminadores sólo ven valores que el corpus **COMPARA en algún sitio**. Una magnitud
que sólo se EMPUJA como argumento y nunca se compara es **invisible a los dos**.

Y esto no es hipotético: **es el propio call-site de `0x270f`.** Ahí el valor sólo se empuja
(`mov ax, 0x270f / push ax / call 0x5d34`). Se cazó por el `cmp` de **otra** rutina, en otro
offset del mismo overlay. Si el binario no hubiera comparado `g_food` contra 9999 en ningún
sitio, mi propio caso positivo habría sido invisible para este censo.

⇒ **0,5 % es un piso de detección, no un techo de incidencia.** La formulación honesta:
*«de los 206, al menos 1 es una magnitud; los otros 205 no están desmentidos por este
discriminador, que es distinto de estar confirmados como cadenas»*.

**Lo que cerraría el hueco de verdad** (no se hace aquí, es trabajo nuevo): leer el CALLEE y ver
qué hace con el argumento — si lo usa como puntero (`mov si, ax` + lectura de bytes) o como
número (aritmética, comparación). Eso es derivación por consumidor, la clase fuerte, y es cara.

---

## 4. LO CABLEADO, y lo que NO se ha tocado

En `re/tools/cita_hermana_emitida.py` (el mismo módulo, sin escáner nuevo):

- **`firmas_magnitud(asm)`** — valor → globales contra las que el corpus lo compara. Sobre el
  disasm ya cargado; cero relectura de ficheros.
- **`control_magnitud()`** — el positivo, los dos negativos byte-verificados, la cifra, y la
  lista de marcados. Entra en el `return` del módulo: si el positivo deja de disparar o un
  negativo empieza a hacerlo, el gate se cae.
- El bloque impreso lleva **el LÍMITE y el PUNTO CIEGO junto a la cifra**, no en el acta: quien
  lea «1 de 206» lee dos líneas más abajo por qué eso es una cota superior.

**CERO reclasificaciones.** El par `SHOPPES2.OVL:0x01c4`, sigue en `EMITIDA`. La partición del
partidor no se ha tocado, y el invariante de #232 (`estado == f(cadenas del par)`) sigue verde en
la misma corrida. Como pedía el encargo: si el censo salía feo, el entregable era la cifra y la
lista — y ha salido limpio, así que con más razón no se re-buckea nada.

**No se ha tocado la población por defecto** del módulo (sigue `sticky=False`); la cifra se mide
sobre la **pegajosa**, etiquetada, que es donde vive el caso.

---

## 5. Cabo, con dueño

**El `EMITIDA` del par `SHOPPES2.OVL:0x01c4`, sigue sostenido por una coincidencia**, y eso no lo
arregla esta tarjeta: `EMITIDA` significa «el port modela esta rama» y saca el par de la cola de
huecos. Con la cifra en la mano (1 de 206) **la decisión es baratísima: es UN par, se lee y se
adjudica a mano**. Lo dejo declarado y sin adjudicar porque adjudicarlo exige leer si el port
modela la rama del `add_capped(&g_food, n, 9999)` — mecánica de tienda, no instrumento.

---

## 6. Gates (EXIT por separado, sin pipes, tras el `git add`)

Ver el mensaje del commit.

---

## 7. Nombres de overlay usados aquí (sección FINAL a propósito)

`SHOPPES2.OVL`, `TOWN.OVL`, `CMDS.OVL`, `ULTIMA.EXE`.
