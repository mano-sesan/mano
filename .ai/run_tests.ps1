# This script runs the full Playwright test suite in headless mode.
# It's ideal for CI or for a final check to ensure no regressions were introduced.

Write-Host "Starting Playwright tests in headless mode..."
npx playwright test
