# Book Media Library

Private implementation repository for the P0 personal book and movie library platform.

## Source Of Truth

- `Agent 协作章程 · 书影计划 v6.pdf`
- `个人书影库平台产品方案v6.pdf`
- `外部Agent执行工作包/`
- `docs/runbooks/task-01-startup-blockers.md`
- `docs/runbooks/task-01-readiness-check.md`

## Startup Gate

Run the Task 01 gate before implementation work:

```bash
pnpm task01:check
```

Task 01 remains blocked until the gate reports `READY`.
