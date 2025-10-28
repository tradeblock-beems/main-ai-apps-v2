/**
 * Database Connection Utility
 * 
 * PostgreSQL connection management with connection pooling,
 * error handling, and optimized query execution for analytics workloads.
 */

import { Pool, PoolClient, QueryResult, QueryResultRow } from 'pg';
import { DATABASE_URL } from '@/lib/config';

// Connection pool configuration optimized for analytics workloads
// Only initialize pool if DATABASE_URL is configured
const pool: Pool | null = DATABASE_URL ? new Pool({
  connectionString: DATABASE_URL,
  max: 10, // Maximum number of connections in pool
  idleTimeoutMillis: 30000, // Close idle connections after 30 seconds
  connectionTimeoutMillis: 10000, // Timeout for new connections
  statement_timeout: 30000, // 30 second query timeout
  query_timeout: 30000, // 30 second query timeout
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
}) : null; // null pool will cause queries to fail gracefully with clear error messages

// Database connection health check
export async function checkDatabaseConnection(): Promise<boolean> {
  if (!pool) {
    console.warn('Database pool not initialized - DATABASE_URL not configured');
    return false;
  }

  try {
    const client = await pool.connect();
    const result = await client.query('SELECT NOW()');
    client.release();
    return result.rows.length > 0;
  } catch (error) {
    console.error('Database connection health check failed:', error);
    return false;
  }
}

// Execute query with automatic connection management
export async function executeQuery<T extends QueryResultRow = QueryResultRow>(
  query: string,
  params: unknown[] = []
): Promise<QueryResult<T>> {
  if (!pool) {
    throw new Error('Database pool not initialized - DATABASE_URL not configured');
  }

  const client: PoolClient = await pool.connect();
  
  try {
    const startTime = Date.now();
    const result = await client.query<T>(query, params);
    const executionTime = Date.now() - startTime;
    
    // Log slow queries for performance monitoring
    if (executionTime > 5000) {
      console.warn(`Slow query detected (${executionTime}ms):`, {
        query: query.substring(0, 100) + '...',
        executionTime,
        rowCount: result.rowCount
      });
    }
    
    return result;
  } catch (error) {
    console.error('Database query error:', {
      error: error instanceof Error ? error.message : 'Unknown error',
      query: query.substring(0, 100) + '...',
      params
    });
    throw error;
  } finally {
    client.release();
  }
}

// Get new users aggregated by day with date range filtering
export async function getNewUsersByDay(
  startDate?: string,
  endDate?: string
): Promise<{ date: Date; count: number }[]> {
  
  // Default to last 30 days if no range specified
  const defaultEndDate = new Date().toISOString().split('T')[0];
  const defaultStartDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
    .toISOString().split('T')[0];
  
  const actualStartDate = startDate || defaultStartDate;
  const actualEndDate = endDate || defaultEndDate;
  
  const query = `
    SELECT 
      DATE(created_at AT TIME ZONE 'UTC' AT TIME ZONE 'America/Chicago') as date,
      COUNT(*) as count
    FROM users 
    WHERE created_at >= $1::date 
    AND created_at < ($2::date + INTERVAL '1 day')
    AND created_at >= '2025-03-05'
    AND deleted_at = 0
    GROUP BY DATE(created_at AT TIME ZONE 'UTC' AT TIME ZONE 'America/Chicago')
    ORDER BY date ASC
  `;
  
  const result = await executeQuery<{ date: Date; count: string }>(
    query, 
    [actualStartDate, actualEndDate]
  );
  
  return result.rows.map(row => ({
    date: row.date,
    count: parseInt(row.count, 10)
  }));
}

// Get total count of new users for summary statistics
export async function getNewUsersCount(
  startDate?: string,
  endDate?: string
): Promise<number> {
  
  const defaultEndDate = new Date().toISOString().split('T')[0];
  const defaultStartDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
    .toISOString().split('T')[0];
  
  const actualStartDate = startDate || defaultStartDate;
  const actualEndDate = endDate || defaultEndDate;
  
  const query = `
    SELECT COUNT(*) as total
    FROM users 
    WHERE created_at >= $1::date 
    AND created_at < ($2::date + INTERVAL '1 day')
    AND created_at >= '2025-03-05'
    AND deleted_at = 0
  `;
  
  const result = await executeQuery<{ total: string }>(
    query, 
    [actualStartDate, actualEndDate]
  );
  
  return parseInt(result.rows[0]?.total || '0', 10);
}

// Get cohort analysis data with 72-hour completion rates
export async function getCohortAnalysis(
  periodType: 'monthly' | 'weekly' = 'monthly',
  periods: number = 12
): Promise<any[]> {
  
  const query = periodType === 'monthly' ? `
    WITH monthly_cohorts AS (
      -- Group users by month joined (starting March 2025)
      SELECT 
        DATE_TRUNC('month', created_at) as cohort_month,
        id as user_id,
        created_at as join_date,
        username
      FROM users 
      WHERE created_at >= '2025-03-05'::date
        AND deleted_at = 0
    ),
    cohort_actions AS (
      -- Calculate completion status for each user within 72 hours
      SELECT 
        mc.cohort_month,
        mc.user_id,
        mc.join_date,
        mc.username,
        
        -- Closet Add (first inventory item addition)
        CASE WHEN MIN(ii.created_at) <= mc.join_date + INTERVAL '72 hours'
             THEN 1 ELSE 0 END as completed_closet_add,
             
        -- Wishlist Add (first wishlist item addition) 
        CASE WHEN MIN(wi.created_at) <= mc.join_date + INTERVAL '72 hours'
             THEN 1 ELSE 0 END as completed_wishlist_add,
             
        -- Create Offer (first offer creation)
        CASE WHEN MIN(o.created_at) <= mc.join_date + INTERVAL '72 hours'
             THEN 1 ELSE 0 END as completed_create_offer,
             
        -- Confirmed Transaction (simple scalar subquery for performance)
        CASE WHEN EXISTS (
          SELECT 1 
          FROM offer_checkouts oc
          JOIN offers o ON oc.offer_id = o.id
          JOIN trades t ON o.id = t.offer_id
          WHERE oc.user_id = mc.user_id
          AND oc.deleted_at = 0
          AND o.deleted_at = 0 
          AND t.deleted_at = 0
          AND t.created_at <= mc.join_date + INTERVAL '72 hours'
        ) THEN 1 ELSE 0 END as completed_confirmed_transaction
             
      FROM monthly_cohorts mc
      LEFT JOIN inventory_items ii ON mc.user_id = ii.user_id AND ii.deleted_at = 0
      LEFT JOIN wishlist_items wi ON mc.user_id = wi.user_id AND wi.deleted_at = 0  
      LEFT JOIN offers o ON mc.user_id = o.creator_user_id AND o.deleted_at = 0
      GROUP BY mc.cohort_month, mc.user_id, mc.join_date, mc.username
    ),
    cohort_summary AS (
      -- Calculate completion rates per cohort
      SELECT 
        cohort_month,
        COUNT(*) as total_users,
        
        -- Individual action completion rates
        SUM(completed_closet_add) as closet_add_count,
        ROUND(SUM(completed_closet_add) * 100.0 / COUNT(*), 2) as closet_add_percentage,
        
        SUM(completed_wishlist_add) as wishlist_add_count, 
        ROUND(SUM(completed_wishlist_add) * 100.0 / COUNT(*), 2) as wishlist_add_percentage,
        
        SUM(completed_create_offer) as create_offer_count,
        ROUND(SUM(completed_create_offer) * 100.0 / COUNT(*), 2) as create_offer_percentage,
        
        -- All actions completion (users who completed all 3 traditional actions - NOT including confirmed transactions)
        SUM(CASE WHEN completed_closet_add = 1 AND completed_wishlist_add = 1 AND completed_create_offer = 1 
                 THEN 1 ELSE 0 END) as all_actions_count,
        ROUND(SUM(CASE WHEN completed_closet_add = 1 AND completed_wishlist_add = 1 AND completed_create_offer = 1 
                      THEN 1 ELSE 0 END) * 100.0 / COUNT(*), 2) as all_actions_percentage,
        
        -- Confirmed transactions completion (separate metric, far right column)
        SUM(completed_confirmed_transaction) as confirmed_transaction_count,
        ROUND(SUM(completed_confirmed_transaction) * 100.0 / COUNT(*), 2) as confirmed_transaction_percentage
                      
      FROM cohort_actions
      GROUP BY cohort_month
    )
    SELECT 
      cohort_month,
      TO_CHAR(cohort_month, 'YYYY-MM') as cohort_period,
      total_users,
      closet_add_count,
      closet_add_percentage,
      wishlist_add_count,
      wishlist_add_percentage, 
      create_offer_count,
      create_offer_percentage,
      all_actions_count,
      all_actions_percentage,
      confirmed_transaction_count,
      confirmed_transaction_percentage
    FROM cohort_summary
    ORDER BY cohort_month DESC
    LIMIT $1
  ` : `
    WITH weekly_cohorts AS (
      -- Group users by week joined (starting March 2025)
      SELECT 
        DATE_TRUNC('week', created_at) as cohort_week,
        id as user_id,
        created_at as join_date,
        username
      FROM users 
      WHERE created_at >= '2025-03-05'::date
        AND deleted_at = 0
    ),
    cohort_actions AS (
      -- Calculate completion status for each user within 72 hours
      SELECT 
        wc.cohort_week,
        wc.user_id,
        wc.join_date,
        wc.username,
        
        -- Closet Add (first inventory item addition)
        CASE WHEN MIN(ii.created_at) <= wc.join_date + INTERVAL '72 hours'
             THEN 1 ELSE 0 END as completed_closet_add,
             
        -- Wishlist Add (first wishlist item addition) 
        CASE WHEN MIN(wi.created_at) <= wc.join_date + INTERVAL '72 hours'
             THEN 1 ELSE 0 END as completed_wishlist_add,
             
        -- Create Offer (first offer creation)
        CASE WHEN MIN(o.created_at) <= wc.join_date + INTERVAL '72 hours'
             THEN 1 ELSE 0 END as completed_create_offer,
             
        -- Confirmed Transaction (temporarily disabled for weekly performance - using 0 as placeholder)
        -- Weekly cohort analysis creates too many rows for the EXISTS subquery to be efficient
        -- TODO: Optimize this with a pre-calculated lookup table or materialized view
        0 as completed_confirmed_transaction
             
      FROM weekly_cohorts wc
      LEFT JOIN inventory_items ii ON wc.user_id = ii.user_id AND ii.deleted_at = 0
      LEFT JOIN wishlist_items wi ON wc.user_id = wi.user_id AND wi.deleted_at = 0  
      LEFT JOIN offers o ON wc.user_id = o.creator_user_id AND o.deleted_at = 0
      GROUP BY wc.cohort_week, wc.user_id, wc.join_date, wc.username
    ),
    cohort_summary AS (
      -- Calculate completion rates per cohort
      SELECT 
        cohort_week,
        COUNT(*) as total_users,
        
        -- Individual action completion rates
        SUM(completed_closet_add) as closet_add_count,
        ROUND(SUM(completed_closet_add) * 100.0 / COUNT(*), 2) as closet_add_percentage,
        
        SUM(completed_wishlist_add) as wishlist_add_count, 
        ROUND(SUM(completed_wishlist_add) * 100.0 / COUNT(*), 2) as wishlist_add_percentage,
        
        SUM(completed_create_offer) as create_offer_count,
        ROUND(SUM(completed_create_offer) * 100.0 / COUNT(*), 2) as create_offer_percentage,
        
        -- All actions completion (users who completed all 3 traditional actions - NOT including confirmed transactions)
        SUM(CASE WHEN completed_closet_add = 1 AND completed_wishlist_add = 1 AND completed_create_offer = 1 
                 THEN 1 ELSE 0 END) as all_actions_count,
        ROUND(SUM(CASE WHEN completed_closet_add = 1 AND completed_wishlist_add = 1 AND completed_create_offer = 1 
                      THEN 1 ELSE 0 END) * 100.0 / COUNT(*), 2) as all_actions_percentage,
        
        -- Confirmed transactions completion (separate metric, far right column)
        SUM(completed_confirmed_transaction) as confirmed_transaction_count,
        ROUND(SUM(completed_confirmed_transaction) * 100.0 / COUNT(*), 2) as confirmed_transaction_percentage
                      
      FROM cohort_actions
      GROUP BY cohort_week
    )
    SELECT 
      cohort_week as cohort_month,
      'week-of-' || TO_CHAR(cohort_week, 'MMDDYY') as cohort_period,
      total_users,
      closet_add_count,
      closet_add_percentage,
      wishlist_add_count,
      wishlist_add_percentage, 
      create_offer_count,
      create_offer_percentage,
      all_actions_count,
      all_actions_percentage,
      confirmed_transaction_count,
      confirmed_transaction_percentage
    FROM cohort_summary
    ORDER BY cohort_week DESC
    LIMIT $1
  `;

  const result = await executeQuery(query, [periods]);
  return result.rows.reverse(); // Reverse to get chronological order (oldest first)
}

// Get daily offers aggregated by day with isOfferIdea subdivision
export async function getDailyOffers(
  startDate?: string,
  endDate?: string
): Promise<{ date: Date; totalOffers: number; offerIdeas: number; regularOffers: number }[]> {
  
  // Default to last 30 days if no range specified
  const defaultEndDate = new Date().toISOString().split('T')[0];
  const defaultStartDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
    .toISOString().split('T')[0];
  
  const actualStartDate = startDate || defaultStartDate;
  const actualEndDate = endDate || defaultEndDate;
  
  const query = `
    SELECT 
      DATE(created_at AT TIME ZONE 'UTC' AT TIME ZONE 'America/Chicago') as date,
      COUNT(*) as total_offers,
      SUM(CASE WHEN is_offer_idea = true THEN 1 ELSE 0 END) as offer_ideas,
      SUM(CASE WHEN is_offer_idea = false THEN 1 ELSE 0 END) as regular_offers
    FROM offers 
    WHERE created_at >= $1::date 
    AND created_at < ($2::date + INTERVAL '1 day')
    AND deleted_at = 0
    GROUP BY DATE(created_at AT TIME ZONE 'UTC' AT TIME ZONE 'America/Chicago')
    ORDER BY date ASC
  `;
  
  const result = await executeQuery<{ 
    date: Date; 
    total_offers: string; 
    offer_ideas: string; 
    regular_offers: string; 
  }>(query, [actualStartDate, actualEndDate]);
  
  return result.rows.map(row => ({
    date: row.date,
    totalOffers: parseInt(row.total_offers, 10),
    offerIdeas: parseInt(row.offer_ideas, 10),
    regularOffers: parseInt(row.regular_offers, 10)
  }));
}

// Get offer creator percentage analysis across multiple time windows
// Uses proven query building block pattern #1 (User Activity & Status) for accurate last_active filtering
export async function getOfferCreatorPercentages(): Promise<{
  timeWindow: string;
  activeUsers: number;
  offerCreators: number;
  percentage: number;
}[]> {
  
  try {
    const timeWindows = [
      { window: '24h', hours: 24 },
      { window: '72h', hours: 72 },
      { window: '7d', hours: 168 },
      { window: '30d', hours: 720 },
      { window: '90d', hours: 2160 }
    ];
    
    const results = [];
    
    for (const tw of timeWindows) {
      // EXACT REPLICATION: Based on proven generate_active_user_report.py pattern
      // Removed March 5 filter and redundant WHERE conditions to match working script
      const query = `
        SELECT
          -- Active Users: users with last_active in time window
          COUNT(DISTINCT u.id) FILTER (WHERE ua.last_active >= CURRENT_TIMESTAMP - INTERVAL '${tw.hours} hours') AS active_users,
          
          -- Offer Creators: among active users, who also created offers in same time window
          COUNT(DISTINCT CASE 
            WHEN o.created_at >= CURRENT_TIMESTAMP - INTERVAL '${tw.hours} hours' 
            THEN u.id 
          END) AS offer_creators
          
        FROM users u
        JOIN user_activities ua ON u.id = ua.user_id
        LEFT JOIN offers o ON u.id = o.creator_user_id 
          AND o.created_at >= CURRENT_TIMESTAMP - INTERVAL '${tw.hours} hours'
          AND o.deleted_at = 0
        WHERE u.deleted_at = 0
          AND ua.last_active >= CURRENT_TIMESTAMP - INTERVAL '90 days'
      `;
      
      const result = await executeQuery<{ 
        active_users: string; 
        offer_creators: string; 
      }>(query);
      
      const activeUsers = parseInt(result.rows[0]?.active_users || '0', 10);
      const offerCreators = parseInt(result.rows[0]?.offer_creators || '0', 10);
      
      // Calculate accurate percentage based on real data
      const percentage = activeUsers > 0 ? 
        Math.round((offerCreators / activeUsers) * 100 * 100) / 100 : 0;
      
      results.push({
        timeWindow: tw.window,
        activeUsers,
        offerCreators,
        percentage
      });
    }
    
    return results;
    
  } catch (error) {
    console.error('CRITICAL ERROR in getOfferCreatorPercentages:', error);
    
    // Re-throw error instead of masking with fallback data
    throw new Error(`Database query failed: ${error instanceof Error ? error.message : String(error)}`);
  }
}

// Get total offer count for summary statistics
export async function getTotalOfferCount(
  startDate?: string,
  endDate?: string
): Promise<number> {
  
  const defaultEndDate = new Date().toISOString().split('T')[0];
  const defaultStartDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
    .toISOString().split('T')[0];
  
  const actualStartDate = startDate || defaultStartDate;
  const actualEndDate = endDate || defaultEndDate;
  
  const query = `
    SELECT COUNT(*) as total
    FROM offers 
    WHERE created_at >= $1::date 
    AND created_at < ($2::date + INTERVAL '1 day')
    AND deleted_at = 0
  `;
  
  const result = await executeQuery<{ total: string }>(
    query, 
    [actualStartDate, actualEndDate]
  );
  
  return parseInt(result.rows[0]?.total || '0', 10);
}

// Graceful pool shutdown for application cleanup
export async function closeDatabasePool(): Promise<void> {
  if (!pool) {
    console.warn('Database pool not initialized - nothing to close');
    return;
  }

  try {
    await pool.end();
    console.log('Database connection pool closed gracefully');
  } catch (error) {
    console.error('Error closing database pool:', error);
  }
}

// ============================================================================
// PostHog Integration Functions
// ============================================================================

import { spawn } from 'child_process';
import path from 'path';

// PostHog data availability starts from this date
const POSTHOG_START_DATE = '2025-06-16';

// Type definitions for PostHog Python script responses
interface PostHogErrorResponse {
  error: string;
  traceback?: string;
}

interface PostHogActiveUser {
  date: string;
  active_users: number;
}

interface PostHogUniqueCreator {
  date: string;
  unique_creators: number;
}

type PostHogActiveUsersResult = PostHogActiveUser[] | PostHogErrorResponse;
type PostHogUniqueCreatorsResult = PostHogUniqueCreator[] | PostHogErrorResponse;

// Type guard to check if result is an error
function isPostHogError(result: unknown): result is PostHogErrorResponse {
  return typeof result === 'object' && result !== null && 'error' in result;
}

interface OfferDataForMap {
  date: Date;
  totalOffers: number;
  offerIdeas: number;
  regularOffers: number;
}

interface ValidDataItem {
  date: Date;
  totalOffers: number;
  activeUsers: number;
  offersPerActiveUser: number;
}

interface DailyUniqueCreatorItem {
  date: Date;
  uniqueCreators: number;
}


/**
 * Get daily active users and daily offers data combined for offers per active user calculation
 */
export async function getDailyOffersPerActiveUser(
  startDate?: string,
  endDate?: string
): Promise<{ date: Date; totalOffers: number; activeUsers: number; offersPerActiveUser: number }[]> {
  // Set date constraints with PostHog data availability
  // Allow all data up to today - we'll filter by data availability, not arbitrary date limits
  const today = new Date().toISOString().split('T')[0];
  const defaultStartDate = new Date(Date.now() - (30 * 24 * 60 * 60 * 1000)).toISOString().split('T')[0];
  
  const finalStartDate = startDate || defaultStartDate;
  const finalEndDate = endDate || today; // Query up to today, filter by data availability
  
  // Ensure we don't query before PostHog data is available
  const constrainedStartDate = finalStartDate < POSTHOG_START_DATE ? POSTHOG_START_DATE : finalStartDate;
  const constrainedEndDate = finalEndDate;

  try {
    // Get daily offers from existing PostgreSQL query  
    const dailyOffers = await getDailyOffers(constrainedStartDate, constrainedEndDate);
    
    // Execute PostHog script for active users using relative paths
    // In production (Railway), process.cwd() will be the application root
    const projectRoot = path.join(process.cwd(), '..', '..');
    const pythonScript = `
import sys
import os
import json

# Add relative paths to Python path (Railway-compatible)
sys.path.insert(0, '${projectRoot}')
sys.path.insert(0, '${path.join(projectRoot, 'basic_capabilities', 'internal_db_queries_toolbox')}')

try:
    from basic_capabilities.internal_db_queries_toolbox.posthog_utils import get_daily_active_users
    result = get_daily_active_users('${constrainedStartDate}', '${constrainedEndDate}')
    print(json.dumps(result))
except Exception as e:
    import traceback
    print(json.dumps({"error": str(e), "traceback": traceback.format_exc()}), file=sys.stderr)
    sys.exit(1)
`;

    const activeUsersResult = await new Promise((resolve, reject) => {
      const pythonProcess = spawn('python3', ['-c', pythonScript], {
        stdio: ['ignore', 'pipe', 'pipe'],
        cwd: projectRoot
      });

      let stdout = '';
      let stderr = '';

      pythonProcess.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      pythonProcess.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      pythonProcess.on('close', (code) => {
        if (code !== 0) {
          console.error('PostHog script error:', stderr);
          reject(new Error(`PostHog script failed with code ${code}: ${stderr}`));
          return;
        }

        try {
          const result = JSON.parse(stdout);
          resolve(result);
        } catch (parseError) {
          console.error('Failed to parse PostHog script output:', stdout);
          reject(new Error(`Failed to parse PostHog output: ${parseError}`));
        }
      });

      pythonProcess.on('error', (error) => {
        reject(new Error(`Failed to start PostHog script: ${error.message}`));
      });
    });

    if (isPostHogError(activeUsersResult)) {
      throw new Error(`PostHog error: ${activeUsersResult.error}`);
    }

    // Type assertion after error check - activeUsersResult is now guaranteed to be PostHogActiveUser[]
    const activeUsersData = activeUsersResult as PostHogActiveUser[];

    // Create lookup map for offers data
    const offersMap: Map<string, OfferDataForMap> = new Map();
    dailyOffers.forEach(offer => {
      const dateStr = new Date(offer.date).toISOString().split('T')[0];
      offersMap.set(dateStr, offer);
    });

    // Build combined data using the new logic: "show if both offers and active users have valid data"
    const validData: ValidDataItem[] = [];

    activeUsersData.forEach((activeUser: PostHogActiveUser) => {
      const dateStr = activeUser.date;
      
      // Strict constraint: Only include dates from PostHog availability onwards
      if (dateStr < POSTHOG_START_DATE) {
        return;
      }
      
      // Must have valid active users data (> 0)
      if (!activeUser.active_users || activeUser.active_users <= 0) {
        return;
      }
      
      // Get corresponding offers data - must exist in offers table for this date
      const offersData = offersMap.get(dateStr);
      
      // Only include if we have BOTH valid active users AND offers data for this date
      // (Note: totalOffers can be 0 if no offers were created that day, but offers table must have a record)
      if (!offersData) {
        return; // Skip dates where we have no offers data at all
      }
      
      const totalOffers = offersData.totalOffers;
      
      // Calculate ratio
      const offersPerActiveUser = activeUser.active_users > 0 
        ? Number((totalOffers / activeUser.active_users).toFixed(4))
        : 0;
      
      validData.push({
        date: new Date(dateStr),
        totalOffers,
        activeUsers: activeUser.active_users,
        offersPerActiveUser
      });
    });

    // Return sorted data (already filtered to valid PostHog dates only)
    return validData.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  } catch (error) {
    console.error('CRITICAL ERROR in getDailyOffersPerActiveUser:', error);
    throw new Error(`Failed to fetch offers per active user data: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Get daily unique offer creators from PostHog
 */
export async function getDailyUniqueOfferCreators(
  startDate?: string,
  endDate?: string
): Promise<{ date: Date; uniqueCreators: number }[]> {
  // Set date constraints with PostHog data availability  
  const today = new Date().toISOString().split('T')[0];
  const defaultStartDate = new Date(Date.now() - (30 * 24 * 60 * 60 * 1000)).toISOString().split('T')[0];
  
  const finalStartDate = startDate || defaultStartDate;
  const finalEndDate = endDate || today;
  
  // Ensure we don't query before PostHog data is available
  const constrainedStartDate = finalStartDate < POSTHOG_START_DATE ? POSTHOG_START_DATE : finalStartDate;

  try {
    // Execute PostHog script for unique creators using relative paths
    // In production (Railway), process.cwd() will be the application root
    const projectRoot = path.join(process.cwd(), '..', '..');
    const pythonScript = `
import sys
import os
import json

# Add relative paths to Python path (Railway-compatible)
sys.path.insert(0, '${projectRoot}')
sys.path.insert(0, '${path.join(projectRoot, 'basic_capabilities', 'internal_db_queries_toolbox')}')

try:
    from basic_capabilities.internal_db_queries_toolbox.posthog_utils import get_daily_unique_offer_creators
    result = get_daily_unique_offer_creators('${constrainedStartDate}', '${finalEndDate}')
    print(json.dumps(result))
except Exception as e:
    import traceback
    print(json.dumps({"error": str(e), "traceback": traceback.format_exc()}), file=sys.stderr)
    sys.exit(1)
`;

    const result = await new Promise((resolve, reject) => {
      const pythonProcess = spawn('python3', ['-c', pythonScript], {
        stdio: ['ignore', 'pipe', 'pipe'],
        cwd: projectRoot
      });

      let stdout = '';
      let stderr = '';

      pythonProcess.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      pythonProcess.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      pythonProcess.on('close', (code) => {
        if (code !== 0) {
          console.error('PostHog script error:', stderr);
          reject(new Error(`PostHog script failed with code ${code}: ${stderr}`));
          return;
        }

        try {
          const result = JSON.parse(stdout);
          resolve(result);
        } catch (parseError) {
          console.error('Failed to parse PostHog script output:', stdout);
          reject(new Error(`Failed to parse PostHog output: ${parseError}`));
        }
      });

      pythonProcess.on('error', (error) => {
        reject(new Error(`Failed to start PostHog script: ${error.message}`));
      });
    });

    if (isPostHogError(result)) {
      throw new Error(`PostHog error: ${result.error}`);
    }

    // Type assertion after error check - result is now guaranteed to be PostHogUniqueCreator[]
    const uniqueCreatorsData = result as PostHogUniqueCreator[];

    // Convert to expected format with Date objects
    return uniqueCreatorsData.map((item: PostHogUniqueCreator): DailyUniqueCreatorItem => ({
      date: new Date(item.date),
      uniqueCreators: item.unique_creators
    })).sort((a: DailyUniqueCreatorItem, b: DailyUniqueCreatorItem) => a.date.getTime() - b.date.getTime());

  } catch (error) {
    console.error('CRITICAL ERROR in getDailyUniqueOfferCreators:', error);
    throw new Error(`Failed to fetch unique offer creators data: ${error instanceof Error ? error.message : String(error)}`);
  }
}

// ============================================================================
// Transaction Analytics Functions (Third Tab)
// ============================================================================

/**
 * Get daily confirmed transactions segmented by trusted trader status
 */
export async function getConfirmedTransactions(
  startDate?: string,
  endDate?: string
): Promise<{ date: Date; trustedTraderCount: number; trustedPartnerCount: number; standardCount: number; totalCount: number }[]> {
  // Set date constraints
  const today = new Date().toISOString().split('T')[0];
  const defaultStartDate = new Date(Date.now() - (30 * 24 * 60 * 60 * 1000)).toISOString().split('T')[0];
  
  const finalStartDate = startDate || defaultStartDate;
  const finalEndDate = endDate || today;

  if (!pool) {
    throw new Error('Database pool not initialized - DATABASE_URL not configured');
  }

  try {
    const query = `
      WITH daily_confirmed_transactions AS (
        SELECT
          DATE(t.created_at AT TIME ZONE 'America/Chicago') as transaction_date,
          CASE
            WHEN oc.is_trusted_trader = true THEN 'trustedTrader'
            WHEN oc.is_trusted_trader = false AND t.created_at >= '2025-08-02'::date AND EXISTS(
              SELECT 1 FROM offer_checkouts oc_other
              WHERE oc_other.offer_id = oc.offer_id
              AND oc_other.user_id != oc.user_id
              AND oc_other.is_trusted_trader = true
              AND oc_other.deleted_at = 0
            ) THEN 'trustedPartner'
            ELSE 'standard'
          END as transaction_type,
          COUNT(*) as confirmed_count
        FROM offer_checkouts oc
        JOIN offers o ON oc.offer_id = o.id
        JOIN trades t ON o.id = t.offer_id  -- Only count checkouts connected to trades
        WHERE oc.deleted_at = 0
        AND o.deleted_at = 0
        AND t.deleted_at = 0
        AND t.created_at >= ($1::date AT TIME ZONE 'America/Chicago')
        AND t.created_at < LEAST(
            current_timestamp,
            (($2::date + INTERVAL '1 day') AT TIME ZONE 'America/Chicago')
        )
        GROUP BY DATE(t.created_at AT TIME ZONE 'America/Chicago'),
          CASE
            WHEN oc.is_trusted_trader = true THEN 'trustedTrader'
            WHEN oc.is_trusted_trader = false AND t.created_at >= '2025-08-02'::date AND EXISTS(
              SELECT 1 FROM offer_checkouts oc_other
              WHERE oc_other.offer_id = oc.offer_id
              AND oc_other.user_id != oc.user_id
              AND oc_other.is_trusted_trader = true
              AND oc_other.deleted_at = 0
            ) THEN 'trustedPartner'
            ELSE 'standard'
          END
      )
      SELECT
        transaction_date,
        SUM(CASE WHEN transaction_type = 'trustedTrader' THEN confirmed_count ELSE 0 END) as trusted_trader_count,
        SUM(CASE WHEN transaction_type = 'trustedPartner' THEN confirmed_count ELSE 0 END) as trusted_partner_count,
        SUM(CASE WHEN transaction_type = 'standard' THEN confirmed_count ELSE 0 END) as standard_count,
        SUM(confirmed_count) as total_confirmed_count
      FROM daily_confirmed_transactions
      GROUP BY transaction_date
      ORDER BY transaction_date ASC;
    `;

    const results = await pool.query(query, [finalStartDate, finalEndDate]);
    
    return results.rows.map(row => ({
      date: new Date(row.transaction_date),
      trustedTraderCount: parseInt(row.trusted_trader_count) || 0,
      trustedPartnerCount: parseInt(row.trusted_partner_count) || 0, 
      standardCount: parseInt(row.standard_count) || 0,
      totalCount: parseInt(row.total_confirmed_count) || 0
    }));

  } catch (error) {
    console.error('CRITICAL ERROR in getConfirmedTransactions:', error);
    throw new Error(`Failed to fetch confirmed transactions data: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Get daily validated transactions segmented by trusted trader status
 */
export async function getValidatedTransactions(
  startDate?: string,
  endDate?: string
): Promise<{ date: Date; trustedTraderCount: number; trustedPartnerCount: number; standardCount: number; totalCount: number }[]> {
  // Set date constraints
  const today = new Date().toISOString().split('T')[0];
  const defaultStartDate = new Date(Date.now() - (30 * 24 * 60 * 60 * 1000)).toISOString().split('T')[0];
  
  const finalStartDate = startDate || defaultStartDate;
  const finalEndDate = endDate || today;

  if (!pool) {
    throw new Error('Database pool not initialized - DATABASE_URL not configured');
  }

  try {
    const query = `
      WITH daily_validated_transactions AS (
        SELECT
          DATE(t.validation_passed_date AT TIME ZONE 'America/Chicago') as validation_date,
          CASE
            WHEN oc.is_trusted_trader = true THEN 'trustedTrader'
            WHEN oc.is_trusted_trader = false AND t.created_at >= '2025-08-02'::date AND EXISTS(
              SELECT 1 FROM offer_checkouts oc_other
              WHERE oc_other.offer_id = oc.offer_id
              AND oc_other.user_id != oc.user_id
              AND oc_other.is_trusted_trader = true
              AND oc_other.deleted_at = 0
            ) THEN 'trustedPartner'
            ELSE 'standard'
          END as transaction_type,
          COUNT(*) as validated_count
        FROM offer_checkouts oc
        JOIN offers o ON oc.offer_id = o.id
        JOIN trades t ON o.id = t.offer_id  -- trades table join ensures proper transaction definition
        WHERE oc.deleted_at = 0
        AND o.deleted_at = 0
        AND t.deleted_at = 0
        AND t.validation_passed_date IS NOT NULL
        AND t.validation_passed_date >= ($1::date AT TIME ZONE 'America/Chicago')
        AND t.validation_passed_date < LEAST(
            current_timestamp,
            (($2::date + INTERVAL '1 day') AT TIME ZONE 'America/Chicago')
        )
        GROUP BY DATE(t.validation_passed_date AT TIME ZONE 'America/Chicago'),
          CASE
            WHEN oc.is_trusted_trader = true THEN 'trustedTrader'
            WHEN oc.is_trusted_trader = false AND t.created_at >= '2025-08-02'::date AND EXISTS(
              SELECT 1 FROM offer_checkouts oc_other
              WHERE oc_other.offer_id = oc.offer_id
              AND oc_other.user_id != oc.user_id
              AND oc_other.is_trusted_trader = true
              AND oc_other.deleted_at = 0
            ) THEN 'trustedPartner'
            ELSE 'standard'
          END
      )
      SELECT
        validation_date,
        SUM(CASE WHEN transaction_type = 'trustedTrader' THEN validated_count ELSE 0 END) as trusted_trader_count,
        SUM(CASE WHEN transaction_type = 'trustedPartner' THEN validated_count ELSE 0 END) as trusted_partner_count,
        SUM(CASE WHEN transaction_type = 'standard' THEN validated_count ELSE 0 END) as standard_count,
        SUM(validated_count) as total_validated_count
      FROM daily_validated_transactions
      GROUP BY validation_date
      ORDER BY validation_date ASC;
    `;

    const results = await pool.query(query, [finalStartDate, finalEndDate]);
    
    return results.rows.map(row => ({
      date: new Date(row.validation_date),
      trustedTraderCount: parseInt(row.trusted_trader_count) || 0,
      trustedPartnerCount: parseInt(row.trusted_partner_count) || 0, 
      standardCount: parseInt(row.standard_count) || 0,
      totalCount: parseInt(row.total_validated_count) || 0
    }));

  } catch (error) {
    console.error('CRITICAL ERROR in getValidatedTransactions:', error);
    throw new Error(`Failed to fetch validated transactions data: ${error instanceof Error ? error.message : String(error)}`);
  }
}

// ============================================================================
// Pool Event Listeners
// ============================================================================

// Pool event listeners for monitoring (only if pool exists)
if (pool) {
  pool.on('connect', () => {
    console.log('New database connection established');
  });

  pool.on('error', (err) => {
    console.error('Database pool error:', err);
  });
} else {
  console.warn('⚠️  Database pool event listeners not registered - pool not initialized');
}

export default pool;
