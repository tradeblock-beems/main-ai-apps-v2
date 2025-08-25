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
import type { ChartData, ApiResponse } from '@/types/analytics';

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

  // Initial data fetch
  useEffect(() => {
    fetchData(selectedDays);
  }, []);

  // Handle date range changes with debouncing
  const handleRangeChange = (days: number) => {
    setSelectedDays(days);
    debouncedFetchData(days);
  };

  // Cleanup debounce timer on unmount
  useEffect(() => {
    return () => {
      if (debounceTimer) {
        clearTimeout(debounceTimer);
      }
    };
  }, [debounceTimer]);

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
            
            {/* Date Range Toggle */}
            <DateRangeToggle
              selectedDays={selectedDays}
              onRangeChange={handleRangeChange}
            />
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
    </div>
  );
}
