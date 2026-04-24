status: in_progress
phase: 3
feature: GitHub repo setup — README, CLAUDE.md, CI/CD, branch protection, templates, dependabot, .DS_Store cleanup
approach: Production-grade public repo (GitHub-native, no third-party CI)
complexity: complex (>5 tasks, low risk)
spec: |
  Adds .github/ infrastructure (CI workflow, dependabot, PR/issue templates),
  README.md, CLAUDE.md, branch protection on main, .DS_Store cleanup.
  No release automation, no Docker publishing, no CodeQL, no CODEOWNERS.
  CI: lint + typecheck (api + web) + tests on push/PR.
  Dependabot: weekly npm updates.
  Branch protection: require CI pass for main.

file_map: |
  Create:
    - .github/workflows/ci.yml
    - .github/dependabot.yml
    - .github/pull_request_template.md
    - .github/ISSUE_TEMPLATE/bug_report.yml
    - .github/ISSUE_TEMPLATE/feature_request.yml
    - README.md
    - CLAUDE.md
  Modify:
    - .gitignore (add ._* pattern)
  Delete:
    - ._.DS_Store
  GitHub API:
    - Branch protection on main

patterns: |
  - Root scripts: lint, typecheck, test:api, test:all, build
  - API: vitest configured but 0 test files
  - Web: eslint flat config, tsc --noEmit
  - Node 20 (.nvmrc), postgres:15-alpine
  - Ports: 5436 (db), 8016 (api), 3002 (web)
