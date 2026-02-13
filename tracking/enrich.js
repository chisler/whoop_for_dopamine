import { classifyUrl, isFeedCategory } from '../url-classifier.js';

export function buildVisits(events) {
  return (events || [])
    .filter(e => e.type === 'active_tab_changed')
    .map(e => ({ ts: e.ts, domain: e.domain, category: e.category, url: e.url }))
    .sort((a, b) => a.ts - b.ts);
}

export function enrichBucketsWithVisits(buckets, visits) {
  return (buckets || []).map(bucket => {
    const b2 = { ...bucket };
    if (!b2.url && visits.length > 0) {
      const bucketTs = b2.timestamp || new Date(`${b2.date}T${b2.minute}:00`).getTime();
      const active = visits.filter(v => v.ts <= bucketTs).pop() || visits[0];
      b2.url = (active?.url && active.url.startsWith('http'))
        ? active.url
        : (active?.domain ? `https://${active.domain}` : null);
    }
    if (b2.url && (b2.category === 'UNKNOWN' || b2.category === 'OTHER')) {
      const fromUrl = classifyUrl(b2.url);
      if (fromUrl !== 'OTHER') b2.category = fromUrl;
    }
    if ((b2.category === 'UNKNOWN' || b2.category === 'OTHER') && (b2.shorts_count || 0) > 0) {
      b2.category = 'YOUTUBE_SHORTS';
    } else if ((b2.category === 'UNKNOWN' || b2.category === 'OTHER') && (b2.reels_count || 0) > 0) {
      b2.category = 'INSTAGRAM_REELS';
    } else if ((b2.category === 'UNKNOWN' || b2.category === 'OTHER') && (b2.tiktoks_count || 0) > 0) {
      b2.category = 'TIKTOK';
    }
    return b2;
  });
}

export function buildHourlyTimeline(buckets) {
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

  for (const b of buckets) {
    const h = b.hour ?? (parseInt(String(b.minute || '0').split(':')[0], 10) || 0);
    const shorts = b.shorts_count || 0;
    const reels = b.reels_count || 0;
    const tiktoks = b.tiktoks_count || 0;
    const stimSec = b.stimulation_seconds || 0;
    const ytSec = b.youtube_watch_seconds || 0;
    const feedMins = isFeedCategory(b.category) ? b.focused_seconds / 60 : 0;
    const switches = b.switches || 0;
    const shortForm = shorts + reels + tiktoks;
    const stimMins = (stimSec + ytSec) / 60;
    const strainRaw = shortForm * 3 + stimMins * 2 + feedMins * 1.5 + switches * 0.8;

    hourlyTimeline[h].strain += strainRaw;
    if (stimSec > 5) hourlyTimeline[h].music = true;
    if (ytSec > 5) hourlyTimeline[h].youtube = true;
    if (shorts > 0) hourlyTimeline[h].shorts = true;
    if (reels > 0) hourlyTimeline[h].reels = true;
    if (tiktoks > 0) hourlyTimeline[h].tiktok = true;
    if (feedMins > 0) hourlyTimeline[h].feed = true;
  }

  return Object.entries(hourlyTimeline).map(([hour, data]) => ({
    hour: parseInt(hour, 10),
    strain: Math.round(data.strain * 10) / 10,
    music: data.music,
    youtube: data.youtube,
    shorts: data.shorts,
    reels: data.reels,
    tiktok: data.tiktok,
    feed: data.feed
  }));
}

export function ensureHourOnBuckets(buckets) {
  return (buckets || []).map(b => ({
    ...b,
    hour: b.hour ?? (parseInt(String(b.minute || '0').split(':')[0], 10) || 0)
  }));
}
