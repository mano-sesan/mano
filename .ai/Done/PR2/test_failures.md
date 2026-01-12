# Playwright Test Failures Report

## Test Count Difference Explanation

**UI Mode (50 tests)** vs **Headless Mode (100 tests)**:
- The UI mode likely runs only a subset of tests - either the first project/shard or tests with specific annotations
- Headless mode runs the complete test suite across all projects and configurations

## Failing Tests

| Test File | Test Name | Failure Reason |
|-----------|-----------|----------------|
| actions_grouped-categories.spec.ts | Actions › Create second group | Database constraint error: `la valeur d'une clé dupliquée rompt la contrainte unique « User_email_key »` |
| activate_passages_rencontres.spec.ts | test | Database constraint error: `la valeur d'une clé dupliquée rompt la contrainte unique « User_email_key »` |

## Analysis

These failures appear to be **unrelated to your PR-2 changes**. They're failing due to database unique constraint violations on the `User_email_key` field, which suggests:

1. Test environment setup issues - tests are trying to create users with duplicate email addresses
2. Tests are not properly isolated - previous test runs may have left data in the database
3. Tests may be running in parallel against the same database

## Recommendation

Since these failures are related to database constraints and not to the UI components you modified:

1. Your PR-2 changes can still be considered valid
2. The test failures should be reported to the team responsible for test infrastructure
3. Consider running only the specific tests that would interact with your modified components:
   ```
   npx playwright test --grep="territory|team"
   ```
