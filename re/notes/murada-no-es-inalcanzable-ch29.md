# «SKIP-pend-entrada-murada» NO significa inalcanzable: ch29 entra por ESCALERA y gana 4 de las 5

**Hallazgo del resello que no encaja con ninguna de las cuatro predicciones.** Salió al cruzar los
digests de `ch25`/`ch26` con el de `ch29` **de la misma corrida**.

## El cruce, celda por celda (coinciden EXACTAMENTE)

| sala | ch25/ch26 (walk-in) | ch29 (escalera) | ch29 dice |
|---|---|---|---|
| Shame r4 | `f5(5,2)` `approachDir:null` → `SKIP-pend-entrada-murada` | `f5(5,2)` `enterByLadder:"up"` | **DEADEND-STUCK** |
| Shame r5 | `f5(1,0)` null → SKIP-murada | `f5(1,0)` `up` | **VICTORY** |
| Shame r15 | `f6(7,6)` null → SKIP-murada | `f6(7,6)` `down` | **VICTORY** |
| Hythloth r6 | `f4(5,0)` null → SKIP-murada | `f4(5,0)` `up` | **VICTORY** |
| Hythloth r12 | `f7(1,1)` null → SKIP-murada | `f7(1,1)` `down` | **VICTORY** |

Digests del run: `[ch25-shame] …4:SKIP-pend-entrada-murada|5:SKIP-pend-entrada-murada|15:SKIP-pend-entrada-murada…`
· `[ch26-hythloth] …6:SKIP-pend-entrada-murada|12:SKIP-pend-entrada-murada…` ·
`[ch29-ruta-limpia] deceit-r2:VICTORY|shame-r4:DEADEND-STUCK|shame-r5:VICTORY|shame-r15:VICTORY|hythloth-r6:VICTORY|hythloth-r12:VICTORY`

## Qué está mal, y qué no

**No hay contradicción entre los runs.** `approachDir: null` en ch25/ch26 significa «sin
aproximación ortogonal limpia», y esas salas se entran **klimbando** — el mecanismo que
`conquerRoomAt` ya documenta: «algunas salas están rodeadas de muro y se ENTRAN klimbando una
escalera que ATERRIZA en su celda» (`enterByLadder`, 0x1e79).

**Lo que sí está mal es la PROSA de ch26**, y es del tipo que ya nos ha costado caro:

> `ch26-salas-hythloth.spec.ts:13` — «null = murada de fondo (r6,r12, **inalcanzables aun con
> conquista**)»

**Es falso tal como está escrito.** No son inalcanzables: son inalcanzables *a pie por
aproximación ortogonal*. `ch29`, en **la misma corrida**, las entra por escalera y **gana las dos**.

## Consecuencia para el censo

La categoría `SKIP-pend-entrada-murada` se está leyendo como «pendiente / inalcanzable», y **4 de
esas 5 salas ya están conquistadas** por otro capítulo del mismo run. El bit de sala-despejada es
por `(loc, roomNo)` ⇒ ganarlas por escalera las retira igual. La cola 2b las cuenta como deuda
cuando no lo son.

**Y la 5ª es un hallazgo, no un pendiente**: `shame-r4` → **DEADEND-STUCK** = party viva, combate
irresoluble, huida imposible (bolsillo sin borde alcanzable). Es la clase que el arnés marca
explícitamente como **hallazgo de fidelidad a investigar** (¿softlock real del original?), no como
sala pendiente de entrada.

## Método

Es otra vez el patrón que el lead declaró paso previo obligatorio tras `ch91`/`ch16b`: **dos
capítulos hablando del MISMO objeto sin cruzarse**. Aquí el cruce es aún más barato porque los dos
digests salen en el mismo log, con las mismas celdas literales. Añado el corolario:

> Una etiqueta de SKIP no es un veredicto. `SKIP-pend-entrada-*` sólo dice **«este capítulo no la
> atacó por esta vía»** — antes de contarla como deuda, buscar si otro capítulo la ataca por otra.

Pendiente de decisión del lead: corregir la prosa de `ch26:13` y decidir si las 4 ganadas salen de
la cola 2b. No toco ninguno de los dos ficheros sin su visto bueno.

---

## ADENDA — `shame-r4` (combatmap 84) re-barrida: el STUCK es del MAPA, no de la sala

Re-barrido por movilidad + triggers (petición del lead: «que no se repita #103 aquí»):

```
12 enemigos: 12x Bat (i=21) — DoNotMove=False, ActivelyAttacks=True
TRIGGERS: 0
BFS a pie desde 'south' (6 spawns, los 6 pisables): 48 celdas
  enemigos alcanzables a MELÉ: 12/12
  enemigos con LÍNEA DE TIRO (0x6a14): 12/12
```

**La sala NO está sellada: los 12 murciélagos son alcanzables a melé y a tiro.** No hay mecanismo
oculto (0 triggers), así que aquí no se repite lo de #103.

**Y el STUCK tiene causa estructural, medida:**

| sala | celdas de BORDE pisables |
|---|---|
| **shame-r4 (84)** | **0 / 40** |
| #29 deceit-r13 | 15 / 40 |
| #103 hythloth-r7 | 12 / 40 |

El perímetro entero del 11×11 es `0xff`/`0x4d`. `fleeCombat` huye caminando hasta `x∈{0,10}` o
`y∈{0,10}` ⇒ **en esta sala la huida es imposible POR CONSTRUCCIÓN del `.CBT`**, para cualquiera.
Cualquier no-victoria aquí cae a `DEADEND-STUCK` automáticamente.

**Respuesta a la pregunta 1 del lead (¿softlock del original?): NO.** El «bolsillo sin borde» es
propiedad del dato — también en el original — pero **no produce softlock porque la salida fiel no
es el borde: es vaciar el tablero** (Banco 1, `CMDS.OVL 0x17ec`: el ESC en sala NUNCA retira), y el
tablero **es vaciable**: 12/12 alcanzables. El jugador original pelea, gana y sale por donde entró.

⇒ **Lo que hay que explicar NO es el STUCK (estructural y fiel) sino el DEADEND**: por qué el
resolvedor no gana una pelea de 12 murciélagos con los 12 al alcance. Eso es arnés/resolvedor, y
**`shame-r4` deja de ser candidato a hallazgo de fidelidad**.
