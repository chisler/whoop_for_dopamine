# Whoop for Dopamine

MVP Chrome extension: track dopamine strain and focus — local-only productivity insights.

## What it does

1. **Event collector** — Tracks (no content):
   - `active_tab_changed` (domain + URL pattern)
   - `focus_time` (seconds per tab)
   - `tab_switch` count
   - `scroll` count + distance
   - `click` count
   - `idle` state
   - `window_focus` (browser focused/unfocused)
   - Daypart (late-night multiplier)

2. **URL classifier** — Labels like `YOUTUBE_SHORTS`, `X_HOME`, `REDDIT_FEED`, `DOCS_WORK`, etc.

3. **Local storage** — Raw events + 1-minute buckets in IndexedDB

4. **Scoring** — Dopamine Strain (0–100) and Focus minutes

5. **Dashboard** — Full page (opens in new tab): today’s scores, top triggers, hourly heatmap, 7-day trend

6. **Privacy** — Local-only by default. Optional “Export JSON” for your own analysis.

## Load the extension

1. Open `chrome://extensions`
2. Enable **Developer mode**
3. Click **Load unpacked**
4. Select the `whoop_for_dopamine` folder

## Permissions

- `tabs`, `activeTab` — tab tracking
- `storage` — session state
- `idle` — idle detection
- `scripting` — content script injection
- `host_permissions: <all_urls>` — content script on all sites (can be tightened later)

## File structure

```
whoop_for_dopamine/
├── manifest.json
├── background.js      # Service worker orchestration
├── content.js         # Scroll + click tracking
├── url-classifier.js  # Intent vs feed labels
├── storage.js         # IndexedDB wrapper
├── tracking/
│   ├── runtime.js     # State, bucket lifecycle, accrual, content events
│   ├── time.js        # Local date/time helpers
│   ├── scoring.js     # Strain/focus scoring functions
│   └── enrich.js      # Visit + bucket enrichment and hourly timeline
├── dashboard.html
├── dashboard.css
├── dashboard.js
└── README.md
```
