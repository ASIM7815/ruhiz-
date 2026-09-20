/**
 * Client-side persistent media storage using IndexedDB.
 * Supports storing large video files (up to 300 MB+) and photos so they persist
 * across page refreshes and sessions even when Cloudflare R2 is not configured.
 */

const DB_NAME = 'duel_media_store';
const STORE_NAME = 'media_blobs';
const DB_VERSION = 1;

let dbPromise: Promise<IDBDatabase> | null = null;

function getDB(): Promise<IDBDatabase> {
  if (typeof window === 'undefined' || !window.indexedDB) {
    return Promise.reject(new Error('IndexedDB is not available in this environment.'));
  }
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const req = window.indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME, { keyPath: 'key' });
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => {
        dbPromise = null;
        reject(req.error || new Error('Failed to open IndexedDB.'));
      };
    });
  }
  return dbPromise;
}

export interface StoredMediaItem {
  key: string;
  blob: Blob;
  mimeType: string;
  size: number;
  filename: string;
  createdAt: number;
}

export async function saveMediaBlob(
  key: string,
  blob: Blob,
  filename = 'media.bin'
): Promise<string> {
  try {
    const db = await getDB();
    return await new Promise<string>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const item: StoredMediaItem = {
        key,
        blob,
        mimeType: blob.type || 'application/octet-stream',
        size: blob.size,
        filename,
        createdAt: Date.now(),
      };
      const req = store.put(item);
      req.onsuccess = () => resolve(key);
      req.onerror = () => reject(req.error || new Error('Failed to save media in IndexedDB.'));
    });
  } catch (err) {
    console.warn('[idb-storage] saveMediaBlob failed, using memory fallback:', err);
    return key;
  }
}

export async function getMediaBlob(key: string): Promise<Blob | null> {
  try {
    const db = await getDB();
    return await new Promise<Blob | null>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(key);
      req.onsuccess = () => {
        const result = req.result as StoredMediaItem | undefined;
        resolve(result?.blob ?? null);
      };
      req.onerror = () => reject(req.error || new Error('Failed to read media from IndexedDB.'));
    });
  } catch {
    return null;
  }
}

export async function deleteMediaBlob(key: string): Promise<void> {
  try {
    const db = await getDB();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.delete(key);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch {
    // Ignore cleanup errors
  }
}
