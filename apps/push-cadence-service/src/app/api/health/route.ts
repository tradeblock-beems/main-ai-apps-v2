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
    return NextResponse.json(
      { status: 'unhealthy', error: String(error) },
      { status: 500 }
    );
  }
}
