import type { PersistenceAdapter } from './PersistenceAdapter'

const DB_NAME = 'ubuntu-web-os'
const STORE_NAME = 'kv'
const DB_VERSION = 1

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(STORE_NAME)) {
        req.result.createObjectStore(STORE_NAME)
      }
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

/** Browser persistence backed by IndexedDB. Silently no-ops if IndexedDB is unavailable. */
export class IndexedDbAdapter implements PersistenceAdapter {
  private dbPromise: Promise<IDBDatabase> | null =
    typeof indexedDB !== 'undefined' ? openDb() : null

  async load<T>(key: string): Promise<T | null> {
    if (!this.dbPromise) return null
    const db = await this.dbPromise
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly')
      const req = tx.objectStore(STORE_NAME).get(key)
      req.onsuccess = () => resolve((req.result as T) ?? null)
      req.onerror = () => reject(req.error)
    })
  }

  async save<T>(key: string, data: T): Promise<void> {
    if (!this.dbPromise) return
    const db = await this.dbPromise
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite')
      tx.objectStore(STORE_NAME).put(data, key)
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
    })
  }
}
