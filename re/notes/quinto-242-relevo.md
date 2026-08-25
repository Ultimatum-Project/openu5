# RELEVO #242 — arranque para el carril que cierre el quinto canal

> Rama `re/quinto-242`, base main `5c69bd43`. Complementa a `quinto-242-acta.md`: **el acta dice
> QUÉ se midió; esto dice CÓMO reproducirlo y QUÉ falta.** Nada aquí está sin medir.

---

## 1. Los positivos REALES, con su método

**Método, para que se reproduzca sin adivinar** — leyendo los 28 `.asm` **en Python** (jamás
`grep -r`: sobre symlinks salta en silencio), con este patrón sobre la línea ya normalizada:

```python
MOVREG = re.compile(r'^mov\s+(ax|bx|cx|dx|si|di|bp)\s*,\s*(0x[0-9a-f]{3,5})$')
```

Corpus: `re/disasm/*.asm` (28 ficheros, symlinkeados uno a uno). El inmediato se cruza contra
**todas las direcciones del ledger incluidos los bytes interiores** (`addr` … `addr+size-1`),
no sólo las bases — si no, una carga a mitad de búfer se pierde.

| dirección | cargas `mov reg, DIR` |
|---|---|
| `0xAB02` (`g_vis_buffer`, #68) | **5** |
| `0xAD14` (#219) | **9** |
| `0x595A` (`g_dng_map`) | **2** |
| `0x5C5A` (`g_world_objects`, el pin de #240) | **29** |

Los cuatro se buscaron **ANTES** de construir nada. Si alguno hubiera dado 0, ese cero había que
declararlo con método, no asumirlo.

## 2. El titular, con su reserva en la misma frase

**Las cifras de #68 y #219 no aguantan como censo completo: `0xAB02` tiene 5 y `0xAD14` tiene 9
accesos POR REGISTRO que ningún censo anterior veía** — y son **candidatos, no accesos
confirmados**. La reserva no es adorno: sin seguimiento de flujo, «carga la dirección en un
registro» no prueba «la desreferencia». Las cifras de #68/#219 quedan **NO DESMENTIDAS y tampoco
CONFIRMADAS**.

## 3. Población y partición DERIVADA DEL ISA

**Población bruta: 3.064** `mov reg, imm` (3-5 dígitos hex) en el corpus.

La partición no se elige: **sólo `BX`, `SI`, `DI` y `BP` direccionan memoria indirectamente** en
8086; `AX`, `CX` y `DX` no pueden. ⇒ **679 candidatos** (registro-puntero) contra **2.385** que
no pueden desreferenciar. Cruzando con el ledger: PTR∧ledger **193**, NO-PTR∧ledger **144**.

⚠ **El matiz honesto, que hay que arrastrar**: «puede desreferenciar directamente» y «se pasa o
se copia» son **dos preguntas distintas**, no bueno-contra-basura. Un `mov ax, DIR` seguido de
`push ax` **es** un puntero pasado como argumento — un acceso por dirección de pleno derecho— y
esta partición **no lo juzga**. Los 144 NO-PTR en ledger **no están descartados**: están fuera
del alcance de la aproximación.

## 4. Lo que queda por hacer

- [ ] **Pre-registrar los buckets** al estilo `globals_negdisp`, que PARTICIONEN (no que filtren),
      antes de publicar cualquier proporción.
- [ ] **Negativos por CLASE de basura**, uno por clase y nombrado: constante redonda · tamaño ·
      tile · contador. (Ya hay dos con dientes: `0x270f` = 9999, el tope de comida derivado en
      #238, con 14 cargas y **cero** en registro-puntero; y `0x0100`.)
- [ ] **Re-medir `0xAB02` y `0xAD14`** con los buckets puestos, y **leer los 14 sitios** para
      adjudicar si las cifras de #68/#219 cambian — con «no desmentidas ≠ confirmadas» hasta que
      la lectura lo diga.
- [ ] **Acta final**, con la regla que la tarjeta ya dejó confirmada: «canal X vacío» nunca es
      «censo completo», es «este defecto no aplica»; la lista de canales conocidos es ella misma
      una cota superior.

### Dos cabos más, medidos y sin abrir

- **60 candidatos PTR sin uso `[reg]` cercano** (ventana de 10, declarada): o la ventana se queda
  corta, o son punteros guardados para más tarde. Sin medir cuál.
- **144 NO-PTR en ledger**: la pregunta «¿se pasa como argumento?» no se ha abierto.

## 5. Overlays nombrados aquí (sección FINAL a propósito)

`ULTIMA.EXE`, `DNGLOOK.OVL`, `DUNGEON.OVL`.
