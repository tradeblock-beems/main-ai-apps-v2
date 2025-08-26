/**
 * Mock Offer Creator Percentage Analytics API Route
 * 
 * Provides realistic test data for offer creator percentage analysis.
 * Used as fallback when database connections fail during development.
 */

import { NextResponse } from 'next/server';
import type { OfferCreatorAnalysisResponse, OfferCreatorMetrics } from '@/types/analytics';

function generateMockCreatorPercentages(): OfferCreatorMetrics[] {
  const timeWindows = ['24h', '72h', '7d', '30d', '90d'];
  
  return timeWindows.map((timeWindow, index) => {
    // Simulate realistic user counts (higher active users for longer periods)
    const baseActiveUsers = 450 + (index * 200); // 450, 650, 850, 1050, 1250
    const randomVariation = Math.floor(Math.random() * 100) - 50; // ±50 variation
    const activeUsers = Math.max(100, baseActiveUsers + randomVariation);
    
    // Simulate realistic offer creator percentages (decreasing for longer periods)
    const basePercentage = 12 - (index * 1.8); // 12%, 10.2%, 8.4%, 6.6%, 4.8%
    const percentageVariation = (Math.random() - 0.5) * 2; // ±1% variation
    const percentage = Math.max(1, basePercentage + percentageVariation);
    
    const offerCreators = Math.floor((activeUsers * percentage) / 100);
    
    return {
      timeWindow,
      activeUsers,
      offerCreators,
      percentage: Math.round(percentage * 100) / 100, // Round to 2 decimal places
    };
  });
}

export async function GET(): Promise<NextResponse<OfferCreatorAnalysisResponse>> {
  try {
    // Generate mock data
    const metricsData = generateMockCreatorPercentages();

    const response: OfferCreatorAnalysisResponse = {
      success: true,
      data: metricsData,
      message: `Mock offer creator percentage analysis across ${metricsData.length} time windows`,
      timestamp: new Date().toISOString(),
      recordCount: metricsData.length,
      metadata: {
        calculatedAt: new Date().toISOString(),
        userBaseline: "Mock data - Users created since March 5, 2025",
        activityDefinition: [
          "Device usage (login/session activity)",
          "Offer creation activity", 
          "Inventory addition activity",
          "Wishlist addition activity"
        ],
      },
    };

    return NextResponse.json(response);

  } catch (error) {
    console.error('Error generating mock offer creator percentage data:', error);

    const errorResponse: OfferCreatorAnalysisResponse = {
      success: false,
      data: [],
      message: 'Failed to generate mock offer creator percentage data',
      timestamp: new Date().toISOString(),
      recordCount: 0,
      metadata: {
        calculatedAt: new Date().toISOString(),
        userBaseline: "Mock data baseline",
        activityDefinition: [],
      },
    };

    return NextResponse.json(errorResponse, { status: 500 });
  }
}
