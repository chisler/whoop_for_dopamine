import { classifyUrl } from '../url-classifier.js';
import { getBucketByKey, saveBucket } from '../storage.js';
import { getDomainFromUrl, getHour, getMinuteKey } from './time.js';

const DEFAULT_STATE = {
  activeTabId: null,
  activeTabUrl: null,
  activeTabDomain: null,
  tabActivatedAt: null,
  windowFocused: true,
  idleState: 'active',
  lastMusicHeartbeatAt: null,
  lastAudioProbeAt: null,
  lastMinuteKey: null,
  pendingBucket: null
};

export function createTrackerRuntime({
  activeTimeTickMs = 5000,
  flushTickMs = 30000
} = {}) {
  let state = { ...DEFAULT_STATE };
  let accrualQueue = Promise.resolve(0);

  async function loadState() {
    const s = await chrome.storage.session.get('whoopState');
    if (s.whoopState) state = { ...DEFAULT_STATE, ...state, ...s.whoopState };
    state.lastAudioProbeAt = Date.now();
  }

  async function saveState() {
    await chrome.storage.session.set({ whoopState: state });
  }

  function getState() {
    return state;
  }

  function setActiveTab(tabId, url = '') {
    state.activeTabId = tabId ?? null;
    state.activeTabUrl = typeof url === 'string' ? url : '';
    state.activeTabDomain = getDomainFromUrl(state.activeTabUrl);
  }

  function updateActiveUrl(url) {
    if (!url || !url.startsWith('http') || url === state.activeTabUrl) return false;
    state.activeTabUrl = url;
    state.activeTabDomain = getDomainFromUrl(url);
    return true;
  }

  function setTabActivatedAt(ts) {
    state.tabActivatedAt = ts ?? null;
  }

  function setIdleState(idleState) {
    state.idleState = idleState;
  }

  function setWindowFocused(focused) {
    state.windowFocused = !!focused;
  }

  function clearMusicHeartbeat() {
    state.lastMusicHeartbeatAt = null;
    state.lastAudioProbeAt = Date.now();
  }

  function isYoutubeUrl(url = '') {
    return /(?:youtube\.com|youtu\.be)/i.test(url);
  }

  function pickAudibleSource(tabs) {
    const webTabs = (tabs || []).filter(t => t?.url && t.url.startsWith('http'));
    const spotify = webTabs.find(t => classifyUrl(t.url) === 'SPOTIFY');
    if (spotify) return { type: 'spotify', url: spotify.url };
    const youtube = webTabs.find(t => isYoutubeUrl(t.url));
    if (youtube) return { type: 'youtube', url: youtube.url };
    const music = webTabs.find(t => classifyUrl(t.url) === 'MUSIC');
    if (music) return { type: 'music', url: music.url };
    return null;
  }

  async function flushBucket() {
    if (!state.pendingBucket) return;
    await saveBucket(state.pendingBucket);
    state.pendingBucket = null;
  }

  async function getOrCreateBucket() {
    const { date, minute, key } = getMinuteKey();
    if (state.lastMinuteKey !== key) {
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
        spotify_seconds: 0,
        other_music_seconds: 0,
        audio_playing_seconds: 0,
        category: state.activeTabUrl ? classifyUrl(state.activeTabUrl) : 'UNKNOWN',
        url: state.activeTabUrl || null,
        hour
      };
    } else if (!state.pendingBucket) {
      const existing = await getBucketByKey(key);
      if (existing) {
        state.pendingBucket = existing;
      } else {
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
          spotify_seconds: 0,
          other_music_seconds: 0,
          audio_playing_seconds: 0,
          category: state.activeTabUrl ? classifyUrl(state.activeTabUrl) : 'UNKNOWN',
          url: state.activeTabUrl || null,
          hour
        };
      }
    }
    return state.pendingBucket;
  }

  function accrueActiveTime(now = Date.now(), { forceSave = false } = {}) {
    accrualQueue = accrualQueue
      .then(async () => {
        const focused = await accrueActiveTimeInternal(now, { forceSave });
        const audible = await accrueAudiblePlaybackInternal(now, { forceSave });
        return focused + audible;
      })
      .catch(() => 0);
    return accrualQueue;
  }

  async function accrueActiveTimeInternal(now = Date.now(), { forceSave = false } = {}) {
    if (!state.tabActivatedAt || !state.windowFocused || state.idleState !== 'active') return 0;

    const focusSeconds = Math.floor((now - state.tabActivatedAt) / 1000);
    if (focusSeconds <= 0) return 0;

    const bucket = await getOrCreateBucket();
    bucket.focused_seconds += focusSeconds;

    const url = state.activeTabUrl;
    const cat = url ? classifyUrl(url) : 'UNKNOWN';
    if (url && url.startsWith('http')) {
      bucket.url = url;
      if (bucket.category === 'UNKNOWN' || bucket.category === 'OTHER') {
        bucket.category = cat;
      }
    }

    state.tabActivatedAt += focusSeconds * 1000;
    await saveState();

    if (forceSave) {
      await saveBucket(bucket);
    }
    return focusSeconds;
  }

  async function accrueAudiblePlaybackInternal(now = Date.now(), { forceSave = false } = {}) {
    if (!state.lastAudioProbeAt) {
      state.lastAudioProbeAt = now;
      await saveState();
      return 0;
    }

    const playbackSeconds = Math.floor((now - state.lastAudioProbeAt) / 1000);
    if (playbackSeconds <= 0) return 0;
    state.lastAudioProbeAt += playbackSeconds * 1000;

    if (state.idleState !== 'active') {
      await saveState();
      return 0;
    }

    let audibleTabs = [];
    try {
      audibleTabs = await chrome.tabs.query({ audible: true });
    } catch {
      await saveState();
      return 0;
    }

    const source = pickAudibleSource(audibleTabs);
    if (!source) {
      await saveState();
      return 0;
    }

    const bucket = await getOrCreateBucket();
    bucket.audio_playing_seconds = (bucket.audio_playing_seconds || 0) + playbackSeconds;

    if (source.type === 'spotify') {
      bucket.stimulation_seconds = (bucket.stimulation_seconds || 0) + playbackSeconds;
      bucket.spotify_seconds = (bucket.spotify_seconds || 0) + playbackSeconds;
    } else if (source.type === 'youtube') {
      bucket.youtube_watch_seconds = (bucket.youtube_watch_seconds || 0) + playbackSeconds;
    } else if (source.type === 'music') {
      bucket.stimulation_seconds = (bucket.stimulation_seconds || 0) + playbackSeconds;
      bucket.other_music_seconds = (bucket.other_music_seconds || 0) + playbackSeconds;
    }

    if (!bucket.url && source.url) bucket.url = source.url;
    if (source.url && (bucket.category === 'UNKNOWN' || bucket.category === 'OTHER')) {
      const sourceCat = classifyUrl(source.url);
      if (sourceCat !== 'OTHER') bucket.category = sourceCat;
    }

    await saveState();
    if (forceSave || playbackSeconds > 0) await saveBucket(bucket);
    return playbackSeconds;
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
    if (cat !== 'OTHER' || bucket.category === 'UNKNOWN' || bucket.category === 'OTHER') {
      bucket.category = cat;
    }
    state.activeTabUrl = url;
    state.activeTabDomain = getDomainFromUrl(url);
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
      return;
    }

    if (msg.event === 'click') {
      bucket.clicks += msg.count || 1;
      await setBucketUrl(bucket, url);
      return;
    }

    if (msg.event === 'short_watched') {
      if (msg.source === 'youtube_shorts') bucket.shorts_count = (bucket.shorts_count || 0) + 1;
      else if (msg.source === 'instagram_reels') bucket.reels_count = (bucket.reels_count || 0) + 1;
      else if (msg.source === 'tiktok') bucket.tiktoks_count = (bucket.tiktoks_count || 0) + 1;

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
      return;
    }

    if (msg.event === 'youtube_playing') {
      // Audibility-based tracker is the source of truth for playback duration.
      await setBucketUrl(bucket, url);
      return;
    }

    if (msg.event === 'music_playing') {
      // Keep heartbeat only as a signal that music is active; duration comes from tab.audible.
      state.lastMusicHeartbeatAt = Date.now();
      await setBucketUrl(bucket, url);
      await saveState();
    }
  }

  return {
    activeTimeTickMs,
    flushTickMs,
    loadState,
    saveState,
    getState,
    setActiveTab,
    updateActiveUrl,
    setTabActivatedAt,
    setIdleState,
    setWindowFocused,
    clearMusicHeartbeat,
    flushBucket,
    getOrCreateBucket,
    accrueActiveTime,
    onContentEvent
  };
}
