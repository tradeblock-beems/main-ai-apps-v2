import { NextResponse } from 'next/server';
import { getAutomationEngineInstance } from '@/lib/automationEngine';

export async function GET() {
  try {
    const engine = getAutomationEngineInstance();
    const debugInfo = engine.getDebugInfo();

    return NextResponse.json({
      status: 'healthy',
      service: 'push-blaster',
      timestamp: new Date().toISOString(),
      instanceId: debugInfo.instanceId,
      scheduledJobs: debugInfo.scheduledJobsCount,
      activeExecutions: debugInfo.activeExecutionsCount,
      memoryUsage: process.memoryUsage()
    });
  } catch (error) {
    // Return 200 with degraded status to allow Railway deployment without database
    // This allows the service to start successfully even if DATABASE_URL is not configured yet
    return NextResponse.json({
      status: 'degraded',
      service: 'push-blaster',
      timestamp: new Date().toISOString(),
      database: 'not_configured',
      message: 'Service is running but automation engine initialization failed',
      note: 'Configure DATABASE_URL environment variable to enable push notification features',
      error: String(error),
      memoryUsage: process.memoryUsage()
    });
  }
}