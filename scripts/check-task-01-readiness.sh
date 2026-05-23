#!/usr/bin/env bash
set -u

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BLOCKERS=0
WARNINGS=0

pass() {
  printf 'PASS    %s\n' "$1"
}

warn() {
  WARNINGS=$((WARNINGS + 1))
  printf 'WARN    %s\n' "$1"
}

blocker() {
  BLOCKERS=$((BLOCKERS + 1))
  printf 'BLOCKER %s\n' "$1"
}

have_cmd() {
  command -v "$1" >/dev/null 2>&1
}

run_with_timeout() {
  local seconds="$1"
  shift
  "$@" &
  local pid=$!
  (
    sleep "$seconds"
    kill "$pid" >/dev/null 2>&1
  ) &
  local watchdog=$!
  wait "$pid"
  local status=$?
  kill "$watchdog" >/dev/null 2>&1
  wait "$watchdog" 2>/dev/null || true
  return "$status"
}

version_major() {
  printf '%s' "$1" | sed -E 's/^[^0-9]*([0-9]+).*/\1/'
}

printf 'Task 01 readiness check\n'
printf 'Root: %s\n\n' "$ROOT"

cd "$ROOT" || exit 2

if [ -f "Agent 协作章程 · 书影计划 v6.pdf" ] && [ -f "个人书影库平台产品方案v6.pdf" ] && [ -f "外部Agent执行工作包.zip" ]; then
  pass "required source PDFs are present"
else
  blocker "required source PDFs or external work package are missing"
fi

if git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  pass "current directory is a git repository"
  branch="$(git branch --show-current 2>/dev/null || true)"
  if [ -n "$branch" ]; then
    pass "current git branch is $branch"
  else
    warn "could not determine current git branch"
  fi
  if git remote get-url origin >/dev/null 2>&1; then
    pass "git remote origin is configured"
  else
    blocker "git remote origin is not configured"
  fi
else
  blocker "current directory is not a git repository"
fi

if have_cmd node; then
  node_version="$(node -v)"
  node_major="$(version_major "$node_version")"
  if [ "${node_major:-0}" -ge 20 ]; then
    pass "node $node_version"
  else
    blocker "node must be >= 20, found $node_version"
  fi
else
  blocker "node is not installed"
fi

if have_cmd pnpm; then
  pnpm_version="$(pnpm -v)"
  pnpm_major="$(version_major "$pnpm_version")"
  if [ "${pnpm_major:-0}" -ge 9 ]; then
    pass "pnpm $pnpm_version"
  else
    blocker "pnpm must be >= 9, found $pnpm_version"
  fi
else
  blocker "pnpm is not installed"
fi

if have_cmd docker; then
  if docker info >/dev/null 2>&1; then
    pass "docker daemon is reachable"
  else
    blocker "docker is installed but daemon is not reachable"
  fi
else
  blocker "docker is not installed"
fi

if have_cmd supabase; then
  pass "supabase CLI $(supabase --version 2>/dev/null)"
  if supabase projects list >/tmp/task01-supabase-projects.txt 2>/tmp/task01-supabase-projects.err; then
    pass "supabase CLI can list projects"
  else
    blocker "supabase CLI is not logged in or cannot list projects"
  fi
else
  blocker "supabase CLI is not installed"
fi

if have_cmd gh; then
  gh_auth_output="$(gh auth status -h github.com 2>&1)"
  gh_auth_status=$?
  if [ "$gh_auth_status" -eq 0 ]; then
    pass "GitHub CLI is authenticated"
    gh_scopes_line="$(printf '%s\n' "$gh_auth_output" | sed -n 's/.*Token scopes: //p' | tail -n 1)"
    if [ -n "$gh_scopes_line" ]; then
      required_gh_scopes=(repo workflow)
      missing_gh_scopes=()
      for scope in "${required_gh_scopes[@]}"; do
        if printf '%s\n' "$gh_scopes_line" | grep -Fq "'$scope'"; then
          pass "GitHub CLI token has $scope scope"
        else
          missing_gh_scopes+=("$scope")
        fi
      done
      if [ "${#missing_gh_scopes[@]}" -gt 0 ]; then
        blocker "GitHub CLI token is missing required scopes: ${missing_gh_scopes[*]}"
      fi
    else
      blocker "GitHub CLI token scopes could not be inspected"
    fi
  else
    blocker "GitHub CLI is not authenticated"
  fi
else
  blocker "GitHub CLI is not installed"
fi

if have_cmd vercel; then
  pass "Vercel CLI $(vercel --version 2>/dev/null | tail -n 1)"
  if [ -n "${VERCEL_TOKEN:-}" ] && run_with_timeout 10 vercel whoami --non-interactive --token "$VERCEL_TOKEN" >/dev/null 2>&1; then
    pass "Vercel CLI is authenticated with VERCEL_TOKEN"
  elif run_with_timeout 10 vercel whoami --non-interactive >/dev/null 2>&1; then
    pass "Vercel CLI is authenticated"
  else
    blocker "Vercel CLI is installed but not authenticated or timed out"
  fi
elif have_cmd pnpm && pnpm exec vercel --version >/tmp/task01-vercel-version.txt 2>/tmp/task01-vercel-version.err; then
  pass "Vercel CLI via pnpm exec $(tail -n 1 /tmp/task01-vercel-version.txt)"
  if [ -n "${VERCEL_TOKEN:-}" ] && run_with_timeout 10 pnpm exec vercel whoami --non-interactive --token "$VERCEL_TOKEN" >/dev/null 2>&1; then
    pass "Vercel CLI is authenticated with VERCEL_TOKEN"
  elif run_with_timeout 10 pnpm exec vercel whoami --non-interactive >/dev/null 2>&1; then
    pass "Vercel CLI is authenticated"
  else
    blocker "Vercel CLI is installed but not authenticated or timed out"
  fi
else
  blocker "Vercel CLI is not installed or not on PATH"
fi

if [ -f package.json ]; then
  pass "package.json exists"
else
  blocker "package.json is missing"
fi

if [ -f pnpm-lock.yaml ]; then
  pass "pnpm-lock.yaml exists"
else
  blocker "pnpm-lock.yaml is missing"
fi

if [ -d apps/web ]; then
  pass "apps/web exists"
else
  blocker "apps/web is missing"
fi

if [ -d supabase/migrations ]; then
  pass "supabase/migrations exists"
else
  blocker "supabase/migrations is missing"
fi

if [ -f .env.example ]; then
  pass ".env.example exists"
else
  blocker ".env.example is missing"
fi

if [ -f .env.local ]; then
  pass ".env.local exists"
  required_env=(
    NEXT_PUBLIC_SUPABASE_URL
    NEXT_PUBLIC_SUPABASE_ANON_KEY
    SUPABASE_SERVICE_ROLE_KEY
    TMDB_API_KEY
    GOOGLE_BOOKS_API_KEY
    UPSTASH_REDIS_REST_URL
    UPSTASH_REDIS_REST_TOKEN
    NEXT_PUBLIC_SENTRY_DSN
    SENTRY_AUTH_TOKEN
    NEXT_PUBLIC_APP_URL
  )
  for key in "${required_env[@]}"; do
    if grep -Eq "^${key}=.+" .env.local; then
      pass ".env.local contains $key"
    else
      blocker ".env.local is missing $key"
    fi
  done
else
  blocker ".env.local is missing"
fi

if [ "$BLOCKERS" -eq 0 ]; then
  printf '\nREADY: Task 01 startup gates passed. warnings=%s\n' "$WARNINGS"
  exit 0
fi

printf '\nNOT READY: blockers=%s warnings=%s\n' "$BLOCKERS" "$WARNINGS"
exit 1
