#!/usr/bin/env python3
"""
Download daily heart rate and activities from Garmin Connect, save as JSON.
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
ACTIVITIES_DIR = "garmin_activities_json"
SESSION_DIR = "garmin_session"  # directory with oauth1/oauth2 tokens
# --------------------------


def daterange(d0: date, d1: date):
    d = d0
    while d <= d1:
        yield d
        d += timedelta(days=1)


def fetch_activities(iso: str) -> list[str]:
    """Fetch activities for a date. Returns list of activity dicts."""
    display_key = garth.client.user_profile["displayName"]
    path = f"/activitylist-service/activities/fordailysummary/{display_key}?calendarDate={iso}"
    data = garth.connectapi(path)
    return data if isinstance(data, list) else []


def main():
    os.makedirs(OUT_DIR, exist_ok=True)
    os.makedirs(ACTIVITIES_DIR, exist_ok=True)

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
    parser = argparse.ArgumentParser(description="Export Garmin HR and activities to JSON")
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
    parser.add_argument(
        "--hr-only",
        action="store_true",
        help="Only fetch heart rate (skip activities)",
    )
    parser.add_argument(
        "--activities-only",
        action="store_true",
        help="Only fetch activities (skip heart rate)",
    )
    args = parser.parse_args()
    start = date.fromisoformat(args.start)
    end = date.fromisoformat(args.end)

    today = date.today()
    for d in daterange(start, end):
        iso = d.isoformat()
        is_today = d == today

        # Heart rate
        if not args.activities_only:
            hr_path = os.path.join(OUT_DIR, f"{iso}.json")
            if os.path.exists(hr_path) and not is_today:
                print("skip hr (exists)", hr_path)
            else:
                try:
                    hr_data = garth.connectapi(
                        f"/wellness-service/wellness/dailyHeartRate?date={iso}"
                    )
                    with open(hr_path, "w", encoding="utf-8") as f:
                        json.dump(hr_data, f, ensure_ascii=False, indent=2)
                    print("saved hr", hr_path)
                except GarthException as e:
                    print("hr error", iso, e)

        # Activities
        if not args.hr_only:
            act_path = os.path.join(ACTIVITIES_DIR, f"{iso}.json")
            if not os.path.exists(act_path) or is_today:
                try:
                    activities = fetch_activities(iso)
                    out = {"calendarDate": iso, "activities": activities}
                    with open(act_path, "w", encoding="utf-8") as f:
                        json.dump(out, f, ensure_ascii=False, indent=2)
                    print("saved activities", act_path, f"({len(activities)} activities)")
                except GarthException as e:
                    print("activities error", iso, e)
            elif not is_today:
                print("skip activities (exists)", act_path)


if __name__ == "__main__":
    main()
