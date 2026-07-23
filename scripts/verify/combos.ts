import {
  CACHES,
  DATABASES,
  hasLocalService,
  ORMS,
} from "../../cli/src/plan.ts";

export interface Combo {
  label: string;
  args: string[];
  docker: boolean;
  hasDrizzle: boolean;
  hasRedis: boolean;
}

/** Every valid answer combination to generate and check. */
export function buildCombos(): Combo[] {
  const combos: Combo[] = [];

  for (const database of DATABASES) {
    for (const orm of ORMS) {
      if (database === "none" && orm !== "none") {
        continue;
      }
      for (const cache of CACHES) {
        const dockerOptions = hasLocalService({ database, cache })
          ? [false, true]
          : [false];

        for (const docker of dockerOptions) {
          const label = comboLabel(database, orm, cache, docker);
          const args =
            label === "base"
              ? ["--base"]
              : [
                  "--database",
                  database,
                  "--orm",
                  orm,
                  "--cache",
                  cache,
                  docker ? "--docker" : "--no-docker",
                ];

          combos.push({
            label,
            args,
            docker,
            hasDrizzle: orm === "drizzle",
            hasRedis: cache === "redis",
          });
        }
      }
    }
  }

  return combos;
}

function comboLabel(
  database: (typeof DATABASES)[number],
  orm: (typeof ORMS)[number],
  cache: (typeof CACHES)[number],
  docker: boolean,
): string {
  const parts = [
    ...(database !== "none" ? [database] : []),
    ...(orm !== "none" ? [orm] : []),
    ...(cache === "redis" ? ["redis"] : []),
    ...(docker ? ["docker"] : []),
  ];
  return parts.join("-") || "base";
}
