# Branch Naming Convention

> **Purpose**: Guide for AI and developers to create consistent branch names

---

## Observed Patterns (from existing branches)

Based on analysis of remote branches in this repository:

| Pattern | Example | Usage |
|---------|---------|-------|
| `feat--<description>` | `feat--password-strength-helper` | New features |
| `feat/<description>` | `seer/feat/indexeddb-error-handling` | New features (alt) |
| `fix--<description>` | `fix--actions-vetegories-with-backslash` | Bug fixes |
| `fix/<description>` | `fix/no-access-to-dossier-in-rencontres` | Bug fixes (alt) |
| `chore--<description>` | `chore--logs-for-aborterror` | Maintenance tasks |
| `chore/<description>` | `chore/redesign-import-config-with-details` | Maintenance (alt) |
| `test-<description>` | `test-datamanagement` | Test-related changes |
| `<simple-description>` | `documents-all`, `zustand` | Simple feature names |

---

## Recommended Convention

### Format
```
<type>/<short-description>
```

### Types

Based on the [Conventional Commits](https://www.conventionalcommits.org/) specification:

- **feat**: A new feature for the user.
- **fix**: A bug fix for the user.
- **refactor**: A code change that neither fixes a bug nor adds a feature.
- **chore**: Changes to the build process or auxiliary tools and libraries. Does not modify application code.
- **style**: Changes that do not affect the meaning of the code (white-space, formatting, etc).
- **perf**: A code change that improves performance.
- **test**: Adding missing tests or correcting existing tests.
- **docs**: Documentation only changes.
- **ci**: Changes to CI configuration files and scripts.
- **build**: Changes that affect the build system or external dependencies.

### Rules
1. Use **kebab-case** (lowercase, hyphens between words)
2. Keep descriptions **short but meaningful** (3-5 words max)
3. Use `/` as separator (more common in modern Git workflows)
4. Reference PR number if applicable: `feat/pr1-spinner-alert`

---

## Branch Names for Migration PRs

| PR | Branch Name | Description |
|----|-------------|-------------|
| PR-1 | `feat/pr1-feedback-spinner-alert` | Replace Spinner and Alert from reactstrap |
| PR-2 | `feat/pr2-forms-input-label` | Replace Input and Label from reactstrap |
| PR-3 | `feat/pr3-layout-row-col-formgroup` | Replace Row, Col, FormGroup |
| PR-4 | `feat/pr4-modals` | Replace Modal components |
| PR-5 | `feat/pr5-dropdowns` | Replace Dropdown components |
| PR-6 | `chore/pr6-bootstrap-cleanup` | Remove Bootstrap dependencies |
| PR-7 | `chore/pr7-scss-to-css` | Convert SCSS to CSS |

---

## AI Instructions

When creating a branch for a task or PR:

1. **Check existing branches** first:
   ```bash
   git branch -a
   ```

2. **Determine the type** based on the task:
   - Adding/replacing components → `feat`
   - Fixing bugs → `fix`
   - Code restructuring with no functional change → `refactor`
   - Build scripts, dependency updates, etc. → `chore`

3. **Create the branch**:
   ```bash
   git checkout -b <type>/<pr-number>-<short-description>
   ```

4. **Example for PR-1**:
   ```bash
   git checkout -b feat/pr1-feedback-spinner-alert
   ```

5. **Verify you're on the new branch**:
   ```bash
   git branch
   ```
