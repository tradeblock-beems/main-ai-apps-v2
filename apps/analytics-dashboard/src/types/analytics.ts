/**
 * Analytics Dashboard TypeScript Interfaces
 * 
 * Type definitions for the analytics dashboard data layer,
 * ensuring end-to-end type safety from database to D3.js visualization.
 */

// Raw database record from fact table
export interface NewUserData {
  userID: string;
  createdAt: string; // ISO timestamp
  username: string;
  '1stClosetAdd': string | null; // ISO timestamp or null
  '1stWishlistAdd': string | null; // ISO timestamp or null  
  '1stOfferPosted': string | null; // ISO timestamp or null
  '1stOfferConfirmed': string | null; // ISO timestamp or null
}

// Aggregated data optimized for D3.js chart consumption
export interface ChartData {
  date: string; // YYYY-MM-DD format
  count: number; // Number of new users on this date
  timestamp: number; // Unix timestamp for D3.js time scales
}

// Date range filtering interface
export interface DateRange {
  startDate: string; // YYYY-MM-DD format
  endDate: string; // YYYY-MM-DD format
  days: number; // Number of days in range (7, 14, 30, 60, 90)
}

// API response wrapper
export interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
  timestamp: string;
  recordCount: number;
}

// Chart configuration interface
export interface ChartConfig {
  width: number;
  height: number;
  margin: {
    top: number;
    right: number;
    bottom: number;
    left: number;
  };
  dateRange: DateRange;
}

// API endpoint query parameters
export interface NewUsersQueryParams {
  startDate?: string; // Optional date range start (YYYY-MM-DD)
  endDate?: string; // Optional date range end (YYYY-MM-DD)
  days?: string; // Optional predefined range (7, 14, 30, 60, 90)
}

// Database query result for aggregation
export interface DailyUserCount {
  date: Date;
  count: string; // COUNT returns string from PostgreSQL
}

// Error response interface
export interface ApiError {
  success: false;
  error: string;
  code: string;
  timestamp: string;
}

// === COHORT ANALYSIS INTERFACES (Phase 6.5) ===

// Individual action completion metrics
export interface CohortActionMetrics {
  count: number;
  percentage: number;
}

// Complete cohort data for a single period
export interface CohortData {
  cohortPeriod: string; // "2024-01" (monthly) or "2024-W03" (weekly)
  cohortStartDate: string; // First day of cohort period (YYYY-MM-DD)
  totalUsers: number; // Total users in this cohort
  actions: {
    closetAdd: CohortActionMetrics;
    wishlistAdd: CohortActionMetrics;
    createOffer: CohortActionMetrics;
    allActions: CohortActionMetrics; // Users who completed all 3 actions
  };
}

// Cohort period type for API parameters
export type CohortPeriodType = 'monthly' | 'weekly';

// API query parameters for cohort analysis
export interface CohortAnalysisParams {
  period: CohortPeriodType; // monthly or weekly
  months?: string; // Number of periods to analyze (default: 12 for monthly, 24 for weekly)
}

// API response for cohort analysis
export interface CohortAnalysisResponse extends ApiResponse<CohortData[]> {
  metadata: {
    periodType: CohortPeriodType;
    periodsAnalyzed: number;
    analysisWindow: string; // "72 hours"
    generatedAt: string;
  };
}

// Chart configuration for cohort visualization
export interface CohortChartConfig {
  width: number;
  height: number;
  margin: {
    top: number;
    right: number;
    bottom: number;
    left: number;
  };
  colors: CohortColorScheme;
  periodType: CohortPeriodType;
}

// Color scheme for different action types
export interface CohortColorScheme {
  closetAdd: string; // Blue theme
  wishlistAdd: string; // Green theme  
  createOffer: string; // Orange theme
  allActions: string; // Purple theme
}
