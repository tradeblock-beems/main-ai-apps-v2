/**
 * Database Connection Utility
 * 
 * PostgreSQL connection management with connection pooling,
 * error handling, and optimized query execution for analytics workloads.
 */

import { Pool, PoolClient, QueryResult, QueryResultRow } from 'pg';
import { DATABASE_URL } from '@/lib/config';

// Connection pool configuration optimized for analytics workloads
const pool = new Pool({
  connectionString: DATABASE_URL,
  max: 10, // Maximum number of connections in pool
  idleTimeoutMillis: 30000, // Close idle connections after 30 seconds
  connectionTimeoutMillis: 10000, // Timeout for new connections
  statement_timeout: 30000, // 30 second query timeout
  query_timeout: 30000, // 30 second query timeout
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// Database connection health check
export async function checkDatabaseConnection(): Promise<boolean> {
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
export async function executeQuery<T extends QueryResultRow = any>(
  query: string, 
  params: any[] = []
): Promise<QueryResult<T>> {
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
      DATE(created_at) as date,
      COUNT(*) as count
    FROM users 
    WHERE created_at >= $1::date 
    AND created_at < ($2::date + INTERVAL '1 day')
    AND created_at >= '2025-03-05'
    AND deleted_at = 0
    GROUP BY DATE(created_at)
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

// Graceful pool shutdown for application cleanup
export async function closeDatabasePool(): Promise<void> {
  try {
    await pool.end();
    console.log('Database connection pool closed gracefully');
  } catch (error) {
    console.error('Error closing database pool:', error);
  }
}

// Pool event listeners for monitoring
pool.on('connect', () => {
  console.log('New database connection established');
});

pool.on('error', (err) => {
  console.error('Database pool error:', err);
});

export default pool;
