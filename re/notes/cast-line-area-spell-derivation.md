# Derivación del aplicador de hechizos de LÍNEA/ÁREA (CAST.OVL 0x1c36) — carril los-audit

> **⚠ PARCIALMENTE SUPERADA 2026-07-22** (`fx-lineaoe-negate-derivation.md` §3,
> carril fiel/line-spell-mech): la cadena de llamadas, la tabla 0x6a14 (polaridad
> incluida) y el stop-semantic siguen FIRMES; pero el «peso radial = PROBABILIDAD»
> (§Semánticas-2) está FALSIFICADO — la curva es el acumulador de PENDIENTE de los
> 21 rayos del abanico y el cmp de 0x20cb es el contest de veneno del modo 2
> (0xbf46 = INT del objetivo). La cobertura real es el ABANICO completo (celdas
> registradas por 0x1c36); mecánica cableada en `spraySpellCells`+`castLineAoe`.

Follow-up del paso B de `los-passability-audit.md`. Deriva la cadena estática del sistema
de hechizos de área/línea del binario (la que el port `combat.ts::castLineAoe` NO modela
fielmente). Citas sobre `re/disasm/CAST.OVL.asm` + `ULTIMA.EXE.asm`. **Estado: cadena
firme; 2 semánticas pendientes (marcadas ⏳) a sellar con el witness del oráculo.**

## Cadena de llamadas (verificada en frío por el relevo, rebase 0xbf80)

```
dispatch de efecto de hechizo (CAST.OVL 0xf3f-0x11a6)
  └─ caso 0x104e: 1040 mov al,[g_cmb_actor] ; 104e call 0x1f60   (origen = actor de combate)
       └─ 0x1f60 (aplicador, locals 0x11a): 1fd2 call 0x1c36
            └─ 0x1c36 = APLICADOR DE ÁREA/LÍNEA — hace DOS cosas:
                 A) PESO RADIAL: 1cb2 mov si,0x1cf0 ; copia la curva a 0xa9d0 (1caf mov di,0xa9d0)
                 B) TRAZADO DE LÍNEA con opacity-stop: bucle 1df8 call 0x1bb0 (validador LOS)
                      └─ 1c28 call 0x7fee → kernel 0x3f6e (3f9d mov cl,[bx+0x6a14])
                      └─ 1dfb or ax,ax ; je 0x1e68  → si LOS bloqueada, CORTA la línea
```
`0x1bb0` y `0x1c36` tienen UN caller cada uno (0x1df8 / 0x1fd2) — es el único sitio.

## Datos FIRMES

- **Tabla de opacidad-LOS `0x6a14`** (kernel 0x3f6e): bitmap 32B.
  **⚠ CORRECCIÓN DE POLARIDAD (2026-07-19, carril cast-line-aoe 90bdfc01 — SUPERA la
  lectura «210 opacos» de versiones previas de esta nota):** el kernel 0x3f6e
  (ULTIMA.EXE.asm 3f7f-3fb1: `ax = mask & bm[tile>>3]; cmp cx,1; sbb ax,ax; inc ax`)
  devuelve 1 si el bit está SET, y el consumidor CAST.OVL 1dfb (`or ax,ax; je 0x1e68`)
  REGISTRA la celda cuando ax!=0 ⇒ **bit SET = TRANSPARENTE (210 tiles, hierba 0x05
  incluida); bit CLEAR = OPACO (46 tiles: montañas 0x0c/0x0d, muros)**. Bytes VERBATIM
  intactos en `los-passability-audit.md` + fixture; solo el SENTIDO estaba invertido.
  Derivación autoritativa en los comentarios de `areaSpellTables.ts`. DISTINTA de
  pasabilidad (0x54d4) y de opacidad-luz del fog (0x6a86). ⇒ el §6 de combat-spells.md
  era IMPRECISO (confundía fog-flood 0x6a86 con línea-hechizo 0x6a14).
- **Curva radial** — 21 words extraídos VERBATIM del binario (DATA.OVL fileoff 0x1d00 =
  DS 0x1cf0 + 0x10):
  `[10, 12, 14, 16, 20, 25, 35, 50, 80, 190, 2000, 190, 80, 50, 35, 25, 20, 16, 14, 12, 10]`
  Simétrica, pico **2000** en el centro (idx 10), cae a 10 en los bordes.
- **Setup de geometría** (0x1d49-0x1daf): construye arrays paralelos indexados por `si` —
  puntero a la curva (`1d59 add ax,0x1cf0`), puntero al peso copiado (`1d64 add ax,0xa9d0`),
  coords de celda (`lea [bp+si-0x8a/-0x58/-0x2e]`).

## Contraste con el port

`combat.ts::castLineAoe` (línea 1610): camina `len` celdas en la dirección (sign dx/dy),
golpea ocupantes (máx 1/celda), SIN: (a) cortar por tile opaco 0x6a14, (b) aplicar la
curva radial. ⇒ **F-0 doble** (bajo reading-2, veredicto de trabajo del lead).

## HALLAZGO DE ALCANCE (2026-07-18): fieldWall es NO-OP en el port

El target confirmado (In Flam Grav #14 → 0x1c36) NO está modelado en el port: `combat.ts:1515`
case "fieldWall" es no-op explícito (campos no modelados en la arena, aprox. consciente) y NO
hay handler de overworld que siembre el `overworldTile` (game.ts sin fieldWall). ⇒ La tabla
0x6a14 no tiene consumidor en el port; el «gap» NO es conflación de tablas (la auditoría A
confirmó que NO hay conflación) sino una FEATURE no modelada (hechizos de campo In *Grav).
Cablear = IMPLEMENTAR el hechizo de campo, no un fix de tabla. Adjudicación A/B pendiente del lead.

## Semánticas — RESUELTAS (citas + witness v2)

1. **Stop-semantic = conservador CITADO** (ya no asunción): `0x1df8` está DENTRO del marco de
   `0x1c36` (mismo `sub sp,0xbe`; el único `ret 6` intermedio es de la rutina anterior) → el
   trazado consulta 0x6a14 por celda y CORTA en el obstáculo como parte del handler de In Flam
   Grav. `1dfb je 0x1e68` excluye la celda que falla LOS ⇒ **la celda opaca NO recibe el efecto,
   la línea para antes** (`opaqueCellAffected=false`). Confirmación fina del usuario = ítem 4d.
2. **GEOMETRÍA = 3×3 pesado al norte** (witness v2, mapbuf 0xab02): In Flam Grav overworld
   apuntando UP sembró tiles de campo **0x3a-0x3f en patrón 3×3** (hierba 0x05 → campo). ⇒ NO es
   una línea simple: es un ÁREA 3×3 centrada en/hacia el objetivo, con los pesos de la curva
   radial mapeados a las 9 celdas. Valida contra el setup de `lea` (0x1d49-0x1daf, 3 arrays de
   coords). Dirección del gate de probabilidad = conservador `applyWhenRandBelowWeight=true`
   (pico-2000 centro), confirmación fina = ítem 4d.
2. **Aplicación del peso radial = PROBABILIDAD (CITADO)**, no escala de daño. Consumo en el
   bucle de 0x1f60: `20c1 call 0xbf46` (fetch peso de celda) → `20c4 mov [bp-0x11a],ax` →
   `20c8 call 0x7b3e` (RAND) → `20cb cmp ax,[bp-0x11a]` → `20cf jl 0x2132`. Gate
   `rand vs peso[dist]` por celda: el efecto se aplica según el peso radial (centro pico-2000
   ≈ seguro, bordes 10 ≈ raro). La rama de daño (`rand(0x1e=30)`+cap `0x270f=9999`,
   0x20dc-0x20fc) es el CÁLCULO del efecto, SEPARADA del gate. ⏳ Falta sólo la DIRECCIÓN
   exacta (jl=aplica vs jl=salta) — el control-flow se enreda en 0x20b4/0x2132; lo confirma
   el witness (patrón de impactos por celda).
3. **Set de hechizos** — CANDIDATOS (cruce con el port `cast.ts`; a CONFIRMAR con el witness
   o crackeando el jump-table `0x0f1a jmp cs:[bx-0x2f3a]`, NO afirmado):
   - **fieldWall** (muro/campo): spells **14** In Flam Grav (= el que castea el witness),
     **15** In Nox Grav, **16** In Zu Grav, **20** In Sanct Grav → `kind:"fieldWall"`.
   - **lineAoe** (línea): **28** In Zu, **40** In Nox Hur, **44** In Vas Grav Corp,
     **45** In Flam Hur → `kind:"lineAoe"` (combat.ts::castLineAoe, sin opacity-stop ni radial).
   - posibles: **earthquake** (radial de masa, encaja con el peso pico-centro) y los
     `combatAttack` sintéticos tipo bola (13 Vas Flam).
   El aplicador 0x1c36 hace LÍNEA (trace+opaco) + RADIAL (prob) en la MISMA función, así que
   el mapping exacto (qué spell usa qué mitad, o ambas) lo zanja el witness + el cruce del lead.
   El witness castea In Flam Grav (#14 fieldWall) ⇒ al menos fieldWall entra por 0x1c36.

## Plan de cableo (tras witness + 2 citas)
`castLineAoe` corta la línea en tile opaco (tabla 0x6a14 VERBATIM como constante, no
ALWAYS_OPAQUE que es 0x6a86) + modela la curva radial según (2). + tests dirigidos. +
rectificar la fila «apuntado overworld» de `los-passability-audit.md`. Gate: cadena
completa (hechizos de línea en combate del tour — ch14/14b candidatos). NO aterrizar hasta
witness + cadena verde.
