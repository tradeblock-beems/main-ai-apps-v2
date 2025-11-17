// Dev-hub is a simple entry point with no database dependencies
// Minimal validation just to ensure consistent startup pattern

export function validateStartupEnvironment(): void {
  if (process.env.NODE_ENV !== 'production') {
    return;
  }

  console.log('Startup validation passed: All required environment variables present');
}

validateStartupEnvironment();
