export const DATABASES = ["postgres", "none"] as const;
export const ORMS = ["drizzle", "none"] as const;
export const CACHES = ["redis", "none"] as const;

export type Database = (typeof DATABASES)[number];
export type Orm = (typeof ORMS)[number];
export type Cache = (typeof CACHES)[number];

export interface Answers {
  database: Database;
  orm: Orm;
  cache: Cache;
  /** docker-compose for the selected local services. */
  docker: boolean;
}

/**
 * Maps prompt answers to the integration folders to apply, in order.
 * The whole CLI's decision logic lives here so it can be tested as data.
 */
export function integrationsFor(answers: Answers): string[] {
  const integrations: string[] = [];
  if (answers.database === "postgres") {
    integrations.push("db-postgres");
    if (answers.orm === "drizzle") {
      integrations.push("drizzle");
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
  if (
    answers.docker &&
    answers.database === "none" &&
    answers.cache === "none"
  ) {
    return "docker-compose needs a local service. Pick Postgres or Redis.";
  }
  return null;
}
