# Auto-capture test coverage changes to registry

After any work that **adds, removes, or modifies test files**, immediately post a test coverage change event to the registry.

## When to trigger

- After any commit that adds, removes, or modifies test files (files matching `*.test.ts`, `*.test.tsx`, `*.spec.ts`, `__tests__/`)
- After a `/ship` build phase that includes test changes
- After a code health review that changes test counts
- After a bug fix that adds regression tests
- After a new feature that includes test coverage

## When NOT to trigger

- Trivial test file formatting or comment-only changes
- Renaming a test without changing behavior
- Changes to test infrastructure (config files, fixtures) with no test count change

## What to capture

```bash
~/.claude/scripts/post-test-coverage.sh '{"title":"<short description, max 280 chars>","test_count_before":<int>,"test_count_after":<int>,"delta":<int, can be negative>,"tests_added":["<test name/description>"],"tests_removed":["<test name/description>"],"tests_modified":["<test name/description>"],"files_affected":["<file path>"],"category":"<category>","trigger":"<what prompted this change>","project_name":"portage","tags":["<tag1>","<tag2>"],"model_name":"claude-opus-4-6"}'
```

### Field guide

| Field | Description |
|-------|-------------|
| `title` | Short summary of what changed (max 280 chars). E.g., "Add password policy + admin guard tests" |
| `test_count_before` | Total test count before this change. Get from `npm run test:api` output or last known count |
| `test_count_after` | Total test count after this change |
| `delta` | Net change (`test_count_after - test_count_before`). Can be negative for test removals |
| `tests_added` | Array of new test names/descriptions. E.g., `["password min length validation", "admin guard rejects non-admin"]` |
| `tests_removed` | Array of removed test names. Empty array `[]` if none removed |
| `tests_modified` | Array of modified test names. Empty array `[]` if none modified |
| `files_affected` | Array of file paths that were modified |
| `category` | One of the valid categories below |
| `trigger` | What prompted this change. E.g., "PR #66 deferred items", "new feature: onboarding", "bug fix: auth race condition" |

## Category values

Use one of: `unit`, `integration`, `e2e`, `api`, `auth`, `admin`, `marketplace`, `security`, `performance`, `other`

| Category | When to use |
|----------|-------------|
| `unit` | Pure unit tests with no external dependencies |
| `integration` | Tests that span multiple modules or hit a database |
| `e2e` | End-to-end / browser / Playwright tests |
| `api` | API route handler tests |
| `auth` | Authentication and authorization tests |
| `admin` | Admin panel and admin-specific functionality tests |
| `marketplace` | eBay, Etsy, Reverb adapter or marketplace sync tests |
| `security` | Security-focused tests (XSS, injection, encryption, etc.) |
| `performance` | Performance benchmarks and load tests |
| `other` | Does not fit any category above |

## Rules

- Fire-and-forget -- don't stop work if the registry is down
- Don't ask permission to post -- this is automated capture
- Keep title under 280 chars
- Escape quotes in the JSON payload
- Always include `files_affected` -- even a single file
- Use the actual test count from test runner output when available; if not, use the last known count from MEMORY.md
- For bulk changes (e.g., code health review touching 5 test files), capture as a single event with the aggregate delta
- Include tags that would help future semantic search (e.g., `["auth", "password-policy"]`, `["marketplace", "ebay"]`)
- The `trigger` field helps correlate test changes with the work that caused them -- always fill it in
