# ACTA #91 — Parcelas de reactivo silvestre (pieza 9b del lote de mecánica #54)

Carril `reactivos-91`, rama `fix/reactivos-91` (retenida; aterriza el lead).
Fecha: 2026-07-28. CERO e2e (mutex ocupado): implementación + unit tests.

La derivación heredada venía de lote54b (commit 540d57dd, nota
`lote-mecanica-pendiente.md` §9b). **No la re-derivé: la cité.** Pero declaraba DOS
puntos sin derivar, y los dos sostienen la pieza — el llamador (sin él no hay dónde
enganchar) y las cadenas del mensaje (sin ellas no hay qué emitir). Se cerraron contra
el binario ANTES de escribir código, y al hacerlo apareció **una lectura heredada
equivocada justo en el punto de carga**, que es el patrón que el lote ya había visto dos
veces.

---

## 1. Lo que la derivación heredada tenía BIEN (y se conserva)

Las tres tablas paralelas, el gate de medianoche, el sello por día, la tirada 2..15, el
tope 99 y el bucle de tres. Todo verificado byte a byte contra DATA.OVL y contra el
cuerpo de la rutina en SJOG.OVL. El control positivo también se sostiene: los reactivos
que salen son mandrake y nightshade, los dos que ninguna tienda vende.

| parcela | X | Y | slot | nombre |
|---|---|---|---|---|
| 0 | 182 | 54 | 7 = MandrakeRoot | «mandrake root!» |
| 1 | 97 | 165 | 7 = MandrakeRoot | «mandrake root!» |
| 2 | 44 | 137 | 6 = NightShade | «nightshade!» |

## 2. ★ Lo que estaba MAL, y es el punto que sostiene la pieza

La nota heredada (y la tarjeta que la copia) dicen: «singular/plural por cmp di,0xa».
**No es un selector de singular/plural.** La comparación en 0x04ba elige el segundo
argumento (1 ó 2) del impresor de enteros al que se llama en 0x04d1. Ese impresor —banda
3, así que su destino en crudo, 0x5abe, resuelve a 0x1A3E del residente— recibe
`(valor, ancho, relleno)` con relleno 0x20 = espacio, y cuenta los dígitos del valor
contra la tabla de potencias de diez que vive en 0x5404 y contiene {10, 100, 1000,
10000}. El ancho pedido es exactamente el número de dígitos ⇒ **el relleno es siempre
cero** ⇒ el número sale desnudo en los dos casos.

Consecuencia práctica: **no hay dos formas del mensaje**. Si hubiera escrito la pieza
creyendo la lectura heredada habría fabricado una segunda cadena («sprig of») que no
existe en DATA.OVL. Y encaja sola: la cantidad es 2..15, así que el plural de la única
cadena que hay siempre es correcto.

Verificación independiente de la tabla de potencias: se lee del fichero, no del disasm.

## 3. Los dos «SIN DERIVAR» de §9b, cerrados

**(a) El llamador.** Es 0x0b91, dentro de una cadena de buscadores del (S)earch que es
de PRIMERO-QUE-ACIERTE:

```
0b81  call 0x3a8   moonstone     → or ax,ax / jne fin
0b91  call 0x45a   ESTA          → or ax,ax / jne fin
0ba1  call 0x514   tabla fija de 113 entradas (árbol de Minoc; imprime «nothing of note.» en 0x636)
```

Los argumentos se calculan en 0x0988-0x099d como party + delta, es decir la casilla
APUNTADA — la misma que ya usa la rama de moonstone del port. Cosechar CORTA la cadena:
no se llega a la tabla fija ni a su «nothing of note.».

Confirmación de que 0x514 es la tabla fija que el port ya modela: su cuerpo contiene el
gate diario del árbol de calaveras en 0x574-0x580 y la escritura del sello en
0x5b1-0x5b4, que es exactamente lo que `search.ts` ya cita.

**(b) Las cadenas.** Había una **CUARTA tabla paralela** que la nota daba por no leída:
un cursor a 0x3e72 que avanza de dos en dos por parcela (se inicializa en 0x0464, se
suma en 0x04f6, se desreferencia en 0x04db). Son punteros a los nombres, **por PARCELA y
no por reactivo** — por eso «mandrake root!» aparece DOS veces en el fichero, una por
cada parcela de mandrake. El mensaje completo son cuatro impresiones seguidas:

```
número (desnudo) · « sprigs of\n» · nombre de la parcela · «\n»
```

que con la prosa de mueble delante da, en pantalla:

```
Thou dost find
5 sprigs of
mandrake root!
```

## 4. Hallazgo lateral: no hay gate de localización ni de planta

La tabla fija compara localización y planta contra sus propias tablas. La rutina de
parcela **no compara ninguna de las dos**: sólo las dos coordenadas. Las parcelas se
gatean solas porque 182/97/44 y 54/165/137 caen fuera del 32×32 de cualquier mapa
pequeño. Se implementó así, sin añadir un gate que el binario no tiene.

## 5. Qué se escribió

- `game/src/core/world/reagent-patches.ts` (NUEVO): las cuatro tablas y la rutina.
- `game/src/core/game.ts`: el eslabón entre moonstone y tabla fija, y la emisión.
- `game/src/core/state.ts`: `reagentPatchFoundDay?: number[]` (los tres sellos).
- `game/src/core/world/survival.ts`: el borrado de fin de mes de los tres sellos, que
  9a había dejado declarado y sin cablear en ese mismo bloque.
- `game/src/core/saveNative.ts`: par put/copy del sidecar.
- `game/src/debug/saveEditorSections.ts`: clasificación del campo nuevo (ver §7).
- `game/tests/reagent-patches.test.ts` (NUEVO): 17 tests, cita en el mensaje de cada
  aserción. `game/tests/save-native.test.ts`: el campo entra en el round-trip poblado.

## 6. ★ RNG — radio DECLARADO y MEDIDO

La pieza mete **una tirada nueva** en el stream vivo, 2..15, y es lo único de toda la
tanda con radio real sobre el RNG. Medido, no estimado:

- **Unidad**: la rutina llama al dado **exactamente una vez y con (2,15)** cuando
  cosecha, y **cero veces** en los tres caminos de fallo (coordenada que no casa, hora
  distinta de medianoche, sello del día ya puesto). Los tres gates van ANTES de la
  tirada en el binario, y así se conservan.
- **Integración**: el turno de (S)earch tiene tiradas propias, así que «el stream avanza
  un paso» sería falso y el test que lo afirmaba se retiró. Lo que se mide es el DELTA
  contra el turno gemelo que no cosecha, contando pasos del generador (cada llamada da
  un paso crudo y la transición es biyectiva sobre 16 bits): **+1 y sólo +1**.

El orden sello→tirada se conserva tal cual está en el binario, porque fija la posición
del dado en el stream.

## 7. Dos cosas que dejo DECLARADAS, no resueltas

**(a) El editor de save.** El campo nuevo es un vector de tres sellos. Lo metí primero en
la lista de CUBIERTOS y la guarda se puso verde — pero el editor sólo tiene widget de
número escalar, así que eso habría sido **afirmar una cobertura que no existe**. Está en
la lista de EXCLUIDOS con su razón, y **queda pendiente de que el lead lo ratifique**. Si
se quiere editable es un widget nuevo, no una línea en una lista.

**(b) ★ Punto ciego de la guarda anti-fabricación, medido.** El extractor de
`string-manifest.test.ts` resuelve concatenaciones y consts, pero **no tiene caso para
una llamada**: cualquier literal envuelto en `t("…")` le es INVISIBLE. Medido sobre
`game/src/core`:

| | |
|---|---|
| literales distintos dentro de `t("…")` en el core | 8 |
| invisibles al extractor | 7 |
| **invisibles Y sin entrada en el manifiesto** | **7** (6 preexistentes + la mía) |

Los seis preexistentes son de otros carriles: «Trolls evaded!\n», « sneaks across»,
«\nThou spieth trolls under the bridge!\n\n», «a hidden door!\n», «\nThou dost find\n» y
«Report now, thy Quest compleat in\n».

Y las dos guardas son **mutuamente excluyentes** para estas cadenas: declarar la mía a
mano en el manifiesto la deja huérfana para el test de espejo exacto, que se pone rojo
(lo probé y lo revertí). Por eso **no** la declaré: la procedencia queda en la cabecera
del módulo, en esta acta y en el fichero de huérfanos. **No lo arreglo aquí** — tocar el
extractor destaparía las seis ajenas de golpe y adjudicar sus citas no es de este carril
(una cita equivocada es peor que ninguna). Propongo ticket propio.

## 8. Huérfanos que esta pieza CIERRA (coordinado con #116 / plaga-86)

Tres entradas de `re/ledger/orphan-strings.json` dejan de ser huérfanas porque ahora hay
un emisor de producción:

| clave | veredicto que tenía | qué aporta esta pieza |
|---|---|---|
| `" sprigs of\n"` | hueco-del-port | el hueco se CIERRA: emisor en el (S)earch |
| `"mandrake root!"` | familia-de-datos | se confirma el mecanismo y **se nombra la tabla**: punteros por parcela, con las dos copias explicadas |
| `"nightshade!"` | familia-de-datos | ídem |

Las dos adjudicaciones de «familia-de-datos» eran **correctas** en el mecanismo («se
consume por indexación de tabla, nunca por puntero inmediato») y ahora tienen la tabla
concreta y su consumidor.

## 9. Gates

| gate | resultado |
|---|---|
| `npx vitest run` (suite entera de game/) | **EXIT 0** — 282 ficheros, 3618 pasan, 1 skip |
| `npx tsc --noEmit` | **EXIT 0** |
| `pytest re/tools/test_frontier.py test_seed_gate.py -q` | ver §10 |
| `seed_diff` de esta acta | ver §10 |

## 10. Predicciones falsables

1. Si alguien «arregla» el extractor de strings para que entre en las llamadas, la guarda
   se pondrá roja con **siete** cadenas, no con una.
2. Si se implementa el gate de localización que el binario no tiene, el test de las tres
   parcelas seguirá verde: ningún test de este carril lo distingue. El testigo que lo
   distinguiría es buscar la casilla 182,54 en el Underworld.
3. La cantidad cosechada nunca será 1, así que ninguna corrida encontrará jamás una
   necesidad de la cadena singular que la lectura heredada suponía.
