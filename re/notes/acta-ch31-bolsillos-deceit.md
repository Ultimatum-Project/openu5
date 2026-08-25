# ACTA — `ch31-deceit-bolsillos.spec.ts`, RETIRADO (ruling del lead, 2026-07-27)

Este fichero sustituye al spec. El spec se borró; su contenido está en el historial y este
acta guarda lo que hacía, lo que se aprendió con él y por qué dejó de tener trabajo.

## 0. Ruling y coordenadas exactas del fichero borrado

**RULING DEL LEAD (27-07): OPCIÓN C — retirar.** Razón, citada del ruling:

> el estándar de skip-aceptable es razón + CONDICIÓN DE SALIDA, y ch31 no puede tenerla —
> está superado por un sello (ch33) que dice que la ruta que esperaba NO EXISTE; su única
> cobertura exclusiva (el modelo continuo sobre Deceit) produce exactamente el artefacto
> que ch36 ya diagnosticó mejor.

Coordenadas para recuperarlo (`git show <ref>:game/e2e/grandtour/ch31-deceit-bolsillos.spec.ts`):

| dato | valor |
|---|---|
| ruta | `game/e2e/grandtour/ch31-deceit-bolsillos.spec.ts` |
| **blob SHA** (ancla robusta) | `9b15c95c0c38b9a06a4ed330695ad715c4b0ac1f` |
| sha256 del fichero | `bc554e5c96374b2eef9cd49dd9b045d9cad22b2bdee2d5d5d7730af39c35c7c8` |
| tamaño | 140 líneas |
| commit que lo CREÓ | `6e65b8cc` |
| commit que puso el skip | `93efe427` |
| commit que anotó el `[HISTÓRICO]` | `da10ef32` |
| **último commit que lo TOCÓ** | **`bb293864`** (07-26, cabeceras de clase) |

⚠ CORRECCIÓN DE PASO al ruling: el ruling cita `da10ef32` como «último estado». No lo es —
`bb293864` lo tocó después (le puso la cabecera DETECTOR-DE-REGRESIÓN). El estado borrado es
el de `bb293864`; `da10ef32` es el commit del bloque `[HISTÓRICO]`, que es lo que el ruling
tenía en mente. El blob SHA de arriba desambigua sin depender de ninguna de las dos.

## 1. Qué asertaba (literal)

`test.describe.skip("FASE 2b — ch31 bolsillos de Deceit r9/r11 (continuo, veredicto ABIERTO)")`
con **dos** tests:

| test | aserto | qué significa |
|---|---|---|
| «r9 y r11 se abren al conquistar el bolsillo de cima y RESUELVEN limpio» | `for (const n of [9,11]) expect(["VICTORY","DEADEND","DEADEND-STUCK"]).toContain(outcomes[n])` | los DOS objetivos resuelven sin FAIL/THROW. **No fijaba el veredicto**: VICTORY y DEADEND eran ambos verdes |
| «determinismo ×2» | `expect(b.digest).toBe(a.digest)` | el digest de las 10 salas byte-idéntico bajo `reseed(0)` |

Motor: el **modelo CONTINUO**. `runDeceitBolsillos` entraba a Deceit una vez y recorría 10
salas en un **bucle hasta punto fijo** (`while (progress)`), reintentando las que lanzaban. Las
8 primeras eran el bolsillo de cima; las 2 últimas (r9 f6(7,5), r11 f7(7,4)) los OBJETIVOS.

Tabla `ROOMS` del fichero borrado, por si alguien re-abre el modelo continuo sobre Deceit:

```
r4  f5 (1,1) east   ·  r5  f5 (1,5) north  ·  r6  f5 (7,3) south  ·  r7 f5 (7,7) west
r8  f6 (4,3) south  ·  r10 f7 (1,3) north  ·  r12 f7 (0,4) west   ·  r14 f7 (0,5) west
OBJETIVOS: r9 f6 (7,5) east  ·  r11 f7 (7,4) south
```

Loadout: nivel 8, 240 HP, arco mágico `0x24` + anillo invisibilidad `0x2a`, 99 flechas,
`lightSpellMins` 9999, Des Por (`spellQuantities[22]`) 99, reactivos al máximo.

## 2. Por qué se skipeó (cronología, hashes verificados uno a uno)

- `6e65b8cc` — nace el spec, «veredicto ABIERTO» por diseño (no se pre-asertaba resultado).
- **VENTANA 2026-07-21** — corrido: el bolsillo de cima resuelve limpio (5 VICTORY r4,7,10,12,14
  + 3 DEADEND-fiel r5,6,8) pero **r9 y r11 AMBOS THROW**: `"dungeonDescendTo: sin plan desde
  (7,0,5)"`. Es decir: **el aserto del spec falla**.
- `93efe427` — «ch30/ch31 landing-ready: `test.skip` ANOTADO (PENDIENTE-ARNÉS)». El skip se pone
  para no aterrizar un rojo, con la lectura de entonces: *«su entrada real es FONDO/foso dedicado,
  a derivar en estático en lote-2»* y *«se REACTIVA en lote-2 con rutas FONDO/ascenso derivadas»*.
- **LOTE-2 resolvió los dos objetivos, por OTRA vía y con otro resultado**:
  - **r9 = SIN-ENTRADA-fiel** — `ch33-deceit-r9-seal.spec.ts`, sello geométrico ×2 (cima Y fondo),
    clase VEREDICTO-DE-FIDELIDAD. `8bf5c619` / `eafb0422`; derivación `48d4220d` («ni FONDO ni
    ascenso lo abren»). ⇒ **la reactivación prometida era imposible: no hay ruta que derivar.**
  - **r11 = VICTORY ×2** — `ch36-deceit-r11-arriba.spec.ts` (`1d82f203`), por la ENTRADA-POR-ARRIBA
    f7(7,3), FRESCA desde la cima.
- `da10ef32` (barrido-stale) — se anota el `[HISTÓRICO 2026-07-25: superado …]`, que terminaba con
  «El skip permanece sin ruling del lead» — la frase que disparó el finding de la auditoría.
- `bb293864` — le pone la cabecera de clase (DETECTOR-DE-REGRESIÓN). Último estado.

## 3. El estado contradictorio que lo destapó

El comentario decía **superado, no se reactiva**; el título del describe, dos líneas abajo, seguía
diciendo **«veredicto ABIERTO»**. Mismo bloque, dos estados. (Auditoría de cierre 2026-07-27,
`re/notes/auditoria-general-cierre-20260727.md` §sellos-verdes-en-falso, finding [MEDIA].)

## 4. Cobertura única en el momento del borrado: **CERO SALAS**

Comprobado fichero contra fichero, no de memoria:

- Las **8 salas del bolsillo de cima** están en `ch20-salas-deceit.spec.ts:39-49` con **celda y
  `approachDir` IDÉNTICOS**. El propio ch31 lo decía: «DEDUP: re-confirmación de la pasada-1 ch20,
  NO salas nuevas».
- **r9** → cubierta y SELLADA por `ch33`. **r11** → cubierta por `ch36`.

Lo único exclusivo era el **modelo continuo con fixpoint sobre Deceit** — y lo que ese modelo
producía sobre r9/r11 es precisamente el artefacto que `ch36` diagnosticó mejor (ver §5).

## 5. El hallazgo que sí deja, y dónde vive mejor

**El THROW de ch31 NO era falta de ruta: era el ORDEN del fixpoint.** ch31 atacaba r11 la última,
con la party ya VARADA en el bolsillo f7{(1,4),(1,5)} tras conquistar r12/r14 — r10(1,3),
r12(0,4) y r14(0,5) lo emparedan y el único escape es a través de r13/r11 sin conquistar. El
diagnóstico completo está en la **cabecera de `ch36-deceit-r11-arriba.spec.ts`**, mejor escrito
que en el spec retirado.

Hallazgo general asociado: **los bolsillos aislados NO se abren por top-continuo** — converge con
`ch30` (mismo patrón en Hythloth) y es el #13. Registrado en la memoria
`isolated-pockets-need-fondo-not-top-continuo` y en `docs/guias/doom/CENSO-COMBATMAPS.md`.

**Consecuencia dura, por si alguien piensa en resucitarlo**: reactivar el spec sale ROJO, y el
rojo sería CORRECTO — r9 no tiene ruta (ch33 lo selló) y r11 recae por el orden del fixpoint;
`THROW:…` no está en `["VICTORY","DEADEND","DEADEND-STUCK"]`. Tocar el aserto para ponerlo verde
sería re-baselinear un DETECTOR contra el port, prohibido por el RULING 07-26
(`specs-detector-vs-veredicto`).

## 6. Expediente

El análisis de las 4 opciones (reactivar / re-clasificar / retirar / re-propósito) con pros,
contras y textos alternativos está en `re/notes/maqueta-ruling-ch31.md`, que se conserva como
expediente de cómo se llegó a este ruling.
