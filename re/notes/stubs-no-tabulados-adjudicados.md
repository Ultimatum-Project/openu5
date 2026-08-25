# Los «3 stubs no tabulados» — ADJUDICADOS: la tabla ya está COMPLETA

Encargo (§4.2 de `citas-barrido-sistematico.md`): «los 3 stubs no tabulados (`0x7b9c`, `0x7e02`,
`0x7f70`) — completar la tabla».

**Veredicto: no hay nada que completar. `dispatch_table.stubs()` cubre la banda ENTERA, y las tres
direcciones no son entradas de stub.**

## 1. La tabla está completa

```
banda   = (STUB_TABLE_END 0x81c6 − STUB_TABLE_START 0x7a16) / STUB_SIZE 12 = 164
tabulados = len(dispatch_table.stubs())                                     = 164   ⇒ COMPLETA
```

## 2. Las tres direcciones NO caen en la rejilla de 12 bytes

| dirección | offset desde `0x7a16` | ÷12 | resto |
|---|---|---|---|
| `0x7b9c` | 390 | 32,500 | **6** |
| `0x7e02` | 1004 | 83,667 | **8** |
| `0x7f70` | 1370 | 114,167 | **2** |
| `0x7d8e` (la que SÍ está tabulada) | 888 | **74,000** | **0** |

Y el desensamblado **no tiene ninguna instrucción que empiece** en las tres primeras — porque caen
**dentro** de otra.

## 3. Qué contiene cada una (dato, no interpretación)

Formato de stub PLINK86 = `lcall` (5 B) + `dw` overlay (2 B) + `ljmp` (5 B):

| dirección citada | cae dentro del stub | a | qué es exactamente ese byte | overlay | destino del `ljmp` |
|---|---|---|---|---|---|
| `0x7b9c` | **#32 `0x7b96`** | +6 | byte ALTO del `dw` de overlay | **11 = `OUTSUBS.OVL`** | `0:0xa7f6` |
| `0x7e02` | **#83 `0x7dfa`** | +8 | dentro del operando del `ljmp` | **20 = `COMSUBS.OVL`** | `0:0xef76` |
| `0x7f70` | **#114 `0x7f6e`** | +2 | dentro del propio `lcall` | **12 = `SHOPPES.OVL`** | `0:0xa2b6` |

Las tres apuntan **a mitad de un dato o de una instrucción**. Ninguna es un punto de entrada.

## 4. Lo que NO hago, y por qué

**No propongo que las citas «querían decir» el stub que las contiene.** Sería exactamente lo que la
propia nota del barrido prohíbe en §1.2 para las 4 citas sospechosas: *«proponer el vecino sería
armonizar la cita con una suposición — justo lo prohibido»*. Que `0x7b9c` esté 6 bytes dentro de
`0x7b96` es **un hecho**; que la cita se refiriera a ese stub es **una hipótesis**, y no tengo el
contexto del mecanismo que cada cita describe.

⇒ Pasan de «**tabla incompleta**» (defecto de herramienta, que no existe) a «**3 citas que apuntan
a mitad de stub**» (defecto de cita, a adjudicar por quien conozca el mecanismo) — la misma clase
que las 4 de §1.2. Arriba queda la tabla con el stub contenedor y su destino resuelto, que es lo
que ese adjudicador necesitará.

## 5. Corolario para el barrido

`citas-barrido-sistematico.md` §4.3 dice que las «115 citas de notas no alineadas» están infladas
«por el mismo artefacto de §1.1 **y por los stubs**». Con esto, la parte de stubs de esa inflación
queda **acotada a 3 citas**, no a un hueco de cobertura de la tabla: `stubs()` no pierde ninguna
entrada. Si el clasificador de `scan` las contaba como «no resueltas» por no estar en la rejilla,
el número real baja sin tocar nada.

**Cambios de código: NINGUNO.** El encargo pedía completar una tabla que ya estaba completa.
