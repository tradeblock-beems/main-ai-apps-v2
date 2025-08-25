/**
 * Mock New Users Analytics API Route
 * 
 * Development endpoint providing realistic test data for analytics dashboard.
 * Generates varied daily volumes to test chart scaling and date range filtering.
 */

import { NextRequest, NextResponse } from 'next/server';
import type { 
  ApiResponse, 
  ChartData, 
  NewUsersQueryParams,
  ApiError 
} from '@/types/analytics';

// Generate realistic mock data for testing
function generateMockData(startDate: string, endDate: string): ChartData[] {
  const start = new Date(startDate);
  const end = new Date(endDate);
  const data: ChartData[] = [];
  
  const current = new Date(start);
  while (current <= end) {
    // Generate realistic daily user counts with some variance
    const baseCount = 15; // Base daily registrations
    const weekdayMultiplier = current.getDay() === 0 || current.getDay() === 6 ? 0.7 : 1.0; // Lower weekend activity
    const randomVariance = 0.5 + Math.random() * 1.0; // 50% to 150% of base
    const trendFactor = 1 + (current.getTime() - start.getTime()) / (1000 * 60 * 60 * 24 * 365 * 10); // Slight growth trend
    
    const count = Math.max(0, Math.round(baseCount * weekdayMultiplier * randomVariance * trendFactor));
    
    data.push({
      date: current.toISOString().split('T')[0],
      count,
      timestamp: current.getTime()
    });
    
    current.setDate(current.getDate() + 1);
  }
  
  return data;
}

export async function GET(request: NextRequest) {
  try {
    // Parse query parameters
    const { searchParams } = new URL(request.url);
    const queryParams: NewUsersQueryParams = {
      startDate: searchParams.get('startDate') || undefined,
      endDate: searchParams.get('endDate') || undefined,
      days: searchParams.get('days') || undefined
    };

    // Handle predefined day ranges
    let startDate = queryParams.startDate;
    let endDate = queryParams.endDate;

    if (queryParams.days) {
      const daysBack = parseInt(queryParams.days, 10);
      if (isNaN(daysBack) || daysBack <= 0 || daysBack > 365) {
        const errorResponse: ApiError = {
          success: false,
          error: 'Invalid days parameter. Must be a positive integer ≤ 365.',
          code: 'INVALID_DAYS_PARAMETER',
          timestamp: new Date().toISOString()
        };
        return NextResponse.json(errorResponse, { status: 400 });
      }

      endDate = new Date().toISOString().split('T')[0];
      startDate = new Date(Date.now() - daysBack * 24 * 60 * 60 * 1000)
        .toISOString().split('T')[0];
    }

    // Default to last 30 days if no range specified
    if (!startDate) {
      startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
        .toISOString().split('T')[0];
    }
    if (!endDate) {
      endDate = new Date().toISOString().split('T')[0];
    }

    // Validate date format
    if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate)) {
      const errorResponse: ApiError = {
        success: false,
        error: 'Invalid startDate format. Use YYYY-MM-DD.',
        code: 'INVALID_DATE_FORMAT',
        timestamp: new Date().toISOString()
      };
      return NextResponse.json(errorResponse, { status: 400 });
    }

    if (!/^\d{4}-\d{2}-\d{2}$/.test(endDate)) {
      const errorResponse: ApiError = {
        success: false,
        error: 'Invalid endDate format. Use YYYY-MM-DD.',
        code: 'INVALID_DATE_FORMAT',
        timestamp: new Date().toISOString()
      };
      return NextResponse.json(errorResponse, { status: 400 });
    }

    // Validate date range logic
    if (new Date(startDate) > new Date(endDate)) {
      const errorResponse: ApiError = {
        success: false,
        error: 'startDate must be before or equal to endDate',
        code: 'INVALID_DATE_RANGE',
        timestamp: new Date().toISOString()
      };
      return NextResponse.json(errorResponse, { status: 400 });
    }

    // Generate mock data
    const chartData = generateMockData(startDate, endDate);
    const totalCount = chartData.reduce((sum, item) => sum + item.count, 0);

    // Create successful API response
    const response: ApiResponse<ChartData[]> = {
      success: true,
      data: chartData,
      message: `Successfully generated ${chartData.length} days of mock new user data`,
      timestamp: new Date().toISOString(),
      recordCount: totalCount
    };

    // Add mock data headers
    const headers = {
      'Content-Type': 'application/json',
      'X-Mock-Data': 'true',
      'X-Generated-At': new Date().toISOString()
    };

    return NextResponse.json(response, { headers });

  } catch (error) {
    console.error('Mock new users API error:', error);
    
    const errorResponse: ApiError = {
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error',
      code: 'INTERNAL_SERVER_ERROR',
      timestamp: new Date().toISOString()
    };

    return NextResponse.json(errorResponse, { status: 500 });
  }
}

// GET method exported above
