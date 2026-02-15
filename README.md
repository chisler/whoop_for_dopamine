# Whoop for tracking Attention Span

![Whoopamine Screenshot](WhoopamineScreenshot.png)

## Installation

1. Open `chrome://extensions`
2. Enable **Developer mode**
3. Click **Load unpacked**
4. Select the `whoop_for_dopamine` folder

## Garmin HR Export (Python)

Export daily heart rate data from Garmin Connect to JSON files.

### Setup

```bash
python3 -m venv venv && source venv/bin/activate  # or venv\Scripts\activate on Windows
pip install -r requirements.txt
```

### Run

```bash
export GARMIN_EMAIL="you@example.com"
export GARMIN_PASSWORD="your_password"
python garmin_hr_export.py
```

Optional: specify date range with `--start` and `--end`:

```bash
python garmin_hr_export.py --start 2026-01-01 --end 2026-02-15
```

Output: `garmin_hr_json/YYYY-MM-DD.json` (contains `heartRateValues`: `[timestamp_ms, hr, ...]`)

Session is saved to `garmin_session/` so you typically only need to login once (MFA may be required on first run).
