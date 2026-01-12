# Migration Plan: Bootstrap → Tailwind CSS

## Project Mission
Refactor the web application by executing two primary transformations:
1.  **Total Bootstrap Removal**: Completely eliminate all Bootstrap/Reactstrap dependencies, replacing them with Tailwind CSS while maintaining strict design integrity and responsiveness.
2.  **SCSS to CSS Conversion**: Identify and convert all SCSS styles to native CSS.


---

## Task Execution Workflow

### 1. Setup
1. Read the task description 
2. Review all component inventory in `01_component_inventory.md`
3. Review SCSS inventory in `02_scss_inventory.md`


### 2. For Each PR Task
1. Sync with the upstream `main` branch (complete fork sync):
   ```bash
   # Fetch the latest changes from the original repository
   git fetch upstream
   # Switch to your local main branch
   git checkout main
   # If merge conflicts occur due to local debugging changes (e.g., --assume-unchanged files):
   # First undo any assume-unchanged flags: git update-index --no-assume-unchanged <file>
   # Then reset hard if needed: git reset --hard upstream/main
   # Otherwise, merge normally:
   git merge upstream/main
   # CRITICAL: Push updated main to your GitHub fork
   git push origin main
   ```
   ⚠️ **Important**: Never commit local debugging changes to `main`. Use feature branches only.
2. Create a properly named branch following the branch naming guide
   ```bash
   git checkout -b <type>/<pr-number>-<description>
   # Example: git checkout -b feat/pr2-forms-input-label
   ```
   * Refer to `branch_naming_guide.md` for conventions
   * Use `feat/` prefix for component replacements
   * Use `chore/` prefix for cleanup tasks

2. Implement the required changes
   * Follow the detailed task checklist for each PR. If you have new insights and you think the task scope should be expanded, update the task description and proceed
   * Ensure all specified files are modified

3. Test your changes
   * Complete all checks in the Testing Protocol section
   * Run Playwright tests: `npx playwright test --ui`
   * Fix any failing tests before proceeding

4. Code review and PR preparation
   * Run code quality checks
   * Create a code review document using `finish_task.md` protocol (Streamlined)
   * Execute: `git diff <first_commit>..HEAD` to review all changes
   * Generate PR summary

5. Finalize
   * Update task status in the overview table (add checkmarks)
   * Submit PR following the project's process

---



# PR Plan (Bootstrap → Tailwind + SCSS → CSS)


## PR-1 — Feedback (Spinner, Alert)
Replace `Spinner` and `Alert` usages from `reactstrap` with Tailwind-based equivalents in the dashboard. This covers loading states and import/report feedback messages.

## PR-2 — Forms (Input, Label)
Replace `Input` and `Label` from `reactstrap` with native form elements styled using Tailwind (with the existing `@tailwindcss/forms` setup). This focuses on the team and territory list scenes.

## PR-3 — Layout (Row, Col, FormGroup)
Remove `Row`, `Col`, and `FormGroup` from `reactstrap` and recreate layouts using Tailwind flex/grid utilities. This targets the dashboard’s grid/form layout in the team and territory list scenes.

## PR-4 — Modals
Replace `Modal`, `ModalHeader`, and `ModalBody` from `reactstrap` with a Tailwind-styled modal built on `@headlessui/react` Dialog (accessibility + focus management). This includes modals in team/territory management and data import flows.

## PR-5 — Dropdowns
Replace `ButtonDropdown`, `DropdownToggle`, `DropdownMenu`, and `DropdownItem` from `reactstrap` with a Tailwind-styled dropdown using `@headlessui/react` Menu. This focuses on the dashboard top navigation (`TopBar`).

## PR-6 — Bootstrap cleanup
Remove remaining Bootstrap entry points/usages: delete the Bootstrap CSS import, remove the Bootstrap SCSS import + theme overrides, and replace any remaining Bootstrap classnames (e.g. `btn btn-primary`). Then remove `bootstrap` and `reactstrap` dependencies.

## PR-7 — SCSS → CSS
Convert the remaining SCSS stylesheet to plain CSS (flatten nesting, convert SCSS-only comment syntax), rename `index.scss` to `index.css`, update imports, and remove the `sass` dependency.


| Phase | PR | Component Group | Files | Estimated Effort | Merged? |
|-------|-----|-----------------|-------|------------------|-------|
| 1 | PR-1 | Feedback (Spinner, Alert) | 5 | Small | ✅ |
| 2 | PR-2 | Forms (Input, Label) | 2 | Small | ✅ |
| 3 | PR-3 | Layout (Row, Col, FormGroup) | 2 | Medium |  |
| 4 | PR-4 | Modals | 5 | Medium |  |
| 5 | PR-5 | Dropdowns | 1 | Medium |
| 6 | PR-6 | Bootstrap Cleanup | 3 | Small |
| 7 | PR-7 | SCSS → CSS | 1 | Small |

---

## PR-1: Feedback Components (Spinner, Alert)

### Scope
Replace `Spinner` and `Alert` from reactstrap with Tailwind-styled equivalents.

### Files to Modify
1. `dashboard/src/components/ButtonCustom.tsx` — uses `Spinner`
2. `dashboard/src/scenes/report/components/ServicesReport.jsx` — uses `Spinner`
3. `dashboard/src/scenes/data-import-export/ImportPersons.jsx` — uses `Alert`
4. `dashboard/src/scenes/data-import-export/ImportStructures.jsx` — uses `Alert`
5. `dashboard/src/scenes/data-import-export/ImportTerritories.jsx` — uses `Alert`

### Tasks
- [v] Create `Spinner` component with Tailwind (animated SVG or CSS spinner)
- [v] Create `Alert` component with Tailwind (variants: info, warning, error, success)
- [v] Replace imports in all 5 files
- [v] Remove unused reactstrap imports
- [v] Visual verification

### Tailwind Implementation Notes

**Spinner**: Use Tailwind animation utilities
```
tw-animate-spin tw-rounded-full tw-border-2 tw-border-main tw-border-t-transparent
```

**Alert**: Use Tailwind background/border colors
```
tw-rounded tw-border tw-p-4 tw-text-sm
// Variants:
// info: tw-bg-blue-50 tw-border-blue-200 tw-text-blue-800
// warning: tw-bg-yellow-50 tw-border-yellow-200 tw-text-yellow-800
// error: tw-bg-red-50 tw-border-red-200 tw-text-red-800
```

### Testing Protocol
- [v] Visual check: Spinner animation appears correctly
- [v] Visual check: Alert colors match original Bootstrap styling
- [v] Functional: Loading states work in ButtonCustom
- [v] Functional: Import error messages display correctly
- [v] Run existing Playwright tests for data-import flows

---

## PR-2: Form Components (Input, Label)

### Scope
Replace `Input` and `Label` from reactstrap with native HTML + Tailwind.

### Files to Modify
1. `dashboard/src/scenes/territory/list.jsx`
2. `dashboard/src/scenes/team/list.jsx`

### Tasks
- [ ] Replace `<Input>` with `<input className="...tailwind...">` 
- [ ] Replace `<Label>` with `<label className="...tailwind...">`
- [ ] Use `@tailwindcss/forms` plugin classes (already configured)
- [ ] Remove unused reactstrap imports
- [ ] Visual verification

### Tailwind Implementation Notes

**Input**: Use form-input class from @tailwindcss/forms
```
tw-block tw-w-full tw-rounded tw-border tw-border-gray-300 tw-px-3 tw-py-2 tw-text-sm focus:tw-border-main focus:tw-ring-main
```

**Label**: 
```
tw-block tw-text-sm tw-font-medium tw-text-gray-700 tw-mb-1
```

### Testing Protocol
- [ ] Visual check: Input fields render correctly
- [ ] Visual check: Labels properly associated with inputs
- [ ] Functional: Form submission works in territory/team creation
- [ ] Run Playwright tests: `territories_*.spec.ts`, team-related tests

---

## PR-3: Layout Components (Row, Col, FormGroup)

### Scope
Replace `Row`, `Col`, `FormGroup` with Tailwind flex/grid utilities.

### Files to Modify
1. `dashboard/src/scenes/territory/list.jsx`
2. `dashboard/src/scenes/team/list.jsx`

### Tasks
- [ ] Replace `<Row>` with `<div className="tw-flex tw-flex-wrap">`
- [ ] Replace `<Col>` with `<div className="tw-w-full md:tw-w-1/2">` (or appropriate width)
- [ ] Replace `<FormGroup>` with `<div className="tw-mb-4">`
- [ ] Remove unused reactstrap imports
- [ ] Visual verification

### Tailwind Implementation Notes

**Row equivalent**:
```
tw-flex tw-flex-wrap -tw-mx-2
```

**Col equivalents** (based on Bootstrap col-* sizes):
- `col-12` → `tw-w-full tw-px-2`
- `col-6` → `tw-w-full md:tw-w-1/2 tw-px-2`
- `col-4` → `tw-w-full md:tw-w-1/3 tw-px-2`
- `col-3` → `tw-w-full md:tw-w-1/4 tw-px-2`

**FormGroup equivalent**:
```
tw-mb-4
```

### Testing Protocol
- [ ] Visual check: Form layouts match original spacing
- [ ] Visual check: Responsive behavior at mobile/tablet/desktop
- [ ] Functional: Forms still work correctly
- [ ] Run Playwright tests at different viewport sizes

---

## PR-4: Modal Components

### Scope
Replace `Modal`, `ModalHeader`, `ModalBody` with Headless UI Dialog (already installed) or custom Tailwind modal.

### Files to Modify
1. `dashboard/src/scenes/territory/list.jsx`
2. `dashboard/src/scenes/team/list.jsx`
3. `dashboard/src/scenes/data-import-export/ImportPersons.jsx`
4. `dashboard/src/scenes/data-import-export/ImportStructures.jsx`
5. `dashboard/src/scenes/data-import-export/ImportTerritories.jsx`

### Tasks
- [ ] Create/use Modal component based on `@headlessui/react` Dialog
- [ ] Style with Tailwind (backdrop, panel, header, body)
- [ ] Replace imports in all 5 files
- [ ] Ensure accessibility (focus trap, escape key, aria attributes)
- [ ] Remove unused reactstrap imports
- [ ] Visual verification

### Tailwind Implementation Notes

Use `@headlessui/react` Dialog component (already in dependencies):

**Modal wrapper**:
```
Dialog: tw-fixed tw-inset-0 tw-z-50 tw-overflow-y-auto
Backdrop: tw-fixed tw-inset-0 tw-bg-black/30
Panel: tw-mx-auto tw-max-w-lg tw-rounded tw-bg-white tw-p-6 tw-shadow-xl
```

**ModalHeader**:
```
tw-mb-4 tw-text-lg tw-font-medium tw-text-gray-900
```

**ModalBody**:
```
tw-text-sm tw-text-gray-500
```

### Testing Protocol
- [ ] Visual check: Modal appears centered with backdrop
- [ ] Functional: Modal opens/closes correctly
- [ ] Accessibility: Focus trapped inside modal, Escape closes it
- [ ] Run Playwright tests for territory, team, and import flows
- [ ] Test at mobile viewport (modal should be responsive)

---

## PR-5: Dropdown Components

### Scope
Replace `ButtonDropdown`, `DropdownToggle`, `DropdownMenu`, `DropdownItem` with Headless UI Menu.

### Files to Modify
1. `dashboard/src/components/TopBar.jsx`

### Tasks
- [ ] Replace with `@headlessui/react` Menu component
- [ ] Style with Tailwind
- [ ] Ensure keyboard navigation works
- [ ] Remove unused reactstrap imports
- [ ] Visual verification

### Tailwind Implementation Notes

Use `@headlessui/react` Menu component:

**Menu.Button**:
```
tw-inline-flex tw-items-center tw-gap-2 tw-rounded tw-bg-main tw-px-3 tw-py-2 tw-text-sm tw-text-white hover:tw-bg-main75
```

**Menu.Items**:
```
tw-absolute tw-right-0 tw-mt-2 tw-w-56 tw-origin-top-right tw-rounded tw-bg-white tw-shadow-lg tw-ring-1 tw-ring-black/5 focus:tw-outline-none
```

**Menu.Item**:
```
tw-block tw-px-4 tw-py-2 tw-text-sm tw-text-gray-700 hover:tw-bg-gray-100
```

### Testing Protocol
- [ ] Visual check: Dropdown appears below button, aligned correctly
- [ ] Functional: Click opens/closes dropdown
- [ ] Accessibility: Arrow keys navigate items, Enter selects
- [ ] Run Playwright tests involving navigation/logout flows

---

## PR-6: Bootstrap Cleanup

### Scope
Remove all remaining Bootstrap dependencies and direct CSS class usage.

### Files to Modify
1. `dashboard/src/index.jsx` — remove `import "bootstrap/dist/css/bootstrap.min.css"`
2. `dashboard/src/index.scss` — remove `@import "bootstrap/scss/bootstrap.scss"` and `$theme-colors`
3. `dashboard/src/scenes/organisation/DefaultFolders.tsx` — replace `btn btn-primary` class

### Tasks
- [ ] Remove Bootstrap CSS import from `index.jsx`
- [ ] Remove Bootstrap SCSS import from `index.scss`
- [ ] Remove `$theme-colors` SCSS variable
- [ ] Replace `btn btn-primary` with Tailwind classes in `DefaultFolders.tsx`
- [ ] Remove `bootstrap` and `reactstrap` from `package.json`
- [ ] Run `yarn install` to update lock file
- [ ] Full visual regression test

### Tailwind Implementation Notes

**btn btn-primary replacement**:
```
tw-inline-flex tw-items-center tw-rounded tw-bg-main tw-px-4 tw-py-2 tw-text-sm tw-font-medium tw-text-white hover:tw-bg-main75 focus:tw-outline-none focus:tw-ring-2 focus:tw-ring-main focus:tw-ring-offset-2
```

Or use existing `.button-submit` class from `index.scss`.

### Testing Protocol
- [ ] Full Playwright test suite
- [ ] Visual spot-check of all major pages
- [ ] Verify no Bootstrap classes remain (search codebase)
- [ ] Verify bundle size decreased

---

## PR-7: SCSS → CSS Migration

### Scope
Convert `index.scss` to plain CSS and remove sass dependency.

### Files to Modify
1. `dashboard/src/index.scss` → rename to `dashboard/src/index.css`
2. `dashboard/src/index.jsx` — update import
3. `dashboard/package.json` — remove `sass` dependency

### Tasks
- [ ] Flatten all SCSS nesting to standard CSS selectors
- [ ] Convert `//` comments to `/* */` format
- [ ] Rename file to `.css`
- [ ] Update import in `index.jsx`
- [ ] Remove `sass` from dependencies
- [ ] Run `yarn install`
- [ ] Visual verification

### Nesting Conversion Examples

**Before (SCSS)**:
```scss
table.table-selego {
  thead tr {
    height: 2.5rem;
  }
}
```

**After (CSS)**:
```css
table.table-selego thead tr {
  height: 2.5rem;
}
```

### Testing Protocol
- [ ] Visual check: All styles still apply correctly
- [ ] No console errors about missing styles
- [ ] Full Playwright test suite

---

## Visual Regression Testing Plan

### Key User Journeys to Test
- [ ] Login flow
- [ ] Dashboard/home page
- [ ] Person list and detail views
- [ ] Team/territory management
- [ ] Data import flows
- [ ] Reports

### Complex Components to Test
- [ ] Modals (all types)
- [ ] Dropdowns (TopBar navigation)
- [ ] Forms with validation states
- [ ] Tables (table-selego)
- [ ] Loading spinners
- [ ] Alert messages

### Responsive Breakpoints
- [ ] Mobile: 375px width
- [ ] Tablet: 768px width
- [ ] Desktop: 1280px width

### Playwright Visual Testing
Create visual regression tests before starting migration:
1. Capture baseline screenshots of key pages
2. After each PR, compare against baseline
3. Update baseline only when changes are intentional

---

## Dependencies to Remove (Final)

```json
// dashboard/package.json - remove from dependencies:
"bootstrap": "4.6.2",
"reactstrap": "8.10.1",
"sass": "1.54.9"
```

---

## Post-Migration Verification Checklist

- [ ] No imports from `reactstrap` remain
- [ ] No imports of `bootstrap` CSS remain
- [ ] No `$theme-colors` or other SCSS variables remain
- [ ] No `.scss` files remain (only `.css`)
- [ ] All Playwright tests pass
- [ ] Visual regression tests pass
- [ ] Bundle size reduced
- [ ] No console errors
- [ ] Accessibility audit passes
