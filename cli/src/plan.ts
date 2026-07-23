export const DATABASES = ["postgres", "sqlite", "none"] as const;
export const ORMS = ["drizzle", "none"] as const;
export const CACHES = ["redis", "none"] as const;

export type Database = (typeof DATABASES)[number];
export type Orm = (typeof ORMS)[number];
export type Cache = (typeof CACHES)[number];

const DOCKER_SERVICE_DATABASES = new Set<string>(["postgres", "mysql"]);

export interface Answers {
  database: Database;
  orm: Orm;
  cache: Cache;
  /** docker-compose for the selected local services. */
  docker: boolean;
}

export function hasLocalService(answers: {
  database: Database;
  cache: Cache;
}): boolean {
  return (
    DOCKER_SERVICE_DATABASES.has(answers.database) || answers.cache === "redis"
  );
}

/** Maps answers to integration folders. Client is db-<database>, ORM is <orm>-<database>. */
export function integrationsFor(answers: Answers): string[] {
  const integrations: string[] = [];
  if (answers.database !== "none") {
    integrations.push(`db-${answers.database}`);
    if (answers.orm !== "none") {
      integrations.push(`${answers.orm}-${answers.database}`);
    }
  }
  if (answers.cache === "redis") {
    integrations.push("redis");
  }
  return integrations;
}

/** Rejects combinations that make no sense before any file is written. */
export function validateAnswers(answers: Answers): string | null {
  if (!DATABASES.includes(answers.database)) {
    return `Unknown database "${answers.database}". Expected: ${DATABASES.join(", ")}`;
  }
  if (!ORMS.includes(answers.orm)) {
    return `Unknown ORM "${answers.orm}". Expected: ${ORMS.join(", ")}`;
  }
  if (!CACHES.includes(answers.cache)) {
    return `Unknown cache "${answers.cache}". Expected: ${CACHES.join(", ")}`;
  }
  if (answers.database === "none" && answers.orm !== "none") {
    return "An ORM without a database makes no sense. Pick a database or drop the ORM.";
  }
  if (answers.docker && !hasLocalService(answers)) {
    return "docker-compose needs a local service. Pick a database that runs as a service, or Redis.";
  }
  return null;
}
