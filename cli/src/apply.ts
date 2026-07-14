import { cpSync, existsSync, renameSync } from "node:fs";
import { join } from "node:path";
import { type IntegrationManifest, loadManifest } from "./manifest.ts";

/** Copies the base template and personalizes it (name, .gitignore). */
export async function copyBase(
  templatesDir: string,
  dest: string,
  projectName: string,
): Promise<void> {
  // The filter matters when running from the repo, where the template
  // workspace has its own install and env; the published tarball ships none
  // of these.
  const skip = ["node_modules", "bun.lock", ".env"];
  cpSync(join(templatesDir, "base"), dest, {
    recursive: true,
    filter: (source) => !skip.some((name) => source.endsWith(`/${name}`)),
  });

  // npm strips .gitignore from published tarballs, so the template ships
  // it as _gitignore and it gets renamed here.
  renameSync(join(dest, "_gitignore"), join(dest, ".gitignore"));

  const packageJsonPath = join(dest, "package.json");
  const packageJson = await Bun.file(packageJsonPath).json();
  packageJson.name = projectName;
  await writeJson(packageJsonPath, packageJson);

  const readmePath = join(dest, "README.md");
  const readme = await Bun.file(readmePath).text();
  await Bun.write(readmePath, readme.replace(/^# .+/, `# ${projectName}`));
}

/** Copies an integration's files in and applies its manifest. */
export async function applyIntegration(
  templatesDir: string,
  dest: string,
  name: string,
): Promise<IntegrationManifest> {
  const integrationDir = join(templatesDir, "integrations", name);
  const manifest = await loadManifest(integrationDir);

  const filesDir = join(integrationDir, "files");
  if (existsSync(filesDir)) {
    cpSync(filesDir, dest, { recursive: true });
  }

  await mergePackageJson(dest, manifest);
  await appendEnv(dest, manifest.env ?? []);
  for (const insert of manifest.inserts ?? []) {
    await applyInsert(dest, insert.file, insert.anchor, insert.line);
  }
  if (manifest.readme) {
    await appendReadme(dest, manifest.readme);
  }
  return manifest;
}

/** Appends an integration's docs to the generated README, once. */
async function appendReadme(dest: string, section: string): Promise<void> {
  const path = join(dest, "README.md");
  const current = await Bun.file(path).text();
  const trimmed = section.trim();
  if (current.includes(trimmed)) {
    return;
  }
  await Bun.write(path, `${current.trimEnd()}\n\n${trimmed}\n`);
}

async function mergePackageJson(
  dest: string,
  manifest: IntegrationManifest,
): Promise<void> {
  const path = join(dest, "package.json");
  const packageJson = await Bun.file(path).json();
  packageJson.dependencies = sortKeys({
    ...packageJson.dependencies,
    ...manifest.dependencies,
  });
  packageJson.devDependencies = sortKeys({
    ...packageJson.devDependencies,
    ...manifest.devDependencies,
  });
  packageJson.scripts = { ...packageJson.scripts, ...manifest.scripts };
  await writeJson(path, packageJson);
}

/** Adds env entries to .env.example, skipping keys that already exist. */
async function appendEnv(
  dest: string,
  entries: { key: string; value: string }[],
): Promise<void> {
  if (entries.length === 0) {
    return;
  }
  const path = join(dest, ".env.example");
  const current = await Bun.file(path).text();
  const existingKeys = new Set(
    current
      .split("\n")
      .map((line) => line.split("=")[0]?.trim())
      .filter(Boolean),
  );
  const missing = entries.filter((entry) => !existingKeys.has(entry.key));
  if (missing.length === 0) {
    return;
  }
  const lines = missing
    .map((entry) => `${entry.key}=${entry.value}`)
    .join("\n");
  const separator = current.endsWith("\n") ? "" : "\n";
  await Bun.write(path, `${current}${separator}${lines}\n`);
}

/**
 * Inserts a line directly above a known anchor comment in a base file.
 * Applying the same insert twice is a no-op.
 */
async function applyInsert(
  dest: string,
  file: string,
  anchor: string,
  line: string,
): Promise<void> {
  const path = join(dest, file);
  const content = await Bun.file(path).text();
  if (content.includes(line)) {
    return;
  }
  const lines = content.split("\n");
  const anchorIndex = lines.findIndex(
    (candidate) => candidate.trim() === anchor.trim(),
  );
  if (anchorIndex === -1) {
    throw new Error(`Anchor "${anchor}" not found in ${file}`);
  }
  lines.splice(anchorIndex, 0, line);
  await Bun.write(path, lines.join("\n"));
}

function sortKeys(record: Record<string, string>): Record<string, string> {
  return Object.fromEntries(
    Object.entries(record).sort(([a], [b]) => a.localeCompare(b)),
  );
}

async function writeJson(path: string, value: unknown): Promise<void> {
  await Bun.write(path, `${JSON.stringify(value, null, 2)}\n`);
}
