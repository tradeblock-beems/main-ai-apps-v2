#!/usr/bin/env python3
"""Minimal reproducer step 2 - import basic_capabilities"""
import argparse
import os
import sys

# Add project root to Python path (same as main script)
sys.path.append(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

try:
    from basic_capabilities.internal_db_queries_toolbox.push_csv_queries import get_daily_activity_data
    print("OK step2 - basic_capabilities import successful")
except Exception as e:
    print(f"FAIL step2 - basic_capabilities import failed: {e}")
    exit(1)

parser = argparse.ArgumentParser()
parser.add_argument("--dry_run", action="store_true")
args = parser.parse_args()
exit(0)