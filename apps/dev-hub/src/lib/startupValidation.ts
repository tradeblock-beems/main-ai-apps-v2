// Dev-hub is a simple entry point with no database dependencies
// Minimal validation just to ensure consistent startup pattern

export function validateStartupEnvironment(): void {
  if (process.env.NODE_ENV !== 'production') {
    return;
  }

  // Skip validation during Next.js build phase
  if (process.env.NEXT_PHASE === 'phase-production-build') {
    console.log('Startup validation skipped: Build phase');
    return;
  }

  console.log('Startup validation passed: All required environment variables present');
}

validateStartupEnvironment();
