import { isFeedCategory } from '../url-classifier.js';
import { isLateNight } from './time.js';

function inferShortsCount(bucket) {
  const explicit = bucket.shorts_count || 0;
  if (explicit > 0) return explicit;
  const isShortsCategory = bucket.category === 'YOUTUBE_SHORTS';
  const isShortsUrl = typeof bucket.url === 'string' && /youtube\.com\/shorts\//i.test(bucket.url);
  const activeSeconds = (bucket.youtube_watch_seconds || 0) + (bucket.focused_seconds || 0);
  return (isShortsCategory && isShortsUrl && activeSeconds >= 10) ? 1 : 0;
}

export function computeDopamineStrain(buckets) {
  let totalShorts = 0;
  let totalReels = 0;
  let totalTiktoks = 0;
  let totalStimSeconds = 0;
  let totalYtWatchSeconds = 0;
  let totalFeedSeconds = 0;
  let fragmentationMinutes = 0;
  let lateNightActiveMinutes = 0;

  for (const b of buckets) {
    totalShorts += inferShortsCount(b);
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

    const hasActivity =
      (b.focused_seconds || 0) +
      (b.shorts_count || 0) +
      (b.reels_count || 0) +
      (b.tiktoks_count || 0) > 0;
    if (isLateNight(b.hour) && hasActivity) lateNightActiveMinutes += 1;
  }

  const shortFormTotal = totalShorts + totalReels + totalTiktoks;
  const shortFormScore = Math.min(20, 2.2 * Math.sqrt(shortFormTotal));

  const stimMins = (totalStimSeconds + totalYtWatchSeconds) / 60;
  const stimScore = Math.min(14, 1.8 * Math.sqrt(stimMins));

  const feedMins = totalFeedSeconds / 60;
  const feedScore = Math.min(14, 1.8 * Math.sqrt(feedMins));

  const fragScore = Math.min(10, 1.2 * Math.sqrt(fragmentationMinutes));
  const lateScore = Math.min(8, 0.4 * lateNightActiveMinutes);

  const raw = shortFormScore + stimScore + feedScore + fragScore + lateScore;
  const score = Math.round(100 * (1 - Math.exp(-raw / 25)));
  return Math.min(100, score);
}

export function computeStrainBreakdown(buckets) {
  const breakdown = {};
  for (const b of buckets) {
    const shorts = inferShortsCount(b);
    const reels = b.reels_count || 0;
    const tiktoks = b.tiktoks_count || 0;
    const stimMins = (b.stimulation_seconds || 0) / 60;
    const ytMins = (b.youtube_watch_seconds || 0) / 60;
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

export function computeFocusMinutes(buckets) {
  let totalFocus = 0;
  let longestBlock = 0;
  let currentBlock = 0;

  for (const b of buckets) {
    const isLowSwitch = b.switches <= 2;
    const isLowScroll = b.scrolls <= 5 && b.scroll_distance <= 500;
    const isWork =
      b.category === 'DOCS_WORK' ||
      b.category === 'REDDIT_THREAD' ||
      b.category === 'YOUTUBE_WATCH' ||
      b.category === 'X_THREAD';

    if (isWork && isLowSwitch && isLowScroll) {
      const mins = b.focused_seconds / 60;
      totalFocus += mins;
      currentBlock += mins;
      longestBlock = Math.max(longestBlock, currentBlock);
    } else {
      currentBlock = 0;
    }
  }

  return {
    totalFocus: Math.round(totalFocus * 10) / 10,
    longestBlock: Math.round(longestBlock * 10) / 10
  };
}
