import type { PersistenceAdapter } from './PersistenceAdapter'

/** Non-persistent adapter used in tests and as a safe default. */
export class MemoryAdapter implements PersistenceAdapter {
  private store = new Map<string, unknown>()

  async load<T>(key: string): Promise<T | null> {
    return (this.store.has(key) ? (this.store.get(key) as T) : null)
  }

  async save<T>(key: string, data: T): Promise<void> {
    this.store.set(key, data)
  }
}
