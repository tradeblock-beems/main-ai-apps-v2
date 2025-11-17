// Validate critical environment variables on startup
// Import this in app/layout.tsx to ensure validation runs on startup

const REQUIRED_ENV_VARS = [
  'DATABASE_URL',
  'FIREBASE_SERVICE_ACCOUNT_KEY',
  'CADENCE_SERVICE_URL'
] as const;

export function validateStartupEnvironment(): void {
  if (process.env.NODE_ENV !== 'production') {
    return; // Only enforce in production
  }

  const missing = REQUIRED_ENV_VARS.filter(varName => !process.env[varName]);

  if (missing.length > 0) {
    const errorMessage = `FATAL: Missing required environment variables: ${missing.join(', ')}`;
    console.error(errorMessage);
    console.error('Service cannot start without these variables configured in Railway dashboard.');
    process.exit(1); // Fail loud, fail fast
  }

  console.log('Startup validation passed: All required environment variables present');
}

// Auto-run on import in production
validateStartupEnvironment();
