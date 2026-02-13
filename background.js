/**
 * Service worker: tab/focus/idle events, bucketing, scoring
 */

import { classifyUrl, isFeedCategory, isStimulationCategory } from './url-classifier.js';
import { addEvent, saveBucket, getBucketByKey, getBucketsForDate, getBucketsInRange, getEventsForDate } from './storage.js';

// --- State (persisted to chrome.storage.session for service worker restarts) ---
let state = {
  activeTabId: null,
  activeTabUrl: null,
  activeTabDomain: null,
  tabActivatedAt: null,
  windowFocused: true,
  idleState: 'active',
  lastMinuteKey: null,
  pendingBucket: null
};

async function loadState() {
  const s = await chrome.storage.session.get('whoopState');
  if (s.whoopState) state = { ...state, ...s.whoopState };
}

async function saveState() {
  await chrome.storage.session.set({ whoopState: state });
}

function getMinuteKey() {
  const d = new Date();
  const date = d.toISOString().slice(0, 10);
  const minute = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  return { date, minute, key: `${date}_${minute}` };
}

function getHour() {
  return new Date().getHours();
}

function isLateNight(hour) {
  return hour >= 22 || hour < 6;
}

// --- Flush current bucket to storage ---
async function flushBucket() {
  if (!state.pendingBucket) return;
  await saveBucket(state.pendingBucket);
  // Keep lastMinuteKey so we know we're still in the same minute; just clear
  // the in-memory bucket. Next getOrCreateBucket call will reload from storage.
  state.pendingBucket = null;
}

// --- Get or create bucket for current minute ---
async function getOrCreateBucket() {
  const { date, minute, key } = getMinuteKey();
  if (state.lastMinuteKey !== key) {
    // Minute rolled over — flush old bucket and start fresh
    await flushBucket();
    state.lastMinuteKey = key;
    const hour = getHour();
    const timestamp = new Date(`${date}T${minute}:00`).getTime();
    state.pendingBucket = {
      date,
      minute,
      timestamp,
      focused_seconds: 0,
      switches: 0,
      scrolls: 0,
      scroll_distance: 0,
      clicks: 0,
      shorts_count: 0,
      reels_count: 0,
      tiktoks_count: 0,
      stimulation_seconds: 0,
      youtube_watch_seconds: 0,
      category: state.activeTabUrl ? classifyUrl(state.activeTabUrl) : 'UNKNOWN',
      url: state.activeTabUrl || null,
      hour
    };
  } else if (!state.pendingBucket) {
    // Same minute but bucket was flushed mid-minute — reload from storage so
    // we don't overwrite already-saved data with a zeroed-out bucket.
    const existing = await getBucketByKey(key);
    if (existing) {
      state.pendingBucket = existing;
    } else {
      const hour = getHour();
      const timestamp = new Date(`${date}T${minute}:00`).getTime();
      state.pendingBucket = {
        date, minute, timestamp,
        focused_seconds: 0, switches: 0, scrolls: 0, scroll_distance: 0, clicks: 0,
        shorts_count: 0, reels_count: 0, tiktoks_count: 0,
        stimulation_seconds: 0, youtube_watch_seconds: 0,
        category: state.activeTabUrl ? classifyUrl(state.activeTabUrl) : 'UNKNOWN',
        url: state.activeTabUrl || null,
        hour
      };
    }
  }
  return state.pendingBucket;
}

// --- Event handlers ---

async function onTabActivated(activeInfo) {
  const now = Date.now();

  // Record focus time for previous tab
  if (state.tabActivatedAt && state.windowFocused && state.idleState === 'active') {
    const focusSeconds = Math.floor((now - state.tabActivatedAt) / 1000);
    if (focusSeconds > 0) {
      const bucket = await getOrCreateBucket();
      bucket.focused_seconds += focusSeconds;
      const prevUrl = state.activeTabUrl;
      const prevCategory = prevUrl ? classifyUrl(prevUrl) : 'UNKNOWN';
      if (isStimulationCategory(prevCategory)) {
        bucket.stimulation_seconds = (bucket.stimulation_seconds || 0) + focusSeconds;
      }
      if (prevUrl && prevUrl.startsWith('http')) {
        bucket.url = prevUrl;
        if (bucket.category === 'UNKNOWN' || bucket.category === 'OTHER') bucket.category = prevCategory;
        await saveBucket(bucket);
      }
    }
  }

  // Tab switch count
  if (state.activeTabId !== null) {
    const bucket = await getOrCreateBucket();
    bucket.switches += 1;
  }

  // Get new tab info
  try {
    const tab = await chrome.tabs.get(activeInfo.tabId);
    state.activeTabId = tab.id;
    state.activeTabUrl = tab.url || '';
    state.activeTabDomain = new URL(state.activeTabUrl || 'about:blank').hostname.replace(/^www\./, '');
  } catch {
    state.activeTabId = activeInfo.tabId;
    state.activeTabUrl = '';
    state.activeTabDomain = 'unknown';
  }

  state.tabActivatedAt = now;
  await saveState();

  // Emit raw event with timestamp (include url for post-processing)
  await addEvent({
    type: 'active_tab_changed',
    domain: state.activeTabDomain,
    category: classifyUrl(state.activeTabUrl),
    url: state.activeTabUrl || null,
    tabId: activeInfo.tabId,
    ts: now
  });

  // Record session start (first activity of day)
  const today = new Date().toISOString().slice(0, 10);
  const key = `sessionStart_${today}`;
  const stored = await chrome.storage.local.get(key);
  if (!stored[key]) {
    await chrome.storage.local.set({ [key]: now });
  }
}

async function resolveUrl(msg, sender) {
  if (msg.url && typeof msg.url === 'string' && msg.url.startsWith('http')) return msg.url;
  if (sender?.tab?.id) {
    try {
      const tab = await chrome.tabs.get(sender.tab.id);
      if (tab?.url && tab.url.startsWith('http')) return tab.url;
    } catch {}
  }
  return state.activeTabUrl && state.activeTabUrl.startsWith('http') ? state.activeTabUrl : null;
}

async function setBucketUrl(bucket, url) {
  if (!url || !url.startsWith('http')) return;
  bucket.url = url;
  const cat = classifyUrl(url);
  if (cat !== 'OTHER' || bucket.category === 'UNKNOWN' || bucket.category === 'OTHER') bucket.category = cat;
  state.activeTabUrl = url; // Keep in sync for SPA nav (no tab switch)
  await saveBucket(bucket);
}

async function onContentEvent(msg, sender) {
  if (msg.type !== 'CONTENT_EVENT') return;

  const bucket = await getOrCreateBucket();
  const url = await resolveUrl(msg, sender);

  if (msg.event === 'scroll' || msg.event === 'scroll_batch') {
    bucket.scrolls += msg.count || 1;
    bucket.scroll_distance += msg.distance || 0;
    await setBucketUrl(bucket, url);
  } else if (msg.event === 'click') {
    bucket.clicks += msg.count || 1;
    await setBucketUrl(bucket, url);
  } else if (msg.event === 'short_watched') {
    if (msg.source === 'youtube_shorts') bucket.shorts_count = (bucket.shorts_count || 0) + 1;
    else if (msg.source === 'instagram_reels') bucket.reels_count = (bucket.reels_count || 0) + 1;
    else if (msg.source === 'tiktok') bucket.tiktoks_count = (bucket.tiktoks_count || 0) + 1;
    // short_watched sends url from content script — use it first, then resolveUrl, then active tab
    let shortUrl = msg.url || url;
    if (!shortUrl && sender?.tab?.id) {
      try {
        const tab = await chrome.tabs.get(sender.tab.id);
        shortUrl = tab?.url;
      } catch {}
    }
    if (!shortUrl) {
      const [active] = await chrome.tabs.query({ active: true, currentWindow: true });
      shortUrl = active?.url;
    }
    if (shortUrl) await setBucketUrl(bucket, shortUrl);
  } else if (msg.event === 'youtube_playing') {
    bucket.youtube_watch_seconds = (bucket.youtube_watch_seconds || 0) + (msg.seconds || 10);
    await setBucketUrl(bucket, url);
  } else if (msg.event === 'music_playing') {
    bucket.stimulation_seconds = (bucket.stimulation_seconds || 0) + (msg.seconds || 10);
    await setBucketUrl(bucket, url);
  }
}

async function onIdleChange(newState) {
  const now = Date.now();
  state.idleState = newState;

  if (newState !== 'active' && state.tabActivatedAt && state.windowFocused) {
    const focusSeconds = Math.floor((now - state.tabActivatedAt) / 1000);
    if (focusSeconds > 0) {
      const bucket = await getOrCreateBucket();
      bucket.focused_seconds += focusSeconds;
      const url = state.activeTabUrl;
      const cat = url ? classifyUrl(url) : 'UNKNOWN';
      if (isStimulationCategory(cat)) {
        bucket.stimulation_seconds = (bucket.stimulation_seconds || 0) + focusSeconds;
      }
      if (url && url.startsWith('http')) {
        bucket.url = url;
        if (bucket.category === 'UNKNOWN' || bucket.category === 'OTHER') bucket.category = cat;
        await saveBucket(bucket);
      }
    }
    state.tabActivatedAt = null;
  } else if (newState === 'active') {
    state.tabActivatedAt = now;
  }
  await saveState();
}

async function onWindowFocusChanged(windowId) {
  const now = Date.now();
  const wasFocused = state.windowFocused;
  // chrome.windows.WINDOW_ID_NONE = -1 when user switches to another app
  const focused = windowId !== chrome.windows.WINDOW_ID_NONE &&
    await chrome.windows.get(windowId).then(w => w.focused).catch(() => false);
  state.windowFocused = !!focused;

  if (wasFocused && !focused && state.tabActivatedAt) {
    const focusSeconds = Math.floor((now - state.tabActivatedAt) / 1000);
    if (focusSeconds > 0) {
      const bucket = await getOrCreateBucket();
      bucket.focused_seconds += focusSeconds;
      const url = state.activeTabUrl;
      const cat = url ? classifyUrl(url) : 'UNKNOWN';
      if (isStimulationCategory(cat)) {
        bucket.stimulation_seconds = (bucket.stimulation_seconds || 0) + focusSeconds;
      }
      if (url && url.startsWith('http')) {
        bucket.url = url;
        if (bucket.category === 'UNKNOWN' || bucket.category === 'OTHER') bucket.category = cat;
        await saveBucket(bucket);
      }
    }
    state.tabActivatedAt = null;
  } else if (!wasFocused && focused) {
    state.tabActivatedAt = now;
  }
  await saveState();

  await addEvent({ type: 'window_focus', focused });
}

// --- Scoring ---
// Smart strain: diminishing returns, per-dimension caps, saturation curve.
// 100 = extreme day; 50 = moderate; 20 = light. Uses sqrt curves so raw counts
// don't stack linearly.

function computeDopamineStrain(buckets) {
  let totalShorts = 0, totalReels = 0, totalTiktoks = 0;
  let totalStimSeconds = 0, totalYtWatchSeconds = 0;
  let totalFeedSeconds = 0;
  let fragmentationMinutes = 0;
  let lateNightActiveMinutes = 0;

  for (const b of buckets) {
    totalShorts += b.shorts_count || 0;
    totalReels += b.reels_count || 0;
    totalTiktoks += b.tiktoks_count || 0;
    totalStimSeconds += b.stimulation_seconds || 0;
    totalYtWatchSeconds += b.youtube_watch_seconds || 0;
    if (isFeedCategory(b.category)) totalFeedSeconds += b.focused_seconds || 0;
    const isFragmented =
      (b.focused_seconds > 0 && b.focused_seconds < 90) ||
      b.switches >= 4 ||
      b.scrolls > 20 ||
      b.scroll_distance > 2000;
    if (isFragmented) fragmentationMinutes += 1;
    const hasActivity = (b.focused_seconds || 0) + (b.shorts_count || 0) + (b.reels_count || 0) + (b.tiktoks_count || 0) > 0;
    if (isLateNight(b.hour) && hasActivity) lateNightActiveMinutes += 1;
  }

  // Dim 1: Short-form (0–20) — highest impact, strong diminishing returns
  const shortFormTotal = totalShorts + totalReels + totalTiktoks;
  const shortFormScore = Math.min(20, 2.2 * Math.sqrt(shortFormTotal));

  // Dim 2: Stimulation (0–14) — music + YT playing
  const stimMins = (totalStimSeconds + totalYtWatchSeconds) / 60;
  const stimScore = Math.min(14, 1.8 * Math.sqrt(stimMins));

  // Dim 3: Feed time (0–14)
  const feedMins = totalFeedSeconds / 60;
  const feedScore = Math.min(14, 1.8 * Math.sqrt(feedMins));

  // Dim 4: Fragmentation (0–10) — scattered attention
  const fragScore = Math.min(10, 1.2 * Math.sqrt(fragmentationMinutes));

  // Dim 5: Late night (0–8) — circadian penalty
  const lateScore = Math.min(8, 0.4 * lateNightActiveMinutes);

  const raw = shortFormScore + stimScore + feedScore + fragScore + lateScore;
  // Saturation: raw 25→~58, 40→~75, 55→~86, 70→~92. 100 requires extreme day.
  const score = Math.round(100 * (1 - Math.exp(-raw / 25)));
  return Math.min(100, score);
}

function computeStrainBreakdown(buckets) {
  const breakdown = {};
  for (const b of buckets) {
    const shorts = b.shorts_count || 0;
    const reels = b.reels_count || 0;
    const tiktoks = b.tiktoks_count || 0;
    const stimMins = Math.floor((b.stimulation_seconds || 0) / 60);
    const ytMins = Math.floor((b.youtube_watch_seconds || 0) / 60);
    const feedMins = isFeedCategory(b.category) ? b.focused_seconds / 60 : 0;
    const shortSessions = (b.focused_seconds > 0 && b.focused_seconds < 90) ? 1 : 0;
    const highSwitch = b.switches >= 4 ? 1 : 0;
    const highScroll = (b.scrolls > 20 || b.scroll_distance > 2000) ? 1 : 0;
    const lateNight = isLateNight(b.hour) ? 1 : 0;

    breakdown.youtubeShorts = (breakdown.youtubeShorts || 0) + shorts;
    breakdown.instagramReels = (breakdown.instagramReels || 0) + reels;
    breakdown.tiktoks = (breakdown.tiktoks || 0) + tiktoks;
    breakdown.musicMinutes = (breakdown.musicMinutes || 0) + stimMins;
    breakdown.youtubeWatchMinutes = (breakdown.youtubeWatchMinutes || 0) + ytMins;
    breakdown.feedMinutes = (breakdown.feedMinutes || 0) + feedMins;
    breakdown.shortSessions = (breakdown.shortSessions || 0) + shortSessions;
    breakdown.highSwitchMinutes = (breakdown.highSwitchMinutes || 0) + highSwitch;
    breakdown.highScrollMinutes = (breakdown.highScrollMinutes || 0) + highScroll;
    breakdown.lateNightMinutes = (breakdown.lateNightMinutes || 0) + lateNight;
  }
  return breakdown;
}

function computeFocusMinutes(buckets) {
  let totalFocus = 0;
  let longestBlock = 0;
  let currentBlock = 0;

  for (const b of buckets) {
    const isLowSwitch = b.switches <= 2;
    const isLowScroll = b.scrolls <= 5 && b.scroll_distance <= 500;
    const isWork = b.category === 'DOCS_WORK' || b.category === 'REDDIT_THREAD' || b.category === 'YOUTUBE_WATCH' || b.category === 'X_THREAD';

    if (isWork && isLowSwitch && isLowScroll) {
      const mins = b.focused_seconds / 60;
      totalFocus += mins;
      currentBlock += mins;
      longestBlock = Math.max(longestBlock, currentBlock);
    } else {
      currentBlock = 0;
    }
  }
  return { totalFocus: Math.round(totalFocus * 10) / 10, longestBlock: Math.round(longestBlock * 10) / 10 };
}

// --- API for popup ---

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === 'GET_DASHBOARD') {
    (async () => {
      await flushBucket();
      const today = new Date().toISOString().slice(0, 10);
      const buckets = await getBucketsForDate(today);
      const events = await getEventsForDate(today);

      // Session start = when Chrome was first used today
      const sessionKey = `sessionStart_${today}`;
      const { [sessionKey]: sessionStart } = await chrome.storage.local.get(sessionKey);

      // Visits = tab changes with timestamps (include url when available)
      let visits = events
        .filter(e => e.type === 'active_tab_changed')
        .map(e => ({ ts: e.ts, domain: e.domain, category: e.category, url: e.url }))
        .sort((a, b) => a.ts - b.ts);

      // Fallback: if no visits, use state or current tab (exclude dashboard/extension URLs)
      const isWebUrl = u => u && u.startsWith('http') && !u.startsWith('chrome-extension://');
      if (visits.length === 0 && isWebUrl(state.activeTabUrl)) {
        const domain = new URL(state.activeTabUrl).hostname.replace(/^www\./, '');
        visits = [{ ts: Date.now(), domain, category: classifyUrl(state.activeTabUrl), url: state.activeTabUrl }];
      }
      if (visits.length === 0) {
        try {
          const tabs = await chrome.tabs.query({});
          const webTab = tabs.find(t => isWebUrl(t.url));
          if (webTab) {
            const domain = new URL(webTab.url).hostname.replace(/^www\./, '');
            visits = [{ ts: webTab.lastAccessed || Date.now(), domain, category: classifyUrl(webTab.url), url: webTab.url }];
          }
        } catch {}
      }

      // Post-process: infer URL from visits, re-classify from URL, semantic override from counts
      const enrichedBuckets = buckets.map(b => {
        const b2 = { ...b };
        // 1. Infer URL from visits if missing (use visit.url or construct from domain)
        if (!b2.url && visits.length > 0) {
          const bucketTs = b2.timestamp || new Date(`${b2.date}T${b2.minute}:00`).getTime();
          const active = visits.filter(v => v.ts <= bucketTs).pop() || visits[0];
          b2.url = (active?.url && active.url.startsWith('http')) ? active.url : (active?.domain ? `https://${active.domain}` : null);
        }
        // 2. Re-classify from URL when category is wrong (URL is source of truth)
        if (b2.url && (b2.category === 'UNKNOWN' || b2.category === 'OTHER')) {
          const fromUrl = classifyUrl(b2.url);
          if (fromUrl !== 'OTHER') b2.category = fromUrl;
        }
        // 3. Semantic override: counts tell us what we were watching
        if ((b2.category === 'UNKNOWN' || b2.category === 'OTHER') && (b2.shorts_count || 0) > 0) b2.category = 'YOUTUBE_SHORTS';
        else if ((b2.category === 'UNKNOWN' || b2.category === 'OTHER') && (b2.reels_count || 0) > 0) b2.category = 'INSTAGRAM_REELS';
        else if ((b2.category === 'UNKNOWN' || b2.category === 'OTHER') && (b2.tiktoks_count || 0) > 0) b2.category = 'TIKTOK';
        return b2;
      });

      const strain = computeDopamineStrain(enrichedBuckets);
      const { totalFocus, longestBlock } = computeFocusMinutes(enrichedBuckets);

      // Strain breakdown — only non-zero
      const rawBreakdown = computeStrainBreakdown(enrichedBuckets);
      const strainBreakdown = Object.entries(rawBreakdown)
        .filter(([, v]) => v > 0)
        .map(([key, value]) => ({ key, value }));

      // Top triggers + full category breakdown
      const categoryCounts = {};
      let totalSwitches = 0;
      for (const b of enrichedBuckets) {
        categoryCounts[b.category] = (categoryCounts[b.category] || 0) + (b.focused_seconds / 60);
        totalSwitches += b.switches || 0;
      }
      const topTriggers = Object.entries(categoryCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([cat, mins]) => ({ category: cat, minutes: Math.round(mins * 10) / 10 }));
      const fullCategoryBreakdown = Object.entries(categoryCounts)
        .sort((a, b) => b[1] - a[1])
        .map(([cat, mins]) => ({ category: cat, minutes: Math.round(mins * 10) / 10 }));

      // Hourly strain + active types for unified timeline
      const hourlyTimeline = {};
      for (let h = 0; h < 24; h++) {
        hourlyTimeline[h] = {
          strain: 0,
          music: false,
          youtube: false,
          shorts: false,
          reels: false,
          tiktok: false,
          feed: false
        };
      }
      for (const b of enrichedBuckets) {
        const h = b.hour ?? (parseInt(String(b.minute || '0').split(':')[0], 10) || 0);
        const shorts = (b.shorts_count || 0);
        const reels = (b.reels_count || 0);
        const tiktoks = (b.tiktoks_count || 0);
        const stimSec = (b.stimulation_seconds || 0);
        const ytSec = (b.youtube_watch_seconds || 0);
        const feedMins = isFeedCategory(b.category) ? b.focused_seconds / 60 : 0;
        const switches = b.switches || 0;
        const shortForm = shorts + reels + tiktoks;
        const stimMins = (stimSec + ytSec) / 60;
        const strainRaw = shortForm * 3 + stimMins * 2 + feedMins * 1.5 + switches * 0.8;
        hourlyTimeline[h].strain += strainRaw;
        if (stimSec > 60) hourlyTimeline[h].music = true;
        if (ytSec > 60) hourlyTimeline[h].youtube = true;
        if (shorts > 0) hourlyTimeline[h].shorts = true;
        if (reels > 0) hourlyTimeline[h].reels = true;
        if (tiktoks > 0) hourlyTimeline[h].tiktok = true;
        if (feedMins > 0) hourlyTimeline[h].feed = true;
      }

      // 7-day trend
      const end = new Date();
      const start = new Date();
      start.setDate(start.getDate() - 6);
      const startStr = start.toISOString().slice(0, 10);
      const endStr = end.toISOString().slice(0, 10);
      const weekBuckets = await getBucketsInRange(startStr, endStr);
      const byDate = {};
      for (const b of weekBuckets) {
        if (!byDate[b.date]) byDate[b.date] = [];
        byDate[b.date].push(b);
      }
      const trend = Object.entries(byDate).map(([date, bks]) => ({
        date,
        strain: computeDopamineStrain(bks),
        focus: computeFocusMinutes(bks).totalFocus
      })).sort((a, b) => a.date.localeCompare(b.date));

      sendResponse({
        today: { strain, focusMinutes: totalFocus, longestBlock, totalSwitches },
        strainBreakdown,
        trend,
        sessionStart: sessionStart || null,
        visits,
        buckets: enrichedBuckets.map(b => ({
          ...b,
          hour: b.hour ?? (parseInt(String(b.minute || '0').split(':')[0], 10) || 0)
        })),
        hourlyTimeline: Object.entries(hourlyTimeline).map(([h, d]) => ({
          hour: parseInt(h),
          strain: Math.round(d.strain * 10) / 10,
          music: d.music,
          youtube: d.youtube,
          shorts: d.shorts,
          reels: d.reels,
          tiktok: d.tiktok,
          feed: d.feed
        }))
      });
    })();
    return true;
  }
  if (msg.type === 'EXPORT_JSON') {
    (async () => {
      const today = new Date().toISOString().slice(0, 10);
      const buckets = await getBucketsForDate(today);
      const events = await getEventsForDate(today);
      const visits = events
        .filter(e => e.type === 'active_tab_changed')
        .map(e => ({ ts: e.ts, domain: e.domain, category: e.category, url: e.url }))
        .sort((a, b) => a.ts - b.ts);
      const enriched = buckets.map(b => {
        const b2 = { ...b };
        if (!b2.url && visits.length > 0) {
          const bucketTs = b2.timestamp || new Date(`${b2.date}T${b2.minute}:00`).getTime();
          const active = visits.filter(v => v.ts <= bucketTs).pop() || visits[0];
          b2.url = (active?.url && active.url.startsWith('http')) ? active.url : (active?.domain ? `https://${active.domain}` : null);
        }
        return b2;
      });
      sendResponse({ date: today, buckets: enriched });
    })();
    return true;
  }
});

// --- Init ---

chrome.action.onClicked.addListener(async () => {
  const url = chrome.runtime.getURL('dashboard.html');
  const [existing] = await chrome.tabs.query({ url });
  if (existing) {
    await chrome.tabs.update(existing.id, { active: true });
    await chrome.windows.update(existing.windowId, { focused: true });
  } else {
    await chrome.tabs.create({ url });
  }
});

chrome.tabs.onActivated.addListener(onTabActivated);

// When user navigates within same tab (link click, URL bar), update state and record visit
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (tabId !== state.activeTabId) return;
  const url = changeInfo.url ?? tab?.url;
  if (url && url.startsWith('http') && url !== state.activeTabUrl) {
    state.activeTabUrl = url;
    state.activeTabDomain = new URL(url).hostname.replace(/^www\./, '');
    saveState();
    addEvent({
      type: 'active_tab_changed',
      domain: state.activeTabDomain,
      category: classifyUrl(url),
      url,
      tabId,
      ts: Date.now()
    });
  }
});

chrome.idle.onStateChanged.addListener(onIdleChange);
chrome.windows.onFocusChanged.addListener(onWindowFocusChanged);
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === 'CONTENT_EVENT') {
    onContentEvent(msg, sender).then(() => sendResponse?.()).catch(() => sendResponse?.());
    return true; // Keep channel open so SW stays alive until save completes
  }
});

// Initial load: get active tab, create first bucket, record session start
loadState().then(async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab) {
    const now = Date.now();
    state.activeTabId = tab.id;
    state.activeTabUrl = tab.url || '';
    state.activeTabDomain = new URL(state.activeTabUrl || 'about:blank').hostname.replace(/^www\./, '');
    state.tabActivatedAt = now;
    await saveState();

    // Create first bucket of the day so we record activity from the moment Chrome opened
    await getOrCreateBucket();

    // Record session start (Chrome first opened today)
    const today = new Date().toISOString().slice(0, 10);
    const key = `sessionStart_${today}`;
    const stored = await chrome.storage.local.get(key);
    if (!stored[key]) {
      await chrome.storage.local.set({ [key]: now });
    }
  }
});

// Flush bucket every 30s to avoid losing data when service worker restarts
setInterval(flushBucket, 30 * 1000);
