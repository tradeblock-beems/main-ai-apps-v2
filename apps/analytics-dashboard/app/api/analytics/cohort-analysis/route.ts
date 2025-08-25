/**
 * Cohort Analysis API Route - Phase 6.5
 * 
 * GET endpoint providing new user cohort completion rates for key onboarding actions
 * within 72 hours of account creation. Supports monthly and weekly cohort grouping.
 * 
 * Uses direct database queries instead of Python script execution for reliability.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCohortAnalysis, checkDatabaseConnection } from '@/lib/db';
import type { 
  CohortData, 
  CohortAnalysisParams,
  CohortAnalysisResponse,
  CohortPeriodType,
  ApiError 
} from '@/types/analytics';

export async function GET(request: NextRequest) {
  try {
    // Health check database connection
    const isHealthy = await checkDatabaseConnection();
    if (!isHealthy) {
      const errorResponse: ApiError = {
        success: false,
        error: 'Database connection unavailable',
        code: 'DB_CONNECTION_ERROR',
        timestamp: new Date().toISOString()
      };
      return NextResponse.json(errorResponse, { status: 503 });
    }

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

    console.log(`Fetching ${queryParams.period} cohort analysis for ${periods} periods via direct database query`);

    // Execute direct database query for cohort analysis
    const rawCohortData = await getCohortAnalysis(queryParams.period, periods);

    // Transform database results to CohortData format
    const cohortData: CohortData[] = rawCohortData.map((row: Record<string, unknown>) => ({
      cohortPeriod: row.cohort_period as string,
      cohortStartDate: new Date((row.cohort_month) as string).toISOString().split('T')[0],
      totalUsers: row.total_users as number,
      actions: {
        closetAdd: {
          count: row.closet_add_count as number,
          percentage: parseFloat(row.closet_add_percentage as string)
        },
        wishlistAdd: {
          count: row.wishlist_add_count as number,
          percentage: parseFloat(row.wishlist_add_percentage as string)
        },
        createOffer: {
          count: row.create_offer_count as number,
          percentage: parseFloat(row.create_offer_percentage as string)
        },
        allActions: {
          count: row.all_actions_count as number,
          percentage: parseFloat(row.all_actions_percentage as string)
        }
      }
    }));

    console.log(`Successfully retrieved ${cohortData.length} cohorts from database`);

    // Create response with metadata
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

    // Set cache headers for performance (15 minute cache for cohort analysis)
    const headers = {
      'Cache-Control': 'public, max-age=900, stale-while-revalidate=1800', // 15 min cache
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