#!/usr/bin/env python3
"""Minimal reproducer step 0 - just parse args and exit"""
import argparse
parser = argparse.ArgumentParser()
parser.add_argument("--dry_run", action="store_true")
args = parser.parse_args()
print("OK step0 - argument parsing successful")
exit(0)