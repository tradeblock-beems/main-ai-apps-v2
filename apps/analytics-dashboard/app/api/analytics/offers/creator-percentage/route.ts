/**
 * Offer Creator Percentage Analytics API Route
 * 
 * Returns percentage of active users who created offers across multiple time windows.
 * Complex analysis showing user engagement and conversion to offer creation activity.
 */

import { NextResponse } from 'next/server';
import { getOfferCreatorPercentages } from '@/lib/db';
import type { OfferCreatorAnalysisResponse } from '@/types/analytics';

export async function GET(): Promise<NextResponse<OfferCreatorAnalysisResponse>> {
  try {
    // Fetch offer creator percentage data across all time windows
    const metricsData = await getOfferCreatorPercentages();

    const response: OfferCreatorAnalysisResponse = {
      success: true,
      data: metricsData,
      message: `Offer creator percentage analysis across ${metricsData.length} time windows`,
      timestamp: new Date().toISOString(),
      recordCount: metricsData.length,
      metadata: {
        calculatedAt: new Date().toISOString(),
        userBaseline: "Users created since March 5, 2025",
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
    console.error('Error fetching offer creator percentage data:', error);

    const errorResponse: OfferCreatorAnalysisResponse = {
      success: false,
      data: [],
      message: 'Failed to fetch offer creator percentage data',
      timestamp: new Date().toISOString(),
      recordCount: 0,
      metadata: {
        calculatedAt: new Date().toISOString(),
        userBaseline: "Users created since March 5, 2025",
        activityDefinition: [],
      },
    };

    return NextResponse.json(errorResponse, { status: 500 });
  }
}
