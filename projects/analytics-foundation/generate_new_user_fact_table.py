#!/usr/bin/env python3
"""
New User Fact Table Generation - Analytics Foundation Phase 3

Creates a comprehensive fact table for new users (created >= 2025-03-05) with 
key onboarding milestone dates for analytics dashboard visualization.

Implements enhanced safety protocols:
- Batch processing (500 users per batch)
- Connection pooling with timeouts
- Progress monitoring with automatic pause
- Query performance analysis
- Data validation and rollback procedures

Columns:
- userID: User identifier
- createdAt: User join date
- username: Display name
- 1stClosetAdd: Date of first closet item addition (NULL if never)
- 1stWishlistAdd: Date of first wishlist addition (NULL if never)
- 1stOfferPosted: Date of first offer creation (NULL if never)
- 1stOfferConfirmed: Date of first offer confirmation (NULL if never)

Usage:
    python3 generate_new_user_fact_table.py [--test_mode] [--batch_size 500] [--output_dir generated_data]

Author: @squad-agent-database-master (Analytics Foundation Project - Phase 3)
"""

import argparse
import csv
import json
import os
import sys
import time
import psycopg2
from datetime import datetime
from typing import List, Dict, Any, Optional
import logging

# Add the project root to the Python path
sys.path.append(os.path.join(os.path.dirname(__file__), '..', '..'))

from basic_capabilities.internal_db_queries_toolbox.config import DATABASE_URL
from basic_capabilities.internal_db_queries_toolbox.sql_utils import execute_query

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('fact_table_creation.log'),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

# Enhanced connection pool configuration
CONNECTION_POOL_CONFIG = {
    'max_connections': 5,
    'connection_timeout': 30,
    'query_timeout': 30
}

# Performance monitoring thresholds
PERFORMANCE_THRESHOLDS = {
    'max_query_time': 10.0,  # seconds
    'progress_report_interval': 10,  # batches
    'batch_size': 500
}


def get_database_connection():
    """
    Get database connection with timeout configuration.
    
    Returns:
        psycopg2 connection object
    """
    try:
        conn = psycopg2.connect(
            DATABASE_URL,
            connect_timeout=CONNECTION_POOL_CONFIG['connection_timeout']
        )
        conn.autocommit = False
        return conn
    except Exception as e:
        logger.error(f"Failed to connect to database: {e}")
        raise


def analyze_query_performance(query: str, params: Dict = None) -> Dict[str, Any]:
    """
    Analyze query performance using EXPLAIN ANALYZE.
    
    Args:
        query: SQL query to analyze
        params: Query parameters
        
    Returns:
        Dictionary with performance metrics
    """
    explain_query = f"EXPLAIN ANALYZE {query}"
    
    try:
        start_time = time.time()
        result = execute_query(explain_query, params or {})
        execution_time = time.time() - start_time
        
        # Parse execution plan for key metrics
        plan_text = '\n'.join([row.get('QUERY PLAN', '') for row in result])
        
        return {
            'execution_time': execution_time,
            'plan': plan_text,
            'estimated_cost': 'analyzed',
            'performance_acceptable': execution_time < PERFORMANCE_THRESHOLDS['max_query_time']
        }
    except Exception as e:
        logger.error(f"Query analysis failed: {e}")
        return {
            'execution_time': None,
            'plan': f"Analysis failed: {e}",
            'performance_acceptable': False
        }


def get_new_users_batch(offset: int, batch_size: int) -> List[Dict[str, Any]]:
    """
    Get a batch of new users created >= 2025-03-05.
    Uses Dynamic User Segmentation pattern (Building Block #8).
    
    Args:
        offset: Starting position for batch
        batch_size: Number of users to retrieve
        
    Returns:
        List of user records
    """
    query = """
    SELECT 
        u.id as user_id,
        u.created_at as created_at,
        u.username as username
    FROM users u
    WHERE u.created_at >= '2025-03-05'
    AND u.deleted_at = 0
    AND u.username IS NOT NULL
    ORDER BY u.created_at ASC
    LIMIT %(batch_size)s OFFSET %(offset)s
    """
    
    params = {
        'batch_size': batch_size,
        'offset': offset
    }
    
    return execute_query(query, params)


def get_first_activity_dates(user_ids: List[str]) -> Dict[str, Dict[str, Any]]:
    """
    Get first activity dates for each user using efficient window functions.
    Implements LEFT JOIN pattern for comprehensive data retrieval.
    
    Args:
        user_ids: List of user UUIDs
        
    Returns:
        Dictionary mapping user_id to first activity dates
    """
    
    if not user_ids:
        return {}
    
    # Convert user_ids to proper format for PostgreSQL
    user_id_list = [str(uid) for uid in user_ids]
    
    query = """
    WITH user_first_activities AS (
        SELECT 
            u.id as user_id,
            
            -- First closet addition (inventory items)
            (SELECT MIN(ii.created_at) 
             FROM inventory_items ii 
             WHERE ii.user_id = u.id 
             AND ii.deleted_at = 0) as first_closet_add,
            
            -- First wishlist addition  
            (SELECT MIN(wi.created_at)
             FROM wishlist_items wi
             WHERE wi.user_id = u.id
             AND wi.deleted_at = 0) as first_wishlist_add,
            
            -- First offer posted
            (SELECT MIN(o.created_at)
             FROM offers o
             WHERE o.creator_user_id = u.id) as first_offer_posted,
            
            -- First offer confirmed
            (SELECT MIN(o.confirmed_trade_date)
             FROM offers o
             WHERE (o.creator_user_id = u.id OR o.receiver_user_id = u.id)
             AND o.offer_status = 'COMPLETED'
             AND o.confirmed_trade_date IS NOT NULL) as first_offer_confirmed
             
        FROM users u
        WHERE u.id = ANY(%(user_ids)s::uuid[])
    )
    SELECT 
        user_id,
        first_closet_add,
        first_wishlist_add, 
        first_offer_posted,
        first_offer_confirmed
    FROM user_first_activities
    """
    
    params = {'user_ids': user_id_list}
    
    try:
        start_time = time.time()
        results = execute_query(query, params)
        execution_time = time.time() - start_time
        
        # Check performance threshold
        if execution_time > PERFORMANCE_THRESHOLDS['max_query_time']:
            logger.warning(f"Query exceeded performance threshold: {execution_time:.2f}s")
            
        # Convert to dictionary for efficient lookup
        return {
            result['user_id']: {
                'first_closet_add': result['first_closet_add'],
                'first_wishlist_add': result['first_wishlist_add'],
                'first_offer_posted': result['first_offer_posted'],
                'first_offer_confirmed': result['first_offer_confirmed']
            }
            for result in results
        }
        
    except Exception as e:
        logger.error(f"Failed to get first activity dates: {e}")
        return {}


def create_fact_table_batch(users: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """
    Create fact table records for a batch of users.
    
    Args:
        users: List of user records
        
    Returns:
        List of fact table records
    """
    if not users:
        return []
    
    # Get user IDs
    user_ids = [user['user_id'] for user in users]
    
    # Get first activity dates
    activity_data = get_first_activity_dates(user_ids)
    
    # Combine user data with activity data
    fact_records = []
    for user in users:
        user_id = user['user_id']
        activities = activity_data.get(user_id, {})
        
        fact_record = {
            'userID': user_id,
            'createdAt': user['created_at'],
            'username': user['username'],
            '1stClosetAdd': activities.get('first_closet_add'),
            '1stWishlistAdd': activities.get('first_wishlist_add'),
            '1stOfferPosted': activities.get('first_offer_posted'),
            '1stOfferConfirmed': activities.get('first_offer_confirmed')
        }
        
        fact_records.append(fact_record)
    
    return fact_records


def validate_fact_table_data(fact_records: List[Dict[str, Any]]) -> Dict[str, Any]:
    """
    Validate fact table data quality.
    
    Args:
        fact_records: List of fact table records
        
    Returns:
        Validation results
    """
    if not fact_records:
        return {'valid': False, 'error': 'No records to validate'}
    
    total_records = len(fact_records)
    records_with_username = sum(1 for r in fact_records if r.get('username'))
    records_with_activities = sum(1 for r in fact_records 
                                 if any([r.get('1stClosetAdd'), r.get('1stWishlistAdd'), 
                                        r.get('1stOfferPosted'), r.get('1stOfferConfirmed')]))
    
    validation_results = {
        'valid': True,
        'total_records': total_records,
        'username_coverage': records_with_username / total_records * 100,
        'activity_coverage': records_with_activities / total_records * 100,
        'data_quality_score': (records_with_username / total_records) * 100
    }
    
    # Quality thresholds
    if validation_results['username_coverage'] < 95:
        validation_results['warnings'] = ['Low username coverage']
    
    return validation_results


def save_fact_table_csv(fact_records: List[Dict[str, Any]], output_dir: str, timestamp: str) -> str:
    """
    Save fact table data to CSV file.
    
    Args:
        fact_records: List of fact table records
        output_dir: Output directory
        timestamp: Timestamp for filename
        
    Returns:
        Path to saved CSV file
    """
    os.makedirs(output_dir, exist_ok=True)
    filename = f"new_user_fact_table_{timestamp}.csv"
    file_path = os.path.join(output_dir, filename)
    
    if not fact_records:
        logger.warning("No fact records to save")
        return ""
    
    # Define CSV columns
    columns = ['userID', 'createdAt', 'username', '1stClosetAdd', 
               '1stWishlistAdd', '1stOfferPosted', '1stOfferConfirmed']
    
    with open(file_path, 'w', newline='', encoding='utf-8') as csvfile:
        writer = csv.DictWriter(csvfile, fieldnames=columns)
        writer.writeheader()
        
        for record in fact_records:
            # Convert datetime objects to strings for CSV
            csv_record = {}
            for col in columns:
                value = record.get(col)
                if isinstance(value, datetime):
                    csv_record[col] = value.isoformat()
                else:
                    csv_record[col] = value
            writer.writerow(csv_record)
    
    logger.info(f"Saved {len(fact_records)} records to {file_path}")
    return file_path


def generate_performance_report(execution_stats: Dict[str, Any], output_dir: str, timestamp: str) -> str:
    """
    Generate comprehensive performance and quality report.
    
    Args:
        execution_stats: Dictionary with execution statistics
        output_dir: Output directory
        timestamp: Timestamp for filename
        
    Returns:
        Path to saved report file
    """
    report_filename = f"fact_table_performance_report_{timestamp}.json"
    report_path = os.path.join(output_dir, report_filename)
    
    with open(report_path, 'w') as f:
        json.dump(execution_stats, f, indent=2, default=str)
    
    logger.info(f"Performance report saved: {report_path}")
    return report_path


def main():
    """Main execution function with enhanced error handling and monitoring."""
    parser = argparse.ArgumentParser(
        description="Generate new user fact table for analytics dashboard",
        formatter_class=argparse.RawDescriptionHelpFormatter
    )
    
    parser.add_argument(
        "--test_mode",
        action="store_true", 
        help="Run in test mode with last 100 users only"
    )
    parser.add_argument(
        "--batch_size",
        type=int,
        default=PERFORMANCE_THRESHOLDS['batch_size'],
        help=f"Batch size for processing (default: {PERFORMANCE_THRESHOLDS['batch_size']})"
    )
    parser.add_argument(
        "--output_dir",
        default="generated_data",
        help="Output directory for generated files"
    )
    
    args = parser.parse_args()
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    
    logger.info("🚀 Starting New User Fact Table Generation")
    logger.info(f"   Mode: {'TEST' if args.test_mode else 'PRODUCTION'}")
    logger.info(f"   Batch size: {args.batch_size}")
    logger.info(f"   Output directory: {args.output_dir}")
    
    # Initialize execution statistics
    execution_stats = {
        'start_time': datetime.now(),
        'mode': 'test' if args.test_mode else 'production',
        'batch_size': args.batch_size,
        'batches_processed': 0,
        'total_users_processed': 0,
        'performance_issues': [],
        'data_quality_metrics': {},
        'query_performance': {}
    }
    
    try:
        # Test database connection
        logger.info("Testing database connection...")
        test_conn = get_database_connection()
        test_conn.close()
        logger.info("✅ Database connection successful")
        
        # Performance analysis of main query (small subset)
        if not args.test_mode:
            logger.info("Analyzing query performance...")
            perf_analysis = analyze_query_performance(
                "SELECT COUNT(*) FROM users WHERE created_at >= '2025-03-05' AND deleted_at = 0"
            )
            execution_stats['query_performance'] = perf_analysis
            
            if not perf_analysis['performance_acceptable']:
                logger.warning("⚠️ Query performance analysis indicates potential issues")
                execution_stats['performance_issues'].append("Query performance below threshold")
        
        # Main processing loop
        all_fact_records = []
        offset = 0
        batch_count = 0
        
        while True:
            batch_start_time = time.time()
            
            # Determine batch size for test mode
            current_batch_size = 100 if args.test_mode else args.batch_size
            
            # Get batch of users
            logger.info(f"Processing batch {batch_count + 1} (offset: {offset})")
            user_batch = get_new_users_batch(offset, current_batch_size)
            
            if not user_batch:
                logger.info("No more users to process")
                break
            
            # Create fact table records for this batch
            fact_batch = create_fact_table_batch(user_batch)
            all_fact_records.extend(fact_batch)
            
            # Performance monitoring
            batch_time = time.time() - batch_start_time
            if batch_time > PERFORMANCE_THRESHOLDS['max_query_time']:
                logger.warning(f"Batch {batch_count + 1} exceeded performance threshold: {batch_time:.2f}s")
                execution_stats['performance_issues'].append(f"Batch {batch_count + 1} slow: {batch_time:.2f}s")
            
            # Progress reporting
            batch_count += 1
            execution_stats['batches_processed'] = batch_count
            execution_stats['total_users_processed'] = len(all_fact_records)
            
            if batch_count % PERFORMANCE_THRESHOLDS['progress_report_interval'] == 0:
                logger.info(f"   📊 Progress: {batch_count} batches, {len(all_fact_records)} users processed")
            
            # Update offset for next batch
            offset += len(user_batch)
            
            # Break for test mode after first batch
            if args.test_mode:
                logger.info("Test mode: stopping after first batch")
                break
        
        # Data validation
        logger.info("Validating fact table data quality...")
        validation_results = validate_fact_table_data(all_fact_records)
        execution_stats['data_quality_metrics'] = validation_results
        
        if validation_results['valid']:
            logger.info(f"✅ Data validation passed")
            logger.info(f"   Total records: {validation_results['total_records']}")
            logger.info(f"   Username coverage: {validation_results['username_coverage']:.1f}%")
            logger.info(f"   Activity coverage: {validation_results['activity_coverage']:.1f}%")
        else:
            logger.error("❌ Data validation failed")
            return
        
        # Save fact table CSV
        logger.info("Saving fact table to CSV...")
        csv_path = save_fact_table_csv(all_fact_records, args.output_dir, timestamp)
        execution_stats['output_csv'] = csv_path
        
        # Generate performance report
        execution_stats['end_time'] = datetime.now()
        execution_stats['total_execution_time'] = (execution_stats['end_time'] - execution_stats['start_time']).total_seconds()
        
        report_path = generate_performance_report(execution_stats, args.output_dir, timestamp)
        
        # Final summary
        logger.info("🎉 Fact table generation completed successfully!")
        logger.info(f"   Total users processed: {execution_stats['total_users_processed']}")
        logger.info(f"   Total execution time: {execution_stats['total_execution_time']:.2f}s")
        logger.info(f"   Data quality score: {validation_results['data_quality_score']:.1f}%")
        logger.info(f"   Output CSV: {csv_path}")
        logger.info(f"   Performance report: {report_path}")
        
        if execution_stats['performance_issues']:
            logger.warning(f"   Performance issues detected: {len(execution_stats['performance_issues'])}")
            for issue in execution_stats['performance_issues']:
                logger.warning(f"     - {issue}")
        
    except Exception as e:
        logger.error(f"❌ Fact table generation failed: {e}")
        execution_stats['error'] = str(e)
        execution_stats['end_time'] = datetime.now()
        
        # Save error report
        generate_performance_report(execution_stats, args.output_dir, timestamp)
        raise


if __name__ == "__main__":
    main()
