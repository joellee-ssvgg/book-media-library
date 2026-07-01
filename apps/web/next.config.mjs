import path from "node:path";
import { fileURLToPath } from "node:url";
import nextEnv from "@next/env";
import { allOptimizedImageHosts } from "./lib/images.js";

const { loadEnvConfig } = nextEnv;

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const workspaceRoot = path.join(__dirname, "../..");

loadEnvConfig(workspaceRoot);

const nextConfig = {
  turbopack: {
    root: workspaceRoot,
  },
  images: {
    remotePatterns: allOptimizedImageHosts().map((hostname) => ({
      protocol: "https",
      hostname,
    })),
    // 本地开发常处于代理 fake-ip DNS 环境（域名解析到 198.18.x.x 私网段），
    // 优化器的 SSRF 防护会拒绝抓取上游图片；dev 下让浏览器直接加载原图。
    unoptimized: process.env.NODE_ENV === "development",
  },
};

export default nextConfig;
