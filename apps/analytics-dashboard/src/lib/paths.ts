/**
 * Path Resolution Constants for Analytics Dashboard
 *
 * Provides Railway-compatible path resolution for accessing project resources.
 *
 * ## Environment-Specific Behavior
 *
 * ### Development:
 * - `process.cwd()` = `/path/to/main-ai-apps/apps/analytics-dashboard`
 * - `PROJECT_ROOT` = `/path/to/main-ai-apps` (project root)
 *
 * ### Railway Production:
 * - `process.cwd()` = `/app/apps/analytics-dashboard` (service directory)
 * - `PROJECT_ROOT` = `/app` (project root)
 *
 * ## Usage
 *
 * ```typescript
 * import { PROJECT_ROOT, ENV_PATH, PYTHON_TOOLBOX_PATH } from '@/lib/paths';
 *
 * // Load environment variables
 * config({ path: ENV_PATH });
 *
 * // Execute Python script
 * spawn('python3', [script], { cwd: PROJECT_ROOT });
 * ```
 */

import path from 'path';

/**
 * Project root directory (main-ai-apps)
 *
 * We navigate up two levels from the service directory to reach the project root.
 * This works in both development and Railway production environments.
 */
export const PROJECT_ROOT = path.join(process.cwd(), '..', '..');

/**
 * Environment file path (.env)
 *
 * In production (Railway), environment variables are provided directly
 * and this file won't exist. Only used in development.
 */
export const ENV_PATH = path.join(PROJECT_ROOT, '.env');

/**
 * Python toolbox path for PostHog utilities
 *
 * Path to the shared Python utilities used for PostHog analytics queries.
 */
export const PYTHON_TOOLBOX_PATH = path.join(
  PROJECT_ROOT,
  'basic_capabilities',
  'internal_db_queries_toolbox'
);
