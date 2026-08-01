import type { PersistenceAdapter } from '../persistence/PersistenceAdapter'
import { DEFAULT_SETTINGS, type Settings } from './types'

const PERSIST_KEY = 'settings-store'

export class SettingsStore {
  private state: Settings = { ...DEFAULT_SETTINGS }
  private listeners = new Set<(settings: Settings) => void>()
  private persistence?: PersistenceAdapter

  constructor(persistence?: PersistenceAdapter) {
    this.persistence = persistence
  }

  async load(): Promise<void> {
    if (!this.persistence) return
    const saved = await this.persistence.load<Settings>(PERSIST_KEY)
    if (saved) this.state = { ...DEFAULT_SETTINGS, ...saved }
  }

  get(): Settings {
    return this.state
  }

  set(patch: Partial<Settings>): void {
    this.state = { ...this.state, ...patch }
    for (const listener of this.listeners) listener(this.state)
    void this.persistence?.save(PERSIST_KEY, this.state)
  }

  subscribe(fn: (settings: Settings) => void): () => void {
    this.listeners.add(fn)
    return () => this.listeners.delete(fn)
  }
}
