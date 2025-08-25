/**
 * New Users Analytics API Route
 * 
 * GET endpoint providing new user registration data aggregated by day.
 * Supports date range filtering and optimized for D3.js chart consumption.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getNewUsersByDay, getNewUsersCount, checkDatabaseConnection } from '@/lib/db';
import type { 
  ApiResponse, 
  ChartData, 
  NewUsersQueryParams,
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

    // Validate date format if provided
    if (startDate && !/^\d{4}-\d{2}-\d{2}$/.test(startDate)) {
      const errorResponse: ApiError = {
        success: false,
        error: 'Invalid startDate format. Use YYYY-MM-DD.',
        code: 'INVALID_DATE_FORMAT',
        timestamp: new Date().toISOString()
      };
      return NextResponse.json(errorResponse, { status: 400 });
    }

    if (endDate && !/^\d{4}-\d{2}-\d{2}$/.test(endDate)) {
      const errorResponse: ApiError = {
        success: false,
        error: 'Invalid endDate format. Use YYYY-MM-DD.',
        code: 'INVALID_DATE_FORMAT',
        timestamp: new Date().toISOString()
      };
      return NextResponse.json(errorResponse, { status: 400 });
    }

    // Validate date range logic
    if (startDate && endDate && new Date(startDate) > new Date(endDate)) {
      const errorResponse: ApiError = {
        success: false,
        error: 'startDate must be before or equal to endDate',
        code: 'INVALID_DATE_RANGE',
        timestamp: new Date().toISOString()
      };
      return NextResponse.json(errorResponse, { status: 400 });
    }

    // Fetch data from database
    const dailyData = await getNewUsersByDay(startDate, endDate);
    const totalCount = await getNewUsersCount(startDate, endDate);

    // Transform data for D3.js consumption
    const chartData: ChartData[] = dailyData.map(item => ({
      date: item.date.toISOString().split('T')[0], // YYYY-MM-DD format
      count: item.count,
      timestamp: item.date.getTime() // Unix timestamp for D3.js time scales
    }));

    // Create successful API response
    const response: ApiResponse<ChartData[]> = {
      success: true,
      data: chartData,
      message: `Successfully retrieved ${chartData.length} days of new user data`,
      timestamp: new Date().toISOString(),
      recordCount: totalCount
    };

    // Set cache headers for performance (cache for 5 minutes)
    const headers = {
      'Cache-Control': 'public, max-age=300, stale-while-revalidate=600',
      'Content-Type': 'application/json'
    };

    return NextResponse.json(response, { headers });

  } catch (error) {
    console.error('New users API error:', error);
    
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
