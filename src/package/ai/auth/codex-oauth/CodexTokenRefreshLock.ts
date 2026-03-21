export class CodexTokenRefreshLock {
  private readonly inflight = new Map<string, Promise<unknown>>()

  async runExclusive<T>(key: string, task: () => Promise<T>): Promise<T> {
    const existing = this.inflight.get(key)
    if (existing) {
      return existing as Promise<T>
    }

    const created = task().finally(() => {
      this.inflight.delete(key)
    })
    this.inflight.set(key, created)
    return created
  }
}
