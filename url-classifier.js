/**
 * URL pattern classifier — cheap "intent vs feed" labels
 * Stores only labels, no full URLs
 */

const PATTERNS = [
  // YouTube
  { pattern: /youtube\.com\/shorts\//i, label: 'YOUTUBE_SHORTS' },
  { pattern: /youtube\.com\/watch\?v=/i, label: 'YOUTUBE_WATCH' },
  { pattern: /youtube\.com\/?$/i, label: 'YOUTUBE_HOME' },
  { pattern: /youtube\.com/i, label: 'YOUTUBE_OTHER' },

  // X / Twitter
  { pattern: /(?:twitter|x)\.com\/search/i, label: 'X_SEARCH' },
  { pattern: /(?:twitter|x)\.com\/[^/]+\/status/i, label: 'X_THREAD' },
  { pattern: /(?:twitter|x)\.com\/?$/i, label: 'X_HOME' },
  { pattern: /(?:twitter|x)\.com/i, label: 'X_OTHER' },

  // Reddit
  { pattern: /reddit\.com\/r\/[^/]+\/comments/i, label: 'REDDIT_THREAD' },
  { pattern: /reddit\.com/i, label: 'REDDIT_FEED' },

  // Instagram
  { pattern: /instagram\.com\/reel/i, label: 'INSTAGRAM_REELS' },
  { pattern: /instagram\.com\/reels/i, label: 'INSTAGRAM_REELS' },
  { pattern: /instagram\.com/i, label: 'INSTAGRAM_OTHER' },

  // TikTok
  { pattern: /tiktok\.com/i, label: 'TIKTOK' },

  // Spotify / Music
  { pattern: /spotify\.com/i, label: 'SPOTIFY' },
  { pattern: /music\.apple\.com/i, label: 'MUSIC' },
  { pattern: /soundcloud\.com/i, label: 'MUSIC' },
  { pattern: /youtube\.com\/music/i, label: 'MUSIC' },

  // Docs / Work
  { pattern: /notion\.(?:so|ai)/i, label: 'DOCS_WORK' },
  { pattern: /docs\.google\.com/i, label: 'DOCS_WORK' },
  { pattern: /github\.com/i, label: 'DOCS_WORK' },
  { pattern: /jira\.[^/]+/i, label: 'DOCS_WORK' },
  { pattern: /figma\.com/i, label: 'DOCS_WORK' },
  { pattern: /linear\.app/i, label: 'DOCS_WORK' },
  { pattern: /confluence\.[^/]+/i, label: 'DOCS_WORK' },
  { pattern: /slack\.com/i, label: 'DOCS_WORK' },
  { pattern: /stackoverflow\.com/i, label: 'DOCS_WORK' },
  { pattern: /developer\.mozilla\.org/i, label: 'DOCS_WORK' },
];

const FEED_LABELS = new Set([
  'YOUTUBE_SHORTS', 'YOUTUBE_HOME', 'X_HOME', 'X_SEARCH', 'X_OTHER',
  'REDDIT_FEED', 'YOUTUBE_OTHER', 'INSTAGRAM_REELS', 'TIKTOK'
]);

const STIMULATION_LABELS = new Set(['SPOTIFY', 'MUSIC']);

const WORK_LABELS = new Set(['DOCS_WORK']);

export function classifyUrl(url) {
  if (!url || typeof url !== 'string') return 'UNKNOWN';
  for (const { pattern, label } of PATTERNS) {
    if (pattern.test(url)) return label;
  }
  return 'OTHER';
}

export function isFeedCategory(label) {
  return FEED_LABELS.has(label);
}

export function isWorkCategory(label) {
  return WORK_LABELS.has(label);
}

export function isStimulationCategory(label) {
  return STIMULATION_LABELS.has(label);
}
