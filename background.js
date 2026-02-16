/**
 * Service worker orchestration: wires tracking runtime, scoring, and dashboard APIs.
 */

import { classifyUrl } from './url-classifier.js';
import { addEvent, getBucketsForDate, getBucketsInRange, getEventsForDate, getHeartRateForDate, getActivitiesForDate } from './storage.js';
import { getDomainFromUrl, getLocalDateStr } from './tracking/time.js';
import { createTrackerRuntime } from './tracking/runtime.js';
import { computeDopamineStrain, computeFocusMinutes, computeStrainBreakdown } from './tracking/scoring.js';
import { buildHourlyTimeline, buildVisits, enrichBucketsWithVisits, ensureHourOnBuckets } from './tracking/enrich.js';

const runtime = createTrackerRuntime();

async function ensureSessionStart(ts = Date.now()) {
  const today = getLocalDateStr();
  const key = `sessionStart_${today}`;
  const stored = await chrome.storage.local.get(key);
  if (!stored[key]) {
    await chrome.storage.local.set({ [key]: ts });
  }
}

async function onTabActivated(activeInfo) {
  const now = Date.now();
  await runtime.accrueActiveTime(now, { forceSave: true });

  const state = runtime.getState();
  if (state.activeTabId !== null) {
    const bucket = await runtime.getOrCreateBucket();
    bucket.switches += 1;
  }

  try {
    const tab = await chrome.tabs.get(activeInfo.tabId);
    runtime.setActiveTab(tab.id, tab.url || '');
  } catch {
    runtime.setActiveTab(activeInfo.tabId, '');
  }

  runtime.setTabActivatedAt(now);
  await runtime.saveState();

  const next = runtime.getState();
  await addEvent({
    type: 'active_tab_changed',
    domain: next.activeTabDomain,
    category: classifyUrl(next.activeTabUrl),
    url: next.activeTabUrl || null,
    tabId: activeInfo.tabId,
    ts: now,
    date: getLocalDateStr(new Date(now))
  });

  await ensureSessionStart(now);
}

async function onIdleChange(newState) {
  const now = Date.now();

  if (newState !== 'active') {
    await runtime.accrueActiveTime(now, { forceSave: true });
    runtime.setIdleState(newState);
    runtime.setTabActivatedAt(null);
    runtime.clearMusicHeartbeat();
  } else {
    runtime.setIdleState('active');
    runtime.setTabActivatedAt(runtime.getState().windowFocused ? now : null);
  }

  await runtime.saveState();
}

async function onWindowFocusChanged(windowId) {
  const now = Date.now();
  const wasFocused = runtime.getState().windowFocused;
  const focused = windowId !== chrome.windows.WINDOW_ID_NONE &&
    await chrome.windows.get(windowId).then(w => w.focused).catch(() => false);

  if (wasFocused && !focused) {
    await runtime.accrueActiveTime(now, { forceSave: true });
    runtime.setTabActivatedAt(null);
    runtime.clearMusicHeartbeat();
  } else if (!wasFocused && focused && runtime.getState().idleState === 'active') {
    runtime.setTabActivatedAt(now);
  }

  runtime.setWindowFocused(!!focused);
  await runtime.saveState();
  await addEvent({ type: 'window_focus', focused, ts: Date.now(), date: getLocalDateStr() });
}

function getVisitsWithFallback(events) {
  const state = runtime.getState();
  const visits = buildVisits(events);
  const isWebUrl = u => u && u.startsWith('http') && !u.startsWith('chrome-extension://');

  if (visits.length === 0 && isWebUrl(state.activeTabUrl)) {
    return [{
      ts: Date.now(),
      domain: getDomainFromUrl(state.activeTabUrl),
      category: classifyUrl(state.activeTabUrl),
      url: state.activeTabUrl
    }];
  }

  return visits;
}

async function queryFallbackVisit() {
  const tabs = await chrome.tabs.query({});
  const webTab = tabs.find(t => t.url && t.url.startsWith('http') && !t.url.startsWith('chrome-extension://'));
  if (!webTab) return [];
  return [{
    ts: webTab.lastAccessed || Date.now(),
    domain: getDomainFromUrl(webTab.url),
    category: classifyUrl(webTab.url),
    url: webTab.url
  }];
}

async function buildDashboardPayload(requestDate = null) {
  const today = getLocalDateStr();
  const targetDate = requestDate || today;

  if (targetDate === today) {
    await runtime.accrueActiveTime(Date.now(), { forceSave: true });
    await runtime.flushBucket();
  }

  const buckets = await getBucketsForDate(targetDate);
  const events = await getEventsForDate(targetDate);

  const sessionKey = `sessionStart_${targetDate}`;
  const { [sessionKey]: sessionStart } = await chrome.storage.local.get(sessionKey);

  const heartRate = await getHeartRateForDate(targetDate);
  const activities = await getActivitiesForDate(targetDate);

  let visits = getVisitsWithFallback(events);
  if (visits.length === 0) {
    try {
      visits = await queryFallbackVisit();
    } catch {
      visits = [];
    }
  }

  const enrichedBuckets = enrichBucketsWithVisits(buckets, visits);
  const strain = computeDopamineStrain(enrichedBuckets);
  const { totalFocus, longestBlock } = computeFocusMinutes(enrichedBuckets);

  const rawBreakdown = computeStrainBreakdown(enrichedBuckets);
  const strainBreakdown = Object.entries(rawBreakdown)
    .filter(([, value]) => value > 0)
    .map(([key, value]) => ({ key, value }));

  let totalSwitches = 0;
  for (const b of enrichedBuckets) totalSwitches += b.switches || 0;

  const end = new Date();
  const start = new Date();
  start.setDate(start.getDate() - 6);
  const weekBuckets = await getBucketsInRange(getLocalDateStr(start), getLocalDateStr(end));
  const byDate = {};
  for (const b of weekBuckets) {
    if (!byDate[b.date]) byDate[b.date] = [];
    byDate[b.date].push(b);
  }
  const trend = Object.entries(byDate)
    .map(([date, dayBuckets]) => ({
      date,
      strain: computeDopamineStrain(dayBuckets),
      focus: computeFocusMinutes(dayBuckets).totalFocus
    }))
    .sort((a, b) => a.date.localeCompare(b.date));

  return {
    date: targetDate,
    isToday: targetDate === today,
    heartRate,
    activities,
    today: {
      strain,
      focusMinutes: totalFocus,
      longestBlock,
      totalSwitches
    },
    strainBreakdown,
    trend,
    sessionStart: targetDate === today ? (sessionStart || null) : null,
    visits,
    buckets: ensureHourOnBuckets(enrichedBuckets),
    hourlyTimeline: buildHourlyTimeline(enrichedBuckets)
  };
}

async function buildExportPayload() {
  await runtime.accrueActiveTime(Date.now(), { forceSave: true });
  const today = getLocalDateStr();
  const buckets = await getBucketsForDate(today);
  const visits = buildVisits(await getEventsForDate(today));
  return { date: today, buckets: enrichBucketsWithVisits(buckets, visits) };
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === 'GET_DASHBOARD') {
    const requestDate = (msg && typeof msg.date === 'string') ? msg.date : null;
    buildDashboardPayload(requestDate).then(sendResponse).catch(() => sendResponse(null));
    return true;
  }

  if (msg.type === 'EXPORT_JSON') {
    buildExportPayload().then(sendResponse).catch(() => sendResponse(null));
    return true;
  }

  if (msg.type === 'CONTENT_EVENT') {
    runtime.onContentEvent(msg, sender)
      .then(() => sendResponse?.())
      .catch(() => sendResponse?.());
    return true;
  }
});

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

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (tabId !== runtime.getState().activeTabId) return;

  const url = changeInfo.url ?? tab?.url;
  if (!runtime.updateActiveUrl(url)) return;

  runtime.saveState();
  addEvent({
    type: 'active_tab_changed',
    domain: runtime.getState().activeTabDomain,
    category: classifyUrl(url),
    url,
    tabId,
    ts: Date.now(),
    date: getLocalDateStr()
  });
});

chrome.idle.onStateChanged.addListener(onIdleChange);
chrome.windows.onFocusChanged.addListener(onWindowFocusChanged);

runtime.loadState().then(async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab) return;

  const now = Date.now();
  runtime.setActiveTab(tab.id, tab.url || '');
  runtime.setTabActivatedAt(now);
  await runtime.saveState();
  await runtime.getOrCreateBucket();
  await ensureSessionStart(now);
});

setInterval(() => {
  runtime.accrueActiveTime(Date.now()).catch(() => {});
}, runtime.activeTimeTickMs);

setInterval(() => {
  runtime.flushBucket().catch(() => {});
}, runtime.flushTickMs);
