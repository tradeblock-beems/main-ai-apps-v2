/**
 * Mock Daily Offers Analytics API Route
 * 
 * Provides realistic test data for daily offer creation with subdivision.
 * Used as fallback when database connections fail during development.
 */

import { NextRequest, NextResponse } from 'next/server';
import type { OfferAnalyticsResponse, OfferCreationData } from '@/types/analytics';

function generateMockDailyOffers(days: number): OfferCreationData[] {
  const data: OfferCreationData[] = [];
  const endDate = new Date();
  
  for (let i = days - 1; i >= 0; i--) {
    const date = new Date();
    date.setDate(endDate.getDate() - i);
    
    // Generate realistic offer volumes with some variability
    const baseOffers = 15 + Math.floor(Math.random() * 25); // 15-40 offers per day
    const offerIdeasPercent = 0.25 + Math.random() * 0.15; // 25-40% offer ideas
    
    const totalOffers = baseOffers;
    const offerIdeas = Math.floor(totalOffers * offerIdeasPercent);
    const regularOffers = totalOffers - offerIdeas;
    
    data.push({
      date,
      totalOffers,
      offerIdeas,
      regularOffers,
    });
  }
  
  return data;
}

export async function GET(request: NextRequest): Promise<NextResponse<OfferAnalyticsResponse>> {
  const { searchParams } = new URL(request.url);
  
  try {
    // Parse days parameter (default to 30)
    const days = searchParams.get('days') ? parseInt(searchParams.get('days')!, 10) : 30;
    
    // Generate mock data
    const dailyData = generateMockDailyOffers(days);
    
    // Calculate date range
    const endDate = new Date().toISOString().split('T')[0];
    const startDate = new Date(Date.now() - (days * 24 * 60 * 60 * 1000))
      .toISOString().split('T')[0];
    
    // Calculate totals
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
      message: `Mock daily offer creation data for ${days} days`,
      timestamp: new Date().toISOString(),
      recordCount: dailyData.length,
      metadata: {
        dateRange: {
          start: startDate,
          end: endDate,
          days,
        },
        totals,
      },
    };

    return NextResponse.json(response);

  } catch (error) {
    console.error('Error generating mock daily offers data:', error);

    const errorResponse: OfferAnalyticsResponse = {
      success: false,
      data: [],
      message: 'Failed to generate mock daily offers data',
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
