// Manual restoration trigger for AutomationEngine
// Emergency endpoint to fix missing scheduled automations

import { NextRequest, NextResponse } from 'next/server';
import { getAutomationEngineInstance } from '@/lib/automationEngine';

export async function POST(req: NextRequest) {
  try {
    const automationEngine = getAutomationEngineInstance();
    console.log('[RESTORE] Manual automation restoration triggered');
    
    // Get state before restoration
    const beforeRestore = automationEngine.getDebugInfo();
    
    // Trigger manual restoration
    await automationEngine.manualRestore();
    
    // Get state after restoration
    const afterRestore = automationEngine.getDebugInfo();
    
    return NextResponse.json({
      success: true,
      data: {
        beforeRestore: {
          scheduledJobsCount: beforeRestore.scheduledJobsCount,
          instanceId: beforeRestore.instanceId
        },
        afterRestore: {
          scheduledJobsCount: afterRestore.scheduledJobsCount,
          instanceId: afterRestore.instanceId,
          scheduledJobs: afterRestore.scheduledJobs
        }
      },
      timestamp: new Date().toISOString(),
      message: 'Manual restoration completed successfully'
    });

  } catch (error: any) {
    console.error('Error during manual restoration:', error);
    return NextResponse.json({
      success: false,
      message: 'Failed to restore automations',
      error: error.message
    }, { status: 500 });
  }
}
