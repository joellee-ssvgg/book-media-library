import path from "node:path";
import { fileURLToPath } from "node:url";
import nextEnv from "@next/env";

const { loadEnvConfig } = nextEnv;

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const workspaceRoot = path.join(__dirname, "../..");

loadEnvConfig(workspaceRoot);

const nextConfig = {
  turbopack: {
    root: workspaceRoot,
  },
};

export default nextConfig;
