/**
 * IndexedDB storage for raw events and 1-minute buckets
 * Privacy: local-only, nothing uploaded
 */

const DB_NAME = 'whoop-dopamine';
const DB_VERSION = 2;
const STORES = { events: 'events', buckets: 'buckets', heartRate: 'heartRate' };

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onerror = () => reject(req.error);
    req.onsuccess = () => resolve(req.result);
    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains('events')) {
        db.createObjectStore('events', { keyPath: 'id', autoIncrement: true });
      }
      if (!db.objectStoreNames.contains('buckets')) {
        const bucketStore = db.createObjectStore('buckets', { keyPath: 'key' });
        bucketStore.createIndex('date', 'date', { unique: false });
        bucketStore.createIndex('minute', 'minute', { unique: false });
      }
      if (!db.objectStoreNames.contains('heartRate')) {
        db.createObjectStore('heartRate', { keyPath: 'date' });
      }
    };
  });
}

function tsToDateStr(ts) {
  const d = new Date(ts);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export async function addEvent(event) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const ts = event.ts ?? Date.now();
    const date = event.date ?? tsToDateStr(ts);
    const tx = db.transaction('events', 'readwrite');
    tx.objectStore('events').add({ ...event, ts, date });
    tx.oncomplete = () => { db.close(); resolve(); };
    tx.onerror = () => reject(tx.error);
  });
}

export async function getEventsSince(timestamp) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('events', 'readonly');
    const store = tx.objectStore('events');
    const req = store.getAll();
    req.onsuccess = () => {
      const events = (req.result || []).filter(e => e.ts >= timestamp);
      db.close();
      resolve(events);
    };
    req.onerror = () => reject(req.error);
  });
}

export async function getEventsForDate(dateStr) {
  const startOfDay = new Date(dateStr + 'T00:00:00').getTime();
  const endOfDay = new Date(dateStr + 'T23:59:59.999').getTime();
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('events', 'readonly');
    const store = tx.objectStore('events');
    const req = store.getAll();
    req.onsuccess = () => {
      const events = (req.result || []).filter(e => e.ts >= startOfDay && e.ts <= endOfDay);
      db.close();
      resolve(events.sort((a, b) => a.ts - b.ts));
    };
    req.onerror = () => reject(req.error);
  });
}

export async function saveBucket(bucket) {
  const db = await openDB();
  const key = `${bucket.date}_${bucket.minute}`;
  return new Promise((resolve, reject) => {
    const tx = db.transaction('buckets', 'readwrite');
    tx.objectStore('buckets').put({ ...bucket, key });
    tx.oncomplete = () => { db.close(); resolve(); };
    tx.onerror = () => reject(tx.error);
  });
}

export async function getBucketByKey(key) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('buckets', 'readonly');
    const req = tx.objectStore('buckets').get(key);
    req.onsuccess = () => { db.close(); resolve(req.result || null); };
    req.onerror = () => reject(req.error);
  });
}

export async function getBucketsForDate(date) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('buckets', 'readonly');
    const index = tx.objectStore('buckets').index('date');
    const req = index.getAll(date);
    req.onsuccess = () => {
      db.close();
      resolve(req.result || []);
    };
    req.onerror = () => reject(req.error);
  });
}

export async function getBucketsInRange(startDate, endDate) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('buckets', 'readonly');
    const store = tx.objectStore('buckets');
    const req = store.getAll();
    req.onsuccess = () => {
      const buckets = (req.result || []).filter(
        b => b.date >= startDate && b.date <= endDate
      );
      db.close();
      resolve(buckets);
    };
    req.onerror = () => reject(req.error);
  });
}

export function parseGarminHeartRate(json) {
  let data;
  try {
    const str = typeof json === 'string' ? json.replace(/^\uFEFF/, '').trim() : json;
    data = typeof str === 'string' ? JSON.parse(str) : str;
  } catch (e) {
    throw new Error('Invalid JSON: ' + (e?.message || 'parse error'));
  }
  const values = data.heartRateValues || [];
  const firstTs = values[0]?.[0];
  const dateStr = data.calendarDate || (firstTs ? (() => {
    const d = new Date(firstTs);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  })() : null);
  const heartRateValues = values
    .filter(([ts]) => ts && typeof ts === 'number')
    .map(([ts, hr]) => [ts, typeof hr === 'number' ? hr : 0]);
  return {
    date: dateStr,
    calendarDate: data.calendarDate,
    maxHeartRate: data.maxHeartRate,
    minHeartRate: data.minHeartRate,
    restingHeartRate: data.restingHeartRate,
    heartRateValues
  };
}

export async function saveHeartRate(dateStr, data) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const record = { date: dateStr, ...data };
    const tx = db.transaction('heartRate', 'readwrite');
    tx.objectStore('heartRate').put(record);
    tx.oncomplete = () => { db.close(); resolve(); };
    tx.onerror = () => reject(tx.error);
  });
}

export async function getHeartRateForDate(dateStr) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('heartRate', 'readonly');
    const req = tx.objectStore('heartRate').get(dateStr);
    req.onsuccess = () => { db.close(); resolve(req.result || null); };
    req.onerror = () => reject(req.error);
  });
}

export async function clearOldEvents(beforeTimestamp) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('events', 'readwrite');
    const store = tx.objectStore('events');
    const req = store.openCursor();
    req.onsuccess = function () {
      const cursor = req.result;
      if (cursor) {
        if (cursor.value.ts < beforeTimestamp) cursor.delete();
        cursor.continue();
      } else {
        db.close();
        resolve();
      }
    };
    req.onerror = () => reject(req.error);
  });
}
