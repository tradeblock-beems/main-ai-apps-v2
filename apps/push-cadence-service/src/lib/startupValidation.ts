const REQUIRED_ENV_VARS = [
  'DATABASE_URL'
] as const;

export function validateStartupEnvironment(): void {
  if (process.env.NODE_ENV !== 'production') {
    return;
  }

  // Skip validation during Next.js build phase
  if (process.env.NEXT_PHASE === 'phase-production-build') {
    console.log('Startup validation skipped: Build phase');
    return;
  }

  const missing = REQUIRED_ENV_VARS.filter(varName => !process.env[varName]);

  if (missing.length > 0) {
    console.error(`FATAL: Missing required environment variables: ${missing.join(', ')}`);
    process.exit(1);
  }

  console.log('Startup validation passed: All required environment variables present');
}

validateStartupEnvironment();
