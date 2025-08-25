# Project Brief: Push Service Refactor

## 1. Context & Goals
The `push-blaster` service is currently unstable due to several critical architectural flaws identified by the `@architect`. This mini-project, "Push Service Refactor," is a targeted effort to resolve these core issues, stabilize the application, and get it running reliably on `localhost:3001`. Our primary goal is to eliminate the technical debt that is causing build failures and unpredictable behavior.

## 2. Key Objectives & Success Criteria

*   **Objective 1: Unify Type Definitions:** Eradicate all local, outdated type definitions (specifically in `edit-automation/[id]/page.tsx`) and ensure all components import the `UniversalAutomation` interface from the single source of truth at `src/types/automation.ts`.
    *   **Done When:** The local `Automation` interface is deleted, and the component compiles and functions correctly using the canonical type.

*   **Objective 2: Eliminate Unsafe Type Casting:** Refactor the `restoreActiveAutomations` function in `automationEngine.ts` to remove the `(automation as any)` casts, ensuring that data loaded from storage is correctly validated against the `UniversalAutomation` type.
    *   **Done When:** The type casts are removed, and the data restoration logic is fully type-safe.

*   **Objective 3: Stabilize File Pathing:** Refactor `automationStorage.ts` and `scriptExecutor.ts` to use reliable, absolute pathing instead of relying on `process.cwd()`.
    *   **Done When:** All file/directory paths are resolved in a way that is independent of where the process is started.

*   **Objective 4: Achieve a Clean Build & Local Execution:** The final deliverable is a stable service that can be built and run without errors.
    *   **Done When:** `npm run build` completes successfully, and the application starts and is accessible on `localhost:3001`.
