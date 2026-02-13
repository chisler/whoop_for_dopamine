export function getLocalDateStr(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function getMinuteKey(d = new Date()) {
  const date = getLocalDateStr(d);
  const minute = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  return { date, minute, key: `${date}_${minute}` };
}

export function getHour(d = new Date()) {
  return d.getHours();
}

export function isLateNight(hour) {
  return hour >= 22 || hour < 6;
}

export function getDomainFromUrl(url) {
  try {
    return new URL(url || 'about:blank').hostname.replace(/^www\./, '');
  } catch {
    return 'unknown';
  }
}
