/**
 * Daily Offers Analytics API Route
 * 
 * Returns daily offer creation data with subdivision by isOfferIdea boolean.
 * Supports flexible date range filtering with sensible defaults.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getDailyOffers } from '@/lib/db';
import type { OfferAnalyticsResponse, OfferAnalyticsParams } from '@/types/analytics';

export async function GET(request: NextRequest): Promise<NextResponse<OfferAnalyticsResponse>> {
  const { searchParams } = new URL(request.url);
  
  try {
    // Parse query parameters
    const queryParams: OfferAnalyticsParams = {
      days: searchParams.get('days') ? parseInt(searchParams.get('days')!, 10) : undefined,
      startDate: searchParams.get('startDate') || undefined,
      endDate: searchParams.get('endDate') || undefined,
    };

    // Calculate date range
    let startDate: string;
    let endDate: string;
    
    if (queryParams.startDate && queryParams.endDate) {
      // Use provided date range
      startDate = queryParams.startDate;
      endDate = queryParams.endDate;
    } else if (queryParams.days) {
      // Calculate range from days parameter
      endDate = new Date().toISOString().split('T')[0];
      startDate = new Date(Date.now() - (queryParams.days * 24 * 60 * 60 * 1000))
        .toISOString().split('T')[0];
    } else {
      // Default to last 30 days
      endDate = new Date().toISOString().split('T')[0];
      startDate = new Date(Date.now() - (30 * 24 * 60 * 60 * 1000))
        .toISOString().split('T')[0];
    }

    // Fetch data from database
    const dailyData = await getDailyOffers(startDate, endDate);

    // Calculate days in range
    const startDateObj = new Date(startDate);
    const endDateObj = new Date(endDate);
    const daysDiff = Math.ceil((endDateObj.getTime() - startDateObj.getTime()) / (1000 * 60 * 60 * 24));

    // Calculate totals for metadata
    const totals = dailyData.reduce(
      (acc, day) => ({
        offers: acc.offers + day.totalOffers,
        offerIdeas: acc.offerIdeas + day.offerIdeas,
        regularOffers: acc.regularOffers + day.regularOffers,
      }),
      { offers: 0, offerIdeas: 0, regularOffers: 0 }
    );

    const response: OfferAnalyticsResponse = {
      success: true,
      data: dailyData,
      message: `Daily offer creation data for ${daysDiff} days`,
      timestamp: new Date().toISOString(),
      recordCount: dailyData.length,
      metadata: {
        dateRange: {
          start: startDate,
          end: endDate,
          days: daysDiff,
        },
        totals,
      },
    };

    return NextResponse.json(response);

  } catch (error) {
    console.error('Error fetching daily offers data:', error);

    const errorResponse: OfferAnalyticsResponse = {
      success: false,
      data: [],
      message: 'Failed to fetch daily offers data',
      timestamp: new Date().toISOString(),
      recordCount: 0,
      metadata: {
        dateRange: { start: '', end: '', days: 0 },
        totals: { offers: 0, offerIdeas: 0, regularOffers: 0 },
      },
    };

    return NextResponse.json(errorResponse, { status: 500 });
  }
}
