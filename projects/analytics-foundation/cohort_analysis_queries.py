#!/usr/bin/env python3
"""
Cohort Analysis Database Queries - Analytics Foundation Phase 6.5

Creates optimized database functions for calculating new user cohort completion rates
for key onboarding actions within 72 hours of account creation.

Features:
- Monthly and weekly cohort grouping
- 72-hour completion window calculations
- Optimized queries with performance monitoring
- Comprehensive error handling and data validation

Actions Tracked:
- Closet Add (first inventory_item addition)
- Wishlist Add (first wishlist_item addition) 
- Create Offer (first offer creation)
- All Actions (users who completed all 3 within 72 hours)

Author: @squad-agent-database-master (Analytics Foundation Project - Phase 6.5)
"""

import json
import logging
import os
import sys
import time
import psycopg2
from datetime import datetime, timedelta
from typing import List, Dict, Any, Optional, Literal

# Add the project root to the Python path
sys.path.append(os.path.join(os.path.dirname(__file__), '..', '..'))

from basic_capabilities.internal_db_queries_toolbox.config import DATABASE_URL

# Configure logging to stderr to avoid interfering with JSON output
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    stream=sys.stderr  # Send logs to stderr instead of stdout
)
logger = logging.getLogger(__name__)

class CohortAnalysisQueries:
    """Database query manager for cohort analysis calculations"""
    
    def __init__(self):
        self.db_url = DATABASE_URL
        if not self.db_url:
            raise ValueError("DATABASE_URL environment variable is required")
    
    def get_db_connection(self):
        """Create database connection with timeout settings"""
        try:
            connection = psycopg2.connect(
                self.db_url,
                connect_timeout=10,
                application_name="cohort_analysis_queries"
            )
            connection.autocommit = False
            return connection
        except psycopg2.Error as e:
            logger.error(f"Database connection failed: {e}")
            raise
    
    def execute_query_with_monitoring(self, query: str, params: tuple = None) -> List[Dict]:
        """Execute query with performance monitoring and error handling"""
        start_time = time.time()
        connection = None
        cursor = None
        
        try:
            connection = self.get_db_connection()
            cursor = connection.cursor()
            
            # Execute query
            cursor.execute(query, params)
            
            # Fetch results
            columns = [desc[0] for desc in cursor.description]
            results = []
            for row in cursor.fetchall():
                results.append(dict(zip(columns, row)))
            
            execution_time = (time.time() - start_time) * 1000  # Convert to milliseconds
            logger.info(f"Query executed in {execution_time:.2f}ms, returned {len(results)} rows")
            
            # Performance warning for slow queries
            if execution_time > 5000:  # 5 seconds
                logger.warning(f"Slow query detected: {execution_time:.2f}ms")
            
            return results
            
        except psycopg2.Error as e:
            logger.error(f"Query execution failed: {e}")
            logger.error(f"Query: {query[:200]}...")
            if connection:
                connection.rollback()
            raise
        finally:
            if cursor:
                cursor.close()
            if connection:
                connection.close()
    
    def get_monthly_cohort_analysis(self, months_back: int = 12) -> List[Dict]:
        """
        Calculate monthly cohort completion rates for 72-hour action windows
        
        Args:
            months_back: Number of months to analyze (default: 12)
            
        Returns:
            List of cohort data with completion rates
        """
        
        query = """
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
                     THEN 1 ELSE 0 END as completed_create_offer
                     
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
                
                -- All actions completion (users who completed all 3)
                SUM(CASE WHEN completed_closet_add = 1 AND completed_wishlist_add = 1 AND completed_create_offer = 1 
                         THEN 1 ELSE 0 END) as all_actions_count,
                ROUND(SUM(CASE WHEN completed_closet_add = 1 AND completed_wishlist_add = 1 AND completed_create_offer = 1 
                              THEN 1 ELSE 0 END) * 100.0 / COUNT(*), 2) as all_actions_percentage
                              
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
            all_actions_percentage
        FROM cohort_summary
        ORDER BY cohort_month ASC;
        """
        
        logger.info(f"Executing monthly cohort analysis for {months_back} months")
        results = self.execute_query_with_monitoring(query, (months_back,))
        logger.info(f"Monthly cohort analysis completed: {len(results)} cohorts analyzed")
        
        return results
    
    def get_weekly_cohort_analysis(self, weeks_back: int = 24) -> List[Dict]:
        """
        Calculate weekly cohort completion rates for 72-hour action windows
        
        Args:
            weeks_back: Number of weeks to analyze (default: 24 weeks = ~6 months)
            
        Returns:
            List of cohort data with completion rates
        """
        
        query = """
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
                     THEN 1 ELSE 0 END as completed_create_offer
                     
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
                
                -- All actions completion (users who completed all 3)
                SUM(CASE WHEN completed_closet_add = 1 AND completed_wishlist_add = 1 AND completed_create_offer = 1 
                         THEN 1 ELSE 0 END) as all_actions_count,
                ROUND(SUM(CASE WHEN completed_closet_add = 1 AND completed_wishlist_add = 1 AND completed_create_offer = 1 
                              THEN 1 ELSE 0 END) * 100.0 / COUNT(*), 2) as all_actions_percentage
                              
            FROM cohort_actions
            GROUP BY cohort_week
        )
        SELECT 
            cohort_week,
            TO_CHAR(cohort_week, 'YYYY-"W"WW') as cohort_period,
            total_users,
            closet_add_count,
            closet_add_percentage,
            wishlist_add_count,
            wishlist_add_percentage, 
            create_offer_count,
            create_offer_percentage,
            all_actions_count,
            all_actions_percentage
        FROM cohort_summary
        ORDER BY cohort_week ASC;
        """
        
        logger.info(f"Executing weekly cohort analysis for {weeks_back} weeks")
        results = self.execute_query_with_monitoring(query, (weeks_back,))
        logger.info(f"Weekly cohort analysis completed: {len(results)} cohorts analyzed")
        
        return results
    
    def test_cohort_calculations(self, sample_user_ids: List[str] = None) -> Dict:
        """
        Test cohort calculations with sample data for validation
        
        Args:
            sample_user_ids: Optional list of user IDs to test with
            
        Returns:
            Dict with test results and validation data
        """
        
        test_query = """
        SELECT 
            u.id as user_id,
            u.username,
            u.created_at as join_date,
            DATE_TRUNC('month', u.created_at) as cohort_month,
            DATE_TRUNC('week', u.created_at) as cohort_week,
            
            -- First action dates
            MIN(ii.created_at) as first_closet_add,
            MIN(wi.created_at) as first_wishlist_add,
            MIN(o.created_at) as first_offer_created,
            
            -- 72-hour completion checks
            CASE WHEN MIN(ii.created_at) <= u.created_at + INTERVAL '72 hours' 
                 THEN true ELSE false END as completed_closet_72h,
            CASE WHEN MIN(wi.created_at) <= u.created_at + INTERVAL '72 hours'
                 THEN true ELSE false END as completed_wishlist_72h,
            CASE WHEN MIN(o.created_at) <= u.created_at + INTERVAL '72 hours'
                 THEN true ELSE false END as completed_offer_72h
                 
        FROM users u
        LEFT JOIN inventory_items ii ON u.id = ii.user_id AND ii.deleted_at = 0
        LEFT JOIN wishlist_items wi ON u.id = wi.user_id AND wi.deleted_at = 0
        LEFT JOIN offers o ON u.id = o.creator_user_id AND o.deleted_at = 0
        WHERE u.created_at >= '2025-03-05'::date
            AND u.deleted_at = 0
            AND u.created_at <= CURRENT_DATE - INTERVAL '72 hours'  -- Only include users past 72h window
        GROUP BY u.id, u.username, u.created_at
        ORDER BY u.created_at DESC
        LIMIT 10;
        """
        
        logger.info("Running cohort calculation test with sample data")
        results = self.execute_query_with_monitoring(test_query)
        
        # Calculate summary stats
        if results:
            total_tested = len(results)
            closet_completed = sum(1 for r in results if r['completed_closet_72h'])
            wishlist_completed = sum(1 for r in results if r['completed_wishlist_72h']) 
            offer_completed = sum(1 for r in results if r['completed_offer_72h'])
            all_completed = sum(1 for r in results 
                              if r['completed_closet_72h'] and r['completed_wishlist_72h'] and r['completed_offer_72h'])
            
            summary = {
                'test_sample_size': total_tested,
                'closet_completion_rate': round(closet_completed / total_tested * 100, 2) if total_tested > 0 else 0,
                'wishlist_completion_rate': round(wishlist_completed / total_tested * 100, 2) if total_tested > 0 else 0,
                'offer_completion_rate': round(offer_completed / total_tested * 100, 2) if total_tested > 0 else 0,
                'all_actions_completion_rate': round(all_completed / total_tested * 100, 2) if total_tested > 0 else 0,
                'sample_data': results[:5]  # First 5 records for inspection
            }
        else:
            summary = {
                'test_sample_size': 0,
                'error': 'No test data available'
            }
        
        logger.info(f"Test completed: {summary.get('test_sample_size', 0)} users analyzed")
        return summary

# Convenience functions for API integration
def get_cohort_analysis(period_type: Literal['monthly', 'weekly'], 
                       lookback_periods: int = None) -> List[Dict]:
    """
    Get cohort analysis data for API consumption
    
    Args:
        period_type: 'monthly' or 'weekly'
        lookback_periods: Number of periods to analyze
        
    Returns:
        List of cohort data formatted for API response
    """
    
    analyzer = CohortAnalysisQueries()
    
    if period_type == 'monthly':
        periods = lookback_periods or 12
        return analyzer.get_monthly_cohort_analysis(periods)
    elif period_type == 'weekly':
        periods = lookback_periods or 24  # ~6 months of weeks
        return analyzer.get_weekly_cohort_analysis(periods)
    else:
        raise ValueError(f"Invalid period_type: {period_type}. Must be 'monthly' or 'weekly'")

def test_cohort_analysis() -> Dict:
    """Test cohort analysis calculations"""
    analyzer = CohortAnalysisQueries()
    return analyzer.test_cohort_calculations()

if __name__ == "__main__":
    # Command line testing
    import argparse
    
    parser = argparse.ArgumentParser(description='Test cohort analysis queries')
    parser.add_argument('--test', action='store_true', help='Run test calculations')
    parser.add_argument('--monthly', action='store_true', help='Run monthly cohort analysis')
    parser.add_argument('--weekly', action='store_true', help='Run weekly cohort analysis')
    parser.add_argument('--periods', type=int, help='Number of periods to analyze')
    parser.add_argument('--json', action='store_true', help='Output JSON format for API consumption')
    
    args = parser.parse_args()
    
    if args.test:
        print("Testing cohort calculations...")
        test_results = test_cohort_analysis()
        print(json.dumps(test_results, indent=2, default=str))
    
    if args.monthly:
        periods = args.periods or 12
        monthly_results = get_cohort_analysis('monthly', periods)
        
        if args.json:
            # Output clean JSON for API consumption
            print(json.dumps(monthly_results, indent=2, default=str))
        else:
            # Output human-readable format for command line
            print("Running monthly cohort analysis...")
            print(f"Monthly cohorts ({len(monthly_results)} periods):")
            for cohort in monthly_results[:5]:  # Show first 5
                print(f"  {cohort['cohort_period']}: {cohort['total_users']} users, "
                      f"Closet: {cohort['closet_add_percentage']}%, "
                      f"Wishlist: {cohort['wishlist_add_percentage']}%, "
                      f"Offer: {cohort['create_offer_percentage']}%, "
                      f"All: {cohort['all_actions_percentage']}%")
    
    if args.weekly:
        periods = args.periods or 24
        weekly_results = get_cohort_analysis('weekly', periods)
        
        if args.json:
            # Output clean JSON for API consumption
            print(json.dumps(weekly_results, indent=2, default=str))
        else:
            # Output human-readable format for command line
            print("Running weekly cohort analysis...")
            print(f"Weekly cohorts ({len(weekly_results)} periods):")
            for cohort in weekly_results[:5]:  # Show first 5
                print(f"  {cohort['cohort_period']}: {cohort['total_users']} users, "
                      f"Closet: {cohort['closet_add_percentage']}%, "
                      f"Wishlist: {cohort['wishlist_add_percentage']}%, "
                      f"Offer: {cohort['create_offer_percentage']}%, "
                      f"All: {cohort['all_actions_percentage']}%")
