```markdown
# portage Development Patterns

> Auto-generated skill from repository analysis

## Overview
This skill teaches the core development patterns, coding conventions, and workflows used in the `portage` TypeScript codebase. It covers file naming, import/export styles, commit conventions, documentation workflows, and testing patterns, providing practical examples and ready-to-use commands for contributors.

## Coding Conventions

### File Naming
- **Style:** kebab-case
- **Example:**  
  ```
  user-profile.ts
  data-fetcher.test.ts
  ```

### Import Style
- **Relative imports are used.**
- **Example:**
  ```typescript
  import { fetchData } from './data-fetcher';
  ```

### Export Style
- **Named exports are preferred.**
- **Example:**
  ```typescript
  // In utils/math.ts
  export function add(a: number, b: number): number {
    return a + b;
  }
  ```

### Commit Messages
- **Conventional commit style.**
- **Prefix:** `docs`
- **Average length:** ~56 characters
- **Example:**
  ```
  docs: add research notes for async data fetching
  ```

## Workflows

### Add New Research or Design Doc
**Trigger:** When you want to document research findings or design specifications for a new feature or technical investigation.  
**Command:** `/new-research-doc`

1. Create a new markdown file in `docs/research/` or `docs/superpowers/specs/` with a date-based filename.
   - Example: `docs/research/2024-06-15-async-fetching.md`
2. Write your research notes or design specs in the new file.
3. Commit the new file with a descriptive message.
   - Example commit:
     ```
     docs: add async data fetching research doc
     ```

## Testing Patterns

- **Test files:** Use the pattern `*.test.*` (e.g., `user-profile.test.ts`)
- **Testing framework:** Not explicitly specified; follow standard TypeScript testing practices.
- **Example test file:**
  ```typescript
  // user-profile.test.ts
  import { getUserProfile } from './user-profile';

  describe('getUserProfile', () => {
    it('returns user data for valid ID', () => {
      // test implementation
    });
  });
  ```

## Commands

| Command            | Purpose                                                        |
|--------------------|----------------------------------------------------------------|
| /new-research-doc  | Start a new research or design specification document workflow |
```
