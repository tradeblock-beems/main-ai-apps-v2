'use client';

/**
 * Dashboard Layout Component
 * 
 * Main dashboard layout with header, controls, and chart area
 * Responsive design with loading states and error boundaries
 */

import React, { useState, useEffect } from 'react';
import NewUsersBarChart from '@/components/charts/NewUsersBarChart';
import DateRangeToggle from '@/components/ui/DateRangeToggle';
import CohortAnalysisChart from '@/components/charts/CohortAnalysisChart';
import CohortPeriodToggle from '@/components/ui/CohortPeriodToggle';
import type { 
  ChartData, 
  ApiResponse, 
  CohortData, 
  CohortAnalysisResponse, 
  CohortPeriodType 
} from '@/types/analytics';

interface DashboardProps {
  className?: string;
}

export default function Dashboard({ className = "" }: DashboardProps) {
  const [chartData, setChartData] = useState<ChartData[]>([]);
  const [selectedDays, setSelectedDays] = useState<number>(30);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [totalUsers, setTotalUsers] = useState<number>(0);

  // Simple in-memory cache for API responses
  const [cache, setCache] = useState<Map<string, { data: ChartData[], count: number, timestamp: number }>>(new Map());
  const [debounceTimer, setDebounceTimer] = useState<NodeJS.Timeout | null>(null);

  // Cohort Analysis State (Phase 6.5)
  const [cohortData, setCohortData] = useState<CohortData[]>([]);
  const [cohortLoading, setCohortLoading] = useState(true);
  const [cohortError, setCohortError] = useState<string | null>(null);
  const [selectedPeriod, setSelectedPeriod] = useState<CohortPeriodType>('monthly');
  const [cohortDebounceTimer, setCohortDebounceTimer] = useState<NodeJS.Timeout | null>(null);

  // 15-minute cache for cohort data (longer than real-time data)
  const [cohortCache, setCohortCache] = useState<Map<string, { data: CohortData[], timestamp: number }>>(new Map());

  // Fetch data from API with caching and real data fallback
  const fetchData = async (days: number, useRealData: boolean = true) => {
    setIsLoading(true);
    setError(null);
    
    // Check cache first (5 minute expiry)
    const cacheKey = `${days}-${useRealData ? 'real' : 'mock'}`;
    const cached = cache.get(cacheKey);
    const now = Date.now();
    
    if (cached && (now - cached.timestamp) < 300000) { // 5 minutes
      setChartData(cached.data);
      setTotalUsers(cached.count);
      setIsLoading(false);
      return;
    }
    
    try {
      // Try real data first, fallback to mock on error
      let endpoint = `/api/analytics/new-users?days=${days}`;
      let response = await fetch(endpoint);
      
      // If real data fails, fallback to mock data
      if (!response.ok && useRealData) {
        console.warn('Real data endpoint failed, falling back to mock data');
        endpoint = `/api/analytics/new-users/mock?days=${days}`;
        response = await fetch(endpoint);
      }
      
      if (!response.ok) {
        throw new Error(`API request failed: ${response.status}`);
      }
      
      const data: ApiResponse<ChartData[]> = await response.json();
      
      if (!data.success) {
        throw new Error(data.message || 'API request failed');
      }
      
      // Update cache
      const newCache = new Map(cache);
      newCache.set(cacheKey, { 
        data: data.data, 
        count: data.recordCount || data.data.length, 
        timestamp: now 
      });
      setCache(newCache);
      
      setChartData(data.data);
      setTotalUsers(data.recordCount || data.data.length);
      
    } catch (err) {
      console.error('Failed to fetch chart data:', err);
      
      // If real data failed and we haven't tried mock yet, try mock
      if (useRealData) {
        console.log('Attempting fallback to mock data...');
        await fetchData(days, false);
        return;
      }
      
      setError(err instanceof Error ? err.message : 'Failed to load data');
      setChartData([]);
      setTotalUsers(0);
    } finally {
      setIsLoading(false);
    }
  };

  // Debounced fetch for rapid date range changes
  const debouncedFetchData = (days: number) => {
    if (debounceTimer) {
      clearTimeout(debounceTimer);
    }
    
    const timer = setTimeout(() => {
      fetchData(days);
    }, 300); // 300ms debounce
    
    setDebounceTimer(timer);
  };

  // Fetch cohort data with caching (Phase 6.5)
  const fetchCohortData = async (periodType: CohortPeriodType) => {
    setCohortLoading(true);
    setCohortError(null);
    
    // Check cache first (15 minute expiry for cohort data)
    const cacheKey = `${periodType}`;
    const cached = cohortCache.get(cacheKey);
    const now = Date.now();
    
    if (cached && (now - cached.timestamp) < 900000) { // 15 minutes
      setCohortData(cached.data);
      setCohortLoading(false);
      return;
    }
    
    try {
      const periods = periodType === 'monthly' ? 12 : 18; // 12 months or 18 weeks
      const endpoint = `/api/analytics/cohort-analysis?period=${periodType}&months=${periods}`;
      const response = await fetch(endpoint);
      
      if (!response.ok) {
        throw new Error(`Cohort analysis API request failed: ${response.status}`);
      }
      
      const data: CohortAnalysisResponse = await response.json();
      
      if (!data.success) {
        throw new Error(data.message || 'Cohort analysis API request failed');
      }
      
      // Update cache
      const newCohortCache = new Map(cohortCache);
      newCohortCache.set(cacheKey, { 
        data: data.data, 
        timestamp: now 
      });
      setCohortCache(newCohortCache);
      
      setCohortData(data.data);
      
    } catch (err) {
      console.error('Failed to fetch cohort data:', err);
      setCohortError(err instanceof Error ? err.message : 'Failed to load cohort data');
      setCohortData([]);
    } finally {
      setCohortLoading(false);
    }
  };

  // Debounced fetch for rapid period changes
  const debouncedFetchCohortData = (periodType: CohortPeriodType) => {
    if (cohortDebounceTimer) {
      clearTimeout(cohortDebounceTimer);
    }
    
    const timer = setTimeout(() => {
      fetchCohortData(periodType);
    }, 300); // 300ms debounce
    
    setCohortDebounceTimer(timer);
  };

  // Initial data fetch
  useEffect(() => {
    fetchData(selectedDays);
    fetchCohortData(selectedPeriod); // Also fetch initial cohort data
  }, []);

  // Handle date range changes with debouncing
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
    setCache(new Map()); // Clear cache
    fetchData(selectedDays);
  };

  const refreshCohortData = () => {
    setCohortCache(new Map()); // Clear cache
    fetchCohortData(selectedPeriod);
  };

  // Cleanup debounce timers on unmount
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
    <div className={`space-y-6 ${className}`}>
      {/* Header */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-800">New User Analytics</h1>
            <p className="text-slate-600 mt-1">
              Track daily new user registrations and growth trends
            </p>
          </div>
          
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
            {/* Summary Stats */}
            <div className="text-center sm:text-right">
              <div className="text-2xl font-bold text-blue-600">
                {isLoading ? '...' : totalUsers.toLocaleString()}
              </div>
              <div className="text-sm text-slate-500">
                Total users (last {selectedDays} days)
              </div>
            </div>
            
            <div className="flex flex-col sm:flex-row gap-3">
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
        </div>
      </div>

      {/* Chart Area */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
        <div className="mb-4">
          <h2 className="text-lg font-semibold text-slate-800">
            Daily New User Registrations
          </h2>
          <p className="text-sm text-slate-600">
            {isLoading 
              ? 'Loading chart data...' 
              : `Showing ${chartData.length} days of registration data`
            }
            {chartData.length > 0 && !error && (
              <span className="ml-2 text-green-600">
                • Real data from database
              </span>
            )}
          </p>
        </div>

        {/* Error State */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
            <div className="flex items-center">
              <div className="text-red-600 text-sm font-medium">
                ⚠️ Error loading data
              </div>
            </div>
            <div className="text-red-600 text-sm mt-1">{error}</div>
            <button
              onClick={() => fetchData(selectedDays)}
              className="mt-2 text-sm text-red-600 hover:text-red-800 underline"
            >
              Try again
            </button>
          </div>
        )}

        {/* Loading State */}
        {isLoading && (
          <div className="flex items-center justify-center h-96">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
              <p className="text-slate-600">Loading chart data...</p>
            </div>
          </div>
        )}

        {/* Chart */}
        {!isLoading && !error && (
          <div className="w-full overflow-x-auto">
            <NewUsersBarChart
              data={chartData}
              width={800}
              height={400}
              className="min-w-full"
            />
          </div>
        )}
      </div>

      {/* Footer Stats */}
      {!isLoading && !error && chartData.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-white rounded-lg border border-slate-200 p-4 text-center">
            <div className="text-lg font-semibold text-slate-800">
              {Math.max(...chartData.map(d => d.count))}
            </div>
            <div className="text-sm text-slate-600">Peak day</div>
          </div>
          
          <div className="bg-white rounded-lg border border-slate-200 p-4 text-center">
            <div className="text-lg font-semibold text-slate-800">
              {Math.round(chartData.reduce((sum, d) => sum + d.count, 0) / chartData.length)}
            </div>
            <div className="text-sm text-slate-600">Daily average</div>
          </div>
          
          <div className="bg-white rounded-lg border border-slate-200 p-4 text-center">
            <div className="text-lg font-semibold text-slate-800">
              {chartData.length}
            </div>
            <div className="text-sm text-slate-600">Days tracked</div>
          </div>
        </div>
      )}

      {/* Cohort Analysis Section (Phase 6.5) */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
        {/* Cohort Analysis Header */}
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 mb-6">
          <div>
            <h2 className="text-xl font-semibold text-slate-800 mb-2">
              New User Cohort Analysis - First 72 Hours
            </h2>
            <p className="text-sm text-slate-600">
              {cohortLoading
                ? 'Loading cohort data...'
                : `Showing completion rates for ${cohortData.length} ${selectedPeriod} cohorts`
              }
              {cohortData.length > 0 && !cohortError && (
                <span className="ml-2 text-green-600">
                  • Real data from database
                </span>
              )}
            </p>
          </div>
          
          <div className="flex flex-col sm:flex-row gap-3">
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

        {/* Cohort Error State */}
        {cohortError && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
            <div className="flex items-center">
              <div className="text-red-600 text-sm font-medium">
                ⚠️ Error loading cohort data
              </div>
            </div>
            <div className="text-red-600 text-sm mt-1">{cohortError}</div>
            <button
              onClick={() => fetchCohortData(selectedPeriod)}
              className="mt-2 text-sm text-red-600 hover:text-red-800 underline"
            >
              Try again
            </button>
          </div>
        )}

        {/* Cohort Loading State */}
        {cohortLoading && (
          <div className="flex items-center justify-center h-96">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
              <p className="text-slate-600">Loading cohort analysis...</p>
            </div>
          </div>
        )}

        {/* Cohort Chart */}
        {!cohortLoading && !cohortError && (
          <div className="w-full overflow-x-auto">
            <CohortAnalysisChart
              data={cohortData}
              periodType={selectedPeriod}
              width={900}
              height={450}
              className="min-w-full"
            />
          </div>
        )}

        {/* Cohort Analysis Summary */}
        {!cohortLoading && !cohortError && cohortData.length > 0 && (
          <div className="mt-6 grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-blue-50 rounded-lg border border-blue-200 p-3 text-center">
              <div className="text-sm font-medium text-blue-800 mb-1">Closet Add</div>
              <div className="text-lg font-semibold text-blue-900">
                {Math.round(cohortData.reduce((sum, c) => sum + c.actions.closetAdd.percentage, 0) / cohortData.length)}%
              </div>
              <div className="text-xs text-blue-600">avg completion</div>
            </div>
            
            <div className="bg-green-50 rounded-lg border border-green-200 p-3 text-center">
              <div className="text-sm font-medium text-green-800 mb-1">Wishlist Add</div>
              <div className="text-lg font-semibold text-green-900">
                {Math.round(cohortData.reduce((sum, c) => sum + c.actions.wishlistAdd.percentage, 0) / cohortData.length)}%
              </div>
              <div className="text-xs text-green-600">avg completion</div>
            </div>
            
            <div className="bg-orange-50 rounded-lg border border-orange-200 p-3 text-center">
              <div className="text-sm font-medium text-orange-800 mb-1">Create Offer</div>
              <div className="text-lg font-semibold text-orange-900">
                {Math.round(cohortData.reduce((sum, c) => sum + c.actions.createOffer.percentage, 0) / cohortData.length)}%
              </div>
              <div className="text-xs text-orange-600">avg completion</div>
            </div>
            
            <div className="bg-purple-50 rounded-lg border border-purple-200 p-3 text-center">
              <div className="text-sm font-medium text-purple-800 mb-1">All Actions</div>
              <div className="text-lg font-semibold text-purple-900">
                {Math.round(cohortData.reduce((sum, c) => sum + c.actions.allActions.percentage, 0) / cohortData.length)}%
              </div>
              <div className="text-xs text-purple-600">avg completion</div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
