/**
 * Dashboard — Stimulation Strain, culprits, single timeline
 */

const RING_CIRCUMFERENCE = 2 * Math.PI * 44;

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

function setRingProgress(el, value, max) {
  if (!el || typeof value !== 'number' || isNaN(value)) return;
  const pct = Math.min(1, Math.max(0, value / max));
  el.style.strokeDashoffset = RING_CIRCUMFERENCE * (1 - pct);
}

async function loadDashboard() {
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
    setRingProgress(document.getElementById('focus-ring'), attentionSpan, 100);
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

    // Timeline: Attention body-battery + stimulation swim lanes
    const graphEl = document.getElementById('attentionGraph');
    if (graphEl) {
      let data = res.hourlyTimeline || [];
      const buckets = res.buckets || [];

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
      // First activity: prefer sessionStart timestamp.
      // Fall back to first bucket that has real activity (not an empty midnight bucket).
      const sessionHour = res.sessionStart
        ? new Date(res.sessionStart).getHours() + new Date(res.sessionStart).getMinutes() / 60
        : null;
      const firstActiveBucket = buckets
        .filter(b => (b.focused_seconds || 0) > 10 || (b.switches || 0) > 0 || (b.shorts_count || 0) > 0)
        .sort((a, b2) => (a.hour ?? 0) - (b2.hour ?? 0))[0];
      const firstBucketHour = firstActiveBucket ? (firstActiveBucket.hour ?? null) : null;
      const startHour = Math.floor(sessionHour ?? firstBucketHour ?? Math.max(0, nowHourFrac - 1));
      // End is current fractional hour (never draw the future)
      const endHour = Math.max(startHour + 1, nowHourFrac);

      // ── Layout ──────────────────────────────────────────────────────────
      const w = 420;
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

      // ── Attention line (anchored to the ring's strain value) ─────────────
      // The ring already computed the authoritative attention value using proper
      // sqrt-saturation curves. Use that as the endpoint and distribute the
      // depletion proportionally over each hour's raw strain weight.
      // This guarantees graph endpoint == ring value, always.
      const lastIntHour   = Math.floor(nowHourFrac);
      const activeData    = data.filter(x => x.hour >= startHour && x.hour <= lastIntHour);
      const dailyStrain   = res.today?.strain ?? 0;          // 0-100, from ring
      const attentionNow  = 100 - dailyStrain;               // matches ring exactly
      const totalRawStrain = activeData.reduce((s, x) => s + (x.strain || 0), 0);

      // attByHour[h] = attention value AT THE START of hour h (h:00)
      // Strain of hour h depletes the battery entering hour h+1
      const attByHour = { [startHour]: 100 };
      let depletedSoFar = 0;
      for (let h = startHour; h <= lastIntHour; h++) {
        const rawS = (data.find(x => x.hour === h) || { strain: 0 }).strain || 0;
        const frac = totalRawStrain > 0 ? rawS / totalRawStrain : 0;
        depletedSoFar += frac * dailyStrain;
        attByHour[h + 1] = Math.max(0, 100 - depletedSoFar);
      }

      // For strain bars (Strain view): scale bars against peak hourly raw strain
      const maxStrain    = Math.max(0, ...activeData.map(x => x.strain || 0));
      const effectiveMax = Math.max(maxStrain, 0.1);

      // Draw path: startHour:00 → each integer hour → now (exact ring value)
      let pathD = `M ${xHour(startHour)} ${y(attByHour[startHour])}`;
      for (let h = startHour + 1; h <= lastIntHour; h++) {
        pathD += ` L ${xHour(h)} ${y(attByHour[h])}`;
      }
      pathD += ` L ${xHour(nowHourFrac)} ${y(attentionNow)}`;
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
          strainBarsFull += `<rect x="${bx}" y="${xAxisY - bh}" width="${bw}" height="${bh}" fill="#e85d75" opacity="0.85"/>`;
        }
      }

      // ── Per-hour stimulation aggregation ────────────────────────────────
      const hourAgg = {};
      for (let h = 0; h < 24; h++) {
        hourAgg[h] = { shorts: 0, reels: 0, tiktoks: 0, musicMins: 0, ytMins: 0, redditMins: 0, xMins: 0 };
      }
      const REDDIT_SET = new Set(['REDDIT_FEED','REDDIT_THREAD']);
      const X_SET      = new Set(['X_HOME','X_SEARCH','X_OTHER','X_THREAD']);
      for (const b of buckets) {
        const h = b.hour ?? (parseInt(String(b.minute || '0').split(':')[0], 10) || 0);
        hourAgg[h].shorts    += b.shorts_count || 0;
        hourAgg[h].reels     += b.reels_count  || 0;
        hourAgg[h].tiktoks   += b.tiktoks_count || 0;
        hourAgg[h].musicMins += (b.stimulation_seconds   || 0) / 60;
        hourAgg[h].ytMins    += (b.youtube_watch_seconds || 0) / 60;
        if (REDDIT_SET.has(b.category || '')) hourAgg[h].redditMins += (b.focused_seconds || 0) / 60;
        if (X_SET.has(b.category || ''))      hourAgg[h].xMins      += (b.focused_seconds || 0) / 60;
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
          // One circle per event at each hour; number inside when count > 1
          for (let h = startHour; h <= lastIntHour; h++) {
            const count = hourAgg[h][lane.key] || 0;
            if (!count) continue;
            const cx = xHour(h) + barColW * 0.5;
            const r  = 5.5;
            lanesSvg += `<circle cx="${cx.toFixed(1)}" cy="${lCy.toFixed(1)}" r="${r}" fill="${lane.color}" opacity="0.9"/>`;
            if (count > 1) {
              lanesSvg += `<text x="${cx.toFixed(1)}" y="${(lCy + 0.5).toFixed(1)}" fill="white" font-size="7" font-weight="700" text-anchor="middle" dominant-baseline="middle">${count}</text>`;
            }
          }
        } else {
          // Heat-map bar: full column width, opacity ∝ fraction of hour spent
          for (let h = startHour; h <= lastIntHour; h++) {
            const mins = hourAgg[h][lane.key] || 0;
            if (mins < 0.3) continue;
            const fraction = Math.min(1, mins / 60);
            const bx = xHour(h) + 1;
            const bw = barColW - 2;
            const barH = Math.max(5, fraction * (LANE_H - 8));
            const by  = lCy - barH / 2;
            const opacity = 0.25 + fraction * 0.7;
            lanesSvg += `<rect x="${bx.toFixed(1)}" y="${by.toFixed(1)}" width="${bw.toFixed(1)}" height="${barH.toFixed(1)}" fill="${lane.color}" opacity="${opacity.toFixed(2)}" rx="2"/>`;
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
          let axisLabels = '';
          for (let h = firstTick; h <= Math.ceil(endHour); h += tickStep) {
            const tx = xHour(h);
            if (tx < pad.left - 4 || tx > pad.left + plotW + 4) continue;
            axisLabels += `<line x1="${tx}" y1="${xAxisY}" x2="${tx}" y2="${xAxisY + 4}" stroke="#2a2a2a" stroke-width="1"/>`;
            axisLabels += `<text x="${tx}" y="${xLabelY}" fill="#a0a0a0" font-size="9" text-anchor="middle">${fmtHour(h)}</text>`;
          }
          // "NOW" tick
          const nowX = xHour(nowHourFrac);
          axisLabels += `<line x1="${nowX}" y1="${pad.top}" x2="${nowX}" y2="${xAxisY}" stroke="#ffffff" stroke-width="0.5" stroke-dasharray="3,3" opacity="0.25"/>`;
          axisLabels += `<text x="${nowX}" y="${xLabelY}" fill="#a0a0a0" font-size="8" font-weight="600" text-anchor="middle">now</text>`;
          graphEl.innerHTML = `
            <defs>
              <linearGradient id="attentionGradient" x1="0" y1="1" x2="0" y2="0">
                <stop offset="0%" stop-color="#34c759" stop-opacity="0.35"/>
                <stop offset="100%" stop-color="#34c759" stop-opacity="0"/>
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
              <path d="${pathD}" fill="none" stroke="#34c759" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            </g>
            <g class="stim-lanes" data-metric-layer="attention">${lanesSvg}</g>
          `;
        })();

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
          (b.shorts_count || 0) + (b.reels_count || 0) + (b.tiktoks_count || 0) > 0 ||
          (b.youtube_watch_seconds || 0) > 30 ||
          (b.stimulation_seconds || 0) > 30 ||
          (b.focused_seconds || 0) > 20
        );
        if (!notable.length) continue;

        const hLabel = h === 0 ? '12am' : h < 12 ? `${h}am` : h === 12 ? '12pm' : `${h - 12}pm`;
        html += `<div class="log-hour-group"><div class="log-hour-label">${hLabel}</div>`;
        for (const b of notable.sort((a, z) => (a.minute || '').localeCompare(z.minute || ''))) {
          const tags = [];
          if (b.shorts_count)  tags.push(`<span class="log-tag shorts">${b.shorts_count > 1 ? `×${b.shorts_count} ` : ''}YT Short${b.shorts_count > 1 ? 's' : ''}</span>`);
          if (b.reels_count)   tags.push(`<span class="log-tag reels">${b.reels_count > 1 ? `×${b.reels_count} ` : ''}Reel${b.reels_count > 1 ? 's' : ''}</span>`);
          if (b.tiktoks_count) tags.push(`<span class="log-tag tiktoks">${b.tiktoks_count > 1 ? `×${b.tiktoks_count} ` : ''}TikTok${b.tiktoks_count > 1 ? 's' : ''}</span>`);
          if ((b.youtube_watch_seconds || 0) > 30) tags.push(`<span class="log-tag yt">${Math.round(b.youtube_watch_seconds / 60)}m YT</span>`);
          if ((b.stimulation_seconds || 0) > 30)   tags.push(`<span class="log-tag music">${Math.round(b.stimulation_seconds / 60)}m Music</span>`);
          if ((b.focused_seconds || 0) > 20 && !tags.length) tags.push(`<span class="log-tag focus">${Math.round(b.focused_seconds / 60)}m focus</span>`);

          const cat = (b.category || 'UNKNOWN').replace(/_/g, ' ');
          html += `<div class="log-bucket">
            <span class="log-time">${fmtMin(b.minute)}</span>
            <span class="log-category">${cat}</span>
            <span class="log-tags">${tags.join('')}</span>
          </div>`;
        }
        html += '</div>';
      }

      content.innerHTML = html || '<p style="color:var(--text-dim);font-size:12px;padding:8px 4px">No activity recorded yet.</p>';

      toggle.addEventListener('click', () => {
        const open = toggle.getAttribute('aria-expanded') === 'true';
        toggle.setAttribute('aria-expanded', String(!open));
        body.style.display = open ? 'none' : 'block';
      });
    })();

    // Filter toggles: Attention vs Strain
    document.querySelectorAll('.filter-btn').forEach(btn => {
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
  }
}

loadDashboard();
