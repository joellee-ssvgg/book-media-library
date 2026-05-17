# Task 01 Startup Blockers

更新时间: 2026-05-17

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
| Docker daemon | `29.4.1` |
| Supabase CLI | `2.98.2` |
| GitHub CLI | 已登录 `joellee-ssvgg`，具备 `repo` scope |
| GitHub 仓库 | 已创建私有仓库 `joellee-ssvgg/book-media-library`，本地 `origin` 已配置 |
| Next.js 骨架 | `apps/web` 已生成，Next `16.2.6` |
| Vercel CLI | 已作为 root devDependency 安装，`pnpm exec vercel --version` 为 `54.1.0` |
| 环境变量模板 | `.env.example` 已生成，不含真实密钥 |

## 当前已解除

| 项 | 当前证据 |
| --- | --- |
| GitHub 仓库缺失 | 已按授权创建私有仓库 `joellee-ssvgg/book-media-library`，本地 `origin` 已配置为 `https://github.com/joellee-ssvgg/book-media-library.git` |

## 当前已排除

| 项 | 当前证据 |
| --- | --- |
| Supabase 登录态 / 候选项目 | `supabase projects list` 返回 `Access token not provided`，当前无法列出或绑定 Supabase 项目 |
| Vercel 登录态 / 候选项目 | `pnpm exec vercel whoami` 触发设备登录，未完成认证；当前无 `VERCEL_TOKEN`，也无 `~/.vercel/auth.json` |
| Task 01 门禁脚本 | `./scripts/check-task-01-readiness.sh` 返回 `NOT READY: blockers=3 warnings=0` |

## 阻断项登记

| 阻断项 | 影响的 Task | 期望由谁解除 | 已尝试的替代方案 |
| --- | --- | --- | --- |
| 没有 Supabase dev/staging/prod 项目访问与 dev 环境密钥；当前 Supabase CLI 也未登录 | Task 01: profiles、auth、RLS、pgTAP、migration smoke | Joel 提供 Supabase 项目与 dev `.env.local` 必需值，或先完成 `supabase login` 并明确授权按 CLI 流程协助创建项目 | 未替代。不能用无 Supabase 的本地假实现推进 |
| 没有 Vercel 项目接入信息；Vercel CLI 已安装但认证未完成 | Task 01 CI/preview 链路，Task 17 公开页和后续 staging 验收 | Joel 完成 Vercel 设备登录，或提供 `VERCEL_TOKEN` 后由 Agent 继续创建/接入项目 | 未替代。不能把 P0 验收改成本地预览 |
| 没有 Upstash Redis、Sentry、TMDB API、Google Books 可选 key 等环境变量 | Task 06、Task 20、P0 监控与限流 | Joel 提供 dev/staging 环境变量，或明确哪些 SaaS 由 Agent 协助创建 | 未替代。工作包不允许用兜底设计跳过 |
| 没有 `.env.local` 真实 dev 值 | Task 01 启动序列与安全检查 | Joel 提供真实 dev 值，或在 Supabase/Vercel/Upstash/Sentry/TMDB 创建完成后由 Agent 写入本机 `.env.local` | 未替代。`.env.example` 仅是模板，不冒充可运行环境 |

## 当前结论

Task 01 暂不能开工写业务代码或 migration。GitHub 私有仓库已经创建；剩余阻断项集中在 Supabase/Vercel 认证、`.env.local` 真实 dev 值，以及 Upstash/Sentry/TMDB 等外部服务密钥。

## 下一步入口

确认以下路径之一:

1. Supabase: 提供 `SUPABASE_ACCESS_TOKEN`，或在本机完成 `supabase login` 后让 Agent 继续按 CLI 创建/绑定 dev 项目。
2. Vercel: 提供 `VERCEL_TOKEN`，或完成 Vercel CLI 设备登录后让 Agent 继续创建/绑定项目。
3. 环境变量: 在 Supabase/Vercel/Upstash/Sentry/TMDB 创建完成后，由 Agent 写入本机 `.env.local`；不得把 `.env.example` 当作可运行凭据。
