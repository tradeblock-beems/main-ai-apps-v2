# Unresolved Issues & Action Items from Code Review

This document tracks larger architectural issues, potential refactoring opportunities, and small action items identified during the comprehensive code review of the push automation system. These items require discussion and prioritization before implementation.

## Action Items (Small Fixes)

1.  **Fix ESLint `no-explicit-any` errors in `push-cadence-service`**:
    *   **Files Affected**: `convert-audience-to-history/route.ts`, `filter-audience/route.ts`, `find-matching-logs/route.ts`, `restore-historical-data/route.ts`, `track-notification/route.ts`, `update-deep-links/route.ts`, `cadence.ts`.
    *   **Description**: The production build for `push-cadence-service` is failing due to multiple ESLint errors. These are not fatal compilation errors but should be fixed by providing explicit types instead of using `any`. This is a straightforward but necessary cleanup task.

## Architectural Discussion Points

1.  **Standardize Automation Data Pathing**:
    *   **Files Affected**: `automationStorage.ts`.
    *   **Description**: The storage module uses `process.cwd()` to locate the `.automations` directory. The discovery of a nested `.automations` directory suggests this is fragile and has led to confusion. We should consider making this path configuration more robust, potentially using an environment variable or a more reliable anchor point than the current working directory.
    *   **Recommendation**: Discuss standardizing the path and implementing a startup check in `AutomationEngine` to validate it's reading from the correct location.

2.  **Refactor Local Component Types**:
    *   **Files Affected**: `edit-automation/[id]/page.tsx` and other UI components.
    *   **Description**: Several UI components define their own local `Automation` interfaces, which have fallen out of sync with the canonical `UniversalAutomation` type. This was a primary source of build failures.
    *   **Recommendation**: Plan a refactoring task to replace all local types with the shared `UniversalAutomation` type from `src/types/automation.ts` to create a single source of truth.
