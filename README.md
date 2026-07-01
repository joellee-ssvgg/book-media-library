# 阅迹 · 个人书影库

私人优先的阅读与观影记录平台：搜索添加书籍/电影、记录进度与笔记、足迹地图与观影月历，并可选择性生成公开主页与清单分享页。

## 技术栈

- **前端**：Next.js 16（App Router, Turbopack）+ React 19 + Tailwind CSS 4，纯 JavaScript（项目约束，不使用 TS 源码）
- **后端**：Supabase（Postgres + Auth + Storage + RLS），会话刷新与路由保护在 `apps/web/proxy.js`
- **数据源**：TMDB / Open Library / Google Books / 手动录入与 CSV 导入
- **测试**：Vitest（单元）+ pgTAP（数据库 RLS）+ 验收脚本（`scripts/`）
- **限流与观测**：Upstash Redis（IP 与账号分级限流）+ Sentry 告警

## 本地开发

```bash
pnpm install
cp .env.example .env.local        # 填入 Supabase / TMDB / Upstash 等密钥
supabase start                    # 需要 Docker
supabase db reset                 # 重放迁移 + seed
pnpm dev                          # http://localhost:3000
```

## 常用脚本

| 命令 | 说明 |
| --- | --- |
| `pnpm dev` / `pnpm build` | 开发 / 生产构建 |
| `pnpm lint` / `pnpm test` | ESLint / Vitest 单测 |
| `pnpm typecheck` | tsc 语法级检查（`checkJs` 未开启，详见下方说明） |
| `pnpm db:migrate:smoke` | `supabase db reset` 迁移冒烟 |
| `pnpm db:test:rls` | pgTAP RLS 测试套件 |
| `pnpm check:all` | lint + typecheck + 测试 + 迁移 + RLS + build 全量检查 |
| `pnpm p0:redline` | P0 红线验收脚本 |

## 目录结构

```
apps/web            Next.js 应用（app 路由、components、actions、lib）
apps/web/proxy.js   会话刷新、私有路由保护、限流、公开页 410 检查
supabase/migrations 数据库迁移（按时间戳顺序重放）
test/rls            pgTAP RLS 测试
scripts             验收与冒烟脚本
acceptance          验收产物
```

## 已知限制

- `pnpm typecheck` 当前只做语法级检查：代码由 TS 转为 JS 后未启用 `checkJs`（全量开启约有 180 处需补 JSDoc 标注的报错），后续可按 `lib/` → `actions/` 的顺序渐进开启。
- 产品方案、协作章程等 PDF 文档为本地资料，不入库（见 `.gitignore`）。
