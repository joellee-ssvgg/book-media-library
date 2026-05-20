# Task 01 Startup Blockers

更新时间: 2026-05-20

## 依据

- `外部Agent执行工作包` §2.1: Task 01 开工前必须确认仓库、环境、Node/pnpm/Git/Docker、Supabase dev、`.env`、提交渠道与安全红线。
- `外部Agent执行工作包` §7: 阻断项任一缺失时停工并升级，不做替代方案。
- `P0 环境与凭据 checklist` §1-§4: P0 需要 Supabase、Vercel、GitHub、Upstash、Sentry、TMDB API、环境变量与本地启动序列。

## 当前已确认可用

| 项 | 当前证据 |
| --- | --- |
| 工作目录 | `/Users/jeollee/Documents/Codex/书影库` |
| Node | `v24.15.0` |
| pnpm | `10.33.2` |
| Docker daemon | `docker info` 已可连接 Docker Desktop daemon，Server Version `29.4.1` |
| Supabase CLI | `2.98.2` |
| GitHub CLI | 已登录 `joellee-ssvgg`，具备 `repo` 与 `workflow` scope |
| GitHub 仓库 | 已创建私有仓库 `joellee-ssvgg/book-media-library`，本地 `origin` 已配置 |
| Next.js 骨架 | `apps/web` 已生成，Next `16.2.6` |
| Vercel CLI | 已作为 root devDependency 安装，`pnpm exec vercel --version` 为 `54.1.0`，`pnpm exec vercel whoami --non-interactive` 返回 `leejoel376-7980` |
| 环境变量模板 | `.env.example` 已生成，不含真实密钥 |
| 本地 dev 环境文件 | `.env.local` 已创建且被 `.gitignore` 忽略；已填入 Task 01 必需 dev 环境变量 |

## 当前已解除

| 项 | 当前证据 |
| --- | --- |
| GitHub 仓库缺失 | 已按授权创建私有仓库 `joellee-ssvgg/book-media-library`，本地 `origin` 已配置为 `https://github.com/joellee-ssvgg/book-media-library.git` |
| Docker daemon 不可达 | 已启动 Docker Desktop，`docker info` 可连接 daemon |
| GitHub CLI 缺 `workflow` scope / 远端分支未推送 | 已通过 `gh auth refresh -h github.com --scopes repo,workflow` 补齐 scope，并完成 `git push -u origin dev` 与 `git push -u origin main` |
| Vercel CLI 认证误判 | 已修正 `scripts/check-task-01-readiness.sh`，直接用 `whoami --non-interactive` 验证本机登录态 |
| Supabase CLI 未登录 / 无项目访问 | 已完成 `supabase login --no-browser`，`supabase projects list` 可列出项目 `bnmaolnecfywfbozsrxx` |
| `.env.local` 文件缺失 | 已创建 `.env.local`，权限为 `600`，已写入真实 Supabase dev 值 |
| 外部 API / SaaS 密钥缺失 | 已写入 `TMDB_API_KEY`, `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`, `NEXT_PUBLIC_SENTRY_DSN`, `SENTRY_AUTH_TOKEN` |

## 当前未解除

| 项 | 当前证据 |
| --- | --- |
| 无 | `pnpm task01:check` 返回 `READY: Task 01 startup gates passed. warnings=0` |

## 阻断项登记

| 阻断项 | 影响的 Task | 期望由谁解除 | 已尝试的替代方案 |
| --- | --- | --- | --- |
| 无 | Task 01 启动门禁 | 已解除 | 未使用替代方案 |

## 当前结论

Task 01 启动门禁已通过。GitHub 私有仓库已经创建，本地 `main`/`dev` 已推送到远端；Docker daemon 已恢复；Vercel CLI 已可认证；Supabase CLI 已登录且 `.env.local` 已写入真实 dev 值；TMDB、Upstash、Sentry 必需环境变量已补齐。

## 下一步入口

1. 进入 Task 01 实现前重新运行 `pnpm task01:check`，确认本机 Docker / SaaS 登录态未漂移。
2. 开始业务代码或 migration 前，按任务要求继续运行相关 lint / typecheck / test / build 验证。
