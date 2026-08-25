# heredados-168 · TANDA 6 — 2 de combate, y un bit que cierra el círculo con la tanda 2

Carril `heredados-168` · 2026-07-28 · rama `re/frontera-verified-26`.
Contador `verified_inherited_without_cite`: **131 → 129**.

> Verificada con `re/tools/seed_diff.py`: 0 sembradas, 0 cambiadas.

---

## 1. Las 2

| # | rutina | nombre | veredicto |
|---|---|---|---|
| 1 | `COMBAT.OVL:0x1a5c` | `enemy_wound_classification` | ACREDITADA — ★★ es también quien DECIDE LA HUIDA |
| 2 | `COMBAT.OVL:0x111a` | `cbt_floor_triggers` | ACREDITADA — one-shot confirmado, y hasta DOS casillas por disparo |

---

## 2. ★★ El productor del bit de huida

En la tanda 2, al leer `combat_cell_blocked`, encontré una excepción sin documentar: salir
del tablero no cuenta como bloqueado **si el bit 2 del byte de banderas está puesto**. Lo
dejé escrito como «el afordance de huida», sin saber quién ponía ese bit.

**Lo pone esta rutina.** `enemy_wound_classification` no sólo clasifica la herida en cuatro
bandas: al final escribe ese bit —`or byte [bx+2],2`— o **lo limpia** —`and byte [bx+2],0xfd`—.
El circuito completo, montado entre dos tandas que leyeron cuerpos distintos sin buscarse:

```
enemy_wound_classification  →  bit 2 del registro  →  combat_cell_blocked  →  el enemigo huye
        (productor)                                       (consumidor)
```

**Cuándo se enciende:**
- **banda 1** (vida < máximo/4): siempre.
- **banda 2** (vida < máximo/2): por azar. La tirada es un uniforme en `[0,256]` ambos
  inclusive = 257 resultados, y huye con `252..256` ⇒ **5 de 257 = 1,95%**.
- y como la otra rama **limpia** el bit, un enemigo que se cure **deja de poder huir**.

**Coste en RNG:** sólo la banda 2 consume tirada. Las bandas 1, 3 y 4 no gastan ninguna.

### 2.1. ⚠ Salida anómala, con alcanzabilidad ABIERTA

Si el actor tiene el bit `0x80` (los del roster), la rutina salta al epílogo y en ese punto
`ax` vale `0xba14 + arg*8` — **devuelve el puntero al registro** donde el llamador espera una
banda de 1 a 4. No lo vendo como bug: depende de si algún llamador la invoca sobre un miembro
del roster, y este cuerpo no lo cierra. Mismo criterio que con el despacho sin caso por
defecto de la tanda 4.

### 2.2. La tabla de estadísticas de monstruo, acotada por aritmética

Los cuatro accesos vistos en el barrido usan cuatro constantes — `0x13bc`, `0x13be`, `0x13bf`
(tanda 4) y `0x13c1` (aquí) —, todas indexadas con `tipo<<3`. Para que los cuatro campos quepan
en un registro de 8 B **la base tiene que ser DS `0x13BA`**, y entonces son los campos `+2`,
`+4`, `+5` y `+7`. Lo doy como **cota derivada de la aritmética**, no como layout leído: el
registro entero no lo he recorrido.

---

## 3. `cbt_floor_triggers`: siete arrays paralelos

Ocho entradas, recorridas con un solo índice. Dos guardan la coordenada del disparador, una
el tile a escribir, y **dos pares** guardan destinos. Al casar, escribe `0xFF` en las dos
entradas del disparador — **one-shot**, el centinela que el acervo ya asociaba a los triggers
de sala `.CBT`, confirmado aquí por cuerpo en el manejador de COMBAT.

Tres cosas que no estaban escritas:

1. **Tope de OCHO** disparadores.
2. **Hasta DOS casillas** modificadas por disparo (dos pares de destino, cada uno con su
   propia comprobación de estar dentro del 11×11).
3. El **redibujado es condicional**: `viewport_redraw` sólo se llama si algo disparó.

La escritura va a DS `0xAD14` con paso 32 — la misma base y el mismo paso que la rama de
mazmorra de `get_tile_ptr`, que leí en la tanda 1 desde el otro lado.

---

## 4. Cola

Ocho globales más sin entrada en `globals.json`, todas de este subsistema: `0xAD14`, `0xAD1F`,
`0xAE1F`, `0xAE27`, `0xAE3F`, `0xAE47`, `0xAE5F`, `0xAE67`. Con las nueve de las tandas
anteriores van **diecisiete**.

`g_unk_58a1` sí tiene entrada pero sin derivar, y aquí gana una restricción: sus bits `0x80`
y `2` son la puerta de los disparadores de suelo.

**Quedan 129** filas. Del bucket FUERTE quedan 16.
