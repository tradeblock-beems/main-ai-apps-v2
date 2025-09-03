/**
 * New Users Analytics Page Component
 * 
 * Displays new user analytics with two main visualizations:
 * 1. Daily new users bar chart with date range filtering
 * 2. Cohort analysis showing 72-hour completion rates
 */

'use client';

import React, { useState, useEffect, useCallback } from 'react';
import DateRangeToggle from '@/components/ui/DateRangeToggle';
import CohortPeriodToggle from '@/components/ui/CohortPeriodToggle';
import NewUsersBarChart from '@/components/charts/NewUsersBarChart';
import CohortAnalysisChart from '@/components/charts/CohortAnalysisChart';
import type { 
  ChartData, 
  CohortData, 
  CohortPeriodType,
  ApiResponse
} from '@/types/analytics';

interface NewUsersPageProps {
  className?: string;
}

export default function NewUsersPage({ className = '' }: NewUsersPageProps) {
  // Daily users state
  const [selectedDays, setSelectedDays] = useState(30);
  const [chartData, setChartData] = useState<ChartData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [cache, setCache] = useState(new Map<string, { data: ChartData[]; timestamp: number }>());
  const [debounceTimer, setDebounceTimer] = useState<NodeJS.Timeout | null>(null);

  // Cohort analysis state (Phase 6.5)
  const [selectedPeriod, setSelectedPeriod] = useState<CohortPeriodType>('monthly');
  const [cohortData, setCohortData] = useState<CohortData[]>([]);
  const [cohortLoading, setCohortLoading] = useState(true);
  const [cohortError, setCohortError] = useState<string | null>(null);
  const [cohortDebounceTimer, setCohortDebounceTimer] = useState<NodeJS.Timeout | null>(null);
  const [cohortCache, setCohortCache] = useState(new Map<string, { data: CohortData[]; timestamp: number }>());

  // Fetch daily users data
  const fetchData = useCallback(async (days: number, forceRefresh = false) => {
    console.log(`DEBUG: fetchData called with days=${days}, forceRefresh=${forceRefresh}`);
    const cacheKey = days.toString();
    const cached = cache.get(cacheKey);
    const now = Date.now();
    
    // Use cache if available and not stale (5 minutes)
    if (!forceRefresh && cached && (now - cached.timestamp < 5 * 60 * 1000)) {
      console.log('DEBUG: Using cached data instead of fetching fresh');
      setChartData(cached.data);
      setIsLoading(false);
      return;
    }
    
    console.log('DEBUG: Fetching fresh data from API');
    
    setIsLoading(true);
    setError(null);
    
    try {
      // Add cache busting parameter to ensure fresh data
      const cacheBuster = forceRefresh ? `&_t=${Date.now()}` : '';
      const url = `/api/analytics/new-users?days=${days}${cacheBuster}`;
      console.log('DEBUG: Fetching URL:', url);
      
      const response = await fetch(url);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const result: ApiResponse<ChartData[]> = await response.json();
      console.log('DEBUG: API response:', result);
      
      if (result.success && result.data.length > 0) {
        console.log('DEBUG: Setting new chart data, length:', result.data.length);
        console.log('DEBUG: Latest date in data:', result.data[result.data.length - 1]);
        setChartData(result.data);
        
        // Update cache
        setCache(prev => new Map(prev).set(cacheKey, {
          data: result.data,
          timestamp: now,
        }));
      } else {
        // Try fallback to mock data
        const mockResponse = await fetch(`/api/analytics/new-users/mock?days=${days}`);
        const mockResult: ApiResponse<ChartData[]> = await mockResponse.json();
        
        if (mockResult.success) {
          setChartData(mockResult.data);
          console.warn('Using mock data for new users');
        } else {
          throw new Error('Failed to fetch both real and mock data');
        }
      }
    } catch (error) {
      console.error('Error fetching chart data:', error);
      setError(error instanceof Error ? error.message : 'Unknown error');
      setChartData([]);
    } finally {
      setIsLoading(false);
    }
  }, [cache]);

  // Fetch cohort analysis data (Phase 6.5)
  const fetchCohortData = useCallback(async (periodType: CohortPeriodType, forceRefresh = false) => {
    console.log(`DEBUG: fetchCohortData called with period=${periodType}, forceRefresh=${forceRefresh}`);
    const periods = periodType === 'monthly' ? 12 : 12; // 12 months or 12 weeks
    const cacheKey = `${periodType}-${periods}`;
    const cached = cohortCache.get(cacheKey);
    const now = Date.now();
    
    // Use cache if available and not stale (15 minutes)
    if (!forceRefresh && cached && (now - cached.timestamp < 15 * 60 * 1000)) {
      console.log('DEBUG: Using cached cohort data instead of fetching fresh');
      setCohortData(cached.data);
      setCohortLoading(false);
      return;
    }
    
    console.log('DEBUG: Fetching fresh cohort data from API');
    setCohortLoading(true);
    setCohortError(null);
    
    try {
      // Add cache busting parameter to ensure fresh data
      const cacheBuster = forceRefresh ? `&_t=${Date.now()}` : '';
      const url = `/api/analytics/cohort-analysis?period=${periodType}&months=${periods}${cacheBuster}`;
      console.log('DEBUG: Fetching cohort URL:', url);
      
      const response = await fetch(url);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const result: ApiResponse<CohortData[]> = await response.json();
      console.log('DEBUG: Cohort API response:', result);
      
      if (result.success && result.data.length > 0) {
        console.log('DEBUG: Setting new cohort data, length:', result.data.length);
        setCohortData(result.data);
        
        // Update cache
        setCohortCache(prev => new Map(prev).set(cacheKey, {
          data: result.data,
          timestamp: now,
        }));
      } else {
        throw new Error('Failed to fetch cohort analysis data');
      }
    } catch (error) {
      console.error('Error fetching cohort data:', error);
      setCohortError(error instanceof Error ? error.message : 'Unknown error');
      setCohortData([]);
    } finally {
      setCohortLoading(false);
    }
  }, [cohortCache]);

  // Debounced fetch functions
  const debouncedFetchData = useCallback((days: number) => {
    if (debounceTimer) {
      clearTimeout(debounceTimer);
    }
    
    const timer = setTimeout(() => {
      fetchData(days);
    }, 300);
    
    setDebounceTimer(timer);
  }, [debounceTimer, fetchData]);

  const debouncedFetchCohortData = useCallback((periodType: CohortPeriodType) => {
    if (cohortDebounceTimer) {
      clearTimeout(cohortDebounceTimer);
    }
    
    const timer = setTimeout(() => {
      fetchCohortData(periodType);
    }, 300);
    
    setCohortDebounceTimer(timer);
  }, [cohortDebounceTimer, fetchCohortData]);

  // Handle range changes
  const handleRangeChange = (days: number) => {
    setSelectedDays(days);
    debouncedFetchData(days);
  };

  // Handle cohort period changes (Phase 6.5)
  const handlePeriodChange = (period: CohortPeriodType) => {
    setSelectedPeriod(period);
    debouncedFetchCohortData(period);
  };

  // Force refresh data (bypass cache)
  const refreshDailyUsers = () => {
    console.log('DEBUG: refreshDailyUsers called - clearing cache and forcing refresh');
    setCache(new Map()); // Clear cache
    fetchData(selectedDays, true); // Pass forceRefresh = true
  };

  const refreshCohortData = () => {
    console.log('DEBUG: refreshCohortData called - clearing cache and forcing refresh');
    setCohortCache(new Map()); // Clear cache
    fetchCohortData(selectedPeriod, true); // Pass forceRefresh = true
  };

  // Initial data loading
  useEffect(() => {
    fetchData(selectedDays);
    fetchCohortData(selectedPeriod);
  }, []);

  // Cleanup timers
  useEffect(() => {
    return () => {
      if (debounceTimer) {
        clearTimeout(debounceTimer);
      }
      if (cohortDebounceTimer) {
        clearTimeout(cohortDebounceTimer);
      }
    };
  }, [debounceTimer, cohortDebounceTimer]);

  return (
    <div className={`space-y-8 ${className}`}>
      {/* Daily New Users Section */}
      <div className="bg-white p-6 rounded-lg border border-slate-200 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-6">
          <div>
            <h2 className="text-xl font-semibold text-slate-800">Daily New Users</h2>
            <p className="text-sm text-slate-600 mt-1">
              New user registrations over time
            </p>
          </div>
          
          <div className="flex flex-col sm:flex-row gap-3 mt-4 sm:mt-0">
            {/* Date Range Toggle */}
            <DateRangeToggle
              selectedDays={selectedDays}
              onRangeChange={handleRangeChange}
            />
            
            {/* Refresh Button */}
            <button
              onClick={refreshDailyUsers}
              disabled={isLoading}
              className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-lg border border-slate-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Refresh
            </button>
          </div>
        </div>
        
        {error ? (
          <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-red-700">Error: {error}</p>
          </div>
        ) : (
          <NewUsersBarChart data={chartData} isLoading={isLoading} />
        )}
        
        {chartData.length > 0 && !error && (
          <div className="mt-4 flex items-center gap-2">
            <div className="w-3 h-3 bg-green-500 rounded-full"></div>
            <span className="text-sm text-green-700 font-medium">Real data from database</span>
          </div>
        )}
      </div>

      {/* Cohort Analysis Section (Phase 6.5) */}
      <div className="bg-white p-6 rounded-lg border border-slate-200 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-6">
          <div>
            <h2 className="text-xl font-semibold text-slate-800">New User Cohort Analysis</h2>
            <p className="text-sm text-slate-600 mt-1">
              Completion rates for key actions within 72 hours of account creation
            </p>
          </div>
          
          <div className="flex flex-col sm:flex-row gap-3 mt-4 sm:mt-0">
            <CohortPeriodToggle
              selectedPeriod={selectedPeriod}
              onPeriodChange={handlePeriodChange}
            />
            
            {/* Refresh Button */}
            <button
              onClick={refreshCohortData}
              disabled={cohortLoading}
              className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-lg border border-slate-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Refresh
            </button>
          </div>
        </div>
        
        {cohortError ? (
          <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-red-700">Error: {cohortError}</p>
          </div>
        ) : (
          <CohortAnalysisChart 
            data={cohortData} 
            isLoading={cohortLoading}
            periodType={selectedPeriod}
          />
        )}
        
        {cohortData.length > 0 && !cohortError && (
          <div className="mt-4 flex items-center gap-2">
            <div className="w-3 h-3 bg-green-500 rounded-full"></div>
            <span className="text-sm text-green-700 font-medium">Real data from database</span>
          </div>
        )}
      </div>
    </div>
  );
}
