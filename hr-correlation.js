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
};

loadMetricsOverrides();

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
 * @returns {{ hrMeanStimulated, hrMeanBaseline, hrElevatedSegments, correlation, sampleCounts }}
 */
export function computeHrCorrelation(heartRateValues, dateStr, stimulatedIntervals, startHour, endHour) {
  if (!heartRateValues?.length) {
    return { hrMeanStimulated: null, hrMeanBaseline: null, hrElevatedSegments: [], correlation: null, sampleCounts: { stim: 0, baseline: 0 } };
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

  // HR elevated segments: where HR exceeds baseline during stimulation
  const baseline = hrMeanBaseline ?? 60;
  const threshold = cfg.useAbsoluteElevation
    ? baseline + cfg.elevatedHrThresholdBpm
    : baseline * (1 + cfg.elevatedHrThresholdPct);

  const hrElevatedSegments = [];
  let segStart = null;
  for (let i = 0; i < hrWithTime.length; i++) {
    const { hourFrac, hr, isStimulated } = hrWithTime[i];
    const elevated = isStimulated && hr >= threshold;
    if (elevated) {
      if (segStart == null) segStart = hourFrac;
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
    hrElevatedSegments,
    correlation,
    sampleCounts: { stim: hrStim.length, baseline: hrBaseline.length },
    stimulatedIntervals,
  };
}

/**
 * Run full correlation pipeline.
 */
export function runHrCorrelation({ rawStrainByMinute, buckets, heartRateValues, dateStr, startHour, endHour }) {
  const stimulatedIntervals = buildStimulatedIntervals(rawStrainByMinute, buckets, startHour, endHour);
  const result = computeHrCorrelation(heartRateValues, dateStr, stimulatedIntervals, startHour, endHour);
  return result;
}
