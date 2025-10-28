import { NextResponse } from 'next/server';
import pool from '@/lib/db';

export async function GET() {
  try {
    // Check if pool is initialized
    if (!pool) {
      return NextResponse.json({
        status: 'degraded',
        service: 'analytics-dashboard',
        timestamp: new Date().toISOString(),
        database: 'not_configured',
        message: 'Service is running but database pool is not initialized',
        note: 'Configure DATABASE_URL environment variable to enable database features',
        memoryUsage: process.memoryUsage()
      });
    }

    // Simple DB query to verify connection
    await pool.query('SELECT 1');

    return NextResponse.json({
      status: 'healthy',
      service: 'analytics-dashboard',
      timestamp: new Date().toISOString(),
      database: 'connected',
      memoryUsage: process.memoryUsage()
    });
  } catch (error) {
    // Return 200 with degraded status to allow Railway deployment without database
    // This allows the service to start successfully even if DATABASE_URL is not configured yet
    return NextResponse.json({
      status: 'degraded',
      service: 'analytics-dashboard',
      timestamp: new Date().toISOString(),
      database: 'error',
      message: 'Service is running but database connection failed',
      error: String(error),
      note: 'Check DATABASE_URL environment variable and database availability',
      memoryUsage: process.memoryUsage()
    });
  }
}
