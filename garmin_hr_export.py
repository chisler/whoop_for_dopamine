#!/usr/bin/env python3
"""
Download daily heart rate data from Garmin Connect and save as JSON files.
Uses garth for authentication and API access.
"""
import argparse
import json
import os
from datetime import date, timedelta
from pathlib import Path

import garth
from dotenv import load_dotenv

# Load .env from project root
load_dotenv(Path(__file__).resolve().parent / ".env")
from garth.exc import GarthException

# ---------- config ----------
OUT_DIR = "garmin_hr_json"
SESSION_DIR = "garmin_session"  # directory with oauth1/oauth2 tokens
# --------------------------


def daterange(d0: date, d1: date):
    d = d0
    while d <= d1:
        yield d
        d += timedelta(days=1)


def main():
    os.makedirs(OUT_DIR, exist_ok=True)

    # Try to resume existing session first
    if os.path.exists(os.path.join(SESSION_DIR, "oauth1_token.json")):
        try:
            garth.resume(SESSION_DIR)
            print("Resumed existing session")
        except GarthException:
            print("Session expired, logging in again...")

    # Login if not already authenticated
    if not garth.client.oauth1_token:
        email = os.environ.get("GARMIN_EMAIL")
        password = os.environ.get("GARMIN_PASSWORD")
        if not email or not password:
            raise SystemExit(
                "Set GARMIN_EMAIL and GARMIN_PASSWORD in .env, or run with existing session"
            )
        garth.login(email, password)
        garth.save(SESSION_DIR)
        print("Logged in and saved session")

    # Date range: CLI args or defaults
    parser = argparse.ArgumentParser(description="Export Garmin HR data to JSON")
    parser.add_argument(
        "--start",
        type=str,
        default="2026-02-01",
        help="Start date (YYYY-MM-DD)",
    )
    parser.add_argument(
        "--end",
        type=str,
        default="2026-02-15",
        help="End date (YYYY-MM-DD)",
    )
    args = parser.parse_args()
    start = date.fromisoformat(args.start)
    end = date.fromisoformat(args.end)

    for d in daterange(start, end):
        iso = d.isoformat()
        out_path = os.path.join(OUT_DIR, f"{iso}.json")
        if os.path.exists(out_path):
            print("skip (exists)", out_path)
            continue

        try:
            data = garth.connectapi(
                f"/wellness-service/wellness/dailyHeartRate?date={iso}"
            )
        except GarthException as e:
            print("error", iso, e)
            continue

        with open(out_path, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)

        print("saved", out_path)


if __name__ == "__main__":
    main()
