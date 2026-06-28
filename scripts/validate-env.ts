import { config } from "dotenv";

config({ path: ".env.local" });
config({ path: ".env" });

type DeployTarget = "vercel" | "self-hosted";

type EnvRule = {
  description: string;
  name: string;
  validate?: (value: string) => string | null;
};

const validTargets = new Set<DeployTarget>(["vercel", "self-hosted"]);

function getTarget(): DeployTarget {
  const targetArg = process.argv.find((arg) => arg.startsWith("--target="));
  const rawTarget =
    targetArg?.split("=")[1] ?? process.env.DEPLOY_TARGET ?? "vercel";

  if (validTargets.has(rawTarget as DeployTarget)) {
    return rawTarget as DeployTarget;
  }

  console.error(
    `Invalid deploy target "${rawTarget}". Use "vercel" or "self-hosted".`
  );
  process.exit(1);
}

function isPlaceholder(value: string) {
  const trimmed = value.trim();

  return (
    trimmed === "" ||
    /^\*+$/.test(trimmed) ||
    /^change-?me$/i.test(trimmed) ||
    /^your[-_]/i.test(trimmed) ||
    /^<.+>$/.test(trimmed)
  );
}

function validateSecret(value: string) {
  if (value.length < 32) {
    return "must be at least 32 characters";
  }

  return null;
}

function validateUrl(protocols: string[]) {
  return (value: string) => {
    try {
      const url = new URL(value);
      if (!protocols.includes(url.protocol)) {
        return `must use one of these protocols: ${protocols.join(", ")}`;
      }
    } catch {
      return "must be a valid URL";
    }

    return null;
  };
}

const target = getTarget();

const requiredRules: EnvRule[] = [
  {
    description: "Auth.js session signing secret",
    name: "AUTH_SECRET",
    validate: validateSecret,
  },
  {
    description: "Postgres database connection string",
    name: "POSTGRES_URL",
    validate: validateUrl(["postgres:", "postgresql:"]),
  },
  {
    description: "Vercel Blob read/write token for file uploads",
    name: "BLOB_READ_WRITE_TOKEN",
  },
  {
    description: "Redis connection string for resumable streams and limits",
    name: "REDIS_URL",
    validate: validateUrl(["redis:", "rediss:"]),
  },
];

if (target === "self-hosted") {
  requiredRules.push({
    description: "AI Gateway API key for non-Vercel deployments",
    name: "AI_GATEWAY_API_KEY",
  });
}

const errors = requiredRules.flatMap((rule) => {
  const value = process.env[rule.name];

  if (!value || isPlaceholder(value)) {
    return [`${rule.name} is missing or still set to a placeholder`];
  }

  const validationError = rule.validate?.(value);

  if (validationError) {
    return [`${rule.name} ${validationError}`];
  }

  return [];
});

if (errors.length > 0) {
  console.error(`Production environment check failed for target: ${target}`);
  for (const error of errors) {
    console.error(`- ${error}`);
  }
  process.exit(1);
}

console.log(`Production environment check passed for target: ${target}`);
console.log(`Checked: ${requiredRules.map((rule) => rule.name).join(", ")}`);

if (target === "vercel" && !process.env.AI_GATEWAY_API_KEY) {
  console.log("AI_GATEWAY_API_KEY is optional on Vercel because OIDC is used.");
}

if (target === "self-hosted" && !process.env.AUTH_URL) {
  console.log(
    "AUTH_URL is recommended for self-hosted deployments and should match the public app origin."
  );
}
