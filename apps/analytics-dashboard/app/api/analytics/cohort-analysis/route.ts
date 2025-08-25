/**
 * Cohort Analysis API Route - Phase 6.5
 * 
 * GET endpoint providing new user cohort completion rates for key onboarding actions
 * within 72 hours of account creation. Supports monthly and weekly cohort grouping.
 */

import { NextRequest, NextResponse } from 'next/server';
import { spawn } from 'child_process';
import path from 'path';
import type { 
  CohortData, 
  CohortAnalysisParams,
  CohortAnalysisResponse,
  CohortPeriodType,
  ApiError 
} from '@/types/analytics';

export async function GET(request: NextRequest) {
  try {
    // Parse query parameters
    const { searchParams } = new URL(request.url);
    const queryParams: CohortAnalysisParams = {
      period: (searchParams.get('period') as CohortPeriodType) || 'monthly',
      months: searchParams.get('months') || undefined
    };

    // Validate period parameter
    if (!['monthly', 'weekly'].includes(queryParams.period)) {
      const errorResponse: ApiError = {
        success: false,
        error: 'Invalid period parameter. Must be "monthly" or "weekly".',
        code: 'INVALID_PERIOD_PARAMETER',
        timestamp: new Date().toISOString()
      };
      return NextResponse.json(errorResponse, { status: 400 });
    }

    // Validate months parameter
    let periods = 12; // Default for monthly
    if (queryParams.period === 'weekly') {
      periods = 24; // Default for weekly (~6 months)
    }
    
    if (queryParams.months) {
      const parsedMonths = parseInt(queryParams.months, 10);
      if (isNaN(parsedMonths) || parsedMonths <= 0 || parsedMonths > 24) {
        const errorResponse: ApiError = {
          success: false,
          error: 'Invalid months parameter. Must be a positive integer ≤ 24.',
          code: 'INVALID_MONTHS_PARAMETER',
          timestamp: new Date().toISOString()
        };
        return NextResponse.json(errorResponse, { status: 400 });
      }
      periods = parsedMonths;
    }

    console.log(`Fetching ${queryParams.period} cohort analysis for ${periods} periods`);

    // Execute Python cohort analysis script
    const scriptPath = path.join(process.cwd(), '../../projects/analytics-foundation/cohort_analysis_queries.py');
    const args = [
      scriptPath,
      queryParams.period === 'monthly' ? '--monthly' : '--weekly',
      '--periods', periods.toString()
    ];

    const pythonData = await new Promise<string>((resolve, reject) => {
      const pythonProcess = spawn('python3', args);
      let data = '';
      let errorData = '';

      pythonProcess.stdout.on('data', (chunk) => {
        data += chunk.toString();
      });

      pythonProcess.stderr.on('data', (chunk) => {
        errorData += chunk.toString();
      });

      pythonProcess.on('close', (code) => {
        if (code === 0) {
          resolve(data);
        } else {
          console.error('Python script error:', errorData);
          reject(new Error(`Python script failed with code ${code}: ${errorData}`));
        }
      });

      // Timeout after 30 seconds
      setTimeout(() => {
        pythonProcess.kill();
        reject(new Error('Cohort analysis query timeout'));
      }, 30000);
    });

    // Parse the JSON output from Python script
    const lines = pythonData.trim().split('\n');
    let jsonOutput = '';
    
    // Find the JSON data in the output (skip log messages)
    for (const line of lines) {
      if (line.startsWith('[') || line.startsWith('{')) {
        jsonOutput = line;
        break;
      }
    }

    if (!jsonOutput) {
      throw new Error('No valid JSON data in Python script output');
    }

    const rawCohortData = JSON.parse(jsonOutput);
    console.log(`Received ${rawCohortData.length} cohort periods from database`);

    // Transform database results to CohortData format
    const cohortData: CohortData[] = rawCohortData.map((row: Record<string, unknown>) => ({
      cohortPeriod: row.cohort_period as string,
      cohortStartDate: new Date((row.cohort_month || row.cohort_week) as string).toISOString().split('T')[0],
      totalUsers: row.total_users as number,
      actions: {
        closetAdd: {
          count: row.closet_add_count as number,
          percentage: row.closet_add_percentage as number
        },
        wishlistAdd: {
          count: row.wishlist_add_count as number,
          percentage: row.wishlist_add_percentage as number
        },
        createOffer: {
          count: row.create_offer_count as number,
          percentage: row.create_offer_percentage as number
        },
        allActions: {
          count: row.all_actions_count as number,
          percentage: row.all_actions_percentage as number
        }
      }
    }));

    // Create successful API response with metadata
    const response: CohortAnalysisResponse = {
      success: true,
      data: cohortData,
      message: `Successfully retrieved ${cohortData.length} ${queryParams.period} cohorts`,
      timestamp: new Date().toISOString(),
      recordCount: cohortData.reduce((sum, cohort) => sum + cohort.totalUsers, 0),
      metadata: {
        periodType: queryParams.period,
        periodsAnalyzed: cohortData.length,
        analysisWindow: "72 hours",
        generatedAt: new Date().toISOString()
      }
    };

    // Set cache headers for cohort data (15 minutes - longer than real-time data)
    const headers = {
      'Cache-Control': 'public, max-age=900, stale-while-revalidate=1800', // 15 min cache, 30 min stale
      'Content-Type': 'application/json'
    };

    return NextResponse.json(response, { headers });

  } catch (error) {
    console.error('Cohort analysis API error:', error);
    
    const errorResponse: ApiError = {
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error',
      code: 'COHORT_ANALYSIS_ERROR',
      timestamp: new Date().toISOString()
    };

    return NextResponse.json(errorResponse, { status: 500 });
  }
}

// GET method exported above
