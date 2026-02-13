/**
 * Dashboard — Stimulation Strain, culprits, single timeline
 */

const RING_CIRCUMFERENCE = 2 * Math.PI * 44;
const DASHBOARD_REFRESH_MS = 5000;
let dashboardLoadInFlight = false;

const ICONS = {
  // Brand icons with proper colors — used in swim lanes and culprit list
  youtube: '<svg viewBox="0 0 16 16" fill="none" width="16" height="16"><rect x="1" y="3.5" width="14" height="9" rx="2.5" fill="#FF0000"/><polygon points="6.5,5.5 6.5,10.5 11,8" fill="white"/></svg>',
  youtubeShorts: '<svg viewBox="0 0 16 16" fill="none" width="16" height="16"><rect x="4.5" y="1" width="7" height="14" rx="2" fill="#FF0000"/><polygon points="6.5,5 6.5,11 11,8" fill="white"/></svg>',
  instagram: '<svg viewBox="0 0 16 16" fill="none" width="16" height="16"><rect x="1" y="1" width="14" height="14" rx="3.5" fill="#C13584"/><circle cx="8" cy="8" r="3.2" stroke="white" stroke-width="1.5"/><circle cx="11.8" cy="4.2" r="1.2" fill="white"/></svg>',
  tiktok: '<svg viewBox="0 0 16 16" fill="none" width="16" height="16"><rect width="16" height="16" rx="3" fill="#010101"/><path d="M10.2 2.5c.1 1.9 1.5 3.4 3.3 3.4v2.1c-1 0-1.9-.3-2.7-.9v4.4c0 2.2-1.8 4-4 4s-4-1.8-4-4 1.8-4 4-4c.2 0 .4 0 .6.04v2.2c-.2-.05-.4-.06-.6-.06-1 0-1.8.8-1.8 1.8s.8 1.8 1.8 1.8 1.8-.8 1.8-1.8V2.5h1.6z" fill="white"/></svg>',
  spotify: '<svg viewBox="0 0 16 16" fill="none" width="16" height="16"><circle cx="8" cy="8" r="7.5" fill="#1DB954"/><path d="M4.5 6.2c2.3-.9 5.2-.8 7.2.6" stroke="white" stroke-width="1.4" stroke-linecap="round"/><path d="M5 8.5c1.9-.6 4.5-.6 6.5.4" stroke="white" stroke-width="1.4" stroke-linecap="round"/><path d="M5.5 10.8c1.5-.5 3.5-.4 5 .3" stroke="white" stroke-width="1.4" stroke-linecap="round"/></svg>',
  reddit: '<svg viewBox="0 0 16 16" fill="none" width="16" height="16"><circle cx="8" cy="8" r="7.5" fill="#FF4500"/><circle cx="8" cy="8.6" r="3.2" fill="white"/><ellipse cx="5.8" cy="9.4" rx="1.1" ry="0.7" fill="#FF4500"/><ellipse cx="10.2" cy="9.4" rx="1.1" ry="0.7" fill="#FF4500"/><circle cx="6.6" cy="8.2" r="0.7" fill="#FF4500"/><circle cx="9.4" cy="8.2" r="0.7" fill="#FF4500"/><path d="M6.4 10.3 Q8 11.2 9.6 10.3" stroke="#FF4500" stroke-width="0.6" stroke-linecap="round" fill="none"/><circle cx="11.6" cy="4.4" r="1.1" fill="white"/><path d="M9.2 5.3 Q10.4 4 11.6 4.4" stroke="white" stroke-width="0.9" stroke-linecap="round" fill="none"/><ellipse cx="8" cy="3.8" rx="1.4" ry="1" fill="white"/></svg>',
  xtwitter: '<svg viewBox="0 0 16 16" fill="none" width="16" height="16"><rect width="16" height="16" rx="3" fill="#000000"/><path d="M3 3h2.5l2.3 3.2L10.5 3H13l-3.8 4.8L13.2 13h-2.5l-2.5-3.5-2.8 3.5H3l4.1-5.1L3 3z" fill="white"/></svg>',
  feed: '<svg viewBox="0 0 16 16" fill="none" width="16" height="16"><rect x="2" y="2.5" width="12" height="2.5" rx="1.2" fill="#888"/><rect x="2" y="6.8" width="12" height="2.5" rx="1.2" fill="#888"/><rect x="2" y="11" width="8" height="2.5" rx="1.2" fill="#888"/></svg>',
  // Utility icons — used in strain breakdown list only
  switch: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><path d="M7 16l-4-4 4-4"/><path d="M17 8l4 4-4 4"/><path d="M14 4l-4 16"/></svg>',
  scroll: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><path d="M12 5v14"/><path d="M5 12l7 7 7-7"/></svg>',
  late: '<svg viewBox="0 0 24 24" fill="currentColor" width="16" height="16"><path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10 10-4.5 10-10S17.5 2 12 2zm0 18c-4.4 0-8-3.6-8-8s3.6-8 8-8 8 3.6 8 8-3.6 8-8 8zm.5-13H11v6l5.2 3.2.8-1.3-4.5-2.7V7z"/></svg>',
  short: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>'
};

const STRAIN_LABELS = {
  youtubeShorts: 'YouTube Shorts watched',
  instagramReels: 'IG Reels watched',
  tiktoks: 'TikToks watched',
  musicMinutes: 'Music (Spotify etc)',
  youtubeWatchMinutes: 'YouTube videos playing',
  feedMinutes: 'Feed scrolling',
  shortSessions: 'Short sessions (<90s)',
  highSwitchMinutes: 'High tab switching',
  highScrollMinutes: 'High scroll density',
  lateNightMinutes: 'Late-night usage'
};

const CULPRIT_ICONS = {
  youtubeShorts: 'youtubeShorts',
  instagramReels: 'instagram',
  tiktoks: 'tiktok',
  musicMinutes: 'spotify',
  youtubeWatchMinutes: 'youtube',
  feedMinutes: 'feed',
  shortSessions: 'short',
  highSwitchMinutes: 'switch',
  highScrollMinutes: 'scroll',
  lateNightMinutes: 'late'
};

function getLocalDateStr(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function setRingProgress(el, value, max) {
  if (!el || typeof value !== 'number' || isNaN(value)) return;
  const pct = Math.min(1, Math.max(0, value / max));
  el.style.strokeDashoffset = RING_CIRCUMFERENCE * (1 - pct);
}

// Attention color: green (100) → teal (50) → blue (0) — available attention stays green
function getAttentionColor(pct) {
  const t = Math.min(1, Math.max(0, pct / 100));
  const hue = 120 + (1 - t) * 120;
  return `hsl(${hue}, 55%, 48%)`;
}

async function loadDashboard() {
  if (dashboardLoadInFlight) return;
  dashboardLoadInFlight = true;
  try {
    const res = await chrome.runtime.sendMessage({ type: 'GET_DASHBOARD' });
    if (!res) return;

    const { strain, focusMinutes, longestBlock, totalSwitches } = res.today;

    // Attention span = inverse of strain (100 - strain). How much attention you have left.
    const attentionSpan = Math.round(100 - strain);

    document.getElementById('strain').textContent = strain;
    document.getElementById('focus').textContent = attentionSpan;
    document.getElementById('block').textContent = longestBlock;

    setRingProgress(document.getElementById('strain-ring'), strain, 100);
    const focusRing = document.getElementById('focus-ring');
    setRingProgress(focusRing, attentionSpan, 100);
    focusRing.style.stroke = '#34c759';
    setRingProgress(document.getElementById('block-ring'), longestBlock, 60);

    // Context switches
    const ctxEl = document.getElementById('contextSwitches');
    const ctxSection = document.getElementById('contextSwitchSection');
    if (totalSwitches > 0) {
      ctxSection.style.display = 'block';
      ctxEl.textContent = totalSwitches;
    } else {
      ctxSection.style.display = 'none';
    }

    // Strain breakdown with SVG icons
    const breakdownEl = document.getElementById('strainBreakdown');
    const breakdownSection = document.getElementById('strainBreakdownSection');
    breakdownEl.innerHTML = '';
    if (res.strainBreakdown && res.strainBreakdown.length > 0) {
      breakdownSection.style.display = 'block';
      for (const { key, value } of res.strainBreakdown) {
        const li = document.createElement('li');
        const label = STRAIN_LABELS[key] || key;
        const iconName = CULPRIT_ICONS[key] || 'feed';
        const iconSvg = ICONS[iconName] || '';
        const display = typeof value === 'number' && value % 1 !== 0
          ? value.toFixed(1) : value;
        const unit = ['musicMinutes', 'youtubeWatchMinutes', 'feedMinutes'].includes(key)
          ? 'm' : ['shortSessions', 'highSwitchMinutes', 'highScrollMinutes', 'lateNightMinutes'].includes(key)
            ? ' min' : '';
        li.innerHTML = `
          <span class="breakdown-item">
            <span class="culprit-icon">${iconSvg}</span>
            <span class="breakdown-label">${label}</span>
          </span>
          <span class="breakdown-value">${display}${unit}</span>`;
        breakdownEl.appendChild(li);
      }
    } else {
      breakdownSection.style.display = 'none';
    }

    // Session start hint
    const sessionHint = document.getElementById('sessionHint');
    if (sessionHint) {
      if (res.sessionStart) {
        const d = new Date(res.sessionStart);
        sessionHint.textContent = `Chrome opened at ${d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}. ${res.visits?.length || 0} tab visits recorded.`;
      } else if (!res.buckets?.length && !res.visits?.length) {
        sessionHint.textContent = 'No activity recorded yet. Switch tabs or browse to start tracking.';
      } else {
        sessionHint.textContent = `${res.visits?.length || 0} tab visits recorded.`;
      }
    }

    const buckets = res.buckets || [];
    const inferShortsCount = (b) => {
      const explicit = b.shorts_count || 0;
      if (explicit > 0) return explicit;
      const isShortsCategory = b.category === 'YOUTUBE_SHORTS';
      const isShortsUrl = typeof b.url === 'string' && /youtube\.com\/shorts\//i.test(b.url);
      const activeSeconds = (b.youtube_watch_seconds || 0) + (b.focused_seconds || 0);
      return (isShortsCategory && isShortsUrl && activeSeconds >= 10) ? 1 : 0;
    };

    // Timeline: Attention body-battery + stimulation swim lanes
    const graphEl = document.getElementById('attentionGraph');
    if (graphEl) {
      let data = res.hourlyTimeline || [];

      // Fallback: build hourly strain from buckets if timeline is empty
      if (!data.length && buckets.length) {
        const byHour = {};
        for (let h = 0; h < 24; h++) byHour[h] = { hour: h, strain: 0 };
        for (const b of buckets) {
          const h = b.hour ?? (parseInt(String(b.minute || '0').split(':')[0], 10) || 0);
          const shorts = (b.shorts_count || 0) + (b.reels_count || 0) + (b.tiktoks_count || 0);
          const stimMins = ((b.stimulation_seconds || 0) + (b.youtube_watch_seconds || 0)) / 60;
          const feedMins = ['X_HOME', 'REDDIT_FEED', 'YOUTUBE_HOME'].includes(b.category || '') ? (b.focused_seconds || 0) / 60 : 0;
          byHour[h].strain += shorts * 3 + stimMins * 2 + feedMins * 1.5 + (b.switches || 0) * 0.8;
        }
        data = Object.values(byHour);
      }

      // ── Time window: first activity → now ───────────────────────────────
      const nowDate   = new Date();
      const nowHourFrac = nowDate.getHours() + nowDate.getMinutes() / 60;
      const sessionHour = res.sessionStart
        ? new Date(res.sessionStart).getHours() + new Date(res.sessionStart).getMinutes() / 60
        : null;
      const firstActiveBucket = buckets
        .filter(b => (b.focused_seconds || 0) > 10 || (b.switches || 0) > 0 || (b.shorts_count || 0) > 0)
        .sort((a, b2) => (a.hour ?? 0) - (b2.hour ?? 0))[0];
      const firstBucketHour = firstActiveBucket ? (firstActiveBucket.hour ?? null) : null;
      // Use earlier of session or first activity — avoids steep drop when session starts
      // after morning strain (e.g. Chrome opened 12:28 but user had 11am YT Shorts)
      const startHour = Math.floor(
        (sessionHour != null || firstBucketHour != null)
          ? Math.min(sessionHour ?? 24, firstBucketHour ?? 24)
          : Math.max(0, nowHourFrac - 1)
      );
      // End is current fractional hour (never draw the future)
      const endHour = Math.max(startHour + 1, nowHourFrac);

      // ── Layout ──────────────────────────────────────────────────────────
      const w = 640;
      const attnH = 170;                   // attention plot height (taller)
      const pad = { left: 56, right: 16, top: 16 };
      const plotW = w - pad.left - pad.right;
      const xAxisY  = pad.top + attnH;
      const xLabelY = xAxisY + 14;

      // Map an hour value into SVG x-coordinate within [startHour, endHour]
      const hourRange = endHour - startHour;
      const xHour = h => pad.left + ((h - startHour) / hourRange) * plotW;

      // Swim-lane config: discrete = one dot per event; bar = heat-map per hour
      const LANES = [
        { key: 'shorts',    color: '#ff3b30', icon: 'youtubeShorts', label: 'YT Shorts', type: 'dot' },
        { key: 'reels',     color: '#e1306c', icon: 'instagram',     label: 'IG Reels',  type: 'dot' },
        { key: 'tiktoks',   color: '#69c9d0', icon: 'tiktok',        label: 'TikTok',    type: 'dot' },
        { key: 'ytMins',    color: '#ff9500', icon: 'youtube',       label: 'YT Watch',  type: 'bar' },
        { key: 'musicMins', color: '#1db954', icon: 'spotify',       label: 'Music',     type: 'bar' },
        { key: 'redditMins',color: '#FF4500', icon: 'reddit',        label: 'Reddit',    type: 'bar' },
        { key: 'xMins',     color: '#e7e9ea', icon: 'xtwitter',      label: 'X',         type: 'bar' },
      ];
      const LANE_H = 28;
      const LANE_GAP = 3;
      const ICON_W = 16;
      const lanesY = xLabelY + 22;             // 182 — top of first lane
      const chartH = lanesY + LANES.length * (LANE_H + LANE_GAP) + 8;

      graphEl.setAttribute('viewBox', `0 0 ${w} ${chartH}`);

      const y = v => pad.top + attnH - (v / 100) * attnH;

      // ── Granular attention curve (per-minute depletion + recovery) ───────
      // Body-battery style: depletes with stimulation, recovers when idle.
      // Uses per-minute buckets for smooth up/down transitions.
      const dailyStrain   = res.today?.strain ?? 0;
      const attentionNow  = 100 - dailyStrain;
      const lastIntHour   = Math.floor(nowHourFrac);

      // Build per-minute raw strain from buckets (keyed by minute index for easy lookup)
      const FEED_SET = new Set(['X_HOME', 'X_SEARCH', 'X_OTHER', 'X_THREAD', 'REDDIT_FEED', 'YOUTUBE_HOME']);
      const rawStrainByMinute = {};
      for (const b of buckets) {
        const minuteKey = b.minute || '00:00';
        const [hh, mm] = minuteKey.split(':').map(Number);
        const minuteIdx = hh * 60 + mm;  // e.g. 9:30 -> 570
        const hourFrac = hh + mm / 60;
        if (hourFrac < startHour || hourFrac > endHour) continue;
        const shortForm = (b.shorts_count || 0) + (b.reels_count || 0) + (b.tiktoks_count || 0);
        const stimMins = ((b.stimulation_seconds || 0) + (b.youtube_watch_seconds || 0)) / 60;
        const feedMins = FEED_SET.has(b.category || '') ? (b.focused_seconds || 0) / 60 : 0;
        const strainRaw = shortForm * 3 + stimMins * 2 + feedMins * 1.5 + (b.switches || 0) * 0.8;
        rawStrainByMinute[minuteIdx] = (rawStrainByMinute[minuteIdx] || 0) + strainRaw;
      }

      const totalRawStrain = Object.values(rawStrainByMinute).reduce((s, v) => s + v, 0);
      // Weight by sqrt to dampen single-minute spikes from bursty event logging.
      const weightedStrainByMinute = {};
      for (const [minuteIdx, raw] of Object.entries(rawStrainByMinute)) {
        weightedStrainByMinute[minuteIdx] = Math.sqrt(Math.max(0, raw));
      }
      const totalWeightedStrain = Object.values(weightedStrainByMinute).reduce((s, v) => s + v, 0);
      const RECOVERY_PER_IDLE_MINUTE = 0.05;
      const MAX_DROP_PER_MINUTE = 3.0;
      const MAX_RISE_PER_MINUTE = 0.2;

      // Walk minute-by-minute from session start to now for granular curve
      const attPoints = [];
      const stepDetails = [];
      let att = 100;
      const startMinuteIdx = Math.floor(startHour * 60);
      const endMinuteIdx = Math.floor(nowHourFrac * 60);
      const totalMinutes = Math.max(1, endMinuteIdx - startMinuteIdx);
      // Use 2-min steps for smooth curve (max ~240 points for 8h); 1-min for shorter sessions
      const step = totalMinutes <= 120 ? 1 : totalMinutes <= 360 ? 2 : 5;

      for (let m = startMinuteIdx; m <= endMinuteIdx; m += step) {
        const hourFrac = m / 60;
        const prevAtt = att;
        let calc = null;
        if (m > startMinuteIdx) {
          const prevM = m - step;
          let stepRawStrain = 0;
          let stepWeightedStrain = 0;
          const minuteBreakdown = [];
          for (let i = prevM; i < m; i++) {
            const r = rawStrainByMinute[i] || 0;
            const w = weightedStrainByMinute[i] || 0;
            stepRawStrain += r;
            stepWeightedStrain += w;
            minuteBreakdown.push({ minuteIdx: i, hour: (i / 60).toFixed(2), rawStrain: r, weightedStrain: w });
          }
          if (stepWeightedStrain > 0 && totalWeightedStrain > 0) {
            const depletion = (stepWeightedStrain / totalWeightedStrain) * dailyStrain;
            const maxDrop = MAX_DROP_PER_MINUTE * (m - prevM);
            const boundedDepletion = Math.min(depletion, maxDrop);
            att = Math.max(0, att - boundedDepletion);
            calc = {
              formula: `depletion = (${stepWeightedStrain.toFixed(3)} / ${totalWeightedStrain.toFixed(3)}) * ${dailyStrain} = ${depletion.toFixed(4)}; bounded=${boundedDepletion.toFixed(4)}`,
              prevM, m, stepRawStrain, stepWeightedStrain, totalRawStrain, totalWeightedStrain, dailyStrain, depletion, boundedDepletion, prevAtt, att, type: 'deplete',
              minuteBreakdown
            };
          } else {
            const recovery = RECOVERY_PER_IDLE_MINUTE * (m - prevM);
            const maxRise = MAX_RISE_PER_MINUTE * (m - prevM);
            const boundedRecovery = Math.min(recovery, maxRise);
            att = Math.min(100, att + boundedRecovery);
            calc = {
              formula: `recovery = ${RECOVERY_PER_IDLE_MINUTE} * ${m - prevM} = ${recovery.toFixed(4)}; bounded=${boundedRecovery.toFixed(4)}`,
              prevM, m, prevAtt, recovery, boundedRecovery, att, type: 'recover',
              minuteBreakdown
            };
          }
          stepDetails.push(calc);
        } else {
          calc = { m, hourFrac: (m / 60).toFixed(2), att: 100, type: 'initial' };
          stepDetails.push(calc);
        }
        attPoints.push({ x: hourFrac, y: att, stepIndex: stepDetails.length - 1 });
      }
      const lastComputedAtt = attPoints.length > 0 ? attPoints[attPoints.length - 1].y : 100;
      attPoints.push({ x: nowHourFrac, y: lastComputedAtt });
      // Smoothly align final point to the ring value so we avoid a terminal spike.
      const endpointDelta = attentionNow - lastComputedAtt;
      if (attPoints.length > 1 && Math.abs(endpointDelta) > 0.05) {
        const denom = attPoints.length - 1;
        for (let i = 1; i < attPoints.length; i++) {
          const t = i / denom;
          attPoints[i].y = Math.max(0, Math.min(100, attPoints[i].y + endpointDelta * t));
        }
      }
      const jump = Math.abs(endpointDelta);
      console.log('[Attention] Debug:', {
        dailyStrain,
        attentionNow,
        totalRawStrain,
        totalWeightedStrain,
        step,
        startMinuteIdx,
        endMinuteIdx,
        pointCount: attPoints.length,
        lastComputedAtt,
        jump
      });

      // Store for export
      window.__attentionDebugExport = {
        exportedAt: new Date().toISOString(),
        spikeDetected: jump > 5,
        spikeInfo: jump > 5 ? { lastComputedAtt, attentionNow, jump } : null,
        params: {
          dailyStrain,
          attentionNow,
          totalRawStrain,
          totalWeightedStrain,
          startHour,
          endHour,
          nowHourFrac,
          startMinuteIdx,
          endMinuteIdx,
          step,
          totalMinutes,
          RECOVERY_PER_IDLE_MINUTE,
          MAX_DROP_PER_MINUTE,
          MAX_RISE_PER_MINUTE,
          sessionHour: res.sessionStart ? new Date(res.sessionStart).getHours() + new Date(res.sessionStart).getMinutes() / 60 : null,
          firstBucketHour: (() => {
            const b = buckets.filter(b2 => (b2.focused_seconds || 0) > 10 || (b2.switches || 0) > 0 || (b2.shorts_count || 0) > 0).sort((a, z) => (a.hour ?? 0) - (z.hour ?? 0))[0];
            return b ? (b.hour ?? null) : null;
          })()
        },
        rawStrainByMinute: Object.fromEntries(
          Object.entries(rawStrainByMinute).sort((a, b) => Number(a[0]) - Number(b[0]))
        ),
        weightedStrainByMinute: Object.fromEntries(
          Object.entries(weightedStrainByMinute).sort((a, b) => Number(a[0]) - Number(b[0]))
        ),
        attPoints,
        stepDetails,
        // Detect large upward jumps (recovery spikes) and steep drops
        jumps: (() => {
          const out = [];
          for (let i = 1; i < attPoints.length; i++) {
            const dy = attPoints[i].y - attPoints[i - 1].y;
            const dx = attPoints[i].x - attPoints[i - 1].x;
            if (dy > 5) out.push({ kind: 'up', from: attPoints[i - 1], to: attPoints[i], dy, dx, index: i });
            if (dy < -15 && dx < 0.1) out.push({ kind: 'steep_drop', from: attPoints[i - 1], to: attPoints[i], dy, index: i });
          }
          return out;
        })(),
        pathSegments: attPoints.slice(0, 5).map((p, i) => ({
          index: i,
          ...p,
          svgX: `xHour(${p.x.toFixed(2)})`,
          svgY: `y(${p.y.toFixed(2)})`
        })),
        buckets: buckets.map(b => ({
          minute: b.minute,
          hour: b.hour,
          category: b.category,
          url: b.url || null,
          shorts_count: b.shorts_count,
          reels_count: b.reels_count,
          tiktoks_count: b.tiktoks_count,
          stimulation_seconds: b.stimulation_seconds,
          spotify_seconds: b.spotify_seconds || 0,
          audio_playing_seconds: b.audio_playing_seconds || 0,
          youtube_watch_seconds: b.youtube_watch_seconds,
          focused_seconds: b.focused_seconds,
          switches: b.switches
        }))
      };

      // For strain bars (Strain view): scale bars against peak hourly raw strain
      const activeData = data.filter(x => x.hour >= startHour && x.hour <= Math.floor(nowHourFrac));
      const maxStrain = Math.max(0, ...activeData.map(x => x.strain || 0));
      const effectiveMax = Math.max(maxStrain, 0.1);

      // Draw path through granular attention points
      let pathD = `M ${xHour(attPoints[0].x)} ${y(attPoints[0].y)}`;
      for (let i = 1; i < attPoints.length; i++) {
        pathD += ` L ${xHour(attPoints[i].x)} ${y(attPoints[i].y)}`;
      }
      const areaD = pathD + ` L ${xHour(nowHourFrac)} ${y(0)} L ${xHour(startHour)} ${y(0)} Z`;

      // ── Strain bars (Strain mode) ────────────────────────────────────────
      const barColW = plotW / hourRange;
      let strainBarsFull = '';
      for (let h = startHour; h <= lastIntHour; h++) {
        const d = data.find(x => x.hour === h) || { strain: 0 };
        const val = Number(d.strain) || 0;
        if (val > 0) {
          const bh = Math.max(4, (val / effectiveMax) * attnH);
          const bx = xHour(h) + barColW * 0.08;
          const bw = barColW * 0.84;
          strainBarsFull += `<rect x="${bx}" y="${xAxisY - bh}" width="${bw}" height="${bh}" fill="#f97316" opacity="0.85"/>`;
        }
      }

      // ── Per-hour stimulation aggregation ────────────────────────────────
      const hourAgg = {};
      for (let h = 0; h < 24; h++) {
        hourAgg[h] = { shorts: 0, reels: 0, tiktoks: 0, musicMins: 0, ytMins: 0, redditMins: 0, xMins: 0 };
      }
      const minuteAgg = {};
      const REDDIT_SET = new Set(['REDDIT_FEED','REDDIT_THREAD']);
      const X_SET      = new Set(['X_HOME','X_SEARCH','X_OTHER','X_THREAD']);
      for (const b of buckets) {
        const h = b.hour ?? (parseInt(String(b.minute || '0').split(':')[0], 10) || 0);
        const [hh, mm] = String(b.minute || '00:00').split(':').map(v => parseInt(v, 10) || 0);
        const minuteIdx = hh * 60 + mm;
        if (!minuteAgg[minuteIdx]) {
          minuteAgg[minuteIdx] = { musicMins: 0, ytMins: 0, redditMins: 0, xMins: 0 };
        }
        const inferredShorts = inferShortsCount(b);
        hourAgg[h].shorts    += inferredShorts;
        hourAgg[h].reels     += b.reels_count  || 0;
        hourAgg[h].tiktoks   += b.tiktoks_count || 0;
        hourAgg[h].musicMins += (b.stimulation_seconds   || 0) / 60;
        hourAgg[h].ytMins    += (b.youtube_watch_seconds || 0) / 60;
        minuteAgg[minuteIdx].musicMins += (b.stimulation_seconds   || 0) / 60;
        minuteAgg[minuteIdx].ytMins    += (b.youtube_watch_seconds || 0) / 60;
        if (REDDIT_SET.has(b.category || '')) hourAgg[h].redditMins += (b.focused_seconds || 0) / 60;
        if (X_SET.has(b.category || ''))      hourAgg[h].xMins      += (b.focused_seconds || 0) / 60;
        if (REDDIT_SET.has(b.category || '')) minuteAgg[minuteIdx].redditMins += (b.focused_seconds || 0) / 60;
        if (X_SET.has(b.category || ''))      minuteAgg[minuteIdx].xMins      += (b.focused_seconds || 0) / 60;
      }

      // Buckets by hour+lane for click-to-detail
      const bucketsByHourLane = {};
      const bucketsByMinuteLane = {};
      for (const b of buckets) {
        const h = b.hour ?? (parseInt(String(b.minute || '0').split(':')[0], 10) || 0);
        const [hh, mm] = String(b.minute || '00:00').split(':').map(v => parseInt(v, 10) || 0);
        const minuteIdx = hh * 60 + mm;
        if (h < startHour || h > lastIntHour) continue;
        if (!bucketsByHourLane[h]) bucketsByHourLane[h] = {};
        if (!bucketsByMinuteLane[minuteIdx]) bucketsByMinuteLane[minuteIdx] = {};
        if (inferShortsCount(b) > 0) { if (!bucketsByHourLane[h].shorts) bucketsByHourLane[h].shorts = []; bucketsByHourLane[h].shorts.push(b); }
        if ((b.reels_count || 0) > 0) { if (!bucketsByHourLane[h].reels) bucketsByHourLane[h].reels = []; bucketsByHourLane[h].reels.push(b); }
        if ((b.tiktoks_count || 0) > 0) { if (!bucketsByHourLane[h].tiktoks) bucketsByHourLane[h].tiktoks = []; bucketsByHourLane[h].tiktoks.push(b); }
        if ((b.youtube_watch_seconds || 0) > 5) {
          if (!bucketsByHourLane[h].ytMins) bucketsByHourLane[h].ytMins = [];
          bucketsByHourLane[h].ytMins.push(b);
          if (!bucketsByMinuteLane[minuteIdx].ytMins) bucketsByMinuteLane[minuteIdx].ytMins = [];
          bucketsByMinuteLane[minuteIdx].ytMins.push(b);
        }
        if ((b.stimulation_seconds || 0) > 5) {
          if (!bucketsByHourLane[h].musicMins) bucketsByHourLane[h].musicMins = [];
          bucketsByHourLane[h].musicMins.push(b);
          if (!bucketsByMinuteLane[minuteIdx].musicMins) bucketsByMinuteLane[minuteIdx].musicMins = [];
          bucketsByMinuteLane[minuteIdx].musicMins.push(b);
        }
        if (REDDIT_SET.has(b.category || '')) {
          if (!bucketsByHourLane[h].redditMins) bucketsByHourLane[h].redditMins = [];
          bucketsByHourLane[h].redditMins.push(b);
          if (!bucketsByMinuteLane[minuteIdx].redditMins) bucketsByMinuteLane[minuteIdx].redditMins = [];
          bucketsByMinuteLane[minuteIdx].redditMins.push(b);
        }
        if (X_SET.has(b.category || '')) {
          if (!bucketsByHourLane[h].xMins) bucketsByHourLane[h].xMins = [];
          bucketsByHourLane[h].xMins.push(b);
          if (!bucketsByMinuteLane[minuteIdx].xMins) bucketsByMinuteLane[minuteIdx].xMins = [];
          bucketsByMinuteLane[minuteIdx].xMins.push(b);
        }
      }

      // ── Swim lanes ──────────────────────────────────────────────────────
      let lanesSvg = '';
      LANES.forEach((lane, idx) => {
        const ly  = lanesY + idx * (LANE_H + LANE_GAP);
        const lCy = ly + LANE_H / 2;

        // Subtle lane background
        lanesSvg += `<rect x="${pad.left}" y="${ly}" width="${plotW}" height="${LANE_H}" fill="#1c1c1c" rx="3"/>`;

        // Brand icon — sits in the left margin, vertically centered in the lane
        const iconX = pad.left - ICON_W - 4;
        const iconY = Math.round(ly + (LANE_H - ICON_W) / 2);
        const iconSvg = (ICONS[lane.icon] || ICONS.feed)
          .replace('width="16" height="16"', `width="${ICON_W}" height="${ICON_W}"`);
        lanesSvg += `<g transform="translate(${iconX},${iconY})">${iconSvg}</g>`;

        if (lane.type === 'dot') {
          for (let h = startHour; h <= lastIntHour; h++) {
            const count = hourAgg[h][lane.key] || 0;
            if (!count) continue;
            const cx = xHour(h) + barColW * 0.5;
            const r  = 5.5;
            const hitR = 14;
            const detailBuckets = bucketsByHourLane[h]?.[lane.key] || [];
            lanesSvg += `<g class="lane-dot-hit" data-lane="${lane.key}" data-hour="${h}" data-label="${lane.label}" style="cursor:pointer">
              <circle cx="${cx.toFixed(1)}" cy="${lCy.toFixed(1)}" r="${hitR}" fill="transparent"/>
              <circle cx="${cx.toFixed(1)}" cy="${lCy.toFixed(1)}" r="${r}" fill="${lane.color}" opacity="0.9"/>
              ${count > 1 ? `<text x="${cx.toFixed(1)}" y="${(lCy + 0.5).toFixed(1)}" fill="white" font-size="7" font-weight="700" text-anchor="middle" dominant-baseline="middle" pointer-events="none">${count}</text>` : ''}
            </g>`;
          }
        } else {
          const minuteEntries = Object.entries(minuteAgg)
            .map(([idx, agg]) => [parseInt(idx, 10), agg])
            .sort((a, b) => a[0] - b[0]);
          for (const [minuteIdx, agg] of minuteEntries) {
            const mins = agg[lane.key] || 0;
            if (mins < 0.02) continue;
            const minuteStartHour = minuteIdx / 60;
            const minuteEndHour = (minuteIdx + 1) / 60;
            const segStart = Math.max(startHour, minuteStartHour);
            const segEnd = Math.min(nowHourFrac, minuteEndHour);
            if (segEnd <= segStart) continue;
            const fraction = Math.min(1, mins);
            const bx = xHour(segStart) + 0.5;
            const bw = Math.max(1, xHour(segEnd) - xHour(segStart) - 1);
            const barH = Math.max(5, fraction * (LANE_H - 8));
            const by  = lCy - barH / 2;
            const opacity = 0.25 + fraction * 0.7;
            lanesSvg += `<g class="lane-bar-hit" data-lane="${lane.key}" data-minute="${minuteIdx}" data-label="${lane.label}" data-mins="${mins.toFixed(2)}" style="cursor:pointer">
              <rect x="${bx.toFixed(1)}" y="${by.toFixed(1)}" width="${bw.toFixed(1)}" height="${barH.toFixed(1)}" fill="${lane.color}" opacity="${opacity.toFixed(2)}" rx="2"/>
            </g>`;
          }
        }
      });

      // ── Assemble SVG ────────────────────────────────────────────────────
      (() => {
          // Dynamic x-axis: ~4-6 labels spread across [startHour, nowHourFrac]
          function fmtHour(h) {
            const hh = Math.round(h) % 24;
            if (hh === 0 || hh === 24) return '12a';
            if (hh === 12) return '12p';
            return hh < 12 ? `${hh}a` : `${hh - 12}p`;
          }
          // Pick tick interval: 1h if window ≤4h, 2h if ≤10h, 3h otherwise
          const span = endHour - startHour;
          const tickStep = span <= 4 ? 1 : span <= 10 ? 2 : 3;
          const firstTick = Math.ceil(startHour / tickStep) * tickStep;
          const nowX = xHour(nowHourFrac);
          const MIN_LABEL_GAP = 28;
          let axisLabels = '';
          for (let h = firstTick; h <= Math.ceil(endHour); h += tickStep) {
            const tx = xHour(h);
            if (tx < pad.left - 4 || tx > pad.left + plotW + 4) continue;
            const overlapsNow = h === Math.floor(nowHourFrac) && Math.abs(tx - nowX) < MIN_LABEL_GAP;
            axisLabels += `<line x1="${tx}" y1="${xAxisY}" x2="${tx}" y2="${xAxisY + 4}" stroke="#2a2a2a" stroke-width="1"/>`;
            if (!overlapsNow) {
              axisLabels += `<text x="${tx}" y="${xLabelY}" fill="#a0a0a0" font-size="9" text-anchor="middle">${fmtHour(h)}</text>`;
            }
          }
          // "NOW" tick — when hour label was skipped due to overlap, show "now" at normal position
          axisLabels += `<line x1="${nowX}" y1="${pad.top}" x2="${nowX}" y2="${xAxisY}" stroke="#ffffff" stroke-width="0.5" stroke-dasharray="3,3" opacity="0.25"/>`;
          axisLabels += `<text x="${nowX}" y="${xLabelY}" fill="#a0a0a0" font-size="8" font-weight="600" text-anchor="middle">now</text>`;
          const attentionColorTop = getAttentionColor(100);
          const attentionColorBottom = getAttentionColor(0);
          graphEl.innerHTML = `
            <defs>
              <linearGradient id="attentionGradient" x1="0" y1="1" x2="0" y2="0">
                <stop offset="0%" stop-color="${attentionColorBottom}" stop-opacity="0.35"/>
                <stop offset="100%" stop-color="${attentionColorTop}" stop-opacity="0"/>
              </linearGradient>
              <linearGradient id="attentionLineGradient" x1="0" y1="1" x2="0" y2="0">
                <stop offset="0%" stop-color="${attentionColorBottom}"/>
                <stop offset="100%" stop-color="${attentionColorTop}"/>
              </linearGradient>
            </defs>
            <g class="axis">
              <line x1="${pad.left}" y1="${pad.top}" x2="${pad.left}" y2="${xAxisY}" stroke="#2a2a2a" stroke-width="1"/>
              <line x1="${pad.left}" y1="${xAxisY}" x2="${pad.left + plotW}" y2="${xAxisY}" stroke="#2a2a2a" stroke-width="1"/>
              <text x="${pad.left - 8}" y="${pad.top + 4}" fill="#a0a0a0" font-size="9" text-anchor="end">100</text>
              <text x="${pad.left - 8}" y="${pad.top + attnH / 2 + 4}" fill="#a0a0a0" font-size="9" text-anchor="end">50</text>
              <text x="${pad.left - 8}" y="${xAxisY + 4}" fill="#a0a0a0" font-size="9" text-anchor="end">0</text>
              ${axisLabels}
              <text x="${pad.left}" y="${xLabelY + 14}" fill="#555" font-size="8" font-weight="600" letter-spacing="0.1em">STIMULATION</text>
            </g>
            <line x1="${pad.left}" y1="${lanesY - 4}" x2="${pad.left + plotW}" y2="${lanesY - 4}" stroke="#2a2a2a" stroke-width="0.5"/>
            <g class="strain-bars-full" data-metric-layer="strain" style="display:none">${strainBarsFull || `<text x="${pad.left + plotW / 2}" y="${pad.top + attnH / 2}" fill="#555" font-size="12" text-anchor="middle">No strain data yet</text>`}</g>
            <g class="attention-layer" data-metric-layer="attention">
              <path d="${areaD}" fill="url(#attentionGradient)"/>
              <path d="${pathD}" fill="none" stroke="url(#attentionLineGradient)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            </g>
            <g class="stim-lanes" data-metric-layer="attention">${lanesSvg}</g>
          `;
        })();

      // Clickable lane dots/bars — show activity detail modal
      graphEl.onclick = (e) => {
        const g = e.target.closest('.lane-dot-hit, .lane-bar-hit');
        if (!g) return;
        const lane = g.dataset.lane;
        const hour = parseInt(g.dataset.hour, 10);
        const minuteIdx = g.dataset.minute != null ? parseInt(g.dataset.minute, 10) : null;
        const label = g.dataset.label || lane;
        const mins = g.dataset.mins;
        const detailBuckets = minuteIdx != null
          ? (bucketsByMinuteLane[minuteIdx]?.[lane] || [])
          : (bucketsByHourLane[hour]?.[lane] || []);
        const modal = document.getElementById('activityModal');
        const titleEl = document.getElementById('activityModalTitle');
        const bodyEl = document.getElementById('activityModalBody');
        if (!modal || !titleEl || !bodyEl) return;
        function fmtTime(m) {
          const [hh, mm] = (m || '00:00').split(':').map(Number);
          const h12 = hh === 0 ? 12 : hh > 12 ? hh - 12 : hh;
          return `${h12}:${String(mm).padStart(2, '0')}${hh < 12 ? 'a' : 'p'}`;
        }
        const hourLabel = hour === 0 ? '12am' : hour === 12 ? '12pm' : hour < 12 ? `${hour}am` : `${hour - 12}pm`;
        const minuteLabel = minuteIdx != null
          ? `${(() => {
              const hh = Math.floor(minuteIdx / 60);
              const mm = minuteIdx % 60;
              const h12 = hh === 0 ? 12 : hh > 12 ? hh - 12 : hh;
              return `${h12}:${String(mm).padStart(2, '0')}${hh < 12 ? 'a' : 'p'}`;
            })()}`
          : hourLabel;
        titleEl.textContent = `${label} — ${minuteLabel}` + (mins ? ` (${(Math.round(parseFloat(mins) * 10) / 10)}m)` : ` (${detailBuckets.reduce((s, b) => s + (b.shorts_count || 0) + (b.reels_count || 0) + (b.tiktoks_count || 0), 0)} items)`);
        if (detailBuckets.length === 0) {
          bodyEl.innerHTML = '<p style="color:var(--text-dim)">No per-minute breakdown available.</p>';
        } else {
          bodyEl.innerHTML = detailBuckets
            .sort((a, b) => (a.minute || '').localeCompare(b.minute || ''))
            .map(b => {
              const cat = (b.category || 'Unknown').replace(/_/g, ' ');
              const parts = [];
              const spotifySec = b.spotify_seconds || 0;
              const genericMusicSec = Math.max(0, (b.stimulation_seconds || 0) - spotifySec);
              const inferredShorts = inferShortsCount(b);
              if (inferredShorts) parts.push(`${inferredShorts} Short${inferredShorts > 1 ? 's' : ''}`);
              if (b.reels_count) parts.push(`${b.reels_count} Reel${b.reels_count > 1 ? 's' : ''}`);
              if (b.tiktoks_count) parts.push(`${b.tiktoks_count} TikTok${b.tiktoks_count > 1 ? 's' : ''}`);
              if ((b.youtube_watch_seconds || 0) > 5) parts.push(`${Math.round((b.youtube_watch_seconds || 0) / 6) / 10}m YouTube`);
              if (spotifySec > 5) parts.push(`${Math.round(spotifySec / 6) / 10}m Spotify`);
              if (genericMusicSec > 5) parts.push(`${Math.round(genericMusicSec / 6) / 10}m Music`);
              if ((b.focused_seconds || 0) > 20 && !parts.length) parts.push(`${Math.round(b.focused_seconds / 60)}m`);
              const displayUrl = b.url ? b.url.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '').replace(/</g, '&lt;').replace(/"/g, '&quot;') : '';
              const url = b.url ? `<a href="${b.url.replace(/"/g, '&quot;')}" target="_blank" rel="noopener" class="activity-detail-url" title="${b.url.replace(/"/g, '&quot;')}">${displayUrl}</a>` : '';
              return `<div class="activity-detail-item"><span>${fmtTime(b.minute)} · ${cat}</span><span>${parts.join(' · ') || '—'}</span>${url ? `<span class="activity-detail-url-wrap">${url}</span>` : ''}</div>`;
            })
            .join('');
        }
        modal.style.display = 'flex';
      };

      // Update legend
      const legendEl = document.querySelector('.graph-legend');
      if (legendEl) {
        const dot = (c) => `<span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${c};vertical-align:middle"></span>`;
        const bar = (c) => `<span style="display:inline-block;width:12px;height:5px;background:${c};vertical-align:middle;border-radius:1px;opacity:0.8"></span>`;
        legendEl.innerHTML = `
          <span class="legend-item"><span class="legend-line attention"></span> Attention</span>
          <span class="legend-item">${dot('#ff3b30')} = 1 Short</span>
          <span class="legend-item">${dot('#e1306c')} = 1 Reel</span>
          <span class="legend-item">${dot('#69c9d0')} = 1 TikTok</span>
          <span class="legend-item">${bar('#ff9500')} YT Watch</span>
          <span class="legend-item">${bar('#1db954')} Music</span>
          <span class="legend-item">${bar('#FF4500')} Reddit</span>
          <span class="legend-item">${bar('#e7e9ea')} X</span>
        `;
      }
    }

    // Activity log — collapsible per-minute breakdown
    (() => {
      const toggle = document.getElementById('activityLogToggle');
      const body   = document.getElementById('activityLogBody');
      const title  = document.getElementById('activityLogTitle');
      const content = document.getElementById('activityLogContent');
      if (!toggle || !body || !content) return;

      // Count totals for the toggle label
      const totalShorts = buckets.reduce((s, b) => s + (b.shorts_count || 0), 0);
      const totalReels  = buckets.reduce((s, b) => s + (b.reels_count  || 0), 0);
      const totalTiktoks= buckets.reduce((s, b) => s + (b.tiktoks_count|| 0), 0);
      const parts = [];
      if (totalShorts)  parts.push(`${totalShorts} YT Shorts`);
      if (totalReels)   parts.push(`${totalReels} Reels`);
      if (totalTiktoks) parts.push(`${totalTiktoks} TikToks`);
      if (title) title.textContent = parts.length
        ? `ACTIVITY LOG · ${parts.join(' · ')}`
        : 'ACTIVITY LOG';

      // Build log HTML grouped by hour, only buckets with notable activity
      function fmtMin(minute) {
        // minute is "HH:MM"
        const [hh, mm] = (minute || '00:00').split(':');
        const h = parseInt(hh, 10);
        const suffix = h < 12 ? 'a' : 'p';
        const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
        return `${h12}:${mm}${suffix}`;
      }

      // Group by hour, only show buckets that have at least one countable event
      const byHour = {};
      for (const b of buckets) {
        const h = b.hour ?? parseInt((b.minute || '00:00').split(':')[0], 10);
        if (!byHour[h]) byHour[h] = [];
        byHour[h].push(b);
      }

      let html = '';
      for (const h of Object.keys(byHour).map(Number).sort((a, z) => a - z)) {
        const hBuckets = byHour[h];
        // Show only buckets with something worth surfacing
        const notable = hBuckets.filter(b =>
          inferShortsCount(b) + (b.reels_count || 0) + (b.tiktoks_count || 0) > 0 ||
          (b.youtube_watch_seconds || 0) > 5 ||
          (b.stimulation_seconds || 0) > 5 ||
          (b.spotify_seconds || 0) > 5 ||
          (b.focused_seconds || 0) > 20
        );
        if (!notable.length) continue;

        const hLabel = h === 0 ? '12am' : h < 12 ? `${h}am` : h === 12 ? '12pm' : `${h - 12}pm`;
        html += `<div class="log-hour-group"><div class="log-hour-label">${hLabel}</div>`;
        for (const b of notable.sort((a, z) => (a.minute || '').localeCompare(z.minute || ''))) {
          const tags = [];
          const inferredShorts = inferShortsCount(b);
          const spotifySec = b.spotify_seconds || 0;
          const genericMusicSec = Math.max(0, (b.stimulation_seconds || 0) - spotifySec);
          if (inferredShorts)  tags.push(`<span class="log-tag shorts">${inferredShorts > 1 ? `×${inferredShorts} ` : ''}YT Short${inferredShorts > 1 ? 's' : ''}</span>`);
          if (b.reels_count)   tags.push(`<span class="log-tag reels">${b.reels_count > 1 ? `×${b.reels_count} ` : ''}Reel${b.reels_count > 1 ? 's' : ''}</span>`);
          if (b.tiktoks_count) tags.push(`<span class="log-tag tiktoks">${b.tiktoks_count > 1 ? `×${b.tiktoks_count} ` : ''}TikTok${b.tiktoks_count > 1 ? 's' : ''}</span>`);
          if ((b.youtube_watch_seconds || 0) > 5) tags.push(`<span class="log-tag yt">${Math.round((b.youtube_watch_seconds || 0) / 6) / 10}m YouTube</span>`);
          if (spotifySec > 5) tags.push(`<span class="log-tag music">${Math.round(spotifySec / 6) / 10}m Spotify</span>`);
          if (genericMusicSec > 5) tags.push(`<span class="log-tag music">${Math.round(genericMusicSec / 6) / 10}m Music</span>`);
          if ((b.focused_seconds || 0) > 20 && !tags.length) tags.push(`<span class="log-tag focus">${Math.round(b.focused_seconds / 60)}m focus</span>`);

          const cat = (b.category || 'UNKNOWN').replace(/_/g, ' ');
          const displayUrl = b.url ? b.url.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '').replace(/</g, '&lt;').replace(/"/g, '&quot;') : '';
          const url = b.url ? `<a href="${b.url.replace(/"/g, '&quot;')}" target="_blank" rel="noopener" class="log-url" title="${b.url.replace(/"/g, '&quot;')}">${displayUrl}</a>` : '';
          html += `<div class="log-bucket">
            <span class="log-time">${fmtMin(b.minute)}</span>
            <span class="log-category">${cat}</span>
            <span class="log-tags">${tags.join('')}</span>
            ${url ? `<span class="log-url-wrap">${url}</span>` : ''}
          </div>`;
        }
        html += '</div>';
      }

      content.innerHTML = html || '<p style="color:var(--text-dim);font-size:12px;padding:8px 4px">No activity recorded yet.</p>';

      toggle.onclick = () => {
        const open = toggle.getAttribute('aria-expanded') === 'true';
        toggle.setAttribute('aria-expanded', String(!open));
        body.style.display = open ? 'none' : 'block';
      };
    })();

    // Filter toggles: Attention vs Strain
    document.querySelectorAll('.filter-btn').forEach(btn => {
      if (btn.dataset.bound === '1') return;
      btn.dataset.bound = '1';
      btn.addEventListener('click', () => {
        document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const metric = btn.dataset.metric;
        const graph = document.getElementById('attentionGraph');
        if (graph) {
          const attentionLayers = graph.querySelectorAll('[data-metric-layer="attention"]');
          const strainLayer = graph.querySelector('[data-metric-layer="strain"]');
          if (metric === 'attention') {
            attentionLayers.forEach(el => { if (el) el.style.display = ''; });
            if (strainLayer) strainLayer.style.display = 'none';
          } else {
            attentionLayers.forEach(el => { if (el) el.style.display = 'none'; });
            if (strainLayer) strainLayer.style.display = '';
          }
        }
      });
    });

  } catch (e) {
    console.error('Dashboard load failed:', e);
  } finally {
    dashboardLoadInFlight = false;
  }
}

loadDashboard();
window.addEventListener('focus', () => loadDashboard());
document.addEventListener('visibilitychange', () => {
  if (!document.hidden) loadDashboard();
});
setInterval(() => {
  if (!document.hidden) loadDashboard();
}, DASHBOARD_REFRESH_MS);

// Debug export — always attached so it works even if graph block fails
document.getElementById('debugExportBtn')?.addEventListener('click', () => {
  const data = window.__attentionDebugExport;
  if (!data) {
    alert('No debug data yet. Refresh the dashboard first.');
    return;
  }
  try {
    const json = JSON.stringify(data, null, 2);
    const filename = `attention-debug-${getLocalDateStr()}.json`;
    const a = document.createElement('a');
    a.download = filename;
    a.style.display = 'none';
    a.href = 'data:application/json;charset=utf-8,' + encodeURIComponent(json);
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  } catch (err) {
    console.error('Export failed:', err);
    alert('Export failed. Check console for details.');
  }
});

// Modal close handlers (once)
document.getElementById('activityModalBackdrop')?.addEventListener('click', () => {
  document.getElementById('activityModal').style.display = 'none';
});
document.getElementById('activityModalClose')?.addEventListener('click', () => {
  document.getElementById('activityModal').style.display = 'none';
});
