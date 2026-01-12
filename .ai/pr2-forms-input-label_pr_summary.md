# PR: Replace reactstrap Input/Label with native HTML + Tailwind

## 🔍 Context
**Task**: Replace `Input` and `Label` from reactstrap with native form elements styled using Tailwind (with the existing `@tailwindcss/forms` setup). This focuses on the team and territory list scenes.
**Changes**: Replaced all reactstrap form components with semantic HTML elements and applied consistent Tailwind styling classes.

## 🛠️ Key Changes
- ♻️ **Refactor**: Removed `Input` and `Label` imports from reactstrap in 2 files
- ✨ **Refinement**: Adjusted styling to match original Bootstrap exactly (font size `16px`/`text-base`, padding `6px`/`py-1.5`, and normal label weight).
- 🔧 **Maintenance**: Preserved all existing functionality - form handlers, validation, and accessibility attributes

## 📁 Files Modified
- `dashboard/src/scenes/territory/list.jsx` - 4 form elements replaced
- `dashboard/src/scenes/team/list.jsx` - 2 form elements replaced

## 🧪 Verification
- [x] Manual test: Form inputs render with proper Tailwind styling
- [x] Manual test: All labels properly associated with inputs via htmlFor/id
- [x] Manual test: Form submission functionality preserved in both territory and team creation
- [x] Automated tests: Playwright UI test suite launched (running in background)
