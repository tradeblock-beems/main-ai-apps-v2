#!/usr/bin/env python3
"""Minimal reproducer step 1 - import sys path setup"""
import argparse
import os
import sys

# Add project root to Python path (same as main script)
sys.path.append(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

parser = argparse.ArgumentParser()
parser.add_argument("--dry_run", action="store_true")
args = parser.parse_args()
print("OK step1 - sys path setup successful")
exit(0)