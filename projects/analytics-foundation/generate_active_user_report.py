import os
import sys
import psycopg2
import pandas as pd
from dotenv import load_dotenv

# Add project root to the Python path
sys.path.append(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))


# A "sacred" file, according to the @architect. Never to be edited.
from basic_capabilities.internal_db_queries_toolbox.config import get_secret

def get_db_connection():
    """Establishes a connection to the PostgreSQL database."""
    try:
        conn = psycopg2.connect(
            dbname=get_secret("DB_NAME"),
            user=get_secret("DB_USER"),
            password=get_secret("DB_PASSWORD"),
            host=get_secret("DB_HOST"),
            port=get_secret("DB_PORT")
        )
        return conn
    except Exception as e:
        print(f"Error connecting to the database: {e}")
        return None

def get_active_user_counts():
    """
    Retrieves counts of active users and offer creators over several trailing time windows.
    """
    query = """
    SELECT
        -- Active Users
        COUNT(DISTINCT u.id) FILTER (WHERE ua.last_active >= NOW() - INTERVAL '1 day') AS active_last_24h,
        COUNT(DISTINCT u.id) FILTER (WHERE ua.last_active >= NOW() - INTERVAL '3 days') AS active_last_72h,
        COUNT(DISTINCT u.id) FILTER (WHERE ua.last_active >= NOW() - INTERVAL '7 days') AS active_last_7d,
        COUNT(DISTINCT u.id) FILTER (WHERE ua.last_active >= NOW() - INTERVAL '30 days') AS active_last_30d,
        COUNT(DISTINCT u.id) FILTER (WHERE ua.last_active >= NOW() - INTERVAL '90 days') AS active_last_90d,

        -- Active Users who created an offer
        COUNT(DISTINCT CASE WHEN o.created_at >= NOW() - INTERVAL '1 day' THEN u.id END) AS offer_creators_last_24h,
        COUNT(DISTINCT CASE WHEN o.created_at >= NOW() - INTERVAL '3 days' THEN u.id END) AS offer_creators_last_72h,
        COUNT(DISTINCT CASE WHEN o.created_at >= NOW() - INTERVAL '7 days' THEN u.id END) AS offer_creators_last_7d,
        COUNT(DISTINCT CASE WHEN o.created_at >= NOW() - INTERVAL '30 days' THEN u.id END) AS offer_creators_last_30d,
        COUNT(DISTINCT CASE WHEN o.created_at >= NOW() - INTERVAL '90 days' THEN u.id END) AS offer_creators_last_90d

    FROM users u
    JOIN user_activities ua ON u.id = ua.user_id
    LEFT JOIN offers o ON u.id = o.creator_user_id AND o.created_at >= NOW() - INTERVAL '90 days' -- Optimization
    WHERE u.deleted_at = 0
      AND ua.last_active >= NOW() - INTERVAL '90 days'; -- Optimization
    """
    
    conn = get_db_connection()
    if conn:
        try:
            df = pd.read_sql_query(query, conn)
            return df
        except Exception as e:
            print(f"An error occurred: {e}")
            return None
        finally:
            conn.close()
    return None

if __name__ == "__main__":
    load_dotenv()
    active_users_df = get_active_user_counts()
    
    if active_users_df is not None and not active_users_df.empty:
        # Transpose the DataFrame for better readability
        report = active_users_df.T.reset_index()
        report.columns = ['Metric', 'Count']
        
        # Separate the metrics for a clear, combined report
        active_users = report[report['Metric'].str.startswith('active')].copy()
        offer_creators = report[report['Metric'].str.startswith('offer_creators')].copy()

        # Clean up the metric names to act as a join key
        active_users['Timeframe'] = active_users['Metric'].str.replace('active_last_', '')
        offer_creators['Timeframe'] = offer_creators['Metric'].str.replace('offer_creators_last_', '')
        
        # Merge the two dataframes
        final_report = pd.merge(active_users, offer_creators, on='Timeframe')
        final_report = final_report[['Timeframe', 'Count_x', 'Count_y']]
        final_report.columns = ['Timeframe', 'Active Users', 'Offer Creators']

        # Prettier names for the timeframe and proper sorting
        timeframe_map = {
            '24h': 'Last 24 Hours',
            '72h': 'Last 72 Hours',
            '7d': 'Last 7 Days',
            '30d': 'Last 30 Days',
            '90d': 'Last 90 Days'
        }
        
        timeframe_order = ['24h', '72h', '7d', '30d', '90d']
        
        final_report['Timeframe'] = pd.Categorical(final_report['Timeframe'], categories=timeframe_order, ordered=True)
        final_report = final_report.sort_values('Timeframe')
        final_report['Timeframe'] = final_report['Timeframe'].map(timeframe_map)

        print("Active User & Offer Creator Report:")
        print(final_report.to_string(index=False))
    else:
        print("Could not generate the active user report.")
