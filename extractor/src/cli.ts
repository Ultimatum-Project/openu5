/**
 * CLI del extractor: convierte los datos originales de Ultima V en los assets
 * digeridos que consume el juego.
 *
 * Uso: npm run extract -- [--src <dir>] [--out <dir>] [--skip-music] [--skip-tiles]
 *
 * La SECUENCIA de extracción vive en pipeline.ts (compartida con la demo BYO
 * del navegador); este fichero es solo el wrapper Node: fs + pngjs + música
 * (audio/render.ts es Node-only) + manifest.
 */
import { createHash } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  writeFileSync,
} from "node:fs";
import { join, relative, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

import { runPipeline, validateSourceFiles, type PipelineIO } from "./pipeline.js";
import { writePng } from "./png.js";
import { renderAllMusic } from "./audio/render.js";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");

interface Args {
  src: string;
  out: string;
  skipMusic: boolean;
  skipTiles: boolean;
}

function parseArgs(): Args {
  const argv = process.argv.slice(2);
  const get = (flag: string): string | undefined => {
    const i = argv.indexOf(flag);
    return i >= 0 ? argv[i + 1] : undefined;
  };
  return {
    src: resolve(get("--src") ?? join(ROOT, "original/u5/ultima5")),
    out: resolve(get("--out") ?? join(ROOT, "game/assets")),
    skipMusic: argv.includes("--skip-music"),
    skipTiles: argv.includes("--skip-tiles"),
  };
}

function writeJson(path: string, value: unknown): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify(value));
}

async function main(): Promise<void> {
  const args = parseArgs();
  console.log(`Extractor Ultima V\n  src: ${args.src}\n  out: ${args.out}\n`);

  const io: PipelineIO = {
    read: (name) => new Uint8Array(readFileSync(join(args.src, name))),
    exists: (name) => existsSync(join(args.src, name)),
    putJson: (path, value) => writeJson(join(args.out, path), value),
    putPng: (path, rgba, width, height) => {
      mkdirSync(dirname(join(args.out, path)), { recursive: true });
      writePng(join(args.out, path), rgba, width, height);
    },
    putBin: (path, bytes) => {
      mkdirSync(dirname(join(args.out, path)), { recursive: true });
      writeFileSync(join(args.out, path), bytes);
    },
    log: (message) => console.log(message),
  };

  const problems = validateSourceFiles(io);
  if (problems.length > 0) {
    throw new Error(
      `Datos originales inválidos en ${args.src}:\n  - ${problems.join("\n  - ")}\n` +
        `Asegúrate de apuntar --src al directorio con los ficheros DOS de Ultima V.`,
    );
  }

  await runPipeline(io, { skipTiles: args.skipTiles });

  // 9. Música (Node-only: renderiza el pack XMI del `upgrade/` con el soundfont).
  // Es QoL (el DOS era mudo): si falta el toolchain externo (fluid-synth/ffmpeg/
  // soundfont), se OMITE con aviso en vez de romper el flujo del primer clone.
  if (!args.skipMusic) {
    console.log("• Música…");
    try {
      renderAllMusic(join(args.src, "upgrade"), args.out);
    } catch (e) {
      console.log(
        `  omitida — ${e instanceof Error ? e.message : String(e)}\n` +
          `  (el juego funciona sin música; usa --skip-music para silenciar este aviso)`,
      );
    }
  } else {
    console.log("• Música… (omitida)");
  }

  // 10. Manifest
  console.log("• Manifest…");
  const files: Record<string, string> = {};
  const walk = (dir: string): void => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.name !== "manifest.json") {
        files[relative(args.out, full)] = createHash("sha256")
          .update(readFileSync(full))
          .digest("hex");
      }
    }
  };
  walk(args.out);
  writeJson(join(args.out, "manifest.json"), {
    version: 1,
    generated: new Date().toISOString(),
    files,
  });

  console.log(`\n✔ Extracción completa: ${Object.keys(files).length} ficheros en ${args.out}`);
}

await main();
