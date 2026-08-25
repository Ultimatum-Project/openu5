# El defecto no era de una fila: era DE LA TABLA — el 4, el 5 y el 7 tampoco huyen

Carril `re/npc6` · 2026-08-06 · #78, continuación directa de `npc-aitype6-persigue.md` (#52).

Convención de redacción, igual que el acta hermana: los nombres de rutina y de global van en
tabla o en backticks aislados y nunca pegados a un desplazamiento; los desplazamientos van en la
forma `FICHERO.OVL:0x…`, que el sembrador de identidades no puede leer como propuesta de nombre.

**Veredicto en una línea:** en `NPC.OVL:0x06e4` la rama de huida está reservada al aiType 3 por
un único `cmp`, así que **los cuatro tipos restantes que entran ahí —4, 5, 6 y 7— se ACERCAN**.
La tabla de la nota `npc.md` los etiquetaba a todos como huida. El 6 se arregló en #52; el 5 y el
7 se arreglan aquí; el 4 se corrige **sólo en el texto**, y §7 explica por qué eso es lo correcto.

---

## 1. Grado de lectura

| tramo | estado |
|---|---|
| `NPC.OVL:0x06e4-0x0934` (persecución-o-huida) | **LEÍDO ENTERO**, ahora incluida la cola |
| `NPC.OVL:0x0892-0x08ee` — cola de erratismo del 5 y el 7 | **LEÍDO ENTERO** — es lo nuevo |
| `NPC.OVL:0x075a-0x07d8` — puntuación de las cuatro direcciones | **LEÍDO ENTERO** |
| `NPC.OVL:0x0d38-0x0d9a` — los cinco handlers de la tabla | **LEÍDOS ENTEROS** |
| `NPC.OVL:0x0632` — un paso en la dirección N | **LOCALIZADA, NO leída** — ver §8 |
| `NPC.OVL:0x06a0` — la métrica de distancia | **LOCALIZADA, NO leída** — ver §8 |

## 2. La geometría del barrido, que es de donde sale todo

El cuerpo hace **dos** recorridos sobre las **cuatro** direcciones, con el índice arrancando
en **1** las dos veces (`NPC.OVL:0x075a` y `NPC.OVL:0x07fc`, ambos `mov si,1`, ambos con corte
`cmp si,5`):

1. **Puntuar** (`NPC.OVL:0x075a-0x07d8`): por cada dirección da un paso tentativo, comprueba si
   se puede pisar, y guarda la distancia al party en un vector de cuatro words. Lo que no se
   puede pisar recibe **0x63** (`NPC.OVL:0x07c9`), un centinela más alto que cualquier distancia
   real, así que nunca puede ganar.
2. **Adoptar** (`NPC.OVL:0x0817-0x0890`): recorre otra vez y elige.

La referencia contra la que se compara se fija **antes** del segundo recorrido
(`NPC.OVL:0x07f6` → `NPC.OVL:0x07f9`) y es **la distancia ACTUAL del NPC al party**. Ese detalle
manda: dentro del bucle **no se actualiza nunca**.

## 3. El `cmp` que reparte, y hacia dónde manda a cada uno

```
0824: cmp  word ptr [bp-2], 3
0828: jne  0x884            ← TODO lo que no sea 3 se va abajo
082a: (rama del 3)  adopta si la puntuación es MAYOR   → ALEJARSE
0884: (rama del resto)
  088a: cmp  [bx], ax       ; ax = la distancia ACTUAL, congelada
  088c: jge  0x854          ; no mejora → siguiente dirección
  088e: mov  di, si         ; mejora → adoptar…
  0890: jmp  0x84b          ; …y SALIR del bucle
```

Dos consecuencias, y la segunda es la que casi me cuesta un falso defecto:

- **La rama de huida es exclusiva del 3.** Los aiType 4, 5, 6 y 7 caen todos en la de abajo.
- **Se adopta la PRIMERA mejora y se corta**, no el mínimo. Con vecindad de cuatro y distancia
  de Manhattan **toda mejora vale exactamente −1**, así que «primera mejora» y «mínimo» son el
  mismo conjunto y las dos implementaciones son indistinguibles. Lo dejo escrito porque el
  `chaseStep` que aterrizó en #52 busca el mínimo y **parece** divergente al leerlo. **No lo es**,
  y hay control ejecutable: §9, mutante M6.

## 4. La cola que sólo pisan el 5 y el 7 — y que es la que MUEVE EL STREAM

```
0892: cmp [bp-2],5 / je 0x89e
0898: cmp [bp-2],7 / jne 0x8f1     ← sólo estos dos entran
089e: push 0 ; push 0x3f
08a5: call  <generador>            ; rand_range(0, 0x3f)
08a8: cmp ax,0x10 / jge 0x8f1      ; sigue sólo si sale < 0x10  ⇒ 16/64 = 25 %
```

Si pasa, re-elige recorriendo otra vez las cuatro direcciones:

| paso | dirección | coste |
|---|---|---|
| `NPC.OVL:0x08bb` | la ya elegida | **se salta** |
| `NPC.OVL:0x08c0` | las que llevan el centinela | **se saltan** |
| `NPC.OVL:0x08cb` | **la primera viable** | **GRATIS** — se adopta sin tirar |
| `NPC.OVL:0x08d4` | cada siguiente viable | **una tirada**, adopta si sale `< 0x10` |

⇒ **una tirada siempre, y hasta dos más** cuando había dirección elegida (una de las cuatro
queda excluida) ⇒ **1..3**. Y **hasta tres más** en el caso sin candidato, porque entonces no se
excluye ninguna ⇒ **1..4**. La cola **puede mover al NPC aunque ninguna dirección mejorase**,
que es exactamente su papel: erratismo.

🔴 **Corrección a mi propio acta anterior:** su §10 publicaba «aiType 7 → 1..3». Es correcto
sólo cuando se adoptó dirección. El caso sin candidato llega a **4**, y no lo había contado.

## 5. Adyacencia: ni paso ni tirada

```
0720: mov [bp-4], ax     ; distancia party↔NPC
0723: cmp ax, 1
0726: jne 0x75a          ; ≠1 → camino normal
0728: cmp [bp-2], 3
072c: jle 0x75a          ; aiType ≤ 3 → camino normal
```
Con el party **a distancia 1** y aiType > 3 el flujo se va a la vía de ataque adyacente y
**sale antes de tocar el generador**. Para el 7 esa vía es `NPC.OVL:0x07be` y es incondicional.

El aviso de ataque en sí es un byte de estado que la maquinaria de hostilidad del clon ya
modela por otro lado y **no se porta aquí**. Lo que **sí** es obligatorio replicar es el
**consumo cero**: si el clon tirase ahí, el stream se desalinearía en cada acercamiento.

## 6. ⚠️ La ÚNICA diferencia medida entre el 5 y el 7, y por qué no la modelo

En la bifurcación de §5, el 5 va por `NPC.OVL:0x073d`, que trae un gate extra: sale por la vía de
ataque **sólo si** un campo del registro vivo (desplazamiento `+0x0a`) es distinto de cero; si es
cero, continúa por el camino normal **y paga la cola de §4**. El 7 no tiene ese gate.

**No he derivado qué significa ese campo**, así que modelo el 5 igual que el 7 y lo declaro. Es
inobservable: el 5 tiene **cero ocurrencias** en el fichero de NPC de fábrica (§10 del acta
anterior), así que ninguna partida normal ni ningún sello puede distinguir las dos versiones.

## 7. Por qué el aiType 4 se corrige en el TEXTO y no en el clon

La distancia que se compara en CS `NPC.OVL:0x0d40` es la del party **al PUESTO** del NPC, no a su
posición; si es menor que 4, cae en CS `NPC.OVL:0x0d91` → CS `NPC.OVL:0x06e4`. Con aiType 4 eso es la rama `0x0884`:
**acercarse**. El clon llama ahí a la huida. Es la misma etiqueta invertida, tercera fila.

**Y aun así no lo arreglo en esta tanda, por una razón que es una medida, no una preferencia:**

| | aiType 5+7 | aiType 4 |
|---|---|---|
| NPC que lo llevan | 12 (36 ranuras) | **33 (42 ranuras)** |
| localizaciones | 3 | **14** |
| ¿en las cinco escenas de sellos? | sólo `loc 17`, y en planta −1 | **en TODAS** |

Meter el 4 en la misma ventana haría que **cualquier** movimiento de sello dejase de poder
atribuirse a nada. La ventana es un instrumento de un solo uso por tanda: se gasta en un cambio
acotado o no mide. Ficha aparte.

## 8. Convenciones HEREDADAS que este arreglo no deriva

Se listan para que nadie las lea como medidas en esta tanda. Las tres vienen de antes y las
comparte el resto del módulo:

- **El orden de las cuatro direcciones.** El binario las numera 1..4 vía `NPC.OVL:0x0632`; el
  clon usa su propio vector. Si los dos órdenes no coinciden, **los empates se rompen distinto**
  — y con vecindad de cuatro los empates existen (party en diagonal ⇒ dos direcciones mejoran).
- **La métrica.** Que CS `NPC.OVL:0x06a0`, y no otra cosa, sea Manhattan.
- **Que el predicado de pisable del binario coincida** con el par transitable+ocupada del clon.

## 9. El arreglo, el testigo y los seis mutantes

`game/tests/npc-aitype57-hostil.test.ts`, **7 casos**, con **generador de guion** (secuencia
fija) porque la mitad de los casos tienen por sujeto el CONSUMO, y un contador sobre el
generador real no distingue «no tiró» de «tiró y dio igual». Un guion vacío convierte cualquier
tirada inesperada en excepción, que es el aserto más barato de «aquí no se tira».

Seis mutantes, con la predicción escrita ANTES de correrlos:

| mutante | predicción | resultado |
|---|---|---|
| M1 — vuelve a llamar a la huida | muere | **MUERTO** (7 de 11 casos) |
| M2 — le pone gate de distancia | muere | **MUERTO** |
| M3 — quita la salida por adyacencia | muere | **MUERTO** |
| M4 — cobra la primera alternativa | muere | **MUERTO** |
| M5 — sólo tira si hubo candidato | muere | **MUERTO** |
| **M6 — mínimo en vez de primera mejora** | **SOBREVIVE** | **VIVO** |

**M6 es el que vale.** Su supervivencia no es un hueco del testigo: es la **comprobación
ejecutable** de la equivalencia que afirma §3. Si algún día muriera, significaría que alguien
cambió la vecindad o la métrica y que las dos formas dejaron de coincidir.

## 10. Lo que esta ficha NO hace

- **No arregla el aiType 4** (§7), ni las monedas que le faltan al 3 (`NPC.OVL:0x083d`,
  0..3 tiradas; lo llevan 2 NPC en todo el juego).
- **No modela el aviso de ataque adyacente** (§5), sólo su consumo cero.
- **No deriva** el campo `+0x0a` del registro vivo (§6), ni las tres convenciones de §8, ni el
  tramo del segundo recorrido con índice 5..7, que existe y **no he leído**.
- **No mide en vivo.** Todo es lectura del cuerpo, del fichero de NPC y del clon.
