# This script runs the Playwright test suite with the UI.
# It's ideal for debugging, allowing you to interactively inspect tests.

Write-Host "Starting Playwright tests in UI mode..."
npx playwright test --ui
