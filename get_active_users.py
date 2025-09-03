#!/usr/bin/env python3
"""
Quick Active Users Report

Pulls active unique users for multiple time periods using PostHog.
This script uses our standardized PostHog utilities.
"""

# --- BEGIN DEBUG SHIM ---
import os, sys, json, time, traceback
_ts = str(int(time.time()*1000))
_log_dir = os.path.join(os.getcwd(), "tmp")
os.makedirs(_log_dir, exist_ok=True)
_log_path = os.path.join(_log_dir, f"_pydebug_{_ts}.log")
try:
    with open(_log_path, "w", buffering=1) as f:
        f.write("[start]\n")
        f.write("argv=" + json.dumps(sys.argv) + "\n")
        f.write("executable=" + sys.executable + "\n")
        f.write("version=" + sys.version + "\n")
        f.write("cwd=" + os.getcwd() + "\n")
        keys = ["PATH","PYTHONPATH","VIRTUAL_ENV","OUTPUT_PATH","EXECUTION_ID","ENV","NODE_ENV"]
        env_dump = {k: os.environ.get(k) for k in keys}
        f.write("env_subset=" + json.dumps(env_dump) + "\n")
except Exception:
    pass
# --- END DEBUG SHIM ---

# Explicit path resolution
import sys, os
repo_root = os.path.abspath(os.path.join(os.path.dirname(__file__)))
if repo_root not in sys.path:
    sys.path.insert(0, repo_root)

# Import with exception handling
try:
    from basic_capabilities.internal_db_queries_toolbox.posthog_utils import get_active_users_count, get_event_count, get_unique_event_creators
    from datetime import datetime
except Exception as e:
    with open(_log_path, "a", buffering=1) as f:
        f.write("[import_exception]\n")
        f.write(traceback.format_exc() + "\n")
    raise

def main():
    """
    Main function to query active users and offer created events for all requested time periods.
    """
    print("🚀 PostHog Analytics Report")
    print("=" * 60)
    print(f"📊 Debug log: {_log_path}")
    print(f"⏰ Generated at: {datetime.utcnow().strftime('%Y-%m-%d %H:%M:%S')} UTC")
    print()
    
    # Define time periods (in hours) as requested
    time_periods = [
        ("24 hours", 24),
        ("72 hours", 72), 
        ("7 days", 7 * 24),
        ("30 days", 30 * 24)
    ]
    
    active_users_results = {}
    offer_created_results = {}
    unique_offer_creators_results = {}
    
    try:
        for period_name, hours in time_periods:
            print(f"📈 Querying data for last {period_name}...")
            
            # Query active users
            try:
                active_count = get_active_users_count(hours)
                active_users_results[period_name] = active_count
                print(f"  ✅ Active users: {active_count:,}")
            except Exception as e:
                print(f"  ❌ Error querying active users: {str(e)}")
                active_users_results[period_name] = "Error"
            
            # Query offer created events
            try:
                offer_count = get_event_count("Offer Created", hours)
                offer_created_results[period_name] = offer_count
                print(f"  ✅ Offer Created events: {offer_count:,}")
            except Exception as e:
                print(f"  ❌ Error querying Offer Created events: {str(e)}")
                offer_created_results[period_name] = "Error"
            
            # Query unique offer creators
            try:
                unique_creators_count = get_unique_event_creators("Offer Created", hours)
                unique_offer_creators_results[period_name] = unique_creators_count
                print(f"  ✅ Unique offer creators: {unique_creators_count:,}")
            except Exception as e:
                print(f"  ❌ Error querying unique offer creators: {str(e)}")
                unique_offer_creators_results[period_name] = "Error"
            
            print()  # Empty line for readability
        
        # Summary output
        print("="*80)
        print("📊 ANALYTICS SUMMARY")
        print("="*80)
        print(f"{'Time Period':<15} {'Active Users':<15} {'Offers Created':<15} {'Unique Creators':<15}")
        print("-" * 80)
        
        for period_name, _ in time_periods:
            active_count = active_users_results[period_name]
            offer_count = offer_created_results[period_name]
            creators_count = unique_offer_creators_results[period_name]
            
            active_str = f"{active_count:,}" if active_count != "Error" else "ERROR"
            offer_str = f"{offer_count:,}" if offer_count != "Error" else "ERROR"
            creators_str = f"{creators_count:,}" if creators_count != "Error" else "ERROR"
            
            print(f"Last {period_name:<10} {active_str:<15} {offer_str:<15} {creators_str:<15}")
        
        print("="*80)
        
        # Save results to JSON for potential further processing
        output_file = os.path.join(_log_dir, f"analytics_report_{_ts}.json")
        with open(output_file, "w") as f:
            json.dump({
                "timestamp": datetime.utcnow().isoformat(),
                "active_users": active_users_results,
                "offer_created_events": offer_created_results,
                "unique_offer_creators": unique_offer_creators_results,
                "queries_executed": len(time_periods) * 3  # 3 queries per time period
            }, f, indent=2)
        
        print(f"💾 Results saved to: {output_file}")
        
    except Exception as e:
        with open(_log_path, "a", buffering=1) as f:
            f.write("[main_exception]\n")
            f.write(traceback.format_exc() + "\n")
        print(f"❌ Fatal error: {str(e)}")
        print(f"🔍 Check debug log: {_log_path}")
        return 1
    
    return 0

if __name__ == "__main__":
    exit_code = main()
    sys.exit(exit_code)
