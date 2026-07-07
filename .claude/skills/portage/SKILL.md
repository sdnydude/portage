```markdown
# portage Development Patterns

> Auto-generated skill from repository analysis

## Overview
This skill introduces the core development patterns and conventions used in the `portage` TypeScript codebase. You'll learn how to structure files, write imports/exports, follow commit conventions, and implement and test features using the project's established practices.

## Coding Conventions

### File Naming
- Use **kebab-case** for all file names.
  - Example:  
    ```
    user-profile.ts
    data-fetcher.tsx
    ```

### Import Style
- Use **alias imports** for modules.
  - Example:
    ```typescript
    import { fetchData } from '@/utils/data-fetcher';
    ```

### Export Style
- Use **named exports** instead of default exports.
  - Example:
    ```typescript
    // In user-profile.ts
    export function UserProfile() { ... }
    ```

### Commit Messages
- Follow **conventional commits** with the `feat` prefix for features.
  - Example:
    ```
    feat: add user authentication to login page
    ```

## Workflows

### Feature Development
**Trigger:** When adding a new feature  
**Command:** `/feature-dev`

1. Create a new file using kebab-case naming.
2. Implement the feature using TypeScript.
3. Use alias imports for dependencies.
4. Export your functions/components using named exports.
5. Write corresponding tests in a `.test.tsx` file.
6. Commit your changes using a conventional commit message with the `feat` prefix.

### Testing
**Trigger:** When verifying code correctness  
**Command:** `/test`

1. Write tests in files matching the `*.test.tsx` pattern.
2. Use the `vitest` testing framework.
3. Run tests using the project's test script (e.g., `pnpm test` or `npm run test`).

## Testing Patterns

- All tests are written using **vitest**.
- Test files are named with the `.test.tsx` suffix and placed alongside the code they test.
  - Example:
    ```
    user-profile.test.tsx
    ```
- Example test structure:
    ```typescript
    import { describe, it, expect } from 'vitest';
    import { UserProfile } from './user-profile';

    describe('UserProfile', () => {
      it('renders correctly', () => {
        // test implementation
      });
    });
    ```

## Commands
| Command        | Purpose                                      |
|----------------|----------------------------------------------|
| /feature-dev   | Guide for adding a new feature               |
| /test          | Steps for writing and running tests          |
```
