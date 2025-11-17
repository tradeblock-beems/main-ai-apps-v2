const REQUIRED_ENV_VARS = [
  'DATABASE_URL'
] as const;

let validationComplete = false;

export function validateStartupEnvironment(): void {
  if (validationComplete) {
    return;
  }
  validationComplete = true;

  if (process.env.NODE_ENV !== 'production') {
    return;
  }

  // Skip validation during Next.js build phase
  if (process.env.NEXT_PHASE === 'phase-production-build') {
    console.log('[analytics-dashboard] Startup validation skipped: Build phase');
    return;
  }

  const missing = REQUIRED_ENV_VARS.filter(varName => !process.env[varName]);

  if (missing.length > 0) {
    console.error('='.repeat(80));
    console.error(`[analytics-dashboard] CRITICAL WARNING: Missing environment variables: ${missing.join(', ')}`);
    console.error('Service will start in DEGRADED MODE - Analytics queries will NOT work!');
    console.error('Configure these variables in Railway dashboard immediately.');
    console.error('='.repeat(80));
    return;
  }

  console.log('[analytics-dashboard] Startup validation passed: All required environment variables present');
}

validateStartupEnvironment();
