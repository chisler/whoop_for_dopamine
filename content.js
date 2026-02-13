/**
 * Content script: scroll, clicks, and media tracking
 * Shorts/Reels/TikTok count, YouTube playing, etc.
 */

let scrollDistance = 0;
let scrollCount = 0;
let clickCount = 0;
let lastScrollY = 0;
let ticking = false;

function getDomain() {
  try {
    return new URL(window.location.href).hostname.replace(/^www\./, '');
  } catch {
    return 'unknown';
  }
}

function sendEvent(type, payload = {}) {
  chrome.runtime.sendMessage({
    type: 'CONTENT_EVENT',
    event: type,
    domain: getDomain(),
    ...payload
  }).catch(() => {});
}

// Scroll tracking
function onScroll() {
  scrollCount++;
  const delta = Math.abs(window.scrollY - lastScrollY);
  scrollDistance += delta;
  lastScrollY = window.scrollY;
  if (!ticking) {
    requestAnimationFrame(() => { ticking = false; });
    ticking = true;
  }
}

setInterval(() => {
  if (scrollCount > 0 || scrollDistance > 0) {
    sendEvent('scroll_batch', { count: scrollCount, distance: scrollDistance });
    scrollCount = 0;
    scrollDistance = 0;
  }
}, 2000);

document.addEventListener('click', () => {
  clickCount++;
  sendEvent('click', { count: 1 });
}, true);

lastScrollY = window.scrollY;
window.addEventListener('scroll', onScroll, { passive: true });

// --- Media / short-form tracking ---

function isYouTubeShorts() {
  return /youtube\.com\/shorts\//i.test(window.location.href);
}

function isInstagramReels() {
  return /instagram\.com\/(reel|reels)\//i.test(window.location.href);
}

function isTikTok() {
  return /tiktok\.com/i.test(window.location.href);
}

function isYouTubeWatch() {
  return /youtube\.com\/watch\?v=/i.test(window.location.href);
}

function isSpotify() {
  return /spotify\.com/i.test(window.location.href);
}

function isMusicSite() {
  return /spotify\.com|music\.apple\.com|soundcloud\.com/i.test(window.location.href);
}

// Music: fire a heartbeat every 10s only when audio is actually playing
function setupMusicTracking() {
  mediaTrackingIntervals.push(setInterval(() => {
    const video = document.querySelector('video');
    const audio = document.querySelector('audio');
    const playing = (video && !video.paused && !video.ended) ||
                    (audio && !audio.paused && !audio.ended);
    if (playing) sendEvent('music_playing', { seconds: 10 });
  }, 10000));
}

// Count short-form videos watched (video ended or swipe to next)
function setupShortFormTracking() {
  let lastVideoSrc = '';
  let lastCountAt = 0;
  const DEBOUNCE_MS = 2500;

  function countShort(source) {
    const now = Date.now();
    if (now - lastCountAt < DEBOUNCE_MS) return;
    lastCountAt = now;
    sendEvent('short_watched', { source });
  }

  function onVideoEnded() {
    if (isYouTubeShorts()) countShort('youtube_shorts');
    else if (isInstagramReels()) countShort('instagram_reels');
    else if (isTikTok()) countShort('tiktok');
  }

  function checkVideoSrc() {
    const video = document.querySelector('video');
    if (!video) return;
    const src = video.src || video.currentSrc || (video.querySelector('source')?.src) || '';
    if (src && src !== lastVideoSrc) {
      lastVideoSrc = src;
      if (isYouTubeShorts()) countShort('youtube_shorts');
      else if (isInstagramReels()) countShort('instagram_reels');
      else if (isTikTok()) countShort('tiktok');
    }
  }

  mediaAbortController = new AbortController();
  const video = document.querySelector('video');
  if (video) {
    lastVideoSrc = video.src || video.currentSrc || '';
    video.addEventListener('ended', onVideoEnded, { signal: mediaAbortController.signal });
  }

  // Poll for src changes (SPA navigation, swipe to next)
  mediaTrackingIntervals.push(setInterval(checkVideoSrc, 3000));
}

// YouTube Watch: report when video is actively playing
function setupYouTubeWatchTracking() {
  if (!isYouTubeWatch()) return;

  mediaTrackingIntervals.push(setInterval(() => {
    const video = document.querySelector('video');
    if (video && !video.paused && !video.ended) {
      sendEvent('youtube_playing', { seconds: 10 });
    }
  }, 10000));
}

// Spotify / music: focus time is tracked by background; no extra content logic
// Background counts focus_seconds when category is SPOTIFY/MUSIC

let mediaTrackingInit = false;
let mediaTrackingIntervals = [];
let mediaAbortController = null;

function clearMediaTracking() {
  for (const id of mediaTrackingIntervals) clearInterval(id);
  mediaTrackingIntervals = [];
  if (mediaAbortController) {
    mediaAbortController.abort();
    mediaAbortController = null;
  }
}

function initMediaTracking() {
  if (mediaTrackingInit) return;
  clearMediaTracking();
  if (isYouTubeShorts() || isInstagramReels() || isTikTok()) {
    mediaTrackingInit = true;
    setupShortFormTracking();
  } else if (isYouTubeWatch()) {
    mediaTrackingInit = true;
    setupYouTubeWatchTracking();
  } else if (isMusicSite()) {
    mediaTrackingInit = true;
    setupMusicTracking();
  }
}

initMediaTracking();

// Re-init on SPA navigation (YouTube, Instagram, TikTok use client-side routing)
let lastPath = location.pathname + location.search;
setInterval(() => {
  const path = location.pathname + location.search;
  if (path !== lastPath) {
    lastPath = path;
    mediaTrackingInit = false;
    initMediaTracking();
  }
}, 1500);
