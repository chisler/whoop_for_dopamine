/**
 * HR–Stimulation correlation algorithms
 * Experimentable metrics: thresholds, window sizes, lag
 */

const STORAGE_KEY = 'whoop-hr-correlation-config';

const DEFAULTS = {
  stimulationStrainThreshold: 0.5,
  shortFormCountsAsStimulated: true,
  stimulationMinSeconds: 15,
  hrLagMinutes: 1,
  hrDecayMinutes: 2,
  baselineMinMinutes: 5,
  elevatedHrThresholdBpm: 3,
  elevatedHrThresholdPct: 0.05,
  useAbsoluteElevation: true,
  hrGrowthWindowMinutes: 2,
  hrGrowthMinBpm: 3,
  hrGrowthStartHour: 6,
  hrGrowthEndHour: 23,
};

// ── Configurable metrics (tune for experimentation) ────────────────────────
export const METRICS_CONFIG = { ...DEFAULTS };

export function loadMetricsOverrides() {
  try {
    const s = localStorage.getItem(STORAGE_KEY);
    if (s) {
      const overrides = JSON.parse(s);
      Object.assign(METRICS_CONFIG, overrides);
    }
  } catch (_) {}
}

export function saveMetricsOverrides(overrides) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(overrides));
    Object.assign(METRICS_CONFIG, overrides);
  } catch (_) {}
}

export function resetMetricsToDefaults() {
  Object.assign(METRICS_CONFIG, DEFAULTS);
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (_) {}
}

export function getMetricsConfig() {
  return { ...METRICS_CONFIG };
}

export const METRIC_LABELS = {
  stimulationStrainThreshold: 'Strain threshold (raw)',
  shortFormCountsAsStimulated: 'Short-form = stimulated',
  stimulationMinSeconds: 'Min seconds (music/YT)',
  hrLagMinutes: 'HR lag (min)',
  hrDecayMinutes: 'Decay window (min)',
  elevatedHrThresholdBpm: 'Elevated HR (+bpm)',
  elevatedHrThresholdPct: 'Elevated HR (+%)',
  useAbsoluteElevation: 'Use BPM (not %)',
  hrGrowthWindowMinutes: 'HR growth window (min)',
  hrGrowthMinBpm: 'HR growth min (+bpm)',
  hrGrowthStartHour: 'HR growth from hour (0–23)',
  hrGrowthEndHour: 'HR growth until hour (0–23)',
};

loadMetricsOverrides();

/** Night hours (local) for resting baseline — typically asleep. */
const NIGHT_START_HOUR = 1;
const NIGHT_END_HOUR = 6;

/**
 * Compute resting HR baseline from night hours when Garmin restingHeartRate is unavailable.
 * Uses 10th percentile of HR during night (1–6am) as proxy for true resting.
 * @param {Array} heartRateValues - [[ts_ms, hr], ...]
 * @param {string} dateStr - YYYY-MM-DD
 * @returns {number|null} baseline bpm or null if insufficient data
 */
export function computeRestingBaselineFromNight(heartRateValues, dateStr) {
  if (!heartRateValues?.length) return null;
  const dayStart = new Date(dateStr + 'T00:00:00').getTime();
  const MS_PER_HOUR = 3600 * 1000;
  const nightStart = dayStart + NIGHT_START_HOUR * MS_PER_HOUR;
  const nightEnd = dayStart + NIGHT_END_HOUR * MS_PER_HOUR;
  const hrs = heartRateValues
    .filter(([ts]) => ts >= nightStart && ts < nightEnd)
    .map(([, hr]) => hr)
    .filter(hr => hr > 0 && hr < 200);
  if (hrs.length < 5) return null;
  hrs.sort((a, b) => a - b);
  const p10 = Math.floor(hrs.length * 0.1);
  return hrs[p10] ?? hrs[0];
}

/**
 * Build set of minute indices when user is in a Garmin activity (run, ride, etc.).
 * Used to exclude exercise periods from "elevated HR" — we only want stationary browsing.
 * @param {Array} activities - Garmin activities with startTimeLocal, duration
 * @param {string} dateStr - YYYY-MM-DD
 * @returns {Set<number>} minute indices (0–1439) in activity
 */
export function buildActivityMinuteSet(activities, dateStr) {
  const set = new Set();
  if (!activities?.length) return set;
  const dayStart = new Date(dateStr + 'T00:00:00').getTime();
  for (const a of activities) {
    const startStr = a.startTimeLocal || a.startTimeGMT || '';
    const m = startStr.match(/T(\d{2}):(\d{2})/);
    const durSec = a.duration || a.elapsedDuration || 0;
    if (!m || durSec <= 0) continue;
    const startTs = new Date(startStr).getTime();
    if (startStr.slice(0, 10) !== dateStr) continue;
    const startMinuteIdx = Math.floor((startTs - dayStart) / 60000);
    const endMinuteIdx = Math.floor((startTs - dayStart + durSec * 1000) / 60000);
    for (let i = startMinuteIdx; i <= endMinuteIdx; i++) {
      if (i >= 0 && i < 1440) set.add(i);
    }
  }
  return set;
}

/**
 * Build stimulated intervals from raw strain and buckets.
 * @param {Object} rawStrainByMinute - { minuteIdx: rawStrain }
 * @param {Array} buckets - activity buckets
 * @param {number} startHour - start of time window
 * @param {number} endHour - end of time window
 * @returns {Array<{startHourFrac, endHourFrac, intensity}>}
 */
export function buildStimulatedIntervals(rawStrainByMinute, buckets, startHour, endHour) {
  const cfg = METRICS_CONFIG;
  const startMinuteIdx = Math.floor(startHour * 60);
  const endMinuteIdx = Math.floor(endHour * 60);

  // Build minuteIdx -> bucket(s) map
  const bucketsByMinute = {};
  for (const b of buckets) {
    const [hh, mm] = (b.minute || '00:00').split(':').map(Number);
    const idx = hh * 60 + mm;
    if (!bucketsByMinute[idx]) bucketsByMinute[idx] = [];
    bucketsByMinute[idx].push(b);
  }

  // Per-minute stimulation flag + intensity
  const stimByMinute = {};
  for (let m = startMinuteIdx; m <= endMinuteIdx; m++) {
    const raw = rawStrainByMinute[m] || 0;
    let isStim = raw >= cfg.stimulationStrainThreshold;

    if (!isStim && bucketsByMinute[m]?.length) {
      for (const b of bucketsByMinute[m]) {
        const shortForm = (b.shorts_count || 0) + (b.reels_count || 0) + (b.tiktoks_count || 0);
        if (cfg.shortFormCountsAsStimulated && shortForm > 0) { isStim = true; break; }
        const stimSec = (b.stimulation_seconds || 0) + (b.youtube_watch_seconds || 0);
        if (stimSec >= cfg.stimulationMinSeconds) { isStim = true; break; }
      }
    }
    if (isStim) stimByMinute[m] = raw || 0.5;
  }

  // Merge consecutive minutes into intervals (with lag + decay)
  const intervals = [];
  let inInterval = false;
  let intervalStart = null;
  let maxIntensity = 0;
  let lastStimMinute = -999;

  for (let m = startMinuteIdx; m <= endMinuteIdx + cfg.hrDecayMinutes + 1; m++) {
    const laggedM = m - cfg.hrLagMinutes;
    const wasStim = laggedM >= startMinuteIdx && stimByMinute[laggedM] > 0;
    const hourFrac = Math.min(endHour, m / 60);

    if (wasStim) {
      lastStimMinute = laggedM;
      maxIntensity = Math.max(maxIntensity, stimByMinute[laggedM] || 0.5);
      if (!inInterval) {
        inInterval = true;
        intervalStart = laggedM / 60;
      }
    } else if (inInterval) {
      if (m - lastStimMinute > cfg.hrDecayMinutes) {
        inInterval = false;
        intervals.push({
          startHourFrac: intervalStart,
          endHourFrac: hourFrac,
          intensity: maxIntensity,
        });
        maxIntensity = 0;
      }
    }
  }
  if (inInterval) {
    intervals.push({
      startHourFrac: intervalStart,
      endHourFrac: endHour,
      intensity: maxIntensity,
    });
  }

  return intervals;
}

/**
 * Compute HR statistics during stimulated vs baseline periods.
 * @param {Array} heartRateValues - [[ts_ms, hr], ...]
 * @param {string} dateStr - YYYY-MM-DD
 * @param {Array} stimulatedIntervals - from buildStimulatedIntervals
 * @param {number} startHour
 * @param {number} endHour
 * @param {{ restingBaseline?: number, activityMinutes?: Set<number> }} opts - restingBaseline from night/Garmin; activityMinutes to exclude (exercise)
 * @returns {{ hrMeanStimulated, hrMeanBaseline, hrRestingBaseline, hrElevatedSegments, correlation, sampleCounts }}
 */
export function computeHrCorrelation(heartRateValues, dateStr, stimulatedIntervals, startHour, endHour, opts = {}) {
  if (!heartRateValues?.length) {
    return { hrMeanStimulated: null, hrMeanBaseline: null, hrRestingBaseline: null, hrElevatedSegments: [], correlation: null, sampleCounts: { stim: 0, baseline: 0 } };
  }

  const dayStart = new Date(dateStr + 'T00:00:00').getTime();
  const dayEnd = new Date(dateStr + 'T23:59:59.999').getTime();
  const MS_PER_HOUR = 3600 * 1000;

  const cfg = METRICS_CONFIG;
  const stimSet = new Set();
  for (const iv of stimulatedIntervals) {
    for (let f = iv.startHourFrac; f < iv.endHourFrac; f += 1 / 60) {
      stimSet.add(Math.floor(f * 60));
    }
  }

  const hrStim = [];
  const hrBaseline = [];
  const hrWithTime = []; // { hourFrac, hr, isStimulated }

  for (const [ts, hr] of heartRateValues) {
    if (ts < dayStart || ts > dayEnd) continue;
    const hourFrac = (ts - dayStart) / MS_PER_HOUR; // actual hour of day (0–24)
    if (hourFrac < startHour || hourFrac > endHour) continue;

    const minuteIdx = Math.floor(hourFrac * 60);
    const isStim = stimSet.has(minuteIdx);
    hrWithTime.push({ hourFrac, hr, isStimulated: isStim });
    if (isStim) hrStim.push(hr);
    else hrBaseline.push(hr);
  }

  const mean = arr => arr.length ? arr.reduce((s, v) => s + v, 0) / arr.length : null;
  const hrMeanStimulated = mean(hrStim);
  const hrMeanBaseline = mean(hrBaseline);

  // Resting baseline: prefer provided value, else night HR, else non-stim mean
  const { restingBaseline: providedResting, activityMinutes = new Set() } = opts;
  const nightBaseline = computeRestingBaselineFromNight(heartRateValues, dateStr);
  const hrRestingBaseline = providedResting ?? nightBaseline ?? hrMeanBaseline ?? 60;

  // Pearson correlation: (stimulation_level, hr) for each sample
  let correlation = null;
  if (hrWithTime.length >= 10) {
    const stimLevel = hrWithTime.map(x => x.isStimulated ? 1 : 0);
    const hrVals = hrWithTime.map(x => x.hr);
    const n = hrVals.length;
    const mX = stimLevel.reduce((a, b) => a + b, 0) / n;
    const mY = hrVals.reduce((a, b) => a + b, 0) / n;
    let num = 0, denX = 0, denY = 0;
    for (let i = 0; i < n; i++) {
      const dx = stimLevel[i] - mX;
      const dy = hrVals[i] - mY;
      num += dx * dy;
      denX += dx * dx;
      denY += dy * dy;
    }
    const den = Math.sqrt(denX * denY);
    correlation = den > 1e-10 ? num / den : 0;
  }

  // HR growth segments: where HR is rising during device usage (browsing), NOT during exercise
  // Only within configured time window (e.g. 6am–11pm to exclude night)
  const growthWindow = Math.max(1, Math.ceil((cfg.hrGrowthWindowMinutes ?? 2) / 2));
  const growthMinBpm = cfg.hrGrowthMinBpm ?? 3;
  const growthStartHour = cfg.hrGrowthStartHour ?? 6;
  const growthEndHour = cfg.hrGrowthEndHour ?? 23;

  const inGrowthTimeWindow = (hourFrac) => {
    const h = Math.floor(hourFrac);
    return h >= growthStartHour && h <= growthEndHour;
  };

  const hrElevatedSegments = [];
  let segStart = null;
  for (let i = 0; i < hrWithTime.length; i++) {
    const { hourFrac, hr, isStimulated } = hrWithTime[i];
    const minuteIdx = Math.floor(hourFrac * 60);
    const inActivity = activityMinutes.has(minuteIdx);
    const inTimeWindow = inGrowthTimeWindow(hourFrac);
    let isGrowing = false;
    if (isStimulated && !inActivity && inTimeWindow && i >= growthWindow) {
      const prev = hrWithTime[i - growthWindow];
      const delta = hr - prev.hr;
      if (delta >= growthMinBpm) isGrowing = true;
    }
    if (isGrowing) {
      if (segStart == null) segStart = hrWithTime[i - growthWindow]?.hourFrac ?? hourFrac;
    } else {
      if (segStart != null) {
        hrElevatedSegments.push({ startHourFrac: segStart, endHourFrac: hourFrac });
        segStart = null;
      }
    }
  }
  if (segStart != null) {
    const last = hrWithTime[hrWithTime.length - 1];
    hrElevatedSegments.push({ startHourFrac: segStart, endHourFrac: last?.hourFrac ?? endHour });
  }

  return {
    hrMeanStimulated,
    hrMeanBaseline,
    hrRestingBaseline,
    hrElevatedSegments,
    correlation,
    sampleCounts: { stim: hrStim.length, baseline: hrBaseline.length },
    stimulatedIntervals,
  };
}

/**
 * Build stimulated intervals by type: shortForm, music, ytWatch, feed.
 */
function buildStimulatedIntervalsByType(buckets, startHour, endHour) {
  const startMinuteIdx = Math.floor(startHour * 60);
  const endMinuteIdx = Math.floor(endHour * 60);
  const bucketsByMinute = {};
  for (const b of buckets) {
    const [hh, mm] = (b.minute || '00:00').split(':').map(Number);
    const idx = hh * 60 + mm;
    if (!bucketsByMinute[idx]) bucketsByMinute[idx] = [];
    bucketsByMinute[idx].push(b);
  }

  const REDDIT_FEED = new Set(['REDDIT_FEED', 'REDDIT_THREAD']);
  const X_FEED = new Set(['X_HOME', 'X_SEARCH', 'X_OTHER', 'X_THREAD']);
  const FEED_SET = new Set([...REDDIT_FEED, ...X_FEED, 'YOUTUBE_HOME']);
  const MUSIC_CAT = new Set(['SPOTIFY', 'MUSIC']);

  const byType = { shortForm: new Set(), music: new Set(), ytWatch: new Set(), feed: new Set() };

  for (let m = startMinuteIdx; m <= endMinuteIdx; m++) {
    for (const b of bucketsByMinute[m] || []) {
      const shortForm = (b.shorts_count || 0) + (b.reels_count || 0) + (b.tiktoks_count || 0);
      const musicSec = MUSIC_CAT.has(b.category || '') ? (b.stimulation_seconds || 0) : 0;
      const ytSec = b.youtube_watch_seconds || 0;
      const feedMins = FEED_SET.has(b.category || '') ? (b.focused_seconds || 0) / 60 : 0;

      if (shortForm > 0) byType.shortForm.add(m);
      if (musicSec >= 15) byType.music.add(m);
      if (ytSec >= 15) byType.ytWatch.add(m);
      if (feedMins >= 0.25) byType.feed.add(m);
    }
  }

  return byType;
}

/**
 * Compute HR mean for a set of minute indices.
 */
function hrMeanForMinuteSet(heartRateValues, dateStr, minuteSet, startHour, endHour) {
  if (!heartRateValues?.length || minuteSet.size === 0) return null;
  const dayStart = new Date(dateStr + 'T00:00:00').getTime();
  const MS_PER_HOUR = 3600 * 1000;
  const hrs = [];
  for (const [ts, hr] of heartRateValues) {
    const hourFrac = (ts - dayStart) / MS_PER_HOUR;
    if (hourFrac < startHour || hourFrac > endHour) continue;
    const m = Math.floor(hourFrac * 60);
    if (minuteSet.has(m)) hrs.push(hr);
  }
  return hrs.length ? hrs.reduce((s, v) => s + v, 0) / hrs.length : null;
}

/**
 * Per-stimulation-type HR breakdown.
 */
export function computeHrCorrelationByType({ buckets, heartRateValues, dateStr, startHour, endHour }) {
  const byType = buildStimulatedIntervalsByType(buckets, startHour, endHour);
  const allStim = new Set([...byType.shortForm, ...byType.music, ...byType.ytWatch, ...byType.feed]);
  const baselineSet = new Set();
  const startMinuteIdx = Math.floor(startHour * 60);
  const endMinuteIdx = Math.floor(endHour * 60);
  for (let m = startMinuteIdx; m <= endMinuteIdx; m++) {
    if (!allStim.has(m)) baselineSet.add(m);
  }

  const hrBaseline = hrMeanForMinuteSet(heartRateValues, dateStr, baselineSet, startHour, endHour);
  const result = {};
  for (const [key, minuteSet] of Object.entries(byType)) {
    const hrMean = hrMeanForMinuteSet(heartRateValues, dateStr, minuteSet, startHour, endHour);
    result[key] = {
      hrMean,
      hrBaseline,
      delta: (hrMean != null && hrBaseline != null) ? hrMean - hrBaseline : null,
      sampleCount: minuteSet.size,
    };
  }
  return result;
}

/**
 * Run full correlation pipeline.
 * @param {Object} opts
 * @param {Object} opts.heartRate - full heart rate object (heartRateValues, restingHeartRate, minHeartRate)
 * @param {Array} opts.activities - Garmin activities for the day (to exclude exercise periods)
 */
export function runHrCorrelation({ rawStrainByMinute, buckets, heartRateValues, heartRate, activities, dateStr, startHour, endHour }) {
  const hrValues = heartRateValues ?? heartRate?.heartRateValues ?? [];
  const stimulatedIntervals = buildStimulatedIntervals(rawStrainByMinute, buckets, startHour, endHour);
  const restingBaseline = heartRate?.restingHeartRate ?? heartRate?.minHeartRate ?? null;
  const activityMinutes = buildActivityMinuteSet(activities ?? [], dateStr);
  const result = computeHrCorrelation(hrValues, dateStr, stimulatedIntervals, startHour, endHour, {
    restingBaseline: restingBaseline ?? undefined,
    activityMinutes,
  });
  if (hrValues?.length && buckets?.length) {
    try {
      result.byType = computeHrCorrelationByType({ buckets, heartRateValues: hrValues, dateStr, startHour, endHour });
    } catch (_) {}
  }
  return result;
}
