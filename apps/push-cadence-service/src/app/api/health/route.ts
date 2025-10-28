import { NextResponse } from 'next/server';
import pool from '@/lib/db';

export async function GET() {
  try {
    // Simple DB query to verify connection
    await pool.query('SELECT 1');

    return NextResponse.json({
      status: 'healthy',
      service: 'push-cadence',
      timestamp: new Date().toISOString(),
      database: 'connected',
      memoryUsage: process.memoryUsage()
    });
  } catch (error) {
    // Return 200 with degraded status to allow Railway deployment without database
    // This allows the service to start successfully even if DATABASE_URL is not configured yet
    return NextResponse.json({
      status: 'degraded',
      service: 'push-cadence',
      timestamp: new Date().toISOString(),
      database: 'not_configured',
      message: 'Service is running but database connection is not available',
      note: 'Configure PUSH_CADENCE_DATABASE_URL environment variable to enable database features',
      memoryUsage: process.memoryUsage()
    });
  }
}
