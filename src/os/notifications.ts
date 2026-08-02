/** A real OS-level event, not a UI toast someone typed by hand — commands emit these when
 * something user-visible actually happens (a package installs, a service starts). The desktop
 * shell subscribes and turns them into notification toasts; nothing about this module is React. */
export interface KernelNotification {
  app: string
  title: string
  body: string
}

export class NotificationBus {
  private listeners = new Set<(n: KernelNotification) => void>()

  emit(n: KernelNotification): void {
    for (const listener of this.listeners) listener(n)
  }

  subscribe(fn: (n: KernelNotification) => void): () => void {
    this.listeners.add(fn)
    return () => this.listeners.delete(fn)
  }
}
