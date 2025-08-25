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

  // Fetch data from API
  const fetchData = async (days: number) => {
    setIsLoading(true);
    setError(null);
    
    try {
      const response = await fetch(`/api/analytics/new-users/mock?days=${days}`);
      
      if (!response.ok) {
        throw new Error(`API request failed: ${response.status}`);
      }
      
      const data: ApiResponse<ChartData[]> = await response.json();
      
      if (!data.success) {
        throw new Error(data.message || 'API request failed');
      }
      
      setChartData(data.data);
      setTotalUsers(data.recordCount);
    } catch (err) {
      console.error('Failed to fetch chart data:', err);
      setError(err instanceof Error ? err.message : 'Failed to load data');
      setChartData([]);
      setTotalUsers(0);
    } finally {
      setIsLoading(false);
    }
  };

  // Initial data fetch
  useEffect(() => {
    fetchData(selectedDays);
  }, []);

  // Handle date range changes
  const handleRangeChange = (days: number) => {
    setSelectedDays(days);
    fetchData(days);
  };

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
