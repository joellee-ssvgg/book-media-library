# Task 01 Readiness Check

更新时间: 2026-05-22

## 目的

`scripts/check-task-01-readiness.sh` 是 Task 01 开工门禁脚本，只用于判断当前环境是否满足外部工作包的启动条件。

它不创建仓库、不创建 SaaS 项目、不写入密钥、不生成替代实现。

## 依据

- `外部Agent执行工作包` §2.1: Task 01 开工前必须确认文档、工具、Supabase dev、`.env`、提交渠道与安全红线。
- `外部Agent执行工作包` §7: GitHub repo、Supabase dev、Vercel、本地 Node/pnpm/Docker、文档访问是阻断项。
- `P0 环境与凭据 checklist` §1-§4: 账号、环境变量、本地开发环境与启动序列。

## 运行方式

```bash
./scripts/check-task-01-readiness.sh
```

如果脚本没有执行权限:

```bash
chmod +x scripts/check-task-01-readiness.sh
./scripts/check-task-01-readiness.sh
```

## 输出含义

| 标记 | 含义 |
| --- | --- |
| `PASS` | 该检查项已满足 |
| `WARN` | 不阻断开工，但需要关注 |
| `BLOCKER` | 阻断 Task 01，不允许继续写代码或 migration |

脚本退出码:

| 退出码 | 含义 |
| --- | --- |
| `0` | Task 01 启动门禁通过 |
| `1` | 仍有阻断项 |
| `2` | 脚本无法进入项目目录 |

## 安全边界

- 脚本只检查 `.env.local` 是否存在必需 key，不输出 key 的值。
- 脚本不会调用 production 环境。
- 脚本不会使用 service role key 执行业务查询。
- 脚本不会把缺失的 Supabase/Vercel/Upstash/Sentry/TMDB/Google Books 替换成本地 mock。

## 当前状态

2026-05-22 实测脚本返回 `READY: Task 01 startup gates passed. warnings=0`。

当前必需源码文档、git、Node、pnpm、Docker、Supabase、GitHub、Vercel、`.env.local` 与必需环境变量检查均通过。`GOOGLE_BOOKS_API_KEY` 已写入本地 `.env.local`，Google Books API 只读请求返回 `200` 且有结果。

Task 01 当前启动门禁可视为通过。后续如果外部 SaaS 登录态、token scope、远端 env 或本地 `.env.local` 发生变化，必须重新运行脚本并同步阻断项文档。
