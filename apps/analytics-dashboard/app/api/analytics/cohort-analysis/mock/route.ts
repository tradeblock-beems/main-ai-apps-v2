/**
 * Mock Cohort Analysis API Route - Phase 6.5
 * 
 * Generates realistic mock data for cohort analysis during development.
 * Provides consistent test data for D3.js visualization development.
 */

import { NextRequest, NextResponse } from 'next/server';
import type { 
  CohortData, 
  CohortAnalysisParams,
  CohortAnalysisResponse,
  CohortPeriodType,
  ApiError 
} from '@/types/analytics';

function generateMockCohortData(periodType: CohortPeriodType, periods: number): CohortData[] {
  const cohorts: CohortData[] = [];
  const currentDate = new Date();
  
  for (let i = periods - 1; i >= 0; i--) {
    let cohortDate: Date;
    let cohortPeriod: string;
    
    if (periodType === 'monthly') {
      cohortDate = new Date(currentDate.getFullYear(), currentDate.getMonth() - i, 1);
      cohortPeriod = cohortDate.toISOString().slice(0, 7); // YYYY-MM
    } else {
      // Weekly cohorts
      cohortDate = new Date(currentDate);
      cohortDate.setDate(cohortDate.getDate() - (i * 7));
      cohortDate.setDate(cohortDate.getDate() - cohortDate.getDay()); // Start of week (Sunday)
      
      const year = cohortDate.getFullYear();
      const weekNumber = Math.ceil(((cohortDate.getTime() - new Date(year, 0, 1).getTime()) / 86400000 + 1) / 7);
      cohortPeriod = `${year}-W${weekNumber.toString().padStart(2, '0')}`;
    }
    
    // Generate realistic user counts with variation
    const baseUsers = periodType === 'monthly' ? 
      Math.floor(200 + Math.random() * 800) : // Monthly: 200-1000 users
      Math.floor(50 + Math.random() * 200);   // Weekly: 50-250 users
    
    // Add some seasonal variation (higher in recent periods)
    const seasonalMultiplier = 1 + (periods - i - 1) * 0.1; // More recent = higher
    const totalUsers = Math.floor(baseUsers * seasonalMultiplier);
    
    // Generate realistic completion rates with variation
    // Closet add: typically highest completion (30-50%)
    const closetPercentage = 30 + Math.random() * 20;
    const closetCount = Math.floor(totalUsers * (closetPercentage / 100));
    
    // Wishlist add: moderate completion (20-40%)  
    const wishlistPercentage = 20 + Math.random() * 20;
    const wishlistCount = Math.floor(totalUsers * (wishlistPercentage / 100));
    
    // Create offer: lowest completion (5-15%)
    const offerPercentage = 5 + Math.random() * 10;
    const offerCount = Math.floor(totalUsers * (offerPercentage / 100));
    
    // All actions: subset of users who completed everything (2-8%)
    const allActionsPercentage = 2 + Math.random() * 6;
    const allActionsCount = Math.floor(totalUsers * (allActionsPercentage / 100));
    
    cohorts.push({
      cohortPeriod,
      cohortStartDate: cohortDate.toISOString().split('T')[0],
      totalUsers,
      actions: {
        closetAdd: {
          count: closetCount,
          percentage: Math.round(closetPercentage * 100) / 100
        },
        wishlistAdd: {
          count: wishlistCount,
          percentage: Math.round(wishlistPercentage * 100) / 100
        },
        createOffer: {
          count: offerCount,
          percentage: Math.round(offerPercentage * 100) / 100
        },
        allActions: {
          count: allActionsCount,
          percentage: Math.round(allActionsPercentage * 100) / 100
        }
      }
    });
  }
  
  return cohorts;
}

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

    // Determine number of periods to generate
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

    console.log(`Generating mock ${queryParams.period} cohort data for ${periods} periods`);

    // Generate mock cohort data
    const cohortData = generateMockCohortData(queryParams.period, periods);

    // Create response with metadata
    const response: CohortAnalysisResponse = {
      success: true,
      data: cohortData,
      message: `Generated ${cohortData.length} mock ${queryParams.period} cohorts`,
      timestamp: new Date().toISOString(),
      recordCount: cohortData.reduce((sum, cohort) => sum + cohort.totalUsers, 0),
      metadata: {
        periodType: queryParams.period,
        periodsAnalyzed: cohortData.length,
        analysisWindow: "72 hours",
        generatedAt: new Date().toISOString()
      }
    };

    // Set cache headers for mock data (shorter cache time)
    const headers = {
      'Cache-Control': 'public, max-age=300, stale-while-revalidate=600', // 5 min cache
      'Content-Type': 'application/json'
    };

    return NextResponse.json(response, { headers });

  } catch (error) {
    console.error('Mock cohort analysis API error:', error);
    
    const errorResponse: ApiError = {
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error',
      code: 'MOCK_COHORT_ERROR',
      timestamp: new Date().toISOString()
    };

    return NextResponse.json(errorResponse, { status: 500 });
  }
}

// GET method exported above
