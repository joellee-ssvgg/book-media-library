import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";

const requireFromWeb = createRequire(new URL("../apps/web/package.json", import.meta.url));
const Ajv2020Module = requireFromWeb("ajv/dist/2020") as { default?: typeof import("ajv/dist/2020").default };
const addFormatsModule = requireFromWeb("ajv-formats") as { default?: typeof import("ajv-formats").default };

const Ajv2020 = Ajv2020Module.default ?? (Ajv2020Module as unknown as typeof import("ajv/dist/2020").default);
const addFormats = addFormatsModule.default ?? (addFormatsModule as unknown as typeof import("ajv-formats").default);

function usage() {
  console.error("Usage: pnpm tsx scripts/validate-mspf.ts <data.json>");
}

const [inputPath] = process.argv.slice(2);

if (!inputPath) {
  usage();
  process.exit(2);
}

const schemaPath = new URL("../apps/web/lib/mspf/v1.0.0.schema.json", import.meta.url);
const schema = JSON.parse(readFileSync(schemaPath, "utf8")) as unknown;
const inputFile = resolve(inputPath);
const input = JSON.parse(readFileSync(inputFile, "utf8")) as unknown;
const ajv = new Ajv2020({ allErrors: true });
addFormats(ajv);

const validate = ajv.compile(schema);

if (!validate(input)) {
  const errors = (validate.errors ?? [])
    .map((error) => `${error.instancePath || "/"} ${error.message ?? "is invalid"}`)
    .join("; ");

  console.error(`MSPF validation failed: ${errors}`);
  process.exit(1);
}

const version = typeof input === "object" && input !== null && "version" in input
  ? String((input as { version?: unknown }).version)
  : "unknown";

console.log(`MSPF ${version} valid: ${inputFile}`);
