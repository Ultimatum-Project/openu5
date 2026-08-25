#!/usr/bin/env node
/**
 * #257 · CAREO PRE-VUELO DE LA FOTO DE NAVEGADOR — el rojo de minuto 8, a los 4 segundos.
 *
 * Uso:  node re/tools/careo_suite_navegador.mjs [RAIZ]
 * Exit: 0 si la foto casa con el censo declarado · 64 si no (o si la foto no sirve).
 *
 * ── EL DEFECTO QUE CIERRA ───────────────────────────────────────────────────────
 * Cualquier carril que añada un `.spec` e2e mueve el CENSO de `playwright --list` y deja
 * `re/ledger/suite-navegador.json` hablando de una población más pequeña. Eso YA está
 * vigilado —`resultadoNavegador()` lo carea y lanza—, pero lo hace DONDE nadie lo busca:
 * dentro del generador de `/estado`, que la batería sólo ejecuta en `test_estado_panel` y
 * `test_estado_jugar_pagina`, a unos 8 minutos de corrida. Lo que el carril ve entonces son
 * 73 síntomas (6 mutantes de test_estado_panel «por otra causa» + 67 ERRORs de fixture) que
 * NO nombran la causa, y la bisección cuesta media hora. Medido por viewgem-247 al comprarlo
 * — la flota añade specs a diario, así que la compra se repite.
 *
 * Lo que falta no es la comprobación: es su MOMENTO y su MENSAJE.
 *
 * ── 🔴 ESTE FICHERO NO REIMPLEMENTA EL PREDICADO. LO LLAMA. ─────────────────────
 * El careo lo hace `resultadoNavegador()` de `docs/publicacion/web/estado-datos.mjs`, que es
 * exactamente la función cuyo throw produce los 73 síntomas. De ahí salen dos propiedades que
 * un careo escrito a mano NO tendría:
 *
 *   · NO PUEDE DIVERGIR. Un segundo predicado que cuente lo mismo es el que un día dice
 *     «bien» mientras el otro dice «mal», y el que manda es el que nadie mira (misma lección
 *     que `estado-plan.py` en el censo de salas, y que `test_genesis_manifiesto`, que comparte
 *     predicado con el génesis a propósito).
 *   · NO PUEDE ENROJECER NADA QUE NO FUERA A ENROJECER IGUAL. El conjunto de árboles que este
 *     guarda rechaza es, por construcción, el mismo que hoy revienta en el minuto 8. Esta
 *     guarda no añade una condición nueva a la puerta: adelanta una que ya estaba y le pone
 *     nombre. Es lo que la separa de crecer la puerta (#123).
 *
 * La ARITMÉTICA que se imprime sale de la propia excepción (se leen sus dos cifras), no de un
 * recuento paralelo: así el delta no puede contradecir al veredicto que lo acompaña.
 *
 * ── POR QUÉ ACEPTA UNA `RAIZ` EN LA LÍNEA DE ÓRDENES ────────────────────────────
 * 🔴 Para poder SEMBRARLO sin tocar el ledger de verdad. Una guarda que nunca ha visto fallar
 * su propio predicado nace vacua, y aquí sembrar significa descabalar la foto — que es un
 * artefacto compartido y caro (re-sellarlo son ~21 min de ventana de máquina). Con este
 * argumento la siembra se monta en un árbol de mentira (un directorio con `game` enlazado y
 * una copia adulterada del json) y el ledger real no se toca. Sin él, sembrar exigiría editar
 * `re/ledger/suite-navegador.json` en el árbol vivo, que es justo lo que no se puede hacer.
 *
 * El defecto ANCLA a su propio árbol y no al `cwd` (#166): un careo que midiera la rama de
 * otro saldría precioso y no diría contra qué midió.
 */
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { pruebasNavegador, resultadoNavegador } from "../../docs/publicacion/web/estado-datos.mjs";

const AQUI = dirname(fileURLToPath(import.meta.url));
const RAIZ = resolve(process.argv[2] ?? resolve(AQUI, "../.."));

let censo;
try {
  // El censo se toma UNA vez y se le pasa al careo, igual que hace `estadoDatos()`: dos
  // lecturas del árbol pueden discrepar si el árbol se mueve entre ellas.
  censo = pruebasNavegador(RAIZ);
} catch (e) {
  process.stderr.write(
    `CAREO SUITE: no se pudo ENUMERAR las suites de navegador (el censo, no la foto).\n` +
      `${e.message}\n`,
  );
  process.exit(64);
}

try {
  const r = resultadoNavegador(RAIZ, censo);
  process.stdout.write(
    `CAREO SUITE OK: la foto del ${r.fecha} (${r.sha}) cubre ${r.total} pruebas y esas mismas ` +
      `configuraciones declaran hoy ${r.declaradas}.\n`,
  );
  process.exit(0);
} catch (e) {
  // Las DOS cifras salen del mensaje de la propia excepción: son las que el veredicto usó.
  const m = /cubre (\d+) pruebas y esas mismas\s+configuraciones DECLARAN hoy (\d+)/.exec(e.message);
  process.stderr.write(`CAREO SUITE: la foto de re/ledger/suite-navegador.json NO SIRVE para este árbol.\n`);
  process.stderr.write(`${e.message}\n`);
  if (m) {
    const foto = Number(m[1]);
    const hoy = Number(m[2]);
    const d = hoy - foto;
    process.stderr.write(
      `\n  ARITMÉTICA: declaradas hoy ${hoy} · foto ${foto} · DELTA ${d > 0 ? "+" : ""}${d}.\n` +
        `  CAUSA casi segura: tu rama ${d > 0 ? "AÑADE" : "QUITA"} ${Math.abs(d)} prueba(s) de navegador\n` +
        (d > 0
          ? `  (un .spec nuevo, un test nuevo dentro de un .spec que ya estaba, o un proyecto\n` +
            `   nuevo en un playwright.*.config.ts — que multiplica TODA su suite).\n` +
            `  🔴 Y NO busques «${Math.abs(d)} tests nuevos» en ningún diff: en una config\n` +
            `  MULTI-PROYECTO cada declaración cuenta POR CADA proyecto cuyo testMatch no la\n` +
            `  excluye (medido el 14-08: 3 declaraciones × 4 proyectos = +12). La atribución\n` +
            `  en dos pasos: (1) cuenta DECLARACIONES nuevas entre la SHA de la foto y HEAD\n` +
            `  (git diff <sha-foto>..HEAD -- game/e2e + playwright --list por fichero);\n` +
            `  (2) multiplica cada una por sus proyectos no-excluidos.\n`
          : `  (un .spec o un test retirado, un fichero renombrado fuera del patrón que su\n` +
            `   config recoge, o un proyecto quitado de un playwright.*.config.ts —\n` +
            `   que RESTA su suite entera multiplicada por proyectos).\n`) +
        `  La foto es de otra población y hay que RE-SELLARLA:\n` +
        `      cd game && node tools/suite-navegador.mjs      # ~21 min, ventana de máquina\n` +
        `  y se re-sella SOBRE MAIN CON TU RAMA DENTRO, no sobre la rama suelta: la foto es del\n` +
        `  árbol publicado, y sus cifras (ok/rojos/saltados) viajan a /verificacion y a /estado.\n`,
    );
  }
  // ── #271: EL DESGLOSE, en vez de la RECETA para calcularlo a mano ──────────────────────
  // El mensaje de arriba explicaba cómo atribuir el delta (dos pasos, `git diff` + `--list`
  // por fichero) y dejaba el trabajo al lector. La foto YA guarda su total POR CONFIGURACIÓN
  // y el censo que acabamos de tomar también: careándolos se localiza el crecimiento en la
  // config que lo trae, que es el 90% de la atribución y sale gratis (cero procesos nuevos).
  // 🔴 LO QUE ESTO **NO** DA, dicho aquí para que nadie lo lea de más: el desglose por
  // FICHERO×proyectos que pide la ficha. `pruebasNavegador` sólo conserva el «Total: N tests
  // in M files» de cada config y tira las líneas por fichero de `--list`, así que el reparto
  // dentro de una config sigue siendo trabajo a mano — con la ventaja de que ya sabes EN CUÁL.
  try {
    const foto = JSON.parse(readFileSync(join(RAIZ, "re/ledger/suite-navegador.json"), "utf8"));
    const porCfg = new Map((foto.configs ?? []).map((c) => [c.cfg, c.total]));
    const filas = censo.configs
      .map((c) => ({ cfg: c.cfg, es: c.es, hoy: c.tests, foto: porCfg.get(c.cfg) }))
      .filter((f) => f.foto !== undefined);
    if (filas.length) {
      process.stderr.write(`\n  DESGLOSE POR CONFIGURACION (foto ${foto.sha} vs arbol de hoy):\n`);
      for (const f of filas) {
        const dd = f.hoy - f.foto;
        process.stderr.write(
          `    ${dd === 0 ? " " : "→"} ${f.es.padEnd(22)} foto ${String(f.foto).padStart(4)} · hoy ` +
            `${String(f.hoy).padStart(4)} · ${dd === 0 ? "igual" : `DELTA ${dd > 0 ? "+" : ""}${dd}`}` +
            `${dd === 0 ? "" : `   (${f.cfg})`}\n`,
        );
      }
      // 🔴 LAS QUE NO SALEN EN LA TABLA SE NOMBRAN. El censo enumera CUATRO configs y la
      // foto sólo compara TRES: `espejo` está excluida con razón escrita en la propia foto
      // (arnés de conformidad, no de regresión). Filtrarla es correcto —el careo compara
      // «esas mismas configuraciones»— pero DEJARLA CAER EN SILENCIO haría que quien cuente
      // las filas vea 3 donde sabe que hay 4 y dude de la tabla. Se dice que está fuera.
      const fuera = censo.configs.filter((c) => !porCfg.has(c.cfg));
      if (fuera.length)
        process.stderr.write(
          `      (fuera del careo por exclusion DECLARADA en la propia foto: ` +
            `${fuera.map((c) => `${c.es} — ${c.tests} declaradas hoy`).join("; ")})\n`,
        );
      const mueven = filas.filter((f) => f.hoy !== f.foto);
      process.stderr.write(
        mueven.length
          ? `  ⇒ la que se movio: ${mueven.map((f) => f.es).join(", ")}. Busca ahi, no en las demas.\n`
          : `  ⇒ NINGUNA config se movio por su cuenta: el delta no viene de crecer pruebas.\n` +
            `    Mira el conjunto de configs (¿una nueva? ¿una retirada?) antes que los .spec.\n`,
      );
    }
  } catch {
    // El desglose es un EXTRA: si la foto no se deja leer o no trae `configs`, el aborto
    // sigue diciendo lo que decía. Un adorno que rompa el mensaje sería peor que no tenerlo.
  }
  process.stderr.write(
    `\n  🔴 SIN ESTA GUARDA este mismo árbol daba 73 síntomas (6 mutantes de test_estado_panel\n` +
      `  «por otra causa» + 67 ERRORs de fixture) a los ~8 minutos de batería, sin nombrar la\n` +
      `  causa. La comprobación es la MISMA —resultadoNavegador()—; lo que cambia es cuándo\n` +
      `  habla y qué dice. EXIT 64.\n`,
  );
  process.exit(64);
}
