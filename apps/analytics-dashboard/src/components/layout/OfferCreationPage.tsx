/**
 * Offer Creation Analytics Page Component
 * 
 * Displays offer creation analytics with two main visualizations:
 * 1. Daily offers chart with subdivision by isOfferIdea
 * 2. Offer creator percentage analysis across time windows
 */

'use client';

import React, { useState, useEffect, useCallback } from 'react';
import type { 
  OfferCreationData, 
  OfferCreatorMetrics,
  OfferAnalyticsResponse,
  OfferCreatorAnalysisResponse
} from '@/types/analytics';

import DailyOffersChart from '@/components/charts/DailyOffersChart';
import OfferCreatorPercentageChart from '@/components/charts/OfferCreatorPercentageChart';

const DateRangeToggle = ({ selectedDays, onRangeChange }: {
  selectedDays: number;
  onRangeChange: (days: number) => void;
}) => (
  <div className="flex space-x-2">
    {[7, 14, 30, 60, 90].map(days => (
      <button
        key={days}
        onClick={() => onRangeChange(days)}
        className={`px-3 py-2 text-sm font-medium rounded-lg transition-colors ${
          selectedDays === days
            ? 'bg-blue-100 text-blue-700 border border-blue-300'
            : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
        }`}
      >
        {days}d
      </button>
    ))}
  </div>
);

interface OfferCreationPageProps {
  className?: string;
}

export default function OfferCreationPage({ className = '' }: OfferCreationPageProps) {
  // State management
  const [selectedDays, setSelectedDays] = useState(30);
  const [dailyOffersData, setDailyOffersData] = useState<OfferCreationData[]>([]);
  const [creatorPercentageData, setCreatorPercentageData] = useState<OfferCreatorMetrics[]>([]);
  const [dailyOffersLoading, setDailyOffersLoading] = useState(true);
  const [creatorPercentageLoading, setCreatorPercentageLoading] = useState(true);
  const [dailyOffersError, setDailyOffersError] = useState<string | null>(null);
  const [creatorPercentageError, setCreatorPercentageError] = useState<string | null>(null);
  
  // Caching
  const [dailyOffersCache, setDailyOffersCache] = useState(new Map<string, {
    data: OfferCreationData[];
    timestamp: number;
  }>());
  const [creatorPercentageCache, setCreatorPercentageCache] = useState<{
    data: OfferCreatorMetrics[];
    timestamp: number;
  } | null>(null);
  
  // Debouncing
  const [debounceTimer, setDebounceTimer] = useState<NodeJS.Timeout | null>(null);

  // Fetch daily offers data
  const fetchDailyOffers = useCallback(async (days: number, forceRefresh = false) => {
    const cacheKey = days.toString();
    const cached = dailyOffersCache.get(cacheKey);
    const now = Date.now();
    
    // Use cache if available and not stale (5 minutes)
    if (!forceRefresh && cached && (now - cached.timestamp < 5 * 60 * 1000)) {
      setDailyOffersData(cached.data);
      setDailyOffersLoading(false);
      return;
    }
    
    setDailyOffersLoading(true);
    setDailyOffersError(null);
    
    try {
      const response = await fetch(`/api/analytics/offers/daily?days=${days}`);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const result: OfferAnalyticsResponse = await response.json();
      
      if (result.success && result.data.length > 0) {
        setDailyOffersData(result.data);
        
        // Update cache
        setDailyOffersCache(prev => new Map(prev).set(cacheKey, {
          data: result.data,
          timestamp: now,
        }));
      } else {
        // Try mock data fallback
        const mockResponse = await fetch(`/api/analytics/offers/daily/mock?days=${days}`);
        const mockResult: OfferAnalyticsResponse = await mockResponse.json();
        
        if (mockResult.success) {
          setDailyOffersData(mockResult.data);
          console.warn('Using mock data for daily offers');
        } else {
          throw new Error('Failed to fetch both real and mock data');
        }
      }
    } catch (error) {
      console.error('Error fetching daily offers:', error);
      setDailyOffersError(error instanceof Error ? error.message : 'Unknown error');
      setDailyOffersData([]);
    } finally {
      setDailyOffersLoading(false);
    }
  }, [dailyOffersCache]);

  // Fetch offer creator percentage data
  const fetchCreatorPercentages = useCallback(async (forceRefresh = false) => {
    const now = Date.now();
    
    // Use cache if available and not stale (10 minutes)
    if (!forceRefresh && creatorPercentageCache && (now - creatorPercentageCache.timestamp < 10 * 60 * 1000)) {
      setCreatorPercentageData(creatorPercentageCache.data);
      setCreatorPercentageLoading(false);
      return;
    }
    
    setCreatorPercentageLoading(true);
    setCreatorPercentageError(null);
    
    try {
      const response = await fetch('/api/analytics/offers/creator-percentage');
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const result: OfferCreatorAnalysisResponse = await response.json();
      
      if (result.success && result.data.length > 0) {
        setCreatorPercentageData(result.data);
        
        // Update cache
        setCreatorPercentageCache({
          data: result.data,
          timestamp: now,
        });
      } else {
        // Try mock data fallback
        const mockResponse = await fetch('/api/analytics/offers/creator-percentage/mock');
        const mockResult: OfferCreatorAnalysisResponse = await mockResponse.json();
        
        if (mockResult.success) {
          setCreatorPercentageData(mockResult.data);
          console.warn('Using mock data for creator percentages');
        } else {
          throw new Error('Failed to fetch both real and mock data');
        }
      }
    } catch (error) {
      console.error('Error fetching creator percentages:', error);
      setCreatorPercentageError(error instanceof Error ? error.message : 'Unknown error');
      setCreatorPercentageData([]);
    } finally {
      setCreatorPercentageLoading(false);
    }
  }, [creatorPercentageCache]);

  // Debounced fetch for daily offers
  const debouncedFetchDailyOffers = useCallback((days: number) => {
    if (debounceTimer) {
      clearTimeout(debounceTimer);
    }
    
    const timer = setTimeout(() => {
      fetchDailyOffers(days);
    }, 300);
    
    setDebounceTimer(timer);
  }, [debounceTimer, fetchDailyOffers]);

  // Handle date range changes
  const handleRangeChange = (days: number) => {
    setSelectedDays(days);
    debouncedFetchDailyOffers(days);
  };

  // Force refresh functions
  const refreshDailyOffers = () => {
    console.log('DEBUG: refreshDailyOffers called - clearing cache and forcing refresh');
    setDailyOffersCache(new Map());
    fetchDailyOffers(selectedDays, true); // Pass forceRefresh = true
  };

  const refreshCreatorPercentages = () => {
    setCreatorPercentageCache(null);
    fetchCreatorPercentages(true); // Pass forceRefresh = true
  };

  // Initial data loading
  useEffect(() => {
    fetchDailyOffers(selectedDays);
    fetchCreatorPercentages();
  }, []);

  // Cleanup debounce timer
  useEffect(() => {
    return () => {
      if (debounceTimer) {
        clearTimeout(debounceTimer);
      }
    };
  }, [debounceTimer]);

  return (
    <div className={`space-y-8 ${className}`}>
      {/* Daily Offers Section */}
      <div className="bg-white p-6 rounded-lg border border-slate-200 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-6">
          <div>
            <h2 className="text-xl font-semibold text-slate-800">Daily Offer Creation</h2>
            <p className="text-sm text-slate-600 mt-1">
              Offers created per day, subdivided by source (offer ideas vs regular)
            </p>
          </div>
          
          <div className="flex flex-col sm:flex-row gap-3 mt-4 sm:mt-0">
            <DateRangeToggle
              selectedDays={selectedDays}
              onRangeChange={handleRangeChange}
            />
            
            <button
              onClick={refreshDailyOffers}
              disabled={dailyOffersLoading}
              className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-lg border border-slate-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Refresh
            </button>
          </div>
        </div>
        
        {dailyOffersError ? (
          <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-red-700">Error: {dailyOffersError}</p>
          </div>
        ) : (
          <DailyOffersChart data={dailyOffersData} isLoading={dailyOffersLoading} />
        )}
      </div>

      {/* Offer Creator Percentage Section */}
      <div className="bg-white p-6 rounded-lg border border-slate-200 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-6">
          <div>
            <h2 className="text-xl font-semibold text-slate-800">Offer Creator Conversion</h2>
            <p className="text-sm text-slate-600 mt-1">
              Percentage of active users who created offers across time windows
            </p>
          </div>
          
          <button
            onClick={refreshCreatorPercentages}
            disabled={creatorPercentageLoading}
            className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-lg border border-slate-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors mt-4 sm:mt-0"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Refresh
          </button>
        </div>
        
        {creatorPercentageError ? (
          <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-red-700">Error: {creatorPercentageError}</p>
          </div>
        ) : (
          <OfferCreatorPercentageChart data={creatorPercentageData} isLoading={creatorPercentageLoading} />
        )}
      </div>
    </div>
  );
}
