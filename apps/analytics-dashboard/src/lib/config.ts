/**
 * Analytics Dashboard Configuration
 * 
 * Local configuration loader that reads environment variables
 * for the analytics dashboard application.
 */

import { config } from 'dotenv';
import { join } from 'path';

// Load environment variables from the project root .env file
// In production (Railway), environment variables are provided directly and .env is not needed
if (process.env.NODE_ENV !== 'production') {
  // Use relative path resolution for local development
  const envPath = join(process.cwd(), '..', '..', '.env');
  config({ path: envPath });
}

// Database configuration
export const DATABASE_URL = process.env.DATABASE_URL;

// In production (Railway), log warning but allow app to start without database
// This enables deployment before database is configured
if (!DATABASE_URL && process.env.NODE_ENV === 'production') {
  console.warn('⚠️  DATABASE_URL environment variable is not configured');
  console.warn('⚠️  Application will run in degraded mode without database features');
  console.warn('⚠️  Configure DATABASE_URL in Railway dashboard to enable analytics');
} else if (!DATABASE_URL) {
  throw new Error('DATABASE_URL environment variable is required in development');
}

// Application configuration
export const APP_CONFIG = {
  database: {
    url: DATABASE_URL,
    pool: {
      max: 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000
    }
  },
  api: {
    cache: {
      maxAge: 300, // 5 minutes
      staleWhileRevalidate: 600 // 10 minutes
    }
  }
} as const;
