import { extractToNamedCache, type SourceFiles } from "../../extractor/src/browser.js";

interface ImportPlan {
  title: string;
  fileCount: number;
  logicalBytes: number;
  ignored: number;
  replacing: boolean;
}

interface Ultima5ImportAdapter {
  createDescriptor(): unknown;
  detect(inventory: readonly { id: string; path: string; size: number }[]): readonly unknown[];
  createInstallPlan(match: unknown, options: { replacing: boolean }): ImportPlan;
}

interface InstallStore {
  getActive(): Promise<{ generationId: string } | null>;
  stage(extract: (context: { cacheName: string }) => Promise<unknown>): Promise<unknown>;
  publish(candidate: unknown, options: { expectedCurrent: string | null }): Promise<{ generationId: string; assetCount: number }>;
  cleanup(): Promise<unknown>;
}

interface ImportUi {
  setBusy(busy: boolean): void;
  showProblem(error: unknown): void;
  showStatus(status: unknown): void;
  showReview(plan: ImportPlan, install: () => Promise<void>, cancel: () => void): void;
}

type PlatformWindow = Window & typeof globalThis & {
  UltimatumGameImport?: { GameImportUI: new (root: HTMLElement, status: HTMLElement, descriptor: unknown, hooks: Record<string, () => void>) => ImportUi };
  UltimatumUltima5Import?: Ultima5ImportAdapter;
  UltimatumUltima5InstallStore?: { Ultima5CacheInstallStore: new () => InstallStore };
};

export interface UltimatumImportController {
  readonly enabled: boolean;
  review(src: SourceFiles): Promise<void>;
}

/**
 * Mounts Ultimatum's shared guidance/review UI while OpenU5 remains responsible
 * only for interpreting original U5 bytes. If platform scripts are unavailable,
 * the untouched upstream importer remains on screen and functional.
 */
export function mountUltimatumImporter(options: {
  doc: Document;
  picker: HTMLInputElement;
  pickerZip: HTMLInputElement;
  log: (message: string) => void;
  onInstalled: (assets: number) => Promise<void>;
}): UltimatumImportController {
  const win = options.doc.defaultView as PlatformWindow | null;
  const imports = win?.UltimatumGameImport;
  const adapter = win?.UltimatumUltima5Import;
  const stores = win?.UltimatumUltima5InstallStore;
  if (!imports || !adapter || !stores) return { enabled: false, review: async () => {} };

  const main = options.doc.querySelector("main");
  const firstStep = options.doc.querySelector("h2.paso");
  const statusBoundary = options.doc.getElementById("estado");
  if (!main || !firstStep || !statusBoundary) return { enabled: false, review: async () => {} };

  // Keep the real browser inputs, but replace OpenU5's duplicate acquisition and
  // selection presentation with the platform component.
  main.insertBefore(options.picker, statusBoundary);
  main.insertBefore(options.pickerZip, statusBoundary);
  let node: ChildNode | null = firstStep;
  while (node && node !== statusBoundary) {
    const next: ChildNode | null = node.nextSibling;
    node.remove();
    node = next;
  }
  statusBoundary.hidden = true;

  const section = options.doc.createElement("section");
  section.className = "ultimatum-import-shell";
  const guide = options.doc.createElement("div");
  guide.className = "import-guide";
  const status = options.doc.createElement("div");
  status.className = "import-status";
  status.setAttribute("role", "status");
  status.setAttribute("aria-live", "polite");
  section.append(guide, status);
  main.insertBefore(section, statusBoundary);

  const store = new stores.Ultima5CacheInstallStore();
  const ui = new imports.GameImportUI(guide, status, adapter.createDescriptor(), {
    folder: () => options.picker.click(),
    zip: () => options.pickerZip.click(),
  });

  return {
    enabled: true,
    async review(src: SourceFiles): Promise<void> {
      ui.setBusy(true);
      ui.showStatus({ state: "busy", title: "Checking this copy…", summary: "Verifying the required Ultima V DOS files. Nothing has been changed yet." });
      try {
        const inventory = Array.from(src, ([name, bytes]) => ({ id: name, path: name, size: bytes.byteLength }));
        const matches = adapter.detect(inventory);
        if (matches.length !== 1) throw new Error("Ultima V could not be identified unambiguously.");
        const active = await store.getActive();
        const plan = adapter.createInstallPlan(matches[0], { replacing: Boolean(active) });
        ui.showReview(plan, async () => {
          let assets = 0;
          try {
            const candidate = await store.stage(async ({ cacheName }) => {
              assets = await extractToNamedCache(src, cacheName, options.log);
            });
            await store.publish(candidate, { expectedCurrent: active?.generationId ?? null });
            await store.cleanup();
            ui.setBusy(false);
            ui.showStatus({ state: "success", title: "Ultima V is ready", summary: `${assets} generated assets were verified and installed.`, evidence: ["The previous installation was kept for rollback", "Saved games were not changed"], next: "Continue the journey when you are ready." });
            await options.onInstalled(assets);
          } catch (error) {
            ui.showProblem(error);
          }
        }, () => ui.showStatus({ title: "Nothing changed", summary: "Choose another Ultima V folder or ZIP when ready. Your current installation and saves are unchanged." }));
      } catch (error) {
        ui.showProblem(error);
      }
    },
  };
}
