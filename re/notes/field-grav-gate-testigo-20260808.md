# In *Grav y el gate de ubicación — testigo vivo del 2026-08-08 (oráculo headless)

Testigo NUEVO. **No sustituye a `field-duration-witness.md` (2026-07-18): lo contradice, y
los dos quedan fechados y en pie.** Un testigo corregido borra la discrepancia; dos testigos
fechados la conservan para quien venga.

Motivo: la ficha #91 quedó bloqueada por una contradicción medida — la máscara por hechizo
`DS:0x1C90` y las dos ramas de `cast_field_wall` (CAST.OVL 0x004c) concuerdan entre sí y
**excluyen el sobremundo**, mientras el testigo del 18-07 afirma haber lanzado *In Flam Grav*
**en sobremundo** y visto campo. Este testigo resuelve cuál de los dos manda.

Instancia headless propia (`U5RE_ORACLE_SCRATCH=/private/tmp/<oracle-rundir>-paridad91`,
run-dir nuevo de `oracle.boot()`). No se tocó ningún DOSBox ajeno ni los saves de
`original/u5/play`. `game_ds` de las dos corridas: `1788`.

## Sonda A — la máscara `DS:0x1C90` leída de la RAM VIVA

Canal **independiente** del volcado estático de `magic.md §0` (y de su copia verbatim en
`game/src/core/magic/tables.ts:TIME_PERMITTED_BITS`).

**Los 48 bytes coinciden byte a byte** con el volcado estático — `difieren_en: []`.

| índice | hechizo | máscara | exterior 0x08 | pueblo 0x04 | mazmorra 0x02 | combate 0x01 |
|---|---|---|---|---|---|---|
| 14 | In Flam Grav | `0x03` | no | no | **sí** | **sí** |
| 15 | In Nox Grav | `0x03` | no | no | **sí** | **sí** |
| 16 | In Zu Grav | `0x03` | no | no | **sí** | **sí** |
| 20 | In Sanct Grav | `0x03` | no | no | **sí** | **sí** |

⇒ la transcripción de la tabla queda acreditada por **dos canales**: el volcado estático y
la RAM del binario corriendo.

## Sonda B — lanzar el hechizo de verdad, medido SIN pantalla

Discriminante de RAM, elegido porque el gate de ubicación (`0x0e8e` → `0x0e95`, «Not here!»)
sale por el **epílogo `0x11d9`**, o sea **antes** del decremento del hechizo mezclado
(`0x0ec8`) y **antes** del cobro de maná (`0x0ef8`):

| qty | MP | lectura |
|---|---|---|
| igual | igual | el gate de UBICACIÓN rechazó |
| −1 | igual | «M.P. too low!» (excluido: se siembra MP 30 / nivel 8) |
| −1 | −círculo | pasó el gate |

«None mixed!» (`0x0ebb`) tiene la misma firma que el rechazo por ubicación, así que se
excluye sembrando `g_spell_qty[14] = 5` **y releyéndolo** antes de teclear.

🔴 **Control positivo, en la misma sesión y la misma banda**: *In Lor* (índice 0, máscara
`0x0e`, permitido en exterior y en pueblo). Sin él, «no cambió nada» no distingue *«el gate
rechazó»* de *«mis teclas nunca llegaron»* — y ése es el modo de fallo que invalidaría la
medición entera.

### Resultado — DOS bandas de `g_location`, las dos con su control

| banda | `g_location` | In Flam Grav (qty, MP) | CONTROL In Lor (qty, MP) |
|---|---|---|---|
| pueblo, tal cual arranca la partida | 17 = `0x11` | **(0, 0)** | (−1, −1) |
| exterior, `g_location` sembrado | 0 | **(0, 0)** | (−1, −1) |

*In Lor* es de círculo 1 (`0/6+1`), de ahí el −1 de maná; el control consume en las **dos**
bandas ⇒ el instrumento está acreditado en las dos.

⚠️ **Declarado**: la banda de exterior se produjo **sembrando el byte `g_location`**, no
sacando al grupo del pueblo andando. Es legítimo porque el gate lee **exactamente ese byte**
(`0x0e1a cmp byte [g_location],0`) y ahí es donde existe la diferencia — pero se declara. Y
no queda sola: la banda de **pueblo no necesitó siembra ninguna** y da el mismo veredicto,
porque la máscara `0x03` tampoco lleva el bit de pueblo (`0x04`).

## Veredicto

**GANA LA MÁSCARA.** *In Flam Grav* **no pasa el gate de ubicación** ni en pueblo ni en
exterior: no consume hechizo mezclado, no consume maná, no llega a `cast_field_wall`.

⇒ La conclusión del testigo del 18-07 —que la rama de sobremundo del clon es deliberada—
**queda refutada**. Lo que ese testigo midió (escrituras en `DS:0xb19e`, celdas `0x3a-0x3f`
en el compositor `0xab02`) **necesita re-atribución**, y eso es trabajo aparte: su propio
volcado registra el buffer de terreno en **hierba**, y ninguna escritura en la rejilla
`0x595a+`. Lo que este testigo NO hace es decir qué vio aquél.

## Lo que esto desbloquea de #91

- EJE 1 (el bit `0x08` se preserva: `00c6 al=[bp-8]&8` / `00ce or al,[bx+0x4596]` / `00e6`)
  y EJE 2 (la rama no-combate es la rejilla 8×8 de mazmorra y escribe **UNA** celda) quedan
  firmes, y ya no hay testigo que los contradiga.
- El clon implementa una ruta de **sobremundo** que el binario no tiene y que su propio gate
  hace **inalcanzable** (`castSpell` devuelve «Not here!» antes), mientras los dos contextos
  que el binario sí permite están **sin cablear**: `doDungeonCast` no tiene brazo `fieldWall`
  y `combatWeapon` (DS:0x4592) no tiene **ningún** consumidor en `game/src`.

## Reproducir

Sondas en el scratchpad del carril (`probe91_mascara.py`, `probe91_cast.py`); no se
commitean porque llevan rutas absolutas de la sesión. El procedimiento es el de arriba:
`oracle.boot()` → `send_keys_until_main_menu()` → sembrar qty/MP/nivel/`g_active_char`
→ teclas `c,i,f,g,⏎` y `c,i,l,⏎` → leer `DS:0x57F0+idx` y `DS:0x55B7`.
