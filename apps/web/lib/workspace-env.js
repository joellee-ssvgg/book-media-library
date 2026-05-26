import path from "node:path";
import { fileURLToPath } from "node:url";
import nextEnv from "@next/env";

const { loadEnvConfig } = nextEnv;
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const workspaceRoot = path.resolve(__dirname, "../../..");

let loaded = false;

export function loadWorkspaceEnv() {
  if (loaded) {
    return;
  }
  loadEnvConfig(workspaceRoot, process.env.NODE_ENV !== "production", console, true);
  loaded = true;
}
