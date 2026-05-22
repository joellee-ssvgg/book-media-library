import { execFileSync, spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { createRequire } from "node:module";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import net from "node:net";
import { join } from "node:path";
import { setTimeout as delay } from "node:timers/promises";

const requireFromWeb = createRequire(new URL("../apps/web/package.json", import.meta.url));
const Ajv2020Module = requireFromWeb("ajv/dist/2020") as {
  default?: typeof import("ajv/dist/2020").default;
};
const addFormatsModule = requireFromWeb("ajv-formats") as {
  default?: typeof import("ajv-formats").default;
};

const Ajv2020 =
  Ajv2020Module.default ?? (Ajv2020Module as unknown as typeof import("ajv/dist/2020").default);
const addFormats =
  addFormatsModule.default ??
  (addFormatsModule as unknown as typeof import("ajv-formats").default);

const OWNER_AUTH_USER_ID = "00000000-0000-0000-0000-00000000aa20";
const OTHER_AUTH_USER_ID = "00000000-0000-0000-0000-00000000bb20";
const OWNER_USERNAME = "demo01";
const OTHER_USERNAME = "p0_redline_other";
const PRIVATE_NOTE = "第 6 章让我重新思考 DRY。";
const PRIVATE_NOTE_FRAGMENT = "重新思考 DRY";
const OWNER_BOOK_TITLE = "P0 Redline Owner Book";
const OWNER_MOVIE_TITLE = "P0 Redline Owner Movie";
const OTHER_BOOK_TITLE = "P0 Redline Other Book";
const SERVER_SECRET_PATTERN =
  /(SUPABASE_SERVICE_ROLE_KEY|SERVICE_ROLE_KEY|SENTRY_AUTH_TOKEN|UPSTASH_REDIS_REST_TOKEN|TMDB_API_KEY|JWT_SECRET|SECRET_KEY|sb_secret_|postgresql:\/\/|eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.)/i;
const WRITE_ARTIFACTS = process.argv.includes("--write-artifacts");
const ACCEPTANCE_DIR = "acceptance";

type SupabaseLocalEnv = {
  ANON_KEY: string;
  API_URL: string;
  DB_URL: string;
};

type SetupResult = {
  book_entry_id: string;
  book_work_id: string;
  export_job_id: string;
  movie_entry_id: string;
  movie_work_id: string;
  mspf: unknown;
  owner_profile_id: string;
  public_profile: unknown;
  public_work: unknown;
};

type DeletionResult = {
  auth_identity_count: number;
  export_job_count: number;
  hard_deleted: number;
  private_note_count: number;
  profile_state_after_hard_delete: string;
  profile_state_after_soft_delete: string;
  progress_log_count: number;
  request_status: string;
  same_auth_entry_count: number;
  tag_count: number;
};

type ArtifactPaths = {
  deletedScreenshot: string;
  mspfJson: string;
  publicScreenshot: string;
  runMarkdown: string;
};

function requireCommand(command: string) {
  try {
    execFileSync("which", [command], { stdio: "ignore" });
  } catch {
    throw new Error(`${command} is required for P0 redline acceptance.`);
  }
}

function parseSupabaseEnv(output: string): SupabaseLocalEnv {
  const values = new Map<string, string>();

  for (const line of output.split(/\r?\n/)) {
    const match = line.match(/^([A-Z0-9_]+)="?([^"]*)"?$/);
    if (match) {
      values.set(match[1], match[2]);
    }
  }

  const env = {
    ANON_KEY: values.get("ANON_KEY") ?? "",
    API_URL: values.get("API_URL") ?? "",
    DB_URL: values.get("DB_URL") ?? "",
  };

  if (!env.ANON_KEY || !env.API_URL || !env.DB_URL) {
    throw new Error("Local Supabase status is missing ANON_KEY, API_URL, or DB_URL.");
  }

  assertLocalSupabase(env);

  return env;
}

function assertLocalSupabase(env: SupabaseLocalEnv) {
  const apiUrl = new URL(env.API_URL);

  if (!["127.0.0.1", "localhost", "::1"].includes(apiUrl.hostname)) {
    throw new Error(`Refusing to run destructive P0 demo setup against non-local API_URL: ${env.API_URL}`);
  }

  if (!/(@127\.0\.0\.1:|@localhost:|@\[::1\]:)/.test(env.DB_URL)) {
    throw new Error("Refusing to run destructive P0 demo setup against a non-local DB_URL.");
  }
}

function readLocalSupabaseEnv() {
  const output = execFileSync("supabase", ["status", "-o", "env"], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });

  return parseSupabaseEnv(output);
}

function runPsql<T>(dbUrl: string, sql: string): T {
  let output: string;

  try {
    output = execFileSync(
      "psql",
      [
        "--no-psqlrc",
        "-X",
        "--set",
        "ON_ERROR_STOP=1",
        "--tuples-only",
        "--no-align",
        "--quiet",
        dbUrl,
        "--command",
        sql,
      ],
      {
        encoding: "utf8",
        maxBuffer: 1024 * 1024 * 20,
        stdio: ["ignore", "pipe", "pipe"],
      },
    );
  } catch (error) {
    const stderr =
      error && typeof error === "object" && "stderr" in error
        ? String((error as { stderr?: unknown }).stderr ?? "").trim()
        : "";

    throw new Error(stderr ? `P0 SQL failed:\n${stderr}` : "P0 SQL failed.");
  }

  const jsonLine = output
    .trim()
    .split(/\r?\n/)
    .reverse()
    .find((line) => line.trim().startsWith("{"));

  if (!jsonLine) {
    throw new Error("P0 SQL did not return a JSON result.");
  }

  return JSON.parse(jsonLine) as T;
}

function runToken() {
  return `p0_${Date.now().toString(36)}`;
}

function shanghaiDate() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    day: "2-digit",
    month: "2-digit",
    timeZone: "Asia/Shanghai",
    year: "numeric",
  }).formatToParts(new Date());
  const byType = new Map(parts.map((part) => [part.type, part.value]));

  return `${byType.get("year")}-${byType.get("month")}-${byType.get("day")}`;
}

function artifactPaths(date = shanghaiDate()): ArtifactPaths {
  return {
    deletedScreenshot: join(ACCEPTANCE_DIR, `p0-demo01-deleted-${date}.png`),
    mspfJson: join(ACCEPTANCE_DIR, `p0-mspf-${date}.json`),
    publicScreenshot: join(ACCEPTANCE_DIR, `p0-demo01-public-${date}.png`),
    runMarkdown: join(ACCEPTANCE_DIR, `p0-run-${date}.md`),
  };
}

function sqlForSetup(token: string) {
  const bookExternalId = `/works/OL-${token.toUpperCase()}-OWNER`;
  const otherExternalId = `/works/OL-${token.toUpperCase()}-OTHER`;
  const movieExternalId = `tmdb-${token}`;

  return String.raw`
set client_min_messages = warning;
set search_path = public, extensions;

create or replace function pg_temp.p0_set_auth_user(test_user uuid)
returns void
language plpgsql
as $$
begin
  if test_user is null then
    perform set_config('request.jwt.claims', '{}', false);
    perform set_config('request.jwt.claim.sub', '', false);
    perform set_config('request.jwt.claim.role', 'anon', false);
  else
    perform set_config(
      'request.jwt.claims',
      json_build_object('sub', test_user::text, 'role', 'authenticated')::text,
      false
    );
    perform set_config('request.jwt.claim.sub', test_user::text, false);
    perform set_config('request.jwt.claim.role', 'authenticated', false);
  end if;
end;
$$;

update public.profiles
set username = 'p0_stale_' || left(replace(id::text, '-', ''), 12)
where lower(username) in ('${OWNER_USERNAME}', '${OTHER_USERNAME}')
  and auth_user_id not in ('${OWNER_AUTH_USER_ID}'::uuid, '${OTHER_AUTH_USER_ID}'::uuid);

insert into auth.users (
  instance_id,
  id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  created_at,
  updated_at,
  raw_app_meta_data,
  raw_user_meta_data
) values
(
  '00000000-0000-0000-0000-000000000000',
  '${OWNER_AUTH_USER_ID}',
  'authenticated',
  'authenticated',
  'p0-redline-owner@example.com',
  'test-password-hash',
  now(),
  now(),
  now(),
  '{"provider":"github","providers":["github"]}'::jsonb,
  '{"username":"${OWNER_USERNAME}","display_name":"P0 Demo 01"}'::jsonb
),
(
  '00000000-0000-0000-0000-000000000000',
  '${OTHER_AUTH_USER_ID}',
  'authenticated',
  'authenticated',
  'p0-redline-other@example.com',
  'test-password-hash',
  now(),
  now(),
  now(),
  '{"provider":"github","providers":["github"]}'::jsonb,
  '{"username":"${OTHER_USERNAME}","display_name":"P0 Other User"}'::jsonb
)
on conflict (id) do update
set
  email = excluded.email,
  updated_at = now(),
  raw_app_meta_data = excluded.raw_app_meta_data,
  raw_user_meta_data = excluded.raw_user_meta_data;

insert into public.profiles (auth_user_id, username, display_name, public_visibility, onboarding_completed)
values
  ('${OWNER_AUTH_USER_ID}'::uuid, '${OWNER_USERNAME}', 'P0 Demo 01', 'public', true),
  ('${OTHER_AUTH_USER_ID}'::uuid, '${OTHER_USERNAME}', 'P0 Other User', 'public', true)
on conflict (auth_user_id) do update
set
  username = excluded.username,
  display_name = excluded.display_name,
  public_visibility = excluded.public_visibility,
  onboarding_completed = excluded.onboarding_completed,
  updated_at = now();

do $$
declare
  target_profile_id uuid;
begin
  perform set_config('request.jwt.claim.role', 'service_role', false);

  for target_profile_id in
    select id
    from public.profiles
    where auth_user_id in ('${OWNER_AUTH_USER_ID}'::uuid, '${OTHER_AUTH_USER_ID}'::uuid)
  loop
    perform public.task18_hard_delete_profile(target_profile_id, null);
    delete from public.user_entries where profile_id = target_profile_id;
    delete from public.account_deletion_requests where profile_id = target_profile_id;
    delete from public.auth_identities where profile_id = target_profile_id;
  end loop;
end;
$$;

update public.profiles
set
  username = '${OWNER_USERNAME}',
  display_name = 'P0 Demo 01',
  avatar_url = null,
  bio = 'P0 redline acceptance demo profile',
  public_top3 = null,
  public_visibility = 'public',
  onboarding_completed = true,
  deleted_at = null,
  deleted_by = null,
  delete_reason = null,
  exported_at = null,
  updated_at = now()
where auth_user_id = '${OWNER_AUTH_USER_ID}'::uuid;

update public.profiles
set
  username = '${OTHER_USERNAME}',
  display_name = 'P0 Other User',
  avatar_url = null,
  bio = null,
  public_top3 = null,
  public_visibility = 'public',
  onboarding_completed = true,
  deleted_at = null,
  deleted_by = null,
  delete_reason = null,
  exported_at = null,
  updated_at = now()
where auth_user_id = '${OTHER_AUTH_USER_ID}'::uuid;

insert into public.auth_identities (profile_id, provider, provider_user_id, email)
select id, 'github', '${OWNER_AUTH_USER_ID}', 'p0-redline-owner@example.com'
from public.profiles
where auth_user_id = '${OWNER_AUTH_USER_ID}'::uuid
on conflict (provider, provider_user_id) do update
set profile_id = excluded.profile_id, email = excluded.email, updated_at = now();

insert into public.auth_identities (profile_id, provider, provider_user_id, email)
select id, 'github', '${OTHER_AUTH_USER_ID}', 'p0-redline-other@example.com'
from public.profiles
where auth_user_id = '${OTHER_AUTH_USER_ID}'::uuid
on conflict (provider, provider_user_id) do update
set profile_id = excluded.profile_id, email = excluded.email, updated_at = now();

create temp table p0_owner_book(payload jsonb);
create temp table p0_owner_movie(payload jsonb);
create temp table p0_other_book(payload jsonb);
create temp table p0_export_job(payload jsonb);
create temp table p0_export_result(payload jsonb);
create temp table p0_public_checks(kind text, payload jsonb);

grant select, insert on p0_owner_book to anon, authenticated;
grant select, insert on p0_owner_movie to anon, authenticated;
grant select, insert on p0_other_book to anon, authenticated;
grant select, insert on p0_export_job to anon, authenticated;
grant select, insert on p0_export_result to anon, authenticated;
grant select, insert on p0_public_checks to anon, authenticated;

set role authenticated;
do $$ begin perform pg_temp.p0_set_auth_user('${OWNER_AUTH_USER_ID}'::uuid); end $$;

insert into p0_owner_book
select public.task14_create_book_entry_from_provider(
  'openlibrary',
  '${bookExternalId}',
  '${OWNER_BOOK_TITLE}',
  'finished',
  2026,
  null,
  'en',
  'P0 redline owner book description',
  null,
  '[{"source":"openlibrary","external_id":"${bookExternalId}"}]'::jsonb
);

insert into p0_owner_movie
select public.task15_create_movie_entry_from_provider(
  'tmdb',
  '${movieExternalId}',
  '${OWNER_MOVIE_TITLE}',
  'watched',
  45,
  2026,
  null,
  'en',
  'P0 redline owner movie description',
  null,
  120,
  '[{"source":"tmdb","external_id":"${movieExternalId}"}]'::jsonb
);

update public.user_entries
set
  rating_x10 = 45,
  review = 'P0 public review is safe.',
  visibility_scope = 'public',
  field_visibility_json = jsonb_build_object(
    'rating_x10', 'public',
    'rating', 'public',
    'review', 'public',
    'favorite', 'public',
    'finished_at', 'public'
  ),
  favorite = true,
  finished_at = now()
where id in (
  (select (payload ->> 'entry_id')::uuid from p0_owner_book),
  (select (payload ->> 'entry_id')::uuid from p0_owner_movie)
);

insert into public.user_private_notes(entry_id, note)
values ((select (payload ->> 'entry_id')::uuid from p0_owner_book), '${PRIVATE_NOTE}');

insert into public.tags(name, color, source)
values ('技术书', '#315f53', 'manual'), ('重读', '#8f4d2f', 'manual');

insert into public.entry_tags(entry_id, tag_id)
select (select (payload ->> 'entry_id')::uuid from p0_owner_book), id
from public.tags
where name in ('技术书', '重读');

select public.record_progress(
  (select (payload ->> 'entry_id')::uuid from p0_owner_book),
  'book_page_progress',
  'progress_set',
  '{"current_page":120,"total_pages":352}'::jsonb,
  now(),
  'manual',
  '今天一口气读到第 6 章',
  false
);

select public.task17_update_public_profile(
  'public',
  jsonb_build_array(
    jsonb_build_object('entry_id', (select payload ->> 'entry_id' from p0_owner_book)),
    jsonb_build_object('entry_id', (select payload ->> 'entry_id' from p0_owner_movie))
  )
);

do $$ begin perform pg_temp.p0_set_auth_user('${OTHER_AUTH_USER_ID}'::uuid); end $$;

insert into p0_other_book
select public.task14_create_book_entry_from_provider(
  'openlibrary',
  '${otherExternalId}',
  '${OTHER_BOOK_TITLE}',
  'finished',
  2026,
  null,
  'en',
  'P0 redline other book description',
  null,
  '[{"source":"openlibrary","external_id":"${otherExternalId}"}]'::jsonb
);

do $$ begin perform pg_temp.p0_set_auth_user('${OWNER_AUTH_USER_ID}'::uuid); end $$;

insert into p0_export_job
select public.task18_enqueue_mspf_export();

insert into p0_export_result
select public.task18_process_own_export_job(
  (select (payload ->> 'job_id')::uuid from p0_export_job)
);

reset role;

set role anon;
do $$ begin perform pg_temp.p0_set_auth_user(null); end $$;

insert into p0_public_checks
values
  ('profile', public.task17_get_public_profile('${OWNER_USERNAME}')),
  (
    'work',
    public.task17_get_public_work(
      (select (payload ->> 'work_id')::uuid from p0_owner_book),
      'p0-redline-owner-book'
    )
  );

reset role;

select jsonb_build_object(
  'owner_profile_id', (select id from public.profiles where auth_user_id = '${OWNER_AUTH_USER_ID}'::uuid),
  'book_entry_id', (select payload ->> 'entry_id' from p0_owner_book),
  'book_work_id', (select payload ->> 'work_id' from p0_owner_book),
  'movie_entry_id', (select payload ->> 'entry_id' from p0_owner_movie),
  'movie_work_id', (select payload ->> 'work_id' from p0_owner_movie),
  'export_job_id', (select payload ->> 'job_id' from p0_export_job),
  'mspf', (select payload -> 'mspf' from p0_export_result),
  'public_profile', (select payload from p0_public_checks where kind = 'profile'),
  'public_work', (select payload from p0_public_checks where kind = 'work')
)::text;
`;
}

function sqlForDeletion(exportJobId: string) {
  if (!/^[0-9a-f-]{36}$/i.test(exportJobId)) {
    throw new Error(`Invalid export job id from setup: ${exportJobId}`);
  }

  return String.raw`
set client_min_messages = warning;
set search_path = public, extensions;

create or replace function pg_temp.p0_set_auth_user(test_user uuid)
returns void
language plpgsql
as $$
begin
  if test_user is null then
    perform set_config('request.jwt.claims', '{}', false);
    perform set_config('request.jwt.claim.sub', '', false);
    perform set_config('request.jwt.claim.role', 'anon', false);
  else
    perform set_config(
      'request.jwt.claims',
      json_build_object('sub', test_user::text, 'role', 'authenticated')::text,
      false
    );
    perform set_config('request.jwt.claim.sub', test_user::text, false);
    perform set_config('request.jwt.claim.role', 'authenticated', false);
  end if;
end;
$$;

create temp table p0_delete_checks(kind text, payload jsonb);
grant select, insert on p0_delete_checks to anon, authenticated, service_role;

set role authenticated;
do $$ begin perform pg_temp.p0_set_auth_user('${OWNER_AUTH_USER_ID}'::uuid); end $$;

insert into p0_delete_checks
values (
  'request',
  public.task18_request_account_deletion('export_then_delete', 'DELETE', '${exportJobId}'::uuid)
);

reset role;

set role anon;
do $$ begin perform pg_temp.p0_set_auth_user(null); end $$;

insert into p0_delete_checks
values ('soft_state', public.task17_public_profile_state('${OWNER_USERNAME}'));

reset role;

update public.account_deletion_requests
set soft_delete_until = now() - interval '1 second'
where profile_id = (select id from public.profiles where auth_user_id = '${OWNER_AUTH_USER_ID}'::uuid)
  and status = 'soft_deleted';

set role service_role;

insert into p0_delete_checks
values ('processor', public.task18_process_due_account_deletions(10));

reset role;

set role anon;
do $$ begin perform pg_temp.p0_set_auth_user(null); end $$;

insert into p0_delete_checks
values ('hard_state', public.task17_public_profile_state('${OWNER_USERNAME}'));

reset role;

set role authenticated;
do $$ begin perform pg_temp.p0_set_auth_user('${OWNER_AUTH_USER_ID}'::uuid); end $$;

insert into p0_delete_checks
select 'same_auth_entries', jsonb_build_object('count', count(*)::integer)
from public.user_entries;

reset role;

select jsonb_build_object(
  'request_status', (select payload ->> 'status' from p0_delete_checks where kind = 'request'),
  'profile_state_after_soft_delete', (select payload ->> 'status' from p0_delete_checks where kind = 'soft_state'),
  'hard_deleted', coalesce((select (payload ->> 'hard_deleted')::integer from p0_delete_checks where kind = 'processor'), 0),
  'profile_state_after_hard_delete', (select payload ->> 'status' from p0_delete_checks where kind = 'hard_state'),
  'same_auth_entry_count', coalesce((select (payload ->> 'count')::integer from p0_delete_checks where kind = 'same_auth_entries'), -1),
  'private_note_count', (
    select count(*)::integer
    from public.user_private_notes
    where profile_id = (select id from public.profiles where auth_user_id = '${OWNER_AUTH_USER_ID}'::uuid)
  ),
  'progress_log_count', (
    select count(*)::integer
    from public.progress_logs
    where profile_id = (select id from public.profiles where auth_user_id = '${OWNER_AUTH_USER_ID}'::uuid)
  ),
  'tag_count', (
    select count(*)::integer
    from public.tags
    where profile_id = (select id from public.profiles where auth_user_id = '${OWNER_AUTH_USER_ID}'::uuid)
  ),
  'export_job_count', (
    select count(*)::integer
    from public.export_jobs
    where profile_id = (select id from public.profiles where auth_user_id = '${OWNER_AUTH_USER_ID}'::uuid)
  ),
  'auth_identity_count', (
    select count(*)::integer
    from public.auth_identities
    where profile_id = (select id from public.profiles where auth_user_id = '${OWNER_AUTH_USER_ID}'::uuid)
  )
)::text;
`;
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

function stringify(input: unknown) {
  return JSON.stringify(input);
}

function assertNoPublicLeak(label: string, payload: string) {
  assert(!payload.includes(PRIVATE_NOTE), `${label} leaked the full private note.`);
  assert(!payload.includes(PRIVATE_NOTE_FRAGMENT), `${label} leaked the private note fragment.`);
  assert(!/private_note/i.test(payload), `${label} exposed private_note.`);
  assert(!/user_private_notes/i.test(payload), `${label} exposed user_private_notes.`);
}

function assertPublicPayloads(setup: SetupResult) {
  const profile = stringify(setup.public_profile);
  const work = stringify(setup.public_work);

  assert(profile.includes(OWNER_BOOK_TITLE), "Public profile JSON is missing the owner book.");
  assert(profile.includes(OWNER_MOVIE_TITLE), "Public profile JSON is missing the owner movie.");
  assert(profile.includes("P0 public review is safe."), "Public profile JSON is missing public review.");
  assertNoPublicLeak("Public profile JSON", profile);
  assertNoPublicLeak("Public work JSON", work);
}

function assertMspf(input: unknown) {
  const schemaPath = new URL("../apps/web/lib/mspf/v1.0.0.schema.json", import.meta.url);
  const schema = JSON.parse(readFileSync(schemaPath, "utf8")) as unknown;
  const ajv = new Ajv2020({ allErrors: true });
  addFormats(ajv);

  const validate = ajv.compile(schema);
  if (!validate(input)) {
    const errors = (validate.errors ?? [])
      .map((error) => `${error.instancePath || "/"} ${error.message ?? "is invalid"}`)
      .join("; ");

    throw new Error(`MSPF validation failed: ${errors}`);
  }

  const text = stringify(input);
  const document = input as {
    private_notes?: Array<{ note?: string }>;
    progress_logs?: Array<{
      event_type?: string;
      payload_json?: {
        current_page?: number;
        total_pages?: number;
      };
    }>;
    tags?: Array<{ name?: string }>;
    works?: Array<{ canonical_title?: string; media_type?: string }>;
  };

  assert(text.includes(OWNER_BOOK_TITLE), "MSPF export is missing the owner book.");
  assert(text.includes(OWNER_MOVIE_TITLE), "MSPF export is missing the owner movie.");
  assert(
    Array.isArray(document.works) &&
      document.works.some((work) => work.media_type === "book" && work.canonical_title === OWNER_BOOK_TITLE) &&
      document.works.some((work) => work.media_type === "movie" && work.canonical_title === OWNER_MOVIE_TITLE),
    "MSPF export is missing required book/movie works.",
  );
  assert(
    Array.isArray(document.private_notes) &&
      document.private_notes.some((note) => note.note === PRIVATE_NOTE),
    "MSPF export is missing the owner private note.",
  );
  assert(
    Array.isArray(document.progress_logs) &&
      document.progress_logs.some(
        (log) =>
          log.event_type === "progress_set" &&
          log.payload_json?.current_page === 120 &&
          log.payload_json?.total_pages === 352,
      ),
    "MSPF export is missing the owner progress log.",
  );
  assert(
    Array.isArray(document.tags) &&
      document.tags.some((tag) => tag.name === "技术书") &&
      document.tags.some((tag) => tag.name === "重读"),
    "MSPF export is missing owner tags.",
  );
  assert(!text.includes(OTHER_BOOK_TITLE), "MSPF export includes another user's work.");
  assert(!text.includes(OTHER_USERNAME), "MSPF export includes another user's profile data.");
  assert(!SERVER_SECRET_PATTERN.test(text), "MSPF export contains a server secret-shaped value.");
}

function assertDeletion(result: DeletionResult) {
  assert(result.request_status === "soft_deleted", "Account deletion request did not soft-delete the profile.");
  assert(result.profile_state_after_soft_delete === "gone", "Soft-deleted public profile did not return gone.");
  assert(result.hard_deleted === 1, "Account deletion processor did not hard-delete one profile.");
  assert(result.profile_state_after_hard_delete === "gone", "Hard-deleted public profile did not return gone.");
  assert(result.same_auth_entry_count === 0, "Same auth user can still see old entries after deletion.");
  assert(result.private_note_count === 0, "Private notes remain after deletion.");
  assert(result.progress_log_count === 0, "Progress logs remain after deletion.");
  assert(result.tag_count === 0, "Tags remain after deletion.");
  assert(result.export_job_count === 0, "Export jobs remain after deletion.");
  assert(result.auth_identity_count === 0, "Auth identities remain after deletion.");
}

async function getAvailablePort() {
  return new Promise<number>((resolve, reject) => {
    const server = net.createServer();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      server.close(() => {
        if (address && typeof address === "object") {
          resolve(address.port);
        } else {
          reject(new Error("Could not allocate local port."));
        }
      });
    });
  });
}

function startWebServer(env: SupabaseLocalEnv, port: number) {
  const output: string[] = [];
  const child = spawn(
    "pnpm",
    ["--dir", "apps/web", "dev", "--hostname", "127.0.0.1", "--port", String(port)],
    {
      env: {
        ...process.env,
        NEXT_PUBLIC_APP_URL: `http://127.0.0.1:${port}`,
        NEXT_PUBLIC_SUPABASE_ANON_KEY: env.ANON_KEY,
        NEXT_PUBLIC_SUPABASE_URL: env.API_URL,
        NEXT_PUBLIC_SENTRY_DSN: "",
        SENTRY_AUTH_TOKEN: "",
        TMDB_API_KEY: "",
        UPSTASH_REDIS_REST_TOKEN: "",
        UPSTASH_REDIS_REST_URL: "",
      },
      detached: process.platform !== "win32",
      stdio: ["ignore", "pipe", "pipe"],
    },
  );

  const capture = (chunk: Buffer) => {
    output.push(chunk.toString("utf8"));
    if (output.length > 80) {
      output.splice(0, output.length - 80);
    }
  };

  child.stdout.on("data", capture);
  child.stderr.on("data", capture);

  return { child, output };
}

async function stopWebServer(child: ChildProcessWithoutNullStreams) {
  if (child.exitCode !== null || child.killed) {
    return;
  }

  const exited = new Promise<void>((resolve) => {
    child.once("exit", () => resolve());
  });

  try {
    if (process.platform !== "win32" && child.pid) {
      process.kill(-child.pid, "SIGTERM");
    } else {
      child.kill("SIGTERM");
    }
  } catch {
    child.kill("SIGTERM");
  }

  await Promise.race([exited, delay(5_000)]);

  if (child.exitCode === null && !child.killed) {
    try {
      if (process.platform !== "win32" && child.pid) {
        process.kill(-child.pid, "SIGKILL");
      } else {
        child.kill("SIGKILL");
      }
    } catch {
      // The process may have exited between the timeout and the kill attempt.
    }
  }
}

async function fetchWithRetry(url: string, expected: (response: Response) => boolean) {
  const startedAt = Date.now();
  let lastError: unknown;

  while (Date.now() - startedAt < 60_000) {
    try {
      const response = await fetch(url, {
        headers: {
          "User-Agent": "p0-redline-acceptance",
        },
      });

      if (expected(response)) {
        return response;
      }

      lastError = new Error(`Unexpected HTTP ${response.status} for ${url}`);
    } catch (error) {
      lastError = error;
    }

    await delay(1_000);
  }

  throw lastError instanceof Error ? lastError : new Error(`Timed out fetching ${url}`);
}

async function assertHtmlBeforeDeletion(baseUrl: string) {
  const response = await fetchWithRetry(`${baseUrl}/u/${OWNER_USERNAME}`, (candidate) => candidate.status === 200);
  const html = await response.text();

  assert(html.includes(OWNER_BOOK_TITLE), "Public HTML is missing the owner book.");
  assert(html.includes(OWNER_MOVIE_TITLE), "Public HTML is missing the owner movie.");
  assert(html.includes("4.5"), "Public HTML is missing the public rating.");
  assert(html.includes("精选 Top-3"), "Public HTML is missing Top-3 content.");
  assertNoPublicLeak("Public HTML", html);
}

async function assertHtmlAfterDeletion(baseUrl: string) {
  const response = await fetchWithRetry(`${baseUrl}/u/${OWNER_USERNAME}`, (candidate) =>
    [404, 410].includes(candidate.status),
  );
  const html = await response.text();

  assertNoPublicLeak("Deleted public profile response", html);
}

function runPlaywrightScreenshot(url: string, outputPath: string) {
  execFileSync(
    "npx",
    [
      "--yes",
      "playwright",
      "screenshot",
      "--browser",
      "chromium",
      "--viewport-size",
      "1280,900",
      "--full-page",
      "--wait-for-timeout",
      "1000",
      url,
      outputPath,
    ],
    {
      encoding: "utf8",
      maxBuffer: 1024 * 1024 * 10,
      stdio: ["ignore", "pipe", "pipe"],
    },
  );
}

function captureScreenshot(url: string, outputPath: string) {
  try {
    runPlaywrightScreenshot(url, outputPath);
  } catch {
    execFileSync("npx", ["--yes", "playwright", "install", "chromium"], {
      encoding: "utf8",
      maxBuffer: 1024 * 1024 * 20,
      stdio: ["ignore", "pipe", "pipe"],
    });
    runPlaywrightScreenshot(url, outputPath);
  }
}

function writeAcceptanceArtifacts({
  deletion,
  paths,
  setup,
}: {
  deletion: DeletionResult;
  paths: ArtifactPaths;
  setup: SetupResult;
}) {
  mkdirSync(ACCEPTANCE_DIR, { recursive: true });
  writeFileSync(paths.mspfJson, `${JSON.stringify(setup.mspf, null, 2)}\n`, "utf8");

  const runMarkdown = `# P0 Acceptance Run ${shanghaiDate()}

## Source

- P0 acceptance script: steps 11, 12, and 13.
- Test account: local demo profile \`${OWNER_USERNAME}\`.
- Environment: local Supabase only; script refuses non-local \`API_URL\` and \`DB_URL\`.

## Checklist

- [x] Step 11: anonymous public JSON and rendered \`/u/${OWNER_USERNAME}\` HTML do not expose \`${PRIVATE_NOTE_FRAGMENT}\`, \`private_note\`, or \`user_private_notes\`.
- [x] Step 12: MSPF validates with AJV and includes demo book, movie, progress, private note, and tags.
- [x] Step 12: MSPF excludes other-user data and server secret-shaped values.
- [x] Step 13: export-then-delete returns public profile state \`${deletion.profile_state_after_soft_delete}\` after soft delete.
- [x] Step 13: hard deletion processed \`${deletion.hard_deleted}\` profile and the same auth user sees \`${deletion.same_auth_entry_count}\` old entries.
- [x] Step 13: private notes, progress logs, tags, export jobs, and auth identities are removed.

## Screenshots

- Public page before deletion: [${paths.publicScreenshot}](./${paths.publicScreenshot.split("/").pop()})
- Deleted page after export-then-delete: [${paths.deletedScreenshot}](./${paths.deletedScreenshot.split("/").pop()})

## MSPF Sample

- [${paths.mspfJson}](./${paths.mspfJson.split("/").pop()})

## Script Output

\`\`\`text
P0 redline acceptance passed:
- Step 11 public JSON and /u/${OWNER_USERNAME} HTML do not expose private notes.
- Step 12 MSPF validates with AJV and excludes other-user data and server secrets.
- Step 13 export-then-delete makes /u/${OWNER_USERNAME} unavailable and removes old owner data.
\`\`\`
`;

  writeFileSync(paths.runMarkdown, runMarkdown, "utf8");
}

async function main() {
  requireCommand("psql");
  requireCommand("supabase");
  requireCommand("pnpm");

  const env = readLocalSupabaseEnv();
  const token = runToken();
  const setup = runPsql<SetupResult>(env.DB_URL, sqlForSetup(token));
  const paths = WRITE_ARTIFACTS ? artifactPaths() : null;

  assertPublicPayloads(setup);
  assertMspf(setup.mspf);

  const port = await getAvailablePort();
  const server = startWebServer(env, port);
  const baseUrl = `http://127.0.0.1:${port}`;

  try {
    await assertHtmlBeforeDeletion(baseUrl);
    if (paths) {
      mkdirSync(ACCEPTANCE_DIR, { recursive: true });
      captureScreenshot(`${baseUrl}/u/${OWNER_USERNAME}`, paths.publicScreenshot);
    }

    const deletion = runPsql<DeletionResult>(env.DB_URL, sqlForDeletion(setup.export_job_id));
    assertDeletion(deletion);

    await assertHtmlAfterDeletion(baseUrl);
    if (paths) {
      captureScreenshot(`${baseUrl}/u/${OWNER_USERNAME}`, paths.deletedScreenshot);
      writeAcceptanceArtifacts({ deletion, paths, setup });
    }
  } catch (error) {
    const logs = server.output.join("").trim().split(/\r?\n/).slice(-30).join("\n");
    if (logs) {
      console.error("\nLast web server lines:\n" + logs);
    }
    throw error;
  } finally {
    await stopWebServer(server.child);
  }

  console.log("P0 redline acceptance passed:");
  console.log("- Step 11 public JSON and /u/demo01 HTML do not expose private notes.");
  console.log("- Step 12 MSPF validates with AJV and excludes other-user data and server secrets.");
  console.log("- Step 13 export-then-delete makes /u/demo01 unavailable and removes old owner data.");
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
