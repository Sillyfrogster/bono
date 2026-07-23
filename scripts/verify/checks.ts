export function run(
  command: string[],
  cwd: string,
  extraEnv: Record<string, string> = {},
): void {
  const result = Bun.spawnSync(command, {
    cwd,
    env: { ...process.env, ...extraEnv },
    stdout: "pipe",
    stderr: "pipe",
  });
  if (result.exitCode !== 0) {
    throw new Error(
      `\`${command.join(" ")}\` exited ${result.exitCode}\n${result.stdout.toString()}\n${result.stderr.toString()}`,
    );
  }
}

export function dockerAvailable(): boolean {
  try {
    const probe = Bun.spawnSync(["docker", "info"], {
      stdout: "pipe",
      stderr: "pipe",
    });
    return probe.exitCode === 0;
  } catch {
    return false;
  }
}

/** Starts a service, applies migrations, boots the server, then tears the service down. */
export async function liveCheck(
  projectDir: string,
  hasDrizzle: boolean,
): Promise<void> {
  if (!dockerAvailable()) {
    console.log("skipped live check (docker not available)");
    return;
  }
  try {
    run(["docker", "compose", "up", "-d", "--wait"], projectDir);
    if (hasDrizzle) {
      run(["bun", "run", "db:migrate"], projectDir);
    }
    await bootCheck(projectDir);
  } finally {
    Bun.spawnSync(["docker", "compose", "down", "-v"], {
      cwd: projectDir,
      stdout: "pipe",
      stderr: "pipe",
    });
  }
}

/** Boots the generated server and waits for /health to answer. */
export async function bootCheck(projectDir: string): Promise<void> {
  const port = 3100 + Math.floor(Math.random() * 500);
  const server = Bun.spawn(["bun", "src/index.ts"], {
    cwd: projectDir,
    env: { ...process.env, PORT: String(port) },
    stdout: "pipe",
    stderr: "pipe",
  });
  try {
    for (let attempt = 0; attempt < 40; attempt++) {
      const response = await fetch(`http://localhost:${port}/health`).catch(
        () => null,
      );
      if (response?.status === 200) {
        return;
      }
      await Bun.sleep(100);
    }
    const stderr = await new Response(server.stderr).text();
    throw new Error(`server never answered /health on port ${port}\n${stderr}`);
  } finally {
    server.kill();
  }
}
