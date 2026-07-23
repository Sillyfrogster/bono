import { join } from "node:path";

export interface EnvEntry {
  key: string;
  value: string;
}

/** A line added to an existing base file, placed before a known anchor comment. */
export interface Insert {
  file: string;
  anchor: string;
  line: string;
}

export interface ComposeFragment {
  service: string;
  volume?: string;
}

export interface IntegrationManifest {
  name: string;
  description: string;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  scripts?: Record<string, string>;
  env?: EnvEntry[];
  inserts?: Insert[];
  compose?: ComposeFragment;
  gitignore?: string[];
  /** Markdown appended to the generated project's README. */
  readme?: string;
}

export async function loadManifest(
  integrationDir: string,
): Promise<IntegrationManifest> {
  const path = join(integrationDir, "manifest.json");
  const manifest = (await Bun.file(path).json()) as IntegrationManifest;
  if (!manifest.name || !manifest.description) {
    throw new Error(`Manifest at ${path} is missing name or description`);
  }
  return manifest;
}
